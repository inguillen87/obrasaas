import {WorkspaceError,digest,workspaceId} from './workspace-policy.mjs';
export const PARTICIPANT_ONBOARDING_PURPOSE='PARTICIPANT_ONBOARDING';
export const PARTICIPANT_ONBOARDING_NOTICE_VERSION='participant-onboarding-v1';
export const PARTICIPANT_ONBOARDING_NOTICE='Confirmo que esta persona autorizó a la empresa a enviarle por WhatsApp su invitación de acceso y las instrucciones privadas para presentar su identidad. Este permiso se limita al alta: no habilita avisos operativos, no verifica el documento ni aprueba la identidad. Se puede retirar desde su perfil antes del envío.';
export const PARTICIPANT_ONBOARDING_NOTICE_SHA256=digest(PARTICIPANT_ONBOARDING_NOTICE);
export function validateParticipantOnboardingChoice(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join('|')!=='confirmed|noticeSha256|noticeVersion'||value.confirmed!==true||value.noticeVersion!==PARTICIPANT_ONBOARDING_NOTICE_VERSION||value.noticeSha256!==PARTICIPANT_ONBOARDING_NOTICE_SHA256)throw new WorkspaceError('PARTICIPANT_ONBOARDING_CONSENT_REQUIRED',400);
 return {...value};
}
export const participantOnboardingOutboundId=intent=>'customer_outbound_'+digest(['participant-onboarding-delivery-v1',intent.organizationId,intent.targetProjectId,intent.workerId,intent.invitationId,intent.consentReceiptId]);
export function participantOnboardingIntent(value){
 if(!value||value.version!==1||!/^invite_[a-f0-9]{32}$/.test(value.invitationId||'')||!['organizationId','targetProjectId','workerId','issuerActorId','issuerMembershipId','consentReceiptId'].every(key=>workspaceId(value[key])))throw new WorkspaceError('PARTICIPANT_ONBOARDING_CONTEXT_CHANGED',409);
 return {organizationId:value.organizationId,targetProjectId:value.targetProjectId,workerId:value.workerId,invitationId:value.invitationId,issuerActorId:value.issuerActorId,issuerMembershipId:value.issuerMembershipId,consentReceiptId:value.consentReceiptId};
}
export function publicParticipantOnboarding(participant){
 const i=participant?.onboardingDelivery,c=participant?.onboardingConsent;
 if(!i&&!c)return null;
 const states=new Set(['WAITING_CONFIGURATION','PENDING','BLOCKED','SEND_STARTED','SEND_UNKNOWN','SENT','REJECTED','STATUS_OBSERVED','CANCELED']);
 const state=states.has(i?.state)?i.state:'BLOCKED';
 return {state,contactAuthorized:c?.status==='GRANTED',outboundId:/^customer_outbound_[a-f0-9]{64}$/.test(i?.outboundId||'')?i.outboundId:null,code:typeof i?.code==='string'&&/^PARTICIPANT_ONBOARDING_[A-Z_]{2,70}$/.test(i.code)?i.code:null,providerAccepted:['SENT','STATUS_OBSERVED'].includes(state)&&!['failed','deleted'].includes(i?.providerStatus),deliveryConfirmed:state==='STATUS_OBSERVED'&&['delivered','read'].includes(i?.providerStatus),providerStatus:['sent','delivered','read','failed','deleted'].includes(i?.providerStatus)?i.providerStatus:null,automaticResendAllowed:false};
}
export function participantOnboardingCapabilities(row,member,{now,own=false}={}){
 const p=row.metadata?.participant,i=p?.invitation,c=p?.onboardingConsent,d=p?.onboardingDelivery;
 const clock=now instanceof Date?now.getTime():NaN,manager=['ADMIN','DIRECTOR'].includes(member?.role);
 const invitationReady=p?.status==='ACTIVE'?i?.state==='ACCEPTED':p?.status==='INVITED'&&i?.state==='SENT'&&Date.parse(i.expiresAt)>clock;
 const canSend=manager&&row.active&&row.metadata?.siteRegister?.version===1&&i?.createdBy===member.actorId&&invitationReady&&Number.isFinite(clock)&&/^\+[1-9]\d{7,14}$/.test(row.phone||'')&&['NOT_SUBMITTED','REJECTED'].includes(p.kyc?.status)&&!['PENDING','CLAIMED'].includes(p.kycChatChallenge?.status)&&(!d||['CANCELED','REJECTED','SENT','STATUS_OBSERVED'].includes(d.state));
 return {canSendOnboardingWhatsapp:Boolean(canSend),canRevokeOnboardingContact:c?.status==='GRANTED'&&(manager||own)};
}
