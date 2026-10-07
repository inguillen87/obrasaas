import assert from 'node:assert/strict';
import {copyFileSync,mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {spawn} from 'node:child_process';
import puppeteer from 'puppeteer';
import {PARTICIPANT_NOTICE,PARTICIPANT_NOTICE_VERSION,participantKycInput} from '../src/lib/participant-policy.mjs';

assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV,'Only an isolated local fixture may run this script');
const widths=[320,390,768,1280],readModes=['local-read-cancel','local-read-timeout','local-read-abort','local-read-error','local-read-sync-error','local-read-context'],focusedScenario=process.env.MOBILE_IDENTITY_UI_SCENARIO||null;assert.ok(!focusedScenario||readModes.includes(focusedScenario)||focusedScenario==='local-read-recovery');assert.ok(!process.env.MOBILE_IDENTITY_UI_WIDTH||focusedScenario);const selectedWidths=process.env.MOBILE_IDENTITY_UI_WIDTH?[Number(process.env.MOBILE_IDENTITY_UI_WIDTH)]:widths;assert.ok(selectedWidths.every(width=>widths.includes(width)));
const startedAt=Date.now(),root=process.cwd(),evidence=path.resolve(root,process.env.MOBILE_IDENTITY_UI_EVIDENCE_DIR||'.vercel/mobile-identity-evidence');assert.ok(evidence.startsWith(root+path.sep));mkdirSync(evidence,{recursive:true});
const fixture=mkdtempSync(path.join(root,'.vercel/mobile-identity-ui-')),app=path.join(fixture,'app');mkdirSync(app);
const sources=['participant-panel.js','employee-intake-panel.js', 'private-bank-account-panel.js', 'private-bank-account-panel.module.css','participant-panel.module.css','kyc-photo-preparation.js','field-media-preparation.mjs','workspace-session-request.mjs','workspace-request-lifecycle.js','workspace-request-lifecycle.mjs','workspace-recovery-journal.mjs', 'private-bank-account-format.mjs','company-channel-view.mjs','site-purchase-view.mjs','workspace-recovery-storage.mjs'];
for(const file of sources)copyFileSync(path.join(root,'src/app/(identity)/cuenta',file),path.join(app,file));
const sha256=value=>createHash('sha256').update(value).digest('hex'),hashes=Object.fromEntries(sources.map(file=>[file,sha256(readFileSync(path.join(app,file)))])),sourceManifest=[...sources.map(file=>({path:'src/app/(identity)/cuenta/'+file,sha256:hashes[file]})),...['participant-policy.mjs','workspace-policy.mjs','private-image-upload.mjs'].map(file=>({path:'src/lib/'+file,sha256:sha256(readFileSync(path.join(root,'src/lib',file)))}))];
writeFileSync(path.join(fixture,'package.json'),JSON.stringify({name:'isolated-mobile-identity',private:true}));
writeFileSync(path.join(fixture,'next.config.mjs'),`export default {devIndicators:false,turbopack:{root:${JSON.stringify(root)}}};`);
writeFileSync(path.join(app,'layout.js'),`export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:12,background:'#eef3f9',fontFamily:'Arial,sans-serif'}}>{children}</body></html>}`);
const scope='a'.repeat(64),projectId='project-mobile',workerId='worker-mobile';
writeFileSync(path.join(app,'page.js'),`'use client';import {useCallback,useState} from 'react';import {ParticipantPanel} from './participant-panel';import {preparePhoto} from './field-media-preparation.mjs';import {browserRecoveryJournal} from './workspace-recovery-journal.mjs';export default function Page(){const [context,setContext]=useState(0);const token=useCallback(async()=> 'synthetic-active-context-'+context,[context]);if(typeof window!=='undefined'){window.__preparePhoto=preparePhoto;window.__mobileReferences=()=>browserRecoveryJournal.list('${scope}');}return <main style={{maxWidth:1000,margin:'0 auto'}}><h1>Ensayo controlado de identidad móvil</h1><p>Fotografías e identidad sintéticas. Ningún proveedor real.</p><button onClick={()=>setContext(value=>value+1)}>Cambiar contexto de ensayo</button><ParticipantPanel key={context} projectId="${projectId}" scope="${scope}" getSessionToken={token}/></main>}`);
mkdirSync(path.join(app,'preparation'));
writeFileSync(path.join(app,'preparation/page.js'),`'use client';import {KycPhotoPreparation} from '../kyc-photo-preparation';export default function Page(){return <main style={{maxWidth:600,margin:'0 auto'}}><h1>Ensayo controlado del componente</h1><KycPhotoPreparation kind="front" onChange={async file=>{if(!file)return false;if(window.__rejectAcceptance)throw new Error('Controlled parent failure');return true;}}/></main>}`);
const port=3331,origin='http://127.0.0.1:'+port;
const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',fixture,'--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
let serverLog='';for(const stream of [server.stdout,server.stderr])stream.on('data',bytes=>{serverLog=(serverLog+bytes.toString()).slice(-18000);});
const small=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==','base64'),smallPath=path.join(fixture,'synthetic-small.png');writeFileSync(smallPath,small);
let browser,activePage,activeScenario;const errors=[],checks=[],postsSummary=[];
const front='fieldset[aria-label="Frente del documento"]',selfie='fieldset[aria-label="Fotografía del rostro"]';
async function wait(page,text){await page.waitForFunction(value=>document.body.innerText.includes(value),{timeout:15000},text);}
async function click(page,text){await page.waitForFunction(value=>[...document.querySelectorAll('button')].some(button=>button.textContent.trim()===value&&!button.disabled),{timeout:15000},text);const handle=await page.evaluateHandle(value=>[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===value),text);await handle.asElement().click();await handle.dispose();}
async function disabled(page,text){return page.$$eval('button',(all,value)=>all.find(button=>button.textContent.trim()===value).disabled,text);}
async function upload(page,selector,file){const input=await page.$(selector+' input[type=file]');await input.uploadFile(file);}
async function review(page,selector,label){await page.waitForSelector(selector+' img');assert.equal(await disabled(page,label),true);await page.click(selector+' input[type=checkbox]');await click(page,label);await page.waitForFunction(selector=>!document.querySelector(selector+' input[type=checkbox]'),{timeout:15000},selector);}
async function noOverflow(page){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow');}
async function allRevoked(page){assert.ok(await page.evaluate(()=>window.__kycTest.urls.every(url=>window.__kycTest.revoked.includes(url))),'Every local preview/original URL must be revoked');}


async function installLocalReadFixture(page,{accelerateDeadline=false,synchronousError=false}={}){
 await page.evaluate(({accelerateDeadline,synchronousError})=>{
  const NativeReader=window.FileReader,nativeTimeout=window.setTimeout.bind(window),nativeClear=window.clearTimeout.bind(window),add=AbortSignal.prototype.addEventListener,remove=AbortSignal.prototype.removeEventListener;
  const test=window.__localReadFixture={readers:[],requestedDeadlines:[],clockScale:accelerateDeadline?10:1,synchronousError};
  window.FileReader=class{
   constructor(){this.readyState=0;this.result=null;this.listenerAttached=false;test.readers.push(this);test.current=this;}
   readAsDataURL(file){this.file=file;this.readyState=1;this.saved={load:this.onload,error:this.onerror,abort:this.onabort};if(test.synchronousError){test.synchronousError=false;throw new Error('Controlled synchronous local reader failure');}}
   abort(){this.readyState=2;this.abortCalls=(this.abortCalls||0)+1;/* Deliberately no abort event: cancellation must settle independently. */}
  };
  window.setTimeout=(callback,ms,...args)=>{
   const reader=test.current;if(ms!==15000||!reader||reader.deadlineId!==undefined)return nativeTimeout(callback,ms,...args);
   test.requestedDeadlines.push(ms);reader.timerPending=true;
   reader.deadlineId=nativeTimeout(()=>{reader.timerPending=false;reader.deadlineFired=true;callback(...args);},ms/test.clockScale);return reader.deadlineId;
  };
  window.clearTimeout=id=>{for(const reader of test.readers)if(reader.deadlineId===id){reader.timerPending=false;reader.timerCleared=true;}return nativeClear(id);};
  AbortSignal.prototype.addEventListener=function(type,callback,options){const reader=test.current;if(type==='abort'&&reader&&!reader.signal){reader.signal=this;reader.abortListener=callback;reader.listenerAttached=true;}return add.call(this,type,callback,options);};
  AbortSignal.prototype.removeEventListener=function(type,callback,options){for(const reader of test.readers)if(type==='abort'&&reader.signal===this&&reader.abortListener===callback)reader.listenerAttached=false;return remove.call(this,type,callback,options);};
  test.release=async(index,late=false)=>{const reader=test.readers[index];reader.result=await new Promise((resolve,reject)=>{const native=new NativeReader();native.onload=()=>resolve(native.result);native.onerror=()=>reject(new Error('Native fixture read failed'));native.readAsDataURL(reader.file);});reader.readyState=2;(late?reader.saved.load:reader.onload)?.call(reader,new Event('load'));};
  test.emit=(index,type,late=false)=>{const reader=test.readers[index];reader.readyState=2;(late?reader.saved[type]:reader['on'+type])?.call(reader,new Event(type));};
  test.restore=()=>{window.FileReader=NativeReader;};
 },{accelerateDeadline,synchronousError});
}
async function localReadSnapshot(page){return page.evaluate(()=>({requestedDeadlines:window.__localReadFixture.requestedDeadlines,clockScale:window.__localReadFixture.clockScale,readers:window.__localReadFixture.readers.map(reader=>({readyState:reader.readyState,listenerAttached:reader.listenerAttached,timerPending:Boolean(reader.timerPending),timerCleared:Boolean(reader.timerCleared),deadlineFired:Boolean(reader.deadlineFired),abortCalls:reader.abortCalls||0,handlersCleared:reader.onload===null&&reader.onerror===null&&reader.onabort===null}))}));}
async function assertLocalReadCleanup(page){const snapshot=await localReadSnapshot(page);assert.ok(snapshot.readers.length>0);for(const reader of snapshot.readers){assert.equal(reader.listenerAttached,false);assert.equal(reader.timerPending,false);assert.equal(reader.timerCleared,true);assert.equal(reader.handlersCleared,true);}assert.ok(snapshot.requestedDeadlines.every(ms=>ms===15000));return snapshot;}

async function scenario(width,mode,largePath){
 const context=await browser.createBrowserContext(),page=await context.newPage();activePage=page;activeScenario={width,mode};await page.setViewport({width,height:1050});page.on('pageerror',error=>errors.push({width,mode,message:error.message}));
 await page.evaluateOnNewDocument(()=>{
  window.__kycTest={urls:[],revoked:[],decodes:0,closed:0,hold:false,waiting:[]};const test=window.__kycTest,create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL),bitmap=createImageBitmap.bind(window);
  URL.createObjectURL=blob=>{const url=create(blob);test.urls.push(url);return url;};URL.revokeObjectURL=url=>{test.revoked.push(url);return revoke(url);};
  window.createImageBitmap=async(...args)=>{test.decodes++;const image=await bitmap(...args),close=image.close.bind(image);image.close=()=>{test.closed++;close();};if(test.hold)await new Promise(resolve=>test.waiting.push(resolve));return image;};
 });
 let row={id:workerId,name:'Persona sintética',self:true,active:true,status:'ACTIVE',revision:'2026-10-01T11:00:00.000001',accountLinked:true,permissions:{attendance:true,report:false},identityCertified:false,whatsAppAccessGranted:false,invitation:null,kyc:{status:'NOT_SUBMITTED',submissionId:null,submittedAt:null,review:null,images:[]}};
 const posts=[],receipts=new Map();await page.setRequestInterception(true);
 page.on('request',async request=>{
  if(!request.url().startsWith(origin+'/api/identity/participants')){await request.continue();return;}
  assert.match(request.headers().authorization||'',/^Bearer synthetic-active-context-/);const url=new URL(request.url());assert.equal(url.searchParams.get('scope')||scope,scope);
  if(request.method()==='GET'){
   const operationId=url.searchParams.get('operationId');const body=operationId?{...receipts.get(operationId),state:'RECORDED'}:{scope,projectId,canManage:false,canInvite:false,canManageOfficeRoles:false,privacyNotice:{version:PARTICIPANT_NOTICE_VERSION,text:PARTICIPANT_NOTICE},records:[row],existingAccounts:[],nextCursor:null};
   await request.respond({status:200,contentType:'application/json',body:JSON.stringify(body)});return;
  }
  assert.equal(request.method(),'POST');const input=JSON.parse(request.postData());const decoded=participantKycInput(input);assert.equal(input.scope,scope);assert.equal(input.projectId,projectId);assert.equal(input.workerId,workerId);assert.ok(decoded.front.bytes.length<=1024*1024);assert.ok(decoded.selfie.bytes.length<=1024*1024);assert.ok(Buffer.byteLength(request.postData())<4*1024*1024);
  posts.push(input);postsSummary.push({width,mode,frontBytes:decoded.front.bytes.length,selfieBytes:decoded.selfie.bytes.length,frontType:decoded.front.contentType,selfieType:decoded.selfie.contentType,bodyBytes:Buffer.byteLength(request.postData()),consent:input.consent});
  if(mode.startsWith('denial-')){await request.respond({status:Number(mode.slice(7)),contentType:'application/json',body:JSON.stringify({code:'PARTICIPANT_ACCESS_REQUIRED'})});return;}
  row={...row,kyc:{...row.kyc,status:'PENDING_REVIEW',submissionId:'synthetic-submission'}};const body={scope,projectId,saved:true,receiptId:'participant_synthetic-receipt',participant:row};receipts.set(input.operationId,body);await request.respond({status:mode==='lost-response'?503:200,contentType:'application/json',body:JSON.stringify(mode==='lost-response'?{code:'CONTROLLED_RESPONSE_LOST'}:body)});
 });
 await page.goto(origin,{waitUntil:'networkidle0'});await click(page,'Consultar participantes');await wait(page,'Persona sintética');await click(page,'Presentar mi identidad');assert.equal(await page.$eval(front+' input',input=>input.getAttribute('capture')),'environment');assert.equal(await page.$eval(selfie+' input',input=>input.getAttribute('capture')),'user');assert.equal(posts.length,0);

 if(readModes.includes(mode)){
  await upload(page,front,smallPath);await page.waitForSelector(front+' img');await page.click(front+' input[type=checkbox]');const preview=await page.$eval(front+' img',image=>image.src),allocated=await page.evaluate(()=>window.__kycTest.urls.length);
  await installLocalReadFixture(page,{accelerateDeadline:mode==='local-read-timeout',synchronousError:mode==='local-read-sync-error'});await click(page,'Usar documento revisado');await page.waitForFunction(()=>window.__localReadFixture.readers.length===1);
  if(mode==='local-read-context'){
   await click(page,'Cambiar contexto de ensayo');await page.waitForFunction(()=>!document.querySelector('fieldset'));await page.evaluate(()=>window.__localReadFixture.release(0,true));assert.equal(await page.$('img'),null);assert.equal(posts.length,0);await allRevoked(page);const cleanup=await assertLocalReadCleanup(page);checks.push({id:mode,width,cleanup,forcedContextRemount:true,lateReadDiscarded:true,automaticPosts:0});await context.close();return;
  }
  if(mode==='local-read-cancel'){await wait(page,'Leyendo la copia revisada');await click(page,'Cancelar lectura local');await wait(page,'Lectura detenida. Conservamos esta copia');await page.waitForFunction(()=>document.activeElement?.textContent.trim()==='Usar documento revisado');}
  else if(mode==='local-read-timeout')await wait(page,'No se completó la lectura en 15 segundos');
  else if(mode==='local-read-abort'){await page.evaluate(()=>window.__localReadFixture.emit(0,'abort'));await wait(page,'Lectura detenida. Conservamos esta copia');}
  else if(mode==='local-read-error'){await page.evaluate(()=>window.__localReadFixture.emit(0,'error'));await wait(page,'No se pudo leer la imagen');}
  else await wait(page,'No se pudo leer la imagen');
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.textContent==='Usar documento revisado'&&!button.disabled));assert.equal(await page.$eval(front+' img',image=>image.src),preview);assert.equal(await page.$eval(front+' input[type=checkbox]',input=>input.checked),true);assert.equal(await page.evaluate(()=>window.__kycTest.urls.length),allocated);assert.equal(await page.evaluate(()=>window.__kycTest.revoked.length),0);assert.equal(await disabled(page,'Presentar para revisión'),true);assert.equal(posts.length,0);assert.equal((await page.evaluate(()=>window.__mobileReferences())).length,0);
  const cleanup=await assertLocalReadCleanup(page);assert.deepEqual(cleanup.requestedDeadlines,[15000]);if(mode==='local-read-timeout'){assert.equal(cleanup.clockScale,10);assert.equal(cleanup.readers[0].deadlineFired,true);}if(mode==='local-read-cancel')assert.equal(cleanup.readers[0].abortCalls,1);
  await noOverflow(page);await page.screenshot({path:path.join(evidence,'read-recovery-'+width+'-'+mode+'.png'),fullPage:true});await page.evaluate(()=>window.__localReadFixture.restore());await click(page,'Usar documento revisado');await wait(page,'Imagen revisada y lista para presentar');assert.equal(posts.length,0);assert.equal((await page.evaluate(()=>window.__mobileReferences())).length,0);await click(page,'Cancelar');await allRevoked(page);checks.push({id:mode,width,copyAndReviewPreserved:true,cleanup,positiveRetry:'NativeFileReader',automaticPosts:0,noJournalAck:true});await context.close();return;
 }

 if(['cancel-decode','replace-decode','unmount-decode'].includes(mode)){
  await page.evaluate(()=>{window.__kycTest.hold=true;});await upload(page,front,largePath);await page.waitForFunction(()=>window.__kycTest.waiting.length===1);assert.equal(await page.evaluate(()=>window.__kycTest.urls.length),0);
  if(mode==='cancel-decode')await click(page,'Cancelar preparación');
  else if(mode==='unmount-decode')await click(page,'Cancelar');
  else{await page.evaluate(()=>{window.__kycTest.hold=false;});await upload(page,front,smallPath);await page.waitForSelector(front+' img');}
  await page.evaluate(()=>{window.__kycTest.waiting.splice(0).forEach(resolve=>resolve());});await page.waitForFunction(expected=>window.__kycTest.closed===expected,{},mode==='replace-decode'?2:1);
  if(mode==='replace-decode'){assert.equal(await page.$eval(front+' img',image=>image.naturalWidth),1);assert.equal(await page.evaluate(()=>window.__kycTest.urls.length),1);await click(page,'Descartar fotografía');}
  else assert.equal(await page.$('fieldset img'),null);
  assert.equal(posts.length,0);await allRevoked(page);checks.push({id:mode,width,lateDecoderClosed:true,automaticPosts:0});await context.close();return;
 }
 if(mode.startsWith('fallback-')){
  await page.evaluate(()=>{window.createImageBitmap=undefined;window.__kycTest.fallback=[];HTMLImageElement.prototype.decode=function(){const image=this;return new Promise(resolve=>window.__kycTest.fallback.push(()=>{window.__kycTest.fallbackSource=image.src;resolve();}));};});
  await upload(page,front,mode==='fallback-small'?smallPath:largePath);await page.waitForFunction(()=>window.__kycTest.fallback.length===1);assert.equal(await page.evaluate(()=>window.__kycTest.urls.length),1);
  await click(page,mode==='fallback-unmount'?'Cancelar':'Cancelar preparación');await page.waitForFunction(()=>window.__kycTest.revoked.length===1);assert.equal(await page.$('fieldset img'),null);assert.equal(posts.length,0);
  await page.evaluate(()=>window.__kycTest.fallback.splice(0).forEach(resolve=>resolve()));await page.waitForFunction(()=>window.__kycTest.fallbackSource===location.href);await allRevoked(page);checks.push({id:mode,width,urlRevokedBeforeDecodeResolved:true,lateUpdate:false,automaticPosts:0});await context.close();return;
 }
 if(mode==='bounds'){
  for(const test of ['heic','bytes','pixels','truncated']){
   const decodes=await page.evaluate(()=>window.__kycTest.decodes),urls=await page.evaluate(()=>window.__kycTest.urls.length);
   await page.$eval(front+' input',(input,test)=>{let file;if(test==='heic')file=new File(['synthetic'],'phone.heic',{type:'image/heic'});else if(test==='bytes')file=new File([new Uint8Array(20*1024*1024+1)],'huge.jpg',{type:'image/jpeg'});else{const bytes=new Uint8Array(test==='pixels'?24:12);if(test==='pixels'){bytes.set([137,80,78,71,13,10,26,10]);bytes.set([73,72,68,82],12);new DataView(bytes.buffer).setUint32(16,8000);new DataView(bytes.buffer).setUint32(20,8000);}file=new File([bytes],'header.png',{type:'image/png'});}const files=new DataTransfer();files.items.add(file);input.files=files.files;input.dispatchEvent(new Event('change',{bubbles:true}));},test);
   await wait(page,test==='heic'?'HEIC no se admite':test==='truncated'?'No se pudo comprobar':'supera el tamaño seguro');assert.equal(await page.evaluate(()=>window.__kycTest.decodes),decodes);assert.equal(await page.evaluate(()=>window.__kycTest.urls.length),urls);assert.equal(await disabled(page,'Presentar para revisión'),true);checks.push({id:'predecode-'+test,width,allocatedDecoders:0,automaticPosts:0});
  }
  await page.$eval(front+' input',input=>{const bytes=new Uint8Array(24);bytes.set([137,80,78,71,13,10,26,10]);bytes.set([73,72,68,82],12);new DataView(bytes.buffer).setUint32(16,400);new DataView(bytes.buffer).setUint32(20,300);const files=new DataTransfer();files.items.add(new File([bytes],'corrupt-with-valid-header.png',{type:'image/png'}));input.files=files.files;input.dispatchEvent(new Event('change',{bubbles:true}));});await wait(page,'No se pudo abrir la fotografía');assert.equal(await page.$('fieldset img'),null);assert.equal(await page.$('fieldset button'),null);await allRevoked(page);checks.push({id:'valid-header-corrupt-pixels-rejected-before-review',width,automaticPosts:0});assert.equal(posts.length,0);await context.close();return;
 }
 const file=mode==='small-original'?smallPath:mode==='orientation'?path.join(fixture,'synthetic-oriented.jpg'):largePath;await upload(page,front,file);await page.waitForSelector(front+' img');assert.equal(posts.length,0);assert.equal(await disabled(page,'Presentar para revisión'),true);
 const originalBytes=await page.$eval(front+' a[download]',async anchor=>new Uint8Array(await (await fetch(anchor.href)).arrayBuffer()).length);assert.equal(originalBytes,readFileSync(file).length);
 const originalHash=await page.$eval(front+' a[download]',async anchor=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await (await fetch(anchor.href)).arrayBuffer()))).map(byte=>byte.toString(16).padStart(2,'0')).join(''));assert.equal(originalHash,createHash('sha256').update(readFileSync(file)).digest('hex'));
 if(mode==='normal'){const rotate=await page.evaluateHandle(selector=>[...document.querySelector(selector).querySelectorAll('button')].find(button=>button.textContent==='Girar 90°'),front);await rotate.asElement().click();await rotate.dispose();await wait(page,'1400 × 1800 px');await page.waitForFunction(selector=>document.querySelector(selector+' img').naturalWidth===1400&&document.querySelector(selector+' img').naturalHeight===1800,{},front);}
 if(mode==='orientation'){await page.waitForFunction(selector=>document.querySelector(selector+' img').naturalWidth===45&&document.querySelector(selector+' img').naturalHeight===90,{},front);const rotate=await page.evaluateHandle(selector=>[...document.querySelector(selector).querySelectorAll('button')].find(button=>button.textContent==='Girar 90°'),front);await rotate.asElement().click();await rotate.dispose();await wait(page,'90 × 45 px');await page.waitForFunction(selector=>document.querySelector(selector+' img').naturalWidth===90&&document.querySelector(selector+' img').naturalHeight===45,{},front);}
 await review(page,front,'Usar documento revisado');await upload(page,selfie,file);await review(page,selfie,'Usar fotografía revisada');assert.equal(await disabled(page,'Presentar para revisión'),true);assert.equal(posts.length,0);
 await page.click('input[type=checkbox]');assert.equal(await disabled(page,'Presentar para revisión'),false);await noOverflow(page);await page.screenshot({path:path.join(evidence,`ready-${width}-${mode}.png`),fullPage:true});
 if(mode==='context-change'){await click(page,'Cambiar contexto de ensayo');await page.waitForFunction(()=>!document.querySelector('fieldset'));assert.equal(posts.length,0);await allRevoked(page);checks.push({id:mode,width});await context.close();return;}
 await click(page,'Presentar para revisión');
 if(mode.startsWith('denial-')){await wait(page,'No hay un acceso activo');assert.equal(await page.$('fieldset'),null);await allRevoked(page);assert.equal(posts.length,1);checks.push({id:mode,width,privatePreviewHidden:true,allObjectUrlsRevoked:true});}
 else{
  if(mode==='lost-response'){await wait(page,'El resultado quedó sin confirmar');assert.equal(posts.length,1);await click(page,'Comprobar el mismo intento');}
  await wait(page,'Recibo:');await wait(page,'Pendiente de revisión humana');assert.equal(posts.length,1);assert.equal(row.kyc.status,'PENDING_REVIEW');assert.equal(row.identityCertified,false);await allRevoked(page);
  if(mode==='small-original'){assert.deepEqual(Buffer.from(posts[0].front.split(',')[1],'base64'),small);assert.deepEqual(Buffer.from(posts[0].selfie.split(',')[1],'base64'),small);}
  else assert.ok(posts[0].front.startsWith('data:image/jpeg;base64,'));
  checks.push({id:mode,width,canonicalServerInputAccepted:true,originalPreserved:true,explicitVisualReviewAndConsent:true,identityAccepted:false,posts:1});
 }
 await noOverflow(page);await context.close();
}

