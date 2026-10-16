import {WorkspaceError,workspaceId,digest} from './workspace-policy.mjs';
import {participantAnalysisConsent,participantOcrNotice,participantBiometricNotice} from './participant-analysis-consent.mjs';
import {participantKycImageSet,PARTICIPANT_NOTICE_VERSION,PARTICIPANT_NOTICE} from './participant-kyc-image-set.mjs';
import {normalizeDniExtraction} from './pilot-media.mjs';
import {usageDigest as stableDigest} from './organization-usage-policy.mjs';

export const KYC_PREANALYSIS_MODE='INTERNAL_KYC_PRECHECK';
export const KYC_PREANALYSIS_TERMINAL=Object.freeze(['EXTRACTED_UNVERIFIED','ADVISORY_UNREVIEWED','FAILED_RETRYABLE','UNCERTAIN','SKIPPED_CONSENT']);
export const participantPreanalysisStageRunnable=stage=>['PENDING','WAITING_CONFIGURATION'].includes(stage?.state)||stage?.state==='HELD'&&stage.code==='ORGANIZATION_USAGE_COVERAGE_EXPIRED';
export const participantPreanalysisHasPendingStage=processing=>Object.values(processing?.stages||{}).some(participantPreanalysisStageRunnable);
export const KYC_PREANALYSIS_ISSUE_CODES=Object.freeze(['OCR_NOT_AUTHORIZED','FACIAL_NOT_AUTHORIZED','OCR_UNAVAILABLE','FACIAL_UNAVAILABLE','OCR_USAGE_HELD','DOCUMENT_TEXT_UNCONFIRMED','FACIAL_RESULT_UNCONFIRMED','OCR_DISPATCH_UNCERTAIN','FACIAL_DISPATCH_UNCERTAIN','CUIL_NOT_READ']);
export function participantPreanalysisIssueCodes(processing){
 const issues=[],s=processing?.stages;
 for(const [kind,prefix] of [['ocr','OCR'],['biometric','FACIAL']]){
  const state=s?.[kind]?.state;
  if(state==='NOT_AUTHORIZED')issues.push(prefix+'_NOT_AUTHORIZED');
  if(state==='WAITING_CONFIGURATION')issues.push(prefix+'_UNAVAILABLE');
  if(state==='DISPATCHED')issues.push(prefix+'_DISPATCH_UNCERTAIN');
  if(state==='FAILED')issues.push(kind==='ocr'?'DOCUMENT_TEXT_UNCONFIRMED':'FACIAL_RESULT_UNCONFIRMED');
  if(kind==='ocr'&&state==='HELD')issues.push('OCR_USAGE_HELD');
 }
 // This is an informational unread field, never a reason to exclude a person.
 if(processing?.fields&&processing.fields.cuil===null)issues.push('CUIL_NOT_READ');
 return issues;
}
export const publicParticipantPreanalysisIssues=processing=>Array.isArray(processing?.issueCodes)?[...new Set(processing.issueCodes.filter(code=>KYC_PREANALYSIS_ISSUE_CODES.includes(code)))]:[];
export function publicParticipantPreanalysisFields(processing,{reviewer=false,own=false}={}){
 if(!reviewer||own||!processing?.fields||(processing.automatic===true?processing.stages?.ocr?.state!=='COMPLETE':processing.status!=='EXTRACTED_UNVERIFIED'))return null;
 const fields=processing.fields,normalized=normalizeDniExtraction({isDni:true,nombreCompleto:fields.nombreCompleto,dni:fields.dni,cuil:fields.cuil});
 return normalized.success?{nombreCompleto:normalized.nombreCompleto,dni:normalized.dni,cuil:normalized.cuil}:null;
}
const fail=()=>{throw new WorkspaceError('PARTICIPANT_ANALYSIS_SOURCE_CHANGED',409);};
const instant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
// PostgreSQL JSONB preserves values and arrays, but not object insertion order.
// Canonicalize only this new protocol; historical notice/source hashes stay intact.
const uuid=value=>{const h=stableDigest(value).slice(0,32).split('');h[12]='4';h[16]=((parseInt(h[16],16)&3)|8).toString(16);const s=h.join('');return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;};
export const participantAnalysisConsentDigest=k=>stableDigest([k.ocrConsent||null,k.biometricConsent||null]);
export function participantPreanalysisBinding({kyc,organizationId,projectId,workerId,sourceReceiptId,sourceActorId}){
 if(![organizationId,projectId,workerId,sourceActorId,kyc?.submissionId].every(workspaceId)||!/^participant_[a-f0-9]{64}$/.test(sourceReceiptId||'')||!participantKycImageSet(kyc,{strictLegacy:true})||kyc.version!==1||kyc.noticeVersion!==PARTICIPANT_NOTICE_VERSION||kyc.noticeSha256!==digest(PARTICIPANT_NOTICE)||kyc.consentRecorded!==true||!instant(kyc.submittedAt)||[kyc.ocrConsent,kyc.biometricConsent].some(c=>c&&(!instant(c.recordedAt)||c.recordedAt!==kyc.submittedAt)))fail();
 const consentDigest=participantAnalysisConsentDigest(kyc),binding={version:1,mode:KYC_PREANALYSIS_MODE,organizationId,projectId,workerId,sourceReceiptId,sourceActorId,submissionId:kyc.submissionId,contentHash:kyc.contentHash,consentDigest};
 return {...binding,operationId:uuid(['participant-kyc-auto-v1',binding])};
}
export function enqueueParticipantPreanalysis(value){
 const k=value.kyc;
 // Old consent is never reinterpreted, including an exact old submission retry.
 if(!participantOcrNotice(k?.ocrConsent?.noticeVersion)?.automatic&&!participantBiometricNotice(k?.biometricConsent?.noticeVersion)?.automatic)return null;
 const auto=participantPreanalysisBinding(value),ocr=participantAnalysisConsent(k,'ocr',{automaticOnly:true}),biometric=participantAnalysisConsent(k,'biometric',{automaticOnly:true});
 k.processing={automatic:true,auto,status:ocr||biometric?'QUEUED':'SKIPPED_CONSENT',requiresHumanReview:true,identityVerified:false,stages:{ocr:{state:ocr?'PENDING':'NOT_AUTHORIZED'},biometric:{state:biometric?'PENDING':'NOT_AUTHORIZED'}},queuedAt:k.submittedAt};
 k.processing.issueCodes=participantPreanalysisIssueCodes(k.processing);
 return k.processing;
}
export function assertParticipantPreanalysisSource(kyc,auto,receipt,{organizationId,projectId,workerId}={}){
 if(!auto||auto.mode!==KYC_PREANALYSIS_MODE||receipt?.action!=='participant.operation.recorded'||receipt.id!==auto.sourceReceiptId||receipt.organizationId!==organizationId||receipt.actorId!==auto.sourceActorId||receipt.entityType!=='Worker'||receipt.entityId!==workerId)fail();
 const expected=participantPreanalysisBinding({kyc,organizationId,projectId,workerId,sourceReceiptId:receipt.id,sourceActorId:receipt.actorId}),m=receipt.metadata;
 if(stableDigest(auto)!==stableDigest(expected)||m?.version!==1||m.kind!=='KYC_SUBMITTED'||m.projectId!==projectId||m.submissionId!==kyc.submissionId||m.contentHash!==kyc.contentHash||m.noticeVersion!==kyc.noticeVersion||m.identityCertified!==false||!participantKycImageSet(kyc,{strictLegacy:true,receipt:m,projectId}))fail();
 for(const [kind,resolve] of [['ocr',participantOcrNotice],['biometric',participantBiometricNotice]]){
  const c=kyc[kind==='ocr'?'ocrConsent':'biometricConsent'],n=resolve(c?.noticeVersion),prefix=kind==='ocr'?'ocr':'biometric';
  if(c&&c.noticeVersion!==null&&(!n||c.noticeSha256!==n.sha256||m[prefix+'NoticeVersion']!==c.noticeVersion||m[prefix+'NoticeSha256']!==c.noticeSha256||m[prefix+'ConsentRecorded']!==c.allowed))fail();
 }
 return {ocr:participantAnalysisConsent(kyc,'ocr',{automaticOnly:true}),biometric:participantAnalysisConsent(kyc,'biometric',{automaticOnly:true})};
}
