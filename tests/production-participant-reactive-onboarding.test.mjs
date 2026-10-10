import test from 'node:test';
import assert from 'node:assert/strict';
import {digest} from '../src/lib/workspace-policy.mjs';
import {encryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {customerOutboundId} from '../src/lib/meta-customer-outbound.mjs';
import {metaCustomerContentDigest} from '../src/lib/meta-customer-callback.mjs';
import {decodeReactiveStart,prelockReactiveOnboarding} from '../src/lib/participant-onboarding-reactive.mjs';
import {fenceCompanyKycAuthority} from '../src/lib/company-channel-kyc.mjs';

function fixture(){
 const environment={META_CUSTOMER_CREDENTIALS_KEY:Buffer.alloc(32,31).toString('base64')};
 const connection={id:'channel-a',projectId:'project-a',organizationId:'org-a'};
 const eventId='customer_webhook_'+'a'.repeat(64),applicationId='customer_webhook_'+'b'.repeat(64),nonce='c'.repeat(40);
 const proof={version:1,kind:'KYC_START',eventId,applicationId,nonce,expiresAt:'2026-10-09T06:00:00Z',intent:{organizationId:'org-a',targetProjectId:'project-b',workerId:'worker-a',invitationId:'invite_'+'1'.repeat(32),issuerActorId:'owner',issuerMembershipId:'owner-m',consentReceiptId:'contact-receipt'},authorityDigest:'d'.repeat(64),admissionReceiptId:'admit-receipt',challengeId:'kyc_chat_'+'2'.repeat(32),challengeReceiptId:'prepared',exteriorReceiptId:'exterior',handoffReceiptId:'handoff',code:'IDENTIDAD '+'e'.repeat(43)};
 const message={from:'15550001001',context:{id:'wamid.SyntheticReactiveReply'},type:'interactive',interactive:{list_reply:{id:'kyc-start:'+nonce}}};
 const reply={type:'interactive',body:'Synthetic private identity notice',button:'Continuar',sections:[{title:'Identidad',rows:[{id:message.interactive.list_reply.id,title:'Iniciar identidad'}]}]};
 const result={kind:'EMPLOYEE_INTAKE',identityStatus:'LIMITED_PARTICIPANT_INTAKE',reply,reactiveOnboarding:proof};
 const source={id:eventId,payload:{payloadDigest:'f'.repeat(64),employeeIntakeDispatch:{version:1,applicationId,replyDigest:digest(reply)}}};
 const request={version:1,eventId,applicationId,payloadDigest:source.payload.payloadDigest,channelId:connection.id,organizationId:connection.organizationId,to:message.from,channelPurpose:'EMPLOYEE_INTAKE',message:reply,reactiveOnboarding:proof};
 const row={id:customerOutboundId(eventId),payload:{},outcome:{state:'SENT',messageId:message.context.id}};
 const seal=()=>{
  row.payload.requestDigest=digest(request);
  row.payload.encryptedPayload=encryptCustomerSecret(JSON.stringify(request),{organizationId:connection.organizationId,projectId:connection.projectId,purpose:'outbound',resourceId:row.id},environment);
  source.payload.employeeIntakeDispatch.encryptedResult=encryptCustomerSecret(JSON.stringify(result),{organizationId:connection.organizationId,projectId:connection.projectId,purpose:'employee-intake-dispatch',resourceId:source.id},environment);
 };
 seal();return {environment,connection,proof,message,result,source,request,row,seal};
}

test('a reactive start reads only its exact encrypted SENT prompt and does not alter either original envelope',()=>{
 const f=fixture(),before={row:structuredClone(f.row),source:structuredClone(f.source)};
 assert.deepEqual(decodeReactiveStart(f.row,f.source,f.connection,f.message,f.environment),f.proof);
 assert.deepEqual(f.row,before.row);assert.deepEqual(f.source,before.source);
 assert.doesNotMatch(JSON.stringify(f.row),/IDENTIDAD|15550001001|kyc-start:/);
});
for(const [name,change,reseal=false] of [
 ['missing context',f=>delete f.message.context],
 ['foreign context',f=>{f.message.context.id='wamid.Foreign';}],
 ['wrong nonce',f=>{f.message.interactive.list_reply.id='kyc-start:'+'d'.repeat(40);}],
 ['SEND_STARTED',f=>{f.row.outcome.state='SEND_STARTED';}],
 ['SEND_UNKNOWN',f=>{f.row.outcome.state='SEND_UNKNOWN';}],
 ['failed status',f=>{f.row.outcome.providerStatus='failed';}],
 ['different sender',f=>{f.message.from='15550001002';}],
 ['wrong delivery lane',f=>{f.request.channelPurpose='KYC_CAPTURE';},true],
 ['foreign organization',f=>{f.request.organizationId='org-b';},true],
 ['foreign channel',f=>{f.request.channelId='channel-b';},true],
 ['foreign source',f=>{f.request.eventId='customer_webhook_'+'0'.repeat(64);},true],
 ['unrelated sealed button',f=>{f.request.message=structuredClone(f.request.message);f.request.message.sections[0].rows[0].id='kyc-start:'+'d'.repeat(40);},true],
 ['dispatch reply mismatch',f=>{f.source.payload.employeeIntakeDispatch.replyDigest='0'.repeat(64);},true],
 ['crossed application',f=>{f.source.payload.employeeIntakeDispatch.applicationId='customer_webhook_'+'0'.repeat(64);},true],
 ['tampered outbound ciphertext',f=>{f.row.payload.encryptedPayload='invalid';}],
 ['tampered dispatch ciphertext',f=>{f.source.payload.employeeIntakeDispatch.encryptedResult='invalid';}],
 ['invalid one-time code',f=>{f.proof.code='IDENTIDAD unsafe';},true],
 ['source digest mismatch',f=>{f.request.payloadDigest='0'.repeat(64);},true],
 ['unrelated sealed result',f=>{f.result.kind='FIELD';},true],
])test('reactive start rejects '+name+' without writes or provider I/O',()=>{
 const f=fixture();change(f);if(reseal)f.seal();const before={row:structuredClone(f.row),source:structuredClone(f.source)};
 assert.throws(()=>decodeReactiveStart(f.row,f.source,f.connection,f.message,f.environment),{code:name.includes('ciphertext')?'EMPLOYEE_INTAKE_INTEGRITY':'EMPLOYEE_INTAKE_CONTEXT_REQUIRED'});
 assert.deepEqual(f.row,before.row);assert.deepEqual(f.source,before.source);
});

for(const state of [null,{status:'NAME'},{status:'WAITING_RESPONSIBLE'},{status:'ADMITTED',admission:{workerId:'bad space',projectId:'project-b'}}])test('discovery of an incomplete or invalid intake produces no principal or SQL',async()=>{
 let queries=0;const value=await prelockReactiveOnboarding({query:async()=>{queries++;throw Error('unexpected SQL');}},{organizationId:'org-a'},state);
 assert.equal(value,null);assert.equal(queries,0);
});
for(const status of ['BLOCKED','PENDING','SEND_STARTED','SEND_UNKNOWN','SENT','STATUS_OBSERVED','REJECTED'])test('discovery never hands off '+status+' into another challenge',async()=>{
 const sql=[];
 const state={status:'ADMITTED',admission:{workerId:'worker-a',projectId:'project-b'}};
 const value=await prelockReactiveOnboarding({query:async(statement)=>{sql.push(statement);return {rows:[{id:'worker-a',projectId:'project-b',metadata:{participant:{status:'INVITED',onboardingDelivery:{state:status}}}}]};}},{organizationId:'org-a'},state);
 assert.equal(value,null);assert.equal(sql.length,1);assert.doesNotMatch(sql[0],/FOR (?:SHARE|UPDATE)|INSERT|UPDATE/);
});

function activeDiscoveryFixture(){
 const intent={organizationId:'org-a',targetProjectId:'project-b',workerId:'worker-a',invitationId:'invite_'+'1'.repeat(32),issuerActorId:'owner',issuerMembershipId:'owner-m',consentReceiptId:'contact-receipt'};
 const participant={status:'ACTIVE',clerkUserId:'user_Person',acceptanceReceiptId:'accepted-receipt',invitation:{state:'ACCEPTED'},onboardingDelivery:{version:1,...intent,state:'WAITING_CONFIGURATION'}};
 const state={status:'ADMITTED',admission:{workerId:'worker-a',projectId:'project-b'}};
 const connection={organizationId:'org-a',metadata:{employeeIntakePolicy:{issuerActorId:'owner',issuerMembershipId:'owner-m'}}};
 const calls=[];let ownRows=[{actorId:'person',membershipId:'person-m'}],ownClerk='user_Person';
 const client={async query(sql,args){
  calls.push({sql,args});
  if(sql.startsWith('SELECT w.id,w."projectId",w.metadata'))return {rows:[{id:'worker-a',projectId:'project-b',metadata:{participant}}]};
  if(sql.startsWith('SELECT u.id AS "actorId",tm.id AS "membershipId"'))return {rows:ownRows};
  if(sql.startsWith('SELECT id,"clerkUserId" FROM public."PlatformUser"'))return {rows:[{id:args[0],clerkUserId:args[0]==='person'?ownClerk:'user_Owner'}]};
  if(sql.startsWith('SELECT id AS "membershipId"'))return {rows:[{membershipId:args[0],actorId:args[1],organizationId:'org-a',role:args[1]==='owner'?'ADMIN':'AUDITOR',clerkRole:args[1]==='owner'?'org:admin':'org:member'}]};
  if(sql.startsWith('SELECT pg_advisory_xact_lock'))return {rows:[]};
  if(sql.includes('to_regclass'))return {rows:[{present:false}]};
  throw Error('Unexpected synthetic discovery SQL');
 }};
 return {participant,state,connection,intent,calls,client,setOwnRows:value=>{ownRows=value;},setOwnClerk:value=>{ownClerk=value;}};
}

test('accepted reactive discovery locks both canonical accounts before projects without rewriting identity or access',async()=>{
 const f=activeDiscoveryFixture(),before=structuredClone(f.participant);
 assert.deepEqual(await prelockReactiveOnboarding(f.client,f.connection,f.state),{intent:f.intent,admissionDigest:metaCustomerContentDigest(f.state.admission)});
 const accountLocks=f.calls.filter(c=>c.sql.startsWith('SELECT id,"clerkUserId"')).map(c=>c.args[0]);
 assert.deepEqual(accountLocks,['owner','person']);
 const journeyLocks=f.calls.filter(c=>c.sql.startsWith('SELECT pg_advisory_xact_lock'));
 assert.deepEqual(journeyLocks.map(c=>c.args[0]),['owner','person'].map(actorId=>'person-worksite-journey-v1:'+digest(['org-a',actorId])));
 const schemaIndex=f.calls.findIndex(c=>c.sql.includes('to_regclass'));
 assert.ok(f.calls.indexOf(journeyLocks[1])<schemaIndex);
 assert.deepEqual(f.participant,before);assert.ok(f.calls.every(c=>c.sql.startsWith('SELECT ')));
});

for(const [label,mutate] of [
 ['missing linked account',f=>{delete f.participant.clerkUserId;}],
 ['pending provider acceptance',f=>{f.participant.invitation.state='SENT';}],
 ['missing acceptance receipt',f=>{delete f.participant.acceptanceReceiptId;}],
 ['invalid linked account',f=>{f.participant.clerkUserId='foreign user';}],
])test('accepted discovery fails closed for '+label,async()=>{
 const f=activeDiscoveryFixture();mutate(f);
 await assert.rejects(prelockReactiveOnboarding(f.client,f.connection,f.state),{code:'EMPLOYEE_INTAKE_INTEGRITY'});
 assert.equal(f.calls.length,1);
});

for(const [label,mutate] of [
 ['revoked own membership',f=>f.setOwnRows([])],
 ['ambiguous own membership',f=>f.setOwnRows([{actorId:'person',membershipId:'person-m'},{actorId:'person',membershipId:'other-m'}])],
 ['changed own linked account',f=>f.setOwnClerk('user_Other')],
])test('accepted discovery denies '+label+' without a new challenge or account write',async()=>{
 const f=activeDiscoveryFixture();mutate(f);
 await assert.rejects(prelockReactiveOnboarding(f.client,f.connection,f.state),{code:'EMPLOYEE_INTAKE_REVOKED'});
 assert.ok(f.calls.every(c=>c.sql.startsWith('SELECT ')));assert.ok(!f.calls.some(c=>c.sql.startsWith('SELECT pg_advisory_xact_lock')));
});

for(const deadline of ['2026-10-09T05:00:00Z','2026-10-09T04:59:59Z','invalid'])test('final corporate fence rejects expired or invalid reactive start deadline '+deadline,async()=>{
 const now=new Date('2026-10-09T05:00:00Z'),event={id:'customer_webhook_'+'a'.repeat(64),projectId:'project-a',status:'PENDING',leaseToken:'synthetic-lease',leaseExpiresAt:new Date(now.getTime()+60000),payload:{channelId:'channel-a',payloadDigest:'b'.repeat(64)}};
 const r={companyKyc:{version:1},event,connection:{id:'channel-a',projectId:'project-a',enabled:true,connectionStatus:'CONNECTED',metadata:{customerSubscribed:true,customerActivation:{version:1,state:'ACTIVE',actorId:'owner'},customerVerification:{registered:true,scopes:['whatsapp_business_management','whatsapp_business_messaging'],expiresAt:null}}},challenge:{expiresAt:'2026-10-10T05:00:00Z'},worker:{metadata:{participant:{status:'INVITED',invitation:{expiresAt:'2026-10-10T05:00:00Z'}}}},payload:{type:'message',value:{id:'wamid.SyntheticReactiveMessage',from:'15550001001',timestamp:String(now.getTime()/1000)}},reactiveStartExpiresAt:deadline};
 const context={eventId:event.id,projectId:event.projectId,channelId:'channel-a',leaseToken:event.leaseToken,payloadDigest:event.payload.payloadDigest};let queries=0;
 await assert.rejects(fenceCompanyKycAuthority({query:async(sql)=>{queries++;assert.ok(sql.startsWith('SELECT '));return {rows:[{...event,now}]};}},r,context),{code:'META_KYC_CHALLENGE_EXPIRED'});assert.equal(queries,1);
});
