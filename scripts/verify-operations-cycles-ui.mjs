import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
const root = fileURLToPath(new URL('../', import.meta.url)), out = resolve(root, '.vercel/operations-cycles-ui'); mkdirSync(out, { recursive: true });
const model = { project: { id: 'project-a', name: 'Obra sintética · Operación integrada', status: 'ACTIVE' }, projects: [{ id: 'project-a', name: 'Obra sintética · Operación integrada', status: 'ACTIVE' }],
  organization: { name: 'Constructora de ensayo', planLabel: 'Prueba' }, identity: { email: 'demo@example.test', tenantRoleLabel: 'Jefatura de obra', isSuperadmin: false },
  permissions: { canReadExecution: true, canReadInbox: true, canReadApprovals: true, canReadAttendance: true, canReadReports: true, canReadMeasurements: false, canReadContracts: false, canReadTeam: false, canManageIntegrations: false }, pendingApprovalCount: 2, unreadNotificationCount: 1, whatsappChannel: { label: 'Canal pendiente', tone: 'pending' } };
const entry = `import React from 'react';import{createRoot}from'react-dom/client';import Shell from './src/app/dashboard/dashboard-shell';import Center from './src/app/dashboard/operations-center';import './src/app/globals.css';import './src/app/platform.css';
createRoot(document.getElementById('root')).render(<React.StrictMode><Shell model={${JSON.stringify(model)}}><Center organizationId="org-a" projectId="project-a" projectName="Obra sintética · Operación integrada"/></Shell></React.StrictMode>);`;
const link = `import React from 'react';export default function Link({href,onClick,onNavigate,prefetch,...props}){return <a {...props} href={href} onClick={event=>{onClick?.(event);if(!event.defaultPrevented){onNavigate?.(event);if(!event.defaultPrevented){event.preventDefault();history.pushState({},'',href);window.dispatchEvent(new Event('popstate'));}}}}/>}`;
const navigation = `import{useSyncExternalStore}from'react';function subscribe(fn){window.addEventListener('popstate',fn);return()=>window.removeEventListener('popstate',fn)}function location(){return useSyncExternalStore(subscribe,()=>window.location.href,()=>'/dashboard')}export function usePathname(){location();return window.location.pathname}export function useSearchParams(){location();return new URLSearchParams(window.location.search)}export function useRouter(){return{push(href){history.pushState({},'',href);window.dispatchEvent(new Event('popstate'))},refresh(){window.dispatchEvent(new Event('popstate'))}}}`;
await build({ stdin: { contents: entry, resolveDir: root, loader: 'jsx' }, outfile: resolve(out, 'bundle.js'), bundle: true, format: 'esm', platform: 'browser', jsx: 'automatic', loader: { '.js': 'jsx' }, alias: { '@': resolve(root, 'src') }, define: { 'process.env.NODE_ENV': '"development"' }, logLevel: 'silent', plugins: [{ name: 'synthetic-identity', setup(api) {
  api.onResolve({ filter: /^(next\/(link|navigation)|@clerk\/nextjs)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
  api.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'jsx', resolveDir: root, contents: args.path === 'next/link' ? link : args.path === 'next/navigation' ? navigation : `import React from'react';export const useUser=()=>({user:{fullName:'Responsable de ensayo'}});export const OrganizationSwitcher=()=>null;export const UserButton=()=>null;` }));
} }] });
const example = (key, count, cycle, label, href, samples = []) => ({ key, count, cycle, label, href, state: 'available', action: 'Abrir ' + label.toLowerCase(), detail: 'Registros de ensayo para revisar.', next: 'Consultar origen → siguiente decisión', samples, hasMore: count > samples.length });
const snapshot = { organizationId: 'org-a', projectId: 'project-a', projectName: model.project.name, queues: [
  example('unassigned', 2, 'daily', 'Partes sin tarea', '/dashboard/progress?unassigned=1', [{ id: 'report-a', label: 'Parte sintético de mampostería', href: '/dashboard/progress?recordId=report-a', action: 'Abrir parte' }]),
  example('inspections', 1, 'quality', 'Inspecciones por decidir', '/dashboard/inspections', [{ id: 'inspect-a', label: 'Control sintético', href: '/dashboard/inspections?inspection=inspect-a', action: 'Consultar inspección' }]),
  example('purchases', 0, 'supply', 'Órdenes en preparación', '/dashboard/purchases'),
], paths: [{ key: 'capture', label: 'Registrar en campo', detail: 'Evidencia y tareas', href: '/dashboard/campo', icon: 'fa-solid fa-mobile-screen-button' }],
  channel: { label: 'Canal por verificar', connected: false, detail: 'No acredita recepción real.', href: '/dashboard/inbox', action: 'Abrir conversaciones' }, failedQueues: 0, checkedAt: '2026-09-18T12:00:00Z' };
