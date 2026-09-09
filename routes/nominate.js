/**
 * Athlete Nomination & Management Routes
 * Hardened with strict district-level authorization, NoSQL/ReDoS defense, and input sanitization.
 */

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Athlete = require('../models/Athlete');
const { requireAuth, optionalAuth, nominationLimiter } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { getFileUrl } = require('../services/storage');
const { escapeRegex, stripHtml } = require('../middleware/sanitize');
const { TELANGANA_DISTRICTS } = require('../config/constants');
const {
  calculateAgeCategory,
  formatChestNumber,
  sanitizeDistrictName
} = require('../utils/category');
const {
  createOrder,
  verifyPaymentSignature,
  FEE_PER_EVENT
} = require('../utils/payment');
const {
  getNextChestNumber,
  getNextChestNumbersBatch
} = require('../utils/counter');
const {
  isValidPhone,
  isValidAadhaarLast4,
  isValidDate,
  isValidObjectId,
  isValidDistrict,
  normalizeDistrict,
  isValidGender,
  isValidStatus,
  validateEvents,
  sanitizeBoundedText,
  isValidFilename,
  ALLOWED_STATUSES
} = require('../utils/validators');

function validateDistrict(dist) {
  const norm = normalizeDistrict(dist);
  return norm || 'Hyderabad';
}

/**
 * Resolves an index-friendly district query filter.
 * Uses exact $in with normalized district names to hit the { district: 1, ... } compound index,
 * falling back to escaped regex only if unnormalized.
 */
function buildDistrictFilter(districtStr) {
  if (!districtStr || typeof districtStr !== 'string') {
    return '__UNAUTHORIZED_NO_DISTRICT__';
  }
  const norm = normalizeDistrict(districtStr);
  if (norm) {
    return { $in: [norm, `${norm} District`] };
  }
  const sanitized = escapeRegex(sanitizeDistrictName(districtStr));
  return { $regex: new RegExp(`^${sanitized}(\\s+District)?$`, 'i') };
}

// Bounded in-memory LRU/TTL cache for public admit cards
const ADMIT_CARD_CACHE_MAX = 2000;
const ADMIT_CARD_CACHE_TTL_MS = 60 * 1000; // 60 seconds
const admitCardCache = new Map();

