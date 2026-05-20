const admin = require('firebase-admin');

let app;

function getApp() {
  if (app) return app;
  if (!process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID === 'REPLACE_WITH_YOUR_PROJECT_ID') {
    return null;
  }
  try {
    app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } catch {
    app = admin.apps[0] || null;
  }
  return app;
}

async function sendToUser(fcmToken, payload) {
  if (!fcmToken || !getApp()) return;
  try {
    await admin.messaging().send({
      token: fcmToken,
      notification: { title: payload.title, body: payload.body },
      data: payload.data || {},
      webpush: {
        notification: {
          title: payload.title,
          body:  payload.body,
          icon:  '/icon-192.png',
          badge: '/icon-192.png',
        },
      },
    });
  } catch (err) {
    console.error('[FCM] send error:', err.message);
  }
}

async function sendBookingConfirmation({ fcmToken, tourTitle, date, bookingId, participants, totalPrice }) {
  await sendToUser(fcmToken, {
    title: 'Booking Confirmed!',
    body:  `Your booking for "${tourTitle}" on ${new Date(date).toLocaleDateString()} is confirmed.`,
    data:  { type: 'booking_confirmed', bookingId, tourTitle },
  });
}

async function sendBookingCancellation({ fcmToken, tourTitle, bookingId }) {
  await sendToUser(fcmToken, {
    title: 'Booking Cancelled',
    body:  `Your booking for "${tourTitle}" has been cancelled.`,
    data:  { type: 'booking_cancelled', bookingId },
  });
}

async function sendPaymentFailed({ fcmToken, tourTitle }) {
  await sendToUser(fcmToken, {
    title: 'Payment Failed',
    body:  `Payment for "${tourTitle}" could not be processed. Please try again.`,
    data:  { type: 'payment_failed' },
  });
}

module.exports = { sendBookingConfirmation, sendBookingCancellation, sendPaymentFailed, sendToUser };
