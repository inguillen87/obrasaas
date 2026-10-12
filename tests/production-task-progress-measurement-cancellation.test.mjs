import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createFieldOperations} from '../src/lib/field-operations-store.mjs';
import {normalizeFieldCommand} from '../src/lib/field-operations-policy.mjs';
import {WorkspaceError} from '../src/lib/workspace-policy.mjs';

const scope='a'.repeat(64),projectId='synthetic-project',taskId='synthetic-task';
const session={authenticated:true,verification:'clerk-production-jwt',userId:'synthetic-clerk',organizationId:'synthetic-org',organizationRole:'org:admin'};
const command=(action,payload,operationId=randomUUID())=>({scope,projectId,operationId,action,payload});
const configure=(operationId,revision='2026-10-12T10:00:00.000001')=>command('CONFIGURE_PROGRESS_MEASUREMENT',{taskId,revision,baseline:'100',unit:'M2',sourceReference:'Synthetic reviewed drawing',reason:'Synthetic responsible reviewed this baseline.'},operationId);
const cancel=operationId=>command('CANCEL_PROGRESS_MEASUREMENT_CONFIGURATION',{taskId},operationId);

// A closed transactional query fixture verifies store branches and rollback.
// Real SQL row locks and current membership guards are tested by the native CLI.
function fixture(){
  let row={id:taskId,title:'Synthetic measured task',progress:0,status:'BACKLOG',metadata:{preserve:true},startsOn:'2026-10-01',endsOn:'2026-10-10',revision:'2026-10-12T10:00:00.000001'},receipts=new Map(),writes=0,failReceipt=false,queue=Promise.resolve();
  const member={actorId:'synthetic-actor',organizationId:'synthetic-organization',role:'ADMIN'};
  const query=async(sql,values=[])=>{
    if(sql.startsWith('SELECT id,metadata FROM public."AuditLog"'))return {rows:receipts.has(values[0])?[structuredClone(receipts.get(values[0]))]:[]};
    if(sql.startsWith('SELECT id,title,progress,status::text AS status,metadata'))return {rows:values[0]===taskId&&values[1]===projectId?[structuredClone(row)]:[]};
    if(sql.startsWith('SELECT clock_timestamp() AS now'))return {rows:[{now:new Date('2026-10-12T10:00:00.000Z')}]};
    if(sql.startsWith('SELECT id,"expiresAt" FROM public."OperationalProposal"')||sql.startsWith('SELECT id FROM public."OperationalProposal"'))return {rows:[]};
    if(sql.startsWith('UPDATE public."Task" SET metadata=')){writes++;row={...row,metadata:JSON.parse(values[2]),revision:'2026-10-12T10:00:00.000002'};return {rowCount:1};}
    if(sql.startsWith('INSERT INTO public."AuditLog"')){if(failReceipt)throw new Error('Synthetic receipt failure');assert.equal(receipts.has(values[0]),false);receipts.set(values[0],{id:values[0],metadata:JSON.parse(values[4])});return {rowCount:1};}
    throw new Error('Unrecognized closed fixture query: '+sql);
  };
  const workspace={async projectOperation(actor,context,writable,callback){
    assert.equal(actor,session);if(context.scope!==scope||context.projectId!==projectId)throw new WorkspaceError('WORKSPACE_CONTEXT_CHANGED',409);
    const previous=queue;let release;queue=new Promise(resolve=>{release=resolve;});await previous;
    const before={row:structuredClone(row),receipts:structuredClone(receipts),writes};
    try{return await callback({query},member,scope,{id:projectId});}
    catch(error){({row,receipts,writes}=before);throw error;}
    finally{release();}
  }};
  const operations=createFieldOperations({workspace});
  return {operations,member,get row(){return structuredClone(row);},set row(value){row=structuredClone(value);},get receipts(){return receipts;},get writes(){return writes;},set failReceipt(value){failReceipt=value;}};
}

test('configuration cancellation accepts only the original scoped UUID and task reference',()=>{
  const input=cancel(randomUUID());assert.deepEqual(normalizeFieldCommand(input),input);
  for(const extra of [{revision:'2026-10-12T10:00:00.000001'},{baseline:'100'},{reason:'Synthetic unapproved extra'},{operationId:randomUUID()}])assert.throws(()=>normalizeFieldCommand({...input,payload:{...input.payload,...extra}}));
  for(const payload of [{},{taskId:'../other'},null])assert.throws(()=>normalizeFieldCommand({...input,payload}));
});

