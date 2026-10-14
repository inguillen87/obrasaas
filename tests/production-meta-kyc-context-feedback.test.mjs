import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {contextFeedbackFixture,unchangedMedia,rewriteContextEvent} from './fixtures/meta-kyc-context-feedback-memory.mjs';
import {createMetaKycContextFeedback,META_KYC_CONTEXT_REPLY,metaKycContextReceiptId} from '../src/lib/meta-kyc-context-feedback.mjs';
import {metaKycContextAuthorityDigest,resolveMetaKycAuthority,resolveMetaKycContextFeedbackAuthority,META_KYC_AUTHORIZATION_CODES} from '../src/lib/meta-kyc-identity.mjs';
import {prepareKycContextOutboundSnapshot,fenceKycContextOutboundSnapshot,releaseKycContextOutboundSnapshot} from '../src/lib/meta-kyc-context-outbound.mjs';
import {customerOutboundId} from '../src/lib/meta-customer-outbound.mjs';
import {createMetaCustomerProcessor} from '../src/lib/meta-customer-processing.mjs';

for(const kind of ['PROJECT','COMPANY'])for(const active of [false,true])for(const expired of [false,true])test(`${kind} ${active?'ACTIVE':'INVITED'} ${expired?'expired':'live'} prior consent button gets one text feedback with full private state unchanged`,async()=>{
 const t=await contextFeedbackFixture(kind,{active,expired}),before=structuredClone(t.f.worker),audits=structuredClone([...t.f.audits]);
 const receipt=await t.adapter.feedback(t.context,{staleOnly:true});assert.equal(receipt.kind,'KYC_CONTEXT_FEEDBACK');assert.deepEqual(receipt.reply,META_KYC_CONTEXT_REPLY);assert.equal(receipt.businessApplied,false);assert.equal(receipt.reply.type,'text');assert.equal(t.requests.length,0);
 assert.equal((await t.adapter.send(t.context,receipt.reply)).state,'SENT');assert.equal(t.requests.length,1);assert.deepEqual(t.f.worker,before);unchangedMedia(t.f);for(const [id,a]of audits)assert.deepEqual(t.f.audits.get(id),a);
 assert.deepEqual(await t.adapter.feedback(t.context,{recoverOnly:true}),receipt);assert.equal((await t.adapter.send(t.context,receipt.reply)).replayed,true);assert.equal(t.requests.length,1);
 assert.throws(()=>metaKycContextAuthorityDigest(awaitedClient(t),{kind:'KYC_CONTEXT_FEEDBACK_REPLY'},t.context),{code:'META_KYC_CONTEXT_FEEDBACK_DENIED'});
});
const awaitedClient=t=>({query:t.f.query});

for(const kind of ['PROJECT','COMPANY'])for(const text of ['ESTADO','ESTADO IDENTIDAD'])test(`${kind} neutral ${text} replying to expired original prompt gets feedback without choosing consent`,async()=>{
 const t=await contextFeedbackFixture(kind,{expired:true,stale:false,text}),before=structuredClone(t.f.worker),receipt=await t.adapter.feedback(t.context,{code:'META_KYC_CHALLENGE_EXPIRED'});
 assert.deepEqual(receipt.reply,META_KYC_CONTEXT_REPLY);await t.adapter.send(t.context,receipt.reply);assert.deepEqual(t.f.worker,before);assert.equal(t.f.worker.metadata.participant.kyc.status,'NOT_SUBMITTED');assert.equal(t.f.state().consent,false);unchangedMedia(t.f);
});

