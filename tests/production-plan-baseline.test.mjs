import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {planBaselineHarness,projectId,session} from './fixtures/plan-baseline-synthetic.mjs';
import {normalizePlanBaselineSelection,planBaselineSelectionDigest,planBaselineCursor,parsePlanBaselineCursor,planBaselineId} from '../src/lib/plan-baseline-policy.mjs';
import {createPlanBaselineHandlers} from '../src/lib/plan-baseline-http.mjs';
const endpoint='https://obrasaas.com/api/identity/plan-baseline';
const post=(http,body,headers={})=>http.POST(new Request(endpoint,{method:'POST',headers:{origin:'https://obrasaas.com','content-type':'application/json',...headers},body:JSON.stringify(body)}));

test('approved financial imports are candidates, never automatically selected or copied into Task',async()=>{
 const h=await planBaselineHarness({sources:2}),before=h.logs(),view=await h.baselines.read(session,h.context());
 assert.equal(view.active,null);assert.equal(view.candidates.length,2);assert.equal(view.nextCursor,null);assert.equal(h.calls.mutations,0);assert.deepEqual(h.logs(),before);
 for(const c of view.candidates){assert.deepEqual(c.curve,h.seeded[0].curve);assert.equal(c.curve.currency,null);assert.equal(c.curve.calendarStart,null);assert.equal(c.selectedRowCount,4);assert.equal(c.sourceRowCount,4);}
 assert.ok(h.seeded.flatMap(v=>v.tasks).every(t=>t.progress===0&&t.status==='BACKLOG'));assert.ok(h.calls.sql.every(s=>!s.startsWith('INSERT INTO public."Task"')));
});
test('explicit SELECT records one immutable snapshot, preserves exact cache decimals and existing import receipts',async()=>{
 const h=await planBaselineHarness(),before=h.logs(),input=h.input(),result=await h.baselines.select(session,input),snapshot=result.baselineSnapshot;
 assert.equal(result.state,'RECORDED');assert.equal(result.definitive,true);assert.equal(result.phase,'COMMITTED');assert.equal(result.baselineEffects,true);assert.equal(result.inputDigest,planBaselineSelectionDigest(input));assert.equal(snapshot.revision,1);assert.deepEqual(snapshot,result.active);assert.equal(snapshot.curve.total.cachedValue,'12345678901234567890.1234500');
 assert.deepEqual(h.logs().filter(row=>row.action.startsWith('plan.import.')),before);assert.deepEqual(snapshot.curve,h.seeded[0].curve);
 assert.deepEqual((await h.baselines.read(session,h.context())).active,snapshot);assert.equal(h.logs().filter(r=>r.action==='plan.baseline.selected').length,1);
});
test('legacy monthly v3 applied financial source remains selectable without relabeling its original periods or amount',async()=>{
 const h=await planBaselineHarness({profile:'MONTHLY_RUBROS_CURVE'}),list=await h.baselines.read(session,h.context()),out=await h.baselines.select(session,h.input());assert.equal(list.candidates[0].profile,'MONTHLY_RUBROS_CURVE');assert.equal(out.active.curve.periods.length,3);assert.deepEqual(out.active.curve,h.seeded[0].curve);assert.equal(out.active.curve.currency,null);assert.equal(out.active.curve.calendarStart,null);
 const readback=await h.baselines.read(session,h.context());assert.deepEqual(readback.active,out.active);assert.deepEqual(readback.active.curve,h.seeded[0].curve);
});
test('replacement uses prior id/revision CAS and old SELECT replay returns original snapshot without reactivation',async()=>{
 const h=await planBaselineHarness({sources:2}),a=h.input(),first=await h.baselines.select(session,a),b=h.input(1,first.active),second=await h.baselines.select(session,b),before=h.logs();
 assert.equal(second.active.revision,2);assert.equal(second.active.draftId,b.draftId);
 const replay=await h.baselines.select(session,a),recovery=await h.baselines.read(session,{...h.context(),operationId:a.operationId});
 assert.equal(replay.replayed,true);assert.deepEqual(replay.baselineSnapshot,first.baselineSnapshot);assert.deepEqual(replay.active,second.active);assert.deepEqual(recovery.active,second.active);assert.deepEqual(h.logs(),before);
 await assert.rejects(h.baselines.select(session,{...a,reason:'Different operation content'}),{code:'PLAN_BASELINE_OPERATION_CONFLICT'});
});
test('valid stale CAS is rejected with a durable input-bound receipt and cannot later select after replay',async()=>{
 const h=await planBaselineHarness({sources:2}),stale=h.input(1),selected=await h.baselines.select(session,h.input()),result=await h.baselines.select(session,stale);
 assert.equal(result.state,'REJECTED');assert.equal(result.saved,false);assert.equal(result.definitive,true);assert.equal(result.phase,'PRE_SELECTION');assert.equal(result.baselineEffects,false);assert.equal(result.code,'PLAN_BASELINE_REVISION_CHANGED');assert.equal(result.inputDigest,planBaselineSelectionDigest(stale));assert.deepEqual(result.active,selected.active);
 const replay=await h.baselines.select(session,stale);assert.equal(replay.replayed,true);assert.equal(replay.receiptId,result.receiptId);assert.equal((await h.baselines.read(session,{...h.context(),operationId:stale.operationId})).state,'REJECTED');
});
test('wrong candidate, revised selectors or source hash are audited before baseline effects',async()=>{
 for(const patch of [{draftId:'plan_draft_'+'f'.repeat(64)},{draftRevision:9},{decisionReceiptId:'plan_receipt_'+'f'.repeat(64)},{sourceSha256:'f'.repeat(64)}]){
  const h=await planBaselineHarness(),input={...h.input(),...patch},result=await h.baselines.select(session,input);assert.equal(result.state,'REJECTED');assert.equal(result.baselineEffects,false);assert.equal(result.active,null);assert.equal(result.inputDigest,planBaselineSelectionDigest(input));assert.equal(h.logs().filter(r=>r.action==='plan.baseline.active').length,0);
 }
});
test('READY/nonfinancial or unreviewed/fabricated receipt candidates never become a financial baseline',async()=>{
 for(const change of [m=>{m.status='READY';},m=>{m.analysis.reviewed=false;},m=>{m.decision.action='EDIT';},m=>{m.analysis.spreadsheet.curve.total.cachedValue='100';},m=>{m.consent.version='plan-spreadsheet-cyp-partidas-v2';}]){
  const h=await planBaselineHarness(),input=h.input();h.changeLog(input.draftId,row=>change(row.metadata));const out=await h.baselines.select(session,input);assert.equal(out.state,'REJECTED');assert.equal(out.baselineEffects,false);assert.equal(out.active,null);
 }
});
test('active pointer and immutable selection are revalidated against the exact applied source every read',async()=>{
 for(const target of ['pointer-project','pointer-revision','pointer-action','receipt-action','receipt-curve','source-curve','apply-curve','apply-missing','receipt-actor']){
  const h=await planBaselineHarness(),input=h.input(),result=await h.baselines.select(session,input);
  if(target.startsWith('pointer'))h.changeLog(result.active.id,row=>{if(target==='pointer-project')row.entityId='different-project';else if(target==='pointer-action')row.action='wrong-action';else row.metadata.revision++;});
  if(target==='receipt-action')h.changeLog(result.receiptId,row=>{row.action='wrong-action';});
  if(target==='receipt-curve')h.changeLog(result.receiptId,row=>{row.metadata.outcome.baseline.curve.total.cachedValue='1';});
  if(target==='receipt-actor')h.changeLog(result.receiptId,row=>{row.metadata.actorId='other-actor';});
  if(target==='source-curve')h.changeLog(input.draftId,row=>{row.metadata.analysis.spreadsheet.curve.total.cachedValue='1';});
  if(target==='apply-curve')h.changeLog(input.decisionReceiptId,row=>{row.metadata.outcome.draft.spreadsheet.curve.total.cachedValue='1';});
  if(target==='apply-missing')h.changeLog(input.decisionReceiptId,row=>{row.action='unexpected';});
  await assert.rejects(h.baselines.read(session,h.context()),{code:'PLAN_BASELINE_INTEGRITY'},target);
 }
});
test('canonical role/membership/project/tenant/scope authority denies private candidates and recovery',async()=>{
 for(const role of ['SITE_MANAGER','FINANCE','AUDITOR']){
  const h=await planBaselineHarness();await h.baselines.select(session,h.input());h.setRole(role);
  await assert.rejects(h.baselines.read(session,h.context()),{code:'PLAN_BASELINE_PERMISSION_REQUIRED'});await assert.rejects(h.baselines.select(session,h.input()),{code:'PLAN_BASELINE_PERMISSION_REQUIRED'});
 }
 const h=await planBaselineHarness(),input=h.input();await h.baselines.select(session,input);h.setMembershipActive(false);await assert.rejects(h.baselines.read(session,{...h.context(),operationId:input.operationId}),{code:'WORKSPACE_MEMBERSHIP_REQUIRED'});h.setMembershipActive(true);
 h.setProjectActive(false);await assert.rejects(h.baselines.read(session,h.context()),{code:'WORKSPACE_PROJECT_UNAVAILABLE'});h.setProjectActive(true);
 h.setProjectOrganization('other-organization');await assert.rejects(h.baselines.read(session,h.context()),{code:'WORKSPACE_PROJECT_UNAVAILABLE'});h.setProjectOrganization('org-synthetic');
 await assert.rejects(h.baselines.read(session,{...h.context(),scope:'0'.repeat(64)}),{code:'WORKSPACE_CONTEXT_CHANGED'});await assert.rejects(h.baselines.read({...session,userId:'user_Unknown'},h.context()),{code:'WORKSPACE_MEMBERSHIP_REQUIRED'});
});
test('unknown recovery is nondefinitive and a different actor cannot recover the original operation',async()=>{
 const h=await planBaselineHarness(),input=h.input(),unknown=await h.baselines.read(session,{...h.context(),operationId:input.operationId});assert.equal(unknown.state,'NOT_OBSERVED');assert.equal(unknown.definitive,false);assert.equal(unknown.baselineEffects,null);assert.equal(unknown.inputDigest,null);
 await h.baselines.select(session,input);h.setActor('actor-new');const out=await h.baselines.read(session,{...h.context(),operationId:input.operationId});assert.equal(out.state,'NOT_OBSERVED');assert.equal(out.definitive,false);assert.equal(out.active.selectedBy,'actor-synthetic');
});
test('actual canonical COMMIT acknowledgement loss recovers same receipt; rollback stays uncertain then same UUID can retry',async()=>{
 for(const mode of ['ACK_LOST','ROLLBACK']){
  const h=await planBaselineHarness(),input=h.input();h.setCommitMode(mode);await assert.rejects(h.baselines.select(session,input),{code:'WORKSPACE_OPERATION_UNCONFIRMED'});
  const recovered=await h.baselines.read(session,{...h.context(),operationId:input.operationId});assert.equal(recovered.state,mode==='ACK_LOST'?'RECORDED':'NOT_OBSERVED');assert.equal(recovered.definitive,mode==='ACK_LOST');
  const retry=await h.baselines.select(session,input);assert.equal(retry.replayed,mode==='ACK_LOST');assert.equal(h.logs().filter(r=>r.action==='plan.baseline.selected').length,1);assert.equal(h.logs().filter(r=>r.action==='plan.baseline.active').length,1);
 }
});
test('active write failure rolls back the selection receipt and leaves prior import/project state intact',async()=>{
 const h=await planBaselineHarness(),before=h.logs(),input=h.input();h.setFailActiveWrite(true);await assert.rejects(h.baselines.select(session,input),{code:'WORKSPACE_OPERATION_UNCONFIRMED'});assert.deepEqual(h.logs(),before);assert.equal((await h.baselines.read(session,{...h.context(),operationId:input.operationId})).state,'NOT_OBSERVED');
});
test('deterministic candidate pagination is bound to project/scope and never silently skips invalid source',async()=>{
 const h=await planBaselineHarness({sources:12}),first=await h.baselines.read(session,h.context()),second=await h.baselines.read(session,{...h.context(),cursor:first.nextCursor});assert.equal(first.candidates.length,10);assert.equal(second.candidates.length,2);assert.equal(second.nextCursor,null);assert.equal(new Set([...first.candidates,...second.candidates].map(c=>c.draftId)).size,12);
 for(const cursor of [first.nextCursor+'x',planBaselineCursor({...h.context(),projectId:'other-project'},first.candidates.at(-1).draftId),planBaselineCursor({...h.context(),scope:'a'.repeat(64)},first.candidates.at(-1).draftId),planBaselineCursor(h.context(),'plan_draft_'+'f'.repeat(64))])await assert.rejects(h.baselines.read(session,{...h.context(),cursor}),{code:'PLAN_BASELINE_CURSOR_INVALID'});
 const after=parsePlanBaselineCursor(first.nextCursor,h.context());h.changeLog(after,row=>{row.metadata.analysis.reviewed=false;});await assert.rejects(h.baselines.read(session,{...h.context(),cursor:first.nextCursor}),{code:'PLAN_BASELINE_CURSOR_INVALID'});await assert.rejects(h.baselines.read(session,h.context()),{code:'PLAN_BASELINE_INTEGRITY'});
});
test('command normalization has no browser curve/amount/currency or unchecked consent and digest matches canonical tuple',async()=>{
 const h=await planBaselineHarness(),input=h.input();for(const patch of [{curve:h.seeded[0].curve},{currency:'USD'},{amount:14900},{confirmed:false},{reason:'bad\nreason'},{expectedBaselineId:planBaselineId('org-synthetic',projectId)},{expectedBaselineRevision:1}])assert.throws(()=>normalizePlanBaselineSelection({...input,...patch}),{code:'PLAN_BASELINE_INPUT_INVALID'});
 const normalized=normalizePlanBaselineSelection({...input,reason:'  Explicit reviewed selection  ',operationId:input.operationId.toUpperCase()});assert.equal(normalized.reason,'Explicit reviewed selection');assert.equal(planBaselineSelectionDigest(normalized),planBaselineSelectionDigest(Object.fromEntries(Object.entries(normalized).reverse())));
});
test('actual HTTP composition accepts list/selection/recovery and preserves no-store while rejecting cross-origin and unbounded input',async()=>{
 const h=await planBaselineHarness(),http=createPlanBaselineHandlers({verify:async()=>session,baselines:h.baselines}),input=h.input();
 const response=await post(http,input),out=await response.json();assert.equal(response.status,200);assert.equal(out.state,'RECORDED');assert.match(response.headers.get('cache-control'),/private, no-store/);assert.equal(response.headers.get('referrer-policy'),'no-referrer');
 const recovered=await http.GET(new Request(endpoint+'?'+new URLSearchParams({...h.context(),operationId:input.operationId})));assert.equal((await recovered.json()).receiptId,out.receiptId);
 assert.equal((await post(http,{...input,operationId:randomUUID()},{origin:'https://hostile.invalid'})).status,403);assert.equal((await post(http,{...input,reason:'a'.repeat(5000)})).status,413);
 assert.equal((await http.GET(new Request(endpoint+'?'+new URLSearchParams({...h.context(),operationId:input.operationId,cursor:'x'})))).status,400);assert.equal((await http.GET(new Request(endpoint+'?scope='+input.scope+'&scope='+input.scope+'&projectId='+projectId))).status,400);
 h.setRole('SITE_MANAGER');const denied=await http.GET(new Request(endpoint+'?'+new URLSearchParams(h.context())));assert.equal(denied.status,403);assert.doesNotMatch(JSON.stringify(await denied.json()),/cachedValue|curve|sourceSha256/);
});
