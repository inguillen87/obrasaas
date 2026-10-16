import test from 'node:test';
import assert from 'node:assert/strict';
import {stepReminderFixture} from './fixtures/meta-kyc-step-reminder-memory.mjs';
import {unchangedMedia,rewriteContextEvent} from './fixtures/meta-kyc-context-feedback-memory.mjs';
import {participantKycStepReminder} from '../src/lib/participant-kyc-chat-copy.mjs';
import {createMetaCustomerProcessor} from '../src/lib/meta-customer-processing.mjs';
import {metaKycContextReceiptId} from '../src/lib/meta-kyc-context-feedback.mjs';
import {resolveMetaKycAuthority,META_KYC_AUTHORIZATION_CODES} from '../src/lib/meta-kyc-identity.mjs';

for(const step of ['CONSENT','BACK_CONSENT','OCR','BIOMETRIC','FRONT','BACK','SELFIE','CONFIRM'])test('unquoted corporate photo at '+step+' gets its exact next step without accepting the photo or changing the capture',async()=>{
 const t=await stepReminderFixture(step),before=structuredClone(t.f.worker),projections=[...t.f.audits.values()].filter(a=>a.action==='participant.kyc_chat.projected').length;
 const value=await t.adapter.feedback(t.context,{staleOnly:true});assert.equal(value.kind,'KYC_CONTEXT_FEEDBACK');assert.equal(value.businessApplied,false);assert.deepEqual(value.reply,participantKycStepReminder(step,t.f.target.id));assert.equal(t.requests.length,0);assert.deepEqual(t.f.worker,before);
 await t.adapter.send(t.context,value.reply);assert.equal(t.requests.length,1);assert.deepEqual(t.f.worker,before);assert.equal([...t.f.audits.values()].filter(a=>a.action==='participant.kyc_chat.projected').length,projections);assert.equal(t.f.audits.get(metaKycContextReceiptId(t.context.eventId)).metadata.replyCopyVersion,2);unchangedMedia(t.f);
 assert.deepEqual(await t.adapter.feedback(t.context,{recoverOnly:true}),value);await t.adapter.send(t.context,value.reply);assert.equal(t.requests.length,1);unchangedMedia(t.f);
 const client=await t.connect();try{await assert.rejects(()=>resolveMetaKycAuthority(client,t.context,{environment:t.f.environment}),{code:'META_KYC_NOT_APPLICABLE'});}finally{client.release();}
});

