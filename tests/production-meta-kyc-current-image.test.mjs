import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {currentImageFixture} from './fixtures/meta-kyc-current-image-memory.mjs';
import {unchangedMedia,rewriteContextEvent} from './fixtures/meta-kyc-context-feedback-memory.mjs';
import {currentImageReceiptId,currentImageOutboundGuard} from '../src/lib/meta-kyc-current-image.mjs';
import {decryptCustomerSecret,encryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {usageDigest} from '../src/lib/organization-usage-policy.mjs';
import {lifecyclePng} from '../scripts/fixtures/meta-signup-field-lifecycle-fixture.mjs';
import {decodeSignedCustomerEvent,createMetaCustomerProductionProcessor} from '../src/lib/meta-customer-processing.mjs';
import {metaKycDispatchReceiptId,META_KYC_AUTHORIZATION_CODES,resolveMetaKycAuthority} from '../src/lib/meta-kyc-identity.mjs';
import {WorkspaceError,digest} from '../src/lib/workspace-policy.mjs';
import {participantOcrNotice,participantBiometricNotice,PARTICIPANT_AUTO_OCR_NOTICE_VERSION,PARTICIPANT_AUTO_BIOMETRIC_NOTICE_VERSION} from '../src/lib/participant-analysis-consent.mjs';
import {assertParticipantPreanalysisSource} from '../src/lib/participant-kyc-preanalysis-policy.mjs';
import {participantIdentityUrl} from '../src/lib/participant-kyc-chat-copy.mjs';
const photo=id=>({type:'image',image:{id,mime_type:'image/png'}});
const receipt=(t,id)=>t.f.audits.get(currentImageReceiptId(id));
function proof(t,row){return JSON.parse(decryptCustomerSecret(row.metadata.encryptedProof,{organizationId:t.f.target.organizationId,projectId:t.f.anchor.id,purpose:'kyc-current-image-v1',resourceId:row.id},t.f.environment));}
const jsonbOrder=value=>Array.isArray(value)?value.map(jsonbOrder):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort((a,b)=>a.length-b.length||a.localeCompare(b)).map(key=>[key,jsonbOrder(value[key])])):value;
function sealProof(t,row,value){row.metadata.proofDigest=usageDigest(value);row.metadata.encryptedProof=encryptCustomerSecret(JSON.stringify(value),{organizationId:t.f.target.organizationId,projectId:t.f.anchor.id,purpose:'kyc-current-image-v1',resourceId:row.id},t.f.environment);}

test('three ordinary images bind CURRENT to the actual signed source and stage before one unchanged private deposit',async()=>{
 const t=await currentImageFixture(),events=[],permissions=structuredClone(t.f.worker.metadata.participant.permissions);
 for(const [stage,id,next]of [['FRONT','150000211','BACK'],['BACK','150000212','SELFIE'],['SELFIE','150000213','CONFIRM']]){
  const before=t.f.state(),{context,result}=await t.image(id);events.push(context);assert.equal(result.kind,'KYC_CHAT');assert.equal(t.f.state().step,next);const row=receipt(t,context.eventId),m=row.metadata,p=proof(t,row);assert.equal(m.mode,'CURRENT');assert.equal(m.stage,stage);assert.equal(m.nextStage,next);assert.equal(m.sourceEventId,context.eventId);assert.equal(m.payloadDigest,context.payloadDigest);assert.equal(m.promptSourceEventId,before.lastEventId);assert.equal(m.proofDigest,usageDigest(p));assert.equal(p.inboundMessageDigest,usageDigest(decodeSignedCustomerEvent(t.f.events.get(context.eventId),t.f.connection,t.f.environment).value.id));assert.equal(Object.hasOwn(decodeSignedCustomerEvent(t.f.events.get(context.eventId),t.f.connection,t.f.environment).value,'context'),false);assert.equal(m.identityCertified,false);assert.equal(m.permissionsGranted,false);unchangedMedia(t.f);
 }
 const saved=await t.confirm();assert.equal(saved.result.businessApplied,true);assert.equal(t.f.worker.metadata.participant.kyc.status,'PENDING_REVIEW');assert.equal(t.f.worker.metadata.participant.kyc.images.length,3);assert.deepEqual(t.f.worker.metadata.participant.permissions,permissions);assert.equal(t.f.control.graph,3);assert.equal(t.f.blob.puts(),3);assert.equal(events.length,3);
});

