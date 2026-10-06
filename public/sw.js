// Production boundary v6 — public assets only. Private data always needs the network.
const CACHE_NAME = 'obrasaas-public-v6';
const STATIC_ASSETS = ["/manifest.json", "/icon-192.svg", "/icon-512.svg", "/brand/obrasaas-app-icon.svg", "/brand/obrasaas-app-icon-192.png", "/brand/obrasaas-app-icon-512.png", "/brand/obrasaas-maskable-512.png"];
const OFFLINE_DOCUMENT = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Sin conexión · ObraSaaS</title>
<style>*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;padding:24px;background:#f4f2eb;color:#102a3c;font:16px/1.6 Arial,sans-serif;padding-top:max(24px,env(safe-area-inset-top));padding-bottom:max(24px,env(safe-area-inset-bottom));padding-left:max(24px,env(safe-area-inset-left));padding-right:max(24px,env(safe-area-inset-right))}main{width:100%;max-width:520px}.brand{display:flex;align-items:center;gap:12px;font-size:26px;font-weight:700}.brand img{width:52px;height:52px}.eyebrow{margin:32px 0 10px;font-size:12px;font-weight:700;letter-spacing:.12em}h1{font-size:clamp(28px,7vw,40px);line-height:1.15;letter-spacing:-.035em;margin:0 0 20px}p{margin:0 0 20px}.actions{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin:28px 0}form{margin:0}button,a{min-height:48px;display:inline-flex;align-items:center;justify-content:center;border-radius:8px;padding:12px 18px;font:inherit;font-weight:700}button{border:0;background:#f3b44e;color:#102a3c;cursor:pointer}a{color:#102a3c;text-underline-offset:4px}button:focus-visible,a:focus-visible{outline:3px solid #102a3c;outline-offset:4px}.note{font-size:14px;border-top:1px solid #bcc5c6;padding-top:20px}</style></head>
<body><main aria-labelledby="offline-title"><div class="brand"><img src="/brand/obrasaas-app-icon.svg" alt=""><span>ObraSaaS</span></div><p class="eyebrow">SIN CONEXIÓN</p><h1 id="offline-title">Volvé a conectar con tu obra.</h1><p>Necesitás conexión para verificar tu acceso. Cuando vuelva la red, comprobala con el botón.</p><div class="actions"><form method="get" id="offline-retry"><button type="submit">Volver a intentar</button></form><a href="/cuenta">Ir a Mi cuenta</a></div><p class="note">Los datos privados requieren acceso verificado. Las operaciones pendientes no se reenvían automáticamente.</p></main><script>document.getElementById('offline-retry').addEventListener('submit', function (event) { event.preventDefault(); window.location.reload(); });</script></body></html>`;
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
    event.respondWith(caches.open(CACHE_NAME).then(cache => cache.match(event.request)).then(cached => cached || fetch(event.request)));
    return;
  }
  // Never read a cached API/page response, including during a connection failure.
  event.respondWith(fetch(event.request, { cache: 'no-store' }).catch(() => {
    if (url.pathname.startsWith('/api/')) return Response.json({ code: 'OFFLINE_AUTH_REQUIRED', error: 'Conectate para verificar el acceso. No se muestran datos privados guardados.' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
    if (event.request.mode === 'navigate' && event.request.destination === 'document') return new Response(OFFLINE_DOCUMENT,
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' } });
    return Response.error();
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
