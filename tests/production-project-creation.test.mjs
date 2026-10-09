import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {scopeStamp} from '../src/lib/workspace-policy.mjs';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
import {PROJECT_CREATION_ACTION,normalizeProjectCreation,projectCreationText,projectCreationReceiptId} from '../src/lib/project-creation-policy.mjs';
import {createProjectCreation} from '../src/lib/project-creation-store.mjs';
import {createProjectCreationHandlers} from '../src/lib/project-creation-http.mjs';
import {projectCreationSnapshot,projectCreationOutcome,projectCreationReceiptOutcome,projectCreationReadDenied,readProjectCreationResponse} from '../src/app/(identity)/cuenta/project-creation-format.mjs';
import {createWorkspaceRequestLifecycle} from '../src/app/(identity)/cuenta/workspace-request-lifecycle.mjs';
import {createWorkspaceRecoveryJournal,recoveryQuery,recoveryResult,projectCreationReceiptOutcome as journalProjectCreationReceiptOutcome} from '../src/app/(identity)/cuenta/workspace-recovery-journal.mjs';

const session={authenticated:true,verification:'clerk-production-jwt',userId:'user_AdminA',organizationId:'org_CompanyA',organizationRole:'org:admin'};
const canonicalMember={actorId:'actor-a',membershipId:'member-a',role:'ADMIN',organizationId:'company-a',organizationName:'Empresa de prueba',clerkUserId:session.userId,clerkRole:'org:admin',officeReviewOnly:false};
const scope=scopeStamp(session,canonicalMember),context={projectId:'origin-a',scope},operationId=randomUUID();
const payload={name:'Obra adicional',address:'Dirección declarada',reason:'Alta solicitada por administración'};
const command=changes=>({operationId,...context,action:PROJECT_CREATION_ACTION,payload:{...payload},...changes});

