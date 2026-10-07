import test from 'node:test';
import assert from 'node:assert/strict';
import {participantOnboardingNextStep,participantKycChatCapabilities} from '../src/app/(identity)/cuenta/participant-onboarding-next-step.mjs';

const now=Date.parse('2026-10-07T00:50:00.000Z');
const context=()=>({scope:'a'.repeat(64),projectId:'project-a',verified:true,now});
const participant=()=>({id:'worker-a',self:true,active:true,status:'ACTIVE',accountLinked:true,kycChatChallenge:null,invitation:{state:'ACCEPTED'},kyc:{status:'APPROVED',images:[{id:'document-front'},{id:'selfie'}]},permissions:{attendance:true,report:true}});
const fixture=()=>({context:context(),snapshot:{scope:'a'.repeat(64),projectId:'project-a',canManage:false,canInvite:false,records:[participant()]},workerId:'worker-a'});
const manager=()=>{const value=fixture();value.snapshot.canManage=true;value.snapshot.canInvite=true;value.snapshot.records[0].self=false;return value;};
const channel=()=>({scope:'a'.repeat(64),projectId:'project-a',channelReady:true,records:[{workerId:'worker-a',eligible:true,state:'VERIFIED',challenge:null,binding:{id:'binding-a',verifiedAt:'2026-10-06T20:00:00.000Z',revokedAt:null}}]});
const action=value=>participantOnboardingNextStep(value).primary?.action;
const pending=()=>({resource:'participants',scope:'a'.repeat(64),projectId:'project-a',operationId:'11111111-1111-4111-8111-111111111111'});

