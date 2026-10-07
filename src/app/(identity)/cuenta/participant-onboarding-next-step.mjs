export function participantKycHistoricalReceipt(value,command){
 const r=value?.kycSubmissionReceipt;
 return Boolean(r&&typeof r==='object'&&!Array.isArray(r)&&Object.keys(r).sort().join('|')==='documentBackConsentRecorded|documentBackNoticeSha256|documentBackNoticeVersion|identityCertified|permissionsGranted|receiptId|submissionId|superseded|whatsAppAccessGranted'&&r.receiptId===value.receiptId&&typeof r.submissionId==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(r.submissionId)&&r.submissionId!==value.participant?.kyc?.submissionId&&r.superseded===true&&r.documentBackConsentRecorded===true&&r.documentBackNoticeVersion===command.backNoticeVersion&&r.documentBackNoticeSha256===command.backNoticeSha256&&r.identityCertified===false&&r.permissionsGranted===false&&r.whatsAppAccessGranted===false);
}
// Presentation only: permission and private evidence are rechecked by the store.
export function participantDocumentBackNotice(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join('|')!=='sha256|text|version'||value.version!=='participant-kyc-document-back-v1'||!/^[a-f0-9]{64}$/.test(value.sha256||'')||typeof value.text!=='string'||!value.text.trim()||value.text.length>6000)return null;
 return {version:value.version,sha256:value.sha256,text:value.text};
}
export function participantKycReviewImages(k){
 if(!Array.isArray(k?.images))return false;
 const back=k.documentBackConsent!==undefined||k.images.some(image=>image?.id==='document-back'||image?.kind==='DOCUMENT_BACK')||k.images.length===3;
 if(!back)return k.images.length===2;
 const c=k.documentBackConsent;
 return k.images.length===3&&c?.allowed===true&&c.noticeVersion==='participant-kyc-document-back-v1'&&/^[a-f0-9]{64}$/.test(c.noticeSha256||'')&&[['document-front','DOCUMENT_FRONT'],['selfie','SELFIE'],['document-back','DOCUMENT_BACK']].every(([id,kind])=>k.images.filter(image=>image?.id===id&&image.kind===kind).length===1)&&k.images.every(image=>Number.isSafeInteger(image.bytes)&&image.bytes>0&&image.bytes<=2*1024*1024&&['image/png','image/jpeg','image/webp'].includes(image.contentType));
}

// Presentation only. Existing server commands must revalidate authority.
// Callers supply the current verified scope and clock; this module does no IO.
const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const scope=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const scoped=(value,context)=>value?.scope===context.scope&&value?.projectId===context.projectId;
export function participantOnboardingNavigationTarget(value,context){
 if(!context||!scope(context.scope)||!id(context.projectId)||!scoped(value,context))return null;
 if(value.target==='worker-channel')return 'worker-channel-title';
 if(value.target==='meta-onboarding'&&context.canManageIntegrations===true)return 'customer-meta-title';
 return value.target==='pending-receipts'?'pending-receipts-title':null;
}
const step=(state,action,label,optionalBank=null,requestedJob=null)=>({
 state,primary:action?{action,label}:null,optionalBank,requestedJob,
});

