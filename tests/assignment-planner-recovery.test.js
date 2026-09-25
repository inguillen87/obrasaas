import assert from 'node:assert/strict';
import test from 'node:test';
import { assignmentPlanRecovery, assignmentSourceRecovery } from '../src/lib/assignment-planner-recovery.js';

for (const code of ['ASSIGNMENT_DUPLICATE','ASSIGNMENT_REVIEW_CHANGED']) {
  test('confirmed conflict returns to explicit review: '+code,()=>{
    assert.equal(assignmentPlanRecovery({status:409,code}),'revise');
    assert.equal(assignmentPlanRecovery({status:503,code}),'uncertain');
    assert.equal(assignmentPlanRecovery({code}),'uncertain');
  });
}
for (const code of ['ASSIGNMENT_TASK_CHANGED','ASSIGNMENT_OWNER_UNAVAILABLE']) {
  test('changed authoritative source requires explicit refresh: '+code,()=>{
    assert.equal(assignmentPlanRecovery({status:409,code}),'refresh');
    assert.equal(assignmentPlanRecovery({status:500,code}),'uncertain');
    assert.equal(assignmentPlanRecovery({status:403,code}),'blocked');
  });
}
for (const status of [400,422]) test('validation rejection requires renewed review '+status,()=>{
  assert.equal(assignmentPlanRecovery({status}),'revise');
});
for (const status of [401,402,403,404,409,410]) test('authorization, identity and unknown conflicts stay closed '+status,()=>{
  for (const code of [undefined,'EVIDENCE_CONTEXT_CHANGED','ASSIGNMENT_ATTEMPT_CONFLICT','ASSIGNMENT_GONE']) {
    assert.equal(assignmentPlanRecovery({status,code}),'blocked');
  }
  assert.equal(assignmentSourceRecovery({status}),'blocked');
});
for (const status of [undefined,408,425,429,500,502,503,504]) test('uncertain write keeps its original attempt '+String(status),()=>{
  assert.equal(assignmentPlanRecovery({status}),'uncertain');
  assert.equal(assignmentSourceRecovery({status}),'retry');
});
test('a malformed or foreign source never unlocks the planner',()=>{
  assert.equal(assignmentSourceRecovery({code:'ASSIGNMENT_SOURCE_UNCONFIRMED'}),'blocked');
  assert.equal(assignmentSourceRecovery({status:503,code:'ASSIGNMENT_SOURCE_UNCONFIRMED'}),'blocked');
});
test('classifiers preserve input diagnostics and handle an absent error',()=>{
  const failure=Object.freeze({status:409,code:'ASSIGNMENT_DUPLICATE',message:'Existing assignment'});
  assert.equal(assignmentPlanRecovery(failure),'revise');
  assert.deepEqual(failure,{status:409,code:'ASSIGNMENT_DUPLICATE',message:'Existing assignment'});
  assert.equal(assignmentPlanRecovery(),'uncertain');assert.equal(assignmentSourceRecovery(),'retry');
});
