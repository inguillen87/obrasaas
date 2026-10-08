import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,copyFileSync,writeFileSync,rmSync,readdirSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {spawn} from 'node:child_process';
import puppeteer from 'puppeteer';
import {projectPreparationSnapshot} from '../src/app/(identity)/cuenta/project-preparation-format.mjs';

// Browser-only acceptance of the real component with intercepted synthetic API
// responses. This is NOT proof of a production login, employee or WhatsApp event.
assert.ok(!process.env.VERCEL && !process.env.VERCEL_ENV);
assert.ok([undefined,'onboarding-epoch','guide-observation','guide-http-denial','portfolio-access-race'].includes(process.env.WORKSPACE_UI_SCENARIO));
const root=process.cwd(),evidence=path.join(root,'.vercel/workspace-evidence');
mkdirSync(evidence,{recursive:true});
const fixture=mkdtempSync(path.join(root,'.vercel/workspace-ui-')),app=path.join(fixture,'src/app'),components=path.join(app,'(identity)/cuenta');
mkdirSync(components,{recursive:true});mkdirSync(path.join(fixture,'src/lib'),{recursive:true});copyFileSync(path.join(root,'src/lib/worker-channel-consent-policy.mjs'),path.join(fixture,'src/lib/worker-channel-consent-policy.mjs'));
mkdirSync(path.join(fixture,'src/lib/whatsapp'),{recursive:true});copyFileSync(path.join(root,'src/lib/whatsapp/tenant-workspace-policy.js'),path.join(fixture,'src/lib/whatsapp/tenant-workspace-policy.js'));
const sourceManifest=[];
const entitlementPath='src/lib/company-entitlement.mjs';copyFileSync(path.join(root,entitlementPath),path.join(fixture,entitlementPath));assert.deepEqual(readFileSync(path.join(root,entitlementPath)),readFileSync(path.join(fixture,entitlementPath)));sourceManifest.push({path:entitlementPath,sha256:createHash('sha256').update(readFileSync(path.join(fixture,entitlementPath))).digest('hex')});
copyFileSync(path.join(root,'src/lib/geo.js'),path.join(fixture,'src/lib/geo.js'));
copyFileSync(path.join(root,'src/lib/field-media-privacy.mjs'),path.join(fixture,'src/lib/field-media-privacy.mjs'));
sourceManifest.push({path:'src/lib/geo.js',sha256:createHash('sha256').update(readFileSync(path.join(fixture,'src/lib/geo.js'))).digest('hex')});
for(const file of readdirSync(path.join(root,'src/app/(identity)/cuenta')).filter(name=>/\.(js|mjs|css)$/.test(name))){copyFileSync(path.join(root,'src/app/(identity)/cuenta',file),path.join(components,file));sourceManifest.push({path:'src/app/(identity)/cuenta/'+file,sha256:createHash('sha256').update(readFileSync(path.join(components,file))).digest('hex')});}
const phoneFormatPath='src/lib/company-phone-format.mjs';copyFileSync(path.join(root,phoneFormatPath),path.join(fixture,phoneFormatPath));assert.deepEqual(readFileSync(path.join(root,phoneFormatPath)),readFileSync(path.join(fixture,phoneFormatPath)));sourceManifest.push({path:phoneFormatPath,sha256:createHash('sha256').update(readFileSync(path.join(root,phoneFormatPath))).digest('hex')});
const harnessSha256=createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex');
for(const file of ["src/lib/whatsapp/tenant-workspace-policy.js","src/lib/worker-channel-consent-policy.mjs","src/lib/field-media-privacy.mjs"])sourceManifest.push({path:file,sha256:createHash('sha256').update(readFileSync(path.join(root,file))).digest('hex')});
for(const file of ['voice-progress-draft.mjs','progress-measurement-quantity.js']){const source='src/lib/'+file,destination=path.join(fixture,source);copyFileSync(path.join(root,source),destination);assert.deepEqual(readFileSync(path.join(root,source)),readFileSync(destination));sourceManifest.push({path:source,sha256:createHash('sha256').update(readFileSync(destination)).digest('hex')});}
assert.equal(new Set(sourceManifest.map(row=>row.path)).size,sourceManifest.length);
writeFileSync(path.join(fixture,'package.json'),JSON.stringify({name:'isolated-workspace-ui-fixture',private:true}));
writeFileSync(path.join(fixture,'next.config.mjs'),`export default {turbopack:{root:${JSON.stringify(root)}}};\n`);
writeFileSync(path.join(app,'layout.js'),`export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:16,background:'#0b1c2d',fontFamily:'Arial,sans-serif'}}>{children}</body></html>}`);
writeFileSync(path.join(app,'page.js'),`'use client';import {useCallback,useState} from 'react';import {OnboardingGuide} from './(identity)/cuenta/onboarding-guide';import {AccountWorkspace} from './(identity)/cuenta/workspace-client';import {browserRecoveryJournal} from './(identity)/cuenta/workspace-recovery-journal.mjs';const token=async()=>{if(window.__failNextToken){window.__failNextToken=false;throw new Error('private SDK diagnostic');}if(window.__holdToken)await new Promise(resolve=>{window.__resolveToken=resolve;});return 'synthetic-active-tab-A';};export default function Page(){const [visible,setVisible]=useState(true),[observation,setObservation]=useState(null);const observed=useCallback(value=>{window.__guideObservation=value;setObservation(value);},[]);if(typeof window!=='undefined')window.__prepareWorkspaceReference=body=>browserRecoveryJournal.prepare('/api/identity/task-creation',{method:'POST',body:JSON.stringify(body)});return <main style={{maxWidth:1000,margin:'0 auto'}}><OnboardingGuide orgId="org_fixture" orgRole="org:admin" observation={observation}/><button onClick={()=>setVisible(false)}>Desmontar ensayo</button>{visible?<AccountWorkspace getSessionToken={token} onGuideObservation={observed}/>:<p>Ensayo desmontado</p>}</main>}`);
const port=3108,origin='http://127.0.0.1:'+port;
const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',fixture,'--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
let serverLog='';for(const stream of [server.stdout,server.stderr])stream.on('data',value=>{serverLog=(serverLog+value.toString()).slice(-20000);});
let browser;const checks=[],pageErrors=[];
const scope='a'.repeat(64),revision='2026-09-30T12:00:00.123456';
const baseTask=()=>({id:'task-a',title:'Mampostería · sector norte',status:'IN_PROGRESS',progress:37,startsOn:'2026-10-01',endsOn:'2026-10-05',revision});
const text=page=>page.evaluate(()=>document.body.innerText);
async function click(page,label){const handle=await page.evaluateHandle(name=>[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===name),label);const element=handle.asElement();assert.ok(element,'Missing button '+label);await element.click();await handle.dispose();}
async function waitText(page,value){await page.waitForFunction(expected=>document.body.innerText.includes(expected),{timeout:15000},value);}
async function fill(page){
 await click(page,'Planificar fechas');
 await page.$eval('input[type="date"]',(element)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(element,'2026-10-07');element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}));});
 await page.$$eval('input[type="date"]',elements=>{const element=elements[1];Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(element,'2026-10-15');element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}));});
 await page.type('textarea','Reprogramación revisada en reunión de obra.');
}
async function scenario(mode,width=390){
 const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1000});
 page.on('pageerror',error=>pageErrors.push({mode,width,message:error.message}));
 const requests=[],posts=[];let record=null,applications=0,statusChecks=0;
 await page.setRequestInterception(true);
 page.on('request',async request=>{
  try{
   const url=new URL(request.url());
   if(url.origin!==origin){if(url.protocol==='data:'||url.protocol==='blob:')return request.continue();return request.abort();}
   if(url.pathname!=='/api/identity/workspace')return request.continue();
   assert.equal(request.headers().authorization,'Bearer synthetic-active-tab-A');
   requests.push({method:request.method(),query:url.search});
   let body,status=200;
   if(request.method()==='POST'){
    const payload=JSON.parse(request.postData());posts.push(payload);
    assert.equal(payload.scope,scope);assert.equal(payload.taskId,'task-a');assert.equal(payload.projectId,'p-a');assert.equal(payload.expectedRevision,revision);
    assert.equal(payload.startsOn,'2026-10-07');assert.equal(payload.endsOn,'2026-10-15');
    assert.deepEqual(Object.keys(payload).sort(),['operationId','projectId','taskId','scope','expectedRevision','startsOn','endsOn','reason'].sort());
    if(mode==='not-arrived'&&posts.length===1){await request.abort('failed');return;}
    else if(mode==='rollback'&&posts.length===1){status=503;body={code:'WORKSPACE_OPERATION_UNCONFIRMED',saved:false};}
    else if(mode==='conflict'){status=409;body={code:'SCHEDULE_REVISION_CHANGED',saved:false};record=null;}
    else {
     record={scope,saved:true,replayed:false,task:{...baseTask(),startsOn:payload.startsOn,endsOn:payload.endsOn,revision:'2026-10-01T12:00:00.111111'},receipt:{id:'workspace_schedule_'+ 'b'.repeat(64),taskId:'task-a',recordedAt:'2026-10-01T12:00:00.111111',before:{startsOn:'2026-10-01',endsOn:'2026-10-05'},after:{startsOn:payload.startsOn,endsOn:payload.endsOn}}};applications++;
     if(mode==='uncertain'){status=503;body={code:'WORKSPACE_OPERATION_UNCONFIRMED',saved:false};}else body=record;
    }
   }else if(url.searchParams.has('operationId')){
    statusChecks++;assert.equal(url.searchParams.get('operationId'),posts[0].operationId);body=record?{scope,state:'RECORDED',saved:true,receipt:record.receipt,task:record.task}:{scope,state:'NOT_OBSERVED',definitive:false};
   }else if(!url.search){
    if(mode==='denied'){status=403;body={code:'WORKSPACE_MEMBERSHIP_REQUIRED'};}
    else body={scope,organizationName:'Organización de prueba sintética',role:mode==='readonly'?'AUDITOR':'SITE_MANAGER',roleLabel:mode==='readonly'?'Auditor':'Jefe de obra',canPlanSchedule:mode!=='readonly',projects:[{id:'p-a',name:'Obra de prueba A'},...(['race','draft-cancel','rollback','not-arrived'].includes(mode)?[{id:'p-b',name:'Obra de prueba B'}]:[])],projectsTruncated:false};
   }else{
    const projectId=url.searchParams.get('projectId');assert.equal(url.searchParams.get('scope'),scope);
    if(mode==='race'&&projectId==='p-a')await new Promise(resolve=>setTimeout(resolve,600));
    body={scope,project:{id:projectId,name:projectId==='p-b'?'Obra de prueba B':'Obra de prueba A'},canPlanSchedule:mode!=='readonly',tasks:mode==='empty'?[]:[projectId==='p-b'?{...baseTask(),id:'task-b',title:'Tarea visible de la última obra'}:baseTask()],totalTasks:mode==='empty'?0:1,nextCursor:null};
   }
   await request.respond({status,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});
  }catch(error){if(!request.isInterceptResolutionHandled()){pageErrors.push({mode,width,message:error.message});await request.abort().catch(()=>{});}}
 });
 await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});
 if(mode==='denied'){await waitText(page,'pertenencia vigente');assert.equal(await page.$$eval('[data-task-id]',nodes=>nodes.length),0);checks.push('membership-denial-has-no-fake-data');await context.close();return;}
 await waitText(page,'Organización de prueba sintética');
 await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba A')).click());
 if(mode==='race'){
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba B')).click());
  await waitText(page,'Tarea visible de la última obra');await new Promise(resolve=>setTimeout(resolve,700));assert.ok(!(await text(page)).includes('Mampostería'));checks.push('stale-project-response-never-replaces-current-scope');await context.close();return;
 }
 if(mode==='empty'){await waitText(page,'no tiene tareas registradas');assert.equal(await page.$$eval('[data-task-id]',nodes=>nodes.length),0);checks.push('empty-project-does-not-create-tasks-or-gantt-bars');await context.close();return;}
 await waitText(page,'Mampostería');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Horizontal overflow at '+width);
 assert.ok((await text(page)).includes('37 %'));
 if(mode==='readonly'){assert.equal(await page.$$eval('button',nodes=>nodes.filter(node=>node.textContent==='Planificar fechas').length),0);checks.push('read-only-role-has-no-schedule-write-control');await context.close();return;}
 if(mode==='success')await page.screenshot({path:path.join(evidence,`workspace-${width}.png`),fullPage:true});
 await fill(page);assert.ok(await page.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>b.textContent==='Actualizar'||b.textContent.includes('Obra de prueba B')).every(b=>b.disabled)));assert.ok(await page.evaluate(()=>[...document.querySelectorAll('form input,form textarea')].every(e=>!e.disabled)));
 if(mode==='sdk-unavailable')await page.evaluate(()=>{window.__failNextToken=true;});
 if(mode==='unmount-token')await page.evaluate(()=>{window.__holdToken=true;});
 if(mode==='draft-cancel'){await click(page,'Cancelar');await page.waitForFunction(()=>!document.querySelector('form'));assert.ok(await page.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>b.textContent==='Actualizar'||b.textContent.includes('Obra de prueba B')).every(b=>!b.disabled)));assert.equal(posts.length,0);checks.push('schedule-draft-locks-project-and-refresh-until-explicit-cancel');await context.close();return;}
 await click(page,'Confirmar planificación');
 if(mode==='sdk-unavailable'){
  await waitText(page,'No se pudo renovar tu sesión');assert.equal(posts.length,0);
  assert.equal(await page.$eval('textarea',e=>e.value),'Reprogramación revisada en reunión de obra.');
  assert.ok(await page.evaluate(()=>[...document.querySelectorAll('form input,form textarea')].every(e=>!e.disabled)));
  assert.ok(!(await text(page)).includes('Comprobar guardado'));assert.ok(!(await text(page)).includes('private SDK diagnostic'));
  await click(page,'Confirmar planificación');await waitText(page,'Cambio confirmado');assert.equal(posts.length,1);
  checks.push('unsent-session-failure-preserves-editable-schedule-and-allows-explicit-retry');
 }else if(mode==='unmount-token'){
  await page.waitForFunction(()=>typeof window.__resolveToken==='function');await click(page,'Desmontar ensayo');await waitText(page,'Ensayo desmontado');
  await page.evaluate(()=>{window.__holdToken=false;window.__resolveToken();});await new Promise(resolve=>setTimeout(resolve,150));
  assert.equal(posts.length,0);await page.waitForFunction(()=>window.__guideObservation===null);assert.equal(await page.$eval('[data-guide-observation]',node=>node.dataset.guideObservation),'UNOBSERVED');checks.push('unmounted-schedule-never-dispatches-late-token-post');checks.push('unmounted-workspace-clears-guide-observation');await context.close();return;
 }else if(mode==='uncertain'){
  await waitText(page,'no confirmó el guardado');assert.equal(posts.length,1);
  assert.equal(await page.$$eval('button',nodes=>nodes.find(node=>node.textContent==='Actualizar').disabled),true);
  await click(page,'Comprobar guardado');await waitText(page,'Cambio confirmado');assert.equal(posts.length,1);checks.push('uncertain-save-recovers-receipt-without-reposting');
 }else if(['rollback','not-arrived'].includes(mode)){
  await waitText(page,'no confirmó el guardado');assert.equal(posts.length,1);assert.equal(applications,0);
  assert.ok(!(await text(page)).includes('Reintentar la misma planificación'));
  assert.ok(await page.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>b.textContent==='Actualizar'||b.textContent.includes('Obra de prueba B')).every(b=>b.disabled)));
  assert.ok(await page.evaluate(()=>[...document.querySelectorAll('form input,form textarea')].every(e=>e.disabled)));
  await click(page,'Comprobar guardado');await waitText(page,'No se observa un recibo todavía');assert.equal(posts.length,1);assert.equal(statusChecks,1);
  assert.ok(await page.$eval('textarea',e=>e.disabled));assert.equal(await page.$eval('textarea',e=>e.value),'Reprogramación revisada en reunión de obra.');
  if(mode==='rollback'){
   await page.evaluate(()=>{window.__failNextToken=true;});await click(page,'Reintentar la misma planificación');await waitText(page,'Conservamos el intento anterior');
   assert.equal(posts.length,1);assert.ok(await page.$eval('textarea',e=>e.disabled));assert.ok((await text(page)).includes('Comprobar guardado'));
   checks.push('unsent-retry-keeps-the-previous-uncertain-operation-and-original-draft');
  }
  await click(page,'Reintentar la misma planificación');await waitText(page,'Cambio confirmado');assert.equal(posts.length,2);assert.deepEqual(posts[1],posts[0]);assert.equal(applications,1);
  assert.ok((await text(page)).includes('37 %'));assert.ok((await text(page)).includes('2026-10-07 → 2026-10-15'));checks.push(mode+'-schedule-checked-then-exact-retry-once');
 }else if(mode==='conflict'){
  await waitText(page,'Otra persona modificó la tarea');assert.ok(!(await text(page)).includes('Cambio confirmado'));assert.equal(posts.length,1);checks.push('stale-revision-does-not-show-a-success-receipt');
 }else{
  await waitText(page,'Cambio confirmado');assert.ok((await text(page)).includes('2026-10-07 → 2026-10-15'));assert.ok((await text(page)).includes('37 %'));assert.equal(posts.length,1);checks.push('planned-dates-receipt-and-unchanged-progress-'+width);
 }
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Overflow after edit at '+width);
 assert.ok(requests.every(request=>['GET','POST'].includes(request.method)));
 await context.close();
}
async function navigationScenario(role,width){
 const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1000});
 page.on('pageerror',error=>pageErrors.push({mode:'navigation-'+role,width,message:error.message}));
 const requests=[],posts=[],administrator=role==='ADMIN';let preparationReads=0;
 await page.setRequestInterception(true);
 page.on('request',async request=>{
  try{
   const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();return request.abort();}
   if(!url.pathname.startsWith('/api/'))return request.continue();
   requests.push({method:request.method(),path:url.pathname,query:url.search});
   if(request.method()!=='GET'){posts.push(request.postData());throw new Error('Navigation must not mutate a business record');}
   assert.equal(request.headers().authorization,'Bearer synthetic-active-tab-A');
   if(url.pathname==='/api/identity/project-preparation'){
    assert.equal(administrator,true);assert.deepEqual([...url.searchParams.keys()].sort(),['projectId','scope']);assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),'p-a');assert.equal(++preparationReads,1);
    const body=projectPreparationSnapshot({scope,projectId:'p-a',canManage:true,revision:0,detailsDigest:'b'.repeat(64),name:'Obra de prueba A',clientName:'',address:'',teams:[],slots:[],startStatus:'TO_CONFIRM',declarationOnly:true},{scope,projectId:'p-a'});
    await request.respond({status:200,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});return;
   }
   assert.equal(url.pathname,'/api/identity/workspace');
   const tasks=Array.from({length:25},(_,index)=>index===0?baseTask():{...baseTask(),id:'task-nav-'+index,title:'Tarea de ensayo '+index});
   const body=!url.search?{scope,organizationName:'Empresa de ensayo de navegación',role,roleLabel:administrator?'Administrador':'Auditor',canManageIntegrations:administrator,canPlanSchedule:administrator,projects:[{id:'p-a',name:'Obra de prueba A'},{id:'p-b',name:'Obra de prueba B'}],projectsTruncated:false}:{scope,project:{id:'p-a',name:'Obra de prueba A'},canPlanSchedule:administrator,tasks,totalTasks:tasks.length,nextCursor:null};
   await request.respond({status:200,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});
  }catch(error){pageErrors.push({mode:'navigation-'+role,width,message:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}
 });
 await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await waitText(page,'Empresa de ensayo de navegación');
 await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba A')).click());
 await page.waitForSelector('nav[aria-labelledby="workspace-tools-title"]');
 const nav='nav[aria-labelledby="workspace-tools-title"]';
 if(administrator){await page.waitForFunction(()=>document.querySelector('section[aria-labelledby="project-preparation-title"]')?.getAttribute('aria-busy')==='false');assert.equal(preparationReads,1);}else{assert.equal(preparationReads,0);assert.equal(await page.$('section[aria-labelledby="project-preparation-title"]'),null);}
 const expected=['onboarding-guide-title','schedule-title','field-title','inventory-title','participant-title','worker-channel-title',...(administrator?['project-preparation-title','site-register-title','purchase-title','company-channel-title','customer-whatsapp-title','customer-meta-title','customer-inbox-title','template-send-title','constructor-crm-title','demo-pilot-title','operation-status-title']:[])];
 const anchors=await page.$$eval(nav+' a',elements=>elements.map(element=>element.hash.slice(1)));
 assert.deepEqual([...new Set(anchors)].sort(),expected.sort());
 assert.equal(await page.$eval(nav,element=>[...element.querySelectorAll('a')].every(link=>document.getElementById(link.hash.slice(1)))),true);
 const groups=await page.$$(nav+' details');for(const group of groups){assert.ok(await group.$eval('summary',element=>element.getBoundingClientRect().height>=44));if(!await group.evaluate(element=>element.open))await (await group.$('summary')).click();}
 const initialRequestCount=requests.length,initialFormCount=await page.$$eval('form',elements=>elements.length);
 for(const id of expected){await page.click(nav+' a[href="#'+id+'"]');assert.equal(await page.evaluate(()=>document.activeElement.id),id);assert.equal(await page.evaluate(()=>location.hash),'#'+id);}
 assert.equal(requests.length,initialRequestCount);assert.equal(posts.length,0);assert.equal(await page.$$eval('form',elements=>elements.length),initialFormCount);
 const keyboard=await page.$(nav+' a[href="#schedule-title"]');await keyboard.focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.activeElement.id),'schedule-title');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 checks.push('navigation-authorized-canonical-destinations-keyboard-no-requests-'+role+'-'+width);
 await (await page.$(nav)).screenshot({path:path.join(evidence,'workspace-navigation-'+role+'-'+width+'.png')});
 if(administrator){
  await click(page,'Planificar fechas');await page.waitForSelector('#schedule-edit-title');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'schedule-edit-title');
  const editorGeometry=await page.$eval('#schedule-edit-title',element=>{const rect=element.getBoundingClientRect();return {top:rect.top,bottom:rect.bottom,viewportHeight:innerHeight,scrollY};});
  await page.screenshot({path:path.join(evidence,'workspace-editor-opening-'+width+'.png'),fullPage:false});
  assert.ok(editorGeometry.top>=0&&editorGeometry.top<editorGeometry.viewportHeight,JSON.stringify(editorGeometry));
  await page.type('textarea','Planificación de ensayo que debe conservarse.');
  await page.click(nav+' a[href="#worker-channel-title"]');
  await page.click(nav+' a[href="#schedule-edit-title"]');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'schedule-edit-title');
  assert.equal(await page.$eval('textarea',element=>element.value),'Planificación de ensayo que debe conservarse.');
  assert.equal(requests.length,initialRequestCount);assert.equal(posts.length,0);
  assert.ok(await page.evaluate(()=>[...document.querySelectorAll('button')].filter(button=>button.textContent==='Actualizar'||button.textContent.includes('Obra de prueba B')).every(button=>button.disabled)));
  checks.push('long-schedule-editor-focus-and-pending-navigation-preserve-draft-'+width);
  await page.screenshot({path:path.join(evidence,'workspace-pending-editor-'+width+'.png'),fullPage:false});
  await (await page.$(nav)).screenshot({path:path.join(evidence,'workspace-pending-navigation-'+width+'.png')});
  await click(page,'Cancelar');await page.waitForFunction(()=>!document.querySelector('#schedule-edit-title'));
  assert.equal(await page.$(nav+' a[href="#schedule-edit-title"]'),null);
  assert.equal(posts.length,0);checks.push('cancel-clears-pending-navigation-without-mutation-'+width);
 }
 await context.close();
}
const workbenchControl={search:'input[aria-label="Buscar tareas"]',status:'select[aria-label="Estado de las tareas"]',planning:'select[aria-label="Planificación de las tareas"]',order:'select[aria-label="Orden de las tareas"]'};
const workbenchTasks=()=>[
 {...baseTask(),id:'wb-mamp-a',title:'Mampostería planta baja',progress:40,startsOn:'2026-10-05',endsOn:'2026-10-09'},
 {...baseTask(),id:'wb-mamp-b',title:'Mampostería sector norte',status:'BACKLOG',progress:0,startsOn:null,endsOn:null},
 {...baseTask(),id:'wb-finished',title:'Acabado de fachada',status:'DONE',progress:100,startsOn:'2026-10-01',endsOn:'2026-10-04'},
 {...baseTask(),id:'wb-invalid-dates',title:'Instalación eléctrica',status:'BLOCKED',progress:30,startsOn:'2026-10-09',endsOn:'2026-10-03'},
 {...baseTask(),id:'wb-unknown-status',title:'Revisión de estructura',status:'PAUSED_LEGACY',progress:45,startsOn:null,endsOn:null},
 {...baseTask(),id:'wb-invalid-progress',title:'Avance pendiente de revisión',progress:140,startsOn:'2026-10-11',endsOn:'2026-10-13'},
];
const workbenchTaskIds=page=>page.$$eval('[data-schedule-workbench] [data-task-id]',elements=>elements.map(element=>element.dataset.taskId));
async function waitWorkbenchTasks(page,expected){await page.waitForFunction(ids=>JSON.stringify([...document.querySelectorAll('[data-schedule-workbench] [data-task-id]')].map(element=>element.dataset.taskId))===JSON.stringify(ids),{timeout:15000},expected);}
async function searchWorkbench(page,value){await page.$eval(workbenchControl.search,element=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(element,'');element.dispatchEvent(new Event('input',{bubbles:true}));});if(value)await page.type(workbenchControl.search,value);}
async function workbenchScenario(width){
 const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1000,hasTouch:width<768});
 const mode='workbench';page.on('pageerror',error=>pageErrors.push({mode,width,message:error.message}));
 const requests=[],posts=[];let phase='initial-load';
 await page.setRequestInterception(true);
 page.on('request',async request=>{
  try{
   const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();return request.abort();}
   if(!url.pathname.startsWith('/api/'))return request.continue();
   requests.push({method:request.method(),path:url.pathname,query:url.search});
   if(request.method()!=='GET'){posts.push(request.postData());throw new Error('Schedule filters must not mutate a business record');}
   assert.equal(url.pathname,'/api/identity/workspace');assert.equal(request.headers().authorization,'Bearer synthetic-active-tab-A');
   let body;
   if(!url.search)body={scope,organizationName:'Empresa de ensayo del cronograma',role:'SITE_MANAGER',roleLabel:'Jefe de obra',canPlanSchedule:true,projects:[{id:'p-a',name:'Obra de prueba A'},{id:'p-b',name:'Obra de prueba B'}],projectsTruncated:false};
   else{
    assert.equal(url.searchParams.get('scope'),scope);assert.ok(!url.searchParams.has('operationId'));
    const projectId=url.searchParams.get('projectId'),cursor=url.searchParams.get('afterTask');
    assert.ok(['p-a','p-b'].includes(projectId));
    let tasks,totalTasks,nextCursor;
    if(projectId==='p-b'){assert.equal(cursor,null);tasks=[{...baseTask(),id:'wb-project-b',title:'Tarea propia de la obra B'}];totalTasks=3;nextCursor=null;}
    else if(cursor){
     assert.equal(cursor,'controlled-page-2');
     tasks=[{...workbenchTasks()[0],progress:41,revision:'2026-10-02T10:00:00.654321'},{...baseTask(),id:'wb-page-two-match',title:'Mampostería acceso',progress:15,startsOn:'2026-09-28',endsOn:'2026-10-02'},{...baseTask(),id:'wb-page-two-other',title:'Zanjeo del perímetro',status:'BACKLOG',progress:0,startsOn:'2026-10-15',endsOn:'2026-10-20'}];totalTasks=8;nextCursor=null;
    }else{tasks=workbenchTasks();totalTasks=8;nextCursor='controlled-page-2';}
    body={scope,project:{id:projectId,name:projectId==='p-a'?'Obra de prueba A':'Obra de prueba B'},canPlanSchedule:true,tasks,totalTasks,nextCursor};
   }
   await request.respond({status:200,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});
  }catch(error){pageErrors.push({mode,width,phase,message:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}
 });
 try{
  await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await waitText(page,'Empresa de ensayo del cronograma');
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba A')).click());
  await page.waitForSelector('[data-schedule-workbench]');await waitWorkbenchTasks(page,workbenchTasks().map(task=>task.id));
  const initialRequests=requests.length;
  const assertLocalControls=()=>{assert.equal(requests.length,initialRequests);assert.equal(posts.length,0);};
  assert.equal(await page.$eval(workbenchControl.search,element=>element.type),'search');
  for(const [control,values] of [['status',['ALL','BACKLOG','IN_PROGRESS','DONE','BLOCKED','UNRECOGNIZED']],['planning',['ALL','VALID','MISSING','INVALID']],['order',['REGISTERED','START_ASC','TITLE_ASC']]])assert.deepEqual((await page.$$eval(workbenchControl[control]+' option',elements=>elements.map(element=>element.value))).sort(),values.sort());
  await waitText(page,'Mostrando 6 de 6 tareas cargadas');
  const overview=await page.$eval('#schedule-overview-title',element=>element.parentElement.innerText);
  assert.match(overview,/parcial/i);assert.match(await page.$eval('[data-schedule-workbench]',element=>element.innerText),/tareas cargadas/i);
  assert.ok(!/avance (?:global|promedio)|promedio de avance/i.test(await text(page)));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Initial workbench overflow at '+width);
  await (await page.$('[data-schedule-workbench]')).screenshot({path:path.join(evidence,'workspace-workbench-'+width+'.png')});
  checks.push('workbench-partial-loaded-summary-and-accessible-controls-'+width);

  phase='accent-and-combined-filters';await searchWorkbench(page,'mamposteria');await waitWorkbenchTasks(page,['wb-mamp-a','wb-mamp-b']);
  await page.select(workbenchControl.status,'IN_PROGRESS');await page.select(workbenchControl.planning,'VALID');await waitWorkbenchTasks(page,['wb-mamp-a']);
  await page.select(workbenchControl.order,'START_ASC');assertLocalControls();await waitText(page,'Mostrando 1 de 6 tareas cargadas');
  checks.push('workbench-accent-insensitive-search-combined-filters-no-requests-'+width);

  phase='no-matches-and-keyboard-clear';await searchWorkbench(page,'tarea que no existe');await waitWorkbenchTasks(page,[]);await waitText(page,'Mostrando 0 de 6 tareas cargadas');
  await page.evaluate(()=>[...document.querySelectorAll('[data-schedule-workbench] button')].find(button=>button.textContent.trim()==='Limpiar filtros').focus());await page.keyboard.press('Enter');
  await waitWorkbenchTasks(page,workbenchTasks().map(task=>task.id));
  assert.equal(await page.$eval(workbenchControl.search,element=>element.value),'');
  for(const [control,value] of [['status','ALL'],['planning','ALL'],['order','REGISTERED']])assert.equal(await page.$eval(workbenchControl[control],element=>element.value),value);
  assertLocalControls();checks.push('workbench-no-matches-keyboard-clear-restores-loaded-tasks-'+width);

  phase='invalid-data';await page.select(workbenchControl.planning,'INVALID');await waitWorkbenchTasks(page,['wb-invalid-dates']);assert.match(await page.$eval('[data-task-id="wb-invalid-dates"]',element=>element.innerText),/Fechas para revisar/);
  await page.select(workbenchControl.planning,'MISSING');await waitWorkbenchTasks(page,['wb-mamp-b','wb-unknown-status']);
  await page.select(workbenchControl.status,'UNRECOGNIZED');await waitWorkbenchTasks(page,['wb-unknown-status']);
  await click(page,'Limpiar filtros');await waitWorkbenchTasks(page,workbenchTasks().map(task=>task.id));
  const invalidProgress=await page.$eval('[data-task-id="wb-invalid-progress"]',element=>({text:element.innerText,bars:element.querySelectorAll('[role="progressbar"]').length}));
  assert.match(invalidProgress.text,/Requiere revisión/);assert.ok(!invalidProgress.text.includes('140 %'));assert.equal(invalidProgress.bars,0);
  assert.match(await page.$eval('[data-schedule-workbench]',element=>element.innerText),/Datos para revisar:/);assertLocalControls();
  checks.push('workbench-invalid-dates-status-and-progress-require-review-'+width);

  phase='ordering';await page.select(workbenchControl.order,'TITLE_ASC');await waitWorkbenchTasks(page,['wb-finished','wb-invalid-progress','wb-invalid-dates','wb-mamp-a','wb-mamp-b','wb-unknown-status']);
  await page.select(workbenchControl.order,'START_ASC');await waitWorkbenchTasks(page,['wb-finished','wb-mamp-a','wb-invalid-progress','wb-mamp-b','wb-invalid-dates','wb-unknown-status']);
  assertLocalControls();checks.push('workbench-local-title-and-valid-start-date-order-'+width);

  phase='draft-preserved';await page.click('[data-task-id="wb-mamp-a"] button');await page.waitForSelector('#schedule-edit-title');
  await page.type('textarea','Borrador de fechas conservado al filtrar el cronograma.');
  const draftDates=await page.$$eval('form input[type="date"]',elements=>elements.map(element=>element.value));
  await page.select(workbenchControl.status,'DONE');await page.select(workbenchControl.planning,'VALID');await page.select(workbenchControl.order,'TITLE_ASC');await searchWorkbench(page,'acabado');await waitWorkbenchTasks(page,['wb-finished']);
  assert.equal(await page.$eval('textarea',element=>element.value),'Borrador de fechas conservado al filtrar el cronograma.');assert.deepEqual(await page.$$eval('form input[type="date"]',elements=>elements.map(element=>element.value)),draftDates);
  assert.ok(await page.$('#schedule-edit-title'));assert.equal(await page.$('[data-task-id="wb-mamp-a"]'),null);assertLocalControls();
  assert.ok(await page.evaluate(()=>[...document.querySelectorAll('button')].filter(button=>button.textContent==='Actualizar'||button.textContent.includes('Obra de prueba B')).every(button=>button.disabled)));
  checks.push('workbench-filter-hidden-card-preserves-root-schedule-draft-'+width);
  await page.screenshot({path:path.join(evidence,'workspace-workbench-draft-'+width+'.png'),fullPage:false});await click(page,'Cancelar');await page.waitForFunction(()=>!document.querySelector('#schedule-edit-title'));

  phase='pagination-with-filters';await click(page,'Limpiar filtros');await searchWorkbench(page,'mamposteria');await page.select(workbenchControl.status,'IN_PROGRESS');await page.select(workbenchControl.planning,'VALID');await page.select(workbenchControl.order,'START_ASC');await waitWorkbenchTasks(page,['wb-mamp-a']);assertLocalControls();
  await click(page,'Cargar más tareas');await waitWorkbenchTasks(page,['wb-page-two-match','wb-mamp-a']);
  assert.equal(requests.length,initialRequests+1);assert.equal(new URL(origin+requests.at(-1).path+requests.at(-1).query).searchParams.get('afterTask'),'controlled-page-2');assert.equal(posts.length,0);
  assert.equal(await page.$eval(workbenchControl.search,element=>element.value),'mamposteria');for(const [control,value] of [['status','IN_PROGRESS'],['planning','VALID'],['order','START_ASC']])assert.equal(await page.$eval(workbenchControl[control],element=>element.value),value);
  await waitText(page,'Mostrando 2 de 8 tareas cargadas');assert.equal(await page.$$eval('[data-task-id="wb-mamp-a"]',elements=>elements.length),1);assert.match(await page.$eval('[data-task-id="wb-mamp-a"]',element=>element.innerText),/41 %/);
  await click(page,'Limpiar filtros');assert.equal((await workbenchTaskIds(page)).length,8);assert.equal(new Set(await workbenchTaskIds(page)).size,8);assert.equal(requests.length,initialRequests+1);
  checks.push('workbench-pagination-keeps-filters-and-merges-canonical-task-id-'+width);

  phase='project-reset';await searchWorkbench(page,'mamposteria');await page.select(workbenchControl.status,'IN_PROGRESS');await page.select(workbenchControl.planning,'VALID');await page.select(workbenchControl.order,'TITLE_ASC');
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba B')).click());await waitWorkbenchTasks(page,['wb-project-b']);
  assert.equal(requests.length,initialRequests+2);assert.equal(new URL(origin+requests.at(-1).path+requests.at(-1).query).searchParams.get('projectId'),'p-b');assert.equal(posts.length,0);assert.equal(await page.$eval(workbenchControl.search,element=>element.value),'');
  for(const [control,value] of [['status','ALL'],['planning','ALL'],['order','REGISTERED']])assert.equal(await page.$eval(workbenchControl[control],element=>element.value),value);
  await waitText(page,'Mostrando 1 de 1 tareas cargadas');assert.match(await page.$eval('#schedule-overview-title',element=>element.parentElement.innerText),/parcial/i);
  assert.equal(await page.$$eval('button',elements=>elements.filter(element=>element.textContent.trim()==='Cargar más tareas').length),0);
  const partialResult=await page.$eval('[data-schedule-workbench] [role="status"]',element=>element.innerText);assert.ok(!partialResult.includes('Podés cargar más'));assert.ok(partialResult.includes('Actualizá la consulta y volvé a abrir la obra para comprobar el total.'));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Final workbench overflow at '+width);
  const targets=await page.$$eval('[data-schedule-workbench] input,[data-schedule-workbench] select,[data-schedule-workbench] button',elements=>elements.map(element=>({label:element.getAttribute('aria-label')||element.textContent.trim(),height:element.getBoundingClientRect().height,width:element.getBoundingClientRect().width})));assert.ok(targets.length>=5);assert.ok(targets.every(target=>target.height>=44&&target.width>=44),JSON.stringify(targets));
  checks.push('workbench-project-reset-partial-total-and-touch-targets-'+width);
  await (await page.$('[data-schedule-workbench]')).screenshot({path:path.join(evidence,'workspace-workbench-project-b-'+width+'.png')});
 }catch(error){
  await page.screenshot({path:path.join(evidence,'workspace-workbench-failure-'+width+'.png'),fullPage:false}).catch(()=>{});
  writeFileSync(path.join(evidence,'workspace-workbench-failure-'+width+'.json'),JSON.stringify({status:'FAILED',phase,width,message:error.message,requests,postCount:posts.length,body:await text(page).catch(()=>null)},null,2));throw error;
 }finally{await context.close();}
}
async function taskCreateScenario(mode){
 const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width:390,height:1000});page.on('pageerror',error=>pageErrors.push({mode:'taskcreate-'+mode,width:390,message:error.message}));
 const posts=[];let record=null,applications=0,statusChecks=0,scheduleReadsAfterCommit=0;await page.setRequestInterception(true);
 page.on('request',async request=>{
  try{
   const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();return request.abort();}
   if(!['/api/identity/workspace','/api/identity/task-creation'].includes(url.pathname))return request.continue();assert.equal(request.headers().authorization,'Bearer synthetic-active-tab-A');let status=200,body;
   if(url.pathname==='/api/identity/workspace'){
    if(!url.search)body={scope,organizationName:'Organización de prueba sintética',role:'SITE_MANAGER',roleLabel:'Jefe de obra',canPlanSchedule:true,projects:[{id:'p-a',name:'Obra de prueba A'},{id:'p-b',name:'Obra de prueba B'}],projectsTruncated:false};
    else {assert.equal(url.searchParams.get('projectId'),'p-a');if(record)scheduleReadsAfterCommit++;body={scope,project:{id:'p-a',name:'Obra de prueba A'},canPlanSchedule:true,tasks:record?[baseTask(),record.task]:[baseTask()],totalTasks:record?2:1,nextCursor:null};}
   }else if(request.method()==='POST'){
    const input=JSON.parse(request.postData());posts.push(input);assert.deepEqual(Object.keys(input).sort(),['operationId','projectId','scope','title','startsOn','endsOn'].sort());assert.equal(input.projectId,'p-a');assert.equal(input.scope,scope);assert.equal(input.title,'Tarea de ensayo recuperable');assert.equal(input.startsOn,'');assert.equal(input.endsOn,'');
    if(mode==='not-arrived'&&posts.length===1){await request.abort('failed');return;}
    else if(mode==='rollback'&&posts.length===1){status=503;body={code:'WORKSPACE_OPERATION_UNCONFIRMED'};}
    else {applications++;record={scope,created:true,replayed:false,receiptId:'workspace_new_task_'+input.operationId,task:{id:'new-task',title:input.title,status:'BACKLOG',progress:0,startsOn:null,endsOn:null,revision:'2026-10-01T12:00:00.111111'}};body=record;if(mode==='uncertain'){status=503;body={code:'WORKSPACE_OPERATION_UNCONFIRMED'};}}
   }else {statusChecks++;assert.equal(url.searchParams.get('operationId'),posts[0].operationId);body=record?{...record,state:'RECORDED'}:{scope,state:'NOT_OBSERVED',definitive:false};}
   await request.respond({status,contentType:'application/json',body:JSON.stringify(body),headers:{'Cache-Control':'no-store'}});
  }catch(error){pageErrors.push({mode:'taskcreate-'+mode,message:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}
 });
 await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await waitText(page,'Organización de prueba sintética');await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Obra de prueba A')).click());await waitText(page,'Mampostería');await click(page,'Nueva tarea');await page.type('form input:not([type="date"])','Tarea de ensayo recuperable');assert.ok(await page.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>b.textContent==='Actualizar'||b.textContent.includes('Obra de prueba B')||b.textContent==='Planificar fechas').every(b=>b.disabled)));assert.ok(await page.evaluate(()=>[...document.querySelectorAll('form input')].every(e=>!e.disabled)));
 if(mode==='draft-cancel'){await click(page,'Cancelar');await page.waitForFunction(()=>!document.querySelector('form')&&[...document.querySelectorAll('button')].filter(b=>b.textContent==='Actualizar'||b.textContent.includes('Obra de prueba B')||b.textContent==='Planificar fechas').every(b=>!b.disabled));assert.equal(posts.length,0);checks.push('taskcreate-draft-locks-project-and-refresh-until-explicit-cancel');await context.close();return;}
 await click(page,'Crear tarea');await waitText(page,'La confirmación no llegó');assert.equal(posts.length,1);
 assert.ok(!(await text(page)).includes('Reintentar la misma creación'));
 assert.ok(await page.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>b.textContent==='Actualizar'||b.textContent.includes('Obra de prueba B')||b.textContent==='Planificar fechas').every(b=>b.disabled)));
 assert.ok(await page.evaluate(()=>[...document.querySelectorAll('form input')].every(e=>e.disabled)));await click(page,'Comprobar tarea');
 if(mode==='uncertain'){await waitText(page,'Tarea creada y vinculada');assert.equal(posts.length,1);checks.push('taskcreate-uncertain-commit-recovers-without-second-post');}
 else {await waitText(page,'No se observa un recibo todavía');assert.equal(posts.length,1);assert.equal(await page.$eval('form input',e=>e.value),'Tarea de ensayo recuperable');assert.ok(await page.$eval('form input',e=>e.disabled));await click(page,'Reintentar la misma creación');await waitText(page,'Tarea creada y vinculada');assert.equal(posts.length,2);assert.deepEqual(posts[1],posts[0]);checks.push('taskcreate-'+mode+'-checked-then-exact-retry-once');}
 await page.waitForSelector('[data-task-id="new-task"]');assert.equal(statusChecks,1);assert.equal(applications,1);assert.equal(scheduleReadsAfterCommit,1);assert.equal(await page.$$eval('[data-task-id="new-task"]',nodes=>nodes.length),1);assert.ok((await text(page)).includes('Mostrando 2 de 2 tareas cargadas'));
 const createdProgress=await page.$eval('[data-task-id="new-task"]',element=>({text:element.innerText.replace(/\s+/g,' '),bars:[...element.querySelectorAll('[role="progressbar"]')].map(bar=>bar.getAttribute('aria-valuenow'))}));assert.ok(createdProgress.text.includes('Avance registrado: 0 %'));assert.deepEqual(createdProgress.bars,['0']);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await context.close();
}
async function stalePaginationScenario(){
 const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width:390,height:1000});
 page.on('pageerror',error=>pageErrors.push({mode:'stale-pagination',width:390,message:error.message}));
 const beforeRevision='2026-10-02T09:00:00.000001',afterRevision='2026-10-02T09:00:00.000002',original={...baseTask(),revision:beforeRevision},posts=[],requests=[];
 let heldPage;const paginationStarted=new Promise(resolve=>{heldPage={resolve,request:null};});
 await page.setRequestInterception(true);
 page.on('request',async request=>{
  try{
   const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();return request.abort();}
   if(!url.pathname.startsWith('/api/'))return request.continue();assert.equal(url.pathname,'/api/identity/workspace');assert.equal(request.headers().authorization,'Bearer synthetic-active-tab-A');requests.push({method:request.method(),query:url.search});let body;
   if(request.method()==='POST'){
    const payload=JSON.parse(request.postData());posts.push(payload);assert.equal(posts.length,1);assert.equal(payload.scope,scope);assert.equal(payload.projectId,'p-a');assert.equal(payload.taskId,original.id);assert.equal(payload.expectedRevision,beforeRevision);assert.equal(payload.startsOn,'2026-10-07');assert.equal(payload.endsOn,'2026-10-15');
    body={scope,saved:true,replayed:false,task:{...original,startsOn:payload.startsOn,endsOn:payload.endsOn,revision:afterRevision},receipt:{id:'workspace_schedule_'+ 'c'.repeat(64),taskId:original.id,recordedAt:afterRevision,before:{startsOn:original.startsOn,endsOn:original.endsOn},after:{startsOn:payload.startsOn,endsOn:payload.endsOn}}};
   }else if(!url.search)body={scope,organizationName:'Empresa de ensayo de página tardía',role:'SITE_MANAGER',roleLabel:'Jefe de obra',canPlanSchedule:true,projects:[{id:'p-a',name:'Obra de prueba A'}],projectsTruncated:false};
   else{
    assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),'p-a');
    if(url.searchParams.has('afterTask')){assert.equal(url.searchParams.get('afterTask'),'held-page');heldPage.request=request;heldPage.resolve();return;}
    body={scope,project:{id:'p-a',name:'Obra de prueba A'},canPlanSchedule:true,tasks:[original],totalTasks:2,nextCursor:'held-page'};
   }
   await request.respond({status:200,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});
  }catch(error){pageErrors.push({mode:'stale-pagination',width:390,message:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}
 });
 try{
  await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await waitText(page,'Empresa de ensayo de página tardía');await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba A')).click());await page.waitForSelector('[data-task-id="task-a"]');
  await click(page,'Cargar más tareas');await paginationStarted;await fill(page);await click(page,'Confirmar planificación');await waitText(page,'Cambio confirmado');assert.equal(posts.length,1);
  await heldPage.request.respond({status:200,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify({scope,project:{id:'p-a',name:'Obra de prueba A'},canPlanSchedule:true,tasks:[original,{...original,id:'late-page-task',title:'Tarea añadida por la página tardía'}],totalTasks:2,nextCursor:null})});
  await page.waitForSelector('[data-task-id="late-page-task"]');assert.equal(await page.$$eval('[data-task-id="task-a"]',elements=>elements.length),1);
  assert.deepEqual(await page.$$eval('[data-task-id="task-a"] time',elements=>elements.map(element=>element.dateTime)),['2026-10-07','2026-10-15']);
  assert.equal(await page.$eval('[data-task-id="task-a"] [role="progressbar"]',element=>element.getAttribute('aria-valuenow')),'37');assert.ok((await text(page)).includes('2026-10-07 → 2026-10-15'));assert.ok((await text(page)).includes('Cambio confirmado'));assert.equal(posts.length,1);assert.equal(requests.filter(request=>request.method==='GET').length,3);
  await (await page.$('section[aria-labelledby="schedule-title"]')).screenshot({path:path.join(evidence,'workspace-workbench-stale-page-390.png')});checks.push('workbench-late-cursor-page-preserves-confirmed-newer-schedule-and-receipt-390');
 }catch(error){await page.screenshot({path:path.join(evidence,'workspace-workbench-stale-page-failure-390.png'),fullPage:false}).catch(()=>{});throw error;}
 finally{if(heldPage.request&&!heldPage.request.isInterceptResolutionHandled())await heldPage.request.abort().catch(()=>{});await context.close();}
}

