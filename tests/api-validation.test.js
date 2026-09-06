/**
 * Automated API Endpoint Input Validation Test Suite
 * Validates server-side schema, types, lengths, allowed values, bounds, and rejection of malformed/unexpected inputs.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const app = require('../server');
const { connectDB } = require('../config/db');
const { JWT_SECRET } = require('../config/constants');
const Athlete = require('../models/Athlete');
const Secretary = require('../models/Secretary');

const {
  isValidEmail,
  isValidPassword,
  isValidPhone,
  isValidAadhaarLast4,
  isValidDate,
  isValidObjectId,
  isValidChestNumber,
  isValidDistrict,
  normalizeDistrict,
  isValidGender,
  isValidStatus,
  validateEvents,
  isValidFilename,
  sanitizeBoundedText
} = require('../utils/validators');

let server;
let baseUrl;
let secretaryToken;
let superAdminToken;
let testAthleteId;

test.before(async () => {
  await connectDB();

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  // Create or retrieve test credentials
  secretaryToken = jwt.sign(
    {
      id: new mongoose.Types.ObjectId(),
      email: 'sec.validation@yogasana.org',
      role: 'SECRETARY',
      district: 'Hyderabad'
    },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '1h' }
  );

  superAdminToken = jwt.sign(
    {
      id: new mongoose.Types.ObjectId(),
      email: 'admin.validation@yogasana.org',
      role: 'SUPER_ADMIN',
      district: 'ALL_DISTRICTS'
    },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '1h' }
  );

  // Seed a test athlete for status and detail tests
  const athlete = await Athlete.create({
    firstName: 'ValidationTarget',
    lastName: 'Athlete',
    dob: new Date('2010-05-15'),
    gender: 'Female',
    district: 'Hyderabad',
    category: 'Junior',
    chestNumber: 'HYD-JUN-999',
    status: 'Submitted'
  });
  testAthleteId = athlete._id.toString();
});

test.after(async () => {
  if (testAthleteId) {
    await Athlete.deleteMany({ firstName: /ValidationTarget|TestValid/ });
  }
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await mongoose.disconnect();
});

/* ================================================================
   1. VALIDATION UTILITY UNIT TESTS
   ================================================================ */
