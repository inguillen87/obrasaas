import {WorkspaceError,workspaceId,digest} from './workspace-policy.mjs';
import {OBRASAAS_META_CHANNEL} from './meta-channel-binding.mjs';
import {normalizeWhatsAppRecipient} from './meta-whatsapp-transport.mjs';

export const META_DEVELOPMENT_PILOT_TTL_MS=4*60*60*1000;
export const META_DEVELOPMENT_PILOT_MODE='DEVELOPMENT_PILOT';
const capabilities=new WeakMap();
const keys=['version','organizationId','actorId','clerkUserId','clerkOrganizationId','projectId','appId','configId','businessId','expectedPhoneE164','allowArgentinaMobileAlias','issuedAt','expiresAt'];
const id=value=>typeof value==='string'&&/^[1-9]\d{4,31}$/.test(value);
const timestamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const fail=(code='META_DEVELOPMENT_PILOT_UNAVAILABLE',status=403)=>{throw new WorkspaceError(code,status);};
export function readDevelopmentPilotPolicy(environment=process.env,now=Date.now()){
 if(environment.META_CONFIG_ID&&environment.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID&&environment.META_CONFIG_ID!==environment.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID)return null;
 let value;try{value=JSON.parse(environment.OBRASAAS_META_DEVELOPMENT_PILOT_POLICY);}catch{return null;}
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join('|')!==keys.slice().sort().join('|')||value.version!==1||['organizationId','actorId','projectId'].some(key=>!workspaceId(value[key]))||!/^user_[A-Za-z0-9]+$/.test(value.clerkUserId||'')||!/^org_[A-Za-z0-9]+$/.test(value.clerkOrganizationId||'')||['appId','configId','businessId'].some(key=>!id(value[key]))||value.appId!==OBRASAAS_META_CHANNEL.appId||value.appId!==environment.NEXT_PUBLIC_META_APP_ID||value.configId!==(environment.META_CONFIG_ID||environment.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID)||typeof value.allowArgentinaMobileAlias!=='boolean'||!/^\+[1-9]\d{7,14}$/.test(value.expectedPhoneE164||'')||normalizeWhatsAppRecipient(value.expectedPhoneE164)!==value.expectedPhoneE164.slice(1)||value.allowArgentinaMobileAlias&&!/^\+549\d{10}$/.test(value.expectedPhoneE164)||!timestamp(value.issuedAt)||!timestamp(value.expiresAt)||Date.parse(value.issuedAt)>now||Date.parse(value.expiresAt)<=now||Date.parse(value.expiresAt)<=Date.parse(value.issuedAt)||Date.parse(value.expiresAt)-Date.parse(value.issuedAt)>META_DEVELOPMENT_PILOT_TTL_MS)return null;
 return Object.freeze({...value,policyDigest:digest(Object.fromEntries(keys.map(key=>[key,value[key]])))});
}
export function developmentPilotPhoneMatches(policy,value){
 const normalized=normalizeWhatsAppRecipient(value),expected=policy?.expectedPhoneE164?.slice(1);
 return Boolean(normalized&&expected&&(normalized===expected||policy.allowArgentinaMobileAlias===true&&/^549\d{10}$/.test(expected)&&normalized==='54'+expected.slice(3)));
}
// Only server compositions possessing a canonical locked member/session can
// mint this opaque capability. JSON, env flags and DTOs cannot deserialize it.
export function createDevelopmentPilotCapability({member,session,project},environment=process.env,now=Date.now()){
 const policy=readDevelopmentPilotPolicy(environment,now);
 if(!policy||project?.companyRouting||member?.role!=='ADMIN'||member.actorId!==policy.actorId||member.organizationId!==policy.organizationId||project?.id!==policy.projectId||project.organizationId!==policy.organizationId||session?.userId!==policy.clerkUserId||session.organizationId!==policy.clerkOrganizationId||session.organizationRole!=='org:admin')return null;
 const capability=Object.freeze({});capabilities.set(capability,policy);return capability;
}
export function developmentPilotCapabilityPolicy(capability,environment=process.env,now=Date.now()){
 const original=capabilities.get(capability),current=readDevelopmentPilotPolicy(environment,now);
 if(!original||!current||original.policyDigest!==current.policyDigest)fail();return current;
}
export function developmentPilotCapabilityExpiry(capability){return capabilities.get(capability)?.expiresAt||null;}
export function assertDevelopmentPilotMember(capability,{member,session,project},environment=process.env,now=Date.now()){
 const policy=developmentPilotCapabilityPolicy(capability,environment,now);
 if(member?.role!=='ADMIN'||member.actorId!==policy.actorId||member.organizationId!==policy.organizationId||project?.id!==policy.projectId||project.organizationId!==policy.organizationId||session?.userId!==policy.clerkUserId||session.organizationId!==policy.clerkOrganizationId||session.organizationRole!=='org:admin')fail();return policy;
}
export function developmentPilotConnectionPolicy(connection,environment=process.env,now=Date.now()){
 const proof=connection?.metadata?.developmentPilot;if(!proof)return null;
 const policy=readDevelopmentPilotPolicy(environment,now);
 if(!policy||proof.version!==1||proof.mode!==META_DEVELOPMENT_PILOT_MODE||proof.policyDigest!==policy.policyDigest||proof.actorId!==policy.actorId||proof.clerkUserId!==policy.clerkUserId||proof.clerkOrganizationId!==policy.clerkOrganizationId||proof.organizationId!==policy.organizationId||proof.projectId!==policy.projectId||connection.projectId!==policy.projectId||connection.organizationId!==undefined&&connection.organizationId!==policy.organizationId||connection.metadata?.credentialOrganizationId!==policy.organizationId||proof.appId!==policy.appId||proof.configId!==policy.configId||proof.businessId!==policy.businessId||proof.expiresAt!==policy.expiresAt||proof.wabaId!==connection.whatsappBusinessId||proof.phoneNumberId!==connection.phoneNumberId||!id(proof.wabaId)||!id(proof.phoneNumberId)||proof.ownerVerified!==true||!timestamp(proof.verifiedAt)||Date.parse(proof.verifiedAt)>now||!developmentPilotPhoneMatches(policy,proof.displayPhoneNumber)||connection.company||connection.metadata.companyRoutingVersion!==undefined)fail();return policy;
}
// This must precede Worker/Project/Channel/Event locks. The grant issuer is
// independent of the worker and cannot be replaced by a message sender.
export async function lockDevelopmentPilotIssuer(client,connection,{environment=process.env,now=Date.now(),lock=true}={}){
 if(!connection?.metadata?.developmentPilot)return null;
 const policy=developmentPilotConnectionPolicy(connection,environment,now);
 const user=(await client.query(`SELECT id,"clerkUserId" FROM public."PlatformUser" WHERE id=$1 AND "clerkUserId"=$2 ${lock?'FOR SHARE':''}`,[policy.actorId,policy.clerkUserId])).rows[0];if(!user)fail();
 const member=(await client.query(`SELECT tm.id AS "membershipId",tm."userId" AS "actorId",tm."organizationId",tm."tenantRole"::text AS role,tm."clerkRole",o."clerkOrganizationId" FROM public."TenantMembership" tm JOIN public."Organization" o ON o.id=tm."organizationId" WHERE tm."userId"=$1 AND tm."organizationId"=$2 AND tm.status='ACTIVE' AND tm."tenantRole"::text='ADMIN' AND tm."clerkRole"='org:admin' AND o."clerkOrganizationId"=$3 AND COALESCE(o.metadata->'internal','false'::jsonb)<>'true'::jsonb ${lock?'FOR SHARE OF tm,o':''}`,[policy.actorId,policy.organizationId,policy.clerkOrganizationId])).rows;
 if(member.length!==1)fail();return createDevelopmentPilotCapability({member:member[0],session:{userId:policy.clerkUserId,organizationId:policy.clerkOrganizationId,organizationRole:'org:admin'},project:{id:policy.projectId,organizationId:policy.organizationId}},environment,now);
}
export function assertDevelopmentPilotAttendance(connection,environment=process.env,now=Date.now()){
 return developmentPilotConnectionPolicy(connection,environment,now);
}
export function assertDevelopmentPilotAdapter(connection,adapter){
 if(connection?.metadata?.developmentPilot&&!['attendance','binding','status'].includes(adapter))fail('META_DEVELOPMENT_PILOT_ADAPTER_UNAVAILABLE',409);
}
export async function assertDevelopmentPilotCommit(client,connection,environment=process.env){
 if(!connection?.metadata?.developmentPilot)return;
 const now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now.getTime();assertDevelopmentPilotAttendance(connection,environment,now);
}
