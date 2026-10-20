/**
 * Audit Logging Helper
 * Records administrative actions asynchronously without breaking the primary request lifecycle.
 */

'use strict';

const AdminAuditLog = require('../models/AdminAuditLog');

async function logAdminAction({ req, action, targetType, targetId, details = {} }) {
  try {
    const actorEmail = req?.user?.email || 'system@telanganayoga.org';
    const actorRole = req?.user?.role || 'SYSTEM';
    const actorDistrict = req?.user?.district || 'ALL_DISTRICTS';
    const ipAddress = req?.ip || req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || '';

    await AdminAuditLog.create({
      actorEmail,
      actorRole,
      actorDistrict,
      action,
      targetType,
      targetId: String(targetId || ''),
      ipAddress: String(ipAddress),
      details
    });
  } catch (err) {
    // Non-blocking log failure
    console.error('Failed to write admin audit log:', err.message);
  }
}

module.exports = {
  logAdminAction
};
