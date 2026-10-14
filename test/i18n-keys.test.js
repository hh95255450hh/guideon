const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// I18N.t(key) returns the key itself when a pack lacks it, so the common
// `I18N.t('x') || 'fallback'` pattern never reaches its fallback and the page
// shows the raw key ("no_ready_tours_title" on guide profiles). Every literal
// key used in the code must exist in the English pack (the universal fallback)
// and in Arabic (the second fully supported language).

const PUB = path.join(__dirname, '..', 'public');
const en = require(path.join(PUB, 'i18n', 'en.json'));
const ar = require(path.join(PUB, 'i18n', 'ar.json'));

function files(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) { if (!/^(i18n|media|img|vendor)$/.test(f)) files(p, out); }
    else if (/\.(html|js)$/.test(f) && !/\.min\./.test(f)) out.push(p);
  }
  return out;
}

test('i18n: every literal I18N.t / data-i18n key exists in en and ar', () => {
  const missing = [];
  for (const f of files(PUB)) {
    const s = fs.readFileSync(f, 'utf8');
    for (const re of [/data-i18n(?:-ph)?="([a-zA-Z0-9_]+)"/g, /I18N\.t\(\s*['"]([a-zA-Z0-9_]+)['"]/g]) {
      for (const m of s.matchAll(re)) {
        const k = m[1];
        if (k.endsWith('_')) continue; // dynamic prefix, e.g. 'status_' + value
        if (!(k in en) || !(k in ar)) missing.push(`${path.basename(f)}: ${k}`);
      }
    }
  }
  assert.deepStrictEqual([...new Set(missing)], []);
});
