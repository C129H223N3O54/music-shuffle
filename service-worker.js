/* ═══════════════════════════════════════════════════════
   ARTIST SHUFFLE — service-worker.js
   PWA Service Worker für Offline-Support und Caching
   ═══════════════════════════════════════════════════════ */

const CACHE_NAME = 'music-shuffle-v1.0.1';
const STATIC_ASSETS = [
  '/music-shuffle/',
  '/music-shuffle/index.html',
  '/music-shuffle/style.css',
  '/music-shuffle/app.js',
  '/music-shuffle/i18n.js',
  '/music-shuffle/spotify-api.js',
  '/music-shuffle/manifest.json',
  '/music-shuffle/favicon.svg',
  '/music-shuffle/icons/icon-192.png',
  '/music-shuffle/icons/icon-512.png',
];

// ── INSTALL ───────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] Some assets failed to cache:', err);
      });
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE ──────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    )
  );
  self.clients.claim();
});

// ── FETCH ─────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never cache Spotify API or auth requests
  if (url.hostname.includes('spotify.com') ||
      url.hostname.includes('scdn.co')) {
    return;
  }

  // Never cache sync server requests
  if (url.port === '3001') {
    return;
  }

  // For navigation requests: serve from cache, fall back to network
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('/music-shuffle/index.html').then(cached => {
        return cached || fetch(event.request);
      })
    );
    return;
  }

  // For static assets: cache first, then network
  if (event.request.method === 'GET' &&
      (url.pathname.endsWith('.js') ||
       url.pathname.endsWith('.css') ||
       url.pathname.endsWith('.png') ||
       url.pathname.endsWith('.svg') ||
       url.pathname.endsWith('.json'))) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }
});
