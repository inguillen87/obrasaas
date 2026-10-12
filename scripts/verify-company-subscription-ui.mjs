import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {copyFileSync,existsSync,lstatSync,mkdirSync,mkdtempSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:net';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {parse} from '@babel/parser';
import puppeteer from 'puppeteer';
import {captureOwnedFixture,removeOwnedFixture} from './lib/owned-fixture-cleanup.mjs';

// Exact production JSX/CSS rendered by Next. API responses, authentication and
// money are synthetic; no real provider or financial request is authorized.
assert.ok(!process.env.VERCEL && !process.env.VERCEL_ENV,'Run only against the disposable localhost fixture');
const root = realpathSync(process.cwd()),privateRoot = path.join(root,'.vercel','private');
for (const filename of [root,path.join(root,'.vercel'),privateRoot]) {
  if (!existsSync(filename)) mkdirSync(filename);
  assert.ok(lstatSync(filename).isDirectory() && !lstatSync(filename).isSymbolicLink());
  assert.equal(realpathSync(filename),filename);
}
const output = path.join(privateRoot,'company-subscription-evidence');
mkdirSync(output,{recursive:true});
const runId = new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8);
const screenshots = path.join(output,'screenshots-'+runId);mkdirSync(screenshots);
const fixturePrefix = 'company-subscription-ui-',fixture = mkdtempSync(path.join(privateRoot,fixturePrefix));
const ownership = captureOwnedFixture({workspaceRoot:root,privateRoot,fixture,prefix:fixturePrefix});
const scopeA = 'a'.repeat(64),scopeB = 'b'.repeat(64),fixedNow = '2026-10-12T12:00:00.000Z';
const sourceManifest = [],externalImports = new Set(),checks = [],pageErrors = [],interceptErrors = [],externalRequests = [];
const sha = value => createHash('sha256').update(value).digest('hex');
const wait = milliseconds => new Promise(resolve => setTimeout(resolve,milliseconds));
const harnessSha256 = sha(readFileSync(new URL(import.meta.url))),cleanupHelperSha256 = sha(readFileSync(new URL('./lib/owned-fixture-cleanup.mjs',import.meta.url)));
let child,browser,origin,serverLog = '',failure,browserClosed = false,serverClosed = false,fixtureCleanupProof,closeAck = false;
let childClose;

