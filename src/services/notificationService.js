const admin = require('firebase-admin');

const FIREBASE_PROJECT_ID   = process.env.FIREBASE_PROJECT_ID   || 'guideon-55995';
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-fbsvc@guideon-55995.iam.gserviceaccount.com';
const FIREBASE_PRIVATE_KEY  = (process.env.FIREBASE_PRIVATE_KEY || '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDj4ITGM7XlTlgm\nMHTyhNupVM5GxujCUMrd1d7Hzo3uPZK4+cQZfk+IefSxNKQKBnrXkoRvwnltCRBR\nEs9FR412UNQVjtkKZIMa0/G3ZrSQSR4wWLCOvZv3imEiBiK5UID2mIV71PVxtBFP\nmimWqBA6siMTa8r/+Ph6yF+4SVCKStq7SVe2haB+9IJrwjY9Jj17ZDKlYGCQu9Jk\ngB64VeuSf+WjEd8KQbLwFTmEYq1kbDRg6BIj2S4Ntg1iyDYD1i5VKmr+JPFZiDmX\nMassQcjSJvQY/tQXStt/qgIdxmzpO6V1JFyJYvIUe1ki2gPXnRR/t816DZ8pz9We\nqtRT2cApAgMBAAECggEAAXIlatvdeG4rVAQJsezoNzursA+ctCLuw+09TneVN0ua\nYzm+e0pDDJgi1n8BgsjGExkXEF3OXG6VdRY793IRR+ISaRfwxkabUwUWQGDSniRr\nSx488eLqcEMnWPUWAlFW8s7xReG03vr9WHZ0yMPEj+1ybdyeEKAOn498P/9DF2WI\nIKA0HN5DzKMHynP7XDICrn2mpYhsEyV5RPD2R+m3AqYNIAU24n6UX1HcLGRBqtEQ\nrDe7OFA88vEWZo794KRJ0BeU5tLUUH+AHoisxN0ScHcCmhsEasGCWnjnSVgj5Q3e\n8aHCZj6zYUCVvHVMRECSI9XCrk6dVKum1MU3+iPGcwKBgQD2SH3YOIy8MB9aRZ2a\nTHdgr4nYu05HZoSM8rBtpSMm+vgATh1fZ9hc1Q+wkYw+ifWCcRyygz0QmtY8cxRz\nVhg8X88+p2qi4Dhz9RG7y63tvEB5gwDzH4ZY5r9rNuJLRjBALxbw6YWLRkEGEIO3\nge/s+MNCeTZj2VEokF7yBFKoVwKBgQDs3h8TtmC6TOKkhETxMtco03I5lUbFZZgu\nt/QVFuUKWEnA9yuNqlWDUFX7TRIc7esOT/6cpmGseOfQVVj+hJkJA/20JNJvuLuj\n9SgPQ4kZ23JJ4TsEgZyhzPv5w29SdbwVPWk7mkM2MxxErixmQ064qzx1nqu+rcYW\nlPyFO3eLfwKBgB71McxyH06wheBlC9CPeBoRNrSlpstW2aaWAxNlRKvrtCzlpM+P\nUCUrKxO41/YshU3mRgMyeASUUgW7OYDd+6HrMTPg+4iJws7gqV//1Fcj6L7ddssY\n1VxrdPhXJ87qfbozsSCLWhwNsrK+dLAmhzA0fOboMawPbyI4M5ccb/91AoGAY5OR\nXvkZutgdo2nTjc6AszII3/pIUS2/h0xf+Qmx6eJpxwxhq+GCp3x7WPTye2Ttnwu0\nDujHQPlnAqcOjZjyuN6LplKggMUZZPjoCVqr5Unixvo/lEpkrYR+HWaygujp08gI\nWD0mqj9cT+ck1SzQiEO8W/oDW1q0XsPtUJlKTUMCgYEAs3omiYP57kOHkYPVIOc4\nd/IdQT20de8FLIhdtXacO2sfBx2f5LRBAZosPknCx5r+ZvkR0e3dCUs5/AHPGYVJ\n30lLKyYz+NQ/hW2TbJ6ZepLEIMB5ZTR1t7GeK8ZtyR/MN9YWbNEgCRQVQIVgXbn8\nbluBwyybMu7PdWYnTLm6p14=\n-----END PRIVATE KEY-----\n').replace(/\\n/g, '\n');

let app;

function getApp() {
  if (app) return app;
  try {
    app = admin.apps.length
      ? admin.apps[0]
      : admin.initializeApp({
          credential: admin.credential.cert({
            projectId:   FIREBASE_PROJECT_ID,
            clientEmail: FIREBASE_CLIENT_EMAIL,
            privateKey:  FIREBASE_PRIVATE_KEY,
          }),
        });
  } catch (e) {
    console.error('[Firebase] init error:', e.message);
    app = null;
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
