import {randomUUID} from 'node:crypto';
import {WorkspaceError,digest,operationId,workspaceId} from './workspace-policy.mjs';
import {decodePrivateImage,PrivateImageError} from './private-image-upload.mjs';
import {participantKeys,participantReceiptId,PARTICIPANT_NOTICE,PARTICIPANT_NOTICE_VERSION,PARTICIPANT_OCR_NOTICE,PARTICIPANT_OCR_NOTICE_VERSION,PARTICIPANT_BIOMETRIC_NOTICE,PARTICIPANT_BIOMETRIC_NOTICE_VERSION} from './participant-policy.mjs';
import {metaKycOperationId} from './meta-kyc-challenge.mjs';
import {invalidateWorkerChannelIdentity} from './worker-channel-identity.mjs';

const fail=(code,status=409)=>{throw new WorkspaceError(code,status);};
function depositInput(input){
 const biometricChoice=Object.hasOwn(input||{},'biometricConsent')||Object.hasOwn(input||{},'biometricNoticeVersion');
 participantKeys(input,['operationId','noticeVersion','noticeSha256','consent','ocrConsent','ocrNoticeVersion','front','selfie',...(biometricChoice?['biometricConsent','biometricNoticeVersion']:[])]);
 if(!operationId(input.operationId)||input.consent!==true||input.noticeVersion!==PARTICIPANT_NOTICE_VERSION||input.noticeSha256!==digest(PARTICIPANT_NOTICE))fail('PARTICIPANT_PRIVACY_REQUIRED',400);
 if(typeof input.ocrConsent!=='boolean'||input.ocrNoticeVersion!==PARTICIPANT_OCR_NOTICE_VERSION)fail('PARTICIPANT_OCR_CONSENT_REQUIRED',400);
 if(biometricChoice&&(typeof input.biometricConsent!=='boolean'||input.biometricNoticeVersion!==PARTICIPANT_BIOMETRIC_NOTICE_VERSION))fail('PARTICIPANT_BIOMETRIC_CONSENT_REQUIRED',400);
 try{return {...input,biometricConsent:biometricChoice&&input.biometricConsent,biometricNoticeVersion:biometricChoice?input.biometricNoticeVersion:null,operationId:input.operationId.toLowerCase(),front:decodePrivateImage(input.front),selfie:decodePrivateImage(input.selfie)};}catch(error){fail(error instanceof PrivateImageError?error.code:'PRIVATE_IMAGE_INVALID',error.code==='PRIVATE_IMAGE_TOO_LARGE'?413:400);}
}
function authority(r,input){
 const p=r?.worker?.metadata?.participant,s=r?.source,state=r?.state;
 if(r?.kind!=='LIMITED_KYC_UPLOAD'||!workspaceId(r.member?.actorId)||!workspaceId(r.member.organizationId)||r.member.organizationId!==r.project?.organizationId||r.worker?.projectId!==r.project.id||!r.worker.active||p?.version!==1||!['INVITED','ACTIVE'].includes(p.status)||s?.kind!=='META_KYC_CHAT'||s.challengeId!==r.challenge?.id||!/^customer_webhook_[a-f0-9]{64}$/.test(s.eventId||'')||!/^[a-f0-9]{64}$/.test(s.payloadDigest||'')||input.operationId!==metaKycOperationId(s.eventId))fail('META_KYC_CHALLENGE_REJECTED');
 if(p.status==='ACTIVE'&&(!p.clerkUserId||r.member.clerkUserId!==p.clerkUserId)||p.status==='INVITED'&&(p.clerkUserId||p.invitation?.state!=='SENT'||p.invitation.id!==r.challenge.invitationId))fail('META_KYC_CHALLENGE_REVOKED');
 if(state?.step!=='FINALIZING'||state.confirmationEventId!==s.eventId||state.consent!==input.consent||state.noticeVersion!==input.noticeVersion||state.noticeSha256!==input.noticeSha256||state.ocrConsent!==input.ocrConsent||state.ocrNoticeVersion!==input.ocrNoticeVersion||state.ocrNoticeSha256!==digest(PARTICIPANT_OCR_NOTICE)||!state.front||!state.selfie)fail('META_KYC_DEPOSIT_REQUIRED');
 if(input.biometricNoticeVersion&&(state.biometricConsent!==input.biometricConsent||state.biometricNoticeVersion!==input.biometricNoticeVersion||state.biometricNoticeSha256!==digest(PARTICIPANT_BIOMETRIC_NOTICE)))fail('META_KYC_DEPOSIT_REQUIRED');
 // Revision changes caused by our own deposit do not change channel authority.
 return digest(['participant-channel-authority-v1',r.member.actorId,r.member.organizationId,r.project.id,r.worker.id,p.status,p.clerkUserId||null,p.invitation?.id||null,r.challenge.id,r.challenge.issuerActorId,r.challenge.issuerMembershipId,s,state.front,state.selfie]);
}
const safeResult=(found,replayed)=>({saved:true,replayed,kind:'KYC_SUBMITTED',receiptId:found.id,submissionId:found.metadata.submissionId,status:found.metadata.status,identityCertified:false,permissionsGranted:false,whatsAppAccessGranted:false});
async function priorReceipt(client,r,key,fingerprint){
 const found=(await client.query(`SELECT id,"entityType","entityId",metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND action='participant.operation.recorded'`,[key,r.member.organizationId,r.member.actorId])).rows[0];
 if(!found)return null;
 if(found.entityType!=='Worker'||found.entityId!==r.worker.id||found.metadata.kind!=='KYC_SUBMITTED'||found.metadata.projectId!==r.project.id||found.metadata.requestDigest!==fingerprint||found.metadata.channelCapture?.sourceDigest!==digest(r.source))fail('PARTICIPANT_OPERATION_CONFLICT');
 const k=r.worker.metadata.participant.kyc;
 if(k?.submissionId!==found.metadata.submissionId||k.contentHash!==found.metadata.contentHash||k.channelCapture?.receiptId!==found.id)fail('PARTICIPANT_RECEIPT_INVALID');
 return safeResult(found,true);
}

