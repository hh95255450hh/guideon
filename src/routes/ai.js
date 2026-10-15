const express = require('express');
const rateLimit = require('express-rate-limit');
const ai = require('../controllers/aiController');
const { aiGuard, aiSizeGuard } = require('../middleware/aiGuard');

const router = express.Router();

// AI calls cost real money — cap them tighter than the general API limiter.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_AI_MAX || 12),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many AI requests — please wait a moment. — طلبات كثيرة، انتظر قليلاً.' },
});

// aiGuard caps input size and spends a daily quota per visitor plus a global
// ceiling. The review summary is served from cache, so only a cache miss spends.
router.post('/trip-plan',           aiLimiter, aiGuard, ai.tripPlan);
router.post('/match',               aiLimiter, aiGuard, ai.match);
router.post('/improve',             aiLimiter, aiGuard, ai.improve);
router.post('/search',              aiLimiter, aiSizeGuard, ai.search);
router.get('/reviews-summary/:guideId', aiLimiter, ai.reviewsSummary);

module.exports = router;
