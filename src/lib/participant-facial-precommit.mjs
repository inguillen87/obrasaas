import {createHash} from 'node:crypto';
import {WorkspaceError} from './workspace-policy.mjs';
import {usageDigest} from './organization-usage-policy.mjs';
import {createCaptureQualityGate} from './capture-quality-gate.mjs';
import {participantAnalysisConsent} from './participant-analysis-consent.mjs';
import {enqueueParticipantPreanalysis,participantPreanalysisBinding,participantPreanalysisIssueCodes} from './participant-kyc-preanalysis-policy.mjs';
import {createParticipantFacialAttempts} from './participant-facial-attempt.mjs';
import {facialBinding,facialBindingDigest,facialReceiptId,facialAdvisory,assertFacialKyc,FACIAL_NOTICE_VERSION,FACIAL_NOTICE_SHA256,FACIAL_MODEL_MANIFEST_SHA256} from './participant-facial-policy.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const fail=(code='PARTICIPANT_FACIAL_RESULT_UNCONFIRMED',status=503)=>{throw new WorkspaceError(code,status);};
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===[...keys].sort().join('|');
function captures(images){
 if(!Array.isArray(images)||![2,3].includes(images.length))fail('PARTICIPANT_INPUT_INVALID',400);
 return images.map(({kind,image},i)=>{if(kind!==['DOCUMENT_FRONT','SELFIE','DOCUMENT_BACK'][i]||!image||!Buffer.isBuffer(image.bytes)||!image.bytes.length||image.bytes.length>2*1024*1024||!['image/jpeg','image/png','image/webp'].includes(image.contentType)||sha(image.bytes)!==image.digest)fail('PARTICIPANT_KYC_INTEGRITY',422);return Object.freeze({kind,image:Object.freeze({bytes:Buffer.from(image.bytes),contentType:image.contentType,digest:image.digest})});});
}
function adoptKyc(k,provenance,detail){
 if(!detail)return enqueueParticipantPreanalysis({...provenance,kyc:k});
 const {binding:b,advisory,proof}=detail,c=b.context;
 if(provenance.organizationId!==c.organizationId||provenance.projectId!==c.projectId||provenance.workerId!==c.workerId||provenance.sourceActorId!==c.actorId||provenance.sourceReceiptId!==facialReceiptId(b))fail('FACIAL_KYC_BINDING_INVALID',409);
 assertFacialKyc(k,b);const auto=participantPreanalysisBinding({...provenance,kyc:k}),ocr=participantAnalysisConsent(k,'ocr',{automaticOnly:true});
 const biometrics=advisory?Object.fromEntries(Object.entries(facialAdvisory(advisory,b)).filter(([key])=>key!=='success')):undefined;
 k.facialPrecommit=structuredClone(proof);
 k.processing={automatic:true,auto,status:ocr?'QUEUED':biometrics?'ADVISORY_UNREVIEWED':'SKIPPED_CONSENT',requiresHumanReview:true,identityVerified:false,stages:{ocr:{state:ocr?'PENDING':'NOT_AUTHORIZED'},biometric:{state:biometrics?'COMPLETE':'NOT_AUTHORIZED'}},queuedAt:k.submittedAt,...(!ocr?{completedAt:k.submittedAt,expiresAt:null,nextCheckAt:null}:{}),...(biometrics?{biometrics}:{})};
 k.processing.issueCodes=participantPreanalysisIssueCodes(k.processing);return k.processing;
}
export function createParticipantFacialPrecommitCoordinator({assessCaptureQuality,assessBiometrics,environment=process.env,leaseMs=150000}={}){
 const quality=createCaptureQualityGate({assess:assessCaptureQuality,environment}),attempts=createParticipantFacialAttempts({leaseMs}),sources=new WeakMap();
 function current(ticket){const v=sources.get(ticket);if(!v)fail('FACIAL_CAPABILITY_REQUIRED',403);for(const set of [v.original,v.owned]){if(set.length!==v.binding.images.length)fail('PARTICIPANT_KYC_INTEGRITY',409);for(const [i,p]of set.entries()){const expected=v.binding.images[i],image=p.image;if(p.kind!==expected.kind||!Buffer.isBuffer(image.bytes)||image.bytes.length!==expected.bytes||image.contentType!==expected.mimeType||image.digest!==expected.sha256||sha(image.bytes)!==expected.sha256)fail('PARTICIPANT_KYC_INTEGRITY',409);}}return v;}
 return{
  async prepareCapture({context,images,biometricMode=null,biometricConsent=null,withAuthority,beforeAssess,manualFromOperationId=null}){
   const owned=captures(images);
   if(biometricMode===null){if(manualFromOperationId||biometricConsent?.noticeVersion===FACIAL_NOTICE_VERSION)fail('PARTICIPANT_INPUT_INVALID',400);return{captureQuality:await quality(owned,{beforeAssess}),facialTicket:null,captureSet:owned};}
   const binding=facialBinding({version:1,mode:biometricMode,context,biometricConsent,images:owned.map(p=>({kind:p.kind,sha256:p.image.digest,bytes:p.image.bytes.length,mimeType:p.image.contentType})),modelManifestSha256:FACIAL_MODEL_MANIFEST_SHA256});
   if(binding.biometricConsent?.noticeVersion!==FACIAL_NOTICE_VERSION||binding.biometricConsent.noticeSha256!==FACIAL_NOTICE_SHA256||binding.biometricConsent.allowed!==(biometricMode==='ASSISTED'))fail('PARTICIPANT_BIOMETRIC_CONSENT_REQUIRED',400);
   // A current exact receipt wins before reserving and before image disclosure.
   if(typeof beforeAssess==='function')await beforeAssess();
   const reserved=await attempts.reserve(binding,withAuthority,{manualFromOperationId});if(reserved.replayed)fail('PARTICIPANT_FACIAL_RECEIPT_AVAILABLE',409);
   const ticket=reserved.ticket;sources.set(ticket,{original:images,owned,binding});
   try{
    const captureQuality=await quality(owned,{beforeAssess});current(ticket);
    if(biometricMode==='ASSISTED'){
     if(typeof assessBiometrics!=='function')fail('BIOMETRIC_SERVICE_NOT_CONFIGURED');
     const result=await assessBiometrics({front:{buffer:owned[0].image.bytes,mimeType:owned[0].image.contentType},selfie:{buffer:owned[1].image.bytes,mimeType:owned[1].image.contentType},consentVersion:FACIAL_NOTICE_VERSION},{beforeDispatch:async(proof,{signal}={})=>{
      const fields=['version','consentVersion','noticeSha256','bodySha256','frontSha256','selfieSha256','frontBytes','selfieBytes','frontMimeType','selfieMimeType','modelManifestSha256'];
      current(ticket);if(!exact(proof,fields)||proof.version!==1||proof.consentVersion!==FACIAL_NOTICE_VERSION||proof.noticeSha256!==FACIAL_NOTICE_SHA256||proof.modelManifestSha256!==FACIAL_MODEL_MANIFEST_SHA256||proof.frontSha256!==binding.images[0].sha256||proof.selfieSha256!==binding.images[1].sha256||proof.frontBytes!==binding.images[0].bytes||proof.selfieBytes!==binding.images[1].bytes||proof.frontMimeType!==binding.images[0].mimeType||proof.selfieMimeType!==binding.images[1].mimeType||!/^[a-f0-9]{64}$/.test(proof.bodySha256)||signal?.aborted)fail('FACIAL_DISPATCH_BINDING_INVALID',409);
      const expected=facialBindingDigest(binding),result=await attempts.dispatch(ticket,expected);current(ticket);if(signal?.aborted||result.state!=='DISPATCHED'||result.bindingSha256!==expected)fail('PARTICIPANT_FACIAL_RESULT_UNCONFIRMED');return Object.freeze({dispatched:true,bodySha256:proof.bodySha256});
     }});
     current(ticket);if(result?.success!==true)fail('PARTICIPANT_FACIAL_RESULT_UNCONFIRMED');await attempts.ready(ticket,result);
    }else await attempts.ready(ticket);
    current(ticket);return{captureQuality,facialTicket:ticket,captureSet:owned};
   }catch(error){await attempts.unknown(ticket).catch(()=>{});if(error instanceof WorkspaceError)throw error;fail();}
  },
  async fencePersistence(ticket){if(ticket===null)return;current(ticket);await attempts.fencePersistence(ticket);current(ticket);},
  async unknown(ticket){return attempts.unknown(ticket);},
  async commit(client,ticket,{currentContext,write}){if(ticket!==null)current(ticket);return attempts.commit(client,ticket,{currentContext,write,adopt:adoptKyc});},
  async reconcileReplay(client,ticket,options){return attempts.reconcileReplay(client,ticket,options);},
  async lookup(client,context){return attempts.lookup(client,context);},
  async verifyCommittedReceipt(client,options){return attempts.verifyCommittedReceipt(client,options);},
  async statusInTransaction(client,options){return attempts.statusInTransaction(client,options);},
  async status({context,withAuthority}){return withAuthority({requireSource:false},(client,currentContext)=>attempts.statusInTransaction(client,{context,currentContext}));},
 };
}
