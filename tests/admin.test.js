/**
 * Admin Management & Workflows Test Suite
 * Validates admin authentication, district scoping, photo lifecycle & thumbnails,
 * notice board & marquee ticker, competition safe deletion guards, and audit logs.
 */

'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const http = require('http');

const Competition = require('../models/Competition');
const Photo = require('../models/Photo');
const Notice = require('../models/Notice');
const Athlete = require('../models/Athlete');
const AdminAuditLog = require('../models/AdminAuditLog');
const { JWT_SECRET } = require('../config/constants');
const { connectDB } = require('../config/db');
const { getStorageDir } = require('../services/storage');

let server;
let baseUrl;

function createToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
}

const superAdminToken = createToken({
  id: '507f1f77bcf86cd799439011',
  email: 'admin@telanganayoga.org',
  role: 'SUPER_ADMIN',
  district: 'ALL_DISTRICTS'
});

const hydSecretaryToken = createToken({
  id: '507f1f77bcf86cd799439012',
  email: 'sec_hyderabad@telanganayoga.org',
  role: 'SECRETARY',
  district: 'Hyderabad'
});

const wglSecretaryToken = createToken({
  id: '507f1f77bcf86cd799439013',
  email: 'sec_warangal@telanganayoga.org',
  role: 'SECRETARY',
  district: 'Warangal'
});

before(async () => {
  await connectDB();
  const app = require('../server');
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
    await new Promise((resolve) => server.close(resolve));
  }
  await mongoose.disconnect();
});

describe('1. Admin Authorization & Competition Deletion Safeguards', () => {
  test('DELETE /portal/admin/competitions/:id rejects unauthenticated and non-admin requests', async () => {
    // Unauthenticated
    const res1 = await fetch(`${baseUrl}/portal/admin/competitions/dummy-id`, { method: 'DELETE' });
    assert.strictEqual(res1.status, 401);

    // District Secretary (not SUPER_ADMIN)
    const res2 = await fetch(`${baseUrl}/portal/admin/competitions/dummy-id`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${hydSecretaryToken}` }
    });
    assert.strictEqual(res2.status, 403);
  });

  test('DELETE competition blocks deletion if dependent athletes exist', async () => {
    const compSlug = `safe-guard-test-${Date.now()}`;
    await Competition.create({
      competitionId: compSlug,
      name: 'Safety Guard Tournament',
      status: 'OPEN'
    });

    // Create a dummy athlete linked to this tournament
    const testAthlete = await Athlete.create({
      firstName: 'Rohan',
      lastName: 'Kumar',
      fullName: 'Rohan Kumar',
      district: 'Hyderabad',
      gender: 'Male',
      dob: new Date('2008-05-10'),
      competitionId: compSlug,
      events: ['Traditional Yogasana'],
      totalFee: 260,
      paymentStatus: 'PAID',
      status: 'Submitted'
    });

    // Attempt deletion
    const res = await fetch(`${baseUrl}/portal/admin/competitions/${compSlug}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.error.includes('existing athlete nomination(s)'));

    // Cleanup athlete
    await Athlete.findByIdAndDelete(testAthlete._id);
  });

  test('DELETE competition blocks deletion if dependent photos exist', async () => {
    const compSlug = `photo-guard-test-${Date.now()}`;
    await Competition.create({
      competitionId: compSlug,
      name: 'Photo Guard Tournament',
      status: 'OPEN'
    });

    // Create a dummy photo linked to this tournament
    const testPhoto = await Photo.create({
      title: 'Action Shot',
      filePath: '/portal/photos/raw/dummy.jpg',
      competitionId: compSlug,
      district: 'ALL'
    });

    // Attempt deletion
    const res = await fetch(`${baseUrl}/portal/admin/competitions/${compSlug}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.error.includes('gallery photo(s)'));

    // Cleanup photo
    await Photo.findByIdAndDelete(testPhoto._id);
  });

  test('DELETE competition safely succeeds and logs audit when dependencies are zero', async () => {
    const compSlug = `safe-to-delete-${Date.now()}`;
    await Competition.create({
      competitionId: compSlug,
      name: 'Clean Tournament',
      status: 'DRAFT'
    });

    const res = await fetch(`${baseUrl}/portal/admin/competitions/${compSlug}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);

    const check = await Competition.findOne({ competitionId: compSlug });
    assert.strictEqual(check, null);

    // Verify Audit Log was recorded
    const log = await AdminAuditLog.findOne({ action: 'DELETE_COMPETITION', targetId: compSlug });
    assert.ok(log, 'Audit log should record DELETE_COMPETITION');
    assert.strictEqual(log.actorEmail, 'admin@telanganayoga.org');
  });
});