function getCachedAdmitCard(key) {
  if (!key) return null;
  const entry = admitCardCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    admitCardCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedAdmitCard(key, data, extraKey = null) {
  if (!key) return;
  if (admitCardCache.size >= ADMIT_CARD_CACHE_MAX) {
    const oldestKey = admitCardCache.keys().next().value;
    if (oldestKey) admitCardCache.delete(oldestKey);
  }
  const entry = { data, expiresAt: Date.now() + ADMIT_CARD_CACHE_TTL_MS };
  admitCardCache.set(key, entry);
  if (extraKey && extraKey !== key) {
    admitCardCache.set(extraKey, entry);
  }
}

function evictCachedAdmitCard(key, extraKey = null) {
  if (key) admitCardCache.delete(key);
  if (extraKey) admitCardCache.delete(extraKey);
}

// ==========================================
// 1. GET /portal/athletes/list
// ==========================================
router.get('/list', requireAuth, async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  try {
    const role = (req.user.role || '').toUpperCase().trim();
    const userDistrict = (req.user.district || '').toUpperCase().trim();

    const filter = {};

    // Validate optional query parameters
    if (req.query.status !== undefined) {
      const statusFilter = String(req.query.status).trim();
      if (!isValidStatus(statusFilter)) {
        return res.status(400).json({
          success: false,
          error: `Invalid status filter. Allowed values: ${Array.from(ALLOWED_STATUSES).join(', ')}`
        });
      }
      filter.status = statusFilter;
    }

    let page = 1;
    let limit = 500;

    if (req.query.page !== undefined) {
      const parsedPage = parseInt(req.query.page, 10);
      if (isNaN(parsedPage) || parsedPage < 1 || String(parsedPage) !== String(req.query.page).trim()) {
        return res.status(400).json({ success: false, error: 'Page parameter must be a positive integer.' });
      }
      page = parsedPage;
    }

    if (req.query.limit !== undefined) {
      const parsedLimit = parseInt(req.query.limit, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 500 || String(parsedLimit) !== String(req.query.limit).trim()) {
        return res.status(400).json({ success: false, error: 'Limit parameter must be an integer between 1 and 500.' });
      }
      limit = parsedLimit;
    }

    const skip = (page - 1) * limit;

    // District-level isolation: Secretaries cannot see other districts
    if (role !== 'SUPER_ADMIN' && userDistrict !== 'ALL_DISTRICTS' && userDistrict !== 'ALL') {
      filter.district = buildDistrictFilter(req.user.district);
    } else if (role === 'SUPER_ADMIN' && req.query.district) {
      const qDist = String(req.query.district).trim();
      if (qDist.toUpperCase() !== 'ALL') {
        if (!isValidDistrict(qDist)) {
          return res.status(400).json({ success: false, error: 'Invalid district query filter.' });
        }
        filter.district = buildDistrictFilter(qDist);
      }
    }

    // High-performance lean projection: omits heavy paymentDetails, residentialAddress, and raw certs
    const LIST_PROJECTION = 'firstName lastName dob gender category district chestNumber events status institutionName guardianName createdAt aadhaarLast4 photoPath';

    // Execute query first; if page 1 has fewer items than limit, totalCount is known without a second countDocuments round-trip
    const athletes = await Athlete.find(filter, LIST_PROJECTION)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    let totalCount;
    if (page === 1 && athletes.length < limit) {
      totalCount = athletes.length;
    } else {
      totalCount = await Athlete.countDocuments(filter);
    }

    const totalPages = Math.ceil(totalCount / limit) || 1;
    res.set('X-Total-Count', String(totalCount));
    res.set('X-Page', String(page));
    res.set('X-Per-Page', String(limit));
    res.set('X-Total-Pages', String(totalPages));

    return res.json(athletes);
  } catch (err) {
    console.error('Fetch error in /portal/athletes/list:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to retrieve athletes' });
  }
});

// ==========================================
// 1b. GET /portal/athletes/:id/public-card (Admit Card View)
// ==========================================
router.get('/:id/public-card', async (req, res) => {
  try {
    const rawId = req.params.id;
    if (!rawId || typeof rawId !== 'string') {
      return res.status(400).json({ success: false, error: 'Athlete identifier is required.' });
    }

    const id = rawId.trim();
    if (id.length < 3 || id.length > 50 || /[^a-zA-Z0-9\-]/.test(id)) {
      return res.status(400).json({ success: false, error: 'Invalid athlete identifier format.' });
    }

    // Check bounded in-memory cache first
    const cacheKey = id.toUpperCase();
    const cachedAthlete = getCachedAdmitCard(cacheKey);
    if (cachedAthlete) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');
      return res.json(cachedAthlete);
    }

    let athlete;
    const publicFields = 'firstName lastName dob gender category district chestNumber events status guardianName institutionName aadhaarLast4 photoPath';

    if (isValidObjectId(id)) {
      athlete = await Athlete.findById(id).select(publicFields).lean();
    } else if (/^[A-Za-z0-9-]{3,30}$/.test(id)) {
      athlete = await Athlete.findOne({ chestNumber: id.toUpperCase() }).select(publicFields).lean();
    } else {
      return res.status(400).json({ success: false, error: 'Invalid athlete identifier format.' });
    }

    if (!athlete) {
      return res.status(404).json({ success: false, error: 'Athlete record not found' });
    }

    // Populate cache under requested key and secondary alias (Chest Number or ObjectId)
    const docId = athlete._id ? athlete._id.toString().toUpperCase() : null;
    const chestNum = athlete.chestNumber ? athlete.chestNumber.toUpperCase() : null;
    setCachedAdmitCard(cacheKey, athlete, cacheKey === chestNum ? docId : chestNum);

    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');
    return res.json(athlete);
  } catch (err) {
    console.error('Error fetching public admit card:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to retrieve athlete details' });
  }
});

