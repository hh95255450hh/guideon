const test = require('node:test');
const assert = require('node:assert');
const { sanitizeContact, PUBLIC_PROFILE_FIELDS } = require('../src/utils/sanitizeContact');

// A real-shaped guide row with every kind of field the users table holds.
const ROW = {
  id: 'g1', userType: 'guide', fullName: 'Salim', photo: '/p.jpg', bio: 'Nizwa historian',
  pricePerDay: 40, rating: 4.9, totalReviews: 12, isVerified: true, licenceNumber: 'MHT-123',
  languages: ['ar', 'en'], destinations: ['Nizwa'], instantAvailable: true, instantHourlyRate: 8,
  availableCount: 3,
  // private
  password: 'hash', email: 'salim@example.com', phone: '+96890000000',
  instantLat: 22.9333, instantLng: 57.5333, instantUpdatedAt: '2026-10-14T08:00:00Z',
  fcmToken: 'device-token', googleId: 'g-123', referralCode: 'SALIM10', referredBy: 'x',
  commissionRate: 0.05, twoFactorEnabled: true, twoFactorSecret: 'S', loginsSince2FA: 3,
  emailVerified: true, notifPrefs: {}, permissions: ['all'], staffRole: 'owner',
  isSuspended: false, createdBy: 'admin', resetPasswordToken: 't',
};

test('public profile: a visitor sees only public fields', () => {
  const out = sanitizeContact({ ...ROW }, null);
  for (const k of Object.keys(out)) assert.ok(PUBLIC_PROFILE_FIELDS.includes(k), `${k} must not be public`);
  for (const k of ['instantLat', 'instantLng', 'fcmToken', 'googleId', 'referralCode', 'commissionRate',
                   'twoFactorEnabled', 'permissions', 'email', 'phone', 'password', 'isSuspended']) {
    assert.ok(!(k in out), `${k} leaked to a visitor`);
  }
  assert.strictEqual(out.fullName, 'Salim');
  assert.strictEqual(out.availableCount, 3, 'computed fields the cards need still pass');
  assert.strictEqual(out.instantAvailable, true, 'availability is public; location is not');
});

test('public profile: an unknown future column stays private by default', () => {
  const out = sanitizeContact({ ...ROW, bankIban: 'OM00...', internalNotes: 'x' }, null);
  assert.ok(!('bankIban' in out) && !('internalNotes' in out));
});

test('public profile: the owner and admins keep their full view, minus secrets', () => {
  for (const viewer of [{ id: 'g1', userType: 'guide' }, { id: 'a', userType: 'admin' }]) {
    const out = sanitizeContact({ ...ROW }, viewer);
    assert.strictEqual(out.commissionRate, 0.05);
    assert.strictEqual(out.email, 'salim@example.com');
    for (const secret of ['password', 'twoFactorSecret', 'resetPasswordToken', 'fcmToken', 'googleId']) {
      assert.ok(!(secret in out), `${secret} must never be sent, even to ${viewer.userType}`);
    }
  }
});