async function onboardingEpochScenario(width){
 const mode='onboarding-epoch',context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1100,hasTouch:width<768,isMobile:width<768});page.on('pageerror',error=>pageErrors.push({mode,width,message:error.message}));
 const posts=[],queries=[];let workspaceReads=0,channelReads=0,heldChannel;let channelStarted;const channelGate=new Promise(resolve=>{channelStarted=resolve;});
 const participant={id:'worker-self',name:'Persona propia',active:true,revision,status:'ACTIVE',self:true,accountLinked:true,invitation:null,permissions:{attendance:true,report:true},kyc:{status:'APPROVED',submissionId:null,images:[]}},channel=()=>({scope,projectId:'p-a',channelReady:true,records:[{workerId:participant.id,name:participant.name,phone:'+15550001001',connectionNumber:'+15550002002',revision,state:'VERIFIED',eligible:true,challenge:null,binding:{id:'binding-'+channelReads,verifiedAt:'2026-10-01T12:00:00.000Z',revokedAt:null}}]});
 await page.setRequestInterception(true);page.on('request',async request=>{try{const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();throw Error('External request forbidden');}if(!url.pathname.startsWith('/api/identity/'))return request.continue();assert.equal(request.headers().authorization,'Bearer synthetic-active-tab-A');if(request.method()==='POST'){posts.push(request.postData());throw Error('Onboarding epoch scenario permits GET only');}queries.push({path:url.pathname,query:url.search});let body;
  if(url.pathname==='/api/identity/workspace'){if(!url.search)body={scope,organizationName:'Empresa de epoch sint\u00e9tico',role:'SITE_MANAGER',roleLabel:'Jefe de obra',canPlanSchedule:false,canManageIntegrations:false,projects:[{id:'p-a',name:'Obra de prueba A'}],projectsTruncated:false};else{assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),'p-a');workspaceReads++;body={scope,project:{id:'p-a',name:'Obra de prueba A'},canPlanSchedule:false,tasks:[baseTask(),...(workspaceReads>1?[{...baseTask(),id:'task-second',title:'Segunda tarea can\u00f3nica'}]:[])],totalTasks:2,nextCursor:workspaceReads===1?'synthetic-task-cursor':null};}}
  else if(url.pathname==='/api/identity/participants')body={scope,projectId:'p-a',canManage:false,canInvite:false,canManageOfficeRoles:false,existingAccounts:[],records:[participant],privacyNotice:{version:'fixture-notice',text:'Ensayo sin documentos'}};
  else if(url.pathname==='/api/identity/worker-channel'){assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),'p-a');channelReads++;if(channelReads===2){heldChannel=request;channelStarted();return;}body=channel();}
  else if(url.pathname==='/api/identity/task-creation'){assert.equal(url.searchParams.get('operationId'),'11111111-1111-4111-8111-111111111111');assert.equal(url.searchParams.get('projectId'),'p-a');assert.equal(url.searchParams.get('scope'),scope);body={scope,projectId:'p-a',state:'RECORDED',saved:true,created:true,receiptId:'task-recovery-fixture',task:baseTask()};}
  else throw Error('Unexpected synthetic identity endpoint');await request.respond({status:200,contentType:'application/json',body:JSON.stringify(body)});
 }catch(error){pageErrors.push({mode,width,message:error.message});await request.abort().catch(()=>{});}});
 try{await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});assert.equal(await page.evaluate(()=>innerWidth),width);await waitText(page,'Empresa de epoch sint\u00e9tico');await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba A')).click());await page.waitForSelector('[data-task-id="task-a"]');await click(page,'Consultar participantes');await page.waitForSelector('[data-onboarding-step="CHANNEL_UNOBSERVED"]');await click(page,'Consultar vinculaci\u00f3n');await page.waitForSelector('[data-onboarding-step="CHANNEL_VERIFIED"]');assert.equal(await page.$$eval('a[href^="https://wa.me/"]',els=>els.length),1);await page.waitForFunction(()=>document.querySelector('[data-guide-observation="OBSERVED"]')?.textContent.includes('Tu vínculo personal está vigente'));assert.match(await guideStatus(page),/1 tarea cargada de 2.*Vista parcial/s);
  await click(page,'Cargar m\u00e1s tareas');await page.waitForSelector('[data-task-id="task-second"]');await page.waitForSelector('[data-onboarding-step="CHANNEL_UNOBSERVED"]');assert.equal(channelReads,1);assert.equal(await page.$$eval('a[href^="https://wa.me/"]',els=>els.length),0);assert.ok(!(await guideStatus(page)).includes('Tu vínculo personal está vigente'));assert.match(await guideStatus(page),/2 tareas cargadas de 2.*Vista completa/s);
  await page.evaluate(async body=>{await window.__prepareWorkspaceReference(body);},{scope,projectId:'p-a',operationId:'11111111-1111-4111-8111-111111111111'});await waitText(page,'Operaciones por comprobar');await click(page,'Consultar vinculaci\u00f3n');await channelGate;await click(page,'Comprobar recibo');await page.waitForFunction(()=>document.body.innerText.includes('Cronograma actualizado desde los registros'));assert.equal(workspaceReads,3);
  const oldBody=channel();await heldChannel.respond({status:200,contentType:'application/json',body:JSON.stringify(oldBody)});heldChannel=null;await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.textContent==='Consultar vinculaci\u00f3n'&&!button.disabled));assert.equal(await page.$eval('[data-onboarding-step]',el=>el.dataset.onboardingStep),'CHANNEL_UNOBSERVED');assert.equal(await page.$$eval('a[href^="https://wa.me/"]',els=>els.length),0);assert.equal(channelReads,2);assert.ok(!(await guideStatus(page)).includes('Tu vínculo personal está vigente'));
  await click(page,'Consultar vinculaci\u00f3n');await page.waitForSelector('[data-onboarding-step="CHANNEL_VERIFIED"]');assert.equal(channelReads,3);assert.equal(await page.$$eval('a[href^="https://wa.me/"]',els=>els.length),1);assert.equal(posts.length,0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(evidence,`workspace-onboarding-epoch-${width}.png`),fullPage:true});checks.push({mode,width,workspaceReads,channelReads,posts:posts.length,appendInvalidates:true,lateSnapshotRejected:true,freshExplicitReadRequired:true});
 }finally{if(heldChannel&&!heldChannel.isInterceptResolutionHandled())await heldChannel.abort().catch(()=>{});await context.close();}
}

