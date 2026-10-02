import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {WorkspaceError,organizationFromVerifiedClaims,requireWorkspaceIdentity,scopeStamp,checkScope,validateScheduleChange,calendarDate,workspaceConnectionConfig,managesSchedule,portfolioAccess,scheduleRequestDigest,scheduleReceiptId} from '../src/lib/workspace-policy.mjs';
import {createWorkspaceHandlers} from '../src/lib/workspace-http.mjs';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
const session={authenticated:true,verification:'clerk-production-jwt',userId:'user_TestA',organizationId:'org_TestA',organizationRole:'org:member'};
const member={membershipId:'membership-a',organizationId:'organization-a',role:'SITE_MANAGER'};
const scope=scopeStamp(session,member);
const change=()=>({operationId:'12345678-1234-4234-8234-123456789012',projectId:'project-a',taskId:'task-a',scope,expectedRevision:'2026-09-30T12:00:00.123456',startsOn:'2026-10-01',endsOn:'2026-10-10',reason:'Revisión de planificación acordada'});

test('signed-claim adapters support Clerk v1 and v2 without granting permissions',()=>{
 const expected={organizationId:'org_TestA',organizationRole:'org:member'};
 assert.deepEqual(organizationFromVerifiedClaims({org_id:'org_TestA',org_role:'org:member'}),expected);
 assert.deepEqual(organizationFromVerifiedClaims({o:{id:'org_TestA',rol:'member'}}),expected);
 assert.deepEqual(organizationFromVerifiedClaims({org_id:'org_TestA',org_role:'org:member',o:{id:'org_TestA',rol:'member'}}),expected);
});
for(const input of [{},{org_id:'org_TestA'},{org_role:'org:admin'},{o:[]},{o:{id:'org_TestA'}},{o:{id:'another',rol:'admin'}},{org_id:'org_TestA',org_role:'org:member',o:{id:'org_Other',rol:'admin'}},{org_id:'org_TestA',org_role:'org:member',o:{id:'org_TestA',rol:'admin'}}])test('ambiguous organization remains personal '+JSON.stringify(input),()=>assert.equal(organizationFromVerifiedClaims(input),null));
for(const input of [null,{}, {...session,authenticated:false},{...session,verification:'browser-flag'},{...session,userId:'other'}])test('invalid identity never opens canonical data '+JSON.stringify(input),()=>assert.throws(()=>requireWorkspaceIdentity(input),{code:'SESSION_REQUIRED'}));
test('personal account cannot select an organization in a request',()=>assert.throws(()=>requireWorkspaceIdentity({...session,organizationId:undefined}),{code:'WORKSPACE_ORGANIZATION_REQUIRED'}));
for(const role of ['ADMIN','DIRECTOR','SITE_MANAGER'])test('explicit planning role '+role,()=>assert.equal(managesSchedule(role),true));
for(const role of ['AUDITOR','FINANCE','org:admin','SUPERADMIN',null,'toString'])test('other role cannot plan '+String(role),()=>assert.equal(managesSchedule(role),false));
test('site manager requires project membership, no portfolio promotion',()=>{assert.equal(portfolioAccess('SITE_MANAGER'),false);assert.equal(portfolioAccess('ADMIN'),true);});
test('scope changes on organization, identity, role or membership changes',()=>{
 for(const patch of [{userId:'user_Other'},{organizationId:'org_Other'},{organizationRole:'org:admin'}])assert.notEqual(scopeStamp({...session,...patch},member),scope);
 for(const patch of [{membershipId:'other'},{organizationId:'other'},{role:'AUDITOR'}])assert.notEqual(scopeStamp(session,{...member,...patch}),scope);
 assert.throws(()=>checkScope(scope,'a'.repeat(64)),{code:'WORKSPACE_CONTEXT_CHANGED'});
});
for(const date of ['2026-02-29','2026-13-01','2026-10-00','2026-1-01','2026-10-01T00:00:00Z','invalid',null])test('invalid planning date '+String(date),()=>assert.equal(calendarDate(date),false));
test('valid leap and calendar dates remain date-only',()=>{assert.equal(calendarDate('2028-02-29'),true);assert.equal(calendarDate('2026-10-01'),true);});
for(const mutate of [c=>{c.role='ADMIN';},c=>{delete c.reason;},c=>{c.endsOn='2026-09-01';},c=>{c.startsOn='2026-02-29';},c=>{c.reason='';},c=>{c.operationId='short';},c=>{c.projectId='../other';},c=>{c.scope='unknown';},c=>{c.expectedRevision='2026-09-30T12:00:00.123';}])test('invalid write contract '+String(mutate),()=>{const c=change();mutate(c);assert.throws(()=>validateScheduleChange(c),WorkspaceError);});
test('request fingerprint binds dates, reason, task, scope and original revision',()=>{
 const original=validateScheduleChange(change());for(const patch of [{endsOn:'2026-10-11'},{taskId:'other'},{reason:'Different approved reason'},{expectedRevision:'2026-09-30T12:00:00.123457'}])assert.notEqual(scheduleRequestDigest({...original,...patch}),scheduleRequestDigest(original));
 assert.notEqual(scheduleReceiptId('user-a','p-a',original.operationId),scheduleReceiptId('user-b','p-a',original.operationId));
});
test('database TLS cannot be weakened by URL parameters',()=>{
 const url='postgresql://test:synthetic@ep-fixture.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
 const config=workspaceConnectionConfig({DATABASE_URL:url});assert.equal(config.ssl.rejectUnauthorized,true);assert.equal(config.connectionString,undefined);assert.equal(config.max,3);
 for(const input of [url.replace('require&','disable&'),url+'&sslrootcert=other',url+'&options=-csearch_path=evil',url.replace('neondb?','another?'),url.replace('ep-fixture.sa-east-1.aws.neon.tech','localhost')])assert.throws(()=>workspaceConnectionConfig({DATABASE_URL:input}),{code:'WORKSPACE_DATABASE_UNAVAILABLE'});
});
function http({identity=session,fail=null}={}){
 const calls=[];const action=name=>async(...args)=>{calls.push({name,args});if(fail)throw fail;return {scope,saved:name==='schedule'};};
 return {calls,handlers:createWorkspaceHandlers({verify:async()=>identity,store:Object.fromEntries(['list','read','schedule','status'].map(name=>[name,action(name)]))})};
}
const request=(method='GET',body=null,extra={},query='')=>new Request('https://obrasaas.com/api/identity/workspace'+query,{method,headers:{...(method==='POST'?{'content-type':'application/json',origin:'https://obrasaas.com'}:{}),...extra},...(body!==null?{body:typeof body==='string'?body:JSON.stringify(body)}:{})});
test('anonymous denial happens before body or database access',async()=>{const h=http({identity:{authenticated:false}});const result=await h.handlers.POST(request('POST','{'));assert.equal(result.status,401);assert.equal(h.calls.length,0);});
test('provider outage remains unavailable rather than a login success',async()=>{const h=http({identity:{authenticated:false,code:'IDENTITY_PROVIDER_UNAVAILABLE'}});assert.equal((await h.handlers.GET(request())).status,503);assert.equal(h.calls.length,0);});
for(const origin of ['https://other.example','null','','http://obrasaas.com'])test('cross-origin write rejected '+origin,async()=>{const h=http();assert.equal((await h.handlers.POST(request('POST',change(),{origin}))).status,403);assert.equal(h.calls.length,0);});
for(const query of ['?organizationId=other','?projectId=p&projectId=q','?scope=abc','?projectId=../other&scope='+scope])test('untrusted scope/query rejected '+query,async()=>{const h=http();assert.equal((await h.handlers.GET(request('GET',null,{},query))).status,400);assert.equal(h.calls.length,0);});
test('valid request passes the server-verified identity, never body role',async()=>{const h=http();const result=await h.handlers.POST(request('POST',change()));assert.equal(result.status,200);assert.deepEqual(h.calls[0].args[0],session);assert.equal(result.headers.get('cache-control'),'private, no-store, max-age=0');});
test('body byte limit checked even without content-length',async()=>{const h=http();assert.equal((await h.handlers.POST(request('POST','x'.repeat(32769)))).status,413);assert.equal(h.calls.length,0);});
test('raw database/provider failures are not reflected to the user',async()=>{const h=http({fail:new Error('private-database-secret')});const result=await h.handlers.GET(request());assert.equal(result.status,503);assert.doesNotMatch(await result.text(),/private-database-secret/);});
test('read endpoints are no-store and do not enable other methods',async()=>{const h=http();assert.equal((await h.handlers.GET(request())).status,200);assert.equal((await h.handlers.GET(request('DELETE'))).status,405);});
test('missing database membership never reaches project data and rolls back',async()=>{
 const calls=[];let released=false;
 const store=createWorkspaceStore({connect:async()=>({query:async(sql)=>{calls.push(sql);return {rows:[]};},release:()=>{released=true;}})});
 await assert.rejects(store.list(session),{code:'WORKSPACE_MEMBERSHIP_REQUIRED'});assert.equal(released,true);assert.equal(calls.at(-1),'ROLLBACK');assert.ok(!calls.some(sql=>sql.includes('FROM public."Task"')));
});

