// Server-only facial attempt metadata. No image bytes or identity approval.
import {WorkspaceError,workspaceId,operationId} from './workspace-policy.mjs';
import {usageDigest,usageExact,usageHash,usageInstant} from './organization-usage-policy.mjs';
import {participantReceiptId} from './participant-policy.mjs';
import {PARTICIPANT_PRECOMMIT_BIOMETRIC_NOTICE_VERSION as FACIAL_NOTICE_VERSION,PARTICIPANT_PRECOMMIT_BIOMETRIC_NOTICE_SHA256 as FACIAL_NOTICE_SHA256} from './participant-analysis-consent.mjs';
const FACIAL_MODEL_MANIFEST_SHA256='c695e1a85db3ac933836562ce1f7d7e2b372ba2951dc9c4d0160b88cd448c860';
export {FACIAL_NOTICE_VERSION,FACIAL_NOTICE_SHA256,FACIAL_MODEL_MANIFEST_SHA256};
export const FACIAL_ACTION='participant.kyc.facial.attempt';
export const FACIAL_STATES=Object.freeze(['RESERVED','DISPATCHED','READY','MODEL_UNKNOWN','PERSISTING','PERSISTENCE_UNKNOWN','COMMITTED','REJECTED','CLOSED_MANUAL']);
export const facialFail=(code='FACIAL_ATTEMPT_UNCONFIRMED',status=409)=>{throw new WorkspaceError(code,status);};
export function facialBinding(value){
 if(!usageExact(value,['version','mode','context','biometricConsent','images','modelManifestSha256'])||value.version!==1||!['ASSISTED','MANUAL'].includes(value.mode)||value.modelManifestSha256!==FACIAL_MODEL_MANIFEST_SHA256)facialFail('FACIAL_BINDING_INVALID');
 const c=value.context;
 if(!usageExact(c,['actorId','organizationId','projectId','workerId','revision','operationId','sourceAuthoritySha256'])||![c.actorId,c.organizationId,c.projectId,c.workerId].every(workspaceId)||!operationId(c.operationId)||typeof c.revision!=='string'||!c.revision||c.revision.length>80||!usageHash(c.sourceAuthoritySha256))facialFail('FACIAL_BINDING_INVALID');
 const choice=value.biometricConsent;
 if(choice!==null&&(!usageExact(choice,['allowed','noticeVersion','noticeSha256'])||typeof choice.allowed!=='boolean'||choice.noticeVersion!==FACIAL_NOTICE_VERSION||choice.noticeSha256!==FACIAL_NOTICE_SHA256)||value.mode==='ASSISTED'&&choice?.allowed!==true)facialFail('FACIAL_CONSENT_REQUIRED');
 if(!Array.isArray(value.images)||![2,3].includes(value.images.length)||value.images.some((p,i)=>!usageExact(p,['kind','sha256','bytes','mimeType'])||p.kind!==['DOCUMENT_FRONT','SELFIE','DOCUMENT_BACK'][i]||!usageHash(p.sha256)||!Number.isSafeInteger(p.bytes)||p.bytes<1||p.bytes>2*1024*1024||!['image/jpeg','image/png','image/webp'].includes(p.mimeType))||value.mode==='ASSISTED'&&value.images[0].sha256===value.images[1].sha256)facialFail('FACIAL_BINDING_INVALID');
 return structuredClone({...value,context:{...c,operationId:c.operationId.toLowerCase()}});
}
export const facialBindingDigest=b=>usageDigest(facialBinding(b));
export const facialAttemptId=b=>'participant_facial_'+usageDigest(['facial-attempt-v1',b.context.organizationId,b.context.actorId,b.context.projectId,b.context.operationId]);
export const facialPairKey=b=>usageDigest(['facial-pending-pair-v1',b.context.organizationId,b.context.projectId,b.context.workerId,b.images[0].sha256,b.images[1].sha256,FACIAL_MODEL_MANIFEST_SHA256]);
export const facialReceiptId=b=>participantReceiptId(b.context.actorId,b.context.projectId,b.context.operationId);
export function facialAdvisory(value,b){
 const keys=['success','status','faceSimilarity','captureRiskSignal','identityCertified','livenessVerified','documentAuthenticityVerified','measurementCalibrated','requiresHumanReview','provider','modelManifestSha256','frontSha256','selfieSha256'];
 if(!usageExact(value,keys)||value.success!==true||value.status!=='ADVISORY_UNREVIEWED'||value.provider!=='private-opencv-onnx'||value.modelManifestSha256!==FACIAL_MODEL_MANIFEST_SHA256||value.frontSha256!==b.images[0].sha256||value.selfieSha256!==b.images[1].sha256||value.requiresHumanReview!==true||['identityCertified','livenessVerified','documentAuthenticityVerified','measurementCalibrated'].some(k=>value[k]!==false)||!Number.isFinite(value.faceSimilarity)||value.faceSimilarity< -1||value.faceSimilarity>1||!Number.isFinite(value.captureRiskSignal)||value.captureRiskSignal<0||value.captureRiskSignal>1)facialFail('FACIAL_ADVISORY_INVALID');
 return structuredClone(value);
}
export function facialRow(row){
 const m=row?.metadata,b=facialBinding(m?.binding);
 if(!usageExact(m,['version','binding','bindingSha256','pendingPairSha256','state','leaseId','expiresAt','createdAt','updatedAt','modelDispatchedAt','modelResultSha256','persistenceStartedAt','receiptId','manualFromAttemptId','resolutionSuccessorId','orphanPrivateObjectsPossible'])||m.version!==1||row.id!==facialAttemptId(b)||row.organizationId!==b.context.organizationId||row.actorId!==b.context.actorId||row.entityType!=='Worker'||row.entityId!==b.context.workerId||m.bindingSha256!==facialBindingDigest(b)||m.pendingPairSha256!==facialPairKey(b)||!FACIAL_STATES.includes(m.state)||!operationId(m.leaseId)||![m.expiresAt,m.createdAt,m.updatedAt].every(usageInstant)||[m.modelDispatchedAt,m.persistenceStartedAt].some(v=>v!==null&&!usageInstant(v))||m.modelResultSha256!==null&&!usageHash(m.modelResultSha256)||m.receiptId!==null&&m.receiptId!==facialReceiptId(b))facialFail('FACIAL_ROW_INVALID');
 if(['DISPATCHED','MODEL_UNKNOWN'].includes(m.state)&&!m.modelDispatchedAt||m.modelDispatchedAt&&b.mode!=='ASSISTED'||m.modelResultSha256&&!m.modelDispatchedAt||m.state==='READY'&&b.mode==='ASSISTED'&&!m.modelResultSha256||['PERSISTING','PERSISTENCE_UNKNOWN','COMMITTED'].includes(m.state)&&!m.persistenceStartedAt||m.state==='COMMITTED'&&m.receiptId!==facialReceiptId(b))facialFail('FACIAL_ROW_INVALID');
 if([m.manualFromAttemptId,m.resolutionSuccessorId].some(v=>v!==null&&!(typeof v==='string'&&/^participant_facial_[a-f0-9]{64}$/.test(v)))||typeof m.orphanPrivateObjectsPossible!=='boolean'||m.state==='CLOSED_MANUAL'&&!m.resolutionSuccessorId)facialFail('FACIAL_ROW_INVALID');
 return {row,metadata:m,binding:b};
}
export function facialReceiptProof(b,m){return{version:1,mode:b.mode,attemptId:facialAttemptId(b),bindingSha256:facialBindingDigest(b),pendingPairSha256:facialPairKey(b),modelManifestSha256:FACIAL_MODEL_MANIFEST_SHA256,noticeVersion:b.biometricConsent?.noticeVersion||null,noticeSha256:b.biometricConsent?.noticeSha256||null,modelResultSha256:m.modelResultSha256,modelState:b.mode==='ASSISTED'?'COMPLETE':'NOT_REQUESTED',timing:b.mode==='ASSISTED'?'BEFORE_PERSISTENCE':'MANUAL_NO_FACIAL_COMPARISON',identityCertified:false,livenessVerified:false,documentAuthenticityVerified:false,measurementCalibrated:false,requiresHumanReview:true,permissionsGranted:false};}
export function assertFacialReceipt(receipt,b,m){
 if(!m.persistenceStartedAt||b.mode==='ASSISTED'&&(!m.modelDispatchedAt||!usageHash(m.modelResultSha256))||receipt?.id!==facialReceiptId(b)||receipt.organizationId!==b.context.organizationId||receipt.actorId!==b.context.actorId||receipt.entityType!=='Worker'||receipt.entityId!==b.context.workerId||receipt.metadata?.version!==1||receipt.metadata.kind!=='KYC_SUBMITTED'||!workspaceId(receipt.metadata.submissionId)||receipt.metadata.projectId!==b.context.projectId||receipt.metadata.contentHash!==usageDigest(b.images.map(i=>[i.kind,i.sha256,i.bytes,i.mimeType]))||receipt.metadata.biometricNoticeVersion!==b.biometricConsent.noticeVersion||receipt.metadata.biometricNoticeSha256!==b.biometricConsent.noticeSha256||receipt.metadata.biometricConsentRecorded!==b.biometricConsent.allowed||receipt.metadata.identityCertified!==false||usageDigest(receipt.metadata.facialPrecommit)!==usageDigest(facialReceiptProof(b,m)))facialFail('FACIAL_RECEIPT_UNCONFIRMED');
 return receipt.id;
}

