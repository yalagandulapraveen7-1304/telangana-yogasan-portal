/**
 * Database & Backend Performance Test Suite
 * Validates connection pooling, index usage (explain plan), atomic concurrency,
 * server pagination headers, and field projection.
 */

'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const app = require('../server');
const Athlete = require('../models/Athlete');
const Counter = require('../models/Counter');
const { JWT_SECRET } = require('../config/constants');
const { connectDB, POOL_OPTIONS } = require('../config/db');
const { getNextChestNumber, getNextChestNumbersBatch } = require('../utils/counter');

let server;
let baseUrl;

const testDistrict = 'Warangal';
const testCategory = 'Sub-Junior';

const testToken = jwt.sign(
  { id: 'perf_sec_war', email: 'sec_war@telanganayoga.org', role: 'SECRETARY', district: testDistrict },
  JWT_SECRET,
  { expiresIn: '1h', algorithm: 'HS256' }
);

const createdAthleteIds = [];

before(async () => {
  await connectDB();
  await Athlete.init(); // Ensure indexes are built

  // Seed test records for pagination and projection tests
  for (let i = 1; i <= 8; i++) {
    const ath = await Athlete.create({
      firstName: `PerfAthlete${i}`,
      lastName: 'Runner',
      dob: new Date('2012-04-10'),
      gender: i % 2 === 0 ? 'Female' : 'Male',
      district: testDistrict,
      category: testCategory,
      chestNumber: `WAR-SJ-P${String(i).padStart(4, '0')}`,
      status: i % 2 === 0 ? 'Verified' : 'Submitted',
      residentialAddress: '123 Performance Lane, Warangal',
      dobProofPath: '/uploads/proof.pdf',
      paymentDetails: {
        orderId: `order_perf_${i}`,
        paymentId: `pay_perf_${i}`,
        amount: 500,
        status: 'PAID'
      }
    });
    createdAthleteIds.push(ath._id);
  }

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
  // Cleanup test counter
  await Counter.deleteMany({ _id: { $regex: /perf|warangal|sub-junior/i } });

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await mongoose.disconnect();
});

describe('Database Connection Pooling & Configuration', () => {
  test('POOL_OPTIONS defines robust connection pool bounds and timeouts', () => {
    assert.ok(POOL_OPTIONS.maxPoolSize >= 10, 'maxPoolSize should be at least 10 for concurrent throughput');
    assert.ok(POOL_OPTIONS.minPoolSize >= 2, 'minPoolSize should maintain warm idle connections');
    assert.ok(POOL_OPTIONS.serverSelectionTimeoutMS > 0, 'serverSelectionTimeoutMS must be defined');
    assert.ok(POOL_OPTIONS.socketTimeoutMS > 0, 'socketTimeoutMS must be defined');
  });

  test('Mongoose is connected with active connection pool', () => {
    assert.strictEqual(mongoose.connection.readyState, 1, 'Mongoose connection should be connected (readyState 1)');
  });
});

describe('Index Optimization & Query Planner Verification', () => {
  test('Indexes are properly defined on Athlete model', async () => {
    const indexes = await Athlete.collection.indexes();
    const indexNames = indexes.map((idx) => idx.name);

    assert.ok(
      indexNames.some((name) => name.includes('district') && name.includes('createdAt')),
      'Should have compound index on { district: 1, createdAt: -1 }'
    );
    assert.ok(
      indexNames.some((name) => name.includes('district') && name.includes('status') && name.includes('createdAt')),
      'Should have compound index on { district: 1, status: 1, createdAt: -1 }'
    );
    assert.ok(
      indexNames.some((name) => name.includes('chestNumber')),
      'Should have index on chestNumber'
    );
  });

  test('Query plan for district list sorted by date uses IXSCAN without in-memory SORT', async () => {
    const plan = await Athlete.find({ district: testDistrict })
      .sort({ createdAt: -1 })
      .explain('queryPlanner');

    const winningPlan = plan.queryPlanner?.winningPlan;
    assert.ok(winningPlan, 'Query plan should have a winningPlan');

    // Recursively check if IXSCAN was used and no blocking SORT stage exists
    function inspectStages(stage) {
      const stages = [stage.stage];
      if (stage.inputStage) stages.push(...inspectStages(stage.inputStage));
      if (stage.inputStages) stage.inputStages.forEach((s) => stages.push(...inspectStages(s)));
      return stages;
    }

    const stages = inspectStages(winningPlan);
    assert.ok(stages.includes('IXSCAN'), 'Query must execute an index scan (IXSCAN)');
    assert.ok(!stages.includes('SORT'), 'Query must not require a blocking in-memory SORT stage');
  });

  test('Query plan for district and status sorted by date uses compound IXSCAN', async () => {
    const plan = await Athlete.find({ district: testDistrict, status: 'Verified' })
      .sort({ createdAt: -1 })
      .explain('queryPlanner');

    const winningPlan = plan.queryPlanner?.winningPlan;
    assert.ok(winningPlan, 'Query plan should have a winningPlan');

    function inspectStages(stage) {
      const stages = [stage.stage];
      if (stage.inputStage) stages.push(...inspectStages(stage.inputStage));
      if (stage.inputStages) stage.inputStages.forEach((s) => stages.push(...inspectStages(s)));
      return stages;
    }

    const stages = inspectStages(winningPlan);
    assert.ok(stages.includes('IXSCAN'), 'Query must execute an index scan (IXSCAN)');
    assert.ok(!stages.includes('SORT'), 'Query must not require a blocking in-memory SORT stage');
  });
});

