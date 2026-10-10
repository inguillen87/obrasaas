import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {digest} from '../src/lib/workspace-policy.mjs';
import {assertEmployeeIntakeAdditiveHistory} from '../src/lib/employee-intake-channel-continuity.mjs';
import {employeeIntakeFixture} from './fixtures/employee-intake-memory.mjs';

const active=(projectId,revision=1)=>({projectId,status:'ACTIVE',revision});
function receipt(revision,assignments,{action=revision===1?'ACTIVATE':'ASSIGN',organizationId='company-a',actorId='manager-a',projectId='project-a',connectionId='connection-a',anchorProjectId='project-a'}={}){
 const operationId=randomUUID();
 return {id:'company_channel_'+digest([organizationId,actorId,projectId,operationId]),organizationId,actorId,action:'company.channel.recorded',entityType:'WhatsAppConnection',entityId:connectionId,metadata:{version:1,projectId,operationId,action,state:'RECORDED',code:null,requestDigest:digest(['synthetic-canonical-receipt',operationId]),channel:{id:connectionId,revision,anchorProjectId,mode:'COMPANY',assignments}}};
}
const proof=receipts=>({connectionId:'connection-a',organizationId:'company-a',anchorProjectId:'project-a',fromRevision:1,toRevision:receipts.length,anchorAssignmentRevision:1,receipts});
const chain=()=>[receipt(1,[active('project-a'),active('project-b')]),receipt(2,[active('project-a'),active('project-b'),active('project-c')])];
const denied=fn=>assert.throws(fn,{code:'EMPLOYEE_INTAKE_REVOKED'});
function addCanonicalAddition(f){
 const baseline=receipt(f.controls.ownerRevision,[active(f.project.id),active(f.target.id)]);
 const addition=receipt(f.controls.ownerRevision+1,[active(f.project.id),active(f.target.id),active('project-c')]);
 for(const row of [baseline,addition])f.audits.set(row.id,row);
 f.controls.ownerRevision++;
 return [baseline,addition];
}

test('one or several confirmed additions retain all preceding assignment authority',()=>{
 const rows=chain();assert.equal(assertEmployeeIntakeAdditiveHistory(proof(rows)),true);
 rows.push(receipt(3,[active('project-a'),active('project-b'),active('project-c'),active('project-d')]));
 assert.equal(assertEmployeeIntakeAdditiveHistory(proof([...rows].reverse())),true);
});

for(const action of ['REVOKE','SUSPEND','ACTIVATE','PREPARE'])test(action+' is not additive authority even with an apparently active resulting channel',()=>{
 const rows=chain();rows[1].metadata.action=action;denied(()=>assertEmployeeIntakeAdditiveHistory(proof(rows)));
});

for(const [name,mutate] of [
 ['missing baseline',rows=>rows.shift()],
 ['missing intervening revision',rows=>rows[1].metadata.channel.revision=3],
 ['duplicate revision',rows=>rows[1].metadata.channel.revision=1],
 ['foreign organization',rows=>rows[1].organizationId='company-other'],
 ['foreign connection',rows=>rows[1].entityId='connection-other'],
 ['foreign anchor',rows=>rows[1].metadata.channel.anchorProjectId='project-other'],
 ['unconfirmed receipt',rows=>rows[1].metadata.state='REJECTED'],
 ['noncanonical receipt ID',rows=>rows[1].id='company_channel_'+'a'.repeat(64)],
 ['anchor revision changed',rows=>rows[1].metadata.channel.assignments[0].revision=2],
 ['existing destination revoked',rows=>rows[1].metadata.channel.assignments[1].status='REVOKED'],
 ['two newly added worksites',rows=>rows[1].metadata.channel.assignments.push(active('project-d'))],
 ['new assignment was previously used',rows=>rows[1].metadata.channel.assignments[2].revision=2],
 ['duplicate assignment identity',rows=>rows[1].metadata.channel.assignments[2].projectId='project-b'],
])test(name+' fails closed',()=>{
 const rows=chain();mutate(rows);denied(()=>assertEmployeeIntakeAdditiveHistory({...proof(rows),toRevision:2}));
});

