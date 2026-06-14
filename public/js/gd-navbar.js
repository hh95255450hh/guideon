/**
 * Guideon unified navigation bar.
 *
 * Drop one <script src="/js/gd-navbar.js?v=1"></script> on any page and it:
 *   • Replaces any existing <nav> with a clean, responsive bar
 *   • Auto-flips for RTL/LTR using CSS logical properties
 *   • Desktop: nav links + single accent CTA + utility cluster
 *   • Mobile:  56px top bar (logo + bell + profile) + drawer menu
 *               + sticky bottom CTA
 *   • Reads user state from /api/auth/me — shows sign-in vs. dashboard
 *     CTAs accordingly
 *   • Mounts safely BEFORE common-widgets.js (which still adds the bell)
 *
 * Opt-out per page: add data-no-gd-nav to <body>.
 */
(function () {
  'use strict';
  if (document.body && document.body.dataset.noGdNav !== undefined) return;
  if (window.__gdNavMounted) return;
  window.__gdNavMounted = true;

  // ─── Style ────────────────────────────────────────────────────────────
  const css = `
  html {
    --gd-teal-500: #0f7b6c;
    --gd-teal-600: #0a5c50;
    --gd-gold-500: #c9a84c;
    --gd-ink-900: #0f1c3e;
    --gd-ink-700: #3d4759;
    --gd-ink-500: #6b7280;
    --gd-ink-100: #eef0f4;
    --gd-ink-50:  #f7f8fa;
    --gd-danger:  #dc2626;
    --gd-shadow-sm: 0 1px 3px rgba(15,28,62,.08);
    --gd-shadow-lg: 0 12px 32px rgba(15,28,62,.16);
  }

  /* ── Top bar ── */
  .gd-nav {
    position: sticky; top: 0; z-index: 1030;
    background: rgba(15, 28, 62, .96);
    backdrop-filter: saturate(180%) blur(8px);
    color: #fff;
    box-shadow: var(--gd-shadow-sm);
  }
  .gd-nav-inner {
    max-width: 1280px; margin-inline: auto;
    padding-block: 12px;
    padding-inline: 16px;
    display: flex; align-items: center; gap: 16px;
    min-height: 56px;
  }
  .gd-nav-brand {
    display: inline-flex; align-items: center; gap: 10px;
    color: #fff; text-decoration: none; font-weight: 800;
    font-size: 18px; flex-shrink: 0;
  }
  .gd-nav-brand img { height: 36px; width: auto; display: block; }

  /* ── Primary links (desktop only) ── */
  .gd-nav-links { display: none; gap: 4px; flex: 1; padding-inline-start: 16px; }
  .gd-nav-links a {
    color: rgba(255,255,255,.85); text-decoration: none; font-weight: 600;
    font-size: 14px; padding: 8px 14px; border-radius: 8px; transition: .15s;
    white-space: nowrap;
  }
  .gd-nav-links a:hover,
  .gd-nav-links a.active { background: rgba(255,255,255,.12); color: #fff; }

  /* ── Primary CTA ── */
  .gd-nav-cta {
    background: linear-gradient(135deg, var(--gd-gold-500), #e8c46d);
    color: #fff; border: 0; border-radius: 10px;
    padding: 9px 18px; font-weight: 700; font-size: 14px;
    display: none; align-items: center; gap: 6px;
    text-decoration: none; white-space: nowrap;
    box-shadow: 0 2px 8px rgba(201,168,76,.35);
    transition: transform .15s, box-shadow .15s;
  }
  .gd-nav-cta:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(201,168,76,.5); color: #fff; }

  /* ── Utility cluster ── */
  .gd-nav-utils { display: inline-flex; align-items: center; gap: 6px; margin-inline-start: auto; }
  .gd-nav-icon-btn {
    width: 40px; height: 40px; border-radius: 50%; border: 0;
    background: transparent; color: rgba(255,255,255,.85);
    display: inline-flex; align-items: center; justify-content: center;
    cursor: pointer; transition: background .15s, color .15s; position: relative;
  }
  .gd-nav-icon-btn:hover { background: rgba(255,255,255,.12); color: #fff; }
  .gd-nav-icon-btn svg { width: 20px; height: 20px; }
  .gd-nav-chip {
    background: rgba(255,255,255,.10); color: #fff; border: 1px solid rgba(255,255,255,.18);
    padding: 7px 12px; border-radius: 999px; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: .15s; display: inline-flex; align-items: center; gap: 6px;
    white-space: nowrap;
  }
  .gd-nav-chip:hover { background: rgba(255,255,255,.18); }
  .gd-nav-chip select {
    background: transparent; border: 0; color: #fff; font: inherit; outline: none;
    appearance: none; cursor: pointer; padding-inline-end: 14px;
  }
  .gd-nav-chip select option { color: #000; }

  .gd-nav-avatar {
    width: 36px; height: 36px; border-radius: 50%;
    background: rgba(255,255,255,.15); color: #fff; font-weight: 700;
    display: inline-flex; align-items: center; justify-content: center;
    overflow: hidden; cursor: pointer; border: 2px solid rgba(255,255,255,.3);
    font-size: 13px;
  }
  .gd-nav-avatar img { width: 100%; height: 100%; object-fit: cover; }

  /* ── Mobile hamburger & bottom CTA ── */
  .gd-nav-burger { display: inline-flex; }
  .gd-nav-bottom-cta {
    position: fixed; bottom: 0; inset-inline: 0; z-index: 1029;
    background: linear-gradient(180deg, rgba(255,255,255,0), rgba(255,255,255,.98) 30%);
    padding: 14px 16px calc(env(safe-area-inset-bottom, 0px) + 14px);
    display: none;
  }
  .gd-nav-bottom-cta a {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    background: linear-gradient(135deg, var(--gd-gold-500), #e8c46d);
    color: #fff; text-decoration: none; font-weight: 800;
    border-radius: 14px; padding: 14px 18px; font-size: 15px;
    box-shadow: 0 6px 22px rgba(201,168,76,.35);
  }

  /* ── Drawer (mobile menu) ── */
  .gd-drawer-backdrop {
    position: fixed; inset: 0; background: rgba(15,28,62,.5);
    z-index: 1040; opacity: 0; pointer-events: none; transition: opacity .25s;
  }
  .gd-drawer-backdrop.open { opacity: 1; pointer-events: auto; }
  .gd-drawer {
    position: fixed; top: 0; bottom: 0;
    inset-inline-start: 0;
    width: min(82vw, 320px);
    background: #fff; color: var(--gd-ink-900);
    z-index: 1041; transform: translateX(-100%);
    transition: transform .28s cubic-bezier(.2,.8,.2,1);
    display: flex; flex-direction: column;
    box-shadow: var(--gd-shadow-lg);
  }
  html[dir="rtl"] .gd-drawer { transform: translateX(100%); }
  .gd-drawer.open { transform: translateX(0); }
  .gd-drawer-head {
    padding: 16px 20px; border-bottom: 1px solid var(--gd-ink-100);
    display: flex; align-items: center; gap: 12px;
  }
  .gd-drawer-head .name { font-weight: 700; }
  .gd-drawer-head .sub  { font-size: 12px; color: var(--gd-ink-500); }
  .gd-drawer nav { flex: 1; overflow-y: auto; padding: 8px 0; }
  .gd-drawer nav a, .gd-drawer nav button {
    display: flex; align-items: center; gap: 12px;
    width: 100%; text-align: start; padding: 14px 20px;
    color: var(--gd-ink-900); text-decoration: none; font-weight: 600; font-size: 15px;
    background: transparent; border: 0; cursor: pointer; transition: background .15s;
  }
  .gd-drawer nav a:hover, .gd-drawer nav button:hover { background: var(--gd-ink-50); }
  .gd-drawer nav a.active { background: var(--gd-ink-50); color: var(--gd-teal-500); }
  .gd-drawer nav svg { width: 20px; height: 20px; color: var(--gd-ink-500); }
  .gd-drawer-sep { height: 1px; background: var(--gd-ink-100); margin: 8px 16px; }
  .gd-drawer-section {
    padding: 16px 20px 6px; font-size: 11px; font-weight: 700;
    color: var(--gd-ink-500); text-transform: uppercase; letter-spacing: 1.2px;
    border-top: 1px solid var(--gd-ink-100); margin-top: 4px;
  }
  .gd-drawer-section:first-child { border-top: 0; margin-top: 0; padding-top: 12px; }
  .gd-drawer-foot {
    padding: 16px 20px; border-top: 1px solid var(--gd-ink-100);
    display: grid; gap: 8px;
  }

  /* ── Responsive switches ── */
  @media (min-width: 768px) {
    .gd-nav-cta { display: inline-flex; }
    .gd-nav-burger { display: none; }
  }
  @media (min-width: 1024px) {
    .gd-nav-links { display: inline-flex; }
  }
  @media (max-width: 767.98px) {
    .gd-nav-cta-desk { display: none !important; }
    .gd-nav-bottom-cta { display: block; }
    body { padding-bottom: 84px; } /* room for the sticky CTA */
    .gd-nav-chips-hide-on-mobile { display: none !important; }
  }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // ─── Helpers ──────────────────────────────────────────────────────────
  const currentLang = () =>
    (window.I18N && I18N.lang) || localStorage.getItem('gd_lang') || 'en';
  const isAr = () => {
    const l = currentLang();
    return l === 'ar' || l === 'ur';   // both RTL
  };

  // Built-in dictionary for the navbar/drawer's most-visible strings —
  // covers all 10 supported languages so the top bar actually changes
  // when the user picks 中文 / Français / etc. Keys are the English text
  // so existing call sites don't need updating.
  const NAV_I18N = {
    'Find a Guide':  { ar:'ابحث عن مرشد', zh:'寻找导游',    hi:'गाइड खोजें',  es:'Buscar guía',     fr:'Trouver un guide', bn:'গাইড খুঁজুন', pt:'Encontrar guia',     ru:'Найти гида',      ur:'گائیڈ تلاش کریں' },
    'Plan a Trip':   { ar:'خطط رحلة',     zh:'规划行程',    hi:'यात्रा प्लान करें', es:'Planifica un viaje', fr:'Planifier un voyage', bn:'ভ্রমণ পরিকল্পনা', pt:'Planejar viagem',   ru:'Спланировать поездку', ur:'سفر کی منصوبہ بندی' },
    'Regions':       { ar:'المناطق',      zh:'地区',        hi:'क्षेत्र',          es:'Regiones',        fr:'Régions',           bn:'অঞ্চল',         pt:'Regiões',            ru:'Регионы',         ur:'علاقے' },
    'Trails':        { ar:'المسارات',     zh:'步道',        hi:'पगडंडियाँ',     es:'Senderos',        fr:'Sentiers',          bn:'পথ',           pt:'Trilhas',            ru:'Маршруты',        ur:'پیدل راستے' },
    'Blog':          { ar:'المدوّنة',     zh:'博客',        hi:'ब्लॉग',         es:'Blog',            fr:'Blog',              bn:'ব্লগ',          pt:'Blog',               ru:'Блог',            ur:'بلاگ' },
    'Home':          { ar:'الرئيسية',     zh:'首页',        hi:'मुख्य',         es:'Inicio',          fr:'Accueil',           bn:'হোম',          pt:'Início',             ru:'Главная',         ur:'صفحۂ اول' },
    'How It Works':  { ar:'كيف يعمل',     zh:'如何使用',    hi:'यह कैसे काम करता है', es:'Cómo funciona', fr:'Comment ça marche', bn:'কিভাবে কাজ করে', pt:'Como funciona', ru:'Как это работает', ur:'یہ کیسے کام کرتا ہے' },
    'Plan My Trip':  { ar:'خطط رحلتي',    zh:'规划我的行程', hi:'मेरी यात्रा प्लान करें', es:'Planificar mi viaje', fr:'Planifier mon voyage', bn:'আমার ভ্রমণ পরিকল্পনা', pt:'Planejar minha viagem', ru:'Спланировать поездку', ur:'میرا سفر' },
    'Sign In':       { ar:'تسجيل الدخول', zh:'登录',        hi:'लॉगिन',         es:'Iniciar sesión',  fr:'Connexion',         bn:'লগইন',         pt:'Entrar',             ru:'Вход',            ur:'لاگ اِن' },
    'Sign Up':       { ar:'إنشاء حساب',   zh:'注册',        hi:'साइन अप',       es:'Registrarse',     fr:"S'inscrire",        bn:'সাইন আপ',      pt:'Cadastrar',          ru:'Регистрация',     ur:'سائن اپ' },
    'Sign Out':      { ar:'تسجيل الخروج', zh:'退出登录',    hi:'लॉगआउट',        es:'Cerrar sesión',   fr:'Déconnexion',       bn:'লগআউট',        pt:'Sair',               ru:'Выйти',           ur:'لاگ آؤٹ' },
    'Notifications': { ar:'الإشعارات',    zh:'通知',        hi:'सूचनाएं',       es:'Notificaciones',  fr:'Notifications',     bn:'বিজ্ঞপ্তি',     pt:'Notificações',       ru:'Уведомления',     ur:'اطلاعات' },
    'Account':       { ar:'الحساب',       zh:'账户',        hi:'खाता',          es:'Cuenta',          fr:'Compte',            bn:'অ্যাকাউন্ট',   pt:'Conta',              ru:'Аккаунт',         ur:'اکاؤنٹ' },
    'Menu':          { ar:'القائمة',      zh:'菜单',        hi:'मेनू',          es:'Menú',            fr:'Menu',              bn:'মেনু',         pt:'Menu',               ru:'Меню',            ur:'مینو' },
    'Open menu':     { ar:'فتح القائمة',  zh:'打开菜单',    hi:'मेनू खोलें',    es:'Abrir menú',      fr:'Ouvrir le menu',    bn:'মেনু খুলুন',    pt:'Abrir menu',         ru:'Открыть меню',    ur:'مینو کھولیں' },
    'Close':         { ar:'إغلاق',        zh:'关闭',        hi:'बंद करें',      es:'Cerrar',          fr:'Fermer',            bn:'বন্ধ',         pt:'Fechar',             ru:'Закрыть',         ur:'بند کریں' },
    'Language':      { ar:'اللغة',        zh:'语言',        hi:'भाषा',          es:'Idioma',          fr:'Langue',            bn:'ভাষা',         pt:'Idioma',             ru:'Язык',            ur:'زبان' },
    'Currency':      { ar:'العملة',       zh:'货币',        hi:'मुद्रा',        es:'Moneda',          fr:'Devise',            bn:'মুদ্রা',        pt:'Moeda',              ru:'Валюта',          ur:'کرنسی' },
    'get a price quote': { ar:'اطلب عرض سعر', zh:'获取报价', hi:'मूल्य उद्धरण प्राप्त करें', es:'obtén un presupuesto', fr:'obtenir un devis', bn:'মূল্য উদ্ধৃতি পান', pt:'obter orçamento', ru:'получить расчёт', ur:'قیمت کا تخمینہ لیں' },
    'Browse':        { ar:'تصفّح',        zh:'浏览',        hi:'ब्राउज़ करें',  es:'Explorar',        fr:'Parcourir',         bn:'ব্রাউজ করুন',  pt:'Explorar',           ru:'Обзор',           ur:'براؤز کریں' },
  };

  // Resolve a translation in this priority:
  //   1. NAV_I18N dictionary for the current language (instant, no I18N dep)
  //   2. I18N.t(key) if a key is given (fallback path)
  //   3. The Arabic or English fallback from the call site
  const tr = (en, ar, key) => {
    const lang = currentLang();
    const dict = NAV_I18N[en];
    if (dict && dict[lang]) return dict[lang];
    if (key && window.I18N && typeof I18N.t === 'function') {
      const v = I18N.t(key);
      if (v && v !== key) return v;
    }
    return isAr() ? ar : en;
  };

  const path = location.pathname.replace(/\/$/, '') || '/';
  const isActive = (...patterns) => patterns.some(p =>
    p === '/' ? path === '/' || path === '' : path.startsWith(p)
  );

  function svg(name) {
    const icons = {
      bell:     '<path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0m6 0H9"/>',
      menu:     '<path d="M4 6h16M4 12h16M4 18h16"/>',
      close:    '<path d="M6 6l12 12M6 18L18 6"/>',
      user:     '<path d="M5.5 21a7 7 0 0 1 13 0"/><circle cx="12" cy="8" r="4"/>',
      globe:    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
      search:   '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
      logout:   '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
      dashboard:'<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
      map:      '<path d="M9 4v16M15 8v12M3 6l6-2 6 2 6-2v16l-6 2-6-2-6 2z"/>',
      sparkle:  '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
      heart:    '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
      bookings: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
      message:  '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
      plus:     '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
      tour:     '<path d="M3 6l9-4 9 4-9 4-9-4z"/><path d="M3 12l9 4 9-4M3 18l9 4 9-4"/>',
      star:     '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
      chart:    '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
      calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
      camera:   '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
      building: '<rect x="4" y="2" width="16" height="20" rx="1"/><line x1="9" y1="22" x2="9" y2="18"/><line x1="15" y1="22" x2="15" y2="18"/><line x1="8" y1="6" x2="10" y2="6"/><line x1="14" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="14" y1="14" x2="16" y2="14"/>',
      help:     '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
      settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
      shield:   '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
      megaphone:'<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
      palette:  '<circle cx="13.5" cy="6.5" r="0.5"/><circle cx="17.5" cy="10.5" r="0.5"/><circle cx="8.5" cy="7.5" r="0.5"/><circle cx="6.5" cy="12.5" r="0.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c3.31 0 6-2.69 6-6 0-4.96-4.49-9-10-9z"/>',
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${icons[name] || ''}</svg>`;
  }

  // Per-role menu sections — returns array of { label, href, icon }.
  // Anyone can navigate to any URL by typing it; this menu just surfaces
  // the actions each role uses most often.
  function actionsForRole(user) {
    if (!user) return [];
    const t = user.userType;

    const common = [
      { label: tr('My Dashboard', 'لوحتي'),     href: dashboardFor(user), icon: 'dashboard' },
      { label: tr('My Profile',   'ملفي الشخصي'), href: '/profile.html',   icon: 'user' },
      { label: tr('Notifications','الإشعارات'),  href: '/notifications.html', icon: 'bell' },
    ];

    const tourist = [
      { label: tr('My Bookings','حجوزاتي'),                href: '/tourist-dashboard.html#bookings', icon: 'bookings' },
      { label: tr('Saved Guides','المرشدون المحفوظون'),    href: '/wishlist.html', icon: 'heart' },
      { label: tr('Find a Guide','ابحث عن مرشد','nav_find'),          href: '/search.html', icon: 'search' },
      { label: tr('Plan a Trip','خطط رحلة'),               href: '/plan-trip.html', icon: 'sparkle' },
    ];

    const guide = [
      { label: tr('My Public Profile','ملفي العام (للسياح)'), href: '/guide-profile.html?id=' + user.id, icon: 'building' },
      { label: tr('Add a New Tour','إضافة رحلة جديدة'),       href: '/guide-dashboard.html#tours',        icon: 'plus' },
      { label: tr('My Tours','رحلاتي'),                       href: '/guide-dashboard.html#tours',        icon: 'tour' },
      { label: tr('Bookings','الحجوزات'),                     href: '/guide-dashboard.html#bookings',     icon: 'bookings' },
      { label: tr('Reviews','التقييمات'),                     href: '/guide-dashboard.html#reviews',      icon: 'star' },
      { label: tr('Availability','مواعيد التوفّر'),           href: '/guide-dashboard.html#availability', icon: 'calendar' },
      { label: tr('My Gallery','معرضي'),                      href: '/guide-dashboard.html#gallery',      icon: 'camera' },
    ];

    const company = [
      { label: tr('My Public Profile','ملف الشركة (للسياح)'), href: '/company-profile.html?id=' + user.id, icon: 'building' },
      { label: tr('Add a Tour Package','إضافة حزمة سياحية'),   href: '/company-dashboard.html#add',        icon: 'plus' },
      { label: tr('My Packages','حزمي السياحية'),              href: '/company-dashboard.html#packages',   icon: 'tour' },
      { label: tr('Reviews','التقييمات'),                       href: '/company-dashboard.html#reviews',    icon: 'star' },
    ];

    const admin = [
      { label: tr('Admin Panel','لوحة الإدارة'),               href: '/admin.html',                icon: 'shield' },
      { label: tr('Homepage Manager','إدارة الصفحة الرئيسية'), href: '/admin-homepage.html',       icon: 'palette' },
      { label: tr('Marketing Kit','أدوات التسويق'),            href: '/marketing/',                icon: 'megaphone' },
      { label: tr('Analytics','الإحصائيات'),                   href: '/admin.html#analytics',      icon: 'chart' },
      { label: tr('All Bookings','كل الحجوزات'),               href: '/admin.html#bookings',       icon: 'bookings' },
      { label: tr('Manage Users','إدارة المستخدمين'),           href: '/admin.html#users',          icon: 'user' },
    ];

    const support = [
      { label: tr('Contact Support','تواصل مع الدعم'), href: '/contact.html', icon: 'message' },
      { label: tr('How It Works','كيف يعمل'),          href: '/how-it-works.html', icon: 'help' },
    ];

    let role = [];
    if (t === 'tourist') role = tourist;
    else if (t === 'guide') role = guide;
    else if (t === 'company') role = company;

    const out = [
      { section: tr('My Account','حسابي'),     items: common },
    ];
    if (role.length) out.push({ section: tr('Quick Actions','إجراءات سريعة'), items: role });
    if (t === 'admin' || t === 'staff') out.push({ section: tr('Admin Tools','أدوات الإدارة'), items: admin });
    out.push({ section: tr('Help','مساعدة'), items: support });
    return out;
  }

  function renderMenuSections(sections, kind) {
    // kind: 'menu' (compact dropdown) or 'drawer' (mobile full list)
    return sections.map(sec => {
      const items = sec.items.map(it => `
        <a href="${it.href}">${svg(it.icon)} ${it.label}</a>
      `).join('');
      if (kind === 'menu') {
        return `<div class="menu-section-label">${sec.section}</div>${items}`;
      }
      return `<div class="gd-drawer-section">${sec.section}</div>${items}`;
    }).join('');
  }

  // ─── Build the DOM ────────────────────────────────────────────────────
  function buildNav() {
    const nav = document.createElement('header');
    nav.className = 'gd-nav';
    nav.innerHTML = `
      <div class="gd-nav-inner">
        <button class="gd-nav-icon-btn gd-nav-burger" id="gdNavBurger" aria-label="${tr('Open menu','فتح القائمة')}">${svg('menu')}</button>

        <a class="gd-nav-brand" href="/">
          <img src="/logo.png" alt="Guideon">
          <span>Guideon</span>
        </a>

        <nav class="gd-nav-links" id="gdNavLinks">
          <a href="/search.html"      data-key="find">${tr('Find a Guide','ابحث عن مرشد','nav_find')}</a>
          <a href="/regions.html"     data-key="regions">${tr('Regions','المناطق')}</a>
          <a href="/trails.html"      data-key="trails">${tr('Trails','المسارات')}</a>
          <a href="/plan-trip.html"   data-key="plan">${tr('Plan a Trip','خطط رحلة')}</a>
          <a href="/blog.html"        data-key="blog">${tr('Blog','المدوّنة')}</a>
        </nav>

        <a class="gd-nav-cta gd-nav-cta-desk" href="/plan-trip.html">
          ✨ ${tr('Plan My Trip','خطط رحلتي')}
        </a>

        <div class="gd-nav-utils">
          <div class="gd-nav-chips-hide-on-mobile" style="display:inline-flex;gap:6px;align-items:center">
            <label class="gd-nav-chip" title="${tr('Language','اللغة')}">
              ${svg('globe')}
              <select id="gdNavLang">
                ${(window.I18N && window.I18N.languages || [
                  {code:'en',native:'English',flag:'🇬🇧'},{code:'ar',native:'العربية',flag:'🇴🇲'},
                  {code:'zh',native:'中文',flag:'🇨🇳'},{code:'hi',native:'हिन्दी',flag:'🇮🇳'},
                  {code:'es',native:'Español',flag:'🇪🇸'},{code:'fr',native:'Français',flag:'🇫🇷'},
                  {code:'bn',native:'বাংলা',flag:'🇧🇩'},{code:'pt',native:'Português',flag:'🇵🇹'},
                  {code:'ru',native:'Русский',flag:'🇷🇺'},{code:'ur',native:'اردو',flag:'🇵🇰'}])
                  .map(l => `<option value="${l.code}">${l.flag} ${l.native}</option>`).join('')}
              </select>
            </label>
            <label class="gd-nav-chip" title="${tr('Currency','العملة')}">
              <span>💰</span>
              <select id="gdNavCurrency">
                <option value="OMR">OMR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </label>
          </div>

          <button class="gd-nav-icon-btn" id="gdNavBell" aria-label="${tr('Notifications','الإشعارات')}" style="display:none">
            ${svg('bell')}
          </button>

          <button class="gd-nav-icon-btn" id="gdNavAvatarWrap" aria-label="${tr('Account','الحساب')}">
            <span class="gd-nav-avatar" id="gdNavAvatar">${svg('user')}</span>
          </button>
        </div>
      </div>
    `;

    const bottom = document.createElement('div');
    bottom.className = 'gd-nav-bottom-cta';
    bottom.innerHTML = `<a href="/plan-trip.html">✨ ${tr('Plan My Trip','خطط رحلتي')} <span style="opacity:.85;font-weight:500;font-size:13px">— ${tr('get a price quote','اطلب عرض سعر')}</span></a>`;
    return { nav, bottom };
  }

  function buildDrawer(user) {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="gd-drawer-backdrop" id="gdDrawerBack"></div>
      <aside class="gd-drawer" id="gdDrawer" role="dialog" aria-label="${tr('Menu','القائمة')}">
        <div class="gd-drawer-head">
          <div class="gd-nav-avatar" style="background:var(--gd-ink-100);color:var(--gd-ink-700)">${avatarHTML(user)}</div>
          <div style="flex:1">
            <div class="name">${user ? escapeHtml(user.fullName || user.companyName || user.email) : tr('Welcome','مرحباً بك')}</div>
            <div class="sub">${user ? userTypeLabel(user.userType) : tr('Sign in to get started','سجّل دخولك للبدء')}</div>
          </div>
          <button class="gd-nav-icon-btn" id="gdDrawerClose" aria-label="${tr('Close','إغلاق')}" style="color:var(--gd-ink-700)">${svg('close')}</button>
        </div>
        <nav id="gdDrawerNav">
          <!-- Browse — visible to everyone -->
          <div class="gd-drawer-section">${tr('Browse','تصفّح')}</div>
          <a href="/"               ${activeAttr('/')}><span style="font-size:18px">🏠</span> ${tr('Home','الرئيسية')}</a>
          <a href="/search.html"    ${activeAttr('/search')}>${svg('search')} ${tr('Find a Guide','ابحث عن مرشد','nav_find')}</a>
          <a href="/regions.html"   ${activeAttr('/regions')}>${svg('map')} ${tr('Explore Regions','استكشف المناطق')}</a>
          <a href="/trails.html"    ${activeAttr('/trails')}>${svg('sparkle')} ${tr('Hiking Trails','مسارات المشي')}</a>
          <a href="/plan-trip.html" ${activeAttr('/plan-trip')}>${svg('sparkle')} ${tr('Plan a Trip','خطط رحلة')}</a>
          <a href="/blog.html"      ${activeAttr('/blog')}>${svg('star')} ${tr('Blog','المدوّنة')}</a>
          <a href="/how-it-works.html">${svg('map')} ${tr('How It Works','كيف يعمل')}</a>
          <a href="/cancellation.html">${svg('shield')} ${tr('Cancellation','سياسة الإلغاء')}</a>
          <!-- Role-tailored sections -->
          ${user ? renderMenuSections(actionsForRole(user), 'drawer') : ''}
        </nav>
        <div class="gd-drawer-foot">
          <div style="display:flex;gap:8px">
            <label class="gd-nav-chip" style="flex:1;justify-content:center;background:var(--gd-ink-50);color:var(--gd-ink-900);border-color:var(--gd-ink-100)">
              ${svg('globe')}
              <select id="gdDrawerLang" style="color:var(--gd-ink-900);width:100%">
                ${(window.I18N && window.I18N.languages || [
                  {code:'en',native:'English',flag:'🇬🇧'},{code:'ar',native:'العربية',flag:'🇴🇲'},
                  {code:'zh',native:'中文',flag:'🇨🇳'},{code:'hi',native:'हिन्दी',flag:'🇮🇳'},
                  {code:'es',native:'Español',flag:'🇪🇸'},{code:'fr',native:'Français',flag:'🇫🇷'},
                  {code:'bn',native:'বাংলা',flag:'🇧🇩'},{code:'pt',native:'Português',flag:'🇵🇹'},
                  {code:'ru',native:'Русский',flag:'🇷🇺'},{code:'ur',native:'اردو',flag:'🇵🇰'}])
                  .map(l => `<option value="${l.code}">${l.flag} ${l.native}</option>`).join('')}
              </select>
            </label>
            <label class="gd-nav-chip" style="flex:1;justify-content:center;background:var(--gd-ink-50);color:var(--gd-ink-900);border-color:var(--gd-ink-100)">
              <span>💰</span>
              <select id="gdDrawerCurrency" style="color:var(--gd-ink-900);width:100%">
                <option value="OMR">OMR</option><option value="USD">USD</option>
                <option value="EUR">EUR</option><option value="GBP">GBP</option>
              </select>
            </label>
          </div>
          ${user
            ? `<button class="btn btn-outline-secondary" id="gdDrawerLogout">${svg('logout')} ${tr('Sign Out','تسجيل الخروج')}</button>`
            : `<a href="/login.html" class="btn" style="background:var(--gd-teal-500);color:#fff;font-weight:700;border-radius:10px;padding:10px;text-align:center;text-decoration:none">${tr('Sign In','تسجيل الدخول')}</a>
               <a href="/register.html" class="btn" style="background:#fff;color:var(--gd-teal-500);border:1.5px solid var(--gd-teal-500);font-weight:700;border-radius:10px;padding:10px;text-align:center;text-decoration:none">${tr('Create Account','إنشاء حساب')}</a>`}
        </div>
      </aside>
    `;
    return wrap;
  }

  function escapeHtml(s) { return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  // Operator-precedence bug: previously `&&` bound tighter than `||` so '/'
  // matched every page. Parens make the intent explicit: exact match for the
  // home page, prefix match for everything else.
  function activeAttr(p) {
    const match = (p === '/') ? (path === '/') : path.startsWith(p);
    return match ? 'class="active"' : '';
  }
  function userTypeLabel(t) {
    return ({
      tourist:  tr('Tourist','سائح'),
      guide:    tr('Tour Guide','مرشد سياحي'),
      company:  tr('Tourism Company','شركة سياحية'),
      admin:    tr('Administrator','مدير'),
      staff:    tr('Staff','موظف'),
    })[t] || '';
  }
  function dashboardFor(user) {
    return ({
      tourist:  '/tourist-dashboard.html',
      guide:    '/guide-dashboard.html',
      company:  '/company-dashboard.html',
      admin:    '/admin.html',
      staff:    '/admin.html',
    })[user.userType] || '/';
  }
  function avatarHTML(user) {
    if (!user) return svg('user');
    if (user.photo) return `<img src="${escapeHtml(user.photo)}" alt="">`;
    const name = user.fullName || user.companyName || user.email || '?';
    return name.trim().split(/\s+/).slice(0,2).map(s => s[0] || '').join('').toUpperCase();
  }

  // ─── Profile menu (avatar dropdown) ──────────────────────────────────
  function toggleProfileMenu(user) {
    const existing = document.getElementById('gdProfileMenu');
    if (existing) { existing.remove(); return; }
    const menu = document.createElement('div');
    menu.id = 'gdProfileMenu';
    menu.style.cssText = `
      position: fixed; z-index: 1050;
      top: 60px; inset-inline-end: 16px;
      background: #fff; color: var(--gd-ink-900);
      border-radius: 12px; min-width: 260px; max-width: 300px;
      max-height: calc(100vh - 80px); overflow-y: auto;
      box-shadow: var(--gd-shadow-lg);
      border: 1px solid var(--gd-ink-100);
      animation: gdMenuFadeIn .15s ease;
    `;
    if (!document.getElementById('gdMenuStyle')) {
      const s = document.createElement('style');
      s.id = 'gdMenuStyle';
      s.textContent = `
        @keyframes gdMenuFadeIn { from { opacity:0; transform:translateY(-6px) } to { opacity:1; transform:translateY(0) } }
        #gdProfileMenu a, #gdProfileMenu button {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 18px; text-decoration: none;
          color: var(--gd-ink-900); font-weight: 600; font-size: 14px;
          width: 100%; text-align: start; border: 0; background: transparent;
          cursor: pointer; transition: background .15s;
        }
        #gdProfileMenu a:hover, #gdProfileMenu button:hover { background: var(--gd-ink-50); }
        #gdProfileMenu svg { width: 18px; height: 18px; color: var(--gd-ink-500); }
        #gdProfileMenu .head {
          padding: 14px 18px; background: var(--gd-ink-50); border-bottom: 1px solid var(--gd-ink-100);
        }
        #gdProfileMenu .head .name { font-weight: 700; font-size: 14px; }
        #gdProfileMenu .head .sub  { font-size: 12px; color: var(--gd-ink-500); margin-top: 2px; }
        #gdProfileMenu .sep { height: 1px; background: var(--gd-ink-100); margin: 4px 0; }
        #gdProfileMenu .danger { color: var(--gd-danger, #dc2626); }
        #gdProfileMenu .danger svg { color: var(--gd-danger, #dc2626); }
        #gdProfileMenu .menu-section-label {
          padding: 12px 18px 4px; font-size: 10px; font-weight: 800;
          color: var(--gd-ink-500); text-transform: uppercase; letter-spacing: 1.2px;
          border-top: 1px solid var(--gd-ink-100); margin-top: 4px;
          background: rgba(247,248,250,.6);
        }
        #gdProfileMenu .menu-section-label:first-of-type { border-top: 0; margin-top: 0; }
      `;
      document.head.appendChild(s);
    }
    menu.innerHTML = `
      <div class="head">
        <div class="name">${escapeHtml(user.fullName || user.companyName || user.email)}</div>
        <div class="sub">${userTypeLabel(user.userType)}</div>
      </div>
      ${renderMenuSections(actionsForRole(user), 'menu')}
      <div class="sep"></div>
      <button id="gdMenuLogout" class="danger">${svg('logout')} ${tr('Sign Out','تسجيل الخروج')}</button>
    `;
    document.body.appendChild(menu);
    // Close when clicking elsewhere
    setTimeout(() => {
      const handler = (ev) => {
        if (!menu.contains(ev.target) && ev.target.id !== 'gdNavAvatarWrap') {
          menu.remove();
          document.removeEventListener('click', handler);
        }
      };
      document.addEventListener('click', handler);
    }, 0);
    document.getElementById('gdMenuLogout').addEventListener('click', async () => {
      try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch {}
      location.href = '/';
    });
  }

  // ─── Mount ────────────────────────────────────────────────────────────
  async function mount() {
    // Hide (not remove) legacy navbars so any inline scripts that still
    // reference their IDs (e.g. navName, navAuth, navUser) keep working,
    // and any action buttons hidden inside them stay queryable.
    document.querySelectorAll('body > nav, body > .navbar, body > header.navbar').forEach(el => {
      el.style.display = 'none';
      el.setAttribute('aria-hidden', 'true');
    });

    const { nav, bottom } = buildNav();
    document.body.insertBefore(nav, document.body.firstChild);
    document.body.appendChild(bottom);

    // Signal to gd-instant.css that the real navbar is now mounted —
    // removes the placeholder background and the reserved padding so the
    // actual navbar (which has its own fixed position + spacing) takes over
    // without a layout shift.
    document.body.classList.add('gd-navbar-ready');

    // Highlight active page in primary links
    nav.querySelectorAll('.gd-nav-links a').forEach(a => {
      const href = a.getAttribute('href');
      if (href && (path === href || path.startsWith(href.replace(/\.html$/, '')))) a.classList.add('active');
    });

    // Language / currency syncing. The lang whitelist must be derived
    // AT CLICK TIME (not at mount time) because i18n.js can load after
    // the navbar — if we snapshot too early the list is just ['en','ar']
    // and every new language gets rejected silently.
    const STATIC_LANGS = ['en','ar','zh','hi','es','fr','bn','pt','ru','ur'];
    const allowedLangs = () => new Set(
      (window.I18N && window.I18N.languages || []).map(l => l.code).concat(STATIC_LANGS)
    );
    const ALLOWED_CUR  = new Set(['OMR', 'USD', 'EUR', 'GBP']);
    const rawLang = localStorage.getItem('gd_lang');
    const rawCur  = localStorage.getItem('gd_currency');
    const lang = allowedLangs().has(rawLang) ? rawLang : 'en';
    const cur  = ALLOWED_CUR.has(rawCur)   ? rawCur  : 'OMR';
    const langSel = document.getElementById('gdNavLang');
    const curSel  = document.getElementById('gdNavCurrency');
    if (langSel) langSel.value = lang;
    if (curSel)  curSel.value  = cur;
    langSel?.addEventListener('change', e => {
      const v = e.target.value;
      if (!allowedLangs().has(v)) return;
      localStorage.setItem('gd_lang', v);
      // For any language other than the current one, reload — guarantees
      // the navbar, hero, About section etc. all re-render in the new
      // language regardless of I18N readiness.
      if (window.I18N && typeof I18N.setLang === 'function') {
        I18N.setLang(v);
        // Hard reload as a belt-and-braces for non-bilingual targets
        if (v !== 'en' && v !== 'ar') setTimeout(() => location.reload(), 80);
      } else {
        location.reload();
      }
    });
    curSel?.addEventListener('change', e => {
      localStorage.setItem('gd_currency', e.target.value);
      if (window.onCurrencyChange) try { window.onCurrencyChange(e.target.value); } catch {}
      else location.reload();
    });

    // Load session for avatar + drawer state — reuse the shared session
    // promise from common-widgets so we don't double-fetch /auth/me.
    let user = null;
    try {
      if (window.gdSession) user = await window.gdSession.get();
      else {
        const r = await fetch('/api/auth/me', { credentials: 'include' });
        if (r.ok) { const d = await r.json(); user = d.user || null; }
      }
    } catch {}

    if (user) {
      const av = document.getElementById('gdNavAvatar');
      av.innerHTML = avatarHTML(user);
      document.getElementById('gdNavAvatarWrap').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleProfileMenu(user);
      });
    } else {
      document.getElementById('gdNavAvatarWrap').addEventListener('click', () => {
        location.href = '/login.html';
      });
    }

    // Drawer
    const drawerWrap = buildDrawer(user);
    document.body.appendChild(drawerWrap);
    const back = document.getElementById('gdDrawerBack');
    const drawer = document.getElementById('gdDrawer');
    const openDrawer  = () => { if (back && drawer) { back.classList.add('open'); drawer.classList.add('open'); document.body.style.overflow = 'hidden'; } };
    const closeDrawer = () => { if (back && drawer) { back.classList.remove('open'); drawer.classList.remove('open'); document.body.style.overflow = ''; } };
    // Direct bind (fast path)
    document.getElementById('gdNavBurger')?.addEventListener('click', openDrawer);
    document.getElementById('gdDrawerClose')?.addEventListener('click', closeDrawer);
    back?.addEventListener('click', closeDrawer);
    // Defensive event delegation: even if the direct bind above is lost
    // (a script error before/after, re-render, etc.) any tap that lands
    // on the burger button still opens the drawer. Survives DOM swaps.
    document.addEventListener('click', (e) => {
      const t = e.target;
      if (!t) return;
      if (t.closest && t.closest('#gdNavBurger')) { e.preventDefault(); openDrawer(); }
      else if (t.closest && t.closest('#gdDrawerClose')) { e.preventDefault(); closeDrawer(); }
    }, { passive: false });
    // ESC closes the drawer
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

    // Drawer lang/currency mirror
    const dLang = document.getElementById('gdDrawerLang');
    const dCur  = document.getElementById('gdDrawerCurrency');
    if (dLang) { dLang.value = lang; dLang.addEventListener('change', e => {
      const v = e.target.value;
      if (!allowedLangs().has(v)) return;
      localStorage.setItem('gd_lang', v);
      if (window.I18N && typeof I18N.setLang === 'function') {
        I18N.setLang(v);
        if (v !== 'en' && v !== 'ar') setTimeout(() => location.reload(), 80);
      } else location.reload();
    }); }
    if (dCur)  { dCur.value  = cur;  dCur.addEventListener('change',  e => { localStorage.setItem('gd_currency', e.target.value); location.reload(); }); }

    // Logout
    const lg = document.getElementById('gdDrawerLogout');
    if (lg) lg.addEventListener('click', async () => {
      try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch {}
      location.href = '/';
    });

    // Show the bell only if logged in; let notifications.js take over rendering
    const bell = document.getElementById('gdNavBell');
    if (user && bell) {
      bell.style.display = 'inline-flex';
      // notifications.js adopts this bell and exposes gdToggleNotifPanel to open
      // the dropdown. Fall back to the full page only if that script hasn't
      // loaded yet (e.g. very first click before init).
      bell.addEventListener('click', (e) => {
        if (typeof window.gdToggleNotifPanel === 'function') window.gdToggleNotifPanel(e);
        else location.href = '/notifications.html';
      });
    }

    // Sync <html dir/lang>
    document.documentElement.lang = lang;
    document.documentElement.dir  = (lang === 'ar') ? 'rtl' : 'ltr';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
