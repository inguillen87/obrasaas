import assert from 'node:assert/strict';
import {copyFileSync,existsSync,mkdirSync,mkdtempSync,readFileSync,realpathSync,rmSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createServer} from 'node:net';
import {execFileSync,spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import puppeteer from 'puppeteer';
import {officeAdminSnapshot,officeReviewSnapshot} from '../src/app/(identity)/cuenta/office-review-view.mjs';

assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV,'Office review UI verification is local and synthetic');
const root=realpathSync(process.cwd()),vercelRoot=path.join(root,'.vercel'),evidence=path.join(vercelRoot,'office-review-evidence');
mkdirSync(evidence,{recursive:true});
const widths=[320,390,768,1280],modes=['reviewer','reviewer-late-scope','reviewer-late-project','admin','admin-denied-write','admin-pending','admin-late-scope','admin-late-project'];
const selectedMode=process.env.OFFICE_REVIEW_UI_SCENARIO||null;assert.ok(!selectedMode||modes.includes(selectedMode),'Unknown office review UI scenario');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),gitHead=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim();
const trackedClean=execFileSync('git',['status','--porcelain','--untracked-files=normal'],{cwd:root,encoding:'utf8',windowsHide:true}).trim()==='';
const harnessPath=path.relative(root,fileURLToPath(import.meta.url)).replaceAll('\\','/'),harnessSha256=hash(readFileSync(new URL(import.meta.url)));
const copiedFiles=['office-review-panel.js','office-review-panel.module.css','office-review-view.mjs','workspace.module.css','workspace-request-lifecycle.js','workspace-request-lifecycle.mjs','workspace-session-request.mjs','workspace-recovery-journal.mjs','workspace-recovery-storage.mjs','private-bank-account-format.mjs','site-purchase-view.mjs','company-channel-view.mjs','own-company-number-view.mjs','own-company-templates-view.mjs','participant-office-account-view.mjs'];
const sourceManifest=[...copiedFiles.map(file=>'src/app/(identity)/cuenta/'+file),'src/lib/identity-return-path.mjs'].map(file=>({path:file,sha256:hash(readFileSync(path.join(root,file)))}));
if(process.env.CI){assert.equal(trackedClean,true,'CI must verify a clean committed checkout');assert.equal(process.env.GITHUB_SHA,gitHead,'CI must verify its exact declared commit');execFileSync('git',['ls-files','--error-unmatch',harnessPath,...sourceManifest.map(source=>source.path)],{cwd:root,windowsHide:true,stdio:'ignore'});}
const fixture=mkdtempSync(path.join(vercelRoot,'office-review-ui-')),app=path.join(fixture,'app'),account=path.join(app,'(identity)','cuenta');
mkdirSync(account,{recursive:true});mkdirSync(path.join(fixture,'lib'));
for(const file of copiedFiles)copyFileSync(path.join(root,'src/app/(identity)/cuenta',file),path.join(account,file));
copyFileSync(path.join(root,'src/lib/identity-return-path.mjs'),path.join(fixture,'lib/identity-return-path.mjs'));
for(const source of sourceManifest){const copied=source.path.startsWith('src/app/')?path.join(account,path.basename(source.path)):path.join(fixture,'lib',path.basename(source.path));source.copiedSha256=hash(readFileSync(copied));assert.equal(source.copiedSha256,source.sha256,'The owned fixture must use the exact declared source');}
writeFileSync(path.join(fixture,'package.json'),JSON.stringify({name:'synthetic-office-review-ui',private:true}));
writeFileSync(path.join(fixture,'next.config.mjs'),`export default {devIndicators:false,turbopack:{root:${JSON.stringify(root)}}};`);
writeFileSync(path.join(app,'layout.js'),`export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:12,background:'#081c2d',color:'#edf4fa',fontFamily:'Arial,sans-serif'}}>{children}</body></html>}`);
const initial={scope:'a'.repeat(64),projectId:'project-office-a'},connectionId='connection-'+'x'.repeat(115),invitationIds=['a','b','c','d'].map(value=>'office_invite_'+value.repeat(32));
writeFileSync(path.join(app,'page.js'),`'use client';
import {Suspense,useCallback,useEffect,useState} from 'react';import {useSearchParams} from 'next/navigation';
import {OfficeReviewPanel,OfficeReviewAdminPanel} from './(identity)/cuenta/office-review-panel';
import {browserRecoveryJournal} from './(identity)/cuenta/workspace-recovery-journal.mjs';
import styles from './(identity)/cuenta/workspace.module.css';
function Fixture(){const params=useSearchParams(),[context,setContext]=useState(${JSON.stringify(initial)}),token=useCallback(async()=> 'synthetic-office-token-never-sent-to-provider',[]);useEffect(()=>{window.__officeSetContext=setContext;window.__officeReferences=()=>browserRecoveryJournal.list(context.scope);},[context]);return <main className={styles.workspace} style={{maxWidth:1000,margin:'0 auto'}}>{params.get('panel')==='admin'?<OfficeReviewAdminPanel scope={context.scope} projectId={context.projectId} getSessionToken={token}/>:<OfficeReviewPanel scope={context.scope} projectId={context.projectId} getSessionToken={token}/>}</main>}
export default function Page(){return <Suspense fallback={<p>Cargando ensayo sintético</p>}><Fixture/></Suspense>}`);
const generatedSources=['package.json','next.config.mjs','app/layout.js','app/page.js'].map(file=>({path:file,sha256:hash(readFileSync(path.join(fixture,file)))}));
const storedConnection=()=>({version:1,connectionRef:'office_connection_'+'b'.repeat(64),wabaRef:'office_waba_'+'c'.repeat(64),phoneNumberRef:'office_phone_'+'d'.repeat(64),connectionStatus:'CONNECTED',enabled:true,mode:'COMPANY',channelRevision:2,assignmentRevision:3,observedAt:'2026-10-10T15:00:00.000Z',evidenceOrigin:'STORED_AUTHORIZED_CONNECTION'});
const projectName=ref=>'Obra sintética '+ref.scope[0]+' / '+ref.projectId;
const invitationEmail=(ref,index)=>ref.scope[0]+'-'+ref.projectId+'-'+['accepted-a','accepted-b','pending','already-shared'][index]+'@fixture.invalid';
const reviewSnapshot=(ref=initial,connection=true)=>{
 const value={...ref,projectName:projectName(ref),readOnly:true,expiresAt:'2027-01-10T18:00:00.000Z',connection:connection?storedConnection():null,canObserveConfiguration:connection,items:[{id:'customer_webhook_'+'e'.repeat(64),receivedAt:'2026-10-10T14:00:00.000Z',kind:'GREETING',signatureVerified:true,processingState:'PROCESSED',replyState:'STATUS_OBSERVED',deliveryStatus:'delivered'}],canSend:false,canManage:false};
 return officeReviewSnapshot(value,ref);
};
const adminSnapshot=(ref=initial,shared=new Set([invitationIds[3]]))=>{
 const value={...ref,canManage:true,channels:[{id:connectionId}],invitations:invitationIds.map((id,index)=>({id,email:invitationEmail(ref,index),state:index===2?'INVITATION_UNCONFIRMED':'SENT',expiresAt:'2027-01-10T18:00:00.000Z',connectionId,operationId:'11111111-1111-4111-8111-111111111111',canShareConnection:index!==2,connectionShared:shared.has(id)})),candidates:[{id:'customer_webhook_'+'e'.repeat(64),receivedAt:'2026-10-10T14:00:00.000Z',processingState:'PROCESSED'}],truncated:false,candidatesLimited:false};
 return officeAdminSnapshot(value,ref);
};
const recorded=command=>({scope:command.scope,projectId:command.projectId,operationId:command.operationId,action:command.action,state:'RECORDED',saved:true,definitive:true,receiptId:'office_review_'+'f'.repeat(64),replayed:false,invitationId:command.payload.invitationId});
reviewSnapshot();reviewSnapshot(initial,false);adminSnapshot();

