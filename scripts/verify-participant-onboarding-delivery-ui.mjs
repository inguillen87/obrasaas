import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFileSync,existsSync,lstatSync,mkdirSync,mkdtempSync,readFileSync,realpathSync,rmSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {execFileSync,spawn,spawnSync} from 'node:child_process';
import puppeteer from 'puppeteer';

// Actual client components and recovery storage; every API response is synthetic.
// The supplied revision identifies the author's base, not committed WIP bytes.
assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV);
const ci=process.env.CI==='true';
const args=process.argv.slice(2),option=name=>args.find(value=>value.startsWith(name+'='))?.slice(name.length+1);
assert.ok(args.every(value=>/^--base-source=[a-f0-9]{40}$/.test(value)||/^--width=(320|390|768|1440)$/.test(value)||/^--case=[a-z-]+$/.test(value)||/^--port=\d{4,5}$/.test(value)));
const baseSourceRevision=option('--base-source')||null;if(ci)assert.equal(baseSourceRevision,null,'CI must derive source from actual Git HEAD');else assert.match(baseSourceRevision||'',/^[a-f0-9]{40}$/);
const allWidths=[320,390,768,1440],allModes=['invite-without-whatsapp','invite-with-whatsapp','send-ready','send-lost-ack','revoke-pending','sent-provider','status-delivered','send-unknown','notice-missing','capability-missing','chat-pending','receipt-refresh-failed','template-required','template-other-blocker','template-chat-pending','template-operation-pending'];
const widths=option('--width')?[Number(option('--width'))]:allWidths,modes=option('--case')?[option('--case')]:allModes;
assert.ok(widths.every(value=>allWidths.includes(value))&&modes.every(value=>allModes.includes(value)));
const port=Number(option('--port')||3354);assert.ok(Number.isInteger(port)&&port>=1024&&port<=65535);
const root=realpathSync(process.cwd()),privateRoot=path.join(root,'.vercel/private');mkdirSync(privateRoot,{recursive:true});
assert.ok(!lstatSync(privateRoot).isSymbolicLink());
function currentIdentity(){const head=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),dirty=execFileSync('git',['diff','--name-only','HEAD','--'],{cwd:root,encoding:'utf8'}).trim();assert.match(head,/^[a-f0-9]{40}$/);assert.equal(head,process.env.GITHUB_SHA,'CI must execute its dispatched Git source');assert.equal(dirty,'','CI tracked source must be exact HEAD');return head;}
const sourceRevision=ci?currentIdentity():null,outputRoot=path.join(root,'.vercel/participant-onboarding-delivery-evidence');mkdirSync(outputRoot,{recursive:true});assert.ok(!lstatSync(outputRoot).isSymbolicLink());if(ci)assert.equal(existsSync(path.join(outputRoot,'onboarding-delivery-ui.json')),false,'Main proof is never overwritten');
const output=mkdtempSync(path.join(outputRoot,'ui-')),fixture=mkdtempSync(path.join(privateRoot,'participant-onboarding-delivery-fixture-')),app=path.join(fixture,'app');mkdirSync(app);
const copiedFiles=['participant-onboarding-next-step.mjs','participant-onboarding-delivery-view.mjs','participant-panel.js','participant-account-discovery.js','participant-account-discovery-format.mjs','employee-intake-panel.js','employee-intake-continuity.mjs','private-bank-account-panel.js','private-bank-account-panel.module.css','participant-panel.module.css','kyc-photo-preparation.js','field-media-preparation.mjs','workspace-session-request.mjs','workspace-request-lifecycle.js','workspace-request-lifecycle.mjs','workspace-recovery-journal.mjs','own-company-number-view.mjs','own-company-templates-view.mjs','private-bank-account-format.mjs','company-channel-view.mjs','site-purchase-view.mjs','workspace-recovery-storage.mjs','workspace-client.js'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const name of copiedFiles)copyFileSync(path.join(root,'src/app/(identity)/cuenta',name),path.join(app,name));
const sourceManifest=copiedFiles.map(name=>{const file='src/app/(identity)/cuenta/'+name,bytes=readFileSync(path.join(root,file));assert.ok(bytes.equals(readFileSync(path.join(app,name))));return {path:file,bytes:bytes.length,sha256:sha(bytes)};}).sort((a,b)=>a.path.localeCompare(b.path));
const harnessSha256=sha(readFileSync(new URL(import.meta.url)));
writeFileSync(path.join(fixture,'package.json'),JSON.stringify({name:'isolated-participant-onboarding-delivery-ui',private:true}));
writeFileSync(path.join(fixture,'next.config.mjs'),`export default {devIndicators:false,turbopack:{root:${JSON.stringify(root)}}};`);
writeFileSync(path.join(app,'layout.js'),`export const viewport={width:'device-width',initialScale:1};export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:12,fontFamily:'Arial,sans-serif'}}>{children}</body></html>}`);
const scope='a'.repeat(64),projectId='project-onboarding-delivery-fixture',workerId='worker-onboarding-delivery',challengeId='kyc_chat_'+'c'.repeat(32),receiptId='participant_'+'d'.repeat(64),token='synthetic-onboarding-session';
writeFileSync(path.join(app,'page.js'),`'use client';import {useCallback,useEffect,useState} from 'react';import {ParticipantPanel} from './participant-panel';import {participantOnboardingNavigationTarget} from './participant-onboarding-next-step.mjs';import {browserRecoveryJournal} from './workspace-recovery-journal.mjs';export default function Page(){const[pending,setPending]=useState(false),change=useCallback(value=>setPending(value),[]),getToken=useCallback(async()=> '${token}',[]);const navigate=useCallback((value,current={scope:'${scope}',projectId:'${projectId}',canManageIntegrations:true})=>{const id=participantOnboardingNavigationTarget(value,current),target=id&&document.getElementById(id);if(!target?.getClientRects().length)return false;window.onboardingNavigations.push({scope:value.scope,projectId:value.projectId,target:value.target,destination:id});target.setAttribute('tabindex','-1');target.focus({preventScroll:true});target.scrollIntoView({block:'start',behavior:'auto'});return true;},[]);useEffect(()=>{window.onboardingNavigations=[];window.onboardingTryNavigation=navigate;window.onboardingReferences=()=>browserRecoveryJournal.list('${scope}');window.onboardingSeedReference=()=>browserRecoveryJournal.prepare('/api/identity/participants',{method:'POST',body:JSON.stringify({scope:'${scope}',projectId:'${projectId}',operationId:'11111111-1111-4111-8111-111111111111',action:'INVITE',payload:{workerId:'${workerId}'}})});return()=>{delete window.onboardingReferences;delete window.onboardingSeedReference;delete window.onboardingTryNavigation;delete window.onboardingNavigations;};},[navigate]);return <main style={{maxWidth:1000,margin:'auto'}}><button id="context" style={{fontSize:16,minHeight:44}} disabled={pending}>Cambiar obra sintética</button><ParticipantPanel scope="${scope}" projectId="${projectId}" onPending={change} getSessionToken={getToken} onNavigate={navigate}/><section aria-labelledby="customer-meta-title"><h3 id="customer-meta-title">Autorizar WhatsApp con Meta</h3><p>Encabezado disponible antes de consultar la conexión.</p></section></main>}`);
const origin='http://127.0.0.1:'+port,server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',fixture,'--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'],windowsHide:true,detached:process.platform!=='win32'});
const serverClosed=new Promise(resolve=>server.once('close',resolve));let serverLog='',browser,activePage,activeCase,runError,serverClosedBeforeFixtureRemoval=false,fixtureRemoved=false;
const checks=[],templateGuidanceChecks=[],errors=[];const mark=stage=>{activeCase={...activeCase,stage};console.log(JSON.stringify({case:activeCase}));};for(const stream of [server.stdout,server.stderr])stream.on('data',bytes=>{serverLog=(serverLog+bytes.toString()).slice(-18000);});
async function stopServer(){let timer;try{if(server.exitCode===null&&server.signalCode===null){if(process.platform==='win32'){const result=spawnSync('taskkill.exe',['/PID',String(server.pid),'/T','/F'],{stdio:'ignore',windowsHide:true,timeout:10000});assert.equal(result.status,0,'Only the owned Next tree must stop before cleanup');}else{try{process.kill(-server.pid,'SIGTERM');}catch(error){if(error.code!=='ESRCH')throw error;}}}await Promise.race([serverClosed,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('OWNED_NEXT_CLOSE_TIMEOUT')),10000);})]);if(process.platform!=='win32'){try{process.kill(-server.pid,'SIGKILL');}catch(error){if(error.code!=='ESRCH')throw error;}const deadline=Date.now()+10000;for(;;){try{process.kill(-server.pid,0);}catch(error){if(error.code==='ESRCH')break;throw error;}assert.ok(Date.now()<deadline,'OWNED_NEXT_GROUP_CLOSE_TIMEOUT');await new Promise(resolve=>setTimeout(resolve,50));}}serverClosedBeforeFixtureRemoval=true;}finally{clearTimeout(timer);}}
async function bounded(promise,label,timeout=10000){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label)),timeout);})]);}finally{clearTimeout(timer);}}
const processAlive=pid=>{try{process.kill(pid,0);return true;}catch(error){if(error.code==='ESRCH')return false;throw error;}};
async function closeBrowser(){if(!browser)return;const owned=browser.process();assert.ok(Number.isSafeInteger(owned?.pid)&&owned.pid>0);try{await bounded(browser.close(),'OWNED_BROWSER_CLOSE_TIMEOUT');}catch{browser.disconnect();if(processAlive(owned.pid)){if(process.platform==='win32'){const result=spawnSync('taskkill.exe',['/PID',String(owned.pid),'/T','/F'],{stdio:'ignore',windowsHide:true,timeout:10000});assert.ok(result.status===0||!processAlive(owned.pid),'Owned Chrome process must stop');}else assert.ok(owned.kill('SIGTERM'));}}if(processAlive(owned.pid))await bounded(new Promise(resolve=>owned.once('close',resolve)),'OWNED_BROWSER_PROCESS_CLOSE_TIMEOUT');assert.equal(processAlive(owned.pid),false,'Owned Chrome process is absent');}