for(const [ocr,biometric]of [[false,false],[true,false],[false,true],[true,true]])test('CURRENT with exact automatic v2 consent '+ocr+'/'+biometric+' queues only the independently authorized stages from one durable submission',async()=>{
 const t=await currentImageFixture('FRONT',{ocrConsent:ocr,biometricConsent:biometric}),state=t.f.state(),permissions=structuredClone(t.f.worker.metadata.participant.permissions);
 assert.equal(state.ocrNoticeVersion,PARTICIPANT_AUTO_OCR_NOTICE_VERSION);assert.equal(state.ocrNoticeSha256,participantOcrNotice(state.ocrNoticeVersion).sha256);assert.equal(state.biometricNoticeVersion,PARTICIPANT_AUTO_BIOMETRIC_NOTICE_VERSION);assert.equal(state.biometricNoticeSha256,participantBiometricNotice(state.biometricNoticeVersion).sha256);
 for(const id of ['150000211','150000212','150000213']){const {context}=await t.image(id),p=proof(t,receipt(t,context.eventId));assert.equal(p.beforeState.ocrConsent,ocr);assert.equal(p.beforeState.biometricConsent,biometric);assert.equal(p.beforeState.ocrNoticeSha256,state.ocrNoticeSha256);assert.equal(p.beforeState.biometricNoticeSha256,state.biometricNoticeSha256);}
 assert.equal(t.currentControls.scheduled.length,0);const commits=t.currentControls.commits,saved=await t.confirm(),k=t.f.worker.metadata.participant.kyc,p=k.processing,submitted=[...t.f.audits.values()].filter(a=>a.metadata.kind==='KYC_SUBMITTED');
 assert.equal(submitted.length,1);assert.deepEqual(assertParticipantPreanalysisSource(k,p.auto,submitted[0],{organizationId:t.f.target.organizationId,projectId:t.f.target.id,workerId:t.f.worker.id}),{ocr,biometric});assert.equal(p.automatic,true);assert.equal(p.status,ocr||biometric?'QUEUED':'SKIPPED_CONSENT');assert.equal(p.stages.ocr.state,ocr?'PENDING':'NOT_AUTHORIZED');assert.equal(p.stages.biometric.state,biometric?'PENDING':'NOT_AUTHORIZED');assert.equal(p.auto.sourceReceiptId,submitted[0].id);assert.equal(p.auto.sourceActorId,t.f.member.actorId);assert.equal(p.identityVerified,false);assert.equal(k.status,'PENDING_REVIEW');assert.deepEqual(t.f.worker.metadata.participant.permissions,permissions);
 assert.equal(t.currentControls.scheduled.length,1);assert.ok(t.currentControls.scheduled[0].commits>commits);assert.deepEqual(t.currentControls.scheduled[0].processing,p);assert.equal(t.currentControls.scheduled[0].receipts[0].id,submitted[0].id);assert.deepEqual(t.currentControls.scheduled[0].ref,{projectId:t.f.target.id,workerId:t.f.worker.id,submissionId:k.submissionId});
 const stable=structuredClone(p),reads=t.f.control.graph,uploads=t.f.blob.puts();assert.deepEqual(await t.bridge.execute(saved.context),saved.result);assert.deepEqual(t.f.worker.metadata.participant.kyc.processing,stable);assert.equal(t.currentControls.scheduled.length,1);assert.equal(t.f.control.graph,reads);assert.equal(t.f.blob.puts(),uploads);assert.equal([...t.f.audits.values()].filter(a=>a.metadata.kind==='KYC_SUBMITTED').length,1);assert.equal(/se procesará automáticamente/.test(saved.result.reply.body),ocr||biometric);assert.ok(saved.result.reply.body.includes(participantIdentityUrl(t.f.target.id)));
});
test('CURRENT replay after the stage advances returns the same dispatch and never binds the WAMID to another stage',async()=>{
 const t=await currentImageFixture(),first=await t.image(),before=structuredClone(t.f.worker),count=t.f.audits.size;assert.equal(t.f.state().step,'BACK');assert.deepEqual(await t.bridge.execute(first.context),first.result);assert.equal(t.f.audits.size,count);assert.deepEqual(t.f.worker,before);assert.equal([...t.f.audits.values()].filter(a=>a.action==='participant.kyc_chat.image_context').length,1);unchangedMedia(t.f);
});
test('CURRENT proof and metadata survive JSONB key order while the exact signed source stays unchanged',async()=>{
 const t=await currentImageFixture(),first=await t.image(),row=receipt(t,first.context.eventId),original=proof(t,row),ordered=jsonbOrder(original);assert.notEqual(digest(original),digest(ordered));assert.equal(usageDigest(original),usageDigest(ordered));sealProof(t,row,ordered);for(const a of t.f.audits.values())if(a.action==='participant.kyc_chat.image_context')a.metadata=jsonbOrder(a.metadata);assert.deepEqual(await t.bridge.execute(first.context),first.result);await t.image('150000212');await t.image('150000213');assert.equal((await t.confirm()).result.businessApplied,true);assert.equal(t.f.worker.metadata.participant.kyc.status,'PENDING_REVIEW');
});
for(const [name,change]of [['consent',p=>{p.beforeState.consent=false;}],['post-reference',p=>{p.afterState.front.mediaId='150000299';}],['anchor time',p=>{p.anchor.acceptedAt='tomorrow';}]])test('a resealed CURRENT proof with canonical hashes cannot reinterpret '+name,async()=>{
 const t=await currentImageFixture(),first=await t.image(),row=receipt(t,first.context.eventId),value=jsonbOrder(proof(t,row)),before=structuredClone(t.f.worker);change(value);sealProof(t,row,value);await assert.rejects(()=>t.bridge.execute(first.context),{code:name==='anchor time'?'META_KYC_CURRENT_IMAGE_ORDER':'META_KYC_CURRENT_IMAGE_REJECTED'});assert.deepEqual(t.f.worker,before);unchangedMedia(t.f);
});
test('CURRENT compact source data belongs to the resolved client and cannot be minted from a serialized mode flag',async()=>{
 const t=await currentImageFixture(),first=await t.image(),client=await t.connect();try{await client.query('BEGIN');const r=await resolveMetaKycAuthority(client,first.context,{outbound:true,environment:t.f.environment}),guard=currentImageOutboundGuard(client,r);assert.equal(guard.receiptId,currentImageReceiptId(first.context.eventId));assert.ok(guard.sourceIds.includes(t.f.worker.metadata.participant.kycChatChallenge.claimedEventId));assert.throws(()=>currentImageOutboundGuard({},r),{code:'META_KYC_CURRENT_IMAGE_REJECTED'});assert.throws(()=>currentImageOutboundGuard(client,{...r,mode:'CURRENT'}),{code:'META_KYC_CURRENT_IMAGE_REJECTED'});await client.query('ROLLBACK');}finally{client.release();}unchangedMedia(t.f);
});
test('an invited person can present CURRENT images without an invented account or operational permissions',async()=>{
 const t=await currentImageFixture('FRONT',{active:false}),permissions=structuredClone(t.f.worker.metadata.participant.permissions);await t.image();await t.image('150000212');await t.image('150000213');const saved=await t.confirm();assert.equal(saved.result.businessApplied,true);assert.equal(t.f.worker.metadata.participant.status,'INVITED');assert.equal(t.f.worker.metadata.participant.kyc.status,'PENDING_ACCOUNT_CLAIM');assert.deepEqual(t.f.worker.metadata.participant.permissions,permissions);assert.equal(t.f.identityCalls.findInvitation,0);assert.equal(t.f.identityCalls.verifiedEmail,0);assert.ok([...t.f.audits.values()].filter(a=>a.action==='participant.kyc_chat.image_context').every(a=>a.actorId===t.f.issuer.actorId));
});
test('concurrent replay of the same event advances once with one CURRENT receipt and one original dispatch',async()=>{
 const t=await currentImageFixture(),context=t.receive(photo('150000211')),[a,b]=await Promise.all([t.bridge.execute(context),t.bridge.execute(context)]);assert.deepEqual(a,b);assert.equal(t.f.state().step,'BACK');assert.equal([...t.f.audits.values()].filter(a=>a.action==='participant.kyc_chat.image_context').length,1);assert.ok(t.f.audits.get(metaKycDispatchReceiptId(context.eventId)));unchangedMedia(t.f);
});
for(const outcome of ['ROLLBACK','LOST_ACK'])test('CURRENT transaction '+outcome+' preserves the durable truth and recovers the same inbound without a second stage advance',async()=>{
 const t=await currentImageFixture(),context=t.receive(photo('150000211')),before=structuredClone(t.f.worker);t.currentControls.commit=outcome;await assert.rejects(()=>t.bridge.execute(context));if(outcome==='ROLLBACK'){assert.equal(receipt(t,context.eventId),undefined);assert.deepEqual(t.f.worker,before);}else {assert.ok(receipt(t,context.eventId));assert.equal(t.f.state().step,'BACK');}const result=await t.bridge.execute(context);assert.equal(result.kind,'KYC_CHAT');assert.equal(t.f.state().step,'BACK');assert.equal([...t.f.audits.values()].filter(a=>a.action==='participant.kyc_chat.image_context').length,1);unchangedMedia(t.f);
});
test('a changed media descriptor under the same WAMID cannot reuse its original receipt',async()=>{
 const t=await currentImageFixture(),first=await t.image(),before=structuredClone(t.f.worker);rewriteContextEvent({...t,context:first.context},p=>{p.value.image.id='150000299';});await assert.rejects(()=>t.bridge.execute(first.context));assert.deepEqual(t.f.worker,before);assert.equal([...t.f.audits.values()].filter(a=>a.action==='participant.kyc_chat.image_context').length,1);unchangedMedia(t.f);
});
test('a committed CURRENT without its next outbox recovers its same dispatch before another image can be accepted',async()=>{
 const t=await currentImageFixture(),context=t.receive(photo('150000211')),result=await t.bridge.execute(context);assert.equal(t.f.state().step,'BACK');const next=t.receive(photo('150000212'));await assert.rejects(()=>t.bridge.execute(next));assert.equal(t.f.state().step,'BACK');assert.deepEqual(await t.bridge.execute(context),result);await t.outbound.send(context,result.reply);await t.image('150000212');assert.equal(t.f.state().step,'SELFIE');unchangedMedia(t.f);
});
for(const step of ['CONSENT','BACK_CONSENT','OCR','BIOMETRIC','CONFIRM'])test('ordinary image cannot capture or grant consent at '+step,async()=>{
 const t=await currentImageFixture(step),before=structuredClone(t.f.worker),context=t.receive(photo('150000211'));await assert.rejects(()=>t.bridge.execute(context));assert.deepEqual(t.f.worker,before);assert.equal(receipt(t,context.eventId),undefined);unchangedMedia(t.f);
});
for(const type of ['equal-source-second','before-outbox-confirmation','same-outbox-second'])test('CURRENT rejects a photo without a strict causal prompt barrier: '+type,async()=>{
 const t=await currentImageFixture(),source=t.f.state().lastMessageTimestamp,out=[...t.f.outbounds.values()].at(-1),accepted=Date.parse(out.outcome.completedAt),timestamp=type==='equal-source-second'?source:Math.floor(accepted/1000),context=t.receive({...photo('150000211'),timestamp:String(timestamp)});if(type==='before-outbox-confirmation')t.f.events.get(context.eventId).createdAt=new Date(accepted-1);const before=structuredClone(t.f.worker);await assert.rejects(()=>t.bridge.execute(context),{code:'META_KYC_CURRENT_IMAGE_ORDER'});assert.deepEqual(t.f.worker,before);assert.equal(receipt(t,context.eventId),undefined);unchangedMedia(t.f);
});
test('concurrent different images against one confirmed prompt cannot silently become front and back',async()=>{
 const t=await currentImageFixture(),a=t.receive(photo('150000211')),b=t.receive(photo('150000212')),results=await Promise.allSettled([t.bridge.execute(a),t.bridge.execute(b)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(t.f.state().step,'BACK');assert.equal([...t.f.audits.values()].filter(r=>r.action==='participant.kyc_chat.image_context').length,1);unchangedMedia(t.f);
});
test('a known signed media SHA is checked against actual private bytes before any Blob upload',async()=>{
 const t=await currentImageFixture();await t.image('150000211',{sha256:createHash('sha256').update(lifecyclePng).digest('hex')});await t.image('150000212',{sha256:'a'.repeat(64)});await t.image('150000213');const result=await t.confirm();assert.equal(result.result.businessApplied,false);assert.equal(t.f.state().step,'FRONT');assert.match(result.result.reply.body,/No pudimos validar las imágenes/);assert.equal(t.f.blob.puts(),0);assert.equal(t.f.worker.metadata.participant.kyc.status,'NOT_SUBMITTED');
 await t.image('150000221');await t.image('150000222');await t.image('150000223');const saved=await t.confirm();assert.equal(saved.result.businessApplied,true);assert.equal(t.f.worker.metadata.participant.kyc.status,'PENDING_REVIEW');assert.equal(t.f.blob.puts(),3);
});
test('delivery and read observations preserve the immutable causal timestamp and existing CURRENT proof',async()=>{
 const t=await currentImageFixture(),anchor=[...t.f.outbounds.values()].at(-1),accepted=anchor.outcome.completedAt,first=await t.image();anchor.outcome={...anchor.outcome,state:'STATUS_OBSERVED',providerStatus:'read',statusObservedAt:new Date(Date.now()+1000).toISOString()};anchor.processedAt=new Date(Date.now()+1000);assert.equal(anchor.outcome.completedAt,accepted);assert.deepEqual(await t.bridge.execute(first.context),first.result);await t.image('150000212');assert.equal(t.f.state().step,'SELFIE');unchangedMedia(t.f);
});
test('a status-first outbox without a durable send completion cannot authorize CURRENT',async()=>{
 const t=await currentImageFixture(),anchor=[...t.f.outbounds.values()].at(-1);anchor.outcome.state='STATUS_OBSERVED';anchor.outcome.providerStatus='delivered';delete anchor.outcome.completedAt;anchor.processedAt=new Date();const context=t.receive(photo('150000211')),before=structuredClone(t.f.worker);await assert.rejects(()=>t.bridge.execute(context),{code:'META_KYC_CURRENT_IMAGE_REJECTED'});assert.deepEqual(t.f.worker,before);unchangedMedia(t.f);
});
for(const [name,change]of [
 ['unsigned inbound',t=>{delete t.f.events.get(t.context.eventId).payload.encryptedProof;}],
 ['explicit malformed context',t=>rewriteContextEvent(t,p=>{p.value.context={};})],
 ['issuer revoked',t=>{t.f.controls.issuerActive=false;}],
 ['participant revoked',t=>{t.f.controls.workerMembershipActive=false;}],
 ['project assignment revoked',t=>{t.f.controls.projectAssignmentActive=false;}],
 ['company assignment revoked',t=>{t.f.control.assignment=false;}],
 ['two current attempts',t=>{t.reminderControls.ambiguous=true;}],
 ['expired source lease',t=>{t.f.events.get(t.context.eventId).leaseExpiresAt=new Date(t.f.now.getTime()-1);}],
])test('CURRENT cannot bypass '+name+' through the no-reply destination resolver',async()=>{
 const t=await currentImageFixture();t.context=t.receive(photo('150000211'));change(t);const before=structuredClone(t.f.worker),audits=t.f.audits.size;let result;try{result=await t.bridge.execute(t.context);}catch(error){assert.ok(error instanceof WorkspaceError);result=null;}assert.equal(result,null);assert.equal(receipt(t,t.context.eventId),undefined);assert.deepEqual(t.f.worker,before);assert.equal(t.f.audits.size,audits);unchangedMedia(t.f);
});
test('two distinct current captures deny CURRENT before any stage can be chosen',async()=>{
 const t=await currentImageFixture(),metadata=structuredClone(t.f.worker.metadata);metadata.participant.kycChatChallenge.id='kyc_chat_other_current';metadata.participant.kycChatChallenge.workerId='other-worker';metadata.participant.kycChatConversation.challengeId='kyc_chat_other_current';t.reminderControls.extraDiscoveryRows=[{reminderWorkerId:'other-worker',projectId:t.f.target.id,metadata}];const context=t.receive(photo('150000211')),before=structuredClone(t.f.worker);await assert.rejects(()=>t.bridge.execute(context),{code:'META_KYC_CURRENT_IMAGE_REJECTED'});assert.equal(receipt(t,context.eventId),undefined);assert.deepEqual(t.f.worker,before);unchangedMedia(t.f);
});
test('caller flags cannot select CURRENT when a malformed explicit quote is present',async()=>{
 const t=await currentImageFixture(),context={...t.receive({...photo('150000211'),context:{}}),mode:'CURRENT',currentImage:true},before=structuredClone(t.f.worker);assert.equal(await t.bridge.execute(context),null);assert.deepEqual(t.f.worker,before);assert.equal(receipt(t,context.eventId),undefined);unchangedMedia(t.f);
});
test('revocation after outbound reservation prevents sending the next prompt for a committed CURRENT capture',async()=>{
 const t=await currentImageFixture(),sends=t.f.controls.sends;t.currentControls.afterReserve=()=>{t.f.controls.issuerActive=false;};await assert.rejects(()=>t.image(),{code:'META_KYC_CHALLENGE_REVOKED'});assert.equal(t.f.state().step,'BACK');assert.equal([...t.f.audits.values()].filter(a=>a.action==='participant.kyc_chat.image_context').length,1);assert.equal(t.f.controls.sends,sends);assert.equal([...t.f.outbounds.values()].at(-1).outcome.state,'SEND_STARTED');unchangedMedia(t.f);
});
test('TTL crossed after CURRENT receipt insertion rolls back receipt, projection, dispatch and Worker together',async()=>{
 const t=await currentImageFixture(),context=t.receive(photo('150000211')),before=structuredClone(t.f.worker),audits=t.f.audits.size;let crossed=false;t.controls.beforeSql=(sql)=>{if(!crossed&&sql.includes("'participant.kyc_chat.image_context'")){crossed=true;t.f.now.setTime(Date.parse(t.f.state().expiresAt));t.f.events.get(context.eventId).leaseExpiresAt=new Date(t.f.now.getTime()+60000);}};
 await assert.rejects(()=>t.bridge.execute(context),{code:'META_KYC_CHALLENGE_EXPIRED'});assert.equal(crossed,true);assert.deepEqual(t.f.worker,before);assert.equal(t.f.audits.size,audits);assert.equal(receipt(t,context.eventId),undefined);unchangedMedia(t.f);
});
test('failure between CURRENT receipt and Worker update rolls back the complete stage transition',async()=>{
 const t=await currentImageFixture(),context=t.receive(photo('150000211')),before=structuredClone(t.f.worker),audits=t.f.audits.size;let failed=false;t.controls.beforeSql=sql=>{if(!failed&&sql.startsWith('UPDATE public."Worker"')){failed=true;throw Error('SYNTHETIC_STAGE_WRITE_FAILURE');}};await assert.rejects(()=>t.bridge.execute(context));assert.equal(failed,true);assert.deepEqual(t.f.worker,before);assert.equal(t.f.audits.size,audits);assert.equal(receipt(t,context.eventId),undefined);unchangedMedia(t.f);
});
test('a failed original prompt after Graph await blocks CDN and every Blob write for CURRENT sources',async()=>{
 const t=await currentImageFixture(),anchor=[...t.f.outbounds.values()].at(-1);await t.image();await t.image('150000212');await t.image('150000213');t.f.control.afterGraph=()=>{anchor.outcome.providerStatus='failed';};await assert.rejects(()=>t.confirm(),{code:'META_KYC_CURRENT_IMAGE_REJECTED'});assert.equal(t.f.control.graph,1);assert.equal(t.f.control.cdn,0);assert.equal(t.f.blob.puts(),0);assert.equal(t.f.worker.metadata.participant.kyc.status,'NOT_SUBMITTED');
});
test('deposit denies a missing or changed CURRENT receipt even though the signed media projection still exists',async()=>{
 for(const kind of ['missing','changed']){const t=await currentImageFixture(),first=await t.image();await t.image('150000212');await t.image('150000213');if(kind==='missing')t.f.audits.delete(currentImageReceiptId(first.context.eventId));else receipt(t,first.context.eventId).metadata.stage='SELFIE';await assert.rejects(()=>t.confirm(),{code:'META_KYC_CURRENT_IMAGE_REJECTED'});assert.equal(t.f.blob.puts(),0);assert.equal(t.f.control.graph,0);}
});
test('production priority sends an eligible unquoted image through capture before every generic adapter',async()=>{
 const t=await currentImageFixture(),f=t.f,context=t.receive(photo('150000211')),event=f.events.get(context.eventId);event.leaseToken=null;event.leaseExpiresAt=null;event.attempts=0;let other=0;
 const connect=async()=>{const c=await t.connect();return {release:()=>c.release(),query:async(sql,args=[])=>{if(sql.startsWith('UPDATE public."WebhookEvent" SET "leaseToken"=$2')&&f.events.has(args[0])){const e=f.events.get(args[0]);e.leaseToken=args[1];e.leaseExpiresAt=args[2];return {rows:[],rowCount:1};}if(sql.startsWith('UPDATE public."WebhookEvent" SET status=\'PROCESSED\'')&&f.events.has(args[0])){const e=f.events.get(args[0]);e.status='PROCESSED';e.outcome=JSON.parse(args[3]);e.leaseToken=null;return {rows:[],rowCount:1};}return c.query(sql,args);}};};
 const unused={execute:async()=>{other++;throw Error('Unrelated adapter must not run');},send:async()=>{other++;throw Error('Unrelated send must not run');}},none={send:unused.send,rejection:async()=>null,feedback:async()=>null},processor=createMetaCustomerProductionProcessor({connect,environment:f.environment,now:()=>f.now.getTime(),authorizationCodes:[...META_KYC_AUTHORIZATION_CODES,'META_KYC_CONTEXT_FEEDBACK_DENIED'],deferAuthorization:async()=>false,fieldBridge:unused,kycBridge:t.bridge,kycOutbound:t.outbound,appProjection:unused,companyBridge:unused,fieldOutbound:unused,companyOutbound:unused,isCompany:async()=>true,rejectedKyc:none,expiredKyc:none,contextKyc:t.adapter});
 const result=await processor.process(context.eventId);assert.equal(result.processed,true);assert.equal(result.kind,'KYC_CHAT');assert.equal(f.state().step,'BACK');assert.equal(other,0);assert.ok(receipt(t,context.eventId));assert.equal(f.audits.get(metaKycDispatchReceiptId(context.eventId)).metadata.payloadDigest,context.payloadDigest);unchangedMedia(f);
});
