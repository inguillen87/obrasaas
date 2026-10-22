import test from 'node:test';
import assert from 'node:assert/strict';
import {stepReminderFixture} from './fixtures/meta-kyc-step-reminder-memory.mjs';
import {unchangedMedia,rewriteContextEvent} from './fixtures/meta-kyc-context-feedback-memory.mjs';
import {createMetaKycContextFeedback,metaKycContextReceiptId} from '../src/lib/meta-kyc-context-feedback.mjs';
import {createMetaCustomerProvider} from '../src/lib/meta-customer-provider.mjs';
import {createMetaCustomerProductionProcessor} from '../src/lib/meta-customer-processing.mjs';
import {META_KYC_AUTHORIZATION_CODES,resolveMetaKycStepReminderAuthority,metaKycContextAuthorityDigest} from '../src/lib/meta-kyc-identity.mjs';
import {participantKycStepGuidance} from '../src/lib/participant-kyc-chat-copy.mjs';
import {customerOutboundId} from '../src/lib/meta-customer-outbound.mjs';

// Complete signed corporate fixture and canonical production adapters. SQL is
// an explicit memory protocol; the Graph serializer only reaches this closed
// fetch implementation. No account, document, provider or database is real.
async function fixture(step='FRONT',command='HOLA',options={}){
 const t=await stepReminderFixture(step,options),requests=[],controls={loseAck:false,afterFirstFence:null,providerGuardCompleted:0};
 rewriteContextEvent(t,p=>{p.value.type='text';delete p.value.image;delete p.value.context;p.value.text={body:command};});
 const actual=createMetaCustomerProvider({environment:t.f.environment,now:()=>t.f.now.getTime(),fetchImpl:async(url,input)=>{
  assert.equal(new URL(url).hostname,'graph.facebook.com');assert.equal(input.method,'POST');assert.equal(new URL(url).pathname,'/'+t.f.environment.META_GRAPH_API_VERSION+'/'+t.f.connection.phoneNumberId+'/messages');
  const body=JSON.parse(input.body);assert.equal(body.type,'text');assert.equal(body.to,t.f.worker.phone.slice(1));assert.match(body.context.message_id,/^wamid\./);assert.match(body.text.body,/^Tu intento de identidad sigue vigente\./);requests.push(body);
  if(controls.loseAck)throw Error('Synthetic accepted guidance send with lost ACK');
  return Response.json({messages:[{id:'wamid.NeutralGuidance_'+requests.length}]});
 }});
 const provider={sendReply:input=>actual.sendReply({...input,beforeExternal:async()=>{await input.beforeExternal();controls.providerGuardCompleted++;const hook=controls.afterFirstFence;controls.afterFirstFence=null;if(hook)await hook();}})};
 const adapter=createMetaKycContextFeedback({connect:t.currentConnect,environment:t.f.environment,provider,afterReserve:()=>options.afterReserve?.(t)});
 return {...t,adapter,requests,guidanceControls:controls};
}
function snapshot(t){return {worker:structuredClone(t.f.worker),sourceLease:new Date(t.f.events.get(t.context.eventId).leaseExpiresAt).toISOString(),projections:[...t.f.audits.values()].filter(a=>a.action==='participant.kyc_chat.projected').length,captures:[...t.f.audits.values()].filter(a=>a.action==='participant.kyc_chat.dispatched').length};}
function unchanged(t,before){assert.deepEqual(t.f.worker,before.worker);assert.equal(new Date(t.f.events.get(t.context.eventId).leaseExpiresAt).toISOString(),before.sourceLease);assert.equal([...t.f.audits.values()].filter(a=>a.action==='participant.kyc_chat.projected').length,before.projections);assert.equal([...t.f.audits.values()].filter(a=>a.action==='participant.kyc_chat.dispatched').length,before.captures);unchangedMedia(t.f);}