const guideStatus=page=>page.$eval('[data-guide-observation]',node=>node.textContent);
async function guideObservationScenario(width){
 const mode='guide-observation',context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1100,hasTouch:width<768,isMobile:width<768});page.on('pageerror',error=>pageErrors.push({mode,width,message:error.message}));
 const requests=[],posts=[];let failureStatus=null,currentScope=scope,role='SITE_MANAGER',projectReads=0;
 await page.setRequestInterception(true);page.on('request',async request=>{try{const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();throw Error('External request forbidden');}if(!url.pathname.startsWith('/api/identity/'))return request.continue();requests.push({path:url.pathname,method:request.method()});assert.equal(request.headers().authorization,'Bearer synthetic-active-tab-A');if(request.method()!=='GET'){posts.push(request.postData());throw Error('Guide scenario permits GET only');}let status=200,body;
  if(url.pathname==='/api/identity/workspace'){
   if(!url.search)body={scope:currentScope,organizationName:'Empresa de guía sintética',role,roleLabel:role==='SITE_MANAGER'?'Jefe de obra':'Auditor',canPlanSchedule:false,canManageIntegrations:false,projects:[{id:'p-a',name:'Obra de prueba A'},{id:'p-b',name:'Obra de prueba B'}],projectsTruncated:false};
   else{assert.equal(url.searchParams.get('scope'),currentScope);const id=url.searchParams.get('projectId');projectReads++;if(failureStatus){status=failureStatus;failureStatus=null;body={code:status===401?'SESSION_REQUIRED':status===403?'WORKSPACE_MEMBERSHIP_REQUIRED':'WORKSPACE_OPERATION_UNCONFIRMED'};}else body={scope:currentScope,project:{id,name:id==='p-a'?'Obra de prueba A':'Obra de prueba B'},canPlanSchedule:false,tasks:[{...baseTask(),id:id+'-task'+projectReads,startsOn:null,endsOn:null}],totalTasks:3,nextCursor:'guide-cursor-'+projectReads};}
  }else if(url.pathname==='/api/identity/worker-channel')body={scope:currentScope,projectId:'p-a',channelReady:true,truncated:false,records:[{workerId:'own-worker',name:'Persona sintética',revision,state:'VERIFIED',eligible:true,binding:{id:'guide-binding',verifiedAt:'2026-10-01T12:00:00Z',revokedAt:null}}]};
  else throw Error('Unexpected guide endpoint '+url.pathname);
  await request.respond({status,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});
 }catch(error){pageErrors.push({mode,width,message:error.message});await request.abort().catch(()=>{});}});
 try{
  await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await page.waitForFunction(()=>document.querySelector('[data-guide-observation="OBSERVED"]')?.textContent.includes('Empresa consultada'));assert.match(await guideStatus(page),/2 obras asignadas/);assert.match(await guideStatus(page),/abrí una obra/);
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba A')).click());await page.waitForFunction(()=>window.__guideObservation?.schedule?.loaded===1);assert.match(await guideStatus(page),/1 tarea cargada de 3.*Vista parcial.*1 sin fechas/s);
  await click(page,'Consultar vinculación');await page.waitForFunction(()=>window.__guideObservation?.channel?.ownLinked===true);assert.match(await guideStatus(page),/Tu vínculo personal está vigente/);
  failureStatus=503;await click(page,'Cargar más tareas');await page.waitForSelector('[data-guide-observation="UNOBSERVED"]');assert.ok(!(await guideStatus(page)).includes('Tu vínculo personal está vigente'));assert.ok(!(await guideStatus(page)).includes('1 tarea cargada'));assert.equal(await page.$$eval('[data-task-id]',nodes=>nodes.length),1);
  await click(page,'Cargar más tareas');await page.waitForFunction(()=>window.__guideObservation?.schedule?.loaded===2);assert.match(await guideStatus(page),/2 tareas cargadas de 3/);assert.ok(!(await guideStatus(page)).includes('Tu vínculo personal está vigente'));
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba B')).click());await page.waitForFunction(()=>window.__guideObservation?.projectId==='p-b'&&window.__guideObservation?.schedule?.loaded===1);assert.match(await guideStatus(page),/1 tarea cargada de 3/);assert.equal(await page.$$eval('[data-task-id]',nodes=>nodes.length),1);assert.equal(await page.evaluate(()=>window.__guideObservation.channel),null);
  for(const denial of [401,403]){failureStatus=denial;await click(page,'Cargar más tareas');await page.waitForSelector('[data-guide-observation="UNAVAILABLE"]');assert.ok(!(await guideStatus(page)).includes('Empresa consultada'));assert.equal(await page.$$eval('[data-task-id]',nodes=>nodes.length),0);await click(page,'Actualizar');await page.waitForSelector('[data-guide-observation="OBSERVED"]');assert.equal(await page.evaluate(()=>window.__guideObservation.projectId),null);await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba A')).click());await page.waitForFunction(()=>window.__guideObservation?.projectId==='p-a');}
  currentScope='b'.repeat(64);role='AUDITOR';await click(page,'Actualizar');await page.waitForFunction(()=>document.querySelector('[data-guide-observation="OBSERVED"]')?.textContent.includes('acceso Auditor'));assert.equal(await page.evaluate(()=>window.__guideObservation.scope),currentScope);assert.equal(await page.evaluate(()=>window.__guideObservation.projectId),null);assert.equal(await page.evaluate(()=>window.__guideObservation.channel),null);assert.ok(!(await guideStatus(page)).includes('tareas cargadas'));assert.ok(!(await guideStatus(page)).includes('Tu vínculo personal está vigente'));assert.equal(posts.length,0);await page.$eval('[data-guide-observation]',node=>{node.closest('details').open=true;});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(evidence,'workspace-guide-state-'+width+'.png'),fullPage:true});checks.push({mode,width,projectReads,requests:requests.length,posts:0,failedReadClears:true,denial401Clears:true,denial403Clears:true,projectSwitchClears:true,roleScopeRefreshClears:true});
 }finally{await context.close();}
}

