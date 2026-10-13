#!/usr/bin/env node
/**
 * Weekly IndexNow submission.
 *
 * Reads the live sitemap, compares it with the last run, and submits only what
 * is NEW or CHANGED (by lastmod). Submitting the same unchanged list every week
 * trains the engines to ignore us, so an unchanged run submits nothing.
 *
 * Cron (server):
 *   15 3 * * 1  cd /opt/guideon && node scripts/submit-indexnow.js >> /var/log/guideon-indexnow.log 2>&1
 *
 * Google is deliberately not called: its Indexing API only covers JobPosting
 * and BroadcastEvent. Google picks these pages up from the sitemap's lastmod.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { submit, isEnabled, APP_URL } = require('../src/services/indexNow');

const STATE = process.env.INDEXNOW_STATE || '/var/lib/guideon/indexnow-state.json';

const fetchText = url => new Promise((resolve, reject) => {
  https.get(url, { timeout: 30000 }, res => {
    if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode} for ${url}`)); }
    let d = ''; res.setEncoding('utf8');
    res.on('data', c => d += c); res.on('end', () => resolve(d));
  }).on('timeout', function () { this.destroy(new Error('timeout')); }).on('error', reject);
});

// Pull <loc> + its <lastmod> (may be absent) out of the sitemap.
function parse(xml) {
  const out = {};
  const re = /<url>([\s\S]*?)<\/url>/g;
  let m;
  while ((m = re.exec(xml))) {
    const loc = (m[1].match(/<loc>([^<]+)<\/loc>/) || [])[1];
    if (!loc) continue;
    out[loc.trim()] = ((m[1].match(/<lastmod>([^<]+)<\/lastmod>/) || [])[1] || '').trim();
  }
  return out;
}

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return {}; }
}
function writeState(obj) {
  try {
    fs.mkdirSync(path.dirname(STATE), { recursive: true });
    fs.writeFileSync(STATE, JSON.stringify(obj));
  } catch (e) { console.error('[indexnow] could not persist state:', e.message); }
}

(async () => {
  const stamp = new Date().toISOString();
  if (!isEnabled()) {
    console.log(`${stamp} [indexnow] skipped — INDEXNOW_KEY not set`);
    process.exit(0);
  }
  let current;
  try {
    current = parse(await fetchText(`${APP_URL}/sitemap.xml`));
  } catch (e) {
    console.error(`${stamp} [indexnow] sitemap fetch failed: ${e.message}`);
    process.exit(1);
  }
  const total = Object.keys(current).length;
  if (!total) {
    console.error(`${stamp} [indexnow] sitemap had no URLs — refusing to submit`);
    process.exit(1);
  }

  const previous = readState();
  const first = Object.keys(previous).length === 0;
  const changed = Object.keys(current).filter(u => !(u in previous) || previous[u] !== current[u]);

  // First run has no baseline: submit everything once, then go incremental.
  const toSend = first ? Object.keys(current) : changed;
  if (!toSend.length) {
    console.log(`${stamp} [indexnow] nothing new (${total} URLs unchanged)`);
    writeState(current);
    process.exit(0);
  }

  const r = await submit(toSend);
  console.log(`${stamp} [indexnow] ${first ? 'baseline' : 'incremental'}: ` +
    `sitemap=${total} sent=${toSend.length} ok=${r.ok} status=${r.status || '-'} ${r.reason ? 'reason=' + r.reason : ''}`);
  // Only advance the baseline on success, so a failed week retries next time.
  if (r.ok) writeState(current); else process.exit(1);
})();
