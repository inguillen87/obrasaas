/* ObraSaaS public fallback only. No API, HTML session, upload or credential cache. */
const CACHE = 'obrasaas-public-shell-v1';
const OFFLINE = '/offline.html';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add(new Request(OFFLINE, { cache: 'reload', credentials: 'omit' }))));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('obrasaas-public-shell-') && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || request.mode !== 'navigate' || url.origin !== self.location.origin) return;
  if (url.pathname !== '/' && url.pathname !== '/dashboard' && !url.pathname.startsWith('/dashboard/')) return;
  event.respondWith(fetch(request).catch(async () => {
    const cache = await caches.open(CACHE);
    const fallback = await cache.match(OFFLINE);
    return new Response(fallback ? await fallback.text() : 'Sin conexión. No se confirmó ningún envío.', {
      status: 503, headers: { 'Content-Type': fallback ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-ObraSaaS-Offline': '1' },
    });
  }));
});
