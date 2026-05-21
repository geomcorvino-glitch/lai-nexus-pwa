// L.A.I. STUDIO NEXUS — Service Worker PWA v3.1.0
const CACHE_NAME = 'lai-nexus-cache-v1';
const ASSETS = [
  './',
  './index.html',
  './assets/css/lai-theme.css',
  './assets/js/lai-app.js',
  './assets/icons/icon.svg'
];

// Installazione - Cache delle risorse statiche
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching app shell');
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Attivazione - Rimozione vecchie cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Rimozione vecchia cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch - Strategia Cache First con Network Fallback
self.addEventListener('fetch', (event) => {
  // Ignora le richieste alle API (es. /status, /login, /ai/query o localhost) per evitare che vengano cachate
  if (event.request.url.includes('/api/') || 
      event.request.url.includes('/login') || 
      event.request.url.includes('/status') ||
      event.request.url.includes('/ai/') ||
      event.request.url.includes('/task/') ||
      event.request.url.includes(':5000')) {
    return; // Passa direttamente alla rete
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      return fetch(event.request).then((response) => {
        // Verifica se la risposta è valida
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Metti in cache le nuove risorse statiche richieste
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      }).catch(() => {
        // Fallback offline se la rete fallisce e la risorsa non è in cache
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
