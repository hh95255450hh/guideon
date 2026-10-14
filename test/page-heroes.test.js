const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { cleanPageHeroes, HERO_PAGES, PUBLIC_KEYS } = require('../src/controllers/siteSettingsController');

// Admins pick the header footage of each page (site settings → pageHeroes). The
// values end up in a CSS url() and a <video src> on public pages, so the save
// path keeps only known pages, safe URLs and a plain watermark word.

test('page heroes: keeps safe media and a cleaned word', () => {
  const v = cleanPageHeroes({ pages: { about: {
    image: '/media/hero/a.jpg', video: 'https://guideon.om/storage/v1/object/public/media/x.mp4', word: 'story 1!',
  } } });
  assert.deepStrictEqual(v.pages.about, {
    image: '/media/hero/a.jpg', video: 'https://guideon.om/storage/v1/object/public/media/x.mp4', word: 'STORY 1',
  });
});

test('page heroes: drops unsafe URLs, unknown pages and empty entries', () => {
  const v = cleanPageHeroes({ pages: {
    about: { image: "/x.jpg') ; background:url('//evil", video: 'javascript:alert(1)', word: '' },
    contact: { image: '//evil.example/x.jpg', video: 'http://plain.example/x.mp4' },
    admin: { image: '/x.jpg' },
    faq: { word: 'a'.repeat(40) },
  } });
  assert.deepStrictEqual(Object.keys(v.pages), ['faq']);
  assert.strictEqual(v.pages.faq.word.length, 14);
});

test('page heroes: public, and every page key exists in the markup', () => {
  assert.ok(PUBLIC_KEYS.has('pageHeroes'));
  for (const k of HERO_PAGES) {
    const html = fs.readFileSync(path.join(__dirname, '..', 'public', k + '.html'), 'utf8');
    assert.ok(html.includes(`data-cine-page="${k}"`), `${k}.html must carry data-cine-page="${k}"`);
  }
});
