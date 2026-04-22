const CACHE = 'paracep-v1';
const BASE = '/ParaCep';

const PRECACHE = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/manifest.json',
  BASE + '/icons/icon-192.png',
  BASE + '/icons/icon-512.png',
  // CDN deps — cached on first load, served offline thereafter
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap',
  'https://unpkg.com/react@18.3.1/umd/react.development.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js',
  'https://unpkg.com/@babel/standalone@7.29.0/babel.min.js',
];

// Install: pre-cache local assets; CDN assets are best-effort
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      // Local assets must succeed
      await cache.addAll([BASE + '/', BASE + '/index.html', BASE + '/manifest.json',
        BASE + '/icons/icon-192.png', BASE + '/icons/icon-512.png']);
      // CDN assets: best-effort (don't fail install if unreachable)
      await Promise.allSettled(
        PRECACHE.slice(5).map((url) =>
          fetch(url, { mode: 'cors' })
            .then((r) => r.ok ? cache.put(url, r) : null)
            .catch(() => null)
        )
      );
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for same-origin + CDN, network-first for everything else
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  const isSameOrigin = url.origin === location.origin;
  const isCDN = url.hostname === 'unpkg.com' || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

  if (e.request.method !== 'GET') return;

  if (isSameOrigin || isCDN) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return response;
        }).catch(() => {
          // Offline fallback: serve index.html for navigation
          if (e.request.mode === 'navigate') {
            return caches.match(BASE + '/index.html');
          }
        });
      })
    );
  }
});
