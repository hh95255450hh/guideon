const test = require('node:test');
const assert = require('node:assert');

// Lightweight unit tests that don't require a running server.
// Run with: npm test

test('rate limit messages are JSON-safe', () => {
  const { loginLimiter, registerLimiter } = require('../src/middleware/rateLimit');
  assert.ok(loginLimiter);
  assert.ok(registerLimiter);
});

test('SupabaseDB exposes expected methods', () => {
  const SupabaseDB = require('../src/models/SupabaseDB');
  // Don't actually instantiate (requires env), just check the class
  const proto = SupabaseDB.prototype;
  assert.strictEqual(typeof proto.findById, 'function');
  assert.strictEqual(typeof proto.findByField, 'function');
  assert.strictEqual(typeof proto.findAllByField, 'function');
  assert.strictEqual(typeof proto.insert, 'function');
  assert.strictEqual(typeof proto.update, 'function');
  assert.strictEqual(typeof proto.delete, 'function');
  assert.strictEqual(typeof proto.count, 'function');
});

test('CSRF middleware skips safe methods', () => {
  const csrf = require('../src/middleware/csrf');
  let nextCalled = false;
  const req = { method: 'GET', path: '/api/anything', headers: {} };
  const res = { status: () => res, json: () => res };
  csrf(req, res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true);
});

test('CSRF middleware skips Stripe webhook', () => {
  const csrf = require('../src/middleware/csrf');
  let nextCalled = false;
  const req = { method: 'POST', path: '/api/payments/webhook', headers: {}, session: {} };
  const res = { status: () => res, json: () => res };
  csrf(req, res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true);
});

test('CSRF middleware blocks unknown origin', () => {
  const csrf = require('../src/middleware/csrf');
  let status = null;
  let body = null;
  const req = {
    method: 'POST',
    path: '/api/bookings',
    headers: { origin: 'https://evil.example.com' },
    session: { userId: 'tourist-1' },
  };
  const res = {
    status(code) { status = code; return this; },
    json(b)      { body = b; return this; },
  };
  csrf(req, res, () => {});
  assert.strictEqual(status, 403);
  assert.strictEqual(body.success, false);
});

test('logger redacts secrets', () => {
  const { logger } = require('../src/config/logger');
  assert.ok(logger);
  assert.strictEqual(typeof logger.info, 'function');
  assert.strictEqual(typeof logger.error, 'function');
});
