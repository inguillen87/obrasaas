import {randomUUID} from 'node:crypto';
import {WorkspaceError,operationId,digest} from './workspace-policy.mjs';
import {decryptCustomerSecret} from './meta-customer-credentials.mjs';
import {readProjectWorkspaceProfile} from './whatsapp/project-workspace-profile.js';

export const META_APP_IMPORT_NOTICE_VERSION='business-app-import-v1';
export const META_APP_IMPORT_NOTICE='Autorizo importar los datos seleccionados de mi WhatsApp Business a la bandeja privada de esta empresa y obra. El historial depende del permiso que doy en Meta y de sus límites. No reemplaza ventas, contactos manuales ni permisos de participantes.';
export const META_APP_IMPORT_NOTICE_SHA256=digest(META_APP_IMPORT_NOTICE);
const types={contacts:'smb_app_state_sync',history:'history'};
const selectedKeys=['action','operationId','projectId','scope','signupId','contactsConsent','historyConsent','noticeVersion','confirmPreserveApp'];
const terminal=new Set(['REQUEST_ACCEPTED','REQUEST_UNKNOWN','COMPLETED','DECLINED','RECEIVING','PROVIDER_COMPLETE_OBSERVED']);
export function customerSignupFlow(readiness,numberMode){
 const flow=readiness.flows?.[numberMode];
 if(readiness.canLaunchMeta!==true||readiness.signupVersion!=='4'||flow?.available!==true||!flow.configId)throw new WorkspaceError(numberMode==='BUSINESS_APP'?'META_CUSTOMER_COEXISTENCE_CONFIGURATION_PENDING':'META_CUSTOMER_CONFIGURATION_PENDING',503);
 return {numberMode,configId:flow.configId,signupVersion:'4',...(numberMode==='BUSINESS_APP'?{featureType:'whatsapp_business_app_onboarding'}:{})};
}
export function publicCustomerCoexistence(connection,readiness,time=Date.now()){
 const stored=connection?.metadata?.coexistence;
 if(!stored)return null;
 const deadline=Date.parse(stored.syncDeadlineAt),expired=Number.isFinite(deadline)&&time>deadline;
 const publicStep=value=>({state:value?.state==='REQUEST_STARTED'&&Date.parse(value.leaseExpiresAt)<=time?'REQUEST_UNKNOWN':value?.state||'NOT_SELECTED',requestId:value?.requestId||null,requestedAt:value?.requestedAt||null,observedAt:value?.observedAt||null,progress:Number.isInteger(value?.progress)?value.progress:null,records:Number.isSafeInteger(value?.records)?value.records:0});
 return {mode:'BUSINESS_APP',verified:stored.verified===true,verifiedAt:stored.verifiedAt||null,syncDeadlineAt:stored.syncDeadlineAt||null,expired,contacts:publicStep(stored.contacts),history:publicStep(stored.history),echoes:Number.isSafeInteger(stored.echoes)?stored.echoes:0,
  canSelectImport:readiness.flows?.BUSINESS_APP?.available===true&&stored.verified===true&&!expired&&!stored.importConsent,
  canContinueImport:readiness.flows?.BUSINESS_APP?.available===true&&stored.verified===true&&!expired&&Boolean(stored.importConsent)&&['contacts','history'].some(kind=>stored.importConsent[kind]===true&&stored[kind]?.state==='NOT_REQUESTED'),
  importSelection:stored.importConsent?{operationId:stored.importConsent.operationId,contacts:stored.importConsent.contacts,history:stored.importConsent.history}:null,
  noticeVersion:META_APP_IMPORT_NOTICE_VERSION,notice:META_APP_IMPORT_NOTICE,
  historyCompleteGuaranteed:false,identityCertified:false,operationalVerified:false};
}
export function createMetaCustomerCoexistence({workspace,provider,environment=process.env,now=()=>Date.now()}){
 const within=(session,body,run)=>workspace.integrationProject(session,body,true,run);
 async function bound(client,member,project,body){
  const state=project.metadata?.metaSignup;
  if(state?.id!==body.signupId||state.actorId!==member.actorId||state.organizationId!==member.organizationId||state.numberMode!=='BUSINESS_APP'||state.state!=='LINKED_PENDING_ACCEPTANCE')throw new WorkspaceError('META_CUSTOMER_SYNC_UNAVAILABLE',409);
  customerSignupFlow(provider.readiness(),'BUSINESS_APP');
  const rows=(await client.query(`SELECT id,"projectId","phoneNumberId","whatsappBusinessId","encryptedAccessToken",metadata FROM public."WhatsAppConnection" WHERE "projectId"=$1 FOR UPDATE`,[project.id])).rows;
  const c=rows[0];
  if(rows.length!==1||c.metadata?.credentialFormat!=='tenant-aad-v2'||c.metadata.credentialOrganizationId!==member.organizationId||c.metadata.customerSignupId!==state.id||c.phoneNumberId!==state.phoneNumberId||c.whatsappBusinessId!==state.wabaId||c.metadata.coexistence?.verified!==true)throw new WorkspaceError('META_CUSTOMER_BINDING_INTEGRITY',409);
  return c;
 }
 async function save(client,c,coexistence){
  const written=await client.query(`UPDATE public."WhatsAppConnection" SET metadata=metadata||$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[c.id,c.projectId,JSON.stringify({coexistence})]);
  if(written.rowCount!==1)throw new WorkspaceError('META_CUSTOMER_WRITE_UNCONFIRMED',503);
 }
 return {async prepareExistingApiPlan(session,body){
  const keys=['action','operationId','projectId','scope','preparedRevision','confirmPreserveProvider'];
  if(!body||Object.keys(body).sort().join('|')!==keys.sort().join('|')||body.action!=='prepare_existing_api_plan'||!operationId(body.operationId)||body.confirmPreserveProvider!==true||!Number.isInteger(body.preparedRevision))throw new WorkspaceError('META_CUSTOMER_SYNC_INPUT_INVALID');
  return within(session,body,async(client,member,_scope,project)=>{
   const {profile}=readProjectWorkspaceProfile(project.metadata,project.organizationMetadata,project.id);
   if(!profile.configured||profile.numberMode!=='EXISTING_API'||profile.revision!==body.preparedRevision)throw new WorkspaceError('META_CUSTOMER_PREPARATION_CHANGED',409);
   const requestDigest=digest(Object.fromEntries(keys.map(key=>[key,body[key]]))),prior=project.metadata?.metaExistingApiPlan;
   if(prior){if(prior.operationId!==body.operationId||prior.requestDigest!==requestDigest)throw new WorkspaceError('META_CUSTOMER_EXISTING_API_PLAN_ALREADY_PREPARED',409);return {saved:true,replayed:true};}
   const channels=(await client.query(`SELECT id,"phoneNumberId","whatsappBusinessId","encryptedAccessToken" FROM public."WhatsAppConnection" WHERE "projectId"=$1 FOR SHARE`,[project.id])).rows;
   if(channels.length>1)throw new WorkspaceError('META_CUSTOMER_BINDING_INTEGRITY',409);
   const c=channels[0],plan={version:1,state:'ADDITIONAL_AUTHORIZATION_REVIEW_REQUIRED',operationId:body.operationId,requestDigest,actorId:member.actorId,organizationId:member.organizationId,preparedRevision:profile.revision,preparedAt:new Date(now()).toISOString(),preserveProvider:true,existingConnection:c?{id:c.id,phoneNumberId:c.phoneNumberId,wabaId:c.whatsappBusinessId,credentialDigest:digest(c.encryptedAccessToken)}:null};
   const written=await client.query(`UPDATE public."Project" SET metadata=metadata||$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "organizationId"=$2`,[project.id,member.organizationId,JSON.stringify({metaExistingApiPlan:plan})]);
   if(written.rowCount!==1)throw new WorkspaceError('META_CUSTOMER_WRITE_UNCONFIRMED',503);
   await client.query(`INSERT INTO public."AuditLog" (id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES ($1,$2,$3,'integration.whatsapp.existing_api_plan','Project',$4,$5::jsonb) ON CONFLICT (id) DO NOTHING`,['meta_share_plan_'+digest([project.id,body.operationId]),member.organizationId,member.actorId,project.id,JSON.stringify({version:1,state:plan.state,requestDigest,preserveProvider:true,providerChanged:false})]);
   return {saved:true,replayed:false};
  });
 },async command(session,body){
  if(!body||Object.keys(body).sort().join('|')!==selectedKeys.slice().sort().join('|')||!['start_app_sync','continue_app_sync'].includes(body.action)||!operationId(body.operationId)||typeof body.contactsConsent!=='boolean'||typeof body.historyConsent!=='boolean'||body.noticeVersion!==META_APP_IMPORT_NOTICE_VERSION||body.confirmPreserveApp!==true)throw new WorkspaceError('META_CUSTOMER_SYNC_INPUT_INVALID');
  const requestDigest=digest(Object.fromEntries(selectedKeys.map(key=>[key,key==='action'?'start_app_sync':body[key]])));
  const plan=await within(session,body,async(client,member,_scope,project)=>{
   const c=await bound(client,member,project,body),current=c.metadata.coexistence;
   if(current.importConsent){
    if(current.importConsent.operationId!==body.operationId||current.importConsent.requestDigest!==requestDigest)throw new WorkspaceError('META_CUSTOMER_SYNC_ALREADY_SELECTED',409);
    return {replayed:true};
   }
   if(body.action==='continue_app_sync')throw new WorkspaceError('META_CUSTOMER_SYNC_UNAVAILABLE',409);
   if(!(Date.parse(current.syncDeadlineAt)>now()))throw new WorkspaceError('META_CUSTOMER_SYNC_WINDOW_EXPIRED',409);
   const consent={operationId:body.operationId,requestDigest,noticeVersion:META_APP_IMPORT_NOTICE_VERSION,noticeSha256:META_APP_IMPORT_NOTICE_SHA256,contacts:body.contactsConsent,history:body.historyConsent,actorId:member.actorId,confirmedAt:new Date(now()).toISOString()};
   await save(client,c,{...current,importConsent:consent,contacts:{state:body.contactsConsent?'NOT_REQUESTED':'NOT_SELECTED'},history:{state:body.historyConsent?'NOT_REQUESTED':'NOT_SELECTED'}});
   await client.query(`INSERT INTO public."AuditLog" (id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES ($1,$2,$3,'integration.whatsapp.import_consent','WhatsAppConnection',$4,$5::jsonb) ON CONFLICT (id) DO NOTHING`,['meta_import_consent_'+digest([c.id,body.operationId]),member.organizationId,member.actorId,c.id,JSON.stringify({version:1,noticeVersion:consent.noticeVersion,noticeSha256:consent.noticeSha256,contacts:consent.contacts,history:consent.history,requestDigest})]);
   return {replayed:false};
  });
  // An operation replay is a status check. The once-only Meta requests are never
  // replayed, even after a lost response, commit ACK or expired lease.
  if(plan.replayed&&body.action==='start_app_sync')return {saved:true,replayed:true};
  for(const kind of ['contacts','history']){
   if(!body[kind+'Consent'])continue;
   const claim=await within(session,body,async(client,member,_scope,project)=>{
    const c=await bound(client,member,project,body),s=c.metadata.coexistence;
    if(s.importConsent?.requestDigest!==requestDigest||Date.parse(s.syncDeadlineAt)<=now())throw new WorkspaceError('META_CUSTOMER_SYNC_UNAVAILABLE',409);
    if(s[kind]?.state!=='NOT_REQUESTED')return null;
    const leaseId=randomUUID(),step={state:'REQUEST_STARTED',leaseId,leaseExpiresAt:new Date(now()+60000).toISOString(),requestedAt:new Date(now()).toISOString()};
    await save(client,c,{...s,[kind]:step});
    return {channelId:c.id,phoneNumberId:c.phoneNumberId,tokenDigest:digest(c.encryptedAccessToken),leaseId,token:decryptCustomerSecret(c.encryptedAccessToken,{organizationId:member.organizationId,projectId:project.id,purpose:'access-token',resourceId:c.phoneNumberId},environment)};
   });
   if(!claim)continue;
   let result=null;
   try{result=await provider.syncAppData({token:claim.token,phoneNumberId:claim.phoneNumberId,syncType:types[kind]});}catch{}
   await within(session,body,async(client,member,_scope,project)=>{
    const c=await bound(client,member,project,body),s=c.metadata.coexistence,step=s[kind];
    if(c.id!==claim.channelId||digest(c.encryptedAccessToken)!==claim.tokenDigest||step?.leaseId!==claim.leaseId||!(step.state==='REQUEST_STARTED'||terminal.has(step.state)))throw new WorkspaceError('META_CUSTOMER_SYNC_LEASE_CHANGED',409);
    // A signed callback may arrive before the POST response. Never erase its
    // completed/declined observation with a delayed or missing response.
    await save(client,c,{...s,[kind]:{...step,state:step.observedAt?step.state:result?'REQUEST_ACCEPTED':'REQUEST_UNKNOWN',...(result?{requestId:result.requestId}:{}),responseObservedAt:new Date(now()).toISOString()}});
   });
   if(!result)return {saved:true,replayed:false,requiresReview:true};
  }
  return {saved:true,replayed:false};
 }};
}
