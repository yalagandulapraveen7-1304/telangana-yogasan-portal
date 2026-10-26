/**
 * Nomination Payment Flow & Razorpay Verification Test Suite
 *
 * Validates:
 * 1. Enforcement of payment for public individual registrations on paid competitions.
 * 2. Direct server-side verification of payment details with Razorpay (amount in paise, currency, status, order binding).
 * 3. Prevention of payment replay / order reuse across different athletes.
 * 4. Protection against client tampering (browser-supplied amount or status).
 * 5. Preservation of admin-approved flows (District Secretary / Super Admin) without payment.
 * 6. Preservation of documented free competition flows (feePerEvent: 0) without payment.
 * 7. Preservation of school delegation bulk nominations without individual payment.
 */

'use strict';

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const app = require('../server');
const Athlete = require('../models/Athlete');
const Competition = require('../models/Competition');
const { connectDB } = require('../config/db');
const { JWT_SECRET, FEE_PER_EVENT, RAZORPAY_KEY_SECRET } = require('../config/constants');
const {
  verifyPaymentSignature,
  verifyPaymentWithGateway,
  generateTestSignature,
  registerMockPayment,
  clearMockPayments
} = require('../utils/payment');

let server;
let baseUrl;

const createdAthleteIds = [];
const createdCompIds = [];

const secretaryToken = jwt.sign(
  { id: 'sec_payment_test', email: 'sec_hyd@telanganayoga.org', role: 'SECRETARY', district: 'Hyderabad' },
  JWT_SECRET,
  { expiresIn: '1h', algorithm: 'HS256' }
);

const superAdminToken = jwt.sign(
  { id: 'admin_payment_test', email: 'admin@telanganayoga.org', role: 'SUPER_ADMIN', district: 'ALL_DISTRICTS' },
  JWT_SECRET,
  { expiresIn: '1h', algorithm: 'HS256' }
);

before(async () => {
  await connectDB();
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (createdAthleteIds.length > 0) {
    await Athlete.deleteMany({ _id: { $in: createdAthleteIds } });
  }
  if (createdCompIds.length > 0) {
    await Competition.deleteMany({ competitionId: { $in: createdCompIds } });
  }
  if (server) {
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
    await new Promise((resolve) => server.close(resolve));
  }
  await mongoose.disconnect();
});

beforeEach(() => {
  clearMockPayments();
});

afterEach(() => {
  clearMockPayments();
});

function createAthleteFormData(overrides = {}) {
  const formData = new URLSearchParams();
  formData.append('firstName', overrides.firstName || 'PaymentTestAthlete');
  formData.append('lastName', overrides.lastName || 'Sharma');
  formData.append('dob', overrides.dob || '2010-06-15');
  formData.append('gender', overrides.gender || 'Female');
  formData.append('district', overrides.district || 'Hyderabad');
  formData.append('aadhaarLast4', overrides.aadhaarLast4 || '4321');
  formData.append('guardianName', overrides.guardianName || 'Rajesh Sharma');
  formData.append('institutionName', overrides.institutionName || 'Hyderabad Sports Academy');
  formData.append('mobileNumber', overrides.mobileNumber || '9876543210');
  formData.append('residentialAddress', overrides.residentialAddress || '123 Yoga Colony, Hyderabad');

  if (Array.isArray(overrides.events)) {
    overrides.events.forEach((ev) => formData.append('events[]', ev));
  } else {
    formData.append('events', overrides.events || 'Traditional Yogasana');
  }

  if (overrides.competitionId) {
    formData.append('competitionId', overrides.competitionId);
  }

  if (overrides.razorpay_order_id) {
    formData.append('razorpay_order_id', overrides.razorpay_order_id);
  }
  if (overrides.razorpay_payment_id) {
    formData.append('razorpay_payment_id', overrides.razorpay_payment_id);
  }
  if (overrides.razorpay_signature) {
    formData.append('razorpay_signature', overrides.razorpay_signature);
  }

  if (overrides.amount !== undefined) {
    formData.append('amount', overrides.amount);
  }
  if (overrides.paymentStatus !== undefined) {
    formData.append('paymentStatus', overrides.paymentStatus);
  }

  return formData;
}

