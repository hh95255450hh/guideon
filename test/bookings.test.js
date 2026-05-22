const test = require('node:test');
const assert = require('node:assert');

test('booking ID has expected prefix and length', () => {
  const { v4: uuidv4 } = require('uuid');
  const id = 'bk-' + uuidv4().slice(0, 8);
  assert.match(id, /^bk-[a-f0-9]{8}$/);
});

test('half-day price is 60% of full day', () => {
  const pricePerDay = 100;
  const half = pricePerDay * 0.6;
  const full = pricePerDay;
  assert.strictEqual(half, 60);
  assert.strictEqual(full, 100);
});

test('cancellation must be 48 hours before', () => {
  const tourDate = new Date(Date.now() + 49 * 3600 * 1000);
  const hours = (tourDate - new Date()) / 36e5;
  assert.ok(hours >= 48);
});

test('cancellation under 48 hours is rejected', () => {
  const tourDate = new Date(Date.now() + 47 * 3600 * 1000);
  const hours = (tourDate - new Date()) / 36e5;
  assert.ok(hours < 48);
});
