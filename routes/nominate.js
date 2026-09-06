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

const ALLOWED_STATUSES = new Set(['Submitted', 'Verified', 'Clarification', 'Pending']);
const DISTRICTS_SET = new Set(TELANGANA_DISTRICTS.map((d) => d.toLowerCase()));

function validateDistrict(dist) {
  if (!dist || typeof dist !== 'string') return 'Hyderabad';
  const clean = dist.trim();
  const match = TELANGANA_DISTRICTS.find((d) => d.toLowerCase() === clean.toLowerCase());
  return match || 'Hyderabad';
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

    // District-level isolation: Secretaries cannot see other districts
    if (role !== 'SUPER_ADMIN' && userDistrict !== 'ALL_DISTRICTS' && userDistrict !== 'ALL') {
      if (!req.user.district || typeof req.user.district !== 'string') {
        filter.district = '__UNAUTHORIZED_NO_DISTRICT__';
      } else {
        const sanitized = escapeRegex(sanitizeDistrictName(req.user.district));
        filter.district = { $regex: new RegExp(`^${sanitized}(\\s+District)?$`, 'i') };
      }
    }

    const athletes = await Athlete.find(filter).sort({ createdAt: -1 }).lean();
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
      return res.status(400).json({ success: false, error: 'Invalid athlete identifier' });
    }

    const id = rawId.trim();
    let athlete;

    // Strict projection: Omit sensitive PII (residentialAddress, mobileNumber, dobProofPath, coachMobile, remarks)
    const publicFields = 'firstName lastName dob gender category district chestNumber events status guardianName institutionName aadhaarLast4 photoPath';

    if (/^[0-9a-fA-F]{24}$/.test(id)) {
      athlete = await Athlete.findById(id).select(publicFields).lean();
    } else {
      athlete = await Athlete.findOne({ chestNumber: id.toUpperCase().trim() }).select(publicFields).lean();
    }

    if (!athlete) {
      return res.status(404).json({ success: false, error: 'Athlete record not found' });
    }

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
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid athlete ID format.' });
    }

    const query = { _id: id };
    const role = (req.user.role || '').toUpperCase().trim();
    const userDistrict = (req.user.district || '').toUpperCase().trim();

    if (role !== 'SUPER_ADMIN' && userDistrict !== 'ALL_DISTRICTS' && userDistrict !== 'ALL') {
      if (!req.user.district || typeof req.user.district !== 'string') {
        query.district = '__UNAUTHORIZED_NO_DISTRICT__';
      } else {
        const sanitized = escapeRegex(sanitizeDistrictName(req.user.district));
        query.district = { $regex: new RegExp(`^${sanitized}(\\s+District)?$`, 'i') };
      }
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
    const { events } = req.body || {};
    let selectedEvents = [];

    if (Array.isArray(events)) {
      selectedEvents = events.filter((e) => typeof e === 'string' && e.trim());
    } else if (typeof events === 'string' && events.trim()) {
      selectedEvents = [events.trim()];
    }

    if (selectedEvents.length === 0) {
      return res.status(400).json({ success: false, message: 'Please select at least one event.' });
    }

    // Limit maximum event count to prevent abusive order creation
    const eventCount = Math.min(selectedEvents.length, 10);
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

      // Payment Signature Verification
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
      let paymentRecord = null;

      if (razorpay_order_id && razorpay_payment_id && razorpay_signature) {
        const isValid = verifyPaymentSignature(
          String(razorpay_order_id),
          String(razorpay_payment_id),
          String(razorpay_signature)
        );
        if (!isValid) {
          return res.status(400).json({ success: false, error: 'Payment verification failed. Invalid signature.' });
        }

        const rawEvents = body['events[]'] || body.events;
        const eventCount = Array.isArray(rawEvents) ? rawEvents.length : 1;

        paymentRecord = {
          orderId: String(razorpay_order_id),
          paymentId: String(razorpay_payment_id),
          amount: eventCount * FEE_PER_EVENT,
          status: 'PAID',
          paidAt: new Date()
        };
      }

      // Normalize & Sanitize Events
      let selectedEvents = [];
      const rawEvents = body['events[]'] || body.events;
      if (Array.isArray(rawEvents)) {
        selectedEvents = rawEvents.flat().filter(Boolean).map((e) => stripHtml(String(e)));
      } else if (typeof rawEvents === 'string' && rawEvents.trim()) {
        selectedEvents = [stripHtml(rawEvents.trim())];
      } else {
        selectedEvents = ['Traditional Yogasana'];
      }

      // STRICT DISTRICT AUTHORIZATION:
      // If caller is authenticated as a District Secretary, FORCE their assigned district!
      // They cannot spoof or modify the district by passing a different body parameter.
      let districtValue;
      if (req.user && req.user.role === 'SECRETARY') {
        districtValue = req.user.district;
      } else if (req.user && req.user.role === 'SUPER_ADMIN') {
        districtValue = validateDistrict(body.district);
      } else {
        districtValue = validateDistrict(body.district);
      }

      const dobValue = body.dob ? new Date(body.dob) : new Date();
      const category = body.category || calculateAgeCategory(dobValue);

      // Validate Aadhaar (exactly 4 digits)
      const rawAadhaar = String(body.aadhaarLast4 || body.aadhaar_last_4 || '0000').trim();
      const aadhaarLast4 = /^\d{4}$/.test(rawAadhaar) ? rawAadhaar : '0000';

      const athletePayload = {
        firstName: stripHtml(String(body.firstName || body.first_name || 'Unnamed')).substring(0, 80),
        lastName: stripHtml(String(body.lastName || body.last_name || '')).substring(0, 80),
        dob: dobValue,
        gender: ['Male', 'Female', 'Other'].includes(body.gender) ? body.gender : 'Female',
        aadhaarLast4,
        guardianName: stripHtml(String(body.guardianName || body.guardian_name || '')).substring(0, 100),
        institutionName: stripHtml(String(body.institutionName || body.institution_name || '')).substring(0, 120),
        mobileNumber: stripHtml(String(body.mobileNumber || body.mobile_number || '')).substring(0, 15),
        residentialAddress: stripHtml(String(body.residentialAddress || body.residential_address || '')).substring(0, 250),
        district: districtValue,
        events: selectedEvents.slice(0, 10),
        category,
        status: 'Submitted',
        paymentDetails: paymentRecord || undefined
      };

      if (req.files) {
        if (req.files.passport_photo?.[0]?.filename) {
          athletePayload.photoPath = `/uploads/${req.files.passport_photo[0].filename}`;
        }
        if (req.files.dob_certificate?.[0]?.filename) {
          athletePayload.dobProofPath = `/uploads/${req.files.dob_certificate[0].filename}`;
        }
      }

      // Generate Chest Number
      const count = await Athlete.countDocuments({
        district: athletePayload.district,
        category: athletePayload.category
      });
      athletePayload.chestNumber = formatChestNumber(athletePayload.district, athletePayload.category, count + 1);

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
      const schoolName = stripHtml(String(body.school_name || body.institutionName || 'Unknown School')).substring(0, 120);

      // STRICT DISTRICT AUTHORIZATION: Lock to Secretary's assigned district
      let district;
      if (req.user && req.user.role === 'SECRETARY') {
        district = req.user.district;
      } else {
        district = validateDistrict(body.district);
      }

      const coachName = stripHtml(String(body.coach_name || body.principal_name || '')).substring(0, 80);
      const coachMobile = stripHtml(String(body.coach_mobile || '')).substring(0, 15);

      let studentsData;
      try {
        studentsData = typeof body.students === 'string'
          ? JSON.parse(body.students)
          : (body.students || []);
      } catch {
        return res.status(400).json({ success: false, error: 'Invalid students payload. Must be valid JSON array.' });
      }

      if (!Array.isArray(studentsData) || studentsData.length === 0) {
        return res.status(400).json({ success: false, error: 'No student athletes provided in delegation.' });
      }

      // Enforce batch size limit to prevent DoS
      if (studentsData.length > 50) {
        return res.status(400).json({ success: false, error: 'Delegation exceeds maximum limit of 50 students per submission.' });
      }

      // Map uploaded files by fieldname
      const fileMap = {};
      if (req.files && Array.isArray(req.files)) {
        req.files.forEach((file) => {
          fileMap[file.fieldname] = `/uploads/${file.filename}`;
        });
      }

      // Pre-calculate baseline counts per category
      const categoriesInPayload = new Set();
      studentsData.forEach((student) => {
        const cat = student.category || calculateAgeCategory(student.dob);
        categoriesInPayload.add(cat);
      });

      const categoryCounts = {};
      await Promise.all(
        Array.from(categoriesInPayload).map(async (cat) => {
          categoryCounts[cat] = await Athlete.countDocuments({ district, category: cat });
        })
      );

      const athleteDocs = [];

      for (let i = 0; i < studentsData.length; i++) {
        const student = studentsData[i];
        const category = student.category || calculateAgeCategory(student.dob);

        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        const chestNumber = formatChestNumber(district, category, categoryCounts[category]);

        const rawAadhaar = String(student.aadhaarLast4 || student.aadhaar_last_4 || '0000').trim();
        const aadhaarLast4 = /^\d{4}$/.test(rawAadhaar) ? rawAadhaar : '0000';

        let events = ['Traditional Yogasana'];
        if (Array.isArray(student.events) && student.events.length > 0) {
          events = student.events.map((e) => stripHtml(String(e))).slice(0, 10);
        }

        athleteDocs.push({
          firstName: stripHtml(String(student.firstName || student.first_name || 'Athlete')).substring(0, 80),
          lastName: stripHtml(String(student.lastName || student.last_name || '')).substring(0, 80),
          dob: student.dob ? new Date(student.dob) : new Date(),
          gender: ['Male', 'Female', 'Other'].includes(student.gender) ? student.gender : 'Female',
          aadhaarLast4,
          guardianName: stripHtml(String(student.guardianName || student.guardian_name || '')).substring(0, 100),
          institutionName: schoolName,
          district,
          coachName,
          coachMobile,
          mobileNumber: stripHtml(String(student.mobileNumber || student.mobile_number || coachMobile)).substring(0, 15),
          residentialAddress: stripHtml(String(student.residentialAddress || student.residential_address || schoolName)).substring(0, 250),
          events,
          category,
          dobProofType: stripHtml(String(student.dobProofType || 'School Bonafide')).substring(0, 50),
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

    // Validate ID format to prevent CastError crashes
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid athlete ID format.' });
    }

    const { status, remarks } = req.body || {};

    // Validate status against schema enum
    if (!status || !ALLOWED_STATUSES.has(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${Array.from(ALLOWED_STATUSES).join(', ')}`
      });
    }

    const sanitizedRemarks = stripHtml(String(remarks || '')).substring(0, 500);
    const query = { _id: id };

    // STRICT DISTRICT ISOLATION: Secretaries cannot update athletes from another district
    if (req.user.role !== 'SUPER_ADMIN' && req.user.district !== 'ALL_DISTRICTS') {
      if (!req.user.district || typeof req.user.district !== 'string') {
        query.district = '__UNAUTHORIZED_NO_DISTRICT__';
      } else {
        const sanitized = escapeRegex(sanitizeDistrictName(req.user.district));
        query.district = { $regex: new RegExp(`^${sanitized}(\\s+District)?$`, 'i') };
      }
    }

    const updated = await Athlete.findOneAndUpdate(
      query,
      { status, remarks: sanitizedRemarks },
      { returnDocument: 'after', runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Athlete not found or unauthorized for your district.' });
    }

    return res.json(updated);
  } catch (err) {
    console.error('Status update error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to update status' });
  }
});

module.exports = router;