import test from 'node:test';
import assert from 'node:assert/strict';
import {participantOnboardingNextStep} from '../src/app/(identity)/cuenta/participant-onboarding-next-step.mjs';

const now=Date.parse('2026-10-07T00:50:00.000Z');
const context=()=>({scope:'a'.repeat(64),projectId:'project-a',verified:true,now});
const participant=()=>({id:'worker-a',self:true,active:true,status:'ACTIVE',accountLinked:true,kycChatChallenge:null,invitation:{state:'ACCEPTED'},kyc:{status:'APPROVED',images:[{id:'document-front'},{id:'selfie'}]},permissions:{attendance:true,report:true}});
const fixture=()=>({context:context(),snapshot:{scope:'a'.repeat(64),projectId:'project-a',canManage:false,canInvite:false,records:[participant()]},workerId:'worker-a'});
const manager=()=>{const value=fixture();value.snapshot.canManage=true;value.snapshot.canInvite=true;value.snapshot.records[0].self=false;return value;};
const channel=()=>({scope:'a'.repeat(64),projectId:'project-a',channelReady:true,records:[{workerId:'worker-a',eligible:true,state:'VERIFIED',challenge:null,binding:{id:'binding-a',verifiedAt:'2026-10-06T20:00:00.000Z',revokedAt:null}}]});
const action=value=>participantOnboardingNextStep(value).primary?.action;
const pending=()=>({resource:'participants',scope:'a'.repeat(64),projectId:'project-a',operationId:'11111111-1111-4111-8111-111111111111'});

