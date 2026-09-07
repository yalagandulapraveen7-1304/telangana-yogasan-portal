/**
 * API Integration Tests - Bulk School Nomination
 * Tests institutional delegation submissions, atomic batch chest numbers, and error handling.
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const app = require('../../server');
const Athlete = require('../../models/Athlete');
const { connectDB } = require('../../config/db');

let server;
let baseUrl;

const createdAthleteIds = [];

describe('Integration Tests: Bulk School Delegation API', () => {

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

  it('registers a batch of student athletes and assigns sequential chest numbers', async () => {
    const students = [
      {
        firstName: 'Aarav',
        lastName: 'Reddy',
        dob: '2012-04-10', // Sub-Junior
        gender: 'Male',
        aadhaarLast4: '1122',
        events: ['Traditional Yogasana']
      },
      {
        firstName: 'Diya',
        lastName: 'Goud',
        dob: '2010-09-15', // Junior
        gender: 'Female',
        aadhaarLast4: '3344',
        events: ['Traditional Yogasana', 'Artistic Yogasana Solo']
      },
      {
        firstName: 'Karthik',
        lastName: 'Rao',
        dob: '2009-11-20', // Junior
        gender: 'Male',
        aadhaarLast4: '5566',
        events: ['Traditional Yogasana']
      }
    ];

    const payload = {
      school_name: 'Kakatiya Model School',
      coach_name: 'P. Srinivas Rao',
      coach_mobile: '9848012345',
      district: 'Warangal',
      students: JSON.stringify(students)
    };

    const res = await fetch(`${baseUrl}/portal/athletes/bulk-nominate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.count, 3);
    assert.equal(data.athletes.length, 3);

    data.athletes.forEach((ath) => {
      createdAthleteIds.push(ath.id || ath._id);
      assert.ok(ath.chestNumber, 'Each athlete must receive a chest number');
      assert.ok(ath.chestNumber.startsWith('WAR-'));
    });

    // Check contiguous numbering for the 3 Juniors (Aryan, Diya, Karthik)
    const juniorAthletes = data.athletes.filter((a) => a.chestNumber.includes('-JR-'));
    assert.equal(juniorAthletes.length, 3);
    const num1 = parseInt(juniorAthletes[0].chestNumber.split('-')[2], 10);
    const num2 = parseInt(juniorAthletes[1].chestNumber.split('-')[2], 10);
    const num3 = parseInt(juniorAthletes[2].chestNumber.split('-')[2], 10);
    assert.equal(num2, num1 + 1, 'Batch allocation must generate strictly contiguous numbers');
    assert.equal(num3, num2 + 1, 'Batch allocation must generate strictly contiguous numbers');

    // Verify database record has school name and coach info
    const dbRecord = await Athlete.findById(juniorAthletes[0].id || juniorAthletes[0]._id).lean();
    assert.equal(dbRecord.institutionName, 'Kakatiya Model School');
    assert.equal(dbRecord.coachName, 'P. Srinivas Rao');
    assert.equal(dbRecord.coachMobile, '9848012345');
    assert.equal(dbRecord.district, 'Warangal');
  });

  it('rejects bulk delegation when student record has invalid Aadhaar or missing names', async () => {
    const invalidStudents = [
      {
        firstName: 'ValidName',
        lastName: 'Good',
        dob: '2010-01-01',
        gender: 'Male',
        aadhaarLast4: 'INVALID_AADHAAR', // Non-numeric
        events: ['Traditional Yogasana']
      }
    ];

    const res = await fetch(`${baseUrl}/portal/athletes/bulk-nominate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        school_name: 'Test School',
        coach_name: 'Coach Test',
        coach_mobile: '9848099999',
        district: 'Hyderabad',
        students: JSON.stringify(invalidStudents)
      })
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.ok(data.error.includes('Aadhaar'));
  });

  it('rejects delegations exceeding the maximum batch limit of 50 students', async () => {
    const massiveList = Array(51).fill({
      firstName: 'Test',
      lastName: 'Student',
      dob: '2010-01-01',
      gender: 'Female',
      aadhaarLast4: '0000',
      events: ['Traditional Yogasana']
    });

    const res = await fetch(`${baseUrl}/portal/athletes/bulk-nominate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        school_name: 'Mega Academy',
        coach_name: 'Director',
        coach_mobile: '9848011111',
        district: 'Hyderabad',
        students: JSON.stringify(massiveList)
      })
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.ok(data.error.includes('exceeds maximum limit'));
  });
});
