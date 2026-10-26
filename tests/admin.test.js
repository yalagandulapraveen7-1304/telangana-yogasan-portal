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

function createPhotoMultipart(fields, filename = 'test-image.png') {
  const pngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAFklEQVQYlWP4z8DwnxjMMKrwP12DBwCSw8c5bHZncwAAAABJRU5ErkJggg==',
    'base64'
  );
  const boundary = `----WebKitFormBoundary${Date.now()}${Math.random().toString(36).slice(2)}`;
  let body = '';
  for (const [key, value] of Object.entries(fields)) {
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`;
  }
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="photo"; filename="${filename}"\r\n`;
  body += `Content-Type: image/png\r\n\r\n`;

  const payload = Buffer.concat([
    Buffer.from(body, 'utf-8'),
    pngBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8')
  ]);

  return { boundary, payload };
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
      'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAFklEQVQYlWP4z8DwnxjMMKrwP12DBwCSw8c5bHZncwAAAABJRU5ErkJggg==',
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
    assert.strictEqual(res.headers.get('content-type'), 'image/webp');
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

  test('POST /portal/admin/notices rejects malicious and injection linkUrl payloads', async () => {
    const maliciousUrls = [
      'javascript:alert(1)',
      'JAVASCRIPT:alert(document.cookie)',
      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
      '//evil.com/phish',
      '/\\evil.com',
      '\\\\evil.com',
      'https://evil.com" onmouseover="alert(1)',
      "https://evil.com' onfocus='alert(1)'",
      'https://evil.com<script>alert(1)</script>',
      '/activities" onfocus="alert(1)',
      'http://insecure-site.com/notice',
      '/path/../secret'
    ];

    for (const badUrl of maliciousUrls) {
      const res = await fetch(`${baseUrl}/portal/admin/notices`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'Malicious Notice Attempt',
          category: 'NOTICE',
          linkUrl: badUrl
        })
      });

      assert.strictEqual(res.status, 400, `Expected 400 Bad Request for malicious linkUrl: ${badUrl}`);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('linkUrl'));
    }
  });

  test('POST /portal/admin/notices accepts safe HTTPS and same-site relative linkUrl', async () => {
    // 1. Safe HTTPS external link
    const resHttps = await fetch(`${baseUrl}/portal/admin/notices`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'Safe HTTPS Notice Link',
        category: 'CIRCULAR',
        linkUrl: 'https://telanganayoga.org.in/rules-2026.pdf',
        linkLabel: 'Official Rules PDF'
      })
    });
    assert.strictEqual(resHttps.status, 201);
    const dataHttps = await resHttps.json();
    assert.strictEqual(dataHttps.success, true);
    assert.strictEqual(dataHttps.notice.linkUrl, 'https://telanganayoga.org.in/rules-2026.pdf');
    await Notice.findByIdAndDelete(dataHttps.notice._id);

    // 2. Safe same-site relative path
    const resRel = await fetch(`${baseUrl}/portal/admin/notices`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'Safe Relative Notice Link',
        category: 'EVENT_NOTICE',
        linkUrl: '/activities#schedule',
        linkLabel: 'Event Activities'
      })
    });
    assert.strictEqual(resRel.status, 201);
    const dataRel = await resRel.json();
    assert.strictEqual(dataRel.success, true);
    assert.strictEqual(dataRel.notice.linkUrl, '/activities#schedule');
    await Notice.findByIdAndDelete(dataRel.notice._id);
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

  test('PATCH /portal/admin/notices/:id validates linkUrl updates strictly', async () => {
    // 1. Rejects malicious update
    const resBad = await fetch(`${baseUrl}/portal/admin/notices/${createdNoticeId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        linkUrl: 'javascript:alert(document.cookie)'
      })
    });
    assert.strictEqual(resBad.status, 400);
    const badData = await resBad.json();
    assert.strictEqual(badData.success, false);

    // 2. Accepts safe HTTPS update
    const resGood = await fetch(`${baseUrl}/portal/admin/notices/${createdNoticeId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        linkUrl: 'https://telanganayoga.org.in/updated-notice',
        linkLabel: 'Updated Notice'
      })
    });
    assert.strictEqual(resGood.status, 200);
    const goodData = await resGood.json();
    assert.strictEqual(goodData.notice.linkUrl, 'https://telanganayoga.org.in/updated-notice');

    // 3. Allows clearing linkUrl with empty string
    const resClear = await fetch(`${baseUrl}/portal/admin/notices/${createdNoticeId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        linkUrl: ''
      })
    });
    assert.strictEqual(resClear.status, 200);
    const clearData = await resClear.json();
    assert.strictEqual(clearData.notice.linkUrl, '');
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

describe('5. District Secretary Scoping & Authorization Boundaries (Photos & Notices)', () => {
  describe('Photo Authorization Boundaries', () => {
    test('POST /portal/admin/photos blocks Secretary from creating state-wide ALL or other-district photo', async () => {
      // Secretary (Hyderabad) attempting district: ALL
      const { boundary: bAll, payload: pAll } = createPhotoMultipart({
        title: 'Hyd Sec ALL Photo',
        district: 'ALL'
      });
      const resAll = await fetch(`${baseUrl}/portal/admin/photos`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hydSecretaryToken}`,
          'Content-Type': `multipart/form-data; boundary=${bAll}`
        },
        body: pAll
      });
      assert.strictEqual(resAll.status, 403, 'Secretary must not be allowed to create state-wide ALL photo');

      // Secretary (Hyderabad) attempting district: Warangal
      const { boundary: bWgl, payload: pWgl } = createPhotoMultipart({
        title: 'Hyd Sec Warangal Photo',
        district: 'Warangal'
      });
      const resWgl = await fetch(`${baseUrl}/portal/admin/photos`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hydSecretaryToken}`,
          'Content-Type': `multipart/form-data; boundary=${bWgl}`
        },
        body: pWgl
      });
      assert.strictEqual(resWgl.status, 403, 'Secretary must not be allowed to create other-district photo');
    });

    test('POST /portal/admin/photos allows Secretary for own district and Super Admin for ALL', async () => {
      // Secretary (Hyderabad) creating photo for own district
      const { boundary: bHyd, payload: pHyd } = createPhotoMultipart({
        title: 'Hyd Sec Own District Photo',
        district: 'Hyderabad'
      });
      const resHyd = await fetch(`${baseUrl}/portal/admin/photos`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hydSecretaryToken}`,
          'Content-Type': `multipart/form-data; boundary=${bHyd}`
        },
        body: pHyd
      });
      assert.strictEqual(resHyd.status, 201);
      const dataHyd = await resHyd.json();
      assert.strictEqual(dataHyd.success, true);
      assert.strictEqual(dataHyd.photo.district, 'Hyderabad');
      await Photo.findByIdAndDelete(dataHyd.photo._id);

      // Super Admin creating state-wide ALL photo
      const { boundary: bAdmin, payload: pAdmin } = createPhotoMultipart({
        title: 'Super Admin State-wide Photo',
        district: 'ALL'
      });
      const resAdmin = await fetch(`${baseUrl}/portal/admin/photos`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
          'Content-Type': `multipart/form-data; boundary=${bAdmin}`
        },
        body: pAdmin
      });
      assert.strictEqual(resAdmin.status, 201);
      const dataAdmin = await resAdmin.json();
      assert.strictEqual(dataAdmin.success, true);
      assert.strictEqual(dataAdmin.photo.district, 'ALL');
      await Photo.findByIdAndDelete(dataAdmin.photo._id);
    });

    test('PATCH /portal/admin/photos/:id blocks Secretary from modifying ALL or other-district photos', async () => {
      const photoAll = await Photo.create({
        title: 'State-wide Photo',
        filePath: '/portal/photos/raw/state.png',
        competitionId: 'state-championship-2026',
        district: 'ALL'
      });
      const photoWgl = await Photo.create({
        title: 'Warangal Photo',
        filePath: '/portal/photos/raw/wgl.png',
        competitionId: 'state-championship-2026',
        district: 'Warangal'
      });
      const photoHyd = await Photo.create({
        title: 'Hyderabad Photo',
        filePath: '/portal/photos/raw/hyd.png',
        competitionId: 'state-championship-2026',
        district: 'Hyderabad'
      });

      try {
        // Secretary (Hyderabad) cannot edit ALL photo
        const res1 = await fetch(`${baseUrl}/portal/admin/photos/${photoAll._id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${hydSecretaryToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ title: 'Tampered State Photo' })
        });
        assert.strictEqual(res1.status, 403, 'Secretary must not modify ALL photo');

        // Secretary (Hyderabad) cannot edit Warangal photo
        const res2 = await fetch(`${baseUrl}/portal/admin/photos/${photoWgl._id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${hydSecretaryToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ title: 'Tampered Warangal Photo' })
        });
        assert.strictEqual(res2.status, 403, 'Secretary must not modify other-district photo');

        // Secretary (Hyderabad) cannot reassign own photo to ALL or Warangal
        const resReassignAll = await fetch(`${baseUrl}/portal/admin/photos/${photoHyd._id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${hydSecretaryToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ district: 'ALL' })
        });
        assert.strictEqual(resReassignAll.status, 403, 'Secretary must not reassign photo to ALL');

        const resReassignWgl = await fetch(`${baseUrl}/portal/admin/photos/${photoHyd._id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${hydSecretaryToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ district: 'Warangal' })
        });
        assert.strictEqual(resReassignWgl.status, 403, 'Secretary must not reassign photo to other district');

        // Secretary (Hyderabad) can update own district photo
        const resHydOk = await fetch(`${baseUrl}/portal/admin/photos/${photoHyd._id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${hydSecretaryToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ title: 'Updated Hyderabad Photo' })
        });
        assert.strictEqual(resHydOk.status, 200);
        const dataHydOk = await resHydOk.json();
        assert.strictEqual(dataHydOk.photo.title, 'Updated Hyderabad Photo');

        // Super Admin can update ALL photo
        const resAdminAll = await fetch(`${baseUrl}/portal/admin/photos/${photoAll._id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${superAdminToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ title: 'Admin Updated ALL Photo' })
        });
        assert.strictEqual(resAdminAll.status, 200);

        // Super Admin can update Warangal photo
        const resAdminWgl = await fetch(`${baseUrl}/portal/admin/photos/${photoWgl._id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${superAdminToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ title: 'Admin Updated Warangal Photo' })
        });
        assert.strictEqual(resAdminWgl.status, 200);
      } finally {
        await Photo.findByIdAndDelete(photoAll._id);
        await Photo.findByIdAndDelete(photoWgl._id);
        await Photo.findByIdAndDelete(photoHyd._id);
      }
    });

    test('DELETE /portal/admin/photos/:id blocks Secretary from deleting ALL or other-district photos', async () => {
      const photoAll = await Photo.create({
        title: 'State Photo For Deletion Test',
        filePath: '/portal/photos/raw/state-del.png',
        competitionId: 'state-championship-2026',
        district: 'ALL'
      });
      const photoWgl = await Photo.create({
        title: 'Warangal Photo For Deletion Test',
        filePath: '/portal/photos/raw/wgl-del.png',
        competitionId: 'state-championship-2026',
        district: 'Warangal'
      });
      const photoHyd = await Photo.create({
        title: 'Hyderabad Photo For Deletion Test',
        filePath: '/portal/photos/raw/hyd-del.png',
        competitionId: 'state-championship-2026',
        district: 'Hyderabad'
      });

      try {
        // Secretary (Hyderabad) cannot delete ALL photo
        const resDelAll = await fetch(`${baseUrl}/portal/admin/photos/${photoAll._id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${hydSecretaryToken}` }
        });
        assert.strictEqual(resDelAll.status, 403, 'Secretary must not delete ALL photo');
        const checkAll = await Photo.findById(photoAll._id);
        assert.ok(checkAll, 'ALL photo must still exist');

        // Secretary (Hyderabad) cannot delete Warangal photo
        const resDelWgl = await fetch(`${baseUrl}/portal/admin/photos/${photoWgl._id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${hydSecretaryToken}` }
        });
        assert.strictEqual(resDelWgl.status, 403, 'Secretary must not delete other-district photo');
        const checkWgl = await Photo.findById(photoWgl._id);
        assert.ok(checkWgl, 'Warangal photo must still exist');

        // Secretary (Hyderabad) can delete own district photo
        const resDelHyd = await fetch(`${baseUrl}/portal/admin/photos/${photoHyd._id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${hydSecretaryToken}` }
        });
        assert.strictEqual(resDelHyd.status, 200);
        const checkHyd = await Photo.findById(photoHyd._id);
        assert.strictEqual(checkHyd, null, 'Hyderabad photo should be deleted');

        // Super Admin can delete ALL photo
        const resAdminDelAll = await fetch(`${baseUrl}/portal/admin/photos/${photoAll._id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${superAdminToken}` }
        });
        assert.strictEqual(resAdminDelAll.status, 200);
        const checkAllAfterAdmin = await Photo.findById(photoAll._id);
        assert.strictEqual(checkAllAfterAdmin, null);

        // Super Admin can delete Warangal photo
        const resAdminDelWgl = await fetch(`${baseUrl}/portal/admin/photos/${photoWgl._id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${superAdminToken}` }
        });
        assert.strictEqual(resAdminDelWgl.status, 200);
        const checkWglAfterAdmin = await Photo.findById(photoWgl._id);
        assert.strictEqual(checkWglAfterAdmin, null);
      } finally {
        await Photo.findByIdAndDelete(photoAll._id);
        await Photo.findByIdAndDelete(photoWgl._id);
        await Photo.findByIdAndDelete(photoHyd._id);
      }
    });
  });

  describe('Notice Authorization Boundaries', () => {
    test('POST /portal/admin/notices blocks Secretary from creating state-wide ALL or other-district notice', async () => {
      // Secretary (Hyderabad) attempting district: ALL
      const resAll = await fetch(`${baseUrl}/portal/admin/notices`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hydSecretaryToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'Hyd Sec ALL Notice',
          district: 'ALL'
        })
      });
      assert.strictEqual(resAll.status, 403, 'Secretary must not create state-wide ALL notice');

      // Secretary (Hyderabad) attempting district: Warangal
      const resWgl = await fetch(`${baseUrl}/portal/admin/notices`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hydSecretaryToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'Hyd Sec Warangal Notice',
          district: 'Warangal'
        })
      });
      assert.strictEqual(resWgl.status, 403, 'Secretary must not create other-district notice');
    });

    test('POST /portal/admin/notices allows Secretary for own district and Super Admin for ALL', async () => {
      // Secretary (Hyderabad) creating notice for own district
      const resHyd = await fetch(`${baseUrl}/portal/admin/notices`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hydSecretaryToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'Hyderabad District Notice',
          district: 'Hyderabad'
        })
      });
      assert.strictEqual(resHyd.status, 201);
      const dataHyd = await resHyd.json();
      assert.strictEqual(dataHyd.success, true);
      assert.strictEqual(dataHyd.notice.district, 'Hyderabad');
      await Notice.findByIdAndDelete(dataHyd.notice._id);

      // Super Admin creating state-wide ALL notice
      const resAdmin = await fetch(`${baseUrl}/portal/admin/notices`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'Super Admin State-wide Notice',
          district: 'ALL'
        })
      });
      assert.strictEqual(resAdmin.status, 201);
      const dataAdmin = await resAdmin.json();
      assert.strictEqual(dataAdmin.success, true);
      assert.strictEqual(dataAdmin.notice.district, 'ALL');
      await Notice.findByIdAndDelete(dataAdmin.notice._id);
    });

    test('PATCH /portal/admin/notices/:id blocks Secretary from modifying ALL or other-district notices', async () => {
      const noticeAll = await Notice.create({
        title: 'State-wide Notice Seed',
        category: 'NOTICE',
        district: 'ALL'
      });
      const noticeWgl = await Notice.create({
        title: 'Warangal Notice Seed',
        category: 'NOTICE',
        district: 'Warangal'
      });
      const noticeHyd = await Notice.create({
        title: 'Hyderabad Notice Seed',
        category: 'NOTICE',
        district: 'Hyderabad'
      });

      try {
        // Secretary (Hyderabad) cannot edit ALL notice
        const res1 = await fetch(`${baseUrl}/portal/admin/notices/${noticeAll._id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${hydSecretaryToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ title: 'Tampered State Notice' })
        });
        assert.strictEqual(res1.status, 403, 'Secretary must not modify ALL notice');

        // Secretary (Hyderabad) cannot edit Warangal notice
        const res2 = await fetch(`${baseUrl}/portal/admin/notices/${noticeWgl._id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${hydSecretaryToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ title: 'Tampered Warangal Notice' })
        });
        assert.strictEqual(res2.status, 403, 'Secretary must not modify other-district notice');

        // Secretary (Hyderabad) cannot reassign own notice to ALL or Warangal
        const resReassignAll = await fetch(`${baseUrl}/portal/admin/notices/${noticeHyd._id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${hydSecretaryToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ district: 'ALL' })
        });
        assert.strictEqual(resReassignAll.status, 403, 'Secretary must not reassign notice to ALL');

        const resReassignWgl = await fetch(`${baseUrl}/portal/admin/notices/${noticeHyd._id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${hydSecretaryToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ district: 'Warangal' })
        });
        assert.strictEqual(resReassignWgl.status, 403, 'Secretary must not reassign notice to other district');

        // Secretary (Hyderabad) can update own district notice
        const resHydOk = await fetch(`${baseUrl}/portal/admin/notices/${noticeHyd._id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${hydSecretaryToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ title: 'Updated Hyderabad Notice Title' })
        });
        assert.strictEqual(resHydOk.status, 200);
        const dataHydOk = await resHydOk.json();
        assert.strictEqual(dataHydOk.notice.title, 'Updated Hyderabad Notice Title');

        // Super Admin can update ALL notice
        const resAdminAll = await fetch(`${baseUrl}/portal/admin/notices/${noticeAll._id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${superAdminToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ title: 'Admin Updated ALL Notice' })
        });
        assert.strictEqual(resAdminAll.status, 200);

        // Super Admin can update Warangal notice
        const resAdminWgl = await fetch(`${baseUrl}/portal/admin/notices/${noticeWgl._id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${superAdminToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ title: 'Admin Updated Warangal Notice' })
        });
        assert.strictEqual(resAdminWgl.status, 200);
      } finally {
        await Notice.findByIdAndDelete(noticeAll._id);
        await Notice.findByIdAndDelete(noticeWgl._id);
        await Notice.findByIdAndDelete(noticeHyd._id);
      }
    });

    test('DELETE /portal/admin/notices/:id blocks Secretary from deleting ALL or other-district notices', async () => {
      const noticeAll = await Notice.create({
        title: 'State Notice Deletion Test',
        category: 'NOTICE',
        district: 'ALL'
      });
      const noticeWgl = await Notice.create({
        title: 'Warangal Notice Deletion Test',
        category: 'NOTICE',
        district: 'Warangal'
      });
      const noticeHyd = await Notice.create({
        title: 'Hyderabad Notice Deletion Test',
        category: 'NOTICE',
        district: 'Hyderabad'
      });

      try {
        // Secretary (Hyderabad) cannot delete ALL notice
        const resDelAll = await fetch(`${baseUrl}/portal/admin/notices/${noticeAll._id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${hydSecretaryToken}` }
        });
        assert.strictEqual(resDelAll.status, 403, 'Secretary must not delete ALL notice');
        const checkAll = await Notice.findById(noticeAll._id);
        assert.ok(checkAll, 'ALL notice must still exist');

        // Secretary (Hyderabad) cannot delete Warangal notice
        const resDelWgl = await fetch(`${baseUrl}/portal/admin/notices/${noticeWgl._id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${hydSecretaryToken}` }
        });
        assert.strictEqual(resDelWgl.status, 403, 'Secretary must not delete other-district notice');
        const checkWgl = await Notice.findById(noticeWgl._id);
        assert.ok(checkWgl, 'Warangal notice must still exist');

        // Secretary (Hyderabad) can delete own district notice
        const resDelHyd = await fetch(`${baseUrl}/portal/admin/notices/${noticeHyd._id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${hydSecretaryToken}` }
        });
        assert.strictEqual(resDelHyd.status, 200);
        const checkHyd = await Notice.findById(noticeHyd._id);
        assert.strictEqual(checkHyd, null, 'Hyderabad notice should be deleted');

        // Super Admin can delete ALL notice
        const resAdminDelAll = await fetch(`${baseUrl}/portal/admin/notices/${noticeAll._id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${superAdminToken}` }
        });
        assert.strictEqual(resAdminDelAll.status, 200);
        const checkAllAfterAdmin = await Notice.findById(noticeAll._id);
        assert.strictEqual(checkAllAfterAdmin, null);

        // Super Admin can delete Warangal notice
        const resAdminDelWgl = await fetch(`${baseUrl}/portal/admin/notices/${noticeWgl._id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${superAdminToken}` }
        });
        assert.strictEqual(resAdminDelWgl.status, 200);
        const checkWglAfterAdmin = await Notice.findById(noticeWgl._id);
        assert.strictEqual(checkWglAfterAdmin, null);
      } finally {
        await Notice.findByIdAndDelete(noticeAll._id);
        await Notice.findByIdAndDelete(noticeWgl._id);
        await Notice.findByIdAndDelete(noticeHyd._id);
      }
    });
  });
});
