import {randomUUID} from 'node:crypto';
import {WorkspaceError,workspaceId,operationId,digest} from './workspace-policy.mjs';
import {createOwnCompanyCapability,ownCompanyCapabilityPolicy,ownCompanyConnectionPolicy,ownCompanyPolicySourceDigest,createOwnCompanyRuntimeGrant,lockOwnCompanyIssuer} from './meta-own-company-policy.mjs';
import {requireCompanyChannelSchema} from './company-channel-schema.mjs';
import {assertCompanyChannelNoPending} from './company-channel-store.mjs';
import {companyPhoneContract,assertCompanyPhoneMatch} from './company-onboarding-policy.mjs';
import {encryptCustomerSecret,decryptCustomerSecret,customerContextCommitment} from './meta-customer-credentials.mjs';
import {META_CUSTOMER_INSPECTION_PHASE} from './meta-customer-provider.mjs';

export const OWN_COMPANY_ACTIONS=Object.freeze(['CONNECT_OWN_NUMBER','ACTIVATE_OWN_NUMBER']);
export const OWN_COMPANY_CONNECT_RECOVERY='RECOVER_CONNECT_OWN_NUMBER';
const fail=(code,status=409)=>{throw new WorkspaceError(code,status);};
const receiptId=(member,projectId,id)=>'company_own_'+digest([member.organizationId,member.actorId,projectId,id]);
const shape=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===keys.slice().sort().join('|');
const providerCode=error=>error instanceof WorkspaceError&&/^(META_OWN_COMPANY_|COMPANY_CHANNEL_)/.test(error.code)?error.code:error?.code==='META_CUSTOMER_PROVIDER_REJECTED'?'META_OWN_COMPANY_PROVIDER_REJECTED':error?.code==='META_CUSTOMER_TOKEN_SCOPE_REJECTED'||error?.code==='META_CUSTOMER_TOKEN_EXPIRED'?'META_OWN_COMPANY_TOKEN_REJECTED':'META_OWN_COMPANY_PROVIDER_UNCONFIRMED';
export function normalizeOwnCompanyCommand(body){
 if(!shape(body,['action','operationId','projectId','scope','payload'])||!OWN_COMPANY_ACTIONS.includes(body.action)||!operationId(body.operationId)||!workspaceId(body.projectId)||!/^[a-f0-9]{64}$/.test(body.scope||''))fail('META_OWN_COMPANY_INPUT_INVALID',400);
 const p=body.payload,activate=body.action==='ACTIVATE_OWN_NUMBER';
 if(!shape(p,['connectionId','revision','companyPhoneRevision','wabaId','phoneNumberId','confirmOwnBusiness','confirmReplacement',...(activate?['confirmRegistration','securityPin']:[])])||!(p.connectionId===null&&!activate||workspaceId(p.connectionId))||!Number.isSafeInteger(p.revision)||p.revision<0||p.revision>2147483645||!Number.isSafeInteger(p.companyPhoneRevision)||p.companyPhoneRevision<1||!/^\d{5,32}$/.test(p.wabaId||'')||!/^\d{5,32}$/.test(p.phoneNumberId||'')||p.confirmOwnBusiness!==true||typeof p.confirmReplacement!=='boolean'||activate&&(p.confirmReplacement||typeof p.confirmRegistration!=='boolean'||!(p.securityPin===null||/^\d{6}$/.test(p.securityPin||''))||p.confirmRegistration!==(p.securityPin!==null)))fail('META_OWN_COMPANY_INPUT_INVALID',400);
 return {...body,operationId:body.operationId.toLowerCase()};
}
export function normalizeOwnCompanyConnectRecovery(body){
 if(!shape(body,['action','operationId','projectId','scope','payload'])||body.action!==OWN_COMPANY_CONNECT_RECOVERY)fail('META_OWN_COMPANY_INPUT_INVALID',400);
 const p=body.payload;if(!shape(p,['connectionId','revision','companyPhoneRevision','wabaId','phoneNumberId','confirmOwnBusiness','confirmReplacement','originalReceiptId','originalRequestDigest','reservationId','originalSourceHead','confirmRecovery'])||p.connectionId!==null||p.revision!==0||p.confirmReplacement!==false||p.confirmRecovery!==true||!/^company_own_[a-f0-9]{64}$/.test(p.originalReceiptId||'')||!/^[a-f0-9]{64}$/.test(p.originalRequestDigest||'')||!operationId(p.reservationId)||!/^[a-f0-9]{40}$/.test(p.originalSourceHead||''))fail('META_OWN_COMPANY_INPUT_INVALID',400);
 const {originalReceiptId,originalRequestDigest,reservationId,originalSourceHead}=p;
 // Match the original UI command's ordered digest, irrespective of recovery
 // JSON property order. Legacy digests are preserved, never rewritten.
 const payload={connectionId:p.connectionId,revision:p.revision,companyPhoneRevision:p.companyPhoneRevision,wabaId:p.wabaId,phoneNumberId:p.phoneNumberId,confirmOwnBusiness:p.confirmOwnBusiness,confirmReplacement:p.confirmReplacement};
 const input=normalizeOwnCompanyCommand({scope:body.scope,projectId:body.projectId,action:'CONNECT_OWN_NUMBER',payload,operationId:body.operationId});
 return {input,recovery:{originalReceiptId,originalRequestDigest,reservationId,originalSourceHead}};
}
const publicResult=(row,member,scope,replayed=true)=>{const m=row.metadata;return {organization:{id:member.organizationId,name:member.organizationName},actor:{id:member.actorId,role:member.role},scope,projectId:m.projectId,operationId:m.operationId,action:m.action,state:m.state,saved:m.state==='RECORDED',definitive:['RECORDED','REJECTED'].includes(m.state),receiptId:row.id,replayed,...(m.code?{code:m.code}:{}),channel:m.channel||null,accepted:false,roundTrip:'NOT_VERIFIED'};};
export function createOwnCompanyConnection({workspace,provider,environment=process.env,now=()=>Date.now()}){
 const within=(session,context,writable,run,archived=false)=>workspace.organizationOperation(session,context,writable,async(client,member,scope)=>{
  if(session.organizationRole!=='org:admin')fail('META_OWN_COMPANY_ADMIN_REQUIRED',403);
  return run(client,member,scope);
 },archived);
 async function authority(client,member,session,context,lock=false){
  const project=(await client.query(`SELECT p.id,p."organizationId",p.metadata,o.metadata AS "organizationMetadata" FROM public."Project" p JOIN public."Organization" o ON o.id=p."organizationId" WHERE p.id=$1 AND p."organizationId"=$2 AND p.status='ACTIVE' ${lock?'FOR UPDATE OF p':''}`,[context.projectId,member.organizationId])).rows[0];
  if(!project)fail('META_OWN_COMPANY_CONTEXT_CHANGED',403);
  const capability=createOwnCompanyCapability({member,session,project},environment,now()),policy=ownCompanyCapabilityPolicy(capability,environment,now());
  if(context.payload&&(context.payload.wabaId!==policy.wabaId||context.payload.phoneNumberId!==policy.phoneNumberId||context.payload.companyPhoneRevision!==policy.companyPhoneRevision))fail('META_OWN_COMPANY_CONTEXT_CHANGED',409);
  return {project,capability,policy,declared:companyPhoneContract(project.organizationMetadata)};
 }
 async function previous(client,member,context){return (await client.query(`SELECT id,metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND action='company.own.number.recorded' AND metadata->>'projectId'=$4`,[receiptId(member,context.projectId,context.operationId),member.organizationId,member.actorId,context.projectId])).rows[0];}
 async function channel(client,member,projectId,lock=false){
  const rows=(await client.query(`SELECT c.*,cc.revision,cc.mode FROM public."WhatsAppConnection" c JOIN public."WhatsAppCompanyChannel" cc ON cc."connectionId"=c.id AND cc."organizationId"=$2 AND cc."anchorProjectId"=c."projectId" WHERE c."projectId"=$1 ${lock?'FOR UPDATE OF c,cc':''}`,[projectId,member.organizationId])).rows;
  if(rows.length>1)fail('META_OWN_COMPANY_CONNECTION_CONFLICT');return rows[0]||null;
 }
 const channelDto=c=>c?{id:c.id,anchorProjectId:c.projectId,revision:c.revision,mode:c.mode,displayPhoneNumber:c.displayPhoneNumber,connectionStatus:c.connectionStatus,enabled:c.enabled}:null;
 async function snapshot(session,context){return within(session,context,false,async(client,member,scope)=>{const auth=await authority(client,member,session,context);await requireCompanyChannelSchema(client);return {...auth,member,scope,connection:await channel(client,member,context.projectId)};});}
 function fingerprint(input,member){const {securityPin,...safe}=input.payload;return digest({...input,payload:{...safe,...(Object.hasOwn(input.payload,'securityPin')?{securityPinCommitment:securityPin===null?null:customerContextCommitment(securityPin,{organizationId:member.organizationId,projectId:input.projectId,purpose:'own-number-pin',resourceId:input.operationId},environment)}:{})}});}
 async function sourceProvider(s,token=environment.META_OWN_COMPANY_ACCESS_TOKEN){const scoped=await provider.forOwnCapability({capability:s.capability,token}),verified=await scoped.inspect({token,wabaId:s.policy.wabaId,phoneNumberId:s.policy.phoneNumberId,numberMode:'DEDICATED',inspectionPhase:META_CUSTOMER_INSPECTION_PHASE.PRE_REGISTRATION});assertCompanyPhoneMatch(s.declared,s.project.organizationMetadata,verified.displayPhoneNumber);return {scoped,verified,token};}
 async function current(session,input,run){return within(session,input,true,async(client,member,scope)=>{const auth=await authority(client,member,session,input,true);await requireCompanyChannelSchema(client);return run(client,member,scope,auth);});}
 async function record(client,member,input,details){const id=receiptId(member,input.projectId,input.operationId);await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'company.own.number.recorded','WhatsAppConnection',$4,$5::jsonb)`,[id,member.organizationId,member.actorId,details.connectionId||input.projectId,JSON.stringify({version:1,projectId:input.projectId,operationId:input.operationId,action:input.action,...details})]);return {id,metadata:{projectId:input.projectId,operationId:input.operationId,action:input.action,...details}};}
 async function checkReplay(session,input){return within(session,input,false,async(client,member,scope)=>{const row=await previous(client,member,input);if(!row)return null;if(row.metadata.requestDigest!==fingerprint(input,member))fail('META_OWN_COMPANY_OPERATION_CONFLICT');return publicResult(row,member,scope);});}
 function validateRecovery(row,input,member,policy,recovery){
  const m=row?.metadata;
  if(!row||row.id!==recovery.originalReceiptId||row.id!==receiptId(member,input.projectId,input.operationId)||m.action!=='CONNECT_OWN_NUMBER'||m.operationId!==input.operationId||m.projectId!==input.projectId||m.requestDigest!==recovery.originalRequestDigest||m.requestDigest!==fingerprint(input,member)||m.reservationId!==recovery.reservationId||m.providerMutation!==false||m.policySourceHead!==undefined&&m.policySourceHead!==recovery.originalSourceHead||ownCompanyPolicySourceDigest(policy,recovery.originalSourceHead)!==m.policyDigest)fail('META_OWN_COMPANY_OPERATION_CONFLICT');
  if(m.state==='RECORDED'){
   const revision=m.recoveryRevision;if(!revision||revision.action!==OWN_COMPANY_CONNECT_RECOVERY||revision.originalSourceHead!==recovery.originalSourceHead||revision.originalPolicyDigest!==m.policyDigest||revision.policyDigest!==policy.policyDigest||revision.policySourceHead!==policy.sourceHead)fail('META_OWN_COMPANY_OPERATION_CONFLICT');
  }else if(m.state!=='VERIFYING'||m.connectionId!==null||m.channel!==null||m.recoveryRevision)fail('META_OWN_COMPANY_OPERATION_CONFLICT');
 }
 async function finishConnect(session,input,{requestDigest,reservationId,inspected,token,recovery=null}){
  return current(session,input,async(client,member,scope,auth)=>{
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['own-company-assets:'+auth.policy.wabaId]);
    const prior=await previous(client,member,input);if(recovery){validateRecovery(prior,input,member,auth.policy,recovery);if(prior.metadata.state==='RECORDED')return publicResult(prior,member,scope);}
    if(!prior||prior.metadata.requestDigest!==requestDigest||prior.metadata.reservationId!==reservationId||prior.metadata.state!=='VERIFYING')fail('META_OWN_COMPANY_OPERATION_CONFLICT');
    let c=await channel(client,member,input.projectId,true);
    if((c?.id||null)!==input.payload.connectionId||(c?.revision||0)!==input.payload.revision)fail('META_OWN_COMPANY_REVISION_CHANGED');
    const duplicate=(await client.query(`SELECT EXISTS(SELECT 1 FROM public."WhatsAppConnection" WHERE ("phoneNumberId"=$1 OR "whatsappBusinessId"=$2) AND ($3::text IS NULL OR id<>$3)) AS present`,[auth.policy.phoneNumberId,auth.policy.wabaId,c?.id||null])).rows[0].present;if(duplicate)fail('META_OWN_COMPANY_ASSET_IN_USE');
    const changed=c&&(c.phoneNumberId!==auth.policy.phoneNumberId||c.whatsappBusinessId!==auth.policy.wabaId);let encryptedPrevious=null;
    if(c)await assertCompanyChannelNoPending(client,c);
    if(changed){if(input.payload.confirmReplacement!==true||c.mode!=='SUSPENDED')fail('META_OWN_COMPANY_REPLACEMENT_REQUIRES_SUSPEND');encryptedPrevious=encryptCustomerSecret(JSON.stringify(c),{organizationId:member.organizationId,projectId:input.projectId,purpose:'own-number-history',resourceId:input.operationId},environment);}
    else if(input.payload.confirmReplacement)fail('META_OWN_COMPANY_REPLACEMENT_NOT_REQUIRED');
    if(c?.metadata?.ownCompanyOperation&&['VERIFYING','PROVIDER_STARTED','PROVIDER_UNKNOWN'].includes(c.metadata.ownCompanyOperation.state))fail('META_OWN_COMPANY_OPERATION_UNCERTAIN');
    if(c&&!changed&&c.enabled)fail('META_OWN_COMPANY_ALREADY_CONNECTED');
    const provenance=inspected.scoped.ownProvenance(inspected.verified);if(provenance.policyDigest!==auth.policy.policyDigest)fail('META_OWN_COMPANY_CONTEXT_CHANGED');
    const metadata={...(c?.metadata||{}),credentialFormat:'tenant-aad-v2',credentialOrganizationId:member.organizationId,declaredCompanyPhone:auth.declared,ownCompany:provenance,customerSignupId:input.operationId,customerSubscribed:false,customerVerification:inspected.verified,customerActivation:{version:1,state:'NOT_ACCEPTED',actorId:member.actorId},ownCompanyOperation:{version:1,state:'CONNECTED_PENDING',operationId:input.operationId}};
     for(const key of ['developmentPilot','customerLifecycle','coexistence','customerTemplateDrafts','companyPhoneCorrections','ownCompanyRuntime'])delete metadata[key];
    const encryptedAccessToken=encryptCustomerSecret(token,{organizationId:member.organizationId,projectId:input.projectId,purpose:'access-token',resourceId:auth.policy.phoneNumberId},environment);
    if(c){await client.query(`UPDATE public."WhatsAppConnection" SET enabled=false,"connectionStatus"='PENDING',"phoneNumberId"=$2,"whatsappBusinessId"=$3,"encryptedAccessToken"=$4,"displayPhoneNumber"=$5,metadata=$6::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1`,[c.id,auth.policy.phoneNumberId,auth.policy.wabaId,encryptedAccessToken,inspected.verified.displayPhoneNumber,JSON.stringify(metadata)]);await client.query(`UPDATE public."WhatsAppCompanyChannel" SET mode='PREPARED',revision=revision+1,"updatedAt"=clock_timestamp() WHERE "connectionId"=$1`,[c.id]);}
    else{const id='channel_'+randomUUID().replaceAll('-','');await client.query(`INSERT INTO public."WhatsAppConnection"(id,"projectId",enabled,"connectionStatus","phoneNumberId","whatsappBusinessId","encryptedAccessToken","displayPhoneNumber",metadata,"createdAt","updatedAt") VALUES($1,$2,false,'PENDING',$3,$4,$5,$6,$7::jsonb,clock_timestamp(),clock_timestamp())`,[id,input.projectId,auth.policy.phoneNumberId,auth.policy.wabaId,encryptedAccessToken,inspected.verified.displayPhoneNumber,JSON.stringify(metadata)]);await client.query(`UPDATE public."WhatsAppCompanyChannel" SET mode='PREPARED',revision=revision+1,"updatedAt"=clock_timestamp() WHERE "connectionId"=$1`,[id]);}
    if(changed){await client.query(`UPDATE public."WhatsAppChannelProjectAssignment" SET status='REVOKED',revision=revision+1,"updatedAt"=clock_timestamp() WHERE "connectionId"=$1 AND status='ACTIVE'`,[c.id]);await client.query(`UPDATE public."WhatsAppCompanyRoute" SET epoch=epoch+1,"projectId"=NULL,"workerId"=NULL,"assignmentRevision"=NULL,"bindingId"=NULL,"updatedAt"=clock_timestamp() WHERE "connectionId"=$1`,[c.id]);}
    c=await channel(client,member,input.projectId,true);const recoveryRevision=recovery?{version:1,action:OWN_COMPANY_CONNECT_RECOVERY,originalState:'VERIFYING',originalSourceHead:recovery.originalSourceHead,originalPolicyDigest:prior.metadata.policyDigest,policySourceHead:auth.policy.sourceHead,policyDigest:auth.policy.policyDigest,recoveredAt:new Date(now()).toISOString()}:null;
    const final={...prior.metadata,...(recoveryRevision?{recoveryRevision}:{}),state:'RECORDED',connectionId:c.id,channel:channelDto(c),replacement:changed===true,...(encryptedPrevious?{encryptedPrevious}:{}),providerMutation:false};await client.query(`UPDATE public."AuditLog" SET "entityId"=$2,metadata=$3::jsonb WHERE id=$1`,[prior.id,c.id,JSON.stringify(final)]);if(recoveryRevision)await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'company.own.number.recovery.recorded','WhatsAppConnection',$4,$5::jsonb)`,['company_own_recovery_'+digest([prior.id,auth.policy.policyDigest]),member.organizationId,member.actorId,c.id,JSON.stringify({version:1,projectId:input.projectId,operationId:input.operationId,originalReceiptId:prior.id,originalRequestDigest:requestDigest,reservationId,...recoveryRevision,providerMutation:false})]);return publicResult({id:prior.id,metadata:final},member,scope,false);
   });
 }
 return {
  async discover(session,context){
   const s=await snapshot(session,context),{scoped,verified,token}=await sourceProvider(s),subscribed=await scoped.inspectSubscription({token,wabaId:s.policy.wabaId});
    const latest=await snapshot(session,context);ownCompanyCapabilityPolicy(s.capability,environment,now());
    let connectionOwnVerified=false;try{connectionOwnVerified=Boolean(ownCompanyConnectionPolicy(latest.connection,environment,now()));if(Object.hasOwn(latest.connection?.metadata||{},'ownCompanyRuntime'))await current(session,context,client=>lockOwnCompanyIssuer(client,latest.connection,{environment,now:now()}));}catch{connectionOwnVerified=false;}
    const runtime=latest.connection?.metadata?.ownCompanyRuntime,credentialExpiresAt=typeof runtime?.validUntil==='string'&&Number.isFinite(Date.parse(runtime.validUntil))&&new Date(runtime.validUntil).toISOString()===runtime.validUntil?runtime.validUntil:null;
    const operationalGrant=Object.hasOwn(latest.connection?.metadata||{},'ownCompanyRuntime')?{version:2,state:connectionOwnVerified&&verified.registered&&subscribed?'ACTIVE':runtime?.state==='REVOKED'?'REVOKED':credentialExpiresAt&&Date.parse(credentialExpiresAt)<=now()?'EXPIRED':'UNAVAILABLE',credentialExpiresAt,roundTrip:'NOT_VERIFIED',fieldJourney:'NOT_VERIFIED'}:null;
    return {organization:{id:s.member.organizationId,name:s.member.organizationName},actor:{id:s.member.actorId,role:s.member.role},scope:s.scope,projectId:context.projectId,readOnly:true,canManage:true,connectionMatchesAssets:Boolean(latest.connection&&latest.connection.phoneNumberId===s.policy.phoneNumberId&&latest.connection.whatsappBusinessId===s.policy.wabaId),connectionOwnVerified,mode:'OWN_COMPANY',companyPhoneRevision:s.declared.revision,wabaId:s.policy.wabaId,phoneNumberId:s.policy.phoneNumberId,displayPhoneNumber:verified.displayPhoneNumber,verifiedBusinessName:verified.verifiedBusinessName,registered:verified.registered,subscribed,expiresAt:s.policy.expiresAt,channel:channelDto(latest.connection),...(operationalGrant?{operationalGrant}:{}),accepted:false,roundTrip:'NOT_VERIFIED'};
  },
  async read(session,context){
   const result=await within(session,context,false,async(client,member,scope)=>{const row=await previous(client,member,context);return row?{row,result:publicResult(row,member,scope)}:null;},true);
   if(!result||result.result.definitive)return result?.result||null;
   if(result.row.metadata.action==='CONNECT_OWN_NUMBER'&&result.row.metadata.state==='VERIFYING'&&result.row.metadata.providerMutation===false&&result.row.metadata.connectionId===null&&result.row.metadata.channel===null){
    try{const s=await snapshot(session,context);if(s.connection)return result.result;const m=result.row.metadata;if(!operationId(m.reservationId)||!/^[a-f0-9]{64}$/.test(m.requestDigest||''))return result.result;
     return {...result.result,connectRecovery:{version:1,receiptId:result.row.id,requestDigest:m.requestDigest,reservationId:m.reservationId,policySourceHead:m.policySourceHead||null,companyPhoneRevision:s.policy.companyPhoneRevision,wabaId:s.policy.wabaId,phoneNumberId:s.policy.phoneNumberId,expiresAt:s.policy.expiresAt}};
    }catch{return result.result;}
   }
   // Reconciliation observes the original assets. It neither retries a POST
   // nor writes ACTIVE after a lost acknowledgement.
   try{const s=await snapshot(session,context);if(s.connection?.id!==result.row.metadata.connectionId||s.connection.metadata?.ownCompany?.policyDigest!==result.row.metadata.policyDigest)return result.result;const token=decryptCustomerSecret(s.connection.encryptedAccessToken,{organizationId:s.member.organizationId,projectId:context.projectId,purpose:'access-token',resourceId:s.connection.phoneNumberId},environment),{scoped,verified}=await sourceProvider(s,token),subscribed=await scoped.inspectSubscription({token,wabaId:s.policy.wabaId});await snapshot(session,context);return {...result.result,providerObservation:{registered:verified.registered,subscribed,readOnly:true},recovery:'EXPLICIT_REVIEW_REQUIRED'};}catch{return {...result.result,recovery:'EXPLICIT_REVIEW_REQUIRED'};}
  },
  async command(session,body){
   if(body?.action===OWN_COMPANY_CONNECT_RECOVERY){
    const {input,recovery}=normalizeOwnCompanyConnectRecovery(body);
    const reserved=await within(session,input,false,async(client,member,scope)=>{const auth=await authority(client,member,session,input);await requireCompanyChannelSchema(client);const row=await previous(client,member,input);validateRecovery(row,input,member,auth.policy,recovery);if(row.metadata.state==='RECORDED')return {done:publicResult(row,member,scope)};if(await channel(client,member,input.projectId))fail('META_OWN_COMPANY_REVISION_CHANGED');return {...auth,member,scope};});
    if(reserved.done)return reserved.done;
    // This explicit decision repeats ownership GETs only. A failed inspection
    // or lost commit leaves the original reservation untouched.
    try{const inspected=await sourceProvider(reserved);return await finishConnect(session,input,{requestDigest:recovery.originalRequestDigest,reservationId:recovery.reservationId,inspected,token:inspected.token,recovery});}
    catch(error){throw new WorkspaceError(providerCode(error),error instanceof WorkspaceError?error.status:503);}
   }
   const input=normalizeOwnCompanyCommand(body),replay=await checkReplay(session,input);if(replay)return replay;
   const s=await snapshot(session,input);let token=environment.META_OWN_COMPANY_ACCESS_TOKEN;
   if(input.action==='ACTIVATE_OWN_NUMBER'){
    if(!s.connection||s.connection.id!==input.payload.connectionId||s.connection.revision!==input.payload.revision||s.connection.metadata?.ownCompany?.policyDigest!==s.policy.policyDigest)fail('META_OWN_COMPANY_REVISION_CHANGED');
    token=decryptCustomerSecret(s.connection.encryptedAccessToken,{organizationId:s.member.organizationId,projectId:input.projectId,purpose:'access-token',resourceId:s.connection.phoneNumberId},environment);
   }
   const requestDigest=fingerprint(input,s.member),reservationId=randomUUID();let connectReserved=null;
   if(input.action==='CONNECT_OWN_NUMBER')connectReserved=await current(session,input,async(client,member,scope,auth)=>{
    const prior=await previous(client,member,input);if(prior){if(prior.metadata.requestDigest!==requestDigest)fail('META_OWN_COMPANY_OPERATION_CONFLICT');return {done:publicResult(prior,member,scope)};}
    const c=await channel(client,member,input.projectId,true);if((c?.id||null)!==input.payload.connectionId||(c?.revision||0)!==input.payload.revision)fail('META_OWN_COMPANY_REVISION_CHANGED');
    if(c)await assertCompanyChannelNoPending(client,c);
    const changed=c&&(c.phoneNumberId!==auth.policy.phoneNumberId||c.whatsappBusinessId!==auth.policy.wabaId);
    if(changed&&(input.payload.confirmReplacement!==true||c.mode!=='SUSPENDED'))fail('META_OWN_COMPANY_REPLACEMENT_REQUIRES_SUSPEND');
    if(!changed&&input.payload.confirmReplacement)fail('META_OWN_COMPANY_REPLACEMENT_NOT_REQUIRED');
    if(c&&!changed&&c.enabled)fail('META_OWN_COMPANY_ALREADY_CONNECTED');
    const pending=(await client.query(`SELECT EXISTS(SELECT 1 FROM public."AuditLog" WHERE "organizationId"=$1 AND action='company.own.number.recorded' AND metadata->>'projectId'=$2 AND metadata->>'state' IN ('VERIFYING','PROVIDER_STARTED','PROVIDER_UNKNOWN')) AS present`,[member.organizationId,input.projectId])).rows[0].present;if(pending)fail('META_OWN_COMPANY_OPERATION_UNCERTAIN');
    return {row:await record(client,member,input,{state:'VERIFYING',requestDigest,reservationId,connectionId:c?.id||null,policyDigest:auth.policy.policyDigest,policySourceHead:auth.policy.sourceHead,channel:channelDto(c),providerMutation:false})};
   });if(connectReserved?.done)return connectReserved.done;
   let reserved=null;
   if(input.action==='ACTIVATE_OWN_NUMBER'){reserved=await current(session,input,async(client,member,scope,auth)=>{
    const c=await channel(client,member,input.projectId,true),prior=await previous(client,member,input);if(prior){if(prior.metadata.requestDigest!==requestDigest)fail('META_OWN_COMPANY_OPERATION_CONFLICT');return {done:publicResult(prior,member,scope)};}
    if(!c||c.id!==input.payload.connectionId||c.revision!==input.payload.revision||c.encryptedAccessToken!==s.connection.encryptedAccessToken||c.metadata?.ownCompany?.policyDigest!==auth.policy.policyDigest||!['PREPARED','SUSPENDED'].includes(c.mode)||c.enabled)fail('META_OWN_COMPANY_REVISION_CHANGED');
    if(c.metadata.ownCompanyOperation&&['VERIFYING','PROVIDER_STARTED','PROVIDER_UNKNOWN'].includes(c.metadata.ownCompanyOperation.state))fail('META_OWN_COMPANY_OPERATION_UNCERTAIN');
    const row=await record(client,member,input,{state:'VERIFYING',requestDigest,reservationId,connectionId:c.id,policyDigest:auth.policy.policyDigest,policySourceHead:auth.policy.sourceHead,channel:channelDto(c),providerMutation:false});await client.query(`UPDATE public."WhatsAppConnection" SET metadata=metadata||$2::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1`,[c.id,JSON.stringify({ownCompanyOperation:{version:1,state:'VERIFYING',operationId:input.operationId}})]);return {row};
   });if(reserved.done)return reserved.done;}
   let inspected;try{inspected=await sourceProvider(s,token);}catch(error){
    if(connectReserved||reserved)await current(session,input,async(client,member)=>{const row=await previous(client,member,input);if(row?.metadata.reservationId===reservationId&&row.metadata.state==='VERIFYING')await client.query(`UPDATE public."AuditLog" SET metadata=metadata||$2::jsonb WHERE id=$1`,[row.id,JSON.stringify({state:'REJECTED',code:providerCode(error)})]);if(reserved)await client.query(`UPDATE public."WhatsAppConnection" SET metadata=jsonb_set(metadata,'{ownCompanyOperation,state}','"REJECTED"'::jsonb),"updatedAt"=clock_timestamp() WHERE id=$1`,[input.payload.connectionId]);}).catch(()=>{});
    throw new WorkspaceError(providerCode(error),error instanceof WorkspaceError?error.status:503);
   }
   if(input.action==='CONNECT_OWN_NUMBER')return finishConnect(session,input,{requestDigest,reservationId,inspected,token}).catch(async error=>{
    if(error instanceof WorkspaceError&&error.code!=='WORKSPACE_OPERATION_UNCONFIRMED')await current(session,input,async(client,member)=>{const row=await previous(client,member,input);if(row?.metadata.reservationId===reservationId&&row.metadata.state==='VERIFYING')await client.query(`UPDATE public."AuditLog" SET metadata=metadata||$2::jsonb WHERE id=$1`,[row.id,JSON.stringify({state:'REJECTED',code:providerCode(error)})]);}).catch(()=>{});
    throw new WorkspaceError(providerCode(error),error instanceof WorkspaceError?error.status:503);
   });
   let dispatched=false;
   const fence=async(mutation=false)=>current(session,input,async(client,member,_scope,auth)=>{
    const c=await channel(client,member,input.projectId,true),row=await previous(client,member,input);if(!c||c.id!==input.payload.connectionId||c.revision!==input.payload.revision||c.encryptedAccessToken!==s.connection.encryptedAccessToken||c.metadata.ownCompany?.policyDigest!==auth.policy.policyDigest||c.metadata.ownCompanyOperation?.operationId!==input.operationId||!row||!['VERIFYING','PROVIDER_STARTED'].includes(row.metadata.state))fail('META_OWN_COMPANY_CONTEXT_CHANGED');
    if(mutation){dispatched=true;await client.query(`UPDATE public."AuditLog" SET metadata=metadata||'{"state":"PROVIDER_STARTED","providerMutation":true}'::jsonb WHERE id=$1`,[row.id]);await client.query(`UPDATE public."WhatsAppConnection" SET metadata=jsonb_set(metadata,'{ownCompanyOperation,state}','"PROVIDER_STARTED"'::jsonb),"updatedAt"=clock_timestamp() WHERE id=$1`,[c.id]);}
   });
   try{
    if(!inspected.verified.registered&&!input.payload.confirmRegistration)fail('META_OWN_COMPANY_SECURITY_PIN_REQUIRED',409);
    await fence();let subscribed=await inspected.scoped.inspectSubscription({token,wabaId:s.policy.wabaId});
    if(!subscribed){await fence(true);await inspected.scoped.subscribe({token,wabaId:s.policy.wabaId,beforeExternal:()=>fence()});subscribed=true;}
    if(!inspected.verified.registered){await fence(true);await inspected.scoped.register({token,phoneNumberId:s.policy.phoneNumberId,pin:input.payload.securityPin,inspection:inspected.verified,beforeExternal:()=>fence()});}
    await fence();const verified=await inspected.scoped.inspect({token,wabaId:s.policy.wabaId,phoneNumberId:s.policy.phoneNumberId,numberMode:'DEDICATED'});if(!verified.registered||!await inspected.scoped.inspectSubscription({token,wabaId:s.policy.wabaId}))fail('META_OWN_COMPANY_ACTIVATION_UNCONFIRMED');
     return await current(session,input,async(client,member,scope,auth)=>{
      const c=await channel(client,member,input.projectId,true),row=await previous(client,member,input);
      if(!c||c.id!==input.payload.connectionId||c.revision!==input.payload.revision||c.encryptedAccessToken!==s.connection.encryptedAccessToken||c.metadata.ownCompanyOperation?.operationId!==input.operationId||!row||!['VERIFYING','PROVIDER_STARTED'].includes(row.metadata.state))fail('META_OWN_COMPANY_CONTEXT_CHANGED');
      const proof=inspected.scoped.ownProvenance(verified);if(proof.policyDigest!==auth.policy.policyDigest)fail('META_OWN_COMPANY_CONTEXT_CHANGED');
      const runtimeGrant=createOwnCompanyRuntimeGrant({capability:auth.capability,connection:c,receiptId:row.id,operationId:input.operationId,channelRevision:c.revision,providerAuthority:inspected.scoped.ownOperationalAuthority(verified)},environment,now());
       await client.query(`UPDATE public."WhatsAppConnection" SET enabled=true,"connectionStatus"='CONNECTED',metadata=metadata||$2::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1`,[c.id,JSON.stringify({ownCompany:proof,ownCompanyRuntime:runtimeGrant,customerSubscribed:true,customerVerification:verified,customerActivation:{version:1,state:'ACTIVE',actorId:member.actorId,verifiedAt:new Date(now()).toISOString(),roundTrip:'NOT_VERIFIED',fieldJourney:'NOT_VERIFIED'},ownCompanyOperation:{version:1,state:'RECORDED',operationId:input.operationId}})]);
      const final={...row.metadata,state:'RECORDED',runtimeGrant,channel:channelDto({...c,enabled:true,connectionStatus:'CONNECTED'})};
      await client.query(`UPDATE public."AuditLog" SET metadata=$2::jsonb WHERE id=$1`,[row.id,JSON.stringify(final)]);return publicResult({id:row.id,metadata:final},member,scope,false);
     });
   }catch(error){
    // A provider POST or lost commit cannot be repeated under any UUID. The
    // durable original operation remains the sole read-only recovery reference.
     await current(session,input,async(client,member)=>{const c=await channel(client,member,input.projectId,true),row=await previous(client,member,input);if(c?.metadata.ownCompanyOperation?.operationId!==input.operationId||!row||row.metadata.state==='RECORDED')return;const state=dispatched?'PROVIDER_UNKNOWN':'REJECTED',code=providerCode(error);await client.query(`UPDATE public."AuditLog" SET metadata=metadata||$2::jsonb WHERE id=$1`,[row.id,JSON.stringify({state,code})]);await client.query(`UPDATE public."WhatsAppConnection" SET enabled=false,"connectionStatus"='PENDING',metadata=jsonb_set(metadata,'{ownCompanyOperation,state}',$2::jsonb),"updatedAt"=clock_timestamp() WHERE id=$1`,[c.id,JSON.stringify(state)]);}).catch(()=>{});throw new WorkspaceError(providerCode(error),error instanceof WorkspaceError?error.status:503);
   }
  },
 };
}
