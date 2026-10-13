const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// A syntax error in a shared browser script takes the whole site down with it:
// a backtick inside a CSS comment in gd-navbar.js closed its template literal
// early, the file failed to parse, and the navigation bar vanished from every
// page. Nothing on the server noticed. These tests parse every script the
// browser will run, so that class of break fails the build instead.

const PUBLIC = path.join(__dirname, '..', 'public');

// Files that are not ours to keep parseable (minified vendor bundles).
const VENDOR = /(\.min\.js$|[\\/]vendor[\\/])/;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'vendor') continue;
      walk(full, out);
    } else out.push(full);
  }
  return out;
}

// Parse without running: vm.Script compiles and throws on a syntax error.
function parses(code, filename) {
  try { new vm.Script(code, { filename }); return null; }
  catch (e) { return e.message; }
}

test('frontend: every public JS file parses', () => {
  const files = walk(PUBLIC).filter(f => f.endsWith('.js') && !VENDOR.test(f));
  assert.ok(files.length > 10, 'expected to find the site scripts');
  const broken = [];
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    // ES modules (import/export at top level) cannot compile as a classic script.
    if (/^\s*(import|export)\s/m.test(src)) continue;
    const err = parses(src, f);
    if (err) broken.push(`${path.relative(PUBLIC, f)}: ${err}`);
  }
  assert.deepStrictEqual(broken, [], 'scripts that will not run in the browser:\n' + broken.join('\n'));
});

test('frontend: every inline <script> in the HTML pages parses', () => {
  const pages = walk(PUBLIC).filter(f => f.endsWith('.html'));
  const broken = [];
  for (const page of pages) {
    const html = fs.readFileSync(page, 'utf8');
    const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi;
    let m, n = 0;
    while ((m = re.exec(html))) {
      const attrs = m[1] || '';
      const body = m[2];
      n++;
      if (/\bsrc\s*=/.test(attrs)) continue;                       // external file
      if (/type\s*=\s*["']?(application\/(ld\+)?json|module|text\/template)/i.test(attrs)) continue;
      if (!body.trim()) continue;
      const err = parses(body, `${path.relative(PUBLIC, page)}#script${n}`);
      if (err) broken.push(`${path.relative(PUBLIC, page)} (script ${n}): ${err}`);
    }
  }
  assert.deepStrictEqual(broken, [], 'inline scripts that will not run:\n' + broken.join('\n'));
});
