import {WorkspaceError,digest,workspaceId} from './workspace-policy.mjs';
import {companyConnectionForProject} from './company-channel-connection.mjs';
import {companyChannelSchemaReady,COMPANY_CHANNEL_SCHEMA_CONTRACT} from './company-channel-schema.mjs';
import {lockPersonWorksiteJourney} from './person-worksite-journey.mjs';
import {decodeWorkerChannelProof} from './worker-channel-identity.mjs';
import {decodeSignedCustomerEvent} from './meta-customer-processing.mjs';
import {decryptCustomerSecret} from './meta-customer-credentials.mjs';
import {customerChannelActive,assertCustomerReplyWindow} from './meta-customer-outbound.mjs';
import {META_KYC_CONVERSATION_TTL_MS} from './meta-kyc-conversation.mjs';

const fail=(code='META_KYC_COMPANY_PROJECTION_REJECTED',status=409)=>{throw new WorkspaceError(code,status);};
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const event=value=>typeof value==='string'&&/^customer_webhook_[a-f0-9]{64}$/.test(value);
const revision=value=>Number.isSafeInteger(value)&&value>=1&&value<=2147483647;
const projectionKeys=Object.freeze(['version','kind','sourceEventId','payloadDigest','organizationId','connectionId','anchorProjectId','targetProjectId','workerId','challengeId','ownerRevision','assignmentRevision','grantDigest','issuerActorId','issuerMembershipId','authorityDigest','participantActorId','participantMembershipId','participantClerkUserId']);
export const COMPANY_KYC_PROJECTION_KIND='COMPANY_KYC_CAPTURE';
export const COMPANY_KYC_AUTHORIZATION_CODES=Object.freeze(['META_KYC_COMPANY_PROJECTION_REJECTED','META_KYC_COMPANY_CONTEXT_REQUIRED','META_KYC_COMPANY_AUTHORITY_CHANGED','META_KYC_COMPANY_ADAPTER_UNAVAILABLE']);

