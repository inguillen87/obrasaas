import {randomUUID} from 'node:crypto';
import {WorkspaceError,operationId,workspaceId,WORKSPACE_ROLES,portfolioAccess,digest} from './workspace-policy.mjs';
import {IDENTITY_ISSUER} from './production-identity-config.mjs';
import {requireNewCompanyAdmin,normalizeCompanyOnboarding,bootstrapReceiptId,bootstrapRequestDigest,validProfileEmail} from './company-onboarding-policy.mjs';
const identifier=prefix=>prefix+'_'+randomUUID().replaceAll('-','');
const canonicalCompany=async(client,session,lock=false)=>(await client.query(`SELECT id,name,metadata FROM public."Organization" WHERE "clerkOrganizationId"=$1 ${lock?'FOR UPDATE':''}`,[session.organizationId])).rows[0];
export function createCompanyOnboardingStore({connect}){
 async function transaction(session,writable,run){
  requireNewCompanyAdmin(session);let client,broken=false;
  try{
   client=await connect();await client.query(writable?'BEGIN ISOLATION LEVEL READ COMMITTED':'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
   await client.query("SET LOCAL statement_timeout='8s'");await client.query("SET LOCAL lock_timeout='3s'");
   if(writable){for(const key of ['company-bootstrap-user:'+session.userId,'company-bootstrap-org:'+session.organizationId].sort())await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[key]);}
   const result=await run(client);await client.query(writable?'COMMIT':'ROLLBACK');return result;
  }catch(error){if(client)try{await client.query('ROLLBACK');}catch{broken=true;}
   if(error instanceof WorkspaceError)throw error;
   if(error?.code==='23505'||error?.code==='23502'&&error.table==='PlatformUser'&&error.column==='primaryEmail')throw new WorkspaceError('COMPANY_IDENTITY_CONFLICT',409);
   throw new WorkspaceError('COMPANY_CREATION_UNCONFIRMED',503);
  }finally{client?.release(broken);}
 }
 async function access(client,session,organization,lock=false,adminOnly=true){
  if([true,'true'].includes(organization.metadata?.internal))throw new WorkspaceError('COMPANY_ALREADY_LINKED',403);
  const result=await client.query(`SELECT u.id AS "actorId",m.id AS "membershipId",m."tenantRole"::text AS role
   FROM public."PlatformUser" u JOIN public."TenantMembership" m ON m."userId"=u.id
   WHERE u."clerkUserId"=$1 AND m."organizationId"=$2 AND m."clerkRole"=$3 AND m.status='ACTIVE' ${lock?'FOR SHARE OF u,m':''}`,[session.userId,organization.id,session.organizationRole]);
  if(result.rows.length!==1||(adminOnly?result.rows[0].role!=='ADMIN':!Object.hasOwn(WORKSPACE_ROLES,result.rows[0].role)))throw new WorkspaceError('WORKSPACE_MEMBERSHIP_REQUIRED',403);return result.rows[0];
 }
 async function receipt(client,session,id,member){return (await client.query(`SELECT a.id,a."organizationId",a.metadata
   FROM public."AuditLog" a JOIN public."PlatformUser" u ON u.id=a."actorId"
   JOIN public."Organization" o ON o.id=a."organizationId"
   JOIN public."TenantMembership" m ON m."organizationId"=o.id AND m."userId"=u.id AND m.status='ACTIVE' AND m."clerkRole"=$4 AND m.id=$5
   JOIN public."Project" p ON p.id=a.metadata->>'projectId' AND p."organizationId"=o.id AND p.status='ACTIVE'
   WHERE a.id=$1 AND a.action='company.self_service.created' AND a."entityType"='Organization' AND a."entityId"=o.id AND u."clerkUserId"=$2 AND o."clerkOrganizationId"=$3
   AND ($6::boolean OR EXISTS(SELECT 1 FROM public."ProjectMembership" pm WHERE pm."projectId"=p.id AND pm."tenantMembershipId"=m.id AND pm.status='ACTIVE'))`,[id,session.userId,session.organizationId,session.organizationRole,member.membershipId,portfolioAccess(member.role)])).rows[0];}
 const usableReceipt=row=>row?.metadata?.version===1&&workspaceId(row.metadata.projectId)&&typeof row.metadata.companyName==='string'&&typeof row.metadata.projectName==='string'&&Array.isArray(row.metadata.taskIds)&&row.metadata.taskIds.length<=25&&row.metadata.taskIds.every(workspaceId);
 const publicResult=(row,replayed)=>({state:'CREATED',created:true,replayed,receiptId:row.id,organizationId:row.organizationId,projectId:row.metadata.projectId,
   companyName:row.metadata.companyName,projectName:row.metadata.projectName,initialTaskCount:row.metadata.taskIds.length,whatsAppConnected:false,employeesCreated:0,financialRecordsCreated:0});
 return {
  status(session,{operationId:key}={}){
   if(key!==undefined&&!operationId(key))throw new WorkspaceError('COMPANY_ONBOARDING_INPUT_INVALID');
   return transaction(session,false,async client=>{
    const org=await canonicalCompany(client,session);
    if(!org)return {state:'NOT_CREATED',canCreate:true,whatsAppConnected:false};
    const member=await access(client,session,org,false,false);
    // The existing canonical pointer survives a page reload. It is not proof of
    // authorship: the audit lookup still checks the current actor and tenant.
    const pointer=key?bootstrapReceiptId(session,key):org.metadata?.onboarding?.operationReceiptId;
    if(typeof pointer==='string'&&/^company_bootstrap_[a-f0-9]{64}$/.test(pointer)){const found=await receipt(client,session,pointer,member);if(usableReceipt(found))return publicResult(found,true);}
    return {state:'ALREADY_CONFIGURED',canCreate:false,organizationId:org.id,companyName:org.name,whatsAppConnected:false};
   });
  },
  async create(session,input,profile){
   const command=normalizeCompanyOnboarding(input,session);
   if(profile?.verified!==true||profile.proofType!=='clerk-signed-bootstrap-profile'||profile.userId!==session.userId||!validProfileEmail(profile.primaryEmail))throw new WorkspaceError('COMPANY_VERIFIED_PROFILE_REQUIRED',403);
   return transaction(session,true,async client=>{
    const id=bootstrapReceiptId(session,command.operationId),requestDigest=bootstrapRequestDigest(command);
    const org=await canonicalCompany(client,session,true);
    if(org){
     const member=await access(client,session,org,true);const previous=await receipt(client,session,id,member);
     if(!previous)throw new WorkspaceError('COMPANY_ALREADY_CONFIGURED',409);
     if(previous.metadata.requestDigest!==requestDigest)throw new WorkspaceError('COMPANY_CREATION_OPERATION_CONFLICT',409);
     return publicResult(previous,true);
    }
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['company-bootstrap-email:'+profile.primaryEmail.toLowerCase()]);
    let actor=(await client.query('SELECT id,"clerkUserId","primaryEmail" FROM public."PlatformUser" WHERE "clerkUserId"=$1 FOR UPDATE',[session.userId])).rows[0];
    const clash=(await client.query('SELECT id,"clerkUserId" FROM public."PlatformUser" WHERE lower("primaryEmail")=lower($1)',[profile.primaryEmail])).rows;
    // Email is contact information, never a key for adopting another actor.
    // A new verified subject can omit an occupied contact while the historical
    // actor, its contact, roles and memberships remain untouched.
    const email=profile.primaryEmail.toLowerCase(),occupied=clash.some(user=>user.clerkUserId!==session.userId);
    if(!actor){actor={id:identifier('user'),primaryEmail:occupied?null:email};await client.query(`INSERT INTO public."PlatformUser"(id,"clerkUserId","primaryEmail","systemRole","updatedAt") VALUES($1,$2,$3,'TENANT_USER',clock_timestamp())`,[actor.id,session.userId,actor.primaryEmail]);}
    const recent=(await client.query(`SELECT count(*)::int AS n FROM public."AuditLog" WHERE "actorId"=$1 AND action='company.self_service.created' AND "createdAt">CURRENT_TIMESTAMP-interval '24 hours'`,[actor.id])).rows[0].n;
    if(recent>=3)throw new WorkspaceError('COMPANY_CREATION_LIMIT',429);
    const organizationId=identifier('org'),projectId=identifier('project'),membershipId=identifier('member'),taskIds=[];
    await client.query(`INSERT INTO public."Organization"(id,name,slug,"clerkOrganizationId",country,timezone,metadata,"updatedAt","trialEndsAt")
     VALUES($1,$2,$1,$3,'AR','America/Argentina/Buenos_Aires',$4::jsonb,clock_timestamp(),CURRENT_TIMESTAMP+interval '14 days')`,
     [organizationId,command.companyName,session.organizationId,JSON.stringify({onboarding:{version:1,source:'customer-self-service',operationReceiptId:id,companyIdentityVerified:false}})]);
    await client.query(`INSERT INTO public."TenantMembership"(id,"organizationId","userId","clerkRole","tenantRole",status,"updatedAt") VALUES($1,$2,$3,'org:admin','ADMIN','ACTIVE',clock_timestamp())`,[membershipId,organizationId,actor.id]);
    await client.query(`INSERT INTO public."Project"(id,"organizationId",name,slug,status,address,metadata,"updatedAt") VALUES($1,$2,$3,$1,'ACTIVE',$4,$5::jsonb,clock_timestamp())`,
     [projectId,organizationId,command.project.name,command.project.address,JSON.stringify({onboarding:{version:1,source:'customer-self-service',locationVerified:false,emptyOperationalData:true}})]);
    await client.query(`INSERT INTO public."ProjectMembership"(id,"projectId","tenantMembershipId",status,"updatedAt") VALUES($1,$2,$3,'ACTIVE',clock_timestamp())`,[identifier('projectmember'),projectId,membershipId]);
    for(const task of command.initialTasks){const taskId=identifier('task');taskIds.push(taskId);await client.query(`INSERT INTO public."Task"(id,"projectId",title,status,progress,"startsAt","endsAt",metadata,"updatedAt") VALUES($1,$2,$3,'BACKLOG',0,$4::date,$5::date,$6::jsonb,clock_timestamp())`,
      [taskId,projectId,task.title,task.startsOn,task.endsOn,JSON.stringify({source:'customer-initial-plan',operationReceiptId:id})]);}
    const metadata={version:1,projectId,companyName:command.companyName,projectName:command.project.name,taskIds,requestDigest,
      contactSource:'clerk-signed-verified-email',identitySource:'clerk-user-id',profileEmailVerified:true,profileEmailStored:actor.primaryEmail===email,
      verifiedProfileDigest:digest(['company-verified-profile-v1',IDENTITY_ISSUER,session.userId,email,true,profile.expiresAt??null]),
      organizationRoleSource:'clerk-signed-org-admin',businessVerificationClaimed:false,whatsAppConnected:false};
    await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'company.self_service.created','Organization',$2,$4::jsonb)`,[id,organizationId,actor.id,JSON.stringify(metadata)]);
    const saved=await receipt(client,session,id,{membershipId,role:'ADMIN'});if(!saved)throw new WorkspaceError('COMPANY_CREATION_UNCONFIRMED',503);return publicResult(saved,false);
   });
  }
 };
}
