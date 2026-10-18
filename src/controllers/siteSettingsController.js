const SupabaseDB = require('../models/SupabaseDB');
const settings = new SupabaseDB('site_settings', 'key');
const { hasPermission } = require('../config/permissions');

// Only these keys are public. The table also holds internal configuration —
// commission rates and the VAT number today, and whatever an admin saves there
// tomorrow — so the public read is an allowlist, never "every row". It used to
// return the whole table to anyone, including 18 KB of region content the home
// page never reads.
const PUBLIC_KEYS = new Set(['hero', 'carousel', 'activities', 'pageHeroes']);
exports.PUBLIC_KEYS = PUBLIC_KEYS;

// Pages whose cinematic header footage an admin can replace, one by one
// (public/js/gd-cine.js reads pageHeroes.pages[<data-cine-page>]).
const HERO_PAGES = ['about', 'how-it-works', 'contact', 'blog', 'trails', 'cancellation',
  'faq', 'regions', 'teams', 'terms', 'privacy'];
exports.HERO_PAGES = HERO_PAGES;

// Media lands in a CSS url() and a <video src>, so only same-site paths and
// https links, with no quotes, spaces or parentheses.
const safeMedia = u => (typeof u === 'string' && /^(\/(?!\/)|https:\/\/)[^\s"'<>()\\]{1,500}$/.test(u.trim())) ? u.trim() : '';

function cleanPageHeroes(value) {
  const src = (value && value.pages) || {};
  const pages = {};
  for (const k of HERO_PAGES) {
    const p = src[k];
    if (!p || typeof p !== 'object') continue;
    const e = {
      image: safeMedia(p.image),
      video: safeMedia(p.video),
      word: String(p.word || '').toUpperCase().replace(/[^A-Z0-9 &-]/g, '').trim().slice(0, 14),
    };
    if (e.image || e.video || e.word) pages[k] = e;
  }
  return { pages };
}
exports.cleanPageHeroes = cleanPageHeroes;

const isStaff = req => req.session && (req.session.userType === 'admin' || req.session.userType === 'staff');

// GET /api/site-settings — the public homepage settings (admins get them all)
exports.getAll = async (req, res) => {
  try {
    const all = await settings.readAll();
    const staff = isStaff(req);
    const map = {};
    for (const r of all) if (staff || PUBLIC_KEYS.has(r.key)) map[r.key] = r.value;
    // Homepage copy changes rarely; a minute of shared caching takes this read
    // off the critical path of every page view. Admin responses stay private.
    res.set('Cache-Control', staff ? 'private, no-store' : 'public, max-age=60');
    res.json({ success: true, settings: map });
  } catch (err) {
    console.error('[site-settings:getAll]', err.message);
    res.status(500).json({ success: false, message: 'Failed to load settings.' });
  }
};

// GET /api/site-settings/:key — public keys for anyone, the rest for admins
exports.getOne = async (req, res) => {
  try {
    if (!PUBLIC_KEYS.has(req.params.key) && !isStaff(req)) {
      return res.status(403).json({ success: false, message: 'Admin only.' });
    }
    const row = await settings.findById(req.params.key);
    if (!row) return res.json({ success: true, value: null });
    res.json({ success: true, value: row.value });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed.' });
  }
};

// PUT /api/admin/site-settings/:key — admin only, upsert value
exports.update = async (req, res) => {
  try {
    if (req.session.userType !== 'admin' && req.session.userType !== 'staff') {
      return res.status(403).json({ success: false, message: 'Admin only.' });
    }
    const { key } = req.params;
    // Commission rates are money; everything else here is public site content.
    // Any staff role could change both before.
    const need = key === 'commission' ? 'manage_finance' : 'manage_content';
    if (!req.user || !hasPermission(req.user, need)) {
      return res.status(403).json({ success: false, message: `Permission denied. This action requires: ${need}` });
    }
    if (!['hero','carousel','activities','pageHeroes','theme','footer','navbar','commission'].includes(key)) {
      return res.status(400).json({ success: false, message: 'Unknown setting key.' });
    }
    let value = req.body.value || req.body;
    if (key === 'pageHeroes') value = cleanPageHeroes(value);
    // Commission rates: validate + normalise to fractions in [0, 0.9].
    if (key === 'commission') {
      const norm = (n, max = 0.9) => {
        let v = parseFloat(n);
        if (Number.isNaN(v)) return null;
        if (v > 1) v = v / 100;            // accept "15" meaning 15%
        return Math.min(Math.max(v, 0), max);
      };
      const g = norm(value.guide), c = norm(value.company);
      if (g == null || c == null) {
        return res.status(400).json({ success: false, message: 'Guide and company rates are required (e.g. 10 and 15).' });
      }
      const team = value.team != null && value.team !== '' ? norm(value.team) : g;
      // VAT is optional (defaults to 0 = off). Capped at 25%.
      const vat = value.vat != null && value.vat !== '' ? norm(value.vat, 0.25) : 0;
      value = {
        guide: g, company: c, team: team == null ? g : team,
        vat: vat == null ? 0 : vat,
        vatNumber: typeof value.vatNumber === 'string' ? value.vatNumber.trim().slice(0, 40) : '',
      };
    }
    const existing = await settings.findById(key);
    if (existing) {
      await settings.update(key, { value, updated_by: req.session.userId, updatedAt: new Date().toISOString() });
    } else {
      await settings.insert({ key, value, updated_by: req.session.userId, updatedAt: new Date().toISOString() });
    }
    if (key === 'commission') { try { require('../services/commission').bustCache(); } catch {} }
    res.json({ success: true, message: 'Saved.', value });
  } catch (err) {
    console.error('[site-settings:update]', err.message);
    res.status(500).json({ success: false, message: "Couldn't save right now. Please try again. — تعذّر الحفظ، حاول مجدداً." });
  }
};