describe('Audit: Nomination Payment Enforcement & Razorpay Integrity', () => {

  describe('1. Missing Payment Enforcement on Paid Competitions', () => {
    it('rejects public individual nomination for paid competition when payment parameters are missing (HTTP 400)', async () => {
      const formData = createAthleteFormData(); // No payment parameters

      const res = await fetch(`${baseUrl}/portal/athletes/nominate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('Payment of ₹260 is required'));
    });

    it('rejects public nomination when only partial payment parameters are provided (HTTP 400)', async () => {
      const formData = createAthleteFormData({
        razorpay_order_id: 'order_test_partial_123'
        // missing payment_id and signature
      });

      const res = await fetch(`${baseUrl}/portal/athletes/nominate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('Incomplete payment parameters'));
    });
  });

  describe('2. Invalid Payment Parameters & Forged Signatures', () => {
    it('rejects malformed payment gateway identifiers (HTTP 400)', async () => {
      const formData = createAthleteFormData({
        razorpay_order_id: 'bad-order-id',
        razorpay_payment_id: 'pay_123',
        razorpay_signature: 'a'.repeat(64)
      });

      const res = await fetch(`${baseUrl}/portal/athletes/nominate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('Malformed payment gateway parameters'));
    });

    it('rejects invalid or forged cryptographic signature (HTTP 400)', async () => {
      const orderId = `order_test_${Date.now()}`;
      const paymentId = `pay_test_${Date.now()}`;
      const forgedSignature = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      // Ensure secret is active for signature mismatch check
      const validSig = generateTestSignature(orderId, paymentId);
      assert.notStrictEqual(forgedSignature, validSig);

      const formData = createAthleteFormData({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: forgedSignature
      });

      const res = await fetch(`${baseUrl}/portal/athletes/nominate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('Invalid signature'));
    });

    it('rejects payment when Razorpay gateway reports status is not captured/authorized (HTTP 400)', async () => {
      const orderId = `order_test_failed_${Date.now()}`;
      const paymentId = `pay_test_failed_${Date.now()}`;
      const signature = generateTestSignature(orderId, paymentId);

      // Register mock payment with failed status in gateway
      registerMockPayment(paymentId, {
        id: paymentId,
        order_id: orderId,
        amount: 26000,
        currency: 'INR',
        status: 'failed'
      });

      const formData = createAthleteFormData({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature
      });

      const res = await fetch(`${baseUrl}/portal/athletes/nominate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('failed') || data.error.includes('captured'));
    });
  });

  describe('3. Mismatched Payments, Replay Attacks & Browser Tampering Defense', () => {
    it('rejects underpaid payment when athlete registers for 2 events (₹520) but payment was for 1 event (₹260) (HTTP 400)', async () => {
      const orderId = `order_test_mismatch_${Date.now()}`;
      const paymentId = `pay_test_mismatch_${Date.now()}`;
      const signature = generateTestSignature(orderId, paymentId);

      // Payment in gateway was only ₹260 (26000 paise)
      registerMockPayment(paymentId, {
        id: paymentId,
        order_id: orderId,
        amount: 26000,
        currency: 'INR',
        status: 'captured'
      });

      // Athlete submits form with 2 events -> expected fee is 2 * ₹260 = ₹520 (52000 paise)
      const formData = createAthleteFormData({
        events: ['Traditional Yogasana', 'Artistic Yogasana (Single)'],
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature
      });

      const res = await fetch(`${baseUrl}/portal/athletes/nominate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('amount mismatch'));
    });

    it('rejects payment order mismatch when payment belongs to a different order (HTTP 400)', async () => {
      const orderIdA = `order_test_A_${Date.now()}`;
      const orderIdB = `order_test_B_${Date.now()}`;
      const paymentId = `pay_test_order_mismatch_${Date.now()}`;
      const signature = generateTestSignature(orderIdA, paymentId);

      // Payment record in gateway is bound to Order B
      registerMockPayment(paymentId, {
        id: paymentId,
        order_id: orderIdB, // Mismatch with submitted orderIdA
        amount: 26000,
        currency: 'INR',
        status: 'captured'
      });

      const formData = createAthleteFormData({
        razorpay_order_id: orderIdA,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature
      });

      const res = await fetch(`${baseUrl}/portal/athletes/nominate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('does not belong to the specified order'));
    });

    it('rejects payment when currency in gateway is not INR (HTTP 400)', async () => {
      const orderId = `order_test_curr_${Date.now()}`;
      const paymentId = `pay_test_curr_${Date.now()}`;
      const signature = generateTestSignature(orderId, paymentId);

      registerMockPayment(paymentId, {
        id: paymentId,
        order_id: orderId,
        amount: 26000,
        currency: 'USD', // Mismatch
        status: 'captured'
      });

      const formData = createAthleteFormData({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature
      });

      const res = await fetch(`${baseUrl}/portal/athletes/nominate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('Currency mismatch') || data.error.includes('currency'));
    });

    it('rejects payment replay / reuse attack when same paymentId is reused for a second athlete (HTTP 409)', async () => {
      const orderId = `order_test_replay_${Date.now()}`;
      const paymentId = `pay_test_replay_${Date.now()}`;
      const signature = generateTestSignature(orderId, paymentId);

      registerMockPayment(paymentId, {
        id: paymentId,
        order_id: orderId,
        amount: 26000,
        currency: 'INR',
        status: 'captured'
      });

      // Athlete 1: Valid initial registration
      const formData1 = createAthleteFormData({
        firstName: 'FirstLegitAthlete',
        aadhaarLast4: '1111',
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature
      });

      const res1 = await fetch(`${baseUrl}/portal/athletes/nominate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData1.toString()
      });

      assert.strictEqual(res1.status, 201);
      const data1 = await res1.json();
      createdAthleteIds.push(data1.athlete._id);

      // Athlete 2: Malicious attempt to reuse the exact same orderId and paymentId
      const formData2 = createAthleteFormData({
        firstName: 'AttackerReplayAthlete',
        aadhaarLast4: '2222',
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature
      });

      const res2 = await fetch(`${baseUrl}/portal/athletes/nominate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData2.toString()
      });

      assert.strictEqual(res2.status, 409, 'Must reject replayed payment with HTTP 409 Conflict');
      const data2 = await res2.json();
      assert.strictEqual(data2.success, false);
      assert.ok(data2.error.includes('already been utilized'));
    });

    it('does not trust browser-supplied amount or paymentStatus parameters', async () => {
      const orderId = `order_test_tamper_${Date.now()}`;
      const paymentId = `pay_test_tamper_${Date.now()}`;
      const signature = generateTestSignature(orderId, paymentId);

      // Browser tampers: claims paymentStatus=PAID and amount=0, but provides no gateway proof
      const formData = createAthleteFormData({
        amount: 0,
        totalFee: 0,
        paymentStatus: 'PAID'
      });

      const res = await fetch(`${baseUrl}/portal/athletes/nominate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('Payment of ₹260 is required'));
    });
  });

  describe('4. Valid Payment Verification & Athlete Document Binding', () => {
    it('verifies valid payment directly and binds order, amount, currency, and status to the athlete record (HTTP 201)', async () => {
      const orderId = `order_test_valid_${Date.now()}`;
      const paymentId = `pay_test_valid_${Date.now()}`;
      const signature = generateTestSignature(orderId, paymentId);

      registerMockPayment(paymentId, {
        id: paymentId,
        order_id: orderId,
        amount: 26000, // ₹260 (1 event)
        currency: 'INR',
        status: 'captured'
      });

      const formData = createAthleteFormData({
        firstName: 'LegitPaidAthlete',
        aadhaarLast4: '9988',
        events: 'Traditional Yogasana',
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature
      });

      const res = await fetch(`${baseUrl}/portal/athletes/nominate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.athlete);
      assert.ok(data.athlete.chestNumber);
      assert.ok(data.athlete.admitCardToken);

      const athleteId = data.athlete._id;
      createdAthleteIds.push(athleteId);

      // Verify DB persistence of verified payment details
      const dbRecord = await Athlete.findById(athleteId).lean();
      assert.ok(dbRecord);
      assert.ok(dbRecord.paymentDetails, 'Athlete must have paymentDetails');
      assert.strictEqual(dbRecord.paymentDetails.orderId, orderId);
      assert.strictEqual(dbRecord.paymentDetails.paymentId, paymentId);
      assert.strictEqual(dbRecord.paymentDetails.amount, 260); // Server calculated
      assert.strictEqual(dbRecord.paymentDetails.currency, 'INR');
      assert.strictEqual(dbRecord.paymentDetails.status, 'PAID');
      assert.ok(dbRecord.paymentDetails.paidAt);
    });

    it('verifies valid payment for multi-event nomination (2 events = ₹520) (HTTP 201)', async () => {
      const orderId = `order_test_multi_${Date.now()}`;
      const paymentId = `pay_test_multi_${Date.now()}`;
      const signature = generateTestSignature(orderId, paymentId);

      registerMockPayment(paymentId, {
        id: paymentId,
        order_id: orderId,
        amount: 52000, // ₹520 (2 events * ₹260)
        currency: 'INR',
        status: 'captured'
      });

      const formData = createAthleteFormData({
        firstName: 'MultiEventAthlete',
        aadhaarLast4: '7766',
        events: ['Traditional Yogasana', 'Artistic Yogasana (Single)'],
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature
      });

      const res = await fetch(`${baseUrl}/portal/athletes/nominate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.success, true);

      const athleteId = data.athlete._id;
      createdAthleteIds.push(athleteId);

      const dbRecord = await Athlete.findById(athleteId).lean();
      assert.strictEqual(dbRecord.paymentDetails.amount, 520);
      assert.strictEqual(dbRecord.paymentDetails.status, 'PAID');
    });
  });

  describe('5. Preservation of Admin-Approved & Documented Free Flows', () => {
    it('allows District Secretary to submit nominations without payment (Admin-approved flow) (HTTP 201)', async () => {
      const formData = createAthleteFormData({
        firstName: 'SecretaryApprovedAthlete',
        aadhaarLast4: '5544',
        district: 'Hyderabad'
        // No payment parameters
      });

      const res = await fetch(`${baseUrl}/portal/athletes/nominate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretaryToken}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.athlete);
      createdAthleteIds.push(data.athlete._id);

      const dbRecord = await Athlete.findById(data.athlete._id).lean();
      assert.ok(dbRecord.paymentDetails);
      assert.strictEqual(dbRecord.paymentDetails.orderId, 'ADMIN_APPROVED');
      assert.strictEqual(dbRecord.paymentDetails.status, 'PAID');
    });

    it('allows Super Admin to submit nominations without payment (Admin-approved flow) (HTTP 201)', async () => {
      const formData = createAthleteFormData({
        firstName: 'SuperAdminApprovedAthlete',
        aadhaarLast4: '3322',
        district: 'Warangal'
      });

      const res = await fetch(`${baseUrl}/portal/athletes/nominate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      createdAthleteIds.push(data.athlete._id);
    });

    it('allows public nomination without payment for competitions configured with feePerEvent: 0 (Free flow) (HTTP 201)', async () => {
      const freeCompSlug = `free-tournament-${Date.now()}`;
      await Competition.create({
        competitionId: freeCompSlug,
        name: 'State Yoga Demonstration (Free Entry)',
        type: 'OPEN',
        status: 'OPEN',
        feePerEvent: 0, // Explicitly free
        currency: 'INR'
      });
      createdCompIds.push(freeCompSlug);

      const formData = createAthleteFormData({
        firstName: 'FreeTournamentAthlete',
        aadhaarLast4: '6655',
        competitionId: freeCompSlug
        // No payment parameters
      });

      const res = await fetch(`${baseUrl}/portal/athletes/nominate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      createdAthleteIds.push(data.athlete._id);

      const dbRecord = await Athlete.findById(data.athlete._id).lean();
      assert.ok(dbRecord.paymentDetails);
      assert.strictEqual(dbRecord.paymentDetails.orderId, 'FREE_EVENT');
      assert.strictEqual(dbRecord.paymentDetails.amount, 0);
      assert.strictEqual(dbRecord.paymentDetails.status, 'PAID');
    });

    it('preserves School Delegation bulk registration without requiring payment (HTTP 201)', async () => {
      const res = await fetch(`${baseUrl}/portal/athletes/bulk-nominate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_name: 'Zilla Parishad High School Warangal',
          coach_name: 'Venkatesh Rao (PET)',
          coach_mobile: '9849123456',
          district: 'Warangal',
          students: [
            {
              firstName: 'Rahul',
              lastName: 'Goud',
              dob: '2012-07-15',
              gender: 'Male',
              aadhaarLast4: '9012',
              events: ['Traditional Yogasana']
            }
          ]
        })
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.count, 1);
      assert.ok(Array.isArray(data.athletes));
      createdAthleteIds.push(data.athletes[0]._id);
    });
  });
});
