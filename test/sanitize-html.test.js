const test = require('node:test');
const assert = require('node:assert');
const { sanitizeHtml } = require('../src/utils/sanitizeHtml');

// Blog bodies are written by staff and rendered with innerHTML on public pages.

test('sanitizeHtml: keeps simple formatting', () => {
  assert.strictEqual(sanitizeHtml('<h2>Day 1</h2><p>Visit <strong>Nizwa</strong></p><ul><li>Fort</li></ul>'),
    '<h2>Day 1</h2><p>Visit <strong>Nizwa</strong></p><ul><li>Fort</li></ul>');
});

test('sanitizeHtml: scripts, handlers and javascript: URLs are removed', () => {
  const out = sanitizeHtml('<p onclick="x()">Hi<script>steal()</script></p><img src=x onerror=alert(1)><a href="javascript:alert(1)">go</a><iframe src="//evil"></iframe><svg onload=alert(1)><circle/></svg>');
  assert.ok(!/script|onerror|onclick|onload|javascript:|iframe|svg|steal/i.test(out), out);
  assert.match(out, /<p>Hi<\/p>/);
  assert.match(out, /<a>go<\/a>/);
});

test('sanitizeHtml: safe links get rel=noopener; attribute quotes cannot break out', () => {
  const out = sanitizeHtml('<a href="https://guideon.om/x" style="color:red">ok</a><img src="/img/a.webp" alt=\'a" onerror="x\'>');
  assert.match(out, /<a href="https:\/\/guideon.om\/x" rel="noopener nofollow" target="_blank">ok<\/a>/);
  assert.match(out, /alt="a&quot; onerror=&quot;x"/);
  assert.ok(!/style=/.test(out));
});
