import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,copyFileSync,writeFileSync,rmSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import puppeteer from 'puppeteer';

// Real React/Next component, controlled synthetic services. Never logs into Meta.
assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV);
const root=realpathSync(process.cwd()),parent=path.join(root,'.vercel'),evidence=path.join(parent,'meta-customer-evidence');mkdirSync(evidence,{recursive:true});
const fixture=mkdtempSync(path.join(parent,'meta-customer-ui-')),app=path.join(fixture,'app');mkdirSync(app);
for(const file of ['meta-onboarding-panel.js','meta-onboarding-panel.module.css'])copyFileSync(path.join(root,'src/app/(identity)/cuenta',file),path.join(app,file));
writeFileSync(path.join(fixture,'package.json'),JSON.stringify({name:'synthetic-meta-customer-ui',private:true}));
writeFileSync(path.join(fixture,'next.config.mjs'),`export default {devIndicators:false,turbopack:{root:${JSON.stringify(root)}}};`);
writeFileSync(path.join(app,'layout.js'),`export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:12,background:'#f4f7f9',fontFamily:'Arial,sans-serif'}}>{children}</body></html>}`);
writeFileSync(path.join(app,'page.js'),`'use client';import {useState,useCallback} from 'react';import {MetaOnboardingPanel} from './meta-onboarding-panel';export default function Page(){const [project,setProject]=useState('p-a'),[pending,setPending]=useState(false);const onPending=useCallback(value=>setPending(value),[]);return <main style={{maxWidth:1040,margin:'0 auto'}}><button id="switch-company" disabled={pending} onClick={()=>setProject(project==='p-a'?'p-b':'p-a')}>Cambiar empresa</button><span id="pending">{pending?'Pendiente':'Disponible'}</span><MetaOnboardingPanel key={project} projectId={project} scope={project==='p-a'?'a'.repeat(64):'b'.repeat(64)} onPending={onPending}/></main>}`);
const origin='http://127.0.0.1:3116',server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',fixture,'--webpack','--hostname','127.0.0.1','--port','3116'],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
let log='',browser;const errors=[],checks=[];for(const stream of [server.stdout,server.stderr])stream.on('data',chunk=>{log=(log+chunk.toString()).slice(-16000);});
async function click(page,label){const handle=await page.evaluateHandle(text=>[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===text),label);assert.ok(handle.asElement(),'Missing button '+label);await handle.asElement().click();await handle.dispose();}
const wait=(page,text)=>page.waitForFunction(value=>document.body.innerText.includes(value),{timeout:20000},text);
const buttonDisabled=(page,label)=>page.evaluate(text=>[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===text)?.disabled,label);
const signup=state=>({id:'12345678-1234-4234-8234-123456789012',state,canCancel:state==='PREPARED',canReconcile:state==='REVIEW_REQUIRED',operational:false});
const base=(projectId,mode)=>({scope:(projectId==='p-a'?'a':'b').repeat(64),projectId,companyName:projectId==='p-a'?'Constructora de ensayo A':'Constructora de ensayo B',projectName:projectId==='p-a'?'Obra de ensayo A':'Obra de ensayo B',prepared:mode!=='missing',numberMode:mode==='business'?'BUSINESS_APP':'DEDICATED',preparedRevision:1,
 readiness:{canLaunchMeta:!['pending','business','missing'].includes(mode),appId:'1665088767899217',configId:'123456789123456',version:'v25.0',operational:false},signup:['unknown','escrow'].includes(mode)?{...signup('EXCHANGE_UNKNOWN'),canRestart:mode==='escrow'}:null,connection:null,templateWorkbench:{options:[],drafts:[]},acceptance:{roundTrip:'NOT_VERIFIED',fieldJourney:'NOT_VERIFIED'}});
