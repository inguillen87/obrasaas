import {randomUUID} from 'node:crypto';
import {WorkspaceError,digest,operationId,workspaceId} from './workspace-policy.mjs';
import {decodePrivateImage,PrivateImageError,createPrivateImageUploader} from './private-image-upload.mjs';
import {participantKeys,participantReceiptId,PARTICIPANT_NOTICE,PARTICIPANT_NOTICE_VERSION,PARTICIPANT_OCR_NOTICE,PARTICIPANT_OCR_NOTICE_VERSION,PARTICIPANT_BIOMETRIC_NOTICE,PARTICIPANT_BIOMETRIC_NOTICE_VERSION} from './participant-policy.mjs';
import {participantKycImageSet,participantKycDocumentBackReceipt,PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE_VERSION,PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE_SHA256} from './participant-kyc-image-set.mjs';
import {metaKycOperationId} from './meta-kyc-challenge.mjs';
import {fenceCompanyKycAuthority} from './company-channel-kyc.mjs';
import {invalidateWorkerChannelIdentity} from './worker-channel-identity.mjs';

const fail=(code,status=409)=>{throw new WorkspaceError(code,status);};
function depositInput(input){
 const backChoice=['captureImageSetVersion','back','backConsent','backNoticeVersion','backNoticeSha256'].some(key=>Object.hasOwn(input||{},key));
 const biometricChoice=Object.hasOwn(input||{},'biometricConsent')||Object.hasOwn(input||{},'biometricNoticeVersion');
 participantKeys(input,['operationId','noticeVersion','noticeSha256','consent','ocrConsent','ocrNoticeVersion','front','selfie',...(biometricChoice?['biometricConsent','biometricNoticeVersion']:[]),...(backChoice?['captureImageSetVersion','back','backConsent','backNoticeVersion','backNoticeSha256']:[])]);
 if(!operationId(input.operationId)||input.consent!==true||input.noticeVersion!==PARTICIPANT_NOTICE_VERSION||input.noticeSha256!==digest(PARTICIPANT_NOTICE))fail('PARTICIPANT_PRIVACY_REQUIRED',400);
 if(backChoice&&(input.captureImageSetVersion!==2||input.backConsent!==true||input.backNoticeVersion!==PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE_VERSION||input.backNoticeSha256!==PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE_SHA256))fail('PARTICIPANT_DOCUMENT_BACK_CONSENT_REQUIRED',400);
 if(typeof input.ocrConsent!=='boolean'||input.ocrNoticeVersion!==PARTICIPANT_OCR_NOTICE_VERSION)fail('PARTICIPANT_OCR_CONSENT_REQUIRED',400);
 if(biometricChoice&&(typeof input.biometricConsent!=='boolean'||input.biometricNoticeVersion!==PARTICIPANT_BIOMETRIC_NOTICE_VERSION))fail('PARTICIPANT_BIOMETRIC_CONSENT_REQUIRED',400);
 try{return {...input,biometricConsent:biometricChoice&&input.biometricConsent,biometricNoticeVersion:biometricChoice?input.biometricNoticeVersion:null,operationId:input.operationId.toLowerCase(),front:decodePrivateImage(input.front),selfie:decodePrivateImage(input.selfie),...(backChoice?{back:decodePrivateImage(input.back)}:{})};}catch(error){fail(error instanceof PrivateImageError?error.code:'PRIVATE_IMAGE_INVALID',error.code==='PRIVATE_IMAGE_TOO_LARGE'?413:400);}
}
function authority(r,input){
 const p=r?.worker?.metadata?.participant,s=r?.source,state=r?.state;
 if(r?.kind!=='LIMITED_KYC_UPLOAD'||!workspaceId(r.member?.actorId)||!workspaceId(r.member.organizationId)||r.member.organizationId!==r.project?.organizationId||r.worker?.projectId!==r.project.id||!r.worker.active||p?.version!==1||!['INVITED','ACTIVE'].includes(p.status)||s?.kind!=='META_KYC_CHAT'||s.challengeId!==r.challenge?.id||!/^customer_webhook_[a-f0-9]{64}$/.test(s.eventId||'')||!/^[a-f0-9]{64}$/.test(s.payloadDigest||'')||input.operationId!==metaKycOperationId(s.eventId))fail('META_KYC_CHALLENGE_REJECTED');
 if(p.status==='ACTIVE'&&(!p.clerkUserId||r.member.clerkUserId!==p.clerkUserId)||p.status==='INVITED'&&(p.clerkUserId||p.invitation?.state!=='SENT'||p.invitation.id!==r.challenge.invitationId))fail('META_KYC_CHALLENGE_REVOKED');
 if(state?.step!=='FINALIZING'||state.confirmationEventId!==s.eventId||state.consent!==input.consent||state.noticeVersion!==input.noticeVersion||state.noticeSha256!==input.noticeSha256||state.ocrConsent!==input.ocrConsent||state.ocrNoticeVersion!==input.ocrNoticeVersion||state.ocrNoticeSha256!==digest(PARTICIPANT_OCR_NOTICE)||!state.front||!state.selfie)fail('META_KYC_DEPOSIT_REQUIRED');
 if(input.biometricNoticeVersion&&(state.biometricConsent!==input.biometricConsent||state.biometricNoticeVersion!==input.biometricNoticeVersion||state.biometricNoticeSha256!==digest(PARTICIPANT_BIOMETRIC_NOTICE)))fail('META_KYC_DEPOSIT_REQUIRED');
 const back=r.challenge.captureImageSetVersion===2;
 if(state.captureImageSetVersion!==r.challenge.captureImageSetVersion||input.captureImageSetVersion!==r.challenge.captureImageSetVersion)fail('META_KYC_DEPOSIT_REQUIRED');
 if(back&&(state.backConsent!==true||input.backConsent!==true||state.backNoticeVersion!==PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE_VERSION||state.backNoticeSha256!==PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE_SHA256||input.backNoticeVersion!==state.backNoticeVersion||input.backNoticeSha256!==state.backNoticeSha256||!state.back))fail('META_KYC_DEPOSIT_REQUIRED');
 // Revision changes caused by our own deposit do not change channel authority.
 return digest(['participant-channel-authority-v1',r.member.actorId,r.member.organizationId,r.project.id,r.worker.id,p.status,p.clerkUserId||null,p.invitation?.id||null,r.challenge.id,r.challenge.issuerActorId,r.challenge.issuerMembershipId,s,state.front,state.selfie,...(back?[2,state.back,state.backConsent,state.backNoticeVersion,state.backNoticeSha256]:[])]);
}
const safeResult=(found,replayed)=>({saved:true,replayed,kind:'KYC_SUBMITTED',receiptId:found.id,submissionId:found.metadata.submissionId,status:found.metadata.status,identityCertified:false,permissionsGranted:false,whatsAppAccessGranted:false});
async function priorReceipt(client,r,key,fingerprint,existing=null){
 const found=existing||(await client.query(`SELECT id,"entityType","entityId",metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND action='participant.operation.recorded'`,[key,r.member.organizationId,r.member.actorId])).rows[0];
 if(!found)return null;
 if(found.entityType!=='Worker'||found.entityId!==r.worker.id||found.metadata.kind!=='KYC_SUBMITTED'||found.metadata.projectId!==r.project.id||found.metadata.requestDigest!==fingerprint||found.metadata.channelCapture?.sourceDigest!==digest(r.source))fail('PARTICIPANT_OPERATION_CONFLICT');
 const k=r.worker.metadata.participant.kyc;
 if(r.challenge.captureImageSetVersion===2){
  if(!participantKycDocumentBackReceipt(found.metadata,{projectId:r.project.id})||found.metadata.channelCapture?.receiptId!==found.id||found.metadata.channelCapture.challengeId!==r.challenge.id)fail('PARTICIPANT_RECEIPT_INVALID');
  if(k?.submissionId!==found.metadata.submissionId)return {...safeResult(found,true),superseded:true};
  if(!participantKycImageSet(k,{receipt:found.metadata,projectId:r.project.id}))fail('PARTICIPANT_RECEIPT_INVALID');
 }
 if(k?.submissionId!==found.metadata.submissionId||k.contentHash!==found.metadata.contentHash||k.channelCapture?.receiptId!==found.id)fail('PARTICIPANT_RECEIPT_INVALID');
 return safeResult(found,true);
}