// A transactional in-memory SQL fixture drives the actual canonical workspace
// composition. It cannot call providers or a production database.
function fixture(){
 let state={projects:[{id:'origin-a',organizationId:'company-a',name:'Origen',status:'ACTIVE'},{id:'foreign-a',organizationId:'company-b',name:'Ajena',status:'ACTIVE'}],memberships:[],receipts:[]};
 const control={member:{...canonicalMember},fail:null,loseCommit:false,archiveBeforeInsert:false},queries=[],counts={projectInsert:0,membershipInsert:0,receiptInsert:0,commit:0,rollback:0};
 async function connect(){
  let working=null,unlock;
  return {async query(sql,args=[]){
   queries.push({sql,args:structuredClone(args)});
   if(sql.startsWith('BEGIN')){working=structuredClone(state);return {rows:[]};}
   if(sql.startsWith('SET LOCAL'))return {rows:[]};
   if(sql==='COMMIT'){state=working;working=null;counts.commit++;unlock?.();unlock=null;if(control.loseCommit){control.loseCommit=false;throw Error('Synthetic lost COMMIT response');}return {rows:[]};}
   if(sql==='ROLLBACK'){working=null;counts.rollback++;unlock?.();unlock=null;return {rows:[]};}
   if(sql.startsWith('SELECT u.id AS'))return {rows:control.member&&args[0]===session.userId&&args[1]===session.organizationId&&args[2]===control.member.clerkRole?[{...control.member}]:[]};
   if(sql.startsWith('SELECT pg_advisory_xact_lock')){const previous=fixtureLocks.get(args[0])||Promise.resolve();let release;const next=new Promise(resolve=>{release=resolve;});fixtureLocks.set(args[0],previous.then(()=>next));await previous;unlock=release;working=structuredClone(state);return {rows:[]};}
   if(sql.startsWith('SELECT id,"entityId",metadata FROM public."AuditLog"'))return {rows:working.receipts.filter(row=>row.id===args[0]&&row.organizationId===args[1]&&row.actorId===args[2]&&row.action===args[3]).map(row=>({id:row.id,entityId:row.entityId,metadata:structuredClone(row.metadata)}))};
   if(sql.startsWith('SELECT p.id,p.name,p.status::text AS status FROM public."Project" p JOIN'))return {rows:working.projects.filter(p=>p.id===args[0]&&p.organizationId===args[1]&&working.memberships.some(pm=>pm.id===args[2]&&pm.projectId===p.id&&pm.tenantMembershipId===args[3])).map(p=>({id:p.id,name:p.name,status:p.status}))};
   if(sql.startsWith('SELECT id,name,status::text AS status FROM public."Project"'))return {rows:working.projects.filter(p=>p.id===args[0]&&p.organizationId===args[1]&&p.status==='ACTIVE').map(p=>({id:p.id,name:p.name,status:p.status}))};
   if(sql.startsWith('SELECT id FROM public."Project"')){
    if(control.archiveBeforeInsert&&sql.includes('FOR SHARE'))working.projects.find(p=>p.id===args[0]).status='ARCHIVED';
    return {rows:working.projects.filter(p=>p.id===args[0]&&p.organizationId===args[1]&&(!sql.includes("status='ACTIVE'")||p.status==='ACTIVE')).map(p=>({id:p.id}))};
   }
   if(sql.startsWith('SELECT w.id FROM public."Worker"')||sql.includes("action='participant.operation.recorded'")||sql.startsWith('SELECT id,"projectId",active,metadata FROM public."Worker"'))return {rows:[]};
   if(sql.startsWith('SELECT id FROM public."ProjectMembership"'))return {rows:[]};
   if(sql.startsWith('INSERT INTO public."Project"')){
    counts.projectInsert++;assert.match(sql,/"updatedAt"\) VALUES[\s\S]*clock_timestamp\(\)/);assert.equal(args[1],control.member.organizationId);assert.equal(working.projects.some(p=>p.id===args[0]),false);
    working.projects.push({id:args[0],organizationId:args[1],name:args[2],status:'ACTIVE',address:args[3],metadata:JSON.parse(args[4])});if(control.fail==='project')throw Error('Synthetic project insertion failure');return {rows:[],rowCount:1};
   }
   if(sql.startsWith('INSERT INTO public."ProjectMembership"')){
    counts.membershipInsert++;assert.match(sql,/"updatedAt"\) VALUES[\s\S]*clock_timestamp\(\)/);assert.equal(args[2],control.member.membershipId);working.memberships.push({id:args[0],projectId:args[1],tenantMembershipId:args[2],status:'ACTIVE'});if(control.fail==='membership')throw Error('Synthetic membership insertion failure');return {rows:[],rowCount:1};
   }
   if(sql.startsWith('INSERT INTO public."AuditLog"')){
    counts.receiptInsert++;assert.equal(working.receipts.some(row=>row.id===args[0]),false);working.receipts.push({id:args[0],organizationId:args[1],actorId:args[2],action:args[3],entityId:args[4],metadata:JSON.parse(args[5])});if(control.fail==='receipt')throw Error('Synthetic receipt insertion failure');return {rows:[],rowCount:1};
   }
   throw Error('Unexpected SQL: '+sql);
  },release(){}};
 }
 const workspace=createWorkspaceStore({connect});
 return {store:createProjectCreation({workspace}),workspace,control,queries,counts,get state(){return state;}};
}
const fixtureLocks=new Map();
function recoveryStorage(){const values=new Map();return {values,get length(){return values.size;},key:index=>[...values.keys()][index]??null,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};}

test('creation accepts only declared fields and normalizes the UUID, Unicode and whitespace',()=>{
 const normalized=normalizeProjectCreation(command({operationId:operationId.toUpperCase(),payload:{...payload,name:'  Porte\u0301ria  ',address:'  Dirección  '}}));assert.equal(normalized.operationId,operationId);assert.equal(normalized.payload.name,'Portéria');assert.equal(normalized.payload.address,'Dirección');
 for(const field of ['organizationId','tenantId','membershipId','role','workerId','metadata','connectionId','initialTasks','subscriptionPlan'])assert.throws(()=>normalizeProjectCreation(command({payload:{...payload,[field]:'forbidden'}})),{code:'PROJECT_CREATION_INPUT_INVALID'});
 for(const fields of [{role:'ADMIN'},{projectId:'foreign-a',tenantId:'company-b'},{action:'CREATE_ADMIN'}])assert.throws(()=>normalizeProjectCreation(command(fields)),{code:'PROJECT_CREATION_INPUT_INVALID'});
 for(const value of ['', 'a', '<script>', '\u0000', '\u202e', '\ud800', '\udc00','a'.repeat(121)])assert.throws(()=>projectCreationText(value,120,2),{code:'PROJECT_CREATION_INPUT_INVALID'});
 assert.throws(()=>normalizeProjectCreation(command({payload:{...payload,reason:'corto'}})),{code:'PROJECT_CREATION_INPUT_INVALID'});
});

