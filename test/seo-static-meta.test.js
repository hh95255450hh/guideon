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
