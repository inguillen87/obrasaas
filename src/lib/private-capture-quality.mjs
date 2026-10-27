import {createHash,createHmac,randomBytes} from 'node:crypto';
import {decodePrivateImage,MAX_PRIVATE_IMAGE_BYTES} from './private-image-upload.mjs';

export const CAPTURE_QUALITY_NOTICE_VERSION='participant-capture-quality-v1';
export const CAPTURE_QUALITY_MODEL_MANIFEST_SHA256='49b52aefe0f0247ff19b0445af1ab173550163d701fd2a2dd7959289bbbd42e3';
export const CAPTURE_QUALITY_REASON_CODES=Object.freeze([
 'DOCUMENT_FRAME_UNCONFIRMED','DOCUMENT_OUT_OF_FRAME','DOCUMENT_TOO_SMALL','DOCUMENT_PORTRAIT_UNCONFIRMED',
 'FACE_OUT_OF_FRAME','FACE_TOO_SMALL','IMAGE_BLURRED','IMAGE_DECODE_FAILED',
 'IMAGE_LOW_CONTRAST','IMAGE_TOO_BRIGHT','IMAGE_TOO_DARK','IMAGE_TOO_SMALL',
 'QUALITY_SERVICE_UNAVAILABLE','SINGLE_FACE_REQUIRED',
]);
const MODE='capture-quality-v1',MAX_BODY_BYTES=4000000,MAX_RESPONSE_BYTES=4096,TIMEOUT_MS=15000;
const KINDS=new Set(['DOCUMENT_FRONT','DOCUMENT_BACK','SELFIE']);
const MIME=new Set(['image/jpeg','image/png','image/webp']);
const REASONS=new Set(CAPTURE_QUALITY_REASON_CODES);
const UNCERTAIN_REASONS=new Set(['DOCUMENT_FRAME_UNCONFIRMED','QUALITY_SERVICE_UNAVAILABLE']);
const SERVICE_ERRORS=new Set([
 'CAPTURE_QUALITY_REQUEST_INVALID','CAPTURE_QUALITY_PRIVACY_REQUIRED','CAPTURE_QUALITY_RESULT_UNCONFIRMED',
 'BIOMETRIC_IMAGE_INVALID','BIOMETRIC_IMAGE_INTEGRITY','BIOMETRIC_REQUEST_INVALID',
 'BIOMETRIC_SERVICE_NOT_CONFIGURED','BIOMETRIC_SERVICE_ACCESS_REQUIRED','BIOMETRIC_SERVICE_BUSY',
 'BIOMETRIC_RESULT_UNCONFIRMED',
]);
const RESPONSE_FIELDS=['version','mode','kind','state','reasonCodes','imageSha256','modelManifestSha256','identityCertified','livenessVerified','documentAuthenticityVerified'];
const exact=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
const sha=value=>createHash('sha256').update(value).digest('hex');
const failure=code=>({state:'UNCERTAIN',code,reasonCodes:['QUALITY_SERVICE_UNAVAILABLE'],identityCertified:false,livenessVerified:false,documentAuthenticityVerified:false});

async function discard(response){try{await response?.body?.cancel?.();}catch{}}
async function boundedJson(response){
 const contentType=response.headers?.get('content-type')?.split(';')[0].trim().toLowerCase();
 const length=response.headers?.get('content-length');
 if(contentType!=='application/json'||!response.body?.getReader||length!==null&&(!/^\d+$/.test(length)||Number(length)>MAX_RESPONSE_BYTES)){await discard(response);throw Error();}
 const reader=response.body.getReader(),chunks=[];let total=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;if(!(value instanceof Uint8Array))throw Error();total+=value.byteLength;if(total>MAX_RESPONSE_BYTES)throw Error();chunks.push(Buffer.from(value));}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}
 finally{try{await reader.cancel();}catch{}reader.releaseLock();}
}

