import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {normalizePlanMeasurementDestinations,planMeasurementCommandDigest} from '../src/lib/plan-measurement-policy.mjs';
import {assertImportedMeasurementConfiguration} from '../src/lib/plan-measurement-configuration.mjs';
import {TASK_MEASUREMENT_VERSION} from '../src/lib/task-progress-measurement.js';
import {planMeasurementCommandDigest as browserDigest} from '../src/app/(identity)/cuenta/workspace-recovery-journal.mjs';
import {documentMeasurementHarness,documentMeasurementContext as context,documentMeasurementSession as session,documentMeasurementCommand as command,documentMeasurementReview as review} from './fixtures/plan-measurement-document-association-synthetic.mjs';

const clone=value=>structuredClone(value);
const setup=options=>{const h=documentMeasurementHarness(),draft=h.addDocument(options),task=h.addTask();return {h,draft,task,input:review(draft,task)};};
const sourceContext=draft=>({source:draft.measurementSource,sourceDigest:draft.sourceDigest});
async function noEffects(h,run,code){const before=h.state();let result;try{result=await run();}catch(error){if(code)assert.equal(error.code,code);assert.deepEqual(h.state(),before);return;}assert.equal(result.state,'REJECTED');if(code)assert.equal(result.code,code);assert.equal(result.phase,'PRE_DECISION');assert.equal(result.taskEffects,false);assert.equal(result.draftEffects,false);assert.equal(result.proposalEffects,false);const after=h.state();assert.deepEqual(after.tasks,before.tasks);const added=[...after.logs.keys()].filter(id=>!before.logs.has(id));assert.deepEqual(added,[result.receiptId]);after.logs.delete(result.receiptId);assert.deepEqual(after.logs,before.logs);}

