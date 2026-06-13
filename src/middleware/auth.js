const SupabaseDB = require('../models/SupabaseDB');
const users = new SupabaseDB('users');

// Lightweight req.user loader — call early to make req.user available across handlers.
// Doesn't enforce auth, just hydrates if logged in.
exports.loadUser = async (req, res, next) => {
  if (!req.session?.userId) return next();
  if (req.user) return next();
  try {
    const u = await users.findById(req.session.userId);
    if (u) {
      const { password, resetPasswordToken, emailVerifyToken, ...safe } = u;
      req.user = safe;
    }
  } catch (e) { /* ignore — handlers will fall back to session */ }
  next();
};

exports.requireLogin = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'Please log in to continue.' });
  }
  next();
};

exports.requireGuide = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'Please log in to continue.' });
  }
  if (req.session.userType !== 'guide') {
    return res.status(403).json({ success: false, message: 'Guide access required.' });
  }
  next();
};

// A "provider" is anyone who can receive bookings and sell tours:
// solo guides AND tour companies. Use this for booking-management
// routes so companies aren't locked out the way requireGuide does.
exports.requireProvider = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'Please log in to continue.' });
  }
  if (req.session.userType !== 'guide' && req.session.userType !== 'company') {
    return res.status(403).json({ success: false, message: 'Guide or company access required.' });
  }
  next();
};

// Event teams — a separate provider vertical that runs events/activities.
exports.requireTeam = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'Please log in to continue.' });
  }
  if (req.session.userType !== 'team') {
    return res.status(403).json({ success: false, message: 'Team access required.' });
  }
  next();
};

exports.requireTourist = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'Please log in to continue.' });
  }
  if (req.session.userType !== 'tourist') {
    return res.status(403).json({ success: false, message: 'Tourist access required.' });
  }
  next();
};

exports.requireAdmin = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'Please log in to continue.' });
  }
  // Both admin (super) and staff have access to /admin routes;
  // per-action permissions are enforced via requirePermission middleware.
  if (req.session.userType !== 'admin' && req.session.userType !== 'staff') {
    return res.status(403).json({ success: false, message: 'Admin or staff access required.' });
  }
  next();
};

// Strict: only super admin (userType=admin) — used for managing staff
exports.requireSuperAdmin = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'Please log in to continue.' });
  }
  if (req.session.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Super admin access required.' });
  }
  next();
};

/**
 * Enforces email verification for sensitive actions (bookings, payments, etc.).
 * Admins are exempted (we control admin accounts directly).
 * Pre-existing accounts without emailVerified flag are also exempted (grandfathered).
 */
exports.requireVerifiedEmail = async (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'Please log in to continue.' });
  }
  if (req.session.userType === 'admin') return next();
  try {
    const u = req.user || await users.findById(req.session.userId);
    if (!u) return res.status(401).json({ success: false, message: 'User not found.' });
    // Grandfather older accounts that don't have the field at all (undefined)
    if (u.emailVerified === false) {
      return res.status(403).json({
        success: false,
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email before continuing. Check your inbox for the verification link.',
      });
    }
    next();
  } catch (e) {
    next(e);
  }
};
