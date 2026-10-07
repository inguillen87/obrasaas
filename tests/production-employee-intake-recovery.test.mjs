import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceRecoveryJournal,recoveryResult,recoveryQuery} from '../src/app/(identity)/cuenta/workspace-recovery-journal.mjs';
import {createWorkspaceRequestLifecycle} from '../src/app/(identity)/cuenta/workspace-request-lifecycle.mjs';
const scope='a'.repeat(64),operationId='01234567-89ab-4cde-8fab-0123456789ab',applicationId='customer_webhook_'+'c'.repeat(64),receiptId='participant_'+'d'.repeat(64);
function fixture(){const rows=new Map(),storage={get length(){return rows.size;},key:i=>[...rows.keys()][i],getItem:k=>rows.get(k)||null,setItem:(k,v)=>rows.set(k,v),removeItem:k=>rows.delete(k)};return {rows,journal:createWorkspaceRecoveryJournal({getStorage:()=>storage,now:()=>123456}),storage};}
const body=()=>({scope,projectId:'project-b',operationId,action:'ADMIT_EMPLOYEE_INTAKE',payload:{connectionId:'connection-a',applicationId,expectedRevision:5,job:'WORKER',permissions:{attendance:false,report:true},confirmed:true,privateName:'Synthetic private name',email:'private@example.invalid',phone:'+15550001001'}});
const saved=()=>({scope,projectId:'project-b',operationId,action:'ADMIT_EMPLOYEE_INTAKE',connectionId:'connection-a',applicationId,receiptId,state:'RECORDED',saved:true,permissionsGranted:false});
test('lost guest admission ACK persists only typed UUID and scoped context, reload GET settles without another POST',async()=>{
 const f=fixture();let posts=0,gets=0;const first=createWorkspaceRequestLifecycle(async()=>'synthetic-token',{journal:f.journal,fetchImpl:async()=>{posts++;throw new TypeError('Lost response');}});
 await assert.rejects(first.request('/api/identity/participants',{method:'POST',body:JSON.stringify(body())}));first.abort();const entry=(await f.journal.list(scope))[0];assert.ok(entry);const bytes=JSON.stringify([...f.rows]);for(const secret of ['Synthetic private name','private@example.invalid','15550001001','WORKER','attendance','expectedRevision','synthetic-token'])assert.equal(bytes.includes(secret),false,secret);
 assert.deepEqual(Object.keys(entry).sort(),['action','applicationId','connectionId','createdAt','operationId','projectId','resource','scope','version']);
 const reloaded=createWorkspaceRecoveryJournal({getStorage:()=>f.storage,now:()=>123457});const second=createWorkspaceRequestLifecycle(async()=>'synthetic-fresh-token',{journal:reloaded,fetchImpl:async(_url,options)=>{assert.equal(options.method||'GET','GET');gets++;return Response.json(saved());}});assert.equal((await second.request(recoveryQuery(entry))).state,'RECORDED');assert.equal(posts,1);assert.equal(gets,1);assert.deepEqual(await reloaded.list(scope),[]);second.abort();
});
test('wrong UUID/action/channel/application/project/scope cannot settle the prior attempt by POST or reload GET',async()=>{
 for(const [field,value] of [['operationId','01234567-89ab-4cde-8fab-0123456789ac'],['action','REJECT_EMPLOYEE_INTAKE'],['connectionId','other-channel'],['applicationId','customer_webhook_'+'e'.repeat(64)],['projectId','other-project'],['scope','b'.repeat(64)]]){
  const f=fixture(),ticket=await f.journal.prepare('/api/identity/participants',{method:'POST',body:JSON.stringify(body())}),result={...saved(),[field]:value};assert.equal(recoveryResult(ticket.entry,result),null);await f.journal.settle(ticket,result);await f.journal.observe(recoveryQuery(ticket.entry),result);assert.equal((await f.journal.list(scope)).length,1,field);assert.deepEqual(await f.journal.list('b'.repeat(64)),[]);
 }
});
test('403, malformed response and NOT_OBSERVED retain unknown; only exact durable PRE_RECORD rejection settles',async()=>{
 const f=fixture(),ticket=await f.journal.prepare('/api/identity/participants',{method:'POST',body:JSON.stringify(body())});await f.journal.settle(ticket,null,{status:403,requestDispatched:true});assert.equal((await f.journal.list(scope)).length,1);
 await f.journal.observe(recoveryQuery(ticket.entry),{scope,state:'NOT_OBSERVED',definitive:false});assert.equal((await f.journal.list(scope)).length,1);
 const rejected={...saved(),state:'REJECTED',saved:false,definitive:true,code:'EMPLOYEE_INTAKE_REVISION_CHANGED',phase:'PRE_RECORD'};
 for(const mutation of [{definitive:false},{phase:'AFTER_SEND'},{code:'PARTICIPANT_INVITE_REQUIRED'},{workerId:'worker-a'},{personReceiptId:'site_invalid'},{saved:true},{receiptId:null}])assert.equal(recoveryResult(ticket.entry,{...rejected,...mutation}),null);
 assert.equal(recoveryResult(ticket.entry,rejected).state,'REJECTED');await f.journal.observe(recoveryQuery(ticket.entry),rejected);assert.deepEqual(await f.journal.list(scope),[]);
});
test('configuration is typed without an application and a nondispatched retry preserves an earlier unknown',async()=>{
 const f=fixture(),b={...body(),action:'CONFIGURE_EMPLOYEE_INTAKE',payload:{connectionId:'connection-a',expectedRevision:1,enabled:false,confirmed:true}},ticket=await f.journal.prepare('/api/identity/participants',{method:'POST',body:JSON.stringify(b)});assert.equal(ticket.entry.applicationId,undefined);
 const second=await f.journal.prepare('/api/identity/participants',{method:'POST',body:JSON.stringify(b)});await f.journal.settle(second,null,{requestDispatched:false});assert.equal((await f.journal.list(scope)).length,1);
 assert.equal(recoveryResult(ticket.entry,{...saved(),action:b.action,applicationId:null}).state,'RECORDED');assert.equal(recoveryResult(ticket.entry,{...saved(),action:b.action}),null);
});
