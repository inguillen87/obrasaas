import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {documentCurveFixture,documentCurveNumeric} from './fixtures/plan-import-document-curve-synthetic.mjs';
import {normalizeDocumentCurve} from '../src/lib/plan-import-document-curve.mjs';
import {documentCurveDecisionDigest,documentCurveUploadDigest} from '../src/lib/plan-import-policy.mjs';
import {planDocumentCurveView,planDocumentDraftView,documentCurveReviewValue,formatSourceCurveDecimal,documentCurveKeyboardIndex,documentCurvePlot} from '../src/app/(identity)/cuenta/plan-source-curve.mjs';
import {planBaselineCandidateView} from '../src/app/(identity)/cuenta/plan-baseline-view.mjs';
import {planImportCommandDigest,planImportUploadDigest,recoveryResult,createWorkspaceRecoveryJournal} from '../src/app/(identity)/cuenta/workspace-recovery-journal.mjs';
import {createWorkspaceRequestLifecycle} from '../src/app/(identity)/cuenta/workspace-request-lifecycle.mjs';
import {documentStoreHarness,session} from './fixtures/plan-document-curve-store-synthetic.mjs';

const scope='b'.repeat(64),projectId='project_synthetic',operationId='01234567-89ab-4cde-8fab-0123456789ab',draftId='plan_draft_'+'d'.repeat(64),receiptId='plan_receipt_'+'e'.repeat(64),time='2026-10-14T01:30:00.000Z';
const command=action=>({scope,projectId,operationId,draftId,expectedRevision:1,reason:'Revisión financiera sintética',action,rows:null,curve:action==='REVIEW_CURVE'?documentCurveFixture():null});
const draft=()=>({id:draftId,revision:2,status:'READY',financialSource:true,rows:[],source:{contentType:'application/pdf',bytes:30,sha256:'a'.repeat(64)},documentCurve:documentCurveFixture(),reviewedCurve:documentCurveFixture(),documentReviewed:true});
const candidate=()=>({draftId,draftRevision:3,decisionReceiptId:receiptId,sourceSha256:'a'.repeat(64),profile:'DOCUMENT_MONTHLY_CURVE_V1',sourceRowCount:0,selectedRowCount:0,appliedAt:time,curve:documentCurveFixture(),sourceKind:'DOCUMENT',presentation:'DOCUMENT_MONTHLY_CURVE'});
function renormalize(value){delete value.coherence;return normalizeDocumentCurve(value);}
test('document view preserves exact money and page provenance without spreadsheet cells or mutation',()=>{
 const original=documentCurveFixture(),before=structuredClone(original),view=planDocumentCurveView(original);
 assert.deepEqual(original,before);assert.equal(view.periods[0].monthlyAmount.decimalText,'25.00');assert.equal(view.periods[0].monthlyAmount.evidence[0].page,1);assert.equal(Object.hasOwn(view.total,'sourceCell'),false);
 view.periods[0].monthlyAmount.evidence[0].quote='Changed detached display';assert.deepEqual(original,before);
 assert.equal(formatSourceCurveDecimal('12345678901234567890.123456789000'),'12.345.678.901.234.567.890,123456789000');
});
test('explicit zero remains a point while missing monthly data breaks the document curve',()=>{
 const value=documentCurveFixture();value.periods[0].cumulativePercentage=documentCurveNumeric('0');value.periods[1].cumulativePercentage=documentCurveNumeric(null);
 const view=planDocumentCurveView(renormalize(value));assert.equal(view.points[0].y,254);assert.equal(view.points[1].y,null);assert.deepEqual(view.segments.map(group=>group.map(p=>p.ordinal)),[[1]]);
});
test('document source mismatch and fabricated coherence fail closed',()=>{
 const value=documentCurveFixture();assert.throws(()=>planDocumentCurveView(value,{sourceSha256:'f'.repeat(64)}));value.coherence.status='CONSISTENT';value.coherence.checks=[];assert.throws(()=>planDocumentCurveView(value));
});
test('reviewed calendar requires the actual year in evidence and cannot infer a year from a month name',()=>{
 const value=documentCurveFixture();value.periods[0].calendarEvidence[0].quote='Enero';assert.throws(()=>documentCurveReviewValue(value,value.sourceSha256));value.periods[0].calendarMonth=null;const reviewed=documentCurveReviewValue(value,value.sourceSha256);assert.equal(reviewed.periods[0].calendarMonth,null);
});
test('public document draft separates original and review and rejects tasks or a false financial boundary',()=>{
 const value=draft(),before=structuredClone(value);assert.ok(planDocumentDraftView(value).documentReviewed);assert.deepEqual(value,before);
 for(const edit of [v=>{v.rows=[{title:'Fabricated task'}];},v=>{v.financialSource=false;},v=>{v.documentReviewed=true;v.reviewedCurve=null;},v=>{v.reviewedCurve.sourceSha256='f'.repeat(64);}]){const changed=draft();edit(changed);assert.throws(()=>planDocumentDraftView(changed));}
 const pending={...draft(),status:'PROCESSING',documentCurve:null,reviewedCurve:null,documentReviewed:false};assert.equal(planDocumentDraftView(pending).original,null);
});
test('document baseline accepts exactly the zero-task branch and rejects relabeled Excel or foreign source',()=>{
 assert.equal(planBaselineCandidateView(candidate()).sourceRowCount,0);
 for(const edit of [v=>{v.sourceKind='EXCEL';},v=>{v.presentation='UNKNOWN';},v=>{v.selectedRowCount=1;},v=>{v.curve.sourceSha256='f'.repeat(64);},v=>{delete v.sourceKind;},v=>{v.profile='MONTHLY_RUBROS_CURVE';}]){const value=candidate();edit(value);assert.throws(()=>planBaselineCandidateView(value));}
});
test('document journal decision fingerprints match the server normalizer and retain the legacy tuple',async()=>{
 for(const action of ['REVIEW_CURVE','APPLY_CURVE','REJECT']){const value=command(action);value.reason='  Revisión financiera sintética  ';assert.equal(await planImportCommandDigest(value),documentCurveDecisionDigest(value));}
 const legacy={...command('REJECT')};delete legacy.curve;
 const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
 const expected=createHash('sha256').update(JSON.stringify(['plan-import-command-v1',canonical(legacy)])).digest('hex');assert.equal(await planImportCommandDigest(legacy),expected);assert.notEqual(await planImportCommandDigest(command('REJECT')),expected);
});
test('new document upload fingerprint is purpose-bound and cannot reuse the task consent',async()=>{
 const value={scope,projectId,operationId,consent:'plan-document-monthly-curve-openai-v1',source:{contentType:'application/pdf',bytes:30,sha256:'a'.repeat(64)}};
 assert.equal(await planImportUploadDigest(value),documentCurveUploadDigest(value));assert.notEqual(await planImportUploadDigest(value),await planImportUploadDigest({...value,consent:'plan-document-openai-v1'}));await assert.rejects(planImportUploadDigest({...value,source:{...value.source,contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}}));
});
test('document receipt recovery binds action, operation, draft, revision and digest with zero effects',async()=>{
 const input=command('REVIEW_CURVE'),inputDigest=await planImportCommandDigest(input),entry={version:1,resource:'plan-import',scope,projectId,operationId,createdAt:1,action:input.action,draftId,expectedRevision:1,inputDigest};
 const outcome={scope,projectId,action:input.action,operationId,expectedRevision:1,inputDigest,state:'RECORDED',definitive:true,phase:'COMMITTED',saved:true,taskEffects:false,baselineEffects:false,draft:draft(),taskSnapshots:[],tasks:[],recordedAt:time,replayed:false,receiptId};
 assert.equal(recoveryResult(entry,outcome).state,'RECORDED');
 for(const edit of [v=>{v.operationId='01234567-89ab-4cde-8fab-0123456789ac';},v=>{v.action='APPLY_CURVE';},v=>{v.inputDigest='f'.repeat(64);},v=>{v.expectedRevision=2;},v=>{v.draft.id='plan_draft_'+'f'.repeat(64);},v=>{v.draft.documentCurve.sourceSha256='f'.repeat(64);},v=>{v.tasks=['leak'];},v=>{v.baselineEffects=true;}]){const changed=structuredClone(outcome);edit(changed);assert.equal(recoveryResult(entry,changed),null);}
 assert.equal(recoveryResult(entry,{scope,projectId,state:'NOT_OBSERVED',saved:false,definitive:false}).state,'NOT_OBSERVED');
});
test('document keyboard controls support all36months without expanding Excel bounds',()=>{
 assert.equal(documentCurveKeyboardIndex('End',0,36),35);assert.equal(documentCurveKeyboardIndex('ArrowRight',35,36),35);assert.equal(documentCurveKeyboardIndex('Home',35,36),0);assert.equal(documentCurveKeyboardIndex('End',0,37),null);
});
test('actual HTTP VALUES_REQUIRED rejection recovers through the same journal reference after 409 or lost ACK without rePOST',async()=>{
 for(const loseAck of [false,true]){
  const h=documentStoreHarness({taskCount:0}),uploaded=await h.attach(),empty=structuredClone(uploaded.draft.documentCurve);delete empty.coherence;for(const period of empty.periods)for(const key of ['monthlyAmount','cumulativeAmount','monthlyPercentage','cumulativePercentage'])period[key]=documentCurveNumeric(null);
  const review=await h.imports.decide(session,h.decision(uploaded.draft,'REVIEW_CURVE',normalizeDocumentCurve(empty))),body=h.decision(review.draft,'APPLY_CURVE'),inputDigest=await planImportCommandDigest(body),entry={version:1,resource:'plan-import',...h.context(),operationId:body.operationId,createdAt:1,action:'APPLY_CURVE',draftId:body.draftId,expectedRevision:body.expectedRevision,inputDigest};
  const values=new Map(),storage={get length(){return values.size;},key:index=>[...values.keys()][index]??null,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)},journal=createWorkspaceRecoveryJournal({getStorage:()=>storage}),requests=[];let rejected;
  const transport=createWorkspaceRequestLifecycle(async()=> 'synthetic-local-session',{journal,fetchImpl:async(url,options)=>{requests.push({method:options.method||'GET',operationId:options.method==='POST'?JSON.parse(options.body).operationId:new URL(url,'https://obrasaas.com').searchParams.get('operationId')});const headers=new Headers(options.headers);headers.set('origin','https://obrasaas.com');const actual=new Request(new URL(url,'https://obrasaas.com'),{...options,headers}),response=await h.http[options.method==='POST'?'POST':'GET'](actual);if(options.method==='POST'){assert.equal(response.status,409);rejected=await response.clone().json();assert.equal(rejected.code,'PLAN_DOCUMENT_CURVE_VALUES_REQUIRED');if(loseAck)throw new TypeError('Synthetic lost rejection acknowledgement');}return response;}});
  const consume=async response=>{const result=await response.json();if(!response.ok)throw Object.assign(new Error(result.code),{status:response.status,code:result.code,result});return result;};
  await assert.rejects(transport.request('/api/identity/plan-import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)},consume));assert.ok(recoveryResult(entry,rejected),'Actual rejected receipt must decode: '+JSON.stringify({entry,rejected}));assert.equal(recoveryResult(entry,rejected).state,'REJECTED');assert.equal(rejected.taskEffects,false);assert.equal(rejected.baselineEffects,false);assert.deepEqual(rejected.tasks,[]);
  const pending=(await journal.list(body.scope))[0];assert.equal(pending.operationId,body.operationId);for(const key of ['curve','reason','rawText','file','token'])assert.equal(Object.hasOwn(pending,key),false);
  const result=await transport.request('/api/identity/plan-import?'+new URLSearchParams({...h.context(),operationId:body.operationId}),{},consume);assert.equal(result.replayed,true);assert.equal(result.receiptId,rejected.receiptId);assert.equal(recoveryResult(entry,result).code,'PLAN_DOCUMENT_CURVE_VALUES_REQUIRED');assert.equal((await journal.list(body.scope)).length,0);assert.deepEqual(requests.map(row=>row.method),['POST','GET']);assert.ok(requests.every(row=>row.operationId===body.operationId));assert.equal(h.calls.taskWrites,0);assert.equal(h.calls.provider,1);
  for(const changed of [{...result,code:'UNRECOGNIZED_REJECTION'},{...result,inputDigest:'f'.repeat(64)},{...result,operationId:'01234567-89ab-4cde-8fab-0123456789ab'}])assert.equal(recoveryResult(entry,changed),null);
 }
});
test('amount-only curve draws exact-scaled huge source money and splits missing months without percentages',()=>{
 const value=documentCurveFixture();for(const period of value.periods){period.cumulativeAmount=documentCurveNumeric(null);period.monthlyPercentage=documentCurveNumeric(null);period.cumulativePercentage=documentCurveNumeric(null);}value.periods[0].monthlyAmount=documentCurveNumeric('12345678901234567890.123456789000');value.periods[1].monthlyAmount=documentCurveNumeric('0');
 const input=renormalize(value),before=structuredClone(input),plot=documentCurvePlot(input);assert.equal(plot.series,'monthlyAmount');assert.equal(plot.points[0].y,34);assert.equal(plot.points[1].y,254);assert.equal(plot.maximumRaw,'12345678901234567890.123456789000');assert.deepEqual(input,before);
 value.periods[1].monthlyAmount=documentCurveNumeric(null);assert.equal(documentCurvePlot(renormalize(value)).points[1].y,null);assert.equal(documentCurvePlot(renormalize(value)).segments.length,1);
});
