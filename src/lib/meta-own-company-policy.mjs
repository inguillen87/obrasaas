import {WorkspaceError,workspaceId,digest} from './workspace-policy.mjs';
import {OBRASAAS_META_CHANNEL} from './meta-channel-binding.mjs';
import {companyPhoneContract,normalizeCompanyPhone} from './company-onboarding-policy.mjs';

export const META_OWN_COMPANY_MODE='OWN_COMPANY';
export const META_OWN_COMPANY_TTL_MS=4*60*60*1000;
// Confirmed runtime denials are observations or manual prepared-media recovery.
// Ownership/provider timeouts remain transient; never classify by a prefix.
export const META_OWN_COMPANY_AUTHORIZATION_CODES=Object.freeze(['META_OWN_COMPANY_UNAVAILABLE','META_OWN_COMPANY_CONFIGURATION_PENDING','META_OWN_COMPANY_OWNER_UNVERIFIED','META_OWN_COMPANY_TOKEN_REJECTED','META_OWN_COMPANY_CREDENTIAL_REJECTED','META_OWN_COMPANY_ASSET_REJECTED','META_OWN_COMPANY_PHONE_REJECTED','META_OWN_COMPANY_ADAPTER_UNAVAILABLE']);
const capabilities=new WeakMap(),keys=['version','sourceHead','organizationId','actorId','clerkUserId','clerkOrganizationId','projectId','appId','businessId','wabaId','phoneNumberId','expectedPhoneE164','companyPhoneRevision','issuedAt','expiresAt'];
const asset=value=>typeof value==='string'&&/^[1-9]\d{4,31}$/.test(value);
const timestamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const fail=()=>{throw new WorkspaceError('META_OWN_COMPANY_UNAVAILABLE',403);};
// A deployment must explicitly review this exact, private configuration. The
// ordinary customer release and the development pilot cannot mint this grant.
export function readOwnCompanyPolicy(environment=process.env,now=Date.now()){
 if(environment.VERCEL_ENV!=='production')return null;
 let value;try{value=JSON.parse(environment.OBRASAAS_META_OWN_COMPANY_POLICY);}catch{return null;}
 if(environment.OBRASAAS_META_OWN_COMPANY_RELEASE!=='own-company-number-v1'||!value||Array.isArray(value)||Object.keys(value).sort().join('|')!==keys.slice().sort().join('|')||value.version!==1||!/^[a-f0-9]{40}$/.test(value.sourceHead||'')||value.sourceHead!==environment.VERCEL_GIT_COMMIT_SHA||['organizationId','actorId','projectId'].some(key=>!workspaceId(value[key]))||!/^user_[A-Za-z0-9]+$/.test(value.clerkUserId||'')||!/^org_[A-Za-z0-9]+$/.test(value.clerkOrganizationId||'')||['appId','businessId','wabaId','phoneNumberId'].some(key=>!asset(value[key]))||value.appId!==OBRASAAS_META_CHANNEL.appId||value.appId!==environment.NEXT_PUBLIC_META_APP_ID||value.wabaId===OBRASAAS_META_CHANNEL.wabaId||value.phoneNumberId===OBRASAAS_META_CHANNEL.phoneNumberId||!/^\+[1-9]\d{7,14}$/.test(value.expectedPhoneE164||'')||!Number.isSafeInteger(value.companyPhoneRevision)||value.companyPhoneRevision<1||!timestamp(value.issuedAt)||!timestamp(value.expiresAt)||Date.parse(value.issuedAt)>now||Date.parse(value.expiresAt)<=now||Date.parse(value.expiresAt)<=Date.parse(value.issuedAt)||Date.parse(value.expiresAt)-Date.parse(value.issuedAt)>META_OWN_COMPANY_TTL_MS)return null;
 const policyDigest=digest(Object.fromEntries(keys.map(key=>[key,value[key]])));
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
export function ownCompanyConnectionPolicy(connection,environment=process.env,now=Date.now()){
 const proof=connection?.metadata?.ownCompany;if(!proof)return null;
 const policy=readOwnCompanyPolicy(environment,now);
 if(!policy||proof.version!==1||proof.mode!==META_OWN_COMPANY_MODE||proof.policyDigest!==policy.policyDigest||proof.ownerVerified!==true||proof.actorId!==policy.actorId||proof.organizationId!==policy.organizationId||proof.projectId!==policy.projectId||proof.appId!==policy.appId||proof.businessId!==policy.businessId||proof.wabaId!==policy.wabaId||proof.phoneNumberId!==policy.phoneNumberId||proof.companyPhoneRevision!==policy.companyPhoneRevision||proof.expiresAt!==policy.expiresAt||!timestamp(proof.verifiedAt)||Date.parse(proof.verifiedAt)>now||connection.projectId!==policy.projectId||connection.organizationId!==undefined&&connection.organizationId!==policy.organizationId||connection.metadata.credentialOrganizationId!==policy.organizationId||connection.whatsappBusinessId!==policy.wabaId||connection.phoneNumberId!==policy.phoneNumberId||connection.metadata.developmentPilot||normalizeCompanyPhone(connection.displayPhoneNumber,true)!==policy.expectedPhoneE164)fail();
 return policy;
}
// Runtime callers use the canonical connection and current issuer membership,
// never a serialized company boolean or an actor supplied by a webhook.
export async function lockOwnCompanyIssuer(client,connection,{environment=process.env,now=Date.now(),lock=true}={}){
 if(!connection?.metadata?.ownCompany)return null;
 const policy=ownCompanyConnectionPolicy(connection,environment,now);
 const rows=(await client.query(`SELECT u.id AS "actorId",tm."organizationId",tm."tenantRole"::text AS role,o.metadata AS "organizationMetadata" FROM public."PlatformUser" u JOIN public."TenantMembership" tm ON tm."userId"=u.id JOIN public."Organization" o ON o.id=tm."organizationId" JOIN public."Project" p ON p."organizationId"=o.id AND p.id=$4 WHERE u.id=$1 AND u."clerkUserId"=$2 AND tm."organizationId"=$3 AND tm.status='ACTIVE' AND tm."tenantRole"::text='ADMIN' AND tm."clerkRole"='org:admin' AND o."clerkOrganizationId"=$5 AND p.status='ACTIVE' AND COALESCE(o.metadata->'internal','false'::jsonb)<>'true'::jsonb ${lock?'FOR SHARE OF u,tm,o,p':''}`,[policy.actorId,policy.clerkUserId,policy.organizationId,policy.projectId,policy.clerkOrganizationId])).rows;
 if(rows.length!==1)fail();const row=rows[0];
 return createOwnCompanyCapability({member:row,session:{userId:policy.clerkUserId,organizationId:policy.clerkOrganizationId,organizationRole:'org:admin'},project:{id:policy.projectId,organizationId:policy.organizationId,organizationMetadata:row.organizationMetadata}},environment,now);
}