async function guideHttpDenialScenario(width,action,denial){
 const mode=`guide-http-${action}-${denial}`,context=await browser.createBrowserContext(),page=await context.newPage();
 await page.setViewport({width,height:1100,hasTouch:width<768,isMobile:width<768});page.on('pageerror',error=>pageErrors.push({mode,width,message:error.message}));
 const requests=[],posts=[];let denyWorkspace=false,projectReads=0,receiptReads=0;
 await page.setRequestInterception(true);page.on('request',async request=>{try{
  const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();throw Error('External request forbidden');}
  if(!url.pathname.startsWith('/api/identity/'))return request.continue();
  requests.push({path:url.pathname,method:request.method()});assert.equal(request.headers().authorization,'Bearer synthetic-active-tab-A');
  if(request.method()!=='GET'){posts.push(request.postData());throw Error('HTML denial fixture permits GET only');}
  let body;
  if(url.pathname==='/api/identity/workspace'){
   if(!url.search)body={scope,organizationName:'Empresa de guía HTTP sintética',role:'SITE_MANAGER',roleLabel:'Jefe de obra',canPlanSchedule:false,canManageIntegrations:false,projects:[{id:'p-a',name:'Obra de prueba A'}],projectsTruncated:false};
   else{assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),'p-a');projectReads++;
    if(denyWorkspace)return request.respond({status:denial,contentType:'text/html',headers:{'Cache-Control':'no-store'},body:'<html><body>private gateway diagnostic</body></html>'});
    body={scope,project:{id:'p-a',name:'Obra de prueba A'},canPlanSchedule:false,tasks:[baseTask()],totalTasks:2,nextCursor:'synthetic-guide-http-cursor'};
   }
  }else if(url.pathname==='/api/identity/worker-channel')body={scope,projectId:'p-a',channelReady:true,truncated:false,records:[{workerId:'own-worker',name:'Persona sintética',revision,state:'VERIFIED',eligible:true,binding:{id:'guide-http-binding',verifiedAt:'2026-10-01T12:00:00Z',revokedAt:null}}]};
  else if(url.pathname==='/api/identity/task-creation'){
   assert.equal(action,'readback');assert.equal(url.searchParams.get('operationId'),'11111111-1111-4111-8111-111111111111');assert.equal(url.searchParams.get('projectId'),'p-a');assert.equal(url.searchParams.get('scope'),scope);receiptReads++;
   body={scope,projectId:'p-a',state:'RECORDED',saved:true,created:true,receiptId:'guide-http-original-receipt',task:baseTask()};
  }else throw Error('Unexpected HTML denial endpoint '+url.pathname);
  await request.respond({status:200,contentType:'application/json',body:JSON.stringify(body)});
 }catch(error){pageErrors.push({mode,width,message:error.message});await request.abort().catch(()=>{});}});
 try{
  await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await waitText(page,'Empresa de guía HTTP sintética');
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba A')).click());await page.waitForSelector('[data-task-id="task-a"]');
  await click(page,'Consultar vinculación');await page.waitForFunction(()=>window.__guideObservation?.channel?.ownLinked===true);assert.match(await guideStatus(page),/Tu vínculo personal está vigente/);
  denyWorkspace=true;
  if(action==='append')await click(page,'Cargar más tareas');
  else{await page.evaluate(body=>window.__prepareWorkspaceReference(body),{scope,projectId:'p-a',operationId:'11111111-1111-4111-8111-111111111111'});await waitText(page,'Operaciones por comprobar');await click(page,'Comprobar recibo');}
  await page.waitForSelector('[data-guide-observation="UNAVAILABLE"]',{timeout:6000});
  assert.equal(await page.$$eval('[data-task-id]',nodes=>nodes.length),0);assert.equal(await page.$('#worker-channel-title'),null);assert.equal(await page.$('#participant-title'),null);
  assert.equal(await page.$$eval('button',nodes=>nodes.filter(node=>node.textContent.includes('Obra de prueba A')).length),0);
  assert.ok(!(await guideStatus(page)).includes('Empresa consultada'));assert.ok(!(await guideStatus(page)).includes('Tu vínculo personal está vigente'));
  assert.ok(!(await text(page)).includes('private gateway diagnostic'));assert.ok(!(await text(page)).includes('Unexpected token'));
  assert.equal(projectReads,2);assert.equal(receiptReads,action==='readback'?1:0);assert.equal(posts.length,0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.join(evidence,`workspace-${mode}-${width}.png`),fullPage:true});
  checks.push({mode,width,projectReads,receiptReads,posts:0,htmlDenialClearsAccount:true,htmlDenialClearsView:true,htmlDenialClearsGuideFacts:true,currentToken:true});
 }catch(error){await page.screenshot({path:path.join(evidence,`workspace-${mode}-${width}-failure.png`),fullPage:true}).catch(()=>{});throw error;}
 finally{await context.close();}
}

