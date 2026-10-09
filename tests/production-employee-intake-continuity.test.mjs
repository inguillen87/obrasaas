import test from 'node:test';
import assert from 'node:assert/strict';
import {employeeIntakeAdmissionContinuation,employeeIntakeInvitationQuery,employeeIntakeInvitationPreparation} from '../src/app/(identity)/cuenta/employee-intake-continuity.mjs';

const scope='a'.repeat(64),projectId='project-b',id='customer_webhook_'+'c'.repeat(64),workerId='worker-a',operationId='01234567-89ab-4cde-8fab-0123456789ab';
const context={scope,projectId,now:Date.parse('2026-10-08T00:00:00.000Z')};
const application={scope,projectId,id,workerId};
const reference={version:1,createdAt:123456,scope,projectId,operationId,resource:'participants',action:'ADMIT_EMPLOYEE_INTAKE',connectionId:'connection-a',applicationId:id};
const receipt={scope,projectId,operationId,action:reference.action,connectionId:reference.connectionId,applicationId:id,receiptId:'participant_'+'d'.repeat(64),workerId,saved:true,state:'RECORDED',permissionsGranted:false};
const snapshot=()=>({scope,projectId,participantFocus:{workerId,intakeId:id},canInvite:true,canManage:true,records:[{id:workerId,active:true,status:'NOT_INVITED',accountLinked:false,revision:'2026-10-08T00:00:00.000001',kycChatChallenge:null,kyc:{status:'NOT_SUBMITTED'}}],employeeIntake:{records:[{id,status:'ADMITTED',workerId,destinationProjectId:projectId,email:'synthetic@example.invalid'}]}});

test('only confirmed matching admission receipts produce contact-free continuation references',()=>{
 const value=employeeIntakeAdmissionContinuation(reference,{...receipt,name:'Private name',email:'private@example.invalid',phone:'+15550001001'});
 assert.deepEqual(value,application);
 for(const change of [{scope:'b'.repeat(64)},{projectId:'other'},{operationId:'01234567-89ab-4cde-8fab-0123456789ac'},{action:'REJECT_EMPLOYEE_INTAKE'},{applicationId:'customer_webhook_'+'e'.repeat(64)},{connectionId:'other'},{saved:false},{state:'NOT_OBSERVED'},{permissionsGranted:true},{workerId:null},{workerId:'../other'}])assert.equal(employeeIntakeAdmissionContinuation(reference,{...receipt,...change}),null);
 assert.equal(employeeIntakeAdmissionContinuation({...reference,resource:'worker-channel'},receipt),null);
});

test('a continuation queries exactly its current project, worker and admitted application',()=>{
 assert.deepEqual(employeeIntakeInvitationQuery(application,context),{scope,projectId,workerId,intakeId:id});
 for(const change of [{scope:'b'.repeat(64)},{projectId:'other'},{destinationProjectId:'other'},{id:'untyped'},{workerId:''}])assert.equal(employeeIntakeInvitationQuery({...application,...change},context),null);
 assert.equal(employeeIntakeInvitationQuery(application,{...context,scope:''}),null);
});

test('a fresh exact read prepares the canonical invitation payload without granting or sending anything',()=>{
 const value=employeeIntakeInvitationPreparation(snapshot(),application,context);
 assert.deepEqual(value,{workerId,canPrepare:true,payload:{workerId,revision:'2026-10-08T00:00:00.000001',email:'synthetic@example.invalid'}});
 assert.equal(Object.hasOwn(value.payload,'permissions'),false);
 assert.equal(Object.hasOwn(value.payload,'whatsAppConsent'),false);
});

test('crossed or missing focus, pages, destination and worker identity cannot prepare another invitation',()=>{
 for(const mutate of [s=>s.scope='b'.repeat(64),s=>s.projectId='other',s=>delete s.participantFocus,s=>s.participantFocus.workerId='other',s=>s.participantFocus.intakeId='customer_webhook_'+'e'.repeat(64),s=>s.records.push({...s.records[0],id:'other'}),s=>s.employeeIntake.records.push({...s.employeeIntake.records[0]}),s=>s.employeeIntake.records[0].destinationProjectId='other',s=>s.employeeIntake.records[0].workerId='other',s=>s.employeeIntake.records[0].status='WAITING_RESPONSIBLE',s=>s.records[0].id='other',s=>s.records[0].active=false]){const value=snapshot();mutate(value);assert.equal(employeeIntakeInvitationPreparation(value,application,context),null);}
});

test('existing invitation/account or missing current authority gives only the existing profile',()=>{
 for(const mutate of [s=>s.canInvite=false,s=>s.canManage=false,s=>s.records[0].status='INVITED',s=>s.records[0].accountLinked=true,s=>delete s.records[0].kycChatChallenge]){const value=snapshot();mutate(value);assert.deepEqual(employeeIntakeInvitationPreparation(value,application,context),{workerId,canPrepare:false,payload:null});}
});

test('invalid fresh email or worker revision cannot be reused as an invitation payload',()=>{
 for(const mutate of [s=>s.employeeIntake.records[0].email='invalid',s=>s.records[0].revision='old',s=>s.employeeIntake.records[0].email='x'.repeat(255)+'@example.invalid']){const value=snapshot();mutate(value);assert.equal(employeeIntakeInvitationPreparation(value,application,context),null);}
});
