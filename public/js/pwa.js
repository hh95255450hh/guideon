(() => {
  // ── Remove ALL service workers and caches (permanent clean state) ──────────
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then(regs => Promise.all(regs.map(r => r.unregister())))
      .catch(() => {});
  }
  if ('caches' in window) {
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .catch(() => {});
  }

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
