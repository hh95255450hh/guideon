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

// TEMP diagnostic — surfaces the real Claude error. Remove after debugging.
router.get('/_diag', async (req, res) => {
  const svc = require('../services/ai');
  if (!svc.enabled) return res.json({ enabled: false });
  try {
    const text = await svc.complete({ messages: [{ role: 'user', content: 'Say OK' }], maxTokens: 50, effort: 'low' });
    res.json({ enabled: true, ok: true, model: svc.MODEL, text });
  } catch (e) {
    res.json({ enabled: true, ok: false, model: svc.MODEL, error: String(e && e.message), status: e && e.status, type: e && e.type });
  }
});

router.post('/trip-plan',           aiLimiter, ai.tripPlan);
router.post('/match',               aiLimiter, ai.match);
router.post('/improve',             aiLimiter, ai.improve);
router.get('/reviews-summary/:guideId', aiLimiter, ai.reviewsSummary);

module.exports = router;
