import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {copyFileSync,existsSync,mkdirSync,mkdtempSync,readFileSync,realpathSync,rmSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:net';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {parse} from '@babel/parser';
import puppeteer from 'puppeteer';

// Real component, real local Next rendering, synthetic intercepted responses.
// No provider, production session, commercial payment or external API is used.
assert.ok(!process.env.VERCEL && !process.env.VERCEL_ENV,'This harness must run locally');
const root = realpathSync(process.cwd());
const parent = path.join(root,'.vercel');
const output = path.join(parent,'private/company-billing-evidence');
mkdirSync(output,{recursive:true});
const runId = new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8);
const imageDirectory = path.join(output,'screenshots-'+runId);
mkdirSync(imageDirectory);
const fixture = mkdtempSync(path.join(parent,'company-billing-ui-'));
const sourceManifest = [], externalImports = new Set(), checks = [], pageErrors = [], interceptErrors = [], network = [];
const harnessSha256 = createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex');
const scopeA = 'a'.repeat(64), scopeB = 'b'.repeat(64);
const delay = ms => new Promise(resolve => setTimeout(resolve,ms));
let server, browser, origin, serverLog = '', failure, browserClosed = false, serverStopped = false, fixtureRemoved = false;

function inside(file,base) {
  const relative = path.relative(base,file);
  return relative !== '' && !relative.startsWith('..'+path.sep) && relative !== '..' && !path.isAbsolute(relative);
}
function importsOf(bytes,file) {
  if (file.endsWith('.css')) {
    assert.ok(!/@import\s|url\(\s*['"]?(?!data:|#)/i.test(bytes.toString('utf8')),'Review external/local stylesheet references before extending this harness');
    return [];
  }
  const ast = parse(bytes.toString('utf8'),{sourceType:'module',plugins:['jsx']});
  const imports = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type) && node.source) imports.push(node.source.value);
    if (node.type === 'ImportExpression') {assert.equal(node.source.type,'StringLiteral','Dynamic dependency closure must be explicit');imports.push(node.source.value);}
    if (node.type === 'CallExpression' && node.callee?.type === 'Import') {assert.equal(node.arguments[0]?.type,'StringLiteral','Dynamic dependency closure must be explicit');imports.push(node.arguments[0].value);}
    for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object') visit(value);
  }
  visit(ast.program);
  return imports;
}
function copyDependencyClosure(entry) {
  const seen = new Set();
  function copy(source) {
    source = realpathSync(source);
    assert.ok(inside(source,path.join(root,'src')),'Only source dependencies may be copied');
    if (seen.has(source)) return;
    seen.add(source);
    const relative = path.relative(root,source), bytes = readFileSync(source), destination = path.join(fixture,relative);
    assert.ok(inside(destination,fixture));
    mkdirSync(path.dirname(destination),{recursive:true});copyFileSync(source,destination);
    assert.deepEqual(readFileSync(destination),bytes,'Fixture must preserve exact source/CSS bytes');
    sourceManifest.push({path:relative.split(path.sep).join('/'),sha256:createHash('sha256').update(bytes).digest('hex')});
    for (const specifier of importsOf(bytes,source)) {
      if (!specifier.startsWith('.')) {assert.ok(['react','lucide-react'].includes(specifier),'Unexpected external dependency '+specifier);externalImports.add(specifier);continue;}
      const absolute = path.resolve(path.dirname(source),specifier);
      const resolved = [absolute,absolute+'.js',absolute+'.mjs',absolute+'.css',path.join(absolute,'index.js'),path.join(absolute,'index.mjs')].find(file => existsSync(file) && !path.extname(file).includes('json'));
      assert.ok(resolved,'Missing source dependency '+specifier);copy(resolved);
    }
  }
  copy(path.join(root,entry));sourceManifest.sort((a,b) => a.path.localeCompare(b.path));
  assert.equal(new Set(sourceManifest.map(item => item.path)).size,sourceManifest.length);
  assert.ok(sourceManifest.some(item => item.path.endsWith('company-billing-panel.module.css')));
  assert.ok(sourceManifest.some(item => item.path === 'src/lib/company-entitlement.mjs'));
}
async function freePort() {
  const probe = createServer();await new Promise((resolve,reject) => {probe.once('error',reject);probe.listen(0,'127.0.0.1',resolve);});
  const port = probe.address().port;await new Promise((resolve,reject) => probe.close(error => error ? reject(error) : resolve()));return port;
}
function currentTrial(scope = scopeA) {
  return {version:1,scope,organization:{id:scope === scopeB ? 'org_UI_B' : 'org_UI_A',name:scope === scopeB ? 'Empresa sintética B' : 'Empresa sintética A'},observedAt:'2026-10-08T12:00:00.000Z',subscription:{plan:'TRIAL',status:'TRIALING',trialEndsAt:'2026-10-09T03:00:00.000Z',entitlement:{allowed:true,basis:'CURRENT_TRIAL',reasonCode:null}},billing:{state:'CONFIGURATION_PENDING',checkoutAvailable:false,paymentEvidence:'UNOBSERVED'}};
}
function expiredTrial(scope = scopeA) {
  const value = currentTrial(scope);value.subscription.trialEndsAt = value.observedAt;value.subscription.entitlement = {allowed:false,basis:null,reasonCode:'COMPANY_ENTITLEMENT_TRIAL_EXPIRED'};return value;
}
function activePlan(scope = scopeA, plan = 'PRO') {
  const value = currentTrial(scope);value.subscription = {plan,status:'ACTIVE',trialEndsAt:null,entitlement:{allowed:true,basis:'ACTIVE_PAID_PLAN',reasonCode:null}};return value;
}
async function waitText(page,text) {
  await page.waitForFunction(value => document.body.innerText.includes(value),{timeout:12000},text);
}
async function click(page,text) {
  const handle = await page.evaluateHandle(value => [...document.querySelectorAll('section button')].find(button => button.textContent.trim() === value),text);
  assert.ok(handle.asElement(),'Missing panel button '+text);await handle.asElement().click();await handle.dispose();
}
async function panelText(page) {return page.$eval('section',section => section.innerText);}
async function assertLayout(page,width) {
  const observation = await page.evaluate(() => ({width:window.innerWidth,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,buttons:[...document.querySelectorAll('section button')].map(button => ({height:button.getBoundingClientRect().height,width:button.getBoundingClientRect().width})),cards:document.querySelectorAll('input,textarea,select,form,[autocomplete="cc-number"],[autocomplete="cc-csc"]').length}));
  assert.equal(observation.width,width,'The exact requested CSS viewport must be used');
  assert.ok(observation.documentWidth <= width && observation.bodyWidth <= width,'Horizontal overflow at '+width);
  assert.ok(observation.buttons.length === 1 && observation.buttons.every(button => button.height >= 44 && button.width >= 44),'Panel touch target must be at least 44 px');
  assert.equal(observation.cards,0,'No payment/card controls may appear');return observation;
}
async function makePage(label,width = 390) {
  const context = await browser.createBrowserContext(), page = await context.newPage();
  await page.setViewport({width,height:980,deviceScaleFactor:1});
  page.on('pageerror',error => pageErrors.push({label,message:error.message}));
  await page.evaluateOnNewDocument(() => {
    // Hold the response body after the real HTTP response arrived. Even when
    // canceled, this promise can resolve late; the real lifecycle must discard it.
    const original = Response.prototype.json;
    Response.prototype.json = async function(...args) {
      const value = await original.apply(this,args);
      if (window.__holdBillingJson && this.url.includes('/api/identity/company-billing?')) {
        window.__heldJsonEntered = true;
        return new Promise(resolve => {window.__releaseBillingJson = () => resolve(value);});
      }
      return value;
    };
  });
  const requests = [];let responseKind = 'trial';
  await page.setRequestInterception(true);
  page.on('request',async request => {
    try {
      const url = new URL(request.url());
      if (url.origin !== origin) {
        if (['data:','blob:'].includes(url.protocol)) {await request.continue();return;}
        network.push({label,method:request.method(),host:url.hostname,blocked:true});await request.abort();return;
      }
      if (!url.pathname.startsWith('/api/')) {await request.continue();return;}
      assert.equal(url.pathname,'/api/identity/company-billing');assert.equal(request.method(),'GET','No automatic or manual payment mutation is permitted');
      assert.deepEqual([...url.searchParams.keys()],['scope']);
      const scope = url.searchParams.get('scope');assert.ok([scopeA,scopeB].includes(scope));
      assert.match(request.headers().authorization,/^Bearer synthetic-billing-ui-\d+-\d+$/);
      requests.push({method:request.method(),scope,kind:responseKind,tokenGetterGeneration:Number(request.headers().authorization.split('-').at(-2))});
      let status = 200, contentType = 'application/json', body;
      if (responseKind === '401-html' || responseKind === '403-html') {status = Number(responseKind.slice(0,3));contentType = 'text/html';body = '<html><body>CONTROLLED PRIVATE GATEWAY DIAGNOSTIC</body></html>';}
      else if (responseKind === '503') {status = 503;body = JSON.stringify({code:'COMPANY_BILLING_UNOBSERVED',diagnostic:'CONTROLLED PRIVATE PROVIDER DIAGNOSTIC'});}
      else if (responseKind === 'unreadable') body = '{unreadable controlled JSON';
      else if (responseKind === 'expired') body = JSON.stringify(expiredTrial(scope));
      else if (responseKind === 'active-pro') body = JSON.stringify(activePlan(scope));
      else if (responseKind === 'active-enterprise') body = JSON.stringify(activePlan(scope,'ENTERPRISE'));
      else if (responseKind === 'wrong-scope') body = JSON.stringify(currentTrial(scope === scopeA ? scopeB : scopeA));
      else if (responseKind === 'wrong-version') body = JSON.stringify({...currentTrial(scope),version:2});
      else body = JSON.stringify(currentTrial(scope));
      await request.respond({status,contentType,headers:{'Cache-Control':'no-store'},body});
    } catch(error) {
      interceptErrors.push({label,message:error.message});if (!request.isInterceptResolutionHandled()) await request.abort().catch(() => {});
    }
  });
  await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await waitText(page,'Plan y pago');
  assert.equal(requests.length,0,'Opening the panel must not query or pay automatically');
  assert.equal(await page.evaluate(() => window.__tokenReads || 0),0,'Opening must not acquire a provider token');
  assert.equal(await page.$$eval('input,form',nodes => nodes.length),0);
  return {context,page,requests,setKind:value => {responseKind = value;}};
}
async function consultTrial(state) {
  await click(state.page,'Consultar plan');await waitText(state.page,'Empresa sintética A');
  const rendered = await panelText(state.page);
  assert.match(rendered,/09\/10\/2026.*00:00:00.*hora de Argentina/s);
  assert.match(rendered,/08\/10\/2026.*09:00:00.*hora de Argentina/s);
  assert.ok(rendered.includes('Comprobante de pago: no consultado.'));
  assert.ok(rendered.includes('El pago en línea está pendiente de activación.'));
}
async function viewportScenario(width) {
  const state = await makePage('viewport-'+width,width);
  try {
    const initial = await assertLayout(state.page,width);await consultTrial(state);
    const consulted = await assertLayout(state.page,width);
    const screenshot = path.join(imageDirectory,'trial-'+width+'.png');await state.page.screenshot({path:screenshot,fullPage:true});
    state.setKind('expired');await click(state.page,'Actualizar plan');await waitText(state.page,'Prueba finalizada');
    const expired = await assertLayout(state.page,width);assert.ok(!(await panelText(state.page)).includes('La prueba está vigente'));
    state.setKind('active-pro');await click(state.page,'Actualizar plan');await waitText(state.page,'Suscripción activa');
    const active = await assertLayout(state.page,width), rendered = await panelText(state.page);
    assert.ok(rendered.includes('Hay una suscripción vigente registrada'));
    assert.ok(rendered.includes('Comprobante de pago: no consultado.'));
    assert.ok(!/pago (confirmado|aprobado|realizado)|pagado|cobrado/i.test(rendered));
    assert.ok(!rendered.includes('Vencimiento registrado de la prueba'));
    assert.equal(state.requests.length,3);assert.ok(state.requests.every(request => request.method === 'GET'));
    await state.page.reload({waitUntil:'networkidle0'});await waitText(state.page,'Consultar plan');await delay(150);
    assert.equal(state.requests.length,3,'Reload must not repeat a read or initiate payment');
    assert.ok(!(await panelText(state.page)).includes('Suscripción activa'));
    checks.push({check:'manual-trial-expiry-active-plan-reload-and-responsive-layout',width,initial,consulted,expired,active,screenshot:path.relative(root,screenshot).split(path.sep).join('/'),apiRequests:3});
  } finally {await state.context.close();}
}
async function errorScenario(kind) {
  const state = await makePage('error-'+kind);
  try {
    await consultTrial(state);state.setKind(kind);await click(state.page,'Actualizar plan');
    await state.page.waitForFunction(() => {const section = document.querySelector('section');return section?.getAttribute('aria-busy') === 'false' && section.querySelector('[role="status"]')?.innerText.trim().length > 0;},{timeout:12000});
    const rendered = await panelText(state.page);
    assert.ok(!rendered.includes('Empresa sintética A') && !rendered.includes('Prueba gratuita') && !rendered.includes('09/10/2026'),'A denial or unreadable response must erase the old company subscription');
    assert.ok(!rendered.includes('CONTROLLED PRIVATE') && !rendered.includes('unreadable controlled'));
    if (kind.endsWith('html')) assert.ok(rendered.includes('No se pudo confirmar tu acceso'));
    if (kind === 'wrong-scope') assert.ok(rendered.includes('empresa correcta'));
    assert.equal(state.requests.length,2);
    checks.push({check:'read-failure-clears-company-snapshot',kind,apiRequests:2});
  } finally {await state.context.close();}
}
async function holdRefresh(state) {
  await state.page.evaluate(() => {window.__holdBillingJson = true;window.__heldJsonEntered = false;});
  state.setKind('expired');await click(state.page,'Actualizar plan');
  await state.page.waitForFunction(() => window.__heldJsonEntered === true && typeof window.__releaseBillingJson === 'function',{timeout:12000});
  assert.ok(!(await panelText(state.page)).includes('Empresa sintética A'),'Refreshing must hide the old snapshot');
}
async function lateScenario(kind) {
  const state = await makePage('late-'+kind);
  try {
    await consultTrial(state);await holdRefresh(state);
    await state.page.evaluate(() => {window.__holdBillingJson = false;});
    if (kind === 'scope') {
      await state.page.evaluate(() => window.__switchScope());await waitText(state.page,'Contexto sintético B');await waitText(state.page,'Consultar plan');
      assert.ok(!(await panelText(state.page)).includes('Empresa sintética A'));
      state.setKind('active-enterprise');await click(state.page,'Consultar plan');await waitText(state.page,'Empresa sintética B');
    } else if (kind === 'token-getter') {
      await state.page.evaluate(() => window.__changeTokenGetter());await waitText(state.page,'Consultar plan');
      assert.ok(!(await panelText(state.page)).includes('Prueba gratuita'));
      state.setKind('active-enterprise');await click(state.page,'Consultar plan');await waitText(state.page,'Enterprise');
      assert.equal(state.requests.at(-1).tokenGetterGeneration,1,'The newest read must acquire the new getter token');
    } else {
      await state.page.evaluate(() => window.__unmountBilling());await waitText(state.page,'Panel desmontado en ensayo');
    }
    await state.page.evaluate(() => window.__releaseBillingJson());await delay(150);
    if (kind === 'unmount') {
      assert.equal(await state.page.$('section'),null);
      await state.page.evaluate(() => window.__showBilling());await waitText(state.page,'Consultar plan');
      assert.ok(!(await panelText(state.page)).includes('Prueba finalizada'));
      assert.equal(state.requests.length,2,'Remount must not dispatch a request automatically');
    } else {
      const rendered = await panelText(state.page);assert.ok(rendered.includes('Enterprise') && rendered.includes('Suscripción activa'));
      assert.ok(!rendered.includes('Prueba finalizada') && !rendered.includes('09/10/2026'));
      assert.equal(state.requests.length,3);
      if (kind === 'scope') assert.equal(state.requests.at(-1).scope,scopeB);
    }
    checks.push({check:'late-response-body-cannot-restore-old-subscription',kind,apiRequests:state.requests.length});
  } finally {await state.context.close();}
}
async function getterSnapshotScenario() {
  const state = await makePage('token-getter-existing-snapshot');
  try {
    await consultTrial(state);await state.page.evaluate(() => window.__changeTokenGetter());await waitText(state.page,'Consultar plan');
    assert.ok(!(await panelText(state.page)).includes('Empresa sintética A'));
    assert.equal(state.requests.length,1,'Changing access must not automatically refresh or pay');
    checks.push({check:'same-scope-token-getter-change-immediately-hides-existing-snapshot',apiRequests:1});
  } finally {await state.context.close();}
}
async function lateTokenScenario() {
  const state = await makePage('unmount-before-token');
  try {
    await state.page.evaluate(() => {window.__holdToken = true;});await click(state.page,'Consultar plan');
    await state.page.waitForFunction(() => typeof window.__releaseToken === 'function',{timeout:12000});
    await state.page.evaluate(() => window.__unmountBilling());await waitText(state.page,'Panel desmontado en ensayo');
    await state.page.evaluate(() => window.__releaseToken());await delay(150);
    assert.equal(state.requests.length,0,'A token resolved after unmount must not dispatch a company read');
    checks.push({check:'unmount-before-token-prevents-late-api-dispatch',apiRequests:0});
  } finally {await state.context.close();}
}

