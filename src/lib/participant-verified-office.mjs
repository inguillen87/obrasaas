import {randomUUID} from 'node:crypto';
import {WorkspaceError,workspaceId,operationId,digest} from './workspace-policy.mjs';

export const VERIFIED_OFFICE_ACTION='ASSIGN_VERIFIED_OFFICE';
const fail=(code,status=409)=>{throw new WorkspaceError(code,status);};
const keys=(value,expected)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...expected].sort().join('|');
const canonicalEmail=value=>typeof value==='string'&&value.length<=254&&value.isWellFormed()&&!/[\u0000-\u001f\u007f-\u009f]/.test(value)&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)&&value===value.trim().toLowerCase();
export const participantOfficeAssignmentRequestDigest=input=>digest(['participant-verified-office-assignment-v1',input.operationId,input.projectId,input.scope,VERIFIED_OFFICE_ACTION,input.payload.email,input.payload.clerkUserId,input.payload.expectedProofDigest,input.payload.role,input.payload.reason,input.payload.confirmOfficePermissions]);
export function participantVerifiedOfficeEmail(value){
 if(typeof value!=='string'||value.length>254||!value.isWellFormed()||/[\u0000-\u001f\u007f-\u009f]/.test(value)||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))fail('PARTICIPANT_INPUT_INVALID',400);
 return value.trim().toLowerCase();
}
export function participantVerifiedOfficeRequest(input){
 if(!keys(input,['projectId','scope','email'])||!workspaceId(input.projectId)||!/^[a-f0-9]{64}$/.test(input.scope||''))fail('PARTICIPANT_INPUT_INVALID',400);
 return {...input,email:participantVerifiedOfficeEmail(input.email)};
}
export function assertVerifiedOfficeIssuer(member,session){
 if(member.role!=='ADMIN'||session.organizationRole!=='org:admin'||member.clerkRole!=='org:admin'||member.officeReviewOnly===true)fail('WORKSPACE_ORGANIZATION_PERMISSION_REQUIRED',403);
}
export function participantVerifiedOfficeProof(account,member,session,context){
 if(!account||! /^user_[A-Za-z0-9]+$/.test(account.clerkUserId||'')||account.clerkRole!=='org:member'||! /^orgmem_[A-Za-z0-9]+$/.test(account.providerMembershipId||'')||!Number.isSafeInteger(account.providerMembershipUpdatedAt)||account.providerMembershipUpdatedAt<0||!Number.isSafeInteger(account.userUpdatedAt)||account.userUpdatedAt<0||typeof account.emailAddressId!=='string'||!account.emailAddressId||typeof account.primaryEmailAddressId!=='string'||!account.primaryEmailAddressId||!canonicalEmail(account.email)||!canonicalEmail(account.primaryEmail)||typeof account.name!=='string'||!account.name.trim()||account.name.length>200||/[\u0000-\u001f\u007f-\u009f]/.test(account.name))fail('PARTICIPANT_IDENTITY_PROVIDER_UNAVAILABLE',503);
 return digest(['participant-verified-office-proof-v1',member.actorId,member.membershipId,member.organizationId,session.organizationId,context.projectId,context.scope,account.clerkUserId,account.email,account.primaryEmail,account.clerkRole,account.providerMembershipId,account.providerMembershipUpdatedAt,account.userUpdatedAt,account.emailAddressId,account.primaryEmailAddressId]);
}
export async function assertNewVerifiedOfficeTarget(client,member,session,proof,{lock=false}={}){
 if(proof.clerkUserId===session.userId)fail('PARTICIPANT_OFFICE_TARGET_PROTECTED',403);
 const found=(await client.query(`SELECT id,"clerkUserId","primaryEmail","systemRole"::text AS "systemRole" FROM public."PlatformUser" WHERE "clerkUserId"=$1 OR lower(btrim("primaryEmail"))=ANY($2::text[]) ORDER BY id`,[proof.clerkUserId,[proof.email,proof.primaryEmail]])).rows;
 if(found.some(row=>row.clerkUserId!==proof.clerkUserId)||found.filter(row=>row.clerkUserId===proof.clerkUserId).length>1)fail('PARTICIPANT_IDENTITY_CONFLICT');
 let user=found.find(row=>row.clerkUserId===proof.clerkUserId)||null;
 if(user&&(user.systemRole!=='TENANT_USER'||user.id===member.actorId))fail('PARTICIPANT_OFFICE_TARGET_PROTECTED',403);
 if(user&&(typeof user.primaryEmail!=='string'||user.primaryEmail.toLowerCase()!==proof.primaryEmail))fail('PARTICIPANT_IDENTITY_CONFLICT');
 // Reject before target locks: an existing protected membership must never
 // cause two issuers to upgrade each other's canonical identity SHARE locks.
 if(user&&(await client.query(`SELECT id FROM public."TenantMembership" WHERE "organizationId"=$1 AND "userId"=$2`,[member.organizationId,user.id])).rows.length)fail('PARTICIPANT_OFFICE_ACCOUNT_EXISTS');
 if(lock&&user){
  // This account is preserved, never updated. SHARE fixes its identity/contact
  // while remaining compatible with another company's issuer identity lock.
  const current=(await client.query(`SELECT id,"clerkUserId","primaryEmail","systemRole"::text AS "systemRole" FROM public."PlatformUser" WHERE id=$1 AND "clerkUserId"=$2 FOR SHARE`,[user.id,proof.clerkUserId])).rows;
  if(current.length!==1||current[0].systemRole!=='TENANT_USER'||current[0].primaryEmail!==user.primaryEmail)fail('PARTICIPANT_OFFICE_PROOF_CHANGED');user=current[0];
  if((await client.query(`SELECT id FROM public."TenantMembership" WHERE "organizationId"=$1 AND "userId"=$2`,[member.organizationId,user.id])).rows.length)fail('PARTICIPANT_OFFICE_ACCOUNT_EXISTS');
 }
 const field=(await client.query(`SELECT w.id FROM public."Worker" w JOIN public."Project" p ON p.id=w."projectId" WHERE p."organizationId"=$1 AND w.metadata->'participant'->>'clerkUserId'=$2 LIMIT 1`,[member.organizationId,proof.clerkUserId])).rows;
 if(field.length)fail('PARTICIPANT_OFFICE_ACCOUNT_FIELD_BOUND');
 if(user){
  const origins=(await client.query(`SELECT a.action,a.metadata FROM public."AuditLog" a WHERE a."organizationId"=$1 AND ((a.action='participant.operation.recorded' AND ((a."actorId"=$2 AND a.metadata->>'kind'='INVITATION_ACCEPTED') OR (a.metadata->>'kind'='EXISTING_ACCOUNT_ASSIGNED' AND (a.metadata->>'targetClerkUserId'=$3 OR EXISTS(SELECT 1 FROM public."TenantMembership" tm WHERE tm.id=a.metadata->>'membershipId' AND tm."userId"=$2 AND tm."organizationId"=$1))))) OR (a.action='office.review.accepted' AND a."actorId"=$2)) LIMIT 1`,[member.organizationId,user.id,proof.clerkUserId])).rows;
  if(origins.length)fail(origins[0].action==='office.review.accepted'?'PARTICIPANT_OFFICE_ACCOUNT_RESTRICTED':'PARTICIPANT_OFFICE_ACCOUNT_FIELD_BOUND');
 }
 const orphan=(await client.query(`SELECT a.id FROM public."AuditLog" a WHERE a."organizationId"=$1 AND a.action='participant.operation.recorded' AND a.metadata->>'kind'='EXISTING_ACCOUNT_ASSIGNED' AND NOT EXISTS(SELECT 1 FROM public."TenantMembership" tm WHERE tm.id=a.metadata->>'membershipId' AND tm."organizationId"=$1) LIMIT 1`,[member.organizationId])).rows;
 if(orphan.length)fail('PARTICIPANT_OFFICE_HISTORY_UNCONFIRMED');
 return user;
}
export async function createNewVerifiedOfficeAccount(client,member,session,input,proof){
 for(const key of [...new Set(['participant-user:'+proof.clerkUserId,'participant-email:'+proof.primaryEmail,'participant-email:'+proof.email])].sort())await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[key]);
 let user=await assertNewVerifiedOfficeTarget(client,member,session,proof,{lock:true});
 if(!user){user={id:'user_'+randomUUID().replaceAll('-','')};await client.query(`INSERT INTO public."PlatformUser"(id,"clerkUserId","primaryEmail","fullName","systemRole","updatedAt") VALUES($1,$2,$3,$4,'TENANT_USER',clock_timestamp())`,[user.id,proof.clerkUserId,proof.primaryEmail,proof.name]);}
 const membershipId='member_'+randomUUID().replaceAll('-','');
 await client.query(`INSERT INTO public."TenantMembership"(id,"organizationId","userId","clerkRole","tenantRole",status,"updatedAt") VALUES($1,$2,$3,'org:member',$4::"TenantRole",'ACTIVE',clock_timestamp())`,[membershipId,member.organizationId,user.id,input.payload.role]);
 const assignedProjectId=input.payload.role==='DIRECTOR'?null:input.projectId;
 const project=(await client.query(`SELECT id FROM public."Project" WHERE id=$1 AND "organizationId"=$2 AND status='ACTIVE' FOR UPDATE`,[input.projectId,member.organizationId])).rows;
 if(project.length!==1)fail('WORKSPACE_PROJECT_UNAVAILABLE',404);
 if(assignedProjectId){
  await client.query(`INSERT INTO public."ProjectMembership"(id,"projectId","tenantMembershipId",status,"updatedAt") VALUES($1,$2,$3,'ACTIVE',clock_timestamp())`,['projectmember_'+randomUUID().replaceAll('-',''),assignedProjectId,membershipId]);
 }
 return {membershipId,assignedProjectId};
}
export function participantOfficeAssignmentReceipt(found,{projectId,scope,operationId:op}){
 const m=found?.metadata;
 if(found?.entityType!=='TenantMembership'||! /^participant_[a-f0-9]{64}$/.test(found?.id||'')||m?.version!==1||m.kind!=='VERIFIED_OFFICE_ASSIGNED'||m.projectId!==projectId||m.scope!==scope||m.operationId!==op||!operationId(op)||!workspaceId(found.entityId)||! /^user_[A-Za-z0-9]+$/.test(m.targetClerkUserId||'')||!['DIRECTOR','SITE_MANAGER','FINANCE','AUDITOR'].includes(m.role)||!canonicalEmail(m.email)||m.assignedProjectId!==(m.role==='DIRECTOR'?null:projectId)||! /^[a-f0-9]{64}$/.test(m.proofDigest||'')||typeof m.recordedAt!=='string'||! /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(m.recordedAt)||!Number.isFinite(Date.parse(m.recordedAt))||new Date(m.recordedAt).toISOString()!==m.recordedAt||m.identityCertified!==false||m.fieldPermissionsGranted!==false)fail('PARTICIPANT_OFFICE_RECEIPT_INVALID');
 if(typeof m.reason!=='string'||m.reason.trim()!==m.reason||m.reason.length<8||m.reason.length>800||/[\u0000-\u001f\u007f<>]/.test(m.reason)||m.requestDigest!==participantOfficeAssignmentRequestDigest({operationId:op,projectId,scope,payload:{email:m.email,clerkUserId:m.targetClerkUserId,expectedProofDigest:m.proofDigest,role:m.role,reason:m.reason,confirmOfficePermissions:true}}))fail('PARTICIPANT_OFFICE_RECEIPT_INVALID');
 return {version:1,operationId:op,action:VERIFIED_OFFICE_ACTION,projectId,scope,receiptId:found.id,membershipId:found.entityId,clerkUserId:m.targetClerkUserId,email:m.email,role:m.role,assignedProjectId:m.assignedProjectId,recordedAt:m.recordedAt,proofDigest:m.proofDigest,identityCertified:false,fieldPermissionsGranted:false};
}
