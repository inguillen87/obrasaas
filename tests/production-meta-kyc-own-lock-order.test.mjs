import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {ownCompanyRuntimeFixture} from './fixtures/own-company-runtime.mjs';
import {ownCompanyFixture} from './fixtures/own-company-meta.mjs';
import {kycMemoryFixture} from './fixtures/meta-kyc-chat-memory.mjs';
import {companyKycMemoryFixture} from './fixtures/company-kyc-memory.mjs';
import {createMetaCustomerProvider} from '../src/lib/meta-customer-provider.mjs';
import {createOwnCompanyCapability,createOwnCompanyRuntimeGrant,lockOwnCompanyIssuer,lockOwnCompanyIssuerPrincipal,ownCompanyCapabilityKind,ownCompanyTransportPolicy} from '../src/lib/meta-own-company-policy.mjs';
import {resolveMetaKycAuthority} from '../src/lib/meta-kyc-identity.mjs';
import {prepareMetaKycChallenge} from '../src/lib/meta-kyc-challenge.mjs';
import {participantReceiptId} from '../src/lib/participant-policy.mjs';
import {encryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {digest} from '../src/lib/workspace-policy.mjs';

// Actual OWN policy/provider and signed KYC resolvers, with explicit synthetic
// SQL and a closed Graph adapter. These traces do not prove PostgreSQL races.
const principalSql=sql=>sql.includes('SELECT u.id AS "actorId",tm."organizationId"');
const lockClause=sql=>sql.slice(sql.lastIndexOf('FOR SHARE'));
function unchanged(f,before){
 assert.deepEqual(f.worker,before);assert.equal(f.controls.downloads,0);assert.equal(f.controls.sends,0);assert.equal(f.blob.puts(),0);assert.equal(f.outbounds.size,0);
}
function ordered(trace,{corporate=false}={}){
 const first=trace.findIndex(q=>principalSql(q.sql)),project=trace.findIndex(q=>q.sql.includes('FROM public."Project"')&&q.sql.includes('FOR UPDATE'));
 const worker=trace.findIndex(q=>q.sql.includes('FROM public."Worker" WHERE id=$1')&&q.sql.includes('FOR UPDATE'));
 const event=trace.findIndex(q=>q.sql.includes('FROM public."WebhookEvent"')&&q.sql.includes('FOR UPDATE'));
 const full=trace.findIndex(q=>principalSql(q.sql)&&lockClause(q.sql)==='FOR SHARE OF u,tm,o,p');
 assert.ok(first>=0&&project>first&&worker>project&&event>worker&&full>event);
 assert.equal(lockClause(trace[first].sql),'FOR SHARE OF u,tm,o');
 assert.equal(trace.slice(0,project).filter(q=>/FOR (?:SHARE|UPDATE) OF (?:c|p)(?:,|\s|$)/.test(q.sql)).length,0);
 assert.ok(trace.slice(full+1).some(q=>q.sql.endsWith('FOR SHARE OF c,p')));
 assert.ok(trace.slice(full+1).some(q=>q.sql.includes("action='company.own.number.recorded'")&&q.sql.endsWith('FOR SHARE')));
 if(corporate){const person=trace.findIndex(q=>q.sql.includes('pg_advisory_xact_lock')&&q.args[0]?.startsWith('person-worksite-journey-v1:'));assert.ok(person>first&&person<project);}
}
async function fallbackFixture(t){
 const own=await ownCompanyRuntimeFixture({time:Date.now()});t.mock.timers.enable({apis:['Date'],now:own.time});
 const f=kycMemoryFixture({active:true,ownRuntime:own});
 // A number owner is not necessarily the challenge issuer or the participant.
 f.issuer.actorId='different-manager';f.issuer.clerkUserId='user_DifferentManager';
 Object.assign(f.worker.metadata.participant.kycChatChallenge,{issuerActorId:f.issuer.actorId});
 const context=f.receive(f.code),before=structuredClone(f.worker),trace=[],controls={afterProject:null};
 const client={query:async(sql,args=[])=>{trace.push({sql,args});if(sql.includes('FROM public."Project"')&&sql.includes('FOR UPDATE')&&controls.afterProject){const hook=controls.afterProject;controls.afterProject=null;await hook();}return f.query(sql,args);}};
 return {own,f,context,before,trace,controls,client,resolve:()=>resolveMetaKycAuthority(client,context,{environment:f.environment})};
}

test('OWN principal prefix locks only the original owner principals and cannot mint transport authority',async()=>{
 const own=await ownCompanyRuntimeFixture(),before=structuredClone(own.connection);
 const prefix=await lockOwnCompanyIssuerPrincipal(own.client,own.connection,{environment:own.environment,now:own.time});
 assert.equal(prefix,undefined);assert.equal(ownCompanyCapabilityKind(prefix),null);assert.throws(()=>ownCompanyTransportPolicy(prefix,own.environment,own.time),{code:'META_OWN_COMPANY_UNAVAILABLE'});
 assert.equal(own.queries.length,1);assert.equal(lockClause(own.queries[0].sql),'FOR SHARE OF u,tm,o');assert.deepEqual(own.connection,before);
});
test('OWN principal prefix denies revoked owner before any Project, connection or receipt lock',async()=>{
 const own=await ownCompanyRuntimeFixture();own.controls.issuerActive=false;
 await assert.rejects(()=>lockOwnCompanyIssuerPrincipal(own.client,own.connection,{environment:own.environment,now:own.time}),{code:'META_OWN_COMPANY_UNAVAILABLE'});
 assert.equal(own.queries.length,1);assert.equal(lockClause(own.queries[0].sql),'FOR SHARE OF u,tm,o');
});
test('the full OWN resolver retains all three original lock statements and readonly mode',async()=>{
 const own=await ownCompanyRuntimeFixture(),capability=await own.capability();assert.equal(ownCompanyCapabilityKind(capability),'RUNTIME');
 assert.equal(own.queries.length,3);assert.equal(lockClause(own.queries[0].sql),'FOR SHARE OF u,tm,o,p');assert.equal(lockClause(own.queries[1].sql),'FOR SHARE OF c,p');assert.equal(lockClause(own.queries[2].sql),'FOR SHARE');
 const locked=own.queries.map(q=>structuredClone(q));own.queries.length=0;
 await lockOwnCompanyIssuer(own.client,own.connection,{environment:own.environment,now:own.time,lock:false});
 assert.deepEqual(own.queries.map(q=>q.sql),locked.map(q=>q.sql.replace(/FOR SHARE(?: OF [a-z,]+)?$/,'')));assert.deepEqual(own.queries.map(q=>q.args),locked.map(q=>q.args));
});
test('non OWN channels take no owner prefix query or capability',async()=>{
 let queries=0;assert.equal(await lockOwnCompanyIssuerPrincipal({query:()=>{queries++;throw Error('unexpected');}},{metadata:{}}),undefined);assert.equal(queries,0);
});
test('signed project KYC locks a distinct number owner before Project and revalidates full OWN after Worker and event',async t=>{
 const x=await fallbackFixture(t),r=await x.resolve();ordered(x.trace);
 assert.notEqual(r.member.actorId,x.own.policy.actorId);assert.notEqual(r.issuer.actorId,x.own.policy.actorId);assert.equal(ownCompanyCapabilityKind(r.ownCompanyCapability),'RUNTIME');unchanged(x.f,x.before);
});
test('KYC final runtime capability keeps the initial sixty second bound after a long canonical wait',async t=>{
 const x=await fallbackFixture(t),initial=x.own.time;x.controls.afterProject=()=>{t.mock.timers.tick(59000);x.f.now.setTime(initial+59000);};
 const r=await x.resolve();ownCompanyTransportPolicy(r.ownCompanyCapability,x.f.environment,initial+59999);
 assert.throws(()=>ownCompanyTransportPolicy(r.ownCompanyCapability,x.f.environment,initial+60000),{code:'META_OWN_COMPANY_UNAVAILABLE'});ordered(x.trace);unchanged(x.f,x.before);
});
test('KYC rejects an elapsed original OWN lease after canonical waits without renewing a live source lease',async t=>{
 const x=await fallbackFixture(t),initial=x.own.time,event=x.f.events.get(x.context.eventId);event.leaseExpiresAt=new Date(initial+180000);
 x.controls.afterProject=()=>{t.mock.timers.tick(60000);x.f.now.setTime(initial+60000);};
 await assert.rejects(x.resolve,{code:'META_OWN_COMPANY_UNAVAILABLE'});assert.equal(event.leaseExpiresAt.getTime(),initial+180000);assert.ok(event.leaseExpiresAt.getTime()>x.f.now.getTime());unchanged(x.f,x.before);
});
test('KYC final OWN read rejects owner revocation that occurs after the principal prefix',async t=>{
 const x=await fallbackFixture(t);x.controls.afterProject=()=>{x.own.controls.issuerActive=false;};await assert.rejects(x.resolve,{code:'META_OWN_COMPANY_UNAVAILABLE'});unchanged(x.f,x.before);
});
test('KYC final OWN read compares the original channel commitment instead of adopting replacement credentials',async t=>{
 const x=await fallbackFixture(t);x.controls.afterProject=()=>{x.own.controls.current=structuredClone(x.own.connection);x.own.controls.current.encryptedAccessToken+='replacement';};
 await assert.rejects(x.resolve,{code:'META_OWN_COMPANY_UNAVAILABLE'});unchanged(x.f,x.before);
});
for(const [name,code]of [['source','META_CUSTOMER_INBOX_LEASE_CHANGED'],['challenge','META_KYC_CHALLENGE_EXPIRED']])test('KYC rechecks short '+name+' deadline after an await in the complete OWN receipt read',async t=>{
 const x=await fallbackFixture(t),initial=x.own.time,event=x.f.events.get(x.context.eventId),challenge=x.f.worker.metadata.participant.kycChatChallenge;
 if(name==='source')event.leaseExpiresAt=new Date(initial+500);else challenge.expiresAt=new Date(initial+500).toISOString();
 const before=structuredClone(x.f.worker),lease=event.leaseExpiresAt.getTime(),read=x.client.query;let fired=false;
 x.client.query=async(sql,args=[])=>{const result=await read(sql,args);if(sql.includes("action='company.own.number.recorded'")){await Promise.resolve();t.mock.timers.tick(1000);x.f.now.setTime(initial+1000);fired=true;}return result;};
 await assert.rejects(x.resolve,{code});assert.equal(fired,true);assert.equal(event.leaseExpiresAt.getTime(),lease);assert.ok(initial+60000>Date.now());unchanged(x.f,before);
});

async function corporateFixture(t){
 const f=await companyKycMemoryFixture({active:true,captureImageSetVersion:2}),time=f.now.getTime();t.mock.timers.enable({apis:['Date'],now:time});
 const own=ownCompanyFixture({time,patch:{organizationId:f.target.organizationId,actorId:'different-number-owner',clerkUserId:'user_NumberOwner',clerkOrganizationId:'org_Synthetic',wabaId:f.connection.whatsappBusinessId,phoneNumberId:f.connection.phoneNumberId}});
 const context={member:{...own.context.member,actorId:own.policy.actorId,organizationId:own.policy.organizationId},session:{...own.context.session,userId:own.policy.clerkUserId,organizationId:own.policy.clerkOrganizationId},project:{...own.context.project,organizationId:own.policy.organizationId}};
 Object.assign(f.environment,own.environment);const provider=createMetaCustomerProvider({environment:own.environment,fetchImpl:own.fetchImpl,now:()=>time}),capability=createOwnCompanyCapability(context,own.environment,time),scoped=await provider.forOwnCapability({capability,token:own.environment.META_OWN_COMPANY_ACCESS_TOKEN}),verified=await scoped.inspect({token:own.environment.META_OWN_COMPANY_ACCESS_TOKEN,wabaId:own.policy.wabaId,phoneNumberId:own.policy.phoneNumberId});
 f.connection.encryptedAccessToken=encryptCustomerSecret(own.environment.META_OWN_COMPANY_ACCESS_TOKEN,{organizationId:f.target.organizationId,projectId:f.anchor.id,purpose:'access-token',resourceId:f.connection.phoneNumberId},f.environment);
 f.connection.displayPhoneNumber=own.policy.expectedPhoneE164;Object.assign(f.connection.metadata,{declaredCompanyPhone:own.declaration,ownCompany:scoped.ownProvenance(verified)});
 const operationId=randomUUID(),receiptId='company_own_'+digest([own.policy.organizationId,own.policy.actorId,own.policy.projectId,operationId]),runtimeGrant=createOwnCompanyRuntimeGrant({capability,connection:f.connection,receiptId,operationId,channelRevision:2,providerAuthority:scoped.ownOperationalAuthority(verified)},f.environment,time);
 f.connection.metadata.ownCompanyRuntime=structuredClone(runtimeGrant);
 const receipt={id:receiptId,metadata:{state:'RECORDED',action:'ACTIVATE_OWN_NUMBER',projectId:f.anchor.id,operationId,connectionId:f.connection.id,policyDigest:own.policy.policyDigest||digest(own.policy),runtimeGrant:structuredClone(runtimeGrant)}};
 const trace=[],controls={afterProject:null},rows=value=>({rows:structuredClone(value),rowCount:value.length});
 const client={query:async(sql,args=[])=>{
  trace.push({sql,args});if(principalSql(sql)){assert.deepEqual(args,[own.policy.actorId,own.policy.clerkUserId,own.policy.organizationId,own.policy.projectId,own.policy.clerkOrganizationId]);return rows([{actorId:own.policy.actorId,organizationId:own.policy.organizationId,role:'ADMIN',organizationMetadata:context.project.organizationMetadata}]);}
  if(sql.includes('FROM public."WhatsAppConnection" c JOIN public."Project" p')&&args.length===3)return rows([f.connection]);
  if(sql.includes('FROM public."Organization"'))return rows([{id:f.target.organizationId,metadata:context.project.organizationMetadata}]);
  if(sql.includes("action='company.own.number.recorded'"))return rows([receipt]);
  if(sql==='SELECT clock_timestamp() AS now,pg_current_xact_id()::text AS "kycTransactionId"')return rows([{now:new Date(f.now),kycTransactionId:'901'}]);
  if(sql.includes('FROM public."Project"')&&sql.includes('FOR UPDATE')&&controls.afterProject){const hook=controls.afterProject;controls.afterProject=null;await hook();}
  return f.query(sql,args);
 }};
 // Set up a fresh synthetic challenge through the actual manager preparation;
 // no prior proof is relabeled to the newly adopted OWN grant.
 delete f.worker.metadata.participant.kycChatChallenge;
 await prepareMetaKycChallenge.beforeProject(client,f.issuer,{projectId:f.target.id});
 const op=randomUUID(),prepared=await prepareMetaKycChallenge(client,f.issuer,f.target,{workerId:f.worker.id,revision:f.worker.revision,operationId:op},{environment:f.environment});
 f.audits.set(participantReceiptId(f.issuer.actorId,f.target.id,op),{id:participantReceiptId(f.issuer.actorId,f.target.id,op),organizationId:f.target.organizationId,actorId:f.issuer.actorId,action:'participant.operation.recorded',entityType:'Worker',entityId:f.worker.id,metadata:{version:1,projectId:f.target.id,kind:'PREPARE_KYC_CHAT',challengeReceiptId:prepared.receiptId,expiresAt:prepared.expiresAt}});
 const request=f.receive(prepared.code),before=structuredClone(f.worker);trace.length=0;
 return {f,own,trace,controls,client,request,before,resolve:()=>resolveMetaKycAuthority(client,request,{environment:f.environment})};
}
test('signed corporate OWN KYC takes owner principals then person and sorted Projects before full OWN authority',async t=>{
 const x=await corporateFixture(t),r=await x.resolve();ordered(x.trace,{corporate:true});
 assert.equal(r.companyKyc.anchorProjectId,x.f.anchor.id);assert.equal(r.companyKyc.targetProjectId,x.f.target.id);assert.notEqual(r.issuer.actorId,x.own.policy.actorId);assert.notEqual(r.member.actorId,x.own.policy.actorId);assert.equal(ownCompanyCapabilityKind(r.ownCompanyCapability),'RUNTIME');unchanged(x.f,x.before);
});
test('corporate OWN canonical wait cannot extend the capability or modify the existing challenge',async t=>{
 const x=await corporateFixture(t),initial=x.own.time;x.controls.afterProject=()=>{t.mock.timers.tick(58000);x.f.now.setTime(initial+58000);};
 const r=await x.resolve();ownCompanyTransportPolicy(r.ownCompanyCapability,x.f.environment,initial+59999);assert.throws(()=>ownCompanyTransportPolicy(r.ownCompanyCapability,x.f.environment,initial+60000),{code:'META_OWN_COMPANY_UNAVAILABLE'});unchanged(x.f,x.before);
});