test('canonical administrator creates exactly one project, creator membership and auditable receipt atomically',async()=>{
 const f=fixture(),before=await f.store.read(session,context);projectCreationSnapshot(before,context);const result=await f.store.save(session,command());projectCreationOutcome(result,command());
 assert.equal(result.state,'RECORDED');assert.equal(result.newProject.status,'ACTIVE');assert.equal(result.projectId,context.projectId);assert.equal(result.created,true);assert.equal(result.replayed,false);assert.equal(f.state.projects.length,3);assert.equal(f.state.memberships.length,1);assert.equal(f.state.receipts.length,1);
 assert.equal(f.state.memberships[0].projectId,result.newProject.id);assert.equal(f.state.memberships[0].tenantMembershipId,'member-a');assert.equal(f.state.projects[2].organizationId,'company-a');assert.equal(f.state.receipts[0].entityId,result.newProject.id);assert.equal(f.state.receipts[0].metadata.projectId,context.projectId);assert.deepEqual(f.state.projects[2].metadata,{onboarding:{version:1,source:'customer-additional-project',locationVerified:false,emptyOperationalData:true}});
 assert.equal(f.queries.some(({sql})=>/^INSERT INTO public."(PlatformUser|Organization|TenantMembership|Worker|Task|IntegrationConnection)"/.test(sql)),false);assert.deepEqual(f.counts,{projectInsert:1,membershipInsert:1,receiptInsert:1,commit:1,rollback:1});
});

test('same UUID is idempotent and different normalized payload conflicts without creating another project',async()=>{
 const f=fixture(),one=await f.store.save(session,command()),two=await f.store.save(session,command({operationId:operationId.toUpperCase(),payload:{...payload,name:' '+payload.name+' '}}));assert.equal(two.replayed,true);assert.equal(two.receiptId,one.receiptId);assert.equal(two.newProject.id,one.newProject.id);assert.equal(f.counts.projectInsert,1);
 await assert.rejects(f.store.save(session,command({payload:{...payload,name:'Obra distinta'}})),{code:'PROJECT_CREATION_OPERATION_CONFLICT'});assert.equal(f.state.projects.length,3);assert.equal(f.state.receipts.length,1);
 const index=f.queries.findIndex(({sql})=>sql.startsWith('SELECT pg_advisory_xact_lock'));assert.ok(index>=0);assert.ok(f.queries.slice(index+1).some(({sql})=>sql.startsWith('SELECT id,"entityId",metadata')));
});

test('concurrent same UUID serializes against the durable receipt and commits one project',async()=>{
 const f=fixture(),results=await Promise.all([f.store.save(session,command()),f.store.save(session,command())]);assert.equal(new Set(results.map(value=>value.newProject.id)).size,1);assert.deepEqual(results.map(value=>value.replayed).sort(),[false,true]);assert.equal(f.state.projects.length,3);assert.equal(f.counts.projectInsert,1);
});

test('a failed project, creator membership or receipt rolls back the complete operation',async()=>{
 for(const failure of ['project','membership','receipt']){const f=fixture();f.control.fail=failure;await assert.rejects(f.store.save(session,command()),{code:'WORKSPACE_OPERATION_UNCONFIRMED'});assert.equal(f.state.projects.length,2);assert.equal(f.state.memberships.length,0);assert.equal(f.state.receipts.length,0);assert.equal(f.counts.commit,0);const result=await f.store.status(session,{...context,operationId});assert.equal(result.state,'NOT_OBSERVED');assert.equal(result.definitive,false);assert.equal(result.created,false);}
});

test('lost COMMIT response is recovered by read-only GET before an explicit replay',async()=>{
 const f=fixture();f.control.loseCommit=true;await assert.rejects(f.store.save(session,command()),{code:'WORKSPACE_OPERATION_UNCONFIRMED'});assert.equal(f.state.projects.length,3);
 const before={...f.counts},result=await f.store.status(session,{...context,operationId});projectCreationOutcome(result,command());assert.equal(result.replayed,true);assert.equal(result.created,true);assert.equal(f.counts.projectInsert,before.projectInsert);assert.equal(f.counts.membershipInsert,before.membershipInsert);assert.equal(f.counts.receiptInsert,before.receiptInsert);
 const start=f.queries.findLastIndex(({sql})=>sql.startsWith('BEGIN'));assert.equal(f.queries[start].sql,'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');assert.equal(f.queries.slice(start).some(({sql})=>/^INSERT|^UPDATE|advisory_xact_lock/.test(sql)),false);
 const replay=await f.store.save(session,command());assert.equal(replay.newProject.id,result.newProject.id);assert.equal(f.counts.projectInsert,1);
});

