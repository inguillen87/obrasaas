import test from 'node:test';import assert from 'node:assert/strict';
// Original v1 outbox contract cases retain their assertions under an explicitly
// legacy ACTIVE fixture. Current pre-account/two-phase behavior is tested below.
import {legacyOnboardingDeliveryFixture as onboardingDeliveryFixture,onboardingDeliveryFixture as currentOnboardingDeliveryFixture} from './fixtures/participant-onboarding-delivery-memory.mjs';
import {decryptCustomerSecret,encryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {digest} from '../src/lib/workspace-policy.mjs';
import {createMetaCustomerOutbound,customerJobTransaction} from '../src/lib/meta-customer-outbound.mjs';
import {readParticipantOnboardingStatuses} from '../src/lib/participant-onboarding-delivery.mjs';
import {publicParticipantOnboarding,participantOnboardingIntent,participantOnboardingOutboundId,participantOnboardingPhaseOutboundId,revokeParticipantOnboardingPhases} from '../src/lib/participant-onboarding-policy.mjs';
const challengeCode='IDENTIDAD '+'a'.repeat(43);

test('one delivery uses existing encrypted outbox under A, retaining worker B and a safe navigation link',async()=>{
 const f=onboardingDeliveryFixture(),result=await f.service.process(f.reference);assert.equal(result.state,'SENT');assert.equal(result.providerAccepted,true);assert.equal(result.deliveryConfirmed,false);assert.equal(f.prepares,1);assert.equal(f.calls.length,1);
 const stored=[...f.events.values()][0];assert.equal(stored.projectId,'project-a');assert.equal(stored.payload.targetProjectId,'project-b');assert.ok(!JSON.stringify(stored).includes(challengeCode));assert.ok(!JSON.stringify(result).includes(challengeCode));assert.ok(!JSON.stringify(f.worker).includes(challengeCode));
 assert.equal(f.calls[0].message.bodyParameters[1],'https://obrasaas.com/cuenta?participar='+f.intent.invitationId);assert.equal(f.calls[0].message.bodyParameters[2],challengeCode);assert.equal(f.calls[0].correlationId,stored.id);
 const context={organizationId:f.intent.organizationId,projectId:'project-a',purpose:'outbound',resourceId:stored.id};assert.equal(JSON.parse(decryptCustomerSecret(stored.payload.encryptedPayload,context,f.environment)).message.bodyParameters[2],challengeCode);assert.throws(()=>decryptCustomerSecret(stored.payload.encryptedPayload,{...context,projectId:'project-b'},f.environment));
 const again=await f.service.process(f.reference);assert.equal(again.state,'SENT');assert.equal(f.calls.length,1);assert.equal(f.prepares,1);
});
test('a crash before dispatch preserves the code and retries only the unsent queue record',async()=>{
 let first=true;const f=onboardingDeliveryFixture({afterPrepare:async()=>{if(first){first=false;throw new Error('controlled predispatch crash');}}});
 assert.equal((await f.service.process(f.reference)).state,'BLOCKED');assert.equal([...f.events.values()][0].outcome.state,'ONBOARDING_PENDING');assert.equal(f.calls.length,0);const cipher=[...f.events.values()][0].payload.encryptedPayload;
 assert.equal((await f.service.process(f.reference)).state,'SENT');assert.equal(f.prepares,1);assert.equal(f.calls.length,1);assert.equal([...f.events.values()][0].payload.encryptedPayload,cipher);
});
test('a crash after the committed dispatch marker never permits another automatic POST',async()=>{
 const f=onboardingDeliveryFixture({afterDispatchMarker:async()=>{throw new Error('controlled crash after marker');}});assert.equal((await f.service.process(f.reference)).state,'SEND_STARTED');assert.equal(f.calls.length,0);assert.equal((await f.service.process(f.reference)).state,'SEND_STARTED');assert.equal(f.calls.length,0);assert.equal([...f.events.values()][0].outcome.state,'SEND_STARTED');
});
for(const mode of ['timeout','invalid','reject'])test('provider '+mode+' remains distinct from delivery confirmation and is never automatically resent',async()=>{
 const f=onboardingDeliveryFixture();f.providerMode=mode;const r=await f.service.process(f.reference);assert.equal(r.state,mode==='reject'?'REJECTED':'SEND_UNKNOWN');assert.equal(r.providerAccepted,false);assert.equal(r.deliveryConfirmed,false);await f.service.process(f.reference);assert.equal(f.calls.length,1);
});
test('lost database commit after provider acceptance retains uncertainty without a duplicate POST',async()=>{
 const f=onboardingDeliveryFixture();f.failCommitAfterSend=true;const r=await f.service.process(f.reference);assert.equal(r.state,'SEND_STARTED');assert.equal(f.calls.length,1);await f.service.process(f.reference);assert.equal(f.calls.length,1);assert.equal([...f.events.values()][0].outcome.state,'SEND_STARTED');
});
test('concurrent processors create one challenge and only one provider submission',async()=>{
 const f=onboardingDeliveryFixture();await Promise.all([f.service.process(f.reference),f.service.process(f.reference)]);assert.equal(f.prepares,1);assert.equal(f.events.size,1);assert.equal(f.calls.length,1);assert.equal([...f.events.values()][0].outcome.state,'SENT');
});
for(const change of ['consent','authority','expiry','closure','template'])test(change+' changed after preparation blocks the original envelope without replacing the code',async()=>{
 let f;f=onboardingDeliveryFixture({afterPrepare:async()=>{if(change==='consent')f.worker.metadata.participant.onboardingConsent.status='REVOKED';if(change==='authority')f.authority='b'.repeat(64);if(change==='expiry')f.now=new Date(f.now.getTime()+86400000);if(change==='closure')f.worker.metadata.participant.kycChatChallenge.status='CANCELED';if(change==='template')f.remoteStatus='REJECTED';}});
 const r=await f.service.process(f.reference);assert.equal(r.state,'BLOCKED');assert.equal(f.prepares,1);assert.equal(f.events.size,1);assert.equal(f.calls.length,0);const codeDigest=f.worker.metadata.participant.kycChatChallenge.codeDigest;await f.service.process(f.reference);assert.equal(f.prepares,1);assert.equal(f.calls.length,0);assert.equal(f.worker.metadata.participant.kycChatChallenge.codeDigest,codeDigest);
});
test('closed provider transport creates neither challenge nor outbox',async()=>{const f=onboardingDeliveryFixture();f.transport=false;const r=await f.service.process(f.reference);assert.equal(r.code,'PARTICIPANT_ONBOARDING_PROVIDER_CLOSED');assert.equal(f.prepares,0);assert.equal(f.events.size,0);});
test('template pending approval creates neither challenge nor outbox',async()=>{const f=onboardingDeliveryFixture();f.remoteStatus='PENDING';assert.equal((await f.service.process(f.reference)).state,'BLOCKED');assert.equal(f.prepares,0);assert.equal(f.events.size,0);});
test('status callback before the dispatch marker is ignored; signed delivered callback after send is correlated',async()=>{
 let first=true;const f=onboardingDeliveryFixture({afterPrepare:async()=>{if(first){first=false;throw new Error('pause');}}});await f.service.process(f.reference);const e=[...f.events.values()][0],outbound=createMetaCustomerOutbound({connect:f.connect,resolveIdentity:async()=>{},provider:f.provider,environment:f.environment});
 const args={event:{id:'status-event',projectId:'project-a',payload:{signatureVerified:true}},channel:{id:f.connection.id,organizationId:f.intent.organizationId},payload:{type:'message_status',value:{biz_opaque_callback_data:e.id,recipient_id:f.worker.phone.slice(1),id:'wamid.controlledMessage0123456789',status:'delivered'}}};
 assert.equal((await customerJobTransaction(f.connect,client=>outbound.observeStatus(client,args))).correlated,false);await f.service.process(f.reference);assert.equal((await customerJobTransaction(f.connect,client=>outbound.observeStatus(client,args))).correlated,true);
 const rows=[structuredClone(f.worker)];await customerJobTransaction(f.connect,client=>readParticipantOnboardingStatuses(client,rows,f.intent.organizationId,'project-b'));assert.equal(publicParticipantOnboarding(rows[0].metadata.participant).deliveryConfirmed,true);assert.equal(f.calls.length,1);
});
test('outbox from another target or consent is never projected into a participant DTO',async()=>{const f=onboardingDeliveryFixture();await f.service.process(f.reference);const e=[...f.events.values()][0];e.payload.targetProjectId='project-other';e.outcome.providerStatus='delivered';e.outcome.state='STATUS_OBSERVED';const rows=[structuredClone(f.worker)];await customerJobTransaction(f.connect,client=>readParticipantOnboardingStatuses(client,rows,f.intent.organizationId,'project-b'));assert.equal(publicParticipantOnboarding(rows[0].metadata.participant).deliveryConfirmed,false);});
test('recovery budget below a possible operation performs no scan or provider work',async()=>{const f=onboardingDeliveryFixture();assert.equal((await f.service.recover({budgetMs:0})).checked,0);assert.equal(f.queries.length,0);});

test('failed outbox insertion rolls back the challenge and exterior receipt together',async()=>{
 const f=onboardingDeliveryFixture();f.failQueueInsert=true;
 assert.equal((await f.service.process(f.reference)).state,'BLOCKED');
 assert.equal(f.worker.metadata.participant.kycChatChallenge,undefined);
 assert.equal(f.events.size,0);assert.equal(f.audits.size,0);assert.equal(f.calls.length,0);
 f.failQueueInsert=false;assert.equal((await f.service.process(f.reference)).state,'SENT');
 assert.equal(f.calls.length,1);assert.equal(f.audits.size,1);
});

test('automatic preparation preserves the exterior receipt required to accept an invited account',async()=>{
 const f=onboardingDeliveryFixture();await f.service.process(f.reference);
 const audit=[...f.audits.values()][0],challenge=f.worker.metadata.participant.kycChatChallenge;
 assert.equal(audit.organizationId,f.intent.organizationId);assert.equal(audit.actorId,f.intent.issuerActorId);assert.equal(audit.entityId,f.worker.id);
 assert.equal(audit.metadata.projectId,f.worker.projectId);assert.equal(audit.metadata.kind,'PREPARE_KYC_CHAT');assert.equal(audit.metadata.challengeReceiptId,'meta_kyc_challenge_'+'4'.repeat(64));assert.equal(audit.metadata.expiresAt,challenge.expiresAt);assert.match(audit.metadata.requestDigest,/^[a-f0-9]{64}$/);
 assert.equal(audit.metadata.identityCertified,false);assert.equal(audit.metadata.permissionsGranted,false);
 assert.equal(JSON.stringify(audit).includes('IDENTIDAD '),false);
});

test('a withdrawn unsent request remains canceled in reads even while its encrypted envelope is retained',async()=>{
 const f=onboardingDeliveryFixture({afterPrepare:async()=>{throw new Error('controlled pause');}});await f.service.process(f.reference);
 f.worker.metadata.participant.onboardingConsent.status='REVOKED';f.worker.metadata.participant.onboardingDelivery.state='CANCELED';
 const rows=[structuredClone(f.worker)];await customerJobTransaction(f.connect,client=>readParticipantOnboardingStatuses(client,rows,f.intent.organizationId,'project-b'));
 assert.equal(publicParticipantOnboarding(rows[0].metadata.participant).state,'CANCELED');assert.equal(publicParticipantOnboarding(rows[0].metadata.participant).contactAuthorized,false);
 await f.service.process(f.reference);assert.equal(f.calls.length,0);assert.equal(f.prepares,1);
});

test('current INVITED delivery sends only the owned invitation and creates no identity challenge',async()=>{
 const f=currentOnboardingDeliveryFixture(),before=structuredClone(f.worker.metadata.participant),result=await f.service.process(f.reference);
 assert.equal(result.state,'SENT');assert.equal(result.phase,'ACCOUNT_INVITATION');assert.equal(result.invitationState,'SENT');assert.equal(result.identityState,'WAITING_ACCOUNT_ACCEPTANCE');
 assert.equal(f.prepares,0);assert.equal(f.calls.length,1);assert.equal(f.audits.size,0);assert.equal(f.worker.metadata.participant.status,'INVITED');assert.equal(f.worker.metadata.participant.clerkUserId,null);assert.equal(f.worker.metadata.participant.kycChatChallenge,undefined);assert.deepEqual(f.worker.metadata.participant.kyc,before.kyc);
 assert.equal(f.calls[0].message.bodyParameters.length,1);assert.match(f.calls[0].message.name,/^obrasaas_participant_invitation_/);assert.deepEqual(f.calls[0].message.bodyParameters,[f.member.organizationName]);
 const e=[...f.events.values()][0],intent=participantOnboardingIntent(f.worker.metadata.participant.onboardingDelivery);assert.equal(e.id,participantOnboardingPhaseOutboundId(intent,'ACCOUNT_INVITATION'));assert.equal(e.payload.onboardingPhase,'ACCOUNT_INVITATION');assert.equal(Object.hasOwn(e.payload,'challengeId'),false);
 const request=JSON.parse(decryptCustomerSecret(e.payload.encryptedPayload,{organizationId:intent.organizationId,projectId:e.projectId,purpose:'outbound',resourceId:e.id},f.environment));assert.equal(request.version,2);assert.equal(request.phase,'ACCOUNT_INVITATION');assert.equal(Object.hasOwn(request,'challengeId'),false);assert.equal(JSON.stringify(request).includes('IDENTIDAD '),false);assert.equal(JSON.stringify(result).includes('IDENTIDAD '),false);
 await f.service.process(f.reference);assert.equal(f.calls.length,1);assert.equal(f.prepares,0);
});

test('a newly consented invitation preserves closed KYC history while any live or finalizing capture stays blocked',async()=>{
 for(const status of ['CANCELLED','CLOSED']){const f=currentOnboardingDeliveryFixture();f.worker.metadata.participant.kycChatChallenge={version:1,id:'kyc_chat_'+'7'.repeat(32),status,closureReceiptId:'closure-a',cancelledAt:'2026-10-01T00:00:00.000Z'};f.worker.metadata.participant.kycChatConversation=null;const history=JSON.stringify(f.worker.metadata.participant.kycChatChallenge),result=await f.service.process(f.reference);assert.equal(result.state,'SENT');assert.equal(result.phase,'ACCOUNT_INVITATION');assert.equal(f.prepares,0);assert.equal(f.calls.length,1);assert.equal(f.calls[0].message.bodyParameters.length,1);assert.equal(JSON.stringify(f.worker.metadata.participant.kycChatChallenge),history);assert.equal(f.worker.metadata.participant.kycChatConversation,null);}
 for(const change of [p=>{p.kycChatChallenge={status:'PENDING'};},p=>{p.kycChatChallenge={status:'CLAIMED'};},p=>{p.kycChatChallenge={status:'CANCELLED'};p.kycChatConversation={step:'FINALIZING',confirmationEventId:'confirmed-a'};},p=>{p.kycChatChallenge={status:'UNKNOWN'};}]){const f=currentOnboardingDeliveryFixture();change(f.worker.metadata.participant);const before=JSON.stringify([f.worker.metadata.participant.kycChatChallenge,f.worker.metadata.participant.kycChatConversation]);assert.equal((await f.service.process(f.reference)).state,'BLOCKED');assert.equal(f.calls.length,0);assert.equal(f.prepares,0);assert.equal(JSON.stringify([f.worker.metadata.participant.kycChatChallenge,f.worker.metadata.participant.kycChatConversation]),before);}
});

test('a committed account transition leaves a durable distinct identity phase with one POST per phase',async()=>{
 const f=currentOnboardingDeliveryFixture();await f.service.process(f.reference);const invitation=[...f.events.values()][0],cipher=invitation.payload.encryptedPayload;
 assert.equal(f.acceptAccountInFixture(),true);const pending=structuredClone(f.worker.metadata.participant.onboardingDelivery);assert.equal(pending.phase,'IDENTITY_START');assert.equal(pending.state,'WAITING_CONFIGURATION');assert.equal(pending.phases.ACCOUNT_INVITATION.state,'SENT');assert.equal(f.prepares,0);assert.equal(f.calls.length,1);
 const result=await f.service.process(f.reference);assert.equal(result.state,'SENT');assert.equal(result.phase,'IDENTITY_START');assert.equal(result.invitationState,'SENT');assert.equal(result.identityState,'SENT');assert.equal(f.prepares,1);assert.equal(f.calls.length,2);assert.equal(f.events.size,2);
 const challenge=f.worker.metadata.participant.kycChatChallenge;assert.equal(challenge.analysisConsentVersion,3);assert.equal(challenge.participantClerkUserId,'user_Current');assert.equal(f.worker.metadata.participant.status,'ACTIVE');
 const identity=[...f.events.values()].find(e=>e.payload.onboardingPhase==='IDENTITY_START');assert.ok(identity);assert.notEqual(identity.id,invitation.id);assert.notEqual(identity.payload.requestDigest,invitation.payload.requestDigest);assert.equal(invitation.payload.encryptedPayload,cipher);assert.equal(f.calls.filter(call=>call.correlationId===invitation.id).length,1);assert.equal(f.calls.filter(call=>call.correlationId===identity.id).length,1);assert.equal(f.calls[1].message.bodyParameters.length,3);
 assert.throws(()=>decryptCustomerSecret(identity.payload.encryptedPayload,{organizationId:f.intent.organizationId,projectId:identity.projectId,purpose:'outbound',resourceId:invitation.id},f.environment));
 await f.service.process(f.reference);assert.equal(f.calls.length,2);assert.equal(f.prepares,1);
});

test('each missing exact template blocks only its own phase before challenge or POST',async()=>{
 const initial=currentOnboardingDeliveryFixture();delete initial.connection.metadata.customerTemplateDrafts.participant_invitation;const blocked=await initial.service.process(initial.reference);assert.equal(blocked.state,'BLOCKED');assert.equal(blocked.phase,'ACCOUNT_INVITATION');assert.equal(blocked.code,'PARTICIPANT_ONBOARDING_TEMPLATE_APPROVAL_REQUIRED');assert.equal(initial.prepares,0);assert.equal(initial.calls.length,0);assert.equal(initial.events.size,0);
 const f=currentOnboardingDeliveryFixture();await f.service.process(f.reference);assert.equal(f.acceptAccountInFixture(),true);f.connection.metadata.customerTemplateDrafts.participant_onboarding_v1.providerStatus='PENDING';const result=await f.service.process(f.reference);assert.equal(result.state,'BLOCKED');assert.equal(result.phase,'IDENTITY_START');assert.equal(result.invitationState,'SENT');assert.equal(result.code,'PARTICIPANT_ONBOARDING_TEMPLATE_APPROVAL_REQUIRED');assert.equal(f.prepares,0);assert.equal(f.calls.length,1);assert.equal(f.events.size,1);
});

test('JOIN after the old phase marker cannot restore its selection or overwrite pending identity',async()=>{
 let f;f=currentOnboardingDeliveryFixture({afterDispatchMarker:async()=>{assert.equal(f.acceptAccountInFixture(),true);}});const result=await f.service.process(f.reference),d=f.worker.metadata.participant.onboardingDelivery,old=[...f.events.values()][0];
 assert.equal(f.calls.length,0);assert.equal(old.outcome.state,'SEND_STARTED');assert.equal(d.phases.ACCOUNT_INVITATION.state,'SEND_STARTED');assert.equal(d.phase,'IDENTITY_START');assert.equal(d.state,'WAITING_CONFIGURATION');assert.equal(result.phase,'IDENTITY_START');assert.equal(f.prepares,0);
 f.worker.metadata.participant.onboardingConsent.status='REVOKED';f.worker.metadata.participant.onboardingDelivery=revokeParticipantOnboardingPhases(d);await f.service.process(f.reference);
 assert.equal(f.worker.metadata.participant.onboardingDelivery.phase,'IDENTITY_START');assert.equal(f.worker.metadata.participant.onboardingDelivery.state,'CANCELED');assert.equal(f.worker.metadata.participant.onboardingDelivery.phases.ACCOUNT_INVITATION.state,'SEND_STARTED');assert.equal(old.outcome.state,'SEND_STARTED');assert.equal(f.calls.length,0);
});

test('uncertain invitation status remains separate from a pending or canceled identity phase',async()=>{
 const f=currentOnboardingDeliveryFixture();f.providerMode='timeout';await f.service.process(f.reference);assert.equal(f.calls.length,1);assert.equal(f.worker.metadata.participant.onboardingDelivery.state,'SEND_UNKNOWN');assert.equal(f.acceptAccountInFixture(),true);
 const rows=[structuredClone(f.worker)];await customerJobTransaction(f.connect,client=>readParticipantOnboardingStatuses(client,rows,f.intent.organizationId,'project-b'));const dto=publicParticipantOnboarding(rows[0].metadata.participant);assert.equal(dto.phase,'IDENTITY_START');assert.equal(dto.state,'WAITING_CONFIGURATION');assert.equal(dto.invitationState,'SEND_UNKNOWN');assert.equal(dto.identityState,'WAITING_CONFIGURATION');assert.equal(dto.providerAccepted,false);assert.equal(dto.automaticResendAllowed,false);
 f.worker.metadata.participant.onboardingConsent.status='REVOKED';f.worker.metadata.participant.onboardingDelivery=revokeParticipantOnboardingPhases(f.worker.metadata.participant.onboardingDelivery);await f.service.process(f.reference);assert.equal(f.calls.length,1);assert.equal(f.prepares,0);assert.equal([...f.events.values()][0].outcome.state,'SEND_UNKNOWN');
});

test('an old v1 marker under a previous anchor prevents migration and any new POST',async()=>{
 const f=currentOnboardingDeliveryFixture(),d=f.worker.metadata.participant.onboardingDelivery;delete d.deliveryVersion;delete d.phase;delete d.phases;const id=participantOnboardingOutboundId(participantOnboardingIntent(d)),old={id,projectId:'former-anchor',payload:{participantOnboarding:true},outcome:{state:'SEND_UNKNOWN'},leaseToken:null};f.events.set(id,structuredClone(old));
 await f.service.process(f.reference);assert.equal(f.worker.metadata.participant.onboardingDelivery.deliveryVersion,undefined);assert.deepEqual(f.events.get(id),old);assert.equal(f.calls.length,0);assert.equal(f.prepares,0);assert.ok(f.queries.some(q=>q.sql.includes('SELECT id FROM public."WebhookEvent"')&&q.args.length===1&&q.args[0]===id));
});

test('even a closed historical challenge prevents automatic migration of an old invitation request',async()=>{
 const f=currentOnboardingDeliveryFixture(),d=f.worker.metadata.participant.onboardingDelivery;delete d.deliveryVersion;delete d.phase;delete d.phases;f.worker.metadata.participant.kycChatChallenge={version:1,id:'kyc_chat_'+'8'.repeat(32),status:'CLOSED',expiresAt:'2020-01-01T00:00:00.000Z'};const before=JSON.stringify(f.worker.metadata.participant.kycChatChallenge);
 await f.service.process(f.reference);assert.equal(f.worker.metadata.participant.onboardingDelivery.deliveryVersion,undefined);assert.equal(JSON.stringify(f.worker.metadata.participant.kycChatChallenge),before);assert.equal(f.calls.length,0);assert.equal(f.prepares,0);assert.equal(f.events.size,0);
});

test('changing either phase tag on a sealed pending envelope cannot reclassify its message',async()=>{
 for(const change of ['payload','request']){
  const f=currentOnboardingDeliveryFixture({afterPrepare:async()=>{throw new Error('controlled pending phase');}});await f.service.process(f.reference);const e=[...f.events.values()][0];assert.equal(e.outcome.state,'ONBOARDING_PENDING');
  if(change==='payload')e.payload.onboardingPhase='IDENTITY_START';else{const context={organizationId:f.intent.organizationId,projectId:e.projectId,purpose:'outbound',resourceId:e.id},request=JSON.parse(decryptCustomerSecret(e.payload.encryptedPayload,context,f.environment));request.phase='IDENTITY_START';e.payload.encryptedPayload=encryptCustomerSecret(JSON.stringify(request),context,f.environment);e.payload.requestDigest=digest(request);}
  await f.service.process(f.reference);assert.equal(f.calls.length,0);assert.equal(f.prepares,0);assert.equal(e.outcome.state,'ONBOARDING_PENDING');
 }
});
