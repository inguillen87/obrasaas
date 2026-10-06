import {digest,WorkspaceError} from './workspace-policy.mjs';
import {PARTICIPANT_NOTICE,PARTICIPANT_NOTICE_VERSION,PARTICIPANT_OCR_NOTICE,PARTICIPANT_OCR_NOTICE_VERSION,PARTICIPANT_BIOMETRIC_NOTICE,PARTICIPANT_BIOMETRIC_NOTICE_VERSION} from './participant-policy.mjs';

export const META_KYC_CONVERSATION_TTL_MS=30*60*1000;
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
