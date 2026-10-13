const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
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

// Photos come from Wikimedia Commons under CC/public-domain terms. Commercial
// reuse is allowed only with attribution, so a photo without a credit and a
// licence on record is a licence breach waiting to ship.
test('regions: every landmark photo carries its credit, licence and source', () => {
  const OK_LICENCE = /^(cc0|cc[- ]by|public domain|pd|attribution)/i;
  for (const r of regions) {
    for (const l of r.landmarks) {
      if (!l.image) continue;
      const where = `${r.id}/${l.name_ar}`;
      assert.ok(/^\/img\/landmarks\/[a-z0-9-]+\.webp$/.test(l.image),
        `${where}: photo must be a file we host ourselves, got ${l.image}`);
      assert.ok(fs.existsSync(path.join(__dirname, '..', 'public', l.image)),
        `${where}: ${l.image} is referenced but missing from the repo`);
      assert.ok(l.credit, `${where}: photo needs an author credit`);
      assert.ok(l.photo_source, `${where}: photo needs a link back to its Commons page`);
      assert.ok(OK_LICENCE.test(String(l.licence).trim()),
        `${where}: "${l.licence}" is not a licence we may use commercially`);
    }
  }
});

// Two landmarks a few hundred metres apart with the same English name are the
// same place entered twice (قلعة خصب / حصن خصب). Thirteen of those shipped once
// because the duplicate check only compared Arabic names.
test('regions: no landmark is listed twice under a different spelling', () => {
  const km = (a, b) => {
    const R = 6371, rad = d => d * Math.PI / 180;
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  for (const r of regions) {
    for (let i = 0; i < r.landmarks.length; i++) {
      for (let j = i + 1; j < r.landmarks.length; j++) {
        const a = r.landmarks[i], b = r.landmarks[j];
        assert.ok(a.name_en !== b.name_en,
          `${r.id}: "${a.name_en}" appears twice (${a.name_ar} / ${b.name_ar})`);
        // Neighbouring sites legitimately share a spot (the Frankincense museum
        // stands inside Al Baleed park), so only an identical position is a bug.
        assert.ok(km(a, b) > 0.001,
          `${r.id}: ${a.name_ar} and ${b.name_ar} sit on the exact same point`);
      }
    }
  }
});

// A single photo standing in for two places tells the visitor something false
// about at least one of them.
test('regions: no photo is reused for two landmarks', () => {
  for (const r of regions) {
    const used = new Map();
    for (const l of r.landmarks) {
      if (!l.image) continue;
      assert.ok(!used.has(l.image), `${r.id}: ${l.name_ar} reuses ${used.get(l.image)}'s photo`);
      used.set(l.image, l.name_ar);
    }
  }
});