test('each read, status and command requires signed identity, canonical membership, ADMIN and org:admin',async()=>{
 const operations=[(f,s,c)=>f.store.read(s,c),(f,s,c)=>f.store.status(s,{...c,operationId}),(f,s,c)=>f.store.save(s,command(c))];
 for(const invoke of operations){
  const anonymous=fixture();await assert.rejects(invoke(anonymous,{...session,authenticated:false},context),{code:'SESSION_REQUIRED'});
  const unsigned=fixture();await assert.rejects(invoke(unsigned,{...session,verification:'decoded-only'},context),{code:'SESSION_REQUIRED'});
  const missing=fixture();missing.control.member=null;await assert.rejects(invoke(missing,session,context),{code:'WORKSPACE_MEMBERSHIP_REQUIRED'});
  for(const role of ['DIRECTOR','SITE_MANAGER','FINANCE','AUDITOR']){const f=fixture();f.control.member.role=role;const current={...context,scope:scopeStamp(session,f.control.member)};await assert.rejects(invoke(f,session,current),{code:'WORKSPACE_ORGANIZATION_PERMISSION_REQUIRED'});assert.equal(f.counts.projectInsert,0);}
  const wrongClaim=fixture(),memberSession={...session,organizationRole:'org:member'};wrongClaim.control.member.clerkRole='org:member';await assert.rejects(invoke(wrongClaim,memberSession,{...context,scope:scopeStamp(memberSession,wrongClaim.control.member)}));assert.equal(wrongClaim.counts.projectInsert,0);
 }
});

test('foreign, stale or archived origin cannot authorize creation; an archive during authorization fails before inserts',async()=>{
 for(const change of [{projectId:'foreign-a'},{scope:'f'.repeat(64)}]){const f=fixture();await assert.rejects(f.store.save(session,command(change)));assert.equal(f.counts.projectInsert,0);}
 const f=fixture();f.state.projects[0].status='ARCHIVED';await assert.rejects(f.store.save(session,command()),{code:'WORKSPACE_PROJECT_UNAVAILABLE'});assert.equal(f.counts.projectInsert,0);
 const racing=fixture();racing.control.archiveBeforeInsert=true;await assert.rejects(racing.store.save(session,command()),{code:'WORKSPACE_PROJECT_UNAVAILABLE'});assert.equal(racing.counts.projectInsert,0);
});

test('an archived origin can recover its prior receipt and reports current canonical project status',async()=>{
 const f=fixture(),result=await f.store.save(session,command());f.state.projects[0].status='ARCHIVED';f.state.projects.find(p=>p.id===result.newProject.id).status='PAUSED';f.state.projects.find(p=>p.id===result.newProject.id).name='Nombre actualizado';const recovered=await f.store.status(session,{...context,operationId});assert.equal(recovered.receiptId,result.receiptId);assert.equal(recovered.newProject.name,'Nombre actualizado');assert.equal(recovered.newProject.status,'PAUSED');projectCreationOutcome(recovered,command());
 await assert.rejects(f.store.read(session,context),{code:'WORKSPACE_PROJECT_UNAVAILABLE'});assert.equal(f.counts.projectInsert,1);
});

test('receipt scope, request digest and creator linkage are checked before accepting recovery',async()=>{
 for(const corrupt of [m=>{m.requestDigest='a'.repeat(64);},m=>{m.createdProjectId='foreign-a';},m=>{m.creatorProjectMembershipId='foreign-membership';},m=>{m.payload.role='ADMIN';}]){const f=fixture();await f.store.save(session,command());corrupt(f.state.receipts[0].metadata);await assert.rejects(f.store.status(session,{...context,operationId}),{code:'PROJECT_CREATION_INTEGRITY'});}
 const f=fixture();await f.store.save(session,command());f.control.member.membershipId='replacement-member';const nextScope=scopeStamp(session,f.control.member);await assert.rejects(f.store.status(session,{projectId:context.projectId,scope:nextScope,operationId}),{code:'PROJECT_CREATION_OPERATION_CONTEXT_CHANGED'});
 const crossTenant=fixture();await crossTenant.store.save(session,command());crossTenant.state.receipts[0].metadata.createdProjectId='foreign-a';crossTenant.state.receipts[0].entityId='foreign-a';crossTenant.state.memberships[0].projectId='foreign-a';await assert.rejects(crossTenant.store.status(session,{...context,operationId}),{code:'PROJECT_CREATION_INTEGRITY'});
 assert.notEqual(projectCreationReceiptId(canonicalMember,context.projectId,operationId),projectCreationReceiptId({...canonicalMember,organizationId:'company-b'},context.projectId,operationId));
});

