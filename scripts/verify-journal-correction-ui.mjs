import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
const root = fileURLToPath(new URL('../', import.meta.url)), out = resolve(root, '.vercel/journal-correction-ui'); mkdirSync(out, { recursive: true });
const source = { id: 'source-a', projectId: 'project-a', taskId: 'task-a', authorWorkerId: null, title: 'Parte sintético de mampostería', summary: 'Muro terminado.', workDate: '2026-09-18', status: 'REJECTED', revision: 2, rejectionReason: 'Faltan cantidad y sector.', createdAt: '2026-09-18T12:00:00Z', version: 'a'.repeat(64) };
const data = { dailyLogs: [source], evidence: [], timeline: [], page: { limit: 50, hasMore: false } };
const entry = `import React from 'react';import{createRoot}from'react-dom/client';import Client from './src/app/dashboard/progress/progress-client';
createRoot(document.getElementById('root')).render(<React.StrictMode><Client initialData={${JSON.stringify(data)}} initialVisualAssessments={[]} tasks={[{id:'task-a',title:'Mampostería · Sector norte',type:'TASK'}]} workers={[]} permissions={{canManage:true,canReadSchedule:!location.search.includes('reader'),canReviewJournal:true,canReadSourceEvidence:false}} organizationId="org-a" projectId="project-a" projectName="Obra sintética · Correcciones" initialWorkDate="2026-09-18"/></React.StrictMode>);`;
await build({ stdin: { contents: entry, resolveDir: root, loader: 'jsx' }, outfile: resolve(out, 'bundle.js'), bundle: true, format: 'esm', platform: 'browser', jsx: 'automatic', loader: { '.js': 'jsx' }, alias: { '@': resolve(root, 'src') }, define: { 'process.env.NODE_ENV': '"development"' }, logLevel: 'silent', plugins: [{ name: 'links', setup(api) {
  api.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fixture' }));
  api.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ loader: 'jsx', resolveDir: root, contents: `import React from 'react';export default function Link({href,onNavigate,prefetch,...props}){return <a {...props} href={href} onClick={e=>onNavigate?.(e)}/>}` }));
} }] });
let mode = 'SUCCESS', child = null, lost = false; const calls = [], errors = [];
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://local').pathname;
  if (path === '/api/progress/source-a/correction') {
    res.setHeader('Content-Type', 'application/json');
    assert.equal(req.headers['x-obrasaas-project'], 'project-a'); assert.equal(req.headers['x-obrasaas-organization'], 'org-a');
    if (req.method === 'GET') { res.end(JSON.stringify({ source, existing: mode === 'EXISTING' ? child : null })); return; }
    let text = ''; req.on('data', chunk => { text += chunk; }); req.on('end', () => {
      const command = JSON.parse(text); calls.push({ method: 'CORRECT', command, key: req.headers['idempotency-key'], mode });
      if (mode === 'CONFLICT') { res.statusCode = 409; res.end('{"error":"El origen cambió."}'); return; }
      child ||= { id: 'jcor_fixture', projectId: 'project-a', taskId: command.taskId, title: command.title, summary: command.summary, workDate: source.workDate, status: 'DRAFT', revision: 0, createdAt: new Date().toISOString(), correctionOf: { id: source.id, title: source.title, status: source.status, revision: source.revision } };
      if (mode === 'LOST' && !lost) { lost = true; res.statusCode = 503; res.end('{"error":"Respuesta incierta"}'); return; }
      res.statusCode = 201; res.end(JSON.stringify(mode === 'MALFORMED' ? {} : { dailyLog: child, source: { id: source.id }, replayed: mode === 'LOST' }));
    }); return;
  }
  if (path === '/api/progress/jcor_fixture' && req.method === 'PATCH') {
    let text = ''; req.on('data', chunk => { text += chunk; }); req.on('end', () => {
      const input = JSON.parse(text); calls.push({ method: 'REVIEW', input });
      assert.equal(input.expectedRevision, child.revision); child = { ...child, status: input.status, revision: child.revision + 1 };
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ dailyLog: child }));
    }); return;
  }
  if (path === '/bundle.js' || path === '/bundle.css') { res.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : 'text/css'); res.end(readFileSync(resolve(out, path.slice(1)))); return; }
  res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>body{margin:0;background:#060913;color:#f8fafc;font:16px Arial}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 950 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const origin = 'http://127.0.0.1:' + server.address().port;
  async function open(suffix = '') { const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message)); await page.goto(origin + suffix); return page; }
  async function edit(page) {
    await page.getByRole('button', { name: 'Preparar corrección', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Preparar una corrección' });
    await expect(dialog.getByLabel('Título corregido', { exact: true })).toHaveValue(source.title);
    await dialog.getByLabel('Detalle corregido', { exact: true }).fill('Se registran 12 m2 del sector norte para nueva revisión.'); return dialog;
  }
  const page = await open(); await page.getByRole('button', { name: 'Preparar corrección' }).click();
  let modal = page.getByRole('dialog', { name: 'Preparar una corrección' });
  await expect(modal.getByRole('button', { name: 'Cerrar corrección' })).toBeFocused();
  await expect(modal.getByRole('button', { name: 'Crear borrador corregido' })).toBeDisabled();
  await page.keyboard.press('Escape'); await expect(modal).toHaveCount(0); assert.equal(calls.length, 0);
  modal = await edit(page);
  page.once('dialog', dialog => dialog.dismiss()); await modal.getByRole('button', { name: 'Volver sin corregir' }).click();
  await expect(modal.getByLabel('Detalle corregido', { exact: true })).toHaveValue('Se registran 12 m2 del sector norte para nueva revisión.');
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 950 }); const box = await modal.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= width + 1); assert.equal(await modal.evaluate(el => el.scrollWidth <= el.clientWidth), true);
    await expect(modal.getByRole('button', { name: 'Cerrar corrección' })).toBeVisible();
    if ([390,1280].includes(width)) await page.screenshot({ path: resolve(out, 'correction-' + width + '.png') });
  }
  await modal.getByRole('button', { name: 'Crear borrador corregido' }).click(); await expect(modal).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Abrir el parte corregido' })).toBeVisible();
  await expect(page.getByText(source.rejectionReason, { exact: true })).toBeVisible();
  const card = page.locator('#daily-log-jcor_fixture');
  await card.getByRole('button', { name: 'Enviar', exact: true }).click();
  await card.getByRole('button', { name: 'Aprobar', exact: true }).click();
  await page.getByRole('dialog', { name: 'Revisar aprobación' }).getByRole('button', { name: 'Confirmar aprobación' }).click();
  await expect(card.getByText('Aprobado', { exact: false }).first()).toBeVisible();
  await expect(card.getByRole('link', { name: 'Ver original: ' + source.title })).toBeVisible();
  assert.equal(source.status, 'REJECTED'); assert.equal(source.revision, 2); assert.equal(child.status, 'APPROVED'); await page.close();
  mode = 'EXISTING'; const existing = await open(); await existing.getByRole('button', { name: 'Preparar corrección' }).click();
  await expect(existing.getByRole('heading', { name: 'Este parte ya tiene una corrección' })).toBeVisible();
  await expect(existing.getByRole('button', { name: 'Crear borrador corregido' })).toHaveCount(0); await existing.close();
  for (const scenario of ['LOST', 'MALFORMED', 'CONFLICT']) {
    mode = scenario; child = null; lost = false; const trial = await open(); const view = await edit(trial);
    await view.getByRole('button', { name: 'Crear borrador corregido' }).click();
    await expect(view.getByRole('alert')).toBeVisible();
    await expect(view.getByLabel('Detalle corregido', { exact: true })).toHaveValue('Se registran 12 m2 del sector norte para nueva revisión.');
    if (scenario === 'LOST') {
      await view.getByRole('button', { name: 'Verificar el mismo intento' }).click(); await expect(view).toHaveCount(0);
      const retries = calls.filter(call => call.mode === 'LOST'); assert.equal(retries.length, 2); assert.equal(retries[0].key, retries[1].key); assert.deepEqual(retries[0].command, retries[1].command);
    } else if (scenario === 'CONFLICT') await expect(view.getByRole('button', { name: 'Crear borrador corregido' })).toBeDisabled();
    await trial.close();
  }
  const reader = await open('?reader=1'); await expect(reader.getByRole('button', { name: 'Preparar corrección' })).toHaveCount(0); await reader.close();
  assert.deepEqual(errors, []); assert.equal(calls.length, 7);
  const proof = { result: 'PASS', environment: 'real-journal-components-with-synthetic-HTTP-and-roles', sourcePreserved: true, rejectCorrectSubmitApprove: true,
    noWriteOnOpenCancel: true, existingCorrectionRecovered: true, identicalRetry: true, incompleteResponseNotConfirmed: true, conflictPreservesInput: true, unauthorizedActionHidden: true,
    widths: [320,390,768,1280], capturedRequests: calls.length, pageErrors: errors.length };
  writeFileSync(resolve(out, 'proof.json'), JSON.stringify(proof, null, 2)); console.log(JSON.stringify(proof));
} finally { await browser?.close(); await new Promise(done => server.close(done)); }
