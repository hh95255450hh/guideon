const test = require('node:test');
const assert = require('node:assert');
const SupabaseDB = require('../src/models/SupabaseDB');

// GET /api/site-settings used to return every row of site_settings to anyone —
// commission rates and the VAT number included, and any secret an admin might
// store there later. The public read is now an allowlist.

const ROWS = [
  { key: 'hero', value: { title_en: 'Discover Oman' } },
  { key: 'carousel', value: { slides: [] } },
  { key: 'activities', value: { items: [] } },
  { key: 'commission', value: { guide: 0.05, vatNumber: 'OM123' } },
  { key: 'content_regions', value: { regions: [] } },
];

SupabaseDB.prototype.readAll = async function () { return ROWS; };
SupabaseDB.prototype.findById = async function (id) { return ROWS.find(r => r.key === id) || null; };

const ctrl = require('../src/controllers/siteSettingsController');

function call(handler, req) {
  return new Promise(resolve => {
    const res = {
      statusCode: 200, headers: {},
      set(k, v) { this.headers[k.toLowerCase()] = v; return this; },
      status(c) { this.statusCode = c; return this; },
      json(body) { resolve({ status: this.statusCode, headers: this.headers, body }); },
    };
    handler({ params: {}, session: {}, ...req }, res);
  });
}

test('site settings: the public list carries only homepage keys', async () => {
  const r = await call(ctrl.getAll, { session: {} });
  assert.deepStrictEqual(Object.keys(r.body.settings).sort(), ['activities', 'carousel', 'hero']);
  assert.ok(!('commission' in r.body.settings), 'commission rates must not be public');
  assert.match(r.headers['cache-control'], /public, max-age=60/);
});

test('site settings: admins still receive every key, uncached', async () => {
  const r = await call(ctrl.getAll, { session: { userType: 'admin' } });
  assert.ok('commission' in r.body.settings);
  assert.ok('content_regions' in r.body.settings);
  assert.match(r.headers['cache-control'], /private, no-store/);
});

test('site settings: a non-public key is refused to the public, served to admins', async () => {
  const anon = await call(ctrl.getOne, { params: { key: 'commission' }, session: {} });
  assert.strictEqual(anon.status, 403);
  const admin = await call(ctrl.getOne, { params: { key: 'commission' }, session: { userType: 'admin' } });
  assert.strictEqual(admin.status, 200);
  assert.strictEqual(admin.body.value.vatNumber, 'OM123');
  const hero = await call(ctrl.getOne, { params: { key: 'hero' }, session: {} });
  assert.strictEqual(hero.status, 200);
});
