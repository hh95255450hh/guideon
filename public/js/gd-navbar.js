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
  const isAr = () =>
    (window.I18N && I18N.lang) ? I18N.lang === 'ar' :
    (localStorage.getItem('gd_lang') === 'ar');

  const tr = (en, ar) => isAr() ? ar : en;

  const path = location.pathname.replace(/\/$/, '') || '/';
  const isActive = (...patterns) => patterns.some(p =>
    p === '/' ? path === '/' || path === '' : path.startsWith(p)
  );

  function svg(name) {
    const icons = {
      bell:   '<path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0m6 0H9"/>',
      menu:   '<path d="M4 6h16M4 12h16M4 18h16"/>',
      close:  '<path d="M6 6l12 12M6 18L18 6"/>',
      user:   '<path d="M5.5 21a7 7 0 0 1 13 0"/><circle cx="12" cy="8" r="4"/>',
      globe:  '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
      search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
      logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
      dashboard:'<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
      map:    '<path d="M9 4v16M15 8v12M3 6l6-2 6 2 6-2v16l-6 2-6-2-6 2z"/>',
      sparkle:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${icons[name] || ''}</svg>`;
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
          <a href="/search.html"      data-key="find">${tr('Find a Guide','ابحث عن مرشد')}</a>
          <a href="/plan-trip.html"   data-key="plan">${tr('Plan a Trip','خطط رحلة')}</a>
          <a href="/how-it-works.html" data-key="how">${tr('How It Works','كيف يعمل')}</a>
        </nav>

        <a class="gd-nav-cta gd-nav-cta-desk" href="/plan-trip.html">
          ✨ ${tr('Plan My Trip','خطط رحلتي')}
        </a>

        <div class="gd-nav-utils">
          <div class="gd-nav-chips-hide-on-mobile" style="display:inline-flex;gap:6px;align-items:center">
            <label class="gd-nav-chip" title="${tr('Language','اللغة')}">
              ${svg('globe')}
              <select id="gdNavLang">
                <option value="en">EN</option>
                <option value="ar">عربي</option>
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
          <a href="/"               ${activeAttr('/')}><span style="font-size:18px">🏠</span> ${tr('Home','الرئيسية')}</a>
          <a href="/search.html"    ${activeAttr('/search')}>${svg('search')} ${tr('Find a Guide','ابحث عن مرشد')}</a>
          <a href="/plan-trip.html" ${activeAttr('/plan-trip')}>${svg('sparkle')} ${tr('Plan a Trip','خطط رحلة')}</a>
          <a href="/how-it-works.html">${svg('map')} ${tr('How It Works','كيف يعمل')}</a>
          ${user ? `
            <div class="gd-drawer-sep"></div>
            <a href="${dashboardFor(user)}">${svg('dashboard')} ${tr('My Dashboard','لوحتي')}</a>
            <a href="/profile.html">${svg('user')} ${tr('My Profile','ملفي الشخصي')}</a>
            <a href="/notifications.html">${svg('bell')} ${tr('Notifications','الإشعارات')}</a>
            ${user.userType === 'tourist' ? `<a href="/wishlist.html"><span style="font-size:18px">❤️</span> ${tr('Saved Guides','المرشدون المحفوظون')}</a>` : ''}
            <a href="/contact.html"><span style="font-size:18px">💬</span> ${tr('Contact Support','تواصل مع الدعم')}</a>
          ` : ''}
        </nav>
        <div class="gd-drawer-foot">
          <div style="display:flex;gap:8px">
            <label class="gd-nav-chip" style="flex:1;justify-content:center;background:var(--gd-ink-50);color:var(--gd-ink-900);border-color:var(--gd-ink-100)">
              ${svg('globe')}
              <select id="gdDrawerLang" style="color:var(--gd-ink-900);width:100%">
                <option value="en">English</option>
                <option value="ar">العربية</option>
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
  function activeAttr(p) { return path.startsWith(p) && p !== '/' || path === p ? 'class="active"' : ''; }
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
      border-radius: 12px; min-width: 240px;
      box-shadow: var(--gd-shadow-lg);
      overflow: hidden; border: 1px solid var(--gd-ink-100);
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
      `;
      document.head.appendChild(s);
    }
    menu.innerHTML = `
      <div class="head">
        <div class="name">${escapeHtml(user.fullName || user.companyName || user.email)}</div>
        <div class="sub">${userTypeLabel(user.userType)}</div>
      </div>
      <a href="${dashboardFor(user)}">${svg('dashboard')} ${tr('My Dashboard','لوحتي')}</a>
      <a href="/profile.html">${svg('user')} ${tr('My Profile','ملفي الشخصي')}</a>
      <a href="/notifications.html">${svg('bell')} ${tr('Notifications','الإشعارات')}</a>
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

    // Highlight active page in primary links
    nav.querySelectorAll('.gd-nav-links a').forEach(a => {
      const href = a.getAttribute('href');
      if (href && (path === href || path.startsWith(href.replace(/\.html$/, '')))) a.classList.add('active');
    });

    // Language / currency syncing
    const lang = (localStorage.getItem('gd_lang') || 'en');
    const cur  = (localStorage.getItem('gd_currency') || 'OMR');
    const langSel = document.getElementById('gdNavLang');
    const curSel  = document.getElementById('gdNavCurrency');
    if (langSel) langSel.value = lang;
    if (curSel)  curSel.value  = cur;
    langSel?.addEventListener('change', e => {
      localStorage.setItem('gd_lang', e.target.value);
      if (window.I18N && I18N.set) I18N.set(e.target.value);
      else location.reload();
    });
    curSel?.addEventListener('change', e => {
      localStorage.setItem('gd_currency', e.target.value);
      if (window.onCurrencyChange) try { window.onCurrencyChange(e.target.value); } catch {}
      else location.reload();
    });

    // Load session for avatar + drawer state
    let user = null;
    try {
      const r = await fetch('/api/auth/me', { credentials: 'include' });
      if (r.ok) { const d = await r.json(); user = d.user || null; }
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
    const openDrawer  = () => { back.classList.add('open'); drawer.classList.add('open'); };
    const closeDrawer = () => { back.classList.remove('open'); drawer.classList.remove('open'); };
    document.getElementById('gdNavBurger').addEventListener('click', openDrawer);
    document.getElementById('gdDrawerClose').addEventListener('click', closeDrawer);
    back.addEventListener('click', closeDrawer);

    // Drawer lang/currency mirror
    const dLang = document.getElementById('gdDrawerLang');
    const dCur  = document.getElementById('gdDrawerCurrency');
    if (dLang) { dLang.value = lang; dLang.addEventListener('change', e => { localStorage.setItem('gd_lang', e.target.value); location.reload(); }); }
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
      bell.addEventListener('click', () => location.href = '/notifications.html');
    }

    // Sync <html dir/lang>
    document.documentElement.lang = lang;
    document.documentElement.dir  = (lang === 'ar') ? 'rtl' : 'ltr';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