test('PDF and image rows without codes require explicit document association and preserve the existing Task on REVIEW APPLY and replay',async()=>{
 for(const contentType of ['application/pdf','image/png']){const {h,draft,task,input}=setup({contentType});assert.equal(draft.measurementSource.format,'DOCUMENT');assert.equal(draft.measurementSource.rows[0].code,null);
  const reviewed=await h.measurements.decide(session,input);assert.equal(reviewed.taskEffects,false);assert.deepEqual(h.state().tasks.get(task.id),task);assert.deepEqual(reviewed.draft.review.destinations,input.destinations);
  const apply=command(reviewed.draft,'APPLY_MEASUREMENT'),saved=await h.measurements.decide(session,apply),current=h.state().tasks.get(task.id),trail=current.metadata.planMeasurementSource;
  assert.equal(saved.taskSnapshots.length,1);assert.equal(saved.taskSnapshots[0].created,false);assert.equal(h.state().tasks.size,1);assert.equal(current.title,task.title);assert.equal(current.startsOn,task.startsOn);assert.equal(current.endsOn,task.endsOn);assert.equal(current.status,task.status);assert.equal(current.progress,0);assert.equal(current.metadata.preserved,true);assert.equal(current.metadata.fieldOperations.measurement.baseline,'12.5000');assert.equal(trail.version,2);assert.equal(trail.sourceCode,null);assert.equal(trail.association,'EXISTING');assert.deepEqual(trail.documentAssociation,input.destinations[0].documentAssociation);
  const before=h.state(),again=await h.measurements.decide(session,apply);assert.equal(again.replayed,true);assert.equal(again.receiptId,saved.receiptId);assert.deepEqual(h.state(),before);assert.equal((await h.measurements.read(session,{...context,operationId:apply.operationId})).receiptId,saved.receiptId);assert.equal(h.calls.provider,0);assert.equal(h.calls.blob,0);
 }
});
test('coded EXISTING retains its exact historical nine-key contract including documentary coded rows',()=>{
 const {draft,task}=setup(),row={sourceRowId:'document:1',code:'A.1'},destination={sourceRowId:row.sourceRowId,mode:'EXISTING',taskId:task.id,revision:task.revision,sourceCode:row.code,confirmIdentity:true,replacement:'CONFIGURE',expectedDefinitionId:null,confirmReplacement:false};
 assert.equal(Object.keys(destination).length,9);assert.deepEqual(normalizePlanMeasurementDestinations([row],[destination]),[destination]);assert.throws(()=>normalizePlanMeasurementDestinations([row],[{...destination,sourceCode:null}]),{code:'PLAN_MEASUREMENT_SOURCE_IDENTITY_REQUIRED'});assert.throws(()=>normalizePlanMeasurementDestinations([row],[{...destination,documentAssociation:review(draft,task).destinations[0].documentAssociation}],sourceContext(draft)),{code:'PLAN_MEASUREMENT_SOURCE_IDENTITY_REQUIRED'});
});
test('the manual path never promotes Excel null missing or empty codes nor trusts review rows instead of the original source',()=>{
 const {draft,input}=setup(),destination=input.destinations[0],rows=input.rows.map(row=>({...row,code:null}));
 for(const edit of [source=>{source.format='EXCEL';},source=>{source.rows[0].code='A.1';},source=>{source.rows=[];},source=>{source.rows[0].code=undefined;},source=>{source.rows[0].code='';}]){const source=clone(draft.measurementSource);edit(source);assert.throws(()=>normalizePlanMeasurementDestinations(rows,[destination],{source,sourceDigest:draft.sourceDigest}),{code:'PLAN_MEASUREMENT_SOURCE_IDENTITY_REQUIRED'});}
 for(const code of [undefined,'','A.1'])assert.throws(()=>normalizePlanMeasurementDestinations([{sourceRowId:rows[0].sourceRowId,code}],[destination],sourceContext(draft)),{code:'PLAN_MEASUREMENT_SOURCE_IDENTITY_REQUIRED'});
 assert.throws(()=>normalizePlanMeasurementDestinations(rows,[destination]),{code:'PLAN_MEASUREMENT_SOURCE_IDENTITY_REQUIRED'});
 const oldShape={...destination};delete oldShape.documentAssociation;assert.throws(()=>normalizePlanMeasurementDestinations(rows,[oldShape],sourceContext(draft)),{code:'PLAN_MEASUREMENT_SOURCE_IDENTITY_REQUIRED'});
});
test('every document proof field is exact and independently bound before a review can change any draft or Task',async()=>{
 for(const patch of [{version:2},{mode:'TITLE_MATCH'},{sourceSha256:'b'.repeat(64)},{sourceDigest:'b'.repeat(64)},{sourceRowId:'document:2'},{taskId:'other-task'},{taskRevision:'2026-10-14T13:00:00.000000'},{confirmed:false},{extra:true}]){const {h,input}=setup();input.destinations[0].documentAssociation={...input.destinations[0].documentAssociation,...patch};await noEffects(h,()=>h.measurements.decide(session,input),'PLAN_MEASUREMENT_SOURCE_IDENTITY_REQUIRED');}
 for(const edit of [d=>{delete d.documentAssociation.confirmed;},d=>{d.documentAssociation=null;},d=>{d.extra=true;},d=>{d.confirmIdentity=false;},d=>{d.sourceCode='invented-code';}]){const {h,input}=setup();edit(input.destinations[0]);await noEffects(h,()=>h.measurements.decide(session,input));}
});
test('document source hash digest and row cannot cross drafts even with equal null code and title',async()=>{
 const {h,draft,task,input}=setup(),other=h.addDocument({label:'another-private-source'}),foreign=review(other,task);input.destinations[0].documentAssociation=foreign.destinations[0].documentAssociation;await noEffects(h,()=>h.measurements.decide(session,input),'PLAN_MEASUREMENT_SOURCE_IDENTITY_REQUIRED');
 const changed=review(draft,task);changed.sourceDigest=other.sourceDigest;await noEffects(h,()=>h.measurements.decide(session,changed),'PLAN_MEASUREMENT_SOURCE_CHANGED');
});
test('normalization copies the explicit proof and canonical browser fingerprint binds all of it',async()=>{
 const {draft,input}=setup(),rows=input.rows.map(row=>({...row,code:null})),normalized=normalizePlanMeasurementDestinations(rows,input.destinations,sourceContext(draft)),before=clone(normalized);input.destinations[0].documentAssociation.confirmed=false;assert.deepEqual(normalized,before);input.destinations[0].documentAssociation.confirmed=true;assert.equal(await browserDigest(input),planMeasurementCommandDigest(input));const changed=clone(input);changed.destinations[0].documentAssociation.taskRevision='2026-10-14T13:00:00.000000';assert.notEqual(planMeasurementCommandDigest(changed),planMeasurementCommandDigest(input));
});
test('Task revision CAS is checked during REVIEW and again during APPLY including the explicit proof revision',async()=>{
 const {h,task,input}=setup();h.mutateTask(task.id,row=>{row.revision='2026-10-14T13:00:00.000000';});await noEffects(h,()=>h.measurements.decide(session,input),'FIELD_REVISION_CHANGED');
 const fresh=h.state().tasks.get(task.id),draft=(await h.measurements.read(session,{...context,draftId:input.draftId})).draft,newInput=review(draft,fresh),reviewed=(await h.measurements.decide(session,newInput)).draft;h.mutateTask(task.id,row=>{row.revision='2026-10-14T14:00:00.000000';});await noEffects(h,()=>h.measurements.decide(session,command(reviewed,'APPLY_MEASUREMENT')),'FIELD_REVISION_CHANGED');
});
test('a selected Task from another project is unavailable even when its id and revision are explicit',async()=>{
 const {h,draft}=setup(),other=h.addTask({id:'other-project-task',projectId:'another-project'});await noEffects(h,()=>h.measurements.decide(session,review(draft,other)),'WORKSPACE_TASK_UNAVAILABLE');
});
test('scope session and current role still protect documentary association without any provider or private download',async()=>{
 for(const role of ['SITE_MANAGER','WORKER']){const {h,input}=setup();h.setRole(role);await noEffects(h,()=>h.measurements.decide(session,input),'PLAN_MEASUREMENT_PERMISSION_REQUIRED');}
 const {h,input}=setup();await noEffects(h,()=>h.measurements.decide(session,{...input,scope:'b'.repeat(64)}),'WORKSPACE_CONTEXT_CHANGED');await noEffects(h,()=>h.measurements.decide({...session,userId:'another-user'},input),'WORKSPACE_CONTEXT_CHANGED');assert.equal(h.calls.provider,0);assert.equal(h.calls.blob,0);
});
test('pending progress and sealed approved quantities including zero still forbid documentary reassociation',async()=>{
 const {h,input}=setup();h.setPending(true);await noEffects(h,()=>h.measurements.decide(session,input),'FIELD_PROGRESS_REVIEW_PENDING');
 for(const executed of ['0.0000','1.0000']){const f=setup();f.h.mutateTask(f.task.id,row=>{row.progress=executed==='0.0000'?0:8;row.metadata.fieldOperations={version:1,quantity:{executed,baseline:'12.5000',unit:'M2'},approvedProposalId:'approved-synthetic',approvedAt:'2026-10-14T12:00:00.000Z'};});await noEffects(f.h,()=>f.h.measurements.decide(session,f.input),'TASK_MEASUREMENT_BASELINE_LOCKED');}
});
test('unsealed replacement still requires the exact definition and explicit replacement confirmation',async()=>{
 const {h,task,input}=setup();h.mutateTask(task.id,row=>{row.metadata.fieldOperations={version:1,measurement:{version:TASK_MEASUREMENT_VERSION,definitionId:'manual-definition',baseline:'10.0000',unit:'M2',sourceReference:'Cómputo sintético revisado',configuredBy:'document-association-actor',configuredAt:'2026-10-14T12:00:00.000Z'}};});
 await noEffects(h,()=>h.measurements.decide(session,input),'PLAN_MEASUREMENT_REPLACEMENT_REQUIRED');const next={...input,operationId:randomUUID(),destinations:[{...input.destinations[0],replacement:'REPLACE_UNSEALED',expectedDefinitionId:'manual-definition',confirmReplacement:true}]};const reviewed=await h.measurements.decide(session,next);assert.equal(reviewed.saved,true);const saved=await h.measurements.decide(session,command(reviewed.draft,'APPLY_MEASUREMENT'));assert.equal(saved.taskSnapshots[0].task.measurement.baseline,'12.5000');assert.equal(saved.taskSnapshots[0].task.progress,0);
});
test('previous null-code physical provenance is an exact source tuple and never null-equality across documents or rows',async()=>{
 const {h,task,input}=setup(),reviewed=(await h.measurements.decide(session,input)).draft;await h.measurements.decide(session,command(reviewed,'APPLY_MEASUREMENT'));const stored=h.state().tasks.get(task.id),row={...reviewed.review.rows[0]},destination={...input.destinations[0],revision:stored.revision,replacement:'REPLACE_UNSEALED',expectedDefinitionId:stored.metadata.fieldOperations.measurement.definitionId,confirmReplacement:true,documentAssociation:{...input.destinations[0].documentAssociation,taskRevision:stored.revision}};
 assert.notEqual(stored.metadata.planMeasurementSource.documentAssociation.taskRevision,stored.revision);assert.equal(assertImportedMeasurementConfiguration(stored,row,destination).baseline,'12.5000');
 for(const patch of [{sourceSha256:'b'.repeat(64)},{sourceDigest:'b'.repeat(64)},{sourceRowId:'document:2'}]){const changed=clone(destination);changed.documentAssociation={...changed.documentAssociation,...patch};assert.throws(()=>assertImportedMeasurementConfiguration(stored,row,changed),{code:'PLAN_MEASUREMENT_SOURCE_IDENTITY_CHANGED'});}
 const v1=clone(stored);v1.metadata.planMeasurementSource.version=1;delete v1.metadata.planMeasurementSource.documentAssociation;assert.equal(assertImportedMeasurementConfiguration(v1,row,destination).baseline,'12.5000');assert.throws(()=>assertImportedMeasurementConfiguration(v1,row,{...destination,documentAssociation:{...destination.documentAssociation,sourceSha256:'b'.repeat(64)}}),{code:'PLAN_MEASUREMENT_SOURCE_IDENTITY_CHANGED'});
});
test('persisted v2 provenance rejects malformed extra or crossed document proofs and cannot relabel a coded legacy Task',async()=>{
 const {h,task,input}=setup(),reviewed=(await h.measurements.decide(session,input)).draft;await h.measurements.decide(session,command(reviewed,'APPLY_MEASUREMENT'));const stored=h.state().tasks.get(task.id),row=reviewed.review.rows[0],destination={...input.destinations[0],revision:stored.revision,replacement:'REPLACE_UNSEALED',expectedDefinitionId:stored.metadata.fieldOperations.measurement.definitionId,confirmReplacement:true,documentAssociation:{...input.destinations[0].documentAssociation,taskRevision:stored.revision}};
 for(const edit of [s=>{s.documentAssociation.taskId='other-task';},s=>{s.documentAssociation.taskRevision='invalid';},s=>{s.documentAssociation.sourceDigest='b'.repeat(64);},s=>{s.documentAssociation.confirmed=false;},s=>{s.documentAssociation.extra=true;},s=>{s.sourceCode='A.1';},s=>{s.association='CREATE';}]){const changed=clone(stored);edit(changed.metadata.planMeasurementSource);assert.throws(()=>assertImportedMeasurementConfiguration(changed,row,destination),{code:'PLAN_MEASUREMENT_SOURCE_IDENTITY_CHANGED'});}
 const next=setup();next.h.mutateTask(next.task.id,value=>{value.metadata.planImport={version:1,profile:'CYP_PARTIDAS',code:'A.1'};});await noEffects(next.h,()=>next.h.measurements.decide(session,next.input),'PLAN_MEASUREMENT_SOURCE_IDENTITY_CHANGED');
});
test('APPLY revalidates review receipt and original normalized source instead of trusting a changed proof or source',async()=>{
 for(const tamper of ['proof','source']){const {h,input}=setup(),reviewed=(await h.measurements.decide(session,input)).draft;h.mutateDraft(reviewed.id,m=>{if(tamper==='proof')m.measurementReview.destinations[0].documentAssociation.sourceSha256='b'.repeat(64);else m.analysis.measurementSource.sourceSha256='b'.repeat(64);});await noEffects(h,()=>h.measurements.decide(session,command(reviewed,'APPLY_MEASUREMENT')));}
});
test('durable receipt failure rolls back Task provenance and draft together and exact replay never duplicates application',async()=>{
 const {h,input}=setup(),reviewed=(await h.measurements.decide(session,input)).draft,apply=command(reviewed,'APPLY_MEASUREMENT');h.setFailReceipt(true);await noEffects(h,()=>h.measurements.decide(session,apply));h.setFailReceipt(false);const saved=await h.measurements.decide(session,apply),before=h.state();await noEffects(h,()=>h.measurements.decide(session,{...input,destinations:[{...input.destinations[0],documentAssociation:{...input.destinations[0].documentAssociation,taskId:'other-task'}}]}),'WORKSPACE_OPERATION_CONFLICT');assert.deepEqual(h.state(),before);assert.equal((await h.measurements.decide(session,apply)).receiptId,saved.receiptId);assert.deepEqual(h.state(),before);
});
test('CREATE keeps its historical payload and v1 trail without adding documentary association authority',async()=>{
 const {h,input}=setup();input.destinations=[{sourceRowId:input.rows[0].sourceRowId,mode:'CREATE',title:'Nueva tarea documental sintética',startsOn:'2026-11-01',endsOn:'2026-11-02'}];const reviewed=(await h.measurements.decide(session,input)).draft,saved=await h.measurements.decide(session,command(reviewed,'APPLY_MEASUREMENT')),created=h.state().tasks.get(saved.taskSnapshots[0].task.id);assert.equal(saved.taskSnapshots[0].created,true);assert.equal(created.metadata.planMeasurementSource.version,1);assert.equal(Object.hasOwn(created.metadata.planMeasurementSource,'documentAssociation'),false);assert.equal(created.progress,0);
});
