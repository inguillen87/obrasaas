import test from 'node:test';
import assert from 'node:assert/strict';
import {participantCommand} from '../src/lib/participant-policy.mjs';
import {digest} from '../src/lib/workspace-policy.mjs';
import {PARTICIPANT_ONBOARDING_NOTICE,PARTICIPANT_ONBOARDING_NOTICE_VERSION,PARTICIPANT_ONBOARDING_NOTICE_SHA256,validateParticipantOnboardingChoice,participantOnboardingCapabilities,publicParticipantOnboarding} from '../src/lib/participant-onboarding-policy.mjs';
import {createMetaCustomerProcessor} from '../src/lib/meta-customer-processing.mjs';
import {createParticipantHandlers} from '../src/lib/participant-http.mjs';
const now=new Date('2026-10-07T07:00:00Z'),member={role:'ADMIN',actorId:'actor-one'},scope='a'.repeat(64),revision='2026-10-07T07:00:00.000000';
const consent={confirmed:true,noticeVersion:PARTICIPANT_ONBOARDING_NOTICE_VERSION,noticeSha256:PARTICIPANT_ONBOARDING_NOTICE_SHA256};
const row=()=>({id:'worker-one',active:true,phone:'+5491112345678',revision,metadata:{siteRegister:{version:1},participant:{version:1,status:'INVITED',invitation:{createdBy:member.actorId,state:'SENT',expiresAt:'2026-10-08T07:00:00Z'},kyc:{status:'NOT_SUBMITTED'}}}});
const command=(action,payload)=>({operationId:'11111111-1111-4111-a111-111111111111',projectId:'project-one',scope,action,payload});

