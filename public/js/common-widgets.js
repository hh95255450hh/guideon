/**
 * Site-wide widgets: WhatsApp floating button + Cookie consent banner.
 * Auto-injects into every page that includes this script.
 */
(function () {
  'use strict';

  const WHATSAPP_NUMBER = '96895255450';
  const COOKIE_KEY = 'guideon-cookie-consent-v1';

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

  // Lazy-load the notification bell (only meaningful for signed-in users —
  // the script self-checks the session and bails if not signed in)
  function loadNotifications() {
    if (document.querySelector('script[data-gd-notif]')) return;
    const s = document.createElement('script');
    s.src = '/js/notifications.js?v=1';
    s.async = true;
    s.dataset.gdNotif = '1';
    document.body.appendChild(s);
  }

  // ─── Boot ──────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectWhatsApp(); injectCookieBar(); loadNotifications();
    });
  } else {
    injectWhatsApp(); injectCookieBar(); loadNotifications();
  }
})();
