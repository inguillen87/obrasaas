import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import manifest from '../src/app/manifest.js';
const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
test('la app instalada abre Campo móvil con identidad estable', () => {
  const value = manifest();
  assert.equal(value.id, '/'); assert.equal(value.scope, '/');
  assert.equal(value.start_url, '/dashboard/campo'); assert.equal(value.display, 'standalone');
});
test('los iconos y la pantalla sin conexión existen', () => {
  for (const icon of manifest().icons) assert.ok(fs.existsSync(new URL('../public' + icon.src, import.meta.url)));
  assert.match(read('public/offline.html'), /No hay conexión/);
});
test('el service worker sólo almacena una página pública', () => {
  const source = read('public/sw.js');
  assert.match(source, /const OFFLINE = '\/offline.html'/);
  assert.match(source, /cache.add\(new Request\(OFFLINE/);
  assert.match(source, /credentials: 'omit'/);
  assert.doesNotMatch(source, /cache\.put|indexedDB|localStorage|sessionStorage/);
});
test('la salida offline no transforma fallos en guardados exitosos', () => {
  assert.match(read('public/sw.js'), /status: 503/);
  assert.match(read('public/offline.html'), /no confirma el guardado ni el envío/);
  assert.match(read('public/offline.html'), /todavía no está habilitada/);
});
test('el worker exige GET, navegación y mismo origen', () => {
  const source = read('public/sw.js');
  assert.match(source, /request.method !== 'GET'/); assert.match(source, /request.mode !== 'navigate'/);
  assert.match(source, /url.origin !== self.location.origin/);
  assert.match(source, /!url.pathname.startsWith\('\/dashboard\/'\)/);
});
test('el inicio de actualizaciones no fuerza una recarga mientras se escribe', () => {
  const source = read('public/sw.js');
  assert.equal((source.match(/self.skipWaiting\(/g) || []).length, 1);
  assert.match(source, /event.data\?\.type === 'SKIP_WAITING'/);
  assert.match(read('src/app/dashboard/campo/pwa-controls.js'), /window.confirm/);
});
test('las URLs de navegación no incluyen identidades ni credenciales', () => {
  for (const shortcut of manifest().shortcuts) assert.ok(/^\/dashboard\/[a-z-]+$/.test(shortcut.url));
  assert.doesNotMatch(read('public/offline.html'), /<script|<form|https:\/\//i);
});
