const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Razorpay = require('razorpay');

const Athlete = require('../models/Athlete');
const { requireAuth } = require('./auth');
const upload = require('../middleware/upload'); // Using your secure middleware!

// Razorpay Initialization
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_YOUR_KEY',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'YOUR_SECRET'
});
const FEE_PER_EVENT = 260; // ₹260 per event

/**
 * Calculates official Age Group Category as per Yoga Federation Regulations:
 * 1. Sub-Junior: 08 to <14 Years (Group A: 08-10 Yrs, Group B: 10-14 Yrs)
 * 2. Junior:     14 to <18 Years (14-18 Yrs)
 * 3. Senior:     18+ Years (Group A: 18-25 Yrs, Group B: 25-35 Yrs, Group C: Above 35 Yrs)
 */
function calculateAgeCategory(dob) {
  if (!dob) return 'Junior';
  const birthDate = new Date(dob);
  const today = new Date();
  const refDate = new Date(today.getFullYear(), 11, 31);
  const age = (refDate - birthDate) / (1000 * 60 * 60 * 24 * 365.25);
  if (age >= 8 && age < 14) return 'Sub-Junior';
  if (age >= 14 && age < 18) return 'Junior';
  if (age >= 18) return 'Senior';
  return 'Sub-Junior';
}

// ==========================================
// 1. GET /portal/athletes/list
// ==========================================
router.get('/list', requireAuth, async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  try {
    const role = (req.user.role || '').toUpperCase().trim();
    const district = (req.user.district || '').toUpperCase().trim();

    // BUG FIX: Added 'let' to initialize the variable properly
    let filter = {}; 

    if (role !== 'SUPER_ADMIN' && district !== 'ALL_DISTRICTS' && district !== 'ALL') {
      const userDist = (req.user.district || '').replace(/ district/i, '').trim();
      filter.district = { $regex: new RegExp(`^${userDist}(\\s+District)?$`, 'i') };
    }

    console.log("🔍 Final MongoDB Filter:", filter);
    const athletes = await Athlete.find(filter).sort({ createdAt: -1 });
    
    res.json(athletes);
  } catch (err) {
    console.error('Fetch Error in /portal/athletes/list:', err);
    res.status(500).json({ error: 'Failed to retrieve athletes' });
  }
});

