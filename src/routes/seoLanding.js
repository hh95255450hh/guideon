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
  guideServesPlace, guideMatchesCategory, companyServesPlace,
} = require('../services/seoLanding');

const users = new SupabaseDB('users');
const APP_URL = (process.env.APP_URL || 'https://guideon.om').replace(/\/$/, '');

// Tiny 5-minute cache of verified providers so a crawler hitting many pages in
// a burst doesn't hammer the DB.
const _cache = { guide: { at: 0, rows: [] }, company: { at: 0, rows: [] } };
async function verifiedProviders(userType) {
  const slot = _cache[userType];
  if (Date.now() - slot.at < 5 * 60 * 1000 && slot.rows.length) return slot.rows;
  const all = (await users.findAllWhere({ userType, isVerified: true }))
    .filter(u => !u.isSuspended);   // NULL isSuspended = active (eq filter would drop NULLs)
  _cache[userType] = { at: Date.now(), rows: all };
  return all;
}
const verifiedGuides    = () => verifiedProviders('guide');
const verifiedCompanies = () => verifiedProviders('company');

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
    companies: 'Tourism Companies', companiesIn: n => `Tourism companies in ${n}`,
    viewCompany: 'View company', allCompanies: 'All tourism companies in Oman',
    noCompanies: n => `No registered tourism company covers ${n} yet.`,
  },
  ar: {
    findGuide: 'ابحث عن مرشد', signUp: 'إنشاء حساب', home: 'الرئيسية', destinations: 'الوجهات', tours: 'الرحلات',
    verified: '✓ موثّق', newGuide: 'جديد', viewProfile: 'عرض الملف', perDay: 'ر.ع/اليوم',
    exploreMore: 'اكتشف المزيد من عُمان', guidesIn: n => `مرشدو ${n}`, catTours: n => `رحلات ${n}`,
    onboarding: n => `نعمل حاليًا على ضمّ مرشدين في ${n}.`,
    browseAll: 'تصفّح كل مرشدي عُمان', searchFilter: n => `🔍 ابحث وفلتر مرشدي ${n}`,
    otherLang: 'English', from: 'من',
    companies: 'شركات السياحة', companiesIn: n => `شركات السياحة في ${n}`,
    viewCompany: 'عرض الشركة', allCompanies: 'جميع شركات السياحة في عُمان',
    noCompanies: n => `لا توجد شركة سياحة مسجَّلة تغطّي ${n} حتى الآن.`,
  },
};

// Representative coordinates per geographic destination (TouristDestination schema).
const GEO = {
  muscat:[23.5859,58.4059], nizwa:[22.9333,57.5333], bahla:[22.9643,57.3005],
  'jabal-shams':[23.2300,57.2600], 'al-hamra':[23.1167,57.2997], salalah:[17.0194,54.0897],
  musandam:[26.1900,56.2400], khasab:[26.1794,56.2477], sur:[22.5667,59.5289],
  'wadi-shab':[22.8406,59.2369], 'wahiba-sands':[22.1500,58.8000], 'wadi-bani-khalid':[22.6322,59.1100],
  ibra:[22.6908,58.5333], sohar:[24.3473,56.7094], rustaq:[23.3908,57.4244],
  nakhal:[23.3953,57.8250], 'jabal-akhdar':[23.0700,57.6600], ibri:[23.2254,56.5158],
  'daymaniyat-islands':[23.8500,58.0900],
};