test('durable cancellation fences repeated and delayed configurations without a Task write',async()=>{
  const f=fixture(),operationId=randomUUID(),before=f.row,first=await f.operations.save(session,cancel(operationId));
  assert.deepEqual(Object.keys(first).sort(),['scope','projectId','operationId','action','state','saved','replayed','receiptId','kind','taskId','taskProgressUnchanged'].sort());
  assert.equal(first.state,'CANCELLED');assert.equal(first.saved,false);assert.equal(first.action,'CONFIGURE_PROGRESS_MEASUREMENT');assert.equal(first.replayed,false);assert.equal(first.taskId,taskId);
  const receipt=f.receipts.get(first.receiptId);assert.equal(receipt.metadata.command,'CONFIGURE_PROGRESS_MEASUREMENT');assert.equal(receipt.metadata.requestDigest,null);
  for(const input of [cancel(operationId),configure(operationId),{...configure(operationId),payload:{...configure(operationId).payload,baseline:'200'}}]){
    const result=await f.operations.save(session,input);assert.equal(result.state,'CANCELLED');assert.equal(result.receiptId,first.receiptId);assert.equal(result.replayed,true);
  }
  const read=await f.operations.status(session,{scope,projectId,operationId:operationId.toUpperCase()});assert.equal(read.operationId,operationId);assert.equal(read.state,'CANCELLED');
  assert.deepEqual(f.row,before);assert.equal(f.writes,0);assert.equal(f.receipts.size,1);
  await assert.rejects(f.operations.save(session,{...cancel(operationId),payload:{taskId:'foreign-task'}}),{code:'FIELD_OPERATION_CONFLICT'});
  await assert.rejects(f.operations.save(session,command('CONFIGURE_SITE',{revision:before.revision,sectors:[{id:'sector-a',name:'Synthetic sector',latitude:0,longitude:0,radius:50}]},operationId)),{code:'FIELD_OPERATION_CONFLICT'});
});

test('a committed configuration wins cancellation and returns current plus recorded task snapshots',async()=>{
  const f=fixture(),operationId=randomUUID(),saved=await f.operations.save(session,configure(operationId)),before=f.row;
  const field=before.metadata.fieldOperations;f.row={...before,progress:5,revision:'2026-10-12T10:00:00.000003',metadata:{...before.metadata,fieldOperations:{...field,quantity:{executed:'5.0000',baseline:'100.0000',unit:'M2'},approvedProposalId:'synthetic-approved-proposal',approvedAt:'2026-10-12T10:01:00.000Z'}}};
  const observed=await f.operations.save(session,cancel(operationId));assert.equal(observed.state,'RECORDED');assert.equal(observed.saved,true);assert.equal(observed.receiptId,saved.receiptId);assert.equal(observed.task.measurement.executed,'5.0000');assert.equal(observed.configuredTaskSnapshot.measurement.executed,'0.0000');assert.equal(f.writes,1);assert.equal(f.receipts.size,1);
  await assert.rejects(f.operations.save(session,{...cancel(operationId),payload:{taskId:'foreign-task'}}),{code:'FIELD_OPERATION_CONFLICT'});
});

test('current office authority and web composition are required for closure and recovery',async()=>{
  for(const role of ['SITE_MANAGER','AUDITOR','FINANCE']){
    const f=fixture();f.member.role=role;await assert.rejects(f.operations.save(session,cancel(randomUUID())),{code:'FIELD_PROGRESS_PERMISSION_REQUIRED'});assert.equal(f.receipts.size,0);
  }
  const f=fixture(),operationId=randomUUID();await f.operations.save(session,cancel(operationId));f.member.role='SITE_MANAGER';
  await assert.rejects(f.operations.status(session,{scope,projectId,operationId}),{code:'FIELD_PERMISSION_REQUIRED'});await assert.rejects(f.operations.save(session,configure(operationId)),{code:'FIELD_PERMISSION_REQUIRED'});
  f.member.role='DIRECTOR';f.member.channelProof={version:1};await assert.rejects(f.operations.save(session,cancel(randomUUID())),{code:'FIELD_MEASUREMENT_WEB_ONLY'});await assert.rejects(f.operations.status(session,{scope,projectId,operationId}),{code:'FIELD_MEASUREMENT_WEB_ONLY'});
});

test('receipt failure leaves no cancellation and exact retry closes the original operation once',async()=>{
  const f=fixture(),operationId=randomUUID(),before=f.row;f.failReceipt=true;await assert.rejects(f.operations.save(session,cancel(operationId)));assert.equal(f.receipts.size,0);assert.deepEqual(f.row,before);
  const pending=await f.operations.status(session,{scope,projectId,operationId});assert.equal(pending.state,'NOT_OBSERVED');f.failReceipt=false;await f.operations.save(session,cancel(operationId));assert.equal(f.receipts.size,1);assert.equal(f.writes,0);
});

test('serialized concurrent cancel and delayed POST yield one closure and no baseline mutation',async()=>{
  const f=fixture(),operationId=randomUUID(),before=f.row;
  const results=await Promise.all([f.operations.save(session,cancel(operationId)),f.operations.save(session,configure(operationId))]);assert.deepEqual(results.map(result=>result.state),['CANCELLED','CANCELLED']);assert.deepEqual(f.row,before);assert.equal(f.receipts.size,1);assert.equal(f.writes,0);
});
