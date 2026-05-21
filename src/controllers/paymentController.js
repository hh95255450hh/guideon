const stripe = require('../config/stripe');
const SupabaseDB = require('../models/SupabaseDB');
const emailService = require('../services/emailService');

const bookings = new SupabaseDB('bookings');
const users    = new SupabaseDB('users');

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// POST /api/payments/create-checkout
exports.createCheckout = async (req, res) => {
  try {
    const { bookingId } = req.body;
    const touristId = req.session.userId;

    if (!bookingId) {
      return res.status(400).json({ success: false, message: 'Booking ID required.' });
    }

    const booking = await bookings.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }
    if (booking.touristId !== touristId) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot pay for a cancelled booking.' });
    }
    if (booking.status === 'confirmed' || booking.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Booking already paid.' });
    }

    const guide   = await users.findById(booking.guideId);
    const tourist = await users.findById(touristId);

    const amountInCents  = Math.round(parseFloat(booking.totalAmount) * 100);
    const durationLabel  = booking.duration === 'half' ? 'Half Day' : 'Full Day';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Tour with ${guide ? guide.fullName : 'Guide'} — Guideon`,
            description: `${booking.destination} • ${booking.tourDate} • ${durationLabel} • ${booking.participants} person(s)`,
          },
          unit_amount: amountInCents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${APP_URL}/checkout-success.html?booking_id=${bookingId}`,
      cancel_url:  `${APP_URL}/checkout.html?booking_id=${bookingId}&cancelled=1`,
      customer_email: tourist ? tourist.email : undefined,
      metadata: { booking_id: bookingId, tourist_id: touristId },
    });

    res.json({ success: true, url: session.url });
  } catch (err) {
    console.error('[Payment] createCheckout:', err.message);
    res.status(500).json({ success: false, message: 'Payment initialization failed. Please try again.' });
  }
};

// GET /api/payments/status/:bookingId
exports.getStatus = async (req, res) => {
  try {
    const booking = await bookings.findById(req.params.bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }
    if (booking.touristId !== req.session.userId && req.session.userType !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    res.json({ success: true, booking });
  } catch (err) {
    console.error('[Payment] getStatus:', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/payments/webhook — raw body from Stripe, registered before express.json()
exports.webhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('[Webhook] Signature error:', err.message);
    return res.status(400).json({ success: false, message: err.message });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session   = event.data.object;
      const bookingId = session.metadata?.booking_id;

      if (bookingId) {
        await bookings.update(bookingId, { status: 'confirmed' });

        const booking = await bookings.findById(bookingId);
        if (booking) {
          const tourist = await users.findById(booking.touristId);
          const guide   = await users.findById(booking.guideId);
          if (tourist && guide) {
            emailService.sendTouristBookingConfirmed({
              email: tourist.email, name: tourist.fullName,
              guideName: guide.fullName,
              destination: booking.destination,
              tourDate: booking.tourDate,
              totalAmount: booking.totalAmount,
              bookingId,
            }).catch(() => {});

            emailService.sendGuideBookingConfirmed({
              email: guide.email, name: guide.fullName,
              touristName: tourist.fullName,
              destination: booking.destination,
              tourDate: booking.tourDate,
              totalAmount: booking.totalAmount,
              bookingId,
            }).catch(() => {});

            // Remove booked date from guide availability
            const avail = Array.isArray(guide.availability) ? guide.availability : [];
            await users.update(guide.id, { availability: avail.filter(d => d !== booking.tourDate) });
          }
        }

        console.log(`[Webhook] Booking ${bookingId} confirmed via Stripe.`);
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('[Webhook] Handler error:', err.message);
    res.status(500).json({ success: false, message: 'Webhook handler failed.' });
  }
};

// POST /api/payments/refund (admin only)
exports.issueRefund = async (req, res) => {
  try {
    const { bookingId } = req.body;
    const booking = await bookings.findById(bookingId);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }
    if (booking.status !== 'confirmed') {
      return res.status(400).json({ success: false, message: 'Only confirmed bookings can be refunded.' });
    }

    res.json({ success: true, message: 'Refund request noted. Process via Stripe dashboard.' });
  } catch (err) {
    console.error('[Payment] issueRefund:', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