// ==========================================
// 1c. GET /portal/athletes/:id (Protected Athlete Record - Scoped to District)
// ==========================================
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !isValidObjectId(id)) {
      return res.status(400).json({ success: false, error: 'Invalid athlete ID format.' });
    }

    const query = { _id: id };
    const role = (req.user.role || '').toUpperCase().trim();
    const userDistrict = (req.user.district || '').toUpperCase().trim();

    if (role !== 'SUPER_ADMIN' && userDistrict !== 'ALL_DISTRICTS' && userDistrict !== 'ALL') {
      query.district = buildDistrictFilter(req.user.district);
    }

    const athlete = await Athlete.findOne(query).lean();
    if (!athlete) {
      return res.status(404).json({ success: false, error: 'Athlete not found or unauthorized for your district.' });
    }

    return res.json(athlete);
  } catch (err) {
    console.error('Athlete detail fetch error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to retrieve athlete details' });
  }
});

// ==========================================
// 2. POST /portal/athletes/create-order
// ==========================================
router.post('/create-order', nominationLimiter, async (req, res) => {
  try {
    const body = req.body || {};

    // Reject unexpected fields to prevent parameter injection
    const allowedKeys = new Set(['events']);
    const unexpected = Object.keys(body).filter((k) => !allowedKeys.has(k));
    if (unexpected.length > 0) {
      return res.status(400).json({ success: false, message: `Unexpected field(s): ${unexpected.join(', ')}` });
    }

    const { events } = body;
    const eventsValidation = validateEvents(events);
    if (!eventsValidation.isValid) {
      return res.status(400).json({ success: false, message: eventsValidation.error });
    }

    const eventCount = Math.min(eventsValidation.events.length, 10);
    const orderData = await createOrder(eventCount);

    return res.json({
      success: true,
      ...orderData
    });
  } catch (err) {
    console.error('Order creation error:', err.message);
    return res.status(500).json({ success: false, message: 'Payment gateway initialization failed.' });
  }
});

