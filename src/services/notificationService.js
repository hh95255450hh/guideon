/**
 * Notification service — writes in-app notifications and (optionally) sends emails.
 * Fire-and-forget: callers should not await this if they don't need the result.
 */
const { v4: uuidv4 } = require('uuid');
const SupabaseDB = require('../models/SupabaseDB');
const emailService = require('./emailService');

const notifications = new SupabaseDB('notifications');
const users         = new SupabaseDB('users');

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
async function notify(opts) {
  if (!opts?.userId || !opts?.type || !opts?.title) return null;
  try {
    const row = {
      id:       'ntf-' + uuidv4().slice(0, 10),
      userId:   opts.userId,
      type:     opts.type,
      title:    opts.title.slice(0, 200),
      body:     (opts.body || '').slice(0, 1000),
      link:     opts.link || null,
      icon:     opts.icon || pickDefaultIcon(opts.type),
      isRead:   false,
      metadata: opts.metadata || null,
      createdAt: new Date().toISOString(),
    };
    await notifications.insert(row);

    // If caller passed email payload AND user opted-in for that channel, send it.
    if (opts.email && opts.email.subject && opts.email.html) {
      try {
        const user = await users.findById(opts.userId);
        const prefs = user?.notifPrefs?.email || {};
        const channel = pickEmailChannel(opts.type);
        const allowed = prefs[channel] !== false; // default true
        if (allowed && user?.email) {
          emailService.send(user.email, opts.email.subject, opts.email.html).catch(() => {});
        }
      } catch (_) { /* never fail the notify because of email lookup */ }
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
