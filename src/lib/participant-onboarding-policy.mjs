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
export const PARTICIPANT_ONBOARDING_PHASES=Object.freeze(['ACCOUNT_INVITATION','IDENTITY_START']);
const deliveryStates=Object.freeze(['WAITING_ACCOUNT_ACCEPTANCE','WAITING_CONFIGURATION','PENDING','BLOCKED','SEND_STARTED','SEND_UNKNOWN','SENT','REJECTED','STATUS_OBSERVED','CANCELED']);
const phaseStatusKeys=Object.freeze(['state','nextCheckAt','outboundId','anchorProjectId','authorityDigest','challengeId','code','providerStatus']);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const instant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const phaseError=()=>{throw new WorkspaceError('PARTICIPANT_ONBOARDING_CONTEXT_CHANGED',409);};
export function participantOnboardingPhaseOutboundId(intent,phase){
 if(!PARTICIPANT_ONBOARDING_PHASES.includes(phase))phaseError();
 return 'customer_outbound_'+digest(['participant-onboarding-delivery-v2',phase,intent.organizationId,intent.targetProjectId,intent.workerId,intent.invitationId,intent.consentReceiptId]);
}
export function participantOnboardingPhase(delivery){
 if(delivery?.deliveryVersion===undefined)return null;
 if(delivery.deliveryVersion!==2||!PARTICIPANT_ONBOARDING_PHASES.includes(delivery.phase)||!object(delivery.phases)||Object.keys(delivery.phases).sort().join('|')!=='ACCOUNT_INVITATION|IDENTITY_START')phaseError();
 if(!deliveryStates.includes(delivery.state)||delivery.state==='WAITING_ACCOUNT_ACCEPTANCE'&&delivery.phase!=='IDENTITY_START'||delivery.nextCheckAt!==null&&!instant(delivery.nextCheckAt)||delivery.outboundId!==null&&!/^customer_outbound_[a-f0-9]{64}$/.test(delivery.outboundId||'')||delivery.code!==null&&!/^PARTICIPANT_ONBOARDING_[A-Z_]{2,70}$/.test(delivery.code||''))phaseError();
 for(const phase of PARTICIPANT_ONBOARDING_PHASES){
  const stage=delivery.phases[phase];if(stage===null){if(phase===delivery.phase)phaseError();continue;}
  if(!object(stage)||!deliveryStates.includes(stage.state)||!instant(stage.requestedAt)||stage.state==='WAITING_ACCOUNT_ACCEPTANCE'&&phase!=='IDENTITY_START'||stage.outboundId!==null&&!/^customer_outbound_[a-f0-9]{64}$/.test(stage.outboundId||'')||stage.nextCheckAt!==null&&!instant(stage.nextCheckAt)||stage.code!==null&&!/^PARTICIPANT_ONBOARDING_[A-Z_]{2,70}$/.test(stage.code||''))phaseError();
  if(Object.keys(stage).some(key=>!['requestedAt','acceptanceReceiptId','participantClerkUserId',...phaseStatusKeys].includes(key)))phaseError();
  if(phase==='ACCOUNT_INVITATION'&&(stage.challengeId!=null||stage.acceptanceReceiptId!==undefined||stage.participantClerkUserId!==undefined))phaseError();
  const unbound=stage.acceptanceReceiptId===undefined&&stage.participantClerkUserId===undefined;
  if(phase==='IDENTITY_START'&&!(['WAITING_ACCOUNT_ACCEPTANCE','CANCELED'].includes(stage.state)&&unbound)&&(!workspaceId(stage.acceptanceReceiptId)||!/^user_[A-Za-z0-9]+$/.test(stage.participantClerkUserId||'')))phaseError();
  if(stage.anchorProjectId!==undefined&&!workspaceId(stage.anchorProjectId)||stage.authorityDigest!==undefined&&!/^[a-f0-9]{64}$/.test(stage.authorityDigest||'')||stage.challengeId!=null&&!/^kyc_chat_[a-f0-9]{32}$/.test(stage.challengeId)||stage.providerStatus!=null&&!['sent','delivered','read','failed','deleted'].includes(stage.providerStatus))phaseError();
 }
 return delivery.phase;
}
export function participantOnboardingPhaseState(delivery,phase){
 if(!participantOnboardingPhase(delivery)||!PARTICIPANT_ONBOARDING_PHASES.includes(phase))phaseError();
 const stage=delivery.phases[phase];if(stage===null)return null;
 // The existing top-level state is canonical for the selected phase. This also
 // preserves canonical reactive handoff/cancellation without rewriting history.
 const current=phase===delivery.phase?{...stage,...Object.fromEntries(phaseStatusKeys.filter(key=>Object.hasOwn(delivery,key)).map(key=>[key,delivery[key]]))}:{...stage};
 if(phase==='ACCOUNT_INVITATION'&&current.challengeId!=null)phaseError();
 if(phase==='IDENTITY_START'&&!['WAITING_ACCOUNT_ACCEPTANCE','CANCELED'].includes(current.state)&&(!workspaceId(current.acceptanceReceiptId)||!/^user_[A-Za-z0-9]+$/.test(current.participantClerkUserId||'')))phaseError();
 return current;
}
export function updateParticipantOnboardingPhase(delivery,phase,values,{select=false}={}){
 const stage=participantOnboardingPhaseState(delivery,phase);if(!stage)phaseError();
 const next={...stage,...values},result={...delivery,phases:{...delivery.phases,[phase]:next}};
 if(select||delivery.phase===phase){for(const key of phaseStatusKeys)delete result[key];for(const key of phaseStatusKeys)if(Object.hasOwn(next,key))result[key]=next[key];result.phase=phase;}
 participantOnboardingPhase(result);return result;
}
export function createParticipantOnboardingPhases(delivery,participant,requestedAt){
 if(!instant(requestedAt)||!['INVITED','ACTIVE'].includes(participant?.status))phaseError();
 const stage=state=>({state,requestedAt,nextCheckAt:null,outboundId:null,code:null});
 const invited=participant.status==='INVITED',identity=stage(invited?'WAITING_ACCOUNT_ACCEPTANCE':'WAITING_CONFIGURATION');
 if(!invited){if(!workspaceId(participant.acceptanceReceiptId)||!/^user_[A-Za-z0-9]+$/.test(participant.clerkUserId||''))phaseError();identity.acceptanceReceiptId=participant.acceptanceReceiptId;identity.participantClerkUserId=participant.clerkUserId;}
 const result={...delivery,deliveryVersion:2,phase:invited?'ACCOUNT_INVITATION':'IDENTITY_START',phases:{ACCOUNT_INVITATION:invited?stage('WAITING_CONFIGURATION'):null,IDENTITY_START:identity}};
 participantOnboardingPhase(result);return result;
}
export function queueParticipantOnboardingIdentity(participant,requestedAt){
 const delivery=participant?.onboardingDelivery;if(delivery?.deliveryVersion!==2)return false;
 participantOnboardingPhase(delivery);
 const consent=participant.onboardingConsent;
 if(participant.status!=='ACTIVE'||participant.invitation?.state!=='ACCEPTED'||!workspaceId(participant.acceptanceReceiptId)||!/^user_[A-Za-z0-9]+$/.test(participant.clerkUserId||'')||consent?.version!==1||consent.status!=='GRANTED'||consent.purpose!==PARTICIPANT_ONBOARDING_PURPOSE||consent.invitationId!==delivery.invitationId||consent.receiptId!==delivery.consentReceiptId||consent.issuerActorId!==delivery.issuerActorId||consent.issuerMembershipId!==delivery.issuerMembershipId||consent.noticeVersion!==PARTICIPANT_ONBOARDING_NOTICE_VERSION||consent.noticeSha256!==PARTICIPANT_ONBOARDING_NOTICE_SHA256||!['NOT_SUBMITTED','REJECTED'].includes(participant.kyc?.status)||['PENDING','CLAIMED'].includes(participant.kycChatChallenge?.status)||!instant(requestedAt))return false;
 const identity=participantOnboardingPhaseState(delivery,'IDENTITY_START');if(!identity||identity.state!=='WAITING_ACCOUNT_ACCEPTANCE')return false;
 let next=delivery;const invitation=participantOnboardingPhaseState(delivery,'ACCOUNT_INVITATION');
 if(invitation&&['WAITING_CONFIGURATION','PENDING','BLOCKED'].includes(invitation.state))next=updateParticipantOnboardingPhase(next,'ACCOUNT_INVITATION',{state:'CANCELED',nextCheckAt:null,code:null});
 next=updateParticipantOnboardingPhase(next,'IDENTITY_START',{state:'WAITING_CONFIGURATION',requestedAt,acceptanceReceiptId:participant.acceptanceReceiptId,participantClerkUserId:participant.clerkUserId},{select:true});
 participant.onboardingDelivery=next;return true;
}
export function revokeParticipantOnboardingPhases(delivery){
 if(delivery?.deliveryVersion!==2)return delivery;
 let next=delivery;for(const phase of PARTICIPANT_ONBOARDING_PHASES){const stage=participantOnboardingPhaseState(next,phase);if(stage&&['WAITING_ACCOUNT_ACCEPTANCE','WAITING_CONFIGURATION','PENDING','BLOCKED'].includes(stage.state))next=updateParticipantOnboardingPhase(next,phase,{state:'CANCELED',nextCheckAt:null,code:null});}return next;
}
export function participantOnboardingIntent(value){
 if(!value||value.version!==1||!/^invite_[a-f0-9]{32}$/.test(value.invitationId||'')||!['organizationId','targetProjectId','workerId','issuerActorId','issuerMembershipId','consentReceiptId'].every(key=>workspaceId(value[key])))throw new WorkspaceError('PARTICIPANT_ONBOARDING_CONTEXT_CHANGED',409);
 return {organizationId:value.organizationId,targetProjectId:value.targetProjectId,workerId:value.workerId,invitationId:value.invitationId,issuerActorId:value.issuerActorId,issuerMembershipId:value.issuerMembershipId,consentReceiptId:value.consentReceiptId};
}
export function publicParticipantOnboarding(participant){
 const i=participant?.onboardingDelivery,c=participant?.onboardingConsent;
 if(!i&&!c)return null;
 const states=new Set(['WAITING_CONFIGURATION','PENDING','BLOCKED','SEND_STARTED','SEND_UNKNOWN','SENT','REJECTED','STATUS_OBSERVED','CANCELED']);
 const state=states.has(i?.state)?i.state:'BLOCKED';
 const phase=participantOnboardingPhase(i),phases=phase?{phase,invitationState:participantOnboardingPhaseState(i,'ACCOUNT_INVITATION')?.state||null,identityState:participantOnboardingPhaseState(i,'IDENTITY_START')?.state||null}:{};
 return {state,contactAuthorized:c?.status==='GRANTED',outboundId:/^customer_outbound_[a-f0-9]{64}$/.test(i?.outboundId||'')?i.outboundId:null,code:typeof i?.code==='string'&&/^PARTICIPANT_ONBOARDING_[A-Z_]{2,70}$/.test(i.code)?i.code:null,providerAccepted:['SENT','STATUS_OBSERVED'].includes(state)&&!['failed','deleted'].includes(i?.providerStatus),deliveryConfirmed:state==='STATUS_OBSERVED'&&['delivered','read'].includes(i?.providerStatus),providerStatus:['sent','delivered','read','failed','deleted'].includes(i?.providerStatus)?i.providerStatus:null,automaticResendAllowed:false,...phases};
}
export function participantOnboardingCapabilities(row,member,{now,own=false}={}){
 const p=row.metadata?.participant,i=p?.invitation,c=p?.onboardingConsent,d=p?.onboardingDelivery;
 const clock=now instanceof Date?now.getTime():NaN,manager=['ADMIN','DIRECTOR'].includes(member?.role);
 const invitationReady=p?.status==='ACTIVE'?i?.state==='ACCEPTED':p?.status==='INVITED'&&i?.state==='SENT'&&Date.parse(i.expiresAt)>clock;
 const canSend=manager&&row.active&&row.metadata?.siteRegister?.version===1&&i?.createdBy===member.actorId&&invitationReady&&Number.isFinite(clock)&&/^\+[1-9]\d{7,14}$/.test(row.phone||'')&&['NOT_SUBMITTED','REJECTED'].includes(p.kyc?.status)&&!['PENDING','CLAIMED'].includes(p.kycChatChallenge?.status)&&(!d||['CANCELED','REJECTED','SENT','STATUS_OBSERVED'].includes(d.state));
 return {canSendOnboardingWhatsapp:Boolean(canSend),canRevokeOnboardingContact:c?.status==='GRANTED'&&(manager||own)};
}
