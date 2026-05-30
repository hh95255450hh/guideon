const router  = require('express').Router();
const rateLimit = require('express-rate-limit');
const { chat, chatStream } = require('../controllers/chatController');

// 20 messages per hour per IP — prevents API abuse
const chatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.ip,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "You've reached the chat limit (20 messages/hour). Please try again later.",
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/', chatLimiter, chat);
router.post('/stream', chatLimiter, chatStream);

module.exports = router;
