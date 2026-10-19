const test = require('node:test');
const assert = require('node:assert');
const seo = require('../src/middleware/seoMeta');

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
