/**
 * File Upload Middleware
 * Enforces dual MIME-type and extension whitelisting, random filename generation, and strict file size limits.
 */

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { getStorageDir } = require('../services/storage');

const storageDir = getStorageDir();

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf'
]);

const ALLOWED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.pdf'
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, storageDir);
  },
  filename: (_req, file, cb) => {
    const rawExt = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_EXTENSIONS.has(rawExt) ? rawExt : '.bin';
    const randomName = crypto.randomBytes(16).toString('hex');
    cb(null, `${randomName}${safeExt}`);
  }
});

const fileFilter = (_req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(extension)) {
    const err = new Error('Invalid file extension. Only .jpg, .jpeg, .png, .webp, and .pdf files are allowed.');
    err.code = 'INVALID_FILE_TYPE';
    return cb(err, false);
  }

  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    const err = new Error('Invalid file MIME type. Only JPG, PNG, WEBP, and PDF files are allowed.');
    err.code = 'INVALID_FILE_TYPE';
    return cb(err, false);
  }

  return cb(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB strict limit
    files: 60 // Max 60 files per request (for bulk delegation)
  },
  fileFilter
});

module.exports = upload;
module.exports.uploadDir = storageDir;
module.exports.ALLOWED_EXTENSIONS = ALLOWED_EXTENSIONS;