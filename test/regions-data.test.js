const test = require('node:test');
const assert = require('node:assert');
const regions = require('../public/data/regions.json').regions;

// Oman's bounding box. A landmark outside it would deep-link a tourist into
// another country, since each marker opens Google Maps at its coordinates.
const BOX = { latMin: 16.6, latMax: 26.5, lngMin: 51.8, lngMax: 59.9 };

test('regions: all 11 governorates present with the required fields', () => {
  assert.strictEqual(regions.length, 11);
  for (const r of regions) {
    for (const f of ['id', 'slug', 'name_en', 'name_ar', 'landmarks', 'sites']) {
      assert.ok(r[f] !== undefined && r[f] !== '', `${r.id || '?'} missing ${f}`);
    }
    assert.ok(Array.isArray(r.landmarks) && r.landmarks.length >= 8,
      `${r.id} should list a meaningful number of sites, got ${(r.landmarks || []).length}`);
  }
});

test('regions: every landmark is complete and inside Oman', () => {
  for (const r of regions) {
    for (const l of r.landmarks) {
      const where = `${r.id}/${l.name_ar || l.name_en}`;
      assert.ok(l.name_ar && l.name_en, `${where}: needs both languages`);
      assert.ok(l.type, `${where}: needs a type`);
      assert.ok(Number.isFinite(l.lat) && Number.isFinite(l.lng), `${where}: needs numeric coordinates`);
      assert.ok(l.lat >= BOX.latMin && l.lat <= BOX.latMax, `${where}: lat ${l.lat} outside Oman`);
      assert.ok(l.lng >= BOX.lngMin && l.lng <= BOX.lngMax, `${where}: lng ${l.lng} outside Oman`);
    }
  }
});

test('regions: the sites badge matches the real landmark count', () => {
  // The badge used to be a decorative number no data backed.
  for (const r of regions) {
    assert.strictEqual(r.sites, r.landmarks.length,
      `${r.id}: badge says ${r.sites} but ${r.landmarks.length} landmarks exist`);
  }
});

test('regions: no duplicate landmarks within a governorate', () => {
  for (const r of regions) {
    const names = r.landmarks.map(l => l.name_ar);
    assert.strictEqual(new Set(names).size, names.length, `${r.id} has duplicate landmark names`);
  }
});

// The ministry PDF's text layer swaps the لا ligature. These spellings are the
// signature of text pasted straight from it instead of being written correctly.
test('regions: Arabic names carry no PDF ligature corruption', () => {
  const CORRUPT = ['بهالء', 'بالد', 'الجاللي', 'صاللة', 'بالط', 'الثالثاء'];
  for (const r of regions) {
    for (const l of r.landmarks) {
      for (const bad of CORRUPT) {
        assert.ok(!String(l.name_ar).includes(bad),
          `${r.id}/${l.name_ar}: "${bad}" is the PDF's reversed لا — write the name by hand`);
      }
      assert.ok(!/[ـ]/.test(l.name_ar), `${r.id}/${l.name_ar}: contains tatweel padding from the PDF`);
    }
  }
});
