import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, '.vercel/field-gantt-ui'); mkdirSync(output, { recursive: true });
const emptyCounts = { total: 0, approved: 0, pending: 0, rejected: 0, updatedAt: null };
const snapshot = { organizationId: 'org-A', projectId: 'project-A', projectName: 'Obra sintética', canReadMeasurements: true, unassignedParts: 1,
  tasks: [{ id: 'task-A', title: 'Muro de ensayo', type: 'TASK', operationalProgress: 10, revision: 2, startsAt: '2026-09-18', endsAt: '2026-09-23', evidence: { ...emptyCounts, total: 1, approved: 1 }, reports: emptyCounts,
    measured: { percent: '20.0000', completed: '20.0000', baseline: '100.0000', unit: 'M2', revision: 1 } }], page: { limit: 50, hasMore: false, nextAfter: null }, version: 'v1', checkedAt: '2026-09-18T12:00:00Z' };
const tasks = { 'task-A': { name: 'Muro de ensayo', assignee: 'Sin asignar', progress: 10, duration: 6, startDay: 1, revision: 2, dependencies: [] } };
const entry = `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import Panel from './src/app/dashboard/schedule-field-panel';import Gantt from './src/app/dashboard/gantt-planner';
function App(){const [status,setStatus]=useState(null);return <><Panel organizationId="org-A" projectId="project-A" onSnapshot={setStatus}/><Gantt canManage={false} canonicalMode={true} tasks={${JSON.stringify(tasks)}} fieldWorkers={[]} project={{id:'project-A',name:'Obra sintética',startsAt:'2026-09-18'}} fieldStatus={status}/></>}
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);`;
await build({ stdin: { contents: entry, resolveDir: root, loader: 'jsx' }, outfile: resolve(output, 'bundle.js'), bundle: true, format: 'esm', platform: 'browser', jsx: 'automatic', loader: { '.js': 'jsx' }, alias: { '@': resolve(root, 'src') }, define: { 'process.env.NODE_ENV': '"development"' }, logLevel: 'silent', plugins: [{ name: 'next-fixture', setup(api) {
  api.onResolve({ filter: /^next\/(link|navigation)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
  api.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'jsx', contents: args.path.endsWith('/link') ? `import React from 'react';export default function Link({href,onNavigate,prefetch,...props}){return <a {...props} href={href}/>}` : `export const useSearchParams=()=>new URLSearchParams(location.search);`, resolveDir: root }));
} }] });
let deny = false; const reads = [], errors = [];
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://local').pathname;
  if (path === '/blank') { res.setHeader('Content-Type','text/html'); res.end('<title>Emisor de invalidaciÃ³n sintÃ©tico</title>'); return; }
  if (path === '/api/schedule/field-status') {
    reads.push({ org: req.headers['x-obrasaas-organization'], project: req.headers['x-obrasaas-project'], conditional: req.headers['if-none-match'] });
    const etag = '"field-' + snapshot.version + '"';
    res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.setHeader('ETag', etag); res.setHeader('X-ObraSaaS-Checked-At', new Date().toISOString());
    if (deny) { res.statusCode = 403; res.end('{"error":"Acceso revocado"}'); return; }
    if (req.headers['if-none-match'] === etag) { res.statusCode = 304; res.end(); return; }
    res.end(JSON.stringify(snapshot)); return;
  }
  if (path === '/bundle.js' || path === '/bundle.css') { res.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : 'text/css'); res.end(readFileSync(resolve(output, path.slice(1)))); return; }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>body{margin:0;background:#060913;color:#f8fafc;font:16px Arial;--primary:#f59e0b;--success:#10b981;--border-color:#334155;--text-secondary:#94a3b8}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const origin = 'http://127.0.0.1:' + server.address().port;
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message)); await page.goto(origin + '/dashboard?tab=sec-gantt');
  const panel = page.getByRole('region', { name: 'Evidencia y avance en el cronograma' });
  await expect(panel.getByText('20%', { exact: true })).toBeVisible(); await expect(panel.getByText('10%', { exact: true })).toBeVisible();
  await expect(page.getByText(/1 evidencias · 0 partes · Medido 20%/)).toBeVisible();
  const signalPage = await context.newPage(); await signalPage.goto(origin + '/blank');
  async function signal(organizationId = 'org-A') { await signalPage.evaluate(org => { const channel = new BroadcastChannel('obrasaas-field-invalidations-v1'); channel.postMessage({ version: 1, organizationId: org, projectId: 'project-A' }); channel.close(); }, organizationId); }
  await page.bringToFront(); await page.waitForTimeout(250);
  const before = reads.length; await signal('other-org'); await page.waitForTimeout(250); assert.equal(reads.length, before);
  snapshot.tasks[0].evidence.total = 2; snapshot.tasks[0].evidence.pending = 1; snapshot.version = 'v2';
  await page.bringToFront(); await signal();
  await expect(page.getByText(/2 evidencias · 0 partes · Medido 20%/)).toBeVisible();
  snapshot.tasks[0].measured.percent = '30.0000'; snapshot.tasks[0].measured.completed = '30.0000'; snapshot.tasks[0].measured.revision = 2; snapshot.version = 'v3';
  await expect(panel.getByText('30%', { exact: true })).toBeVisible({ timeout: 14000 });
  await expect(panel.getByText('10%', { exact: true })).toBeVisible();
  await expect(page.getByText(/2 evidencias · 0 partes · Medido 30%/)).toBeVisible();
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const box = await panel.boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= width + 1, 'Panel horizontal overflow at ' + width);
    assert.equal(await panel.evaluate(el => el.scrollWidth <= el.clientWidth), true);
    if (width === 390 || width === 1280) await panel.screenshot({ path: resolve(output, 'field-gantt-' + width + '.png') });
  }
  assert.equal(await panel.getByRole('link', { name: 'Ver partes y evidencias' }).getAttribute('href'), '/dashboard/progress?taskId=task-A');
  assert.equal(await panel.getByRole('link', { name: 'Consultar medición' }).getAttribute('href'), '/dashboard/measurements?taskId=task-A');
  await panel.getByRole('button', { name: 'Actualizar ahora' }).click();
  await page.waitForTimeout(200); assert.ok(reads.some(read => read.conditional));
  deny = true; await signal();
  await expect(panel.getByRole('alert')).toHaveText('Acceso revocado');
  await expect(panel.getByText('30%', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Medido 30%/)).toHaveCount(0);
  assert.ok(reads.every(read => read.org === 'org-A' && read.project === 'project-A')); assert.deepEqual(errors, []);
  const proof = { result: 'PASS', environment: 'real-panel-and-gantt-with-synthetic-HTTP', serverAuthoritative: true, crossTabInvalidation: true, otherTenantSignalIgnored: true, periodicCrossDeviceRecovery: true, measuredLayerSeparateFromManual: true, conditionalReads: true, revocationClearsFieldData: true, widths: [320,390,768,1280], pageErrors: errors.length };
  writeFileSync(resolve(output, 'proof.json'), JSON.stringify(proof, null, 2)); console.log(JSON.stringify(proof));
} finally { await browser?.close(); await new Promise(done => server.close(done)); }
