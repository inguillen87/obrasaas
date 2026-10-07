import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,copyFileSync,writeFileSync,rmSync,readFileSync,existsSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {spawn,spawnSync,execFileSync} from 'node:child_process';
import {planImportCommandDigest} from '../src/app/(identity)/cuenta/workspace-recovery-journal.mjs';
import puppeteer from 'puppeteer';
assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV);
const root=process.cwd(),scratch=path.join(root,'.vercel/private');mkdirSync(scratch,{recursive:true});
const fixture=mkdtempSync(path.join(scratch,'plan-ui-')),app=path.join(fixture,'app');mkdirSync(app);
const copiedFiles=['plan-import-panel.js','plan-import-panel.module.css','workspace-session-request.mjs','workspace-request-lifecycle.js','workspace-request-lifecycle.mjs','workspace-recovery-journal.mjs','private-bank-account-format.mjs','site-purchase-view.mjs','company-channel-view.mjs','workspace-recovery-storage.mjs','workspace-recovery-panel.js','workspace.module.css','template-send-view.mjs'];
const hashFile=file=>createHash('sha256').update(readFileSync(file)).digest('hex'),trackedClean=execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim()==='';
if(process.env.CI==='true')assert.equal(trackedClean,true);
const sourceProof={sourceRevision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceTree:execFileSync('git',['rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim(),sourceState:process.env.CI==='true'?'EXACT_CI_SOURCE':'LOCAL_REVIEW_SOURCE',trackedClean,harnessSha256:hashFile('scripts/verify-plan-import-ui.mjs'),sourceManifest:copiedFiles.slice(0,10).map(name=>({path:'src/app/(identity)/cuenta/'+name,sha256:hashFile(path.join(root,'src/app/(identity)/cuenta',name))})).sort((a,b)=>a.path.localeCompare(b.path)),decisionSourceManifest:copiedFiles.slice(10).map(name=>({path:'src/app/(identity)/cuenta/'+name,sha256:hashFile(path.join(root,'src/app/(identity)/cuenta',name))})).sort((a,b)=>a.path.localeCompare(b.path))};
for(const name of copiedFiles)copyFileSync(path.join(root,'src/app/(identity)/cuenta',name),path.join(app,name));
writeFileSync(path.join(fixture,'package.json'),JSON.stringify({private:true}));writeFileSync(path.join(fixture,'next.config.mjs'),`export default {devIndicators:false,turbopack:{root:${JSON.stringify(root)}}};`);
writeFileSync(path.join(app,'layout.js'),`export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:12,fontFamily:'Arial'}}>{children}</body></html>}`);
const scope='a'.repeat(64),projectId='project-fixture';
writeFileSync(path.join(app,'page.js'),`'use client';import {useState} from 'react';import {PlanImportPanel} from './plan-import-panel';import {WorkspaceRecoveryPanel} from './workspace-recovery-panel';const projects=[{id:'${projectId}',name:'Obra sintética'}];export default function Page(){const [tasks,setTasks]=useState([]);return <main style={{maxWidth:1000,margin:'auto'}}><PlanImportPanel projectId="${projectId}" scope="${scope}" getSessionToken={async()=> 'synthetic-plan-token'} onApplied={setTasks}/><WorkspaceRecoveryPanel scope="${scope}" projects={projects} getSessionToken={async()=> 'synthetic-plan-token'}/><p data-task-count>Tareas canónicas recibidas: {tasks.length}</p></main>}`);
const sourceFile=path.join(fixture,'synthetic-schedule.pdf');writeFileSync(sourceFile,'%PDF-1.7\nSynthetic Gantt fixture\n%%EOF');
const correctedSourceFile=path.join(fixture,'corrected-schedule.pdf');writeFileSync(correctedSourceFile,'%PDF-1.7\nSynthetic corrected Gantt fixture\n%%EOF');
const port=3138,origin='http://127.0.0.1:'+port,server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',fixture,'--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'],windowsHide:true,detached:process.platform!=='win32'});
// Next's SIGTERM handler waits for its child and writes final dev state. The
// close event also waits for inherited stdout/stderr; kill() alone is no fence.
const serverClosed=new Promise(resolve=>server.once('close',resolve));
async function stopHarnessServer(){
 let deadline;
 try{
  assert.ok(Number.isSafeInteger(server.pid)&&server.pid>0,'Only this owned Next tree may be stopped');
  if(process.platform==='win32'){
   if(server.exitCode===null&&server.signalCode===null){
    const stopped=spawnSync('taskkill.exe',['/PID',String(server.pid),'/T','/F'],{stdio:'ignore',windowsHide:true,timeout:10000});
    assert.equal(stopped.status,0,'The owned Next tree must stop before fixture removal');
   }
  }else{
   try{process.kill(-server.pid,'SIGTERM');}catch(error){if(error.code!=='ESRCH')throw error;}
  }
  await Promise.race([serverClosed,new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('PLAN_IMPORT_UI_SERVER_CLOSE_TIMEOUT')),10000);})]);
  if(process.platform!=='win32'){
   // A closed Next parent can leave a worker flushing .next files. Fence the
   // same owned process group, including those workers, before deleting it.
   try{process.kill(-server.pid,'SIGKILL');}catch(error){if(error.code!=='ESRCH')throw error;}
   const until=Date.now()+10000;
   for(;;){
    try{process.kill(-server.pid,0);}catch(error){if(error.code==='ESRCH')break;throw error;}
    assert.ok(Date.now()<until,'The owned Next process group must disappear before fixture removal');
    await new Promise(resolve=>setTimeout(resolve,50));
   }
  }
 }finally{clearTimeout(deadline);}
}
let log='',browser,proof,fixtureRemoved=false;for(const stream of [server.stdout,server.stderr])stream.on('data',data=>{log=(log+data).slice(-12000);});
const checks=[],errors=[],decisionRejectionChecks=[],uploadRejectionChecks=[];const widths=[320,390,768,1280],modes=['apply','ambiguous','recover','manager'];
const row={title:'Fundaciones sintéticas',startsOn:'2026-10-08',endsOn:'2026-10-10',evidence:'Fila 1 del archivo',uncertainty:''};
async function click(page,text){await page.waitForFunction(label=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===label&&!b.disabled),{},text);const button=await page.evaluateHandle(label=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===label),text);await button.asElement().click();await button.dispose();}
const wait=(page,text)=>page.waitForFunction(label=>document.body.innerText.includes(label),{},text);
const browserReferences=page=>page.evaluate(()=>new Promise((resolve,reject)=>{const request=indexedDB.open('obrasaas-pending-receipts-v1');request.onerror=()=>reject(Error('Cannot inspect recovery references'));request.onsuccess=()=>{const database=request.result,transaction=database.transaction('references','readonly'),read=transaction.objectStore('references').getAll();read.onsuccess=()=>resolve(read.result.map(row=>JSON.parse(row.value)));read.onerror=()=>reject(Error('Cannot read recovery references'));transaction.oncomplete=()=>database.close();};}));
try {
 for(let attempt=0;attempt<90;attempt++){try{if((await fetch(origin)).ok)break;}catch{}if(server.exitCode!==null)throw Error(log);await new Promise(resolve=>setTimeout(resolve,500));if(attempt===89)throw Error(log);}
 browser=await puppeteer.launch({headless:true,args:['--no-sandbox']});
 for(const width of widths)for(const mode of modes){
  const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1000});page.on('pageerror',error=>errors.push(error.message));await page.setRequestInterception(true);
  let draft=null,receipt=null;const posts=[],recoveries=[];
  let releaseInitialRead,signalInitialRead,initialReadHeld=true;
  const initialReadBarrier=new Promise(resolve=>{releaseInitialRead=resolve;});
  const initialReadObserved=new Promise(resolve=>{signalInitialRead=resolve;});
  const snapshot=()=>({scope,projectId,canApprove:mode!=='manager',drafts:draft?[draft]:[],truncated:false});
  const send=(request,data,status=200)=>request.respond({status,contentType:'application/json',headers:{'Cache-Control':'private, no-store'},body:JSON.stringify(data)});
  page.on('request',async request=>{try{
   const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();throw Error('Unexpected external request');}if(url.pathname!=='/api/identity/plan-import')return request.continue();
   assert.equal(request.headers().authorization,'Bearer synthetic-plan-token');
   if(request.method()==='POST') {
    if(request.headers()['content-type'].startsWith('multipart/form-data;')) {
     const multipart=request.postData()||await request.fetchPostData();assert.match(multipart,/plan-document-openai-v1/);assert.match(multipart,/synthetic-schedule\.pdf/);posts.push({action:'UPLOAD'});
     draft={id:'plan-fixture',revision:3,status:'READY',existingTaskCount:0,source:{contentType:'application/pdf',bytes:39,sha256:'b'.repeat(64)},sourceAvailable:true,rows:mode==='ambiguous'?[{...row,startsOn:null,endsOn:null,uncertainty:'Año ausente; revisar con la fuente'}]:[row],warnings:[],failure:null,createdAt:'2026-10-06T00:00:00Z',updatedAt:'2026-10-06T00:00:00Z',decision:null};return send(request,{scope,projectId,saved:true,replayed:false,draft});
    }
    const body=JSON.parse(request.postData());posts.push(body);assert.equal(body.projectId,projectId);assert.equal(body.scope,scope);assert.equal(body.expectedRevision,draft.revision);assert.equal(body.draftId,draft.id);assert.equal(body.action,'APPLY');assert.equal(body.rows.length,1);assert.equal(body.rows[0].title,'Fundaciones corregidas');
    draft={...draft,revision:4,status:'APPLIED',rows:body.rows};receipt={scope,projectId,saved:true,replayed:false,action:'APPLY',receiptId:'receipt-fixture',draft,tasks:[{id:'task-fixture',title:body.rows[0].title,status:'BACKLOG',progress:0,startsOn:body.rows[0].startsOn,endsOn:body.rows[0].endsOn,revision:'2026-10-06T00:00:00.000001'}]};
    if(mode==='recover')return send(request,{saved:false,code:'PLAN_IMPORT_UNCONFIRMED'},503);return send(request,receipt);
   }
   if(url.searchParams.has('operationId')){recoveries.push(url.searchParams.get('operationId'));return send(request,{state:'RECORDED',...receipt});}
   if(url.searchParams.has('draftId'))return send(request,{scope,projectId,draft});
   if(initialReadHeld){signalInitialRead();await initialReadBarrier;initialReadHeld=false;}
   return send(request,snapshot());
  }catch(error){errors.push(error.message);if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}});
  await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await click(page,'Importar PDF o imagen');await wait(page,'Autorizo enviar este cronograma a OpenAI');
  let initialReadTimeout;try{await Promise.race([initialReadObserved,new Promise((_,reject)=>{initialReadTimeout=setTimeout(()=>reject(Error('Initial plan snapshot was not requested')),20000);})]);}finally{clearTimeout(initialReadTimeout);}
  await page.waitForFunction(()=>document.querySelector('input[type=file]')?.disabled&&[...document.querySelectorAll('button')].some(button=>button.textContent==='Procesando…'&&button.disabled));
  assert.equal(posts.length,0);assert.equal(await page.$eval('input[type=checkbox]',element=>element.disabled),true);
  releaseInitialRead();
  await page.waitForFunction(()=>document.querySelector('input[type=file]')?.disabled===false&&[...document.querySelectorAll('button')].some(button=>button.textContent==='Extraer borrador'&&button.disabled));
  const file=await page.$('input[type=file]');await file.uploadFile(sourceFile);
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent==='Extraer borrador')?.disabled),true);
  assert.equal(await page.$eval('input[type=checkbox]',element=>element.checked),false);
  await page.click('input[type=checkbox]');await click(page,'Extraer borrador');await wait(page,'Compará cada fila con el archivo');assert.equal(posts.length,1);assert.equal(await page.$eval('[data-task-count]',e=>e.textContent),'Tareas canónicas recibidas: 0');
  const title=await page.$('fieldset input:not([type])');await title.focus();await page.keyboard.down('Control');await page.keyboard.press('KeyA');await page.keyboard.up('Control');await page.keyboard.press('Backspace');await title.type('Fundaciones corregidas');await page.type('textarea','Revisado con fuente sintética');
  if(mode==='manager'){assert.equal(await page.evaluate(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.startsWith('Aplicar '))),false);await wait(page,'Un administrador o director debe aprobar');}
  else if(mode==='ambiguous') {
   assert.equal(await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Aplicar 1 tareas').disabled),true);
   await page.$$eval('input[type=date]',inputs=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;for(const [index,input] of inputs.entries()){setter.call(input,index?'2026-10-10':'2026-10-08');input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}});await click(page,'Confirmé esta fila con la fuente');
   assert.equal(await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Aplicar 1 tareas').disabled),true);
   const boxes=await page.$$('input[type=checkbox]');await boxes.at(-1).click();await click(page,'Aplicar 1 tareas');await wait(page,'1 tareas aplicadas con recibo');assert.equal(posts.length,2);
  }else {
   if(mode==='apply'&&[320,1280].includes(width))await page.screenshot({path:path.join(scratch,`plan-import-ui-${width}.png`),fullPage:true});
   const boxes=await page.$$('input[type=checkbox]');await boxes.at(-1).click();await click(page,'Aplicar 1 tareas');
   if(mode==='recover'){await wait(page,'Intento pendiente de comprobación');await click(page,'Comprobar resultado');await wait(page,'1 tareas aplicadas con recibo');assert.equal(recoveries.length,1);}else await wait(page,'1 tareas aplicadas con recibo');assert.equal(posts.length,2);
  }
  if(mode!=='manager')assert.equal(await page.$eval('[data-task-count]',e=>e.textContent),'Tareas canónicas recibidas: 1');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow '+width+' '+mode);
  const stored=await page.evaluate(()=>JSON.stringify([Object.values(localStorage),Object.values(sessionStorage)]));assert.doesNotMatch(stored,/Fundaciones|data:application|Synthetic Gantt fixture|synthetic-plan-token|startsOn/);
  checks.push({width,mode,posts:posts.length,recoveryReads:recoveries.length,initialSnapshotBarrier:true,uploadsBeforeSnapshotReady:0});await context.close();
 }
 for(const width of widths)for(const mode of ['decision-rejected','decision-rejected-reload','decision-unconfirmed']){
  const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1000});page.on('pageerror',error=>errors.push(error.message));await page.setRequestInterception(true);
  let draft=null,rejection=null,receipt=null;const posts=[],recoveries=[];
  const send=(request,data,status=200)=>request.respond({status,contentType:'application/json',headers:{'Cache-Control':'private, no-store'},body:JSON.stringify(data)});
  page.on('request',async request=>{try{
   const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();throw Error('Unexpected external request');}if(url.pathname!=='/api/identity/plan-import')return request.continue();assert.equal(request.headers().authorization,'Bearer synthetic-plan-token');
   if(request.method()==='POST'){
    if(request.headers()['content-type'].startsWith('multipart/form-data;')){posts.push({action:'UPLOAD'});draft={id:'plan-fixture',revision:3,status:'READY',existingTaskCount:0,source:{contentType:'application/pdf',bytes:39,sha256:'b'.repeat(64)},sourceAvailable:true,rows:[row,{...row,title:'Estructura sintética'}],warnings:[],failure:null,createdAt:'2026-10-06T00:00:00Z',updatedAt:'2026-10-06T00:00:00Z',decision:null};return send(request,{scope,projectId,saved:true,replayed:false,draft});}
    const body=JSON.parse(request.postData());posts.push(body);assert.equal(body.action,'APPLY');assert.equal(body.rows.length,2);assert.equal(body.projectId,projectId);assert.equal(body.scope,scope);assert.equal(body.expectedRevision,draft.revision);assert.equal(body.draftId,draft.id);
    if(!rejection){assert.equal(body.rows[0].title,body.rows[1].title);rejection={scope,projectId,operationId:body.operationId,state:'REJECTED',saved:false,definitive:true,phase:'PRE_DECISION',taskEffects:false,code:'PLAN_IMPORT_DUPLICATE_ROWS',receiptId:'plan_receipt_'+'c'.repeat(64),action:body.action,draftId:body.draftId,expectedRevision:body.expectedRevision,inputDigest:await planImportCommandDigest(body),recordedAt:'2026-10-07T00:00:00.000Z',replayed:false,taskSnapshots:[],tasks:[]};return mode==='decision-rejected'?send(request,rejection):send(request,{saved:false,code:'PLAN_IMPORT_UNCONFIRMED'},503);}
    assert.notEqual(body.operationId,rejection.operationId);assert.notEqual(body.rows[0].title,body.rows[1].title);draft={...draft,status:'APPLIED',revision:4,rows:body.rows};receipt={scope,projectId,saved:true,replayed:false,action:'APPLY',receiptId:'receipt-fixture',draft,tasks:body.rows.map((item,index)=>({id:'task-fixture-'+index,title:item.title,status:'BACKLOG',progress:0,startsOn:item.startsOn,endsOn:item.endsOn,revision:'2026-10-07T00:00:00.000001'}))};return send(request,receipt);
   }
   if(url.searchParams.has('operationId')){recoveries.push(url.searchParams.get('operationId'));assert.equal(recoveries.at(-1),rejection.operationId);if(mode==='decision-unconfirmed'&&recoveries.length===1)return send(request,{scope,projectId,state:'NOT_OBSERVED',definitive:false});return send(request,{...rejection,replayed:true});}
   if(url.searchParams.has('draftId'))return send(request,{scope,projectId,draft});return send(request,{scope,projectId,canApprove:true,drafts:draft?[draft]:[],truncated:false});
  }catch(error){errors.push(error.message);if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}});
  await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await click(page,'Importar PDF o imagen');await page.waitForFunction(()=>document.querySelector('input[type=file]')?.disabled===false);await (await page.$('input[type=file]')).uploadFile(sourceFile);await page.click('input[type=checkbox]');await click(page,'Extraer borrador');await wait(page,'Compará cada fila con el archivo');
  const changeTitle=async(index,title)=>{const input=(await page.$$('fieldset input:not([type])'))[index];await input.focus();await page.keyboard.down('Control');await page.keyboard.press('KeyA');await page.keyboard.up('Control');await page.keyboard.press('Backspace');await input.type(title);};
  await changeTitle(0,'Fundaciones corregidas');await changeTitle(1,'Fundaciones corregidas');await page.type('textarea','Revisado con fuente sintética');await (await page.$$('input[type=checkbox]')).at(-1).click();await click(page,'Aplicar 2 tareas');
  if(mode==='decision-rejected-reload'){await wait(page,'La confirmación no llegó.');assert.equal(posts.length,2);await page.reload({waitUntil:'networkidle0'});await wait(page,'Intento pendiente de comprobación');assert.equal(posts.length,2);await click(page,'Comprobar recibo');await wait(page,'El servidor registró el rechazo de esta decisión');assert.equal(posts.length,2);await click(page,'Cerrar');await click(page,'Importar PDF o imagen');await click(page,'Para revisar · 2026-10-06 · 2 tareas');await wait(page,'Compará cada fila con el archivo');await changeTitle(0,'Fundaciones corregidas');await page.type('textarea','Revisado después de recuperar rechazo');}
  else {if(mode==='decision-unconfirmed'){await wait(page,'Intento pendiente de comprobación');await click(page,'Comprobar resultado');await wait(page,'Todavía no se observa un registro');assert.equal(await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent==='Aplicar 2 tareas')?.disabled),true);assert.equal(posts.length,2);await click(page,'Comprobar resultado');}await wait(page,'Decisión rechazada con recibo');assert.deepEqual(await page.$$eval('fieldset input:not([type])',inputs=>inputs.map(input=>input.value)),['Fundaciones corregidas','Fundaciones corregidas']);}
  assert.equal(await page.$eval('[data-task-count]',element=>element.textContent),'Tareas canónicas recibidas: 0');assert.equal(await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent==='Aplicar 2 tareas')?.disabled),true);assert.equal(await (await page.$$('input[type=checkbox]')).at(-1).evaluate(element=>element.checked),false);
  await changeTitle(1,'Estructura corregida');await (await page.$$('input[type=checkbox]')).at(-1).click();await click(page,'Aplicar 2 tareas');await wait(page,'2 tareas aplicadas con recibo');assert.equal(posts.length,3);assert.equal(await page.$eval('[data-task-count]',element=>element.textContent),'Tareas canónicas recibidas: 2');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const stored=await page.evaluate(()=>JSON.stringify([Object.values(localStorage),Object.values(sessionStorage)]));assert.doesNotMatch(stored,/Fundaciones|Estructura|synthetic-plan-token|startsOn|Private/);
  decisionRejectionChecks.push({width,mode,typedRejection:true,zeroTasksBeforeCorrection:true,newUUIDAfterRejection:true,approvalCleared:true,exactRecoveryAfterReload:mode==='decision-rejected-reload',notObservedRetained:mode==='decision-unconfirmed',tasksAfterCorrection:2,posts:posts.length,recoveryReads:recoveries.length});await context.close();
 }
 for(const width of widths)for(const mode of ['upload-source-rejected','upload-source-rejected-reload','upload-quota-rejected','upload-quota-rejected-reload','upload-unconfirmed']){
  const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1000});page.on('pageerror',error=>errors.push(error.message));await page.setRequestInterception(true);
  const quota=mode.includes('quota'),reload=mode.endsWith('reload'),unknown=mode==='upload-unconfirmed',posts=[],recoveries=[];let rejection=null,draft=null;
  const send=(request,data,status=200)=>request.respond({status,contentType:'application/json',headers:{'Cache-Control':'private, no-store'},body:JSON.stringify(data)});
  page.on('request',async request=>{try{
   const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();throw Error('Unexpected external request');}if(url.pathname!=='/api/identity/plan-import')return request.continue();assert.equal(request.headers().authorization,'Bearer synthetic-plan-token');
   if(request.method()==='POST'){
    assert.ok(request.headers()['content-type'].startsWith('multipart/form-data;'),'Upload recovery never sends a decision');const multipart=request.postData()||await request.fetchPostData(),operationId=/name="operationId"\r?\n\r?\n([0-9a-f-]{36})/i.exec(multipart)?.[1];assert.match(operationId||'',/^[0-9a-f-]{36}$/);assert.match(multipart,/plan-document-openai-v1/);posts.push({operationId});
    if(!rejection){
     assert.match(multipart,/filename="synthetic-schedule.pdf"/);const source=readFileSync(sourceFile),inputDigest=createHash('sha256').update(JSON.stringify(['plan-import-upload-command-v1',{action:'UPLOAD',consent:'plan-document-openai-v1',operationId:operationId.toLowerCase(),projectId,scope,source:{bytes:source.length,contentType:'application/pdf',sha256:createHash('sha256').update(source).digest('hex')}}])).digest('hex');
     rejection={scope,projectId,operationId,state:'REJECTED',saved:false,definitive:true,reservationStarted:false,phase:'PRE_RESERVATION',proof:'AUDITED_UPLOAD',taskEffects:false,action:'UPLOAD',code:quota?'PLAN_IMPORT_SCHEDULE_TOO_LARGE':'PLAN_IMPORT_SOURCE_ALREADY_APPLIED',receiptId:'plan_receipt_'+'d'.repeat(64),inputDigest,recordedAt:'2026-10-07T00:00:00.000Z',replayed:false,taskSnapshots:[],tasks:[]};return reload||unknown?send(request,{saved:false,code:'PLAN_IMPORT_UNCONFIRMED'},503):send(request,rejection);
    }
    assert.notEqual(operationId,rejection.operationId,'A verified rejected upload requires a new explicit UUID');assert.match(multipart,/filename="corrected-schedule.pdf"/);draft={id:'plan-corrected-upload',revision:3,status:'READY',existingTaskCount:quota?5000:0,source:{contentType:'application/pdf',bytes:readFileSync(correctedSourceFile).length,sha256:hashFile(correctedSourceFile)},sourceAvailable:true,rows:[row],warnings:[],failure:null,createdAt:'2026-10-07T00:00:00Z',updatedAt:'2026-10-07T00:00:00Z',decision:null};return send(request,{scope,projectId,saved:true,replayed:false,draft});
   }
   assert.equal(request.method(),'GET');if(url.searchParams.has('operationId')){
    recoveries.push(url.searchParams.get('operationId'));assert.equal(recoveries.at(-1),rejection.operationId);
    if(unknown){if(recoveries.length===1)return send(request,{scope,projectId,state:'NOT_OBSERVED',definitive:false});if(recoveries.length===2)return send(request,{...rejection,scope:'b'.repeat(64)});if(recoveries.length===3)return send(request,{...rejection,inputDigest:'f'.repeat(64)});if(recoveries.length===4)return send(request,{code:'PLAN_IMPORT_PERMISSION_REQUIRED'},403);if(recoveries.length===5)return send(request,{code:'PLAN_IMPORT_UNCONFIRMED'},503);}
    return send(request,{...rejection,replayed:true});
   }
   if(url.searchParams.has('draftId'))return send(request,{scope,projectId,draft});return send(request,{scope,projectId,canApprove:true,drafts:draft?[draft]:[],truncated:false});
  }catch(error){errors.push(error.message);if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}});
  await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await click(page,'Importar PDF o imagen');await page.waitForFunction(()=>document.querySelector('input[type=file]')?.disabled===false);await (await page.$('input[type=file]')).uploadFile(sourceFile);await page.click('input[type=checkbox]');await click(page,'Extraer borrador');
  if(reload||unknown){
   // The pending panel appears optimistically; wait for the dispatched POST to
   // lose its ACK before inspecting the committed durable reference.
   await wait(page,'La confirmación no llegó.');await wait(page,'Intento pendiente de comprobación');const entry=(await browserReferences(page))[0];assert.deepEqual(Object.keys(entry).sort(),['action','createdAt','inputDigest','operationId','projectId','resource','scope','version']);assert.equal(entry.action,'UPLOAD');assert.equal(entry.inputDigest,rejection.inputDigest);assert.equal(posts.length,1);
   const stored=JSON.stringify(await browserReferences(page))+await page.evaluate(()=>JSON.stringify([Object.values(localStorage),Object.values(sessionStorage)]));assert.doesNotMatch(stored,/synthetic-schedule|Synthetic Gantt|"source"|consent|filename|token|rows|reason|evidence|data:application/i);
   if(reload){await page.reload({waitUntil:'networkidle0'});await wait(page,'Intento pendiente de comprobación');assert.deepEqual(await browserReferences(page),[entry]);assert.equal(posts.length,1);await click(page,'Comprobar recibo');await wait(page,'El servidor registró el rechazo de esta carga');await page.waitForFunction(()=>document.querySelector('input[type=file]')?.disabled===false);assert.equal(await page.$eval('input[type=file]',element=>element.value),'');}
   else {for(let index=0;index<5;index++){await click(page,'Comprobar resultado');await page.waitForNetworkIdle({idleTime:100,timeout:10000});assert.deepEqual(await browserReferences(page),[entry]);assert.equal(posts.length,1);assert.equal(await page.$('input[type=file]'),null);}await click(page,'Comprobar resultado');await wait(page,'Carga rechazada con recibo');}
  }else {await wait(page,'Carga rechazada con recibo');await wait(page,'Conservamos el archivo seleccionado');}
  assert.deepEqual(await browserReferences(page),[]);assert.equal(posts.length,1);assert.equal(await page.$eval('[data-task-count]',element=>element.textContent),'Tareas canónicas recibidas: 0');assert.equal(await page.$('fieldset'),null);assert.equal(await page.$eval('input[type=checkbox]',element=>element.checked),false);assert.equal(await page.$$eval('button',buttons=>buttons.some(button=>button.textContent==='Reintentar los mismos datos')),false);
  await (await page.$('input[type=file]')).uploadFile(correctedSourceFile);assert.equal(await page.$eval('input[type=checkbox]',element=>element.checked),false);await page.click('input[type=checkbox]');await click(page,'Extraer borrador');await wait(page,'Compará cada fila con el archivo');assert.equal(posts.length,2);assert.notEqual(posts[0].operationId,posts[1].operationId);assert.deepEqual(await browserReferences(page),[]);assert.equal(await page.$eval('[data-task-count]',element=>element.textContent),'Tareas canónicas recibidas: 0');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  uploadRejectionChecks.push({width,mode,typedAuditedUpload:true,noDraftOrTaskBeforeCorrection:true,exactEightKeyReference:true,fileAndPayloadNotPersisted:true,newExplicitUUID:true,consentReset:true,globalRecoveryAfterReload:reload,unknownForeignMalformedDeniedAnd503Retained:unknown,posts:posts.length,recoveryReads:recoveries.length});await context.close();
 }
 assert.deepEqual(errors,[]);proof={validated:true,synthetic:true,realProviderCalls:false,widths,checks,decisionRejectionChecks,uploadRejectionChecks,totalCheckCount:checks.length+decisionRejectionChecks.length+uploadRejectionChecks.length,...sourceProof,providerCalls:0,productionDataWritten:false,errors};
}catch(error){console.error(JSON.stringify({log,errors,checks,decisionRejectionChecks,uploadRejectionChecks}));throw error;}finally{await browser?.close();await stopHarnessServer();const target=realpathSync(fixture);assert.equal(path.dirname(target),realpathSync(scratch));assert.ok(path.basename(target).startsWith('plan-ui-'));rmSync(target,{recursive:true,force:true});fixtureRemoved=!existsSync(target);}
assert.equal(fixtureRemoved,true);proof.fixtureRemoved=fixtureRemoved;writeFileSync(path.join(scratch,'plan-import-ui-validation.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify({...proof,checks:checks.length,decisionRejectionChecks:decisionRejectionChecks.length,uploadRejectionChecks:uploadRejectionChecks.length,sourceManifest:proof.sourceManifest.length}));
