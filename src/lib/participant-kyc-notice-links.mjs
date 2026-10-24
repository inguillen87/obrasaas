import {participantOcrNotice,participantBiometricNotice,PARTICIPANT_AUTO_OCR_NOTICE_VERSION,PARTICIPANT_AUTO_BIOMETRIC_NOTICE_VERSION,PARTICIPANT_PRECOMMIT_BIOMETRIC_NOTICE_VERSION} from './participant-analysis-consent.mjs';
import {PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE_VERSION,PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE,PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE_SHA256} from './participant-kyc-image-set.mjs';

export const PARTICIPANT_IDENTITY_NOTICES_PATH='/privacidad/identidad';
const origin='https://obrasaas.com';
const notices=new Map([
 [PARTICIPANT_AUTO_OCR_NOTICE_VERSION,Object.freeze({...participantOcrNotice(PARTICIPANT_AUTO_OCR_NOTICE_VERSION),title:'Lectura asistida del documento',choice:'Con lectura asistida',alternative:'Sin lectura asistida',scope:'La lectura del frente es opcional e independiente de la comparación facial.'})],
 [PARTICIPANT_AUTO_BIOMETRIC_NOTICE_VERSION,Object.freeze({...participantBiometricNotice(PARTICIPANT_AUTO_BIOMETRIC_NOTICE_VERSION),title:'Comparación facial privada',choice:'Con comparación facial',alternative:'Sin comparación facial',scope:'La comparación privada del frente y tu selfie es opcional e independiente de la lectura del documento.'})],
 [PARTICIPANT_PRECOMMIT_BIOMETRIC_NOTICE_VERSION,Object.freeze({...participantBiometricNotice(PARTICIPANT_PRECOMMIT_BIOMETRIC_NOTICE_VERSION),title:'Comparación facial antes de guardar',choice:'Comparar antes de guardar',alternative:'Revisión manual',scope:'La comparación del frente y tu selfie antes de guardar es opcional e independiente de la lectura del documento.'})],
 [PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE_VERSION,Object.freeze({version:PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE_VERSION,text:PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE,sha256:PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE_SHA256,automatic:false,title:'Dorso del documento por WhatsApp'})],
]);
export const PARTICIPANT_IDENTITY_NOTICE_VERSIONS=Object.freeze([...notices.keys()]);
// Only these immutable public notices may be selected, never a caller URL,
// arbitrary version, historical consent replacement or organization resource.
export const participantIdentityNotice=version=>notices.get(version)||null;
export function participantIdentityNoticeUrl(version){
 if(!notices.has(version))return null;
 const url=new URL(PARTICIPANT_IDENTITY_NOTICES_PATH,origin);url.searchParams.set('aviso',version);return url.toString();
}
export function participantIdentityNoticeSummary(version){
 const n=participantIdentityNotice(version);if(!n)return null;
 if(version===PARTICIPANT_PRECOMMIT_BIOMETRIC_NOTICE_VERSION)return n.scope+' Antes de elegir, leé el aviso completo: '+participantIdentityNoticeUrl(version)+'\n\nAl elegir «'+n.choice+'» autorizás procesar las dos fotografías antes de guardarlas. Podés elegir «'+n.alternative+'» sin autorizar la comparación.\n\nEl resultado requiere revisión humana, no certifica identidad ni prueba de vida y no concede permisos. Si queda sin confirmar, consultaremos el mismo intento antes de continuar.';
 if(version===PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE_VERSION)return 'Para presentar tu identidad por WhatsApp pedimos frente, dorso y selfie. El dorso se guarda en privado para revisión en esta obra; no se utiliza en la lectura asistida ni en la comparación facial. Antes de elegir, leé el aviso completo: '+participantIdentityNoticeUrl(version)+'\n\nAl elegir «Autorizar dorso» confirmás que leíste el aviso y autorizás guardarlo con las otras imágenes. Esto no certifica identidad ni prueba de vida y no concede acceso. Podés cancelar o usar la presentación web sin dorso.';
 return n.scope+' Antes de elegir, leé el aviso completo: '+participantIdentityNoticeUrl(version)+'\n\nAl elegir «'+n.choice+'» confirmás que leíste el aviso y autorizás el inicio automático al completar esta presentación. Podés elegir «'+n.alternative+'» y continuar con revisión manual.\n\nEl resultado es orientativo: no certifica identidad ni prueba de vida y no concede permisos. Si el servicio no está disponible, queda pendiente.';
}
export function participantIdentityNoticeSelection(searchParams){
 if(!searchParams||typeof searchParams!=='object'||Array.isArray(searchParams)||![Object.prototype,null].includes(Object.getPrototypeOf(searchParams)))return {status:'INVALID',notice:null};
 const keys=Reflect.ownKeys(searchParams);if(!keys.length)return {status:'INDEX',notice:null};
 if(keys.length!==1||keys[0]!=='aviso')return {status:'INVALID',notice:null};
 const descriptor=Object.getOwnPropertyDescriptor(searchParams,'aviso');
 if(!descriptor||!Object.hasOwn(descriptor,'value')||typeof descriptor.value!=='string')return {status:'INVALID',notice:null};
 const notice=participantIdentityNotice(descriptor.value);return notice?{status:'NOTICE',notice}:{status:'INVALID',notice:null};
}
