/**
 * End-to-End (E2E) Tests - Athlete Registration & Admit Card Workflow
 * Tests the complete visitor lifecycle: loading nomination form -> submitting details -> viewing admit card.
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const app = require('../../server');
const Athlete = require('../../models/Athlete');
const { connectDB } = require('../../config/db');
const { generateTestSignature } = require('../../utils/payment');

let server;
let baseUrl;

const createdAthleteIds = [];

describe('E2E Tests: Registration to Admit Card User Journey', () => {

  before(async () => {
    await connectDB();
    await Athlete.deleteMany({ firstName: 'Sneha', lastName: 'Kulkarni' });
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (createdAthleteIds.length > 0) {
      await Athlete.deleteMany({ _id: { $in: createdAthleteIds } });
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.disconnect();
  });

  it('completes the entire registration journey from form loading to admit card rendering', async () => {
    // Step 1: Visitor navigates to the nomination page
    const formPageRes = await fetch(`${baseUrl}/nominate`);
    assert.equal(formPageRes.status, 200);
    const formHtml = await formPageRes.text();
    assert.ok(formHtml.includes('id="nomination-form"'));

    // Step 2: Visitor fills and submits the official nomination form
    const formData = new URLSearchParams();
    formData.append('firstName', 'Sneha');
    formData.append('lastName', 'Kulkarni');
    formData.append('dob', '2011-03-25'); // Junior
    formData.append('gender', 'Female');
    formData.append('district', 'Nizamabad');
    formData.append('aadhaarLast4', '7788');
    formData.append('guardianName', 'Venkatesh Kulkarni');
    formData.append('institutionName', 'Nizamabad Yogasana Kendra');
    formData.append('mobileNumber', '9849012345');
    formData.append('residentialAddress', 'Station Road, Nizamabad');
    formData.append('events', 'Traditional Yogasana');

    const orderId = `order_e2e_${Date.now()}`;
    const paymentId = `pay_e2e_${Date.now()}`;
    const signature = generateTestSignature(orderId, paymentId);
    formData.append('razorpay_order_id', orderId);
    formData.append('razorpay_payment_id', paymentId);
    formData.append('razorpay_signature', signature);

    const submitRes = await fetch(`${baseUrl}/portal/athletes/nominate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString()
    });

    assert.equal(submitRes.status, 201);
    const submitData = await submitRes.json();
    assert.equal(submitData.success, true);
    const athleteId = submitData.athlete?._id || submitData.athleteId;
    const chestNumber = submitData.athlete?.chestNumber || submitData.chestNumber;
    const admitCardToken = submitData.athlete?.admitCardToken;
    assert.ok(athleteId);
    assert.ok(chestNumber);
    assert.ok(admitCardToken);
    assert.ok(chestNumber.startsWith('NIZ-'));

    createdAthleteIds.push(athleteId);

    // Step 3: Verify unauthenticated request with chest number alone is rejected with 401
    const unauthCardRes = await fetch(`${baseUrl}/portal/athletes/${chestNumber}/public-card`);
    assert.equal(unauthCardRes.status, 401);

    // Step 4: Visitor views their generated Admit Card page with their security token passed in URL fragment
    const cardPageUrl = `${baseUrl}/admitcard?id=${athleteId}#token=${admitCardToken}`;
    const cardPageRes = await fetch(cardPageUrl);
    assert.equal(cardPageRes.status, 200);
    const cardHtml = await cardPageRes.text();
    assert.ok(cardHtml.includes('STATE SELECTION TRIALS - ADMIT CARD'));

    // Step 5: The admit card page fetches athlete details via the public API sending token strictly in header
    // Confirm token is NOT included in the API request URL
    const apiUrl = `${baseUrl}/portal/athletes/${chestNumber}/public-card`;
    assert.equal(apiUrl.includes('?'), false);
    assert.equal(apiUrl.includes(admitCardToken), false);

    const apiCardRes = await fetch(apiUrl, {
      headers: { 'X-Admit-Card-Token': admitCardToken }
    });
    assert.equal(apiCardRes.status, 200);

    const athleteData = await apiCardRes.json();
    assert.equal(athleteData.firstName, 'Sneha');
    assert.equal(athleteData.lastName, 'Kulkarni');
    assert.equal(athleteData.district, 'Nizamabad');
    assert.equal(athleteData.chestNumber, chestNumber);
    assert.equal(athleteData.status, 'Submitted');
    // Ensure sensitive personal data and token credentials are strictly omitted from public response
    assert.equal(athleteData.aadhaarLast4, undefined);
    assert.equal(athleteData.guardianName, undefined);
    assert.equal(athleteData.dob, undefined);
    assert.equal(athleteData.residentialAddress, undefined);
    assert.equal(athleteData.mobileNumber, undefined);
    assert.equal(athleteData.admitCardToken, undefined);
    assert.equal(athleteData.admitCardTokenExpiresAt, undefined);
  });
});
