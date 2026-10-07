import {WorkspaceError,workspaceId,digest,WORKSPACE_ROLES} from './workspace-policy.mjs';
import {companyWhatsappOnboardingEntitlement} from './company-entitlement.mjs';
import {PARTICIPANT_ONBOARDING_NOTICE_VERSION,PARTICIPANT_ONBOARDING_NOTICE_SHA256} from './participant-onboarding-policy.mjs';
import {prepareCompanyKycProjects,companyKycGrantDigest,assertCompanyKycInvitation} from './company-channel-kyc.mjs';
import {companyConnectionForProject} from './company-channel-connection.mjs';
import {companyChannelSchemaReady} from './company-channel-schema.mjs';
import {assertWorkerCustomerConnection} from './worker-channel-identity.mjs';
import {customerChannelActive} from './meta-customer-outbound.mjs';
import {lockPersonWorksiteJourney} from './person-worksite-journey.mjs';

const PURPOSE='PARTICIPANT_ONBOARDING';
const fail=(code='PARTICIPANT_ONBOARDING_AUTHORITY_CHANGED',status=409)=>{throw new WorkspaceError(code,status);};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const timestamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const stable=value=>Array.isArray(value)?value.map(stable):object(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const intentKeys=['organizationId','targetProjectId','workerId','invitationId','issuerActorId','issuerMembershipId','consentReceiptId'];
const consentKeys=['version','status','purpose','invitationId','senderE164','issuerActorId','issuerMembershipId','receiptId','recordedAt','noticeVersion','noticeSha256'];
const revision=`to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision`;

function checkedInput(intent,expected){
 if(!object(intent)||Object.keys(intent).sort().join('|')!==[...intentKeys].sort().join('|')||intentKeys.filter(key=>key!=='invitationId').some(key=>!workspaceId(intent[key]))||!/^invite_[a-f0-9]{32}$/.test(intent.invitationId||''))fail('PARTICIPANT_ONBOARDING_INPUT_INVALID',400);
 if(expected!==null&&(!object(expected)||!hash(expected.authorityDigest)||Object.keys(expected).some(key=>!['authorityDigest','challengeId'].includes(key))||expected.challengeId!==undefined&&!/^kyc_chat_[a-f0-9]{32}$/.test(expected.challengeId||'')))fail('PARTICIPANT_ONBOARDING_INPUT_INVALID',400);
}

async function principal(client,organizationId,{actorId=null,membershipId=null,clerkUserId=null}){
 const users=(await client.query(`SELECT id,"clerkUserId",${revision} FROM public."PlatformUser" WHERE ${actorId?'id=$1':'"clerkUserId"=$1'} FOR SHARE`,[actorId||clerkUserId])).rows;
 if(users.length!==1||!/^user_[A-Za-z0-9]+$/.test(users[0].clerkUserId||''))fail('PARTICIPANT_ONBOARDING_PRINCIPAL_REQUIRED',403);
 const u=users[0],members=(await client.query(`SELECT id AS "membershipId","userId" AS "actorId","organizationId","tenantRole"::text AS role,"clerkRole",${revision} FROM public."TenantMembership" WHERE "userId"=$1 AND "organizationId"=$2 AND status='ACTIVE'${membershipId?' AND id=$3':''} FOR SHARE`,membershipId?[u.id,organizationId,membershipId]:[u.id,organizationId])).rows;
 if(members.length!==1||!Object.hasOwn(WORKSPACE_ROLES,members[0].role)||!/^org:(admin|member)$/.test(members[0].clerkRole||''))fail('PARTICIPANT_ONBOARDING_PRINCIPAL_REQUIRED',403);
 return {...members[0],clerkUserId:u.clerkUserId,userRevision:u.revision};
}

async function consent(client,intent,worker){
 const c=worker.metadata?.participant?.onboardingConsent;
 if(!object(c)||Object.keys(c).sort().join('|')!==[...consentKeys].sort().join('|')||c.version!==1||c.status!=='GRANTED'||c.purpose!==PURPOSE||c.invitationId!==intent.invitationId||c.senderE164!==worker.phone||c.issuerActorId!==intent.issuerActorId||c.issuerMembershipId!==intent.issuerMembershipId||c.receiptId!==intent.consentReceiptId||!timestamp(c.recordedAt)||c.noticeVersion!==PARTICIPANT_ONBOARDING_NOTICE_VERSION||c.noticeSha256!==PARTICIPANT_ONBOARDING_NOTICE_SHA256)fail('PARTICIPANT_ONBOARDING_CONSENT_REQUIRED',403);
 const records=(await client.query(`SELECT id,"organizationId","actorId","entityType","entityId",metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND action='participant.onboarding.contact_authorized' AND "entityType"='Worker' AND "entityId"=$4 FOR SHARE`,[c.receiptId,intent.organizationId,intent.issuerActorId,worker.id])).rows;
 const record=records[0],m=record?.metadata;
 if(records.length!==1||record.entityId!==worker.id||record.entityType!=='Worker'||record.organizationId!==intent.organizationId||record.actorId!==intent.issuerActorId||!object(m)||Object.keys(m).sort().join('|')!==[...consentKeys,'organizationId','projectId'].sort().join('|')||m.organizationId!==intent.organizationId||m.projectId!==intent.targetProjectId||consentKeys.some(key=>m[key]!==c[key]))fail('PARTICIPANT_ONBOARDING_CONSENT_REQUIRED',403);
 return c;
}

async function participationProof(client,intent,worker,own){
 const p=worker.metadata.participant,i=p.invitation;
 const sent=(await client.query(`SELECT id,"actorId","entityId",metadata FROM public."AuditLog" WHERE "organizationId"=$1 AND "actorId"=$2 AND "entityType"='Worker' AND "entityId"=$3 AND action='participant.operation.recorded' AND metadata->>'kind'='INVITATION_SENT' AND metadata->>'invitationId'=$4 FOR SHARE`,[intent.organizationId,intent.issuerActorId,worker.id,i.id])).rows;
 if(sent.length!==1||sent[0].entityId!==worker.id||sent[0].actorId!==intent.issuerActorId||sent[0].metadata?.version!==1||sent[0].metadata.projectId!==intent.targetProjectId||sent[0].metadata.providerId!==i.providerId||!hash(i.requestDigest)||sent[0].metadata.requestDigest!==i.requestDigest||typeof i.email!=='string'||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.email))fail('PARTICIPANT_ONBOARDING_INVITATION_REQUIRED',403);
 if(p.status==='INVITED'){
  if(p.clerkUserId!==null&&p.clerkUserId!==undefined)fail('PARTICIPANT_ONBOARDING_INVITATION_REQUIRED',403);
  return {sentReceiptId:sent[0].id,acceptanceReceiptId:null,own:null,assignment:null};
 }
 if(!own||p.clerkUserId!==own.clerkUserId||!workspaceId(p.acceptanceReceiptId))fail('PARTICIPANT_ONBOARDING_ACCEPTANCE_REQUIRED',403);
 const assigned=(await client.query(`SELECT id,${revision} FROM public."ProjectMembership" WHERE "projectId"=$1 AND "tenantMembershipId"=$2 AND status='ACTIVE' FOR SHARE`,[intent.targetProjectId,own.membershipId])).rows;
 const accepted=(await client.query(`SELECT id,"actorId","entityId",metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND action='participant.operation.recorded' AND "entityType"='Worker' AND "entityId"=$4 FOR SHARE`,[p.acceptanceReceiptId,intent.organizationId,own.actorId,worker.id])).rows;
 const a=accepted[0];
 if(assigned.length!==1||accepted.length!==1||a.actorId!==own.actorId||a.entityId!==worker.id||a.metadata?.version!==1||a.metadata.kind!=='INVITATION_ACCEPTED'||a.metadata.projectId!==intent.targetProjectId||a.metadata.invitationId!==i.id||a.metadata.requestDigest!==digest([worker.id,i.id,own.clerkUserId,i.email]))fail('PARTICIPANT_ONBOARDING_ACCEPTANCE_REQUIRED',403);
 return {sentReceiptId:sent[0].id,acceptanceReceiptId:a.id,own,assignment:assigned[0]};
}

