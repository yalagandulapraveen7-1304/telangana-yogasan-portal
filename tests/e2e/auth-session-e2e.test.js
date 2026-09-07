/**
 * End-to-End (E2E) Tests - Secretary Authentication & Dashboard Session Flow
 * Tests the complete administrative lifecycle: login -> authenticated dashboard -> roster -> verify -> logout.
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const app = require('../../server');
const Secretary = require('../../models/Secretary');
const Athlete = require('../../models/Athlete');
const { connectDB } = require('../../config/db');

let server;
let baseUrl;

const testSecretaryEmail = 'sec_e2e_medak@telanganayoga.org';
const testSecretaryPassword = 'TestPassword123!';
const testDistrict = 'Medak';

let testSecretaryDoc;
let testAthleteDoc;

describe('E2E Tests: District Secretary Session Lifecycle', () => {

  before(async () => {
    await connectDB();

    // 1. Create test District Secretary
    await Secretary.deleteOne({ email: testSecretaryEmail });
    testSecretaryDoc = await Secretary.create({
      email: testSecretaryEmail,
      password: testSecretaryPassword,
      district: testDistrict,
      role: 'SECRETARY',
      secretaryName: 'Medak Secretary'
    });

    // 2. Create a test athlete in Medak to review
    testAthleteDoc = await Athlete.create({
      firstName: 'E2EAthlete',
      lastName: 'MedakRunner',
      dob: new Date('2010-06-01'),
      gender: 'Male',
      district: testDistrict,
      category: 'Junior',
      chestNumber: 'MED-JR-01',
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
    if (testSecretaryDoc?._id) await Secretary.deleteOne({ _id: testSecretaryDoc._id });
    if (testAthleteDoc?._id) await Athlete.deleteOne({ _id: testAthleteDoc._id });
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.disconnect();
  });

  it('completes the full authenticated secretary workflow: login, dashboard, verify, and logout', async () => {
    // Step 1: Unauthenticated visitor attempts to access dashboard -> redirected to login
    const unauthRes = await fetch(`${baseUrl}/dashboard`, { redirect: 'manual' });
    assert.equal(unauthRes.status, 302);
    assert.equal(unauthRes.headers.get('location'), '/login.html');

    // Step 2: Secretary views the login page
    const loginPageRes = await fetch(`${baseUrl}/login`);
    assert.equal(loginPageRes.status, 200);
    const loginHtml = await loginPageRes.text();
    assert.ok(loginHtml.includes('District Secretary Portal'));

    // Step 3: Secretary authenticates with valid credentials
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testSecretaryEmail,
        password: testSecretaryPassword
      })
    });

    assert.equal(loginRes.status, 200);
    const loginData = await loginRes.json();
    assert.equal(loginData.success, true);
    assert.equal(loginData.district, testDistrict);
    assert.ok(loginData.token);

    // Extract session cookie from Set-Cookie header
    const cookieHeader = loginRes.headers.get('set-cookie');
    assert.ok(cookieHeader && cookieHeader.includes('token='));
    const sessionCookie = cookieHeader.split(';')[0];

    // Step 4: Secretary visits dashboard with session cookie -> 200 OK
    const dashboardRes = await fetch(`${baseUrl}/dashboard`, {
      headers: { Cookie: sessionCookie }
    });
    assert.equal(dashboardRes.status, 200);
    const dashboardHtml = await dashboardRes.text();
    assert.ok(dashboardHtml.includes('District Secretary Dashboard') || dashboardHtml.includes('District Dashboard'));

    // Step 5: Secretary fetches district roster using the session
    const rosterRes = await fetch(`${baseUrl}/portal/athletes/list`, {
      headers: { Cookie: sessionCookie }
    });
    assert.equal(rosterRes.status, 200);
    const roster = await rosterRes.json();
    assert.ok(Array.isArray(roster));
    assert.ok(roster.some((ath) => ath.chestNumber === 'MED-JR-01'));

    // Step 6: Secretary reviews and verifies the athlete
    const patchRes = await fetch(`${baseUrl}/portal/athletes/${testAthleteDoc._id}/status`, {
      method: 'PATCH',
      headers: {
        Cookie: sessionCookie,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: 'Verified',
        remarks: 'Documents authenticated during in-person scrutiny'
      })
    });
    assert.equal(patchRes.status, 200);
    const patchData = await patchRes.json();
    assert.equal((patchData.athlete || patchData).status, 'Verified');

    // Step 7: Secretary logs out
    const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
      headers: { Cookie: sessionCookie },
      redirect: 'manual'
    });
    assert.equal(logoutRes.status, 302);
    assert.equal(logoutRes.headers.get('location'), '/login.html');

    // Step 8: Subsequent request without session is blocked
    const postLogoutRes = await fetch(`${baseUrl}/dashboard`, { redirect: 'manual' });
    assert.equal(postLogoutRes.status, 302);
  });
});
