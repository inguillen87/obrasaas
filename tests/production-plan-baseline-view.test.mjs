import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {planBaselineHarness,session} from './fixtures/plan-baseline-synthetic.mjs';
import {planBaselineSelectionDigest} from '../src/lib/plan-baseline-policy.mjs';
import {planBaselineCandidateView,planBaselineActiveView,planBaselineListView,planBaselineOutcome,planBaselineCommandDigest,planBaselineSelectionCommandView} from '../src/app/(identity)/cuenta/plan-baseline-view.mjs';
import {createWorkspaceRecoveryJournal,recoveryQuery,recoveryResult,WORKSPACE_RECOVERY_PREFIX,validateWorkspaceRecoveryStoredEntry} from '../src/app/(identity)/cuenta/workspace-recovery-journal.mjs';
import {createWorkspaceRequestLifecycle} from '../src/app/(identity)/cuenta/workspace-request-lifecycle.mjs';

function storage(seed=[]){const rows=new Map(seed);return {get length(){return rows.size;},key:i=>[...rows.keys()][i]??null,getItem:key=>rows.get(key)??null,setItem:(key,value)=>rows.set(key,value),removeItem:key=>rows.delete(key),rows};}
const journal=s=>createWorkspaceRecoveryJournal({getStorage:()=>s,now:()=>123456});
const post=body=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
async function values(){const h=await planBaselineHarness({sources:2}),input=h.input(),result=await h.baselines.select(session,input);return {h,input,result,reference:{...h.context(),operationId:input.operationId,inputDigest:await planBaselineCommandDigest(input)}};}

