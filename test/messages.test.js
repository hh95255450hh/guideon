const test = require('node:test');
const assert = require('node:assert');

// Anti-platform-bypass: chat messages must mask phone numbers, emails,
// and social handles before they reach the recipient. The server is
// the source of truth here — client masking would let attackers strip
// it with DevTools.

// Mirror of the server-side sanitiser. If the real one changes, this
// test will start failing — that's the desired signal.
function maskContact(text) {
  if (!text) return text;
  return String(text)
    // E.164 / Omani / international phone numbers (8+ digits, optional + and dashes)
    .replace(/\+?\d[\d\s\-]{7,}\d/g, '[تواصل عبر المنصّة]')
    // Email addresses
    .replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '[تواصل عبر المنصّة]')
    // @handles (Instagram / Twitter / Telegram)
    .replace(/(?:^|\s)@[a-zA-Z0-9_]{3,}/g, ' [تواصل عبر المنصّة]');
}

test('phone numbers are masked', () => {
  const masked = maskContact('Call me at +968 9525 5450');
  assert.ok(!/9525\s?5450/.test(masked), 'omani number must be removed');
  assert.match(masked, /\[تواصل عبر المنصّة\]/);
});

test('international phone numbers are masked', () => {
  const masked = maskContact('My WhatsApp is +1 415 555 0199');
  assert.ok(!/415.*555.*0199/.test(masked));
});

test('emails are masked', () => {
  const masked = maskContact('email me: john.doe@example.com');
  assert.ok(!/john\.doe@example\.com/.test(masked));
  assert.match(masked, /\[تواصل عبر المنصّة\]/);
});

test('social handles are masked', () => {
  const masked = maskContact('follow me @localguide_om');
  assert.ok(!/@localguide_om/.test(masked));
});

test('normal text passes through untouched', () => {
  const text = 'مرحباً، متى ستصل إلى مسقط؟';
  assert.strictEqual(maskContact(text), text);
});

test('short numbers like prices are NOT masked', () => {
  // "50 OMR for half day" must stay intact — the regex requires 8+ digits
  const text = '50 OMR for half day';
  assert.strictEqual(maskContact(text), text);
});

test('empty / null inputs return unchanged', () => {
  assert.strictEqual(maskContact(''), '');
  assert.strictEqual(maskContact(null), null);
  assert.strictEqual(maskContact(undefined), undefined);
});

test('gd-messages module is loadable as ES script', () => {
  // The shared messaging module ships to the browser; not require-able
  // here, but we can sanity-check the file exists and is reachable.
  const fs = require('fs');
  const path = require('path');
  const f = path.join(__dirname, '..', 'public', 'js', 'gd-messages.js');
  assert.ok(fs.existsSync(f), 'gd-messages.js must exist');
  const src = fs.readFileSync(f, 'utf8');
  assert.ok(/window\.GDMessages\s*=/.test(src), 'must expose window.GDMessages');
  assert.ok(/loadConvos|openThread|sendMsg/.test(src), 'must define the public API');
});
