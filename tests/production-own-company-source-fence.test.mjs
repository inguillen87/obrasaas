import test from 'node:test';
import assert from 'node:assert/strict';
import {compactOwnCompanyRuntimeFence,compactOwnCompanyRuntimeSourceFence,ownCompanyTransportPolicy,ownCompanyCapabilityKind} from '../src/lib/meta-own-company-policy.mjs';
import {ownCompanyRuntimeFixture} from './fixtures/own-company-runtime.mjs';

async function fixture({mutate=()=>{},afterRead=async()=>{}}={}){
 const f=await ownCompanyRuntimeFixture(),source={eventId:'customer_webhook_'+'c'.repeat(64),projectId:f.connection.projectId,channelId:f.connection.id,organizationId:f.connection.organizationId,payloadDigest:'d'.repeat(64),leaseToken:'source-lease-a'},event={id:source.eventId,projectId:source.projectId,provider:'meta-customer-v1',status:'PENDING',leaseToken:source.leaseToken,leaseExpiresAt:new Date(f.time+60000).toISOString(),payload:{channelId:source.channelId,organizationId:source.organizationId,payloadDigest:source.payloadDigest}},queries=[];
 const client={async query(sql,args){queries.push({sql,args:structuredClone(args)});const row={...structuredClone(f.connection),runtimeActorId:f.policy.actorId,runtimeRole:'ADMIN',runtimeOrganizationMetadata:structuredClone(f.context.project.organizationMetadata),runtimeAudit:structuredClone(f.receipt.metadata),runtimeNow:new Date(f.time),runtimeSource:structuredClone(event)};mutate(row);await afterRead(row);return {rows:[row]};}};
 return {...f,source,event,queries,client,execute:()=>compactOwnCompanyRuntimeSourceFence(client,f.connection,source,{environment:f.environment,now:f.time})};
}

test('joint preparation retains canonical OWN validation and source expiry with one database read',async()=>{
 const f=await fixture(),before=structuredClone({connection:f.connection,event:f.event}),result=await f.execute();assert.equal(f.queries.length,1);assert.equal(ownCompanyCapabilityKind(result.capability),'RUNTIME');assert.equal(result.observed.getTime(),f.time);assert.deepEqual({connection:f.connection,event:f.event},before);
 const query=f.queries[0];assert.deepEqual(query.args,[f.connection.id,f.connection.projectId,f.connection.organizationId,f.policy.actorId,f.policy.clerkUserId,f.policy.clerkOrganizationId,f.runtimeGrant.origin.receiptId,f.source.eventId]);
 assert.match(query.sql,/"ownRuntimePreparation" AS MATERIALIZED/);assert.match(query.sql,/"ownRuntimeSource" AS MATERIALIZED/);assert.match(query.sql,/FOR SHARE OF c,p,o,u,tm,a/);assert.match(query.sql,/FOR UPDATE OF e/);
 assert.equal(ownCompanyTransportPolicy(result.capability,f.environment,f.time+59999).grantDigest,f.runtimeGrant.grantDigest);assert.throws(()=>ownCompanyTransportPolicy(result.capability,f.environment,f.time+60000),{code:'META_OWN_COMPANY_UNAVAILABLE'});
});

test('ordinary compact API still performs the original OWN-only read and returns a capability',async()=>{
 const f=await fixture(),capability=await compactOwnCompanyRuntimeFence(f.client,f.connection,{environment:f.environment,now:f.time});assert.equal(ownCompanyCapabilityKind(capability),'RUNTIME');assert.equal(f.queries.length,1);assert.doesNotMatch(f.queries[0].sql,/WebhookEvent|ownRuntimeSource/);assert.equal(f.queries[0].args.length,7);
});

for(const count of [0,2])test('joint preparation rejects OWN row cardinality '+count,async()=>{
 const f=await fixture(),client={async query(sql,args){const value=await f.client.query(sql,args);return {rows:count===0?[]:[value.rows[0],value.rows[0]]};}};
 await assert.rejects(compactOwnCompanyRuntimeSourceFence(client,f.connection,f.source,{environment:f.environment,now:f.time}),{code:'META_OWN_COMPANY_UNAVAILABLE'});
});

test('a missing source is a denial even while OWN remains current',async()=>{
 const f=await fixture({mutate:r=>{r.runtimeSource=null;}});await assert.rejects(f.execute(),{code:'META_CUSTOMER_OUTBOUND_CONTEXT_CHANGED'});
});

