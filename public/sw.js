// Production boundary v5 — approved brand v3: public assets only. Private data always needs the network.
const CACHE_NAME = 'obrasaas-public-v5';
const STATIC_ASSETS = ["/manifest.json", "/icon-192.svg", "/icon-512.svg", "/brand/obrasaas-app-icon.svg", "/brand/obrasaas-app-icon-192.png", "/brand/obrasaas-app-icon-512.png", "/brand/obrasaas-maskable-512.png"];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('obrasaas-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  if (STATIC_ASSETS.includes(url.pathname) && !url.search) {
    event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
    return;
  }
  // Never read a cached API/page response, including during a connection failure.
  event.respondWith(fetch(event.request, { cache: 'no-store' }).catch(() => {
    if (url.pathname.startsWith('/api/')) return Response.json({ code: 'OFFLINE_AUTH_REQUIRED', error: 'Conectate para verificar el acceso. No se muestran datos privados guardados.' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
    return new Response('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin conexión · ObraSaaS</title><body style="margin:32px;background:#060913;color:#f1f5f9;font:16px Arial;line-height:1.6"><h1>No hay conexión</h1><p>Volvé a conectarte para verificar el acceso a ObraSaaS.</p><p>Las operaciones pendientes no se reenvían automáticamente.</p></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' } });
  }));
});
// Legacy IndexedDB queue is deliberately retained, not replayed or deleted.
// Recovery needs a future actor/tenant-bound receipt protocol, not blind POSTs.
self.addEventListener('push', event => {
  event.waitUntil(self.registration.showNotification('ObraSaaS', { body: 'Ingresá con una sesión verificada para consultar tu obra.', icon: '/icon-192.svg', tag: 'obrasaas-access' }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow('/sign-in'));
});
