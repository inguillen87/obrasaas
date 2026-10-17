import {workspaceId} from './workspace-policy.mjs';

export const PARTICIPANT_IDENTITY_PATH='/cuenta?seccion=identidad#participant-title';
export function participantIdentityUrl(projectId){
 const url=new URL(PARTICIPANT_IDENTITY_PATH,'https://obrasaas.com');
 if(workspaceId(projectId))url.searchParams.set('obra',projectId);
 return url.toString();
}
export const KYC_GUIDED_STEPS=Object.freeze(['CONSENT','BACK_CONSENT','OCR','BIOMETRIC','FRONT','BACK','SELFIE','CONFIRM']);
const actions=Object.freeze({CONSENT:'Primero elegí «Autorizar imágenes» o «Cancelar» en el último mensaje de identidad.',BACK_CONSENT:'Primero elegí «Autorizar dorso» o «Cancelar» en el último mensaje de identidad.',OCR:'Primero elegí «Con lectura asistida» o «Sin lectura asistida» en el último mensaje de identidad.',BIOMETRIC:'Primero elegí «Con comparación facial» o «Sin comparación facial» en el último mensaje de identidad.',FRONT:'Paso 1 de 3: enviá el frente del documento, completo y legible.',BACK:'Paso 2 de 3: enviá el dorso del documento, completo y legible.',SELFIE:'Paso 3 de 3: enviá una selfie con tu rostro solo, de frente y bien iluminado.',CONFIRM:'Las tres imágenes están preparadas. Elegí «Guardar identidad» o «Cancelar» en el último mensaje de identidad.'});
// Fixed, versioned copy for newly recorded reminders. Historical feedback keeps
// its original bytes and digest in meta-kyc-context-feedback.
export function participantKycStepReminder(step,projectId){
 if(!KYC_GUIDED_STEPS.includes(step)||!workspaceId(projectId))return null;
 return {type:'text',body:'Esta foto todavía no se guardó. '+actions[step]+'\n\nPara continuar en este chat, buscá el mensaje anterior que '+(['FRONT','BACK','SELFIE'].includes(step)?'te pidió esa foto':'tiene el botón «Elegir»')+' y tocá Responder sobre ese mensaje. '+(['FRONT','BACK','SELFIE'].includes(step)?'Después reenviá la foto que corresponde a ese paso.':'Usá sus opciones antes de enviar otra foto.')+'\n\nTambién podés ver el paso pendiente en '+participantIdentityUrl(projectId)+'.'};
}

// Classification only. The canonical signed resolver must still prove the
// current person, channel, claim, prompt, consent state and original deadlines.
export function participantKycNeutralStepCommand(message){
 return message?.type==='text'&&!Object.hasOwn(message,'context')&&typeof message.text?.body==='string'&&['HOLA','ESTADO','MENU','MENÚ'].includes(message.text.body.trim().toUpperCase());
}
export function participantKycStepGuidance(step,projectId){
 if(!KYC_GUIDED_STEPS.includes(step)||!workspaceId(projectId))return null;
 const photo=['FRONT','BACK','SELFIE'].includes(step),original=photo?'mensaje original de identidad que te pidió la foto':'mensaje original de identidad que tiene el botón «Elegir»';
 const continuation=photo?'Enviá una sola imagen y esperá la indicación del próximo paso.':'Usá las opciones del '+original+' para continuar.';
 return {type:'text',body:'Tu intento de identidad sigue vigente. '+actions[step].replace('último mensaje de identidad',original)+'\n\n'+continuation+' Para terminar sin presentar, respondé con CANCELAR al '+original+'.\n\nTambién podés consultar el paso pendiente en '+participantIdentityUrl(projectId)+'.'};
}

// Integration catalogue only: base58 validators continue accepting their exact
// historical notices. New notices must be selected and hashed at issuance when
// merging the version-aware consent protocol; never reinterpret a v1 receipt.
export const PARTICIPANT_KYC_CHAT_NOTICE_CATALOGUE=Object.freeze({
 version:'participant-kyc-guided-notices-v3',privacyUrl:'https://obrasaas.com/privacidad',
 capture:Object.freeze({version:'participant-capture-guided-v3',summary:'Autorizás guardar en privado el frente, el dorso y una selfie para presentar tu identidad. Podés cancelar antes de guardar. Consultá el tratamiento de los datos en https://obrasaas.com/privacidad. Esta presentación no concede acceso ni permisos.'}),
 ocr:Object.freeze({version:'participant-ocr-guided-v3',summary:'La lectura de datos del documento es opcional. Si la autorizás, al completar la presentación ObraSaaS iniciará el análisis mediante un servicio externo. El resultado es orientativo y no certifica identidad. Consultá el proveedor, las transferencias y el tratamiento en https://obrasaas.com/privacidad.'}),
 biometric:Object.freeze({version:'participant-facial-guided-v3',summary:'La comparación del rostro es opcional. Si la autorizás, al completar la presentación ObraSaaS iniciará la comparación privada entre el frente y la selfie. Es orientativa y no prueba vida ni certifica identidad. Consultá el tratamiento en https://obrasaas.com/privacidad.'}),
});
