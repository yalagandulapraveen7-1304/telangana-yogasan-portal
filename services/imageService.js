/**
 * Image Processing Service
 * Converts all supported uploaded images to WebP format before storage.
 * - Enforces content/magic-byte inspection (does not trust client MIME type or extension)
 * - Auto-corrects EXIF orientation (.rotate())
 * - Preserves aspect ratio and original dimensions
 * - Preserves transparency (alpha channel)
 * - Preserves animation for multi-frame animated inputs (e.g. GIF, animated WebP)
 * - Defends against XXE, external entities/URLs, and scripts for SVG inputs
 * - Configurable quality via WEBP_QUALITY env var (default: 80)
 * - Cleans up temporary/partial files on validation or conversion failure
 */

'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { getStorageDir } = require('./storage');

// Configurable WebP quality: integer 1-100, default 80
function getWebpQuality() {
  const envQuality = parseInt(process.env.WEBP_QUALITY, 10);
  if (!Number.isNaN(envQuality) && envQuality >= 1 && envQuality <= 100) {
    return envQuality;
  }
  return 80;
}

// Max pixel dimensions (prevents decompression bomb / memory exhaustion DoS)
const MAX_DIMENSION = 8192;

/**
 * Inspects buffer magic bytes and initial content to detect file format.
 * Never trusts filenames or client-supplied MIME headers.
 *
 * @param {Buffer} buffer - File buffer (at least first 1024 bytes)
 * @returns {string|null} Detected format: 'jpeg', 'png', 'gif', 'webp', 'tiff', 'avif', 'svg', 'pdf', or null
 */
function detectFormat(buffer) {
  if (!buffer || buffer.length < 4) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
    buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A
  ) {
    return 'png';
  }

  // GIF: GIF87a or GIF89a
  if (buffer.length >= 6) {
    const gifHeader = buffer.subarray(0, 6).toString('ascii');
    if (gifHeader === 'GIF87a' || gifHeader === 'GIF89a') {
      return 'gif';
    }
  }

  // WebP: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }

  // TIFF: II*\0 (little-endian) or MM\0* (big-endian)
  if (buffer.length >= 4) {
    if (
      (buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2A && buffer[3] === 0x00) ||
      (buffer[0] === 0x4D && buffer[1] === 0x4D && buffer[2] === 0x00 && buffer[3] === 0x2A)
    ) {
      return 'tiff';
    }
  }

  // AVIF / HEIF: ....ftypavif / ftypavis / ftypmif1 / ftypheic
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii');
    if (['avif', 'avis', 'mif1', 'msf1', 'heic', 'heix', 'hevc'].includes(brand)) {
      return 'avif';
    }
  }

  // PDF: %PDF-
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
    return 'pdf';
  }

  // SVG: XML text containing <svg root element
  let textSample = buffer.subarray(0, Math.min(buffer.length, 4096)).toString('utf8');
  // Strip BOM if present
  if (textSample.charCodeAt(0) === 0xFEFF) {
    textSample = textSample.slice(1);
  }
  const trimmed = textSample.trimStart().toLowerCase();
  if (
    trimmed.startsWith('<svg') ||
    (trimmed.startsWith('<?xml') && trimmed.includes('<svg')) ||
    (trimmed.startsWith('<!doctype') && trimmed.includes('<svg')) ||
    (trimmed.startsWith('<!--') && trimmed.includes('<svg'))
  ) {
    return 'svg';
  }

  return null;
}

/**
 * Validates SVG content to prevent XXE, SSRF, script injection, and embedded object attacks.
 * Throws an error if any dangerous construct is found.
 *
 * @param {Buffer|string} content - SVG file content
 */
