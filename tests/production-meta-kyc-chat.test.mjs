import test from 'node:test';
import assert from 'node:assert/strict';
import {digest,WorkspaceError} from '../src/lib/workspace-policy.mjs';
import {metaKycChallengeDigest,metaKycOperationId,prepareMetaKycChallenge} from '../src/lib/meta-kyc-challenge.mjs';
import {beginMetaKycConversation,planMetaKycConversation} from '../src/lib/meta-kyc-conversation.mjs';
import {resolveMetaKycAuthority,metaKycDispatchReceiptId} from '../src/lib/meta-kyc-identity.mjs';
import {kycMemoryFixture} from './fixtures/meta-kyc-chat-memory.mjs';
import {customerReplyMessage} from '../src/lib/meta-customer-provider.mjs';
import {createMetaKycOutbound} from '../src/lib/meta-kyc-outbound.mjs';
import {randomUUID} from 'node:crypto';
import {PARTICIPANT_BIOMETRIC_NOTICE,PARTICIPANT_BIOMETRIC_NOTICE_VERSION} from '../src/lib/participant-policy.mjs';

test('challenge has 256 bits, exact grammar and deterministic event-bound deposit UUID',()=>{
 const code='IDENTIDAD '+Buffer.alloc(32,17).toString('base64url');assert.match(metaKycChallengeDigest(code),/^[a-f0-9]{64}$/);
 for(const bad of ['IDENTIDAD short',code+' ','identidad '+code.slice(10),'IDENTIDAD '+'!'.repeat(43)])assert.equal(metaKycChallengeDigest(bad),null);
 assert.match(metaKycOperationId('event-a'),/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-a[a-f0-9]{3}-[a-f0-9]{12}$/);assert.equal(metaKycOperationId('event-a'),metaKycOperationId('event-a'));assert.notEqual(metaKycOperationId('event-a'),metaKycOperationId('event-b'));
});
test('challenge preparation rejects an unauthorized manager before querying a worker',async()=>{
 let reads=0;await assert.rejects(prepareMetaKycChallenge({query:async()=>{reads++;}},{role:'EMPLOYEE'},{},{workerId:'worker-a'}),{code:'PARTICIPANT_MANAGE_REQUIRED'});assert.equal(reads,0);
});
test('manager creates a phone-scoped expiring challenge, stores no plain code, and replay cannot reveal it',async()=>{
 const f=kycMemoryFixture(),input={operationId:randomUUID(),workerId:f.worker.id,revision:f.worker.revision};f.worker.metadata.participant.invitation.expiresAt=new Date(f.now.getTime()+3600000).toISOString();
 delete f.worker.metadata.participant.kycChatChallenge;
 // Exact project DTO from workspace.projectOperation has no organizationId.
 const result=await prepareMetaKycChallenge({query:f.query},f.issuer,{id:f.project.id,name:f.project.name,metadata:{}},input);assert.match(result.code,/^IDENTIDAD [A-Za-z0-9_-]{43}$/);assert.equal(result.expiresAt,f.worker.metadata.participant.invitation.expiresAt);assert.equal(f.worker.metadata.participant.kycChatChallenge.senderE164,f.worker.phone);assert.ok(!JSON.stringify([...f.audits.values(),f.worker.metadata]).includes(result.code));
 const replay=await prepareMetaKycChallenge({query:f.query},f.issuer,f.project,input);assert.equal(replay.codeUnavailable,true);assert.equal(replay.code,undefined);assert.deepEqual(f.worker.metadata.participant.permissions,{attendance:false,report:false});
});

