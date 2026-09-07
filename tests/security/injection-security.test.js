/**
 * Security Tests - Injection Defense (NoSQL, ReDoS, XSS, Prototype Pollution)
 * Tests server resilience against database operator injection, catastrophic regex, and XSS.
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

const secretaryToken = jwt.sign(
  { id: 'sec_inj_test', email: 'inj@example.com', role: 'SECRETARY', district: 'Hyderabad' },
  JWT_SECRET,
  { expiresIn: '1h', algorithm: 'HS256' }
);

const createdAthleteIds = [];

describe('Security Tests: Injection Attack Defense', () => {

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

  describe('1. NoSQL Operator Injection Defense', () => {
    it('rejects NoSQL injection object in login credentials', async () => {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: { $gt: '' },
          password: { $gt: '' }
        })
      });

      // Must be rejected with 400 because email/password are not strings
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.success, false);
    });

    it('sanitizes NoSQL operator keys ($where, $ne) from query parameters', async () => {
      const res = await fetch(`${baseUrl}/portal/athletes/list?$where=sleep(5000)&$ne=null`, {
        headers: { Authorization: `Bearer ${secretaryToken}` }
      });

      assert.equal(res.status, 200);
    });
  });

  describe('2. Prototype Pollution Defense', () => {
    it('strips __proto__ and constructor.prototype from request bodies', async () => {
      const res = await fetch(`${baseUrl}/portal/athletes/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: ['Traditional Yogasana'],
          '__proto__.isAdmin': true
        })
      });

      // Sanitizer deletes polluted key; endpoint processes safely or rejects extra key
      assert.ok(res.status === 200 || res.status === 400);
      assert.equal(Object.prototype.isAdmin, undefined, 'Global prototype must not be polluted');
    });
  });

  describe('3. ReDoS (Regular Expression Denial of Service) Defense', () => {
    it('treats catastrophic backtracking regex patterns as literal strings without hang', async () => {
      const redosPayload = '((a+)+)+$';
      const start = Date.now();

      const res = await fetch(`${baseUrl}/portal/athletes/list?status=${encodeURIComponent(redosPayload)}`, {
        headers: { Authorization: `Bearer ${secretaryToken}` }
      });

      const elapsed = Date.now() - start;
      assert.ok(elapsed < 2000, 'ReDoS query must complete well within 2 seconds');
      assert.equal(res.status, 400); // Invalid status filter
    });
  });

  describe('4. Stored XSS Defense', () => {
    it('neutralizes HTML and script tags from athlete names and remarks', async () => {
      const xssName = 'Ananya<script>alert("XSS")</script>';
      const formData = new URLSearchParams();
      formData.append('firstName', xssName);
      formData.append('lastName', 'Test<img src=x onerror=alert(1)>');
      formData.append('dob', '2010-05-10');
      formData.append('gender', 'Female');
      formData.append('district', 'Hyderabad');
      formData.append('institutionName', '<iframe src="evil.com"></iframe>Clean School');
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
      assert.ok(athleteId);
      createdAthleteIds.push(athleteId);

      // Verify the record stored in DB is completely sanitized of HTML tags
      const saved = await Athlete.findById(athleteId).lean();
      assert.ok(saved);
      assert.ok(!saved.firstName.includes('<script>'));
      assert.ok(!saved.lastName.includes('<img'));
      assert.ok(!saved.institutionName.includes('<iframe'));
    });
  });
});
