/**
 * fcmService — Firebase Cloud Messaging (V1 API) for mobile push notifications.
 *
 * Activated when FIREBASE_SERVICE_ACCOUNT (base64-encoded service-account JSON)
 * is set in the environment. Fully no-op otherwise — the app never crashes.
 *
 * Usage: fcm.sendToToken(fcmToken, { title, body, data })
 *        fcm.sendToUser(userId)   — looks up fcm_token from DB
 */
const SupabaseDB = require('../models/SupabaseDB');
const users = new SupabaseDB('users');

let _app = null;
let _messaging = null;

(function init() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.warn('[fcm] disabled — set FIREBASE_SERVICE_ACCOUNT (base64 JSON) to enable mobile push.');
    return;
  }
  try {
    const { initializeApp, getApps, cert } = require('firebase-admin/app');
    const { getMessaging } = require('firebase-admin/messaging');
    const credential = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    if (!getApps().length) {
      initializeApp({ credential: cert(credential) });
    }
    _messaging = getMessaging();
    console.log('[fcm] Firebase Admin SDK initialised — mobile push enabled.');
  } catch (e) {
    console.error('[fcm] init failed:', e.message);
  }
})();

function isEnabled() { return !!_messaging; }

/**
 * Send a push notification to a single FCM device token.
 * @param {string} token  — the device's FCM registration token
 * @param {Object} payload — { title, body, data? }
 * @returns {Promise<boolean>} true on success
 */
async function sendToToken(token, { title, body, data = {} } = {}) {
  if (!_messaging || !token) return false;
  try {
    const { getMessaging } = require('firebase-admin/messaging');
    await getMessaging().send({
      token,
      notification: { title: String(title || '').slice(0, 100), body: String(body || '').slice(0, 200) },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      android: {
        priority: 'high',
        notification: { sound: 'default', clickAction: 'FLUTTER_NOTIFICATION_CLICK' },
      },
    });
    return true;
  } catch (err) {
    // Token invalid / unregistered — clear it so we don't keep retrying
    if (err.code === 'messaging/registration-token-not-registered' ||
        err.code === 'messaging/invalid-registration-token') {
      await _clearToken(token).catch(() => {});
    } else {
      console.warn('[fcm] sendToToken failed:', err.code || err.message);
    }
    return false;
  }
}

/**
 * Lookup a user's FCM token from DB and send them a notification.
 * Silently skips if the user has no token or push is disabled.
 */
async function sendToUser(userId, payload) {
  if (!_messaging || !userId) return false;
  try {
    const user = await users.findById(userId);
    if (!user?.fcm_token) return false;
    return sendToToken(user.fcm_token, payload);
  } catch (_) {
    return false;
  }
}

async function _clearToken(token) {
  try {
    const rows = await users.findAllWhere({ fcm_token: token });
    await Promise.all(rows.map(u => users.update(u.id, { fcm_token: null })));
  } catch (_) {}
}

module.exports = { isEnabled, sendToToken, sendToUser };
