import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import { scope, PREPARER, CERTIFIER, DATE, fixtureSnapshot, fixtureReceipt } from './lib/certificate-workspace-fixture.mjs';
import { certificatePeriodForDate } from '../src/lib/certificate-workspace-session.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = resolve(root, '.vercel/certificate-workspace-ui');
mkdirSync(out, { recursive: true });
const props = (state = 'READY', actor = PREPARER) => ({ initialSnapshot: fixtureSnapshot(state, actor),
  initialPeriodDate: DATE, projectName: 'Obra Norte · Ensayo', scope, actorMembershipId: actor });
const entry = `import React from 'react';import {createRoot} from 'react-dom/client';
import Client from './src/app/dashboard/certificates/certificate-client';
const root=createRoot(document.getElementById('root'));
window.__qaCertificateMount=props=>root.render(<React.StrictMode><Client {...props}/></React.StrictMode>);
window.__qaCertificateMount(${JSON.stringify(props())});`;
await build({ stdin: { contents: entry, resolveDir: root, loader: 'jsx' }, outfile: resolve(out, 'bundle.js'),
  bundle: true, format: 'esm', platform: 'browser', jsx: 'automatic', loader: { '.js': 'jsx' },
  alias: { '@': resolve(root, 'src') }, define: { 'process.env.NODE_ENV': '"development"' }, logLevel: 'silent' });
