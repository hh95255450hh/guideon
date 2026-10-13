const test = require('node:test');
const assert = require('node:assert');

// Money paths found by the engineering council:
//  1. A payment arriving for a cancelled/expired booking fell into the balance
//     branch and marked it paid, telling the tourist "Payment successful".
//  2. A transient failure inside the Paymob callback was answered 200, so Paymob
//     never retried and a charged booking stayed unpaid.
// The database, notifications and email are replaced with in-memory fakes.

const SupabaseDB = require('../src/models/SupabaseDB');
const notificationService = require('../src/services/notificationService');
const emailService = require('../src/services/emailService');

const db = { bookings: new Map(), users: new Map(), instant_requests: new Map() };
let failNextUpdate = false;
const sent = { notify: [], adminEmails: [] };

SupabaseDB.prototype.findById = async function (id) { return (db[this.table] || new Map()).get(id) || null; };
SupabaseDB.prototype.findByField = async function () { return null; };
SupabaseDB.prototype.update = async function (id, data) {
  if (failNextUpdate) { failNextUpdate = false; throw new Error('connection reset'); }
  const row = { ...(db[this.table].get(id) || {}), ...data };
  db[this.table].set(id, row);
  return row;
};
notificationService.notify = (n) => { sent.notify.push(n); };
emailService.notifyAdmins = async (subject) => { sent.adminEmails.push(subject); };

// Paymob's HMAC check is not under test here.
const paymob = require('../src/config/paymob');
paymob.verifyHmac = () => true;

const ctrl = require('../src/controllers/paymentController');

function reset() {
  db.bookings.clear(); db.users.clear();
  sent.notify.length = 0; sent.adminEmails.length = 0; failNextUpdate = false;
  db.users.set('t1', { id: 't1', fullName: 'Tourist', email: 't@example.com' });
}

const session = (bookingId, omr) => ({ raw: { client_reference_id: bookingId, total_amount: omr * 1000, session_id: 'tx-1' } });

test('payment: a late payment on a cancelled booking is NOT marked paid', async () => {
  reset();
  db.bookings.set('bk-1', { id: 'bk-1', status: 'cancelled', isPaid: false, totalAmount: 50, touristId: 't1', destination: 'Nizwa' });
  const outcome = await ctrl.finalizePaidBooking('bk-1', session('bk-1', 50));
  const after = db.bookings.get('bk-1');
  assert.strictEqual(outcome, 'needs_refund');
  assert.strictEqual(after.isPaid, false, 'a cancelled booking must never become paid');
  assert.strictEqual(after.status, 'cancelled', 'the booking must not be reactivated');
  assert.strictEqual(after.paymentRef, 'tx-1', 'the payment reference is kept for the refund');
  assert.ok(sent.adminEmails.some(s => /Refund needed/.test(s)), 'the admins are alerted');
  assert.ok(!sent.notify.some(n => n.type === 'payment_received'), 'no "payment successful" message');
  assert.ok(sent.notify.some(n => n.type === 'payment_refund_pending'), 'the tourist is told a refund is coming');
});

test('payment: an expired booking is treated the same way', async () => {
  reset();
  db.bookings.set('bk-2', { id: 'bk-2', status: 'expired', isPaid: false, totalAmount: 30, touristId: 't1' });
  assert.strictEqual(await ctrl.finalizePaidBooking('bk-2', session('bk-2', 30)), 'needs_refund');
  assert.strictEqual(db.bookings.get('bk-2').isPaid, false);
});

test('payment: a normal deposit still settles', async () => {
  reset();
  db.bookings.set('bk-3', { id: 'bk-3', status: 'awaiting_payment', depositAmount: 20, totalAmount: 20, depositPercent: 100, touristId: 't1', destination: 'Sur' });
  assert.strictEqual(await ctrl.finalizePaidBooking('bk-3', session('bk-3', 20)), 'settled');
  const after = db.bookings.get('bk-3');
  assert.strictEqual(after.isPaid, true);
  assert.ok(after.depositPaidAt);
  assert.strictEqual(sent.adminEmails.length, 0, 'a normal payment raises no alert');
});

test('payment: a duplicate webhook is a no-op', async () => {
  reset();
  db.bookings.set('bk-4', { id: 'bk-4', status: 'pending', isPaid: true, depositPaidAt: '2026-10-01', totalAmount: 20, touristId: 't1' });
  assert.strictEqual(await ctrl.finalizePaidBooking('bk-4', session('bk-4', 20)), 'duplicate');
});

test('payment: an underpayment is refused and the admins are alerted', async () => {
  reset();
  db.bookings.set('bk-5', { id: 'bk-5', status: 'awaiting_payment', depositAmount: 40, totalAmount: 40, touristId: 't1' });
  assert.strictEqual(await ctrl.finalizePaidBooking('bk-5', session('bk-5', 10)), 'refused');
  assert.notStrictEqual(db.bookings.get('bk-5').isPaid, true);
  assert.ok(sent.adminEmails.some(s => /underpaid/i.test(s)));
});

function callback(body) {
  return new Promise(resolve => {
    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(b) { resolve({ status: this.statusCode, body: b }); },
    };
    ctrl.paymobCallback({ body, query: { hmac: 'x' } }, res);
  });
}

test('paymob callback: a transient failure asks Paymob to retry, then the retry settles', async () => {
  reset();
  db.bookings.set('bk-6', { id: 'bk-6', status: 'awaiting_payment', depositAmount: 25, totalAmount: 25, depositPercent: 100, touristId: 't1' });
  const body = { obj: { success: true, id: 99, amount_cents: 25000, order: { merchant_order_id: 'bk-6_abc' } } };

  failNextUpdate = true;                                   // the database hiccups once
  const first = await callback(body);
  assert.strictEqual(first.status, 503, 'a transient failure must not be acknowledged as applied');
  assert.notStrictEqual(db.bookings.get('bk-6').isPaid, true);

  const retry = await callback(body);                      // Paymob resends
  assert.strictEqual(retry.status, 200);
  assert.strictEqual(db.bookings.get('bk-6').isPaid, true, 'the retry settles the booking');
});

test('paymob callback: a final refusal is acknowledged so Paymob does not resend forever', async () => {
  reset();
  db.bookings.set('bk-7', { id: 'bk-7', status: 'cancelled', isPaid: false, totalAmount: 25, touristId: 't1' });
  const r = await callback({ obj: { success: true, id: 7, amount_cents: 25000, order: { merchant_order_id: 'bk-7_x' } } });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(db.bookings.get('bk-7').isPaid, false);
});
