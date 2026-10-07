import {digest,workspaceId} from './workspace-policy.mjs';

export const PARTICIPANT_NOTICE_VERSION='participant-kyc-v1';
export const PARTICIPANT_NOTICE='Tu documento y fotografía se guardan en privado para que un responsable autorizado de esta empresa revise tu identidad y participación en esta obra. Las imágenes no autorizan fichajes ni aprueban tu identidad automáticamente. Podés solicitar corrección o revisión al responsable. No ingreses datos bancarios ni información médica.';
export const PARTICIPANT_DOCUMENT_BACK_NOTICE_VERSION='participant-kyc-document-back-v1';
export const PARTICIPANT_DOCUMENT_BACK_NOTICE='El dorso de tu documento es opcional. Si lo agregás, se guardará en privado junto con el frente y tu fotografía para que un responsable autorizado de esta empresa lo revise en esta obra. El dorso no se envía a OpenAI ni se usa para comparación facial. No certifica la autenticidad del documento, tu identidad ni la prueba de vida. Podés presentar el frente y tu fotografía sin agregar el dorso.';
export const PARTICIPANT_DOCUMENT_BACK_NOTICE_SHA256=digest(PARTICIPANT_DOCUMENT_BACK_NOTICE);
const expected=[['document-front','DOCUMENT_FRONT'],['selfie','SELFIE']];
const iso=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
export function participantKycDocumentBackReceipt(receipt,{projectId=null}={}){
 return receipt?.version===1&&receipt.kind==='KYC_SUBMITTED'&&workspaceId(receipt.submissionId)&&workspaceId(receipt.projectId)&&(!projectId||receipt.projectId===projectId)&&/^[a-f0-9]{64}$/.test(receipt.contentHash||'')&&/^[a-f0-9]{64}$/.test(receipt.requestDigest||'')&&receipt.noticeVersion===PARTICIPANT_NOTICE_VERSION&&receipt.documentBackConsentRecorded===true&&receipt.documentBackNoticeVersion===PARTICIPANT_DOCUMENT_BACK_NOTICE_VERSION&&receipt.documentBackNoticeSha256===PARTICIPANT_DOCUMENT_BACK_NOTICE_SHA256;
}
export function participantKycHistoricalBackReceipt(found){
 const m=found.metadata;
 return {receiptId:found.id,submissionId:m.submissionId,superseded:true,documentBackConsentRecorded:true,documentBackNoticeVersion:m.documentBackNoticeVersion,documentBackNoticeSha256:m.documentBackNoticeSha256,identityCertified:false,permissionsGranted:false,whatsAppAccessGranted:false};
}
export const participantKycReceiptHasDocumentBack=receipt=>['documentBackConsentRecorded','documentBackNoticeVersion','documentBackNoticeSha256'].some(key=>Object.hasOwn(receipt||{},key));
export const participantKycHasDocumentBack=k=>k?.documentBackConsent!==undefined||Array.isArray(k?.images)&&(k.images.some(image=>image?.id==='document-back'||image?.kind==='DOCUMENT_BACK')||k.images.length===3);
function privateImage(image){
 if(!Number.isSafeInteger(image?.bytes)||image.bytes<1||image.bytes>2*1024*1024||!/^[a-f0-9]{64}$/.test(image.sha256||'')||!['image/png','image/jpeg','image/webp'].includes(image.contentType))return false;
 try{const url=new URL(image.url),extension={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[image.contentType];return url.protocol==='https:'&&/^[a-z0-9-]+\.private\.blob\.vercel-storage\.com$/.test(url.hostname)&&!url.port&&!url.search&&!url.hash&&!url.username&&!url.password&&new RegExp('^/obrasaas/legacy-images/v1/[a-f0-9]{64}/image\\.'+extension+'$').test(url.pathname);}catch{return false;}
}
// Legacy review/adoption keeps its existing two-image contract. Processing has
// always required exact IDs and the content digest and opts into strictLegacy.
// Every three-image path requires the same strict consent, set and receipt proof.
export function participantKycImageSet(k,{strictLegacy=false,receipt=null,projectId=null}={}){
 if(!Array.isArray(k?.images))return false;
 const back=participantKycHasDocumentBack(k)||participantKycReceiptHasDocumentBack(receipt);
 if(k.images.length!==(back?3:2))return false;
 if(!back&&!strictLegacy)return true;
 const set=[...expected,...(back?[['document-back','DOCUMENT_BACK']]:[])];
 if(set.some(([id,kind])=>k.images.filter(image=>image?.id===id&&image.kind===kind).length!==1)||digest(k.images.map(image=>[image.kind,image.sha256,image.bytes,image.contentType]))!==k.contentHash)return false;
 if(!back)return true;
 const c=k.documentBackConsent;
 if(!c||typeof c!=='object'||Array.isArray(c)||Object.keys(c).sort().join('|')!=='allowed|noticeSha256|noticeVersion|recordedAt'||c.allowed!==true||c.noticeVersion!==PARTICIPANT_DOCUMENT_BACK_NOTICE_VERSION||c.noticeSha256!==PARTICIPANT_DOCUMENT_BACK_NOTICE_SHA256||!iso(c.recordedAt)||c.recordedAt!==k.submittedAt||k.version!==1||k.noticeVersion!==PARTICIPANT_NOTICE_VERSION||k.noticeSha256!==digest(PARTICIPANT_NOTICE)||k.consentRecorded!==true||k.channelCapture!==undefined||k.images.some(image=>!privateImage(image)))return false;
 return !receipt||(participantKycDocumentBackReceipt(receipt,{projectId})&&receipt.contentHash===k.contentHash&&receipt.documentBackConsentRecorded===true&&receipt.documentBackNoticeVersion===c.noticeVersion&&receipt.documentBackNoticeSha256===c.noticeSha256);
}
