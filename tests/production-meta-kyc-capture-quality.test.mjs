import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {WorkspaceError,digest} from '../src/lib/workspace-policy.mjs';
import {beginMetaKycConversation} from '../src/lib/meta-kyc-conversation.mjs';
import {createMetaKycBridge} from '../src/lib/meta-kyc-bridge.mjs';
import {metaKycDispatchReceiptId} from '../src/lib/meta-kyc-identity.mjs';
import {PARTICIPANT_NOTICE,PARTICIPANT_NOTICE_VERSION} from '../src/lib/participant-policy.mjs';
import {CAPTURE_QUALITY_NOTICE} from '../src/lib/capture-quality-policy.mjs';
import {customerReplyMessage} from '../src/lib/meta-customer-provider.mjs';
import {kycMemoryFixture} from './fixtures/meta-kyc-chat-memory.mjs';
import {currentImageFixture} from './fixtures/meta-kyc-current-image-memory.mjs';
import {syntheticCaptureQuality} from './fixtures/capture-quality-synthetic.mjs';

const photo=id=>({type:'image',image:{id,mime_type:'image/png'}});
const noticeFields=['consent','noticeVersion','noticeSha256','ocrConsent','ocrNoticeVersion','ocrNoticeSha256','biometricConsent','biometricNoticeVersion','biometricNoticeSha256','backConsent','backNoticeVersion','backNoticeSha256'];
function noSubmission(f,permissions){assert.equal(f.blob.puts(),0);assert.equal(f.worker.metadata.participant.kyc.status,'NOT_SUBMITTED');assert.deepEqual(f.worker.metadata.participant.permissions,permissions);assert.equal(f.worker.metadata.participant.kycChatChallenge.status,'CLAIMED');assert.equal([...f.audits.values()].filter(row=>row.metadata.kind==='KYC_SUBMITTED').length,0);}
function sameNotices(after,before){for(const field of noticeFields)assert.deepEqual(after[field],before[field],field);}
function safeReply(result){customerReplyMessage(result.reply);assert.equal(result.businessApplied,false);assert.equal(result.reviewState,'OBSERVED');assert.match(result.reply.body,/todavía no se guardó/);assert.doesNotMatch(result.reply.body,/OpenAI|OpenCV|ONNX|YuNet|Hugging Face|https?:\/\/.*blob|data:image/);}

test('capture quality disclosure is additive and preserves historical notice versions and hashes',()=>{
 for(const captureImageSetVersion of [undefined,2]){const plan=beginMetaKycConversation('notice-quality',{captureImageSetVersion});customerReplyMessage(plan.reply);assert.ok(plan.reply.body.includes(CAPTURE_QUALITY_NOTICE));assert.ok(plan.reply.body.includes(PARTICIPANT_NOTICE));assert.equal(plan.state.noticeVersion,PARTICIPANT_NOTICE_VERSION);assert.equal(plan.state.noticeSha256,digest(PARTICIPANT_NOTICE));assert.equal(plan.state.consent,false);assert.equal(plan.state.ocrConsent,false);assert.equal(plan.state.biometricConsent,false);assert.doesNotMatch(CAPTURE_QUALITY_NOTICE,/OpenAI|OpenCV|ONNX|YuNet/);}
});

test('an unreadable document portrait returns WhatsApp to FRONT without storing images or approving a person',async()=>{
 const f=kycMemoryFixture({active:true,captureImageSetVersion:2});await f.toConfirmation();const before=f.state(),permissions=structuredClone(f.worker.metadata.participant.permissions);
 f.controls.quality=async value=>({...await syntheticCaptureQuality(value),state:'RETAKE_REQUIRED',reasonCodes:['DOCUMENT_PORTRAIT_UNCONFIRMED']});
 const failed=await f.choose('Guardar identidad'),after=f.state();safeReply(failed.result);noSubmission(f,permissions);sameNotices(after,before);
 assert.equal(after.step,'FRONT');assert.equal(after.front,null);assert.equal(after.back,null);assert.equal(after.selfie,null);assert.equal(after.confirmationEventId,null);assert.match(failed.result.reply.body,/foto del rostro/);
 const downloads=f.controls.downloads;assert.deepEqual(await f.bridge.execute(failed.context),failed.result);assert.equal(f.controls.downloads,downloads);noSubmission(f,permissions);
});

