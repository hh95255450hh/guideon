const router = require('express').Router();
const { body } = require('express-validator');
const { createReview, deleteReview } = require('../controllers/reviewController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const { validate } = require('../middleware/errorHandler');
const { isUUIDField } = require('../middleware/uuidCheck');

const reviewRules = [
  isUUIDField('tour_id', 'Valid tour_id required'),
  isUUIDField('booking_id', 'Valid booking_id required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().trim().isLength({ max: 1000 }),
];

router.use(authenticate);

router.post('/', authorize('tourist'), reviewRules, validate, createReview);
router.delete('/:id', deleteReview);

module.exports = router;