const denials=[
 ['ambiguous current captures',t=>{t.reminderControls.ambiguous=true;}],
 ['expired conversation',t=>{t.f.now.setTime(t.f.now.getTime()+31*60*1000);}],
 ['explicit foreign quote',t=>rewriteContextEvent(t,p=>{p.value.context={id:'wamid.Foreign'};})],
 ['malformed supplied context',t=>rewriteContextEvent(t,p=>{p.value.context={};})],
 ['foreign sender',t=>rewriteContextEvent(t,p=>{p.value.from='5491159999999';})],
 ['unsigned inbound',t=>{delete t.f.events.get(t.context.eventId).payload.encryptedProof;}],
 ['revoked issuer',t=>{t.f.controls.issuerActive=false;}],
 ['revoked participant',t=>{t.f.controls.workerMembershipActive=false;}],
 ['revoked project assignment',t=>{t.f.controls.projectAssignmentActive=false;}],
 ['revoked company assignment',t=>{t.f.control.assignment=false;}],
 ['owner revision changed',t=>{t.f.owner.revision++;}],
 ['expired lease',t=>{t.f.events.get(t.context.eventId).leaseExpiresAt=new Date(t.f.now.getTime()-1);}],
 ['uncertain current prompt',t=>{[...t.f.outbounds.values()].at(-1).outcome.state='SEND_UNKNOWN';}],
 ['failed current prompt',t=>{[...t.f.outbounds.values()].at(-1).outcome.providerStatus='failed';}],
 ['missing dispatch receipt',t=>{for(const[id,a]of t.f.audits)if(a.action==='participant.kyc_chat.dispatched')t.f.audits.delete(id);}],
];
function discoveryAttempt(t,{id='archived-worker',claimedOffsetMs=-31*60*1000,challengeExpired=false}={}){
 const metadata=structuredClone(t.f.worker.metadata),c=metadata.participant.kycChatChallenge,conversation=metadata.participant.kycChatConversation;
 c.id='kyc_chat_'+id;c.workerId=id;c.createdAt=new Date(t.f.now.getTime()-2*3600000).toISOString();c.claimedAt=new Date(t.f.now.getTime()+claimedOffsetMs).toISOString();c.expiresAt=new Date(t.f.now.getTime()+(challengeExpired?-1000:24*3600000)).toISOString();conversation.challengeId=c.id;conversation.expiresAt=new Date(Date.parse(c.claimedAt)+30*60*1000).toISOString();
 return {reminderWorkerId:id,projectId:t.f.target.id,metadata};
}
for(const challengeExpired of [false,true])test('one current plus one '+(challengeExpired?'challenge-expired':'conversation-expired')+' CLAIMED capture resolves only the current reminder',async()=>{
 const t=await stepReminderFixture('FRONT'),before=structuredClone(t.f.worker);t.reminderControls.extraDiscoveryRows=[discoveryAttempt(t,{challengeExpired})];
 const value=await t.adapter.feedback(t.context,{staleOnly:true});assert.equal(value?.kind,'KYC_CONTEXT_FEEDBACK');assert.deepEqual(value.reply,participantKycStepReminder('FRONT',t.f.target.id));await t.adapter.send(t.context,value.reply);assert.equal(t.requests.length,1);assert.deepEqual(t.f.worker,before);unchangedMedia(t.f);
});
test('two different current CLAIMED captures remain ambiguous without a feedback receipt',async()=>{
 const t=await stepReminderFixture('FRONT'),before=structuredClone(t.f.worker),audits=t.f.audits.size;t.reminderControls.extraDiscoveryRows=[discoveryAttempt(t,{id:'other-current-worker',claimedOffsetMs:-1000})];assert.equal(await t.adapter.feedback(t.context,{staleOnly:true}),null);assert.equal(t.f.audits.size,audits);assert.equal(t.requests.length,0);assert.deepEqual(t.f.worker,before);unchangedMedia(t.f);
});
test('only expired CLAIMED attempts never produce a reminder',async()=>{
 const t=await stepReminderFixture('FRONT'),audits=t.f.audits.size;t.reminderControls.discoveryRows=[discoveryAttempt(t),discoveryAttempt(t,{id:'second-archived-worker',challengeExpired:true})];assert.equal(await t.adapter.feedback(t.context,{staleOnly:true}),null);assert.equal(t.f.audits.size,audits);assert.equal(t.requests.length,0);unchangedMedia(t.f);
});
test('many expired attempts before the live capture do not truncate the single-snapshot discovery',async()=>{
 const t=await stepReminderFixture('FRONT');t.reminderControls.extraDiscoveryRows=Array.from({length:33},(_,index)=>discoveryAttempt(t,{id:'archived-worker-'+String(index).padStart(2,'0')}));const value=await t.adapter.feedback(t.context,{staleOnly:true});assert.equal(value?.kind,'KYC_CONTEXT_FEEDBACK');assert.equal(t.reminderControls.discoveryCalls.length,1);assert.equal(t.requests.length,0);unchangedMedia(t.f);
});
for(const [name,change]of [
 ['free date expression',c=>{c.expiresAt='tomorrow';}],
 ['impossible calendar date',c=>{c.expiresAt='2026-02-31T12:00:00.000Z';}],
 ['noncanonical time zone',c=>{c.expiresAt='2026-10-16T12:00:00.000-03:00';}],
 ['missing challenge instant',c=>{delete c.claimedAt;}],
 ['conversation deadline not derived from claim',(_c,s)=>{s.expiresAt='2020-01-01T00:00:00.000Z';}],
])test('malformed discovery date fails closed instead of discarding an unproved expired attempt: '+name,async()=>{
 const t=await stepReminderFixture('FRONT'),other=discoveryAttempt(t),audits=t.f.audits.size;change(other.metadata.participant.kycChatChallenge,other.metadata.participant.kycChatConversation);t.reminderControls.extraDiscoveryRows=[other];assert.equal(await t.adapter.feedback(t.context,{staleOnly:true}),null);assert.equal(t.f.audits.size,audits);assert.equal(t.requests.length,0);unchangedMedia(t.f);
});
for(const [name,change]of denials)test('unquoted reminder denies '+name+' before reserving any reply',async()=>{
 const t=await stepReminderFixture('FRONT');change(t);const before=structuredClone(t.f.worker),audits=t.f.audits.size,outbounds=t.f.outbounds.size;
 assert.equal(await t.adapter.feedback(t.context,{staleOnly:true}),null);assert.deepEqual(t.f.worker,before);assert.equal(t.f.audits.size,audits);assert.equal(t.f.outbounds.size,outbounds);assert.equal(t.requests.length,0);unchangedMedia(t.f);
});
test('unquoted reminder records once and sends at most once under concurrent delivery',async()=>{
 const t=await stepReminderFixture('BACK'),before=structuredClone(t.f.worker),[a,b]=await Promise.all([t.adapter.feedback(t.context,{staleOnly:true}),t.adapter.feedback(t.context,{staleOnly:true})]);assert.deepEqual(a,b);await Promise.all([t.adapter.send(t.context,a.reply),t.adapter.send(t.context,b.reply)]);assert.equal(t.requests.length,1);assert.equal([...t.f.audits.values()].filter(a=>a.action==='participant.kyc_chat.context_feedback').length,1);assert.deepEqual(t.f.worker,before);unchangedMedia(t.f);
});
test('an invited person receives a reminder without an invented membership, account claim or media capture',async()=>{
 const t=await stepReminderFixture('FRONT',{active:false}),before=structuredClone(t.f.worker),value=await t.adapter.feedback(t.context,{staleOnly:true});assert.equal(value.kind,'KYC_CONTEXT_FEEDBACK');await t.adapter.send(t.context,value.reply);assert.equal(t.requests.length,1);assert.deepEqual(t.f.worker,before);assert.equal(t.f.worker.metadata.participant.status,'INVITED');assert.equal(t.f.identityCalls.verifiedEmail,0);assert.equal(t.f.identityCalls.findInvitation,0);unchangedMedia(t.f);
});
test('a lost HTTP acknowledgement keeps the reminder uncertain and never repeats its POST',async()=>{
 const t=await stepReminderFixture('SELFIE'),value=await t.adapter.feedback(t.context,{staleOnly:true});t.reminderControls.loseAck=true;const first=await t.adapter.send(t.context,value.reply);assert.equal(first.state,'SEND_UNKNOWN');assert.equal(first.replySent,false);assert.equal(t.requests.length,1);t.reminderControls.loseAck=false;const previous=await t.adapter.feedback(t.context,{recoverOnly:true});await t.adapter.send(t.context,previous.reply);assert.equal(t.requests.length,1);unchangedMedia(t.f);
});
test('a recorded reminder cannot send another step, project or arbitrary text',async()=>{
 const t=await stepReminderFixture('FRONT'),value=await t.adapter.feedback(t.context,{staleOnly:true});await assert.rejects(()=>t.adapter.send(t.context,{...value.reply,body:'Arbitrary text'}),{code:'META_KYC_CONTEXT_FEEDBACK_DENIED'});await assert.rejects(()=>t.adapter.send(t.context,participantKycStepReminder('SELFIE',t.f.target.id)),{code:'META_KYC_CONTEXT_FEEDBACK_DENIED'});assert.equal(t.requests.length,0);unchangedMedia(t.f);
});
test('the live conversation deadline crossing during provider await prevents the reminder POST',async()=>{
 const t=await stepReminderFixture('FRONT'),deadline=Date.parse(t.f.state().expiresAt);t.reminderControls.extraDiscoveryRows=[discoveryAttempt(t)];t.f.now.setTime(deadline-1000);t.f.events.get(t.context.eventId).leaseExpiresAt=new Date(deadline+60000);
 const value=await t.adapter.feedback(t.context,{staleOnly:true});assert.equal(value.kind,'KYC_CONTEXT_FEEDBACK');t.reminderControls.afterFirstFence=()=>t.f.now.setTime(deadline);
 await assert.rejects(()=>t.adapter.send(t.context,value.reply),{code:'META_KYC_CONTEXT_FEEDBACK_DENIED'});assert.equal(t.requests.length,0);unchangedMedia(t.f);
});
for(const [name,change]of [['issuer revoked',t=>{t.f.controls.issuerActive=false;}],['capture step changed',async t=>{await t.f.choose('Autorizar imágenes');}],['current prompt failed',t=>{[...t.f.outbounds.values()].filter(out=>out.payload.kycContextFeedback!==true).at(-1).outcome.providerStatus='failed';}]])test('reminder revalidates '+name+' after reservation before provider I/O',async()=>{
 const t=await stepReminderFixture(),value=await t.adapter.feedback(t.context,{staleOnly:true});t.reminderControls.afterFirstFence=()=>change(t);await assert.rejects(()=>t.adapter.send(t.context,value.reply));assert.equal(t.requests.length,0);unchangedMedia(t.f);
});
test('actual processor intercepts an unquoted corporate photo before generic intake, capture or FIELD dispatch',async()=>{
 const t=await stepReminderFixture('FRONT'),f=t.f,event=f.events.get(t.context.eventId),before=structuredClone(f.worker);event.leaseToken=null;event.leaseExpiresAt=null;event.attempts=0;let dispatches=0;
 const connect=async()=>{const c=await t.connect();return {release:()=>c.release(),query:async(sql,args=[])=>{
  if(sql.startsWith('UPDATE public."WebhookEvent" SET "leaseToken"=$2')&&f.events.has(args[0])){const row=f.events.get(args[0]);row.leaseToken=args[1];row.leaseExpiresAt=args[2];return {rows:[],rowCount:1};}
  if(sql.startsWith('UPDATE public."WebhookEvent" SET status=\'PROCESSED\'')&&f.events.has(args[0])){const row=f.events.get(args[0]);row.status='PROCESSED';row.outcome=JSON.parse(args[3]);row.leaseToken=null;return {rows:[],rowCount:1};}
  return c.query(sql,args);
 }};};
 const processor=createMetaCustomerProcessor({connect,environment:f.environment,now:()=>f.now.getTime(),authorizationCodes:[...META_KYC_AUTHORIZATION_CODES,'META_KYC_CONTEXT_FEEDBACK_DENIED'],contextKyc:t.adapter.feedback,dispatch:async()=>{dispatches++;throw new Error('Generic dispatch must not run');},outbound:{send:(context,reply,{purpose})=>{assert.equal(purpose,'KYC_CONTEXT_FEEDBACK');return t.adapter.send(context,reply);}}});
 const value=await processor.process(event.id);assert.equal(value.processed,true);assert.equal(value.kind,'KYC_CONTEXT_FEEDBACK');assert.equal(value.replySent,true);assert.equal(dispatches,0);assert.equal(t.requests.length,1);assert.deepEqual(f.worker,before);assert.equal((await processor.process(event.id)).done,true);unchangedMedia(f);
});
