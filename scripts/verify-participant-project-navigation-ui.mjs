import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,rmSync,existsSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {createServer} from 'node:net';
import {spawn,execFileSync} from 'node:child_process';
import puppeteer from 'puppeteer';
import {PARTICIPANT_NOTICE,PARTICIPANT_NOTICE_VERSION} from '../src/lib/participant-policy.mjs';

// Standalone focal proof. Real account/invitation components, synthetic session
// and intercepted HTTP only. This is not a Clerk login or an official CI proof.
assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV,'Local isolated UI only');
assert.equal(process.version,'v24.15.0','Use the reviewed Node 24.15.0 runtime');
const root=process.cwd(),vercelRoot=path.resolve(root,'.vercel');
const harnessPath='scripts/verify-participant-project-navigation-ui.mjs';
const args=process.argv.slice(2);
assert.ok(args.length===0||args.length===2&&args[0]==='--expected-head','Unsupported navigation UI arguments');
const expectedHead=args[1]||null;
if(expectedHead)assert.match(expectedHead,/^[a-f0-9]{40}$/);
const sha256=value=>createHash('sha256').update(value).digest('hex');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const widths=[320,390,768,1280],scopeA='a'.repeat(64),scopeB='b'.repeat(64);
const invitationId='invite_'+'c'.repeat(32),targetProjectId='p-a2';
const revision='2026-10-01T11:00:00.000001';
function within(parent,target){const relative=path.relative(parent,path.resolve(target));return Boolean(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative);}
function sourceIdentity(){
 const sourceRevision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 assert.match(sourceRevision,/^[a-f0-9]{40}$/);
 const dirty=execFileSync('git',['diff','--name-only','HEAD','--'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 const dirtyTrackedPaths=dirty?dirty.split(/\r?\n/):[];
 if(expectedHead){assert.equal(sourceRevision,expectedHead,'Exact focal source HEAD');assert.deepEqual(dirtyTrackedPaths,[],'Committed clean focal source');}
 return {sourceRevision,sourceState:expectedHead?'EXACT_COMMITTED_FOCAL_SOURCE':'LOCAL_REVIEW_SOURCE',trackedClean:dirtyTrackedPaths.length===0,dirtyTrackedPaths};
}
const identityBefore=sourceIdentity(),sourceSnapshots=new Map(),sourceManifest=[],wiringSourceManifest=[],fixtureSourceManifest=[],copied=new Set();
function sourceBytes(relative){
 const absolute=path.resolve(root,relative);assert.ok(within(root,absolute));
 const working=readFileSync(absolute),digest=sha256(working);
 if(sourceSnapshots.has(relative))assert.equal(digest,sourceSnapshots.get(relative),'Working source changed: '+relative);else sourceSnapshots.set(relative,digest);
 if(!expectedHead)return working;
 const text=working.toString('utf8');assert.ok(working.equals(Buffer.from(text)),'Source is not UTF-8: '+relative);
 const committed=execFileSync('git',['show',expectedHead+':'+relative],{cwd:root,maxBuffer:8*1024*1024});
 assert.ok(Buffer.from(text.replaceAll('\r\n','\n')).equals(committed),'Working source differs from exact Git bytes: '+relative);
 return committed;
}
const harnessSha256=sha256(sourceBytes(harnessPath));
// The isolated page mirrors only the project's decoding/prop wiring. Capture
// that real source too, without claiming to mount Clerk's production wrapper.
wiringSourceManifest.push({path:'src/app/(identity)/cuenta/workspace-identity.js',sha256:sha256(sourceBytes('src/app/(identity)/cuenta/workspace-identity.js'))});
mkdirSync(vercelRoot,{recursive:true});
const requestedEvidence=process.env.PARTICIPANT_PROJECT_NAVIGATION_UI_EVIDENCE_DIR;
const evidence=requestedEvidence?path.resolve(root,requestedEvidence):path.join(vercelRoot,'participant-project-navigation-evidence-'+Date.now());
assert.ok(within(vercelRoot,evidence),'Evidence must stay within this workspace .vercel');
assert.equal(existsSync(evidence),false,'Preserve earlier evidence; choose a new directory');
mkdirSync(path.dirname(evidence),{recursive:true});mkdirSync(evidence);
const port=Number(process.env.PARTICIPANT_PROJECT_NAVIGATION_UI_PORT||3186);
assert.ok(Number.isInteger(port)&&port>=3000&&port<=65535);
const origin='http://127.0.0.1:'+port;
let fixture,server,browser,active,resultProof,serverLog='',serverClosed=false,primaryError=null;
const checks=[],pageErrors=[],requestErrors=[],externalRequests=[],automaticPosts=[],screenshots=[],scenarioSummaries=[],cleanupErrors=[];
let expectedSyntheticPosts=0;
function copyGraph(relative){
 relative=relative.split(/[\\/]/).join('/');if(copied.has(relative))return;
 assert.ok(relative.startsWith('src/'));
 assert.ok(!relative.startsWith('src/app/api/')&&!/\/(?:db|.*-store)\.(?:js|mjs)$/.test(relative),'Client fixture may not copy database/server modules');
 copied.add(relative);const bytes=sourceBytes(relative),source=path.resolve(root,relative),destination=path.resolve(fixture,relative);
 assert.ok(within(fixture,destination));mkdirSync(path.dirname(destination),{recursive:true});writeFileSync(destination,bytes,{flag:'wx'});
 sourceManifest.push({path:relative,sha256:sha256(bytes)});
 if(!/\.(?:js|mjs)$/.test(relative))return;
 for(const match of bytes.toString('utf8').matchAll(/\b(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)){
  const target=path.resolve(path.dirname(source),match[1]);
  const resolved=[target,target+'.js',target+'.mjs',target+'.css',path.join(target,'index.js')].find(value=>existsSync(value)&&statSync(value).isFile());
  assert.ok(resolved,'Missing dependency '+match[1]);assert.ok(within(root,resolved));copyGraph(path.relative(root,resolved));
 }
}
function fixtureWrite(relative,value){
 const destination=path.resolve(fixture,relative);assert.ok(within(fixture,destination));
 mkdirSync(path.dirname(destination),{recursive:true});writeFileSync(destination,value,{flag:'wx'});
 fixtureSourceManifest.push({path:relative,sha256:sha256(value)});
}
function newState(name,{pending=false,joinMode=null,listFailures=0,ambiguous=false,heldProject=false,denial=false}={}){
 const row={id:'worker-fixture',name:'Perfil propio de ensayo',active:true,revision,status:'ACTIVE',self:true,accountLinked:true,invitation:null,kycChatChallenge:null,permissions:{attendance:false,report:false},identityCertified:false,whatsAppAccessGranted:false,kyc:{status:'NOT_SUBMITTED',submissionId:null,submittedAt:null,review:null,images:[]}};
 return {name,pending,joinMode,listFailures,ambiguous,heldProject,denial,row,rowBefore:JSON.stringify(row),requests:[],posts:[],held:[],heldResponseSettled:false,joinSaved:false,joinReceipt:null,explicitJoinPost:false};
}
function projectRequests(current){return current.requests.filter(row=>row.path==='/api/identity/workspace'&&row.projectId);}
function listRequests(current){return current.requests.filter(row=>row.path==='/api/identity/workspace'&&!row.projectId);}
function unchanged(current){assert.equal(JSON.stringify(current.row),current.rowBefore,'Navigation changed identity or field permissions');assert.equal(current.row.kyc.status,'NOT_SUBMITTED');assert.deepEqual(current.row.permissions,{attendance:false,report:false});}
async function waitText(page,label){await page.waitForFunction(text=>document.body.innerText.includes(text),{timeout:15000},label);}
async function settled(page){await page.waitForFunction(()=>document.querySelector('[aria-labelledby="workspace-title"]')?.getAttribute('aria-busy')==='false',{timeout:15000});}
async function uiTurn(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await pause(150);}
async function click(page,label){
 await page.waitForFunction(text=>[...document.querySelectorAll('button')].some(button=>!button.disabled&&(button.textContent.trim()===text||button.hasAttribute('aria-pressed')&&button.querySelector('span')?.textContent.trim()===text)),{timeout:15000},label);
 const handle=await page.evaluateHandle(text=>[...document.querySelectorAll('button')].find(button=>!button.disabled&&(button.textContent.trim()===text||button.hasAttribute('aria-pressed')&&button.querySelector('span')?.textContent.trim()===text)),label);
 await handle.asElement().click();await handle.dispose();
}
async function noOverflow(page){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow');}
async function noProject(page){assert.equal(await page.$('#schedule-title'),null);assert.equal(await page.$('#identity-access-title'),null);assert.equal(await page.$('[data-schedule-workbench]'),null);assert.equal(await page.$('button[aria-pressed="true"]'),null);}
async function noExtraAuthority(page){
 for(const id of ['own-company-number-title','own-company-templates-title','office-review-admin-title','project-creation-title','project-preparation-title'])assert.equal(await page.$('#'+id),null,'Caller query mounted an administrative surface: '+id);
 assert.equal(await page.$$eval('h3',headings=>headings.some(node=>node.textContent.trim()==='Plan y pago')),false,'Caller query mounted company billing');
 assert.equal(await page.$('#schedule-edit-title'),null);
 assert.equal(await page.$('button[type="submit"]'),null,'Unexpected write form before an explicit action');
 assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Aprobado por un responsable'));
}
async function privateOnly(page,current){
 await page.waitForSelector('#identity-access-title',{timeout:15000});await settled(page);
 assert.equal(await page.$eval('#participant-title',node=>node.textContent),'Mi identidad');
 for(const id of ['schedule-title','schedule-overview-title','workspace-tools-title','field-title','inventory-title','portfolio-overview-title','pending-receipts-title'])assert.equal(await page.$('#'+id),null,'Operational surface mounted while KYC is pending: '+id);
 assert.equal(await page.$('[data-schedule-workbench]'),null);
 assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Untrusted task'));
 assert.equal(current.requests.filter(row=>row.path==='/api/identity/participants').length,0,'Identity read must remain explicit');
 await click(page,'Consultar mi identidad');await waitText(page,current.row.name);await settled(page);
 assert.ok((await page.evaluate(()=>document.body.innerText)).includes('Sin presentar'));
 assert.equal(current.requests.filter(row=>row.path==='/api/identity/participants').length,1);
 assert.equal(current.posts.filter(row=>row.path!=='/api/identity/participant-join').length,0);
 unchanged(current);await noExtraAuthority(page);await noOverflow(page);
}
async function assertCanonicalJoinHref(page){
 const hrefs=await page.$$eval('a',links=>links.filter(link=>link.textContent.trim()==='Abrir mi obra en la cuenta').map(link=>link.getAttribute('href')));
 assert.equal(hrefs.length,1,'Only one confirmed account link');assert.match(hrefs[0],/^\/cuenta\?/);
 const target=new URL(hrefs[0],origin);assert.equal(target.origin,origin);assert.equal(target.pathname,'/cuenta');assert.equal(target.hash,'');
 assert.deepEqual([...target.searchParams.entries()].sort(([left],[right])=>left.localeCompare(right)),[['obra',targetProjectId],['participar',invitationId]]);
 return hrefs[0];
}
async function noJoinHref(page){assert.equal(await page.$$eval('a',links=>links.filter(link=>link.textContent.trim()==='Abrir mi obra en la cuenta').length),0);}
async function createPage(width,current,entry='/cuenta'){
 const context=await browser.createBrowserContext(),page=await context.newPage();active={width,current,page};
 await page.setViewport({width,height:1050});page.on('pageerror',error=>pageErrors.push({width,scenario:current.name,message:error.message}));
 await page.setRequestInterception(true);
 const answer=(request,status,value)=>request.respond({status,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(value)});
 page.on('request',async request=>{
  try{
   const url=new URL(request.url());
   if(url.origin!==origin){
    if(url.protocol==='data:'&&request.method()==='GET'&&request.resourceType()==='image'&&/^data:image\/(?:svg\+xml|png)[;,]/.test(request.url()))return request.continue();
    externalRequests.push({scenario:current.name,protocol:url.protocol,host:url.hostname,method:request.method(),resourceType:request.resourceType()});throw Error('Unexpected external request');
   }
   if(!url.pathname.startsWith('/api/')){assert.equal(request.method(),'GET','Only fixture navigation/static GET may reach Next');return request.continue();}
   assert.ok(url.pathname.startsWith('/api/identity/'),'Unexpected API namespace');
   const actor=request.headers().authorization==='Bearer synthetic-current-A'?'A':request.headers().authorization==='Bearer synthetic-current-B'?'B':null;
   assert.ok(actor,'Missing explicit controlled session token');const scope=actor==='A'?scopeA:scopeB;
   const projectId=url.searchParams.get('projectId'),record={path:url.pathname,method:request.method(),actor,projectId,query:[...url.searchParams.entries()]};current.requests.push(record);
   if(request.method()!=='GET'){
    const authorizedExplicitPost=current.explicitJoinPost&&url.pathname==='/api/identity/participant-join'&&request.method()==='POST';
    current.explicitJoinPost=false;
    if(!authorizedExplicitPost){automaticPosts.push({scenario:current.name,...record});throw Error('Unexpected automatic or non-join write request');}
    const payload=JSON.parse(request.postData());assert.deepEqual(Object.keys(payload).sort(),['invitationId','operationId']);assert.equal(payload.invitationId,invitationId);assert.match(payload.operationId,/^[a-f0-9-]{36}$/);
    assert.equal(actor,'A');assert.equal(url.search,'');current.posts.push({path:url.pathname,...payload});expectedSyntheticPosts++;
    assert.equal(current.posts.length,1,'Acceptance was dispatched twice');current.joinSaved=true;current.joinReceipt='join-'+payload.operationId;
    return current.joinMode==='recovered'?answer(request,503,{code:'PARTICIPANT_OPERATION_UNCONFIRMED'}):answer(request,200,{saved:true,joined:true,receiptId:current.joinReceipt,projectId:targetProjectId});
   }
   if(url.pathname==='/api/identity/participant-join'){
    assert.equal(actor,'A');assert.deepEqual(record.query,[['invitationId',invitationId]]);
    return answer(request,200,{invitationId,projectName:'Obra A2',organizationName:'Empresa de ensayo A',participantName:'Perfil propio de ensayo',state:current.joinSaved?'ACTIVE':'INVITED',canAccept:!current.joinSaved,...(current.joinSaved?{saved:true,joined:true,receiptId:current.joinReceipt,projectId:targetProjectId}:{})});
   }
   if(url.pathname==='/api/identity/workspace'){
    assert.deepEqual([...url.searchParams.keys()].sort(),projectId?['projectId','scope']:[],'Caller authority escaped into workspace query');
    if(!projectId){
     if(current.listFailures>0){current.listFailures--;return answer(request,503,{code:'CONTROLLED_LIST_FAILURE'});}
     const projects=actor==='A'?[{id:'p-a',name:'Obra A',status:'ACTIVE'},{id:targetProjectId,name:'Obra A2',status:'ACTIVE'}]:[{id:'p-b',name:'Obra B',status:'ACTIVE'}];
     if(current.ambiguous&&actor==='A')projects.push({...projects[1],name:'Otro registro ambiguo'});
     return answer(request,200,{scope,organizationName:'Empresa de ensayo '+actor,role:'AUDITOR',roleLabel:'Consulta',canManageIntegrations:false,officeReviewOnly:false,projects,projectsTruncated:false});
    }
    assert.equal(url.searchParams.get('scope'),scope,'Canonical GET must use the active server scope');assert.ok((actor==='A'?['p-a',targetProjectId]:['p-b']).includes(projectId),'Hint selected a project absent from the current list');
    if(current.heldProject&&actor==='A'){
     await new Promise(resolve=>current.held.push(resolve));
     try{return await answer(request,403,{code:'PARTICIPANT_KYC_REVIEW_REQUIRED',scope:scopeB,projectId:'foreign-project',tasks:[{title:'Untrusted task'}]});}finally{current.heldResponseSettled=true;}
    }
    if(actor==='A'&&(current.pending||current.denial))return answer(request,403,{code:current.denial?'WORKSPACE_PROJECT_UNAVAILABLE':'PARTICIPANT_KYC_REVIEW_REQUIRED',scope:scopeB,projectId:'foreign-project',tasks:[{title:'Untrusted task'}]});
    const task={id:'task-'+projectId,title:'Tarea de consulta '+projectId,status:'IN_PROGRESS',progress:37,startsOn:'2026-10-01',endsOn:'2026-10-05',revision};
    return answer(request,200,{scope,project:{id:projectId,name:actor==='B'?'Obra B':projectId===targetProjectId?'Obra A2':'Obra A',status:'ACTIVE'},roleLabel:'Consulta',canPlanSchedule:false,tasks:[task],totalTasks:1,nextCursor:null});
   }
   if(url.pathname==='/api/identity/participants'){
    assert.equal(actor,'A');assert.equal(projectId,targetProjectId);assert.deepEqual([...url.searchParams.keys()].sort(),['projectId','scope']);assert.equal(url.searchParams.get('scope'),scopeA);
    assert.ok(current.pending,'Own identity read is only expected in the private-only scenario');
    return answer(request,200,{scope,projectId,canManage:false,canInvite:false,canManageOfficeRoles:false,existingAccounts:[],records:[current.row],nextCursor:null,privacyNotice:{version:PARTICIPANT_NOTICE_VERSION,text:PARTICIPANT_NOTICE}});
   }
   throw Error('Unexpected component API read '+url.pathname);
  }catch(error){requestErrors.push({width,scenario:current.name,message:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}
 });
 await page.goto(origin+entry,{waitUntil:current.heldProject?'domcontentloaded':'networkidle0',timeout:90000});
 return {context,page};
}
async function snapshot(page,name){const file=name+'.png';await page.screenshot({path:path.join(evidence,file),fullPage:true});screenshots.push(file);}
function recordCheck(width,current,name,extra={}){
 unchanged(current);assert.equal(current.explicitJoinPost,false);assert.equal(current.posts.filter(row=>row.path!=='/api/identity/participant-join').length,0);
 checks.push({name,width,...extra});scenarioSummaries.push({name:current.name,width,requests:current.requests,syntheticExplicitJoinPosts:current.posts.length,identityAndPermissionsUnchanged:true});
}
async function invitationNavigation(width,mode){
 const current=newState('invitation-'+mode,{joinMode:mode,pending:mode==='recovered'}),{context,page}=await createPage(width,current,'/join?participar='+invitationId+'&obra=p-foreign&scope='+scopeB+'&role=ADMIN');
 await click(page,'Consultar mi invitación');await waitText(page,'Empresa de ensayo A');await noJoinHref(page);assert.equal(current.posts.length,0);
 current.explicitJoinPost=true;await click(page,'Aceptar participación en esta obra');
 if(mode==='recovered'){
  await waitText(page,'No se pudo confirmar');await noJoinHref(page);assert.equal(current.posts.length,1);
  await click(page,'Comprobar la misma aceptación');
 }
 await waitText(page,'Tu participación quedó registrada');assert.equal(current.posts.length,1);
 const href=await assertCanonicalJoinHref(page);await noOverflow(page);
 const link=await page.$('a[href="'+href+'"]');assert.ok(link);
 await Promise.all([page.waitForNavigation({waitUntil:'networkidle0'}),link.click()]);
 if(mode==='recovered')await privateOnly(page,current);else{await waitText(page,'Tarea de consulta '+targetProjectId);await settled(page);await noExtraAuthority(page);await noOverflow(page);}
 assert.deepEqual(projectRequests(current).map(row=>[row.actor,row.projectId]),[['A',targetProjectId]]);assert.equal(listRequests(current).length,1);
 assert.equal(current.requests.filter(row=>row.path==='/api/identity/participant-join').length,mode==='recovered'?3:2,'Navigation performed another invitation request');
 await snapshot(page,'invitation-'+mode+'-'+width);recordCheck(width,current,'confirmed-invitation-link-uses-current-receipt-project-and-canonical-get',{mode});await context.close();
}
async function authorizedOnce(width){
 const current=newState('authorized-once'),entry='/cuenta?obra='+targetProjectId+'&scope='+scopeB+'&role=ADMIN&canManage=true&canSend=true';
 const {context,page}=await createPage(width,current,entry);await waitText(page,'Tarea de consulta '+targetProjectId);await settled(page);await noExtraAuthority(page);await noOverflow(page);
 assert.deepEqual(projectRequests(current).map(row=>row.projectId),[targetProjectId]);assert.equal(listRequests(current).length,1);
 await click(page,'Actualizar');await waitText(page,'Empresa de ensayo A');await settled(page);await uiTurn(page);await noProject(page);
 assert.deepEqual(projectRequests(current).map(row=>row.projectId),[targetProjectId],'Refresh reopened a consumed hint');
 await click(page,'Obra A');await waitText(page,'Tarea de consulta p-a');await settled(page);await uiTurn(page);
 assert.deepEqual(projectRequests(current).map(row=>row.projectId),[targetProjectId,'p-a'],'Manual selection reopened the original hint');assert.equal(listRequests(current).length,2);assert.equal(current.posts.length,0);
 await noExtraAuthority(page);await noOverflow(page);recordCheck(width,current,'hint-selects-second-authorized-project-once-and-never-adds-authority');await context.close();
}
async function rejectedHints(width){
 const cases=[['absent','?scope='+scopeB+'&role=ADMIN&projectId=p-a2'],['duplicate','?obra=p-a2&obra=p-a2'],['unknown','?obra=p-unknown&scope='+scopeB+'&role=ADMIN'],['foreign-current-organization','?obra=p-b&scope='+scopeB+'&canManage=true'],['malformed','?obra=https%3A%2F%2Fexample.invalid%2Fcuenta'],['ambiguous-current-list','?obra=p-a2']];
 for(const [name,query] of cases){
  const current=newState('hint-rejected-'+name,{ambiguous:name==='ambiguous-current-list'}),{context,page}=await createPage(width,current,'/cuenta'+query);
  await waitText(page,'Empresa de ensayo A');await settled(page);await uiTurn(page);await noProject(page);await noExtraAuthority(page);await noOverflow(page);
  assert.equal(projectRequests(current).length,0,'Rejected hint triggered a project GET: '+name);assert.equal(listRequests(current).length,1);assert.equal(current.posts.length,0);unchanged(current);
  scenarioSummaries.push({name:current.name,width,requests:current.requests,syntheticExplicitJoinPosts:0,identityAndPermissionsUnchanged:true});await context.close();
 }
 checks.push({name:'missing-duplicate-unknown-foreign-malformed-or-ambiguous-hint-never-opens',width,cases:cases.map(([name])=>name)});
}
async function failedListRefresh(width){
 const current=newState('failed-list-refresh',{listFailures:1}),{context,page}=await createPage(width,current,'/cuenta?obra='+targetProjectId);
 await settled(page);await noProject(page);assert.equal(projectRequests(current).length,0);assert.equal(listRequests(current).length,1);
 await click(page,'Actualizar');await waitText(page,'Tarea de consulta '+targetProjectId);await settled(page);
 assert.deepEqual(projectRequests(current).map(row=>row.projectId),[targetProjectId]);assert.equal(listRequests(current).length,2);
 await click(page,'Actualizar');await waitText(page,'Empresa de ensayo A');await settled(page);await uiTurn(page);await noProject(page);
 assert.deepEqual(projectRequests(current).map(row=>row.projectId),[targetProjectId]);assert.equal(listRequests(current).length,3);assert.equal(current.posts.length,0);
 await noOverflow(page);recordCheck(width,current,'failed-first-list-needs-explicit-refresh-before-single-canonical-open');await context.close();
}
async function lateContext(width){
 const current=newState('late-context',{heldProject:true}),{context,page}=await createPage(width,current,'/cuenta?obra='+targetProjectId);
 await waitText(page,'Empresa de ensayo A');
 for(let attempt=0;attempt<80&&!current.held.length;attempt++)await pause(25);assert.equal(current.held.length,1,'Expected held automatic project GET');
 await click(page,'Contexto B');await waitText(page,'Empresa de ensayo B');await settled(page);await uiTurn(page);await noProject(page);
 assert.deepEqual(projectRequests(current).map(row=>[row.actor,row.projectId]),[['A',targetProjectId]],'Foreign hint opened in the replacement context');
 await click(page,'Obra B');await waitText(page,'Tarea de consulta p-b');await settled(page);
 for(const release of current.held.splice(0))release();
 for(let attempt=0;attempt<80&&!current.heldResponseSettled;attempt++)await pause(25);assert.equal(current.heldResponseSettled,true,'Old request was not released');await uiTurn(page);
 await waitText(page,'Tarea de consulta p-b');assert.equal(await page.$('#identity-access-title'),null);assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Untrusted task'));assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Empresa de ensayo A'));
 assert.deepEqual(projectRequests(current).map(row=>[row.actor,row.projectId]),[['A',targetProjectId],['B','p-b']]);assert.equal(current.posts.length,0);await noExtraAuthority(page);await noOverflow(page);
 await snapshot(page,'late-context-'+width);recordCheck(width,current,'late-prior-context-cannot-restore-its-project-or-private-state');await context.close();
}
async function canonicalDenial(width){
 const current=newState('canonical-denial',{denial:true}),{context,page}=await createPage(width,current,'/cuenta?obra='+targetProjectId+'&role=ADMIN');
 await waitText(page,'Esta obra no está disponible');await settled(page);await uiTurn(page);await noProject(page);
 assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Untrusted task'));assert.equal(current.requests.filter(row=>row.path==='/api/identity/participants').length,0);
 assert.deepEqual(projectRequests(current).map(row=>row.projectId),[targetProjectId]);assert.equal(current.posts.length,0);await noOverflow(page);
 recordCheck(width,current,'canonical-access-denial-cannot-become-operational-or-private-access');await context.close();
}
try{
 await new Promise((resolve,reject)=>{const probe=createServer();probe.once('error',reject);probe.listen(port,'127.0.0.1',()=>probe.close(error=>error?reject(error):resolve()));});
 fixture=mkdtempSync(path.join(vercelRoot,'participant-project-navigation-ui-'));
 copyGraph('src/app/(identity)/cuenta/workspace-client.js');copyGraph('src/app/(identity)/cuenta/participant-panel.js');copyGraph('src/lib/identity-return-path.mjs');copyGraph('src/lib/participant-policy.mjs');
 fixtureWrite('package.json',JSON.stringify({name:'isolated-participant-project-navigation-ui',private:true}));
 fixtureWrite('next.config.mjs','export default {devIndicators:false,turbopack:{root:'+JSON.stringify(root)+'}};');
 fixtureWrite('src/app/layout.js','export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:12,background:"#0b1c2d",fontFamily:"Arial,sans-serif"}}>{children}</body></html>;}');
 const fixturePage="import {Suspense} from 'react';import {NavigationFixture} from '../project-navigation-fixture';export const dynamic='force-dynamic';export default function Page(){return <Suspense fallback={<p>Preparando fixture local…</p>}><NavigationFixture/></Suspense>;}";
 fixtureWrite('src/app/join/page.js',fixturePage);fixtureWrite('src/app/cuenta/page.js',fixturePage);
 fixtureWrite('src/app/project-navigation-fixture.js',"'use client';\nimport {useCallback,useState} from 'react';\nimport {useSearchParams,usePathname} from 'next/navigation';\nimport {identityWorkspaceProjectHint} from '../lib/identity-return-path.mjs';\nimport {AccountWorkspace} from './(identity)/cuenta/workspace-client';\nimport {ParticipantSelfServicePanel} from './(identity)/cuenta/participant-panel';\nexport function NavigationFixture(){const params=useSearchParams(),pathname=usePathname(),initialProjectId=identityWorkspaceProjectHint(params);const [context,setContext]=useState('A');const token=useCallback(async()=> 'synthetic-current-'+context,[context]);return <main style={{maxWidth:1000,margin:'0 auto'}}><div><button onClick={()=>setContext('A')}>Contexto A</button><button onClick={()=>setContext('B')}>Contexto B</button></div><ParticipantSelfServicePanel key={'join:'+context} getSessionToken={token}/>{pathname==='/cuenta'&&<AccountWorkspace key={context} getSessionToken={token} initialProjectId={initialProjectId}/>}</main>;}\n");
 // Keep server credentials/environment out of the child fixture process.
 const fixtureEnvironment={NEXT_TELEMETRY_DISABLED:'1'};
 for(const key of ['PATH','Path','SystemRoot','WINDIR','TEMP','TMP','COMSPEC','PATHEXT','LOCALAPPDATA','APPDATA','USERPROFILE','HOME','LANG','LC_ALL'])if(process.env[key]!==undefined)fixtureEnvironment[key]=process.env[key];
 server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',fixture,'--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env:fixtureEnvironment,stdio:['ignore','pipe','pipe'],windowsHide:true,detached:process.platform!=='win32'});
 server.once('close',()=>{serverClosed=true;});server.once('error',error=>{serverLog+='\n'+error.message;serverClosed=true;});
 for(const stream of [server.stdout,server.stderr])stream.on('data',value=>{serverLog=(serverLog+value.toString()).slice(-20000);});
 let ready=false;for(let attempt=0;attempt<120;attempt++){
  if(serverClosed||server.exitCode!==null)throw Error('Fixture exited: '+serverLog);
  let response;try{response=await fetch(origin+'/cuenta');}catch{}await response?.body?.cancel();
  if(response?.ok){ready=true;break;}if(response?.status>=500)throw Error('Fixture compilation failed: '+serverLog);await pause(500);
 }assert.ok(ready,'Fixture unavailable: '+serverLog);
 browser=await puppeteer.launch({headless:true,protocolTimeout:30000,...(process.platform==='win32'?{channel:'chrome'}:{}),args:['--no-sandbox','--disable-setuid-sandbox']});
 for(const width of widths){await invitationNavigation(width,'confirmed');await invitationNavigation(width,'recovered');await authorizedOnce(width);await rejectedHints(width);await failedListRefresh(width);await lateContext(width);await canonicalDenial(width);}
 assert.equal(checks.length,28);assert.deepEqual(pageErrors,[]);assert.deepEqual(requestErrors,[]);assert.deepEqual(externalRequests,[]);assert.deepEqual(automaticPosts,[]);assert.equal(expectedSyntheticPosts,8);
 resultProof={status:'PASS'};
}catch(error){
 primaryError=error;resultProof={status:'FAIL',message:error.message};
 if(active?.page&&!active.page.isClosed())try{writeFileSync(path.join(evidence,'failure-dom.txt'),await active.page.content(),{flag:'wx'});}catch{}
 writeFileSync(path.join(evidence,'failure.txt'),String(error.stack)+'\n'+serverLog,{flag:'wx'});
}finally{
 let browserClosed=false,fixtureRemoved=false;
 if(browser)try{await browser.close();browserClosed=true;}catch(error){cleanupErrors.push('browser: '+error.message);}else browserClosed=true;
 if(server&&!serverClosed&&Number.isInteger(server.pid)&&server.pid>0){
  try{if(process.platform==='win32')execFileSync('taskkill',['/PID',String(server.pid),'/T','/F'],{stdio:'ignore'});else process.kill(-server.pid,'SIGTERM');}catch(error){if(!serverClosed)cleanupErrors.push('server-stop: '+error.message);}
  for(let attempt=0;attempt<200&&!serverClosed;attempt++)await pause(25);
  if(!serverClosed&&process.platform!=='win32')try{process.kill(-server.pid,'SIGKILL');}catch{}
  for(let attempt=0;attempt<100&&!serverClosed;attempt++)await pause(25);
 }
 const serverStopped=!server||serverClosed;
 if(fixture&&browserClosed&&serverStopped)try{assert.ok(within(vercelRoot,fixture)&&path.basename(fixture).startsWith('participant-project-navigation-ui-'));rmSync(fixture,{recursive:true,force:true});fixtureRemoved=!existsSync(fixture);}catch(error){cleanupErrors.push('fixture: '+error.message);}
 else if(fixture)cleanupErrors.push('Fixture preserved because its browser or server did not close');else fixtureRemoved=true;
 let identityAfter=null,exactSourceBeforeAfter=false;
 try{for(const relative of sourceSnapshots.keys())sourceBytes(relative);identityAfter=sourceIdentity();assert.deepEqual(identityAfter,identityBefore);exactSourceBeforeAfter=true;}catch(error){cleanupErrors.push('source-after: '+error.message);}
 if(!browserClosed||!serverStopped||!fixtureRemoved||!exactSourceBeforeAfter||cleanupErrors.length){resultProof.status='FAIL';resultProof.message||='Cleanup or source identity was not confirmed';}
 const proof={version:1,kind:'PARTICIPANT_PROJECT_NAVIGATION_UI',...resultProof,environment:'isolated-browser-real-components-controlled-session-and-intercepted-http',...identityBefore,sourceAfter:identityAfter,exactSourceBeforeAfter,harnessSha256,sourceManifest,wiringSourceManifest,fixtureSourceManifest,widths,totalCheckCount:checks.length,checks,scenarioSummaries,screenshots,pageErrors,requestErrors,externalRequests,cleanupErrors,syntheticExplicitJoinPostCount:expectedSyntheticPosts,automaticPostCount:automaticPosts.length,providerCalls:0,productionDataWritten:false,databaseWrites:0,postgresExecuted:false,realClerkLogin:false,realIdentityAccepted:false,realEmailDelivery:false,physicalWhatsAppVerified:false,officialWorkspaceCohortCertified:false,browserClosed,serverStopped,fixtureRemoved,proofCreateNew:true};
 const proofBytes=JSON.stringify(proof,null,2)+'\n';writeFileSync(path.join(evidence,'browser.json'),proofBytes,{flag:'wx'});
 const artifactNames=['browser.json',...screenshots,...(existsSync(path.join(evidence,'failure-dom.txt'))?['failure-dom.txt']:[]),...(existsSync(path.join(evidence,'failure.txt'))?['failure.txt']:[])];
 const manifest={version:1,kind:'STANDALONE_FOCAL_UI_ARTIFACTS',sourceRevision:identityBefore.sourceRevision,harnessSha256,proofSha256:sha256(proofBytes),artifacts:artifactNames.map(file=>{const bytes=readFileSync(path.join(evidence,file));return {path:file,bytes:bytes.length,sha256:sha256(bytes)};})};
 writeFileSync(path.join(evidence,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
 if(primaryError||proof.status!=='PASS')process.exitCode=1;
 console.log(JSON.stringify({status:proof.status,sourceRevision:proof.sourceRevision,totalCheckCount:proof.totalCheckCount,evidenceDirectory:evidence,proofSha256:manifest.proofSha256,harnessSha256,browserClosed,serverStopped,fixtureRemoved,officialWorkspaceCohortCertified:false}));
}