function inside(filename,base) {const relative = path.relative(base,filename);return relative !== '' && !relative.startsWith('..'+path.sep) && relative !== '..' && !path.isAbsolute(relative);}
function importsOf(bytes,filename) {
  if (filename.endsWith('.css')) {assert.ok(!/@import\s|url\(\s*['"]?(?!data:|#)/i.test(bytes.toString()),'A fixture stylesheet cannot reference external resources');return [];}
  const ast = parse(bytes.toString(),{sourceType:'module',plugins:['jsx']}),imports = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type) && node.source) imports.push(node.source.value);
    if (node.type === 'ImportExpression') {assert.equal(node.source.type,'StringLiteral');imports.push(node.source.value);}
    if (node.type === 'CallExpression' && node.callee?.type === 'Import') {assert.equal(node.arguments[0]?.type,'StringLiteral');imports.push(node.arguments[0].value);}
    for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(visit);else if (value && typeof value === 'object') visit(value);
  }
  visit(ast.program);return imports;
}
function copyClosure(entry) {
  const seen = new Set();
  function copy(filename) {
    filename = realpathSync(filename);assert.ok(inside(filename,path.join(root,'src')));if (seen.has(filename)) return;seen.add(filename);
    const relative = path.relative(root,filename),bytes = readFileSync(filename),destination = path.join(fixture,relative);
    assert.ok(inside(destination,fixture));mkdirSync(path.dirname(destination),{recursive:true});copyFileSync(filename,destination);assert.deepEqual(readFileSync(destination),bytes);
    sourceManifest.push({path:relative.split(path.sep).join('/'),sha256:sha(bytes)});
    for (const specifier of importsOf(bytes,filename)) {
      if (!specifier.startsWith('.')) {assert.ok(['react','lucide-react'].includes(specifier),'Unexpected browser dependency '+specifier);externalImports.add(specifier);continue;}
      const absolute = path.resolve(path.dirname(filename),specifier);
      const dependency = [absolute,absolute+'.js',absolute+'.mjs',absolute+'.css',path.join(absolute,'index.js')].find(candidate => existsSync(candidate) && lstatSync(candidate).isFile());
      assert.ok(dependency,'Missing dependency '+specifier);copy(dependency);
    }
  }
  copy(path.join(root,entry));sourceManifest.sort((a,b) => a.path.localeCompare(b.path));
  assert.ok(sourceManifest.some(row => row.path.endsWith('company-subscription-panel.module.css')));
  assert.ok(sourceManifest.some(row => row.path.endsWith('company-subscription-view.mjs')));
  assert.ok(sourceManifest.some(row => row.path.endsWith('workspace-recovery-storage.mjs')));
}
async function bounded(promise,message,milliseconds = 15000) {let timer;try {return await Promise.race([promise,new Promise((_,reject) => {timer = setTimeout(() => reject(new Error(message)),milliseconds);})]);} finally {clearTimeout(timer);}}
async function freePort() {const server = createServer();await new Promise((resolve,reject) => {server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const port = server.address().port;await new Promise(resolve => server.close(resolve));return port;}
function offer(plan = 'PRO',currency = 'USD',amountMinor = plan === 'PRO'?'14900':'34900') {return {id:'offer-'+plan.toLowerCase(),plan,amountMinor,currency,periodUnit:'MONTH',periodCount:1,taxTreatment:'Impuestos incluidos · condiciones originales.',termsVersion:'terms-original',includesAllIn:true,automaticExtras:false};}
function snapshot(scope = scopeA,ready = true) {return {version:1,scope,organization:{id:scope === scopeA?'org_UI_A':'org_UI_B',name:scope === scopeA?'Empresa sintética A':'Empresa sintética B'},observedAt:fixedNow,configuration:ready?{state:'READY',catalogVersion:'catalog-original',offers:[offer(),offer('ENTERPRISE')]}:{state:'CONFIGURATION_PENDING',catalogVersion:null,offers:[]},subscription:{plan:'TRIAL',status:'TRIALING',trialEndsAt:'2026-10-15T03:00:00.000Z',entitlement:{allowed:true,basis:'CURRENT_TRIAL',reasonCode:null}},attempt:null,recovery:null};}
function checkout(scope,command,chosen = offer()) {const value = snapshot(scope);const {id,...terms} = chosen;value.attempt = {attemptId:'company_subscription_'+sha(command.operationId),operationId:command.operationId,state:'CHECKOUT_READY',...terms,offerId:id,catalogVersion:command.catalogVersion,checkoutUrl:'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=synthetic_subscription',receiptId:null,paidPeriod:null,cancelAtPeriodEnd:false,cancellation:null,code:null};return value;}
function paid(scope = scopeA,operationId = '11111111-1111-4111-8111-111111111111') {const value = checkout(scope,{operationId,catalogVersion:'catalog-original'});value.attempt = {...value.attempt,state:'ACTIVE',checkoutUrl:null,receiptId:'company_subscription_payment_'+sha(operationId),paidPeriod:{startsAt:'2026-10-10T12:00:00.000Z',endsAt:'2026-11-10T12:00:00.000Z'}};value.subscription = {plan:'PRO',status:'ACTIVE',trialEndsAt:null,entitlement:{allowed:true,basis:'ACTIVE_PAID_PLAN',reasonCode:null}};return value;}
async function click(page,text) {const handle = await page.evaluateHandle(value => [...document.querySelectorAll('[data-company-subscription] button')].find(button => button.textContent.trim() === value),text);assert.ok(handle.asElement(),'Missing button '+text);await handle.asElement().click();await handle.dispose();}
async function waitText(page,text) {await page.waitForFunction(value => document.querySelector('[data-company-subscription]')?.innerText.includes(value),{timeout:15000},text);}
async function idle(page) {await page.waitForFunction(() => document.querySelector('[data-company-subscription]')?.getAttribute('aria-busy') === 'false',{timeout:15000});}
async function panelText(page) {return page.$eval('[data-company-subscription]',node => node.innerText);}
async function references(page) {
  return page.evaluate(() => new Promise((resolve,reject) => {
    const request = indexedDB.open('obrasaas-pending-receipts-v1',1);request.onerror = () => reject(new Error('Synthetic journal inspection failed'));
    request.onsuccess = () => {const db = request.result,transaction = db.transaction('references','readonly'),get = transaction.objectStore('references').getAll();get.onerror = () => reject(new Error('Synthetic journal inspection failed'));get.onsuccess = () => {const rows = get.result.filter(row => row.key.startsWith('obrasaas.company-subscription-reference.v1.')).map(row => JSON.parse(row.value));db.close();resolve(rows);};};
  }));
}
async function layout(page,width) {
  const observation = await page.evaluate(() => {
    const section = document.querySelector('[data-company-subscription]'),rect = node => ({width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height});
    return {width:innerWidth,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,targets:[...section.querySelectorAll('button,a')].map(rect),inputTargets:[...section.querySelectorAll('input')].map(node => ({type:node.type,...rect(node.closest('label') || node)})),cardFields:section.querySelectorAll('input:not([type="radio"]):not([type="checkbox"]),textarea,select,[autocomplete="cc-number"],[autocomplete="cc-csc"]').length};
  });
  assert.equal(observation.width,width);assert.ok(observation.documentWidth <= width && observation.bodyWidth <= width,'Horizontal overflow at '+width);
  assert.ok(observation.targets.every(target => target.height >= 44 && target.width >= 44),'Button/link targets must be 44 px');
  assert.ok(observation.inputTargets.every(target => target.height >= 44 && target.width >= 44),'Radio/checkbox label hit areas must be 44 px');assert.equal(observation.cardFields,0);return observation;
}
async function makePage(label,{width = 390,kind = 'ready'} = {}) {
  const context = await browser.createBrowserContext(),page = await context.newPage(),requests = [];
  let currentKind = kind,latest = null,beginCommand = null;
  await page.setViewport({width,height:980,deviceScaleFactor:1});page.on('pageerror',error => pageErrors.push({label,message:error.message}));
  await page.evaluateOnNewDocument(() => {
    const json = Response.prototype.json;
    Response.prototype.json = async function(...args) {const value = await json.apply(this,args);if (window.__holdNextBody && this.url.includes('/api/identity/company-subscription')) {window.__holdNextBody = false;window.__heldBodyEntered = true;return new Promise(resolve => {window.__releaseBody = () => resolve(value);});}return value;};
  });
  await page.setRequestInterception(true);
  page.on('request',async intercepted => {
    try {
      const url = new URL(intercepted.url());
      if (url.origin !== origin) {if (['data:','blob:'].includes(url.protocol)) {await intercepted.continue();return;}externalRequests.push({label,method:intercepted.method(),host:url.hostname,blocked:true});await intercepted.abort();return;}
      if (!url.pathname.startsWith('/api/')) {await intercepted.continue();return;}
      assert.equal(url.pathname,'/api/identity/company-subscription');assert.match(intercepted.headers().authorization,/^Bearer synthetic-subscription-ui-\d+-\d+$/);
      let command,scope;
      if (intercepted.method() === 'POST') {assert.equal(url.search,'');command = JSON.parse(intercepted.postData());scope = command.scope;assert.ok(['begin','recover','cancel_renewal'].includes(command.action));const keys = {begin:['action','scope','operationId','offerId','catalogVersion'],recover:['action','scope','operationId'],cancel_renewal:['action','scope','operationId','subscriptionAttemptId']}[command.action];assert.deepEqual(Object.keys(command).sort(),keys.sort());}
      else {assert.equal(intercepted.method(),'GET');assert.deepEqual([...url.searchParams.keys()],['scope']);scope = url.searchParams.get('scope');}
      assert.ok([scopeA,scopeB].includes(scope));
      const logged = {method:intercepted.method(),scope,action:command?.action || null,operationId:command?.operationId || null,tokenGeneration:Number(intercepted.headers().authorization.split('-').at(-2)),kind:currentKind};requests.push(logged);
      if (command && command.action !== 'recover') {
        const durable = (await references(page)).find(row => row.operationId === command.operationId);
        assert.ok(durable,'The real IDB reference must be committed before POST');assert.equal(durable.scope,scope);assert.equal(durable.organizationId,scope === scopeA?'org_UI_A':'org_UI_B');assert.equal(durable.action,command.action);assert.deepEqual(Object.keys(durable).sort(),['version','scope','organizationId','operationId','action','createdAt'].sort());logged.durableBeforeDispatch = true;
      }
      let value;
      if (command?.action === 'begin') {
        beginCommand = structuredClone(command);
        if (currentKind === 'begin-unreserved') {latest = null;await intercepted.respond({status:503,contentType:'application/json',body:JSON.stringify({code:'COMPANY_SUBSCRIPTION_UNCONFIRMED'})});return;}
        const chosen = snapshot(scope).configuration.offers.find(item => item.id === command.offerId);assert.ok(chosen);latest = checkout(scope,command,chosen);
        if (currentKind === 'begin-lost') {await intercepted.abort('failed');return;}
        value = latest;
      } else if (command?.action === 'cancel_renewal') {
        assert.equal(command.subscriptionAttemptId,latest.attempt.attemptId);latest = {...latest,attempt:{...latest.attempt,state:'CANCEL_CONFIRMED',cancelAtPeriodEnd:true,cancellation:{operationId:command.operationId,state:'CONFIRMED'}}};value = latest;
        if (currentKind === 'cancel-lost') {await intercepted.abort('failed');return;}
      } else if (command?.action === 'recover') {
        if (currentKind === 'recover-no-dispatch') {assert.equal(command.operationId,beginCommand.operationId);value = {...snapshot(scope),recovery:{operationId:command.operationId,state:'NO_DISPATCH'}};}
        else if (currentKind === 'recover-unknown') {value = {...latest,attempt:{...latest.attempt,state:'UNKNOWN',checkoutUrl:null}};}
        else if (currentKind === 'recover-cancel-unknown') {value = {...latest,attempt:{...latest.attempt,state:'UNKNOWN',cancelAtPeriodEnd:false,cancellation:{...latest.attempt.cancellation,state:'UNKNOWN'}}};}
        else if (currentKind === 'recover-paid') {latest = paid(scope,latest.attempt.operationId);value = latest;}
        else if (currentKind === 'recover-authorized') {latest = {...latest,attempt:{...latest.attempt,state:'AUTHORIZED',checkoutUrl:null}};value = latest;}
        else value = latest || snapshot(scope);
      } else if (currentKind === '401-html' || currentKind === '403-html') {await intercepted.respond({status:Number(currentKind.slice(0,3)),contentType:'text/html',body:'<p>CONTROLLED PRIVATE DIAGNOSTIC</p>'});return;}
      else if (currentKind === 'wrong-scope') value = snapshot(scope === scopeA?scopeB:scopeA);
      else if (currentKind === 'active') {latest = paid(scope);value = latest;}
      else if (currentKind === 'terminal-expired') {latest = paid(scope);latest.attempt = {...latest.attempt,state:'CANCEL_CONFIRMED',cancelAtPeriodEnd:true,paidPeriod:{startsAt:'2026-09-12T12:00:00.000Z',endsAt:fixedNow}};latest.subscription = {...latest.subscription,status:'CANCELED',entitlement:{allowed:false,basis:null,reasonCode:'COMPANY_ENTITLEMENT_CANCELED'}};value = latest;}
      else if (currentKind === 'closed') value = snapshot(scope,false);
      else if (currentKind === 'immutable-new-catalog') {value = structuredClone(latest);value.configuration = {state:'READY',catalogVersion:'catalog-new',offers:[{...offer('PRO','ARS','20599950'),taxTreatment:'Condiciones nuevas aprobadas.',termsVersion:'terms-new'}]};}
      else if (latest && latest.scope === scope) value = latest;
      else value = snapshot(scope);
      await intercepted.respond({status:200,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(value)});
    } catch (error) {interceptErrors.push({label,message:error.message});if (!intercepted.isInterceptResolutionHandled()) await intercepted.abort().catch(() => {});}
  });
  await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await waitText(page,'Plan y pago');await idle(page);
  assert.ok(requests.length >= 1 && requests.every(row => row.method === 'GET'),'Mount may only read state');
  return {page,context,requests,setKind:value => {currentKind = value;},getBegin:() => beginCommand,getLatest:() => latest};
}
async function choose(state,plan = 'PRO') {
  await state.page.click(`input[type="radio"][value="offer-${plan.toLowerCase()}"]`);
  assert.equal(await state.page.$eval('form button[type="submit"]',node => node.disabled),true,'Price review alone is not confirmation');
  await state.page.click('form input[type="checkbox"]');assert.equal(await state.page.$eval('form button[type="submit"]',node => node.disabled),false);
}
async function viewportScenario(width) {
  const state = await makePage('viewport-'+width,{width,kind:'closed'});
  try {
    await waitText(state.page,'El pago en línea todavía no está habilitado');const closed = await layout(state.page,width);
    assert.equal(await state.page.$$eval('section input,section a,section form',nodes => nodes.length),0);assert.ok(!(await panelText(state.page)).includes('USD 149'));
    state.setKind('ready');await click(state.page,'Actualizar estado');await idle(state.page);await waitText(state.page,'Elegí el plan de tu empresa');
    const ready = await layout(state.page,width);await choose(state);const review = await layout(state.page,width);
    await state.page.screenshot({path:path.join(screenshots,`review-${width}.png`),fullPage:true});
    await click(state.page,'Continuar con Pro');await waitText(state.page,'Continuar en Mercado Pago');await idle(state.page);
    const checkoutLayout = await layout(state.page,width),link = await state.page.$eval('section a',node => ({href:node.href,target:node.target,rel:node.rel,referrerPolicy:node.referrerPolicy}));
    assert.deepEqual(link,{href:'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=synthetic_subscription',target:'_blank',rel:'noopener noreferrer',referrerPolicy:'no-referrer'});assert.equal(state.requests.filter(row => row.action === 'begin').length,1);
    state.setKind('recover-authorized');await click(state.page,'Ya volví · comprobar pago');await waitText(state.page,'Débito autorizado · pago pendiente');assert.ok(!(await panelText(state.page)).includes('Pago confirmado para el período vigente.'));
    state.setKind('recover-paid');await click(state.page,'Comprobar pago y renovación');await waitText(state.page,'Pago confirmado para el período vigente.');
    const paidLayout = await layout(state.page,width),paidText = await panelText(state.page);assert.match(paidText,/10\/11\/2026.*09:00/);
    await click(state.page,'Cancelar renovación');assert.equal(await state.page.$eval('form button[type="submit"]',node => node.disabled),true);await state.page.click('form input[type="checkbox"]');await click(state.page,'Confirmar cancelación de renovación');await waitText(state.page,'La renovación quedó cancelada.');await idle(state.page);
    const canceled = await layout(state.page,width),canceledText = await panelText(state.page);assert.match(canceledText,/10\/11\/2026.*09:00/);assert.ok(canceledText.includes('Pago confirmado para el período vigente.'));assert.equal(state.requests.filter(row => row.action === 'cancel_renewal').length,1);assert.equal(state.requests.filter(row => row.action === 'begin').length,1);
    await state.page.screenshot({path:path.join(screenshots,`canceled-${width}.png`),fullPage:true});
    checks.push({check:'closed-configuration-confirmed-begin-authorized-distinct-paid-cancel-retains-period',width,closed,ready,review,checkout:checkoutLayout,paid:paidLayout,canceled,mutations:state.requests.filter(row => row.method === 'POST')});
  } finally {await state.context.close();}
}
async function uncertaintyScenario() {
  const state = await makePage('lost-response-recovery');
  try {
    state.setKind('begin-lost');await choose(state);await click(state.page,'Continuar con Pro');await waitText(state.page,'La confirmación no llegó.');await idle(state.page);
    const original = state.getBegin();assert.ok(original);assert.equal((await references(state.page))[0].operationId,original.operationId);assert.equal(await state.page.$$eval('section a',nodes => nodes.length),0);
    await state.page.reload({waitUntil:'networkidle0'});await waitText(state.page,'Hay un intento por comprobar');await idle(state.page);assert.equal(state.requests.filter(row => row.action === 'begin').length,1,'Reload must not repeat checkout');
    state.setKind('recover-unknown');await click(state.page,'Comprobar este intento');await idle(state.page);assert.equal((await references(state.page))[0].operationId,original.operationId);assert.ok((await panelText(state.page)).includes('Hay un intento por comprobar'));
    state.setKind('ready');await click(state.page,'Comprobar este intento');await waitText(state.page,'Continuar en Mercado Pago');await idle(state.page);assert.deepEqual(await references(state.page),[]);
    assert.equal(state.requests.filter(row => row.action === 'begin').length,1);assert.ok(state.requests.filter(row => row.action === 'recover').every(row => row.operationId === original.operationId));
    checks.push({check:'durable-lost-response-survives-reload-unknown-and-explicit-same-operation-recovery',mutations:state.requests.filter(row => row.method === 'POST')});
  } finally {await state.context.close();}
}
async function immutableScenario() {
  const state = await makePage('immutable-terms');
  try {
    await choose(state);await click(state.page,'Continuar con Pro');await waitText(state.page,'Continuar en Mercado Pago');state.setKind('immutable-new-catalog');await click(state.page,'Actualizar estado');await idle(state.page);
    const text = await panelText(state.page);assert.ok(text.includes('USD 149,00 por mes'));assert.ok(text.includes('Impuestos incluidos · condiciones originales.'));assert.ok(!text.includes('205.999,50') && !text.includes('Condiciones nuevas aprobadas.'));assert.equal(state.requests.filter(row => row.action === 'begin').length,1);
    checks.push({check:'original-checkout-price-currency-tax-terms-survive-changed-current-catalog'});
  } finally {await state.context.close();}
}
async function cleanupFailureScenario() {
  const state = await makePage('journal-readback-failure-after-confirmed-checkout');
  try {
    await state.page.evaluate(() => {
      const journal = window.__subscriptionJournal,settle = journal.settle,read = journal.read;
      journal.settle = async function(...args) {const value = await settle.apply(this,args);window.__settlementInjected = true;this.read = async function() {this.read = read;throw Object.assign(new Error('Controlled storage failure'),{code:'WORKSPACE_RECOVERY_STORAGE_UNAVAILABLE'});};return value;};
    });
    await choose(state);await click(state.page,'Continuar con Pro');await waitText(state.page,'Continuar en Mercado Pago');await idle(state.page);
    assert.equal(await state.page.evaluate(() => window.__settlementInjected),true);assert.deepEqual(await references(state.page),[]);assert.equal(await state.page.$$eval('section input[type="radio"]',nodes => nodes.length),0,'A settled financial response cannot restore the old trial form after storage failure');assert.equal(state.requests.filter(row => row.action === 'begin').length,1);
    checks.push({check:'verified-checkout-persists-when-subsequent-journal-readback-fails',beginPosts:1});
  } finally {await state.context.close();}
}
async function terminalScenario() {
  const state = await makePage('fresh-subscription-after-confirmed-expired-period',{kind:'terminal-expired'});
  try {
    await waitText(state.page,'Elegí el plan de tu empresa');assert.ok(!(await panelText(state.page)).includes('Acceso pagado hasta'));
    await choose(state);await click(state.page,'Continuar con Pro');await waitText(state.page,'Continuar en Mercado Pago');await idle(state.page);
    assert.equal(state.requests.filter(row => row.action === 'begin').length,1);assert.notEqual(state.getBegin().operationId,'11111111-1111-4111-8111-111111111111');
    checks.push({check:'explicit-new-subscription-after-verified-cancellation-and-expired-paid-coverage'});
  } finally {await state.context.close();}
}
async function cancellationUncertaintyScenario() {
  const state = await makePage('durable-cancel-uncertainty',{kind:'active'});
  try {
    state.setKind('cancel-lost');await click(state.page,'Cancelar renovación');await state.page.click('form input[type="checkbox"]');await click(state.page,'Confirmar cancelación de renovación');await waitText(state.page,'La confirmación no llegó.');await idle(state.page);
    const cancellation = state.requests.find(row => row.action === 'cancel_renewal');assert.ok(cancellation);assert.equal((await references(state.page))[0].operationId,cancellation.operationId);assert.match(await panelText(state.page),/10\/11\/2026.*09:00/);
    await state.page.reload({waitUntil:'networkidle0'});await waitText(state.page,'Hay un intento por comprobar');await idle(state.page);assert.equal(state.requests.filter(row => row.action === 'cancel_renewal').length,1);
    state.setKind('recover-cancel-unknown');await click(state.page,'Comprobar este intento');await idle(state.page);assert.equal((await references(state.page))[0].operationId,cancellation.operationId);assert.match(await panelText(state.page),/10\/11\/2026.*09:00/);
    state.setKind('ready');await click(state.page,'Comprobar este intento');await waitText(state.page,'La renovación quedó cancelada.');await idle(state.page);assert.deepEqual(await references(state.page),[]);assert.match(await panelText(state.page),/10\/11\/2026.*09:00/);
    assert.equal(state.requests.filter(row => row.action === 'cancel_renewal').length,1);assert.ok(state.requests.filter(row => row.action === 'recover').every(row => row.operationId === cancellation.operationId));
    checks.push({check:'lost-cancellation-confirmation-retains-paid-access-and-recovers-same-cancel-operation',mutations:state.requests.filter(row => row.method === 'POST')});
  } finally {await state.context.close();}
}
async function noDispatchScenario() {
  const state = await makePage('durable-no-dispatch-after-unreserved-begin');
  try {
    state.setKind('begin-unreserved');await choose(state);await click(state.page,'Continuar con Pro');await waitText(state.page,'La confirmación no llegó.');await idle(state.page);const closedOperation = state.getBegin().operationId;
    assert.equal((await references(state.page))[0].operationId,closedOperation);
    await state.page.reload({waitUntil:'networkidle0'});await waitText(state.page,'Hay un intento por comprobar');await idle(state.page);assert.equal((await references(state.page))[0].operationId,closedOperation,'A GET with absent attempt must not release the pending reference');assert.equal(state.requests.filter(row => row.action === 'begin').length,1);
    state.setKind('recover-no-dispatch');const readsBefore = state.requests.filter(row => row.method === 'GET').length;await click(state.page,'Comprobar este intento');await waitText(state.page,'Tu solicitud no se envió.');await idle(state.page);
    assert.deepEqual(await references(state.page),[]);assert.equal(state.requests.filter(row => row.method === 'GET').length,readsBefore+1,'Closure is followed by current-company read');
    state.setKind('ready');await choose(state,'ENTERPRISE');await click(state.page,'Continuar con Empresa');await waitText(state.page,'Continuar en Mercado Pago');await idle(state.page);
    assert.notEqual(state.getBegin().operationId,closedOperation);assert.equal(state.requests.filter(row => row.action === 'begin' && row.operationId === closedOperation).length,1,'The old begin is never replayed by the browser');assert.equal(state.requests.filter(row => row.action === 'begin').length,2);
    checks.push({check:'unreserved-begin-requires-durable-no-dispatch-then-fresh-read-and-new-explicit-purchase',mutations:state.requests.filter(row => row.method === 'POST')});
  } finally {await state.context.close();}
}
async function lateScenario(kind) {
  const state = await makePage('late-'+kind);
  try {
    await state.page.evaluate(() => {window.__holdNextBody = true;window.__heldBodyEntered = false;});await click(state.page,'Actualizar estado');await state.page.waitForFunction(() => window.__heldBodyEntered && typeof window.__releaseBody === 'function',{timeout:15000});
    assert.ok(!(await panelText(state.page)).includes('Empresa sintética A'),'Old snapshot must disappear during refresh');
    if (kind === 'scope') {await state.page.evaluate(() => window.__switchScope());await waitText(state.page,'Empresa sintética B');}
    else if (kind === 'token-getter') {state.setKind('active');await state.page.evaluate(() => window.__changeTokenGetter());await waitText(state.page,'Período pagado');assert.equal(state.requests.at(-1).tokenGeneration,1);}
    else {await state.page.evaluate(() => window.__unmountSubscription());await state.page.waitForSelector('[data-unmounted]');}
    await state.page.evaluate(() => window.__releaseBody());await wait(100);
    if (kind === 'scope') assert.ok((await panelText(state.page)).includes('Empresa sintética B') && !(await panelText(state.page)).includes('Empresa sintética A'));
    else if (kind === 'token-getter') assert.ok((await panelText(state.page)).includes('Período pagado') && !(await panelText(state.page)).includes('Prueba vigente'));
    else assert.equal(await state.page.$('[data-company-subscription]'),null);
    assert.equal(state.requests.filter(row => row.method === 'POST').length,0);
    checks.push({check:'late-response-cannot-restore-old-access',kind,requests:state.requests});
  } finally {await state.context.close();}
}
async function crossCompanyScenario() {
  const state = await makePage('cross-company-reference-isolation');
  try {
    state.setKind('begin-lost');await choose(state);await click(state.page,'Continuar con Pro');await waitText(state.page,'Hay un intento por comprobar');await idle(state.page);const pending = state.getBegin();
    state.setKind('ready');await state.page.evaluate(() => window.__switchScope());await waitText(state.page,'Empresa sintética B');await idle(state.page);assert.equal(await state.page.$('[data-subscription-recovery]'),null);assert.equal(state.requests.filter(row => row.action === 'recover').length,0);
    await state.page.evaluate(() => window.__switchScope());await waitText(state.page,'Empresa sintética A');await waitText(state.page,'Hay un intento por comprobar');assert.equal((await references(state.page))[0].operationId,pending.operationId);assert.equal(state.requests.filter(row => row.action === 'begin').length,1);
    checks.push({check:'company-switch-hides-foreign-recovery-and-retains-own-reference'});
  } finally {await state.context.close();}
}
async function errorScenario(kind) {
  const state = await makePage('error-'+kind);
  try {
    state.setKind(kind);await click(state.page,'Actualizar estado');await idle(state.page);const text = await panelText(state.page);assert.ok(!text.includes('Empresa sintética A') && !text.includes('USD 149'));assert.ok(!text.includes('CONTROLLED PRIVATE'));assert.equal(await state.page.$$eval('section a,section input',nodes => nodes.length),0);assert.equal(state.requests.filter(row => row.method === 'POST').length,0);checks.push({check:'denial-or-foreign-envelope-erases-old-financial-actions',kind});
  } finally {await state.context.close();}
}
async function lateTokenScenario() {
  const state = await makePage('unmount-before-token');
  try {
    const count = state.requests.length;await state.page.evaluate(() => {window.__holdToken = true;});await click(state.page,'Actualizar estado');await state.page.waitForFunction(() => typeof window.__releaseToken === 'function');await state.page.evaluate(() => window.__unmountSubscription());await state.page.waitForSelector('[data-unmounted]');await state.page.evaluate(() => window.__releaseToken());await wait(100);assert.equal(state.requests.length,count);checks.push({check:'token-resolved-after-unmount-does-not-dispatch'});
  } finally {await state.context.close();}
}

try {
  copyClosure('src/app/(identity)/cuenta/company-subscription-panel.js');
  const app = path.join(fixture,'src/app');
  writeFileSync(path.join(fixture,'package.json'),JSON.stringify({name:'isolated-company-subscription-ui',private:true}));
  writeFileSync(path.join(fixture,'next.config.mjs'),`export default {devIndicators:false,turbopack:{root:${JSON.stringify(root)}}};\n`);
  writeFileSync(path.join(app,'layout.js'),`export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:12,background:'#f3f5f7',fontFamily:'Arial,sans-serif'}}>{children}</body></html>}`);
  writeFileSync(path.join(app,'page.js'),`'use client';import {useCallback,useState} from 'react';import {CompanySubscriptionPanel} from './(identity)/cuenta/company-subscription-panel';import {browserCompanySubscriptionJournal} from './(identity)/cuenta/company-subscription-view.mjs';export default function Page(){const [scope,setScope]=useState('${scopeA}'),[visible,setVisible]=useState(true),[tokenEpoch,setTokenEpoch]=useState(0);const token=useCallback(async()=>{window.__tokenReads=(window.__tokenReads||0)+1;const value='synthetic-subscription-ui-'+tokenEpoch+'-'+window.__tokenReads;if(window.__holdToken)return new Promise(resolve=>{window.__releaseToken=()=>resolve(value);});return value;},[tokenEpoch]);if(typeof window!=='undefined'){window.__subscriptionJournal=browserCompanySubscriptionJournal;window.__switchScope=()=>setScope(value=>value==='${scopeA}'?'${scopeB}':'${scopeA}');window.__unmountSubscription=()=>setVisible(false);window.__showSubscription=()=>setVisible(true);window.__changeTokenGetter=()=>setTokenEpoch(value=>value+1);}return <main data-fixture="COMPANY_SUBSCRIPTION_FIXTURE" style={{maxWidth:1040,margin:'0 auto',minWidth:0}}><p style={{fontSize:12,color:'#526570'}}>Contexto sintético {scope==='${scopeA}'?'A':'B'}</p>{visible?<CompanySubscriptionPanel scope={scope} getSessionToken={token}/>:<p data-unmounted>Panel desmontado en ensayo</p>}</main>}`);
  const port = await freePort(),nonce = randomUUID(),childFile = path.join(fixture,'owned-server.cjs');origin = 'http://127.0.0.1:'+port;
  // Own one IPC child and its HTTP server directly. Next's custom server close
  // drains its bundler resources; no CLI watcher, PID lookup or tree stop exists.
  writeFileSync(childFile,`const {createServer}=require('node:http');const next=require(${JSON.stringify(path.join(root,'node_modules/next'))});const nonce=${JSON.stringify(nonce)};let app,server,closing=false;let ready;async function close(){if(closing)return;closing=true;try{await ready.catch(()=>{});if(server?.listening){server.closeAllConnections();await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}if(app)await app.close();if(process.connected)process.send({type:'closed',nonce},()=>process.exit(0));else process.exit(0);}catch{if(process.connected)process.send({type:'close-failed',nonce},()=>process.exit(1));else process.exit(1);}}process.on('message',message=>{if(message&&Object.keys(message).sort().join('|')==='nonce|type'&&message.type==='close'&&message.nonce===nonce)void close();});process.on('disconnect',()=>void close());process.on('SIGTERM',()=>void close());ready=(async()=>{server=createServer((req,res)=>app.getRequestHandler()(req,res));app=next({dev:true,dir:${JSON.stringify(fixture)},hostname:'127.0.0.1',port:${port},httpServer:server,webpack:true,turbopack:false});await app.prepare();server.on('upgrade',(req,socket,head)=>app.getUpgradeHandler()(req,socket,head));await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(${port},'127.0.0.1',resolve);});if(process.connected)process.send({type:'ready',nonce});})();ready.catch(error=>{console.error(error);process.exitCode=1;if(process.connected)process.send({type:'failed',nonce});});`);
  const serverEnv = Object.fromEntries(['PATH','Path','SystemRoot','WINDIR','TEMP','TMP','HOME','USERPROFILE','APPDATA','LOCALAPPDATA','ComSpec','COMSPEC'].filter(key => process.env[key] !== undefined).map(key => [key,process.env[key]]));
  child = spawn(process.execPath,[childFile],{cwd:fixture,env:{...serverEnv,NEXT_TELEMETRY_DISABLED:'1',NODE_ENV:'development'},stdio:['ignore','pipe','pipe','ipc'],windowsHide:true});
  child.__closeNonce = nonce;
  childClose = new Promise(resolve => child.once('close',resolve));
  for (const stream of [child.stdout,child.stderr]) stream.on('data',chunk => {serverLog = (serverLog+chunk.toString()).slice(-20000);});
  child.on('message',message => {if (message?.nonce === nonce && message.type === 'closed') closeAck = true;});
  await bounded(new Promise((resolve,reject) => {child.once('error',reject);child.on('message',message => {if (message?.nonce !== nonce) return;if (message.type === 'ready') resolve();if (message.type === 'failed') reject(new Error('Owned fixture preparation failed'));});child.once('exit',() => reject(new Error('Owned fixture exited before readiness')));}), 'Owned fixture readiness timed out',90000);
  const response = await fetch(origin,{signal:AbortSignal.timeout(60000)});assert.ok(response.ok && (await response.text()).includes('COMPANY_SUBSCRIPTION_FIXTURE'));
  const runnerArgs = process.env.GITHUB_ACTIONS === 'true' && process.platform === 'linux'?['--no-sandbox','--disable-setuid-sandbox']:[];
  browser = await puppeteer.launch({headless:true,args:[...runnerArgs,'--disable-background-networking','--disable-component-update','--disable-domain-reliability','--disable-sync','--metrics-recording-only','--no-first-run','--disable-features=MediaRouter']});
  for (const width of [320,390,768,1280]) await viewportScenario(width);
  await uncertaintyScenario();await immutableScenario();await cleanupFailureScenario();await terminalScenario();await cancellationUncertaintyScenario();await noDispatchScenario();
  for (const kind of ['scope','token-getter','unmount']) await lateScenario(kind);
  await crossCompanyScenario();for (const kind of ['401-html','403-html','wrong-scope']) await errorScenario(kind);await lateTokenScenario();
  assert.deepEqual(pageErrors,[]);assert.deepEqual(interceptErrors,[]);assert.deepEqual(externalRequests,[]);
  for (const source of sourceManifest) assert.equal(sha(readFileSync(path.join(root,source.path))),source.sha256,'Dependency changed during rendering; repeat against exact final bytes');
} catch (error) {failure = error;}
finally {
  try {if (browser) await bounded(browser.close(),'Owned browser close timed out');browserClosed = true;} catch (error) {failure ||= error;}
  try {
    if (!child) serverClosed = true;
    else {
      if (child.exitCode === null && child.signalCode === null && child.connected) child.send({type:'close',nonce:child.__closeNonce});
      await bounded(childClose,'Owned fixture close timed out');
      serverClosed = closeAck && child.exitCode === 0;
      assert.ok(serverClosed,'The exact owned server must acknowledge graceful close and exit before fixture cleanup');
    }
  } catch (error) {failure ||= error;}
  try {fixtureCleanupProof = await removeOwnedFixture(ownership,{serverClosedBeforeFixtureRemoval:serverClosed});assert.ok(fixtureCleanupProof.fixtureRemoved);} catch (error) {failure ||= error;fixtureCleanupProof = error.cleanupProof;}
}
const target = path.join(output,'browser-'+runId+'.json');
const proof = {status:failure?'FAILED':'PASS',recordedAt:new Date().toISOString(),runId,environment:'isolated-localhost-next-exact-jsx-with-intercepted-synthetic-api',widths:[320,390,768,1280],checks,sourceManifest,externalImports:[...externalImports].sort(),harnessSha256,cleanupHelperSha256,pageErrors,interceptErrors,externalRequests,cleanup:{browserClosed,serverClosed,gracefulCloseAcknowledged:closeAck,fixtureRemoved:fixtureCleanupProof?.fixtureRemoved === true,fixtureCleanupProof},productionLoginVerified:false,productionDataWritten:false,providerRequests:0,paymentAttempted:false,paymentVerified:false,physicalDeviceAccepted:false,...(failure?{failure:failure.message,serverLog}:{})};
writeFileSync(target,JSON.stringify(proof,null,2),{flag:'wx'});
console.log(JSON.stringify({status:proof.status,evidence:path.relative(root,target).split(path.sep).join('/'),checks:checks.length,widths:proof.widths,cleanup:proof.cleanup}));
if (failure) throw failure;
