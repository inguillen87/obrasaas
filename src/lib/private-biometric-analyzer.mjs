import {createHash,createHmac,randomBytes} from 'node:crypto';
import {PARTICIPANT_PRECOMMIT_BIOMETRIC_NOTICE_VERSION as FACIAL_NOTICE_VERSION,PARTICIPANT_PRECOMMIT_BIOMETRIC_NOTICE_SHA256 as FACIAL_NOTICE_SHA256} from './participant-analysis-consent.mjs';
export const BIOMETRIC_NOTICE_VERSION='participant-private-biometric-v1';
const FACIAL_MODEL_MANIFEST_SHA256='c695e1a85db3ac933836562ce1f7d7e2b372ba2951dc9c4d0160b88cd448c860';
export {FACIAL_NOTICE_VERSION,FACIAL_NOTICE_SHA256,FACIAL_MODEL_MANIFEST_SHA256};
const versions=new Set(['participant-private-biometric-v1','participant-private-biometric-v2',FACIAL_NOTICE_VERSION]);
const mime=new Set(['image/jpeg','image/png','image/webp']);
const sha=value=>createHash('sha256').update(value).digest('hex');
const failure=code=>({success:false,code,identityCertified:false,livenessVerified:false,requiresHumanReview:true});
const exact=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
export function dispatchUnconfirmed(code='BIOMETRIC_DISPATCH_UNCONFIRMED'){return Object.assign(new Error(code),{code});}
function bounded(ms){
 const controller=new AbortController();let timer;
 const stopped=new Promise((_,reject)=>{timer=setTimeout(()=>{const error=dispatchUnconfirmed();controller.abort(error);reject(error);},ms);});
 return{signal:controller.signal,assert(){if(controller.signal.aborted)throw controller.signal.reason;},wait(value){return Promise.race([value,stopped]);},close(){clearTimeout(timer);}};
}
export function createPrivateBiometricAnalyzer({environment=process.env,fetchImpl=fetch,clock=()=>Date.now(),nonce=()=>randomBytes(16).toString('hex'),timeoutMs=60000}={}){
 if(typeof fetchImpl!=='function'||typeof clock!=='function'||typeof nonce!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<5||timeoutMs>60000)throw new TypeError('Biometric transport and deadline must be valid');
 return{async analyzeBiometricPair(input={},options={}){
  const {front,selfie,consentVersion}=input;
  if(!versions.has(consentVersion))return failure('BIOMETRIC_PRIVACY_REQUIRED');
  const v3=consentVersion===FACIAL_NOTICE_VERSION;
  if(v3&&typeof options.beforeDispatch!=='function')return failure('BIOMETRIC_DISPATCH_FENCE_REQUIRED');
  const secret=environment.OBRASAAS_BIOMETRIC_SERVICE_KEY;
  if(typeof secret!=='string'||!/^[a-f0-9]{64}$/.test(secret))return failure('BIOMETRIC_SERVICE_NOT_CONFIGURED');
  let endpoint;
  try{const origin=new URL(environment.APPLICATION_PUBLIC_ORIGIN||'https://obrasaas.com');if(origin.protocol!=='https:'||origin.hostname!=='obrasaas.com'||origin.pathname!=='/'||origin.search||origin.hash||origin.username||origin.password||origin.port)throw Error();endpoint=new URL('/api/internal/biometric-analysis',origin).href;}catch{return failure('BIOMETRIC_SERVICE_ORIGIN_INVALID');}
  const prepare=value=>{if(!value||!Buffer.isBuffer(value.buffer)||!value.buffer.length||value.buffer.length>2*1024*1024||!mime.has(value.mimeType))throw Error();const owned=Buffer.from(value.buffer);return{data:owned.toString('base64'),mimeType:value.mimeType,sha256:sha(owned)};};
  let payload;
  try{payload={version:1,consentVersion,front:prepare(front),selfie:prepare(selfie)};}catch{return failure('BIOMETRIC_IMAGE_INVALID');}
  if(payload.front.sha256===payload.selfie.sha256)return failure('BIOMETRIC_DISTINCT_CAPTURES_REQUIRED');
  const body=JSON.stringify(payload);
  if(Buffer.byteLength(body)>4000000)return failure('BIOMETRIC_INPUT_TOO_LARGE');
  let timestamp=String(Math.floor(clock()/1000));const requestNonce=nonce();
  if(!/^\d{10}$/.test(timestamp)||!/^[a-f0-9]{32}$/.test(requestNonce))return failure('BIOMETRIC_REQUEST_INVALID');
  const digest=sha(body),budget=bounded(timeoutMs);
  try{
   if(v3){
    const proof=Object.freeze({version:1,consentVersion,noticeSha256:FACIAL_NOTICE_SHA256,bodySha256:digest,frontSha256:payload.front.sha256,selfieSha256:payload.selfie.sha256,frontBytes:front.buffer.length,selfieBytes:selfie.buffer.length,frontMimeType:payload.front.mimeType,selfieMimeType:payload.selfie.mimeType,modelManifestSha256:FACIAL_MODEL_MANIFEST_SHA256});
    // No catch here: an authority denial or uncertain journal COMMIT keeps its identity.
    const ack=await budget.wait(options.beforeDispatch(proof,Object.freeze({signal:budget.signal})));
    budget.assert();
    if(!exact(ack,['dispatched','bodySha256'])||ack.dispatched!==true||ack.bodySha256!==digest)throw dispatchUnconfirmed();
    // Caller mutation must not silently separate journal/source binding from disclosure.
    if(input.consentVersion!==consentVersion||input.front!==front||input.selfie!==selfie||!Buffer.isBuffer(front.buffer)||!Buffer.isBuffer(selfie.buffer)||front.mimeType!==payload.front.mimeType||selfie.mimeType!==payload.selfie.mimeType||sha(front.buffer)!==payload.front.sha256||sha(selfie.buffer)!==payload.selfie.sha256)throw dispatchUnconfirmed('BIOMETRIC_SOURCE_CHANGED');
    // A slow SQL fence must not send an already stale HMAC timestamp.
    timestamp=String(Math.floor(clock()/1000));
    if(!/^\d{10}$/.test(timestamp))throw dispatchUnconfirmed();
   }
   const signature=createHmac('sha256',Buffer.from(secret,'hex')).update('obrasaas-biometric-v1\n'+timestamp+'\n'+requestNonce+'\n'+digest).digest('hex');
   budget.assert();
   try{
    const response=await budget.wait(fetchImpl(endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Obrasaas-Timestamp':timestamp,'X-Obrasaas-Nonce':requestNonce,'X-Obrasaas-Signature':signature},body,redirect:'error',signal:budget.signal}));
    budget.assert();
    if(!response.ok){await budget.wait(response.body?.cancel?.().catch(()=>{}));return failure('BIOMETRIC_SERVICE_UNCONFIRMED');}
    if(!/^application\/json\b/i.test(response.headers.get('content-type')||'')||!response.body){void response.body?.cancel?.().catch(()=>{});return failure('BIOMETRIC_RESULT_UNCONFIRMED');}
    const reader=response.body.getReader();let raw='',total=0;
    try{for(;;){budget.assert();const {done,value}=await budget.wait(reader.read());budget.assert();if(done)break;total+=value.byteLength;if(total>4096)throw Error();raw+=Buffer.from(value).toString('utf8');}}finally{void reader.cancel().catch(()=>{});reader.releaseLock();}
    const data=JSON.parse(raw),fields=['success','status','faceSimilarity','captureRiskSignal','identityCertified','livenessVerified','documentAuthenticityVerified','measurementCalibrated','requiresHumanReview','provider','modelManifestSha256','frontSha256','selfieSha256'];
    if(!exact(data,fields)||data.success!==true||data.status!=='ADVISORY_UNREVIEWED'||data.identityCertified!==false||data.livenessVerified!==false||data.documentAuthenticityVerified!==false||data.measurementCalibrated!==false||data.requiresHumanReview!==true||data.provider!=='private-opencv-onnx'||data.modelManifestSha256!==FACIAL_MODEL_MANIFEST_SHA256||data.frontSha256!==payload.front.sha256||data.selfieSha256!==payload.selfie.sha256||typeof data.faceSimilarity!=='number'||!Number.isFinite(data.faceSimilarity)||data.faceSimilarity< -1||data.faceSimilarity>1||typeof data.captureRiskSignal!=='number'||!Number.isFinite(data.captureRiskSignal)||data.captureRiskSignal<0||data.captureRiskSignal>1)throw Error();
    return data;
   }catch{return failure('BIOMETRIC_RESULT_UNCONFIRMED');}
  }finally{budget.close();}
 }};
}