const chatKeys=['id','status','expiresAt','conversationExpiresAt','expired','canPrepare','canCancel','blockedCode'];
const chatOptionalKeys=['step','recoveryRequired','claimedAt','closedAt'];
const chatStatuses=['PENDING','CLAIMED','COMPLETED','CANCELLED','CLOSED'];
const chatSteps=['CONSENT','OCR','BIOMETRIC','FRONT','SELFIE','CONFIRM','FINALIZING'];
const chatDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
// The DB projection decides capabilities. Expiry and historical status never
// create permission or allow a pending challenge to be overwritten.
export function participantKycChatCapabilities(row,canManage,now){
 const unknown={observed:false,canPrepare:false,canCancel:false,challenge:null};
 if(!row||typeof canManage!=='boolean'||!Number.isFinite(now)||now<0)return unknown;
 const eligible=canManage&&row.active===true&&['INVITED','ACTIVE'].includes(row.status)&&['NOT_SUBMITTED','REJECTED'].includes(row.kyc?.status);
 const cancellable=canManage&&row.active===true&&['INVITED','ACTIVE','REVOKED'].includes(row.status)&&['NOT_SUBMITTED','REJECTED'].includes(row.kyc?.status);
 const value=row.kycChatChallenge;
 if(value===null)return {observed:true,canPrepare:eligible,canCancel:false,challenge:null};
 if(!value||typeof value!=='object'||Array.isArray(value)||chatKeys.some(key=>!Object.hasOwn(value,key))||Object.keys(value).some(key=>!chatKeys.includes(key)&&!chatOptionalKeys.includes(key))||
    !id(value.id)||!chatStatuses.includes(value.status)||!chatDate(value.expiresAt)||
    value.conversationExpiresAt!==null&&!chatDate(value.conversationExpiresAt)||
    typeof value.expired!=='boolean'||typeof value.canPrepare!=='boolean'||typeof value.canCancel!=='boolean'||
    value.blockedCode!==null&&(typeof value.blockedCode!=='string'||! /^[A-Z][A-Z0-9_]{0,99}$/.test(value.blockedCode))||
    Object.hasOwn(value,'step')&&value.step!==null&&!chatSteps.includes(value.step)||
    Object.hasOwn(value,'recoveryRequired')&&typeof value.recoveryRequired!=='boolean'||
    ['claimedAt','closedAt'].some(key=>Object.hasOwn(value,key)&&value[key]!==null&&!chatDate(value[key])))return unknown;
 const pending=['PENDING','CLAIMED'].includes(value.status);
 if(value.status==='CLAIMED'&&value.conversationExpiresAt===null||value.status==='PENDING'&&value.conversationExpiresAt!==null||
    value.canPrepare&&value.canCancel||value.canPrepare&&pending||
    value.canCancel&&(!pending||value.step==='FINALIZING'||value.recoveryRequired===true)||value.status==='COMPLETED'&&(value.canPrepare||value.canCancel))return unknown;
 return {observed:true,canPrepare:eligible&&value.canPrepare,canCancel:cancellable&&value.canCancel,challenge:{...value}};
}

const consult=()=>step('CONTEXT_UNVERIFIED','CONSULT_ACCESS','Comprobar mi acceso');
const bank=()=>({action:'CONSULT_PRIVATE_BANK',label:'Mi cuenta privada'});
const selected=(records,key,value)=>{
 const matches=records.filter(row=>row?.[key]===value);
 return matches.length===1?matches[0]:null;
};

/**
 * snapshot is the canonical participants GET; channelSnapshot is its separate
 * own-worker channel GET. Absence means unobserved, never an operational grant.
 * The separate Clerk invitation screen remains responsible for acceptance;
 * its INVITED DTO has no project ID and must not be treated as this snapshot.
 */