describe('Atomic Concurrency & Sequence Counter', () => {
  test('Concurrent chest number generations produce unique, non-colliding numbers', async () => {
    const district = 'Khammam';
    const category = 'Junior';

    // 15 simultaneous calls
    const promises = Array.from({ length: 15 }, () => getNextChestNumber(district, category));
    const results = await Promise.all(promises);

    assert.strictEqual(results.length, 15, 'Should return 15 chest numbers');

    // Verify all 15 are distinct (no duplicate race conditions)
    const uniqueNumbers = new Set(results);
    assert.strictEqual(uniqueNumbers.size, 15, 'All 15 generated chest numbers must be unique');

    // Verify formatting: KHA-JUN-XXXX
    results.forEach((num) => {
      assert.match(num, /^KHA-JR-\d+$/, `Chest number ${num} should match standard format`);
    });

    // Clean up counter
    await Counter.deleteOne({ _id: `chest_khammam_junior` });
  });

  test('getNextChestNumbersBatch atomically allocates sequential numbers', async () => {
    const district = 'Nalgonda';
    const category = 'Senior';
    const count = 10;

    const batch = await getNextChestNumbersBatch(district, category, count);
    assert.strictEqual(batch.length, count, `Should return ${count} numbers`);

    const uniqueBatch = new Set(batch);
    assert.strictEqual(uniqueBatch.size, count, 'All batch chest numbers must be unique');

    // Verify sequential ordering
    const seqNumbers = batch.map((n) => parseInt(n.split('-')[2], 10));
    for (let i = 1; i < seqNumbers.length; i++) {
      assert.strictEqual(seqNumbers[i], seqNumbers[i - 1] + 1, 'Batch chest numbers must be strictly consecutive');
    }

    // Clean up counter
    await Counter.deleteOne({ _id: `chest_nalgonda_senior` });
  });
});

describe('Server-Side Pagination & Response Projection', () => {
  test('GET /portal/athletes/list returns paginated results with pagination headers', async () => {
    const limit = 4;
    const res = await fetch(`${baseUrl}/portal/athletes/list?page=1&limit=${limit}`, {
      headers: { Authorization: `Bearer ${testToken}` }
    });

    assert.strictEqual(res.status, 200, 'Endpoint should return 200 OK');

    // Pagination headers
    const totalCount = parseInt(res.headers.get('x-total-count'), 10);
    const page = parseInt(res.headers.get('x-page'), 10);
    const perPage = parseInt(res.headers.get('x-per-page'), 10);
    const totalPages = parseInt(res.headers.get('x-total-pages'), 10);

    assert.ok(totalCount >= 8, `x-total-count should be at least 8 (got ${totalCount})`);
    assert.strictEqual(page, 1, 'x-page should be 1');
    assert.strictEqual(perPage, limit, `x-per-page should be ${limit}`);
    assert.strictEqual(totalPages, Math.ceil(totalCount / limit), 'x-total-pages should match ceil(total/limit)');

    const data = await res.json();
    assert.ok(Array.isArray(data), 'Response must be a JSON array to preserve frontend contract');
    assert.strictEqual(data.length, limit, `Returned data array length should be ${limit}`);
  });

  test('GET /portal/athletes/list applies lean projection (omits heavy fields)', async () => {
    const res = await fetch(`${baseUrl}/portal/athletes/list?page=1&limit=5`, {
      headers: { Authorization: `Bearer ${testToken}` }
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.length > 0, 'Should have returned test records');

    const first = data[0];
    // Required fields are present
    assert.ok(first._id, 'Athlete _id must be present');
    assert.ok(first.firstName, 'firstName must be present');
    assert.ok(first.lastName, 'lastName must be present');
    assert.ok(first.chestNumber, 'chestNumber must be present');
    assert.ok(first.status, 'status must be present');

    // Heavy fields excluded in projection
    assert.strictEqual(first.paymentDetails, undefined, 'paymentDetails must be excluded in list projection');
    assert.strictEqual(first.residentialAddress, undefined, 'residentialAddress must be excluded in list projection');
    assert.strictEqual(first.dobProofPath, undefined, 'dobProofPath must be excluded in list projection');
  });

  test('GET /portal/athletes/list default parameters return full district dataset cleanly', async () => {
    const res = await fetch(`${baseUrl}/portal/athletes/list`, {
      headers: { Authorization: `Bearer ${testToken}` }
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data), 'Returns array');
    assert.ok(data.length >= 8, 'Default returns all seeded records up to limit');
  });
});
