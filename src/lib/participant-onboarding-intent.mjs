import {WorkspaceError,digest} from './workspace-policy.mjs';
import {PARTICIPANT_ONBOARDING_NOTICE_VERSION,PARTICIPANT_ONBOARDING_NOTICE_SHA256,PARTICIPANT_ONBOARDING_PURPOSE} from './participant-onboarding-policy.mjs';
// Only contact intent is recorded under the existing projectOperation locks.
// Another worksite/channel is resolved by the job, before its Worker lock.
export async function authorizeParticipantOnboarding(client,member,projectId,row,m,operationId){
 const part=m.participant,invite=part?.invitation;
 if(!['ADMIN','DIRECTOR'].includes(member.role)||!row.active||m.siteRegister?.version!==1||!['INVITED','ACTIVE'].includes(part?.status)||invite?.createdBy!==member.actorId||!/^invite_[a-f0-9]{32}$/.test(invite?.id||'')||!/^\+[1-9]\d{7,14}$/.test(row.phone||''))throw new WorkspaceError('PARTICIPANT_ONBOARDING_CONTACT_REQUIRED',409);
 if(['PENDING','CLAIMED'].includes(part.kycChatChallenge?.status)||['PENDING_REVIEW','PENDING_ACCOUNT_CLAIM','APPROVED'].includes(part.kyc?.status))throw new WorkspaceError('PARTICIPANT_KYC_CHAT_CLOSURE_REQUIRED',409);
 if(part.onboardingDelivery&&!['CANCELED','REJECTED','SENT','STATUS_OBSERVED'].includes(part.onboardingDelivery.state))throw new WorkspaceError('PARTICIPANT_ONBOARDING_ALREADY_REQUESTED',409);
 const now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
 const receiptId='onboarding_contact_'+digest([member.organizationId,projectId,row.id,invite.id,member.actorId,operationId]);
 const consent={version:1,status:'GRANTED',purpose:PARTICIPANT_ONBOARDING_PURPOSE,invitationId:invite.id,senderE164:row.phone,issuerActorId:member.actorId,issuerMembershipId:member.membershipId,receiptId,recordedAt:now.toISOString(),noticeVersion:PARTICIPANT_ONBOARDING_NOTICE_VERSION,noticeSha256:PARTICIPANT_ONBOARDING_NOTICE_SHA256};
 await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'participant.onboarding.contact_authorized','Worker',$4,$5::jsonb)`,[receiptId,member.organizationId,member.actorId,row.id,JSON.stringify({...consent,organizationId:member.organizationId,projectId})]);
 part.onboardingConsent=consent;
 part.onboardingDelivery={version:1,state:'WAITING_CONFIGURATION',organizationId:member.organizationId,targetProjectId:projectId,workerId:row.id,invitationId:invite.id,issuerActorId:member.actorId,issuerMembershipId:member.membershipId,consentReceiptId:receiptId,requestedAt:now.toISOString(),nextCheckAt:null,outboundId:null,code:null};
 return receiptId;
}
