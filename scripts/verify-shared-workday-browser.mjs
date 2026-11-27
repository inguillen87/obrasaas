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
const workspaceEndpoint = '/api/identity/workspace';
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

async function openLocalPage(browser, url, errors) {
  const page = await browser.newPage();
  const origin = new URL(url).origin;
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', request => {
    const target = new URL(request.url());
    if (target.origin === origin || target.protocol === 'data:' && request.resourceType() === 'image') void request.continue();
    else { errors.push('Unexpected browser request: ' + target.protocol + ' ' + target.host + ' (' + request.resourceType() + ')'); void request.abort(); }
  });
  await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 90000});
  return page;
}

async function ganttReading(page, task, percent) {
  await page.waitForFunction((id, value) => document.querySelector(`[data-gantt-task-id="${id}"] strong + span`)?.innerText === value + ' % registrado', {}, task, percent);
  return page.evaluate(id => {
    const row = document.querySelector(`[data-gantt-task-id="${id}"]`);
    const plan = row.querySelector('[data-gantt-planned]');
    const progress = document.querySelector(`[data-task-id="${id}"] [role="progressbar"]`);
    const dates = [...document.querySelectorAll(`[data-task-id="${id}"] time[datetime]`)].map(el => el.dateTime);
    return {progress: Number(progress.getAttribute('aria-valuenow')), dates, title: row.querySelector('strong').innerText,
      greenWidth: row.querySelector('strong + span + div > span').style.width,
      planned: {label: plan.getAttribute('aria-label'), left: plan.style.left, width: plan.style.width}};
  }, task);
}

