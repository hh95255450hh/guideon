const test = require('node:test');
const assert = require('node:assert');
const seo = require('../src/middleware/seoMeta');
const fs = require('fs');
const path = require('path');

// Every public page Google indexes gets exactly one canonical, one description,
// Open Graph tags and valid JSON-LD; region and blog pages describe their own
// subject (TouristDestination / BlogPosting) instead of sharing one template.

const count = (html, re) => (html.match(re) || []).length;
const lds = html => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));

for (const p of ['/about.html', '/regions.html', '/blog.html', '/trails.html', '/faq.html', '/contact.html',
                 '/how-it-works.html', '/teams.html', '/plan-trip.html', '/explore.html']) {
  test(`seo: ${p} has one canonical, one description, og and breadcrumb`, () => {
    const h = seo._staticPage(p);
    assert.ok(h, 'page rendered');
    assert.strictEqual(count(h, /rel="canonical"/g), 1);
    assert.strictEqual(count(h, /name="description"/g), 1);
    assert.match(h, new RegExp(`<link rel="canonical" href="https://guideon.om${p.replace('.', '\\.')}">`));
    assert.match(h, /property="og:title"/);
    assert.ok(lds(h).some(o => o['@type'] === 'BreadcrumbList'));
  });
}

test('seo: the FAQ page keeps its FAQPage data', () => {
  assert.ok(lds(seo._staticPage('/faq.html')).some(o => o['@type'] === 'FAQPage'));
});

test('seo: region pages are a TouristDestination with their attractions', async () => {
  const m = await seo._regionMeta('musandam');
  assert.strictEqual(m.jsonld[0]['@type'], 'TouristDestination');
  assert.ok(m.jsonld[0].includesAttraction.length > 0);
  assert.match(m.image, /^https:\/\/guideon\.om\//);
});

test('seo: blog posts are a BlogPosting with a date and publisher logo', async () => {
  const m = await seo._blogMeta('first-time-oman');
  assert.strictEqual(m.jsonld[0]['@type'], 'BlogPosting');
  assert.ok(m.jsonld[0].datePublished);
  assert.strictEqual(m.ogType, 'article');
});

// Soft 404 fix: these three pages built their list in the browser, so the HTML
// a crawler gets was ~20 words of boilerplate and Google filed them as empty.
// The list must now be present in the server's HTML.
test('seo: list pages ship their content server-rendered', () => {
  const { _staticPage } = require('../src/middleware/seoMeta');
  const cases = [
    ['/blog.html',    'bGrid',      ['First Time in Oman']],
    ['/regions.html', 'regionGrid', ['Muscat', 'Dhofar']],
    ['/trails.html',  'tGrid',      ['Jebel Shams', 'Balcony']],
  ];
  for (const [page, container, needles] of cases) {
    const html = _staticPage(page);
    assert.ok(html, `${page} did not render`);
    const at = html.indexOf(`id="${container}"`);
    assert.ok(at > -1, `${page}: container #${container} missing`);
    // The container must no longer be the empty <div></div> the page shipped.
    const after = html.slice(html.indexOf('>', at) + 1, html.indexOf('>', at) + 40);
    assert.ok(after.trim() && !after.startsWith('</'),
      `${page}: #${container} is still empty in the server HTML`);
    for (const n of needles) {
      assert.ok(html.includes(n), `${page}: server HTML is missing "${n}"`);
    }
    // Real words, not just markup — this is the whole point of the fix.
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
                     .replace(/<style[\s\S]*?<\/style>/gi, ' ')
                     .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    assert.ok(text.split(' ').length > 120, `${page}: only ${text.split(' ').length} words of text`);
  }
});

// Utility screens must stay out of the sitemap: listing a ~50-word page as
// worth indexing is what produced the Soft 404 rows.
test('seo: sitemap omits the thin utility screens', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'seo.js'), 'utf8');
  const block = src.slice(src.indexOf('const staticPages'), src.indexOf('];', src.indexOf('const staticPages')));
  for (const p of ['/login.html', '/qr.html']) {
    assert.ok(!block.includes(`'${p}'`), `sitemap must not list ${p}`);
  }
  assert.ok(block.includes("'/register.html'"), 'register.html should stay listed');
});

// Entity pages had the same Soft 404 shape: a blog article reached the crawler
// as ~10 words (empty <article>), every region page as ~32. Run the real
// middleware and check the HTML that actually goes out.
test('seo: entity pages ship their content server-rendered', async () => {
  const run = (p, id) => new Promise((resolve, reject) => {
    const req = { path: p, method: 'GET', query: { id } };
    const res = {
      statusCode: 200,
      set() { return this; }, status(c) { this.statusCode = c; return this; },
      type() { return this; }, send(h) { resolve({ html: h, code: this.statusCode }); },
    };
    seo(req, res, () => reject(new Error(`${p}?id=${id} fell through to next()`)));
  });

  const words = h => {
    const b = (h.match(/<body[\s\S]*<\/body>/i) || [''])[0];
    const t = b.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
               .replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
    return t ? t.split(' ').length : 0;
  };

  const post = await run('/blog-post.html', 'first-time-oman');
  assert.strictEqual(post.code, 200);
  assert.ok(post.html.includes('Muscat'), 'article body missing from the server HTML');
  assert.ok(words(post.html) > 200, `blog post is still thin: ${words(post.html)} words`);

  const region = await run('/region.html', 'muscat');
  assert.strictEqual(region.code, 200);
  assert.ok(region.html.includes('royal capital'), 'region tagline missing');
  assert.ok(words(region.html) > 120, `region page is still thin: ${words(region.html)} words`);

  // A bad id must still be a real 404, not a thin 200.
  const missing = await run('/blog-post.html', 'no-such-post');
  assert.strictEqual(missing.code, 404, 'unknown id must stay a real 404');
});

// The last four thin pages need the database, so they are rendered behind a
// cache with a fallback. The fallback matters more than the rendering: an SEO
// improvement must never be able to take a live page down.
test('seo: DB-backed pages fall back to the plain page when the query fails', async () => {
  const seoLanding = require('../src/routes/seoLanding');
  const real = seoLanding.verifiedProviders;
  seoLanding.verifiedProviders = async () => { throw new Error('DB down'); };
  try {
    const req = { path: '/search.html', method: 'GET', query: {} };
    const got = await new Promise((resolve, reject) => {
      const res = { set() { return this; }, status() { return this; },
                    type() { return this; }, send: resolve };
      seo(req, res, () => reject(new Error('fell through to next()')));
    });
    assert.ok(got.includes('</html>'), 'a complete page must still be served');
    assert.ok(got.includes('<link rel="canonical"'), 'meta injection must survive the failure');
  } finally {
    seoLanding.verifiedProviders = real;
  }
});

// The Instant Guide page describes a live service; it must carry real text
// rather than a cached "available now" list that would always be stale.
test('seo: the Instant Guide page explains the service in the server HTML', () => {
  const { _staticPage } = require('../src/middleware/seoMeta');
  const html = _staticPage('/instant.html');
  assert.ok(html, '/instant.html must be served by seoMeta');
  assert.ok(html.includes('Ministry-licensed'), 'service explanation missing');
  assert.ok(!/available now[\s\S]{0,200}guide-profile\.html/i.test(html),
    'a cached list of live availability must not be baked into the page');
});
