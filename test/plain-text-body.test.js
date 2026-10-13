const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { plainTextBody } = require('../src/middleware/plainText');

const run = body => { const req = { body }; plainTextBody(req, {}, () => {}); return req.body; };

test('plain text: markup in a company name is neutralised before it is stored', () => {
  const out = run({ companyName: '<img src=x onerror=alert(1)>Acme', fullName: 'Ali <b>' });
  assert.strictEqual(out.companyName, '‹img src=x onerror=alert(1)›Acme');
  assert.ok(!/[<>]/.test(out.fullName));
});

test('plain text: nested add-ons, variants and review fields are cleaned at any depth', () => {
  const out = run({
    addons: [{ name: '<script>x</script>', price: 5 }],
    variants: [{ name: 'Sunset <svg onload=1>', base: 20 }],
    review: { comment: 'great <iframe>', rating: 5 },
  });
  assert.strictEqual(out.addons[0].name, '‹script›x‹/script›');
  assert.strictEqual(out.addons[0].price, 5, 'non-text values are untouched');
  assert.ok(!/[<>]/.test(out.variants[0].name));
  assert.ok(!/[<>]/.test(out.review.comment));
});

test('plain text: rich-text and secret fields are left exactly as sent', () => {
  const out = run({ body_en: '<p>Admin blog <b>post</b></p>', password: 'p<a>ss', description: '<ul><li>x</li></ul>' });
  assert.strictEqual(out.body_en, '<p>Admin blog <b>post</b></p>');
  assert.strictEqual(out.password, 'p<a>ss', 'a password must never be rewritten');
  assert.strictEqual(out.description, '<ul><li>x</li></ul>');
});

test('plain text: a raw webhook body (Buffer) passes through untouched', () => {
  const buf = Buffer.from('{"obj":{"name":"<x>"}}');
  assert.strictEqual(run(buf), buf);
});

test('plain text: the middleware is mounted on the API', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  assert.match(app, /app\.use\('\/api\/',\s*require\('\.\/middleware\/plainText'\)\.plainTextBody\)/);
});

// The templates the council found interpolating user text without escaping.
test('xss: the confirmed templates escape user-written text', () => {
  const read = f => fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8');
  const gd = read('guide-dashboard.html'), admin = read('admin.html'), pkg = read('tour-package.html');
  for (const raw of ['${r.comment}', '${r.guideReply}', '${r.touristName ||']) assert.ok(!gd.includes(raw), `guide-dashboard still renders ${raw} raw`);
  for (const raw of ['${c.companyName || c.fullName}', '${c.companyRegNo}', '${i+1}. ${g.name}']) assert.ok(!admin.includes(raw), `admin still renders ${raw} raw`);
  for (const raw of ['+ ${a.name}', '${v.name} —']) assert.ok(!pkg.includes(raw), `tour-package still renders ${raw} raw`);
});
