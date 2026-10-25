import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fieldExecutionFixture} from './helpers/field-execution-fixture.mjs';
import {createFieldHandlers} from '../src/lib/field-operations-http.mjs';

test('canonical field save issues an explicit mandate then debits exact per-line OUT with the real reporter and immutable issuer provenance',async()=>{
 const f=fieldExecutionFixture(),issued=await f.issue(),result=await f.report(issued.mandate.id);
 assert.equal(result.state,'RECORDED');assert.equal(result.stockChanged,true);assert.equal(result.taskUpdated,false);assert.equal(result.execution.authorizedBy,'owner');assert.equal(result.execution.executedBy,'worker');assert.equal(result.execution.movements.length,2);
 assert.equal(f.state.project.metadata.materialInventory.materials[0].balance,'8.000');assert.equal(f.state.task.progress,0);assert.equal(f.state.task.status,'BLOCKED');assert.deepEqual(f.state.project.metadata.preserve,{nested:true});
 assert.deepEqual(f.movements().map(row=>[row.actorId,row.metadata.direction,row.metadata.quantity,row.metadata.balanceBefore,row.metadata.balanceAfter]),[['worker','OUT','1.001','10.000','8.999'],['worker','OUT','0.999','8.999','8.000']]);
 const mandate=await f.operations.executionMandate(f.session('worker'),{projectId:'p-a',scope:f.scope,executionMandateId:issued.mandate.id});assert.equal(mandate.mandate.materials[0].used,'2.000');assert.equal(mandate.mandate.revision,1);assert.equal(f.receipts().length,2);
});

test('serialized canonical transaction model deduplicates one report across concurrent operation UUIDs and channels, conflicts on changed facts',async()=>{
 const f=fieldExecutionFixture(),m=(await f.issue()).mandate.id,body=f.command('REPORT_EXECUTION',f.reportPayload(m));
 const results=await Promise.all([f.operations.save(f.session('worker'),body),f.operations.save({...f.session('worker'),channel:true},{...body,operationId:randomUUID()})]);
 assert.equal(results.filter(row=>row.effectsApplied).length,1);assert.equal(results.filter(row=>row.executionReplay).length,1);assert.equal(f.movements().length,2);assert.equal(f.state.project.metadata.materialInventory.materials[0].balance,'8.000');
 assert.equal((await f.operations.save(f.session('worker'),body)).replayed,true);
 const before=f.snapshot();await assert.rejects(f.operations.save(f.session('worker'),{...body,operationId:randomUUID(),payload:{...body.payload,reason:'Hecho distinto con la misma identidad de reporte.'}}),{code:'FIELD_EXECUTION_REPORT_CONFLICT'});assert.deepEqual(f.snapshot(),before);
});

test('each failure after stock, movements, task, quota, execution or field receipt rolls back every modeled transaction effect',async()=>{
 for(const failure of ["'material.inventory.moved'",'INSERT INTO public."OperationalProposal"','UPDATE public."Task"','UPDATE public."AuditLog"',"'field.execution.applied'","'field.operation.recorded'"]){
  const f=fieldExecutionFixture({measured:true}),m=(await f.issue()).mandate.id,before=f.snapshot();f.controls.fail=failure;
  await assert.rejects(f.report(m,{progress:{definitionId:'measurement-a',baseline:'10',unit:'M2',mode:'DELTA',quantity:'2.5001'},evidenceIds:['e-a']}),/SYNTHETIC_WRITE_FAILURE/);assert.deepEqual(f.snapshot(),before,failure);
 }
});