let mode = 'ready'; const requests = [], errors = [];
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://local').pathname;
  if (path === '/api/operations/overview') {
    requests.push({ method: req.method, org: req.headers['x-obrasaas-organization'], project: req.headers['x-obrasaas-project'] });
    res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
    if (mode === 'denied') { res.statusCode = 403; res.end('{"error":"Acceso a esta obra revocado"}'); return; }
    if (mode === 'offline') { res.statusCode = 503; res.end('{"error":"Fuente temporalmente indisponible"}'); return; }
    const data = structuredClone(snapshot);
    if (mode === 'partial') { data.queues[2].state = 'unavailable'; data.queues[2].count = null; data.failedQueues = 1; }
    if (mode === 'wrong-project') data.projectId = 'other-project';
    res.end(JSON.stringify(data)); return;
  }
  if (path === '/bundle.js' || path === '/bundle.css') { res.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : 'text/css'); res.end(readFileSync(resolve(out, path.slice(1)))); return; }
  res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>:root{--font-geist:Arial;--font-manrope:Arial}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const origin = 'http://127.0.0.1:' + server.address().port;
  async function open() { const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message)); await page.goto(origin + '/dashboard'); return page; }
  const page = await open(); const center = page.getByRole('region', { name: 'Centro de operaciones de la obra' });
  await expect(center.getByRole('heading', { name: 'Centro de operaciones' })).toBeVisible();
  await expect(center.getByText('Parte sintético de mampostería', { exact: true })).toBeVisible();
  await expect(center.getByRole('heading', { name: 'Órdenes en preparación' })).toHaveCount(0);
  await center.getByRole('button', { name: 'Todas las autorizadas' }).click(); await expect(center.getByRole('heading', { name: 'Órdenes en preparación' })).toBeVisible();
  const search = center.getByRole('searchbox', { name: 'Buscar bandejas de pendientes' });
  await search.fill('órdenes'); await expect(center.getByRole('heading', { name: 'Partes sin tarea' })).toHaveCount(0); await search.fill('');
  const sidebar = page.getByRole('complementary', { name: 'Navegación principal de ObraSaaS' });
  await expect(sidebar.getByRole('region', { name: 'Trabajo diario', exact: true })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Historial y auditoría', exact: true })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Cuadrillas y restricciones', exact: true })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Integraciones', exact: true })).toHaveCount(0);
  await page.keyboard.press('Control+k'); const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
  await dialog.getByRole('searchbox').fill('fotos'); await expect(dialog.getByRole('link', { name: /Bitácora de avance/ })).toBeVisible(); await expect(dialog.getByText('Calidad y avance', { exact: true }).first()).toBeVisible(); await page.keyboard.press('Escape');
  for (const width of [320,390,768,1280]) {
    await page.setViewportSize({ width, height: 1000 });
    if (width < 1024) await expect(sidebar).not.toBeInViewport();
    else await expect(sidebar).toBeInViewport();
    await page.waitForTimeout(450);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Page overflow at ' + width);
    const bounds = await center.boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1, 'Center overflows at ' + width);
    if ([390,1280].includes(width)) await page.screenshot({ path: resolve(out, 'operations-' + width + '.png'), fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.getByRole('button', { name: 'Abrir navegación', exact: true }).click();
  await expect(sidebar.getByRole('region', { name: 'Calidad y avance', exact: true })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'Abrir navegación', exact: true })).toBeFocused();
  await center.getByRole('link', { name: 'Abrir parte', exact: true }).click(); assert.equal(new URL(page.url()).searchParams.get('recordId'), 'report-a');
  mode = 'partial'; await center.getByRole('button', { name: 'Actualizar', exact: true }).click();
  await expect(center.getByText('No se pudo consultar esta fuente. No equivale a cero pendientes.', { exact: true })).toBeVisible();
  await expect(center.getByText('Parte sintético de mampostería', { exact: true })).toBeVisible();
  mode = 'offline'; await center.getByRole('button', { name: 'Actualizar', exact: true }).click();
  await expect(center.getByRole('alert')).toContainText('Fuente temporalmente indisponible');
  await expect(center.getByText('Parte sintético de mampostería', { exact: true })).toBeVisible();
  mode = 'denied'; await center.getByRole('button', { name: 'Actualizar', exact: true }).click();
  await expect(center.getByRole('alert')).toHaveText('Acceso a esta obra revocado'); await expect(center.getByText('Parte sintético de mampostería', { exact: true })).toHaveCount(0);
  await expect(center.getByRole('link')).toHaveCount(0); await page.close();
  mode = 'wrong-project'; const wrong = await open(); const restricted = wrong.getByRole('region', { name: 'Centro de operaciones de la obra' });
  await expect(restricted.getByRole('alert')).toContainText('La respuesta no corresponde'); await expect(restricted.getByText('Parte sintético de mampostería', { exact: true })).toHaveCount(0); await wrong.close();
  assert.ok(requests.length >= 5); assert.ok(requests.every(request => request.method === 'GET' && request.org === 'org-a' && request.project === 'project-a')); assert.deepEqual(errors, []);
  const proof = { result: 'PASS', environment: 'real-shell-navigator-and-operations-components-with-synthetic-identity-HTTP', sixCycleNavigation: true,
    permittedDestinationsOnly: true, sharedSearchGroups: true, filteredRealShapeQueues: true, directRecordLink: true, partialFailureNotZero: true,
    staleResponseExplicit: true, revokedContextClearsData: true, foreignContextRejected: true, mobileMenuAndFocus: true, readOnlyRequests: requests.length, widths: [320,390,768,1280], pageErrors: 0 };
  writeFileSync(resolve(out, 'proof.json'), JSON.stringify(proof, null, 2)); console.log(JSON.stringify(proof));
} finally { await browser?.close(); await new Promise(done => server.close(done)); }
