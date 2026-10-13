import {createHash} from 'node:crypto';

// Server transport only. The caller owns canonical authority and durable receipts.
export const BINDX_CIVIL_CONFIGURATION_VERSION='bindx-civil-data-config-v1';
export const BINDX_CIVIL_CONSENT_VERSION='bindx-civil-data-consent-v1';
export const BINDX_CIVIL_RESPONSE_SCHEMA='apistore-renaper-civil-ddmmyyyy-v1';
const PROVIDER='BINDX_APISTORE',PRODUCT='RENAPER_CIVIL_DATA';
const PUBLISHED_ORIGIN='https://apistore.pcnt.io';
const LOGIN_PATH='/v1/login/jwt',PERSON_PATH='/v1/information/person-renaper/';
const MAX_LOGIN_BYTES=16*1024,MAX_PERSON_BYTES=32*1024;
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
const text=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max&&value.trim()===value&&!/[\u0000-\u001f\u007f]/.test(value);
const credential=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max&&!/[\u0000-\u001f\u007f]/.test(value);
const id=value=>text(value,160)&&/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value);
const iso=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const hash=value=>createHash('sha256').update(value).digest('hex');
const boundary={identityCertified:false,biometricsVerified:false,livenessVerified:false,permissionsGranted:false,requiresHumanReview:true};
const error=code=>Object.assign(new Error(code),{code});
const has=(value,key)=>Object.hasOwn(value,key);

