import test from 'node:test';
import assert from 'node:assert/strict';
import {digest} from '../src/lib/workspace-policy.mjs';
import {encryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {customerOutboundId} from '../src/lib/meta-customer-outbound.mjs';
import {metaCustomerContentDigest} from '../src/lib/meta-customer-callback.mjs';
import {decodeReactiveStart,prelockReactiveOnboarding,reactiveParticipantStatusAuthority,planReactiveOnboarding,fenceReactiveParticipantStatusResult} from '../src/lib/participant-onboarding-reactive.mjs';
import {fenceCompanyKycAuthority} from '../src/lib/company-channel-kyc.mjs';
import {COMPANY_CHANNEL_SCHEMA_CONTRACT} from '../src/lib/company-channel-schema.mjs';

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
 const connection={id:'channel-a',projectId:'project-a',organizationId:'org-a',whatsappBusinessId:'130000001',phoneNumberId:'120000001',enabled:true,connectionStatus:'CONNECTED',encryptedAccessToken:'synthetic-opaque-cipher',displayPhoneNumber:null,metadata:{employeeIntakePolicy:{issuerActorId:'owner',issuerMembershipId:'owner-m'}}};
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

function companyPresentDiscoveryFixture(){
 const f=activeDiscoveryFixture(),original=f.client.query,owner={connectionId:'channel-a',anchorProjectId:'project-a',mode:'COMPANY',revision:2,assignmentRevision:3},channel={...f.connection};
 const rows=value=>({rows:value}),fingerprint=digest({columns:[],keys:[],indexes:[],triggers:[]});
 f.client.query=async(sql,args)=>{
  if(sql.startsWith('SELECT id FROM public."Organization"')){f.calls.push({sql,args});return {rows:[{id:'org-a'}]};}
  let result;
  if(sql.includes('to_regclass'))result=rows([{present:true}]);
  else if(sql.includes('information_schema.columns'))result=sql.includes("column_name='catalogFingerprint'")?rows([{count:1}]):rows([]);
  else if(sql.includes('FROM public."WhatsAppCompanySchema"'))result=rows([{version:1,contract:COMPANY_CHANNEL_SCHEMA_CONTRACT,catalogFingerprint:fingerprint}]);
  else if(sql.startsWith('SELECT conname,convalidated'))result=rows(args[0].map(conname=>({conname,convalidated:true})));
  else if(sql.includes('pg_get_indexdef'))result=rows([]);
  else if(sql.startsWith('SELECT c.relname,i.indisvalid'))result=rows(args[0].map(relname=>({relname,indisvalid:true,indisready:true,indisunique:true})));
  else if(sql.startsWith('SELECT tgname'))result=rows(args[0].map(tgname=>({tgname,tgenabled:'O'})));
  else if(sql.includes('FROM pg_constraint')||sql.includes('FROM pg_index')||sql.includes('FROM pg_trigger'))result=rows([]);
  else if(sql.includes('FROM public."WhatsAppCompanyChannel"'))result=rows([owner]);
  else if(sql.includes('FROM public."WhatsAppConnection"'))result=rows([channel]);
  else if(sql.startsWith('SELECT id FROM public."Project"'))result=rows([{id:args[0]}]);
  else if(sql.startsWith('SELECT id,"clerkUserId",to_char'))result=rows([{id:args[0],clerkUserId:args[0]==='person'?'user_Person':'user_Owner',revision:'2026-10-09T00:00:00.000000'}]);
  else if(sql.startsWith('SELECT id AS "membershipId"')&&sql.includes('WHERE "userId"=$1'))result=rows([{actorId:args[0],membershipId:args[2],organizationId:args[1],role:'ADMIN',clerkRole:'org:admin',revision:'2026-10-09T00:00:00.000000'}]);
  else return original(sql,args);
  f.calls.push({sql,args});return result;
 };
 return f;
}

test('a caller-created status context cannot bypass the signed prelock capability',async()=>{
 const calls=[],client={query:async sql=>{calls.push(sql);throw Error('unexpected status SQL');}},r={state:{reactiveOnboarding:{kind:'KYC_START'}}},pref={intent:{workerId:'worker-a'},admissionDigest:'a'.repeat(64)};
 await assert.rejects(reactiveParticipantStatusAuthority(client,r,pref),{code:'EMPLOYEE_INTAKE_CONTEXT_REQUIRED'});assert.deepEqual(calls,[]);
});
test('missing canonical discovery cannot turn an admitted status query into a new preparation',async()=>{
 let queries=0;const client={query:async()=>{queries++;throw Error('unexpected SQL');}},state={step:'ADMITTED',status:'ADMITTED',reactiveOnboarding:{kind:'KYC_START'}},r={state,payload:{value:{type:'text',text:{body:'ESTADO'}}}};
 await assert.rejects(planReactiveOnboarding(client,r,null),{code:'EMPLOYEE_INTAKE_REVOKED'});assert.equal(queries,0);assert.equal(state.reactiveOnboarding.kind,'KYC_START');
});
test('completed status discovery locks the own assignment and Worker before any channel or event',async()=>{
 const f=companyPresentDiscoveryFixture();f.state.reactiveOnboarding={kind:'KYC_START'};f.participant.kycChatChallenge={id:'kyc_chat_'+'2'.repeat(32),status:'COMPLETED'};
 const original=f.client.query;f.client.query=async(sql,args)=>{
  if(sql.startsWith('SELECT id FROM public."ProjectMembership"')){f.calls.push({sql,args});return {rows:[{id:'assignment-a'}]};}
  if(sql.startsWith('SELECT id,"projectId",active,metadata')){f.calls.push({sql,args});return {rows:[{id:'worker-a',projectId:'project-b',active:true,metadata:{participant:f.participant}}]};}
  return original(sql,args);
 };
 const pref=await prelockReactiveOnboarding(f.client,f.connection,f.state);
 assert.deepEqual(pref,{intent:f.intent,admissionDigest:metaCustomerContentDigest(f.state.admission)});
 const own=f.calls.findIndex(call=>call.sql.startsWith('SELECT id,"clerkUserId"')&&call.args[0]==='person'),assignment=f.calls.findIndex(call=>call.sql.startsWith('SELECT id FROM public."ProjectMembership"')),worker=f.calls.findIndex(call=>call.sql.startsWith('SELECT id,"projectId",active,metadata'));
 const projects=f.calls.map((call,index)=>({call,index})).filter(({call})=>call.sql.startsWith('SELECT id FROM public."Project"')&&call.sql.includes('FOR UPDATE')),channel=f.calls.findIndex(call=>call.sql.includes('FROM public."WhatsAppConnection"')&&call.sql.includes('FOR SHARE'));
 assert.deepEqual(projects.map(({call})=>call.args[0]),['project-a','project-b']);assert.ok(own>=0&&projects.every(({index})=>index>own&&index<assignment)&&assignment>own&&worker>assignment&&channel>worker);assert.match(f.calls[worker].sql,/FOR UPDATE/);assert.ok(f.calls.every(call=>call.sql.startsWith('SELECT ')));
});
test('a changed current account during completed prelock is denied without capture or a later principal lock',async()=>{
 const f=companyPresentDiscoveryFixture();f.state.reactiveOnboarding={kind:'KYC_START'};f.participant.kycChatChallenge={id:'kyc_chat_'+'2'.repeat(32),status:'COMPLETED'};
 const original=f.client.query;f.client.query=async(sql,args)=>{
  if(sql.startsWith('SELECT id FROM public."ProjectMembership"')){f.calls.push({sql,args});return {rows:[{id:'assignment-a'}]};}
  if(sql.startsWith('SELECT id,"projectId",active,metadata')){f.calls.push({sql,args});return {rows:[{id:'worker-a',projectId:'project-b',active:true,metadata:{participant:{...f.participant,clerkUserId:'user_Other'}}}]};}
  return original(sql,args);
 };
 await assert.rejects(prelockReactiveOnboarding(f.client,f.connection,f.state),{code:'EMPLOYEE_INTAKE_REVOKED'});
 assert.ok(f.calls.every(call=>call.sql.startsWith('SELECT ')));const worker=f.calls.findIndex(call=>call.sql.startsWith('SELECT id,"projectId",active,metadata'));assert.ok(worker>=0);assert.equal(f.calls.length,worker+1);
});
test('an incomplete capture stays outside the status reader and retains its original handoff',async()=>{
 const f=activeDiscoveryFixture();f.state.reactiveOnboarding={kind:'KYC_START'};f.participant.onboardingDelivery={...f.participant.onboardingDelivery,state:'CANCELED',code:'PARTICIPANT_ONBOARDING_REACTIVE_HANDOFF'};f.participant.kycChatChallenge={id:'kyc_chat_'+'2'.repeat(32),status:'CLAIMED'};
 const pref=await prelockReactiveOnboarding(f.client,f.connection,f.state),before=f.calls.length;
 const plan=await planReactiveOnboarding(f.client,{state:f.state,payload:{value:{type:'text',text:{body:'HOLA'}}}},pref);
 assert.equal(plan,null);assert.equal(f.calls.length,before);assert.equal(f.state.reactiveOnboarding.kind,'KYC_START');assert.equal(f.participant.kycChatChallenge.status,'CLAIMED');
});
test('runtime-intake-own principal union rejects conflicting membership IDs before any lock',async()=>{
 let queries=0;const client={query:async()=>{queries++;throw Error('unexpected SQL');}},connection={organizationId:'org-a',metadata:{employeeIntakePolicy:{issuerActorId:'owner',issuerMembershipId:'owner-m'}}};
 await assert.rejects(prelockReactiveOnboarding(client,connection,null,{principalRefs:[{actorId:'owner',membershipId:'different-m',clerkUserId:'user_Owner'}]}),{code:'EMPLOYEE_INTAKE_REVOKED'});assert.equal(queries,0);
});
test('a distinct runtime principal joins the same sorted union before completed status P-PM-W-C',async()=>{
 const f=companyPresentDiscoveryFixture();f.state.reactiveOnboarding={kind:'KYC_START'};f.participant.kycChatChallenge={id:'kyc_chat_'+'2'.repeat(32),status:'COMPLETED'};const original=f.client.query;
 f.client.query=async(sql,args)=>{
  if(sql==='SELECT id,"clerkUserId" FROM public."PlatformUser" WHERE id=$1 FOR SHARE'&&args[0]==='aaa-runtime'){f.calls.push({sql,args});return {rows:[{id:'aaa-runtime',clerkUserId:'user_Runtime'}]};}
  if(sql.startsWith('SELECT id AS "membershipId"')&&args[1]==='aaa-runtime'){f.calls.push({sql,args});return {rows:[{actorId:'aaa-runtime',membershipId:'runtime-m',organizationId:'org-a',role:'ADMIN',clerkRole:'org:admin'}]};}
  if(sql.startsWith('SELECT id FROM public."ProjectMembership"')){f.calls.push({sql,args});return {rows:[{id:'assignment-a'}]};}
  if(sql.startsWith('SELECT id,"projectId",active,metadata')){f.calls.push({sql,args});return {rows:[{id:'worker-a',projectId:'project-b',active:true,metadata:{participant:f.participant}}]};}return original(sql,args);
 };
 await prelockReactiveOnboarding(f.client,f.connection,f.state,{principalRefs:[{actorId:'aaa-runtime',membershipId:'runtime-m',clerkUserId:'user_Runtime'}]});
 const principals=f.calls.filter(q=>q.sql==='SELECT id,"clerkUserId" FROM public."PlatformUser" WHERE id=$1 FOR SHARE');assert.deepEqual(principals.map(q=>q.args[0]),['aaa-runtime','owner','person']);const p=f.calls.findIndex(q=>q.sql.startsWith('SELECT id FROM public."Project"')&&q.sql.includes('FOR UPDATE'));assert.ok(principals.every(q=>f.calls.indexOf(q)<p));
});
test('caller-created status reply cannot use the compact fence without full current authority',async()=>{
 let queries=0;const client={query:async()=>{queries++;throw Error('unexpected SQL');}};await assert.rejects(fenceReactiveParticipantStatusResult(client,{}, {},{reactiveKycStatus:{status:'APPROVED'}}),{code:'EMPLOYEE_INTAKE_CONTEXT_REQUIRED'});assert.equal(queries,0);
});
test('target reassigned to another connection or anchor is rejected before any Project lock',async()=>{
 const f=companyPresentDiscoveryFixture();f.state.reactiveOnboarding={kind:'KYC_START'};f.participant.kycChatChallenge={id:'kyc_chat_'+'2'.repeat(32),status:'COMPLETED'};const original=f.client.query;
 f.client.query=async(sql,args)=>{if(sql.includes('FROM public."WhatsAppConnection"')){f.calls.push({sql,args});return {rows:[{...f.connection,id:'channel-other',projectId:'project-other'}]};}return original(sql,args);};
 await assert.rejects(prelockReactiveOnboarding(f.client,f.connection,f.state),{code:'META_KYC_COMPANY_AUTHORITY_CHANGED'});assert.ok(!f.calls.some(q=>q.sql.includes('FROM public."Project"')&&q.sql.includes('FOR UPDATE')));assert.ok(!f.calls.some(q=>q.sql.includes('FROM public."WhatsAppConnection"')&&q.sql.includes('FOR SHARE')));
});
