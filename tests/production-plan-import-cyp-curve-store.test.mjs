import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {decodePlanSource,PLAN_IMPORT_CYP_CURVE_CONSENT,planDecisionDigest} from '../src/lib/plan-import-policy.mjs';
import {extractCypCurveOoxml} from '../src/lib/plan-import-ooxml.mjs';
import {createPlanImportHandlers} from '../src/lib/plan-import-http.mjs';
import {digest} from '../src/lib/workspace-policy.mjs';
import {planImportUploadDigest,createWorkspaceRecoveryJournal,recoveryQuery} from '../src/app/(identity)/cuenta/workspace-recovery-journal.mjs';
import {cypCurveFixture} from './fixtures/plan-import-cyp-curve-synthetic.mjs';
import {storeHarness,context,session,oldTask} from './fixtures/plan-import-store-synthetic.mjs';
import {documentStoreHarness,session as investmentSession} from './fixtures/plan-document-curve-store-synthetic.mjs';
import {createPlanImportAnalyzer} from '../src/lib/plan-import-analyzer.mjs';
import {cypInvestmentFixture} from './fixtures/plan-import-cyp-curve-synthetic.mjs';
import {PLAN_CYP_INVESTMENT_CONSENT,normalizePlanInvestmentDecision,planInvestmentDecisionDigest,planInvestmentCurveDigest,validatePlanInvestmentReceipt} from '../src/lib/plan-import-policy.mjs';
const mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',permissionError={code:'PLAN_IMPORT_PERMISSION_REQUIRED',status:403};
let samplePromise;
async function sample(){samplePromise??=(async()=>{const bytes=cypCurveFixture(),source=decodePlanSource(bytes,mime),extraction=await extractCypCurveOoxml(bytes,mime);return {source,extraction};})();return structuredClone(await samplePromise);}
async function seeded(options){const h=storeHarness(options),s=await sample(),draftId=h.addDraft(s.extraction,s.source,{consent:PLAN_IMPORT_CYP_CURVE_CONSENT});return {...h,...s,draftId};}
const reviewed=rows=>rows.map(row=>({...row,title:row.title.slice(0,100),startsOn:'2026-11-01',endsOn:'2026-11-30',uncertainty:'',sourceIssueReviewed:true}));
const decision=(h,rows,{action='EDIT',revision=3,operationId=randomUUID()}={})=>({...context,draftId:h.draftId,expectedRevision:revision,action,operationId,reason:'Reviewed synthetic source and dates',rows:action==='REJECT'?null:rows});

for(const role of ['ADMIN','DIRECTOR'])test('v4 attach is opt-in, private, local and recoverable without auto-applying for '+role,async()=>{
 const h=storeHarness({role}),{source,extraction}=await sample(),input={...context,source,consent:PLAN_IMPORT_CYP_CURVE_CONSENT,operationId:randomUUID()},result=await h.imports.attach(session,input);
 assert.equal(result.draft.spreadsheet.version,4);assert.deepEqual(result.draft.spreadsheet.curve,extraction.spreadsheet.curve);assert.equal(h.calls.analyze,1);assert.equal(h.calls.put,1);assert.deepEqual(h.tasks(),[oldTask]);
 const before={mutations:h.calls.mutations,get:h.calls.get},replay=await h.imports.attach(session,input);assert.equal(replay.replayed,true);assert.equal(h.calls.mutations,before.mutations);assert.equal(h.calls.get,before.get);
 h.setRole('SITE_MANAGER');await assert.rejects(h.imports.attach(session,input),permissionError);await assert.rejects(h.imports.read(session,{...context,operationId:input.operationId}),permissionError);
});