async function runDecisionBrowser(action, {web, director, scope, decisionPayload, proposalReceiptId, observer, observerScope, task, originalSchedule}) {
  const progressReview = action === 'DECIDE_PROGRESS';
  const token = randomUUID();
  const observerToken = randomUUID();
  const snapshot = await (await web(director, 'workspace', 'GET', scope)).json();
  const privateRoot = path.join(root, '.vercel', 'private');
  mkdirSync(privateRoot, {recursive: true});
  const prefix = 'shared-workday-approval-';
  const fixture = mkdtempSync(path.join(privateRoot, prefix));
  const ownership = captureOwnedFixture({workspaceRoot: root, privateRoot, fixture, prefix});
  let command, response, browser, observerBrowser, page, child, exited, uiOrigin;
  const reads = [], errors = [];
  let browserPosts = 0;
  const gateway = createServer(async (request, reply) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      const isObserver = progressReview && url.pathname === workspaceEndpoint;
      assert.ok(isObserver || url.pathname === panelEndpoint);
      assert.equal(request.headers.authorization, 'Bearer ' + (isObserver ? observerToken : token));
      let result;
      if (request.method === 'POST') {
        assert.equal(isObserver, false);
        assert.equal(request.headers.origin, uiOrigin);
        assert.equal(++browserPosts, 1, 'Only one browser write is expected');
        let body = '';
        for await (const chunk of request) {
          body += chunk;
          assert.ok(Buffer.byteLength(body) <= 8192);
        }
        command = JSON.parse(body);
        assert.equal(command.action, action);
        assert.deepEqual(command.payload, decisionPayload);
        assert.equal(command.projectId, scope.projectId);
        assert.equal(command.scope, scope.scope);
        result = await web(director, 'field-operations', 'POST', command);
        response = await result.clone().json();
      } else {
        assert.equal(request.method, 'GET');
        const query = Object.fromEntries(url.searchParams);
        const expectedScope = isObserver ? observerScope : scope;
        assert.equal(query.projectId, expectedScope.projectId);
        assert.equal(query.scope, expectedScope.scope);
        result = await web(isObserver ? observer : director, isObserver ? 'workspace' : 'field-operations', 'GET', query);
        const dto = await result.clone().json();
        if (isObserver) reads.push(dto.tasks.find(row => row.id === task).progress);
        else if (!progressReview && dto.inventory) reads.push(dto.inventory.materials.find(material => material.name === 'Cemento').balance);
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
    const files = new Set(fieldTaskPaginationSourceClosure(readSource).files);
    if (progressReview) {
      files.add('src/app/(identity)/cuenta/schedule-workbench.js');
      files.add('src/app/(identity)/cuenta/schedule-workbench.module.css');
    }
    for (const file of files) {
      const destination = path.join(fixture, file);
      mkdirSync(path.dirname(destination), {recursive: true});
      copyFileSync(path.join(root, file), destination);
    }
    const app = path.join(fixture, 'src/app');
    const endpoints = progressReview ? [panelEndpoint, workspaceEndpoint] : [panelEndpoint];
    const rewrites = endpoints.map(source => ({source, destination: 'http://127.0.0.1:' + gateway.address().port + source}));
    writeFileSync(path.join(fixture, 'next.config.mjs'),
      'export default {devIndicators:false,async rewrites(){return ' + JSON.stringify(rewrites) + '}}');
    writeFileSync(path.join(fixture, 'package.json'), JSON.stringify({name: 'shared-workday-approval', private: true}));
    writeFileSync(path.join(app, 'layout.js'), 'export default function Layout({children}){return <html lang="es"><body>{children}</body></html>}');
    writeFileSync(path.join(app, 'page.js'), `'use client';
import {${progressReview ? 'FieldOperationsPanel' : 'MaterialInventoryPanel'} as DecisionPanel} from './(identity)/cuenta/${progressReview ? 'field-operations-panel' : 'material-inventory-panel'}';
import {useEffect, useState} from 'react';
const scope = ${JSON.stringify(scope)}, tasks = ${JSON.stringify(snapshot.tasks)};
const getSessionToken = async () => ${JSON.stringify(token)};
export default function Page(){
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted && <DecisionPanel {...scope} tasks={tasks} getSessionToken={getSessionToken}/>;
}`);
    if (progressReview) {
      mkdirSync(path.join(app, 'gantt'));
      writeFileSync(path.join(app, 'gantt/page.js'), `'use client';
import {useEffect, useState} from 'react';
import {ScheduleWorkbench} from '../(identity)/cuenta/schedule-workbench';
export default function Page(){
  const [data, setData] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(${JSON.stringify(workspaceEndpoint + '?' + new URLSearchParams(observerScope))}, {cache:'no-store', signal:controller.signal,
      headers:{authorization:${JSON.stringify('Bearer ' + observerToken)}}})
      .then(async r => {if (!r.ok) throw Error('Workspace read failed'); const dto = await r.json(); if (!controller.signal.aborted) setData(dto);})
      .catch(error => {if (!controller.signal.aborted) throw error;});
    return () => controller.abort();
  }, []);
  return data && <ScheduleWorkbench tasks={data.tasks} totalTasks={data.totalTasks} nextCursor={data.nextCursor}/>;
}`);
    }
    const env = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
      /^(?:APPDATA|COMSPEC|LOCALAPPDATA|PATH|PATHEXT|SYSTEMROOT|TEMP|TMP|USERPROFILE|HOME|WINDIR|LANG|LC_ALL)$/i.test(name)));
    env.NEXT_TELEMETRY_DISABLED = '1';
    child = fork(fileURLToPath(new URL('./lib/shared-workday-browser-server.mjs', import.meta.url)), [fixture], {
      execArgv: [], cwd: fixture, windowsHide: true, env, stdio: ['ignore', 2, 2, 'ipc']
    });
    exited = once(child, 'exit');
    const [port] = await Promise.race([once(child, 'message', {signal: AbortSignal.timeout(75000)}),
      exited.then(() => { throw Error('Next fixture exited before startup'); })]);
    assert.ok(Number.isInteger(port));
    uiOrigin = 'http://127.0.0.1:' + port;
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    const chrome = executablePath ? {executablePath} : process.platform === 'win32' ? {channel: 'chrome'} : {};
    const launch = () => puppeteer.launch({headless: true, env, ...chrome});
    browser = await launch();
    page = await openLocalPage(browser, uiOrigin, errors);
    if (progressReview) {
      observerBrowser = await launch();
      const independentBrowserProcesses = observerBrowser.process().pid !== browser.process().pid;
      assert.ok(independentBrowserProcesses);
      const observerPage = await openLocalPage(observerBrowser, uiOrigin + '/gantt', errors);
      const before = await ganttReading(observerPage, task, 0);
      assert.deepEqual(before.dates, [originalSchedule.startsOn, originalSchedule.endsOn]);
      assert.equal(before.greenWidth, '0%');
      assert.ok(before.planned.label && Number.parseFloat(before.planned.width) > 0);
      await click(page, 'Abrir operaciones');
      await click(page, 'Avance', 'nav[aria-label="Operaciones de campo"]');
      await click(page, 'Decidir propuesta');
      const form = 'section[aria-labelledby="field-title"] form';
      await page.type(form + ' textarea', decisionPayload.reason);
      assert.equal(browserPosts, 0);
      assert.ok(reads.length > 0 && reads.every(value => value === 0));
      const pendingReads = reads.length;
      await click(page, 'Guardar con recibo', form);
      await click(page, 'Recibo de la operación');
      assert.ok((await page.$eval('section[aria-labelledby="field-title"] details[open] code', el => el.innerText)) === response.receiptId);
      await observerPage.reload({waitUntil: 'domcontentloaded'});
      const after = await ganttReading(observerPage, task, 25);
      assert.deepEqual(after, {...before, progress: 25, greenWidth: '25%'});
      assert.ok(reads.length > pendingReads && reads.slice(pendingReads).every(value => value === 25));
      assert.deepEqual(errors, []);
      return {command, response, proof: {taskId: task, proposalId: decisionPayload.proposalId, proposalReceiptId,
        decisionReceiptId: response.receiptId, browserPosts, reviewer: 'DIRECTOR', observer: 'ADMIN',
        refresh: 'reload', independentBrowserProcesses, pendingWorkspaceReads: pendingReads, approvedWorkspaceReads: reads.length - pendingReads,
        before, after}};
    }
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
    if (page) console.error(action, 'read count:', reads.length, 'Panel status:', await page.$eval('[role="status"]', el => el.textContent).catch(() => 'unavailable'));
    if (errors.length) throw new AggregateError([error], errors.join('\n'));
    throw error;
  } finally {
    try { try { await observerBrowser?.close(); } finally { await browser?.close(); } } finally {
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

const proof = await runSharedWorkday({jpeg: readSource('scripts/fixtures/shared-workday-wall.jpg'),
  approveConsumption: input => runDecisionBrowser('DECIDE_CONSUMPTION', input),
  approveProgress: input => runDecisionBrowser('DECIDE_PROGRESS', input)});
console.log(JSON.stringify({status: proof.status, sourceRevision: proof.sourceRevision, browserApproval: proof.browserApproval,
  browserProgress: proof.browserProgress,
  attendanceSector: proof.attendanceSector,
  businessChecks: proof.steps.map(step => step.step),
  databaseRemoved: true, beforeReplay: proof.beforeReplay, afterReplay: proof.afterReplay, providerRequests: proof.outboundNetworkAttempts}, null, 2));
