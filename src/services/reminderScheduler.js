/**
 * Pre-tour reminder scheduler.
 *
 * Sends a "your tour is soon" reminder ~12 hours before the tour start, through
 * the central notify() hub — so it reaches the tourist (and guide) via in-app
 * notification, email, AND WhatsApp automatically.
 *
 * Timing: tour dates are day-granular (`tourDate`) with a period (`tourTime`)
 * or an explicit `startTime`. We derive a nominal Oman-local start time, convert
 * to UTC (Oman = UTC+4, no DST), and fire when the tour is in the [12h, 13h)
 * window from now. Running hourly, each booking matches exactly one run — no DB
 * flag needed. An in-process Set guards against a double-run within the same
 * hour (e.g. right after a restart).
 */
const SupabaseDB = require('../models/SupabaseDB');
const { notify } = require('./notificationService');

const bookings = new SupabaseDB('bookings');
const users    = new SupabaseDB('users');

const REMINDER_STATUSES = ['confirmed', 'paid'];   // confirmed & upcoming only
const NOMINAL_HOUR = { morning: 8, half_day: 8, full_day: 8, afternoon: 13, evening: 17 };

// Booking ids already reminded this process lifetime (cleared daily).
let sent = new Set();
let sentDay = null;

// Oman-local nominal tour start → epoch ms (UTC). Oman is UTC+4 year-round.
function tourStartMs(b) {
  if (!b.tourDate || !/^\d{4}-\d{2}-\d{2}$/.test(b.tourDate)) return null;
  const [y, m, d] = b.tourDate.split('-').map(Number);
  let hh = 9, mm = 0;
  if (b.startTime && /^\d{1,2}:\d{2}/.test(String(b.startTime))) {
    [hh, mm] = String(b.startTime).split(':').map(Number);
  } else {
    hh = NOMINAL_HOUR[b.tourTime] ?? 9;
  }
  return Date.UTC(y, m - 1, d, hh - 4, mm || 0);
}

// Send the reminder for one booking via notify() (tourist + guide).
async function sendReminderFor(b) {
  const tourist = b.touristId ? await users.findById(b.touristId) : null;
  const guide   = b.guideId ? await users.findById(b.guideId) : null;
  const dest = b.destination || 'your tour';
  const guideName = guide?.companyName || guide?.fullName || 'your guide';

  if (tourist) notify({
    userId: tourist.id, type: 'booking_reminder',
    title: 'Tour reminder ⏰', titleAr: 'تذكير بجولتك ⏰',
    body: `Your ${dest} tour with ${guideName} is coming up soon (${b.tourDate}). Get ready!`,
    bodyAr: `جولتك إلى ${dest} مع ${guideName} قريبة (${b.tourDate}). استعدّ لها!`,
    link: '/tourist-dashboard.html#bookings', metadata: { bookingId: b.id },
  });
  if (guide) notify({
    userId: guide.id, type: 'booking_reminder',
    title: 'Upcoming tour ⏰', titleAr: 'جولة قادمة ⏰',
    body: `Your ${dest} tour is coming up soon (${b.tourDate}). Get ready!`,
    bodyAr: `جولتك إلى ${dest} قريبة (${b.tourDate}). استعدّ لها!`,
    link: '/guide-dashboard.html#bookings', metadata: { bookingId: b.id },
  });
}

async function runOnce() {
  try {
    // Reset the daily dedup set.
    const today = new Date().toISOString().slice(0, 10);
    if (sentDay !== today) { sent = new Set(); sentDay = today; }

    const now = Date.now();
    const all = await bookings.readAll();
    const due = (all || []).filter(b => {
      if (!REMINDER_STATUSES.includes(b.status)) return false;
      if (sent.has(b.id)) return false;
      const start = tourStartMs(b);
      if (start == null) return false;
      const hours = (start - now) / 3600000;
      return hours >= 12 && hours < 13;
    });
    if (!due.length) return;

    for (const b of due) {
      sent.add(b.id);
      await sendReminderFor(b);
    }
    console.log(`[reminders] sent ${due.length} pre-tour reminder(s)`);
  } catch (e) {
    console.error('[reminders] runOnce error:', e.message);
  }
}

// Start the hourly loop. First pass 60s after boot (lets the app settle).
function start() {
  setTimeout(runOnce, 60 * 1000);
  setInterval(runOnce, 60 * 60 * 1000);
  console.log('[reminders] pre-tour reminder scheduler started (12h window, hourly).');
}

module.exports = { start, runOnce, sendReminderFor };
