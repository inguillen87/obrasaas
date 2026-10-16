import {participantOcrNotice,participantBiometricNotice} from './participant-analysis-consent.mjs';
import {createHash} from 'node:crypto';
import {WorkspaceError,digest} from './workspace-policy.mjs';
import {usageDigest} from './organization-usage-policy.mjs';
import {decodeSignedCustomerEvent} from './meta-customer-processing.mjs';
import {decodeWorkerChannelProof} from './worker-channel-identity.mjs';
import {encryptCustomerSecret,decryptCustomerSecret} from './meta-customer-credentials.mjs';
import {customerOutboundId} from './meta-customer-outbound.mjs';
import {planMetaKycConversation,META_KYC_CONVERSATION_TTL_MS} from './meta-kyc-conversation.mjs';
import {companyKycProjectionDigest} from './company-channel-kyc.mjs';
import {PARTICIPANT_NOTICE,PARTICIPANT_NOTICE_VERSION,PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE_VERSION,PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE_SHA256} from './participant-policy.mjs';

const discoveries=new WeakMap(),prepared=new WeakMap(),fail=(code='META_KYC_CURRENT_IMAGE_REJECTED')=>{throw new WorkspaceError(code,409);};
const stages=Object.freeze({FRONT:['front','BACK'],BACK:['back','SELFIE'],SELFIE:['selfie','CONFIRM']});
const eventId=value=>/^customer_webhook_[a-f0-9]{64}$/.test(value||'');
const instant=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const dispatchId=id=>'meta_kyc_dispatch_'+digest(['meta-kyc-dispatch-v1',id]);
const projectionId=id=>'company_kyc_projection_'+digest(['company-kyc-projection-v1',id]);
export const currentImageReceiptId=id=>{if(!eventId(id))fail();return 'meta_kyc_image_context_'+usageDigest(['meta-kyc-current-image-v1',id]);};
const aad=(r,purpose,resourceId)=>({organizationId:r.project.organizationId,projectId:r.connection.projectId,purpose,resourceId});
const referenceDigest=ref=>usageDigest([ref?.eventId,ref?.mediaId,ref?.contentType]);
function imageDescriptor(message){
 if(message?.type!=='image'||Object.hasOwn(message,'context')||typeof message.image?.id!=='string'||!/^\d{5,32}$/.test(message.image.id)||!['image/jpeg','image/png','image/webp'].includes(message.image?.mime_type))fail();
 if(message.image.sha256!==undefined&&typeof message.image.sha256!=='string')fail();
 const raw=message.image.sha256,sha256=raw===undefined?null:/^[a-f0-9]{64}$/i.test(raw)?raw.toLowerCase():/^[A-Za-z0-9+/]{43}=$/.test(raw)?Buffer.from(raw,'base64').toString('hex'):null;
 if(raw!==undefined&&!sha256)fail();return {mediaId:message.image.id,contentType:message.image.mime_type,sha256};
}
function consentDigest(s){return usageDigest([s.noticeVersion,s.noticeSha256,s.consent,s.backNoticeVersion,s.backNoticeSha256,s.backConsent,s.ocrNoticeVersion,s.ocrNoticeSha256,s.ocrConsent,s.biometricNoticeVersion,s.biometricNoticeSha256,s.biometricConsent]);}
function assertState(s){
 if(s?.version!==1||s.captureImageSetVersion!==2||!Object.hasOwn(stages,s.step)||s.consent!==true||s.backConsent!==true||typeof s.ocrConsent!=='boolean'||typeof s.biometricConsent!=='boolean'||s.noticeVersion!==PARTICIPANT_NOTICE_VERSION||s.noticeSha256!==digest(PARTICIPANT_NOTICE)||s.backNoticeVersion!==PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE_VERSION||s.backNoticeSha256!==PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE_SHA256||!participantOcrNotice(s.ocrNoticeVersion)||s.ocrNoticeSha256!==participantOcrNotice(s.ocrNoticeVersion).sha256||!participantBiometricNotice(s.biometricNoticeVersion)||s.biometricNoticeSha256!==participantBiometricNotice(s.biometricNoticeVersion).sha256||s[stages[s.step][0]]!==null||s.confirmationEventId)fail();
 if(!eventId(s.lastEventId)||!Number.isSafeInteger(s.lastMessageTimestamp)||!instant(s.expiresAt)||s.step!=='FRONT'&&!eventId(s.front?.eventId)||s.step==='SELFIE'&&!eventId(s.back?.eventId))fail();
}
function assertCausal(r,s,acceptedAt){
 if(!instant(acceptedAt)||typeof r.payload.value.timestamp!=='string'||!/^\d{1,14}$/.test(r.payload.value.timestamp)||!Number.isSafeInteger(Number(r.payload.value.timestamp))||Number(r.payload.value.timestamp)<=Math.floor(Date.parse(acceptedAt)/1000)||Number(r.payload.value.timestamp)<=s.lastMessageTimestamp||!(r.event.createdAt instanceof Date)||!Number.isFinite(r.event.createdAt.getTime())||r.event.createdAt.getTime()<Date.parse(acceptedAt))fail('META_KYC_CURRENT_IMAGE_ORDER');
}
export function currentImageStageEligible(r){try{assertState(r.state);imageDescriptor(r.payload.value);assertCausal(r,r.state,r.prompt?.acceptedAt);return true;}catch(error){if(error instanceof WorkspaceError)return false;throw error;}}
// Only the canonical corporate resolver calls this; no message/caller option
// selects this capability. Its anchor is fixed before waiting for Worker locks.
export function markCurrentImageDiscovery(r,sourceEventId){if(!eventId(sourceEventId))fail();discoveries.set(r,sourceEventId);}
function binding(r,projection){return {organizationId:r.project.organizationId,channelId:r.connection.id,anchorProjectId:r.connection.projectId,projectId:r.project.id,workerId:r.worker.id,challengeId:r.challenge.id,projectionDigest:usageDigest(projection),issuerActorId:r.issuer.actorId,issuerMembershipId:r.issuer.membershipId,memberActorId:r.member.actorId,memberMembershipId:r.member.membershipId};}
async function sourceDispatch(client,r,id,environment){
 const sources=(await client.query(`SELECT * FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 FOR SHARE`,[id,r.connection.projectId])).rows;
 if(sources.length!==1)fail();const source=sources[0],signed=decodeSignedCustomerEvent(source,r.connection,environment);decodeWorkerChannelProof(source,r.connection,environment);
 if(signed.type!=='message'||signed.value.from!==r.payload.value.from)fail();
 const projections=(await client.query(`SELECT id,"actorId","entityId",metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND action='participant.kyc_chat.projected' AND "entityType"='Worker' FOR SHARE`,[projectionId(id),r.project.organizationId])).rows;
 const p=projections[0],expected={...r.companyKyc,sourceEventId:id,payloadDigest:source.payload.payloadDigest};
 if(projections.length!==1||p.entityId!==r.worker.id||p.actorId!==(expected.participantActorId||expected.issuerActorId)||usageDigest(p.metadata)!==usageDigest(expected))fail();
 const receipts=(await client.query(`SELECT metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "entityId"=$3 AND action='participant.kyc_chat.dispatched' FOR SHARE`,[dispatchId(id),r.project.organizationId,r.worker.id])).rows,m=receipts[0]?.metadata;
 if(receipts.length!==1||m?.version!==1||m.projectId!==r.project.id||m.challengeId!==r.challenge.id||m.captureImageSetVersion!==2||m.payloadDigest!==source.payload.payloadDigest)fail();
 let value;try{value=JSON.parse(decryptCustomerSecret(m.encryptedResult,aad(r,'kyc-chat-dispatch',dispatchId(id)),environment));}catch{fail();}
 if(value?.kind!=='KYC_CHAT'||value.identityStatus!=='LIMITED_KYC_UPLOAD'||m.replyDigest!==digest(value.reply))fail();return {source,signed,metadata:m,value,projection:expected};
}
async function promptProof(client,r,id,environment){
 const source=await sourceDispatch(client,r,id,environment),outId=customerOutboundId(id),outs=(await client.query(`SELECT id,payload,outcome,"processedAt" FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-outbound-v1' FOR SHARE`,[outId,r.connection.projectId])).rows;
 if(outs.length!==1)fail();const out=outs[0];let request;try{request=JSON.parse(decryptCustomerSecret(out.payload.encryptedPayload,aad(r,'outbound',outId),environment));}catch{fail();}
 if(out.id!==outId||!(out.processedAt instanceof Date)||!Number.isFinite(out.processedAt.getTime())||!instant(out.outcome?.completedAt)||!['SENT','STATUS_OBSERVED'].includes(out.outcome?.state)||['failed','deleted'].includes(out.outcome?.providerStatus)||!/^wamid\./.test(out.outcome.messageId||'')||out.payload.requestDigest!==digest(request)||request.version!==1||request.channelPurpose!=='KYC_CAPTURE'||request.eventId!==id||request.organizationId!==r.project.organizationId||request.channelId!==r.connection.id||request.targetProjectId!==r.project.id||request.challengeId!==r.challenge.id||request.companyKycDigest!==companyKycProjectionDigest(source.projection)||request.to!==r.payload.value.from||request.replyTo!==source.signed.value.id||request.payloadDigest!==source.source.payload.payloadDigest||digest(request.message)!==digest(source.value.reply))fail();
 // processedAt/statusObservedAt advance on delivery/read. completedAt is the
 // durable first send completion and remains stable through those observations.
 return {sourceEventId:id,outboundId:outId,messageId:out.outcome.messageId,requestDigest:out.payload.requestDigest,acceptedAt:out.outcome.completedAt};
}
const normalizeAfter=(r,s)=>({...s,challengeId:r.challenge.id,lastEventId:r.event.id,lastMessageTimestamp:Number(r.payload.value.timestamp),expiresAt:new Date(Date.parse(r.challenge.claimedAt)+META_KYC_CONVERSATION_TTL_MS).toISOString()});
async function readReceipt(client,r,source,projection,environment){
 const id=currentImageReceiptId(source.id),rows=(await client.query(`SELECT id,"actorId","entityId",metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND action='participant.kyc_chat.image_context' AND "entityType"='Worker' FOR SHARE`,[id,r.project.organizationId])).rows;
 if(!rows.length)return null;if(rows.length!==1)fail();const row=rows[0],m=row.metadata;let proof;try{proof=JSON.parse(decryptCustomerSecret(m.encryptedProof,aad(r,'kyc-current-image-v1',id),environment));}catch{fail();}
 const payload=decodeSignedCustomerEvent(source,r.connection,environment);decodeWorkerChannelProof(source,r.connection,environment);const descriptor=imageDescriptor(payload.value),local={...r,event:source,payload};
 if(row.actorId!==r.member.actorId||row.entityId!==r.worker.id||m.version!==1||m.mode!=='CURRENT'||m.projectId!==r.project.id||m.anchorProjectId!==r.connection.projectId||m.workerId!==r.worker.id||m.challengeId!==r.challenge.id||m.sourceEventId!==source.id||m.payloadDigest!==source.payload.payloadDigest||proof?.version!==1||proof.mode!=='CURRENT'||m.proofDigest!==usageDigest(proof)||usageDigest(proof.binding)!==usageDigest(binding(r,projection))||proof.inboundMessageDigest!==usageDigest(payload.value.id)||usageDigest(proof.image)!==usageDigest(descriptor)||m.identityCertified!==false||m.permissionsGranted!==false)fail();
 assertState(proof.beforeState);assertCausal(local,proof.beforeState,proof.anchor?.acceptedAt);
 const plan=planMetaKycConversation({state:proof.beforeState,message:payload.value,eventId:source.id}),after=normalizeAfter(local,plan.state),field=stages[proof.beforeState.step][0];
 if(plan.deposit||usageDigest(after)!==usageDigest(proof.afterState)||m.stage!==proof.beforeState.step||m.nextStage!==stages[m.stage][1]||m.nextStage!==after.step||m.referenceDigest!==referenceDigest(after[field])||m.consentDigest!==consentDigest(proof.beforeState)||consentDigest(after)!==m.consentDigest||m.promptSourceEventId!==proof.anchor.sourceEventId||m.promptRequestDigest!==proof.anchor.requestDigest||proof.beforeState.lastEventId!==proof.anchor.sourceEventId)fail();
 const anchor=await promptProof(client,local,proof.anchor.sourceEventId,environment);if(usageDigest(anchor)!==usageDigest(proof.anchor))fail();await sourceDispatch(client,local,r.challenge.claimedEventId,environment);return {metadata:m,proof};
}
export async function prepareCurrentImageContext(client,r,environment){
 if(!r.companyKyc||r.payload.value.type!=='image'||Object.hasOwn(r.payload.value,'context'))return;
 const prior=await readReceipt(client,r,r.event,r.companyKyc,environment);
 if(prior){if(!r.recorded)fail();prepared.set(r,{client,prior});return;}
 const anchorId=discoveries.get(r);if(!anchorId||r.recorded||r.challenge.captureImageSetVersion!==2||r.state?.lastEventId!==anchorId)fail();assertState(r.state);
 const image=imageDescriptor(r.payload.value);for(const ref of [r.state.front,r.state.back,r.state.selfie])if(ref?.mediaId===image.mediaId)fail();
 const anchor=await promptProof(client,r,anchorId,environment);assertCausal(r,r.state,anchor.acceptedAt);await sourceDispatch(client,r,r.challenge.claimedEventId,environment);
 prepared.set(r,{client,beforeState:structuredClone(r.state),image,anchor,binding:binding(r,r.companyKyc)});
}
export async function recordCurrentImageContext(client,r,nextState,environment){
 const cap=prepared.get(r);if(!cap)return;if(cap.client!==client||cap.prior)fail();
 const plan=planMetaKycConversation({state:cap.beforeState,message:r.payload.value,eventId:r.event.id});
 if(plan.deposit||usageDigest(plan.state)!==usageDigest(nextState)||usageDigest(binding(r,r.companyKyc))!==usageDigest(cap.binding))fail();
 const afterState=normalizeAfter(r,nextState),stage=cap.beforeState.step,proof={version:1,mode:'CURRENT',binding:cap.binding,inboundMessageDigest:usageDigest(r.payload.value.id),image:cap.image,anchor:cap.anchor,beforeState:cap.beforeState,afterState},id=currentImageReceiptId(r.event.id);
 const metadata={version:1,mode:'CURRENT',projectId:r.project.id,anchorProjectId:r.connection.projectId,workerId:r.worker.id,challengeId:r.challenge.id,sourceEventId:r.event.id,payloadDigest:r.event.payload.payloadDigest,stage,nextStage:afterState.step,promptSourceEventId:cap.anchor.sourceEventId,promptRequestDigest:cap.anchor.requestDigest,referenceDigest:referenceDigest(afterState[stages[stage][0]]),consentDigest:consentDigest(cap.beforeState),proofDigest:usageDigest(proof),encryptedProof:encryptCustomerSecret(JSON.stringify(proof),aad(r,'kyc-current-image-v1',id),environment),identityCertified:false,permissionsGranted:false};
 await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'participant.kyc_chat.image_context','Worker',$4,$5::jsonb)`,[id,r.project.organizationId,r.member.actorId,r.worker.id,JSON.stringify(metadata)]);
}
export function currentImageOutboundGuard(client,r){
 if(!r.companyKyc||r.payload.value.type!=='image'||Object.hasOwn(r.payload.value,'context'))return null;
 const cap=prepared.get(r);if(cap?.client!==client||!cap.prior||!r.recorded)fail();
 return {receiptId:currentImageReceiptId(r.event.id),proofDigest:cap.prior.metadata.proofDigest,sourceIds:[...new Set([cap.prior.proof.anchor.sourceEventId,customerOutboundId(cap.prior.proof.anchor.sourceEventId),r.challenge.claimedEventId])]};
}
export async function assertCurrentImageSource(client,r,source,projection,reference,environment){
 const payload=decodeSignedCustomerEvent(source,r.connection,environment);if(Object.hasOwn(payload.value,'context'))return;
 const previous=await readReceipt(client,r,source,projection,environment);if(!previous||previous.metadata.referenceDigest!==referenceDigest(reference))fail();
}
export async function assertCurrentImageBytes(client,r,reference,bytes,environment){
 const rows=(await client.query(`SELECT metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND action='participant.kyc_chat.image_context' AND "entityType"='Worker' FOR SHARE`,[currentImageReceiptId(reference.eventId),r.project.organizationId])).rows;if(!rows.length)return;
 let proof;try{proof=JSON.parse(decryptCustomerSecret(rows[0].metadata.encryptedProof,aad(r,'kyc-current-image-v1',currentImageReceiptId(reference.eventId)),environment));}catch{fail();}
 if(proof.image?.sha256&&createHash('sha256').update(bytes).digest('hex')!==proof.image.sha256)fail('META_KYC_MEDIA_INTEGRITY');
}