async function portfolioAccessRaceScenario(width,denial,format,action='project'){
 const mode=`portfolio-access-race-${action}-${denial}-${format}`,context=await browser.createBrowserContext(),page=await context.newPage();
 await page.setViewport({width,height:1100,hasTouch:width<768,isMobile:width<768});page.on('pageerror',error=>pageErrors.push({mode,width,message:error.message}));
 const requests=[],posts=[];let workspaceReads=0,projectReads=0,portfolioRequest=null,projectRequest=null,scheduleRequest=null;
 const refreshedScope='b'.repeat(64);
 const references=()=>page.evaluate(()=>new Promise((resolve,reject)=>{const open=indexedDB.open('obrasaas-pending-receipts-v1');open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('references','readonly'),read=tx.objectStore('references').getAll();let rows;read.onsuccess=()=>{rows=read.result;};tx.oncomplete=()=>{db.close();resolve(JSON.stringify(rows));};tx.onerror=()=>{db.close();reject(tx.error);};};}));
 await page.setRequestInterception(true);page.on('request',async request=>{try{
  const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();throw Error('External request forbidden');}
  if(!url.pathname.startsWith('/api/identity/'))return request.continue();
  requests.push({path:url.pathname,method:request.method(),query:url.search});assert.equal(request.headers().authorization,'Bearer synthetic-active-tab-A');
  if(request.method()!=='GET'){
   assert.equal(action,'schedule');assert.equal(url.pathname,'/api/identity/workspace');assert.equal(request.method(),'POST');
   const payload=JSON.parse(request.postData());assert.equal(payload.scope,scope);assert.equal(payload.taskId,'task-a');assert.equal(payload.projectId,'p-a');assert.equal(payload.expectedRevision,revision);assert.equal(payload.startsOn,'2026-10-07');assert.equal(payload.endsOn,'2026-10-15');posts.push(payload);scheduleRequest=request;return;
  }
  let body;
  if(url.pathname==='/api/identity/workspace'){
   if(!url.search){workspaceReads++;body={scope:workspaceReads===1?scope:refreshedScope,organizationName:workspaceReads===1?'Empresa de acceso sintético':'Empresa recién consultada',role:workspaceReads===1?'SITE_MANAGER':'AUDITOR',roleLabel:workspaceReads===1?'Jefe de obra':'Auditor',canPlanSchedule:false,canManageIntegrations:false,projects:[{id:workspaceReads===1?'p-a':'p-c',name:workspaceReads===1?'Obra de prueba A':'Obra de nueva consulta'},...(workspaceReads===1?[{id:'p-b',name:'Obra de prueba B'}]:[])],projectsTruncated:false};}
   else if(url.searchParams.has('portfolio')){assert.equal(url.searchParams.get('scope'),scope);portfolioRequest=request;return;}
   else{assert.equal(url.searchParams.get('scope'),scope);projectReads++;if(url.searchParams.get('projectId')==='p-b'){projectRequest=request;return;}assert.equal(url.searchParams.get('projectId'),'p-a');body={scope,project:{id:'p-a',name:'Obra de prueba A'},canPlanSchedule:action!=='project',tasks:[baseTask()],totalTasks:1,nextCursor:null};}
  }else if(url.pathname==='/api/identity/worker-channel')body={scope,projectId:'p-a',channelReady:true,truncated:false,records:[{workerId:'own-worker',name:'Persona sintética',revision,state:'VERIFIED',eligible:true,binding:{id:'race-binding',verifiedAt:'2026-10-01T12:00:00Z',revokedAt:null}}]};
  else throw Error('Unexpected portfolio race endpoint '+url.pathname);
  await request.respond({status:200,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});
 }catch(error){pageErrors.push({mode,width,message:error.message});await request.abort().catch(()=>{});}});
 try{
  await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await waitText(page,'Empresa de acceso sintético');
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba A')).click());await page.waitForSelector('[data-task-id="task-a"]');
  await click(page,'Consultar vinculación');await page.waitForFunction(()=>window.__guideObservation?.channel?.ownLinked===true);
  await page.evaluate(body=>window.__prepareWorkspaceReference(body),{scope,projectId:'p-a',operationId:'22222222-2222-4222-8222-222222222222'});await waitText(page,'Operaciones por comprobar');
  const retainedReferences=await references(),observedGeneration=await page.evaluate(()=>window.__guideObservation.generation);assert.ok(retainedReferences.includes('22222222-2222-4222-8222-222222222222'));
  await click(page,'Consultar resumen');await page.waitForFunction(()=>document.querySelector('#portfolio-overview-title')?.closest('section').getAttribute('aria-busy')==='true');
  for(let i=0;i<80&&!portfolioRequest;i++)await new Promise(resolve=>setTimeout(resolve,25));assert.ok(portfolioRequest,'The portfolio read must be dispatched before the concurrent action');
  if(action==='project'){
   await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra de prueba B')).click());await page.waitForSelector('[data-guide-observation="CONSULTING"]');
   for(let i=0;i<40&&!projectRequest;i++)await new Promise(resolve=>setTimeout(resolve,25));assert.ok(projectRequest,'The project read must be dispatched before access denial');
  }else{
   await fill(page);if(action==='token')await page.evaluate(()=>{window.__holdToken=true;});await click(page,'Confirmar planificación');
   if(action==='token')await page.waitForFunction(()=>typeof window.__resolveToken==='function');
   else{for(let i=0;i<80&&!scheduleRequest;i++)await new Promise(resolve=>setTimeout(resolve,25));assert.ok(scheduleRequest,'The schedule command must be dispatched before access denial');}
  }
  const pendingReferences=await references();if(action==='schedule')assert.ok(pendingReferences.includes(posts[0].operationId));
  await portfolioRequest.respond({status:denial,contentType:format==='html'?'text/html':'application/json',headers:{'Cache-Control':'no-store'},body:format==='html'?'<html><body>private gateway diagnostic</body></html>':JSON.stringify({code:'WORKSPACE_CONTEXT_CHANGED'})});
  await page.waitForSelector('[data-guide-observation="UNAVAILABLE"]',{timeout:6000});
  assert.ok(await page.$$eval('button',nodes=>nodes.find(node=>node.textContent==='Actualizar')?.disabled===false),'An access denial must allow explicit account refresh');
  assert.equal(await page.$$eval('[data-task-id]',nodes=>nodes.length),0);assert.equal(await page.$('#worker-channel-title'),null);assert.equal(await page.$('#portfolio-overview-title'),null);
  assert.ok(!(await text(page)).includes('Empresa de acceso sintético'));assert.ok(!(await text(page)).includes('private gateway diagnostic'));assert.ok(!(await guideStatus(page)).includes('Tu vínculo personal está vigente'));
  assert.ok(await page.evaluate(previous=>window.__guideObservation.generation>previous,observedGeneration));assert.equal(workspaceReads,1);
  // The old project response arrives after access was invalidated. It must not
  // restore private work or an observed guide state, even when cancellation
  // and response delivery race in the browser transport.
  if(action==='project')await projectRequest.respond({status:200,contentType:'application/json',body:JSON.stringify({scope,project:{id:'p-b',name:'Obra privada de respuesta anterior'},canPlanSchedule:false,tasks:[{...baseTask(),title:'Tarea privada de respuesta anterior'}],totalTasks:1,nextCursor:null})}).catch(()=>{});
  else if(action==='token')await page.evaluate(()=>{window.__holdToken=false;window.__resolveToken();});
  else{const payload=posts[0];await scheduleRequest.respond({status:200,contentType:'application/json',body:JSON.stringify({scope,saved:true,replayed:false,task:{...baseTask(),startsOn:payload.startsOn,endsOn:payload.endsOn,revision:'2026-10-01T12:00:00.111111'},receipt:{id:'workspace_schedule_'+ 'b'.repeat(64),taskId:'task-a',recordedAt:'2026-10-01T12:00:00.111111',before:{startsOn:'2026-10-01',endsOn:'2026-10-05'},after:{startsOn:payload.startsOn,endsOn:payload.endsOn}}})}).catch(()=>{});}
  await new Promise(resolve=>setTimeout(resolve,180));assert.equal(await page.$eval('[data-guide-observation]',node=>node.dataset.guideObservation),'UNAVAILABLE');assert.ok(!(await text(page)).includes('respuesta anterior'));assert.ok(!(await text(page)).includes('Cambio confirmado'));assert.equal(posts.length,action==='schedule'?1:0);
  const survivingReferences=await references();assert.ok(survivingReferences.includes('22222222-2222-4222-8222-222222222222'));if(action==='schedule')assert.equal(survivingReferences,pendingReferences);else if(action==='project')assert.equal(survivingReferences,retainedReferences);
  await click(page,'Actualizar');await waitText(page,'Empresa recién consultada');await page.waitForFunction(expected=>window.__guideObservation?.state==='OBSERVED'&&window.__guideObservation.scope===expected,{},refreshedScope);
  assert.equal(await page.evaluate(()=>window.__guideObservation.channel),null);assert.equal(await page.evaluate(()=>window.__guideObservation.projectId),null);assert.equal(await references(),survivingReferences);assert.equal(workspaceReads,2);assert.equal(projectReads,action==='project'?2:1);assert.equal(posts.length,action==='schedule'?1:0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  checks.push({mode,width,denial,format,action,posts:posts.length,refreshUnlocked:true,guideUnavailable:true,lateResponseRejected:true,lateTokenPostBlocked:action==='token',channelSnapshotCleared:true,referencesPreserved:true,explicitFreshScope:true});
 }catch(error){await page.screenshot({path:path.join(evidence,`workspace-${mode}-${width}-failure.png`),fullPage:true}).catch(()=>{});throw error;}
 finally{await context.close();}
}

