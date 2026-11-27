import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import puppeteer from 'puppeteer';
import {fieldTaskPaginationSourceClosure} from './verify-field-task-pagination-ui.mjs';
import {captureOwnedFixture, removeOwnedFixture} from './lib/owned-fixture-cleanup.mjs';
import {runSharedWorkday} from './lib/shared-workday-scenario.mjs';

const root = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const panelEndpoint = '/api/identity/field-operations';
const readSource = file => {
  const name = path.join(root, file);
  return existsSync(name) && lstatSync(name).isFile() ? readFileSync(name) : null;
};

async function click(page, label, within = 'body') {
  const found = await page.waitForFunction((scope, text) =>
    [...(document.querySelector(scope)?.querySelectorAll('button,summary') ?? [])]
      .find(el => el.textContent.trim() === text && !el.disabled), {}, within, label);
  try { await found.asElement().click(); } finally { await found.dispose(); }
}

async function approveConsumption({web, director, scope, decisionPayload, proposalReceiptId}) {
  const token = randomUUID();
  const snapshot = await (await web(director, 'workspace', 'GET', scope)).json();
  const privateRoot = path.join(root, '.vercel', 'private');
  mkdirSync(privateRoot, {recursive: true});
  const prefix = 'shared-workday-approval-';
  const fixture = mkdtempSync(path.join(privateRoot, prefix));
  const ownership = captureOwnedFixture({workspaceRoot: root, privateRoot, fixture, prefix});
  let command, response, browser, page, child, exited, uiOrigin;
  const reads = [], errors = [];
  let browserPosts = 0;
  const gateway = createServer(async (request, reply) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      assert.equal(url.pathname, panelEndpoint);
      assert.equal(request.headers.authorization, 'Bearer ' + token);
      let result;
      if (request.method === 'POST') {
        assert.equal(request.headers.origin, uiOrigin);
        assert.equal(++browserPosts, 1, 'Only one browser write is expected');
        let body = '';
        for await (const chunk of request) {
          body += chunk;
          assert.ok(Buffer.byteLength(body) <= 8192);
        }
        command = JSON.parse(body);
        assert.equal(command.action, 'DECIDE_CONSUMPTION');
        assert.deepEqual(command.payload, decisionPayload);
        assert.equal(command.projectId, scope.projectId);
        assert.equal(command.scope, scope.scope);
        result = await web(director, 'field-operations', 'POST', command);
        response = await result.clone().json();
      } else {
        assert.equal(request.method, 'GET');
        const query = Object.fromEntries(url.searchParams);
        assert.equal(query.projectId, scope.projectId);
        assert.equal(query.scope, scope.scope);
        result = await web(director, 'field-operations', 'GET', query);
        const dto = await result.clone().json();
        const balance = dto.inventory?.materials.find(material => material.name === 'Cemento')?.balance;
        if (balance) reads.push(balance);
      }
      reply.writeHead(result.status, Object.fromEntries(result.headers));
      reply.end(Buffer.from(await result.arrayBuffer()));
    } catch (error) {
      errors.push(error.message);
      reply.writeHead(400, {'Content-Type': 'application/json'});
      reply.end('{"code":"LAB_REQUEST_REJECTED"}');
    }
  });
  try {
    gateway.listen(0, '127.0.0.1');
    await once(gateway, 'listening');
    for (const file of fieldTaskPaginationSourceClosure(readSource).files) {
      const destination = path.join(fixture, file);
      mkdirSync(path.dirname(destination), {recursive: true});
      copyFileSync(path.join(root, file), destination);
    }
    const app = path.join(fixture, 'src/app');
    const destination = 'http://127.0.0.1:' + gateway.address().port + panelEndpoint;
    writeFileSync(path.join(fixture, 'next.config.mjs'),
      'export default {devIndicators:false,async rewrites(){return ' + JSON.stringify([{source: panelEndpoint, destination}]) + '}}');
    writeFileSync(path.join(fixture, 'package.json'), JSON.stringify({name: 'shared-workday-approval', private: true}));
    writeFileSync(path.join(app, 'layout.js'), 'export default function Layout({children}){return <html lang="es"><body>{children}</body></html>}');
    writeFileSync(path.join(app, 'page.js'), `'use client';
import {MaterialInventoryPanel} from './(identity)/cuenta/material-inventory-panel';
import {useEffect, useState} from 'react';
const scope = ${JSON.stringify(scope)}, tasks = ${JSON.stringify(snapshot.tasks)};
const getSessionToken = async () => ${JSON.stringify(token)};
export default function Page(){
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted && <MaterialInventoryPanel {...scope} tasks={tasks} getSessionToken={getSessionToken}/>;
}`);
    const env = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
      /^(?:APPDATA|COMSPEC|LOCALAPPDATA|PATH|PATHEXT|SYSTEMROOT|TEMP|TMP|USERPROFILE|HOME|WINDIR|LANG|LC_ALL)$/i.test(name)));
    env.NEXT_TELEMETRY_DISABLED = '1';
    child = fork(fileURLToPath(new URL('./lib/shared-workday-browser-server.mjs', import.meta.url)), [fixture], {
      execArgv: [], cwd: fixture, windowsHide: true, env
    });
    exited = once(child, 'exit');
    const [port] = await Promise.race([once(child, 'message', {signal: AbortSignal.timeout(75000)}),
      exited.then(() => { throw Error('Next fixture exited before startup'); })]);
    assert.ok(Number.isInteger(port));
    uiOrigin = 'http://127.0.0.1:' + port;
    browser = await puppeteer.launch({headless: true, env, ...(process.platform === 'win32' ? {channel: 'chrome'} : {})});
    page = await browser.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request', request => {
      if (new URL(request.url()).origin === uiOrigin) void request.continue();
      else { errors.push('Unexpected external browser request'); void request.abort(); }
    });
    await page.goto(uiOrigin, {waitUntil: 'domcontentloaded', timeout: 90000});
    await click(page, 'Abrir inventario');
    const card = '[data-inventory-proposal="consumptions"][data-proposal-id="' + decisionPayload.proposalId + '"]';
    await page.waitForSelector(card);
    assert.match(await page.$eval(card, el => el.innerText), /Por revisar/);
    assert.ok(await page.evaluate(() => [...document.querySelectorAll('article')].some(el =>
      el.querySelector('strong')?.textContent === 'Cemento' && el.innerText.includes('20 bolsa'))));
    await click(page, 'Aprobar consumo', card);
    await page.type('form textarea', decisionPayload.reason);
    await click(page, 'Confirmar operación', 'form');
    await page.waitForSelector('[data-inventory-receipt]');
    await click(page, 'Ver recibo de esta operación', '[data-inventory-receipt]');
    assert.ok((await page.$eval('[data-inventory-receipt]', el => el.innerText)).includes(response.receiptId));
    await page.reload({waitUntil: 'domcontentloaded'});
    await click(page, 'Abrir inventario');
    await click(page, 'Historial de propuestas');
    await page.waitForFunction(selector => document.querySelector(selector)?.innerText.includes('Consumo aprobado'), {}, card);
    await click(page, 'Ver contexto y trazabilidad del consumo', card);
    await click(page, 'Ver referencias de la revisión', card);
    await click(page, 'Ver referencia del informe', card);
    const history = await page.$eval(card, el => el.innerText);
    assert.ok(history.includes(response.receiptId) && history.includes(proposalReceiptId));
    assert.ok(history.includes('Origen: WhatsApp'));
    await page.waitForFunction(() => [...document.querySelectorAll('article')].some(el =>
      el.querySelector('strong')?.textContent === 'Cemento' && el.innerText.includes('17 bolsa')));
    assert.equal(reads[0], '20.000');
    assert.equal(reads.at(-1), '17.000');
    assert.deepEqual(errors, []);
    return {command, response, proof: {engine: await browser.version(), ui: 'MaterialInventoryPanel', browserPosts,
      before: reads[0], afterReload: reads.at(-1), proposalReceiptId, decisionReceiptId: response.receiptId}};
  } catch (error) {
    if (page) console.error('Inventory response count:', reads.length, 'Panel status:', await page.$eval('[role="status"]', el => el.textContent).catch(() => 'unavailable'));
    if (errors.length) throw new AggregateError([error], errors.join('\n'));
    throw error;
  } finally {
    try { await browser?.close(); } finally {
      try {
        if (child?.connected) child.send('close');
        if (exited) {
          const timeout = setTimeout(() => child.kill(), 15000);
          try { const [code] = await exited; assert.equal(code, 0, 'Next fixture must close cleanly'); }
          finally { clearTimeout(timeout); }
        }
      } finally {
        gateway.closeAllConnections();
        if (gateway.listening) await new Promise(resolve => gateway.close(resolve));
        await removeOwnedFixture(ownership, {serverClosedBeforeFixtureRemoval: true});
      }
    }
  }
}

const proof = await runSharedWorkday({jpeg: readSource('scripts/fixtures/shared-workday-wall.jpg'), approveConsumption});
console.log(JSON.stringify({status: proof.status, sourceRevision: proof.sourceRevision, browserApproval: proof.browserApproval,
  databaseRemoved: true, beforeReplay: proof.beforeReplay, afterReplay: proof.afterReplay, providerRequests: proof.outboundNetworkAttempts}, null, 2));
