import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,copyFileSync,writeFileSync,rmSync,realpathSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import puppeteer from 'puppeteer';

// Actual component and request/journal lifecycle; all HTTP and identity are
// explicitly controlled synthetic fixtures. No Meta, Clerk or business writes.
assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV);
const root=realpathSync(process.cwd()),parent=path.join(root,'.vercel'),evidence=path.join(parent,'customer-inbox-evidence');mkdirSync(evidence,{recursive:true});
const fixture=mkdtempSync(path.join(parent,'customer-inbox-ui-')),app=path.join(fixture,'app');mkdirSync(app);
const source=path.join(root,'src/app/(identity)/cuenta');
for(const file of readdirSync(source).filter(file=>/^workspace-.*\.(?:js|mjs)$/.test(file)||['customer-inbox-panel.js','customer-inbox-panel.module.css','customer-inbox-view.mjs'].includes(file)))copyFileSync(path.join(source,file),path.join(app,file));
writeFileSync(path.join(fixture,'package.json'),JSON.stringify({name:'synthetic-customer-inbox-ui',private:true}));
writeFileSync(path.join(fixture,'next.config.mjs'),`export default {devIndicators:false,turbopack:{root:${JSON.stringify(root)}}};`);
writeFileSync(path.join(app,'layout.js'),`export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:12,background:'#f4f7f9',fontFamily:'Arial,sans-serif'}}>{children}</body></html>}`);
writeFileSync(path.join(app,'page.js'),`'use client';import {useState,useCallback} from 'react';import {CustomerInboxPanel} from './customer-inbox-panel';const getSessionToken=()=>window.__holdToken?new Promise(()=>{}):window.__failToken?Promise.reject(new Error('Synthetic SDK unavailable')):Promise.resolve('active-tab-controlled-token');export default function Page(){const [project,setProject]=useState('p-a'),[pending,setPending]=useState(false);const onPending=useCallback(value=>setPending(value),[]);return <main style={{maxWidth:1100,margin:'0 auto'}}><button id="switch-company" disabled={pending} onClick={()=>setProject(project==='p-a'?'p-b':'p-a')}>Cambiar empresa</button><button id="identity-change" onClick={()=>setProject(project==='p-a'?'p-b':'p-a')}>Cambio de identidad controlado</button><span id="pending">{pending?'Pendiente':'Disponible'}</span><CustomerInboxPanel getSessionToken={getSessionToken} key={project} projectId={project} scope={(project==='p-a'?'a':'b').repeat(64)} onPending={onPending}/><div id="participant-title"/><div id="field-title"/><div id="site-register-title"/></main>}`);
const origin='http://127.0.0.1:3124',server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',fixture,'--webpack','--hostname','127.0.0.1','--port','3124'],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
let log='',browser,result;const errors=[],checks=[];for(const stream of [server.stdout,server.stderr])stream.on('data',chunk=>{log=(log+chunk.toString()).slice(-16000);});
const eventId=index=>'customer_webhook_'+index.toString(16).padStart(64,'0');
const from='5491112345678',otherFrom='5491198765432';
const item=(index,extra={})=>({id:eventId(index),revision:'2026-10-01T01:00:00.000001',createdAt:new Date(Date.UTC(2026,9,1,0,0,index)).toISOString(),status:'PROCESSED',kind:'text',from,body:'Información privada sintética '+index,payloadVerified:true,canProcess:false,canReview:false,reviewState:'REVIEW_REQUIRED',identityStatus:'CHANNEL_IDENTITY_UNVERIFIED',businessApplied:false,replySent:false,...extra});
const pageItems=[item(20,{canReview:true,body:'Revisar material sintético: <img src=x onerror="window.__unsafe=true">'}),item(19,{status:'PENDING',reviewState:'NOT_PROCESSED',canProcess:true,body:'Evento pendiente sintético'}),item(18,{replySent:true,replyState:'SENT',reviewState:'RECORDED',businessApplied:true,body:'Incidencia registrada sintética'}),item(17,{replyState:'SEND_UNKNOWN',body:'Respuesta incierta sintética'}),item(16,{kind:'message_status',from:null,body:'',identityStatus:'NOT_APPLICABLE',providerStatus:'delivered',reviewState:'OBSERVED'}),item(15,{from:otherFrom,body:'Otro remitente sintético',identityStatus:'AMBIGUOUS'}),item(14,{from:otherFrom,body:null,payloadVerified:false,canProcess:true}),...Array.from({length:13},(_,index)=>item(13-index))];
const snapshot=(projectId='p-a',items=pageItems,nextCursor=eventId(1))=>({projectId,scope:(projectId==='p-a'?'a':'b').repeat(64),companyName:projectId==='p-a'?'Constructora de ensayo A':'Constructora de ensayo B',projectName:projectId==='p-a'?'Obra de ensayo A':'Obra de ensayo B',stateToken:'private-signup-sentinel',signup:{code:'private-code-sentinel'},connection:{recordPresent:true},activation:{operational:false},inbox:{items,nextCursor,truncated:Boolean(nextCursor)}});
const wait=(page,text)=>page.waitForFunction(value=>document.body.innerText.includes(value),{timeout:20000},text);
async function click(page,label){const handle=await page.evaluateHandle(text=>[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===text),label);assert.ok(handle.asElement(),'Missing button '+label);await handle.asElement().click();await handle.dispose();}
async function selectSender(page,sender=from){const handle=await page.evaluateHandle(value=>[...document.querySelectorAll('button')].find(button=>button.querySelector('strong')?.textContent==='Remitente +'+value),sender);assert.ok(handle.asElement());await handle.asElement().click();await handle.dispose();}
const disabled=(page,label)=>page.evaluate(text=>[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===text)?.disabled,label);
function stopOwnedWindows(owned,label){
 const stopped=spawnSync('taskkill.exe',['/PID',String(owned.pid),'/T','/F'],{stdio:'ignore'});
 if(stopped.status===0)return;
 // disconnect can make the browser exit before Node receives its exit event.
 // Only an independently absent PID is a benign race; retain all other errors.
 try{process.kill(owned.pid,0);}catch(error){if(error.code==='ESRCH')return;throw error;}
 assert.equal(stopped.status,0,'Owned '+label+' did not stop');
}
async function scenario(mode,width=390){
 const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1100});page.on('pageerror',error=>errors.push({mode,width,message:error.message}));
 const posts=[],gets=[],external=[];let current=snapshot(),pendingReceipt=false,deny=false,held,receiptFailure=true;
 await page.evaluateOnNewDocument(()=>{document.cookie='__session=other-tab-org-b-synthetic; Path=/';const schedule=window.setTimeout;window.setTimeout=(callback,delay,...args)=>schedule(callback,[15000,55000].includes(delay)?150:delay,...args);});
 await page.setRequestInterception(true);
 page.on('request',async request=>{try{
  const url=new URL(request.url());if(url.origin!==origin){external.push(url.hostname);return request.abort();}if(url.pathname!=='/api/identity/meta-onboarding')return request.continue();
  assert.equal(request.headers().authorization,'Bearer active-tab-controlled-token');assert.ok(request.headers().cookie?.includes('other-tab-org-b-synthetic'));
  let response,status=200;if(request.method()==='GET'){
   gets.push(url.search);assert.equal(url.searchParams.get('scope'),(url.searchParams.get('projectId')==='p-a'?'a':'b').repeat(64));
   if(mode==='held-request'&&!held){held=request;return;}
   if(deny){status=deny==='scope'?409:403;response={code:deny==='scope'?'WORKSPACE_CONTEXT_CHANGED':'WORKSPACE_INTEGRATION_PERMISSION_REQUIRED'};}
   else if(url.searchParams.get('projectId')==='p-b')response=snapshot('p-b',[],null);
   else if(url.searchParams.has('operationId')){
    const action=url.searchParams.get('action');assert.equal(url.searchParams.get('eventId'),posts[0].eventId);assert.equal(url.searchParams.get('operationId'),posts[0].operationId);
    if(mode==='receipt-error'&&receiptFailure){receiptFailure=false;status=503;response={code:'CONTROLLED_RECEIPT_UNAVAILABLE'};}
    else response={...current,receipt:{operationId:posts[0].operationId,eventId:posts[0].eventId,action,state:pendingReceipt?'NOT_OBSERVED':action==='review_inbox'?'RECORDED':'EVENT_PROCESSED',actorOperationVerified:action==='review_inbox',...(action==='review_inbox'?{receiptId:'meta_inbox_request_'+'c'.repeat(64),decision:posts[0].decision}:{eventStatus:'PROCESSED'})}};
   }else if(mode==='crossed')response=snapshot('p-b',[item(99,{body:'Foreign private content must stay hidden'})],null);
   else if(url.searchParams.has('after')){assert.equal(url.searchParams.get('after'),eventId(1));response=snapshot('p-a',[item(0,{body:'Página anterior sintética'})],null);}
   else response=current;
  }else{
   const body=JSON.parse(request.postData());posts.push(body);assert.equal(body.projectId,'p-a');assert.equal(body.scope,'a'.repeat(64));assert.match(body.operationId,/^[a-f0-9-]{36}$/);assert.equal(posts.length,1);
   assert.ok(['review_inbox','process_inbox'].includes(body.action));
   if(body.action==='review_inbox'){assert.equal(body.eventId,eventId(20));assert.equal(body.expectedRevision,'2026-10-01T01:00:00.000001');assert.equal(body.decision,'REFER_TO_PARTICIPANTS');current=snapshot('p-a',pageItems.map(value=>value.id===body.eventId?{...value,canReview:false,reviewState:'REVIEWED',reviewDecision:body.decision}:value));}
   else{assert.equal(body.eventId,eventId(19));current=snapshot('p-a',pageItems.map(value=>value.id===body.eventId?{...value,status:'PROCESSED',canProcess:false,canReview:true,reviewState:'REVIEW_REQUIRED'}:value));}
   if(['uncertain','denied-recovery','scope-recovery'].includes(mode)){status=503;response={code:'META_CUSTOMER_OPERATION_UNCONFIRMED'};}else{response=current;if(mode==='pending')pendingReceipt=true;if(mode==='receipt-sdk')await page.evaluate(()=>{window.__failToken=true;});}
  }
  if(!request.isInterceptResolutionHandled())await request.respond({status,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(response)});
 }catch(error){errors.push({mode,width,message:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}});
 await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});assert.equal(gets.length,0,'private inbox requires explicit consultation');
 if(mode==='held-token'){await page.evaluate(()=>{window.__holdToken=true;});await click(page,'Abrir bandeja de mensajes');await page.waitForFunction(()=>/No se pudo renovar tu sesión|La consulta se canceló/.test(document.body.innerText));assert.equal(gets.length,0);assert.equal(posts.length,0);await page.waitForFunction(()=>!document.querySelector('#switch-company').disabled);checks.push('hung-SDK-bounded-before-fetch-no-phantom-attempt');await context.close();return;}
 if(mode==='cancel-token'){await page.evaluate(()=>{window.__holdToken=true;});await click(page,'Abrir bandeja de mensajes');await click(page,'Cambio de identidad controlado');await page.evaluate(()=>{window.__holdToken=false;});await click(page,'Abrir bandeja de mensajes');await wait(page,'Constructora de ensayo B');assert.equal(gets.length,1);assert.equal(posts.length,0);checks.push('identity-unmount-cancels-SDK-without-request');await context.close();return;}
 await click(page,'Abrir bandeja de mensajes');
 if(mode==='held-request'){for(let index=0;index<100&&!held;index++)await new Promise(resolve=>setTimeout(resolve,10));assert.ok(held);await click(page,'Cambio de identidad controlado');await held.respond({status:200,contentType:'application/json',body:JSON.stringify(current)}).catch(()=>{});await click(page,'Abrir bandeja de mensajes');await wait(page,'Constructora de ensayo B');assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Información privada sintética'));checks.push('identity-unmount-cancels-old-private-response');await context.close();return;}
 if(mode==='crossed'){await wait(page,'La respuesta no corresponde');assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Foreign private content'));assert.equal(posts.length,0);checks.push('foreign-project-response-rejected-without-private-render');await context.close();return;}
 await wait(page,'20 eventos consultados');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow '+width);await selectSender(page);await wait(page,'Revisar material sintético');assert.equal(await page.evaluate(()=>window.__unsafe),undefined);assert.equal(await page.$('article img'),null);
 const text=await page.evaluate(()=>document.body.innerText);assert.ok(text.includes('Respuesta aceptada por Meta'));assert.ok(text.includes('Entrega sin confirmar'));assert.ok(text.includes('Resultado incierto; no se reenvía automáticamente'));assert.ok(text.includes('el participante sigue pendiente'));
 assert.ok(!text.includes('private-signup-sentinel')&&!text.includes('private-code-sentinel'));
 if(mode==='layout'){
  await page.type('input[type=search]','incidencia');await selectSender(page);await wait(page,'Incidencia registrada sintética');assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Revisar material sintético'));await page.click('input[type=search]');await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.press('Backspace');
  await click(page,'Consultar eventos anteriores');await wait(page,'21 eventos consultados');assert.equal(gets.length,2);assert.equal(await disabled(page,'Consultar eventos anteriores'),undefined);await selectSender(page);await wait(page,'Página anterior sintética');
  await page.screenshot({path:path.join(evidence,`customer-inbox-${width}.png`),fullPage:true});await selectSender(page,otherFrom);await wait(page,'Varias fichas coinciden');assert.equal(await disabled(page,'Procesar evento recibido'),undefined);checks.push('private-page-counts-local-search-keyset-grouping-safe-content-'+width);
 }else if(mode==='denied'){
  deny=true;await click(page,'Actualizar bandeja');await wait(page,'Tu acceso no permite');assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Revisar material sintético'));assert.equal(posts.length,0);checks.push('revoked-read-clears-private-snapshot');
 }else{
  if(mode==='sdk-command'){await page.select('article select','REFER_TO_PARTICIPANTS');await page.evaluate(()=>{window.__failToken=true;});await click(page,'Registrar seguimiento');await wait(page,'No se pudo renovar tu sesión');assert.equal(posts.length,0);assert.equal(await disabled(page,'Comprobar este mismo intento'),undefined);assert.equal(await page.$eval('article select',input=>input.value),'REFER_TO_PARTICIPANTS');checks.push('unsent-command-preserves-human-selection-without-phantom-receipt');}
  else{
   if(mode==='review'){await page.select('article select','REFER_TO_PARTICIPANTS');await page.waitForFunction(()=>document.querySelector('#switch-company').disabled);assert.equal(await page.$eval('#switch-company',button=>button.disabled),true);await click(page,'Registrar seguimiento');await wait(page,'Seguimiento comprobado con su recibo');assert.equal(posts.length,1);assert.ok(gets.some(query=>query.includes('operationId=')));checks.push('exact-review-receipt-human-consent-and-journal-settlement');}
   else{
    await click(page,'Procesar evento recibido');
    if(['uncertain','receipt-error','receipt-sdk','denied-recovery','scope-recovery'].includes(mode)){await wait(page,'El resultado quedó sin confirmar.');await page.waitForFunction(()=>document.querySelector('#switch-company').disabled);assert.equal(posts.length,1);
     if(mode==='receipt-sdk'){assert.equal(gets.length,1);await page.evaluate(()=>{window.__failToken=false;});}
     if(['denied-recovery','scope-recovery'].includes(mode)){const journalCount=()=>page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('obrasaas.pending-receipt.v1.')).length);assert.equal(await journalCount(),1);deny=mode==='scope-recovery'?'scope':true;await click(page,'Comprobar este mismo intento');await wait(page,mode==='scope-recovery'?'Cambió el contexto de la obra':'Tu acceso no permite');assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Revisar material sintético'));assert.equal(posts.length,1);assert.equal(await journalCount(),1);assert.ok(await page.evaluate(()=>[...document.querySelectorAll('button')].some(button=>button.textContent==='Comprobar este mismo intento')));deny=false;}
     await click(page,'Comprobar este mismo intento');await wait(page,'esto no atribuye el resultado');checks.push(mode+'-same-event-GET-recovery-without-second-processing');}
    else if(mode==='pending'){await wait(page,'Todavía no se observa');assert.equal(await page.$eval('#switch-company',button=>button.disabled),true);assert.equal(posts.length,1);await click(page,'Comprobar este mismo intento');await wait(page,'Todavía no se observa');assert.equal(posts.length,1);pendingReceipt=false;await click(page,'Comprobar este mismo intento');await wait(page,'esto no atribuye el resultado');checks.push('processor-busy-HTTP200-not-confirmation-and-read-only-recovery');}
    else{await wait(page,'esto no atribuye el resultado');checks.push('processed-event-state-distinct-from-browser-operation');}
   }
   assert.equal(posts.length,1);assert.equal(await page.$eval('#switch-company',button=>button.disabled),false);assert.equal(await disabled(page,'Comprobar este mismo intento'),undefined);
  }
 }
 const stored=await page.evaluate(()=>Object.values(localStorage).join('|')+'|'+Object.values(sessionStorage).join('|'));assert.ok(!stored.includes('Información privada')&&!stored.includes(from)&&!stored.includes('private-')&&!stored.includes('REFER_TO_PARTICIPANTS'));
 assert.deepEqual(external,[]);await context.close();
}
try{
 let ready=false;for(let index=0;index<120;index++){if(server.exitCode!==null)throw new Error('UI fixture exited');try{if((await fetch(origin)).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,500));}assert.ok(ready);
 browser=await puppeteer.launch({headless:true,...(process.platform==='win32'?{channel:'chrome'}:{}),args:['--no-sandbox','--disable-setuid-sandbox']});
 for(const width of [320,390,768,1280])await scenario('layout',width);
 for(const mode of ['review','process','uncertain','receipt-error','receipt-sdk','denied-recovery','scope-recovery','pending','sdk-command','held-token','cancel-token','held-request','crossed','denied'])await scenario(mode);
 assert.deepEqual(errors,[]);result={status:'PASS',environment:'real-components-controlled-synthetic-services',checks,widths:[320,390,768,1280],errors,realProviderCalls:0,productionDataWritten:false};
}catch(error){writeFileSync(path.join(evidence,'browser-failure.json'),JSON.stringify({message:error.message,errors,log},null,2));throw error;}
finally{
 // Chrome's close handshake can wait on canceled intercepted requests on
 // Windows. Stop only this launch's process tree, never another browser/port.
 try{if(browser){if(process.platform==='win32'){browser.disconnect();const owned=browser.process();if(owned&&owned.exitCode===null)stopOwnedWindows(owned,'test browser');}else await browser.close();}}
 finally{if(server.exitCode===null){if(process.platform==='win32')stopOwnedWindows(server,'fixture server');else process.kill(-server.pid,'SIGTERM');}await new Promise(resolve=>setTimeout(resolve,500));
 const resolved=realpathSync(fixture);assert.equal(path.dirname(resolved),realpathSync(parent));assert.ok(path.basename(resolved).startsWith('customer-inbox-ui-'));rmSync(resolved,{recursive:true,force:true});
 }
}
// A PASS artifact is written only once the owned browser/server/fixture closed.
writeFileSync(path.join(evidence,'browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
