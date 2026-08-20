const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Athlete = require('../models/Athlete');

// Ensure upload directories exist
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'passport_photo' && !file.mimetype.startsWith('image/')) {
      return cb(new Error('Passport photo must be an image file.'));
    }
    if (file.fieldname === 'dob_certificate' && !['image/jpeg', 'image/png', 'application/pdf'].includes(file.mimetype)) {
      return cb(new Error('DOB certificate must be a PDF or image.'));
    }
    cb(null, true);
  }
});

router.post(
  '/add',
  upload.fields([
    { name: 'passport_photo', maxCount: 1 },
    { name: 'dob_certificate', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const {
        first_name,
        last_name,
        dob,
        gender,
        aadhaar_last_4,
        guardian_name,
        institution_name,
        mobile_number,
        residential_address,
        events
      } = req.body;

      // Server-side age calculation (Dec 31 cutoff)
      const birthDate = new Date(dob);
      const cutoffDate = new Date('2025-12-31');
      let age = cutoffDate.getFullYear() - birthDate.getFullYear();
      const m = cutoffDate.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && cutoffDate.getDate() < birthDate.getDate())) age--;

      let computedCategory = '';
      if (age >= 10 && age < 14) computedCategory = 'Sub-Junior';
      else if (age >= 14 && age < 18) computedCategory = 'Junior';
      else if (age >= 18 && age < 28) computedCategory = 'Senior';
      else {
        return res.status(400).send('Athlete age is ineligible (must be 10 to <28 years).');
      }

      const athlete = new Athlete({
        district: 'Hyderabad', // Defaults to current district session
        firstName: first_name,
        lastName: last_name,
        dob: birthDate,
        category: computedCategory,
        gender,
        aadhaarLast4: aadhaar_last_4,
        guardianName: guardian_name,
        institutionName: institution_name,
        mobileNumber: mobile_number,
        residentialAddress: residential_address,
        events: Array.isArray(events) ? events : [events],
        photoPath: req.files['passport_photo'][0].path,
        dobProofPath: req.files['dob_certificate'][0].path
      });

      await athlete.save();
      res.redirect('/dashboard.html?registered=true');
    } catch (err) {
      console.error('Submission Error:', err);
      res.status(500).send('Error registering athlete: ' + err.message);
    }
  }
);
// GET: Fetch all athletes for the dashboard

module.exports = router;
// GET: Fetch list for dashboard (case-insensitive search)
router.get('/list', async (req, res) => {
  try {
    const athletes = await Athlete.find({
      district: { $regex: new RegExp('^hyderabad$', 'i') }
    }).sort({ createdAt: -1 });
    
    res.json(athletes);
  } catch (err) {
    console.error('Fetch Error:', err);
    res.status(500).json({ error: 'Failed to fetch athletes' });
  }
});
router.get('/portal/athletes/list', async (req, res) => {
  try {
    const athletes = await Athlete.find().sort({ createdAt: -1 });
    res.json(athletes);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve athletes' });
  }
});