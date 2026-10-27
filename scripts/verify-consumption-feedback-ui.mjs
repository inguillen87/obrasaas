import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {copyFileSync,existsSync,lstatSync,mkdirSync,mkdtempSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:net';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {parse} from '@babel/parser';
import puppeteer from 'puppeteer';
import {captureOwnedFixture,removeOwnedFixture} from './lib/owned-fixture-cleanup.mjs';

// Exact production JSX/CSS rendered by Next. API responses, authentication and
// money are synthetic; no real provider or financial request is authorized.
assert.ok(!process.env.VERCEL && !process.env.VERCEL_ENV,'Run only against the disposable localhost fixture');
const root = realpathSync(process.cwd()),privateRoot = path.join(root,'.vercel','private');
const git=args=>{const value=spawnSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true});assert.equal(value.status,0,value.stderr);return value.stdout.trim();};
const sourceRevision=git(['rev-parse','HEAD']),sourceTree=git(['rev-parse','HEAD^{tree}']),trackedClean=git(['status','--porcelain=v1','--untracked-files=no'])==='';
for (const filename of [root,path.join(root,'.vercel'),privateRoot]) {
  if (!existsSync(filename)) mkdirSync(filename);
  assert.ok(lstatSync(filename).isDirectory() && !lstatSync(filename).isSymbolicLink());
  assert.equal(realpathSync(filename),filename);
}
const output = path.join(privateRoot,'consumption-feedback-evidence');
mkdirSync(output,{recursive:true});
const runId = new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8);
const screenshots = path.join(output,'screenshots-'+runId);mkdirSync(screenshots);
const fixturePrefix = 'consumption-feedback-ui-',fixture = mkdtempSync(path.join(privateRoot,fixturePrefix));
const ownership = captureOwnedFixture({workspaceRoot:root,privateRoot,fixture,prefix:fixturePrefix});
const scopeA = 'a'.repeat(64),scopeB = 'b'.repeat(64),fixedNow = '2026-10-12T12:00:00.000Z';
const seenSources = new Set();
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
  const seen = seenSources;
  function copy(filename) {
    filename = realpathSync(filename);assert.ok(inside(filename,path.join(root,'src')));if (seen.has(filename)) return;seen.add(filename);
    const relative = path.relative(root,filename),bytes = readFileSync(filename),destination = path.join(fixture,relative);
    assert.ok(inside(destination,fixture));mkdirSync(path.dirname(destination),{recursive:true});copyFileSync(filename,destination);assert.deepEqual(readFileSync(destination),bytes);
    sourceManifest.push({path:relative.split(path.sep).join('/'),sha256:sha(bytes)});
    for (const specifier of importsOf(bytes,filename)) {
      if (!specifier.startsWith('.')) {assert.ok(['react','lucide-react','jsqr','next/navigation'].includes(specifier),'Unexpected browser dependency '+specifier);externalImports.add(specifier);continue;}
      const absolute = path.resolve(path.dirname(filename),specifier);
      const dependency = [absolute,absolute+'.js',absolute+'.mjs',absolute+'.css',path.join(absolute,'index.js')].find(candidate => existsSync(candidate) && lstatSync(candidate).isFile());
      assert.ok(dependency,'Missing dependency '+specifier);copy(dependency);
    }
  }
  copy(path.join(root,entry));sourceManifest.sort((a,b) => a.path.localeCompare(b.path));
}
async function bounded(promise,message,milliseconds = 15000) {let timer;try {return await Promise.race([promise,new Promise((_,reject) => {timer = setTimeout(() => reject(new Error(message)),milliseconds);})]);} finally {clearTimeout(timer);}}
async function freePort() {const server = createServer();await new Promise((resolve,reject) => {server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const port = server.address().port;await new Promise(resolve => server.close(resolve));return port;}


const revision='2026-10-12T10:00:00.000001',proposalReceipt='field_'+'c'.repeat(64),decisionReceipt='field_'+'d'.repeat(64),reversalReceipt='field_'+'e'.repeat(64),materialId='material-synthetic';
const changedRevision=n=>'2026-10-12T10:00:00.'+String(n).padStart(6,'0');
const decision=(receiptId=decisionReceipt)=>({decision:'APPROVE',actorId:'review-account-original',reason:'Revisión independiente de la cantidad informada. '+ 'Detalle de prueba '.repeat(45),recordedAt:'2026-10-12T13:00:00.000Z',receiptId,movementId:'inventory_move_'+sha(receiptId)});
function row(state='PENDING',index=1){return {id:'consumption-synthetic-'+index,revision:changedRevision(index),version:1,kind:'CONSUMPTION',state,materialId,materialName:'Material de prueba al informar',unit:'bolsa',quantity:'2.001',catalogHash:'b'.repeat(64),workerId:'worker-current',taskId:'task-synthetic',sectorId:'sector-synthetic',reason:'Informe de consumo comprobado para esta prueba.',submittedBy:'report-account-original',submittedAt:fixedNow,source:'participant-whatsapp',proposalReceiptId:proposalReceipt,decision:state==='APPROVED'||state==='REVERSED'?decision():state==='REJECTED'?{...decision(),decision:'REJECT'}:null,reversal:state==='REVERSED'?{actorId:'reverse-account-'+ 'x'.repeat(90),reason:'Devolución comprobada sin borrar la aprobación original. '+'Referencia de prueba '.repeat(35),recordedAt:'2026-10-12T16:00:00.000Z',receiptId:reversalReceipt,movementId:'inventory_move_'+sha(reversalReceipt)}:null};}
function snapshot(scope,rows,balance='7.500'){return {scope,projectId:'project-synthetic',projectRevision:revision,selfWorkers:[{id:'worker-current',name:'Ficha vigente de prueba',canReport:true}],workers:[{id:'worker-current',name:'Nombre vigente de ficha reasignada'}],sectors:[{id:'sector-synthetic',name:'Sector de prueba'}],inventory:{version:1,catalogVersion:1,catalogHash:'b'.repeat(64),catalogLimit:200,canManage:false,materials:[{id:materialId,name:'Nombre vigente del material',unit:'bolsa',active:true,balance}],consumptions:rows.map(c=>({...c,canDecide:false,canReverse:false})),consumptionsTruncated:false,nextConsumptionCursor:null,movements:[],nextMovementCursor:null,adjustments:[],nextAdjustmentCursor:null,priorReceipts:[],priorReceiptsTruncated:false}};}
async function click(page,text){await page.waitForFunction(value=>[...document.querySelectorAll('button')].some(node=>node.textContent.trim()===value&&!node.disabled),{timeout:15000},text);const handle=await page.evaluateHandle(value=>[...document.querySelectorAll('button')].find(node=>node.textContent.trim()===value&&!node.disabled),text);await handle.asElement().click();await handle.dispose();}
async function textOf(page,selector='body'){return page.$eval(selector,node=>node.innerText);}
async function waitText(page,text,selector='body'){await page.waitForFunction((value,selector)=>document.querySelector(selector)?.innerText.includes(value),{timeout:15000},text,selector);}
async function fill(page,label,value){const handle=await page.evaluateHandle(value=>[...document.querySelectorAll('label')].find(node=>[...node.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('').trim()===value)?.querySelector('input,select,textarea'),label);const el=handle.asElement();assert.ok(el,'Field '+label);if(await el.evaluate(node=>node.tagName==='SELECT'))await el.select(value);else{await el.click();await el.evaluate(node=>node.select());await page.keyboard.press('Backspace');await el.type(value);}await handle.dispose();}
async function refs(page,scope=scopeA){return page.evaluate(value=>window.__journal.list(value),scope);}
async function inventoryFormState(page){return page.evaluate(()=>{
 const inventory=document.querySelector('section[aria-labelledby="inventory-title"]'),privateForms=inventory?[...inventory.querySelectorAll(':scope > form')]:[],isPrivateField=field=>privateForms.some(form=>form.contains(field));
 const fieldInfo=field=>({tag:field.tagName,type:field.type,value:field.value,disabled:field.disabled===true,autocomplete:field.getAttribute('autocomplete'),owner:field.closest('section[aria-labelledby]')?.getAttribute('aria-labelledby')||null,label:field.closest('label')?.textContent.trim()||null});
 return {inventoryRootFound:Boolean(inventory),forms:privateForms.length,fields:privateForms.flatMap(form=>[...form.querySelectorAll('input,select,textarea')].map(field=>field.value)),otherForms:[...document.querySelectorAll('form')].filter(form=>!privateForms.includes(form)).map(form=>({owner:form.closest('section[aria-labelledby]')?.getAttribute('aria-labelledby')||null,parentTag:form.parentElement.tagName,summary:form.parentElement.querySelector(':scope > summary')?.textContent.trim()||null,fields:[...form.querySelectorAll('input,select,textarea')].map(fieldInfo),buttons:[...form.querySelectorAll('button')].map(button=>({type:button.type,text:button.textContent.trim(),disabled:button.disabled===true}))})),otherFields:[...document.querySelectorAll('input,select,textarea')].filter(field=>!isPrivateField(field)).map(fieldInfo)};
 });}
function assertPublicExecutionLookup(view){
 const field={tag:'INPUT',type:'text',value:'',disabled:true,autocomplete:'off',owner:'execution-title',label:'Referencia de la operación'};
 assert.equal(view.inventoryRootFound,true);
 assert.deepEqual(view.otherForms,[{owner:'execution-title',parentTag:'DETAILS',summary:'Buscar un comprobante',fields:[field],buttons:[{type:'submit',text:'Buscar comprobante',disabled:true}]}]);
 assert.deepEqual(view.otherFields,[field]);
}
async function makePage(label,{width=390,mode='timeline'}={}){
 const context=await browser.createBrowserContext(),page=await context.newPage(),requests=[];let currentMode=mode,rows=mode==='timeline'?['PENDING','APPROVED','REJECTED','REVERSED'].map((s,i)=>row(s,i+1)):mode==='legacy'?[{...row('REVERSED'),submittedAt:'2026-02-31T12:00:00.000Z',proposalReceiptId:null,decision:{actorId:null,actorName:'not-a-trusted-name',recordedAt:'invalid',receiptId:'invented',reason:'Motivo histórico conservado.'},reversal:null}]:[],saved=null,balance='7.500';
 await page.setViewport({width,height:1050,deviceScaleFactor:1});page.on('pageerror',error=>pageErrors.push({label,message:error.message}));
 await page.evaluateOnNewDocument(()=>{const json=Response.prototype.json;Response.prototype.json=async function(...args){const value=await json.apply(this,args);if(window.__holdBody&&this.url.includes('/api/identity/field-operations')){window.__holdBody=false;window.__bodyHeld=true;return new Promise(resolve=>{window.__releaseBody=()=>resolve(value);});}return value;};});
 await page.setRequestInterception(true);page.on('request',async request=>{try{
  const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();externalRequests.push({label,url:request.url()});await request.abort();return;}if(!url.pathname.startsWith('/api/'))return request.continue();assert.equal(url.pathname,'/api/identity/field-operations');assert.equal(request.headers().authorization,'Bearer synthetic-consumption-session');
  const command=request.method()==='POST'?JSON.parse(request.postData()):null,scope=command?.scope||url.searchParams.get('scope');assert.ok([scopeA,scopeB].includes(scope));requests.push({method:request.method(),scope,operationId:command?.operationId||url.searchParams.get('operationId'),action:command?.action});
  let value,status=200;
  if(command){assert.equal(command.action,'PROPOSE_CONSUMPTION');assert.equal(command.projectId,'project-synthetic');assert.deepEqual(Object.keys(command.payload).sort(),['catalogHash','evidenceIds','materialId','quantity','reason','sectorId','taskId','workerId']);assert.deepEqual(command.payload.evidenceIds,[]);const history=await refs(page,scope);assert.ok(history.some(ref=>ref.operationId===command.operationId),'Reference must commit before POST');
   if(currentMode==='unknown'){status=503;value={code:'INVENTORY_WRITE_UNCONFIRMED'};}
   else{const created={...row(),quantity:command.payload.quantity.padEnd(command.payload.quantity.includes('.')?command.payload.quantity.indexOf('.')+4:command.payload.quantity.length,'0'),reason:command.payload.reason,proposalReceiptId:'field_'+sha(command.operationId)},original=structuredClone(created);rows=[{...created,state:'APPROVED',revision:changedRevision(20),decision:decision()}];balance='5.499';saved={scope,projectId:'project-synthetic',operationId:command.operationId,action:command.action,state:'RECORDED',saved:true,replayed:false,receiptId:created.proposalReceiptId,kind:'CONSUMPTION_PROPOSAL',stockChanged:false,consumption:rows[0],recordedConsumptionSnapshot:original};if(currentMode==='lost'){await request.abort('failed');return;}value=saved;}
  }else if(currentMode==='deny'){status=403;value={code:'WORKSPACE_PROJECT_UNAVAILABLE'};}
  else if(url.searchParams.has('operationId'))value=saved||{scope,projectId:'project-synthetic',operationId:url.searchParams.get('operationId'),state:'NOT_OBSERVED',definitive:false};
  else value=snapshot(scope,scope===scopeB?[]:rows,balance);
  await request.respond({status,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(value)});
 }catch(error){interceptErrors.push({label,message:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}});
 await page.goto(origin,{waitUntil:'domcontentloaded',timeout:60000});await page.waitForFunction(()=>Boolean(window.__journal));return {page,context,requests,setMode:value=>{currentMode=value;},getRows:()=>structuredClone(rows)};
}
async function openAllReferences(page){await page.$$eval('[data-consumption-traceability] details,[aria-label="Contexto del consumo"] details',nodes=>nodes.forEach(node=>{node.open=true;}));}
async function propose(state){await click(state.page,'Abrir inventario');await click(state.page,'Proponer consumo');await fill(state.page,'Sector','sector-synthetic');await fill(state.page,'Material del catálogo',materialId);await fill(state.page,'Cantidad utilizada','2.001');await fill(state.page,'Tarea (opcional)','task-synthetic');await fill(state.page,'Motivo o detalle','Cantidad comprobada para el caso sintético.');await click(state.page,'Confirmar operación');}
async function viewportScenario(width){const state=await makePage('timeline-'+width,{width});try{await click(state.page,'Abrir inventario');await waitText(state.page,'Consumos informados');await openAllReferences(state.page);const result=await state.page.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,targets:[...document.querySelectorAll('button,summary,input,select,textarea')].filter(n=>n.getClientRects().length).map(n=>({tag:n.tagName,height:n.getBoundingClientRect().height,width:n.getBoundingClientRect().width})),cards:[...document.querySelectorAll('[data-consumption-traceability]')].map(n=>({text:n.innerText,dates:[...n.querySelectorAll('time')].map(t=>t.dateTime)}))}));assert.equal(result.width,width);assert.ok(result.documentWidth<=width);assert.ok(result.targets.every(t=>t.height>=44&&t.width>=44));assert.equal(result.cards.length,4);assert.deepEqual(result.cards[3].dates,['2026-10-12T13:00:00.000Z','2026-10-12T16:00:00.000Z']);assert.ok(result.cards[3].text.includes(decisionReceipt)&&result.cards[3].text.includes(reversalReceipt)&&result.cards[3].text.includes(proposalReceipt));const context=await textOf(state.page,'[aria-label="Contexto del consumo"]');assert.ok(context.includes('Ficha vinculada: Nombre vigente de ficha reasignada'));assert.ok(context.includes('Cuenta que informó.'));assert.ok(!context.includes('Informó: Nombre vigente'));assert.ok(context.includes('report-account-original'));assert.ok(!(await textOf(state.page)).includes('Invalid Date'));assert.equal(state.requests.filter(r=>r.method==='POST').length,0);await state.page.screenshot({path:path.join(screenshots,width+'-timeline.png'),fullPage:true});checks.push({check:'true-consumption-history-progressive-references-long-content',width,...result});}finally{await state.context.close();}}
async function legacyScenario(){const state=await makePage('legacy',{mode:'legacy'});try{await click(state.page,'Abrir inventario');await waitText(state.page,'Consumo revertido');await openAllReferences(state.page);const text=await textOf(state.page);assert.ok(text.includes('Fecha y hora no disponibles'));assert.ok(text.includes('Revisión por comprobar')&&text.includes('Reversión por comprobar'));assert.ok(text.includes('Referencia no disponible'));assert.ok(!text.includes('not-a-trusted-name')&&!text.includes('invented')&&!text.includes('Invalid Date'));assert.equal(await state.page.$$eval('[data-consumption-traceability] time',nodes=>nodes.length),0);assert.equal(state.requests.filter(r=>r.method==='POST').length,0);checks.push({check:'legacy-missing-date-name-receipt-never-fabricated'});}finally{await state.context.close();}}
async function lostScenario(reload=false){const state=await makePage('lost-'+reload,{mode:'lost'});try{await propose(state);await waitText(state.page,'El resultado quedó sin confirmar');const before=await refs(state.page);assert.equal(before.length,1);const uuid=before[0].operationId;assert.equal(state.requests.filter(r=>r.method==='POST').length,1);
 if(reload){await state.page.reload({waitUntil:'domcontentloaded'});await waitText(state.page,'Operaciones por comprobar');await click(state.page,'Comprobar recibo');await waitText(state.page,'Guardado confirmado');await click(state.page,'Abrir inventario');}
 else{await click(state.page,'Comprobar inventario guardado');await waitText(state.page,'Propuesta de consumo registrada','[data-inventory-receipt]');const receipt=await textOf(state.page,'[data-inventory-receipt]');assert.ok(receipt.includes('creación de la propuesta')&&receipt.includes('Estado en ese recibo: Por revisar'));assert.ok(!receipt.includes('Estado en ese recibo: Consumo aprobado'));}
 await waitText(state.page,'Consumo aprobado');await state.page.waitForFunction(async()=>!(await window.__journal.list('a'.repeat(64))).length);await openAllReferences(state.page);assert.equal(state.requests.filter(r=>r.method==='POST').length,1);assert.ok(state.requests.filter(r=>r.operationId&&r.method==='GET').every(r=>r.operationId===uuid));assert.equal(state.getRows()[0].state,'APPROVED');checks.push({check:reload?'reload-same-receipt-no-repeat-post':'original-proposal-receipt-separated-from-current-approved-stock',operationId:uuid});}finally{await state.context.close();}}
async function unknownScenario(denial=false){const state=await makePage('unknown-'+denial,{mode:'unknown'});try{await propose(state);await waitText(state.page,'El resultado quedó sin confirmar');const uuid=(await refs(state.page))[0].operationId;await state.page.evaluate(()=>{window.__failNextToken=true;});await click(state.page,'Comprobar inventario guardado');await waitText(state.page,'No se pudo renovar tu sesión');assert.equal((await refs(state.page))[0].operationId,uuid);await click(state.page,'Comprobar inventario guardado');await waitText(state.page,'No se observa un recibo todavía');assert.equal((await refs(state.page))[0].operationId,uuid);
 if(denial){state.setMode('deny');await click(state.page,'Comprobar inventario guardado');await waitText(state.page,'La obra no está disponible');const denied=await inventoryFormState(state.page);assert.equal(denied.forms,0);assert.deepEqual(denied.fields,[]);assertPublicExecutionLookup(denied);assert.equal(await state.page.$$eval('[data-consumption-traceability]',nodes=>nodes.length),0);await click(state.page,'Cerrar consulta y conservar referencia');assert.equal((await refs(state.page))[0].operationId,uuid);}
 assert.equal(state.requests.filter(r=>r.method==='POST').length,1);checks.push({check:denial?'denied-private-state-clears-but-unknown-reference-survives':'unknown-read-and-token-failure-keep-exact-original-attempt',operationId:uuid});}finally{await state.context.close();}}
async function loadedDenialScenario(withDraft=false){
 const state=await makePage('loaded-denial-'+withDraft),privateDraft='Borrador privado previo a la denegación.';
 try{
  await click(state.page,'Abrir inventario');await waitText(state.page,'Consumos informados');await openAllReferences(state.page);
  const beforeText=await textOf(state.page),privateValues=[...state.getRows().map(value=>value.id),'Material de prueba al informar','Nombre vigente de ficha reasignada','report-account-original','review-account-original',row('REVERSED').reversal.actorId,proposalReceipt,decisionReceipt,reversalReceipt,row().reason,decision().reason.trim(),row('REVERSED').reversal.reason.trim()];
  assert.equal(await state.page.$$eval('[data-consumption-traceability]',nodes=>nodes.length),4);
  for(const value of privateValues)assert.ok(beforeText.includes(value),'History value must exist before denial: '+value);
  if(withDraft){
   await click(state.page,'Proponer consumo');await fill(state.page,'Sector','sector-synthetic');await fill(state.page,'Material del catálogo',materialId);await fill(state.page,'Cantidad utilizada','1.111');await fill(state.page,'Tarea (opcional)','task-synthetic');await fill(state.page,'Motivo o detalle',privateDraft);
   const editing=await inventoryFormState(state.page);assert.equal(editing.forms,1);assertPublicExecutionLookup(editing);
   assert.ok(editing.fields.includes(privateDraft));
  }
  const beforeRequests=state.requests.length;state.setMode('deny');await click(state.page,withDraft?'Consultar inventario vigente':'Actualizar inventario');await waitText(state.page,'La obra no está disponible');
  assert.deepEqual(state.requests.slice(beforeRequests),[{method:'GET',scope:scopeA,operationId:null,action:undefined}]);
  const after={...await state.page.evaluate(()=>({cards:document.querySelectorAll('[data-consumption-traceability]').length,receipts:document.querySelectorAll('[data-inventory-receipt]').length,text:document.body.innerText})),...await inventoryFormState(state.page)};
  assert.equal(after.cards,0);assert.equal(after.receipts,0);assert.equal(after.forms,0);assert.deepEqual(after.fields,[]);assertPublicExecutionLookup(after);
  for(const value of [...privateValues,privateDraft])assert.ok(!after.text.includes(value),'Revoked value must disappear: '+value);
  assert.equal(state.requests.filter(request=>request.method==='POST').length,0);assert.deepEqual(await refs(state.page),[]);
  checks.push({check:withDraft?'loaded-history-and-private-draft-cleared-on-refresh-denial':'loaded-four-card-history-cleared-on-refresh-denial',beforeCards:4,afterCards:after.cards,afterReceipts:after.receipts,afterForms:after.forms,formScope:'direct-material-inventory-business-form',publicLookupForms:after.otherForms,publicLookupFields:after.otherFields,postCount:0});
 }finally{await state.context.close();}
}
async function lateScopeScenario(){const state=await makePage('late-scope');try{await state.page.evaluate(()=>{window.__holdBody=true;});await click(state.page,'Abrir inventario');await state.page.waitForFunction(()=>window.__bodyHeld===true);await state.page.evaluate(()=>window.__changeScope());await state.page.waitForFunction(()=>window.__effectScope==='b'.repeat(64));await state.page.evaluate(()=>window.__releaseBody());await wait(100);assert.ok(!(await textOf(state.page)).includes('Material de prueba al informar'));assert.equal(await state.page.$$eval('[data-consumption-traceability]',nodes=>nodes.length),0);assert.equal(state.requests.filter(r=>r.method==='POST').length,0);checks.push({check:'late-foreign-company-consumption-response-never-renders'});}finally{await state.context.close();}}
try{
 for(const entry of ['material-inventory-panel.js','workspace-recovery-panel.js'])copyClosure('src/app/(identity)/cuenta/'+entry);
 const app=path.join(fixture,'src/app');writeFileSync(path.join(fixture,'package.json'),JSON.stringify({name:'isolated-consumption-feedback-ui',private:true}));writeFileSync(path.join(fixture,'next.config.mjs'),`export default {devIndicators:false,turbopack:{root:${JSON.stringify(root)}}};\n`);writeFileSync(path.join(app,'layout.js'),`export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:12,background:'#eef3f9',fontFamily:'Arial,sans-serif'}}>{children}</body></html>}`);
 writeFileSync(path.join(app,'page.js'),"'use client';import {useCallback,useEffect,useState} from 'react';import {MaterialInventoryPanel} from './(identity)/cuenta/material-inventory-panel';import {WorkspaceRecoveryPanel} from './(identity)/cuenta/workspace-recovery-panel';import {browserRecoveryJournal} from './(identity)/cuenta/workspace-recovery-journal.mjs';export default function Page(){const [scope,setScope]=useState('"+scopeA+"'),[pending,setPending]=useState(false);const token=useCallback(async()=>{if(window.__failNextToken){window.__failNextToken=false;throw new Error('synthetic unavailable token');}return 'synthetic-consumption-session';},[]),changed=useCallback(setPending,[]);useEffect(()=>{window.__journal=browserRecoveryJournal;window.__changeScope=()=>setScope('"+scopeB+"');window.__effectScope=scope;},[scope]);return <main data-fixture=\"CONSUMPTION_FEEDBACK_FIXTURE\" style={{maxWidth:1080,margin:'auto',minWidth:0}}><button disabled={pending} style={{minHeight:44}} onClick={()=>setScope('"+scopeB+"')}>Cambiar empresa de prueba</button><WorkspaceRecoveryPanel key={'recovery:'+scope} scope={scope} projects={[{id:'project-synthetic',name:'Obra de prueba'}]} getSessionToken={token}/><MaterialInventoryPanel scope={scope} projectId=\"project-synthetic\" tasks={[{id:'task-synthetic',title:'Tarea vigente de prueba'}]} getSessionToken={token} onPending={changed}/></main>;}");
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

 const response=await fetch(origin,{signal:AbortSignal.timeout(60000)});assert.ok(response.ok&&(await response.text()).includes('CONSUMPTION_FEEDBACK_FIXTURE'));
 const runnerArgs=process.env.GITHUB_ACTIONS==='true'&&process.platform==='linux'?['--no-sandbox','--disable-setuid-sandbox']:[];
 browser=await puppeteer.launch({headless:true,args:[...runnerArgs,'--disable-background-networking','--disable-component-update','--disable-domain-reliability','--disable-sync','--metrics-recording-only','--no-first-run','--disable-features=MediaRouter']});
 for(const width of [320,390,768,1280])await viewportScenario(width);await legacyScenario();await lostScenario();await lostScenario(true);await unknownScenario();await unknownScenario(true);await loadedDenialScenario();await loadedDenialScenario(true);await lateScopeScenario();
 assert.deepEqual(pageErrors,[]);assert.deepEqual(interceptErrors,[]);assert.deepEqual(externalRequests,[]);for(const ref of sourceManifest)assert.equal(sha(readFileSync(path.join(root,ref.path))),ref.sha256,'Dependency changed while rendering');assert.equal(git(['rev-parse','HEAD']),sourceRevision,'Source HEAD changed while rendering');
}catch(error){failure=error;}
finally{
 try{if(browser)await bounded(browser.close(),'Owned browser close timed out');browserClosed=true;}catch(error){failure ||=error;}
 try{
  if(!child)serverClosed=true;
  else{if(child.exitCode===null&&child.signalCode===null&&child.connected)child.send({type:'close',nonce:child.__closeNonce});await bounded(childClose,'Owned fixture close timed out');serverClosed=closeAck&&child.exitCode===0;assert.ok(serverClosed,'Owned server close acknowledgment required');}
 }catch(error){failure ||=error;}
 try{fixtureCleanupProof=await removeOwnedFixture(ownership,{serverClosedBeforeFixtureRemoval:serverClosed});assert.ok(fixtureCleanupProof.fixtureRemoved);}catch(error){failure ||=error;fixtureCleanupProof=error.cleanupProof;}
}
const target=process.argv[2]?path.resolve(process.argv[2]):path.join(output,'browser-'+runId+'.json');
assert.ok(inside(target,output),'Evidence must stay within consumption-feedback-evidence');
const proof={status:failure?'FAILED':'PASS',recordedAt:new Date().toISOString(),runId,sourceRevision,sourceTree,sourceState:trackedClean?'clean':'working-tree',trackedClean,environment:'isolated-localhost-next-exact-jsx-synthetic-api',widths:[320,390,768,1280],checks,sourceManifest,externalImports:[...externalImports].sort(),harnessSha256,cleanupHelperSha256,pageErrors,interceptErrors,externalRequests,cleanup:{browserClosed,serverClosed,gracefulCloseAcknowledged:closeAck,fixtureRemoved:fixtureCleanupProof?.fixtureRemoved===true,fixtureCleanupProof},productionLoginVerified:false,productionDataWritten:false,providerRequests:0,physicalDeviceAccepted:false,...(failure?{failure:failure.message,serverLog}:{})};
writeFileSync(target,JSON.stringify(proof,null,2),{flag:'wx'});console.log(JSON.stringify({status:proof.status,evidence:path.relative(root,target).split(path.sep).join('/'),checks:checks.length,widths:proof.widths,cleanup:proof.cleanup}));if(failure)throw failure;
