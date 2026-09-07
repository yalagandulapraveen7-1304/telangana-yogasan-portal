/**
 * API Integration Tests - Athlete Nomination & Orders
 * Tests order creation, validation, athlete registration, and DB persistence.
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const app = require('../../server');
const Athlete = require('../../models/Athlete');
const { JWT_SECRET, FEE_PER_EVENT } = require('../../config/constants');
const { connectDB } = require('../../config/db');

let server;
let baseUrl;

const district = 'Hyderabad';
const secretaryToken = jwt.sign(
  { id: 'sec_test_nom', email: 'sec_nom@telanganayoga.org', role: 'SECRETARY', district },
  JWT_SECRET,
  { expiresIn: '1h', algorithm: 'HS256' }
);

const createdAthleteIds = [];

describe('API Integration: Athlete Nomination & Order Creation', () => {

  before(async () => {
    await connectDB();
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

  describe('1. POST /portal/athletes/create-order', () => {
    it('creates an order with valid amount based on event count', async () => {
      const res = await fetch(`${baseUrl}/portal/athletes/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: ['Traditional Yogasana', 'Artistic Yogasana Solo']
        })
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.amount, 2 * FEE_PER_EVENT); // 2 events * ₹260
      assert.ok(data.orderId || data.order_id);
    });

    it('rejects unexpected parameter injection attempts', async () => {
      const res = await fetch(`${baseUrl}/portal/athletes/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: ['Traditional Yogasana'],
          discountCode: 'HACKED_FREE',
          amount: 1
        })
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.ok(data.message.includes('Unexpected field'));
    });

    it('rejects empty or invalid events array', async () => {
      const res = await fetch(`${baseUrl}/portal/athletes/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: [] })
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.success, false);
    });
  });

  describe('2. POST /portal/athletes/nominate', () => {
    it('successfully registers an athlete and persists record in MongoDB', async () => {
      const formData = new URLSearchParams();
      formData.append('firstName', 'IntegrationAthlete');
      formData.append('lastName', 'Verma');
      formData.append('dob', '2010-08-15'); // 15 years old -> Junior
      formData.append('gender', 'Female');
      formData.append('district', district);
      formData.append('aadhaarLast4', '8844');
      formData.append('guardianName', 'Ramesh Verma');
      formData.append('institutionName', 'Telangana Sports School');
      formData.append('mobileNumber', '9876543210');
      formData.append('residentialAddress', 'Plot 45, Banjara Hills, Hyderabad');
      formData.append('events', 'Traditional Yogasana');

      const res = await fetch(`${baseUrl}/portal/athletes/nominate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });

      assert.equal(res.status, 201);
      const data = await res.json();
      assert.equal(data.success, true);
      const athleteId = data.athlete?._id || data.athleteId;
      const chestNumber = data.athlete?.chestNumber || data.chestNumber;
      assert.ok(athleteId, 'Response must include athleteId');
      assert.ok(chestNumber, 'Response must include generated chestNumber');
      assert.ok(chestNumber.startsWith('HYD-JR-'));

      createdAthleteIds.push(athleteId);

      // Verify in DB directly
      const saved = await Athlete.findById(athleteId).lean();
      assert.ok(saved);
      assert.equal(saved.firstName, 'IntegrationAthlete');
      assert.equal(saved.lastName, 'Verma');
      assert.equal(saved.category, 'Junior');
      assert.equal(saved.status, 'Submitted');
      assert.equal(saved.district, 'Hyderabad');
    });

    it('forces Secretary assigned district even if different district is provided in body', async () => {
      const formData = new URLSearchParams();
      formData.append('firstName', 'DistrictCheckAthlete');
      formData.append('dob', '2012-05-10');
      formData.append('district', 'Warangal'); // Tampered district parameter
      formData.append('events', 'Traditional Yogasana');

      const res = await fetch(`${baseUrl}/portal/athletes/nominate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretaryToken}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
      });

      assert.equal(res.status, 201);
      const data = await res.json();
      assert.equal(data.success, true);
      const secAthleteId = data.athlete?._id || data.athleteId;
      assert.ok(secAthleteId);
      createdAthleteIds.push(secAthleteId);

      // Verify district was overridden to Secretary's assigned district (Hyderabad)
      const saved = await Athlete.findById(secAthleteId).lean();
      assert.ok(saved);
      assert.equal(saved.district, 'Hyderabad');
      assert.ok(saved.chestNumber.startsWith('HYD-'));
    });

    it('rejects nomination when firstName is missing', async () => {
      const formData = new URLSearchParams();
      formData.append('lastName', 'NoFirst');
      formData.append('dob', '2010-01-01');

      const res = await fetch(`${baseUrl}/portal/athletes/nominate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.ok(data.error.includes('First name is required'));
    });

    it('rejects nomination with invalid mobile number or bad date', async () => {
      const formData = new URLSearchParams();
      formData.append('firstName', 'BadMobileAthlete');
      formData.append('dob', '2010-01-01');
      formData.append('mobileNumber', '12345'); // Invalid length & prefix

      const res = await fetch(`${baseUrl}/portal/athletes/nominate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.ok(data.error.includes('mobile'));
    });
  });
});
