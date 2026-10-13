const test = require('node:test');
const assert = require('node:assert');
const { mergeRegions } = require('../src/controllers/contentController');

// A region row an admin saved long ago: it carries their hero photo and prose,
// plus a frozen copy of the landmark list as it stood that day.
const saved = [{
  id: 'muscat', name_ar: 'مسقط (محرَّر)', hero: 'https://cdn/muscat.webp',
  sites: 48, landmarks: [{ name_ar: 'قلعة مطرح', name_en: 'Mutrah Fort', lat: 23.6, lng: 58.5, type: 'fort' }],
}];

const seed = [{
  id: 'muscat', name_ar: 'مسقط', hero: null, sites: 3,
  landmarks: [
    { name_ar: 'قلعة مطرح', name_en: 'Mutrah Fort', lat: 23.6, lng: 58.5, type: 'fort' },
    { name_ar: 'قلعة الجلالي', name_en: 'Al Jalali Fort', lat: 23.61, lng: 58.59, type: 'fort' },
    { name_ar: 'جامع السلطان قابوس', name_en: 'Sultan Qaboos Mosque', lat: 23.58, lng: 58.39, type: 'religious' },
  ],
}, { id: 'wusta', name_ar: 'الوسطى', sites: 1, landmarks: [{ name_ar: 'محمية المها', name_en: 'Oryx Sanctuary', lat: 20, lng: 57, type: 'nature' }] }];

test('content merge: admin edits win for prose and photos', () => {
  const [muscat] = mergeRegions(seed, saved);
  assert.strictEqual(muscat.name_ar, 'مسقط (محرَّر)');
  assert.strictEqual(muscat.hero, 'https://cdn/muscat.webp');
});

test('content merge: the curated landmark list is never overridden by a stale save', () => {
  // The bug this guards: the admin's frozen 1-landmark copy replaced the
  // curated list, so sites added afterwards vanished from the region page.
  const [muscat] = mergeRegions(seed, saved);
  assert.strictEqual(muscat.landmarks.length, 3);
  assert.strictEqual(muscat.sites, 3, 'the badge must follow the real landmark count, not the saved 48');
});

test('content merge: regions absent from the saved copy keep their seed data', () => {
  const wusta = mergeRegions(seed, saved).find(r => r.id === 'wusta');
  assert.strictEqual(wusta.landmarks.length, 1);
  assert.strictEqual(wusta.sites, 1);
});
