import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,copyFileSync,writeFileSync,rmSync,readdirSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import puppeteer from 'puppeteer';
assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV);
const root=realpathSync(process.cwd()),parent=path.join(root,'.vercel'),output=path.join(parent,'company-onboarding-evidence');mkdirSync(output,{recursive:true});
const dir=mkdtempSync(path.join(root,'.vercel/company-bootstrap-ui-')),app=path.join(dir,'app');mkdirSync(app);
for(const file of readdirSync(path.join(root,'src/app/(identity)/cuenta')).filter(name=>/\.(js|mjs|css)$/.test(name)))copyFileSync(path.join(root,'src/app/(identity)/cuenta',file),path.join(app,file));
writeFileSync(path.join(dir,'package.json'),JSON.stringify({name:'synthetic-company-onboarding-ui',private:true}));
writeFileSync(path.join(dir,'next.config.mjs'),`export default {devIndicators:false,turbopack:{root:${JSON.stringify(root)}}};`);
writeFileSync(path.join(app,'layout.js'),`export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:12,background:'#081c2d',fontFamily:'Arial,sans-serif'}}>{children}</body></html>}`);
writeFileSync(path.join(app,'page.js'),`'use client';import {CompanyBootstrapPanel} from './company-bootstrap-panel';import {AccountWorkspace} from './workspace-client';const session=async()=>'synthetic-session-token';const profile=async()=>{window.__profileReads=(window.__profileReads||0)+1;if(window.__profileUnavailable)throw new Error('fixture');return 'synthetic-profile-token';};export default function Page(){return <main style={{maxWidth:1120,margin:'0 auto'}}><CompanyBootstrapPanel organizationId="org_BootstrapA" organizationName="" getSessionToken={session} getProfileToken={profile}><AccountWorkspace/></CompanyBootstrapPanel></main>}`);
const origin='http://127.0.0.1:3110';
const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',dir,'--webpack','--hostname','127.0.0.1','--port','3110'],{env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
let log='';for(const stream of [server.stdout,server.stderr])stream.on('data',value=>{log=(log+value).slice(-16000);});
let browser;const checks=[],errors=[];
const click=async(page,label)=>{const handle=await page.evaluateHandle(text=>[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===text),label);assert.ok(handle.asElement(),'Missing button '+label);await handle.asElement().click();await handle.dispose();};
const wait=(page,text)=>page.waitForFunction(value=>document.body.innerText.includes(value),{timeout:20000},text);
async function scenario(mode,width=390){
 const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1000});
 page.on('pageerror',error=>errors.push({mode,width,message:error.message}));await page.setRequestInterception(true);
 let created=false,result=null,tasks=[],taskReceipts=new Map();const posts=[],postBodies=[],taskPosts=[],external=[];const scope='c'.repeat(64);
 page.on('request',async request=>{
  try{
   const url=new URL(request.url());
   if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();external.push(url.hostname);return request.abort();}
   if(!url.pathname.startsWith('/api/identity/'))return request.continue();
   let body,status=200;
   if(url.pathname==='/api/identity/company-onboarding'){
    assert.equal(request.headers().authorization,'Bearer synthetic-session-token');
    if(request.method()==='GET'){
     assert.equal(url.searchParams.get('expectedClerkOrganizationId'),'org_BootstrapA');
     if(url.searchParams.has('operationId')){assert.equal(url.searchParams.get('operationId'),posts[0].operationId);body=created?{...result,replayed:true}:{state:'NOT_CREATED',canCreate:true};}
     else body=created?{state:'ALREADY_CONFIGURED',canCreate:false,organizationId:'company-test'}:{state:'NOT_CREATED',canCreate:true};
    }else{
     const command=JSON.parse(request.postData());posts.push(command);postBodies.push(request.postData());assert.equal(command.expectedClerkOrganizationId,'org_BootstrapA');assert.equal(command.confirmNewCompany,true);assert.equal(request.headers()['x-obrasaas-bootstrap-profile'],'synthetic-profile-token');assert.ok(!JSON.stringify(command).includes('token'));
     if(mode==='no-arrival'&&posts.length===1)return request.abort('failed');
     if(mode==='rollback'&&posts.length===1){status=503;body={code:'COMPANY_CREATION_UNCONFIRMED'};}
     else if(mode==='denied'){status=403;body={code:'COMPANY_VERIFIED_PROFILE_REQUIRED'};}
     else{
      created=true;tasks=command.initialTasks.map((task,index)=>({id:'task-initial-'+index,title:task.title,startsOn:task.startsOn||null,endsOn:task.endsOn||null,progress:0,status:'BACKLOG',revision:'2026-10-01T12:00:00.123456'}));
      result={state:'CREATED',created:true,receiptId:'company_bootstrap_'+'a'.repeat(64),organizationId:'company-test',projectId:'project-test',companyName:command.companyName,projectName:command.project.name,initialTaskCount:tasks.length,whatsAppConnected:false};body=result;
      if(mode==='uncertain'){status=503;body={code:'COMPANY_CREATION_UNCONFIRMED'};}
     }
    }
   }else if(url.pathname==='/api/identity/workspace'){
    assert.equal(created,true);body=!url.search?{scope,organizationName:result.companyName,roleLabel:'Administrador',role:'ADMIN',canPlanSchedule:true,canManageIntegrations:false,projects:[{id:'project-test',name:result.projectName}],projectsTruncated:false}:
      {scope,project:{id:'project-test',name:result.projectName},roleLabel:'Administrador',canPlanSchedule:true,tasks,totalTasks:tasks.length,nextCursor:null};
   }else if(url.pathname==='/api/identity/task-creation'){
    assert.equal(created,true);const command=JSON.parse(request.postData());taskPosts.push(command);assert.equal(command.scope,scope);assert.equal(command.projectId,'project-test');
    if(!taskReceipts.has(command.operationId)){const task={id:'new-task-'+tasks.length,title:command.title,startsOn:command.startsOn||null,endsOn:command.endsOn||null,progress:0,status:'BACKLOG',revision:'2026-10-01T13:00:00.123456'};tasks.push(task);taskReceipts.set(command.operationId,{scope,created:true,receiptId:'new-task-receipt',task});}
    body=taskReceipts.get(command.operationId);
   }else throw new Error('Unexpected API '+url.pathname);
   await request.respond({status,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});
  }catch(error){errors.push({mode,width,message:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}
 });
 await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await wait(page,'Crear empresa y primera obra');
 await page.type('input[autocomplete="organization"]','Constructora de ensayo');await page.type('input[placeholder*="Edificio"]','Obra inicial de ensayo');
 if(mode==='planned'){
  await click(page,'Agregar tarea');await page.type('input[maxlength="160"]','Replanteo de la obra');
  await page.$$eval('input[type="date"]',inputs=>{for(const [index,input]of inputs.entries()){Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,index===0?'2026-10-02':'2026-10-06');input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}});
 }
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 if(mode==='empty'||mode==='planned')await page.screenshot({path:path.join(output,`company-${mode}-${width}.png`),fullPage:true});
 await page.click('input[type="checkbox"]');assert.equal(await page.$eval('input[type="checkbox"]',input=>input.checked),true);await click(page,'Crear empresa y primera obra');
 if(mode==='denied'){await wait(page,'Verificá el correo');assert.equal(created,false);assert.equal(posts.length,1);assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('El espacio está creado'));checks.push('unverified-email-never-shows-company-created');await context.close();return;}
 if(mode==='uncertain'){await wait(page,'No recibimos la confirmación');assert.equal(posts.length,1);await click(page,'Comprobar creación');}
 if(['no-arrival','rollback'].includes(mode)){
  await wait(page,'No recibimos la confirmación');assert.equal(posts.length,1);assert.equal(created,false);assert.equal(await page.$$eval('button',buttons=>buttons.some(button=>button.textContent==='Reenviar mismo intento')),false);
  await click(page,'Comprobar creación');await wait(page,'No se reenvía automáticamente');assert.equal(posts.length,1);assert.equal(created,false);assert.equal(await page.$eval('input[autocomplete="organization"]',input=>input.disabled),true);
  await page.evaluate(()=>{window.__profileUnavailable=true;});await click(page,'Reenviar mismo intento');await wait(page,'El espacio está creado');assert.equal(posts.length,2);assert.equal(postBodies[0],postBodies[1]);assert.equal(await page.evaluate(()=>window.__profileReads),1);checks.push(`${mode}-checked-absence-explicit-identical-retry-retained-profile-proof`);
 }
 await wait(page,'El espacio está creado');assert.equal(posts.length,['no-arrival','rollback'].includes(mode)?2:1);assert.equal(posts[0].initialTasks.length,mode==='planned'?1:0);assert.ok((await page.evaluate(()=>document.body.innerText)).includes('WhatsApp todavía no quedó conectado'));
 await click(page,'Entrar a mi obra');await wait(page,'Mis obras');await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.textContent.includes('Obra inicial de ensayo')&&!button.disabled));await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra inicial de ensayo')).click());
 if(mode==='planned'){await wait(page,'Replanteo de la obra');assert.ok((await page.evaluate(()=>document.body.innerText)).includes('0 %'));}
 else{
  await wait(page,'no tiene tareas registradas');await click(page,'Nueva tarea');await page.type('input[minlength="2"]','Primera tarea cargada después');await click(page,'Crear tarea');await wait(page,'Tarea creada y vinculada');assert.equal(taskPosts.length,1);assert.ok((await page.evaluate(()=>document.body.innerText)).includes('0 %'));
 }
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(external,[]);
 checks.push(`${mode}-company-to-workspace-${width}`);await context.close();
}
try{
 let ready=false;
 for(let i=0;i<120;i++){
  if(server.exitCode!==null)throw new Error('Fixture exited: '+log.slice(-5000));
  let response;try{response=await fetch(origin);}catch{}
  await response?.body?.cancel();
  if(response?.ok){ready=true;break;}
  if(response&&response.status>=500)throw new Error('Fixture page failed with HTTP '+response.status+': '+log.slice(-5000));
  await new Promise(done=>setTimeout(done,500));
 }
 assert.ok(ready,'Fixture server unavailable: '+log.slice(-5000));
 browser=await puppeteer.launch({headless:true,...(process.platform==='win32'?{channel:'chrome'}:{}),args:['--no-sandbox','--disable-setuid-sandbox']});
 for(const width of [320,390,768,1280])await scenario('empty',width);await scenario('planned',390);await scenario('uncertain');await scenario('no-arrival');await scenario('rollback');await scenario('denied');
 assert.deepEqual(errors,[]);const proof={status:'PASS',environment:'actual-ui-with-intercepted-synthetic-services',checks,widths:[320,390,768,1280],errors,realClerkLogin:false,physicalWhatsApp:false,productionDataWritten:false};
 rmSync(path.join(output,'browser-failure.json'),{force:true});writeFileSync(path.join(output,'browser.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(error){writeFileSync(path.join(output,'browser-failure.json'),JSON.stringify({message:error.message,errors,log},null,2));throw error;}
finally{await browser?.close();try{if(process.platform!=='win32')process.kill(-server.pid,'SIGTERM');else server.kill();}catch{}await new Promise(done=>setTimeout(done,500));const resolved=realpathSync(dir);assert.equal(path.dirname(resolved),realpathSync(parent));assert.ok(path.basename(resolved).startsWith('company-bootstrap-ui-'));rmSync(resolved,{recursive:true,force:true});}