for(const captureImageSetVersion of [undefined,2])for(const [kind,field,step]of [['DOCUMENT_FRONT','front','FRONT'],...(captureImageSetVersion===2?[['DOCUMENT_BACK','back','BACK']]:[]),['SELFIE','selfie','SELFIE']])test(`quality retake of ${kind} in ${captureImageSetVersion===2?'three':'two'} images preserves valid predecessors and requires fresh descendants`,async()=>{
 const f=kycMemoryFixture({active:true,captureImageSetVersion});await f.toConfirmation();const before=f.state(),permissions=structuredClone(f.worker.metadata.participant.permissions);let rejected=true,checks=0;
 f.controls.quality=async value=>{checks++;const result=await syntheticCaptureQuality(value);return rejected&&value.kind===kind?{...result,state:'RETAKE_REQUIRED',reasonCodes:['IMAGE_BLURRED']}:result;};
 const failed=await f.choose('Guardar identidad'),after=f.state();safeReply(failed.result);noSubmission(f,permissions);sameNotices(after,before);assert.equal(after.step,step);assert.equal(after.confirmationEventId,null);assert.equal(after[field],null);
 if(field==='front'){assert.equal(after.selfie,null);if(captureImageSetVersion===2)assert.equal(after.back,null);}else {assert.deepEqual(after.front,before.front);if(field==='back')assert.equal(after.selfie,null);else if(captureImageSetVersion===2)assert.deepEqual(after.back,before.back);}
 const dispatch=f.audits.get(metaKycDispatchReceiptId(failed.context.eventId));assert.equal(dispatch.metadata.payloadDigest,failed.context.payloadDigest);assert.equal(dispatch.metadata.identityCertified,false);assert.equal(dispatch.metadata.permissionsGranted,false);
 const checkCount=checks,downloads=f.controls.downloads,sends=f.controls.sends;assert.deepEqual(await f.bridge.execute(failed.context),failed.result);await f.outbound.send(failed.context,failed.result.reply);assert.equal(checks,checkCount);assert.equal(f.controls.downloads,downloads);assert.equal(f.controls.sends,sends);assert.equal(f.blob.puts(),0);
 rejected=false;const fields=field==='front'?['front',...(captureImageSetVersion===2?['back']:[]),'selfie']:field==='back'?['back','selfie']:['selfie'];let serial=150000101;for(const replacement of fields){await f.execute(photo(String(serial++)));assert.notEqual(f.state()[replacement]?.eventId,before[replacement]?.eventId);}
 assert.equal(f.state().step,'CONFIRM');const saved=await f.choose('Guardar identidad');assert.equal(saved.result.businessApplied,true);assert.equal(f.blob.puts(),captureImageSetVersion===2?3:2);assert.equal(f.worker.metadata.participant.kyc.status,'PENDING_REVIEW');assert.deepEqual(f.worker.metadata.participant.permissions,permissions);assert.equal([...f.audits.values()].filter(row=>row.metadata.kind==='KYC_SUBMITTED').length,1);
});

for(const captureImageSetVersion of [undefined,2])test(`unavailable quality preserves every ${captureImageSetVersion===2?'three':'two'} image reference and retries only after a fresh confirmation`,async()=>{
 const f=kycMemoryFixture({active:true,captureImageSetVersion});await f.toConfirmation();const before=f.state(),permissions=structuredClone(f.worker.metadata.participant.permissions);let unavailable=true,checks=0;
 f.controls.quality=async value=>{checks++;const result=await syntheticCaptureQuality(value);return unavailable&&value.kind==='SELFIE'?{...result,state:'UNCERTAIN',reasonCodes:['QUALITY_SERVICE_UNAVAILABLE']}:result;};
 const failed=await f.choose('Guardar identidad'),after=f.state();safeReply(failed.result);noSubmission(f,permissions);sameNotices(after,before);assert.equal(after.step,'CONFIRM');assert.equal(after.confirmationEventId,null);for(const key of ['front','selfie',...(captureImageSetVersion===2?['back']:[])])assert.deepEqual(after[key],before[key]);assert.notEqual(after.nonce,before.nonce);assert.match(failed.result.reply.body,/Conservá las imágenes y volvé a intentar más tarde/);
 const checkCount=checks,downloads=f.controls.downloads,sends=f.controls.sends;assert.deepEqual(await f.bridge.execute(failed.context),failed.result);await f.outbound.send(failed.context,failed.result.reply);assert.equal(checks,checkCount);assert.equal(f.controls.downloads,downloads);assert.equal(f.controls.sends,sends);
 const stale=await f.execute({type:'interactive',interactive:{list_reply:{id:'kyc:'+before.nonce+':0'}}});assert.equal(stale.result.businessApplied,false);assert.equal(f.state().step,'CONFIRM');assert.equal(checks,checkCount);noSubmission(f,permissions);
 unavailable=false;const saved=await f.choose('Guardar identidad');assert.equal(saved.result.businessApplied,true);assert.equal(f.worker.metadata.participant.kyc.status,'PENDING_REVIEW');assert.equal(f.blob.puts(),captureImageSetVersion===2?3:2);assert.deepEqual(f.worker.metadata.participant.permissions,permissions);
});

