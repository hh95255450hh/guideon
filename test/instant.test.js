const test = require('node:test');
const assert = require('node:assert');
const { _internals: I } = require('../src/controllers/instantController');

test('instant: distanceKm Muscat → Nizwa is ~140 km', () => {
  const d = I.distanceKm(23.588, 58.383, 22.933, 57.533);
  assert.ok(d > 100 && d < 150, `got ${d}`);
});

test('instant: distanceKm of identical points is 0', () => {
  assert.strictEqual(Math.round(I.distanceKm(23.5, 58.4, 23.5, 58.4)), 0);
});

test('instant: omanHHMM is UTC+4', () => {
  assert.strictEqual(I.omanHHMM(new Date('2026-10-01T10:15:00Z')), '14:15');
  assert.strictEqual(I.omanHHMM(new Date('2026-10-01T22:30:00Z')), '02:30');
});

test('instant: pending request expires after TTL, others never do', () => {
  const old = new Date(Date.now() - (I.REQUEST_TTL_MIN + 1) * 60e3).toISOString();
  const fresh = new Date().toISOString();
  assert.strictEqual(I.isExpired({ status: 'pending', createdAt: old }), true);
  assert.strictEqual(I.isExpired({ status: 'pending', createdAt: fresh }), false);
  assert.strictEqual(I.isExpired({ status: 'accepted', createdAt: old }), false);
});

test('instant: availability goes stale without a recent location refresh', () => {
  assert.strictEqual(I.isFresh({ instantAvailable: true, instantUpdatedAt: new Date().toISOString() }), true);
  assert.strictEqual(I.isFresh({ instantAvailable: true, instantUpdatedAt: new Date(Date.now() - 4 * 3600e3).toISOString() }), false);
  assert.strictEqual(!!I.isFresh({ instantAvailable: false, instantUpdatedAt: new Date().toISOString() }), false);
});

test('instant: routes module loads and wires handlers', () => {
  const router = require('../src/routes/instant');
  const paths = router.stack.map(l => l.route && l.route.path).filter(Boolean);
  for (const p of ['/guides', '/me/availability', '/requests', '/requests/:id/accept']) assert.ok(paths.includes(p), p);
});
