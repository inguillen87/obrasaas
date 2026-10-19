import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {budgetStoreHarness,budgetContext as context,budgetSession as session,budgetSourceFile,budgetUploadInput,invalidBudgetZipSource} from './fixtures/plan-budget-store-synthetic.mjs';
import {PLAN_BUDGET_SOURCE_CONSENT,PLAN_BUDGET_SOURCE_PURPOSE,PLAN_BUDGET_SOURCE_PROFILE,planBudgetSourceDigest,selectPlanBudgetSourceRow} from '../src/lib/plan-budget-source.mjs';
import {PLAN_IMPORT_CYP_CONSENT,PLAN_IMPORT_CYP_CURVE_CONSENT} from '../src/lib/plan-import-policy.mjs';
import {documentCurveFixture} from './fixtures/plan-import-document-curve-synthetic.mjs';

const reason='Consulta del presupuesto original sin aprobar ni aplicar importes.';
const descriptorKeys=['version','profile','purpose','projectId','sourceSha256','sourceDigest','measurementSourceDigest','rowCount','currency'].sort();
const command=(draft,action,changes={})=>({...context,operationId:randomUUID(),action,draftId:draft.id,expectedRevision:draft.revision,reason,rows:action==='REJECT'?null:[{title:'Tarea que no debe crearse',startsOn:'2026-11-01',endsOn:'2026-11-02',evidence:'Fila sintética revisada',uncertainty:''}],...changes});
const details=(h,draft)=>h.imports.read(session,{...context,draftId:draft.id});
async function uploaded(h,source=budgetSourceFile()){const input=budgetUploadInput(source);return {input,result:await h.imports.attach(session,input)};}
function assertDescriptor(draft,source,rowCount=2){
 assert.equal(draft.budgetImport,true);assert.equal(draft.financialSource,true);assert.deepEqual(draft.rows,[]);assert.equal(draft.existingTaskCount,null);
 const descriptor=draft.budgetDescriptor;assert.deepEqual(Object.keys(descriptor).sort(),descriptorKeys);assert.equal(descriptor.version,2);assert.equal(descriptor.profile,PLAN_BUDGET_SOURCE_PROFILE);assert.equal(descriptor.purpose,PLAN_BUDGET_SOURCE_PURPOSE);assert.equal(descriptor.projectId,context.projectId);assert.equal(descriptor.sourceSha256,source.sha256);assert.equal(descriptor.rowCount,rowCount);assert.match(descriptor.sourceDigest,/^[a-f0-9]{64}$/);assert.match(descriptor.measurementSourceDigest,/^[a-f0-9]{64}$/);assert.deepEqual(descriptor.currency,{code:null,status:'UNKNOWN'});assert.equal(Object.hasOwn(draft,'sourceDigest'),false);
}
function assertDescriptorOnly(draft,source){assertDescriptor(draft,source);assert.equal(Object.hasOwn(draft,'budgetSource'),false);const json=JSON.stringify(draft);for(const fact of ['monthBase','priceBasis','priceCoefficient','unitPrice','lineAmount','controlCells','styleTable'])assert.equal(json.includes('"'+fact+'"'),false,fact+' leaked outside exact draft read');}
function assertNoBusinessEffects(h){assert.equal(h.state().tasks.size,0);assert.equal(h.calls.taskReads,0);assert.equal(h.calls.taskWrites,0);assert.equal(h.calls.provider,0);assert.equal(h.calls.providerConfiguration,0);assert.ok(h.calls.sql.every(sql=>sql.includes('public."AuditLog"')));assert.ok([...h.state().logs.values()].every(row=>row.action==='plan.import.draft'));}
async function rejectedWithoutWrites(h,run,code,status){const before=h.state();await assert.rejects(run,error=>{if(code)assert.equal(error.code,code);if(status)assert.equal(error.status,status);return true;});assert.deepEqual(h.state(),before);}

