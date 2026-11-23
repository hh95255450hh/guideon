const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..');

test('indexnow: disabled and inert when no key is configured', async () => {
  delete process.env.INDEXNOW_KEY;
  delete require.cache[require.resolve('../src/services/indexNow')];
  const svc = require('../src/services/indexNow');
  assert.strictEqual(svc.isEnabled(), false);
  // Must resolve, never throw or hit the network.
  const r = await svc.submit(['https://guideon.om/']);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.submitted, 0);
  assert.match(r.reason, /INDEXNOW_KEY/);
});

test('indexnow: rejects malformed keys', () => {
  for (const bad of ['short', 'has space', 'bad/slash', '']) {
    process.env.INDEXNOW_KEY = bad;
    delete require.cache[require.resolve('../src/services/indexNow')];
    assert.strictEqual(require('../src/services/indexNow').isEnabled(), false, `accepted bad key: ${bad}`);
  }
});

test('indexnow: key location points at our own host', () => {
  process.env.INDEXNOW_KEY = 'a'.repeat(32);
  delete require.cache[require.resolve('../src/services/indexNow')];
  const svc = require('../src/services/indexNow');
  assert.strictEqual(svc.isEnabled(), true);
  assert.ok(svc.keyLocation().startsWith(svc.APP_URL + '/'));
  assert.ok(svc.keyLocation().endsWith('.txt'));
});

// Submitting another site's URLs gets the key banned, so they must be dropped
// before the request is built.
test('indexnow: filters out foreign URLs', async () => {
  process.env.INDEXNOW_KEY = 'b'.repeat(32);
  delete require.cache[require.resolve('../src/services/indexNow')];
  const svc = require('../src/services/indexNow');
  const r = await svc.submit(['https://evil.example.com/x', 'http://guideon.om/insecure', '']);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.submitted, 0);
  assert.strictEqual(r.reason, 'no valid URLs');
  assert.strictEqual(r.skipped, 3);
});

test('indexnow: key route is registered and only matches .txt', () => {
  process.env.INDEXNOW_KEY = 'c'.repeat(32);
  delete require.cache[require.resolve('../src/services/indexNow')];
  delete require.cache[require.resolve('../src/routes/indexNow')];
  const router = require('../src/routes/indexNow');
  const paths = router.stack.map(l => l.route && l.route.path).filter(Boolean);
  assert.ok(paths.some(p => String(p).includes('.txt')), 'key route must serve a .txt path');
});

test('indexnow: weekly script exists and never calls a Google endpoint', () => {
  const src = fs.readFileSync(path.join(SRC, 'scripts', 'submit-indexnow.js'), 'utf8');
  assert.ok(src.includes('sitemap.xml'), 'script should read the live sitemap');
  assert.ok(/indexing\.googleapis\.com|google\.com\/ping/.test(src) === false,
    'must not call Google — its Indexing API is limited to JobPosting/BroadcastEvent');
  // A failed submission must not advance the baseline, or the week is lost.
  assert.ok(src.includes('if (r.ok) writeState'), 'state must only advance on success');
});

test('indexnow: app mounts the key route', () => {
  const app = fs.readFileSync(path.join(SRC, 'src', 'app.js'), 'utf8');
  assert.ok(app.includes("require('./routes/indexNow')"), 'app.js must mount the IndexNow key route');
});

// -- Real-time announcements (services/indexNowPing.js) -----------------
// The weekly script covers steady state; these fire the moment a page becomes
// public, and must never slow down or break the request that triggered them.
const readSrc = p => fs.readFileSync(path.join(SRC, 'src', p), 'utf8');

test('indexnow: ping never blocks or breaks a request', () => {
  const idx = require('../src/services/indexNowPing');
  // With no key configured it must be a silent no-op, not a throw.
  assert.doesNotThrow(() => idx.ping('/guide-profile.html?id=x'));
  assert.doesNotThrow(() => idx.ping(null));
  assert.doesNotThrow(() => idx.ping([null, undefined, '']));
  assert.doesNotThrow(() => idx.ping(['/a', '/b']));
});

test('indexnow: callers must not await the ping', () => {
  for (const f of ['controllers/adminController.js', 'controllers/packageController.js']) {
    const src = readSrc(f);
    assert.ok(!/await\s+idx\.ping/.test(src),
      `${f}: awaiting the ping would make a search engine's latency the user's latency`);
  }
});

test('indexnow: a tour is only announced once it is public', () => {
  const src = readSrc('controllers/packageController.js');
  const pings = src.split('\n').filter(l => l.includes('idx.ping('));
  assert.ok(pings.length >= 2, 'create and update should both announce');
  for (const line of pings) {
    assert.ok(/isPublished/.test(line),
      `an unpublished tour must not be announced: ${line.trim()}`);
  }
});

test('indexnow: the submit-all endpoint is POST and super-admin only', () => {
  const src = readSrc('routes/admin.js');
  const line = src.split('\n').find(l => l.includes('indexnow/submit-all'));
  assert.ok(line, 'submit-all route is missing');
  assert.ok(line.includes('router.post('), 'must be POST — a GET can be fired by an <img> tag');
  assert.ok(line.includes('requireSuperAdmin'), 'must be super-admin only');
});

test('indexnow: the status endpoint never returns the key', () => {
  const src = readSrc('controllers/adminController.js');
  const body = src.slice(src.indexOf('exports.indexNowStatus'), src.indexOf('exports.indexNowSubmitAll'));
  assert.ok(!/indexNow\.KEY/.test(body), 'the key itself must never be returned');
  assert.ok(body.includes('keyLocation'), 'the key LOCATION is public and useful');
});

test('indexnow: repeat announcements of the same URL are suppressed', async () => {
  // The protocol asks you not to re-submit URLs you have not changed.
  const src = readSrc('services/indexNowPing.js');
  assert.ok(/REPEAT_MS/.test(src) && /lastSent/.test(src),
    'there must be a guard against re-announcing an unchanged URL');
  assert.ok(/BATCH_MS/.test(src), 'a burst of edits should coalesce into one request');
  assert.ok(/unref/.test(src), 'the batch timer must never hold the process open');
});
