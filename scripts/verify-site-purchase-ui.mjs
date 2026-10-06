import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,copyFileSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import puppeteer from 'puppeteer';
import {applyPurchase,normalizePurchase,purchaseReceiptId} from '../src/lib/site-purchase-policy.mjs';
assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV);
// PRIVATE PROPOSAL: relative imports target scripts/ placement after root approval.
// Do not run this private copy; source proposal and baseline publication are not applied here.
const widths=[320,390,768,1280],focusedScenario=process.env.PURCHASE_UI_SCENARIO||null;
const denialVariants=['html-401','html-403','json-membership-403','json-context-409','json-project-404'];
const invalidVariants=['receipt-id','missing-record','wrong-record','wrong-scope'];
const proposedModes=[...denialVariants.flatMap(value=>['get-denial-'+value,'post-denial-'+value]),...invalidVariants.flatMap(value=>['post-invalid-'+value,'get-invalid-'+value]),'conflict-resolve','conflict-state-invalid','late-get-context','late-post-context','post-not-observed-local','post-not-observed-global'];
assert.ok(!focusedScenario||proposedModes.includes(focusedScenario));
assert.ok(!process.env.PURCHASE_UI_WIDTH||focusedScenario,'A single width requires a focused scenario');
const selectedWidths=process.env.PURCHASE_UI_WIDTH?[Number(process.env.PURCHASE_UI_WIDTH)]:widths;assert.ok(selectedWidths.every(width=>widths.includes(width)));
const root=process.cwd(),output=path.resolve(root,process.env.PURCHASE_UI_EVIDENCE_DIR||'.vercel/purchase-evidence');assert.ok(output.startsWith(root+path.sep));mkdirSync(output,{recursive:true});
const fixture=mkdtempSync(path.join(root,'.vercel/purchase-ui-')),app=path.join(fixture,'app');mkdirSync(app);
const copiedFiles=['site-purchase-panel.js','site-purchase-panel.module.css','site-purchase-view.mjs','workspace-session-request.mjs','workspace-request-lifecycle.mjs','workspace-request-lifecycle.js','workspace-recovery-journal.mjs','company-channel-view.mjs','workspace-recovery-storage.mjs','private-workspace-download.js','workspace-recovery-panel.js','workspace.module.css','template-send-view.mjs'];
for(const name of copiedFiles)copyFileSync(path.join(root,'src/app/(identity)/cuenta',name),path.join(app,name));
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const importedPolicies=['site-purchase-policy.mjs','workspace-policy.mjs','site-register-policy.mjs','procurement-quantity.js','procurement-money.js'];
const sourcePaths=[...copiedFiles.map(name=>'src/app/(identity)/cuenta/'+name),...importedPolicies.map(name=>'src/lib/'+name)];
const sourceManifest=sourcePaths.map(file=>({path:file,sha256:sha256(readFileSync(path.join(root,file)))}));
for(const file of copiedFiles)assert.deepEqual(readFileSync(path.join(app,file)),readFileSync(path.join(root,'src/app/(identity)/cuenta',file)));
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',timeout:15000}).trim();
const sourceContext={sha:git('rev-parse','HEAD'),tree:git('rev-parse','HEAD^{tree}'),workingInputsDifferFromHead:Boolean(git('status','--porcelain','--',...sourcePaths)),canonicalWorkingLfSources:sourcePaths.map(file=>({path:file,sha256:sha256(readFileSync(path.join(root,file),'utf8').replaceAll('\r\n','\n'))}))};
writeFileSync(path.join(fixture,'package.json'),JSON.stringify({private:true,name:'controlled-purchase-ui'}));
writeFileSync(path.join(fixture,'next.config.mjs'),`export default {devIndicators:false,turbopack:{root:${JSON.stringify(root)}}};`);
writeFileSync(path.join(app,'layout.js'),`export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:12,background:'#081c2d',fontFamily:'Arial,sans-serif'}}>{children}</body></html>}`);
const scope='a'.repeat(64),projectId='project-a';
writeFileSync(path.join(app,'page.js'),`'use client';import {useCallback,useEffect,useState} from 'react';import {SitePurchasePanel} from './site-purchase-panel';import {WorkspaceRecoveryPanel} from './workspace-recovery-panel';const getSessionToken=async()=>window.__missingTabSession?null:'active-tab-controlled-token';const projects=[{id:'${projectId}',name:'Obra de ensayo'},{id:'project-b',name:'Otra obra de ensayo'}];export default function Page(){const [pending,setPending]=useState(false),[context,setContext]=useState(false),[recovered,setRecovered]=useState(0);const onPending=useCallback(value=>setPending(value),[]),onRecovered=useCallback(()=>setRecovered(value=>value+1),[]);useEffect(()=>{window.__purchaseFixtureMounted=true;return()=>{delete window.__purchaseFixtureMounted;};},[]);const id=context?'project-b':'${projectId}',currentScope=context?'${'b'.repeat(64)}':'${scope}';return <main style={{maxWidth:1000,margin:'0 auto'}}><button data-testid="project-switch" disabled={pending}>Cambiar obra</button><button data-testid="forced-context" onClick={()=>setContext(true)}>Cambiar contexto del ensayo</button><output data-testid="global-recovered">{recovered}</output><SitePurchasePanel key={currentScope+':'+id} getSessionToken={getSessionToken} projectId={id} scope={currentScope} onPending={onPending}/><WorkspaceRecoveryPanel key={'recovery:'+currentScope} scope={currentScope} projects={projects} getSessionToken={getSessionToken} onRecovered={onRecovered}/></main>}`);
const origin='http://127.0.0.1:3118',server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',fixture,'--webpack','--hostname','127.0.0.1','--port','3118'],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
let log='',browser,activePage,activeScenario;const errors=[],checks=[],scenarioResults=[];for(const stream of [server.stdout,server.stderr])stream.on('data',chunk=>{log=(log+chunk).slice(-15000);});
const wait=(page,value)=>page.waitForFunction(text=>document.body.innerText.includes(text),{timeout:15000},value);
async function click(page,title){const h=await page.evaluateHandle(text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text),title);assert.ok(h.asElement(),'Missing '+title);await h.asElement().click();await h.dispose();}
async function fill(page,title,value){const h=await page.evaluateHandle(text=>[...document.querySelectorAll('label')].find(l=>l.textContent.trim()===text)?.querySelector('input,textarea'),title);assert.ok(h.asElement(),'Missing '+title);await h.asElement().click();await page.keyboard.down('Control');try{await page.keyboard.press('KeyA');}finally{await page.keyboard.up('Control');}await page.keyboard.press('Backspace');await h.asElement().type(value);assert.equal(await h.asElement().evaluate(row=>row.value),value,'Exact entered value for '+title);await h.dispose();}
async function scenario(width,mode='normal') {
 activeScenario={width,mode};
 const ctx=await browser.createBrowserContext(),page=await ctx.newPage();await page.setViewport({width,height:1000});
 page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
 let version=1,metadata={siteRegister:{version:1,type:'MATERIAL_REQUEST',state:'OPEN',quantity:'12.5',unit:'bolsa',sector:'Planta baja'}};
 const revision=()=>`2026-10-01T12:00:00.${String(version).padStart(6,'0')}`;
 const publicRecord=()=>({id:'request-a',material:'Cemento de ensayo',requestedQuantity:'12.5',unit:'bolsa',sector:'Planta baja',requestState:metadata.siteRegister.state,revision:revision(),order:publicOrder(metadata.procurement)});
 const posts=[],receipts=new Map();let applications=0,statusChecks=0;
 page.on('request',async request=>{
  try {
   const url=new URL(request.url());if(url.pathname.startsWith('/api/identity/'))assert.equal(request.headers().authorization,'Bearer active-tab-controlled-token');if(url.origin!==origin)return request.abort();if(url.pathname!=='/api/identity/site-purchases')return request.continue();
   let body,status=200;
   if(mode==='denied'){status=403;body={code:'WORKSPACE_INTEGRATION_PERMISSION_REQUIRED'};}
   else if(request.method()==='POST') {
    const command=normalizePurchase(JSON.parse(request.postData()));posts.push(command);assert.equal(command.projectId,projectId);assert.equal(command.scope,scope);assert.equal(command.payload.revision,revision());
    if(mode==='conflict'){status=409;body={code:'PURCHASE_REVISION_CHANGED'};}
    else if(mode==='not-arrived'&&posts.length===1){await request.abort('failed');return;}
    else if(['rollback','session-after-unknown-retry'].includes(mode)&&posts.length===1){status=503;body={code:'PURCHASE_OPERATION_UNCONFIRMED'};}
    else {metadata=applyPurchase(metadata,command,'controlled-actor','2026-10-01T12:00:00Z');applications++;version++;body=receiptBody(command,publicRecord());receipts.set(command.operationId,body);if(mode==='uncertain'){status=503;body={code:'PURCHASE_OPERATION_UNCONFIRMED'};}}
   }else if(url.searchParams.has('operationId')){statusChecks++;const found=receipts.get(url.searchParams.get('operationId'));body=found?{...found,replayed:true}:{scope,projectId,state:'NOT_OBSERVED',saved:false,definitive:false};}
   else body={scope,projectId,records:[publicRecord()],total:1,nextCursor:null};
   await request.respond({status,contentType:'application/json',body:JSON.stringify(body),headers:{'Cache-Control':'no-store'}});
  }catch(e){errors.push(e.message);if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}
 });
 await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await click(page,'Abrir compras');
 if(mode==='denied'){await wait(page,'Tu acceso no permite consultar las compras de esta obra.');assert.equal(posts.length,0);assert.equal((await page.evaluate(()=>document.body.innerText)).includes('Cemento de ensayo'),false);assert.equal(await page.$('form'),null);checks.push('denied-no-example-purchases');await ctx.close();return;}
 await wait(page,'Cemento de ensayo');await click(page,'Preparar compra');
 await fill(page,'Proveedor','Proveedor de ensayo');await fill(page,'Precio unitario','123.45');await fill(page,'Referencia de cotización','Cotización 01');await fill(page,'Motivo o detalle','Cotización documentada en este ensayo.');
 assert.ok(await page.$eval('[data-testid="project-switch"]',e=>e.disabled));assert.ok(!(await page.$eval('form input',e=>e.disabled)));
 if(mode==='draft-cancel'){await click(page,'Volver');await page.waitForFunction(()=>!document.querySelector('form')&&!document.querySelector('[data-testid="project-switch"]').disabled);assert.equal(posts.length,0);checks.push('purchase-draft-locks-project-until-explicit-cancel');await ctx.close();return;}
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 if(mode==='session-before-send')await page.evaluate(()=>{window.__missingTabSession=true;});await click(page,'Confirmar operación');
 if(mode==='session-before-send'){await wait(page,'Tu sesión terminó');assert.equal(posts.length,0);assert.equal(applications,0);assert.equal(await page.$eval('form input',e=>e.value),'Proveedor de ensayo');assert.equal(await page.$eval('form input',e=>e.disabled),false);assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Comprobar compra guardada'));await page.evaluate(()=>{window.__missingTabSession=false;});await click(page,'Confirmar operación');await wait(page,'Recibo confirmado');assert.equal(posts.length,1);assert.equal(applications,1);checks.push('missing-session-before-first-post-preserves-draft-with-no-phantom-receipt');await ctx.close();return;}
 if(mode==='uncertain'){await wait(page,'El resultado quedó sin confirmar');assert.equal(posts.length,1);await click(page,'Comprobar compra guardada');await wait(page,'Recibo confirmado');assert.equal(posts.length,1);checks.push('uncertain-save-recovery-without-second-post');await ctx.close();return;}
 if(['rollback','not-arrived','session-after-unknown-retry'].includes(mode)) {
  await wait(page,'El resultado quedó sin confirmar');assert.equal(posts.length,1);assert.equal(applications,0);
  assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Reintentar la misma operación'));
  assert.ok(await page.$eval('[data-testid="project-switch"]',e=>e.disabled));
  assert.ok(await page.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>['Actualizar compras','Volver','Confirmar operación'].includes(b.textContent.trim())).every(b=>b.disabled)));
  assert.ok(await page.evaluate(()=>[...document.querySelectorAll('form input,form textarea,form select')].every(e=>e.disabled)));
  await click(page,'Comprobar compra guardada');await wait(page,'No se observa un recibo todavía');
  assert.equal(statusChecks,1);assert.equal(posts.length,1);assert.equal(await page.$eval('input',e=>e.value),'Proveedor de ensayo');
  assert.ok(await page.$eval('[data-testid="project-switch"]',e=>e.disabled));
  if(mode==='session-after-unknown-retry'){await page.evaluate(()=>{window.__missingTabSession=true;});await click(page,'Reintentar la misma operación');await wait(page,'Tu sesión terminó');assert.equal(posts.length,1);assert.equal(applications,0);assert.ok(await page.$eval('[data-testid="project-switch"]',e=>e.disabled));await page.evaluate(()=>{window.__missingTabSession=false;});await click(page,'Comprobar compra guardada');await wait(page,'No se observa un recibo todavía');assert.equal(posts.length,1);checks.push('unsent-retry-keeps-the-previous-uncertain-operation-and-its-receipt-path');}await click(page,'Reintentar la misma operación');await wait(page,'Recibo confirmado');
  assert.equal(posts.length,2);assert.deepEqual(posts[1],posts[0]);assert.equal(applications,1);assert.equal(metadata.procurement.state,'DRAFT');
  assert.ok(!(await page.$eval('[data-testid="project-switch"]',e=>e.disabled)));
  assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Reintentar la misma operación'));
  checks.push(mode+'-checked-then-exact-retry-with-one-persisted-order');await ctx.close();return;
 }
 if(mode==='conflict'){await wait(page,'Otra persona cambió');assert.equal(await page.$eval('input',e=>e.value),'Proveedor de ensayo');assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Recibo confirmado'));checks.push('conflict-preserves-entered-quote');await ctx.close();return;}
 await wait(page,'1543.13 ARS');await click(page,'Autorizar compra');await fill(page,'Motivo o detalle','Importe autorizado por responsable en este ensayo.');await click(page,'Confirmar operación');await wait(page,'Compra autorizada');
 await click(page,'Registrar entrega');await fill(page,'Cantidad recibida (bolsa)','4.25');await fill(page,'Remito o referencia de entrega','Remito 01');await fill(page,'Motivo o detalle','Entrega parcial comprobada en este ensayo.');await click(page,'Confirmar operación');await wait(page,'Recepción parcial');
 assert.equal(metadata.procurement.received,'4.250');await click(page,'Registrar entrega');await fill(page,'Cantidad recibida (bolsa)','8.25');await fill(page,'Remito o referencia de entrega','Remito 02');await fill(page,'Motivo o detalle','Entrega final comprobada en este ensayo.');await click(page,'Confirmar operación');await wait(page,'Recibida completa');
 assert.equal(posts.length,4);assert.equal(metadata.procurement.received,'12.500');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:path.join(output,`purchase-${width}.png`),fullPage:true});checks.push('purchase-approval-and-partial-receipts-'+width);await ctx.close();
}
function publicOrder(value) {
 if(!value)return null;
 return {state:value.state,supplier:value.supplier,quantity:value.quantity,unitPrice:value.unitPrice,total:value.total,currency:value.currency,reference:value.reference,received:value.received,decision:value.decision?{at:value.decision.at,reason:value.decision.reason}:null,receipts:value.receipts.map(row=>({quantity:row.quantity,deliveryReference:row.deliveryReference,at:row.at,reason:row.reason}))};
}
function receiptBody(command,record) {
 const id=purchaseReceiptId('controlled-actor',command);
 return {scope:command.scope,projectId:command.projectId,state:'RECORDED',saved:true,definitive:true,receiptId:id,replayed:false,receipt:{id,operationId:command.operationId,requestId:command.payload.requestId,action:command.action},record};
}
function corrupted(body,variant) {
 const value=structuredClone(body);
 if(variant==='receipt-id'){value.receiptId={invalid:true};value.receipt.id=value.receiptId;}
 if(variant==='missing-record')delete value.record;
 if(variant==='wrong-record')value.record.id='request-foreign';
 if(variant==='wrong-scope')value.scope='c'.repeat(64);
 return value;
}
async function references(page) {
 const raw=await page.evaluate(async()=>{
  const databases=await indexedDB.databases();if(!databases.some(row=>row.name==='obrasaas-pending-receipts-v1'))throw new Error('Canonical journal was not initialized');
  const records=await new Promise((resolve,reject)=>{const request=indexedDB.open('obrasaas-pending-receipts-v1');request.onerror=()=>reject(new Error('Cannot read journal'));request.onsuccess=()=>{const db=request.result,tx=db.transaction('references','readonly'),query=tx.objectStore('references').getAll();let rows;query.onsuccess=()=>{rows=query.result;};query.onerror=()=>reject(new Error('Cannot read reference rows'));tx.oncomplete=()=>{db.close();resolve(rows);};tx.onabort=()=>{db.close();reject(new Error('Journal read aborted'));};};});
  return {records,other:[...Object.values(localStorage),...Object.values(sessionStorage)]};
 });
 for(const row of raw.records)assert.deepEqual(Object.keys(JSON.parse(row.value)).sort(),['createdAt','operationId','projectId','resource','scope','version']);
 for(const canary of ['Proveedor privado de ensayo','Cotización privada nueva','Motivo privado conservado','unitPrice','payload','active-tab-controlled-token'])assert.equal(JSON.stringify(raw).includes(canary),false,'Private field persisted: '+canary);
 return raw.records.map(row=>JSON.parse(row.value));
}
async function retainedReference(page,command) {
 const rows=await references(page);assert.equal(rows.length,1);assert.equal(rows[0].resource,'site-purchases');assert.equal(rows[0].operationId,command.operationId);assert.equal(rows[0].projectId,command.projectId);assert.equal(rows[0].scope,command.scope);return rows[0];
}
async function noPrivatePurchase(page) {
 const state=await page.evaluate(()=>({text:document.body.innerText,values:[...document.querySelectorAll('form input,form textarea,form select')].map(row=>row.value),forms:document.querySelectorAll('form').length,buttons:[...document.querySelectorAll('button')].map(row=>({text:row.textContent.trim(),disabled:row.disabled})),overflow:document.documentElement.scrollWidth>innerWidth}));
 for(const canary of ['Cemento privado de ensayo','Proveedor privado de ensayo','Cotización privada nueva','Motivo privado conservado','Cotización privada guardada','1543.13 ARS','123.45'])assert.equal(JSON.stringify(state).includes(canary),false,'Private purchase stayed visible: '+canary);
 assert.equal(state.forms,0);assert.equal(state.overflow,false);
 for(const button of state.buttons.filter(row=>['Preparar compra','Editar cotización','Autorizar compra','Rechazar compra','Registrar entrega','Cancelar saldo de compra','Confirmar operación','Reintentar la misma operación'].includes(row.text)))assert.equal(button.disabled,true);
}
async function idlePurchase(page) {
 await page.waitForFunction(()=>{const button=[...document.querySelectorAll('button')].find(row=>row.textContent.trim()==='Comprobar compra guardada');const status=document.querySelector('[aria-labelledby="purchase-title"] [role="status"]');return button&&!button.disabled&&status&&!status.innerText.includes('Consultando o guardando');},{timeout:15000});
}
async function prepareQuote(page) {
 await click(page,'Editar cotización');await fill(page,'Proveedor','Proveedor privado de ensayo');await fill(page,'Precio unitario','123.45');await fill(page,'Referencia de cotización','Cotización privada nueva');await fill(page,'Motivo o detalle','Motivo privado conservado en este ensayo.');
}
function deferred() {
 let done,timer,promise;
 return {get promise(){if(!promise)promise=new Promise((resolve,reject)=>{done=resolve;timer=setTimeout(()=>reject(new Error('Controlled held request timed out')),15000);});return promise;},release:()=>{clearTimeout(timer);done?.();}};
}
async function recoveryScenario(width,mode) {
 activeScenario={width,mode};const ctx=await browser.createBrowserContext(),page=await ctx.newPage();activePage=page;await page.setViewport({width,height:1000});page.on('pageerror',error=>errors.push(error.message));
 await page.setRequestInterception(true);
 let version=1,applications=0,deny=false,statusMode='valid',snapshotReads=0,recoveryReads=0,targetedReads=0;
 let metadata={siteRegister:{version:1,type:'MATERIAL_REQUEST',state:'OPEN',quantity:'12.5',unit:'bolsa',sector:'Planta baja'}};
 const revision=()=>`2026-10-01T12:00:00.${String(version).padStart(6,'0')}`;
 const seed=normalizePurchase({operationId:'10000000-0000-4000-8000-000000000001',projectId,scope,action:'DRAFT_ORDER',payload:{requestId:'request-a',revision:revision(),supplier:'Proveedor privado de ensayo',quantity:'12.5',unitPrice:'123.45',currency:'ARS',reference:'Cotización privada guardada',reason:'Motivo privado de la cotización guardada.'}});
 metadata=applyPurchase(metadata,seed,'controlled-actor','2026-10-01T12:00:00Z');
 const record=()=>({id:'request-a',material:'Cemento privado de ensayo',requestedQuantity:'12.5',unit:'bolsa',sector:'Planta baja',requestState:metadata.siteRegister.state,revision:revision(),order:publicOrder(metadata.procurement)});
 const posts=[],requests=[],receipts=new Map(),oldHeld=deferred(),newHeld=deferred();let oldWaiting=false,newWaiting=false,oldRequest=null,oldTransportEnded=false,oldTransportFailed=false,oldResponseHandled=false;
 page.on('requestfinished',request=>{if(request===oldRequest)oldTransportEnded=true;});
 page.on('requestfailed',request=>{if(request===oldRequest){oldTransportEnded=true;oldTransportFailed=true;}});
 const variant=mode.replace(/^(get-denial-|post-denial-|post-invalid-|get-invalid-)/,'');
 const denial=()=>variant==='html-401'?{status:401,contentType:'text/html',body:'<html>Sesión requerida</html>'}:variant==='html-403'?{status:403,contentType:'text/html',body:'<html>Acceso denegado</html>'}:variant==='json-context-409'?{status:409,contentType:'application/json',body:JSON.stringify({code:'WORKSPACE_CONTEXT_CHANGED'})}:variant==='json-project-404'?{status:404,contentType:'application/json',body:JSON.stringify({code:'WORKSPACE_PROJECT_UNAVAILABLE'})}:{status:403,contentType:'application/json',body:JSON.stringify({code:'WORKSPACE_MEMBERSHIP_REQUIRED'})};
 page.on('request',async request=>{try{
  const url=new URL(request.url());if(url.origin!==origin)return request.abort();if(url.pathname!=='/api/identity/site-purchases')return request.continue();
  assert.equal(request.headers().authorization,'Bearer active-tab-controlled-token');requests.push({method:request.method(),query:Object.fromEntries(url.searchParams)});
  let body,status=200,contentType='application/json';
  if(request.method()==='POST') {
   const command=normalizePurchase(JSON.parse(request.postData()));posts.push(command);assert.equal(command.projectId,projectId);assert.equal(command.scope,scope);assert.equal(command.payload.requestId,'request-a');assert.equal(command.payload.revision,revision());
   if(mode.startsWith('post-denial-')){const error=denial();await request.respond({...error,headers:{'Cache-Control':'private, no-store'}});return;}
   if(mode.startsWith('conflict-')&&posts.length===1) {
    const change=normalizePurchase({...seed,operationId:'10000000-0000-4000-8000-000000000002',action:mode==='conflict-state-invalid'?'REVIEW_ORDER':'DRAFT_ORDER',payload:mode==='conflict-state-invalid'?{requestId:'request-a',revision:revision(),decision:'APPROVED',reason:'Autorización de otro responsable en este ensayo.'}:{...seed.payload,revision:revision(),supplier:'Proveedor vigente de otro responsable',unitPrice:'456.78',reference:'Cotización vigente de otro responsable'}});
    metadata=applyPurchase(metadata,change,'other-controlled-actor','2026-10-01T12:01:00Z');version++;status=409;body={code:'PURCHASE_REVISION_CHANGED'};
   } else {
    metadata=applyPurchase(metadata,command,'controlled-actor','2026-10-01T12:02:00Z');applications++;version++;body=receiptBody(command,record());receipts.set(command.operationId,body);
    if(mode.startsWith('post-invalid-'))body=corrupted(body,variant);
     if(mode.startsWith('post-not-observed-'))body={scope,projectId,state:'NOT_OBSERVED',saved:false,definitive:false};
    if(mode.startsWith('get-invalid-')){status=503;body={code:'PURCHASE_OPERATION_UNCONFIRMED'};}
    if(mode==='late-post-context'){oldRequest=request;oldWaiting=true;await oldHeld.promise;}
   }
  } else if(url.searchParams.has('operationId')) {
   recoveryReads++;assert.ok(posts.length);assert.equal(url.searchParams.get('operationId'),posts[0].operationId);assert.equal(url.searchParams.get('projectId'),projectId);assert.equal(url.searchParams.get('scope'),scope);
   if(statusMode==='denied'){await request.respond({status:403,contentType:'text/html',body:'<html>Permiso de consulta revocado</html>',headers:{'Cache-Control':'private, no-store'}});return;}
   const found=receipts.get(posts[0].operationId);body=found?{...found,replayed:true}:{scope,projectId,state:'NOT_OBSERVED',saved:false,definitive:false};
   if(statusMode==='invalid')body=corrupted(body,variant);
  } else {
   snapshotReads++;if(url.searchParams.has('requestId')){targetedReads++;assert.equal(url.searchParams.get('requestId'),'request-a');assert.equal(url.searchParams.has('after'),false);}
   if(deny){const error=denial();await request.respond({...error,headers:{'Cache-Control':'private, no-store'}});return;}
   const isNew=url.searchParams.get('projectId')==='project-b';
   if(isNew){assert.equal(url.searchParams.get('scope'),'b'.repeat(64));body={scope:'b'.repeat(64),projectId:'project-b',records:[{...record(),id:'request-b',material:'Pedido de la obra nueva',sector:'Sector nuevo',order:null}],total:1,nextCursor:null};newWaiting=true;await newHeld.promise;}
   else {assert.equal(url.searchParams.get('scope'),scope);body={scope,projectId,records:mode.startsWith('conflict-')&&version>1&&!url.searchParams.has('requestId')?[]:[record()],total:1,nextCursor:null};if(mode==='late-get-context'&&snapshotReads===2){oldRequest=request;oldWaiting=true;await oldHeld.promise;}}
  }
  if(!request.isInterceptResolutionHandled())await request.respond({status,contentType,body:JSON.stringify(body),headers:{'Cache-Control':'private, no-store'}});
  if(request===oldRequest)oldResponseHandled=true;
 }catch(error){if(request===oldRequest&&oldTransportFailed&&/Invalid InterceptionId|interception.*handled|Target closed|Session closed/i.test(error.message)){oldResponseHandled=true;return;}errors.push(error.message);if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});if(request===oldRequest)oldResponseHandled=true;}});
 try {
  await page.goto(origin,{waitUntil:'domcontentloaded',timeout:90000});await page.waitForFunction(()=>window.__purchaseFixtureMounted===true,{timeout:15000});await click(page,'Abrir compras');await wait(page,'Cemento privado de ensayo');await prepareQuote(page);
  if(mode.startsWith('get-denial-')) {
   deny=true;await click(page,'Actualizar compras');await page.waitForFunction(()=>!document.querySelector('form'),{timeout:15000});await noPrivatePurchase(page);assert.equal(posts.length,0);assert.equal((await references(page)).length,0);assert.equal(await page.$eval('[data-testid="project-switch"]',row=>row.disabled),false);
   deny=false;await click(page,'Actualizar compras');await wait(page,'Cemento privado de ensayo');assert.equal(posts.length,0);
  } else if(mode.startsWith('post-denial-')) {
   await click(page,'Confirmar operación');await idlePurchase(page);await noPrivatePurchase(page);assert.equal(posts.length,1);assert.equal(applications,0);await retainedReference(page,posts[0]);
   statusMode='denied';await click(page,'Comprobar compra guardada');await idlePurchase(page);await noPrivatePurchase(page);await retainedReference(page,posts[0]);assert.equal(posts.length,1);
   statusMode='valid';await click(page,'Comprobar compra guardada');await wait(page,'No se observa');assert.equal(posts.length,1);await retainedReference(page,posts[0]);assert.equal(await page.evaluate(()=>[...document.querySelectorAll('button')].some(row=>row.textContent.trim()==='Reintentar la misma operación'&&!row.disabled)),false);
   await click(page,'Cerrar consulta y conservar referencia');await wait(page,'Conservamos la referencia pendiente.');await page.waitForFunction(()=>document.querySelector('[data-testid="project-switch"]')?.disabled===false,{timeout:15000});assert.equal(await page.$eval('[data-testid="project-switch"]',row=>row.disabled),false);await retainedReference(page,posts[0]);assert.equal(posts.length,1);assert.equal(applications,0);await noPrivatePurchase(page);
   await page.reload({waitUntil:'domcontentloaded',timeout:90000});await wait(page,'Operaciones por comprobar');await retainedReference(page,posts[0]);await click(page,'Comprobar recibo');await wait(page,'no demuestra que el envío se haya perdido');assert.equal(posts.length,1);await retainedReference(page,posts[0]);
  } else if(mode.startsWith('post-not-observed-')) {
    await click(page,'Confirmar operación');await idlePurchase(page);assert.equal(posts.length,1);assert.equal(applications,1);await retainedReference(page,posts[0]);
    assert.equal(await page.$$eval('form label',labels=>labels.find(label=>label.textContent.trim()==='Proveedor')?.querySelector('input')?.value),'Proveedor privado de ensayo');assert.equal(await page.$eval('form textarea',row=>row.value),'Motivo privado conservado en este ensayo.');
    assert.equal(await page.$eval('button[type="submit"]',row=>row.disabled),true);assert.equal(await page.$eval('[data-testid="project-switch"]',row=>row.disabled),true);
    assert.equal(await page.evaluate(()=>document.body.innerText.includes('Recibo confirmado:')||document.body.innerText.includes('Operación confirmada.')),false);assert.equal(await page.$eval('[data-testid="global-recovered"]',row=>row.textContent),'0');
    await page.screenshot({path:path.join(output,'purchase-'+mode+'-pending-'+width+'.png'),fullPage:true});
    if(mode==='post-not-observed-global'){await page.reload({waitUntil:'domcontentloaded',timeout:90000});await wait(page,'Operaciones por comprobar');await retainedReference(page,posts[0]);await click(page,'Comprobar recibo');await wait(page,'Guardado confirmado');assert.equal(await page.$eval('[data-testid="global-recovered"]',row=>row.textContent),'1');}
    else {await click(page,'Comprobar compra guardada');await wait(page,'Recibo confirmado:');assert.equal(await page.$('form'),null);assert.equal(await page.$eval('[data-testid="global-recovered"]',row=>row.textContent),'0');}
    assert.equal(posts.length,1);assert.equal(applications,1);assert.equal(recoveryReads,1);assert.equal((await references(page)).length,0);
} else if(mode.startsWith('post-invalid-')||mode.startsWith('get-invalid-')) {
   await click(page,'Confirmar operación');await idlePurchase(page);assert.equal(posts.length,1);assert.equal(applications,1);
   if(mode.startsWith('get-invalid-')){statusMode='invalid';await click(page,'Comprobar compra guardada');await idlePurchase(page);}
   assert.equal((await page.evaluate(()=>document.body.innerText)).includes('Recibo confirmado:'),false);await retainedReference(page,posts[0]);
   if(variant==='wrong-scope')await noPrivatePurchase(page);
   await page.reload({waitUntil:'domcontentloaded',timeout:90000});await wait(page,'Operaciones por comprobar');assert.equal(posts.length,1);await retainedReference(page,posts[0]);
   statusMode='invalid';await click(page,'Comprobar recibo');await wait(page,'El resultado no permite confirmar');assert.equal(await page.$eval('[data-testid="global-recovered"]',row=>row.textContent),'0');await retainedReference(page,posts[0]);assert.equal(posts.length,1);
   statusMode='valid';await click(page,'Comprobar recibo');await wait(page,'Guardado confirmado');assert.equal((await references(page)).length,0);assert.equal(await page.$eval('[data-testid="global-recovered"]',row=>row.textContent),'1');assert.equal(posts.length,1);assert.equal(applications,1);
  } else if(mode.startsWith('conflict-')) {
   await click(page,'Confirmar operación');await wait(page,'Otra persona cambió');assert.equal(posts.length,1);assert.equal((await references(page)).length,0);assert.equal(await page.$$eval('form label',labels=>labels.find(label=>label.textContent.trim()==='Proveedor')?.querySelector('input')?.value),'Proveedor privado de ensayo');
   assert.equal(await page.$eval('button[type="submit"]',row=>row.disabled),true);await click(page,'Consultar pedido vigente');await page.waitForFunction(()=>document.querySelector('[aria-labelledby="purchase-title"] [role="status"]')&&!document.querySelector('[aria-labelledby="purchase-title"] [role="status"]').innerText.includes('Consultando o guardando'),{timeout:15000});
   assert.equal(targetedReads,1);assert.equal(posts.length,1);assert.equal(await page.$$eval('form label',labels=>labels.find(label=>label.textContent.trim()==='Proveedor')?.querySelector('input')?.value),'Proveedor privado de ensayo');assert.equal(await page.$eval('form textarea',row=>row.value),'Motivo privado conservado en este ensayo.');
   if(mode==='conflict-state-invalid'){await wait(page,'Compra autorizada');assert.equal(await page.$eval('button[type="submit"]',row=>row.disabled),true);assert.equal(await page.$$eval('label',labels=>labels.some(label=>label.textContent.includes('Revisé el pedido vigente y quiero continuar')&&label.querySelector('input[type=checkbox]'))),false);assert.equal(applications,0);}
   else {await wait(page,'Proveedor vigente de otro responsable');if([320,390].includes(width))await page.screenshot({path:path.join(output,'purchase-conflict-current-review-'+width+'.png'),fullPage:true});assert.equal(await page.$eval('button[type="submit"]',row=>row.disabled),true);const checkbox=await page.evaluateHandle(()=>[...document.querySelectorAll('label')].find(row=>row.textContent.includes('Revisé el pedido vigente y quiero continuar'))?.querySelector('input[type="checkbox"]'));assert.ok(checkbox.asElement());await checkbox.asElement().click();await checkbox.dispose();await click(page,'Confirmar operación');await wait(page,'Recibo confirmado');assert.equal(posts.length,2);assert.notEqual(posts[1].operationId,posts[0].operationId);assert.notEqual(posts[1].payload.revision,posts[0].payload.revision);assert.deepEqual({...posts[1].payload,revision:posts[0].payload.revision},posts[0].payload);assert.equal(applications,1);assert.equal((await references(page)).length,0);}
  } else {
   if(mode==='late-get-context')await click(page,'Actualizar compras');else await click(page,'Confirmar operación');
   const deadline=Date.now()+15000;while(!oldWaiting&&Date.now()<deadline)await new Promise(done=>setTimeout(done,25));assert.equal(oldWaiting,true);
   await page.click('[data-testid="forced-context"]');await wait(page,'Abrir compras');await click(page,'Abrir compras');const newDeadline=Date.now()+15000;while(!newWaiting&&Date.now()<newDeadline)await new Promise(done=>setTimeout(done,25));assert.equal(newWaiting,true);
   oldHeld.release();const finishedDeadline=Date.now()+15000;while((!oldTransportEnded||!oldResponseHandled)&&Date.now()<finishedDeadline)await new Promise(done=>setTimeout(done,25));assert.equal(oldTransportEnded,true,'Old request completed or failed');assert.equal(oldResponseHandled,true,'Old interceptor settled');await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.waitForFunction(()=>document.querySelector('[aria-labelledby="purchase-title"] [role="status"]')?.innerText.includes('Consultando'),{timeout:15000});assert.equal(await page.evaluate(()=>[...document.querySelectorAll('button')].find(row=>row.textContent.trim()==='Actualizar compras')?.disabled),true);await noPrivatePurchase(page);
   newHeld.release();await wait(page,'Pedido de la obra nueva');assert.equal((await page.evaluate(()=>document.body.innerText)).includes('Cemento privado de ensayo'),false);assert.equal(posts.length,mode==='late-post-context'?1:0);const rows=await references(page);assert.equal(rows.length,mode==='late-post-context'?1:0);if(rows.length)await retainedReference(page,posts[0]);
  }
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.join(output,`purchase-${mode}-${width}.png`),fullPage:true});checks.push(`purchase-${mode}-${width}`);scenarioResults.push({mode,width,posts:posts.length,applications,snapshotReads,recoveryReads,targetedReads,requestMethods:requests.map(row=>row.method),controlledForcedContext:mode.startsWith('late-'),oldTransportEnded:mode.startsWith('late-')?oldTransportEnded:null,oldResponseHandled:mode.startsWith('late-')?oldResponseHandled:null,oldTransportAborted:mode.startsWith('late-')?oldTransportFailed:null,physicalAcceptance:false});
 } catch(error){
   const snapshot=await page.evaluate(()=>({text:document.body.innerText,mounted:window.__purchaseFixtureMounted===true,buttons:[...document.querySelectorAll('button')].map(row=>({text:row.textContent.trim(),disabled:row.disabled})),forms:[...document.querySelectorAll('form')].map(form=>[...form.querySelectorAll('input,textarea,select')].map(row=>({value:row.value,disabled:row.disabled})))})).catch(()=>null);
   await page.screenshot({path:path.join(output,'purchase-scenario-failure-'+mode+'-'+width+'.png'),fullPage:true}).catch(()=>{});
   writeFileSync(path.join(output,'scenario-failure.json'),JSON.stringify({status:'FAILED',activeScenario:{mode,width},message:error.message,requests,snapshotReads,recoveryReads,targetedReads,postCount:posts.length,applications,currentRecord:record(),retainedSourceContract:'actual source publicOrder projection',snapshot,errors},null,2));throw error;
  } finally {oldHeld.release();newHeld.release();await ctx.close();activePage=null;}
}
try {
 let ready=false;for(let i=0;i<120;i++){if(server.exitCode!==null)throw new Error('Fixture exited');const response=await fetch(origin).catch(()=>null);if(response?.status>=500)throw new Error('Fixture compilation failed');if(response?.ok){ready=true;break;}await new Promise(done=>setTimeout(done,500));}assert.ok(ready);
 browser=await puppeteer.launch({headless:true,...(process.platform==='win32'?{channel:'chrome'}:{}),args:['--no-sandbox','--disable-setuid-sandbox']});
 if(!focusedScenario){for(const width of widths)await scenario(width);for(const mode of ['draft-cancel','uncertain','rollback','not-arrived','conflict','denied','session-before-send','session-after-unknown-retry'])await scenario(390,mode);}
 for(const width of selectedWidths)for(const mode of focusedScenario?[focusedScenario]:proposedModes)await recoveryScenario(width,mode);assert.deepEqual(errors,[]);
 const previousChecks=['purchase-approval-and-partial-receipts-320','purchase-approval-and-partial-receipts-390','purchase-approval-and-partial-receipts-768','purchase-approval-and-partial-receipts-1280','purchase-draft-locks-project-until-explicit-cancel','uncertain-save-recovery-without-second-post','rollback-checked-then-exact-retry-with-one-persisted-order','not-arrived-checked-then-exact-retry-with-one-persisted-order','conflict-preserves-entered-quote','denied-no-example-purchases','missing-session-before-first-post-preserves-draft-with-no-phantom-receipt','unsent-retry-keeps-the-previous-uncertain-operation-and-its-receipt-path','session-after-unknown-retry-checked-then-exact-retry-with-one-persisted-order'];
 if(!focusedScenario){for(const item of previousChecks)assert.equal(checks.filter(check=>check===item).length,1,'Retained baseline multiset '+item);assert.equal(checks.length,previousChecks.length+widths.length*proposedModes.length);}
 const proof={status:'PASS',checkedAt:new Date().toISOString(),environment:'real-component-controlled-api',widths:focusedScenario?selectedWidths:widths,fullSuite:!focusedScenario,focusedScenario,checks,errors,scenarioResults,sourceManifest,sourceContext,harnessSha256:sha256(readFileSync(new URL(import.meta.url))),baselineChecksRetained:!focusedScenario?previousChecks.length:null,providerCalls:0,metaMessagesSent:0,productionDataWritten:false,paymentRecorded:false,stockLedgerChanged:false,humanAcceptance:false};
 writeFileSync(path.join(output,'browser.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(e){const snapshot=activePage&&!activePage.isClosed()?await activePage.evaluate(()=>({text:document.body.innerText,buttons:[...document.querySelectorAll('button')].map(row=>({text:row.textContent.trim(),disabled:row.disabled}))})).catch(()=>null):null;writeFileSync(path.join(output,'browser-failure.json'),JSON.stringify({message:e.message,activeScenario,fullSuite:false,focusedScenario,widths:focusedScenario?selectedWidths:widths,errors,checks,sourceManifest,sourceContext,harnessSha256:sha256(readFileSync(new URL(import.meta.url))),snapshot,log},null,2));throw e;}
finally{await browser?.close();try{if(process.platform==='win32')server.kill();else process.kill(-server.pid,'SIGTERM');}catch{}await new Promise(done=>setTimeout(done,500));assert.equal(path.dirname(path.resolve(fixture)),path.resolve(root,'.vercel'));rmSync(fixture,{recursive:true,force:true});}
