import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, '.vercel/progress-context-ui');
mkdirSync(output, { recursive: true });
const entry = `import React from 'react';import {createRoot} from 'react-dom/client';
import ProgressClient from './src/app/dashboard/progress/progress-client';
createRoot(document.getElementById('root')).render(<React.StrictMode><ProgressClient
 initialData={{dailyLogs:[],evidence:[],timeline:[],page:{limit:50,hasMore:false,nextBefore:null}}}
 tasks={[]} workers={[]} permissions={{canManage:true,canReadSourceEvidence:false,canReviewJournal:true}}
 projectName="Obra sintética · Ensayo de contexto" organizationId="org-A" projectId="project-A" initialWorkDate="2026-09-18"/></React.StrictMode>);`;
await build({ stdin: { contents: entry, resolveDir: root, loader: 'jsx' }, outfile: resolve(output, 'bundle.js'), bundle: true, format: 'esm', platform: 'browser', jsx: 'automatic', loader: { '.js': 'jsx' }, alias: { '@': resolve(root, 'src') }, define: { 'process.env.NODE_ENV': '"development"' }, logLevel: 'silent', plugins: [{ name: 'local-link', setup(api) {
  api.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fixture' }));
  api.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ loader: 'jsx', contents: `import React from 'react';export default function Link({href,onNavigate,onClick,prefetch,...props}){return <a {...props} href={href} onClick={event=>{onClick?.(event);if(!event.defaultPrevented)onNavigate?.(event);}}/>}`, resolveDir: root }));
} }] });
let mode = 'CONTEXT';
const requests = [], errors = [];
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/api/progress' && req.method === 'POST') {
    let body = ''; req.on('data', c => { body += c; }); req.on('end', () => {
      const input = JSON.parse(body); requests.push({ mode, organization: req.headers['x-obrasaas-organization'], project: req.headers['x-obrasaas-project'], input });
      res.writeHead(mode === 'CONTEXT' ? 409 : 201, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(mode === 'CONTEXT' ? { code: 'EVIDENCE_CONTEXT_CHANGED', error: 'La obra activa cambió.' } : mode === 'MALFORMED' ? {} : { dailyLog: { id: 'synthetic-log', title: input.title, summary: input.summary, status: 'DRAFT', revision: 0, workDate: input.workDate } }));
    }); return;
  }
  if (path === '/bundle.js' || path === '/bundle.css') { res.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : 'text/css'); res.end(readFileSync(resolve(output, path.slice(1)))); return; }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>body{margin:0;background:#060913;color:white;font-family:Arial,sans-serif}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const origin = 'http://127.0.0.1:' + server.address().port;
  async function edit() {
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + '/dashboard/progress');
    await page.getByLabel('Título de la bitácora', { exact: true }).fill('Ensayo de continuidad');
    await page.getByLabel('Resumen de la bitácora', { exact: true }).fill('Texto sintético que debe conservarse.');
    await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
    return page;
  }
  const stale = await edit();
  await expect(stale.getByRole('heading', { name: 'La obra activa cambió', exact: true })).toBeVisible();
  await expect(stale.getByLabel('Título de la bitácora', { exact: true })).toHaveValue('Ensayo de continuidad');
  await expect(stale.getByRole('button', { name: 'Verificá la obra activa', exact: true })).toBeDisabled();
  await stale.getByRole('button', { name: 'Copiar texto del borrador' }).click();
  await expect(stale.getByText('Texto copiado.', { exact: false })).toBeVisible();
  assert.match(await stale.evaluate(() => navigator.clipboard.readText()), /Texto sintético/);
  stale.once('dialog', async dialog => { assert.equal(dialog.type(), 'confirm'); await dialog.dismiss(); });
  await stale.getByRole('button', { name: 'Recargar esta bitácora' }).click();
  await expect(stale.getByLabel('Resumen de la bitácora', { exact: true })).toHaveValue('Texto sintético que debe conservarse.');
  assert.equal(await stale.getByRole('link', { name: 'Ver obra activa en otra pestaña' }).getAttribute('target'), '_blank');
  for (const width of [320, 390, 768, 1280]) {
    await stale.setViewportSize({ width, height: 900 });
    assert.equal(await stale.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Horizontal overflow: ' + width);
    if (width === 390 || width === 1280) await stale.screenshot({ path: resolve(output, 'context-' + width + '.png'), fullPage: true });
  }
  await stale.close();
  mode = 'MALFORMED'; const malformed = await edit();
  await expect(malformed.getByText(/El servidor no devolvió un parte válido/)).toBeVisible();
  await expect(malformed.getByLabel('Título de la bitácora', { exact: true })).toHaveValue('Ensayo de continuidad');
  await malformed.close();
  mode = 'SUCCESS'; const success = await edit();
  await expect(success.getByText('Bitácora guardada como borrador.')).toBeVisible();
  await expect(success.getByLabel('Título de la bitácora', { exact: true })).toHaveValue('');
  assert.equal(requests.length, 3);
  assert.ok(requests.every(r => r.organization === 'org-A' && r.project === 'project-A'));
  assert.deepEqual(errors, []);
  const proof = { result: 'PASS', environment: 'isolated-real-client-component-with-synthetic-HTTP', contextHeaders: true, changedContextStopsSave: true, draftPreserved: true, copyDraft: true, cancelReloadPreservesDraft: true, incompleteResponseNotConfirmed: true, confirmedSave: true, widths: [320, 390, 768, 1280], requests: requests.length, pageErrors: errors.length };
  writeFileSync(resolve(output, 'proof.json'), JSON.stringify(proof, null, 2)); console.log(JSON.stringify(proof));
} finally { await browser?.close(); await new Promise(done => server.close(done)); }
