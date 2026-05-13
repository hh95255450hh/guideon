const router = require('express').Router();
const { body } = require('express-validator');
const { register, login, refresh, logout, getMe } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/errorHandler');

const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number'),
  body('role').optional().isIn(['tourist', 'guide', 'company']),
];

const loginRules = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
];

router.post('/register', registerRules, validate, register);
router.post('/login',    loginRules,    validate, login);
router.post('/refresh',  refresh);
router.post('/logout',   authenticate, logout);
router.get('/me',        authenticate, getMe);

module.exports = router;
