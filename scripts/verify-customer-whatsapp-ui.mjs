import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,copyFileSync,writeFileSync,rmSync,realpathSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {spawn} from 'node:child_process';
import puppeteer from 'puppeteer';
import {WORKSPACE_NUMBER_MODES,WORKSPACE_USE_CASES,tenantWorkspaceFromMetadata} from '../src/lib/whatsapp/tenant-workspace-policy.js';
import {customerWhatsAppReadiness} from '../src/lib/customer-whatsapp-setup.mjs';
import {RECOVERY_DATABASE_NAME} from '../src/app/(identity)/cuenta/workspace-recovery-storage.mjs';
assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV);
const root=realpathSync(process.cwd()),parent=path.join(root,'.vercel'),evidence=path.join(parent,'customer-whatsapp-evidence');mkdirSync(evidence,{recursive:true});
const fixture=mkdtempSync(path.join(root,'.vercel/customer-whatsapp-ui-')),app=path.join(fixture,'app'),account=path.join(app,'(identity)/cuenta');mkdirSync(account,{recursive:true});
for(const name of ['customer-whatsapp-panel.js','customer-whatsapp-panel.module.css','customer-whatsapp-view.mjs'])copyFileSync(path.join(root,'src/app/(identity)/cuenta',name),path.join(account,name));
for(const dependency of ['workspace-session-request.mjs','workspace-request-lifecycle.mjs','workspace-request-lifecycle.js','workspace-recovery-journal.mjs','site-purchase-view.mjs','workspace-recovery-storage.mjs','private-workspace-download.js'])copyFileSync(path.join(root,'src/app/(identity)/cuenta',dependency),path.join(account,dependency));
mkdirSync(path.join(fixture,'lib/whatsapp'),{recursive:true});copyFileSync(path.join(root,'src/lib/whatsapp/tenant-workspace-policy.js'),path.join(fixture,'lib/whatsapp/tenant-workspace-policy.js'));
const sourceManifest=[...['customer-whatsapp-panel.js','customer-whatsapp-panel.module.css','customer-whatsapp-view.mjs','workspace-session-request.mjs','workspace-request-lifecycle.mjs','workspace-request-lifecycle.js','workspace-recovery-journal.mjs','site-purchase-view.mjs','workspace-recovery-storage.mjs','private-workspace-download.js'].map(file=>'src/app/(identity)/cuenta/'+file),'src/lib/whatsapp/tenant-workspace-policy.js','src/lib/customer-whatsapp-setup.mjs','src/lib/whatsapp/project-workspace-profile.js','src/lib/workspace-policy.mjs'].map(file=>({path:file,sha256:createHash('sha256').update(readFileSync(path.join(root,file))).digest('hex')}));
for(const item of sourceManifest){const copied=item.path.startsWith('src/app/')?path.join(account,path.basename(item.path)):item.path==='src/lib/whatsapp/tenant-workspace-policy.js'?path.join(fixture,'lib/whatsapp/tenant-workspace-policy.js'):null;if(copied)assert.deepEqual(readFileSync(path.join(root,item.path)),readFileSync(copied));}
const focusedScenario=process.env.WHATSAPP_UI_SCENARIO||null;
writeFileSync(path.join(fixture,'package.json'),JSON.stringify({name:'customer-whatsapp-fixture',private:true}));
writeFileSync(path.join(fixture,'next.config.mjs'),`export default {turbopack:{root:${JSON.stringify(root)}}};`);
const scope='a'.repeat(64),projectId='project-a';
writeFileSync(path.join(app,'layout.js'),`export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:12,background:'#081b2b',fontFamily:'Arial,sans-serif'}}>{children}</body></html>}`);
writeFileSync(path.join(app,'page.js'),`'use client';import {useState} from 'react';import {CustomerWhatsAppPanel} from './(identity)/cuenta/customer-whatsapp-panel';import {browserRecoveryJournal} from './(identity)/cuenta/workspace-recovery-journal.mjs';const getSessionToken=async()=>{if(window.fixtureSDKFailure)throw new Error('Controlled SDK failure');return window.fixtureFailToken?null:window.__activeTabFixtureToken||'active-tab-controlled-token';};export default function Page(){const [pending,setPending]=useState(false);if(typeof window!=='undefined')window.fixtureJournal=browserRecoveryJournal;return <main style={{maxWidth:1000,margin:'0 auto'}}><button id="change-worksite" disabled={pending}>Cambiar obra</button><CustomerWhatsAppPanel getSessionToken={getSessionToken} projectId="${projectId}" scope="${scope}" onPending={setPending}/><section><h3 id="customer-meta-title" tabIndex={-1}>Autorizar WhatsApp con Meta</h3><p>Destino controlado del enlace; no realiza autorización.</p></section></main>}`);
const port=3109,origin='http://127.0.0.1:'+port;
const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',fixture,'--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
let serverLog='';for(const stream of [server.stdout,server.stderr])stream.on('data',data=>{serverLog=(serverLog+data.toString()).slice(-16000);});
let browser,activeScenario;const checks=[],pageErrors=[];
async function click(page,text){const handle=await page.evaluateHandle(value=>[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===value),text);const button=handle.asElement();assert.ok(button,text);await button.click();await handle.dispose();}
const wait=(page,value)=>page.waitForFunction(text=>(text==='Preparación guardada'?document.querySelector('[role="status"]')?.innerText:document.body.innerText)?.includes(text),{timeout:12000},value);
async function assertPrivateStorage(page){
 await page.evaluate(scope=>window.fixtureJournal.list(scope),scope);
 const raw=await page.evaluate(async name=>{
  const records=await new Promise((resolve,reject)=>{const open=indexedDB.open(name);open.onerror=()=>reject(new Error('Cannot inspect controlled journal'));open.onsuccess=()=>{const db=open.result,tx=db.transaction('references','readonly'),read=tx.objectStore('references').getAll();read.onsuccess=()=>resolve(read.result);read.onerror=()=>reject(new Error('Cannot inspect controlled references'));tx.oncomplete=()=>db.close();};});
  return {records,other:[...Object.values(localStorage),...Object.values(sessionStorage)]};
 },RECOVERY_DATABASE_NAME);
 for(const row of raw.records)assert.deepEqual(Object.keys(JSON.parse(row.value)).sort(),['createdAt','operationId','projectId','resource','scope','version']);
 for(const canary of ['Asistente de mi obra','Empresa de ensayo','active-tab-controlled-token','confirmOwnership','expectedRevision'])assert.equal(JSON.stringify(raw).includes(canary),false,canary+' in browser storage');
}
async function scenario(mode,width=390,numberMode='DEDICATED'){
 activeScenario={mode,width,numberMode};
 const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1100});
 page.on('pageerror',error=>pageErrors.push(error.message));await page.setRequestInterception(true);
 const posts=[],postBodies=[],requests=[],external=[];let receipt=null,recoveryReads=0,initialReads=0;
 let profile=tenantWorkspaceFromMetadata(null);
 const connection=mode==='stored-record'?{recordPresent:true,displayNumber:null,storedStatus:'CONNECTED',enabled:true}:null;
 const current=()=>({scope,projectId,projectName:'Obra de prueba',companyName:'Empresa de ensayo',profile,profileSource:profile.configured?'PROJECT':'NONE',connection,
  readiness:customerWhatsAppReadiness(profile,connection),options:{numberModes:WORKSPACE_NUMBER_MODES,useCases:WORKSPACE_USE_CASES}});
 page.on('request',async request=>{
  try{
   const url=new URL(request.url());if(url.pathname.startsWith('/api/identity/'))assert.equal(request.headers().authorization,'Bearer active-tab-controlled-token');
   if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();external.push(url.hostname);return request.abort();}
   if(url.pathname!=='/api/identity/whatsapp-setup')return request.continue();
   requests.push(request.method());let response,status=200;
   if(mode.startsWith('access-load-')&&request.method()==='GET'&&!url.searchParams.has('operationId')&&++initialReads===2){const deniedStatus=mode.endsWith('404')?404:mode.endsWith('401')?401:403;return request.respond({status:deniedStatus,contentType:mode.includes('html')?'text/html':'application/json',headers:{'Cache-Control':'no-store'},body:mode.includes('html')?'<html>Controlled denial</html>':JSON.stringify({code:'WORKSPACE_PROJECT_UNAVAILABLE'})});}
   if(request.method()==='POST'){
    const command=JSON.parse(request.postData());posts.push(command);postBodies.push(request.postData());assert.equal(command.projectId,projectId);assert.equal(command.scope,scope);assert.equal(command.profile.numberMode,numberMode);assert.equal(command.profile.confirmOwnership,true);
    assert.deepEqual(Object.keys(command).sort(),['operationId','profile','projectId','scope']);
    assert.ok(!request.postData().match(/token|secret|password/i));
    if(mode==='no-arrival'&&posts.length===1)return request.abort('failed');
    if(['rollback','denied-absent'].includes(mode)&&posts.length===1){status=503;response={code:'WORKSPACE_OPERATION_UNCONFIRMED'};}
    else if(mode==='conflict'&&posts.length===1){profile={configured:true,revision:2,assistantName:'Preparación actual de otro administrador',numberMode:'DEDICATED',initialProjectId:projectId,useCases:['FIELD_REPORTS'],ownership:'CUSTOMER',mode:'REVIEW_REQUIRED',updatedAt:'2026-10-02T00:00:00Z'};status=409;response={code:'WORKSPACE_CONFLICT'};}
    else{
      profile={...command.profile,configured:true,revision:command.profile.expectedRevision+1,ownership:'CUSTOMER',mode:'REVIEW_REQUIRED',updatedAt:'2026-10-01T00:00:00Z'};
      receipt={id:'wa_preparation_'+ 'b'.repeat(64),savedRevision:profile.revision};response={...current(),saved:true,savedProfileIsCurrent:true,receipt};
       if(mode.startsWith('access-post-')){const deniedStatus=mode.endsWith('404')?404:mode.endsWith('401')?401:403;return request.respond({status:deniedStatus,contentType:mode.includes('html')?'text/html':'application/json',headers:{'Cache-Control':'no-store'},body:mode.includes('html')?'<html>Controlled denial after dispatched save</html>':JSON.stringify({code:deniedStatus===404?'WORKSPACE_PROJECT_UNAVAILABLE':'WORKSPACE_INTEGRATION_PERMISSION_REQUIRED'})});}
       if(mode==='access-close-absent'){status=403;response={code:'WORKSPACE_INTEGRATION_PERMISSION_REQUIRED'};receipt=null;profile=tenantWorkspaceFromMetadata(null);}
      if(['uncertain','sdk-prior','malformed-get'].includes(mode)||mode.startsWith('denied-')&&mode!=='denied-refresh'){status=503;response={code:'WORKSPACE_OPERATION_UNCONFIRMED'};}
      if(mode==='malformed-post')response={...response,projectId:'another-project'};
    }
   }else{
    assert.equal(url.searchParams.get('projectId'),projectId);assert.equal(url.searchParams.get('scope'),scope);
    if(url.searchParams.has('operationId')){
     recoveryReads++;assert.equal(url.searchParams.get('operationId'),posts[0].operationId);response=receipt?{...current(),state:'RECORDED',saved:true,savedProfileIsCurrent:true,receipt}:{...current(),state:'NOT_OBSERVED',definitive:false};
     if(mode.startsWith('denied-')&&recoveryReads===1){status=mode==='denied-401'?401:mode==='denied-context'?409:403;response={code:status===401?'SESSION_REQUIRED':status===409?'WORKSPACE_CONTEXT_CHANGED':'WORKSPACE_INTEGRATION_PERMISSION_REQUIRED'};}
     if(mode==='malformed-get'&&recoveryReads===1)response={...response,receipt:{id:'not-a-receipt',savedRevision:1}};
     }else {if(!mode.startsWith('access-load-'))initialReads++;response=current();if(mode==='denied-refresh'&&initialReads===2){status=403;response={code:'WORKSPACE_INTEGRATION_PERMISSION_REQUIRED'};}}
   }
   await request.respond({status,contentType:'application/json',body:JSON.stringify(response)});
  }catch(error){pageErrors.push(error.message);if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}
 });
 await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});assert.equal(requests.length,0);
 await click(page,'Preparar WhatsApp');await wait(page,'Empresa de ensayo');
 if(mode.startsWith('access-load-')){await click(page,'Volver a cargar');await page.waitForFunction(()=>!document.querySelector('input[maxlength="70"]'));assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Empresa de ensayo'));assert.equal(posts.length,0);await click(page,'Volver a cargar');await wait(page,'Empresa de ensayo');assert.equal(posts.length,0);await assertPrivateStorage(page);await page.screenshot({path:path.join(evidence,`${mode}-${width}.png`),fullPage:true});checks.push(`${mode}-${width}-hide-private-explicit-GET-restores-with-no-POST`);await context.close();return;}
 await page.type('input[maxlength="70"]','Asistente de mi obra');
 await page.waitForFunction(()=>document.querySelector('#change-worksite').disabled);
 if(mode==='draft-cancel'){
  assert.equal(posts.length,0);await click(page,'Cancelar edición');await page.waitForFunction(()=>!document.querySelector('#change-worksite').disabled);assert.equal(await page.$('input[maxlength="70"]'),null);await click(page,'Preparar WhatsApp');await wait(page,'Empresa de ensayo');assert.equal(await page.$eval('input[maxlength="70"]',input=>input.value),'');checks.push('unsaved-preparation-blocks-context-until-explicit-cancel');await context.close();return;
 }
 await page.click(`input[type="radio"][value="${numberMode}"]`);
 await page.click('input[type="checkbox"]');
 const boxes=await page.$$('input[type="checkbox"]');await boxes.at(-1).click();
 assert.equal(await page.$$eval('input[type="password"]',elements=>elements.length),0);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width);
 if(mode==='saved')await page.screenshot({path:path.join(evidence,`preparation-${width}.png`),fullPage:true});
 if(mode==='sdk-unsent')await page.evaluate(()=>{window.fixtureSDKFailure=true;});
 await click(page,'Guardar preparación');
 if(mode.startsWith('access-post-')||mode==='access-close-absent'){
  await page.waitForFunction(()=>!document.querySelector('input[maxlength="70"]'));assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Empresa de ensayo'));assert.equal(posts.length,1);assert.equal((await page.evaluate(scope=>window.fixtureJournal.list(scope),scope)).length,1);assert.equal(await page.$$eval('button',buttons=>buttons.some(b=>b.textContent==='Reenviar mismo intento')),false);await assertPrivateStorage(page);
  await page.screenshot({path:path.join(evidence,`${mode}-${width}.png`),fullPage:true});await click(page,'Comprobar preparación');
  if(mode==='access-close-absent'){await wait(page,'no se pueden reconstruir');assert.equal(await page.$$eval('button',buttons=>buttons.some(b=>b.textContent==='Reenviar mismo intento')),false);assert.equal((await page.evaluate(scope=>window.fixtureJournal.list(scope),scope)).length,1);await click(page,'Cerrar consulta y conservar referencia');await page.waitForFunction(()=>!document.querySelector('#change-worksite').disabled);assert.equal((await page.evaluate(scope=>window.fixtureJournal.list(scope),scope)).length,1);await page.screenshot({path:path.join(evidence,`access-close-absent-${width}-local-close.png`),fullPage:true});}
  else{await wait(page,'Preparación guardada');assert.equal((await page.evaluate(scope=>window.fixtureJournal.list(scope),scope)).length,0);await page.waitForFunction(()=>!document.querySelector('#change-worksite').disabled);}
  assert.equal(posts.length,1);checks.push(`${mode}-${width}-dispatched-reference-retained-same-GET-no-repost`);await context.close();return;
 }else if(mode==='uncertain'){
   await wait(page,'guardado quedó sin confirmar');assert.equal(posts.length,1);await click(page,'Comprobar preparación');await wait(page,'Preparación guardada');assert.equal(posts.length,1);checks.push('uncertain-save-recovers-with-no-repost');
 }else if(mode.startsWith('denied-')&&mode!=='denied-refresh'){
   await wait(page,'guardado quedó sin confirmar');assert.equal(posts.length,1);assert.equal((await page.evaluate(scope=>window.fixtureJournal.list(scope),scope)).length,1);
   await click(page,'Comprobar preparación');await page.waitForFunction(()=>document.querySelector('input[maxlength="70"]')===null);
   assert.equal(posts.length,1);assert.equal((await page.evaluate(scope=>window.fixtureJournal.list(scope),scope)).length,1);
   const hidden=await page.evaluate(()=>document.body.innerText);assert.ok(!hidden.includes('Empresa de ensayo'));assert.ok(!hidden.includes('Asistente de mi obra'));assert.equal(await page.$$eval('button',buttons=>buttons.some(button=>button.textContent==='Reenviar mismo intento')),false);
   await assertPrivateStorage(page);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(evidence,`${mode}-${width}.png`),fullPage:true});
   await click(page,'Comprobar preparación');
   if(mode==='denied-absent'){await wait(page,'no se pueden reconstruir');assert.equal(await page.$eval('input[maxlength="70"]',input=>input.value),'');assert.equal(await page.$$eval('button',buttons=>buttons.some(button=>button.textContent==='Reenviar mismo intento')),false);assert.equal((await page.evaluate(scope=>window.fixtureJournal.list(scope),scope)).length,1);}
   else{await wait(page,'Preparación guardada');assert.equal((await page.evaluate(scope=>window.fixtureJournal.list(scope),scope)).length,0);}
   assert.equal(posts.length,1);checks.push(`${mode}-${width}-hides-private-data-retains-only-reference-and-rechecks-by-GET`);
 }else if(['malformed-post','malformed-get'].includes(mode)){
   await page.waitForFunction(()=>document.body.innerText.includes('guardado quedó sin confirmar')||document.body.innerText.includes('guardado sigue sin confirmar'));assert.equal((await page.evaluate(scope=>window.fixtureJournal.list(scope),scope)).length,1);if(mode==='malformed-post'){assert.equal(await page.$('input[maxlength="70"]'),null);assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Empresa de ensayo'));}await click(page,'Comprobar preparación');
   if(mode==='malformed-get'){await wait(page,'No se pudo verificar la respuesta');assert.equal((await page.evaluate(scope=>window.fixtureJournal.list(scope),scope)).length,1);assert.ok(!(await page.$eval('[role="status"]',node=>node.innerText)).includes('Preparación guardada'));await click(page,'Comprobar preparación');}
   await wait(page,'Preparación guardada');assert.equal(posts.length,1);assert.equal((await page.evaluate(scope=>window.fixtureJournal.list(scope),scope)).length,0);checks.push(`${mode}-validated-before-journal-ack-no-repost`);
 }else if(mode==='sdk-unsent'){
   await wait(page,'No se pudo renovar tu sesión');assert.equal(posts.length,0);assert.equal((await page.evaluate(scope=>window.fixtureJournal.list(scope),scope)).length,0);assert.equal(await page.$eval('input[maxlength="70"]',input=>input.value),'Asistente de mi obra');await page.evaluate(()=>{window.fixtureSDKFailure=false;});await click(page,'Guardar preparación');await wait(page,'Preparación guardada');assert.equal(posts.length,1);checks.push('new-known-unsent-session-failure-preserves-draft-without-phantom-reference');
 }else if(mode==='sdk-prior'){
   await wait(page,'guardado quedó sin confirmar');await page.evaluate(()=>{window.fixtureFailToken=true;});await click(page,'Comprobar preparación');await wait(page,'Volvé a ingresar');assert.equal(await page.$('input[maxlength="70"]'),null);assert.equal((await page.evaluate(scope=>window.fixtureJournal.list(scope),scope)).length,1);await page.evaluate(()=>{window.fixtureFailToken=false;});await click(page,'Comprobar preparación');await wait(page,'Preparación guardada');assert.equal(posts.length,1);checks.push('previous-uncertain-reference-survives-current-session-failure');
 }else if(['no-arrival','rollback'].includes(mode)){
   await wait(page,'guardado quedó sin confirmar');assert.equal(posts.length,1);assert.equal(receipt,null);assert.equal(await page.$eval('#change-worksite',button=>button.disabled),true);
   assert.equal(await page.$$eval('button',buttons=>buttons.some(button=>button.textContent==='Reenviar mismo intento')),false);
   await click(page,'Comprobar preparación');await wait(page,'No se reenvía automáticamente');assert.equal(posts.length,1);assert.equal(await page.$eval('input[maxlength="70"]',input=>input.disabled),true);assert.equal(await page.$eval('#change-worksite',button=>button.disabled),true);
   await click(page,'Reenviar mismo intento');await wait(page,'Preparación guardada');assert.equal(posts.length,2);assert.equal(postBodies[0],postBodies[1]);await page.waitForFunction(()=>!document.querySelector('#change-worksite').disabled);checks.push(`${mode}-checked-absence-explicit-identical-retry`);
 }else if(mode==='conflict'){
   await wait(page,'preparación cambió');assert.equal(await page.$eval('input[maxlength="70"]',input=>input.value),'Asistente de mi obra');assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Preparación guardada'));
   await click(page,'Consultar versión actual sin perder mi edición');await wait(page,'Preparación actual de otro administrador');assert.equal(posts.length,1);assert.equal(await page.$eval('input[maxlength="70"]',input=>input.value),'Asistente de mi obra');assert.equal(await page.$$eval('button',buttons=>buttons.find(button=>button.textContent==='Guardar preparación').disabled),true);
   await page.click('input[data-revision-reviewed]');await click(page,'Guardar preparación');await wait(page,'Preparación guardada');assert.equal(posts.length,2);assert.equal(posts[1].profile.expectedRevision,2);assert.notEqual(posts[0].operationId,posts[1].operationId);checks.push('conflict-preserves-draft-requires-current-revision-review-before-explicit-save');
 }else{
   await wait(page,'Preparación guardada');assert.equal(posts.length,1);checks.push(`saved-${numberMode}-${width}`);
   if(mode==='denied-refresh'){await click(page,'Volver a cargar');await page.waitForFunction(()=>document.querySelector('input[maxlength="70"]')===null);assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Empresa de ensayo'));assert.equal(posts.length,1);assert.equal((await page.evaluate(scope=>window.fixtureJournal.list(scope),scope)).length,0);checks.push('denied-snapshot-refresh-hides-old-preparation');await context.close();return;}
 }
 assert.equal(await page.$$eval('button',buttons=>buttons.some(button=>button.textContent.startsWith('Autorizar con Meta'))),false);
 assert.ok((await page.evaluate(()=>document.body.innerText)).includes('Autorizar WhatsApp con Meta'));
 assert.ok((await page.evaluate(()=>document.body.innerText)).includes('Sin verificar'));
 if(receipt&&mode!=='denied-absent'){
  assert.equal(await page.$eval('a[href="#customer-meta-title"]',link=>link.textContent),'Consultar autorización y conexión en Meta');
  if(numberMode==='DEDICATED'){assert.ok((await page.evaluate(()=>document.body.innerText)).includes('comprobar la autorización vigente'));assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Falta autorizar en Meta'));assert.ok(!(await page.$eval('[role="status"]',node=>node.innerText)).includes('todavía no quedó conectado'));}
  else assert.ok((await page.evaluate(()=>document.body.innerText)).includes('no inicies un alta dedicada'));
  await page.focus('a[href="#customer-meta-title"]');await page.keyboard.press('Enter');await page.waitForFunction(()=>location.hash==='#customer-meta-title');
 }
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(external,[]);
 await assertPrivateStorage(page);
 await context.close();
}
try{
 let ready=false;for(let attempt=0;attempt<120;attempt++){if(server.exitCode!==null)throw new Error('Fixture server exited');try{const response=await fetch(origin);if(response.ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,500));}assert.ok(ready);
 browser=await puppeteer.launch({headless:true,...(process.platform==='win32'?{channel:'chrome'}:{}),args:['--no-sandbox','--disable-setuid-sandbox']});
 if(!focusedScenario){for(const width of [320,390,768,1280])await scenario('saved',width);
 for(const mode of ['BUSINESS_APP','EXISTING_API'])await scenario('saved',390,mode);
 await scenario('draft-cancel');await scenario('uncertain');await scenario('no-arrival');await scenario('rollback');await scenario('conflict');
 for(const width of [320,390,768,1280])await scenario('denied-401',width);
 for(const mode of ['denied-403','denied-context','denied-absent','denied-refresh','malformed-post','malformed-get','sdk-unsent','sdk-prior','stored-record'])await scenario(mode);}
 const accessModes=['access-load-html401','access-load-html403','access-load-project404','access-post-html401','access-post-html403','access-post-json403','access-post-project404'];
 if(focusedScenario)await scenario(focusedScenario);else{for(const width of [320,390,768,1280])for(const mode of accessModes)await scenario(mode,width);for(const width of [320,390])await scenario('access-close-absent',width);}
 assert.deepEqual(pageErrors,[]);
 const proof={status:'PASS',environment:'real-component-with-synthetic-intercepted-api',checkedAt:new Date().toISOString(),checks,widths:focusedScenario?[390]:[320,390,768,1280],fullSuite:!focusedScenario,focusedScenario,sourceManifest,harnessSha256:createHash('sha256').update(readFileSync(path.join(root,'scripts/verify-customer-whatsapp-ui.mjs'))).digest('hex'),pageErrors,metaCalls:0,realCustomerAuthorization:false,productionDataWritten:false};
 rmSync(path.join(evidence,'failure.json'),{force:true});writeFileSync(path.join(evidence,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(error){writeFileSync(path.join(evidence,'failure.json'),JSON.stringify({status:'FAILED',activeScenario,message:error.message,pageErrors,serverLog},null,2));throw error;}
finally{await browser?.close();try{if(process.platform!=='win32')process.kill(-server.pid,'SIGTERM');else server.kill();}catch{}await new Promise(resolve=>setTimeout(resolve,500));const resolved=realpathSync(fixture);assert.equal(path.dirname(resolved),realpathSync(parent));assert.ok(path.basename(resolved).startsWith('customer-whatsapp-ui-'));rmSync(resolved,{recursive:true,force:true});}
