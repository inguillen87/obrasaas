import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,copyFileSync,writeFileSync,rmSync,readdirSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import puppeteer from 'puppeteer';
import {purchaseReceiptId} from '../src/lib/site-purchase-policy.mjs';
import {RECOVERY_DATABASE_NAME} from '../src/app/(identity)/cuenta/workspace-recovery-storage.mjs';

// Real account, mutation, transport, journal and recovery components.
// Session tokens and HTTP replies are controlled fixtures, never a login.
assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV);
const root=process.cwd(),evidence=path.join(root,'.vercel/workspace-reload-evidence');
mkdirSync(evidence,{recursive:true});
const fixture=mkdtempSync(path.join(root,'.vercel/workspace-reload-ui-')),app=path.join(fixture,'src/app'),components=path.join(app,'(identity)/cuenta');
mkdirSync(components,{recursive:true});mkdirSync(path.join(fixture,'src/lib'),{recursive:true});copyFileSync(path.join(root,'src/lib/worker-channel-consent-policy.mjs'),path.join(fixture,'src/lib/worker-channel-consent-policy.mjs'));
copyFileSync(path.join(root,'src/lib/geo.js'),path.join(fixture,'src/lib/geo.js'));
mkdirSync(path.join(fixture,'src/lib/whatsapp'),{recursive:true});copyFileSync(path.join(root,'src/lib/whatsapp/tenant-workspace-policy.js'),path.join(fixture,'src/lib/whatsapp/tenant-workspace-policy.js'));
for(const file of readdirSync(path.join(root,'src/app/(identity)/cuenta')).filter(name=>/\.(js|mjs|css)$/.test(name)))copyFileSync(path.join(root,'src/app/(identity)/cuenta',file),path.join(components,file));
const sourcePaths=[...readdirSync(path.join(root,'src/app/(identity)/cuenta')).filter(name=>/\.(?:js|mjs|css)$/.test(name)).map(name=>'src/app/(identity)/cuenta/'+name),...["src/lib/geo.js","src/lib/procurement-money.js","src/lib/procurement-quantity.js","src/lib/site-purchase-policy.mjs","src/lib/site-register-policy.mjs","src/lib/whatsapp/tenant-workspace-policy.js","src/lib/worker-channel-consent-policy.mjs","src/lib/workspace-policy.mjs"]],copiedSourcePaths=new Set(["src/app/(identity)/cuenta/company-bootstrap-panel.js","src/app/(identity)/cuenta/company-bootstrap-panel.module.css","src/app/(identity)/cuenta/constructor-crm-panel.js","src/app/(identity)/cuenta/constructor-crm-panel.module.css","src/app/(identity)/cuenta/constructor-crm-view.mjs","src/app/(identity)/cuenta/customer-inbox-panel.js","src/app/(identity)/cuenta/customer-inbox-panel.module.css","src/app/(identity)/cuenta/customer-inbox-view.mjs","src/app/(identity)/cuenta/customer-whatsapp-panel.js","src/app/(identity)/cuenta/customer-whatsapp-panel.module.css","src/app/(identity)/cuenta/customer-whatsapp-view.mjs","src/app/(identity)/cuenta/demo-pilot-panel.js","src/app/(identity)/cuenta/demo-pilot-view.mjs","src/app/(identity)/cuenta/field-media-capture.js","src/app/(identity)/cuenta/field-media-preparation.mjs","src/app/(identity)/cuenta/field-media-preview.js","src/app/(identity)/cuenta/field-operations-panel.js","src/app/(identity)/cuenta/field-operations-panel.module.css","src/app/(identity)/cuenta/field-qr-capture.js","src/app/(identity)/cuenta/field-qr-reader.mjs","src/app/(identity)/cuenta/invitation-entry.js","src/app/(identity)/cuenta/kyc-photo-preparation.js","src/app/(identity)/cuenta/meta-onboarding-panel.js","src/app/(identity)/cuenta/meta-onboarding-panel.module.css","src/app/(identity)/cuenta/meta-sdk-loader.mjs","src/app/(identity)/cuenta/onboarding-guide.js","src/app/(identity)/cuenta/onboarding-guide.module.css","src/app/(identity)/cuenta/operations-status-panel.js","src/app/(identity)/cuenta/operations-status-panel.module.css","src/app/(identity)/cuenta/page.js","src/app/(identity)/cuenta/participant-panel.js","src/app/(identity)/cuenta/participant-panel.module.css","src/app/(identity)/cuenta/private-workspace-download.js","src/app/(identity)/cuenta/schedule-workbench.js","src/app/(identity)/cuenta/schedule-workbench.mjs","src/app/(identity)/cuenta/schedule-workbench.module.css","src/app/(identity)/cuenta/session-recovery.js","src/app/(identity)/cuenta/site-purchase-panel.js","src/app/(identity)/cuenta/site-purchase-panel.module.css","src/app/(identity)/cuenta/site-purchase-view.mjs","src/app/(identity)/cuenta/site-register-panel.js","src/app/(identity)/cuenta/site-register-panel.module.css","src/app/(identity)/cuenta/task-create-panel.js","src/app/(identity)/cuenta/template-send-panel.js","src/app/(identity)/cuenta/template-send-panel.module.css","src/app/(identity)/cuenta/template-send-view.mjs","src/app/(identity)/cuenta/worker-channel-panel.js","src/app/(identity)/cuenta/worker-channel-panel.module.css","src/app/(identity)/cuenta/workspace-client.js","src/app/(identity)/cuenta/workspace-identity.js","src/app/(identity)/cuenta/workspace-recovery-journal.mjs","src/app/(identity)/cuenta/workspace-recovery-panel.js","src/app/(identity)/cuenta/workspace-recovery-storage.mjs","src/app/(identity)/cuenta/workspace-request-lifecycle.js","src/app/(identity)/cuenta/workspace-request-lifecycle.mjs","src/app/(identity)/cuenta/workspace-session-request.mjs","src/app/(identity)/cuenta/workspace-tools-navigation.js","src/app/(identity)/cuenta/workspace-tools-navigation.module.css","src/app/(identity)/cuenta/workspace.module.css","src/lib/geo.js","src/lib/whatsapp/tenant-workspace-policy.js","src/lib/worker-channel-consent-policy.mjs"]);
const sourceManifest=sourcePaths.map(file=>{const bytes=readFileSync(path.join(root,file));if(copiedSourcePaths.has(file)||file.startsWith('src/app/(identity)/cuenta/'))assert.deepEqual(bytes,readFileSync(path.join(fixture,file)));return {path:file,sha256:createHash('sha256').update(bytes).digest('hex')};});
assert.equal(new Set(sourceManifest.map(row=>row.path)).size,sourceManifest.length);
const harnessSha256=createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex');
writeFileSync(path.join(fixture,'package.json'),JSON.stringify({name:'isolated-workspace-reload-ui-fixture',private:true}));
writeFileSync(path.join(fixture,'next.config.mjs'),'export default {turbopack:{root:'+JSON.stringify(root)+'}};\n');
writeFileSync(path.join(app,'layout.js'),'export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:16,background:"#0b1c2d",fontFamily:"Arial,sans-serif"}}>{children}</body></html>}');
writeFileSync(path.join(app,'page.js'),`'use client';
import {useCallback,useEffect,useState} from 'react';
import {AccountWorkspace} from './(identity)/cuenta/workspace-client';
import {browserRecoveryJournal,WORKSPACE_RECOVERY_PREFIX,validateWorkspaceRecoveryStoredEntry} from './(identity)/cuenta/workspace-recovery-journal.mjs';
import {createBrowserRecoveryStorage} from './(identity)/cuenta/workspace-recovery-storage.mjs';
export default function Page(){
 const [context,setContext]=useState('A');
 const token=useCallback(async()=>{if(window.__rejectToken){window.__rejectToken=false;throw new Error('controlled SDK failure');}return 'synthetic-current-'+context;},[context]);
 useEffect(()=>{
  window.__recoveryFixture={list:scope=>browserRecoveryJournal.list(scope),abortBeforeCommit:async entry=>{
   const controller=new AbortController();
   const storage=createBrowserRecoveryStorage({prefix:WORKSPACE_RECOVERY_PREFIX,validateStored:validateWorkspaceRecoveryStoredEntry});
   try{await storage('readwrite',entry.scope,view=>{view.setItem(WORKSPACE_RECOVERY_PREFIX+entry.scope+'.'+entry.resource+'.'+entry.operationId,JSON.stringify(entry));controller.abort();},controller.signal);return {committed:true};}
   catch(error){return {name:error.name,code:error.code,requestDispatched:error.requestDispatched};}
  }};
  return ()=>{delete window.__recoveryFixture;};
 },[]);
 return <main style={{maxWidth:1000,margin:'0 auto'}}><div><button onClick={()=>setContext('A')}>Contexto A</button><button onClick={()=>setContext('B')}>Contexto B</button></div><AccountWorkspace key={context} getSessionToken={token}/></main>;
}`);
const port=3162,origin='http://127.0.0.1:'+port,prefix='obrasaas.pending-receipt.v1.';
const scopeA='a'.repeat(64),scopeB='b'.repeat(64),revision='2026-09-30T12:00:00.123456';
const uuid='12345678-1234-4234-8234-123456789012';
const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',fixture,'--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
let serverLog='',browser,activeScenario;
for(const stream of [server.stdout,server.stderr])stream.on('data',data=>{serverLog=(serverLog+data.toString()).slice(-20000);});
const checks=[],pageErrors=[],screenshots=[];
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const text=page=>page.evaluate(()=>document.body.innerText);
async function waitText(page,value){await page.waitForFunction(expected=>document.body.innerText.includes(expected),{timeout:15000},value);}
async function click(page,label){const handle=await page.evaluateHandle(name=>[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===name||button.hasAttribute('aria-pressed')&&button.querySelector('span')?.textContent.trim()===name),label);const element=handle.asElement();assert.ok(element,'Missing button '+label);await element.click();await handle.dispose();}
const keyOf=entry=>prefix+entry.scope+'.'+entry.resource+'.'+entry.operationId;
const entry=(resource='task-creation',extra={})=>({version:1,resource,scope:scopeA,projectId:'p-a',operationId:uuid,createdAt:Date.now(),...extra});
const task=context=>({id:'task-'+context.toLowerCase(),title:'Tarea sintética '+context,status:'IN_PROGRESS',progress:37,startsOn:'2026-10-01',endsOn:'2026-10-05',revision});
// Read the real committed authority. Legacy localStorage is used only as an
// upgrade input; it cannot prove that a reservation committed.
const stored=page=>page.evaluate(async(p,scopes)=>{
 const entries=(await Promise.all(scopes.map(scope=>window.__recoveryFixture.list(scope)))).flat();
 return Object.fromEntries(entries.map(entry=>[p+entry.scope+'.'+entry.resource+'.'+entry.operationId,JSON.stringify(entry)]));
},prefix,[scopeA,scopeB]);
function assertMetadataOnly(snapshot){
 for(const [key,raw] of Object.entries(snapshot)){
  assert.ok(key.startsWith(prefix));const value=JSON.parse(raw);
  const fields=['version','resource','scope','projectId','operationId','createdAt',...(value.resource==='site-photo'?['reportId']:[]),...(value.resource==='meta-onboarding'?['action','eventId']:[])];
  assert.deepEqual(Object.keys(value).sort(),fields.sort());assert.match(value.operationId,/^[0-9a-f-]{36}$/);
  assert.doesNotMatch(raw,/synthetic-current|PRIVATE_FORM_MARKER|profile|jwt|token|front|selfie|latitude|longitude|caption|phone|email|body|payload/i);
 }
}
function state(mode='uncertain'){return {mode,posts:[],receipts:[],requests:[],records:new Map(),outcome:null,receiptStatus:200,delay:0,abortedReceipts:0,persistedBeforeDispatch:false};}
async function createPage(context,current,{width=390,snapshot={},failStorage=false,noLocks=false}={}){
 const page=await context.newPage();await page.setViewport({width,height:1000});
 page.on('pageerror',error=>pageErrors.push({message:error.message,width}));
 await page.evaluateOnNewDocument((saved,blocked,p,disableLocks,database)=>{
  for(const [key,value] of Object.entries(saved))localStorage.setItem(key,value);
  if(disableLocks)Object.defineProperty(navigator,'locks',{configurable:true,value:undefined});
  if(blocked){const open=IDBFactory.prototype.open;IDBFactory.prototype.open=function(name,...args){if(name===database)throw new DOMException('Controlled blocked native storage','QuotaExceededError');return open.call(this,name,...args);};}
  const put=IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put=function(...args){
   const request=put.apply(this,args);
   if(this.name==='references'&&this.transaction.db.name===database&&window.__abortNextReferencePut){
    window.__abortNextReferencePut=false;
    request.addEventListener('success',()=>{request.transaction.abort();window.__referenceCommitAborted=true;},{once:true});
   }
   return request;
  };
 },snapshot,failStorage,prefix,noLocks,RECOVERY_DATABASE_NAME);
 await page.setRequestInterception(true);
 page.on('request',async request=>{
  try{
   const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();return request.abort();}
   if(!url.pathname.startsWith('/api/identity/'))return request.continue();
   const resource=url.pathname.split('/').at(-1),auth=request.headers().authorization;
   assert.ok(['Bearer synthetic-current-A','Bearer synthetic-current-B'].includes(auth));
   const actor=auth.endsWith('-A')?'A':'B',scope=actor==='A'?scopeA:scopeB,projectId=actor==='A'?'p-a':'p-b';
   current.requests.push({method:request.method(),resource,actor,query:url.search});
   let body,status=200;
   if(request.method()==='POST'){
    const command=JSON.parse(request.postData());assert.equal(command.scope,scope);assert.equal(command.projectId,projectId);
    const snapshotNow=await stored(page);assertMetadataOnly(snapshotNow);
    assert.ok(Object.values(snapshotNow).some(raw=>JSON.parse(raw).operationId===command.operationId),'Reference persisted before HTTP dispatch');
    current.persistedBeforeDispatch=true;current.posts.push(command);
    if(resource==='task-creation')body={scope,created:true,receiptId:'receipt-task-'+command.operationId,task:{...task(actor),id:'new-'+command.operationId,title:command.title,progress:0,status:'BACKLOG'}};
    else if(resource==='workspace')body={scope,saved:true,receipt:{id:'receipt-plan-'+command.operationId,taskId:command.taskId,recordedAt:'2026-10-01T12:00:00.111111',before:{startsOn:'2026-10-01',endsOn:'2026-10-05'},after:{startsOn:command.startsOn,endsOn:command.endsOn,revision:'2026-10-01T12:00:00.111111'}},task:{...task(actor),startsOn:command.startsOn,endsOn:command.endsOn,revision:'2026-10-01T12:00:00.111111'}};
    else throw new Error('Unexpected business mutation '+resource);
    current.records.set(command.operationId,body);
    if(current.mode==='uncertain'){status=503;body={code:'WORKSPACE_OPERATION_UNCONFIRMED',saved:false};}
    else if(current.mode==='rejected'){status=409;body={code:'SCHEDULE_REVISION_CHANGED',saved:false};}
   }else if(url.searchParams.has('operationId')){
    assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),projectId);
    const operationId=url.searchParams.get('operationId');current.receipts.push({resource,operationId,actor,query:url.search});
    if(current.delay)await pause(current.delay);
    status=current.receiptStatus;const record=current.records.get(operationId);
    body=current.outcome??(record?{scope,state:'RECORDED',...(record.receipt?{saved:true,receipt:record.receipt,task:record.task}:{created:true,receiptId:record.receiptId,task:record.task})}:{scope,state:'NOT_OBSERVED',definitive:false});
    if(status!==200)body={code:'WORKSPACE_MEMBERSHIP_REQUIRED',saved:false};
   }else if(resource==='workspace'&&!url.search){
    body={scope,organizationName:'Organización sintética '+actor,role:'SITE_MANAGER',roleLabel:actor==='A'?'Jefatura de obra':'Consulta',canPlanSchedule:true,canManageIntegrations:false,projects:[{id:projectId,name:'Obra sintética '+actor}],projectsTruncated:false};
   }else if(resource==='workspace'){
    assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),projectId);
    body={scope,project:{id:projectId,name:'Obra sintética '+actor},canPlanSchedule:true,tasks:[task(actor)],totalTasks:1,nextCursor:null};
   }else throw new Error('Unexpected query '+resource);
   if(!request.isInterceptResolutionHandled())await request.respond({status,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});
  }catch(error){
   if(error.message.includes('Invalid InterceptionId')||error.message.includes('Target closed')||error.message.includes('Session closed')){current.abortedReceipts++;return;}
   pageErrors.push({message:error.message,width});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});
  }
 });
 await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await waitText(page,'Organización sintética A');await page.waitForFunction(()=>typeof window.__recoveryFixture?.list==='function');return page;
}
async function fillTask(page,title='PRIVATE_FORM_MARKER tarea recuperable'){
 await page.bringToFront();
 await click(page,'Obra sintética A');await waitText(page,'Tarea sintética A');await click(page,'Nueva tarea');await page.type('form input:not([type="date"])',title);
}
async function startTask(page,title){await fillTask(page,title);await click(page,'Crear tarea');}
async function capture(page,name){
 const file=name+'.png';await page.screenshot({path:path.join(evidence,file),fullPage:true});screenshots.push(file);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow '+name);
}
async function reloadRecovery(width){
 const context=await browser.createBrowserContext(),current=state(),page=await createPage(context,current,{width});
 await startTask(page);await waitText(page,'La confirmación no llegó');assert.equal(current.posts.length,1);
 const snapshot=await stored(page);assertMetadataOnly(snapshot);assert.equal(Object.keys(snapshot).length,1);assert.equal(current.persistedBeforeDispatch,true);
 const operationId=current.posts[0].operationId;assert.equal(JSON.parse(Object.values(snapshot)[0]).operationId,operationId);
 await page.reload({waitUntil:'networkidle0'});await waitText(page,'Operaciones por comprobar');
 assert.equal(current.posts.length,1);assert.equal(current.receipts.length,0);await capture(page,'reload-pending-'+width);
 await click(page,'Comprobar recibo');await waitText(page,'Guardado confirmado');
 assert.equal(current.receipts.length,1);assert.equal(current.receipts[0].operationId,operationId);assert.equal(current.posts.length,1);assert.deepEqual(await stored(page),{});
 checks.push('actual-reload-recovers-task-receipt-without-repost-'+width);
 if(width===390){await capture(page,'reload-confirmed-390');checks.push('storage-before-dispatch-contains-only-reference-not-form-or-token');}
 await context.close();
}
async function closeAndClone(){
 const old=await browser.createBrowserContext(),current=state();let page=await createPage(old,current);
 await startTask(page);await waitText(page,'La confirmación no llegó');const snapshot=await stored(page);assertMetadataOnly(snapshot);
 await page.close();page=await createPage(old,current);await waitText(page,'Operaciones por comprobar');assert.equal(current.posts.length,1);assert.equal(current.receipts.length,0);await page.close();
 const fresh=await browser.createBrowserContext();page=await createPage(fresh,current,{snapshot});await waitText(page,'Operaciones por comprobar');await click(page,'Comprobar recibo');await waitText(page,'Guardado confirmado');assert.equal(current.posts.length,1);assert.deepEqual(await stored(page),{});
 checks.push('actual-tab-close-open-preserves-pending-reference');checks.push('isolated-context-restoration-from-reference-only-storage-clone');await old.close();await fresh.close();
}
async function notObservedBlocksDuplicate(){
 const context=await browser.createBrowserContext(),current=state(),pending=entry(),page=await createPage(context,current,{snapshot:{[keyOf(pending)]:JSON.stringify(pending)}});
 await waitText(page,'Operaciones por comprobar');assert.equal(current.receipts.length,0);await click(page,'Comprobar recibo');await waitText(page,'Esto no demuestra que el envío se haya perdido');
 assert.equal(Object.keys(await stored(page)).length,1);await startTask(page,'Nueva tarea explícita distinta');await waitText(page,'Hay un envío anterior sin confirmar');
 assert.equal(current.posts.length,0);assert.equal(Object.keys(await stored(page)).length,1);await capture(page,'not-observed-no-duplicate-390');checks.push('not-observed-retains-reference-and-blocks-a-new-uuid');await context.close();
}
async function storageFailure(corrupt=false){
 const context=await browser.createBrowserContext(),current=state(),pending=entry(),snapshot=corrupt?{[keyOf(pending)]:'{malformed-reference'}:{};
 const page=await createPage(context,current,{snapshot,failStorage:!corrupt});if(corrupt)await waitText(page,'No se pueden consultar las referencias pendientes');
 await startTask(page);await waitText(page,'la operación no se envió');assert.equal(current.posts.length,0);assert.equal(current.receipts.length,0);
 assert.equal(await page.$eval('form input:not([type="date"])',node=>node.value),'PRIVATE_FORM_MARKER tarea recuperable');
 checks.push(corrupt?'corrupt-current-reference-blocks-post-without-losing-form':'quota-failure-blocks-post-before-fetch-and-preserves-form');await context.close();
}
async function contextIsolation(late=false){
 const context=await browser.createBrowserContext(),current=state(),pending=entry(),page=await createPage(context,current,{snapshot:{[keyOf(pending)]:JSON.stringify(pending)}});
 await waitText(page,'Operaciones por comprobar');
 if(late){current.delay=600;current.outcome={scope:scopeA,state:'RECORDED',created:true,receiptId:'receipt-old-context',task:{...task('A'),id:'new-a'}};await click(page,'Comprobar recibo');await page.waitForFunction(()=>document.body.innerText.includes('Comprobando…'));}
 await click(page,'Contexto B');await waitText(page,'Organización sintética B');await pause(late?850:50);
 assert.ok(!(await text(page)).includes('Operaciones por comprobar'));assert.ok(!(await text(page)).includes('Guardado confirmado'));assert.ok(!(await text(page)).includes('Tarea sintética A'));
 assert.equal(Object.keys(await stored(page)).length,1);assert.equal(current.posts.length,0);assert.equal(current.receipts.length,late?1:0);
 await click(page,'Contexto A');await waitText(page,'Operaciones por comprobar');
 checks.push(late?'late-old-context-receipt-is-aborted-and-does-not-clear-or-enter-new-account':'different-user-org-role-scope-does-not-display-or-query-old-references');await context.close();
}
async function noDispatchPreservesPrevious(){
 const context=await browser.createBrowserContext(),current=state(),page=await createPage(context,current);
 await startTask(page);await waitText(page,'La confirmación no llegó');current.records.clear();await click(page,'Comprobar tarea');await waitText(page,'No se observa un recibo todavía');
 const before=await stored(page);await page.evaluate(()=>{window.__rejectToken=true;});await click(page,'Reintentar la misma creación');await waitText(page,'No se pudo renovar');
 assert.equal(current.posts.length,1);assert.deepEqual(await stored(page),before);assertMetadataOnly(before);checks.push('sdk-failure-before-retry-fetch-preserves-previous-uncertain-reference');await context.close();
}
async function firstSdkFailure(){
 const context=await browser.createBrowserContext(),current=state(),page=await createPage(context,current);
 await click(page,'Obra sintética A');await waitText(page,'Tarea sintética A');await click(page,'Nueva tarea');await page.type('form input:not([type="date"])','PRIVATE_FORM_MARKER no enviado');await page.evaluate(()=>{window.__rejectToken=true;});await click(page,'Crear tarea');await waitText(page,'No se pudo renovar');
 assert.equal(current.posts.length,0);assert.deepEqual(await stored(page),{});checks.push('first-sdk-failure-does-not-leave-a-phantom-reference');await context.close();
}
async function canonicalQuery(resource,outcome='RECORDED'){
 const extra=resource==='site-photo'?{reportId:'report-a'}:resource==='meta-onboarding'?{action:'review_inbox',eventId:'event-a'}:{};
 const pending=entry(resource,extra),context=await browser.createBrowserContext(),current=state();
 current.outcome=outcome==='RECORDED'?resource==='meta-onboarding'?{scope:scopeA,projectId:'p-a',receipt:{operationId:uuid,eventId:'event-a',action:'review_inbox',state:'RECORDED',actorOperationVerified:true,receiptId:'receipt-meta-a'}}:{scope:scopeA,state:'RECORDED',saved:resource!=='task-creation',created:resource==='task-creation',receiptId:'receipt-'+resource}:{scope:scopeA,state:outcome,definitive:false,...(outcome==='PROCESSING'?{expiresAt:new Date(Date.now()+60000).toISOString(),retryAfterExpiration:true}:{})};
  if(resource==='site-purchases'){const receiptId=purchaseReceiptId('synthetic-purchase-actor',{operationId:uuid,projectId:'p-a'});current.outcome={scope:scopeA,projectId:'p-a',state:'RECORDED',saved:true,definitive:true,receiptId,replayed:true,receipt:{id:receiptId,operationId:uuid,requestId:'purchase-request-a',action:'DRAFT_ORDER'},record:{id:'purchase-request-a',material:'Material sintético',requestedQuantity:'10',unit:'unidad',sector:'Sector de ensayo',requestState:'OPEN',revision:'2026-10-01T10:00:00.000001',order:{state:'DRAFT',supplier:'Proveedor sintético',quantity:'10',unitPrice:'2',total:'20',currency:'ARS',reference:'Cotización sintética',received:'0',decision:null,receipts:[]}}};}
 const page=await createPage(context,current,{snapshot:{[keyOf(pending)]:JSON.stringify(pending)}});await waitText(page,'Operaciones por comprobar');assert.equal(current.receipts.length,0);await click(page,'Comprobar recibo');
 await waitText(page,outcome==='RECORDED'?'Guardado confirmado':outcome==='PROCESSING'?'El procesamiento sigue pendiente':'La invitación necesita comprobarse');
 assert.equal(current.posts.length,0);assert.equal(current.receipts.length,1);const params=new URLSearchParams(current.receipts[0].query);assert.equal(params.get('operationId'),uuid);
 if(resource==='site-photo')assert.equal(params.get('reportId'),'report-a');if(resource==='meta-onboarding'){assert.equal(params.get('eventId'),'event-a');assert.equal(params.get('action'),'review_inbox');}
 assert.equal(Object.keys(await stored(page)).length,outcome==='RECORDED'?0:1);checks.push('canonical-'+resource+'-'+outcome.toLowerCase()+'-get-only-recovery');await context.close();
}
async function unauthorizedReceipt(){
 const context=await browser.createBrowserContext(),current=state(),pending=entry();current.receiptStatus=403;
 const page=await createPage(context,current,{snapshot:{[keyOf(pending)]:JSON.stringify(pending)}});await waitText(page,'Operaciones por comprobar');await click(page,'Comprobar recibo');await waitText(page,'Conservamos la referencia');
 assert.equal(Object.keys(await stored(page)).length,1);assert.equal(current.posts.length,0);checks.push('receipt-permission-denial-retains-reference-without-declaring-rollback');await context.close();
}
async function tamperedEntry(){
 const context=await browser.createBrowserContext(),current=state(),pending={...entry(),endpoint:'https://invalid.example/collect',token:'synthetic-forbidden'};
 const page=await createPage(context,current,{snapshot:{[keyOf(pending)]:JSON.stringify(pending)}});await waitText(page,'No se pueden consultar las referencias pendientes');assert.equal(current.receipts.length,0);await startTask(page);await waitText(page,'la operación no se envió');assert.equal(current.posts.length,0);
 checks.push('unexpected-fields-or-url-in-storage-are-rejected-before-any-recovery-or-post');await context.close();
}
async function abortedReferenceCommit(){
 const context=await browser.createBrowserContext(),current=state(),page=await createPage(context,current);
 await fillTask(page,'PRIVATE_FORM_MARKER conserva borrador tras abortar');assert.deepEqual(await stored(page),{});
 await page.evaluate(()=>{window.__abortNextReferencePut=true;});await click(page,'Crear tarea');await waitText(page,'la operación no se envió');
 assert.equal(await page.evaluate(()=>window.__referenceCommitAborted),true);assert.equal(current.posts.length,0);assert.deepEqual(await stored(page),{});
 assert.equal(await page.$eval('form input:not([type="date"])',node=>node.value),'PRIVATE_FORM_MARKER conserva borrador tras abortar');
 checks.push('native-idb-abort-before-reference-commit-blocks-post-and-preserves-draft');
 await click(page,'Crear tarea');await waitText(page,'La confirmación no llegó');assert.equal(current.posts.length,1);assert.equal(current.persistedBeforeDispatch,true);assert.equal(Object.keys(await stored(page)).length,1);
 checks.push('explicit-retry-after-aborted-idb-commit-reserves-before-http');await context.close();
}
async function abortedFactoryCallback(){
 const context=await browser.createBrowserContext(),current=state(),page=await createPage(context,current);
 assert.deepEqual(await stored(page),{});
 const result=await page.evaluate(pending=>window.__recoveryFixture.abortBeforeCommit(pending),entry());
 assert.equal(result.name,'AbortError');assert.equal(result.requestDispatched,false);assert.deepEqual(await stored(page),{});assert.equal(current.posts.length,0);
 checks.push('actual-storage-factory-cancelled-callback-never-commits-a-reference');await context.close();
}
async function confirmedLegacyDoesNotReturn(){
 const context=await browser.createBrowserContext(),current=state(),pending=entry();
 current.outcome={scope:scopeA,state:'RECORDED',created:true,receiptId:'receipt-legacy-upgrade',task:{...task('A'),id:'legacy-upgrade-task'}};
 const page=await createPage(context,current,{snapshot:{[keyOf(pending)]:JSON.stringify(pending)}});await waitText(page,'Operaciones por comprobar');
 const migrated=await stored(page);assertMetadataOnly(migrated);assert.equal(Object.keys(migrated).length,1);
 assert.equal(JSON.parse(Object.values(migrated)[0]).operationId,pending.operationId);checks.push('legacy-reference-is-migrated-into-actual-idb-authority');
 await click(page,'Comprobar recibo');await waitText(page,'Guardado confirmado');assert.deepEqual(await stored(page),{});assert.equal(current.receipts.length,1);assert.equal(current.posts.length,0);
 // The original legacy snapshot is deliberately restored on navigation by the
 // preload hook. Its migration marker must prevent a confirmed attempt returning.
 await page.reload({waitUntil:'networkidle0'});await waitText(page,'Organización sintética A');
 await page.waitForFunction(async scope=>typeof window.__recoveryFixture?.list==='function'&&(await window.__recoveryFixture.list(scope)).length===0&&!document.body.innerText.includes('Operaciones por comprobar'),{timeout:15000},scopeA);
 assert.deepEqual(await stored(page),{});assert.equal(current.receipts.length,1);assert.equal(current.posts.length,0);await capture(page,'legacy-confirmed-not-reimported-390');
 checks.push('confirmed-idb-reference-is-not-reimported-from-stale-legacy-after-reload');await context.close();
}
async function twoTabRace(iteration){
 const context=await browser.createBrowserContext(),current=state(),first=await createPage(context,current),second=await createPage(context,current);
 activeScenario={name:'twoTabRace-'+iteration,pages:[first,second],current};
 assert.ok(await first.evaluate(()=>window.isSecureContext&&typeof navigator.locks?.request==='function'),'Native Web Locks required for this fixture');
 await fillTask(first,'PRIVATE_FORM_MARKER intento primera pestaña');await fillTask(second,'PRIVATE_FORM_MARKER intento segunda pestaña');
 await Promise.all([first.$eval('form',form=>form.requestSubmit()),second.$eval('form',form=>form.requestSubmit())]);
 await Promise.all([first.waitForFunction(()=>document.body.innerText.includes('La confirmación no llegó')||document.body.innerText.includes('Hay un envío anterior sin confirmar'),{polling:'mutation',timeout:15000}),second.waitForFunction(()=>document.body.innerText.includes('La confirmación no llegó')||document.body.innerText.includes('Hay un envío anterior sin confirmar'),{polling:'mutation',timeout:15000})]);
 assert.equal(current.posts.length,1);const snapshot=await stored(first);assertMetadataOnly(snapshot);assert.equal(Object.keys(snapshot).length,1);assert.equal(JSON.parse(Object.values(snapshot)[0]).operationId,current.posts[0].operationId);
 const messages=[await text(first),await text(second)];assert.equal(messages.filter(value=>value.includes('La confirmación no llegó')).length,1);assert.equal(messages.filter(value=>value.includes('Hay un envío anterior sin confirmar')).length,1);
 assert.equal(current.receipts.length,0);assert.deepEqual(await stored(second),snapshot);
 checks.push(iteration===1?'two-real-tabs-native-web-locks-allow-only-one-new-operation':'two-real-tabs-atomic-idb-reservation-one-post-iteration-'+iteration);await context.close();activeScenario=null;
}
async function noBrowserLocks(){
 const context=await browser.createBrowserContext(),current=state(),page=await createPage(context,current,{noLocks:true});
 await startTask(page);await waitText(page,'navegador actualizado');assert.equal(current.posts.length,0);assert.deepEqual(await stored(page),{});assert.equal(current.receipts.length,0);
 checks.push('unavailable-browser-locks-stop-mutation-before-fetch');await context.close();
}
async function cancelWhileWaitingForLock(){
 const context=await browser.createBrowserContext(),current=state(),holder=await createPage(context,current),page=await createPage(context,current);
 await holder.evaluate(scope=>{window.__heldLock=navigator.locks.request('obrasaas-receipt:'+scope,async()=>{window.__lockReady=true;await new Promise(resolve=>{window.__releaseLock=resolve;});});},scopeA);
 await holder.waitForFunction(()=>window.__lockReady===true);await fillTask(page);await click(page,'Crear tarea');await pause(100);assert.equal(current.posts.length,0);assert.deepEqual(await stored(page),{});
 await click(page,'Contexto B');await waitText(page,'Organización sintética B');await holder.evaluate(()=>window.__releaseLock());await pause(200);
 assert.equal(current.posts.length,0);assert.deepEqual(await stored(page),{});checks.push('unmount-while-waiting-native-lock-never-dispatches-late-post');await context.close();
}
try{
 let ready=false;
 for(let i=0;i<120;i++){if(server.exitCode!==null)throw new Error('Fixture server exited: '+serverLog.slice(-5000));let response;try{response=await fetch(origin);}catch{}await response?.body?.cancel();if(response?.ok){ready=true;break;}if(response&&response.status>=500)throw new Error('Fixture compile failed: '+serverLog.slice(-5000));await pause(500);}
 assert.ok(ready,'Fixture server unavailable: '+serverLog.slice(-5000));
 browser=await puppeteer.launch({headless:true,protocolTimeout:30000,...(process.platform==='win32'?{channel:'chrome'}:{}),args:['--no-sandbox','--disable-setuid-sandbox']});
 const locksOnly=process.env.WORKSPACE_RELOAD_UI_LOCKS_ONLY==='1';
 if(!locksOnly){
 for(const width of [320,390,768,1280])await reloadRecovery(width);
 await closeAndClone();await notObservedBlocksDuplicate();await storageFailure();await storageFailure(true);await contextIsolation();await contextIsolation(true);await noDispatchPreservesPrevious();await firstSdkFailure();
 for(const resource of ['workspace','site-register','site-photo','participants','field-operations','field-media','site-purchases','whatsapp-setup','meta-onboarding'])await canonicalQuery(resource);
 await canonicalQuery('field-media','PROCESSING');await canonicalQuery('participants','INVITATION_UNCONFIRMED');await unauthorizedReceipt();await tamperedEntry();
 }
 await abortedReferenceCommit();await abortedFactoryCallback();if(!locksOnly)await confirmedLegacyDoesNotReturn();
 for(let iteration=1;iteration<=5;iteration++)await twoTabRace(iteration);
 await noBrowserLocks();await cancelWhileWaitingForLock();assert.deepEqual(pageErrors,[]);
 const proof={status:'PASS',environment:'isolated-browser-real-components-with-controlled-session-and-http',suite:locksOnly?'native-idb-lock-focal':'full-reload-and-isolation',widths:locksOnly?[390]:[320,390,768,1280],checks,sourceManifest,harnessSha256,pageErrors,screenshots,nativeWebLocksTested:true,nativeIndexedDbAuthorityTested:true,twoTabRaceIterations:5,reservationCommittedBeforeHttpTested:true,abortedTransactionBeforeHttpTested:true,legacyMigrationAndNoReimportTested:!locksOnly,secureContext:'trusted-http-loopback',actualPageReloadTested:!locksOnly,actualTabCloseOpenTested:!locksOnly,profileRestartSimulatedByReferenceOnlyStorageClone:!locksOnly,realClerkLogin:false,realEmailDelivery:false,productionDataWritten:false,realProviderCalls:0,providerCallCountScope:'This local controlled fixture only; it does not describe public Clerk SDK bootstrap or provider calls in other release checks.',physicalDeviceAccepted:false,automaticRecoveryPostCount:0};
 writeFileSync(path.join(evidence,'browser.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify({status:proof.status,checks:checks.length,pageErrors:pageErrors.length,screenshots,evidence:path.join(evidence,'browser.json')}));
}catch(error){
 const scenario=activeScenario?{name:activeScenario.name,posts:activeScenario.current.posts.map(row=>({operationId:row.operationId,scope:row.scope,projectId:row.projectId})),requests:activeScenario.current.requests,rows:[]}:null;
 if(scenario)for(const [index,page] of activeScenario.pages.entries()){
  try{scenario.rows.push({index,url:page.url(),dom:await text(page),committedReferences:await stored(page)});await page.bringToFront();await page.screenshot({path:path.join(evidence,'failed-two-tabs-'+index+'.png'),fullPage:true});}
  catch(snapshotError){scenario.rows.push({index,snapshotError:snapshotError.message});}
 }
 writeFileSync(path.join(evidence,'browser-failure.json'),JSON.stringify({status:'FAILED',message:error.message,checks,pageErrors,serverLog,scenario},null,2));throw error;
}
finally{
 await browser?.close();
 if(server.exitCode===null){if(process.platform==='win32')await new Promise(resolve=>{const kill=spawn('taskkill',['/PID',String(server.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});kill.on('exit',resolve);kill.on('error',resolve);});else{try{process.kill(-server.pid,'SIGTERM');}catch{}}}
 await pause(300);assert.equal(path.dirname(path.resolve(fixture)),path.resolve(root,'.vercel'));rmSync(fixture,{recursive:true,force:true});
}
