/**
 * Programmatic SEO landing pages.
 *
 * The cold-start problem for a marketplace is discovery: a tourist Googling
 * "tour guide nizwa" or "desert safari oman" should land on Guideon, not on
 * TripAdvisor. We already hold the data (verified guides + their destinations
 * and specialisations), so we generate one indexable, server-rendered landing
 * page per place and per category — each with a real guide list, internal
 * links, and JSON-LD structured data.
 *
 * Routes (see routes/seoLanding.js):
 *   /tour-guides/:place      e.g. /tour-guides/nizwa
 *   /tours/:category         e.g. /tours/desert
 *
 * These slugs never collide with the existing *.html files.
 */

// ── Place catalogue ──
// slug → bilingual name, the governorate it sits in, and the wilayat aliases
// we match against a guide's `destinations` array. Keep these aligned with the
// governorate map used in guideController.searchGuides.
const PLACES = [
  { slug: 'muscat',     en: 'Muscat',      ar: 'مسقط',      gov: 'Muscat',              aliases: ['Muscat','Muttrah','Bawshar','As Seeb','Seeb','Al Amerat','Qurayyat'],
    blurb: 'the capital — grand mosques, the Mutrah souq, forts and a corniche where heritage meets the sea.' },
  { slug: 'nizwa',      en: 'Nizwa',       ar: 'نزوى',      gov: 'Ad Dakhiliyah',       aliases: ['Nizwa','Bahla','Manah','Al Hamra','Birkat Al Mouz'],
    blurb: 'the historic heart of Oman — its round fort, Friday goat market, and the old falaj-fed plantations.' },
  { slug: 'salalah',    en: 'Salalah',     ar: 'صلالة',     gov: 'Dhofar',              aliases: ['Salalah','Taqah','Mirbat','Thumrait','Sadah'],
    blurb: 'the frankincense coast — green khareef monsoon hills, blowholes, and ancient incense ports.' },
  { slug: 'musandam',   en: 'Musandam',    ar: 'مسندم',     gov: 'Musandam',            aliases: ['Khasab','Bukha','Dibba','Madha','Musandam'],
    blurb: 'the "Norway of Arabia" — dramatic fjords, dolphin dhow cruises and cliffside villages.' },
  { slug: 'sur',        en: 'Sur',         ar: 'صور',       gov: 'Ash Sharqiyah South', aliases: ['Sur','Al Kamil','Jalan','Ras al-Jinz','Ras al Jinz'],
    blurb: 'a dhow-building town and the gateway to the Ras Al Jinz turtle reserve.' },
  { slug: 'wahiba-sands', en: 'Wahiba Sands', ar: 'رمال الشرقية', gov: 'Ash Sharqiyah North', aliases: ['Wahiba','Bidiyah','Al Mudhaibi','Wadi Bani Khalid'],
    blurb: 'rolling desert dunes, Bedouin camps, dune-bashing and unforgettable starry nights.' },
  { slug: 'jabal-akhdar', en: 'Jabal Akhdar', ar: 'الجبل الأخضر', gov: 'Ad Dakhiliyah', aliases: ['Jabal Akhdar','Jabal Al Akhdar','Saiq','Al Hamra','Jebel Akhdar'],
    blurb: 'the Green Mountain — terraced rose farms, cool air and canyon-edge viewpoints.' },
  { slug: 'sohar',      en: 'Sohar',       ar: 'صحار',      gov: 'Al Batinah North',    aliases: ['Sohar','Shinas','Liwa','Saham','Al Khaburah'],
    blurb: 'a historic Batinah port city, the legendary home of Sindbad the Sailor.' },
  { slug: 'nakhal',     en: 'Nakhal',      ar: 'نخل',       gov: 'Al Batinah South',    aliases: ['Nakhal','Rustaq','Al Awabi','Wadi Al Maawil','Barka'],
    blurb: 'home to a cliff-top fort and the warm Ain A\'Thawwarah hot springs.' },
  { slug: 'ibri',       en: 'Ibri',        ar: 'عبري',      gov: 'Ad Dhahirah',         aliases: ['Ibri','Yanqul','Dhank','Bat'],
    blurb: 'gateway to the UNESCO Bronze-Age tombs of Bat and the western desert.' },
  { slug: 'ibra',       en: 'Ibra',        ar: 'إبراء',     gov: 'Ash Sharqiyah North', aliases: ['Ibra','Al Qabil','Wadi Bani Khalid','Sinaw'],
    blurb: 'an old caravan town near the emerald pools of Wadi Bani Khalid.' },
  { slug: 'khasab',     en: 'Khasab',      ar: 'خصب',       gov: 'Musandam',            aliases: ['Khasab','Bukha','Musandam'],
    blurb: 'the fjord capital — dhow cruises, snorkelling and Telegraph Island.' },
];

// ── Category catalogue ──
// slug → bilingual name + the specialisation/category terms we match.
const CATEGORIES = [
  { slug: 'cultural',   en: 'Cultural',   ar: 'ثقافية',  terms: ['cultural','culture','heritage'],
    blurb: 'forts, souqs, museums and the living traditions of Omani daily life.' },
  { slug: 'historical', en: 'Historical', ar: 'تاريخية',  terms: ['historical','history','archaeology','heritage'],
    blurb: 'UNESCO sites, ancient forts, tombs and frankincense-trail ports.' },
  { slug: 'desert',     en: 'Desert',     ar: 'صحراوية',  terms: ['desert','dune','safari','bedouin'],
    blurb: 'dune-bashing, camel rides, Bedouin camps and desert star-gazing.' },
  { slug: 'mountain',   en: 'Mountain',   ar: 'جبلية',   terms: ['mountain','trekking','hiking','jebel','jabal'],
    blurb: 'hikes and via-ferrata across the Hajar range and the Green Mountain.' },
  { slug: 'marine',     en: 'Marine',     ar: 'بحرية',   terms: ['marine','diving','snorkel','dolphin','beach','sea'],
    blurb: 'diving, snorkelling, dolphin-watching and dhow cruises along the coast.' },
  { slug: 'adventure',  en: 'Adventure',  ar: 'مغامرات', terms: ['adventure','canyon','wadi','caving','climb'],
    blurb: 'wadi swimming, canyoning, caving and off-road expeditions.' },
  { slug: 'aerial',     en: 'Aerial Tours', ar: 'رحلات جوية', terms: ['aerial','flight','flying','scenic flight','balloon','hot air balloon','paraglide','paragliding','glider','gliding','skydive','helicopter','طيران','منطاد','شراعي'],
    blurb: 'hot-air balloon rides, scenic flights, paragliding and aerial views of Oman.' },
];

const PLACE_BY_SLUG = Object.fromEntries(PLACES.map(p => [p.slug, p]));
const CAT_BY_SLUG   = Object.fromEntries(CATEGORIES.map(c => [c.slug, c]));

// True if a guide's destinations cover any alias of this place.
function guideServesPlace(guide, place) {
  const dests = (guide.destinations || []).map(d => String(d).toLowerCase());
  return place.aliases.some(a => dests.some(d => d.includes(a.toLowerCase())));
}

// True if a guide's specialisations match any term of this category.
function guideMatchesCategory(guide, cat) {
  const specs = (guide.specialisations || []).map(s => String(s).toLowerCase());
  return cat.terms.some(t => specs.some(s => s.includes(t)));
}

module.exports = {
  PLACES, CATEGORIES, PLACE_BY_SLUG, CAT_BY_SLUG,
  guideServesPlace, guideMatchesCategory,
};
