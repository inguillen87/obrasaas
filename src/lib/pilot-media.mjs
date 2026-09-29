import { decodePrivateImage } from './private-image-upload.mjs';
const MAX_AUDIO_BYTES=16*1024*1024;
const AUDIO_TYPES=Object.freeze({'audio/ogg':'ogg','audio/opus':'ogg','audio/mpeg':'mp3','audio/mp3':'mp3','audio/mp4':'m4a','audio/x-m4a':'m4a','audio/wav':'wav','audio/x-wav':'wav','audio/webm':'webm'});
const text=(value,max=2000)=>typeof value==='string'&&value.trim().length>0&&value.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)?value.trim():null;
const score=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100?value:null;
const failure=code=>({success:false,status:'UNCONFIRMED',code,verified:false,identityVerified:false,requiresHumanReview:true});
export function unavailableBiometricAssessment(){
 return {...failure('BIOMETRIC_PROVIDER_NOT_IMPLEMENTED'),isMatch:null,confidenceScore:null,livenessDetected:null,isDniGenuine:null};
}
export function normalizeDniExtraction(raw){
 if(!raw||raw.isDni!==true)return failure('DNI_DOCUMENT_NOT_CONFIRMED');
 const name=text(raw.nombreCompleto??raw.fullName,180),givenDni=text(raw.dni,16);
 const dni=givenDni?.replace(/[ .-]/g,'');
 if(!name||!/^[0-9]{7,8}$/.test(dni||'')||/^0+$/.test(dni))return failure('DNI_EXTRACTION_INCOMPLETE');
 const cuil=text(raw.cuil,16),cuilDigits=cuil?.replace(/[ -]/g,'');
 return {success:true,status:'EXTRACTED_UNVERIFIED',verified:false,identityVerified:false,requiresHumanReview:true,
  isDni:true,nombreCompleto:name,dni,cuil:/^[0-9]{11}$/.test(cuilDigits||'')&&!/^0+$/.test(cuilDigits)?cuilDigits:null,ocrConfidence:score(raw.ocrConfidence)};
}
export function normalizeSitePhoto(raw){
 const phase=text(raw?.phase,100),description=text(raw?.aiAnalysis,4000);
 if(raw?.isWorksitePhoto!==true||!phase||!description||typeof raw.isIncident!=='boolean')return failure('PHOTO_ANALYSIS_INCOMPLETE');
 return {success:true,status:'ANALYZED_UNREVIEWED',verified:false,requiresHumanReview:true,archived:false,
  phase,aiAnalysis:description,isIncident:raw.isIncident,incidentSeverity:['Ninguna','Baja','Media','Crítica'].includes(raw.incidentSeverity)?raw.incidentSeverity:null,
  confidence:score(raw.confidence),estimatedProgressPercentage:score(raw.estimatedProgressPercentage),actionRecommendation:text(raw.actionRecommendation,2000)};
}
async function jsonBounded(response){
 if(!response.ok){await response.body?.cancel?.().catch(()=>{});return null;}
 const reader=response.body?.getReader();if(!reader)return null;
 let size=0;const chunks=[];
 try{while(true){const item=await reader.read();if(item.done)break;size+=item.value.byteLength;if(size>65536)return null;chunks.push(Buffer.from(item.value));}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
 }catch{return null;}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
export function createPilotMediaAnalyzer({environment=()=>process.env,fetchImpl=fetch,timeoutMs=20000}={}){
 if(typeof fetchImpl!=='function'||typeof environment!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw new Error('Invalid media adapter');
 const key=()=>{const value=environment().OPENAI_API_KEY;return typeof value==='string'&&value.trim()&&value!=='[SENSITIVE]'?value:null;};
 async function vision(input,kind){
  if(!key())return failure('AI_PROVIDER_NOT_CONFIGURED');
  let image;
  try{image=decodePrivateImage(input?.base64,input?.mimeType||null);}catch{return failure('MEDIA_IMAGE_INVALID');}
  const prompt=kind==='dni'
   ? 'Extrae texto visible del documento. No inventes campos ni determines autenticidad, identidad o prueba de vida. Devuelve JSON con isDni (boolean), nombreCompleto, dni y cuil (null si ilegibles). No asignes porcentajes inventados.'
   : 'Describe sólo lo visible de una foto de obra, sin afirmar cumplimiento, almacenamiento o aprobación. Devuelve JSON con isWorksitePhoto (boolean), phase, aiAnalysis, isIncident (boolean), incidentSeverity y actionRecommendation. Si no es una foto de obra legible, isWorksitePhoto debe ser false. Declara incertidumbre; no inventes avances ni porcentajes.';
  try{
   const response=await fetchImpl('https://api.openai.com/v1/chat/completions',{method:'POST',redirect:'error',signal:AbortSignal.timeout(timeoutMs),headers:{Authorization:'Bearer '+key(),'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-4o',messages:[{role:'system',content:prompt},{role:'user',content:[{type:'text',text:kind==='dni'?'Extraer campos legibles; la revisión humana es independiente.':(text(input.context,2000)||'Revisar la fotografía sin contexto adicional.')},{type:'image_url',image_url:{url:`data:${image.contentType};base64,${image.bytes.toString('base64')}`}}]}],response_format:{type:'json_object'},temperature:0.1,max_tokens:1000})});
   if(!response.ok){const providerStatus=response.status;await response.body?.cancel?.().catch(()=>{});return {...failure('AI_PROVIDER_REQUEST_REJECTED'),providerStatus};}
   const data=await jsonBounded(response),choice=data?.choices?.[0];
   if(choice?.finish_reason!=='stop'||choice?.message?.refusal)return failure('AI_RESPONSE_UNCONFIRMED');
   let value;try{value=JSON.parse(choice.message.content);}catch{return failure('AI_RESPONSE_INVALID');}
   return kind==='dni'?normalizeDniExtraction(value):normalizeSitePhoto(value);
  }catch{return failure('AI_REQUEST_UNCONFIRMED');}
 }
 async function audio({buffer,mimeType='audio/ogg',language='es'}={}){
  if(!key())return failure('AI_PROVIDER_NOT_CONFIGURED');
  const mime=typeof mimeType==='string'?mimeType.split(';')[0].trim().toLowerCase():'';
  if(!(buffer instanceof Uint8Array)||!buffer.byteLength||buffer.byteLength>MAX_AUDIO_BYTES||!AUDIO_TYPES[mime]||!['es','en'].includes(language))return failure('MEDIA_AUDIO_INVALID');
  try{
   const form=new FormData();form.append('file',new Blob([buffer],{type:mime}),'worksite-note.'+AUDIO_TYPES[mime]);form.append('model','whisper-1');form.append('language',language);
   form.append('prompt','Notas de obra en Argentina: revoque, cañería, cerámica, metros cuadrados, cemento, capataz.');
   const response=await fetchImpl('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:'Bearer '+key()},body:form,redirect:'error',signal:AbortSignal.timeout(timeoutMs)});
   if(!response.ok){const providerStatus=response.status;await response.body?.cancel?.().catch(()=>{});return {...failure('AUDIO_PROVIDER_REQUEST_REJECTED'),providerStatus};}
   const data=await jsonBounded(response),transcript=text(data?.text,32000);
   return transcript?{success:true,status:'TRANSCRIBED_UNREVIEWED',text:transcript,speakerVerified:false,identityVerified:false,attendanceRegistered:false}:failure('AUDIO_TRANSCRIPTION_UNCONFIRMED');
  }catch{return failure('AUDIO_REQUEST_UNCONFIRMED');}
 }
 return {analyzeDni:input=>vision(input,'dni'),analyzePhoto:input=>vision(input,'photo'),transcribeAudio:audio};
}
