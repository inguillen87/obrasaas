import {randomUUID} from 'node:crypto';
import {WorkspaceError,operationId,digest,requireWorkspaceIdentity} from './workspace-policy.mjs';
import {joinCanonicalInvitedAccount} from './canonical-invited-account.mjs';
import {participantAccountBound} from './participant-admission.mjs';
import {decodeSignedCustomerEvent} from './meta-customer-processing.mjs';
import {decryptCustomerSecret} from './meta-customer-credentials.mjs';
import {customerOutboundId} from './meta-customer-outbound.mjs';
import {assertEmployeeIntakeReplyContinuity} from './meta-employee-intake.mjs';
import {officeCommand,officeKeys,officeContext,officeInvitationId,officeReceiptId,requireOfficeAdministrator,assertOfficeGrant,officeEventProjection} from './office-review-policy.mjs';

const fail=(code,status=409)=>{throw new WorkspaceError(code,status);};
const id=prefix=>prefix+'_'+randomUUID().replaceAll('-','');
const attempted='office.review.invitation.attempted',accepted='office.review.accepted';
const dbNow=async client=>(await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
async function receipt(client,member,key){return (await client.query(`SELECT id,"entityId",metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND action IN ('office.review.recorded','office.review.invitation.attempted')`,[key,member.organizationId,member.actorId])).rows[0];}
async function insertAudit(client,member,key,action,entityId,metadata){await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,$4,'Project',$5,$6::jsonb)`,[key,member.organizationId,member.actorId,action,entityId,JSON.stringify(metadata)]);}
const outcome=(row,scope,replayed=true)=>({scope,projectId:row.entityId,operationId:row.metadata.operationId,action:row.metadata.action,state:row.metadata.state,saved:row.metadata.state==='RECORDED',definitive:row.metadata.state==='RECORDED',receiptId:row.id,replayed,...(row.metadata.invitationId?{invitationId:row.metadata.invitationId}:{} )});
async function channel(client,member,projectId,connectionId){
 const rows=(await client.query(`SELECT c.id,c."projectId",c."whatsappBusinessId",c."phoneNumberId",c.metadata,cc.revision AS "channelRevision",a.revision AS "assignmentRevision" FROM public."WhatsAppConnection" c JOIN public."WhatsAppCompanyChannel" cc ON cc."connectionId"=c.id AND cc."anchorProjectId"=c."projectId" JOIN public."WhatsAppChannelProjectAssignment" a ON a."connectionId"=cc."connectionId" AND a."organizationId"=cc."organizationId" JOIN public."Project" p ON p.id=c."projectId" AND p."organizationId"=cc."organizationId" WHERE cc."organizationId"=$1 AND a."projectId"=$2 AND a.status='ACTIVE' AND cc.mode='COMPANY' AND c.id=$3 AND c.enabled=true AND c."connectionStatus"='CONNECTED' AND p.status='ACTIVE'`,[member.organizationId,projectId,connectionId])).rows;
 if(rows.length!==1||rows[0].metadata?.credentialFormat!=='tenant-aad-v2'||rows[0].metadata.credentialOrganizationId!==member.organizationId||rows[0].metadata.developmentPilot)fail('OFFICE_REVIEW_CHANNEL_REQUIRED',403);
 return {...rows[0],organizationId:member.organizationId};
}
async function event(client,c,eventId,environment){
 const rows=(await client.query(`SELECT * FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-v1'`,[eventId,c.projectId])).rows;
 if(rows.length!==1)fail('OFFICE_REVIEW_EVENT_UNAVAILABLE',404);
 const payload=decodeSignedCustomerEvent(rows[0],c,environment);
 return {row:rows[0],payload,projection:officeEventProjection(rows[0],payload)};
}
async function replyProjection(client,c,source,environment){
 const rows=(await client.query(`SELECT id,payload,outcome FROM public."WebhookEvent" WHERE "projectId"=$1 AND provider='meta-customer-outbound-v1' AND payload->>'channelId'=$2 AND payload->>'eventId'=$3`,[c.projectId,c.id,source.row.id])).rows;
 if(rows.length>1)fail('OFFICE_REVIEW_SOURCE_CHANGED');
 if(!rows.length)return {replyState:'NOT_OBSERVED',deliveryStatus:null};
 const r=rows[0];let request;try{request=JSON.parse(decryptCustomerSecret(r.payload.encryptedPayload,{organizationId:c.organizationId,projectId:c.projectId,purpose:'outbound',resourceId:r.id},environment));}catch{fail('OFFICE_REVIEW_SOURCE_CHANGED');}
 if(r.id!==customerOutboundId(source.row.id)||r.payload.version!==1||r.payload.organizationId!==c.organizationId||r.payload.channelId!==c.id||r.payload.eventId!==source.row.id||r.payload.requestDigest!==digest(request)||request.version!==1||request.organizationId!==c.organizationId||request.channelId!==c.id||request.eventId!==source.row.id||request.payloadDigest!==source.row.payload.payloadDigest||request.replyTo!==source.payload.value.id||request.to!==source.payload.value.from||request.channelPurpose!=='EMPLOYEE_INTAKE')fail('OFFICE_REVIEW_SOURCE_CHANGED');
 if(source.row.payload.employeeIntakeDispatch&&source.row.payload.employeeIntakeDispatch.applicationId!==request.applicationId)fail('OFFICE_REVIEW_SOURCE_CHANGED');
 if(request.applicationId!==source.row.id){
  if(r.payload.employeeIntake!==true||r.payload.applicationId!==request.applicationId)fail('OFFICE_REVIEW_SOURCE_CHANGED');
  try{await assertEmployeeIntakeReplyContinuity(client,c,source.row,request,{environment});}catch(error){if(error instanceof WorkspaceError)fail('OFFICE_REVIEW_SOURCE_CHANGED');throw error;}
 }
 const state=['PREPARED','SEND_STARTED','SEND_UNKNOWN','SENT','STATUS_OBSERVED','REJECTED'].includes(r.outcome?.state)?r.outcome.state:'UNCONFIRMED';
 // The ordinary callback already checks signed status/recipient/message ID.
 // This DTO reports the stored observation and never claims physical reading.
 return {replyState:state,deliveryStatus:state==='STATUS_OBSERVED'&&['sent','delivered','read','failed','deleted'].includes(r.outcome.providerStatus)?r.outcome.providerStatus:null};
}
function matchInvitation(invite,result){if(!result||result.invitationId!==invite.invitationId||result.email!==invite.email||result.role!=='org:member'||!/^orginv_[A-Za-z0-9]+$/.test(result.id||'')||!['pending','accepted'].includes(result.state)||!Number.isFinite(Date.parse(result.expiresAt)))fail('OFFICE_REVIEW_INVITATION_UNCONFIRMED',503);}

