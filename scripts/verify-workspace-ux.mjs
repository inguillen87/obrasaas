import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, '.vercel/workspace-ux-fixture');
mkdirSync(output, { recursive: true });
// Real client components; synthetic identity, navigation adapter and data only.
const entry = `import React from 'react';
import { createRoot } from 'react-dom/client';
import Navigator, { NavigationLauncher } from './src/app/dashboard/workspace-navigator';
import FieldClient from './src/app/dashboard/campo/field-client';
import { buildNavigationCatalog } from './src/lib/workspace-navigation-search';
import { requestWorkspaceNavigation } from './src/lib/workspace-leave-policy';
const catalog = buildNavigationCatalog([{label:'Obra',destinations:[
  {key:'progress',label:'Bitácora de avance',href:'/dashboard/progress',permission:'read'},
  {key:'inspections',label:'Inspecciones QA/QC',href:'/dashboard/inspections',permission:'read'},
  {key:'integrations',label:'Integraciones',href:'/dashboard/integrations',permission:'admin'},
]}],{read:true});
function App(){return <><NavigationLauncher/><Navigator catalog={catalog} projectName="Obra sintética UX" roleLabel="Jefe de obra"/>
<button id="switch-test" onClick={()=>{document.querySelector('#decision').textContent=requestWorkspaceNavigation('project')?'ALLOW':'BLOCKED'}}>Cambiar obra de prueba</button><span id="decision"/>
<FieldClient project={{id:'synthetic-project',name:'Obra sintética UX',organization:'Pruebas locales',status:'ACTIVE'}} workDate="2026-09-18" counts={{workers:0,tasks:1}} channel={{label:'WhatsApp pendiente',summary:'Fixture sin integración real'}} permissions={{write:true,tasks:true,inbox:true,integrations:false}}/></>}
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);`;
await build({ stdin: { contents: entry, resolveDir: root, loader: 'jsx' }, outfile: resolve(output, 'bundle.js'), bundle: true, format: 'esm', platform: 'browser', jsx: 'automatic', loader: { '.js': 'jsx' }, alias: { '@': resolve(root, 'src') }, define: { 'process.env.NODE_ENV': '"development"' }, logLevel: 'silent', plugins: [{ name: 'fixture-link', setup(api) {
  api.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fixture' }));
  api.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ loader: 'jsx', contents: `import React from 'react';export default function Link({href,onNavigate,onClick,prefetch,...props}){return <a {...props} href={href} onClick={event=>{onClick?.(event);if(!event.defaultPrevented&&!event.ctrlKey&&!event.metaKey){onNavigate?.(event);if(!event.defaultPrevented){event.preventDefault();history.pushState({},'',href);}}}}/>}`, resolveDir: root }));
} }] });
const reports = [];
const server = createServer((request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  if (path === '/api/field/reports' && request.method === 'POST') {
    let body = ''; request.on('data', chunk => { body += chunk; }); request.on('end', () => {
      reports.push(JSON.parse(body)); response.writeHead(201, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ report: { id: 'synthetic-report', title: 'Parte de ensayo', status: 'DRAFT' } }));
    }); return;
  }
  const asset = path === '/bundle.js' ? ['bundle.js','text/javascript'] : path === '/bundle.css' ? ['bundle.css','text/css'] : null;
  if (asset) { response.setHeader('Content-Type', asset[1]); response.end(readFileSync(resolve(output, asset[0]))); return; }
  if (path === '/sw.js' || path === '/offline.html') {
    response.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : 'text/html'); response.end(readFileSync(resolve(root, 'public' + path))); return;
  }
  response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>body{margin:0;background:#060913;color:white;font-family:Arial,sans-serif}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const origin = 'http://127.0.0.1:' + server.address().port;
  await page.goto(origin + '/dashboard/campo');
  const launcher = page.getByRole('button', { name: 'Buscar sección', exact: true });
  await launcher.focus(); await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
  const search = dialog.getByRole('searchbox'); await expect(search).toBeFocused();
  await search.fill('fotos'); await expect(dialog.locator('[data-nav-result]')).toHaveCount(1);
  await expect(dialog.getByRole('link', { name: /Bitácora de avance/ })).toBeVisible();
  await page.keyboard.press('ArrowDown'); await expect(dialog.locator('[data-nav-result]').first()).toBeFocused();
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(launcher).toBeFocused();
  await launcher.click(); await dialog.getByRole('searchbox').fill('integraciones');
  await expect(dialog.locator('[data-nav-result]')).toHaveCount(0); await expect(dialog.getByText('No encontramos esa sección.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.getByText('Faltante', { exact: true }).click();
  await expect(page.getByRole('radio', { name: /Faltante/ })).toBeChecked();
  await page.getByLabel('Título', { exact: true }).fill('Ensayo UX de parte');
  await launcher.click(); await dialog.getByRole('searchbox').fill('fotos');
  page.once('dialog', popup => popup.dismiss());
  await dialog.getByRole('link', { name: /Bitácora de avance/ }).click();
  assert.equal(new URL(page.url()).pathname, '/dashboard/campo');
  await expect(dialog).toBeVisible(); await page.keyboard.press('Escape');
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Ensayo UX de parte');
  page.once('dialog', popup => popup.dismiss()); await page.locator('#switch-test').click();
  await expect(page.locator('#decision')).toHaveText('BLOCKED');
  await page.getByLabel('Sector o ubicación', { exact: true }).fill('Sector sintético');
  await page.getByLabel('Detalle', { exact: true }).fill('Sólo prueba del componente; no representa una obra.');
  await page.getByRole('button', { name: 'Guardar parte en la obra', exact: true }).click();
  await expect(page.getByText('Guardado confirmado por el servidor')).toBeVisible();
  assert.equal(reports.length, 1); assert.equal(reports[0].category, 'SHORTAGE');
  await page.locator('#switch-test').click(); await expect(page.locator('#decision')).toHaveText('ALLOW');
  const checkedWidths = [];
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Field overflow at ' + width);
    await launcher.click(); await expect(dialog).toBeVisible();
    const bounds = await dialog.boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
    await expect(dialog.getByRole('searchbox')).toBeFocused();
    await dialog.locator('[data-nav-result]').last().focus(); await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Cerrar buscador' })).toBeFocused();
    await page.keyboard.press('Escape'); checkedWidths.push(width);
    await page.screenshot({ path: resolve(output, 'field-' + width + '.png'), fullPage: true });
  }
  assert.deepEqual(errors, []);
  const result = { result: 'PASS', environment: 'isolated-client-fixture', checkedWidths, searchByActivity: true, roleFilteredNavigation: true,
    keyboardAndFocus: true, dirtyRouteBlocked: true, dirtyProjectChangeBlocked: true, singleSyntheticReport: reports.length, pageErrors: errors.length,
    limits: 'Synthetic props and Link adapter; not server authorization or physical-device certification.' };
  writeFileSync(resolve(output, 'result.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} finally { await browser?.close(); await new Promise(done => server.close(done)); }
