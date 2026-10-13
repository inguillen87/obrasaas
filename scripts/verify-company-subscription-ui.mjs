import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {copyFileSync,existsSync,lstatSync,mkdirSync,mkdtempSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:net';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parse} from '@babel/parser';
import puppeteer from 'puppeteer';
import {captureOwnedFixture,removeOwnedFixture} from './lib/owned-fixture-cleanup.mjs';
import {approvedCommercialCatalog,commercialTermsSha256,commercialAcceptanceDigest,commercialAcceptanceId} from '../src/lib/company-subscription-catalog.mjs';
import {closedCompanySubscriptionFixture} from './lib/company-subscription-ui-fixture.mjs';

export const COMPANY_SUBSCRIPTION_UI_VERSION = 'company-subscription-ui-v2';
export const COMPANY_SUBSCRIPTION_UI_WIDTHS = Object.freeze([320,390,768,1280]);
export const COMPANY_SUBSCRIPTION_UI_CHECKS = Object.freeze([
  ...COMPANY_SUBSCRIPTION_UI_WIDTHS.map(width => 'commercial-acceptance-payment-cancellation:'+width),
  'durable-lost-response-survives-reload-unknown-and-explicit-same-operation-recovery',
  'original-checkout-price-currency-tax-terms-survive-changed-current-catalog',
  'verified-checkout-persists-when-subsequent-journal-readback-fails',
  'explicit-new-subscription-after-verified-cancellation-and-expired-paid-coverage',
  'lost-cancellation-confirmation-retains-paid-access-and-recovers-same-cancel-operation',
  'unreserved-begin-requires-durable-no-dispatch-then-fresh-read-and-new-explicit-purchase',
  ...['scope','token-getter','unmount'].map(kind => 'late-response-cannot-restore-old-access:'+kind),
  'company-switch-hides-foreign-recovery-and-retains-own-reference',
  ...['401-html','403-html','wrong-scope'].map(kind => 'denial-or-foreign-envelope-erases-old-financial-actions:'+kind),
  'token-resolved-after-unmount-does-not-dispatch','acceptance-uncertainty-reload-get-only',
  'changed-commercial-binding-clears-unchecked-draft','invalid-digests-and-foreign-receipt-hide-all-actions','acceptance-preserves-existing-financial-unknown',
]);
export const COMPANY_SUBSCRIPTION_UI_DEPENDENCIES = Object.freeze(['package.json','package-lock.json']);
const sha = value => createHash('sha256').update(value).digest('hex');
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
function guard(condition,message) {if (!condition) throw Object.assign(new Error(message),{code:'COMPANY_SUBSCRIPTION_UI_FIXTURE_REJECTED'});}
export function companySubscriptionUiOptions(args,{repoRoot,environment = {}}) {
  guard(!environment.VERCEL && !environment.VERCEL_ENV && !environment.VERCEL_TARGET_ENV,'Only an isolated local fixture is supported');
  guard(Array.isArray(args) && typeof repoRoot === 'string' && path.isAbsolute(repoRoot),'Explicit fixture arguments/root required');
  let expectedHead = environment.GITHUB_SHA || null,outputFile = null;
  if (args[0] === '--expected-head') {guard(args.length === 2 || args.length === 3,'Unsupported fixture arguments');expectedHead = args[1];outputFile = args[2] || null;}
  else {guard(args.length <= 1 && !args[0]?.startsWith('--'),'Unsupported fixture arguments');outputFile = args[0] || null;}
  guard(expectedHead === null || typeof expectedHead === 'string' && /^[a-f0-9]{40}$/.test(expectedHead),'A full expected Git commit is required');
  if (environment.GITHUB_SHA) guard(expectedHead === environment.GITHUB_SHA,'Expected HEAD must match CI');
  const outputRoot = path.join(repoRoot,'.vercel/private/company-subscription-ui-evidence'),target = outputFile?path.resolve(repoRoot,outputFile):null;
  guard(!target || path.dirname(target) === outputRoot && path.extname(target) === '.json','Evidence must be a direct JSON child of company-subscription-ui-evidence');
  return {expectedHead,outputRoot,target};
}
export function companySubscriptionUiServerEnvironment(environment) {
  const keys = ['PATH','Path','SystemRoot','WINDIR','TEMP','TMP','HOME','USERPROFILE','APPDATA','LOCALAPPDATA','ComSpec','COMSPEC'];
  return {...Object.fromEntries(keys.filter(key => environment[key] !== undefined).map(key => [key,environment[key]])),NEXT_TELEMETRY_DISABLED:'1',NODE_ENV:'development'};
}
export function companySubscriptionUiSourceFiles(repoRoot) {
  const root = realpathSync(repoRoot),seen = new Set();
  function walk(filename) {
    filename = realpathSync(filename);guard(inside(filename,path.join(root,'src')),'Only production src dependencies');if (seen.has(filename)) return;seen.add(filename);
    for (const specifier of importsOf(readFileSync(filename),filename)) {
      if (!specifier.startsWith('.')) {guard(['react','lucide-react'].includes(specifier),'Unexpected browser package dependency');continue;}
      const absolute = path.resolve(path.dirname(filename),specifier),dependency = [absolute,absolute+'.js',absolute+'.mjs',absolute+'.css',path.join(absolute,'index.js')].find(file => existsSync(file) && lstatSync(file).isFile());guard(Boolean(dependency),'Missing source dependency');walk(dependency);
    }
  }
  walk(path.join(root,'src/app/(identity)/cuenta/company-subscription-panel.js'));return [...seen].map(filename => path.relative(root,filename).split(path.sep).join('/')).sort();
}
export function companySubscriptionUiFixtureSourceFiles(repoRoot) {
  const root = realpathSync(repoRoot),seen = new Set();
  function walk(filename) {
    filename = realpathSync(filename);guard(inside(filename,root),'Fixture source stays in workspace');if (seen.has(filename)) return;seen.add(filename);
    for (const specifier of importsOf(readFileSync(filename),filename)) {
      if (!specifier.startsWith('.')) {guard(specifier.startsWith('node:'),'Fixture helpers use only Node built-ins');continue;}
      walk(path.resolve(path.dirname(filename),specifier));
    }
  }
  for (const file of ['scripts/lib/company-subscription-ui-fixture.mjs','scripts/lib/owned-fixture-cleanup.mjs']) walk(path.join(root,file));
  return [...seen].map(filename => path.relative(root,filename).split(path.sep).join('/')).sort();
}

export async function verifyCompanySubscriptionUi(args = process.argv.slice(2)) {

// Exact production JSX/CSS rendered by Next. API responses, authentication and
// money are synthetic; no real provider or financial request is authorized.
const root = realpathSync(process.cwd()),privateRoot = path.join(root,'.vercel','private');
const options = companySubscriptionUiOptions(args,{repoRoot:root,environment:process.env});
const git = args => {const result = spawnSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);return result.stdout.trim();};
const sourceRevision = git(['rev-parse','HEAD']),sourceTree = git(['rev-parse','HEAD^{tree}']),trackedClean = git(['status','--porcelain','--untracked-files=no']) === '';
if (options.expectedHead) assert.equal(sourceRevision,options.expectedHead);if (process.env.CI === 'true') assert.ok(options.expectedHead && trackedClean,'Exact clean CI source required');
for (const filename of [root,path.join(root,'.vercel'),privateRoot]) {
  if (!existsSync(filename)) mkdirSync(filename);
  assert.ok(lstatSync(filename).isDirectory() && !lstatSync(filename).isSymbolicLink());
  assert.equal(realpathSync(filename),filename);
}
const output = options.outputRoot;
mkdirSync(output,{recursive:true});
assert.ok(!lstatSync(output).isSymbolicLink() && realpathSync(output) === output,'Evidence directory cannot be redirected');
const runId = new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8);
const target = options.target || path.join(output,'browser-'+runId+'.json');guard(!existsSync(target),'Evidence is immutable');
const screenshots = path.join(output,'screenshots-'+runId);mkdirSync(screenshots);
const fixturePrefix = 'company-subscription-ui-',fixture = mkdtempSync(path.join(privateRoot,fixturePrefix));
const ownership = captureOwnedFixture({workspaceRoot:root,privateRoot,fixture,prefix:fixturePrefix});
const scopeA = 'a'.repeat(64),scopeB = 'b'.repeat(64),fixedNow = '2026-10-12T12:00:00.000Z';
const sourceManifest = [],externalImports = new Set(),checks = [],pageErrors = [],interceptErrors = [],externalRequests = [],screenshotManifest = [],apiRequests = [];
const wait = milliseconds => new Promise(resolve => setTimeout(resolve,milliseconds));
const harnessSha256 = sha(readFileSync(new URL(import.meta.url))),cleanupHelperSha256 = sha(readFileSync(new URL('./lib/owned-fixture-cleanup.mjs',import.meta.url)));
const dependencyManifest = COMPANY_SUBSCRIPTION_UI_DEPENDENCIES.map(relative => ({path:relative,sha256:sha(readFileSync(path.join(root,relative)))}));
const fixtureSourceManifest = companySubscriptionUiFixtureSourceFiles(root).map(relative => ({path:relative,sha256:sha(readFileSync(path.join(root,relative)))}));
let child,browser,origin,serverLog = '',failure,browserClosed = false,serverClosed = false,fixtureCleanupProof,closeAck = false;
let childClose;

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
function alignCommercial(value) {
  const termsText = ' Condiciones comerciales sintéticas de ensayo.\r\nAbono mensual para toda la empresa.\nPodés cancelar la renovación y conservar el período pagado.\n';
  const catalog = approvedCommercialCatalog({version:1,catalogVersion:value.configuration.catalogVersion,offers:value.configuration.offers.map(item => ({...item,includedTerms:'Servicios incluidos según estas condiciones sintéticas aprobadas. Sin adicionales automáticos.',termsText,termsSha256:commercialTermsSha256(termsText)}))});
  value.commercial = {...catalog,actorBinding:'e'.repeat(64),offers:catalog.offers.map(item => ({...item,canAccept:true,checkoutAvailable:true}))};return value;
}
function snapshot(scope = scopeA,ready = true) {
  const value = {...closedCompanySubscriptionFixture({scope,observedAt:fixedNow}),organization:{id:scope === scopeA?'org_UI_A':'org_UI_B',name:scope === scopeA?'Empresa sintética A':'Empresa sintética B'},subscription:{plan:'TRIAL',status:'TRIALING',trialEndsAt:'2026-10-15T03:00:00.000Z',entitlement:{allowed:true,basis:'CURRENT_TRIAL',reasonCode:null}}};
  if (ready) {value.configuration = {state:'READY',catalogVersion:'catalog-original',offers:[offer(),offer('ENTERPRISE')]};alignCommercial(value);}return value;
}
function acceptance(value,command) {
  const selected = value.commercial.offers.find(item => item.id === command.offerId);assert.ok(selected);
  const {canAccept,checkoutAvailable,...immutable} = selected;
  assert.deepEqual(command,{action:'accept_offer',scope:value.scope,operationId:command.operationId,offerId:selected.id,catalogVersion:value.commercial.catalogVersion,catalogDigest:value.commercial.catalogDigest,offerDigest:selected.offerDigest,termsVersion:selected.termsVersion,termsSha256:selected.termsSha256,accepted:true});
  const receipt = {version:1,receiptId:commercialAcceptanceId(value.organization.id,command.operationId),operationId:command.operationId,state:'TERMS_ACCEPTED',organizationId:value.organization.id,actorBinding:value.commercial.actorBinding,catalogVersion:value.commercial.catalogVersion,catalogDigest:value.commercial.catalogDigest,offer:immutable,acceptedAt:fixedNow,current:true,canCheckout:checkoutAvailable};
  receipt.acceptanceDigest = commercialAcceptanceDigest(receipt);return receipt;
}
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
  let currentKind = kind,latest = null,beginCommand = null,acceptCommand = null,acceptedReceipt = null;
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
      if (intercepted.method() === 'POST') {assert.equal(url.search,'');command = JSON.parse(intercepted.postData());scope = command.scope;assert.ok(['accept_offer','begin','recover','cancel_renewal'].includes(command.action));const keys = {accept_offer:['action','scope','operationId','offerId','catalogVersion','catalogDigest','offerDigest','termsVersion','termsSha256','accepted'],begin:['action','scope','operationId','offerId','catalogVersion','acceptanceReceiptId','acceptanceDigest'],recover:['action','scope','operationId'],cancel_renewal:['action','scope','operationId','subscriptionAttemptId']}[command.action];assert.deepEqual(Object.keys(command).sort(),keys.sort());}
      else {assert.equal(intercepted.method(),'GET');assert.deepEqual([...url.searchParams.keys()],url.searchParams.has('acceptanceOperationId')?['scope','acceptanceOperationId']:['scope']);scope = url.searchParams.get('scope');if (url.searchParams.has('acceptanceOperationId')) assert.equal(url.searchParams.get('acceptanceOperationId'),acceptCommand.operationId);}
      assert.ok([scopeA,scopeB].includes(scope));
      const logged = {label,method:intercepted.method(),scope,action:command?.action || null,operationId:command?.operationId || null,acceptanceOperationId:url.searchParams.get('acceptanceOperationId'),tokenGeneration:Number(intercepted.headers().authorization.split('-').at(-2)),kind:currentKind,...(command?{command:structuredClone(command)}:{})};requests.push(logged);apiRequests.push(logged);
      if (command && command.action !== 'recover') {
        const durable = (await references(page)).find(row => row.operationId === command.operationId);
        assert.ok(durable,'The real IDB reference must be committed before POST');assert.equal(durable.scope,scope);assert.equal(durable.organizationId,scope === scopeA?'org_UI_A':'org_UI_B');assert.equal(durable.action,command.action);assert.deepEqual(Object.keys(durable).sort(),['version','scope','organizationId','operationId','action','createdAt'].sort());logged.durableBeforeDispatch = true;
      }
      let value;
      if (command?.action === 'accept_offer') {
        acceptCommand = structuredClone(command);latest = latest && latest.scope === scope?latest:snapshot(scope);acceptedReceipt = acceptance(latest,command);latest.acceptance = acceptedReceipt;value = latest;
        if (currentKind === 'acceptance-lost') {await intercepted.abort('failed');return;}
      } else if (command?.action === 'begin') {
        assert.ok(acceptedReceipt,'Checkout requires the actual preceding accepted receipt');assert.equal(command.acceptanceReceiptId,acceptedReceipt.receiptId);assert.equal(command.acceptanceDigest,acceptedReceipt.acceptanceDigest);assert.equal(command.offerId,acceptedReceipt.offer.id);assert.notEqual(command.operationId,acceptedReceipt.operationId,'Financial and consent operations are distinct');
        beginCommand = structuredClone(command);
        if (currentKind === 'begin-unreserved') {latest = null;await intercepted.respond({status:503,contentType:'application/json',body:JSON.stringify({code:'COMPANY_SUBSCRIPTION_UNCONFIRMED'})});return;}
        const chosen = snapshot(scope).configuration.offers.find(item => item.id === command.offerId);assert.ok(chosen);latest = checkout(scope,command,chosen);latest.acceptance = acceptedReceipt;
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
      else if (currentKind === 'financial-unknown') {latest = checkout(scope,{operationId:'11111111-1111-4111-8111-111111111111',catalogVersion:'catalog-original'});latest.attempt = {...latest.attempt,state:'UNKNOWN',checkoutUrl:null};value = latest;}
      else if (currentKind === 'terminal-expired') {latest = paid(scope);latest.attempt = {...latest.attempt,state:'CANCEL_CONFIRMED',cancelAtPeriodEnd:true,paidPeriod:{startsAt:'2026-09-12T12:00:00.000Z',endsAt:fixedNow}};latest.subscription = {...latest.subscription,status:'CANCELED',entitlement:{allowed:false,basis:null,reasonCode:'COMPANY_ENTITLEMENT_CANCELED'}};value = latest;}
      else if (currentKind === 'closed') value = snapshot(scope,false);
      else if (currentKind === 'immutable-new-catalog') {value = structuredClone(latest);value.configuration = {state:'READY',catalogVersion:'catalog-new',offers:[{...offer('PRO','ARS','20599950'),taxTreatment:'Condiciones nuevas aprobadas.',termsVersion:'terms-new'}]};alignCommercial(value);value.acceptance.current = false;value.acceptance.canCheckout = false;}
      else if (currentKind === 'acceptance-absent') value = snapshot(scope);
      else if (currentKind === 'changed-actor') {value = structuredClone(latest || snapshot(scope));value.commercial.actorBinding = 'f'.repeat(64);if (value.acceptance) {value.acceptance.current = false;value.acceptance.canCheckout = false;}}
      else if (currentKind === 'changed-catalog') {value = snapshot(scope);value.configuration.catalogVersion = 'catalog-new';alignCommercial(value);}
      else if (currentKind === 'invalid-terms') {value = snapshot(scope);value.commercial.offers[0].termsText += 'FOREIGN PRIVATE TERMS';}
      else if (currentKind === 'invalid-catalog') {value = snapshot(scope);value.commercial.catalogDigest = 'f'.repeat(64);}
      else if (currentKind === 'foreign-receipt') {value = structuredClone(latest);value.acceptance.actorBinding = 'f'.repeat(64);value.acceptance.acceptanceDigest = commercialAcceptanceDigest(value.acceptance);}
      else if (latest && latest.scope === scope) value = latest;
      else value = snapshot(scope);
      await intercepted.respond({status:200,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(value)});
    } catch (error) {interceptErrors.push({label,message:error.message});if (!intercepted.isInterceptResolutionHandled()) await intercepted.abort().catch(() => {});}
  });
  await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await waitText(page,'Plan y pago');await idle(page);
  assert.ok(requests.length >= 1 && requests.every(row => row.method === 'GET'),'Mount may only read state');
  return {page,context,requests,setKind:value => {currentKind = value;},getBegin:() => beginCommand,getAccept:() => acceptCommand,getLatest:() => latest};
}
async function choose(state,plan = 'PRO') {
  await state.page.focus(`input[type="radio"][value="offer-${plan.toLowerCase()}"]`);await state.page.keyboard.press('Space');
  assert.equal(await state.page.$eval('form button[type="submit"]',node => node.disabled),true,'Price review alone is not confirmation');
  assert.equal(await state.page.$eval('[data-commercial-offers] input[type="checkbox"]',node => node.checked),false,'No implied consent');assert.equal(await state.page.$eval('[data-offer-terms]',node => node.textContent),' Condiciones comerciales sintéticas de ensayo.\r\nAbono mensual para toda la empresa.\nPodés cancelar la renovación y conservar el período pagado.\n','The exact approved text precedes consent');
  await state.page.focus('[data-commercial-offers] input[type="checkbox"]');await state.page.keyboard.press('Space');assert.equal(await state.page.$eval('form button[type="submit"]',node => node.disabled),false);
  await click(state.page,'Aceptar condiciones de '+(plan === 'PRO'?'Pro':'Empresa'));await waitText(state.page,'Las condiciones quedaron aceptadas');await idle(state.page);
}
async function screenshot(page,filename,width) {const target = path.join(screenshots,filename);await page.screenshot({path:target,fullPage:true});screenshotManifest.push({width,path:path.relative(root,target).split(path.sep).join('/'),sha256:sha(readFileSync(target))});}
async function viewportScenario(width) {
  const state = await makePage('viewport-'+width,{width,kind:'closed'});
  try {
    await state.page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
    await waitText(state.page,'El pago en línea todavía no está habilitado');const closed = await layout(state.page,width);
    assert.equal(await state.page.$$eval('section input[type="checkbox"],section a',nodes => nodes.length),0);assert.ok((await panelText(state.page)).includes('USD 149,00'));assert.ok((await panelText(state.page)).includes('USD 349,00'));
    await state.page.click('input[type="radio"][value="pro-monthly"]');await waitText(state.page,'pendientes de aprobación');assert.equal(await state.page.$$eval('section input[type="checkbox"]',nodes => nodes.length),0);assert.equal(state.requests.filter(row => row.method === 'POST').length,0);
    state.setKind('ready');await click(state.page,'Actualizar estado');await idle(state.page);await waitText(state.page,'Elegí el plan de tu empresa');
    const ready = await layout(state.page,width);await choose(state);const review = await layout(state.page,width);
    assert.equal(await state.page.$eval('[data-commercial-offers] label',node => getComputedStyle(node).transitionDuration),'0s');await screenshot(state.page,`review-${width}.png`,width);
    await click(state.page,'Continuar con Pro');await waitText(state.page,'Continuar en Mercado Pago');await idle(state.page);
    const checkoutLayout = await layout(state.page,width),link = await state.page.$eval('section a',node => ({href:node.href,target:node.target,rel:node.rel,referrerPolicy:node.referrerPolicy}));
    assert.deepEqual(link,{href:'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=synthetic_subscription',target:'_blank',rel:'noopener noreferrer',referrerPolicy:'no-referrer'});assert.equal(state.requests.filter(row => row.action === 'begin').length,1);
    state.setKind('recover-authorized');await click(state.page,'Ya volví · comprobar pago');await waitText(state.page,'Débito autorizado · pago pendiente');assert.ok(!(await panelText(state.page)).includes('Pago confirmado para el período vigente.'));
    state.setKind('recover-paid');await click(state.page,'Comprobar pago y renovación');await waitText(state.page,'Pago confirmado para el período vigente.');
    const paidLayout = await layout(state.page,width),paidText = await panelText(state.page);assert.match(paidText,/10\/11\/2026.*09:00/);
    await click(state.page,'Cancelar renovación');assert.equal(await state.page.$eval('[data-subscription-cancel] button[type="submit"]',node => node.disabled),true);await state.page.click('[data-subscription-cancel] input[type="checkbox"]');await click(state.page,'Confirmar cancelación de renovación');await waitText(state.page,'La renovación quedó cancelada.');await idle(state.page);
    const canceled = await layout(state.page,width),canceledText = await panelText(state.page);assert.match(canceledText,/10\/11\/2026.*09:00/);assert.ok(canceledText.includes('Pago confirmado para el período vigente.'));assert.equal(state.requests.filter(row => row.action === 'cancel_renewal').length,1);assert.equal(state.requests.filter(row => row.action === 'begin').length,1);
    await screenshot(state.page,`canceled-${width}.png`,width);
    assert.equal(state.requests.filter(row => row.action === 'accept_offer').length,1);assert.notEqual(state.getBegin().operationId,state.getAccept().operationId);
    checks.push({check:'commercial-acceptance-payment-cancellation:'+width,width,closed,ready,review,checkout:checkoutLayout,paid:paidLayout,canceled,mutations:state.requests.filter(row => row.method === 'POST')});
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
    const text = await panelText(state.page);assert.ok(text.includes('USD 149,00 por mes'));assert.ok(text.includes('Impuestos incluidos · condiciones originales.'));assert.ok(text.includes('ARS 205.999,50') && text.includes('Condiciones nuevas aprobadas.'));assert.equal(await state.page.$('[data-subscription-begin]'),null,'Changed catalog never reuses acceptance for checkout');assert.equal(state.requests.filter(row => row.action === 'begin').length,1);
    checks.push({check:'original-checkout-price-currency-tax-terms-survive-changed-current-catalog'});
  } finally {await state.context.close();}
}
async function cleanupFailureScenario() {
  const state = await makePage('journal-readback-failure-after-confirmed-checkout');
  try {
    await choose(state);await state.page.evaluate(() => {
      const journal = window.__subscriptionJournal,settle = journal.settle,read = journal.read;
      journal.settle = async function(...args) {const value = await settle.apply(this,args);window.__settlementInjected = true;this.read = async function() {this.read = read;throw Object.assign(new Error('Controlled storage failure'),{code:'WORKSPACE_RECOVERY_STORAGE_UNAVAILABLE'});};return value;};
    });
    await click(state.page,'Continuar con Pro');await waitText(state.page,'Continuar en Mercado Pago');await idle(state.page);
    assert.equal(await state.page.evaluate(() => window.__settlementInjected),true);assert.deepEqual(await references(state.page),[]);assert.equal(await state.page.$('[data-subscription-begin]'),null,'A settled financial response cannot restore a fresh checkout after storage failure');assert.equal(state.requests.filter(row => row.action === 'begin').length,1);
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
    state.setKind('cancel-lost');await click(state.page,'Cancelar renovación');await state.page.click('[data-subscription-cancel] input[type="checkbox"]');await click(state.page,'Confirmar cancelación de renovación');await waitText(state.page,'La confirmación no llegó.');await idle(state.page);
    const cancellation = state.requests.find(row => row.action === 'cancel_renewal');assert.ok(cancellation);assert.equal((await references(state.page))[0].operationId,cancellation.operationId);assert.ok(!(await panelText(state.page)).includes('Acceso pagado hasta'),'Unconfirmed response hides old private facts until a fresh GET');
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
    checks.push({check:'late-response-cannot-restore-old-access:'+kind,kind,requests:state.requests});
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
    state.setKind(kind);await click(state.page,'Actualizar estado');await idle(state.page);const text = await panelText(state.page);assert.ok(!text.includes('Empresa sintética A') && !text.includes('USD 149'));assert.ok(!text.includes('CONTROLLED PRIVATE'));assert.equal(await state.page.$$eval('section a,section input',nodes => nodes.length),0);assert.equal(state.requests.filter(row => row.method === 'POST').length,0);checks.push({check:'denial-or-foreign-envelope-erases-old-financial-actions:'+kind,kind});
  } finally {await state.context.close();}
}
async function lateTokenScenario() {
  const state = await makePage('unmount-before-token');
  try {
    const count = state.requests.length;await state.page.evaluate(() => {window.__holdToken = true;});await click(state.page,'Actualizar estado');await state.page.waitForFunction(() => typeof window.__releaseToken === 'function');await state.page.evaluate(() => window.__unmountSubscription());await state.page.waitForSelector('[data-unmounted]');await state.page.evaluate(() => window.__releaseToken());await wait(100);assert.equal(state.requests.length,count);checks.push({check:'token-resolved-after-unmount-does-not-dispatch'});
  } finally {await state.context.close();}
}