for(const status of ['PENDING','CLAIMED'])for(const expired of [false,true])test(`new preparation cannot overwrite an ${expired?'expired':'live'} ${status} capture with another UUID`,async()=>{
 const f=kycMemoryFixture();f.worker.metadata.participant.kycChatChallenge.status=status;
 if(expired)f.worker.metadata.participant.kycChatChallenge.expiresAt=new Date(f.now.getTime()-1).toISOString();
 const before=JSON.stringify(f.worker.metadata),audits=JSON.stringify([...f.audits]);
 await assert.rejects(prepareMetaKycChallenge({query:f.query},f.issuer,f.project,{operationId:randomUUID(),workerId:f.worker.id,revision:f.worker.revision}),{code:'PARTICIPANT_KYC_CHAT_CLOSURE_REQUIRED'});
 assert.equal(JSON.stringify(f.worker.metadata),before);assert.equal(JSON.stringify([...f.audits]),audits);
});
test('conversation pins both notices, requires fresh explicit consent, OCR choice and confirmation before deposit',()=>{
 let plan=beginMetaKycConversation('event-1');customerReplyMessage(plan.reply);assert.equal(plan.state.consent,false);assert.match(plan.state.noticeSha256,/^[a-f0-9]{64}$/);
 const stale=planMetaKycConversation({state:plan.state,eventId:'event-2',message:{type:'interactive',interactive:{list_reply:{id:'kyc:'+'a'.repeat(20)+':0'}}}});assert.equal(stale.state.step,'CONSENT');assert.equal(stale.state.consent,false);
 const image=planMetaKycConversation({state:plan.state,eventId:'event-3',message:{type:'image',image:{id:'150000011',mime_type:'image/png'}}});assert.equal(image.state.front,null);assert.equal(image.deposit,undefined);
 const cancelled=planMetaKycConversation({state:plan.state,eventId:'event-4',message:{type:'text',text:{body:'cancelar'}}});assert.equal(cancelled.state,null);assert.equal(cancelled.cancelled,true);assert.equal(cancelled.deposit,undefined);
});
for(const active of [false,true])test((active?'linked employee':'invited participant')+' captures private images without channel permissions, with receipt replay and no duplicate upload',async()=>{
 const f=kycMemoryFixture({active}),permissions=structuredClone(f.worker.metadata.participant.permissions);await f.toConfirmation();assert.equal(f.controls.downloads,0);assert.equal(f.blob.puts(),0);
 const final=await f.choose('Guardar identidad'),p=f.worker.metadata.participant;assert.equal(p.kyc.status,active?'PENDING_REVIEW':'PENDING_ACCOUNT_CLAIM');assert.equal(p.status,active?'ACTIVE':'INVITED');assert.deepEqual(p.permissions,permissions);assert.equal(f.blob.puts(),2);assert.equal(p.kyc.images.length,2);assert.equal(p.kyc.ocrConsent.allowed,false);assert.equal(p.kycChatChallenge.status,'COMPLETED');assert.equal(final.result.businessApplied,true);
 const submitted=[...f.audits.values()].filter(x=>x.action==='participant.operation.recorded');assert.equal(submitted.length,1);assert.equal(submitted[0].actorId,active?f.member.actorId:f.issuer.actorId);assert.equal(submitted[0].metadata.identityCertified,false);assert.equal(submitted[0].metadata.permissionsGranted,false);
 const uploads=f.blob.puts(),downloads=f.controls.downloads,sends=f.controls.sends;assert.deepEqual(await f.bridge.execute(final.context),final.result);await f.outbound.send(final.context,final.result.reply);assert.equal(f.blob.puts(),uploads);assert.equal(f.controls.downloads,downloads);assert.equal(f.controls.sends,sends);
 const serialized=JSON.stringify([...f.audits.values(),...f.outbounds.values(),f.worker.metadata]);assert.ok(!serialized.includes(f.code));assert.ok(!serialized.includes('data:image'));assert.ok(!serialized.includes('synthetic-kyc-channel-token'));assert.ok(!JSON.stringify(f.worker.metadata.participant.kycChatConversation).includes('150000011'));
});
test('confirmed deposit with lost acknowledgement recovers exact receipt before any second private upload',async()=>{
 const f=kycMemoryFixture();await f.toConfirmation();const s=f.state(),context=f.receive({type:'interactive',interactive:{list_reply:{id:'kyc:'+s.nonce+':0'}}});f.controls.loseDepositCommit=true;
 await assert.rejects(f.bridge.execute(context),{code:'PARTICIPANT_OPERATION_UNCONFIRMED'});assert.equal(f.blob.puts(),2);assert.equal(f.worker.metadata.participant.kyc.status,'PENDING_ACCOUNT_CLAIM');assert.equal(f.state().step,'FINALIZING');
 const result=await f.bridge.execute(context);assert.equal(result.businessApplied,true);assert.equal(f.blob.puts(),2);assert.equal([...f.audits.values()].filter(x=>x.action==='participant.operation.recorded').length,1);
});
test('transient media failure keeps the same confirmation event recoverable, without uploading or restarting consent',async()=>{
 const f=kycMemoryFixture();await f.toConfirmation();const s=f.state(),context=f.receive({type:'interactive',interactive:{list_reply:{id:'kyc:'+s.nonce+':0'}}});f.controls.transientMedia=true;
 await assert.rejects(f.bridge.execute(context),/SYNTHETIC_TRANSIENT_MEDIA/);assert.equal(f.blob.puts(),0);assert.equal(f.state().step,'FINALIZING');assert.equal((await f.bridge.execute(context)).businessApplied,true);assert.equal(f.blob.puts(),2);
});
test('CANCELAR after explicit confirmation preserves the original in-flight receipt and cannot falsely cancel committed evidence',async()=>{
 const f=kycMemoryFixture();await f.toConfirmation();const s=f.state(),context=f.receive({type:'interactive',interactive:{list_reply:{id:'kyc:'+s.nonce+':0'}}});f.controls.loseDepositCommit=true;
 await assert.rejects(f.bridge.execute(context),{code:'PARTICIPANT_OPERATION_UNCONFIRMED'});const state=JSON.stringify(f.state());const pending=await f.execute('CANCELAR');assert.match(pending.result.reply.body,/confirmación ya fue recibida/);assert.doesNotMatch(pending.result.reply.body,/cancelada|No se presentaron/);assert.equal(JSON.stringify(f.state()),state);assert.equal(f.worker.metadata.participant.kycChatChallenge.status,'CLAIMED');f.worker.metadata.participant.kycChatChallenge.messageCount=40;
 assert.equal((await f.bridge.execute(context)).businessApplied,true);assert.equal(f.blob.puts(),2);assert.equal(f.worker.metadata.participant.kycChatChallenge.status,'COMPLETED');assert.equal([...f.audits.values()].filter(x=>x.action==='participant.operation.recorded').length,1);
});
test('independent optional face comparison notice is pinned in chat and no processing or approval happens during capture',async()=>{
 const f=kycMemoryFixture({active:true});await f.execute(f.code);await f.choose('Autorizar imágenes');await f.choose('Con lectura asistida');assert.equal(f.state().step,'BIOMETRIC');assert.equal(f.state().biometricConsent,false);assert.equal(f.state().biometricNoticeVersion,PARTICIPANT_BIOMETRIC_NOTICE_VERSION);assert.equal(f.state().biometricNoticeSha256,digest(PARTICIPANT_BIOMETRIC_NOTICE));
 await f.image();assert.equal(f.state().step,'BIOMETRIC');assert.equal(f.state().front,null);await f.choose('Con comparación facial');await f.image();await f.image();await f.choose('Guardar identidad');const k=f.worker.metadata.participant.kyc;assert.equal(k.ocrConsent.allowed,true);assert.equal(k.biometricConsent.allowed,true);assert.equal(k.biometricConsent.noticeSha256,digest(PARTICIPANT_BIOMETRIC_NOTICE));assert.equal(k.status,'PENDING_REVIEW');assert.equal(k.processing,undefined);assert.equal(k.review,undefined);assert.equal(k.channelIdentity,undefined);
});
test('invalid provider image bytes reset to front capture with zero private uploads or canonical submission',async()=>{
 const f=kycMemoryFixture();await f.toConfirmation();f.controls.badMedia=true;const result=await f.choose('Guardar identidad');assert.equal(result.result.businessApplied,false);assert.equal(f.state().step,'FRONT');assert.equal(f.blob.puts(),0);assert.equal(f.worker.metadata.participant.kyc.status,'NOT_SUBMITTED');
});
test('cancel makes the code one-use and leaves no submission or private upload',async()=>{
 const f=kycMemoryFixture();await f.execute(f.code);await f.execute('CANCELAR');assert.equal(f.worker.metadata.participant.kycChatChallenge.status,'CANCELLED');assert.equal(f.state(),null);await assert.rejects(f.bridge.execute(f.receive(f.code)),{code:'META_KYC_CHALLENGE_REJECTED'});assert.equal(f.blob.puts(),0);assert.equal(f.controls.downloads,0);
});
for(const [name,mutate,code] of [
 ['expired challenge',f=>{f.worker.metadata.participant.kycChatChallenge.expiresAt=new Date(f.now.getTime()-1).toISOString();},'META_KYC_CHALLENGE_EXPIRED'],
 ['revoked issuer',f=>{f.controls.issuerActive=false;},'META_KYC_CHALLENGE_REVOKED'],
 ['revoked participant',f=>{f.worker.metadata.participant.status='REVOKED';},'META_KYC_CHALLENGE_REVOKED'],
 ['expired invitation',f=>{f.worker.metadata.participant.invitation.expiresAt=new Date(f.now.getTime()-1).toISOString();},'META_KYC_CHALLENGE_REVOKED'],
 ['inactive connection',f=>{f.connection.enabled=false;},'META_KYC_CHALLENGE_REVOKED'],
 ['foreign WABA',f=>{f.worker.metadata.participant.kycChatChallenge.wabaId='130000099';},'META_KYC_CHALLENGE_REVOKED'],
 ['changed registered phone',f=>{f.worker.phone='+5491100009999';},'META_KYC_CHALLENGE_REJECTED'],
])test(name+' grants zero result, download, upload or outbound',async()=>{
 const f=kycMemoryFixture(),context=f.receive(f.code);mutate(f);await assert.rejects(f.bridge.execute(context),{code});assert.equal(f.blob.puts(),0);assert.equal(f.controls.downloads,0);assert.equal(f.controls.sends,0);assert.equal(f.audits.size,0);assert.equal(f.worker.metadata.participant.kyc.status,'NOT_SUBMITTED');
});
test('signed-event authority rejects missing encrypted proof, changed tenant, lease and immutable payload digest',async()=>{
 for(const variant of ['proof','tenant','lease','digest']){const f=kycMemoryFixture(),context=f.receive(f.code,{proof:variant!=='proof'});if(variant==='tenant')context.projectId='project-b';if(variant==='lease')context.leaseToken='foreign';if(variant==='digest')context.payloadDigest='b'.repeat(64);await assert.rejects(resolveMetaKycAuthority({query:f.query},context,{environment:f.environment}),error=>error instanceof WorkspaceError);assert.equal(f.blob.puts(),0);}
});
test('older signed message and expired active conversation are rejected before media download',async()=>{
 const f=kycMemoryFixture();await f.execute(f.code);const older=f.receive('ESTADO',{timestamp:f.state().lastMessageTimestamp});await assert.rejects(f.bridge.execute(older),{code:'META_KYC_MESSAGE_OUT_OF_ORDER'});
 f.worker.metadata.participant.kycChatChallenge.claimedAt=new Date(f.now.getTime()-31*60000).toISOString();await assert.rejects(f.bridge.execute(f.receive('ESTADO')),{code:'META_KYC_CHALLENGE_EXPIRED'});assert.equal(f.controls.downloads,0);
});
test('conversation message limit does not permit further effects but preserves exact event receipt replay',async()=>{
 const f=kycMemoryFixture(),first=await f.execute(f.code);f.worker.metadata.participant.kycChatChallenge.messageCount=40;const before=JSON.stringify(f.worker.metadata),audits=f.audits.size;
 await assert.rejects(f.bridge.execute(f.receive('ESTADO')),{code:'META_KYC_CONVERSATION_LIMIT'});assert.deepEqual(await f.bridge.execute(first.context),first.result);assert.equal(JSON.stringify(f.worker.metadata),before);assert.equal(f.audits.size,audits);assert.equal(f.blob.puts(),0);
});
test('signed code from the wrong sender cannot look up any participant or create a response',async()=>{
 const f=kycMemoryFixture();await assert.rejects(f.bridge.execute(f.receive(f.code,{sender:'5491100009999'})),{code:'META_KYC_CHALLENGE_REJECTED'});assert.equal(f.audits.size,0);assert.equal(f.outbounds.size,0);assert.equal(f.controls.downloads,0);assert.equal(f.blob.puts(),0);
});
test('fixed-prompt outbound refuses invented body and rechecks revocation immediately before provider send',async()=>{
 const f=kycMemoryFixture(),context=f.receive(f.code),result=await f.bridge.execute(context);await assert.rejects(f.outbound.send(context,{type:'text',body:'invented'}),{code:'META_KYC_CHALLENGE_REJECTED'});assert.equal(f.controls.sends,0);
 const audit=f.audits.get(metaKycDispatchReceiptId(context.eventId));audit.metadata.replyDigest=digest('tampered');await assert.rejects(f.outbound.send(context,result.reply),{code:'META_KYC_CHALLENGE_REJECTED'});assert.equal(f.controls.sends,0);
});
test('outbound revalidation after reservation stops a revoked issuer before provider POST',async()=>{
 const f=kycMemoryFixture(),context=f.receive(f.code),result=await f.bridge.execute(context),outbound=createMetaKycOutbound({connect:f.connect,environment:f.environment,provider:{sendReply:async()=>{f.controls.sends++;}},afterReserve:async()=>{f.controls.issuerActive=false;}});
 await assert.rejects(outbound.send(context,result.reply),{code:'META_KYC_CHALLENGE_REVOKED'});assert.equal(f.controls.sends,0);assert.equal(f.outbounds.size,1);assert.equal([...f.outbounds.values()][0].outcome.state,'SEND_STARTED');
});
for(const finished of ['COMPLETED','CANCELLED'])test(finished+' challenge lets new VINCULAR, field text and image messages reach the field lane without any KYC write',async()=>{
 const f=kycMemoryFixture();if(finished==='COMPLETED'){await f.toConfirmation();await f.choose('Guardar identidad');}else{await f.execute(f.code);await f.execute('CANCELAR');}
 const original=structuredClone(f.worker.metadata),audits=f.audits.size,puts=f.blob.puts(),downloads=f.controls.downloads;
 // Closure still permits operational fallback even after challenge expiry or issuer revocation.
 f.worker.metadata.participant.kycChatChallenge.expiresAt=new Date(f.now.getTime()-1).toISOString();f.controls.issuerActive=false;
 const closed=structuredClone(f.worker.metadata);
 for(const message of ['VINCULAR synthetic-existing-field-challenge','REPORTAR avance',{type:'image',image:{id:'150000011',mime_type:'image/png'}}])assert.equal(await f.bridge.execute(f.receive(message)),null);
 assert.deepEqual(f.worker.metadata,closed);assert.equal(f.audits.size,audits);assert.equal(f.blob.puts(),puts);assert.equal(f.controls.downloads,downloads);assert.deepEqual(f.worker.metadata.participant.kyc,original.participant.kyc);
});
test('active employee capture requires actual linked account, membership and project assignment',async()=>{
 for(const variant of ['account','membership','assignment']){const f=kycMemoryFixture({active:true}),context=f.receive(f.code);if(variant==='account')f.worker.metadata.participant.clerkUserId='user_Foreign';if(variant==='membership')f.controls.workerMembershipActive=false;if(variant==='assignment')f.controls.projectAssignmentActive=false;await assert.rejects(f.bridge.execute(context),{code:'META_KYC_CHALLENGE_REVOKED'});assert.equal(f.audits.size,0);}
});
