/**
 * End-to-End (E2E) Tests - School Delegation Bulk Registration Workflow
 * Tests the entire school journey: loading school nomination page -> bulk submission -> public admit card verification.
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

describe('E2E Tests: School Delegation Registration Workflow', () => {

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

  it('completes the institutional registration and verification journey', async () => {
    // Step 1: School coach loads the delegation page
    const pageRes = await fetch(`${baseUrl}/school-nominate`);
    assert.equal(pageRes.status, 200);
    const html = await pageRes.text();
    assert.ok(html.includes('School &amp; Academy Athlete Nomination'));

    // Step 2: Submits delegation with 2 student athletes
    const delegation = {
      school_name: 'St. Marys High School',
      coach_name: 'Father Joseph',
      coach_mobile: '9849098765',
      district: 'Nalgonda',
      students: JSON.stringify([
        {
          firstName: 'Rahul',
          lastName: 'Chary',
          dob: '2010-07-20', // Junior
          gender: 'Male',
          aadhaarLast4: '2233',
          events: ['Traditional Yogasana']
        },
        {
          firstName: 'Pranitha',
          lastName: 'M',
          dob: '2012-08-14', // Sub-Junior
          gender: 'Female',
          aadhaarLast4: '4455',
          events: ['Traditional Yogasana', 'Free Flow']
        }
      ])
    };

    const submitRes = await fetch(`${baseUrl}/portal/athletes/bulk-nominate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(delegation)
    });

    assert.equal(submitRes.status, 201);
    const data = await submitRes.json();
    assert.equal(data.success, true);
    assert.equal(data.count, 2);

    data.athletes.forEach((ath) => {
      createdAthleteIds.push(ath.id || ath._id);
      assert.ok(ath.chestNumber);
      assert.ok(ath.chestNumber.startsWith('NAL-'));
    });

    // Step 3: Public can immediately retrieve each student's admit card by chest number
    const rahulChest = data.athletes[0].chestNumber;
    const cardRes = await fetch(`${baseUrl}/portal/athletes/${rahulChest}/public-card`);
    assert.equal(cardRes.status, 200);

    const cardData = await cardRes.json();
    assert.equal(cardData.firstName, 'Rahul');
    assert.equal(cardData.institutionName, 'St. Marys High School');
    assert.equal(cardData.district, 'Nalgonda');
    assert.equal(cardData.status, 'Submitted');
  });
});
