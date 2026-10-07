// Presentation only. Existing server commands must revalidate authority.
// Callers supply the current verified scope and clock; this module does no IO.
const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const scope=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const scoped=(value,context)=>value?.scope===context.scope&&value?.projectId===context.projectId;
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
 if(row.kyc?.status==='PENDING_REVIEW')return !row.self&&snapshot.canManage&&row.kyc.images?.length===2
  ?next('IDENTITY_REVIEW','REVIEW_KYC','Revisar identidad')
  :next('WAIT_REVIEW','CONSULT_PARTICIPANTS','Consultar revisión');
 if(row.kyc?.status!=='APPROVED')return next('IDENTITY_UNOBSERVED','CONSULT_PARTICIPANTS','Consultar identidad');
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