function validResult(value,payload){
 if(!exact(value,RESPONSE_FIELDS)||value.version!==1||value.mode!==MODE||value.kind!==payload.kind||value.imageSha256!==payload.image.sha256||value.modelManifestSha256!==CAPTURE_QUALITY_MODEL_MANIFEST_SHA256||value.identityCertified!==false||value.livenessVerified!==false||value.documentAuthenticityVerified!==false||!Array.isArray(value.reasonCodes)||value.reasonCodes.length>REASONS.size||value.reasonCodes.some(reason=>!REASONS.has(reason))||new Set(value.reasonCodes).size!==value.reasonCodes.length)return false;
 if(value.reasonCodes.includes('DOCUMENT_PORTRAIT_UNCONFIRMED')&&value.kind!=='DOCUMENT_FRONT')return false;
 if(value.state==='QUALITY_PASS')return value.reasonCodes.length===0;
 if(value.state==='RETAKE_REQUIRED')return value.reasonCodes.length>0&&value.reasonCodes.every(reason=>!UNCERTAIN_REASONS.has(reason));
 return value.state==='UNCERTAIN'&&value.reasonCodes.length===1&&UNCERTAIN_REASONS.has(value.reasonCodes[0]);
}

// The existing authenticated private worker receives one transient capture.
// Its quality decision grants no identity, liveness, document or storage proof.
export function createPrivateCaptureQuality({environment=process.env,fetchImpl=fetch,clock=()=>Date.now()}={}){
 if(typeof fetchImpl!=='function'||typeof clock!=='function')throw new TypeError('Private capture quality ports required');
 return {async assess(value){
  if(!exact(value,['kind','image','consentVersion'])||!KINDS.has(value.kind))return failure('CAPTURE_QUALITY_REQUEST_INVALID');
  if(value.consentVersion!==CAPTURE_QUALITY_NOTICE_VERSION)return failure('CAPTURE_QUALITY_PRIVACY_REQUIRED');
  let image;
  try{if(!exact(value.image,['buffer','mimeType'])||!Buffer.isBuffer(value.image.buffer)||!value.image.buffer.length||value.image.buffer.length>MAX_PRIVATE_IMAGE_BYTES||!MIME.has(value.image.mimeType))throw Error();const bytes=Buffer.from(value.image.buffer),data=bytes.toString('base64'),decoded=decodePrivateImage(data,value.image.mimeType);image={data,mimeType:decoded.contentType,sha256:decoded.digest};}
  catch{return failure('CAPTURE_QUALITY_IMAGE_INVALID');}
  const secret=environment?.OBRASAAS_BIOMETRIC_SERVICE_KEY;
  if(typeof secret!=='string'||!/^[a-f0-9]{64}$/.test(secret))return failure('CAPTURE_QUALITY_SERVICE_NOT_CONFIGURED');
  let endpoint;
  try{const origin=new URL(environment.APPLICATION_PUBLIC_ORIGIN||'https://obrasaas.com');if(origin.protocol!=='https:'||origin.hostname!=='obrasaas.com'||origin.pathname!=='/'||origin.search||origin.hash||origin.username||origin.password||origin.port)throw Error();endpoint=new URL('/api/internal/biometric-analysis',origin).href;}
  catch{return failure('CAPTURE_QUALITY_SERVICE_ORIGIN_INVALID');}
  const payload={version:1,mode:MODE,kind:value.kind,consentVersion:value.consentVersion,image},body=JSON.stringify(payload);
  if(Buffer.byteLength(body)>MAX_BODY_BYTES)return failure('CAPTURE_QUALITY_INPUT_TOO_LARGE');
  let timestamp,requestNonce,signature;
  try{timestamp=String(Math.floor(clock()/1000));requestNonce=randomBytes(16).toString('hex');if(!/^\d{10}$/.test(timestamp))throw Error();signature=createHmac('sha256',Buffer.from(secret,'hex')).update('obrasaas-biometric-v1\n'+timestamp+'\n'+requestNonce+'\n'+sha(body)).digest('hex');}
  catch{return failure('CAPTURE_QUALITY_REQUEST_INVALID');}
  let response;
  try{response=await fetchImpl(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json','X-Obrasaas-Timestamp':timestamp,'X-Obrasaas-Nonce':requestNonce,'X-Obrasaas-Signature':signature},body,redirect:'error',cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(TIMEOUT_MS)});}
  catch{return failure('CAPTURE_QUALITY_SERVICE_UNCONFIRMED');}
  let result;
  try{result=await boundedJson(response);}catch{return failure('CAPTURE_QUALITY_RESULT_UNCONFIRMED');}
  if(!response.ok)return failure(exact(result,['success','code'])&&result.success===false&&SERVICE_ERRORS.has(result.code)?result.code:'CAPTURE_QUALITY_SERVICE_UNCONFIRMED');
  return validResult(result,payload)?result:failure('CAPTURE_QUALITY_RESULT_UNCONFIRMED');
 }};
}
