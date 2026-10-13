const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// The CSRF guard exempts GET, so an admin route that changes state through GET
// can be fired by an <img> tag on any website the admin visits. Four such
// routes existed (email/WhatsApp/reminder tests and the storage compressor).
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'admin.js'), 'utf8');
const lines = src.split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim());

test('admin: operational actions are POST and limited to the super admin', () => {
  for (const route of ['email-test', 'whatsapp-test', 'reminder-test', 'compress-storage']) {
    const post = lines.find(l => l.startsWith(`router.post('/${route}',`));
    assert.ok(post, `${route} must be a POST route`);
    assert.ok(post.includes('requireSuperAdmin'), `${route} must require the super admin`);
    assert.ok(!lines.some(l => l.startsWith(`router.get('/${route}',`)), `${route} must not be reachable by GET`);
  }
});

test('admin: no GET route is named like an action that changes state', () => {
  const ACTION = /(test|compress|send|run|trigger|seed|sync|migrate|purge|reset|delete|approve|reject|cancel|refund)/i;
  const gets = lines.filter(l => l.startsWith("router.get('")).map(l => l.split("'")[1]);
  const suspicious = gets.filter(p => !p.endsWith('/status') && ACTION.test(p.split('/').pop() || ''));
  assert.deepStrictEqual(suspicious, [], 'state-changing GET routes: ' + suspicious.join(', '));
});

test('admin: the WhatsApp test has no hardcoded default recipient', () => {
  const ctrl = fs.readFileSync(path.join(__dirname, '..', 'src', 'controllers', 'adminController.js'), 'utf8');
  assert.ok(!/\|\|\s*'968\d{8}'/.test(ctrl), 'no personal phone number as a default');
});
