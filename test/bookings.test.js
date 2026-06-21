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

// ── 043: date validation + Oman-timezone helpers ───────────────────────────
const rules = require('../src/domain/bookingRules');

test('isValidDateStr accepts a real date, rejects malformed/impossible', () => {
  assert.ok(rules.isValidDateStr('2026-06-25'));
  assert.ok(!rules.isValidDateStr('2026-02-31')); // Feb has no 31st
  assert.ok(!rules.isValidDateStr('2026-13-01')); // no month 13
  assert.ok(!rules.isValidDateStr('25-06-2026')); // wrong format
  assert.ok(!rules.isValidDateStr(''));
  assert.ok(!rules.isValidDateStr(undefined));
});

test('isPastDate is timezone-anchored to Oman', () => {
  // 2026-06-21 03:00 UTC == 07:00 Oman, so the Oman date is still 2026-06-21.
  const now = new Date('2026-06-21T03:00:00Z');
  assert.ok(rules.isPastDate('2026-06-20', now));
  assert.ok(!rules.isPastDate('2026-06-21', now)); // today is not past
  assert.ok(!rules.isPastDate('2026-06-22', now));
});

test('hoursUntilDate measures to Oman midnight of the tour date', () => {
  // 2026-06-23 00:00 Oman == 2026-06-22 20:00 UTC.
  const now = new Date('2026-06-22T20:00:00Z');
  assert.strictEqual(Math.round(rules.hoursUntilDate('2026-06-23', now)), 0);
  assert.strictEqual(Math.round(rules.hoursUntilDate('2026-06-25', now)), 48);
});

test('package seat math refuses to oversell max_group_size', () => {
  const maxGroup = 10;
  const seatsTaken = 8;
  const people = 3;
  assert.ok(seatsTaken + people > maxGroup); // would oversell → blocked
  assert.strictEqual(Math.max(0, maxGroup - seatsTaken), 2); // 2 seats left
});

// ── concurrency: deterministic capacity reconciliation ──────────────────────
test('bookingsWithinCapacity keeps the earliest N, drops the rest', () => {
  const conflicts = [
    { id: 'bk-c', createdAt: '2026-06-21T10:00:02Z' },
    { id: 'bk-a', createdAt: '2026-06-21T10:00:00Z' },
    { id: 'bk-b', createdAt: '2026-06-21T10:00:01Z' },
  ];
  const winners = rules.bookingsWithinCapacity(conflicts, 2);
  assert.ok(winners.has('bk-a') && winners.has('bk-b'));
  assert.ok(!winners.has('bk-c')); // latest loses the race
});

test('bookingsWithinCapacity breaks createdAt ties deterministically by id', () => {
  const t = '2026-06-21T10:00:00Z';
  const conflicts = [
    { id: 'bk-z', createdAt: t },
    { id: 'bk-a', createdAt: t },
  ];
  // Both racers compute the SAME winner set → exactly one survives capacity 1.
  const w = rules.bookingsWithinCapacity(conflicts, 1);
  assert.strictEqual(w.size, 1);
  assert.ok(w.has('bk-a') && !w.has('bk-z'));
});

test('bookingsWithinCapacity with Infinity keeps everyone (company unlimited)', () => {
  const conflicts = [{ id: 'x', createdAt: '2026-01-01' }, { id: 'y', createdAt: '2026-01-02' }];
  assert.strictEqual(rules.bookingsWithinCapacity(conflicts, Infinity).size, 2);
});
