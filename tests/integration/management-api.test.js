/**
 * API Integration Tests - Athlete Management & Retrieval
 * Tests pagination, status filtering, admit card public retrieval, and status updates.
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const app = require('../../server');
const Athlete = require('../../models/Athlete');
const { JWT_SECRET } = require('../../config/constants');
const { connectDB } = require('../../config/db');

let server;
let baseUrl;

const district = 'Hyderabad';
const secretaryToken = jwt.sign(
  { id: 'sec_mgr_test', email: 'sec_mgr@telanganayoga.org', role: 'SECRETARY', district },
  JWT_SECRET,
  { expiresIn: '1h', algorithm: 'HS256' }
);

let testAthlete1;
let testAthlete2;

describe('Integration Tests: Athlete Management & Retrieval API', () => {

  before(async () => {
    await connectDB();

    // Create 2 test athletes in Hyderabad
    testAthlete1 = await Athlete.create({
      firstName: 'ManageOne',
      lastName: 'Sharma',
      dob: new Date('2010-01-01'),
      gender: 'Male',
      district,
      category: 'Junior',
      chestNumber: 'HYD-JR-71',
      status: 'Submitted',
      institutionName: 'Hyderabad Yoga Club',
      residentialAddress: 'Secret Address 1'
    });

    testAthlete2 = await Athlete.create({
      firstName: 'ManageTwo',
      lastName: 'Patel',
      dob: new Date('2011-02-02'),
      gender: 'Female',
      district,
      category: 'Junior',
      chestNumber: 'HYD-JR-72',
      status: 'Verified',
      institutionName: 'Telangana Sports Academy',
      residentialAddress: 'Secret Address 2'
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
    if (testAthlete1?._id) await Athlete.deleteOne({ _id: testAthlete1._id });
    if (testAthlete2?._id) await Athlete.deleteOne({ _id: testAthlete2._id });
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.disconnect();
  });

  describe('1. GET /portal/athletes/list', () => {
    it('returns paginated roster with X-Total-Count and pagination headers', async () => {
      const res = await fetch(`${baseUrl}/portal/athletes/list?page=1&limit=2`, {
        headers: { Authorization: `Bearer ${secretaryToken}` }
      });

      assert.equal(res.status, 200);
      assert.ok(res.headers.get('x-total-count'));
      assert.equal(res.headers.get('x-page'), '1');
      assert.equal(res.headers.get('x-per-page'), '2');

      const list = await res.json();
      assert.ok(Array.isArray(list));
      assert.ok(list.length >= 2);

      // Verify lean projection omits sensitive residentialAddress
      assert.equal(list[0].residentialAddress, undefined);
    });

    it('filters athletes by status parameter', async () => {
      const res = await fetch(`${baseUrl}/portal/athletes/list?status=Verified`, {
        headers: { Authorization: `Bearer ${secretaryToken}` }
      });

      assert.equal(res.status, 200);
      const list = await res.json();
      assert.ok(Array.isArray(list));
      list.forEach((ath) => {
        assert.equal(ath.status, 'Verified');
      });
    });

    it('rejects invalid status filter', async () => {
      const res = await fetch(`${baseUrl}/portal/athletes/list?status=InvalidStatus`, {
        headers: { Authorization: `Bearer ${secretaryToken}` }
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.ok(data.error.includes('Invalid status filter'));
    });
  });

  describe('2. GET /portal/athletes/:id & :id/public-card', () => {
    it('authorized secretary can retrieve full athlete record by ID', async () => {
      const res = await fetch(`${baseUrl}/portal/athletes/${testAthlete1._id}`, {
        headers: { Authorization: `Bearer ${secretaryToken}` }
      });

      assert.equal(res.status, 200);
      const ath = await res.json();
      assert.equal(ath.firstName, 'ManageOne');
      assert.equal(ath.chestNumber, 'HYD-JR-71');
      assert.equal(ath.residentialAddress, 'Secret Address 1');
    });

    it('public card endpoint retrieves admit card data by chest number without auth', async () => {
      const res = await fetch(`${baseUrl}/portal/athletes/HYD-JR-71/public-card`);

      assert.equal(res.status, 200);
      const card = await res.json();
      assert.equal(card.firstName, 'ManageOne');
      assert.equal(card.chestNumber, 'HYD-JR-71');
      // Public projection must omit residentialAddress
      assert.equal(card.residentialAddress, undefined);
    });

    it('returns 404 for non-existent athlete ID or chest number', async () => {
      const res = await fetch(`${baseUrl}/portal/athletes/NON-EXISTENT-01/public-card`);
      assert.equal(res.status, 404);
    });
  });

  describe('3. PATCH /portal/athletes/:id/status', () => {
    it('updates athlete status and remarks', async () => {
      const res = await fetch(`${baseUrl}/portal/athletes/${testAthlete1._id}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${secretaryToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'Clarification',
          remarks: 'Original DOB certificate needs clearer scan'
        })
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      const updatedDoc = data.athlete || data;
      assert.equal(updatedDoc.status, 'Clarification');

      // Verify DB reflects update
      const updated = await Athlete.findById(testAthlete1._id).lean();
      assert.equal(updated.status, 'Clarification');
      assert.equal(updated.remarks, 'Original DOB certificate needs clearer scan');
    });

    it('rejects invalid status or unexpected fields', async () => {
      const res = await fetch(`${baseUrl}/portal/athletes/${testAthlete1._id}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${secretaryToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'ArbitraryStatus'
        })
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.success, false);
    });
  });
});
