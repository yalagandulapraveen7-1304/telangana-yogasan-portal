/**
 * Unit Tests - Atomic Sequence Counter Utility (utils/counter.js)
 * Tests thread-safe atomic sequence increments and bulk contiguous reservation.
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { connectDB } = require('../../config/db');
const Counter = require('../../models/Counter');
const { getNextChestNumber, getNextChestNumbersBatch } = require('../../utils/counter');

const TEST_DISTRICT = 'Khammam';
const TEST_CATEGORY = 'Junior';
const TEST_COUNTER_ID = 'chest_khammam_junior';

describe('Unit Tests: Atomic Sequence Counter', () => {

  before(async () => {
    await connectDB();
    // Clean up test counter if exists
    await Counter.deleteOne({ _id: TEST_COUNTER_ID });
  });

  after(async () => {
    await Counter.deleteOne({ _id: TEST_COUNTER_ID });
    await mongoose.disconnect();
  });

  it('increments sequence atomically for single chest number generation', async () => {
    const chest1 = await getNextChestNumber(TEST_DISTRICT, TEST_CATEGORY);
    const chest2 = await getNextChestNumber(TEST_DISTRICT, TEST_CATEGORY);

    assert.ok(chest1.startsWith('KHA-JR-'));
    assert.ok(chest2.startsWith('KHA-JR-'));

    const num1 = parseInt(chest1.split('-')[2], 10);
    const num2 = parseInt(chest2.split('-')[2], 10);

    assert.equal(num2, num1 + 1, 'Sequential numbers must increment by exactly 1');
  });

  it('allocates contiguous blocks of numbers for bulk delegations without gaps', async () => {
    const batch = await getNextChestNumbersBatch(TEST_DISTRICT, TEST_CATEGORY, 5);

    assert.equal(batch.length, 5, 'Must return exactly 5 chest numbers');

    for (let i = 0; i < batch.length - 1; i++) {
      const current = parseInt(batch[i].split('-')[2], 10);
      const next = parseInt(batch[i + 1].split('-')[2], 10);
      assert.equal(next, current + 1, 'Batch chest numbers must be strictly contiguous');
    }
  });

  it('returns empty array when count <= 0 in batch allocation', async () => {
    const empty1 = await getNextChestNumbersBatch(TEST_DISTRICT, TEST_CATEGORY, 0);
    const empty2 = await getNextChestNumbersBatch(TEST_DISTRICT, TEST_CATEGORY, -3);

    assert.deepEqual(empty1, []);
    assert.deepEqual(empty2, []);
  });
});
