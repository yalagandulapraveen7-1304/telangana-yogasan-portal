/**
 * Photo Mongoose Model
 * Manages competition photo gallery items, cover photos, ordering, and publication states.
 */

'use strict';

const mongoose = require('mongoose');

const PhotoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    caption: { type: String, default: '', trim: true },
    altText: { type: String, default: '', trim: true },
    filePath: { type: String, required: true },
    thumbnailPath: { type: String, default: '' },
    competitionId: {
      type: String,
      default: 'state-championship-2026',
      trim: true,
      lowercase: true
    },
    district: { type: String, default: 'ALL', trim: true },
    isCover: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
      default: 'PUBLISHED'
    },
    uploadedBy: { type: String, default: 'admin@telanganayoga.org' },
    imageData: { type: Buffer, select: false },
    thumbnailData: { type: Buffer, select: false },
    mimeType: { type: String, default: 'image/jpeg' }
  },
  { timestamps: true }
);

PhotoSchema.index({ status: 1, competitionId: 1, order: 1 });
PhotoSchema.index({ status: 1, district: 1 });

module.exports = mongoose.models.Photo || mongoose.model('Photo', PhotoSchema, 'photos');