test('explicit local budget upload stores an immutable source while upload, list and operation recovery return only descriptors',async()=>{
 const h=budgetStoreHarness(),source=budgetSourceFile(),{input,result}=await uploaded(h,source),draft=result.draft;
 assert.equal(result.saved,true);assert.equal(result.replayed,false);assert.equal(draft.status,'READY');assertDescriptorOnly(draft,source);assert.equal(h.calls.analyzer,1);
 const metadata=h.state().logs.get(draft.id).metadata;assert.equal(metadata.sourcePurpose,PLAN_BUDGET_SOURCE_PURPOSE);assert.equal(metadata.consent.version,PLAN_BUDGET_SOURCE_CONSENT);assert.equal(metadata.baseline,null);assert.deepEqual(metadata.extractedRows,[]);assert.equal(metadata.analysis.provider,'local-ooxml');assert.equal(metadata.analysis.model,null);assert.equal(metadata.analysis.requestedModel,null);assert.equal(metadata.analysis.reviewed,false);assert.deepEqual(metadata.analysis.budgetDescriptor,draft.budgetDescriptor);assert.equal(metadata.analysis.budgetDigest,draft.budgetDescriptor.sourceDigest);
 const list=await h.imports.read(session,context);assert.equal(list.canApprove,true);assert.equal(list.drafts.length,1);assertDescriptorOnly(list.drafts[0],source);
 const operation=await h.imports.read(session,{...context,operationId:input.operationId});assert.equal(operation.state,'RECORDED');assertDescriptorOnly(operation.draft,source);
 const replay=await h.imports.attach(session,input);assert.equal(replay.replayed,true);assertDescriptorOnly(replay.draft,source);assert.equal(h.calls.analyzer,1);assert.equal(h.calls.put,1);
 assertNoBusinessEffects(h);
});

test('exact draft read binds full original evidence to project, file and physical row without approving money or calendar dates',async()=>{
 const h=budgetStoreHarness(),source=budgetSourceFile({quantity:'9007199254740993.1234500',unitPrice:'999.0000',amounts:['2.5000','3.7500']}),{result}=await uploaded(h,source),detail=await details(h,result.draft),full=detail.draft;
 assert.equal(detail.canApprove,true);
 assertDescriptor(full,source);const budget=full.budgetSource;assert.equal(budget.sourceSha256,source.sha256);assert.equal(planBudgetSourceDigest(budget),full.budgetDescriptor.sourceDigest);assert.equal(budget.measurementSourceDigest,full.budgetDescriptor.measurementSourceDigest);assert.equal(budget.sourceDigest,full.budgetDescriptor.sourceDigest);assert.deepEqual(budget.currency,{code:null,status:'UNKNOWN'});
 assert.deepEqual(h.state().logs.get(full.id).metadata.analysis.budgetDescriptor,full.budgetDescriptor);
 const row=budget.rows[0],selected=selectPlanBudgetSourceRow(budget,{sourceSha256:source.sha256,sourceDigest:full.budgetDescriptor.sourceDigest,code:row.code,budgetWorksheet:row.budget.worksheet,budgetRow:row.budget.row,planWorksheet:row.plan.worksheet,planRow:row.plan.row});
 assert.equal(selected.observed.quantity.decimal,'9007199254740993.1234500');assert.equal(selected.observed.unitPrice.decimal,'999.0000');assert.equal(selected.observed.lineAmount.decimal,'2.5000');assert.equal(selected.observed.lineAmount.kind,'FORMULA_CACHE');assert.equal(selected.automaticUseAllowed,false);assert.equal(selected.reviewRequired,true);assert.equal(budget.monthBase.interpretedDate,null);
 for(const flag of ['formulasEvaluated','macrosExecuted','unitsConverted','calendarDatesInferred','taskWrites','stockWrites'])assert.equal(budget[flag],false,flag);
 assertNoBusinessEffects(h);
});

test('pending draft has a null descriptor and remains recoverable without manufacturing budget evidence',async()=>{
 const h=budgetStoreHarness(),source=budgetSourceFile(),input=budgetUploadInput(source);let pending;
 h.setAfterPut(async()=>{pending=await h.imports.read(session,{...context,operationId:input.operationId});});
 const result=await h.imports.attach(session,input);assert.equal(pending.state,'RECORDED');assert.equal(pending.draft.status,'UPLOADING');assert.equal(pending.draft.budgetImport,true);assert.equal(pending.draft.financialSource,true);assert.equal(pending.draft.budgetDescriptor,null);assert.equal(Object.hasOwn(pending.draft,'budgetSource'),false);assertDescriptorOnly(result.draft,source);assertNoBusinessEffects(h);
});

