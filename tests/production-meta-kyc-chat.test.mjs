import test from 'node:test';
import assert from 'node:assert/strict';
import {digest,WorkspaceError} from '../src/lib/workspace-policy.mjs';
import {metaKycChallengeDigest,metaKycOperationId,prepareMetaKycChallenge} from '../src/lib/meta-kyc-challenge.mjs';
import {beginMetaKycConversation,planMetaKycConversation} from '../src/lib/meta-kyc-conversation.mjs';
import {resolveMetaKycAuthority,metaKycDispatchReceiptId} from '../src/lib/meta-kyc-identity.mjs';
import {kycMemoryFixture} from './fixtures/meta-kyc-chat-memory.mjs';
import {customerReplyMessage,createMetaCustomerProvider} from '../src/lib/meta-customer-provider.mjs';
import {createMetaKycBridge} from '../src/lib/meta-kyc-bridge.mjs';
import {createMetaKycOutbound} from '../src/lib/meta-kyc-outbound.mjs';
import {createHash,randomUUID} from 'node:crypto';
import {PARTICIPANT_BIOMETRIC_NOTICE,PARTICIPANT_BIOMETRIC_NOTICE_VERSION} from '../src/lib/participant-policy.mjs';
import {lifecyclePng} from '../scripts/fixtures/meta-signup-field-lifecycle-fixture.mjs';

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
for(const invalidImage of ['front','back','selfie'])for(const mismatch of ['content-length','stream-size','sha256'])test(`provider ${mismatch} mismatch on ${invalidImage} recovers capture before any private deposit`,async()=>{
 const f=kycMemoryFixture({active:true,captureImageSetVersion:2}),ids={front:'150000021',back:'150000022',selfie:'150000023'},freshIds={front:'150000031',back:'150000032',selfie:'150000033'},knownIds=new Set([...Object.values(ids),...Object.values(freshIds)]),requests=[];
 const imageHash=createHash('sha256').update(lifecyclePng).digest('hex');let invalid=true,integrityErrors=0,deposits=0;
 const realProvider=createMetaCustomerProvider({environment:f.environment,fetchImpl:async input=>{
  const url=new URL(input),mediaId=url.pathname.split('/').at(-1);assert.ok(knownIds.has(mediaId));requests.push({host:url.hostname,mediaId});
  const damaged=invalid&&mediaId===ids[invalidImage];
  if(url.hostname==='graph.facebook.com'){
   assert.equal(url.pathname,'/v25.0/'+mediaId);assert.equal(url.searchParams.get('phone_number_id'),f.connection.phoneNumberId);
   return Response.json({id:mediaId,mime_type:'image/png',file_size:lifecyclePng.length,sha256:imageHash,url:'https://lookaside.fbsbx.com/whatsapp_business/attachments/'+mediaId});
  }
  assert.equal(url.hostname,'lookaside.fbsbx.com');assert.equal(url.pathname,'/whatsapp_business/attachments/'+mediaId);
  const bytes=damaged&&mismatch==='stream-size'?lifecyclePng.subarray(0,-1):damaged&&mismatch==='sha256'?Buffer.from(lifecyclePng):lifecyclePng;
  if(damaged&&mismatch==='sha256')bytes[bytes.length-1]^=1;
  return new Response(bytes,{headers:{'content-type':'image/png',...(damaged&&mismatch==='content-length'?{'content-length':String(lifecyclePng.length+1)}:{})}});
 }});
 const provider={downloadMedia:async input=>{try{return await realProvider.downloadMedia(input);}catch(error){assert.equal(error.code,'META_CUSTOMER_MEDIA_INTEGRITY');integrityErrors++;throw error;}}};
 const bridge=createMetaKycBridge({connect:f.connect,environment:f.environment,provider,deposit:{recover:context=>f.deposit.recover(context),deposit:(...args)=>{deposits++;return f.deposit.deposit(...args);}}});
 const execute=async message=>{const context=f.receive(message),result=await bridge.execute(context);if(result?.reply)await f.outbound.send(context,result.reply);return {context,result};};
 const choose=title=>{const state=f.state(),index=state.choices.findIndex(row=>row.title===title);assert.ok(index>=0,title);return execute({type:'interactive',interactive:{list_reply:{id:'kyc:'+state.nonce+':'+index}}});};
 const image=mediaId=>execute({type:'image',image:{id:mediaId,mime_type:'image/png'}});
 await execute(f.code);await choose('Autorizar imágenes');await choose('Autorizar dorso');await choose('Sin lectura asistida');await choose('Sin comparación facial');for(const key of ['front','back','selfie'])await image(ids[key]);
 const before=f.state(),permissions=structuredClone(f.worker.metadata.participant.permissions),failed=await choose('Guardar identidad');
 assert.equal(integrityErrors,1);assert.equal(requests.filter(request=>request.mediaId===ids[invalidImage]).length,2);assert.equal(failed.result.businessApplied,false);assert.equal(f.blob.puts(),0);assert.equal(deposits,0);assert.equal(f.worker.metadata.participant.kyc.status,'NOT_SUBMITTED');
 assert.equal([...f.audits.values()].filter(row=>row.metadata.kind==='KYC_SUBMITTED').length,0);assert.equal(f.state().step,'FRONT');assert.equal(f.state().confirmationEventId,null);for(const key of ['front','back','selfie'])assert.equal(f.state()[key],null);
 for(const key of ['consent','backConsent','noticeVersion','noticeSha256','backNoticeVersion','backNoticeSha256','ocrConsent','biometricConsent'])assert.equal(f.state()[key],before[key]);
 const requestCount=requests.length;assert.deepEqual(await bridge.execute(failed.context),failed.result);assert.equal(requests.length,requestCount);assert.equal(f.blob.puts(),0);assert.equal(deposits,0);
 invalid=false;for(const key of ['front','back','selfie'])await image(freshIds[key]);const saved=await choose('Guardar identidad'),part=f.worker.metadata.participant;
 assert.equal(saved.result.businessApplied,true);assert.equal(deposits,1);assert.equal(f.blob.puts(),3);assert.equal(part.kyc.status,'PENDING_REVIEW');assert.equal(part.kyc.images.length,3);assert.equal(part.kyc.review,undefined);assert.equal(part.channelIdentity,undefined);assert.deepEqual(part.permissions,permissions);assert.equal(part.kycChatChallenge.status,'COMPLETED');
 const receipts=[...f.audits.values()].filter(row=>row.metadata.kind==='KYC_SUBMITTED');assert.equal(receipts.length,1);assert.equal(receipts[0].metadata.identityCertified,false);assert.equal(receipts[0].metadata.permissionsGranted,false);assert.equal(receipts[0].metadata.whatsAppAccessGranted,false);
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

// New signed-channel capture contract; legacy fixture cases above remain v1.
for(const active of [false,true])test('WhatsApp schema2 captures front/back/selfie with separate consent and no new grants: '+active,async()=>{
 const f=kycMemoryFixture({active,captureImageSetVersion:2}),permissions=structuredClone(f.worker.metadata.participant.permissions);await f.toConfirmation();assert.match(f.state().backNoticeSha256,/^[a-f0-9]{64}$/);assert.equal(f.state().backConsent,true);const final=await f.choose('Guardar identidad'),k=f.worker.metadata.participant.kyc,m=[...f.audits.values()].find(a=>a.metadata.kind==='KYC_SUBMITTED').metadata;
 assert.equal(k.captureImageSetVersion,2);assert.deepEqual(k.images.map(i=>[i.id,i.kind]),[['document-front','DOCUMENT_FRONT'],['selfie','SELFIE'],['document-back','DOCUMENT_BACK']]);assert.equal(k.documentBackConsent.recordedAt,k.submittedAt);assert.equal(m.captureImageSetVersion,2);assert.equal(m.documentBackConsentRecorded,true);assert.equal(m.documentBackNoticeVersion,k.documentBackConsent.noticeVersion);assert.equal(m.documentBackNoticeSha256,k.documentBackConsent.noticeSha256);assert.deepEqual(f.worker.metadata.participant.permissions,permissions);assert.equal(k.processing,undefined);assert.equal(k.review,undefined);assert.equal(m.permissionsGranted,false);assert.equal(m.whatsAppAccessGranted,false);assert.equal(f.controls.downloads,3);assert.equal(f.blob.puts(),3);
 const counts=[f.controls.downloads,f.blob.puts(),f.controls.sends];await f.bridge.execute(final.context);assert.deepEqual([f.controls.downloads,f.blob.puts(),f.controls.sends],counts);assert.doesNotMatch(JSON.stringify([...f.audits.values()]),/data:image|synthetic-kyc-channel-token|mediaId/);
});
test('WhatsApp schema2 does not accept a photo or stale choice instead of explicit back consent',async()=>{
 const f=kycMemoryFixture({captureImageSetVersion:2});await f.execute(f.code);await f.choose('Autorizar imágenes');assert.equal(f.state().step,'BACK_CONSENT');await f.image();assert.equal(f.state().backConsent,false);assert.equal(f.state().back,null);await f.execute({type:'interactive',interactive:{list_reply:{id:'kyc:'+'0'.repeat(20)+':0'}}});assert.equal(f.state().backConsent,false);await f.choose('Cancelar');assert.equal(f.worker.metadata.participant.kycChatChallenge.status,'CANCELLED');assert.equal(f.blob.puts(),0);assert.equal(f.controls.downloads,0);
});
test('WhatsApp schema2 committed deposit recovery occurs before any new provider download or Blob upload',async()=>{
 const f=kycMemoryFixture({captureImageSetVersion:2});await f.toConfirmation();const state=f.state(),context=f.receive({type:'interactive',interactive:{list_reply:{id:'kyc:'+state.nonce+':0'}}});f.controls.loseDepositCommit=true;await assert.rejects(f.bridge.execute(context),{code:'PARTICIPANT_OPERATION_UNCONFIRMED'});const downloads=f.controls.downloads,puts=f.blob.puts(),receipt=[...f.audits.values()].find(a=>a.metadata.kind==='KYC_SUBMITTED');assert.equal(downloads,3);assert.equal(puts,3);
 f.controls.transientMedia=true;const result=await f.bridge.execute(context);assert.equal(result.receiptId,receipt.id);assert.equal(result.businessApplied,true);assert.equal(f.controls.downloads,downloads);assert.equal(f.blob.puts(),puts);assert.equal(f.controls.transientMedia,true);assert.equal(f.worker.metadata.participant.kycChatChallenge.status,'COMPLETED');
});
for(const mode of ['missing-consent','wrong-notice','wrong-hash','missing-schema','content-hash','payload','lease','revoked'])test('WhatsApp schema2 recovery refuses '+mode+' before external I/O',async()=>{
 const f=kycMemoryFixture({captureImageSetVersion:2});await f.toConfirmation();const state=f.state(),context=f.receive({type:'interactive',interactive:{list_reply:{id:'kyc:'+state.nonce+':0'}}});f.controls.loseDepositCommit=true;await assert.rejects(f.bridge.execute(context));const m=[...f.audits.values()].find(a=>a.metadata.kind==='KYC_SUBMITTED').metadata,counts=[f.controls.downloads,f.blob.puts()];
 if(mode==='missing-consent')delete m.documentBackConsentRecorded;if(mode==='wrong-notice')m.documentBackNoticeVersion='participant-kyc-document-back-v1';if(mode==='wrong-hash')m.documentBackNoticeSha256='0'.repeat(64);if(mode==='missing-schema')delete m.captureImageSetVersion;if(mode==='content-hash')m.contentHash='0'.repeat(64);if(mode==='payload')f.events.get(context.eventId).payload.payloadDigest='0'.repeat(64);if(mode==='lease')f.events.get(context.eventId).leaseToken='wrong-lease';if(mode==='revoked')f.controls.issuerActive=false;
 await assert.rejects(f.bridge.execute(context));assert.deepEqual([f.controls.downloads,f.blob.puts()],counts);assert.equal(f.worker.metadata.participant.kycChatChallenge.status,'CLAIMED');
});
test('WhatsApp schema2 FINALIZING preserves confirmation when a later CANCELAR arrives',async()=>{
 const f=kycMemoryFixture({captureImageSetVersion:2});await f.toConfirmation();const s=f.state(),context=f.receive({type:'interactive',interactive:{list_reply:{id:'kyc:'+s.nonce+':0'}}});f.controls.loseDepositCommit=true;await assert.rejects(f.bridge.execute(context));const envelope=JSON.stringify(f.worker.metadata.participant.kycChatConversation);const next=await f.execute('CANCELAR');assert.match(next.result.reply.body,/confirmación ya fue recibida/);assert.equal(JSON.stringify(f.worker.metadata.participant.kycChatConversation),envelope);assert.equal((await f.bridge.execute(context)).businessApplied,true);assert.equal(f.blob.puts(),3);assert.equal(f.controls.downloads,3);
});
test('WhatsApp schema2 cannot begin after its durable preparation receipt loses the schema marker',async()=>{
 const f=kycMemoryFixture({captureImageSetVersion:2});delete f.audits.get('prepared-fixture').metadata.captureImageSetVersion;await assert.rejects(f.execute(f.code),{code:'META_KYC_CHALLENGE_REJECTED'});assert.equal(f.worker.metadata.participant.kycChatChallenge.status,'PENDING');assert.equal(f.controls.downloads,0);assert.equal(f.blob.puts(),0);assert.equal(f.controls.sends,0);
});
test('WhatsApp schema2 rejects a back source dispatch belonging to another challenge before download',async()=>{
 const f=kycMemoryFixture({captureImageSetVersion:2});await f.toConfirmation();const source=f.state().back.eventId,audit=[...f.audits.values()].find(a=>a.id===metaKycDispatchReceiptId(source));audit.metadata.challengeId='different-challenge';const s=f.state(),context=f.receive({type:'interactive',interactive:{list_reply:{id:'kyc:'+s.nonce+':0'}}});await assert.rejects(f.bridge.execute(context),{code:'META_KYC_CHALLENGE_REJECTED'});assert.equal(f.controls.downloads,0);assert.equal(f.blob.puts(),0);
});

test('WhatsApp schema2 recovery validates the original receipt without interpreting a newer two-image presentation',async()=>{
 const f=kycMemoryFixture({active:true,captureImageSetVersion:2});await f.toConfirmation();const state=f.state(),context=f.receive({type:'interactive',interactive:{list_reply:{id:'kyc:'+state.nonce+':0'}}});f.controls.loseDepositCommit=true;await assert.rejects(f.bridge.execute(context));const original=[...f.audits.values()].find(a=>a.metadata.kind==='KYC_SUBMITTED'),p=f.worker.metadata.participant;p.kyc={version:1,status:'PENDING_REVIEW',submissionId:'kyc_newer',images:[]};const snapshot=JSON.stringify(p.kyc),counts=[f.controls.downloads,f.blob.puts()];const result=await f.bridge.execute(context);assert.equal(result.receiptId,original.id);assert.match(result.reply.body,/recibo original/);assert.equal(JSON.stringify(p.kyc),snapshot);assert.deepEqual([f.controls.downloads,f.blob.puts()],counts);assert.equal(original.metadata.permissionsGranted,false);assert.equal(original.metadata.whatsAppAccessGranted,false);
});
test('WhatsApp schema2 deposited capture with a missing current back flag fails closed before recovery',async()=>{
 const f=kycMemoryFixture({captureImageSetVersion:2});await f.toConfirmation();const state=f.state(),context=f.receive({type:'interactive',interactive:{list_reply:{id:'kyc:'+state.nonce+':0'}}});f.controls.loseDepositCommit=true;await assert.rejects(f.bridge.execute(context));delete f.worker.metadata.participant.kyc.documentBackConsent.allowed;const counts=[f.controls.downloads,f.blob.puts()];await assert.rejects(f.bridge.execute(context),{code:'PARTICIPANT_RECEIPT_INVALID'});assert.deepEqual([f.controls.downloads,f.blob.puts()],counts);
});

test('WhatsApp schema2 prompts explicitly request the back and name it again after invalid media',async()=>{
 const f=kycMemoryFixture({captureImageSetVersion:2});await f.execute(f.code);await f.choose('Autorizar imágenes');await f.choose('Autorizar dorso');await f.choose('Sin lectura asistida');await f.choose('Sin comparación facial');const next=await f.image();assert.equal(f.state().step,'BACK');assert.match(next.result.reply.body,/dorso/);assert.doesNotMatch(next.result.reply.body,/undefined/);await f.image();await f.image();f.controls.badMedia=true;const retry=await f.choose('Guardar identidad');assert.match(retry.result.reply.body,/dorso y una selfie nueva/);assert.equal(f.state().step,'FRONT');assert.equal(f.state().back,null);assert.equal(f.blob.puts(),0);
});

for(const target of ['two','three'])test('WhatsApp schema2 superseded '+target+'-image ACK cannot excuse corrupt original source or notice',async()=>{
 for(const tamper of ['source','notice']){const f=kycMemoryFixture({active:true,captureImageSetVersion:2});await f.toConfirmation();const state=f.state(),context=f.receive({type:'interactive',interactive:{list_reply:{id:'kyc:'+state.nonce+':0'}}});f.controls.loseDepositCommit=true;await assert.rejects(f.bridge.execute(context));const receipt=[...f.audits.values()].find(a=>a.metadata.kind==='KYC_SUBMITTED'),old=f.worker.metadata.participant.kyc;f.worker.metadata.participant.kyc={...old,submissionId:'kyc_newer',images:target==='two'?old.images.slice(0,2):old.images};if(tamper==='source')receipt.metadata.channelCapture.sourceDigest='0'.repeat(64);else receipt.metadata.documentBackNoticeSha256='0'.repeat(64);const counts=[f.controls.downloads,f.blob.puts()];await assert.rejects(f.bridge.execute(context));assert.deepEqual([f.controls.downloads,f.blob.puts()],counts);assert.equal(f.worker.metadata.participant.kyc.submissionId,'kyc_newer');}
});
test('WhatsApp schema2 committed receipt recovery needs no access-token decryption and denies current actor revocation',async()=>{
 const f=kycMemoryFixture({captureImageSetVersion:2});await f.toConfirmation();const state=f.state(),context=f.receive({type:'interactive',interactive:{list_reply:{id:'kyc:'+state.nonce+':0'}}});f.controls.loseDepositCommit=true;await assert.rejects(f.bridge.execute(context));const counts=[f.controls.downloads,f.blob.puts()];f.connection.encryptedAccessToken='invalid-ciphertext';f.controls.issuerActive=false;await assert.rejects(f.bridge.execute(context),{code:'META_KYC_CHALLENGE_REVOKED'});assert.deepEqual([f.controls.downloads,f.blob.puts()],counts);f.controls.issuerActive=true;const result=await f.bridge.execute(context);assert.equal(result.businessApplied,true);assert.deepEqual([f.controls.downloads,f.blob.puts()],counts);
});
test('WhatsApp schema2 marker cannot downgrade a committed current capture after its back fields are removed',async()=>{
 const f=kycMemoryFixture({captureImageSetVersion:2});await f.toConfirmation();const state=f.state(),context=f.receive({type:'interactive',interactive:{list_reply:{id:'kyc:'+state.nonce+':0'}}});f.controls.loseDepositCommit=true;await assert.rejects(f.bridge.execute(context));const k=f.worker.metadata.participant.kyc;k.images.pop();delete k.documentBackConsent;const counts=[f.controls.downloads,f.blob.puts()];await assert.rejects(f.bridge.execute(context),{code:'PARTICIPANT_RECEIPT_INVALID'});assert.deepEqual([f.controls.downloads,f.blob.puts()],counts);
});