test('exact allowances aggregate repeated material lines and competing reports cannot overspend stock or mandate quota',async()=>{
 const f=fieldExecutionFixture({balance:'3.000'}),m=(await f.issue()).mandate.id,reports=await Promise.allSettled([f.report(m),f.report(m)]);assert.equal(reports.filter(row=>row.status==='fulfilled').length,1);assert.equal(reports.find(row=>row.status==='rejected').reason.code,'INVENTORY_STOCK_INSUFFICIENT');assert.equal(f.state.project.metadata.materialInventory.materials[0].balance,'1.000');assert.equal(f.movements().length,2);
 const g=fieldExecutionFixture(),n=(await g.issue('owner',{materials:[{materialId:'material-a',unit:'bolsa',limit:'3',maxPerReport:'3'}]})).mandate.id;await g.report(n);const before=g.snapshot();await assert.rejects(g.report(n),{code:'FIELD_EXECUTION_ALLOWANCE_EXCEEDED'});assert.deepEqual(g.snapshot(),before);
 const h=fieldExecutionFixture(),maximum='99999999999.999',p=(await h.issue('owner',{materials:[{materialId:'material-a',unit:'bolsa',limit:maximum,maxPerReport:maximum}]})).mandate.id,snapshot=h.snapshot();await assert.rejects(h.report(p,{lines:[{lineId:'line-a',materialId:'material-a',unit:'bolsa',quantity:maximum},{lineId:'line-b',materialId:'material-a',unit:'bolsa',quantity:maximum}]}),{code:'FIELD_EXECUTION_ALLOWANCE_EXCEEDED'});assert.deepEqual(h.snapshot(),snapshot);
});

test('revoked and expired mandates stop new facts, while an already committed fact remains recoverable without another debit',async()=>{
 const f=fieldExecutionFixture(),m=(await f.issue()).mandate.id,body=f.command('REPORT_EXECUTION',f.reportPayload(m));await f.operations.save(f.session('worker'),body);
 await f.operations.save(f.session('director'),f.command('REVOKE_EXECUTION_MANDATE',{mandateId:m,revision:1,reason:'Revocación preventiva del mandato sintético.'}));const before=f.snapshot();await assert.rejects(f.report(m),{code:'FIELD_EXECUTION_MANDATE_REVOKED'});assert.deepEqual(f.snapshot(),before);
 const replay=await f.operations.save(f.session('worker'),{...body,operationId:randomUUID()});assert.equal(replay.effectsApplied,false);assert.equal(f.movements().length,2);
 const g=fieldExecutionFixture(),n=(await g.issue()).mandate.id;g.state.now='2026-10-26T12:00:00.000Z';const snapshot=g.snapshot();await assert.rejects(g.report(n),{code:'FIELD_EXECUTION_MANDATE_EXPIRED'});assert.deepEqual(g.snapshot(),snapshot);
});

test('fresh database time after effects and the final field receipt rejects a mandate crossing expiry and rolls back',async()=>{
 const f=fieldExecutionFixture(),m=(await f.issue()).mandate.id,before=f.snapshot();f.controls.afterWrite=(sql,state)=>{if(sql.includes("'field.operation.recorded'"))state.now='2026-10-26T12:00:00.000Z';};await assert.rejects(f.report(m),{code:'FIELD_EXECUTION_MANDATE_EXPIRED'});assert.deepEqual(f.snapshot(),before);
});

test('current issuer authority, participant-origin admission and reporter KYC are rechecked before execution',async()=>{
 for(const edit of [f=>f.state.issuerActive=false,f=>{f.state.issuerBound=true;f.state.issuerAssigned=false;},f=>{f.state.issuerBound=true;f.state.issuerWorker=false;}]){const f=fieldExecutionFixture(),m=(await f.issue('director')).mandate.id;edit(f);const before=f.snapshot();await assert.rejects(f.report(m),{code:'FIELD_EXECUTION_ISSUER_UNAVAILABLE'});assert.deepEqual(f.snapshot(),before);}
 for(const edit of [f=>f.state.reviewPresent=false,f=>f.state.submissionPresent=false,f=>f.state.worker.metadata.participant.kyc.status='PENDING']){const f=fieldExecutionFixture(),m=(await f.issue()).mandate.id;edit(f);const before=f.snapshot();await assert.rejects(f.report(m),{code:'FIELD_KYC_REVIEW_REQUIRED'});assert.deepEqual(f.snapshot(),before);}
});