test('ADMIN and DIRECTOR are the only budget upload roles and denied ZIPs never reach storage or analysis',async()=>{
 for(const role of ['ADMIN','DIRECTOR']){const h=budgetStoreHarness();h.setRole(role);const {result}=await uploaded(h);assert.equal(result.draft.status,'READY');const detail=await details(h,result.draft);assert.equal(detail.canApprove,true);assert.ok(detail.draft.budgetSource);assertNoBusinessEffects(h);}
 for(const role of ['SITE_MANAGER','ACCOUNTANT','WORKER']){
  const h=budgetStoreHarness();h.setRole(role);await rejectedWithoutWrites(h,()=>h.imports.attach(session,budgetUploadInput(invalidBudgetZipSource())),'PLAN_IMPORT_PERMISSION_REQUIRED',403);
  assert.equal(h.calls.get,0);assert.equal(h.calls.put,0);assert.equal(h.calls.analyzer,0);assert.equal(h.calls.storageConfiguration,0);assertNoBusinessEffects(h);
 }
});

test('current role downgrade protects exact read, original download, upload replay and operation recovery',async()=>{
 const h=budgetStoreHarness(),{input,result}=await uploaded(h),beforeIo={get:h.calls.get,put:h.calls.put,analyzer:h.calls.analyzer};h.setRole('SITE_MANAGER');
 for(const run of [()=>details(h,result.draft),()=>h.imports.source(session,{...context,draftId:result.draft.id}),()=>h.imports.attach(session,input),()=>h.imports.read(session,{...context,operationId:input.operationId})])await rejectedWithoutWrites(h,run,'PLAN_IMPORT_PERMISSION_REQUIRED',403);
 const list=await h.imports.read(session,context);assert.equal(list.canApprove,false);assert.deepEqual(list.drafts,[]);assert.deepEqual({get:h.calls.get,put:h.calls.put,analyzer:h.calls.analyzer},beforeIo);assertNoBusinessEffects(h);
});

test('channelProof denies budget upload, exact read, original download, operation read and replay even for ADMIN',async()=>{
 const h=budgetStoreHarness(),{input,result}=await uploaded(h);h.setChannelProof({channel:'WHATSAPP',synthetic:true});const beforeIo={get:h.calls.get,put:h.calls.put,analyzer:h.calls.analyzer};
 for(const run of [()=>h.imports.attach(session,budgetUploadInput(invalidBudgetZipSource())),()=>details(h,result.draft),()=>h.imports.source(session,{...context,draftId:result.draft.id}),()=>h.imports.read(session,{...context,operationId:input.operationId}),()=>h.imports.attach(session,input)])await rejectedWithoutWrites(h,run,'PLAN_IMPORT_PERMISSION_REQUIRED',403);
 const list=await h.imports.read(session,context);assert.deepEqual(list.drafts,[]);assert.equal(JSON.stringify(list).includes('999.0000'),false);assert.deepEqual({get:h.calls.get,put:h.calls.put,analyzer:h.calls.analyzer},beforeIo);assertNoBusinessEffects(h);
});

test('canonical project, scope, identity and tenant checks precede budget access and leave no observable business writes',async()=>{
 const h=budgetStoreHarness(),{input,result}=await uploaded(h),beforeIo={get:h.calls.get,put:h.calls.put,analyzer:h.calls.analyzer};
 for(const [identity,patch]of [[session,{scope:'e'.repeat(64)}],[session,{projectId:'foreign-project'}],[{...session,userId:'user_Foreign'},{}],[{...session,organizationId:'org_Foreign'},{}]]){
  await rejectedWithoutWrites(h,()=>h.imports.read(identity,{...context,...patch,draftId:result.draft.id}),'WORKSPACE_CONTEXT_CHANGED',403);
  await rejectedWithoutWrites(h,()=>h.imports.attach(identity,{...input,...patch,operationId:randomUUID()}),'WORKSPACE_CONTEXT_CHANGED',403);
 }
 const foreign=structuredClone(h.state().logs.get(result.draft.id));foreign.id='plan_draft_'+'f'.repeat(64);foreign.organizationId='foreign-org';h.addLog(foreign);
 await rejectedWithoutWrites(h,()=>details(h,{id:foreign.id}),'PLAN_IMPORT_DRAFT_UNAVAILABLE',404);assert.deepEqual({get:h.calls.get,put:h.calls.put,analyzer:h.calls.analyzer},beforeIo);assertNoBusinessEffects(h);
});

