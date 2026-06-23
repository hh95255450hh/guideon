const thawani = require('../config/thawani');
const paymob  = require('../config/paymob');
const SupabaseDB = require('../models/SupabaseDB');
const emailService = require('../services/emailService');
const { notify } = require('../services/notificationService');

const bookings = new SupabaseDB('bookings');
const users    = new SupabaseDB('users');

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// Payments are disabled by default. Set PAYMENTS_ENABLED=true (and the gateway
// keys) in the server .env to switch the Pay Now flow on.
const PAYMENTS_ENABLED = process.env.PAYMENTS_ENABLED === 'true';
// Active gateway: 'paymob' | 'thawani' (default thawani for back-compat).
const PROVIDER = (process.env.PAYMENT_PROVIDER || 'thawani').toLowerCase();
const gateway = PROVIDER === 'paymob' ? paymob : thawani;
const gatewayConfigured = () => gateway.configured();

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
    enabled: PAYMENTS_ENABLED && gatewayConfigured(),
    gateway: PROVIDER,
    mode: PROVIDER === 'thawani' ? thawani.MODE : 'live',
    currency: 'OMR',
  });
};

// POST /api/payments/create-checkout  { bookingId }
exports.createCheckout = async (req, res) => {
  if (!PAYMENTS_ENABLED || !gatewayConfigured()) {
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

    // ── Paymob (Oman) — Unified Checkout / Intention API ────────────────────
    if (PROVIDER === 'paymob') {
      const amountCents = paymob.toCents(amount);
      // special_reference must be unique per attempt; encode the booking id.
      const merchantOrderId = `${bookingId}_${Date.now()}`;
      const { clientSecret, intentionId } = await paymob.createIntention({
        amountCents,
        merchantOrderId,
        billing: {
          firstName: (tourist?.fullName || 'Guideon').split(' ')[0],
          lastName:  (tourist?.fullName || 'Customer').split(' ').slice(1).join(' ') || 'Customer',
          email:     tourist?.email,
          phone:     tourist?.phone,
        },
        notificationUrl: `${APP_URL}/api/payments/paymob/callback`,
        redirectionUrl:  `${APP_URL}/checkout-success.html?booking_id=${bookingId}`,
      });
      await updateBookingSafe(bookingId, { paymentSessionId: String(intentionId) });
      return res.json({ success: true, url: paymob.checkoutUrl(clientSecret), sessionId: String(intentionId) });
    }

    // ── Thawani (default) ───────────────────────────────────────────────────
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

    const session = await thawani.retrieveSession(sessionId);
    if (session.status !== 'paid') {
      return res.json({ success: true, paid: false, status: session.status });
    }
    // Bind the session to THIS booking — a paid session for one booking must
    // never settle another (blocks session-reuse / amount bypass).
    const ref = session.raw?.client_reference_id;
    if (ref && ref !== bookingId) {
      return res.status(400).json({ success: false, message: 'This payment does not match the booking.' });
    }

    await finalizePaidBooking(bookingId, session);
    res.json({ success: true, paid: true });
  } catch (err) {
    console.error('[Payment] verify:', err.message);
    res.status(500).json({ success: false, message: 'Could not verify payment.' });
  }
};

// Shared: mark a booking paid + notify both sides (idempotent-ish).
async function finalizePaidBooking(bookingId, session) {
  const fresh = await bookings.findById(bookingId);
  if (!fresh || fresh.isPaid) return;

  // Defense-in-depth: never settle a booking from a session that belongs to a
  // different booking, or that paid less than the amount owed.
  if (session) {
    const ref = session.raw?.client_reference_id;
    if (ref && ref !== bookingId) {
      console.warn(`[Payment] refusing: session ref ${ref} != booking ${bookingId}`);
      return;
    }
    const expected = thawani.toBaisa(fresh.totalAmount);
    const paid = Number(session.raw?.total_amount);
    if (Number.isFinite(paid) && paid < expected) {
      console.warn(`[Payment] refusing: underpaid ${paid} < ${expected} baisa for ${bookingId}`);
      return;
    }
  }

  await updateBookingSafe(bookingId, { isPaid: true, paidAt: new Date().toISOString(), paymentRef: session?.raw?.session_id || fresh.paymentSessionId });

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
    if (sessionId) {
      const session = await thawani.retrieveSession(sessionId);
      // Authoritative booking id comes from the verified session, never the
      // (spoofable) webhook payload.
      const bookingId = session.raw?.client_reference_id;
      if (session.status === 'paid' && bookingId) await finalizePaidBooking(bookingId, session);
    }
    res.json({ received: true });
  } catch (err) {
    console.error('[Payment] webhook:', err.message);
    res.status(200).json({ received: true }); // never make Thawani retry-storm us
  }
};

// POST /api/payments/paymob/callback — Paymob transaction-processed webhook.
// Verifies the HMAC, binds to the booking via merchant_order_id, checks the
// paid amount, then settles — a spoofed call can't mark a booking paid.
exports.paymobCallback = async (req, res) => {
  try {
    let body = req.body;
    if (Buffer.isBuffer(body)) { try { body = JSON.parse(body.toString('utf8')); } catch { body = {}; } }
    const obj  = body?.obj || body;
    const hmac = req.query.hmac || body?.hmac;
    if (!paymob.verifyHmac(obj, hmac)) {
      console.warn('[Paymob] callback rejected: bad HMAC');
      return res.status(200).json({ received: true });
    }
    const success = obj?.success === true || obj?.success === 'true';
    if (success) {
      // We set special_reference = `${bookingId}_${ts}`; Paymob surfaces it as
      // the order's merchant_order_id (fall back to a few other fields).
      const moid = String(
        obj?.order?.merchant_order_id ||
        obj?.order?.special_reference ||
        obj?.payment_key_claims?.extra?.merchant_order_id || '');
      const bookingId = moid.split('_')[0];
      if (bookingId) {
        await finalizePaidBooking(bookingId, {
          raw: { client_reference_id: bookingId, total_amount: Number(obj.amount_cents), session_id: String(obj.id) },
        });
      }
    }
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('[Paymob] callback:', err.message);
    res.status(200).json({ received: true }); // never make Paymob retry-storm us
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
