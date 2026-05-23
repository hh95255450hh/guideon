const { hasPermission } = require('../config/permissions');

/**
 * Middleware factory: require a specific permission.
 *
 * Usage:
 *   router.delete('/users/:id', requirePermission('delete_users'), handler);
 *
 * Allows: admin (always) + staff with the permission.
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.session?.userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated.' });
    }
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not loaded.' });
    }
    if (req.user.isSuspended) {
      return res.status(403).json({ success: false, message: 'Your account is suspended.' });
    }
    if (!hasPermission(req.user, permission)) {
      return res.status(403).json({
        success: false,
        message: `Permission denied. This action requires: ${permission}`,
      });
    }
    next();
  };
}

/**
 * Allow admin OR staff (any staff, regardless of specific permission).
 * Used for routes that all staff can access (like /me, /audit-log for own actions).
 */
function requireAdminOrStaff(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated.' });
  }
  const t = req.session.userType;
  if (t !== 'admin' && t !== 'staff') {
    return res.status(403).json({ success: false, message: 'Admin or staff access required.' });
  }
  next();
}

module.exports = { requirePermission, requireAdminOrStaff };