test('real planning receipt recovery confirms recorded writes and leaves absent receipts uncertain',async()=>{
 const calls=[],actor={...member,actorId:'actor-a',organizationName:'Synthetic organization'},receiptId=scheduleReceiptId(actor.actorId,'project-a',change().operationId);
 const savedTask={id:'task-a',title:'Synthetic task',status:'IN_PROGRESS',progress:37,startsOn:'2026-10-01',endsOn:'2026-10-10',revision:'2026-10-01T12:00:00.123456'};
 let recorded=true;
 const store=createWorkspaceStore({connect:async()=>({query:async(sql,values)=>{
  calls.push(sql);
  if(sql.includes('FROM public."PlatformUser"'))return {rows:[actor]};
  if(sql.includes('FROM public."ProjectMembership"'))return {rows:[{id:'project-member-a'}]};
  if(sql.includes('FROM public."Project"'))return {rows:[{id:'project-a',name:'Synthetic worksite',status:'ACTIVE'}]};
  if(sql.includes('FROM public."AuditLog"')){assert.deepEqual(values,[receiptId,actor.actorId,actor.organizationId]);return {rows:recorded?[{id:receiptId,entityId:savedTask.id,recordedAt:savedTask.revision,metadata:{projectId:'project-a',before:{startsOn:null,endsOn:null},after:{startsOn:savedTask.startsOn,endsOn:savedTask.endsOn}}}]:[]};}
  if(sql.includes('FROM public."Task"'))return {rows:[savedTask]};
  return {rows:[]};
 },release:()=>{}})});
 const handlers=createWorkspaceHandlers({verify:async()=>session,store});
 const query='?'+new URLSearchParams({projectId:'project-a',scope,operationId:change().operationId});
 const response=await handlers.GET(request('GET',null,{},query)),result=await response.json();
 assert.equal(response.status,200);assert.match(response.headers.get('Cache-Control'),/no-store/);
 assert.equal(result.state,'RECORDED');assert.equal(result.saved,true);assert.equal(result.receipt.id,receiptId);assert.equal(result.receipt.taskId,result.task.id);assert.deepEqual(result.task,savedTask);
 recorded=false;
 assert.deepEqual(await (await handlers.GET(request('GET',null,{},query))).json(),{scope,state:'NOT_OBSERVED',definitive:false});
 assert.ok(calls.includes('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'));assert.ok(!calls.some(sql=>/^(INSERT|UPDATE|DELETE|COMMIT)\b/.test(sql)));
});
test('workspace never reads global state, rotates Meta credentials or disables TLS',()=>{
 const files=['workspace-policy.mjs','workspace-store.mjs','workspace-http.mjs','workspace-runtime.mjs'].map(path=>readFileSync(new URL('../src/lib/'+path,import.meta.url),'utf8')).join('\n');
 assert.doesNotMatch(files,/getAppState|saveAppState|obrasaas_app_state|rejectUnauthorized:\s*false|META_WHATSAPP_ACCESS_TOKEN|CLERK_SECRET_KEY/);
 const store=readFileSync(new URL('../src/lib/workspace-store.mjs',import.meta.url),'utf8');
 assert.match(store,/FOR SHARE OF u,m,o/);assert.match(store,/FOR UPDATE OF t/);assert.match(store,/task.schedule.reviewed/);assert.doesNotMatch(store,/UPDATE public\."Task" SET progress|UPDATE public\."Worker"/);
});
