import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,copyFileSync,writeFileSync,rmSync} from 'node:fs';
import {spawn,spawnSync} from 'node:child_process';
import path from 'node:path';
import puppeteer from 'puppeteer';
assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV);
const root=process.cwd(),parent=path.resolve(root,'.vercel'),evidence=path.join(parent,'template-send-evidence');mkdirSync(evidence,{recursive:true});
const fixture=mkdtempSync(path.join(parent,'template-send-ui-')),app=path.join(fixture,'app');mkdirSync(app);
for(const file of ['template-send-panel.js','template-send-panel.module.css','template-send-view.mjs','workspace-request-lifecycle.js','workspace-request-lifecycle.mjs','workspace-session-request.mjs','workspace-recovery-journal.mjs','workspace-recovery-storage.mjs'])copyFileSync(path.join(root,'src/app/(identity)/cuenta',file),path.join(app,file));
writeFileSync(path.join(fixture,'package.json'),JSON.stringify({name:'controlled-template-send-ui',private:true}));
writeFileSync(path.join(fixture,'next.config.mjs'),`export default {devIndicators:false,turbopack:{root:${JSON.stringify(root)}}};`);
writeFileSync(path.join(app,'layout.js'),`export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:12,fontFamily:'Arial',background:'#edf3f8'}}>{children}</body></html>}`);
writeFileSync(path.join(app,'page.js'),`'use client';import {useState,useCallback,useEffect} from 'react';import {TemplateSendPanel} from './template-send-panel';import {browserRecoveryJournal} from './workspace-recovery-journal.mjs';export default function Page(){const [identity,setIdentity]=useState('a'),[pending,setPending]=useState(false);useEffect(()=>{window.__fixtureReferences=async()=> (await Promise.all(['a','b'].map(value=>browserRecoveryJournal.list(value.repeat(64))))).flat();return()=>{delete window.__fixtureReferences;};},[]);const token=useCallback(()=>{window.__tokenReads=(window.__tokenReads||0)+1;return window.__tokenMode==='fail'?Promise.reject(new Error('Controlled SDK failure')):window.__tokenMode==='hang'?new Promise(resolve=>{window.__releaseToken=resolve;}):Promise.resolve('active-tab-'+identity);},[identity]);const onPending=useCallback(value=>setPending(value),[]);return <main style={{maxWidth:960,margin:'auto'}}><button id="identity" onClick={()=>setIdentity(identity==='a'?'b':'a')}>Cambiar identidad de ensayo</button><button id="project" disabled={pending}>Cambiar obra</button><TemplateSendPanel key={identity} projectId={'p-'+identity} scope={identity.repeat(64)} getSessionToken={token} onPending={onPending}/></main>}`);
const port=3170,origin='http://127.0.0.1:'+port,server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',fixture,'--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
let log='',browser,activePage,activeScenario,failure;const checks=[],errors=[];for(const stream of [server.stdout,server.stderr])stream.on('data',chunk=>{log=(log+chunk.toString()).slice(-14000);});
const scope='a'.repeat(64),templateKey='open_attendance_reminder',snapshot=()=>({scope,projectId:'p-a',projectName:'Obra de ensayo',canSend:true,template:{key:templateKey,title:'Recordatorio de jornada abierta',bodyText:'Tu jornada en Obra de ensayo sigue abierta. Cuando termines, registrá la salida en ObraSaaS: https://obrasaas.com/cuenta',providerStatus:'APPROVED',canSend:true},records:[{workerId:'worker-a',name:'Persona de ensayo',eligible:true},{workerId:'worker-b',name:'Persona sin autorización',eligible:false}],recent:[]});
const outcome=(command,state='ACCEPTED',extra={})=>({scope,projectId:'p-a',state,receipt:{id:'outbound-fixture',operationId:command.operationId,workerId:'worker-a',templateKey},saved:['ACCEPTED','STATUS_OBSERVED'].includes(state),definitive:['ACCEPTED','REJECTED','STATUS_OBSERVED'].includes(state),providerAccepted:state==='ACCEPTED'||state==='STATUS_OBSERVED',providerStatus:null,deliveryConfirmed:false,...extra});
const wait=(page,text)=>page.waitForFunction(value=>document.body.innerText.includes(value),{timeout:15000},text);
async function click(page,text){await page.waitForFunction(value=>[...document.querySelectorAll('button')].some(button=>button.textContent.trim()===value&&!button.disabled),{timeout:15000},text);const handle=await page.evaluateHandle(value=>[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===value),text);await handle.asElement().click();await handle.dispose();}
const refs=page=>page.evaluate(()=>window.__fixtureReferences());
async function scenario(mode,width=390){
 const context=await browser.createBrowserContext(),page=await context.newPage();activePage=page;activeScenario={mode,width};await page.setViewport({width,height:1050});page.on('pageerror',error=>errors.push({mode,width,message:error.message}));
 await page.evaluateOnNewDocument(()=>{const schedule=window.setTimeout;window.setTimeout=(callback,delay,...args)=>schedule(callback,delay===15000?180:delay===55000?800:delay,...args);document.cookie='__session=other-tab-synthetic-org-b; Path=/';});
 const posts=[],gets=[];let saved,denyRecover=false,wrongRecovery=true;
 await page.setRequestInterception(true);page.on('request',async request=>{try{
  const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();throw new Error('Unexpected external request');}if(url.pathname!=='/api/identity/template-send')return request.continue();
  assert.equal(request.headers().authorization,'Bearer active-tab-a');assert.ok(request.headers().cookie.includes('other-tab-synthetic-org-b'));let body,status=200;
  if(request.method()==='POST'){const command=JSON.parse(request.postData());assert.deepEqual(Object.keys(command).sort(),['operationId','projectId','scope','templateKey','workerId']);posts.push(command);saved=command;
   if(mode==='uncertain'||mode==='recover-sdk-fail'||mode==='recover-denied'||mode==='not-observed'||mode==='malformed-get'){status=503;body={code:'META_CUSTOMER_TEMPLATE_SEND_UNCONFIRMED'};}
   else if(mode==='provider-unknown')body=outcome(command,'SEND_UNKNOWN',{providerAccepted:false});
   else if(mode==='provider-rejected')body=outcome(command,'REJECTED',{providerAccepted:false,code:'META_CUSTOMER_PROVIDER_REJECTED'});
   else if(mode==='state-changed'){status=409;body={code:'META_CUSTOMER_TEMPLATE_SEND_STATE_CHANGED'};}
   else if(mode==='malformed-post')body=outcome(command,'ACCEPTED',{receipt:{...outcome(command).receipt,workerId:'worker-b'}});else body=outcome(command);
  }else{gets.push(url.search);if(url.searchParams.has('operationId')){
    assert.equal(url.searchParams.get('operationId'),saved.operationId);
    if(denyRecover){status=403;body={code:'WORKSPACE_CONTEXT_CHANGED'};}
    else if(mode==='not-observed')body=outcome(saved,'NOT_OBSERVED',{receipt:null,saved:false,definitive:false,providerAccepted:false});
    else if(mode==='malformed-get'&&wrongRecovery)body=outcome(saved,'ACCEPTED',{receipt:{...outcome(saved).receipt,workerId:'worker-b'}});else body=outcome(saved,'STATUS_OBSERVED',{providerStatus:'delivered',deliveryConfirmed:true});
   }else if(mode==='denied'){status=403;body={code:'WORKSPACE_INTEGRATION_PERMISSION_REQUIRED'};}
   else if(mode==='foreign')body={...snapshot(),projectId:'p-b'};
   else if(mode==='empty')body={...snapshot(),canSend:false,template:{...snapshot().template,canSend:false,providerStatus:null},records:[]};
   else if(mode==='history'){saved={scope,projectId:'p-a',workerId:'worker-a',templateKey,operationId:'01234567-89ab-4cde-8fab-0123456789ab'};body={...snapshot(),recent:[outcome(saved)]};}
   else body=snapshot();}
  await request.respond({status,contentType:'application/json',body:JSON.stringify(body),headers:{'Cache-Control':'private, no-store'}});
 }catch(error){errors.push({mode,width,message:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}});
 await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await click(page,'Consultar disponibilidad');
 if(['empty','denied','foreign'].includes(mode)){await wait(page,mode==='empty'?'Todavía no hay un envío disponible':mode==='denied'?'No se pudo confirmar':'No se pudo comprobar');assert.equal(posts.length,0);assert.ok(!((await page.evaluate(()=>document.body.innerText)).includes('Mensaje para Persona')));checks.push(mode+'-no-private-or-send-controls');await context.close();return;}
 if(mode==='history'){await wait(page,'Envíos recientes de tu cuenta');await page.click('summary');await click(page,'Consultar este envío');await wait(page,'Meta informó entrega');assert.equal(posts.length,0);assert.equal(gets.filter(value=>value.includes('operationId')).length,1);checks.push('durable-history-delivery-read-is-GET-only');await context.close();return;}
 await wait(page,'Persona de ensayo');await page.select('select','worker-a');assert.equal(await page.$eval('button[type=submit]',button=>button.disabled),true);await page.click('input[type=checkbox]');await page.waitForFunction(()=>document.querySelector('#project').disabled,{timeout:15000});assert.equal(await page.$eval('#project',button=>button.disabled),true);
 if(width!==390||mode==='accepted')await page.screenshot({path:path.join(evidence,`template-send-${width}.png`),fullPage:true});
 if(['sdk-fail','sdk-hang','identity-cancel'].includes(mode))await page.evaluate(value=>{window.__tokenMode=value==='sdk-fail'?'fail':'hang';},mode);
 await click(page,'Enviar recordatorio autorizado');
 if(mode==='identity-cancel'){await page.waitForFunction(()=>typeof window.__releaseToken==='function');await page.click('#identity');await page.evaluate(()=>window.__releaseToken?.('stale-token'));await wait(page,'Consultar disponibilidad');assert.equal(posts.length,0);assert.equal((await refs(page)).length,0);checks.push('identity-unmount-cancels-before-dispatch');await context.close();return;}
 if(['sdk-fail','sdk-hang'].includes(mode)){await wait(page,'No se pudo renovar tu sesión');assert.equal(posts.length,0);assert.equal((await refs(page)).length,0);checks.push(mode+'-before-send-retains-no-phantom-receipt');await context.close();return;}
 if(mode==='state-changed'){await wait(page,'Cambió la jornada');assert.equal(posts.length,1);assert.equal((await refs(page)).length,0);checks.push('changed-state-no-auto-resend-and-needs-fresh-review');await context.close();return;}
 if(mode==='provider-rejected'){await wait(page,'Meta rechazó');assert.equal(posts.length,1);assert.equal((await refs(page)).length,0);checks.push('rejection-is-not-delivery-and-clears-exact-reference');await context.close();return;}
 if(['uncertain','provider-unknown','recover-sdk-fail','recover-denied','not-observed','malformed-post','malformed-get'].includes(mode)){
  await wait(page,'sin confirmar');assert.equal((await refs(page)).length,1);assert.equal(await page.$eval('#project',button=>button.disabled),true);
  if(mode==='recover-sdk-fail'){await page.evaluate(()=>{window.__tokenMode='fail';});await click(page,'Comprobar envío sin repetirlo');await wait(page,'No se pudo renovar tu sesión');assert.equal((await refs(page)).length,1);await page.evaluate(()=>{window.__tokenMode='normal';});}
  if(mode==='malformed-get'){await click(page,'Comprobar envío sin repetirlo');await wait(page,'No se pudo comprobar el resultado');assert.equal((await refs(page)).length,1);assert.equal(posts.length,1);wrongRecovery=false;}
  if(mode==='recover-denied')denyRecover=true;
  await click(page,'Comprobar envío sin repetirlo');await wait(page,mode==='not-observed'?'Todavía no se observa':mode==='recover-denied'?'Cambió tu acceso':'Meta informó entrega');
  assert.equal(posts.length,1);assert.equal((await refs(page)).length,['not-observed','recover-denied'].includes(mode)?1:0);if(mode==='recover-denied')assert.equal(await page.$('select'),null);
  checks.push(mode+'-same-operation-GET-recovery-no-resend');await context.close();return;
 }
 await wait(page,'Meta aceptó');assert.equal(posts.length,1);assert.equal((await refs(page)).length,0);assert.ok((await page.evaluate(()=>document.body.innerText)).includes('entrega todavía no está confirmada'));await click(page,'Consultar estado de entrega');await wait(page,'Meta informó entrega');assert.equal(posts.length,1);checks.push('reviewed-template-accepted-vs-delivered-'+width);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await context.close();
}
function stopOwned(pid){const result=spawnSync('taskkill.exe',['/PID',String(pid),'/T','/F'],{stdio:'ignore'});if(result.status!==0){try{process.kill(pid,0);}catch(error){if(error.code==='ESRCH')return;throw error;}assert.equal(result.status,0,'Owned process cleanup failed');}}
try{let ready=false;for(let n=0;n<100;n++){if(server.exitCode!==null)throw new Error('Fixture server exited');try{if((await fetch(origin)).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,500));}assert.ok(ready);browser=await puppeteer.launch({headless:true,...(process.platform==='win32'?{channel:'chrome'}:{}),args:['--no-sandbox','--disable-setuid-sandbox']});
 for(const width of [320,390,768,1280])await scenario('accepted',width);for(const mode of ['uncertain','provider-unknown','recover-sdk-fail','recover-denied','not-observed','provider-rejected','state-changed','empty','denied','foreign','sdk-fail','sdk-hang','identity-cancel','history','malformed-post','malformed-get'])await scenario(mode);
 assert.deepEqual(errors,[]);
}catch(error){failure=error;let snapshot=null;if(activePage&&!activePage.isClosed()){snapshot=await activePage.evaluate(()=>({text:document.body.innerText,buttons:[...document.querySelectorAll('button')].map(button=>({text:button.textContent,disabled:button.disabled}))})).catch(()=>null);await activePage.screenshot({path:path.join(evidence,'browser-failure.png'),fullPage:true}).catch(()=>{});}writeFileSync(path.join(evidence,'browser-failure.json'),JSON.stringify({message:error.message,scenario:activeScenario,checks,errors,snapshot,log},null,2));}
finally{if(process.platform==='win32'){if(browser){const pid=browser.process().pid;browser.disconnect();stopOwned(pid);}stopOwned(server.pid);}else{await browser?.close();try{process.kill(-server.pid,'SIGTERM');}catch{}}
 const target=path.resolve(fixture);assert.ok(target.startsWith(parent+path.sep)&&path.basename(target).startsWith('template-send-ui-'));rmSync(target,{recursive:true,force:true});}
if(failure)throw failure;
const proof={status:'PASS',environment:'actual-components-with-controlled-HTTP-and-session',checkedAt:new Date().toISOString(),checks,widths:[320,390,768,1280],errors,productionDataWritten:false,realProviderCalls:0,realConsentAccepted:false,realTemplateDeliveryAccepted:false};writeFileSync(path.join(evidence,'browser.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify({status:'PASS',checks:checks.length,pageErrors:errors.length}));
