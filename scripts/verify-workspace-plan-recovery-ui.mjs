import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,mkdtempSync,copyFileSync,writeFileSync,rmSync,readdirSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import puppeteer from 'puppeteer';
import {createPlanImportHandlers} from '../src/lib/plan-import-http.mjs';

// Real workspace, pagination, plan panel, transport and browser recovery state.
// Only session tokens and HTTP responses are synthetic; no provider is called.
assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV);
const root=process.cwd(),evidence=path.join(root,'.vercel/private');mkdirSync(evidence,{recursive:true});
const fixture=mkdtempSync(path.join(evidence,'workspace-plan-ui-')),app=path.join(fixture,'src/app'),components=path.join(app,'(identity)/cuenta');mkdirSync(components,{recursive:true});
const sourceManifest=[];
for(const file of readdirSync(path.join(root,'src/app/(identity)/cuenta')).filter(name=>/\.(js|mjs|css)$/.test(name))){
 const source='src/app/(identity)/cuenta/'+file;copyFileSync(path.join(root,source),path.join(components,file));
 sourceManifest.push({path:source,sha256:createHash('sha256').update(readFileSync(path.join(components,file))).digest('hex')});
}
for(const source of ['src/lib/geo.js','src/lib/field-media-privacy.mjs','src/lib/worker-channel-consent-policy.mjs','src/lib/whatsapp/tenant-workspace-policy.js','src/lib/company-phone-format.mjs']){
 const destination=path.join(fixture,source);mkdirSync(path.dirname(destination),{recursive:true});copyFileSync(path.join(root,source),destination);
 sourceManifest.push({path:source,sha256:createHash('sha256').update(readFileSync(destination)).digest('hex')});
}
const harnessSha256=createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex');
for(const source of ['src/lib/plan-import-http.mjs','src/lib/plan-import-policy.mjs','src/lib/plan-import-store.mjs','src/lib/workspace-policy.mjs','src/lib/private-image-upload.mjs'])sourceManifest.push({path:source,sha256:createHash('sha256').update(readFileSync(path.join(root,source))).digest('hex')});
writeFileSync(path.join(fixture,'package.json'),JSON.stringify({name:'isolated-workspace-plan-recovery-ui',private:true}));
writeFileSync(path.join(fixture,'next.config.mjs'),`export default {devIndicators:false,turbopack:{root:${JSON.stringify(root)}}};`);
writeFileSync(path.join(app,'layout.js'),`export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:12,fontFamily:'Arial'}}>{children}</body></html>}`);
writeFileSync(path.join(app,'page.js'),`'use client';import {useCallback,useState} from 'react';import {AccountWorkspace} from './(identity)/cuenta/workspace-client';export default function Page(){const [context,setContext]=useState('A'),[visible,setVisible]=useState(true);const token=useCallback(async()=> 'synthetic-workspace-plan-'+context,[context]);return <main style={{maxWidth:1000,margin:'auto'}}><h2 id="onboarding-guide-title">Ensayo sintético de recuperación</h2><button onClick={()=>setContext('B')}>Cambiar contexto del ensayo</button><button onClick={()=>setVisible(false)}>Desmontar ensayo</button>{visible?<AccountWorkspace getSessionToken={token}/>:<p>Ensayo desmontado</p>}</main>}`);
const sourceFile=path.join(fixture,'synthetic-schedule.pdf');writeFileSync(sourceFile,'%PDF-1.7\nSynthetic schedule fixture\n%%EOF');
const invalidSourceFile=path.join(fixture,'invalid-schedule.pdf'),oversizedSourceFile=path.join(fixture,'oversized-schedule.pdf');writeFileSync(invalidSourceFile,'Invalid synthetic PDF bytes');writeFileSync(oversizedSourceFile,Buffer.alloc(4*1024*1024));
const port=3179,origin='http://127.0.0.1:'+port,server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',fixture,'--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'],windowsHide:true});
const serverClosed=new Promise(resolve=>server.once('close',resolve));
async function stopHarnessServer(){
 let deadline;
 try{
  if(server.exitCode===null&&server.signalCode===null){
   if(process.platform==='win32'){
    // Node's Windows SIGTERM does not run Next's handler; stop only this owned tree.
    const stopped=spawnSync('taskkill.exe',['/PID',String(server.pid),'/T','/F'],{stdio:'ignore',windowsHide:true,timeout:10000});
    assert.equal(stopped.status,0,'The owned Next process tree must stop before fixture removal');
   }else assert.ok(server.kill('SIGTERM'),'Next must receive its graceful shutdown signal');
  }
  await Promise.race([serverClosed,new Promise((_,reject)=>{deadline=setTimeout(()=>reject(new Error('WORKSPACE_PLAN_UI_SERVER_CLOSE_TIMEOUT')),10000);})]);
 }finally{clearTimeout(deadline);}
}
let log='',browser;for(const stream of [server.stdout,server.stderr])stream.on('data',data=>{log=(log+data).slice(-18000);});
const scope='a'.repeat(64),scopeB='b'.repeat(64),projectId='project-plan-A',projectB='project-plan-B';
const row={title:'Fundaciones importadas',startsOn:'2026-10-08',endsOn:'2026-10-10',evidence:'Fila sintética 1',uncertainty:''};
const importedTask={id:'z-imported',...row,status:'BACKLOG',progress:0,revision:'2026-10-06T00:00:00.000001'};
const existingTasks=Array.from({length:150},(_,index)=>({id:'existing-'+String(index+1).padStart(3,'0'),title:'Tarea registrada '+(index+1),status:'BACKLOG',progress:0,startsOn:'2026-10-01',endsOn:'2026-10-05',revision:'2026-10-05T00:00:00.000001'}));
const widths=[320,390,768,1280],modes=['apply','recover-after-reload','read-failure','scope-mismatch','project-mismatch','context-change-read','unmount-read','task-recover-existing','task-recover-after-reload'],checks=[],errors=[];
const closureModes=['upload-not-observed','decision-not-observed','upload-denied-403','upload-context-409','decision-denied-403','decision-context-409','legacy-reference','legacy-conflict','global-recovery','global-read-failure','global-same-mount','invalid-source','oversized-source','upload-explicit-retry','decision-explicit-retry','upload-close-after-check','upload-lease-expiry','global-lease-expiry'];
const selectedModes=process.env.PLAN_RECOVERY_UI_MODES?.split(',')||[...modes,...closureModes];assert.ok(selectedModes.length&&selectedModes.every(mode=>[...modes,...closureModes].includes(mode)));
const waitText=(page,value)=>page.waitForFunction(expected=>document.body.innerText.includes(expected),{timeout:20000},value);
async function click(page,label){
 await page.waitForFunction(expected=>[...document.querySelectorAll('button')].some(button=>button.textContent.trim()===expected&&!button.disabled),{timeout:20000},label);
 const button=await page.evaluateHandle(expected=>[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===expected),label);await button.asElement().click();await button.dispose();
}
async function openProject(page,id=projectId){
 await page.waitForFunction(project=>[...document.querySelectorAll('button')].some(button=>button.textContent.includes(project)&&!button.disabled),{},id===projectId?'Obra paginada A':'Obra del contexto B');
 await page.evaluate(project=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes(project)).click(),id===projectId?'Obra paginada A':'Obra del contexto B');
}
async function assertCount(page,total,loaded=100){
 await waitText(page,`${loaded} de ${total} tareas`);assert.equal(await page.$$eval('[data-task-id]',nodes=>nodes.length),loaded);
 assert.ok(!await page.evaluate(()=>document.body.innerText.includes('de 152 tareas')),'A recovered receipt must not increment an existing canonical count');
}
async function assertPlanBlockingNavigation(page,posts){
 const selector='nav[aria-labelledby="workspace-tools-title"] [role="status"] a[href="#plan-import-title"]',beforePosts=posts.length;
 await page.waitForSelector(selector);
 assert.deepEqual(await page.$$eval('nav[aria-labelledby="workspace-tools-title"] [role="status"] a',links=>links.map(link=>link.getAttribute('href'))),['#plan-import-title'],'The plan lock must name the actual blocking module, without labelling it as task creation');
 assert.equal(await page.$$eval('button',buttons=>buttons.find(button=>button.textContent.trim()==='Actualizar')?.disabled),true,'A ready or uncertain import locks context refresh');
 const link=await page.$(selector);assert.ok(await link.evaluate(element=>{const rect=element.getBoundingClientRect();return rect.width>=44&&rect.height>=44;}),'The recovery link must be touch accessible');
 await link.focus();await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.activeElement?.id==='plan-import-title'&&location.hash==='#plan-import-title');
 const destination=await page.$eval('#plan-import-title',element=>{const rect=element.getBoundingClientRect();return {top:rect.top,bottom:rect.bottom,height:innerHeight};});
 assert.ok(destination.top>=-1&&destination.bottom<=destination.height,'Keyboard navigation must bring the blocking panel into view: '+JSON.stringify(destination));
 await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>Boolean(document.activeElement?.closest('[data-plan-import]'))),'Tab after the destination enters the import controls');
 assert.equal(posts.length,beforePosts,'Recovery navigation must never send a command');
}
async function scenario(mode,width){
 const taskMode=mode.startsWith('task-');
 const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1000});page.on('pageerror',error=>errors.push({mode,width,message:error.message}));await page.setRequestInterception(true);
 let draft=null,receipt=null,applied=mode==='task-recover-existing',heldRead=null,readFailures=0;const posts=[],workspaceReads=[],recoveryReads=[];
 const send=(request,body,status=200)=>request.respond({status,contentType:'application/json',headers:{'Cache-Control':'private, no-store'},body:JSON.stringify(body)});
 page.on('request',async request=>{try{
  const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();throw Error('Unexpected external request');}if(!url.pathname.startsWith('/api/'))return request.continue();
  assert.ok(['/api/identity/workspace','/api/identity/plan-import','/api/identity/task-creation'].includes(url.pathname),'Unexpected API '+url.pathname);
  const activeB=request.headers().authorization==='Bearer synthetic-workspace-plan-B';assert.equal(request.headers().authorization,'Bearer synthetic-workspace-plan-'+(activeB?'B':'A'));
  if(url.pathname==='/api/identity/workspace'){
   assert.equal(request.method(),'GET','Plan readback must never POST to workspace');
   if(!url.search)return send(request,{scope:activeB?scopeB:scope,organizationName:activeB?'Empresa del contexto B':'Empresa sintética de cronogramas',role:'ADMIN',roleLabel:'Administrador',canManageIntegrations:false,projects:[{id:activeB?projectB:projectId,name:activeB?'Obra del contexto B':'Obra paginada A'}],projectsTruncated:false});
   assert.equal(url.searchParams.get('scope'),activeB?scopeB:scope);assert.equal(url.searchParams.get('projectId'),activeB?projectB:projectId);
   workspaceReads.push({scope:url.searchParams.get('scope'),projectId:url.searchParams.get('projectId'),afterTask:url.searchParams.get('afterTask'),applied});
   if(activeB)return send(request,{scope:scopeB,project:{id:projectB,name:'Obra del contexto B'},canPlanSchedule:true,tasks:existingTasks.slice(0,7).map(task=>({...task,id:'context-B-'+task.id,title:'Tarea del contexto B'})),totalTasks:7,nextCursor:null});
   const after=url.searchParams.get('afterTask'),all=[...existingTasks,...(applied?[importedTask]:[])];
   if(after)assert.equal(after,'existing-100');
   const body={scope,project:{id:projectId,name:'Obra paginada A'},canPlanSchedule:true,tasks:after?all.slice(100):all.slice(0,100),totalTasks:all.length,nextCursor:after?null:'existing-100'};
   const readback=applied&&!after&&workspaceReads.filter(read=>read.scope===scope).length===2;
   if(readback&&['context-change-read','unmount-read'].includes(mode)){heldRead={request,body};return;}
   if(readback&&mode==='read-failure'){readFailures++;return send(request,{code:'WORKSPACE_QUERY_FAILED'},503);}
   if(readback&&mode==='scope-mismatch')return send(request,{...body,scope:scopeB,totalTasks:999});
   if(readback&&mode==='project-mismatch')return send(request,{...body,project:{id:projectB,name:'Respuesta de otra obra'},totalTasks:999});
   return send(request,body);
  }
  if(url.pathname==='/api/identity/task-creation'){
   assert.equal(taskMode,true);assert.equal(activeB,false);
   if(request.method()==='POST'){
    const payload=JSON.parse(request.postData());assert.equal(payload.projectId,projectId);assert.equal(payload.scope,scope);assert.equal(payload.title,row.title);assert.equal(applied,mode==='task-recover-existing','An existing task receipt must not create another task');
    posts.push({...payload,action:'CREATE_TASK'});applied=true;receipt={scope,created:true,replayed:mode==='task-recover-existing',receiptId:'receipt-task-A',task:importedTask};
    return send(request,{code:'TASK_CREATION_UNCONFIRMED'},503);
   }
   assert.equal(request.method(),'GET');assert.equal(url.searchParams.get('projectId'),projectId);assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('operationId'),posts[0].operationId);recoveryReads.push(url.searchParams.get('operationId'));return send(request,{state:'RECORDED',...receipt});
  }
  assert.equal(activeB,false,'The old plan must never be read in the new context');
  if(request.method()==='POST'){
   if(request.headers()['content-type'].startsWith('multipart/form-data;')){
    const multipart=request.postData()||await request.fetchPostData();assert.match(multipart,/plan-document-openai-v1/);assert.match(multipart,/synthetic-schedule\.pdf/);posts.push({action:'UPLOAD'});
    draft={id:'draft-plan-A',revision:3,status:'READY',existingTaskCount:150,source:{contentType:'application/pdf',bytes:42,sha256:'c'.repeat(64)},sourceAvailable:true,rows:[row],warnings:[],failure:null,createdAt:'2026-10-06T00:00:00Z',updatedAt:'2026-10-06T00:00:00Z',decision:null};
    return send(request,{scope,projectId,saved:true,replayed:false,draft});
   }
   const payload=JSON.parse(request.postData());posts.push(payload);assert.equal(payload.action,'APPLY');assert.equal(payload.scope,scope);assert.equal(payload.projectId,projectId);assert.equal(payload.draftId,draft.id);assert.equal(payload.expectedRevision,3);assert.deepEqual(payload.rows,[row]);assert.equal(applied,false,'Application may only happen once');
   applied=true;draft={...draft,revision:4,status:'APPLIED',rows:payload.rows};receipt={scope,projectId,saved:true,replayed:false,action:'APPLY',receiptId:'receipt-plan-A',draft,tasks:[importedTask]};
   if(mode==='recover-after-reload')return send(request,{code:'PLAN_IMPORT_UNCONFIRMED'},503);return send(request,receipt);
  }
  assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),projectId);
  if(url.searchParams.has('operationId')){const operationId=url.searchParams.get('operationId');recoveryReads.push(operationId);assert.equal(operationId,posts.find(post=>post.action==='APPLY').operationId);return send(request,{state:'RECORDED',...receipt});}
  if(url.searchParams.has('draftId'))return send(request,{scope,projectId,draft});
  return send(request,{scope,projectId,canApprove:true,drafts:draft?[draft]:[],truncated:false});
 }catch(error){errors.push({mode,width,message:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}});
 await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await waitText(page,'Empresa sintética de cronogramas');await openProject(page);await assertCount(page,applied?151:150);
 assert.equal(await page.$('[data-task-id="z-imported"]'),null,'Imported task must be outside the first page');
 if(taskMode){
  await click(page,'Nueva tarea');await page.type('section[aria-label="Crear tarea de la obra"] input',row.title);await click(page,'Crear tarea');
 }else{
  await click(page,'Importar PDF o imagen');await waitText(page,'Autorizo enviar este cronograma a OpenAI');await (await page.$('[data-plan-import] input[type=file]')).uploadFile(sourceFile);await page.click('[data-plan-import] input[type=checkbox]');await click(page,'Extraer borrador');await waitText(page,'Compará cada fila con el archivo');
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Nueva tarea')?.disabled===true);
  assert.equal(await page.$$eval('button',buttons=>buttons.find(button=>button.textContent.trim()==='Nueva tarea')?.disabled),true,'A ready plan draft prevents a new task from invalidating its reviewed baseline');
  await assertPlanBlockingNavigation(page,posts);
  await page.type('[data-plan-import] textarea','Revisado con la fuente sintética');await (await page.$$('[data-plan-import] input[type=checkbox]')).at(-1).click();await click(page,'Aplicar 1 tareas');
 }
 if(mode==='task-recover-after-reload'){
  await waitText(page,'La confirmación no llegó. Comprobá el recibo');assert.equal(posts.length,1);assert.equal(applied,true);
  await page.reload({waitUntil:'networkidle0'});await waitText(page,'Empresa sintética de cronogramas');await openProject(page);await assertCount(page,151);await waitText(page,'Operaciones por comprobar');await click(page,'Comprobar recibo');await waitText(page,'El total incluye la tarea creada');await assertCount(page,151);assert.equal(recoveryReads.length,1);
  assert.ok(!await page.evaluate(()=>document.body.innerText.includes('El plan tiene un recibo')),'Task recovery must use the task label');
 }else if(mode==='task-recover-existing'){
  // The receipt's task is already included in count(*), outside page100. The
  // panel recovery invokes onCreated; the former inline increment made152.
  await waitText(page,'La confirmación no llegó. Comprobá el recibo');await assertCount(page,151);await click(page,'Comprobar tarea');
  await waitText(page,'El total incluye la tarea creada');await assertCount(page,151);assert.equal(recoveryReads.length,1);await waitText(page,'Tarea creada y vinculada a esta obra');
 }else if(mode==='recover-after-reload'){
   await waitText(page,'La confirmación no llegó.');await waitText(page,'Intento pendiente de comprobación');assert.equal(posts.length,2);assert.equal(applied,true);await assertPlanBlockingNavigation(page,posts);
  await page.reload({waitUntil:'networkidle0'});await waitText(page,'Empresa sintética de cronogramas');await openProject(page);await assertCount(page,151);await waitText(page,'Intento pendiente de comprobación');await assertPlanBlockingNavigation(page,posts);await click(page,'Comprobar resultado');await waitText(page,'Cronograma actualizado desde los registros de la obra');await assertCount(page,151);assert.equal(recoveryReads.length,1);
 }else if(['read-failure','scope-mismatch','project-mismatch'].includes(mode)){
  await waitText(page,'no pudimos actualizar el cronograma');await waitText(page,'Recibo confirmado: receipt-plan-A');await assertCount(page,150);assert.ok(!await page.evaluate(()=>document.body.innerText.includes('999 tareas')));assert.equal(posts.length,2);
  await click(page,'Volver a consultar el cronograma');await waitText(page,'Cronograma actualizado desde los registros de la obra');await assertCount(page,151);assert.equal(readFailures,mode==='read-failure'?1:0);
 }else if(['context-change-read','unmount-read'].includes(mode)){
  await waitText(page,'Consultando el cronograma actualizado');await page.waitForFunction(()=>[...document.querySelectorAll('button')].find(button=>button.textContent==='Actualizar').disabled);assert.ok(heldRead,'Canonical read must be pending');
  if(mode==='context-change-read'){await click(page,'Cambiar contexto del ensayo');await waitText(page,'Empresa del contexto B');await openProject(page,projectB);await assertCount(page,7,7);}else{await click(page,'Desmontar ensayo');await waitText(page,'Ensayo desmontado');}
  await send(heldRead.request,{...heldRead.body,totalTasks:999}).catch(()=>{});await page.waitForNetworkIdle({idleTime:150,timeout:15000});
  if(mode==='context-change-read'){
   await assertCount(page,7,7);const contents=await page.evaluate(()=>document.body.innerText);
   assert.ok(!contents.includes('Recibo confirmado: receipt-plan-A'));assert.ok(!contents.includes('Cronograma actualizado desde los registros de la obra'),'A stale read must not change the new context notice');
  }else assert.equal(await page.$('[data-schedule-workbench]'),null);
  assert.ok(!await page.evaluate(()=>document.body.innerText.includes('999 tareas')));
 }else{
  await waitText(page,'Cronograma actualizado desde los registros de la obra');await assertCount(page,151);await waitText(page,'Recibo confirmado: receipt-plan-A');
 }
 assert.equal(posts.filter(post=>post.action===(taskMode?'CREATE_TASK':'APPLY')).length,1);assert.equal(posts.length,taskMode?1:2,'Read failures and recovery must never repeat a creation, upload or application');
 if(!['context-change-read','unmount-read'].includes(mode)){
  await click(page,'Cargar más tareas');await assertCount(page,151,151);assert.ok(await page.$('[data-task-id="z-imported"]'));assert.equal(await page.$eval('[data-task-id="z-imported"] [role=progressbar]',element=>element.getAttribute('aria-valuenow')),'0');
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('button')].some(button=>button.textContent==='Cargar más tareas')),false);
  await page.reload({waitUntil:'networkidle0'});await waitText(page,'Empresa sintética de cronogramas');await openProject(page);await assertCount(page,151);assert.equal(posts.length,taskMode?1:2);
 }
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow '+mode+' '+width);
 const stored=await page.evaluate(()=>JSON.stringify([Object.values(localStorage),Object.values(sessionStorage)]));assert.doesNotMatch(stored,/Fundaciones importadas|synthetic-workspace-plan|Synthetic schedule fixture/);
 checks.push({mode,width,applications:posts.filter(post=>post.action==='APPLY').length,posts:posts.length,workspaceReads:workspaceReads.length,recoveryReads:recoveryReads.length});await context.close();
}
async function browserReferences(page){
 return page.evaluate(()=>new Promise((resolve,reject)=>{
  const request=indexedDB.open('obrasaas-pending-receipts-v1');request.onerror=()=>reject(Error('Cannot inspect synthetic recovery database'));request.onsuccess=()=>{
   const database=request.result,transaction=database.transaction('references','readonly'),read=transaction.objectStore('references').getAll();
   read.onsuccess=()=>resolve(read.result.map(row=>JSON.parse(row.value)));read.onerror=()=>reject(Error('Cannot inspect synthetic recovery references'));transaction.oncomplete=()=>database.close();
  };
 }));
}
async function recoveryClosureScenario(mode,width){
 const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1000});page.on('pageerror',error=>errors.push({mode,width,message:error.message}));await page.setRequestInterception(true);
 const globalMode=mode.startsWith('global-'),expiryMode=mode.endsWith('lease-expiry'),legacyConflict=mode==='legacy-conflict',correctionMode=['invalid-source','oversized-source'].includes(mode),explicitRetryMode=mode.endsWith('explicit-retry'),closeAfterCheck=mode==='upload-close-after-check',decisionMode=mode.startsWith('decision-')||globalMode&&!expiryMode||legacyConflict,legacyMode=mode==='legacy-reference';
 const legacyId='01234567-89ab-4cde-8fab-0123456789ab';
 let draft=null,receipt=null,applied=false,resolved=false,denyRead=false,rejectRead=false,observed=false,readbackFailed=false,leaseExpired=false,invalidExpiry=null,workspaceQueries=0;const posts=[],recoveryReads=[];
 const send=(request,body,status=200)=>request.respond({status,contentType:'application/json',headers:{'Cache-Control':'private, no-store'},body:JSON.stringify(body)});
 const failStatus=mode.endsWith('403')?403:mode.endsWith('409')?409:503;
 let rejectedAttachCalls=0;
 const rejectionHandlers=createPlanImportHandlers({verify:async()=>({authenticated:true,verification:'clerk-production-jwt',userId:'user_Synthetic',organizationId:'org_Synthetic',organizationRole:'org:admin'}),imports:{attach:async()=>{rejectedAttachCalls++;throw Error('Invalid source must never reach attach');}}});
 page.on('request',async request=>{try{
  const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();throw Error('Unexpected external request');}if(!url.pathname.startsWith('/api/'))return request.continue();
  assert.ok(['/api/identity/workspace','/api/identity/plan-import'].includes(url.pathname),'Unexpected API '+url.pathname);
  const activeB=request.headers().authorization==='Bearer synthetic-workspace-plan-B';assert.equal(request.headers().authorization,'Bearer synthetic-workspace-plan-'+(activeB?'B':'A'));
  if(url.pathname==='/api/identity/workspace'){
   workspaceQueries++;
   assert.equal(request.method(),'GET');
   if(!url.search)return send(request,{scope:activeB?scopeB:scope,organizationName:activeB?'Empresa del contexto B':'Empresa sintética de cronogramas',role:'ADMIN',roleLabel:'Administrador',canManageIntegrations:false,projects:[{id:activeB?projectB:projectId,name:activeB?'Obra del contexto B':'Obra paginada A'}],projectsTruncated:false});
   assert.equal(url.searchParams.get('scope'),activeB?scopeB:scope);assert.equal(url.searchParams.get('projectId'),activeB?projectB:projectId);
   if(activeB)return send(request,{scope:scopeB,project:{id:projectB,name:'Obra del contexto B'},canPlanSchedule:true,tasks:existingTasks.slice(0,7),totalTasks:7,nextCursor:null});
   if(mode==='global-read-failure'&&observed&&!readbackFailed){readbackFailed=true;return send(request,{code:'WORKSPACE_QUERY_FAILED'},503);}
   const after=url.searchParams.get('afterTask'),all=[...existingTasks,...(applied?[importedTask]:[])];
   return send(request,{scope,project:{id:projectId,name:'Obra paginada A'},canPlanSchedule:true,tasks:after?all.slice(100):all.slice(0,100),totalTasks:all.length,nextCursor:after?null:'existing-100'});
  }
  assert.equal(activeB,false,'An old plan attempt must not be queried in the new identity scope');assert.equal(url.searchParams.get('scope')||scope,scope);assert.equal(url.searchParams.get('projectId')||projectId,projectId);
  if(request.method()==='POST'){
   if(request.headers()['content-type'].startsWith('multipart/form-data;')){
    const multipart=request.postData()||await request.fetchPostData(),operationId=/name="operationId"\r?\n\r?\n([0-9a-f-]{36})/i.exec(multipart)?.[1],boundary=/boundary=(?:"([^"]+)"|([^;]+))/.exec(request.headers()['content-type']);assert.match(operationId||'',/^[0-9a-f-]{36}$/);posts.push({action:'UPLOAD',operationId,payload:multipart.replaceAll(boundary[1]||boundary[2],'BOUNDARY')});
    if(explicitRetryMode&&posts.filter(post=>post.action==='UPLOAD').length===2){assert.equal(operationId,posts[0].operationId);assert.equal(posts.at(-1).payload,posts[0].payload);return send(request,{scope,projectId,saved:true,replayed:true,draft});}
    if(mode==='invalid-source'&&posts.length===1){
     assert.match(multipart,/filename="invalid-schedule.pdf"/);
     // Chromium's intercepted postData omits file bytes. Feed the exact selected
     // synthetic fixture to the real parser rather than inventing a rejection.
     const form=new FormData();for(const [key,value] of Object.entries({scope,projectId,operationId,consent:'plan-document-openai-v1'}))form.append(key,value);form.append('file',new Blob([readFileSync(invalidSourceFile)],{type:'application/pdf'}),'invalid-schedule.pdf');
     const response=await rejectionHandlers.POST(new Request('https://obrasaas.com/api/identity/plan-import',{method:'POST',headers:{Origin:'https://obrasaas.com'},body:form}));assert.equal(response.status,400);assert.equal(rejectedAttachCalls,0);return send(request,await response.json(),response.status);
    }
    draft={id:'draft-plan-A',revision:3,status:'READY',existingTaskCount:150,source:{contentType:'application/pdf',bytes:42,sha256:'c'.repeat(64)},sourceAvailable:true,rows:[row],warnings:[],failure:null,createdAt:'2026-10-06T00:00:00Z',updatedAt:'2026-10-06T00:00:00Z',decision:null};
    if(expiryMode&&posts.length===1){draft={...draft,id:'draft-expired-A',status:globalMode?'PROCESSING':'UPLOADING',revision:2,rows:[],processingExpired:false,processingExpiresAt:new Date(Date.now()+60000).toISOString()};return send(request,{scope,projectId,saved:true,draft});}
    return decisionMode||correctionMode||expiryMode?send(request,{scope,projectId,saved:true,draft}):send(request,{code:failStatus===403?'PLAN_IMPORT_PERMISSION_REQUIRED':failStatus===409?'WORKSPACE_CONTEXT_CHANGED':'PLAN_IMPORT_UNCONFIRMED'},failStatus);
   }
   const payload=JSON.parse(request.postData());assert.equal(decisionMode,true);assert.equal(payload.action,'APPLY');assert.equal(payload.scope,scope);assert.equal(payload.projectId,projectId);posts.push({...payload,payload:request.postData()});
   if(explicitRetryMode&&posts.filter(post=>post.action==='APPLY').length===2){assert.equal(payload.operationId,posts[1].operationId);assert.equal(request.postData(),posts[1].payload);return send(request,{...receipt,replayed:true});}
   assert.equal(applied,false);applied=true;draft={...draft,status:'APPLIED',revision:4};receipt={scope,projectId,saved:true,action:'APPLY',receiptId:'receipt-plan-A',draft,tasks:[importedTask]};
   return send(request,{code:failStatus===403?'PLAN_IMPORT_PERMISSION_REQUIRED':failStatus===409?'WORKSPACE_CONTEXT_CHANGED':'PLAN_IMPORT_UNCONFIRMED'},failStatus);
  }
  assert.equal(request.method(),'GET');
  if(url.searchParams.has('operationId')){
   const operationId=url.searchParams.get('operationId');assert.ok(operationId===(legacyMode?legacyId:posts.at(-1).operationId)||legacyConflict&&operationId===legacyId);recoveryReads.push(operationId);
   if(expiryMode){
    if(invalidExpiry){const kind=invalidExpiry;invalidExpiry=null;return send(request,{scope:kind==='foreign'?scopeB:scope,projectId,operationId,state:'EXPIRED',saved:false,definitive:true,draft:{...draft,processingExpired:true,processingExpiresAt:kind==='malformed'?'invalid':kind==='future'?new Date(Date.now()+60000).toISOString():new Date(Date.now()-1000).toISOString()}});}
    return leaseExpired?send(request,{scope,projectId,operationId,state:'EXPIRED',saved:false,definitive:true,draft:{...draft,processingExpired:true,processingExpiresAt:new Date(Date.now()-1000).toISOString()}}):send(request,{scope,projectId,state:'RECORDED',draft});
   }
   if(legacyConflict&&operationId===legacyId)return send(request,{scope,projectId,state:'NOT_OBSERVED',definitive:false});
   if(denyRead){denyRead=false;return send(request,{code:'PLAN_IMPORT_PERMISSION_REQUIRED'},403);}
   if(rejectRead){rejectRead=false;return send(request,{scope,projectId,operationId,state:'REJECTED',saved:false,definitive:true,reservationStarted:false,phase:'PRE_RESERVATION',code:'PLAN_IMPORT_FILE_INVALID'});}
   if(!resolved)return send(request,{scope,projectId,state:'NOT_OBSERVED',definitive:false});observed=true;
   return send(request,decisionMode?{state:'RECORDED',...receipt}:{scope,projectId,state:'RECORDED',draft});
  }
  if(url.searchParams.has('draftId'))return send(request,{scope,projectId,draft});
  return send(request,{scope,projectId,canApprove:true,drafts:draft?[draft]:[],truncated:false});
 }catch(error){errors.push({mode,width,message:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}});
 await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await waitText(page,'Empresa sintética de cronogramas');
 if(legacyMode){await page.evaluate(({scope,projectId,operationId})=>sessionStorage.setItem('obrasaas-plan-attempt-v1:'+scope+':'+projectId,JSON.stringify({scope,projectId,operationId,kind:'UPLOAD'})),{scope,projectId,operationId:legacyId});}
 await openProject(page);await assertCount(page,150);
 if(!legacyMode){
  await click(page,'Importar PDF o imagen');await (await page.$('[data-plan-import] input[type=file]')).uploadFile(mode==='invalid-source'?invalidSourceFile:mode==='oversized-source'?oversizedSourceFile:sourceFile);await page.click('[data-plan-import] input[type=checkbox]');await click(page,'Extraer borrador');
  if(correctionMode){
   await waitText(page,mode==='invalid-source'?'El archivo fue rechazado antes de reservar un borrador':'El PDF debe pesar hasta 3 MB');assert.equal(posts.length,mode==='invalid-source'?1:0);assert.equal(rejectedAttachCalls,0);assert.deepEqual(await browserReferences(page),[]);
   await (await page.$('[data-plan-import] input[type=file]')).uploadFile(sourceFile);await page.click('[data-plan-import] input[type=checkbox]');await click(page,'Extraer borrador');await waitText(page,'Compará cada fila con el archivo');
   assert.equal(posts.length,mode==='invalid-source'?2:1);if(mode==='invalid-source')assert.notEqual(posts[0].operationId,posts[1].operationId);assert.deepEqual(await browserReferences(page),[]);await assertCount(page,150);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));checks.push({mode,width,posts:posts.length,rejectedAttachCalls,durableJournal:true,explicitCorrection:true});await context.close();return;
  }
  if(decisionMode){await waitText(page,'Compará cada fila con el archivo');await page.type('[data-plan-import] textarea','Revisado con la fuente sintética');await (await page.$$('[data-plan-import] input[type=checkbox]')).at(-1).click();await click(page,'Aplicar 1 tareas');}
 }
 if(!legacyMode&&!expiryMode)await waitText(page,'La confirmación no llegó.');await waitText(page,'Intento pendiente de comprobación');if(expiryMode)await waitText(page,'El intento quedó registrado.');const reference=(await browserReferences(page)).find(entry=>entry.resource==='plan-import');assert.ok(reference);assert.equal(reference.operationId,legacyMode?legacyId:posts.at(-1).operationId);assert.equal(reference.projectId,projectId);assert.equal(reference.scope,scope);
 const referenceFields=['createdAt','operationId','projectId','resource','scope','version'];
 assert.deepEqual(Object.keys(reference).sort(),[...referenceFields,...(decisionMode?['action','draftId','expectedRevision','inputDigest']:legacyMode?[]:['action','inputDigest'])].sort(),'Only the exact legacy, typed upload or typed decision reference schema may persist');
 assert.equal(reference.version,1);assert.equal(reference.resource,'plan-import');assert.ok(Number.isSafeInteger(reference.createdAt)&&reference.createdAt>=0);
 if(decisionMode){
  const command=JSON.parse(posts.find(post=>post.action==='APPLY').payload);
  assert.deepEqual(Object.keys(command).sort(),['action','draftId','expectedRevision','operationId','projectId','reason','rows','scope']);
  assert.equal(reference.action,command.action);assert.equal(reference.action,'APPLY');assert.equal(reference.draftId,command.draftId);assert.equal(reference.draftId,'draft-plan-A');
  assert.equal(reference.expectedRevision,command.expectedRevision);assert.ok(Number.isSafeInteger(reference.expectedRevision)&&reference.expectedRevision===3);assert.equal(reference.operationId,command.operationId.toLowerCase());
  assert.match(reference.inputDigest,/^[a-f0-9]{64}$/);
  const canonicalCommand={action:command.action,draftId:command.draftId,expectedRevision:command.expectedRevision,operationId:command.operationId.toLowerCase(),projectId:command.projectId,reason:command.reason,rows:command.rows.map(value=>{assert.deepEqual(Object.keys(value).sort(),['endsOn','evidence','startsOn','title','uncertainty']);return {endsOn:value.endsOn,evidence:value.evidence,startsOn:value.startsOn,title:value.title,uncertainty:value.uncertainty};}),scope:command.scope};
  assert.equal(reference.inputDigest,createHash('sha256').update(JSON.stringify(['plan-import-command-v1',canonicalCommand])).digest('hex'),'The persisted digest must identify the exact captured APPLY command without storing its contents');
 }else if(!legacyMode){
  assert.equal(reference.action,'UPLOAD');assert.match(reference.inputDigest,/^[a-f0-9]{64}$/);const source=readFileSync(sourceFile);
  assert.equal(reference.inputDigest,createHash('sha256').update(JSON.stringify(['plan-import-upload-command-v1',{action:'UPLOAD',consent:'plan-document-openai-v1',operationId:posts.at(-1).operationId.toLowerCase(),projectId,scope,source:{bytes:source.length,contentType:'application/pdf',sha256:createHash('sha256').update(source).digest('hex')}}])).digest('hex'),'The upload reference binds the exact selected file bytes, MIME, consent and command context');
 }
 assert.doesNotMatch(JSON.stringify(reference),/Fundaciones|synthetic-workspace-plan|Synthetic schedule fixture|Revisado con la fuente sintética|rows|reason|evidence|title|uncertainty|filename|synthetic-schedule\.pdf|sourceAvailable|token|authorization/i);
 assert.equal(await page.evaluate(({scope,projectId})=>sessionStorage.getItem('obrasaas-plan-attempt-v1:'+scope+':'+projectId),{scope,projectId}),null,'Legacy reference is removed only after the IDB commit');
 // Clearing session storage and reloading must retain the only durable reference.
 if(mode!=='global-same-mount'&&!explicitRetryMode&&!closeAfterCheck){await page.evaluate(()=>sessionStorage.clear());await page.reload({waitUntil:'networkidle0'});await waitText(page,'Empresa sintética de cronogramas');await openProject(page);await assertCount(page,applied?151:150);await waitText(page,'Intento pendiente de comprobación');}
 const expectedPosts=legacyMode?0:decisionMode?2:1;assert.equal(posts.length,expectedPosts);
 await assertPlanBlockingNavigation(page,posts);
 assert.equal(await page.$$eval('[data-plan-import] button',buttons=>buttons.some(button=>button.textContent==='Reintentar los mismos datos')),false,'A reload or an unqueried uncertain operation never authorizes a retry');
 if(expiryMode){
  await click(page,'Comprobar resultado');await page.waitForNetworkIdle({idleTime:100,timeout:10000});assert.deepEqual(await browserReferences(page),[reference]);assert.equal(await page.$$eval('[data-plan-import] button',buttons=>buttons.some(button=>button.textContent==='Reintentar los mismos datos')),false,'PROCESSING permits only another GET');
  for(const invalid of ['foreign','malformed','future']){invalidExpiry=invalid;await click(page,'Comprobar resultado');await page.waitForNetworkIdle({idleTime:100,timeout:10000});assert.deepEqual(await browserReferences(page),[reference]);assert.equal(posts.length,1);}
  const readsBeforeExpiry=workspaceQueries;leaseExpired=true;
  if(globalMode){await page.evaluate(()=>[...document.querySelectorAll('[data-plan-import] button')].find(button=>button.textContent==='Cerrar').click());await click(page,'Comprobar recibo');await waitText(page,'Venció el plazo de la extracción.');await click(page,'Importar PDF o imagen');}else{await click(page,'Comprobar resultado');await waitText(page,'Venció el plazo de este intento.');}
  await page.waitForFunction(()=>document.querySelector('[data-plan-import] input[type=file]')&&!document.querySelector('[data-plan-import] input[type=file]').disabled);assert.deepEqual(await browserReferences(page),[]);assert.equal(posts.length,1);assert.equal(workspaceQueries,readsBeforeExpiry,'Expiry never claims APPLY or refreshes canonical tasks');await assertCount(page,150);
  assert.equal(await page.$eval('[data-plan-import] input[type=file]',input=>input.value),'');assert.equal(await page.$eval('[data-plan-import] input[type=checkbox]',input=>input.checked),false);assert.equal(await page.$$eval('[data-plan-import] button',buttons=>buttons.find(button=>button.textContent==='Extraer borrador').disabled),true);
  await (await page.$('[data-plan-import] input[type=file]')).uploadFile(sourceFile);assert.equal(await page.$$eval('[data-plan-import] button',buttons=>buttons.find(button=>button.textContent==='Extraer borrador').disabled),true);await page.click('[data-plan-import] input[type=checkbox]');await click(page,'Extraer borrador');await waitText(page,'Compará cada fila con el archivo');assert.equal(posts.length,2);assert.notEqual(posts[0].operationId,posts[1].operationId);assert.deepEqual(await browserReferences(page),[]);await assertCount(page,150);
  checks.push({mode,width,posts:posts.length,recoveryReads:recoveryReads.length,durableJournal:true,explicitLeaseReplacement:true,workspaceReadsUnchangedOnExpiry:true});await context.close();return;
 }
 if(explicitRetryMode){
  denyRead=true;await click(page,'Comprobar resultado');await waitText(page,'Tu permiso actual no autoriza esta acción.');assert.equal(await page.$$eval('[data-plan-import] button',buttons=>buttons.some(button=>button.textContent==='Reintentar los mismos datos')),false);assert.equal(posts.length,expectedPosts);
  rejectRead=true;await click(page,'Comprobar resultado');await waitText(page,'El resultado todavía no pudo comprobarse');assert.equal(await page.$$eval('[data-plan-import] button',buttons=>buttons.some(button=>button.textContent==='Reintentar los mismos datos')),false);assert.deepEqual(await browserReferences(page),[reference]);
  await click(page,'Comprobar resultado');await waitText(page,'Esto no confirma que el envío se haya perdido');assert.equal(posts.length,expectedPosts);await click(page,'Reintentar los mismos datos');await waitText(page,decisionMode?'El total incluye las tareas del plan aplicado':'Borrador extraído.');assert.equal(posts.length,expectedPosts+1);assert.equal((await browserReferences(page)).length,0);await assertCount(page,decisionMode?151:150);
  assert.equal(await page.$$eval('[data-plan-import] button',buttons=>buttons.some(button=>button.textContent==='Reintentar los mismos datos')),false);await page.reload({waitUntil:'networkidle0'});await waitText(page,'Empresa sintética de cronogramas');await openProject(page);await assertCount(page,decisionMode?151:150);assert.equal(posts.length,expectedPosts+1);
  assert.equal(new Set(posts.map(post=>post.operationId)).size,decisionMode?2:1);checks.push({mode,width,posts:posts.length,uniqueOperations:new Set(posts.map(post=>post.operationId)).size,applications:decisionMode?1:0,recoveryReads:recoveryReads.length,durableJournal:true,exactExplicitRetry:true});await context.close();return;
 }
 if(closeAfterCheck){
  await click(page,'Comprobar resultado');await waitText(page,'Esto no confirma que el envío se haya perdido');await page.waitForFunction(()=>[...document.querySelectorAll('[data-plan-import] button')].some(button=>button.textContent==='Reintentar los mismos datos'&&!button.disabled));assert.equal(posts.length,1);
  await page.evaluate(()=>[...document.querySelectorAll('[data-plan-import] button')].find(button=>button.textContent==='Cerrar').click());await page.waitForFunction(()=>[...document.querySelectorAll('button')].find(button=>button.textContent==='Actualizar')?.disabled===false);assert.deepEqual(await browserReferences(page),[reference]);
  await click(page,'Importar PDF o imagen');await click(page,'Comprobar resultado');await waitText(page,'Esto no confirma que el envío se haya perdido');assert.equal(await page.$$eval('[data-plan-import] button',buttons=>buttons.some(button=>button.textContent==='Reintentar los mismos datos')),false);assert.equal(await page.$('[data-plan-import] input[type=file]'),null);
  await page.evaluate(()=>[...document.querySelectorAll('[data-plan-import] button')].find(button=>button.textContent==='Cerrar').click());await click(page,'Cambiar contexto del ensayo');await waitText(page,'Empresa del contexto B');await openProject(page,projectB);await assertCount(page,7,7);assert.ok(!await page.evaluate(id=>document.body.innerText.includes(id),reference.operationId));assert.deepEqual(await browserReferences(page),[reference]);
  await page.reload({waitUntil:'networkidle0'});await waitText(page,'Empresa sintética de cronogramas');await openProject(page);await click(page,'Comprobar resultado');await waitText(page,'Esto no confirma que el envío se haya perdido');assert.equal(await page.$$eval('[data-plan-import] button',buttons=>buttons.some(button=>button.textContent==='Reintentar los mismos datos')),false);assert.equal(posts.length,1);assert.deepEqual(await browserReferences(page),[reference]);
  checks.push({mode,width,posts:posts.length,recoveryReads:recoveryReads.length,durableJournal:true,ramDiscardedOnClose:true});await context.close();return;
 }
 if(globalMode||legacyConflict){
  if(legacyConflict){await page.evaluate(({scope,projectId,operationId})=>{sessionStorage.setItem('obrasaas-plan-attempt-v1:'+scope+':'+projectId,JSON.stringify({scope,projectId,operationId,kind:'UPLOAD'}));window.dispatchEvent(new Event('focus'));},{scope,projectId,operationId:legacyId});await waitText(page,'Hay un envío anterior sin confirmar');}
  if(mode!=='global-same-mount'){await page.evaluate(()=>[...document.querySelectorAll('[data-plan-import] button')].find(button=>button.textContent==='Cerrar').click());await page.waitForFunction(()=>![...document.querySelectorAll('[data-plan-import] button')].some(button=>button.textContent==='Comprobar resultado'));await page.waitForFunction(()=>[...document.querySelectorAll('button')].find(button=>button.textContent==='Actualizar')?.disabled===false);}
  resolved=true;await click(page,'Comprobar recibo');
  if(mode==='global-read-failure'){await waitText(page,'El plan tiene un recibo confirmado, pero no pudimos actualizar el cronograma');await assertCount(page,151);await click(page,'Volver a consultar el cronograma');}
  await waitText(page,'El total incluye las tareas del plan aplicado');await assertCount(page,151);assert.equal(posts.length,2);
  if(legacyConflict){
   await page.waitForFunction(id=>[...document.querySelectorAll('code')].some(element=>element.textContent===id),{},legacyId);const legacyReference=(await browserReferences(page))[0];assert.equal(legacyReference.operationId,legacyId);assert.equal(await page.evaluate(({scope,projectId})=>sessionStorage.getItem('obrasaas-plan-attempt-v1:'+scope+':'+projectId),{scope,projectId}),null);
   await click(page,'Importar PDF o imagen');await waitText(page,'Intento pendiente de comprobación');assert.equal(await page.$('[data-plan-import] input[type=file]'),null);await click(page,'Comprobar resultado');await waitText(page,'Esto no confirma que el envío se haya perdido');assert.deepEqual(await browserReferences(page),[legacyReference]);
  }else{assert.equal((await browserReferences(page)).length,0);assert.equal(await page.$$eval('[data-plan-import] button',buttons=>buttons.some(button=>button.textContent.startsWith('Aplicar ')&&!button.disabled)),false,'Global recovery must invalidate the old READY review in the mounted plan panel');}
 }else{
  denyRead=true;await click(page,'Comprobar resultado');await waitText(page,'Tu permiso actual no autoriza esta acción.');assert.deepEqual(await browserReferences(page),[reference]);
  await click(page,'Comprobar resultado');await waitText(page,'Esto no confirma que el envío se haya perdido');assert.deepEqual(await browserReferences(page),[reference]);
  await click(page,'Consultar borradores registrados');assert.deepEqual(await browserReferences(page),[reference]);assert.equal(await page.$('[data-plan-import] input[type=file]'),null,'Listing drafts cannot enable another upload');
  if(draft){await page.evaluate(()=>[...document.querySelectorAll('[data-plan-import] button')].find(button=>button.textContent.includes('· 2026-10-06')).click());await waitText(page,'La consulta no repite la IA ni resuelve el intento pendiente');assert.deepEqual(await browserReferences(page),[reference]);}
  await page.evaluate(()=>[...document.querySelectorAll('[data-plan-import] button')].find(button=>button.textContent==='Cerrar').click());
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].find(button=>button.textContent==='Actualizar')?.disabled===false);assert.deepEqual(await browserReferences(page),[reference]);
  await click(page,'Importar PDF o imagen');await waitText(page,'Intento pendiente de comprobación');assert.equal(await page.$('[data-plan-import] input[type=file]'),null);assert.equal(posts.length,expectedPosts);assert.equal(await page.$$eval('[data-plan-import] button',buttons=>buttons.some(button=>button.textContent==='Reintentar los mismos datos')),false,'Closing discards the RAM command while retaining its durable GET reference');
  if(mode==='decision-context-409'){
   await page.evaluate(()=>[...document.querySelectorAll('[data-plan-import] button')].find(button=>button.textContent==='Cerrar').click());await click(page,'Cambiar contexto del ensayo');await waitText(page,'Empresa del contexto B');await openProject(page,projectB);await assertCount(page,7,7);assert.ok(!await page.evaluate(id=>document.body.innerText.includes(id),reference.operationId));assert.deepEqual(await browserReferences(page),[reference]);
   await page.reload({waitUntil:'networkidle0'});await waitText(page,'Empresa sintética de cronogramas');await openProject(page);await assertCount(page,151);await waitText(page,'Intento pendiente de comprobación');
  }
  if(!legacyMode){resolved=true;await click(page,'Comprobar resultado');await waitText(page,decisionMode?'El total incluye las tareas del plan aplicado':'Borrador extraído.');assert.equal((await browserReferences(page)).length,0);}else assert.deepEqual(await browserReferences(page),[reference]);
 }
 assert.equal(posts.length,expectedPosts,'Only explicit initial POSTs may occur during all recovery, draft queries, close, permissions and reload actions');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow '+mode+' '+width);
 const stored=JSON.stringify(await browserReferences(page))+await page.evaluate(()=>JSON.stringify([Object.values(localStorage),Object.values(sessionStorage)]));assert.doesNotMatch(stored,/Fundaciones|synthetic-workspace-plan|Synthetic schedule fixture|Revisado con la fuente sintética|rows|reason|evidence|title|uncertainty|filename|synthetic-schedule\.pdf|sourceAvailable|token|authorization/i);
 checks.push({mode,width,applications:posts.filter(post=>post.action==='APPLY').length,posts:posts.length,recoveryReads:recoveryReads.length,durableJournal:true});await context.close();
}
try{
 for(let attempt=0;attempt<90;attempt++){try{if((await fetch(origin)).ok)break;}catch{}if(server.exitCode!==null)throw Error(log);await new Promise(resolve=>setTimeout(resolve,500));if(attempt===89)throw Error(log);}
 browser=await puppeteer.launch({headless:'shell',args:['--no-sandbox']});for(const width of widths){for(const mode of modes.filter(mode=>selectedModes.includes(mode)))await scenario(mode,width);for(const mode of closureModes.filter(mode=>selectedModes.includes(mode)))await recoveryClosureScenario(mode,width);}
 assert.deepEqual(errors,[]);
}catch(error){console.error(JSON.stringify({log,errors,checks}));throw error;}finally{
 await browser?.close();await stopHarnessServer();
 assert.ok(path.resolve(fixture).startsWith(path.resolve(evidence)+path.sep));rmSync(fixture,{recursive:true,force:true});
}
// A cleanup failure must exit nonzero without publishing a new successful proof.
writeFileSync(path.join(evidence,'workspace-plan-recovery-ui-validation.json'),JSON.stringify({validated:true,synthetic:true,checkedAt:new Date().toISOString(),fullSuite:selectedModes.length===modes.length+closureModes.length,selectedModes,realProviderCalls:false,physicalPhoneAccepted:false,widths,checks,sourceManifest,harnessSha256,serverClosedBeforeFixtureRemoval:true,fixtureRemoved:true},null,2)+'\n');
console.log(JSON.stringify({validated:true,synthetic:true,realProviderCalls:false,checks:checks.length}));
