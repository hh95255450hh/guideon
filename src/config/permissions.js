/**
 * Permission system for staff & admin users.
 *
 * super_admin (the userType='admin') ALWAYS has all permissions.
 * staff users have only the permissions explicitly granted to them
 * (either via their staffRole template or custom permissions array).
 */

// All available permissions (granular)
const PERMISSIONS = {
  // User management
  VIEW_USERS:        'view_users',
  EDIT_USERS:        'edit_users',
  SUSPEND_USERS:     'suspend_users',
  DELETE_USERS:      'delete_users',
  RESET_PASSWORDS:   'reset_passwords',

  // Guide / Company verification
  VERIFY_GUIDES:     'verify_guides',
  VERIFY_COMPANIES:  'verify_companies',

  // Bookings
  VIEW_BOOKINGS:     'view_bookings',
  CANCEL_BOOKINGS:   'cancel_bookings',
  COMPLETE_BOOKINGS: 'complete_bookings',

  // Moderation
  DELETE_REVIEWS:    'delete_reviews',
  DELETE_MESSAGES:   'delete_messages',

  // Communication
  BROADCAST_EMAIL:   'broadcast_email',

  // Reports & audit
  VIEW_AUDIT_LOG:    'view_audit_log',
  EXPORT_DATA:       'export_data',
  VIEW_ANALYTICS:    'view_analytics',

  // Staff management
  MANAGE_STAFF:      'manage_staff',
};

// Predefined role templates
const ROLES = {
  // Customer support — handle inquiries and basic moderation
  support: {
    label: 'Customer Support',
    description: 'Handle user inquiries, view bookings, suspend abusive accounts',
    permissions: [
      'view_users', 'suspend_users', 'view_bookings',
      'view_audit_log', 'delete_messages',
    ],
  },

  // Content moderator — review and remove inappropriate content
  moderator: {
    label: 'Content Moderator',
    description: 'Review reviews, messages, and Q&A; suspend bad actors',
    permissions: [
      'view_users', 'suspend_users',
      'delete_reviews', 'delete_messages',
      'view_audit_log',
    ],
  },

  // Guide verifier — approve guides and companies
  verifier: {
    label: 'Guide Verifier',
    description: 'Verify guide credentials and approve company applications',
    permissions: [
      'view_users', 'edit_users',
      'verify_guides', 'verify_companies',
      'view_audit_log',
    ],
  },

  // Marketing — send broadcasts and view analytics
  marketing: {
    label: 'Marketing',
    description: 'Send email campaigns, view analytics, export user data',
    permissions: [
      'view_users', 'view_analytics',
      'broadcast_email', 'export_data',
    ],
  },

  // Finance — bookings, revenue, exports
  finance: {
    label: 'Finance',
    description: 'View all bookings, cancel/refund, export financial data',
    permissions: [
      'view_users', 'view_bookings',
      'cancel_bookings', 'complete_bookings',
      'view_analytics', 'export_data',
      'view_audit_log',
    ],
  },

  // Manager — broad operational control (but not staff management)
  manager: {
    label: 'Operations Manager',
    description: 'Most operational tasks except managing other staff',
    permissions: [
      'view_users', 'edit_users', 'suspend_users',
      'verify_guides', 'verify_companies',
      'view_bookings', 'cancel_bookings', 'complete_bookings',
      'delete_reviews', 'delete_messages',
      'broadcast_email',
      'view_audit_log', 'view_analytics', 'export_data',
    ],
  },
};

/**
 * Check if a user has a specific permission.
 * super_admin (userType='admin') always returns true.
 */
function hasPermission(user, permission) {
  if (!user) return false;
  if (user.userType === 'admin') return true; // super admin
  if (user.userType !== 'staff') return false;
  const perms = Array.isArray(user.permissions) ? user.permissions : [];
  return perms.includes(permission);
}

/**
 * Get the effective permissions for a user.
 * For super admin: all permissions.
 * For staff: their stored permissions array.
 */
function getEffectivePermissions(user) {
  if (!user) return [];
  if (user.userType === 'admin') return Object.values(PERMISSIONS);
  return Array.isArray(user.permissions) ? user.permissions : [];
}

module.exports = { PERMISSIONS, ROLES, hasPermission, getEffectivePermissions };