test('HTTP uses exact parameters, canonical origin, bounded JSON and private no-store responses',async()=>{
 const f=fixture(),handlers=createProjectCreationHandlers({verify:async()=>session,store:f.store}),url='https://obrasaas.com/api/identity/project-creation?'+new URLSearchParams(context),endpoint=url.split('?')[0];
 const response=await handlers.GET(new Request(url));assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);assert.equal(response.headers.get('vary'),'Cookie, Authorization');assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');
 for(const suffix of ['&scope='+scope,'&unknown=1','&operationId=bad','&projectId=foreign-a'])assert.equal((await handlers.GET(new Request(url+suffix))).status,400);
 for(const origin of ['https://foreign.example','http://obrasaas.com'])assert.equal((await handlers.POST(new Request(endpoint,{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(command())}))).status,403);
 assert.equal((await handlers.GET(new Request(url,{headers:{'sec-fetch-site':'cross-site'}}))).status,403);
 assert.equal((await handlers.POST(new Request(endpoint,{method:'POST',headers:{origin:'https://obrasaas.com','Content-Type':'application/json'},body:'x'.repeat(32769)}))).status,413);
 assert.equal((await handlers.POST(new Request(endpoint,{method:'POST',headers:{origin:'https://obrasaas.com','Content-Type':'application/json'},body:'{}'}))).status,422);
 const denied=createProjectCreationHandlers({verify:async()=>({authenticated:false}),store:f.store});assert.equal((await denied.GET(new Request(url))).status,401);
 const unavailable=createProjectCreationHandlers({verify:async()=>({authenticated:false,code:'IDENTITY_PROVIDER_UNAVAILABLE'}),store:f.store});assert.equal((await unavailable.GET(new Request(url))).status,503);
 const saved=await handlers.POST(new Request(endpoint,{method:'POST',headers:{origin:'https://obrasaas.com','Content-Type':'application/json'},body:JSON.stringify(command())}));assert.equal(saved.status,200);assert.equal((await saved.json()).created,true);
});

test('browser receipt validation rejects wrong context, role/tenant injection and false creation claims',async()=>{
 const f=fixture(),snapshot=await f.store.read(session,context),result=await f.store.save(session,command());projectCreationSnapshot(snapshot,context);projectCreationOutcome(result,command());
 for(const value of [{...snapshot,role:'ADMIN'},{...snapshot,projectId:'foreign-a'},{...snapshot,scope:'a'.repeat(64)}])assert.throws(()=>projectCreationSnapshot(value,context));
 for(const change of [{projectId:'foreign-a'},{operationId:randomUUID()},{created:false},{definitive:false},{receiptId:'wrong'},{newProject:{...result.newProject,organizationId:'company-b'}},{newProject:{...result.newProject,id:context.projectId}},{role:'ADMIN'}])assert.equal(projectCreationReceiptOutcome({...result,...change},command()),null);
 const notObserved=await f.store.status(session,{...context,operationId:randomUUID()});assert.equal(projectCreationReceiptOutcome(notObserved,{...context,operationId:notObserved.operationId}).state,'NOT_OBSERVED');assert.equal(projectCreationReceiptOutcome({...notObserved,definitive:true},{...context,operationId:notObserved.operationId}),null);
 for(const status of [401,403,404])assert.equal(projectCreationReadDenied({status}),true);assert.equal(projectCreationReadDenied({code:'WORKSPACE_CONTEXT_CHANGED'}),true);
});

