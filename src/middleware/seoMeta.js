/**
 * Server-side SEO meta injection for shareable entity pages.
 *
 * Social scrapers (WhatsApp, Facebook, Twitter, LinkedIn) and many crawlers do
 * NOT run JavaScript, so client-injected meta is invisible to them. This
 * middleware intercepts /guide-profile.html and /tour-package.html, looks up
 * the entity, and rewrites the <title> + injects Open Graph / Twitter / canonical
 * tags into the static HTML before serving — so a shared guide link shows the
 * guide's name, photo and bio.
 */
const fs   = require('fs');
const path = require('path');
const SupabaseDB = require('../models/SupabaseDB');

const users    = new SupabaseDB('users');
const packages = new SupabaseDB('tour_packages');

const APP_URL = (process.env.APP_URL || 'https://guideon.om').replace(/\/$/, '');
const PUBLIC  = path.join(__dirname, '..', '..', 'public');

// Cache the raw HTML templates in memory (re-read on change is unnecessary here).
const fileCache = {};
function readTemplate(name) {
  if (!fileCache[name]) {
    try { fileCache[name] = fs.readFileSync(path.join(PUBLIC, name), 'utf8'); }
    catch { fileCache[name] = null; }
  }
  return fileCache[name];
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function metaBlock({ title, description, image, url, jsonld, ogType = 'profile' }) {
  const t = esc(title), d = esc(description), img = esc(image), u = esc(url);
  // JSON-LD is machine-readable, so it just needs to be safe inside a <script>.
  // Accept a single object or an array (entity + BreadcrumbList) → one <script> each.
  const ld = jsonld
    ? (Array.isArray(jsonld) ? jsonld : [jsonld])
        .filter(Boolean)
        .map(o => `\n<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`)
        .join('')
    : '';
  return `<title>${t}</title>
<meta name="description" content="${d}">
<link rel="canonical" href="${u}">
<meta property="og:site_name" content="Guideon">
<meta property="og:type" content="${ogType}">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${u}">
<meta property="og:image" content="${img}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${img}">${ld}`;
}

const ORG = { '@type': 'Organization', name: 'Guideon', url: APP_URL };
// Only emit an aggregateRating when there is at least one real review + score
// (Google rejects/ignores a rating of 0 or reviewCount 0).
function rating(score, count) {
  const s = parseFloat(score) || 0, c = parseInt(count) || 0;
  return (s > 0 && c > 0)
    ? { '@type': 'AggregateRating', ratingValue: s, reviewCount: c } : undefined;
}
function places(list) {
  const arr = (Array.isArray(list) ? list : []).filter(Boolean).slice(0, 6);
  return arr.length ? arr.map(n => ({ '@type': 'Place', name: n })) : undefined;
}
// BreadcrumbList so Google shows a Home › Section › Page trail in results.
// items: [{ name, url }] top-to-bottom.
function crumbs(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem', position: i + 1, name: it.name, item: it.url,
    })),
  };
}

// Replace the first <title>…</title> with our title + meta block.
// Tags metaBlock writes. The page's own copies are removed first, so a crawler
// never sees two descriptions or two canonicals (Google then picks one at random).
const OWN_TAGS = /\n?\s*<(?:meta\s+(?:name|property)="(?:description|og:[a-z_:]+|twitter:[a-z_:]+)"[^>]*|link\s+rel="canonical"[^>]*)>/gi;
function inject(html, block) {
  html = html.replace(OWN_TAGS, '');
  if (html.match(/<title>[\s\S]*?<\/title>/i)) {
    return html.replace(/<title>[\s\S]*?<\/title>/i, block);
  }
  return html.replace(/<head[^>]*>/i, m => m + '\n' + block);
}

