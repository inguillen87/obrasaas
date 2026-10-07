import {WorkspaceError,digest} from './workspace-policy.mjs';
import {decodeSignedCustomerEvent} from './meta-customer-processing.mjs';
import {customerChannelActive,assertCustomerReplyWindow} from './meta-customer-outbound.mjs';
import {encryptCustomerSecret,decryptCustomerSecret} from './meta-customer-credentials.mjs';
import {metaKycChallengeDigest} from './meta-kyc-challenge.mjs';
import {resolveCompanyKycAuthority,companyKycSecretContext,assertCompanyKycPrompt,assertCompanyKycImageSources,fenceCompanyKycAuthority,COMPANY_KYC_AUTHORIZATION_CODES} from './company-channel-kyc.mjs';
import {META_KYC_CONVERSATION_TTL_MS} from './meta-kyc-conversation.mjs';

export const META_KYC_AUTHORIZATION_CODES=Object.freeze(['META_KYC_CHALLENGE_REJECTED','META_KYC_CHALLENGE_EXPIRED','META_KYC_CHALLENGE_REVOKED','META_KYC_MESSAGE_OUT_OF_ORDER','META_KYC_CONVERSATION_LIMIT','META_KYC_DEPOSIT_REQUIRED',...COMPANY_KYC_AUTHORIZATION_CODES]);
const fail=code=>{throw new WorkspaceError(code,409);};
const eventId=value=>/^customer_webhook_[a-f0-9]{64}$/.test(value||'');
export const metaKycDispatchReceiptId=value=>'meta_kyc_dispatch_'+digest(['meta-kyc-dispatch-v1',value]);
const secretContext=(r,purpose,resourceId)=>r.companyKyc?companyKycSecretContext(r.companyKyc,purpose,resourceId):({organizationId:r.project.organizationId,projectId:r.project.id,purpose,resourceId});
export const sealMetaKycValue=(r,purpose,resourceId,value,environment)=>encryptCustomerSecret(JSON.stringify(value),secretContext(r,purpose,resourceId),environment);
export function readMetaKycValue(r,purpose,resourceId,value,environment){try{return JSON.parse(decryptCustomerSecret(value,secretContext(r,purpose,resourceId),environment));}catch{fail('META_KYC_CHALLENGE_REJECTED');}}
export function readMetaKycConversation(r,environment){
 const envelope=r.worker.metadata.participant.kycChatConversation;if(!envelope)return null;
 if(envelope.version!==1||envelope.challengeId!==r.challenge.id)fail('META_KYC_CHALLENGE_REJECTED');
 const state=readMetaKycValue(r,'kyc-chat-conversation',r.challenge.id,envelope.encryptedState,environment);
 if(state.challengeId!==envelope.challengeId||state.lastEventId!==envelope.lastEventId||state.lastMessageTimestamp!==envelope.lastMessageTimestamp||state.expiresAt!==envelope.expiresAt)fail('META_KYC_CHALLENGE_REJECTED');
 return state;
}
export function metaKycConversationEnvelope(r,state,environment){
 if(!state)return null;
 const value={...state,challengeId:r.challenge.id,lastEventId:r.event.id,lastMessageTimestamp:Number(r.payload.value.timestamp),expiresAt:new Date(Date.parse(r.challenge.claimedAt||r.now.toISOString())+META_KYC_CONVERSATION_TTL_MS).toISOString()};
 return {version:1,challengeId:value.challengeId,lastEventId:value.lastEventId,lastMessageTimestamp:value.lastMessageTimestamp,expiresAt:value.expiresAt,encryptedState:sealMetaKycValue(r,'kyc-chat-conversation',r.challenge.id,value,environment)};
}

