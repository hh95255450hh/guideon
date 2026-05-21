const router  = require('express').Router();
const payment = require('../controllers/paymentController');
const { requireLogin, requireAdmin } = require('../middleware/auth');

// Stripe webhook — raw body, no auth
router.post('/webhook', payment.webhook);

router.post('/create-checkout', requireLogin, payment.createCheckout);
router.get('/status/:bookingId',  requireLogin, payment.getStatus);
router.post('/refund', requireLogin, requireAdmin, payment.issueRefund);

module.exports = router;
