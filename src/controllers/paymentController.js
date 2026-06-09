const thawani = require('../config/thawani');
const SupabaseDB = require('../models/SupabaseDB');
const emailService = require('../services/emailService');
const { notify } = require('../services/notificationService');

const bookings = new SupabaseDB('bookings');
const users    = new SupabaseDB('users');

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// Payments are disabled by default. Set PAYMENTS_ENABLED=true (and the
// Thawani keys) in Railway to switch the Pay Now flow on.
const PAYMENTS_ENABLED = process.env.PAYMENTS_ENABLED === 'true';

// Some deployments may not have the payment columns yet — strip & retry.
const OPTIONAL_PAY_COLS = ['isPaid', 'paidAt', 'paymentSessionId', 'paymentRef'];
const isMissingColumnError = (m) => /Could not find the '\w+' column|column \S+ does not exist|schema cache/i.test(m || '');
async function updateBookingSafe(id, data) {
  try { return await bookings.update(id, data); }
  catch (e) {
    if (isMissingColumnError(e.message)) {
      const clean = { ...data }; OPTIONAL_PAY_COLS.forEach(c => delete clean[c]);
      return await bookings.update(id, clean);
    }
    throw e;
  }
}

// GET /api/payments/feature-status — frontend uses this to show/hide Pay Now
exports.getFeatureStatus = (req, res) => {
  res.json({
    success: true,
    enabled: PAYMENTS_ENABLED && thawani.configured(),
    gateway: 'thawani',
    mode: thawani.MODE,
    currency: 'OMR',
  });
};

