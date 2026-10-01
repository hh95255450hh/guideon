// Instant guide (المرشد الفوري).
//
// Flow: a guide switches on "available now" (sharing an approximate location
// and an hourly rate) → a tourist sees nearby available guides and sends a
// request for N hours → the guide accepts within REQUEST_TTL_MIN → a normal
// booking is created in 'awaiting_payment' for today, which the tourist pays
// through the existing Paymob checkout (/api/payments/create-checkout).
//
// Authorization is app-only (service-role DB client): every mutating handler
// checks the session user owns the row it touches.
const { v4: uuidv4 } = require('uuid');
const SupabaseDB = require('../models/SupabaseDB');
const { notify } = require('../services/notificationService');
const { omanToday } = require('../domain/bookingRules');

const users    = new SupabaseDB('users');
const requests = new SupabaseDB('instant_requests');
const bookings = new SupabaseDB('bookings');

const REQUEST_TTL_MIN  = 10;     // a pending request expires after this
const AVAILABLE_TTL_H  = 3;      // "available now" goes stale if location not refreshed
const MAX_RADIUS_KM    = 150;
const MIN_RATE = 1, MAX_RATE = 200;
const MIN_HOURS = 1, MAX_HOURS = 8;

const round3 = n => Math.round(n * 1000) / 1000;
const validCoord = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

function distanceKm(aLat, aLng, bLat, bLng) {
  const R = 6371, toRad = d => d * Math.PI / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Oman local time "HH:MM" (+04:00), used as the booking slot start.
function omanHHMM(date = new Date()) {
  return new Date(date.getTime() + 4 * 3600 * 1000).toISOString().slice(11, 16);
}

function isFresh(u) {
  return u.instantAvailable && u.instantUpdatedAt &&
    (Date.now() - new Date(u.instantUpdatedAt).getTime()) < AVAILABLE_TTL_H * 3600e3;
}

function isExpired(r) {
  return r.status === 'pending' && (Date.now() - new Date(r.createdAt).getTime()) > REQUEST_TTL_MIN * 60e3;
}

// Lazily mark stale pending requests as expired so lists stay truthful.
async function expireStale(list) {
  for (const r of list) {
    if (isExpired(r)) {
      r.status = 'expired';
      requests.update(r.id, { status: 'expired' }).catch(() => {});
    }
  }
  return list;
}

// ── Guide: set availability ─────────────────────────────────────
exports.setAvailability = async (req, res) => {
  try {
    const available = !!req.body.available;
    const changes = { instantAvailable: available, instantUpdatedAt: new Date().toISOString() };
    if (available) {
      const lat = parseFloat(req.body.lat), lng = parseFloat(req.body.lng);
      const rate = parseFloat(req.body.hourlyRate);
      if (!validCoord(lat, lng)) {
        return res.status(400).json({ success: false, message: 'Location is required to go available. · يلزم تحديد الموقع لتفعيل الإتاحة.' });
      }
      if (!Number.isFinite(rate) || rate < MIN_RATE || rate > MAX_RATE) {
        return res.status(400).json({ success: false, message: `Hourly rate must be between ${MIN_RATE} and ${MAX_RATE} OMR. · سعر الساعة يجب أن يكون بين ${MIN_RATE} و${MAX_RATE} ريالًا.` });
      }
      Object.assign(changes, { instantLat: lat, instantLng: lng, instantHourlyRate: round3(rate) });
    }
    const me = await users.findById(req.session.userId);
    if (!me) return res.status(404).json({ success: false, message: 'User not found.' });
    if (available && !me.isVerified) {
      return res.status(403).json({ success: false, message: 'Only verified guides can receive instant requests. · الطلبات الفورية متاحة للمرشدين الموثّقين فقط.' });
    }
    await users.update(me.id, changes);
    res.json({ success: true, available, hourlyRate: changes.instantHourlyRate ?? me.instantHourlyRate ?? null });
  } catch (err) {
    console.error('[instant:setAvailability]', err.message);
    res.status(500).json({ success: false, message: 'Could not update availability. · تعذّر تحديث الإتاحة.' });
  }
};

// ── Guide: my current state ─────────────────────────────────────
exports.myState = async (req, res) => {
  try {
    const me = await users.findById(req.session.userId);
    if (!me) return res.status(404).json({ success: false });
    res.json({
      success: true,
      available: isFresh(me),
      hourlyRate: me.instantHourlyRate != null ? Number(me.instantHourlyRate) : null,
      isVerified: !!me.isVerified,
    });
  } catch (err) {
    console.error('[instant:myState]', err.message);
    res.status(500).json({ success: false });
  }
};

// ── Public: nearby available guides ─────────────────────────────
exports.nearby = async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat), lng = parseFloat(req.query.lng);
    const hasLoc = validCoord(lat, lng);
    // findAllWhere(eq) + JS filtering (see CLAUDE.md: never findPage here).
    const rows = await users.findAllWhere({ instantAvailable: true });
    const out = [];
    for (const g of rows || []) {
      if (g.userType !== 'guide' || g.isSuspended === true || !g.isVerified || !isFresh(g)) continue;
      if (!validCoord(Number(g.instantLat), Number(g.instantLng))) continue;
      if (g.id === req.session.userId) continue;
      const d = hasLoc ? distanceKm(lat, lng, Number(g.instantLat), Number(g.instantLng)) : null;
      if (d != null && d > MAX_RADIUS_KM) continue;
      out.push({
        id: g.id,
        fullName: g.fullName,
        photo: g.photo || null,
        rating: Number(g.rating) || 0,
        totalReviews: Number(g.totalReviews) || 0,
        languages: g.languages || [],
        hourlyRate: Number(g.instantHourlyRate) || null,
        // Privacy: publish an approximate position (~1 km) only.
        lat: Math.round(Number(g.instantLat) * 100) / 100,
        lng: Math.round(Number(g.instantLng) * 100) / 100,
        distanceKm: d != null ? Math.round(d * 10) / 10 : null,
      });
    }
    out.sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
    res.json({ success: true, guides: out.slice(0, 40) });
  } catch (err) {
    console.error('[instant:nearby]', err.message);
    res.status(500).json({ success: false, message: 'Could not load guides. · تعذّر تحميل المرشدين.' });
  }
};