async function guideMeta(id) {
  const g = await users.findById(id);
  if (!g || g.userType !== 'guide') return null;
  const dests = Array.isArray(g.destinations) ? g.destinations.filter(Boolean) : [];
  const where = dests.length ? ` in ${dests.slice(0, 3).join(', ')}` : ' in Oman';
  const title = `${g.fullName} — Tour Guide${where} | Guideon`;
  const description = (g.bio && g.bio.trim())
    ? g.bio.trim().slice(0, 200)
    : `Book ${g.fullName}, a certified local tour guide${where}. View profile, reviews and availability on Guideon.`;
  const image = g.photo || `${APP_URL}/logo.png`;
  const url = `${APP_URL}/guide-profile.html?id=${id}`;
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: g.fullName,
    jobTitle: 'Tour Guide',
    image,
    description,
    url,
    worksFor: ORG,
    areaServed: places(dests),
    knowsLanguage: (Array.isArray(g.languages) ? g.languages.filter(Boolean) : undefined),
    aggregateRating: rating(g.rating, g.totalReviews),
  };
  const breadcrumb = crumbs([
    { name: 'Guideon', url: APP_URL },
    { name: 'Tour Guides', url: `${APP_URL}/#guides` },
    { name: g.fullName, url },
  ]);
  return { title, description, image, url, jsonld: [jsonld, breadcrumb] };
}

async function tourMeta(id) {
  const p = await packages.findById(id);
  if (!p) return null;
  const title = `${p.title} — Tour in Oman | Guideon`;
  const description = (p.description && p.description.trim())
    ? p.description.trim().slice(0, 200)
    : `Book "${p.title}", a curated tour in ${p.destination || 'Oman'} on Guideon.`;
  const image = (Array.isArray(p.images) && p.images[0]) || p.coverImage || `${APP_URL}/logo.png`;
  const url = `${APP_URL}/tour-package.html?id=${id}`;
  const price = parseFloat(p.price_adult ?? p.priceAdult ?? p.price) || 0;
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.title,
    image,
    description,
    url,
    brand: { '@type': 'Brand', name: 'Guideon' },
    offers: price > 0 ? {
      '@type': 'Offer', price, priceCurrency: 'OMR',
      availability: 'https://schema.org/InStock', url,
    } : undefined,
    aggregateRating: rating(p.rating, p.totalReviews ?? p.total_reviews),
  };
  const breadcrumb = crumbs([
    { name: 'Guideon', url: APP_URL },
    { name: 'Tours', url: `${APP_URL}/#tours` },
    { name: p.title, url },
  ]);
  return { title, description, image, url, jsonld: [jsonld, breadcrumb] };
}

async function companyMeta(id) {
  const c = await users.findById(id);
  if (!c || c.userType !== 'company') return null;
  const name = c.companyName || c.fullName || 'Tourism Company';
  const dests = Array.isArray(c.companyDestinations) ? c.companyDestinations.filter(Boolean) : [];
  const where = dests.length ? ` in ${dests.slice(0, 3).join(', ')}` : ' in Oman';
  const title = `${name} — Tourism Company${where} | Guideon`;
  const description = (c.companyDescription && c.companyDescription.trim())
    ? c.companyDescription.trim().slice(0, 200)
    : `${name}, a registered Omani tourism company${where}. View tours, reviews and book on Guideon.`;
  const image = c.photo || `${APP_URL}/logo.png`;
  const url = `${APP_URL}/company-profile.html?id=${id}`;
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'TravelAgency',
    name,
    image,
    description,
    url,
    address: { '@type': 'PostalAddress', addressCountry: 'OM' },
    areaServed: places(dests),
    aggregateRating: rating(c.rating, c.totalReviews),
  };
  const breadcrumb = crumbs([
    { name: 'Guideon', url: APP_URL },
    { name: 'Tourism Companies', url: `${APP_URL}/#companies` },
    { name, url },
  ]);
  return { title, description, image, url, jsonld: [jsonld, breadcrumb] };
}

// Region + blog-post pages are static HTML that render one shared title/desc for
// every ?id= → Google sees mass duplicate content. Inject per-entity meta from
// the static JSON so each region/post URL is unique.
let _regions = null, _posts = null;
function loadJson(name, key) {
  try { return JSON.parse(fs.readFileSync(path.join(PUBLIC, 'data', name), 'utf8'))[key] || []; }
  catch { return []; }
}
// Site-relative media paths → absolute URLs (structured data and og:image need them).
const abs = u => !u ? '' : /^https?:\/\//i.test(u) ? u : APP_URL + (u.startsWith('/') ? u : '/' + u);

