const test = require('node:test');
const assert = require('node:assert');

test('storage service exports expected API', () => {
  const storage = require('../src/services/storageService');
  assert.strictEqual(typeof storage.uploadBuffer, 'function');
  assert.strictEqual(typeof storage.deleteByUrl, 'function');
  assert.strictEqual(typeof storage.BUCKET, 'string');
});

test('deleteByUrl handles null gracefully', async () => {
  const storage = require('../src/services/storageService');
  await assert.doesNotReject(storage.deleteByUrl(null));
  await assert.doesNotReject(storage.deleteByUrl(''));
  await assert.doesNotReject(storage.deleteByUrl(undefined));
});
