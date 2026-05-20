const CACHE_NAME = 'Guideon-v3';

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting();
});

// ── Activate: remove ALL old caches ──────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: all files always from network (no caching) ────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/') || event.request.method !== 'GET') return;
  // Always fetch fresh from network — no caching
});

// ── Push Notifications ────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch { payload = { title: 'Guideon', body: event.data.text() }; }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Guideon', {
      body:    payload.body || '',
      icon:    '/icon-192.png',
      badge:   '/icon-192.png',
      tag:     payload.tag || 'guideon',
      data:    payload.data || {},
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

// ── Message handler ───────────────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
