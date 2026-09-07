/**
 * API Integration Tests - Duplicate Records & Concurrency Guard
 * Tests collision avoidance under high concurrency and duplicate handling.
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const app = require('../../server');
const Athlete = require('../../models/Athlete');
const { getNextChestNumber, getNextChestNumbersBatch } = require('../../utils/counter');
const { connectDB } = require('../../config/db');

let server;
let baseUrl;

const district = 'Siddipet';
const category = 'Senior';

describe('Integration Tests: Duplicate Prevention & Concurrency Guard', () => {

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
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.disconnect();
  });

  it('guarantees 100% unique chest numbers under rapid concurrent generation', async () => {
    const concurrentRequests = 15;
    const promises = [];

    for (let i = 0; i < concurrentRequests; i++) {
      promises.push(getNextChestNumber(district, category));
    }

    const generated = await Promise.all(promises);
    assert.equal(generated.length, concurrentRequests);

    // Verify all generated chest numbers are unique
    const uniqueSet = new Set(generated);
    assert.equal(uniqueSet.size, concurrentRequests, 'All concurrent chest numbers must be unique with zero collisions');

    generated.forEach((num) => {
      assert.ok(num.startsWith('SID-SR-'));
    });
  });

  it('maintains non-overlapping sequences between single and batch allocations', async () => {
    // 1. Single allocation
    const single1 = await getNextChestNumber(district, category);

    // 2. Batch allocation of 5
    const batch = await getNextChestNumbersBatch(district, category, 5);

    // 3. Single allocation
    const single2 = await getNextChestNumber(district, category);

    const allAllocated = [single1, ...batch, single2];
    const uniqueSet = new Set(allAllocated);

    assert.equal(uniqueSet.size, 7, 'All single and batch numbers must be distinct');

    const s1Num = parseInt(single1.split('-')[2], 10);
    const bStart = parseInt(batch[0].split('-')[2], 10);
    const bEnd = parseInt(batch[4].split('-')[2], 10);
    const s2Num = parseInt(single2.split('-')[2], 10);

    assert.equal(bStart, s1Num + 1);
    assert.equal(s2Num, bEnd + 1);
  });
});
