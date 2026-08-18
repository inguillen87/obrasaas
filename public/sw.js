// ObraSaaS Service Worker — Offline-First for Field Workers
const CACHE_NAME = 'obrasaas-v1';
const STATIC_ASSETS = [
    '/dashboard',
    '/webview/attendance',
    '/webview/kyc',
    '/webview/medical',
    '/manifest.json'
];

// Install: Cache core static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch: Network-first for API, Cache-first for static pages
self.addEventListener('fetch', (event) => {
    // Only handle http and https requests (ignore chrome-extension, data, blob, etc.)
    if (!event.request.url.startsWith('http://') && !event.request.url.startsWith('https://')) return;

    const url = new URL(event.request.url);

    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // API requests: Network-first with cache fallback
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Cache successful GET API responses for offline fallback
                    if (response.ok && url.pathname === '/api/state') {
                        const cloned = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            try { cache.put(event.request, cloned); } catch (_) {}
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Offline: serve cached API response
                    return caches.match(event.request);
                })
        );
        return;
    }

    // SSE/realtime: always network
    if (url.pathname.startsWith('/api/realtime')) return;

    // Static pages: Cache-first with network fallback
    event.respondWith(
        caches.match(event.request).then((cached) => {
            const fetchPromise = fetch(event.request).then((response) => {
                if (response.ok && (event.request.url.startsWith('http://') || event.request.url.startsWith('https://'))) {
                    const cloned = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        try { cache.put(event.request, cloned); } catch (_) {}
                    });
                }
                return response;
            }).catch(() => cached);

            return cached || fetchPromise;
        })
    );
});