const channelFingerprint=(authorityDigest,contentHash,input)=>digest([authorityDigest,contentHash,input.noticeVersion,input.noticeSha256,input.ocrNoticeVersion,input.ocrConsent,...(input.biometricNoticeVersion?[input.biometricNoticeVersion,input.biometricConsent]:[]),...(input.captureImageSetVersion===2?[2,input.backConsent,input.backNoticeVersion,input.backNoticeSha256]:[])]);
const sealedInput=r=>({operationId:metaKycOperationId(r.source.eventId),noticeVersion:r.state.noticeVersion,noticeSha256:r.state.noticeSha256,consent:r.state.consent,ocrConsent:r.state.ocrConsent,ocrNoticeVersion:r.state.ocrNoticeVersion,biometricConsent:r.state.biometricConsent,biometricNoticeVersion:r.state.biometricNoticeVersion,...(r.state.captureImageSetVersion===2?{captureImageSetVersion:2,backConsent:r.state.backConsent,backNoticeVersion:r.state.backNoticeVersion,backNoticeSha256:r.state.backNoticeSha256}:{})});
const guardedUploaders=new WeakSet();
export function createParticipantChannelKycUploader({put,get,environment=()=>process.env}){
 const legacy=createPrivateImageUploader({put,get,environment});
 const upload=async(value,filename,type,beforeExternal=null)=>{
  if(beforeExternal===null)return legacy.uploadImageToBlob(value,filename,type);
  if(typeof beforeExternal!=='function')fail('META_KYC_COMPANY_ADAPTER_UNAVAILABLE',503);
  let denied=null;
  const guarded=operation=>async(...args)=>{try{await beforeExternal();}catch(error){denied=error;throw error;}return operation(...args);};
  const uploader=createPrivateImageUploader({put:guarded(put),get:guarded(get),environment});
  try{return await uploader.uploadImageToBlob(value,filename,type);}catch(error){if(denied)throw denied;throw error;}
 };
 guardedUploaders.add(upload);return upload;
}
// This adapter has no public HTTP route. Only a pinned signed-channel resolver
// can grant limited deposit authority; caller-supplied worker IDs are rejected.
export function createParticipantChannelKycDeposit({connect,resolveAuthority,upload,environment=process.env}){
 if(typeof connect!=='function'||typeof resolveAuthority!=='function'||typeof upload!=='function')fail('PARTICIPANT_CHANNEL_ADAPTER_INVALID',500);
 async function transaction(callback){let client,broken=false;try{client=await connect();await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');await client.query("SET LOCAL statement_timeout='6s'");await client.query("SET LOCAL lock_timeout='2500ms'");const value=await callback(client);await client.query('COMMIT');return value;}catch(error){if(client)try{await client.query('ROLLBACK');}catch{broken=true;}if(error instanceof WorkspaceError)throw error;fail('PARTICIPANT_OPERATION_UNCONFIRMED',503);}finally{client?.release(broken);}}
 return {async recover(context){return transaction(async client=>{
  const r=await resolveAuthority(client,context,{deposit:true,environment}),input=sealedInput(r),authorityDigest=authority(r,input),key=participantReceiptId(r.member.actorId,r.project.id,input.operationId);
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[key]);
  const found=(await client.query(`SELECT id,"entityType","entityId",metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND action='participant.operation.recorded'`,[key,r.member.organizationId,r.member.actorId])).rows[0];
  if(!found){await fenceCompanyKycAuthority(client,r,context);return null;}
  if(!/^[a-f0-9]{64}$/.test(found.metadata?.contentHash||''))fail('PARTICIPANT_RECEIPT_INVALID');
  const result=await priorReceipt(client,r,key,channelFingerprint(authorityDigest,found.metadata.contentHash,input),found);await fenceCompanyKycAuthority(client,r,context);return result;
 });},async deposit(context,body){
  const input=depositInput(body),contentHash=digest([['DOCUMENT_FRONT',input.front.digest,input.front.bytes.length,input.front.contentType],['SELFIE',input.selfie.digest,input.selfie.bytes.length,input.selfie.contentType],...(input.back?[['DOCUMENT_BACK',input.back.digest,input.back.bytes.length,input.back.contentType]]:[])]);
  const prepare=await transaction(async client=>{
   const r=await resolveAuthority(client,context,{deposit:true,environment}),authorityDigest=authority(r,input),key=participantReceiptId(r.member.actorId,r.project.id,input.operationId),fingerprint=channelFingerprint(authorityDigest,contentHash,input);
   await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[key]);
   const prior=await priorReceipt(client,r,key,fingerprint);if(prior)return {done:prior};
   if(['PENDING_REVIEW','PENDING_ACCOUNT_CLAIM','APPROVED'].includes(r.worker.metadata.participant.kyc?.status))fail('PARTICIPANT_KYC_ALREADY_SUBMITTED');
   if((r.companyKyc||input.back)&&!guardedUploaders.has(upload))fail('META_KYC_COMPANY_ADAPTER_UNAVAILABLE',503);
   return {corporate:Boolean(r.companyKyc),guarded:Boolean(r.companyKyc||input.back),authorityDigest,key,fingerprint,organizationId:r.member.organizationId,projectId:r.project.id,workerId:r.worker.id,revision:r.worker.revision};
  });
  if(prepare.done)return prepare.done;
  const beforeExternal=prepare.guarded?()=>transaction(async client=>{const r=await resolveAuthority(client,context,{deposit:true,environment});if(prepare.corporate&&!r.companyKyc||authority(r,input)!==prepare.authorityDigest)fail('META_KYC_COMPANY_AUTHORITY_CHANGED');}):null;
  const images=[];
  for(const [kind,image] of [['DOCUMENT_FRONT',input.front],['SELFIE',input.selfie],...(input.back?[['DOCUMENT_BACK',input.back]]:[])]){let url;try{url=await upload(image.bytes.toString('base64'),'participant-kyc-'+digest([prepare.organizationId,prepare.projectId,prepare.workerId,input.operationId,kind]),image.contentType,...(beforeExternal?[beforeExternal]:[]));}catch(error){if(beforeExternal&&error instanceof WorkspaceError)throw error;fail('PARTICIPANT_PRIVATE_STORAGE_UNCONFIRMED',503);}images.push({id:kind==='SELFIE'?'selfie':kind==='DOCUMENT_BACK'?'document-back':'document-front',kind,url,contentType:image.contentType,bytes:image.bytes.length,sha256:image.digest});}
  return transaction(async client=>{
   const r=await resolveAuthority(client,context,{deposit:true,environment});if(authority(r,input)!==prepare.authorityDigest)fail('META_KYC_CHALLENGE_REVOKED');
   await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[prepare.key]);
   const prior=await priorReceipt(client,r,prepare.key,prepare.fingerprint);if(prior)return prior;
   if(r.worker.revision!==prepare.revision)fail('PARTICIPANT_REVISION_CHANGED');
   if(['PENDING_REVIEW','PENDING_ACCOUNT_CLAIM','APPROVED'].includes(r.worker.metadata.participant.kyc?.status))fail('PARTICIPANT_KYC_ALREADY_SUBMITTED');
   const m=structuredClone(r.worker.metadata),p=m.participant,now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now.toISOString(),submissionId='kyc_'+randomUUID().replaceAll('-',''),status=p.status==='INVITED'?'PENDING_ACCOUNT_CLAIM':'PENDING_REVIEW';
   if(p.channelIdentity)p.channelIdentity=invalidateWorkerChannelIdentity(m,{at:now,reasonCode:'KYC_RESUBMITTED'}).participant.channelIdentity;
   const channelCapture={version:1,kind:'META_KYC_CHAT',receiptId:prepare.key,sourceDigest:digest(r.source),challengeId:r.challenge.id,invitationId:p.status==='INVITED'?p.invitation.id:null,capturedParticipantClerkUserId:p.clerkUserId||null,accountClaimRequired:p.status==='INVITED'};
   p.kyc={version:1,status,submissionId,noticeVersion:input.noticeVersion,noticeSha256:input.noticeSha256,consentRecorded:true,submittedAt:now,contentHash,images,...(input.back?{captureImageSetVersion:2,documentBackConsent:{allowed:true,noticeVersion:input.backNoticeVersion,noticeSha256:input.backNoticeSha256,recordedAt:now}}:{}),ocrConsent:{allowed:input.ocrConsent,noticeVersion:input.ocrNoticeVersion,noticeSha256:digest(PARTICIPANT_OCR_NOTICE),recordedAt:now},biometricConsent:{allowed:input.biometricConsent,noticeVersion:input.biometricNoticeVersion,noticeSha256:input.biometricNoticeVersion?digest(PARTICIPANT_BIOMETRIC_NOTICE):null,recordedAt:now},channelCapture};
   if(input.back&&!participantKycImageSet(p.kyc))fail('PARTICIPANT_PRIVATE_STORAGE_UNCONFIRMED',503);
   await client.query(`UPDATE public."Worker" SET metadata=$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[r.worker.id,r.project.id,JSON.stringify(m)]);
   const details={version:1,projectId:r.project.id,requestDigest:prepare.fingerprint,kind:'KYC_SUBMITTED',submissionId,contentHash,status,noticeVersion:input.noticeVersion,...(input.back?{captureImageSetVersion:2,documentBackConsentRecorded:true,documentBackNoticeVersion:input.backNoticeVersion,documentBackNoticeSha256:input.backNoticeSha256}:{}),ocrConsentRecorded:input.ocrConsent,ocrNoticeVersion:input.ocrNoticeVersion,ocrNoticeSha256:digest(PARTICIPANT_OCR_NOTICE),biometricConsentRecorded:input.biometricConsent,biometricNoticeVersion:input.biometricNoticeVersion,biometricNoticeSha256:input.biometricNoticeVersion?digest(PARTICIPANT_BIOMETRIC_NOTICE):null,channelCapture,identityCertified:false,permissionsGranted:false,whatsAppAccessGranted:false};
   await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'participant.operation.recorded','Worker',$4,$5::jsonb)`,[prepare.key,r.member.organizationId,r.member.actorId,r.worker.id,JSON.stringify(details)]);
   await fenceCompanyKycAuthority(client,r,context);
   return safeResult({id:prepare.key,metadata:details},false);
  });
 }};
}