async function scenario(mode,width=390){
 const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1050});page.on('pageerror',error=>errors.push({mode,width,message:error.message}));
 const posts=[],external=[];let current=base('p-a',mode),readCount=0,firstUnknown=true;await page.setRequestInterception(true);
 page.on('request',async request=>{try{const url=new URL(request.url());
  if(url.hostname==='connect.facebook.net')return request.respond({status:200,contentType:'application/javascript',body:`window.FB={init:function(configuration){window.__sdkConfig=configuration;},login:function(callback,options){window.__metaLogin={callback:callback,options:options};}};window.fbAsyncInit();`});
  if(url.origin!==origin){external.push(url.hostname);return request.abort();}
  if(url.pathname!=='/api/identity/meta-onboarding')return request.continue();
  let body,status=200;
  if(request.method()==='GET'){
   readCount++;const projectId=url.searchParams.get('projectId');assert.equal(url.searchParams.get('scope'),(projectId==='p-a'?'a':'b').repeat(64));
   body=projectId==='p-b'?base('p-b','pending'):current;
   if(mode==='crossed'&&firstUnknown){firstUnknown=false;body={...body,projectId:'p-b',scope:'b'.repeat(64),companyName:'Foreign company hidden'};}
  }else{
   const payload=JSON.parse(request.postData());posts.push(payload);assert.equal(payload.projectId,'p-a');assert.equal(payload.scope,'a'.repeat(64));assert.ok(!('accessToken' in payload));
   if(payload.action==='begin'){current={...current,signup:signup('PREPARED'),stateToken:'synthetic-server-state-token'};body=current;if(mode==='uncertain'){status=503;body={code:'META_CUSTOMER_OPERATION_UNCONFIRMED'};}}
   else if(payload.action==='restart_authorization'){assert.equal(payload.confirmFreshAuthorization,true);assert.ok(payload.reason.length>=8);assert.ok(!('code' in payload));current={...current,signup:signup('PREPARED'),stateToken:'synthetic-server-state-token'};body=current;}
   else if(payload.action==='complete'){assert.equal(payload.stateToken,'synthetic-server-state-token');assert.equal(payload.code,'synthetic-code-only');assert.equal(payload.wabaId,'8888888801');assert.equal(payload.phoneNumberId,'9999999901');current={...current,signup:signup('LINKED_PENDING_ACCEPTANCE'),stateToken:null,connection:{recordPresent:true,displayNumber:'+54 synthetic company',enabled:false,storedStatus:'PENDING'}};body=current;}
   else if(payload.action==='cancel'){current={...current,signup:signup('CANCELLED'),stateToken:null};body=current;}
   else if(payload.action==='submit_template'){assert.equal(payload.review.confirmed,true);assert.equal(payload.review.contentSha256,'c'.repeat(64));current={...current,templateWorkbench:{...current.templateWorkbench,drafts:current.templateWorkbench.drafts.map(draft=>({...draft,state:'SUBMISSION_UNKNOWN',canSubmit:false,canRecover:true}))}};body=current;}
   else if(payload.action==='recover_template'){current={...current,templateWorkbench:{...current.templateWorkbench,drafts:current.templateWorkbench.drafts.map(draft=>({...draft,state:'SUBMITTED',providerStatus:'PENDING',canSubmit:false,canRecover:true}))}};body=current;}
   else if(payload.action==='process_inbox'){assert.equal(payload.eventId,'customer_webhook_'+'d'.repeat(64));current={...current,inbox:{...current.inbox,items:current.inbox.items.map(item=>({...item,status:'PROCESSED',canProcess:false,canReview:true,reviewState:'REVIEW_REQUIRED',identityStatus:'CHANNEL_IDENTITY_UNVERIFIED',intent:'COMMAND_CONFIRMATION',revision:'2026-10-01T01:00:00.000001'}))}};status=503;body={code:'META_CUSTOMER_OPERATION_UNCONFIRMED'};}
   else if(payload.action==='review_inbox'){assert.equal(payload.expectedRevision,'2026-10-01T01:00:00.000001');assert.equal(payload.decision,'REFER_TO_PARTICIPANTS');current={...current,inbox:{...current.inbox,items:current.inbox.items.map(item=>({...item,canReview:false,reviewState:'REVIEWED',reviewDecision:payload.decision}))}};body=current;}
   else throw new Error('Unexpected controlled action '+payload.action);
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  await request.respond({status,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});
 }catch(error){errors.push({mode,width,message:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}});
 if(mode==='templates'){current={...base('p-a','ready'),signup:signup('LINKED_PENDING_ACCEPTANCE'),connection:{recordPresent:true,displayNumber:'+54 synthetic',enabled:false,storedStatus:'PENDING'},templateWorkbench:{options:[],drafts:[{title:'Invitación a participar',blueprintKey:'participant_invitation',name:'obrasaas_synthetic_owned',contentSha256:'c'.repeat(64),bodyText:'Tenés una invitación de {{1}}. Abrí tu cuenta de ObraSaaS.',language:'es_AR',category:'UTILITY',state:'DRAFT',canSubmit:true,canRecover:false}]}};}
 if(mode==='inbox')current={...base('p-a','pending'),connection:{recordPresent:true,displayNumber:'+54 synthetic',enabled:false,storedStatus:'PENDING'},inbox:{canSend:false,businessApplied:false,items:[{id:'customer_webhook_'+'d'.repeat(64),revision:'2026-10-01T00:00:00.000001',status:'PENDING',processing:'NOT_LEASED',canProcess:true,canReview:false,reviewState:'NOT_PROCESSED',identityStatus:'NOT_CHECKED',businessApplied:false,replySent:false,kind:'text',from:'5491112345678',body:'Mensaje privado sintético: aprobar VP-AAAAAAAAAAAA',payloadVerified:true}]}};
 await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await click(page,'Ver conexión');
 if(mode==='crossed'){
  await wait(page,'La respuesta pertenece a otra obra');assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Foreign company hidden'));assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Constructora de ensayo B'));checks.push('foreign-response-cannot-expose-or-replace-active-company');await context.close();return;
 }
 await wait(page,'Constructora de ensayo A');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow '+mode+' '+width);
 if(['pending','missing','business'].includes(mode)){assert.equal(await buttonDisabled(page,'Preparar autorización'),true);assert.equal(posts.length,0);if(mode==='pending')await page.screenshot({path:path.join(evidence,`meta-pending-${width}.png`),fullPage:true});checks.push(mode+'-failclosed-'+width);}
 else if(mode==='unknown'){await wait(page,'El resultado del canje requiere revisión');assert.equal(posts.length,0);assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Autorizar en Meta'));checks.push('unknown-code-result-has-no-reexchange-action');}
 else if(mode==='templates'){
  assert.equal(await buttonDisabled(page,'Solicitar aprobación de invitación a participar'),true);await page.click('input[type=checkbox]');await click(page,'Solicitar aprobación de invitación a participar');await wait(page,'Solicitud pendiente de comprobar');assert.equal(posts.length,1);
  assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Solicitar aprobación de invitación a participar'));await click(page,'Comprobar invitación a participar');await wait(page,'En revisión de Meta');assert.equal(posts.filter(post=>post.action==='submit_template').length,1);checks.push('immutable-template-review-and-unknown-recovery-without-recreate');
 }
 else if(mode==='inbox'){
  await wait(page,'Recepción privada de esta obra');await wait(page,'Mensaje privado sintético');assert.equal(posts.length,0);await click(page,'Clasificar evento recibido');await wait(page,'La respuesta quedó sin confirmar');assert.equal(await page.$eval('#switch-company',button=>button.disabled),true);assert.equal(posts.length,1);
  await click(page,'Comprobar estado');await wait(page,'Revisión humana pendiente');assert.equal(posts.length,1);assert.ok((await page.evaluate(()=>document.body.innerText)).includes('La identidad del canal sigue pendiente'));assert.equal(await buttonDisabled(page,'Registrar revisión del evento'),true);
  await page.select('select','REFER_TO_PARTICIPANTS');await page.waitForFunction(()=>document.querySelector('#switch-company').disabled);await click(page,'Cancelar borrador');await page.waitForFunction(()=>!document.querySelector('#switch-company').disabled);assert.equal(await buttonDisabled(page,'Registrar revisión del evento'),true);assert.equal(posts.length,1);
  await page.select('select','REFER_TO_PARTICIPANTS');await click(page,'Registrar revisión del evento');await wait(page,'Revisión registrada');assert.equal(posts.length,2);assert.deepEqual(posts.map(post=>post.action),['process_inbox','review_inbox']);assert.ok((await page.evaluate(()=>document.body.innerText)).includes('No se aplicó una acción de negocio'));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(evidence,`meta-inbox-${width}.png`),fullPage:true});
  await page.waitForFunction(()=>!document.querySelector('#switch-company').disabled);await click(page,'Cambiar empresa');await click(page,'Ver conexión');await wait(page,'Constructora de ensayo B');assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Mensaje privado sintético'));checks.push('private-inbox-uncertain-classification-get-recovery-explicit-review-and-company-isolation-'+width);
 }
 else{
  if(mode==='escrow'){assert.equal(await buttonDisabled(page,'Preparar autorización nueva'),true);await page.type('input[type=text]','Revisé el resultado anterior y solicito una autorización nueva.');await page.click('input[type=checkbox]');await click(page,'Preparar autorización nueva');checks.push('fresh-authorization-requires-explicit-reason-and-confirmation');}
  else await click(page,'Preparar autorización');
  if(mode==='uncertain'){await wait(page,'La respuesta quedó sin confirmar');assert.equal(await page.$eval('#switch-company',button=>button.disabled),true);assert.equal(posts.length,1);await click(page,'Comprobar estado');await wait(page,'Preparado para autorizar');assert.equal(posts.length,1);checks.push('unknown-write-locks-context-and-get-recovers-without-repost');}
  else await wait(page,'Preparado para autorizar');
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.textContent.trim()==='Autorizar en Meta'&&!button.disabled));await click(page,'Autorizar en Meta');
  await page.waitForFunction(()=>document.querySelector('#switch-company').disabled);assert.equal(await page.$eval('#switch-company',button=>button.disabled),true);
  await page.evaluate(()=>{window.__metaLogin.callback({authResponse:{code:'synthetic-code-only'}});window.dispatchEvent(new MessageEvent('message',{origin:'https://www.facebook.com.attacker.example',data:JSON.stringify({type:'WA_EMBEDDED_SIGNUP',event:'FINISH',data:{waba_id:'7777777777',phone_number_id:'6666666666'}})}));});
  await new Promise(resolve=>setTimeout(resolve,120));assert.equal(posts.filter(post=>post.action==='complete').length,0);
  await page.evaluate(()=>window.dispatchEvent(new MessageEvent('message',{origin:'https://www.facebook.com',data:JSON.stringify({type:'WA_EMBEDDED_SIGNUP',event:'FINISH',data:{waba_id:'8888888801',phone_number_id:'9999999901'}})})));
  await wait(page,'Cuenta vinculada · prueba integral pendiente');assert.equal(posts.filter(post=>post.action==='complete').length,1);assert.ok((await page.evaluate(()=>document.body.innerText)).includes('Sin aceptar'));
  assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);await page.waitForFunction(()=>!document.querySelector('#switch-company').disabled);await click(page,'Cambiar empresa');await click(page,'Ver conexión');await wait(page,'Constructora de ensayo B');assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('+54 synthetic company'));assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Cuenta vinculada · prueba integral pendiente'));checks.push('sdk-origin-isolation-single-code-and-company-switch-'+mode);
 }
 assert.deepEqual(external,[]);assert.ok(readCount>=1);await context.close();
}
try{
 let ready=false;for(let index=0;index<120;index++){if(server.exitCode!==null)throw new Error('UI fixture exited');try{const response=await fetch(origin);if(response.ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,500));}assert.ok(ready);
 browser=await puppeteer.launch({headless:true,...(process.platform==='win32'?{channel:'chrome'}:{}),args:['--no-sandbox','--disable-setuid-sandbox']});
 for(const width of [320,390,768,1280])await scenario('pending',width);for(const mode of ['missing','business','unknown','escrow','ready','uncertain','crossed','templates'])await scenario(mode);for(const width of [320,1280])await scenario('inbox',width);
 assert.deepEqual(errors,[]);const result={status:'PASS',environment:'real-components-controlled-synthetic-meta-services',checks,widths:[320,390,768,1280],errors,realMetaCalls:0,numberRegistered:false,productionDataTouched:false};writeFileSync(path.join(evidence,'browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(error){writeFileSync(path.join(evidence,'browser-failure.json'),JSON.stringify({message:error.message,errors,log},null,2));throw error;}
finally{
 await browser?.close();try{if(process.platform==='win32')server.kill();else process.kill(-server.pid,'SIGTERM');}catch{}await new Promise(resolve=>setTimeout(resolve,500));
 // Only remove the exact temporary fixture created above, after checking its resolved parent.
 const resolved=realpathSync(fixture),expectedParent=realpathSync(parent);assert.equal(path.dirname(resolved),expectedParent);assert.ok(path.basename(resolved).startsWith('meta-customer-ui-'));rmSync(resolved,{recursive:true,force:true});
}