export const facialKycImages=k=>k.images.map(i=>({kind:i.kind,sha256:i.sha256,bytes:i.bytes,mimeType:i.contentType}));
export function assertFacialKyc(k,b){
 if(!Array.isArray(k?.images)||k?.biometricConsent?.noticeVersion!==FACIAL_NOTICE_VERSION||k.biometricConsent.noticeSha256!==FACIAL_NOTICE_SHA256||k.biometricConsent.allowed!==b.biometricConsent.allowed||usageDigest(facialKycImages(k))!==usageDigest(b.images)||k.contentHash!==usageDigest(k.images.map(i=>[i.kind,i.sha256,i.bytes,i.contentType])))facialFail('FACIAL_KYC_BINDING_INVALID');
}
async function assertParticipantFacialPrecommitSourceInner(client,k,receipt,{organizationId,projectId,workerId}){
 const proof=k?.facialPrecommit,v3=k?.biometricConsent?.noticeVersion===FACIAL_NOTICE_VERSION;
 if(!v3&&!proof)return;
 if(!v3||!proof||usageDigest(receipt?.metadata?.facialPrecommit)!==usageDigest(proof))facialFail('PARTICIPANT_ANALYSIS_SOURCE_CHANGED');
 const rows=(await client.query(`SELECT id,"organizationId","actorId",action,"entityType","entityId",metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND action='participant.kyc.facial.attempt'`,[proof.attemptId,organizationId])).rows;
 if(rows.length!==1)facialFail('PARTICIPANT_ANALYSIS_SOURCE_CHANGED');
 const {binding:b,metadata:m}=facialRow(rows[0]);
 if(m.state!=='COMMITTED'||m.receiptId!==receipt.id||b.context.organizationId!==organizationId||b.context.projectId!==projectId||b.context.workerId!==workerId||b.context.actorId!==receipt.actorId)facialFail('PARTICIPANT_ANALYSIS_SOURCE_CHANGED');
 assertFacialReceipt(receipt,b,m);assertFacialKyc(k,b);
 if(b.mode==='ASSISTED'){
  const advisory=facialAdvisory({success:true,...k.processing?.biometrics},b);
  if(k.processing?.stages?.biometric?.state!=='COMPLETE'||usageDigest(advisory)!==m.modelResultSha256)facialFail('PARTICIPANT_ANALYSIS_SOURCE_CHANGED');
 }else if(k.processing?.stages?.biometric?.state!=='NOT_AUTHORIZED'||k.processing.biometrics!==undefined)facialFail('PARTICIPANT_ANALYSIS_SOURCE_CHANGED');
}
export async function assertParticipantFacialPrecommitSource(...args){try{return await assertParticipantFacialPrecommitSourceInner(...args);}catch{throw new WorkspaceError('PARTICIPANT_ANALYSIS_SOURCE_CHANGED',409);}}
