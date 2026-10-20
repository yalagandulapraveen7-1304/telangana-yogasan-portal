/**
 * Admin Audit Log Mongoose Model
 * Tracks critical administrative actions for accountability and forensic inspection.
 */

'use strict';

const mongoose = require('mongoose');

const AdminAuditLogSchema = new mongoose.Schema(
  {
    actorEmail: { type: String, required: true, trim: true },
    actorRole: { type: String, required: true, trim: true },
    actorDistrict: { type: String, default: 'ALL_DISTRICTS', trim: true },
    action: {
      type: String,
      required: true,
      trim: true
    },
    targetType: {
      type: String,
      enum: ['COMPETITION', 'PHOTO', 'NOTICE', 'ATHLETE', 'SYSTEM'],
      required: true
    },
    targetId: { type: String, default: '', trim: true },
    ipAddress: { type: String, default: '', trim: true },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: () => new Date(), index: true }
  },
  { timestamps: false }
);

AdminAuditLogSchema.index({ createdAt: -1 });
AdminAuditLogSchema.index({ actorEmail: 1, createdAt: -1 });

module.exports = mongoose.models.AdminAuditLog || mongoose.model('AdminAuditLog', AdminAuditLogSchema, 'admin_audit_logs');
