import {createHash} from 'node:crypto';
import {WorkspaceError} from './workspace-policy.mjs';
import {createPrivateCaptureQuality,CAPTURE_QUALITY_NOTICE_VERSION,CAPTURE_QUALITY_MODEL_MANIFEST_SHA256,CAPTURE_QUALITY_REASON_CODES} from './private-capture-quality.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const allowed=new Set(['DOCUMENT_FRONT','SELFIE','DOCUMENT_BACK']);
const fields=['version','mode','kind','state','reasonCodes','imageSha256','modelManifestSha256','identityCertified','livenessVerified','documentAuthenticityVerified'];
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
const fail=(code,status=503)=>{throw new WorkspaceError(code,status);};
export function createCaptureQualityGate({assess,environment=process.env}={}){
 const inspect=assess===undefined?createPrivateCaptureQuality({environment}).assess:assess;
 if(typeof inspect!=='function')throw new TypeError('Private capture quality port required');
 return async function validate(images,{beforeAssess=async()=>{}}={}){
  if(!Array.isArray(images)||![2,3].includes(images.length)||new Set(images.map(value=>value?.kind)).size!==images.length||!images.some(value=>value?.kind==='DOCUMENT_FRONT')||!images.some(value=>value?.kind==='SELFIE'))fail('PARTICIPANT_CAPTURE_SOURCE_CHANGED',409);
  const copies=images.map(value=>{const image=value?.image;if(!allowed.has(value?.kind)||!Buffer.isBuffer(image?.bytes)||!image.bytes.length||image.bytes.length>2*1024*1024||!['image/jpeg','image/png','image/webp'].includes(image.contentType)||sha(image.bytes)!==image.digest)fail('PARTICIPANT_CAPTURE_SOURCE_CHANGED',409);return {entry:value,kind:value.kind,source:image,bytes:Buffer.from(image.bytes),digest:image.digest,contentType:image.contentType};});
  const results=[];
  // Validate the entire set before the caller is allowed to write its first
  // Blob. Retakes and unavailable analysis never create a partial presentation.
  for(const image of copies){
   await beforeAssess();
   let result;try{result=await inspect({kind:image.kind,image:{buffer:Buffer.from(image.bytes),mimeType:image.contentType},consentVersion:CAPTURE_QUALITY_NOTICE_VERSION});}catch{}
   const reason=Array.isArray(result?.reasonCodes)&&result.reasonCodes.find(code=>CAPTURE_QUALITY_REASON_CODES.includes(code))||'QUALITY_SERVICE_UNAVAILABLE';
   if(!exact(result,fields)||result.version!==1||result.mode!=='capture-quality-v1'||result.kind!==image.kind||result.imageSha256!==image.digest||result.modelManifestSha256!==CAPTURE_QUALITY_MODEL_MANIFEST_SHA256||result.identityCertified!==false||result.livenessVerified!==false||result.documentAuthenticityVerified!==false||result.state!=='QUALITY_PASS'||!Array.isArray(result.reasonCodes)||result.reasonCodes.length){
    fail('PARTICIPANT_CAPTURE_'+image.kind+'_'+reason,result?.state==='RETAKE_REQUIRED'||reason==='DOCUMENT_FRAME_UNCONFIRMED'?422:503);
   }
   results.push({kind:image.kind,imageSha256:image.digest});
  }
  await beforeAssess();
  if(images.length!==copies.length||copies.some((image,index)=>images[index]!==image.entry||images[index]?.kind!==image.kind||images[index]?.image!==image.source||!Buffer.isBuffer(image.source.bytes)||sha(image.source.bytes)!==image.digest||image.source.digest!==image.digest||image.source.contentType!==image.contentType))fail('PARTICIPANT_CAPTURE_SOURCE_CHANGED',409);
  return {version:1,policyVersion:CAPTURE_QUALITY_NOTICE_VERSION,modelManifestSha256:CAPTURE_QUALITY_MODEL_MANIFEST_SHA256,images:results,identityCertified:false,livenessVerified:false,documentAuthenticityVerified:false};
 };
}