test('HTML denials retain HTTP status and a useful code without displaying a response body',async()=>{
 for(const [status,code] of [[401,'SESSION_REQUIRED'],[403,'PROJECT_CREATION_PERMISSION_REQUIRED'],[404,'WORKSPACE_PROJECT_UNAVAILABLE']])await assert.rejects(readProjectCreationResponse(new Response('<html>private</html>',{status,headers:{'Content-Type':'text/html'}}),context),{status,code});
 await assert.rejects(readProjectCreationResponse(Response.json({code:'WORKSPACE_CONTEXT_CHANGED'},{status:409}),context),{status:409,code:'WORKSPACE_CONTEXT_CHANGED'});
 await assert.rejects(readProjectCreationResponse(new Response('<html>unconfirmed</html>',{status:200}),context),{code:'PROJECT_CREATION_CONTEXT_CHANGED'});
});

test('projection validation runs before lifecycle settlement for initial GET, POST and receipt GET',async()=>{
 const f=fixture(),result=await f.store.save(session,command());
 for(const [url,options,expected,value] of [
  ['/api/identity/project-creation?'+new URLSearchParams(context),{},context,{scope,projectId:context.projectId,canCreate:true,role:'ADMIN'}],
  ['/api/identity/project-creation',{method:'POST',body:JSON.stringify(command())},command(),{...result,created:false}],
  ['/api/identity/project-creation?'+new URLSearchParams({...context,operationId}),{},command(),{...result,operationId:randomUUID()}]
 ]){
  const settlements=[],observations=[],lifecycle=createWorkspaceRequestLifecycle(async()=> 'synthetic-signed-session',{fetchImpl:async()=>Response.json(value),journal:{prepare:async()=>({entry:command()}),settle:async(_ticket,outcome,error)=>settlements.push({outcome,error}),observe:async(...args)=>observations.push(args)}});
  await assert.rejects(lifecycle.request(url,options,response=>readProjectCreationResponse(response,expected)),{code:'PROJECT_CREATION_CONTEXT_CHANGED'});
  assert.equal(settlements.length,1);assert.equal(settlements[0].outcome,null);assert.equal(settlements[0].error.code,'PROJECT_CREATION_CONTEXT_CHANGED');assert.equal(observations.length,0);lifecycle.abort();
 }
});

test('journal and panel validate exactly the same creation receipts, including normalized UUIDs and current status',async()=>{
 const f=fixture(),result=await f.store.save(session,command()),missing=await f.store.status(session,{...context,operationId:randomUUID()}),cases=[[result,command()],[missing,{...context,operationId:missing.operationId}],[null,command()],[[],command()]];
 for(const status of ['PLANNING','ACTIVE','PAUSED','COMPLETED','ARCHIVED'])cases.push([{...result,newProject:{...result.newProject,status}},command()]);
 for(const change of [{scope:'f'.repeat(64)},{projectId:'foreign-a'},{operationId:randomUUID()},{action:'CREATE_ADMIN'},{state:'CANCELLED'},{saved:false},{created:false},{definitive:false},{receiptId:'project_creation_bad'},{replayed:'true'},{newProject:{...result.newProject,id:context.projectId}},{newProject:{...result.newProject,status:'UNKNOWN'}},{newProject:{...result.newProject,role:'ADMIN'}},{newProject:{...result.newProject,name:' padded '}},{newProject:{...result.newProject,name:'Porte\u0301ria'}},{newProject:{...result.newProject,name:'Nombre\u202e'}},{newProject:{...result.newProject,name:'Nombre\ud800'}},{extra:true}])cases.push([{...result,...change},command()]);
 for(const field of Object.keys(result)){const changed={...result};delete changed[field];cases.push([changed,command()]);}
 cases.push([{...result,operationId:operationId.toUpperCase()},{...command(),operationId:operationId.toUpperCase()}]);
 cases.push([{...missing,definitive:true},{...context,operationId:missing.operationId}]);
 for(const [value,reference] of cases)assert.deepEqual(journalProjectCreationReceiptOutcome(value,reference),projectCreationReceiptOutcome(value,reference));
});

