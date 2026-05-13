const router = require('express').Router();
const { body } = require('express-validator');
const {
  createBooking, listBookings, getBooking, cancelBooking, updateBookingStatus,
} = require('../controllers/bookingController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const { validate } = require('../middleware/errorHandler');
const { isUUIDField } = require('../middleware/uuidCheck');

const createRules = [
  isUUIDField('tour_id', 'Valid tour_id required'),
  isUUIDField('availability_id', 'Valid availability_id required'),
  body('participants').isInt({ min: 1 }).withMessage('Participants must be at least 1'),
];

router.use(authenticate);

router.post('/', createRules, validate, createBooking);
router.get('/',  listBookings);
router.get('/:id', getBooking);
router.patch('/:id/cancel', cancelBooking);

router.patch(
  '/:id/status',
  authorize('admin', 'company'),
  body('status').isIn(['confirmed', 'completed', 'cancelled']),
  validate,
  updateBookingStatus
);

module.exports = router;
