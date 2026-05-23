const router = require('express').Router();
const tfa = require('../controllers/twoFactorController');
const { requireLogin } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimit');

router.get('/status',    requireLogin, tfa.status);
router.post('/setup',    requireLogin, tfa.setup);
router.post('/enable',   requireLogin, tfa.enable);
router.post('/disable',  requireLogin, tfa.disable);
router.post('/verify',   loginLimiter, tfa.verifyLogin); // No login required — uses session.pending2faUserId

module.exports = router;
