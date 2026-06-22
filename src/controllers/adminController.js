const bcrypt = require('bcryptjs');
const { publicUser } = require('../utils/sanitizeUser');
const { v4: uuidv4 } = require('uuid');
const SupabaseDB = require('../models/SupabaseDB');
const email = require('../services/emailService');
const audit = require('../services/auditService');
const { ROLES, PERMISSIONS, getEffectivePermissions } = require('../config/permissions');

const users    = new SupabaseDB('users');
const bookings = new SupabaseDB('bookings');
const reviews  = new SupabaseDB('reviews', 'reviewId');
const messages    = new SupabaseDB('messages');
const packages    = new SupabaseDB('tour_packages');
const auditLog    = new SupabaseDB('admin_audit_log');
const expenses    = new SupabaseDB('finance_expenses');
const treasuryDB  = new SupabaseDB('treasury_transactions');
const invoicesDB  = new SupabaseDB('invoices');
const commission  = require('../services/commission');

// ── Recent activity feed ──────────────────────────────────────────────────────
// Aggregates real events from existing tables (registrations, new tours,
// bookings, status changes, reviews) into a single time-sorted timeline.
// Read-only — no extra logging required.
// Cache the heavy 4-table scan that builds the activity feed. Admin opens
// this every couple of minutes at most — a 30s cache keeps the page snappy
// AND protects Supabase Egress quota as the dataset grows.
let _activityCache = { at: 0, data: null, key: null };
const ACTIVITY_CACHE_MS = 30 * 1000;