test('a fresh own approval consults the unobserved channel and offers bank separately',()=>{
 const value=participantOnboardingNextStep(fixture());
 assert.equal(value.state,'CHANNEL_UNOBSERVED');assert.deepEqual(value.primary,{action:'CONSULT_CHANNEL',label:'Consultar mi vínculo'});
 assert.deepEqual(value.optionalBank,{action:'CONSULT_PRIVATE_BANK',label:'Mi cuenta privada'});assert.equal(value.requestedJob,null);
});
for(const [name,invalid] of [['missing',undefined],['not verified',{verified:false}],['invalid scope',{...context(),scope:'foreign'}],['missing project',{...context(),projectId:null}],['invalid clock',{...context(),now:NaN}]])test('missing or unverified context has priority: '+name,()=>{
 const input=fixture();input.context=invalid;input.pendingReference=pending();
 assert.deepEqual(participantOnboardingNextStep(input),{state:'CONTEXT_UNVERIFIED',primary:{action:'CONSULT_ACCESS',label:'Comprobar mi acceso'},optionalBank:null,requestedJob:null});
});
test('a switched project never borrows the old snapshot, reference, channel or bank CTA',()=>{
 const input=fixture();input.context.projectId='project-b';input.pendingReference=pending();input.channelSnapshot=channel();
 assert.equal(action(input),'CONSULT_ACCESS');assert.equal(participantOnboardingNextStep(input).optionalBank,null);
});
test('a switched account invalidates a still mounted old scope',()=>{
 const input=fixture();input.context.scope='b'.repeat(64);assert.equal(action(input),'CONSULT_ACCESS');
});
test('an exact uncertain operation precedes every normal transition and private option',()=>{
 for(const status of ['NOT_INVITED','INVITED','ACTIVE','REVOKED']){
  const input=manager();input.snapshot.records[0].status=status;input.pendingReference=pending();
  assert.equal(action(input),'CONSULT_OPERATION');assert.equal(participantOnboardingNextStep(input).optionalBank,null);
 }
 const own=fixture();own.pendingReference={...pending(),resource:'worker-channel'};own.channelSnapshot=channel();assert.equal(action(own),'CONSULT_OPERATION');
});
for(const patch of [{scope:'b'.repeat(64)},{projectId:'project-b'},{operationId:'not-an-operation'},{resource:'company-channel'}])test('foreign or malformed references never offer a lookup against this context '+JSON.stringify(patch),()=>{
 const input=fixture();input.pendingReference={...pending(),...patch};assert.equal(action(input),'CONSULT_ACCESS');
});
test('a malformed permission projection cannot pretend to be an ADMIN',()=>{
 const input=fixture();input.snapshot.canInvite=true;assert.equal(action(input),'CONSULT_ACCESS');
});
test('a different person receives no mutation or private bank action',()=>{
 const input=fixture();input.snapshot.records[0].self=false;input.snapshot.records[0].status='NOT_INVITED';
 assert.equal(participantOnboardingNextStep(input).primary,null);assert.equal(participantOnboardingNextStep(input).optionalBank,null);
});
test('invitation authority follows current canInvite, not a supplied role name',()=>{
 const input=manager();input.snapshot.records[0].status='NOT_INVITED';input.snapshot.records[0].accountLinked=false;
 assert.equal(action(input),'INVITE');input.snapshot.canInvite=false;input.snapshot.role='ADMIN';assert.equal(action(input),'CONSULT_PARTICIPANTS');
});
test('uncertain invitation requests observation, never a second invitation',()=>{
 const input=manager();Object.assign(input.snapshot.records[0],{status:'INVITED',accountLinked:false,invitation:{state:'ATTEMPTED'}});
 assert.equal(action(input),'RECOVER_INVITATION');assert.equal(participantOnboardingNextStep(input).optionalBank,null);
});
test('an INVITED person can present by chat before the explicit Clerk acceptance',()=>{
 const input=manager();Object.assign(input.snapshot.records[0],{status:'INVITED',accountLinked:false,invitation:{state:'SENT',expired:false,expiresAt:'2026-10-08T00:00:00.000Z'},kyc:{status:'NOT_SUBMITTED'}});
 assert.equal(action(input),'PREPARE_KYC_CHAT');input.snapshot.canInvite=false;assert.equal(action(input),'PREPARE_KYC_CHAT');
 input.snapshot.records[0].kyc.status='PENDING_ACCOUNT_CLAIM';assert.equal(action(input),'CONSULT_PARTICIPANTS');assert.equal(participantOnboardingNextStep(input).state,'WAIT_ACCOUNT');
});
test('the fresh clock expires an invitation despite an old expired:false snapshot',()=>{
 const input=manager();Object.assign(input.snapshot.records[0],{status:'INVITED',accountLinked:false,invitation:{state:'SENT',expired:false,expiresAt:'2026-10-07T00:49:59.999Z'},kyc:{status:'NOT_SUBMITTED'}});
 assert.equal(action(input),'INVITE');input.snapshot.canInvite=false;assert.equal(action(input),'CONSULT_PARTICIPANTS');
});
test('the unscoped Clerk join DTO cannot be used as a participants projection',()=>{
 const input=fixture();input.snapshot={invitationId:'invite-a',state:'INVITED',canAccept:true,projectName:'Same display name'};assert.equal(action(input),'CONSULT_ACCESS');
});
test('own new or rejected identity uses the web submission, not reviewer authority',()=>{
 for(const status of ['NOT_SUBMITTED','REJECTED']){const input=fixture();input.snapshot.records[0].kyc.status=status;assert.equal(action(input),'SUBMIT_KYC');assert.equal(participantOnboardingNextStep(input).optionalBank,null);}
});
test('only a different manager can prepare a human review with two images',()=>{
 const input=manager();input.snapshot.records[0].kyc.status='PENDING_REVIEW';assert.equal(action(input),'REVIEW_KYC');
 input.snapshot.records[0].self=true;assert.equal(action(input),'CONSULT_PARTICIPANTS');assert.equal(participantOnboardingNextStep(input).state,'WAIT_REVIEW');
 input.snapshot.records[0].self=false;input.snapshot.records[0].kyc.images=[];assert.equal(action(input),'CONSULT_PARTICIPANTS');
 input.snapshot.canManage=false;input.snapshot.canInvite=false;assert.equal(participantOnboardingNextStep(input).primary,null);
});
test('APPROVED for another person never lets an ADMIN claim their channel or bank',()=>{
 const input=manager();input.channelSnapshot=channel();assert.equal(action(input),'CONSULT_PARTICIPANTS');assert.equal(participantOnboardingNextStep(input).optionalBank,null);
});
test('revoked and inactive participation remove every bank or binding CTA',()=>{
 const own=fixture();own.snapshot.records[0].status='REVOKED';own.channelSnapshot=channel();assert.equal(action(own),'CONSULT_PARTICIPANTS');assert.equal(participantOnboardingNextStep(own).optionalBank,null);
 const admin=manager();admin.snapshot.records[0].status='REVOKED';assert.equal(action(admin),'RESTORE_ACCESS');admin.snapshot.records[0].active=false;assert.equal(action(admin),'CONSULT_PARTICIPANTS');
});
test('bank is independent of field permissions and missing or revoked binding',()=>{
 const input=fixture();input.snapshot.records[0].permissions={attendance:false,report:false};input.channelSnapshot=channel();assert.equal(action(input),'CONSULT_PARTICIPANTS');assert.ok(participantOnboardingNextStep(input).optionalBank);
 input.snapshot.records[0].permissions.report=true;input.channelSnapshot.records[0].state='UNLINKED';input.channelSnapshot.records[0].binding=null;assert.equal(action(input),'REQUEST_CHALLENGE');assert.ok(participantOnboardingNextStep(input).optionalBank);
});
test('bank declaration/private metadata are neither read nor emitted',()=>{
 const input=fixture();Object.defineProperty(input.snapshot.records[0],'privateBankAccount',{get(){throw new Error('Private bank metadata must never be read');}});
 Object.defineProperty(input.snapshot.records[0],'metadata',{get(){throw new Error('Public DTOs only');}});
 const value=participantOnboardingNextStep(input);assert.ok(value.optionalBank);assert.deepEqual(Object.keys(value).sort(),['optionalBank','primary','requestedJob','state']);
});
test('a VERIFIED label without a current complete binding is not an operational CTA',()=>{
 const input=fixture();input.channelSnapshot=channel();input.channelSnapshot.records[0].binding=null;assert.equal(action(input),'CONSULT_CHANNEL');
 input.channelSnapshot.records[0].binding=channel().records[0].binding;input.channelSnapshot.records[0].binding.revokedAt='2026-10-07T00:45:00.000Z';assert.equal(action(input),'CONSULT_CHANNEL');
});
test('only an own eligible and ready verified channel offers the chat next step',()=>{
 const input=fixture();input.channelSnapshot=channel();assert.equal(action(input),'OPEN_WHATSAPP');
 input.channelSnapshot.records[0].eligible=false;assert.equal(action(input),'CONSULT_CHANNEL');input.channelSnapshot.records[0].eligible=true;input.channelSnapshot.channelReady=false;assert.equal(action(input),'CONSULT_CHANNEL');
});
test('a pending live binding is consulted; expiry requires a fresh explicit preparation',()=>{
 const input=fixture();input.channelSnapshot=channel();Object.assign(input.channelSnapshot.records[0],{state:'NOT_LINKED',binding:null,challenge:{expired:false,expiresAt:'2026-10-07T00:55:00.000Z'}});
 assert.equal(action(input),'CONSULT_CHANNEL');input.context.now=Date.parse('2026-10-07T00:55:00.000Z');assert.equal(action(input),'REQUEST_CHALLENGE');
 input.channelSnapshot.records[0].challenge.expiresAt='invalid';assert.equal(action(input),'CONSULT_CHANNEL');
});
test('foreign channel snapshots and duplicate selected workers fail closed',()=>{
 const input=fixture();input.channelSnapshot=channel();input.channelSnapshot.projectId='project-b';assert.equal(action(input),'CONSULT_ACCESS');
 input.channelSnapshot=channel();input.channelSnapshot.records.push({...input.channelSnapshot.records[0]});assert.equal(action(input),'CONSULT_CHANNEL');
 input.snapshot.records.push(participant());assert.equal(action(input),'CONSULT_PARTICIPANTS');
});
const application=()=>({id:'application-a',status:'WAITING_RESPONSIBLE',job:'MASON',jobLabel:'Albañil',workerId:null,destinationProjectId:null});
const intake=()=>{const value=manager();value.workerId=null;value.applicationId='application-a';value.snapshot.employeeIntake={available:true,enabled:true,records:[application()]};return value;};
test('a consented application offers ADMIN review, never automatic admission or permissions',()=>{
 const input=intake();const result=participantOnboardingNextStep(input);assert.equal(result.primary.action,'REVIEW_INTAKE');assert.deepEqual(result.requestedJob,{kind:'REQUESTED',label:'Albañil'});assert.equal(result.optionalBank,null);
 input.snapshot.employeeIntake.enabled=false;assert.equal(action(input),'CONSULT_PARTICIPANTS');input.snapshot.canInvite=false;assert.equal(action(input),'CONSULT_ACCESS');
});
test('admission chooses only its scoped canonical Worker and still requires INVITE',()=>{
 const input=intake();Object.assign(input.snapshot.employeeIntake.records[0],{status:'ADMITTED',workerId:'worker-a',destinationProjectId:'project-a'});Object.assign(input.snapshot.records[0],{status:'NOT_INVITED',accountLinked:false});
 assert.equal(action(input),'INVITE');assert.equal(participantOnboardingNextStep(input).requestedJob.kind,'REQUESTED');
 input.snapshot.employeeIntake.records[0].destinationProjectId='project-b';assert.equal(action(input),'CONSULT_ACCESS');
});
test('requested trade is never upgraded to an authorized office or field role',()=>{
 const input=intake();input.snapshot.employeeIntake.records[0].authorizedJob='DIRECTOR';input.snapshot.employeeIntake.records[0].permissions={attendance:true,report:true};
 const value=participantOnboardingNextStep(input);assert.deepEqual(value.requestedJob,{kind:'REQUESTED',label:'Albañil'});assert.equal(JSON.stringify(value).includes('DIRECTOR'),false);
});
test('an admitted row outside the current participants page is consulted, not inferred',()=>{
 const input=intake();Object.assign(input.snapshot.employeeIntake.records[0],{status:'ADMITTED',workerId:'worker-unobserved',destinationProjectId:'project-a'});input.snapshot.nextCursor='worker-cursor';assert.equal(action(input),'CONSULT_PARTICIPANTS');
});
test('the helper has no mutation, percentage, secret or readiness authority in its output',()=>{
 for(const input of [fixture(),manager(),intake(),{...fixture(),pendingReference:pending()}]){
  const before=JSON.stringify(input);const result=participantOnboardingNextStep(input);assert.equal(JSON.stringify(input),before);
  assert.ok(result.primary===null||result.primary.label.length<40);assert.equal(Object.hasOwn(result,'percent'),false);assert.equal(Object.hasOwn(result,'authorizedJob'),false);assert.equal(Object.hasOwn(result,'saved'),false);
 }
});