// Three real, useful Q&A per destination — rendered visibly on the page AND
// emitted as FAQPage JSON-LD (extra unique content + feeds the AI answer
// engines that robots.txt explicitly welcomes).
function destinationFAQ(place, lang) {
  const nm = lang === 'ar' ? place.ar : place.en;
  if (lang === 'ar') return [
    { q:`ما أفضل وقت لزيارة ${nm}؟`, a:`الأشهر الأبرد من أكتوبر إلى أبريل مثالية لاستكشاف ${nm} وأنشطتها الخارجية. وتتميّز صلالة باستثناء موسم الخريف الأخضر من يونيو إلى سبتمبر.` },
    { q:`هل أحتاج مرشدًا مرخّصًا في ${nm}؟`, a:`يمكنك الاستكشاف بنفسك، لكنّ مرشدًا محليًا مرخّصًا يضيف الأمان والوصول إلى الأماكن والسياق الثقافي. يعرض Guideon مرشدين موثّقين في ${nm}، بعضهم مرخّص من الوزارة.` },
    { q:`كيف أحجز مرشدًا في ${nm}؟`, a:`تصفّح المرشدين الموثّقين في هذه الصفحة، قارن حسب التقييم واللغة والسعر، اطلب رحلة مخصّصة لتحصل على عرض سعر، ثم احجز بأمان عبر Guideon.` },
  ];
  return [
    { q:`When is the best time to visit ${nm}?`, a:`The cooler months from October to April are ideal for exploring ${nm} and its outdoor activities. Salalah is the exception, prized for its green khareef monsoon season from June to September.` },
    { q:`Do I need a licensed guide in ${nm}?`, a:`You can explore on your own, but a licensed local guide adds safety, access and cultural context. Guideon lists verified guides for ${nm}, including Ministry-licensed professionals.` },
    { q:`How do I book a guide in ${nm}?`, a:`Browse the verified guides on this page, compare them by rating, language and price, request a custom trip to get a price offer, then book securely through Guideon.` },
  ];
}

