import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, '.vercel/evidence-capture-fixture');
mkdirSync(output, { recursive: true });
// Full production client component with synthetic identity and local HTTP fixtures only.
const entry = `import React from 'react';
import {createRoot} from 'react-dom/client';
import ProgressClient from './src/app/dashboard/progress/progress-client';
const props={organizationId:'fixture-org',projectId:'fixture-project',projectName:'Obra de ensayo UX',initialWorkDate:'2026-09-18',initialData:{dailyLogs:[],evidence:[],timeline:[],page:{hasMore:false}},tasks:[{id:'fixture-task',title:'Tarea sintética de evidencia'}],workers:[],permissions:{canManage:true,canReviewJournal:false,canReadSourceEvidence:true,canUseReviewedEvidence:false,canUseVisualProgress:false,visualProgressEnabled:false}};
createRoot(document.getElementById('root')).render(<React.StrictMode><ProgressClient {...props}/></React.StrictMode>);`;
const linkAdapter = "import React from 'react'; export default function Link({href,children}) { return <a href={href}>{children}</a>; }";
await build({
  stdin: { contents: entry, resolveDir: root, loader: 'jsx' },
  outfile: resolve(output, 'bundle.js'), bundle: true, format: 'esm', platform: 'browser', jsx: 'automatic',
  loader: { '.js': 'jsx' }, alias: { '@': resolve(root, 'src') }, define: { 'process.env.NODE_ENV': '"development"' },
  plugins: [{ name: 'local-navigation', setup(api) {
    api.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fixture' }));
    api.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ loader: 'jsx', contents: linkAdapter, resolveDir: root }));
  } }], logLevel: 'silent',
});
let uploads = 0, attachRequests = 0;
const operations = [], headersSeen = [];
const server = createServer((request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  if (request.method === 'POST') {
    const parts = [];
    request.on('data', chunk => parts.push(chunk));
    request.on('end', () => {
      headersSeen.push({ organization: request.headers['x-obrasaas-organization'], project: request.headers['x-obrasaas-project'] });
      response.setHeader('Content-Type', 'application/json');
      if (path === '/api/progress/upload') {
        uploads++; response.writeHead(201); response.end(JSON.stringify({ uploadId: 'fixture-upload' })); return;
      }
      const body = JSON.parse(Buffer.concat(parts).toString()); operations.push(body); attachRequests++;
      if (attachRequests === 1) {
        response.writeHead(503); response.end(JSON.stringify({ error: 'Respuesta de registro incierta (ensayo)' })); return;
      }
      if (attachRequests === 2) { response.writeHead(409); response.end(JSON.stringify({ code: 'EVIDENCE_CONTEXT_CHANGED', error: 'Volvé a la obra original (ensayo)' })); return; }
      response.end(JSON.stringify({ evidence: { id: 'fixture-evidence', taskId: body.taskId, caption: body.caption, capturedAt: body.capturedAt, status: 'PENDING', revision: 0, attachment: { available: false } } }));
    }); return;
  }
  const asset = path === '/bundle.js' ? ['bundle.js','text/javascript'] : path === '/bundle.css' ? ['bundle.css','text/css'] : null;
  if (asset) { response.setHeader('Content-Type', asset[1]); response.end(readFileSync(resolve(output, asset[0]))); return; }
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>body{margin:0;background:#060913;color:white;font-family:Arial,sans-serif}*{box-sizing:border-box}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:' + server.address().port + '/dashboard/progress');
  const fileInput = page.getByLabel('Archivo de evidencia', { exact: true });
  const send = page.getByRole('button', { name: 'Guardar evidencia para revisión', exact: true });
  await expect(send).toBeDisabled();
  await page.getByLabel('Tarea vinculada a la evidencia', { exact: true }).selectOption('fixture-task');
  await fileInput.setInputFiles({ name: 'no-admitido.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await expect(page.getByRole('alert')).toContainText('Formato no admitido'); await expect(send).toBeDisabled();
  assert.equal(uploads, 0);
  const chooserPromise = page.waitForEvent('filechooser'); await fileInput.click();
  const chooser = await chooserPromise;
  await chooser.setFiles(resolve(root, 'public/brand/obrasaas-app-icon-192.png'));
  const preview = page.getByAltText('Vista previa local del archivo seleccionado');
  await expect(preview).toBeVisible(); await expect(preview).toHaveJSProperty('complete', true);
  await expect(preview).toHaveAttribute('src', /^blob:/);
  await page.getByLabel('Descripción de la evidencia', { exact: true }).fill('ENSAYO - archivo sintético, sin obra física');
  await send.click();
  await expect(page.getByText('Resultado por confirmar', { exact: true })).toBeVisible();
  await expect(fileInput).toBeDisabled(); await expect(page.getByLabel('Tarea vinculada a la evidencia', { exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Reintentar la misma evidencia', exact: true }).click();
  await expect(page.getByText('Verificá la sesión y la obra', { exact: true })).toBeVisible();
  await expect(fileInput).toBeDisabled();
  await page.getByRole('button', { name: 'Reintentar en la obra original', exact: true }).click();
  await expect(page.getByText('Evidencia guardada', { exact: true })).toBeVisible();
  assert.equal(uploads, 1); assert.equal(attachRequests, 3);
  assert.deepEqual(operations[0], operations[1]); assert.deepEqual(operations[1], operations[2]);
  assert.ok(headersSeen.every(item => item.project === 'fixture-project' && item.organization === 'fixture-org'));
  await expect(page.locator('#evidence-fixture-evidence')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Aprobar', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Ver evidencia guardada y su estado' }).click();
  assert.equal(new URL(page.url()).hash, '#evidence-fixture-evidence');
  const widths = [];
  for (const width of [320,390,768,1280]) {
    await page.setViewportSize({ width, height: 900 });
    const bounds = await page.locator('#capture-evidence').boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1, 'Capture width at ' + width);
    assert.equal(await page.locator('#capture-evidence').evaluate(node => node.scrollWidth <= node.clientWidth + 1), true);
    await page.locator('#capture-evidence').screenshot({ path: resolve(output, 'capture-' + width + '.png') });
    widths.push(width);
  }
  assert.deepEqual(errors, []);
  const result = { result: 'PASS', environment: 'local-synthetic-http', realClientComponent: true, nativeFileChooser: true,
    localPreview: true, invalidFileBlocked: true, uploads, attachRequests, sameIdempotentRetry: true, scopeHeaders: true, explicitContextRecovery: true,
    reviewControlsAbsentForCaptureRole: true, captureWidths: widths, pageErrors: 0, limits: 'Synthetic provider/server; no live storage, phone or tenant authorization certification.' };
  writeFileSync(resolve(output, 'result.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} finally { await browser?.close(); await new Promise(done => server.close(done)); }
