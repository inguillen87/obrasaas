import test from 'node:test';
import assert from 'node:assert/strict';
import {createMetaCustomerProvider} from '../src/lib/meta-customer-provider.mjs';
import {createOwnCompanyCapability,createOwnCompanyRuntimeGrant} from '../src/lib/meta-own-company-policy.mjs';
import {createEmployeeIntakeBridge,readEmployeeIntake} from '../src/lib/meta-employee-intake.mjs';
import {createMetaKycOutbound} from '../src/lib/meta-kyc-outbound.mjs';
import {createParticipantStore} from '../src/lib/participant-store.mjs';
import {customerJobTransaction,customerOutboundId} from '../src/lib/meta-customer-outbound.mjs';
import {encryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {digest} from '../src/lib/workspace-policy.mjs';
import {employeeIntakeFixture} from './fixtures/employee-intake-memory.mjs';
import {ownCompanyFixture} from './fixtures/own-company-meta.mjs';

async function fixture(){
 const f=employeeIntakeFixture(),p=ownCompanyFixture({time:f.now.getTime(),patch:{organizationId:f.project.organizationId,actorId:f.member.actorId,clerkUserId:f.session.userId,clerkOrganizationId:f.session.organizationId,projectId:f.project.id,wabaId:f.connection.whatsappBusinessId,phoneNumberId:f.connection.phoneNumberId}});
 Object.assign(f.environment,p.environment);p.debug.expires_at=Math.floor((f.now.getTime()+24*3600000)/1000);
 const context={member:f.member,session:f.session,project:{...f.project,organizationMetadata:p.context.project.organizationMetadata}},token=p.environment.META_OWN_COMPANY_ACCESS_TOKEN,provider=createMetaCustomerProvider({environment:f.environment,fetchImpl:p.fetchImpl,now:()=>f.now.getTime()}),cap=createOwnCompanyCapability(context,f.environment,f.now.getTime()),scoped=await provider.forOwnCapability({capability:cap,token}),verified=await scoped.inspect({token,wabaId:p.policy.wabaId,phoneNumberId:p.policy.phoneNumberId});
 f.connection.displayPhoneNumber=p.policy.expectedPhoneE164;f.connection.encryptedAccessToken=encryptCustomerSecret(token,{organizationId:f.project.organizationId,projectId:f.project.id,purpose:'access-token',resourceId:f.connection.phoneNumberId},f.environment);
 Object.assign(f.connection.metadata,{declaredCompanyPhone:p.declaration,ownCompany:scoped.ownProvenance(verified),customerVerification:verified});
 const operationId='33333333-3333-4333-8333-333333333333',receiptId='company_own_'+digest([f.project.organizationId,f.member.actorId,f.project.id,operationId]),runtimeGrant=createOwnCompanyRuntimeGrant({capability:cap,connection:f.connection,receiptId,operationId,channelRevision:1,providerAuthority:scoped.ownOperationalAuthority(verified)},f.environment,f.now.getTime());
 f.connection.metadata.ownCompanyRuntime=runtimeGrant;
 const receipt={id:receiptId,metadata:{state:'RECORDED',action:'ACTIVATE_OWN_NUMBER',projectId:f.project.id,operationId,connectionId:f.connection.id,policyDigest:runtimeGrant.origin.policyDigest,runtimeGrant}};
 const own={issuerActive:true,organizationMetadata:p.context.project.organizationMetadata,receiptPresent:true},empty={rows:[],rowCount:0};
 // This adapter deliberately models SQL values only, not PostgreSQL locking or
 // rollback. Those guarantees are exercised by the separate disposable PG lane.
 const query=async(sql,args=[])=>{
  if(['BEGIN','COMMIT','ROLLBACK'].includes(sql))return empty;
  if(sql.includes('FROM public."WhatsAppConnection" c JOIN public."Project" p')&&sql.includes('p."organizationId"=$3'))return {rows:[structuredClone(f.connection)]};
  if(sql.includes('FROM public."PlatformUser" u JOIN public."TenantMembership"')&&sql.includes('tm."clerkRole"=\'org:admin\''))return {rows:own.issuerActive?[{...f.member,organizationMetadata:structuredClone(own.organizationMetadata)}]:[]};
  if(sql.includes('FROM public."AuditLog"')&&args[0]===receiptId)return {rows:own.receiptPresent?[structuredClone(receipt)]:[]};
  return f.query(sql,args);
 };
 const connect=async()=>({query,release(){}}),workspace={projectOperation:async(session,input,_writable,run)=>{assert.equal(session.userId,f.session.userId);assert.equal(input.scope,f.scope);assert.equal(input.projectId,f.target.id);return customerJobTransaction(connect,client=>run(client,f.member,f.scope,f.target));}},store=createParticipantStore({workspace,connect,environment:f.environment}),bridge=createEmployeeIntakeBridge({connect,environment:f.environment}),outbound=createMetaKycOutbound({connect,provider,environment:f.environment});
 const execute=async message=>{const context=f.receive(message),result=await bridge.execute(context);if(result?.reply)await outbound.send(context,result.reply,{purpose:'EMPLOYEE_INTAKE'});return {context,result};};
 f.now.setTime(f.now.getTime()+5*3600000);f.environment.VERCEL_GIT_COMMIT_SHA='c'.repeat(40);
 const configure=()=>store.save(f.session,f.command('CONFIGURE_EMPLOYEE_INTAKE',{expectedRevision:0,enabled:true,confirmed:true}));
 return Object.assign(f,{own,p,provider,connect,execute,configure,receipt});
}
test('real intake planner and vaulted outbox continue after five hours/future SHA without creating a person, KYC or field permission',async()=>{
 const f=await fixture();await f.configure();const first=await f.execute('HOLA');assert.equal(f.state().step,'NAME');assert.equal(f.outbounds.get(customerOutboundId(first.context.eventId)).outcome.state,'SENT');
 await f.execute('Persona sintética');assert.equal(f.state().step,'JOB');assert.equal(f.workers.size,0);assert.equal(f.state().consent,false);assert.equal(f.state().admission,undefined);assert.equal(f.controls.providerCalls,0);assert.equal(f.p.calls.filter(c=>c.method==='POST'&&c.path.endsWith('/messages')).length,2);assert.equal(f.p.calls.filter(c=>c.method==='POST'&&!c.path.endsWith('/messages')).length,0);
});
for(const [name,change] of [
 ['revoked runtime',f=>f.connection.metadata.ownCompanyRuntime={...f.connection.metadata.ownCompanyRuntime,state:'REVOKED'}],['expired credential',f=>f.now.setTime(Date.parse(f.connection.metadata.ownCompanyRuntime.validUntil))],['canonical issuer revocation',f=>f.own.issuerActive=false],['canonical declared number revision',f=>f.own.organizationMetadata={companyPhoneDeclaration:{...f.p.declaration,revision:2}}],['missing original activation receipt',f=>f.own.receiptPresent=false],
])test('intake requires durable OWN authority after '+name+' with zero replies or people',async()=>{
 const f=await fixture();await f.configure();change(f);const posts=f.p.calls.filter(c=>c.method==='POST').length;await assert.rejects(f.execute('HOLA'));assert.equal(f.workers.size,0);assert.equal(f.outbounds.size,0);assert.equal(f.p.calls.filter(c=>c.method==='POST').length,posts);
});
test('revocation during provider ownership await preserves the original outbound marker and adds no reply or person',async()=>{
 const f=await fixture();await f.configure();f.p.state.afterRead=path=>{if(path===f.p.policy.businessId+'/owned_apps')f.own.organizationMetadata={companyPhoneDeclaration:{...f.p.declaration,revision:2}};};
 await assert.rejects(f.execute('HOLA'),{code:'META_OWN_COMPANY_UNAVAILABLE'});assert.equal(f.workers.size,0);assert.equal(f.outbounds.size,1);assert.equal([...f.outbounds.values()][0].outcome.state,'SEND_STARTED');assert.equal(f.p.calls.filter(c=>c.method==='POST').length,0);
});
test('an OFF intake snapshot cannot claim availability from a serialized grant with missing canonical origin',async()=>{
 const f=await fixture();f.own.receiptPresent=false;const value=await customerJobTransaction(f.connect,client=>readEmployeeIntake(client,f.member,f.target.id,f.environment));assert.equal(value.available,false);assert.equal(value.enabled,false);assert.deepEqual(value.records,[]);assert.equal(f.workers.size,0);assert.equal(f.p.calls.filter(c=>c.method==='POST').length,0);
});
test('inbox lease expiry during OWN ownership awaits retains the original marker and sends no reply',async()=>{
 const f=await fixture();await f.configure();f.p.state.afterRead=path=>{if(path===f.p.policy.businessId+'/owned_apps')for(const event of f.events.values())event.leaseExpiresAt=new Date(f.now.getTime()-1);};
 await assert.rejects(f.execute('HOLA'),{code:'META_CUSTOMER_INBOX_LEASE_CHANGED'});assert.equal(f.outbounds.size,1);assert.equal([...f.outbounds.values()][0].outcome.state,'SEND_STARTED');assert.equal(f.workers.size,0);assert.equal(f.p.calls.filter(c=>c.method==='POST').length,0);
});