const chatChallenge=(status='PENDING')=>({
 id:'kyc_chat_current',status,expiresAt:'2026-10-07T02:00:00.000Z',
 conversationExpiresAt:status==='CLAIMED'?'2026-10-07T01:30:00.000Z':null,
 expired:false,canPrepare:false,canCancel:false,blockedCode:null,
});
const chatFixture=(status='PENDING')=>{
 const input=manager();Object.assign(input.snapshot.records[0],{kyc:{status:'NOT_SUBMITTED'},kycChatChallenge:chatChallenge(status)});return input;
};
test('an explicitly absent challenge permits preparation, while an omitted projection requires GET',()=>{
 const input=chatFixture();input.snapshot.records[0].kycChatChallenge=null;assert.equal(action(input),'PREPARE_KYC_CHAT');
 delete input.snapshot.records[0].kycChatChallenge;assert.equal(action(input),'CONSULT_PARTICIPANTS');assert.equal(participantOnboardingNextStep(input).state,'KYC_CHAT_UNOBSERVED');
});
for(const status of ['PENDING','CLAIMED'])for(const expired of [false,true])test('a '+status+' challenge '+(expired?'expired':'live')+' cannot be overwritten by preparing another',()=>{
 const input=chatFixture(status),chat=input.snapshot.records[0].kycChatChallenge;chat.expired=expired;
 if(expired){chat.expiresAt='2026-10-07T00:40:00.000Z';if(status==='CLAIMED')chat.conversationExpiresAt='2026-10-07T00:45:00.000Z';}
 assert.equal(action(input),'CONSULT_PARTICIPANTS');input.context.now+=7*24*60*60*1000;assert.equal(action(input),'CONSULT_PARTICIPANTS');
 chat.canPrepare=true;assert.equal(action(input),'CONSULT_PARTICIPANTS','Even a contradictory preparation flag never overwrites the active challenge');
});
for(const status of ['PENDING','CLAIMED'])test('only the current projected capability offers human cancellation of '+status,()=>{
 const input=chatFixture(status);input.snapshot.records[0].kycChatChallenge.canCancel=true;
 assert.equal(action(input),'CANCEL_KYC_CHAT');assert.equal(participantOnboardingNextStep(input).optionalBank,null);
 input.snapshot.records[0].kycChatChallenge.canCancel=false;assert.equal(action(input),'CONSULT_PARTICIPANTS');
});
test('expiry does not silently cancel a presentation or prevent an authorized explicit close',()=>{
 const input=chatFixture('CLAIMED');Object.assign(input.snapshot.records[0].kycChatChallenge,{expiresAt:'2026-10-07T00:40:00.000Z',conversationExpiresAt:'2026-10-07T00:45:00.000Z',expired:true,canCancel:true});
 assert.equal(action(input),'CANCEL_KYC_CHAT');const before=JSON.stringify(input);participantOnboardingNextStep(input);assert.equal(JSON.stringify(input),before);
});
test('role names cannot invent cancellation authority and inactive participation removes it',()=>{
 const input=chatFixture();input.snapshot.records[0].kycChatChallenge.canCancel=true;input.snapshot.canManage=false;input.snapshot.canInvite=false;input.snapshot.role='ADMIN';
 assert.equal(participantOnboardingNextStep(input).primary,null);assert.equal(participantKycChatCapabilities(input.snapshot.records[0],false,now).canCancel,false);
 input.snapshot.canManage=true;input.snapshot.records[0].active=false;assert.equal(action(input),'CONSULT_PARTICIPANTS');
 input.snapshot.records[0].active=true;input.snapshot.records[0].status='REVOKED';assert.equal(action(input),'CANCEL_KYC_CHAT');assert.equal(participantKycChatCapabilities(input.snapshot.records[0],true,now).canCancel,true);
});
test('an uncertain operation precedes cancellation and preparation after reload',()=>{
 const input=chatFixture();input.snapshot.records[0].kycChatChallenge.canCancel=true;input.pendingReference=pending();assert.equal(action(input),'CONSULT_OPERATION');
 input.pendingReference.projectId='project-b';assert.equal(action(input),'CONSULT_ACCESS');
});
for(const patch of [{step:'FINALIZING',canCancel:false},{step:'FINALIZING',canCancel:true},{step:'CONFIRM',recoveryRequired:true,canCancel:false},{step:'CONFIRM',recoveryRequired:true,canCancel:true}])test('confirmation or recovery does not offer cancellation '+JSON.stringify(patch),()=>{
 const input=chatFixture('CLAIMED');Object.assign(input.snapshot.records[0].kycChatChallenge,patch);assert.equal(action(input),'CONSULT_PARTICIPANTS');
});
test('safe conversational progress remains presentation only and is not copied into nextStep',()=>{
 const input=chatFixture('CLAIMED');Object.assign(input.snapshot.records[0].kycChatChallenge,{step:'SELFIE',recoveryRequired:false,claimedAt:'2026-10-07T00:45:00.000Z',closedAt:null,canCancel:true,blockedCode:'PARTICIPANT_KYC_CHAT_ISSUER_REQUIRED'});
 const result=participantOnboardingNextStep(input);assert.equal(result.primary.action,'CANCEL_KYC_CHAT');assert.deepEqual(Object.keys(result).sort(),['optionalBank','primary','requestedJob','state']);assert.equal(JSON.stringify(result).includes('SELFIE'),false);assert.equal(JSON.stringify(result).includes('PARTICIPANT_KYC_CHAT_ISSUER_REQUIRED'),false);
});
test('an audited closed challenge still requires a fresh capability before a distinct preparation',()=>{
 for(const status of ['CANCELLED','CLOSED']){
  const input=chatFixture(status),chat=input.snapshot.records[0].kycChatChallenge;chat.closedAt='2026-10-07T00:49:00.000Z';
  assert.equal(action(input),'CONSULT_PARTICIPANTS');chat.canPrepare=true;assert.equal(action(input),'PREPARE_KYC_CHAT');
  chat.canCancel=true;assert.equal(action(input),'CONSULT_PARTICIPANTS','A contradictory terminal DTO cannot offer cancellation');
 }
 const result=chatFixture('COMPLETED');result.snapshot.records[0].kycChatChallenge.canPrepare=true;assert.equal(action(result),'CONSULT_PARTICIPANTS');
});
test('a preparation receipt with no challenge projection requires GET before another action',()=>{
 const input=chatFixture();input.snapshot.records[0].kycChatChallenge=null;assert.equal(action(input),'PREPARE_KYC_CHAT');
 const receiptRow={...input.snapshot.records[0]};delete receiptRow.kycChatChallenge;input.snapshot.records=[receiptRow];assert.equal(action(input),'CONSULT_PARTICIPANTS');
});
for(const [name,patch] of [
 ['invalid date',{expiresAt:'not-a-date'}],['impossible calendar date',{expiresAt:'2026-02-30T12:00:00.000Z'}],
 ['missing conversation deadline',{status:'CLAIMED',conversationExpiresAt:null}],['pending conversation mismatch',{conversationExpiresAt:'2026-10-07T01:00:00.000Z'}],
 ['unsupported progress',{step:'APPROVED'}],['untyped recovery',{recoveryRequired:'false'}],['unknown durable state',{status:'INVALID'}],
 ['untyped capability',{canCancel:'true'}],['untrusted message',{blockedCode:'Untrusted private provider text'}],
 ['code unexpectedly included',{code:'IDENTIDAD '+'A'.repeat(43)}],['ciphertext unexpectedly included',{encryptedState:'synthetic-private-envelope'}],
])test('malformed or private challenge metadata remains consultable: '+name,()=>{
 const input=chatFixture();Object.assign(input.snapshot.records[0].kycChatChallenge,patch);const result=participantOnboardingNextStep(input);
 assert.equal(result.primary.action,'CONSULT_PARTICIPANTS');assert.equal(participantKycChatCapabilities(input.snapshot.records[0],true,now).observed,false);
 assert.equal(JSON.stringify(result).includes('IDENTIDAD '),false);assert.equal(JSON.stringify(result).includes('synthetic-private-envelope'),false);
});
test('cross-project snapshots and unobserved workers cannot borrow a cancel capability',()=>{
 const input=chatFixture();input.snapshot.records[0].kycChatChallenge.canCancel=true;input.context.projectId='project-b';assert.equal(action(input),'CONSULT_ACCESS');
 input.context.projectId='project-a';input.workerId='worker-b';assert.equal(action(input),'CONSULT_PARTICIPANTS');
});
test('a chat preparation or cancellation never offers delivery, approval or a channel claim',()=>{
 for(const status of ['PENDING','CLAIMED','CANCELLED','CLOSED']){
  const input=chatFixture(status),chat=input.snapshot.records[0].kycChatChallenge;chat.canCancel=['PENDING','CLAIMED'].includes(status);chat.canPrepare=['CANCELLED','CLOSED'].includes(status);
  const result=participantOnboardingNextStep(input);assert.ok(['CANCEL_KYC_CHAT','PREPARE_KYC_CHAT'].includes(result.primary.action));
  assert.equal(Object.hasOwn(result,'saved'),false);assert.equal(Object.hasOwn(result,'replySent'),false);assert.equal(result.optionalBank,null);assert.ok(!['REVIEW_KYC','REQUEST_CHALLENGE','OPEN_WHATSAPP','SEND_PARTICIPANT_ONBOARDING'].includes(result.primary.action));
 }
});