test('authorization is checked again after original blob read, including role and channel revocation',async()=>{
 for(const revoke of [h=>h.setRole('SITE_MANAGER'),h=>h.setChannelProof({channel:'WHATSAPP',synthetic:true})]){
  const h=budgetStoreHarness(),{result}=await uploaded(h),before=h.state(),gets=h.calls.get;h.setAfterGet(()=>revoke(h));
  await assert.rejects(h.imports.source(session,{...context,draftId:result.draft.id}),{code:'PLAN_IMPORT_PERMISSION_REQUIRED',status:403});assert.equal(h.calls.get,gets+1);assert.deepEqual(h.state(),before);assertNoBusinessEffects(h);
 }
});

test('revocation after private upload stops analysis and preserves only its recoverable reservation',async()=>{
 const h=budgetStoreHarness(),source=budgetSourceFile(),input=budgetUploadInput(source);h.setAfterPut(()=>h.setRole('SITE_MANAGER'));
 await assert.rejects(h.imports.attach(session,input),{code:'PLAN_IMPORT_PERMISSION_REQUIRED',status:403});assert.equal(h.calls.analyzer,0);assert.equal(h.state().logs.size,1);const reserved=[...h.state().logs.values()][0];assert.equal(reserved.metadata.status,'UPLOADING');assert.equal(reserved.metadata.sourceConfirmed,false);assert.equal(reserved.metadata.analysis,undefined);assertNoBusinessEffects(h);
 h.setRole('ADMIN');h.setAfterPut(null);const recovery=await h.imports.read(session,{...context,operationId:input.operationId});assert.equal(recovery.draft.id,reserved.id);assert.equal(recovery.draft.budgetDescriptor,null);assert.equal(Object.hasOwn(recovery.draft,'budgetSource'),false);assert.equal((await h.imports.attach(session,input)).replayed,true);assert.equal(h.calls.analyzer,0);assert.equal(h.calls.put,1);
});

test('original source hash mismatch fails download without changing budget draft or silently repairing bytes',async()=>{
 const h=budgetStoreHarness(),{result}=await uploaded(h),path=h.state().logs.get(result.draft.id).metadata.source.pathname;
 h.mutateBlob(path,item=>{item.bytes[10]^=1;});await rejectedWithoutWrites(h,()=>h.imports.source(session,{...context,draftId:result.draft.id}),'PLAN_IMPORT_SOURCE_INTEGRITY',503);assert.equal(h.calls.put,1);assert.equal(h.calls.analyzer,1);assertNoBusinessEffects(h);
});

test('budget bytes remain private when a lower role switches to a historical physical import consent for the same file',async()=>{
 const h=budgetStoreHarness(),source=budgetSourceFile(),old=await h.imports.attach(session,budgetUploadInput(source,{consent:PLAN_IMPORT_CYP_CONSENT}));assert.equal(old.draft.budgetImport,undefined);assert.equal(Object.hasOwn(old.draft,'budgetSource'),false);
 const {result}=await uploaded(h,source),taskReads=h.calls.taskReads,beforeIo={get:h.calls.get,put:h.calls.put,analyzer:h.calls.analyzer};h.setRole('SITE_MANAGER');
 await rejectedWithoutWrites(h,()=>h.imports.attach(session,budgetUploadInput(source,{consent:PLAN_IMPORT_CYP_CONSENT})),'PLAN_IMPORT_PERMISSION_REQUIRED',403);
 await rejectedWithoutWrites(h,()=>details(h,old.draft),'PLAN_IMPORT_PERMISSION_REQUIRED',403);
 assert.deepEqual((await h.imports.read(session,context)).drafts,[]);assert.equal(h.calls.taskReads,taskReads);assert.equal(h.calls.taskWrites,0);assert.deepEqual({get:h.calls.get,put:h.calls.put,analyzer:h.calls.analyzer},beforeIo);
 h.setRole('ADMIN');assertDescriptor((await details(h,result.draft)).draft,source);assert.equal((await details(h,old.draft)).draft.budgetSource,undefined);
});

