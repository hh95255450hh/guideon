const express = require('express');
const rateLimit = require('express-rate-limit');
const ai = require('../controllers/aiController');

const router = express.Router();

// AI calls cost real money — cap them tighter than the general API limiter.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_AI_MAX || 12),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many AI requests — please wait a moment. — طلبات كثيرة، انتظر قليلاً.' },
});

router.post('/trip-plan',           aiLimiter, ai.tripPlan);
router.post('/match',               aiLimiter, ai.match);
router.post('/improve',             aiLimiter, ai.improve);
router.get('/reviews-summary/:guideId', aiLimiter, ai.reviewsSummary);

module.exports = router;
