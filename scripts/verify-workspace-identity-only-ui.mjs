import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,rmSync,existsSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {createServer} from 'node:net';
import {spawn,execFileSync} from 'node:child_process';
import puppeteer from 'puppeteer';
import {PARTICIPANT_NOTICE,PARTICIPANT_NOTICE_VERSION} from '../src/lib/participant-policy.mjs';

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
const sha256=value=>createHash('sha256').update(value).digest('hex'),sourceManifest=[],copied=new Set();
function copyGraph(relative){
 relative=relative.split(/[\\/]/).join('/');
 if(copied.has(relative))return;assert.ok(relative.startsWith('src'+path.sep)||relative.startsWith('src/'));
 copied.add(relative);const source=path.join(root,relative),destination=path.join(fixture,relative),bytes=sourceBytes(relative.replaceAll(path.sep,'/'));
 mkdirSync(path.dirname(destination),{recursive:true});writeFileSync(destination,bytes);
 sourceManifest.push({path:relative.replaceAll(path.sep,'/'),sha256:sha256(bytes)});
 if(!/\.(?:js|mjs)$/.test(relative))return;
 for(const match of bytes.toString('utf8').matchAll(/\b(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)){
  const target=path.resolve(path.dirname(source),match[1]),resolved=[target,target+'.js',target+'.mjs',target+'.css',path.join(target,'index.js')].find(value=>existsSync(value)&&statSync(value).isFile());
  assert.ok(resolved,'Missing source dependency '+match[1]);copyGraph(path.relative(root,resolved));
 }
}
copyGraph('src/app/(identity)/cuenta/workspace-client.js');copyGraph('src/app/(identity)/cuenta/workspace-recovery-journal.mjs');copyGraph('src/lib/participant-policy.mjs');
writeFileSync(path.join(fixture,'package.json'),JSON.stringify({name:'isolated-workspace-identity-only-ui',private:true}));
writeFileSync(path.join(fixture,'next.config.mjs'),`export default {devIndicators:false,turbopack:{root:${JSON.stringify(root)}}};`);
writeFileSync(path.join(app,'layout.js'),`export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:12,background:'#0b1c2d',fontFamily:'Arial,sans-serif'}}>{children}</body></html>}`);
writeFileSync(path.join(app,'page.js'),`'use client';
import {useCallback,useEffect,useState} from 'react';
import {AccountWorkspace} from './(identity)/cuenta/workspace-client';
import {browserRecoveryJournal} from './(identity)/cuenta/workspace-recovery-journal.mjs';
export default function Page(){
 const [context,setContext]=useState('A');
 const token=useCallback(async()=>{const captured=context;if(window.__tokenMode==='hold'){window.__tokenMode='normal';await new Promise(resolve=>{window.__releaseToken=resolve;});}return 'synthetic-current-'+captured;},[context]);
 useEffect(()=>{window.__references=scope=>browserRecoveryJournal.list(scope);return()=>{delete window.__references;};},[]);
 return <main style={{maxWidth:1000,margin:'0 auto'}}><div><button onClick={()=>setContext('A')}>Contexto A</button><button onClick={()=>setContext('B')}>Contexto B</button></div><AccountWorkspace key={context} getSessionToken={token}/></main>;
}`);
const picturePath=path.join(fixture,'synthetic.png');
writeFileSync(picturePath,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==','base64'));
const port=Number(process.env.WORKSPACE_IDENTITY_UI_PORT||3174);assert.ok(Number.isInteger(port)&&port>=3000&&port<=65535);
await new Promise((resolve,reject)=>{const probe=createServer();probe.once('error',reject);probe.listen(port,'127.0.0.1',()=>probe.close(error=>error?reject(error):resolve()));});
const origin='http://127.0.0.1:'+port;
const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',fixture,'--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'],windowsHide:true,detached:process.platform!=='win32'});
let serverLog='',browser,active,resultProof,serverClosed=false;
server.once('close',()=>{serverClosed=true;});
for(const stream of [server.stdout,server.stderr])stream.on('data',value=>{serverLog=(serverLog+value.toString()).slice(-20000);});
const scopeA='a'.repeat(64),scopeB='b'.repeat(64),revision='2026-10-01T11:00:00.000001',checks=[],pageErrors=[],requestErrors=[],screenshots=[];
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitText(page,label){await page.waitForFunction(text=>document.body.innerText.includes(text),{timeout:15000},label);}
async function click(page,label){
 await page.waitForFunction(text=>[...document.querySelectorAll('button')].some(button=>!button.disabled&&(button.textContent.trim()===text||button.hasAttribute('aria-pressed')&&button.querySelector('span')?.textContent.trim()===text)),{timeout:15000},label);
 const handle=await page.evaluateHandle(text=>[...document.querySelectorAll('button')].find(button=>!button.disabled&&(button.textContent.trim()===text||button.hasAttribute('aria-pressed')&&button.querySelector('span')?.textContent.trim()===text)),label);
 await page.evaluate(button=>{for(let parent=button.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;},handle);
 await handle.asElement().click();await handle.dispose();
}
async function settled(page){await page.waitForFunction(()=>document.querySelector('[aria-labelledby="workspace-title"]')?.getAttribute('aria-busy')==='false');}
async function identityOnly(page){
 await page.waitForSelector('#identity-access-title');await settled(page);
 assert.equal(await page.$('#participant-title')!==null,true);
 assert.equal(await page.$eval('#participant-title',node=>node.textContent),'Mi identidad');
 assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Revisá cada perfil'));
 for(const id of ['schedule-title','schedule-overview-title','workspace-tools-title','field-title','inventory-title','portfolio-overview-title','pending-receipts-title'])assert.equal(await page.$('#'+id),null,'Operational surface mounted before KYC: '+id);
 assert.equal(await page.$('[data-schedule-workbench]'),null);
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
async function createPage(width,current,sharedContext=null){
 const context=sharedContext||await browser.createBrowserContext(),page=await context.newPage();active={width,current,page};
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
    if(!projectId)return answer(request,200,{scope,organizationName:'Empresa de ensayo '+actor,role:current.mode==='bootstrap'?'ADMIN':current.mode==='director'?'DIRECTOR':'AUDITOR',roleLabel:current.mode==='bootstrap'?'Administrador':current.mode==='director'?'Director':'Consulta',canManageIntegrations:false,projects:actor==='A'?[{id:'p-a',name:'Obra A',status:'ACTIVE'},{id:'p-a2',name:'Obra A2',status:'ACTIVE'}]:[{id:'p-b',name:'Obra B',status:'ACTIVE'}]});
    if(current.mode==='late-project'&&projectId==='p-a'||current.mode==='late-company'&&actor==='A'){
     await new Promise(resolve=>current.held.push(resolve));
    }
    if(actor==='B'||projectId==='p-a2'&&current.mode==='late-project'||current.approved&&projectId==='p-a'){
     const task={id:'t-'+projectId,title:'Tarea operativa '+projectId,status:'IN_PROGRESS',progress:37,startsOn:'2026-10-01',endsOn:'2026-10-05',revision};
     return answer(request,200,{scope,project:{id:projectId,name:actor==='B'?'Obra B':projectId==='p-a2'?'Obra A2':'Obra A',status:'ACTIVE'},roleLabel:'Consulta',canPlanSchedule:false,tasks:[task],totalTasks:current.mode==='revoke'?2:1,nextCursor:current.mode==='revoke'?task.id:null});
    }
    return answer(request,current.denialStatus,current.denialType==='application/json'?{code:current.denialCode,scope:scopeB,projectId:'untrusted-project',tasks:[{title:'MUST NEVER RENDER'}]}:'<html>Gateway denial</html>',current.denialType);
   }
   if(url.pathname==='/api/identity/participants'){
    assert.equal(scope,scopeA);assert.ok(['p-a','p-a2'].includes(projectId));
    if(projectId==='p-a2'){assert.equal(request.method(),'GET');assert.equal(url.searchParams.has('operationId'),false);return answer(request,200,{scope,projectId,canManage:false,canInvite:false,canManageOfficeRoles:false,existingAccounts:[],records:[{...current.row,id:'worker-second',name:'Perfil propio de segunda obra',kyc:{status:'NOT_SUBMITTED',submissionId:null,images:[]}}],nextCursor:null,privacyNotice:{version:PARTICIPANT_NOTICE_VERSION,text:PARTICIPANT_NOTICE}});}
    if(current.mode==='revoked-own')return answer(request,403,{code:'PARTICIPANT_ACCESS_REQUIRED'});
    if(request.method()==='POST'){
     assert.equal(payload.action,undefined);assert.equal(payload.scope,scopeA);assert.equal(payload.workerId,'worker-fixture');assert.equal(payload.consent,true);assert.match(payload.front,/^data:image\/png;base64,/);assert.match(payload.selfie,/^data:image\/png;base64,/);
     current.posts.push(payload);current.row={...current.row,kyc:{...current.row.kyc,status:'PENDING_REVIEW',submissionId:'kyc-fixture',submittedAt:'2026-10-07T12:00:00Z'}};
     current.receipts.set(payload.operationId,{scope,projectId,state:'RECORDED',saved:true,replayed:true,receiptId:'participant_'+payload.operationId,participant:current.row});
     return answer(request,503,{code:'PARTICIPANT_OPERATION_UNCONFIRMED'});
    }
    if(url.searchParams.has('operationId')){const id=url.searchParams.get('operationId');current.receiptQueries.push(id);assert.ok(current.receipts.has(id));return answer(request,200,current.receipts.get(id));}
    return answer(request,200,{scope,projectId,canManage:false,canInvite:false,canManageOfficeRoles:false,existingAccounts:[],records:[current.row],nextCursor:null,privacyNotice:{version:PARTICIPANT_NOTICE_VERSION,text:PARTICIPANT_NOTICE}});
   }
   if(url.pathname==='/api/identity/portfolio-overview')return answer(request,200,{scope,records:[],nextCursor:null});
   // No operational module may fetch during the private-only state.
   return answer(request,503,{code:'CONTROLLED_MODULE_UNAVAILABLE'});
  }catch(error){requestErrors.push({mode:current.mode,message:error.message});try{await request.abort();}catch{}}
 });
 await page.goto(origin,{waitUntil:'networkidle0'});await waitText(page,'Empresa de ensayo A');return {context,page};
}
async function references(page){return page.evaluate(async scopes=>({a:await window.__references(scopes[0]),b:await window.__references(scopes[1]),session:Object.values(sessionStorage),local:Object.values(localStorage)}),[scopeA,scopeB]);}
function safeReferences(value,expected){
 assert.equal(value.a.length,expected);assert.equal(value.b.length,0);
 for(const row of value.a)assert.deepEqual(Object.keys(row).sort(),['createdAt','operationId','projectId','resource','scope','version']);
 assert.doesNotMatch(JSON.stringify(value),/data:image|Bearer |synthetic-current-|front|selfie|payload|Persona de ensayo/i);
}
async function presentOwn(page){
 await click(page,'Consultar mi identidad');await waitText(page,'Persona de ensayo');await click(page,'Presentar mi identidad');
 for(const [title,label]of [['Frente del documento','Usar documento revisado'],['Fotografía del rostro','Usar fotografía revisada']]){
  const selector='fieldset[aria-label="'+title+'"]';await (await page.$(selector+' input[type=file]')).uploadFile(picturePath);await page.waitForSelector(selector+' img');await page.$eval(selector+' input[type=checkbox]',input=>input.click());await click(page,label);
  await page.waitForFunction(title=>[...document.querySelectorAll('fieldset')].find(field=>field.getAttribute('aria-label')===title)?.textContent.includes('Imagen revisada y lista'),{},title);
 }
 await page.evaluate(()=>[...document.querySelectorAll('label')].find(label=>label.textContent.includes('Leí el aviso y autorizo la presentación')).querySelector('input').click());
 await click(page,'Presentar para revisión');await waitText(page,'El resultado quedó sin confirmar');
}
async function privateFlow(width,{reload=false,director=false}={}){
 const current=newState(director?'director':'pending'),{context,page}=await createPage(width,current);
 await click(page,'Obra A');await identityOnly(page);
 const privateScreenshot=path.join(evidence,'identity-private-'+width+(reload?'-reload':director?'-director':'')+'.png');await page.screenshot({path:privateScreenshot,fullPage:true});screenshots.push(path.relative(root,privateScreenshot).split(path.sep).join('/'));
 assert.deepEqual(current.requests.map(row=>row.path),['/api/identity/workspace','/api/identity/workspace']);
 await presentOwn(page);await identityOnly(page);safeReferences(await references(page),1);assert.equal(current.posts.length,1);
 assert.ok(!current.requests.some(row=>!['/api/identity/workspace','/api/identity/participants'].includes(row.path)));
 if(reload){await page.reload({waitUntil:'networkidle0'});assert.equal(current.acceptedReloadWarning,true);await waitText(page,'Empresa de ensayo A');await click(page,'Obra A');await identityOnly(page);await waitText(page,'Comprobar el mismo intento');assert.equal(current.receiptQueries.length,0);safeReferences(await references(page),1);}
 await click(page,'Comprobar el mismo intento');await waitText(page,reload?'Recibo confirmado':'Operación guardada con recibo');assert.equal(current.posts.length,1);assert.deepEqual(current.receiptQueries,[current.posts[0].operationId]);safeReferences(await references(page),0);
 await click(page,'Consultar mi identidad');await waitText(page,'Pendiente de revisión humana');await identityOnly(page);
 current.row={...current.row,kyc:{...current.row.kyc,status:'APPROVED',review:{decision:'APPROVED',reason:'Controlled human acceptance',reviewedAt:'2026-10-07T12:05:00Z'}}};
 await click(page,'Consultar mi identidad');await waitText(page,'Aprobado por un responsable');await identityOnly(page);
 const operativeBefore=current.requests.filter(row=>row.path==='/api/identity/workspace'&&row.projectId).length;
 current.approved=true;await click(page,'Comprobar habilitación de obra');await waitText(page,'Tarea operativa p-a');await page.waitForSelector('#workspace-tools-title');assert.equal(await page.$('#identity-access-title'),null);
 assert.equal(await page.$eval('#participant-title',node=>node.textContent),'Participantes y revisión de identidad','Private presentation hint changed the normal workspace');
 assert.equal(current.requests.filter(row=>row.path==='/api/identity/workspace'&&row.projectId).length,operativeBefore+1,'Approval did not require explicit fresh workspace read');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const screenshot=path.join(evidence,'identity-approved-'+width+(reload?'-reload':director?'-director':'')+'.png');await page.screenshot({path:screenshot,fullPage:true});screenshots.push(path.relative(root,screenshot).split(path.sep).join('/'));
 await click(page,'Obra A2');await identityOnly(page);await click(page,'Consultar mi identidad');await waitText(page,'Perfil propio de segunda obra');assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Persona de ensayo'));await identityOnly(page);
 checks.push({name:'private-identity-submission-uncertain-receipt-and-explicit-approval-refresh',width,reload,director,posts:current.posts.length,receiptGets:current.receiptQueries.length});await context.close();
}
async function administratorBootstrap(){
 const current=newState('bootstrap');current.approved=true;current.row=null;const {context,page}=await createPage(390,current);
 await click(page,'Obra A');await waitText(page,'Tarea operativa p-a');assert.equal(await page.$('#identity-access-title'),null);assert.equal(current.posts.length,0);assert.ok(!(current.requests.some(row=>row.path==='/api/identity/participants')));
 checks.push({name:'bootstrap-administrator-without-worker-keeps-server-authorized-operation',width:390});await context.close();
}
async function denial(width,{status=403,code='WORKSPACE_PROJECT_UNAVAILABLE',type='application/json'}={}){
 const current=newState('generic-denial');Object.assign(current,{denialStatus:status,denialCode:code,denialType:type});const {context,page}=await createPage(width,current);
 await click(page,'Obra A');await settled(page);assert.equal(await page.$('#identity-access-title'),null);assert.equal(await page.$('#participant-title'),null);
 if(status===401||status===403||code==='WORKSPACE_CONTEXT_CHANGED')assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Empresa de ensayo A'));
 assert.equal(current.requests.length,2);checks.push({name:'noncanonical-denial-cannot-open-private-or-operative-ui',width,status,code,type});await context.close();
}
async function revocation(width,{ownDenied=false}={}){
 const current=newState('revoke');current.approved=true;const {context,page}=await createPage(width,current);
 await click(page,'Obra A');await waitText(page,'Tarea operativa p-a');current.approved=false;if(ownDenied)current.mode='revoked-own';
 await click(page,'Cargar más tareas');await identityOnly(page);assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Tarea operativa p-a'));
 await click(page,'Consultar mi identidad');if(ownDenied){await waitText(page,'No hay un acceso activo vinculado a tu cuenta');assert.equal(await page.$('article'),null);assert.equal(await page.$('form'),null);}else await waitText(page,'Persona de ensayo');
 await identityOnly(page);checks.push({name:'revoked-workspace-hides-loaded-tasks-and-only-own-private-read-remains',width,ownDenied});await context.close();
}
async function lateResponse(width,company){
 const current=newState(company?'late-company':'late-project'),{context,page}=await createPage(width,current);
 await click(page,'Obra A');await page.waitForFunction(()=>document.querySelector('[aria-labelledby="workspace-title"]')?.getAttribute('aria-busy')==='true');
 for(let attempt=0;!current.held.length&&attempt<50;attempt++)await pause(20);assert.equal(current.held.length,1);
 if(company){await click(page,'Contexto B');await waitText(page,'Empresa de ensayo B');await click(page,'Obra B');await waitText(page,'Tarea operativa p-b');}
 else{await click(page,'Obra A2');await waitText(page,'Tarea operativa p-a2');}
 current.held.shift()();await pause(150);assert.equal(await page.$('#identity-access-title'),null);assert.ok((await page.evaluate(()=>document.body.innerText)).includes(company?'Tarea operativa p-b':'Tarea operativa p-a2'));
 checks.push({name:company?'late-prior-company-response-cannot-restore-private-context':'late-prior-project-denial-cannot-replace-authorized-project',width});await context.close();
}
async function tokenHeld(width){
 const current=newState('held-token'),{context,page}=await createPage(width,current);await page.evaluate(()=>{window.__tokenMode='hold';});
 await click(page,'Obra A');await page.waitForFunction(()=>typeof window.__releaseToken==='function');assert.equal(current.requests.filter(row=>row.projectId==='p-a').length,0);
 await click(page,'Contexto B');await waitText(page,'Empresa de ensayo B');await page.evaluate(()=>window.__releaseToken());await pause(150);
 assert.equal(current.requests.filter(row=>row.projectId==='p-a').length,0);assert.equal(await page.$('#identity-access-title'),null);
 await click(page,'Obra B');await waitText(page,'Tarea operativa p-b');checks.push({name:'token-held-prior-company-never-dispatches-after-context-change',width});await context.close();
}
async function privacySurface(page){
 await identityOnly(page);await page.evaluate(()=>{const summary=[...document.querySelectorAll('summary')].find(node=>node.textContent==='Mi WhatsApp y mis avisos');assertSummary(summary);function assertSummary(node){if(!node)throw Error('Own privacy section missing');node.parentElement.open=true;}});
 await page.waitForSelector('#worker-channel-title');
}
async function restrictedChannel(page,{loaded=true}={}){
 await identityOnly(page);
 const text=await page.$eval('[aria-labelledby="worker-channel-title"]',node=>node.innerText);
 const paragraphContrasts=await page.$eval('[aria-labelledby="worker-channel-title"]',panel=>{
  const luminance=color=>{const rgb=color.match(/[\d.]+/g).slice(0,3).map(value=>Number(value)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
  return [...panel.querySelectorAll('p')].filter(node=>node.textContent.trim()).map(node=>{const foreground=luminance(getComputedStyle(node).color);let background=node;while(background.parentElement&&getComputedStyle(background).backgroundColor==='rgba(0, 0, 0, 0)')background=background.parentElement;const surface=luminance(getComputedStyle(background).backgroundColor);return {text:node.textContent.slice(0,50),ratio:(Math.max(foreground,surface)+.05)/(Math.min(foreground,surface)+.05)};});
 });
 for(const paragraph of paragraphContrasts)assert.ok(paragraph.ratio>=4.5,'Own privacy paragraph unreadable: '+paragraph.text+' contrast='+paragraph.ratio);
 assert.ok(await page.$eval('summary',node=>node.getBoundingClientRect().height>=44),'Own privacy disclosure needs a44px touch target');
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
  await waitText(page,'La operación necesita un comprobante');assert.equal(current.channelPosts.length,1);safeReferences(await references(page),1);
  await page.reload({waitUntil:'networkidle0'});await waitText(page,'Empresa de ensayo A');await click(page,'Obra A');await privacySurface(page);await waitText(page,'La operación necesita un comprobante');
  assert.equal(current.channelPosts.length,1);assert.deepEqual(current.channelReceiptQueries,[]);safeReferences(await references(page),1);
  await click(page,'Consultar resultado pendiente');await waitText(page,'Recibo confirmado');assert.deepEqual(current.channelReceiptQueries,[current.channelPosts[0].operationId]);safeReferences(await references(page),0);
  await click(page,'Consultar vinculación');await waitText(page,'Titular propio WhatsApp A');
 }else await waitText(page,action==='UNLINK'?'WhatsApp desvinculado.':'Autorización retirada.');
 await restrictedChannel(page);assert.equal(current.channelPosts.length,1);assert.equal(current.channelPosts[0].action,action);assert.ok(!current.requests.some(row=>!['/api/identity/workspace','/api/identity/worker-channel'].includes(row.path)));
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
 if(company){await click(page,'Contexto B');await waitText(page,'Empresa de ensayo B');await click(page,'Obra B');await waitText(page,'Tarea operativa p-b');}
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
async function privateApprovalNavigation(width){
 const {current,context,page}=await startPrivacy(width);await click(page,'Consultar mi identidad');await waitText(page,'Pendiente de revisión humana');
 current.row={...current.row,permissions:{attendance:true,report:true},kyc:{...current.row.kyc,status:'APPROVED'}};await click(page,'Consultar mi identidad');await waitText(page,'Aprobado por un responsable');await identityOnly(page);
 assert.equal(current.requests.filter(row=>row.path==='/api/identity/workspace'&&row.projectId).length,1);assert.equal(current.channelPosts.length,0);
 await click(page,'Consultar mi vínculo');await identityOnly(page);assert.equal(current.requests.filter(row=>row.path==='/api/identity/workspace'&&row.projectId).length,2,'Own approval callback did not query canonical workspace');
 current.approved=true;await click(page,'Comprobar habilitación de obra');await waitText(page,'Tarea operativa p-a');assert.equal(await page.$('#identity-access-title'),null);assert.equal(current.requests.filter(row=>row.path==='/api/identity/workspace'&&row.projectId).length,3);assert.equal(current.channelPosts.length,0);
 checks.push({name:'own-APPROVED-requires-explicit-fresh-canonical-project-check-before-workspace',width});await context.close();
}
try{
 let ready=false;for(let attempt=0;attempt<120;attempt++){if(server.exitCode!==null)throw Error('Fixture exited: '+serverLog);let response;try{response=await fetch(origin);}catch{}await response?.body?.cancel();if(response?.ok){ready=true;break;}if(response?.status>=500)throw Error('Fixture compilation failed: '+serverLog);await pause(500);}assert.ok(ready,'Fixture unavailable: '+serverLog);
 browser=await puppeteer.launch({headless:true,protocolTimeout:30000,...(process.platform==='win32'?{channel:'chrome'}:{}),args:['--no-sandbox','--disable-setuid-sandbox']});
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
 assert.deepEqual(pageErrors,[]);assert.deepEqual(requestErrors,[]);
 assert.equal(sha256(sourceBytes('scripts/verify-workspace-identity-only-ui.mjs')),harnessSha256,'Harness changed during validation');
 for(const file of sourceManifest)assert.equal(sha256(sourceBytes(file.path)),file.sha256,'Copied UI source changed during validation: '+file.path);
 assert.deepEqual(sourceIdentity(),identityBefore,'Identity UI source context changed during validation');
 resultProof={status:'PASS',environment:'isolated-browser-real-components-with-controlled-session-and-http',...identityBefore,widths:[320,390,768,1280],totalCheckCount:checks.length,checks,sourceManifest,harnessSha256,pageErrors,requestErrors,screenshots,actualPageReloadTested:true,nativeIndexedDbReceiptReferencesTested:true,automaticRecoveryPostCount:0,postgresExecuted:false,realClerkLogin:false,realEmailDelivery:false,productionDataWritten:false,realProviderCalls:0,physicalWhatsAppVerified:false};
}catch(error){
 let dom;try{dom=await active?.page?.evaluate(()=>document.body.innerText);await active?.page?.screenshot({path:path.join(evidence,'failed.png'),fullPage:true});}catch{}
 writeFileSync(path.join(evidence,'browser-failure.json'),JSON.stringify({status:'FAILED',message:error.message,checks,pageErrors,requestErrors,serverLog,active:active?{width:active.width,mode:active.current.mode,requests:active.current.requests,posts:active.current.posts.map(row=>({operationId:row.operationId,scope:row.scope,projectId:row.projectId})),dom}:null},null,2));throw error;
}finally{
 await browser?.close();
 if(server.exitCode===null){if(process.platform==='win32')await new Promise(resolve=>{const kill=spawn('taskkill',['/PID',String(server.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});kill.on('exit',resolve);kill.on('error',resolve);});else{try{process.kill(-server.pid,'SIGTERM');}catch{}}}
 for(let attempt=0;!serverClosed&&attempt<200;attempt++)await pause(50);
 assert.equal(serverClosed,true,'Identity UI fixture server did not stop');
 assert.equal(path.dirname(path.resolve(fixture)),path.resolve(root,'.vercel'));rmSync(fixture,{recursive:true,force:true});assert.equal(existsSync(fixture),false);
 if(resultProof){
  assert.deepEqual(sourceIdentity(),identityBefore,'Identity UI source changed before cleanup');
  const proof={...resultProof,fixtureRemoved:true,browserClosed:true,serverStopped:true};
  writeFileSync(path.join(evidence,'browser.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify({status:'PASS',checks:checks.length,pageErrors:pageErrors.length,requestErrors:requestErrors.length,evidence:path.join(evidence,'browser.json')}));
 }
}
