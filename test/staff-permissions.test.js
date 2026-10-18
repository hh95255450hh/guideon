const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const SupabaseDB = require('../src/models/SupabaseDB');

// Any staff role could change the commission rates and the public site
// content (blog bodies render as HTML). Now: commission needs manage_finance,
// content and homepage settings need manage_content.

SupabaseDB.prototype.findById = async () => null;
SupabaseDB.prototype.insert = async row => row;
SupabaseDB.prototype.update = async (id, row) => row;
const ctrl = require('../src/controllers/siteSettingsController');

const call = (user, key, value) => new Promise(resolve => {
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { resolve({ status: this.statusCode, body: b }); } };
  ctrl.update({ params: { key }, body: { value }, session: { userId: user.id, userType: user.userType }, user }, res);
});
const support = { id: 's1', userType: 'staff', permissions: ['view_users', 'view_bookings'] };
const finance = { id: 's2', userType: 'staff', permissions: ['manage_finance'] };
const marketing = { id: 's3', userType: 'staff', permissions: ['manage_content'] };
const admin = { id: 'a1', userType: 'admin' };

test('site settings: a support agent can change neither commission nor homepage', async () => {
  assert.strictEqual((await call(support, 'commission', { guide: 10, company: 15 })).status, 403);
  assert.strictEqual((await call(support, 'hero', { title_en: 'x' })).status, 403);
});

test('site settings: commission needs manage_finance, content needs manage_content', async () => {
  assert.strictEqual((await call(finance, 'commission', { guide: 10, company: 15 })).status, 200);
  assert.strictEqual((await call(finance, 'hero', { title_en: 'x' })).status, 403);
  assert.strictEqual((await call(marketing, 'hero', { title_en: 'x' })).status, 200);
  assert.strictEqual((await call(marketing, 'commission', { guide: 1, company: 1 })).status, 403);
  assert.strictEqual((await call(admin, 'commission', { guide: 10, company: 15 })).status, 200);
});

test('admin content routes require manage_content', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'admin.js'), 'utf8');
  assert.match(src, /put\('\/content\/:key',\s*requirePermission\('manage_content'\)/);
  assert.match(src, /post\('\/content\/:key\/reset',\s*requirePermission\('manage_content'\)/);
});

test('gallery delete only removes photos from the caller\'s own gallery', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'upload.js'), 'utf8');
  const block = src.slice(src.indexOf("router.delete('/gallery'"), src.indexOf("router.post('/image'"));
  assert.ok(block.indexOf('current.includes(url)') > -1 && block.indexOf('current.includes(url)') < block.indexOf('deleteByUrl(url)'),
    'ownership must be checked before deleteByUrl');
});
