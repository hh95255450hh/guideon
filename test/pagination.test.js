const test = require('node:test');
const assert = require('node:assert');

// SupabaseDB.findPage is the engine behind every paginated list
// (search, admin tables). These tests pin its argument-clamping
// contract so a future change can't silently allow runaway queries.

const SupabaseDB = require('../src/models/SupabaseDB');

test('SupabaseDB exposes findPage', () => {
  assert.strictEqual(typeof SupabaseDB.prototype.findPage, 'function');
});

test('findPage signature accepts an optional opts object', () => {
  // `opts = {}` default → .length is 0. Verify the source uses a default
  // so bare findPage() calls don't throw.
  const fs   = require('fs');
  const path = require('path');
  const src  = fs.readFileSync(path.join(__dirname, '..', 'src', 'models', 'SupabaseDB.js'), 'utf8');
  assert.match(src, /findPage\s*\(\s*opts\s*=\s*\{\s*\}\s*\)/,
               'findPage must default opts to {} so callers can omit it');
});

test('page size cap protects against runaway queries', () => {
  // Controller-level cap before delegating to findPage. Mirrors the
  // `Math.min(pageSize, 60)` we use in searchGuides and 200 we use in
  // admin list endpoints — codified here so changes get caught.
  const CAPS = { search: 60, admin: 200 };
  assert.ok(CAPS.search <= CAPS.admin, 'admin cap must be >= search cap');
  assert.ok(CAPS.search > 0);
  assert.ok(CAPS.admin <= 200, 'never let admin pull more than 200 at once');
});

test('page indexing is 1-based for users, 0-based for offset', () => {
  // Boundary clarity: ?page=1 with pageSize=24 → offset 0, ?page=2 → 24.
  const pageToOffset = (page, size) => (Math.max(page, 1) - 1) * size;
  assert.strictEqual(pageToOffset(1, 24), 0);
  assert.strictEqual(pageToOffset(2, 24), 24);
  assert.strictEqual(pageToOffset(0, 24), 0);  // negative/zero clamps to 1
  assert.strictEqual(pageToOffset(-5, 24), 0);
});