export function participantOnboardingNextStep({context,snapshot,workerId=null,applicationId=null,channelSnapshot=null,pendingReference=null}={}){
 if(context?.verified!==true||!scope(context.scope)||!id(context.projectId)||!Number.isFinite(context.now)||context.now<0||
    !scoped(snapshot,context)||!Array.isArray(snapshot.records)||typeof snapshot.canManage!=='boolean'||typeof snapshot.canInvite!=='boolean'||snapshot.canInvite&&!snapshot.canManage)return consult();
 if(pendingReference!==null){
  if(!scoped(pendingReference,context)||!uuid(pendingReference.operationId)||!['participants','worker-channel'].includes(pendingReference.resource))return consult();
  return step('OPERATION_UNCERTAIN','CONSULT_OPERATION','Comprobar el mismo intento');
 }
 let requestedJob=null;
 if(applicationId!==null){
  if(!id(applicationId)||snapshot.canInvite!==true||!Array.isArray(snapshot.employeeIntake?.records))return consult();
  const application=selected(snapshot.employeeIntake.records,'id',applicationId);
  if(!application)return step('APPLICATION_UNOBSERVED','CONSULT_PARTICIPANTS','Consultar solicitudes');
  if(typeof application.jobLabel==='string'&&application.jobLabel.trim().length>0&&application.jobLabel.length<=100){
   requestedJob={kind:'REQUESTED',label:application.jobLabel};
  }
  if(application.status==='WAITING_RESPONSIBLE'){
   return snapshot.employeeIntake.available===true&&snapshot.employeeIntake.enabled===true
    ?step('ADMISSION_REVIEW','REVIEW_INTAKE','Revisar incorporación',null,requestedJob)
    :step('INTAKE_UNAVAILABLE','CONSULT_PARTICIPANTS','Consultar solicitudes',null,requestedJob);
  }
  if(application.status!=='ADMITTED')return step('APPLICATION_UNOBSERVED','CONSULT_PARTICIPANTS','Consultar solicitudes',null,requestedJob);
  if(application.destinationProjectId!==context.projectId||!id(application.workerId)||workerId!==null&&workerId!==application.workerId)return consult();
  workerId=application.workerId;
 }
 if(!id(workerId))return step('PARTICIPANT_UNOBSERVED','CONSULT_PARTICIPANTS','Consultar participantes',null,requestedJob);
 const row=selected(snapshot.records,'id',workerId);
 if(!row||typeof row.self!=='boolean'||typeof row.active!=='boolean')return step('PARTICIPANT_UNOBSERVED','CONSULT_PARTICIPANTS','Consultar participantes',null,requestedJob);
 const next=(state,action,label,optionalBank=null)=>step(state,action,label,optionalBank,requestedJob);
  const chatNext=()=>{
   const current=participantKycChatCapabilities(row,snapshot.canManage,context.now);
   if(!current.observed)return next('KYC_CHAT_UNOBSERVED','CONSULT_PARTICIPANTS','Consultar presentación por chat');
   if(current.canCancel)return next('KYC_CHAT_CANCELLATION','CANCEL_KYC_CHAT','Revisar cierre de presentación');
   const delivery=participantOnboardingDeliveryView({context,snapshot,workerId:row.id});
   if(delivery.canSend)return next('ONBOARDING_WHATSAPP_PREPARATION','SEND_ONBOARDING_WHATSAPP','Enviar instrucciones por WhatsApp');
   if(!['PENDING','CLAIMED'].includes(current.challenge?.status)&&delivery.observed&&delivery.contactAuthorized===true&&['WAITING_CONFIGURATION','PENDING','BLOCKED'].includes(delivery.state))return delivery.blocker==='TEMPLATE_APPROVAL_REQUIRED'
    ?next('ONBOARDING_TEMPLATE_REVIEW','REVIEW_ONBOARDING_TEMPLATE','Revisar plantilla de alta')
    :next('ONBOARDING_WHATSAPP_PENDING','CONSULT_PARTICIPANTS','Consultar envío por WhatsApp');
   if(current.canPrepare)return next('KYC_CHAT_PREPARATION','PREPARE_KYC_CHAT','Preparar identidad por chat');
   return next(current.challenge?.status==='CLAIMED'?'KYC_CHAT_IN_PROGRESS':'KYC_CHAT_PENDING','CONSULT_PARTICIPANTS','Consultar presentación por chat');
  };
 if(!row.self&&!snapshot.canManage)return next('OTHER_PERSON',null,null);
 if(!row.active)return next('PARTICIPATION_UNAVAILABLE','CONSULT_PARTICIPANTS','Consultar participación');
 if(!row.self&&snapshot.canManage&&['INVITED','REVOKED'].includes(row.status)){const chat=participantKycChatCapabilities(row,snapshot.canManage,context.now);if(!chat.observed||['PENDING','CLAIMED'].includes(chat.challenge?.status))return chatNext();}
 if(row.status==='REVOKED')return snapshot.canManage&&row.accountLinked===true
  ?next('RESTORE_REVIEW','RESTORE_ACCESS','Revisar reactivación')
  :snapshot.canInvite&&row.accountLinked===false
   ?next('INVITATION_REVIEW','INVITE','Preparar invitación')
   :next('PARTICIPATION_REVOKED','CONSULT_PARTICIPANTS','Consultar participación');
 if(row.status==='NOT_INVITED')return snapshot.canInvite
  ?next('INVITATION_REVIEW','INVITE','Preparar invitación')
  :next('WAIT_ADMIN','CONSULT_PARTICIPANTS','Consultar participación');
 if(row.status==='INVITED'){
  if(row.invitation?.state==='ATTEMPTED')return snapshot.canManage
   ?next('INVITATION_UNCERTAIN','RECOVER_INVITATION','Comprobar invitación')
   :next('WAIT_ACCOUNT','CONSULT_PARTICIPANTS','Consultar aceptación');
  if(row.invitation?.state!=='SENT'||!Number.isFinite(Date.parse(row.invitation.expiresAt)))return next('INVITATION_UNOBSERVED','CONSULT_PARTICIPANTS','Consultar invitación');
  if(row.invitation.expired===true||Date.parse(row.invitation.expiresAt)<=context.now)return snapshot.canInvite
   ?next('INVITATION_EXPIRED','INVITE','Revisar invitación vencida')
   :next('WAIT_ADMIN','CONSULT_PARTICIPANTS','Consultar invitación');
  if(snapshot.canManage&&['NOT_SUBMITTED','REJECTED'].includes(row.kyc?.status))return chatNext();
  return next('WAIT_ACCOUNT','CONSULT_PARTICIPANTS','Consultar aceptación');
 }
 if(row.status!=='ACTIVE'||row.accountLinked!==true)return next('PARTICIPATION_UNOBSERVED','CONSULT_PARTICIPANTS','Consultar participación');
 if(['NOT_SUBMITTED','REJECTED'].includes(row.kyc?.status))return row.self
  ?next('OWN_IDENTITY','SUBMIT_KYC','Presentar mi identidad')
  :chatNext();
 if(row.kyc?.status==='PENDING_ACCOUNT_CLAIM')return next('WAIT_ACCOUNT','CONSULT_PARTICIPANTS','Consultar aceptación');
 if(row.kyc?.status==='PENDING_REVIEW')return !row.self&&snapshot.canManage&&participantKycReviewImages(row.kyc)
  ?next('IDENTITY_REVIEW','REVIEW_KYC','Revisar identidad')
  :next('WAIT_REVIEW','CONSULT_PARTICIPANTS','Consultar revisión');
 if(row.kyc?.status!=='APPROVED')return next('IDENTITY_UNOBSERVED','CONSULT_PARTICIPANTS','Consultar identidad');
 if(!row.self&&row.canManageFieldPermissions===true&&row.permissions?.attendance===false&&row.permissions?.report===false)return next('FIELD_PERMISSIONS_REVIEW','SET_FIELD_PERMISSIONS','Revisar permisos de campo');
 if(!row.self)return next('WAIT_OWN_CHANNEL','CONSULT_PARTICIPANTS','Consultar participación');
 // Bank eligibility uses only own approved participation. Binding, field
 // permissions and declaration state are not bank prerequisites or inputs.
 const optionalBank=bank();
 if(typeof row.permissions?.attendance!=='boolean'||typeof row.permissions?.report!=='boolean')return next('PERMISSIONS_UNOBSERVED','CONSULT_PARTICIPANTS','Consultar permisos',optionalBank);
 if(!row.permissions.attendance&&!row.permissions.report)return next('WAIT_PERMISSIONS','CONSULT_PARTICIPANTS','Consultar permisos',optionalBank);
 if(channelSnapshot===null)return next('CHANNEL_UNOBSERVED','CONSULT_CHANNEL','Consultar mi vínculo',optionalBank);
 if(!scoped(channelSnapshot,context)||!Array.isArray(channelSnapshot.records)||typeof channelSnapshot.channelReady!=='boolean')return consult();
 const channel=selected(channelSnapshot.records,'workerId',workerId);
 if(!channel||typeof channel.eligible!=='boolean')return next('CHANNEL_UNOBSERVED','CONSULT_CHANNEL','Consultar mi vínculo',optionalBank);
 if(channelSnapshot.channelReady!==true)return next('CHANNEL_UNAVAILABLE','CONSULT_CHANNEL','Consultar mi vínculo',optionalBank);
 if(channel.eligible!==true||channel.state==='REVIEW_REQUIRED')return next('CHANNEL_REVIEW','CONSULT_CHANNEL','Comprobar mi vínculo',optionalBank);
 if(channel.state==='VERIFIED'){
  if(!id(channel.binding?.id)||!Number.isFinite(Date.parse(channel.binding.verifiedAt))||channel.binding.revokedAt!==null)return next('CHANNEL_REVIEW','CONSULT_CHANNEL','Comprobar mi vínculo',optionalBank);
  return next('CHANNEL_VERIFIED','OPEN_WHATSAPP','Continuar en WhatsApp',optionalBank);
 }
 if(!['NOT_LINKED','UNLINKED'].includes(channel.state))return next('CHANNEL_UNOBSERVED','CONSULT_CHANNEL','Consultar mi vínculo',optionalBank);
 if(channel.challenge!==null&&channel.challenge!==undefined){
  if(!Number.isFinite(Date.parse(channel.challenge.expiresAt))||typeof channel.challenge.expired!=='boolean')return next('CHANNEL_REVIEW','CONSULT_CHANNEL','Comprobar mi vínculo',optionalBank);
  if(channel.challenge.expired===false&&Date.parse(channel.challenge.expiresAt)>context.now)return next('BINDING_PENDING','CONSULT_CHANNEL','Comprobar mi vínculo',optionalBank);
 }
 return next('BINDING_PREPARATION','REQUEST_CHALLENGE','Preparar mi vínculo',optionalBank);
}

