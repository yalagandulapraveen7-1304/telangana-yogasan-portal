/**
 * File Upload Middleware
 * Enforces dual MIME-type and extension whitelisting, random filename generation, and strict file size limits.
 * Pairs with services/imageService.js for automatic WebP conversion and deep magic-byte inspection.
 */

'use strict';

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { getStorageDir } = require('../services/storage');
const { convertUploadedImages } = require('../services/imageService');

const storageDir = getStorageDir();

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/tiff',
  'image/avif',
  'image/pjpeg',
  'image/x-png',
  'application/pdf',
  'application/octet-stream'
]);

const ALLOWED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.jfif',
  '.png',
  '.webp',
  '.gif',
  '.svg',
  '.tif',
  '.tiff',
  '.avif',
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
    const err = new Error('Invalid file extension. Only supported image formats (JPEG, PNG, GIF, WebP, SVG, TIFF, AVIF) and PDF files are allowed.');
    err.code = 'INVALID_FILE_TYPE';
    return cb(err, false);
  }

  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    const err = new Error('Invalid file MIME type. Only supported image formats and PDF files are allowed.');
    err.code = 'INVALID_FILE_TYPE';
    return cb(err, false);
  }

  return cb(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: 7 * 1024 * 1024, // 7MB strict limit
    files: 60 // Max 60 files per request (for bulk delegation)
  },
  fileFilter
});

module.exports = upload;
module.exports.upload = upload;
module.exports.uploadDir = storageDir;
module.exports.ALLOWED_EXTENSIONS = ALLOWED_EXTENSIONS;
module.exports.ALLOWED_MIME_TYPES = ALLOWED_MIME_TYPES;
module.exports.convertUploadedImages = convertUploadedImages;