async function regionMeta(id) {
  if (!_regions) _regions = loadJson('regions.json', 'regions');
  const r = _regions.find(x => x.id === id || x.slug === id);
  if (!r) return null;
  const name = r.name_en || r.name_ar || 'Region';
  const title = `Tour Guides in ${name}, Oman | Guideon`;
  const description = String(r.intro_en || r.tagline_en ||
    `Discover ${name} in Oman — find verified local tour guides, top sites and things to do on Guideon.`).slice(0, 200);
  const landmarks = Array.isArray(r.landmarks) ? r.landmarks : [];
  const shot = landmarks.find(l => l && l.image);
  const image = abs(r.hero) || abs(shot && shot.image) || `${APP_URL}/logo.png`;
  const url = `${APP_URL}/region.html?id=${id}`;
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'TouristDestination',
    name: `${name}, Oman`,
    alternateName: r.name_ar || undefined,
    description,
    image,
    url,
    containedInPlace: { '@type': 'Country', name: 'Oman' },
    geo: (r.lat && r.lng) ? { '@type': 'GeoCoordinates', latitude: r.lat, longitude: r.lng } : undefined,
    touristType: ['Cultural tourism', 'Adventure tourism', 'Nature tourism'],
    includesAttraction: landmarks.slice(0, 20).map(l => ({
      '@type': 'TouristAttraction',
      name: l.name_en || l.name_ar,
      alternateName: l.name_en && l.name_ar ? l.name_ar : undefined,
      image: abs(l.image) || undefined,
      geo: (l.lat && l.lng) ? { '@type': 'GeoCoordinates', latitude: l.lat, longitude: l.lng } : undefined,
    })),
  };
  const breadcrumb = crumbs([
    { name: 'Guideon', url: APP_URL },
    { name: 'Regions of Oman', url: `${APP_URL}/regions.html` },
    { name, url },
  ]);
  return { title, description, image, url, jsonld: [jsonld, breadcrumb], ogType: 'website' };
}
async function blogMeta(id) {
  if (!_posts) _posts = loadJson('blog.json', 'posts');
  const p = _posts.find(x => x.slug === id || x.id === id);
  if (!p) return null;
  const title = `${p.title_en || p.title_ar || 'Article'} | Guideon Blog`;
  const description = String(p.excerpt_en || p.excerpt_ar || '').slice(0, 200);
  const image = abs(p.cover) || `${APP_URL}/logo.png`;
  const url = `${APP_URL}/blog-post.html?id=${id}`;
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: String(p.title_en || p.title_ar || '').slice(0, 110),
    alternativeHeadline: p.title_en && p.title_ar ? p.title_ar : undefined,
    description,
    image: [image],
    datePublished: p.date || undefined,
    dateModified: p.date || undefined,
    author: { '@type': 'Organization', name: p.author_en || 'Guideon', url: APP_URL },
    publisher: { '@type': 'Organization', name: 'Guideon', logo: { '@type': 'ImageObject', url: `${APP_URL}/logo.png` } },
    mainEntityOfPage: url,
    inLanguage: ['en', 'ar'],
  };
  const breadcrumb = crumbs([
    { name: 'Guideon', url: APP_URL },
    { name: 'Blog', url: `${APP_URL}/blog.html` },
    { name: p.title_en || p.title_ar || 'Article', url },
  ]);
  return { title, description, image, url, jsonld: [jsonld, breadcrumb], ogType: 'article' };
}

// Served for an entity page whose id doesn't exist — a REAL 404 (+noindex) so
// Google treats it as not-found instead of a soft 404 (the page still renders a
// friendly "not found" to humans client-side).
function notFoundBlock() {
  return `<title>Not found · غير موجود — Guideon</title>
<meta name="robots" content="noindex,follow">`;
}