function validateSvgSecurity(content) {
  const text = (Buffer.isBuffer(content) ? content.toString('utf8') : String(content)).toLowerCase();

  // 1. Defend against XXE and external entity resolution
  if (
    text.includes('<!entity') ||
    (text.includes('system') && text.includes('<!doctype')) ||
    (text.includes('public') && text.includes('<!doctype'))
  ) {
    throw new Error('SVG contains forbidden entity or external DTD declaration.');
  }

  // 2. Defend against executable scripts
  if (/<script\b/i.test(text)) {
    throw new Error('SVG contains executable script elements.');
  }

  // 3. Defend against inline event handlers (onload, onerror, onclick, etc.)
  if (/\bon[a-z]+\s*=/i.test(text)) {
    throw new Error('SVG contains inline event handlers.');
  }

  // 4. Defend against external URLs and dangerous schemes (SSRF, data exfiltration, javascript pseudo-protocol)
  if (/\b(?:href|xlink:href|src)\s*=\s*['"]?(?:https?:|\/\/|javascript:|data:)/i.test(text)) {
    throw new Error('SVG contains external references or disallowed URI schemes.');
  }

  // 5. Defend against embedded HTML or foreign objects
  if (/<(?:foreignobject|iframe|embed|object|applet)\b/i.test(text)) {
    throw new Error('SVG contains forbidden embedded object elements.');
  }
}

/**
 * Converts an image file on disk to WebP format.
 * - Detects format by content (magic bytes)
 * - Validates SVG safety
 * - Reads with { animated: true } to preserve multi-frame animations
 * - Auto-rotates via EXIF metadata
 * - Retains transparency and aspect ratio
 * - Removes original file upon successful conversion
 * - Cleans up any partial or temporary files on failure
 *
 * @param {string} sourcePath - Absolute path to the source image
 * @returns {Promise<{ newPath: string, newFilename: string, mimetype: string, size: number, isAnimated: boolean }>}
 */
async function convertImageToWebp(sourcePath) {
  if (!fs.existsSync(sourcePath)) {
    throw new Error('Uploaded file does not exist on disk.');
  }

  const storageDir = path.dirname(sourcePath);
  const parsed = path.parse(sourcePath);
  const targetFilename = `${parsed.name}.webp`;
  const targetPath = path.join(storageDir, targetFilename);

  // If source already has the exact target name, write to a temporary file first
  const tempTargetPath = (targetPath === sourcePath)
    ? path.join(storageDir, `${parsed.name}_conv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.webp`)
    : targetPath;

  try {
    // Read buffer into memory to prevent OS file locks on Windows
    const fileBuffer = fs.readFileSync(sourcePath);

    const detectedFormat = detectFormat(fileBuffer);
    if (!detectedFormat) {
      throw new Error('Unsupported or unrecognized image format.');
    }

    if (detectedFormat === 'pdf') {
      throw new Error('PDF documents cannot be converted to WebP image.');
    }

    // For SVG files, perform strict security checks before decoding
    if (detectedFormat === 'svg') {
      validateSvgSecurity(fileBuffer);
    }

    const quality = getWebpQuality();

    // 1. Inspect image metadata using Sharp with animated support
    const imagePipeline = sharp(fileBuffer, { animated: true });
    const metadata = await imagePipeline.metadata();

    if (!metadata || !metadata.format) {
      throw new Error('Image could not be decoded by the image processing library.');
    }

    // 2. Validate pixel dimensions to prevent memory exhaustion / DoS
    const width = metadata.width || 0;
    const height = metadata.pageHeight || metadata.height || 0;
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      throw new Error(`Image dimensions (${width}x${height}) exceed maximum allowed limit of ${MAX_DIMENSION}x${MAX_DIMENSION} pixels.`);
    }

    const isAnimated = Boolean(metadata.pages && metadata.pages > 1);

    // 3. Process image: auto-rotate via EXIF orientation, convert to WebP preserving animation & alpha
    await sharp(fileBuffer, { animated: true })
      .rotate() // Auto-rotates using EXIF orientation tag and resets orientation
      .webp({
        quality,
        effort: 4
      })
      .toFile(tempTargetPath);

    // 4. Finalize files on disk
    if (tempTargetPath !== targetPath) {
      if (fs.existsSync(sourcePath)) {
        try { fs.unlinkSync(sourcePath); } catch (_) {}
      }
      fs.renameSync(tempTargetPath, targetPath);
    } else if (sourcePath !== targetPath && fs.existsSync(sourcePath)) {
      try { fs.unlinkSync(sourcePath); } catch (_) {}
    }

    const stat = fs.statSync(targetPath);

    return {
      newPath: targetPath,
      newFilename: targetFilename,
      mimetype: 'image/webp',
      size: stat.size,
      isAnimated
    };
  } catch (err) {
    // Clean up partial temp target file
    if (tempTargetPath && fs.existsSync(tempTargetPath)) {
      try { fs.unlinkSync(tempTargetPath); } catch (_) {}
    }
    // Clean up source file
    if (sourcePath && fs.existsSync(sourcePath)) {
      try { fs.unlinkSync(sourcePath); } catch (_) {}
    }
    throw err;
  }
}

/**
 * Cleans up all files in req.file and req.files from disk.
 *
 * @param {Object} req - Express request object
 */