test('worker ownership, mandate scope, task revision and catalog units cannot be supplied by a reporting actor',async()=>{
 const f=fieldExecutionFixture(),m=(await f.issue()).mandate.id;
 for(const patch of [{taskRevision:'2026-10-24T12:00:00.123457'},{sectorId:'other-sector'},{catalogHash:'b'.repeat(64)},{lines:[{lineId:'line-a',materialId:'material-a',quantity:'1',unit:'kg'}]}]){const before=f.snapshot();await assert.rejects(f.report(m,patch));assert.deepEqual(f.snapshot(),before);}
 const body=f.command('REPORT_EXECUTION',f.reportPayload(m)),before=f.snapshot();await assert.rejects(f.operations.save(f.session('owner'),body),{code:'FIELD_PARTICIPANT_REQUIRED'});assert.deepEqual(f.snapshot(),before);
 await assert.rejects(f.operations.save(f.session('worker'),f.command('ISSUE_EXECUTION_MANDATE',f.issuePayload())),{code:'FIELD_EXECUTION_MANAGE_REQUIRED'});
 await assert.rejects(f.operations.save({...f.session('owner'),channel:true},f.command('ISSUE_EXECUTION_MANDATE',f.issuePayload())),{code:'FIELD_EXECUTION_MANAGE_REQUIRED'});
});

test('self-issued mandates and adapters omitting the pre-Project authority hook fail closed without effects',async()=>{
 const f=fieldExecutionFixture();f.state.worker.metadata.participant.clerkUserId='user_Owner';const before=f.snapshot();await assert.rejects(f.issue(),{code:'FIELD_MAKER_CHECKER_REQUIRED'});assert.deepEqual(f.snapshot(),before);
 const g=fieldExecutionFixture(),m=(await g.issue()).mandate.id,snapshot=g.snapshot();g.controls.omitBeforeProject=true;await assert.rejects(g.report(m),{code:'FIELD_EXECUTION_AUTHORITY_FENCE_REQUIRED'});assert.deepEqual(g.snapshot(),snapshot);
});

test('JSONB key order cannot change mandate authority, while altered terms and excess stored usage fail closed',async()=>{
 const f=fieldExecutionFixture(),m=(await f.issue()).mandate.id,row=f.state.audits.find(row=>row.id===m);row.metadata.request=Object.fromEntries(Object.entries(row.metadata.request).reverse());row.metadata.request.materials=row.metadata.request.materials.map(value=>Object.fromEntries(Object.entries(value).reverse()));await f.report(m);assert.equal(f.movements().length,2);
 for(const edit of [row=>row.metadata.request.materials[0].limit='9.000',row=>row.metadata.used[0].quantity='999.000']){const g=fieldExecutionFixture(),n=(await g.issue()).mandate.id;edit(g.state.audits.find(row=>row.id===n));const before=g.snapshot();await assert.rejects(g.report(n),{code:'FIELD_EXECUTION_MANDATE_INTEGRITY'});assert.deepEqual(g.snapshot(),before);}
});

test('approved configured quantities update the canonical Gantt task atomically, preserve BLOCKED and dates, and never infer progress from material',async()=>{
 const f=fieldExecutionFixture({measured:true}),m=(await f.issue()).mandate.id,progress={definitionId:'measurement-a',baseline:'10',unit:'M2',mode:'DELTA',quantity:'2.5001'};
 const result=await f.report(m,{progress,evidenceIds:['e-a']});assert.equal(result.task.progress,25);assert.equal(result.task.status,'BLOCKED');assert.equal(result.task.measurement.executed,'2.5001');assert.equal(result.task.startsOn,'2026-10-20');assert.equal(result.task.endsOn,'2026-11-20');assert.deepEqual(f.state.task.metadata.preserve,{nested:true});assert.equal(f.state.task.metadata.fieldOperations.approvedBy,'owner');assert.equal(f.state.task.metadata.fieldOperations.executionAuthorization.executedBy,'worker');assert.equal(f.state.proposals[0].status,'APPLIED');
 const status=await f.operations.status(f.session('worker'),{projectId:'p-a',scope:f.scope,operationId:result.operationId});assert.equal(status.task.measurement.executed,'2.5001');assert.equal(status.executionTaskSnapshot.measurement.executed,'2.5001');
 for(const review of [null,{decision:'REJECT'},{decision:'PENDING'}]){const g=fieldExecutionFixture({measured:true}),n=(await g.issue()).mandate.id;g.state.evidence.metadata.fieldOperations.review=review;const before=g.snapshot();await assert.rejects(g.report(n,{progress,evidenceIds:['e-a']}),{code:'FIELD_EVIDENCE_NOT_APPROVED'});assert.deepEqual(g.snapshot(),before);}
});

