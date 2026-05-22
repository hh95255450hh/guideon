const { v4: uuidv4 } = require('uuid');
const SupabaseDB = require('../models/SupabaseDB');
const auditLog = new SupabaseDB('admin_audit_log');

/**
 * Record an admin action to the audit trail.
 * Fire-and-forget — never blocks the request flow.
 *
 * @param {object} req - Express request (for IP, user-agent, session)
 * @param {object} entry
 * @param {string} entry.action       - e.g. 'verifyGuide', 'deleteUser', 'cancelBooking'
 * @param {string} [entry.targetType] - e.g. 'user', 'booking', 'review'
 * @param {string} [entry.targetId]
 * @param {object} [entry.details]    - additional context (old/new values, reason, etc.)
 */
async function logAction(req, entry) {
  try {
    await auditLog.insert({
      id: 'audit-' + uuidv4().slice(0, 12),
      adminId:   req.session?.userId || 'unknown',
      adminName: req.user?.fullName || 'unknown',
      action:    entry.action,
      targetType: entry.targetType || null,
      targetId:   entry.targetId || null,
      details:    entry.details || {},
      ip:         req.ip || req.headers['x-forwarded-for']?.split(',')[0] || null,
      userAgent:  req.headers['user-agent'] || null,
      createdAt:  new Date().toISOString(),
    });
  } catch (e) {
    // Never throw — audit failures shouldn't break user actions
    console.error('[audit] failed:', e.message);
  }
}

module.exports = { logAction };
