import {randomUUID} from 'node:crypto';
import {WorkspaceError,workspaceId,operationId} from './workspace-policy.mjs';
import {PROJECT_CREATION_ACTION,projectCreationContext,normalizeProjectCreation,projectCreationReceiptId,projectCreationRequestDigest} from './project-creation-policy.mjs';

const action='project.creation.recorded';
const identifier=kind=>kind+'_'+randomUUID().replaceAll('-','');
const integrity=()=>{throw new WorkspaceError('PROJECT_CREATION_INTEGRITY',409);};
const exact=(value,fields)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...fields].sort().join('|');
export function createProjectCreation({workspace}){
 if(typeof workspace?.organizationOperation!=='function')throw new TypeError('Canonical organization operation required');
 const run=(session,context,writable,callback,allowArchived=false)=>workspace.organizationOperation(session,projectCreationContext(context),writable,async(client,member,scope)=>{
  if(member.role!=='ADMIN'||session.organizationRole!=='org:admin'||member.channelProof||member.officeReviewOnly===true)throw new WorkspaceError('PROJECT_CREATION_PERMISSION_REQUIRED',403);
  return callback(client,member,scope);
 },allowArchived);
 async function receipt(client,member,context,scope){
  const id=projectCreationReceiptId(member,context.projectId,context.operationId),rows=(await client.query(`SELECT id,"entityId",metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND action=$4 AND "entityType"='Project'`,[id,member.organizationId,member.actorId,action])).rows;
  if(!rows.length)return null;if(rows.length!==1)integrity();
  const row=rows[0],m=row.metadata;
  if(row.id!==id||!exact(m,['version','projectId','scope','operationId','action','requestDigest','createdProjectId','creatorProjectMembershipId','creatorMembershipId','payload'])||m.version!==1||m.projectId!==context.projectId||m.operationId!==context.operationId.toLowerCase()||m.action!==PROJECT_CREATION_ACTION||!workspaceId(m.createdProjectId)||row.entityId!==m.createdProjectId||m.createdProjectId===context.projectId||!workspaceId(m.creatorProjectMembershipId)||!/^[a-f0-9]{64}$/.test(m.requestDigest||''))integrity();
  if(m.scope!==scope||m.creatorMembershipId!==member.membershipId)throw new WorkspaceError('PROJECT_CREATION_OPERATION_CONTEXT_CHANGED',409);
  try{const normalized=normalizeProjectCreation({projectId:m.projectId,scope:m.scope,operationId:m.operationId,action:m.action,payload:m.payload});if(projectCreationRequestDigest(normalized)!==m.requestDigest)integrity();}catch{integrity();}
  return row;
 }
 async function outcome(client,member,context,scope,found,replayed){
  const m=found.metadata,rows=(await client.query(`SELECT p.id,p.name,p.status::text AS status FROM public."Project" p JOIN public."ProjectMembership" pm ON pm."projectId"=p.id WHERE p.id=$1 AND p."organizationId"=$2 AND pm.id=$3 AND pm."tenantMembershipId"=$4`,[m.createdProjectId,member.organizationId,m.creatorProjectMembershipId,member.membershipId])).rows;
  if(rows.length!==1||rows[0].id!==m.createdProjectId||typeof rows[0].name!=='string'||!['PLANNING','ACTIVE','PAUSED','COMPLETED','ARCHIVED'].includes(rows[0].status))integrity();
  return {scope,projectId:context.projectId,operationId:context.operationId.toLowerCase(),action:PROJECT_CREATION_ACTION,state:'RECORDED',saved:true,created:true,definitive:true,receiptId:found.id,replayed,newProject:{id:rows[0].id,name:rows[0].name,status:rows[0].status}};
 }
 return {
  read(session,context){return run(session,context,false,async(_client,_member,scope)=>({scope,projectId:context.projectId,canCreate:true}));},
  status(session,context){
   if(!operationId(context?.operationId))throw new WorkspaceError('PROJECT_CREATION_QUERY_INVALID',400);
   return run(session,context,false,async(client,member,scope)=>{const found=await receipt(client,member,context,scope);return found?outcome(client,member,context,scope,found,true):{scope,projectId:context.projectId,operationId:context.operationId.toLowerCase(),action:PROJECT_CREATION_ACTION,state:'NOT_OBSERVED',saved:false,created:false,definitive:false};},true);
  },
  save(session,body){const input=normalizeProjectCreation(body);return run(session,input,true,async(client,member,scope)=>{
   const id=projectCreationReceiptId(member,input.projectId,input.operationId),requestDigest=projectCreationRequestDigest(input);
   await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[id]);
   const prior=await receipt(client,member,input,scope);if(prior){if(prior.metadata.requestDigest!==requestDigest)throw new WorkspaceError('PROJECT_CREATION_OPERATION_CONFLICT',409);return outcome(client,member,input,scope,prior,true);}
   // Recheck and lock the selected origin after the operation lock. An archive
   // arriving during authorization cannot leave a new command attached to it.
   const anchor=(await client.query(`SELECT id FROM public."Project" WHERE id=$1 AND "organizationId"=$2 AND status='ACTIVE' FOR SHARE`,[input.projectId,member.organizationId])).rows;
   if(anchor.length!==1)throw new WorkspaceError('WORKSPACE_PROJECT_UNAVAILABLE',404);
   const projectId=identifier('project'),projectMembershipId=identifier('projectmember'),p=input.payload;
   await client.query(`INSERT INTO public."Project"(id,"organizationId",name,slug,status,address,metadata,"updatedAt") VALUES($1,$2,$3,$1,'ACTIVE',$4,$5::jsonb,clock_timestamp())`,[projectId,member.organizationId,p.name,p.address||null,JSON.stringify({onboarding:{version:1,source:'customer-additional-project',locationVerified:false,emptyOperationalData:true}})]);
   await client.query(`INSERT INTO public."ProjectMembership"(id,"projectId","tenantMembershipId",status,"updatedAt") VALUES($1,$2,$3,'ACTIVE',clock_timestamp())`,[projectMembershipId,projectId,member.membershipId]);
   await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,$4,'Project',$5,$6::jsonb)`,[id,member.organizationId,member.actorId,action,projectId,JSON.stringify({version:1,projectId:input.projectId,scope,operationId:input.operationId,action:PROJECT_CREATION_ACTION,requestDigest,createdProjectId:projectId,creatorProjectMembershipId:projectMembershipId,creatorMembershipId:member.membershipId,payload:p})]);
   const found=await receipt(client,member,input,scope);if(!found)throw new WorkspaceError('PROJECT_CREATION_UNCONFIRMED',503);
   return outcome(client,member,input,scope,found,false);
  });}
 };
}
