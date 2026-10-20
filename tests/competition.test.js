/**
 * Competition Management & Multi-Competition Lifecycle Test Suite
 * Validates competition models, service validations, API endpoints,
 * age cutoff calculations, and dynamic fee enforcement.
 */

'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const Competition = require('../models/Competition');
const Athlete = require('../models/Athlete');
const { JWT_SECRET } = require('../config/constants');
const { connectDB } = require('../config/db');
const {
  DEFAULT_COMPETITION_ID,
  ensureDefaultCompetition,
  getPublishedCompetitions,
  resolveCompetition,
  validateEligibility
} = require('../services/competitionService');
const { calculateAgeCategory } = require('../utils/category');
const { createOrder } = require('../utils/payment');
const { getNextChestNumber, getNextChestNumbersBatch } = require('../utils/counter');

const mongoose = require('mongoose');

let server;
let baseUrl;

before(async () => {
  await connectDB();
  const http = require('http');
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

describe('Competition Management & Domain Rules', () => {
  test('1. Default Competition Initialization', async () => {
    const comp = await ensureDefaultCompetition();
    assert.ok(comp, 'Default competition should exist');
    assert.strictEqual(comp.competitionId, DEFAULT_COMPETITION_ID);
    assert.strictEqual(comp.feePerEvent, 260);
    assert.strictEqual(comp.type, 'STATE');
    assert.ok(comp.disciplines.includes('Traditional Yogasana'));
  });

  test('2. Age Calculation with Custom Cutoff Date', () => {
    // Athlete born 2012-05-10
    const dob = '2012-05-10';

    // With cutoff date Dec 31, 2026: age is ~14.64 -> Junior
    const cat2026 = calculateAgeCategory(dob, new Date('2026-12-31'));
    assert.strictEqual(cat2026, 'Junior', 'Should be Junior under 2026 cutoff');

    // With cutoff date Dec 31, 2021: age is ~9.64 -> Sub-Junior
    const cat2021 = calculateAgeCategory(dob, new Date('2021-12-31'));
    assert.strictEqual(cat2021, 'Sub-Junior', 'Should be Sub-Junior under 2021 cutoff');

    // With cutoff date Dec 31, 2035: age is ~23.64 -> Senior
    const cat2035 = calculateAgeCategory(dob, new Date('2035-12-31'));
    assert.strictEqual(cat2035, 'Senior', 'Should be Senior under 2035 cutoff');
  });

  test('3. Eligibility Validation for Registration Status & Dates', () => {
    const openComp = {
      name: 'Open Tournament',
      status: 'OPEN',
      regStartDate: new Date(Date.now() - 86400000), // yesterday
      regEndDate: new Date(Date.now() + 86400000),   // tomorrow
      minAge: 8,
      maxAge: 35,
      districtsAllowed: ['ALL'],
      disciplines: ['Traditional Yogasana', 'Artistic Yogasana (Single)']
    };

    // Valid athlete
    const validCheck = validateEligibility(openComp, {
      dob: '2010-06-15',
      district: 'Hyderabad',
      events: ['Traditional Yogasana']
    });
    assert.strictEqual(validCheck.isValid, true);

    // Closed status check
    const closedComp = { ...openComp, status: 'CLOSED' };
    const closedCheck = validateEligibility(closedComp, { dob: '2010-06-15' });
    assert.strictEqual(closedCheck.isValid, false);
    assert.match(closedCheck.error, /closed/i);

    // Past deadline check
    const expiredComp = {
      ...openComp,
      regEndDate: new Date(Date.now() - 3600000) // 1 hour ago
    };
    const expiredCheck = validateEligibility(expiredComp, { dob: '2010-06-15' });
    assert.strictEqual(expiredCheck.isValid, false);
    assert.match(expiredCheck.error, /closed/i);
  });

  test('4. Eligibility Validation for District and Discipline Restrictions', () => {
    const hydOnlyComp = {
      name: 'Hyderabad District Trials',
      status: 'OPEN',
      districtsAllowed: ['Hyderabad'],
      disciplines: ['Traditional Yogasana']
    };

    // Outside district check
    const distCheck = validateEligibility(hydOnlyComp, {
      dob: '2010-06-15',
      district: 'Warangal',
      events: ['Traditional Yogasana']
    });
    assert.strictEqual(distCheck.isValid, false);
    assert.match(distCheck.error, /not eligible/i);

    // Invalid discipline check
    const eventCheck = validateEligibility(hydOnlyComp, {
      dob: '2010-06-15',
      district: 'Hyderabad',
      events: ['NonExistentDiscipline']
    });
    assert.strictEqual(eventCheck.isValid, false);
    assert.match(eventCheck.error, /Discipline\(s\) not offered/i);
  });

  test('5. Dynamic Fee Calculation in Order Creation', async () => {
    // 1 event at ₹350
    const order350 = await createOrder(1, 350);
    assert.strictEqual(order350.amount, 350, 'Order amount should reflect ₹350 fee');

    // 3 events at ₹200
    const order600 = await createOrder(3, 200);
    assert.strictEqual(order600.amount, 600, 'Order amount should reflect 3 * ₹200 = ₹600');

    // Default fee fallback (₹260)
    const orderDefault = await createOrder(2);
    assert.strictEqual(orderDefault.amount, 520, 'Order amount should default to 2 * ₹260 = ₹520');
  });

  test('6. Scoped Chest Numbers per Competition', async () => {
    const compA = 'tourn_a';
    const compB = 'tourn_b';

    const numA1 = await getNextChestNumber('Hyderabad', 'Junior', compA);
    const numB1 = await getNextChestNumber('Hyderabad', 'Junior', compB);

    assert.ok(numA1.startsWith('HYD-JR-'), 'Should have standard prefix');
    assert.ok(numB1.startsWith('HYD-JR-'), 'Should have standard prefix');
  });

  test('7. GET /portal/competitions returns list of open competitions', async () => {
    const res = await fetch(`${baseUrl}/portal/competitions`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.competitions));
    assert.ok(data.competitions.length >= 1, 'Should return at least the default competition');

    const defComp = data.competitions.find((c) => c.competitionId === DEFAULT_COMPETITION_ID);
    assert.ok(defComp, 'Default competition should be in listing');
    assert.strictEqual(defComp.feePerEvent, 260);
  });

  test('8. POST /portal/athletes/create-order calculates fee for specified competition', async () => {
    const res = await fetch(`${baseUrl}/portal/athletes/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: ['Traditional Yogasana', 'Free Flow'],
        competitionId: DEFAULT_COMPETITION_ID
      })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.feePerEvent, 260);
    assert.strictEqual(data.amount, 520, '2 events * ₹260 = ₹520');
    assert.strictEqual(data.competitionId, DEFAULT_COMPETITION_ID);
  });

  test('9. POST /portal/competitions requires SUPER_ADMIN authentication', async () => {
    const secretaryToken = jwt.sign(
      { id: 'sec_test_id', email: 'sec@test.org', role: 'SECRETARY', district: 'Hyderabad' },
      JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' }
    );

    const superAdminToken = jwt.sign(
      { id: 'admin_test_id', email: 'admin@test.org', role: 'SUPER_ADMIN', district: 'ALL_DISTRICTS' },
      JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' }
    );

    // 1. Unauthenticated request -> 401
    const unauthRes = await fetch(`${baseUrl}/portal/competitions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Championship' })
    });
    assert.strictEqual(unauthRes.status, 401);

    // 2. District Secretary request (not SUPER_ADMIN) -> 403
    const secRes = await fetch(`${baseUrl}/portal/competitions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secretaryToken}`
      },
      body: JSON.stringify({ name: 'Test Championship' })
    });
    assert.strictEqual(secRes.status, 403);

    // 3. Super Admin request -> 201 Created
    const testCompSlug = `district-test-${Date.now().toString(36)}`;
    const adminRes = await fetch(`${baseUrl}/portal/competitions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({
        name: 'Hyderabad District Invitational 2026',
        competitionId: testCompSlug,
        type: 'DISTRICT',
        feePerEvent: 150,
        venue: 'Gymkhana Grounds, Secunderabad',
        status: 'OPEN'
      })
    });
    assert.strictEqual(adminRes.status, 201);
    const createdData = await adminRes.json();
    assert.strictEqual(createdData.success, true);
    assert.strictEqual(createdData.competition.competitionId, testCompSlug);
    assert.strictEqual(createdData.competition.feePerEvent, 150);
  });
});
