import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceRecoveryJournal,recoveryQuery,recoveryResult,validateWorkspaceRecoveryStoredEntry,WORKSPACE_RECOVERY_PREFIX,FIELD_OVERTIME_RECOVERY_ACTIONS} from '../src/app/(identity)/cuenta/workspace-recovery-journal.mjs';
import {createWorkspaceRequestLifecycle} from '../src/app/(identity)/cuenta/workspace-request-lifecycle.mjs';
const scope='a'.repeat(64),projectId='synthetic-overtime-project',operationId='11111111-1111-4111-8111-111111111111',otherOperation='22222222-2222-4222-8222-222222222222',receiptId='field_'+'b'.repeat(64);
function storage(){const rows=new Map();return {get length(){return rows.size;},key:index=>[...rows.keys()][index]??null,getItem:key=>rows.get(key)??null,setItem:(key,value)=>rows.set(key,value),removeItem:key=>rows.delete(key),rows};}
const journal=storage=>createWorkspaceRecoveryJournal({getStorage:()=>storage,now:()=>123456});
const options=action=>({method:'POST',body:JSON.stringify({scope,projectId,operationId,action,payload:{reason:'PRIVATE_SYNTHETIC_REASON',workerId:'private-worker'}})});
const recorded=action=>({scope,projectId,operationId,action,state:'RECORDED',saved:true,receiptId});
for(const action of FIELD_OVERTIME_RECOVERY_ACTIONS){
 test(action+' keeps only its exact action and receipt reference across reload',async()=>{
  const s=storage(),first=journal(s),ticket=await first.prepare('/api/identity/field-operations',options(action)),entry=(await journal(s).list(scope))[0];assert.deepEqual(Object.keys(entry).sort(),['action','createdAt','operationId','projectId','resource','scope','version']);assert.equal(entry.action,action);assert.doesNotMatch(JSON.stringify([...s.rows]),/PRIVATE_SYNTHETIC_REASON|private-worker|payload/);assert.equal(new URL('https://synthetic.invalid'+recoveryQuery(entry)).searchParams.has('action'),false,'Expected action is local metadata, not a new GET parameter');assert.deepEqual(recoveryResult(entry,recorded(action)),{state:'RECORDED',receiptId});await first.settle(ticket,recorded(action));assert.equal((await first.list(scope)).length,0);
 });
 test(action+' never settles or observes an unrelated or malformed recorded result',async()=>{
  const s=storage(),j=journal(s),ticket=await j.prepare('/api/identity/field-operations',options(action)),entry=ticket.entry,correct=recorded(action),variants=[{...correct,operationId:otherOperation},{...correct,action:'ATTENDANCE'},{...correct,action:undefined},{...correct,operationId:undefined},{...correct,projectId:undefined},{...correct,receiptId:'not-a-field-receipt'},{...correct,state:'PROCESSING',definitive:false},{scope,projectId,operationId:otherOperation,state:'NOT_OBSERVED',definitive:false}];
  for(const result of variants){assert.equal(recoveryResult(entry,result),null);await j.settle(ticket,result);await j.observe(recoveryQuery(entry),result);assert.equal((await j.list(scope)).length,1);}
  assert.deepEqual(recoveryResult(entry,{scope,projectId,operationId,state:'NOT_OBSERVED',definitive:false}),{state:'NOT_OBSERVED'});await j.observe(recoveryQuery(entry),correct);assert.equal((await j.list(scope)).length,0);
 });
}
test('overtime journal validates its stored action and preserves older field references',async()=>{
 const s=storage(),j=journal(s),ticket=await j.prepare('/api/identity/field-operations',options('ATTENDANCE'));assert.equal(Object.hasOwn(ticket.entry,'action'),false);assert.deepEqual(recoveryResult(ticket.entry,{scope,state:'RECORDED',saved:true,receiptId:'legacy-receipt'}),{state:'RECORDED',receiptId:'legacy-receipt'});const altered={...ticket.entry,action:'ATTENDANCE'},key=WORKSPACE_RECOVERY_PREFIX+scope+'.field-operations.'+operationId;assert.throws(()=>validateWorkspaceRecoveryStoredEntry(key,JSON.stringify(altered)));await j.settle(ticket,{scope,saved:true,receiptId:'legacy-receipt'});assert.equal((await j.list(scope)).length,0);
});
test('an overtime 200 response with another UUID leaves the committed reference and a reload can recover it without POST',async()=>{
 const s=storage(),j=journal(s);let posts=0,gets=0;
 const first=createWorkspaceRequestLifecycle(async()=>'synthetic-token',{journal:j,fetchImpl:async()=>{posts++;return Response.json({...recorded('PROPOSE_OVERTIME'),operationId:otherOperation});}});await first.request('/api/identity/field-operations',options('PROPOSE_OVERTIME'));assert.equal((await j.list(scope)).length,1);first.abort();
 const fresh=journal(s),entry=(await fresh.list(scope))[0],second=createWorkspaceRequestLifecycle(async()=>'synthetic-token',{journal:fresh,fetchImpl:async(_url,options)=>{assert.equal(options.method||'GET','GET');gets++;return Response.json(recorded('PROPOSE_OVERTIME'));}});await second.request(recoveryQuery(entry));assert.equal((await fresh.list(scope)).length,0);assert.equal(posts,1);assert.equal(gets,1);second.abort();
});
