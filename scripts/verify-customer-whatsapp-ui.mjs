import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,copyFileSync,writeFileSync,rmSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import puppeteer from 'puppeteer';
import {WORKSPACE_NUMBER_MODES,WORKSPACE_USE_CASES,tenantWorkspaceFromMetadata} from '../src/lib/whatsapp/tenant-workspace-policy.js';
import {customerWhatsAppReadiness} from '../src/lib/customer-whatsapp-setup.mjs';
assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV);
const root=realpathSync(process.cwd()),parent=path.join(root,'.vercel'),evidence=path.join(parent,'customer-whatsapp-evidence');mkdirSync(evidence,{recursive:true});
const fixture=mkdtempSync(path.join(root,'.vercel/customer-whatsapp-ui-')),app=path.join(fixture,'app');mkdirSync(app);
for(const name of ['customer-whatsapp-panel.js','customer-whatsapp-panel.module.css'])copyFileSync(path.join(root,'src/app/(identity)/cuenta',name),path.join(app,name));
writeFileSync(path.join(fixture,'package.json'),JSON.stringify({name:'customer-whatsapp-fixture',private:true}));
writeFileSync(path.join(fixture,'next.config.mjs'),`export default {turbopack:{root:${JSON.stringify(root)}}};`);
const scope='a'.repeat(64),projectId='project-a';
writeFileSync(path.join(app,'layout.js'),`export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:12,background:'#081b2b',fontFamily:'Arial,sans-serif'}}>{children}</body></html>}`);
writeFileSync(path.join(app,'page.js'),`'use client';import {useState} from 'react';import {CustomerWhatsAppPanel} from './customer-whatsapp-panel';export default function Page(){const [pending,setPending]=useState(false);return <main style={{maxWidth:1000,margin:'0 auto'}}><button id="change-worksite" disabled={pending}>Cambiar obra</button><CustomerWhatsAppPanel projectId="${projectId}" scope="${scope}" onPending={setPending}/></main>}`);
const port=3109,origin='http://127.0.0.1:'+port;
const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',fixture,'--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
let serverLog='';for(const stream of [server.stdout,server.stderr])stream.on('data',data=>{serverLog=(serverLog+data.toString()).slice(-16000);});
let browser;const checks=[],pageErrors=[];
async function click(page,text){const handle=await page.evaluateHandle(value=>[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===value),text);const button=handle.asElement();assert.ok(button,text);await button.click();await handle.dispose();}
const wait=(page,value)=>page.waitForFunction(text=>document.body.innerText.includes(text),{timeout:12000},value);
async function scenario(mode,width=390,numberMode='DEDICATED'){
 const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1100});
 page.on('pageerror',error=>pageErrors.push(error.message));await page.setRequestInterception(true);
 const posts=[],postBodies=[],requests=[],external=[];let receipt=null;
 let profile=tenantWorkspaceFromMetadata(null);
 const current=()=>({scope,projectId,projectName:'Obra de prueba',companyName:'Empresa de ensayo',profile,connection:null,
  readiness:customerWhatsAppReadiness(profile,null),options:{numberModes:WORKSPACE_NUMBER_MODES,useCases:WORKSPACE_USE_CASES}});
 page.on('request',async request=>{
  try{
   const url=new URL(request.url());
   if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();external.push(url.hostname);return request.abort();}
   if(url.pathname!=='/api/identity/whatsapp-setup')return request.continue();
   requests.push(request.method());let response,status=200;
   if(request.method()==='POST'){
    const command=JSON.parse(request.postData());posts.push(command);postBodies.push(request.postData());assert.equal(command.projectId,projectId);assert.equal(command.scope,scope);assert.equal(command.profile.numberMode,numberMode);assert.equal(command.profile.confirmOwnership,true);
    assert.deepEqual(Object.keys(command).sort(),['operationId','profile','projectId','scope']);
    assert.ok(!request.postData().match(/token|secret|password/i));
    if(mode==='no-arrival'&&posts.length===1)return request.abort('failed');
    if(mode==='rollback'&&posts.length===1){status=503;response={code:'WORKSPACE_OPERATION_UNCONFIRMED'};}
    else if(mode==='conflict'){status=409;response={code:'WORKSPACE_CONFLICT'};}
    else{
      profile={...command.profile,configured:true,revision:1,ownership:'CUSTOMER',mode:'REVIEW_REQUIRED',updatedAt:'2026-10-01T00:00:00Z'};
      receipt={id:'wa_preparation_'+ 'b'.repeat(64),savedRevision:1};response={...current(),saved:true,savedProfileIsCurrent:true,receipt};
      if(mode==='uncertain'){status=503;response={code:'WORKSPACE_OPERATION_UNCONFIRMED'};}
    }
   }else{
    assert.equal(url.searchParams.get('projectId'),projectId);assert.equal(url.searchParams.get('scope'),scope);
    if(url.searchParams.has('operationId')){assert.equal(url.searchParams.get('operationId'),posts[0].operationId);response=receipt?{...current(),state:'RECORDED',saved:true,savedProfileIsCurrent:true,receipt}:{...current(),state:'NOT_OBSERVED',definitive:false};}else response=current();
   }
   await request.respond({status,contentType:'application/json',body:JSON.stringify(response)});
  }catch(error){pageErrors.push(error.message);if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}
 });
 await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});assert.equal(requests.length,0);
 await click(page,'Preparar WhatsApp');await wait(page,'Empresa de ensayo');
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
 await click(page,'Guardar preparación');
 if(mode==='uncertain'){
   await wait(page,'guardado quedó sin confirmar');assert.equal(posts.length,1);await click(page,'Comprobar preparación');await wait(page,'Preparación guardada');assert.equal(posts.length,1);checks.push('uncertain-save-recovers-with-no-repost');
 }else if(['no-arrival','rollback'].includes(mode)){
   await wait(page,'guardado quedó sin confirmar');assert.equal(posts.length,1);assert.equal(receipt,null);assert.equal(await page.$eval('#change-worksite',button=>button.disabled),true);
   assert.equal(await page.$$eval('button',buttons=>buttons.some(button=>button.textContent==='Reenviar mismo intento')),false);
   await click(page,'Comprobar preparación');await wait(page,'No se reenvía automáticamente');assert.equal(posts.length,1);assert.equal(await page.$eval('input[maxlength="70"]',input=>input.disabled),true);assert.equal(await page.$eval('#change-worksite',button=>button.disabled),true);
   await click(page,'Reenviar mismo intento');await wait(page,'Preparación guardada');assert.equal(posts.length,2);assert.equal(postBodies[0],postBodies[1]);await page.waitForFunction(()=>!document.querySelector('#change-worksite').disabled);checks.push(`${mode}-checked-absence-explicit-identical-retry`);
 }else if(mode==='conflict'){
   await wait(page,'preparación cambió');assert.equal(await page.$eval('input[maxlength="70"]',input=>input.value),'Asistente de mi obra');assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Preparación guardada'));checks.push('conflict-does-not-show-success-or-discard-draft');
 }else{
   await wait(page,'Preparación guardada');assert.equal(posts.length,1);checks.push(`saved-${numberMode}-${width}`);
 }
 assert.equal(await page.$$eval('button',buttons=>buttons.some(button=>button.textContent.startsWith('Autorizar con Meta'))),false);
 assert.ok((await page.evaluate(()=>document.body.innerText)).includes('Autorizar WhatsApp con Meta'));
 assert.ok((await page.evaluate(()=>document.body.innerText)).includes('Sin verificar'));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(external,[]);
 await context.close();
}
try{
 let ready=false;for(let attempt=0;attempt<120;attempt++){if(server.exitCode!==null)throw new Error('Fixture server exited');try{const response=await fetch(origin);if(response.ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,500));}assert.ok(ready);
 browser=await puppeteer.launch({headless:true,...(process.platform==='win32'?{channel:'chrome'}:{}),args:['--no-sandbox','--disable-setuid-sandbox']});
 for(const width of [320,390,768,1280])await scenario('saved',width);
 for(const mode of ['BUSINESS_APP','EXISTING_API'])await scenario('saved',390,mode);
 await scenario('draft-cancel');await scenario('uncertain');await scenario('no-arrival');await scenario('rollback');await scenario('conflict');assert.deepEqual(pageErrors,[]);
 const proof={status:'PASS',environment:'real-component-with-synthetic-intercepted-api',checks,widths:[320,390,768,1280],pageErrors,metaCalls:0,realCustomerAuthorization:false,productionDataWritten:false};
 rmSync(path.join(evidence,'failure.json'),{force:true});writeFileSync(path.join(evidence,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(error){writeFileSync(path.join(evidence,'failure.json'),JSON.stringify({status:'FAILED',message:error.message,pageErrors,serverLog},null,2));throw error;}
finally{await browser?.close();try{if(process.platform!=='win32')process.kill(-server.pid,'SIGTERM');else server.kill();}catch{}await new Promise(resolve=>setTimeout(resolve,500));const resolved=realpathSync(fixture);assert.equal(path.dirname(resolved),realpathSync(parent));assert.ok(path.basename(resolved).startsWith('customer-whatsapp-ui-'));rmSync(resolved,{recursive:true,force:true});}
