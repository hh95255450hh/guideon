const router = require('express').Router();
const booking = require('../controllers/bookingController');
const { requireLogin, requireTourist, requireGuide, requireAdmin, requireVerifiedEmail } = require('../middleware/auth');
const SupabaseDB = require('../models/SupabaseDB');
const { generateVoucher } = require('../services/voucherService');

const bookings = new SupabaseDB('bookings');
const users    = new SupabaseDB('users');

// Email verification is NOT required to book — bookings still go to the guide
// for confirmation, and verification emails were unreliable (spam) for new users.
router.post('/', requireTourist, booking.createBooking);
router.get('/mine', requireTourist, booking.myBookings);
router.get('/guide', requireGuide, booking.guideBookings);
router.get('/all', requireAdmin, booking.allBookings);
router.patch('/:id/status', requireLogin, booking.updateStatus);
router.patch('/:id/quote', requireGuide, booking.setQuote);

// GET /api/bookings/:id/voucher — PDF voucher for confirmed bookings
router.get('/:id/voucher', requireLogin, async (req, res) => {
  try {
    const b = await bookings.findById(req.params.id);
    if (!b) return res.status(404).json({ success: false, message: 'Booking not found.' });

    const uid = req.session.userId;
    if (b.touristId !== uid && b.guideId !== uid && req.session.userType !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    if (!['confirmed', 'completed'].includes(b.status)) {
      return res.status(400).json({ success: false, message: 'Voucher available for confirmed bookings only.' });
    }

    const [guide, tourist] = await Promise.all([
      users.findById(b.guideId),
      users.findById(b.touristId),
    ]);

    const pdf = await generateVoucher(b, guide, tourist);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="guideon-voucher-${b.id}.pdf"`);
    res.send(pdf);
  } catch (err) {
    console.error('[voucher]', err.message);
    res.status(500).json({ success: false, message: 'Could not generate voucher.' });
  }
});

module.exports = router;