try {
  copyDependencyClosure('src/app/(identity)/cuenta/company-billing-panel.js');
  const app = path.join(fixture,'src/app');
  writeFileSync(path.join(fixture,'package.json'),JSON.stringify({name:'isolated-company-billing-ui',private:true}));
  writeFileSync(path.join(fixture,'next.config.mjs'),`export default {devIndicators:false,turbopack:{root:${JSON.stringify(root)}}};\n`);
  writeFileSync(path.join(app,'layout.js'),`export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:12,background:'#f3f5f7',fontFamily:'Arial,sans-serif'}}>{children}</body></html>}`);
  writeFileSync(path.join(app,'page.js'),`'use client';import {useCallback,useState} from 'react';import {CompanyBillingPanel} from './(identity)/cuenta/company-billing-panel';export default function Page(){const [scope,setScope]=useState('${scopeA}'),[visible,setVisible]=useState(true),[tokenEpoch,setTokenEpoch]=useState(0);const token=useCallback(async()=>{window.__tokenReads=(window.__tokenReads||0)+1;const value='synthetic-billing-ui-'+tokenEpoch+'-'+window.__tokenReads;if(window.__holdToken)return new Promise(resolve=>{window.__releaseToken=()=>resolve(value);});return value;},[tokenEpoch]);if(typeof window!=='undefined'){window.__switchScope=()=>setScope('${scopeB}');window.__unmountBilling=()=>setVisible(false);window.__showBilling=()=>setVisible(true);window.__changeTokenGetter=()=>setTokenEpoch(value=>value+1);}return <main data-fixture="COMPANY_BILLING_FIXTURE" style={{maxWidth:1040,margin:'0 auto',minWidth:0}}><p style={{fontSize:12,color:'#526570'}}>Contexto sintético {scope==='${scopeA}'?'A':'B'}</p>{visible?<CompanyBillingPanel scope={scope} getSessionToken={token}/>:<p>Panel desmontado en ensayo</p>}</main>}`);
  const port = await freePort();origin = 'http://127.0.0.1:'+port;
  const serverEnv = Object.fromEntries(['PATH','Path','SystemRoot','WINDIR','TEMP','TMP','HOME','USERPROFILE','APPDATA','LOCALAPPDATA','ComSpec','COMSPEC'].filter(key => process.env[key] !== undefined).map(key => [key,process.env[key]]));
  server = spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',fixture,'--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env:{...serverEnv,NEXT_TELEMETRY_DISABLED:'1',NODE_ENV:'development'},stdio:['ignore','pipe','pipe'],detached:process.platform !== 'win32'});
  for (const stream of [server.stdout,server.stderr]) stream.on('data',chunk => {serverLog = (serverLog+chunk.toString()).slice(-20000);});
  const deadline = Date.now()+90000;let ready = false;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error('The owned Next fixture server exited before readiness');
    try {const response = await fetch(origin,{signal:AbortSignal.timeout(3000)});if (response.ok && (await response.text()).includes('COMPANY_BILLING_FIXTURE')) {ready = true;break;}} catch { /* Wait only for this disposable localhost server. */ }
    await delay(250);
  }
  assert.ok(ready,'The local fixture did not become ready');
  // Ubuntu Actions restricts Chromium user namespaces. Only this disposable,
  // secret-free CI browser uses the existing repository's Linux runner flags;
  // the user's browser and local runs keep their default sandbox protections.
  const runnerArgs = process.env.GITHUB_ACTIONS === 'true' && process.platform === 'linux' ? ['--no-sandbox','--disable-setuid-sandbox'] : [];
  browser = await puppeteer.launch({headless:true,args:[...runnerArgs,'--disable-background-networking','--disable-component-update','--disable-domain-reliability','--disable-sync','--metrics-recording-only','--no-first-run','--disable-features=MediaRouter']});
  for (const width of [320,390,768,1280]) await viewportScenario(width);
  for (const kind of ['401-html','403-html','503','unreadable','wrong-scope','wrong-version']) await errorScenario(kind);
  for (const kind of ['scope','unmount','token-getter']) await lateScenario(kind);
  await getterSnapshotScenario();await lateTokenScenario();
  assert.deepEqual(pageErrors,[]);assert.deepEqual(interceptErrors,[]);
  for (const source of sourceManifest) assert.equal(createHash('sha256').update(readFileSync(path.join(root,source.path))).digest('hex'),source.sha256,'Source changed during this harness run; proof would be stale');
} catch(error) {failure = error;}
finally {
  try {if (browser) await browser.close();browserClosed = true;} catch(error) {failure ||= error;}
  try {
    if (server && server.exitCode === null) {
      if (process.platform === 'win32') await new Promise((resolve,reject) => {const stop = spawn('taskkill',['/PID',String(server.pid),'/T','/F'],{stdio:'ignore'});stop.once('error',reject);stop.once('exit',resolve);});
      else process.kill(-server.pid,'SIGTERM');
    }
    if (server) for (let attempt = 0;attempt < 40 && server.exitCode === null;attempt++) await delay(100);
    serverStopped = !server || server.exitCode !== null || server.signalCode !== null;
    assert.ok(serverStopped,'The owned fixture process must stop');
  } catch(error) {failure ||= error;}
  try {
    const resolved = realpathSync(fixture);
    assert.equal(path.dirname(resolved),realpathSync(parent),'Refuse recursive cleanup outside the exact fixture parent');
    assert.ok(/^company-billing-ui-[A-Za-z0-9]+$/.test(path.basename(resolved)),'Refuse cleanup of a nonfixture target');
    rmSync(resolved,{recursive:true,force:true});fixtureRemoved = !existsSync(fixture);assert.ok(fixtureRemoved);
  } catch(error) {failure ||= error;}
}
const target = path.join(output,existsSync(path.join(output,'browser.json')) ? 'browser-'+runId+'.json' : 'browser.json');
const proof = {status:failure?'FAILED':'PASS',recordedAt:new Date().toISOString(),runId,environment:'isolated-localhost-next-real-component-with-intercepted-synthetic-api',widths:[320,390,768,1280],checks,pageErrors,interceptErrors,externalRequests:network,sourceManifest,externalImports:[...externalImports].sort(),harnessSha256,cleanup:{browserClosed,serverStopped,fixtureRemoved},productionLoginVerified:false,productionDataWritten:false,paymentAttempted:false,paymentVerified:false,physicalDeviceAccepted:false,...(failure?{failure:failure.message,serverLog}:{})};
writeFileSync(target,JSON.stringify(proof,null,2),{flag:'wx'});
console.log(JSON.stringify({status:proof.status,evidence:path.relative(root,target).split(path.sep).join('/'),checks:checks.length,sourceFiles:sourceManifest.length,widths:proof.widths,cleanup:proof.cleanup}));
if (failure) throw failure;
