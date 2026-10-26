// Historical full module from Git commit 67a0aed1275dc41a3d27a6bdded4ad7e97641d0d.
// Path: src/lib/meta-kyc-conversation.mjs; source SHA-256: 2ba67025781ab2f6cd629ec3643060c4ab04b2b8fd7cd50ac87c6973c6d083f5.
// Only import relocation is applied; the new capture-quality notice is intentionally absent.
import {participantIdentityNoticeSummary} from '../../src/lib/participant-kyc-notice-links.mjs';
import {digest,WorkspaceError} from '../../src/lib/workspace-policy.mjs';
import {PARTICIPANT_NOTICE,PARTICIPANT_NOTICE_VERSION,PARTICIPANT_OCR_NOTICE,PARTICIPANT_OCR_NOTICE_VERSION,PARTICIPANT_BIOMETRIC_NOTICE,PARTICIPANT_BIOMETRIC_NOTICE_VERSION} from '../../src/lib/participant-policy.mjs';
import {PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE,PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE_VERSION,PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE_SHA256} from '../../src/lib/participant-policy.mjs';
import {participantOcrNotice,participantBiometricNotice,PARTICIPANT_AUTO_OCR_NOTICE_VERSION,PARTICIPANT_AUTO_BIOMETRIC_NOTICE_VERSION} from '../../src/lib/participant-analysis-consent.mjs';
import {SITE_ROLES,siteText} from '../../src/lib/site-register-policy.mjs';
import {participantIdentityUrl} from '../../src/lib/participant-kyc-chat-copy.mjs';

