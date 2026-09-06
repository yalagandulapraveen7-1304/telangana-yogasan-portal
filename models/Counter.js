/**
 * Atomic Sequence Counter Model
 * Provides high-performance, atomic numbering for athlete chest numbers, orders, and receipts.
 * Eliminates concurrency race conditions and duplicate assignments.
 */

'use strict';

const mongoose = require('mongoose');

const CounterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // e.g., "chest_Hyderabad_Junior"
    seq: { type: Number, default: 0, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Counter || mongoose.model('Counter', CounterSchema, 'counters');