// This adapter has no public HTTP route. Only a pinned signed-channel resolver
// can grant limited deposit authority; caller-supplied worker IDs are rejected.
export function createParticipantChannelKycDeposit({connect,resolveAuthority,upload,environment=process.env}){
 if(typeof connect!=='function'||typeof resolveAuthority!=='function'||typeof upload!=='function')fail('PARTICIPANT_CHANNEL_ADAPTER_INVALID',500);
 async function transaction(callback){let client,broken=false;try{client=await connect();await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');await client.query("SET LOCAL statement_timeout='6s'");await client.query("SET LOCAL lock_timeout='2500ms'");const value=await callback(client);await client.query('COMMIT');return value;}catch(error){if(client)try{await client.query('ROLLBACK');}catch{broken=true;}if(error instanceof WorkspaceError)throw error;fail('PARTICIPANT_OPERATION_UNCONFIRMED',503);}finally{client?.release(broken);}}
 return {async deposit(context,body){
  const input=depositInput(body),contentHash=digest([['DOCUMENT_FRONT',input.front.digest,input.front.bytes.length,input.front.contentType],['SELFIE',input.selfie.digest,input.selfie.bytes.length,input.selfie.contentType]]);
  const prepare=await transaction(async client=>{
   const r=await resolveAuthority(client,context,{deposit:true,environment}),authorityDigest=authority(r,input),key=participantReceiptId(r.member.actorId,r.project.id,input.operationId),fingerprint=digest([authorityDigest,contentHash,input.noticeVersion,input.noticeSha256,input.ocrNoticeVersion,input.ocrConsent,...(input.biometricNoticeVersion?[input.biometricNoticeVersion,input.biometricConsent]:[])]);
   await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[key]);
   const prior=await priorReceipt(client,r,key,fingerprint);if(prior)return {done:prior};
   if(['PENDING_REVIEW','PENDING_ACCOUNT_CLAIM','APPROVED'].includes(r.worker.metadata.participant.kyc?.status))fail('PARTICIPANT_KYC_ALREADY_SUBMITTED');
   return {authorityDigest,key,fingerprint,organizationId:r.member.organizationId,projectId:r.project.id,workerId:r.worker.id,revision:r.worker.revision};
  });
  if(prepare.done)return prepare.done;
  const images=[];
  for(const [kind,image] of [['DOCUMENT_FRONT',input.front],['SELFIE',input.selfie]]){let url;try{url=await upload(image.bytes.toString('base64'),'participant-kyc-'+digest([prepare.organizationId,prepare.projectId,prepare.workerId,input.operationId,kind]),image.contentType);}catch{fail('PARTICIPANT_PRIVATE_STORAGE_UNCONFIRMED',503);}images.push({id:kind==='SELFIE'?'selfie':'document-front',kind,url,contentType:image.contentType,bytes:image.bytes.length,sha256:image.digest});}
  return transaction(async client=>{
   const r=await resolveAuthority(client,context,{deposit:true,environment});if(authority(r,input)!==prepare.authorityDigest)fail('META_KYC_CHALLENGE_REVOKED');
   await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[prepare.key]);
   const prior=await priorReceipt(client,r,prepare.key,prepare.fingerprint);if(prior)return prior;
   if(r.worker.revision!==prepare.revision)fail('PARTICIPANT_REVISION_CHANGED');
   if(['PENDING_REVIEW','PENDING_ACCOUNT_CLAIM','APPROVED'].includes(r.worker.metadata.participant.kyc?.status))fail('PARTICIPANT_KYC_ALREADY_SUBMITTED');
   const m=structuredClone(r.worker.metadata),p=m.participant,now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now.toISOString(),submissionId='kyc_'+randomUUID().replaceAll('-',''),status=p.status==='INVITED'?'PENDING_ACCOUNT_CLAIM':'PENDING_REVIEW';
   if(p.channelIdentity)p.channelIdentity=invalidateWorkerChannelIdentity(m,{at:now,reasonCode:'KYC_RESUBMITTED'}).participant.channelIdentity;
   const channelCapture={version:1,kind:'META_KYC_CHAT',receiptId:prepare.key,sourceDigest:digest(r.source),challengeId:r.challenge.id,invitationId:p.status==='INVITED'?p.invitation.id:null,capturedParticipantClerkUserId:p.clerkUserId||null,accountClaimRequired:p.status==='INVITED'};
   p.kyc={version:1,status,submissionId,noticeVersion:input.noticeVersion,noticeSha256:input.noticeSha256,consentRecorded:true,submittedAt:now,contentHash,images,ocrConsent:{allowed:input.ocrConsent,noticeVersion:input.ocrNoticeVersion,noticeSha256:digest(PARTICIPANT_OCR_NOTICE),recordedAt:now},biometricConsent:{allowed:input.biometricConsent,noticeVersion:input.biometricNoticeVersion,noticeSha256:input.biometricNoticeVersion?digest(PARTICIPANT_BIOMETRIC_NOTICE):null,recordedAt:now},channelCapture};
   await client.query(`UPDATE public."Worker" SET metadata=$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[r.worker.id,r.project.id,JSON.stringify(m)]);
   const details={version:1,projectId:r.project.id,requestDigest:prepare.fingerprint,kind:'KYC_SUBMITTED',submissionId,contentHash,status,noticeVersion:input.noticeVersion,ocrConsentRecorded:input.ocrConsent,ocrNoticeVersion:input.ocrNoticeVersion,ocrNoticeSha256:digest(PARTICIPANT_OCR_NOTICE),biometricConsentRecorded:input.biometricConsent,biometricNoticeVersion:input.biometricNoticeVersion,biometricNoticeSha256:input.biometricNoticeVersion?digest(PARTICIPANT_BIOMETRIC_NOTICE):null,channelCapture,identityCertified:false,permissionsGranted:false,whatsAppAccessGranted:false};
   await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'participant.operation.recorded','Worker',$4,$5::jsonb)`,[prepare.key,r.member.organizationId,r.member.actorId,r.worker.id,JSON.stringify(details)]);
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
 const found=rows[0];if(rows.length!==1||found.entityType!=='Worker'||found.entityId!==row.id||found.metadata.kind!=='KYC_SUBMITTED'||found.metadata.projectId!==row.projectId||found.metadata.submissionId!==k.submissionId||found.metadata.contentHash!==k.contentHash||digest(found.metadata.channelCapture)!==digest(c)||!Array.isArray(k.images)||k.images.length!==2)fail('PARTICIPANT_KYC_EVIDENCE_UNCONFIRMED');
 const now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now.toISOString();
 participant.kyc={...k,status:'PENDING_REVIEW',channelCapture:{...c,accountClaimRequired:false,claimedAt:now,claimedActorId:actorId,claimedClerkUserId:clerkUserId,acceptanceReceiptId}};
 await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'participant.kyc_chat.adopted','Worker',$4,$5::jsonb)`,[acceptanceReceiptId+'_kyc',row.organizationId,actorId,row.id,JSON.stringify({version:1,projectId:row.projectId,submissionId:k.submissionId,contentHash:k.contentHash,captureReceiptId:c.receiptId,acceptanceReceiptId,identityCertified:false,permissionsGranted:false,whatsAppAccessGranted:false})]);
 return true;
}
