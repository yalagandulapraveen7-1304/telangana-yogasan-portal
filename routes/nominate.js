const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Athlete = require('../models/Athlete');
const { requireAuth } = require('./auth');

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// 1. GET /portal/athletes/list (Supports Super Admin bypass & flexible district matching)
// 1. GET /portal/athletes/list (Robust Super Admin bypass & case-insensitive matching)
router.get('/list', requireAuth, async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  try {
    // Normalize role and district to uppercase for safe comparison
    const role = (req.user.role || '').toUpperCase().trim();
    const district = (req.user.district || '').toUpperCase().trim();

    // If Super Admin or All Districts, leave filter empty to return all records
    if (role === 'SUPER_ADMIN' || district === 'ALL_DISTRICTS' || district === 'ALL') {
      filter = {}; 
    } else {
      const userDist = (req.user.district || '').replace(/ district/i, '').trim();
      filter.district = { $regex: new RegExp(`^${userDist}(\\s+District)?$`, 'i') };
    }

    console.log("🔍 Final MongoDB Filter:", filter);
    const athletes = await Athlete.find(filter).sort({ createdAt: -1 });
    console.log(`📦 Successfully retrieved ${athletes.length} athletes from database.`);
    
    res.json(athletes);
  } catch (err) {
    console.error('Fetch Error in /portal/athletes/list:', err);
    res.status(500).json({ error: 'Failed to retrieve athletes' });
  }
});
// 2. POST /portal/athletes/nominate
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
        district: typeof (Array.isArray(b.district) ? b.district[0] : (b.district || req.user?.district || 'Hyderabad')) === 'string'
          ? (Array.isArray(b.district) ? b.district[0] : (b.district || req.user?.district || 'Hyderabad')).trim()
          : 'Hyderabad',
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

// 3. PATCH /portal/athletes/:id/status
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