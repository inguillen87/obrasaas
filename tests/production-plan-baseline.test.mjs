import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {planBaselineHarness,projectId,session} from './fixtures/plan-baseline-synthetic.mjs';
import {normalizePlanBaselineSelection,planBaselineSelectionDigest,planBaselineCursor,parsePlanBaselineCursor,planBaselineId} from '../src/lib/plan-baseline-policy.mjs';
import {createPlanBaselineHandlers} from '../src/lib/plan-baseline-http.mjs';
import {createPlanImportAnalyzer} from '../src/lib/plan-import-analyzer.mjs';
import {decodePlanSource} from '../src/lib/plan-import-policy.mjs';
import {PLAN_CYP_INVESTMENT_CONSENT,PLAN_CYP_INVESTMENT_PROFILE} from '../src/lib/plan-import-cyp-curve.mjs';
import {cypInvestmentFixture} from './fixtures/plan-import-cyp-curve-synthetic.mjs';
import {documentStoreHarness,session as investmentSession} from './fixtures/plan-document-curve-store-synthetic.mjs';
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

function investmentHarness({different=false,role='ADMIN',taskCount=0}={}){
 let providerCalls=0;const analyzer=createPlanImportAnalyzer({environment:()=>{providerCalls++;throw Error('Financial Excel must stay local');},fetchImpl:()=>{providerCalls++;throw Error('Financial Excel must stay local');}}),h=documentStoreHarness({role,taskCount,analyzerOverride:analyzer}),mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
 const source=options=>decodePlanSource(cypInvestmentFixture({...options,...(different?{weeklyAmounts:Array.from({length:48},(_,index)=>index===0?'12345678901234567890.1704500':'0.0000')}: {})}),mime);
 const attach=options=>h.attach({source:source(options),consent:PLAN_CYP_INVESTMENT_CONSENT}),decision=(draft,action='REVIEW_INVESTMENT',acknowledgeDifference=different)=>({...h.context(),action,operationId:randomUUID(),draftId:draft.id,expectedRevision:draft.revision,reason:'Explicit synthetic monthly and weekly source review',acknowledgeDifference});
 const apply=async(options)=>{const uploaded=await attach(options),reviewBody=decision(uploaded.draft),review=await h.imports.decide(investmentSession,reviewBody),applyBody=decision(review.draft,'APPLY_INVESTMENT'),applied=await h.imports.decide(investmentSession,applyBody);return{uploaded,reviewBody,review,applyBody,applied};};
 return{...h,attachInvestment:attach,investmentDecision:decision,applyInvestment:apply,providerCalls:()=>providerCalls};
}

for(const role of ['ADMIN','DIRECTOR'])test('v5 financial-only approval becomes a candidate and explicit SELECT preserves both source series for '+role,async()=>{
 const h=investmentHarness({role,taskCount:5001}),before=h.tasks(),r=await h.applyInvestment(),source={...r.applied.draft.spreadsheet};delete source.reviewed;const imports=h.logs(),list=await h.baselines.read(investmentSession,h.context());
 assert.equal(r.applied.saved,true);assert.equal(list.active,null);assert.equal(list.candidates.length,1);const candidate=list.candidates[0];assert.equal(candidate.profile,PLAN_CYP_INVESTMENT_PROFILE);assert.equal(candidate.sourceKind,'SPREADSHEET');assert.equal(candidate.presentation,'CYP_INVESTMENT_CURVES');assert.equal(candidate.sourceRowCount,0);assert.equal(candidate.selectedRowCount,0);assert.deepEqual(candidate.curve,source);assert.equal(candidate.curve.monthly.periods.length,12);assert.equal(candidate.curve.weekly.periods.length,48);assert.equal(candidate.curve.comparison.status,'MATCH');assert.equal(candidate.curve.weekly.periods[0].amount.cachedValue,'12345678901234567890.1234500');
 const out=await h.baselines.select(investmentSession,h.baselineInput(r.applied.draft));assert.equal(out.state,'RECORDED');assert.equal(out.active.revision,1);assert.deepEqual(out.active.curve,source);assert.deepEqual((await h.baselines.read(investmentSession,h.context())).active,out.active);assert.deepEqual(h.logs().filter(row=>row.action.startsWith('plan.import.')),imports);assert.deepEqual(h.tasks(),before);assert.equal(h.calls.taskWrites,0);assert.equal(h.calls.sql.some(sql=>sql.includes('public."Task"')),false);assert.equal(h.providerCalls(),0);
});

