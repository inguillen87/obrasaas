import {WorkspaceError,digest} from './workspace-policy.mjs';
import {decodeSignedCustomerEvent} from './meta-customer-processing.mjs';
import {customerChannelActive,assertCustomerReplyWindow,customerOutboundId} from './meta-customer-outbound.mjs';
import {encryptCustomerSecret,decryptCustomerSecret} from './meta-customer-credentials.mjs';
import {metaKycChallengeDigest} from './meta-kyc-challenge.mjs';
import {resolveCompanyKycAuthority,resolveCompanyKycExpiryContext,resolveCompanyKycFeedbackContext,companyKycGrantDigest,companyKycSecretContext,assertCompanyKycPrompt,assertCompanyKycImageSources,fenceCompanyKycAuthority,COMPANY_KYC_AUTHORIZATION_CODES} from './company-channel-kyc.mjs';
import {decodeWorkerChannelProof} from './worker-channel-identity.mjs';
import {META_KYC_CONVERSATION_TTL_MS} from './meta-kyc-conversation.mjs';
import {resolveReactiveKycStart} from './meta-employee-intake.mjs';
import {lockOwnCompanyIssuer} from './meta-own-company-policy.mjs';
import {PARTICIPANT_NOTICE,PARTICIPANT_NOTICE_VERSION,PARTICIPANT_OCR_NOTICE,PARTICIPANT_OCR_NOTICE_VERSION,PARTICIPANT_BIOMETRIC_NOTICE,PARTICIPANT_BIOMETRIC_NOTICE_VERSION,PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE_VERSION,PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE_SHA256} from './participant-policy.mjs';

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
const capturePurpose=Symbol('meta-kyc-capture'),expiryFeedbackPurpose=Symbol('meta-kyc-expiry-feedback'),contextFeedbackPurpose=Symbol('meta-kyc-context-feedback');
export const resolveMetaKycAuthority=(client,context,options={})=>resolveMetaKycContext(client,context,options,capturePurpose);
async function resolveMetaKycContext(client,context,{deposit=false,outbound=false,environment=process.env},purpose){
 const contextFeedback=purpose===contextFeedbackPurpose,feedback=purpose===expiryFeedbackPurpose||contextFeedback;
 if(!eventId(context?.eventId))fail('META_KYC_CHALLENGE_REJECTED');
 const initial=(await client.query(`SELECT id,"projectId",provider,"eventType","externalId",status::text AS status,payload,"leaseToken","leaseExpiresAt","createdAt" FROM public."WebhookEvent" WHERE id=$1`,[context.eventId])).rows[0];
 if(!initial||initial.projectId!==context.projectId||initial.payload?.channelId!==context.channelId)fail('META_KYC_CHALLENGE_REJECTED');
 const firstChannel=(await client.query(`SELECT c.*,p."organizationId" FROM public."WhatsAppConnection" c JOIN public."Project" p ON p.id=c."projectId" WHERE c.id=$1 AND c."projectId"=$2 AND p.status='ACTIVE'`,[context.channelId,context.projectId])).rows[0];
 if(!firstChannel)fail('META_KYC_CHALLENGE_REVOKED');
 const ownCompanyCapability=await lockOwnCompanyIssuer(client,firstChannel,{environment});
 const payload=decodeSignedCustomerEvent(initial,firstChannel,environment);
 if(payload.type!=='message')fail('META_KYC_NOT_APPLICABLE');
 if(feedback&&(payload.value?.type==='text'&&/^IDENTIDAD(?:\s|$)/i.test(payload.value.text?.body?.trim()||'')||typeof payload.value?.context?.id!=='string'))return null;
 if(contextFeedback){
  decodeWorkerChannelProof(initial,firstChannel,environment);
  const message=payload.value;
  if(!(['interactive','image'].includes(message.type)||message.type==='text'&&['ESTADO','ESTADO IDENTIDAD'].includes(message.text?.body?.trim().toUpperCase())))return null;
  if(message.type==='image'&&(!/^\d{5,32}$/.test(message.image?.id||'')||!['image/jpeg','image/png','image/webp'].includes(message.image?.mime_type)))return null;
 }
 const reactiveStart=feedback?null:await resolveReactiveKycStart(client,initial,firstChannel,payload,{environment});
 const senderE164='+'+payload.value?.from,code=payload.value?.type==='text'?payload.value.text?.body?.trim():null,codeDigest=reactiveStart?.codeDigest||metaKycChallengeDigest(code);
 const corporate=await (contextFeedback?resolveCompanyKycFeedbackContext:feedback?resolveCompanyKycExpiryContext:resolveCompanyKycAuthority)(client,context,{initial,firstChannel,payload,codeDigest,environment});
 if(corporate){corporate.ownCompanyCapability=ownCompanyCapability;if(reactiveStart){if(corporate.challenge.id!==reactiveStart.challengeId||corporate.worker.id!==reactiveStart.workerId||corporate.project.id!==reactiveStart.targetProjectId)fail('META_KYC_CHALLENGE_REJECTED');corporate.reactiveStartExpiresAt=reactiveStart.expiresAt;}return feedback?finishMetaKycExpiryAuthority(client,context,corporate,{environment,contextFeedback}):finishMetaKycAuthority(client,context,corporate,{deposit,outbound,environment});}
 if(reactiveStart)fail('META_KYC_CHALLENGE_REJECTED');
 const candidates=(await client.query(`SELECT w.id,w."projectId",w.phone,w.active,w.metadata FROM public."Worker" w JOIN public."Project" p ON p.id=w."projectId" WHERE w."projectId"=$1 AND p."organizationId"=$2 AND w.phone=$3 AND w.metadata->'participant'->'kycChatChallenge'->>'connectionId'=$4 AND (${codeDigest?"w.metadata->'participant'->'kycChatChallenge'->>'codeDigest'=$5":"w.metadata->'participant'->'kycChatChallenge'->>'status' IN ('CLAIMED','COMPLETED','CANCELLED')"})`,codeDigest?[context.projectId,firstChannel.organizationId,senderE164,context.channelId,codeDigest]:[context.projectId,firstChannel.organizationId,senderE164,context.channelId])).rows;
 if(candidates.length!==1)fail(codeDigest||code?.startsWith('IDENTIDAD')?'META_KYC_CHALLENGE_REJECTED':'META_KYC_NOT_APPLICABLE');
 const candidate=candidates[0],p0=candidate.metadata?.participant,c0=p0?.kycChatChallenge;
 if(feedback&&c0?.status!=='CLAIMED')fail('META_KYC_EXPIRY_FEEDBACK_DENIED');
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
 if(!worker?.active||part?.status!==p0.status||part?.clerkUserId!==p0.clerkUserId||challenge?.id!==c0.id||challenge.version!==1||challenge.organizationId!==project.organizationId||challenge.projectId!==project.id||challenge.workerId!==worker.id||worker.phone!==senderE164||challenge.senderE164!==senderE164||challenge.connectionId!==connection?.id||challenge.wabaId!==connection?.whatsappBusinessId||challenge.phoneNumberId!==connection?.phoneNumberId||challenge.issuerActorId!==issuer.actorId||challenge.issuerMembershipId!==issuer.membershipId||connection?.metadata?.credentialOrganizationId!==project.organizationId||!customerChannelActive(connection,now.getTime(),{environment}))fail('META_KYC_CHALLENGE_REVOKED');
 if(!event||event.leaseToken!==context.leaseToken||event.status!=='PENDING'||Date.parse(event.leaseExpiresAt)<=now.getTime()||event.payload.payloadDigest!==context.payloadDigest)fail('META_CUSTOMER_INBOX_LEASE_CHANGED');
 if(!feedback&&(Date.parse(challenge.expiresAt)<=now.getTime()||!Number.isFinite(Date.parse(challenge.expiresAt))))fail('META_KYC_CHALLENGE_EXPIRED');
 if(part.version!==1||worker.metadata?.siteRegister?.version!==1||part.status==='INVITED'&&(part.invitation?.id!==challenge.invitationId||part.invitation?.state!=='SENT'||!Number.isFinite(Date.parse(part.invitation?.expiresAt))||Date.parse(part.invitation.expiresAt)<=now.getTime()))fail('META_KYC_CHALLENGE_REVOKED');
 const finalPayload=decodeSignedCustomerEvent(event,{...connection,organizationId:project.organizationId},environment);assertCustomerReplyWindow(finalPayload,now.getTime());
 if(digest(finalPayload)!==digest(payload))fail('META_KYC_CHALLENGE_REJECTED');
 if(challenge.status==='PENDING'){if(!codeDigest||codeDigest!==challenge.codeDigest||deposit||outbound)fail('META_KYC_CHALLENGE_REJECTED');}
 else if(!['CLAIMED','COMPLETED'].includes(challenge.status)&&!(challenge.status==='CANCELLED'&&challenge.cancelledEventId===event.id)||codeDigest&&challenge.claimedEventId!==event.id)fail('META_KYC_CHALLENGE_REJECTED');
 const r={kind:feedback?'KYC_EXPIRY_CONTEXT':'LIMITED_KYC_UPLOAD',ownCompanyCapability,member,issuer,issuerClerkUserId:issuerUser.clerkUserId,project,worker,challenge,connection:{...connection,organizationId:project.organizationId},event,payload:finalPayload,now,source:{kind:'META_KYC_CHAT',eventId:event.id,payloadDigest:context.payloadDigest,challengeId:challenge.id,connectionId:connection.id,wabaId:connection.whatsappBusinessId,phoneNumberId:connection.phoneNumberId,senderE164}};
 return feedback?finishMetaKycExpiryAuthority(client,context,r,{environment,contextFeedback}):finishMetaKycAuthority(client,context,r,{deposit,outbound,environment});
}
async function finishMetaKycAuthority(client,context,r,{deposit,outbound,environment}){
 const {event,project,worker,challenge,payload:finalPayload,now}=r;
 if(challenge.captureImageSetVersion!==undefined&&challenge.captureImageSetVersion!==2)fail('META_KYC_CHALLENGE_REJECTED');
 if(challenge.captureImageSetVersion===2){
  const prepared=(await client.query(`SELECT id,metadata FROM public."AuditLog" WHERE "organizationId"=$1 AND "actorId"=$2 AND "entityType"='Worker' AND "entityId"=$3 AND action='participant.kyc_chat.prepared' AND metadata->>'challengeId'=$4`,[project.organizationId,challenge.issuerActorId,worker.id,challenge.id])).rows;
  if(prepared.length!==1||prepared[0].metadata?.version!==1||prepared[0].metadata.projectId!==project.id||prepared[0].metadata.captureImageSetVersion!==2||prepared[0].metadata.expiresAt!==challenge.expiresAt||!/^[a-f0-9]{64}$/.test(prepared[0].metadata.requestDigest||''))fail('META_KYC_CHALLENGE_REJECTED');
 }

 if(r.companyKyc&&challenge.status==='PENDING'&&(deposit||outbound))fail('META_KYC_CHALLENGE_REJECTED');
 r.state=readMetaKycConversation(r,environment);
 if(r.state&&r.state.captureImageSetVersion!==challenge.captureImageSetVersion)fail('META_KYC_CHALLENGE_REJECTED');
 const prior=(await client.query(`SELECT metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "entityId"=$3 AND action='participant.kyc_chat.dispatched'`,[metaKycDispatchReceiptId(event.id),project.organizationId,worker.id])).rows[0];
 if(prior){if(prior.metadata.payloadDigest!==context.payloadDigest||prior.metadata.challengeId!==challenge.id)fail('META_KYC_CHALLENGE_REJECTED');r.recorded=readMetaKycValue(r,'kyc-chat-dispatch',metaKycDispatchReceiptId(event.id),prior.metadata.encryptedResult,environment);if(r.recorded?.kind!=='KYC_CHAT'||r.recorded.identityStatus!=='LIMITED_KYC_UPLOAD'||prior.metadata.replyDigest!==digest(r.recorded.reply))fail('META_KYC_CHALLENGE_REJECTED');}
 if((!r.recorded||outbound)&&r.state&&r.state.lastEventId!==event.id){
  const timestamp=Number(finalPayload.value.timestamp);
  if(timestamp<r.state.lastMessageTimestamp)fail('META_KYC_MESSAGE_OUT_OF_ORDER');
  // Meta timestamps have second precision. Equal seconds require the current
  // confirmed corporate prompt, never timestamps or an old dispatch alone.
  if(timestamp===r.state.lastMessageTimestamp){
   if(!r.companyKyc||r.recorded||!r.prompt||r.state.lastEventId!==r.prompt.sourceEventId)fail('META_KYC_MESSAGE_OUT_OF_ORDER');
   assertCompanyKycPrompt(r);
  }
 }
 if(!r.recorded&&challenge.messageCount>=40&&!(r.state?.step==='FINALIZING'&&r.state.confirmationEventId===event.id))fail('META_KYC_CONVERSATION_LIMIT');
 if(challenge.status==='CLAIMED'&&(!Number.isFinite(Date.parse(challenge.claimedAt))||Date.parse(challenge.claimedAt)+META_KYC_CONVERSATION_TTL_MS<=now.getTime()))fail('META_KYC_CHALLENGE_EXPIRED');
 if(deposit&&(!r.state||r.state.step!=='FINALIZING'||r.state.confirmationEventId!==event.id||r.state.consent!==true||!r.state.front||!r.state.selfie||challenge.captureImageSetVersion===2&&(!r.state.back||r.state.backConsent!==true)))fail('META_KYC_DEPOSIT_REQUIRED');
 if(outbound&&!r.recorded?.reply)fail('META_KYC_CHALLENGE_REJECTED');
 assertCompanyKycPrompt(r);
 if(deposit&&challenge.captureImageSetVersion===2&&!r.companyKyc)for(const reference of [r.state.front,r.state.selfie,r.state.back]){
  if(!eventId(reference?.eventId))fail('META_KYC_DEPOSIT_REQUIRED');
  const rows=(await client.query(`SELECT * FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2`,[reference.eventId,r.connection.projectId])).rows;
  if(rows.length!==1||rows[0].payload?.channelId!==r.connection.id)fail('META_KYC_CHALLENGE_REJECTED');
  const image=decodeSignedCustomerEvent(rows[0],r.connection,environment),id=metaKycDispatchReceiptId(reference.eventId),sources=(await client.query(`SELECT metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "entityId"=$3 AND action='participant.kyc_chat.dispatched'`,[id,project.organizationId,worker.id])).rows,m=sources[0]?.metadata;
  if(image.type!=='message'||image.value.type!=='image'||image.value.image?.id!==reference.mediaId||image.value.image?.mime_type!==reference.contentType||'+'+image.value.from!==worker.phone||sources.length!==1||m.challengeId!==challenge.id||m.captureImageSetVersion!==2||m.payloadDigest!==rows[0].payload.payloadDigest)fail('META_KYC_CHALLENGE_REJECTED');
  const result=readMetaKycValue(r,'kyc-chat-dispatch',id,m.encryptedResult,environment);if(result?.kind!=='KYC_CHAT'||result.identityStatus!=='LIMITED_KYC_UPLOAD'||m.replyDigest!==digest(result.reply))fail('META_KYC_CHALLENGE_REJECTED');
 }
 if(deposit)await assertCompanyKycImageSources(client,r,environment);
 await fenceCompanyKycAuthority(client,r,context,{environment});
 return r;
}

