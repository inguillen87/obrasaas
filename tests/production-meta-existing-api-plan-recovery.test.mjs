import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceRecoveryJournal,recoveryQuery,recoveryResult,validateWorkspaceRecoveryStoredEntry} from '../src/app/(identity)/cuenta/workspace-recovery-journal.mjs';

const endpoint='/api/identity/meta-onboarding',scope='a'.repeat(64),op='12345678-1234-4234-8234-123456789012',planId='12345678-1234-4234-8234-123456789013';
const prepare=()=>({action:'prepare_existing_api_plan',operationId:op,projectId:'project-a',scope,preparedRevision:1,confirmPreserveProvider:true});
const close=()=>({action:'close_existing_api_plan',operationId:op,projectId:'project-a',scope,planId,confirmLocalClosure:true});
const options=body=>({method:'POST',body:JSON.stringify(body)});
function fixture(){const rows=new Map(),storage={get length(){return rows.size;},key:i=>[...rows.keys()][i]??null,getItem:key=>rows.get(key)??null,setItem:(key,value)=>rows.set(key,value),removeItem:key=>rows.delete(key)};return {rows,journal:createWorkspaceRecoveryJournal({getStorage:()=>storage,now:()=>123}),reload:()=>createWorkspaceRecoveryJournal({getStorage:()=>storage,now:()=>456})};}
function result(entry,state='RECORDED'){
 return {scope:entry.scope,projectId:entry.projectId,existingApiPlanReceipt:{action:entry.action,operationId:entry.operationId,projectId:entry.projectId,scope:entry.scope,planId:entry.planId,state,saved:state==='RECORDED',receiptId:state==='NOT_OBSERVED'?null:'meta_existing_api_'+'b'.repeat(64),recordedAt:state==='NOT_OBSERVED'?null:'2026-10-17T12:00:00.000Z',preparedRevision:state==='NOT_OBSERVED'?null:entry.preparedRevision||1,providerChanged:false,remoteMutationDispatched:false,authorizationGranted:false,code:state==='REJECTED'?'META_CUSTOMER_PREPARATION_CHANGED':null}};
}

test('prepare and close retain only exact identifiers across reload, without confirmations or provider details',async()=>{
 for(const body of [prepare(),close()]){
  const f=fixture(),ticket=await f.journal.prepare(endpoint,options(body));await f.journal.settle(ticket,null,{status:503});
  const entries=await f.reload().list(scope);assert.equal(entries.length,1);const entry=entries[0];
  assert.deepEqual(Object.keys(entry).sort(),['version','resource','action','operationId','planId','projectId','scope','createdAt',...(body.action==='prepare_existing_api_plan'?['preparedRevision']:[])].sort());
  assert.equal(entry.planId,body.planId||body.operationId);assert.doesNotMatch(JSON.stringify([...f.rows]),/confirmPreserveProvider|confirmLocalClosure|encrypted|token|credential|phone|reason/);
  const query=new URL(recoveryQuery(entry),'https://obrasaas.com');assert.equal(query.searchParams.size,5);assert.equal(query.searchParams.get('planId'),entry.planId);assert.equal(query.searchParams.get('action'),entry.action);assert.equal(query.searchParams.has('preparedRevision'),false);
 }
});

test('every error after dispatch retains the operation; only a fresh pre-dispatch failure can remove its reference',async()=>{
 for(const body of [prepare(),close()])for(const status of [400,401,403,409,500,503]){
  const f=fixture(),ticket=await f.journal.prepare(endpoint,options(body));await f.journal.settle(ticket,null,{status,requestDispatched:true});assert.equal((await f.journal.list(scope)).length,1);
 }
 const f=fixture(),ticket=await f.journal.prepare(endpoint,options(prepare()));await f.journal.settle(ticket,null,{status:401,requestDispatched:false});assert.equal((await f.journal.list(scope)).length,0);
 const retained=await f.journal.prepare(endpoint,options(prepare()));await f.journal.settle(retained,null,{status:503});const replay=await f.journal.prepare(endpoint,options(prepare()));assert.equal(replay.existed,true);await f.journal.settle(replay,null,{status:401,requestDispatched:false});assert.equal((await f.journal.list(scope)).length,1);
});

