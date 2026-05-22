const router  = require('express').Router();
const multer  = require('multer');
const path    = require('path');
const { body } = require('express-validator');
const auth    = require('../controllers/authController');
const { requireLogin } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const { loginLimiter, registerLimiter, passwordResetLimiter } = require('../middleware/rateLimit');

const validateRegister = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
  body('fullName').trim().isLength({ min: 2, max: 100 }).withMessage('Full name is required (2-100 chars).'),
  body('userType').isIn(['tourist', 'guide', 'company']).withMessage('Invalid user type.'),
  handleValidation,
];

const validateLogin = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
  body('password').notEmpty().withMessage('Password is required.'),
  handleValidation,
];

const validateForgot = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
  handleValidation,
];

const validateReset = [
  body('token').isLength({ min: 32 }).withMessage('Invalid token.'),
  body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
  handleValidation,
];

const validateChangePassword = [
  body('currentPassword').notEmpty().withMessage('Current password is required.'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters.'),
  handleValidation,
];

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.post('/register', registerLimiter, validateRegister, auth.register);
router.post('/login', loginLimiter, validateLogin, auth.login);
router.post('/logout', auth.logout);
router.get('/me', requireLogin, auth.me);
router.put('/profile', requireLogin, auth.updateProfile);
router.put('/change-password', requireLogin, validateChangePassword, auth.changePassword);
router.post('/upload-photo', requireLogin, upload.single('photo'), auth.uploadPhoto);
router.post('/fcm-token', requireLogin, auth.saveFcmToken);
router.post('/forgot-password', passwordResetLimiter, validateForgot, auth.forgotPassword);
router.post('/reset-password', passwordResetLimiter, validateReset, auth.resetPassword);
router.get('/verify-email/:token', auth.verifyEmail);
router.post('/resend-verification', passwordResetLimiter, validateForgot, auth.resendVerification);

module.exports = router;