async function projectConnection(client,organizationId,targetProjectId){
 const corporate=await companyConnectionForProject(client,organizationId,targetProjectId,true);
 if(corporate){if(corporate.company.mode!=='COMPANY'||corporate.metadata?.developmentPilot)fail('PARTICIPANT_ONBOARDING_CHANNEL_REQUIRED',403);return corporate;}
 const ready=await companyChannelSchemaReady(client);
 if(!ready){const partial=(await client.query(`SELECT to_regclass('public."WhatsAppCompanyChannel"') IS NOT NULL AS present`)).rows[0]?.present;if(partial)fail('PARTICIPANT_ONBOARDING_CHANNEL_REQUIRED',403);}
 const rows=(await client.query(`SELECT id,"projectId","whatsappBusinessId","phoneNumberId",enabled,"connectionStatus"::text AS "connectionStatus","encryptedAccessToken",metadata,"displayPhoneNumber" FROM public."WhatsAppConnection" WHERE "projectId"=$1 FOR SHARE`,[targetProjectId])).rows;
 if(rows.length!==1)fail('PARTICIPANT_ONBOARDING_CHANNEL_REQUIRED',403);
 const connection={...rows[0],organizationId};
 // A revoked corporate assignment must never fall back to its legacy anchor.
 if(ready){const owners=(await client.query(`SELECT "connectionId","anchorProjectId",mode,revision FROM public."WhatsAppCompanyChannel" WHERE "connectionId"=$1 AND "organizationId"=$2 FOR SHARE`,[connection.id,organizationId])).rows;if(owners.length!==1||owners[0].connectionId!==connection.id||owners[0].mode!=='PROJECT_ONLY'||owners[0].anchorProjectId!==targetProjectId||!Number.isSafeInteger(owners[0].revision)||owners[0].revision<1)fail('PARTICIPANT_ONBOARDING_CHANNEL_REQUIRED',403);connection.projectOnlyOwner=owners[0];}
 if(connection.metadata?.companyRoutingVersion===1||connection.metadata?.developmentPilot)fail('PARTICIPANT_ONBOARDING_CHANNEL_REQUIRED',403);
 return connection;
}

