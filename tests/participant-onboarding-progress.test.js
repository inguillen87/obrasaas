import assert from 'node:assert/strict';
import test from 'node:test';
import { projectParticipantOnboarding, participantProgressCopy, onboardingClaimHref, confirmedOnboardingDecision } from '../src/lib/whatsapp/participant-onboarding-progress.js';
const checkedAt = '2026-09-19T15:00:00.000Z';
test('projection preserves only the public progress contract and exact opaque claim link',()=>{
  const raw={state:'already_pending',capability:{code:'WORKER_ONBOARDING_INVITATION_ALREADY_OPEN',reason:'Esperando revisión'},invitation:{claimId:'claim-a',claimStatus:'SUBMITTED',delivery:'submitted',expiresAt:checkedAt,claimToken:'private-value',sender:'private-phone'},identity:{legalName:'private-name'},checkedAt};
  const view=projectParticipantOnboarding(raw);assert.equal(view.claimId,'claim-a');assert.equal(view.claimStatus,'SUBMITTED');assert.equal(view.delivery,'submitted');
  for(const value of ['private-value','private-phone','private-name'])assert.ok(!JSON.stringify(view).includes(value));
  assert.equal(onboardingClaimHref(view.claimId),'/dashboard/team?onboardingClaimId=claim-a#worker-onboarding');
  assert.equal(participantProgressCopy(view).step,3);
});
test('public projection can be normalized twice without losing its current authority or claim',()=>{
  const view=projectParticipantOnboarding({state:'authorized',currentAccess:{workerId:'worker-a',role:'WORKER',verifiedNow:true,checkedAt},invitation:{claimId:'claim-a',claimStatus:'APPROVED'},checkedAt});
  assert.deepEqual(projectParticipantOnboarding(view),view);assert.equal(view.currentAccess.role,'WORKER');assert.equal(participantProgressCopy(view).step,4);
});
for(const raw of [null,{}, {state:'admin'}, {state:'authorized',currentAccess:{workerId:'worker-a',role:'ADMIN',verifiedNow:true,checkedAt}}])test('unknown input never becomes a current operational permission: '+JSON.stringify(raw),()=>{
  const result=projectParticipantOnboarding(raw);assert.equal(result.currentAccess,null);assert.notEqual(participantProgressCopy(result).step,4);
});
test('an approved history entry cannot override a conflict or revocation',()=>{
  const view=projectParticipantOnboarding({state:'conflict',invitation:{claimId:'claim-a',claimStatus:'APPROVED'},currentAccess:{workerId:'worker-a',role:'WORKER',verifiedNow:true,checkedAt}});
  assert.equal(view.currentAccess,null);assert.equal(participantProgressCopy(view).tone,'conflict');
});
for(const id of ['../other','https://example.test','x?token=secret','<script>',''])test('unsafe claim reference does not become a navigation URL: '+id,()=>{
  const view=projectParticipantOnboarding({state:'already_pending',invitation:{claimId:id,claimStatus:'SUBMITTED'}});assert.equal(view.claimId,null);assert.equal(onboardingClaimHref(id),'/dashboard/team#worker-onboarding');
});
test('unknown delivery and a submitted form are different from approval',()=>{
  const unknown=projectParticipantOnboarding({state:'already_pending',invitation:{claimId:'claim-a',claimStatus:'PENDING',delivery:'unknown'}});
  assert.match(participantProgressCopy(unknown).title,/Confirmando/);
  const submitted=projectParticipantOnboarding({state:'already_pending',invitation:{claimId:'claim-a',claimStatus:'SUBMITTED',delivery:'submitted'}});
  assert.match(participantProgressCopy(submitted).title,/falta la decisión/);assert.equal(submitted.currentAccess,null);
});
test('unavailable query is visible and never represented as no action required',()=>{
  const result=projectParticipantOnboarding({state:'closed',unavailable:true});assert.equal(result.unavailable,true);assert.match(participantProgressCopy(result).title,/No se pudo verificar/);
});
test('integration requirements and a closed service window have different recovery destinations',()=>{
  assert.equal(projectParticipantOnboarding({state:'closed',capability:{code:'WHATSAPP_REMOTE_HEALTH_EVIDENCE_STALE'}}).needsIntegration,true);
  assert.equal(projectParticipantOnboarding({state:'closed',capability:{code:'WHATSAPP_CUSTOMER_SERVICE_WINDOW_CLOSED'}}).needsIntegration,false);
});
const command={claimId:'claim-a',projectId:'project-a',expectedRevision:2,action:'APPROVE'};
const result={id:'claim-a',projectId:'project-a',revision:3,status:'APPROVED',replayed:false,resolution:{workerId:'worker-a'}};
test('only a matching completed decision is confirmed as successful',()=>{
  assert.equal(confirmedOnboardingDecision(result,command),true);assert.equal(confirmedOnboardingDecision({...result,replayed:true},command),true);
});
for(const patch of [{id:'other'},{projectId:'other'},{revision:2},{status:'SUBMITTED'},{replayed:'true'},{resolution:null}])test('unexpected decision response preserves uncertainty: '+Object.keys(patch)[0],()=>{
  assert.equal(confirmedOnboardingDecision({...result,...patch},command),false);
});
test('a rejection response must match the rejected decision rather than an approved worker',()=>{
  assert.equal(confirmedOnboardingDecision({...result,status:'REJECTED',resolution:null},{...command,action:'REJECT'}),true);
  assert.equal(confirmedOnboardingDecision(result,{...command,action:'REJECT'}),false);
});
test('a current-access badge needs an explicit valid verification time',()=>{
  for(const value of [null,undefined,'not-a-date']){
    const result=projectParticipantOnboarding({state:'authorized',currentAccess:{workerId:'worker-a',role:'WORKER',verifiedNow:true,checkedAt:value}});
    assert.equal(result.currentAccess,null);assert.notEqual(participantProgressCopy(result).step,4);
  }
});