// This validates data, never grants authority. Only the resolver's locked DB
// lookup and the signed original source may produce a corporate KYC authority.
export function companyKycProjectionContract(value,expected={}){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join('|')!==[...projectionKeys].sort().join('|')||value.version!==1||value.kind!==COMPANY_KYC_PROJECTION_KIND||!event(value.sourceEventId)||!hash(value.payloadDigest)||!hash(value.grantDigest)||!hash(value.authorityDigest)||!revision(value.ownerRevision)||!revision(value.assignmentRevision))fail();
 for(const key of ['organizationId','connectionId','anchorProjectId','targetProjectId','workerId','challengeId','issuerActorId','issuerMembershipId'])if(!workspaceId(value[key]))fail();
 const anonymous=value.participantActorId===null&&value.participantMembershipId===null&&value.participantClerkUserId===null;
 if(!anonymous&&(!workspaceId(value.participantActorId)||!workspaceId(value.participantMembershipId)||typeof value.participantClerkUserId!=='string'||!/^user_[A-Za-z0-9]+$/.test(value.participantClerkUserId)))fail();
 for(const [key,expectedValue] of Object.entries(expected))if(!projectionKeys.includes(key)||value[key]!==expectedValue)fail();
 return Object.freeze({...value});
}
export const companyKycProjectionTuple=value=>{const p=companyKycProjectionContract(value);return projectionKeys.map(key=>p[key]);};
export const companyKycProjectionDigest=value=>digest(companyKycProjectionTuple(value));
export function companyKycProjectionId(sourceEventId){if(!event(sourceEventId))fail();return 'company_kyc_projection_'+digest(['company-kyc-projection-v1',sourceEventId]);}
export function companyKycProjectLockIds(anchorProjectId,targetProjectId){
 if(!workspaceId(anchorProjectId)||!workspaceId(targetProjectId))fail();
 return [...new Set([anchorProjectId,targetProjectId])].sort();
}
export function companyKycSecretContext(value,purpose,resourceId){
 const p=companyKycProjectionContract(value);
 if(!['access-token','kyc-chat-conversation','kyc-chat-dispatch','outbound'].includes(purpose)||typeof resourceId!=='string'||!resourceId||resourceId.length>160)fail();
 return {organizationId:p.organizationId,projectId:p.anchorProjectId,purpose,resourceId};
}
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
export const companyKycGrantDigest=connection=>digest(['company-kyc-grant-v1',connection.id,connection.projectId,connection.whatsappBusinessId,connection.phoneNumberId,connection.encryptedAccessToken,stable(connection.metadata)]);
const preparedChannels=new WeakMap();
const pendingAcceptances=new WeakMap();
const pendingChallengeDigest=value=>digest(['company-kyc-pending-challenge-v1',stable(value)]);
async function principal(client,{actorId=null,membershipId=null,clerkUserId=null,organizationId},lock=true){
 const users=(await client.query('SELECT id,"clerkUserId",to_char("updatedAt",\'YYYY-MM-DD"T"HH24:MI:SS.US\') AS revision FROM public."PlatformUser" WHERE '+(actorId?'id=$1':'"clerkUserId"=$1')+(lock?' FOR SHARE':''),[actorId||clerkUserId])).rows;
 if(users.length!==1||!/^user_[A-Za-z0-9]+$/.test(users[0].clerkUserId||''))fail('META_KYC_CHALLENGE_REVOKED');
 const u=users[0],members=(await client.query('SELECT id AS "membershipId","userId" AS "actorId","organizationId","tenantRole"::text AS role,"clerkRole",to_char("updatedAt",\'YYYY-MM-DD"T"HH24:MI:SS.US\') AS revision FROM public."TenantMembership" WHERE "userId"=$1 AND "organizationId"=$2 AND status=\'ACTIVE\''+(membershipId?' AND id=$3':'')+(lock?' FOR SHARE':''),membershipId?[u.id,organizationId,membershipId]:[u.id,organizationId])).rows;
 if(members.length!==1||!['ADMIN','DIRECTOR','SITE_MANAGER','FINANCE','AUDITOR'].includes(members[0].role)||members[0].clerkRole==='obrasaas:internal')fail('META_KYC_CHALLENGE_REVOKED');
 return {...members[0],clerkUserId:u.clerkUserId,userRevision:u.revision};
}
async function trail(client,organizationId,workerId,membershipIds){
 const rows=(await client.query('SELECT id FROM public."AuditLog" WHERE "organizationId"=$1 AND action=\'participant.operation.recorded\' AND (("entityType"=\'Worker\' AND "entityId"=$2 AND metadata->>\'kind\' IN (\'REVOKE\',\'RESTORE_ACCESS\',\'EXISTING_ACCOUNT_ASSIGNED\',\'INVITATION_ACCEPTED\',\'INVITATION_SENT\')) OR ("entityType"=\'TenantMembership\' AND "entityId"=ANY($3::text[]) AND metadata->>\'kind\'=\'OFFICE_ROLE_CHANGED\')) ORDER BY id LIMIT 1001',[organizationId,workerId,membershipIds])).rows;
 if(rows.length>1000)fail('META_KYC_COMPANY_AUTHORITY_CHANGED');
 return rows.map(r=>r.id);
}
export async function prepareCompanyKycProjects(client,member,input){
 preparedChannels.set(client,null);
 const discovered=await companyConnectionForProject(client,member.organizationId,input.projectId);
 if(!discovered)return;
 if(discovered.company.mode!=='COMPANY'||discovered.metadata?.developmentPilot)fail('META_KYC_COMPANY_ADAPTER_UNAVAILABLE');
 const issuer=await principal(client,{actorId:member.actorId,membershipId:member.membershipId,organizationId:member.organizationId});
 if(!['ADMIN','DIRECTOR'].includes(issuer.role))fail('PARTICIPANT_MANAGE_REQUIRED',403);
 await lockPersonWorksiteJourney(client,issuer);
 for(const id of companyKycProjectLockIds(discovered.projectId,input.projectId)){
  const rows=(await client.query('SELECT id FROM public."Project" WHERE id=$1 AND "organizationId"=$2 AND status=\'ACTIVE\' FOR UPDATE',[id,member.organizationId])).rows;
  if(rows.length!==1)fail('META_KYC_CHALLENGE_REVOKED');
 }
 const channel=await companyConnectionForProject(client,member.organizationId,input.projectId,true);
 if(!channel||channel.company.mode!=='COMPANY'||companyKycGrantDigest(channel)!==companyKycGrantDigest(discovered))fail('META_KYC_COMPANY_AUTHORITY_CHANGED');
 preparedChannels.set(client,{channel,issuer});
}
export async function preparedCompanyKycChallenge(client,member,projectId,worker){
 const prepared=preparedChannels.get(client);
 if(!prepared)return null;
 prepared.workerId=worker.id;
 await assertCompanyKycInvitation(client,worker,member.organizationId);
 const candidates=(await client.query('SELECT w.id,w.metadata FROM public."Worker" w JOIN public."Project" p ON p.id=w."projectId" WHERE p."organizationId"=$1 AND w.phone=$2 AND w.active=true AND w.metadata->\'participant\'->\'kycChatChallenge\'->>\'connectionId\'=$3 LIMIT 101',[member.organizationId,worker.phone,prepared.channel.id])).rows;
 const now=(await client.query('SELECT clock_timestamp() AS now')).rows[0]?.now;
 if(!(now instanceof Date)||candidates.length>100||candidates.some(row=>{const c=row.metadata?.participant?.kycChatChallenge;return ['PENDING','CLAIMED'].includes(c?.status)&&Number.isFinite(Date.parse(c.expiresAt))&&Date.parse(c.expiresAt)>now.getTime()&&(c.status!=='CLAIMED'||Number.isFinite(Date.parse(c.claimedAt))&&Date.parse(c.claimedAt)+META_KYC_CONVERSATION_TTL_MS>now.getTime());}))fail('META_KYC_CHALLENGE_AMBIGUOUS');
 if(prepared.channel.company.targetProjectId!==projectId||prepared.issuer.actorId!==member.actorId||prepared.issuer.membershipId!==member.membershipId)fail();
 const ids=await trail(client,member.organizationId,worker.id,[member.membershipId]);
 return {channel:prepared.channel,descriptor:{version:1,anchorProjectId:prepared.channel.projectId,targetProjectId:projectId,ownerRevision:prepared.channel.company.revision,assignmentRevision:prepared.channel.company.assignmentRevision,grantDigest:companyKycGrantDigest(prepared.channel),issuerAuthorityDigest:digest(['company-kyc-issuer-v1',prepared.issuer,ids])}};
}
const descriptorKeys=['version','anchorProjectId','targetProjectId','ownerRevision','assignmentRevision','grantDigest','issuerAuthorityDigest'];
function challengeDescriptor(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join('|')!==descriptorKeys.sort().join('|')||value.version!==1||!workspaceId(value.anchorProjectId)||!workspaceId(value.targetProjectId)||!revision(value.ownerRevision)||!revision(value.assignmentRevision)||!hash(value.grantDigest)||!hash(value.issuerAuthorityDigest))fail();
 return value;
}
export function corporateKycSignedProof(initial,connection,environment){
 let marker;
 try{marker=JSON.parse(decryptCustomerSecret(initial.payload.encryptedProof,{organizationId:connection.organizationId,projectId:connection.projectId,purpose:'webhook-proof',resourceId:initial.id},environment)).companyRouting;}catch{fail('META_CUSTOMER_EVENT_PROOF_REQUIRED');}
 if(!marker)return null;
 const proof=decodeWorkerChannelProof(initial,connection,environment);
 if(proof.companyRouting.mode!=='COMPANY'||proof.companyRouting.contract!==COMPANY_CHANNEL_SCHEMA_CONTRACT)fail();
 return proof;
}
const projectionRow=async(client,sourceEventId,organizationId)=>(await client.query('SELECT id,"actorId","entityId",metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND action=\'participant.kyc_chat.projected\' AND "entityType"=\'Worker\'',[companyKycProjectionId(sourceEventId),organizationId])).rows;
async function readProjection(client,sourceEventId,organizationId){
 const rows=await projectionRow(client,sourceEventId,organizationId);
 if(rows.length!==1)fail();
 const p=companyKycProjectionContract(rows[0].metadata,{sourceEventId,organizationId});
 if(rows[0].actorId!==(p.participantActorId||p.issuerActorId)||rows[0].entityId!==p.workerId)fail();
 return p;
}
function checkedLease(event,context,now){
 if(!event||event.projectId!==context.projectId||event.payload?.channelId!==context.channelId||event.payload.payloadDigest!==context.payloadDigest||event.status!=='PENDING'||event.leaseToken!==context.leaseToken||!Number.isFinite(Date.parse(event.leaseExpiresAt))||Date.parse(event.leaseExpiresAt)<=now.getTime())fail('META_CUSTOMER_INBOX_LEASE_CHANGED');
}
function checkedTime(r,context,now,event=r.event){
 if(!(now instanceof Date)||!Number.isFinite(now.getTime()))fail('META_KYC_COMPANY_AUTHORITY_CHANGED');
 checkedLease(event,context,now);
 if(!customerChannelActive(r.connection,now.getTime())||r.connection.metadata?.developmentPilot)fail('META_KYC_CHALLENGE_REVOKED');
 if(!Number.isFinite(Date.parse(r.challenge.expiresAt))||Date.parse(r.challenge.expiresAt)<=now.getTime()||r.challenge.claimedAt!==undefined&&(!Number.isFinite(Date.parse(r.challenge.claimedAt))||Date.parse(r.challenge.claimedAt)+META_KYC_CONVERSATION_TTL_MS<=now.getTime()))fail('META_KYC_CHALLENGE_EXPIRED');
 // The reactive start button has its own shorter deadline. Retain it through
 // every resolve, claim commit, pre-send and outbound replay final clock.
 if(r.reactiveStartExpiresAt!==undefined&&(!Number.isFinite(Date.parse(r.reactiveStartExpiresAt))||Date.parse(r.reactiveStartExpiresAt)<=now.getTime()))fail('META_KYC_CHALLENGE_EXPIRED');
 const part=r.worker.metadata.participant;
 if(part.status==='INVITED'&&(!Number.isFinite(Date.parse(part.invitation.expiresAt))||Date.parse(part.invitation.expiresAt)<=now.getTime()))fail('META_KYC_CHALLENGE_REVOKED');
 assertCustomerReplyWindow(r.payload,now.getTime());
}
export async function fenceCompanyKycAuthority(client,r,context){
 if(!r.companyKyc)return;
 const rows=(await client.query('SELECT id,"projectId",payload,status::text AS status,"leaseToken","leaseExpiresAt",clock_timestamp() AS now FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND status=\'PENDING\' AND "leaseToken"=$3 FOR UPDATE',[r.event.id,r.connection.projectId,context.leaseToken])).rows;
 if(rows.length!==1)fail('META_CUSTOMER_INBOX_LEASE_CHANGED');
 // All current actor/assignment/grant rows are held. No await follows this clock.
 checkedTime(r,context,rows[0].now,rows[0]);
}
export async function resolveCompanyKycAuthority(client,context,{initial,firstChannel,payload,codeDigest,environment}){
 const proof=corporateKycSignedProof(initial,firstChannel,environment);
 if(!proof)return null;
 const selection=payload.value.interactive?.list_reply?.id||payload.value.interactive?.button_reply?.id;
 let pinned=null,prompt=null;
 const existing=await projectionRow(client,initial.id,firstChannel.organizationId);
 if(existing.length)pinned=await readProjection(client,initial.id,firstChannel.organizationId);
 else if(!codeDigest){
  const replyId=payload.value.context?.id;
  if(typeof replyId!=='string'){
   if(selection?.startsWith('kyc:'))fail('META_KYC_COMPANY_CONTEXT_REQUIRED');
   fail('META_KYC_NOT_APPLICABLE');
  }
  const rows=(await client.query('SELECT id,payload,outcome FROM public."WebhookEvent" WHERE "projectId"=$1 AND provider=\'meta-customer-outbound-v1\' AND payload->>\'channelId\'=$2 AND outcome->>\'messageId\'=$3',[firstChannel.projectId,firstChannel.id,replyId])).rows;
  if(rows.length!==1){if(selection?.startsWith('kyc:'))fail('META_KYC_COMPANY_CONTEXT_REQUIRED');fail('META_KYC_NOT_APPLICABLE');}
  const row=rows[0];
  let request;try{request=JSON.parse(decryptCustomerSecret(row.payload.encryptedPayload,{organizationId:firstChannel.organizationId,projectId:firstChannel.projectId,purpose:'outbound',resourceId:row.id},environment));}catch{fail();}
  if(request.channelPurpose!=='KYC_CAPTURE')fail('META_KYC_NOT_APPLICABLE');
  if(!['SENT','STATUS_OBSERVED'].includes(row.outcome?.state)||['failed','deleted'].includes(row.outcome?.providerStatus)||request.organizationId!==firstChannel.organizationId||request.channelId!==firstChannel.id||digest(request)!==row.payload.requestDigest)fail('META_KYC_COMPANY_CONTEXT_REQUIRED');
  pinned=await readProjection(client,request.eventId,firstChannel.organizationId);
  if(request.companyKycDigest!==companyKycProjectionDigest(pinned)||request.targetProjectId!==pinned.targetProjectId||request.challengeId!==pinned.challengeId||request.payloadDigest!==pinned.payloadDigest)fail();
  prompt={sourceEventId:request.eventId,message:request.message};
 }
 if(!await companyChannelSchemaReady(client))fail('COMPANY_CHANNEL_CATALOG_REQUIRED');
 const candidates=(await client.query('SELECT w.id,w."projectId",w.phone,w.active,w.metadata FROM public."Worker" w JOIN public."Project" p ON p.id=w."projectId" JOIN public."WhatsAppChannelProjectAssignment" a ON a."projectId"=p.id AND a."organizationId"=p."organizationId" WHERE a."connectionId"=$1 AND a."organizationId"=$2 AND a.status=\'ACTIVE\' AND p.status=\'ACTIVE\' AND w.active=true AND w.phone=$3 AND w.metadata->\'participant\'->\'kycChatChallenge\'->>\'connectionId\'=$1 AND '+(pinned?'w.id=$4 AND w."projectId"=$5':'w.metadata->\'participant\'->\'kycChatChallenge\'->>\'codeDigest\'=$4')+' LIMIT 2',pinned?[firstChannel.id,firstChannel.organizationId,'+'+payload.value.from,pinned.workerId,pinned.targetProjectId]:[firstChannel.id,firstChannel.organizationId,'+'+payload.value.from,codeDigest])).rows;
 if(candidates.length!==1)fail('META_KYC_CHALLENGE_REJECTED');
 const candidate=candidates[0],p0=candidate.metadata?.participant,c0=p0?.kycChatChallenge,d0=challengeDescriptor(c0?.companyKyc);
 if(d0.anchorProjectId!==firstChannel.projectId||d0.targetProjectId!==candidate.projectId)fail();
 let issuer=await principal(client,{actorId:c0.issuerActorId,membershipId:c0.issuerMembershipId,organizationId:firstChannel.organizationId},false);
 if(!['ADMIN','DIRECTOR'].includes(issuer.role))fail('META_KYC_CHALLENGE_REVOKED');
 let member=issuer;
 if(p0.status==='ACTIVE'){
  if(!p0.clerkUserId||p0.clerkUserId!==c0.participantClerkUserId)fail('META_KYC_CHALLENGE_REVOKED');
  member=await principal(client,{clerkUserId:p0.clerkUserId,organizationId:firstChannel.organizationId},false);
 }else if(p0.status!=='INVITED'||p0.clerkUserId||!c0.invitationId||p0.invitation?.id!==c0.invitationId||p0.invitation.state!=='SENT')fail('META_KYC_CHALLENGE_REVOKED');
 const expectedIssuer=issuer,expectedMember=member;
 for(const actor of [...new Map([issuer,member].map(p=>[p.actorId,p])).values()].sort((a,b)=>a.actorId.localeCompare(b.actorId))){
  const current=await principal(client,{actorId:actor.actorId,membershipId:actor.membershipId,organizationId:firstChannel.organizationId});
  if(digest(current)!==digest(actor))fail('META_KYC_COMPANY_AUTHORITY_CHANGED');
  if(actor.actorId===expectedIssuer.actorId)issuer=current;
  if(actor.actorId===expectedMember.actorId)member=current;
 }
 const organizations=(await client.query('SELECT id,metadata FROM public."Organization" WHERE id=$1 FOR SHARE',[firstChannel.organizationId])).rows;
 if(organizations.length!==1||organizations[0].metadata?.internal===true)fail('META_KYC_CHALLENGE_REVOKED');
 await lockPersonWorksiteJourney(client,member);
 const projects=new Map();
 for(const id of companyKycProjectLockIds(firstChannel.projectId,candidate.projectId)){
  const p=(await client.query('SELECT id,name,"organizationId",metadata FROM public."Project" WHERE id=$1 AND "organizationId"=$2 AND status=\'ACTIVE\' FOR UPDATE',[id,firstChannel.organizationId])).rows;
  if(p.length!==1)fail('META_KYC_CHALLENGE_REVOKED');projects.set(id,p[0]);
 }
 const connection=await companyConnectionForProject(client,firstChannel.organizationId,candidate.projectId,true);
 if(!connection||connection.id!==firstChannel.id||connection.projectId!==firstChannel.projectId||connection.company.mode!=='COMPANY'||connection.company.revision!==d0.ownerRevision||connection.company.assignmentRevision!==d0.assignmentRevision||companyKycGrantDigest(connection)!==d0.grantDigest||connection.metadata?.developmentPilot)fail('META_KYC_COMPANY_AUTHORITY_CHANGED');
 const assigned=p0.status==='ACTIVE'?(await client.query('SELECT id,to_char("updatedAt",\'YYYY-MM-DD"T"HH24:MI:SS.US\') AS revision FROM public."ProjectMembership" WHERE "projectId"=$1 AND "tenantMembershipId"=$2 AND status=\'ACTIVE\' FOR SHARE',[candidate.projectId,member.membershipId])).rows:null;
 if(assigned&&assigned.length!==1)fail('META_KYC_CHALLENGE_REVOKED');
 const workers=(await client.query('SELECT id,"projectId",phone,active,metadata,to_char("updatedAt",\'YYYY-MM-DD"T"HH24:MI:SS.US\') AS revision FROM public."Worker" WHERE id=$1 AND "projectId"=$2 FOR UPDATE',[candidate.id,candidate.projectId])).rows;
 if(workers.length!==1)fail('META_KYC_CHALLENGE_REVOKED');
 const worker=workers[0],part=worker.metadata?.participant,challenge=part?.kycChatChallenge;
 await assertCompanyKycInvitation(client,worker,firstChannel.organizationId);
 if(!worker.active||worker.phone!=='+'+payload.value.from||part?.version!==1||worker.metadata?.siteRegister?.version!==1||part.status!==p0.status||part.clerkUserId!==p0.clerkUserId||challenge?.id!==c0.id||challenge.version!==1||challenge.organizationId!==firstChannel.organizationId||challenge.projectId!==candidate.projectId||challenge.workerId!==worker.id||challenge.senderE164!==worker.phone||challenge.connectionId!==connection.id||challenge.wabaId!==connection.whatsappBusinessId||challenge.phoneNumberId!==connection.phoneNumberId||digest(challengeDescriptor(challenge.companyKyc))!==digest(d0))fail('META_KYC_CHALLENGE_REVOKED');
 const issuerTrail=await trail(client,firstChannel.organizationId,worker.id,[issuer.membershipId]);
 if(digest(['company-kyc-issuer-v1',issuer,issuerTrail])!==d0.issuerAuthorityDigest)fail('META_KYC_COMPANY_AUTHORITY_CHANGED');
 const accessTrail=await trail(client,firstChannel.organizationId,worker.id,[...new Set([issuer.membershipId,member.membershipId])]);
 const authorityDigest=digest(['company-kyc-authority-v1',issuer,part.status,part.clerkUserId||null,stable(part.invitation),member,assigned,accessTrail,worker.phone,d0,challenge.id]);
 const locked=(await client.query('SELECT id,"projectId",provider,"eventType","externalId",status::text AS status,payload,"leaseToken","leaseExpiresAt","createdAt" FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 FOR UPDATE',[context.eventId,connection.projectId])).rows;
 if(locked.length!==1)fail();
 const event=locked[0],now=(await client.query('SELECT clock_timestamp() AS now')).rows[0]?.now,finalPayload=decodeSignedCustomerEvent(event,connection,environment);
 if(digest(finalPayload)!==digest(payload)||digest(corporateKycSignedProof(event,connection,environment).companyRouting)!==digest(proof.companyRouting))fail();
 if(challenge.status==='PENDING'){if(!codeDigest||codeDigest!==challenge.codeDigest)fail('META_KYC_CHALLENGE_REJECTED');}
 else if(!['CLAIMED','COMPLETED'].includes(challenge.status)&&!(challenge.status==='CANCELLED'&&challenge.cancelledEventId===event.id)||codeDigest&&challenge.claimedEventId!==event.id)fail('META_KYC_CHALLENGE_REJECTED');
 const r={kind:'LIMITED_KYC_UPLOAD',member,issuer,project:projects.get(candidate.projectId),worker,challenge,connection,event,payload:finalPayload,now,prompt,source:{kind:'META_KYC_CHAT',eventId:event.id,payloadDigest:context.payloadDigest,challengeId:challenge.id,connectionId:connection.id,wabaId:connection.whatsappBusinessId,phoneNumberId:connection.phoneNumberId,senderE164:worker.phone}};
 checkedTime(r,context,now);
 const projection=companyKycProjectionContract({version:1,kind:COMPANY_KYC_PROJECTION_KIND,sourceEventId:event.id,payloadDigest:context.payloadDigest,organizationId:firstChannel.organizationId,connectionId:connection.id,anchorProjectId:connection.projectId,targetProjectId:r.project.id,workerId:worker.id,challengeId:challenge.id,ownerRevision:connection.company.revision,assignmentRevision:connection.company.assignmentRevision,grantDigest:d0.grantDigest,issuerActorId:issuer.actorId,issuerMembershipId:issuer.membershipId,authorityDigest,participantActorId:part.status==='ACTIVE'?member.actorId:null,participantMembershipId:part.status==='ACTIVE'?member.membershipId:null,participantClerkUserId:part.status==='ACTIVE'?member.clerkUserId:null});
 if(pinned){
  const current={...projection,sourceEventId:pinned.sourceEventId,payloadDigest:pinned.payloadDigest};
  if(companyKycProjectionDigest(current)!==companyKycProjectionDigest(pinned))fail('META_KYC_COMPANY_AUTHORITY_CHANGED');
 }
 const conflict=(await client.query('SELECT "sourceEventId" FROM public."WhatsAppCompanyEventRoute" WHERE "sourceEventId"=$1',[event.id])).rows;
 if(conflict.length)fail();
 if(existing.length===0)await client.query('INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,\'participant.kyc_chat.projected\',\'Worker\',$4,$5::jsonb)',[companyKycProjectionId(event.id),firstChannel.organizationId,member.actorId,worker.id,JSON.stringify(projection)]);
 r.companyKyc=projection;r.source.companyKyc=projection;
 return r;
}
export function assertCompanyKycPrompt(r){
 if(!r.companyKyc||r.challenge.status==='PENDING'||r.recorded||r.state?.confirmationEventId===r.event.id)return;
 if(!r.prompt||r.state?.lastEventId!==r.prompt.sourceEventId)fail('META_KYC_COMPANY_CONTEXT_REQUIRED');
 const selection=r.payload.value.interactive?.list_reply?.id||r.payload.value.interactive?.button_reply?.id;
 if(selection){
  const match=/^kyc:([a-f0-9]{20}):(\d{1,2})$/.exec(selection);
  const row=r.prompt.message?.sections?.flatMap(section=>section.rows||[]).find(row=>row.id===selection);
  if(!match||match[1]!==r.state.nonce||!r.state.choices?.[Number(match[2])]||!row)fail('META_KYC_COMPANY_CONTEXT_REQUIRED');
 }
}
export async function fencePreparedCompanyKycChallenge(client,member,projectId){
 const prepared=preparedChannels.get(client);
 if(!prepared)return;
 const rows=(await client.query('SELECT id,metadata FROM public."Worker" WHERE "projectId"=$1 AND metadata->\'participant\'->\'kycChatChallenge\'->>\'issuerActorId\'=$2 AND metadata->\'participant\'->\'kycChatChallenge\'->>\'connectionId\'=$3',[projectId,member.actorId,prepared.channel.id])).rows;
 const now=(await client.query('SELECT clock_timestamp() AS now')).rows[0]?.now;
 if(!(now instanceof Date)||!Number.isFinite(now.getTime())||!customerChannelActive(prepared.channel,now.getTime())||prepared.channel.metadata?.developmentPilot)fail('META_KYC_COMPANY_AUTHORITY_CHANGED');
 // Locked Project/Worker/issuer rows prevent revocation; time is checked last.
 const current=rows.find(row=>row.id===prepared.workerId),p=current?.metadata?.participant,c=p?.kycChatChallenge;
 if(!c||!Number.isFinite(Date.parse(c.expiresAt))||Date.parse(c.expiresAt)<=now.getTime()||p.status==='INVITED'&&(!Number.isFinite(Date.parse(p.invitation?.expiresAt))||Date.parse(p.invitation.expiresAt)<=now.getTime()))fail('META_KYC_CHALLENGE_EXPIRED');
}
export async function assertCompanyKycInvitation(client,worker,organizationId){
 const p=worker.metadata?.participant;
 if(p?.status!=='INVITED')return;
 const i=p.invitation;
 if(!i||i.state!=='SENT'||!/^orginv_[A-Za-z0-9]+$/.test(i.providerId||''))fail('META_KYC_CHALLENGE_REVOKED');
 const rows=(await client.query('SELECT id,"entityId",metadata FROM public."AuditLog" WHERE "organizationId"=$1 AND "entityType"=\'Worker\' AND "entityId"=$2 AND action=\'participant.operation.recorded\' AND metadata->>\'kind\'=\'INVITATION_SENT\' AND metadata->>\'invitationId\'=$3',[organizationId,worker.id,i.id])).rows;
 if(rows.length!==1||rows[0].metadata.projectId!==worker.projectId||rows[0].metadata.providerId!==i.providerId)fail('META_KYC_CHALLENGE_REVOKED');
}
// Only canonical Clerk invitation acceptance may attach an untouched challenge
// to its own account. A claimed source/projection is never re-attributed here.
export async function preparePendingCompanyKycAcceptance(client,{row,clerkUserId}){
 pendingAcceptances.delete(client);
 const p=row.metadata?.participant,c=p?.kycChatChallenge;
 if(p?.status!=='INVITED'||!c?.companyKyc||c.status!=='PENDING')return false;
 const phones=(await client.query('SELECT phone FROM public."Worker" WHERE id=$1 AND "projectId"=$2',[row.id,row.projectId])).rows;
 if(phones.length!==1||!/^\+[1-9]\d{7,14}$/.test(phones[0].phone||''))fail('META_KYC_CHALLENGE_REVOKED');
 row={...row,phone:phones[0].phone};
 const d=challengeDescriptor(c.companyKyc);
 if(!row.active||row.metadata?.siteRegister?.version!==1||p.version!==1||p.clerkUserId||c.version!==1||c.participantClerkUserId!==null||p.kyc?.status!=='NOT_SUBMITTED'||p.kyc.channelCapture||p.kycChatConversation||c.claimedAt!==undefined||c.claimedEventId!==undefined||c.messageCount!==undefined&&c.messageCount!==0||c.organizationId!==row.organizationId||c.projectId!==row.projectId||c.workerId!==row.id||c.senderE164!==row.phone||c.invitationId!==p.invitation?.id||p.invitation.state!=='SENT'||d.targetProjectId!==row.projectId||!/^user_[A-Za-z0-9]+$/.test(clerkUserId||''))fail('META_KYC_CHALLENGE_REVOKED');
 const issuer0=await principal(client,{actorId:c.issuerActorId,membershipId:c.issuerMembershipId,organizationId:row.organizationId},false);
 if(!['ADMIN','DIRECTOR'].includes(issuer0.role))fail('META_KYC_CHALLENGE_REVOKED');
 const own=(await client.query('SELECT id,"clerkUserId" FROM public."PlatformUser" WHERE "clerkUserId"=$1',[clerkUserId])).rows;
 if(own.length>1||own.length&&own[0].id===issuer0.actorId)fail('META_KYC_CHALLENGE_REVOKED');
 let issuer;
 for(const actorId of [...new Set([issuer0.actorId,...own.map(u=>u.id)])].sort()){
  if(actorId===issuer0.actorId){issuer=await principal(client,{actorId,membershipId:issuer0.membershipId,organizationId:row.organizationId});if(digest(issuer)!==digest(issuer0))fail('META_KYC_COMPANY_AUTHORITY_CHANGED');}
  else{
   const users=(await client.query('SELECT id,"clerkUserId" FROM public."PlatformUser" WHERE id=$1 FOR UPDATE',[actorId])).rows;
   if(users.length!==1||users[0].clerkUserId!==clerkUserId)fail('META_KYC_CHALLENGE_REVOKED');
   await client.query('SELECT id FROM public."TenantMembership" WHERE "userId"=$1 AND "organizationId"=$2 FOR UPDATE',[actorId,row.organizationId]);
  }
 }
 const org=(await client.query('SELECT id,metadata FROM public."Organization" WHERE id=$1 FOR SHARE',[row.organizationId])).rows;
 if(org.length!==1||org[0].metadata?.internal===true)fail('META_KYC_CHALLENGE_REVOKED');
 pendingAcceptances.set(client,{row:structuredClone(row),challenge:structuredClone(c),descriptor:{...d},issuer,clerkUserId});
 return true;
}
export async function lockPendingCompanyKycAcceptanceProjects(client,{actorId,membershipId}){
 const r=pendingAcceptances.get(client);if(!r)fail('META_KYC_COMPANY_AUTHORITY_CHANGED');
 const own=await principal(client,{actorId,membershipId,organizationId:r.row.organizationId});
 if(own.clerkUserId!==r.clerkUserId||own.role!=='AUDITOR'||own.clerkRole!=='org:member')fail('META_KYC_CHALLENGE_REVOKED');
 for(const member of [r.issuer,own].sort((a,b)=>a.actorId.localeCompare(b.actorId)))await lockPersonWorksiteJourney(client,member);
 for(const id of companyKycProjectLockIds(r.descriptor.anchorProjectId,r.row.projectId)){
  const projects=(await client.query('SELECT id FROM public."Project" WHERE id=$1 AND "organizationId"=$2 AND status=\'ACTIVE\' FOR UPDATE',[id,r.row.organizationId])).rows;
  if(projects.length!==1)fail('META_KYC_CHALLENGE_REVOKED');
 }
 const channel=await companyConnectionForProject(client,r.row.organizationId,r.row.projectId,true),d=r.descriptor,c=r.challenge;
 if(!channel||channel.id!==c.connectionId||channel.projectId!==d.anchorProjectId||channel.company.mode!=='COMPANY'||channel.company.revision!==d.ownerRevision||channel.company.assignmentRevision!==d.assignmentRevision||companyKycGrantDigest(channel)!==d.grantDigest||channel.whatsappBusinessId!==c.wabaId||channel.phoneNumberId!==c.phoneNumberId||channel.metadata?.credentialOrganizationId!==r.row.organizationId||channel.metadata?.developmentPilot)fail('META_KYC_COMPANY_AUTHORITY_CHANGED');
 const workers=(await client.query('SELECT id,"projectId",phone,active,metadata FROM public."Worker" WHERE id=$1 AND "projectId"=$2 FOR UPDATE',[r.row.id,r.row.projectId])).rows;
 if(workers.length!==1||pendingChallengeDigest(workers[0].metadata?.participant?.kycChatChallenge)!==pendingChallengeDigest(c)||digest(stable(workers[0].metadata?.participant))!==digest(stable(r.row.metadata.participant))||workers[0].phone!==r.row.phone||!workers[0].active)fail('META_KYC_COMPANY_AUTHORITY_CHANGED');
 await assertCompanyKycInvitation(client,workers[0],r.row.organizationId);
 const used=(await client.query('SELECT id FROM public."AuditLog" WHERE "organizationId"=$1 AND "entityType"=\'Worker\' AND "entityId"=$2 AND ((action IN (\'participant.kyc_chat.projected\',\'participant.kyc_chat.dispatched\') AND metadata->>\'challengeId\'=$3) OR (action=\'participant.operation.recorded\' AND metadata->>\'kind\'=\'KYC_SUBMITTED\' AND metadata->\'channelCapture\'->>\'challengeId\'=$3)) LIMIT 1',[r.row.organizationId,r.row.id,c.id])).rows;
 if(used.length)fail('META_KYC_COMPANY_AUTHORITY_CHANGED');
 const prepared=(await client.query('SELECT id,metadata FROM public."AuditLog" WHERE "organizationId"=$1 AND "actorId"=$2 AND "entityType"=\'Worker\' AND "entityId"=$3 AND action=\'participant.kyc_chat.prepared\' AND metadata->>\'challengeId\'=$4',[r.row.organizationId,r.issuer.actorId,r.row.id,c.id])).rows;
 if(prepared.length!==1||prepared[0].metadata?.version!==1||prepared[0].metadata.projectId!==r.row.projectId||prepared[0].metadata.expiresAt!==c.expiresAt||!hash(prepared[0].metadata.requestDigest))fail('META_KYC_CHALLENGE_REVOKED');
 const exterior=(await client.query('SELECT id,metadata FROM public."AuditLog" WHERE "organizationId"=$1 AND "actorId"=$2 AND "entityType"=\'Worker\' AND "entityId"=$3 AND action=\'participant.operation.recorded\' AND metadata->>\'kind\'=\'PREPARE_KYC_CHAT\' AND metadata->>\'challengeReceiptId\'=$4',[r.row.organizationId,r.issuer.actorId,r.row.id,prepared[0].id])).rows;
 if(exterior.length!==1||exterior[0].metadata?.version!==1||exterior[0].metadata.projectId!==r.row.projectId||exterior[0].metadata.expiresAt!==c.expiresAt||!hash(exterior[0].metadata.requestDigest))fail('META_KYC_CHALLENGE_REVOKED');
 const ids=await trail(client,r.row.organizationId,r.row.id,[r.issuer.membershipId]);
 if(digest(['company-kyc-issuer-v1',r.issuer,ids])!==d.issuerAuthorityDigest)fail('META_KYC_COMPANY_AUTHORITY_CHANGED');
 Object.assign(r,{own,channel,trail:ids});
}
export async function bindPendingCompanyKycAcceptance(client,{row,participant,actorId,clerkUserId,acceptanceReceiptId}){
 const r=pendingAcceptances.get(client);if(!r)return false;
 if(row.id!==r.row.id||row.projectId!==r.row.projectId||row.organizationId!==r.row.organizationId||actorId!==r.own.actorId||clerkUserId!==r.clerkUserId||participant.status!=='ACTIVE'||participant.clerkUserId!==clerkUserId||participant.invitation?.state!=='ACCEPTED'||participant.invitation.id!==r.challenge.invitationId||participant.acceptanceReceiptId!==acceptanceReceiptId||pendingChallengeDigest(participant.kycChatChallenge)!==pendingChallengeDigest(r.challenge))fail('META_KYC_CHALLENGE_REVOKED');
 const accepted=(await client.query('SELECT id,"actorId","entityId",metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "entityType"=\'Worker\' AND action=\'participant.operation.recorded\'',[acceptanceReceiptId,row.organizationId])).rows;
 if(accepted.length!==1||accepted[0].actorId!==actorId||accepted[0].entityId!==row.id||accepted[0].metadata?.version!==1||accepted[0].metadata.kind!=='INVITATION_ACCEPTED'||accepted[0].metadata.projectId!==row.projectId||accepted[0].metadata.invitationId!==r.challenge.invitationId||accepted[0].metadata.requestDigest!==digest([row.id,r.challenge.invitationId,clerkUserId,participant.invitation.email]))fail('META_KYC_CHALLENGE_REVOKED');
 const issuer=await principal(client,{actorId:r.issuer.actorId,membershipId:r.issuer.membershipId,organizationId:row.organizationId}),own=await principal(client,{actorId,membershipId:r.own.membershipId,organizationId:row.organizationId});
 if(digest(issuer)!==digest(r.issuer)||digest(own)!==digest(r.own))fail('META_KYC_COMPANY_AUTHORITY_CHANGED');
 const assigned=(await client.query('SELECT id FROM public."ProjectMembership" WHERE "projectId"=$1 AND "tenantMembershipId"=$2 AND status=\'ACTIVE\' FOR SHARE',[row.projectId,own.membershipId])).rows;
 if(assigned.length!==1)fail('META_KYC_CHALLENGE_REVOKED');
 const ids=await trail(client,row.organizationId,row.id,[issuer.membershipId]);
 if(r.trail.includes(acceptanceReceiptId)||digest(ids)!==digest([...r.trail,acceptanceReceiptId].sort()))fail('META_KYC_COMPANY_AUTHORITY_CHANGED');
 const updated={...r.challenge,participantClerkUserId:clerkUserId,companyKyc:{...r.descriptor,issuerAuthorityDigest:digest(['company-kyc-issuer-v1',issuer,ids])}},transitionId=acceptanceReceiptId+'_kyc_pending';
 const recordedAt=(await client.query('SELECT clock_timestamp() AS now')).rows[0]?.now;if(!(recordedAt instanceof Date)||!Number.isFinite(recordedAt.getTime()))fail('META_KYC_COMPANY_AUTHORITY_CHANGED');
 await client.query('INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,\'participant.kyc_chat.account_bound\',\'Worker\',$4,$5::jsonb)',[transitionId,row.organizationId,actorId,row.id,JSON.stringify({version:1,projectId:row.projectId,challengeId:r.challenge.id,invitationId:r.challenge.invitationId,acceptanceReceiptId,issuerActorId:issuer.actorId,issuerMembershipId:issuer.membershipId,participantActorId:own.actorId,participantMembershipId:own.membershipId,participantClerkUserId:clerkUserId,beforeChallengeDigest:pendingChallengeDigest(r.challenge),afterChallengeDigest:pendingChallengeDigest(updated),beforeIssuerAuthorityDigest:r.descriptor.issuerAuthorityDigest,afterIssuerAuthorityDigest:updated.companyKyc.issuerAuthorityDigest,recordedAt:recordedAt.toISOString(),identityCertified:false,permissionsGranted:false,whatsAppAccessGranted:false})]);
 participant.kycChatChallenge=updated;r.updated=updated;
 return true;
}
export async function fencePendingCompanyKycAcceptance(client){
 const r=pendingAcceptances.get(client);if(!r)return;
 if(!r.updated)fail('META_KYC_COMPANY_AUTHORITY_CHANGED');
 const now=(await client.query('SELECT clock_timestamp() AS now')).rows[0]?.now;
 // Principal, source, project, assignment, connection and worker locks remain
 // held; this last clock is after all writes and no await follows its checks.
 if(!(now instanceof Date)||!Number.isFinite(now.getTime())||!customerChannelActive(r.channel,now.getTime())||r.channel.metadata?.developmentPilot)fail('META_KYC_CHALLENGE_REVOKED');
 if(!Number.isFinite(Date.parse(r.updated.expiresAt))||Date.parse(r.updated.expiresAt)<=now.getTime()||!Number.isFinite(Date.parse(r.row.metadata.participant.invitation.expiresAt))||Date.parse(r.row.metadata.participant.invitation.expiresAt)<=now.getTime())fail('META_KYC_CHALLENGE_EXPIRED');
 pendingAcceptances.delete(client);
}
export async function assertCompanyKycImageSources(client,r,environment){
 if(!r.companyKyc)return;
 for(const reference of [r.state?.front,r.state?.selfie,...(r.challenge.captureImageSetVersion===2?[r.state?.back]:[])]){
  if(!reference||!event(reference.eventId))fail('META_KYC_DEPOSIT_REQUIRED');
  const p=await readProjection(client,reference.eventId,r.project.organizationId);
  const rows=(await client.query('SELECT * FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2',[reference.eventId,r.connection.projectId])).rows;
  if(rows.length!==1)fail();
  const payload=decodeSignedCustomerEvent(rows[0],r.connection,environment);
  const compare={...r.companyKyc,sourceEventId:p.sourceEventId,payloadDigest:p.payloadDigest};
  if(companyKycProjectionDigest(p)!==companyKycProjectionDigest(compare)||rows[0].payload.payloadDigest!==p.payloadDigest||payload.value.type!=='image'||payload.value.image?.id!==reference.mediaId||payload.value.image?.mime_type!==reference.contentType||'+'+payload.value.from!==r.worker.phone)fail();
 }
}
