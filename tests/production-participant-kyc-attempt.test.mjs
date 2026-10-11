import test from 'node:test';
import assert from 'node:assert/strict';
import {kycMemoryFixture} from './fixtures/meta-kyc-chat-memory.mjs';
import {createParticipantKycChatAttemptReader,publicParticipantKycChatAttempt} from '../src/lib/participant-kyc-chat-attempt.mjs';
import {createParticipantStore} from '../src/lib/participant-store.mjs';
import {createParticipantHandlers} from '../src/lib/participant-http.mjs';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
import {scopeStamp} from '../src/lib/workspace-policy.mjs';
import {encryptCustomerSecret,decryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {metaCustomerContentDigest} from '../src/lib/meta-customer-callback.mjs';

// Real signed-envelope decoding and canonical authorization over synthetic SQL.
// These units exercise neither PostgreSQL concurrency nor real Meta delivery.
const result=rows=>({rows:structuredClone(rows),rowCount:rows.length});
const forbidden=()=>assert.fail('The diagnostic must not call a provider, storage, write, or scheduler');
const publicKeys=['codeMatch','codeSyntax','preparationReceiptMatch','processingState','reason','receivedAt','rejected','sameSecond','senderMatch','state','version'].sort();

function attemptFixture({company=false}={}){
 const f=kycMemoryFixture({active:true,captureImageSetVersion:2});
 f.now.setTime(Date.parse('2026-10-10T20:00:00.750Z'));
 const challenge=f.worker.metadata.participant.kycChatChallenge;
 challenge.id='kyc_chat_'+'a'.repeat(32);
 challenge.createdAt=f.now.toISOString();challenge.expiresAt=new Date(f.now.getTime()+86400000).toISOString();
 for(const audit of f.audits.values()){audit.metadata.challengeId=challenge.id;audit.metadata.expiresAt=challenge.expiresAt;}
 if(company){
  f.connection.projectId='anchor-project';
  f.connection.company={mode:'COMPANY',targetProjectId:f.project.id};
  challenge.companyKyc={version:1,anchorProjectId:f.connection.projectId,targetProjectId:f.project.id};
 }
 const queries=[],controls={eventRows:null};let sequence=0;
 const client={async query(sql,args=[]){
  queries.push({sql,args});assert.match(sql,/^SELECT\b/,'Adapter SQL must be read-only');
  if(sql.includes('FROM public."WhatsAppConnection"'))return result(args[0]===f.connection.id&&args[1]===f.connection.projectId&&args[2]===f.connection.organizationId?[f.connection]:[]);
  if(sql.includes('FROM public."WebhookEvent"')){
   assert.deepEqual(args,[f.connection.projectId,f.issuer.organizationId,f.connection.id]);
   assert.match(sql,/provider='meta-customer-v1'/);assert.match(sql,/"eventType"='message'/);assert.match(sql,/LIMIT 20$/);
   if(controls.eventRows!==null)return result(controls.eventRows);
   return result([...f.events.values()].filter(e=>e.projectId===args[0]&&e.provider==='meta-customer-v1'&&e.eventType==='message'&&e.payload.organizationId===args[1]&&e.payload.channelId===args[2]).sort((a,b)=>b.createdAt-a.createdAt||b.id.localeCompare(a.id)).slice(0,20));
  }
  if(sql.includes('FROM public."AuditLog"')){
   assert.deepEqual(args,[f.issuer.organizationId,challenge.issuerActorId,f.worker.id,challenge.id]);
   return result([...f.audits.values()].filter(a=>a.organizationId===args[0]&&a.actorId===args[1]&&a.entityType==='Worker'&&a.entityId===args[2]&&a.action==='participant.kyc_chat.prepared'&&a.metadata.challengeId===args[3]).slice(0,2));
  }
  assert.fail('Unexpected diagnostic SQL: '+sql);
 }};
 const seal=(event,payload)=>{
  const aad={organizationId:f.connection.organizationId,projectId:event.projectId,resourceId:event.id},payloadDigest=metaCustomerContentDigest(payload);
  event.payload={channelId:f.connection.id,organizationId:f.connection.organizationId,payloadDigest,signatureVerified:true,signatureScheme:'meta-hmac-sha256-v1',encryptedPayload:encryptCustomerSecret(JSON.stringify(payload),{...aad,purpose:'webhook'},f.environment),encryptedProof:encryptCustomerSecret(JSON.stringify({scheme:'meta-hmac-sha256-v1',purpose:'CUSTOMER',appId:f.environment.NEXT_PUBLIC_META_APP_ID,payloadDigest,organizationId:f.connection.organizationId,channelId:f.connection.id}),{...aad,purpose:'webhook-proof'},f.environment)};
 };
 const record=(text=f.code,{sender,timestamp,proof=true,rejected=true,status='PROCESSED'}={})=>{
  const context=f.receive(text,{...(sender===undefined?{}:{sender}),...(timestamp===undefined?{}:{timestamp}),proof});
  const event=f.events.get(context.eventId);
  if(company){const payload=JSON.parse(decryptCustomerSecret(event.payload.encryptedPayload,{organizationId:f.project.organizationId,projectId:f.project.id,purpose:'webhook',resourceId:event.id},f.environment));event.projectId=f.connection.projectId;seal(event,payload);if(!proof)event.payload.encryptedProof=null;}
  event.eventType='message';event.status=status;event.outcome={version:1,code:rejected?'META_KYC_CHALLENGE_REJECTED':null};event.createdAt=new Date(f.now.getTime()+ ++sequence);
  return event;
 };
 const rewrite=(event,change)=>{const payload=JSON.parse(decryptCustomerSecret(event.payload.encryptedPayload,{organizationId:f.connection.organizationId,projectId:event.projectId,purpose:'webhook',resourceId:event.id},f.environment));change(payload);seal(event,payload);};
 const reader=createParticipantKycChatAttemptReader({resolveConnection:async()=>company?structuredClone(f.connection):null});
 const read=()=>reader({client,member:f.issuer,projectId:f.project.id,row:f.worker,environment:f.environment});
 const snapshot=()=>JSON.stringify({worker:f.worker,events:[...f.events],audits:[...f.audits],outbounds:[...f.outbounds],downloads:f.controls.downloads,sends:f.controls.sends,puts:f.blob.puts(),objects:f.blob.objects.size});
 const assertPrivate=value=>{
  if(value.state==='OBSERVED')assert.deepEqual(Object.keys(value).sort(),publicKeys);
  else assert.deepEqual(Object.keys(value).sort(),['state','version']);
  const serialized=JSON.stringify(value);
  for(const secret of [f.code,f.worker.phone,f.worker.phone.slice(1),f.connection.encryptedAccessToken,f.connection.id,challenge.codeDigest,'wamid.','encryptedPayload','META_KYC_CHALLENGE_REJECTED','synthetic-kyc-channel-token'])assert.equal(serialized.includes(secret),false,'Private material crossed the diagnostic DTO');
 };
 return {...f,challenge,client,queries,readControls:controls,reader,read,record,rewrite,snapshot,assertPrivate};
}

test('current signed rejected attempt is observed twice without effects or private material',async()=>{
 const f=attemptFixture();f.record();const before=f.snapshot(),first=await f.read(),second=await f.read();
 assert.deepEqual(second,first);assert.equal(f.snapshot(),before);f.assertPrivate(first);
 assert.deepEqual(first,{version:1,state:'OBSERVED',receivedAt:'2026-10-10T20:00:01.000Z',processingState:'PROCESSED',rejected:true,reason:'CHALLENGE_REJECTED',codeSyntax:true,codeMatch:true,senderMatch:true,preparationReceiptMatch:true,sameSecond:false});
});

for(const sender of ['5491100002222','541100001111'])test('current code diagnoses an exact sender mismatch without phone normalization: '+sender,async()=>{
 const f=attemptFixture();f.record(f.code,{sender});const value=await f.read();
 assert.equal(value.reason,'SENDER_MISMATCH');assert.equal(value.codeMatch,true);assert.equal(value.senderMatch,false);f.assertPrivate(value);
});

for(const [text,reason,syntax]of [['IDENTIDAD short','CODE_FORMAT',false],['identidad '+'x'.repeat(43),'CODE_FORMAT',false],['IDENTIDAD '+'x'.repeat(43),'CODE_MISMATCH',true]])test('registered sender has a fixed diagnostic for '+reason+' with '+text.slice(0,8),async()=>{
 const f=attemptFixture();f.record(text);const value=await f.read();
 assert.equal(value.reason,reason);assert.equal(value.codeSyntax,syntax);assert.equal(value.codeMatch,false);assert.equal(value.senderMatch,true);f.assertPrivate(value);
});

test('old code from another phone and unrelated messages never become a current KYC attempt',async()=>{
 const f=attemptFixture();f.record('IDENTIDAD '+'z'.repeat(43),{sender:'5491100002222'});f.record('HOLA');f.record('CBU 0000000000000000000000');f.record({type:'image',image:{id:'synthetic-media',mime_type:'image/png'}});f.record(f.code,{timestamp:Math.floor(f.now.getTime()/1000)-1});
 const value=await f.read();assert.deepEqual(value,{version:1,state:'NOT_OBSERVED'});f.assertPrivate(value);
});

test('signed message seconds determine latest attempt independently of database arrival order',async()=>{
 const f=attemptFixture(),start=Math.floor(f.now.getTime()/1000);
 f.record(f.code,{timestamp:start+3});f.record('IDENTIDAD short',{timestamp:start+2});
 const value=await f.read();assert.equal(value.receivedAt,'2026-10-10T20:00:03.000Z');assert.equal(value.codeMatch,true);assert.equal(value.reason,'CHALLENGE_REJECTED');
});

test('creation-second sender-only matches and tied signed seconds remain inconclusive',async()=>{
 const f=attemptFixture(),start=Math.floor(f.now.getTime()/1000);f.record('IDENTIDAD short',{timestamp:start});
 let value=await f.read();assert.equal(value.state,'OBSERVED');assert.equal(value.reason,'SAME_SECOND_UNCONFIRMED');assert.equal(value.sameSecond,true);
 f.events.clear();f.record('IDENTIDAD '+'z'.repeat(43),{timestamp:start});
 value=await f.read();assert.equal(value.reason,'SAME_SECOND_UNCONFIRMED');assert.equal(value.sameSecond,true);
 f.events.clear();f.record(f.code,{timestamp:start+2});f.record('IDENTIDAD short',{timestamp:start+2});
 value=await f.read();assert.equal(value.reason,'SAME_SECOND_UNCONFIRMED');assert.equal(value.sameSecond,true);f.assertPrivate(value);
});

test('exact current-code match is observable in its creation second and pending processing grants nothing',async()=>{
 const f=attemptFixture();f.record(f.code,{timestamp:Math.floor(f.now.getTime()/1000),status:'PENDING',rejected:false});
 const value=await f.read();assert.equal(value.state,'OBSERVED');assert.equal(value.processingState,'PENDING');assert.equal(value.rejected,false);assert.equal(value.reason,'OTHER_RESULT');assert.equal(value.codeMatch,true);f.assertPrivate(value);
});

test('temporal ambiguity remains inconclusive even without a recorded rejection',async()=>{
 const f=attemptFixture();f.record('IDENTIDAD short',{timestamp:Math.floor(f.now.getTime()/1000),status:'PENDING',rejected:false});
 const value=await f.read();assert.equal(value.reason,'SAME_SECOND_UNCONFIRMED');assert.equal(value.sameSecond,true);assert.equal(value.rejected,false);f.assertPrivate(value);
});

for(const [label,change]of [
 ['missing',f=>f.audits.clear()],
 ['duplicated',f=>f.audits.set('duplicate',structuredClone([...f.audits.values()][0]))],
 ['other challenge',f=>[...f.audits.values()][0].metadata.challengeId='kyc_chat_other'],
 ['other project',f=>[...f.audits.values()][0].metadata.projectId='project-other'],
 ['old expiry',f=>[...f.audits.values()][0].metadata.expiresAt='2026-10-01T00:00:00Z'],
])test('preparation receipt '+label+' is never credited to this attempt',async()=>{
 const f=attemptFixture();f.record();change(f);const value=await f.read();
 assert.equal(value.preparationReceiptMatch,false);assert.equal(value.reason,'PREPARATION_RECEIPT_UNCONFIRMED');f.assertPrivate(value);
});

for(const [label,change]of [
 ['missing proof',e=>{e.payload.encryptedProof=null;}],
 ['unsigned',e=>{e.payload.signatureVerified=false;}],
 ['wrong signature scheme',e=>{e.payload.signatureScheme='different';}],
 ['tampered digest',e=>{e.payload.payloadDigest='f'.repeat(64);}],
 ['wrong tenant',e=>{e.payload.organizationId='company-other';}],
 ['wrong channel',e=>{e.payload.channelId='connection-other';}],
 ['wrong anchor',e=>{e.projectId='project-other';}],
 ['wrong protocol',e=>{e.provider='meta-demo-pilot-v1';}],
])test('unverified source '+label+' fails closed without material disclosure',async()=>{
 const f=attemptFixture(),event=f.record();change(event);f.readControls.eventRows=[event];
 const value=await f.read();assert.deepEqual(value,{version:1,state:'UNAVAILABLE'});f.assertPrivate(value);
});

test('even an unrelated malformed proof prevents an authoritative absence or rejection report',async()=>{
 const f=attemptFixture();f.record();f.record('HOLA',{proof:false});assert.deepEqual(await f.read(),{version:1,state:'UNAVAILABLE'});
});

test('signed payload with the wrong company phone or WABA cannot be observed',async()=>{
 for(const key of ['phoneNumberId','wabaId']){const f=attemptFixture(),event=f.record();f.rewrite(event,payload=>{payload[key]='990000011';});assert.deepEqual(await f.read(),{version:1,state:'UNAVAILABLE'});}
});

test('shared channel uses its tenant anchor while retaining the requested worker project',async()=>{
 const f=attemptFixture({company:true});f.record();const before=f.snapshot(),value=await f.read();
 assert.equal(value.reason,'CHALLENGE_REJECTED');assert.equal(value.preparationReceiptMatch,true);assert.equal(f.snapshot(),before);f.assertPrivate(value);
 const events=f.queries.find(q=>q.sql.includes('FROM public."WebhookEvent"'));assert.deepEqual(events.args,['anchor-project','company-a','connection-a']);
});

for(const [label,change]of [
 ['tenant',f=>{f.connection.organizationId='company-other';}],
 ['credential tenant',f=>{f.connection.metadata.credentialOrganizationId='company-other';}],
 ['target',f=>{f.connection.company.targetProjectId='project-other';}],
 ['anchor',f=>{f.connection.projectId='anchor-other';}],
 ['mode',f=>{f.connection.company.mode='SUSPENDED';}],
 ['connection',f=>{f.connection.id='connection-other';}],
])test('shared channel rejects a mismatched '+label+' before scanning messages',async()=>{
 const f=attemptFixture({company:true});change(f);assert.deepEqual(await f.read(),{version:1,state:'UNAVAILABLE'});assert.equal(f.queries.length,0);
});

test('current worker phone or challenge scope changes invalidate the diagnostic before SQL',async()=>{
 for(const change of [f=>{f.worker.phone='+5491100003333';},f=>{f.challenge.workerId='worker-other';},f=>{f.challenge.organizationId='company-other';},f=>{f.challenge.projectId='project-other';},f=>{f.worker.active=false;}]){
  const f=attemptFixture();change(f);assert.deepEqual(await f.read(),{version:1,state:'UNAVAILABLE'});assert.equal(f.queries.length,0);
 }
});

test('twenty-message scan does not claim definitive absence and rejects oversized adapter results',async()=>{
 const f=attemptFixture();f.record();for(let n=0;n<20;n++)f.record('HOLA');
 const value=await f.read();assert.deepEqual(value,{version:1,state:'NOT_OBSERVED'});f.assertPrivate(value);assert.equal(Object.hasOwn(value,'definitive'),false);
 f.readControls.eventRows=[...f.events.values()];assert.deepEqual(await f.read(),{version:1,state:'UNAVAILABLE'});
});

test('public projection strips injected private fields and rejects invalid observable contracts',async()=>{
 const f=attemptFixture();f.record();const observed=await f.read();
 const value=publicParticipantKycChatAttempt({...observed,body:f.code,phone:f.worker.phone,token:'synthetic-secret',providerError:'private',eventId:[...f.events.keys()][0]});assert.deepEqual(value,observed);f.assertPrivate(value);
 assert.deepEqual(publicParticipantKycChatAttempt({version:1,state:'UNAVAILABLE',phone:f.worker.phone}),{version:1,state:'UNAVAILABLE'});
 for(const invalid of [{...observed,codeMatch:1},{...observed,receivedAt:'invalid'},{...observed,reason:'private provider detail'},{...observed,processingState:'FAILED'},{...observed,version:2}])assert.throws(()=>publicParticipantKycChatAttempt(invalid),{code:'PARTICIPANT_KYC_ATTEMPT_UNAVAILABLE'});
});

function authorizedFixture({own=false,role=own?'AUDITOR':'ADMIN',reader=true}={}){
 const f=attemptFixture(),session={authenticated:true,verification:'clerk-production-jwt',userId:own?'user_WorkerA':'user_ManagerA',organizationId:'org_Synthetic',organizationRole:own?'org:member':'org:admin'};
 const member={membershipId:own?'worker-member':'manager-member',actorId:own?'worker-user-a':'manager-a',organizationId:f.project.organizationId,role,clerkUserId:session.userId,clerkRole:session.organizationRole};
 const controls={membership:true,project:true,assignment:true,ownMembership:true,officeReviewOnly:false,bound:false,adapterCalls:0},queries=[];
 const connect=async()=>({release(){},async query(sql,args=[]){
  queries.push({sql,args});assert.match(sql,/^(SELECT\b|BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY$|SET LOCAL\b|ROLLBACK$)/,'Canonical diagnostic transaction must not write or commit');
  if(/^(BEGIN|SET LOCAL|ROLLBACK)/.test(sql))return result([]);
  if(sql.includes('WHERE u."clerkUserId"=$1'))return result(controls.membership&&args[0]===session.userId&&args[1]===session.organizationId&&args[2]===session.organizationRole?[{...member,officeReviewOnly:controls.officeReviewOnly}]:[]);
  if(sql.startsWith('SELECT w.id FROM public."Worker"'))return result(controls.bound||f.worker.metadata.participant.clerkUserId===args[1]?[{id:f.worker.id}]:[]);
  if(sql.includes('FROM public."ProjectMembership"'))return result(controls.assignment&&args[0]===f.project.id&&args[1]===member.membershipId?[{id:'project-assignment'}]:[]);
  if(sql.includes('FROM public."TenantMembership"'))return result(controls.ownMembership&&controls.assignment&&args[0]===member.membershipId&&args[1]===member.organizationId&&args[2]===session.userId&&args[3]===f.project.id?[{id:member.membershipId}]:[]);
  if(sql.includes('FROM public."Project"')&&!sql.includes('public."WhatsAppConnection"'))return result(controls.project&&args[0]===f.project.id&&args[1]===member.organizationId?[{...f.project,status:'ACTIVE',organizationMetadata:{}}]:[]);
  if(sql.includes('FROM public."Worker"')){
   if(sql.includes('WHERE id=$1 AND "projectId"=$2'))return result(args[0]===f.worker.id&&args[1]===f.project.id?[f.worker]:[]);
   if(sql.includes('WHERE "projectId"=$1'))return result(args[0]===f.project.id&&f.worker.metadata.participant.clerkUserId===args[1]?[f.worker]:[]);
  }
  if(sql.includes('FROM public."AuditLog"')&&sql.includes("'INVITATION_ACCEPTED'"))return result([]);
  return f.client.query(sql,args);
 }});
 const injected=reader===true?async input=>{controls.adapterCalls++;return f.reader(input);}:reader;
 const store=createParticipantStore({workspace:createWorkspaceStore({connect}),connect:forbidden,identity:{createInvitation:forbidden,verifyMembership:forbidden},upload:forbidden,get:forbidden,prepareKycChat:forbidden,analyzer:{analyzeDni:forbidden},assessBiometrics:forbidden,...(reader===null?{}:{readKycChatAttempt:injected}),environment:f.environment});
 const context=extra=>({projectId:f.project.id,scope:scopeStamp(session,member),workerId:f.worker.id,challengeId:f.challenge.id,...extra});
 const api=createParticipantHandlers({verify:async()=>session,store,scheduleOnboarding:forbidden});
 return {...f,session,member,authControls:controls,authQueries:queries,store,context,api};
}

for(const [own,role]of [[false,'ADMIN'],[false,'DIRECTOR'],[true,'AUDITOR']])test('canonical '+(own?'own identity-only participant':'admitted '+role)+' can read without report permission or external effects',async()=>{
 const f=authorizedFixture({own,role});f.worker.metadata.participant.permissions={attendance:false,report:false};f.record();
 const before=f.snapshot(),value=await f.store.kycChatAttempt(f.session,f.context());
 assert.deepEqual(Object.keys(value).sort(),['challengeId','detail','kycChatAttempt','projectId','scope','workerId']);assert.equal(value.challengeId,f.challenge.id);assert.equal(value.kycChatAttempt.codeMatch,true);assert.equal(f.authControls.adapterCalls,1);assert.equal(f.snapshot(),before);f.assertPrivate(value.kycChatAttempt);
 assert.ok(f.authQueries.some(q=>q.sql==='BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'));assert.ok(f.authQueries.some(q=>q.sql==='ROLLBACK'));
});

for(const [label,options,change,code]of [
 ['third-party office reader',{},f=>{f.member.role='AUDITOR';},'PARTICIPANT_ACCESS_REQUIRED'],
 ['non-own unadmitted director',{role:'DIRECTOR'},f=>{f.authControls.bound=true;},'PARTICIPANT_ACCESS_REQUIRED'],
 ['inactive tenant membership',{},f=>{f.authControls.membership=false;},'WORKSPACE_MEMBERSHIP_REQUIRED'],
 ['inactive project',{},f=>{f.authControls.project=false;},'WORKSPACE_PROJECT_UNAVAILABLE'],
 ['stale scope',{},f=>{f.member.role='DIRECTOR';},'WORKSPACE_CONTEXT_CHANGED'],
 ['office review-only account',{},f=>{f.authControls.officeReviewOnly=true;},'OFFICE_REVIEW_ONLY'],
 ['revoked own participant',{own:true},f=>{f.worker.metadata.participant.status='REVOKED';},'PARTICIPANT_ACCESS_REQUIRED'],
 ['inactive own worker',{own:true},f=>{f.worker.active=false;},'PARTICIPANT_ACCESS_REQUIRED'],
 ['missing own assignment',{own:true},f=>{f.authControls.assignment=false;},'WORKSPACE_PROJECT_UNAVAILABLE'],
 ['missing canonical own membership',{own:true},f=>{f.authControls.ownMembership=false;},'PARTICIPANT_ACCESS_REQUIRED'],
])test('authorization blocks '+label+' before the private reader',async()=>{
 const f=authorizedFixture(options),context=f.context();change(f);
 if(label!=='stale scope')context.scope=f.context().scope;
 const before=f.snapshot();await assert.rejects(f.store.kycChatAttempt(f.session,context),{code});assert.equal(f.authControls.adapterCalls,0);assert.equal(f.snapshot(),before);
});

test('foreign worker/project and extra direct inputs never reach the reader',async()=>{
 const f=authorizedFixture();
 for(const [context,code]of [[f.context({workerId:'worker-other'}),'PARTICIPANT_UNAVAILABLE'],[f.context({projectId:'project-other'}),'WORKSPACE_PROJECT_UNAVAILABLE'],[f.context({eventId:'customer_webhook_'+'a'.repeat(64)}),'PARTICIPANT_INPUT_INVALID'],[f.context({workerId:'../worker'}),'PARTICIPANT_INPUT_INVALID']])await assert.rejects(async()=>f.store.kycChatAttempt(f.session,context),{code});
 assert.equal(f.authControls.adapterCalls,0);
});

test('a replaced challenge rejects the old screen context before reading events',async()=>{
 const f=authorizedFixture(),context=f.context();f.challenge.id='kyc_chat_'+'b'.repeat(32);
 const before=f.snapshot();await assert.rejects(async()=>f.store.kycChatAttempt(f.session,context),{code:'WORKSPACE_CONTEXT_CHANGED',status:409});assert.equal(f.authControls.adapterCalls,0);assert.equal(f.snapshot(),before);
 const missing=f.context();delete missing.challengeId;await assert.rejects(async()=>f.store.kycChatAttempt(f.session,missing),{code:'PARTICIPANT_INPUT_INVALID'});
});

test('default-null reader stays unavailable and an injected reader cannot widen public projection',async()=>{
 const missing=authorizedFixture({reader:null});assert.deepEqual((await missing.store.kycChatAttempt(missing.session,missing.context())).kycChatAttempt,{version:1,state:'UNAVAILABLE'});
 const f=authorizedFixture({reader:async()=>({version:1,state:'UNAVAILABLE',body:'private message',phone:'+5491100001111',token:'secret'})});
 assert.deepEqual((await f.store.kycChatAttempt(f.session,f.context())).kycChatAttempt,{version:1,state:'UNAVAILABLE'});
});

const request=(params,{method='GET',headers={},body}={})=>new Request('https://obrasaas.com/api/identity/participants'+(params?'?'+params:''),{method,headers:{'Content-Type':'application/json',Origin:'https://obrasaas.com',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
test('HTTP five-key diagnostic uses canonical authorization and remains private with no scheduler',async()=>{
 const f=authorizedFixture();f.record();const params=new URLSearchParams({...f.context(),detail:'kyc-chat-attempt'}),before=f.snapshot();
 const response=await f.api.GET(request(params));assert.equal(response.status,200);const body=await response.json();assert.equal(body.kycChatAttempt.reason,'CHALLENGE_REJECTED');assert.equal(body.challengeId,f.challenge.id);assert.equal(f.snapshot(),before);
 assert.match(response.headers.get('Cache-Control'),/private.*no-store/);assert.equal(response.headers.get('Vary'),'Cookie, Authorization');assert.equal(response.headers.get('X-Robots-Tag'),'noindex, nofollow');assert.equal(response.headers.get('Referrer-Policy'),'no-referrer');
});

test('HTTP rejects duplicate, missing and cross-contract keys before authorization or diagnosis',async()=>{
 const f=authorizedFixture(),base=new URLSearchParams({...f.context(),detail:'kyc-chat-attempt'});
 for(const key of ['projectId','scope','workerId','detail','challengeId']){
  const duplicate=new URLSearchParams(base);duplicate.append(key,base.get(key));assert.equal((await f.api.GET(request(duplicate))).status,400);
  const missing=new URLSearchParams(base);missing.delete(key);assert.equal((await f.api.GET(request(missing))).status,400);
 }
 for(const [key,value]of [['after','worker-next'],['intakeAfter','customer_webhook_'+'b'.repeat(64)],['operationId','00000000-0000-4000-8000-000000000000'],['action','process_inbox'],['intakeId','customer_webhook_'+'b'.repeat(64)],['imageId','document-front'],['query','search'],['afterAccount','cursor'],['accountId','member-other'],['email','person@example.invalid'],['organizationId','company-other'],['eventId','customer_webhook_'+'b'.repeat(64)],['code','IDENTIDAD '+'x'.repeat(43)],['phone','5491100001111']]){
  const params=new URLSearchParams(base);params.append(key,value);assert.equal((await f.api.GET(request(params))).status,400,key);
 }
 for(const [key,value]of [['workerId','../worker'],['scope','wrong'],['projectId',''],['detail','kyc-other'],['challengeId','kyc_chat_short'],['challengeId','']]){const params=new URLSearchParams(base);params.set(key,value);assert.equal((await f.api.GET(request(params))).status,400);}
 assert.equal(f.authControls.adapterCalls,0);assert.equal(f.authQueries.length,0);
});

test('HTTP old challenge context returns 409 and cannot expose the new challenge attempt',async()=>{
 const f=authorizedFixture(),params=new URLSearchParams({...f.context(),detail:'kyc-chat-attempt'});f.challenge.id='kyc_chat_'+'b'.repeat(32);
 const response=await f.api.GET(request(params));assert.equal(response.status,409);assert.deepEqual(await response.json(),{saved:false,identityCertified:false,code:'WORKSPACE_CONTEXT_CHANGED'});assert.equal(f.authControls.adapterCalls,0);
});

test('challenge ID cannot extend the ordinary list, office, account discovery or bank read contracts',async()=>{
 const f=authorizedFixture(),base={projectId:f.project.id,scope:f.context().scope,challengeId:f.challenge.id};
 for(const params of [base,{...base,detail:'verified-office-account',email:'person@example.invalid'},{...base,detail:'existing-accounts',query:''},{...base,detail:'private-bank-account',workerId:f.worker.id},{...f.context(),detail:'kyc-chat-attempt',challengeId:'worker-other'}])assert.equal((await f.api.GET(request(new URLSearchParams(params)))).status,400);
 assert.equal(f.authControls.adapterCalls,0);assert.equal(f.authQueries.length,0);
});

test('HTTP diagnostic rejects unsigned, cross-site and POST invocation without side effects',async()=>{
 const f=authorizedFixture(),params=new URLSearchParams({...f.context(),detail:'kyc-chat-attempt'});
 const unsigned=createParticipantHandlers({verify:async()=>({authenticated:false}),store:{kycChatAttempt:forbidden},scheduleOnboarding:forbidden});assert.equal((await unsigned.GET(request(params))).status,401);
 assert.equal((await f.api.GET(request(params,{headers:{'Sec-Fetch-Site':'cross-site'}}))).status,403);
 assert.equal((await f.api.POST(request(params,{method:'POST',body:{action:'kyc-chat-attempt'}}))).status,403);
 assert.equal((await f.api.POST(request(null,{method:'POST',body:{...f.context(),action:'KYC_CHAT_ATTEMPT'}}))).status,400);
 assert.equal(f.authControls.adapterCalls,0);assert.equal(f.authQueries.length,0);
});
