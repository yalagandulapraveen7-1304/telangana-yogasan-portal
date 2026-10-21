/**
 * Notice / Circular Mongoose Model
 * Manages announcements, circulars, schedule updates, and homepage marquee ticker items.
 */

'use strict';

const mongoose = require('mongoose');

const NoticeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    summary: { type: String, default: '', trim: true },
    body: { type: String, default: '', trim: true },
    category: {
      type: String,
      enum: ['NOTICE', 'CIRCULAR', 'SCHEDULE_UPDATE', 'EVENT_NOTICE'],
      default: 'NOTICE'
    },
    attachmentPath: { type: String, default: '', trim: true },
    linkUrl: { type: String, default: '', trim: true },
    linkLabel: { type: String, default: 'Download Document', trim: true },
    competitionId: { type: String, default: '', trim: true, lowercase: true },
    district: { type: String, default: 'ALL', trim: true },
    startDate: { type: Date, default: () => new Date() },
    endDate: { type: Date },
    order: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'EXPIRED', 'ARCHIVED'],
      default: 'PUBLISHED'
    },
    isMarquee: { type: Boolean, default: false },
    marqueeOrder: { type: Number, default: 0 },
    uploadedBy: { type: String, default: 'admin@telanganayoga.org' },
    fileData: { type: Buffer, select: false },
    mimeType: { type: String, default: 'application/pdf' }
  },
  { timestamps: true }
);

NoticeSchema.index({ status: 1, isMarquee: 1, marqueeOrder: 1 });
NoticeSchema.index({ status: 1, category: 1, order: 1 });
NoticeSchema.index({ status: 1, district: 1 });

module.exports = mongoose.models.Notice || mongoose.model('Notice', NoticeSchema, 'notices');
