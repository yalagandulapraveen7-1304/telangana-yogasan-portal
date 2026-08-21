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

// 2. Multer Instance
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
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

// 3. GET /list (This populates your Dashboard!)
router.get('/list', async (req, res) => {
  try {
    const athletes = await Athlete.find().sort({ createdAt: -1 });
    res.json(athletes);
  } catch (err) {
    console.error('Fetch Error:', err);
    res.status(500).json({ error: 'Failed to retrieve athletes' });
  }
});

router.post(
  '/nominate',
  upload.fields([
    { name: 'passport_photo', maxCount: 1 },
    { name: 'dob_certificate', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const b = req.body;

      // Clean and flatten the events array
      let selectedEvents = [];
      const rawEvents = b['events[]'] || b.events;
      if (Array.isArray(rawEvents)) {
        selectedEvents = rawEvents.flat();
      } else if (typeof rawEvents === 'string' && rawEvents.trim()) {
        selectedEvents = [rawEvents.trim()];
      } else {
        selectedEvents = ['Traditional Yogasana'];
      }

      // Map incoming fields to Mongoose schema attributes
      const athletePayload = {
        firstName: b.firstName || b.first_name,
        lastName: b.lastName || b.last_name,
        dob: b.dob,
        gender: b.gender,
        aadhaarLast4: b.aadhaarLast4 || b.aadhaar_last_4,
        guardianName: b.guardianName || b.guardian_name,
        institutionName: b.institutionName || b.institution_name,
        mobileNumber: b.mobileNumber || b.mobile_number,
        residentialAddress: b.residentialAddress || b.residential_address,
        district: b.district || 'Hyderabad',
        events: selectedEvents,
        category: b.category || 'Junior',
        status: 'Submitted'
      };

      // Extract uploaded file paths
      if (req.files) {
        if (req.files.passport_photo && req.files.passport_photo[0]) {
          athletePayload.photoPath = `/uploads/${req.files.passport_photo[0].filename}`;
        }
        if (req.files.dob_certificate && req.files.dob_certificate[0]) {
          athletePayload.dobProofPath = `/uploads/${req.files.dob_certificate[0].filename}`;
        }
      }

      const newAthlete = new Athlete(athletePayload);
      await newAthlete.save();

      res.redirect('/dashboard.html');
    } catch (err) {
      console.error('Detailed Nomination Error:', err);
      res.status(500).json({ error: 'Failed to nominate athlete', details: err.message });
    }
  }
);;

// 5. PATCH /status (This handles the Verify/Clarification modal)
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