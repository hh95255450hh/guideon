const CACHE_NAME = 'Guideon-cdn-v2';

const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.rtl.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
];

// ── Install: only cache CDN assets ───────────────────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(CDN_ASSETS.map(url => new Request(url, { cache: 'reload' }))).catch(() => {})
    )
  );
});

// ── Activate: remove old caches ───────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: local files always from network, CDN from cache ───────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never cache API calls or non-GET
  if (url.pathname.startsWith('/api/') || event.request.method !== 'GET') return;

  // Local files (HTML, CSS, JS, images) → always from network
  if (url.origin === self.location.origin) return;

  // CDN assets → cache first
  if (CDN_ASSETS.includes(event.request.url)) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request))
    );
  }
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
