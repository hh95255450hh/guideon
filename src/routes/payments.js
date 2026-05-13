const router = require('express').Router();
const { body } = require('express-validator');
const { createPaymentIntent, getPaymentStatus, stripeWebhook, issueRefund } = require('../controllers/paymentController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const { validate } = require('../middleware/errorHandler');
const { isUUIDField } = require('../middleware/uuidCheck');

// Stripe webhook must receive the raw body — mounted before express.json()
router.post('/webhook', stripeWebhook);

router.post(
  '/create-intent',
  authenticate,
  isUUIDField('booking_id', 'Valid booking_id required'),
  validate,
  createPaymentIntent
);

router.get(
  '/status/:booking_id',
  authenticate,
  getPaymentStatus
);

router.post(
  '/refund',
  authenticate, authorize('admin'),
  isUUIDField('booking_id'),
  validate,
  issueRefund
);

module.exports = router;