// ── Tourist: send an instant request ────────────────────────────
exports.createRequest = async (req, res) => {
  try {
    const touristId = req.session.userId;
    const { guideId } = req.body;
    const hours = parseInt(req.body.hours, 10);
    const lat = parseFloat(req.body.lat), lng = parseFloat(req.body.lng);
    const note = String(req.body.note || '').slice(0, 500);
    if (!guideId) return res.status(400).json({ success: false, message: 'Choose a guide. · اختر مرشدًا.' });
    if (!Number.isInteger(hours) || hours < MIN_HOURS || hours > MAX_HOURS) {
      return res.status(400).json({ success: false, message: `Hours must be ${MIN_HOURS}–${MAX_HOURS}. · عدد الساعات من ${MIN_HOURS} إلى ${MAX_HOURS}.` });
    }
    const guide = await users.findById(guideId);
    if (!guide || guide.userType !== 'guide' || guide.isSuspended === true || !guide.isVerified || !isFresh(guide)) {
      return res.status(409).json({ success: false, message: 'This guide is no longer available. · هذا المرشد لم يعد متاحًا.' });
    }
    // One open request per tourist at a time.
    const mine = await expireStale(await requests.findAllWhere({ touristId }) || []);
    if (mine.some(r => r.status === 'pending')) {
      return res.status(409).json({ success: false, message: 'You already have a pending request. · لديك طلب قيد الانتظار.' });
    }
    const rate = Number(guide.instantHourlyRate);
    const row = await requests.insert({
      id: 'inst-' + uuidv4().slice(0, 12),
      touristId, guideId,
      lat: validCoord(lat, lng) ? lat : null,
      lng: validCoord(lat, lng) ? lng : null,
      hours, hourlyRate: rate, totalAmount: round3(rate * hours),
      note: note || null, status: 'pending',
      createdAt: new Date().toISOString(),
    });
    const tourist = await users.findById(touristId);
    notify({
      userId: guideId, type: 'instant_request',
      title: 'New instant request ⚡', titleAr: 'طلب فوري جديد ⚡',
      body: `${tourist?.fullName || 'A tourist'} wants a guide now for ${hours}h (OMR ${row.totalAmount}). Respond within ${REQUEST_TTL_MIN} minutes.`,
      bodyAr: `${tourist?.fullName || 'سائح'} يطلب مرشدًا الآن لمدة ${hours} ساعة (${row.totalAmount} ر.ع). ردّ خلال ${REQUEST_TTL_MIN} دقائق.`,
      link: '/instant.html', metadata: { requestId: row.id },
    });
    res.status(201).json({ success: true, request: row, expiresInMin: REQUEST_TTL_MIN });
  } catch (err) {
    console.error('[instant:createRequest]', err.message);
    res.status(500).json({ success: false, message: 'Could not send the request. · تعذّر إرسال الطلب.' });
  }
};

// ── Lists ───────────────────────────────────────────────────────
async function decorate(list, otherKey) {
  const ids = [...new Set(list.map(r => r[otherKey]).filter(Boolean))];
  const people = ids.length ? await users.findByIds(ids) : [];
  const byId = Object.fromEntries((people || []).map(u => [u.id, u]));
  return list.map(r => ({
    ...r,
    otherName: byId[r[otherKey]]?.fullName || '',
    otherPhoto: byId[r[otherKey]]?.photo || null,
    expiresAt: new Date(new Date(r.createdAt).getTime() + REQUEST_TTL_MIN * 60e3).toISOString(),
  }));
}