// ==========================================
// 3. POST /portal/athletes/nominate (Uploads + Payment Verification)
// ==========================================
router.post(
  '/nominate',
  nominationLimiter,
  optionalAuth,
  upload.fields([
    { name: 'passport_photo', maxCount: 1 },
    { name: 'dob_certificate', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const body = req.body || {};

      // 1. First & Last Name validation
      const rawFirstName = body.firstName || body.first_name;
      const rawLastName = body.lastName || body.last_name || '';
      if (!rawFirstName || typeof rawFirstName !== 'string' || rawFirstName.trim().length === 0) {
        return res.status(400).json({ success: false, error: 'First name is required (1 to 80 characters).' });
      }
      if (rawFirstName.trim().length > 80) {
        return res.status(400).json({ success: false, error: 'First name cannot exceed 80 characters.' });
      }

      if (typeof rawLastName !== 'string' || rawLastName.trim().length > 80) {
        return res.status(400).json({ success: false, error: 'Last name cannot exceed 80 characters.' });
      }

      // 2. Date of Birth validation
      const rawDob = body.dob;
      if (!rawDob || !isValidDate(rawDob, 5, 100)) {
        return res.status(400).json({
          success: false,
          error: 'Valid Date of Birth is required (athlete age must be between 5 and 100 years).'
        });
      }
      const dobValue = new Date(rawDob);

      // 3. Gender validation
      let rawGender = 'Female';
      if (body.gender !== undefined && body.gender !== null && String(body.gender).trim()) {
        const candidateGender = String(body.gender).trim();
        if (!isValidGender(candidateGender)) {
          return res.status(400).json({
            success: false,
            error: 'Valid gender is required. Allowed values: Male, Female, Other.'
          });
        }
        rawGender = candidateGender;
      }

      // 4. Aadhaar last 4 digits validation
      let aadhaarLast4 = '0000';
      const rawAadhaar = body.aadhaarLast4 || body.aadhaar_last_4;
      if (rawAadhaar !== undefined && rawAadhaar !== null && String(rawAadhaar).trim()) {
        if (!isValidAadhaarLast4(rawAadhaar)) {
          return res.status(400).json({
            success: false,
            error: 'Aadhaar last 4 digits must be exactly 4 numeric digits.'
          });
        }
        aadhaarLast4 = String(rawAadhaar).trim();
      }

      // 5. Guardian Name validation
      const rawGuardian = body.guardianName || body.guardian_name || '';
      if (typeof rawGuardian !== 'string' || rawGuardian.trim().length > 100) {
        return res.status(400).json({ success: false, error: 'Guardian name cannot exceed 100 characters.' });
      }

      // 6. Institution Name validation
      const rawInstitution = body.institutionName || body.institution_name || '';
      if (typeof rawInstitution !== 'string' || rawInstitution.trim().length > 120) {
        return res.status(400).json({ success: false, error: 'Institution name cannot exceed 120 characters.' });
      }

      // 7. Mobile Number validation
      let mobileNumber = '';
      const rawMobile = body.mobileNumber || body.mobile_number;
      if (rawMobile !== undefined && rawMobile !== null && String(rawMobile).trim()) {
        if (!isValidPhone(rawMobile)) {
          return res.status(400).json({
            success: false,
            error: 'Valid 10-digit mobile number starting with 6, 7, 8, or 9 is required.'
          });
        }
        mobileNumber = String(rawMobile).trim();
      }

      // 8. Residential Address validation
      const rawAddress = body.residentialAddress || body.residential_address || '';
      if (typeof rawAddress !== 'string' || rawAddress.trim().length > 250) {
        return res.status(400).json({ success: false, error: 'Residential address cannot exceed 250 characters.' });
      }

      // 9. Events validation
      let selectedEvents = ['Traditional Yogasana'];
      const rawEvents = body['events[]'] || body.events;
      if (rawEvents !== undefined && rawEvents !== null && (Array.isArray(rawEvents) ? rawEvents.length > 0 : String(rawEvents).trim())) {
        const eventsValidation = validateEvents(rawEvents);
        if (!eventsValidation.isValid) {
          return res.status(400).json({ success: false, error: eventsValidation.error });
        }
        selectedEvents = eventsValidation.events;
      }

      // 10. STRICT DISTRICT AUTHORIZATION & VALIDATION:
      // If caller is authenticated as a District Secretary, FORCE their assigned district!
      // They cannot spoof or modify the district by passing a different body parameter.
      let districtValue;
      if (req.user && req.user.role === 'SECRETARY') {
        districtValue = req.user.district;
      } else {
        if (body.district) {
          if (!isValidDistrict(body.district)) {
            return res.status(400).json({
              success: false,
              error: 'Please select a valid district from the 33 official Telangana districts.'
            });
          }
          districtValue = normalizeDistrict(body.district);
        } else {
          districtValue = 'Hyderabad';
        }
      }

      const category = calculateAgeCategory(dobValue);

      // 11. Payment Signature Verification (if provided)
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
      let paymentRecord = null;

      if (razorpay_order_id || razorpay_payment_id || razorpay_signature) {
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
          return res.status(400).json({ success: false, error: 'Incomplete payment parameters provided.' });
        }
        const orderIdStr = String(razorpay_order_id).trim();
        const paymentIdStr = String(razorpay_payment_id).trim();
        const signatureStr = String(razorpay_signature).trim();

        if (
          !/^order_[a-zA-Z0-9]+$/.test(orderIdStr) ||
          !/^pay_[a-zA-Z0-9]+$/.test(paymentIdStr) ||
          !/^[0-9a-fA-F]{64}$/.test(signatureStr)
        ) {
          return res.status(400).json({ success: false, error: 'Malformed payment gateway parameters.' });
        }

        const isValid = verifyPaymentSignature(orderIdStr, paymentIdStr, signatureStr);
        if (!isValid) {
          return res.status(400).json({ success: false, error: 'Payment verification failed. Invalid signature.' });
        }

        paymentRecord = {
          orderId: orderIdStr,
          paymentId: paymentIdStr,
          amount: selectedEvents.length * FEE_PER_EVENT,
          status: 'PAID',
          paidAt: new Date()
        };
      }

      const athletePayload = {
        firstName: sanitizeBoundedText(rawFirstName, 80),
        lastName: sanitizeBoundedText(rawLastName, 80),
        dob: dobValue,
        gender: rawGender,
        aadhaarLast4,
        guardianName: sanitizeBoundedText(rawGuardian, 100),
        institutionName: sanitizeBoundedText(rawInstitution, 120),
        mobileNumber,
        residentialAddress: sanitizeBoundedText(rawAddress, 250),
        district: districtValue,
        events: selectedEvents.slice(0, 10),
        category,
        status: 'Submitted',
        paymentDetails: paymentRecord || undefined
      };

      if (req.files) {
        if (req.files.passport_photo?.[0]) {
          const photo = req.files.passport_photo[0];
          if (!isValidFilename(photo.filename)) {
            return res.status(400).json({ success: false, error: 'Invalid photo filename.' });
          }
          athletePayload.photoPath = getFileUrl(photo.filename);
        }
        if (req.files.dob_certificate?.[0]) {
          const cert = req.files.dob_certificate[0];
          if (!isValidFilename(cert.filename)) {
            return res.status(400).json({ success: false, error: 'Invalid certificate filename.' });
          }
          athletePayload.dobProofPath = getFileUrl(cert.filename);
        }
      }

      // Atomically Generate Next Chest Number (Thread-safe & concurrency-safe)
      athletePayload.chestNumber = await getNextChestNumber(
        athletePayload.district,
        athletePayload.category
      );

      const newAthlete = new Athlete(athletePayload);
      await newAthlete.save();

      return res.status(201).json({ success: true, athlete: newAthlete });
    } catch (err) {
      console.error('Nomination error:', err.message);
      return res.status(500).json({ success: false, error: 'Failed to nominate athlete. Please check the submitted data and try again.' });
    }
  }
);

