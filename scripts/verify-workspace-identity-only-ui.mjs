import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,rmSync,existsSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {createServer} from 'node:net';
import {spawn,execFileSync} from 'node:child_process';
import puppeteer from 'puppeteer';
import {PARTICIPANT_NOTICE,PARTICIPANT_NOTICE_VERSION} from '../src/lib/participant-policy.mjs';
import {respondClosedCompanySubscription} from './lib/company-subscription-ui-fixture.mjs';

// Actual account/private identity components, isolated synthetic session/API.
// This proves UI restrictions and receipt behavior, never a customer login.
assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV);
const root=process.cwd(),evidence=path.resolve(root,'.vercel/workspace-identity-only-evidence');
const args=process.argv.slice(2);assert.ok(args.length===0||args.length===2&&args[0]==='--expected-head','Unsupported identity UI arguments');
const expectedHead=args[1]||process.env.GITHUB_SHA||null;
function sourceIdentity(){
 const sourceRevision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();assert.match(sourceRevision,/^[a-f0-9]{40}$/);
 const dirty=execFileSync('git',['diff','--name-only','HEAD','--'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim(),dirtyTrackedPaths=dirty?dirty.split(/\r?\n/):[];
 if(expectedHead){assert.equal(sourceRevision,expectedHead,'Exact identity UI source HEAD');assert.deepEqual(dirtyTrackedPaths,[],'Committed clean identity UI source');}
 return {sourceRevision,sourceState:expectedHead?'EXACT_CI_SOURCE':'LOCAL_REVIEW_SOURCE',trackedClean:dirtyTrackedPaths.length===0,dirtyTrackedPaths};
}
const identityBefore=sourceIdentity();
const sourceSnapshots=new Map();
function sourceBytes(relative){
 const working=readFileSync(path.join(root,relative)),digest=createHash('sha256').update(working).digest('hex');
 if(sourceSnapshots.has(relative))assert.equal(digest,sourceSnapshots.get(relative),'Working source changed during identity proof: '+relative);else sourceSnapshots.set(relative,digest);
 if(!expectedHead)return working;
 const committed=execFileSync('git',['show',expectedHead+':'+relative],{cwd:root,maxBuffer:8*1024*1024});
 const text=working.toString('utf8');assert.ok(working.equals(Buffer.from(text)),'Identity source must be valid UTF-8');
 assert.ok(Buffer.from(text.replaceAll('\r\n','\n')).equals(committed),'Working identity source differs from exact Git bytes: '+relative);
 return committed;
}
const harnessSha256=createHash('sha256').update(sourceBytes('scripts/verify-workspace-identity-only-ui.mjs')).digest('hex');
mkdirSync(evidence,{recursive:true});
const fixture=mkdtempSync(path.join(root,'.vercel/workspace-identity-only-ui-')),app=path.join(fixture,'src/app');
mkdirSync(app,{recursive:true});
const sha256=value=>createHash('sha256').update(value).digest('hex'),sourceManifest=[],manifested=new Set(),copied=new Set(),fixturePinned=new Set();
function recordSource(relative,bytes){
 if(manifested.has(relative))return;manifested.add(relative);sourceManifest.push({path:relative,sha256:sha256(bytes)});
}
function pinFixtureGraph(relative){
 relative=relative.split(/[\\/]/).join('/');
 if(fixturePinned.has(relative))return;assert.ok(relative.startsWith('scripts/')||relative.startsWith('src/'));
 fixturePinned.add(relative);const source=path.join(root,relative),bytes=sourceBytes(relative);recordSource(relative,bytes);
 for(const match of bytes.toString('utf8').matchAll(/\b(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)){
  const target=path.resolve(path.dirname(source),match[1]),resolved=[target,target+'.js',target+'.mjs',path.join(target,'index.js')].find(value=>existsSync(value)&&statSync(value).isFile());
  assert.ok(resolved,'Missing fixture source dependency '+match[1]);pinFixtureGraph(path.relative(root,resolved));
 }
}
pinFixtureGraph('scripts/lib/company-subscription-ui-fixture.mjs');
function copyGraph(relative){
 relative=relative.split(/[\\/]/).join('/');
 if(copied.has(relative))return;assert.ok(relative.startsWith('src'+path.sep)||relative.startsWith('src/'));
 copied.add(relative);const source=path.join(root,relative),destination=path.join(fixture,relative),bytes=sourceBytes(relative.replaceAll(path.sep,'/'));
 mkdirSync(path.dirname(destination),{recursive:true});writeFileSync(destination,bytes);
 recordSource(relative.replaceAll(path.sep,'/'),bytes);
 if(!/\.(?:js|mjs)$/.test(relative))return;
 for(const match of bytes.toString('utf8').matchAll(/\b(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)){
  const target=path.resolve(path.dirname(source),match[1]),resolved=[target,target+'.js',target+'.mjs',target+'.css',path.join(target,'index.js')].find(value=>existsSync(value)&&statSync(value).isFile());
  assert.ok(resolved,'Missing source dependency '+match[1]);copyGraph(path.relative(root,resolved));
 }
}
copyGraph('src/app/(identity)/cuenta/workspace-client.js');copyGraph('src/app/(identity)/cuenta/workspace-recovery-journal.mjs');copyGraph('src/lib/participant-policy.mjs');copyGraph('src/app/(identity)/cuenta/onboarding-guide.js');
writeFileSync(path.join(fixture,'package.json'),JSON.stringify({name:'isolated-workspace-identity-only-ui',private:true}));
writeFileSync(path.join(fixture,'next.config.mjs'),`export default {devIndicators:false,turbopack:{root:${JSON.stringify(root)}}};`);
writeFileSync(path.join(app,'layout.js'),`export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:12,background:'#0b1c2d',fontFamily:'Arial,sans-serif'}}>{children}</body></html>}`);
writeFileSync(path.join(app,'page.js'),`'use client';
import {useCallback,useEffect,useState} from 'react';
import {AccountWorkspace} from './(identity)/cuenta/workspace-client';
import {OnboardingGuide} from './(identity)/cuenta/onboarding-guide';
import {browserRecoveryJournal} from './(identity)/cuenta/workspace-recovery-journal.mjs';
export default function Page(){
 const [context,setContext]=useState('A'),[guideObservation,setGuideObservation]=useState(null);
 const observeGuide=useCallback(value=>setGuideObservation({context,value}),[context]);
 const initialProjectId=typeof window==='undefined'?'':new URL(window.location.href).searchParams.get('obra')||'';
 const token=useCallback(async()=>{const captured=context;if(window.__tokenMode==='hold'){window.__tokenMode='normal';await new Promise((resolve,reject)=>{window.__releaseToken=resolve;window.__rejectToken=()=>reject(new Error('CONTROLLED_OLD_TOKEN_REJECTION'));});}return 'synthetic-current-'+captured;},[context]);
 useEffect(()=>{window.__references=scope=>browserRecoveryJournal.list(scope);return()=>{delete window.__references;};},[]);
 return <main style={{maxWidth:1000,margin:'0 auto'}}><div><button onClick={()=>setContext('A')}>Contexto A</button><button onClick={()=>setContext('B')}>Contexto B</button></div><OnboardingGuide key={"guide-"+context} orgId={"fixture-"+context} orgRole="org:member" observation={guideObservation?.context===context?guideObservation.value:null}/><AccountWorkspace key={"workspace-"+context} getSessionToken={token} onGuideObservation={observeGuide} initialProjectId={initialProjectId}/></main>;
}`);
const picturePath=path.join(fixture,'synthetic.png');
// The positive photo is generated by the existing synthetic canvas fixture after browser startup.
const port=Number(process.env.WORKSPACE_IDENTITY_UI_PORT||3174);assert.ok(Number.isInteger(port)&&port>=3000&&port<=65535);
await new Promise((resolve,reject)=>{const probe=createServer();probe.once('error',reject);probe.listen(port,'127.0.0.1',()=>probe.close(error=>error?reject(error):resolve()));});
const origin='http://127.0.0.1:'+port;
const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',fixture,'--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'],windowsHide:true,detached:process.platform!=='win32'});
let serverLog='',browser,active,resultProof,serverClosed=false;
server.once('close',()=>{serverClosed=true;});
for(const stream of [server.stdout,server.stderr])stream.on('data',value=>{serverLog=(serverLog+value.toString()).slice(-20000);});
const scopeA='a'.repeat(64),scopeB='b'.repeat(64),revision='2026-10-01T11:00:00.000001',checks=[],destinationChecks=[],pageErrors=[],requestErrors=[],screenshots=[];
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitText(page,label){await page.waitForFunction(text=>document.body.innerText.includes(text),{timeout:15000},label);}
async function visibleElementClick(page,handle){
 // Open only necessary disclosures by clicking their visible native summary.
 // Never set details.open or bypass the rendered user navigation.
 for(let depth=0;depth<12;depth++){
  const summary=await page.evaluateHandle(node=>{let outer=null;const ownSummary=node.tagName==='SUMMARY'?node.parentElement:null;for(let parent=node.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS'&&!parent.open&&parent!==ownSummary)outer=parent;return outer?[...outer.children].find(child=>child.tagName==='SUMMARY')||null:null;},handle);
  const element=summary.asElement();if(!element){await summary.dispose();break;}
  assert.ok(await page.evaluate(node=>node.isConnected&&node.getClientRects().length>0&&!node.closest('[hidden],[inert],[aria-hidden="true"]'),element),'Disclosure summary must already be visible');await element.click();await summary.dispose();
 }
 assert.ok(await page.evaluate(node=>node.isConnected&&node.getClientRects().length>0&&!node.closest('[hidden],[inert],[aria-hidden="true"]'),handle),'Click target must be visible in the current screen');
 await handle.click();
}
async function click(page,label){
 const hiddenScreen=await page.evaluate(text=>{const matches=[...document.querySelectorAll('button')].filter(button=>!button.disabled&&(button.textContent.trim()===text||button.hasAttribute('aria-pressed')&&button.querySelector('span')?.textContent.trim()===text));if(matches.some(button=>!button.closest('[hidden]')))return null;return matches[0]?.closest('[data-workspace-screen]')?.dataset.workspaceScreen||null;},label);
 if(hiddenScreen){const id={identidad:'participant-title','mi-whatsapp':'worker-channel-title',cronograma:'schedule-title',recuperacion:'workspace-recovery-title'}[hiddenScreen];assert.ok(id,'Known real destination for '+label);await chooseWorkspaceView(page,id);}
 await page.waitForFunction(text=>[...document.querySelectorAll('button')].some(button=>!button.disabled&&!button.closest('[hidden]')&&(button.textContent.trim()===text||button.hasAttribute('aria-pressed')&&button.querySelector('span')?.textContent.trim()===text)),{timeout:15000},label);
 const handle=await page.evaluateHandle(text=>[...document.querySelectorAll('button')].find(button=>!button.disabled&&!button.closest('[hidden]')&&(button.textContent.trim()===text||button.hasAttribute('aria-pressed')&&button.querySelector('span')?.textContent.trim()===text)),label);
 await visibleElementClick(page,handle.asElement());await handle.dispose();
}
async function chooseWorkspaceView(page,id){
 const own='nav[aria-label="Mi participación en la obra"]';if(await page.$(own)){const anchor=await page.$(own+' a[href="#'+id+'"]');assert.ok(anchor,'Private destination must be listed');await visibleElementClick(page,anchor);await anchor.dispose();await page.waitForFunction(target=>document.activeElement?.id===target,{timeout:15000},id);return;}
 const menu='nav[aria-label="Navegación de la obra"]';if((await page.viewport()).width<1100)await page.select(menu+' select',id);else{const anchor=await page.$(menu+' a[href="#'+id+'"]');assert.ok(anchor);await visibleElementClick(page,anchor);await anchor.dispose();}
 await page.waitForFunction(target=>document.activeElement?.id===target,{timeout:15000},id);
}
async function settled(page){await page.waitForFunction(()=>document.querySelector('[aria-labelledby="workspace-title"]')?.getAttribute('aria-busy')==='false');}
async function identityOnly(page){
 await page.waitForSelector('#identity-access-title');await settled(page);
 assert.equal(await page.$('#participant-title')!==null,true);
 assert.equal(await page.$eval('#participant-title',node=>node.textContent),'Mi identidad');
 assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Revisá cada perfil'));
 for(const id of ['schedule-title','schedule-overview-title','workspace-tools-title','field-title','inventory-title','portfolio-overview-title','pending-receipts-title'])assert.equal(await page.$('#'+id),null,'Operational surface mounted before KYC: '+id);
 assert.equal(await page.$('[data-schedule-workbench]'),null);
 assert.equal(await page.$('nav[aria-label="Navegación de la obra"]'),null);
 assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Tarea operativa'));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow');
}
function newState(mode='pending'){
 return {mode,approved:false,denialStatus:403,denialCode:'PARTICIPANT_KYC_REVIEW_REQUIRED',denialType:'application/json',requests:[],posts:[],receiptQueries:[],receipts:new Map(),held:[],channelPosts:[],channelReceiptQueries:[],channelReceipts:new Map(),channelRows:new Map(),channelHold:null,channelLoseReply:false,channelDenied:null,channelApprovedDto:false,row:{id:'worker-fixture',name:'Persona de ensayo',active:true,revision,status:'ACTIVE',self:true,accountLinked:true,invitation:null,kycChatChallenge:null,permissions:{attendance:false,report:false},identityCertified:false,whatsAppAccessGranted:false,kyc:{status:'NOT_SUBMITTED',submissionId:null,submittedAt:null,review:null,images:[]}}};
}
function ownChannel(current,projectId){
 if(!current.channelRows.has(projectId))current.channelRows.set(projectId,{workerId:projectId==='p-a'?'worker-fixture':'worker-second',name:projectId==='p-a'?'Titular propio WhatsApp A':'Titular propio WhatsApp A2',revision,phone:'+5491100001111',state:'REVIEW_REQUIRED',eligible:false,connectionNumber:null,challenge:null,binding:{id:'binding-synthetic',verifiedAt:'2026-10-07T12:00:00Z',revokedAt:null},templateConsent:{granted:false,canGrant:false,canRevoke:true,state:'REVIEW_REQUIRED'},identityCertified:false});
 return current.channelRows.get(projectId);
}
async function createPage(width,current,sharedContext=null,{initialPath=''}={}){
 assert.ok(initialPath===''||initialPath==='/?obra=p-a#worker-channel-title','Only the controlled same-origin project hint is allowed');
 const context=sharedContext||await browser.createBrowserContext(),page=await context.newPage();active={width,current,page};const subscriptionReads=[];
 await page.setViewport({width,height:1050});page.on('pageerror',error=>pageErrors.push({width,mode:current.mode,error:error.message}));
 page.on('dialog',async dialog=>{assert.equal(dialog.type(),'beforeunload');current.acceptedReloadWarning=true;await dialog.accept();});
 await page.setRequestInterception(true);
 const answer=(request,status,value,type='application/json')=>request.respond({status,contentType:type,headers:{'Cache-Control':'no-store'},body:type==='application/json'?JSON.stringify(value):value});
 page.on('request',async request=>{
  try{
   const url=new URL(request.url());
   if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();throw Error('Unexpected external URL '+url.hostname);}
   if(!url.pathname.startsWith('/api/identity/'))return request.continue();
   const actor=request.headers().authorization==='Bearer synthetic-current-A'?'A':request.headers().authorization==='Bearer synthetic-current-B'?'B':null;
   assert.ok(actor,'Missing explicit controlled token');const scope=actor==='A'?scopeA:scopeB;
   const payload=request.method()==='POST'?JSON.parse(request.postData()):null;
   const projectId=url.searchParams.get('projectId')||payload?.projectId;
   if(url.searchParams.has('scope'))assert.equal(url.searchParams.get('scope'),scope,'Crossed active organization');
   current.requests.push({path:url.pathname,method:request.method(),actor,projectId,operationId:url.searchParams.get('operationId')});
   if(await respondClosedCompanySubscription(request,{origin,scope,authorization:'Bearer synthetic-current-'+actor,allowed:current.mode==='bootstrap',reads:subscriptionReads}))return;
   if(url.pathname==='/api/identity/worker-channel'){
    assert.equal(actor,'A');assert.ok(['p-a','p-a2'].includes(projectId));
    if(current.channelDenied)return answer(request,current.channelDenied.status,{code:current.channelDenied.code});
    const row=ownChannel(current,projectId),operationId=url.searchParams.get('operationId');
    if(request.method()==='GET'){
     if(operationId){current.channelReceiptQueries.push(operationId);return answer(request,200,current.channelReceipts.get(operationId)||{scope,projectId,state:'NOT_OBSERVED',saved:false,definitive:false,codeReturnedByStatus:false});}
     if(current.channelHold==='read'&&projectId==='p-a')await new Promise(resolve=>current.held.push(resolve));
     const record=current.channelApprovedDto?{...row,state:'VERIFIED',eligible:true,connectionNumber:'+5491100002222',challenge:{id:'unexpected-code',expiresAt:new Date(Date.now()+300000).toISOString(),expired:false},templateConsent:{...row.templateConsent,granted:true,canGrant:true}}:row;
     return answer(request,200,{scope,projectId,channelReady:current.channelApprovedDto,records:[record],truncated:false,codeReturnedByStatus:false});
    }
    assert.equal(request.method(),'POST');assert.deepEqual(Object.keys(payload).sort(),['action','operationId','payload','projectId','scope']);assert.equal(payload.scope,scope);assert.ok(['REVOKE_TEMPLATE_MESSAGES','UNLINK'].includes(payload.action));assert.equal(payload.payload.workerId,row.workerId);assert.equal(payload.payload.revision,row.revision);assert.match(payload.operationId,/^[a-f0-9-]{36}$/);
    assert.deepEqual(Object.keys(payload.payload).sort(),payload.action==='UNLINK'?['reason','revision','workerId']:['revision','workerId']);if(payload.action==='UNLINK')assert.ok(payload.payload.reason.length>=8);
    current.channelPosts.push(payload);row.revision='2026-10-01T11:00:00.000002';row.templateConsent={...row.templateConsent,canRevoke:false,state:'REVOKED',granted:false};if(payload.action==='UNLINK'){row.state='UNLINKED';row.binding={...row.binding,revokedAt:'2026-10-07T12:10:00Z'};}
    const result={scope,projectId,state:'RECORDED',saved:true,replayed:false,receiptId:'worker_channel_'+sha256(payload.operationId),kind:payload.action,participant:{...row}};current.channelReceipts.set(payload.operationId,{...result,replayed:true});
    if(current.channelHold==='post')await new Promise(resolve=>current.held.push(resolve));
    return current.channelLoseReply?answer(request,503,{code:'CONTROLLED_RESPONSE_LOST'}):answer(request,200,result);
   }
   if(url.pathname==='/api/identity/workspace'){
    assert.equal(request.method(),'GET');
    if(current.workspaceReadBarrier)await current.workspaceReadBarrier({url,actor,scope,projectId,method:request.method()});
    if(current.destinationPaging===true&&projectId)(current.destinationProjectReads??=[]).push({actor,projectId,afterTask:url.searchParams.get('afterTask')});
    if(!projectId)return answer(request,200,{scope,organizationName:'Empresa de ensayo '+actor,role:current.mode==='bootstrap'?'ADMIN':current.mode==='director'?'DIRECTOR':'AUDITOR',roleLabel:current.mode==='bootstrap'?'Administrador':current.mode==='director'?'Director':'Consulta',canManageIntegrations:false,projects:actor==='A'?[{id:'p-a',name:'Obra A',status:'ACTIVE'},{id:'p-a2',name:'Obra A2',status:'ACTIVE'}]:[{id:'p-b',name:'Obra B',status:'ACTIVE'}]});
    if(current.mode==='late-project'&&projectId==='p-a'||current.mode==='late-company'&&actor==='A'||current.holdWorkspaceProject===projectId||current.holdWorkspacePage===projectId&&url.searchParams.has('afterTask')){
     await new Promise(resolve=>current.held.push(resolve));
    }
    if(actor==='B'||projectId==='p-a2'&&current.mode==='late-project'||current.approved&&projectId==='p-a'||current.approvedProjects?.includes(projectId)){
     const task={id:'t-'+projectId,title:'Tarea operativa '+projectId,status:'IN_PROGRESS',progress:37,startsOn:'2026-10-01',endsOn:'2026-10-05',revision};
     if(current.destinationPaging===true){const after=url.searchParams.get('afterTask'),pageIndex=after?after.endsWith('-second')?2:1:0,record=pageIndex===0?task:{...task,id:task.id+(pageIndex===1?'-second':'-third'),title:task.title+(pageIndex===1?' segunda página':' tercera página')};return answer(request,200,{scope,project:{id:projectId,name:'Obra A',status:'ACTIVE'},roleLabel:'Consulta',canPlanSchedule:false,tasks:[record],totalTasks:3,nextCursor:pageIndex<2?record.id:null});}
     return answer(request,200,{scope,project:{id:projectId,name:actor==='B'?'Obra B':projectId==='p-a2'?'Obra A2':'Obra A',status:'ACTIVE'},roleLabel:'Consulta',canPlanSchedule:false,tasks:[task],totalTasks:current.mode==='revoke'?2:1,nextCursor:current.mode==='revoke'?task.id:null});
    }
    return answer(request,current.denialStatus,current.denialType==='application/json'?{code:current.denialCode,scope:scopeB,projectId:'untrusted-project',tasks:[{title:'MUST NEVER RENDER'}]}:'<html>Gateway denial</html>',current.denialType);
   }
   if(url.pathname==='/api/identity/participants'){
    assert.equal(scope,scopeA);assert.ok(['p-a','p-a2'].includes(projectId));
    if(projectId==='p-a2'){assert.equal(request.method(),'GET');assert.equal(url.searchParams.has('operationId'),false);return answer(request,200,{scope,projectId,canManage:false,canInvite:false,canManageOfficeRoles:false,existingAccounts:[],records:[{...current.row,id:'worker-second',name:'Perfil propio de segunda obra',kyc:current.secondKycApproved?current.row.kyc:{status:'NOT_SUBMITTED',submissionId:null,images:[]}}],nextCursor:null,privacyNotice:{version:PARTICIPANT_NOTICE_VERSION,text:PARTICIPANT_NOTICE}});}
    if(current.mode==='revoked-own')return answer(request,403,{code:'PARTICIPANT_ACCESS_REQUIRED'});
    if(request.method()==='POST'){
     assert.equal(payload.action,undefined);assert.equal(payload.scope,scopeA);assert.equal(payload.workerId,'worker-fixture');assert.equal(payload.consent,true);assert.match(payload.front,/^data:image\/png;base64,/);assert.match(payload.selfie,/^data:image\/png;base64,/);
     current.posts.push(payload);current.row={...current.row,kyc:{...current.row.kyc,status:'PENDING_REVIEW',submissionId:'kyc-fixture',submittedAt:'2026-10-07T12:00:00Z'}};
     current.receipts.set(payload.operationId,{scope,projectId,state:'RECORDED',saved:true,replayed:true,receiptId:'participant_'+payload.operationId,participant:current.row});
     return answer(request,503,{code:'PARTICIPANT_OPERATION_UNCONFIRMED'});
    }
    if(url.searchParams.has('operationId')){const id=url.searchParams.get('operationId');current.receiptQueries.push(id);assert.ok(current.receipts.has(id));return answer(request,200,current.receipts.get(id));}
    if(current.destinationHoldProfile===true)await new Promise(resolve=>{(current.destinationHeldProfile??=[]).push(resolve);current.destinationProfileObserved?.();});
    return answer(request,200,{scope,projectId,canManage:false,canInvite:false,canManageOfficeRoles:false,existingAccounts:[],records:[current.row],nextCursor:null,privacyNotice:{version:PARTICIPANT_NOTICE_VERSION,text:PARTICIPANT_NOTICE}});
   }
   if(url.pathname==='/api/identity/portfolio-overview')return answer(request,200,{scope,records:[],nextCursor:null});
   // No operational module may fetch during the private-only state.
   return answer(request,503,{code:'CONTROLLED_MODULE_UNAVAILABLE'});
  }catch(error){requestErrors.push({mode:current.mode,message:error.message});try{await request.abort();}catch{}}
 });
 await page.goto(origin+initialPath,{waitUntil:initialPath?'domcontentloaded':'networkidle0'});await waitText(page,'Empresa de ensayo A');assert.equal(subscriptionReads.length,current.mode==='bootstrap'?1:0,'Only the bootstrap administrator consults closed subscription status');return {context,page};
}
async function references(page){return page.evaluate(async scopes=>({a:await window.__references(scopes[0]),b:await window.__references(scopes[1]),session:Object.values(sessionStorage),local:Object.values(localStorage)}),[scopeA,scopeB]);}
function safeReferences(value,expected){
 assert.equal(value.a.length,expected);assert.equal(value.b.length,0);
 for(const row of value.a)assert.deepEqual(Object.keys(row).sort(),['createdAt','operationId','projectId','resource','scope','version']);
 assert.doesNotMatch(JSON.stringify(value),/data:image|Bearer |synthetic-current-|front|selfie|payload|Persona de ensayo/i);
}
async function waitRecordedTask(page,label){
 await page.waitForFunction(text=>document.querySelector('[data-schedule-workbench]')?.textContent.includes(text),{timeout:15000},label);
}
async function prepareOwn(page,{consult=true}={}){
 if(consult)await click(page,'Consultar mi identidad');await waitText(page,'Persona de ensayo');await click(page,'Presentar mi identidad');
 for(const [title,label]of [['Frente del documento','Usar documento revisado'],['Fotografía del rostro','Usar fotografía revisada']]){
  const selector='fieldset[aria-label="'+title+'"]';await (await page.$(selector+' input[type=file]')).uploadFile(picturePath);await page.waitForSelector(selector+' img');await page.$eval(selector+' input[type=checkbox]',input=>input.click());await click(page,label);
  await page.waitForFunction(title=>[...document.querySelectorAll('fieldset')].find(field=>field.getAttribute('aria-label')===title)?.textContent.includes('Imagen revisada y lista'),{},title);
  if(title==='Frente del documento'){await click(page,'Continuar al dorso');await click(page,'Continuar sin dorso');}
 }
 await page.evaluate(()=>[...document.querySelectorAll('label')].find(label=>label.textContent.includes('Leí el aviso y autorizo presentar estas imágenes')).querySelector('input').click());
}
async function presentOwn(page){await prepareOwn(page);await click(page,'Presentar para revisión');await waitText(page,'El resultado quedó sin confirmar');
}
function canonicalAdmissionReads(current){
 const facts=[],gates=new Map();let phase=null;const posts=current.posts.length,channelPosts=current.channelPosts.length;
 for(const name of ['AUTHORITY','LIVE_INITIAL','APPEND','POST_APPEND_LIVE']){let observe,release;const seen=new Promise(resolve=>observe=resolve),held=new Promise(resolve=>release=resolve);gates.set(name,{seen,held,observe,release});}
 const expected=name=>({phase:name,path:'/api/identity/workspace',method:'GET',actor:'A',scope:scopeA,projectId:'p-a',query:[...(name==='APPEND'?[['afterTask','t-p-a']]:[]),['projectId','p-a'],['scope',scopeA]]});
 current.workspaceReadBarrier=async({url,actor,scope,projectId,method})=>{
  assert.ok(['AUTHORITY','LIVE_INITIAL','APPEND','POST_APPEND_LIVE'].includes(phase),'An unplanned workspace read must not pass the phase ledger');assert.equal(facts.some(row=>row.phase===phase),false,'Exactly one workspace GET is allowed in each phase');
  const fact={phase,path:url.pathname,method,actor,scope,projectId,query:[...url.searchParams].sort(([a],[b])=>a.localeCompare(b))};assert.deepEqual(fact,expected(phase));facts.push(fact);const gate=gates.get(phase);gate.observe();if(phase!=='APPEND')await gate.held;
 };
 return {activate(name){assert.ok(gates.has(name));phase=name;},release(name){gates.get(name).release();},async observed(name){let timeout;try{await Promise.race([gates.get(name).seen,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('No canonical workspace GET observed in phase '+name)),15000);})]);}finally{clearTimeout(timeout);}},finish(names){assert.deepEqual(facts,names.map(expected));assert.equal(current.posts.length,posts,'Admission/readback phases never add a participant POST');assert.equal(current.channelPosts.length,channelPosts,'Admission/readback phases never add a channel POST');phase=null;},dispose(){delete current.workspaceReadBarrier;for(const gate of gates.values())gate.release();}};
}
async function noOperativeSurface(page){assert.equal(await page.$('[data-schedule-workbench]'),null,'No schedule workbench may mount before the canonical authority response');assert.equal(await page.$('#field-title'),null,'No field surface may mount before the canonical authority response');assert.equal(await page.$$eval('[data-task-id]',nodes=>nodes.length),0,'No task data may mount before canonical authority');}
async function scheduleRefreshState(page,state){await page.waitForSelector('section[aria-labelledby="workspace-title"] > [data-worksite-live-refresh="'+state+'"]',{timeout:15000});}
async function privateFlow(width,{reload=false,director=false}={}){
 const current=newState(director?'director':'pending'),{context,page}=await createPage(width,current);
 await click(page,'Obra A');await identityOnly(page);
 const privateScreenshot=path.join(evidence,'identity-private-'+width+(reload?'-reload':director?'-director':'')+'.png');await page.screenshot({path:privateScreenshot,fullPage:true});screenshots.push(path.relative(root,privateScreenshot).split(path.sep).join('/'));
 assert.deepEqual(current.requests.map(row=>row.path),['/api/identity/workspace','/api/identity/workspace','/api/identity/participants']);
 assert.deepEqual(current.requests.at(-1),{path:'/api/identity/participants',method:'GET',actor:'A',projectId:'p-a',operationId:null});
 await presentOwn(page);await identityOnly(page);safeReferences(await references(page),1);assert.equal(current.posts.length,1);
 assert.ok(!current.requests.some(row=>!['/api/identity/workspace','/api/identity/participants'].includes(row.path)));
 if(reload){await page.reload({waitUntil:'networkidle0'});assert.equal(current.acceptedReloadWarning,true);await waitText(page,'Empresa de ensayo A');await click(page,'Obra A');await identityOnly(page);await waitText(page,'Comprobar el mismo intento');assert.equal(current.receiptQueries.length,0);safeReferences(await references(page),1);}
 await click(page,'Comprobar el mismo intento');await waitText(page,reload?'Recibo confirmado':'Operación guardada con recibo');assert.equal(current.posts.length,1);assert.deepEqual(current.receiptQueries,[current.posts[0].operationId]);safeReferences(await references(page),0);
 await click(page,'Consultar mi identidad');await waitText(page,'Pendiente de revisión humana');await identityOnly(page);
 current.row={...current.row,kyc:{...current.row.kyc,status:'APPROVED',review:{decision:'APPROVED',reason:'Controlled human acceptance',reviewedAt:'2026-10-07T12:05:00Z'}}};
 await click(page,'Consultar mi identidad');await waitText(page,'Aprobado por un responsable');await identityOnly(page);
 const operativeBefore=current.requests.filter(row=>row.path==='/api/identity/workspace'&&row.projectId).length;
 const admission=canonicalAdmissionReads(current);try{admission.activate('AUTHORITY');current.approved=true;await click(page,'Comprobar habilitación de obra');await admission.observed('AUTHORITY');await noOperativeSurface(page);admission.activate('LIVE_INITIAL');admission.release('AUTHORITY');await admission.observed('LIVE_INITIAL');await waitRecordedTask(page,'Tarea operativa p-a');await scheduleRefreshState(page,'CONSULTING');admission.release('LIVE_INITIAL');await scheduleRefreshState(page,'CURRENT');
 await page.waitForSelector('nav[aria-label="Navegación de la obra"]');assert.equal(await page.$('#identity-access-title'),null);
 assert.equal(await page.$eval('#participant-title',node=>node.textContent),'Participantes y revisión de identidad','Private presentation hint changed the normal workspace');
 admission.finish(['AUTHORITY','LIVE_INITIAL']);assert.equal(current.requests.filter(row=>row.path==='/api/identity/workspace'&&row.projectId).length,operativeBefore+2,'Approval requires exactly one explicit authority GET followed by one initial live GET');}finally{admission.dispose();}
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const screenshot=path.join(evidence,'identity-approved-'+width+(reload?'-reload':director?'-director':'')+'.png');await page.screenshot({path:screenshot,fullPage:true});screenshots.push(path.relative(root,screenshot).split(path.sep).join('/'));
 await click(page,'Obra A2');await identityOnly(page);await click(page,'Consultar mi identidad');await waitText(page,'Perfil propio de segunda obra');assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Persona de ensayo'));await identityOnly(page);
 checks.push({name:'private-identity-submission-uncertain-receipt-and-explicit-approval-refresh',width,reload,director,posts:current.posts.length,receiptGets:current.receiptQueries.length});await context.close();
}
async function administratorBootstrap(){
 const current=newState('bootstrap');current.approved=true;current.row=null;const {context,page}=await createPage(390,current);
 await click(page,'Obra A');await waitRecordedTask(page,'Tarea operativa p-a');assert.equal(await page.$('#identity-access-title'),null);assert.equal(current.posts.length,0);assert.ok(!(current.requests.some(row=>row.path==='/api/identity/participants')));
 checks.push({name:'bootstrap-administrator-without-worker-keeps-server-authorized-operation',width:390});await context.close();
}
async function denial(width,{status=403,code='WORKSPACE_PROJECT_UNAVAILABLE',type='application/json'}={}){
 const current=newState('generic-denial');Object.assign(current,{denialStatus:status,denialCode:code,denialType:type});const {context,page}=await createPage(width,current);
 await click(page,'Obra A');await settled(page);assert.equal(await page.$('#identity-access-title'),null);assert.equal(await page.$('#participant-title'),null);
 if(status===401||status===403||code==='WORKSPACE_CONTEXT_CHANGED')assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Empresa de ensayo A'));
 assert.equal(current.requests.length,2);checks.push({name:'noncanonical-denial-cannot-open-private-or-operative-ui',width,status,code,type});await context.close();
}
// Reduced pagination below is deliberately invalid for live reconciliation (1 row with a cursor); STALE must retain data before the explicit access-denied read.
async function revocation(width,{ownDenied=false}={}){
 const current=newState('revoke');current.approved=true;const {context,page}=await createPage(width,current);
 await click(page,'Obra A');await waitRecordedTask(page,'Tarea operativa p-a');await scheduleRefreshState(page,'STALE');current.approved=false;if(ownDenied)current.mode='revoked-own';
 await click(page,'Cargar más tareas');await identityOnly(page);assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Tarea operativa p-a'));
 await click(page,'Consultar mi identidad');if(ownDenied){await waitText(page,'No hay un acceso activo vinculado a tu cuenta');assert.equal(await page.$('article'),null);assert.equal(await page.$('form'),null);}else await waitText(page,'Persona de ensayo');
 await identityOnly(page);checks.push({name:'revoked-workspace-hides-loaded-tasks-and-only-own-private-read-remains',width,ownDenied});await context.close();
}
async function lateResponse(width,company){
 const current=newState(company?'late-company':'late-project'),{context,page}=await createPage(width,current);
 await click(page,'Obra A');await page.waitForFunction(()=>document.querySelector('[aria-labelledby="workspace-title"]')?.getAttribute('aria-busy')==='true');
 for(let attempt=0;!current.held.length&&attempt<50;attempt++)await pause(20);assert.equal(current.held.length,1);
 if(company){await click(page,'Contexto B');await waitText(page,'Empresa de ensayo B');await click(page,'Obra B');await waitRecordedTask(page,'Tarea operativa p-b');}
 else{await click(page,'Obra A2');await waitRecordedTask(page,'Tarea operativa p-a2');}
 await chooseWorkspaceView(page,'schedule-title');await waitText(page,company?'Tarea operativa p-b':'Tarea operativa p-a2');
 current.held.shift()();await pause(150);assert.equal(await page.$('#identity-access-title'),null);assert.ok((await page.evaluate(()=>document.body.innerText)).includes(company?'Tarea operativa p-b':'Tarea operativa p-a2'));
 checks.push({name:company?'late-prior-company-response-cannot-restore-private-context':'late-prior-project-denial-cannot-replace-authorized-project',width});await context.close();
}
async function tokenHeld(width){
 const current=newState('held-token'),{context,page}=await createPage(width,current);await page.evaluate(()=>{window.__tokenMode='hold';});
 await click(page,'Obra A');await page.waitForFunction(()=>typeof window.__releaseToken==='function');assert.equal(current.requests.filter(row=>row.projectId==='p-a').length,0);
 await click(page,'Contexto B');await waitText(page,'Empresa de ensayo B');await page.evaluate(()=>window.__releaseToken());await pause(150);
 assert.equal(current.requests.filter(row=>row.projectId==='p-a').length,0);assert.equal(await page.$('#identity-access-title'),null);
 await click(page,'Obra B');await waitRecordedTask(page,'Tarea operativa p-b');checks.push({name:'token-held-prior-company-never-dispatches-after-context-change',width});await context.close();
}
async function privacyDisclosure(page,open){await chooseWorkspaceView(page,open?'worker-channel-title':'participant-title');}

async function privacySurface(page){
 await identityOnly(page);await privacyDisclosure(page,true);await page.waitForSelector('#worker-channel-title',{visible:true});
}
async function restrictedChannel(page,{loaded=true}={}){
 await identityOnly(page);
 const text=await page.$eval('[aria-labelledby="worker-channel-title"]',node=>node.innerText);
 const paragraphContrasts=await page.$eval('[aria-labelledby="worker-channel-title"]',panel=>{
  const luminance=color=>{const rgb=color.match(/[\d.]+/g).slice(0,3).map(value=>Number(value)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
  return [...panel.querySelectorAll('p')].filter(node=>node.textContent.trim()).map(node=>{const foreground=luminance(getComputedStyle(node).color);let background=node;while(background.parentElement&&getComputedStyle(background).backgroundColor==='rgba(0, 0, 0, 0)')background=background.parentElement;const surface=luminance(getComputedStyle(background).backgroundColor);return {text:node.textContent.slice(0,50),ratio:(Math.max(foreground,surface)+.05)/(Math.min(foreground,surface)+.05)};});
 });
 for(const paragraph of paragraphContrasts)assert.ok(paragraph.ratio>=4.5,'Own privacy paragraph unreadable: '+paragraph.text+' contrast='+paragraph.ratio);
 assert.ok(await page.$eval('nav[aria-label="Mi participación en la obra"] a[href="#worker-channel-title"]',node=>node.getBoundingClientRect().height>=44),'Own privacy navigation needs a44px touch target');
 for(const forbidden of ['Generar código','Generar otro código','Revisar autorización de avisos','Guardar autorización','Continuar en WhatsApp','Copiar MENU','VINCULAR '])assert.ok(!text.includes(forbidden),'Activation action visible in own privacy: '+forbidden);
 assert.equal(await page.$('[aria-labelledby="worker-channel-title"] a[href*="wa.me"]'),null);assert.equal(await page.$('[aria-labelledby="worker-channel-title"] code'),null);
 if(loaded){const ids=await page.$$eval('[data-worker-channel]',nodes=>nodes.map(node=>node.getAttribute('data-worker-channel')));assert.deepEqual(ids,['worker-fixture']);assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Other worker'));}
}
async function startPrivacy(width,status='PENDING_REVIEW'){
 const current=newState('privacy-'+status);current.row.kyc={...current.row.kyc,status};
 const value=await createPage(width,current);await click(value.page,'Obra A');await privacySurface(value.page);return {current,...value};
}
async function withdraw(page,action){
 if(action==='REVOKE_TEMPLATE_MESSAGES')return click(page,'Retirar autorización de avisos');
 await click(page,'Desvincular mi WhatsApp');await page.type('[aria-labelledby="worker-channel-title"] textarea','Retiro mi vínculo de esta obra.');await click(page,'Confirmar desvinculación');
}
async function privacyWithdrawal(width,status,action,{reload=false}={}){
 const {current,context,page}=await startPrivacy(width,status);current.channelLoseReply=reload;
 await click(page,'Consultar vinculación');await waitText(page,'Titular propio WhatsApp A');await restrictedChannel(page);assert.equal(ownChannel(current,'p-a').eligible,false);assert.equal(ownChannel(current,'p-a').templateConsent.canGrant,false);
 await withdraw(page,action);
 if(reload){
  const expectedMetadata=[{path:'/api/identity/participants',method:'GET',actor:'A',projectId:'p-a',operationId:null}],metadataReads=()=>current.requests.filter(row=>row.path==='/api/identity/participants'),assertChannelScreen=async()=>assert.deepEqual(await page.evaluate(()=>({hash:location.hash,identityHidden:document.querySelector('[data-workspace-screen="identidad"]').hidden,whatsappHidden:document.querySelector('[data-workspace-screen="mi-whatsapp"]').hidden})),{hash:'#worker-channel-title',identityHidden:true,whatsappHidden:false});
  await assertChannelScreen();assert.deepEqual(metadataReads(),expectedMetadata,'Only the initially active identity screen has read own metadata');
  await waitText(page,'La operación necesita un comprobante');assert.equal(current.channelPosts.length,1);safeReferences(await references(page),1);
  await page.reload({waitUntil:'networkidle0'});await waitText(page,'Empresa de ensayo A');await click(page,'Obra A');await privacySurface(page);await waitText(page,'La operación necesita un comprobante');
  await assertChannelScreen();assert.deepEqual(metadataReads(),expectedMetadata,'Reload into WhatsApp must not query the hidden identity screen');
  assert.equal(current.channelPosts.length,1);assert.deepEqual(current.channelReceiptQueries,[]);safeReferences(await references(page),1);
  await click(page,'Consultar resultado pendiente');await waitText(page,'Recibo confirmado');assert.deepEqual(current.channelReceiptQueries,[current.channelPosts[0].operationId]);safeReferences(await references(page),0);
  await click(page,'Consultar vinculación');await waitText(page,'Titular propio WhatsApp A');await assertChannelScreen();assert.deepEqual(metadataReads(),expectedMetadata,'Receipt recovery and explicit channel read must not query hidden identity');
 }else await waitText(page,action==='UNLINK'?'WhatsApp desvinculado.':'Autorización retirada.');
 await restrictedChannel(page);assert.equal(current.channelPosts.length,1);assert.equal(current.channelPosts[0].action,action);assert.ok(!current.requests.some(row=>!['/api/identity/workspace','/api/identity/worker-channel','/api/identity/participants'].includes(row.path)));assert.deepEqual(current.requests.filter(row=>row.path==='/api/identity/participants'),[{path:'/api/identity/participants',method:'GET',actor:'A',projectId:'p-a',operationId:null}],'Exactly the initial active identity GET is allowed; WhatsApp-only reload never reads hidden identity');
 const screenshot=path.join(evidence,'privacy-'+status+'-'+action+'-'+width+(reload?'-reload':'')+'.png');await page.screenshot({path:screenshot,fullPage:true});screenshots.push(path.relative(root,screenshot).split(path.sep).join('/'));
 checks.push({name:reload?'own-withdrawal-lost-response-reload-recovers-same-UUID-without-second-POST':'own-private-withdrawal-without-KYC-admission',width,status,action,reload,posts:current.channelPosts.length,receiptGets:current.channelReceiptQueries.length,...(reload?{sameOperationId:true,durableReference:true}:{})});await context.close();
}
async function privacyLateApproved(width){
 const {current,context,page}=await startPrivacy(width);current.channelHold='read';await click(page,'Consultar vinculación');for(let i=0;!current.held.length&&i<100;i++)await pause(20);assert.equal(current.held.length,1);
 current.channelApprovedDto=true;current.held.shift()();await waitText(page,'Titular propio WhatsApp A');await restrictedChannel(page);assert.equal(current.channelPosts.length,0);assert.equal(current.requests.filter(row=>row.path==='/api/identity/workspace'&&row.projectId).length,1);
 checks.push({name:'late-approved-channel-DTO-never-exposes-codes-grant-chat-or-workspace',width});await context.close();
}
async function privacyLateContext(width,company){
 const {current,context,page}=await startPrivacy(width);current.channelHold='read';await click(page,'Consultar vinculación');for(let i=0;!current.held.length&&i<100;i++)await pause(20);assert.equal(current.held.length,1);
 if(company){await click(page,'Contexto B');await waitText(page,'Empresa de ensayo B');await click(page,'Obra B');await waitRecordedTask(page,'Tarea operativa p-b');}
 else{await click(page,'Obra A2');await privacySurface(page);await click(page,'Consultar vinculación');await waitText(page,'Titular propio WhatsApp A2');}
 current.held.shift()();await pause(150);assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Titular propio WhatsApp A\n'));assert.equal(current.channelPosts.length,0);
 const ids=await page.$$eval('[data-worker-channel]',nodes=>nodes.map(node=>node.getAttribute('data-worker-channel')));assert.deepEqual(ids,company?[]:['worker-second']);
 checks.push({name:company?'late-channel-read-cannot-cross-account':'late-channel-read-cannot-cross-project',width});await context.close();
}
async function privacyHeldToken(width){
 const {current,context,page}=await startPrivacy(width);await click(page,'Consultar vinculación');await waitText(page,'Titular propio WhatsApp A');await page.evaluate(()=>{window.__tokenMode='hold';});await withdraw(page,'REVOKE_TEMPLATE_MESSAGES');await page.waitForFunction(()=>typeof window.__releaseToken==='function');assert.equal(current.channelPosts.length,0);
 await click(page,'Contexto B');await waitText(page,'Empresa de ensayo B');await page.evaluate(()=>window.__releaseToken());await pause(150);assert.equal(current.channelPosts.length,0);safeReferences(await references(page),0);assert.equal(await page.$('#identity-access-title'),null);
 checks.push({name:'withdrawal-held-token-cancels-before-POST-on-account-change',width});await context.close();
}
async function privacyLatePost(width){
 const {current,context,page}=await startPrivacy(width);await click(page,'Consultar vinculación');await waitText(page,'Titular propio WhatsApp A');current.channelHold='post';await withdraw(page,'REVOKE_TEMPLATE_MESSAGES');for(let i=0;!current.held.length&&i<100;i++)await pause(20);assert.equal(current.held.length,1);assert.equal(current.channelPosts.length,1);
 await click(page,'Contexto B');await waitText(page,'Empresa de ensayo B');current.held.shift()();await pause(150);safeReferences(await references(page),1);assert.equal(await page.$('[data-worker-channel]'),null);
 await click(page,'Contexto A');await waitText(page,'Empresa de ensayo A');await click(page,'Obra A');await privacySurface(page);await waitText(page,'La operación necesita un comprobante');assert.deepEqual(current.channelReceiptQueries,[]);
 await click(page,'Consultar resultado pendiente');await waitText(page,'Recibo confirmado');assert.deepEqual(current.channelReceiptQueries,[current.channelPosts[0].operationId]);assert.equal(current.channelPosts.length,1);safeReferences(await references(page),0);
 checks.push({name:'dispatched-withdrawal-account-change-keeps-durable-receipt-without-rePOST',width});await context.close();
}
async function privacyAccessDenied(width,status,code){
 const {current,context,page}=await startPrivacy(width);await click(page,'Consultar vinculación');await waitText(page,'Titular propio WhatsApp A');current.channelDenied={status,code};await click(page,'Consultar vinculación');await page.waitForFunction(()=>document.querySelector('[data-worker-channel]')===null);
 await restrictedChannel(page,{loaded:false});assert.equal(await page.$('[aria-labelledby="worker-channel-title"] form'),null);assert.equal(current.channelPosts.length,0);checks.push({name:'revoked-private-channel-assignment-or-membership-hides-current-records',width,status,code});await context.close();
}
async function privacyPostDenied(width){
 const {current,context,page}=await startPrivacy(width);await click(page,'Consultar vinculación');await waitText(page,'Titular propio WhatsApp A');current.channelDenied={status:404,code:'WORKSPACE_PROJECT_UNAVAILABLE'};await withdraw(page,'REVOKE_TEMPLATE_MESSAGES');await waitText(page,'La operación necesita un comprobante');await page.waitForFunction(()=>document.querySelector('[data-worker-channel]')===null);safeReferences(await references(page),1);
 const ref=(await references(page)).a[0];assert.equal(current.channelPosts.length,0);current.channelDenied=null;await click(page,'Consultar resultado pendiente');await waitText(page,'Todavía no aparece el comprobante');assert.deepEqual(current.channelReceiptQueries,[ref.operationId]);safeReferences(await references(page),1);assert.equal(current.channelPosts.length,0);
 await restrictedChannel(page,{loaded:false});checks.push({name:'canonical-project-404-after-withdrawal-dispatch-keeps-UUID-and-receipt-reference',width,sameOperationId:true,durableReference:true,receiptGets:current.channelReceiptQueries.length});await context.close();
}
async function privacyReferenceDenied(width){
 const {current,context,page}=await startPrivacy(width);await click(page,'Consultar vinculación');await waitText(page,'Titular propio WhatsApp A');
 const second=await createPage(width,current,context);await click(second.page,'Obra A');await privacySurface(second.page);await click(second.page,'Consultar vinculación');await waitText(second.page,'Titular propio WhatsApp A');
 current.channelLoseReply=true;await withdraw(second.page,'REVOKE_TEMPLATE_MESSAGES');await waitText(second.page,'La operación necesita un comprobante');assert.equal(current.channelPosts.length,1);safeReferences(await references(page),1);
 await second.page.close();active={width,current,page};await page.evaluate(()=>window.dispatchEvent(new Event('obrasaas:pending-receipts')));await waitText(page,'La operación necesita un comprobante');assert.ok(await page.$('[data-worker-channel]'));
 current.channelDenied={status:404,code:'WORKSPACE_PROJECT_UNAVAILABLE'};await click(page,'Consultar resultado pendiente');await page.waitForFunction(()=>document.querySelector('[data-worker-channel]')===null);safeReferences(await references(page),1);await restrictedChannel(page,{loaded:false});
 const operationId=current.channelPosts[0].operationId;assert.deepEqual(current.requests.filter(row=>row.path==='/api/identity/worker-channel'&&row.operationId).map(row=>row.operationId),[operationId]);assert.equal(current.channelPosts.length,1);
 current.channelDenied=null;await click(page,'Consultar resultado pendiente');await waitText(page,'Recibo confirmado');safeReferences(await references(page),0);assert.deepEqual(current.channelReceiptQueries,[operationId]);assert.equal(current.channelPosts.length,1);assert.deepEqual(current.requests.filter(row=>row.path==='/api/identity/worker-channel'&&row.operationId).map(row=>row.operationId),[operationId,operationId]);
 checks.push({name:'canonical-reference-GET-404-hides-loaded-record-and-retains-original-cross-tab-UUID',width,sameOperationId:true,durableReference:true,posts:1,receiptGets:2});await context.close();
}
async function focusedOwnChannel(page,current){
 await page.waitForFunction(()=>document.activeElement?.id==='worker-channel-title');
 const position=await page.$eval('#worker-channel-title',node=>{const rect=node.getBoundingClientRect();return {top:rect.top,bottom:rect.bottom,height:rect.height,visible:node.getClientRects().length>0,viewport:innerHeight};});
 assert.ok(position.visible&&position.height>0&&position.top<position.viewport&&position.bottom>0,'Own WhatsApp heading is not visible after canonical approval');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.equal(current.requests.filter(row=>row.path==='/api/identity/worker-channel').length,0,'Navigation must not read or activate the channel automatically');
 assert.equal(current.channelPosts.length,0);assert.equal(current.posts.length,0);
}
async function privateApprovalFocus(width){
 const {current,context,page}=await startPrivacy(width);
 current.row={...current.row,permissions:{attendance:true,report:true},kyc:{...current.row.kyc,status:'APPROVED'}};
 await click(page,'Consultar mi identidad');await waitText(page,'Aprobado por un responsable');await identityOnly(page);
 current.approved=true;await click(page,'Consultar mi vínculo');await waitRecordedTask(page,'Tarea operativa p-a');await focusedOwnChannel(page,current);
 assert.equal(current.requests.filter(row=>row.path==='/api/identity/workspace'&&row.projectId).length,2,'Own channel navigation requires exactly one fresh canonical project GET');
 await click(page,'Consultar participantes');await waitText(page,'Aprobado por un responsable');await settled(page);
 assert.notEqual(await page.evaluate(()=>document.activeElement?.id),'worker-channel-title','A consumed focus ticket must not repeat when the participant panel is consulted');
 assert.equal(current.requests.filter(row=>row.path==='/api/identity/workspace'&&row.projectId).length,2);
 assert.equal(current.requests.filter(row=>row.path==='/api/identity/worker-channel').length,0);assert.equal(current.posts.length,0);assert.equal(current.channelPosts.length,0);
 await context.close();
}
async function approvalTokenNavigationRace(width,outcome){
 const {current,context,page}=await startPrivacy(width);
 current.row={...current.row,permissions:{attendance:true,report:true},kyc:{...current.row.kyc,status:'APPROVED'}};
 await click(page,'Consultar mi identidad');await waitText(page,'Aprobado por un responsable');current.approved=true;
 await page.evaluate(()=>{window.__tokenMode='hold';});await click(page,'Consultar mi vínculo');await page.waitForFunction(()=>typeof window.__releaseToken==='function');
 assert.equal(current.requests.filter(row=>row.path==='/api/identity/workspace'&&row.projectId==='p-a').length,1,'The old held token dispatched a workspace GET prematurely');
 await click(page,'Obra A2');await identityOnly(page);current.secondKycApproved=true;
 await click(page,'Consultar mi identidad');await waitText(page,'Aprobado por un responsable');
 current.approvedProjects=['p-a2'];current.holdWorkspaceProject='p-a2';await click(page,'Consultar mi vínculo');
 for(let attempt=0;!current.held.length&&attempt<100;attempt++)await pause(20);assert.equal(current.held.length,1,'The current canonical project GET was not held');
 await page.evaluate(mode=>mode==='reject'?window.__rejectToken():window.__releaseToken(),outcome);
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.equal(current.requests.filter(row=>row.path==='/api/identity/workspace'&&row.projectId==='p-a').length,1,'An aborted old token must not dispatch a project read');
 assert.equal(await page.$('#schedule-title'),null,'Current project is still awaiting its canonical GET');
 const releaseCurrent=current.held.shift();
 if(outcome==='refresh'){
  current.holdWorkspaceProject=null;
  await click(page,'Obra A');await waitRecordedTask(page,'Tarea operativa p-a');releaseCurrent();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await settled(page);
  assert.equal(await page.$eval('#schedule-title',node=>node.textContent),'Obra A');assert.notEqual(await page.evaluate(()=>document.activeElement?.id),'worker-channel-title','Manual selection must cancel the previous focus request');
  await click(page,'Actualizar');await waitText(page,'Empresa de ensayo A');await click(page,'Obra A');await waitRecordedTask(page,'Tarea operativa p-a');
  assert.notEqual(await page.evaluate(()=>document.activeElement?.id),'worker-channel-title','A refreshed manual selection must not restore the consumed focus request');
  assert.equal(current.requests.filter(row=>row.path==='/api/identity/worker-channel').length,0);assert.equal(current.posts.length,0);assert.equal(current.channelPosts.length,0);
 }else{
  releaseCurrent();await waitRecordedTask(page,'Tarea operativa p-a2');await focusedOwnChannel(page,current);
  assert.equal(await page.$eval('#schedule-title',node=>node.textContent),'Obra A2');assert.equal(await page.$('#identity-access-title'),null);
 }
 await context.close();
}
async function privateApprovalNavigation(width){
 const {current,context,page}=await startPrivacy(width);await click(page,'Consultar mi identidad');await waitText(page,'Pendiente de revisión humana');
 current.row={...current.row,permissions:{attendance:true,report:true},kyc:{...current.row.kyc,status:'APPROVED'}};await click(page,'Consultar mi identidad');await waitText(page,'Aprobado por un responsable');await identityOnly(page);
 assert.equal(current.requests.filter(row=>row.path==='/api/identity/workspace'&&row.projectId).length,1);assert.equal(current.channelPosts.length,0);
 await click(page,'Consultar mi vínculo');await identityOnly(page);assert.equal(current.requests.filter(row=>row.path==='/api/identity/workspace'&&row.projectId).length,2,'Own approval callback did not query canonical workspace');
 current.approved=true;await click(page,'Comprobar habilitación de obra');await waitRecordedTask(page,'Tarea operativa p-a');assert.equal(await page.$('#identity-access-title'),null);assert.equal(current.requests.filter(row=>row.path==='/api/identity/workspace'&&row.projectId).length,3);assert.equal(current.channelPosts.length,0);
 assert.notEqual(await page.evaluate(()=>document.activeElement?.id),'worker-channel-title','Manual canonical refresh must not request the onboarding focus');
 await context.close();await privateApprovalFocus(width);for(const outcome of ['resolve','reject','refresh'])await approvalTokenNavigationRace(width,outcome);
 checks.push({name:'own-APPROVED-requires-explicit-fresh-canonical-project-check-before-workspace',width});
}

const destinationEntry='/?obra=p-a#worker-channel-title';
const destinationNames=['private-destination-initial-hash-held-canonical-mount-focus','private-destination-visible-guide-same-hash-and-browser-history','private-destination-context-change-cancels-held-private-mount','private-destination-revoked-canonical-access-and-history-stay-closed'];
function destinationNetwork(current){
 const apiSequence=current.requests.map(row=>({path:row.path,method:row.method,actor:row.actor,projectId:row.projectId||null})),workerChannelGets=apiSequence.filter(row=>row.path==='/api/identity/worker-channel'&&row.method==='GET').length,totalPosts=apiSequence.filter(row=>row.method==='POST').length;
 assert.equal(workerChannelGets,0,'Navigation must not automatically read WhatsApp');assert.equal(totalPosts,0,'Navigation must not write');assert.equal(current.posts.length,0);assert.equal(current.channelPosts.length,0);assert.ok(apiSequence.every(row=>row.method==='GET'&&['/api/identity/workspace','/api/identity/participants'].includes(row.path)));
 return {apiSequence,workspaceGets:apiSequence.filter(row=>row.path==='/api/identity/workspace').length,participantGets:apiSequence.filter(row=>row.path==='/api/identity/participants').length,workerChannelGets,totalPosts,participantPosts:current.posts.length,channelPosts:current.channelPosts.length};
}
async function destinationGeometry(page,id){
 await page.waitForFunction(target=>document.activeElement?.id===target&&document.getElementById(target)?.getClientRects().length>0,{timeout:15000},id);
 const geometry=await page.$eval('#'+id,node=>{const rect=node.getBoundingClientRect();return {id:node.id,visible:node.getClientRects().length>0,focused:document.activeElement===node,left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,width:rect.width,height:rect.height,viewportWidth:innerWidth,viewportHeight:innerHeight,documentWidth:document.documentElement.scrollWidth,detailsOpen:node.closest('details')?.open??null,screen:node.closest('[data-workspace-screen]')?.dataset.workspaceScreen??null,screenHidden:node.closest('[data-workspace-screen]')?.hidden??null,otherPrivateScreenHidden:document.querySelector('[data-workspace-screen="'+(node.id==='worker-channel-title'?'identidad':'mi-whatsapp')+'"]')?.hidden??null};});
 active.current.destinationGeometryObservation={...geometry};
 assert.equal(geometry.visible,true);assert.equal(geometry.focused,true);assert.ok(geometry.width>0&&geometry.height>0&&geometry.left>=0&&geometry.right<=geometry.viewportWidth+1&&geometry.top<geometry.viewportHeight&&geometry.bottom>0&&geometry.documentWidth<=geometry.viewportWidth);
 assert.equal(geometry.detailsOpen,null);assert.equal(geometry.screen,id==='worker-channel-title'?'mi-whatsapp':'identidad');assert.equal(geometry.screenHidden,false);assert.equal(geometry.otherPrivateScreenHidden,true);return geometry;
}
async function noDestinationActivation(page){
 const forbidden=await page.evaluate(()=>{const panel=document.querySelector('[aria-labelledby="worker-channel-title"]');if(!panel)return 0;const labels=['Generar código','Generar otro código','Revisar autorización de avisos','Guardar autorización','Continuar en WhatsApp','Copiar MENU','VINCULAR '];return [...panel.querySelectorAll('button,a,code')].filter(node=>node.matches('code,a[href*="wa.me"]')||labels.some(label=>node.textContent.includes(label))).length;});assert.equal(forbidden,0);return forbidden;
}
async function destinationScreenshot(page,name,width){
 const target=path.join(evidence,'destination-'+name+'-'+width+'.png');await page.screenshot({path:target,fullPage:true});const bytes=readFileSync(target);assert.ok(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));const pngWidth=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);assert.equal(pngWidth,width);assert.ok(height>0);return {path:path.relative(root,target).split(path.sep).join('/'),sha256:sha256(bytes),width:pngWidth,height};
}
async function heldCanonical(current){for(let attempt=0;!current.held.length&&attempt<100;attempt++)await pause(20);assert.equal(current.held.length,1,'One canonical project GET must be held');}
async function guideDestination(page,id){
 const guide='section[aria-labelledby="onboarding-guide-title"]';if(!await page.$('#onboarding-guide-content'))await click(page,'Abrir guía');
 const summary=await page.evaluateHandle(selector=>[...document.querySelector(selector).querySelectorAll('summary')].find(node=>node.textContent.trim()==='Elegir otro paso')||null,guide);assert.ok(summary.asElement());if(!await page.evaluate(node=>node.parentElement.open,summary))await visibleElementClick(page,summary.asElement());await summary.dispose();
 const position=id==='worker-channel-title'?9:id==='participant-title'?6:null;assert.ok(position);const button=await page.$(guide+' nav[aria-label="Pasos de inicio"] button:nth-child('+position+')');assert.ok(button);await visibleElementClick(page,button);await button.dispose();
 await click(page,'Ir a este paso');await page.waitForFunction(target=>location.hash==='#'+target,{timeout:15000},id);return destinationGeometry(page,id);
}
async function destinationDelayedMount(width){
 const current=newState('destination-delayed');current.holdWorkspaceProject='p-a';current.destinationHoldProfile=true;let profileObserved;const profileRequestObserved=new Promise(resolve=>profileObserved=resolve);current.destinationProfileObserved=profileObserved;const {context,page}=await createPage(width,current,null,{initialPath:destinationEntry});await heldCanonical(current);
 assert.equal(await page.$('#worker-channel-title'),null);assert.equal(await page.$('#identity-access-title'),null);assert.equal(await page.evaluate(()=>location.hash),'#worker-channel-title');const beforeRelease={targetMounted:false,focused:false,heldCanonicalCount:current.held.length,...destinationNetwork(current)};
 current.holdWorkspaceProject=null;current.held.shift()();await identityOnly(page);await destinationGeometry(page,'worker-channel-title');
 const profileNavigation=async()=>({...await page.evaluate(()=>({hash:location.hash,identityHidden:document.querySelector('[data-workspace-screen="identidad"]').hidden,whatsappHidden:document.querySelector('[data-workspace-screen="mi-whatsapp"]').hidden})),participantGets:current.requests.filter(row=>row.path==='/api/identity/participants').length,heldProfileGets:current.destinationHeldProfile?.length||0}),navigation=[await profileNavigation()];
 assert.deepEqual(navigation[0],{hash:'#worker-channel-title',identityHidden:true,whatsappHidden:false,participantGets:0,heldProfileGets:0});
 await chooseWorkspaceView(page,'participant-title');let profileTimeout;try{await Promise.race([profileRequestObserved,new Promise((_,reject)=>{profileTimeout=setTimeout(()=>reject(Error('Explicit identity navigation did not dispatch its actual profile GET')),15000);})]);}finally{clearTimeout(profileTimeout);}assert.equal(current.destinationHeldProfile?.length,1);navigation.push(await profileNavigation());assert.deepEqual(navigation[1],{hash:'#participant-title',identityHidden:false,whatsappHidden:true,participantGets:1,heldProfileGets:1});
 await chooseWorkspaceView(page,'worker-channel-title');navigation.push(await profileNavigation());assert.deepEqual(navigation[2],{hash:'#worker-channel-title',identityHidden:true,whatsappHidden:false,participantGets:1,heldProfileGets:1});const beforeProfileGeometry=await destinationGeometry(page,'worker-channel-title');
 current.destinationHoldProfile=false;current.destinationHeldProfile.shift()();delete current.destinationProfileObserved;await page.waitForFunction(()=>document.querySelector('[aria-labelledby="participant-title"]')?.textContent.includes('Persona de ensayo'));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const geometry=await destinationGeometry(page,'worker-channel-title'),profileRead={activation:'EXPLICIT_IDENTITY_NAVIGATION',noHiddenProfileReadBeforeNavigation:navigation[0].participantGets===0&&navigation[0].identityHidden===true&&navigation[0].whatsappHidden===false,navigation,heldBeforeNavigation:true,releasedAfterNavigation:true,beforeGeometry:beforeProfileGeometry,afterGeometry:geometry},activationControls=await noDestinationActivation(page),network=destinationNetwork(current);assert.equal(network.workspaceGets,2);assert.equal(network.participantGets,1);const screenshot=await destinationScreenshot(page,'delayed',width);
 destinationChecks.push({name:destinationNames[0],width,status:'PASS',trigger:'INITIAL_HASH_AND_CANONICAL_PROJECT_HINT',initialPath:destinationEntry,beforeRelease,geometry,profileRead,activationControls,...network,screenshot});await context.close();
}
// This reduced pagination fixture tests STALE retention and native focus during manual append; it does not demonstrate canonical100-row pagination.
async function destinationOperationalAppend(page,current){
 current.approved=true;current.destinationPaging=true;current.row={...current.row,kyc:{...current.row.kyc,status:'APPROVED'}};const admission=canonicalAdmissionReads(current);try{admission.activate('AUTHORITY');
 await click(page,'Comprobar habilitación de obra');await admission.observed('AUTHORITY');await noOperativeSurface(page);admission.activate('LIVE_INITIAL');admission.release('AUTHORITY');await waitRecordedTask(page,'Tarea operativa p-a');await chooseWorkspaceView(page,'schedule-title');await admission.observed('LIVE_INITIAL');await scheduleRefreshState(page,'CONSULTING');admission.release('LIVE_INITIAL');await scheduleRefreshState(page,'STALE');assert.equal(await page.$$eval('[data-task-id]',nodes=>nodes.length),1);admission.activate('APPEND');
 current.holdWorkspacePage='p-a';const button=await page.$('#schedule-load-more');assert.ok(button);await button.hover();await page.mouse.down();
 const observe=()=>page.evaluate(()=>{const button=document.getElementById('schedule-load-more'),rect=button?.getBoundingClientRect();return {activeId:document.activeElement?.id||'',activeTagName:document.activeElement?.tagName||'',scrollY,taskCount:document.querySelectorAll('[data-task-id]').length,buttonMounted:Boolean(button),buttonDisabled:button?.disabled??null,rect:rect?{left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,width:rect.width,height:rect.height}:null,viewportWidth:innerWidth,viewportHeight:innerHeight,firstTaskTop:document.querySelector('[data-task-id]')?.getBoundingClientRect().top??null};});
 const nativeFocus=row=>row.activeId==='schedule-load-more'&&row.activeTagName==='BUTTON'||row.activeId===''&&row.activeTagName==='BODY';
 const buttonBox=(row,visible)=>{assert.ok(row.rect&&Object.values(row.rect).every(Number.isFinite)&&row.rect.width>0&&row.rect.height>0);assert.ok(Number.isFinite(row.firstTaskTop));if(visible)assert.ok(row.rect.left>=0&&row.rect.right<=row.viewportWidth+1&&row.rect.top<row.viewportHeight&&row.rect.bottom>0,'OPERATIONAL_APPEND_BUTTON_VISIBLE');};
 const before=await observe();assert.equal(before.activeId,'schedule-load-more');assert.equal(before.activeTagName,'BUTTON');assert.equal(before.buttonDisabled,false);buttonBox(before,true);await page.mouse.up();await button.dispose();await heldCanonical(current);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const pending=await observe();current.destinationAppendObservation={before,pending,after:null};
 assert.ok(nativeFocus(pending),'OPERATIONAL_APPEND_FOCUS_DURING_READ');assert.equal(pending.buttonDisabled,true);buttonBox(pending,true);assert.ok(Math.abs(pending.rect.top-before.rect.top)<=3&&Math.abs(pending.rect.left-before.rect.left)<=3,'OPERATIONAL_APPEND_VIEWPORT_POSITION_DURING_READ');assert.equal(pending.taskCount,1);
 current.holdWorkspacePage=null;admission.activate('POST_APPEND_LIVE');current.held.shift()();await admission.observed('POST_APPEND_LIVE');await page.waitForFunction(()=>document.querySelectorAll('[data-task-id]').length===2);await scheduleRefreshState(page,'CONSULTING');admission.release('POST_APPEND_LIVE');await scheduleRefreshState(page,'STALE');await settled(page);const after=await observe();current.destinationAppendObservation.after=after;
 assert.ok(nativeFocus(after),'OPERATIONAL_APPEND_FOCUS_AFTER_READ');buttonBox(after,false);assert.equal(after.buttonDisabled,false);assert.equal(after.taskCount,2);assert.equal(after.buttonMounted,true);
 admission.finish(['AUTHORITY','LIVE_INITIAL','APPEND','POST_APPEND_LIVE']);assert.deepEqual(current.destinationProjectReads,[{actor:'A',projectId:'p-a',afterTask:null},{actor:'A',projectId:'p-a',afterTask:null},{actor:'A',projectId:'p-a',afterTask:'t-p-a'},{actor:'A',projectId:'p-a',afterTask:null}]);
 return {canonicalAdmissionSimulated:true,totalTasks:3,projectReads:current.destinationProjectReads,before,pending,after};}finally{admission.dispose();}
}

async function destinationPrivateDraft(page,current){
 await chooseWorkspaceView(page,'participant-title');await prepareOwn(page,{consult:false});const original=await page.$('[aria-labelledby="participant-title"] form'),images=await page.$$eval('[aria-labelledby="participant-title"] form fieldset img',nodes=>nodes.map(node=>node.src));assert.equal(images.length,2);
 const observe=async()=>{const facts=await page.evaluate(form=>{const capture=form.querySelector('[data-kyc-capture-step]'),choice=[...capture.querySelectorAll('label')].find(node=>node.textContent.includes('Leí el aviso y autorizo presentar estas imágenes'))?.querySelector('input');return {step:Number(capture.dataset.kycCaptureStep),consent:choice?.checked===true,formMounted:form.isConnected,formVisible:form.getClientRects().length>0,sameForm:form===document.querySelector('[aria-labelledby="participant-title"] form'),imageCount:form.querySelectorAll('fieldset img').length};},original);const next=await page.$$eval('[aria-labelledby="participant-title"] form fieldset img',nodes=>nodes.map(node=>node.src));return {...facts,sameImages:JSON.stringify(next)===JSON.stringify(images)};};
 const before=await observe();await chooseWorkspaceView(page,'worker-channel-title');const hidden=await observe();await chooseWorkspaceView(page,'participant-title');const after=await observe();
 for(const row of [before,hidden,after]){assert.equal(row.step,3);assert.equal(row.consent,true);assert.equal(row.formMounted,true);assert.equal(row.sameForm,true);assert.equal(row.imageCount,2);assert.equal(row.sameImages,true);}assert.equal(before.formVisible,true);assert.equal(hidden.formVisible,false);assert.equal(after.formVisible,true);assert.equal(current.posts.length,0);assert.equal(current.channelPosts.length,0);await click(page,'Cancelar');await original.dispose();await chooseWorkspaceView(page,'worker-channel-title');return {syntheticImagesOnly:true,submitted:false,before,hidden,after};
}
async function destinationGuideHistory(width){
 const {current,context,page}=await startPrivacy(width,'NOT_SUBMITTED');const before=destinationNetwork(current);await privacyDisclosure(page,false);
 const history=[];history.push({action:'guide-private',hash:'#worker-channel-title',geometry:await guideDestination(page,'worker-channel-title')});await page.focus('nav[aria-label="Mi participación en la obra"] a[href="#worker-channel-title"]');assert.equal(await page.evaluate(()=>location.hash),'#worker-channel-title');
 history.push({action:'same-hash-reopen',hash:'#worker-channel-title',geometry:await guideDestination(page,'worker-channel-title')});history.push({action:'guide-identity',hash:'#participant-title',geometry:await guideDestination(page,'participant-title')});
 await page.goBack({waitUntil:'domcontentloaded'});assert.equal(await page.evaluate(()=>location.hash),'#worker-channel-title');history.push({action:'back',hash:'#worker-channel-title',geometry:await destinationGeometry(page,'worker-channel-title')});
 await page.goForward({waitUntil:'domcontentloaded'});assert.equal(await page.evaluate(()=>location.hash),'#participant-title');history.push({action:'forward',hash:'#participant-title',geometry:await destinationGeometry(page,'participant-title')});
 await page.goBack({waitUntil:'domcontentloaded'});history.push({action:'back-final',hash:'#worker-channel-title',geometry:await destinationGeometry(page,'worker-channel-title')});
 const navigationNetwork=destinationNetwork(current);assert.deepEqual(navigationNetwork,before,'Guide and same-document history must not read or write');const activationControls=await noDestinationActivation(page),draftPreservation=await destinationPrivateDraft(page,current),append=await destinationOperationalAppend(page,current),network=destinationNetwork(current),screenshot=await destinationScreenshot(page,'guide-history-append',width);
 destinationChecks.push({name:destinationNames[1],width,status:'PASS',trigger:'REAL_ONBOARDING_GUIDE',history,requestCountBefore:before.apiSequence.length,requestCountAfter:navigationNetwork.apiSequence.length,navigationNetwork,draftPreservation,append,activationControls,...network,screenshot});await context.close();
}
async function destinationContextChange(width){
 const current=newState('destination-context');current.holdWorkspaceProject='p-a';const {context,page}=await createPage(width,current,null,{initialPath:destinationEntry});await heldCanonical(current);assert.equal(await page.$('#worker-channel-title'),null);
 await click(page,'Contexto B');await waitText(page,'Empresa de ensayo B');current.holdWorkspaceProject=null;current.held.shift()();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await settled(page);await pause(150);
 const targetMounted=await page.$('#worker-channel-title')!==null,privateMounted=await page.$('#identity-access-title')!==null,oldFactsVisible=await page.evaluate(()=>/Persona de ensayo|Titular propio WhatsApp A|MUST NEVER RENDER|Tarea operativa p-a/.test(document.body.innerText));assert.equal(targetMounted,false);assert.equal(privateMounted,false);assert.equal(oldFactsVisible,false);safeReferences(await references(page),0);
 const network=destinationNetwork(current);assert.deepEqual(network.apiSequence.map(row=>[row.path,row.actor,row.projectId]),[['/api/identity/workspace','A',null],['/api/identity/workspace','A','p-a'],['/api/identity/workspace','B',null]]);const screenshot=await destinationScreenshot(page,'context',width);
 destinationChecks.push({name:destinationNames[2],width,status:'PASS',initialPath:destinationEntry,heldBeforeContextChange:true,releasedAfterContextChange:true,currentActor:'B',targetMounted,privateMounted,oldFactsVisible,activationControls:await noDestinationActivation(page),...network,screenshot});await context.close();
}
async function destinationRevokedAccess(width){
 const current=newState('destination-revoked'),{context,page}=await createPage(width,current,null,{initialPath:destinationEntry});await identityOnly(page);const initialGeometry=await destinationGeometry(page,'worker-channel-title');await guideDestination(page,'participant-title');await guideDestination(page,'worker-channel-title');
 current.denialCode='WORKSPACE_MEMBERSHIP_REQUIRED';await click(page,'Comprobar habilitación de obra');await settled(page);await page.waitForFunction(()=>!document.getElementById('identity-access-title')&&!document.getElementById('worker-channel-title')&&!document.getElementById('participant-title'));
 const beforeHistory=destinationNetwork(current),history=[];for(const [method,hash]of [['goBack','#participant-title'],['goForward','#worker-channel-title']]){await page[method]({waitUntil:'domcontentloaded'});assert.equal(await page.evaluate(()=>location.hash),hash);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const targetMounted=await page.$('#worker-channel-title')!==null,privateMounted=await page.$('#identity-access-title')!==null;assert.equal(targetMounted,false);assert.equal(privateMounted,false);history.push({action:method,hash,targetMounted,privateMounted});}
 const network=destinationNetwork(current);assert.deepEqual(network,beforeHistory);assert.equal(network.workspaceGets,3);assert.equal(network.participantGets,1);const oldFactsVisible=await page.evaluate(()=>/Persona de ensayo|Titular propio WhatsApp A|MUST NEVER RENDER|Tarea operativa p-a/.test(document.body.innerText));assert.equal(oldFactsVisible,false);assert.equal(await page.$('form'),null);const screenshot=await destinationScreenshot(page,'revoked',width);
 destinationChecks.push({name:destinationNames[3],width,status:'PASS',initialPath:destinationEntry,initialGeometry,denialCode:current.denialCode,history,oldFactsVisible,activationControls:await noDestinationActivation(page),...network,screenshot});await context.close();
}

try{
 let ready=false;for(let attempt=0;attempt<120;attempt++){if(server.exitCode!==null)throw Error('Fixture exited: '+serverLog);let response;try{response=await fetch(origin);}catch{}await response?.body?.cancel();if(response?.ok){ready=true;break;}if(response?.status>=500)throw Error('Fixture compilation failed: '+serverLog);await pause(500);}assert.ok(ready,'Fixture unavailable: '+serverLog);
 browser=await puppeteer.launch({headless:true,protocolTimeout:30000,...(process.platform==='win32'?{channel:'chrome'}:{}),args:['--no-sandbox','--disable-setuid-sandbox']});
 const pictureMaker=await browser.newPage();await pictureMaker.goto(origin,{waitUntil:'networkidle0'});const picture=Buffer.from(await pictureMaker.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=480;canvas.height=320;const context=canvas.getContext('2d'),pixels=context.createImageData(480,320);let seed=41;for(let i=0;i<pixels.data.length;i+=4){for(let channel=0;channel<3;channel++){seed=(seed*1664525+1013904223)>>>0;pixels.data[i+channel]=seed>>>24;}pixels.data[i+3]=255;}context.putImageData(pixels,0,0);return canvas.toDataURL('image/png').split(',')[1];}),'base64');await pictureMaker.close();writeFileSync(picturePath,picture);assert.equal(picture.readUInt32BE(16),480);assert.equal(picture.readUInt32BE(20),320);assert.ok(picture.length<1024*1024,'The synthetic positive remains below the client original-byte threshold');
 for(const width of [320,390,768,1280]){
  await privateFlow(width);await denial(width);await denial(width,{type:'text/html'});await revocation(width);await lateResponse(width,false);await lateResponse(width,true);await tokenHeld(width);
  for(const status of ['PENDING_REVIEW','REJECTED'])for(const action of ['REVOKE_TEMPLATE_MESSAGES','UNLINK'])await privacyWithdrawal(width,status,action);
  for(const action of ['REVOKE_TEMPLATE_MESSAGES','UNLINK'])await privacyWithdrawal(width,action==='UNLINK'?'REJECTED':'PENDING_REVIEW',action,{reload:true});
  await privacyLateApproved(width);await privacyLateContext(width,false);await privacyLateContext(width,true);await privacyHeldToken(width);await privacyLatePost(width);
  for(const [status,code]of [[403,'WORKSPACE_PROJECT_UNAVAILABLE'],[403,'WORKSPACE_MEMBERSHIP_REQUIRED'],[404,'WORKSPACE_PROJECT_UNAVAILABLE']])await privacyAccessDenied(width,status,code);
  await privacyPostDenied(width);await privacyReferenceDenied(width);
  await privateApprovalNavigation(width);
 }
 await privateFlow(390,{reload:true});await privateFlow(390,{director:true});await revocation(390,{ownDenied:true});await administratorBootstrap();
 for(const status of [401,409,500])await denial(390,{status,code:'PARTICIPANT_KYC_REVIEW_REQUIRED'});
 assert.equal(checks.length,103,'Historical identity UI ledger must stay103');
 for(const width of [320,390,768,1280]){await destinationDelayedMount(width);await destinationGuideHistory(width);await destinationContextChange(width);await destinationRevokedAccess(width);}
 assert.equal(destinationChecks.length,16);assert.deepEqual(destinationChecks.map(row=>[row.width,row.name]),[320,390,768,1280].flatMap(width=>destinationNames.map(name=>[width,name])));
 assert.deepEqual(pageErrors,[]);assert.deepEqual(requestErrors,[]);
 assert.equal(sha256(sourceBytes('scripts/verify-workspace-identity-only-ui.mjs')),harnessSha256,'Harness changed during validation');
 for(const file of sourceManifest)assert.equal(sha256(sourceBytes(file.path)),file.sha256,'Copied UI source changed during validation: '+file.path);
 assert.deepEqual(sourceIdentity(),identityBefore,'Identity UI source context changed during validation');
 resultProof={status:'PASS',environment:'isolated-browser-real-components-with-controlled-session-and-http',...identityBefore,widths:[320,390,768,1280],totalCheckCount:checks.length,checks,sourceManifest,harnessSha256,pageErrors,requestErrors,screenshots,actualPageReloadTested:true,nativeIndexedDbReceiptReferencesTested:true,automaticRecoveryPostCount:0,postgresExecuted:false,realClerkLogin:false,realEmailDelivery:false,productionDataWritten:false,realProviderCalls:0,physicalWhatsAppVerified:false,destinationNavigation:{version:2,widths:[320,390,768,1280],totalCheckCount:destinationChecks.length,checks:destinationChecks,limits:{syntheticSession:true,controlledHttp:true,realProviderCalls:0,productionDataWritten:false,realIdentityApproved:false}},combinedTotalCheckCount:checks.length+destinationChecks.length};
}catch(error){
 let dom;try{dom=await active?.page?.evaluate(()=>document.body.innerText);await active?.page?.screenshot({path:path.join(evidence,'failed.png'),fullPage:true});}catch{}
 writeFileSync(path.join(evidence,'browser-failure.json'),JSON.stringify({status:'FAILED',message:error.message,checks,pageErrors,requestErrors,serverLog,destinationChecks,active:active?{width:active.width,mode:active.current.mode,destinationAppendObservation:active.current.destinationAppendObservation||null,destinationGeometryObservation:active.current.destinationGeometryObservation||null,requests:active.current.requests,posts:active.current.posts.map(row=>({operationId:row.operationId,scope:row.scope,projectId:row.projectId})),dom}:null},null,2));throw error;
}finally{
 await browser?.close();
 if(server.exitCode===null){if(process.platform==='win32')await new Promise(resolve=>{const kill=spawn('taskkill',['/PID',String(server.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});kill.on('exit',resolve);kill.on('error',resolve);});else{try{process.kill(-server.pid,'SIGTERM');}catch{}}}
 for(let attempt=0;!serverClosed&&attempt<200;attempt++)await pause(50);
 assert.equal(serverClosed,true,'Identity UI fixture server did not stop');
 assert.equal(path.dirname(path.resolve(fixture)),path.resolve(root,'.vercel'));rmSync(fixture,{recursive:true,force:true});assert.equal(existsSync(fixture),false);
 if(resultProof){
  assert.deepEqual(sourceIdentity(),identityBefore,'Identity UI source changed before cleanup');
  const proof={...resultProof,fixtureRemoved:true,browserClosed:true,serverStopped:true};
  writeFileSync(path.join(evidence,'browser.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify({status:'PASS',checks:checks.length,destinationChecks:destinationChecks.length,combinedChecks:checks.length+destinationChecks.length,pageErrors:pageErrors.length,requestErrors:requestErrors.length,evidence:path.join(evidence,'browser.json')}));
 }
}