for(const [name,change] of [
 ['issuer',r=>{r.runtimeActorId='other';}],
 ['role',r=>{r.runtimeRole='DIRECTOR';}],
 ['organization phone',r=>{r.runtimeOrganizationMetadata.companyPhoneDeclaration.revision++;}],
 ['ciphertext',r=>{r.encryptedAccessToken+='changed';}],
 ['receipt state',r=>{r.runtimeAudit.state='PROVIDER_UNKNOWN';}],
 ['receipt grant',r=>{r.runtimeAudit.runtimeGrant.tokenDigest='e'.repeat(64);}],
 ['receipt action',r=>{r.runtimeAudit.action='CONNECT_OWN_NUMBER';}],
 ['receipt origin',r=>{r.runtimeAudit.operationId='other-operation';}],
 ['runtime grant',r=>{r.metadata.ownCompanyRuntime.state='REVOKED';}],
 ['invalid database clock',r=>{r.runtimeNow='not-a-date';}],
])test('joint preparation denies changed OWN '+name,async()=>{
 const f=await fixture({mutate:change});await assert.rejects(f.execute(),{code:'META_OWN_COMPANY_UNAVAILABLE'});assert.equal(f.queries.length,1);
});

for(const [name,change] of [
 ['event',e=>{e.id='customer_webhook_'+'a'.repeat(64);}],
 ['project',e=>{e.projectId='project-other';}],
 ['provider',e=>{e.provider='another-provider';}],
 ['payload digest',e=>{e.payload.payloadDigest='a'.repeat(64);}],
 ['channel',e=>{e.payload.channelId='another-channel';}],
 ['organization',e=>{e.payload.organizationId='another-organization';}],
])test('joint preparation denies changed signed-source '+name,async()=>{
 const f=await fixture({mutate:r=>change(r.runtimeSource)});await assert.rejects(f.execute(),{code:'META_CUSTOMER_OUTBOUND_CONTEXT_CHANGED'});assert.equal(f.queries.length,1);
});

for(const [name,change] of [
 ['processed',e=>{e.status='PROCESSED';}],
 ['token',e=>{e.leaseToken='new-lease';}],
 ['invalid expiry',e=>{e.leaseExpiresAt='invalid';}],
 ['exact expiry',(e,f)=>{e.leaseExpiresAt=new Date(f.time).toISOString();}],
])test('joint preparation denies source '+name,async()=>{
 let f;f=await fixture({mutate:r=>change(r.runtimeSource,f)});await assert.rejects(f.execute(),{code:'META_CUSTOMER_INBOX_LEASE_CHANGED'});
});

test('the database clock after an awaited read controls expiry, not the captured JS clock',async()=>{
 let f;f=await fixture({afterRead:async row=>{await Promise.resolve();row.runtimeNow=new Date(f.time+60000);}});await assert.rejects(f.execute(),{code:'META_CUSTOMER_INBOX_LEASE_CHANGED'});
});

test('a shorter original source deadline tightens transport without extending it on another boundary',async()=>{
 let f;f=await fixture({mutate:r=>{r.runtimeSource.leaseExpiresAt=new Date(f.time+500).toISOString();}});const first=await f.execute();assert.equal(ownCompanyTransportPolicy(first.capability,f.environment,f.time+499).grantDigest,f.runtimeGrant.grantDigest);assert.throws(()=>ownCompanyTransportPolicy(first.capability,f.environment,f.time+500),{code:'META_OWN_COMPANY_UNAVAILABLE'});
 const second=await f.execute();assert.throws(()=>ownCompanyTransportPolicy(second.capability,f.environment,f.time+500),{code:'META_OWN_COMPANY_UNAVAILABLE'});
});

for(const key of ['eventId','projectId','organizationId','channelId','payloadDigest','leaseToken'])test('caller source '+key+' is checked against the captured connection and current row',async()=>{
 const f=await fixture();f.source[key]=key==='eventId'?'customer_webhook_'+'f'.repeat(64):'foreign';await assert.rejects(f.execute(),{code:key==='leaseToken'?'META_CUSTOMER_INBOX_LEASE_CHANGED':'META_CUSTOMER_OUTBOUND_CONTEXT_CHANGED'});
});