// This is limited write authority for KYC capture, not a Clerk session and not
// CHANNEL_VERIFIED. Field and VINCULAR resolvers never use this function.
export async function resolveMetaKycAuthority(client,context,{deposit=false,outbound=false,environment=process.env}={}){
 if(!eventId(context?.eventId))fail('META_KYC_CHALLENGE_REJECTED');
 const initial=(await client.query(`SELECT id,"projectId",provider,"eventType","externalId",status::text AS status,payload,"leaseToken","leaseExpiresAt","createdAt" FROM public."WebhookEvent" WHERE id=$1`,[context.eventId])).rows[0];
 if(!initial||initial.projectId!==context.projectId||initial.payload?.channelId!==context.channelId)fail('META_KYC_CHALLENGE_REJECTED');
 const firstChannel=(await client.query(`SELECT c.*,p."organizationId" FROM public."WhatsAppConnection" c JOIN public."Project" p ON p.id=c."projectId" WHERE c.id=$1 AND c."projectId"=$2 AND p.status='ACTIVE'`,[context.channelId,context.projectId])).rows[0];
 if(!firstChannel)fail('META_KYC_CHALLENGE_REVOKED');
 const payload=decodeSignedCustomerEvent(initial,firstChannel,environment);
 if(payload.type!=='message')fail('META_KYC_NOT_APPLICABLE');
 const senderE164='+'+payload.value?.from,code=payload.value?.type==='text'?payload.value.text?.body?.trim():null,codeDigest=metaKycChallengeDigest(code);
 const corporate=await resolveCompanyKycAuthority(client,context,{initial,firstChannel,payload,codeDigest,environment});
 if(corporate)return finishMetaKycAuthority(client,context,corporate,{deposit,outbound,environment});
 const candidates=(await client.query(`SELECT w.id,w."projectId",w.phone,w.active,w.metadata FROM public."Worker" w JOIN public."Project" p ON p.id=w."projectId" WHERE w."projectId"=$1 AND p."organizationId"=$2 AND w.phone=$3 AND w.metadata->'participant'->'kycChatChallenge'->>'connectionId'=$4 AND (${codeDigest?"w.metadata->'participant'->'kycChatChallenge'->>'codeDigest'=$5":"w.metadata->'participant'->'kycChatChallenge'->>'status' IN ('CLAIMED','COMPLETED','CANCELLED')"})`,codeDigest?[context.projectId,firstChannel.organizationId,senderE164,context.channelId,codeDigest]:[context.projectId,firstChannel.organizationId,senderE164,context.channelId])).rows;
 if(candidates.length!==1)fail(codeDigest||code?.startsWith('IDENTIDAD')?'META_KYC_CHALLENGE_REJECTED':'META_KYC_NOT_APPLICABLE');
 const candidate=candidates[0],p0=candidate.metadata?.participant,c0=p0?.kycChatChallenge;
 if(!codeDigest&&['COMPLETED','CANCELLED'].includes(c0?.status)){
  const replay=(await client.query(`SELECT metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "entityId"=$3 AND action='participant.kyc_chat.dispatched'`,[metaKycDispatchReceiptId(initial.id),firstChannel.organizationId,candidate.id])).rows[0];
  if(!replay)fail('META_KYC_NOT_APPLICABLE');
 }
 // Lock account/membership before Project, matching the canonical lock order.
 const issuerUser=(await client.query(`SELECT id,"clerkUserId" FROM public."PlatformUser" WHERE id=$1 FOR SHARE`,[c0.issuerActorId])).rows[0];
 const issuer=(await client.query(`SELECT id AS "membershipId","userId" AS "actorId","organizationId","tenantRole"::text AS role FROM public."TenantMembership" WHERE id=$1 AND "userId"=$2 AND "organizationId"=$3 AND status='ACTIVE' FOR SHARE`,[c0.issuerMembershipId,c0.issuerActorId,firstChannel.organizationId])).rows[0];
 if(!issuerUser||!issuer||!['ADMIN','DIRECTOR'].includes(issuer.role))fail('META_KYC_CHALLENGE_REVOKED');
 let member=issuer;
 if(p0.status==='ACTIVE'){
  if(!p0.clerkUserId||p0.clerkUserId!==c0.participantClerkUserId)fail('META_KYC_CHALLENGE_REVOKED');
  const user=(await client.query(`SELECT id,"clerkUserId" FROM public."PlatformUser" WHERE "clerkUserId"=$1 FOR SHARE`,[p0.clerkUserId])).rows;
  if(user.length!==1)fail('META_KYC_CHALLENGE_REVOKED');
  const memberships=(await client.query(`SELECT id AS "membershipId","userId" AS "actorId","organizationId","tenantRole"::text AS role FROM public."TenantMembership" WHERE "userId"=$1 AND "organizationId"=$2 AND status='ACTIVE' FOR SHARE`,[user[0].id,firstChannel.organizationId])).rows;
  if(memberships.length!==1)fail('META_KYC_CHALLENGE_REVOKED');member={...memberships[0],clerkUserId:user[0].clerkUserId};
 }else if(p0.status!=='INVITED'||p0.clerkUserId||!c0.invitationId||p0.invitation?.id!==c0.invitationId||p0.invitation.state!=='SENT')fail('META_KYC_CHALLENGE_REVOKED');
 const project=(await client.query(`SELECT id,name,"organizationId",metadata FROM public."Project" WHERE id=$1 AND "organizationId"=$2 AND status='ACTIVE' FOR UPDATE`,[context.projectId,firstChannel.organizationId])).rows[0];
 if(!project)fail('META_KYC_CHALLENGE_REVOKED');
 if(p0.status==='ACTIVE'){
  const assigned=(await client.query(`SELECT id FROM public."ProjectMembership" WHERE "projectId"=$1 AND "tenantMembershipId"=$2 AND status='ACTIVE' FOR SHARE`,[project.id,member.membershipId])).rows;if(assigned.length!==1)fail('META_KYC_CHALLENGE_REVOKED');
 }
 const worker=(await client.query(`SELECT id,"projectId",phone,active,metadata,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM public."Worker" WHERE id=$1 AND "projectId"=$2 FOR UPDATE`,[candidate.id,project.id])).rows[0];
 const challenge=worker?.metadata?.participant?.kycChatChallenge,part=worker?.metadata?.participant;
 const connection=(await client.query(`SELECT *,"connectionStatus"::text AS "connectionStatus" FROM public."WhatsAppConnection" WHERE id=$1 AND "projectId"=$2 FOR SHARE`,[context.channelId,project.id])).rows[0];
 const event=(await client.query(`SELECT id,"projectId",provider,status::text AS status,payload,"leaseToken","leaseExpiresAt","createdAt" FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 FOR UPDATE`,[context.eventId,project.id])).rows[0],now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
 if(!worker?.active||part?.status!==p0.status||part?.clerkUserId!==p0.clerkUserId||challenge?.id!==c0.id||challenge.version!==1||challenge.organizationId!==project.organizationId||challenge.projectId!==project.id||challenge.workerId!==worker.id||worker.phone!==senderE164||challenge.senderE164!==senderE164||challenge.connectionId!==connection?.id||challenge.wabaId!==connection?.whatsappBusinessId||challenge.phoneNumberId!==connection?.phoneNumberId||challenge.issuerActorId!==issuer.actorId||challenge.issuerMembershipId!==issuer.membershipId||connection?.metadata?.credentialOrganizationId!==project.organizationId||!customerChannelActive(connection,now.getTime()))fail('META_KYC_CHALLENGE_REVOKED');
 if(!event||event.leaseToken!==context.leaseToken||event.status!=='PENDING'||Date.parse(event.leaseExpiresAt)<=now.getTime()||event.payload.payloadDigest!==context.payloadDigest)fail('META_CUSTOMER_INBOX_LEASE_CHANGED');
 if(Date.parse(challenge.expiresAt)<=now.getTime()||!Number.isFinite(Date.parse(challenge.expiresAt)))fail('META_KYC_CHALLENGE_EXPIRED');
 if(part.version!==1||worker.metadata?.siteRegister?.version!==1||part.status==='INVITED'&&(part.invitation?.id!==challenge.invitationId||part.invitation?.state!=='SENT'||!Number.isFinite(Date.parse(part.invitation?.expiresAt))||Date.parse(part.invitation.expiresAt)<=now.getTime()))fail('META_KYC_CHALLENGE_REVOKED');
 const finalPayload=decodeSignedCustomerEvent(event,{...connection,organizationId:project.organizationId},environment);assertCustomerReplyWindow(finalPayload,now.getTime());
 if(digest(finalPayload)!==digest(payload))fail('META_KYC_CHALLENGE_REJECTED');
 if(challenge.status==='PENDING'){if(!codeDigest||codeDigest!==challenge.codeDigest||deposit||outbound)fail('META_KYC_CHALLENGE_REJECTED');}
 else if(!['CLAIMED','COMPLETED'].includes(challenge.status)&&!(challenge.status==='CANCELLED'&&challenge.cancelledEventId===event.id)||codeDigest&&challenge.claimedEventId!==event.id)fail('META_KYC_CHALLENGE_REJECTED');
 const r={kind:'LIMITED_KYC_UPLOAD',member,issuer,project,worker,challenge,connection:{...connection,organizationId:project.organizationId},event,payload:finalPayload,now,source:{kind:'META_KYC_CHAT',eventId:event.id,payloadDigest:context.payloadDigest,challengeId:challenge.id,connectionId:connection.id,wabaId:connection.whatsappBusinessId,phoneNumberId:connection.phoneNumberId,senderE164}};
 return finishMetaKycAuthority(client,context,r,{deposit,outbound,environment});
}
async function finishMetaKycAuthority(client,context,r,{deposit,outbound,environment}){
 const {event,project,worker,challenge,payload:finalPayload,now}=r;
 if(r.companyKyc&&challenge.status==='PENDING'&&(deposit||outbound))fail('META_KYC_CHALLENGE_REJECTED');
 r.state=readMetaKycConversation(r,environment);
 const prior=(await client.query(`SELECT metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "entityId"=$3 AND action='participant.kyc_chat.dispatched'`,[metaKycDispatchReceiptId(event.id),project.organizationId,worker.id])).rows[0];
 if(prior){if(prior.metadata.payloadDigest!==context.payloadDigest||prior.metadata.challengeId!==challenge.id)fail('META_KYC_CHALLENGE_REJECTED');r.recorded=readMetaKycValue(r,'kyc-chat-dispatch',metaKycDispatchReceiptId(event.id),prior.metadata.encryptedResult,environment);if(r.recorded?.kind!=='KYC_CHAT'||r.recorded.identityStatus!=='LIMITED_KYC_UPLOAD'||prior.metadata.replyDigest!==digest(r.recorded.reply))fail('META_KYC_CHALLENGE_REJECTED');}
 if((!r.recorded||outbound)&&r.state&&r.state.lastEventId!==event.id&&Number(finalPayload.value.timestamp)<=r.state.lastMessageTimestamp)fail('META_KYC_MESSAGE_OUT_OF_ORDER');
 if(!r.recorded&&challenge.messageCount>=40&&!(r.state?.step==='FINALIZING'&&r.state.confirmationEventId===event.id))fail('META_KYC_CONVERSATION_LIMIT');
 if(challenge.status==='CLAIMED'&&(!Number.isFinite(Date.parse(challenge.claimedAt))||Date.parse(challenge.claimedAt)+META_KYC_CONVERSATION_TTL_MS<=now.getTime()))fail('META_KYC_CHALLENGE_EXPIRED');
 if(deposit&&(!r.state||r.state.step!=='FINALIZING'||r.state.confirmationEventId!==event.id||r.state.consent!==true||!r.state.front||!r.state.selfie))fail('META_KYC_DEPOSIT_REQUIRED');
 if(outbound&&!r.recorded?.reply)fail('META_KYC_CHALLENGE_REJECTED');
 assertCompanyKycPrompt(r);
 if(deposit)await assertCompanyKycImageSources(client,r,environment);
 await fenceCompanyKycAuthority(client,r,context);
 return r;
}
