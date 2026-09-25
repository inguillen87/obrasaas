import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerHooks } from 'node:module';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '@clerk/nextjs/server') return { url: 'mock:network-clerk', shortCircuit: true };
    if (specifier === 'next/headers') return { url: 'mock:network-headers', shortCircuit: true };
    if (specifier.startsWith('@/')) return next(new URL('../src/' + specifier.slice(2) + (specifier.startsWith('@/generated/') ? '.ts' : '.js'), import.meta.url).href, context);
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'mock:network-clerk') return { format: 'module', shortCircuit: true, source: "export async function auth(){throw Error('Unexpected Clerk call')} export async function clerkClient(){throw Error('Unexpected Clerk call')}" };
    if (url === 'mock:network-headers') return { format: 'module', shortCircuit: true, source: "export async function cookies(){throw Error('Unexpected cookie access')}" };
    return next(url, context);
  },
});
const { createFlowReplyFixture } = await import('../tests/helpers/flow-reply-fixture.js');
const { historyAccess, HISTORY_NOW } = await import('../tests/helpers/flow-history-fixture.js');
const { createWhatsAppProactiveFlowHandlers } = await import('../src/app/api/whatsapp/inbox/[conversationId]/proactive-flows/route.js');
const root = fileURLToPath(new URL('../', import.meta.url)), out = resolve(root, '.vercel/flow-read-connectivity-ui');
mkdirSync(out, { recursive: true });
const entry = `import React,{useEffect,useState}from'react';import{createRoot}from'react-dom/client';import History from'./src/app/dashboard/inbox/proactive-flow-history';import Reply from'./src/app/dashboard/inbox/proactive-flow-reply';import './src/app/globals.css';function App(){const[online,setOnline]=useState(true);useEffect(()=>{const fn=e=>setOnline(e.detail.online);window.addEventListener('fixture-network',fn);return()=>window.removeEventListener('fixture-network',fn)},[]);return <main><h1>Lecturas tras un corte de red · ensayo</h1><div data-testid="network-status">{online?'Conexión disponible':'Sin conexión'}</div><History organizationId="organization-a" projectId="project-a" conversationId="conversation-a" online={online}/><section data-testid="direct-reply"><h2>Respuesta consultada directamente</h2><Reply organizationId="organization-a" projectId="project-a" conversationId="conversation-a" sourceMessageId="message-0000" online={online}/></section></main>};createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);`;
await build({ stdin: { contents: entry, resolveDir: root, loader: 'jsx' }, outfile: resolve(out, 'bundle.js'), bundle: true, format: 'esm', platform: 'browser', jsx: 'automatic', loader: { '.js': 'jsx' }, alias: { '@': resolve(root, 'src') }, define: { 'process.env.NODE_ENV': '"development"' }, logLevel: 'silent' });
const fixture = createFlowReplyFixture(), requests = [], errors = [], cases = [], held = [];
const originalBody = fixture.reply.body;
let responseMode = 'normal';
const snapshot = () => JSON.stringify({ messages: fixture.messages, sessions: fixture.sessions });
const originalSnapshot = snapshot();
const json = (res, body, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' }); res.end(JSON.stringify(body)); };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:' + server.address().port);
  if (url.pathname.startsWith('/api/')) {
    requests.push({ method: req.method, mode: url.searchParams.get('mode') });
    assert.equal(req.method, 'GET');
    const mode = responseMode;
    const handlers = createWhatsAppProactiveFlowHandlers({ resolveAccess: async () => historyAccess, authorize: () => {}, prismaFactory: () => fixture.prisma, clock: () => HISTORY_NOW });
    const response = await handlers.GET(new Request(url, { headers: req.headers }), { params: Promise.resolve({ conversationId: 'conversation-a' }) });
    const payload = await response.json();
    if (mode.startsWith('hold')) { held.push({ res, payload, status: response.status, error: mode === 'hold-error' }); return; }
    if (mode === 'denied') { json(res, { code: 'PERMISSION_REQUIRED' }, 403); return; }
    json(res, payload, response.status); return;
  }
  if (['/bundle.js', '/bundle.css'].includes(url.pathname)) { res.setHeader('Content-Type', url.pathname.endsWith('.js') ? 'text/javascript' : 'text/css'); res.end(readFileSync(resolve(out, url.pathname.slice(1)))); return; }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>:root{--font-geist:Arial;--font-manrope:Arial}body{margin:0;background:#060913;color:#f8fafc;font-family:Arial}main{max-width:860px;margin:auto;padding:12px}h1,h2{font-size:14px;margin:16px 0}#root{min-width:0}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser, page;
const release = () => { for (const record of held.splice(0)) json(record.res, record.error ? { code: 'CONTROLLED_OLD_ERROR' } : record.payload, record.error ? 503 : record.status); };
try {
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'es-AR' });
  page.on('pageerror', error => errors.push(error.message));
  const url = 'http://127.0.0.1:' + server.address().port;
  const history = page.getByRole('region', { name: 'Seguimiento de formularios' });
  const reply = page.getByTestId('direct-reply');
  const panels = [
    { name: 'history', target: history, button: 'Consultar envíos anteriores', content: () => history.getByRole('listitem'), expected: 3 },
    { name: 'reply', target: reply, button: 'Consultar respuesta vinculada', content: () => reply.getByText('Origen de la respuesta verificado', { exact: true }), expected: 1 },
  ];
  async function network(online) {
    await page.evaluate(value => window.dispatchEvent(new CustomEvent('fixture-network', { detail: { online: value } })), online);
    await expect(page.getByTestId('network-status')).toHaveText(online ? 'Conexión disponible' : 'Sin conexión');
  }
  const faults = [];
  for (const panel of panels) {
    responseMode = 'normal'; await page.goto(url);
    await panel.target.getByRole('button', { name: panel.button, exact: true }).click();
    await expect(panel.content()).toHaveCount(panel.expected);
    const count = requests.length;
    await network(false); await expect(panel.content()).toHaveCount(0);
    await network(true); await page.waitForTimeout(100);
    const restored = await panel.content().count();
    if (restored) faults.push({ panel: panel.name, restoredWithoutNewRead: restored, requestsBefore: count, requestsAfter: requests.length });
    assert.equal(requests.length, count);
  }
  writeFileSync(resolve(out, 'reconnect-observation.json'), JSON.stringify({ faults, identityControlled: true, providerCalls: 0 }, null, 2));
  assert.deepEqual(faults, [], 'Restored data from a pre-disconnection read must not be shown as currently verified.');
  cases.push('history-ready-result-invalidated-by-disconnection', 'standalone-reply-ready-result-invalidated-by-disconnection');
  for (const panel of panels) {
    for (const fail of [false, true]) {
      await page.goto(url); responseMode = fail ? 'hold-error' : 'hold';
      await panel.target.getByRole('button', { name: panel.button, exact: true }).click();
      await expect.poll(() => held.length).toBe(1);
      await network(false); await network(true); responseMode = 'normal';
      const count = requests.length; release(); await page.waitForTimeout(150);
      await expect(panel.content()).toHaveCount(0); await expect(panel.target.getByRole('alert')).toHaveCount(0);
      assert.equal(requests.length, count);
      await panel.target.getByRole('button', { name: panel.button, exact: true }).click();
      await expect(panel.content()).toHaveCount(panel.expected); assert.equal(requests.length, count + 1);
      cases.push(panel.name + '-old-' + (fail ? 'error' : 'success') + '-discarded-after-disconnection');
    }
  }
  responseMode = 'normal'; await page.goto(url);
  await history.getByRole('button', { name: panels[0].button, exact: true }).click(); await expect(history.getByRole('listitem')).toHaveCount(3);
  await history.getByRole('button', { name: 'Consultar respuesta vinculada', exact: true }).click(); await expect(history.getByText(originalBody, { exact: true })).toBeVisible();
  await network(false); fixture.reply.body = 'Texto actualizado de ensayo, leído después de reconectar.'; await network(true);
  const beforeRead = requests.length; await expect(history.getByText(originalBody, { exact: true })).toHaveCount(0);
  await history.getByRole('button', { name: panels[0].button, exact: true }).click(); await expect(history.getByRole('listitem')).toHaveCount(3);
  await history.getByRole('button', { name: 'Consultar respuesta vinculada', exact: true }).click(); await expect(history.getByText(fixture.reply.body, { exact: true })).toBeVisible();
  assert.equal(requests.length, beforeRead + 2); cases.push('nested-reply-refetched-explicitly-and-reflects-new-source');
  fixture.reply.body = originalBody;
  await page.goto(url); await network(false); const offlineCount = requests.length;
  for (const panel of panels) await expect(panel.target.getByRole('button', { name: panel.button, exact: true })).toBeDisabled();
  await network(true); assert.equal(requests.length, offlineCount); cases.push('offline-controls-disabled-no-automatic-read-on-reconnect');
  responseMode = 'denied'; await reply.getByRole('button', { name: panels[1].button, exact: true }).click(); await expect(reply.getByRole('alert')).toBeVisible();
  await expect(reply.getByRole('button', { name: 'Actualizar respuesta', exact: true })).toBeDisabled();
  await network(false); await network(true); await reply.getByRole('button', { name: panels[1].button, exact: true }).click();
  await expect(reply.getByRole('alert')).toBeVisible(); await expect(reply.getByText('Origen de la respuesta verificado', { exact: true })).toHaveCount(0); cases.push('reconnection-still-requires-server-authorization');
  responseMode = 'normal'; await network(false); await network(true);
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if ([390, 1280].includes(width)) await page.screenshot({ path: resolve(out, 'reconnect-' + width + '.png') });
  }
  cases.push('responsive-four-widths');
  assert.equal(snapshot(), originalSnapshot); assert.equal(requests.some(request => request.method !== 'GET'), false); assert.deepEqual(errors, []);
  const proof = { status: 'PASS', environment: 'real-history-and-reply-components-routes-readers-controlled-identity-HTTP-database', cases, widths: [320, 390, 768, 1280], readResultsReset: true, requestsOnReconnect: 0, networkWrites: 0, providerCalls: 0, realMessagesSent: 0, pageErrors: 0, clerkVerified: false };
  writeFileSync(resolve(out, 'proof.json'), JSON.stringify(proof, null, 2)); console.log(JSON.stringify(proof));
} catch (error) {
  writeFileSync(resolve(out, 'failure.json'), JSON.stringify({ name: error.name, message: error.message }, null, 2));
  await page?.screenshot({ path: resolve(out, 'failure.png') }).catch(() => {}); throw error;
} finally { release(); await browser?.close(); await new Promise(done => server.close(done)); }
