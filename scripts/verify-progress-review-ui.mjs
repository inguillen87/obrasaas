import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, '.vercel/progress-review-ui'); mkdirSync(output, { recursive: true });
const dailyLog = { id: 'demo-review', projectId: 'project-A', title: 'Parte sintético · Mampostería norte', summary: 'Registro de ensayo. No representa una obra física.', status: 'SUBMITTED', revision: 1, workDate: '2026-09-18' };
const data = { dailyLogs: [dailyLog], evidence: [], timeline: [], page: { limit: 50, hasMore: false } };
const entry = `import React from 'react';import {createRoot} from 'react-dom/client';
import ProgressClient from './src/app/dashboard/progress/progress-client';
createRoot(document.getElementById('root')).render(<React.StrictMode><ProgressClient initialData={${JSON.stringify(data)}}
 tasks={[]} workers={[]} permissions={{canManage:true,canReadSourceEvidence:true,canReviewJournal:!location.search.includes('reader')}}
 projectName="Obra de ensayo · Revisión" organizationId="org-A" projectId="project-A" initialWorkDate="2026-09-18"/></React.StrictMode>);`;
await build({ stdin: { contents: entry, resolveDir: root, loader: 'jsx' }, outfile: resolve(output, 'bundle.js'), bundle: true, format: 'esm', platform: 'browser', jsx: 'automatic', loader: { '.js': 'jsx' }, alias: { '@': resolve(root, 'src') }, define: { 'process.env.NODE_ENV': '"development"' }, logLevel: 'silent', plugins: [{ name: 'local-link', setup(api) {
  api.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fixture' }));
  api.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ loader: 'jsx', contents: `import React from 'react';export default function Link({href,onNavigate,onClick,prefetch,...props}){return <a {...props} href={href} onClick={event=>{onClick?.(event);if(!event.defaultPrevented)onNavigate?.(event);}}/>}`, resolveDir: root }));
} }] });
const calls = [], errors = []; let mode = 'SUCCESS';
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://local').pathname;
  if (path === '/api/progress/demo-review' && req.method === 'PATCH') {
    let raw = ''; req.on('data', chunk => { raw += chunk; }); req.on('end', () => {
      const input = JSON.parse(raw); calls.push({ input, org: req.headers['x-obrasaas-organization'], project: req.headers['x-obrasaas-project'], mode });
      const result = mode === 'CONFLICT' ? { code: 'PROGRESS_JOURNAL_CONFLICT', error: 'El registro cambió.' } : mode === 'MALFORMED' ? {} : { dailyLog: { ...dailyLog, status: input.status, revision: 2, rejectionReason: input.reviewNote } };
      res.writeHead(mode === 'CONFLICT' ? 409 : 200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(result));
    }); return;
  }
  if (path === '/api/progress') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); return; }
  if (path === '/bundle.js' || path === '/bundle.css') { res.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : 'text/css'); res.end(readFileSync(resolve(output, path.slice(1)))); return; }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>body{margin:0;background:#060913;color:white;font-family:Arial,sans-serif}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const origin = 'http://127.0.0.1:' + server.address().port;
  async function open(suffix = '') {
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/dashboard/progress' + suffix); return page;
  }
  const page = await open();
  const rejectButton = page.getByRole('button', { name: 'Rechazar', exact: true });
  await rejectButton.click(); const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Revisar rechazo' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Volver sin decidir' })).toBeFocused();
  await expect(dialog.getByRole('button', { name: 'Confirmar rechazo' })).toBeDisabled(); assert.equal(calls.length, 0);
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(rejectButton).toBeFocused();
  await rejectButton.click(); const note = dialog.getByRole('textbox', { name: /Motivo del rechazo/ });
  await note.fill('Falta identificar el metrado y el sector en el parte.');
  page.once('dialog', prompt => prompt.dismiss());
  await dialog.getByRole('button', { name: 'Volver sin decidir' }).click();
  await expect(note).toHaveValue('Falta identificar el metrado y el sector en el parte.');
  await dialog.getByRole('button', { name: 'Confirmar rechazo' }).focus(); await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Cerrar revisión' })).toBeFocused();
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const box = await dialog.boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= width + 1);
    assert.equal(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth), true, 'Dialog overflow at ' + width);
    if ([390, 1280].includes(width)) await page.screenshot({ path: resolve(output, 'review-' + width + '.png') });
  }
  await dialog.getByRole('button', { name: 'Confirmar rechazo' }).click();
  await expect(dialog).toHaveCount(0); await expect(page.getByText('Rechazo registrado con su motivo.')).toBeVisible();
  await expect(page.getByText('Falta identificar el metrado y el sector en el parte.', { exact: true })).toBeVisible();
  assert.equal(calls.length, 1); assert.equal(calls[0].input.reviewNote, 'Falta identificar el metrado y el sector en el parte.');
  assert.equal(calls[0].input.expectedRevision, 1);
  await expect(page.getByRole('button', { name: 'Aprobar', exact: true })).toHaveCount(0);
  await page.close();
  for (const failure of ['MALFORMED', 'CONFLICT']) {
    mode = failure; const failed = await open(); await failed.getByRole('button', { name: 'Rechazar', exact: true }).click();
    const modal = failed.getByRole('dialog'); const reason = modal.getByRole('textbox', { name: /Motivo/ });
    await reason.fill('Fundamento que debe conservarse.'); await modal.getByRole('button', { name: 'Confirmar rechazo' }).click();
    await expect(modal.getByRole('alert')).toBeVisible(); await expect(reason).toHaveValue('Fundamento que debe conservarse.');
    await expect(modal.getByRole('button', { name: 'Confirmar rechazo' })).toBeDisabled();
    await modal.getByRole('button', { name: 'Copiar fundamento' }).click(); await expect(modal.getByText('Fundamento copiado.', { exact: true })).toBeVisible();
    assert.match(await failed.evaluate(() => navigator.clipboard.readText()), /Fundamento que debe conservarse/);
    await failed.close();
  }
  mode = 'SUCCESS'; const approval = await open(); await approval.getByRole('button', { name: 'Aprobar', exact: true }).click();
  const approveDialog = approval.getByRole('dialog'); await expect(approveDialog.getByRole('textbox')).toHaveCount(0);
  await approveDialog.getByRole('button', { name: 'Confirmar aprobación' }).click();
  await expect(approval.getByRole('status').filter({ hasText: /registrada/ })).toBeVisible(); await approval.close();
  const reader = await open('?reader=1');
  await expect(reader.getByRole('button', { name: 'Aprobar', exact: true })).toHaveCount(0);
  await expect(reader.getByRole('button', { name: 'Rechazar', exact: true })).toHaveCount(0);
  assert.equal(calls.length, 4); assert.ok(calls.every(call => call.org === 'org-A' && call.project === 'project-A'));
  assert.deepEqual(errors, []);
  const proof = { result: 'PASS', environment: 'real-client-components-with-synthetic-http-and-roles', noWriteOnOpenOrCancel: true, rejectionReason: true, noSingleClickFinalDecision: true, conflictPreservesNote: true, incompleteResponseNotConfirmed: true, explicitApproval: true, capturedRequests: calls.length, keyboardAndFocus: true, widths: [320, 390, 768, 1280], pageErrors: errors.length };
  writeFileSync(resolve(output, 'proof.json'), JSON.stringify(proof, null, 2)); console.log(JSON.stringify(proof));
} finally { await browser?.close(); await new Promise(done => server.close(done)); }
