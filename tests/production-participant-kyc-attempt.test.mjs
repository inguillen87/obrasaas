import test from 'node:test';
import assert from 'node:assert/strict';
import {kycMemoryFixture} from './fixtures/meta-kyc-chat-memory.mjs';
import {createParticipantKycChatAttemptReader,publicParticipantKycChatAttempt} from '../src/lib/participant-kyc-chat-attempt.mjs';
import {createParticipantStore} from '../src/lib/participant-store.mjs';
import {createParticipantHandlers} from '../src/lib/participant-http.mjs';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
import {scopeStamp,digest} from '../src/lib/workspace-policy.mjs';
import {encryptCustomerSecret,decryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {metaCustomerContentDigest} from '../src/lib/meta-customer-callback.mjs';
import {customerOutboundId} from '../src/lib/meta-customer-outbound.mjs';
import {metaKycDispatchReceiptId} from '../src/lib/meta-kyc-identity.mjs';
import {META_KYC_REJECTION_REPLY} from '../src/lib/meta-kyc-rejection.mjs';
import {companyKycProjectionDigest,companyKycProjectionId} from '../src/lib/company-channel-kyc.mjs';

// Real signed-envelope decoding and canonical authorization over synthetic SQL.
// These units exercise neither PostgreSQL concurrency nor real Meta delivery.
const result=rows=>({rows:structuredClone(rows),rowCount:rows.length});
const forbidden=()=>assert.fail('The diagnostic must not call a provider, storage, write, or scheduler');
const publicKeys=['codeMatch','codeSyntax','preparationReceiptMatch','processingState','reason','receivedAt','rejected','replyDelivery','sameSecond','senderMatch','state','version'].sort();

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
 const queries=[],controls={eventRows:null,outboundRows:null,statusRows:null};let sequence=0;
 const client={async query(sql,args=[]){
  queries.push({sql,args});assert.match(sql,/^SELECT\b/,'Adapter SQL must be read-only');
  if(sql==='SELECT clock_timestamp() AS now')return result([{now:f.now}]);
  if(sql.includes('FROM public."WhatsAppConnection"'))return result(args[0]===f.connection.id&&args[1]===f.connection.projectId&&args[2]===f.connection.organizationId?[f.connection]:[]);
  if(sql.includes('FROM public."WebhookEvent"')){
   if(sql.includes("provider='meta-customer-outbound-v1'")){
    assert.equal(args[1],f.connection.projectId);assert.equal(args[2],f.issuer.organizationId);assert.equal(args[3],f.connection.id);assert.match(sql,/LIMIT 2$/);
    return result(controls.outboundRows===null?[...f.outbounds.values()].filter(e=>e.id===args[0]&&e.projectId===args[1]&&e.provider==='meta-customer-outbound-v1'&&e.payload.organizationId===args[2]&&e.payload.channelId===args[3]):controls.outboundRows);
   }
   if(sql.includes("\"eventType\"='message_status'")){
    assert.equal(args[1],f.connection.projectId);assert.equal(args[2],f.issuer.organizationId);assert.equal(args[3],f.connection.id);assert.match(sql,/LIMIT 2$/);
    return result(controls.statusRows===null?[...f.events.values()].filter(e=>e.id===args[0]&&e.projectId===args[1]&&e.provider==='meta-customer-v1'&&e.eventType==='message_status'&&e.payload.organizationId===args[2]&&e.payload.channelId===args[3]):controls.statusRows);
   }
   assert.deepEqual(args,[f.connection.projectId,f.issuer.organizationId,f.connection.id]);
   assert.match(sql,/provider='meta-customer-v1'/);assert.match(sql,/"eventType"='message'/);assert.match(sql,/LIMIT 20$/);
   if(controls.eventRows!==null)return result(controls.eventRows);
   return result([...f.events.values()].filter(e=>e.projectId===args[0]&&e.provider==='meta-customer-v1'&&e.eventType==='message'&&e.payload.organizationId===args[1]&&e.payload.channelId===args[2]).sort((a,b)=>b.createdAt-a.createdAt||b.id.localeCompare(a.id)).slice(0,20));
  }
  if(sql.includes('FROM public."AuditLog"')){
   if(sql.includes("action='participant.kyc_chat.projected'")){assert.equal(args[1],f.issuer.organizationId);assert.equal(args[2],f.worker.id);return result([...f.audits.values()].filter(a=>a.id===args[0]&&a.organizationId===args[1]&&a.entityType==='Worker'&&a.entityId===args[2]&&a.action==='participant.kyc_chat.projected'));}
   if(sql.includes('action=$5'))return result([...f.audits.values()].filter(a=>a.id===args[0]&&a.organizationId===args[1]&&a.entityType===args[2]&&a.entityId===args[3]&&a.action===args[4]));
   assert.deepEqual(args,[f.issuer.organizationId,challenge.issuerActorId,f.worker.id,challenge.id]);
   return result([...f.audits.values()].filter(a=>a.organizationId===args[0]&&a.actorId===args[1]&&a.entityType==='Worker'&&a.entityId===args[2]&&a.action==='participant.kyc_chat.prepared'&&a.metadata.challengeId===args[3]).slice(0,2));
  }
  assert.fail('Unexpected diagnostic SQL: '+sql);
 }};
 const seal=(event,payload)=>{
  const aad={organizationId:f.connection.organizationId,projectId:event.projectId,resourceId:event.id},payloadDigest=metaCustomerContentDigest(payload);
  event.payload={channelId:f.connection.id,organizationId:f.connection.organizationId,payloadDigest,signatureVerified:true,signatureScheme:'meta-hmac-sha256-v1',encryptedPayload:encryptCustomerSecret(JSON.stringify(payload),{...aad,purpose:'webhook'},f.environment),encryptedProof:encryptCustomerSecret(JSON.stringify({scheme:'meta-hmac-sha256-v1',purpose:'CUSTOMER',appId:f.environment.NEXT_PUBLIC_META_APP_ID,payloadDigest,organizationId:f.connection.organizationId,channelId:f.connection.id}),{...aad,purpose:'webhook-proof'},f.environment)};
 };
 const reply=(event,{purpose='KYC_REJECTION',state='SENT'}={})=>{
  const source=JSON.parse(decryptCustomerSecret(event.payload.encryptedPayload,{organizationId:f.connection.organizationId,projectId:event.projectId,purpose:'webhook',resourceId:event.id},f.environment)),id=customerOutboundId(event.id),rejection=purpose==='KYC_REJECTION',actorId=f.issuer.actorId;
  const message=rejection?META_KYC_REJECTION_REPLY:{type:'text',body:'Synthetic private KYC consent prompt, never an identity approval.'},request={version:1,eventId:event.id,payloadDigest:event.payload.payloadDigest,channelId:f.connection.id,organizationId:f.connection.organizationId,to:source.value.from,replyTo:source.value.id,message,channelPurpose:purpose,...(!rejection?{challengeId:challenge.id}: {})};
  const reservedAt=new Date(Number(source.value.timestamp)*1000+1000).toISOString(),completedAt=new Date(Date.parse(reservedAt)+1000).toISOString();f.now.setTime(Date.parse(completedAt)+1000);
  if(company&&!rejection){
   const projection={version:1,kind:'COMPANY_KYC_CAPTURE',sourceEventId:event.id,payloadDigest:event.payload.payloadDigest,organizationId:f.connection.organizationId,connectionId:f.connection.id,anchorProjectId:f.connection.projectId,targetProjectId:f.project.id,workerId:f.worker.id,challengeId:challenge.id,ownerRevision:1,assignmentRevision:1,grantDigest:'a'.repeat(64),issuerActorId:actorId,issuerMembershipId:f.issuer.membershipId,authorityDigest:'b'.repeat(64),participantActorId:null,participantMembershipId:null,participantClerkUserId:null};
   request.targetProjectId=f.project.id;request.companyKycDigest=companyKycProjectionDigest(projection);
   const projectionId=companyKycProjectionId(event.id);f.audits.set(projectionId,{id:projectionId,organizationId:f.connection.organizationId,actorId,entityType:'Worker',entityId:f.worker.id,action:'participant.kyc_chat.projected',metadata:projection});
  }
  const auditId=rejection?'meta_kyc_rejection_'+digest(['meta-kyc-rejection-v1',event.id]):metaKycDispatchReceiptId(event.id),recorded={kind:rejection?'KYC_REJECTION':'KYC_CHAT',identityStatus:rejection?'CHANNEL_IDENTITY_UNVERIFIED':'LIMITED_KYC_UPLOAD',businessApplied:false,replySent:false,reply:message,...(rejection?{code:'META_KYC_CHALLENGE_REJECTED'}:{})},aad={organizationId:f.connection.organizationId,projectId:f.connection.projectId};
  f.audits.set(auditId,{id:auditId,organizationId:f.connection.organizationId,actorId,entityType:rejection?'WebhookEvent':'Worker',entityId:rejection?event.id:f.worker.id,action:rejection?'participant.kyc_chat.rejected':'participant.kyc_chat.dispatched',metadata:{version:1,projectId:rejection?f.connection.projectId:f.project.id,payloadDigest:event.payload.payloadDigest,replyDigest:digest(message),...(rejection?{channelId:f.connection.id,code:'META_KYC_CHALLENGE_REJECTED'}:{challengeId:challenge.id}),encryptedResult:encryptCustomerSecret(JSON.stringify(recorded),{...aad,purpose:rejection?'kyc-rejection':'kyc-chat-dispatch',resourceId:auditId},f.environment)}});
  const out={id,projectId:f.connection.projectId,provider:'meta-customer-outbound-v1',eventType:'reply',status:state==='SEND_STARTED'?'PENDING':'PROCESSED',payload:{version:1,eventId:event.id,organizationId:f.connection.organizationId,channelId:f.connection.id,requestDigest:digest(request),encryptedPayload:encryptCustomerSecret(JSON.stringify(request),{...aad,purpose:'outbound',resourceId:id},f.environment),...(rejection?{kycRejection:true}:{kycCapture:true,challengeId:challenge.id})},outcome:{version:1,state,actorId,reservedAt,...(state==='SEND_STARTED'?{}:{completedAt,messageId:state==='SENT'?'wamid.syntheticreply123456':null})}};f.outbounds.set(id,out);return out;
 };
 const rewriteReply=(out,change)=>{const aad={organizationId:f.connection.organizationId,projectId:f.connection.projectId,purpose:'outbound',resourceId:out.id},request=JSON.parse(decryptCustomerSecret(out.payload.encryptedPayload,aad,f.environment));change(request);out.payload.requestDigest=digest(request);out.payload.encryptedPayload=encryptCustomerSecret(JSON.stringify(request),aad,f.environment);};
 const statusReply=(out,status='delivered')=>{
  const request=JSON.parse(decryptCustomerSecret(out.payload.encryptedPayload,{organizationId:f.connection.organizationId,projectId:f.connection.projectId,purpose:'outbound',resourceId:out.id},f.environment)),id='customer_webhook_'+digest(['synthetic-kyc-delivery',out.id,status,++sequence]),timestamp=Math.floor(f.now.getTime()/1000);
  const event={id,projectId:f.connection.projectId,provider:'meta-customer-v1',eventType:'message_status',status:'PROCESSED'},payload={wabaId:f.connection.whatsappBusinessId,phoneNumberId:f.connection.phoneNumberId,field:'messages',type:'message_status',value:{id:out.outcome.messageId||'wamid.syntheticreply123456',recipient_id:request.to,biz_opaque_callback_data:out.id,status,timestamp:String(timestamp)}};seal(event,payload);f.events.set(id,event);out.status='PROCESSED';Object.assign(out.outcome,{state:'STATUS_OBSERVED',providerStatus:status,messageId:payload.value.id,statusEventId:id,statusObservedAt:f.now.toISOString()});return event;
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
 return {...f,challenge,client,queries,readControls:controls,reader,read,record,rewrite,reply,rewriteReply,statusReply,snapshot,assertPrivate};
}

test('current signed rejected attempt is observed twice without effects or private material',async()=>{
 const f=attemptFixture();f.record();const before=f.snapshot(),first=await f.read(),second=await f.read();
 assert.deepEqual(second,first);assert.equal(f.snapshot(),before);f.assertPrivate(first);
 assert.deepEqual(first,{version:1,state:'OBSERVED',receivedAt:'2026-10-10T20:00:01.000Z',processingState:'PROCESSED',rejected:true,reason:'CHALLENGE_REJECTED',codeSyntax:true,codeMatch:true,senderMatch:true,preparationReceiptMatch:true,sameSecond:false,replyDelivery:{version:1,state:'NOT_OBSERVED',recordedAt:null}});
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

for(const [stored,state]of [['SEND_STARTED','RESERVED'],['SEND_UNKNOWN','SEND_UNKNOWN'],['SENT','API_ACCEPTED'],['REJECTED','API_REJECTED']])test('sealed '+stored+' is a bounded observation and never a delivery claim',async()=>{
 const f=attemptFixture(),event=f.record(),out=f.reply(event,{state:stored}),before=f.snapshot(),value=await f.read();
 assert.deepEqual(value.replyDelivery,{version:1,state,recordedAt:stored==='SEND_STARTED'?out.outcome.reservedAt:out.outcome.completedAt});assert.equal(f.snapshot(),before);f.assertPrivate(value);assert.deepEqual(await f.read(),value);
});
for(const status of ['sent','delivered','read','failed','deleted'])test('only the exact signed '+status+' event credits that reply',async()=>{
 const f=attemptFixture(),event=f.record(),out=f.reply(event),signed=f.statusReply(out,status),before=f.snapshot(),value=await f.read();
 assert.equal(value.replyDelivery.state,{sent:'API_ACCEPTED',delivered:'DELIVERED',read:'READ',failed:'FAILED',deleted:'FAILED'}[status]);
 const payload=JSON.parse(decryptCustomerSecret(signed.payload.encryptedPayload,{organizationId:f.connection.organizationId,projectId:signed.projectId,purpose:'webhook',resourceId:signed.id},f.environment));
 assert.equal(value.replyDelivery.recordedAt,new Date(Number(payload.value.timestamp)*1000).toISOString());assert.equal(f.snapshot(),before);f.assertPrivate(value);
});
test('delivery time is the provider signed instant rather than database observation time',async()=>{
 const f=attemptFixture(),event=f.record(),out=f.reply(event);f.statusReply(out,'delivered');const value=await f.read();f.now.setTime(f.now.getTime()+5000);out.outcome.statusObservedAt=f.now.toISOString();
 assert.deepEqual((await f.read()).replyDelivery,value.replyDelivery);assert.notEqual(value.replyDelivery.recordedAt,out.outcome.statusObservedAt);
});
test('signed sent confirms acceptance with the server observation instant without claiming delivery',async()=>{
 const f=attemptFixture(),event=f.record(),out=f.reply(event);f.statusReply(out,'sent');f.now.setTime(f.now.getTime()+5000);out.outcome.statusObservedAt=f.now.toISOString();
 const value=await f.read();assert.deepEqual(value.replyDelivery,{version:1,state:'API_ACCEPTED',recordedAt:out.outcome.statusObservedAt});f.assertPrivate(value);
});
test('API acceptance and completed inbound processing alone never become DELIVERED or READ',async()=>{
 const f=attemptFixture(),event=f.record();Object.assign(event.outcome,{replySent:true,replyState:'SENT'});assert.equal((await f.read()).replyDelivery.state,'NOT_OBSERVED');
 const out=f.reply(event);assert.equal((await f.read()).replyDelivery.state,'API_ACCEPTED');out.outcome.providerStatus='read';assert.equal((await f.read()).replyDelivery.state,'UNAVAILABLE');
 out.outcome.state='STATUS_OBSERVED';out.outcome.statusEventId='customer_webhook_'+'c'.repeat(64);out.outcome.statusObservedAt=f.now.toISOString();assert.equal((await f.read()).replyDelivery.state,'UNAVAILABLE');
});
for(const [label,change]of [
 ['another outgoing event',f=>{f.readControls.outboundRows=[{...f.out, id:customerOutboundId('customer_webhook_'+'c'.repeat(64))}];}],
 ['another company',f=>{f.readControls.outboundRows=[{...f.out,payload:{...f.out.payload,organizationId:'company-other'}}];}],
 ['another channel',f=>{f.readControls.outboundRows=[{...f.out,payload:{...f.out.payload,channelId:'connection-other'}}];}],
 ['another anchor',f=>{f.readControls.outboundRows=[{...f.out,projectId:'project-other'}];}],
 ['another provider',f=>{f.out.provider='meta-demo-pilot-v1';f.readControls.outboundRows=[f.out];}],
 ['a template',f=>{f.out.eventType='template';}],
 ['another signed source digest',f=>{f.rewriteReply(f.out,r=>{r.payloadDigest='c'.repeat(64);});}],
 ['another source event',f=>{f.rewriteReply(f.out,r=>{r.eventId='customer_webhook_'+'c'.repeat(64);});}],
 ['another original recipient',f=>{f.rewriteReply(f.out,r=>{r.to='5491100009999';});}],
 ['another original message',f=>{f.rewriteReply(f.out,r=>{r.replyTo='wamid.anothermessage123456';});}],
 ['an ordinary field reply',f=>{f.rewriteReply(f.out,r=>{r.channelPurpose='FIELD';});}],
 ['edited sealed reply',f=>{f.rewriteReply(f.out,r=>{r.message={type:'text',body:'Synthetic different private message.'};});}],
 ['corrupt ciphertext',f=>{f.out.payload.encryptedPayload='corrupt';}],
 ['edited request digest',f=>{f.out.payload.requestDigest='c'.repeat(64);}],
 ['duplicate outgoing rows',f=>{f.readControls.outboundRows=[f.out,structuredClone(f.out)];}],
])test('reply subject integrity rejects '+label+' without private output or effects',async()=>{
 const f=attemptFixture(),event=f.record();f.out=f.reply(event);change(f);const before=f.snapshot(),value=await f.read();assert.deepEqual(value.replyDelivery,{version:1,state:'UNAVAILABLE',recordedAt:null});assert.equal(f.snapshot(),before);f.assertPrivate(value);
});
for(const [label,change]of [
 ['missing sealed dispatch',f=>{f.audits.delete(f.audit.id);}],
 ['another dispatch actor',f=>{f.audit.actorId='actor-other';}],
 ['another dispatch digest',f=>{f.audit.metadata.payloadDigest='c'.repeat(64);}],
 ['edited dispatch reply digest',f=>{f.audit.metadata.replyDigest='c'.repeat(64);}],
 ['corrupt dispatch',f=>{f.audit.metadata.encryptedResult='corrupt';}],
])test('outgoing summary cannot bypass '+label,async()=>{
 const f=attemptFixture(),event=f.record();f.reply(event);f.audit=[...f.audits.values()].find(a=>a.action==='participant.kyc_chat.rejected');change(f);const before=f.snapshot();assert.equal((await f.read()).replyDelivery.state,'UNAVAILABLE');assert.equal(f.snapshot(),before);
});
for(const [label,change]of [
 ['missing proof',f=>{f.signed.payload.encryptedProof=null;}],
 ['a signature boolean alone',f=>{f.signed.payload.encryptedProof='corrupt';}],
 ['another opaque outbound reference',f=>f.rewrite(f.signed,p=>{p.value.biz_opaque_callback_data='customer_outbound_'+'c'.repeat(64);})],
 ['another provider message',f=>f.rewrite(f.signed,p=>{p.value.id='wamid.anotherreply123456';})],
 ['another recipient',f=>f.rewrite(f.signed,p=>{p.value.recipient_id='5491100009999';})],
 ['another verdict',f=>f.rewrite(f.signed,p=>{p.value.status='read';})],
 ['another WABA',f=>f.rewrite(f.signed,p=>{p.wabaId='990000011';})],
 ['another phone asset',f=>f.rewrite(f.signed,p=>{p.phoneNumberId='990000011';})],
 ['another company',f=>{f.signed.payload.organizationId='company-other';f.readControls.statusRows=[f.signed];}],
 ['another channel',f=>{f.signed.payload.channelId='connection-other';f.readControls.statusRows=[f.signed];}],
 ['another anchor',f=>{f.signed.projectId='project-other';f.readControls.statusRows=[f.signed];}],
 ['another provider',f=>{f.signed.provider='meta-demo-pilot-v1';f.readControls.statusRows=[f.signed];}],
 ['a message rather than status',f=>{f.signed.eventType='message';f.readControls.statusRows=[f.signed];}],
 ['a status preceding its source',f=>f.rewrite(f.signed,p=>{p.value.timestamp=String(Math.floor(Date.parse(f.challenge.createdAt)/1000));})],
 ['a status in the future',f=>f.rewrite(f.signed,p=>{p.value.timestamp=String(Math.floor(f.now.getTime()/1000)+61);})],
 ['a malformed signed timestamp',f=>f.rewrite(f.signed,p=>{p.value.timestamp='later';})],
 ['missing status row',f=>{f.readControls.statusRows=[];}],
 ['duplicate status rows',f=>{f.readControls.statusRows=[f.signed,structuredClone(f.signed)];}],
])test('signed delivery correlation rejects '+label,async()=>{
 const f=attemptFixture(),event=f.record(),out=f.reply(event);f.signed=f.statusReply(out);change(f);const before=f.snapshot(),value=await f.read();assert.equal(value.replyDelivery.state,'UNAVAILABLE');assert.equal(f.snapshot(),before);f.assertPrivate(value);
});
for(const company of [false,true])test((company?'corporate':'project')+' capture response is bound to current worker and challenge',async()=>{
 const f=attemptFixture({company}),event=f.record(f.code,{rejected:false}),out=f.reply(event,{purpose:'KYC_CAPTURE'});f.statusReply(out,'read');const before=f.snapshot(),value=await f.read();assert.equal(value.replyDelivery.state,'READ');assert.equal(f.snapshot(),before);f.assertPrivate(value);
 f.rewriteReply(out,r=>{r.challengeId='kyc_chat_'+'c'.repeat(32);});assert.equal((await f.read()).replyDelivery.state,'UNAVAILABLE');
});
test('corporate capture cannot substitute a target worker/project/projection while generic rejection needs no worker projection',async()=>{
 const f=attemptFixture({company:true}),event=f.record(f.code,{rejected:false}),out=f.reply(event,{purpose:'KYC_CAPTURE'}),projection=f.audits.get(companyKycProjectionId(event.id));
 for(const key of ['targetProjectId','workerId','challengeId','sourceEventId']){const previous=projection.metadata[key];projection.metadata[key]=key==='sourceEventId'?'customer_webhook_'+'c'.repeat(64):'foreign-'+key;assert.equal((await f.read()).replyDelivery.state,'UNAVAILABLE');projection.metadata[key]=previous;}
 f.rewriteReply(out,r=>{r.companyKycDigest='c'.repeat(64);});assert.equal((await f.read()).replyDelivery.state,'UNAVAILABLE');
 const g=attemptFixture({company:true}),rejected=g.record();g.reply(rejected);assert.equal((await g.read()).replyDelivery.state,'API_ACCEPTED');assert.equal(g.queries.some(q=>q.sql.includes("action='participant.kyc_chat.projected'")),false);
});
test('same-second ambiguity never queries an outgoing record or accredits either tied reply',async()=>{
 const f=attemptFixture(),start=Math.floor(f.now.getTime()/1000),first=f.record(f.code,{timestamp:start+2});f.reply(first);f.record('IDENTIDAD short',{timestamp:start+2});const value=await f.read();assert.equal(value.sameSecond,true);assert.deepEqual(value.replyDelivery,{version:1,state:'UNAVAILABLE',recordedAt:null});assert.equal(f.queries.some(q=>q.sql.includes("provider='meta-customer-outbound-v1'")),false);
});
test('a newer signed attempt cannot inherit the accepted or delivered reply of an earlier message',async()=>{
 const f=attemptFixture(),start=Math.floor(f.now.getTime()/1000),first=f.record(f.code,{timestamp:start+2}),out=f.reply(first);f.statusReply(out,'delivered');assert.equal((await f.read()).replyDelivery.state,'DELIVERED');
 f.record('IDENTIDAD '+'z'.repeat(43),{timestamp:start+4});const before=f.snapshot(),queries=f.queries.length,value=await f.read();assert.equal(value.reason,'CODE_MISMATCH');assert.deepEqual(value.replyDelivery,{version:1,state:'NOT_OBSERVED',recordedAt:null});assert.equal(f.queries.slice(queries).some(q=>q.sql.includes("\"eventType\"='message_status'")),false);assert.equal(f.snapshot(),before);f.assertPrivate(value);
});
test('API marker chronology and impossible or future server instants never manufacture acceptance',async()=>{
 for(const change of [out=>{out.outcome.completedAt='2026-02-31T20:00:03.000Z';},out=>{out.outcome.completedAt=new Date(Date.parse(out.outcome.reservedAt)-1).toISOString();},out=>{out.outcome.completedAt=new Date(Date.parse(out.outcome.reservedAt)+65000).toISOString();},out=>{out.outcome.messageId=null;}]){const f=attemptFixture(),event=f.record(),out=f.reply(event);change(out);assert.equal((await f.read()).replyDelivery.state,'UNAVAILABLE');}
});
test('closed reply window is observed only for that processed source with no outgoing reservation',async()=>{
 const f=attemptFixture(),event=f.record();Object.assign(event.outcome,{replyWindowClosed:true,replyState:'META_CUSTOMER_REPLY_WINDOW_CLOSED'});
 assert.equal((await f.read()).replyDelivery.state,'NOT_OBSERVED');f.now.setTime(f.now.getTime()+86401000);assert.deepEqual((await f.read()).replyDelivery,{version:1,state:'WINDOW_CLOSED',recordedAt:null});
});
test('delivery projection keeps legacy omission and strips nested private material with strict UTC timestamps',async()=>{
 const f=attemptFixture();f.record();const observed=await f.read(),legacy={...observed};delete legacy.replyDelivery;assert.equal(Object.hasOwn(publicParticipantKycChatAttempt(legacy),'replyDelivery'),false);
 const value=publicParticipantKycChatAttempt({...observed,replyDelivery:{version:1,state:'API_ACCEPTED',recordedAt:'2026-10-10T20:00:02.000Z',phone:f.worker.phone,code:f.code,message:'private',hash:f.challenge.codeDigest}});assert.deepEqual(Object.keys(value.replyDelivery).sort(),['version','state','recordedAt'].sort());f.assertPrivate(value);
 for(const replyDelivery of [null,[],{version:2,state:'READ',recordedAt:'2026-10-10T20:00:02.000Z'},{version:1,state:'FORGED',recordedAt:null},{version:1,state:'DELIVERED',recordedAt:null},{version:1,state:'READ',recordedAt:'2026-02-31T20:00:02.000Z'},{version:1,state:'READ',recordedAt:'2026-10-10T17:00:02.000-03:00'},{version:1,state:'READ',recordedAt:'2026-10-10T20:00:02Z'},{version:1,state:'NOT_OBSERVED',recordedAt:'2026-10-10T20:00:02.000Z'}])assert.throws(()=>publicParticipantKycChatAttempt({...observed,replyDelivery}),{code:'PARTICIPANT_KYC_ATTEMPT_UNAVAILABLE'});
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
test('revoked canonical ownership blocks a previously verified delivery before any private outbox query',async()=>{
 const f=authorizedFixture({own:true}),event=f.record(),out=f.reply(event);f.statusReply(out,'read');const context=f.context(),observed=await f.store.kycChatAttempt(f.session,context);assert.equal(observed.kycChatAttempt.replyDelivery.state,'READ');
 const queries=f.queries.length,privateCalls=f.authControls.adapterCalls,before=f.snapshot();f.authControls.membership=false;await assert.rejects(f.store.kycChatAttempt(f.session,context),{code:'WORKSPACE_MEMBERSHIP_REQUIRED'});assert.equal(f.authControls.adapterCalls,privateCalls);assert.equal(f.queries.length,queries);assert.equal(f.snapshot(),before);
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