try{
 let ready=false;for(let count=0;count<100;count++){if(server.exitCode!==null)throw Error('Fixture exited: '+serverLog);try{const response=await fetch(origin);if(response.ok){ready=true;break;}if(response.status>=500)throw Error('Fixture compile error: '+serverLog);}catch(error){if(error.message.startsWith('Fixture compile'))throw error;}await new Promise(resolve=>setTimeout(resolve,500));}assert.ok(ready,'Fixture did not start');
 browser=await puppeteer.launch({headless:true,...(process.platform==='win32'?{channel:'chrome'}:{}),args:['--no-sandbox','--disable-setuid-sandbox']});
 const maker=await browser.newPage();await maker.goto(origin);const large=await maker.evaluate(async()=>{const canvas=document.createElement('canvas');canvas.width=1800;canvas.height=1400;const context=canvas.getContext('2d'),pixels=context.createImageData(1800,1400);let seed=42;for(let i=0;i<pixels.data.length;i+=4){for(let channel=0;channel<3;channel++){seed=(seed*1664525+1013904223)>>>0;pixels.data[i+channel]=seed>>>24;}pixels.data[i+3]=255;}context.putImageData(pixels,0,0);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));return new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(blob);});});const largePath=path.join(fixture,'synthetic-large.png');writeFileSync(largePath,Buffer.from(large,'base64'));assert.ok(readFileSync(largePath).length>1024*1024);await maker.close();
 const jpegMaker=await browser.newPage();await jpegMaker.goto(origin);const jpeg=Buffer.from(await jpegMaker.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=90;canvas.height=45;const context=canvas.getContext('2d');context.fillStyle='#12652d';context.fillRect(0,0,45,45);context.fillStyle='#f27823';context.fillRect(45,0,45,45);return canvas.toDataURL('image/jpeg').split(',')[1];}),'base64');await jpegMaker.close();
 const exif=Buffer.from([255,225,0,34,69,120,105,102,0,0,73,73,42,0,8,0,0,0,1,0,18,1,3,0,1,0,0,0,6,0,0,0,0,0,0,0]);writeFileSync(path.join(fixture,'synthetic-oriented.jpg'),Buffer.concat([jpeg.subarray(0,2),exif,jpeg.subarray(2)]));
 if(focusedScenario){for(const width of selectedWidths)for(const mode of focusedScenario==='local-read-recovery'?readModes:[focusedScenario])await scenario(width,mode,largePath);}else{
 for(const width of widths)await scenario(width,'normal',largePath);
 for(const mode of ['small-original','orientation','bounds','cancel-decode','replace-decode','unmount-decode','fallback-small','fallback-large','fallback-unmount','context-change','lost-response'])await scenario(390,mode,largePath);
 for(const width of [320,390,768,1280])for(const status of [401,403])await scenario(width,'denial-'+status,largePath);
 const acceptanceContext=await browser.createBrowserContext(),acceptancePage=await acceptanceContext.newPage();activePage=acceptancePage;activeScenario={width:390,mode:'acceptance-rejection'};await acceptancePage.setViewport({width:390,height:1050});acceptancePage.on('pageerror',error=>errors.push({mode:'acceptance-rejection',message:error.message}));await acceptancePage.goto(origin+'/preparation');await acceptancePage.evaluate(()=>{window.__rejectAcceptance=true;});await upload(acceptancePage,front,smallPath);await acceptancePage.waitForSelector(front+' img');await acceptancePage.click(front+' input[type=checkbox]');await click(acceptancePage,'Usar documento revisado');await wait(acceptancePage,'No se completó la lectura. Conservamos esta copia y tu revisión.');assert.equal(await disabled(acceptancePage,'Usar documento revisado'),false);await acceptancePage.evaluate(()=>{window.__rejectAcceptance=false;});await click(acceptancePage,'Usar documento revisado');await wait(acceptancePage,'Imagen revisada y lista para presentar');checks.push({id:'unexpected-parent-rejection-is-recoverable-no-unhandled-error',width:390});await acceptanceContext.close();
 for(const width of widths)for(const mode of readModes.slice(0,3))await scenario(width,mode,largePath);for(const mode of readModes.slice(3))await scenario(390,mode,largePath);}
 assert.deepEqual(errors,[]);const proof={status:'PASS',createdAt:new Date().toISOString(),durationMs:Date.now()-startedAt,environment:'actual-components-native-canvas-controlled-actor-and-intercepted-canonical-input',widths:focusedScenario?selectedWidths:widths,fullSuite:!focusedScenario,focusedScenario,checks,postBodies:postsSummary,sourceManifest,harnessSha256:sha256(readFileSync(new URL(import.meta.url))),errors,limits:{preparedBytes:1024*1024,originalBytes:20*1024*1024,originalPixels:24_000_000},limitations:{physicalPhone:false,realDocument:false,realHumanIdentityAccepted:false,realProviderWrites:false,noOfflineFileRestore:true}};writeFileSync(path.join(evidence,'browser.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(error){const snapshot=await activePage?.evaluate(()=>({text:document.body.innerText,buttons:[...document.querySelectorAll('button')].map(button=>({label:button.textContent.trim(),disabled:button.disabled})),localUrls:window.__kycTest?.urls.length,revokedUrls:window.__kycTest?.revoked.length,decodes:window.__kycTest?.decodes,closed:window.__kycTest?.closed})).catch(()=>null);await activePage?.screenshot({path:path.join(evidence,'browser-failure.png'),fullPage:true}).catch(()=>{});writeFileSync(path.join(evidence,'browser-failure.json'),JSON.stringify({status:'FAIL',message:error.message,scenario:activeScenario,checks,errors,sourceHashes:hashes,snapshot,serverLog},null,2));throw error;
}finally{await browser?.close();try{if(process.platform==='win32')server.kill();else process.kill(-server.pid,'SIGTERM');}catch{}await new Promise(resolve=>setTimeout(resolve,500));const parent=path.resolve(root,'.vercel'),target=path.resolve(fixture);assert.ok(target.startsWith(parent+path.sep)&&path.basename(target).startsWith('mobile-identity-ui-'));rmSync(target,{recursive:true,force:true});}
