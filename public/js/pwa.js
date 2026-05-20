(() => {
  const VAPID_KEY = 'NwaVO_x8unxTQqE24RG9OzAEiRlriePJQaYC4PPdXGw';

  // ── Register Service Worker ─────────────────────────────────────────────────
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('[SW] registered');
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
      .catch(err => console.warn('[SW] registration failed:', err));
  }

  // ── Request push notification permission & get FCM token ───────────────────
  async function requestNotificationPermission() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    if (Notification.permission === 'denied') return;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    try {
      const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
      const { getMessaging, getToken } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js');

      const app = initializeApp({
        apiKey:            'AIzaSyPlaceholder',
        authDomain:        'guideon-55995.firebaseapp.com',
        projectId:         'guideon-55995',
        storageBucket:     'guideon-55995.appspot.com',
        messagingSenderId: '108887603705271785305',
        appId:             '1:108887603705271785305:web:placeholder',
      }, 'guideon-pwa');

      const messaging = getMessaging(app);
      const swReg = await navigator.serviceWorker.ready;
      const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });

      if (token) {
        await fetch('/api/auth/fcm-token', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
      }
    } catch (err) {
      console.warn('[FCM] token error:', err.message);
    }
  }

  // Request permission after page load (only if user is logged in)
  window.addEventListener('load', () => {
    setTimeout(() => {
      fetch('/api/auth/me', { credentials: 'include' })
        .then(r => r.ok && requestNotificationPermission())
        .catch(() => {});
    }, 3000);
  });

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
