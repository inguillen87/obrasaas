import {randomUUID} from 'node:crypto';
import {WorkspaceError,operationId,digest} from './workspace-policy.mjs';
import {decryptCustomerSecret} from './meta-customer-credentials.mjs';
import {customerChannelActive} from './meta-customer-outbound.mjs';
import {OBRASAAS_META_CHANNEL} from './meta-channel-binding.mjs';
import {readProjectWorkspaceProfile} from './whatsapp/project-workspace-profile.js';
export function publicCustomerActivation(connection,readiness,member,now=Date.now()){
 const state=connection?.metadata?.customerActivation,active=customerChannelActive(connection,now);
 return {state:active?'ACTIVE':state?.state==='ACTIVE'?'REVIEW_REQUIRED':state?.state||'NOT_ACCEPTED',operational:active,actorId:state?.actorId||null,verifiedAt:state?.verifiedAt||null,lastCode:state?.lastCode||null,canActivate:member.role==='ADMIN'&&readiness.canLaunchMeta&&Boolean(connection?.metadata?.customerVerification?.registered)&&(!state?.leaseExpiresAt||Date.parse(state.leaseExpiresAt)<=now),canDeactivate:member.role==='ADMIN'&&connection?.enabled===true,roundTrip:'NOT_VERIFIED',fieldJourney:'NOT_VERIFIED'};
}
export function createMetaCustomerActivation({workspace,provider,environment=process.env,now=()=>Date.now()}){
 const within=(session,body,writable,run)=>workspace.integrationProject(session,body,writable,run);
 const load=async(client,member,project)=>{const rows=(await client.query(`SELECT id,"projectId","phoneNumberId","whatsappBusinessId",enabled,"connectionStatus"::text AS "connectionStatus","encryptedAccessToken",metadata FROM public."WhatsAppConnection" WHERE "projectId"=$1 FOR UPDATE`,[project.id])).rows;if(rows.length!==1||rows[0].metadata?.credentialFormat!=='tenant-aad-v2'||rows[0].metadata?.credentialOrganizationId!==member.organizationId||rows[0].phoneNumberId===OBRASAAS_META_CHANNEL.phoneNumberId||rows[0].whatsappBusinessId===OBRASAAS_META_CHANNEL.wabaId)throw new WorkspaceError('META_CUSTOMER_BINDING_INTEGRITY',409);return rows[0];};
 return {async command(session,body){
  if(!body||Object.keys(body).sort().join('|')!=='action|confirmActivation|operationId|projectId|scope'||!operationId(body.operationId)||!['activate_channel','deactivate_channel'].includes(body.action)||body.confirmActivation!==true)throw new WorkspaceError('META_CUSTOMER_ACTIVATION_INPUT_INVALID');
  const claimed=await within(session,body,true,async(client,member,_scope,project)=>{
   if(member.role!=='ADMIN')throw new WorkspaceError('META_CUSTOMER_ACTIVATION_ADMIN_REQUIRED',403);
   const channel=await load(client,member,project),key='meta_activation_'+digest([member.actorId,project.id,body.operationId]),operationDigest=digest(body),previous=(await client.query(`SELECT metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2`,[key,member.organizationId])).rows[0];
   if(previous){if(previous.metadata.operationDigest!==operationDigest)throw new WorkspaceError('META_CUSTOMER_OPERATION_CONFLICT',409);return {done:true};}
   const requestKey=key+'_request',request=(await client.query(`SELECT metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2`,[requestKey,member.organizationId])).rows[0];
   if(request&&request.metadata.operationDigest!==operationDigest)throw new WorkspaceError('META_CUSTOMER_OPERATION_CONFLICT',409);
   if(!request)await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'integration.whatsapp.customer.activation_requested','WhatsAppConnection',$4,$5::jsonb)`,[requestKey,member.organizationId,member.actorId,channel.id,JSON.stringify({version:1,projectId:project.id,operationDigest,requestedAction:body.action})]);
   if(body.action==='deactivate_channel'){
    await client.query(`UPDATE public."WhatsAppConnection" SET enabled=false,"connectionStatus"='DISABLED',metadata=metadata||$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[channel.id,project.id,JSON.stringify({customerActivation:{version:1,state:'DEACTIVATED',actorId:member.actorId,deactivatedAt:new Date(now()).toISOString()}})]);
    await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'integration.whatsapp.customer.deactivated','WhatsAppConnection',$4,$5::jsonb)`,[key,member.organizationId,member.actorId,channel.id,JSON.stringify({version:1,projectId:project.id,operationDigest})]);return {done:true};
   }
   const profile=readProjectWorkspaceProfile(project.metadata,project.organizationMetadata,project.id).profile;if(!profile.configured||profile.numberMode!=='DEDICATED')throw new WorkspaceError('META_CUSTOMER_PREPARATION_REQUIRED',409);
   if(!provider.readiness().canLaunchMeta)throw new WorkspaceError('META_CUSTOMER_CONFIGURATION_PENDING',503);
   const state=channel.metadata.customerActivation;if(state?.state==='VERIFYING'&&Date.parse(state.leaseExpiresAt)>now())throw new WorkspaceError('META_CUSTOMER_ACTIVATION_BUSY',409);
   const leaseId=randomUUID(),token=decryptCustomerSecret(channel.encryptedAccessToken,{organizationId:member.organizationId,projectId:project.id,purpose:'access-token',resourceId:channel.phoneNumberId},environment);
   await client.query(`UPDATE public."WhatsAppConnection" SET enabled=false,"connectionStatus"='PENDING',metadata=metadata||$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[channel.id,project.id,JSON.stringify({customerActivation:{version:1,state:'VERIFYING',actorId:member.actorId,leaseId,leaseExpiresAt:new Date(now()+60000).toISOString(),operationDigest}})]);
   return {channel,token,leaseId,key,operationDigest};
  });
  if(claimed.done)return {saved:true,replayed:true};
  try{
   const verified=await provider.inspect({token:claimed.token,wabaId:claimed.channel.whatsappBusinessId,phoneNumberId:claimed.channel.phoneNumberId});
   if(!verified.registered||!['business_management','whatsapp_business_management','whatsapp_business_messaging'].every(scope=>verified.scopes?.includes(scope)))throw new WorkspaceError('META_CUSTOMER_ACTIVATION_PROVIDER_EVIDENCE_REQUIRED',409);
   const subscribed=await provider.inspectSubscription({token:claimed.token,wabaId:claimed.channel.whatsappBusinessId});if(subscribed!==true)throw new WorkspaceError('META_CUSTOMER_SUBSCRIPTION_UNCONFIRMED',409);
   return within(session,body,true,async(client,member,_scope,project)=>{
    if(member.role!=='ADMIN')throw new WorkspaceError('META_CUSTOMER_ACTIVATION_ADMIN_REQUIRED',403);
    const profile=readProjectWorkspaceProfile(project.metadata,project.organizationMetadata,project.id).profile;if(!profile.configured||profile.numberMode!=='DEDICATED')throw new WorkspaceError('META_CUSTOMER_PREPARATION_CHANGED',409);
    const channel=await load(client,member,project);if(channel.id!==claimed.channel.id||channel.phoneNumberId!==claimed.channel.phoneNumberId||channel.whatsappBusinessId!==claimed.channel.whatsappBusinessId||channel.encryptedAccessToken!==claimed.channel.encryptedAccessToken||channel.metadata.customerActivation?.leaseId!==claimed.leaseId||Date.parse(channel.metadata.customerActivation.leaseExpiresAt)<=now())throw new WorkspaceError('META_CUSTOMER_ACTIVATION_CHANGED',409);
    await client.query(`UPDATE public."WhatsAppConnection" SET enabled=true,"connectionStatus"='CONNECTED',metadata=metadata||$3::jsonb,"lastVerifiedAt"=clock_timestamp(),"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[channel.id,project.id,JSON.stringify({customerSubscribed:true,customerVerification:verified,customerActivation:{version:1,state:'ACTIVE',actorId:member.actorId,verifiedAt:new Date(now()).toISOString(),operationDigest:claimed.operationDigest,roundTrip:'NOT_VERIFIED',fieldJourney:'NOT_VERIFIED'}})]);
    await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'integration.whatsapp.customer.activated','WhatsAppConnection',$4,$5::jsonb)`,[claimed.key,member.organizationId,member.actorId,channel.id,JSON.stringify({version:1,projectId:project.id,operationDigest:claimed.operationDigest,providerGrantVerified:true,phoneRegistered:true,appSubscribed:true,roundTrip:'NOT_VERIFIED',fieldJourney:'NOT_VERIFIED'})]);return {saved:true,replayed:false};
   });
  }catch(error){
   await within(session,body,true,async(client,member,_scope,project)=>{const channel=await load(client,member,project);if(channel.metadata.customerActivation?.leaseId===claimed.leaseId)await client.query(`UPDATE public."WhatsAppConnection" SET enabled=false,"connectionStatus"='PENDING',metadata=metadata||$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[channel.id,project.id,JSON.stringify({customerActivation:{version:1,state:'REVIEW_REQUIRED',actorId:member.actorId,lastCode:error instanceof WorkspaceError?error.code:'META_CUSTOMER_PROVIDER_UNCONFIRMED'}})]);}).catch(()=>{});throw error;
  }
 }};
}
