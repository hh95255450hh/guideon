const thawani = require('../config/thawani');
const paymob  = require('../config/paymob');
const SupabaseDB = require('../models/SupabaseDB');
const emailService = require('../services/emailService');
const bookingService = require('../services/bookingService');
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
    // Pay-first: a deposit is paid while the booking is 'awaiting_payment'
    // (this is what submits it to the guide). A balance can be paid later once
    // the booking is 'confirmed'.
    const PAYABLE_STATUSES = ['awaiting_payment', 'confirmed'];
    if (!PAYABLE_STATUSES.includes(booking.status)) {
      return res.status(400).json({ success: false, message: 'This booking cannot be paid right now.' });
    }

    const provider = await users.findById(booking.guideId);
    const tourist  = await users.findById(touristId);
    // Charge the deposit while awaiting payment; otherwise the remaining balance
    // (or the full amount for legacy bookings without a deposit).
    const amount = booking.status === 'awaiting_payment'
      ? (parseFloat(booking.depositAmount) || parseFloat(booking.totalAmount))
      : (parseFloat(booking.balanceAmount) > 0 ? parseFloat(booking.balanceAmount) : parseFloat(booking.totalAmount));
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

// Email a guest (no-account) their booking status. Best-effort.
async function _emailGuest(booking, guest, paid) {
  if (!guest || !guest.email) return;
  try {
    const link = `${APP_URL}/checkout-success.html?booking_id=${booking.id}`;
    const subject = paid ? 'تأكيد حجزك · Booking confirmed — Guideon'
                         : 'تم استلام حجزك · Booking received — Guideon';
    const html = emailService.notificationEmail
      ? emailService.notificationEmail({
          icon: paid ? '✅' : '🧾',
          title: paid ? 'Your booking is confirmed' : 'Your booking was received',
          titleAr: paid ? 'تم تأكيد حجزك' : 'تم استلام حجزك',
          body: `Tour to ${booking.destination} on ${booking.tourDate}. Open the link to view your booking.`,
          bodyAr: `رحلتك إلى ${booking.destination} بتاريخ ${booking.tourDate}. افتح الرابط لعرض حجزك.`,
          link,
        })
      : `حجزك إلى ${booking.destination} بتاريخ ${booking.tourDate} — ${link}`;
    await emailService.send(guest.email, subject, html);
  } catch (_) { /* never block on email */ }
}

// Email a guest that their booking is now PAID (from the payment webhook).
function _emailGuestPaid(booking) {
  _emailGuest(booking, {
    name:  booking.guestName  || 'Guest',
    email: booking.guestEmail || '',
    phone: booking.guestPhone || '',
  }, true).catch(() => {});
}