// Shared page shell — consistent header/footer + the site stylesheet.
function shell({ lang, title, description, canonical, altUrl, h1, intro, bodyHtml, jsonld, noindex, image }) {
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
<meta property="og:image" content="${esc(image || APP_URL + '/logo.png')}">
<meta property="og:site_name" content="Guideon">
<meta property="og:locale" content="${ar ? 'ar_OM' : 'en_US'}">
<meta property="og:locale:alternate" content="${ar ? 'en_US' : 'ar_OM'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image || APP_URL + '/logo.png')}">
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
  .seo-faq{background:#fff;border:1px solid #e7eaee;border-radius:12px;padding:12px 16px;margin-bottom:8px}
  .seo-faq summary{font-weight:700;color:#0f1c3e;cursor:pointer;list-style:none}
  .seo-faq summary::-webkit-details-marker{display:none}
  .seo-faq[open] summary{color:#0f7b6c}
  .seo-faq p{margin:8px 0 0;color:#475569;line-height:1.7}
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

function companyCard(c, lang) {
  const t = T[lang];
  const name = c.companyName || c.fullName || 'Tourism Company';
  const photo = safeImg(c.photo);
  const initials = String(name).trim().charAt(0).toUpperCase();
  const desc = String(c.companyDescription || '').trim().slice(0, 120);
  const rating = Number(c.rating) || 0;
  return `<div class="col-12 col-sm-6 col-lg-4">
    <a href="/company-profile.html?id=${esc(c.id)}" style="text-decoration:none;color:inherit">
      <div class="gcard">
        <div class="ph"${photo ? ` style="background-image:url('${esc(photo)}')"` : ''}>${photo ? '' : esc(initials)}</div>
        <div class="bd">
          <div class="d-flex justify-content-between align-items-start">
            <h3>${esc(name)}</h3>
            ${c.isVerified ? `<span class="vbadge">${t.verified}</span>` : ''}
          </div>
          <div class="text-muted small mb-2">${rating ? `⭐ ${rating.toFixed(1)}` : t.newGuide}</div>
          ${desc ? `<p class="text-muted small mb-2">${esc(desc)}</p>` : ''}
          <span class="btn btn-sm btn-teal mt-auto w-100">${t.viewCompany}</span>
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
  const places = PLACES.filter(p => p.slug !== currentSlug).slice(0, 10)
    .map(p => `<a href="${pre}/tour-guides/${p.slug}">${esc(t.guidesIn(name(p)))}</a>`).join('');
  const cats = CATEGORIES.filter(c => c.slug !== currentSlug).slice(0, 6)
    .map(c => `<a href="${pre}/tours/${c.slug}">${esc(t.catTours(name(c)))}</a>`).join('');
  const comp = `<a href="${pre}/tour-companies">${esc(t.allCompanies)}</a>`;
  const hubLink = `<a href="${pre}/tour-guides">${esc(lang === 'ar' ? 'كل المرشدين في عُمان' : 'All tour guides in Oman')}</a>`;
  return `
    <h2 class="fw-700 mt-5 mb-2" style="font-size:1.2rem">${t.exploreMore}</h2>
    <div class="seo-links">${hubLink}${places}${cats}${comp}</div>`;
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

    // Link the combos this place actually supports, so the long-tail pages are
    // reachable by crawl and not only via the sitemap.
    const comboLinks = CATEGORIES
      .filter(c => matches.some(g => guideMatchesCategory(g, c)))
      .map(c => `<a href="${ar ? '/ar' : ''}/tour-guides/${place.slug}/${c.slug}">${esc(ar ? `رحلات ${c.ar} في ${place.ar}` : `${c.en} tours in ${place.en}`)}</a>`)
      .join('');

    const faqs = destinationFAQ(place, lang);
    const bodyHtml = `
      <div class="crumbs"><a href="${ar ? '/?lang=ar' : '/'}">${t.home}</a> › <a href="/regions.html">${t.destinations}</a> › ${esc(ar ? place.ar : place.en)}</div>
      <p class="text-muted">${countLine}</p>
      <div class="my-3"><a href="${searchHref}" class="btn btn-teal">${esc(t.searchFilter(ar ? place.ar : place.en))}</a></div>
      ${cardsHtml}
      ${comboLinks ? `<h2 class="fw-700 mt-5 mb-2" style="font-size:1.2rem">${esc(ar ? `أنواع الرحلات في ${place.ar}` : `Tour types in ${place.en}`)}</h2><div class="seo-links">${comboLinks}</div>` : ''}
      <section class="mt-5">
        <h2 class="fw-700 mb-3" style="font-size:1.2rem">${esc(ar ? `أسئلة شائعة عن ${place.ar}` : `FAQ about ${place.en}`)}</h2>
        ${faqs.map(f => `<details class="seo-faq"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}
      </section>
      ${relatedLinks(place.slug, lang)}`;

    const geo = GEO[place.slug];
    const destination = {
      '@type': 'TouristDestination',
      name: ar ? place.ar : place.en,
      description: ar ? place.blurbAr : cap(place.blurb),
      url: canonical,
      image: `${APP_URL}/logo.png`,
      touristType: ar ? 'سيّاح' : 'Tourists',
      containedInPlace: { '@type': 'AdministrativeArea', name: ar ? place.govAr : place.gov,
        containedInPlace: { '@type': 'Country', name: ar ? 'عُمان' : 'Oman' } },
      ...(geo ? { geo: { '@type': 'GeoCoordinates', latitude: geo[0], longitude: geo[1] } } : {}),
    };
    const faqPage = { '@type': 'FAQPage', mainEntity: faqs.map(f => ({
      '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };

    const jsonld = {
      '@context': 'https://schema.org',
      '@graph': [
        destination,
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
        faqPage,
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

// ── Place × category combos ──
// The long tail lives here: "cultural tours nizwa", "رحلات صحراوية في رمال
// الشرقية". A combo only gets indexed once MIN_COMBO guides match BOTH facets —
// below that the page is real but thin, so it is served noindex and kept out of
// the sitemap rather than diluting the site's quality signal.
const MIN_COMBO = 3;

async function renderCombo(req, res, next, lang) {
  const place = PLACE_BY_SLUG[String(req.params.place).toLowerCase()];
  const cat   = CAT_BY_SLUG[String(req.params.category).toLowerCase()];
  if (!place || !cat) return next();
  const ar = lang === 'ar', t = T[lang];

  try {
    const all = await verifiedGuides();
    const matches = all.filter(g => guideServesPlace(g, place) && guideMatchesCategory(g, cat))
      .sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
    const n = matches.length;
    const pName = ar ? place.ar : place.en;
    const cName = ar ? cat.ar : cat.en;

    const canonical = `${APP_URL}${ar ? '/ar' : ''}/tour-guides/${place.slug}/${cat.slug}`;
    const altUrl    = `${APP_URL}${ar ? '' : '/ar'}/tour-guides/${place.slug}/${cat.slug}`;

    const title = ar
      ? `رحلات ${cat.ar} في ${place.ar}، عُمان — مرشدون محليون موثّقون | Guideon`
      : `${cat.en} Tours in ${place.en}, Oman — Verified Local Guides | Guideon`;
    const description = ar
      ? `احجز رحلات ${cat.ar} في ${place.ar} بسلطنة عُمان مع ${n || ''} مرشدًا محليًا مرخّصًا. ${cat.blurbAr} ${place.blurbAr}`
      : `Book ${cat.en.toLowerCase()} tours in ${place.en}, Oman with ${n || ''} licensed local guides. ${cat.blurb} ${place.en} is ${place.blurb}`;
    const h1 = ar ? `رحلات ${cat.ar} في ${place.ar}` : `${cat.en} Tours in ${place.en}`;
    const intro = ar
      ? `${esc(cat.blurbAr)} في ${esc(place.ar)} — ${esc(place.blurbAr)}`
      : `${esc(cap(cat.blurb))} In ${esc(place.en)} — ${esc(place.blurb)}`;

    const cardsHtml = n
      ? `<div class="row g-3">${matches.map(g => guideCard(g, lang)).join('')}</div>`
      : `<div class="text-center py-5">
           <p class="text-muted">${esc(t.onboarding(`${cName} · ${pName}`))}</p>
           <a href="${ar ? '/ar' : ''}/tour-guides/${place.slug}" class="btn btn-teal">${esc(t.guidesIn(pName))}</a>
         </div>`;

    // Siblings: the other categories that this place actually supports, plus
    // the same category in other places — both directions of the long tail.
    const otherCats = CATEGORIES.filter(c => c.slug !== cat.slug)
      .filter(c => all.some(g => guideServesPlace(g, place) && guideMatchesCategory(g, c)))
      .map(c => `<a href="${ar ? '/ar' : ''}/tour-guides/${place.slug}/${c.slug}">${esc(ar ? `رحلات ${c.ar} في ${place.ar}` : `${c.en} in ${place.en}`)}</a>`).join('');
    const otherPlaces = PLACES.filter(p => p.slug !== place.slug)
      .filter(p => all.some(g => guideServesPlace(g, p) && guideMatchesCategory(g, cat)))
      .slice(0, 10)
      .map(p => `<a href="${ar ? '/ar' : ''}/tour-guides/${p.slug}/${cat.slug}">${esc(ar ? `رحلات ${cat.ar} في ${p.ar}` : `${cat.en} in ${p.en}`)}</a>`).join('');

    const bodyHtml = `
      <div class="crumbs"><a href="${ar ? '/?lang=ar' : '/'}">${t.home}</a> › <a href="${ar ? '/ar' : ''}/tour-guides/${place.slug}">${esc(pName)}</a> › ${esc(cName)}</div>
      <p class="text-muted">${ar ? `${n} مرشدًا موثّقًا يقدّمون رحلات ${esc(cat.ar)} في ${esc(place.ar)}.` : `${n} verified guide${n === 1 ? '' : 's'} offering ${esc(cat.en.toLowerCase())} tours in ${esc(place.en)}.`}</p>
      <div class="my-3"><a href="${ar ? '/ar' : ''}/tour-guides/${place.slug}" class="btn btn-teal">${esc(t.guidesIn(pName))}</a></div>
      ${cardsHtml}
      ${otherCats ? `<h2 class="fw-700 mt-5 mb-2" style="font-size:1.2rem">${esc(ar ? `رحلات أخرى في ${place.ar}` : `More in ${place.en}`)}</h2><div class="seo-links">${otherCats}</div>` : ''}
      ${otherPlaces ? `<h2 class="fw-700 mt-4 mb-2" style="font-size:1.2rem">${esc(ar ? `رحلات ${cat.ar} في وجهات أخرى` : `${cat.en} tours elsewhere`)}</h2><div class="seo-links">${otherPlaces}</div>` : ''}`;

    const jsonld = {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: t.home, item: APP_URL + '/' },
          { '@type': 'ListItem', position: 2, name: pName, item: `${APP_URL}${ar ? '/ar' : ''}/tour-guides/${place.slug}` },
          { '@type': 'ListItem', position: 3, name: cName, item: canonical },
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
    res.type('html').send(shell({ lang, title, description, canonical, altUrl, h1, intro, bodyHtml, jsonld, noindex: n < MIN_COMBO }));
  } catch (e) {
    console.error('[seoLanding:combo]', e.message);
    next();
  }
}

// ── Tourism company pages ──
// `place` is optional: without it this is the national index of every
// registered tourism company, which is also the hub the per-place pages link to.
async function renderCompanies(req, res, next, lang) {
  const slug = req.params.place ? String(req.params.place).toLowerCase() : null;
  const place = slug ? PLACE_BY_SLUG[slug] : null;
  if (slug && !place) return next();
  const ar = lang === 'ar', t = T[lang];

  try {
    const all = await verifiedCompanies();
    const matches = (place ? all.filter(c => companyServesPlace(c, place)) : all)
      .sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
    const n = matches.length;
    const where = place ? (ar ? place.ar : place.en) : null;

    const suffix = place ? `/${place.slug}` : '';
    const canonical = `${APP_URL}${ar ? '/ar' : ''}/tour-companies${suffix}`;
    const altUrl    = `${APP_URL}${ar ? '' : '/ar'}/tour-companies${suffix}`;

    const title = place
      ? (ar ? `شركات السياحة في ${place.ar}، عُمان — مسجَّلة وموثّقة | Guideon`
            : `Tourism Companies in ${place.en}, Oman — Registered & Verified | Guideon`)
      : (ar ? `شركات السياحة في سلطنة عُمان — مسجَّلة وموثّقة | Guideon`
            : `Tourism Companies in Oman — Registered & Verified | Guideon`);
    const description = place
      ? (ar ? `تصفّح ${n || ''} شركة سياحة مسجَّلة تنظّم رحلات في ${place.ar} بسلطنة عُمان. باقات وجولات بأسعار واضحة وحجز آمن بالريال العُماني.`
            : `Browse ${n || ''} registered tourism companies running tours in ${place.en}, Oman. Compare packages, prices and reviews, and book securely in OMR.`)
      : (ar ? `دليل شركات السياحة المسجَّلة في سلطنة عُمان على Guideon — باقات وجولات منظّمة في جميع المحافظات، بحجز آمن بالريال العُماني.`
            : `Directory of registered tourism companies in Oman on Guideon — organised tours and packages across every governorate, booked securely in OMR.`);
    const h1 = place ? t.companiesIn(where) : (ar ? 'شركات السياحة في سلطنة عُمان' : 'Tourism Companies in Oman');
    const intro = place
      ? (ar ? `شركات سياحة مسجَّلة تنظّم رحلات وبرامج في ${esc(place.ar)}. ${esc(place.blurbAr)}`
            : `Registered tourism companies running trips and packages in ${esc(place.en)}. ${esc(cap(place.blurb))}`)
      : (ar ? 'شركات سياحة عُمانية مسجَّلة، موثّقة على المنصة، تنظّم برامج ورحلات في جميع أنحاء السلطنة.'
            : 'Registered Omani tourism companies, verified on the platform, running organised trips and packages across the Sultanate.');

    const cardsHtml = n
      ? `<div class="row g-3">${matches.map(c => companyCard(c, lang)).join('')}</div>`
      : `<div class="text-center py-5">
           <p class="text-muted">${esc(place ? t.noCompanies(where) : (ar ? 'لا توجد شركات مسجَّلة بعد.' : 'No registered companies yet.'))}</p>
           <a href="${ar ? '/ar' : ''}/tour-companies" class="btn btn-teal">${t.allCompanies}</a>
         </div>`;

    // Per-place company pages cross-link to every other place that actually has
    // a company, so the hub and spokes stay connected without dead links.
    const siblings = PLACES
      .filter(p => (!place || p.slug !== place.slug) && all.some(c => companyServesPlace(c, p)))
      .map(p => `<a href="${ar ? '/ar' : ''}/tour-companies/${p.slug}">${esc(t.companiesIn(ar ? p.ar : p.en))}</a>`)
      .join('');

    const bodyHtml = `
      <div class="crumbs"><a href="${ar ? '/?lang=ar' : '/'}">${t.home}</a> › <a href="${ar ? '/ar' : ''}/tour-companies">${t.companies}</a>${place ? ` › ${esc(where)}` : ''}</div>
      <p class="text-muted">${ar ? `${n} شركة سياحة موثّقة${place ? ` تغطّي ${esc(where)}` : ' في السلطنة'}.` : `${n} verified tourism compan${n === 1 ? 'y' : 'ies'}${place ? ` covering ${esc(where)}` : ' across Oman'}.`}</p>
      ${cardsHtml}
      ${siblings ? `<h2 class="fw-700 mt-5 mb-2" style="font-size:1.2rem">${t.companies}</h2><div class="seo-links">${siblings}</div>` : ''}
      ${relatedLinks(place ? place.slug : '', lang)}`;

    const crumbItems = [
      { '@type': 'ListItem', position: 1, name: t.home, item: APP_URL + '/' },
      { '@type': 'ListItem', position: 2, name: t.companies, item: `${APP_URL}${ar ? '/ar' : ''}/tour-companies` },
    ];
    if (place) crumbItems.push({ '@type': 'ListItem', position: 3, name: where, item: canonical });

    const jsonld = {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'BreadcrumbList', itemListElement: crumbItems },
        { '@type': 'ItemList', name: title, numberOfItems: n,
          itemListElement: matches.slice(0, 20).map((c, i) => ({
            '@type': 'ListItem', position: i + 1,
            url: `${APP_URL}/company-profile.html?id=${c.id}`,
            name: c.companyName || c.fullName,
          })) },
      ],
    };

    res.set('Cache-Control', 'public, max-age=600');
    res.type('html').send(shell({ lang, title, description, canonical, altUrl, h1, intro, bodyHtml, jsonld, noindex: n === 0 }));
  } catch (e) {
    console.error('[seoLanding:companies]', e.message);
    next();
  }
}

// ── Hub: /tour-guides and /ar/tour-guides ──
// The head term "tour guide in Oman" / "مرشد سياحي في عُمان" had no page of its
// own: /tour-guides answered 404 while 48 place pages sat underneath it. This
// hub targets the head term, lists the best-rated verified guides, and links
// every destination and trip type, so authority flows down to the long tail.
function hubFAQ(lang, nGuides) {
  if (lang === 'ar') return [
    { q: 'كيف أجد مرشدًا سياحيًا في عُمان؟', a: `يضمّ Guideon ${nGuides} مرشدًا سياحيًا موثّقًا في محافظات السلطنة. اختر الوجهة أو نوع الرحلة، قارن المرشدين حسب التقييم واللغة والسعر، ثم احجز بأمان وادفع بالريال العُماني.` },
    { q: 'هل المرشدون على Guideon مرخّصون؟', a: 'يراجع فريق Guideon كل مرشد قبل ظهوره، ويُظهر شارة «مرخّص من الوزارة» لمن يحمل ترخيص وزارة التراث والسياحة.' },
    { q: 'كم يكلّف المرشد السياحي في عُمان؟', a: 'يحدد كل مرشد سعره اليومي ويظهر في ملفه بالريال العُماني، ويمكنك طلب رحلة مخصّصة للحصول على عرض سعر قبل الدفع.' },
    { q: 'بأي لغات يتحدث المرشدون؟', a: 'العربية والإنجليزية في الغالب، ومرشدون يتحدثون الألمانية والفرنسية والإيطالية والروسية والصينية وغيرها — يمكنك التصفية حسب اللغة.' },
  ];
  return [
    { q: 'How do I find a tour guide in Oman?', a: `Guideon lists ${nGuides} verified local tour guides across the Sultanate. Pick a destination or trip type, compare guides by rating, language and price, then book securely and pay in Omani rials.` },
    { q: 'Are the guides on Guideon licensed?', a: 'Every guide is reviewed by the Guideon team before appearing, and guides holding a Ministry of Heritage and Tourism licence carry a "Ministry licensed" badge.' },
    { q: 'How much does a private tour guide in Oman cost?', a: 'Each guide sets a daily rate shown on their profile in OMR. You can also request a custom trip and get a price offer before paying anything.' },
    { q: 'What languages do Omani tour guides speak?', a: 'Mostly Arabic and English, with guides speaking German, French, Italian, Russian, Chinese and more. You can filter guides by language.' },
  ];
}

async function renderHub(req, res, next, lang) {
  const ar = lang === 'ar', t = T[lang], pre = ar ? '/ar' : '';
  try {
    const all = await verifiedGuides();
    const top = all.slice().sort((a, b) =>
      ((Number(b.rating) || 0) - (Number(a.rating) || 0)) || ((Number(b.totalReviews) || 0) - (Number(a.totalReviews) || 0)));
    const n = all.length;
    const canonical = `${APP_URL}${pre}/tour-guides`;
    const altUrl = `${APP_URL}${ar ? '' : '/ar'}/tour-guides`;
    const title = ar
      ? 'مرشد سياحي في عُمان — احجز مرشدين محليين مرخّصين | Guideon'
      : 'Tour Guides in Oman — Book Licensed Local Guides | Guideon';
    const description = ar
      ? `احجز مرشدًا سياحيًا محليًا في سلطنة عُمان: ${n} مرشدًا موثّقًا في مسقط ونزوى وصلالة ومسندم والرمال وغيرها. قارن التقييم واللغة والسعر واحجز بأمان.`
      : `Book a private local tour guide in Oman: ${n} verified, Ministry-licensed guides in Muscat, Nizwa, Salalah, Musandam, Wahiba Sands and more. Compare rating, language and price.`;
    const h1 = ar ? 'مرشدون سياحيون في سلطنة عُمان' : 'Tour Guides in Oman';
    const intro = ar
      ? 'اكتشف عُمان مع مرشد محلي يعرفها: قلاع نزوى وبهلاء، وأخوار مسندم، ورمال الشرقية، وخريف صلالة، وأودية جبال الحجر. كل مرشد على Guideon موثّق، ويحمل كثير منهم ترخيص وزارة التراث والسياحة.'
      : 'See Oman with a local who knows it: the forts of Nizwa and Bahla, the fjords of Musandam, the Wahiba Sands, the Salalah khareef and the wadis of the Hajar mountains. Every guide on Guideon is verified, and many hold a Ministry of Heritage and Tourism licence.';

    const counts = PLACES.map(p => ({ p, c: all.filter(g => guideServesPlace(g, p)).length }))
      .filter(x => x.c > 0).sort((a, b) => b.c - a.c);
    const placeLinks = counts.map(({ p, c }) =>
      `<a href="${pre}/tour-guides/${p.slug}">${esc(t.guidesIn(ar ? p.ar : p.en))} <span class="text-muted">(${c})</span></a>`).join('');
    const catLinks = CATEGORIES.filter(c => all.some(g => guideMatchesCategory(g, c)))
      .map(c => `<a href="${pre}/tours/${c.slug}">${esc(t.catTours(ar ? c.ar : c.en))}</a>`).join('');
    const faqs = hubFAQ(lang, n);

    const bodyHtml = `
      <div class="crumbs"><a href="${ar ? '/?lang=ar' : '/'}">${t.home}</a> › ${esc(h1)}</div>
      <p class="text-muted">${ar ? `${n} مرشدًا موثّقًا في ${counts.length} وجهة.` : `${n} verified guides across ${counts.length} destinations.`}</p>
      <div class="my-3"><a href="/search.html" class="btn btn-teal">${esc(t.browseAll)}</a></div>
      <h2 class="fw-700 mt-4 mb-2" style="font-size:1.2rem">${ar ? 'المرشدون حسب الوجهة' : 'Guides by destination'}</h2>
      <div class="seo-links">${placeLinks}</div>
      ${catLinks ? `<h2 class="fw-700 mt-4 mb-2" style="font-size:1.2rem">${ar ? 'حسب نوع الرحلة' : 'By type of trip'}</h2><div class="seo-links">${catLinks}</div>` : ''}
      <h2 class="fw-700 mt-5 mb-3" style="font-size:1.2rem">${ar ? 'أعلى المرشدين تقييمًا' : 'Top-rated guides'}</h2>
      <div class="row g-3">${top.slice(0, 24).map(g => guideCard(g, lang)).join('')}</div>
      <div class="my-4"><a href="${pre}/tour-companies" class="btn btn-outline-secondary">${esc(t.allCompanies)}</a></div>
      <section class="mt-5">
        <h2 class="fw-700 mb-3" style="font-size:1.2rem">${ar ? 'أسئلة شائعة' : 'Frequently asked questions'}</h2>
        ${faqs.map(f => `<details class="seo-faq"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}
      </section>`;

    const jsonld = {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: t.home, item: APP_URL + '/' },
          { '@type': 'ListItem', position: 2, name: h1, item: canonical },
        ]},
        { '@type': 'ItemList', name: h1, numberOfItems: n,
          itemListElement: top.slice(0, 24).map((g, i) => ({ '@type': 'ListItem', position: i + 1,
            url: `${APP_URL}/guide-profile.html?id=${g.id}`, name: g.fullName })) },
        { '@type': 'FAQPage', mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
      ],
    };

    res.set('Cache-Control', 'public, max-age=600');
    res.type('html').send(shell({ lang, title, description, canonical, altUrl, h1, intro, bodyHtml, jsonld, noindex: n === 0 }));
  } catch (e) {
    console.error('[seoLanding:hub]', e.message);
    next();
  }
}

router.get('/tour-guides',             (req, res, next) => renderHub(req, res, next, 'en'));
router.get('/ar/tour-guides',          (req, res, next) => renderHub(req, res, next, 'ar'));
// No category hub of its own: the guide hub lists every trip type.
router.get(['/tours', '/ar/tours'],    (req, res) => res.redirect(301, req.path.startsWith('/ar') ? '/ar/tour-guides' : '/tour-guides'));
router.get('/tour-guides/:place',       (req, res, next) => renderPlace(req, res, next, 'en'));
router.get('/ar/tour-guides/:place',    (req, res, next) => renderPlace(req, res, next, 'ar'));
router.get('/tour-guides/:place/:category',    (req, res, next) => renderCombo(req, res, next, 'en'));
router.get('/ar/tour-guides/:place/:category', (req, res, next) => renderCombo(req, res, next, 'ar'));
router.get('/tours/:category',          (req, res, next) => renderCategory(req, res, next, 'en'));
router.get('/ar/tours/:category',       (req, res, next) => renderCategory(req, res, next, 'ar'));
router.get('/tour-companies',           (req, res, next) => renderCompanies(req, res, next, 'en'));
router.get('/ar/tour-companies',        (req, res, next) => renderCompanies(req, res, next, 'ar'));
router.get('/tour-companies/:place',    (req, res, next) => renderCompanies(req, res, next, 'en'));
router.get('/ar/tour-companies/:place', (req, res, next) => renderCompanies(req, res, next, 'ar'));

module.exports = router;