export function createOfficeReviewStore({workspace,connect,identity,environment=process.env}){
 const admin=(session,context,writable,callback)=>workspace.organizationOperation(session,context,writable,async(client,member,scope)=>{requireOfficeAdministrator(member,session);if(writable){const selected=(await client.query(`SELECT id FROM public."Project" WHERE id=$1 AND "organizationId"=$2 AND status='ACTIVE' FOR UPDATE`,[context.projectId,member.organizationId])).rows;if(selected.length!==1)fail('WORKSPACE_PROJECT_UNAVAILABLE',404);}return callback(client,member,scope);});
 async function invitation(client,session,invitationId,lock=false,revoking=false){
  const rows=(await client.query(`SELECT a.id,a."actorId",a.metadata,a."entityId" AS "projectId",a."organizationId",p.name AS "projectName",o.name AS "organizationName" FROM public."AuditLog" a JOIN public."Project" p ON p.id=a."entityId" AND p."organizationId"=a."organizationId" JOIN public."Organization" o ON o.id=a."organizationId" WHERE a.action=$1 AND a.metadata->>'invitationId'=$2 AND o."clerkOrganizationId"=$3 AND p.status='ACTIVE' AND COALESCE(o.metadata->'internal','false'::jsonb)<>'true'::jsonb ${lock?'FOR UPDATE OF a':''}`,[attempted,invitationId,session.organizationId])).rows;
  if(rows.length!==1)fail('OFFICE_REVIEW_INVITATION_UNAVAILABLE',404);
  const row=rows[0],m=row.metadata;
  if(m.version!==1||m.action!=='INVITE_AUDITOR'||m.projectId!==row.projectId||!officeInvitationId(m.invitationId))fail('OFFICE_REVIEW_SOURCE_CHANGED');
  const revoked=(await client.query(`SELECT id FROM public."AuditLog" WHERE "organizationId"=$1 AND action='office.review.revoked' AND metadata->>'invitationId'=$2 LIMIT 1`,[row.organizationId,invitationId])).rows.length>0;
  if(revoked)fail('OFFICE_REVIEW_ACCESS_REQUIRED',403);
  // A current canonical ADMIN may revoke a historical issuer's access even
  // after that issuer loses authority. Reading/accepting still requires it.
  if(!revoking){const issuer=(await client.query(`SELECT tm.id FROM public."TenantMembership" tm WHERE tm."organizationId"=$1 AND tm."userId"=$2 AND tm.status='ACTIVE' AND tm."tenantRole"='ADMIN' AND tm."clerkRole"='org:admin'`,[row.organizationId,row.actorId])).rows;
   if(issuer.length!==1)fail('OFFICE_REVIEW_ACCESS_REQUIRED',403);}
  return row;
 }
 async function joinTransaction(session,writable,callback){
  requireWorkspaceIdentity(session);if(session.organizationRole!=='org:member')fail('OFFICE_REVIEW_MEMBER_SESSION_REQUIRED',403);
  let client,broken=false;try{client=await connect();await client.query(writable?'BEGIN ISOLATION LEVEL READ COMMITTED':'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await client.query("SET LOCAL statement_timeout='6000ms'");await client.query("SET LOCAL lock_timeout='2500ms'");const value=await callback(client);await client.query(writable?'COMMIT':'ROLLBACK');return value;}
  catch(error){if(client)try{await client.query('ROLLBACK');}catch{broken=true;}if(error instanceof WorkspaceError)throw error;throw new WorkspaceError('OFFICE_REVIEW_OPERATION_UNCONFIRMED',503);}finally{client?.release(broken);}
 }
 async function acceptedOutcome(client,session,row){
  const rows=(await client.query(`SELECT a.id,a.metadata,u.id AS "actorId",tm.id AS "membershipId",tm."tenantRole"::text AS role,tm."clerkRole",u."clerkUserId" FROM public."AuditLog" a JOIN public."PlatformUser" u ON u.id=a."actorId" JOIN public."TenantMembership" tm ON tm.id=a.metadata->>'membershipId' AND tm."userId"=u.id AND tm."organizationId"=a."organizationId" JOIN public."ProjectMembership" pm ON pm."tenantMembershipId"=tm.id AND pm."projectId"=a."entityId" WHERE a.action=$1 AND a."organizationId"=$2 AND a."entityId"=$3 AND a.metadata->>'invitationId'=$4 AND u."clerkUserId"=$5 AND tm.status='ACTIVE' AND pm.status='ACTIVE'`,[accepted,row.organizationId,row.projectId,row.metadata.invitationId,session.userId])).rows;
  if(!rows.length)return null;if(rows.length!==1)fail('OFFICE_REVIEW_SOURCE_CHANGED');
  const found=rows[0],member={...found,organizationId:row.organizationId},c=await channel(client,member,row.projectId,row.metadata.connectionId);
  if(found.metadata.originReceiptId!==row.id||found.metadata.issuerId!==row.actorId||found.metadata.expiresAt!==row.metadata.expiresAt||found.metadata.connectionId!==row.metadata.connectionId||row.metadata.state!=='SENT')fail('OFFICE_REVIEW_SOURCE_CHANGED');
  assertOfficeGrant(found.metadata,{member,projectId:row.projectId,connectionId:c.id,channelRevision:c.channelRevision,assignmentRevision:c.assignmentRevision,now:(await dbNow(client)).getTime()});
  if(await participantAccountBound(client,member))fail('OFFICE_REVIEW_FIELD_ACCOUNT_REJECTED',403);
  return {saved:true,joined:true,state:'RECORDED',canAccept:false,projectId:row.projectId,receiptId:found.id,invitationId:row.metadata.invitationId,expiresAt:found.metadata.expiresAt,readOnly:true};
 }
 async function finalizeInvitation(session,input,expected,result){
  matchInvitation(expected.metadata,result);
  return admin(session,input,true,async(client,member,scope)=>{
   await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[expected.id]);
   const current=await invitation(client,session,expected.metadata.invitationId,true);
   if(current.id!==expected.id||current.metadata.requestDigest!==expected.metadata.requestDigest||current.metadata.connectionId!==expected.metadata.connectionId)fail('OFFICE_REVIEW_OPERATION_CONFLICT');
   await channel(client,member,input.projectId,current.metadata.connectionId);
   const recordedKey=current.id+'_recorded',prior=await receipt(client,member,recordedKey);if(prior)return outcome(prior,scope);
   const now=await dbNow(client);if(Date.parse(current.metadata.expiresAt)<=now.getTime())fail('OFFICE_REVIEW_INVITATION_EXPIRED',410);
   const metadata={...current.metadata,state:'SENT',providerId:result.id,providerExpiresAt:result.expiresAt};
   await client.query(`UPDATE public."AuditLog" SET metadata=$2::jsonb WHERE id=$1 AND action=$3`,[current.id,JSON.stringify(metadata),attempted]);
   const saved={...metadata,state:'RECORDED'};await insertAudit(client,member,recordedKey,'office.review.recorded',input.projectId,saved);
   return outcome({id:recordedKey,entityId:input.projectId,metadata:saved},scope,false);
  });
 }
 return {
  async read(session,input){officeContext(input);return admin(session,input,false,async(client,member,scope)=>{
   const rows=(await client.query(`SELECT a.metadata,a.id,EXISTS(SELECT 1 FROM public."AuditLog" r WHERE r."organizationId"=a."organizationId" AND r.action='office.review.revoked' AND r.metadata->>'invitationId'=a.metadata->>'invitationId') AS revoked FROM public."AuditLog" a WHERE a."organizationId"=$1 AND a."entityId"=$2 AND a.action=$3 ORDER BY a."createdAt" DESC LIMIT 101`,[member.organizationId,input.projectId,attempted])).rows;
   const connections=(await client.query(`SELECT c.id FROM public."WhatsAppConnection" c JOIN public."WhatsAppCompanyChannel" cc ON cc."connectionId"=c.id JOIN public."WhatsAppChannelProjectAssignment" a ON a."connectionId"=c.id AND a."organizationId"=cc."organizationId" WHERE cc."organizationId"=$1 AND a."projectId"=$2 AND a.status='ACTIVE' AND cc.mode='COMPANY' AND c.enabled=true AND c."connectionStatus"='CONNECTED' ORDER BY c.id LIMIT 2`,[member.organizationId,input.projectId])).rows;
   const candidates=[];let candidatesLimited=false;
   if(connections.length===1){const c=await channel(client,member,input.projectId,connections[0].id),sources=(await client.query(`SELECT * FROM public."WebhookEvent" WHERE "projectId"=$1 AND provider='meta-customer-v1' AND payload->>'channelId'=$2 ORDER BY "createdAt" DESC,id DESC LIMIT 21`,[c.projectId,c.id])).rows;candidatesLimited=sources.length>20;for(const source of sources.slice(0,20)){try{candidates.push({...officeEventProjection(source,decodeSignedCustomerEvent(source,c,environment)),connectionId:c.id});}catch(error){if(!(error instanceof WorkspaceError))throw error;}}}
   return {scope,projectId:input.projectId,canManage:true,channels:connections.length===1?[{id:connections[0].id}]:[],candidates,candidatesLimited,invitations:rows.slice(0,100).map(r=>({id:r.metadata.invitationId,email:r.metadata.email,state:r.revoked?'REVOKED':r.metadata.state,expiresAt:r.metadata.expiresAt,connectionId:r.metadata.connectionId,operationId:r.metadata.operationId})),truncated:rows.length>100};
  });},
  async status(session,input){officeContext(input);if(!operationId(input.operationId))fail('OFFICE_REVIEW_INPUT_INVALID',400);return admin(session,input,false,async(client,member,scope)=>{
   const key=officeReceiptId(member,input.projectId,input.operationId),found=await receipt(client,member,key+'_recorded')||await receipt(client,member,key);
   if(!found)return {scope,projectId:input.projectId,operationId:input.operationId,action:null,state:'NOT_OBSERVED',saved:false,definitive:false};
   return outcome(found,scope);
  });},
  async command(session,body){
   const input=officeCommand(body),fingerprint=digest(input),p=input.payload;
   if(input.action==='INVITE_AUDITOR'){
    const prepared=await admin(session,input,true,async(client,member,scope)=>{
     const key=officeReceiptId(member,input.projectId,input.operationId);await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[key]);
     const prior=await receipt(client,member,key+'_recorded')||await receipt(client,member,key);if(prior){if(prior.metadata.requestDigest!==fingerprint)fail('OFFICE_REVIEW_OPERATION_CONFLICT');if(prior.metadata.state==='RECORDED')return {done:outcome(prior,scope)};fail('OFFICE_REVIEW_INVITATION_UNCONFIRMED',503);}
     await channel(client,member,input.projectId,p.connectionId);const now=await dbNow(client);
     if(Date.parse(p.expiresAt)<=now.getTime()+60000||Date.parse(p.expiresAt)>now.getTime()+366*86400000)fail('OFFICE_REVIEW_EXPIRY_INVALID',400);
     const duplicate=(await client.query(`SELECT a.id FROM public."AuditLog" a WHERE a."organizationId"=$1 AND a."entityId"=$2 AND a.action=$3 AND a.metadata->>'email'=$4 AND NOT EXISTS(SELECT 1 FROM public."AuditLog" r WHERE r."organizationId"=a."organizationId" AND r.action='office.review.revoked' AND r.metadata->>'invitationId'=a.metadata->>'invitationId')`,[member.organizationId,input.projectId,attempted,p.email])).rows;
     if(duplicate.length)fail('OFFICE_REVIEW_ALREADY_INVITED');
     const metadata={version:1,projectId:input.projectId,operationId:input.operationId,action:input.action,requestDigest:fingerprint,invitationId:id('office_invite'),email:p.email,connectionId:p.connectionId,expiresAt:p.expiresAt,state:'INVITATION_UNCONFIRMED',providerId:null};
     await insertAudit(client,member,key,attempted,input.projectId,metadata);return {id:key,entityId:input.projectId,actorId:member.actorId,organizationId:member.organizationId,metadata};
    });
    if(prepared.done)return prepared.done;
    // Reservation committed before Clerk. Unknown/lost acknowledgements may
    // only be reconciled by findInvitation, never another createInvitation.
    const result=await identity.createInvitation({organizationId:session.organizationId,inviterUserId:session.userId,email:p.email,invitationId:prepared.metadata.invitationId});
    return finalizeInvitation(session,input,prepared,result);
   }
   return admin(session,input,true,async(client,member,scope)=>{
    const key=officeReceiptId(member,input.projectId,input.operationId);await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[key]);const prior=await receipt(client,member,key);if(prior){if(prior.metadata.requestDigest!==fingerprint)fail('OFFICE_REVIEW_OPERATION_CONFLICT');return outcome(prior,scope);}
    if(input.action==='REVOKE_AUDITOR'){
     const invite=await invitation(client,session,p.invitationId,true,true);if(invite.projectId!==input.projectId)fail('OFFICE_REVIEW_OPERATION_CONFLICT');
     await insertAudit(client,member,key+'_revoked','office.review.revoked',input.projectId,{version:1,invitationId:p.invitationId,reason:p.reason.trim()});
     await client.query(`UPDATE public."ProjectMembership" pm SET status='DISABLED',"updatedAt"=clock_timestamp() FROM public."AuditLog" a WHERE a.action=$1 AND a."organizationId"=$2 AND a."entityId"=$3 AND a.metadata->>'invitationId'=$4 AND pm."projectId"=a."entityId" AND pm."tenantMembershipId"=a.metadata->>'membershipId'`,[accepted,member.organizationId,input.projectId,p.invitationId]);
    }else{
     const c=await channel(client,member,input.projectId,p.connectionId),source=await event(client,c,p.eventId,environment);
     const selections=(await client.query(`SELECT id FROM public."AuditLog" WHERE "organizationId"=$1 AND "entityId"=$2 AND action='office.review.event.selected'`,[member.organizationId,input.projectId])).rows;if(selections.length>=20)fail('OFFICE_REVIEW_SELECTION_LIMIT');
     await insertAudit(client,member,key+'_event','office.review.event.selected',input.projectId,{version:1,connectionId:c.id,eventId:source.row.id,payloadDigest:source.row.payload.payloadDigest,channelRevision:c.channelRevision,assignmentRevision:c.assignmentRevision});
    }
    const metadata={version:1,projectId:input.projectId,operationId:input.operationId,action:input.action,requestDigest:fingerprint,state:'RECORDED'};await insertAudit(client,member,key,'office.review.recorded',input.projectId,metadata);return outcome({id:key,entityId:input.projectId,metadata},scope,false);
   });
  },
  async reconcile(session,input){officeKeys(input,['projectId','scope','operationId','invitationId']);officeContext(input);if(!operationId(input.operationId)||!officeInvitationId(input.invitationId))fail('OFFICE_REVIEW_INPUT_INVALID',400);
   const original=await admin(session,input,false,async(client,member)=>{const row=await invitation(client,session,input.invitationId);if(row.id!==officeReceiptId(member,input.projectId,input.operationId)||row.projectId!==input.projectId)fail('OFFICE_REVIEW_OPERATION_CONFLICT');return row;});
   const result=await identity.findInvitation({organizationId:session.organizationId,invitationId:input.invitationId});matchInvitation(original.metadata,result);return finalizeInvitation(session,input,original,result);
  },
  async join(session,input,{accept=false}={}){
   officeKeys(input,accept?['invitationId','operationId']:['invitationId']);if(!officeInvitationId(input.invitationId)||accept&&!operationId(input.operationId))fail('OFFICE_REVIEW_INPUT_INVALID',400);
   const original=await joinTransaction(session,false,async client=>{const row=await invitation(client,session,input.invitationId);const joined=await acceptedOutcome(client,session,row);return joined?{done:joined}:row;});if(original.done)return original.done;
   const m=original.metadata,primaryEmail=await identity.verifiedEmail(session.userId),email=primaryEmail===m.email?primaryEmail:await identity.verifiedEmail(session.userId,m.email);if(email!==m.email)fail('PARTICIPANT_EMAIL_MISMATCH',403);
   const provider=await identity.findInvitation({organizationId:session.organizationId,invitationId:m.invitationId});matchInvitation(m,provider);if(provider.state!=='accepted'||provider.id!==m.providerId)fail('PARTICIPANT_PROVIDER_ACCEPTANCE_REQUIRED',403);
   const verified=await identity.verifyMembership({userId:session.userId,organizationId:session.organizationId,invitationId:m.invitationId});if(verified.role!=='org:member')fail('OFFICE_REVIEW_MEMBER_SESSION_REQUIRED',403);
   return joinTransaction(session,accept,async client=>{
    if(accept)for(const lock of [...new Set(['participant-user:'+session.userId,'participant-email:'+primaryEmail,'participant-email:'+email])].sort())await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[lock]);
    const joinedIdentity=accept?await joinCanonicalInvitedAccount(client,original,session,primaryEmail,email):null;
    if(accept&&joinedIdentity.member.clerkRole!=='org:member')fail('OFFICE_REVIEW_MEMBER_SESSION_REQUIRED',403);
    if(accept){const projects=(await client.query(`SELECT id FROM public."Project" WHERE id=$1 AND "organizationId"=$2 AND status='ACTIVE' FOR UPDATE`,[original.projectId,original.organizationId])).rows;if(projects.length!==1)fail('WORKSPACE_PROJECT_UNAVAILABLE',404);}
    const row=await invitation(client,session,input.invitationId,accept),current=row.metadata;
    if(row.id!==original.id||current.email!==email||current.providerId!==provider.id||current.requestDigest!==m.requestDigest)fail('OFFICE_REVIEW_OPERATION_CONFLICT');
    if(current.state!=='SENT'||!Number.isFinite(Date.parse(current.providerExpiresAt))||Date.parse(current.providerExpiresAt)<(await dbNow(client)).getTime()||Date.parse(current.expiresAt)<(await dbNow(client)).getTime())fail('OFFICE_REVIEW_INVITATION_EXPIRED',410);
    if(!accept)return {invitationId:m.invitationId,projectId:row.projectId,projectName:row.projectName,organizationName:row.organizationName,canAccept:true,readOnly:true,expiresAt:current.expiresAt};
    const {user,member}=joinedIdentity,canonical={actorId:user.id,membershipId:member.id,organizationId:row.organizationId,clerkUserId:session.userId,clerkRole:session.organizationRole,role:'AUDITOR'};
    if(await participantAccountBound(client,canonical))fail('OFFICE_REVIEW_FIELD_ACCOUNT_REJECTED',403);
    const c=await channel(client,canonical,row.projectId,current.connectionId);
    const existing=await acceptedOutcome(client,session,row);if(existing)return existing;
    const pm=(await client.query(`SELECT id,status FROM public."ProjectMembership" WHERE "projectId"=$1 AND "tenantMembershipId"=$2 FOR UPDATE`,[row.projectId,member.id])).rows[0];if(pm?.status==='DISABLED')fail('OFFICE_REVIEW_ACCESS_REQUIRED',403);
    if(!pm)await client.query(`INSERT INTO public."ProjectMembership"(id,"projectId","tenantMembershipId",status,"updatedAt") VALUES($1,$2,$3,'ACTIVE',clock_timestamp())`,[id('projectmember'),row.projectId,member.id]);
    const key='office_accept_'+digest([row.organizationId,row.projectId,m.invitationId,session.userId]);
    await insertAudit(client,canonical,key,accepted,row.projectId,{version:1,kind:'OFFICE_AUDITOR_INVITATION_ACCEPTED',invitationId:m.invitationId,membershipId:member.id,projectId:row.projectId,organizationId:row.organizationId,clerkUserId:session.userId,connectionId:c.id,channelRevision:c.channelRevision,assignmentRevision:c.assignmentRevision,issuerId:row.actorId,expiresAt:current.expiresAt,originReceiptId:row.id,operationId:input.operationId.toLowerCase()});
    return {saved:true,joined:true,state:'RECORDED',canAccept:false,projectId:row.projectId,receiptId:key,invitationId:m.invitationId,expiresAt:current.expiresAt,readOnly:true};
   });
  },
  async review(session,input){officeContext(input);return workspace.officeReviewRead(session,input,async(client,member,scope,project)=>{
   const grants=(await client.query(`SELECT id,metadata FROM public."AuditLog" WHERE action=$1 AND "organizationId"=$2 AND "actorId"=$3 AND "entityId"=$4 AND metadata->>'membershipId'=$5`,[accepted,member.organizationId,member.actorId,input.projectId,member.membershipId])).rows;if(grants.length!==1)fail('OFFICE_REVIEW_ACCESS_REQUIRED',403);
   const grant=grants[0],row=await invitation(client,session,grant.metadata.invitationId),c=await channel(client,member,project.id,grant.metadata.connectionId);
   if(row.id!==grant.metadata.originReceiptId||row.actorId!==grant.metadata.issuerId||row.metadata.connectionId!==grant.metadata.connectionId||row.metadata.expiresAt!==grant.metadata.expiresAt||row.metadata.state!=='SENT')fail('OFFICE_REVIEW_SOURCE_CHANGED');
   assertOfficeGrant(grant.metadata,{member,projectId:project.id,connectionId:c.id,channelRevision:c.channelRevision,assignmentRevision:c.assignmentRevision,now:(await dbNow(client)).getTime()});
   const selected=(await client.query(`SELECT metadata FROM public."AuditLog" WHERE "organizationId"=$1 AND "entityId"=$2 AND action='office.review.event.selected' ORDER BY "createdAt",id LIMIT 21`,[member.organizationId,project.id])).rows;if(selected.length>20)fail('OFFICE_REVIEW_SELECTION_LIMIT');
   const items=[];for(const entry of selected){const m=entry.metadata;if(m.connectionId!==c.id||m.channelRevision!==c.channelRevision||m.assignmentRevision!==c.assignmentRevision)fail('OFFICE_REVIEW_SOURCE_CHANGED');const source=await event(client,c,m.eventId,environment);if(source.row.payload.payloadDigest!==m.payloadDigest)fail('OFFICE_REVIEW_SOURCE_CHANGED');items.push({...source.projection,...await replyProjection(client,c,source,environment)});}
   return {scope,projectId:project.id,projectName:project.name,readOnly:true,expiresAt:grant.metadata.expiresAt,items,canSend:false,canManage:false};
  });},
 };
}
