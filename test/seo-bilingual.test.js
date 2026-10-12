const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { PLACES, CATEGORIES, guideServesPlace, guideMatchesCategory } = require('../src/services/seoLanding');

const PUBLIC = path.join(__dirname, '..', 'public');

test('seo: every place has both languages filled in', () => {
  for (const p of PLACES) {
    for (const f of ['slug', 'en', 'ar', 'gov', 'govAr', 'blurb', 'blurbAr']) {
      assert.ok(p[f] && String(p[f]).trim(), `place ${p.slug} missing ${f}`);
    }
    assert.ok(/[؀-ۿ]/.test(p.ar), `place ${p.slug}: ar is not Arabic`);
    assert.ok(/[؀-ۿ]/.test(p.blurbAr), `place ${p.slug}: blurbAr is not Arabic`);
    assert.ok(Array.isArray(p.aliases) && p.aliases.length, `place ${p.slug} has no aliases`);
  }
});

test('seo: every category has both languages filled in', () => {
  for (const c of CATEGORIES) {
    for (const f of ['slug', 'en', 'ar', 'blurb', 'blurbAr']) {
      assert.ok(c[f] && String(c[f]).trim(), `category ${c.slug} missing ${f}`);
    }
    assert.ok(/[؀-ۿ]/.test(c.blurbAr), `category ${c.slug}: blurbAr is not Arabic`);
  }
});

test('seo: slugs are unique and URL-safe', () => {
  const slugs = [...PLACES, ...CATEGORIES].map(x => x.slug);
  assert.strictEqual(new Set(slugs).size, slugs.length, 'duplicate slug');
  slugs.forEach(s => assert.match(s, /^[a-z0-9-]+$/, `bad slug: ${s}`));
});

test('seo: landing router registers both EN and AR routes', () => {
  const router = require('../src/routes/seoLanding');
  const paths = router.stack.map(l => l.route && l.route.path).filter(Boolean);
  for (const p of ['/tour-guides/:place', '/ar/tour-guides/:place', '/tours/:category', '/ar/tours/:category']) {
    assert.ok(paths.includes(p), `missing route ${p}`);
  }
});

test('seo: place/category matchers still work', () => {
  const nizwa = PLACES.find(p => p.slug === 'nizwa');
  assert.ok(guideServesPlace({ destinations: ['Nizwa', 'Muscat'] }, nizwa));
  assert.ok(guideServesPlace({ destinations: ['bahla'] }, nizwa), 'alias match should be case-insensitive');
  assert.ok(!guideServesPlace({ destinations: ['Salalah'] }, nizwa));
  assert.ok(!guideServesPlace({}, nizwa), 'missing destinations must not throw');

  const desert = CATEGORIES.find(c => c.slug === 'desert');
  assert.ok(guideMatchesCategory({ specialisations: ['Desert Safari'] }, desert));
  assert.ok(!guideMatchesCategory({ specialisations: ['Diving'] }, desert));
  assert.ok(!guideMatchesCategory({}, desert), 'missing specialisations must not throw');
});

test('seo: robots.txt allows AI answer engines but keeps private areas closed', () => {
  const robots = fs.readFileSync(path.join(PUBLIC, 'robots.txt'), 'utf8');
  for (const bot of ['GPTBot', 'PerplexityBot', 'ClaudeBot', 'OAI-SearchBot', 'Google-Extended']) {
    assert.ok(robots.includes(`User-agent: ${bot}`), `robots.txt missing ${bot}`);
  }
  // The AI block must repeat the private disallows — a bare "Allow: /" group
  // would otherwise expose dashboards to those crawlers.
  const aiBlock = robots.slice(robots.indexOf('User-agent: GPTBot'));
  for (const dis of ['/api/', '/admin', '/checkout', '/guide-dashboard']) {
    assert.ok(aiBlock.includes(`Disallow: ${dis}`), `AI block missing Disallow: ${dis}`);
  }
  assert.ok(robots.includes('Sitemap: https://guideon.om/sitemap.xml'));
});

test('seo: llms.txt exists and lists both language URL patterns', () => {
  const llms = fs.readFileSync(path.join(PUBLIC, 'llms.txt'), 'utf8');
  assert.ok(llms.includes('/tour-guides/'), 'llms.txt must list the EN landing pattern');
  assert.ok(llms.includes('/ar/tour-guides/'), 'llms.txt must list the AR landing pattern');
  assert.ok(/[؀-ۿ]/.test(llms), 'llms.txt should carry an Arabic summary');
  // Every place/category should be discoverable by an answer engine.
  PLACES.forEach(p => assert.ok(llms.includes(`/tour-guides/${p.slug}`), `llms.txt missing place ${p.slug}`));
  CATEGORIES.forEach(c => assert.ok(llms.includes(`/tours/${c.slug}`), `llms.txt missing category ${c.slug}`));
});

test('seo: home page links to the Arabic landing pages and declares sameAs', () => {
  const html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
  assert.ok(html.includes('/ar/tour-guides/nizwa'), 'home must link into the Arabic landing set');
  assert.ok(html.includes('"sameAs"'), 'Organization schema should declare sameAs');
});
