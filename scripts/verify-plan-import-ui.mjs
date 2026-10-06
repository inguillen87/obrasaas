import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,copyFileSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import puppeteer from 'puppeteer';
assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV);
const root=process.cwd(),scratch=path.join(root,'.vercel/private');mkdirSync(scratch,{recursive:true});
const fixture=mkdtempSync(path.join(scratch,'plan-ui-')),app=path.join(fixture,'app');mkdirSync(app);
for(const name of ['plan-import-panel.js','plan-import-panel.module.css','workspace-session-request.mjs','workspace-request-lifecycle.js','workspace-request-lifecycle.mjs','workspace-recovery-journal.mjs','site-purchase-view.mjs','company-channel-view.mjs','workspace-recovery-storage.mjs'])copyFileSync(path.join(root,'src/app/(identity)/cuenta',name),path.join(app,name));
writeFileSync(path.join(fixture,'package.json'),JSON.stringify({private:true}));writeFileSync(path.join(fixture,'next.config.mjs'),`export default {devIndicators:false,turbopack:{root:${JSON.stringify(root)}}};`);
writeFileSync(path.join(app,'layout.js'),`export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:12,fontFamily:'Arial'}}>{children}</body></html>}`);
const scope='a'.repeat(64),projectId='project-fixture';
writeFileSync(path.join(app,'page.js'),`'use client';import {useState} from 'react';import {PlanImportPanel} from './plan-import-panel';export default function Page(){const [tasks,setTasks]=useState([]);return <main style={{maxWidth:1000,margin:'auto'}}><PlanImportPanel projectId="${projectId}" scope="${scope}" getSessionToken={async()=> 'synthetic-plan-token'} onApplied={setTasks}/><p data-task-count>Tareas canónicas recibidas: {tasks.length}</p></main>}`);
const sourceFile=path.join(fixture,'synthetic-schedule.pdf');writeFileSync(sourceFile,'%PDF-1.7\nSynthetic Gantt fixture\n%%EOF');
const port=3138,origin='http://127.0.0.1:'+port,server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',fixture,'--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'],windowsHide:true});
let log='',browser;for(const stream of [server.stdout,server.stderr])stream.on('data',data=>{log=(log+data).slice(-12000);});
const checks=[],errors=[];const widths=[320,390,768,1280],modes=['apply','ambiguous','recover','manager'];
const row={title:'Fundaciones sintéticas',startsOn:'2026-10-08',endsOn:'2026-10-10',evidence:'Fila 1 del archivo',uncertainty:''};
async function click(page,text){await page.waitForFunction(label=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===label&&!b.disabled),{},text);const button=await page.evaluateHandle(label=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===label),text);await button.asElement().click();await button.dispose();}
const wait=(page,text)=>page.waitForFunction(label=>document.body.innerText.includes(label),{},text);
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
 assert.deepEqual(errors,[]);writeFileSync(path.join(scratch,'plan-import-ui-validation.json'),JSON.stringify({validated:true,synthetic:true,realProviderCalls:false,widths,checks},null,2)+'\n');console.log(JSON.stringify({validated:true,synthetic:true,realProviderCalls:false,checks:checks.length}));
}catch(error){console.error(JSON.stringify({log,errors,checks}));throw error;}finally{await browser?.close();server.kill();assert.ok(path.resolve(fixture).startsWith(path.resolve(scratch)+path.sep));rmSync(fixture,{recursive:true,force:true});}
