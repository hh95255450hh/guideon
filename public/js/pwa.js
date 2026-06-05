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