function checkedChallenge(worker,member,connection,expected,now){
 const p=worker.metadata.participant,c=p.kycChatChallenge;
 if(!c){if(expected?.challengeId!==undefined)fail();return;}
 if(!['PENDING','CLAIMED'].includes(c.status)){
  if(expected?.challengeId!==undefined)fail();
  return;
 }
 if(c.status!=='PENDING'||c.id!==expected?.challengeId||c.version!==1||!hash(c.codeDigest)||c.organizationId!==member.organizationId||c.projectId!==worker.projectId||c.workerId!==worker.id||c.senderE164!==worker.phone||c.invitationId!==p.invitation.id||c.issuerActorId!==member.actorId||c.issuerMembershipId!==member.membershipId||c.connectionId!==connection.id||c.wabaId!==connection.whatsappBusinessId||c.phoneNumberId!==connection.phoneNumberId||c.participantClerkUserId!==(p.clerkUserId||null)||!timestamp(c.expiresAt)||Date.parse(c.expiresAt)<=now.getTime()||c.claimedAt!==undefined||c.claimedEventId!==undefined||c.messageCount!==undefined&&c.messageCount!==0||p.kycChatConversation)fail('PARTICIPANT_ONBOARDING_CHALLENGE_REQUIRED',409);
 if(connection.company){const d=c.companyKyc;if(d?.version!==1||d.anchorProjectId!==connection.projectId||d.targetProjectId!==worker.projectId||d.ownerRevision!==connection.company.revision||d.assignmentRevision!==connection.company.assignmentRevision||d.grantDigest!==companyKycGrantDigest(connection))fail();}
 else if(c.companyKyc!==undefined)fail();
}

