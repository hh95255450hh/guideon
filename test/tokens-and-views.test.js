const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const SupabaseDB = require('../src/models/SupabaseDB');

// Reset/verify tokens are stored hashed (a leaked users table yields no usable
// link), and package views are counted once per visitor per 30 minutes.

const rows = [];
SupabaseDB.prototype.findByField = async function (field, value) { return rows.find(r => r[field] === value) || null; };
SupabaseDB.prototype.findById = async function (id) {
  if (id === 'pkg-1') return { id: 'pkg-1', providerId: 'guide-1', providerType: 'guide' };
  return rows.find(r => r.id === id) || null;
};
const updates = [];
SupabaseDB.prototype.update = async function (id, patch) { updates.push({ id, patch }); return patch; };
const inserted = [];
SupabaseDB.prototype.insert = async function (row) { inserted.push(row); return row; };

const auth = require('../src/controllers/authController');
const analytics = require('../src/controllers/guideAnalyticsController');
const sha = t => crypto.createHash('sha256').update(t).digest('hex');
const call = (fn, req) => new Promise(resolve => {
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { resolve({ status: this.statusCode, body: b }); },
    redirect(u) { resolve({ status: 302, body: u }); }, send(b) { resolve({ status: this.statusCode, body: b }); } };
  fn({ body: {}, params: {}, query: {}, session: {}, headers: {}, ip: '1.2.3.4', ...req }, res);
});

test('reset password: a token stored as its hash is accepted; the hash itself is not a token', async () => {
  rows.length = 0; updates.length = 0;
  rows.push({ id: 'u1', email: 'a@b.c', resetPasswordToken: sha('raw-token'), resetPasswordExpires: new Date(Date.now() + 3600e3).toISOString() });
  const ok = await call(auth.resetPassword, { body: { token: 'raw-token', newPassword: 'NewPassw0rd!x' } });
  assert.strictEqual(ok.status, 200, JSON.stringify(ok.body));
  assert.ok(updates.some(u => u.id === 'u1' && u.patch.resetPasswordToken === null));

  rows[0].resetPasswordToken = sha('raw-token');
  const bad = await call(auth.resetPassword, { body: { token: sha('raw-token'), newPassword: 'NewPassw0rd!x' } });
  assert.notStrictEqual(bad.status, 200, 'the stored hash must not work as a token');
});

test('package views: one per visitor per window, none for the provider', async () => {
  inserted.length = 0; analytics._recentViews.clear();
  await call(analytics.recordView, { params: { id: 'pkg-1' }, ip: '9.9.9.9' });
  await call(analytics.recordView, { params: { id: 'pkg-1' }, ip: '9.9.9.9' });
  await call(analytics.recordView, { params: { id: 'pkg-1' }, ip: '8.8.8.8' });
  await call(analytics.recordView, { params: { id: 'pkg-1' }, session: { userId: 'guide-1' } });
  assert.strictEqual(inserted.length, 2);
});
