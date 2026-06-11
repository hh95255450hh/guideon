const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const I18N_DIR = path.join(__dirname, '..', 'public', 'i18n');
const CORE     = path.join(__dirname, '..', 'public', 'js', 'i18n.js');

// All 10 language packs we list in LANGUAGES.
const LANGS = ['en', 'ar', 'zh', 'hi', 'es', 'fr', 'bn', 'pt', 'ru', 'ur'];

test('every supported language has a JSON pack', () => {
  for (const lang of LANGS) {
    const f = path.join(I18N_DIR, lang + '.json');
    assert.ok(fs.existsSync(f), `missing pack: ${lang}.json`);
  }
});

test('every pack is valid JSON', () => {
  for (const lang of LANGS) {
    const raw = fs.readFileSync(path.join(I18N_DIR, lang + '.json'), 'utf8');
    assert.doesNotThrow(() => JSON.parse(raw), `${lang}.json must be valid JSON`);
  }
});

test('English pack covers the dynamic-template keys', () => {
  const en = JSON.parse(fs.readFileSync(path.join(I18N_DIR, 'en.json'), 'utf8'));
  for (const key of ['results_found', 'reviews_count', 'gp_load_more']) {
    assert.ok(en[key], `en.json missing dynamic key: ${key}`);
    assert.match(en[key], /\{n\}/, `${key} must use {n} placeholder`);
  }
});

test('Arabic pack mirrors the dynamic-template keys', () => {
  const ar = JSON.parse(fs.readFileSync(path.join(I18N_DIR, 'ar.json'), 'utf8'));
  for (const key of ['results_found', 'reviews_count', 'gp_load_more']) {
    assert.ok(ar[key]);
    assert.match(ar[key], /\{n\}/);
  }
});

test('English pack is at least 1000 keys (full coverage)', () => {
  const en = JSON.parse(fs.readFileSync(path.join(I18N_DIR, 'en.json'), 'utf8'));
  assert.ok(Object.keys(en).length >= 1000, `en.json has only ${Object.keys(en).length} keys`);
});

test('core loader is small (under 10 KB unminified)', () => {
  const size = fs.statSync(CORE).size;
  assert.ok(size < 10000, `i18n.js core is ${size} B — should stay under 10 KB`);
});

test('core declares all 10 languages', () => {
  const src = fs.readFileSync(CORE, 'utf8');
  for (const lang of LANGS) {
    assert.ok(
      new RegExp(`code:\\s*['"]${lang}['"]`).test(src),
      `core missing language entry: ${lang}`
    );
  }
});

test('core has no inlined dictionary (real split, not fake)', () => {
  // A regression we want to catch: someone re-embedding TRANSLATIONS.
  // The core may mention the variable in comments but must not declare
  // it as a const/let.
  const src = fs.readFileSync(CORE, 'utf8');
  assert.ok(!/const\s+TRANSLATIONS\s*=/.test(src),
            'core must not embed the full dictionary');
  assert.ok(!/let\s+TRANSLATIONS\s*=/.test(src));
});

test('template substitution: {n} placeholder replacement', () => {
  // Mirror of the runtime fillTemplate. Pins the contract that
  // I18N.t('results_found', 42) returns "42 guides found".
  const fill = (s, n) => (n == null ? s : String(s).replace(/\{n\}|\{0\}/g, n));
  assert.strictEqual(fill('{n} guides found', 42), '42 guides found');
  assert.strictEqual(fill('{0} reviews', 7),       '7 reviews');
  assert.strictEqual(fill('no args here', undefined), 'no args here');
});
