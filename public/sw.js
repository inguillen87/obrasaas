// ObraSaaS Service Worker v3.0 — Offline-First + Background Sync + Push Notifications
const CACHE_NAME = 'obrasaas-v3';
const STATIC_ASSETS = [
    '/',
    '/dashboard',
    '/sign-in',
    '/pricing',
    '/planos',
    '/costos',
    '/compliance',
    '/portal',
    '/ejecutivo',
    '/libro-obra',
    '/inspecciones',
    '/documentos',
    '/cronograma',
    '/marketplace',
    '/presupuesto',
    '/bim',
    '/licitaciones',
    '/webview/attendance',
    '/webview/kyc',
    '/webview/medical',
    '/manifest.json',
    '/icon-192.svg',
    '/icon-512.svg'
];

const OFFLINE_QUEUE_STORE = 'obrasaas-offline-queue';

// Install: Cache core static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
        )
    );
    self.clients.claim();
});

// Fetch: Network-first for API, Stale-While-Revalidate for pages
self.addEventListener('fetch', (event) => {
    if (!event.request.url.startsWith('http://') && !event.request.url.startsWith('https://')) return;
    const url = new URL(event.request.url);
    if (event.request.method !== 'GET') return;
    if (url.pathname.startsWith('/api/realtime')) return;

    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    if (response.ok) {
                        const cloned = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            try { cache.put(event.request, cloned); } catch (_) {}
                        });
                    }
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cached) => {
            const fetchPromise = fetch(event.request).then((response) => {
                if (response.ok) {
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

// Background Sync: Replay offline actions when connection restores
self.addEventListener('sync', (event) => {
    if (event.tag === 'obrasaas-offline-sync') {
        event.waitUntil(replayOfflineQueue());
    }
});

async function replayOfflineQueue() {
    try {
        const db = await openOfflineDB();
        const tx = db.transaction(OFFLINE_QUEUE_STORE, 'readonly');
        const store = tx.objectStore(OFFLINE_QUEUE_STORE);
        const allRequests = await getAllFromStore(store);
        for (const item of allRequests) {
            try {
                await fetch(item.url, { method: item.method, headers: item.headers, body: item.body });
                const deleteTx = db.transaction(OFFLINE_QUEUE_STORE, 'readwrite');
                deleteTx.objectStore(OFFLINE_QUEUE_STORE).delete(item.id);
            } catch (err) {
                console.warn('[SW] Failed to replay:', err);
                break;
            }
        }
    } catch (err) {
        console.error('[SW] Offline queue error:', err);
    }
}

function openOfflineDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('obrasaas-offline', 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(OFFLINE_QUEUE_STORE)) {
                db.createObjectStore(OFFLINE_QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function getAllFromStore(store) {
    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Push Notifications
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'ObraSaaS — Alerta de Obra';
    const options = {
        body: data.body || 'Tienes una nueva notificacion de tu obra.',
        icon: '/icon-192.svg',
        badge: '/icon-192.svg',
        tag: data.tag || 'obrasaas-notification',
        data: { url: data.url || '/dashboard' },
        vibrate: [200, 100, 200],
        actions: [
            { action: 'open', title: 'Ver Detalle' },
            { action: 'dismiss', title: 'Descartar' }
        ]
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || '/dashboard';
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes(url) && 'focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow(url);
        })
    );
});