function normalizedContext(value){
 if(!exact(value,['organizationId','actorId','subjectId','submissionId','operationId','documentSha256','dni','gender'])||!['organizationId','actorId','subjectId','submissionId'].every(key=>id(value[key]))||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value.operationId||'')||!/^\d{1,20}$/.test(value.dni||'')||!['F','M'].includes(value.gender)||!/^[a-f0-9]{64}$/.test(value.documentSha256||''))throw error('BINDX_CIVIL_CONTEXT_INVALID');
 return Object.freeze({...value});
}
// Private server binding, never a public identity receipt or a DNI log field.
export function bindxCivilContextDigest(context){
 const value=normalizedContext(context);
 return hash(JSON.stringify(['bindx-civil-context-v1',...['organizationId','actorId','subjectId','submissionId','operationId','documentSha256','dni','gender'].map(key=>value[key])]));
}
function confirmed(value,now){return exact(value,['reference','confirmedAt','confirmed'])&&id(value.reference)&&value.confirmed===true&&iso(value.confirmedAt)&&Date.parse(value.confirmedAt)<=now;}
function snapshot(configuration,beforeExternal,now){
 if(!exact(configuration,['version','state','product','origin','authentication','credentials','providerEvidence','renaperAgreement','context','consent'])||configuration.version!==BINDX_CIVIL_CONFIGURATION_VERSION||configuration.state!=='CONFIRMED'||configuration.product!==PRODUCT||configuration.origin!==PUBLISHED_ORIGIN||configuration.authentication!=='JWT'||typeof beforeExternal!=='function')throw error('BINDX_CIVIL_CONFIGURATION_INVALID');
 const credentials=configuration.credentials;
 if(!exact(credentials,['username','password'])||!credential(credentials.username,160)||!credential(credentials.password,4096))throw error('BINDX_CIVIL_CONFIGURATION_INVALID');
 const evidence=configuration.providerEvidence;
 if(!exact(evidence,['reference','confirmedAt','confirmed','origin','product','authentication','responseSchema','environmentConfirmed'])||!confirmed({reference:evidence.reference,confirmedAt:evidence.confirmedAt,confirmed:evidence.confirmed},now)||evidence.origin!==configuration.origin||evidence.product!==PRODUCT||evidence.authentication!=='JWT'||evidence.responseSchema!==BINDX_CIVIL_RESPONSE_SCHEMA||evidence.environmentConfirmed!==true||!confirmed(configuration.renaperAgreement,now))throw error('BINDX_CIVIL_PROVIDER_EVIDENCE_REQUIRED');
 const context=normalizedContext(configuration.context),bindingDigest=bindxCivilContextDigest(context),consent=configuration.consent;
 if(!exact(consent,['version','reference','acceptedAt','confirmed','provider','purpose','contextDigest'])||consent.version!==BINDX_CIVIL_CONSENT_VERSION||!id(consent.reference)||!iso(consent.acceptedAt)||Date.parse(consent.acceptedAt)>now||consent.confirmed!==true||consent.provider!==PROVIDER||consent.purpose!==PRODUCT||consent.contextDigest!==bindingDigest)throw error('BINDX_CIVIL_CONSENT_REQUIRED');
 const fence=Object.freeze({provider:PROVIDER,product:PRODUCT,bindingDigest,organizationId:context.organizationId,actorId:context.actorId,subjectId:context.subjectId,submissionId:context.submissionId,operationId:context.operationId,documentSha256:context.documentSha256,consentReference:consent.reference,providerEvidenceReference:evidence.reference,agreementReference:configuration.renaperAgreement.reference});
 return {origin:configuration.origin,credentials:Object.freeze({...credentials}),context,bindingDigest,fence};
}
function cancel(value){try{Promise.resolve(value?.cancel?.()).catch(()=>{});}catch{/* Never publish a transport or stream error. */}}
async function bounded(promise,signal){
 if(signal.aborted)throw error('BINDX_CIVIL_TIMEOUT');
 let abort;const timeout=new Promise((_,reject)=>{abort=()=>reject(error('BINDX_CIVIL_TIMEOUT'));signal.addEventListener('abort',abort,{once:true});});
 try{return await Promise.race([promise,timeout]);}finally{signal.removeEventListener('abort',abort);}
}
async function jsonBody(response,limit,signal){
 if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(response.headers?.get('content-type')||'')||!response.body?.getReader)throw error('BINDX_CIVIL_RESPONSE_INVALID');
 const length=response.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>limit))throw error('BINDX_CIVIL_RESPONSE_TOO_LARGE');
 const reader=response.body.getReader(),parts=[];let size=0;
 try{for(;;){const part=await bounded(reader.read(),signal);if(part.done)break;if(!(part.value instanceof Uint8Array))throw error('BINDX_CIVIL_RESPONSE_INVALID');size+=part.value.byteLength;if(size>limit)throw error('BINDX_CIVIL_RESPONSE_TOO_LARGE');parts.push(Buffer.from(part.value));}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts)));}
 catch(cause){if(cause?.code==='BINDX_CIVIL_TIMEOUT'||cause?.code==='BINDX_CIVIL_RESPONSE_TOO_LARGE')throw cause;throw error('BINDX_CIVIL_RESPONSE_INVALID');}
 finally{cancel(reader);try{reader.releaseLock();}catch{/* A reader with an unfinished read can already be released. */}}
}
function providerDate(value){
 if(typeof value!=='string'||!/^\d{2}\/\d{2}\/\d{4}$/.test(value))return false;
 const [day,month,year]=value.split('/').map(Number),date=new Date(0);date.setUTCFullYear(year,month-1,day);date.setUTCHours(0,0,0,0);
 return year>=1&&date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day;
}
function civilProjection(data){
 const strings=['nombres','apellido','ejemplar','fecha_nacimiento','emision','vencimiento'];
 if(!data||typeof data!=='object'||Array.isArray(data)||!strings.every(key=>has(data,key)&&text(data[key],key==='ejemplar'?16:160))||!['fecha_nacimiento','emision','vencimiento'].every(key=>providerDate(data[key]))||!has(data,'codigo_fallecido')||!Number.isSafeInteger(data.codigo_fallecido)||data.codigo_fallecido<0||data.codigo_fallecido>1000000)throw error('BINDX_CIVIL_RESPONSE_SCHEMA_UNCONFIRMED');
 // Keep provider dates and the uninterpreted death code; do not infer identity,
 // survival, document authenticity, face comparison or admission from them.
 return Object.freeze(Object.fromEntries([...strings,'codigo_fallecido'].map(key=>[key,data[key]])));
}

