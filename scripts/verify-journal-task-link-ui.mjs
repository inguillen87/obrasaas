import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
const root = fileURLToPath(new URL('../', import.meta.url)), output = resolve(root, '.vercel/journal-task-link-ui'); mkdirSync(output, { recursive: true });
const entry = `import React from 'react';import {createRoot} from 'react-dom/client';import Journal from './src/app/dashboard/progress/progress-client';import Field from './src/app/dashboard/campo/field-client';
const task={id:'task-a',type:'TASK',title:'Mampostería · Sector norte'};
const log={id:'log-a',projectId:'project-a',taskId:null,title:'Parte sintético pendiente',summary:'Registro de prueba, sin trabajo físico asociado.',status:location.search.includes('final')?'APPROVED':'DRAFT',revision:0,workDate:'2026-09-18'};
const data={dailyLogs:[log],evidence:[],timeline:[],page:{limit:50,hasMore:false,nextBefore:null}};
createRoot(document.getElementById('root')).render(<React.StrictMode>{location.pathname==='/field'?<Field project={{organizationId:'org-a',id:'project-a',name:'Obra demo',organization:'Empresa demo',status:'ACTIVE'}} workDate="2026-09-18" counts={{workers:0,tasks:1}} taskOptions={[task]} canReadTasks={true} channel={{label:'Sin conexión',summary:'Canal no configurado'}} permissions={{write:true,tasks:true}}/>:<Journal initialData={data} tasks={[task]} workers={[]} permissions={{canManage:true,canReadSchedule:true,canReadSourceEvidence:false,canReviewJournal:true}} projectName="Obra demo" organizationId="org-a" projectId="project-a" initialWorkDate="2026-09-18" unassignedOnly={location.search.includes('inbox')}/>}</React.StrictMode>);`;
await build({ stdin: { contents: entry, resolveDir: root, loader: 'jsx' }, outfile: resolve(output, 'bundle.js'), bundle: true, format: 'esm', platform: 'browser', jsx: 'automatic', loader: { '.js': 'jsx' }, alias: { '@': resolve(root, 'src') }, define: { 'process.env.NODE_ENV': '"development"' }, logLevel: 'silent', plugins: [{ name: 'fixture-link', setup(api) {
  api.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fixture' }));
  api.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ loader: 'jsx', contents: `import React from 'react';export default function Link({href,onNavigate,onClick,prefetch,...props}){return <a {...props} href={href} onClick={e=>{onClick?.(e);if(!e.defaultPrevented)onNavigate?.(e);}}/>}`, resolveDir: root }));
} }] });
const requests = [], errors = []; let uncertain = false, failedOnce = false; const receipts = new Set();
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://local').pathname;
  if (path === '/api/field/reports' || path === '/api/progress/log-a/task') {
    let raw = ''; req.on('data', c => { raw += c; }); req.on('end', () => {
      const input = JSON.parse(raw), key = req.headers['idempotency-key']; const replayed = receipts.has(key); receipts.add(key); requests.push({ path, input, key, org: req.headers['x-obrasaas-organization'], project: req.headers['x-obrasaas-project'] });
      res.setHeader('Content-Type', 'application/json');
      if (uncertain && !failedOnce) { failedOnce = true; res.statusCode = 503; res.end('{"error":"Respuesta no confirmada"}'); return; }
      res.end(JSON.stringify(path === '/api/field/reports' ? { report: { id: 'new-field', title: input.title, status: 'DRAFT', revision: 0, taskId: input.taskId || null } } : { dailyLog: { id: 'log-a', projectId: 'project-a', title: 'Parte sintético pendiente', summary: 'Registro de prueba, sin trabajo físico asociado.', taskId: input.taskId, revision: 1, status: 'DRAFT', workDate: '2026-09-18' }, assignment: { taskId: input.taskId, appliedRevision: 1, replayed } }));
    }); return;
  }
  if (path === '/bundle.js' || path === '/bundle.css') { res.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : 'text/css'); res.end(readFileSync(resolve(output, path.slice(1)))); return; }
  if (path === '/sw.js') { res.statusCode = 404; res.end(); return; }
  res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>body{margin:0;background:#060913;color:white;font:16px Arial}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done => server.listen(0, '127.0.0.1', done)); let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true }); const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const origin = 'http://127.0.0.1:' + server.address().port;
  const open = async path => { const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message)); await page.goto(origin + path); return page; };
  const field = await open('/field'); field.setDefaultTimeout(8000); await field.getByLabel('Tarea de la obra', { exact: true }).selectOption('task-a');
  await field.getByLabel('Título', { exact: true }).fill('Parte con tarea desde campo'); await field.getByLabel('Sector o ubicación', { exact: true }).fill('Sector norte'); await field.getByLabel('Detalle', { exact: true }).fill('Dato sintético de vinculación directa.');
  await field.getByRole('button', { name: 'Guardar parte en la obra', exact: true }).click(); await expect(field.getByText('Guardado confirmado por el servidor', { exact: true })).toBeVisible();
  assert.equal(requests[0].input.taskId, 'task-a'); await field.close();
  const page = await open('/dashboard/progress?inbox=1'); const link = page.getByRole('button', { name: 'Vincular a una tarea', exact: true }); await link.click();
  const dialog = page.getByRole('dialog'); await expect(dialog.getByRole('button', { name: 'Volver sin cambios' })).toBeFocused(); await expect(dialog.getByRole('button', { name: 'Confirmar vinculación' })).toBeDisabled();
  const before = requests.length; await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); assert.equal(requests.length, before); await expect(link).toBeFocused();
  await link.click(); await dialog.getByLabel('Tarea de destino', { exact: true }).selectOption('task-a');
  page.once('dialog', event => event.dismiss()); await dialog.getByRole('button', { name: 'Volver sin cambios' }).click(); await expect(dialog.getByLabel('Tarea de destino', { exact: true })).toHaveValue('task-a');
  for (const width of [320, 390, 768, 1280]) { await page.setViewportSize({ width, height: 900 }); const box = await dialog.boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= width + 1); assert.equal(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth), true); if ([390,1280].includes(width)) await page.screenshot({ path: resolve(output, 'link-' + width + '.png') }); }
  await dialog.getByRole('button', { name: 'Confirmar vinculación' }).click(); await expect(dialog).toHaveCount(0); await expect(page.getByText(/Parte vinculado. La tarea del Gantt/)).toBeVisible(); await expect(page.getByText('Parte sintético pendiente', { exact: true })).toHaveCount(0); await page.close();
  uncertain = true; const retryPage = await open('/dashboard/progress'); await retryPage.getByRole('button', { name: 'Vincular a una tarea', exact: true }).click(); const modal = retryPage.getByRole('dialog'); await modal.getByLabel('Tarea de destino', { exact: true }).selectOption('task-a');
  await modal.getByRole('button', { name: 'Confirmar vinculación' }).click(); await expect(modal.getByRole('alert')).toBeVisible(); await expect(modal.getByLabel('Tarea de destino', { exact: true })).toBeDisabled();
  await modal.getByRole('button', { name: 'Verificar el mismo intento' }).click(); await expect(modal).toHaveCount(0); await expect(retryPage.getByText('Tarea: Mampostería · Sector norte', { exact: true })).toBeVisible();
  assert.equal(requests.at(-1).key, requests.at(-2).key); assert.deepEqual(requests.at(-1).input, requests.at(-2).input); await retryPage.close();
  const final = await open('/dashboard/progress?final=1'); await expect(final.getByRole('button', { name: 'Vincular a una tarea', exact: true })).toHaveCount(0); await final.close();
  assert.equal(requests.length, 4); assert.equal(receipts.size, 3); assert.ok(requests.filter(req => req.path.endsWith('/task')).every(req => req.org === 'org-a' && req.project === 'project-a')); assert.deepEqual(errors, []);
  const proof = { result: 'PASS', environment: 'real-field-and-journal-components-synthetic-HTTP', directTaskCapture: true, noMutationOnOpenOrCancel: true, draftSelectionRetained: true, linkedDraftRemovedFromInbox: true, retryUsesSameKeyAndContent: true, reviewedRecordNotRelinkable: true, focusAndEscape: true, widths: [320,390,768,1280], requests: requests.length, operations: receipts.size, pageErrors: errors.length };
  writeFileSync(resolve(output, 'proof.json'), JSON.stringify(proof, null, 2)); console.log(JSON.stringify(proof));
} finally { await browser?.close(); await new Promise(done => server.close(done)); }
