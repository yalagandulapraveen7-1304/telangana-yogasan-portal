/**
 * Competition Mongoose Model
 * Manages configuration for state, district, school, and open Yogasana tournaments.
 */

'use strict';

const mongoose = require('mongoose');

const CompetitionSchema = new mongoose.Schema(
  {
    competitionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['STATE', 'DISTRICT', 'INTER_SCHOOL', 'NATIONAL_TRIALS', 'OPEN'],
      default: 'STATE'
    },
    description: { type: String, default: '', trim: true },
    venue: { type: String, default: 'Telangana State Sports Complex, Hyderabad', trim: true },
    startDate: { type: Date },
    endDate: { type: Date },
    regStartDate: { type: Date, default: () => new Date() },
    regEndDate: { type: Date },
    status: {
      type: String,
      enum: ['DRAFT', 'PUBLISHED', 'OPEN', 'CLOSED', 'ARCHIVED'],
      default: 'OPEN'
    },
    ageCutoffDate: {
      type: Date,
      default: () => new Date(new Date().getFullYear(), 11, 31)
    },
    minAge: { type: Number, default: 8 },
    maxAge: { type: Number, default: 100 },
    feePerEvent: { type: Number, default: 260 },
    currency: { type: String, default: 'INR' },
    disciplines: {
      type: [String],
      default: [
        'Traditional Yogasana',
        'Artistic Yogasana (Single)',
        'Artistic Yogasana (Pair)',
        'Rhythmic Yogasana (Pair)',
        'Free Flow'
      ]
    },
    categories: {
      type: [String],
      default: ['Sub-Junior', 'Junior', 'Senior']
    },
    districtsAllowed: {
      type: [String],
      default: ['ALL']
    },
    rulesDocumentPath: { type: String, default: '' },
    isDefault: { type: Boolean, default: false }
  },
  { timestamps: true }
);

CompetitionSchema.index({ status: 1, regEndDate: 1 });

module.exports = mongoose.models.Competition || mongoose.model('Competition', CompetitionSchema, 'competitions');