test('v5 DIFFERENT totals require the same explicit acknowledgement in authentic REVIEW and APPLY before SELECT',async()=>{
 const h=investmentHarness({different:true}),uploaded=await h.attachInvestment();assert.equal(uploaded.draft.spreadsheet.comparison.status,'DIFFERENT');const noReview=await h.imports.decide(investmentSession,h.investmentDecision(uploaded.draft,'REVIEW_INVESTMENT',false));assert.equal(noReview.saved,false);assert.deepEqual((await h.baselines.read(investmentSession,h.context())).candidates,[]);
 const review=await h.imports.decide(investmentSession,h.investmentDecision(uploaded.draft)),noApply=await h.imports.decide(investmentSession,h.investmentDecision(review.draft,'APPLY_INVESTMENT',false));assert.equal(noApply.saved,false);const applied=await h.imports.decide(investmentSession,h.investmentDecision(review.draft,'APPLY_INVESTMENT'));assert.equal(applied.draft.differenceAcknowledged,true);const selected=await h.baselines.select(investmentSession,h.baselineInput(applied.draft));assert.equal(selected.active.curve.comparison.status,'DIFFERENT');assert.equal(selected.active.curve.comparison.differenceDecimalText,'0.0470000');assert.equal(selected.active.sourceRowCount,0);assert.equal(h.calls.taskWrites,0);
});

test('v5 baseline revalidates authentic source, review, acknowledgement and no-effects APPLY receipts',async()=>{
 const edits={
  'review-request':(h,r)=>h.changeLog(r.review.receiptId,row=>{row.metadata.request.reason='Altered original review reason';}),
  'review-ack':(h,r)=>h.changeLog(r.review.receiptId,row=>{row.metadata.request.acknowledgeDifference=false;}),
  'review-actor':(h,r)=>h.changeLog(r.review.receiptId,row=>{row.actorId='actor-foreign';}),
  'review-missing':(h,r)=>h.changeLog(r.review.receiptId,row=>{row.action='foreign';}),
  'review-digest':(h,r)=>h.changeLog(r.applied.draft.id,row=>{row.metadata.investmentReview.sourceCurveDigest='f'.repeat(64);}),
  'review-revision':(h,r)=>h.changeLog(r.applied.draft.id,row=>{row.metadata.investmentReview.revision++;}),
  'review-reason':(h,r)=>h.changeLog(r.applied.draft.id,row=>{row.metadata.investmentReview.reason='Altered stored review reason';}),
  'apply-link':(h,r)=>h.changeLog(r.applied.receiptId,row=>{row.metadata.reviewReceiptId=r.applied.receiptId;}),
  'apply-digest':(h,r)=>h.changeLog(r.applied.receiptId,row=>{row.metadata.sourceCurveDigest='f'.repeat(64);}),
  'apply-ack':(h,r)=>h.changeLog(r.applied.receiptId,row=>{row.metadata.outcome.draft.differenceAcknowledged=false;}),
  'apply-tasks':(h,r)=>h.changeLog(r.applied.receiptId,row=>{row.metadata.outcome.taskSnapshots.push({id:'task-foreign'});}),
  'apply-effects':(h,r)=>h.changeLog(r.applied.receiptId,row=>{row.metadata.outcome.taskEffects=true;}),
  'source-sha':(h,r)=>h.changeLog(r.applied.draft.id,row=>{row.metadata.source.sha256='f'.repeat(64);}),
  'source-week':(h,r)=>h.changeLog(r.applied.draft.id,row=>{row.metadata.analysis.spreadsheet.weekly.periods[0].amount.cachedValue='1';}),
  'physical-row':(h,r)=>h.changeLog(r.applied.draft.id,row=>{row.metadata.rows.push({title:'Not a financial-only source'});})
 };
 for(const [name,edit]of Object.entries(edits)){const h=investmentHarness({different:true}),r=await h.applyInvestment(),input=h.baselineInput(r.applied.draft);edit(h,r);const out=await h.baselines.select(investmentSession,input);assert.equal(out.state,'REJECTED',name);assert.equal(out.baselineEffects,false,name);assert.equal(out.active,null,name);assert.equal(h.logs().filter(row=>row.action==='plan.baseline.active').length,0,name);await assert.rejects(h.baselines.read(investmentSession,h.context()),{code:'PLAN_BASELINE_INTEGRITY'},name);assert.equal(h.calls.taskWrites,0,name);}
});