test('client digest and normalized command match the actual server command contract',async()=>{
 const h=await planBaselineHarness(),input=h.input();
 assert.equal(await planBaselineCommandDigest(input),planBaselineSelectionDigest(input));
 const spaced={...input,operationId:input.operationId.toUpperCase(),reason:'  Reviewed source selection  '};
 assert.equal(await planBaselineCommandDigest(spaced),planBaselineSelectionDigest(spaced));
 assert.equal(planBaselineSelectionCommandView(spaced).reason,'Reviewed source selection');
 for(const patch of [{confirmed:false},{currency:'ARS'},{reason:'Short'},{reason:'Private\ntext'},{expectedBaselineId:null,expectedBaselineRevision:1},{expectedBaselineId:'foreign-id',expectedBaselineRevision:1},{draftRevision:1},{sourceSha256:'?'},{action:'APPLY'}])assert.throws(()=>planBaselineSelectionCommandView({...input,...patch}));
});
test('list and active project projections preserve exact source values and current receipt',async()=>{
 const {h,result}=await values(),list=await h.baselines.read(session,h.context());
 assert.equal(planBaselineListView(list,h.context()),list);assert.equal(planBaselineActiveView(result.active),result.active);
 assert.equal(result.active.curve.total.cachedValue,'12345678901234567890.1234500');assert.equal(result.active.curve.currency,null);assert.equal(result.active.curve.calendarStart,null);
 assert.ok(list.candidates.every(value=>planBaselineCandidateView(value)===value));
});
test('client rejects raw padded controls and overlong reasons before the journal can reserve them',async()=>{
 const h=await planBaselineHarness(),input=h.input();
 for(const reason of ['\nReviewed source choice\n',' '.repeat(800)+'Reviewed source choice']){
  assert.throws(()=>planBaselineSelectionCommandView({...input,reason}));
  await assert.rejects(planBaselineCommandDigest({...input,reason}));
  const s=storage(),j=journal(s);await assert.rejects(j.prepare('/api/identity/plan-baseline',post({...input,reason})),{code:'WORKSPACE_RECOVERY_STORAGE_UNAVAILABLE'});assert.equal(s.rows.size,0);
 }
});
test('private list rejects scope confusion, extra authority flags, duplicate and incomplete pagination',async()=>{
 const h=await planBaselineHarness(),list=await h.baselines.read(session,h.context());
 for(const patch of [{scope:'f'.repeat(64)},{projectId:'foreign-project'},{canSelect:false},{canManage:true},{nextCursor:'cursor-without-full-page'},{candidates:[list.candidates[0],list.candidates[0]]},{active:undefined}])assert.throws(()=>planBaselineListView({...list,...patch},h.context()));
});
test('candidate validation rejects invented dates, currency, partial curve, invalid counters and foreign schema',async()=>{
 const h=await planBaselineHarness(),value=(await h.baselines.read(session,h.context())).candidates[0];
 for(const patch of [{draftRevision:1},{sourceRowCount:201},{selectedRowCount:0},{selectedRowCount:5},{profile:'UNKNOWN'},{curve:{...value.curve,currency:'ARS'}},{curve:{...value.curve,calendarStart:'2026-10-13'}},{curve:{...value.curve,periods:value.curve.periods.slice(0,2)}},{curve:{...value.curve,total:{...value.curve.total,cachedValue:'NaN'}}}])assert.throws(()=>planBaselineCandidateView({...value,...patch}));
});
test('receipt validator binds exact operation and digest and accepts jsonb key reordering',async()=>{
 const {result,reference}=await values();assert.equal(planBaselineOutcome(result,reference).state,'RECORDED');
 const reorder=value=>Array.isArray(value)?value.map(reorder):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).reverse().map(([key,item])=>[key,reorder(item)])):value;
 assert.equal(planBaselineOutcome({...result,active:reorder(result.active)},reference).state,'RECORDED');
 for(const patch of [{operationId:randomUUID()},{inputDigest:'e'.repeat(64)},{scope:'e'.repeat(64)},{saved:false},{baselineEffects:false},{phase:'PRE_SELECTION'},{baselineSnapshot:{...result.baselineSnapshot,selectionReceiptId:'plan_baseline_receipt_'+'e'.repeat(64)}},{active:{...result.active,reason:'Other saved reason'}},{otherPrivateData:'unexpected'}])assert.throws(()=>planBaselineOutcome({...result,...patch},reference));
});
test('old recovery snapshot is confirmed without reactivating it after a later baseline selection',async()=>{
 const {h,input,result,reference}=await values(),next=await h.baselines.select(session,h.input(1,result.active)),old=await h.baselines.read(session,{...h.context(),operationId:input.operationId});
 assert.equal(planBaselineOutcome(old,reference).state,'RECORDED');assert.equal(old.baselineSnapshot.revision,1);assert.equal(old.active.revision,2);assert.equal(old.active.selectionReceiptId,next.receiptId);
});
test('audited rejection is terminal while NOT_OBSERVED never proves loss or permits a new attempt',async()=>{
 const h=await planBaselineHarness(),stale=h.input();await h.baselines.select(session,h.input());const result=await h.baselines.select(session,stale),reference={...h.context(),operationId:stale.operationId,inputDigest:await planBaselineCommandDigest(stale)};
 assert.equal(planBaselineOutcome(result,reference).state,'REJECTED');
 for(const patch of [{code:'ARBITRARY_DENIAL'},{baselineEffects:true},{saved:true},{phase:'COMMITTED'},{inputDigest:'e'.repeat(64)}])assert.throws(()=>planBaselineOutcome({...result,...patch},reference));
 const missing=await h.baselines.read(session,{...h.context(),operationId:randomUUID()}),missingRef={...reference,operationId:missing.operationId};assert.equal(planBaselineOutcome(missing,missingRef).state,'NOT_OBSERVED');
 assert.throws(()=>planBaselineOutcome({...missing,definitive:true},missingRef));
});
test('journal stores reference and input digest only, blocks a second write, and survives page reconstruction',async()=>{
 const h=await planBaselineHarness(),input=h.input(),s=storage(),j=journal(s),ticket=await j.prepare('/api/identity/plan-baseline',post(input));
 assert.equal(ticket.entry.resource,'plan-baseline');assert.equal(ticket.entry.action,'SELECT');assert.equal(ticket.entry.inputDigest,planBaselineSelectionDigest(input));
 assert.deepEqual(Object.keys(ticket.entry).sort(),['action','createdAt','inputDigest','operationId','projectId','resource','scope','version']);
 const persisted=JSON.stringify([...s.rows]);for(const value of [input.reason,input.draftId,input.decisionReceiptId,input.sourceSha256,'cachedValue','curve','selectedBy'])assert.equal(persisted.includes(value),false,value);
 const fresh=journal(storage(s.rows)),entry=(await fresh.list(input.scope))[0];assert.equal(entry.operationId,input.operationId);
 await assert.rejects(fresh.prepare('/api/identity/plan-baseline',post({...input,operationId:randomUUID()})),{code:'WORKSPACE_RECOVERY_REQUIRED'});
 const unknown=await h.baselines.read(session,{...h.context(),operationId:input.operationId});await fresh.observe(recoveryQuery(entry),unknown);assert.equal((await fresh.list(input.scope)).length,1);
});
test('lost acknowledgement recovers by GET once with no repeated SELECT and removes exact pending reference',async()=>{
 const h=await planBaselineHarness(),input=h.input(),s=storage(),j=journal(s);let posts=0,gets=0;
 const lifecycle=createWorkspaceRequestLifecycle(async()=>'synthetic-token',{journal:j,fetchImpl:async(url,options)=>{
  if(options.method==='POST'){posts++;await h.baselines.select(session,JSON.parse(options.body));throw new TypeError('Synthetic acknowledgement loss');}
  gets++;const params=new URL(url,'https://obrasaas.com').searchParams;return Response.json(await h.baselines.read(session,{...h.context(),operationId:params.get('operationId')}));
 }});
 await assert.rejects(lifecycle.request('/api/identity/plan-baseline',post(input)),TypeError);const pending=(await j.list(input.scope))[0];
 const result=await lifecycle.request(recoveryQuery(pending),{},async response=>{const value=await response.json();planBaselineOutcome(value,pending);return value;});
 assert.equal(result.state,'RECORDED');assert.equal(posts,1);assert.equal(gets,1);assert.equal((await j.list(input.scope)).length,0);lifecycle.abort();
});
test('journal retains unproved denial and accepts only matching audited rejection',async()=>{
 const h=await planBaselineHarness(),input=h.input(),s=storage(),j=journal(s),ticket=await j.prepare('/api/identity/plan-baseline',post(input));
 await j.settle(ticket,null,{status:409,code:'PLAN_BASELINE_REVISION_CHANGED',requestDispatched:true});assert.equal((await j.list(input.scope)).length,1);
 await h.baselines.select(session,h.input());const result=await h.baselines.select(session,input);
 assert.equal(recoveryResult(ticket.entry,{...result,inputDigest:'e'.repeat(64)}),null);await j.observe(recoveryQuery(ticket.entry),{...result,inputDigest:'e'.repeat(64)});assert.equal((await j.list(input.scope)).length,1);
 await j.observe(recoveryQuery(ticket.entry),result);assert.equal((await j.list(input.scope)).length,0);
});
test('tampered persisted reference cannot add source data or omit the digest before a write',async()=>{
 const h=await planBaselineHarness(),input=h.input(),s=storage(),j=journal(s),ticket=await j.prepare('/api/identity/plan-baseline',post(input)),key=WORKSPACE_RECOVERY_PREFIX+input.scope+'.plan-baseline.'+input.operationId;
 assert.throws(()=>validateWorkspaceRecoveryStoredEntry(key,JSON.stringify({...ticket.entry,curve:{cachedValue:'secret'}})));
 const missing={...ticket.entry};delete missing.inputDigest;assert.throws(()=>validateWorkspaceRecoveryStoredEntry(key,JSON.stringify(missing)));
 await assert.rejects(j.prepare('/api/identity/plan-baseline',post({...input,operationId:randomUUID(),confirmed:false})),{code:'WORKSPACE_RECOVERY_STORAGE_UNAVAILABLE'});
});