test('limited contact consent requires the exact displayed notice and an affirmative choice',()=>{
 assert.equal(PARTICIPANT_ONBOARDING_NOTICE_SHA256,digest(PARTICIPANT_ONBOARDING_NOTICE));assert.deepEqual(validateParticipantOnboardingChoice(consent),consent);
 for(const invalid of [undefined,null,{},false,{...consent,confirmed:false},{...consent,noticeVersion:'other'},{...consent,noticeSha256:'b'.repeat(64)},{...consent,operational:true}])assert.throws(()=>validateParticipantOnboardingChoice(invalid),{code:'PARTICIPANT_ONBOARDING_CONSENT_REQUIRED'});
});
test('existing email invitations remain optional and contact permission is never implied',()=>{
 const payload={workerId:'worker-one',revision,email:'Employee@example.invalid'};
 assert.equal(Object.hasOwn(participantCommand(command('INVITE',payload)).payload,'whatsAppConsent'),false);
 assert.deepEqual(participantCommand(command('INVITE',{...payload,whatsAppConsent:consent})).payload.whatsAppConsent,consent);
 assert.throws(()=>participantCommand(command('INVITE',{...payload,whatsAppConsent:false})),{code:'PARTICIPANT_ONBOARDING_CONSENT_REQUIRED'});
});
test('request and revocation reject hidden recipient, plan or delivery overrides',()=>{
 const request=command('SEND_ONBOARDING_WHATSAPP',{workerId:'worker-one',revision,whatsAppConsent:consent});
 assert.deepEqual(participantCommand(request),request);
 for(const key of ['phone','to','plan','connectionId','template','approved'])assert.throws(()=>participantCommand({...request,payload:{...request.payload,[key]:'controlled'}}),{code:'PARTICIPANT_INPUT_INVALID'});
 const revoke=command('REVOKE_ONBOARDING_CONTACT',{workerId:'worker-one',revision});assert.deepEqual(participantCommand(revoke),revoke);
 assert.throws(()=>participantCommand({...revoke,payload:{...revoke.payload,resend:true}}),{code:'PARTICIPANT_INPUT_INVALID'});
});
test('accepted active participation can request a rejected KYC retry after invitation expiration',()=>{
 const r=row();r.metadata.participant.status='ACTIVE';r.metadata.participant.invitation.state='ACCEPTED';r.metadata.participant.invitation.expiresAt='2026-10-01T07:00:00Z';r.metadata.participant.kyc.status='REJECTED';
 assert.equal(participantOnboardingCapabilities(r,member,{now}).canSendOnboardingWhatsapp,true);
 r.metadata.participant.status='INVITED';r.metadata.participant.invitation.state='SENT';assert.equal(participantOnboardingCapabilities(r,member,{now}).canSendOnboardingWhatsapp,false);
});
test('opened captures, submitted identity and uncertain sends cannot create a new automatic request',()=>{
 for(const status of ['PENDING','CLAIMED']){const r=row();r.metadata.participant.kycChatChallenge={status};assert.equal(participantOnboardingCapabilities(r,member,{now}).canSendOnboardingWhatsapp,false);}
 for(const status of ['PENDING_REVIEW','PENDING_ACCOUNT_CLAIM','APPROVED']){const r=row();r.metadata.participant.kyc.status=status;assert.equal(participantOnboardingCapabilities(r,member,{now}).canSendOnboardingWhatsapp,false);}
 for(const state of ['WAITING_CONFIGURATION','PENDING','BLOCKED','SEND_STARTED','SEND_UNKNOWN']){const r=row();r.metadata.participant.onboardingDelivery={state};assert.equal(participantOnboardingCapabilities(r,member,{now}).canSendOnboardingWhatsapp,false);}
 assert.equal(participantOnboardingCapabilities(row(),member).canSendOnboardingWhatsapp,false);
 assert.equal(participantOnboardingCapabilities(row(),{...member,actorId:'other'},{now}).canSendOnboardingWhatsapp,false);
});
test('public status distinguishes provider acceptance from delivered or read acknowledgement',()=>{
 const p={onboardingConsent:{status:'GRANTED'},onboardingDelivery:{state:'SENT',code:'token-secret',outboundId:'wrong',encryptedPayload:'private'}};
 assert.deepEqual(publicParticipantOnboarding(p),{state:'SENT',contactAuthorized:true,outboundId:null,code:null,providerAccepted:true,deliveryConfirmed:false,providerStatus:null,automaticResendAllowed:false});
 p.onboardingDelivery={state:'STATUS_OBSERVED',providerStatus:'delivered'};assert.equal(publicParticipantOnboarding(p).deliveryConfirmed,true);
 p.onboardingDelivery.providerStatus='failed';assert.equal(publicParticipantOnboarding(p).providerAccepted,false);assert.equal(publicParticipantOnboarding(p).deliveryConfirmed,false);
});
test('the existing signed event wakeup never scans participant requests; the cron recovery does',async()=>{
 const calls=[],connect=async()=>({query:async(sql)=>sql.startsWith('SELECT id FROM public."WebhookEvent"')?{rows:[]}:{rows:[]},release(){}});
 const processor=createMetaCustomerProcessor({connect,dispatch:async()=>{},outbound:{},onboarding:{recover:async input=>{calls.push(input);return {checked:0,results:[]};}}});
 assert.deepEqual(await processor.recover({eventIds:[]}),{durable:true,checked:0,results:[]});assert.equal(calls.length,0);
 const result=await processor.recover({limit:3,budgetMs:210000});assert.equal(calls.length,1);assert.equal(calls[0].limit,3);assert.ok(calls[0].budgetMs>0&&calls[0].budgetMs<=210000);assert.equal(result.onboarding.checked,0);
});

test('immediate wake-up follows a committed contact request and only carries its owned worker reference',async()=>{
 const order=[],session={authenticated:true,verification:'clerk-production-jwt',userId:'user_Owner',organizationId:'org_One',organizationRole:'org:admin'};
 const body=command('SEND_ONBOARDING_WHATSAPP',{workerId:'worker-one',revision,whatsAppConsent:consent}),saved={saved:true,replayed:false,participant:{id:'worker-one',invitation:{state:'SENT'},onboardingDelivery:{contactAuthorized:true}}};
 const request=()=>new Request('https://obrasaas.com/api/identity/participants',{method:'POST',headers:{Origin:'https://obrasaas.com','Content-Type':'application/json'},body:JSON.stringify(body)});
 const handlers=createParticipantHandlers({verify:async()=>session,store:{save:async()=>{order.push('committed');return saved;}},scheduleOnboarding:ref=>{order.push(ref);throw new Error('controlled wake-up failure');}});
 assert.equal((await handlers.POST(request())).status,200);assert.deepEqual(order,['committed',{projectId:'project-one',workerId:'worker-one'}]);
 for(const change of [{replayed:true},{saved:false},{participant:{...saved.participant,id:'different-worker'}},{participant:{...saved.participant,invitation:{state:'UNCERTAIN'}}},{participant:{...saved.participant,onboardingDelivery:{contactAuthorized:false}}}]){
  let calls=0;const h=createParticipantHandlers({verify:async()=>session,store:{save:async()=>({...saved,...change})},scheduleOnboarding:()=>{calls++;}});await h.POST(request());assert.equal(calls,0);
 }
});