// Bounded historical sensitivity records only: no analyzed curve DTO or financial approval is fabricated.
function sensitivityRecord(source,{id='synthetic-prior-curve',organizationId='budget-org',projectId=context.projectId,sha256=source.sha256,budget=false}={}){
 return {id,organizationId,actorId:'budget-actor',projectId,action:'plan.import.draft',metadata:{version:1,projectId,syntheticSourceSensitivityFixture:true,source:{contentType:source.contentType,bytes:source.bytes.length,sha256},consent:{version:budget?PLAN_BUDGET_SOURCE_CONSENT:PLAN_IMPORT_CYP_CURVE_CONSENT},...(budget?{sourcePurpose:PLAN_BUDGET_SOURCE_PURPOSE}:{analysis:{spreadsheet:{version:4}}})}};
}
test('authorized channel roles find a later same SHA budget after an earlier financial curve with exact tenant project and hash filtering',async()=>{
 for(const role of ['ADMIN','DIRECTOR']){
  const h=budgetStoreHarness(),source=budgetSourceFile();h.setRole(role);
  h.addLog(sensitivityRecord(source));
  h.addLog(sensitivityRecord(source,{id:'synthetic-foreign-tenant-budget',organizationId:'foreign-org',budget:true}));
  h.addLog(sensitivityRecord(source,{id:'synthetic-foreign-project-budget',projectId:'foreign-project',budget:true}));
  h.addLog(sensitivityRecord(source,{id:'synthetic-other-hash-budget',sha256:source.sha256==='f'.repeat(64)?'e'.repeat(64):'f'.repeat(64),budget:true}));
  const {result}=await uploaded(h,source);assert.equal([...h.state().logs.keys()][0],'synthetic-prior-curve');h.setChannelProof({channel:'WHATSAPP',synthetic:true});
  const beforeIo={get:h.calls.get,put:h.calls.put,analyzer:h.calls.analyzer,storageConfiguration:h.calls.storageConfiguration},taskReads=h.calls.taskReads;
  await rejectedWithoutWrites(h,()=>h.imports.attach(session,budgetUploadInput(source,{consent:PLAN_IMPORT_CYP_CONSENT})),'PLAN_IMPORT_PERMISSION_REQUIRED',403);
  assert.deepEqual(h.calls.sensitivityReads.at(-1),{budgetOnly:true,organizationId:'budget-org',projectId:context.projectId,sourceSha256:source.sha256,rowIds:[result.draft.id]});
  assert.deepEqual({get:h.calls.get,put:h.calls.put,analyzer:h.calls.analyzer,storageConfiguration:h.calls.storageConfiguration},beforeIo);assert.equal(h.calls.taskReads,taskReads);assertNoBusinessEffects(h);
  const query=h.calls.sql.findLast(sql=>sql.startsWith('SELECT f.id,f.metadata FROM public."AuditLog" f ')),values=['budget-org',context.projectId,source.sha256];assert.ok(query.includes("f.\"organizationId\"=$1")&&query.includes("f.\"entityId\"=$2")&&query.includes("f.metadata->'source'->>'sha256'=$3")&&query.endsWith(' LIMIT 1'));
  const noBudget=budgetStoreHarness();noBudget.setRole(role);noBudget.setChannelProof({channel:'WHATSAPP',synthetic:true});noBudget.addLog(sensitivityRecord(source));
  const empty=await noBudget.workspace.projectOperation(session,context,false,client=>client.query(query,values));assert.deepEqual(empty.rows,[]);assert.deepEqual(noBudget.calls.sensitivityReads.at(-1).rowIds,[]);
  const altered=query.replace("f.metadata->'analysis'->'budgetSource' IS NOT NULL","f.metadata->'analysis'->'otherSource' IS NOT NULL");assert.notEqual(altered,query);await assert.rejects(noBudget.workspace.projectOperation(session,context,false,client=>client.query(altered,values)),/Unexpected synthetic source-sensitivity predicate/);
  assert.equal(noBudget.calls.get+noBudget.calls.put+noBudget.calls.analyzer+noBudget.calls.storageConfiguration+noBudget.calls.taskReads+noBudget.calls.taskWrites,0);assertNoBusinessEffects(noBudget);
 }
});
test('ordinary, document and investment decision routes cannot mutate or apply a budget source',async()=>{
 const h=budgetStoreHarness(),{result}=await uploaded(h),draft=result.draft;
 const attempts=['EDIT','APPLY','REJECT'].map(action=>command(draft,action));
 for(const action of ['REVIEW_CURVE','APPLY_CURVE'])attempts.push(command(draft,action,{rows:null,curve:action==='REVIEW_CURVE'?documentCurveFixture({sourceSha256:draft.source.sha256}):null}));
 for(const action of ['REVIEW_INVESTMENT','APPLY_INVESTMENT','REJECT_INVESTMENT']){const {rows,...body}=command(draft,action);attempts.push({...body,acknowledgeDifference:false});}
 for(const body of attempts)await rejectedWithoutWrites(h,()=>h.imports.decide(session,body),'PLAN_IMPORT_BUDGET_READ_ONLY',409);
 assertNoBusinessEffects(h);assert.equal((await details(h,draft)).draft.decision,null);
});