// ==========================================
// 3b. POST /portal/athletes/bulk-nominate (School / Institution Registration)
// ==========================================
router.post(
  '/bulk-nominate',
  nominationLimiter,
  optionalAuth,
  upload.any(),
  async (req, res) => {
    try {
      const body = req.body || {};

      // 1. School name validation
      const rawSchool = body.school_name || body.institutionName;
      if (!rawSchool || typeof rawSchool !== 'string' || rawSchool.trim().length < 2) {
        return res.status(400).json({ success: false, error: 'School / institution name is required (2 to 120 characters).' });
      }
      if (rawSchool.trim().length > 120) {
        return res.status(400).json({ success: false, error: 'School name cannot exceed 120 characters.' });
      }
      const schoolName = sanitizeBoundedText(rawSchool, 120);

      // 2. Coach name validation
      const rawCoach = body.coach_name || body.principal_name;
      if (!rawCoach || typeof rawCoach !== 'string' || rawCoach.trim().length < 2) {
        return res.status(400).json({ success: false, error: 'Coach or representative name is required (2 to 80 characters).' });
      }
      if (rawCoach.trim().length > 80) {
        return res.status(400).json({ success: false, error: 'Coach name cannot exceed 80 characters.' });
      }
      const coachName = sanitizeBoundedText(rawCoach, 80);

      // 3. Coach mobile validation
      const rawCoachMobile = body.coach_mobile;
      if (!isValidPhone(rawCoachMobile)) {
        return res.status(400).json({
          success: false,
          error: 'Valid 10-digit coach mobile number starting with 6, 7, 8, or 9 is required.'
        });
      }
      const coachMobile = String(rawCoachMobile).trim();

      // 4. District validation & strict isolation
      let district;
      if (req.user && req.user.role === 'SECRETARY') {
        district = req.user.district;
      } else {
        if (!isValidDistrict(body.district)) {
          return res.status(400).json({
            success: false,
            error: 'Please select a valid district from the 33 official Telangana districts.'
          });
        }
        district = normalizeDistrict(body.district);
      }

      // 5. Students array validation
      let studentsData;
      try {
        studentsData = typeof body.students === 'string'
          ? JSON.parse(body.students)
          : (body.students || []);
      } catch {
        return res.status(400).json({ success: false, error: 'Invalid students payload. Must be a valid JSON array.' });
      }

      if (!Array.isArray(studentsData) || studentsData.length === 0) {
        return res.status(400).json({ success: false, error: 'No student athletes provided in delegation. At least 1 is required.' });
      }

      // Enforce batch size limit to prevent DoS
      if (studentsData.length > 50) {
        return res.status(400).json({ success: false, error: 'Delegation exceeds maximum limit of 50 students per submission.' });
      }

      // Validate each student record in array
      for (let i = 0; i < studentsData.length; i++) {
        const s = studentsData[i];
        if (!s || typeof s !== 'object') {
          return res.status(400).json({ success: false, error: `Student #${i + 1} must be a valid object.` });
        }

        const fn = s.firstName || s.first_name;
        if (!fn || typeof fn !== 'string' || fn.trim().length === 0 || fn.trim().length > 80) {
          return res.status(400).json({ success: false, error: `Student #${i + 1}: Valid first name is required (1 to 80 chars).` });
        }

        const ln = s.lastName || s.last_name;
        if (!ln || typeof ln !== 'string' || ln.trim().length === 0 || ln.trim().length > 80) {
          return res.status(400).json({ success: false, error: `Student #${i + 1}: Valid last name is required (1 to 80 chars).` });
        }

        if (!isValidDate(s.dob, 5, 100)) {
          return res.status(400).json({ success: false, error: `Student #${i + 1}: Valid Date of Birth is required (age 5-100).` });
        }

        if (!isValidGender(s.gender)) {
          return res.status(400).json({ success: false, error: `Student #${i + 1}: Gender must be Male, Female, or Other.` });
        }

        const aadhaar = s.aadhaarLast4 || s.aadhaar_last_4;
        if (!isValidAadhaarLast4(aadhaar)) {
          return res.status(400).json({ success: false, error: `Student #${i + 1}: Aadhaar must be exactly 4 digits.` });
        }

        const evCheck = validateEvents(s.events);
        if (!evCheck.isValid) {
          return res.status(400).json({ success: false, error: `Student #${i + 1}: ${evCheck.error}` });
        }

        if (s.mobileNumber && !isValidPhone(s.mobileNumber)) {
          return res.status(400).json({ success: false, error: `Student #${i + 1}: Invalid mobile number format.` });
        }
      }

      // Map uploaded files by fieldname
      const fileMap = {};
      if (req.files && Array.isArray(req.files)) {
        req.files.forEach((file) => {
          if (isValidFilename(file.filename)) {
            fileMap[file.fieldname] = getFileUrl(file.filename);
          }
        });
      }

      // Pre-calculate and atomically allocate batch chest numbers per category
      const studentsPerCategory = {};
      studentsData.forEach((student) => {
        const cat = student.category || calculateAgeCategory(student.dob);
        studentsPerCategory[cat] = (studentsPerCategory[cat] || 0) + 1;
      });

      const allocatedChestNumbers = {};
      await Promise.all(
        Object.entries(studentsPerCategory).map(async ([cat, count]) => {
          allocatedChestNumbers[cat] = await getNextChestNumbersBatch(district, cat, count);
        })
      );

      const athleteDocs = [];

      for (let i = 0; i < studentsData.length; i++) {
        const student = studentsData[i];
        const category = student.category || calculateAgeCategory(student.dob);
        const chestNumber = allocatedChestNumbers[category] && allocatedChestNumbers[category].length > 0
          ? allocatedChestNumbers[category].shift()
          : await getNextChestNumber(district, category);

        const rawAadhaar = String(student.aadhaarLast4 || student.aadhaar_last_4).trim();
        const evCheck = validateEvents(student.events);
        const events = evCheck.isValid ? evCheck.events : ['Traditional Yogasana'];

        athleteDocs.push({
          firstName: sanitizeBoundedText(student.firstName || student.first_name, 80),
          lastName: sanitizeBoundedText(student.lastName || student.last_name, 80),
          dob: new Date(student.dob),
          gender: student.gender,
          aadhaarLast4: rawAadhaar,
          guardianName: sanitizeBoundedText(student.guardianName || student.guardian_name, 100),
          institutionName: schoolName,
          district,
          coachName,
          coachMobile,
          mobileNumber: student.mobileNumber && isValidPhone(student.mobileNumber) ? String(student.mobileNumber).trim() : coachMobile,
          residentialAddress: sanitizeBoundedText(student.residentialAddress || student.residential_address, 250, schoolName),
          events,
          category,
          dobProofType: sanitizeBoundedText(student.dobProofType, 50, 'School Bonafide'),
          photoPath: fileMap[`photo_${i}`] || fileMap[`passport_photo_${i}`] || '',
          dobProofPath: fileMap[`dob_${i}`] || fileMap[`dob_certificate_${i}`] || '',
          chestNumber,
          status: 'Submitted'
        });
      }

      const createdAthletes = await Athlete.insertMany(athleteDocs);

      return res.status(201).json({
        success: true,
        count: createdAthletes.length,
        school: schoolName,
        district,
        athletes: createdAthletes
      });
    } catch (err) {
      console.error('Bulk school nomination error:', err.message);
      return res.status(500).json({ success: false, error: 'Failed to process school nomination delegation. Please check format and try again.' });
    }
  }
);