for(const status of ['PENDING','CLAIMED'])for(const accountLinked of [true,false])test('revoked '+status+' closes or consults before participation changes, accountLinked='+accountLinked,()=>{
 const input=chatFixture(status),row=input.snapshot.records[0];row.status='REVOKED';row.accountLinked=accountLinked;row.kycChatChallenge.canCancel=true;
 assert.equal(action(input),'CANCEL_KYC_CHAT');assert.equal(participantKycChatCapabilities(row,true,now).canPrepare,false);
 row.kycChatChallenge.canCancel=false;row.kycChatChallenge.blockedCode='PARTICIPANT_KYC_CHAT_ISSUER_REQUIRED';assert.equal(action(input),'CONSULT_PARTICIPANTS');
 row.kycChatChallenge=null;assert.equal(action(input),accountLinked?'RESTORE_ACCESS':'INVITE');
});
for(const status of ['PENDING','CLAIMED'])test('expired invitation '+status+' preserves active challenge before reinvitation',()=>{
 const input=chatFixture(status),row=input.snapshot.records[0];row.status='INVITED';row.accountLinked=false;row.kycChatChallenge.canCancel=true;row.invitation={state:'SENT',expiresAt:'2026-10-01T00:00:00.000Z',expired:true};
 assert.equal(action(input),'CANCEL_KYC_CHAT');row.kycChatChallenge.canCancel=false;assert.equal(action(input),'CONSULT_PARTICIPANTS');
 row.kycChatChallenge=null;assert.equal(action(input),'INVITE');
});
for(const status of ['INVITED','REVOKED'])test('unobserved chat on '+status+' requires current GET before changing participation',()=>{
 const input=chatFixture(),row=input.snapshot.records[0];row.status=status;delete row.kycChatChallenge;if(status==='INVITED')row.invitation={state:'SENT',expiresAt:'2026-10-01T00:00:00.000Z',expired:true};
 assert.equal(action(input),'CONSULT_PARTICIPANTS');assert.equal(participantOnboardingNextStep(input).state,'KYC_CHAT_UNOBSERVED');
});
