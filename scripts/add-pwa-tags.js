/**
 * Injects PWA <head> meta tags and <script src="/js/pwa.js"> into every
 * public HTML file that doesn't already have them.
 */
const fs   = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '..', 'public');

const HEAD_TAGS = `
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#0f7b6c">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Guideon">
  <link rel="apple-touch-icon" href="/icon-192.png">`;

const PWA_SCRIPT = `<script src="/js/pwa.js"></script>`;

// Files to skip (offline page already hand-crafted; 404 is simple)
const SKIP = new Set(['offline.html', 'dashboard.html']);

const files = fs.readdirSync(PUBLIC).filter(f => f.endsWith('.html'));

let patched = 0;
for (const file of files) {
  if (SKIP.has(file)) { console.log(`  skip  ${file}`); continue; }

  const fpath = path.join(PUBLIC, file);
  let html = fs.readFileSync(fpath, 'utf8');

  let changed = false;

  // 1. Add head tags after <meta name="viewport"...>
  if (!html.includes('/manifest.json')) {
    html = html.replace(
      /(<meta\s+name="viewport"[^>]*>)/i,
      `$1${HEAD_TAGS}`
    );
    changed = true;
  }

  // 2. Add pwa.js before </body>
  if (!html.includes('pwa.js')) {
    html = html.replace('</body>', `${PWA_SCRIPT}\n</body>`);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(fpath, html, 'utf8');
    console.log(`  ✅  ${file}`);
    patched++;
  } else {
    console.log(`  ──  ${file}  (already patched)`);
  }
}

console.log(`\nDone — ${patched} files updated.`);
