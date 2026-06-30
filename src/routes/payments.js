const router  = require('express').Router();
const payment = require('../controllers/paymentController');
const { requireLogin, requireAdmin } = require('../middleware/auth');
const { guestCheckoutLimiter } = require('../middleware/rateLimit');

// Thawani webhook is registered in app.js with express.raw() before express.json()

// Public — frontend queries this to know if "Pay Now" button should be shown
router.get('/feature-status', payment.getFeatureStatus);
// (Paymob callback is registered in app.js before the CSRF check.)

// Public — guest (no-account) booking + checkout in one call.
// Tight limit: 5 per 10 min per IP to block spam/DB pollution.
router.post('/guest-checkout', guestCheckoutLimiter, payment.createGuestCheckout);

router.post('/create-checkout', requireLogin, payment.createCheckout);
router.get('/verify',             requireLogin, payment.verify);
router.get('/status/:bookingId',  requireLogin, payment.getStatus);
router.post('/refund', requireLogin, requireAdmin, payment.issueRefund);

module.exports = router;
