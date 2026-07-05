/* ── Guideon i18n — lazy-loading core ──
 *
 * Pre-split: a single 167KB file shipped every language to every visitor.
 * Now: this ~6KB core ships, then fetches /i18n/<active>.json on demand.
 * English is the universal fallback and is fetched once if needed.
 *
 * Public API is unchanged for callers:
 *   I18N.lang, I18N.t(key, n?), I18N.apply(),
 *   I18N.setLang(code), I18N.toggle(), I18N.init(), I18N.languages
 *
 * Dynamic strings (e.g. "{n} guides found") are stored as templates in
 * the JSON files; I18N.t(key, n) substitutes {n} at lookup time.
 *
 * HTML already carries English fallback text inside [data-i18n] tags,
 * so the brief window before the language pack arrives is invisible
 * on first paint.
 */

const LANGUAGES = [
  { code: 'en', name: 'English',    native: 'English',    flag: '🇬🇧', dir: 'ltr' },
  { code: 'zh', name: 'Mandarin',   native: '中文',         flag: '🇨🇳', dir: 'ltr' },
  { code: 'hi', name: 'Hindi',      native: 'हिन्दी',        flag: '🇮🇳', dir: 'ltr' },
  { code: 'es', name: 'Spanish',    native: 'Español',    flag: '🇪🇸', dir: 'ltr' },
  { code: 'fr', name: 'French',     native: 'Français',   flag: '🇫🇷', dir: 'ltr' },
  { code: 'ar', name: 'Arabic',     native: 'العربية',     flag: '🇴🇲', dir: 'rtl' },
  { code: 'bn', name: 'Bengali',    native: 'বাংলা',       flag: '🇧🇩', dir: 'ltr' },
  { code: 'pt', name: 'Portuguese', native: 'Português',  flag: '🇵🇹', dir: 'ltr' },
  { code: 'ru', name: 'Russian',    native: 'Русский',    flag: '🇷🇺', dir: 'ltr' },
  { code: 'ur', name: 'Urdu',       native: 'اردو',        flag: '🇵🇰', dir: 'rtl' },
];
const LANG_BY_CODE = Object.fromEntries(LANGUAGES.map(l => [l.code, l]));

// In-memory cache: code → dictionary. Populated by load().
const PACKS = Object.create(null);
// In-flight fetches keyed by code; lets concurrent callers await the same
// network request instead of triggering duplicates.
const PENDING = Object.create(null);

// Bump PACK_VERSION whenever any /i18n/*.json changes. The JSON packs are
// served with a 1-year immutable cache, so without this query string a
// content change would never reach returning visitors.
const PACK_VERSION = 12;

async function loadPack(code) {
  if (PACKS[code]) return PACKS[code];
  if (PENDING[code]) return PENDING[code];
  PENDING[code] = (async () => {
    try {
      const r = await fetch(`/i18n/${code}.json?v=${PACK_VERSION}`, { credentials: 'omit' });
      if (!r.ok) throw new Error(`pack ${code} HTTP ${r.status}`);
      const dict = await r.json();
      PACKS[code] = dict;
      return dict;
    } catch (e) {
      // Failed pack → empty object so the fallback chain kicks in.
      console.warn('[i18n] load failed:', code, e.message);
      PACKS[code] = {};
      return PACKS[code];
    } finally {
      delete PENDING[code];
    }
  })();
  return PENDING[code];
}

// Replace {n} (and {0}, for forward-compat) with the first numeric arg.
function fillTemplate(s, n) {
  if (n == null) return s;
  return String(s).replace(/\{n\}|\{0\}/g, n);
}

const I18N = {
  lang: (() => {
    const stored = localStorage.getItem('gd_lang');
    if (stored && LANG_BY_CODE[stored]) return stored;
    const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
    return LANG_BY_CODE[nav] ? nav : 'en';
  })(),
  languages: LANGUAGES,

  // Synchronous lookup — uses whatever is currently cached. Before the
  // first apply() this is the empty-cache no-op, so untranslated keys
  // return their key (and pages keep showing the HTML fallback text).
  t(key, ...args) {
    const dict = PACKS[this.lang] || {};
    const en   = PACKS.en || {};
    const raw  = dict[key] || en[key] || key;
    if (typeof raw !== 'string') return raw;
    return args.length ? fillTemplate(raw, args[0]) : raw;
  },

  async apply() {
    // Load active pack + English fallback (in parallel) before painting.
    await Promise.all([
      loadPack(this.lang),
      this.lang !== 'en' ? loadPack('en') : Promise.resolve(),
    ]);

    const meta  = LANG_BY_CODE[this.lang] || LANG_BY_CODE.en;
    const isRtl = meta.dir === 'rtl';
    document.documentElement.lang = this.lang;
    document.documentElement.dir  = meta.dir;

    // Bootstrap RTL/LTR swap. To save ~30 KB on first paint, each HTML
    // page now ships only ONE Bootstrap stylesheet (the one matching
    // the stored language). If the user then switches LTR↔RTL we
    // create the other link on the fly here so the page restyles
    // without a reload.
    function ensureBs(idAttr, href) {
      let el = document.getElementById(idAttr);
      if (!el) {
        el = document.createElement('link');
        el.id = idAttr; el.rel = 'stylesheet'; el.href = href;
        document.head.appendChild(el);
      }
      return el;
    }
    const bsLtr = ensureBs('bs-ltr', '/css/bootstrap.min.css');
    const bsRtl = ensureBs('bs-rtl', '/css/bootstrap.rtl.min.css');
    bsLtr.media = isRtl ? 'not all' : '';
    bsRtl.media = isRtl ? ''        : 'not all';

    document.body.style.fontFamily = isRtl
      ? "'Segoe UI', 'Cairo', 'Tajawal', 'Noto Naskh Arabic', system-ui, sans-serif"
      : (this.lang === 'zh') ? "'Segoe UI', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif"
      : (this.lang === 'hi' || this.lang === 'bn') ? "'Segoe UI', 'Noto Sans Devanagari', system-ui, sans-serif"
      : "'Segoe UI', system-ui, sans-serif";

    const dict = PACKS[this.lang] || {};
    const en   = PACKS.en || {};
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const v   = dict[key] || en[key];
      if (typeof v === 'string') {
        if (/<[a-z][\s\S]*>/i.test(v)) el.innerHTML = v;
        else el.textContent = v;
      }
    });
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
      const key = el.getAttribute('data-i18n-ph');
      const v   = dict[key] || en[key];
      if (typeof v === 'string') el.placeholder = v;
    });

    document.querySelectorAll('.lang-toggle').forEach((btn) => {
      btn.textContent = '🌐 ' + meta.native;
    });
  },

  async setLang(code) {
    if (!LANG_BY_CODE[code]) code = 'en';
    if (code === this.lang) return;
    const prev = this.lang;
    this.lang = code;
    localStorage.setItem('gd_lang', code);
    await this.apply();
    if (typeof window.onLangChange === 'function') window.onLangChange();
    // Bilingual EN/AR navbar + static page strings — for the 8 other
    // languages a full reload guarantees a consistent UI even where
    // strings aren't wired with data-i18n.
    const BILINGUAL = new Set(['en', 'ar']);
    if (!BILINGUAL.has(code) || !BILINGUAL.has(prev)) {
      setTimeout(() => location.reload(), 50);
    }
  },

  toggle() { return this.setLang(this.lang === 'en' ? 'ar' : 'en'); },

  init() { return this.apply(); },
};

document.addEventListener('DOMContentLoaded', () => I18N.init());
