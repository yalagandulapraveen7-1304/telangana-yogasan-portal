const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Athlete = require('../models/Athlete');

// 1. Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

// 2. Multer Configuration with 25MB Limit
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'passport_photo' && !file.mimetype.startsWith('image/')) {
      return cb(new Error('Passport photo must be an image file.'));
    }
    if (
      file.fieldname === 'dob_certificate' &&
      !['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'].includes(file.mimetype)
    ) {
      return cb(new Error('DOB certificate must be a PDF or image file.'));
    }
    cb(null, true);
  }
});

// 3. GET /portal/athletes/list (Fetch Athletes)
router.get('/list', async (req, res) => {
  try {
    const athletes = await Athlete.find().sort({ createdAt: -1 });
    res.json(athletes);
  } catch (err) {
    console.error('Fetch Error:', err);
    res.status(500).json({ error: 'Failed to retrieve athletes' });
  }
});

// 4. POST /portal/athletes/nominate (Register Athlete)
router.post(
  '/nominate',
  upload.fields([
    { name: 'passport_photo', maxCount: 1 },
    { name: 'dob_certificate', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const b = req.body || {};

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
        aadhaarLast4: (b.aadhaarLast4 || b.aadhaar_last_4 || '0000').toString().trim(),
        guardianName: (b.guardianName || b.guardian_name || '').trim(),
        institutionName: (b.institutionName || b.institution_name || '').trim(),
        mobileNumber: (b.mobileNumber || b.mobile_number || '').trim(),
        residentialAddress: (b.residentialAddress || b.residential_address || '').trim(),
        district: (b.district || 'Hyderabad').trim(),
        events: selectedEvents,
        category: b.category || 'Junior',
        status: 'Submitted'
      };

      if (req.files) {
        if (req.files.passport_photo?.[0]?.filename) {
          athletePayload.photoPath = `/uploads/${req.files.passport_photo[0].filename}`;
        }
        if (req.files.dob_certificate?.[0]?.filename) {
          athletePayload.dobProofPath = `/uploads/${req.files.dob_certificate[0].filename}`;
        }
      }

      // Generate chest number directly
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

      res.redirect('/dashboard.html');
    } catch (err) {
      console.error('Nomination Error:', err);
      res.status(500).json({ error: 'Failed to nominate athlete', details: err.message });
    }
  }
);
// 5. PATCH /portal/athletes/:id/status (Verify / Clarify Status)
router.patch('/:id/status', async (req, res) => {
  try {
    const { status, remarks } = req.body;
    const updated = await Athlete.findByIdAndUpdate(
      req.params.id,
      { status, remarks },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Athlete not found' });
    res.json(updated);
  } catch (err) {
    console.error('Status Update Error:', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

module.exports = router;