test('rollback and an unbounded owner gap are rejected before trusting history',()=>{
 const rows=chain();denied(()=>assertEmployeeIntakeAdditiveHistory({...proof(rows),fromRevision:3,toRevision:2}));
 denied(()=>assertEmployeeIntakeAdditiveHistory({...proof(rows),toRevision:102}));
});

test('fresh signed HOLA uses the unchanged policy after a proven addition',async()=>{
 const f=employeeIntakeFixture();await f.configure();const policy=structuredClone(f.connection.metadata.employeeIntakePolicy);addCanonicalAddition(f);
 const result=await f.execute('HOLA');assert.equal(result.result.kind,'EMPLOYEE_INTAKE');assert.equal(f.state().step,'NAME');assert.deepEqual(f.connection.metadata.employeeIntakePolicy,policy);assert.equal(f.workers.size,0);
});

test('consented WAITING request keeps its original digest and signed source and remains admissible once',async()=>{
 const f=employeeIntakeFixture(),submitted=await f.submit(),policy=structuredClone(f.connection.metadata.employeeIntakePolicy),source=structuredClone(f.events.get(submitted.applicationId).payload);
 addCanonicalAddition(f);const page=await f.read();assert.equal(page.enabled,true);assert.equal(page.records[0].status,'WAITING_RESPONSIBLE');assert.deepEqual(f.state(),submitted);assert.deepEqual(f.connection.metadata.employeeIntakePolicy,policy);assert.deepEqual(f.events.get(submitted.applicationId).payload,source);
 const command=f.command('ADMIT_EMPLOYEE_INTAKE',{applicationId:submitted.applicationId,expectedRevision:submitted.revision,job:'WORKER',permissions:{attendance:false,report:true},confirmed:true});
 const first=await f.store.save(f.session,command),again=await f.store.save(f.session,command);assert.equal(first.receiptId,again.receiptId);assert.equal(f.workers.size,1);assert.equal(first.permissionsGranted,false);assert.deepEqual(f.connection.metadata.employeeIntakePolicy,policy);assert.equal(f.state().policyDigest,submitted.policyDigest);assert.equal(f.state().consent,true);
 for(const key of ['encryptedPayload','encryptedProof','payloadDigest'])assert.equal(f.events.get(submitted.applicationId).payload[key],source[key]);
});

test('anchor revoked with destination still active cannot admit the pending application',async()=>{
 const f=employeeIntakeFixture(),submitted=await f.submit();addCanonicalAddition(f);f.controls.anchorAssignment=false;assert.equal(f.controls.targetAssignment,true);
 await assert.rejects(f.store.save(f.session,f.command('ADMIT_EMPLOYEE_INTAKE',{applicationId:submitted.applicationId,expectedRevision:submitted.revision,job:'WORKER',permissions:{attendance:false,report:true},confirmed:true})),{code:'EMPLOYEE_INTAKE_REVOKED'});assert.equal(f.workers.size,0);assert.deepEqual(f.state(),submitted);
});

for(const transitions of [['SUSPEND','ACTIVATE'],['REVOKE','ASSIGN']])test(transitions.join(' -> ')+' never revives the old policy or pending consent',async()=>{
 const f=employeeIntakeFixture(),submitted=await f.submit(),policy=structuredClone(f.connection.metadata.employeeIntakePolicy),rows=addCanonicalAddition(f);rows[1].metadata.action=transitions[0];
 const final=receipt(3,[active(f.project.id),active(f.target.id),active('project-c'),active('project-d')],{action:transitions[1]});f.audits.set(final.id,final);f.controls.ownerRevision=3;
 await assert.rejects(f.execute('HOLA'),{code:'EMPLOYEE_INTAKE_REVOKED'});assert.equal(f.workers.size,0);assert.deepEqual(f.state(),submitted);assert.deepEqual(f.connection.metadata.employeeIntakePolicy,policy);
});

test('old signed routing is still rejected even when the owner change was only additive',async()=>{
 const f=employeeIntakeFixture();await f.configure();const old=f.receive('HOLA');addCanonicalAddition(f);
 await assert.rejects(f.bridge.execute(old),{code:'EMPLOYEE_INTAKE_REVOKED'});assert.equal(f.state(),undefined);assert.equal(f.controls.sends,0);
});
