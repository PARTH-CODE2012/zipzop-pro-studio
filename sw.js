// Service Worker for ZipZop Pro Studio PWA
const CACHE_NAME = 'zipzop-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  // API calls को सीधे नेटवर्क से
  if (event.request.url.includes('/api/')) {
    return event.respondWith(
      fetch(event.request).catch(() => {
        return new Response('Offline - API unavailable', { status: 503 });
      })
    );
  }

  // अन्य सभी requests के लिए cache first
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(event.request).catch(() => {
        return new Response('Offline', { status: 503 });
      });
    })
  );
});