test('v4 financial authorization blocks upload before I/O for every other role and is rechecked after Blob I/O',async()=>{
 const {source}=await sample();
 for(const role of ['SITE_MANAGER','FINANCE','AUDITOR']){const h=storeHarness({role});await assert.rejects(h.imports.attach(session,{...context,source,consent:PLAN_IMPORT_CYP_CURVE_CONSENT,operationId:randomUUID()}),permissionError);assert.deepEqual([h.calls.put,h.calls.get,h.calls.analyze,h.calls.mutations],[0,0,0,0]);}
 const h=storeHarness();h.setOnGet(()=>h.setRole('SITE_MANAGER'));await assert.rejects(h.imports.attach(session,{...context,source,consent:PLAN_IMPORT_CYP_CURVE_CONSENT,operationId:randomUUID()}),permissionError);assert.ok(h.calls.get>0);assert.equal(h.calls.analyze,0);assert.equal(h.calls.taskBatches,0);
});

test('v4 privacy classifies consent, analysis, outcome and receipt metadata independently before list pagination',async()=>{
 const h=await seeded({role:'SITE_MANAGER'}),pdf=decodePlanSource(Buffer.from('%PDF-1.7\nSynthetic\n%%EOF'),'application/pdf'),legacy={rows:[{title:'Legacy synthetic task',startsOn:null,endsOn:null,evidence:'Synthetic row',uncertainty:'Dates pending'}],spreadsheet:null};
 for(let i=0;i<24;i++){
  const id=h.addDraft(h.extraction,h.source,{id:'draft-z-private-'+i.toString().padStart(2,'0'),consent:PLAN_IMPORT_CYP_CURVE_CONSENT});
  if(i%4===1)h.changeDraft(id,m=>{m.consent.version='plan-spreadsheet-cyp-partidas-v2';});
  if(i%4===2)h.changeDraft(id,m=>{m.analysis.spreadsheet=null;});
  if(i%4===3)h.changeDraft(id,m=>{m.consent.version='plan-spreadsheet-cyp-partidas-v2';m.outcome={draft:{spreadsheet:m.analysis.spreadsheet}};m.analysis.spreadsheet=null;});
 }
 h.addDraft(legacy,pdf,{id:'draft-a-legacy',consent:'plan-document-openai-v1'});const result=await h.imports.read(session,context);
 assert.deepEqual(result.drafts.map(row=>row.id),['draft-a-legacy']);assert.equal(result.truncated,false);assert.doesNotMatch(JSON.stringify(result),/cachedValue|CYP_PARTIDAS_CURVE/);
 const listSQL=h.calls.sql.find(sql=>sql.includes('ORDER BY "createdAt"'));assert.match(listSQL,/plan-spreadsheet-cyp-curve-v4.*<> '4'.*ORDER BY.*LIMIT 21/);
 await assert.rejects(h.imports.read(session,{...context,draftId:h.draftId}),permissionError);await assert.rejects(h.imports.source(session,{...context,draftId:h.draftId}),permissionError);assert.equal(h.calls.get,0);
 const admin=await seeded();admin.setOnGet(()=>admin.setRole('SITE_MANAGER'));await assert.rejects(admin.imports.source(session,{...context,draftId:admin.draftId}),permissionError);assert.equal(admin.calls.get,1);
});

test('financial classification survives pending or failed extraction without publishing analysis or consent',async()=>{
 for(const consent of ['plan-spreadsheet-monthly-curve-v3',PLAN_IMPORT_CYP_CURVE_CONSENT])for(const status of ['UPLOADING','PROCESSING','FAILED']){
  const h=await seeded();h.changeDraft(h.draftId,m=>{m.consent.version=consent;m.status=status;m.analysis=null;m.rows=[];m.extractedRows=[];});
  const result=await h.imports.read(session,{...context,draftId:h.draftId});assert.equal(result.draft.financialSource,true);assert.equal(result.draft.spreadsheet,undefined);assert.doesNotMatch(JSON.stringify(result.draft),/plan-spreadsheet-|cachedValue|sourceConsent/);
  const list=await h.imports.read(session,context);assert.equal(list.drafts[0].financialSource,true);
  h.setRole('SITE_MANAGER');assert.deepEqual((await h.imports.read(session,context)).drafts,[]);await assert.rejects(h.imports.source(session,{...context,draftId:h.draftId}),permissionError);assert.equal(h.calls.get,0);
 }
});