const denials=[
 ['foreign sender',t=>rewriteContextEvent(t,p=>{p.value.from='5491100009999';})],
 ['missing context',t=>rewriteContextEvent(t,p=>{delete p.value.context;})],
 ['foreign context',t=>rewriteContextEvent(t,p=>{p.value.context.id='wamid.ForeignSyntheticContext';})],
 ['forged nonce',t=>rewriteContextEvent(t,p=>{p.value.interactive.list_reply.id='kyc:'+'0'.repeat(20)+':0';})],
 ['current nonce on old source',t=>rewriteContextEvent(t,p=>{p.value.interactive.list_reply.id='kyc:'+t.f.state().nonce+':0';})],
 ['absent selected row',t=>rewriteContextEvent(t,p=>{p.value.interactive.list_reply.id=p.value.interactive.list_reply.id.replace(/:0$/,':9');})],
 ['absent selection',t=>rewriteContextEvent(t,p=>{delete p.value.interactive.list_reply;})],
 ['unrelated text',t=>rewriteContextEvent(t,p=>{p.value.type='text';delete p.value.interactive;p.value.text={body:'HOLA'};})],
 ['old current challenge',t=>{t.f.worker.metadata.participant.kycChatChallenge.id='kyc_chat_'+randomUUID().replaceAll('-','');}],
 ['issuer revoked',t=>{t.f.controls.issuerActive=false;}],
 ['participant revoked',t=>{t.f.controls.workerMembershipActive=false;}],
 ['project assignment revoked',t=>{t.f.controls.projectAssignmentActive=false;}],
 ['project inactive',t=>{t.f.controls.projectActive=false;}],
 ['lease expired',t=>{t.f.events.get(t.context.eventId).leaseExpiresAt=new Date(t.f.now.getTime()-1);}],
 ['unsigned source',t=>{[...t.f.events.values()][0].payload.encryptedProof=null;}],
 ['unsigned inbound',t=>{t.f.events.get(t.context.eventId).payload.encryptedProof=null;}],
 ['event source substituted',t=>{t.f.events.get(t.context.eventId).externalId='0'.repeat(64);}],
 ['new submission',t=>{t.f.worker.metadata.participant.kyc.status='PENDING_REVIEW';}],
 ['confirmed capture',t=>{t.f.worker.metadata.participant.kycChatChallenge.confirmationEventId=t.context.eventId;}],
 ['uncertain original outbound',t=>{[...t.f.outbounds.values()][0].outcome.state='SEND_UNKNOWN';}],
 ['failed original outbound',t=>{[...t.f.outbounds.values()][0].outcome.providerStatus='failed';}],
 ['foreign worker phone',t=>{t.f.worker.phone='+5491100007777';}],
 ['foreign project',t=>{t.context.projectId='foreign-project';}],
 ['foreign channel',t=>{t.context.channelId='foreign-channel';}],
 ['credential grant changed',t=>{t.f.connection.metadata.customerVerification.expiresAt=new Date(t.f.now.getTime()-1).toISOString();}],
];
for(const kind of ['PROJECT','COMPANY'])for(const [name,mutate]of denials)test(`${kind} denies ${name} without reply reservation capture or private state change`,async()=>{
 const t=await contextFeedbackFixture(kind);mutate(t);const before=structuredClone(t.f.worker),audits=structuredClone([...t.f.audits]),outbounds=structuredClone([...t.f.outbounds]);assert.equal(await t.adapter.feedback(t.context,{staleOnly:true}),null);assert.deepEqual(t.f.worker,before);assert.deepEqual([...t.f.audits],audits);assert.deepEqual([...t.f.outbounds],outbounds);assert.equal(t.requests.length,0);unchangedMedia(t.f);
});