test.describe('Validation Utilities Unit Tests', () => {
  test('isValidEmail accepts RFC compliant emails and rejects invalid/oversized', () => {
    assert.equal(isValidEmail('valid.secretary@yogasana.org'), true);
    assert.equal(isValidEmail('admin+ops@telangana.gov.in'), true);
    assert.equal(isValidEmail('plainaddress'), false);
    assert.equal(isValidEmail('@missingusername.com'), false);
    assert.equal(isValidEmail('user@.com'), false);
    assert.equal(isValidEmail('user@domain'), false);
    assert.equal(isValidEmail(''), false);
    assert.equal(isValidEmail(null), false);
    assert.equal(isValidEmail('a'.repeat(151) + '@mail.com'), false);
  });

  test('isValidPassword enforces length bounds (1 to 128 chars)', () => {
    assert.equal(isValidPassword('Secret@123'), true);
    assert.equal(isValidPassword('a'), true);
    assert.equal(isValidPassword(''), false);
    assert.equal(isValidPassword(null), false);
    assert.equal(isValidPassword('a'.repeat(129)), false);
  });

  test('isValidPhone validates 10-digit Indian numbers starting with 6-9', () => {
    assert.equal(isValidPhone('9876543210'), true);
    assert.equal(isValidPhone('8123456789'), true);
    assert.equal(isValidPhone('7000000000'), true);
    assert.equal(isValidPhone('6300000000'), true);
    assert.equal(isValidPhone('5999999999'), false); // starts with 5
    assert.equal(isValidPhone('1234567890'), false); // starts with 1
    assert.equal(isValidPhone('987654321'), false); // 9 digits
    assert.equal(isValidPhone('98765432100'), false); // 11 digits
    assert.equal(isValidPhone('98765abcde'), false);
    assert.equal(isValidPhone(''), false);
  });

  test('isValidAadhaarLast4 strictly requires 4 numeric digits', () => {
    assert.equal(isValidAadhaarLast4('1234'), true);
    assert.equal(isValidAadhaarLast4('0000'), true);
    assert.equal(isValidAadhaarLast4('9999'), true);
    assert.equal(isValidAadhaarLast4('123'), false);
    assert.equal(isValidAadhaarLast4('12345'), false);
    assert.equal(isValidAadhaarLast4('abcd'), false);
    assert.equal(isValidAadhaarLast4(''), false);
    assert.equal(isValidAadhaarLast4(null), false);
  });

  test('isValidDate verifies real calendar days and age bounds', () => {
    assert.equal(isValidDate('2012-04-18', 5, 100), true);
    assert.equal(isValidDate('2000-01-01', 5, 100), true);
    // Invalid calendar days
    assert.equal(isValidDate('2023-02-31', 5, 100), false);
    assert.equal(isValidDate('2023-04-31', 5, 100), false);
    assert.equal(isValidDate('2023-13-01', 5, 100), false);
    // Future date
    assert.equal(isValidDate('2099-01-01', 5, 100), false);
    // Too young (e.g. under 5 years old)
    const today = new Date();
    const oneYearAgo = `${today.getFullYear() - 1}-01-01`;
    assert.equal(isValidDate(oneYearAgo, 5, 100), false);
    // Invalid strings
    assert.equal(isValidDate('not-a-date'), false);
    assert.equal(isValidDate(''), false);
    assert.equal(isValidDate(null), false);
  });

  test('isValidObjectId checks 24-character hexadecimal format', () => {
    assert.equal(isValidObjectId('507f1f77bcf86cd799439011'), true);
    assert.equal(isValidObjectId('64f1a2b3c4d5e6f7a8b9c0d1'), true);
    assert.equal(isValidObjectId('507f1f77bcf86cd79943901'), false); // 23 chars
    assert.equal(isValidObjectId('507f1f77bcf86cd7994390111'), false); // 25 chars
    assert.equal(isValidObjectId('507f1f77bcf86cd79943901z'), false); // non-hex
    assert.equal(isValidObjectId(''), false);
    assert.equal(isValidObjectId(null), false);
  });

  test('isValidDistrict and normalizeDistrict strictly validate Telangana districts', () => {
    assert.equal(isValidDistrict('Hyderabad'), true);
    assert.equal(isValidDistrict('hyderabad'), true);
    assert.equal(isValidDistrict('Warangal District'), true);
    assert.equal(isValidDistrict('Medchal Malkajgiri'), true);
    assert.equal(isValidDistrict('Bangalore'), false);
    assert.equal(isValidDistrict('Mumbai'), false);
    assert.equal(isValidDistrict(''), false);
    assert.equal(normalizeDistrict('warangal district'), 'Warangal');
    assert.equal(normalizeDistrict('invalid'), null);
  });

  test('isValidGender and isValidStatus validate enumerations', () => {
    assert.equal(isValidGender('Male'), true);
    assert.equal(isValidGender('Female'), true);
    assert.equal(isValidGender('Other'), true);
    assert.equal(isValidGender('Unknown'), false);

    assert.equal(isValidStatus('Submitted'), true);
    assert.equal(isValidStatus('Verified'), true);
    assert.equal(isValidStatus('Clarification'), true);
    assert.equal(isValidStatus('Pending'), true);
    assert.equal(isValidStatus('Rejected'), false);
    assert.equal(isValidStatus('Deleted'), false);
  });

  test('validateEvents enforces array bounds and valid entries', () => {
    const res1 = validateEvents(['Traditional Yogasana', 'Free Flow']);
    assert.equal(res1.isValid, true);
    assert.equal(res1.events.length, 2);

    const res2 = validateEvents([]);
    assert.equal(res2.isValid, false);

    const res3 = validateEvents(Array(11).fill('Traditional Yogasana'));
    assert.equal(res3.isValid, false); // >10 events
  });

  test('isValidFilename prevents directory traversal and restricts extensions', () => {
    assert.equal(isValidFilename('athlete_photo_123.jpg'), true);
    assert.equal(isValidFilename('cert-456.pdf'), true);
    assert.equal(isValidFilename('avatar.png'), true);
    assert.equal(isValidFilename('../../../etc/passwd.jpg'), false);
    assert.equal(isValidFilename('..\\Windows\\System32.png'), false);
    assert.equal(isValidFilename('malicious.exe'), false);
    assert.equal(isValidFilename('exploit.sh'), false);
    assert.equal(isValidFilename('photo.php.jpg'), false);
    assert.equal(isValidFilename(''), false);
  });
});

/* ================================================================
   2. ENDPOINT VALIDATION INTEGRATION TESTS
   ================================================================ */
