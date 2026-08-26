const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

// 1. Secure Storage & Renaming Strategy
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads/'); 
  },
  filename: function (req, file, cb) {
    // Generate a random 16-byte hex string for the filename
    const randomName = crypto.randomBytes(16).toString('hex');
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${randomName}${extension}`);
  }
});

// 2. Strict File Filter (Only Images & PDFs)
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, PNG, WEBP, and PDF are allowed.'), false);
  }
};

// 3. Size Limits & Export
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB strict limit
  },
  fileFilter: fileFilter
});

module.exports = upload;