test('v4 EDIT/APPLY/REJECT and typed-rejection recovery are private with immutable financial receipt classification',async()=>{
 const h=await seeded({role:'SITE_MANAGER'});
 for(const action of ['EDIT','APPLY','REJECT'])await assert.rejects(h.imports.decide(session,decision(h,reviewed(h.extraction.rows),{action})),permissionError);
 h.setRole('ADMIN');const body=decision(h,[{...h.extraction.rows[0],budget:'synthetic prohibited value'}]),rejected=await h.imports.decide(session,body);
 assert.equal(rejected.state,'REJECTED');assert.equal(rejected.taskEffects,false);assert.equal(h.logs().find(row=>row.action==='plan.import.decision').metadata.sourceConsent,PLAN_IMPORT_CYP_CURVE_CONSENT);
 h.setRole('SITE_MANAGER');await assert.rejects(h.imports.read(session,{...context,operationId:body.operationId}),permissionError);assert.equal(h.calls.taskBatches,0);
});

test('v4 needs persisted dates/review and keeps the full source curve when a subset is reordered, applied and replayed',async()=>{
 const h=await seeded(),original=structuredClone(h.extraction.spreadsheet),pending=await h.imports.decide(session,decision(h,h.extraction.rows,{action:'APPLY'}));assert.equal(pending.code,'PLAN_IMPORT_REVIEW_REQUIRED');
 const incomplete=reviewed(h.extraction.rows.slice(0,3));incomplete[0].sourceIssueReviewed=false;assert.equal((await h.imports.decide(session,decision(h,incomplete,{action:'APPLY'}))).code,'PLAN_IMPORT_REVIEW_REQUIRED');
 const rows=reviewed(h.extraction.rows).slice(0,3).reverse(),edited=await h.imports.decide(session,decision(h,rows));assert.equal(edited.draft.spreadsheet.rowCount,190);assert.deepEqual(edited.draft.spreadsheet, {...original,reviewed:true});
 const body=decision(h,rows,{action:'APPLY',revision:edited.draft.revision}),applied=await h.imports.decide(session,body);assert.equal(applied.saved,true);assert.equal(h.calls.taskBatches,1);assert.equal(applied.tasks.length,3);assert.deepEqual(applied.draft.spreadsheet.curve,original.curve);
 const tasks=h.tasks().filter(row=>row.id!==oldTask.id);assert.deepEqual(tasks.map(row=>row.metadata.planImport.code),rows.map(row=>row.code));
 for(const task of tasks){assert.equal(task.progress,0);assert.equal(task.status,'BACKLOG');assert.equal(task.metadata.planImport.version,4);assert.equal(task.metadata.planImport.profile,'CYP_PARTIDAS_CURVE');assert.ok(task.metadata.planImport.groups.length>=2);assert.equal(task.metadata.planImport.sourceSha256,h.source.sha256);assert.doesNotMatch(JSON.stringify(task.metadata),/cachedValue|monthlyAmount|cumulativeAmount|currency|budget/);}
 assert.deepEqual(h.tasks().find(row=>row.id===oldTask.id),oldTask);const before=h.calls.mutations,replay=await h.imports.decide(session,body);assert.equal(replay.replayed,true);assert.equal(h.calls.mutations,before);assert.equal(h.tasks().length,4);
 const rejectedUploadId=randomUUID(),upload=await h.imports.attach(session,{...context,source:h.source,consent:PLAN_IMPORT_CYP_CURVE_CONSENT,operationId:rejectedUploadId});assert.equal(upload.code,'PLAN_IMPORT_SOURCE_ALREADY_APPLIED');assert.equal(h.logs().find(row=>row.action==='plan.import.upload').metadata.sourceConsent,PLAN_IMPORT_CYP_CURVE_CONSENT);
 h.setRole('SITE_MANAGER');for(const operationId of [body.operationId,rejectedUploadId])await assert.rejects(h.imports.read(session,{...context,operationId}),permissionError);
});

