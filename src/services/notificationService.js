// Push notifications are not implemented (Firebase placeholders only).
// This service is a no-op stub to prevent import errors.

async function sendToUser(_userId, _payload) {
  // Firebase credentials not configured — skip silently
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
