/**
 * Commission rate resolution.
 *
 * Companies and individual guides earn differently, and the owner needs to
 * change rates over time without a redeploy. Resolution priority:
 *   1. Per-user override   — user.commissionRate (a negotiated rate)
 *   2. Type-level setting   — site_settings 'commission' { guide, company }
 *   3. Env default          — PLATFORM_COMMISSION_RATE (fallback 0.10)
 *
 * Rates are fractions (0.15 = 15%). The 'commission' setting is edited by the
 * admin via /api/admin/site-settings/commission and cached here for 60s.
 */
const SupabaseDB = require('../models/SupabaseDB');
const settings = new SupabaseDB('site_settings', 'key');

const ENV_DEFAULT = parseFloat(process.env.PLATFORM_COMMISSION_RATE || '0.10');
const ENV_VAT     = parseFloat(process.env.VAT_RATE || '0');
const ENV_VATNUM  = process.env.VAT_NUMBER || '';

let _cache = { at: 0, rates: null };
const TTL = 60 * 1000;

function _clamp(n, fallback, max = 0.9) {
  const v = parseFloat(n);
  if (Number.isNaN(v) || v < 0 || v > max) return fallback;
  return v;
}

// Returns { guide, company, vat, vatNumber }. guide/company/vat are fractions.
// Falls back to env defaults if the setting row / table is missing.
async function getRates() {
  if (_cache.rates && Date.now() - _cache.at < TTL) return _cache.rates;
  let rates = { guide: ENV_DEFAULT, company: ENV_DEFAULT, team: ENV_DEFAULT, vat: ENV_VAT, vatNumber: ENV_VATNUM };
  try {
    const row = await settings.findById('commission');
    const v = row && row.value ? row.value : {};
    rates = {
      guide:     _clamp(v.guide,   ENV_DEFAULT),
      company:   _clamp(v.company, ENV_DEFAULT),
      team:      _clamp(v.team,    ENV_DEFAULT),
      vat:       _clamp(v.vat,     ENV_VAT, 0.25),   // VAT capped at 25%
      vatNumber: typeof v.vatNumber === 'string' ? v.vatNumber : ENV_VATNUM,
    };
  } catch { /* table missing → env defaults */ }
  _cache = { at: Date.now(), rates };
  return rates;
}

// Resolve the rate for a specific provider user, given pre-fetched rates.
function rateFor(user, rates) {
  if (user && user.commissionRate != null) {
    const v = _clamp(user.commissionRate, null);
    if (v != null) return v;
  }
  if (user && user.userType === 'company') return rates.company;
  if (user && user.userType === 'team')    return rates.team;
  return rates.guide;
}

// Convenience: resolve straight from a provider user (fetches rates).
async function resolveRate(user) {
  const rates = await getRates();
  return rateFor(user, rates);
}

function bustCache() { _cache = { at: 0, rates: null }; }

module.exports = { getRates, rateFor, resolveRate, bustCache, ENV_DEFAULT };
