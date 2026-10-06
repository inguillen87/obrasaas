import test from 'node:test';
import assert from 'node:assert/strict';
import {createCompanyChannelHandlers} from '../src/lib/company-channel-http.mjs';
import {WorkspaceError} from '../src/lib/workspace-policy.mjs';
import {createWorkspaceRecoveryJournal,recoveryQuery,recoveryResult,validateWorkspaceRecoveryStoredEntry} from '../src/app/(identity)/cuenta/workspace-recovery-journal.mjs';
import {createWorkspaceRequestLifecycle} from '../src/app/(identity)/cuenta/workspace-request-lifecycle.mjs';
const scope='a'.repeat(64),other='b'.repeat(64),operationId='01234567-89ab-4cde-8fab-0123456789ab',secondId='01234567-89ab-4cde-8fab-0123456789ac';
const session={authenticated:true,verification:'clerk-production-jwt',userId:'user_Synthetic',organizationId:'org_Synthetic',organizationRole:'org:admin'};
const body=(extra={})=>({scope,projectId:'project-a',operationId,action:'ASSIGN',payload:{connectionId:'channel-a',revision:3,targetProjectId:'project-b'},...extra});
const options=(extra={})=>({method:'POST',body:JSON.stringify(body(extra))});
function storage(){const rows=new Map();return {rows,get length(){return rows.size;},key:i=>[...rows.keys()][i]??null,getItem:key=>rows.get(key)??null,setItem:(key,value)=>rows.set(key,value),removeItem:key=>rows.delete(key)};}
function journal(s=storage()){return createWorkspaceRecoveryJournal({getStorage:()=>s,now:()=>123456});}
const outcome=(extra={})=>({scope,projectId:'project-a',operationId,organization:{id:'org-a',name:'Synthetic organization'},actor:{id:'owner',role:'ADMIN'},action:'ASSIGN',state:'REJECTED',saved:false,definitive:true,receiptId:'company_channel_receipt',replayed:false,code:'COMPANY_CHANNEL_REVISION_CHANGED',channel:null,...extra});
test('company references contain only identity scope, original project, operation, action and connection; no target or private payload',async()=>{
 const s=storage(),j=journal(s),ticket=await j.prepare('/api/identity/company-channel',options({payload:{connectionId:'channel-a',revision:3,targetProjectId:'private-target',text:'private-source',token:'private-token'}}));
 assert.deepEqual(Object.keys(ticket.entry).sort(),['action','connectionId','createdAt','operationId','projectId','resource','scope','version']);
 const raw=s.getItem(s.key(0));for(const privateValue of ['private-target','private-source','private-token','revision','payload'])assert.equal(raw.includes(privateValue),false);
 assert.equal(validateWorkspaceRecoveryStoredEntry(s.key(0),raw).projectId,'project-a');assert.equal((await journal(s).list(scope))[0].operationId,operationId);
});
test('unknown company command in A blocks every new company UUID throughout the same organization scope in B',async()=>{
 const j=journal(),ticket=await j.prepare('/api/identity/company-channel',options());
 await assert.rejects(j.prepare('/api/identity/company-channel',options({projectId:'project-b',operationId:secondId})),e=>e.code==='WORKSPACE_RECOVERY_REQUIRED');
 assert.equal((await j.prepare('/api/identity/company-channel',options())).existed,true);
 assert.equal((await j.prepare('/api/identity/company-channel',options({scope:other,projectId:'project-b',operationId:secondId}))).existed,false);
 assert.equal(new URL(recoveryQuery(ticket.entry),'https://obrasaas.com').searchParams.get('projectId'),'project-a');
});
test('dispatched 403/409 and NOT_OBSERVED retain the original company reference, including after a new journal instance',async()=>{
 for(const status of [403,409]){const s=storage(),j=journal(s),transport=createWorkspaceRequestLifecycle(async()=>'synthetic-current-token',{journal:j,fetchImpl:async()=>Response.json({saved:false,code:'WORKSPACE_CONTEXT_CHANGED'},{status})});
  await assert.rejects(transport.request('/api/identity/company-channel',options(),async r=>{throw Object.assign(new Error('Access changed'),{status:r.status});}));transport.abort();
  const fresh=journal(s),entry=(await fresh.list(scope))[0];assert.ok(entry);await fresh.observe(recoveryQuery(entry),outcome({state:'NOT_OBSERVED',saved:false,definitive:false,action:undefined,receiptId:undefined,replayed:undefined,code:undefined,channel:undefined}));assert.equal((await fresh.list(scope)).length,1);
 }
});
test('only the correlated durable terminal receipt resolves a company reference; a 4xx code and snapshot never substitute for it',async()=>{
 const j=journal(),ticket=await j.prepare('/api/identity/company-channel',options());
 for(const invalid of [{scope,saved:true},outcome({operationId:secondId}),outcome({projectId:'project-b'}),outcome({action:'SUSPEND'}),outcome({definitive:false}),outcome({code:'WORKSPACE_CONTEXT_CHANGED'})]){assert.equal(recoveryResult(ticket.entry,invalid),null);await j.observe(recoveryQuery(ticket.entry),invalid);assert.equal((await j.list(scope)).length,1);}
 assert.deepEqual(recoveryResult(ticket.entry,outcome()),{state:'REJECTED',receiptId:'company_channel_receipt'});await j.observe(recoveryQuery(ticket.entry),outcome());assert.equal((await j.list(scope)).length,0);
});
test('a valid uncertain GET does not trigger a POST or create a new UUID, and a failed pre-dispatch retry cannot erase the old reference',async()=>{
 const j=journal(),ticket=await j.prepare('/api/identity/company-channel',options());let gets=0,posts=0;
 const uncertain={scope,projectId:'project-a',operationId,organization:{id:'org-a',name:'Synthetic organization'},actor:{id:'owner',role:'ADMIN'},state:'NOT_OBSERVED',saved:false,definitive:false};
 const transport=createWorkspaceRequestLifecycle(async()=>'synthetic',{journal:j,fetchImpl:async(_url,request)=>{if(request.method==='POST')posts++;else gets++;return Response.json(uncertain);}});
 await transport.request(recoveryQuery(ticket.entry));assert.equal(gets,1);assert.equal(posts,0);assert.equal((await j.list(scope)).length,1);transport.abort();
 const denied=createWorkspaceRequestLifecycle(async()=>null,{journal:j,fetchImpl:async()=>{posts++;}});await assert.rejects(denied.request('/api/identity/company-channel',options()),e=>e.requestDispatched===false);assert.equal((await j.list(scope)).length,1);assert.equal(posts,0);denied.abort();
});
test('tampered company reference cannot retain a command, change action identity or redirect a recovery endpoint',async()=>{
 const s=storage(),j=journal(s),ticket=await j.prepare('/api/identity/company-channel',options());
 for(const entry of [{...ticket.entry,payload:body().payload},{...ticket.entry,action:'BIND'},{...ticket.entry,resource:'https://invalid.example'}])assert.throws(()=>recoveryQuery(entry),TypeError);
 s.setItem(s.key(0),JSON.stringify({...ticket.entry,actor:'client-declared'}));await assert.rejects(j.list(scope),e=>e.code==='WORKSPACE_RECOVERY_STORAGE_UNAVAILABLE');
});
function handlers(verify=async()=>session){const calls=[];return {calls,api:createCompanyChannelHandlers({verify,store:{read:async(s,c)=>{calls.push({kind:'GET',session:s,context:c});return {scope:c.scope,projectId:c.projectId};},command:async(s,b)=>{calls.push({kind:'POST',session:s,body:b});return outcome();}}})};}
const url='https://obrasaas.com/api/identity/company-channel';
test('HTTP uses the independently verified session, exact bounded query and private no-store headers',async()=>{
 const {api,calls}=handlers(),response=await api.GET(new Request(url+'?'+new URLSearchParams({scope,projectId:'project-a',operationId})));assert.equal(response.status,200);assert.equal(calls.length,1);assert.equal(calls[0].session,session);assert.deepEqual(calls[0].context,{scope,projectId:'project-a',operationId});assert.match(response.headers.get('cache-control'),/private, no-store/);assert.equal(response.headers.get('vary'),'Cookie, Authorization');
 for(const query of ['projectId=project-a&scope='+scope+'&actorId=owner','projectId=project-a&scope='+scope+'&scope='+scope,'projectId=project-a&scope='+scope+'&operationId=bad'])assert.equal((await api.GET(new Request(url+'?'+query))).status,400);assert.equal(calls.length,1);
});
test('HTTP refuses foreign origins, cross-site requests, compressed bodies and oversized JSON before entering the command store',async()=>{
 const {api,calls}=handlers();for(const headers of [{'Content-Type':'application/json'},{'Content-Type':'application/json',origin:'https://foreign.invalid'},{'Content-Type':'application/json',origin:'https://obrasaas.com','sec-fetch-site':'cross-site'},{'Content-Type':'application/json',origin:'https://obrasaas.com','content-encoding':'gzip'}])assert.equal((await api.POST(new Request(url,{method:'POST',headers,body:JSON.stringify(body())}))).status,403);
 const huge=await api.POST(new Request(url,{method:'POST',headers:{'Content-Type':'application/json',origin:'https://obrasaas.com'},body:JSON.stringify({text:'x'.repeat(200000)})}));assert.equal(huge.status,413);assert.equal(calls.length,0);
});
test('HTTP authentication failure has no store access and an exact terminal REJECTED receipt remains HTTP200',async()=>{
 const denied=handlers(async()=>({authenticated:false}));assert.equal((await denied.api.GET(new Request(url+'?'+new URLSearchParams({scope,projectId:'project-a'})))).status,401);assert.equal(denied.calls.length,0);
 const valid=handlers(),result=await valid.api.POST(new Request(url,{method:'POST',headers:{'Content-Type':'application/json',origin:'https://obrasaas.com'},body:JSON.stringify(body())}));assert.equal(result.status,200);assert.deepEqual(await result.json(),outcome());assert.equal(valid.calls.length,1);
});
test('HTTP never exposes internal database or private provider diagnostics on an unconfirmed operation',async()=>{
 const api=createCompanyChannelHandlers({verify:async()=>session,store:{read:async()=>{throw new Error('private database credential');},command:async()=>{throw new WorkspaceError('WORKSPACE_CONTEXT_CHANGED',409);}}});const response=await api.GET(new Request(url+'?'+new URLSearchParams({scope,projectId:'project-a'})));assert.equal(response.status,503);assert.deepEqual(await response.json(),{saved:false,code:'COMPANY_CHANNEL_OPERATION_UNCONFIRMED'});
});
