import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import { inspectWhatsAppPlatformPrerequisites } from '../src/lib/whatsapp/platform-preflight.js';
const root = fileURLToPath(new URL('../', import.meta.url)), out = resolve(root, '.vercel/meta-preflight-ui'); mkdirSync(out, { recursive: true });
const configuration = inspectWhatsAppPlatformPrerequisites({ NEXT_PUBLIC_META_APP_ID: '1234567890123456', META_APP_SECRET: 'synthetic-only', META_VERIFY_TOKEN: 'synthetic-only', WHATSAPP_CREDENTIALS_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'), NEXT_PUBLIC_APP_URL: 'https://obrasaas-preview.vercel.app', VERCEL_ENV: 'preview' });
const entry = `import React from 'react';import{createRoot}from'react-dom/client';import Panel from './src/app/dashboard/integrations/platform-preflight-panel';import './src/app/globals.css';
createRoot(document.getElementById('root')).render(<React.StrictMode><Panel organizationId="org-a" projectId="project-a" initialConfiguration={${JSON.stringify(configuration)}}/></React.StrictMode>);`;
await build({ stdin: { contents: entry, resolveDir: root, loader: 'jsx' }, outfile: resolve(out, 'bundle.js'), bundle: true, format: 'esm', platform: 'browser', jsx: 'automatic', loader: { '.js': 'jsx' }, alias: { '@': resolve(root, 'src') }, define: { 'process.env': '{}', 'process.env.NODE_ENV': '"development"' }, logLevel: 'silent' });
let mode = 'credential'; const requests = [], errors = [];
const server = createServer((request, response) => {
  const path = new URL(request.url, 'http://fixture').pathname;
  if (path === '/api/integrations/whatsapp/preflight') {
    let body = ''; request.on('data', chunk => { body += chunk; }); request.on('end', () => {
      requests.push({ method: request.method, body, organization: request.headers['x-obrasaas-organization'], project: request.headers['x-obrasaas-project'] });
      const report = { version: 1, organizationId: 'org-a', projectId: mode === 'foreign' ? 'foreign' : 'project-a', configuration, provesOperationalTraffic: false, messagesSent: false, writesToMeta: false,
        authentication: mode === 'credential' ? { status: 'BLOCKED', code: 'APP_CREDENTIAL_REJECTED' } : { status: 'VERIFIED', code: 'APP_AUTHENTICATED' },
        webhook: mode === 'credential' ? { status: 'NOT_CHECKED', code: 'APP_NOT_VERIFIED' } : { status: 'VERIFIED', code: 'CALLBACK_CONFIGURATION_MATCHES' } };
      response.setHeader('Content-Type', 'application/json'); response.setHeader('Cache-Control', 'no-store');
      setTimeout(() => response.end(JSON.stringify(mode === 'malformed' ? {} : report)), 150);
    }); return;
  }
  if (path === '/bundle.js' || path === '/bundle.css') { response.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : 'text/css'); response.end(readFileSync(resolve(out, path.slice(1)))); return; }
  response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>:root{--font-geist:Arial;--font-manrope:Arial}body{padding:16px;background:#060913}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done => server.listen(0, '127.0.0.1', done)); let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  async function page() { const p = await context.newPage(); p.on('pageerror', error => errors.push(error.message)); await p.goto('http://127.0.0.1:' + server.address().port); return p; }
  const p = await page(), button = p.getByRole('button', { name: 'Verificar app y webhook' });
  await expect(button).toBeVisible(); assert.equal(requests.length, 0); await expect(p.getByText('Presente · sin verificar', { exact: true })).toHaveCount(2);
  await button.evaluate(element => { element.click(); element.click(); });
  await expect(p.getByText(/Meta rechazó la credencial de la app/)).toBeVisible(); assert.equal(requests.length, 1);
  await expect(p.getByText(/Este resultado no prueba entrega/)).toBeVisible();
  for (const width of [320,390,768,1280]) {
    await p.setViewportSize({ width, height: 1000 }); assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Overflow at ' + width);
    if ([390,1280].includes(width)) await p.screenshot({ path: resolve(out, 'preflight-' + width + '.png'), fullPage: true });
  }
  mode = 'success'; await button.click(); await expect(p.getByText(/El callback de la app está activo/)).toBeVisible();
  await expect(p.getByText(/Falta comprobar el tráfico real/)).toBeVisible();
  mode = 'foreign'; await button.click(); await expect(p.getByRole('alert')).toContainText('El resultado no corresponde');
  await expect(button).toBeDisabled(); await expect(p.getByText(/El callback de la app está activo/)).toHaveCount(0); await p.close();
  mode = 'malformed'; const invalid = await page(); await invalid.getByRole('button', { name: 'Verificar app y webhook' }).click();
  await expect(invalid.getByRole('alert')).toBeVisible(); await expect(invalid.getByRole('button')).toBeDisabled();
  assert.equal(requests.length, 4); assert.ok(requests.every(r => r.body === '{}' && r.organization === 'org-a' && r.project === 'project-a' && r.method === 'POST')); assert.deepEqual(errors, []);
  const result = { result: 'PASS', environment: 'real-component-synthetic-HTTP', noRemoteOnMount: true, coalescedClicks: true, credentialsPresenceNotProof: true, callbackNotTrafficProof: true, foreignScopeClearsResult: true, malformedResponseBlocked: true, requests: requests.length, widths: [320,390,768,1280], pageErrors: 0 };
  writeFileSync(resolve(out, 'proof.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} catch (failure) { console.log(JSON.stringify({ pageErrors: errors })); throw failure; } finally { await browser?.close(); await new Promise(done => server.close(done)); }
