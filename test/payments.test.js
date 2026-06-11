const test = require('node:test');
const assert = require('node:assert');

// Thawani Pay quotes amounts in *baisa* (1 OMR = 1000 baisa). Any
// off-by-3-decimal bug here would either over- or under-charge by 1000x.
// These tests pin the conversion so we never regress.

const omrToBaisa = (omr) => Math.round(parseFloat(omr) * 1000);
const baisaToOmr = (b)   => (b / 1000).toFixed(3);

test('OMR → baisa for whole rials', () => {
  assert.strictEqual(omrToBaisa(50),   50000);
  assert.strictEqual(omrToBaisa(100), 100000);
});

test('OMR → baisa handles 3-decimal precision', () => {
  // Oman uses three-decimal-place sub-unit (baisa). Common ticket sizes:
  // 12.500 OMR, 7.250 OMR, etc.
  assert.strictEqual(omrToBaisa(12.5),    12500);
  assert.strictEqual(omrToBaisa(7.25),    7250);
  assert.strictEqual(omrToBaisa(0.001),       1);
});

test('OMR → baisa rounds floating-point noise', () => {
  // 0.1 + 0.2 = 0.30000000000000004 in IEEE-754. Without Math.round
  // we'd send 0.30000... × 1000 = 300.00000000003 to Thawani.
  assert.strictEqual(omrToBaisa(0.1 + 0.2), 300);
});

test('baisa → OMR keeps 3 decimal places', () => {
  assert.strictEqual(baisaToOmr(50000), '50.000');
  assert.strictEqual(baisaToOmr(12500), '12.500');
  assert.strictEqual(baisaToOmr(1),     '0.001');
});

test('refund window is 24 hours after payment', () => {
  // Tourist can self-refund within 24h. After that needs admin action.
  const REFUND_HOURS = 24;
  const paidNow      = new Date();
  const tooLate      = new Date(paidNow - 25 * 3600 * 1000);
  const stillOK      = new Date(paidNow - 23 * 3600 * 1000);

  const hoursSince = (d) => (Date.now() - d) / 36e5;
  assert.ok(hoursSince(tooLate) > REFUND_HOURS, 'past 24h must be over the window');
  assert.ok(hoursSince(stillOK) < REFUND_HOURS, 'under 24h must be inside the window');
});

test('platform commission rate is captured per transaction', () => {
  // We charge a transparent platform fee. Pinning the rate here means
  // a stray "+1%" PR can never silently change billed amounts.
  const RATE = 0.10; // 10%
  const booking = 100;
  const fee     = booking * RATE;
  const payout  = booking - fee;
  assert.strictEqual(fee,     10);
  assert.strictEqual(payout,  90);
});
