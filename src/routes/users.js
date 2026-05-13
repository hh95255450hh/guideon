const router = require('express').Router();
const { body } = require('express-validator');
const {
  getProfile, updateProfile, changePassword,
  listUsers, updateUser, getDashboardStats,
} = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const { validate } = require('../middleware/errorHandler');
const { uploadAvatar, getFileUrl } = require('../services/uploadService');
const { query } = require('../config/database');

router.use(authenticate);

// ── All authenticated users ───────────────────────────────────────────────────
router.get('/profile', getProfile);
router.put('/profile',  updateProfile);

// Avatar upload
router.post('/avatar', uploadAvatar, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Image file is required' });
    }
    const avatarUrl = getFileUrl(req, req.file);
    await query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatarUrl, req.user.id]);
    res.json({ success: true, data: { avatar_url: avatarUrl } });
  } catch (err) {
    next(err);
  }
});

router.put(
  '/change-password',
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }),
  validate,
  changePassword
);

// ── FCM token registration ────────────────────────────────────────────────────
router.put('/fcm-token', async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, message: 'token is required' });
    }
    await query('UPDATE users SET fcm_token = $1 WHERE id = $2', [token, req.user.id]);
    res.json({ success: true, message: 'FCM token registered' });
  } catch (err) {
    next(err);
  }
});

// ── Admin only ────────────────────────────────────────────────────────────────
router.get('/admin/users',       authorize('admin'), listUsers);
router.patch('/admin/users/:id', authorize('admin'), updateUser);
router.get('/admin/stats',       authorize('admin'), getDashboardStats);

module.exports = router;
