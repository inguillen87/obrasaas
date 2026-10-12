import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceRecoveryJournal,recoveryResult,recoveryQuery} from '../src/app/(identity)/cuenta/workspace-recovery-journal.mjs';
import {createWorkspaceRequestLifecycle} from '../src/app/(identity)/cuenta/workspace-request-lifecycle.mjs';
const scope='a'.repeat(64),operationId='12345678-1234-4123-8123-123456789012',nextId='22345678-1234-4123-8123-123456789012';
function storage(seed=[]){const rows=new Map(seed);return {rows,get length(){return rows.size;},key:index=>[...rows.keys()][index]??null,getItem:key=>rows.get(key)??null,setItem:(key,value)=>rows.set(key,value),removeItem:key=>rows.delete(key)};}
const journal=s=>createWorkspaceRecoveryJournal({getStorage:()=>s,now:()=>123456});
const command=(patch={})=>({method:'POST',body:JSON.stringify({scope,projectId:'synthetic-project',operationId,action:'CONFIGURE_PROGRESS_MEASUREMENT',payload:{taskId:'synthetic-task',revision:'2026-10-12T10:00:00.000001',baseline:'200.0000',unit:'M2',sourceReference:'Private source reference must not persist',reason:'Private configuration reason must not persist'},...patch})});
const measurement={version:'task-progress-measurement-v1',definitionId:'synthetic-definition',baseline:'200.0000',unit:'M2',executed:'0.0000',sourceReference:'Source reviewed by synthetic responsible',configuredAt:'2026-10-12T10:00:00.000Z',approvedProposalId:null,approvedAt:null};
const task={id:'synthetic-task',title:'Synthetic measurement task',progress:0,revision:'2026-10-12T10:00:00.000002',measurement};
const result={scope,projectId:'synthetic-project',operationId,action:'CONFIGURE_PROGRESS_MEASUREMENT',kind:'MEASUREMENT_CONFIGURATION',state:'RECORDED',saved:true,receiptId:'field_'+'c'.repeat(64),task};
test('configuration retains only exact scoped action and task reference across reload',async()=>{
 const s=storage(),j=journal(s),ticket=await j.prepare('/api/identity/field-operations',command());
 assert.deepEqual(Object.keys(ticket.entry).sort(),['action','createdAt','operationId','projectId','resource','scope','taskId','version']);assert.equal(ticket.entry.taskId,task.id);
 const persisted=JSON.stringify([...s.rows]);for(const privateValue of ['200.0000','M2','Private source','Private configuration','baseline','reason'])assert.equal(persisted.includes(privateValue),false);
 assert.deepEqual(await journal(storage(s.rows)).list(scope),[ticket.entry]);assert.deepEqual(await j.list('b'.repeat(64)),[]);
 await assert.rejects(j.prepare('/api/identity/field-operations',command({operationId:nextId})),{code:'WORKSPACE_RECOVERY_REQUIRED'});
 const body=JSON.parse(command().body);body.payload.taskId='foreign-task';await assert.rejects(j.prepare('/api/identity/field-operations',{method:'POST',body:JSON.stringify(body)}),{code:'WORKSPACE_RECOVERY_CONFLICT'});
});
test('ordinary errors and missing receipts preserve the durable configuration attempt',async()=>{
 const s=storage(),j=journal(s),ticket=await j.prepare('/api/identity/field-operations',command());
 for(const status of [401,403,404,409,503]){await j.settle(ticket,null,Object.assign(new Error('synthetic uncertainty'),{status}));assert.equal((await j.list(scope)).length,1);}
 const pending={scope,state:'NOT_OBSERVED',definitive:false};assert.deepEqual(recoveryResult(ticket.entry,pending),{state:'NOT_OBSERVED'});await j.observe(recoveryQuery(ticket.entry),pending);assert.equal((await j.list(scope)).length,1);
});
test('only the exact configuration receipt with valid current and historical measurements settles',async()=>{
 const s=storage(),j=journal(s),ticket=await j.prepare('/api/identity/field-operations',command());
 const current={...task,progress:25,revision:'2026-10-12T10:00:00.000006',measurement:{...measurement,executed:'50.0000',approvedProposalId:'synthetic-proposal',approvedAt:'2026-10-12T10:05:00.000Z'}};
 const recorded={...result,task:current,configuredTaskSnapshot:task};assert.deepEqual(recoveryResult(ticket.entry,recorded),{state:'RECORDED',receiptId:result.receiptId});
 for(const patch of [{operationId:nextId},{projectId:'foreign-project'},{scope:'b'.repeat(64)},{action:'DECIDE_PROGRESS'},{kind:'PROGRESS_DECISION'},{task:{...current,id:'foreign-task'}},{task:{...current,progress:20}},{configuredTaskSnapshot:{...task,measurement:{...measurement,configuredBy:'private-actor'}}},{configuredTaskSnapshot:{...task,measurement:{...measurement,baseline:'0.0000'}}}]){assert.equal(recoveryResult(ticket.entry,{...recorded,...patch}),null);await j.settle(ticket,{...recorded,...patch});assert.equal((await j.list(scope)).length,1);}
 await j.observe(recoveryQuery(ticket.entry),recorded);assert.equal((await j.list(scope)).length,0);
});
test('failed cleanup after confirmed configuration keeps the reference and blocks another UUID',async()=>{
 const s=storage(),j=journal(s),ticket=await j.prepare('/api/identity/field-operations',command());s.removeItem=()=>{throw new Error('synthetic cleanup failure');};await j.settle(ticket,result);assert.equal((await j.list(scope)).length,1);await assert.rejects(j.prepare('/api/identity/field-operations',command({operationId:nextId})),{code:'WORKSPACE_RECOVERY_REQUIRED'});
});
test('durable reservation failure prevents the actual POST dispatch',async()=>{
 const s=storage();s.setItem=()=>{};let dispatched=0;const runtime=createWorkspaceRequestLifecycle(async()=>'synthetic-session',{journal:journal(s),fetchImpl:async()=>{dispatched++;throw new Error('must not dispatch');}});
 await assert.rejects(runtime.request('/api/identity/field-operations',command()));assert.equal(dispatched,0);runtime.abort();
});
test('explicit closure reuses the original scoped reference and releases only its cancellation receipt',async()=>{
 const s=storage(),j=journal(s),first=await j.prepare('/api/identity/field-operations',command());
 const close=await j.prepare('/api/identity/field-operations',command({action:'CANCEL_PROGRESS_MEASUREMENT_CONFIGURATION',payload:{taskId:task.id}}));assert.equal(close.existed,true);assert.deepEqual(close.entry,first.entry);
 const cancelled={scope,projectId:'synthetic-project',operationId,action:'CONFIGURE_PROGRESS_MEASUREMENT',state:'CANCELLED',saved:false,replayed:false,receiptId:'field_'+'c'.repeat(64),kind:'MEASUREMENT_CONFIGURATION_CANCELLED',taskId:task.id,taskProgressUnchanged:true};
 for(const patch of [{taskId:'foreign-task'},{taskProgressUnchanged:false},{action:'CANCEL_PROGRESS_MEASUREMENT_CONFIGURATION'},{task},{receiptId:null}]){assert.equal(recoveryResult(first.entry,{...cancelled,...patch}),null);await j.settle(close,{...cancelled,...patch});assert.equal((await j.list(scope)).length,1);}
 await j.settle(close,cancelled);assert.equal((await j.list(scope)).length,0);await j.prepare('/api/identity/field-operations',command({operationId:nextId}));assert.equal((await j.list(scope))[0].operationId,nextId);
});
