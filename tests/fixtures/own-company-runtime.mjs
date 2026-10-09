import assert from 'node:assert/strict';
import {createMetaCustomerProvider} from '../../src/lib/meta-customer-provider.mjs';
import {createOwnCompanyCapability,createOwnCompanyRuntimeGrant,lockOwnCompanyIssuer} from '../../src/lib/meta-own-company-policy.mjs';
import {encryptCustomerSecret} from '../../src/lib/meta-customer-credentials.mjs';
import {digest} from '../../src/lib/workspace-policy.mjs';
import {ownCompanyFixture} from './own-company-meta.mjs';

// Explicit in-memory canonical SQL adapter. No database, credentials, browser
// or real provider is used; original policy/provider functions execute.
export async function ownCompanyRuntimeFixture(){
 const f=ownCompanyFixture({time:Date.parse('2026-10-09T12:00:00.000Z')});
 f.debug.expires_at=Math.floor((f.time+24*3600000)/1000);
 f.debug.data_access_expires_at=Math.floor((f.time+18*3600000)/1000);
 const token=f.environment.META_OWN_COMPANY_ACCESS_TOKEN;
 const provider=createMetaCustomerProvider({environment:f.environment,fetchImpl:f.fetchImpl,now:()=>f.time});
 const adminCapability=createOwnCompanyCapability(f.context,f.environment,f.time),scoped=await provider.forOwnCapability({capability:adminCapability,token}),verified=await scoped.inspect({token,wabaId:f.policy.wabaId,phoneNumberId:f.policy.phoneNumberId});
 const connection={id:'channel-own',projectId:f.policy.projectId,organizationId:f.policy.organizationId,phoneNumberId:f.policy.phoneNumberId,whatsappBusinessId:f.policy.wabaId,displayPhoneNumber:f.policy.expectedPhoneE164,enabled:true,connectionStatus:'CONNECTED',encryptedAccessToken:encryptCustomerSecret(token,{organizationId:f.policy.organizationId,projectId:f.policy.projectId,purpose:'access-token',resourceId:f.policy.phoneNumberId},f.environment),metadata:{credentialFormat:'tenant-aad-v2',credentialOrganizationId:f.policy.organizationId,declaredCompanyPhone:f.declaration,ownCompany:scoped.ownProvenance(verified),customerSubscribed:true,customerVerification:verified,customerActivation:{version:1,state:'ACTIVE',actorId:f.policy.actorId,roundTrip:'NOT_VERIFIED',fieldJourney:'NOT_VERIFIED'}}};
 const operationId='11111111-1111-4111-8111-111111111111',receiptId='company_own_'+digest([f.policy.organizationId,f.policy.actorId,f.policy.projectId,operationId]);
 const runtimeGrant=createOwnCompanyRuntimeGrant({capability:adminCapability,connection,receiptId,operationId,channelRevision:2,providerAuthority:scoped.ownOperationalAuthority(verified)},f.environment,f.time);
 connection.metadata.ownCompanyRuntime=structuredClone(runtimeGrant);
 const receipt={id:receiptId,metadata:{version:1,state:'RECORDED',action:'ACTIVATE_OWN_NUMBER',connectionId:connection.id,projectId:f.policy.projectId,operationId,policyDigest:f.policy.policyDigest||digest(f.policy),runtimeGrant:structuredClone(runtimeGrant)}};
 const controls={issuerActive:true,issuerRole:'ADMIN',receiptPresent:true,current:connection,organizationMetadata:f.context.project.organizationMetadata};
 const queries=[],client={async query(sql,args=[]){
  queries.push({sql,args});
  if(sql.includes('FROM public."WhatsAppConnection" c JOIN public."Project" p')){assert.deepEqual(args,[connection.id,connection.projectId,connection.organizationId]);return {rows:controls.current?[structuredClone(controls.current)]:[]};}
  if(sql.includes('FROM public."PlatformUser" u JOIN public."TenantMembership"')){assert.deepEqual(args,[f.policy.actorId,f.policy.clerkUserId,f.policy.organizationId,f.policy.projectId,f.policy.clerkOrganizationId]);return {rows:controls.issuerActive?[{...f.context.member,role:controls.issuerRole,organizationMetadata:structuredClone(controls.organizationMetadata)}]:[]};}
  if(sql.includes('FROM public."AuditLog"')){assert.deepEqual(args,[receiptId,f.policy.organizationId,f.policy.actorId,connection.id]);return {rows:controls.receiptPresent?[structuredClone(receipt)]:[]};}
  throw new Error('UNCONTROLLED_RUNTIME_FIXTURE_SQL');
 }};
 const capability=()=>lockOwnCompanyIssuer(client,structuredClone(connection),{environment:f.environment,now:f.time});
 const beforeExternal=expected=>lockOwnCompanyIssuer(client,expected,{environment:f.environment,now:f.time});
 return Object.assign(f,{token,provider,adminCapability,connection,runtimeGrant,receipt,controls,client,queries,capability,beforeExternal});
}
