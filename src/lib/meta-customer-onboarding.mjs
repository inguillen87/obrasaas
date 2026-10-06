import {createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import {WorkspaceError,operationId,digest} from './workspace-policy.mjs';
import {readProjectWorkspaceProfile} from './whatsapp/project-workspace-profile.js';
import {metaAssetId,metaCustomerAuthorizationReady,developmentPilotUnavailableReadiness,META_CUSTOMER_INSPECTION_PHASE} from './meta-customer-provider.mjs';
import {readDevelopmentPilotPolicy,createDevelopmentPilotCapability,META_DEVELOPMENT_PILOT_MODE} from './meta-development-pilot-policy.mjs';
import {encryptCustomerSecret,decryptCustomerSecret,customerSecretDigest} from './meta-customer-credentials.mjs';
import {OBRASAAS_META_CHANNEL} from './meta-channel-binding.mjs';
import {createMetaCustomerTemplates,publicCustomerTemplateWorkbench} from './meta-customer-templates.mjs';
import {createMetaCustomerInboxReview,readMetaCustomerInbox,readMetaCustomerInboxReceipt} from './meta-customer-inbox-review.mjs';
import {createMetaCustomerActivation,publicCustomerActivation} from './meta-customer-activation.mjs';
import {customerSignupFlow,createMetaCustomerCoexistence,publicCustomerCoexistence,customerLifecycleRecovery} from './meta-customer-coexistence.mjs';

import {companyConnectionForProject,assertLegacyProjectChannel} from './company-channel-connection.mjs';
const activeStates=new Set(['PREPARED','EXCHANGE_STARTED','EXCHANGE_UNKNOWN','CREDENTIAL_STORED','VERIFYING','REVIEW_REQUIRED','LINKED_PENDING_ACCEPTANCE','REGISTRATION_REQUIRED','REGISTRATION_REJECTED','REGISTRATION_VERIFYING','REGISTRATION_STARTED','REGISTRATION_UNKNOWN']);
const secretContext=(member,project,purpose,resourceId)=>({organizationId:member.organizationId,projectId:project.id,purpose,resourceId});
const publicSignup=(state,time)=>state?{id:state.id,state:state.state,createdAt:state.createdAt,expiresAt:state.expiresAt,updatedAt:state.updatedAt,lastCode:state.lastCode||null,
 numberMode:state.numberMode||'DEDICATED',signupVersion:state.signupVersion||null,configId:state.configId||null,
 wabaId:state.wabaId||null,phoneNumberId:state.phoneNumberId||null,registrationRequired:state.numberMode!=='BUSINESS_APP'&&['REGISTRATION_REQUIRED','REGISTRATION_REJECTED'].includes(state.state),canRegister:state.numberMode!=='BUSINESS_APP'&&['REGISTRATION_REQUIRED','REGISTRATION_REJECTED'].includes(state.state),canRetryRegistration:state.numberMode!=='BUSINESS_APP'&&state.state==='REGISTRATION_REJECTED',canCancel:state.state==='PREPARED',canReconcile:Boolean(state.encryptedToken)&&state.state!=='CANCELLED'&&(state.state!=='VERIFYING'||new Date(state.verificationLeaseExpiresAt).getTime()<=time)&&(!['REGISTRATION_VERIFYING','REGISTRATION_STARTED'].includes(state.state)||new Date(state.registrationLeaseExpiresAt).getTime()<=time),operational:false}:null;
function registrationAttempts(state){
 let attempts=state.registrationAttempts||[];
 if(!Array.isArray(attempts)||attempts.length>20)throw new WorkspaceError('META_CUSTOMER_BINDING_INTEGRITY',409);
 attempts=attempts.map(attempt=>({...attempt,pinDigestScheme:attempt.pinDigestScheme||'sha256-legacy-v1'}));
 if(state.registrationOperationId&&!attempts.some(attempt=>attempt.operationId===state.registrationOperationId))return [...attempts,{operationId:state.registrationOperationId,pinDigest:state.pinDigest,pinDigestScheme:state.pinDigestScheme||'sha256-legacy-v1',state:state.state==='REGISTRATION_REJECTED'?'REJECTED':'UNKNOWN'}];
 return attempts;
}
function registrationPinDigest(pin,scheme,state,member,project,operation,environment){
 if(scheme==='sha256-legacy-v1')return customerSecretDigest(pin);
 if(scheme!=='hmac-sha256-v1')throw new WorkspaceError('META_CUSTOMER_BINDING_INTEGRITY',409);
 return createHmac('sha256',environment.META_APP_SECRET).update(JSON.stringify(['customer-registration-pin-v1',member.organizationId,project.id,state.id,operation,pin])).digest('hex');
}
function registrationOutcome(state,operationId,outcome){return registrationAttempts(state).map(attempt=>attempt.operationId===operationId?{...attempt,...outcome}:attempt);}
function unregisteredState(state){
 if(!state.registrationOperationId)return 'REGISTRATION_REQUIRED';
 const latest=registrationAttempts(state).find(attempt=>attempt.operationId===state.registrationOperationId);
 if(latest?.state==='REJECTED')return 'REGISTRATION_REJECTED';
 if(latest?.state==='NOT_SENT')return state.registrationResumeState==='REGISTRATION_REJECTED'?'REGISTRATION_REJECTED':'REGISTRATION_REQUIRED';
 return 'REGISTRATION_UNKNOWN';
}
function stateToken(state,member,project,environment){return createHmac('sha256',environment.META_APP_SECRET).update(JSON.stringify([state.id,member.actorId,member.organizationId,project.id,state.preparedRevision,state.expiresAt,state.numberMode,state.configId,state.signupVersion])).digest('base64url');}
function checkToken(value,expected){if(typeof value!=='string'||value.length!==expected.length||!timingSafeEqual(Buffer.from(value),Buffer.from(expected)))throw new WorkspaceError('META_CUSTOMER_STATE_REJECTED',403);}
function input(body,fields){if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join('|')!==fields.sort().join('|')||!operationId(body.operationId))throw new WorkspaceError('META_CUSTOMER_INPUT_INVALID');}
export function createMetaCustomerOnboarding({workspace,provider,processor=null,environment=process.env,now=()=>Date.now(),scopedProvider=false}){
 if(provider.forWorkspace&&!scopedProvider){
  const ordinary=createMetaCustomerOnboarding({workspace,provider,processor,environment,now,scopedProvider:true});
  const resolve=async(session,context)=>{
   const canonical=await workspace.integrationProject(session,context,false,async(client,member,_scope,project)=>({member,session,project:{...project,organizationId:member.organizationId,companyRouting:Boolean(await companyConnectionForProject(client,member.organizationId,project.id)),pilotConnectionMarker:(await client.query(`SELECT metadata->'developmentPilot' AS pilot FROM public."WhatsAppConnection" WHERE "projectId"=$1`,[project.id])).rows[0]?.pilot||null}}));
   if(context.action&&(canonical.project.pilotConnectionMarker||canonical.project.metadata?.metaSignup?.developmentPilot||createDevelopmentPilotCapability(canonical,environment,now()))&&!['begin','complete','cancel','reconcile','register_number','restart_authorization','activate_channel','deactivate_channel','process_inbox','review_inbox'].includes(context.action))throw new WorkspaceError('META_DEVELOPMENT_PILOT_ADAPTER_UNAVAILABLE',409);
   const scoped=await provider.forWorkspace(canonical);
   return scoped===provider?ordinary:createMetaCustomerOnboarding({workspace,provider:scoped,processor,environment,now,scopedProvider:true});
  };
  return {read:async(session,context)=>(await resolve(session,context)).read(session,context),command:async(session,body)=>{
   if(!['begin','complete','cancel','reconcile','refresh_templates','register_number','restart_authorization','activate_channel','deactivate_channel','process_inbox','review_inbox','prepare_template','submit_template','recover_template','start_app_sync','continue_app_sync','prepare_existing_api_plan'].includes(body?.action))return ordinary.command(session,body);
   return (await resolve(session,body)).command(session,body);
  }};
 }
 // Delegated legacy services share the same per-transaction fence; disabling
 // their controls in the browser alone cannot protect a corporate assignment.
 const guardedWorkspace={...workspace,integrationProject:(session,context,writable,run,beforeProject)=>workspace.integrationProject(session,context,writable,async(client,member,scope,project)=>{
  let pilotDigest=null;
  const currentPilot=async()=>{
   const time=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now.getTime(),policy=readDevelopmentPilotPolicy(environment,time);
   if(!policy||pilotDigest&&pilotDigest!==policy.policyDigest||member.role!=='ADMIN'||member.actorId!==policy.actorId||member.organizationId!==policy.organizationId||session.userId!==policy.clerkUserId||session.organizationId!==policy.clerkOrganizationId||session.organizationRole!=='org:admin'||project.id!==policy.projectId)throw new WorkspaceError('META_DEVELOPMENT_PILOT_UNAVAILABLE',403);
   pilotDigest=policy.policyDigest;provider.assertWorkspace?.({member,session,project:{...project,organizationId:member.organizationId}});
  };
  if(writable){
   await assertLegacyProjectChannel(client,member,project.id);
   if(!['cancel','deactivate_channel','review_inbox'].includes(context.action)){
    provider.assertWorkspace?.({member,session,project:{...project,organizationId:member.organizationId}});
    const stored=project.metadata?.metaSignup?.developmentPilot||(readDevelopmentPilotPolicy(environment,now())?(await client.query(`SELECT metadata->'developmentPilot' AS pilot FROM public."WhatsAppConnection" WHERE "projectId"=$1`,[project.id])).rows[0]?.pilot:null);
    if(stored||provider.readiness().mode===META_DEVELOPMENT_PILOT_MODE){pilotDigest=stored?.policyDigest||null;await currentPilot();}
    if((stored||provider.readiness().mode===META_DEVELOPMENT_PILOT_MODE)&&!['begin','complete','reconcile','register_number','restart_authorization','activate_channel','process_inbox'].includes(context.action))throw new WorkspaceError('META_DEVELOPMENT_PILOT_ADAPTER_UNAVAILABLE',409);
   }
  }const result=await run(client,member,scope,project);if(pilotDigest)await currentPilot();return result;
 },beforeProject)};
 const templateService=createMetaCustomerTemplates({workspace:guardedWorkspace,provider,environment,now});
 const inboxService=createMetaCustomerInboxReview({workspace:guardedWorkspace,environment,now});
 const activationService=createMetaCustomerActivation({workspace:guardedWorkspace,provider,environment,now});
 const coexistenceService=createMetaCustomerCoexistence({workspace:guardedWorkspace,provider,environment,now});
 const within=(...args)=>guardedWorkspace.integrationProject(...args);
 function flow(numberMode){const ready=provider.readiness();if(ready.mode===META_DEVELOPMENT_PILOT_MODE){if(numberMode!=='DEDICATED'||!metaCustomerAuthorizationReady(ready))throw new WorkspaceError(ready.pilot.code,503);return {numberMode:'DEDICATED',configId:ready.configId,signupVersion:'4',developmentPilot:provider.pilotReference()};}return customerSignupFlow(ready,numberMode);}
 function requirePreparation(project){const {profile}=readProjectWorkspaceProfile(project.metadata,project.organizationMetadata,project.id);if(!profile.configured||!['DEDICATED','BUSINESS_APP'].includes(profile.numberMode))throw new WorkspaceError('META_CUSTOMER_PREPARATION_REQUIRED',409);flow(profile.numberMode);return profile;}
 function owned(project,member,id){const state=project.metadata?.metaSignup;if(!state||state.id!==id||state.actorId!==member.actorId||state.organizationId!==member.organizationId)throw new WorkspaceError('META_CUSTOMER_SESSION_UNAVAILABLE',404);return state;}
 async function save(client,member,project,state,operation,code){
  const updated={...state,updatedAt:new Date(now()).toISOString()};
  const write=await client.query(`UPDATE public."Project" SET metadata=$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "organizationId"=$2`,[project.id,member.organizationId,JSON.stringify({...project.metadata,metaSignup:updated})]);
  if(write.rowCount!==1)throw new WorkspaceError('META_CUSTOMER_WRITE_UNCONFIRMED',503);
  if(operation){const receipt='meta_customer_'+digest([project.id,member.actorId,operation,updated.state]);
   await client.query(`INSERT INTO public."AuditLog" (id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES ($1,$2,$3,'integration.whatsapp.customer_state','Project',$4,$5::jsonb) ON CONFLICT (id) DO NOTHING`,[receipt,member.organizationId,member.actorId,project.id,JSON.stringify({version:1,signupId:state.id,state:updated.state,code:code||null,operationDigest:customerSecretDigest(operation),...(state.developmentPilot?{mode:'DEVELOPMENT_PILOT',policyDigest:state.developmentPilot.policyDigest,expiresAt:state.developmentPilot.expiresAt,attendanceOnly:true}:{})})]);}
  project.metadata={...project.metadata,metaSignup:updated};return updated;
 }
 async function response(client,member,scope,project,context={}){
  const connections=await client.query(`SELECT id,"projectId","phoneNumberId","whatsappBusinessId","displayPhoneNumber",enabled,"connectionStatus"::text AS status,"connectionStatus"::text AS "connectionStatus",metadata FROM public."WhatsAppConnection" WHERE "projectId"=$1`,[project.id]);
  if(connections.rows.length>1)throw new WorkspaceError('META_CUSTOMER_BINDING_INTEGRITY',409);
  const corporate=await companyConnectionForProject(client,member.organizationId,project.id),connection=corporate?{...corporate,status:corporate.connectionStatus}:connections.rows[0],state=project.metadata?.metaSignup;
  const signup=state?.actorId===member.actorId&&state?.organizationId===member.organizationId?publicSignup(state,now()):null;
  if(signup)signup.canRestart=!connection&&!state.encryptedToken&&(state.state==='EXCHANGE_UNKNOWN'||state.state==='EXCHANGE_STARTED'&&new Date(state.exchangeLeaseExpiresAt).getTime()<=now());
  let readiness=provider.readiness();const pilot=connection?.metadata?.developmentPilot||state?.developmentPilot;if(pilot&&readiness.mode!==META_DEVELOPMENT_PILOT_MODE)readiness=developmentPilotUnavailableReadiness(readiness,pilot.expiresAt);
  if(pilot&&readiness.mode===META_DEVELOPMENT_PILOT_MODE){const current=readDevelopmentPilotPolicy(environment,now());if(!current||pilot.policyDigest!==current.policyDigest||pilot.expiresAt!==current.expiresAt||state?.developmentPilot&&state.developmentPilot.policyDigest!==current.policyDigest)readiness=developmentPilotUnavailableReadiness(readiness,pilot.expiresAt);}
  const profile=readProjectWorkspaceProfile(project.metadata,project.organizationMetadata,project.id).profile;
  if(readiness.mode===META_DEVELOPMENT_PILOT_MODE&&(profile.numberMode&&profile.numberMode!=='DEDICATED'||connection&&!connection.metadata?.developmentPilot))readiness=developmentPilotUnavailableReadiness(readiness,readiness.pilot.expiresAt,'META_DEVELOPMENT_PILOT_ADAPTER_UNAVAILABLE');
  const activation=publicCustomerActivation(connection,readiness,member,now(),profile.numberMode,environment),legacyBlocked=corporate&&(corporate.projectId!==project.id||['COMPANY','SUSPENDED'].includes(corporate.company.mode));
  const currentActivation=legacyBlocked?{...activation,operational:corporate.company.mode==='COMPANY'&&activation.operational,canActivate:false,canDeactivate:false}:activation;
  const currentCoexistence=publicCustomerCoexistence(connection,readiness,now()),coexistence=readiness.mode===META_DEVELOPMENT_PILOT_MODE&&currentCoexistence?{...currentCoexistence,canSelectImport:false,canContinueImport:false}:currentCoexistence;
  return {scope,projectId:project.id,companyName:member.organizationName,projectName:project.name,readiness,...(corporate?{companyRouting:{mode:corporate.company.mode,connectionId:corporate.id,anchorProjectId:corporate.projectId,legacyActionsBlocked:corporate.projectId!==project.id||['COMPANY','SUSPENDED'].includes(corporate.company.mode),attendance:true,kyc:false,media:false,flows:false,templates:false,accepted:false}}:{}),
   prepared:profile.configured,numberMode:profile.numberMode||null,preparedRevision:profile.revision,signup,
   stateToken:signup?.state==='PREPARED'&&metaCustomerAuthorizationReady(readiness)?stateToken(state,member,project,environment):null,
   connection:connection?{recordPresent:true,displayNumber:connection.displayPhoneNumber,wabaId:connection.whatsappBusinessId,phoneNumberId:connection.phoneNumberId,enabled:connection.enabled===true,storedStatus:connection.status,operational:currentActivation.operational}:null,
   coexistence,
   existingApiPlan:project.metadata?.metaExistingApiPlan?{state:project.metadata.metaExistingApiPlan.state,preparedAt:project.metadata.metaExistingApiPlan.preparedAt,preserveProvider:true,providerChanged:false}:null,
   activation:currentActivation,
   templates:connection?.metadata?.customerTemplates||null,templateWorkbench:publicCustomerTemplateWorkbench(connection),inbox:await readMetaCustomerInbox(client,member,project,connection,environment,{after:context.after||null}),...(context.operationId?{receipt:await readMetaCustomerInboxReceipt(client,member,project,connection,environment,context)}:{}),acceptance:{roundTrip:'NOT_VERIFIED',fieldJourney:'NOT_VERIFIED'}};
 }
 async function assertAssetVacant(client,project,wabaId,phoneNumberId){
  if(wabaId===OBRASAAS_META_CHANNEL.wabaId||phoneNumberId===OBRASAAS_META_CHANNEL.phoneNumberId)throw new WorkspaceError('META_CUSTOMER_DEMO_ASSET_REJECTED',403);
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['customer-waba:'+wabaId]);
  const other=await client.query(`SELECT id,"projectId" FROM public."WhatsAppConnection" WHERE ("phoneNumberId"=$1 OR "whatsappBusinessId"=$2) AND "projectId"<>$3`,[phoneNumberId,wabaId,project.id]);
  if(other.rows.length)throw new WorkspaceError('META_CUSTOMER_ASSET_ALREADY_BOUND',409);
 }
 async function sealLegacyLifecycle(client,project,connection){
  if(!connection||connection.metadata?.customerLifecycle?.recovery)return;
  const recovery=customerLifecycleRecovery(connection);if(!recovery)return;
  // Before a canonical reauthorization replaces the grant ID, materialize the
  // old restriction against that old grant. No callback between steps is needed.
  const lifecycle={...connection.metadata.customerLifecycle,authorizationSignupId:recovery.authorizationSignupId||connection.metadata.customerSignupId||null,recovery:{...recovery,authorizationSignupId:recovery.authorizationSignupId||connection.metadata.customerSignupId||null}};
  const written=await client.query(`UPDATE public."WhatsAppConnection" SET metadata=metadata||$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[connection.id,project.id,JSON.stringify({customerLifecycle:lifecycle})]);
  if(written.rowCount!==1)throw new WorkspaceError('META_CUSTOMER_BINDING_INTEGRITY',409);
  connection.metadata={...connection.metadata,customerLifecycle:lifecycle};
 }
 async function reconcile(session,body){
  const claim=await within(session,body,true,async(client,member,scope,project)=>{
    let state=owned(project,member,body.signupId);requirePreparation(project);
   if(state.state==='LINKED_PENDING_ACCEPTANCE')return {already:true,result:await response(client,member,scope,project)};
    if(!state.encryptedToken||!(['CREDENTIAL_STORED','REVIEW_REQUIRED','REGISTRATION_REQUIRED','REGISTRATION_REJECTED','REGISTRATION_UNKNOWN'].includes(state.state)||state.state==='VERIFYING'&&new Date(state.verificationLeaseExpiresAt).getTime()<=now()||['REGISTRATION_VERIFYING','REGISTRATION_STARTED'].includes(state.state)&&new Date(state.registrationLeaseExpiresAt).getTime()<=now()))throw new WorkspaceError('META_CUSTOMER_RECONCILIATION_UNAVAILABLE',409);
    // A reclaimed preflight never authorized a register POST. Its old worker
    // must recheck this fence before sending, so a fresh explicit retry is safe.
    if(state.state==='REGISTRATION_VERIFYING')state={...state,registrationAttempts:registrationOutcome(state,state.registrationOperationId,{state:'NOT_SENT',finishedAt:new Date(now()).toISOString(),lastCode:'META_CUSTOMER_REGISTRATION_PREFLIGHT_EXPIRED'})};
   await assertAssetVacant(client,project,state.wabaId,state.phoneNumberId);
   const token=decryptCustomerSecret(state.encryptedToken,secretContext(member,project,'signup',state.id),environment);
   const verificationLeaseId=randomUUID();
   await save(client,member,project,{...state,state:'VERIFYING',lastCode:null,verificationLeaseId,verificationLeaseExpiresAt:new Date(now()+60000).toISOString()},body.operationId);
   return {token,state,member,project,verificationLeaseId};
  });
  if(claim.already)return claim.result;
  try{
   const mode=claim.state.numberMode||'DEDICATED';
   const verified=await provider.inspect({token:claim.token,wabaId:claim.state.wabaId,phoneNumberId:claim.state.phoneNumberId,numberMode:mode,inspectionPhase:META_CUSTOMER_INSPECTION_PHASE.PRE_REGISTRATION});
   // Persist an exclusive asset binding before subscribing to any remote WABA.
   await within(session,body,true,async(client,member,_scope,project)=>{
    const state=owned(project,member,body.signupId);if(state.state!=='VERIFYING'||state.verificationLeaseId!==claim.verificationLeaseId)throw new WorkspaceError('META_CUSTOMER_STATE_CHANGED',409);
    if(requirePreparation(project).revision!==state.preparedRevision)throw new WorkspaceError('META_CUSTOMER_PREPARATION_CHANGED',409);
    if(mode==='BUSINESS_APP'){
     if(verified.isOnBizApp!==true||verified.platformType!=='CLOUD_API'||!metaAssetId(verified.phoneNumberId))throw new WorkspaceError('META_CUSTOMER_COEXISTENCE_PHONE_REQUIRED',409);
     if(state.existingConnection&&(state.existingConnection.wabaId!==state.wabaId||state.existingConnection.phoneNumberId!==verified.phoneNumberId))throw new WorkspaceError('META_CUSTOMER_EXISTING_CONNECTION_REVIEW',409);
     state.phoneNumberId=verified.phoneNumberId;claim.state.phoneNumberId=verified.phoneNumberId;
     await save(client,member,project,state,body.operationId);
    }
    await assertAssetVacant(client,project,state.wabaId,state.phoneNumberId);
    const existing=await client.query(`SELECT id,metadata,"phoneNumberId","whatsappBusinessId" FROM public."WhatsAppConnection" WHERE "projectId"=$1 FOR UPDATE`,[project.id]);
    const preserved=mode==='BUSINESS_APP'&&state.existingConnection&&existing.rows.length===1&&existing.rows[0].id===state.existingConnection.id&&existing.rows[0].phoneNumberId===state.phoneNumberId&&existing.rows[0].whatsappBusinessId===state.wabaId&&existing.rows[0].metadata?.credentialOrganizationId===member.organizationId;
    if(existing.rows.length&&!preserved&&!(existing.rows.length===1&&existing.rows[0].metadata?.customerSignupId===state.id&&existing.rows[0].phoneNumberId===state.phoneNumberId&&existing.rows[0].whatsappBusinessId===state.wabaId))throw new WorkspaceError('META_CUSTOMER_EXISTING_CONNECTION_REVIEW',409);
    await sealLegacyLifecycle(client,project,existing.rows[0]);
    // Existing matching assets retain their credential and operating state
    // until the new grant and subscription have both been verified.
    if(preserved)return;
    const encryptedToken=encryptCustomerSecret(claim.token,secretContext(member,project,'access-token',state.phoneNumberId),environment);
    const pilotProof=provider.pilotProvenance?.(verified),metadata={...(existing.rows[0]?.metadata||{}),credentialFormat:'tenant-aad-v2',credentialOrganizationId:member.organizationId,customerSignupId:state.id,customerVerification:verified,...(pilotProof?{developmentPilot:pilotProof}:{}),roundTrip:'NOT_VERIFIED',fieldAcceptance:'NOT_VERIFIED'};
    await client.query(`INSERT INTO public."WhatsAppConnection" (id,"projectId","phoneNumberId","whatsappBusinessId","displayPhoneNumber",enabled,"connectionStatus","encryptedAccessToken","verifiedBusinessName",metadata,"updatedAt") VALUES ($1,$2,$3,$4,$5,false,'PENDING',$6,$7,$8::jsonb,clock_timestamp()) ON CONFLICT ("projectId") DO UPDATE SET "encryptedAccessToken"=EXCLUDED."encryptedAccessToken",metadata=EXCLUDED.metadata,"updatedAt"=clock_timestamp()`,[existing.rows[0]?.id||'wa_customer_'+randomUUID().replaceAll('-',''),project.id,state.phoneNumberId,state.wabaId,verified.displayPhoneNumber,encryptedToken,verified.verifiedBusinessName,JSON.stringify(metadata)]);
   });
   await provider.subscribe({token:claim.token,wabaId:claim.state.wabaId});
   return await within(session,body,true,async(client,member,scope,project)=>{
    const state=owned(project,member,body.signupId);if(state.state!=='VERIFYING'||state.verificationLeaseId!==claim.verificationLeaseId)throw new WorkspaceError('META_CUSTOMER_STATE_CHANGED',409);
    if(requirePreparation(project).revision!==state.preparedRevision)throw new WorkspaceError('META_CUSTOMER_PREPARATION_CHANGED',409);
    if(mode==='BUSINESS_APP'){
     const bound=(await client.query(`SELECT id,"encryptedAccessToken",metadata,"phoneNumberId","whatsappBusinessId" FROM public."WhatsAppConnection" WHERE "projectId"=$1 FOR UPDATE`,[project.id])).rows;
     const c=bound[0];if(bound.length!==1||c.phoneNumberId!==state.phoneNumberId||c.whatsappBusinessId!==state.wabaId||c.metadata?.credentialOrganizationId!==member.organizationId||state.existingConnection&&(c.id!==state.existingConnection.id||digest(c.encryptedAccessToken)!==state.existingConnection.tokenDigest))throw new WorkspaceError('META_CUSTOMER_EXISTING_CONNECTION_REVIEW',409);
     const old=c.metadata.coexistence;
     const coexistence=old?.verified===true?old:{version:1,verified:true,verifiedAt:new Date(now()).toISOString(),syncDeadlineAt:new Date(Date.parse(state.authCompletedAt)+24*60*60000).toISOString(),contacts:{state:'NOT_SELECTED'},history:{state:'NOT_SELECTED'},echoes:0};
     await client.query(`UPDATE public."WhatsAppConnection" SET "encryptedAccessToken"=$3,metadata=metadata||$4::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[c.id,project.id,encryptCustomerSecret(claim.token,secretContext(member,project,'access-token',state.phoneNumberId),environment),JSON.stringify({customerSignupId:state.id,customerVerification:verified,coexistence})]);
    }
    await client.query(`UPDATE public."WhatsAppConnection" SET metadata=metadata||$3::jsonb,"lastVerifiedAt"=clock_timestamp(),"updatedAt"=clock_timestamp() WHERE "projectId"=$1 AND "phoneNumberId"=$2`,[project.id,state.phoneNumberId,JSON.stringify({customerSubscribed:true,customerVerification:verified})]);
     await save(client,member,project,{...state,state:verified.registered?'LINKED_PENDING_ACCEPTANCE':unregisteredState(state),...(verified.registered&&state.registrationOperationId?{registrationAttempts:registrationOutcome(state,state.registrationOperationId,{state:'REGISTERED',finishedAt:new Date(now()).toISOString()})}:{}),lastCode:null},body.operationId);
    return response(client,member,scope,project);
   });
  }catch(error){
   try{await within(session,body,true,async(client,member,_scope,project)=>{const state=owned(project,member,body.signupId);if(state.state==='VERIFYING'&&state.verificationLeaseId===claim.verificationLeaseId)await save(client,member,project,{...state,state:'REVIEW_REQUIRED',lastCode:error instanceof WorkspaceError?error.code:'META_CUSTOMER_PROVIDER_UNCONFIRMED'},body.operationId);});}catch{}
   throw error;
  }
 }
 return {
  read(session,context){return within(session,context,false,(client,member,scope,project)=>response(client,member,scope,project,context));},
  async command(session,body){
   const action=body?.action;
   if(['start_app_sync','continue_app_sync'].includes(action)){await coexistenceService.command(session,body);return within(session,body,false,response);}
   if(action==='prepare_existing_api_plan'){await coexistenceService.prepareExistingApiPlan(session,body);return within(session,body,false,response);}
   if(action==='process_inbox'&&processor){
    input(body,['action','operationId','projectId','scope','eventId']);if(!/^customer_webhook_[a-f0-9]{64}$/.test(body.eventId||''))throw new WorkspaceError('META_CUSTOMER_INBOX_INPUT_INVALID');
    await within(session,body,false,async(client,member,_scope,project)=>{await assertLegacyProjectChannel(client,member,project.id);const found=(await client.query(`SELECT e.id FROM public."WebhookEvent" e JOIN public."WhatsAppConnection" c ON c."projectId"=e."projectId" AND c.id=e.payload->>'channelId' WHERE e.id=$1 AND e."projectId"=$2 AND e.provider='meta-customer-v1'`,[body.eventId,project.id])).rows;if(found.length!==1)throw new WorkspaceError('META_CUSTOMER_INBOX_UNAVAILABLE',404);});
    await processor.process(body.eventId);return within(session,body,false,response);
   }
   if(['activate_channel','deactivate_channel'].includes(action)){await activationService.command(session,body);return within(session,body,false,response);}
   if(['process_inbox','review_inbox'].includes(action)){await inboxService.command(session,body);return within(session,body,false,response);}
   if(['prepare_template','submit_template','recover_template'].includes(action)){await templateService.command(session,body);return within(session,body,false,response);}
   const base=['action','operationId','projectId','scope'];
   input(body,action==='begin'?[...base,'preparedRevision']:action==='restart_authorization'?[...base,'signupId','preparedRevision','confirmFreshAuthorization','reason']:action==='complete'?[...base,'signupId','stateToken','code','wabaId','phoneNumberId',...(Object.hasOwn(body,'signupEvent')?['signupEvent']:[])]:action==='register_number'?[...base,'signupId','pin','confirmRegistration']:[...base,'signupId']);
   if(!['begin','complete','cancel','reconcile','refresh_templates','register_number','restart_authorization'].includes(action))throw new WorkspaceError('META_CUSTOMER_INPUT_INVALID');
   if(action==='reconcile')return reconcile(session,body);
   if(action==='register_number'){
     if(typeof body.pin!=='string'||!/^\d{6}$/.test(body.pin)||body.confirmRegistration!==true)throw new WorkspaceError('META_CUSTOMER_REGISTRATION_INPUT_INVALID');
    const reserved=await within(session,body,true,async(client,member,scope,project)=>{
     const state=owned(project,member,body.signupId);
     if(state.numberMode==='BUSINESS_APP')throw new WorkspaceError('META_CUSTOMER_COEXISTENCE_REGISTER_FORBIDDEN',409);
      const attempts=registrationAttempts(state),previous=attempts.find(attempt=>attempt.operationId===body.operationId),pinDigestScheme='hmac-sha256-v1';
      if(previous){if(previous.pinDigest!==registrationPinDigest(body.pin,previous.pinDigestScheme,state,member,project,body.operationId,environment))throw new WorkspaceError('META_CUSTOMER_OPERATION_CONFLICT',409);return {replayed:true,result:await response(client,member,scope,project)};}
      const pinDigest=registrationPinDigest(body.pin,pinDigestScheme,state,member,project,body.operationId,environment);
      if(!['REGISTRATION_REQUIRED','REGISTRATION_REJECTED'].includes(state.state)||requirePreparation(project).revision!==state.preparedRevision)throw new WorkspaceError('META_CUSTOMER_REGISTRATION_UNAVAILABLE',409);
      if(attempts.length>=20)throw new WorkspaceError('META_CUSTOMER_REGISTRATION_REVIEW_REQUIRED',409);
      if(now()-Date.parse(state.authCompletedAt||state.createdAt)>=14*24*60*60*1000)throw new WorkspaceError('META_CUSTOMER_REGISTRATION_WINDOW_EXPIRED',409);
     await assertAssetVacant(client,project,state.wabaId,state.phoneNumberId);
     const token=decryptCustomerSecret(state.encryptedToken,secretContext(member,project,'signup',state.id),environment);
      const channel=(await client.query(`SELECT id,"encryptedAccessToken",metadata FROM public."WhatsAppConnection" WHERE "projectId"=$1 AND "phoneNumberId"=$2 AND "whatsappBusinessId"=$3 FOR UPDATE`,[project.id,state.phoneNumberId,state.wabaId])).rows[0];
      if(!channel||channel.metadata?.customerSignupId!==state.id||channel.metadata.credentialOrganizationId!==member.organizationId||channel.metadata.credentialFormat!=='tenant-aad-v2')throw new WorkspaceError('META_CUSTOMER_BINDING_INTEGRITY',409);
      const leaseId=randomUUID();
      await save(client,member,project,{...state,state:'REGISTRATION_VERIFYING',registrationOperationId:body.operationId,pinDigest,pinDigestScheme,registrationLeaseId:leaseId,registrationResumeState:state.state,registrationLeaseExpiresAt:new Date(now()+60000).toISOString(),registrationAttempts:[...attempts,{operationId:body.operationId,pinDigest,pinDigestScheme,state:'VERIFYING',startedAt:new Date(now()).toISOString()}]},body.operationId);
      return {token,state,channel,leaseId};
    });
    if(reserved.replayed)return reserved.result;
     const fenced=async(client,member,project,expected)=>{
      const state=owned(project,member,body.signupId);
      if(state.registrationOperationId!==body.operationId||state.registrationLeaseId!==reserved.leaseId||state.state!==expected||!(Date.parse(state.registrationLeaseExpiresAt)>now())||state.encryptedToken!==reserved.state.encryptedToken)throw new WorkspaceError('META_CUSTOMER_REGISTRATION_LEASE_CHANGED',409);
      if(requirePreparation(project).revision!==state.preparedRevision)throw new WorkspaceError('META_CUSTOMER_PREPARATION_CHANGED',409);
      const row=(await client.query(`SELECT id,"encryptedAccessToken",metadata FROM public."WhatsAppConnection" WHERE "projectId"=$1 AND "phoneNumberId"=$2 AND "whatsappBusinessId"=$3 FOR UPDATE`,[project.id,state.phoneNumberId,state.wabaId])).rows[0];
      if(row?.id!==reserved.channel.id||row.encryptedAccessToken!==reserved.channel.encryptedAccessToken||row.metadata?.customerSignupId!==state.id)throw new WorkspaceError('META_CUSTOMER_BINDING_INTEGRITY',409);
      return state;
     };
     let verified;
     try{verified=await provider.inspect({token:reserved.token,wabaId:reserved.state.wabaId,phoneNumberId:reserved.state.phoneNumberId,inspectionPhase:META_CUSTOMER_INSPECTION_PHASE.PRE_REGISTRATION});}
     catch(error){await within(session,body,true,async(client,member,_scope,project)=>{const state=await fenced(client,member,project,'REGISTRATION_VERIFYING');await save(client,member,project,{...state,state:state.registrationResumeState,lastCode:error instanceof WorkspaceError?error.code:'META_CUSTOMER_PROVIDER_UNCONFIRMED',registrationAttempts:registrationOutcome(state,body.operationId,{state:'NOT_SENT',finishedAt:new Date(now()).toISOString()})},body.operationId);}).catch(()=>{});throw error;}
     await within(session,body,true,async(client,member,_scope,project)=>{
      const state=await fenced(client,member,project,'REGISTRATION_VERIFYING');
      if(!verified.registered){const written=await client.query(`UPDATE public."WhatsAppConnection" SET "encryptedPin"=$3,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[reserved.channel.id,project.id,encryptCustomerSecret(body.pin,secretContext(member,project,'registration-pin',state.phoneNumberId),environment)]);if(written.rowCount!==1)throw new WorkspaceError('META_CUSTOMER_BINDING_INTEGRITY',409);}
      await save(client,member,project,{...state,state:verified.registered?'REGISTRATION_UNKNOWN':'REGISTRATION_STARTED',registrationLeaseExpiresAt:new Date(now()+60000).toISOString(),registrationAttempts:registrationOutcome(state,body.operationId,{state:verified.registered?'REGISTERED':'STARTED'})},body.operationId);
     });
     if(verified.registered)return reconcile(session,body);
     let rejected=false,registrationCode=null;
     try{await provider.register({token:reserved.token,phoneNumberId:reserved.state.phoneNumberId,pin:body.pin});}
     catch(error){rejected=error instanceof WorkspaceError&&error.code==='META_CUSTOMER_PROVIDER_REJECTED'&&error.status===409;registrationCode=rejected?'META_CUSTOMER_REGISTRATION_REJECTED':'META_CUSTOMER_REGISTRATION_UNCONFIRMED';}
     const result=await within(session,body,true,async(client,member,scope,project)=>{const state=await fenced(client,member,project,'REGISTRATION_STARTED');await save(client,member,project,{...state,state:rejected?'REGISTRATION_REJECTED':'REGISTRATION_UNKNOWN',lastCode:registrationCode,registrationAttempts:registrationOutcome(state,body.operationId,{state:rejected?'REJECTED':'UNKNOWN',finishedAt:new Date(now()).toISOString(),lastCode:registrationCode})},body.operationId);return response(client,member,scope,project);});
     if(rejected)return result;
    // Only read-only inspection may recover an uncertain registration; never a second register POST.
    return reconcile(session,body);
   }
   if(action==='begin')return within(session,body,true,async(client,member,scope,project)=>{
    if(!metaCustomerAuthorizationReady(provider.readiness()))throw new WorkspaceError(provider.readiness().pilot?.code||'META_CUSTOMER_CONFIGURATION_PENDING',503);
    const profile=requirePreparation(project);if(profile.revision!==body.preparedRevision)throw new WorkspaceError('META_CUSTOMER_PREPARATION_CHANGED',409);
    const previous=project.metadata?.metaSignup;
    if(previous?.operationId===body.operationId){if(previous.actorId!==member.actorId)throw new WorkspaceError('META_CUSTOMER_SESSION_UNAVAILABLE',404);if(previous.startRequestDigest!==digest(body))throw new WorkspaceError('META_CUSTOMER_OPERATION_CONFLICT',409);return response(client,member,scope,project);}
    if(previous&&activeStates.has(previous.state)&&!(profile.numberMode==='BUSINESS_APP'&&previous.state==='LINKED_PENDING_ACCEPTANCE'))throw new WorkspaceError('META_CUSTOMER_ATTEMPT_ALREADY_ACTIVE',409);
    const existing=await client.query(`SELECT id,"whatsappBusinessId","phoneNumberId","encryptedAccessToken",metadata FROM public."WhatsAppConnection" WHERE "projectId"=$1 FOR UPDATE`,[project.id]);
    if(existing.rows.length&&(profile.numberMode!=='BUSINESS_APP'||existing.rows.length!==1||existing.rows[0].metadata?.credentialFormat!=='tenant-aad-v2'||existing.rows[0].metadata.credentialOrganizationId!==member.organizationId))throw new WorkspaceError('META_CUSTOMER_EXISTING_CONNECTION_REVIEW',409);
    const c=existing.rows[0],signupFlow=flow(profile.numberMode);
    await sealLegacyLifecycle(client,project,c);
    if(previous){const history=project.metadata.metaSignupHistory||[];if(!Array.isArray(history)||history.length>=20)throw new WorkspaceError('META_CUSTOMER_RESTART_REVIEW_REQUIRED',409);project.metadata={...project.metadata,metaSignupHistory:[...history,{id:previous.id,state:previous.state,codeDigest:previous.codeDigest,wabaId:previous.wabaId,phoneNumberId:previous.phoneNumberId,actorId:previous.actorId,createdAt:previous.createdAt,restartedAt:new Date(now()).toISOString(),remoteAuthorizationRevoked:false}]};}
    await save(client,member,project,{version:1,id:randomUUID(),actorId:member.actorId,organizationId:member.organizationId,preparedRevision:profile.revision,operationId:body.operationId,startRequestDigest:digest(body),...signupFlow,...(c?{existingConnection:{id:c.id,wabaId:c.whatsappBusinessId,phoneNumberId:c.phoneNumberId,tokenDigest:digest(c.encryptedAccessToken)}}:{}),state:'PREPARED',createdAt:new Date(now()).toISOString(),expiresAt:new Date(now()+15*60000).toISOString()},body.operationId);
    return response(client,member,scope,project);
   });
   if(action==='restart_authorization')return within(session,body,true,async(client,member,scope,project)=>{
    if(!metaCustomerAuthorizationReady(provider.readiness()))throw new WorkspaceError(provider.readiness().pilot?.code||'META_CUSTOMER_CONFIGURATION_PENDING',503);
    const current=project.metadata?.metaSignup;
    if(current?.operationId===body.operationId){if(current.actorId!==member.actorId||current.startRequestDigest!==digest(body))throw new WorkspaceError('META_CUSTOMER_OPERATION_CONFLICT',409);return response(client,member,scope,project);}
    const previous=owned(project,member,body.signupId);
    if(body.confirmFreshAuthorization!==true||typeof body.reason!=='string'||body.reason.trim().length<8||body.reason.length>300||/[\u0000-\u001f\u007f<>]/.test(body.reason))throw new WorkspaceError('META_CUSTOMER_RESTART_CONFIRMATION_REQUIRED');
    if(previous.encryptedToken||!(previous.state==='EXCHANGE_UNKNOWN'||previous.state==='EXCHANGE_STARTED'&&new Date(previous.exchangeLeaseExpiresAt).getTime()<=now()))throw new WorkspaceError('META_CUSTOMER_RESTART_UNAVAILABLE',409);
    const profile=requirePreparation(project);if(profile.revision!==body.preparedRevision)throw new WorkspaceError('META_CUSTOMER_PREPARATION_CHANGED',409);
    const connections=await client.query(`SELECT id FROM public."WhatsAppConnection" WHERE "projectId"=$1`,[project.id]);if(connections.rows.length)throw new WorkspaceError('META_CUSTOMER_EXISTING_CONNECTION_REVIEW',409);
    const history=project.metadata.metaSignupHistory||[];if(!Array.isArray(history)||history.length>=20)throw new WorkspaceError('META_CUSTOMER_RESTART_REVIEW_REQUIRED',409);
    project.metadata={...project.metadata,metaSignupHistory:[...history,{id:previous.id,state:previous.state,codeDigest:previous.codeDigest,wabaId:previous.wabaId,phoneNumberId:previous.phoneNumberId,actorId:previous.actorId,createdAt:previous.createdAt,restartedAt:new Date(now()).toISOString(),reason:body.reason.trim(),remoteAuthorizationRevoked:false}]};
    await save(client,member,project,{version:1,id:randomUUID(),actorId:member.actorId,organizationId:member.organizationId,preparedRevision:profile.revision,operationId:body.operationId,startRequestDigest:digest(body),...flow(profile.numberMode),state:'PREPARED',createdAt:new Date(now()).toISOString(),expiresAt:new Date(now()+15*60000).toISOString(),previousAttemptId:previous.id},body.operationId);
    return response(client,member,scope,project);
   });
   if(action==='cancel')return within(session,body,true,async(client,member,scope,project)=>{const state=owned(project,member,body.signupId);if(!['PREPARED','CANCELLED'].includes(state.state))throw new WorkspaceError('META_CUSTOMER_CANCELLATION_REQUIRES_REVIEW',409);
    if(state.state!=='CANCELLED')await save(client,member,project,{...state,state:'CANCELLED'},body.operationId);return response(client,member,scope,project);});
   if(action==='refresh_templates'){
    const bound=await within(session,body,false,async(client,member,_scope,project)=>{const state=owned(project,member,body.signupId);if(!['LINKED_PENDING_ACCEPTANCE','REGISTRATION_REQUIRED'].includes(state.state))throw new WorkspaceError('META_CUSTOMER_CATALOG_UNAVAILABLE',409);
     const result=await client.query(`SELECT "encryptedAccessToken",metadata FROM public."WhatsAppConnection" WHERE "projectId"=$1 AND "phoneNumberId"=$2 AND "whatsappBusinessId"=$3`,[project.id,state.phoneNumberId,state.wabaId]);
     if(result.rows.length!==1||result.rows[0].metadata?.customerSignupId!==state.id)throw new WorkspaceError('META_CUSTOMER_BINDING_INTEGRITY',409);
     return {state,token:decryptCustomerSecret(result.rows[0].encryptedAccessToken,secretContext(member,project,'access-token',state.phoneNumberId),environment)};});
    const templates=await provider.templates({token:bound.token,wabaId:bound.state.wabaId});
    return within(session,body,true,async(client,member,scope,project)=>{const state=owned(project,member,body.signupId);if(state.wabaId!==templates.wabaId)throw new WorkspaceError('META_CUSTOMER_CATALOG_SCOPE_REJECTED',409);
     await client.query(`UPDATE public."WhatsAppConnection" SET metadata=metadata||$4::jsonb,"updatedAt"=clock_timestamp() WHERE "projectId"=$1 AND "phoneNumberId"=$2 AND "whatsappBusinessId"=$3`,[project.id,state.phoneNumberId,state.wabaId,JSON.stringify({customerTemplates:templates})]);
     await save(client,member,project,state,body.operationId);return response(client,member,scope,project);});
   }
   if(typeof body.code!=='string'||body.code.length<10||body.code.length>2048||/[\s\u0000-\u001f]/.test(body.code)||!metaAssetId(body.wabaId)||body.phoneNumberId!==null&&!metaAssetId(body.phoneNumberId))throw new WorkspaceError('META_CUSTOMER_INPUT_INVALID');
   const reservation=await within(session,body,true,async(client,member,scope,project)=>{
    const state=owned(project,member,body.signupId);checkToken(body.stateToken,stateToken(state,member,project,environment));
    const coexistence=state.numberMode==='BUSINESS_APP';
    if(coexistence?body.signupEvent!=='FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING':!metaAssetId(body.phoneNumberId)||body.signupEvent!==undefined&&body.signupEvent!=='FINISH')throw new WorkspaceError('META_CUSTOMER_SIGNUP_EVENT_REJECTED',403);
    if(state.signupVersion!=='4'||flow(state.numberMode||'DEDICATED').configId!==state.configId)throw new WorkspaceError('META_CUSTOMER_PREPARATION_CHANGED',409);
    if(state.existingConnection&&(state.existingConnection.wabaId!==body.wabaId||body.phoneNumberId&&state.existingConnection.phoneNumberId!==body.phoneNumberId))throw new WorkspaceError('META_CUSTOMER_EXISTING_CONNECTION_REVIEW',409);
    if((project.metadata.metaSignupHistory||[]).some(previous=>previous.codeDigest===customerSecretDigest(body.code)))throw new WorkspaceError('META_CUSTOMER_CODE_ALREADY_CONSUMED',409);
    if(state.state!=='PREPARED'){if(state.codeDigest===customerSecretDigest(body.code)&&state.wabaId===body.wabaId&&(state.phoneNumberId===body.phoneNumberId||coexistence&&body.phoneNumberId===null))return {replayed:true,result:await response(client,member,scope,project)};throw new WorkspaceError('META_CUSTOMER_CODE_ALREADY_CONSUMED',409);}
    if(new Date(state.expiresAt).getTime()<=now())throw new WorkspaceError('META_CUSTOMER_SIGNUP_EXPIRED',409);
    if(requirePreparation(project).revision!==state.preparedRevision)throw new WorkspaceError('META_CUSTOMER_PREPARATION_CHANGED',409);
    await assertAssetVacant(client,project,body.wabaId,body.phoneNumberId);
    await save(client,member,project,{...state,state:'EXCHANGE_STARTED',codeDigest:customerSecretDigest(body.code),wabaId:body.wabaId,phoneNumberId:body.phoneNumberId,exchangeLeaseExpiresAt:new Date(now()+60000).toISOString()},body.operationId);
    return {state};
   });
   if(reservation.replayed)return reservation.result;
   let token;
   try{token=await provider.exchange(body.code);}catch(error){
    try{await within(session,body,true,async(client,member,_scope,project)=>{const state=owned(project,member,body.signupId);if(state.state==='EXCHANGE_STARTED')await save(client,member,project,{...state,state:'EXCHANGE_UNKNOWN',lastCode:'META_CUSTOMER_EXCHANGE_UNCONFIRMED'},body.operationId);});}catch{}
    throw new WorkspaceError('META_CUSTOMER_EXCHANGE_UNCONFIRMED',503);
   }
   try{
    if(provider.readiness().mode===META_DEVELOPMENT_PILOT_MODE){const verified=await provider.inspect({token,wabaId:body.wabaId,phoneNumberId:body.phoneNumberId,numberMode:'DEDICATED',inspectionPhase:META_CUSTOMER_INSPECTION_PHASE.PRE_REGISTRATION});provider.pilotProvenance(verified);}
    await within(session,body,true,async(client,member,_scope,project)=>{const state=owned(project,member,body.signupId);if(state.state!=='EXCHANGE_STARTED'||Date.parse(state.exchangeLeaseExpiresAt)<=now())throw new WorkspaceError('META_CUSTOMER_STATE_CHANGED',409);
     await save(client,member,project,{...state,state:'CREDENTIAL_STORED',authCompletedAt:new Date(now()).toISOString(),encryptedToken:encryptCustomerSecret(token,secretContext(member,project,'signup',state.id),environment)},body.operationId);});}
   catch{try{await within(session,body,true,async(client,member,_scope,project)=>{const state=owned(project,member,body.signupId);if(state.state==='EXCHANGE_STARTED')await save(client,member,project,{...state,state:'EXCHANGE_UNKNOWN',lastCode:'META_CUSTOMER_ESCROW_UNCONFIRMED'},body.operationId);});}catch{}throw new WorkspaceError('META_CUSTOMER_ESCROW_UNCONFIRMED',503);}
   return reconcile(session,{...body,action:'reconcile'});
  },
 };
}
