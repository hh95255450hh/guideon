const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const conf = fs.readFileSync(path.join(__dirname, '..', 'deploy', 'nginx.conf'), 'utf8');

// Uploaded objects are written under a fresh UUID, so they can be cached
// forever — but only the public object route. If this block ever drifts below
// the generic /(rest|storage|auth)/v1/ one, nginx stops matching it.
test('nginx: public storage objects are cached, and that block comes first', () => {
  const pub = conf.indexOf('location ~ ^/storage/v1/object/public/');
  const api = conf.indexOf('location ~ ^/(rest|storage|auth|realtime|functions)/v1/');
  assert.ok(pub > -1, 'the public-storage location is missing');
  assert.ok(api > -1, 'the API location is missing');
  assert.ok(pub < api, 'the public-storage block must precede the API block');
  const block = conf.slice(pub, api);
  assert.match(block, /proxy_hide_header Cache-Control;/);
  assert.match(block, /add_header Cache-Control "public, max-age=31536000, immutable"/);
});

test('nginx: the API itself is never cached', () => {
  const api = conf.indexOf('location ~ ^/(rest|storage|auth|realtime|functions)/v1/');
  const block = conf.slice(api, conf.indexOf('location = /deploy-hook'));
  assert.doesNotMatch(block, /add_header Cache-Control/);
});
