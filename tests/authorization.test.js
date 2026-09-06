/**
 * Automated Authorization & District Isolation Test Suite
 * Tests multi-tenant isolation, IDOR prevention, parameter tampering, and token security.
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const app = require('../server');
const Athlete = require('../models/Athlete');
const { JWT_SECRET } = require('../config/constants');
const { connectDB } = require('../config/db');

let server;
let baseUrl;

// Test Credentials & Tokens
const districtA = 'Hyderabad';
const districtB = 'Warangal';

const tokenDistrictA = jwt.sign(
  { id: 'mock_sec_hyd', email: 'sec_hyd@telanganayoga.org', role: 'SECRETARY', district: districtA },
  JWT_SECRET,
  { expiresIn: '1h', algorithm: 'HS256' }
);

const tokenDistrictB = jwt.sign(
  { id: 'mock_sec_war', email: 'sec_war@telanganayoga.org', role: 'SECRETARY', district: districtB },
  JWT_SECRET,
  { expiresIn: '1h', algorithm: 'HS256' }
);

const tokenSuperAdmin = jwt.sign(
  { id: 'mock_admin', email: 'admin@telanganayoga.org', role: 'SUPER_ADMIN', district: 'ALL_DISTRICTS' },
  JWT_SECRET,
  { expiresIn: '1h', algorithm: 'HS256' }
);

const expiredToken = jwt.sign(
  { id: 'mock_expired', email: 'expired@telanganayoga.org', role: 'SECRETARY', district: districtA },
  JWT_SECRET,
  { expiresIn: '-1s', algorithm: 'HS256' }
);

let testAthleteA = null;
let testAthleteB = null;

before(async () => {
  await connectDB();

  // Create isolated test records in DB for District A and District B
  testAthleteA = await Athlete.create({
    firstName: 'SecTestAthA',
    lastName: 'Runner',
    dob: new Date('2010-05-15'),
    gender: 'Female',
    district: districtA,
    category: 'Junior',
    chestNumber: 'HYD-JR-99',
    status: 'Submitted'
  });

  testAthleteB = await Athlete.create({
    firstName: 'SecTestAthB',
    lastName: 'Runner',
    dob: new Date('2010-06-20'),
    gender: 'Male',
    district: districtB,
    category: 'Junior',
    chestNumber: 'WAR-JR-99',
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
  if (testAthleteA?._id) await Athlete.deleteOne({ _id: testAthleteA._id });
  if (testAthleteB?._id) await Athlete.deleteOne({ _id: testAthleteB._id });

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await mongoose.disconnect();
});

describe('District Secretary Authorization & Isolation', () => {
  // 1. Changing districtId / Modifying request body in nomination
  test('Attack 1 & 5: Secretary A cannot register an athlete for District B via body.district', async () => {
    const formData = new URLSearchParams();
    formData.append('firstName', 'TamperedAthlete');
    formData.append('lastName', 'Test');
    formData.append('dob', '2011-01-01');
    formData.append('district', districtB); // Secretary A attempting to register under District B
    formData.append('districtId', districtB);

    const res = await fetch(`${baseUrl}/portal/athletes/nominate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenDistrictA}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });

    assert.equal(res.status, 201);
    const data = await res.json();

    // Server must force the athlete record to Secretary A's district (Hyderabad)
    assert.equal(data.athlete.district, districtA);
    assert.ok(data.athlete.chestNumber.startsWith('HYD-'));

    // Clean up created record
    if (data.athlete?._id) await Athlete.deleteOne({ _id: data.athlete._id });
  });

  // 2. Changing athleteId / IDOR status modification attack
  test('Attack 2 & 9: Secretary A cannot modify District B athlete status (IDOR attack)', async () => {
    const res = await fetch(`${baseUrl}/portal/athletes/${testAthleteB._id}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tokenDistrictA}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'Verified', remarks: 'Hacked status' })
    });

    // Server must reject unauthorized cross-district modification
    assert.equal(res.status, 404);
    const data = await res.json();
    assert.match(data.error, /unauthorized|not found/i);

    // Verify record was untouched in DB
    const freshRecord = await Athlete.findById(testAthleteB._id);
    assert.equal(freshRecord.status, 'Submitted');
  });

  // 3. Permitted action: Secretary A CAN update District A athlete status
  test('Secretary A can update permitted District A record status', async () => {
    const res = await fetch(`${baseUrl}/portal/athletes/${testAthleteA._id}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tokenDistrictA}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'Verified', remarks: 'Legitimate scrutiny' })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'Verified');

    // Reset back
    await Athlete.updateOne({ _id: testAthleteA._id }, { status: 'Submitted' });
  });

  // 4. Modifying URL parameters / Query tampering in list view
  test('Attack 4: Secretary A cannot access District B records by tampering with query parameters', async () => {
    const res = await fetch(`${baseUrl}/portal/athletes/list?district=${districtB}&districtId=${districtB}&role=SUPER_ADMIN`, {
      headers: { Authorization: `Bearer ${tokenDistrictA}` }
    });

    assert.equal(res.status, 200);
    const athletes = await res.json();

    // Verify all returned athletes belong strictly to District A
    for (const ath of athletes) {
      assert.match(ath.district, /Hyderabad/i);
      assert.doesNotMatch(ath.district, /Warangal/i);
    }
  });

  // 5. Changing registrationId / IDOR access to single athlete record
  test('Attack 3: Secretary A cannot fetch District B athlete details by ID', async () => {
    const res = await fetch(`${baseUrl}/portal/athletes/${testAthleteB._id}`, {
      headers: { Authorization: `Bearer ${tokenDistrictA}` }
    });

    // Must return 404 unauthorized
    assert.equal(res.status, 404);
  });

  test('Secretary A CAN fetch permitted District A athlete details by ID', async () => {
    const res = await fetch(`${baseUrl}/portal/athletes/${testAthleteA._id}`, {
      headers: { Authorization: `Bearer ${tokenDistrictA}` }
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data._id, String(testAthleteA._id));
    assert.equal(data.district, districtA);
  });

  // 6. Direct API access without frontend
  test('Attack 6: Direct API call without frontend enforces same strict district boundaries', async () => {
    const res = await fetch(`${baseUrl}/portal/athletes/list`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokenDistrictB}`,
        Accept: 'application/json'
      }
    });

    assert.equal(res.status, 200);
    const athletes = await res.json();

    for (const ath of athletes) {
      assert.match(ath.district, /Warangal/i);
    }
  });

  // 7. Token tampering / impersonation attack
  test('Attack 7: Tampered token signature is rejected with 401', async () => {
    // Tamper with payload by flipping district to Warangal while keeping old signature
    const parts = tokenDistrictA.split('.');
    const tamperedPayload = Buffer.from(
      JSON.stringify({ id: 'mock_sec_hyd', district: districtB, role: 'SUPER_ADMIN' })
    ).toString('base64url');

    const forgedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    const res = await fetch(`${baseUrl}/portal/athletes/list`, {
      headers: { Authorization: `Bearer ${forgedToken}` }
    });

    assert.equal(res.status, 401);
  });

  // 8. Accessing admin endpoints (Privilege Escalation)
  test('Attack 8: Secretary cannot escalate privileges to access Super Admin audit logs', async () => {
    const res = await fetch(`${baseUrl}/auth/logs`, {
      headers: { Authorization: `Bearer ${tokenDistrictA}` }
    });

    // Must return 403 Forbidden
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.success, false);
  });

  test('Super Admin CAN access audit logs', async () => {
    const res = await fetch(`${baseUrl}/auth/logs`, {
      headers: { Authorization: `Bearer ${tokenSuperAdmin}` }
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data));
  });

  // 9. Using expired / invalid tokens
  test('Attack 10: Expired token is rejected with 401', async () => {
    const res = await fetch(`${baseUrl}/portal/athletes/list`, {
      headers: { Authorization: `Bearer ${expiredToken}` }
    });

    assert.equal(res.status, 401);
    const data = await res.json();
    assert.match(data.error, /expired|invalid/i);
  });

  test('Attack 10: Missing token returns 401 for API endpoints', async () => {
    const res = await fetch(`${baseUrl}/portal/athletes/list`, {
      headers: { Accept: 'application/json' }
    });

    assert.equal(res.status, 401);
    const data = await res.json();
    assert.match(data.error, /Authentication required/i);
  });
});