async function acceptanceUncertaintyScenario() {
  const state = await makePage('acceptance-get-recovery');
  try {
    state.setKind('acceptance-lost');await state.page.click('input[type="radio"][value="offer-pro"]');await state.page.click('[data-commercial-offers] input[type="checkbox"]');await click(state.page,'Aceptar condiciones de Pro');await waitText(state.page,'La confirmación no llegó.');await idle(state.page);
    const original = state.getAccept();assert.ok(original);assert.equal((await references(state.page))[0].operationId,original.operationId);assert.equal((await references(state.page))[0].action,'accept_offer');assert.equal(await state.page.$('[data-subscription-begin]'),null);assert.ok(!(await panelText(state.page)).includes('Empresa sintética A'));
    state.setKind('acceptance-absent');await state.page.reload({waitUntil:'networkidle0'});await waitText(state.page,'Hay un intento por comprobar');await idle(state.page);await click(state.page,'Comprobar este intento');await idle(state.page);assert.equal((await references(state.page))[0].operationId,original.operationId,'Absent acceptance never permits a new UUID');assert.equal(await state.page.$('[data-subscription-begin]'),null);
    state.setKind('ready');await click(state.page,'Comprobar este intento');await waitText(state.page,'Las condiciones quedaron aceptadas');await idle(state.page);assert.deepEqual(await references(state.page),[]);assert.equal(state.requests.filter(row => row.action === 'accept_offer').length,1);assert.equal(state.requests.filter(row => row.action === 'begin' || row.action === 'recover').length,0);assert.ok(state.requests.filter(row => row.acceptanceOperationId).every(row => row.method === 'GET' && row.acceptanceOperationId === original.operationId));
    checks.push({check:'acceptance-uncertainty-reload-get-only',requests:state.requests});
  } finally {await state.context.close();}
}
async function bindingChangeScenario() {
  const state = await makePage('commercial-binding-change');
  try {
    await state.page.click('input[type="radio"][value="offer-pro"]');await state.page.click('[data-commercial-offers] input[type="checkbox"]');
    await state.page.evaluate(() => {const form = document.querySelector('[data-commercial-offers]'),key = Object.keys(form).find(key => key.startsWith('__reactProps$'));window.__retainedAccept = form[key].onSubmit;});
    state.setKind('changed-catalog');await click(state.page,'Actualizar estado');await idle(state.page);assert.equal(await state.page.$('[data-commercial-offers] input[type="checkbox"]'),null);assert.ok(await state.page.$$eval('input[type="radio"]',nodes => nodes.every(node => !node.checked)));await state.page.evaluate(() => window.__retainedAccept({preventDefault(){}}));await idle(state.page);assert.equal(state.requests.filter(row => row.method === 'POST').length,0,'A retained old form cannot use a cleared confirmation');
    state.setKind('ready');await click(state.page,'Actualizar estado');await idle(state.page);await choose(state);await state.page.evaluate(() => {const form = document.querySelector('[data-subscription-begin]'),key = Object.keys(form).find(key => key.startsWith('__reactProps$'));window.__retainedBegin = form[key].onSubmit;});
    state.setKind('changed-actor');await click(state.page,'Actualizar estado');await idle(state.page);assert.equal(await state.page.$('[data-offer-acceptance]'),null);await state.page.evaluate(() => window.__retainedBegin({preventDefault(){}}));await idle(state.page);assert.equal(state.requests.filter(row => row.action === 'begin').length,0);assert.equal(state.requests.filter(row => row.action === 'accept_offer').length,1);
    checks.push({check:'changed-commercial-binding-clears-unchecked-draft',requests:state.requests});
  } finally {await state.context.close();}
}
async function invalidCommercialScenario() {
  for (const kind of ['invalid-terms','invalid-catalog','foreign-receipt']) {
    const state = await makePage('invalid-'+kind);
    try {
      if (kind === 'foreign-receipt') await choose(state);
      const count = state.requests.filter(row => row.method === 'POST').length;state.setKind(kind);await click(state.page,'Actualizar estado');await idle(state.page);assert.equal(await state.page.$$eval('section input,section a,[data-subscription-begin],[data-offer-acceptance]',nodes => nodes.length),0);assert.ok(!(await panelText(state.page)).includes('FOREIGN PRIVATE TERMS'));assert.equal(state.requests.filter(row => row.method === 'POST').length,count);
    } finally {await state.context.close();}
  }
  checks.push({check:'invalid-digests-and-foreign-receipt-hide-all-actions',cases:['terms-text','catalog-digest','rehashed-foreign-actor-receipt']});
}
async function existingFinancialUnknownScenario() {
  const state = await makePage('acceptance-preserves-financial-unknown',{kind:'financial-unknown'});
  try {
    await waitText(state.page,'Pago por comprobar');assert.equal(await state.page.$('[data-subscription-begin]'),null);assert.deepEqual(await references(state.page),[],'A fresh tab may lack the existing server financial reference');
    await choose(state);assert.equal(await state.page.$('[data-subscription-begin]'),null);await waitText(state.page,'Pago por comprobar');assert.equal(state.getLatest().attempt.operationId,'11111111-1111-4111-8111-111111111111');assert.notEqual(state.getLatest().attempt.operationId,state.getAccept().operationId);
    state.setKind('ready');await state.page.reload({waitUntil:'networkidle0'});await waitText(state.page,'Pago por comprobar');await idle(state.page);assert.equal(await state.page.$('[data-subscription-begin]'),null);assert.equal(state.requests.filter(row => row.action === 'begin').length,0);assert.equal(state.requests.filter(row => row.action === 'accept_offer').length,1);assert.equal(state.requests.filter(row => row.action === 'recover').length,0);
    checks.push({check:'acceptance-preserves-existing-financial-unknown',requests:state.requests});
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
  child = spawn(process.execPath,[childFile],{cwd:fixture,env:companySubscriptionUiServerEnvironment(process.env),stdio:['ignore','pipe','pipe','ipc'],windowsHide:true});
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
  await acceptanceUncertaintyScenario();await bindingChangeScenario();await invalidCommercialScenario();await existingFinancialUnknownScenario();
  assert.deepEqual(pageErrors,[]);assert.deepEqual(interceptErrors,[]);assert.deepEqual(externalRequests,[]);
  for (const source of sourceManifest) assert.equal(sha(readFileSync(path.join(root,source.path))),source.sha256,'Dependency changed during rendering; repeat against exact final bytes');
  assert.deepEqual(checks.map(row => row.check),COMPANY_SUBSCRIPTION_UI_CHECKS,'Every exported causal group must actually run');
  assert.deepEqual(sourceManifest.map(row => row.path),companySubscriptionUiSourceFiles(root));
  assert.deepEqual(fixtureSourceManifest.map(row => row.path),companySubscriptionUiFixtureSourceFiles(root));
  for (const source of [...fixtureSourceManifest,...dependencyManifest]) assert.equal(sha(readFileSync(path.join(root,source.path))),source.sha256,'Producer dependency changed during rendering');
  assert.equal(sha(readFileSync(new URL(import.meta.url))),harnessSha256,'Harness changed during rendering');assert.equal(sha(readFileSync(new URL('./lib/owned-fixture-cleanup.mjs',import.meta.url))),cleanupHelperSha256);
  assert.equal(git(['rev-parse','HEAD']),sourceRevision);assert.equal(git(['rev-parse','HEAD^{tree}']),sourceTree);if (process.env.CI === 'true') assert.equal(git(['status','--porcelain','--untracked-files=no']),'');
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
const proof = {version:COMPANY_SUBSCRIPTION_UI_VERSION,status:failure?'FAILED':'PASS',recordedAt:new Date().toISOString(),runId,sourceRevision,sourceTree,expectedHead:options.expectedHead,sourceState:trackedClean?'clean-git-head':'local-working-tree',sourceAfterChecked:!failure,environment:'isolated-localhost-next-exact-jsx-with-intercepted-synthetic-api',widths:COMPANY_SUBSCRIPTION_UI_WIDTHS,checks,sourceManifest,fixtureSourceManifest,dependencyManifest,screenshotManifest,apiRequests,externalImports:[...externalImports].sort(),harnessSha256,cleanupHelperSha256,pageErrors,interceptErrors,externalRequests,cleanup:{browserClosed,serverClosed,gracefulCloseAcknowledged:closeAck,fixtureRemoved:fixtureCleanupProof?.fixtureRemoved === true,fixtureCleanupProof},productionLoginVerified:false,productionDataWritten:false,providerRequests:0,paymentAttempted:false,paymentVerified:false,physicalDeviceAccepted:false,...(failure?{failure:failure.message,serverLog}:{})};
writeFileSync(target,JSON.stringify(proof,null,2),{flag:'wx'});
console.log(JSON.stringify({status:proof.status,evidence:path.relative(root,target).split(path.sep).join('/'),checks:checks.length,widths:proof.widths,cleanup:proof.cleanup}));
if (failure) throw failure;
return proof;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await verifyCompanySubscriptionUi();
