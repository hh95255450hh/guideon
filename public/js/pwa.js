(() => {
  if ('serviceWorker' in navigator) {
    // Clear all old caches first, then register fresh service worker
    if ('caches' in window) {
      caches.keys().then(keys => Promise.all(
        keys.filter(k => k !== 'Guideon-cdn-v2').map(k => caches.delete(k))
      )).catch(() => {});
    }

    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        reg.addEventListener('updatefound', () => {
          const w = reg.installing;
          w?.addEventListener('statechange', () => {
            if (w.state === 'installed' && navigator.serviceWorker.controller) {
              w.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch(() => {});
  }

  // ── Web Push (standard VAPID — no Firebase) ─────────────────────────────────
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  async function enablePush() {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (Notification.permission === 'denied') return;

    // Get the server's VAPID public key (skip entirely if push isn't configured)
    let vapid;
    try {
      const r = await fetch('/api/notifications/vapid-key', { credentials: 'include' });
      const d = await r.json();
      if (!d.enabled || !d.key) return;
      vapid = d.key;
    } catch { return; }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid),
        });
      }
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub }),
      });
    } catch (err) {
      console.warn('[push] subscribe failed:', err.message);
    }
  }
  window.enablePush = enablePush; // allow a manual "Enable notifications" button

  // Auto-prompt only if the user is logged in
  window.addEventListener('load', () => {
    setTimeout(() => {
      fetch('/api/auth/me', { credentials: 'include' })
        .then(r => r.ok && enablePush())
        .catch(() => {});
    }, 3000);
  });

  // ── Install prompt ("Add to Home Screen") ───────────────────────────────────
  // Captures the browser's install event and shows a friendly bilingual banner.
  // iOS Safari doesn't fire the event, so we show manual instructions there.
  (() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
    if (isStandalone) return; // already installed — never prompt

    if (localStorage.getItem('gd_pwa_dismissed') === '1') return;

    const isAr = () => (window.I18N && I18N.lang === 'ar')
      || document.documentElement.lang === 'ar';
    const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
      && /safari/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);

    let deferredPrompt = null;

    function banner(innerHtml) {
      if (document.getElementById('pwa-install-banner')) return;
      const b = document.createElement('div');
      b.id = 'pwa-install-banner';
      Object.assign(b.style, {
        position: 'fixed', left: '12px', right: '12px', bottom: '12px',
        background: '#0f1c3e', color: '#fff', borderRadius: '16px',
        padding: '14px 16px', boxShadow: '0 8px 28px rgba(0,0,0,.28)',
        zIndex: '99998', fontSize: '.9rem', display: 'flex',
        alignItems: 'center', gap: '12px', maxWidth: '520px', margin: '0 auto',
        animation: 'gdpwaUp .35s ease',
      });
      b.innerHTML = innerHtml;
      document.body.appendChild(b);
      if (!document.getElementById('gdpwa-style')) {
        const s = document.createElement('style');
        s.id = 'gdpwa-style';
        s.textContent = '@keyframes gdpwaUp{from{transform:translateY(40px);opacity:0}to{transform:translateY(0);opacity:1}}';
        document.head.appendChild(s);
      }
    }

    function dismiss() {
      localStorage.setItem('gd_pwa_dismissed', '1');
      const el = document.getElementById('pwa-install-banner');
      if (el) el.remove();
    }
    window.gdPwaDismiss = dismiss;

    // Standard (Android/Chrome/Edge) install flow
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      setTimeout(() => {
        const ar = isAr();
        banner(`
          <div style="font-size:1.6rem">📲</div>
          <div style="flex:1;line-height:1.4">
            <div style="font-weight:700">${ar ? 'ثبّت تطبيق Guideon' : 'Install Guideon'}</div>
            <div style="opacity:.85;font-size:.82rem">${ar ? 'وصول أسرع من شاشتك الرئيسية' : 'Faster access from your home screen'}</div>
          </div>
          <button id="gdpwa-install" style="background:#0f7b6c;color:#fff;border:none;border-radius:10px;padding:8px 16px;font-weight:700;cursor:pointer;white-space:nowrap">${ar ? 'تثبيت' : 'Install'}</button>
          <button onclick="gdPwaDismiss()" style="background:transparent;border:none;color:#fff;opacity:.6;font-size:1.3rem;cursor:pointer;line-height:1">×</button>
        `);
        document.getElementById('gdpwa-install')?.addEventListener('click', async () => {
          const el = document.getElementById('pwa-install-banner');
          if (el) el.remove();
          deferredPrompt.prompt();
          try { await deferredPrompt.userChoice; } catch (_) {}
          deferredPrompt = null;
          localStorage.setItem('gd_pwa_dismissed', '1');
        });
      }, 4000);
    });

    window.addEventListener('appinstalled', () => {
      localStorage.setItem('gd_pwa_dismissed', '1');
      const el = document.getElementById('pwa-install-banner');
      if (el) el.remove();
    });

    // iOS Safari — no event; show manual "Share → Add to Home Screen" hint.
    if (isiOS) {
      window.addEventListener('load', () => setTimeout(() => {
        const ar = isAr();
        banner(`
          <div style="font-size:1.6rem">📲</div>
          <div style="flex:1;line-height:1.45">
            <div style="font-weight:700">${ar ? 'ثبّت Guideon على آيفون' : 'Install Guideon on iPhone'}</div>
            <div style="opacity:.85;font-size:.82rem">${ar ? 'اضغط زر المشاركة ⎙ ثم «إضافة إلى الشاشة الرئيسية»' : 'Tap Share ⎙ then “Add to Home Screen”'}</div>
          </div>
          <button onclick="gdPwaDismiss()" style="background:transparent;border:none;color:#fff;opacity:.6;font-size:1.3rem;cursor:pointer;line-height:1">×</button>
        `);
      }, 5000));
    }
  })();

  // ── Online/Offline indicator ────────────────────────────────────────────────
  function updateOnlineStatus() {
    const existing = document.getElementById('pwa-offline-bar');
    if (!navigator.onLine) {
      if (existing) return;
      const bar = document.createElement('div');
      bar.id = 'pwa-offline-bar';
      bar.textContent = '⚠️ You are offline — some features may not be available.';
      Object.assign(bar.style, {
        position: 'fixed', top: '0', left: '0', right: '0',
        background: '#ef4444', color: '#fff', textAlign: 'center',
        padding: '8px', fontSize: '.85rem', fontWeight: '600',
        zIndex: '99999',
      });
      document.body.prepend(bar);
    } else {
      if (existing) existing.remove();
    }
  }

  window.addEventListener('online',  updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();
})();
