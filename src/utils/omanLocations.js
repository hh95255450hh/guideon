// Oman's 11 governorates and 61 wilayats, read from the same file the browser
// uses (public/js/oman-locations.js), so the server and every search form agree
// on the exact names. That file assigns to `window`, so it is evaluated once in
// an isolated context with a stub window — it is our own static data file.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let cache = null;

function load() {
  if (cache) return cache;
  const file = path.join(__dirname, '..', '..', 'public', 'js', 'oman-locations.js');
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file, timeout: 1000 });
  const list = sandbox.window.OMAN_LOCATIONS || [];
  cache = {
    list,
    governorates: list.map(g => g.governorateEn),
    wilayats: [...new Set(list.flatMap(g => g.wilayats.map(w => w.en)))],
  };
  return cache;
}

module.exports = { load };