test('CURRENT corporate selfie retake preserves original signed front and back sources through one later deposit',async()=>{
 const t=await currentImageFixture(),f=t.f;for(const id of ['150000211','150000212','150000213'])await t.image(id);const before=f.state(),permissions=structuredClone(f.worker.metadata.participant.permissions);let rejected=true,checks=0;
 f.controls.quality=async value=>{checks++;const result=await syntheticCaptureQuality(value);return rejected&&value.kind==='SELFIE'?{...result,state:'RETAKE_REQUIRED',reasonCodes:['SINGLE_FACE_REQUIRED']}:result;};
 const failed=await t.confirm(),after=f.state();safeReply(failed.result);noSubmission(f,permissions);assert.equal(after.step,'SELFIE');assert.deepEqual(after.front,before.front);assert.deepEqual(after.back,before.back);assert.equal(after.selfie,null);sameNotices(after,before);assert.match(failed.result.reply.body,/sin sostener el documento ni incluir a otra persona/);const count=checks;assert.deepEqual(await t.bridge.execute(failed.context),failed.result);assert.equal(checks,count);
 rejected=false;await t.image('150000214');const saved=await t.confirm();assert.equal(saved.result.businessApplied,true);assert.equal(f.blob.puts(),3);assert.equal(f.worker.metadata.participant.kyc.status,'PENDING_REVIEW');assert.deepEqual(f.worker.metadata.participant.permissions,permissions);assert.equal([...f.audits.values()].filter(row=>row.metadata.kind==='KYC_SUBMITTED').length,1);assert.equal(t.currentControls.scheduled.length,1);
});

test('unrecognized capture errors retain the original in-flight confirmation without corrective dispatch',async()=>{
 for(const error of [new WorkspaceError('PARTICIPANT_CAPTURE_SELFIE_UNKNOWN_REASON',422),new WorkspaceError('PARTICIPANT_CAPTURE_SOURCE_CHANGED',409),new WorkspaceError('PARTICIPANT_CAPTURE_SELFIE_IMAGE_BLURRED',409),new WorkspaceError('PARTICIPANT_CAPTURE_DOCUMENT_BACK_IMAGE_BLURRED',422),Object.assign(new Error('untrusted private detail'),{code:'PARTICIPANT_CAPTURE_SELFIE_IMAGE_BLURRED',status:422})]){
  const f=kycMemoryFixture({active:true});await f.toConfirmation();const s=f.state(),context=f.receive({type:'interactive',interactive:{list_reply:{id:'kyc:'+s.nonce+':0'}}}),bridge=createMetaKycBridge({connect:f.connect,provider:f.provider,deposit:{deposit:async()=>{throw error;}},environment:f.environment});
  await assert.rejects(()=>bridge.execute(context),caught=>caught===error);assert.equal(f.state().step,'FINALIZING');assert.equal(f.state().confirmationEventId,context.eventId);assert.equal(f.blob.puts(),0);assert.equal(f.audits.has(metaKycDispatchReceiptId(context.eventId)),false);
 }
});

for(const boundary of ['issuer','event-lease'])test('quality feedback cannot replace source authority after '+boundary+' revocation',async()=>{
 const f=kycMemoryFixture({active:true,captureImageSetVersion:2});await f.toConfirmation();const s=f.state(),context=f.receive({type:'interactive',interactive:{list_reply:{id:'kyc:'+s.nonce+':0'}}});
 f.controls.quality=async value=>{const result=await syntheticCaptureQuality(value);if(boundary==='issuer')f.controls.issuerActive=false;else f.events.get(context.eventId).leaseToken=randomUUID();return {...result,state:'RETAKE_REQUIRED',reasonCodes:['IMAGE_BLURRED']};};
 await assert.rejects(()=>f.bridge.execute(context),{code:boundary==='issuer'?'META_KYC_CHALLENGE_REVOKED':'META_CUSTOMER_INBOX_LEASE_CHANGED'});assert.equal(f.state().step,'FINALIZING');assert.equal(f.blob.puts(),0);assert.equal(f.worker.metadata.participant.kyc.status,'NOT_SUBMITTED');assert.equal(f.audits.has(metaKycDispatchReceiptId(context.eventId)),false);
});