test('v5 replacement uses the existing SELECT CAS and old operation recovery cannot reactivate a historical curve',async()=>{
 const h=investmentHarness(),a=await h.applyInvestment(),firstInput=h.baselineInput(a.applied.draft),first=await h.baselines.select(investmentSession,firstInput),b=await h.applyInvestment({sharedWeekly:false}),secondInput={...h.baselineInput(b.applied.draft),expectedBaselineId:first.active.id,expectedBaselineRevision:first.active.revision},second=await h.baselines.select(investmentSession,secondInput),before=h.logs();
 assert.notEqual(a.applied.draft.source.sha256,b.applied.draft.source.sha256);assert.equal(second.active.revision,2);assert.equal(second.active.draftId,b.applied.draft.id);const replay=await h.baselines.select(investmentSession,firstInput),recovery=await h.baselines.read(investmentSession,{...h.context(),operationId:firstInput.operationId});assert.deepEqual(replay.baselineSnapshot,first.baselineSnapshot);assert.deepEqual(replay.active,second.active);assert.deepEqual(recovery.active,second.active);assert.deepEqual(h.logs(),before);
 const stale=await h.baselines.select(investmentSession,h.baselineInput(a.applied.draft));assert.equal(stale.code,'PLAN_BASELINE_REVISION_CHANGED');assert.deepEqual(stale.active,second.active);assert.equal(h.calls.taskWrites,0);
});

test('v5 active snapshot tampering or financial permission revocation never returns private series',async()=>{
 for(const kind of ['snapshot','source','permission']){const h=investmentHarness(),r=await h.applyInvestment(),selected=await h.baselines.select(investmentSession,h.baselineInput(r.applied.draft));if(kind==='snapshot')h.changeLog(selected.receiptId,row=>{row.metadata.outcome.baseline.curve.weekly.periods[0].amount.cachedValue='1';});if(kind==='source')h.changeLog(r.applied.draft.id,row=>{row.metadata.investmentReview.acknowledgeDifference=true;});if(kind==='permission')h.member.role='SITE_MANAGER';const response=await h.baselineHttp.GET(new Request(endpoint+'?'+new URLSearchParams({...h.context(),operationId:selected.operationId})));assert.equal(response.status,kind==='permission'?403:503,kind);assert.doesNotMatch(JSON.stringify(await response.json()),/cachedValue|weekly|monthly|sourceSha256/,kind);}
});

test('v5 SELECT COMMIT acknowledgement loss recovers one snapshot while rollback requires the same UUID retry',async()=>{
 for(const mode of ['ACK_LOST','ROLLBACK']){const h=investmentHarness(),r=await h.applyInvestment(),input=h.baselineInput(r.applied.draft);h.controls.commitMode=mode;await assert.rejects(h.baselines.select(investmentSession,input),{code:'WORKSPACE_OPERATION_UNCONFIRMED'});const read=await h.baselines.read(investmentSession,{...h.context(),operationId:input.operationId});assert.equal(read.state,mode==='ACK_LOST'?'RECORDED':'NOT_OBSERVED');const retry=await h.baselines.select(investmentSession,input);assert.equal(retry.replayed,mode==='ACK_LOST');assert.equal(retry.active.curve.weekly.periods.length,48);assert.equal(h.logs().filter(row=>row.action==='plan.baseline.selected').length,1);assert.equal(h.calls.taskWrites,0);}
});