exports.recentActivity = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 40, 100);
    const cacheKey = String(limit);
    if (_activityCache.data && _activityCache.key === cacheKey &&
        Date.now() - _activityCache.at < ACTIVITY_CACHE_MS) {
      return res.json({ success: true, cached: true, activity: _activityCache.data });
    }
    const [allUsers, allPackages, allBookings, allReviews] = await Promise.all([
      users.findAll().catch(() => []),
      packages.findAll().catch(() => []),
      bookings.findAll().catch(() => []),
      reviews.findAll().catch(() => []),
    ]);

    const nameById = {};
    (allUsers || []).forEach(u => { nameById[u.id] = u.companyName || u.fullName || u.email || u.id; });
    const events = [];
    const push = (at, type, icon, actor, actorType, en, ar) => {
      if (!at) return;
      events.push({ at, type, icon, actor, actorType, text_en: en, text_ar: ar });
    };

    // Registrations (guides & companies emphasised; tourists included)
    (allUsers || []).forEach(u => {
      if (u.userType === 'admin' || u.userType === 'staff') return;
      const who = u.companyName || u.fullName || u.email;
      const label = u.userType === 'guide' ? ['Guide', 'مرشد'] : u.userType === 'company' ? ['Company', 'شركة'] : ['Tourist', 'سائح'];
      push(u.createdAt, 'register', u.userType === 'company' ? '🏢' : u.userType === 'guide' ? '🎒' : '👤', who, u.userType,
        `${label[0]} "${who}" joined the platform`, `انضم ${label[1]} "${who}" إلى المنصة`);
    });

    // New tours published
    (allPackages || []).forEach(p => {
      const who = p.providerName || nameById[p.providerId] || 'A provider';
      push(p.createdAt, 'tour', '🗺️', who, 'guide',
        `${who} added a tour "${p.title}"`, `أضاف ${who} رحلة "${p.title}"`);
    });

    // Bookings: created + key status changes
    (allBookings || []).forEach(b => {
      const guide = nameById[b.guideId] || 'a guide';
      const tourist = nameById[b.touristId] || 'a tourist';
      push(b.createdAt, 'booking', '📅', tourist, 'tourist',
        `${tourist} booked ${b.destination || 'a tour'} with ${guide}`, `حجز ${tourist} رحلة ${b.destination || ''} مع ${guide}`);
      if (b.status === 'confirmed') push(b.updatedAt || b.confirmedAt, 'confirm', '✅', guide, 'guide',
        `${guide} confirmed a booking with ${tourist}`, `أكّد ${guide} حجزاً مع ${tourist}`);
      if (b.startedAt) push(b.startedAt, 'trip_start', '🚐', guide, 'guide',
        `${guide} started the ${b.destination || ''} tour`, `بدأ ${guide} رحلة ${b.destination || ''}`);
      if (b.completedAt) push(b.completedAt, 'trip_end', '🏁', guide, 'guide',
        `${guide} completed the ${b.destination || ''} tour`, `أنهى ${guide} رحلة ${b.destination || ''}`);
    });

    // Reviews
    (allReviews || []).forEach(r => {
      const who = r.touristName || nameById[r.touristId] || 'A traveler';
      const guide = nameById[r.guideId] || 'a guide';
      push(r.createdAt, 'review', '⭐', who, 'tourist',
        `${who} left a ${r.rating}★ review for ${guide}`, `ترك ${who} تقييماً ${r.rating}★ للمرشد ${guide}`);
    });

    events.sort((a, b) => new Date(b.at) - new Date(a.at));
    const sliced = events.slice(0, limit);
    _activityCache = { at: Date.now(), data: sliced, key: cacheKey };
    res.json({ success: true, cached: false, activity: sliced });
  } catch (err) {
    console.error('[recentActivity]', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/admin/email-test?to=you@example.com — sends a branded test email
// to the given address (or the admin alert recipient) and returns the result.
exports.emailTest = async (req, res) => {
  try {
    const cfg = email.emailConfig();
    const to = (req.query.to && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(req.query.to))
      ? req.query.to.trim()
      : (cfg.alertRecipients[0] || 'admin@guideon.om');
    const html = email.notificationEmail({
      icon: '✅', title: 'Guideon test email', titleAr: 'رسالة تجريبية من Guideon',
      body: 'This is a test email — your Guideon email delivery is working correctly.',
      bodyAr: 'هذه رسالة تجريبية — نظام البريد في Guideon يعمل بنجاح. 🎉',
      link: '/admin.html',
    });
    const result = await email.sendVerbose(to, '[Guideon] ✅ رسالة تجريبية', html);
    res.json({ success: true, sentTo: to, from: cfg.from, result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── One-time bulk image compression of existing Storage files ─────────
// GET /api/admin/compress-storage?dry=1   — preview only
// GET /api/admin/compress-storage         — actually compress and overwrite
//
// Runs the same sharp→WebP pipeline storageService uses for new uploads
// across every existing image in the bucket. Filenames stay the same so
// every URL already in the DB keeps working. Safe to re-run.
let _compressJob = null; // { running, started, done, tally }
exports.compressStorage = async (req, res) => {
  if (_compressJob && _compressJob.running) {
    return res.json({ success: true, alreadyRunning: true, job: publicJob(_compressJob) });
  }
  const dry = req.query.dry === '1' || req.query.dry === 'true';
  _compressJob = { running: true, dry, started: new Date().toISOString(), done: false, tally: blankTally() };

  // Respond immediately so the request doesn't time out; work continues in bg.
  res.json({ success: true, started: true, dry, message:
    dry ? 'Dry run started — check /api/admin/compress-storage/status' :
          'Compression started — check /api/admin/compress-storage/status' });

  runCompression(_compressJob).catch(err => {
    _compressJob.error = err.message;
    _compressJob.running = false;
    _compressJob.done = true;
    console.error('[compressStorage] FAILED:', err);
  });
};

exports.compressStorageStatus = async (req, res) => {
  if (!_compressJob) return res.json({ success: true, job: null, message: 'No job has been started.' });
  res.json({ success: true, job: publicJob(_compressJob) });
};

function blankTally() {
  return { seen: 0, compressed: 0, wouldCompress: 0,
    skipTiny: 0, skipNotImage: 0, skipAnimated: 0, skipNoGain: 0,
    errors: 0, bytesBefore: 0, bytesAfter: 0 };
}
function publicJob(j) {
  const savedBytes = j.tally.bytesBefore - j.tally.bytesAfter;
  return {
    running: j.running, dry: j.dry, started: j.started, done: j.done, error: j.error || null,
    tally: j.tally,
    savedMB: +(savedBytes / 1024 / 1024).toFixed(2),
    savedPct: j.tally.bytesBefore ? Math.round((savedBytes / j.tally.bytesBefore) * 100) : 0,
  };
}

async function runCompression(job) {
  const sharp = require('sharp');
  const path  = require('path');
  const { createClient } = require('@supabase/supabase-js');
  const sb = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
  );
  const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'media';

  const PRESETS = {
    avatars:  { maxWidth: 512,  maxHeight: 512,  quality: 78, fit: 'cover'  },
    gallery:  { maxWidth: 1600, maxHeight: 1600, quality: 78, fit: 'inside' },
    homepage: { maxWidth: 1600, maxHeight: 1600, quality: 78, fit: 'inside' },
    messages: { maxWidth: 1280, maxHeight: 1280, quality: 75, fit: 'inside' },
    reviews:  { maxWidth: 1280, maxHeight: 1280, quality: 78, fit: 'inside' },
    GENERIC:  { maxWidth: 1600, maxHeight: 1600, quality: 78, fit: 'inside' },
  };
  const presetFor = (folder) => PRESETS[String(folder || '').split('/')[0].toLowerCase()] || PRESETS.GENERIC;
  const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.tif', '.tiff', '.heic', '.heif', '.avif']);
  const SKIP_EXTS  = new Set(['.gif', '.svg', '.mp4', '.webm', '.mov', '.m4v', '.ogg']);

  async function* walk(prefix = '') {
    let offset = 0;
    const limit = 1000;
    while (true) {
      const { data, error } = await sb.storage.from(BUCKET).list(prefix, {
        limit, offset, sortBy: { column: 'name', order: 'asc' },
      });
      if (error) { console.warn('[compress] list', prefix, error.message); return; }
      if (!data || !data.length) return;
      for (const item of data) {
        const full = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id === null || item.metadata === null) yield* walk(full);
        else yield { path: full, size: item.metadata?.size || 0, mime: item.metadata?.mimetype || '' };
      }
      if (data.length < limit) return;
      offset += data.length;
    }
  }

  for await (const file of walk('')) {
    job.tally.seen++;
    const ext = path.extname(file.path).toLowerCase();
    if (SKIP_EXTS.has(ext))                                              { job.tally.skipAnimated++; continue; }
    if (!IMAGE_EXTS.has(ext) && !(file.mime || '').startsWith('image/')) { job.tally.skipNotImage++; continue; }
    if (file.size && file.size < 60 * 1024)                              { job.tally.skipTiny++; continue; }

    try {
      const { data: blob, error: dlErr } = await sb.storage.from(BUCKET).download(file.path);
      if (dlErr) { job.tally.errors++; continue; }
      const buf = Buffer.from(await blob.arrayBuffer());
      if (buf.length < 60 * 1024) { job.tally.skipTiny++; continue; }

      const preset = presetFor(path.dirname(file.path));
      const img = sharp(buf, { failOn: 'none' }).rotate();
      const meta = await img.metadata();
      if (meta.pages && meta.pages > 1) { job.tally.skipAnimated++; continue; }

      const compressed = await img
        .resize({ width: preset.maxWidth, height: preset.maxHeight, fit: preset.fit, withoutEnlargement: true })
        .webp({ quality: preset.quality, effort: 4 })
        .toBuffer();

      if (compressed.length >= buf.length) { job.tally.skipNoGain++; continue; }

      job.tally.bytesBefore += buf.length;
      job.tally.bytesAfter  += compressed.length;

      if (job.dry) {
        job.tally.wouldCompress++;
      } else {
        const { error: upErr } = await sb.storage.from(BUCKET).upload(file.path, compressed, {
          contentType: 'image/webp', upsert: true, cacheControl: '31536000',
        });
        if (upErr) { job.tally.errors++; continue; }
        job.tally.compressed++;
      }
    } catch (e) {
      job.tally.errors++;
      console.warn('[compress] error', file.path, e.message);
    }
  }
  job.running = false;
  job.done = true;
  job.finished = new Date().toISOString();
}

// GET /api/admin/whatsapp-test?to=96895255450 — sends a test WhatsApp message
// and returns the exact result so the integration can be verified.
exports.whatsappTest = async (req, res) => {
  try {
    const whatsapp = require('../services/whatsappService');
    const to = req.query.to || '96895255450';
    const mode = req.query.mode || 'template'; // template | text

    let result;
    if (mode === 'text') {
      result = await whatsapp.sendTextVerbose(to, '✅ Guideon WhatsApp test — تكامل الواتساب يعمل بنجاح! 🎉');
    } else {
      // Use approved template (works outside 24h window too)
      const tplName = process.env.WHATSAPP_TEMPLATE_NAME || 'guideon_alert';
      const tplLang = process.env.WHATSAPP_TEMPLATE_LANG || 'ar';
      result = await whatsapp.sendTemplate(to, tplName, tplLang, [
        'Guideon اختبار',
        'تكامل الواتساب يعمل بنجاح ✅',
      ]);
      result = result ? { ok: true, data: result } : { ok: false, error: 'Template send failed' };
    }
    res.json({ success: true, config: whatsapp.config(), sentTo: to, mode, result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// CSV helper: convert array of objects to CSV
function toCSV(rows, columns) {
  if (!rows?.length) return '';
  const cols = columns || Object.keys(rows[0]);
  const escape = (v) => {
    if (v == null) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map(r => cols.map(c => escape(r[c])).join(','))].join('\n');
}

// GET /api/admin/stats/extended — richer analytics
// ── Revenue analytics ─────────────────────────────────────────────────────────
// Powers the Admin Revenue Dashboard (admin-revenue.html). Computes every
// money metric from the bookings table in a single pass. "Revenue" = the
// platform's view of paid bookings; a booking counts toward revenue only
// when isPaid is true (Thawani-confirmed) — pending/failed are tracked
// separately for the funnel + alerts.
//
// Money lives in OMR (3-decimal). All figures are rounded to 3 places.
//
// Cached 30s: the admin refreshes often, and this scans the whole bookings
// table — caching protects Supabase egress as data grows.
let _revenueCache = { at: 0, data: null, key: null };
const REVENUE_CACHE_MS = 30 * 1000;

function _round3(n) { return Math.round((Number(n) || 0) * 1000) / 1000; }

// Inclusive day-key (YYYY-MM-DD) in UTC — stable regardless of server TZ.
function _dayKey(d) {
  const dt = new Date(d);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}
function _monthKey(d) {
  const dt = new Date(d);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
}

exports.revenue = async (req, res) => {
  try {
    // Commission rates differ by provider type (guide vs company) and can be
    // overridden per provider. Resolve per booking via commission.rateFor.
    const RATES = await commission.getRates();
    const COMMISSION_RATE = RATES.guide; // representative default for headline %

    const cacheKey = 'revenue';
    if (_revenueCache.data && Date.now() - _revenueCache.at < REVENUE_CACHE_MS && _revenueCache.key === cacheKey) {
      return res.json({ success: true, cached: true, data: _revenueCache.data });
    }

    const [allUsers, allBookings, allExpenses] = await Promise.all([
      users.readAll(),
      bookings.readAll(),
      expenses.readAll().catch(() => []),  // table may not exist yet → empty
    ]);

    const userById = Object.fromEntries(allUsers.map(u => [u.id, u]));
    const now = new Date();

    // ── A paid booking is one revenue event. Pick the money date: paidAt if
    //    present, else createdAt (older rows pre-date the paidAt column). ──
    const paid = allBookings.filter(b => b.isPaid && (b.totalAmount != null));
    const moneyDate = (b) => b.paidAt || b.createdAt || now.toISOString();

    // ── Period helpers ──
    const within = (b, fromDate) => new Date(moneyDate(b)) >= fromDate;
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const d7   = new Date(now);  d7.setUTCDate(now.getUTCDate() - 7);
    const d30  = new Date(now);  d30.setUTCDate(now.getUTCDate() - 30);
    const d365 = new Date(now);  d365.setUTCFullYear(now.getUTCFullYear() - 1);
    // Previous comparable windows (for growth %)
    const d14  = new Date(now);  d14.setUTCDate(now.getUTCDate() - 14);
    const d60  = new Date(now);  d60.setUTCDate(now.getUTCDate() - 60);

    const sumAmount = (arr) => _round3(arr.reduce((s, b) => s + (parseFloat(b.totalAmount) || 0), 0));

    const revToday   = sumAmount(paid.filter(b => within(b, startOfToday)));
    const rev7        = sumAmount(paid.filter(b => within(b, d7)));
    const rev30       = sumAmount(paid.filter(b => within(b, d30)));
    const rev365      = sumAmount(paid.filter(b => within(b, d365)));
    const revTotal    = sumAmount(paid);

    // Per-provider commission resolution. Each provider (guide/company) may
    // have a different rate; sum the exact commission across paid bookings.
    const providerRateFor = (b) => commission.rateFor(userById[b.guideId], RATES);
    const platformEarningsExact = _round3(
      paid.reduce((s, b) => s + (parseFloat(b.totalAmount) || 0) * providerRateFor(b), 0)
    );

    // Previous periods for growth comparison
    const revPrev7  = sumAmount(paid.filter(b => within(b, d14) && !within(b, d7)));
    const revPrev30 = sumAmount(paid.filter(b => within(b, d60) && !within(b, d30)));
    const growth = (cur, prev) => prev > 0 ? _round3(((cur - prev) / prev) * 100) : (cur > 0 ? 100 : 0);

    // ── Transactions count + AOV ──
    const txnCount = paid.length;
    const aov = txnCount ? _round3(revTotal / txnCount) : 0;

    // ── Funnel: paid vs pending vs failed/cancelled ──
    const pendingPay = allBookings.filter(b => !b.isPaid && b.status === 'confirmed').length;
    const cancelled  = allBookings.filter(b => b.status === 'cancelled').length;

    // ── Time-series: daily revenue (last 30 days) ──
    const dailyMap = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setUTCDate(now.getUTCDate() - i);
      dailyMap[_dayKey(d)] = 0;
    }
    for (const b of paid) {
      const k = _dayKey(moneyDate(b));
      if (k in dailyMap) dailyMap[k] += (parseFloat(b.totalAmount) || 0);
    }
    const daily = Object.entries(dailyMap).map(([date, revenue]) => ({ date, revenue: _round3(revenue) }));

    // ── Time-series: monthly revenue (last 12 months) ──
    const monthMap = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      monthMap[_monthKey(d)] = 0;
    }
    for (const b of paid) {
      const k = _monthKey(moneyDate(b));
      if (k in monthMap) monthMap[k] += (parseFloat(b.totalAmount) || 0);
    }
    const monthly = Object.entries(monthMap).map(([month, revenue]) => ({ month, revenue: _round3(revenue) }));

    // ── Revenue by source: individual guide vs tour company ──
    let revGuides = 0, revCompanies = 0;
    for (const b of paid) {
      const provider = userById[b.guideId];
      const amt = parseFloat(b.totalAmount) || 0;
      if (provider && provider.userType === 'company') revCompanies += amt;
      else revGuides += amt;
    }
    const bySource = [
      { source: 'guides',    label: 'مرشدون أفراد',     revenue: _round3(revGuides) },
      { source: 'companies', label: 'شركات سياحيّة',    revenue: _round3(revCompanies) },
    ];

    // ── Top earners (providers by paid revenue) ──
    const earnerMap = {};
    for (const b of paid) {
      const amt = parseFloat(b.totalAmount) || 0;
      if (!earnerMap[b.guideId]) earnerMap[b.guideId] = { revenue: 0, txns: 0 };
      earnerMap[b.guideId].revenue += amt;
      earnerMap[b.guideId].txns    += 1;
    }
    const topEarners = Object.entries(earnerMap)
      .map(([id, v]) => {
        const u = userById[id];
        return {
          id,
          name: u ? (u.companyName || u.fullName || 'Unknown') : 'Unknown',
          type: u ? u.userType : 'guide',
          revenue: _round3(v.revenue),
          txns: v.txns,
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // ── Revenue by destination ──
    const destMap = {};
    for (const b of paid) {
      if (!b.destination) continue;
      destMap[b.destination] = (destMap[b.destination] || 0) + (parseFloat(b.totalAmount) || 0);
    }
    const byDestination = Object.entries(destMap)
      .map(([destination, revenue]) => ({ destination, revenue: _round3(revenue) }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // ── Payment methods. The platform currently routes everything through
    //    Thawani (cards + Thawani wallet). We don't yet persist the card
    //    network, so we report by gateway. Failed = confirmed-but-unpaid. ──
    const methods = [
      { method: 'Thawani', revenue: revTotal, count: txnCount, failed: pendingPay },
    ];

    // ── Recent transactions (latest 100 paid) for the table ──
    const transactions = paid
      .slice()
      .sort((a, b) => new Date(moneyDate(b)) - new Date(moneyDate(a)))
      .slice(0, 100)
      .map(b => {
        const tourist  = userById[b.touristId];
        const provider = userById[b.guideId];
        return {
          id: b.id,
          ref: b.paymentRef || b.paymentSessionId || '—',
          tourist: tourist ? tourist.fullName : 'Unknown',
          provider: provider ? (provider.companyName || provider.fullName) : 'Unknown',
          destination: b.destination || '—',
          amount: _round3(b.totalAmount),
          commission: _round3((parseFloat(b.totalAmount) || 0) * providerRateFor(b)),
          status: b.isPaid ? 'paid' : (b.status === 'cancelled' ? 'cancelled' : 'pending'),
          method: 'Thawani',
          date: moneyDate(b),
        };
      });

    // ── Pending (confirmed-but-unpaid) shown in the table too, flagged ──
    const pendingTxns = allBookings
      .filter(b => !b.isPaid && b.status === 'confirmed' && b.totalAmount != null)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 50)
      .map(b => {
        const tourist  = userById[b.touristId];
        const provider = userById[b.guideId];
        return {
          id: b.id,
          ref: b.paymentSessionId || '—',
          tourist: tourist ? tourist.fullName : 'Unknown',
          provider: provider ? (provider.companyName || provider.fullName) : 'Unknown',
          destination: b.destination || '—',
          amount: _round3(b.totalAmount),
          commission: _round3((parseFloat(b.totalAmount) || 0) * providerRateFor(b)),
          status: 'pending',
          method: 'Thawani',
          date: b.createdAt,
        };
      });

    // ── Alerts: anomaly detection on the daily series ──
    const alerts = [];
    const last7Vals  = daily.slice(-7).map(d => d.revenue);
    const prev7Vals  = daily.slice(-14, -7).map(d => d.revenue);
    const avg = (a) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
    const last7Avg = avg(last7Vals), prev7Avg = avg(prev7Vals);
    if (prev7Avg > 0 && last7Avg < prev7Avg * 0.6) {
      alerts.push({ level: 'danger', code: 'revenue_drop',
        message: `انخفاض حادّ في الإيرادات: متوسّط آخر 7 أيّام ${_round3(last7Avg)} ر.ع مقابل ${_round3(prev7Avg)} ر.ع للأسبوع السابق.` });
    }
    if (prev7Avg > 0 && last7Avg > prev7Avg * 1.8) {
      alerts.push({ level: 'success', code: 'revenue_spike',
        message: `ارتفاع كبير في الإيرادات: +${growth(last7Avg, prev7Avg)}% مقارنةً بالأسبوع السابق. 🎉` });
    }
    // Payment-failure pressure: many confirmed bookings never get paid
    const confirmedTotal = allBookings.filter(b => b.status === 'confirmed' || b.isPaid).length;
    if (confirmedTotal >= 10 && pendingPay / confirmedTotal > 0.4) {
      alerts.push({ level: 'warning', code: 'payment_failures',
        message: `${pendingPay} حجزاً مؤكَّداً لم يُدفع (${_round3((pendingPay / confirmedTotal) * 100)}%). تحقّق من بوّابة الدفع أو ذكّر السيّاح.` });
    }
    if (!alerts.length) {
      alerts.push({ level: 'info', code: 'all_clear', message: 'كل المؤشّرات ضمن النطاق الطبيعي. ✅' });
    }

    const data = {
      currency: 'OMR',
      commissionRate: COMMISSION_RATE,
      generatedAt: now.toISOString(),
      overview: {
        revTotal, revToday, rev7, rev30, rev365,
        growth7:  growth(rev7,  revPrev7),
        growth30: growth(rev30, revPrev30),
        txnCount, aov,
        pendingPay, cancelled,
        platformEarnings: platformEarningsExact,
        providerPayouts:  _round3(revTotal - platformEarningsExact),
      },
      daily,
      monthly,
      bySource,
      topEarners,
      byDestination,
      methods,
      transactions: [...transactions, ...pendingTxns],
      alerts,
      // Subscriptions: GUIDEON is commission-per-booking, no recurring plans.
      subscriptions: { enabled: false, note: 'النموذج عمولة لكل حجز — لا اشتراكات متكرّرة حالياً.' },
      finance: buildFinanceSummary(allExpenses, { revTotal, platformEarnings: platformEarningsExact, now, d30 }),
    };

    _revenueCache = { at: Date.now(), data, key: cacheKey };
    res.json({ success: true, cached: false, data });
  } catch (err) {
    console.error('[admin:revenue]', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── Financial management: expense ledger (salaries / discounts / costs) ────────
// Categories the UI offers. Anything else maps to "other".
const EXPENSE_CATEGORIES = [
  'salary', 'discount', 'marketing', 'operational',
  'refund', 'commission_payout', 'tax', 'rent', 'software', 'other',
];

// Summary block folded into the revenue payload so the dashboard can show
// net profit without a second request.
function buildFinanceSummary(allExpenses, { revTotal, platformEarnings, now, d30 }) {
  const list = Array.isArray(allExpenses) ? allExpenses : [];
  const r3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;

  const expTotal = r3(list.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0));
  const exp30 = r3(list
    .filter(e => e.spentAt && new Date(e.spentAt) >= d30)
    .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0));

  // By category
  const byCatMap = {};
  for (const e of list) {
    const c = EXPENSE_CATEGORIES.includes(e.category) ? e.category : 'other';
    byCatMap[c] = (byCatMap[c] || 0) + (parseFloat(e.amount) || 0);
  }
  const byCategory = Object.entries(byCatMap)
    .map(([category, amount]) => ({ category, amount: r3(amount) }))
    .sort((a, b) => b.amount - a.amount);

  // Monthly recurring (salaries/rent flagged recurring) — a forward run-rate
  const recurringMonthly = r3(list
    .filter(e => e.recurring)
    .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0));

  // Net profit. The platform's *real* take is its commission, not gross
  // booking value (the rest is owed to providers). So:
  //   netProfit = platformEarnings(commission) − expenses
  // We also expose gross net (revTotal − expenses) for those who treat
  // the whole booking as revenue.
  const netProfit      = r3((platformEarnings || 0) - expTotal);
  const netGross       = r3((revTotal || 0) - expTotal);
  const margin = platformEarnings > 0 ? r3((netProfit / platformEarnings) * 100) : 0;

  return {
    expTotal, exp30, recurringMonthly,
    netProfit, netGross, margin,
    byCategory,
    count: list.length,
  };
}

// GET /api/admin/expenses — full ledger, newest first
exports.listExpenses = async (req, res) => {
  try {
    const list = await expenses.readAll();
    list.sort((a, b) => new Date(b.spentAt || b.createdAt) - new Date(a.spentAt || a.createdAt));
    res.json({ success: true, expenses: list, categories: EXPENSE_CATEGORIES });
  } catch (err) {
    console.error('[admin:listExpenses]', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/admin/expenses — record a new expense/salary/discount
exports.createExpense = async (req, res) => {
  try {
    const { category, title, amount, spentAt, recurring, payee, relatedUserId, note, currency } = req.body || {};

    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'العنوان مطلوب.' });
    }
    const amt = parseFloat(amount);
    if (!(amt > 0)) {
      return res.status(400).json({ success: false, message: 'المبلغ يجب أن يكون رقماً موجباً.' });
    }
    const cat = EXPENSE_CATEGORIES.includes(category) ? category : 'other';

    const record = {
      id: 'exp-' + uuidv4().slice(0, 10),
      category: cat,
      title: String(title).trim().slice(0, 160),
      amount: Math.round(amt * 1000) / 1000,
      currency: currency || 'OMR',
      spentAt: spentAt ? String(spentAt).slice(0, 10) : new Date().toISOString().slice(0, 10),
      recurring: !!recurring,
      payee: payee ? String(payee).slice(0, 120) : null,
      relatedUserId: relatedUserId || null,
      note: note ? String(note).slice(0, 600) : null,
      createdBy: req.session.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = await expenses.insert(record);
    _revenueCache = { at: 0, data: null, key: null }; // bust so net profit refreshes
    audit.logAction(req, { action: 'createExpense', targetType: 'finance', targetId: record.id, details: { category: cat, title: record.title, amount: record.amount } });
    res.status(201).json({ success: true, expense: saved || record });
  } catch (err) {
    console.error('[admin:createExpense]', err);
    res.status(500).json({ success: false, message: 'تعذّر حفظ المصروف.' });
  }
};

// PATCH /api/admin/expenses/:id — edit an expense
exports.updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await expenses.findById(id);
    if (!existing) return res.status(404).json({ success: false, message: 'المصروف غير موجود.' });

    const changes = { updatedAt: new Date().toISOString() };
    const b = req.body || {};
    if (b.title != null)    changes.title = String(b.title).trim().slice(0, 160);
    if (b.amount != null) {
      const amt = parseFloat(b.amount);
      if (!(amt > 0)) return res.status(400).json({ success: false, message: 'المبلغ غير صالح.' });
      changes.amount = Math.round(amt * 1000) / 1000;
    }
    if (b.category != null) changes.category = EXPENSE_CATEGORIES.includes(b.category) ? b.category : 'other';
    if (b.spentAt != null)  changes.spentAt = String(b.spentAt).slice(0, 10);
    if (b.recurring != null) changes.recurring = !!b.recurring;
    if (b.payee != null)    changes.payee = b.payee ? String(b.payee).slice(0, 120) : null;
    if (b.note != null)     changes.note = b.note ? String(b.note).slice(0, 600) : null;

    const saved = await expenses.update(id, changes);
    _revenueCache = { at: 0, data: null, key: null };
    audit.logAction(req, { action: 'updateExpense', targetType: 'finance', targetId: id, details: changes });
    res.json({ success: true, expense: saved });
  } catch (err) {
    console.error('[admin:updateExpense]', err);
    res.status(500).json({ success: false, message: 'تعذّر تحديث المصروف.' });
  }
};

// DELETE /api/admin/expenses/:id
exports.deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await expenses.findById(id);
    if (!existing) return res.status(404).json({ success: false, message: 'المصروف غير موجود.' });
    await expenses.delete(id);
    _revenueCache = { at: 0, data: null, key: null };
    audit.logAction(req, { action: 'deleteExpense', targetType: 'finance', targetId: id, details: { title: existing.title, amount: existing.amount } });
    res.json({ success: true });
  } catch (err) {
    console.error('[admin:deleteExpense]', err);
    res.status(500).json({ success: false, message: 'تعذّر حذف المصروف.' });
  }
};

// ── Provider payouts ──────────────────────────────────────────────────────────
// "Available" = paid + completed bookings that haven't been settled yet.
// Net payout uses each provider's resolved commission rate.
// GET /api/admin/payouts — providers with an outstanding balance
exports.listPayouts = async (req, res) => {
  try {
    const RATES = await commission.getRates();
    const [allUsers, allBookings] = await Promise.all([users.readAll(), bookings.readAll()]);
    const userById = Object.fromEntries(allUsers.map(u => [u.id, u]));

    const due = {}; // providerId -> { gross, net, count }
    for (const b of allBookings) {
      if (!b.isPaid || b.status !== 'completed' || b.paidOutAt || b.totalAmount == null) continue;
      const provider = userById[b.guideId];
      const rate = commission.rateFor(provider, RATES);
      const gross = parseFloat(b.totalAmount) || 0;
      const net = gross * (1 - rate); // VAT on the platform fee handled in invoices
      if (!due[b.guideId]) due[b.guideId] = { gross: 0, net: 0, count: 0 };
      due[b.guideId].gross += gross; due[b.guideId].net += net; due[b.guideId].count += 1;
    }

    const payouts = Object.entries(due).map(([id, v]) => {
      const u = userById[id];
      return {
        providerId: id,
        name: u ? (u.companyName || u.fullName || 'Unknown') : 'Unknown',
        type: u ? u.userType : 'guide',
        email: u ? u.email : '',
        rate: commission.rateFor(u, RATES),
        bookings: v.count,
        gross: Math.round(v.gross * 1000) / 1000,
        net:   Math.round(v.net * 1000) / 1000,
      };
    }).sort((a, b) => b.net - a.net);

    const totalDue = Math.round(payouts.reduce((s, p) => s + p.net, 0) * 1000) / 1000;
    res.json({ success: true, payouts, totalDue, rates: RATES });
  } catch (err) {
    console.error('[admin:listPayouts]', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/admin/payouts/:providerId/settle  { ref? }
// Marks all of a provider's available bookings as paid out.
exports.settlePayout = async (req, res) => {
  try {
    const { providerId } = req.params;
    const ref = (req.body && req.body.ref ? String(req.body.ref) : '').slice(0, 120);
    const mine = (await bookings.findAllByField('guideId', providerId))
      .filter(b => b.isPaid && b.status === 'completed' && !b.paidOutAt && b.totalAmount != null);
    if (!mine.length) return res.status(400).json({ success: false, message: 'No settleable bookings for this provider.' });

    const now = new Date().toISOString();
    let settled = 0;
    for (const b of mine) {
      try {
        await bookings.update(b.id, { paidOutAt: now, payoutRef: ref || null, payoutBy: req.session.userId });
        settled++;
      } catch (e) {
        // paidOutAt column missing → migration 038 not run yet
        if (/column|schema cache|paidOutAt/i.test(String(e.message))) {
          return res.status(500).json({ success: false, message: 'Payout tracking needs migration 038 — run it in Supabase, then retry.' });
        }
        throw e;
      }
    }
    _revenueCache = { at: 0, data: null, key: null };
    audit.logAction(req, { action: 'settlePayout', targetType: 'user', targetId: providerId, details: { bookings: settled, ref } });
    res.json({ success: true, settled });
  } catch (err) {
    console.error('[admin:settlePayout]', err.message);
    res.status(500).json({ success: false, message: 'Could not settle the payout.' });
  }
};

// ── Event teams (admin) ──
exports.allTeams = async (req, res) => {
  try {
    const p = await userPage(req, { userType: 'team' });
    res.json({ success: true, teams: stripPassword(p.rows), total: p.total, page: parseInt(req.query.page) || 1, pageSize: p.limit, hasMore: p.hasMore });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error.' }); }
};
exports.pendingTeams = async (req, res) => {
  try {
    const p = await userPage(req, { userType: 'team' },
      t => t.isVerified !== true && t.isSuspended !== true);
    res.json({ success: true, teams: stripPassword(p.rows), total: p.total, page: parseInt(req.query.page) || 1, pageSize: p.limit, hasMore: p.hasMore });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error.' }); }
};
exports.verifyTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const team = await users.findById(id);
    if (!team || team.userType !== 'team') {
      return res.status(404).json({ success: false, message: 'Team not found.' });
    }
    await users.update(id, { isVerified: true });
    audit.logAction(req, { action: 'verifyTeam', targetType: 'user', targetId: id, details: { name: team.teamName } });
    res.json({ success: true, message: `${team.teamName} has been verified and is now public.` });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
};

exports.extendedStats = async (req, res) => {
  try {
    const [allUsers, allBookings, allReviews] = await Promise.all([
      users.readAll(),
      bookings.readAll(),
      reviews.readAll(),
    ]);

    // Bookings per guide (top 10)
    const guideBookings = {};
    for (const b of allBookings) {
      if (b.status === 'cancelled') continue;
      guideBookings[b.guideId] = (guideBookings[b.guideId] || 0) + 1;
    }
    const guideIdToName = Object.fromEntries(allUsers.filter(u => u.userType === 'guide').map(g => [g.id, g.fullName]));
    const topGuides = Object.entries(guideBookings)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, count]) => ({ id, name: guideIdToName[id] || 'Unknown', bookings: count }));

    // Bookings per destination (top 10)
    const destCount = {};
    for (const b of allBookings) {
      if (!b.destination) continue;
      destCount[b.destination] = (destCount[b.destination] || 0) + 1;
    }
    const topDestinations = Object.entries(destCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([destination, count]) => ({ destination, count }));

    // Revenue by month (last 12 months)
    const now = new Date();
    const monthly = {};
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthly[key] = 0;
    }
    for (const b of allBookings) {
      if (!b.isPaid || !b.createdAt) continue;
      const d = new Date(b.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (key in monthly) monthly[key] += (parseFloat(b.totalAmount) || 0);
    }
    const revenueByMonth = Object.entries(monthly).reverse().map(([month, revenue]) => ({ month, revenue: Math.round(revenue * 100) / 100 }));

    // Bookings status timeline (last 30 days)
    const last30 = new Date(); last30.setDate(last30.getDate() - 30);
    const recentBookings = allBookings.filter(b => b.createdAt && new Date(b.createdAt) >= last30);

    // Average rating
    const avgRating = allReviews.length
      ? Math.round((allReviews.reduce((s, r) => s + (r.rating || 0), 0) / allReviews.length) * 100) / 100
      : 0;

    // New users last 7 days
    const last7 = new Date(); last7.setDate(last7.getDate() - 7);
    const newUsersWeek = allUsers.filter(u => u.createdAt && new Date(u.createdAt) >= last7).length;

    res.json({
      success: true,
      data: {
        topGuides,
        topDestinations,
        revenueByMonth,
        recentBookingsCount: recentBookings.length,
        avgRating,
        totalReviews: allReviews.length,
        newUsersWeek,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.stats = async (req, res) => {
  try {
    const allUsers    = await users.readAll();
    const allBookings = await bookings.readAll();
    const guides    = allUsers.filter(u => u.userType === 'guide');
    const tourists  = allUsers.filter(u => u.userType === 'tourist');
    const companies = allUsers.filter(u => u.userType === 'company');
    const revenue   = allBookings
      .filter(b => b.isPaid === true)
      .reduce((s, b) => s + (parseFloat(b.totalAmount) || 0), 0);

    res.json({
      success: true, stats: {
        totalGuides:         guides.length,
        verifiedGuides:      guides.filter(g => g.isVerified).length,
        pendingGuides:       guides.filter(g => !g.isVerified && !g.isSuspended).length,
        licensedGuides:      guides.filter(g => g.isMinistryLicensed).length,
        unlicensedGuides:    guides.filter(g => !g.isMinistryLicensed).length,
        totalTourists:       tourists.length,
        totalCompanies:      companies.length,
        verifiedCompanies:   companies.filter(c => c.isVerified).length,
        pendingCompanies:    companies.filter(c => !c.isVerified && !c.isSuspended).length,
        totalBookings:       allBookings.length,
        pendingBookings:     allBookings.filter(b => b.status === 'pending').length,
        confirmedBookings:   allBookings.filter(b => b.status === 'confirmed').length,
        completedBookings:   allBookings.filter(b => b.status === 'completed').length,
        cancelledBookings:   allBookings.filter(b => b.status === 'cancelled').length,
        totalRevenue:        Math.round(revenue * 100) / 100,
        guideRatings:        guides.map(g => g.rating || 0),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// Shared helper: page through the users table. Honours ?page, ?pageSize
// and ?q (search by name / email / company name).
//
// Uses findAllWhere (reliable equality fetch) then sorts/searches/slices
// in JS. The earlier findPage path — which pushed order + count:'exact'
// + range to Postgres — returned 0 rows on production, so we avoid it
// here too. The users table is small; JS paging is more than fine.
async function userPage(req, extraEq = {}, jsFilter = null) {
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize) || 50, 1), 200);
  const page     = Math.max(parseInt(req.query.page) || 1, 1);
  const q        = (req.query.q || '').trim().toLowerCase();

  // Equality filters (userType / isVerified / isSuspended) — server-side.
  let rows = Object.keys(extraEq).length
    ? await users.findAllWhere(extraEq)
    : await users.readAll();

  // Optional JS post-filter — used for boolean conditions where an `eq` filter
  // would wrongly drop NULL rows (e.g. a freshly-registered guide whose
  // isVerified/isSuspended isn't a strict `false`). See CLAUDE.md gotcha.
  if (jsFilter) rows = rows.filter(jsFilter);

  // Free-text search across name / email / company name (JS).
  if (q) {
    rows = rows.filter(u =>
      [u.fullName, u.email, u.companyName].some(v => (v || '').toLowerCase().includes(q))
    );
  }

  // Newest first.
  rows.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  const total   = rows.length;
  const offset  = (page - 1) * pageSize;
  const hasMore = offset + pageSize < total;
  const slice   = rows.slice(offset, offset + pageSize);
  return { rows: slice, total, hasMore, limit: pageSize, offset };
}

function stripPassword(arr) {
  return (arr || []).map(publicUser);
}

exports.pendingGuides = async (req, res) => {
  try {
    const p = await userPage(req, { userType: 'guide' },
      g => g.isVerified !== true && g.isSuspended !== true);
    res.json({ success: true, guides: stripPassword(p.rows), total: p.total, page: parseInt(req.query.page) || 1, pageSize: p.limit, hasMore: p.hasMore });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error.' }); }
};

exports.allGuides = async (req, res) => {
  try {
    const p = await userPage(req, { userType: 'guide' });
    res.json({ success: true, guides: stripPassword(p.rows), total: p.total, page: parseInt(req.query.page) || 1, pageSize: p.limit, hasMore: p.hasMore });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error.' }); }
};

exports.allTourists = async (req, res) => {
  try {
    const p = await userPage(req, { userType: 'tourist' });
    res.json({ success: true, tourists: stripPassword(p.rows), total: p.total, page: parseInt(req.query.page) || 1, pageSize: p.limit, hasMore: p.hasMore });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error.' }); }
};

exports.allCompanies = async (req, res) => {
  try {
    const p = await userPage(req, { userType: 'company' });
    res.json({ success: true, companies: stripPassword(p.rows), total: p.total, page: parseInt(req.query.page) || 1, pageSize: p.limit, hasMore: p.hasMore });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error.' }); }
};

exports.pendingCompanies = async (req, res) => {
  try {
    const p = await userPage(req, { userType: 'company' },
      c => c.isVerified !== true && c.isSuspended !== true);
    res.json({ success: true, companies: stripPassword(p.rows), total: p.total, page: parseInt(req.query.page) || 1, pageSize: p.limit, hasMore: p.hasMore });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error.' }); }
};

exports.verifyGuide = async (req, res) => {
  try {
    const { id } = req.params;
    const guide = await users.findById(id);
    if (!guide || guide.userType !== 'guide') {
      return res.status(404).json({ success: false, message: 'Guide not found.' });
    }
    await users.update(id, { isVerified: true });
    audit.logAction(req, { action: 'verifyGuide', targetType: 'user', targetId: id, details: { name: guide.fullName } });
    email.sendGuideVerified({ email: guide.email, name: guide.fullName }).catch(() => {});
    res.json({ success: true, message: `${guide.fullName} has been verified and is now visible in search results.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.verifyCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const company = await users.findById(id);
    if (!company || company.userType !== 'company') {
      return res.status(404).json({ success: false, message: 'Company not found.' });
    }
    await users.update(id, { isVerified: true });
    audit.logAction(req, { action: 'verifyCompany', targetType: 'user', targetId: id, details: { name: company.companyName } });
    email.sendCompanyVerified({ email: company.email, name: company.fullName, companyName: company.companyName }).catch(() => {});
    res.json({ success: true, message: `${company.companyName} has been approved and is now listed on the platform.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.suspendUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await users.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    await users.update(id, { isSuspended: true, isVerified: false });
    audit.logAction(req, { action: 'suspendUser', targetType: 'user', targetId: id, details: { name: user.fullName, reason: req.body?.reason } });
    res.json({ success: true, message: `${user.fullName}'s account has been suspended.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.unsuspendUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await users.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    await users.update(id, { isSuspended: false });
    audit.logAction(req, { action: 'unsuspendUser', targetType: 'user', targetId: id, details: { name: user.fullName } });
    res.json({ success: true, message: `${user.fullName}'s account has been reactivated.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.allBookings = async (req, res) => {
  try {
    const list = await bookings.readAll();
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const enriched = await Promise.all(list.map(async b => {
      const guide   = await users.findById(b.guideId);
      const tourist = await users.findById(b.touristId);
      return {
        ...b,
        guideName:    guide   ? guide.fullName   : 'Unknown',
        guideEmail:   guide   ? guide.email       : '',
        guidePhone:   guide   ? (guide.phone || '') : '',
        guideVerified: guide  ? !!guide.isVerified : false,
        guideRating:  guide   ? (guide.rating || 0) : 0,
        guidePricePerDay: guide ? (guide.pricePerDay || 0) : 0,
        touristName:  tourist ? tourist.fullName  : 'Unknown',
        touristEmail: tourist ? tourist.email     : '',
        touristPhone: tourist ? (tourist.phone || '') : '',
      };
    }));
    res.json({ success: true, bookings: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/admin/create-admin — only existing admins can create new admins
exports.createAdmin = async (req, res) => {
  try {
    const { fullName, email: adminEmail, password, phone } = req.body;

    if (!fullName || !adminEmail || !password) {
      return res.status(400).json({ success: false, message: 'fullName, email and password are required.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
      return res.status(400).json({ success: false, message: 'Invalid email address.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    const existing = await users.findByField('email', adminEmail.toLowerCase());
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const record = {
      id: 'admin-' + uuidv4().slice(0, 8),
      fullName,
      email: adminEmail.toLowerCase(),
      password: hashed,
      phone: phone || '',
      userType: 'admin',
      isVerified: true,
      isSuspended: false,
      emailVerified: true,
      createdAt: new Date().toISOString(),
    };

    await users.insert(record);
    audit.logAction(req, { action: 'createAdmin', targetType: 'user', targetId: record.id, details: { name: fullName, email: adminEmail } });
    const { password: _, ...safe } = record;
    res.status(201).json({ success: true, message: `Admin account created for ${fullName}.`, user: safe });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// DELETE /api/admin/users/:id — permanently delete a user (admin only)
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (id === req.session.userId) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
    }
    const user = await users.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (user.userType === 'admin') {
      return res.status(403).json({ success: false, message: 'Admin accounts cannot be deleted here.' });
    }

    // Clean up related data so nothing is left orphaned on the platform.
    try {
      if (user.userType === 'guide' || user.userType === 'company') {
        const pkgs = await packages.findAllByField('providerId', id).catch(() => []);
        for (const p of (pkgs || [])) await packages.delete(p.id).catch(() => {});
      }
      const allBk = await bookings.readAll().catch(() => []);
      for (const b of (allBk || [])) {
        if (b.guideId === id || b.touristId === id) await bookings.delete(b.id).catch(() => {});
      }
      const allRv = await reviews.readAll().catch(() => []);
      for (const r of (allRv || [])) {
        if (r.guideId === id || r.touristId === id) await reviews.delete(r.reviewId).catch(() => {});
      }
      const allMsg = await messages.readAll().catch(() => []);
      for (const m of (allMsg || [])) {
        if (m.fromId === id || m.toId === id) await messages.delete(m.id).catch(() => {});
      }
    } catch (_) { /* best-effort cleanup */ }

    await users.delete(id);
    audit.logAction(req, { action: 'deleteUser', targetType: 'user', targetId: id, details: { name: user.fullName, email: user.email, userType: user.userType } });
    res.json({ success: true, message: `${user.fullName} and their data have been permanently deleted.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/admin/admins — list all admin accounts
exports.allAdmins = async (req, res) => {
  try {
    const admins = await users.findAllByField('userType', 'admin');
    res.json({ success: true, admins: admins.map(publicUser) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.markBookingComplete = async (req, res) => {
  try {
    const { id } = req.params;
    const b = await bookings.findById(id);
    if (!b) return res.status(404).json({ success: false, message: 'Booking not found.' });
    await bookings.update(id, { status: 'completed' });
    audit.logAction(req, { action: 'markBookingComplete', targetType: 'booking', targetId: id });
    res.json({ success: true, message: 'Booking marked as completed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ════════════════════════════════════════════════════════════════════
//  NEW ADMIN POWERS
// ════════════════════════════════════════════════════════════════════

// PATCH /api/admin/users/:id — edit any user's profile fields
exports.editUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await users.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    // Allowlist of editable fields (never expose password/tokens via this endpoint)
    const allowed = ['fullName', 'email', 'phone', 'nationality', 'preferredLanguage',
      'pricePerDay', 'bio', 'languages', 'specialisations', 'destinations', 'isVerified',
      'isMinistryLicensed', 'licenceNumber', 'companyName', 'companyRegNo',
      'companyServices', 'companyDestinations', 'companyDescription', 'photo'];

    const changes = {};
    const before = {};
    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        before[field] = user[field];
        changes[field] = req.body[field];
      }
    }
    if (req.body.email) changes.email = req.body.email.toLowerCase();
    if (req.body.pricePerDay !== undefined) changes.pricePerDay = parseFloat(req.body.pricePerDay) || 0;

    if (Object.keys(changes).length === 0) {
      return res.status(400).json({ success: false, message: 'No changes provided.' });
    }

    const updated = await users.update(id, changes);
    audit.logAction(req, {
      action: 'editUser', targetType: 'user', targetId: id,
      details: { before, after: changes },
    });
    const { password, resetPasswordToken, emailVerifyToken, ...safe } = updated;
    res.json({ success: true, message: 'User updated.', user: safe });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/admin/users/:id/reset-password — admin resets a user's password
exports.adminResetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }
    const user = await users.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await users.update(id, { password: hashed });
    audit.logAction(req, { action: 'adminResetPassword', targetType: 'user', targetId: id, details: { name: user.fullName } });
    res.json({ success: true, message: `Password reset for ${user.fullName}.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/admin/bookings/:id/cancel — admin override cancellation
exports.adminCancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason || reason.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Cancellation reason required (min 3 chars).' });
    }

    const booking = await bookings.findById(id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
    if (booking.status === 'cancelled') return res.status(400).json({ success: false, message: 'Already cancelled.' });

    await bookings.update(id, {
      status: 'cancelled',
      cancellationReason: reason,
      cancelledBy: req.session.userId,
      cancelledAt: new Date().toISOString(),
    });

    // Restore date to guide availability
    const guide = await users.findById(booking.guideId);
    if (guide) {
      const avail = Array.isArray(guide.availability) ? guide.availability : [];
      if (!avail.includes(booking.tourDate)) {
        await users.update(booking.guideId, { availability: [...avail, booking.tourDate] });
      }
    }

    // Notify both parties
    const tourist = await users.findById(booking.touristId);
    const emailData = {
      destination: booking.destination, tourDate: booking.tourDate,
      totalAmount: booking.totalAmount, bookingId: id,
    };
    if (tourist) email.sendTouristBookingCancelled({ email: tourist.email, name: tourist.fullName, guideName: guide?.fullName, ...emailData }).catch(() => {});
    if (guide)   email.sendGuideBookingCancelled({ email: guide.email, name: guide.fullName, touristName: tourist?.fullName, ...emailData }).catch(() => {});

    audit.logAction(req, { action: 'adminCancelBooking', targetType: 'booking', targetId: id, details: { reason } });
    res.json({ success: true, message: 'Booking cancelled.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/admin/broadcast — send email to all users in a group
exports.broadcastEmail = async (req, res) => {
  try {
    const { audience, subject, message } = req.body;
    const validAudiences = ['all', 'tourist', 'guide', 'company'];
    if (!validAudiences.includes(audience)) {
      return res.status(400).json({ success: false, message: 'Invalid audience.' });
    }
    if (!subject || !message || subject.trim().length < 3 || message.trim().length < 10) {
      return res.status(400).json({ success: false, message: 'Subject and message required.' });
    }

    let recipients;
    if (audience === 'all') {
      const all = await users.readAll();
      recipients = all.filter(u => u.userType !== 'admin' && !u.isSuspended);
    } else {
      recipients = await users.findAllByField('userType', audience);
      recipients = recipients.filter(u => !u.isSuspended);
    }

    // Send in chunks of 20 to respect rate limits
    const safeSubject = subject.trim();
    const safeMessage = message.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ''); // strip script tags
    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px">
        <div style="background:white;padding:40px;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.08)">
          <h2 style="color:#0f7b6c;margin:0 0 20px">${safeSubject}</h2>
          <div style="font-size:15px;line-height:1.7;color:#333;white-space:pre-wrap">${safeMessage}</div>
          <hr style="margin:32px 0;border:none;border-top:1px solid #eee">
          <p style="font-size:12px;color:#999;text-align:center;margin:0">Sent from Guideon admin · You can reply to this email.</p>
        </div>
      </div>`;

    let sent = 0, failed = 0;
    for (const u of recipients) {
      try {
        await email.send(u.email, safeSubject, html);
        sent++;
      } catch { failed++; }
    }

    audit.logAction(req, {
      action: 'broadcastEmail', targetType: 'audience', targetId: audience,
      details: { subject: safeSubject, recipients: recipients.length, sent, failed },
    });
    res.json({ success: true, message: `Sent to ${sent} recipients (${failed} failed).`, sent, failed, total: recipients.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// DELETE /api/admin/reviews/:id — remove inappropriate review
exports.deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    const review = await reviews.findById(id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found.' });

    await reviews.delete(id);

    // Recalculate guide's rating
    const guideReviews = await reviews.findAllByField('guideId', review.guideId);
    const avg = guideReviews.length ? guideReviews.reduce((s, r) => s + r.rating, 0) / guideReviews.length : 0;
    await users.update(review.guideId, {
      rating: Math.round(avg * 10) / 10,
      totalReviews: guideReviews.length,
    });

    audit.logAction(req, { action: 'deleteReview', targetType: 'review', targetId: id, details: { reason: req.body?.reason } });
    res.json({ success: true, message: 'Review deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// DELETE /api/admin/messages/:id — remove inappropriate message
exports.deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    try {
      await messages.delete(id);
    } catch (e) { return res.status(404).json({ success: false, message: 'Message not found or already deleted.' }); }
    audit.logAction(req, { action: 'deleteMessage', targetType: 'message', targetId: id, details: { reason: req.body?.reason } });
    res.json({ success: true, message: 'Message deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/admin/audit-log?limit=100&action=verifyGuide
exports.getAuditLog = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const all = await auditLog.readAll();
    let filtered = all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (req.query.action) filtered = filtered.filter(a => a.action === req.query.action);
    if (req.query.adminId) filtered = filtered.filter(a => a.adminId === req.query.adminId);
    res.json({ success: true, entries: filtered.slice(0, limit), total: filtered.length });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/admin/export/:resource — CSV export
exports.exportCSV = async (req, res) => {
  try {
    const { resource } = req.params;
    let rows, filename, columns;

    switch (resource) {
      case 'users':
        rows = await users.readAll();
        rows = rows.map(publicUser);
        columns = ['id', 'fullName', 'email', 'phone', 'userType', 'nationality', 'isVerified', 'isSuspended', 'emailVerified', 'createdAt'];
        filename = 'guideon-users.csv';
        break;
      case 'bookings':
        rows = await bookings.readAll();
        columns = ['id', 'touristId', 'guideId', 'destination', 'tourDate', 'duration', 'participants', 'totalAmount', 'status', 'isPaid', 'createdAt'];
        filename = 'guideon-bookings.csv';
        break;
      case 'reviews':
        rows = await reviews.readAll();
        columns = ['reviewId', 'guideId', 'touristId', 'rating', 'comment', 'createdAt'];
        filename = 'guideon-reviews.csv';
        break;
      case 'audit-log':
        rows = await auditLog.readAll();
        rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        columns = ['id', 'adminId', 'adminName', 'action', 'targetType', 'targetId', 'ip', 'createdAt'];
        filename = 'guideon-audit-log.csv';
        break;
      default:
        return res.status(400).json({ success: false, message: 'Unknown resource. Use: users, bookings, reviews, audit-log' });
    }

    audit.logAction(req, { action: 'exportCSV', targetType: 'resource', targetId: resource });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('﻿' + toCSV(rows, columns)); // BOM for Excel UTF-8 support
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ════════════════════════════════════════════════════════════════════
//  STAFF MANAGEMENT (super admin only)
// ════════════════════════════════════════════════════════════════════

// GET /api/admin/staff — list all staff members
exports.allStaff = async (req, res) => {
  try {
    const staff = await users.findAllByField('userType', 'staff');
    const safe = staff.map(publicUser);
    res.json({ success: true, staff: safe });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/admin/staff/roles — list available role templates
exports.staffRoles = (req, res) => {
  const roles = Object.entries(ROLES).map(([key, r]) => ({
    key,
    label: r.label,
    description: r.description,
    permissions: r.permissions,
  }));
  const allPerms = Object.entries(PERMISSIONS).map(([key, value]) => ({ key, value }));
  res.json({ success: true, roles, permissions: allPerms });
};

// POST /api/admin/staff — create a new staff member
exports.createStaff = async (req, res) => {
  try {
    const { fullName, email: staffEmail, password, phone, role, customPermissions } = req.body;

    if (!fullName || !staffEmail || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(staffEmail)) {
      return res.status(400).json({ success: false, message: 'Invalid email address.' });
    }

    // Resolve permissions: role template OR custom list
    let permissions;
    if (role && ROLES[role]) {
      permissions = ROLES[role].permissions;
    } else if (Array.isArray(customPermissions)) {
      permissions = customPermissions.filter(p => Object.values(PERMISSIONS).includes(p));
    } else {
      return res.status(400).json({ success: false, message: 'Either role or customPermissions required.' });
    }

    const existing = await users.findByField('email', staffEmail.toLowerCase());
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const record = {
      id: 'staff-' + uuidv4().slice(0, 8),
      fullName,
      email: staffEmail.toLowerCase(),
      password: hashed,
      phone: phone || '',
      userType: 'staff',
      staffRole: role || 'custom',
      permissions,
      isVerified: true,
      isSuspended: false,
      emailVerified: true,
      createdBy: req.session.userId,
      createdAt: new Date().toISOString(),
    };

    try {
      await users.insert(record);
    } catch (insErr) {
      // Strip any column the schema doesn't have yet (e.g. createdBy) and retry.
      const m = String(insErr?.message || '').match(/Could not find the '([^']+)' column/);
      if (m) { delete record[m[1]]; await users.insert(record); }
      else throw insErr;
    }
    audit.logAction(req, {
      action: 'createStaff', targetType: 'user', targetId: record.id,
      details: { name: fullName, email: staffEmail, role: role || 'custom', permissions },
    });

    // Welcome email with credentials
    email.send(staffEmail, '🎉 Welcome to Guideon Team',
      `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px">
        <div style="background:white;border-radius:12px;padding:40px;box-shadow:0 4px 16px rgba(0,0,0,0.08)">
          <h2 style="color:#0f7b6c">Welcome to the Guideon Team, ${fullName}! 👋</h2>
          <p>You've been added as <strong>${ROLES[role]?.label || 'Staff'}</strong>.</p>
          <div style="background:#e8f5f2;padding:16px;border-radius:8px;margin:20px 0">
            <strong>Your login credentials:</strong><br>
            Email: <code>${staffEmail}</code><br>
            Password: <code>${password}</code><br>
            <em style="font-size:.85em;color:#666">Please change your password after first login.</em>
          </div>
          <p>Sign in here: <a href="${process.env.APP_URL || 'https://guideon.om'}/login.html">${process.env.APP_URL || 'https://guideon.om'}/login.html</a></p>
        </div>
      </div>`
    ).catch(() => {});

    const { password: _, ...safe } = record;
    res.status(201).json({ success: true, message: `Staff account created for ${fullName}.`, staff: safe });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PATCH /api/admin/staff/:id — update staff role / permissions
exports.updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, phone, role, customPermissions, isSuspended } = req.body;

    const staff = await users.findById(id);
    if (!staff || staff.userType !== 'staff') {
      return res.status(404).json({ success: false, message: 'Staff member not found.' });
    }

    const changes = {};
    if (fullName !== undefined) changes.fullName = fullName;
    if (phone !== undefined)    changes.phone = phone;
    if (isSuspended !== undefined) changes.isSuspended = !!isSuspended;
    if (role && ROLES[role]) {
      changes.staffRole = role;
      changes.permissions = ROLES[role].permissions;
    } else if (Array.isArray(customPermissions)) {
      changes.staffRole = 'custom';
      changes.permissions = customPermissions.filter(p => Object.values(PERMISSIONS).includes(p));
    }

    if (Object.keys(changes).length === 0) {
      return res.status(400).json({ success: false, message: 'No changes provided.' });
    }

    const updated = await users.update(id, changes);
    audit.logAction(req, { action: 'updateStaff', targetType: 'user', targetId: id, details: changes });
    res.json({ success: true, message: 'Staff member updated.', staff: publicUser(updated) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// DELETE /api/admin/staff/:id — remove a staff account
exports.deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const staff = await users.findById(id);
    if (!staff || staff.userType !== 'staff') {
      return res.status(404).json({ success: false, message: 'Staff member not found.' });
    }
    await users.delete(id);
    audit.logAction(req, { action: 'deleteStaff', targetType: 'user', targetId: id, details: { name: staff.fullName, email: staff.email } });
    res.json({ success: true, message: `${staff.fullName} has been removed from staff.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/admin/me/permissions — current user's effective permissions
exports.myPermissions = (req, res) => {
  if (!req.user) return res.status(401).json({ success: false });
  const perms = getEffectivePermissions(req.user);
  res.json({
    success: true,
    userType: req.user.userType,
    staffRole: req.user.staffRole || null,
    permissions: perms,
    isSuperAdmin: req.user.userType === 'admin',
  });
};

// ════════════════════════════════════════════════════════════════════════════
//  TREASURY — the company's main vault (bank-account-style running balance)
//  Balance = platform commission income (auto) + manual deposits
//            − total expenses − manual withdrawals/sends.
// ════════════════════════════════════════════════════════════════════════════
async function _treasurySnapshot() {
  const RATES = await commission.getRates();
  const [allUsers, allBookings, allExpenses, txns] = await Promise.all([
    users.readAll(),
    bookings.readAll(),
    expenses.readAll().catch(() => []),
    treasuryDB.readAll().catch(() => []),
  ]);
  const userById = Object.fromEntries(allUsers.map(u => [u.id, u]));

  // Auto income = the platform's commission on every paid booking.
  let income = 0;
  for (const b of allBookings) {
    if (!b.isPaid || b.totalAmount == null) continue;
    const rate = commission.rateFor(userById[b.guideId], RATES);
    income += (parseFloat(b.totalAmount) || 0) * rate;
  }
  income = _round3(income);

  const expensesTotal = _round3((allExpenses || []).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0));

  let manualIn = 0, manualOut = 0;
  for (const t of (txns || [])) {
    const amt = parseFloat(t.amount) || 0;
    if (t.type === 'deposit') manualIn += amt; else manualOut += amt; // withdrawal | send
  }
  manualIn = _round3(manualIn); manualOut = _round3(manualOut);

  const balance = _round3(income + manualIn - expensesTotal - manualOut);
  return { balance, income, expensesTotal, manualIn, manualOut, txns: txns || [], userById };
}

// GET /api/admin/treasury — balance + manual ledger
exports.treasury = async (req, res) => {
  try {
    const s = await _treasurySnapshot();
    const transactions = s.txns
      .map(t => ({
        id: t.id, type: t.type, amount: _round3(t.amount),
        description: t.description || '', payeeId: t.payeeId || null,
        payeeName: t.payeeName || '', createdAt: t.createdAt,
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({
      success: true,
      data: {
        balance: s.balance, income: s.income, expenses: s.expensesTotal,
        manualIn: s.manualIn, manualOut: s.manualOut, transactions,
      },
    });
  } catch (err) {
    console.error('[admin:treasury]', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/admin/treasury — record a manual deposit / withdrawal / send
exports.addTreasuryTxn = async (req, res) => {
  try {
    const { type, amount, description, payeeId } = req.body;
    if (!['deposit', 'withdrawal', 'send'].includes(type)) {
      return res.status(400).json({ success: false, message: 'نوع العمليّة غير صحيح.' });
    }
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ success: false, message: 'المبلغ يجب أن يكون رقماً أكبر من صفر.' });
    }
    let payeeName = '';
    if (payeeId) {
      const u = await users.findById(payeeId).catch(() => null);
      payeeName = u ? (u.companyName || u.fullName || '') : '';
    }
    const row = {
      id: 'trz-' + uuidv4().slice(0, 8),
      type, amount: _round3(amt),
      description: String(description || '').slice(0, 300),
      payeeId: payeeId || null, payeeName,
      createdAt: new Date().toISOString(), createdBy: req.session.userId,
    };
    await treasuryDB.insert(row);
    audit.logAction(req, { action: 'treasuryTxn', targetType: 'treasury', targetId: row.id, details: { type, amount: amt, payeeName } });
    const s = await _treasurySnapshot();
    res.json({ success: true, balance: s.balance, transaction: row });
  } catch (err) {
    console.error('[admin:addTreasuryTxn]', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// DELETE /api/admin/treasury/:id — remove a manual entry (correction)
exports.deleteTreasuryTxn = async (req, res) => {
  try {
    await treasuryDB.delete(req.params.id);
    audit.logAction(req, { action: 'treasuryTxnDelete', targetType: 'treasury', targetId: req.params.id });
    const s = await _treasurySnapshot();
    res.json({ success: true, balance: s.balance });
  } catch (err) {
    console.error('[admin:deleteTreasuryTxn]', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/admin/providers?type=guide|company|team — list providers to pay
exports.providersByType = async (req, res) => {
  try {
    const type = req.query.type;
    if (!['guide', 'company', 'team'].includes(type)) {
      return res.status(400).json({ success: false, message: 'نوع غير صحيح.' });
    }
    const list = await users.findAllWhere({ userType: type }).catch(() => []);
    const providers = list
      .filter(u => !u.isSuspended)
      .map(u => ({ id: u.id, name: u.companyName || u.teamName || u.fullName || u.email || u.id, email: u.email || '' }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
    res.json({ success: true, providers });
  } catch (err) {
    console.error('[admin:providersByType]', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/admin/treasury/:id/voucher — auto-issued payment voucher (PDF)
exports.treasuryVoucher = async (req, res) => {
  try {
    const all = await treasuryDB.readAll().catch(() => []);
    const t = all.find(x => x.id === req.params.id);
    if (!t) return res.status(404).json({ success: false, message: 'العمليّة غير موجودة.' });
    const payee = t.payeeId ? await users.findById(t.payeeId).catch(() => null) : null;
    const invoice = require('../services/invoiceService');
    const pdf = await invoice.generatePaymentVoucher(
      { id: t.id, amount: t.amount, description: t.description, createdAt: t.createdAt },
      {
        name: t.payeeName || (payee ? (payee.companyName || payee.teamName || payee.fullName) : 'Provider'),
        type: payee ? payee.userType : 'guide',
        email: payee ? payee.email : '',
      }
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="voucher-${t.id}.pdf"`);
    res.send(pdf);
  } catch (err) {
    console.error('[admin:treasuryVoucher]', err.message);
    res.status(500).json({ success: false, message: 'تعذّر توليد الفاتورة.' });
  }
};

// ════════════════════════════════════════════════════════════════════════════
//  INVOICES — admin-issued invoices for guides / companies / teams (line items)
// ════════════════════════════════════════════════════════════════════════════
// POST /api/admin/invoices  { recipientId, items:[{desc,amount}], note }
exports.createInvoice = async (req, res) => {
  try {
    const { recipientId, items, note } = req.body;
    const list = Array.isArray(items)
      ? items.map(it => ({ desc: String(it.desc || '').slice(0, 200), amount: _round3(it.amount) }))
             .filter(it => it.amount > 0)
      : [];
    if (!recipientId) return res.status(400).json({ success: false, message: 'اختر المستفيد.' });
    if (!list.length) return res.status(400).json({ success: false, message: 'أضف بنداً واحداً على الأقلّ بمبلغ صحيح.' });
    const u = await users.findById(recipientId).catch(() => null);
    if (!u) return res.status(404).json({ success: false, message: 'المستفيد غير موجود.' });

    const RATES = await commission.getRates();
    const subtotal = _round3(list.reduce((s, it) => s + it.amount, 0));
    const vatRate  = RATES.vat || 0;
    const vat      = _round3(subtotal * vatRate);
    const total    = _round3(subtotal + vat);
    const id = 'inv-' + uuidv4().slice(0, 8);
    const invoice = require('../services/invoiceService');
    const number = invoice.invoiceDocNumber(id, new Date().toISOString());
    const row = {
      id, number, recipientId,
      recipientName: u.companyName || u.teamName || u.fullName || '', recipientType: u.userType,
      items: list, subtotal, vatRate, vat, total,
      note: String(note || '').slice(0, 300),
      createdAt: new Date().toISOString(), createdBy: req.session.userId,
    };
    await invoicesDB.insert(row);
    audit.logAction(req, { action: 'createInvoice', targetType: 'invoice', targetId: id, details: { recipient: row.recipientName, total } });
    res.json({ success: true, invoice: row });
  } catch (err) {
    console.error('[admin:createInvoice]', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/admin/invoices — list issued invoices
exports.listInvoices = async (req, res) => {
  try {
    const all = await invoicesDB.readAll().catch(() => []);
    const invoices = all
      .map(i => ({ id: i.id, number: i.number, recipientName: i.recipientName, recipientType: i.recipientType, total: _round3(i.total), createdAt: i.createdAt }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, invoices });
  } catch (err) {
    console.error('[admin:listInvoices]', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/admin/invoices/:id/pdf — download an issued invoice
exports.invoicePdf = async (req, res) => {
  try {
    const all = await invoicesDB.readAll().catch(() => []);
    const inv = all.find(x => x.id === req.params.id);
    if (!inv) return res.status(404).json({ success: false, message: 'الفاتورة غير موجودة.' });
    const RATES = await commission.getRates();
    const invoice = require('../services/invoiceService');
    const pdf = await invoice.generateInvoice(
      { id: inv.id, number: inv.number, items: inv.items, note: inv.note, createdAt: inv.createdAt },
      { name: inv.recipientName, type: inv.recipientType, email: '' },
      inv.vatRate != null ? inv.vatRate : (RATES.vat || 0), RATES.vatNumber || ''
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${inv.number}.pdf"`);
    res.send(pdf);
  } catch (err) {
    console.error('[admin:invoicePdf]', err.message);
    res.status(500).json({ success: false, message: 'تعذّر توليد الفاتورة.' });
  }
};

// DELETE /api/admin/invoices/:id
exports.deleteInvoice = async (req, res) => {
  try {
    await invoicesDB.delete(req.params.id);
    audit.logAction(req, { action: 'deleteInvoice', targetType: 'invoice', targetId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    console.error('[admin:deleteInvoice]', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
