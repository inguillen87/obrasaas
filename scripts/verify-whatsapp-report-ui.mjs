import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
const root = fileURLToPath(new URL('../', import.meta.url)), output = resolve(root, '.vercel/message-report-ui'); mkdirSync(output, { recursive: true });
const tasks = [{ id: 'task-a', title: 'Mampostería · Sector norte', type: 'TASK' }];
const entry = `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import Action,{MessageReportDialog} from './src/app/dashboard/inbox/message-report-action';
function App(){const [open,setOpen]=useState(false),[saved,setSaved]=useState(null);return <main><h1>Bandeja de ensayo · ObraSaaS</h1><p>Mensaje sintético de prueba.</p><Action sourceKind="TEXT" saved={saved} onOpen={()=>setOpen(true)}/>{open&&<MessageReportDialog organizationId="org-a" projectId="project-a" projectName="Obra sintética · Piloto" conversationId="conversation-a" messageId="message-a" tasks={${JSON.stringify(tasks)}} onClose={()=>setOpen(false)} onSaved={record=>{setSaved(record);setOpen(false);}}/>}</main>}
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);`;
await build({ stdin: { contents: entry, resolveDir: root, loader: 'jsx' }, outfile: resolve(output, 'bundle.js'), bundle: true, format: 'esm', platform: 'browser', jsx: 'automatic', loader: { '.js': 'jsx' }, alias: { '@': resolve(root, 'src') }, define: { 'process.env.NODE_ENV': '"development"' }, logLevel: 'silent', plugins: [{ name: 'fixture-link', setup(api) {
  api.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fixture' }));
  api.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ loader: 'jsx', contents: `import React from 'react';export default function Link({href,onNavigate,prefetch,...props}){return <a {...props} href={href}/>}`, resolveDir: root }));
} }] });
let mode = 'TEXT', created = null, lostOnce = false;
const requests = [], errors = [];
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://local').pathname;
  if (path.endsWith('/progress-report')) {
    assert.equal(req.headers['x-obrasaas-project'], 'project-a'); assert.equal(req.headers['x-obrasaas-organization'], 'org-a');
    if (req.method === 'GET') {
      res.setHeader('Content-Type', 'application/json');
      if (mode === 'DENIED') { res.statusCode = 403; res.end('{"error":"Origen no disponible para este rol"}'); return; }
      res.end(JSON.stringify({ source: { id: 'message-a', conversationId: 'conversation-a', projectId: 'project-a', kind: mode === 'AUDIO' ? 'AUDIO_TRANSCRIPT' : 'TEXT', text: 'Faltan diez bolsas de cemento en el sector norte. Ensayo sintético.', workDate: '2026-09-18', sentAt: '2026-09-18T12:00:00Z', version: 'a'.repeat(64) }, existing: mode === 'EXISTING' ? created : null })); return;
    }
    let raw = ''; req.on('data', chunk => { raw += chunk; }); req.on('end', () => {
      const input = JSON.parse(raw); requests.push({ key: req.headers['idempotency-key'], input, mode });
      if (mode === 'SOURCE_CHANGED') { res.writeHead(409, { 'Content-Type': 'application/json' }); res.end('{"error":"El mensaje cambió","code":"WHATSAPP_REPORT_SOURCE_CHANGED"}'); return; }
      created ||= { id: 'wa_report_fixture', projectId: 'project-a', taskId: input.taskId, status: 'DRAFT', revision: 0 };
      if (mode === 'LOST' && !lostOnce) { lostOnce = true; res.writeHead(502, { 'Content-Type': 'application/json' }); res.end('{"error":"Respuesta upstream sin confirmar"}'); return; }
      res.writeHead(201, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(mode === 'MALFORMED' ? {} : { report: created, replayed: mode === 'LOST' }));
    }); return;
  }
  if (path === '/bundle.js' || path === '/bundle.css') { res.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : 'text/css'); res.end(readFileSync(resolve(output, path.slice(1)))); return; }
  res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>body{margin:0;background:#060913;color:white;font:16px Arial}main{padding:24px}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 950 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const origin = 'http://127.0.0.1:' + server.address().port;
  async function open() { const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message)); await page.goto(origin); await page.getByRole('button', { name: /Preparar parte/ }).click(); return page; }
  async function fill(page) {
    const dialog = page.getByRole('dialog'); await dialog.getByRole('button', { name: 'Usar este texto como borrador' }).click();
    await dialog.getByRole('combobox', { name: 'Tarea de destino', exact: true }).selectOption('task-a');
    await dialog.getByRole('textbox', { name: 'Título del parte', exact: true }).fill('Faltante de material · ensayo');
    await dialog.getByRole('checkbox', { name: /Revisé el texto/ }).check(); return dialog;
  }
  const page = await open(); const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: /^Cerrar / })).toBeFocused(); await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); assert.equal(requests.length, 0);
  await page.getByRole('button', { name: /Preparar parte/ }).click(); await fill(page);
  page.once('dialog', prompt => prompt.dismiss()); await dialog.getByRole('button', { name: 'Volver a mensajes' }).click();
  await expect(dialog.getByRole('textbox', { name: 'Título del parte', exact: true })).toHaveValue('Faltante de material · ensayo');
  for (const width of [320,390,768,1280]) { await page.setViewportSize({ width, height: 950 }); const box = await dialog.boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= width + 1); assert.equal(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth), true); await expect(dialog.getByRole('heading', { name: 'Preparar parte de obra' })).toBeVisible(); await expect(dialog.getByRole('button', { name: 'Volver a mensajes' })).toBeVisible(); if ([390,1280].includes(width)) await page.screenshot({ path: resolve(output, 'report-' + width + '.png') }); }
  await dialog.getByRole('button', { name: 'Crear borrador vinculado a la tarea' }).click(); await expect(dialog).toHaveCount(0); await expect(page.getByRole('link', { name: /Parte registrado/ })).toBeVisible(); assert.equal(requests.length, 1); await page.close();
  mode = 'EXISTING'; const existing = await open(); await expect(existing.getByRole('heading', { name: 'Este mensaje ya tiene un parte' })).toBeVisible(); await expect(existing.getByRole('button', { name: 'Crear borrador vinculado a la tarea' })).toHaveCount(0); await existing.close();
  mode = 'AUDIO'; const audio = await open(); await expect(audio.getByText('Transcripción ya procesada', { exact: true })).toBeVisible(); await expect(audio.getByText(/No se ejecuta otra llamada de IA/)).toBeVisible(); await audio.close();
  mode = 'LOST'; const lost = await open(); const lostDialog = await fill(lost); await lostDialog.getByRole('button', { name: 'Crear borrador vinculado a la tarea' }).click();
  await expect(lostDialog.getByRole('button', { name: 'Verificar el mismo intento' })).toBeVisible(); await expect(lostDialog.getByRole('textbox', { name: 'Título del parte', exact: true })).toHaveValue('Faltante de material · ensayo');
  await lostDialog.getByRole('button', { name: 'Verificar el mismo intento' }).click(); await expect(lostDialog).toHaveCount(0);
  const retries = requests.filter(row => row.mode === 'LOST'); assert.equal(retries.length, 2); assert.equal(retries[0].key, retries[1].key); assert.deepEqual(retries[0].input, retries[1].input); await lost.close();
  for (const value of ['SOURCE_CHANGED', 'MALFORMED']) {
    mode = value; const failure = await open(); const modal = await fill(failure); await modal.getByRole('button', { name: 'Crear borrador vinculado a la tarea' }).click();
    await expect(modal.getByRole('alert')).toBeVisible(); await expect(modal.getByRole('textbox', { name: 'Título del parte', exact: true })).toHaveValue('Faltante de material · ensayo');
    if (value === 'SOURCE_CHANGED') await expect(modal.getByRole('button', { name: 'Verificar el mismo intento' })).toBeDisabled();
    await failure.close();
  }
  mode = 'DENIED'; const denied = await open(); await expect(denied.getByRole('alert')).toHaveText('Origen no disponible para este rol'); await expect(denied.getByRole('textbox')).toHaveCount(0); await denied.close();
  assert.deepEqual(errors, []); assert.equal(requests.length, 5);
  const proof = { result: 'PASS', environment: 'real-dialog-and-launcher-synthetic-source-and-HTTP', prepareAndCancelDoNotWrite: true, explicitReviewRequired: true, sourceAudioDistinguished: true, existingSourceNotDuplicated: true, lostResponseKeepsSameOperation: true, incompleteResponseNotConfirmed: true, sourceChangeStopsWrite: true, widths: [320,390,768,1280], requests: requests.length, pageErrors: errors.length };
  writeFileSync(resolve(output, 'proof.json'), JSON.stringify(proof, null, 2)); console.log(JSON.stringify(proof));
} finally { await browser?.close(); await new Promise(done => server.close(done)); }
