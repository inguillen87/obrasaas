import test from 'node:test';import assert from 'node:assert/strict';
import {onboardingDeliveryFixture} from './fixtures/participant-onboarding-delivery-memory.mjs';
import {decryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {createMetaCustomerOutbound,customerJobTransaction} from '../src/lib/meta-customer-outbound.mjs';
import {readParticipantOnboardingStatuses} from '../src/lib/participant-onboarding-delivery.mjs';
import {publicParticipantOnboarding} from '../src/lib/participant-onboarding-policy.mjs';
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
