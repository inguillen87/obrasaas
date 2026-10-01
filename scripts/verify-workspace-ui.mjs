import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,copyFileSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import puppeteer from 'puppeteer';

// Browser-only acceptance of the real component with intercepted synthetic API
// responses. This is NOT proof of a production login, employee or WhatsApp event.
assert.ok(!process.env.VERCEL && !process.env.VERCEL_ENV);
const root=process.cwd(),evidence=path.join(root,'.vercel/workspace-evidence');
mkdirSync(evidence,{recursive:true});
const fixture=mkdtempSync(path.join(root,'.vercel/workspace-ui-')),app=path.join(fixture,'app');
mkdirSync(app);for(const file of ['workspace-client.js','workspace.module.css','customer-whatsapp-panel.js','customer-whatsapp-panel.module.css','task-create-panel.js'])copyFileSync(path.join(root,'src/app/(identity)/cuenta',file),path.join(app,file));
writeFileSync(path.join(fixture,'package.json'),JSON.stringify({name:'isolated-workspace-ui-fixture',private:true}));
writeFileSync(path.join(fixture,'next.config.mjs'),`export default {turbopack:{root:${JSON.stringify(root)}}};\n`);
writeFileSync(path.join(app,'layout.js'),`export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:16,background:'#0b1c2d',fontFamily:'Arial,sans-serif'}}>{children}</body></html>}`);
writeFileSync(path.join(app,'page.js'),`import {AccountWorkspace} from './workspace-client';export default function Page(){return <main style={{maxWidth:1000,margin:'0 auto'}}><AccountWorkspace/></main>}`);
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
 const requests=[],posts=[];let record=null;
 await page.setRequestInterception(true);
 page.on('request',async request=>{
  try{
   const url=new URL(request.url());
   if(url.origin!==origin){if(url.protocol==='data:'||url.protocol==='blob:')return request.continue();return request.abort();}
   if(url.pathname!=='/api/identity/workspace')return request.continue();
   requests.push({method:request.method(),query:url.search});
   let body,status=200;
   if(request.method()==='POST'){
    const payload=JSON.parse(request.postData());posts.push(payload);
    assert.equal(payload.scope,scope);assert.equal(payload.taskId,'task-a');assert.equal(payload.projectId,'p-a');assert.equal(payload.expectedRevision,revision);
    assert.equal(payload.startsOn,'2026-10-07');assert.equal(payload.endsOn,'2026-10-15');
    assert.deepEqual(Object.keys(payload).sort(),['operationId','projectId','taskId','scope','expectedRevision','startsOn','endsOn','reason'].sort());
    record={scope,saved:true,replayed:false,task:{...baseTask(),startsOn:payload.startsOn,endsOn:payload.endsOn,revision:'2026-10-01T12:00:00.111111'},receipt:{id:'workspace_schedule_'+ 'b'.repeat(64),taskId:'task-a',recordedAt:'2026-10-01T12:00:00.111111',before:{startsOn:'2026-10-01',endsOn:'2026-10-05'},after:{startsOn:payload.startsOn,endsOn:payload.endsOn}}};
    if(mode==='uncertain'){status=503;body={code:'WORKSPACE_OPERATION_UNCONFIRMED',saved:false};}
    else if(mode==='conflict'){status=409;body={code:'SCHEDULE_REVISION_CHANGED',saved:false};record=null;}
    else body=record;
   }else if(url.searchParams.has('operationId')){
    assert.equal(url.searchParams.get('operationId'),posts[0].operationId);body=record?{...record,state:'RECORDED'}:{scope,state:'NOT_OBSERVED',definitive:false};
   }else if(!url.search){
    if(mode==='denied'){status=403;body={code:'WORKSPACE_MEMBERSHIP_REQUIRED'};}
    else body={scope,organizationName:'Organización de prueba sintética',role:mode==='readonly'?'AUDITOR':'SITE_MANAGER',roleLabel:mode==='readonly'?'Auditor':'Jefe de obra',canPlanSchedule:mode!=='readonly',projects:[{id:'p-a',name:'Obra de prueba A'},...(mode==='race'?[{id:'p-b',name:'Obra de prueba B'}]:[])],projectsTruncated:false};
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
 await fill(page);await click(page,'Confirmar planificación');
 if(mode==='uncertain'){
  await waitText(page,'no confirmó el guardado');assert.equal(posts.length,1);
  assert.equal(await page.$$eval('button',nodes=>nodes.find(node=>node.textContent==='Actualizar').disabled),true);
  await click(page,'Comprobar guardado');await waitText(page,'Cambio confirmado');assert.equal(posts.length,1);checks.push('uncertain-save-recovers-receipt-without-reposting');
 }else if(mode==='conflict'){
  await waitText(page,'Otra persona modificó la tarea');assert.ok(!(await text(page)).includes('Cambio confirmado'));assert.equal(posts.length,1);checks.push('stale-revision-does-not-show-a-success-receipt');
 }else{
  await waitText(page,'Cambio confirmado');assert.ok((await text(page)).includes('2026-10-07 → 2026-10-15'));assert.ok((await text(page)).includes('37 %'));assert.equal(posts.length,1);checks.push('planned-dates-receipt-and-unchanged-progress-'+width);
 }
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Overflow after edit at '+width);
 assert.ok(requests.every(request=>['GET','POST'].includes(request.method)));
 await context.close();
}
try{
 let ready=false;for(let i=0;i<120;i++){if(server.exitCode!==null)throw new Error('Fixture server exited');try{const response=await fetch(origin);if(response.ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,500));}assert.ok(ready,'Fixture server unavailable');
 browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});
 for(const width of [320,390,768,1280])await scenario('success',width);
 for(const mode of ['readonly','denied','empty','uncertain','conflict','race'])await scenario(mode);
 assert.deepEqual(pageErrors,[]);
 const proof={status:'PASS',environment:'isolated-browser-with-intercepted-synthetic-api',widths:[320,390,768,1280],checks,pageErrors,productionLoginVerified:false,productionDataWritten:false,physicalWhatsAppVerified:false};
 writeFileSync(path.join(evidence,'browser.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(error){writeFileSync(path.join(evidence,'browser-failure.json'),JSON.stringify({status:'FAILED',message:error.message,pageErrors,serverLog},null,2));throw error;}
finally{await browser?.close();try{if(process.platform!=='win32')process.kill(-server.pid,'SIGTERM');else server.kill();}catch{}await new Promise(resolve=>setTimeout(resolve,500));rmSync(fixture,{recursive:true,force:true});}
