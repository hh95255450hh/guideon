const test = require('node:test');
const assert = require('node:assert');

// Natural-language search turns a visitor's sentence into the search page's
// real filters. The model is faked; what is tested is that nothing it returns
// can put an invalid value into the search, and that the result links to the
// existing search page.

const ai = require('../src/services/ai');
let calls = 0, next = null;
ai.enabled = true;
let fail = null;
ai.completeJSON = async () => { calls++; if (fail) throw fail; return next; };

const ctrl = require('../src/controllers/aiController');
const loc = require('../src/utils/omanLocations').load();

const call = body => new Promise(resolve => {
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { resolve({ status: this.statusCode, body: b }); } };
  ctrl.search({ body, session: {}, query: {}, params: {} }, res);
});

const BASE = { type: 'guide', governorate: '', destination: '', language: '', specialisation: '', date: '',
               participants: 0, maxPrice: 0, minRating: 0, sortBy: '', summary_ar: 'فهمت', summary_en: 'Got it' };

test('ai search: the location data has all 11 governorates and 61 wilayats', () => {
  assert.strictEqual(loc.governorates.length, 11);
  assert.strictEqual(loc.wilayats.length, 61);
  assert.ok(loc.governorates.includes('Ad Dakhiliyah'));
});

test('ai search: a sentence becomes a link to the real search page', async () => {
  calls = 0; ctrl._searchCache.clear();
  next = { ...BASE, destination: 'Nizwa', language: 'German', maxPrice: 40, specialisation: 'Historical' };
  const r = await call({ q: 'a German-speaking guide in Nizwa, about 40 rials', lang: 'en' });
  assert.strictEqual(r.body.success, true);
  const url = new URL('https://x' + r.body.url);
  assert.strictEqual(url.pathname, '/search.html');
  assert.strictEqual(url.searchParams.get('destination'), 'Nizwa');
  assert.strictEqual(url.searchParams.get('governorate'), 'Ad Dakhiliyah', 'the governorate is derived from the wilayat');
  assert.strictEqual(url.searchParams.get('language'), 'German');
  assert.strictEqual(url.searchParams.get('maxPrice'), '40');
  assert.strictEqual(r.body.summary, 'Got it');
});

test('ai search: values outside the allowed lists never reach the search', () => {
  const out = ctrl._cleanFilters({ ...BASE, governorate: 'Atlantis', destination: 'Paris', language: 'Klingon',
    specialisation: 'Space', date: 'tomorrow', participants: -3, maxPrice: 'cheap', minRating: 9, sortBy: 'random', type: 'robot' }, loc);
  assert.deepStrictEqual(out, {});
});

test('ai search: a wrong governorate paired with a real wilayat is corrected from the data', () => {
  const out = ctrl._cleanFilters({ ...BASE, governorate: 'Dhofar', destination: 'Nizwa' }, loc);
  assert.strictEqual(out.governorate, 'Ad Dakhiliyah');
});

test('ai search: the same question on the same day calls the model once', async () => {
  calls = 0; ctrl._searchCache.clear();
  next = { ...BASE, destination: 'Sur' };
  const long = 'we would love a calm evening watching turtles nest, somewhere quiet and not too crowded please';
  await call({ q: long });
  await call({ q: '  ' + long.toUpperCase() + ' ' });
  assert.strictEqual(calls, 1);
});

test('ai search: a too-short query is refused before any model call', async () => {
  calls = 0;
  const r = await call({ q: 'a' });
  assert.strictEqual(r.status, 400);
  assert.strictEqual(calls, 0);
});

test('local search: a short clear request is answered without the model', async () => {
  calls = 0; ctrl._searchCache.clear();
  const r = await call({ q: 'مرشد في نزوى يتكلم إنجليزي', lang: 'ar' });
  assert.strictEqual(calls, 0);
  assert.strictEqual(r.body.source, 'local');
  const url = new URL('https://x' + r.body.url);
  assert.strictEqual(url.searchParams.get('destination'), 'Nizwa');
  assert.strictEqual(url.searchParams.get('governorate'), 'Ad Dakhiliyah');
  assert.strictEqual(url.searchParams.get('language'), 'English');
});

test('local search: landmarks, prices and dates map to real filters', () => {
  const L = require('../src/services/localSearch');
  const a = L.parse('رحلة إلى جبل شمس', loc, '2026-10-15');
  assert.strictEqual(a.destination, 'Al Hamra');
  const b = L.parse('desert trip under 50 rials tomorrow', loc, '2026-10-15');
  assert.strictEqual(b.specialisation, 'Desert');
  assert.strictEqual(b.maxPrice, 50);
  assert.strictEqual(b.date, '2026-10-16');
  assert.strictEqual(L.parse('شركة سياحية في صلالة', loc, '2026-10-15').type, 'company');
});

test('local search: when the model fails, what was understood locally still answers', async () => {
  calls = 0; ctrl._searchCache.clear();
  fail = new Error('credit balance is too low');
  const r = await call({ q: 'we are a big family and want something special and relaxing near Nizwa with good food and history' });
  fail = null;
  assert.strictEqual(calls, 1);
  assert.strictEqual(r.body.success, true);
  assert.strictEqual(r.body.source, 'local');
  assert.strictEqual(new URL('https://x' + r.body.url).searchParams.get('destination'), 'Nizwa');
});