const port=await new Promise((resolve,reject)=>{const probe=createServer();probe.once('error',reject);probe.listen(0,'127.0.0.1',()=>{const candidate=probe.address().port;probe.close(error=>error?reject(error):resolve(candidate));});});
const origin='http://127.0.0.1:'+port,serverEnv={NEXT_TELEMETRY_DISABLED:'1'};
for(const key of ['SystemRoot','WINDIR','TEMP','TMP','PATH','PATHEXT','COMSPEC','USERPROFILE','LOCALAPPDATA','APPDATA'])if(process.env[key])serverEnv[key]=process.env[key];
const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',fixture,'--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:fixture,env:serverEnv,windowsHide:true,stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
let serverLog='',browser,failure;const checks=[],errors=[],unexpectedRequests=[],inlineResourceRequests=[],cleanup={browserClosed:false,serverStopped:false,fixtureRemoved:false};
for(const stream of [server.stdout,server.stderr])stream.on('data',chunk=>{serverLog=(serverLog+chunk.toString()).slice(-12000);});
const serverClosed=new Promise(resolve=>server.once('close',resolve));
const reviewerArea='section[aria-labelledby="office-review-title"]',adminArea='section[aria-labelledby="office-review-admin-title"]';
const shareForm=email=>'form[aria-label="Compartir configuración con '+email+'"]';
function stopOwned(pid){
 assert.ok(Number.isInteger(pid)&&pid>0,'Only an owned child process PID may be stopped');
 if(process.platform!=='win32'){try{process.kill(-pid,'SIGTERM');}catch(error){if(error.code!=='ESRCH')throw error;}return;}
 try{execFileSync('taskkill.exe',['/PID',String(pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});}
 catch(error){try{process.kill(pid,0);}catch(probe){if(probe.code==='ESRCH')return;throw probe;}throw error;}
}
async function waitText(page,text){await page.waitForFunction(value=>document.body.innerText.includes(value),{timeout:20000},text);}
async function click(page,label,area='body'){
 await page.waitForFunction((text,selector)=>[...document.querySelectorAll(selector+' button')].some(button=>button.textContent.trim()===text&&!button.disabled),{timeout:20000},label,area);
 const handle=await page.evaluateHandle((text,selector)=>[...document.querySelectorAll(selector+' button')].find(button=>button.textContent.trim()===text&&!button.disabled),label,area);
 await handle.asElement().click();await handle.dispose();
}
async function clickInInvitation(page,email,label){
 const row=await page.evaluateHandle(value=>[...document.querySelectorAll('section[aria-labelledby="office-review-admin-title"] li')].find(node=>node.querySelector('span')?.textContent.includes(value)),email);
 assert.ok(row.asElement(),'Missing invitation '+email);const buttons=await row.asElement().$$('button');let matched=false;
 for(const button of buttons)if(await button.evaluate((node,text)=>node.textContent.trim()===text&&!node.disabled,label)){await button.click();matched=true;break;}
 await row.dispose();assert.equal(matched,true,'Missing explicit invitation action '+label);
}
async function confirmShare(page,email){const form=shareForm(email);await page.click(form+' input[type=checkbox]');await page.waitForFunction(selector=>!document.querySelector(selector+' button[type=submit]').disabled,{timeout:10000},form);await page.click(form+' button[type=submit]');}
async function refs(page,count){
 const entries=await page.evaluate(()=>window.__officeReferences());assert.equal(entries.length,count);
 for(const entry of entries)assert.deepEqual(Object.keys(entry).sort(),['version','resource','scope','projectId','operationId','createdAt','action'].sort());
 assert.doesNotMatch(JSON.stringify(entries),/@fixture|connection-|confirmReadOnlyConfiguration|synthetic-office-token|office_invite/);
 const storage=await page.evaluate(()=>JSON.stringify([...Object.values(localStorage),...Object.values(sessionStorage)]));assert.doesNotMatch(storage,/@fixture|connection-|confirmReadOnlyConfiguration|synthetic-office-token|office_invite/);
 return entries;
}
async function geometry(page,area){
 const value=await page.evaluate(selector=>({overflow:document.documentElement.scrollWidth>innerWidth,small:[...document.querySelectorAll(selector+' button,'+selector+' label:has(input)')].filter(node=>node.getClientRects().length&&node.getBoundingClientRect().height<44).map(node=>node.textContent),unbounded:[...document.querySelectorAll(selector+' form,'+selector+' dl')].filter(node=>node.getClientRects().length&&node.getBoundingClientRect().right>innerWidth+1).map(node=>node.tagName)}),area);
 assert.equal(value.overflow,false,'Actual office CSS must prevent horizontal overflow');assert.deepEqual(value.small,[]);assert.deepEqual(value.unbounded,[]);
}
async function screenshot(page,width,mode){const target=path.join(evidence,`${width}-${mode}.png`);await page.screenshot({path:target,fullPage:true});return {path:path.basename(target),sha256:hash(readFileSync(target))};}

async function scenario(width,mode){
 const context=await browser.createBrowserContext(),page=await context.newPage(),posts=[],reads=[],pageErrors=[],shared=new Set([invitationIds[3]]),actor=mode.startsWith('admin')?'admin':'reviewer',area=actor==='admin'?adminArea:reviewerArea;
 let responseMode='valid',pendingCommand=null,recordPending=false,held=null;const late=mode.includes('-late-');
 await page.setViewport({width,height:1000});page.on('pageerror',error=>pageErrors.push(error.message));await page.setRequestInterception(true);
 const respond=(request,value,status=200,contentType='application/json')=>request.respond({status,contentType,body:contentType==='application/json'?JSON.stringify(value):String(value)}).catch(()=>{});
 page.on('request',request=>{void(async()=>{
  const url=new URL(request.url()),resourceType=request.resourceType(),inlineMime=/^data:(image\/(?:svg\+xml|png))(?:[;,])/i.exec(request.url())?.[1]?.toLowerCase();
  if(url.protocol==='data:'&&resourceType==='image'&&request.method()==='GET'&&inlineMime){inlineResourceRequests.push({width,mode,protocol:url.protocol,resourceType,mime:inlineMime});await request.continue();return;}
  if(url.origin!==origin){unexpectedRequests.push({width,mode,origin:url.origin,protocol:url.protocol,resourceType,method:request.method()});await request.abort();return;}
  if(!url.pathname.startsWith('/api/')){assert.equal(request.method(),'GET','The harness may only load local UI assets');await request.continue();return;}
  assert.equal(url.pathname,'/api/identity/office-review','Only the local synthetic office endpoint is allowed');
  if(request.method()==='POST'){
   assert.equal(actor,'admin','The reviewer must never write');const command=JSON.parse(request.postData());posts.push(command);
   assert.deepEqual(Object.keys(command).sort(),['scope','projectId','operationId','action','payload'].sort());assert.equal(command.scope,initial.scope);assert.equal(command.projectId,initial.projectId);assert.match(command.operationId,/^[a-f0-9-]{36}$/);
   assert.ok(['SHARE_CONNECTION','WITHDRAW_CONNECTION'].includes(command.action),'The harness does not invite, send or revoke');
   if(command.action==='SHARE_CONNECTION'){assert.deepEqual(Object.keys(command.payload).sort(),['invitationId','connectionId','confirmReadOnlyConfiguration'].sort());assert.equal(command.payload.invitationId,invitationIds[0]);assert.equal(command.payload.connectionId,connectionId);assert.equal(command.payload.confirmReadOnlyConfiguration,true);}
   else{assert.deepEqual(Object.keys(command.payload).sort(),['invitationId','reason'].sort());assert.equal(command.payload.invitationId,invitationIds[0]);assert.equal(command.payload.reason,'Retiro explícito de la configuración compartida');}
   pendingCommand=command;
   if(mode==='admin-denied-write'){await respond(request,{code:'WORKSPACE_PROJECT_UNAVAILABLE'},403);return;}
   if(mode==='admin-pending'){await respond(request,{code:'OFFICE_REVIEW_OPERATION_UNCONFIRMED'},503);return;}
   if(command.action==='SHARE_CONNECTION')shared.add(command.payload.invitationId);else shared.delete(command.payload.invitationId);
   await respond(request,recorded(command));return;
  }
  assert.equal(request.method(),'GET');const ref={scope:url.searchParams.get('scope'),projectId:url.searchParams.get('projectId')};reads.push(Object.fromEntries(url.searchParams));
  if(url.searchParams.has('operationId')){
   assert.ok(pendingCommand);assert.equal(url.searchParams.get('operationId'),pendingCommand.operationId);
   if(recordPending){shared.add(invitationIds[0]);await respond(request,{...recorded(pendingCommand),replayed:true});}
   else await respond(request,{...ref,operationId:pendingCommand.operationId,action:null,state:'NOT_OBSERVED',saved:false,definitive:false});
   return;
  }
  assert.equal(url.searchParams.get('view'),actor==='reviewer'?'review':null);
  if(late&&!held&&ref.scope===initial.scope&&ref.projectId===initial.projectId){held={request,ref};return;}
  if(responseMode==='403'){await respond(request,'<html>private-denial-sentinel</html>',403,'text/html');return;}
  if(responseMode==='401'){await respond(request,{code:'SESSION_REQUIRED',message:'private-denial-sentinel'},401);return;}
  if(responseMode==='malformed'){
   await respond(request,actor==='reviewer'?{...reviewSnapshot(ref),connection:{...storedConnection(),displayPhoneNumber:'+5491112345678'}}:{...adminSnapshot(ref,shared),invitations:[{...adminSnapshot(ref,shared).invitations[0],canShareConnection:'yes'}]});return;
  }
  await respond(request,actor==='reviewer'?reviewSnapshot(ref,responseMode!=='null'):adminSnapshot(ref,shared));
 })().catch(error=>{errors.push({width,mode,error:error.message});void request.abort().catch(()=>{});});});
 try{
  await page.goto(origin+'/?panel='+actor,{waitUntil:'domcontentloaded',timeout:60000});
  if(late){
   await page.waitForFunction(()=>typeof window.__officeSetContext==='function');const deadline=Date.now()+15000;while(!held&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));assert.ok(held,'The old scoped request must be held');
   const changed={...initial,...(mode.endsWith('-scope')?{scope:'b'.repeat(64)}:{projectId:'project-office-b'})};
   await page.evaluate(value=>window.__officeSetContext(value),changed);await waitText(page,actor==='reviewer'?projectName(changed):invitationEmail(changed,0));
   const received=page.waitForResponse(response=>response.request()===held.request,{timeout:15000});await respond(held.request,actor==='reviewer'?reviewSnapshot(initial):adminSnapshot(initial,shared));await received;
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const text=await page.$eval(area,node=>node.innerText);
   assert.ok(text.includes(actor==='reviewer'?projectName(changed):invitationEmail(changed,0)));assert.ok(!text.includes(actor==='reviewer'?projectName(initial):invitationEmail(initial,0)));assert.equal(posts.length,0);
   await geometry(page,area);checks.push({width,mode,lateScopedResponseHidden:true,posts:0,reads:reads.length,screenshot:await screenshot(page,width,mode)});
  }else if(actor==='reviewer'){
   await waitText(page,projectName(initial));assert.equal(posts.length,0);let text=await page.$eval(area,node=>node.innerText);
   assert.ok(text.includes('Configuración guardada de la conexión'));assert.ok(text.includes('Estado guardado'));assert.ok(text.includes('no consulta el estado actual en Meta'));assert.ok(text.includes('Entregado según Meta'));assert.ok(text.includes('no acredita una prueba de cliente autenticado'));
   assert.equal(await page.$(area+' input,'+area+' select,'+area+' textarea,'+area+' a'),null);assert.deepEqual(await page.$$eval(area+' button',nodes=>nodes.map(node=>node.textContent.trim())),['Actualizar acceso y eventos']);
   assert.doesNotMatch(text,/\+5491112345678|private-denial-sentinel|synthetic-office-token/);await geometry(page,area);
   const presentScreenshot=await screenshot(page,width,mode+'-configuration');responseMode='null';await click(page,'Actualizar acceso y eventos',area);await waitText(page,'No hay una configuración compartida con esta invitación.');assert.equal(await page.$(area+' dl'),null);assert.ok((await page.$eval(area,node=>node.innerText)).includes('Saludos compartidos'));await geometry(page,area);
   for(const denial of ['403','401','malformed']){responseMode=denial;await click(page,'Actualizar acceso y eventos',area);await waitText(page,denial==='403'?'Este acceso ya no está disponible':denial==='401'?'Tu sesión venció':'La conexión compartida no cumple');text=await page.$eval(area,node=>node.innerText);assert.ok(!text.includes(projectName(initial)));assert.equal(await page.$('#office-connection-title'),null);assert.equal(await page.$(area+' li'),null);assert.doesNotMatch(text,/private-denial-sentinel|\+5491112345678/);await geometry(page,area);}
   assert.equal(posts.length,0);checks.push({width,mode,storedConfigurationAndNull:true,guardedDenials:['403-html','401-json','malformed-configuration'],noSendOrIdentityControls:true,posts:0,reads:reads.length,screenshot:presentScreenshot});
  }else{
   await waitText(page,invitationEmail(initial,0));const emailA=invitationEmail(initial,0),emailB=invitationEmail(initial,1),formA=shareForm(emailA),formB=shareForm(emailB);
   assert.equal(posts.length,0);assert.equal(await page.$(shareForm(invitationEmail(initial,2))),null);assert.equal(await page.$eval(formA+' input',node=>node.checked),false);assert.equal(await page.$eval(formA+' button',node=>node.disabled),true);assert.equal(await page.$eval(formB+' button',node=>node.disabled),true);
   await refs(page,0);await page.click(formB+' input');assert.equal(await page.$eval(formB+' button',node=>node.disabled),false);assert.equal(await page.$eval(formA+' button',node=>node.disabled),true);await page.click(formB+' input');
   await geometry(page,area);await confirmShare(page,emailA);
   if(mode==='admin-pending'||mode==='admin-denied-write'){
    await waitText(page,mode==='admin-pending'?'No se pudo confirmar. Conservamos la referencia':'Este acceso ya no está disponible');await waitText(page,'Hay una acción pendiente.');assert.equal(posts.length,1);const references=await refs(page,1);assert.equal(references[0].operationId,posts[0].operationId);assert.equal(await page.$(formA),null);assert.equal(await page.$(area+' input[type=checkbox]:checked'),null);
    if(mode==='admin-pending'){
     await click(page,'Comprobar recibo e invitación',area);await waitText(page,'Todavía no se observa un recibo.');assert.equal(posts.length,1);await refs(page,1);assert.equal(await page.$(formA),null);
     await page.reload({waitUntil:'domcontentloaded',timeout:60000});await waitText(page,'Hay una acción pendiente.');assert.equal(posts.length,1);await refs(page,1);
    }
    recordPending=true;await click(page,'Comprobar recibo e invitación',area);await waitText(page,'Recibo comprobado sin repetir la acción.');await waitText(page,invitationEmail(initial,0));await refs(page,0);assert.equal(posts.length,1);assert.equal(await page.$eval(formA+' input',node=>node.checked),false);assert.equal(await page.$eval(formA+' button',node=>node.disabled),true);
    assert.ok(reads.filter(row=>row.operationId===posts[0].operationId).length>=1);await geometry(page,area);checks.push({width,mode,explicitShare:posts[0],recoveryOnlyGets:true,statusReads:reads.filter(row=>row.operationId).length,denialClearedSelection:mode==='admin-denied-write',pendingReferenceWithoutPrivatePayload:true,screenshot:await screenshot(page,width,mode)});
   }else{
    await waitText(page,'Acción confirmada con recibo.');assert.equal(posts.length,1);assert.equal(posts[0].action,'SHARE_CONNECTION');await refs(page,0);assert.equal(await page.$eval(formA+' input',node=>node.checked),false);assert.equal(await page.$eval(formB+' input',node=>node.checked),false);assert.equal(await page.$eval(formA+' button',node=>node.textContent),'Volver a compartir configuración');assert.equal(await page.$eval(formA+' button',node=>node.disabled),true);
    await clickInInvitation(page,emailA,'Retirar configuración compartida');await waitText(page,'Acción confirmada con recibo.');await page.waitForFunction(selector=>document.querySelector(selector+' button')?.textContent==='Compartir configuración',{timeout:20000},formA);assert.equal(posts.length,2);assert.equal(posts[1].action,'WITHDRAW_CONNECTION');assert.notEqual(posts[0].operationId,posts[1].operationId);await refs(page,0);
    await page.click(formA+' input');assert.equal(await page.$eval(formA+' button',node=>node.disabled),false);responseMode='403';await click(page,'Actualizar accesos',area);await waitText(page,'Este acceso ya no está disponible');assert.equal(await page.$(area+' li'),null);assert.equal(await page.$(area+' input[type=checkbox]:checked'),null);responseMode='valid';await click(page,'Actualizar accesos',area);await waitText(page,emailA);assert.equal(await page.$eval(formA+' input',node=>node.checked),false);assert.equal(await page.$eval(formA+' button',node=>node.disabled),true);
    responseMode='malformed';await click(page,'Actualizar accesos',area);await waitText(page,'No se pudo comprobar el alcance de la invitación');assert.equal(await page.$(area+' li'),null);responseMode='valid';await click(page,'Actualizar accesos',area);await waitText(page,emailA);assert.equal(await page.$eval(formA+' input',node=>node.checked),false);assert.equal(posts.length,2);await geometry(page,area);
    checks.push({width,mode,explicitShare:posts[0],explicitWithdraw:posts[1],perInvitationCheckboxes:true,pendingInvitationNotEligible:true,existingInvitationsNeverAutoShared:true,readbackClearsConfirmation:true,denialAndMalformedHideInvitations:true,reads:reads.length,screenshot:await screenshot(page,width,mode)});
   }
  }
  assert.deepEqual(pageErrors,[]);assert.ok(reads.length);assert.ok(posts.every(command=>['SHARE_CONNECTION','WITHDRAW_CONNECTION'].includes(command.action)));
 }finally{await context.close();}
}

