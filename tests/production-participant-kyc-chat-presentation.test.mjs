import test from 'node:test';
import assert from 'node:assert/strict';
import {participantOnboardingNextStep,participantKycChatCapabilities,participantKycChatPresentation} from '../src/app/(identity)/cuenta/participant-onboarding-next-step.mjs';

const now=Date.parse('2026-10-07T00:50:00.000Z');
const context=()=>({scope:'a'.repeat(64),projectId:'project-a',verified:true,now});
const participant=()=>({id:'worker-a',self:true,active:true,status:'ACTIVE',accountLinked:true,kycChatChallenge:null,invitation:{state:'ACCEPTED'},kyc:{status:'APPROVED',images:[{id:'document-front'},{id:'selfie'}]},permissions:{attendance:true,report:true}});
const fixture=()=>({context:context(),snapshot:{scope:'a'.repeat(64),projectId:'project-a',canManage:false,canInvite:false,records:[participant()]},workerId:'worker-a'});
const manager=()=>{const value=fixture();value.snapshot.canManage=true;value.snapshot.canInvite=true;value.snapshot.records[0].self=false;return value;};
const action=value=>participantOnboardingNextStep(value).primary?.action;
const pending=()=>({resource:'participants',scope:'a'.repeat(64),projectId:'project-a',operationId:'11111111-1111-4111-8111-111111111111'});

const presentationFixture=patch=>{
 const input=manager(),row=input.snapshot.records[0];row.kyc={status:'NOT_SUBMITTED',images:[]};
 row.kycChatChallenge={id:'challenge-a',status:'CLAIMED',expiresAt:'2026-10-07T01:30:00.000Z',conversationExpiresAt:'2026-10-07T01:00:00.000Z',expired:false,canPrepare:false,canCancel:true,blockedCode:null,step:'SELFIE',recoveryRequired:false,...patch};
 return {input,row,chat:participantKycChatCapabilities(row,true,now)};
};
for(const status of ['PENDING','CLAIMED'])for(const expired of [false,true])test('chat presentation distinguishes '+status+' canonical expiry '+expired+' without changing capabilities',()=>{
 const f=presentationFixture({status,expired,conversationExpiresAt:status==='PENDING'?null:'2026-10-07T01:00:00.000Z',step:status==='PENDING'?null:'SELFIE'}),before=JSON.stringify(f),view=participantKycChatPresentation(f.chat,now);
 assert.equal(view.state,expired?'EXPIRED':status==='PENDING'?'PREPARED':'IN_PROGRESS');assert.equal(view.label,expired?'plazo vencido':status==='PENDING'?'código preparado':'en curso');
 assert.equal(f.chat.canCancel,true);assert.equal(f.chat.canPrepare,false);assert.equal(action(f.input),'CANCEL_KYC_CHAT');assert.equal(JSON.stringify(f),before);assert.deepEqual(Object.keys(view).sort(),['description','label','state']);
});
for(const patch of [{step:'FINALIZING'},{recoveryRequired:true},{blockedCode:'PARTICIPANT_KYC_CHAT_CONFIRMATION_PENDING'}])test('uncertain confirmation precedes an expired status label '+JSON.stringify(patch),()=>{
 const f=presentationFixture({expired:true,canCancel:false,...patch}),before=JSON.stringify(f),view=participantKycChatPresentation(f.chat,now);
 assert.equal(view.state,'UNCONFIRMED');assert.equal(view.label,'resultado por comprobar');assert.match(view.description,/mismo intento/);assert.equal(f.chat.canCancel,false);assert.equal(f.chat.canPrepare,false);assert.equal(action(f.input),'CONSULT_PARTICIPANTS');assert.equal(JSON.stringify(f),before);
});
for(const status of ['COMPLETED','CANCELLED','CLOSED'])test('terminal '+status+' retains its canonical presentation despite old dates and unknown device clock',()=>{
 const f=presentationFixture({status,expired:true,canCancel:false,conversationExpiresAt:null,expiresAt:'2026-10-06T00:00:00.000Z',step:null}),before=JSON.stringify(f),view=participantKycChatPresentation(f.chat,NaN);
 assert.equal(view.state,status==='COMPLETED'?'SAVED':'CLOSED');assert.equal(view.label,status==='COMPLETED'?'guardada':'cerrada');assert.equal(JSON.stringify(f),before);assert.equal(f.chat.canPrepare,false);assert.equal(f.chat.canCancel,false);
});
for(const clock of [NaN,Infinity,-1,Date.parse('2026-10-07T01:00:00.000Z'),Date.parse('2026-10-07T01:30:00.000Z')])test('unknown or apparently stale local time requests consultation, never canonical expiry '+clock,()=>{
 const f=presentationFixture(),before=JSON.stringify(f),view=participantKycChatPresentation(f.chat,clock);
 assert.equal(view.state,'TIME_UNCONFIRMED');assert.equal(view.label,'plazo por comprobar');assert.equal(f.chat.challenge.expired,false);assert.equal(f.chat.canCancel,true);assert.equal(f.chat.canPrepare,false);assert.equal(JSON.stringify(f),before);
});
test('a stale code date also requests consultation without replacing its PENDING status',()=>{
 const f=presentationFixture({status:'PENDING',conversationExpiresAt:null,step:null,expiresAt:'2026-10-07T00:49:59.999Z'}),before=JSON.stringify(f);
 assert.equal(participantKycChatPresentation(f.chat,now).state,'TIME_UNCONFIRMED');assert.equal(f.chat.challenge.status,'PENDING');assert.equal(JSON.stringify(f),before);
});
test('canonical expiry remains visible when the local clock is behind, with issuer-only closure unchanged',()=>{
 const f=presentationFixture({expired:true,canCancel:false,blockedCode:'PARTICIPANT_KYC_CHAT_ISSUER_REQUIRED'}),before=JSON.stringify(f);
 assert.equal(participantKycChatPresentation(f.chat,0).state,'EXPIRED');assert.equal(f.chat.canCancel,false);assert.equal(f.chat.canPrepare,false);assert.equal(action(f.input),'CONSULT_PARTICIPANTS');assert.equal(JSON.stringify(f),before);
});
test('unobserved and absent challenges have no invented presentation',()=>{
 for(const chat of [undefined,null,{observed:false,challenge:{status:'CLAIMED'}},{observed:true,challenge:null}])assert.equal(participantKycChatPresentation(chat,now),null);
 const f=presentationFixture();f.row.kycChatChallenge.expired='true';assert.equal(participantKycChatPresentation(participantKycChatCapabilities(f.row,true,now),now),null);
});
test('status presentation preserves own web submission versus manager actions and pending operation precedence',()=>{
 for(const expired of [false,true])for(const kycStatus of ['NOT_SUBMITTED','REJECTED']){
  const f=presentationFixture({expired});f.row.kyc.status=kycStatus;f.row.self=true;const before=JSON.stringify(f.input);
  assert.equal(action(f.input),'SUBMIT_KYC');participantKycChatPresentation(f.chat,now);assert.equal(action(f.input),'SUBMIT_KYC');assert.equal(JSON.stringify(f.input),before);
  f.input.pendingReference=pending();assert.equal(action(f.input),'CONSULT_OPERATION');assert.equal(participantOnboardingNextStep(f.input).optionalBank,null);
 }
});
