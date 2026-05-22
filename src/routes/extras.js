const router = require('express').Router();
const wishlist = require('../controllers/wishlistController');
const newsletter = require('../controllers/newsletterController');
const { requireLogin } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const subscribeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many subscriptions. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/wishlist/share', requireLogin, wishlist.share);
router.get('/wishlist/:id',     wishlist.get);

router.post('/newsletter/subscribe',   subscribeLimiter, newsletter.subscribe);
router.post('/newsletter/unsubscribe', newsletter.unsubscribe);

module.exports = router;
