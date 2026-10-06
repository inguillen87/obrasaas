import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,copyFileSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import puppeteer from 'puppeteer';
import {PARTICIPANT_NOTICE,PARTICIPANT_NOTICE_VERSION,PARTICIPANT_OCR_NOTICE,PARTICIPANT_OCR_NOTICE_VERSION,PARTICIPANT_BIOMETRIC_NOTICE,PARTICIPANT_BIOMETRIC_NOTICE_VERSION} from '../src/lib/participant-policy.mjs';

assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV);
const root=process.cwd(),scratch=path.join(root,'.vercel');mkdirSync(scratch,{recursive:true});
const fixture=mkdtempSync(path.join(scratch,'participant-ai-ui-')),app=path.join(fixture,'app');mkdirSync(app);
for(const name of ['participant-panel.js','participant-panel.module.css','kyc-photo-preparation.js','field-media-preparation.mjs','workspace-session-request.mjs','workspace-request-lifecycle.js','workspace-request-lifecycle.mjs','workspace-recovery-journal.mjs','site-purchase-view.mjs','workspace-recovery-storage.mjs'])copyFileSync(path.join(root,'src/app/(identity)/cuenta',name),path.join(app,name));
writeFileSync(path.join(fixture,'package.json'),JSON.stringify({private:true}));writeFileSync(path.join(fixture,'next.config.mjs'),`export default {devIndicators:false,turbopack:{root:${JSON.stringify(root)}}};`);
writeFileSync(path.join(app,'layout.js'),`export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:12,fontFamily:'Arial'}}>{children}</body></html>}`);
const scope='a'.repeat(64),projectId='project-fixture';
writeFileSync(path.join(app,'page.js'),`'use client';import {ParticipantPanel} from './participant-panel';export default function Page(){return <main style={{maxWidth:1000,margin:'auto'}}><ParticipantPanel projectId="${projectId}" scope="${scope}" getSessionToken={async()=> 'synthetic-participant-ai-token'}/></main>}`);
const port=3124,origin='http://127.0.0.1:'+port,server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',fixture,'--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
let log='',browser;for(const stream of [server.stdout,server.stderr])stream.on('data',data=>{log=(log+data).slice(-12000);});
const checks=[],errors=[];writeFileSync(path.join(scratch,'participant-ai-ui.json'),JSON.stringify({validated:false,running:true,synthetic:true,realProviderCalls:false,checks:[]}));
async function click(page,text){await page.waitForFunction(label=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===label&&!b.disabled),{},text);const button=await page.evaluateHandle(label=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===label),text);await button.asElement().click();await button.dispose();}
const wait=(page,text)=>page.waitForFunction(label=>document.body.innerText.includes(label),{},text);
try{
 for(let attempt=0;attempt<90;attempt++){try{const response=await fetch(origin);if(response.ok)break;}catch{}if(server.exitCode!==null)throw Error(log);await new Promise(resolve=>setTimeout(resolve,500));if(attempt===89)throw Error(log);}
 browser=await puppeteer.launch({headless:true,args:['--no-sandbox']});
 for(const width of [320,390,768,1280])for(const mode of ['extract','biometric-only','recover','manual','challenge','self']){
  const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1050});page.on('pageerror',error=>errors.push(error.message));await page.setRequestInterception(true);
  let row={id:'worker-fixture',name:'Persona sintética',active:true,revision:'2026-10-05T00:00:00.000001',status:mode==='challenge'?'INVITED':'ACTIVE',self:mode==='self',accountLinked:mode!=='challenge',invitation:null,permissions:{attendance:false,report:false},identityCertified:false,whatsAppAccessGranted:false,kyc:{status:['self','challenge'].includes(mode)?'NOT_SUBMITTED':'PENDING_REVIEW',submissionId:['self','challenge'].includes(mode)?null:'kyc-fixture',ocrConsent:{allowed:!['manual','biometric-only'].includes(mode)},biometricConsent:{allowed:['extract','biometric-only'].includes(mode)},images:[],processing:null}};
  const posts=[],queries=[];let receipt;
  const snapshot=()=>({scope,projectId,canManage:mode!=='self',canInvite:false,canManageOfficeRoles:false,existingAccounts:[],records:[row],privacyNotice:{version:PARTICIPANT_NOTICE_VERSION,text:PARTICIPANT_NOTICE},externalOcrNotice:{version:PARTICIPANT_OCR_NOTICE_VERSION,text:PARTICIPANT_OCR_NOTICE},privateBiometricNotice:{version:PARTICIPANT_BIOMETRIC_NOTICE_VERSION,text:PARTICIPANT_BIOMETRIC_NOTICE}});
  const send=(request,value)=>request.respond({status:200,contentType:'application/json',headers:{'Cache-Control':'private, no-store'},body:JSON.stringify(value)});
  page.on('request',async request=>{try{
   const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();throw Error('Unexpected external request');}if(url.pathname!=='/api/identity/participants')return request.continue();
   assert.equal(request.headers().authorization,'Bearer synthetic-participant-ai-token');
   if(request.method()==='POST'){
    const body=JSON.parse(request.postData());posts.push(body);assert.equal(body.projectId,projectId);assert.equal(body.scope,scope);
    if(mode==='challenge'){assert.equal(body.action,'PREPARE_KYC_CHAT');assert.deepEqual(Object.keys(body.payload).sort(),['revision','workerId']);receipt={scope,saved:true,receiptId:'participant-fixture',participant:row,kind:'PREPARE_KYC_CHAT',code:'IDENTIDAD '+'a'.repeat(43),codeUnavailable:false,expiresAt:'2026-10-06T00:00:00Z'};return send(request,receipt);}
    assert.equal(body.action,'PROCESS_KYC');assert.equal(body.payload.submissionId,'kyc-fixture');
    if(mode==='recover')return send(request,{scope,state:'PROCESSING',definitive:false,workerId:row.id,submissionId:'kyc-fixture',expiresAt:'2026-10-06T00:00:00Z',retryAfterExpiration:false});
    row={...row,kyc:{...row.kyc,processing:{status:mode==='biometric-only'?'ADVISORY_UNREVIEWED':'EXTRACTED_UNVERIFIED',...(mode==='biometric-only'?{}:{fields:{nombreCompleto:'Persona OCR privada',dni:'12345678',cuil:null}}),biometrics:{status:'ADVISORY_UNREVIEWED',faceSimilarity:0.61,captureRiskSignal:0.15,livenessVerified:false}}}};receipt={scope,saved:true,receiptId:'participant-fixture',participant:row};return send(request,receipt);
   }
   if(url.searchParams.has('operationId')){queries.push(url.searchParams.get('operationId'));return send(request,receipt?{state:'RECORDED',...receipt}:{scope,state:'PROCESSING',definitive:false,workerId:row.id,submissionId:'kyc-fixture',expiresAt:'2026-10-06T00:00:00Z',retryAfterExpiration:false});}
   return send(request,snapshot());
  }catch(error){errors.push(error.message);if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}});
  await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await click(page,'Consultar participantes');await wait(page,'Persona sintética');
  if(['extract','biometric-only','recover'].includes(mode)){
   await click(page,mode==='biometric-only'?'Preparar comparación facial':'Preparar lectura asistida');assert.equal(posts.length,0);await wait(page,mode==='biometric-only'?'autorizó la comparación facial privada':'Se enviará únicamente el frente');if(mode==='biometric-only')assert.equal(await page.evaluate(()=>document.body.innerText.includes('Se enviará únicamente el frente')),false);await click(page,mode==='biometric-only'?'Comparar fotografías en privado':'Leer texto del documento');
   if(['extract','biometric-only'].includes(mode)){if(mode==='extract')await wait(page,'Texto extraído sin verificar');else assert.equal(await page.evaluate(()=>document.body.innerText.includes('Texto extraído sin verificar')),false);await wait(page,'Prueba de vida no verificada');assert.ok(await page.evaluate(()=>document.body.innerText.includes('Pendiente de revisión humana')));assert.equal(posts.length,1);}
   else{await wait(page,'El análisis está en curso');await click(page,'Comprobar el mismo intento');await wait(page,'El análisis está en curso');assert.equal(posts.length,1);assert.equal(queries.length,1);assert.equal(await page.evaluate(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Reintentar exactamente'))),false);}
  }else if(mode==='manual'){assert.equal(await page.evaluate(()=>document.body.innerText.includes('Preparar lectura asistida')),false);assert.ok(await page.evaluate(()=>document.body.innerText.includes('Registrar revisión humana')));assert.equal(posts.length,0);}
  else if(mode==='challenge'){await click(page,'Preparar identidad por WhatsApp');assert.equal(posts.length,0);await click(page,'Crear código privado');await wait(page,'IDENTIDAD '+'a'.repeat(43));assert.equal(posts.length,1);await click(page,'Ocultar código');assert.equal(await page.evaluate(()=>document.body.innerText.includes('IDENTIDAD ')),false);}
  else{await click(page,'Presentar mi identidad');await page.evaluate(()=>document.querySelectorAll('details').forEach(element=>{element.open=true;}));const choices=await page.$$eval('input[type=checkbox]',inputs=>inputs.map(input=>({required:input.required,checked:input.checked})));assert.deepEqual(choices,[{required:true,checked:false},{required:false,checked:false},{required:false,checked:false}]);await wait(page,'Podés autorizar esta comparación sin autorizar el envío');assert.equal(posts.length,0);}
  const stored=await page.evaluate(()=>JSON.stringify([Object.values(localStorage),Object.values(sessionStorage)]));assert.doesNotMatch(stored,/Persona OCR|12345678|IDENTIDAD|synthetic-participant-ai-token|faceSimilarity|data:image/);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow '+mode+' '+width);
  checks.push({width,mode,posts:posts.length,recoveryReads:queries.length,sensitiveStorage:false});await context.close();
 }
 assert.deepEqual(errors,[]);writeFileSync(path.join(scratch,'participant-ai-ui.json'),JSON.stringify({validated:true,synthetic:true,realProviderCalls:false,checks},null,2));console.log(JSON.stringify({validated:true,checks:checks.length,synthetic:true,realProviderCalls:false}));
}catch(error){console.error(log);throw error;}finally{await browser?.close();server.kill();assert.ok(path.resolve(fixture).startsWith(path.resolve(scratch)+path.sep));rmSync(fixture,{recursive:true,force:true});}