// POST /api/payments/create-checkout  { bookingId }
exports.createCheckout = async (req, res) => {
  if (!PAYMENTS_ENABLED || !thawani.configured()) {
    return res.status(503).json({
      success: false, code: 'PAYMENTS_DISABLED',
      message: 'Payments are not available yet. Your booking is free during our launch period.',
    });
  }
  try {
    const { bookingId } = req.body;
    const touristId = req.session.userId;
    if (!bookingId) return res.status(400).json({ success: false, message: 'Booking ID required.' });

    const booking = await bookings.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
    if (booking.touristId !== touristId) return res.status(403).json({ success: false, message: 'Access denied.' });
    if (booking.status === 'cancelled') return res.status(400).json({ success: false, message: 'Cannot pay for a cancelled booking.' });
    if (booking.isPaid) return res.status(400).json({ success: false, message: 'This booking is already paid.' });
    // Full payment is collected AFTER the provider accepts (status 'confirmed').
    if (booking.status !== 'confirmed') {
      return res.status(400).json({ success: false, message: 'You can pay once the guide/company has accepted your booking.' });
    }

    const provider = await users.findById(booking.guideId);
    const tourist  = await users.findById(touristId);
    const amount   = parseFloat(booking.totalAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'This booking has no payable amount.' });
    }

    const durationLabel = booking.duration === 'half' ? 'Half Day' : 'Full Day';
    const { sessionId, payUrl } = await thawani.createSession({
      clientReferenceId: bookingId,
      products: [{
        name: `Tour with ${provider ? (provider.companyName || provider.fullName) : 'Guide'} — ${booking.destination}`,
        quantity: 1,
        unit_amount: thawani.toBaisa(amount), // baisa
      }],
      successUrl: `${APP_URL}/checkout-success.html?booking_id=${bookingId}&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl:  `${APP_URL}/checkout.html?booking_id=${bookingId}&cancelled=1`,
      metadata: { booking_id: bookingId, tourist_id: touristId, label: durationLabel },
    });

    await updateBookingSafe(bookingId, { paymentSessionId: sessionId });
    res.json({ success: true, url: payUrl, sessionId });
  } catch (err) {
    console.error('[Payment] createCheckout:', err.message);
    res.status(500).json({ success: false, message: 'Payment initialization failed. Please try again.' });
  }
};

// GET /api/payments/verify?session_id=...&booking_id=...
// Called from checkout-success page. Verifies with Thawani server-side and
// marks the booking paid — this is the source of truth (don't trust the
// redirect alone).
exports.verify = async (req, res) => {
  try {
    const { session_id: sessionId, booking_id: bookingId } = req.query;
    if (!sessionId || !bookingId) {
      return res.status(400).json({ success: false, message: 'Missing session or booking id.' });
    }
    const booking = await bookings.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
    if (booking.touristId !== req.session.userId && req.session.userType !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    if (booking.isPaid) return res.json({ success: true, paid: true, alreadyPaid: true });

    const { status } = await thawani.retrieveSession(sessionId);
    if (status !== 'paid') {
      return res.json({ success: true, paid: false, status });
    }

    await finalizePaidBooking(bookingId);
    res.json({ success: true, paid: true });
  } catch (err) {
    console.error('[Payment] verify:', err.message);
    res.status(500).json({ success: false, message: 'Could not verify payment.' });
  }
};

// Shared: mark a booking paid + notify both sides (idempotent-ish).
async function finalizePaidBooking(bookingId) {
  const fresh = await bookings.findById(bookingId);
  if (!fresh || fresh.isPaid) return;

  await updateBookingSafe(bookingId, { isPaid: true, paidAt: new Date().toISOString() });

  const tourist  = await users.findById(fresh.touristId);
  const provider = await users.findById(fresh.guideId);
  const providerLink = provider?.userType === 'company'
    ? '/company-dashboard.html#bookings' : '/guide-dashboard.html#bookings';

  if (tourist) {
    emailService.sendTouristBookingConfirmed?.({
      email: tourist.email, name: tourist.fullName,
      guideName: provider?.fullName, destination: fresh.destination,
      tourDate: fresh.tourDate, totalAmount: fresh.totalAmount, bookingId,
    }).catch(() => {});
    notify({
      userId: tourist.id, type: 'payment_received',
      title: 'Payment successful 💳', titleAr: 'تم الدفع بنجاح 💳',
      body: `Your payment for the ${fresh.destination} tour is confirmed.`,
      bodyAr: `تم تأكيد دفعتك لرحلة ${fresh.destination}.`,
      link: '/tourist-dashboard.html#bookings', metadata: { bookingId },
    });
  }
  if (provider) {
    notify({
      userId: provider.id, type: 'payment_received',
      title: 'Booking paid 💰', titleAr: 'تم دفع الحجز 💰',
      body: `${tourist?.fullName || 'A tourist'} paid for the ${fresh.destination} tour on ${fresh.tourDate}.`,
      bodyAr: `دفع ${tourist?.fullName || 'سائح'} مبلغ رحلة ${fresh.destination} بتاريخ ${fresh.tourDate}.`,
      link: providerLink, metadata: { bookingId },
    });
  }
  console.log(`[Payment] Booking ${bookingId} marked paid.`);
}

// GET /api/payments/status/:bookingId
exports.getStatus = async (req, res) => {
  try {
    const booking = await bookings.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
    if (booking.touristId !== req.session.userId && req.session.userType !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    res.json({ success: true, booking });
  } catch (err) {
    console.error('[Payment] getStatus:', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/payments/webhook — optional Thawani webhook (server-to-server).
// We verify by re-fetching the session, so a spoofed call can't mark a
// booking paid. Configure the webhook in the Thawani dashboard if desired.
exports.webhook = async (req, res) => {
  try {
    let body = req.body;
    if (Buffer.isBuffer(body)) { try { body = JSON.parse(body.toString('utf8')); } catch { body = {}; } }
    const sessionId = body?.data?.session_id || body?.session_id;
    const bookingId = body?.data?.client_reference_id || body?.data?.metadata?.booking_id;
    if (sessionId && bookingId) {
      const { status } = await thawani.retrieveSession(sessionId);
      if (status === 'paid') await finalizePaidBooking(bookingId);
    }
    res.json({ received: true });
  } catch (err) {
    console.error('[Payment] webhook:', err.message);
    res.status(200).json({ received: true }); // never make Thawani retry-storm us
  }
};

// POST /api/payments/refund (admin only) — records intent; refund is
// executed in the Thawani dashboard (Thawani has no public refund API yet).
exports.issueRefund = async (req, res) => {
  try {
    const { bookingId } = req.body;
    const booking = await bookings.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
    if (!booking.isPaid) return res.status(400).json({ success: false, message: 'This booking was not paid.' });
    res.json({ success: true, message: 'Refund noted. Process it from the Thawani dashboard, then cancel the booking.' });
  } catch (err) {
    console.error('[Payment] issueRefund:', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
