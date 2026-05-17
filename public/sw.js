const CACHE_VERSION = 'Guideon-v9';
const STATIC_CACHE  = CACHE_VERSION + '-static';
const IMAGE_CACHE   = CACHE_VERSION + '-images';

// Only pre-cache CDN resources and icons (local files use network-first)
const PRECACHE = [
  '/offline.html',
  '/icon-192.png',
  '/icon-512.png',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.rtl.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
];

// ── Install: wipe ALL old caches then pre-cache fresh ────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => caches.open(STATIC_CACHE))
      .then(cache =>
        cache.addAll(PRECACHE.map(url => new Request(url, { cache: 'reload' })))
          .catch(() => {})
      )
  );
});

// ── Activate: claim all clients then notify them to reload ───────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    self.clients.claim().then(() =>
      self.clients.matchAll({ type: 'window' }).then(clients =>
        clients.forEach(c => c.postMessage({ type: 'RELOAD' }))
      )
    )
  );
});

// ── Fetch strategy ────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. API calls → Network Only (never cache)
  if (url.pathname.startsWith('/api/')) return;

  // 2. Non-GET → pass through
  if (request.method !== 'GET') return;

  // 3. Images → Cache First
  if (/\.(png|jpg|jpeg|webp|svg|gif|ico)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  // 4. Local CSS / JS → Network First (always fresh from server)
  if (/\.(css|js|woff2?|ttf|eot)$/i.test(url.pathname) && url.origin === self.location.origin) {
    event.respondWith(networkFirst(request, STATIC_CACHE));
    return;
  }

  // 5. CDN assets (Bootstrap etc.) → Cache First (versioned URLs)
  if (/\.(css|js|woff2?|ttf|eot)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // 6. HTML pages → Network First with offline fallback
  event.respondWith(networkFirst(request, STATIC_CACHE));
});

// ── Strategies ────────────────────────────────────────────────────────────────
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return offlineFallback(request);
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return offlineFallback(request);
  }
}

async function offlineFallback(request) {
  if (request.headers.get('accept')?.includes('text/html')) {
    const offline = await caches.match('/offline.html');
    if (offline) return offline;
  }
  return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
}

// ── Message handler ───────────────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// ── Background Sync: retry failed bookings ───────────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'retry-booking') {
    event.waitUntil(
      self.clients.matchAll().then(clients =>
        clients.forEach(c => c.postMessage({ type: 'SYNC_BOOKING' }))
      ).catch(() => {})
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
      body:    payload.body  || '',
      icon:    '/icon-192.png',
      badge:   '/icon-192.png',
      tag:     payload.tag   || 'Guideon',
      data:    payload.data  || {},
      actions: payload.actions || [],
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
