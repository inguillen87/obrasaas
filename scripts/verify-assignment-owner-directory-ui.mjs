import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import { ownerDirectoryFixture } from '../tests/helpers/owner-directory-fixture.js';
import { scope, actorId } from '../tests/helpers/assignment-overlap-fixture.js';
import { listAssignmentOwners } from '../src/lib/assignment-owner-directory.js';
import { prepareTaskAssignment } from '../src/lib/task-assignments.js';
import { reviewTaskAssignment, planReviewedTaskAssignment } from '../src/lib/assignment-overlap-review.js';

const root = fileURLToPath(new URL('../', import.meta.url)), out = resolve(root, '.vercel/assignment-owner-directory-ui');
mkdirSync(out, { recursive: true });
const fixture = ownerDirectoryFixture(), task = fixture.state.task;
let mode = 'normal', saves = 0, reads = 0; const errors = [];
const entry = `import React,{useState}from'react';import{createRoot}from'react-dom/client';import Planner from'./src/app/dashboard/execution/assignment-planner';import './src/app/globals.css';function App(){const[saved,setSaved]=useState(null);return saved?<p role="status">Asignación guardada: {saved.workerId}</p>:<Planner tasks={[${JSON.stringify(task)}]} focusedTask={${JSON.stringify(task)}} organizationId="org-a" projectId="project-a" onClose={()=>{}} onSaved={setSaved}/>};createRoot(document.getElementById('root')).render(<React.StrictMode><App/>);`;
await build({ stdin: { contents: entry, resolveDir: root, loader: 'jsx' }, outfile: resolve(out, 'bundle.js'), bundle: true, format: 'esm', platform: 'browser', jsx: 'automatic', loader: { '.js': 'jsx' }, alias: { '@': resolve(root, 'src') }, define: { 'process.env.NODE_ENV': '"development"' }, logLevel: 'silent', plugins: [{ name: 'test-link', setup(api) {
  api.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fixture' }));
  api.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ loader: 'jsx', resolveDir: root, contents: `import React from'react';export default function Link({href,onNavigate,prefetch,...props}){return <a href={href} {...props}/>} ` }));
} }] });
const json = (res, body, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://fixture');
  if (url.pathname.startsWith('/api/')) {
    try {
      assert.equal(req.headers['x-obrasaas-organization'], scope.organizationId); assert.equal(req.headers['x-obrasaas-project'], scope.projectId);
      if (url.pathname.endsWith('/owners')) {
        assert.equal(req.method, 'GET'); reads++;
        if (mode === 'fail') { json(res, { code: 'ASSIGNMENT_DIRECTORY_UNAVAILABLE', error: 'Consulta interrumpida de ensayo.' }, 503); return; }
        const input = { taskId: url.searchParams.get('taskId'), expectedTaskRevision: Number(url.searchParams.get('expectedTaskRevision')), ownerKind: url.searchParams.get('ownerKind'), query: url.searchParams.get('query') || '', cursor: url.searchParams.get('cursor') };
        const result = await listAssignmentOwners(fixture.prisma, { scope, input });
        if (mode === 'foreign') result.context = { ...scope, projectId: 'other' };
        if (mode === 'slow') await new Promise(done => setTimeout(done, 300));
        json(res, result); return;
      }
      if (req.method === 'GET') { json(res, await prepareTaskAssignment(fixture.prisma, { scope, taskId: task.id })); return; }
      let raw = ''; for await (const chunk of req) raw += chunk;
      const input = JSON.parse(raw);
      if (url.pathname.endsWith('/review')) { json(res, await reviewTaskAssignment(fixture.prisma, { scope, input })); return; }
      saves++;
      const result = await planReviewedTaskAssignment(fixture.prisma, { scope, actorId, operationKey: req.headers['idempotency-key'], input });
      json(res, result, result.replayed ? 200 : 201);
    } catch (failure) { json(res, { code: failure.code, error: failure.message }, failure.status || 503); }
    return;
  }
  if (['/bundle.js', '/bundle.css'].includes(url.pathname)) { res.setHeader('Content-Type', url.pathname.endsWith('.js') ? 'text/javascript' : 'text/css'); res.end(readFileSync(resolve(out, url.pathname.slice(1)))); return; }
  res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>:root{--font-geist:Arial;--font-manrope:Arial}body{margin:0;background:#060913}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done => server.listen(0, '127.0.0.1', done)); let browser;
try {
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'es-AR' }); page.on('pageerror', error => errors.push(error.message));
  const url = 'http://127.0.0.1:' + server.address().port;
  const modal = page.getByRole('dialog', { name: 'Planificar asignación' });
  const directory = page.getByRole('region', { name: 'Directorio completo de responsables' });
  const start = modal.getByLabel('Inicio previsto', { exact: true }), end = modal.getByLabel('Fin previsto', { exact: true });
  async function open() { await page.goto(url); await expect(modal.getByRole('button', { name: 'Abrir directorio completo' })).toBeEnabled(); await start.fill('2026-09-21'); await end.fill('2026-09-25'); await modal.getByRole('button', { name: 'Abrir directorio completo' }).click(); }
  await open(); await expect(directory.getByRole('button', { name: 'Elegir Persona 000', exact: true })).toBeEnabled();
  await directory.getByRole('button', { name: 'Página siguiente' }).click(); await expect(directory.getByRole('button', { name: 'Elegir Persona 030', exact: true })).toBeEnabled();
  await directory.getByRole('button', { name: 'Página anterior' }).click(); await expect(directory.getByRole('button', { name: 'Elegir Persona 000', exact: true })).toBeEnabled();
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 }); await directory.scrollIntoViewIfNeeded();
    assert.equal(await modal.evaluate(el => el.scrollWidth <= el.clientWidth), true);
    assert.equal(await directory.evaluate(el => el.scrollWidth <= el.clientWidth), true);
    if ([390, 1280].includes(width)) await page.screenshot({ path: resolve(out, 'directory-' + width + '.png') });
  }
  const beforeTyping = reads; await directory.getByLabel('Nombre en el directorio').fill('136 PERSONA');
  await expect(directory.getByRole('button', { name: 'Elegir Persona 000', exact: true })).toBeDisabled(); assert.equal(reads, beforeTyping);
  await directory.getByLabel('Nombre en el directorio').press('Enter');
  await expect(directory.getByRole('button', { name: 'Elegir Persona 136', exact: true })).toBeEnabled(); assert.equal(saves, 0);
  await directory.getByRole('button', { name: 'Elegir Persona 136', exact: true }).click(); await expect(directory).toHaveCount(0);
  await expect(modal.getByRole('combobox', { name: 'Responsable de la asignación' })).toHaveValue('worker-136');
  await expect(start).toHaveValue('2026-09-21'); await expect(end).toHaveValue('2026-09-25');
  await expect(modal.getByRole('button', { name: 'Confirmar planificación' })).toBeDisabled(); assert.equal(saves, 0);
  await modal.getByRole('button', { name: 'Revisar coincidencias', exact: true }).click();
  await expect(modal.getByText('Sin coincidencias detectadas en esta revisión', { exact: true })).toBeVisible();
  await modal.getByRole('checkbox').check(); await modal.getByRole('button', { name: 'Confirmar planificación' }).click();
  await expect(page.getByRole('status')).toHaveText('Asignación guardada: worker-136'); assert.equal(saves, 1); assert.equal(fixture.state.rows.length, 1);
  mode = 'fail'; await open(); await expect(directory.getByRole('alert')).toContainText('Consulta interrumpida'); await expect(start).toHaveValue('2026-09-21');
  mode = 'normal'; await directory.getByRole('button', { name: 'Reintentar esta consulta' }).click(); await expect(directory.getByRole('button', { name: 'Elegir Persona 000', exact: true })).toBeEnabled();
  await directory.getByLabel('Nombre en el directorio').fill('Nadie inexistente'); await directory.getByRole('button', { name: 'Buscar en toda la obra', exact: true }).click(); await expect(directory.getByText(/No hay resultados activos/)).toBeVisible();
  mode = 'foreign'; await page.reload(); await modal.getByRole('button', { name: 'Abrir directorio completo' }).click(); await expect(directory.getByRole('alert')).toContainText('no corresponde'); await expect(directory.getByRole('button', { name: /^Elegir / })).toHaveCount(0);
  mode = 'normal'; await page.reload(); await expect(modal.getByRole('button', { name: 'Abrir directorio completo' })).toBeEnabled(); await start.fill('2026-10-01'); fixture.state.task.revision = 4;
  await modal.getByRole('button', { name: 'Abrir directorio completo' }).click(); await expect(modal.getByRole('button', { name: 'Actualizar actividad y responsables' })).toBeVisible(); await expect(start).toHaveValue('2026-10-01');
  await modal.getByRole('button', { name: 'Actualizar actividad y responsables' }).click(); await expect(modal.getByRole('button', { name: 'Abrir directorio completo' })).toBeEnabled();
  mode = 'slow'; await modal.getByRole('button', { name: 'Abrir directorio completo' }).click(); await directory.getByRole('button', { name: 'Cerrar directorio' }).click(); await page.waitForTimeout(350); await expect(directory).toHaveCount(0);
  assert.equal(saves, 1); assert.equal(fixture.state.audits.length, 1); assert.deepEqual(errors, []);
  const proof = { status: 'PASS', environment: 'real-react-planner-and-domain-services-controlled-HTTP-database-identity', initialDirectorySize: 137, selectedBeyondInitial100: true, pagesForwardAndBack: true, searchOnExplicitAction: true, draftPreserved: true, selectionDoesNotWrite: true, writesAfterReviewAndConsent: 1, failedReadRetry: true, emptyResults: true, foreignResponseRejected: true, changedTaskRequiresRefresh: true, lateResponseIgnored: true, widths: [320, 390, 768, 1280], pageErrors: 0, clerkVerified: false };
  writeFileSync(resolve(out, 'proof.json'), JSON.stringify(proof, null, 2)); console.log(JSON.stringify(proof));
} finally { await browser?.close(); await new Promise(done => server.close(done)); }
