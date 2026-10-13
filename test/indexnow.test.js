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
