/**
 * Server-rendered programmatic SEO landing pages — bilingual.
 *   GET /tour-guides/:place      — guides serving a destination (English)
 *   GET /tours/:category         — guides offering a category (English)
 *   GET /ar/tour-guides/:place   — النسخة العربية
 *   GET /ar/tours/:category
 *
 * Each page is fully rendered HTML (crawlers index it without running JS),
 * carries a unique <title>/description/canonical, declares its hreflang pair so
 * Google serves the right language per searcher, lists real verified guides,
 * cross-links to sibling pages for internal link equity, and embeds JSON-LD
 * (BreadcrumbList + ItemList) so Google can show rich results.
 *
 * A page with zero guides is marked noindex: an empty list is thin content and
 * indexing it would dilute the whole site's quality signal. It flips back to
 * indexable automatically as soon as a guide covers that place/category.
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
  const all = (await users.findAllWhere({ userType: 'guide', isVerified: true }))
    .filter(g => !g.isSuspended);   // NULL isSuspended = active (eq filter would drop NULLs)
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

// ── UI strings per language ──
const T = {
  en: {
    findGuide: 'Find a Guide', signUp: 'Sign Up', home: 'Home', destinations: 'Destinations', tours: 'Tours',
    verified: '✓ Verified', newGuide: 'New', viewProfile: 'View profile', perDay: 'OMR/day',
    exploreMore: 'Explore more of Oman', guidesIn: n => `Guides in ${n}`, catTours: n => `${n} tours`,
    onboarding: n => `We're onboarding guides for ${n} right now.`,
    browseAll: 'Browse all Oman guides', searchFilter: n => `🔍 Search & filter ${n} guides`,
    otherLang: 'العربية', from: 'from',
  },
  ar: {
    findGuide: 'ابحث عن مرشد', signUp: 'إنشاء حساب', home: 'الرئيسية', destinations: 'الوجهات', tours: 'الرحلات',
    verified: '✓ موثّق', newGuide: 'جديد', viewProfile: 'عرض الملف', perDay: 'ر.ع/اليوم',
    exploreMore: 'اكتشف المزيد من عُمان', guidesIn: n => `مرشدو ${n}`, catTours: n => `رحلات ${n}`,
    onboarding: n => `نعمل حاليًا على ضمّ مرشدين في ${n}.`,
    browseAll: 'تصفّح كل مرشدي عُمان', searchFilter: n => `🔍 ابحث وفلتر مرشدي ${n}`,
    otherLang: 'English', from: 'من',
  },
};

// Shared page shell — consistent header/footer + the site stylesheet.
function shell({ lang, title, description, canonical, altUrl, h1, intro, bodyHtml, jsonld, noindex }) {
  const ar = lang === 'ar';
  const t = T[lang];
  const enUrl = ar ? altUrl : canonical;
  const arUrl = ar ? canonical : altUrl;
  return `<!DOCTYPE html>
<html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<link rel="alternate" hreflang="en" href="${esc(enUrl)}">
<link rel="alternate" hreflang="ar" href="${esc(arUrl)}">
<link rel="alternate" hreflang="x-default" href="${esc(enUrl)}">
<meta name="robots" content="${noindex ? 'noindex, follow' : 'index, follow'}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${APP_URL}/logo.png">
<meta property="og:site_name" content="Guideon">
<meta property="og:locale" content="${ar ? 'ar_OM' : 'en_US'}">
<meta property="og:locale:alternate" content="${ar ? 'en_US' : 'ar_OM'}">
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
  .langsw{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.4);color:#fff;border-radius:20px;padding:5px 14px;font-size:.82rem;font-weight:700;text-decoration:none}
  .langsw:hover{background:rgba(255,255,255,.25);color:#fff}
</style>
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head>
<body>
<nav class="navbar navbar-expand-lg navbar-dark sticky-top">
  <div class="container">
    <a class="navbar-brand" href="${ar ? '/?lang=ar' : '/'}"><img src="/logo.png" alt="Guideon" height="46"></a>
    <div class="ms-auto d-flex gap-2 align-items-center">
      <a href="${esc(altUrl)}" class="langsw">${t.otherLang}</a>
      <a href="/search.html" class="btn btn-sm btn-outline-light">${t.findGuide}</a>
      <a href="/register.html" class="btn btn-sm btn-gold">${t.signUp}</a>
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

function guideCard(g, lang) {
  const t = T[lang];
  const photo = safeImg(g.photo);
  const initials = (g.fullName || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const specs = (g.specialisations || []).slice(0, 3)
    .map(s => `<span class="chip">${esc(s)}</span>`).join('');
  const rating = Number(g.rating) || 0;
  const ratingHtml = rating ? `⭐ ${rating.toFixed(1)}` : t.newGuide;
  return `<div class="col-12 col-sm-6 col-lg-4">
    <a href="/guide-profile.html?id=${esc(g.id)}" style="text-decoration:none;color:inherit">
      <div class="gcard">
        <div class="ph"${photo ? ` style="background-image:url('${esc(photo)}')"` : ''}>${photo ? '' : esc(initials)}</div>
        <div class="bd">
          <div class="d-flex justify-content-between align-items-start">
            <h3>${esc(g.fullName)}</h3>
            ${g.isVerified ? `<span class="vbadge">${t.verified}</span>` : ''}
          </div>
          <div class="text-muted small mb-2">${ratingHtml}${g.pricePerDay ? ` · ${t.from} ${esc(g.pricePerDay)} ${t.perDay}` : ''}</div>
          <div class="mb-2">${specs}</div>
          <span class="btn btn-sm btn-teal mt-auto w-100">${t.viewProfile}</span>
        </div>
      </div>
    </a>
  </div>`;
}

// Cross-links to sibling landing pages — stays inside the current language so
// crawlers follow a clean per-language link graph.
function relatedLinks(currentSlug, lang) {
  const t = T[lang], pre = lang === 'ar' ? '/ar' : '';
  const name = o => lang === 'ar' ? o.ar : o.en;
  const places = PLACES.filter(p => p.slug !== currentSlug).slice(0, 8)
    .map(p => `<a href="${pre}/tour-guides/${p.slug}">${esc(t.guidesIn(name(p)))}</a>`).join('');
  const cats = CATEGORIES.filter(c => c.slug !== currentSlug).slice(0, 6)
    .map(c => `<a href="${pre}/tours/${c.slug}">${esc(t.catTours(name(c)))}</a>`).join('');
  return `
    <h2 class="fw-700 mt-5 mb-2" style="font-size:1.2rem">${t.exploreMore}</h2>
    <div class="seo-links">${places}${cats}</div>`;
}

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// ── Place pages ──
async function renderPlace(req, res, next, lang) {
  const place = PLACE_BY_SLUG[String(req.params.place).toLowerCase()];
  if (!place) return next(); // unknown slug → fall through to static/404
  const ar = lang === 'ar', t = T[lang];

  try {
    const all = await verifiedGuides();
    const matches = all.filter(g => guideServesPlace(g, place))
      .sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
    const n = matches.length;

    const canonical = `${APP_URL}${ar ? '/ar' : ''}/tour-guides/${place.slug}`;
    const altUrl    = `${APP_URL}${ar ? '' : '/ar'}/tour-guides/${place.slug}`;

    const title = ar
      ? `مرشدون سياحيون في ${place.ar}، عُمان — احجز مرشدًا محليًا موثّقًا | Guideon`
      : `Tour Guides in ${place.en}, Oman — Book Verified Local Guides | Guideon`;
    const description = ar
      ? `ابحث واحجز مرشدين سياحيين مرخّصين في ${place.ar} بسلطنة عُمان. قارن ${n || 'أفضل'} مرشدًا موثّقًا حسب التقييم واللغة والسعر. ${place.blurbAr}`
      : `Find and book licensed local tour guides in ${place.en}, Oman. Compare ${n || 'top'} verified guides by rating, language and price. ${place.en} is ${place.blurb}`;
    const h1 = ar ? `مرشدون سياحيون في ${place.ar}، عُمان` : `Tour Guides in ${place.en}, Oman`;
    const intro = ar
      ? `اكتشف ${esc(place.ar)} (${esc(place.en)}) مع مرشد محلي مرخّص. ${esc(place.blurbAr)} تصفّح مرشدي Guideon الموثّقين أدناه واحجز بثقة.`
      : `Discover ${esc(place.en)} (${esc(place.ar)}) with a licensed local guide. ${esc(cap(place.blurb))} Browse verified Guideon guides below and book securely.`;

    const searchHref = `/search.html?destination=${encodeURIComponent(place.en)}`;
    const cardsHtml = n
      ? `<div class="row g-3">${matches.map(g => guideCard(g, lang)).join('')}</div>`
      : `<div class="text-center py-5">
           <p class="text-muted">${esc(t.onboarding(ar ? place.ar : place.en))}</p>
           <a href="${searchHref}" class="btn btn-teal">${t.browseAll}</a>
         </div>`;

    const countLine = ar
      ? `${n} مرشدًا موثّقًا يغطّون ${esc(place.ar)} ومحافظة ${esc(place.govAr)}.`
      : `${n} verified guide${n === 1 ? '' : 's'} serving ${esc(place.en)} and the wider ${esc(place.gov)} governorate.`;

    const bodyHtml = `
      <div class="crumbs"><a href="${ar ? '/?lang=ar' : '/'}">${t.home}</a> › <a href="/regions.html">${t.destinations}</a> › ${esc(ar ? place.ar : place.en)}</div>
      <p class="text-muted">${countLine}</p>
      <div class="my-3"><a href="${searchHref}" class="btn btn-teal">${esc(t.searchFilter(ar ? place.ar : place.en))}</a></div>
      ${cardsHtml}
      ${relatedLinks(place.slug, lang)}`;

    const jsonld = {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: t.home, item: APP_URL + '/' },
          { '@type': 'ListItem', position: 2, name: t.destinations, item: APP_URL + '/regions.html' },
          { '@type': 'ListItem', position: 3, name: ar ? place.ar : place.en, item: canonical },
        ]},
        { '@type': 'ItemList', name: title, numberOfItems: n,
          itemListElement: matches.slice(0, 20).map((g, i) => ({
            '@type': 'ListItem', position: i + 1,
            url: `${APP_URL}/guide-profile.html?id=${g.id}`,
            name: g.fullName,
          })) },
      ],
    };

    res.set('Cache-Control', 'public, max-age=600'); // 10 min edge cache
    res.type('html').send(shell({ lang, title, description, canonical, altUrl, h1, intro, bodyHtml, jsonld, noindex: n === 0 }));
  } catch (e) {
    console.error('[seoLanding:place]', e.message);
    next();
  }
}

// ── Category pages ──
async function renderCategory(req, res, next, lang) {
  const cat = CAT_BY_SLUG[String(req.params.category).toLowerCase()];
  if (!cat) return next();
  const ar = lang === 'ar', t = T[lang];

  try {
    const all = await verifiedGuides();
    const matches = all.filter(g => guideMatchesCategory(g, cat))
      .sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
    const n = matches.length;

    const canonical = `${APP_URL}${ar ? '/ar' : ''}/tours/${cat.slug}`;
    const altUrl    = `${APP_URL}${ar ? '' : '/ar'}/tours/${cat.slug}`;

    const title = ar
      ? `رحلات ${cat.ar} في عُمان — احجز مع مرشدين موثّقين | Guideon`
      : `${cat.en} Tours in Oman — Book Verified Guides | Guideon`;
    const description = ar
      ? `احجز رحلات ${cat.ar} في جميع أنحاء عُمان مع مرشدين محليين مرخّصين: ${cat.blurbAr} قارن ${n || 'أفضل'} مرشدًا موثّقًا على Guideon.`
      : `Book ${cat.en.toLowerCase()} tours across Oman with licensed local guides: ${cat.blurb} Compare ${n || 'top'} verified guides on Guideon.`;
    const h1 = ar ? `رحلات ${cat.ar} في عُمان` : `${cat.en} Tours in Oman`;
    const intro = ar
      ? `تبحث عن تجارب ${esc(cat.ar)} (${esc(cat.en)}) في عُمان؟ ${esc(cat.blurbAr)} احجز مرشدًا محليًا موثّقًا أدناه.`
      : `Looking for ${esc(cat.en.toLowerCase())} experiences (${esc(cat.ar)}) in Oman? ${esc(cap(cat.blurb))} Book a verified local guide below.`;

    const searchHref = `/search.html?specialisation=${encodeURIComponent(cat.en)}`;
    const cardsHtml = n
      ? `<div class="row g-3">${matches.map(g => guideCard(g, lang)).join('')}</div>`
      : `<div class="text-center py-5">
           <p class="text-muted">${esc(t.onboarding(ar ? `رحلات ${cat.ar}` : cat.en.toLowerCase()))}</p>
           <a href="${searchHref}" class="btn btn-teal">${t.browseAll}</a>
         </div>`;

    const countLine = ar
      ? `${n} مرشدًا موثّقًا يقدّمون تجارب ${esc(cat.ar)} في عُمان.`
      : `${n} verified guide${n === 1 ? '' : 's'} offering ${esc(cat.en.toLowerCase())} experiences across Oman.`;

    const bodyHtml = `
      <div class="crumbs"><a href="${ar ? '/?lang=ar' : '/'}">${t.home}</a> › <a href="/search.html">${t.tours}</a> › ${esc(ar ? cat.ar : cat.en)}</div>
      <p class="text-muted">${countLine}</p>
      <div class="my-3"><a href="${searchHref}" class="btn btn-teal">${esc(t.searchFilter(ar ? cat.ar : cat.en.toLowerCase()))}</a></div>
      ${cardsHtml}
      ${relatedLinks(cat.slug, lang)}`;

    const jsonld = {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: t.home, item: APP_URL + '/' },
          { '@type': 'ListItem', position: 2, name: t.tours, item: APP_URL + '/search.html' },
          { '@type': 'ListItem', position: 3, name: ar ? cat.ar : cat.en, item: canonical },
        ]},
        { '@type': 'ItemList', name: title, numberOfItems: n,
          itemListElement: matches.slice(0, 20).map((g, i) => ({
            '@type': 'ListItem', position: i + 1,
            url: `${APP_URL}/guide-profile.html?id=${g.id}`,
            name: g.fullName,
          })) },
      ],
    };

    res.set('Cache-Control', 'public, max-age=600');
    res.type('html').send(shell({ lang, title, description, canonical, altUrl, h1, intro, bodyHtml, jsonld, noindex: n === 0 }));
  } catch (e) {
    console.error('[seoLanding:category]', e.message);
    next();
  }
}

router.get('/tour-guides/:place',    (req, res, next) => renderPlace(req, res, next, 'en'));
router.get('/ar/tour-guides/:place', (req, res, next) => renderPlace(req, res, next, 'ar'));
router.get('/tours/:category',       (req, res, next) => renderCategory(req, res, next, 'en'));
router.get('/ar/tours/:category',    (req, res, next) => renderCategory(req, res, next, 'ar'));

module.exports = router;
