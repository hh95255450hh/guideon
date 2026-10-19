const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  PLACES, CATEGORIES, guideServesPlace, guideMatchesCategory, companyServesPlace, norm, asList,
} = require('../src/services/seoLanding');

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
  for (const p of ['/tour-guides', '/ar/tour-guides', // hub for the head term "tour guide in Oman"
                   '/tour-guides/:place', '/ar/tour-guides/:place', '/tours/:category', '/ar/tours/:category']) {
    assert.ok(paths.includes(p), `missing route ${p}`);
  }
});

test('seo: place/category matchers still work', () => {
  const nizwa = PLACES.find(p => p.slug === 'nizwa');
  assert.ok(guideServesPlace({ destinations: ['Nizwa', 'Muscat'] }, nizwa));
  assert.ok(guideServesPlace({ destinations: ['NIZWA'] }, nizwa), 'alias match should be case-insensitive');
  assert.ok(!guideServesPlace({ destinations: ['Salalah'] }, nizwa));
  assert.ok(!guideServesPlace({}, nizwa), 'missing destinations must not throw');

  const desert = CATEGORIES.find(c => c.slug === 'desert');
  assert.ok(guideMatchesCategory({ specialisations: ['Desert Safari'] }, desert));
  assert.ok(!guideMatchesCategory({ specialisations: ['Diving'] }, desert));
  assert.ok(!guideMatchesCategory({}, desert), 'missing specialisations must not throw');
});

// The bug this fixes: half the providers write their profile in Arabic, and
// English-only aliases silently hid them from their own landing page.
test('seo: Arabic-written profiles match their place', () => {
  const nizwa = PLACES.find(p => p.slug === 'nizwa');
  assert.ok(guideServesPlace({ destinations: ['نزوى'] }, nizwa), 'plain Arabic name must match');
  assert.ok(guideServesPlace({ destinations: ['نزوى -(العقر)'] }, nizwa), 'Arabic with suffix must match');
  assert.ok(guideServesPlace({ destinations: ['مسقط . نزوى .صور . بدية'] }, nizwa), 'multi-place free text must match');

  const akhdar = PLACES.find(p => p.slug === 'jabal-akhdar');
  assert.ok(guideServesPlace({ destinations: ['الجبل الاخضر'] }, akhdar), 'hamza-less spelling must match');
  assert.ok(guideServesPlace({ destinations: ['الجبل الأخضر'] }, akhdar), 'hamza spelling must match');
  assert.ok(guideServesPlace({ destinations: ['aljabal alakhdar'] }, akhdar), 'transliteration must match');
});

test('seo: Arabic-written specialisations match their category', () => {
  const historical = CATEGORIES.find(c => c.slug === 'historical');
  assert.ok(guideMatchesCategory({ specialisations: ['المواقع التاريخية والأثرية'] }, historical));
  assert.ok(guideMatchesCategory({ specialisations: ['‏مواقع تاريخية'] }, historical), 'leading RTL mark must not break matching');

  const cultural = CATEGORIES.find(c => c.slug === 'cultural');
  assert.ok(guideMatchesCategory({ specialisations: ['الجولات الثقافية'] }, cultural));
  assert.ok(guideMatchesCategory({ specialisations: ['تراث و ثقافه و تاريخ'] }, cultural));

  const desert = CATEGORIES.find(c => c.slug === 'desert');
  assert.ok(guideMatchesCategory({ specialisations: ['رحلة الصحراء'] }, desert));
});

test('seo: normaliser folds the spellings people actually type', () => {
  assert.strictEqual(norm('الجبل الأخضر'), norm('الجبل الاخضر'));
  assert.strictEqual(norm('نزوي'), norm('نزوى'));
  assert.strictEqual(norm('قلعة'), norm('قلعه'));
  assert.strictEqual(norm('  Muscat  '), 'muscat');
  assert.strictEqual(norm(null), '');
});

test('seo: asList copes with array, JSON string, free text and junk', () => {
  assert.deepStrictEqual(asList(['a', 'b']), ['a', 'b']);
  assert.deepStrictEqual(asList('["نزوى"]'), ['نزوى']);
  assert.deepStrictEqual(asList('Nizwa and Muscat'), ['Nizwa and Muscat']);
  assert.deepStrictEqual(asList(null), []);
  assert.deepStrictEqual(asList(''), []);
  assert.deepStrictEqual(asList(42), []);
});

test('seo: companies match by destinations, description or name', () => {
  const nizwa = PLACES.find(p => p.slug === 'nizwa');
  assert.ok(companyServesPlace({ companyDestinations: ['نزوى'] }, nizwa), 'Arabic destination');
  assert.ok(companyServesPlace({ companyDestinations: '["Nizwa"]' }, nizwa), 'JSON-string destination');
  assert.ok(companyServesPlace({ companyName: 'Old Nizawa Tours', companyDestinations: [] }, nizwa) === false,
    'a near-miss in the name must not create a false match');
  assert.ok(companyServesPlace({ companyDescription: 'We run day trips around Nizwa and Bahla.' }, nizwa),
    'description fallback should work when destinations are empty');
  assert.ok(!companyServesPlace({}, nizwa), 'empty company must not throw');
});

test('seo: landing router registers company routes in both languages', () => {
  const router = require('../src/routes/seoLanding');
  const paths = router.stack.map(l => l.route && l.route.path).filter(Boolean);
  for (const p of ['/tour-companies', '/ar/tour-companies', '/tour-companies/:place', '/ar/tour-companies/:place']) {
    assert.ok(paths.includes(p), `missing route ${p}`);
  }
});

test('seo: landing router registers place x category combo routes', () => {
  const router = require('../src/routes/seoLanding');
  const paths = router.stack.map(l => l.route && l.route.path).filter(Boolean);
  for (const p of ['/tour-guides/:place/:category', '/ar/tour-guides/:place/:category']) {
    assert.ok(paths.includes(p), `missing route ${p}`);
  }
  // The single-segment place route must stay registered BEFORE the combo route,
  // otherwise /tour-guides/nizwa could be captured by the two-segment handler.
  assert.ok(paths.indexOf('/tour-guides/:place') < paths.indexOf('/tour-guides/:place/:category'));
});

// The sitemap must never advertise a URL the page itself marks noindex.
test('seo: combo threshold is identical in the route and the sitemap', () => {
  const routeSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'seoLanding.js'), 'utf8');
  const mapSrc   = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'seo.js'), 'utf8');
  const a = routeSrc.match(/MIN_COMBO\s*=\s*(\d+)/);
  const b = mapSrc.match(/MIN_COMBO\s*=\s*(\d+)/);
  assert.ok(a && b, 'both files must define MIN_COMBO');
  assert.strictEqual(a[1], b[1], 'sitemap would list pages the route serves as noindex');
});

test('seo: Dockerfile pins a patch-level base image', () => {
  const df = fs.readFileSync(path.join(__dirname, '..', 'Dockerfile'), 'utf8');
  const m = df.match(/^FROM\s+node:(\S+)/m);
  assert.ok(m, 'Dockerfile must have a FROM node: line');
  assert.match(m[1], /^\d+\.\d+/, 'base image must be pinned to a patch tag, not a floating major');
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