test('latest snapshots, absent receipts and forged receipts never settle a lost commit',async()=>{
 const f=fixture(),ticket=await f.journal.prepare(endpoint,options(prepare())),entry=ticket.entry;await f.journal.settle(ticket,null,{status:503});
 for(const value of [{scope,projectId:'project-a',saved:true,existingApiPlan:{id:op}},result(entry,'NOT_OBSERVED')]){await f.journal.observe(recoveryQuery(entry),value);assert.equal((await f.journal.list(scope)).length,1);}
 const foreign=result(entry);foreign.existingApiPlanReceipt.planId=planId;assert.equal(recoveryResult(entry,foreign),null);await f.journal.observe(recoveryQuery(entry),foreign);assert.equal((await f.journal.list(scope)).length,1);
 const historical={...result(entry),existingApiPlan:{id:planId,state:'ADDITIONAL_AUTHORIZATION_REVIEW_REQUIRED',preparedRevision:2}};
 await f.journal.observe(recoveryQuery(entry),historical);assert.equal((await f.journal.list(scope)).length,0,'the exact historical receipt settles without changing a newer plan');
});

test('GET recovery requires the complete exact query and settles only its own durable success or rejection',async()=>{
 for(const state of ['RECORDED','REJECTED'])for(const body of [prepare(),close()]){
  const f=fixture(),ticket=await f.journal.prepare(endpoint,options(body)),entry=ticket.entry;await f.journal.settle(ticket,null,{status:503});const query=recoveryQuery(entry),value=result(entry,state);
  for(const url of [query+'&planId='+entry.planId,query+'&private=hidden',query.replace(entry.planId,'12345678-1234-4234-8234-123456789014'),query.replace('scope='+scope,'scope='+'c'.repeat(64))]){await f.journal.observe(url,value);assert.equal((await f.journal.list(scope)).length,1);}
  await f.reload().observe(query,value);assert.equal((await f.journal.list(scope)).length,0);
 }
 for(const preparedRevision of [1,3]){
  const body={...prepare(),preparedRevision},f=fixture(),ticket=await f.journal.prepare(endpoint,options(body)),entry=ticket.entry;await f.journal.settle(ticket,null,{status:503});
  const value={...result(entry,'REJECTED'),existingApiPlan:null};value.existingApiPlanReceipt.code='META_CUSTOMER_EXISTING_API_CONNECTION_INCOMPLETE';
  for(const patch of [{operationId:planId},{planId},{preparedRevision:null},{preparedRevision:0},{preparedRevision:preparedRevision+1},{saved:true}]){
   const foreign={...value,existingApiPlanReceipt:{...value.existingApiPlanReceipt,...patch}};assert.equal(recoveryResult(entry,foreign),null);await f.reload().observe(recoveryQuery(entry),foreign);assert.equal((await f.journal.list(scope)).length,1);
  }
  await f.reload().observe(recoveryQuery(entry),value);assert.equal((await f.journal.list(scope)).length,0);
  const immediate=fixture(),sent=await immediate.journal.prepare(endpoint,options(body));await immediate.journal.settle(sent,value);assert.equal((await immediate.journal.list(scope)).length,0);
 }
});

test('a reused UUID with a different revision or target conflicts; another mutation waits for the original receipt',async()=>{
 const f=fixture();await f.journal.prepare(endpoint,options(prepare()));
 await assert.rejects(f.journal.prepare(endpoint,options({...prepare(),preparedRevision:2})),{code:'WORKSPACE_RECOVERY_CONFLICT'});
 await assert.rejects(f.journal.prepare(endpoint,options({...close(),operationId:planId})),{code:'WORKSPACE_RECOVERY_REQUIRED'});
 await assert.rejects(f.journal.prepare(endpoint,options({...close(),operationId:op})),{code:'WORKSPACE_RECOVERY_CONFLICT'});
 assert.equal((await f.journal.list('c'.repeat(64))).length,0);
});

test('a private or malformed command and a tampered stored reference cannot enter the recovery journal',async()=>{
 for(const body of [{...prepare(),token:'private'},{...prepare(),preparedRevision:0},{...close(),confirmLocalClosure:false},{...close(),planId:'foreign'}]){const f=fixture();await assert.rejects(f.journal.prepare(endpoint,options(body)));assert.equal(f.rows.size,0);}
 const f=fixture(),ticket=await f.journal.prepare(endpoint,options(prepare())),[key]=f.rows.keys();
 for(const patch of [{preparedRevision:0},{preparedRevision:2.5},{planId},{scope:'c'.repeat(64)},{private:'secret'}])assert.throws(()=>validateWorkspaceRecoveryStoredEntry(key,JSON.stringify({...ticket.entry,...patch})),{code:'WORKSPACE_RECOVERY_STORAGE_UNAVAILABLE'});
});
