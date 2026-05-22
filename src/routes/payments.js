const router  = require('express').Router();
const payment = require('../controllers/paymentController');
const { requireLogin, requireAdmin } = require('../middleware/auth');

// Stripe webhook is registered in app.js with express.raw() before express.json()

// Public — frontend queries this to know if "Pay Now" button should be shown
router.get('/feature-status', payment.getFeatureStatus);

router.post('/create-checkout', requireLogin, payment.createCheckout);
router.get('/status/:bookingId',  requireLogin, payment.getStatus);
router.post('/refund', requireLogin, requireAdmin, payment.issueRefund);

module.exports = router;
