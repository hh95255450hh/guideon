const stripe = require('../config/stripe');
const { query } = require('../config/database');
const { sendBookingConfirmation, sendBookingCancellation } = require('../services/emailService');
const notify = require('../services/notificationService');

// POST /api/payments/create-intent
const createPaymentIntent = async (req, res, next) => {
  try {
    const { booking_id } = req.body;

    const result = await query(
      `SELECT b.*, t.title AS tour_title, ta.date AS tour_date, u.email, u.name AS user_name
       FROM bookings b
       JOIN tours t ON t.id = b.tour_id
       JOIN tour_availability ta ON ta.id = b.availability_id
       JOIN users u ON u.id = b.user_id
       WHERE b.id = $1`,
      [booking_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const booking = result.rows[0];

    if (booking.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (booking.payment_status === 'paid') {
      return res.status(400).json({ success: false, message: 'Booking already paid' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot pay for a cancelled booking' });
    }

    const amountInCents = Math.round(parseFloat(booking.total_price) * 100);

    // Reuse existing intent if one was already created for this booking
    if (booking.stripe_payment_intent_id) {
      const existing = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id);
      if (existing.status !== 'canceled') {
        return res.json({
          success: true,
          data: {
            clientSecret: existing.client_secret,
            amount: existing.amount,
            currency: existing.currency,
          },
        });
      }
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      metadata: {
        booking_id: booking.id,
        tour_title: booking.tour_title,
        user_email: booking.email,
      },
      description: `GUIDEON – ${booking.tour_title}`,
      receipt_email: booking.email,
    });

    await query(
      'UPDATE bookings SET stripe_payment_intent_id = $1 WHERE id = $2',
      [paymentIntent.id, booking_id]
    );

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        amount: amountInCents,
        currency: 'usd',
        booking: {
          id: booking.id,
          tour_title: booking.tour_title,
          tour_date: booking.tour_date,
          participants: booking.participants,
          total_price: booking.total_price,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/payments/status/:booking_id
const getPaymentStatus = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT b.id, b.status, b.payment_status, b.stripe_payment_intent_id,
              b.total_price, t.title AS tour_title
       FROM bookings b
       JOIN tours t ON t.id = b.tour_id
       WHERE b.id = $1`,
      [req.params.booking_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const booking = result.rows[0];

    if (booking.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({ success: true, data: { booking } });
  } catch (err) {
    next(err);
  }
};

// POST /api/payments/webhook  (called by Stripe — no auth middleware, raw body)
const stripeWebhook = async (req, res, next) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).json({ success: false, message: err.message });
  }

  try {
    switch (event.type) {

      case 'payment_intent.succeeded': {
        const pi = event.data.object;

        const result = await query(
          `UPDATE bookings
           SET payment_status = 'paid', status = 'confirmed'
           WHERE stripe_payment_intent_id = $1
           RETURNING id, participants, total_price, tour_id, user_id, availability_id`,
          [pi.id]
        );

        if (result.rows.length) {
          const booking = result.rows[0];

          // Fetch details needed for confirmation email
          const details = await query(
            `SELECT u.email, u.name, t.title AS tour_title, ta.date AS tour_date
             FROM users u
             JOIN tours t ON t.id = $2
             JOIN tour_availability ta ON ta.id = $3
             WHERE u.id = $1`,
            [booking.user_id, booking.tour_id, booking.availability_id]
          );

          if (details.rows.length) {
            const { email, name, tour_title, tour_date } = details.rows[0];
            sendBookingConfirmation({
              email,
              name,
              tourTitle: tour_title,
              date: tour_date,
              participants: booking.participants,
              totalPrice: booking.total_price,
              bookingId: booking.id,
            }).catch((err) => console.error('Confirmation email failed:', err.message));

            notify.sendBookingConfirmation({
              userId:      booking.user_id,
              tourTitle:   tour_title,
              date:        tour_date,
              bookingId:   booking.id,
              participants: booking.participants,
              totalPrice:  booking.total_price,
            });
          }
        }

        console.log(`Payment succeeded: intent ${pi.id}`);
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        const failReason = pi.last_payment_error?.message || 'unknown reason';
        console.warn(`Payment failed for intent ${pi.id}: ${failReason}`);

        // Notify user their payment failed
        const failedBooking = await query(
          `SELECT b.user_id, t.title AS tour_title
           FROM bookings b JOIN tours t ON t.id = b.tour_id
           WHERE b.stripe_payment_intent_id = $1`,
          [pi.id]
        );
        if (failedBooking.rows.length) {
          const { user_id, tour_title } = failedBooking.rows[0];
          notify.sendPaymentFailed({ userId: user_id, tourTitle: tour_title });
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        if (!charge.payment_intent) break;

        const result = await query(
          `UPDATE bookings
           SET payment_status = 'refunded', status = 'cancelled'
           WHERE stripe_payment_intent_id = $1
           RETURNING id, tour_id, user_id`,
          [charge.payment_intent]
        );

        if (result.rows.length) {
          const booking = result.rows[0];
          const details = await query(
            `SELECT u.email, u.name, t.title AS tour_title
             FROM users u JOIN tours t ON t.id = $2
             WHERE u.id = $1`,
            [booking.user_id, booking.tour_id]
          );

          if (details.rows.length) {
            const { email, name, tour_title } = details.rows[0];
            sendBookingCancellation({
              email,
              name,
              tourTitle: tour_title,
              bookingId: booking.id,
            }).catch((err) => console.error('Cancellation email failed:', err.message));

            notify.sendBookingCancellation({
              userId:    booking.user_id,
              tourTitle: tour_title,
              bookingId: booking.id,
            });
          }
        }
        break;
      }

      default:
        console.log(`Unhandled Stripe event: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    next(err);
  }
};

// POST /api/payments/refund  (admin only)
const issueRefund = async (req, res, next) => {
  try {
    const { booking_id, reason } = req.body;

    const result = await query(
      `SELECT b.*, u.email, u.name AS user_name, t.title AS tour_title
       FROM bookings b
       JOIN users u ON u.id = b.user_id
       JOIN tours t ON t.id = b.tour_id
       WHERE b.id = $1`,
      [booking_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const booking = result.rows[0];

    if (booking.payment_status !== 'paid') {
      return res.status(400).json({ success: false, message: 'Booking has not been paid' });
    }

    if (!booking.stripe_payment_intent_id) {
      return res.status(400).json({ success: false, message: 'No Stripe payment found for this booking' });
    }

    const validReasons = ['duplicate', 'fraudulent', 'requested_by_customer'];
    const refundReason = validReasons.includes(reason) ? reason : 'requested_by_customer';

    const refund = await stripe.refunds.create({
      payment_intent: booking.stripe_payment_intent_id,
      reason: refundReason,
    });

    await query(
      `UPDATE bookings SET payment_status = 'refunded', status = 'cancelled' WHERE id = $1`,
      [booking_id]
    );

    sendBookingCancellation({
      email: booking.email,
      name: booking.user_name,
      tourTitle: booking.tour_title,
      bookingId: booking.id,
    }).catch((err) => console.error('Cancellation email failed:', err.message));

    notify.sendBookingCancellation({
      userId:    booking.user_id,
      tourTitle: booking.tour_title,
      bookingId: booking.id,
    });

    res.json({ success: true, message: 'Refund issued', data: { refund_id: refund.id } });
  } catch (err) {
    next(err);
  }
};

module.exports = { createPaymentIntent, getPaymentStatus, stripeWebhook, issueRefund };