exports.myRequests = async (req, res) => {
  try {
    const list = await expireStale(await requests.findAllWhere({ touristId: req.session.userId }) || []);
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, requests: await decorate(list.slice(0, 10), 'guideId') });
  } catch (err) {
    console.error('[instant:myRequests]', err.message);
    res.status(500).json({ success: false });
  }
};

exports.incoming = async (req, res) => {
  try {
    const list = await expireStale(await requests.findAllWhere({ guideId: req.session.userId }) || []);
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, requests: await decorate(list.slice(0, 20), 'touristId') });
  } catch (err) {
    console.error('[instant:incoming]', err.message);
    res.status(500).json({ success: false });
  }
};

// ── Guide: accept / decline ─────────────────────────────────────
async function loadOwnPending(req, res) {
  const r = await requests.findById(req.params.id);
  if (!r) { res.status(404).json({ success: false, message: 'Request not found.' }); return null; }
  if (r.guideId !== req.session.userId) { res.status(403).json({ success: false, message: 'Access denied.' }); return null; }
  if (isExpired(r)) {
    await requests.update(r.id, { status: 'expired' }).catch(() => {});
    res.status(410).json({ success: false, message: 'This request has expired. · انتهت مهلة هذا الطلب.' });
    return null;
  }
  if (r.status !== 'pending') { res.status(409).json({ success: false, message: 'This request was already handled.' }); return null; }
  return r;
}

exports.accept = async (req, res) => {
  try {
    const r = await loadOwnPending(req, res);
    if (!r) return;
    const now = new Date();
    const start = omanHHMM(now);
    const end = omanHHMM(new Date(now.getTime() + r.hours * 3600e3));
    const booking = await bookings.insert({
      id: 'bk-' + uuidv4().slice(0, 12),
      touristId: r.touristId,
      guideId: r.guideId,
      providerType: 'guide',
      tourDate: omanToday(now),
      startTime: start,
      endTime: end,
      duration: `${r.hours}h`,
      destination: 'Instant guide · مرشد فوري',
      participants: 1,
      totalAmount: Number(r.totalAmount),
      status: 'awaiting_payment',
      isPaid: false,
      specialRequests: r.note || null,
      createdAt: now.toISOString(),
    });
    await requests.update(r.id, { status: 'accepted', bookingId: booking.id, respondedAt: now.toISOString() });
    const guide = await users.findById(r.guideId);
    notify({
      userId: r.touristId, type: 'instant_accepted',
      title: 'Your guide accepted ✅', titleAr: 'قبل المرشد طلبك ✅',
      body: `${guide?.fullName || 'Your guide'} accepted. Pay OMR ${r.totalAmount} to confirm and they will head to you.`,
      bodyAr: `قبل ${guide?.fullName || 'المرشد'} طلبك. ادفع ${r.totalAmount} ر.ع للتأكيد وسيتوجّه إليك.`,
      link: '/instant.html', metadata: { requestId: r.id, bookingId: booking.id },
    });
    res.json({ success: true, bookingId: booking.id });
  } catch (err) {
    console.error('[instant:accept]', err.message);
    res.status(500).json({ success: false, message: 'Could not accept the request. · تعذّر قبول الطلب.' });
  }
};

exports.decline = async (req, res) => {
  try {
    const r = await loadOwnPending(req, res);
    if (!r) return;
    await requests.update(r.id, { status: 'declined', respondedAt: new Date().toISOString() });
    notify({
      userId: r.touristId, type: 'instant_declined',
      title: 'Guide unavailable', titleAr: 'المرشد غير متاح',
      body: 'The guide could not take your request. Try another nearby guide.',
      bodyAr: 'تعذّر على المرشد قبول طلبك. جرّب مرشدًا آخر قريبًا منك.',
      link: '/instant.html', metadata: { requestId: r.id },
    });
    res.json({ success: true });
  } catch (err) {
    console.error('[instant:decline]', err.message);
    res.status(500).json({ success: false });
  }
};

// ── Tourist: cancel own pending request ─────────────────────────
exports.cancel = async (req, res) => {
  try {
    const r = await requests.findById(req.params.id);
    if (!r) return res.status(404).json({ success: false });
    if (r.touristId !== req.session.userId) return res.status(403).json({ success: false, message: 'Access denied.' });
    if (r.status !== 'pending') return res.status(409).json({ success: false, message: 'Request already handled.' });
    await requests.update(r.id, { status: 'cancelled', respondedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (err) {
    console.error('[instant:cancel]', err.message);
    res.status(500).json({ success: false });
  }
};

// Exposed for unit tests.
exports._internals = { distanceKm, omanHHMM, isExpired, isFresh, REQUEST_TTL_MIN };