test('typed invalid rows do not let budget drafts produce a schedule rejection receipt or edited rows',async()=>{
 const h=budgetStoreHarness(),{result}=await uploaded(h);
 await rejectedWithoutWrites(h,()=>h.imports.decide(session,command(result.draft,'EDIT',{rows:[]})),'PLAN_IMPORT_BUDGET_READ_ONLY',409);assertNoBusinessEffects(h);
});

test('reusing an upload UUID with a different source or consent conflicts without IO or reanalysis',async()=>{
 const h=budgetStoreHarness(),{input}=await uploaded(h),beforeIo={get:h.calls.get,put:h.calls.put,analyzer:h.calls.analyzer};
 await rejectedWithoutWrites(h,()=>h.imports.attach(session,{...input,source:budgetSourceFile({quantity:'88.5000'})}),'PLAN_IMPORT_OPERATION_CONFLICT');
 await rejectedWithoutWrites(h,()=>h.imports.attach(session,{...input,consent:PLAN_IMPORT_CYP_CONSENT}),'PLAN_IMPORT_OPERATION_CONFLICT');
 assert.deepEqual({get:h.calls.get,put:h.calls.put,analyzer:h.calls.analyzer},beforeIo);assertNoBusinessEffects(h);
});

test('list projects out corrupted full budget evidence and exposes only its informational descriptor; exact draft validates the full source',async()=>{
 for(const mutate of [m=>{m.analysis.budgetSource.sourceDigest='0'.repeat(64);},m=>{m.analysis.budgetSource.measurementSourceDigest='0'.repeat(64);},m=>{m.analysis.budgetSource.currency.code='ARS';},m=>{m.analysis.budgetSource.rows[0].automaticUseAllowed=true;},m=>{m.analysis.budgetSource={poison:'Invalid full source must never be read or transmitted by listing'};}]){
  const h=budgetStoreHarness(),source=budgetSourceFile(),{result}=await uploaded(h,source),originalDescriptor=structuredClone(result.draft.budgetDescriptor);h.mutateDraft(result.draft.id,mutate);
  const before=h.state(),listing=await h.imports.read(session,context);assert.equal(listing.canApprove,true);assert.equal(listing.drafts.length,1);assertDescriptorOnly(listing.drafts[0],source);assert.deepEqual(listing.drafts[0].budgetDescriptor,originalDescriptor);assert.deepEqual(h.state(),before);
  assert.ok(h.calls.sql.some(sql=>/CASE WHEN/.test(sql)&&sql.includes("metadata #- '{analysis,budgetSource}'")&&sql.includes('ELSE metadata END AS metadata')));assert.deepEqual(h.calls.budgetProjections.at(-1),{id:result.draft.id,budget:true,removed:true,sourceReturned:false});
  await rejectedWithoutWrites(h,()=>details(h,result.draft),'PLAN_IMPORT_RECEIPT_INTEGRITY',503);assertNoBusinessEffects(h);
 }
});