test('financial v4 accepts >256 KiB only for a canonical consent/version pair and retains HTTP origin/no-store protections',async()=>{
 const h=await seeded(),body=decision(h,h.extraction.rows.map(row=>({...row,title:'Ó'.repeat(500),uncertainty:'Ú'.repeat(500)}))),requestBytes=500*1024;
 const response=await h.imports.decide(session,body,{requestBytes});assert.equal(response.saved,true);
 for(const patch of [m=>{m.consent.version='plan-spreadsheet-cyp-partidas-v2';},m=>{m.analysis.spreadsheet.version=2;},m=>{m.analysis.spreadsheet.curve.currency='ARS';}]){const other=await seeded();other.changeDraft(other.draftId,patch);await assert.rejects(other.imports.decide(session,decision(other,other.extraction.rows),{requestBytes}),{code:'PLAN_IMPORT_INPUT_INVALID',status:413});assert.equal(other.calls.mutations,0);}
 const auth={...session,authenticated:true,verification:'clerk-production-jwt',organizationRole:'org:admin'},http=createPlanImportHandlers({verify:async()=>auth,imports:h.imports});
 const denied=await http.POST(new Request('https://obrasaas.com/api/identity/plan-import',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://foreign.invalid'},body:JSON.stringify(body)}));assert.equal(denied.status,403);assert.match(denied.headers.get('cache-control'),/no-store/);
 const bytes=Buffer.byteLength(JSON.stringify(body));assert.ok(bytes>256*1024);const result=await http.POST(new Request('https://obrasaas.com/api/identity/plan-import',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://obrasaas.com'},body:JSON.stringify(body)}));assert.equal(result.status,200);assert.equal((await result.json()).replayed,true);assert.match(result.headers.get('cache-control'),/private, no-store/);
});

test('v4 upload recovery uses the unchanged v1 fingerprint and stores no source, rows or curve locally',async()=>{
 const {source}=await sample(),operationId=randomUUID(),consent=PLAN_IMPORT_CYP_CURVE_CONSENT,metadata={bytes:source.bytes.length,contentType:source.contentType,sha256:source.sha256};
 for(const version of ['plan-spreadsheet-monthly-rubros-v1','plan-spreadsheet-cyp-partidas-v2','plan-spreadsheet-monthly-curve-v3',consent])assert.equal(await planImportUploadDigest({...context,operationId,consent:version,source:metadata}),digest(['plan-import-upload-command-v1',{action:'UPLOAD',consent:version,operationId,projectId:context.projectId,scope:context.scope,source:metadata}]));
 const plain={title:'Synthetic source',startsOn:'2026-11-01',endsOn:'2026-11-30',evidence:'Synthetic row',uncertainty:''};for(const row of [plain,{...plain,code:'A.1.1.1',parentCode:'A.1.1',sourceIssueReviewed:true},{...plain,sourceRowId:'Plan y curva Meses!A10'}]){const body={...context,operationId,draftId:'draft-legacy-synthetic',expectedRevision:1,action:'EDIT',reason:'Synthetic legacy review',rows:[row]};assert.equal(planDecisionDigest(body),digest(['plan-import-decision-v1',context.projectId,context.scope,operationId,body.draftId,1,'EDIT',body.reason,[[row.title,row.startsOn,row.endsOn,row.evidence,row.uncertainty,...(row.code?[row.code,row.parentCode,row.sourceIssueReviewed]:row.sourceRowId?[row.sourceRowId]:[])]]]));}
 const stored=new Map(),storage={get length(){return stored.size;},key:i=>[...stored.keys()][i]??null,getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)},journal=createWorkspaceRecoveryJournal({getStorage:()=>storage}),form=new FormData();for(const [key,value] of Object.entries({...context,operationId,consent}))form.set(key,value);form.set('file',new Blob([source.bytes],{type:mime}),'synthetic.xlsx');
 const ticket=await journal.prepare('/api/identity/plan-import',{method:'POST',body:form}),entries=await journal.list(context.scope);assert.equal(entries.length,1);assert.equal(ticket.entry.inputDigest,await planImportUploadDigest({...context,operationId,consent,source:metadata}));assert.deepEqual(Object.keys(ticket.entry).sort(),['action','createdAt','inputDigest','operationId','projectId','resource','scope','version']);assert.doesNotMatch(JSON.stringify([...stored]),/cachedValue|rows|curve|file|sha256|consent/);assert.match(recoveryQuery(entries[0]),/operationId=/);
});

test('wrong workspace scope cannot expose v4 or its source, and receipt failure rolls back Task creation',async()=>{
 const h=await seeded();await assert.rejects(h.imports.read(session,{...context,scope:'b'.repeat(64),draftId:h.draftId}),{code:'WORKSPACE_CONTEXT_CHANGED'});assert.equal(h.calls.get,0);
 const rows=reviewed(h.extraction.rows.slice(0,3)),edited=await h.imports.decide(session,decision(h,rows)),before=h.logs();h.setFailReceipt(true);await assert.rejects(h.imports.decide(session,decision(h,rows,{action:'APPLY',revision:edited.draft.revision})),/Synthetic receipt failure/);assert.deepEqual(h.tasks(),[oldTask]);assert.deepEqual(h.logs(),before);
});

// Real canonical transaction, HTTP, local analyzer and OOXML parser; only SQL
// transport and private Blob are synthetic. Task access is forbidden outright.
const investmentAnalyzer=()=>createPlanImportAnalyzer({environment:()=>{throw Error('Local CyP must not read AI credentials');},fetchImpl:()=>{throw Error('Local CyP must not call a provider');}});
const investmentHarness=options=>documentStoreHarness({analyzerOverride:investmentAnalyzer(),...options});
const investmentSourceFile=options=>decodePlanSource(cypInvestmentFixture(options),mime);
const investmentAttach=(h,options={})=>h.attach({consent:PLAN_CYP_INVESTMENT_CONSENT,source:investmentSourceFile(options)});
const investmentCommand=(h,draft,action='REVIEW_INVESTMENT',acknowledgeDifference=draft.differenceAcknowledged===true)=>({...h.context(),action,operationId:randomUUID(),draftId:draft.id,expectedRevision:draft.revision,reason:'Reviewed original monthly and weekly cached amounts',acknowledgeDifference});
const investmentPost=(h,body,headers={})=>h.http.POST(new Request('https://obrasaas.com/api/identity/plan-import',{method:'POST',headers:{origin:'https://obrasaas.com','content-type':'application/json',...headers},body:JSON.stringify(body)}));

for(const role of ['ADMIN','DIRECTOR'])test('v5 canonical financial upload review approval and exact recovery preserve both source curves and 5001 Tasks for '+role,async()=>{
 const h=investmentHarness({role}),before=h.tasks(),uploaded=await investmentAttach(h),draft=uploaded.draft,original=structuredClone(draft.spreadsheet),sourceDigest=planInvestmentCurveDigest(original);
 assert.equal(draft.financialSource,true);assert.equal(draft.investmentReviewed,false);assert.equal(draft.differenceAcknowledged,false);assert.equal(draft.existingTaskCount,null);assert.deepEqual(draft.rows,[]);assert.equal(draft.spreadsheet.version,5);assert.equal(draft.spreadsheet.weekly.periods.length,48);
 assert.equal(planInvestmentCurveDigest({...original,reviewed:true}),sourceDigest);assert.equal(h.logs().find(row=>row.id===draft.id).metadata.baseline,null);
 const early=await investmentPost(h,investmentCommand(h,draft,'APPLY_INVESTMENT'));assert.equal(early.status,409);assert.equal((await early.json()).code,'PLAN_IMPORT_REVIEW_REQUIRED');
 const reviewBody=investmentCommand(h,draft),review=await h.imports.decide(investmentSession,reviewBody);assert.equal(review.inputDigest,planInvestmentDecisionDigest(reviewBody));assert.equal(review.draft.investmentReviewed,true);assert.equal(review.draft.decision,null);assert.equal(review.draft.differenceAcknowledged,false);
 const wrongAck=await h.imports.decide(investmentSession,investmentCommand(h,review.draft,'APPLY_INVESTMENT',true));assert.equal(wrongAck.state,'REJECTED');assert.equal(wrongAck.code,'PLAN_IMPORT_REVIEW_REQUIRED');
 const body=investmentCommand(h,review.draft,'APPLY_INVESTMENT'),response=await investmentPost(h,body),applied=await response.json();assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/private, no-store/);assert.equal(applied.draft.status,'APPLIED');assert.equal(applied.taskEffects,false);assert.equal(applied.baselineEffects,false);assert.deepEqual(applied.taskSnapshots,[]);assert.deepEqual(applied.tasks,[]);assert.deepEqual(applied.draft.spreadsheet,{...original,reviewed:true});
 const log=h.logs().find(row=>row.id===applied.receiptId);assert.equal(log.metadata.version,3);assert.equal(log.metadata.reviewReceiptId,review.receiptId);assert.equal(log.metadata.sourceCurveDigest,sourceDigest);assert.deepEqual(validatePlanInvestmentReceipt(log,{organizationId:h.member.organizationId,projectId:h.context().projectId,actorId:h.member.actorId}).draft,applied.draft);
 const io=[h.calls.put,h.calls.get,h.calls.provider],replay=await h.imports.decide(investmentSession,body),lookup=await h.imports.read(investmentSession,{...h.context(),operationId:body.operationId});assert.equal(replay.replayed,true);assert.equal(lookup.receiptId,applied.receiptId);assert.deepEqual(lookup.draft,applied.draft);assert.deepEqual([h.calls.put,h.calls.get,h.calls.provider],io);
 assert.deepEqual(h.tasks(),before);assert.equal(h.calls.taskWrites,0);assert.equal(h.calls.sql.some(sql=>sql.includes('public."Task"')),false);assert.equal(h.calls.provider,0);assert.doesNotMatch(JSON.stringify(applied),/"pathname"|"lease"|private\.blob|"sourceConsent"|"investmentReview"/);
});

test('v5 exact difference requires explicit persisted acknowledgement and cannot silently change either source series',async()=>{
 const h=investmentHarness({taskCount:0}),uploaded=await investmentAttach(h,{weeklyAmounts:Array(48).fill('1.0010')}),draft=uploaded.draft,original=structuredClone(draft.spreadsheet);
 assert.equal(original.comparison.status,'DIFFERENT');assert.equal(original.comparison.weeklySumDecimalText,'48.0480000');assert.ok(original.weekly.periods.every(period=>period.amount.cachedValue==='1.0010'));
 const missingBody=investmentCommand(h,draft),missing=await investmentPost(h,missingBody);assert.equal(missing.status,409);const denied=await missing.json();assert.equal(denied.code,'PLAN_IMPORT_REVIEW_REQUIRED');assert.equal(denied.taskEffects,false);assert.equal((await h.imports.read(investmentSession,{...h.context(),operationId:missingBody.operationId})).receiptId,denied.receiptId);
 const review=await h.imports.decide(investmentSession,investmentCommand(h,draft,'REVIEW_INVESTMENT',true)),body=investmentCommand(h,review.draft,'APPLY_INVESTMENT',true),applied=await h.imports.decide(investmentSession,body);assert.equal(applied.draft.differenceAcknowledged,true);assert.deepEqual(applied.draft.spreadsheet,{...original,reviewed:true});
 const duplicate=await investmentAttach(h,{weeklyAmounts:Array(48).fill('1.0010')});assert.equal(duplicate.state,'REJECTED');assert.equal(duplicate.phase,'PRE_RESERVATION');assert.equal(duplicate.code,'PLAN_IMPORT_SOURCE_ALREADY_APPLIED');assert.equal(h.calls.sql.some(sql=>sql.includes('public."Task"')),false);
});

test('v5 exact envelope rejects client amounts and legacy commands while receipt decoder binds source review and immutable acknowledgement',async()=>{
 const h=investmentHarness({taskCount:0}),draft=(await investmentAttach(h)).draft,body=investmentCommand(h,draft);
 for(const change of [{rows:[]},{curve:draft.spreadsheet},{acknowledgeDifference:1},{expectedRevision:2147483647},{reason:'short'},{action:'APPLY'}])assert.throws(()=>normalizePlanInvestmentDecision({...body,...change}),{code:'PLAN_IMPORT_INPUT_INVALID'});
 await assert.rejects(h.imports.decide(investmentSession,{...h.context(),action:'EDIT',operationId:randomUUID(),draftId:draft.id,expectedRevision:draft.revision,reason:'Legacy task command must not review finance',rows:[]}),{code:'PLAN_IMPORT_INPUT_INVALID'});
 const review=await h.imports.decide(investmentSession,body),row=h.logs().find(value=>value.id===review.receiptId),identity={organizationId:h.member.organizationId,projectId:h.context().projectId,actorId:h.member.actorId};
 for(const mutate of [r=>{r.metadata.request.reason='Changed without digest';},r=>{r.metadata.reviewReceiptId='plan_receipt_'+'0'.repeat(64);},r=>{r.metadata.outcome.draft.differenceAcknowledged=true;},r=>{r.metadata.outcome.draft.spreadsheet.weekly.periods[0].amount.cachedValue='0';},r=>{r.actorId='actor-other';},r=>{r.metadata.outcome.taskEffects=true;},r=>{r.metadata.outcome.taskSnapshots=[{id:'invented-task'}];}]){const changed=structuredClone(row);mutate(changed);assert.throws(()=>validatePlanInvestmentReceipt(changed,identity),{code:'PLAN_IMPORT_RECEIPT_INTEGRITY'});}
 h.changeLog(draft.id,r=>{r.metadata.investmentReview.reason='Reason no longer matches authentic review';});await assert.rejects(h.imports.decide(investmentSession,investmentCommand(h,review.draft,'APPLY_INVESTMENT')),{code:'PLAN_IMPORT_RECEIPT_INTEGRITY'});assert.equal(h.calls.taskWrites,0);
});

test('v5 current financial authority protects pending drafts, receipts, source download and post-Blob dispatch',async()=>{
 for(const role of ['SITE_MANAGER','FINANCE','AUDITOR']){const h=investmentHarness({role,taskCount:0});await assert.rejects(investmentAttach(h),permissionError);assert.deepEqual([h.calls.put,h.calls.get,h.calls.provider,h.calls.mutations],[0,0,0,0]);}
 const h=investmentHarness({taskCount:0}),uploaded=await investmentAttach(h),body=investmentCommand(h,uploaded.draft),review=await h.imports.decide(investmentSession,body);h.member.role='SITE_MANAGER';
 assert.deepEqual((await h.imports.read(investmentSession,h.context())).drafts,[]);for(const method of [()=>h.imports.read(investmentSession,{...h.context(),draftId:uploaded.draft.id}),()=>h.imports.read(investmentSession,{...h.context(),operationId:body.operationId}),()=>h.imports.source(investmentSession,{...h.context(),draftId:uploaded.draft.id}),()=>h.imports.decide(investmentSession,investmentCommand(h,review.draft,'APPLY_INVESTMENT'))])await assert.rejects(method,permissionError);
 const revoked=investmentHarness({taskCount:0});revoked.controls.afterBlob=()=>{revoked.member.role='SITE_MANAGER';};await assert.rejects(investmentAttach(revoked),{code:'WORKSPACE_CONTEXT_CHANGED',status:409});assert.equal(revoked.calls.provider,0);assert.equal(revoked.calls.taskWrites,0);
 const failed=investmentHarness({taskCount:0,analyzerOverride:{analyze:async()=>({success:false,code:'PLAN_IMPORT_SPREADSHEET_FORMULA_INVALID'})}}),out=await investmentAttach(failed);assert.equal(out.draft.status,'FAILED');assert.equal(out.draft.investmentReviewed,false);assert.equal(out.draft.differenceAcknowledged,false);assert.equal(out.draft.financialSource,true);assert.equal(out.draft.spreadsheet,undefined);failed.member.role='SITE_MANAGER';assert.deepEqual((await failed.imports.read(investmentSession,failed.context())).drafts,[]);
});

test('v5 lost acknowledgement and rollback preserve exact UUID recovery without repeating source I/O',async()=>{
 for(const action of ['REVIEW_INVESTMENT','APPLY_INVESTMENT','REJECT_INVESTMENT'])for(const mode of ['ACK_LOST','ROLLBACK']){
  const h=investmentHarness({taskCount:0});let draft=(await investmentAttach(h)).draft;if(action==='APPLY_INVESTMENT')draft=(await h.imports.decide(investmentSession,investmentCommand(h,draft))).draft;
  const body=investmentCommand(h,draft,action),io=[h.calls.put,h.calls.get,h.calls.provider];h.controls.commitMode=mode;const response=await investmentPost(h,body);assert.equal(response.status,503);assert.equal((await response.json()).code,'WORKSPACE_OPERATION_UNCONFIRMED');const recovery=await h.imports.read(investmentSession,{...h.context(),operationId:body.operationId});assert.equal(recovery.state,mode==='ACK_LOST'?'RECORDED':'NOT_OBSERVED');if(mode==='ROLLBACK')assert.equal(recovery.definitive,false);
  const replay=await h.imports.decide(investmentSession,body);assert.equal(replay.replayed,mode==='ACK_LOST');assert.equal(h.logs().filter(row=>row.action==='plan.import.decision'&&row.metadata.operationId===body.operationId).length,1);assert.deepEqual([h.calls.put,h.calls.get,h.calls.provider],io);assert.equal(h.calls.sql.some(sql=>sql.includes('public."Task"')),false);
 }
});

test('v5 financial purpose coexists with a real applied v4 Task import of the identical workbook SHA',async()=>{
 const h=investmentHarness({taskCount:0}),source=investmentSourceFile();h.controls.forbidTasks=false;
 const legacy=await h.attach({consent:PLAN_IMPORT_CYP_CURVE_CONSENT,source}),row={...legacy.draft.rows[0],startsOn:'2026-11-01',endsOn:'2026-11-02',uncertainty:'',sourceIssueReviewed:true},command=(draft,action)=>({...h.context(),action,operationId:randomUUID(),draftId:draft.id,expectedRevision:draft.revision,reason:'Reviewed synthetic physical task and exact dates',rows:[row]});
 const edit=await h.imports.decide(investmentSession,command(legacy.draft,'EDIT')),oldBody=command(edit.draft,'APPLY'),old=await h.imports.decide(investmentSession,oldBody);assert.equal(old.tasks.length,1);
 const before=h.tasks(),writes=h.calls.taskWrites,sqlStart=h.calls.sql.length;h.controls.forbidTasks=true;
 const uploaded=await h.attach({consent:PLAN_CYP_INVESTMENT_CONSENT,source}),review=await h.imports.decide(investmentSession,investmentCommand(h,uploaded.draft)),applied=await h.imports.decide(investmentSession,investmentCommand(h,review.draft,'APPLY_INVESTMENT'));
 assert.equal(applied.draft.source.sha256,old.draft.source.sha256);assert.equal(applied.draft.status,'APPLIED');assert.deepEqual(h.tasks(),before);assert.equal(h.calls.taskWrites,writes);assert.equal(h.calls.sql.slice(sqlStart).some(sql=>sql.includes('public."Task"')),false);h.controls.forbidTasks=false;assert.deepEqual((await h.imports.read(investmentSession,{...h.context(),operationId:oldBody.operationId})).tasks,old.tasks);
});
