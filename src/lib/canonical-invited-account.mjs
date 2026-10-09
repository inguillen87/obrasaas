import {randomUUID} from 'node:crypto';
import {WorkspaceError} from './workspace-policy.mjs';

// Shared by verified Clerk invitation acceptance. Never callable from browser
// claims: the caller must first verify the invitation, email and membership.
export async function joinCanonicalInvitedAccount(client,row,session,primaryEmail,email){
 let user=(await client.query(`SELECT id,"clerkUserId" FROM public."PlatformUser" WHERE "clerkUserId"=$1 FOR UPDATE`,[session.userId])).rows[0];
 const clash=(await client.query(`SELECT id,"clerkUserId" FROM public."PlatformUser" WHERE lower("primaryEmail")=lower($1) OR lower("primaryEmail")=lower($2)`,[primaryEmail,email])).rows;
 if(!user&&clash.some(item=>item.clerkUserId!==session.userId))throw new WorkspaceError('PARTICIPANT_IDENTITY_CONFLICT',409);
 if(!user){user={id:'user_'+randomUUID().replaceAll('-','')};await client.query(`INSERT INTO public."PlatformUser"(id,"clerkUserId","primaryEmail","systemRole","updatedAt") VALUES($1,$2,$3,'TENANT_USER',clock_timestamp())`,[user.id,session.userId,primaryEmail]);}
 let member=(await client.query(`SELECT id,status,"tenantRole"::text AS role,"clerkRole" FROM public."TenantMembership" WHERE "organizationId"=$1 AND "userId"=$2 FOR UPDATE`,[row.organizationId,user.id])).rows[0];
 if(member&&(member.status!=='ACTIVE'||member.role!=='AUDITOR'))throw new WorkspaceError('PARTICIPANT_MEMBERSHIP_REVIEW_REQUIRED',409);
 if(!member){member={id:'member_'+randomUUID().replaceAll('-',''),clerkRole:'org:member'};await client.query(`INSERT INTO public."TenantMembership"(id,"organizationId","userId","clerkRole","tenantRole",status,"updatedAt") VALUES($1,$2,$3,'org:member','AUDITOR','ACTIVE',clock_timestamp())`,[member.id,row.organizationId,user.id]);}
 return {user,member};
}
