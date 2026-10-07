import test from 'node:test';
import assert from 'node:assert/strict';
import {companyKycMemoryFixture} from './fixtures/company-kyc-memory.mjs';
import {createMetaKycBridge} from '../src/lib/meta-kyc-bridge.mjs';
import {encryptCustomerSecret,decryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {digest} from '../src/lib/workspace-policy.mjs';
import {EMPLOYEE_INTAKE_NOTICE_VERSION,EMPLOYEE_INTAKE_NOTICE} from '../src/lib/meta-kyc-conversation.mjs';
import {employeeIntakeFixture} from './fixtures/employee-intake-memory.mjs';
import {readEmployeeIntake} from '../src/lib/meta-employee-intake.mjs';

// Actual intake + KYC bridges/resolvers with signed, encrypted synthetic SQL
// fixtures. PostgreSQL lock/race acceptance remains a separate required check.
async function routedFixture(){
 const f=await companyKycMemoryFixture();await f.execute(f.code);
 const applicationId='customer_webhook_'+digest(['synthetic-admitted-intake']);
 const senderKey='a'.repeat(64),state={applicationId,organizationId:f.target.organizationId,connectionId:f.connection.id,revision:6,senderKey,sender:f.worker.phone,status:'ADMITTED',step:'ADMITTED',consent:true,noticeVersion:EMPLOYEE_INTAKE_NOTICE_VERSION,noticeSha256:digest(EMPLOYEE_INTAKE_NOTICE),lastEventId:applicationId,expiresAt:new Date(f.now.getTime()+60000).toISOString(),admission:{workerId:f.worker.id,projectId:f.target.id}};
 const envelope={version:1,applicationId,organizationId:f.target.organizationId,connectionId:f.connection.id,senderKey,revision:state.revision,status:state.status,lastEventId:applicationId,encryptedState:encryptCustomerSecret(JSON.stringify(state),{organizationId:f.target.organizationId,projectId:f.anchor.id,purpose:'employee-intake',resourceId:applicationId},f.environment)};
 const anchor={id:applicationId,projectId:f.anchor.id,provider:'meta-customer-v1',eventType:'message',status:'PROCESSED',payload:{employeeIntake:envelope}};f.events.set(applicationId,anchor);
 const connect=async()=>{const client=await f.connect();return {...client,query:async(sql,args)=>{
  if(sql.includes("payload->'employeeIntake'->>'senderKey'"))return {rows:structuredClone([anchor]),rowCount:1};
  if(sql.includes("metadata->'participant'->'channelIdentity'->'binding'"))return {rows:[],rowCount:0};
  return client.query(sql,args);
 }};};
 const bridge=createMetaKycBridge({connect,provider:f.provider,deposit:f.deposit,environment:f.environment});
 const dispatch=async input=>(await bridge.executeIntake(input))||(await bridge.execute(input));
 return {...f,bridge,dispatch,intakeAnchor:anchor,applicationId};
}
const externalUnchanged=f=>{assert.equal(f.control.graph,0);assert.equal(f.control.cdn,0);assert.equal(f.blob.puts(),0);assert.equal(f.controls.sends,1);assert.equal(f.outbounds.size,1);};

test('canonical intake reader revalidates the same policy in a read-only SQL boundary without locking writes',async()=>{
 const f=employeeIntakeFixture();await f.submit();const before=structuredClone([...f.events]),auditBefore=structuredClone([...f.audits]),sql=[];
 const client={query:async(statement,args)=>{assert.match(statement,/^SELECT /);assert.doesNotMatch(statement,/FOR (?:SHARE|UPDATE)/);sql.push(statement);return f.query(statement,args);}};
 const observed=await readEmployeeIntake(client,f.member,f.target.id,f.environment);assert.equal(observed.enabled,true);assert.equal(observed.records.length,1);assert.ok(sql.some(statement=>statement.includes('JOIN public."TenantMembership"')));
 f.controls.issuerActive=false;assert.equal((await readEmployeeIntake(client,f.member,f.target.id,f.environment)).enabled,false);
 assert.deepEqual([...f.events],before);assert.deepEqual([...f.audits],auditBefore);assert.equal(f.controls.providerCalls,0);
});

test('ADMITTED intake classifies a sealed KYC reply without writes before the canonical bridge revalidates authority',async()=>{
 const f=await routedFixture(),before=structuredClone(f.intakeAnchor.payload),s=f.state(),input=f.receive({type:'interactive',interactive:{list_reply:{id:'kyc:'+s.nonce+':0'}}});
 const workerBefore=structuredClone(f.worker.metadata),auditsBefore=[...f.audits],sqlStart=f.control.sql.length;
 assert.equal(await f.bridge.executeIntake(input),null);
 assert.deepEqual(f.worker.metadata,workerBefore);assert.deepEqual([...f.audits],auditsBefore);assert.deepEqual(f.events.get(f.applicationId).payload,before);
 assert.ok(f.control.sql.slice(sqlStart).every(sql=>/^(?:BEGIN|SET |SELECT |COMMIT)/.test(sql)));externalUnchanged(f);
 const result=await f.bridge.execute(input);
 assert.equal(result.kind,'KYC_CHAT');assert.equal(result.identityStatus,'LIMITED_KYC_UPLOAD');assert.equal(f.state().step,'OCR');assert.equal(f.state().consent,true);
 assert.deepEqual(f.events.get(f.applicationId).payload,before);assert.equal(f.events.get(input.eventId).payload.employeeIntakeDispatch,undefined);
 const projection=[...f.audits.values()].find(a=>a.action==='participant.kyc_chat.projected'&&a.metadata.sourceEventId===input.eventId);
 assert.equal(projection.metadata.anchorProjectId,f.anchor.id);assert.equal(projection.metadata.targetProjectId,f.target.id);assert.equal(projection.metadata.workerId,f.worker.id);
 assert.equal(f.worker.metadata.participant.status,'INVITED');externalUnchanged(f);
});
for(const command of ['CANCELAR','ESTADO'])test(command+' reaches the claimed KYC conversation instead of terminal ADMITTED intake',async()=>{
 const f=await routedFixture(),before=structuredClone(f.intakeAnchor.payload),input=f.receive(command),result=await f.dispatch(input);
 assert.equal(result.kind,'KYC_CHAT');assert.equal(f.worker.metadata.participant.kycChatChallenge.status,command==='CANCELAR'?'CANCELLED':'CLAIMED');
 if(command==='ESTADO')assert.equal(f.state().step,'CONSENT');
 assert.deepEqual(f.events.get(f.applicationId).payload,before);assert.equal(f.events.get(input.eventId).payload.employeeIntakeDispatch,undefined);externalUnchanged(f);
});
for(const [name,mutate,code] of [
 ['wrong choice nonce',()=>{},'META_KYC_COMPANY_CONTEXT_REQUIRED'],
 ['assignment revoked',f=>{f.control.assignment=false;},'META_KYC_CHALLENGE_REJECTED'],
 ['issuer revoked',f=>{f.controls.issuerActive=false;},'META_KYC_CHALLENGE_REVOKED'],
 ['expired source lease',(f,input)=>{f.events.get(input.eventId).leaseExpiresAt=new Date(f.now.getTime()-1);},'META_CUSTOMER_INBOX_LEASE_CHANGED'],
 ['unconfirmed prompt',f=>{[...f.outbounds.values()][0].outcome.state='SEND_UNKNOWN';},'META_KYC_COMPANY_CONTEXT_REQUIRED'],
 ['corrupt ciphertext',f=>{[...f.outbounds.values()][0].payload.encryptedPayload='invalid';},'EMPLOYEE_INTAKE_INTEGRITY']
])test('the intake-first dispatch chain rejects invalid KYC intent or current authority: '+name,async()=>{
 const f=await routedFixture(),s=f.state(),input=f.receive(name==='wrong choice nonce'?{type:'interactive',interactive:{list_reply:{id:'kyc:'+'b'.repeat(20)+':0'}}}:{type:'interactive',interactive:{list_reply:{id:'kyc:'+s.nonce+':0'}}});mutate(f,input);
 const worker=structuredClone(f.worker.metadata),anchor=structuredClone(f.intakeAnchor.payload),audits=[...f.audits.keys()];
 await assert.rejects(f.dispatch(input),{code});
 assert.deepEqual(f.worker.metadata,worker);assert.deepEqual(f.events.get(f.applicationId).payload,anchor);assert.deepEqual([...f.audits.keys()],audits);externalUnchanged(f);
});
for(const name of ['no reply context','foreign messageId','sender purpose','sealed unrelated purpose'])test('a '+name+' cannot select KYC using a nonce or purpose alone',async()=>{
 const f=await routedFixture(),s=f.state();
 const input=f.receive({type:'interactive',interactive:{list_reply:{id:'kyc:'+s.nonce+':0'}},...(name==='sender purpose'?{channelPurpose:'KYC_CAPTURE'}:{})},{contextId:name==='no reply context'?null:name==='foreign messageId'?'wamid.Foreign':undefined});
 if(name==='sealed unrelated purpose'){
  const row=[...f.outbounds.values()][0],aad={organizationId:f.target.organizationId,projectId:f.anchor.id,purpose:'outbound',resourceId:row.id};
  const request=JSON.parse(decryptCustomerSecret(row.payload.encryptedPayload,aad,f.environment));request.channelPurpose='EMPLOYEE_INTAKE';row.payload.encryptedPayload=encryptCustomerSecret(JSON.stringify(request),aad,f.environment);row.payload.requestDigest=digest(request);
 }
 if(name==='sender purpose'){
  // Remove the actual prompt: the authenticated message's extra field alone
  // must not invoke KYC. No missing current intake policy may be manufactured.
  f.outbounds.clear();
 }
 const before=structuredClone(f.worker.metadata),anchor=structuredClone(f.intakeAnchor.payload),audits=[...f.audits.keys()];
 await assert.rejects(f.bridge.executeIntake(input),{code:'META_KYC_COMPANY_CONTEXT_REQUIRED'});
 assert.deepEqual(f.worker.metadata,before);assert.deepEqual(f.events.get(f.applicationId).payload,anchor);assert.deepEqual([...f.audits.keys()],audits);assert.equal(f.control.graph,0);assert.equal(f.blob.puts(),0);assert.equal(f.controls.sends,1);
});