// ==========================================
// 4. PATCH /portal/athletes/:id/status
// ==========================================
router.patch('/:id/status', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID format
    if (!id || !isValidObjectId(id)) {
      return res.status(400).json({ success: false, error: 'Invalid athlete ID format.' });
    }

    const body = req.body || {};

    // Reject unexpected keys to prevent field injection
    const allowedKeys = new Set(['status', 'remarks']);
    const unexpected = Object.keys(body).filter((k) => !allowedKeys.has(k));
    if (unexpected.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Unexpected field(s) in status update: ${unexpected.join(', ')}`
      });
    }

    const { status, remarks } = body;

    // Validate status against schema enum
    if (!status || !isValidStatus(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${Array.from(ALLOWED_STATUSES).join(', ')}`
      });
    }

    if (remarks !== undefined && typeof remarks !== 'string') {
      return res.status(400).json({ success: false, error: 'Remarks must be a string.' });
    }

    const sanitizedRemarks = stripHtml(String(remarks || '')).substring(0, 500);
    const query = { _id: id };

    // STRICT DISTRICT ISOLATION: Secretaries cannot update athletes from another district
    if (req.user.role !== 'SUPER_ADMIN' && req.user.district !== 'ALL_DISTRICTS') {
      query.district = buildDistrictFilter(req.user.district);
    }

    const updated = await Athlete.findOneAndUpdate(
      query,
      { status, remarks: sanitizedRemarks },
      { returnDocument: 'after', runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Athlete not found or unauthorized for your district.' });
    }

    // Invalidate cached admit card upon status or remark mutation
    evictCachedAdmitCard(id.toUpperCase(), updated.chestNumber ? updated.chestNumber.toUpperCase() : null);

    return res.json(updated);
  } catch (err) {
    console.error('Status update error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to update status' });
  }
});

router._cache = { admitCardCache, getCachedAdmitCard, setCachedAdmitCard, evictCachedAdmitCard };

module.exports = router;