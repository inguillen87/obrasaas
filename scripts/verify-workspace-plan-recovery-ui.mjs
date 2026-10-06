import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,mkdtempSync,copyFileSync,writeFileSync,rmSync,readdirSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import puppeteer from 'puppeteer';

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
for(const source of ['src/lib/geo.js','src/lib/field-media-privacy.mjs','src/lib/worker-channel-consent-policy.mjs','src/lib/whatsapp/tenant-workspace-policy.js']){
 const destination=path.join(fixture,source);mkdirSync(path.dirname(destination),{recursive:true});copyFileSync(path.join(root,source),destination);
 sourceManifest.push({path:source,sha256:createHash('sha256').update(readFileSync(destination)).digest('hex')});
}
const harnessSha256=createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex');
writeFileSync(path.join(fixture,'package.json'),JSON.stringify({name:'isolated-workspace-plan-recovery-ui',private:true}));
writeFileSync(path.join(fixture,'next.config.mjs'),`export default {devIndicators:false,turbopack:{root:${JSON.stringify(root)}}};`);
writeFileSync(path.join(app,'layout.js'),`export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:12,fontFamily:'Arial'}}>{children}</body></html>}`);
writeFileSync(path.join(app,'page.js'),`'use client';import {useCallback,useState} from 'react';import {AccountWorkspace} from './(identity)/cuenta/workspace-client';export default function Page(){const [context,setContext]=useState('A'),[visible,setVisible]=useState(true);const token=useCallback(async()=> 'synthetic-workspace-plan-'+context,[context]);return <main style={{maxWidth:1000,margin:'auto'}}><h2 id="onboarding-guide-title">Ensayo sintético de recuperación</h2><button onClick={()=>setContext('B')}>Cambiar contexto del ensayo</button><button onClick={()=>setVisible(false)}>Desmontar ensayo</button>{visible?<AccountWorkspace getSessionToken={token}/>:<p>Ensayo desmontado</p>}</main>}`);
const sourceFile=path.join(fixture,'synthetic-schedule.pdf');writeFileSync(sourceFile,'%PDF-1.7\nSynthetic schedule fixture\n%%EOF');
const port=3179,origin='http://127.0.0.1:'+port,server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',fixture,'--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'],windowsHide:true});
let log='',browser;for(const stream of [server.stdout,server.stderr])stream.on('data',data=>{log=(log+data).slice(-18000);});
const scope='a'.repeat(64),scopeB='b'.repeat(64),projectId='project-plan-A',projectB='project-plan-B';
const row={title:'Fundaciones importadas',startsOn:'2026-10-08',endsOn:'2026-10-10',evidence:'Fila sintética 1',uncertainty:''};
const importedTask={id:'z-imported',...row,status:'BACKLOG',progress:0,revision:'2026-10-06T00:00:00.000001'};
const existingTasks=Array.from({length:150},(_,index)=>({id:'existing-'+String(index+1).padStart(3,'0'),title:'Tarea registrada '+(index+1),status:'BACKLOG',progress:0,startsOn:'2026-10-01',endsOn:'2026-10-05',revision:'2026-10-05T00:00:00.000001'}));
const widths=[390,1280],modes=['apply','recover-after-reload','read-failure','scope-mismatch','project-mismatch','context-change-read','unmount-read','task-recover-existing','task-recover-after-reload'],checks=[],errors=[];
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
  await click(page,'Importar PDF o imagen');await waitText(page,'Autorizo enviar este cronograma a OpenAI');await (await page.$('[data-plan-import] input[type=file]')).uploadFile(sourceFile);await page.click('[data-plan-import] input[type=checkbox]');await click(page,'Extraer borrador');await waitText(page,'Compará cada fila con el archivo');await page.type('[data-plan-import] textarea','Revisado con la fuente sintética');await (await page.$$('[data-plan-import] input[type=checkbox]')).at(-1).click();await click(page,'Aplicar 1 tareas');
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
  await waitText(page,'Intento pendiente de comprobación');assert.equal(posts.length,2);assert.equal(applied,true);
  await page.reload({waitUntil:'networkidle0'});await waitText(page,'Empresa sintética de cronogramas');await openProject(page);await assertCount(page,151);await waitText(page,'Intento pendiente de comprobación');await click(page,'Comprobar resultado');await waitText(page,'Cronograma actualizado desde los registros de la obra');await assertCount(page,151);assert.equal(recoveryReads.length,1);
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
try{
 for(let attempt=0;attempt<90;attempt++){try{if((await fetch(origin)).ok)break;}catch{}if(server.exitCode!==null)throw Error(log);await new Promise(resolve=>setTimeout(resolve,500));if(attempt===89)throw Error(log);}
 browser=await puppeteer.launch({headless:true,args:['--no-sandbox']});for(const width of widths)for(const mode of modes)await scenario(mode,width);
 assert.deepEqual(errors,[]);writeFileSync(path.join(evidence,'workspace-plan-recovery-ui-validation.json'),JSON.stringify({validated:true,synthetic:true,realProviderCalls:false,widths,checks,sourceManifest,harnessSha256},null,2)+'\n');console.log(JSON.stringify({validated:true,synthetic:true,realProviderCalls:false,checks:checks.length}));
}catch(error){console.error(JSON.stringify({log,errors,checks}));throw error;}finally{await browser?.close();server.kill();assert.ok(path.resolve(fixture).startsWith(path.resolve(evidence)+path.sep));rmSync(fixture,{recursive:true,force:true});}
