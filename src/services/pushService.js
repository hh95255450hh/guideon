/**
 * pushService — standard Web Push (VAPID). No Firebase required.
 *
 * Stores subscriptions in the push_subscriptions table and sends notifications
 * to every device a user has registered. Dead subscriptions (410/404) are
 * pruned automatically. Fully no-op if VAPID keys aren't configured, so the
 * app never crashes when push isn't set up.
 */
const webpush = require('web-push');
const { v4: uuidv4 } = require('uuid');
const SupabaseDB = require('../models/SupabaseDB');

const subs = new SupabaseDB('push_subscriptions');

let _ready = false;
(function init() {
  const pub  = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@guideon.om';
  if (pub && priv) {
    try {
      webpush.setVapidDetails(subject, pub, priv);
      _ready = true;
    } catch (e) {
      console.warn('[push] VAPID init failed:', e.message);
    }
  } else {
    console.warn('[push] disabled — set VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY to enable.');
  }
})();

function isEnabled() { return _ready; }
function publicKey() { return process.env.VAPID_PUBLIC_KEY || ''; }

/** Save (or refresh) a subscription for a user. */
async function saveSubscription(userId, subscription, userAgent) {
  if (!subscription || !subscription.endpoint) throw new Error('Invalid subscription');
  // Upsert by endpoint (a device re-subscribing keeps one row)
  const existing = await subs.findByField('endpoint', subscription.endpoint).catch(() => null);
  if (existing) {
    await subs.update(existing.id, { userId, keys: subscription.keys, userAgent: userAgent || existing.userAgent });
    return existing.id;
  }
  const id = 'psub-' + uuidv4().slice(0, 12);
  await subs.insert({
    id, userId,
    endpoint: subscription.endpoint,
    keys: subscription.keys,
    userAgent: userAgent || null,
    createdAt: new Date().toISOString(),
  });
  return id;
}

/** Remove a subscription by endpoint (used on unsubscribe / 410 cleanup). */
async function removeByEndpoint(endpoint) {
  try {
    const row = await subs.findByField('endpoint', endpoint);
    if (row) await subs.delete(row.id);
  } catch (_) {}
}

/**
 * Send a push to all of a user's devices.
 * payload: { title, body, tag?, data:{ url } }
 */
async function sendToUser(userId, payload) {
  if (!_ready || !userId) return 0;
  let rows = [];
  try { rows = await subs.findAllByField('userId', userId); } catch (_) { return 0; }
  if (!rows.length) return 0;

  const body = JSON.stringify(payload);
  let sent = 0;
  await Promise.all(rows.map(async (r) => {
    try {
      await webpush.sendNotification({ endpoint: r.endpoint, keys: r.keys }, body);
      sent++;
    } catch (err) {
      // 404/410 = subscription expired → prune it
      if (err.statusCode === 404 || err.statusCode === 410) {
        await removeByEndpoint(r.endpoint);
      }
    }
  }));
  return sent;
}

module.exports = { isEnabled, publicKey, saveSubscription, removeByEndpoint, sendToUser };
