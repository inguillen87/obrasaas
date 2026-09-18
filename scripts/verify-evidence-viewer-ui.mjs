import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
const root = fileURLToPath(new URL('../', import.meta.url)), output = resolve(root, '.vercel/evidence-viewer-ui');
mkdirSync(output, { recursive: true });
const image = readFileSync(resolve(root, 'public/brand/obrasaas-app-icon-192.png'));
const evidence = { id: 'fixture-evidence', projectId: 'project-a', taskId: 'task-a', caption: 'IMAGEN SINTÉTICA · revisión de archivo', status: 'PENDING', revision: 0, capturedAt: '2026-09-18T12:00:00Z', source: { channel: 'dashboard' }, attachment: { available: true, restricted: false, kind: 'image', mimeType: 'image/png', size: image.length, filename: 'imagen-sintetica.png', href: '/api/progress/fixture-evidence/attachment' } };
const entry = `import React from 'react';import{createRoot}from'react-dom/client';import ProgressClient from './src/app/dashboard/progress/progress-client';
const restricted=location.search.includes('restricted');const record=${JSON.stringify(evidence)};if(restricted)record.attachment={available:true,restricted:true};
createRoot(document.getElementById('root')).render(<React.StrictMode><ProgressClient initialData={{dailyLogs:[],evidence:[record],timeline:[],page:{limit:50,hasMore:false}}} tasks={[{id:'task-a',title:'Tarea sintética'}]} workers={[]} permissions={{canManage:true,canReadSourceEvidence:!restricted,canReviewJournal:true}} projectName="Obra sintética del visor" organizationId="org-a" projectId="project-a" initialWorkDate="2026-09-18"/></React.StrictMode>);`;
await build({ stdin: { contents: entry, resolveDir: root, loader: 'jsx' }, outfile: resolve(output, 'bundle.js'), bundle: true, format: 'esm', platform: 'browser', jsx: 'automatic', loader: { '.js': 'jsx' }, alias: { '@': resolve(root, 'src') }, define: { 'process.env.NODE_ENV': '"development"' }, logLevel: 'silent', plugins: [{ name: 'link-adapter', setup(api) {
  api.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fixture' }));
  api.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ loader: 'jsx', contents: `import React from'react';export default function Link({href,onNavigate,onClick,prefetch,...props}){return <a {...props} href={href} onClick={event=>{onClick?.(event);if(!event.defaultPrevented)onNavigate?.(event);}}/>}`, resolveDir: root }));
} }] });
let mode = 'SUCCESS'; const reads = [], writes = [], errors = [];
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://local').pathname;
  if (req.method !== 'GET') writes.push(req.method + ' ' + path);
  if (path === evidence.attachment.href) {
    reads.push({ org: req.headers['x-obrasaas-organization'], project: req.headers['x-obrasaas-project'], mode });
    res.setHeader('Cache-Control', 'private, no-store');
    if (mode !== 'SUCCESS') { res.writeHead(mode === 'CONTEXT' ? 409 : 403, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
    res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': image.length }); res.end(image); return;
  }
  if (path === '/bundle.js' || path === '/bundle.css') { res.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : 'text/css'); res.end(readFileSync(resolve(output, path.slice(1)))); return; }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>body{margin:0;background:#060913;color:white;font-family:Arial,sans-serif}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(() => {
    window.previewUrls = { created: [], revoked: [] };
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = value => { const url = create(value); window.previewUrls.created.push(url); return url; };
    URL.revokeObjectURL = value => { window.previewUrls.revoked.push(value); return revoke(value); };
  });
  const origin = 'http://127.0.0.1:' + server.address().port;
  async function pageFor(suffix = '') {
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/dashboard/progress' + suffix); return page;
  }
  const page = await pageFor(); const opener = page.getByRole('button', { name: 'Ver imagen en la bitácora', exact: true });
  await expect(opener).toBeVisible(); assert.equal(reads.length, 0);
  await page.getByLabel('Título de la bitácora', { exact: true }).fill('Texto local no guardado');
  await opener.click(); const modal = page.getByRole('dialog');
  await expect(modal.getByRole('img', { name: evidence.caption })).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Cerrar visor de evidencia' })).toBeFocused();
  await expect(modal.getByRole('button', { name: 'Acercar' })).toBeEnabled();
  await modal.getByRole('button', { name: 'Acercar' }).click();
  await expect(modal.getByLabel('Ampliación', { exact: true })).toHaveText('150%');
  await modal.getByRole('button', { name: 'Ajustar', exact: true }).click();
  await expect(modal.getByLabel('Ampliación', { exact: true })).toHaveText('100%');
  await modal.getByRole('button', { name: 'Volver a la bitácora' }).focus(); await page.keyboard.press('Tab');
  await expect(modal.getByRole('button', { name: 'Cerrar visor de evidencia' })).toBeFocused();
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const box = await modal.boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= width + 1);
    assert.equal(await modal.evaluate(el => el.scrollWidth <= el.clientWidth), true, 'Dialog overflow at ' + width);
    if ([390, 1280].includes(width)) await page.screenshot({ path: resolve(output, 'viewer-' + width + '.png') });
  }
  await page.keyboard.press('Escape'); await expect(modal).toHaveCount(0); await expect(opener).toBeFocused();
  await expect(page.getByLabel('Título de la bitácora', { exact: true })).toHaveValue('Texto local no guardado');
  const lifecycle = await page.evaluate(() => window.previewUrls);
  assert.ok(lifecycle.created.length >= 1); assert.ok(lifecycle.created.every(url => lifecycle.revoked.includes(url)));
  await page.close();
  for (const errorMode of ['DENIED', 'CONTEXT']) {
    mode = errorMode; const failed = await pageFor(); await failed.getByRole('button', { name: 'Ver imagen en la bitácora' }).click();
    const dialog = failed.getByRole('dialog'); await expect(dialog.getByRole('alert')).toBeVisible();
    await expect(dialog.getByRole('img')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Acercar' })).toBeDisabled();
    if (errorMode === 'CONTEXT') await expect(dialog.getByRole('button', { name: 'Reintentar consulta' })).toHaveCount(0);
    await failed.close();
  }
  const before = reads.length; const denied = await pageFor('?restricted=1');
  await expect(denied.getByRole('button', { name: 'Ver imagen en la bitácora' })).toHaveCount(0);
  assert.equal(reads.length, before); assert.equal(writes.length, 0); assert.deepEqual(errors, []);
  assert.ok(reads.every(read => read.org === 'org-a' && read.project === 'project-a'));
  const proof = { result: 'PASS', environment: 'real-components-with-synthetic-http-and-session', noPreload: true, privateContextOnRead: true, imageDecoded: true, zoomAndReset: true, retainedUnsavedText: true, objectUrlsRevoked: true, deniedAndChangedContextNotRendered: true, keyboardAndFocus: true, widths: [320, 390, 768, 1280], mutations: writes.length, pageErrors: errors.length };
  writeFileSync(resolve(output, 'proof.json'), JSON.stringify(proof, null, 2)); console.log(JSON.stringify(proof));
} finally { await browser?.close(); await new Promise(done => server.close(done)); }