for(const kind of ['PROJECT','COMPANY'])test(kind+' current live source bypasses feedback and preserves strict capture authority',async()=>{
 const t=await contextFeedbackFixture(kind,{stale:false}),before=structuredClone(t.f.worker);assert.equal(await t.adapter.feedback(t.context,{staleOnly:true}),null);assert.deepEqual(t.f.worker,before);const result=await t.f.bridge.execute(t.context);assert.equal(result.kind,'KYC_CHAT');assert.equal(t.f.state().consent,true);assert.equal(t.f.state().step,'BACK_CONSENT');
});
for(const kind of ['PROJECT','COMPANY'])test(kind+' stale image yields text without Graph CDN Blob or capture',async()=>{
 const t=await contextFeedbackFixture(kind);rewriteContextEvent(t,p=>{p.value.type='image';delete p.value.interactive;p.value.image={id:'150000011',mime_type:'image/png'};});const before=structuredClone(t.f.worker),receipt=await t.adapter.feedback(t.context,{staleOnly:true});await t.adapter.send(t.context,receipt.reply);assert.deepEqual(t.f.worker,before);unchangedMedia(t.f);assert.doesNotMatch(JSON.stringify(receipt),/150000011|front|selfie|kyc_chat_/);
});
for(const kind of ['PROJECT','COMPANY'])test(kind+' original provider status can progress during reservation without changing reply authority',async()=>{
 const t=await contextFeedbackFixture(kind,{afterReserve:({f})=>{const out=[...f.outbounds.values()][0];out.outcome.state='STATUS_OBSERVED';out.outcome.providerStatus='read';}}),receipt=await t.adapter.feedback(t.context,{staleOnly:true});await t.adapter.send(t.context,receipt.reply);assert.equal(t.requests.length,1);
});
for(const kind of ['PROJECT','COMPANY'])test(kind+' lost HTTP ACK remains SEND_UNKNOWN and replay never repeats POST',async()=>{
 const t=await contextFeedbackFixture(kind),receipt=await t.adapter.feedback(t.context,{staleOnly:true});t.controls.loseAck=true;const sent=await t.adapter.send(t.context,receipt.reply);assert.equal(sent.state,'SEND_UNKNOWN');assert.equal((await t.adapter.send(t.context,receipt.reply)).replayed,true);assert.equal(t.requests.length,1);t.f.now.setTime(t.f.now.getTime()+25*3600000);t.f.events.get(t.context.eventId).leaseExpiresAt=new Date(t.f.now.getTime()+60000);const observed=await t.adapter.feedback(t.context,{recoverOnly:true});assert.equal(observed.reply,undefined);assert.equal(observed.replyState,'SEND_UNKNOWN');assert.equal(t.requests.length,1);
});
for(const kind of ['PROJECT','COMPANY'])for(const cause of ['issuer','participant','assignment','credential','original-failed'])test(`${kind} final provider fence denies ${cause} after earlier await with SEND_STARTED and no HTTP`,async()=>{
 let f;const t=await contextFeedbackFixture(kind,{providerAfterFirstFence:()=>{if(cause==='issuer')f.controls.issuerActive=false;else if(cause==='participant')f.controls.workerMembershipActive=false;else if(cause==='assignment')f.controls.projectAssignmentActive=false;else if(cause==='credential')f.connection.encryptedAccessToken='replaced-ciphertext';else [...f.outbounds.values()][0].outcome.providerStatus='failed';}});f=t.f;const before=structuredClone(f.worker),receipt=await t.adapter.feedback(t.context,{staleOnly:true});await assert.rejects(t.adapter.send(t.context,receipt.reply));assert.equal(t.requests.length,0);assert.deepEqual(f.worker,before);
 // A provider observation committed independently survives our send rollback.
 // This SQL fixture snapshots maps wholesale, so restore that external fact.
 if(cause==='original-failed')[...f.outbounds.values()][0].outcome.providerStatus='failed';
 const observation=await t.adapter.feedback(t.context,{recoverOnly:true});assert.equal(observation.reply,undefined);assert.equal(observation.replyState,'SEND_STARTED');unchangedMedia(f);
});
for(const kind of ['PROJECT','COMPANY'])for(const mode of ['ROLLBACK','LOST_ACK'])test(`${kind} receipt COMMIT ${mode} recovers durable truth without replacing the capture`,async()=>{
 const t=await contextFeedbackFixture(kind),before=structuredClone(t.f.worker);t.controls.commitOutcome=mode;await assert.rejects(t.adapter.feedback(t.context,{staleOnly:true}));const previous=await t.adapter.feedback(t.context,{recoverOnly:true});assert.equal(previous?.kind||null,mode==='LOST_ACK'?'KYC_CONTEXT_FEEDBACK':null);const receipt=await t.adapter.feedback(t.context,{staleOnly:true});await t.adapter.send(t.context,receipt.reply);assert.equal(t.requests.length,1);assert.deepEqual(t.f.worker,before);unchangedMedia(t.f);
});
for(const kind of ['PROJECT','COMPANY'])test(kind+' concurrent context feedback serializes one receipt and one actual HTTP',async()=>{
 const t=await contextFeedbackFixture(kind),receipts=await Promise.all([t.adapter.feedback(t.context,{staleOnly:true}),t.adapter.feedback(t.context,{staleOnly:true})]);assert.deepEqual(receipts[0],receipts[1]);const sent=await Promise.all(receipts.map(r=>t.adapter.send(t.context,r.reply)));assert.equal(sent.filter(r=>r.replayed).length,1);assert.equal(t.requests.length,1);assert.equal([...t.f.audits.values()].filter(a=>a.id===metaKycContextReceiptId(t.context.eventId)).length,1);
});

