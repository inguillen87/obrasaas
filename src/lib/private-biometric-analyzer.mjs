import {createHash,createHmac,randomBytes} from 'node:crypto';

export const BIOMETRIC_NOTICE_VERSION='participant-private-biometric-v1';
const FAILURE=code=>({success:false,code,identityCertified:false,livenessVerified:false,requiresHumanReview:true});
const MIME=new Set(['image/jpeg','image/png','image/webp']);
const sha=value=>createHash('sha256').update(value).digest('hex');
const MANIFEST_SHA='c695e1a85db3ac933836562ce1f7d7e2b372ba2951dc9c4d0160b88cd448c860';
export function createPrivateBiometricAnalyzer({environment=process.env,fetchImpl=fetch,clock=()=>Date.now(),nonce=()=>randomBytes(16).toString('hex'),timeoutMs=60000}={}){
 return {async analyzeBiometricPair({front,selfie,consentVersion}={}){
  if(consentVersion!==BIOMETRIC_NOTICE_VERSION)return FAILURE('BIOMETRIC_PRIVACY_REQUIRED');
  const secret=environment.OBRASAAS_BIOMETRIC_SERVICE_KEY;
  if(typeof secret!=='string'||!/^[a-f0-9]{64}$/.test(secret))return FAILURE('BIOMETRIC_SERVICE_NOT_CONFIGURED');
  let endpoint;
  try{const origin=new URL(environment.APPLICATION_PUBLIC_ORIGIN||'https://obrasaas.com');if(origin.protocol!=='https:'||origin.hostname!=='obrasaas.com'||origin.pathname!=='/'||origin.search||origin.hash||origin.username||origin.password||origin.port)throw Error();endpoint=new URL('/api/internal/biometric-analysis',origin).href;}catch{return FAILURE('BIOMETRIC_SERVICE_ORIGIN_INVALID');}
  const prepare=value=>{if(!value||!Buffer.isBuffer(value.buffer)||!value.buffer.length||value.buffer.length>2*1024*1024||!MIME.has(value.mimeType))throw Error();return {data:value.buffer.toString('base64'),mimeType:value.mimeType,sha256:sha(value.buffer)};};
  let payload;
  try{payload={version:1,consentVersion,front:prepare(front),selfie:prepare(selfie)};}catch{return FAILURE('BIOMETRIC_IMAGE_INVALID');}
  if(payload.front.sha256===payload.selfie.sha256)return FAILURE('BIOMETRIC_DISTINCT_CAPTURES_REQUIRED');
  const body=JSON.stringify(payload);
  if(Buffer.byteLength(body)>4000000)return FAILURE('BIOMETRIC_INPUT_TOO_LARGE');
  const timestamp=String(Math.floor(clock()/1000)),requestNonce=nonce();
  if(!/^\d{10}$/.test(timestamp)||!/^[a-f0-9]{32}$/.test(requestNonce))return FAILURE('BIOMETRIC_REQUEST_INVALID');
  const signature=createHmac('sha256',Buffer.from(secret,'hex')).update('obrasaas-biometric-v1\n'+timestamp+'\n'+requestNonce+'\n'+sha(body)).digest('hex');
  try{
   const response=await fetchImpl(endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Obrasaas-Timestamp':timestamp,'X-Obrasaas-Nonce':requestNonce,'X-Obrasaas-Signature':signature},body,redirect:'error',signal:AbortSignal.timeout(timeoutMs)});
   if(!response.ok){await response.body?.cancel?.().catch(()=>{});return FAILURE('BIOMETRIC_SERVICE_UNCONFIRMED');}
   if(!/^application\/json\b/i.test(response.headers.get('content-type')||'')||!response.body)return FAILURE('BIOMETRIC_RESULT_UNCONFIRMED');
   const reader=response.body.getReader();let raw='',total=0;
   try{for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>4096)throw Error();raw+=Buffer.from(value).toString('utf8');}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
   const data=JSON.parse(raw),fields=['success','status','faceSimilarity','captureRiskSignal','identityCertified','livenessVerified','documentAuthenticityVerified','measurementCalibrated','requiresHumanReview','provider','modelManifestSha256','frontSha256','selfieSha256'];
   if(Object.keys(data).sort().join('|')!==fields.sort().join('|')||data.success!==true||data.status!=='ADVISORY_UNREVIEWED'||data.identityCertified!==false||data.livenessVerified!==false||data.documentAuthenticityVerified!==false||data.measurementCalibrated!==false||data.requiresHumanReview!==true||data.provider!=='private-opencv-onnx'||data.modelManifestSha256!==MANIFEST_SHA||data.frontSha256!==payload.front.sha256||data.selfieSha256!==payload.selfie.sha256||typeof data.faceSimilarity!=='number'||!Number.isFinite(data.faceSimilarity)||data.faceSimilarity < -1||data.faceSimilarity>1||typeof data.captureRiskSignal!=='number'||!Number.isFinite(data.captureRiskSignal)||data.captureRiskSignal<0||data.captureRiskSignal>1)throw Error();
   return data;
  }catch{return FAILURE('BIOMETRIC_RESULT_UNCONFIRMED');}
 }};
}
