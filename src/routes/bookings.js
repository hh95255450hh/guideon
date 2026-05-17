const router = require('express').Router();
const booking = require('../controllers/bookingController');
const { requireLogin, requireTourist, requireGuide, requireAdmin } = require('../middleware/auth');

router.post('/', requireTourist, booking.createBooking);
router.get('/mine', requireTourist, booking.myBookings);
router.get('/guide', requireGuide, booking.guideBookings);
router.get('/all', requireAdmin, booking.allBookings);
router.patch('/:id/status', requireLogin, booking.updateStatus);

module.exports = router;