export function createBindxCivilDataClient({configuration=null,beforeExternal,onTechnicalObservation=null,technicalObservationTimeoutMs=6000,fetchImpl=globalThis.fetch,timeoutMs=15000,clock=()=>Date.now()}={}){
 if(typeof fetchImpl!=='function'||typeof clock!=='function'||onTechnicalObservation!==null&&typeof onTechnicalObservation!=='function'||!Number.isInteger(technicalObservationTimeoutMs)||technicalObservationTimeoutMs<1||technicalObservationTimeoutMs>6000||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)throw new TypeError('BINDX_CIVIL_CLIENT_OPTIONS_INVALID');
 let configured=null,configurationCode=null;
 if(configuration!==null&&configuration?.state!=='CONTRACT_PENDING'){try{const now=clock();if(!Number.isSafeInteger(now)||!Number.isFinite(new Date(now).getTime()))throw error('BINDX_CIVIL_CONFIGURATION_INVALID');configured=snapshot(configuration,beforeExternal,now);}catch(cause){configurationCode=['BINDX_CIVIL_CONFIGURATION_INVALID','BINDX_CIVIL_PROVIDER_EVIDENCE_REQUIRED','BINDX_CIVIL_CONTEXT_INVALID','BINDX_CIVIL_CONSENT_REQUIRED'].includes(cause?.code)?cause.code:'BINDX_CIVIL_CONFIGURATION_INVALID';}}
 let attempted=false,lastQueryAttempted=false;
 const result=(state,code,{data=null,observedAt=null,queryAttempted=lastQueryAttempted,httpStatus=null}={})=>Object.freeze({version:1,provider:PROVIDER,state,code,bindingDigest:configured?.bindingDigest||null,observedAt,queryAttempted,httpStatus,data,...boundary});
 const readiness=()=>Object.freeze({provider:PROVIDER,state:configured?'TRANSPORT_CONFIGURED':configurationCode?'CONFIGURATION_REJECTED':'CONTRACT_PENDING',available:Boolean(configured),providerAcceptanceVerified:false,code:configurationCode});
 return Object.freeze({readiness,async lookup(...input){
  if(input.length)return result('INPUT_REJECTED','BINDX_CIVIL_SERVER_CONTEXT_REQUIRED');
  if(!configured)return result(configurationCode?'CONFIGURATION_REJECTED':'CONTRACT_PENDING',configurationCode||'BINDX_CIVIL_CONTRACT_PENDING');
  if(attempted)return result('UNKNOWN','BINDX_CIVIL_OPERATION_ALREADY_ATTEMPTED');
  // In-memory reuse guard only. A durable canonical operation/receipt is still
  // required before mounting this component or reconstructing it after a crash.
  attempted=true;const controller=new AbortController(),deadline=performance.now()+timeoutMs,timer=setTimeout(()=>controller.abort(),timeoutMs);let queryAttempted=false,technicalObservationAttempted=false;
  const ensureBudget=()=>{if(controller.signal.aborted||performance.now()>=deadline){controller.abort();throw error('BINDX_CIVIL_TIMEOUT');}};
  const fence=async stage=>{try{ensureBudget();if(await bounded(Promise.resolve().then(()=>beforeExternal(Object.freeze({...configured.fence,stage}))),controller.signal)!==true)throw error('BINDX_CIVIL_AUTHORITY_DENIED');ensureBudget();}catch(cause){if(cause?.code==='BINDX_CIVIL_TIMEOUT')throw cause;throw error('BINDX_CIVIL_AUTHORITY_DENIED');}};
  const request=async(url,options,limit)=>{
   let response;try{const pending=Promise.resolve().then(()=>{ensureBudget();if(options.method==='GET')queryAttempted=lastQueryAttempted=true;return fetchImpl(url,{...options,redirect:'error',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',signal:controller.signal});});pending.then(late=>{if(controller.signal.aborted)cancel(late?.body);},()=>{});response=await bounded(pending,controller.signal);}catch(cause){if(cause?.code==='BINDX_CIVIL_TIMEOUT')throw cause;throw error('BINDX_CIVIL_TRANSPORT_UNCONFIRMED');}
   try{ensureBudget();if(!response||!Number.isInteger(response.status)||response.status<100||response.status>599||response.redirected===true||response.url&&response.url!==url)throw error('BINDX_CIVIL_RESPONSE_INVALID');if(response.status!==200)return {httpStatus:response.status,data:null};const data=await jsonBody(response,limit,controller.signal);ensureBudget();return {httpStatus:200,data};}finally{cancel(response?.body);}
  };
  const observeTechnical=async value=>{
   if(!queryAttempted||technicalObservationAttempted||onTechnicalObservation===null)return;
   technicalObservationAttempted=true;
   // Settlement is a local technical operation. A consumed wire deadline or
   // later actor revocation cannot erase an already attempted civil query.
   // The canonical observer owns its database timeout and receipt. Bound the
   // await as well; a late local commit cannot disclose data or trigger a new
   // UNKNOWN observation that would overwrite its already settled fact.
   const local=new AbortController(),expiresAt=performance.now()+technicalObservationTimeoutMs,stop=setTimeout(()=>local.abort(),technicalObservationTimeoutMs);
   try{await bounded(Promise.resolve().then(()=>onTechnicalObservation(value)),local.signal);if(performance.now()>=expiresAt)throw error('BINDX_CIVIL_TECHNICAL_OBSERVATION_UNCONFIRMED');}catch{throw error('BINDX_CIVIL_TECHNICAL_OBSERVATION_UNCONFIRMED');}finally{clearTimeout(stop);local.abort();}
  };
  try{
   await fence('LOGIN');const login=await request(configured.origin+LOGIN_PATH,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(configured.credentials)},MAX_LOGIN_BYTES);
   if(login.httpStatus!==200)return result('AUTH_REJECTED','BINDX_CIVIL_AUTH_REJECTED',{httpStatus:login.httpStatus});
   const token=login.data?.token;if(!login.data||!has(login.data,'token')||typeof token!=='string'||token.length>8192||!(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/).test(token)||has(login.data,'expires_in')&&(!Number.isSafeInteger(login.data.expires_in)||login.data.expires_in<=0))throw error('BINDX_CIVIL_AUTH_SCHEMA_UNCONFIRMED');
   await fence('LOOKUP');const observed=await request(configured.origin+PERSON_PATH+configured.context.dni+'/gender/'+configured.context.gender,{method:'GET',headers:{'Content-Type':'application/json','Accept':'application/json','Authorization':'JWT '+token}},MAX_PERSON_BYTES);
   if(observed.httpStatus!==200){await observeTechnical(result('UNKNOWN','BINDX_CIVIL_REQUEST_REJECTED',{queryAttempted,httpStatus:observed.httpStatus}));return result('REQUEST_REJECTED','BINDX_CIVIL_REQUEST_REJECTED',{queryAttempted,httpStatus:observed.httpStatus});}
   const data=civilProjection(observed.data),time=clock();ensureBudget();if(!Number.isSafeInteger(time)||!Number.isFinite(new Date(time).getTime()))throw error('BINDX_CIVIL_TIMEOUT');
   const technical=result('OBSERVED',null,{data,observedAt:new Date(time).toISOString(),queryAttempted,httpStatus:200});
   await observeTechnical(technical);await fence('RETURN_RESULT');return technical;
  }catch(cause){const safe=new Set(['BINDX_CIVIL_TIMEOUT','BINDX_CIVIL_AUTHORITY_DENIED','BINDX_CIVIL_TRANSPORT_UNCONFIRMED','BINDX_CIVIL_RESPONSE_INVALID','BINDX_CIVIL_RESPONSE_TOO_LARGE','BINDX_CIVIL_RESPONSE_SCHEMA_UNCONFIRMED','BINDX_CIVIL_AUTH_SCHEMA_UNCONFIRMED','BINDX_CIVIL_TECHNICAL_OBSERVATION_UNCONFIRMED']);const code=safe.has(cause?.code)?cause.code:'BINDX_CIVIL_TRANSPORT_UNCONFIRMED';
   try{await observeTechnical(result('UNKNOWN',code,{queryAttempted}));}catch{return result('UNKNOWN','BINDX_CIVIL_TECHNICAL_OBSERVATION_UNCONFIRMED',{queryAttempted});}
   return result(code==='BINDX_CIVIL_AUTHORITY_DENIED'?'AUTHORITY_DENIED':'UNKNOWN',code,{queryAttempted});}
  finally{clearTimeout(timer);controller.abort();}
 }});
}