try{
 let ready=false;
 for(let i=0;i<120;i++){
  if(server.exitCode!==null)throw new Error('Fixture server exited: '+serverLog.slice(-5000));
  let response;try{response=await fetch(origin);}catch{}
  await response?.body?.cancel();
  if(response?.ok){ready=true;break;}
  if(response&&response.status>=500)throw new Error('Fixture page failed with HTTP '+response.status+': '+serverLog.slice(-5000));
  await new Promise(resolve=>setTimeout(resolve,500));
 }
 assert.ok(ready,'Fixture server unavailable: '+serverLog.slice(-5000));
 browser=await puppeteer.launch({headless:true,...(process.platform==='win32'?{channel:'chrome'}:{}),args:['--no-sandbox','--disable-setuid-sandbox']});
 if([undefined,'onboarding-epoch','guide-observation'].includes(process.env.WORKSPACE_UI_SCENARIO))for(const width of [320,390,768,1280])await guideObservationScenario(width);
 if([undefined,'onboarding-epoch'].includes(process.env.WORKSPACE_UI_SCENARIO))for(const width of [320,390,768,1280])await onboardingEpochScenario(width);
 if([undefined,'guide-http-denial'].includes(process.env.WORKSPACE_UI_SCENARIO))for(const width of [320,390,768,1280])for(const action of ['append','readback'])for(const denial of [401,403])await guideHttpDenialScenario(width,action,denial);
 if([undefined,'portfolio-access-race'].includes(process.env.WORKSPACE_UI_SCENARIO))for(const width of [320,390,768,1280])for(const denial of [401,403,409]){for(const format of ['html','json'])await portfolioAccessRaceScenario(width,denial,format);for(const action of ['schedule','token'])await portfolioAccessRaceScenario(width,denial,'json',action);}
 if(!process.env.WORKSPACE_UI_SCENARIO){
 for(const width of [320,390,768,1280])await scenario('success',width);
 for(const mode of ['readonly','denied','empty','draft-cancel','sdk-unavailable','unmount-token','uncertain','rollback','not-arrived','conflict','race'])await scenario(mode);
 for(const mode of ['draft-cancel','uncertain','rollback','not-arrived'])await taskCreateScenario(mode);
 for(const width of [320,390,768,1280])for(const role of ['ADMIN','AUDITOR'])await navigationScenario(role,width);
 for(const width of [320,390,768,1280])await workbenchScenario(width);
 await stalePaginationScenario();
 }
 assert.deepEqual(pageErrors,[]);
 const proof={status:'PASS',fullSuite:!process.env.WORKSPACE_UI_SCENARIO,focusedScenario:process.env.WORKSPACE_UI_SCENARIO||null,environment:'isolated-browser-with-intercepted-synthetic-api',widths:[320,390,768,1280],checks,pageErrors,sourceManifest,harnessSha256,productionLoginVerified:false,productionDataWritten:false,physicalWhatsAppVerified:false};
 writeFileSync(path.join(evidence,'browser.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(error){writeFileSync(path.join(evidence,'browser-failure.json'),JSON.stringify({status:'FAILED',message:error.message,checks,pageErrors,sourceManifest,harnessSha256,serverLog},null,2));throw error;}
finally{await browser?.close();try{if(process.platform!=='win32')process.kill(-server.pid,'SIGTERM');else server.kill();}catch{}await new Promise(resolve=>setTimeout(resolve,500));assert.equal(path.dirname(path.resolve(fixture)),path.resolve(root,'.vercel'));rmSync(fixture,{recursive:true,force:true});}