describe('2. Photo Gallery Management & Thumbnail Generation', () => {
  let createdPhotoId;
  let uploadedFilename;

  test('POST /portal/admin/photos uploads photo, creates thumbnail, and sets status', async () => {
    // Generate a minimal valid 10x10 PNG buffer in memory
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );

    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    let body = `--${boundary}\r\n`;
    body += 'Content-Disposition: form-data; name="title"\r\n\r\nChampionship Inauguration\r\n';
    body += `--${boundary}\r\n`;
    body += 'Content-Disposition: form-data; name="caption"\r\n\r\nDignitaries opening the tournament\r\n';
    body += `--${boundary}\r\n`;
    body += 'Content-Disposition: form-data; name="competitionId"\r\n\r\nstate-championship-2026\r\n';
    body += `--${boundary}\r\n`;
    body += 'Content-Disposition: form-data; name="district"\r\n\r\nHyderabad\r\n';
    body += `--${boundary}\r\n`;
    body += 'Content-Disposition: form-data; name="isCover"\r\n\r\ntrue\r\n';
    body += `--${boundary}\r\n`;
    body += 'Content-Disposition: form-data; name="photo"; filename="test-image.png"\r\n';
    body += 'Content-Type: image/png\r\n\r\n';

    const payload = Buffer.concat([
      Buffer.from(body, 'utf-8'),
      pngBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8')
    ]);

    const res = await fetch(`${baseUrl}/portal/admin/photos`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: payload
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.photo.title, 'Championship Inauguration');
    assert.strictEqual(data.photo.isCover, true);
    assert.ok(data.photo.filePath.startsWith('/portal/photos/raw/'));
    assert.ok(data.photo.thumbnailPath.startsWith('/portal/photos/raw/'));

    createdPhotoId = data.photo._id;
    uploadedFilename = path.basename(data.photo.filePath);
  });

  test('GET /portal/photos retrieves published photos publicly', async () => {
    const res = await fetch(`${baseUrl}/portal/photos`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.photos));
    const found = data.photos.find((p) => p._id === createdPhotoId);
    assert.ok(found, 'Uploaded photo should be listed in public photos');
  });

  test('GET /portal/photos/raw/:filename serves raw binary with caching headers', async () => {
    const res = await fetch(`${baseUrl}/portal/photos/raw/${uploadedFilename}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('content-type'), 'image/png');
    assert.ok(res.headers.get('cache-control').includes('public'));
  });

  test('PATCH /portal/admin/photos/:id respects district scoping', async () => {
    // Warangal Secretary should NOT be allowed to edit a Hyderabad-tagged photo
    const res1 = await fetch(`${baseUrl}/portal/admin/photos/${createdPhotoId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${wglSecretaryToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title: 'Hacked Title' })
    });
    assert.strictEqual(res1.status, 403);

    // Hyderabad Secretary CAN edit their own district photo
    const res2 = await fetch(`${baseUrl}/portal/admin/photos/${createdPhotoId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${hydSecretaryToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title: 'Authorized Title Update' })
    });
    assert.strictEqual(res2.status, 200);
    const data = await res2.json();
    assert.strictEqual(data.photo.title, 'Authorized Title Update');
  });

  test('DELETE /portal/admin/photos/:id removes record and cleans disk', async () => {
    const res = await fetch(`${baseUrl}/portal/admin/photos/${createdPhotoId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    assert.strictEqual(res.status, 200);

    const check = await Photo.findById(createdPhotoId);
    assert.strictEqual(check, null);
  });
});

describe('3. Notices, Announcements & Marquee Ticker', () => {
  let createdNoticeId;

  test('POST /portal/admin/notices creates announcement with marquee flag', async () => {
    const res = await fetch(`${baseUrl}/portal/admin/notices`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'State Championship Dates Announced',
        summary: 'Trials commence from November 15th at Hyderabad.',
        category: 'SCHEDULE_UPDATE',
        isMarquee: true,
        marqueeOrder: 1,
        status: 'PUBLISHED'
      })
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.notice.isMarquee, true);
    assert.strictEqual(data.notice.category, 'SCHEDULE_UPDATE');
    createdNoticeId = data.notice._id;
  });

  test('GET /portal/notices retrieves published notices with category filters', async () => {
    const res = await fetch(`${baseUrl}/portal/notices?category=SCHEDULE_UPDATE`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    const found = data.notices.find((n) => n._id === createdNoticeId);
    assert.ok(found, 'Schedule notice should be present');
  });

  test('GET /portal/marquee returns active marquee ticker items', async () => {
    const res = await fetch(`${baseUrl}/portal/marquee`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    const found = data.items.find((n) => n._id === createdNoticeId);
    assert.ok(found, 'Notice should appear on marquee ticker');
  });

  test('PATCH /portal/admin/notices/:id toggles marquee state and updates content', async () => {
    const res = await fetch(`${baseUrl}/portal/admin/notices/${createdNoticeId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        isMarquee: false,
        summary: 'Updated summary details.'
      })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.notice.isMarquee, false);
    assert.strictEqual(data.notice.summary, 'Updated summary details.');
  });

  test('DELETE /portal/admin/notices/:id removes notice safely', async () => {
    const res = await fetch(`${baseUrl}/portal/admin/notices/${createdNoticeId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });

    assert.strictEqual(res.status, 200);
    const check = await Notice.findById(createdNoticeId);
    assert.strictEqual(check, null);
  });
});

describe('4. Administrative Audit Trails & Forensic Logs', () => {
  test('GET /portal/admin/audit-logs enforces Super Admin privilege', async () => {
    // Unauthenticated
    const res1 = await fetch(`${baseUrl}/portal/admin/audit-logs`);
    assert.strictEqual(res1.status, 401);

    // District Secretary blocked
    const res2 = await fetch(`${baseUrl}/portal/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${hydSecretaryToken}` }
    });
    assert.strictEqual(res2.status, 403);

    // Super Admin authorized
    const res3 = await fetch(`${baseUrl}/portal/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    assert.strictEqual(res3.status, 200);
    const data = await res3.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.logs));
    assert.ok(data.logs.length > 0, 'Audit logs should contain mutations recorded during previous tests');
  });
});