// Invoke only after canonical Clerk invitation acceptance and membership checks.
export async function adoptParticipantChannelKyc(client,{row,participant,invitationId,actorId,clerkUserId,acceptanceReceiptId}){
 const k=participant.kyc;if(k?.status!=='PENDING_ACCOUNT_CLAIM')return false;
 if(participant.status!=='ACTIVE'||participant.clerkUserId!==clerkUserId||participant.invitation?.id!==invitationId||participant.invitation.state!=='ACCEPTED'||!workspaceId(actorId)||!/^user_[A-Za-z0-9]+$/.test(clerkUserId||'')||!/^participant_[a-f0-9]{64}$/.test(acceptanceReceiptId||''))fail('PARTICIPANT_ACCESS_REQUIRED',403);
 const c=k.channelCapture;if(c?.version!==1||c.kind!=='META_KYC_CHAT'||c.invitationId!==invitationId||c.accountClaimRequired!==true||c.capturedParticipantClerkUserId!==null)fail('PARTICIPANT_KYC_EVIDENCE_UNCONFIRMED');
 const rows=(await client.query(`SELECT id,"entityType","entityId",metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND action='participant.operation.recorded'`,[c.receiptId,row.organizationId])).rows;
 const found=rows[0];if(rows.length!==1||found.entityType!=='Worker'||found.entityId!==row.id||found.metadata.kind!=='KYC_SUBMITTED'||found.metadata.projectId!==row.projectId||found.metadata.submissionId!==k.submissionId||found.metadata.contentHash!==k.contentHash||digest(found.metadata.channelCapture)!==digest(c)||!participantKycImageSet(k,{receipt:found.metadata,projectId:row.projectId}))fail('PARTICIPANT_KYC_EVIDENCE_UNCONFIRMED');
 const now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now.toISOString();
 participant.kyc={...k,status:'PENDING_REVIEW',channelCapture:{...c,accountClaimRequired:false,claimedAt:now,claimedActorId:actorId,claimedClerkUserId:clerkUserId,acceptanceReceiptId}};
 await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'participant.kyc_chat.adopted','Worker',$4,$5::jsonb)`,[acceptanceReceiptId+'_kyc',row.organizationId,actorId,row.id,JSON.stringify({version:1,projectId:row.projectId,submissionId:k.submissionId,contentHash:k.contentHash,captureReceiptId:c.receiptId,acceptanceReceiptId,identityCertified:false,permissionsGranted:false,whatsAppAccessGranted:false})]);
 return true;
}