// POST /api/payments/guest-checkout — book + pay WITHOUT an account.
// Body: the normal booking fields + { name, email, phone }.
exports.createGuestCheckout = async (req, res) => {
  try {
    const { name, email, phone } = req.body || {};
    const gname = String(name || '').trim();
    if (!gname) {
      return res.status(400).json({ success: false, message: 'الاسم مطلوب · Your name is required.' });
    }
    if (!email && !phone) {
      return res.status(400).json({ success: false, message: 'أدخل البريد أو رقم الهاتف · Email or phone is required.' });
    }
    const guest = {
      name: gname.slice(0, 120),
      email: String(email || '').trim().slice(0, 160),
      phone: String(phone || '').trim().slice(0, 40),
    };

    let booking;
    try {
      booking = await bookingService.createBooking(null, req.body, guest);
    } catch (e) {
      if (e instanceof bookingService.BookingError) {
        return res.status(e.status).json({ success: false, code: e.code, message: e.message });
      }
      throw e;
    }

    // Free-launch / no gateway / zero price → no payment; confirm + email guest.
    const amount = parseFloat(booking.depositAmount) || parseFloat(booking.totalAmount);
    if (booking.status !== 'awaiting_payment' || !PAYMENTS_ENABLED ||
        !gatewayConfigured() || !Number.isFinite(amount) || amount <= 0) {
      _emailGuest(booking, guest, false).catch(() => {});
      return res.status(201).json({ success: true, booking, paid: false });
    }

    const [firstName, ...rest] = guest.name.split(' ');
    if (PROVIDER === 'paymob') {
      const { clientSecret, intentionId } = await paymob.createIntention({
        amountCents: paymob.toCents(amount),
        merchantOrderId: `${booking.id}_${Date.now()}`,
        billing: {
          firstName: firstName || 'Guest',
          lastName: rest.join(' ') || 'Customer',
          email: guest.email || undefined,
          phone: guest.phone || undefined,
        },
        notificationUrl: `${APP_URL}/api/payments/paymob/callback`,
        redirectionUrl: `${APP_URL}/checkout-success.html?booking_id=${booking.id}`,
      });
      await updateBookingSafe(booking.id, { paymentSessionId: String(intentionId) });
      return res.status(201).json({ success: true, booking, url: paymob.checkoutUrl(clientSecret) });
    }

    // Thawani fallback
    const { sessionId, payUrl } = await thawani.createSession({
      clientReferenceId: booking.id,
      products: [{ name: `Tour — ${booking.destination}`, quantity: 1, unit_amount: thawani.toBaisa(amount) }],
      successUrl: `${APP_URL}/checkout-success.html?booking_id=${booking.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${APP_URL}/checkout.html?booking_id=${booking.id}&cancelled=1`,
      metadata: { booking_id: booking.id, guest: '1' },
    });
    await updateBookingSafe(booking.id, { paymentSessionId: sessionId });
    return res.status(201).json({ success: true, booking, url: payUrl });
  } catch (err) {
    console.error('[Payment] guestCheckout:', err.message);
    res.status(500).json({ success: false, message: 'تعذّر بدء الحجز. حاول مجدّداً · Could not start the booking.' });
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

// Shared: settle a payment + notify. Fully idempotent — safe to call from
// concurrent webhook deliveries (Thawani/Paymob both retry on timeout).
// The DB has a UNIQUE index on paymentRef (migration 052) so a duplicate
// ref update is a no-op; we also do an early in-memory check here so we
// avoid unnecessary DB writes in the happy path.
async function finalizePaidBooking(bookingId, session) {
  const fresh = await bookings.findById(bookingId);
  if (!fresh) return;
  const isDeposit = fresh.status === 'awaiting_payment';
  // In-memory idempotency guard — prevents double-processing in concurrent calls.
  if (isDeposit ? fresh.depositPaidAt : fresh.isPaid) {
    console.log(`[Payment] Booking ${bookingId} already settled — skipping duplicate webhook.`);
    return;
  }

  // What's owed for THIS payment (deposit vs balance vs full).
  const expectedOmr = isDeposit
    ? (parseFloat(fresh.depositAmount) || parseFloat(fresh.totalAmount))
    : (parseFloat(fresh.balanceAmount) > 0 ? parseFloat(fresh.balanceAmount) : parseFloat(fresh.totalAmount));

  // Defense-in-depth: the session must belong to THIS booking and not pay less
  // than what's owed for this step.
  if (session) {
    const ref = session.raw?.client_reference_id;
    if (ref && ref !== bookingId) {
      console.warn(`[Payment] refusing: session ref ${ref} != booking ${bookingId}`);
      return;
    }
    const expected = thawani.toBaisa(expectedOmr);
    const paid = Number(session.raw?.total_amount);
    if (Number.isFinite(paid) && paid < expected) {
      console.warn(`[Payment] refusing: underpaid ${paid} < ${expected} baisa for ${bookingId}`);
      return;
    }
  }

  const now = new Date().toISOString();
  const ref = session?.raw?.session_id || fresh.paymentSessionId;

  // ── Pay-first deposit: submit the booking to the provider now ──
  if (isDeposit) {
    const fullyPaid = (parseInt(fresh.depositPercent) || 100) >= 100;
    try {
      await updateBookingSafe(bookingId, {
        status: 'pending', depositPaidAt: now, isPaid: fullyPaid,
        ...(fullyPaid && { paidAt: now }), paymentRef: ref,
      });
    } catch (dbErr) {
      // Unique violation on paymentRef = another webhook already settled this. Safe to ignore.
      if (dbErr?.code === '23505' || String(dbErr?.message).includes('unique')) {
        console.log(`[Payment] Booking ${bookingId} unique-ref conflict — already settled by concurrent webhook.`);
        return;
      }
      throw dbErr;
    }
    // The provider sees the booking for the FIRST time, now that it's paid.
    try { require('../services/bookingService').notifyBookingSubmitted(bookingId); } catch (e) { /* non-critical */ }
    if (!fresh.touristId && fresh.guestEmail) _emailGuestPaid(fresh);
    const t = await users.findById(fresh.touristId);
    if (t) notify({
      userId: t.id, type: 'payment_received',
      title:   fullyPaid ? 'Payment successful 💳' : 'Deposit received ✅',
      titleAr: fullyPaid ? 'تم الدفع بنجاح 💳' : 'تم استلام العربون ✅',
      body:   `Your ${fresh.destination} booking has been sent to the guide for confirmation.`,
      bodyAr: `تم إرسال حجز ${fresh.destination} إلى المرشد لتأكيده.`,
      link: '/tourist-dashboard.html#bookings', metadata: { bookingId },
    });
    console.log(`[Payment] Booking ${bookingId} deposit paid → submitted to provider.`);
    return;
  }

  // ── Balance / legacy full payment → mark fully paid ──
  try {
    await updateBookingSafe(bookingId, { isPaid: true, paidAt: now, paymentRef: ref });
  } catch (dbErr) {
    if (dbErr?.code === '23505' || String(dbErr?.message).includes('unique')) {
      console.log(`[Payment] Booking ${bookingId} unique-ref conflict (balance) — already settled.`);
      return;
    }
    throw dbErr;
  }

  if (!fresh.touristId && fresh.guestEmail) _emailGuestPaid(fresh);
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
// Exposed so an admin/ops script can settle a booking whose webhook was missed.
exports.finalizePaidBooking = finalizePaidBooking;

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
    const success = obj?.success === true || obj?.success === 'true';

    // Find the booking ref from any field Paymob may carry it in.
    const moid = String(
      obj?.order?.merchant_order_id ||
      obj?.order?.special_reference ||
      obj?.payment_key_claims?.extra?.merchant_order_id ||
      obj?.payment_key_claims?.billing_data?.extra_description || '');
    const refBookingId = moid.startsWith('bk-') ? moid.split('_')[0] : '';

    const hmacOk = paymob.verifyHmac(obj, hmac);
    // Diagnostic: surface exactly why a callback did/didn't settle.
    console.log('[Paymob] webhook success=%s hmacOk=%s ref=%s booking=%s amount=%s orderKeys=%j',
      success, hmacOk, moid, refBookingId, obj?.amount_cents, Object.keys(obj?.order || {}));
    if (!hmacOk) {
      console.warn('[Paymob] HMAC mismatch recv=%s calc=%s', String(hmac || '').slice(0, 14), paymob.computeHmac(obj).slice(0, 14));
      return res.status(200).json({ received: true });
    }

    if (success && refBookingId) {
      await finalizePaidBooking(refBookingId, {
        raw: { client_reference_id: refBookingId, total_amount: Number(obj.amount_cents), session_id: String(obj.id) },
      });
    } else if (success && !refBookingId) {
      console.warn('[Paymob] paid but could not resolve booking ref from obj.order=%j', obj?.order);
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
