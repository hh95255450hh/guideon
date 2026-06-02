/**
 * Notification service — writes in-app notifications and (optionally) sends emails.
 * Fire-and-forget: callers should not await this if they don't need the result.
 */
const { v4: uuidv4 } = require('uuid');
const SupabaseDB = require('../models/SupabaseDB');
const emailService = require('./emailService');
const whatsapp     = require('./whatsappService');
const push         = require('./pushService');
const sse          = require('./sseHub');

const notifications = new SupabaseDB('notifications');
const users         = new SupabaseDB('users');

// Canonical site URL — driven by APP_URL so it follows whatever domain is live.
const BASE_URL = process.env.APP_URL || 'https://guideon.guide';

/**
 * Create an in-app notification.
 * @param {Object} opts
 * @param {string} opts.userId    — recipient
 * @param {string} opts.type      — booking_new / booking_accepted / message / trip_start / etc.
 * @param {string} opts.title     — short headline
 * @param {string} [opts.body]    — longer description
 * @param {string} [opts.link]    — URL to open when clicked
 * @param {string} [opts.icon]    — emoji shown in the bell list
 * @param {Object} [opts.metadata]
 * @param {Object} [opts.email]   — { subject, html } if you also want an email
 */
// Bilingual formatter — produces "English text\n\n──────\n\nArabic text"
function bilingual(en, ar) {
  if (en && ar) return `${en}\n\n──────\n\n${ar}`;
  return en || ar || '';
}

async function notify(opts) {
  if (!opts?.userId || !opts?.type || !opts?.title) return null;
  try {
    // If caller provided Arabic versions (titleAr / bodyAr), build a bilingual string.
    const title = opts.titleAr ? bilingual(opts.title, opts.titleAr) : opts.title;
    const body  = opts.bodyAr  ? bilingual(opts.body || '', opts.bodyAr) : (opts.body || '');

    const row = {
      id:       'ntf-' + uuidv4().slice(0, 10),
      userId:   opts.userId,
      type:     opts.type,
      title:    title.slice(0, 400),
      body:     body.slice(0, 2000),
      link:     opts.link || null,
      icon:     opts.icon || pickDefaultIcon(opts.type),
      isRead:   false,
      metadata: opts.metadata || null,
      createdAt: new Date().toISOString(),
    };
    await notifications.insert(row);

    // ── Real-time in-app bell (SSE) — updates the bell instantly ──
    try { sse.publish(opts.userId, 'notification', row); } catch (_) {}

    // ── Web Push (VAPID) — reaches the user even when the site is closed ──
    try {
      const link = opts.link ? (opts.link.startsWith('http') ? opts.link : BASE_URL + opts.link) : BASE_URL;
      const icon = opts.icon || pickDefaultIcon(opts.type);
      push.sendToUser(opts.userId, {
        title: `${icon} ${opts.titleAr || opts.title}`.slice(0, 80),
        body:  (opts.bodyAr || opts.body || '').slice(0, 160),
        tag:   opts.type,
        data:  { url: link },
      }).catch(() => {});
    } catch (_) {}

    // Look up the user once for both email + WhatsApp delivery.
    let user = null;
    try { user = await users.findById(opts.userId); } catch (_) {}

    // Email channel — important notifications are emailed to the user's
    // registered address (unless they opted out). High-frequency, low-value
    // types (chat messages) are NOT emailed, to protect domain reputation /
    // deliverability — they still get in-app + push instantly.
    const EMAIL_SKIP_TYPES = ['message'];
    if (user && user.email && !EMAIL_SKIP_TYPES.includes(opts.type)) {
      try {
        const prefs = user.notifPrefs?.email || {};
        const channel = pickEmailChannel(opts.type);
        const allowed = prefs[channel] !== false; // default: send
        if (allowed) {
          const icon = opts.icon || pickDefaultIcon(opts.type);
          const link = opts.link ? (opts.link.startsWith('http') ? opts.link : BASE_URL + opts.link) : BASE_URL;
          const subject = (opts.email && opts.email.subject) || `${icon} ${opts.titleAr || opts.title}`;
          const html = (opts.email && opts.email.html) || emailService.notificationEmail({
            icon, title: opts.title, titleAr: opts.titleAr, body: opts.body, bodyAr: opts.bodyAr, link,
          });
          emailService.send(user.email, subject, html).catch(() => {});
        }
      } catch (_) { /* never fail the notify because of email */ }
    }

    // WhatsApp channel — fires for every notification if user has a phone +
    // hasn't disabled WhatsApp in their preferences. No-op if WHATSAPP_ENABLED!=true.
    if (user && user.phone && whatsapp.isEnabled()) {
      try {
        const prefs = user.notifPrefs?.whatsapp || {};
        const channel = pickEmailChannel(opts.type);
        if (prefs[channel] !== false) {
          const link = opts.link ? (opts.link.startsWith('http') ? opts.link : BASE_URL + opts.link) : BASE_URL;
          const icon = opts.icon || pickDefaultIcon(opts.type);

          // Build bilingual WhatsApp message: English block + Arabic block + link.
          const enBlock = `${icon} ${opts.title}\n${opts.body || ''}`.trim();
          const arBlock = opts.titleAr || opts.bodyAr
            ? `${icon} ${opts.titleAr || ''}\n${opts.bodyAr || ''}`.trim()
            : '';
          const waBody = arBlock
            ? `${enBlock}\n\n──────\n\n${arBlock}\n\n🔗 ${link}`
            : `${enBlock}\n\n🔗 ${link}`;

          whatsapp.sendText(user.phone, waBody).catch(() => {});
        }
      } catch (_) { /* never fail the notify because of whatsapp */ }
    }

    return row;
  } catch (e) {
    console.error('[notify]', e.message);
    return null;
  }
}

function pickDefaultIcon(type) {
  return ({
    booking_new:        '📅',
    booking_accepted:   '✅',
    booking_declined:   '❌',
    booking_cancelled:  '🚫',
    booking_completed:  '🎉',
    booking_reminder:   '⏰',
    trip_start:         '🚐',
    trip_end:           '🏁',
    message:            '💬',
    review:             '⭐',
    payout:             '💰',
    system:             'ℹ️',
    welcome:            '👋',
    verification:       '🔒',
  })[type] || '🔔';
}

function pickEmailChannel(type) {
  if (type.startsWith('booking_') || type.startsWith('trip_')) return 'bookings';
  if (type === 'message') return 'messages';
  if (type === 'booking_reminder') return 'reminders';
  return 'system';
}

module.exports = { notify };
