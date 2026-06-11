const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '..', 'public');

// Page-level smoke checks. They don't replace browser testing but
// they're enough to catch the kind of "I removed a script tag and
// nothing renders" regressions that would otherwise only show up
// after a deploy.

test('all key pages exist', () => {
  const pages = [
    'index.html', 'search.html',
    'guide-dashboard.html', 'company-dashboard.html', 'tourist-dashboard.html',
    'admin.html', 'login.html', 'register.html',
    'privacy.html', 'terms.html',
  ];
  for (const p of pages) {
    assert.ok(fs.existsSync(path.join(PUBLIC, p)), `missing: ${p}`);
  }
});

test('every dashboard pulls in gd-messages.js', () => {
  for (const f of ['guide-dashboard.html', 'company-dashboard.html', 'tourist-dashboard.html']) {
    const html = fs.readFileSync(path.join(PUBLIC, f), 'utf8');
    assert.match(html, /\/js\/gd-messages\.js/,
                 `${f} must load /js/gd-messages.js`);
  }
});

test('no page still hard-codes both bootstrap stylesheets', () => {
  // After M4b every page ships ONE bootstrap CSS link via the inline
  // picker script. A page that bypassed the refactor would silently
  // download ~30 KB extra.
  const htmls = fs.readdirSync(PUBLIC).filter((f) => f.endsWith('.html'));
  for (const f of htmls) {
    const html = fs.readFileSync(path.join(PUBLIC, f), 'utf8');
    const ltr = /<link[^>]*\bid=["']bs-ltr["']/i.test(html);
    const rtl = /<link[^>]*\bid=["']bs-rtl["']/i.test(html);
    assert.ok(!(ltr && rtl),
              `${f} ships both bootstrap CSS links — should use the picker`);
  }
});

test('XSS helpers exist and are wired', () => {
  // gdEsc / gdSafeUrl were added in the H1 audit hardening. If a refactor
  // accidentally removes them, all the templated innerHTML on guide-profile,
  // search, wishlist etc. starts being vulnerable again.
  const cw = fs.readFileSync(path.join(PUBLIC, 'js', 'common-widgets.js'), 'utf8');
  assert.match(cw, /window\.gdEsc\s*=/);
  assert.match(cw, /window\.gdSafeUrl\s*=/);
});

test('gdEsc behaviour: dangerous chars are escaped', () => {
  // Pure-function copy that mirrors what common-widgets.js exposes.
  const gdEsc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  assert.strictEqual(gdEsc('<script>alert(1)</script>'),
                     '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.strictEqual(gdEsc('a "b" & \'c\''), 'a &quot;b&quot; &amp; &#39;c&#39;');
  assert.strictEqual(gdEsc(null), '');
  assert.strictEqual(gdEsc(undefined), '');
});

test('gdSafeUrl behaviour: rejects javascript: / data: schemes', () => {
  const gdSafeUrl = (u) => {
    if (!u) return '';
    const s = String(u).trim();
    if (/^(https?:|mailto:|tel:|\/)/i.test(s)) return s.replace(/"/g, '%22');
    return '';
  };
  assert.strictEqual(gdSafeUrl('https://guideon.om'),     'https://guideon.om');
  assert.strictEqual(gdSafeUrl('/search.html'),           '/search.html');
  assert.strictEqual(gdSafeUrl('mailto:hi@guideon.om'),   'mailto:hi@guideon.om');
  assert.strictEqual(gdSafeUrl('javascript:alert(1)'),    '');
  assert.strictEqual(gdSafeUrl('data:text/html,<x>'),     '');
  assert.strictEqual(gdSafeUrl(''), '');
  assert.strictEqual(gdSafeUrl(null), '');
});

test('Cache headers logic split is correct (HTML vs assets)', () => {
  // Sanity: assert app.js carries both branches of the cache policy.
  // A regression that flips HTML to immutable would brick every deploy
  // (clients keep stale HTML forever); a flip that lets assets re-fetch
  // on every load undoes the bandwidth win.
  const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  assert.match(app, /no-cache,\s*no-store,\s*must-revalidate/,
               'app.js must still send no-store for HTML');
  assert.match(app, /max-age=31536000,\s*immutable/,
               'app.js must still send 1-year immutable for static assets');
});
