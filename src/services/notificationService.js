const admin = require('firebase-admin');
const { query } = require('../config/database');

let _initialized = false;

function getAdmin() {
  if (!_initialized) {
    const { FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL } = process.env;
    if (!FIREBASE_PROJECT_ID || !FIREBASE_PRIVATE_KEY || !FIREBASE_CLIENT_EMAIL) {
      throw new Error('Firebase credentials not set in environment variables');
    }
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId:   FIREBASE_PROJECT_ID,
        privateKey:  FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: FIREBASE_CLIENT_EMAIL,
      }),
    });
    _initialized = true;
  }
  return admin;
}

// Send a notification to a single user by their DB user_id
async function sendToUser(userId, { title, body, data = {} }) {
  try {
    const result = await query('SELECT fcm_token FROM users WHERE id = $1', [userId]);
    const token = result.rows[0]?.fcm_token;
    if (!token) return; // user hasn't registered a device token

    await getAdmin().messaging().send({
      token,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    });
  } catch (err) {
    // Never crash the booking flow — log and move on
    console.error(`Push notification failed for user ${userId}:`, err.message);
  }
}

async function sendBookingConfirmation({ userId, tourTitle, date, bookingId, participants, totalPrice }) {
  await sendToUser(userId, {
    title: 'Booking Confirmed! 🎉',
    body:  `Your booking for "${tourTitle}" on ${new Date(date).toLocaleDateString()} is confirmed.`,
    data:  { type: 'booking_confirmed', bookingId, tourTitle, participants, totalPrice },
  });
}

async function sendBookingCancellation({ userId, tourTitle, bookingId }) {
  await sendToUser(userId, {
    title: 'Booking Cancelled',
    body:  `Your booking for "${tourTitle}" has been cancelled.`,
    data:  { type: 'booking_cancelled', bookingId, tourTitle },
  });
}

async function sendPaymentFailed({ userId, tourTitle }) {
  await sendToUser(userId, {
    title: 'Payment Failed',
    body:  `Payment for "${tourTitle}" could not be processed. Please try again.`,
    data:  { type: 'payment_failed', tourTitle },
  });
}

module.exports = {
  sendBookingConfirmation,
  sendBookingCancellation,
  sendPaymentFailed,
};