async function challengeReceipt(client,intent,worker,expected){
 const c=worker.metadata.participant.kycChatChallenge;
 if(!c||c.id!==expected?.challengeId)return;
 const records=(await client.query(`SELECT id,"actorId","entityId",metadata FROM public."AuditLog" WHERE "organizationId"=$1 AND "actorId"=$2 AND "entityType"='Worker' AND "entityId"=$3 AND action='participant.kyc_chat.prepared' AND metadata->>'challengeId'=$4 FOR SHARE`,[intent.organizationId,intent.issuerActorId,worker.id,c.id])).rows;
 const row=records[0];
 if(records.length!==1||row.actorId!==intent.issuerActorId||row.entityId!==worker.id||row.metadata?.version!==1||row.metadata.projectId!==intent.targetProjectId||row.metadata.challengeId!==c.id||row.metadata.expiresAt!==c.expiresAt||!hash(row.metadata.requestDigest))fail('PARTICIPANT_ONBOARDING_CHALLENGE_REQUIRED',409);
}

async function kycRetryAuthority(client,intent,worker){
 const p=worker.metadata.participant,k=p.kyc,c=p.kycChatChallenge;
 if(k?.version!==1||!['NOT_SUBMITTED','REJECTED'].includes(k.status)||k.status==='NOT_SUBMITTED'&&(k.channelCapture||k.submissionId))fail('PARTICIPANT_ONBOARDING_KYC_ALREADY_SUBMITTED',409);
 if(k.status==='NOT_SUBMITTED')return {status:k.status};
 // A human rejection permits a fresh submission, never reopening its captured
 // challenge. Keep the old submission, review and capture untouched for audit.
 if(!workspaceId(k.submissionId)||!hash(k.contentHash)||k.review?.decision!=='REJECTED'||!workspaceId(k.review.actorId)||!timestamp(k.review.recordedAt)||['PENDING','CLAIMED'].includes(c?.status)&&k.channelCapture?.challengeId===c.id)fail('PARTICIPANT_ONBOARDING_KYC_REJECTION_REQUIRED',409);
 const reviews=(await client.query(`SELECT id,"actorId","entityId",metadata FROM public."AuditLog" WHERE "organizationId"=$1 AND "actorId"=$2 AND "entityType"='Worker' AND "entityId"=$3 AND action='participant.operation.recorded' AND metadata->>'projectId'=$4 AND metadata->>'kind'='REVIEW_KYC' AND metadata->>'submissionId'=$5 AND metadata->>'decision'='REJECTED' FOR SHARE`,[intent.organizationId,k.review.actorId,worker.id,intent.targetProjectId,k.submissionId])).rows;
 const r=reviews[0];
 if(reviews.length!==1||!workspaceId(r.id)||r.actorId!==k.review.actorId||r.entityId!==worker.id||r.metadata?.version!==1||r.metadata.projectId!==intent.targetProjectId||r.metadata.kind!=='REVIEW_KYC'||r.metadata.submissionId!==k.submissionId||r.metadata.decision!=='REJECTED'||r.metadata.reason!==k.review.reason)fail('PARTICIPANT_ONBOARDING_KYC_REJECTION_REQUIRED',409);
 return {status:k.status,submissionId:k.submissionId,contentHash:k.contentHash,review:k.review,reviewReceiptId:r.id,channelCapture:k.channelCapture||null};
}

/**
 * Canonical background onboarding authority. The caller owns the transaction.
 * It cannot accept a Clerk invitation, approve KYC, activate a channel or grant
 * operational messages. Re-run with the pinned digest immediately before send.
 */
