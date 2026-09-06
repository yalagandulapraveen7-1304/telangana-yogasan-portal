/**
 * Atomic Sequence Counter Utility
 * Generates unique, non-colliding serial numbers using MongoDB atomic $inc operations.
 * Eliminates race conditions in athlete chest number assignment.
 */

'use strict';

const Counter = require('../models/Counter');
const Athlete = require('../models/Athlete');
const { formatChestNumber } = require('./category');

/**
 * Normalizes counter identifier key.
 */
function getCounterId(district, category) {
  const cleanDist = String(district || 'Hyderabad').trim().toLowerCase().replace(/\s+district$/i, '');
  const cleanCat = String(category || 'Junior').trim().toLowerCase();
  return `chest_${cleanDist}_${cleanCat}`;
}

/**
 * Ensures the counter document is seeded if existing records already exist.
 */
async function syncCounterBaseline(counterId, district, category) {
  const existing = await Counter.findById(counterId);
  if (!existing) {
    // Count existing records to initialize sequence properly
    const currentCount = await Athlete.countDocuments({ district, category });
    try {
      await Counter.create({ _id: counterId, seq: currentCount });
    } catch (err) {
      // Ignore duplicate key error in case of concurrent first-time init
      if (err.code !== 11000) throw err;
    }
  }
}

/**
 * Atomically generates the next chest number for a given district and category.
 * Thread-safe and concurrency-safe across multiple server processes.
 */
async function getNextChestNumber(district, category) {
  const counterId = getCounterId(district, category);
  await syncCounterBaseline(counterId, district, category);

  const counter = await Counter.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { returnDocument: 'after', upsert: true }
  );

  return formatChestNumber(district, category, counter.seq);
}

/**
 * Atomically reserves a batch of sequential chest numbers for bulk registrations.
 * Generates all numbers in a single atomic database operation.
 * @param {string} district
 * @param {string} category
 * @param {number} count - Number of sequential chest numbers to allocate
 * @returns {Promise<string[]>} Array of formatted chest numbers
 */
async function getNextChestNumbersBatch(district, category, count) {
  if (count <= 0) return [];
  const counterId = getCounterId(district, category);
  await syncCounterBaseline(counterId, district, category);

  const counter = await Counter.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: count } },
    { returnDocument: 'after', upsert: true }
  );

  const startSeq = counter.seq - count + 1;
  const chestNumbers = [];
  for (let i = 0; i < count; i++) {
    chestNumbers.push(formatChestNumber(district, category, startSeq + i));
  }
  return chestNumbers;
}

module.exports = {
  getNextChestNumber,
  getNextChestNumbersBatch
};