test('actual processor intercepts PROJECT stale source before any capture dispatch and maps its fixed outbound purpose',async()=>{
 const t=await contextFeedbackFixture('PROJECT'),f=t.f,event=f.events.get(t.context.eventId),before=structuredClone(f.worker);event.leaseToken=null;event.leaseExpiresAt=null;event.attempts=0;let dispatches=0;
 const connect=async()=>{const c=await t.connect();return {release:()=>c.release(),query:async(sql,args=[])=>{if(sql.startsWith('UPDATE public."WebhookEvent" SET "leaseToken"=$2')&&f.events.has(args[0])){const row=f.events.get(args[0]);row.leaseToken=args[1];row.leaseExpiresAt=args[2];return {rows:[],rowCount:1};}if(sql.startsWith('UPDATE public."WebhookEvent" SET status=\'PROCESSED\'')&&f.events.has(args[0])){const row=f.events.get(args[0]);row.status='PROCESSED';row.outcome=JSON.parse(args[3]);row.leaseToken=null;return {rows:[],rowCount:1};}return c.query(sql,args);}};};
 const adapter=createMetaKycContextFeedback({connect,provider:{sendReply:async input=>{await input.beforeExternal();await input.finalBeforeExternal();return {messageId:'wamid.SyntheticProcessorContextReply'};}},environment:f.environment}),processor=createMetaCustomerProcessor({connect,environment:f.environment,now:()=>f.now.getTime(),authorizationCodes:[...META_KYC_AUTHORIZATION_CODES,'META_KYC_CONTEXT_FEEDBACK_DENIED'],contextKyc:adapter.feedback,dispatch:async context=>{dispatches++;return resolveMetaKycAuthority(await connect(),context,{environment:f.environment});},outbound:{send:(context,reply,{purpose})=>{assert.equal(purpose,'KYC_CONTEXT_FEEDBACK');return adapter.send(context,reply);}}});
 const result=await processor.process(event.id);assert.equal(result.processed,true);assert.equal(result.kind,'KYC_CONTEXT_FEEDBACK');assert.equal(result.replySent,true);assert.equal(dispatches,0);assert.deepEqual(f.worker,before);assert.equal((await processor.process(event.id)).done,true);unchangedMedia(f);
});

for(const kind of ['PROJECT','COMPANY'])test(kind+' compact snapshot cannot move to another client or a mutated source capability',async()=>{
 const t=await contextFeedbackFixture(kind),client=await t.connect();await client.query('BEGIN');
 try{const r=await resolveMetaKycContextFeedbackAuthority(client,t.context,{environment:t.f.environment});await prepareKycContextOutboundSnapshot(client,r,t.context,{environment:t.f.environment});await assert.rejects(fenceKycContextOutboundSnapshot({query:client.query},r,t.context,{environment:t.f.environment}),{code:'META_KYC_CONTEXT_FEEDBACK_DENIED'});r.feedbackSourceEventId=t.context.eventId;await assert.rejects(fenceKycContextOutboundSnapshot(client,r,t.context,{environment:t.f.environment}),{code:'META_KYC_CONTEXT_FEEDBACK_DENIED'});releaseKycContextOutboundSnapshot(r);}
 finally{await client.query('ROLLBACK');client.release();}
});
for(const kind of ['PROJECT','COMPANY'])test(kind+' compact final fence cannot extend an original lease crossed during provider await',async()=>{
 let f;const t=await contextFeedbackFixture(kind,{providerAfterFirstFence:()=>{f.now.setTime(f.now.getTime()+61000);}});f=t.f;const before=structuredClone(f.worker),receipt=await t.adapter.feedback(t.context,{staleOnly:true}),deadline=f.events.get(t.context.eventId).leaseExpiresAt;await assert.rejects(t.adapter.send(t.context,receipt.reply));assert.equal(t.requests.length,0);assert.deepEqual(f.worker,before);assert.deepEqual(f.events.get(t.context.eventId).leaseExpiresAt,deadline);assert.equal(f.outbounds.get(customerOutboundId(t.context.eventId)).outcome.state,'SEND_STARTED');unchangedMedia(f);
});
for(const kind of ['PROJECT','COMPANY'])test(kind+' compact fence preserves the customer verification 60-second margin as time crosses it before POST',async()=>{
 let f;const t=await contextFeedbackFixture(kind,{grantLifetimeMs:70000,providerAfterFirstFence:()=>{f.now.setTime(f.now.getTime()+11000);}});f=t.f;const before=structuredClone(f.worker),receipt=await t.adapter.feedback(t.context,{staleOnly:true});await assert.rejects(t.adapter.send(t.context,receipt.reply),{code:'META_KYC_CONTEXT_FEEDBACK_DENIED'});assert.equal(t.requests.length,0);assert.ok(Date.parse(f.events.get(t.context.eventId).leaseExpiresAt)>f.now.getTime());assert.deepEqual(f.worker,before);const observed=await t.adapter.feedback(t.context,{recoverOnly:true});assert.equal(observed.reply,undefined);assert.equal(observed.replyState,'SEND_STARTED');unchangedMedia(f);
});