try{
 const deadline=Date.now()+60000;let ready=false;while(Date.now()<deadline){if(server.exitCode!==null)throw new Error('Owned office fixture exited');try{if((await fetch(origin)).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,250));}assert.ok(ready,'Owned office fixture did not start');
 browser=await puppeteer.launch({headless:true,...(process.platform==='win32'?{channel:'chrome'}:{}),args:['--no-sandbox','--disable-setuid-sandbox']});
 for(const width of widths)for(const mode of selectedMode?[selectedMode]:modes)await scenario(width,mode);
 assert.deepEqual(errors,[]);assert.deepEqual(unexpectedRequests,[]);assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim(),gitHead,'HEAD changed during verification');
 assert.equal(hash(readFileSync(new URL(import.meta.url))),harnessSha256,'Harness changed during verification');
 for(const source of sourceManifest)assert.equal(hash(readFileSync(path.join(root,source.path))),source.sha256,'Source changed during verification: '+source.path);
}catch(error){failure=error;}
finally{
 try{if(browser){if(process.platform==='win32'){const ownedBrowserPid=browser.process().pid;browser.disconnect();stopOwned(ownedBrowserPid);}else await browser.close();}cleanup.browserClosed=true;}catch(error){failure??=error;}
 try{if(server.exitCode===null){stopOwned(server.pid);await Promise.race([serverClosed,new Promise(resolve=>setTimeout(resolve,10000))]);}cleanup.serverStopped=server.exitCode!==null||server.signalCode!==null;}catch(error){failure??=error;}
 try{const resolvedFixture=realpathSync(fixture);assert.ok(resolvedFixture.startsWith(realpathSync(vercelRoot)+path.sep)&&path.basename(resolvedFixture).startsWith('office-review-ui-'),'Cleanup must remain inside the exact owned fixture');rmSync(resolvedFixture,{recursive:true,force:true});cleanup.fixtureRemoved=!existsSync(resolvedFixture);}catch(error){failure??=error;}
}
if(!Object.values(cleanup).every(Boolean))failure??=new Error('Owned fixture cleanup must complete');
const report={schemaVersion:1,kind:'SYNTHETIC_OFFICE_REVIEW_UI',status:failure?'FAIL':'PASS',checkedAt:new Date().toISOString(),gitHead,trackedClean,harnessPath,harnessSha256,ciSourceVerified:Boolean(process.env.CI),sourceManifest,generatedSources,widths,selectedMode,checks,errors,unexpectedRequests,inlineResourceRequests,cleanup,limits:{syntheticFixtures:true,actualReactPanels:true,actualCss:true,actualRequestLifecycleAndRecoveryJournal:true,localInterceptedPostsOnly:true,inlineImagesAreNonNetworkResources:true,liveBusinessWrites:0,providerCalls:0,productionCalls:0,realLoginTested:false,metaFreshStateVerified:false,realMessageDeliveryVerified:false,humanAcceptance:false},...(failure?{failure:failure.message,serverLog}:{})};
writeFileSync(path.join(evidence,'ui.json'),JSON.stringify(report,null,2));
if(failure)throw failure;
console.log(JSON.stringify({status:'PASS',checks:checks.length,widths,evidence,resultSha256:hash(readFileSync(path.join(evidence,'ui.json'))),cleanup}));