test('a lost POST stores only a UUID reference and its exact read-only receipt clears it without another POST',async()=>{
 const f=fixture(),storage=recoveryStorage(),journal=createWorkspaceRecoveryJournal({getStorage:()=>storage,now:()=>123}),dispatched=[];
 const lifecycle=createWorkspaceRequestLifecycle(async()=> 'synthetic-secret-session-token',{journal,fetchImpl:async(url,options)=>{
  assert.equal(options.headers.get('Authorization'),'Bearer synthetic-secret-session-token');dispatched.push(options.method||'GET');
  if(options.method==='POST'){await f.store.save(session,JSON.parse(options.body));throw new TypeError('Synthetic response loss');}
  const params=new URL(url,'https://obrasaas.com').searchParams;return Response.json(await f.store.status(session,Object.fromEntries(params)));
 }});
 await assert.rejects(lifecycle.request('/api/identity/project-creation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(command())},response=>readProjectCreationResponse(response,command())));
 const entries=await journal.list(scope);assert.equal(entries.length,1);assert.deepEqual(Object.keys(entries[0]).sort(),['version','resource','scope','projectId','operationId','createdAt','action'].sort());assert.equal(entries[0].action,'CREATE_PROJECT');
 const stored=JSON.stringify([...storage.values]);assert.doesNotMatch(stored,/Obra adicional|Dirección declarada|Alta solicitada|synthetic-secret-session-token|payload|address|reason|name|bytes/);
 const query=recoveryQuery(entries[0]),params=new URL(query,'https://obrasaas.com').searchParams;assert.equal(params.get('projectId'),context.projectId);assert.equal(params.get('operationId'),operationId);
 const outcome=await lifecycle.request(query,{},response=>readProjectCreationResponse(response,entries[0]));assert.equal(recoveryResult(entries[0],outcome).state,'RECORDED');assert.equal((await journal.list(scope)).length,0);assert.deepEqual(dispatched,['POST','GET']);assert.equal(f.counts.projectInsert,1);lifecycle.abort();
});

test('post-dispatch HTML denials and malformed receipt reads preserve the pending UUID and block another company-wide attempt',async()=>{
 const f=fixture(),result=await f.store.save(session,command());
 for(const status of [401,403,404]){
  const storage=recoveryStorage(),journal=createWorkspaceRecoveryJournal({getStorage:()=>storage,now:()=>123}),lifecycle=createWorkspaceRequestLifecycle(async()=> 'synthetic-token',{journal,fetchImpl:async()=>new Response('<html>denied</html>',{status})});
  await assert.rejects(lifecycle.request('/api/identity/project-creation',{method:'POST',body:JSON.stringify(command())},response=>readProjectCreationResponse(response,command())),error=>error.status===status&&projectCreationReadDenied(error));
  const [entry]=await journal.list(scope);assert.ok(entry);await assert.rejects(journal.prepare('/api/identity/project-creation',{method:'POST',body:JSON.stringify(command({operationId:randomUUID(),projectId:'another-origin'}))}),{code:'WORKSPACE_RECOVERY_REQUIRED'});
  for(const value of [{...result,created:false},{...result,operationId:randomUUID()},{...result,projectId:'another-origin'},{...result,newProject:{...result.newProject,role:'ADMIN'}}]){await journal.observe(recoveryQuery(entry),value);assert.equal((await journal.list(scope)).length,1);}
  const notObserved={scope,projectId:context.projectId,operationId,action:'CREATE_PROJECT',state:'NOT_OBSERVED',saved:false,created:false,definitive:false};await journal.observe(recoveryQuery(entry),notObserved);assert.equal((await journal.list(scope)).length,1);
  await journal.observe(recoveryQuery({...entry,projectId:'another-origin'}),result);assert.equal((await journal.list(scope)).length,1);await journal.observe(recoveryQuery(entry),result);assert.equal((await journal.list(scope)).length,0);lifecycle.abort();
 }
});

test('a failed dispatch removes only a fresh reservation and keeps a pre-existing recovery reference',async()=>{
 for(const prior of [false,true]){
  const storage=recoveryStorage(),journal=createWorkspaceRecoveryJournal({getStorage:()=>storage,now:()=>123});if(prior)await journal.prepare('/api/identity/project-creation',{method:'POST',body:JSON.stringify(command())});let fetches=0;
  const lifecycle=createWorkspaceRequestLifecycle(async()=>{throw new Error('Synthetic session acquisition failure');},{journal,fetchImpl:async()=>{fetches++;return Response.json({});}});
  await assert.rejects(lifecycle.request('/api/identity/project-creation',{method:'POST',body:JSON.stringify(command())},response=>readProjectCreationResponse(response,command())),{requestDispatched:false});assert.equal(fetches,0);assert.equal((await journal.list(scope)).length,prior?1:0);lifecycle.abort();
 }
});
