import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,copyFileSync,writeFileSync,rmSync,readdirSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import puppeteer from 'puppeteer';
import {createLocalJWKSet,generateKeyPair,exportJWK,SignJWT} from 'jose';
import {createBootstrapProfileVerifier} from '../src/lib/company-onboarding-identity.mjs';
import {BOOTSTRAP_PROFILE_AUDIENCE} from '../src/lib/company-onboarding-policy.mjs';
import {IDENTITY_ISSUER,IDENTITY_ORIGIN} from '../src/lib/production-identity-config.mjs';
assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV);
assert.ok([undefined,'onboarding-recovery'].includes(process.env.COMPANY_ONBOARDING_UI_SUITE));
const root=realpathSync(process.cwd()),parent=path.join(root,'.vercel'),output=path.join(parent,'company-onboarding-evidence');mkdirSync(output,{recursive:true});
const dir=mkdtempSync(path.join(root,'.vercel/company-bootstrap-ui-')),app=path.join(dir,'src/app'),components=path.join(app,'(identity)/cuenta');mkdirSync(components,{recursive:true});
mkdirSync(path.join(dir,'src/lib'),{recursive:true});copyFileSync(path.join(root,'src/lib/worker-channel-consent-policy.mjs'),path.join(dir,'src/lib/worker-channel-consent-policy.mjs'));
copyFileSync(path.join(root,'src/lib/geo.js'),path.join(dir,'src/lib/geo.js'));
mkdirSync(path.join(dir,'src/lib/whatsapp'),{recursive:true});copyFileSync(path.join(root,'src/lib/whatsapp/tenant-workspace-policy.js'),path.join(dir,'src/lib/whatsapp/tenant-workspace-policy.js'));
for(const file of readdirSync(path.join(root,'src/app/(identity)/cuenta')).filter(name=>/\.(js|mjs|css)$/.test(name)))copyFileSync(path.join(root,'src/app/(identity)/cuenta',file),path.join(components,file));
writeFileSync(path.join(dir,'package.json'),JSON.stringify({name:'synthetic-company-onboarding-ui',private:true}));
writeFileSync(path.join(dir,'next.config.mjs'),`export default {devIndicators:false,turbopack:{root:${JSON.stringify(root)}}};`);
writeFileSync(path.join(app,'layout.js'),`export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:12,background:'#081c2d',fontFamily:'Arial,sans-serif'}}>{children}</body></html>}`);
writeFileSync(path.join(app,'page.js'),`'use client';import {useState} from 'react';import {CompanyBootstrapPanel} from './(identity)/cuenta/company-bootstrap-panel';import {AccountWorkspace} from './(identity)/cuenta/workspace-client';const session=async()=>{if(window.__sessionHung)return new Promise(resolve=>{window.__releaseSession=()=>resolve('synthetic-session-token');});return 'synthetic-session-token';};const profile=async()=>{window.__profileReads=(window.__profileReads||0)+1;if(window.__profileUnavailable)throw new Error('fixture');if(window.__profileHung)return new Promise(resolve=>{window.__releaseProfile=()=>resolve('synthetic-profile-token');});return window.__profileTokens?.[Math.min(window.__profileReads-1,1)]||'synthetic-profile-token-'+window.__profileReads;};export default function Page(){const [visible,setVisible]=useState(true),[organization,setOrganization]=useState('org_BootstrapA');if(typeof window!=='undefined'){window.__unmountBootstrap=()=>setVisible(false);window.__changeContext=()=>{window.__sessionHung=false;window.__profileHung=false;setOrganization('org_BootstrapB');};}return <main style={{maxWidth:1120,margin:'0 auto'}}>{visible?<CompanyBootstrapPanel key={organization} organizationId={organization} organizationName="" getSessionToken={session} getProfileToken={profile}><AccountWorkspace getSessionToken={session}/></CompanyBootstrapPanel>:<p>Componente desmontado en ensayo controlado</p>}</main>}`);
const origin='http://127.0.0.1:3110';
const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',dir,'--webpack','--hostname','127.0.0.1','--port','3110'],{env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
let log='';for(const stream of [server.stdout,server.stderr])stream.on('data',value=>{log=(log+value).slice(-16000);});
let browser;const checks=[],errors=[];
const click=async(page,label)=>{const handle=await page.evaluateHandle(text=>[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===text),label);assert.ok(handle.asElement(),'Missing button '+label);await handle.asElement().click();await handle.dispose();};
const wait=(page,text)=>page.waitForFunction(value=>document.body.innerText.includes(value),{timeout:20000},text);
async function scenario(mode,width=390){
 const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1000});
 const epoch=Math.floor(Date.now()/1000);let profileClock=epoch;
 const sessionIdentity={authenticated:true,verification:'clerk-production-jwt',userId:'user_BootstrapA',organizationId:'org_BootstrapA',organizationRole:'org:admin'};
 let profileTokens=null,verifyProfile;
 if(mode==='expired-profile'){
  const pair=await generateKeyPair('RS256'),jwk={...await exportJWK(pair.publicKey),kid:'ui-local-disposable',alg:'RS256',use:'sig'};
  verifyProfile=createBootstrapProfileVerifier(createLocalJWKSet({keys:[jwk]}),{now:()=>new Date(profileClock*1000)});
  const token=iat=>new SignJWT({iss:IDENTITY_ISSUER,aud:BOOTSTRAP_PROFILE_AUDIENCE,sub:sessionIdentity.userId,jti:'ui-disposable-proof',iat,nbf:iat-1,exp:iat+60,azp:IDENTITY_ORIGIN,purpose:'new-constructor-profile',profile_version:1,email:'controlled@example.test',email_verified:true}).setProtectedHeader({alg:'RS256',typ:'JWT',kid:jwk.kid}).sign(pair.privateKey);
  profileTokens=await Promise.all([token(epoch),token(epoch+70)]);
 }
 await page.evaluateOnNewDocument(({tokens,initialHung})=>{
  if(tokens)window.__profileTokens=tokens;window.__sessionHung=initialHung;
  const nativeTimeout=window.setTimeout;window.setTimeout=(fn,ms,...args)=>nativeTimeout(fn,window.__acceleratedDeadlines&&(ms===15000||ms===20000)?100:ms,...args);
  window.__acceleratedDeadlines=initialHung;
  const nativeUuid=crypto.randomUUID.bind(crypto);window.__issuedIds=[];crypto.randomUUID=()=>{const id=nativeUuid();window.__issuedIds.push(id);return id;};
 },{tokens:profileTokens,initialHung:mode==='initial-sdk-hung'});
 page.on('pageerror',error=>errors.push({mode,width,message:error.message}));await page.setRequestInterception(true);
 let created=false,result=null,tasks=[],taskReceipts=new Map(),expectedOrganization='org_BootstrapA';const posts=[],postBodies=[],taskPosts=[],external=[],recoveryIds=[];const scope='c'.repeat(64);
 page.on('request',async request=>{
  try{
   const url=new URL(request.url());
   if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();external.push(url.hostname);return request.abort();}
   if(!url.pathname.startsWith('/api/identity/'))return request.continue();
   assert.equal(request.headers().authorization,'Bearer synthetic-session-token');
   let body,status=200;
   if(url.pathname==='/api/identity/company-onboarding'){
    assert.equal(request.headers().authorization,'Bearer synthetic-session-token');
    if(request.method()==='GET'){
     assert.equal(url.searchParams.get('expectedClerkOrganizationId'),expectedOrganization);
     if(url.searchParams.has('operationId')){recoveryIds.push(url.searchParams.get('operationId'));if(posts.length)assert.equal(url.searchParams.get('operationId'),posts[0].operationId);body=created?{...result,replayed:true}:{state:'NOT_CREATED',canCreate:mode!=='retry-not-authorized'};}
     else if(created&&mode==='reload-denied'){status=403;body={code:'WORKSPACE_MEMBERSHIP_REQUIRED'};}
     else body=created?(['reload-other-actor','reload-missing-receipt'].includes(mode)?{state:'ALREADY_CONFIGURED',canCreate:false,organizationId:'company-test'}:{...result,replayed:true}):{state:'NOT_CREATED',canCreate:true};
    }else{
     const command=JSON.parse(request.postData());posts.push(command);postBodies.push(request.postData());assert.equal(command.expectedClerkOrganizationId,'org_BootstrapA');assert.equal(command.confirmNewCompany,true);assert.ok(!JSON.stringify(command).includes('token'));
     const proof=request.headers()['x-obrasaas-bootstrap-profile'];if(verifyProfile)await verifyProfile(proof,sessionIdentity);else assert.match(proof,/^synthetic-profile-token-\d+$/);
     if(mode==='no-arrival'&&posts.length===1)return request.abort('failed');
     if(['rollback','expired-profile','profile-retry-unavailable','retry-not-authorized','reload-not-committed'].includes(mode)&&posts.length===1){status=503;body={code:'COMPANY_CREATION_UNCONFIRMED'};}
     else if(mode==='denied'){status=403;body={code:'COMPANY_VERIFIED_PROFILE_REQUIRED'};}
     else{
      created=true;tasks=command.initialTasks.map((task,index)=>({id:'task-initial-'+index,title:task.title,startsOn:task.startsOn||null,endsOn:task.endsOn||null,progress:0,status:'BACKLOG',revision:'2026-10-01T12:00:00.123456'}));
      result={state:'CREATED',created:true,receiptId:'company_bootstrap_'+'a'.repeat(64),organizationId:'company-test',projectId:'project-test',companyName:command.companyName,projectName:command.project.name,initialTaskCount:tasks.length,whatsAppConnected:false};body=result;
      if(mode==='uncertain'||mode.startsWith('reload-')){status=503;body={code:'COMPANY_CREATION_UNCONFIRMED'};}
     }
    }
   }else if(url.pathname==='/api/identity/workspace'){
    assert.equal(created,true);body=!url.search?{scope,organizationName:result.companyName,roleLabel:'Administrador',role:'ADMIN',canPlanSchedule:true,canManageIntegrations:false,projects:[{id:'project-test',name:result.projectName}],projectsTruncated:false}:
      {scope,project:{id:'project-test',name:result.projectName},roleLabel:'Administrador',canPlanSchedule:true,tasks,totalTasks:tasks.length,nextCursor:null};
   }else if(url.pathname==='/api/identity/task-creation'){
    assert.equal(created,true);const command=JSON.parse(request.postData());taskPosts.push(command);assert.equal(command.scope,scope);assert.equal(command.projectId,'project-test');
    if(!taskReceipts.has(command.operationId)){const task={id:'new-task-'+tasks.length,title:command.title,startsOn:command.startsOn||null,endsOn:command.endsOn||null,progress:0,status:'BACKLOG',revision:'2026-10-01T13:00:00.123456'};tasks.push(task);taskReceipts.set(command.operationId,{scope,created:true,receiptId:'new-task-receipt',task});}
    body=taskReceipts.get(command.operationId);
   }else throw new Error('Unexpected API '+url.pathname);
   await request.respond({status,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});
  }catch(error){errors.push({mode,width,message:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}
 });
 await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});
 if(mode==='initial-sdk-hung'){
  await wait(page,'Volver a comprobar');assert.equal(posts.length,0);await page.evaluate(()=>{window.__releaseSession();window.__sessionHung=false;window.__acceleratedDeadlines=false;});
  await click(page,'Volver a comprobar');await wait(page,'Crear empresa y primera obra');assert.equal(posts.length,0);assert.equal(created,false);checks.push('initial-sdk-deadline-explicit-read-recovery-no-post');await context.close();return;
 }
 await wait(page,'Crear empresa y primera obra');
 await page.type('input[autocomplete="organization"]','Constructora de ensayo');await page.type('input[placeholder*="Edificio"]','Obra inicial de ensayo');
 if(mode==='planned'){
  await click(page,'Agregar tarea');await page.type('input[maxlength="160"]','Replanteo de la obra');
  await page.$$eval('input[type="date"]',inputs=>{for(const [index,input]of inputs.entries()){Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,index===0?'2026-10-02':'2026-10-06');input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}});
 }
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 if(mode==='empty'||mode==='planned')await page.screenshot({path:path.join(output,`company-${mode}-${width}.png`),fullPage:true});
 if(['session-hung','late-session-context','late-session-unmount'].includes(mode))await page.evaluate(accelerated=>{window.__sessionHung=true;window.__acceleratedDeadlines=accelerated;},mode==='session-hung');
 if(['profile-hung','late-profile-unmount'].includes(mode))await page.evaluate(accelerated=>{window.__profileHung=true;window.__acceleratedDeadlines=accelerated;},mode==='profile-hung');
 await page.click('input[type="checkbox"]');assert.equal(await page.$eval('input[type="checkbox"]',input=>input.checked),true);const issuedBefore=await page.evaluate(()=>window.__issuedIds.length);await click(page,'Crear empresa y primera obra');
 if(mode.startsWith('late-')){
  const profile=mode==='late-profile-unmount';await page.waitForFunction(kind=>typeof window[kind]==='function',{},profile?'__releaseProfile':'__releaseSession');
  assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('El alta no se envió'));
  if(mode==='late-session-context'){expectedOrganization='org_BootstrapB';await page.evaluate(()=>window.__changeContext());await wait(page,'Crear empresa y primera obra');}
  else{await page.evaluate(()=>window.__unmountBootstrap());await wait(page,'Componente desmontado');}
  await page.evaluate(kind=>window[kind](),profile?'__releaseProfile':'__releaseSession');await new Promise(resolve=>setTimeout(resolve,200));
  assert.equal(posts.length,0);assert.equal(created,false);assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('El espacio está creado'));
  if(mode==='late-session-context')assert.equal(await page.$eval('input[autocomplete="organization"]',input=>input.value),'');
  checks.push(`${mode}-late-sdk-resolution-never-posts`);await context.close();return;
 }
 if(['session-hung','profile-hung'].includes(mode)){
  await wait(page,'El alta no se envió');assert.equal(posts.length,0);assert.equal(await page.$eval('input[autocomplete="organization"]',input=>input.value),'Constructora de ensayo');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));if(mode==='profile-hung')await page.screenshot({path:path.join(output,`company-sdk-recovery-${width}.png`),fullPage:true});
  await page.evaluate(kind=>{window[kind]();window.__sessionHung=false;window.__profileHung=false;window.__acceleratedDeadlines=false;},mode==='session-hung'?'__releaseSession':'__releaseProfile');
  await new Promise(resolve=>setTimeout(resolve,200));assert.equal(posts.length,0);
  await click(page,'Reenviar mismo intento');await wait(page,'El espacio está creado');assert.equal(posts.length,1);assert.equal(posts[0].operationId,await page.evaluate(index=>window.__issuedIds[index],issuedBefore));assert.equal(recoveryIds.length,0);checks.push(`${mode}-bounded-prefetch-preserves-draft-uuid-explicit-retry`);await context.close();return;
 }
 if(mode==='denied'){
  await wait(page,'No se pudo confirmar tu correo verificado');assert.equal(created,false);assert.equal(posts.length,1);assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('El espacio está creado'));assert.equal(await page.$eval('input[autocomplete="organization"]',input=>input.value),'Constructora de ensayo');
  assert.equal(await page.$$eval('button',buttons=>buttons.some(button=>button.textContent==='Reenviar mismo intento')),false);await click(page,'Comprobar creación');await wait(page,'No se reenvía automáticamente');assert.equal(posts.length,1);
  await click(page,'Reenviar mismo intento');await wait(page,'No se pudo confirmar tu correo verificado');assert.equal(posts.length,2);assert.equal(postBodies[0],postBodies[1]);assert.equal(created,false);checks.push('unverified-email-receipt-first-identical-retry-never-shows-company-created');await context.close();return;
 }
 if(mode.startsWith('reload-')){
  await wait(page,'No recibimos la confirmación');assert.equal(posts.length,1);const originalReceipt=result?.receiptId;await page.reload({waitUntil:'networkidle0'});
  if(mode==='reload-denied'){await wait(page,'Tu pertenencia a esta empresa no está habilitada');assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Recibo:'));assert.equal((await page.$$('form')).length,0);}
  else if(mode==='reload-not-committed'){await wait(page,'Crear empresa y primera obra');assert.equal(await page.$eval('input[autocomplete="organization"]',node=>node.value),'');assert.equal(await page.$eval('input[placeholder*="Edificio"]',node=>node.value),'');assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Recibo:'));assert.equal(created,false);}
  else if(['reload-other-actor','reload-missing-receipt'].includes(mode)){await wait(page,'Mis obras');assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Recibo: '+originalReceipt));}
  else {await wait(page,'Alta confirmada');await wait(page,'Mis obras');assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Entrar a mi obra'));await page.click('summary');await wait(page,'Recibo: '+originalReceipt);assert.equal(await page.evaluate(()=>window.__profileReads||0),0);}
  assert.equal(posts.length,1,'Reload performed another company POST');assert.equal(recoveryIds.length,0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(output,`company-${mode}-${width}.png`),fullPage:true});checks.push(`${mode}-company-receipt-readonly-after-reload-${width}`);await context.close();return;
 }
 if(mode==='uncertain'){await wait(page,'No recibimos la confirmación');assert.equal(posts.length,1);await click(page,'Comprobar creación');}
 if(['no-arrival','rollback','expired-profile','profile-retry-unavailable','retry-not-authorized'].includes(mode)){
  await wait(page,'No recibimos la confirmación');assert.equal(posts.length,1);assert.equal(created,false);assert.equal(await page.$$eval('button',buttons=>buttons.some(button=>button.textContent==='Reenviar mismo intento')),false);
  if(mode==='expired-profile'){profileClock=epoch+70;await assert.rejects(verifyProfile(profileTokens[0],sessionIdentity),{code:'COMPANY_VERIFIED_PROFILE_REQUIRED'});}
  await click(page,'Comprobar creación');
  if(mode==='retry-not-authorized'){await wait(page,'No se pudo comprobar el alta');assert.equal(await page.$$eval('button',buttons=>buttons.some(button=>button.textContent==='Reenviar mismo intento')),false);assert.equal(posts.length,1);checks.push('checked-absence-without-canCreate-never-authorizes-retry');await context.close();return;}
  await wait(page,'No se reenvía automáticamente');assert.equal(posts.length,1);assert.equal(created,false);assert.equal(await page.$eval('input[autocomplete="organization"]',input=>input.disabled),true);
  if(mode==='expired-profile'){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(output,`company-expired-profile-recovery-${width}.png`),fullPage:true});}
  if(mode==='profile-retry-unavailable'){
   await page.evaluate(()=>{window.__profileUnavailable=true;});await click(page,'Reenviar mismo intento');await wait(page,'El alta no se envió');assert.equal(posts.length,1);assert.equal(await page.$eval('input[autocomplete="organization"]',input=>input.value),'Constructora de ensayo');
   await page.evaluate(()=>{window.__profileUnavailable=false;});
  }
  await click(page,'Reenviar mismo intento');await wait(page,'El espacio está creado');assert.equal(posts.length,2);assert.equal(postBodies[0],postBodies[1]);assert.equal(await page.evaluate(()=>window.__profileReads),mode==='profile-retry-unavailable'?3:2);checks.push(`${mode}-checked-absence-explicit-identical-retry-fresh-profile-proof`);
 }
 await wait(page,'El espacio está creado');assert.equal(posts.length,['no-arrival','rollback','expired-profile','profile-retry-unavailable'].includes(mode)?2:1);assert.equal(posts[0].initialTasks.length,mode==='planned'?1:0);assert.ok((await page.evaluate(()=>document.body.innerText)).includes('WhatsApp todavía no quedó conectado'));
 await click(page,'Entrar a mi obra');await wait(page,'Mis obras');await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.textContent.includes('Obra inicial de ensayo')&&!button.disabled));await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra inicial de ensayo')).click());
 if(mode==='planned'){await wait(page,'Replanteo de la obra');assert.ok((await page.evaluate(()=>document.body.innerText)).includes('0 %'));}
 else{
  await wait(page,'no tiene tareas registradas');await click(page,'Nueva tarea');await page.type('input[minlength="2"]','Primera tarea cargada después');await click(page,'Crear tarea');await wait(page,'Tarea creada y vinculada');assert.equal(taskPosts.length,1);assert.ok((await page.evaluate(()=>document.body.innerText)).includes('0 %'));
 }
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(external,[]);
 if(mode==='empty'){const beforeReturn=posts.length;await page.reload({waitUntil:'networkidle0'});await wait(page,'Alta confirmada');await wait(page,'Mis obras');assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Entrar a mi obra'));await page.click('summary');await wait(page,'Recibo: '+result.receiptId);assert.equal(posts.length,beforeReturn);assert.equal(await page.evaluate(()=>window.__profileReads||0),0);await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.textContent.includes('Obra inicial de ensayo')&&!button.disabled));await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra inicial de ensayo')).click());await wait(page,'Primera tarea cargada después');assert.equal(taskPosts.length,1);checks.push(`ordinary-return-keeps-workspace-open-and-original-receipt-consultable-${width}`);}
 checks.push(`${mode}-company-to-workspace-${width}`);await context.close();
}
try{
 let ready=false;
 for(let i=0;i<120;i++){
  if(server.exitCode!==null)throw new Error('Fixture exited: '+log.slice(-5000));
  let response;try{response=await fetch(origin);}catch{}
  await response?.body?.cancel();
  if(response?.ok){ready=true;break;}
  if(response&&response.status>=500)throw new Error('Fixture page failed with HTTP '+response.status+': '+log.slice(-5000));
  await new Promise(done=>setTimeout(done,500));
 }
 assert.ok(ready,'Fixture server unavailable: '+log.slice(-5000));
 browser=await puppeteer.launch({headless:true,...(process.platform==='win32'?{channel:'chrome'}:{}),args:['--no-sandbox','--disable-setuid-sandbox']});
 if(!process.env.COMPANY_ONBOARDING_UI_SUITE){for(const width of [320,390,768,1280])await scenario('empty',width);await scenario('planned',390);await scenario('uncertain');await scenario('no-arrival');await scenario('rollback');await scenario('denied');
 for(const mode of ['expired-profile','profile-retry-unavailable','retry-not-authorized','initial-sdk-hung','session-hung','profile-hung','late-session-context','late-session-unmount','late-profile-unmount'])await scenario(mode);}
 for(const width of [320,390,768,1280])for(const mode of ['reload-committed','reload-not-committed','reload-denied','reload-other-actor','reload-missing-receipt'])await scenario(mode,width);
 assert.deepEqual(errors,[]);const proof={status:'PASS',environment:'actual-ui-with-intercepted-synthetic-services',checks,widths:[320,390,768,1280],errors,profileExpiryVerification:'real-RS256-verifier-with-disposable-local-key-and-controlled-clock',sdkDeadlines:'controlled-accelerated-clock',realClerkLogin:false,physicalWhatsApp:false,productionDataWritten:false};
 rmSync(path.join(output,'browser-failure.json'),{force:true});writeFileSync(path.join(output,'browser.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(error){writeFileSync(path.join(output,'browser-failure.json'),JSON.stringify({message:error.message,errors,log},null,2));throw error;}
finally{await browser?.close();try{if(process.platform!=='win32')process.kill(-server.pid,'SIGTERM');else server.kill();}catch{}await new Promise(done=>setTimeout(done,500));const resolved=realpathSync(dir);assert.equal(path.dirname(resolved),realpathSync(parent));assert.ok(path.basename(resolved).startsWith('company-bootstrap-ui-'));rmSync(resolved,{recursive:true,force:true});}
