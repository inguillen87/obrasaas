import test from 'node:test';
import assert from 'node:assert/strict';
import {digest,WorkspaceError} from '../src/lib/workspace-policy.mjs';
import {encryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {metaCustomerContentDigest} from '../src/lib/meta-customer-callback.mjs';
import {OBRASAAS_META_CHANNEL} from '../src/lib/meta-channel-binding.mjs';
import {COMPANY_CHANNEL_SCHEMA_CONTRACT} from '../src/lib/company-channel-schema.mjs';
import {resolveMetaKycAuthority,resolveMetaKycExpiryFeedbackAuthority,resolveMetaKycContextFeedbackAuthority} from '../src/lib/meta-kyc-identity.mjs';
import {resolveEmployeeIntakeAuthority} from '../src/lib/meta-employee-intake.mjs';
import {ownCompanyRuntimeFixture} from './fixtures/own-company-runtime.mjs';
import {contextFeedbackFixture,unchangedMedia} from './fixtures/meta-kyc-context-feedback-memory.mjs';
import {employeeIntakeFixture} from './fixtures/employee-intake-memory.mjs';

// Real signed decoders and canonical OWN policy with bounded SQL memory doubles.
// These routing observations mint no participant/transport authority. No PG,
// real Graph request, document download or business write occurs in this suite.
async function discoveryFixture(message,{quoted=false,company=true}={}){
 const own=await ownCompanyRuntimeFixture({time:Date.now()}),connection=structuredClone(own.connection),environment=own.environment,queries=[],state={refsActive:true};
 if(company)connection.metadata.companyRoutingVersion=1;
 const value={id:'wamid.SyntheticDiscovery12345678',from:'5491100001111',timestamp:String(Math.floor(own.time/1000)),...(typeof message==='string'?{type:'text',text:{body:message}}:message),...(quoted?{context:{id:'wamid.SyntheticPriorPrompt123456'}}:{})};
 const payload={wabaId:connection.whatsappBusinessId,phoneNumberId:connection.phoneNumberId,field:'messages',type:'message',value},payloadDigest=metaCustomerContentDigest(payload),externalId=digest([payload.wabaId,payload.phoneNumberId,'message',value.id]),id='customer_webhook_'+externalId,aad={organizationId:connection.organizationId,projectId:connection.projectId,resourceId:id},companyRouting={mode:'COMPANY',revision:2,contract:COMPANY_CHANNEL_SCHEMA_CONTRACT};
 const event={id,projectId:connection.projectId,provider:'meta-customer-v1',eventType:'message',externalId,status:'PENDING',leaseToken:'11111111-1111-4111-8111-111111111111',leaseExpiresAt:new Date(own.time+60000),createdAt:new Date(own.time),payload:{version:1,organizationId:connection.organizationId,channelId:connection.id,payloadDigest,signatureVerified:true,signatureScheme:'meta-hmac-sha256-v1',...(company?{companyRouting}:{}),encryptedPayload:encryptCustomerSecret(JSON.stringify(payload),{...aad,purpose:'webhook'},environment),encryptedProof:encryptCustomerSecret(JSON.stringify({scheme:'meta-hmac-sha256-v1',purpose:'CUSTOMER',appId:OBRASAAS_META_CHANNEL.appId,organizationId:connection.organizationId,channelId:connection.id,payloadDigest,...(company?{companyRouting}:{})}),{...aad,purpose:'webhook-proof'},environment)}};
 const request={eventId:id,projectId:event.projectId,channelId:connection.id,payloadDigest,leaseToken:event.leaseToken},rows=values=>({rows:structuredClone(values),rowCount:values.length});
 const client={async query(sql,args=[]){
  queries.push({sql,args:structuredClone(args)});assert.match(sql,/^SELECT\s/,'Discovery remains read only');
  if(sql.includes('FROM public."WebhookEvent" WHERE id=$1')){assert.equal(args[0],event.id);return rows([event]);}
  if(sql.includes('FROM public."WhatsAppConnection" c JOIN public."Project" p')&&args.length===2){assert.deepEqual(args,[connection.id,connection.projectId]);return rows([connection]);}
  if(sql.startsWith('SELECT tm.id AS "membershipId",u.id AS "actorId",u."clerkUserId"')){assert.deepEqual(args,[own.policy.actorId,own.policy.clerkUserId,connection.organizationId]);return rows(state.refsActive?[{membershipId:'membership-own',actorId:own.policy.actorId,clerkUserId:own.policy.clerkUserId}]:[]);}
  if(sql.includes("payload->'employeeIntake'->>'senderKey'")){assert.equal(args[0],connection.projectId);assert.equal(args[1],connection.id);return rows([]);}
  if(sql.includes("provider='meta-customer-outbound-v1'"))return rows([]);
  if(sql.includes('FROM public."Worker"'))return rows([]);
  return own.client.query(sql,args);
 }};
 const ownQueries=()=>queries.filter(q=>q.sql.includes("action='company.own.number.recorded'")||q.sql.includes('FROM public."PlatformUser" u JOIN public."TenantMembership"')&&q.args.length===5||q.sql.includes('FROM public."WhatsAppConnection" c JOIN public."Project" p')&&q.args.length===3);
 const refs=()=>queries.filter(q=>q.sql.startsWith('SELECT tm.id AS "membershipId",u.id AS "actorId",u."clerkUserId"'));
 return {own,connection,environment,event,request,queries,state,client,ownQueries,refs};
}

for(const [name,resolve]of [['expiry',resolveMetaKycExpiryFeedbackAuthority],['context',resolveMetaKycContextFeedbackAuthority]])for(const message of ['CONSUMO','ESTADO','IDENTIDAD '+'a'.repeat(43),'VINCULAR '+'b'.repeat(43)])test(name+' unquoted signed '+message.split(' ')[0]+' is discarded before OWN SQL',async()=>{
 const f=await discoveryFixture(message),before=structuredClone(f.event);assert.equal(await resolve(f.client,f.request,{environment:f.environment}),null);assert.equal(f.queries.length,2);assert.equal(f.ownQueries().length,0);assert.deepEqual(f.event,before);
});
for(const message of ['CONSUMO',{type:'audio',audio:{id:'150000011'}},{type:'image',image:{id:'150000011',mime_type:'application/pdf'}}])test('quoted unsupported context message '+(typeof message==='string'?message:message.type)+' does not acquire OWN authority',async()=>{
 const f=await discoveryFixture(message,{quoted:true});assert.equal(await resolveMetaKycContextFeedbackAuthority(f.client,f.request,{environment:f.environment}),null);assert.equal(f.queries.length,2);assert.equal(f.ownQueries().length,0);
});
for(const message of ['ESTADO','ESTADO IDENTIDAD',{type:'image',image:{id:'150000011',mime_type:'image/png'}},{type:'interactive',interactive:{type:'list_reply',list_reply:{id:'kyc:'+'a'.repeat(20)+':0'}}}])test('quoted context candidate '+(typeof message==='string'?message:message.type)+' cannot fast-null past a revoked canonical OWN issuer',async()=>{
 const f=await discoveryFixture(message,{quoted:true});f.own.controls.issuerActive=false;let fieldCalls=0;
 const dispatch=async()=>{const result=await resolveMetaKycContextFeedbackAuthority(f.client,f.request,{environment:f.environment});if(result)return result;fieldCalls++;return 'FIELD';};
 await assert.rejects(dispatch(),{code:'META_OWN_COMPANY_UNAVAILABLE'});assert.equal(f.ownQueries().length,1);assert.equal(fieldCalls,0);assert.equal(f.queries.some(q=>q.sql.includes('FROM public."Worker"')),false);
});
test('invalid signed context is denied before OWN lookup and cannot become FIELD',async()=>{
 const f=await discoveryFixture('CONSUMO',{quoted:true});f.event.payload.encryptedProof='invalid';let fieldCalls=0;await assert.rejects(async()=>{const result=await resolveMetaKycContextFeedbackAuthority(f.client,f.request,{environment:f.environment});if(!result)fieldCalls++;},{code:'META_CUSTOMER_EVENT_PROOF_REQUIRED'});assert.equal(fieldCalls,0);assert.equal(f.ownQueries().length,0);
});
for(const message of ['CONSUMO','IDENTIDAD '+'a'.repeat(43),'VINCULAR '+'b'.repeat(43),{type:'image',image:{id:'150000011',mime_type:'image/png'}},{type:'interactive',interactive:{list_reply:{id:'kyc-start:'+'a'.repeat(20)+':0'}}}])test('intake signed exclusion '+(typeof message==='string'?message.split(' ')[0]:message.type)+' performs no OWN principal discovery',async()=>{
 const f=await discoveryFixture(message);assert.equal(await resolveEmployeeIntakeAuthority(f.client,f.request,{environment:f.environment}),null);assert.equal(f.refs().length,0);assert.equal(f.ownQueries().length,0);assert.ok(f.queries.some(q=>q.sql.includes("payload->'employeeIntake'->>'senderKey'")),'Existing anchor lookup stays before the exclusions');
});
test('quoted unrelated CONSUMO with no intake anchor is discarded before OWN refs',async()=>{
 const f=await discoveryFixture('CONSUMO',{quoted:true});assert.equal(await resolveEmployeeIntakeAuthority(f.client,f.request,{environment:f.environment}),null);assert.equal(f.refs().length,0);assert.ok(f.queries.some(q=>q.sql.includes("provider='meta-customer-outbound-v1'")),'Existing quoted KYC-intent lookup keeps priority');
});
test('a real intake HOLA candidate still requires its canonical current OWN discovery issuer',async()=>{
 const f=await discoveryFixture('HOLA');f.state.refsActive=false;let fieldCalls=0;await assert.rejects(async()=>{const result=await resolveEmployeeIntakeAuthority(f.client,f.request,{environment:f.environment});if(!result)fieldCalls++;},{code:'EMPLOYEE_INTAKE_REVOKED'});assert.equal(f.refs().length,1);assert.equal(fieldCalls,0);
});
test('KYC start excluded by intake still reaches full capture OWN authorization before FIELD',async()=>{
 const f=await discoveryFixture({type:'interactive',interactive:{list_reply:{id:'kyc-start:'+'a'.repeat(20)+':0'}}});f.own.controls.issuerActive=false;let fieldCalls=0;
 await assert.rejects(async()=>{const intake=await resolveEmployeeIntakeAuthority(f.client,f.request,{environment:f.environment});if(intake)return intake;const capture=await resolveMetaKycAuthority(f.client,f.request,{environment:f.environment});if(capture)return capture;fieldCalls++;},{code:'META_OWN_COMPANY_UNAVAILABLE'});assert.equal(f.refs().length,0);assert.equal(fieldCalls,0);assert.equal(f.ownQueries().length,1);
});
test('existing intake anchor and recorded dispatch retain precedence and exact replay instead of FIELD',async()=>{
 const f=employeeIntakeFixture();await f.configure();await f.execute('HOLA');const request=f.receive('Persona sintética'),beforeWorkers=f.workers.size,result=await f.bridge.execute(request);assert.equal(result.kind,'EMPLOYEE_INTAKE');assert.equal(f.state().step,'JOB');const events=structuredClone([...f.events]),audits=structuredClone([...f.audits]);assert.deepEqual(await f.bridge.execute(request),result);assert.deepEqual([...f.events],events);assert.deepEqual([...f.audits],audits);assert.equal(f.workers.size,beforeWorkers);assert.equal(f.controls.providerCalls,0);
});
test('a real quoted OWN KYC candidate retains all three canonical OWN reads on each transaction',async()=>{
 const t=await contextFeedbackFixture('PROJECT',{own:true}),worker=structuredClone(t.f.worker),start=t.runtime.queries.length;
 for(let i=0;i<2;i++){const client=await t.connect();await client.query('BEGIN');try{const r=await resolveMetaKycContextFeedbackAuthority(client,t.context,{environment:t.f.environment});assert.equal(r.kind,'KYC_CONTEXT_FEEDBACK_REPLY');assert.ok(r.ownCompanyCapability);}finally{await client.query('ROLLBACK');client.release();}}
 assert.equal(t.runtime.queries.length-start,6);assert.deepEqual(t.f.worker,worker);assert.equal(t.requests.length,0);unchangedMedia(t.f);
});
test('a changed signed source after OWN discovery cannot return private KYC context or fall through to FIELD',async()=>{
 const t=await contextFeedbackFixture('PROJECT',{own:true}),worker=structuredClone(t.f.worker),client=await t.connect();let changed=false,fieldCalls=0;
 const wrapper={query:async(sql,args)=>{if(!changed&&sql.includes('FROM public."PlatformUser" u JOIN public."TenantMembership"')&&args.length===5){changed=true;t.f.events.get(t.context.eventId).payload.payloadDigest='f'.repeat(64);}return client.query(sql,args);}};
 await client.query('BEGIN');try{await assert.rejects(async()=>{const result=await resolveMetaKycContextFeedbackAuthority(wrapper,t.context,{environment:t.f.environment});if(!result)fieldCalls++;},error=>error instanceof WorkspaceError&&error.code==='META_CUSTOMER_INBOX_LEASE_CHANGED');assert.equal(changed,true);assert.equal(fieldCalls,0);}finally{await client.query('ROLLBACK');client.release();}assert.deepEqual(t.f.worker,worker);assert.equal(t.requests.length,0);unchangedMedia(t.f);
});
