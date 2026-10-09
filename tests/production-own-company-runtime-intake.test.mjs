import test from 'node:test';
import assert from 'node:assert/strict';
import {createMetaCustomerProvider} from '../src/lib/meta-customer-provider.mjs';
import {createOwnCompanyCapability,createOwnCompanyRuntimeGrant,lockOwnCompanyIssuer,restrictOwnCompanyRuntimeCapability,ownCompanyTransportPolicy} from '../src/lib/meta-own-company-policy.mjs';
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
 const context={member:f.member,session:f.session,project:{...f.project,organizationMetadata:p.context.project.organizationMetadata}},token=p.environment.META_OWN_COMPANY_ACCESS_TOKEN,provider=createMetaCustomerProvider({environment:f.environment,fetchImpl:async(url,options)=>{const response=await p.fetchImpl(url,options);await f.controls.afterGraph?.(options.method||'GET',new URL(url).pathname.slice('/v25.0/'.length));return response;},now:()=>f.now.getTime()}),cap=createOwnCompanyCapability(context,f.environment,f.now.getTime()),scoped=await provider.forOwnCapability({capability:cap,token}),verified=await scoped.inspect({token,wabaId:p.policy.wabaId,phoneNumberId:p.policy.phoneNumberId});
 f.connection.displayPhoneNumber=p.policy.expectedPhoneE164;f.connection.encryptedAccessToken=encryptCustomerSecret(token,{organizationId:f.project.organizationId,projectId:f.project.id,purpose:'access-token',resourceId:f.connection.phoneNumberId},f.environment);
 Object.assign(f.connection.metadata,{declaredCompanyPhone:p.declaration,ownCompany:scoped.ownProvenance(verified),customerVerification:verified});
 const operationId='33333333-3333-4333-8333-333333333333',receiptId='company_own_'+digest([f.project.organizationId,f.member.actorId,f.project.id,operationId]),runtimeGrant=createOwnCompanyRuntimeGrant({capability:cap,connection:f.connection,receiptId,operationId,channelRevision:1,providerAuthority:scoped.ownOperationalAuthority(verified)},f.environment,f.now.getTime());
 f.connection.metadata.ownCompanyRuntime=runtimeGrant;
 const receipt={id:receiptId,metadata:{state:'RECORDED',action:'ACTIVATE_OWN_NUMBER',projectId:f.project.id,operationId,connectionId:f.connection.id,policyDigest:runtimeGrant.origin.policyDigest,runtimeGrant}};
 const own={issuerActive:true,organizationMetadata:p.context.project.organizationMetadata,receiptPresent:true},empty={rows:[],rowCount:0},queries=[];
 // This adapter deliberately models SQL values only, not PostgreSQL locking or
 // rollback. Those guarantees are exercised by the separate disposable PG lane.
 const query=async(sql,args=[])=>{
  queries.push(sql);if(f.controls.queryLatencyMs)f.now.setTime(f.now.getTime()+f.controls.queryLatencyMs);
  if(sql.includes('AS "runtimeNow"')){await f.controls.beforeRuntimeFence?.();return {rows:own.issuerActive&&own.receiptPresent?[{...structuredClone(f.connection),runtimeActorId:f.member.actorId,runtimeRole:f.member.role,runtimeOrganizationMetadata:structuredClone(own.organizationMetadata),runtimeAudit:structuredClone(receipt.metadata),runtimeNow:new Date(f.now)}]:[]};}
  if(['BEGIN','COMMIT','ROLLBACK'].includes(sql))return empty;
  if(sql.includes('FROM public."WhatsAppConnection" c JOIN public."Project" p')&&sql.includes('p."organizationId"=$3'))return {rows:[structuredClone(f.connection)]};
  if(sql.includes('FROM public."PlatformUser" u JOIN public."TenantMembership"')&&sql.includes('tm."clerkRole"=\'org:admin\''))return {rows:own.issuerActive?[{...f.member,organizationMetadata:structuredClone(own.organizationMetadata)}]:[]};
  if(sql.includes('FROM public."AuditLog"')&&args[0]===receiptId)return {rows:own.receiptPresent?[structuredClone(receipt)]:[]};
  return f.query(sql,args);
 };
 const connect=async()=>({query,release(){}}),workspace={projectOperation:async(session,input,_writable,run)=>{assert.equal(session.userId,f.session.userId);assert.equal(input.scope,f.scope);assert.equal(input.projectId,f.target.id);return customerJobTransaction(connect,client=>run(client,f.member,f.scope,f.target));}},store=createParticipantStore({workspace,connect,environment:f.environment}),bridge=createEmployeeIntakeBridge({connect,environment:f.environment}),outbound=createMetaKycOutbound({connect,provider,environment:f.environment,afterReserve:async()=>f.controls.afterReserve?.()});
 const execute=async message=>{const context=f.receive(message),result=await bridge.execute(context);if(result?.reply)await outbound.send(context,result.reply,{purpose:'EMPLOYEE_INTAKE'});return {context,result};};
 f.now.setTime(f.now.getTime()+5*3600000);f.environment.VERCEL_GIT_COMMIT_SHA='c'.repeat(40);
 const configure=()=>store.save(f.session,f.command('CONFIGURE_EMPLOYEE_INTAKE',{expectedRevision:0,enabled:true,confirmed:true}));
 return Object.assign(f,{own,p,provider,connect,execute,configure,receipt,queries,bridge,outbound});
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
test('four complete pipeline resolutions suffice for sixteen fresh external fences and a final completion fence',async()=>{
 const f=await fixture();await f.configure();f.queries.length=0;f.p.calls.length=0;const started=f.now.getTime();f.controls.queryLatencyMs=100;const sent=await f.execute('HOLA');
 const complete=f.queries.filter(sql=>sql==='SELECT * FROM public."WebhookEvent" WHERE id=$1').length,compact=f.queries.filter(sql=>sql.includes('AS "intakeNow"')).length,runtime=f.queries.filter(sql=>sql.includes('AS "runtimeNow"')).length;
 assert.equal(complete,4,'dispatch, reserve, send transaction and completion each resolve once');assert.equal(compact,17);assert.equal(runtime,16);assert.ok(f.now.getTime()-started<60000,`pipeline ${f.queries.length} SQL statements exceeds original 60s budget at 100ms per statement`);assert.equal(f.outbounds.get(customerOutboundId(sent.context.eventId)).outcome.state,'SENT');assert.equal(f.p.calls.filter(call=>call.method==='POST').length,1);
});
test('expiry after the committed reservation denies the first POST and retains the original digest and UUID',async()=>{
 const f=await fixture();await f.configure();f.controls.afterReserve=()=>f.now.setTime(f.now.getTime()+60001);const context=f.receive('HOLA'),result=await f.bridge.execute(context);await assert.rejects(f.outbound.send(context,result.reply,{purpose:'EMPLOYEE_INTAKE'}),{code:'META_CUSTOMER_INBOX_LEASE_CHANGED'});
 const original=structuredClone(f.outbounds.get(customerOutboundId(context.eventId)));assert.equal(original.outcome.state,'SEND_STARTED');assert.equal(f.p.calls.filter(call=>call.method==='POST').length,0);await assert.rejects(f.outbound.send(context,result.reply,{purpose:'EMPLOYEE_INTAKE'}));assert.deepEqual(f.outbounds.get(original.id),original);assert.equal(f.p.calls.filter(call=>call.method==='POST').length,0);
});
for(const [name,change] of [
 ['assignment',f=>f.controls.assignment=false],['owner revision',f=>f.controls.ownerRevision++],['intake policy',f=>f.connection.metadata.employeeIntakePolicy.enabled=false],['intake issuer',f=>f.controls.issuerActive=false],['intake receipt',f=>f.audits.get(f.connection.metadata.employeeIntakePolicy.receiptId).metadata.intakePolicyDigest='0'.repeat(64)],['transaction identity',f=>f.controls.intakeTransactionId='2'],
])test('compact fence denies late '+name+' with an intact reservation and zero POST',async()=>{
 const f=await fixture();await f.configure();f.p.state.afterRead=path=>{if(path===f.p.policy.businessId+'/owned_apps')change(f);};await assert.rejects(f.execute('HOLA'));assert.equal(f.outbounds.size,1);assert.equal([...f.outbounds.values()][0].outcome.state,'SEND_STARTED');assert.equal(f.p.calls.filter(call=>call.method==='POST').length,0);
});
test('a lost provider acknowledgement is never recorded as SENT and the same original reservation cannot send again',async()=>{
 const f=await fixture();await f.configure();f.p.state.failPost=f.p.policy.phoneNumberId+'/messages';const context=f.receive('HOLA'),result=await f.bridge.execute(context),uncertain=await f.outbound.send(context,result.reply,{purpose:'EMPLOYEE_INTAKE'});assert.equal(uncertain.state,'SEND_UNKNOWN');assert.equal(uncertain.replySent,false);assert.equal(uncertain.messageId,null);const saved=structuredClone(f.outbounds.get(customerOutboundId(context.eventId))),posts=f.p.calls.filter(call=>call.method==='POST').length;assert.equal(posts,1);const replay=await f.outbound.send(context,result.reply,{purpose:'EMPLOYEE_INTAKE'});assert.equal(replay.state,'SEND_UNKNOWN');assert.equal(replay.replySent,false);assert.deepEqual(f.outbounds.get(saved.id),saved);assert.equal(f.p.calls.filter(call=>call.method==='POST').length,posts);
});
test('an acknowledgement followed by lease expiry cannot record SENT or permit the original reservation to send twice',async()=>{
 const f=await fixture();await f.configure();f.controls.afterGraph=(method,path)=>{if(method==='POST'&&path.endsWith('/messages'))f.now.setTime(f.now.getTime()+60001);};const context=f.receive('HOLA'),result=await f.bridge.execute(context);await assert.rejects(f.outbound.send(context,result.reply,{purpose:'EMPLOYEE_INTAKE'}),{code:'META_CUSTOMER_INBOX_LEASE_CHANGED'});const saved=structuredClone(f.outbounds.get(customerOutboundId(context.eventId)));assert.equal(saved.outcome.state,'SEND_STARTED');assert.equal(saved.outcome.messageId,undefined);assert.equal(f.p.calls.filter(call=>call.method==='POST').length,1);await assert.rejects(f.outbound.send(context,result.reply,{purpose:'EMPLOYEE_INTAKE'}));assert.deepEqual(f.outbounds.get(saved.id),saved);assert.equal(f.p.calls.filter(call=>call.method==='POST').length,1);
});
test('send transaction cannot replace the reserved grant or credential',async()=>{
 const f=await fixture();await f.configure();f.controls.afterReserve=()=>{f.connection.encryptedAccessToken=encryptCustomerSecret('synthetic-changed-token',{organizationId:f.project.organizationId,projectId:f.project.id,purpose:'access-token',resourceId:f.connection.phoneNumberId},f.environment);};await assert.rejects(f.execute('HOLA'),{code:'META_OWN_COMPANY_UNAVAILABLE'});assert.equal(f.outbounds.size,1);assert.equal([...f.outbounds.values()][0].outcome.state,'SEND_STARTED');assert.equal(f.p.calls.filter(call=>call.method==='POST').length,0);
});
test('expiry between the intake SQL and runtime SQL before POST is denied by the sealed source deadline',async()=>{
 const f=await fixture();await f.configure();f.controls.queryLatencyMs=100;let boundaries=0;f.controls.beforeRuntimeFence=()=>{if(++boundaries===15)f.now.setTime(Date.parse([...f.events.values()].find(event=>event.leaseToken)?.leaseExpiresAt)+1);};const context=f.receive('HOLA'),result=await f.bridge.execute(context);await assert.rejects(f.outbound.send(context,result.reply,{purpose:'EMPLOYEE_INTAKE'}),{code:'META_CUSTOMER_INBOX_LEASE_CHANGED'});const original=structuredClone(f.outbounds.get(customerOutboundId(context.eventId)));assert.equal(boundaries,15);assert.equal(original.outcome.state,'SEND_STARTED');assert.equal(f.p.calls.filter(call=>call.method==='POST').length,0);await assert.rejects(f.outbound.send(context,result.reply,{purpose:'EMPLOYEE_INTAKE'}));assert.deepEqual(f.outbounds.get(original.id),original);assert.equal(f.p.calls.filter(call=>call.method==='POST').length,0);
});
test('a restrictive runtime capability cannot extend the original lease or mint ADMIN or caller authority',async()=>{
 const f=await fixture(),now=f.now.getTime(),capability=await customerJobTransaction(f.connect,client=>lockOwnCompanyIssuer(client,f.connection,{environment:f.environment,now})),bounded=restrictOwnCompanyRuntimeCapability(capability,now+120000,now);assert.equal(ownCompanyTransportPolicy(bounded,f.environment,now+59999).grantDigest,f.connection.metadata.ownCompanyRuntime.grantDigest);assert.throws(()=>ownCompanyTransportPolicy(bounded,f.environment,now+60000),{code:'META_OWN_COMPANY_UNAVAILABLE'});for(const invalid of [{},null,JSON.parse(JSON.stringify(capability))])assert.throws(()=>restrictOwnCompanyRuntimeCapability(invalid,now+1000,now),{code:'META_OWN_COMPANY_UNAVAILABLE'});for(const invalid of [NaN,Infinity,now,now-1,String(now+1000)])assert.throws(()=>restrictOwnCompanyRuntimeCapability(capability,invalid,now),{code:'META_OWN_COMPANY_UNAVAILABLE'});
});
