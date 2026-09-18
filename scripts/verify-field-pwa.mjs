import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
// Isolated synthetic HTTP fixture, not an authentication bypass or production route.
const sw = readFileSync(new URL('../public/sw.js', import.meta.url));
const offline = readFileSync(new URL('../public/offline.html', import.meta.url));
const server = createServer((request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  if (request.url === '/sw.js') {
    response.setHeader('Content-Type', 'text/javascript'); response.end(sw); return;
  }
  if (request.url === '/offline.html') {
    response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(offline); return;
  }
  if (request.url === '/api/test-record') {
    response.setHeader('Content-Type', 'application/json'); response.end('{"synthetic":true}'); return;
  }
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.end('<!doctype html><title>Fixture de prueba</title><h1>Registro sintético online</h1><script>navigator.serviceWorker.register("/sw.js")</script>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' });
  const page = await context.newPage();
  await page.goto(origin + '/dashboard/campo');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  const api = await page.evaluate(() => fetch('/api/test-record').then(response => response.json()));
  assert.equal(api.synthetic, true);
  const cachePaths = () => page.evaluate(async () => {
    const paths = [];
    for (const key of await caches.keys()) {
      for (const request of await (await caches.open(key)).keys()) paths.push(new URL(request.url).pathname);
    }
    return paths.sort();
  });
  assert.deepEqual(await cachePaths(), ['/offline.html']);
  await context.setOffline(true);
  assert.equal(await page.evaluate(() => fetch('/api/test-record').then(() => false).catch(() => true)), true);
  const fallback = await page.goto(origin + '/dashboard/campo');
  assert.equal(fallback.status(), 503);
  assert.match(await page.locator('h1').innerText(), /No hay conexión/);
  const widths = [];
  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    assert.equal(fits, true, 'Offline horizontal overflow at ' + width); widths.push(width);
  }
  await context.setOffline(false);
  const recovered = await page.goto(origin + '/dashboard/campo');
  assert.equal(recovered.status(), 200); assert.deepEqual(await cachePaths(), ['/offline.html']);
  const result = { result: 'PASS', offlineStatus: 503, recoveryStatus: 200, cachedPaths: ['/offline.html'], apiUnavailableOffline: true, noHorizontalOverflowWidths: widths, environment: 'isolated-synthetic-fixture' };
  writeFileSync(new URL('../.vercel/field-pwa-browser-proof.json', import.meta.url), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