const expiryAuthorities=new WeakMap();
const stable=value=>value instanceof Date?value.toISOString():Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const instant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const principalBinding=value=>({actorId:value.actorId,membershipId:value.membershipId,clerkUserId:value.clerkUserId||null,role:value.role,clerkRole:value.clerkRole||null,revision:value.revision||null,userRevision:value.userRevision||null});
// An additive private claim receipt, never a consent or upload capability.
// Credential rotation changes the grant digest and deliberately closes feedback.
export async function metaKycExpiryBindingDigest(client,r){
 const c=r.challenge,p=r.worker.metadata.participant;
 const trail=(await client.query(`SELECT id,"entityType","entityId",metadata FROM public."AuditLog" WHERE "organizationId"=$1 AND action='participant.operation.recorded' AND (("entityType"='TenantMembership' AND "entityId"=ANY($2::text[])) OR ("entityType"='Worker' AND "entityId"=$3)) AND metadata->>'kind' IN ('OFFICE_ROLE_CHANGED','REVOKE','RESTORE_ACCESS','EXISTING_ACCOUNT_ASSIGNED','INVITATION_ACCEPTED','FIELD_PERMISSIONS_CHANGED') ORDER BY id FOR SHARE`,[r.project.organizationId,[...new Set([r.issuer.membershipId,r.member.membershipId])].sort(),r.worker.id])).rows;
 return digest(stable(['meta-kyc-expiry-binding-v1',principalBinding(r.issuer),r.issuerClerkUserId||r.issuer.clerkUserId||null,principalBinding(r.member),{id:r.project.id,organizationId:r.project.organizationId},companyKycGrantDigest(r.connection),{id:r.worker.id,phone:r.worker.phone,active:r.worker.active,status:p.status,clerkUserId:p.clerkUserId||null,invitation:p.invitation||null,permissions:p.permissions},['id','organizationId','projectId','workerId','senderE164','connectionId','wabaId','phoneNumberId','issuerActorId','issuerMembershipId','participantClerkUserId','invitationId','codeDigest','createdAt','expiresAt','captureImageSetVersion','claimedAt','claimedEventId'].map(key=>[key,c[key]??null]),trail]));
}
async function feedbackPrompt(client,r,environment,{contextFeedback=false}={}){
 const message=r.payload.value,rows=(await client.query(`SELECT id,payload,outcome FROM public."WebhookEvent" WHERE "projectId"=$1 AND provider='meta-customer-outbound-v1' AND payload->>'channelId'=$2 AND outcome->>'messageId'=$3 FOR SHARE`,[r.connection.projectId,r.connection.id,message.context?.id])).rows;
 if(rows.length!==1)fail('META_KYC_EXPIRY_FEEDBACK_DENIED');const out=rows[0];
 let request;try{request=JSON.parse(decryptCustomerSecret(out.payload.encryptedPayload,{organizationId:r.project.organizationId,projectId:r.connection.projectId,purpose:'outbound',resourceId:out.id},environment));}catch{fail('META_KYC_EXPIRY_FEEDBACK_DENIED');}
 if(request?.version!==1||!eventId(request.eventId)||out.id!==customerOutboundId(request.eventId)||request.channelPurpose!=='KYC_CAPTURE'||request.organizationId!==r.project.organizationId||request.channelId!==r.connection.id||request.challengeId!==r.challenge.id||request.to!==message.from||digest(request)!==out.payload.requestDigest||!['SENT','STATUS_OBSERVED'].includes(out.outcome?.state)||['failed','deleted'].includes(out.outcome?.providerStatus)||!contextFeedback&&r.state.lastEventId!==request.eventId)fail('META_KYC_EXPIRY_FEEDBACK_DENIED');
 const source=(await client.query(`SELECT * FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 FOR SHARE`,[request.eventId,r.connection.projectId])).rows;
 if(source.length!==1||source[0].payload?.channelId!==r.connection.id||source[0].payload.payloadDigest!==request.payloadDigest)fail('META_KYC_EXPIRY_FEEDBACK_DENIED');
 const signed=decodeSignedCustomerEvent(source[0],r.connection,environment);
 if(contextFeedback){decodeWorkerChannelProof(source[0],r.connection,environment);if(Number(message.timestamp)<Number(signed.value?.timestamp))fail('META_KYC_CONTEXT_FEEDBACK_DENIED');}
 if(signed.type!=='message'||signed.value.from!==message.from||signed.value.id!==request.replyTo)fail('META_KYC_EXPIRY_FEEDBACK_DENIED');
 const records=(await client.query(`SELECT metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "entityId"=$3 AND action='participant.kyc_chat.dispatched' FOR SHARE`,[metaKycDispatchReceiptId(request.eventId),r.project.organizationId,r.worker.id])).rows;
 const m=records[0]?.metadata;
 if(records.length!==1||m?.version!==1||m.projectId!==r.project.id||m.challengeId!==r.challenge.id||m.payloadDigest!==request.payloadDigest||m.replyDigest!==digest(request.message))fail('META_KYC_EXPIRY_FEEDBACK_DENIED');
 const recorded=readMetaKycValue(r,'kyc-chat-dispatch',metaKycDispatchReceiptId(request.eventId),m.encryptedResult,environment);
 if(recorded?.kind!=='KYC_CHAT'||recorded.identityStatus!=='LIMITED_KYC_UPLOAD'||digest(recorded.reply)!==digest(request.message))fail('META_KYC_EXPIRY_FEEDBACK_DENIED');
 const selected=message.interactive?.list_reply?.id||message.interactive?.button_reply?.id;
 if(contextFeedback&&message.type==='interactive'&&!selected)fail('META_KYC_CONTEXT_FEEDBACK_DENIED');
 if(selected){const match=/^kyc:([a-f0-9]{20}):(\d{1,2})$/.exec(selected);if(!match||!contextFeedback&&(match[1]!==r.state.nonce||!r.state.choices?.[Number(match[2])])||!request.message.sections?.flatMap(section=>section.rows||[]).some(row=>row.id===selected))fail('META_KYC_EXPIRY_FEEDBACK_DENIED');}
 if(contextFeedback){r.feedbackStalePrompt=r.state.lastEventId!==request.eventId;r.feedbackSourceEventId=request.eventId;}
 // Delivery/read observations can progress while sending feedback. They are
 // rechecked above; only the immutable accepted message reference is bound.
 return digest(stable(contextFeedback?[out.id,out.payload,out.outcome.messageId,source[0].payload,m]:[out.payload,out.outcome,source[0].payload,m]));
}
async function finishMetaKycExpiryAuthority(client,context,r,{environment,contextFeedback=false}){
 const c=r.challenge,p=r.worker.metadata.participant;
 if(c.status!=='CLAIMED'||c.captureImageSetVersion!==2||!instant(c.createdAt)||!instant(c.claimedAt)||!instant(c.expiresAt)||Date.parse(c.createdAt)>Date.parse(c.claimedAt)||Date.parse(c.claimedAt)>=Date.parse(c.expiresAt)||Date.parse(c.claimedAt)>r.now.getTime())fail('META_KYC_EXPIRY_FEEDBACK_DENIED');
 if(!['NOT_SUBMITTED','REJECTED'].includes(p.kyc?.status)||c.confirmationEventId||c.completionEventId||c.completedAt)fail('META_KYC_EXPIRY_FEEDBACK_DENIED');
 r.state=readMetaKycConversation(r,environment);const s=r.state;
 if(!s||s.version!==1||s.captureImageSetVersion!==2||!['CONSENT','BACK_CONSENT','OCR','BIOMETRIC','FRONT','BACK','SELFIE','CONFIRM'].includes(s.step)||s.confirmationEventId||s.expiresAt!==new Date(Date.parse(c.claimedAt)+META_KYC_CONVERSATION_TTL_MS).toISOString()||s.noticeVersion!==PARTICIPANT_NOTICE_VERSION||s.noticeSha256!==digest(PARTICIPANT_NOTICE)||s.ocrNoticeVersion!==PARTICIPANT_OCR_NOTICE_VERSION||s.ocrNoticeSha256!==digest(PARTICIPANT_OCR_NOTICE)||s.biometricNoticeVersion!==PARTICIPANT_BIOMETRIC_NOTICE_VERSION||s.biometricNoticeSha256!==digest(PARTICIPANT_BIOMETRIC_NOTICE)||s.backNoticeVersion!==PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE_VERSION||s.backNoticeSha256!==PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE_SHA256)fail('META_KYC_EXPIRY_FEEDBACK_DENIED');
 for(const key of ['consent','backConsent','ocrConsent','biometricConsent'])if(typeof s[key]!=='boolean')fail('META_KYC_EXPIRY_FEEDBACK_DENIED');
 const prepared=(await client.query(`SELECT id,metadata FROM public."AuditLog" WHERE "organizationId"=$1 AND "actorId"=$2 AND "entityType"='Worker' AND "entityId"=$3 AND action='participant.kyc_chat.prepared' AND metadata->>'challengeId'=$4 FOR SHARE`,[r.project.organizationId,c.issuerActorId,r.worker.id,c.id])).rows;
 if(prepared.length!==1||prepared[0].metadata?.version!==1||prepared[0].metadata.projectId!==r.project.id||prepared[0].metadata.captureImageSetVersion!==2||prepared[0].metadata.expiresAt!==c.expiresAt||!/^[a-f0-9]{64}$/.test(prepared[0].metadata.requestDigest||''))fail('META_KYC_EXPIRY_FEEDBACK_DENIED');
 if(!eventId(c.claimedEventId))fail('META_KYC_EXPIRY_FEEDBACK_DENIED');
 const claimed=(await client.query(`SELECT metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "entityId"=$3 AND action='participant.kyc_chat.dispatched' FOR SHARE`,[metaKycDispatchReceiptId(c.claimedEventId),r.project.organizationId,r.worker.id])).rows;
 const claim=claimed[0]?.metadata;
 if(claimed.length!==1||claim?.version!==1||claim.projectId!==r.project.id||claim.challengeId!==c.id||claim.captureImageSetVersion!==2)fail('META_KYC_EXPIRY_FEEDBACK_DENIED');
 const origin=(await client.query(`SELECT * FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 FOR SHARE`,[c.claimedEventId,r.connection.projectId])).rows;
 if(origin.length!==1||origin[0].payload?.channelId!==r.connection.id||origin[0].payload.payloadDigest!==claim.payloadDigest)fail('META_KYC_EXPIRY_FEEDBACK_DENIED');
 const signed=decodeSignedCustomerEvent(origin[0],r.connection,environment),original=readMetaKycValue(r,'kyc-chat-dispatch',metaKycDispatchReceiptId(c.claimedEventId),claim.encryptedResult,environment);
 if(signed.type!=='message'||signed.value.from!==r.payload.value.from||original?.kind!=='KYC_CHAT'||original.identityStatus!=='LIMITED_KYC_UPLOAD'||digest(original.reply)!==claim.replyDigest||!r.companyKyc&&metaKycChallengeDigest(signed.value.text?.body?.trim())!==c.codeDigest)fail('META_KYC_EXPIRY_FEEDBACK_DENIED');
 const bindingDigest=await metaKycExpiryBindingDigest(client,r);
 if((!r.companyKyc||claim.feedbackBindingDigest!==undefined)&&claim.feedbackBindingDigest!==bindingDigest)fail('META_KYC_EXPIRY_FEEDBACK_DENIED');
 const submitted=(await client.query(`SELECT id FROM public."AuditLog" WHERE "organizationId"=$1 AND "entityType"='Worker' AND "entityId"=$2 AND action='participant.operation.recorded' AND metadata->>'kind'='KYC_SUBMITTED' AND "createdAt">=$3::timestamptz LIMIT 1 FOR SHARE`,[r.project.organizationId,r.worker.id,c.claimedAt])).rows;
 const capture=(await client.query(`SELECT metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "entityId"=$3 AND action='participant.kyc_chat.dispatched' FOR SHARE`,[metaKycDispatchReceiptId(r.event.id),r.project.organizationId,r.worker.id])).rows;
 if(submitted.length||capture.length)fail('META_KYC_EXPIRY_FEEDBACK_DENIED');
 const outboundId=customerOutboundId(r.event.id),outbound=(await client.query(`SELECT id,payload,outcome FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-outbound-v1' FOR SHARE`,[outboundId,r.connection.projectId])).rows;
 if(outbound.length>1)fail('META_KYC_EXPIRY_FEEDBACK_DENIED');
 if(outbound.length){let request;try{request=JSON.parse(decryptCustomerSecret(outbound[0].payload.encryptedPayload,{organizationId:r.project.organizationId,projectId:r.connection.projectId,purpose:'outbound',resourceId:outboundId},environment));}catch{fail('META_KYC_EXPIRY_FEEDBACK_DENIED');}
   if(outbound[0].payload[contextFeedback?'kycContextFeedback':'kycExpiryFeedback']!==true||request.channelPurpose!==(contextFeedback?'KYC_CONTEXT_FEEDBACK':'KYC_EXPIRY_FEEDBACK')||request.eventId!==r.event.id||request.payloadDigest!==context.payloadDigest||request.organizationId!==r.project.organizationId||request.channelId!==r.connection.id||request.to!==r.payload.value.from||request.replyTo!==r.payload.value.id||digest(request)!==outbound[0].payload.requestDigest)fail('META_KYC_EXPIRY_FEEDBACK_DENIED');
 }
 const promptDigest=await feedbackPrompt(client,r,environment,{contextFeedback});
 const current=(await client.query(`SELECT id,"projectId",payload,status::text AS status,"leaseToken","leaseExpiresAt",clock_timestamp() AS now FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 FOR UPDATE`,[r.event.id,r.connection.projectId])).rows;
 const now=current[0]?.now;
 if(current.length!==1||!(now instanceof Date)||!Number.isFinite(now.getTime())||current[0].status!=='PENDING'||current[0].leaseToken!==context.leaseToken||!Number.isFinite(Date.parse(current[0].leaseExpiresAt))||Date.parse(current[0].leaseExpiresAt)<=now.getTime()||digest(current[0].payload)!==digest(r.event.payload))fail('META_CUSTOMER_INBOX_LEASE_CHANGED');
 assertCustomerReplyWindow(r.payload,now.getTime());
 const expired=Date.parse(c.expiresAt)<=now.getTime()||Date.parse(s.expiresAt)<=now.getTime();
 if(contextFeedback?!r.feedbackStalePrompt&&!expired:!expired)fail('META_KYC_EXPIRY_FEEDBACK_DENIED');
 r.kind=contextFeedback?'KYC_CONTEXT_FEEDBACK_REPLY':'KYC_EXPIRY_FEEDBACK_REPLY';r.now=now;r.feedbackBindingDigest=bindingDigest;r.feedbackPromptDigest=promptDigest;
 (contextFeedback?contextAuthorities:expiryAuthorities).set(r,{client,contextDigest:digest(context),fingerprint:contextFeedback?contextFingerprint(r):expiryFingerprint(r)});return r;
}
const expiryFingerprint=r=>digest(stable([r.kind,r.member,r.issuer,r.project,r.worker,r.challenge,r.connection,r.event.payload,r.state,r.feedbackBindingDigest,r.feedbackPromptDigest]));
export function metaKycExpiryAuthorityDigest(client,r,context){const proof=expiryAuthorities.get(r);if(!proof||proof.client!==client||proof.contextDigest!==digest(context)||proof.fingerprint!==expiryFingerprint(r))fail('META_KYC_EXPIRY_FEEDBACK_DENIED');return proof.fingerprint;}
export const resolveMetaKycExpiryFeedbackAuthority=(client,context,{environment=process.env}={})=>resolveMetaKycContext(client,context,{environment},expiryFeedbackPurpose);
const contextAuthorities=new WeakMap();
const contextFingerprint=r=>digest([expiryFingerprint(r),r.feedbackSourceEventId,r.feedbackStalePrompt]);
export function metaKycContextAuthorityDigest(client,r,context){const proof=contextAuthorities.get(r);if(!proof||proof.client!==client||proof.contextDigest!==digest(context)||proof.fingerprint!==contextFingerprint(r))fail('META_KYC_CONTEXT_FEEDBACK_DENIED');return proof.fingerprint;}
export const resolveMetaKycContextFeedbackAuthority=(client,context,{environment=process.env}={})=>resolveMetaKycContext(client,context,{environment},contextFeedbackPurpose);
