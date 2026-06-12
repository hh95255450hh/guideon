/**
 * Server-rendered programmatic SEO landing pages.
 *   GET /tour-guides/:place   — guides serving a destination
 *   GET /tours/:category      — guides offering a category of experience
 *
 * Each page is fully rendered HTML (crawlers index it without running JS),
 * carries a unique <title>/description/canonical, lists real verified guides,
 * cross-links to sibling pages for internal link equity, and embeds JSON-LD
 * (BreadcrumbList + ItemList) so Google can show rich results.
 */
const router = require('express').Router();
const SupabaseDB = require('../models/SupabaseDB');
const {
  PLACES, CATEGORIES, PLACE_BY_SLUG, CAT_BY_SLUG,
  guideServesPlace, guideMatchesCategory,
} = require('../services/seoLanding');

const users = new SupabaseDB('users');
const APP_URL = (process.env.APP_URL || 'https://guideon.om').replace(/\/$/, '');

// Tiny 5-minute cache of verified guides so a crawler hitting many pages in a
// burst doesn't hammer the DB.
let _guidesCache = { at: 0, rows: [] };
async function verifiedGuides() {
  if (Date.now() - _guidesCache.at < 5 * 60 * 1000 && _guidesCache.rows.length) {
    return _guidesCache.rows;
  }
  const all = await users.findAllWhere({ userType: 'guide', isVerified: true, isSuspended: false });
  _guidesCache = { at: Date.now(), rows: all };
  return all;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function safeImg(u) {
  const s = String(u || '').trim();
  return /^https:\/\//i.test(s) || s.startsWith('/') ? s : '';
}

// Shared page shell — consistent header/footer + the site stylesheet.
function shell({ title, description, canonical, h1, intro, bodyHtml, jsonld }) {
  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta name="robots" content="index, follow">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${APP_URL}/logo.png">
<meta property="og:site_name" content="Guideon">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="stylesheet" href="/css/bootstrap.min.css">
<link rel="stylesheet" href="/css/style.css?v=40">
<style>
  .seo-hero{background:linear-gradient(135deg,#0a5c50,#0f7b6c);color:#fff;padding:54px 20px 44px;text-align:center}
  .seo-hero h1{font-size:2rem;font-weight:800;margin-bottom:10px}
  .seo-hero p{max-width:720px;margin:0 auto;opacity:.93;line-height:1.7}
  .seo-wrap{max-width:1100px;margin:0 auto;padding:36px 18px 70px}
  .gcard{background:#fff;border:1px solid #e7eaee;border-radius:14px;overflow:hidden;height:100%;transition:.15s;display:flex;flex-direction:column}
  .gcard:hover{box-shadow:0 8px 24px rgba(15,28,62,.10);transform:translateY(-2px)}
  .gcard .ph{height:150px;background:#e2f0ee center/cover no-repeat;display:flex;align-items:center;justify-content:center;color:#0f7b6c;font-size:2.2rem;font-weight:800}
  .gcard .bd{padding:14px 16px;flex:1;display:flex;flex-direction:column}
  .gcard h3{font-size:1.02rem;font-weight:800;margin:0 0 4px;color:#0f1c3e}
  .vbadge{display:inline-block;background:rgba(16,185,129,.12);color:#059669;font-weight:800;font-size:.72rem;padding:2px 8px;border-radius:12px}
  .chip{display:inline-block;background:#f0faf8;color:#0f7b6c;border:1px solid #d6efe9;border-radius:14px;padding:2px 10px;font-size:.74rem;font-weight:700;margin:2px 4px 2px 0}
  .seo-links{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 0}
  .seo-links a{background:#fff;border:1px solid #e7eaee;border-radius:20px;padding:6px 14px;font-size:.82rem;font-weight:700;color:#0f7b6c;text-decoration:none}
  .seo-links a:hover{border-color:#0f7b6c}
  .crumbs{font-size:.82rem;color:#64748b;margin-bottom:6px}
  .crumbs a{color:#0f7b6c;text-decoration:none}
</style>
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head>
<body>
<nav class="navbar navbar-expand-lg navbar-dark sticky-top">
  <div class="container">
    <a class="navbar-brand" href="/"><img src="/logo.png" alt="Guideon" height="46"></a>
    <div class="ms-auto d-flex gap-2">
      <a href="/search.html" class="btn btn-sm btn-outline-light">Find a Guide</a>
      <a href="/register.html" class="btn btn-sm btn-gold">Sign Up</a>
    </div>
  </div>
</nav>
<div class="seo-hero">
  <h1>${esc(h1)}</h1>
  <p>${intro}</p>
</div>
<div class="seo-wrap">
${bodyHtml}
</div>
<script src="/js/common-widgets.js?v=14"></script>
</body>
</html>`;
}

function guideCard(g) {
  const photo = safeImg(g.photo);
  const initials = (g.fullName || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const specs = (g.specialisations || []).slice(0, 3)
    .map(s => `<span class="chip">${esc(s)}</span>`).join('');
  const rating = Number(g.rating) || 0;
  const ratingHtml = rating ? `⭐ ${rating.toFixed(1)}` : 'New';
  return `<div class="col-12 col-sm-6 col-lg-4">
    <a href="/guide-profile.html?id=${esc(g.id)}" style="text-decoration:none;color:inherit">
      <div class="gcard">
        <div class="ph"${photo ? ` style="background-image:url('${esc(photo)}')"` : ''}>${photo ? '' : esc(initials)}</div>
        <div class="bd">
          <div class="d-flex justify-content-between align-items-start">
            <h3>${esc(g.fullName)}</h3>
            ${g.isVerified ? '<span class="vbadge">✓ Verified</span>' : ''}
          </div>
          <div class="text-muted small mb-2">${ratingHtml}${g.pricePerDay ? ` · from ${esc(g.pricePerDay)} OMR/day` : ''}</div>
          <div class="mb-2">${specs}</div>
          <span class="btn btn-sm btn-teal mt-auto w-100">View profile</span>
        </div>
      </div>
    </a>
  </div>`;
}

function relatedLinks(currentSlug, kind) {
  const places = PLACES.filter(p => p.slug !== currentSlug).slice(0, 8)
    .map(p => `<a href="/tour-guides/${p.slug}">Guides in ${esc(p.en)}</a>`).join('');
  const cats = CATEGORIES.filter(c => c.slug !== currentSlug).slice(0, 6)
    .map(c => `<a href="/tours/${c.slug}">${esc(c.en)} tours</a>`).join('');
  return `
    <h2 class="fw-700 mt-5 mb-2" style="font-size:1.2rem">Explore more of Oman</h2>
    <div class="seo-links">${places}${cats}</div>`;
}

// ── /tour-guides/:place ──
router.get('/tour-guides/:place', async (req, res, next) => {
  const place = PLACE_BY_SLUG[String(req.params.place).toLowerCase()];
  if (!place) return next(); // unknown slug → fall through to static/404

  try {
    const all = await verifiedGuides();
    const matches = all.filter(g => guideServesPlace(g, place))
      .sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));

    const canonical = `${APP_URL}/tour-guides/${place.slug}`;
    const title = `Tour Guides in ${place.en}, Oman — Book Verified Local Guides | Guideon`;
    const description = `Find and book licensed local tour guides in ${place.en}, Oman. Compare ${matches.length || 'top'} verified guides by rating, language and price. ${place.en} is ${place.blurb}`;
    const h1 = `Tour Guides in ${place.en}, Oman`;
    const intro = `Discover ${esc(place.en)} (${esc(place.ar)}) with a licensed local guide. ${esc(place.blurb.charAt(0).toUpperCase() + place.blurb.slice(1))} Browse verified Guideon guides below and book securely.`;

    const cardsHtml = matches.length
      ? `<div class="row g-3">${matches.map(guideCard).join('')}</div>`
      : `<div class="text-center py-5">
           <p class="text-muted">We're onboarding guides for ${esc(place.en)} right now.</p>
           <a href="/search.html?destination=${encodeURIComponent(place.en)}" class="btn btn-teal">Browse all Oman guides</a>
         </div>`;

    const bodyHtml = `
      <div class="crumbs"><a href="/">Home</a> › <a href="/regions.html">Destinations</a> › ${esc(place.en)}</div>
      <p class="text-muted">${matches.length} verified guide${matches.length === 1 ? '' : 's'} serving ${esc(place.en)} and the wider ${esc(place.gov)} governorate.</p>
      <div class="my-3"><a href="/search.html?destination=${encodeURIComponent(place.en)}" class="btn btn-teal">🔍 Search & filter ${esc(place.en)} guides</a></div>
      ${cardsHtml}
      ${relatedLinks(place.slug, 'place')}`;

    const jsonld = {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: APP_URL + '/' },
          { '@type': 'ListItem', position: 2, name: 'Destinations', item: APP_URL + '/regions.html' },
          { '@type': 'ListItem', position: 3, name: place.en, item: canonical },
        ]},
        { '@type': 'ItemList', name: title, numberOfItems: matches.length,
          itemListElement: matches.slice(0, 20).map((g, i) => ({
            '@type': 'ListItem', position: i + 1,
            url: `${APP_URL}/guide-profile.html?id=${g.id}`,
            name: g.fullName,
          })) },
      ],
    };

    res.set('Cache-Control', 'public, max-age=600'); // 10 min edge cache
    res.type('html').send(shell({ title, description, canonical, h1, intro, bodyHtml, jsonld }));
  } catch (e) {
    console.error('[seoLanding:place]', e.message);
    next();
  }
});

// ── /tours/:category ──
router.get('/tours/:category', async (req, res, next) => {
  const cat = CAT_BY_SLUG[String(req.params.category).toLowerCase()];
  if (!cat) return next();

  try {
    const all = await verifiedGuides();
    const matches = all.filter(g => guideMatchesCategory(g, cat))
      .sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));

    const canonical = `${APP_URL}/tours/${cat.slug}`;
    const title = `${cat.en} Tours in Oman — Book Verified Guides | Guideon`;
    const description = `Book ${cat.en.toLowerCase()} tours across Oman with licensed local guides: ${cat.blurb} Compare ${matches.length || 'top'} verified guides on Guideon.`;
    const h1 = `${cat.en} Tours in Oman`;
    const intro = `Looking for ${esc(cat.en.toLowerCase())} experiences (${esc(cat.ar)}) in Oman? ${esc(cat.blurb.charAt(0).toUpperCase() + cat.blurb.slice(1))} Book a verified local guide below.`;

    const cardsHtml = matches.length
      ? `<div class="row g-3">${matches.map(guideCard).join('')}</div>`
      : `<div class="text-center py-5">
           <p class="text-muted">We're onboarding ${esc(cat.en.toLowerCase())} guides right now.</p>
           <a href="/search.html?specialisation=${encodeURIComponent(cat.en)}" class="btn btn-teal">Browse all Oman guides</a>
         </div>`;

    const bodyHtml = `
      <div class="crumbs"><a href="/">Home</a> › <a href="/search.html">Tours</a> › ${esc(cat.en)}</div>
      <p class="text-muted">${matches.length} verified guide${matches.length === 1 ? '' : 's'} offering ${esc(cat.en.toLowerCase())} experiences across Oman.</p>
      <div class="my-3"><a href="/search.html?specialisation=${encodeURIComponent(cat.en)}" class="btn btn-teal">🔍 Search & filter ${esc(cat.en.toLowerCase())} guides</a></div>
      ${cardsHtml}
      ${relatedLinks(cat.slug, 'category')}`;

    const jsonld = {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: APP_URL + '/' },
          { '@type': 'ListItem', position: 2, name: 'Tours', item: APP_URL + '/search.html' },
          { '@type': 'ListItem', position: 3, name: cat.en, item: canonical },
        ]},
        { '@type': 'ItemList', name: title, numberOfItems: matches.length,
          itemListElement: matches.slice(0, 20).map((g, i) => ({
            '@type': 'ListItem', position: i + 1,
            url: `${APP_URL}/guide-profile.html?id=${g.id}`,
            name: g.fullName,
          })) },
      ],
    };

    res.set('Cache-Control', 'public, max-age=600');
    res.type('html').send(shell({ title, description, canonical, h1, intro, bodyHtml, jsonld }));
  } catch (e) {
    console.error('[seoLanding:category]', e.message);
    next();
  }
});

module.exports = router;
