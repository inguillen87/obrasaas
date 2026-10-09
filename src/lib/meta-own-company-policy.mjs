import {WorkspaceError,workspaceId,operationId,digest} from './workspace-policy.mjs';
import {OBRASAAS_META_CHANNEL} from './meta-channel-binding.mjs';
import {companyPhoneContract,normalizeCompanyPhone} from './company-onboarding-policy.mjs';
import {customerSecretDigest} from './meta-customer-credentials.mjs';

export const META_OWN_COMPANY_MODE='OWN_COMPANY';
export const META_OWN_COMPANY_TTL_MS=4*60*60*1000;
// Routing the management command must not load the template/provider graph.
export const OWN_TEMPLATE_ACTIONS=Object.freeze(['PREPARE_OWN_TEMPLATE','SUBMIT_OWN_TEMPLATE','RECOVER_OWN_TEMPLATE']);
// Confirmed runtime denials are observations or manual prepared-media recovery.
// Ownership/provider timeouts remain transient; never classify by a prefix.
export const META_OWN_COMPANY_AUTHORIZATION_CODES=Object.freeze(['META_OWN_COMPANY_UNAVAILABLE','META_OWN_COMPANY_CONFIGURATION_PENDING','META_OWN_COMPANY_OWNER_UNVERIFIED','META_OWN_COMPANY_TOKEN_REJECTED','META_OWN_COMPANY_CREDENTIAL_REJECTED','META_OWN_COMPANY_ASSET_REJECTED','META_OWN_COMPANY_PHONE_REJECTED','META_OWN_COMPANY_ADAPTER_UNAVAILABLE']);
const capabilities=new WeakMap(),keys=['version','sourceHead','organizationId','actorId','clerkUserId','clerkOrganizationId','projectId','appId','businessId','wabaId','phoneNumberId','expectedPhoneE164','companyPhoneRevision','issuedAt','expiresAt'];
const runtimeCapabilities=new WeakMap();
const runtimeKeys=['version','mode','state','grantId','grantDigest','connectionId','organizationId','actorId','clerkUserId','clerkOrganizationId','projectId','appId','businessId','wabaId','phoneNumberId','expectedPhoneE164','companyPhoneRevision','credentialFormat','credentialCommitment','tokenDigest','systemUserId','tokenExpiresAt','dataAccessExpiresAt','validUntil','issuedAt','origin'];
const originKeys=['version','receiptId','operationId','sourceHead','policyDigest','issuedAt','expiresAt','channelRevision'];
const sameKeys=(value,list)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===list.slice().sort().join('|');
const commitment=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const grantDigest=grant=>digest(Object.fromEntries(runtimeKeys.filter(key=>key!=='grantDigest').map(key=>[key,key==='origin'?Object.fromEntries(originKeys.map(name=>[name,grant.origin[name]])):grant[key]])));
const asset=value=>typeof value==='string'&&/^[1-9]\d{4,31}$/.test(value);
const timestamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const fail=()=>{throw new WorkspaceError('META_OWN_COMPANY_UNAVAILABLE',403);};
// Reconstruct only a source revision. The current, server-validated policy
// supplies every authority field and the unchanged authorization window.
export function ownCompanyPolicySourceDigest(policy,sourceHead){
 if(!/^[a-f0-9]{40}$/.test(sourceHead||'')||!policy||keys.some(key=>!Object.hasOwn(policy,key)))fail();
 return digest(Object.fromEntries(keys.map(key=>[key,key==='sourceHead'?sourceHead:policy[key]])));
}
// A deployment must explicitly review this exact, private configuration. The
// ordinary customer release and the development pilot cannot mint this grant.
export function readOwnCompanyPolicy(environment=process.env,now=Date.now()){
 if(environment.VERCEL_ENV!=='production')return null;
 let value;try{value=JSON.parse(environment.OBRASAAS_META_OWN_COMPANY_POLICY);}catch{return null;}
 if(environment.OBRASAAS_META_OWN_COMPANY_RELEASE!=='own-company-number-v1'||!value||Array.isArray(value)||Object.keys(value).sort().join('|')!==keys.slice().sort().join('|')||value.version!==1||!/^[a-f0-9]{40}$/.test(value.sourceHead||'')||value.sourceHead!==environment.VERCEL_GIT_COMMIT_SHA||['organizationId','actorId','projectId'].some(key=>!workspaceId(value[key]))||!/^user_[A-Za-z0-9]+$/.test(value.clerkUserId||'')||!/^org_[A-Za-z0-9]+$/.test(value.clerkOrganizationId||'')||['appId','businessId','wabaId','phoneNumberId'].some(key=>!asset(value[key]))||value.appId!==OBRASAAS_META_CHANNEL.appId||value.appId!==environment.NEXT_PUBLIC_META_APP_ID||value.wabaId===OBRASAAS_META_CHANNEL.wabaId||value.phoneNumberId===OBRASAAS_META_CHANNEL.phoneNumberId||!/^\+[1-9]\d{7,14}$/.test(value.expectedPhoneE164||'')||!Number.isSafeInteger(value.companyPhoneRevision)||value.companyPhoneRevision<1||!timestamp(value.issuedAt)||!timestamp(value.expiresAt)||Date.parse(value.issuedAt)>now||Date.parse(value.expiresAt)<=now||Date.parse(value.expiresAt)<=Date.parse(value.issuedAt)||Date.parse(value.expiresAt)-Date.parse(value.issuedAt)>META_OWN_COMPANY_TTL_MS)return null;
 const policyDigest=ownCompanyPolicySourceDigest(value,value.sourceHead);
 if(policyDigest!==environment.OBRASAAS_META_OWN_COMPANY_POLICY_REVIEW_SHA256)return null;
 return Object.freeze({...value,policyDigest});
}
function memberMatches(policy,{member,session,project}){
 const declared=companyPhoneContract(project?.organizationMetadata);
 return member?.role==='ADMIN'&&member.actorId===policy.actorId&&member.organizationId===policy.organizationId&&project?.id===policy.projectId&&project.organizationId===policy.organizationId&&session?.userId===policy.clerkUserId&&session.organizationId===policy.clerkOrganizationId&&session.organizationRole==='org:admin'&&declared?.e164===policy.expectedPhoneE164&&declared.revision===policy.companyPhoneRevision;
}
export function createOwnCompanyCapability(context,environment=process.env,now=Date.now()){
 const policy=readOwnCompanyPolicy(environment,now);if(!policy||!memberMatches(policy,context))fail();
 const capability=Object.freeze({});capabilities.set(capability,policy);return capability;
}
export function ownCompanyCapabilityPolicy(capability,environment=process.env,now=Date.now()){
 const original=capabilities.get(capability),current=readOwnCompanyPolicy(environment,now);if(!original||!current||original.policyDigest!==current.policyDigest)fail();return current;
}
export function ownCompanyCapabilityKind(capability){return capabilities.has(capability)?'ADMIN':runtimeCapabilities.has(capability)?'RUNTIME':null;}
// A transport may tighten its sealed lease to the source authority deadline.
// This helper can neither extend a capability nor create authority from data.
export function restrictOwnCompanyRuntimeCapability(capability,notAfter,now=Date.now()){
 const current=runtimeCapabilities.get(capability);if(!current||!Number.isSafeInteger(notAfter)||notAfter<=now)fail();
 const bounded=Object.freeze({});runtimeCapabilities.set(bounded,{policy:current.policy,leaseExpiresAt:Math.min(current.leaseExpiresAt,notAfter)});return bounded;
}
// A runtime capability is minted only by the canonical database/audit resolver.
// Its short request lease never extends the finite provider credential lifetime.
export function ownCompanyTransportPolicy(capability,environment=process.env,now=Date.now()){
 if(capabilities.has(capability))return ownCompanyCapabilityPolicy(capability,environment,now);
 const current=runtimeCapabilities.get(capability);
 if(!current||environment.VERCEL_ENV!=='production'||environment.NEXT_PUBLIC_META_APP_ID!==current.policy.appId||current.leaseExpiresAt<=now||Date.parse(current.policy.expiresAt)<=now)fail();
 return current.policy;
}
// Only ACTIVATE, after original OPERATIONAL provider inspection, persists this
// grant and its identical origin receipt in the same transaction. The source
// SHA records that authorization; it is not a fence on subsequent deployments.
export function createOwnCompanyRuntimeGrant({capability,connection,receiptId,operationId:operation,channelRevision,providerAuthority},environment=process.env,now=Date.now()){
 const policy=ownCompanyCapabilityPolicy(capability,environment,now),a=providerAuthority;
 if(!connection||!workspaceId(connection.id)||connection.projectId!==policy.projectId||connection.organizationId!==undefined&&connection.organizationId!==policy.organizationId||connection.phoneNumberId!==policy.phoneNumberId||connection.whatsappBusinessId!==policy.wabaId||normalizeCompanyPhone(connection.displayPhoneNumber,true)!==policy.expectedPhoneE164||connection.metadata?.credentialFormat!=='tenant-aad-v2'||connection.metadata.credentialOrganizationId!==policy.organizationId||typeof connection.encryptedAccessToken!=='string'||!connection.encryptedAccessToken.startsWith('v2.')||receiptId!=='company_own_'+digest([policy.organizationId,policy.actorId,policy.projectId,operation])||!operationId(operation)||!Number.isSafeInteger(channelRevision)||channelRevision<1||!sameKeys(a,['tokenDigest','systemUserId','tokenExpiresAt','dataAccessExpiresAt','checkedAt'])||!commitment(a.tokenDigest)||!asset(a.systemUserId)||!timestamp(a.tokenExpiresAt)||!(a.dataAccessExpiresAt===null||timestamp(a.dataAccessExpiresAt))||!timestamp(a.checkedAt)||Date.parse(a.checkedAt)>now||Date.parse(a.checkedAt)<now-60000)fail();
 const validUntil=new Date(Math.min(Date.parse(a.tokenExpiresAt),a.dataAccessExpiresAt===null?Infinity:Date.parse(a.dataAccessExpiresAt))).toISOString();
 if(Date.parse(validUntil)<=now+300000||Date.parse(validUntil)<Date.parse(policy.expiresAt))fail();
 const grant={version:2,mode:META_OWN_COMPANY_MODE,state:'ACTIVE',grantId:'own_runtime_'+digest([policy.organizationId,connection.id,receiptId]),connectionId:connection.id,...Object.fromEntries(['organizationId','actorId','clerkUserId','clerkOrganizationId','projectId','appId','businessId','wabaId','phoneNumberId','expectedPhoneE164','companyPhoneRevision'].map(key=>[key,policy[key]])),credentialFormat:'tenant-aad-v2',credentialCommitment:customerSecretDigest(connection.encryptedAccessToken),tokenDigest:a.tokenDigest,systemUserId:a.systemUserId,tokenExpiresAt:a.tokenExpiresAt,dataAccessExpiresAt:a.dataAccessExpiresAt,validUntil,issuedAt:new Date(now).toISOString(),origin:{version:1,receiptId,operationId:operation,sourceHead:policy.sourceHead,policyDigest:policy.policyDigest,issuedAt:policy.issuedAt,expiresAt:policy.expiresAt,channelRevision}};
 return Object.freeze({...grant,grantDigest:grantDigest(grant)});
}
function runtimeConnectionPolicy(connection,environment,now){
 const grant=connection.metadata.ownCompanyRuntime,proof=connection.metadata.ownCompany,origin=grant?.origin;
 if(environment.VERCEL_ENV!=='production'||!sameKeys(grant,runtimeKeys)||grant.version!==2||grant.mode!==META_OWN_COMPANY_MODE||grant.state!=='ACTIVE'||!sameKeys(origin,originKeys)||origin.version!==1||!/^company_own_[a-f0-9]{64}$/.test(origin.receiptId||'')||!operationId(origin.operationId)||!/^[a-f0-9]{40}$/.test(origin.sourceHead||'')||!commitment(origin.policyDigest)||!timestamp(origin.issuedAt)||!timestamp(origin.expiresAt)||Date.parse(origin.expiresAt)<=Date.parse(origin.issuedAt)||Date.parse(origin.expiresAt)-Date.parse(origin.issuedAt)>META_OWN_COMPANY_TTL_MS||!Number.isSafeInteger(origin.channelRevision)||origin.channelRevision<1||['connectionId','organizationId','actorId','projectId'].some(key=>!workspaceId(grant[key]))||!/^user_[A-Za-z0-9]+$/.test(grant.clerkUserId||'')||!/^org_[A-Za-z0-9]+$/.test(grant.clerkOrganizationId||'')||['appId','businessId','wabaId','phoneNumberId','systemUserId'].some(key=>!asset(grant[key]))||grant.appId!==OBRASAAS_META_CHANNEL.appId||grant.appId!==environment.NEXT_PUBLIC_META_APP_ID||grant.wabaId===OBRASAAS_META_CHANNEL.wabaId||grant.phoneNumberId===OBRASAAS_META_CHANNEL.phoneNumberId||!/^\+[1-9]\d{7,14}$/.test(grant.expectedPhoneE164||'')||!Number.isSafeInteger(grant.companyPhoneRevision)||grant.companyPhoneRevision<1||grant.credentialFormat!=='tenant-aad-v2'||!commitment(grant.credentialCommitment)||!commitment(grant.tokenDigest)||!commitment(grant.grantDigest)||grant.grantDigest!==grantDigest(grant)||grant.grantId!=='own_runtime_'+digest([grant.organizationId,grant.connectionId,origin.receiptId])||origin.receiptId!=='company_own_'+digest([grant.organizationId,grant.actorId,grant.projectId,origin.operationId])||!timestamp(grant.issuedAt)||Date.parse(grant.issuedAt)>now||Date.parse(grant.issuedAt)<Date.parse(origin.issuedAt)||Date.parse(grant.issuedAt)>=Date.parse(origin.expiresAt)||!timestamp(grant.tokenExpiresAt)||!(grant.dataAccessExpiresAt===null||timestamp(grant.dataAccessExpiresAt))||!timestamp(grant.validUntil)||Date.parse(grant.validUntil)!==Math.min(Date.parse(grant.tokenExpiresAt),grant.dataAccessExpiresAt===null?Infinity:Date.parse(grant.dataAccessExpiresAt))||Date.parse(grant.validUntil)<=now||Date.parse(grant.validUntil)<Date.parse(origin.expiresAt))fail();
 const declared=connection.metadata.declaredCompanyPhone;
 if(!proof||proof.version!==1||proof.mode!==META_OWN_COMPANY_MODE||proof.ownerVerified!==true||proof.policyDigest!==origin.policyDigest||proof.expiresAt!==origin.expiresAt||!timestamp(proof.verifiedAt)||Date.parse(proof.verifiedAt)>Date.parse(grant.issuedAt)||['actorId','organizationId','projectId','appId','businessId','wabaId','phoneNumberId','companyPhoneRevision'].some(key=>proof[key]!==grant[key])||connection.id!==grant.connectionId||connection.projectId!==grant.projectId||connection.organizationId!==undefined&&connection.organizationId!==grant.organizationId||connection.metadata.credentialOrganizationId!==grant.organizationId||connection.metadata.credentialFormat!==grant.credentialFormat||typeof connection.encryptedAccessToken!=='string'||!connection.encryptedAccessToken.startsWith('v2.')||customerSecretDigest(connection.encryptedAccessToken)!==grant.credentialCommitment||connection.whatsappBusinessId!==grant.wabaId||connection.phoneNumberId!==grant.phoneNumberId||normalizeCompanyPhone(connection.displayPhoneNumber,true)!==grant.expectedPhoneE164||declared?.e164!==grant.expectedPhoneE164||declared.revision!==grant.companyPhoneRevision||connection.metadata.developmentPilot||connection.enabled!==true||connection.connectionStatus!=='CONNECTED'||connection.metadata.customerSubscribed!==true||connection.metadata.customerActivation?.state!=='ACTIVE')fail();
 return Object.freeze({...grant,policyDigest:grant.grantDigest,expiresAt:grant.validUntil});
}
export function revokeOwnCompanyRuntimeGrant(connection,{member,projectId,receiptId,operationId:operation,now=Date.now()}){
 const grant=connection?.metadata?.ownCompanyRuntime;if(!grant)return null;
 if(member?.role!=='ADMIN'||member.organizationId!==connection.metadata.credentialOrganizationId||!workspaceId(member.actorId)||!workspaceId(projectId)||!operationId(operation)||receiptId!=='company_channel_'+digest([member.organizationId,member.actorId,projectId,operation]))fail();
 return {...grant,state:'REVOKED',revocation:{version:1,actorId:member.actorId,projectId,receiptId,operationId:operation,revokedAt:new Date(now).toISOString()}};
}
export function ownCompanyConnectionPolicy(connection,environment=process.env,now=Date.now()){
 if(connection?.metadata&&Object.hasOwn(connection.metadata,'ownCompanyRuntime'))return runtimeConnectionPolicy(connection,environment,now);
 const proof=connection?.metadata?.ownCompany;if(!proof)return null;
 const policy=readOwnCompanyPolicy(environment,now);
 if(!policy||proof.version!==1||proof.mode!==META_OWN_COMPANY_MODE||proof.policyDigest!==policy.policyDigest||proof.ownerVerified!==true||proof.actorId!==policy.actorId||proof.organizationId!==policy.organizationId||proof.projectId!==policy.projectId||proof.appId!==policy.appId||proof.businessId!==policy.businessId||proof.wabaId!==policy.wabaId||proof.phoneNumberId!==policy.phoneNumberId||proof.companyPhoneRevision!==policy.companyPhoneRevision||proof.expiresAt!==policy.expiresAt||!timestamp(proof.verifiedAt)||Date.parse(proof.verifiedAt)>now||connection.projectId!==policy.projectId||connection.organizationId!==undefined&&connection.organizationId!==policy.organizationId||connection.metadata.credentialOrganizationId!==policy.organizationId||connection.whatsappBusinessId!==policy.wabaId||connection.phoneNumberId!==policy.phoneNumberId||connection.metadata.developmentPilot||normalizeCompanyPhone(connection.displayPhoneNumber,true)!==policy.expectedPhoneE164)fail();
 return policy;
}
// Runtime callers use the canonical connection and current issuer membership,
// never a serialized company boolean or an actor supplied by a webhook.
export async function lockOwnCompanyIssuer(client,connection,{environment=process.env,now=Date.now(),lock=true}={}){
 if(!connection?.metadata?.ownCompany&&!Object.hasOwn(connection?.metadata||{},'ownCompanyRuntime'))return null;
 const policy=ownCompanyConnectionPolicy(connection,environment,now);
 const rows=(await client.query(`SELECT u.id AS "actorId",tm."organizationId",tm."tenantRole"::text AS role,o.metadata AS "organizationMetadata" FROM public."PlatformUser" u JOIN public."TenantMembership" tm ON tm."userId"=u.id JOIN public."Organization" o ON o.id=tm."organizationId" JOIN public."Project" p ON p."organizationId"=o.id AND p.id=$4 WHERE u.id=$1 AND u."clerkUserId"=$2 AND tm."organizationId"=$3 AND tm.status='ACTIVE' AND tm."tenantRole"::text='ADMIN' AND tm."clerkRole"='org:admin' AND o."clerkOrganizationId"=$5 AND p.status='ACTIVE' AND COALESCE(o.metadata->'internal','false'::jsonb)<>'true'::jsonb ${lock?'FOR SHARE OF u,tm,o,p':''}`,[policy.actorId,policy.clerkUserId,policy.organizationId,policy.projectId,policy.clerkOrganizationId])).rows;
 if(rows.length!==1)fail();const row=rows[0];
 if(Object.hasOwn(connection.metadata,'ownCompanyRuntime')){
  if(!memberMatches(policy,{member:row,session:{userId:policy.clerkUserId,organizationId:policy.clerkOrganizationId,organizationRole:'org:admin'},project:{id:policy.projectId,organizationId:policy.organizationId,organizationMetadata:row.organizationMetadata}}))fail();
  const current=(await client.query(`SELECT c.*,p."organizationId" FROM public."WhatsAppConnection" c JOIN public."Project" p ON p.id=c."projectId" WHERE c.id=$1 AND c."projectId"=$2 AND p."organizationId"=$3 ${lock?'FOR SHARE OF c,p':''}`,[policy.connectionId,policy.projectId,policy.organizationId])).rows;
  if(current.length!==1||current[0].encryptedAccessToken!==connection.encryptedAccessToken||ownCompanyConnectionPolicy(current[0],environment,now).grantDigest!==policy.grantDigest)fail();
  const receipt=(await client.query(`SELECT id,metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND action='company.own.number.recorded' AND "entityType"='WhatsAppConnection' AND "entityId"=$4 ${lock?'FOR SHARE':''}`,[policy.origin.receiptId,policy.organizationId,policy.actorId,policy.connectionId])).rows;
  const audit=receipt[0]?.metadata;
  if(receipt.length!==1||audit?.state!=='RECORDED'||audit.action!=='ACTIVATE_OWN_NUMBER'||audit.projectId!==policy.projectId||audit.operationId!==policy.origin.operationId||audit.connectionId!==policy.connectionId||audit.policyDigest!==policy.origin.policyDigest||!sameKeys(audit.runtimeGrant,runtimeKeys)||grantDigest(audit.runtimeGrant)!==policy.grantDigest||audit.runtimeGrant.grantDigest!==policy.grantDigest)fail();
  const capability=Object.freeze({});runtimeCapabilities.set(capability,{policy,leaseExpiresAt:Math.min(now+60000,Date.parse(policy.expiresAt))});return capability;
 }
 return createOwnCompanyCapability({member:row,session:{userId:policy.clerkUserId,organizationId:policy.clerkOrganizationId,organizationRole:'org:admin'},project:{id:policy.projectId,organizationId:policy.organizationId,organizationMetadata:row.organizationMetadata}},environment,now);
}
export async function fenceOwnCompanyRuntime(client,connection,options){
 const capability=await lockOwnCompanyIssuer(client,connection,options);if(ownCompanyCapabilityKind(capability)!=='RUNTIME')fail();return capability;
}
// One fresh canonical statement for external boundaries in an already locked
// transaction. This does not cache or extend a captured transport capability.
export async function compactOwnCompanyRuntimeFence(client,connection,{environment=process.env,now=Date.now(),notAfter}={}){
 const expected=ownCompanyConnectionPolicy(connection,environment,now);if(!expected?.grantDigest)fail();
 const rows=(await client.query(`SELECT c.*,p."organizationId",u.id AS "runtimeActorId",tm."tenantRole"::text AS "runtimeRole",o.metadata AS "runtimeOrganizationMetadata",a.metadata AS "runtimeAudit",clock_timestamp() AS "runtimeNow"
  FROM public."WhatsAppConnection" c JOIN public."Project" p ON p.id=c."projectId"
  JOIN public."Organization" o ON o.id=p."organizationId" JOIN public."PlatformUser" u ON u.id=$4 AND u."clerkUserId"=$5
  JOIN public."TenantMembership" tm ON tm."userId"=u.id AND tm."organizationId"=o.id AND tm.status='ACTIVE' AND tm."tenantRole"::text='ADMIN' AND tm."clerkRole"='org:admin'
  JOIN public."AuditLog" a ON a.id=$7 AND a."organizationId"=o.id AND a."actorId"=u.id AND a.action='company.own.number.recorded' AND a."entityType"='WhatsAppConnection' AND a."entityId"=c.id
  WHERE c.id=$1 AND c."projectId"=$2 AND p."organizationId"=$3 AND p.status='ACTIVE' AND o."clerkOrganizationId"=$6 AND COALESCE(o.metadata->'internal','false'::jsonb)<>'true'::jsonb FOR SHARE OF c,p,o,u,tm,a`,[expected.connectionId,expected.projectId,expected.organizationId,expected.actorId,expected.clerkUserId,expected.clerkOrganizationId,expected.origin.receiptId])).rows;
 if(rows.length!==1)fail();const row=rows[0],time=row.runtimeNow;
 if(!(time instanceof Date)||!Number.isFinite(time.getTime())||row.encryptedAccessToken!==connection.encryptedAccessToken)fail();
 const policy=ownCompanyConnectionPolicy(row,environment,time.getTime()),audit=row.runtimeAudit;
 if(policy.grantDigest!==expected.grantDigest||!memberMatches(policy,{member:{actorId:row.runtimeActorId,organizationId:row.organizationId,role:row.runtimeRole},session:{userId:policy.clerkUserId,organizationId:policy.clerkOrganizationId,organizationRole:'org:admin'},project:{id:policy.projectId,organizationId:policy.organizationId,organizationMetadata:row.runtimeOrganizationMetadata}})||audit?.state!=='RECORDED'||audit.action!=='ACTIVATE_OWN_NUMBER'||audit.projectId!==policy.projectId||audit.operationId!==policy.origin.operationId||audit.connectionId!==policy.connectionId||audit.policyDigest!==policy.origin.policyDigest||!sameKeys(audit.runtimeGrant,runtimeKeys)||grantDigest(audit.runtimeGrant)!==policy.grantDigest||audit.runtimeGrant.grantDigest!==policy.grantDigest)fail();
 const capability=Object.freeze({});runtimeCapabilities.set(capability,{policy,leaseExpiresAt:Math.min(time.getTime()+60000,Date.parse(policy.expiresAt))});return notAfter===undefined?capability:restrictOwnCompanyRuntimeCapability(capability,notAfter,time.getTime());
}
