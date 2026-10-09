import test from 'node:test';
import assert from 'node:assert/strict';
import {readOwnCompanyPolicy,ownCompanyCapabilityPolicy,ownCompanyCapabilityKind,ownCompanyTransportPolicy,ownCompanyConnectionPolicy,lockOwnCompanyIssuer,createOwnCompanyRuntimeGrant,revokeOwnCompanyRuntimeGrant,META_OWN_COMPANY_TTL_MS} from '../src/lib/meta-own-company-policy.mjs';
import {customerChannelActive} from '../src/lib/meta-customer-outbound.mjs';
import {digest} from '../src/lib/workspace-policy.mjs';
import {ownCompanyRuntimeFixture} from './fixtures/own-company-runtime.mjs';

test('v2 operation survives the setup window and future Git publication, without extending administrative configuration',async()=>{
 const f=await ownCompanyRuntimeFixture();f.time+=META_OWN_COMPANY_TTL_MS+3600000;f.environment.VERCEL_GIT_COMMIT_SHA='c'.repeat(40);
 assert.equal(readOwnCompanyPolicy(f.environment,f.time),null);assert.throws(()=>ownCompanyCapabilityPolicy(f.adminCapability,f.environment,f.time),{code:'META_OWN_COMPANY_UNAVAILABLE'});
 const cap=await f.capability();assert.equal(ownCompanyCapabilityKind(cap),'RUNTIME');assert.equal(ownCompanyTransportPolicy(cap,f.environment,f.time).expiresAt,new Date(Date.parse(f.policy.issuedAt)+1000+18*3600000).toISOString());assert.equal(customerChannelActive(f.connection,f.time,{environment:f.environment}),true);
 assert.equal(f.connection.metadata.customerActivation.roundTrip,'NOT_VERIFIED');assert.equal(f.connection.metadata.customerActivation.fieldJourney,'NOT_VERIFIED');
 f.time+=60000;assert.throws(()=>ownCompanyTransportPolicy(cap,f.environment,f.time));assert.equal(ownCompanyCapabilityKind(await f.capability()),'RUNTIME');
});
test('legacy v1 remains closed after its original window, without implicit durable upgrade',async()=>{
 const f=await ownCompanyRuntimeFixture();delete f.connection.metadata.ownCompanyRuntime;f.time=Date.parse(f.policy.expiresAt)+1;
 assert.throws(()=>ownCompanyConnectionPolicy(f.connection,f.environment,f.time),{code:'META_OWN_COMPANY_UNAVAILABLE'});assert.equal(customerChannelActive(f.connection,f.time,{environment:f.environment}),false);await assert.rejects(f.capability());
});
for(const [name,patch] of [['changed application',{NEXT_PUBLIC_META_APP_ID:'999999999'}],['non-production environment',{VERCEL_ENV:'preview'}]])test('runtime denies '+name+' without inheriting another application authority',async()=>{const f=await ownCompanyRuntimeFixture();Object.assign(f.environment,patch);assert.equal(customerChannelActive(f.connection,f.time,{environment:f.environment}),false);await assert.rejects(f.capability());});
for(const [name,change] of [
 ['tenant',c=>c.organizationId='org-b'],['anchor',c=>c.projectId='project-b'],['number',c=>c.phoneNumberId='999999999'],['WABA',c=>c.whatsappBusinessId='999999999'],['phone declaration revision',c=>c.metadata.declaredCompanyPhone.revision++],['phone value',c=>c.displayPhoneNumber='+5491100001111'],['credential ciphertext',c=>c.encryptedAccessToken+='changed'],['missing original own proof',c=>delete c.metadata.ownCompany],['null runtime marker',c=>c.metadata.ownCompanyRuntime=null],['origin SHA modification',c=>c.metadata.ownCompanyRuntime.origin.sourceHead='d'.repeat(40)],['origin receipt modification',c=>c.metadata.ownCompanyRuntime.origin.receiptId='company_own_'+'d'.repeat(64)],['grant digest modification',c=>c.metadata.ownCompanyRuntime.grantDigest='d'.repeat(64)],
])test('v2 connection rejects changed '+name+' instead of falling back to customer transport',async()=>{const f=await ownCompanyRuntimeFixture();change(f.connection);assert.equal(customerChannelActive(f.connection,f.time,{environment:f.environment}),false);await assert.rejects(f.capability());});
for(const [name,change] of [
 ['inactive issuer',f=>f.controls.issuerActive=false],['non-admin issuer',f=>f.controls.issuerRole='DIRECTOR'],['canonical organization phone revision',f=>f.controls.organizationMetadata={companyPhoneDeclaration:{...f.declaration,revision:2}}],['missing origin receipt',f=>f.controls.receiptPresent=false],['UNKNOWN origin receipt',f=>f.receipt.metadata.state='PROVIDER_UNKNOWN'],['wrong origin action',f=>f.receipt.metadata.action='CONNECT_OWN_NUMBER'],['changed persisted grant',f=>f.receipt.metadata.runtimeGrant.tokenDigest='e'.repeat(64)],['canonical connection replacement',f=>f.controls.current={...f.connection,encryptedAccessToken:f.connection.encryptedAccessToken+'changed'}],
])test('runtime authority requires fresh canonical '+name,async()=>{const f=await ownCompanyRuntimeFixture();change(f);await assert.rejects(f.capability(),{code:'META_OWN_COMPANY_UNAVAILABLE'});});
test('expiry and explicit ADMIN revocation close operation even while the administrative policy is expired',async()=>{
 const f=await ownCompanyRuntimeFixture();f.time+=5*3600000;
 const operationId='22222222-2222-4222-8222-222222222222',member=f.context.member,receiptId='company_channel_'+digest([member.organizationId,member.actorId,f.connection.projectId,operationId]);
 const revoked=revokeOwnCompanyRuntimeGrant(f.connection,{member,projectId:f.connection.projectId,receiptId,operationId,now:f.time});assert.equal(revoked.state,'REVOKED');assert.equal(revoked.revocation.receiptId,receiptId);f.connection.metadata.ownCompanyRuntime=revoked;assert.equal(customerChannelActive(f.connection,f.time,{environment:f.environment}),false);await assert.rejects(f.capability());
 const fresh=await ownCompanyRuntimeFixture();fresh.time=Date.parse(fresh.runtimeGrant.validUntil);assert.equal(customerChannelActive(fresh.connection,fresh.time,{environment:fresh.environment}),false);await assert.rejects(fresh.capability());
 assert.throws(()=>revokeOwnCompanyRuntimeGrant(f.connection,{member:{...member,role:'DIRECTOR'},projectId:f.connection.projectId,receiptId,operationId,now:f.time}));
});
test('minting requires finite original provider lifetime, a fresh administrative capability and exact audited operation',async()=>{
 const f=await ownCompanyRuntimeFixture(),input={capability:f.adminCapability,connection:f.connection,receiptId:f.runtimeGrant.origin.receiptId,operationId:f.runtimeGrant.origin.operationId,channelRevision:2,providerAuthority:{tokenDigest:f.runtimeGrant.tokenDigest,systemUserId:f.runtimeGrant.systemUserId,tokenExpiresAt:f.runtimeGrant.tokenExpiresAt,dataAccessExpiresAt:f.runtimeGrant.dataAccessExpiresAt,checkedAt:new Date(f.time).toISOString()}};
 for(const patch of [{tokenExpiresAt:null},{tokenExpiresAt:0},{tokenExpiresAt:'never'},{dataAccessExpiresAt:'unknown'},{tokenExpiresAt:new Date(f.time+120000).toISOString()},{checkedAt:new Date(f.time-60001).toISOString()}])assert.throws(()=>createOwnCompanyRuntimeGrant({...input,providerAuthority:{...input.providerAuthority,...patch}},f.environment,f.time));
 assert.throws(()=>createOwnCompanyRuntimeGrant({...input,receiptId:'company_own_'+'e'.repeat(64)},f.environment,f.time));f.time+=META_OWN_COMPANY_TTL_MS;assert.throws(()=>createOwnCompanyRuntimeGrant(input,f.environment,f.time));
});
test('canonical reread cannot use captured grant A after an active grant or ciphertext replacement',async()=>{
 const f=await ownCompanyRuntimeFixture(),captured=structuredClone(f.connection);await f.beforeExternal(captured);f.controls.current=structuredClone(f.connection);f.controls.current.metadata.ownCompanyRuntime.state='REVOKED';await assert.rejects(f.beforeExternal(captured));
 f.controls.current=structuredClone(f.connection);f.controls.current.encryptedAccessToken+='changed';await assert.rejects(f.beforeExternal(captured));
 assert.ok(f.queries.some(q=>q.sql.includes('FOR SHARE OF c,p')));assert.ok(f.queries.some(q=>q.sql.includes('"entityType"=\'WhatsAppConnection\'')));
});
