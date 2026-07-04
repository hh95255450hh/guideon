// Canonical Oman places allow-list.
// Guide/company `destinations` are free-text; without a guard a profile can
// end up listing non-Omani places (e.g. "Moscow, Russia"), which then surface
// in search/SEO. This module normalises submitted destinations to Omani
// governorates + wilayats and drops anything outside the Sultanate.
//
// Keep aligned with the govWilayats map in guideController.js and the PLACES
// list in services/seoLanding.js.

// Governorate name → its wilayats (and common spelling variants).
const GOVERNORATES = {
  'Muscat':              ['Muscat', 'Muttrah', 'Bawshar', 'As Seeb', 'Seeb', 'Al Amerat', 'Qurayyat'],
  'Dhofar':              ['Salalah', 'Taqah', 'Mirbat', 'Thumrait', 'Sadah', 'Rakhyut', 'Dhalkut', 'Shaleem', 'Al Mazyona'],
  'Musandam':            ['Khasab', 'Bukha', 'Dibba', 'Madha', 'Musandam'],
  'Al Buraimi':          ['Al Buraimi', 'Buraimi', 'Mahdah', 'As Sunaynah'],
  'Ad Dakhiliyah':       ['Nizwa', 'Bahla', 'Manah', 'Al Hamra', 'Adam', 'Izki', 'Samail', 'Bidbid', 'Jabal Akhdar', 'Jabal Al Akhdar', 'Jebel Akhdar'],
  'Al Batinah North':    ['Sohar', 'Shinas', 'Liwa', 'Saham', 'Al Khaburah', 'As Suwayq'],
  'Al Batinah South':    ['Rustaq', 'Al Awabi', 'Nakhal', 'Wadi Al Maawil', 'Barka', 'Al Masnaah'],
  'Ash Sharqiyah North': ['Ibra', 'Al Mudhaibi', 'Bidiyah', 'Al Qabil', 'Wadi Bani Khalid', 'Dima', 'Wadi Shab'],
  'Ash Sharqiyah South': ['Sur', 'Al Kamil', 'Jalan', 'Masirah', 'Ras al-Jinz', 'Ras al Jinz'],
  'Ad Dhahirah':         ['Ibri', 'Yanqul', 'Dhank'],
  'Al Wusta':            ['Haima', 'Mahut', 'Duqm', 'Al Jazer', 'Wahiba'],
};

// A few well-known landmark/synonym tokens that legitimately appear in
// destinations but aren't wilayat names.
const EXTRA_ALLOWED = [
  'Oman', 'Sultanate of Oman', 'Wahiba Sands', 'Sharqiya Sands', 'Empty Quarter',
  'Rub al Khali', 'Jebel Shams', 'Jabal Shams', 'Wadi Ghul', 'Bimmah Sinkhole',
  'Daymaniyat', 'Al Jabal Al Akhdar',
];

// Flat lowercase set of every acceptable token.
const ALLOWED = new Set();
for (const gov of Object.keys(GOVERNORATES)) {
  ALLOWED.add(gov.toLowerCase());
  for (const w of GOVERNORATES[gov]) ALLOWED.add(w.toLowerCase());
}
for (const e of EXTRA_ALLOWED) ALLOWED.add(e.toLowerCase());

// True if a single free-text destination names an Omani place. Matches on
// token containment so "Salalah, Dhofar" or "Nizwa (Oman)" still pass.
function isOmanDestination(dest) {
  if (!dest) return false;
  const d = String(dest).trim().toLowerCase();
  if (!d) return false;
  if (ALLOWED.has(d)) return true;
  for (const token of ALLOWED) {
    if (d.includes(token)) return true;
  }
  return false;
}

// Filter an array of destinations down to Omani ones, trimmed + de-duplicated.
// Non-Oman entries (e.g. "Moscow") are silently dropped.
function filterOmanDestinations(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const v = String(raw == null ? '' : raw).trim();
    if (!v || !isOmanDestination(v)) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

module.exports = { GOVERNORATES, isOmanDestination, filterOmanDestinations };