function cleanupUploadedFiles(req) {
  const filesToDelete = [];

  if (req.file?.path) {
    filesToDelete.push(req.file.path);
  }

  if (req.files) {
    if (Array.isArray(req.files)) {
      req.files.forEach((f) => {
        if (f.path) filesToDelete.push(f.path);
      });
    } else if (typeof req.files === 'object') {
      Object.values(req.files).forEach((group) => {
        if (Array.isArray(group)) {
          group.forEach((f) => {
            if (f.path) filesToDelete.push(f.path);
          });
        }
      });
    }
  }

  filesToDelete.forEach((filePath) => {
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (_) {}
    }
  });
}

/**
 * Express middleware to process and convert uploaded files to WebP.
 * Can be used directly: `convertUploadedImages`
 * Or as a factory with options: `convertUploadedImages({ allowPdf: true })`
 *
 * Options:
 * - allowPdf: boolean (default: false). If true, PDF files are accepted and kept as PDF.
 * - allowPdfFields: string[] or RegExp[] - field names that permit PDF documents.
 * - imageOnlyFields: string[] or RegExp[] - field names strictly requiring images.
 */
function convertUploadedImages(optionsOrReq, res, next) {
  // If invoked as standard middleware `(req, res, next)`
  if (optionsOrReq && optionsOrReq.method && optionsOrReq.headers) {
    const req = optionsOrReq;
    return executeConversion(req, res, next, {});
  }

  // If invoked as factory `convertUploadedImages(options)`
  const options = optionsOrReq || {};
  return (req, res, next) => {
    return executeConversion(req, res, next, options);
  };
}

/**
 * Internal handler executing the conversion on req.file and req.files.
 */
async function executeConversion(req, res, next, options) {
  const { allowPdf = false, allowPdfFields = [], imageOnlyFields = [] } = options;

  function fieldAllowsPdf(fieldName) {
    if (!fieldName) return allowPdf;
    if (imageOnlyFields.some((f) => (f instanceof RegExp ? f.test(fieldName) : f === fieldName))) {
      return false;
    }
    if (allowPdfFields.some((f) => (f instanceof RegExp ? f.test(fieldName) : f === fieldName))) {
      return true;
    }
    return allowPdf;
  }

  // Collect all files from req.file and req.files
  const filesToProcess = [];

  if (req.file) {
    filesToProcess.push({ file: req.file, fieldName: req.file.fieldname });
  }

  if (req.files) {
    if (Array.isArray(req.files)) {
      req.files.forEach((file) => {
        filesToProcess.push({ file, fieldName: file.fieldname });
      });
    } else if (typeof req.files === 'object') {
      Object.entries(req.files).forEach(([fieldName, group]) => {
        if (Array.isArray(group)) {
          group.forEach((file) => {
            filesToProcess.push({ file, fieldName });
          });
        }
      });
    }
  }

  if (filesToProcess.length === 0) {
    return next();
  }

  try {
    for (const item of filesToProcess) {
      const { file, fieldName } = item;
      const permitsPdf = fieldAllowsPdf(fieldName);

      // Verify file existence
      if (!file.path || !fs.existsSync(file.path)) {
        continue;
      }

      // Read header to check format
      const fd = fs.openSync(file.path, 'r');
      const fileSize = fs.fstatSync(fd).size;
      const headerBuf = Buffer.alloc(Math.min(1024, fileSize));
      fs.readSync(fd, headerBuf, 0, headerBuf.length, 0);
      fs.closeSync(fd);

      const detected = detectFormat(headerBuf);

      if (!detected) {
        throw new Error(`File '${file.originalname || file.filename}' is not a valid or supported image.`);
      }

      // If PDF document
      if (detected === 'pdf') {
        if (!permitsPdf) {
          throw new Error(`Only image files are permitted for '${fieldName || 'upload'}'. PDF documents are not allowed.`);
        }
        // Valid PDF: keep as PDF without converting to WebP
        file.mimetype = 'application/pdf';
        continue;
      }

      // File is an image: convert to WebP
      const conversionResult = await convertImageToWebp(file.path);

      // Update multer file object metadata in place
      file.filename = conversionResult.newFilename;
      file.path = conversionResult.newPath;
      file.mimetype = 'image/webp';
      file.size = conversionResult.size;
    }

    return next();
  } catch (err) {
    // Clean up all temporary files on error
    cleanupUploadedFiles(req);
    req.file = null;
    req.files = null;

    return res.status(400).json({
      success: false,
      error: err.message || 'Image processing and WebP conversion failed.'
    });
  }
}

module.exports = {
  detectFormat,
  validateSvgSecurity,
  getWebpQuality,
  convertImageToWebp,
  cleanupUploadedFiles,
  convertUploadedImages
};