export const META_KYC_CONVERSATION_TTL_MS=30*60*1000;
export const EMPLOYEE_INTAKE_NOTICE_VERSION='employee-intake-v1';
export const EMPLOYEE_INTAKE_NOTICE='Tu nombre, oficio solicitado, correo y teléfono se guardarán en privado para que el responsable de esta empresa revise tu solicitud y pueda invitarte a una obra. La solicitud no concede acceso ni verifica tu identidad. No envíes documentos todavía.';
const intakeText=body=>({type:'text',body});
function intakePrompt(state,eventId){
 const descriptions={NAME:'Hola. Para solicitar ingreso a esta empresa, respondé a este mensaje con tu nombre y apellido. No envíes documentos.',EMAIL:'Respondé a este mensaje con el correo que vas a usar para aceptar la invitación. El correo se comprobará al ingresar a tu cuenta.',WAITING_RESPONSIBLE:'Tu solicitud está guardada y pendiente del responsable. Todavía no tenés acceso. La invitación, la identidad y los permisos se revisan por separado.',ADMITTED:'Tu ficha ya está registrada.\n\nAbrí '+participantIdentityUrl()+' y seguí el próximo paso de tu participación.\n\nSi te enviaron una invitación, aceptala desde tu correo.\n\nPara presentar identidad por este chat, pedile al responsable el mensaje IDENTIDAD vigente y esperá las indicaciones antes de enviar documentos.\n\nLa identidad y los permisos se revisan por separado.',REJECTED:'El responsable cerró esta solicitud. No se habilitó acceso.',CANCELLED:'Solicitud cancelada. No se creó una cuenta ni se habilitó acceso.'};
 if(['ADMITTED','JOB','CONFIRM'].includes(state.step)){
  const rows=state.step==='ADMITTED'?[['ACCOUNT','Abrir mi cuenta'],['IDENTITY_GUIDANCE','Consultar identidad']]:state.step==='JOB'?Object.entries(SITE_ROLES):[['CONFIRM','Enviar solicitud'],['CANCEL','Cancelar']];
  const nonce=digest(['employee-intake-choice-v1',eventId,state.step]).slice(0,20);
  return {state:{...state,nonce,choices:rows.map(([value,title])=>({value,title}))},reply:{type:'interactive',body:state.step==='ADMITTED'?'Tu ficha está registrada. Elegí una opción para continuar.':state.step==='JOB'?'Elegí el oficio o función que solicitás. Un responsable decidirá la participación; esto no concede permisos.':EMPLOYEE_INTAKE_NOTICE+'\nNombre: '+state.name+'\nOficio solicitado: '+SITE_ROLES[state.job]+'\nCorreo: '+state.email,button:'Elegir',sections:[{title:state.step==='ADMITTED'?'Tu participación':'Solicitud de ingreso',rows:rows.map(([,title],index)=>({id:'intake:'+nonce+':'+index,title:title.slice(0,24)}))}]}};
 }
 return {state,reply:intakeText(descriptions[state.step]||'Escribí ESTADO para consultar tu solicitud.')};
}
export function beginEmployeeIntakeConversation(eventId){return intakePrompt({version:1,step:'NAME',noticeVersion:EMPLOYEE_INTAKE_NOTICE_VERSION,noticeSha256:digest(EMPLOYEE_INTAKE_NOTICE),consent:false,name:null,job:null,email:null},eventId);}
export function planEmployeeIntakeConversation({message,state,eventId,promptConfirmed=false,draftTextConfirmed=false}){
 if(state?.version!==1||!['NAME','JOB','EMAIL','CONFIRM','WAITING_RESPONSIBLE','ADMITTED','REJECTED','CANCELLED'].includes(state.step))throw new WorkspaceError('EMPLOYEE_INTAKE_INTEGRITY',409);
 const body=message.type==='text'?message.text?.body?.trim():null;
 if(['WAITING_RESPONSIBLE','REJECTED','CANCELLED'].includes(state.step))return intakePrompt(state,eventId);
 if(state.step==='ADMITTED'){
  const selection=message.type==='interactive'?(message.interactive?.list_reply?.id||message.interactive?.button_reply?.id):null,match=/^intake:([a-f0-9]{20}):(\d{1,2})$/.exec(selection||'');
  if(!promptConfirmed||!match||match[1]!==state.nonce||!state.choices?.[Number(match[2])])return intakePrompt(state,eventId);
  const next={...state};delete next.nonce;delete next.choices;
  const selected=state.choices[Number(match[2])].value;
  if(selected==='ACCOUNT')return {state:next,reply:intakeText('Abrí tu cuenta e iniciá sesión:\nhttps://obrasaas.com/cuenta\n\nAllí podés consultar tus obras y accesos.')};
  if(selected==='IDENTITY_GUIDANCE')return {state:next,reply:intakeText('Consultá tu identidad y el paso pendiente:\n'+participantIdentityUrl()+'\n\nPara enviarla por este chat, pedile al responsable el mensaje IDENTIDAD vigente. Esperá las indicaciones antes de enviar documentos. Presentar identidad no habilita permisos.')};
  return intakePrompt(state,eventId);
 }
 if(body?.toUpperCase()==='CANCELAR')return intakePrompt({...state,step:'CANCELLED',consent:false},eventId);
 if(['HOLA','ESTADO','AYUDA'].includes(body?.toUpperCase())||!(promptConfirmed||draftTextConfirmed&&message.type==='text'&&['NAME','EMAIL'].includes(state.step)))return intakePrompt(state,eventId);
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
const hints={FRONT:'Enviá el frente completo del documento, con los datos legibles y sin reflejos.',BACK:'Enviá el dorso completo del documento, con los datos legibles y sin reflejos.',SELFIE:'Enviá una selfie con tu rostro solo, de frente y bien iluminado. La selfie es una foto estática y no comprueba prueba de vida.'};
function choices(state,eventId,body,rows){const nonce=digest(['meta-kyc-choice-v1',eventId,state.step]).slice(0,20);return {state:{...state,nonce,choices:rows.map(([value,title])=>({value,title}))},reply:{type:'interactive',body,button:'Elegir',sections:[{title:'Identidad',rows:rows.map(([,title],index)=>({id:'kyc:'+nonce+':'+index,title}))}]}};}
function prompt(state,eventId){
 if(state.step==='CONSENT')return choices(state,eventId,'Vamos a presentar tu identidad en '+(state.captureImageSetVersion===2?'3 pasos: frente, dorso y selfie.':'2 pasos: documento y selfie.')+' Antes de enviar fotos, elegí tus autorizaciones.\n\n'+PARTICIPANT_NOTICE+'\nEste recorrido sólo presenta imágenes; no habilita permisos. Podés cancelar antes de guardar.',[['CONSENT','Autorizar imágenes'],['CANCEL','Cancelar']]);
 if(state.step==='BACK_CONSENT')return choices(state,eventId,state.ocrNoticeVersion===PARTICIPANT_AUTO_OCR_NOTICE_VERSION?participantIdentityNoticeSummary(PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE_VERSION):PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE,[['BACK_CONSENT','Autorizar dorso'],['CANCEL','Cancelar']]);
 if(state.step==='OCR')return choices(state,eventId,participantIdentityNoticeSummary(state.ocrNoticeVersion)||participantOcrNotice(state.ocrNoticeVersion)?.text||PARTICIPANT_OCR_NOTICE,[['OCR_YES','Con lectura asistida'],['OCR_NO','Sin lectura asistida'],['CANCEL','Cancelar']]);
 if(state.step==='BIOMETRIC')return choices(state,eventId,participantIdentityNoticeSummary(state.biometricNoticeVersion)||participantBiometricNotice(state.biometricNoticeVersion)?.text||PARTICIPANT_BIOMETRIC_NOTICE,[['BIOMETRIC_YES','Con comparación facial'],['BIOMETRIC_NO','Sin comparación facial'],['CANCEL','Cancelar']]);
 if(state.step==='CONFIRM')return choices(state,eventId,'Las '+(state.captureImageSetVersion===2?'tres':'dos')+' imágenes están preparadas para presentar. Un responsable debe revisarlas. La lectura asistida '+(state.ocrConsent?'quedará autorizada.':'no está autorizada.')+' La comparación facial '+(state.biometricConsent?'quedará autorizada.':'no está autorizada.')+' La selfie es una imagen estática y no comprueba prueba de vida. ¿Querés guardarlas?',[['CONFIRM','Guardar identidad'],['CANCEL','Cancelar']]);
 const total=state.captureImageSetVersion===2?3:2,index=state.step==='FRONT'?1:state.step==='BACK'?2:total;
 return {state,reply:text('Paso '+index+' de '+total+' · '+(state.step==='FRONT'?'Frente del documento':state.step==='BACK'?'Dorso del documento':'Selfie')+'\n\n'+hints[state.step]+' Enviá una sola imagen de hasta 2 MB'+(state.captureImageSetVersion===2?' y esperá la indicación del próximo paso antes de enviar otra.':', usando Responder sobre este mensaje.')+'\n\n'+(state.step==='BACK'?'El frente ya está preparado. ':state.step==='SELFIE'?(state.captureImageSetVersion===2?'El frente y el dorso ya están preparados. ':'El documento ya está preparado. '):'')+'Escribí CANCELAR para terminar sin presentar.')};
}
export function beginMetaKycConversation(eventId,{captureImageSetVersion,analysisConsentVersion}={}){if(captureImageSetVersion!==undefined&&captureImageSetVersion!==2)throw new WorkspaceError('META_KYC_CONVERSATION_REQUIRED',409);return prompt({version:1,...(captureImageSetVersion===2?{captureImageSetVersion:2,backConsent:false,backNoticeVersion:PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE_VERSION,backNoticeSha256:PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE_SHA256,back:null}:{}),step:'CONSENT',noticeVersion:PARTICIPANT_NOTICE_VERSION,noticeSha256:digest(PARTICIPANT_NOTICE),ocrNoticeVersion:analysisConsentVersion===2?PARTICIPANT_AUTO_OCR_NOTICE_VERSION:PARTICIPANT_OCR_NOTICE_VERSION,ocrNoticeSha256:participantOcrNotice(analysisConsentVersion===2?PARTICIPANT_AUTO_OCR_NOTICE_VERSION:PARTICIPANT_OCR_NOTICE_VERSION).sha256,biometricNoticeVersion:analysisConsentVersion===2?PARTICIPANT_AUTO_BIOMETRIC_NOTICE_VERSION:PARTICIPANT_BIOMETRIC_NOTICE_VERSION,biometricNoticeSha256:participantBiometricNotice(analysisConsentVersion===2?PARTICIPANT_AUTO_BIOMETRIC_NOTICE_VERSION:PARTICIPANT_BIOMETRIC_NOTICE_VERSION).sha256,consent:false,ocrConsent:false,biometricConsent:false,front:null,selfie:null},eventId);}
export function planMetaKycConversation({message,state,eventId}){
 if(!state||state.version!==1||state.captureImageSetVersion!==undefined&&state.captureImageSetVersion!==2||state.captureImageSetVersion===2&&(state.backNoticeVersion!==PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE_VERSION||state.backNoticeSha256!==PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE_SHA256))throw new WorkspaceError('META_KYC_CONVERSATION_REQUIRED',409);
 if(!participantOcrNotice(state.ocrNoticeVersion)||state.ocrNoticeSha256!==participantOcrNotice(state.ocrNoticeVersion).sha256||!participantBiometricNotice(state.biometricNoticeVersion)||state.biometricNoticeSha256!==participantBiometricNotice(state.biometricNoticeVersion).sha256)throw new WorkspaceError('META_KYC_CONVERSATION_REQUIRED',409);
 if(state.step==='FINALIZING')return {state,preserveConversation:true,reply:text('La presentación confirmada está pendiente de comprobar. Conservamos el mismo intento; no vuelvas a enviar imágenes ni inicies otro código. La confirmación ya fue recibida y no se puede cancelar desde este mensaje.')};
 const body=message.type==='text'?message.text?.body?.trim().toUpperCase():null;
 if(body==='CANCELAR')return {state:null,cancelled:true,reply:text('Presentación cancelada. No se presentaron imágenes ni se habilitaron permisos. Pedí al responsable otro código si querés empezar de nuevo.')};
 if(body==='ESTADO'||body==='AYUDA')return prompt(state,eventId);
 if(message.type==='image'&&['CONSENT','BACK_CONSENT','OCR','BIOMETRIC'].includes(state.step)){
  const pending=prompt(state,eventId);return {...pending,reply:{...pending.reply,body:'Esta foto todavía no se guardó. Primero elegí una opción en este mensaje; después te pediremos cada imagen.\n\n'+pending.reply.body}};
 }
 const selection=message.type==='interactive'?(message.interactive?.list_reply?.id||message.interactive?.button_reply?.id):null;
 let selected=null;
 if(selection){const match=/^kyc:([a-f0-9]{20}):(\d{1,2})$/.exec(selection);if(!match||match[1]!==state.nonce||!state.choices?.[Number(match[2])])return prompt(state,eventId);selected=state.choices[Number(match[2])].value;}
 if(selected==='CANCEL')return {state:null,cancelled:true,reply:text('Presentación cancelada. No se presentaron imágenes ni se habilitaron permisos.')};
 const next={...state};delete next.nonce;delete next.choices;
 if(state.step==='CONSENT')return selected==='CONSENT'?prompt({...next,step:state.captureImageSetVersion===2?'BACK_CONSENT':'OCR',consent:true},eventId):prompt(state,eventId);
 if(state.step==='BACK_CONSENT')return selected==='BACK_CONSENT'?prompt({...next,step:'OCR',backConsent:true},eventId):prompt(state,eventId);
 if(state.step==='OCR')return ['OCR_YES','OCR_NO'].includes(selected)?prompt({...next,step:'BIOMETRIC',ocrConsent:selected==='OCR_YES'},eventId):prompt(state,eventId);
 if(state.step==='BIOMETRIC')return ['BIOMETRIC_YES','BIOMETRIC_NO'].includes(selected)?prompt({...next,step:'FRONT',biometricConsent:selected==='BIOMETRIC_YES'},eventId):prompt(state,eventId);
 if(['FRONT','BACK','SELFIE'].includes(state.step)){
  if(state.consent!==true||state.step==='BACK'&&(state.backConsent!==true||!state.front)||state.step==='SELFIE'&&(!state.front||state.captureImageSetVersion===2&&(state.backConsent!==true||!state.back)))throw new WorkspaceError('META_KYC_CONVERSATION_REQUIRED',409);
  const image=message.type==='image'?message.image:null;
  if(!/^\d{5,32}$/.test(image?.id||'')||!['image/jpeg','image/png','image/webp'].includes(image?.mime_type))return prompt(state,eventId);
  const reference={eventId,mediaId:image.id,contentType:image.mime_type};
  return prompt({...next,[state.step==='FRONT'?'front':state.step==='BACK'?'back':'selfie']:reference,step:state.step==='FRONT'?(state.captureImageSetVersion===2?'BACK':'SELFIE'):state.step==='BACK'?'SELFIE':'CONFIRM'},eventId);
 }
 if(state.step==='CONFIRM')return selected==='CONFIRM'&&state.consent===true&&state.front&&state.selfie&&(state.captureImageSetVersion!==2||state.backConsent===true&&state.back)?{state:{...next,step:'FINALIZING',confirmationEventId:eventId},deposit:true}:prompt(state,eventId);
 throw new WorkspaceError('META_KYC_CONVERSATION_REQUIRED',409);
}
