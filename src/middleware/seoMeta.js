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

function metaBlock({ title, description, image, url, jsonld }) {
  const t = esc(title), d = esc(description), img = esc(image), u = esc(url);
  // JSON-LD is machine-readable, so it just needs to be safe inside a <script>.
  const ld = jsonld
    ? `\n<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>`
    : '';
  return `<title>${t}</title>
<meta name="description" content="${d}">
<link rel="canonical" href="${u}">
<meta property="og:site_name" content="Guideon">
<meta property="og:type" content="profile">
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

// Replace the first <title>…</title> with our title + meta block.
function inject(html, block) {
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
  return { title, description, image, url, jsonld };
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
  return { title, description, image, url, jsonld };
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
  return { title, description, image, url, jsonld };
}

// Region + blog-post pages are static HTML that render one shared title/desc for
// every ?id= → Google sees mass duplicate content. Inject per-entity meta from
// the static JSON so each region/post URL is unique.
let _regions = null, _posts = null;
function loadJson(name, key) {
  try { return JSON.parse(fs.readFileSync(path.join(PUBLIC, 'data', name), 'utf8'))[key] || []; }
  catch { return []; }
}
async function regionMeta(id) {
  if (!_regions) _regions = loadJson('regions.json', 'regions');
  const r = _regions.find(x => x.id === id || x.slug === id);
  if (!r) return null;
  const name = r.name_en || r.name_ar || 'Region';
  const title = `Tour Guides in ${name}, Oman | Guideon`;
  const description = String(r.intro_en || r.tagline_en ||
    `Discover ${name} in Oman — find verified local tour guides, top sites and things to do on Guideon.`).slice(0, 200);
  const image = r.hero || `${APP_URL}/logo.png`;
  return { title, description, image, url: `${APP_URL}/region.html?id=${id}` };
}
async function blogMeta(id) {
  if (!_posts) _posts = loadJson('blog.json', 'posts');
  const p = _posts.find(x => x.slug === id || x.id === id);
  if (!p) return null;
  const title = `${p.title_en || p.title_ar || 'Article'} | Guideon Blog`;
  const description = String(p.excerpt_en || p.excerpt_ar || '').slice(0, 200);
  const image = p.cover || `${APP_URL}/logo.png`;
  return { title, description, image, url: `${APP_URL}/blog-post.html?id=${id}` };
}

// Served for an entity page whose id doesn't exist — a REAL 404 (+noindex) so
// Google treats it as not-found instead of a soft 404 (the page still renders a
// friendly "not found" to humans client-side).
function notFoundBlock() {
  return `<title>Not found · غير موجود — Guideon</title>
<meta name="robots" content="noindex,follow">`;
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
