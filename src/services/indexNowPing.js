/**
 * Fire-and-forget IndexNow notifications.
 *
 * The protocol pushes changed URLs to Bing, Yandex, Naver, Seznam and Yep in
 * one request. GOOGLE DOES NOT PARTICIPATE — for Google the levers are an
 * accurate sitemap (lastmod), internal links and authority.
 *
 * Two rules shape this file:
 *  1. Nothing here may delay or fail a user's request. Callers do not await,
 *     and every path swallows its own errors.
 *  2. The protocol asks you not to re-submit a URL you have not changed.
 *     Pings are coalesced into one request per batch window, and a URL is not
 *     re-sent within an hour, so a provider saving a profile five times in a
 *     row produces one notification.
 */
const indexNow = require('./indexNow');

const BATCH_MS = 10 * 1000;        // coalesce a burst of edits into one request
const REPEAT_MS = 60 * 60 * 1000;  // don't re-announce the same URL within an hour

const pending = new Set();
const lastSent = new Map();
let timer = null;

function sweep(now) {
  for (const [url, at] of lastSent) if (now - at > REPEAT_MS) lastSent.delete(url);
}

async function flush() {
  timer = null;
  const now = Date.now();
  sweep(now);
  const urls = [...pending].filter(u => !lastSent.has(u));
  pending.clear();
  if (!urls.length) return;
  try {
    const r = await indexNow.submit(urls);
    if (r.ok) {
      urls.forEach(u => lastSent.set(u, now));
      console.log(`[indexnow] announced ${r.submitted} url(s)`);
    } else {
      console.warn('[indexnow] not sent:', r.reason || r.status, r.body || '');
    }
  } catch (e) {
    console.warn('[indexnow] failed:', e.message);
  }
}

/**
 * Queue URLs (absolute, or site-relative paths). Returns immediately.
 * Safe to call when IndexNow is not configured — it simply does nothing.
 */
function ping(urls) {
  try {
    if (!indexNow.isEnabled()) return;
    const list = (Array.isArray(urls) ? urls : [urls]).filter(Boolean);
    for (const u of list) {
      const s = String(u);
      pending.add(s.startsWith('http') ? s : indexNow.APP_URL + (s.startsWith('/') ? s : '/' + s));
    }
    if (!pending.size || timer) return;
    timer = setTimeout(flush, BATCH_MS);
    if (timer.unref) timer.unref();   // never hold the process open for a ping
  } catch (e) {
    console.warn('[indexnow] ping skipped:', e.message);
  }
}

// The pages that change when a provider or a tour does.
const guidePages   = id => [`/guide-profile.html?id=${id}`];
const companyPages = id => [`/company-profile.html?id=${id}`];
const teamPages    = id => [`/team-profile.html?id=${id}`, '/teams.html'];
const packagePages = id => [`/tour-package.html?id=${id}`];

module.exports = { ping, guidePages, companyPages, teamPages, packagePages, _flush: flush };
