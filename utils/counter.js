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
function getCounterId(district, category, competitionId = null) {
  const cleanDist = String(district || 'Hyderabad').trim().toLowerCase().replace(/\s+district$/i, '');
  const cleanCat = String(category || 'Junior').trim().toLowerCase();
  const compSuffix = competitionId ? `_${String(competitionId).trim().toLowerCase()}` : '';
  return `chest_${cleanDist}_${cleanCat}${compSuffix}`;
}

/**
 * Ensures the counter document is seeded if existing records already exist.
 */
async function syncCounterBaseline(counterId, district, category, competitionId = null) {
  const existing = await Counter.findById(counterId);
  if (!existing) {
    const query = { district, category };
    if (competitionId) query.competitionId = competitionId;
    const currentCount = await Athlete.countDocuments(query);
    try {
      await Counter.create({ _id: counterId, seq: currentCount });
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }
}

/**
 * Atomically generates the next chest number for a given district, category, and competition.
 * Thread-safe and concurrency-safe across multiple server processes.
 */
async function getNextChestNumber(district, category, competitionId = null) {
  const counterId = getCounterId(district, category, competitionId);
  await syncCounterBaseline(counterId, district, category, competitionId);

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
 * @param {string} [competitionId] - Optional competition identifier
 * @returns {Promise<string[]>} Array of formatted chest numbers
 */
async function getNextChestNumbersBatch(district, category, count, competitionId = null) {
  if (count <= 0) return [];
  const counterId = getCounterId(district, category, competitionId);
  await syncCounterBaseline(counterId, district, category, competitionId);

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