test.describe('Endpoint Input Validation & Rejection Tests', () => {
  // --- Endpoint: POST /auth/login ---
  test('POST /auth/login rejects non-string types and invalid email formats', async () => {
    // Non-string email
    const res1 = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 12345, password: 'password123' })
    });
    assert.equal(res1.status, 400);
    const body1 = await res1.json();
    assert.equal(body1.success, false);

    // Invalid email format
    const res2 = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: 'password123' })
    });
    assert.equal(res2.status, 400);

    // Oversized password (>128 chars)
    const res3 = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sec@telangana.org', password: 'a'.repeat(150) })
    });
    assert.equal(res3.status, 400);

    // Unexpected keys injection
    const res4 = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sec@telangana.org', password: 'pass', role: 'SUPER_ADMIN' })
    });
    assert.equal(res4.status, 400);
    const body4 = await res4.json();
    assert.ok(body4.error.includes('Unexpected field'));
  });

  test('POST /auth/login gracefully handles malformed JSON body', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"email": "broken-json,'
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
  });

  // --- Endpoint: GET /auth/logs ---
  test('GET /auth/logs validates limit query parameter bounds', async () => {
    // Non-integer limit
    const res1 = await fetch(`${baseUrl}/auth/logs?limit=abc`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    assert.equal(res1.status, 400);

    // Negative limit
    const res2 = await fetch(`${baseUrl}/auth/logs?limit=-5`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    assert.equal(res2.status, 400);

    // Out of bounds limit (>200)
    const res3 = await fetch(`${baseUrl}/auth/logs?limit=500`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    assert.equal(res3.status, 400);

    // Valid limit
    const res4 = await fetch(`${baseUrl}/auth/logs?limit=10`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    assert.equal(res4.status, 200);
    assert.ok(Array.isArray(await res4.json()));
  });

  // --- Endpoint: GET /portal/athletes/list ---
  test('GET /portal/athletes/list validates status and limit query parameters', async () => {
    // Invalid status filter
    const res1 = await fetch(`${baseUrl}/portal/athletes/list?status=HACKED_STATUS`, {
      headers: { Authorization: `Bearer ${secretaryToken}` }
    });
    assert.equal(res1.status, 400);

    // Invalid limit query
    const res2 = await fetch(`${baseUrl}/portal/athletes/list?limit=xyz`, {
      headers: { Authorization: `Bearer ${secretaryToken}` }
    });
    assert.equal(res2.status, 400);

    // Valid status and limit
    const res3 = await fetch(`${baseUrl}/portal/athletes/list?status=Submitted&limit=5`, {
      headers: { Authorization: `Bearer ${secretaryToken}` }
    });
    assert.equal(res3.status, 200);
    assert.ok(Array.isArray(await res3.json()));
  });

  // --- Endpoint: GET /portal/athletes/:id/public-card ---
  test('GET /portal/athletes/:id/public-card rejects malformed identifiers', async () => {
    // Special characters / injection attempt
    const res1 = await fetch(`${baseUrl}/portal/athletes/%3Cscript%3E/public-card`);
    assert.equal(res1.status, 400);

    // Oversized identifier
    const res2 = await fetch(`${baseUrl}/portal/athletes/${'A'.repeat(80)}/public-card`);
    assert.equal(res2.status, 400);

    // Valid format but nonexistent ID returns 404
    const res3 = await fetch(`${baseUrl}/portal/athletes/507f1f77bcf86cd799439011/public-card`);
    assert.equal(res3.status, 404);

    // Valid seeded athlete chest number
    const res4 = await fetch(`${baseUrl}/portal/athletes/HYD-JUN-999/public-card`);
    assert.equal(res4.status, 200);
    const data = await res4.json();
    assert.equal(data.chestNumber, 'HYD-JUN-999');
  });

  // --- Endpoint: GET /portal/athletes/:id ---
  test('GET /portal/athletes/:id rejects non-ObjectId formats', async () => {
    const res = await fetch(`${baseUrl}/portal/athletes/not-a-valid-id`, {
      headers: { Authorization: `Bearer ${secretaryToken}` }
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes('Invalid athlete ID format'));
  });

  // --- Endpoint: POST /portal/athletes/create-order ---
  test('POST /portal/athletes/create-order validates events and rejects unexpected fields', async () => {
    // Missing events
    const res1 = await fetch(`${baseUrl}/portal/athletes/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(res1.status, 400);

    // Empty events array
    const res2 = await fetch(`${baseUrl}/portal/athletes/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [] })
    });
    assert.equal(res2.status, 400);

    // Unexpected fields
    const res3 = await fetch(`${baseUrl}/portal/athletes/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: ['Traditional Yogasana'], maliciousPayload: true })
    });
    assert.equal(res3.status, 400);

    // Valid order creation
    const res4 = await fetch(`${baseUrl}/portal/athletes/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: ['Traditional Yogasana'] })
    });
    assert.equal(res4.status, 200);
    const data = await res4.json();
    assert.equal(data.success, true);
    assert.ok(data.order_id);
  });

  // --- Endpoint: POST /portal/athletes/nominate ---
  test('POST /portal/athletes/nominate rejects invalid phone, date, and gender values', async () => {
    // Missing first name
    const form1 = new URLSearchParams();
    form1.append('dob', '2012-05-10');
    form1.append('gender', 'Female');
    const res1 = await fetch(`${baseUrl}/portal/athletes/nominate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form1.toString()
    });
    assert.equal(res1.status, 400);

    // Invalid phone number format
    const form2 = new URLSearchParams();
    form2.append('firstName', 'TestValidAth');
    form2.append('dob', '2012-05-10');
    form2.append('mobileNumber', '12345'); // invalid
    const res2 = await fetch(`${baseUrl}/portal/athletes/nominate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form2.toString()
    });
    assert.equal(res2.status, 400);
    const body2 = await res2.json();
    assert.ok(body2.error.includes('mobile number'));

    // Invalid Aadhaar (5 digits)
    const form3 = new URLSearchParams();
    form3.append('firstName', 'TestValidAth');
    form3.append('dob', '2012-05-10');
    form3.append('aadhaarLast4', '12345');
    const res3 = await fetch(`${baseUrl}/portal/athletes/nominate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form3.toString()
    });
    assert.equal(res3.status, 400);
    const body3 = await res3.json();
    assert.ok(body3.error.includes('Aadhaar'));

    // Invalid Date of Birth (impossible date)
    const form4 = new URLSearchParams();
    form4.append('firstName', 'TestValidAth');
    form4.append('dob', '2024-02-31');
    const res4 = await fetch(`${baseUrl}/portal/athletes/nominate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form4.toString()
    });
    assert.equal(res4.status, 400);
    const body4 = await res4.json();
    assert.ok(body4.error.includes('Date of Birth'));

    // Invalid Gender
    const form5 = new URLSearchParams();
    form5.append('firstName', 'TestValidAth');
    form5.append('dob', '2012-05-10');
    form5.append('gender', 'Alien');
    const res5 = await fetch(`${baseUrl}/portal/athletes/nominate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form5.toString()
    });
    assert.equal(res5.status, 400);

    // Invalid District for public unauthenticated submission
    const form6 = new URLSearchParams();
    form6.append('firstName', 'TestValidAth');
    form6.append('dob', '2012-05-10');
    form6.append('district', 'Atlantis');
    const res6 = await fetch(`${baseUrl}/portal/athletes/nominate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form6.toString()
    });
    assert.equal(res6.status, 400);

    // Successful nomination with valid fields
    const validForm = new URLSearchParams();
    validForm.append('firstName', 'TestValidAth');
    validForm.append('lastName', 'Kumar');
    validForm.append('dob', '2012-05-10');
    validForm.append('gender', 'Male');
    validForm.append('aadhaarLast4', '4321');
    validForm.append('mobileNumber', '9876543210');
    validForm.append('guardianName', 'Ramesh Kumar');
    validForm.append('institutionName', 'Hyderabad Yoga Academy');
    validForm.append('district', 'Hyderabad');
    validForm.append('residentialAddress', '12-34, Banjara Hills, Hyderabad');

    const resValid = await fetch(`${baseUrl}/portal/athletes/nominate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: validForm.toString()
    });
    assert.equal(resValid.status, 201);
    const validData = await resValid.json();
    assert.equal(validData.success, true);
    assert.equal(validData.athlete.firstName, 'TestValidAth');
    assert.equal(validData.athlete.aadhaarLast4, '4321');

    // Clean up
    if (validData.athlete?._id) {
      await Athlete.deleteOne({ _id: validData.athlete._id });
    }
  });

  // --- Endpoint: POST /portal/athletes/bulk-nominate ---
  test('POST /portal/athletes/bulk-nominate validates school, coach, and student records', async () => {
    // Missing school name
    const form1 = new URLSearchParams();
    form1.append('coach_mobile', '9876543210');
    const res1 = await fetch(`${baseUrl}/portal/athletes/bulk-nominate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form1.toString()
    });
    assert.equal(res1.status, 400);

    // Invalid coach mobile
    const form2 = new URLSearchParams();
    form2.append('school_name', 'St. Peters Yoga School');
    form2.append('coach_name', 'Coach Ravi');
    form2.append('coach_mobile', '12345');
    const res2 = await fetch(`${baseUrl}/portal/athletes/bulk-nominate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form2.toString()
    });
    assert.equal(res2.status, 400);

    // Malformed JSON in students
    const form3 = new URLSearchParams();
    form3.append('school_name', 'St. Peters Yoga School');
    form3.append('coach_name', 'Coach Ravi');
    form3.append('coach_mobile', '9876543210');
    form3.append('district', 'Hyderabad');
    form3.append('students', 'broken-json-array');
    const res3 = await fetch(`${baseUrl}/portal/athletes/bulk-nominate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form3.toString()
    });
    assert.equal(res3.status, 400);

    // Student validation failure (invalid dob in student record)
    const form4 = new URLSearchParams();
    form4.append('school_name', 'St. Peters Yoga School');
    form4.append('coach_name', 'Coach Ravi');
    form4.append('coach_mobile', '9876543210');
    form4.append('district', 'Hyderabad');
    form4.append('students', JSON.stringify([
      { firstName: 'A', lastName: 'B', dob: 'invalid-dob', gender: 'Female', aadhaarLast4: '1234' }
    ]));
    const res4 = await fetch(`${baseUrl}/portal/athletes/bulk-nominate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form4.toString()
    });
    assert.equal(res4.status, 400);
    const body4 = await res4.json();
    assert.ok(body4.error.includes('Student #1'));

    // Valid bulk delegation submission
    const formValid = new URLSearchParams();
    formValid.append('school_name', 'Telangana Sports School');
    formValid.append('coach_name', 'Coach Krishna');
    formValid.append('coach_mobile', '9876543210');
    formValid.append('district', 'Hyderabad');
    formValid.append('students', JSON.stringify([
      {
        firstName: 'TestValidStudent',
        lastName: 'One',
        dob: '2011-08-20',
        gender: 'Female',
        aadhaarLast4: '5566',
        events: ['Traditional Yogasana']
      }
    ]));
    const resValid = await fetch(`${baseUrl}/portal/athletes/bulk-nominate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formValid.toString()
    });
    assert.equal(resValid.status, 201);
    const validData = await resValid.json();
    assert.equal(validData.success, true);
    assert.equal(validData.count, 1);

    // Clean up created students
    if (validData.athletes?.[0]?._id) {
      await Athlete.deleteOne({ _id: validData.athletes[0]._id });
    }
  });

  // --- Endpoint: PATCH /portal/athletes/:id/status ---
  test('PATCH /portal/athletes/:id/status rejects invalid statuses and field injection', async () => {
    // Invalid status enum
    const res1 = await fetch(`${baseUrl}/portal/athletes/${testAthleteId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${secretaryToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'INVALID_STATUS' })
    });
    assert.equal(res1.status, 400);
    const body1 = await res1.json();
    assert.ok(body1.error.includes('Invalid status'));

    // Injected unexpected fields (e.g. attempting to change district or chestNumber via status patch)
    const res2 = await fetch(`${baseUrl}/portal/athletes/${testAthleteId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${secretaryToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'Verified', district: 'Warangal', chestNumber: 'HACK-001' })
    });
    assert.equal(res2.status, 400);
    const body2 = await res2.json();
    assert.ok(body2.error.includes('Unexpected field'));

    // Valid status update
    const res3 = await fetch(`${baseUrl}/portal/athletes/${testAthleteId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${secretaryToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'Verified', remarks: 'Documents scrutinized and approved.' })
    });
    assert.equal(res3.status, 200);
    const body3 = await res3.json();
    assert.equal(body3.status, 'Verified');
  });

  // --- Endpoint: GET /uploads/:filename ---
  test('GET /uploads/:filename blocks path traversal and disallowed extensions', async () => {
    // Path traversal attempt
    const res1 = await fetch(`${baseUrl}/uploads/..%2f..%2fpackage.json`);
    assert.equal(res1.status, 400);

    // Disallowed extension
    const res2 = await fetch(`${baseUrl}/uploads/malicious_payload.exe`);
    assert.equal(res2.status, 400);

    // Valid safe filename format (returns 404 because file doesn't exist on disk, but passes validation without 400)
    const res3 = await fetch(`${baseUrl}/uploads/nonexistent_sample_doc.jpg`);
    assert.equal(res3.status, 404);
  });
});
