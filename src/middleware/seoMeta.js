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

function metaBlock({ title, description, image, url }) {
  const t = esc(title), d = esc(description), img = esc(image), u = esc(url);
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
<meta name="twitter:image" content="${img}">`;
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
  return { title, description, image, url: `${APP_URL}/guide-profile.html?id=${id}` };
}

async function tourMeta(id) {
  const p = await packages.findById(id);
  if (!p) return null;
  const title = `${p.title} — Tour in Oman | Guideon`;
  const description = (p.description && p.description.trim())
    ? p.description.trim().slice(0, 200)
    : `Book "${p.title}", a curated tour in ${p.destination || 'Oman'} on Guideon.`;
  const image = (Array.isArray(p.images) && p.images[0]) || p.coverImage || `${APP_URL}/logo.png`;
  return { title, description, image, url: `${APP_URL}/tour-package.html?id=${id}` };
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
  return { title, description, image, url: `${APP_URL}/company-profile.html?id=${id}` };
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