const waitText=(page,text)=>page.waitForFunction(value=>document.body.innerText.includes(value),{timeout:20000},text);
async function controls(page,label){return page.evaluate(value=>[...document.querySelectorAll('button')].filter(el=>el.textContent.trim()===value&&el.getClientRects().length).map(el=>({disabled:el.disabled,height:el.getBoundingClientRect().height,font:parseFloat(getComputedStyle(el).fontSize)})),label);}
async function click(page,label){await page.waitForFunction(value=>[...document.querySelectorAll('button')].some(el=>el.textContent.trim()===value&&!el.disabled&&el.getClientRects().length),{timeout:20000},label);const handle=await page.evaluateHandle(value=>[...document.querySelectorAll('button')].find(el=>el.textContent.trim()===value&&!el.disabled&&el.getClientRects().length),label);if(await page.evaluate(()=>navigator.maxTouchPoints>0))await handle.asElement().tap();else await handle.asElement().click();await handle.dispose();}
async function enabled(page,label){await page.waitForFunction(value=>[...document.querySelectorAll('button')].some(el=>el.textContent.trim()===value&&!el.disabled&&el.getClientRects().length),{timeout:20000},label);const found=await controls(page,label);assert.ok(found.length);assert.equal(found[0].disabled,false,label);assert.ok(found[0].height>=43.9&&found[0].font>=15.9,label+' requires 44px/16px controls');}
async function absent(page,label){assert.equal((await controls(page,label)).length,0,label+' must not be offered');}
const references=page=>page.evaluate(()=>window.onboardingReferences());
const person='Persona sintética de contacto',email='contacto-fixture@example.invalid';
const contactNotice={version:'participant-onboarding-v1',sha256:'e'.repeat(64),text:'Aviso sintético: esta persona autorizó recibir sus instrucciones privadas de alta por WhatsApp; no aprueba identidad ni habilita otros avisos.'};
const revision='2026-10-07T00:00:00.000001';
const requiredConsent={confirmed:true,noticeVersion:contactNotice.version,noticeSha256:contactNotice.sha256};
async function privateStorage(page,count){
 const data=await page.evaluate(async()=>({references:await window.onboardingReferences(),session:Object.values(sessionStorage),local:Object.values(localStorage)}));
 assert.equal(data.references.length,count);
 for(const item of data.references)assert.deepEqual(Object.keys(item).sort(),['createdAt','operationId','projectId','resource','scope','version']);
 for(const forbidden of [person,email,contactNotice.text,contactNotice.sha256,token,'"whatsAppConsent"','"confirmed"','customer_outbound_','IDENTIDAD '])assert.equal(JSON.stringify(data).includes(forbidden),false,'Recovery storage excludes '+forbidden);
 return data.references;
}
async function geometry(page,width){
 assert.equal(await page.evaluate(()=>innerWidth),width);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
 const problems=await page.evaluate(()=>[...document.querySelectorAll('button,input,textarea,select,summary')].filter(el=>el.getClientRects().length&&!el.closest('details:not([open])')).filter(el=>{
  // A 20px native checkbox has a 44px visible label as its click target.
  const target=el.type==='checkbox'?el.labels[0]:el;
  return !target||target.getBoundingClientRect().height<43.9||parseFloat(getComputedStyle(target).fontSize)<15.9;
 }).map(el=>el.textContent||el.type));
 assert.deepEqual(problems,[],'Visible controls and checkbox labels require 44px/16px');
}
async function confirmContact(page){
 const input=await page.$('form input[type=checkbox]');assert.ok(input);
 assert.equal(await input.evaluate(el=>el.checked),false,'Contact consent starts unchecked');
 await input.focus();await page.keyboard.press('Space');assert.equal(await input.evaluate(el=>el.checked),true);
 await page.keyboard.press('Tab');
 assert.equal(await page.evaluate(()=>document.activeElement?.textContent),'Guardar solicitud de envío','Keyboard reaches the enabled confirmation after consent');
}
async function scenario(mode,width){
 const context=await browser.createBrowserContext(),page=await context.newPage();activePage=page;activeCase={mode,width,stage:'boot'};mark('boot');
 await page.setViewport({width,height:1050,isMobile:width<=390,hasTouch:width<=390});
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 const posts=[],reads=[],unexpected=[],pageErrors=[],dialogs=[];
 page.on('dialog',dialog=>{dialogs.push(dialog.type());if(dialog.type()!=='beforeunload')unexpected.push('Unexpected dialog '+dialog.type());return dialog.type()==='beforeunload'?dialog.accept():dialog.dismiss();});
 page.on('pageerror',error=>pageErrors.push(error.message));
 const date=offset=>new Date(Date.now()+offset).toISOString();
 const inviteMode=mode.startsWith('invite-');let invited=!inviteMode,receipt=null,failRefresh=false;
 const templateMode=mode.startsWith('template-');
  let state=templateMode?'BLOCKED':mode==='revoke-pending'?'PENDING':mode==='sent-provider'?'SENT':mode==='status-delivered'?'STATUS_OBSERVED':mode==='send-unknown'?'SEND_UNKNOWN':null;
 let authorized=state!==null;
 const delivery=()=>state===null?undefined:{state,contactAuthorized:authorized,outboundId:'customer_outbound_'+'f'.repeat(64),code:templateMode?(mode==='template-other-blocker'?'PARTICIPANT_ONBOARDING_AUTHORIZATION_REQUIRED':'PARTICIPANT_ONBOARDING_TEMPLATE_APPROVAL_REQUIRED'):null,providerAccepted:['SENT','STATUS_OBSERVED'].includes(state),deliveryConfirmed:state==='STATUS_OBSERVED',providerStatus:state==='STATUS_OBSERVED'?'delivered':state==='SENT'?'sent':null,automaticResendAllowed:false};
 const row=()=>({
  id:workerId,name:person,job:'ALBANIL',jobLabel:'Albañil',active:true,self:false,status:invited?'INVITED':'NOT_INVITED',accountLinked:false,revision,
  invitation:invited?{id:'invite_'+'1'.repeat(32),state:'SENT',email,expiresAt:date(3600000),expired:false}:null,
  permissions:{attendance:false,report:false},kyc:{status:'NOT_SUBMITTED',images:[],review:null},
  kycChatChallenge:['chat-pending','template-chat-pending'].includes(mode)?{id:challengeId,status:'PENDING',expiresAt:date(3600000),conversationExpiresAt:null,expired:false,canPrepare:false,canCancel:false,blockedCode:'PARTICIPANT_KYC_CHAT_NOT_CANCELLABLE',step:null,recoveryRequired:false,claimedAt:null,closedAt:null}:null,
  ...(mode==='capability-missing'?{}:{canSendOnboardingWhatsapp:!['PENDING','BLOCKED','SEND_UNKNOWN'].includes(state)&&!['chat-pending','template-chat-pending'].includes(mode),canRevokeOnboardingContact:authorized}),
  ...(state===null?{}:{onboardingDelivery:delivery()})
 });
 const snapshot=()=>({
  scope,projectId,canManage:true,canInvite:true,canManageOfficeRoles:false,records:[row()],officeRoles:[],existingAccounts:[],privacyNotice:{version:'synthetic-private-v1',text:'Aviso privado sintético'},employeeIntake:null,nextCursor:null,
  ...(mode==='notice-missing'?{}:{onboardingContactNotice:contactNotice})
 });
 const recorded=command=>({scope,projectId,operationId:command.operationId,state:'RECORDED',saved:true,receiptId,participant:row(),kind:command.action});
 const respond=(request,value,status=200)=>request.respond({status,contentType:'application/json',body:JSON.stringify(value)});
 await page.setRequestInterception(true);
 page.on('request',request=>{(async()=>{
  const url=new URL(request.url());
  if(url.origin!==origin){unexpected.push(url.origin+url.pathname);return request.abort();}
  if(url.pathname.startsWith('/api/')&&url.pathname!=='/api/identity/participants'){unexpected.push(url.pathname);return request.abort();}
  if(url.pathname!=='/api/identity/participants')return request.continue();
  assert.equal(request.headers().authorization,'Bearer '+token);
  if(request.method()==='POST'){
   const command=JSON.parse(request.postData());posts.push(command);
   assert.deepEqual(Object.keys(command).sort(),['action','operationId','payload','projectId','scope']);
   assert.equal(command.projectId,projectId);assert.equal(command.scope,scope);assert.match(command.operationId,/^[0-9a-f-]{36}$/);
   if(inviteMode){
    assert.equal(command.action,'INVITE');
    assert.deepEqual(command.payload,{workerId,revision,email,...(mode==='invite-with-whatsapp'?{whatsAppConsent:requiredConsent}:{})});
    invited=true;if(mode==='invite-with-whatsapp'){state='WAITING_CONFIGURATION';authorized=true;}
   }else if(mode==='revoke-pending'){
    assert.equal(command.action,'REVOKE_ONBOARDING_CONTACT');assert.deepEqual(command.payload,{workerId,revision});
    state='CANCELED';authorized=false;
   }else{
    assert.equal(command.action,'SEND_ONBOARDING_WHATSAPP');assert.deepEqual(command.payload,{workerId,revision,whatsAppConsent:requiredConsent});
    state='PENDING';authorized=true;
   }
   receipt=recorded(command);
   if(mode==='send-lost-ack')return respond(request,{code:'SYNTHETIC_ACK_LOST'},503);
   if(mode==='receipt-refresh-failed')failRefresh=true;
   return respond(request,receipt);
  }
  assert.equal(request.method(),'GET');const params=Object.fromEntries(url.searchParams);reads.push(params);
  assert.equal(params.projectId,projectId);assert.equal(params.scope,scope);
  if(params.operationId){
   assert.deepEqual(Object.keys(params).sort(),['operationId','projectId','scope']);
   assert.equal(params.operationId,posts[0].operationId);assert.ok(receipt);return respond(request,receipt);
  }
  assert.deepEqual(Object.keys(params).sort(),['projectId','scope']);
  if(failRefresh){failRefresh=false;return respond(request,{code:'SYNTHETIC_GET_FAILED'},503);}
  return respond(request,snapshot());
 })().catch(error=>{unexpected.push(error.message);request.abort().catch(()=>{});});});
 try{
  await page.goto(origin,{waitUntil:'networkidle0',timeout:20000});await enabled(page,'Consultar participantes');await click(page,'Consultar participantes');
  await waitText(page,person);await geometry(page,width);assert.equal(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),true);
  if(inviteMode){
   mark('optional-contact-consent');await click(page,'Invitar a esta obra');await waitText(page,'Enviar invitación de acceso');
   assert.equal(await page.evaluate(()=>document.activeElement?.textContent),'Enviar invitación de acceso');
   const input=await page.$('form input[type=email]');await input.type(email);
   const checkbox=await page.$('form input[type=checkbox]');assert.ok(checkbox);
   assert.equal(await checkbox.evaluate(el=>el.checked),false);
   assert.equal(await page.evaluate(value=>document.querySelector('form').innerText.includes(value),contactNotice.text),true);
   if(mode==='invite-with-whatsapp'){await checkbox.focus();await page.keyboard.press('Space');}
   await geometry(page,width);await page.screenshot({path:path.join(output,mode+'-form-'+width+'.png'),fullPage:true,timeout:20000});await click(page,'Enviar invitación');await waitText(page,'Recibo:');
   assert.equal(posts.length,1);
   assert.equal(Object.hasOwn(posts[0].payload,'whatsAppConsent'),mode==='invite-with-whatsapp');
   await waitText(page,mode==='invite-with-whatsapp'?'Esperando configuración':'Sin envío solicitado');
   await privateStorage(page,0);
  }else if(['send-ready','send-lost-ack','receipt-refresh-failed'].includes(mode)){
   mark('human-send-confirmation');await click(page,'Enviar instrucciones por WhatsApp');await waitText(page,'El servidor comprobará el permiso del emisor original');
   assert.equal(await page.evaluate(()=>document.activeElement?.textContent),'Solicitar instrucciones por WhatsApp');
   assert.equal((await controls(page,'Guardar solicitud de envío'))[0].disabled,true);
   await confirmContact(page);assert.equal(posts.length,0);await geometry(page,width);await page.screenshot({path:path.join(output,mode+'-form-'+width+'.png'),fullPage:true,timeout:20000});
   await click(page,'Guardar solicitud de envío');
   if(mode==='send-lost-ack'){
    mark('unknown-ack');await waitText(page,'El resultado quedó sin confirmar');assert.equal(posts.length,1);
    const before=(await privateStorage(page,1))[0];assert.equal(before.operationId,posts[0].operationId);
    await absent(page,'Reintentar exactamente esta solicitud');assert.ok((await controls(page,'Consultar estado del envío')).every(item=>item.disabled));
    await page.waitForFunction(()=>document.querySelector('#context').disabled,{timeout:10000});
    await page.reload({waitUntil:'domcontentloaded',timeout:20000});await waitText(page,'Comprobar el mismo intento');
    assert.deepEqual(dialogs,['beforeunload']);assert.deepEqual(await references(page),[before]);assert.equal(posts.length,1,'Reload cannot send');
    await click(page,'Comprobar el mismo intento');await waitText(page,'Recibo confirmado. Consultá el perfil vigente');
    await privateStorage(page,0);await click(page,'Consultar participantes');await waitText(page,'Pendiente de envío');
    assert.equal(posts.length,1,'Receipt recovery and fresh GET cannot resend');
    assert.ok(reads.filter(read=>read.operationId).length>0);
    assert.ok(reads.filter(read=>read.operationId).every(read=>read.operationId===before.operationId),'Every recovery GET retains the original UUID');
   }else if(mode==='receipt-refresh-failed'){
    mark('fresh-read-failed');await waitText(page,'El recibo está confirmado. Actualizá la lista');await absent(page,'Preparar identidad por WhatsApp');await enabled(page,'Consultar presentación por chat');
    assert.equal(await page.$eval('[data-onboarding-delivery]',el=>el.dataset.onboardingDelivery),'UNKNOWN');
    await absent(page,'Solicitar instrucciones por WhatsApp');await absent(page,'Enviar instrucciones por WhatsApp');await absent(page,'Retirar autorización de contacto');
    await privateStorage(page,0);await click(page,'Consultar estado del envío');await waitText(page,'Pendiente de envío');
    assert.equal(posts.length,1,'Failed fresh GET never allows a repost');
   }else{
    await waitText(page,'Pendiente de envío');assert.equal(posts.length,1);await absent(page,'Solicitar instrucciones por WhatsApp');await absent(page,'Enviar instrucciones por WhatsApp');await privateStorage(page,0);
   }
  }else if(mode==='revoke-pending'){
   mark('explicit-revocation');await absent(page,'Preparar identidad por WhatsApp');await enabled(page,'Consultar envío por WhatsApp');await click(page,'Retirar autorización de contacto');
   await waitText(page,'Confirmar retiro de autorización');await page.screenshot({path:path.join(output,mode+'-form-'+width+'.png'),fullPage:true,timeout:20000});await click(page,'Confirmar retiro de autorización');await waitText(page,'Envío cancelado');
   assert.equal(posts.length,1);assert.equal(await page.$eval('[data-onboarding-delivery]',el=>el.dataset.onboardingDelivery),'CANCELED');
   await absent(page,'Retirar autorización de contacto');await privateStorage(page,0);
  }else if(templateMode){
    mark('template-guidance-without-parallel-code');await absent(page,'Solicitar instrucciones por WhatsApp');await absent(page,'Enviar instrucciones por WhatsApp');await absent(page,'Preparar identidad por WhatsApp');
    let navigationCount=0,referenceCount=0;
    if(mode==='template-required'){
     await enabled(page,'Revisar plantilla de alta');await waitText(page,'aprobación vigente');assert.equal(await page.$eval('[data-onboarding-step]',el=>el.dataset.onboardingStep),'ONBOARDING_TEMPLATE_REVIEW');
     const primary=await page.$('[data-onboarding-primary]');await primary.focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.activeElement?.id),'customer-meta-title');
     assert.equal(await page.$('#customer-template-workbench'),null,'Review reaches the visible panel heading before a workbench is observed');
     const navigations=await page.evaluate(()=>window.onboardingNavigations);assert.deepEqual(navigations,[{scope,projectId,target:'meta-onboarding',destination:'customer-meta-title'}]);navigationCount=1;
     const blocked=await page.evaluate(({scope,projectId})=>[{scope:'b'.repeat(64),projectId,target:'meta-onboarding'},{scope,projectId:'other-project',target:'meta-onboarding'},{scope,projectId,target:'customer-template-workbench'}].map(value=>window.onboardingTryNavigation(value)).concat(window.onboardingTryNavigation({scope,projectId,target:'meta-onboarding'},{scope,projectId,canManageIntegrations:false})),{scope,projectId});assert.deepEqual(blocked,[false,false,false,false]);
     assert.equal(await page.evaluate(()=>window.onboardingNavigations.length),1);assert.equal(posts.length,0);await click(page,'Consultar estado del envío');await enabled(page,'Revisar plantilla de alta');assert.equal(posts.length,0,'Template consultation cannot resend');
    }else if(mode==='template-operation-pending'){
     await page.evaluate(()=>window.onboardingSeedReference());await waitText(page,'Comprobar el mismo intento');await absent(page,'Revisar plantilla de alta');assert.equal(await page.$eval('[data-onboarding-step]',el=>el.dataset.onboardingStep),'OPERATION_UNCERTAIN');referenceCount=1;
     const prior=(await privateStorage(page,1))[0];await page.reload({waitUntil:'domcontentloaded',timeout:20000});await waitText(page,'Comprobar el mismo intento');assert.deepEqual(await references(page),[prior]);await absent(page,'Revisar plantilla de alta');assert.equal(posts.length,0,'Pending reload cannot send or navigate');
    }else{
     await absent(page,'Revisar plantilla de alta');assert.equal(await page.$eval('[data-onboarding-step]',el=>el.dataset.onboardingStep),mode==='template-chat-pending'?'KYC_CHAT_PENDING':'ONBOARDING_WHATSAPP_PENDING');await click(page,'Consultar estado del envío');assert.equal(posts.length,0);
    }
    await privateStorage(page,referenceCount);assert.equal(posts.length,0);assert.equal(await page.evaluate(()=>window.onboardingNavigations.length),navigationCount);assert.ok((await controls(page,'Preparar identidad por WhatsApp')).every(item=>item.disabled),'A retained reference cannot prepare another code');templateGuidanceChecks.push({mode,width,staticBlocker:mode!=='template-other-blocker',noParallelKycCode:true,posts:0,navigationCount,referenceCount,scopedNavigation:true,keyboardNavigation:mode==='template-required'});
   }else if(mode==='sent-provider'||mode==='status-delivered'){
   mark('provider-status-is-not-human-acceptance');
   const deliveryText=await page.$eval('[data-onboarding-delivery]',el=>el.innerText);
   assert.ok(deliveryText.includes(mode==='sent-provider'?'Esto todavía no confirma la entrega':'Esto no acredita quién lo recibió'));
   assert.ok(deliveryText.includes('No puede borrar ni retirar'));
   assert.equal(await page.evaluate(()=>document.body.innerText.includes('Invitación aceptada')),false,'Provider status cannot accept the individual invitation');
   assert.equal(await page.evaluate(()=>document.body.innerText.includes('Aprobado por un responsable')),false,'Provider status cannot approve KYC');
   assert.equal(posts.length,0);await click(page,'Consultar estado del envío');assert.equal(posts.length,0);await privateStorage(page,0);
  }else{
   mark('fail-closed');await absent(page,'Solicitar instrucciones por WhatsApp');await absent(page,'Enviar instrucciones por WhatsApp');assert.equal(posts.length,0);
   if(mode==='send-unknown')await waitText(page,'no lo vuelvas a enviar');
   if(mode==='capability-missing')assert.equal(await page.$eval('[data-onboarding-delivery]',el=>el.dataset.onboardingDelivery),'UNKNOWN');
   if(mode==='notice-missing')assert.equal(await page.$('form input[type=checkbox]'),null);
   await absent(page,'Reintentar exactamente esta solicitud');await privateStorage(page,0);
   await click(page,'Consultar participantes');assert.equal(posts.length,0,'Closed capability only allows a read');
  }
  await geometry(page,width);assert.deepEqual(unexpected,[],'No external provider or fixture error');assert.deepEqual(pageErrors,[]);
  await page.screenshot({path:path.join(output,mode+'-'+width+'.png'),fullPage:true,timeout:20000});
  checks.push({mode,width,status:'PASS',postCount:posts.length,recoveryGets:reads.filter(value=>value.operationId).length,operationId:posts[0]?.operationId||null,geometry44px16px:true,mobileTap:width<=390,reducedMotion:true,keyboardConsent:['send-ready','send-lost-ack','receipt-refresh-failed','invite-with-whatsapp'].includes(mode),providerRequests:0,beforeUnloadConfirmations:dialogs.length});
 }finally{await bounded(context.close(),'OWNED_CONTEXT_CLOSE_TIMEOUT');activePage=null;}
}
try{
 let ready=false;for(let attempt=0;attempt<120;attempt++){if(server.exitCode!==null)throw Error('Owned Next process exited before ready');try{const response=await fetch(origin,{signal:AbortSignal.timeout(1000)});if(response.ok){ready=true;break;}}catch{/* Only the loopback fixture is retried. */}await new Promise(resolve=>setTimeout(resolve,500));}assert.ok(ready,'Loopback fixture ready');
 browser=await puppeteer.launch({channel:'chrome',headless:true,protocolTimeout:30000,args:['--disable-dev-shm-usage']});for(const width of widths)for(const mode of modes)await scenario(mode,width);
}catch(error){runError=error;errors.push({case:activeCase,message:error.message,stack:error.stack});if(activePage)try{await activePage.screenshot({path:path.join(output,'failure.png'),fullPage:true});}catch{/* Preserve original failure. */}}
finally{
 try{await closeBrowser();}catch(error){runError ||=error;errors.push({phase:'browser-cleanup',message:error.message});}
 try{await stopServer();const absolute=realpathSync(fixture);assert.ok(absolute.startsWith(realpathSync(privateRoot)+path.sep)&&path.basename(absolute).startsWith('participant-onboarding-delivery-fixture-')&&!lstatSync(absolute).isSymbolicLink(),'Cleanup target must remain the owned private fixture');rmSync(absolute,{recursive:true,force:false});fixtureRemoved=!existsSync(absolute);assert.ok(fixtureRemoved);}catch(error){runError ||=error;errors.push({phase:'cleanup',message:error.message});}
}
for(const file of sourceManifest)if(sha(readFileSync(path.join(root,file.path)))!==file.sha256){runError ||=Error('SOURCE_DRIFT');errors.push({phase:'source-drift',path:file.path});}
if(harnessSha256!==sha(readFileSync(new URL(import.meta.url)))){runError ||=Error('HARNESS_DRIFT');errors.push({phase:'harness-drift'});}
if(ci)try{assert.equal(currentIdentity(),sourceRevision);}catch(error){runError ||=error;errors.push({phase:'ci-source',message:error.message});}
const proof={status:runError?'FAIL':'PASS',sourceRevision,baseSourceRevision,sourceState:ci?'Committed exact Git HEAD; checked clean before and after':'Author WIP; exact bytes in sourceManifest; no Git operation performed',trackedClean:ci?true:null,ciEligible:ci&&!runError,widths,modes,checks,templateGuidanceChecks,errors,sourceManifest,sourceManifestSha256:sha(Buffer.from(JSON.stringify(sourceManifest))),harnessSha256,providerRequests:0,realIdentityAcceptance:false,production:false,serverClosedBeforeFixtureRemoval,fixtureRemoved};
writeFileSync(path.join(output,'server.log'),serverLog,{flag:'wx'});writeFileSync(path.join(output,'proof.json'),JSON.stringify(proof,null,2)+'\n',{flag:'wx'});if(ci)writeFileSync(path.join(outputRoot,'onboarding-delivery-ui.json'),JSON.stringify(proof,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:proof.status,checks:checks.length,errors:errors.length,proof:path.relative(root,path.join(output,'proof.json')),sourceState:proof.sourceState}));process.stdout.write('',()=>process.exit(runError?1:0));