export async function resolveParticipantOnboardingAuthority(client,intent,{environment=process.env,expected=null}={}){
 checkedInput(intent,expected);
 const member=await principal(client,intent.organizationId,{actorId:intent.issuerActorId,membershipId:intent.issuerMembershipId});
 if(!['ADMIN','DIRECTOR'].includes(member.role))fail('PARTICIPANT_MANAGE_REQUIRED',403);
 const organizations=(await client.query(`SELECT id,name,metadata,"subscriptionPlan"::text AS "subscriptionPlan","subscriptionStatus"::text AS "subscriptionStatus","trialEndsAt" FROM public."Organization" WHERE id=$1 FOR SHARE`,[intent.organizationId])).rows;
 if(organizations.length!==1||organizations[0].metadata?.internal===true||typeof organizations[0].name!=='string'||!organizations[0].name.trim())fail('PARTICIPANT_ONBOARDING_ORGANIZATION_REQUIRED',403);
 const organization=organizations[0];
 member.organizationName=organization.name;
 // Discovery supplies only a possible own-account lock, never authorization.
 const discovered=(await client.query(`SELECT id,"projectId",metadata FROM public."Worker" WHERE id=$1 AND "projectId"=$2`,[intent.workerId,intent.targetProjectId])).rows;
 if(discovered.length!==1)fail('PARTICIPANT_ONBOARDING_PARTICIPANT_REQUIRED',403);
 const own=discovered[0].metadata?.participant?.status==='ACTIVE'?await principal(client,intent.organizationId,{clerkUserId:discovered[0].metadata.participant.clerkUserId}):null;
 await lockPersonWorksiteJourney(client,member);
 // This canonical preflight discovers A, then locks sorted A/B before Worker B.
 // Do not call preparedCompanyKycChallenge: the owned PENDING code is allowed.
 await prepareCompanyKycProjects(client,member,{projectId:intent.targetProjectId});
 const projects=(await client.query(`SELECT id,name,"organizationId",metadata FROM public."Project" WHERE id=$1 AND "organizationId"=$2 AND status='ACTIVE' FOR UPDATE`,[intent.targetProjectId,intent.organizationId])).rows;
 if(projects.length!==1)fail('PARTICIPANT_ONBOARDING_PROJECT_REQUIRED',403);
 const project=projects[0],rows=(await client.query(`SELECT id,"projectId",name,phone,active,metadata,${revision} FROM public."Worker" WHERE id=$1 AND "projectId"=$2 FOR UPDATE`,[intent.workerId,project.id])).rows;
 const worker=rows[0],p=worker?.metadata?.participant,i=p?.invitation;
 if(rows.length!==1||!worker.active||worker.metadata?.siteRegister?.version!==1||p?.version!==1||!['INVITED','ACTIVE'].includes(p.status)||!/^\+[1-9]\d{7,14}$/.test(worker.phone||'')||!i||i.id!==intent.invitationId||i.createdBy!==member.actorId||!/^orginv_[A-Za-z0-9]+$/.test(i.providerId||'')||(p.status==='INVITED'?i.state!=='SENT':i.state!=='ACCEPTED'))fail('PARTICIPANT_ONBOARDING_PARTICIPANT_REQUIRED',403);
 const kycAuthority=await kycRetryAuthority(client,intent,worker);
 const proof=await participationProof(client,intent,worker,own),authorization=await consent(client,intent,worker);
 const connection=await projectConnection(client,intent.organizationId,project.id);
 if(connection.company)await assertCompanyKycInvitation(client,worker,intent.organizationId);
 const duplicate=(await client.query(connection.company?`SELECT w.id FROM public."Worker" w JOIN public."Project" p ON p.id=w."projectId" JOIN public."WhatsAppChannelProjectAssignment" a ON a."projectId"=p.id AND a."organizationId"=p."organizationId" WHERE a."connectionId"=$1 AND a."organizationId"=$2 AND a.status='ACTIVE' AND p.status='ACTIVE' AND w.active=true AND w.phone=$3 AND w.id<>$4 AND w.metadata->'participant'->>'status' IN ('INVITED','ACTIVE') LIMIT 1`:`SELECT id FROM public."Worker" WHERE "projectId"=$1 AND phone=$2 AND id<>$3 AND active=true AND metadata->'participant'->>'status' IN ('INVITED','ACTIVE') LIMIT 1`,connection.company?[connection.id,intent.organizationId,worker.phone,worker.id]:[project.id,worker.phone,worker.id])).rows;
 if(duplicate.length)fail('PARTICIPANT_ONBOARDING_RECIPIENT_AMBIGUOUS',409);
 await challengeReceipt(client,intent,worker,expected);
 const trail=(await client.query(`SELECT id FROM public."AuditLog" WHERE "organizationId"=$1 AND action='participant.operation.recorded' AND (("entityType"='Worker' AND "entityId"=$2 AND metadata->>'kind' IN ('REVOKE','RESTORE_ACCESS','EXISTING_ACCOUNT_ASSIGNED','INVITATION_ACCEPTED','INVITATION_SENT')) OR ("entityType"='TenantMembership' AND "entityId"=ANY($3::text[]) AND metadata->>'kind'='OFFICE_ROLE_CHANGED')) ORDER BY id LIMIT 1001`,[intent.organizationId,worker.id,[member.membershipId,...(own?[own.membershipId]:[])]] )).rows;
 if(trail.length>1000)fail();
 // All changing authority is locked. A fresh DB clock is the last query so a
 // trial, invitation or grant expiring during earlier reads rolls back send.
 const now=(await client.query('SELECT clock_timestamp() AS now')).rows[0]?.now;
 const entitlement=companyWhatsappOnboardingEntitlement(organization,{now});
 if(!entitlement.allowed)fail(entitlement.reasonCode,403);
 if(!(now instanceof Date)||!Number.isFinite(now.getTime())||p.status==='INVITED'&&(!timestamp(i.expiresAt)||Date.parse(i.expiresAt)<=now.getTime())||Date.parse(authorization.recordedAt)>now.getTime())fail('PARTICIPANT_ONBOARDING_INVITATION_EXPIRED',410);
 if(kycAuthority.review&&Date.parse(kycAuthority.review.recordedAt)>now.getTime())fail('PARTICIPANT_ONBOARDING_KYC_REJECTION_REQUIRED',409);
 assertWorkerCustomerConnection(connection,intent.organizationId,project.id,now.getTime(),{operational:true,environment});
 if(!customerChannelActive(connection,now.getTime(),{environment}))fail('PARTICIPANT_ONBOARDING_CHANNEL_REQUIRED',403);
 checkedChallenge(worker,member,connection,expected,now);
 const authorityDigest=digest(['participant-onboarding-authority-v1',stable({intent,member,projectId:project.id,worker:{id:worker.id,phone:worker.phone,status:p.status,clerkUserId:p.clerkUserId||null,invitation:i,kycAuthority},proof,consent:authorization,connection:{id:connection.id,anchorProjectId:connection.projectId,targetProjectId:project.id,wabaId:connection.whatsappBusinessId,phoneNumberId:connection.phoneNumberId,grantDigest:companyKycGrantDigest(connection),ownerRevision:connection.company?.revision||null,assignmentRevision:connection.company?.assignmentRevision||null,projectOnlyOwner:connection.projectOnlyOwner||null},subscription:{plan:organization.subscriptionPlan,status:organization.subscriptionStatus,trialEndsAt:organization.trialEndsAt instanceof Date?organization.trialEndsAt.toISOString():organization.trialEndsAt},trail:trail.map(row=>row.id)})]);
 if(expected&&expected.authorityDigest!==authorityDigest)fail();
 return {member,project,worker,connection,now,entitlement,authorityDigest,company:Boolean(connection.company)};
}