const STATIC_PAGES = {
  '/about.html':        { name: 'About' },
  '/regions.html':      { name: 'Regions of Oman', extra: regionsList },
  '/blog.html':         { name: 'Blog', extra: blogList },
  '/trails.html':       { name: 'Hiking Trails' },
  '/faq.html':          { name: 'FAQ', extra: faqList },
  '/contact.html':      { name: 'Contact' },
  '/how-it-works.html': { name: 'How it works' },
  '/teams.html':        { name: 'Event Teams' },
  '/plan-trip.html':    { name: 'Plan a Trip' },
  '/explore.html':      { name: 'Explore Oman' },
  '/cancellation.html': { name: 'Cancellation Policy' },
  '/terms.html':        { name: 'Terms of Service' },
  '/privacy.html':      { name: 'Privacy Policy' },
  // Reached with ?return= / ?type= variants; one canonical per page.
  '/login.html':        { name: 'Log in' },
  '/register.html':     { name: 'Create an account' },
  '/search.html':       { name: 'Find a Guide' },
};
// FAQ rich results: built from the questions in the page itself (it used to be
// assembled in the browser, which crawlers may never run).
function faqList(url, html) {
  const strip = t => t.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
  const items = [...html.matchAll(/<div class="faq-q"[^>]*><span[^>]*>([\s\S]*?)<\/span>[\s\S]*?<div class="faq-a">([\s\S]*?)<\/div>/g)]
    .map(m => ({ q: strip(m[1]), a: strip(m[2]) })).filter(x => x.q && x.a);
  return items.length ? { '@context': 'https://schema.org', '@type': 'FAQPage', url,
    mainEntity: items.map(x => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } })) } : null;
}
function regionsList(url) {
  if (!_regions) _regions = loadJson('regions.json', 'regions');
  return {
    '@context': 'https://schema.org', '@type': 'ItemList', name: 'Regions of Oman', url,
    itemListElement: _regions.map((r, i) => ({ '@type': 'ListItem', position: i + 1,
      url: `${APP_URL}/region.html?id=${r.id}`, name: r.name_en })),
  };
}
function blogList(url) {
  if (!_posts) _posts = loadJson('blog.json', 'posts');
  return {
    '@context': 'https://schema.org', '@type': 'Blog', name: 'Guideon Blog', url,
    blogPost: _posts.map(p => ({ '@type': 'BlogPosting', headline: p.title_en,
      url: `${APP_URL}/blog-post.html?id=${p.slug}`, datePublished: p.date })),
  };
}
const staticCache = {};
function staticPage(reqPath) {
  if (staticCache[reqPath]) return staticCache[reqPath];
  const def = STATIC_PAGES[reqPath];
  const html = readTemplate(reqPath.slice(1));
  if (!html) return null;
  const pick = re => { const m = html.match(re); return m ? m[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim() : ''; };
  const title = pick(/<title>([\s\S]*?)<\/title>/i) || `${def.name} | Guideon`;
  const description = pick(/<meta\s+name="description"\s+content="([^"]*)"/i);
  const url = APP_URL + reqPath;
  const jsonld = [crumbs([{ name: 'Guideon', url: APP_URL }, { name: def.name, url }])];
  if (def.extra) jsonld.push(def.extra(url, html));
  // Keep any structured data the page already has (e.g. the FAQ page's FAQPage).
  const out = inject(html, metaBlock({ title, description, image: `${APP_URL}/media/hero/hero-1.jpg`, url, jsonld, ogType: 'website' }));
  staticCache[reqPath] = out;
  return out;
}

const ENTITY_PAGES = {
  '/guide-profile.html':   { tpl: 'guide-profile.html',   meta: guideMeta },
  '/tour-package.html':    { tpl: 'tour-package.html',    meta: tourMeta },
  '/company-profile.html': { tpl: 'company-profile.html', meta: companyMeta },
  '/region.html':          { tpl: 'region.html',          meta: regionMeta },
  '/blog-post.html':       { tpl: 'blog-post.html',       meta: blogMeta },
};

module.exports = async function seoMeta(req, res, next) {
  try {
    if (STATIC_PAGES[req.path] && req.method === 'GET') {
      const out = staticPage(req.path);
      if (!out) return next();
      res.set('Cache-Control', 'no-cache');
      return res.type('html').send(out);
    }
    const page = ENTITY_PAGES[req.path];
    if (!page || !req.query.id) return next();

    const html = readTemplate(page.tpl);
    if (!html) return next();

    const meta = await page.meta(req.query.id);
    if (!meta) {
      // id was provided but no such entity exists → return a REAL 404 + noindex
      // instead of a 200 (which Google flags as a Soft 404).
      const out = inject(html, notFoundBlock());
      res.status(404).set('Cache-Control', 'no-cache, no-store, must-revalidate')
        .type('html').send(out);
      return;
    }

    const out = inject(html, metaBlock(meta));
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.type('html').send(out);
  } catch (e) {
    console.error('[seoMeta]', e.message);
    next(); // on ANY error, never 404 a real page — fall through to static serve (200)
  }
};

module.exports._staticPage = staticPage;
module.exports._regionMeta = regionMeta;
module.exports._blogMeta = blogMeta;
