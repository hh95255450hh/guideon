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
  if (req.session.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }
  next();
};