test('corrupted small descriptor digest, identity or shape rejects both projected list and exact source reads',async()=>{
 for(const mutate of [m=>{m.analysis.budgetDigest='0'.repeat(64);},m=>{m.source.sha256='0'.repeat(64);},m=>{m.analysis.budgetDescriptor.sourceDigest='0'.repeat(64);},m=>{m.analysis.budgetDescriptor.projectId='foreign-project';},m=>{m.analysis.budgetDescriptor.sourceSha256='0'.repeat(64);},m=>{m.analysis.budgetDescriptor.rowCount=201;},m=>{m.analysis.budgetDescriptor.measurementSourceDigest='invalid-hash';},m=>{m.analysis.budgetDescriptor.currency.code='ARS';},m=>{m.analysis.budgetDescriptor.extra=true;}]){
  const h=budgetStoreHarness(),{result}=await uploaded(h);h.mutateDraft(result.draft.id,mutate);
  for(const run of [()=>h.imports.read(session,context),()=>details(h,result.draft)])await rejectedWithoutWrites(h,run,'PLAN_IMPORT_RECEIPT_INTEGRITY',503);assertNoBusinessEffects(h);
 }
});

test('list is bounded to twenty descriptors and does not return full budget proofs twenty times',async()=>{
 const h=budgetStoreHarness(),source=budgetSourceFile(),{result}=await uploaded(h),saved=h.state().logs.get(result.draft.id);
 for(let index=1;index<=21;index++){const row=structuredClone(saved);row.id='plan_draft_'+index.toString(16).padStart(64,'0');row.metadata.createdAt=new Date(Date.UTC(2026,9,18,0,0,index)).toISOString();h.addLog(row);}
 const listing=await h.imports.read(session,context);assert.equal(listing.drafts.length,20);assert.equal(listing.truncated,true);for(const draft of listing.drafts)assertDescriptorOnly(draft,source);assert.ok(Buffer.byteLength(JSON.stringify(listing))<64*1024);assert.equal(h.calls.analyzer,1);assert.equal(h.calls.budgetProjections.length,21);assert.ok(h.calls.budgetProjections.every(row=>row.budget&&row.removed&&!row.sourceReturned));assert.ok(h.calls.sql.some(sql=>/CASE WHEN/.test(sql)&&sql.includes("metadata #- '{analysis,budgetSource}'")&&sql.includes('ELSE metadata END AS metadata')));assertNoBusinessEffects(h);
});

test('old physical drafts retain their existing contract and exact reads never backfill a budget source',async()=>{
 const h=budgetStoreHarness(),source=budgetSourceFile(),result=await h.imports.attach(session,budgetUploadInput(source,{consent:PLAN_IMPORT_CYP_CONSENT})),before=h.state(),analysis=h.calls.analyzer,io={get:h.calls.get,put:h.calls.put};
 const full=(await details(h,result.draft)).draft;assert.equal(full.budgetImport,undefined);assert.equal(full.budgetDescriptor,undefined);assert.equal(full.budgetSource,undefined);assert.equal(full.spreadsheet.profile,'CYP_PARTIDAS');assert.equal(full.rows.length,2);const listing=await h.imports.read(session,context);assert.deepEqual(listing.drafts[0].spreadsheet,full.spreadsheet);assert.deepEqual(listing.drafts[0].rows,full.rows);assert.deepEqual(h.calls.budgetProjections.at(-1),{id:full.id,budget:false,removed:false,sourceReturned:false});assert.deepEqual(h.state(),before);assert.equal(h.calls.analyzer,analysis);assert.deepEqual({get:h.calls.get,put:h.calls.put},io);assert.equal(h.calls.provider,0);assert.equal(h.calls.taskWrites,0);
});
