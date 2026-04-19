// sw.js - Service Worker

const CACHE_VERSION = 'v103';
const PRECACHE_NAME = `wpa-precache-${CACHE_VERSION}`;
const RUNTIME_CACHE = `wpa-runtime-${CACHE_VERSION}`;

// List of resources to precache
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/stylev11.css',
  '/cctv_locations_processed_classified.geojson',
  '/manifest.json',
  '/gifLogo.gif',
  '/routes.json',
  '/cameras.geojson',
  '/cameraData.js',
  '/js/main.js',
  '/js/geolocation.js',
  '/js/utils.js',
  '/js/dataLoader.js',
  '/js/filters.js',
  '/js/dropdowns.js',
  '/js/gallery.js',
  '/js/modal.js',
  '/js/customRoute.js',
  '/js/otherFilters.js',
  '/js/events.js',
  '/js/ui.js',
  '/js/maps.js',
  '/js/mobileCarousel.js',
  '/images/mobileSplash.gif',
  '/desktop-splash.mp4',
  '/images/mobileSplash.webp',
  '/Icongridbackground3.png'
];

// Install - pre-cache assets
self.addEventListener('install', event => {
  console.log('SW installing, version:', CACHE_VERSION);
  event.waitUntil(
    caches.open(PRECACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate - clean up old caches
self.addEventListener('activate', event => {
  console.log('SW activating, version:', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== PRECACHE_NAME && key !== RUNTIME_CACHE)
          .map(oldKey => caches.delete(oldKey))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch - network-first for shell, cache-first for others
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Network-first for core shell files (HTML/JS/CSS)
  if (
    url.origin === location.origin &&
    (url.pathname === '/' ||
     url.pathname.endsWith('.html') ||
     url.pathname.endsWith('.js')   ||
     url.pathname.endsWith('.css'))
  ) {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          // Only cache if response is ok and type is basic (from our origin)
          if (networkResponse && networkResponse.ok && networkResponse.type === 'basic') {
            const responseClone = networkResponse.clone();
            caches.open(PRECACHE_NAME)
              .then(cache => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for precached assets
  if (url.origin === location.origin && PRECACHE_URLS.includes(url.pathname)) {
    event.respondWith(
      caches.match(event.request)
            .then(cached => cached || fetch(event.request))
    );
    return;
  }

  // Runtime caching for images
  if (
    url.origin === location.origin &&
    (url.pathname.startsWith('/images/') ||
     /\.(png|jpg|jpeg|gif|webp|svg)$/.test(url.pathname))
  ) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(response => {
            cache.put(event.request, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }

  // Fallback to network, then cache
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
