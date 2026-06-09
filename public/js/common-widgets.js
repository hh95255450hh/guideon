/**
 * Site-wide widgets: WhatsApp floating button + Cookie consent banner.
 * Auto-injects into every page that includes this script.
 */
(function () {
  'use strict';

  const WHATSAPP_NUMBER = '96895255450';
  const COOKIE_KEY = 'guideon-cookie-consent-v1';

  // ─── Shared session cache ────────────────────────────────────────────
  // Multiple scripts (navbar, notifications, verify banner) all need to
  // know if the user is signed in. Without coordination they each fire
  // GET /api/auth/me on every page load — 3+ duplicate round-trips. This
  // exposes a single promise everyone reuses.
  window.gdSession = window.gdSession || (function () {
    let promise = null;
    return {
      get() {
        if (!promise) {
          promise = fetch('/api/auth/me', { credentials: 'include' })
            .then(r => r.ok ? r.json() : null)
            .then(d => (d && d.user) ? d.user : null)
            .catch(() => null);
        }
        return promise;
      },
      invalidate() { promise = null; },
    };
  })();

  // ─── Inject CSS once ──────────────────────────────────────────────────
  const css = `
    .gd-wa-btn {
      position: fixed; bottom: 24px; right: 24px; z-index: 9998;
      width: 56px; height: 56px; border-radius: 50%;
      background: #25D366; color: #fff; border: none;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 16px rgba(37,211,102,0.5);
      cursor: pointer; transition: transform .2s, box-shadow .2s;
      font-size: 28px;
    }
    .gd-wa-btn:hover { transform: scale(1.08); box-shadow: 0 6px 22px rgba(37,211,102,0.7); }
    .gd-wa-btn::after {
      content: ''; position: absolute; inset: -4px; border-radius: 50%;
      border: 3px solid rgba(37,211,102,0.4); animation: gdWaPulse 2s infinite;
    }
    @keyframes gdWaPulse { 0%{transform:scale(1);opacity:1} 100%{transform:scale(1.4);opacity:0} }
    @media (max-width: 576px) {
      .gd-wa-btn { width: 50px; height: 50px; bottom: 16px; right: 16px; font-size: 24px; }
    }
    html[dir="rtl"] .gd-wa-btn { right: auto; left: 24px; }
    @media (max-width: 576px) {
      html[dir="rtl"] .gd-wa-btn { left: 16px; }
    }

    /* Contact / Email floating button — sits above the WhatsApp button */
    .gd-contact-btn {
      position: fixed; bottom: 92px; right: 24px; z-index: 9998;
      width: 56px; height: 56px; border-radius: 50%;
      background: linear-gradient(135deg, #0f7b6c, #1abc9c); color: #fff; border: none;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 16px rgba(15,123,108,0.45);
      cursor: pointer; transition: transform .2s, box-shadow .2s;
      text-decoration: none;
    }
    .gd-contact-btn:hover { transform: scale(1.08); box-shadow: 0 6px 22px rgba(15,123,108,0.65); color: #fff; }
    .gd-contact-btn .gd-contact-label {
      position: absolute; right: 66px; background: #0f1c3e; color: #fff;
      padding: 6px 12px; border-radius: 8px; font-size: .82rem; font-weight: 700;
      white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity .2s, transform .2s;
      transform: translateX(6px);
    }
    .gd-contact-btn:hover .gd-contact-label { opacity: 1; transform: translateX(0); }
    .gd-contact-btn .gd-contact-label::after {
      content: ''; position: absolute; top: 50%; right: -5px; transform: translateY(-50%);
      border: 5px solid transparent; border-left-color: #0f1c3e;
    }
    @media (max-width: 576px) {
      .gd-contact-btn { width: 50px; height: 50px; bottom: 76px; right: 16px; }
      .gd-contact-btn .gd-contact-label { display: none; }
    }
    html[dir="rtl"] .gd-contact-btn { right: auto; left: 24px; }
    html[dir="rtl"] .gd-contact-btn .gd-contact-label {
      right: auto; left: 66px; transform: translateX(-6px);
    }
    html[dir="rtl"] .gd-contact-btn:hover .gd-contact-label { transform: translateX(0); }
    html[dir="rtl"] .gd-contact-btn .gd-contact-label::after {
      right: auto; left: -5px; border-left-color: transparent; border-right-color: #0f1c3e;
    }
    @media (max-width: 576px) {
      html[dir="rtl"] .gd-contact-btn { left: 16px; }
    }

    .gd-cookie-bar {
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 9999;
      background: #fff; border-top: 3px solid #0f7b6c;
      box-shadow: 0 -4px 24px rgba(0,0,0,.15);
      padding: 16px 20px; transform: translateY(100%);
      transition: transform .35s ease;
    }
    .gd-cookie-bar.visible { transform: translateY(0); }
    .gd-cookie-inner {
      max-width: 1100px; margin: 0 auto;
      display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
    }
    .gd-cookie-text { flex: 1; min-width: 280px; font-size: .88rem; color: #333; line-height: 1.5; }
    .gd-cookie-text a { color: #0f7b6c; font-weight: 600; }
    .gd-cookie-actions { display: flex; gap: 8px; }
    .gd-cookie-btn { padding: 8px 18px; border-radius: 8px; border: none; font-weight: 700; font-size: .85rem; cursor: pointer; transition: .15s; }
    .gd-cookie-btn.accept { background: #0f7b6c; color: #fff; }
    .gd-cookie-btn.accept:hover { background: #0a5c50; }
    .gd-cookie-btn.essential { background: #f0f0f0; color: #333; }
    .gd-cookie-btn.essential:hover { background: #e0e0e0; }
    @media (max-width: 576px) {
      .gd-cookie-inner { flex-direction: column; align-items: stretch; }
      .gd-cookie-actions { width: 100%; }
      .gd-cookie-btn { flex: 1; }
    }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // ─── WhatsApp button ──────────────────────────────────────────────────
  function injectWhatsApp() {
    if (document.querySelector('.gd-wa-btn')) return;
    const lang = (document.documentElement.lang || 'en').startsWith('ar') ? 'ar' : 'en';
    const greeting = lang === 'ar'
      ? 'السلام عليكم، أحتاج مساعدة بخصوص Guideon'
      : 'Hi! I need help with Guideon';
    const a = document.createElement('a');
    a.className = 'gd-wa-btn';
    a.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(greeting)}`;
    a.target = '_blank';
    a.rel = 'noopener';
    a.title = lang === 'ar' ? 'تواصل عبر واتساب' : 'Chat on WhatsApp';
    a.setAttribute('aria-label', a.title);
    a.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.71.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`;
    document.body.appendChild(a);
  }

  // ─── Contact / Email floating button ──────────────────────────────────
  function injectContact() {
    if (document.querySelector('.gd-contact-btn')) return;
    // Skip if we're already on the contact page
    if (location.pathname === '/contact.html' || location.pathname.endsWith('/contact')) return;
    const lang = (document.documentElement.lang || 'en').startsWith('ar') ? 'ar' : 'en';
    const label = lang === 'ar' ? 'تواصل معنا' : 'Contact us';
    const a = document.createElement('a');
    a.className = 'gd-contact-btn';
    a.href = '/contact.html';
    a.title = label;
    a.setAttribute('aria-label', label);
    a.innerHTML = `
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
        <polyline points="22,6 12,13 2,6"/>
      </svg>
      <span class="gd-contact-label">${label}</span>`;
    document.body.appendChild(a);
  }

  // ─── Cookie consent ──────────────────────────────────────────────────
  function injectCookieBar() {
    if (localStorage.getItem(COOKIE_KEY)) return;
    if (document.querySelector('.gd-cookie-bar')) return;
    const lang = (document.documentElement.lang || 'en').startsWith('ar') ? 'ar' : 'en';
    const isAr = lang === 'ar';

    const bar = document.createElement('div');
    bar.className = 'gd-cookie-bar';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', isAr ? 'إشعار ملفات تعريف الارتباط' : 'Cookie notice');
    bar.innerHTML = `
      <div class="gd-cookie-inner">
        <div class="gd-cookie-text">
          ${isAr
            ? '🍪 نستخدم ملفات تعريف الارتباط الضرورية لتشغيل الموقع، وملفات تحليلية لتحسين تجربتك. اطّلع على <a href="/privacy.html">سياسة الخصوصية</a>.'
            : '🍪 We use essential cookies to run the site and analytics cookies to improve your experience. See our <a href="/privacy.html">Privacy Policy</a>.'}
        </div>
        <div class="gd-cookie-actions">
          <button class="gd-cookie-btn essential" id="gdCookieEssential">${isAr ? 'الضروري فقط' : 'Essential only'}</button>
          <button class="gd-cookie-btn accept" id="gdCookieAccept">${isAr ? 'قبول الكل' : 'Accept all'}</button>
        </div>
      </div>`;
    document.body.appendChild(bar);

    setTimeout(() => bar.classList.add('visible'), 200);

    const dismiss = (consent) => {
      localStorage.setItem(COOKIE_KEY, JSON.stringify({ consent, ts: Date.now() }));
      bar.classList.remove('visible');
      setTimeout(() => bar.remove(), 350);
    };

    document.getElementById('gdCookieAccept').onclick    = () => dismiss('all');
    document.getElementById('gdCookieEssential').onclick = () => dismiss('essential');
  }

  // ─── Show / hide password toggle (auto-enhances every password field) ──
  function enhancePasswordFields() {
    const isAr = (document.documentElement.lang || 'en').startsWith('ar');
    const showLabel = isAr ? 'إظهار كلمة المرور' : 'Show password';
    const hideLabel = isAr ? 'إخفاء كلمة المرور' : 'Hide password';
    document.querySelectorAll('input[type="password"]').forEach((input) => {
      if (input.dataset.gdPwd) return;
      input.dataset.gdPwd = '1';
      if (input.closest('.pwd-wrap')) return;          // already wrapped by us
      // Skip fields that already have their own show/hide toggle (e.g. the
      // login & register pages use a .position-relative wrapper + eye button).
      // Double-enhancing those broke their layout.
      if (input.closest('.position-relative')) return;
      if (input.parentElement && input.parentElement.querySelector('button')) return;

      const wrap = document.createElement('div');
      wrap.className = 'pwd-wrap';
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pwd-toggle';
      btn.textContent = '👁️';
      btn.setAttribute('aria-label', showLabel);
      btn.setAttribute('title', showLabel);
      btn.addEventListener('click', () => {
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.textContent = show ? '🙈' : '👁️';
        btn.setAttribute('aria-label', show ? hideLabel : showLabel);
        btn.setAttribute('title', show ? hideLabel : showLabel);
      });
      wrap.appendChild(btn);
    });
  }

  // Lazy-load the notification bell (only meaningful for signed-in users —
  // the script self-checks the session and bails if not signed in)
  function loadNotifications() {
    if (document.querySelector('script[data-gd-notif]')) return;
    const s = document.createElement('script');
    s.src = '/js/notifications.js?v=4';
    s.async = true;
    s.dataset.gdNotif = '1';
    document.body.appendChild(s);
  }

  // Unified navbar — replaces any legacy <nav> on the page with the new
  // responsive bilingual bar. Pages can opt out with <body data-no-gd-nav>.
  function loadUnifiedNav() {
    if (document.querySelector('script[data-gd-nav]')) return;
    if (document.body && document.body.dataset.noGdNav !== undefined) return;
    const s = document.createElement('script');
    s.src = '/js/gd-navbar.js?v=8';
    s.dataset.gdNav = '1';
    document.body.appendChild(s);
  }

  // ─── Email verification banner ─────────────────────────────────────────
  // Gentle, non-blocking reminder for signed-in users whose email isn't
  // verified, with a one-click resend. Hidden for verified users, Google
  // sign-ins (auto-verified) and grandfathered accounts (field undefined).
  async function injectVerifyBanner() {
    let me;
    try { me = await window.gdSession.get(); } catch { return; }
    if (!me || me.emailVerified !== false) return; // only when explicitly false
    if (sessionStorage.getItem('gd_verify_hidden') === '1') return;

    const isAr = (window.I18N && I18N.lang) ? I18N.lang === 'ar' : (localStorage.getItem('gd_lang') === 'ar');
    const bar = document.createElement('div');
    bar.id = 'gd-verify-bar';
    Object.assign(bar.style, {
      position: 'sticky', top: '0', zIndex: '9997',
      background: '#fff8e6', borderBottom: '1px solid #f5d27a', color: '#7a5a00',
      padding: '10px 14px', fontSize: '.88rem', textAlign: 'center',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flexWrap: 'wrap',
    });
    const intro = isAr
      ? 'لم يُفعّل بريدك بعد. افتح الرابط الذي أرسلناه إلى'
      : "Your email isn't verified yet. Open the link we sent to";
    bar.innerHTML =
      '<span>📧 ' + intro + ' <b>' + me.email + '</b></span>' +
      '<button id="gd-verify-resend" style="background:#0f7b6c;color:#fff;border:none;border-radius:8px;padding:5px 14px;font-weight:700;cursor:pointer">' + (isAr ? 'إعادة الإرسال' : 'Resend') + '</button>' +
      '<button id="gd-verify-close" style="background:transparent;border:none;color:#7a5a00;font-size:1.1rem;cursor:pointer;line-height:1">×</button>';
    document.body.prepend(bar);

    document.getElementById('gd-verify-close').onclick = function () {
      sessionStorage.setItem('gd_verify_hidden', '1');
      bar.remove();
    };
    document.getElementById('gd-verify-resend').onclick = async function (e) {
      const b = e.currentTarget;
      b.disabled = true; b.textContent = isAr ? 'جارٍ الإرسال…' : 'Sending…';
      try {
        const r = await fetch('/api/auth/resend-verification', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: me.email }),
        });
        const d = await r.json();
        b.textContent = d.success ? (isAr ? '✓ تم الإرسال' : '✓ Sent') : (isAr ? 'حدث خطأ' : 'Error');
      } catch {
        b.textContent = isAr ? 'حدث خطأ' : 'Error';
      }
    };
  }

  // ─── Boot ──────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      loadUnifiedNav(); injectWhatsApp(); injectContact(); injectCookieBar(); loadNotifications(); enhancePasswordFields(); injectVerifyBanner();
    });
  } else {
    loadUnifiedNav(); injectWhatsApp(); injectContact(); injectCookieBar(); loadNotifications(); injectVerifyBanner();
  }
})();
