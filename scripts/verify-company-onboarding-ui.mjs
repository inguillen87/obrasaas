import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,copyFileSync,writeFileSync,rmSync,readdirSync,realpathSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import puppeteer from 'puppeteer';
import {projectPreparationSnapshot} from '../src/app/(identity)/cuenta/project-preparation-format.mjs';
import {createLocalJWKSet,generateKeyPair,exportJWK,SignJWT} from 'jose';
import {createBootstrapProfileVerifier} from '../src/lib/company-onboarding-identity.mjs';
import {BOOTSTRAP_PROFILE_AUDIENCE} from '../src/lib/company-onboarding-policy.mjs';
import {IDENTITY_ISSUER,IDENTITY_ORIGIN} from '../src/lib/production-identity-config.mjs';
import {respondClosedCompanySubscription} from './lib/company-subscription-ui-fixture.mjs';
import {copyPlanDocumentCurveFixture} from './lib/plan-document-curve-fixture-copy.mjs';
assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV);
assert.ok([undefined,'onboarding-recovery'].includes(process.env.COMPANY_ONBOARDING_UI_SUITE));
const root=realpathSync(process.cwd()),parent=path.join(root,'.vercel'),output=path.join(parent,'company-onboarding-evidence');mkdirSync(output,{recursive:true});
const dir=mkdtempSync(path.join(root,'.vercel/company-bootstrap-ui-')),app=path.join(dir,'src/app'),components=path.join(app,'(identity)/cuenta');mkdirSync(components,{recursive:true});
mkdirSync(path.join(dir,'src/lib'),{recursive:true});copyFileSync(path.join(root,'src/lib/worker-channel-consent-policy.mjs'),path.join(dir,'src/lib/worker-channel-consent-policy.mjs'));
copyFileSync(path.join(root,'src/lib/geo.js'),path.join(dir,'src/lib/geo.js'));
mkdirSync(path.join(dir,'src/lib/whatsapp'),{recursive:true});copyFileSync(path.join(root,'src/lib/whatsapp/tenant-workspace-policy.js'),path.join(dir,'src/lib/whatsapp/tenant-workspace-policy.js'));
for(const file of readdirSync(path.join(root,'src/app/(identity)/cuenta')).filter(name=>/\.(js|mjs|css)$/.test(name)))copyFileSync(path.join(root,'src/app/(identity)/cuenta',file),path.join(components,file));
const sourcePaths=[...readdirSync(path.join(root,'src/app/(identity)/cuenta')).filter(name=>/\.(?:js|mjs|css)$/.test(name)).map(name=>'src/app/(identity)/cuenta/'+name),...["src/lib/company-onboarding-identity.mjs","src/lib/company-onboarding-policy.mjs","src/lib/geo.js","src/lib/production-identity-config.mjs","src/lib/whatsapp/tenant-workspace-policy.js","src/lib/worker-channel-consent-policy.mjs","src/lib/workspace-policy.mjs"]],copiedSourcePaths=new Set(["src/app/(identity)/cuenta/company-bootstrap-panel.js","src/app/(identity)/cuenta/company-channel-panel.module.css","src/app/(identity)/cuenta/company-channel-panel.js","src/app/(identity)/cuenta/company-bootstrap-panel.module.css","src/app/(identity)/cuenta/constructor-crm-panel.js","src/app/(identity)/cuenta/constructor-crm-panel.module.css","src/app/(identity)/cuenta/constructor-crm-view.mjs","src/app/(identity)/cuenta/customer-inbox-panel.js","src/app/(identity)/cuenta/customer-inbox-panel.module.css","src/app/(identity)/cuenta/customer-inbox-view.mjs","src/app/(identity)/cuenta/customer-whatsapp-panel.js","src/app/(identity)/cuenta/customer-whatsapp-panel.module.css","src/app/(identity)/cuenta/customer-whatsapp-view.mjs","src/app/(identity)/cuenta/demo-pilot-panel.js","src/app/(identity)/cuenta/demo-pilot-view.mjs","src/app/(identity)/cuenta/field-media-capture.js","src/app/(identity)/cuenta/field-media-preparation.mjs","src/app/(identity)/cuenta/field-media-preview.js","src/app/(identity)/cuenta/field-operations-panel.js","src/app/(identity)/cuenta/field-operations-panel.module.css","src/app/(identity)/cuenta/field-qr-capture.js","src/app/(identity)/cuenta/field-qr-reader.mjs","src/app/(identity)/cuenta/invitation-entry.js","src/app/(identity)/cuenta/kyc-photo-preparation.js","src/app/(identity)/cuenta/meta-onboarding-panel.js","src/app/(identity)/cuenta/meta-onboarding-panel.module.css","src/app/(identity)/cuenta/meta-sdk-loader.mjs","src/app/(identity)/cuenta/onboarding-guide.js","src/app/(identity)/cuenta/onboarding-guide.module.css","src/app/(identity)/cuenta/operations-status-panel.js","src/app/(identity)/cuenta/operations-status-panel.module.css","src/app/(identity)/cuenta/page.js","src/app/(identity)/cuenta/participant-panel.js","src/app/(identity)/cuenta/participant-civil-data-panel.js","src/app/(identity)/cuenta/participant-civil-data-view.mjs","src/app/(identity)/cuenta/participant-ocr-usage-view.mjs","src/app/(identity)/cuenta/participant-panel.module.css","src/app/(identity)/cuenta/private-workspace-download.js","src/app/(identity)/cuenta/schedule-workbench.js","src/app/(identity)/cuenta/schedule-workbench.mjs","src/app/(identity)/cuenta/schedule-workbench.module.css","src/app/(identity)/cuenta/session-recovery.js","src/app/(identity)/cuenta/site-purchase-panel.js","src/app/(identity)/cuenta/site-purchase-panel.module.css","src/app/(identity)/cuenta/site-purchase-view.mjs","src/app/(identity)/cuenta/site-register-panel.js","src/app/(identity)/cuenta/site-register-panel.module.css","src/app/(identity)/cuenta/task-create-panel.js","src/app/(identity)/cuenta/template-send-panel.js","src/app/(identity)/cuenta/template-send-panel.module.css","src/app/(identity)/cuenta/template-send-view.mjs","src/app/(identity)/cuenta/worker-channel-panel.js","src/app/(identity)/cuenta/worker-channel-panel.module.css","src/app/(identity)/cuenta/workspace-client.js","src/app/(identity)/cuenta/workspace-identity.js","src/app/(identity)/cuenta/workspace-recovery-journal.mjs","src/app/(identity)/cuenta/company-channel-view.mjs","src/app/(identity)/cuenta/workspace-recovery-panel.js","src/app/(identity)/cuenta/workspace-recovery-storage.mjs","src/app/(identity)/cuenta/workspace-request-lifecycle.js","src/app/(identity)/cuenta/workspace-request-lifecycle.mjs","src/app/(identity)/cuenta/workspace-session-request.mjs","src/app/(identity)/cuenta/workspace-tools-navigation.js","src/app/(identity)/cuenta/workspace-tools-navigation.module.css","src/app/(identity)/cuenta/workspace.module.css","src/lib/geo.js","src/lib/whatsapp/tenant-workspace-policy.js","src/lib/worker-channel-consent-policy.mjs"]);
const mediaPrivacyPath='src/lib/field-media-privacy.mjs';copyFileSync(path.join(root,mediaPrivacyPath),path.join(dir,mediaPrivacyPath));sourcePaths.push(mediaPrivacyPath);copiedSourcePaths.add(mediaPrivacyPath);
for(const file of ['voice-progress-draft.mjs','progress-measurement-quantity.js','task-progress-measurement.js']){const source='src/lib/'+file;copyFileSync(path.join(root,source),path.join(dir,source));sourcePaths.push(source);copiedSourcePaths.add(source);}
const phoneFormatPath='src/lib/company-phone-format.mjs';copyFileSync(path.join(root,phoneFormatPath),path.join(dir,phoneFormatPath));sourcePaths.push(phoneFormatPath);copiedSourcePaths.add(phoneFormatPath);
const entitlementPath='src/lib/company-entitlement.mjs';copyFileSync(path.join(root,entitlementPath),path.join(dir,entitlementPath));sourcePaths.push(entitlementPath);copiedSourcePaths.add(entitlementPath);
const officeIdentityPath='src/lib/identity-return-path.mjs';copyFileSync(path.join(root,officeIdentityPath),path.join(dir,officeIdentityPath));sourcePaths.push(officeIdentityPath);copiedSourcePaths.add(officeIdentityPath);
for(const file of ['src/app/(identity)/identity.module.css','src/app/(identity)/identity-load-guard.js']){copyFileSync(path.join(root,file),path.join(dir,file));sourcePaths.push(file);copiedSourcePaths.add(file);}
const sourceManifest=sourcePaths.map(file=>{const bytes=readFileSync(path.join(root,file));if(copiedSourcePaths.has(file)||file.startsWith('src/app/(identity)/cuenta/'))assert.deepEqual(bytes,readFileSync(path.join(dir,file)));return {path:file,sha256:createHash('sha256').update(bytes).digest('hex')};});
sourceManifest.push({path:'scripts/lib/company-subscription-ui-fixture.mjs',sha256:createHash('sha256').update(readFileSync(new URL('./lib/company-subscription-ui-fixture.mjs',import.meta.url))).digest('hex')});
assert.equal(new Set(sourceManifest.map(row=>row.path)).size,sourceManifest.length);
const harnessSha256=createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex');
const documentCurveSourceManifest=[];
const {fixtureTransforms:documentCurveFixtureTransforms}=copyPlanDocumentCurveFixture({root,fixture:dir,components:path.join(components),sourceManifest:documentCurveSourceManifest});
for(const ref of documentCurveSourceManifest){const existing=sourceManifest.find(row=>row.path===ref.path);if(existing)assert.equal(existing.sha256,ref.sha256,'Original document dependency source hash');else sourceManifest.push(ref);}
writeFileSync(path.join(dir,'package.json'),JSON.stringify({name:'synthetic-company-onboarding-ui',private:true}));
writeFileSync(path.join(dir,'next.config.mjs'),`import path from 'node:path';export default {devIndicators:false,turbopack:{root:${JSON.stringify(root)}},webpack(config){config.resolve.alias['@clerk/nextjs']=path.resolve(${JSON.stringify(dir)},'clerk-selector-fixture.js');return config;}};`);
// Only identity-provider inputs are controlled; the selector wrapper and workspace are actual copied source.
writeFileSync(path.join(dir,'clerk-selector-fixture.js'),`'use client';
import {createContext,useCallback,useContext,useState} from 'react';
const Context=createContext(null),names={org_SelectorA:'Espacio personal A',org_SelectorB:'Espacio personal B'};
export function FixtureProvider({children}){
 const [orgId,setOrgId]=useState('org_SelectorA'),[serial,setSerial]=useState(1),[visible,setVisible]=useState(true),[signedIn,setSignedIn]=useState(true);
 const getToken=useCallback(async()=> 'synthetic-selector-'+orgId.slice(-1)+'-'+serial,[orgId,serial]);
 const value={auth:{isLoaded:true,isSignedIn:signedIn,userId:'user_SelectorSynthetic',sessionId:'session_Selector_'+serial,orgId,orgRole:'org:member',getToken},organization:{id:orgId,name:names[orgId]},choose:setOrgId};
 if(typeof window!=='undefined'){window.__forceSelectorOrganization=setOrgId;window.__endSelectorSession=()=>setSignedIn(false);window.__unmountSelector=()=>setVisible(false);}
 return <Context.Provider value={value}>{visible?children:<p>Selector desmontado en ensayo</p>}<button type="button" data-fixture-session-change onClick={()=>setSerial(previous=>previous+1)}>Cambiar sesión de ensayo</button></Context.Provider>;
}
export function useAuth(){return useContext(Context).auth;}
export function useOrganization(){return {organization:useContext(Context).organization};}
export function OrganizationSwitcher(){const value=useContext(Context);return <select aria-label="Elegir espacio de trabajo" data-fixture-organization value={value.auth.orgId} onChange={event=>value.choose(event.target.value)} style={{minHeight:44,maxWidth:'100%'}}>{Object.entries(names).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select>;}
export function SignIn(){return null;}
export function UserButton(){return null;}
`);
mkdirSync(path.join(app,'selector'),{recursive:true});
writeFileSync(path.join(app,'selector/page.js'),`'use client';import {Suspense} from 'react';import {FixtureProvider} from '../../../clerk-selector-fixture';import {WorkspaceIdentityPanel} from '../(identity)/cuenta/workspace-identity';export default function Page(){return <FixtureProvider><main style={{maxWidth:1120,margin:'0 auto',color:'#eef4ff'}}><Suspense fallback={<p>Cargando ensayo de acceso</p>}><WorkspaceIdentityPanel/></Suspense></main></FixtureProvider>}`);
writeFileSync(path.join(app,'layout.js'),`export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:12,background:'#081c2d',fontFamily:'Arial,sans-serif'}}>{children}</body></html>}`);
writeFileSync(path.join(app,'page.js'),`'use client';import {useState} from 'react';import {CompanyBootstrapPanel} from './(identity)/cuenta/company-bootstrap-panel';import {AccountWorkspace} from './(identity)/cuenta/workspace-client';const session=async()=>{if(window.__sessionHung)return new Promise(resolve=>{window.__releaseSession=()=>resolve('synthetic-session-token');});return 'synthetic-session-token';};const profile=async()=>{window.__profileReads=(window.__profileReads||0)+1;if(window.__profileUnavailable)throw new Error('fixture');if(window.__profileHung)return new Promise(resolve=>{window.__releaseProfile=()=>resolve('synthetic-profile-token');});return window.__profileTokens?.[Math.min(window.__profileReads-1,1)]||'synthetic-profile-token-'+window.__profileReads;};export default function Page(){const [visible,setVisible]=useState(true),[organization,setOrganization]=useState('org_BootstrapA');if(typeof window!=='undefined'){window.__unmountBootstrap=()=>setVisible(false);window.__changeContext=()=>{window.__sessionHung=false;window.__profileHung=false;setOrganization('org_BootstrapB');};}return <main style={{maxWidth:1120,margin:'0 auto'}}>{visible?<CompanyBootstrapPanel key={organization} organizationId={organization} organizationName="" getSessionToken={session} getProfileToken={profile}><AccountWorkspace getSessionToken={session}/></CompanyBootstrapPanel>:<p>Componente desmontado en ensayo controlado</p>}</main>}`);
mkdirSync(path.join(app,'portfolio101'),{recursive:true});
writeFileSync(path.join(app,'portfolio101/page.js'),`'use client';import {useCallback,useState} from 'react';import {AccountWorkspace} from '../(identity)/cuenta/workspace-client';export default function Page(){const [visible,setVisible]=useState(true),[context,setContext]=useState('A');const token=useCallback(async()=> 'synthetic-portfolio-'+context+'-'+(window.__portfolioTokenEpoch||1),[context]);const observed=useCallback(value=>{window.__portfolioGuide=value;},[]);if(typeof window!=='undefined'){window.__changePortfolioContext=()=>setContext('B');window.__unmountPortfolio=()=>setVisible(false);}return <main style={{maxWidth:1120,margin:'0 auto'}}>{visible?<AccountWorkspace getSessionToken={token} onGuideObservation={observed}/>:<p>Portfolio desmontado en ensayo</p>}</main>}`);
const origin='http://127.0.0.1:3110';
const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',dir,'--webpack','--hostname','127.0.0.1','--port','3110'],{env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
let log='';for(const stream of [server.stdout,server.stderr])stream.on('data',value=>{log=(log+value).slice(-16000);});
let browser;const checks=[],errors=[],portfolioIntegrationChecks=[],organizationLockChecks=[];
const click=async(page,label)=>{const handle=await page.evaluateHandle(text=>[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===text),label);assert.ok(handle.asElement(),'Missing button '+label);await handle.asElement().click();await handle.dispose();};
const wait=(page,text)=>page.waitForFunction(value=>document.body.innerText.includes(value),{timeout:20000},text);
async function canonicalCreatedTask(page,task){
 await page.waitForFunction(expected=>[...document.querySelectorAll('article[data-task-id]')].some(article=>article.dataset.taskId===expected.id&&article.querySelector('h5')?.textContent===expected.title&&article.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')==='0'),{timeout:20000},task);
 const rendered=await page.$$eval('article[data-task-id]',(articles,id)=>articles.filter(article=>article.dataset.taskId===id).map(article=>({title:article.querySelector('h5')?.textContent,zeroProgress:article.innerText.includes('0 %'),progress:article.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')})),task.id);
 assert.deepEqual(rendered,[{title:task.title,zeroProgress:true,progress:'0'}]);
 assert.ok((await page.evaluate(()=>document.querySelector('[aria-labelledby="schedule-title"]').innerText)).includes('1 de 1 tareas'));
}
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
  let created=false,result=null,tasks=[],taskReceipts=new Map(),expectedOrganization='org_BootstrapA';const posts=[],postBodies=[],taskPosts=[],external=[],recoveryIds=[],subscriptionReads=[];const scope='c'.repeat(64);
  let releaseTaskReadback,markTaskReadbackStarted,taskReadbackHeld=false,taskReadbacks=0;
  const taskReadbackBarrier=mode==='empty'?new Promise(resolve=>{releaseTaskReadback=resolve;}):null;
  const taskReadbackStarted=mode==='empty'?new Promise(resolve=>{markTaskReadbackStarted=resolve;}):null;
 page.on('request',async request=>{
  try{
   const url=new URL(request.url());
   if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();external.push(url.hostname);return request.abort();}
   if(!url.pathname.startsWith('/api/identity/'))return request.continue();
   assert.equal(request.headers().authorization,'Bearer synthetic-session-token');
   if(await respondClosedCompanySubscription(request,{origin,scope,authorization:'Bearer synthetic-session-token',allowed:created===true,reads:subscriptionReads}))return;
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
     assert.equal(created,true);assert.equal(request.method(),'GET');
     if(url.search){
      assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),'project-test');
      if(taskPosts.length){taskReadbacks++;if(taskReadbackBarrier&&!taskReadbackHeld){taskReadbackHeld=true;markTaskReadbackStarted();await taskReadbackBarrier;}}
     }
     body=!url.search?{scope,organizationName:result.companyName,roleLabel:'Administrador',role:'ADMIN',canPlanSchedule:true,canManageIntegrations:false,projects:[{id:'project-test',name:result.projectName}],projectsTruncated:false}:
       {scope,project:{id:'project-test',name:result.projectName},roleLabel:'Administrador',canPlanSchedule:true,tasks,totalTasks:tasks.length,nextCursor:null};
   }else if(['/api/identity/project-creation','/api/identity/office-review'].includes(url.pathname)){
    assert.equal(created,true);assert.equal(request.method(),'GET');assert.deepEqual([...url.searchParams.keys()].sort(),['projectId','scope']);assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),'project-test');
    body=url.pathname==='/api/identity/project-creation'?{scope,projectId:'project-test',canCreate:true}:{scope,projectId:'project-test',canManage:true,channels:[],invitations:[],candidates:[],truncated:false,candidatesLimited:false};
   }else if(url.pathname==='/api/identity/project-preparation'){
    assert.equal(created,true);assert.equal(request.method(),'GET');assert.deepEqual([...url.searchParams.keys()].sort(),['projectId','scope']);assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),'project-test');
    body=projectPreparationSnapshot({scope,projectId:'project-test',canManage:true,revision:0,detailsDigest:'b'.repeat(64),name:result.projectName,clientName:'',address:'',teams:[],slots:[],startStatus:'TO_CONFIRM',declarationOnly:true},{scope,projectId:'project-test'});
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
   await wait(page,'no tiene tareas registradas');await click(page,'Nueva tarea');await page.waitForSelector('input[minlength="2"]',{visible:true,timeout:20000});await page.type('input[minlength="2"]','Primera tarea cargada después');
   await click(page,'Crear tarea');await wait(page,'Tarea creada y vinculada');
   assert.equal(taskPosts.length,1);const createdTask=taskReceipts.get(taskPosts[0].operationId).task;assert.equal(createdTask.title,'Primera tarea cargada después');assert.equal(createdTask.progress,0);
   if(mode==='empty'){
    let readbackTimeout;try{await Promise.race([taskReadbackStarted,new Promise((_,reject)=>{readbackTimeout=setTimeout(()=>reject(new Error('Canonical task readback was not observed')),20000);})]);}finally{clearTimeout(readbackTimeout);}
    assert.equal(taskReadbackHeld,true);assert.equal(taskReadbacks,1);
    await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.textContent==='Nueva tarea'&&button.disabled),{timeout:20000});
    assert.equal(await page.$$eval('article[data-task-id]',articles=>articles.length),0,'A task receipt is not a canonical schedule read');
    assert.equal(await page.$$eval('[role="progressbar"]',bars=>bars.length),0,'No recorded progress before canonical readback');
    await wait(page,'Consultando el cronograma actualizado');assert.equal(taskPosts.length,1);releaseTaskReadback();
    checks.push(`empty-task-receipt-before-held-canonical-readback-${width}`);
   }
   await canonicalCreatedTask(page,createdTask);assert.equal(taskPosts.length,1);assert.equal(taskReadbacks,1);
  }
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(external,[]);
  if(mode==='empty'){const beforeReturn=posts.length;await page.reload({waitUntil:'networkidle0'});await wait(page,'Alta confirmada');await wait(page,'Mis obras');assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Entrar a mi obra'));await page.click('summary');await wait(page,'Recibo: '+result.receiptId);assert.equal(posts.length,beforeReturn);assert.equal(await page.evaluate(()=>window.__profileReads||0),0);await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.textContent.includes('Obra inicial de ensayo')&&!button.disabled));await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Obra inicial de ensayo')).click());await canonicalCreatedTask(page,taskReceipts.get(taskPosts[0].operationId).task);assert.equal(taskPosts.length,1);assert.equal(taskReadbacks,2);checks.push(`ordinary-return-keeps-workspace-open-and-original-receipt-consultable-${width}`);}
 assert.ok(subscriptionReads.length>=1,'Created administrator consults closed subscription status');checks.push(`${mode}-company-to-workspace-${width}`);await context.close();
}
async function companySelectorContext(width){
 const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1000});
 const endpoint='/api/identity/workspace',reads=[],writes=[],unexpected=[],held=[],late=[];
 const names={A:'Constructora A & socios <b>ensayo</b>',B:'Constructora B de ensayo'};
 const snapshot=letter=>({scope:letter.toLowerCase().repeat(64),organizationName:names[letter],role:'DIRECTOR',roleLabel:'Director de obra',canPlanSchedule:true,canManageIntegrations:false,projects:[],projectsTruncated:false});
 let next=null;
 const match=(request,token)=>{const url=new URL(request.url());return url.origin===origin&&url.pathname===endpoint&&url.search===''&&request.method()==='GET'&&request.headers().authorization==='Bearer '+token;};
 const observed=(token,status=200)=>page.waitForResponse(response=>match(response.request(),token)&&response.status()===status,{timeout:20000});
 const received=(token)=>page.waitForRequest(request=>match(request,token),{timeout:20000});
 const absent=async()=>{assert.equal(await page.$$eval('[data-workspace-company-name]',nodes=>nodes.length),0,'No older company label during an unconfirmed context/read');};
 const ready=async(letter)=>{
  await page.waitForFunction(name=>document.querySelector('[data-workspace-company-name]')?.textContent===name&&document.querySelector('#workspace-refresh')?.disabled===false,{timeout:20000},names[letter]);
  assert.deepEqual(await page.$$eval('[data-workspace-company-name]',nodes=>nodes.map(node=>node.textContent)),[names[letter]]);
  assert.equal(await page.$$eval('[data-workspace-company-name] b',nodes=>nodes.length),0,'Canonical name is escaped React text');
  assert.ok((await page.$eval('#organization-context',node=>node.innerText)).includes('Empresa de trabajo'));
  assert.equal(await page.$eval('[data-fixture-organization]',node=>node.selectedOptions[0].textContent),'Espacio personal '+letter);
  assert.equal(await page.$eval('[aria-labelledby="workspace-title"]',node=>node.innerText.includes('Director de obra')),true,'An existing non-admin membership uses the real workspace branch');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 };
 const arm=(token,status=200)=>{assert.equal(next,null);next={token,status,hold:true};return received(token);};
 const release=async(request,allowAborted=false)=>{
  const item=held.find(row=>row.request===request);assert.ok(item,'The real GET must have reached interception');
  if(allowAborted&&request.failure()?.errorText==='net::ERR_ABORTED'){late.push('old-context-request-aborted');return;}
  try{await request.respond({status:item.status,contentType:'application/json',body:JSON.stringify(item.body)});if(allowAborted)late.push('old-context-response-released');}
  catch(error){if(!allowAborted||request.failure()?.errorText!=='net::ERR_ABORTED')throw error;late.push('old-context-request-aborted');}
 };
 const confirm=async(promise,letter)=>{assert.deepEqual(await (await promise).json(),snapshot(letter));await ready(letter);};
 await page.setRequestInterception(true);
 page.on('pageerror',error=>errors.push(error.message));
 page.on('request',request=>{
  const url=new URL(request.url());if(url.origin!==origin){unexpected.push(request.url());void request.abort();return;}
  if(!url.pathname.startsWith('/api/')){void request.continue();return;}
  if(request.method()!=='GET')writes.push({path:url.pathname,method:request.method()});
  const token=request.headers().authorization?.replace(/^Bearer /,'');
  if(url.pathname!==endpoint||url.search!==''||request.method()!=='GET'||!/^synthetic-selector-[AB]-[12]$/.test(token||'')){unexpected.push({path:url.pathname,search:url.search,method:request.method()});void request.respond({status:500,contentType:'application/json',body:'{"saved":false,"code":"UNEXPECTED_SYNTHETIC_REQUEST"}'});return;}
  reads.push(token);const step=next;next=null;if(step&&token!==step.token){unexpected.push({code:'READ_TOKEN_MISMATCH',path:url.pathname});void request.respond({status:500,contentType:'application/json',body:'{"saved":false,"code":"UNEXPECTED_SYNTHETIC_CONTEXT"}'});return;}
  const letter=token.split('-')[2],status=step?.status||200,body=status===200?snapshot(letter):{saved:false,code:status===401?'SESSION_REQUIRED':status===403?'WORKSPACE_MEMBERSHIP_REQUIRED':'IDENTITY_PROVIDER_UNAVAILABLE'};
  if(step?.hold){held.push({request,status,body});return;}
  void request.respond({status,contentType:'application/json',body:JSON.stringify(body)});
 });
 try{
  const initial=observed('synthetic-selector-A-1');await page.goto(origin+'/selector',{waitUntil:'domcontentloaded'});await confirm(initial,'A');
  const selectorText=await page.$eval('#organization-context',node=>node.innerText);
  assert.ok(selectorText.includes('Elegí tu espacio de trabajo. Su nombre puede ser distinto al de la empresa.'));assert.ok(!selectorText.includes('Clerk'));
  // Hold an actual refresh, change the organization manually, then release the earlier request only after B is current.
  const oldRead=arm('synthetic-selector-A-1');await page.click('#workspace-refresh');const oldRequest=await oldRead;await absent();
  const newRead=arm('synthetic-selector-B-1'),newResponse=observed('synthetic-selector-B-1');await page.select('[data-fixture-organization]','org_SelectorB');const newRequest=await newRead;await absent();await release(newRequest);await confirm(newResponse,'B');
  await release(oldRequest,true);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await ready('B');assert.equal(late.length,1);
  // Same organization, changed session: the old label is absent while its new GET is pending.
  const sessionRead=arm('synthetic-selector-B-2'),sessionResponse=observed('synthetic-selector-B-2');await page.click('[data-fixture-session-change]');const sessionRequest=await sessionRead;await absent();await release(sessionRequest);await confirm(sessionResponse,'B');
  // A full reload starts with no restored label; the controlled provider returns A only through a fresh list GET.
  const reloadRead=arm('synthetic-selector-A-1'),reloadResponse=observed('synthetic-selector-A-1');await page.reload({waitUntil:'domcontentloaded'});const reloadRequest=await reloadRead;await absent();await release(reloadRequest);await confirm(reloadResponse,'A');
  for(const status of [401,403,503]){
   const failedRead=arm('synthetic-selector-A-1',status),failedResponse=observed('synthetic-selector-A-1',status);await page.click('#workspace-refresh');const failedRequest=await failedRead;await absent();await release(failedRequest);
   const response=await failedResponse;assert.deepEqual(await response.json(),{saved:false,code:status===401?'SESSION_REQUIRED':status===403?'WORKSPACE_MEMBERSHIP_REQUIRED':'IDENTITY_PROVIDER_UNAVAILABLE'});
   await page.waitForFunction(()=>document.querySelector('#workspace-refresh')?.disabled===false,{timeout:20000});await absent();
   assert.ok((await page.$eval('[aria-labelledby="workspace-title"] [role="status"]',node=>node.innerText)).trim(),'Failed GET has visible feedback');
   const recovered=observed('synthetic-selector-A-1');await page.click('#workspace-refresh');await confirm(recovered,'A');
  }
  assert.deepEqual(reads,['synthetic-selector-A-1','synthetic-selector-A-1','synthetic-selector-B-1','synthetic-selector-B-2',...Array(7).fill('synthetic-selector-A-1')]);
  assert.equal(next,null);assert.deepEqual(writes,[]);assert.deepEqual(unexpected,[]);assert.equal(await page.$$eval('[data-workspace-company-name]',nodes=>nodes.length),1);
  checks.push(`company-selector-canonical-context-existing-member-late-session-reload-denials-readonly-${width}`);
 }finally{await context.close();}
}
const organizationLockModes=['cancel','save','external-organization','external-session','denied401','denied403','stale-observation','unmount'];
async function organizationDraftProtection(mode,width){
 const context=await browser.createBrowserContext(),page=await context.newPage(),reads=[],posts=[],unexpected=[],late=[];
 const names={A:'Empresa de planificación A',B:'Empresa de planificación B'},reason='Reprogramar el ingreso de materiales',draftDates={startsOn:'2026-10-12',endsOn:'2026-10-16'};
 const scope=letter=>letter.toLowerCase().repeat(64),project=letter=>({id:'selector-project-'+letter,name:'Obra de planificación '+letter,status:'ACTIVE'});
 const tasks={A:{id:'selector-task-A',title:'Actividad de planificación A',startsOn:'2026-10-02',endsOn:'2026-10-06',status:'BACKLOG',progress:0,revision:'2026-10-01T12:00:00.123456'},B:{id:'selector-task-B',title:'Actividad de planificación B',startsOn:'2026-10-03',endsOn:'2026-10-07',status:'BACKLOG',progress:0,revision:'2026-10-01T12:00:00.123456'}};
 let held=null,resolvePost;const postStarted=new Promise(resolve=>{resolvePost=resolve;});
 const respond=(request,body,status=200)=>request.respond({status,contentType:'application/json',headers:{'Cache-Control':'private, no-store'},body:JSON.stringify(body)});
 const tick=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const unlocked=async letter=>{
  await page.waitForFunction(id=>document.querySelector('[data-fixture-organization]')?.value===id&&document.querySelector('#workspace-refresh')?.disabled===false&&!document.querySelector('#organization-context-lock'),{timeout:20000},'org_Selector'+letter);
  assert.equal(await page.$$eval('[data-fixture-organization]',nodes=>nodes.length),1);assert.equal(await page.$$eval('#organization-context-lock',nodes=>nodes.length),0);
 };
 const ready=async letter=>{await page.waitForFunction(name=>document.querySelector('[data-workspace-company-name]')?.textContent===name,{timeout:20000},names[letter]);await unlocked(letter);};
 const locked=async()=>{
  await page.waitForSelector('#organization-context-lock');assert.equal(await page.$$eval('[data-fixture-organization]',nodes=>nodes.length),0);
  assert.ok((await page.$eval('#organization-context-lock',node=>node.innerText)).includes('cancelá el borrador o comprobá su resultado'));
  assert.equal(await page.$eval('#workspace-refresh',node=>node.disabled),true);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 };
 const openWork=async letter=>{
  await page.evaluate(id=>[...document.querySelectorAll('button[aria-pressed]')].find(node=>node.textContent.includes(id)&&!node.disabled).click(),project(letter).name);
  await wait(page,tasks[letter].title);await page.waitForFunction(id=>document.querySelector('article[data-task-id="'+id+'"] button')?.disabled===false,{timeout:20000},tasks[letter].id);
 };
 const edit=async(letter,text=reason)=>{
  await page.click('article[data-task-id="'+tasks[letter].id+'"] button');await page.waitForSelector('form[aria-labelledby="schedule-edit-title"]');
  for(const [index,value]of [draftDates.startsOn,draftDates.endsOn].entries()){await page.$$eval('form[aria-labelledby="schedule-edit-title"] input[type="date"]',(inputs,change)=>{const input=inputs[change.index];Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,change.value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));},{index,value});await tick();}
  await page.type('form[aria-labelledby="schedule-edit-title"] textarea',text);await locked();
  assert.deepEqual(await page.$$eval('form[aria-labelledby="schedule-edit-title"] input[type="date"]',inputs=>inputs.map(input=>input.value)),[draftDates.startsOn,draftDates.endsOn]);
  assert.equal(await page.$eval('form[aria-labelledby="schedule-edit-title"] textarea',node=>node.value),text);
 };
 const captureObservation=()=>page.evaluate(()=>{
  const node=document.querySelector('[aria-labelledby="workspace-title"]'),key=Object.keys(node||{}).find(name=>name.startsWith('__reactFiber$'));
  let fiber=node?.[key];while(fiber&&typeof fiber.memoizedProps?.onContextPending!=='function')fiber=fiber.return;
  if(!fiber)throw new Error('Actual workspace pending observer unavailable');window.__oldWorkspacePending=fiber.memoizedProps.onContextPending;
 });
 const oldObservation=async value=>{await page.evaluate(pending=>window.__oldWorkspacePending(pending),value);await tick();};
 const releaseOld=async()=>{
  assert.ok(held);if(held.request.failure()?.errorText==='net::ERR_ABORTED'){late.push('old-request-aborted');return;}
  try{await respond(held.request,held.body);late.push('old-response-released');}catch(error){if(held.request.failure()?.errorText!=='net::ERR_ABORTED')throw error;late.push('old-request-aborted');}
  await tick();
 };
 const submit=async()=>{
  await click(page,'Confirmar planificación');let timeout;try{await Promise.race([postStarted,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Planning POST was not observed')),20000);})]);}finally{clearTimeout(timeout);}
 };
 await page.setViewport({width,height:1000});page.on('pageerror',error=>errors.push({mode:'organization-lock-'+mode,width,message:error.message}));await page.setRequestInterception(true);
 page.on('request',async request=>{try{
  const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();unexpected.push(url.hostname);return request.abort();}
  if(!url.pathname.startsWith('/api/'))return request.continue();
  const token=request.headers().authorization;assert.match(token||'',/^Bearer synthetic-selector-[AB]-[12]$/);const letter=token.split('-')[2];
  if(url.pathname==='/api/identity/project-preparation'){
   assert.equal(request.method(),'GET');assert.deepEqual([...url.searchParams.keys()].sort(),['projectId','scope']);assert.equal(url.searchParams.get('scope'),scope(letter));assert.equal(url.searchParams.get('projectId'),project(letter).id);
   return respond(request,projectPreparationSnapshot({scope:scope(letter),projectId:project(letter).id,canManage:true,revision:0,detailsDigest:'d'.repeat(64),name:project(letter).name,clientName:'',address:'',teams:[],slots:[],startStatus:'TO_CONFIRM',declarationOnly:true},{scope:scope(letter),projectId:project(letter).id}));
  }
  assert.equal(url.pathname,'/api/identity/workspace');
  if(request.method()==='POST'){
   assert.equal(url.search,'');const input=JSON.parse(request.postData());posts.push(input);assert.equal(letter,'A');assert.equal(input.scope,scope('A'));assert.equal(input.projectId,project('A').id);assert.equal(input.taskId,tasks.A.id);assert.equal(input.expectedRevision,tasks.A.revision);assert.equal(input.reason,reason);assert.equal(input.startsOn,draftDates.startsOn);assert.equal(input.endsOn,draftDates.endsOn);
   const after={...tasks.A,startsOn:input.startsOn,endsOn:input.endsOn,revision:'2026-10-11T12:00:00.123456'},body={scope:scope('A'),saved:true,replayed:false,task:after,receipt:{id:'workspace_schedule_'+'e'.repeat(64),taskId:tasks.A.id,recordedAt:after.revision,before:{startsOn:tasks.A.startsOn,endsOn:tasks.A.endsOn},after:draftDates}};
   if(['external-organization','external-session','unmount'].includes(mode)){held={request,body};resolvePost();return;}
   resolvePost();if(mode==='denied401'||mode==='denied403')return respond(request,{saved:false,code:mode==='denied401'?'SESSION_REQUIRED':'WORKSPACE_PROJECT_UNAVAILABLE'},mode==='denied401'?401:403);
   assert.equal(mode,'save');tasks.A=after;return respond(request,body);
  }
  assert.equal(request.method(),'GET');reads.push({query:url.search,token});
  if(!url.search)return respond(request,{scope:scope(letter),organizationName:names[letter],role:'DIRECTOR',roleLabel:'Director de obra',canPlanSchedule:true,canManageIntegrations:true,projects:[project(letter)],projectsTruncated:false});
  assert.deepEqual([...url.searchParams.keys()].sort(),['projectId','scope']);assert.equal(url.searchParams.get('scope'),scope(letter));assert.equal(url.searchParams.get('projectId'),project(letter).id);
  return respond(request,{scope:scope(letter),project:project(letter),roleLabel:'Director de obra',canPlanSchedule:true,tasks:[tasks[letter]],totalTasks:1,nextCursor:null});
 }catch(error){errors.push({mode:'organization-lock-'+mode,width,message:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}});
 try{
  await page.goto(origin+'/selector',{waitUntil:'networkidle0'});await ready('A');await openWork('A');await captureObservation();await edit('A');
  assert.equal(posts.length,0);if(mode==='cancel'||mode==='save')await page.screenshot({path:path.join(output,'organization-draft-lock-'+mode+'-'+width+'.png'),fullPage:true});
  if(mode==='cancel'){
   await click(page,'Cancelar');await unlocked('A');assert.equal(await page.$$eval('form[aria-labelledby="schedule-edit-title"]',nodes=>nodes.length),0);
   await page.select('[data-fixture-organization]','org_SelectorB');await ready('B');assert.equal(posts.length,0);
  }else if(mode==='save'){
   await submit();await wait(page,'Planificación guardada con recibo');await unlocked('A');assert.equal(posts.length,1);
   await page.select('[data-fixture-organization]','org_SelectorB');await ready('B');assert.equal(await page.$$eval('article[data-task-id]',nodes=>nodes.length),0);assert.equal(posts.length,1);
  }else if(mode==='denied401'||mode==='denied403'){
   await submit();await page.waitForFunction(()=>document.querySelector('[data-fixture-organization]')&&document.querySelector('#workspace-refresh')?.disabled===false,{timeout:20000});
   assert.equal(await page.$$eval('article[data-task-id],form[aria-labelledby="schedule-edit-title"],[data-workspace-company-name]',nodes=>nodes.length),0);assert.equal(posts.length,1);await oldObservation(false);assert.equal(await page.$$eval('#organization-context-lock',nodes=>nodes.length),0);
  }else if(mode==='stale-observation'){
   await page.evaluate(()=>window.__forceSelectorOrganization('org_SelectorB'));await ready('B');await oldObservation(true);await ready('B');
   await openWork('B');await edit('B','Borrador del contexto B conservado');await oldObservation(false);await locked();assert.equal(await page.$eval('form[aria-labelledby="schedule-edit-title"] textarea',node=>node.value),'Borrador del contexto B conservado');
   await click(page,'Cancelar');await unlocked('B');await page.select('[data-fixture-organization]','org_SelectorA');await ready('A');
   await openWork('A');await edit('A','Nuevo borrador A con la misma clave');await oldObservation(false);await locked();assert.equal(await page.$eval('form[aria-labelledby="schedule-edit-title"] textarea',node=>node.value),'Nuevo borrador A con la misma clave');await click(page,'Cancelar');await unlocked('A');assert.equal(posts.length,0);
  }else{
   await submit();await locked();assert.equal(posts.length,1);
   if(mode==='unmount'){await page.evaluate(()=>window.__unmountSelector());await wait(page,'Selector desmontado en ensayo');await releaseOld();await oldObservation(false);assert.equal(await page.$$eval('[aria-labelledby="workspace-title"],#organization-context',nodes=>nodes.length),0);}
   else if(mode==='external-organization'){await page.evaluate(()=>window.__forceSelectorOrganization('org_SelectorB'));await ready('B');await releaseOld();await oldObservation(true);await ready('B');assert.equal(await page.$$eval('article[data-task-id],form[aria-labelledby="schedule-edit-title"]',nodes=>nodes.length),0);}
   else{
    assert.equal(mode,'external-session');await page.click('[data-fixture-session-change]');await ready('A');await releaseOld();assert.equal(await page.$$eval('form[aria-labelledby="schedule-edit-title"]',nodes=>nodes.length),0);
    await openWork('A');await edit('A','Edición posterior al cambio de sesión');await oldObservation(false);await locked();assert.equal(await page.$eval('form[aria-labelledby="schedule-edit-title"] textarea',node=>node.value),'Edición posterior al cambio de sesión');
    await page.evaluate(()=>window.__endSelectorSession());await wait(page,'La sesión terminó');await oldObservation(true);assert.equal(await page.$$eval('[aria-labelledby="workspace-title"],#organization-context,article[data-task-id]',nodes=>nodes.length),0);
   }
   assert.equal(late.length,1);assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Planificación guardada con recibo'));assert.equal(posts.length,1);
  }
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(unexpected,[]);
  organizationLockChecks.push({mode,width,actualParentAndWorkspace:true,syntheticClerkOnly:true,selectorUnavailableWhilePending:true,draftBeforeSubmitPreserved:true,postCount:posts.length,externalContextStillInvalidates:['external-organization','external-session','unmount'].includes(mode)?true:null,staleObservationRejected:['external-organization','external-session','stale-observation','unmount'].includes(mode)?true:null,lateResponses:late.length,horizontalOverflow:false,providerCalls:0});
 }finally{await context.close();}
}
const portfolioIntegrationModes=['success','401','403','404','503','retry503','wrong-scope','wrong-project','wrong-status','stale-context','stale-project','stale-callback','refresh-callback','reconsult-callback','locked','unmount'];
async function portfolioThirdPage(mode,width){
 const context=await browser.createBrowserContext(),page=await context.newPage(),reads=[],writes=[],unexpected=[],held=[];
 const scope='a'.repeat(64),otherScope='b'.repeat(64),projectId='p-101';let project101Reads=0;
 const listed=n=>({id:'p-'+String(n).padStart(3,'0'),name:'Obra listada '+n,status:'ACTIVE'});
 const summarized=n=>({...listed(n),name:'Resumen obra '+n,totalTasks:2,completedTasks:0,inProgressTasks:0,blockedTasks:0,unscheduledTasks:2,nextEndsOn:null});
 const task=(id,title)=>({id,title,status:'BACKLOG',progress:0,startsOn:null,endsOn:null,revision:'2026-10-01T12:00:00.123456'});
 const projectBody=(id,append=false)=>({scope,project:{id,name:'Obra canónica '+Number(id.slice(2)),status:'ACTIVE'},roleLabel:'Jefe de obra',canPlanSchedule:true,tasks:[task(id===projectId?(append?'task-101-b':'task-101-a'):'task-001','Actividad canónica '+(id===projectId?(append?'101 segunda':'101 primera'):'001'))],totalTasks:id===projectId?2:1,nextCursor:id===projectId&&!append?'task-101-a':null});
 const respond=(request,body,status=200)=>request.respond({status,contentType:'application/json',headers:{'Cache-Control':'private, no-store'},body:JSON.stringify(body)});
 const releaseHeld=async()=>{assert.equal(held.length,1);const {request,body}=held[0];if(request.failure()?.errorText==='net::ERR_ABORTED')return;try{await respond(request,body);}catch(error){if(request.failure()?.errorText!=='net::ERR_ABORTED')throw error;}};
 const absent=async()=>{assert.equal(await page.$$eval('article[data-task-id]',nodes=>nodes.length),0);assert.equal(await page.$$eval('button[aria-pressed]',nodes=>nodes.filter(node=>node.textContent.includes('Obra canónica 101')).length),0);};
 const saveCallback=async()=>page.evaluate(()=>{const button=[...document.querySelectorAll('[aria-labelledby="portfolio-overview-title"] button')].find(node=>node.textContent==='Abrir Resumen obra 101'),key=Object.keys(button||{}).find(name=>name.startsWith('__reactProps$'));if(typeof button?.[key]?.onClick!=='function')throw new Error('Portfolio React handler unavailable');window.__savedPortfolioClick=button[key].onClick;});
 const tick=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.setViewport({width,height:1000});await page.evaluateOnNewDocument(()=>{const uuid=crypto.randomUUID.bind(crypto);window.__portfolioIssuedIds=[];crypto.randomUUID=()=>{const id=uuid();window.__portfolioIssuedIds.push(id);return id;};});
 page.on('pageerror',error=>errors.push({mode:'portfolio101-'+mode,width,message:error.message}));await page.setRequestInterception(true);
 page.on('request',async request=>{try{
  const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();unexpected.push(url.hostname);return request.abort();}
  if(!url.pathname.startsWith('/api/'))return request.continue();
  if(request.method()!=='GET')writes.push({method:request.method(),path:url.pathname});
  assert.equal(url.pathname,'/api/identity/workspace');assert.equal(request.method(),'GET');const authorization=request.headers().authorization;assert.match(authorization,/^Bearer synthetic-portfolio-[AB]-[12]$/);reads.push({query:url.search,authorization});
  const letter=authorization.includes('-B-')?'B':'A',currentScope=letter==='B'?otherScope:scope;
  if(!url.search){return respond(request,{scope:currentScope,organizationName:'Empresa de cartera '+letter,role:'SITE_MANAGER',roleLabel:'Jefe de obra',canPlanSchedule:true,canManageIntegrations:false,projects:Array.from({length:100},(_,i)=>listed(i+1)),projectsTruncated:true});}
  assert.equal(url.searchParams.get('scope'),currentScope);
  if(url.searchParams.has('portfolio')){
   assert.equal(letter,'A');assert.equal(url.searchParams.get('portfolio'),'1');assert.deepEqual([...url.searchParams.keys()].sort(),url.searchParams.has('afterProject')?['afterProject','portfolio','scope']:['portfolio','scope']);
   const cursor=url.searchParams.get('afterProject');assert.ok([null,'p-050','p-100'].includes(cursor));const start=cursor===null?1:cursor==='p-050'?51:101,end=Math.min(start+49,101);
   return respond(request,{scope,organizationName:'Empresa de cartera A',role:'SITE_MANAGER',projects:Array.from({length:end-start+1},(_,i)=>summarized(start+i)),nextCursor:end<101?'p-'+String(end).padStart(3,'0'):null});
  }
  assert.equal(letter,'A');const id=url.searchParams.get('projectId');assert.ok([projectId,'p-001'].includes(id));assert.deepEqual([...url.searchParams.keys()].sort(),url.searchParams.has('afterTask')?['afterTask','projectId','scope']:['projectId','scope']);
  if(id===projectId)project101Reads++;
  const append=url.searchParams.has('afterTask');if(append)assert.equal(url.searchParams.get('afterTask'),'task-101-a');let body=projectBody(id,append);
  if(id===projectId){
   if(['stale-context','stale-project','unmount'].includes(mode)){held.push({request,body});return;}
   if(['401','403','404','503'].includes(mode)||mode==='retry503'&&project101Reads===1){const status=mode==='retry503'?503:Number(mode);return respond(request,{saved:false,code:status===401?'SESSION_REQUIRED':status===403||status===404?'WORKSPACE_PROJECT_UNAVAILABLE':'WORKSPACE_OPERATION_UNCONFIRMED'},status);}
   if(mode==='wrong-scope')body={...body,scope:otherScope};if(mode==='wrong-project')body={...body,project:{...body.project,id:'p-102'}};if(mode==='wrong-status')body={...body,project:{...body.project,status:'ARCHIVED'}};
  }
  return respond(request,body);
 }catch(error){errors.push({mode:'portfolio101-'+mode,width,message:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}});
 try{
  await page.goto(origin+'/portfolio101',{waitUntil:'networkidle0'});await wait(page,'Empresa de cartera A');assert.equal(reads.length,1);assert.equal(await page.$$eval('button[aria-pressed]',nodes=>nodes.filter(node=>node.textContent.includes('Obra listada')).length),100);assert.equal(project101Reads,0);
  await click(page,'Consultar resumen');await wait(page,'50 obras consultadas');await click(page,'Consultar más obras');await wait(page,'100 obras consultadas');await click(page,'Consultar más obras');await wait(page,'101 obras consultadas');
  assert.equal(reads.filter(row=>row.query.includes('portfolio=1')).length,3);assert.equal(project101Reads,0,'Summary never opens a project automatically');await saveCallback();
  assert.equal(await page.$$eval('button[aria-pressed]',nodes=>nodes.filter(node=>node.textContent.includes('Resumen obra 101')).length),0,'Summary label never authorizes an operational selector');
  const handle=await page.evaluateHandle(()=>[...document.querySelectorAll('[aria-labelledby="portfolio-overview-title"] button')].find(node=>node.textContent==='Abrir Resumen obra 101')),button=handle.asElement();assert.ok(button);assert.ok(await button.evaluate(node=>node.getBoundingClientRect().height>=44));await button.focus();
  if(['stale-callback','refresh-callback','reconsult-callback'].includes(mode)){
   if(mode==='reconsult-callback'){await page.evaluate(()=>{[...document.querySelectorAll('[aria-labelledby="portfolio-overview-title"] button')].find(node=>node.textContent==='Actualizar resumen').click();window.__savedPortfolioClick();});await wait(page,'50 obras consultadas');assert.equal(project101Reads,0);}else if(mode==='stale-callback'){await page.evaluate(()=>window.__changePortfolioContext());await wait(page,'Empresa de cartera B');}else{await page.click('#workspace-refresh');await page.waitForFunction(()=>document.querySelector('#workspace-refresh')?.disabled===false&&!document.querySelector('[aria-labelledby="portfolio-overview-title"] article'));}
   await page.evaluate(()=>window.__savedPortfolioClick());await tick();assert.equal(project101Reads,0);await absent();assert.equal(reads.filter(row=>row.query.includes('portfolio=1')).length,mode==='reconsult-callback'?4:3);
  }else if(mode==='locked'){
   await page.evaluate(()=>[...document.querySelectorAll('button[aria-pressed]')].find(node=>node.textContent.includes('Obra listada 1')&&!node.textContent.includes('Obra listada 10')).click());await wait(page,'Actividad canónica 001');
   await page.evaluate(()=>document.querySelector('article[data-task-id="task-001"] button').click());await page.type('form[aria-labelledby="schedule-edit-title"] textarea','Borrador de navegación conservado');
   assert.equal(await button.evaluate(node=>node.disabled),true);await page.evaluate(()=>window.__savedPortfolioClick());await tick();assert.equal(project101Reads,0);assert.equal(await page.$eval('form[aria-labelledby="schedule-edit-title"] textarea',node=>node.value),'Borrador de navegación conservado');
   await click(page,'Cancelar');await click(page,'Abrir Resumen obra 101');await wait(page,'Actividad canónica 101 primera');assert.equal(project101Reads,1);
  }else{
   await page.keyboard.press('Enter');
   if(['stale-context','stale-project','unmount'].includes(mode)){
    for(let i=0;i<800&&!held.length;i++)await new Promise(resolve=>setTimeout(resolve,25));assert.equal(held.length,1);await absent();
    if(mode==='stale-context'){await page.evaluate(()=>window.__changePortfolioContext());await wait(page,'Empresa de cartera B');}
    else if(mode==='unmount'){await page.evaluate(()=>window.__unmountPortfolio());await wait(page,'Portfolio desmontado');}
    else{await page.evaluate(()=>[...document.querySelectorAll('button[aria-pressed]')].find(node=>node.textContent.includes('Obra listada 1')&&!node.textContent.includes('Obra listada 10')).click());await wait(page,'Actividad canónica 001');}
    await releaseHeld();await tick();assert.equal(project101Reads,1);assert.equal(await page.$$eval('article[data-task-id="task-101-a"]',nodes=>nodes.length),0);assert.equal(await page.$$eval('button[aria-pressed]',nodes=>nodes.filter(node=>node.textContent.includes('Obra canónica 101')).length),0);if(mode==='stale-project'){await page.waitForFunction(()=>window.__portfolioGuide?.projectId==='p-001');assert.equal(await page.evaluate(()=>window.__portfolioGuide.projectId),'p-001');}else assert.equal(await page.evaluate(()=>window.__portfolioGuide?.projectId||null),null);
   }else if(['401','403','404','503','retry503','wrong-scope','wrong-project','wrong-status'].includes(mode)){
    await page.waitForFunction(()=>{const node=document.querySelector('[aria-labelledby="workspace-title"] > [role="status"]');return Boolean(node?.textContent.trim())&&document.querySelector('#workspace-refresh')?.disabled===false;});await absent();assert.equal(project101Reads,1);await tick();assert.equal(project101Reads,1,'No automatic retry after denial/error');
    if(mode==='retry503'){await page.evaluate(()=>{window.__portfolioTokenEpoch=2;});await click(page,'Abrir Resumen obra 101');await wait(page,'Actividad canónica 101 primera');assert.equal(project101Reads,2);assert.equal(reads.at(-1).authorization,'Bearer synthetic-portfolio-A-2');}
    else if(['401','403'].includes(mode))assert.equal(await page.$$eval('[aria-labelledby="portfolio-overview-title"]',nodes=>nodes.length),0,'Authorization denial clears the account summary');
   }else{
    await wait(page,'Actividad canónica 101 primera');await page.waitForFunction(id=>window.__portfolioGuide?.projectId===id,{},projectId);assert.equal(project101Reads,1);assert.equal(await page.evaluate(()=>window.__portfolioGuide.projectId),projectId);assert.equal(await page.$eval('button[aria-pressed="true"]',node=>node.textContent.includes('Obra canónica 101')),true);assert.ok((await page.$eval('[aria-labelledby="schedule-title"]',node=>node.innerText)).includes('1 de 2 tareas'));
    await click(page,'Cargar más tareas');await wait(page,'Actividad canónica 101 segunda');assert.equal(project101Reads,2);assert.equal(await page.$$eval('article[data-task-id]',nodes=>nodes.length),2);assert.equal(await page.evaluate(()=>window.__portfolioGuide.projectId),projectId);
   }
  }
  await handle.dispose();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(writes,[]);assert.deepEqual(unexpected,[]);assert.deepEqual(await page.evaluate(()=>window.__portfolioIssuedIds),[]);assert.deepEqual(await page.evaluate(()=>[Object.keys(localStorage),Object.keys(sessionStorage)]),[[],[]]);
  portfolioIntegrationChecks.push({mode,width,project101Reads,thirdPage:true,authenticatedGetOnly:true,canonicalViewOnly:true,currentContextOnly:true,selectionAfterCanonicalRead:true,automaticRetry:false,uuidIssued:0,mutations:0,providerCalls:0,horizontalOverflow:false});
 }finally{await context.close();}
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
 for(const mode of ['expired-profile','profile-retry-unavailable','retry-not-authorized','initial-sdk-hung','session-hung','profile-hung','late-session-context','late-session-unmount','late-profile-unmount'])await scenario(mode);
 for(const width of [320,390,768,1280])await companySelectorContext(width);
for(const width of [320,390,768,1280])for(const mode of portfolioIntegrationModes)await portfolioThirdPage(mode,width);
for(const width of [320,390,768,1280])for(const mode of organizationLockModes)await organizationDraftProtection(mode,width);}
 for(const width of [320,390,768,1280])for(const mode of ['reload-committed','reload-not-committed','reload-denied','reload-other-actor','reload-missing-receipt'])await scenario(mode,width);
 if(!process.env.COMPANY_ONBOARDING_UI_SUITE){assert.equal(portfolioIntegrationChecks.length,64);assert.equal(new Set(portfolioIntegrationChecks.map(row=>row.mode+':'+row.width)).size,64);for(const row of portfolioIntegrationChecks)assert.equal(row.project101Reads,['success','retry503'].includes(row.mode)?2:['stale-callback','refresh-callback','reconsult-callback'].includes(row.mode)?0:1);}
 if(!process.env.COMPANY_ONBOARDING_UI_SUITE){assert.equal(organizationLockChecks.length,32);assert.equal(new Set(organizationLockChecks.map(row=>row.mode+':'+row.width)).size,32);for(const row of organizationLockChecks)assert.equal(row.postCount,['cancel','stale-observation'].includes(row.mode)?0:1);}
 assert.deepEqual(errors,[]);const proof={status:'PASS',environment:'actual-ui-with-intercepted-synthetic-services',checks,portfolioIntegration:{modes:portfolioIntegrationModes,widths:[320,390,768,1280],checks:portfolioIntegrationChecks,executed:!process.env.COMPANY_ONBOARDING_UI_SUITE},organizationDraftProtection:{modes:organizationLockModes,widths:[320,390,768,1280],checks:organizationLockChecks,executed:!process.env.COMPANY_ONBOARDING_UI_SUITE},sourceManifest,harnessSha256,widths:[320,390,768,1280],errors,profileExpiryVerification:'real-RS256-verifier-with-disposable-local-key-and-controlled-clock',sdkDeadlines:'controlled-accelerated-clock',realClerkLogin:false,physicalWhatsApp:false,productionDataWritten:false,documentCurveSourceManifest,fixtureTransforms:documentCurveFixtureTransforms};
 rmSync(path.join(output,'browser-failure.json'),{force:true});writeFileSync(path.join(output,'browser.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(error){writeFileSync(path.join(output,'browser-failure.json'),JSON.stringify({message:error.message,errors,log},null,2));throw error;}
finally{await browser?.close();try{if(process.platform!=='win32')process.kill(-server.pid,'SIGTERM');else server.kill();}catch{}await new Promise(done=>setTimeout(done,500));const resolved=realpathSync(dir);assert.equal(path.dirname(resolved),realpathSync(parent));assert.ok(path.basename(resolved).startsWith('company-bootstrap-ui-'));rmSync(resolved,{recursive:true,force:true});}
