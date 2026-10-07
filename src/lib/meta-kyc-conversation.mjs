import {digest,WorkspaceError} from './workspace-policy.mjs';
import {PARTICIPANT_NOTICE,PARTICIPANT_NOTICE_VERSION,PARTICIPANT_OCR_NOTICE,PARTICIPANT_OCR_NOTICE_VERSION,PARTICIPANT_BIOMETRIC_NOTICE,PARTICIPANT_BIOMETRIC_NOTICE_VERSION} from './participant-policy.mjs';
import {SITE_ROLES,siteText} from './site-register-policy.mjs';

export const META_KYC_CONVERSATION_TTL_MS=30*60*1000;
export const EMPLOYEE_INTAKE_NOTICE_VERSION='employee-intake-v1';
export const EMPLOYEE_INTAKE_NOTICE='Tu nombre, oficio solicitado, correo y teléfono se guardarán en privado para que el responsable de esta empresa revise tu solicitud y pueda invitarte a una obra. La solicitud no concede acceso ni verifica tu identidad. No envíes documentos todavía.';
const intakeText=body=>({type:'text',body});
function intakePrompt(state,eventId){
 const descriptions={NAME:'Hola. Para solicitar ingreso a esta empresa, respondé a este mensaje con tu nombre y apellido. No envíes documentos.',EMAIL:'Respondé a este mensaje con el correo que vas a usar para aceptar la invitación. El correo se comprobará al ingresar a tu cuenta.',WAITING_RESPONSIBLE:'Tu solicitud está guardada y pendiente del responsable. Todavía no tenés acceso. La invitación, la identidad y los permisos se revisan por separado.',ADMITTED:'Un responsable registró tu ficha. Falta comprobar la invitación y aceptar tu cuenta; no se habilitó WhatsApp.',REJECTED:'El responsable cerró esta solicitud. No se habilitó acceso.',CANCELLED:'Solicitud cancelada. No se creó una cuenta ni se habilitó acceso.'};
 if(['JOB','CONFIRM'].includes(state.step)){
  const rows=state.step==='JOB'?Object.entries(SITE_ROLES):[['CONFIRM','Enviar solicitud'],['CANCEL','Cancelar']];
  const nonce=digest(['employee-intake-choice-v1',eventId,state.step]).slice(0,20);
  return {state:{...state,nonce,choices:rows.map(([value,title])=>({value,title}))},reply:{type:'interactive',body:state.step==='JOB'?'Elegí el oficio o función que solicitás. Un responsable decidirá la participación; esto no concede permisos.':EMPLOYEE_INTAKE_NOTICE+'\nNombre: '+state.name+'\nOficio solicitado: '+SITE_ROLES[state.job]+'\nCorreo: '+state.email,button:'Elegir',sections:[{title:'Solicitud de ingreso',rows:rows.map(([,title],index)=>({id:'intake:'+nonce+':'+index,title:title.slice(0,24)}))}]}};
 }
 return {state,reply:intakeText(descriptions[state.step]||'Escribí ESTADO para consultar tu solicitud.')};
}
export function beginEmployeeIntakeConversation(eventId){return intakePrompt({version:1,step:'NAME',noticeVersion:EMPLOYEE_INTAKE_NOTICE_VERSION,noticeSha256:digest(EMPLOYEE_INTAKE_NOTICE),consent:false,name:null,job:null,email:null},eventId);}
export function planEmployeeIntakeConversation({message,state,eventId,promptConfirmed=false}){
 if(state?.version!==1||!['NAME','JOB','EMAIL','CONFIRM','WAITING_RESPONSIBLE','ADMITTED','REJECTED','CANCELLED'].includes(state.step))throw new WorkspaceError('EMPLOYEE_INTAKE_INTEGRITY',409);
 const body=message.type==='text'?message.text?.body?.trim():null;
 if(['WAITING_RESPONSIBLE','ADMITTED','REJECTED','CANCELLED'].includes(state.step))return intakePrompt(state,eventId);
 if(body?.toUpperCase()==='CANCELAR')return intakePrompt({...state,step:'CANCELLED',consent:false},eventId);
 if(['HOLA','ESTADO','AYUDA'].includes(body?.toUpperCase())||!promptConfirmed)return intakePrompt(state,eventId);
 const next={...state};delete next.nonce;delete next.choices;
 if(state.step==='NAME'){
  try{return intakePrompt({...next,name:siteText(body,100,2),step:'JOB'},eventId);}catch{return intakePrompt(state,eventId);}
 }
 if(state.step==='EMAIL'){
  if(typeof body!=='string'||body.length>254||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(body))return intakePrompt(state,eventId);
  return intakePrompt({...next,email:body.toLowerCase(),step:'CONFIRM'},eventId);
 }
 const selection=message.interactive?.list_reply?.id||message.interactive?.button_reply?.id,match=/^intake:([a-f0-9]{20}):(\d{1,2})$/.exec(selection||'');
 if(!match||match[1]!==state.nonce||!state.choices?.[Number(match[2])])return intakePrompt(state,eventId);
 const selected=state.choices[Number(match[2])].value;
 if(state.step==='JOB'&&Object.hasOwn(SITE_ROLES,selected))return intakePrompt({...next,job:selected,step:'EMAIL'},eventId);
 if(state.step==='CONFIRM'&&selected==='CONFIRM')return intakePrompt({...next,consent:true,step:'WAITING_RESPONSIBLE',confirmationEventId:eventId},eventId);
 if(state.step==='CONFIRM'&&selected==='CANCEL')return intakePrompt({...next,consent:false,step:'CANCELLED'},eventId);
 return intakePrompt(state,eventId);
}
const text=body=>({type:'text',body});
const hints={CONSENT:'Leé el aviso y elegí si autorizás guardar las imágenes.',OCR:'La lectura asistida es opcional. Elegí con o sin lectura.',FRONT:'Enviá una foto nítida del frente de tu documento, en un solo mensaje de imagen. Máximo 2 MB.',SELFIE:'Enviá una selfie nítida en un solo mensaje de imagen. Máximo 2 MB. Esto no comprueba prueba de vida.',CONFIRM:'Elegí Guardar identidad para presentar las dos imágenes o Cancelar.'};
function choices(state,eventId,body,rows){const nonce=digest(['meta-kyc-choice-v1',eventId,state.step]).slice(0,20);return {state:{...state,nonce,choices:rows.map(([value,title])=>({value,title}))},reply:{type:'interactive',body,button:'Elegir',sections:[{title:'Identidad',rows:rows.map(([,title],index)=>({id:'kyc:'+nonce+':'+index,title}))}]}};}
function prompt(state,eventId){
 if(state.step==='CONSENT')return choices(state,eventId,PARTICIPANT_NOTICE+'\nEste recorrido sólo presenta imágenes; no habilita permisos. Podés cancelar antes de guardar.',[['CONSENT','Autorizar imágenes'],['CANCEL','Cancelar']]);
 if(state.step==='OCR')return choices(state,eventId,PARTICIPANT_OCR_NOTICE,[['OCR_YES','Con lectura asistida'],['OCR_NO','Sin lectura asistida'],['CANCEL','Cancelar']]);
 if(state.step==='BIOMETRIC')return choices(state,eventId,PARTICIPANT_BIOMETRIC_NOTICE,[['BIOMETRIC_YES','Con comparación facial'],['BIOMETRIC_NO','Sin comparación facial'],['CANCEL','Cancelar']]);
 if(state.step==='CONFIRM')return choices(state,eventId,'Las dos imágenes están preparadas para presentar. Un responsable debe revisarlas. La lectura asistida '+(state.ocrConsent?'quedará autorizada.':'no está autorizada.')+' La comparación facial '+(state.biometricConsent?'quedará autorizada.':'no está autorizada.')+' La selfie es una imagen estática y no comprueba prueba de vida. ¿Querés guardarlas?',[['CONFIRM','Guardar identidad'],['CANCEL','Cancelar']]);
 return {state,reply:text(hints[state.step]+' Escribí CANCELAR para terminar sin presentar.')};
}
export function beginMetaKycConversation(eventId){return prompt({version:1,step:'CONSENT',noticeVersion:PARTICIPANT_NOTICE_VERSION,noticeSha256:digest(PARTICIPANT_NOTICE),ocrNoticeVersion:PARTICIPANT_OCR_NOTICE_VERSION,ocrNoticeSha256:digest(PARTICIPANT_OCR_NOTICE),biometricNoticeVersion:PARTICIPANT_BIOMETRIC_NOTICE_VERSION,biometricNoticeSha256:digest(PARTICIPANT_BIOMETRIC_NOTICE),consent:false,ocrConsent:false,biometricConsent:false,front:null,selfie:null},eventId);}
export function planMetaKycConversation({message,state,eventId}){
 if(!state||state.version!==1)throw new WorkspaceError('META_KYC_CONVERSATION_REQUIRED',409);
 if(state.step==='FINALIZING')return {state,preserveConversation:true,reply:text('La presentación confirmada está pendiente de comprobar. Conservamos el mismo intento; no vuelvas a enviar imágenes ni inicies otro código. La confirmación ya fue recibida y no se puede cancelar desde este mensaje.')};
 const body=message.type==='text'?message.text?.body?.trim().toUpperCase():null;
 if(body==='CANCELAR')return {state:null,cancelled:true,reply:text('Presentación cancelada. No se presentaron imágenes ni se habilitaron permisos. Pedí al responsable otro código si querés empezar de nuevo.')};
 if(body==='ESTADO'||body==='AYUDA')return prompt(state,eventId);
 const selection=message.type==='interactive'?(message.interactive?.list_reply?.id||message.interactive?.button_reply?.id):null;
 let selected=null;
 if(selection){const match=/^kyc:([a-f0-9]{20}):(\d{1,2})$/.exec(selection);if(!match||match[1]!==state.nonce||!state.choices?.[Number(match[2])])return prompt(state,eventId);selected=state.choices[Number(match[2])].value;}
 if(selected==='CANCEL')return {state:null,cancelled:true,reply:text('Presentación cancelada. No se presentaron imágenes ni se habilitaron permisos.')};
 const next={...state};delete next.nonce;delete next.choices;
 if(state.step==='CONSENT')return selected==='CONSENT'?prompt({...next,step:'OCR',consent:true},eventId):prompt(state,eventId);
 if(state.step==='OCR')return ['OCR_YES','OCR_NO'].includes(selected)?prompt({...next,step:'BIOMETRIC',ocrConsent:selected==='OCR_YES'},eventId):prompt(state,eventId);
 if(state.step==='BIOMETRIC')return ['BIOMETRIC_YES','BIOMETRIC_NO'].includes(selected)?prompt({...next,step:'FRONT',biometricConsent:selected==='BIOMETRIC_YES'},eventId):prompt(state,eventId);
 if(['FRONT','SELFIE'].includes(state.step)){
  const image=message.type==='image'?message.image:null;
  if(!/^\d{5,32}$/.test(image?.id||'')||!['image/jpeg','image/png','image/webp'].includes(image?.mime_type))return prompt(state,eventId);
  const reference={eventId,mediaId:image.id,contentType:image.mime_type};
  return prompt({...next,[state.step==='FRONT'?'front':'selfie']:reference,step:state.step==='FRONT'?'SELFIE':'CONFIRM'},eventId);
 }
 if(state.step==='CONFIRM')return selected==='CONFIRM'?{state:{...next,step:'FINALIZING',confirmationEventId:eventId},deposit:true}:prompt(state,eventId);
 throw new WorkspaceError('META_KYC_CONVERSATION_REQUIRED',409);
}