test('unconfirmed Task write and a lost COMMIT response keep a recoverable exactly-once receipt',async()=>{
 const f=fieldExecutionFixture({measured:true}),m=(await f.issue()).mandate.id,before=f.snapshot();f.controls.zeroTaskUpdate=true;await assert.rejects(f.report(m,{progress:{definitionId:'measurement-a',baseline:'10',unit:'M2',mode:'DELTA',quantity:'1'},evidenceIds:['e-a']}),{code:'FIELD_EXECUTION_WRITE_CONFLICT'});assert.deepEqual(f.snapshot(),before);
 const g=fieldExecutionFixture(),n=(await g.issue()).mandate.id,body=g.command('REPORT_EXECUTION',g.reportPayload(n));g.controls.loseCommit=true;await assert.rejects(g.operations.save(g.session('worker'),body),/COMMIT_ACK_LOST/);const status=await g.operations.status(g.session('worker'),{projectId:'p-a',scope:g.scope,operationId:body.operationId});assert.equal(status.state,'RECORDED');assert.equal((await g.operations.save(g.session('worker'),body)).replayed,true);assert.equal(g.movements().length,2);
});

test('the existing authenticated HTTP endpoint reaches the canonical execution store and the scoped mandate reader with strict query and origin fences',async()=>{
 const f=fieldExecutionFixture(),handlers=name=>createFieldHandlers({verify:async()=>f.session(name),operations:f.operations}),post=body=>new Request('https://obrasaas.com/api/identity/field-operations',{method:'POST',headers:{Origin:'https://obrasaas.com','Content-Type':'application/json'},body:JSON.stringify(body)});
 const issue=await handlers('owner').POST(post(f.command('ISSUE_EXECUTION_MANDATE',f.issuePayload())));assert.equal(issue.status,200);const mandate=(await issue.json()).mandate;
 const report=await handlers('worker').POST(post(f.command('REPORT_EXECUTION',f.reportPayload(mandate.id))));assert.equal(report.status,200);assert.equal((await report.json()).stockChanged,true);
 const url='https://obrasaas.com/api/identity/field-operations?'+new URLSearchParams({projectId:'p-a',scope:f.scope,executionMandateId:mandate.id}),read=await handlers('worker').GET(new Request(url));assert.equal(read.status,200);assert.match(read.headers.get('cache-control'),/no-store/);assert.equal((await read.json()).mandate.materials[0].used,'2.000');
 for(const suffix of ['&operationId='+randomUUID(),'&executionMandateId=extra','&unknown=value'])assert.equal((await handlers('worker').GET(new Request(url+suffix))).status,400);
 const before=f.snapshot(),bad=post(f.command('REPORT_EXECUTION',f.reportPayload(mandate.id)));bad.headers.set('origin','https://foreign.invalid');assert.equal((await handlers('worker').POST(bad)).status,403);assert.deepEqual(f.snapshot(),before);
});

test('the execution screen reader returns bounded current own mandates and recorded receipts from a read-only canonical snapshot',async()=>{
 const f=fieldExecutionFixture(),m=(await f.issue()).mandate.id;await f.report(m);const before=f.snapshot();
 const view=await f.operations.executionView(f.session('worker'),{projectId:'p-a',scope:f.scope});assert.equal(view.canManage,false);assert.equal(view.mandates[0].id,m);assert.equal(view.receipts.length,1);assert.equal(view.receipts[0].action,'REPORT_EXECUTION');assert.equal(view.receipts[0].scope,f.scope);assert.deepEqual(view.materials.map(row=>row.balance),['8.000','5.000']);assert.deepEqual(f.snapshot(),before);
 const manager=await f.operations.executionView(f.session('owner'),{projectId:'p-a',scope:f.scope});assert.equal(manager.canManage,true);assert.equal(manager.receipts.length,2);assert.equal(manager.workers[0].id,'w-worker');
 const h=createFieldHandlers({verify:async()=>f.session('owner'),operations:f.operations}),base='https://obrasaas.com/api/identity/field-operations?'+new URLSearchParams({projectId:'p-a',scope:f.scope,executionView:'1'});assert.equal((await h.GET(new Request(base))).status,200);for(const suffix of ['&operationId='+randomUUID(),'&executionView=1','&executionMandateId='+m])assert.equal((await h.GET(new Request(base+suffix))).status,400);
});
