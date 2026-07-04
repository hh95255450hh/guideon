const { test } = require('node:test');
const assert = require('node:assert');
const { isOmanDestination, filterOmanDestinations } = require('../src/utils/omanPlaces');

test('accepts Omani governorates and wilayats', () => {
  assert.ok(isOmanDestination('Muscat'));
  assert.ok(isOmanDestination('Nizwa'));
  assert.ok(isOmanDestination('Salalah, Dhofar'));
  assert.ok(isOmanDestination('Jebel Akhdar'));
  assert.ok(isOmanDestination('oman'));
});

test('rejects non-Oman places', () => {
  assert.strictEqual(isOmanDestination('Moscow'), false);
  assert.strictEqual(isOmanDestination('Russia'), false);
  assert.strictEqual(isOmanDestination('Dubai'), false);
  assert.strictEqual(isOmanDestination(''), false);
  assert.strictEqual(isOmanDestination(null), false);
});

test('filter drops non-Oman entries, trims and dedupes', () => {
  const out = filterOmanDestinations(['Moscow', ' Muscat ', 'muscat', 'Salalah', 'Paris']);
  assert.deepStrictEqual(out, ['Muscat', 'Salalah']);
});

test('filter handles non-array input', () => {
  assert.deepStrictEqual(filterOmanDestinations(undefined), []);
  assert.deepStrictEqual(filterOmanDestinations('Muscat'), []);
});
