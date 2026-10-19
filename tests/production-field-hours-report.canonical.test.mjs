import test from 'node:test';
import assert from 'node:assert/strict';
import {createFieldHandlers} from '../src/lib/field-operations-http.mjs';
import {scopeStamp} from '../src/lib/workspace-policy.mjs';
import {canonicalFixture,shift,ledgerReads,queryFor} from './helpers/field-hours-fixture.mjs';

for(const role of ['ADMIN','DIRECTOR'])test('canonical '+role+' reads through an admitted read-only project transaction without a private identity bypass',async()=>{
 const f=canonicalFixture({role});f.add(shift());const value=await f.read();assert.equal(value.complete,true);assert.equal(value.scope,f.context.scope);assert.equal(value.totals.closedObservedNetMs,28800000);assert.equal(ledgerReads(f),1);assert.equal(f.queries[0].sql,'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');assert.equal(f.queries.at(-1).sql,'ROLLBACK');assert.equal(f.connections(),1);assert.equal(f.released(),1);assert.ok(f.queries.every(query=>!query.sql.includes('FOR UPDATE')));
});
for(const role of ['SITE_MANAGER','FINANCE','AUDITOR'])test('canonical '+role+' cannot export a project-wide payroll preparation view even when assigned',async()=>{
 const f=canonicalFixture({role});f.add(shift());await assert.rejects(f.read(),{code:'FIELD_HOURS_PERMISSION_REQUIRED',status:403});assert.equal(ledgerReads(f),0);assert.equal(f.released(),1);
});
for(const kyc of ['NOT_SUBMITTED','PENDING_REVIEW','REJECTED'])test('participant-bound DIRECTOR with '+kyc+' cannot bypass admission to obtain hours',async()=>{
 const f=canonicalFixture({role:'DIRECTOR',linked:true,kyc});f.add(shift());await assert.rejects(f.read(),{code:'PARTICIPANT_KYC_REVIEW_REQUIRED',status:403});assert.equal(ledgerReads(f),0);
});
test('an independently approved participant-bound director remains admitted, while missing proof revokes the next read',async()=>{
 const f=canonicalFixture({role:'DIRECTOR',linked:true});f.add(shift());assert.equal((await f.read()).complete,true);f.state.kycReview=false;const before=ledgerReads(f);await assert.rejects(f.read(),{code:'PARTICIPANT_KYC_REVIEW_REQUIRED'});assert.equal(ledgerReads(f),before);f.state.kycReview=true;f.state.kycSubmission=false;await assert.rejects(f.read(),{code:'PARTICIPANT_KYC_REVIEW_REQUIRED'});assert.equal(ledgerReads(f),before);
});
test('ADMIN org:admin keeps the existing bootstrap exemption; ADMIN org:member does not gain one',async()=>{
 const protectedAdmin=canonicalFixture({role:'ADMIN',linked:true,kyc:'PENDING_REVIEW'});protectedAdmin.add(shift());assert.equal((await protectedAdmin.read()).complete,true);
 const ordinaryAdmin=canonicalFixture({role:'ADMIN',organizationRole:'org:member',linked:true,kyc:'PENDING_REVIEW'});ordinaryAdmin.add(shift());await assert.rejects(ordinaryAdmin.read(),{code:'PARTICIPANT_KYC_REVIEW_REQUIRED'});assert.equal(ledgerReads(ordinaryAdmin),0);
});
for(const [name,change,code]of [
 ['revoked membership',f=>f.state.memberActive=false,'WORKSPACE_MEMBERSHIP_REQUIRED'],
 ['archived project',f=>f.state.projectActive=false,'WORKSPACE_PROJECT_UNAVAILABLE'],
 ['foreign project selector',f=>f.context.projectId='project-foreign','WORKSPACE_PROJECT_UNAVAILABLE'],
 ['foreign scope',f=>f.context.scope='f'.repeat(64),'WORKSPACE_CONTEXT_CHANGED'],
 ['office-review-only grant',f=>f.state.officeReviewOnly=true,'OFFICE_REVIEW_ONLY'],
 ['foreign organization claim',f=>f.session.organizationId='org_Foreign','WORKSPACE_MEMBERSHIP_REQUIRED']
])test(name+' fails before reading AttendanceEntry',async()=>{
 const f=canonicalFixture();f.add(shift());change(f);await assert.rejects(f.read(),{code});assert.equal(ledgerReads(f),0);
});
test('current canonical role change invalidates the old scope before the new hours predicate can read',async()=>{
 const f=canonicalFixture();f.add(shift());assert.equal((await f.read()).complete,true);const before=ledgerReads(f);f.member.role='FINANCE';await assert.rejects(f.read(),{code:'WORKSPACE_CONTEXT_CHANGED'});assert.equal(ledgerReads(f),before);f.context.scope=scopeStamp(f.session,f.member);await assert.rejects(f.read(),{code:'FIELD_HOURS_PERMISSION_REQUIRED'});assert.equal(ledgerReads(f),before);
});
test('participant project assignment and durable participant origin cannot be bypassed with director portfolio access',async()=>{
 const f=canonicalFixture({role:'DIRECTOR',linked:true});f.add(shift());f.state.assignmentActive=false;await assert.rejects(f.read(),{code:'WORKSPACE_PROJECT_UNAVAILABLE'});assert.equal(ledgerReads(f),0);
 const historical=canonicalFixture({role:'DIRECTOR'});historical.add(shift());historical.state.origin=true;await assert.rejects(historical.read(),{code:'PARTICIPANT_KYC_REVIEW_REQUIRED'});assert.equal(ledgerReads(historical),0);
});
test('a signed channel proof does not expose hours summaries or CSV, even for ADMIN',async()=>{
 const f=canonicalFixture({channel:true});f.add(shift());await assert.rejects(f.read(),{code:'OVERTIME_WEB_ONLY',status:403});assert.equal(ledgerReads(f),0);
});
test('a previous report digest grants no access after membership/role/context changes before CSV',async()=>{
 const f=canonicalFixture();f.add(shift());const handlers=createFieldHandlers({verify:async()=>f.session,operations:f.operations}),request=extra=>new Request('https://obrasaas.com/api/identity/field-operations?'+queryFor(f,extra));
 const preview=await (await handlers.GET(request())).json();assert.equal(preview.complete,true);const before=ledgerReads(f);f.state.memberActive=false;const denied=await handlers.GET(request({hoursFormat:'csv',expectedHoursDigest:preview.reportDigest}));assert.equal(denied.status,403);assert.equal(denied.headers.get('content-disposition'),null);assert.equal(ledgerReads(f),before);assert.equal((await denied.json()).code,'WORKSPACE_MEMBERSHIP_REQUIRED');
});
test('the selected snapshot cannot mix a pre-change ledger with post-change review receipts',async()=>{
 const f=canonicalFixture(),rows=f.add(shift());f.state.afterLedger=()=>{rows[1].metadata.fieldOperations.recordedAt='2026-10-05T20:00:00.000Z';f.state.receipts[1].metadata.outcome.event.recordedAt='2026-10-05T20:00:00.000Z';};
 const first=await f.read();assert.equal(first.rows[0].netMs,28800000);assert.equal(first.rows[0].auditStatus,'CONFIRMED');const second=await f.read();assert.equal(second.rows[0].netMs,32400000);assert.equal(second.rows[0].auditStatus,'CONFIRMED');assert.notEqual(first.reportDigest,second.reportDigest);assert.ok(f.queries.filter(query=>query.sql.startsWith('BEGIN ')).every(query=>query.sql==='BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'));
});
test('other-project records cannot enter this source snapshot or its CSV basis',async()=>{
 const f=canonicalFixture();f.add(shift());f.add(shift({id:'foreign',workerId:'foreign-person',actorId:'foreign-person',projectId:'project-foreign'}),{name:'PRIVATE_FOREIGN_NAME'});const value=await f.read();assert.equal(value.rows.length,1);assert.ok(!JSON.stringify(value).includes('PRIVATE_FOREIGN_NAME'));assert.ok(!JSON.stringify(value).includes('foreign-person'));assert.equal(value.totals.closedObservedNetMs,28800000);
});