for(const command of ['HOLA','ESTADO','MENU','MENÚ'])for(const step of ['CONSENT','BACK_CONSENT','OCR','BIOMETRIC','FRONT','BACK','SELFIE','CONFIRM'])test('neutral '+command+' recovers exact live '+step+' guidance with no capture or deadline renewal',async()=>{
 const t=await fixture(step,command),before=snapshot(t),result=await t.adapter.feedback(t.context,{staleOnly:true});
 assert.equal(result.kind,'KYC_CONTEXT_FEEDBACK');assert.equal(result.businessApplied,false);assert.deepEqual(result.reply,participantKycStepGuidance(step,t.f.target.id));assert.match(result.reply.body,/obra=project-b/);assert.doesNotMatch(result.reply.body,/pedile.*IDENTIDAD|foto todavía no se guardó/);
 if(['FRONT','BACK','SELFIE'].includes(step))assert.match(result.reply.body,new RegExp('Paso '+({FRONT:1,BACK:2,SELFIE:3}[step])+' de 3'));else assert.match(result.reply.body,/mensaje original de identidad que tiene el botón «Elegir»/);
 assert.match(result.reply.body,['FRONT','BACK','SELFIE'].includes(step)?/respondé con CANCELAR al mensaje original de identidad que te pidió la foto\./:/respondé con CANCELAR al mensaje original de identidad que tiene el botón «Elegir»\./);assert.doesNotMatch(result.reply.body,/último mensaje de identidad/);
 const receipt=t.f.audits.get(metaKycContextReceiptId(t.context.eventId));assert.equal(receipt.metadata.replyCopyVersion,3);assert.equal(receipt.metadata.replyStep,step);assert.equal(receipt.metadata.identityCertified,false);assert.equal(receipt.metadata.permissionsGranted,false);unchanged(t,before);
 await t.adapter.send(t.context,result.reply);assert.equal(t.requests.length,1);unchanged(t,before);assert.deepEqual(await t.adapter.feedback(t.context,{recoverOnly:true}),result);await t.adapter.send(t.context,result.reply);assert.equal(t.requests.length,1);unchanged(t,before);
});
test('neutral guidance also retains an invited person without inventing an accepted account',async()=>{
 const t=await fixture('FRONT','  menú  ',{active:false,historicalChallengeVersion:2}),before=snapshot(t),value=await t.adapter.feedback(t.context,{staleOnly:true});assert.equal(value.kind,'KYC_CONTEXT_FEEDBACK');await t.adapter.send(t.context,value.reply);assert.equal(t.f.worker.metadata.participant.status,'INVITED');assert.equal(t.requests.length,1);unchanged(t,before);
});
for(const body of ['AYUDA','HOLA!','ESTADO IDENTIDAD','CONSUMO','IDENTIDAD '+'a'.repeat(43),'VINCULAR '+'b'.repeat(43)])test('unquoted '+body.split(' ')[0]+' is not silently broadened into neutral step authority',async()=>{
 const t=await fixture('FRONT',body),before=snapshot(t),audits=t.f.audits.size;assert.equal(await t.adapter.feedback(t.context,{staleOnly:true}),null);assert.equal(t.f.audits.size,audits);assert.equal(t.requests.length,0);unchanged(t,before);
});
for(const [name,change]of [
 ['explicit quote',t=>rewriteContextEvent(t,p=>{p.value.context={id:'wamid.ForeignPrompt'};})],
 ['empty context',t=>rewriteContextEvent(t,p=>{p.value.context={};})],
 ['foreign sender',t=>rewriteContextEvent(t,p=>{p.value.from='5491159999999';})],
 ['unsigned source',t=>{delete t.f.events.get(t.context.eventId).payload.encryptedProof;}],
 ['ambiguous current attempts',t=>{t.reminderControls.ambiguous=true;}],
 ['expired conversation',t=>{t.f.now.setTime(t.f.now.getTime()+31*60*1000);} ],
 ['expired challenge',t=>{t.f.worker.metadata.participant.kycChatChallenge.expiresAt=t.f.now.toISOString();}],
 ['revoked issuer',t=>{t.f.controls.issuerActive=false;}],
 ['revoked person',t=>{t.f.controls.workerMembershipActive=false;}],
 ['revoked worksite membership',t=>{t.f.controls.projectAssignmentActive=false;}],
 ['revoked company assignment',t=>{t.f.control.assignment=false;}],
 ['changed owner revision',t=>{t.f.owner.revision++;}],
 ['expired source lease',t=>{t.f.events.get(t.context.eventId).leaseExpiresAt=new Date(0);} ],
 ['uncertain current prompt',t=>{[...t.f.outbounds.values()].at(-1).outcome.state='SEND_UNKNOWN';}],
 ['failed current prompt',t=>{[...t.f.outbounds.values()].at(-1).outcome.providerStatus='failed';}],
 ['missing original dispatch',t=>{for(const[id,row]of t.f.audits)if(row.action==='participant.kyc_chat.dispatched')t.f.audits.delete(id);}],
])test('neutral guidance fails closed for '+name+' before receipt or send',async()=>{
 const t=await fixture();change(t);const before=snapshot(t),audits=t.f.audits.size,outbounds=t.f.outbounds.size;assert.equal(await t.adapter.feedback(t.context,{staleOnly:true}),null);assert.equal(t.f.audits.size,audits);assert.equal(t.f.outbounds.size,outbounds);assert.equal(t.requests.length,0);unchanged(t,before);
});
for(const [name,change]of [
 ['issuer',t=>{t.f.controls.issuerActive=false;}],
 ['person',t=>{t.f.controls.workerMembershipActive=false;}],
 ['source lease',t=>{t.f.events.get(t.context.eventId).leaseExpiresAt=new Date(0);}],
 ['original prompt',t=>{t.f.outbounds.get(customerOutboundId(t.f.state().lastEventId)).outcome.providerStatus='failed';}],
])test('neutral guidance rechecks '+name+' after reservation and before its first POST',async()=>{
 const t=await fixture('FRONT','ESTADO',{afterReserve:change}),value=await t.adapter.feedback(t.context,{staleOnly:true}),worker=structuredClone(t.f.worker);await assert.rejects(()=>t.adapter.send(t.context,value.reply));assert.equal(t.requests.length,0);assert.deepEqual(t.f.worker,worker);unchangedMedia(t.f);
});
test('conversation expiry after reservation is denied while the incoming source lease remains live',async()=>{
 const t=await fixture('FRONT','ESTADO',{afterReserve:t=>{t.f.now.setTime(Date.parse(t.f.state().expiresAt));}}),deadline=Date.parse(t.f.state().expiresAt);t.f.now.setTime(deadline-1000);t.f.events.get(t.context.eventId).leaseExpiresAt=new Date(deadline+59000);
 const before=snapshot(t),value=await t.adapter.feedback(t.context,{staleOnly:true});await assert.rejects(()=>t.adapter.send(t.context,value.reply));assert.ok(Date.parse(t.f.events.get(t.context.eventId).leaseExpiresAt)>t.f.now.getTime());assert.equal(t.requests.length,0);unchanged(t,before);
});
test('a source changed after a provider guard await is denied before the closed Graph POST',async()=>{
 const t=await fixture(),value=await t.adapter.feedback(t.context,{staleOnly:true}),before=structuredClone(t.f.worker);t.guidanceControls.afterFirstFence=()=>{t.f.controls.workerMembershipActive=false;};await assert.rejects(()=>t.adapter.send(t.context,value.reply));assert.equal(t.requests.length,0);assert.deepEqual(t.f.worker,before);unchangedMedia(t.f);
});
test('conversation expiry inside the provider guard await after snapshot is denied before the first Graph POST',async()=>{
 const t=await fixture(),deadline=Date.parse(t.f.state().expiresAt);t.f.now.setTime(deadline-1000);t.f.events.get(t.context.eventId).leaseExpiresAt=new Date(deadline+59000);
 const before=snapshot(t),value=await t.adapter.feedback(t.context,{staleOnly:true}),receipt=structuredClone(t.f.audits.get(metaKycContextReceiptId(t.context.eventId)));let fired=false;
 t.guidanceControls.afterFirstFence=async()=>{assert.equal(t.guidanceControls.providerGuardCompleted,1);await Promise.resolve();t.f.now.setTime(deadline);fired=true;};
 await assert.rejects(()=>t.adapter.send(t.context,value.reply),{code:'META_KYC_CONTEXT_FEEDBACK_DENIED'});assert.equal(fired,true);assert.equal(t.guidanceControls.providerGuardCompleted,1);assert.ok(Date.parse(t.f.events.get(t.context.eventId).leaseExpiresAt)>t.f.now.getTime());assert.equal(t.requests.length,0);assert.deepEqual(t.f.audits.get(metaKycContextReceiptId(t.context.eventId)),receipt);unchanged(t,before);
});
test('lost Graph ACK records SEND_UNKNOWN and a replay cannot send guidance twice',async()=>{
 const t=await fixture(),before=snapshot(t),value=await t.adapter.feedback(t.context,{staleOnly:true});t.guidanceControls.loseAck=true;const sent=await t.adapter.send(t.context,value.reply);assert.equal(sent.state,'SEND_UNKNOWN');assert.equal(t.requests.length,1);assert.deepEqual(await t.adapter.feedback(t.context,{recoverOnly:true}),value);await t.adapter.send(t.context,value.reply);assert.equal(t.requests.length,1);unchanged(t,before);
});
test('a guidance receipt rollback leaves the original capture intact and no outbound',async()=>{
 const t=await fixture(),before=snapshot(t),audits=t.f.audits.size,outbounds=t.f.outbounds.size;t.controls.commitOutcome='ROLLBACK';await assert.rejects(()=>t.adapter.feedback(t.context,{staleOnly:true}));assert.equal(t.f.audits.size,audits);assert.equal(t.f.outbounds.size,outbounds);assert.equal(t.requests.length,0);unchanged(t,before);
});
test('a committed guidance receipt with a lost ACK recovers identical bytes without capture or a new receipt',async()=>{
 const t=await fixture(),before=snapshot(t);t.controls.commitOutcome='LOST_ACK';await assert.rejects(()=>t.adapter.feedback(t.context,{staleOnly:true}));const receipt=t.f.audits.get(metaKycContextReceiptId(t.context.eventId)),count=t.f.audits.size,value=await t.adapter.feedback(t.context,{recoverOnly:true});assert.ok(receipt);assert.equal(value.reply.body,participantKycStepGuidance('FRONT',t.f.target.id).body);assert.equal(t.f.audits.size,count);await t.adapter.send(t.context,value.reply);assert.equal(t.requests.length,1);unchanged(t,before);
});
test('the new neutral classification cannot be changed or serialized into a feedback authority',async()=>{
 const t=await fixture(),client=await t.currentConnect();try{await client.query('BEGIN');const r=await resolveMetaKycStepReminderAuthority(client,t.context,{environment:t.f.environment});assert.equal(r.feedbackUnquotedGuidance,true);assert.throws(()=>metaKycContextAuthorityDigest(client,{...r},t.context),{code:'META_KYC_CONTEXT_FEEDBACK_DENIED'});r.feedbackUnquotedGuidance=false;assert.throws(()=>metaKycContextAuthorityDigest(client,r,t.context),{code:'META_KYC_CONTEXT_FEEDBACK_DENIED'});await client.query('ROLLBACK');}finally{client.release();}
});
for(const command of ['HOLA','ESTADO','MENU','MENÚ'])test('real production composition handles '+command+' before intake or any generic capture or FIELD adapter',async()=>{
 const t=await fixture('FRONT',command),f=t.f,event=f.events.get(t.context.eventId),before=structuredClone(f.worker);event.leaseToken=null;event.leaseExpiresAt=null;event.attempts=0;let other=0;
 const connect=async()=>{const c=await t.currentConnect();return {release:()=>c.release(),query:async(sql,args=[])=>{if(sql.startsWith('UPDATE public."WebhookEvent" SET "leaseToken"=$2')&&f.events.has(args[0])){const e=f.events.get(args[0]);e.leaseToken=args[1];e.leaseExpiresAt=args[2];return {rows:[],rowCount:1};}if(sql.startsWith('UPDATE public."WebhookEvent" SET status=\'PROCESSED\'')&&f.events.has(args[0])){const e=f.events.get(args[0]);e.status='PROCESSED';e.outcome=JSON.parse(args[3]);e.leaseToken=null;return {rows:[],rowCount:1};}return c.query(sql,args);}};};
 const unused={execute:async()=>{other++;throw Error('Unrelated adapter must not run');},executeIntake:async()=>{other++;throw Error('Intake must not replace a live KYC step');},send:async()=>{other++;throw Error('Unrelated outbound must not run');}},none={send:unused.send,rejection:async()=>null,feedback:async()=>null};
 const processor=createMetaCustomerProductionProcessor({connect,environment:f.environment,now:()=>f.now.getTime(),authorizationCodes:[...META_KYC_AUTHORIZATION_CODES,'META_KYC_CONTEXT_FEEDBACK_DENIED'],deferAuthorization:async()=>false,fieldBridge:unused,kycBridge:unused,kycOutbound:unused,appProjection:unused,companyBridge:unused,fieldOutbound:unused,companyOutbound:unused,isCompany:async()=>true,rejectedKyc:none,expiredKyc:none,contextKyc:t.adapter});
 const result=await processor.process(event.id);assert.equal(result.processed,true);assert.equal(result.kind,'KYC_CONTEXT_FEEDBACK');assert.equal(result.replySent,true);assert.equal(other,0);assert.equal(t.requests.length,1);assert.deepEqual(f.worker,before);assert.equal((await processor.process(event.id)).done,true);assert.equal(t.requests.length,1);unchangedMedia(f);
});
