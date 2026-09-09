/**
 * Security Tests - Multi-Tenant District Isolation & IDOR/BOLA Defense
 * Tests cross-district data protection, parameter tampering, and privilege escalation prevention.
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const app = require('../../server');
const Athlete = require('../../models/Athlete');
const { JWT_SECRET } = require('../../config/constants');
const { connectDB } = require('../../config/db');
const { getStorageDir } = require('../../services/storage');

let server;
let baseUrl;

const districtA = 'Hyderabad';
const districtB = 'Karimnagar';
const testDocA = 'athleteA_doc.jpg';
const testDocB = 'athleteB_doc.jpg';

const tokenDistrictA = jwt.sign(
  { id: 'sec_hyd_sec', email: 'hyd@example.com', role: 'SECRETARY', district: districtA },
  JWT_SECRET,
  { expiresIn: '1h', algorithm: 'HS256' }
);

const tokenDistrictB = jwt.sign(
  { id: 'sec_kar_sec', email: 'kar@example.com', role: 'SECRETARY', district: districtB },
  JWT_SECRET,
  { expiresIn: '1h', algorithm: 'HS256' }
);

const tokenSuperAdmin = jwt.sign(
  { id: 'admin_master', email: 'super@gov.in', role: 'SUPER_ADMIN', district: 'ALL_DISTRICTS' },
  JWT_SECRET,
  { expiresIn: '1h', algorithm: 'HS256' }
);

let athleteA;
let athleteB;

describe('Security Tests: IDOR & Cross-District Tenant Isolation', () => {

  before(async () => {
    await connectDB();

    // Seed dummy files in storage
    const storageDir = getStorageDir();
    fs.writeFileSync(path.join(storageDir, testDocA), 'athlete-a-image-binary-content');
    fs.writeFileSync(path.join(storageDir, testDocB), 'athlete-b-image-binary-content');

    // Create test athlete in District A (Hyderabad)
    athleteA = await Athlete.create({
      firstName: 'AthleteA',
      lastName: 'Hyd',
      dob: new Date('2010-01-01'),
      gender: 'Female',
      district: districtA,
      category: 'Junior',
      chestNumber: 'HYD-JR-88',
      photoPath: `/uploads/${testDocA}`,
      status: 'Submitted'
    });

    // Create test athlete in District B (Karimnagar)
    athleteB = await Athlete.create({
      firstName: 'AthleteB',
      lastName: 'Kar',
      dob: new Date('2010-02-02'),
      gender: 'Male',
      district: districtB,
      category: 'Junior',
      chestNumber: 'KAR-JR-88',
      photoPath: `/uploads/${testDocB}`,
      status: 'Submitted'
    });

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    const storageDir = getStorageDir();
    try { fs.unlinkSync(path.join(storageDir, testDocA)); } catch {}
    try { fs.unlinkSync(path.join(storageDir, testDocB)); } catch {}

    if (athleteA?._id) await Athlete.deleteOne({ _id: athleteA._id });
    if (athleteB?._id) await Athlete.deleteOne({ _id: athleteB._id });
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.disconnect();
  });

  it('IDOR Read Attack: Secretary A cannot read athlete B details via ID', async () => {
    const res = await fetch(`${baseUrl}/portal/athletes/${athleteB._id}`, {
      headers: { Authorization: `Bearer ${tokenDistrictA}` }
    });

    // Must return 404 (not found or unauthorized for district) to prevent information leakage
    assert.equal(res.status, 404);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.ok(data.error.includes('unauthorized') || data.error.includes('not found'));
  });

  it('IDOR Write Attack: Secretary A cannot update athlete B status', async () => {
    const res = await fetch(`${baseUrl}/portal/athletes/${athleteB._id}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tokenDistrictA}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'Verified' })
    });

    assert.equal(res.status, 404);

    // Verify athlete B in database remained untouched
    const freshB = await Athlete.findById(athleteB._id).lean();
    assert.equal(freshB.status, 'Submitted', 'Status must not have changed');
  });

  it('Query Tampering: Secretary A cannot access District B roster via query param', async () => {
    const res = await fetch(`${baseUrl}/portal/athletes/list?district=${districtB}`, {
      headers: { Authorization: `Bearer ${tokenDistrictA}` }
    });

    assert.equal(res.status, 200);
    const list = await res.json();
    assert.ok(Array.isArray(list));

    // Every returned record must strictly belong to District A
    list.forEach((ath) => {
      assert.equal(ath.district, districtA);
    });
  });

  it('Privilege Escalation: Secretary cannot access Super Admin audit logs', async () => {
    const res = await fetch(`${baseUrl}/auth/logs`, {
      headers: { Authorization: `Bearer ${tokenDistrictA}` }
    });

    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.ok(data.error.includes('Forbidden') || data.error.includes('Insufficient'));
  });

  it('Super Admin CAN access audit logs and query any district', async () => {
    const res = await fetch(`${baseUrl}/auth/logs`, {
      headers: { Authorization: `Bearer ${tokenSuperAdmin}` }
    });

    assert.equal(res.status, 200);
    const logs = await res.json();
    assert.ok(Array.isArray(logs));
  });

  describe('Document Upload Authorization (/uploads/:filename)', () => {
    it('Unauthenticated requests to /uploads/:filename are rejected (401)', async () => {
      const res = await fetch(`${baseUrl}/uploads/${testDocA}`);
      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.ok(data.error.toLowerCase().includes('authentication required'));
    });

    it('A Secretary from District A cannot access a document belonging to an athlete in District B (403)', async () => {
      const res = await fetch(`${baseUrl}/uploads/${testDocB}`, {
        headers: { Authorization: `Bearer ${tokenDistrictA}` }
      });
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.ok(data.message.toLowerCase().includes('forbidden') || data.message.toLowerCase().includes('privilege'));
    });

    it('A Secretary from District A CAN access their own district\'s documents (200 with private no-store)', async () => {
      const res = await fetch(`${baseUrl}/uploads/${testDocA}`, {
        headers: { Authorization: `Bearer ${tokenDistrictA}` }
      });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('cache-control'), 'private, no-store');
      const text = await res.text();
      assert.equal(text, 'athlete-a-image-binary-content');
    });

    it('Super Admin CAN access documents from any district (200 with private no-store)', async () => {
      const res = await fetch(`${baseUrl}/uploads/${testDocB}`, {
        headers: { Authorization: `Bearer ${tokenSuperAdmin}` }
      });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('cache-control'), 'private, no-store');
      const text = await res.text();
      assert.equal(text, 'athlete-b-image-binary-content');
    });
  });
});