let state = 'READY', calls = [], receipts = new Map(), errors = [], cases = [];
const json = (res, body, status = 200) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' });
  res.end(JSON.stringify(body));
};
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://local');
  if (url.pathname.startsWith('/api/project-certificates')) {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : null;
    const actor = req.headers['x-obrasaas-membership'];
    calls.push({ method: req.method, path: url.pathname, query: url.search, body, key: req.headers['idempotency-key'], actor });
    if (req.headers['x-obrasaas-organization'] !== scope.organizationId || req.headers['x-obrasaas-project'] !== scope.projectId)
      return json(res, { code: 'EVIDENCE_CONTEXT_CHANGED' }, 409);
    if (req.method === 'GET') {
      const snapshot = fixtureSnapshot(state, actor), period = certificatePeriodForDate(url.searchParams.get('periodDate'));
      snapshot.requestedPeriod = period;
      if (snapshot.candidate) snapshot.candidate = { ...snapshot.candidate, period };
      return json(res, snapshot);
    }
    if (req.method === 'POST') {
      const key = req.headers['idempotency-key'];
      if (!key) return json(res, { error: 'Missing test key' }, 400);
      const prior = receipts.get(key);
      if (prior) {
        assert.deepEqual(body, prior.body); assert.equal(actor, prior.actor);
        return json(res, { ...prior.result, receipt: { ...prior.result.receipt, replayed: true } });
      }
      const kind = url.pathname.endsWith('/decision') ? body.decision : 'PREPARE';
      assert.equal(actor, kind === 'PREPARE' ? PREPARER : CERTIFIER);
      const result = fixtureReceipt(kind, body, actor);
      receipts.set(key, { result, body, actor }); state = kind === 'PREPARE' ? 'PENDING' : 'APPROVED';
      return json(res, result, 201);
    }
    return json(res, { error: 'Unexpected test request' }, 400);
  }
  if (['/bundle.js', '/bundle.css'].includes(url.pathname)) {
    res.setHeader('Content-Type', url.pathname.endsWith('.js') ? 'text/javascript' : 'text/css');
    return res.end(readFileSync(resolve(out, url.pathname.slice(1))));
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end('<!doctype html><html lang="es"><head><title>Certificaciones · ensayo aislado</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>body{margin:0;background:#060913;color:#f8fafc;font:16px Arial;--text-primary:#f8fafc;--text-secondary:#a8b7cd;--text-muted:#64748b;--border-color:#334155}</style></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>');
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser, page;
async function visit() {
  await page?.close(); state = 'READY'; calls = []; receipts = new Map(); errors = [];
  page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, locale: 'es-AR', reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.goto(origin);
  await expect(page.getByRole('heading', { name: 'Certificaciones', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Preparar certificado' })).toBeVisible();
}
async function record(name) { assert.deepEqual(errors, []); cases.push({ name, passed: true, requests: calls.length, writes: calls.filter(c => c.method === 'POST').length }); }
async function dimensions(stage) {
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${stage} overflow ${width}`);
    if ([390, 1280].includes(width)) await page.screenshot({ path: resolve(out, `${stage}-${width}.png`), fullPage: true });
  }
}
async function addDeduction() {
  await page.getByRole('button', { name: 'Agregar deducción' }).click();
  await page.getByLabel('Código deducción 1').fill('ANTICIPO');
  await page.getByLabel('Motivo deducción 1').fill('Recupero contractual');
  await page.getByLabel('Importe deducción 1').fill('12,34');
}
try {
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
  await visit(); await addDeduction(); await dimensions('preparacion');
  await page.getByRole('button', { name: 'Preparar certificado' }).click();
  await expect(page.getByText('Certificado preparado y enviado a decisión.', { exact: true })).toBeVisible();
  assert.equal(calls[0].body.deductions[0].amountMinor, '1234');
  assert.equal(calls[0].body.expectedBookRevision, 0);
  await expect(page.getByRole('button', { name: 'Aprobar', exact: true })).toHaveCount(0);
  await page.evaluate(value => window.__qaCertificateMount(value), props('PENDING', CERTIFIER));
  await expect(page.getByRole('region', { name: 'Estado contractual' }).getByText('ARS 29.675,16', { exact: true })).toBeVisible();
  await page.getByLabel('Fundamento del dictamen').fill('Conformidad contractual verificada.');
  await dimensions('dictamen');
  await page.getByRole('button', { name: 'Aprobar', exact: true }).click();
  await expect(page.getByText('Decisión contractual registrada.', { exact: true })).toBeVisible();
  await expect(page.getByText('Aprobado vigente', { exact: true })).toBeVisible();
  assert.equal(calls.filter(c => c.method === 'POST').length, 2);
  assert.equal(calls.filter(c => c.method === 'GET').length, 2);
  assert.equal(calls.find(c => c.body?.decision)?.body.expectedBookRevision, 1);
  await dimensions('aprobado'); await record('prepare-deduction-separate-certifier-approve-responsive');

  await visit(); await page.getByLabel('Fecha dentro de la quincena').fill('2026-10-02');
  await expect(page.getByRole('button', { name: 'Preparar certificado' })).toHaveCount(0);
  assert.equal(calls.length, 0);
  await page.getByRole('button', { name: 'Actualizar período' }).click();
  await expect(page.getByRole('button', { name: 'Preparar certificado' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Período de certificación' })).toContainText('2026-10-01');
  assert.equal(calls.length, 1); await record('new-period-requires-fresh-verified-read');

  await visit(); await addDeduction(); await page.getByLabel('Fecha dentro de la quincena').fill('2026-10-02');
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('button', { name: 'Seguir editando' }).click();
  await expect(page.getByLabel('Importe deducción 1')).toHaveValue('12,34');
  await expect(page.getByLabel('Fecha dentro de la quincena')).toHaveValue(DATE);
  await page.getByLabel('Fecha dentro de la quincena').fill('2026-10-02');
  await page.getByRole('button', { name: 'Descartar y cambiar período' }).click();
  await expect(page.getByRole('button', { name: 'Preparar certificado' })).toHaveCount(0);
  assert.equal(calls.length, 0); await record('dirty-period-change-preserves-or-explicitly-discards-draft');

  for (const failure of ['server', 'forbidden', 'empty', 'foreign-project', 'foreign-period']) {
    await visit();
    await page.route('**/api/project-certificates?*', route => {
      const data = fixtureSnapshot();
      if (failure === 'foreign-project') data.projectId = 'other';
      if (failure === 'foreign-period') data.requestedPeriod = { start: '2026-09-01', end: '2026-09-15' };
      return route.fulfill({ status: failure === 'server' ? 503 : failure === 'forbidden' ? 403 : 200,
        json: failure === 'empty' ? {} : failure === 'server' ? { error: 'SQL postgres://private.internal/secret' } : data });
    });
    await page.getByRole('button', { name: 'Actualizar período' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Preparar certificado' })).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('private.internal');
    await page.unroute('**/api/project-certificates?*');
    await page.getByRole('button', { name: 'Actualizar período' }).click();
    await expect(page.getByRole('button', { name: 'Preparar certificado' })).toBeVisible();
    await record(`read-${failure}-removes-old-actions-and-recovers`);
  }

  for (const mode of ['ambiguous', 'malformed']) {
    await visit(); let first = true;
    await page.route('**/api/project-certificates', async route => {
      if (route.request().method() !== 'POST' || !first) return route.continue();
      first = false; await route.fetch();
      return route.fulfill({ status: mode === 'ambiguous' ? 503 : 200, json: {} });
    });
    await page.getByRole('button', { name: 'Preparar certificado' }).click();
    const retry = page.getByRole('button', { name: 'Recuperar mismo intento' });
    await expect(retry).toBeEnabled();
    await expect(page.getByLabel('Fecha dentro de la quincena')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Preparar certificado' })).toHaveCount(0);
    await retry.click();
    await expect(page.getByText('Se recuperó la operación registrada, sin duplicarla.', { exact: true })).toBeVisible();
    const writes = calls.filter(c => c.method === 'POST');
    assert.equal(writes.length, 2); assert.equal(writes[0].key, writes[1].key); assert.deepEqual(writes[0].body, writes[1].body);
    assert.equal(receipts.size, 1); await record(`${mode}-post-retains-exact-idempotent-attempt`);
  }

  await visit(); let failRead = true;
  await page.route('**/api/project-certificates?*', route => {
    if (!failRead) return route.continue(); failRead = false;
    return route.fulfill({ status: 503, json: {} });
  });
  await page.getByRole('button', { name: 'Preparar certificado' }).click();
  await expect(page.getByRole('heading', { name: 'Operación confirmada · consulta pendiente' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Recuperar mismo intento' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Actualizar período' }).click();
  await expect(page.getByText('Operación confirmada y estado del período actualizado.', { exact: true })).toBeVisible();
  assert.equal(calls.filter(c => c.method === 'POST').length, 1);
  await record('confirmed-write-refresh-failure-retries-get-only');

  await visit();
  await page.getByRole('button', { name: 'Preparar certificado' }).evaluate(button => { button.click(); button.click(); });
  await expect(page.getByText('Certificado preparado y enviado a decisión.', { exact: true })).toBeVisible();
  assert.equal(calls.filter(c => c.method === 'POST').length, 1); await record('synchronous-double-click-one-write');

  await visit(); let release, captured;
  const hold = new Promise(done => { release = done; });
  const requested = new Promise(done => { captured = done; });
  await page.route('**/api/project-certificates?*', async route => { captured(); await hold; await route.fulfill({ json: fixtureSnapshot() }).catch(() => {}); });
  await page.getByRole('button', { name: 'Actualizar período' }).click(); await requested;
  const other = props(); other.scope = { organizationId: 'organization-other', projectId: 'project-other' };
  other.initialSnapshot = { ...other.initialSnapshot, ...other.scope }; other.projectName = 'Otra obra · Ensayo';
  await page.evaluate(value => window.__qaCertificateMount(value), other); release();
  await expect(page.getByRole('button', { name: 'Preparar certificado' })).toBeVisible();
  await expect(page.locator('main')).toContainText('Otra obra · Ensayo');
  await expect(page.getByRole('alert')).toHaveCount(0);
  assert.equal(calls.filter(c => c.method === 'POST').length, 0); await record('late-read-cannot-repopulate-replaced-scope');

  const proof = { status: 'PASS', environment: 'real-CertificateClient-controlled-HTTP', syntheticRows: true,
    realAuthentication: false, liveDatabase: false, payments: false, widths: [320, 390, 768, 1280], cases };
  writeFileSync(resolve(out, 'proof.json'), JSON.stringify(proof, null, 2)); console.log(JSON.stringify(proof));
} catch (error) {
  writeFileSync(resolve(out, 'failure.json'), JSON.stringify({ message: error.message, stack: error.stack, cases, errors, calls }, null, 2));
  await page?.screenshot({ path: resolve(out, 'failure.png'), fullPage: true }).catch(() => {}); throw error;
} finally { await browser?.close(); await new Promise(done => server.close(done)); }