// Scoped delivery presentation extends the existing canonical onboarding view.
export const {participantOnboardingContactNotice,participantOnboardingWhatsAppConsent,participantOnboardingDeliveryView}=(()=>{


// Presentation only. Capabilities come from a fresh, scoped server projection;
// neither delivery status nor a notice grants authority to send a message.
const object=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const states=['WAITING_CONFIGURATION','PENDING','BLOCKED','SEND_STARTED','SEND_UNKNOWN','SENT','REJECTED','STATUS_OBSERVED','CANCELED'];
const statusValues=['sent','delivered','read','failed','deleted'];
const deliveryKeys=['state','contactAuthorized','outboundId','code','providerAccepted','deliveryConfirmed','providerStatus','automaticResendAllowed'];
const copies={
 NOT_REQUESTED:['Sin envío solicitado','Podés solicitar las instrucciones con la autorización de contacto correspondiente.'],
 WAITING_CONFIGURATION:['Esperando configuración','La solicitud está guardada. Falta comprobar el canal y la plantilla de WhatsApp antes de enviarla.'],
 PENDING:['Pendiente de envío','La solicitud está preparada. Consultá su estado; todavía no hay aceptación del proveedor ni entrega confirmada.'],
 BLOCKED:['Envío bloqueado','El estado vigente no permite enviar las instrucciones. Consultá el canal, la autorización y la participación antes de continuar.'],
 SEND_STARTED:['Envío iniciado','Se está comprobando el resultado con WhatsApp. Consultá el estado del mismo intento; no solicites otro envío.'],
 SEND_UNKNOWN:['Resultado sin confirmar','No se pudo confirmar si WhatsApp aceptó el mensaje. Conservá el intento y consultá su estado; no lo vuelvas a enviar.'],
 SENT:['Aceptado por WhatsApp','WhatsApp aceptó el mensaje. Esto todavía no confirma la entrega, la aceptación de la invitación ni la identidad de la persona.'],
 REJECTED:['Envío rechazado','El proveedor rechazó la solicitud. Revisá el motivo y la configuración; no se reenvía automáticamente.'],
 STATUS_OBSERVED:['Estado informado por WhatsApp','El proveedor informó un estado del mensaje. La aceptación de la cuenta y la revisión de identidad se comprueban por separado.'],
 CANCELED:['Envío cancelado','Esta solicitud no continuará enviándose. La invitación de acceso y la revisión de identidad conservan sus propios estados.'],
};
const unknown=()=>({observed:false,state:'UNKNOWN',blocker:null,label:'Estado de WhatsApp sin consultar',description:'Consultá el perfil vigente para comprobar el envío y tus permisos.',canSend:false,canRevoke:false,contactAuthorized:null,providerAccepted:false,deliveryConfirmed:false,automaticResendAllowed:false,revokeWarning:null});

function participantOnboardingContactNotice(value){
 if(!object(value)||Object.keys(value).sort().join('|')!=='sha256|text|version'||typeof value.version!=='string'||!/^[a-z0-9][a-z0-9.-]{0,63}$/.test(value.version)||!hash(value.sha256)||typeof value.text!=='string'||!value.text.trim()||value.text.length>6000)return null;
 return {version:value.version,sha256:value.sha256,text:value.text};
}

const sameNotice=(a,b)=>a?.version===b?.version&&a?.sha256===b?.sha256&&a?.text===b?.text;
// confirmed=false intentionally adds no optional consent to an INVITE payload.
function participantOnboardingWhatsAppConsent(notice,confirmed,reviewedNotice=notice){
 if(confirmed!==true)return null;
 const current=participantOnboardingContactNotice(notice),reviewed=participantOnboardingContactNotice(reviewedNotice);
 if(!current||!reviewed||!sameNotice(current,reviewed))throw Object.assign(new Error('El aviso de contacto cambió. Leelo nuevamente y confirmá la autorización antes de enviar.'),{code:'PARTICIPANT_ONBOARDING_CONSENT_REQUIRED',requestDispatched:false});
 return {confirmed:true,noticeVersion:current.version,noticeSha256:current.sha256};
}

function validDelivery(value){
 if(!object(value)||Object.keys(value).sort().join('|')!==[...deliveryKeys].sort().join('|')||!states.includes(value.state)||typeof value.contactAuthorized!=='boolean'||typeof value.providerAccepted!=='boolean'||typeof value.deliveryConfirmed!=='boolean'||value.automaticResendAllowed!==false||value.outboundId!==null&&(typeof value.outboundId!=='string'||!/^customer_outbound_[a-f0-9]{64}$/.test(value.outboundId))||value.code!==null&&(typeof value.code!=='string'||!/^PARTICIPANT_ONBOARDING_[A-Z_]{2,70}$/.test(value.code))||value.providerStatus!==null&&!statusValues.includes(value.providerStatus))return false;
 const accepted=['SENT','STATUS_OBSERVED'].includes(value.state)&&!['failed','deleted'].includes(value.providerStatus);
 if(value.providerAccepted!==accepted||value.deliveryConfirmed!==(value.state==='STATUS_OBSERVED'&&['delivered','read'].includes(value.providerStatus)))return false;
 if(value.state==='STATUS_OBSERVED'&&value.providerStatus===null||value.state!=='STATUS_OBSERVED'&&['delivered','read','failed','deleted'].includes(value.providerStatus))return false;
 return true;
}

function participantOnboardingDeliveryView({context,snapshot,workerId}={}){
 if(!context||context.verified!==true||!hash(context.scope)||!id(context.projectId)||!Number.isFinite(context.now)||context.now<0||snapshot?.scope!==context.scope||snapshot?.projectId!==context.projectId||typeof snapshot.canManage!=='boolean'||!Array.isArray(snapshot.records)||!id(workerId))return unknown();
 const matches=snapshot.records.filter(row=>row?.id===workerId);if(matches.length!==1)return unknown();
 const row=matches[0],delivery=row.onboardingDelivery;
 const explicitCapability=typeof row.canSendOnboardingWhatsapp==='boolean'&&typeof row.canRevokeOnboardingContact==='boolean';
 // A legacy row with no capabilities is unobserved. The current server may
 // explicitly allow the first request while there is no delivery intent yet.
 if(delivery===undefined||delivery===null){if(!explicitCapability||row.canSendOnboardingWhatsapp!==true)return unknown();}
 else if(!validDelivery(delivery))return unknown();
 const state=delivery?.state||'NOT_REQUESTED',copy=copies[state];
  const blocker=state==='BLOCKED'&&delivery.code==='PARTICIPANT_ONBOARDING_TEMPLATE_APPROVAL_REQUIRED'?'TEMPLATE_APPROVAL_REQUIRED':null;
 const chat=participantKycChatCapabilities(row,snapshot.canManage,context.now);
 const validInvitation=row.status==='ACTIVE'&&row.invitation?.state==='ACCEPTED'||row.status==='INVITED'&&row.invitation?.state==='SENT'&&row.invitation.expired!==true&&Number.isFinite(Date.parse(row.invitation.expiresAt))&&Date.parse(row.invitation.expiresAt)>context.now;
 const currentPerson=row.active===true&&['INVITED','ACTIVE'].includes(row.status)&&typeof row.revision==='string'&&row.revision.length>0&&row.revision.length<=128;
 const send=snapshot.canManage===true&&row.canSendOnboardingWhatsapp===true&&currentPerson&&validInvitation&&['NOT_SUBMITTED','REJECTED'].includes(row.kyc?.status)&&chat.observed&&!['PENDING','CLAIMED'].includes(chat.challenge?.status)&&participantOnboardingContactNotice(snapshot.onboardingContactNotice)!==null&&['NOT_REQUESTED','CANCELED','REJECTED','SENT','STATUS_OBSERVED'].includes(state);
 const revoke=row.canRevokeOnboardingContact===true&&currentPerson&&(snapshot.canManage===true||row.self===true&&row.status==='ACTIVE'&&row.accountLinked===true)&&delivery?.contactAuthorized===true;
 let label=copy[0],description=copy[1];
  if(blocker){label='Plantilla de alta pendiente';description='Falta comprobar una aprobación vigente para las instrucciones de alta. Revisá la plantilla de esta empresa; no se inicia otro envío.';}
 if(state==='STATUS_OBSERVED'&&delivery.providerStatus==='delivered'){label='Entrega informada por WhatsApp';description='WhatsApp informó la entrega del mensaje. Esto no acredita quién lo recibió, la aceptación de la cuenta ni la revisión de identidad.';}
 if(state==='STATUS_OBSERVED'&&delivery.providerStatus==='read'){label='Lectura informada por WhatsApp';description='WhatsApp informó la lectura del mensaje. Esto no acredita quién lo leyó, la aceptación de la cuenta ni la revisión de identidad.';}
 if(state==='STATUS_OBSERVED'&&['failed','deleted'].includes(delivery.providerStatus)){label='Entrega no confirmada';description='WhatsApp informó un fallo o la eliminación del mensaje. No se reenvía automáticamente; consultá el estado y la configuración.';}
 const dispatched=['SEND_STARTED','SEND_UNKNOWN','SENT','STATUS_OBSERVED'].includes(state);
  return {observed:true,state,blocker,label,description,canSend:Boolean(send),canRevoke:Boolean(revoke),contactAuthorized:delivery?.contactAuthorized??false,providerAccepted:delivery?.providerAccepted??false,deliveryConfirmed:delivery?.deliveryConfirmed??false,automaticResendAllowed:false,revokeWarning:dispatched?'Retirar la autorización detiene futuros envíos. No puede borrar ni retirar un mensaje que WhatsApp ya haya aceptado o enviado.':revoke?'Retirar la autorización impide los próximos envíos de instrucciones. La invitación de acceso y los demás permisos se conservan.':null};
}

return {participantOnboardingContactNotice,participantOnboardingWhatsAppConsent,participantOnboardingDeliveryView};
})();
