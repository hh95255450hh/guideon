/**
 * IndexNow — push changed URLs to search engines instead of waiting to be crawled.
 *
 * One POST notifies Bing, Yandex, Naver, Seznam and Yep at once (they share the
 * protocol). GOOGLE DOES NOT PARTICIPATE: its Indexing API is limited to
 * JobPosting and BroadcastEvent pages, and using it for ordinary pages breaks
 * Google's terms. For Google the levers are an accurate sitemap (lastmod),
 * internal links and authority — not a submission endpoint.
 *
 * Ownership is proved by serving the key as plain text at
 * https://<host>/<key>.txt — see routes/indexNow.js.
 */
const https = require('https');

const ENDPOINT = 'api.indexnow.org';
const MAX_URLS = 10000;           // protocol limit per request

const APP_URL = (process.env.APP_URL || 'https://guideon.om').replace(/\/$/, '');
const HOST = APP_URL.replace(/^https?:\/\//, '');
const KEY = (process.env.INDEXNOW_KEY || '').trim();

const isEnabled = () => /^[a-zA-Z0-9-]{8,128}$/.test(KEY);

function keyLocation() {
  return `${APP_URL}/${KEY}.txt`;
}

/**
 * Submit URLs. Returns { ok, status, submitted, skipped, reason }.
 * Never throws — indexing is best-effort and must not break a caller.
 */
function submit(urls) {
  return new Promise(resolve => {
    if (!isEnabled()) {
      return resolve({ ok: false, reason: 'INDEXNOW_KEY not set or malformed', submitted: 0 });
    }
    // Only our own https URLs; the endpoint rejects a mixed-host payload.
    const list = [...new Set((urls || [])
      .map(u => String(u || '').trim())
      .filter(u => u.startsWith(APP_URL + '/') || u === APP_URL + '/'))];
    const skipped = (urls || []).length - list.length;
    if (!list.length) return resolve({ ok: false, reason: 'no valid URLs', submitted: 0, skipped });

    const body = JSON.stringify({
      host: HOST,
      key: KEY,
      keyLocation: keyLocation(),
      urlList: list.slice(0, MAX_URLS),
    });

    const req = https.request({
      host: ENDPOINT, path: '/indexnow', method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) },
      timeout: 20000,
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        // 200 accepted, 202 accepted-pending-key-validation; both are success.
        const ok = res.statusCode === 200 || res.statusCode === 202;
        resolve({ ok, status: res.statusCode, submitted: ok ? list.length : 0, skipped, body: data.slice(0, 200) });
      });
    });
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, reason: 'timeout', submitted: 0, skipped }); });
    req.on('error', e => resolve({ ok: false, reason: e.message, submitted: 0, skipped }));
    req.end(body);
  });
}

module.exports = { submit, isEnabled, keyLocation, KEY, HOST, APP_URL, MAX_URLS };