// ==========================================
// 2. POST /portal/athletes/create-order
// ==========================================
router.post('/create-order', requireAuth, async (req, res) => {
  try {
    const { events } = req.body;
    let selectedEvents = [];
    
    if (Array.isArray(events)) {
      selectedEvents = events;
    } else if (typeof events === 'string' && events.trim()) {
      selectedEvents = [events.trim()];
    }

    if (selectedEvents.length === 0) {
      return res.status(400).json({ success: false, message: 'Please select at least one event.' });
    }

    // Calculate total amount in Paise (₹260 = 26000 paise)
    const amountInPaise = selectedEvents.length * FEE_PER_EVENT * 100;

    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `nom_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);
    
    res.json({
      success: true,
      orderId: order.id,
      amount: options.amount / 100,
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ success: false, message: 'Payment gateway initialization failed.' });
  }
});

// ==========================================
// 3. POST /portal/athletes/nominate (Uploads + Payment Verify)
// ==========================================
router.post(
  '/nominate',
  requireAuth,
  upload.fields([
    { name: 'passport_photo', maxCount: 1 },
    { name: 'dob_certificate', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const b = req.body || {};

      // --- PAYMENT VERIFICATION ---
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = b;
      
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ error: 'Payment details are missing. Nomination failed.' });
      }

      // Verify HMAC SHA256 signature
      const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
      hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
      const generatedSignature = hmac.digest('hex');

      if (generatedSignature !== razorpay_signature) {
        return res.status(400).json({ error: 'Payment verification failed. Invalid signature.' });
      }
      // ----------------------------

      let selectedEvents = [];
      const rawEvents = b['events[]'] || b.events;
      if (Array.isArray(rawEvents)) {
        selectedEvents = rawEvents.flat().filter(Boolean);
      } else if (typeof rawEvents === 'string' && rawEvents.trim()) {
        selectedEvents = [rawEvents.trim()];
      } else {
        selectedEvents = ['Traditional Yogasana'];
      }

      const athletePayload = {
        firstName: (b.firstName || b.first_name || 'Unnamed').trim(),
        lastName: (b.lastName || b.last_name || '').trim(),
        dob: b.dob || new Date(),
        gender: b.gender || 'Female',
        aadhaarLast4: (b.aadhaarLast4 || b.aadhaar_last_4 || 'XXXX').toString().trim(),
        guardianName: (b.guardianName || b.guardian_name || '').trim(),
        institutionName: (b.institutionName || b.institution_name || '').trim(),
        mobileNumber: (b.mobileNumber || b.mobile_number || '').trim(),
        residentialAddress: (b.residentialAddress || b.residential_address || '').trim(),
        district: typeof (Array.isArray(b.district) ? b.district[0] : (b.district || req.user?.district || 'Hyderabad')) === 'string'
          ? (Array.isArray(b.district) ? b.district[0] : (b.district || req.user?.district || 'Hyderabad')).trim()
          : 'Hyderabad',
        events: selectedEvents,
        category: b.category || calculateAgeCategory(b.dob),
        status: 'Submitted',
        // Save the successful payment record to the database
        paymentDetails: {
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
          amount: selectedEvents.length * FEE_PER_EVENT,
          status: 'PAID',
          paidAt: new Date()
        }
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
      const distStr = athletePayload.district.toUpperCase();
      const distCode = distStr.length >= 3 ? distStr.substring(0, 3) : 'HYD';

      let catCode = 'JR';
      const cat = athletePayload.category.toLowerCase();
      if (cat.includes('sub')) catCode = 'SJ';
      else if (cat.includes('sen')) catCode = 'SR';

      const count = await Athlete.countDocuments({
        district: athletePayload.district,
        category: athletePayload.category
      });

      const serial = String(count + 1).padStart(2, '0');
      athletePayload.chestNumber = `${distCode}-${catCode}-${serial}`;

      const newAthlete = new Athlete(athletePayload);
      await newAthlete.save();

      res.status(201).json({ success: true, athlete: newAthlete });
    } catch (err) {
      console.error('Nomination Error:', err);
      res.status(500).json({ error: 'Failed to nominate athlete', details: err.message });
    }
  }
);

// ==========================================
// 3b. POST /portal/athletes/bulk-nominate (School / Institution Registration)
// ==========================================
router.post(
  '/bulk-nominate',
  upload.any(),
  async (req, res) => {
    try {
      const b = req.body;
      const schoolName = (b.school_name || b.institutionName || 'Unknown School').trim();
      const district = (b.district || 'Hyderabad').trim();
      const coachName = (b.coach_name || b.principal_name || '').trim();
      const coachMobile = (b.coach_mobile || '').trim();
      const studentsData = typeof b.students === 'string' ? JSON.parse(b.students) : (b.students || []);

      if (!studentsData || studentsData.length === 0) {
        return res.status(400).json({ error: 'No student athletes provided in delegation.' });
      }

      // Map uploaded files by fieldname
      const fileMap = {};
      if (req.files && Array.isArray(req.files)) {
        req.files.forEach(f => {
          fileMap[f.fieldname] = `/uploads/${f.filename}`;
        });
      }

      const createdAthletes = [];
      const distStr = district.toUpperCase();
      const distCode = distStr.length >= 3 ? distStr.substring(0, 3) : 'HYD';

      for (let i = 0; i < studentsData.length; i++) {
        const s = studentsData[i];
        const category = s.category || calculateAgeCategory(s.dob);
        const catLower = category.toLowerCase();
        let catCode = 'JR';
        if (catLower.includes('sub')) catCode = 'SJ';
        else if (catLower.includes('sen')) catCode = 'SR';

        const count = await Athlete.countDocuments({ district, category });
        const serial = String(count + 1 + i).padStart(2, '0');
        const chestNumber = `${distCode}-${catCode}-${serial}`;

        const athleteDoc = new Athlete({
          firstName: (s.firstName || s.first_name || 'Athlete').trim(),
          lastName: (s.lastName || s.last_name || '').trim(),
          dob: s.dob || new Date(),
          gender: s.gender || 'Female',
          aadhaarLast4: (s.aadhaarLast4 || s.aadhaar_last_4 || '0000').toString().trim(),
          guardianName: (s.guardianName || s.guardian_name || '').trim(),
          institutionName: schoolName,
          district: district,
          coachName: coachName,
          coachMobile: coachMobile,
          mobileNumber: s.mobileNumber || s.mobile_number || coachMobile,
          residentialAddress: (s.residentialAddress || s.residential_address || schoolName).trim(),
          events: Array.isArray(s.events) && s.events.length > 0 ? s.events : ['Traditional Yogasana'],
          category: category,
          dobProofType: s.dobProofType || 'School Bonafide',
          photoPath: fileMap[`photo_${i}`] || fileMap[`passport_photo_${i}`] || '',
          dobProofPath: fileMap[`dob_${i}`] || fileMap[`dob_certificate_${i}`] || '',
          chestNumber: chestNumber,
          status: 'Submitted'
        });

        await athleteDoc.save();
        createdAthletes.push(athleteDoc);
      }

      res.status(201).json({
        success: true,
        count: createdAthletes.length,
        school: schoolName,
        district: district,
        athletes: createdAthletes
      });
    } catch (err) {
      console.error('Bulk School Nomination Error:', err);
      res.status(500).json({ error: 'Failed to process school nomination', details: err.message });
    }
  }
);

// ==========================================
// 4. PATCH /portal/athletes/:id/status
// ==========================================
router.patch('/:id/status', requireAuth, async (req, res) => {
  try {
    const { status, remarks } = req.body;
    let query = { _id: req.params.id };

    if (req.user.role !== 'SUPER_ADMIN' && req.user.district !== 'ALL_DISTRICTS') {
      const userDist = (req.user.district || '').replace(/ district/i, '').trim();
      query.district = { $regex: new RegExp(`^${userDist}(\\s+District)?$`, 'i') };
    }

    const updated = await Athlete.findOneAndUpdate(
      query,
      { status, remarks },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: 'Athlete not found or unauthorized' });
    res.json(updated);
  } catch (err) {
    console.error('Status Update Error:', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

module.exports = router;