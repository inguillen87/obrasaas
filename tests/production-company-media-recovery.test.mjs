import test from 'node:test';
import assert from 'node:assert/strict';
import {WorkspaceError} from '../src/lib/workspace-policy.mjs';
import {createMetaCustomerProcessor,META_CUSTOMER_PREPARED_MEDIA_RECOVERY_CODE} from '../src/lib/meta-customer-processing.mjs';
import {companyPreparedMediaRecovery,companyPreparedMediaRecoveryAuthorized} from '../src/lib/company-channel-routing.mjs';
import {readMetaCustomerInboxReceipt} from '../src/lib/meta-customer-inbox-review.mjs';
import {companyMediaRecoveryMemory} from './fixtures/company-media-recovery-memory.mjs';
import {digest} from '../src/lib/workspace-policy.mjs';
import {metaCustomerContentDigest} from '../src/lib/meta-customer-callback.mjs';
import {encryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {OBRASAAS_META_CHANNEL} from '../src/lib/meta-channel-binding.mjs';
import {decodeWorkerChannelProof} from '../src/lib/worker-channel-identity.mjs';
import {planMetaFieldConversation,META_FIELD_MEDIA_AUTHORIZATION_VERSION} from '../src/lib/meta-field-conversation.mjs';
import {metaFieldMediaContextDigest} from '../src/lib/meta-field-bridge.mjs';

// The reference-first planner is exercised against real sealed synthetic
// webhook proofs. SQL remains read-only; no file or provider is accessed.
function finalVideoAuthorizationMemory({audioAllowed=true}={}){
 const f=companyMediaRecoveryMemory(),routing=f.event.payload.companyRouting;
 const sign=(label,value)=>{
  const payload={wabaId:f.connection.whatsappBusinessId,phoneNumberId:f.connection.phoneNumberId,field:'messages',type:'message',value:{id:'wamid.SyntheticFinalMedia'+label,from:'5491100001111',timestamp:String(f.time/1000),...value}},payloadDigest=metaCustomerContentDigest(payload),externalId=digest([payload.wabaId,payload.phoneNumberId,'message',payload.value.id]),id='customer_webhook_'+externalId,aad={organizationId:'org-a',projectId:'project-a',resourceId:id};
  return {id,externalId,provider:'meta-customer-v1',eventType:'message',projectId:'project-a',status:'PENDING',leaseToken:null,leaseExpiresAt:null,attempts:0,lastError:null,createdAt:new Date(f.time),payload:{version:1,signatureVerified:true,signatureScheme:'meta-hmac-sha256-v1',organizationId:'org-a',channelId:'channel-a',payloadDigest,companyRouting:routing,encryptedPayload:encryptCustomerSecret(JSON.stringify(payload),{...aad,purpose:'webhook'},f.environment),encryptedProof:encryptCustomerSecret(JSON.stringify({scheme:'meta-hmac-sha256-v1',appId:OBRASAAS_META_CHANNEL.appId,organizationId:'org-a',channelId:'channel-a',payloadDigest,companyRouting:routing}),{...aad,purpose:'webhook-proof'},f.environment)}};
 };
 const origin=sign('Original',{type:'video',video:{id:'123456789',mime_type:'video/mp4',caption:'Video original sintético de esta tarea.'}});
 const member={actorId:f.worker.actorId,membershipId:f.worker.membershipId,organizationId:f.worker.organizationId,clerkUserId:f.worker.clerkUserId},r={member,project:{id:'project-b'},worker:f.worker,connection:f.connection,event:f.event,sourceProjectId:'project-a',companyProjection:f.projection,channelBinding:f.binding};
 const task={id:'task-b',title:'Tarea de ensayo',revision:'2026-10-06T12:00:00.000001'},facts={permissions:{report:true},tasks:[task],sectors:[{id:'sector-b'}],mediaReferenceContext:{eventId:origin.id,payloadDigest:origin.payload.payloadDigest,contextDigest:metaFieldMediaContextDigest(r),sourceProjectId:'project-a'}};
 const initial={version:1,purpose:'MEDIA',step:'MEDIA_FILE',taskId:task.id,taskRevision:task.revision,sectorId:'sector-b',bindingId:f.binding.id,mediaAuthorizationVersion:META_FIELD_MEDIA_AUTHORIZATION_VERSION,expiresAt:new Date(f.time+900000).toISOString()};
 const first=planMetaFieldConversation({message:decodeWorkerChannelProof(origin,f.connection,f.environment).value,state:initial,eventId:origin.id,facts,now:new Date(f.time)});
 assert.equal(first.media,undefined);assert.equal(first.state.step,'VIDEO_NOTICE');
 const choose=(state,index)=>({type:'interactive',interactive:{type:'list_reply',list_reply:{id:'obra:'+state.nonce+':'+index}}});
 const second=planMetaFieldConversation({message:choose(first.state,0),state:{...first.state,version:1,lastEventId:origin.id},eventId:f.promptProjection.sourceEventId,facts,now:new Date(f.time)});
 assert.equal(second.media,undefined);assert.equal(second.state.step,'VIDEO_AUDIO_NOTICE');
 const final=sign('Authorize',{...choose(second.state,audioAllowed?0:1),context:{id:f.outbound.outcome.messageId}});
 const authorized=planMetaFieldConversation({message:decodeWorkerChannelProof(final,f.connection,f.environment).value,state:{...second.state,version:1,bindingId:f.binding.id,lastEventId:f.promptProjection.sourceEventId},eventId:final.id,facts,now:new Date(f.time)});
 assert.ok(authorized.media);assert.equal(authorized.state.step,'MEDIA_AUTHORIZED');assert.equal(authorized.media.analysisConsent.videoAudio.allowed,audioAllowed);
 const previousId=f.event.id;f.events.delete(previousId);Object.assign(f.event,final);f.events.set(final.id,f.event);f.events.set(origin.id,origin);f.projection.sourceEventId=final.id;f.projection.payloadDigest=final.payload.payloadDigest;
 const key='meta_field_media_'+digest(final.id);f.prepared={version:1,projectId:'project-b',eventId:final.id,payloadDigest:final.payload.payloadDigest,channelBindingId:f.binding.id};
 f.input={media:authorized.media,state:authorized.state};f.sealFinal=()=>{f.prepared.encryptedInput=encryptCustomerSecret(JSON.stringify(f.input),{organizationId:'org-a',projectId:'project-b',purpose:'field-media-prepared',resourceId:key},f.environment);};f.sealFinal();
 f.origin=origin;f.originProjection={...f.projection,sourceEventId:origin.id,payloadDigest:origin.payload.payloadDigest};f.task=task;f.projectMetadata={fieldOperations:{version:1,sectors:[{id:'sector-b'}]}};
 f.dispatched={version:1,projectId:'project-b',channelId:'channel-a',channelBindingId:f.binding.id,eventId:origin.id,payloadDigest:origin.payload.payloadDigest,kind:'CONVERSATION',businessApplied:false};
 const oldQuery=f.client.query;f.client={...f.client,async query(sql,args){
  const rows=value=>({rows:structuredClone(value),rowCount:value.length});
  if(sql.includes('FROM public."Task"')){assert.deepEqual(args,['task-b','project-b']);return rows(f.task?[f.task]:[]);}
  if(sql.startsWith('SELECT id,metadata FROM public."Project"')){assert.deepEqual(args,['project-b','org-a']);return rows(f.projectActive?[{id:'project-b',metadata:f.projectMetadata}]:[]);}
  if(sql.includes('FROM public."WhatsAppCompanyEventRoute"')&&args[0]===origin.id)return rows(f.originProjection?[f.originProjection]:[]);
  if(sql.includes("action='meta.field.dispatched'")){assert.deepEqual(args,['meta_field_'+digest(['meta-field-dispatch-v1',origin.id]),'org-a','person-a','worker-b']);return rows(f.dispatched?[{metadata:f.dispatched}]:[]);}
  if(sql.includes("action='meta.field.media.prepared'")){assert.deepEqual(args,[key,'org-a','person-a','worker-b']);return rows(f.prepared?[{metadata:f.prepared}]:[]);}
  return oldQuery(sql,args);
 }};
 return f;
}

for(const audioAllowed of [true,false])test('reference-first final video authorization recovers exactly the chosen audio scope without downloads or writes: '+audioAllowed,async()=>{
 const f=finalVideoAuthorizationMemory({audioAllowed});assert.equal(await validate(f),true);assert.equal(f.trace.some(sql=>/^(INSERT|UPDATE|DELETE)/.test(sql)),false);assert.equal(f.input.media.analysisConsentEventId,f.event.id);assert.notEqual(f.input.media.sourceOrigin.eventId,f.event.id);
});

for(const [name,change]of [
 ['expired original reference',f=>{f.clock+=900000;}],
 ['current task revision changed',f=>{f.task.revision='2026-10-06T12:00:00.000002';}],
 ['current task removed',f=>{f.task=null;}],
 ['current sector removed',f=>{f.projectMetadata.fieldOperations.sectors=[];}],
 ['original file signature altered',f=>{f.origin.payload.encryptedProof=f.origin.payload.encryptedProof.slice(0,-3)+'bad';}],
 ['original file digest altered',f=>{f.origin.payload.payloadDigest='f'.repeat(64);}],
 ['original projection missing',f=>{f.originProjection=null;}],
 ['original projection belongs to other worksite',f=>{f.originProjection.projectId='project-other';}],
 ['original projection belongs to other worker',f=>{f.originProjection.workerId='worker-other';}],
 ['original projection binding changed',f=>{f.originProjection.bindingId='binding-other';}],
 ['original projection epoch changed',f=>{f.originProjection.routeEpoch++;}],
 ['file receipt missing',f=>{f.dispatched=null;}],
 ['file receipt already applied business',f=>{f.dispatched.businessApplied=true;}],
 ['file receipt belongs to other project',f=>{f.dispatched.projectId='project-other';}],
 ['file receipt belongs to other binding',f=>{f.dispatched.channelBindingId='binding-other';}],
 ['sealed reference media substitution',f=>{f.input.media.sourceOrigin.mediaId='999999999';f.sealFinal();}],
 ['sealed context substitution',f=>{f.input.media.sourceOrigin.contextDigest='e'.repeat(64);f.input.state.pendingFile.contextDigest='e'.repeat(64);f.sealFinal();}],
 ['wrong final consent event',f=>{f.input.media.analysisConsentEventId=f.origin.id;f.input.state.analysisConsentEventId=f.origin.id;f.sealFinal();}],
 ['scope differs from final signed button',f=>{f.input.media.analysisConsent.videoAudio.allowed=false;f.input.state.analysisConsent.videoAudio.allowed=false;f.sealFinal();}],
 ['authorization step substitution',f=>{f.input.state.mediaAuthorizationStep='VIDEO_NOTICE';f.sealFinal();}],
 ['missing v2 marker never falls back to legacy',f=>{delete f.input.state.mediaAuthorizationVersion;f.sealFinal();}],
 ['unconfirmed prior prompt',f=>{f.outbound.outcome.state='SEND_UNKNOWN';}],
 ['prior prompt context changed',f=>{f.outbound.outcome.messageId='wamid.OtherPrompt';}],
])test('reference-first reservation recovery refuses '+name,async()=>{const f=finalVideoAuthorizationMemory();change(f);assert.equal(await validate(f),false);});

const validate=f=>companyPreparedMediaRecovery(f.client,f.claim(),{environment:f.environment});
function processor(f,options={}){return createMetaCustomerProcessor({connect:f.connect,environment:f.environment,now:()=>f.clock,lockChannel:async()=>f.connection,deferAuthorization:(client,context)=>companyPreparedMediaRecovery(client,context,{environment:f.environment}),dispatch:async()=>{assert.equal(f.open,0);throw new WorkspaceError('WORKER_CHANNEL_PARTICIPANT_REQUIRED',403);},...options});}

test('real signed A source, immutable FIELD B projection and planner-produced encrypted reservation validate without granting revoked PM access',async()=>{
 const f=companyMediaRecoveryMemory();f.worker.active=false;f.worker.metadata.participant.permissions.report=false;
 assert.equal(await validate(f),true);assert.equal(f.open,0);assert.equal(f.trace.some(q=>/^(INSERT|UPDATE|DELETE)/.test(q)),false);
 assert.equal(f.projection.projectId,'project-b');assert.equal(f.event.projectId,'project-a');
});

const changes=[
 ['missing reservation',f=>{f.prepared=null;}],
 ['wrong source project',f=>{f.event.projectId='project-other';}],
 ['tampered signed digest',f=>{f.event.payload.payloadDigest='b'.repeat(64);} ],
 ['tampered signing proof',f=>{f.event.payload.encryptedProof=f.event.payload.encryptedProof.slice(0,-3)+'bad';}],
 ['unsigned company mode',f=>{f.event.payload.companyRouting={...f.event.payload.companyRouting,revision:9};}],
 ['tenant projection',f=>{f.projection.organizationId='org-other';}],
 ['worker projection',f=>{f.projection.workerId='worker-other';}],
 ['actor projection',f=>{f.projection.actorId='person-other';}],
 ['binding projection',f=>{f.projection.bindingId='binding-other';}],
 ['missing assignment',f=>{f.assignmentPresent=false;}],
 ['missing canonical membership',f=>{f.membershipPresent=false;}],
 ['revoked binding',f=>{f.binding.status='REVOKED';}],
 ['wrong reserved destination',f=>{f.prepared.projectId='project-a';}],
 ['source digest in reservation',f=>{f.prepared.payloadDigest='c'.repeat(64);}],
 ['wrong media',f=>{f.sealPrepared({media:{...f.planned.media,mediaId:'987654321'},state:f.planned.state});}],
 ['wrong consent',f=>{f.sealPrepared({media:{...f.planned.media,analysisConsent:{...f.planned.media.analysisConsent,allowed:true}},state:f.planned.state});}],
 ['prior prompt epoch',f=>{f.promptProjection.routeEpoch++;}],
 ['unconfirmed prompt',f=>{f.outbound.outcome.state='SEND_UNKNOWN';}],
 ['failed confirmed prompt',f=>{f.outbound.outcome.providerStatus='failed';}],
 ['wrong prompt context',f=>{f.outbound.outcome.messageId='wamid.OtherPrompt';}],
 ['outbound digest tamper',f=>{f.outbound.payload.requestDigest='d'.repeat(64);}],
 ['pilot media closed',f=>{f.connection.metadata.developmentPilot={version:1};}],
 ['schema unavailable',f=>{f.schemaReady=false;}],
];
for(const [name,change] of changes)test('reservation validation fails closed: '+name,async()=>{const f=companyMediaRecoveryMemory();change(f);assert.equal(await validate(f),false);});

test('processor defers valid prepared media in its own transaction, releases exact lease, excludes cron, and requires an explicit fully authorized retry',async()=>{
 const f=companyMediaRecoveryMemory();let authorized=false,io=0,dispatches=0;
 const p=processor(f,{dispatch:async()=>{assert.equal(f.open,0);dispatches++;if(!authorized)throw new WorkspaceError('WORKER_CHANNEL_PERMISSION_REQUIRED',403);io++;return {kind:'EVIDENCE',businessApplied:true,receiptId:'canonical-evidence-receipt',reviewState:'RECORDED'};}});
 const denied=await p.process(f.event.id);assert.equal(denied.processed,false);assert.equal(denied.recoveryPending,true);assert.equal(denied.code,'WORKER_CHANNEL_PERMISSION_REQUIRED');assert.equal(denied.businessApplied,false);assert.equal(io,0);
 assert.equal(f.event.status,'PENDING');assert.equal(f.event.lastError,META_CUSTOMER_PREPARED_MEDIA_RECOVERY_CODE);assert.equal(f.event.leaseToken,null);assert.equal(f.event.leaseExpiresAt,null);
 assert.equal((await p.recover()).checked,0);assert.equal(dispatches,1);assert.equal(io,0);
 const stillDenied=await p.recover({eventIds:[f.event.id]});assert.equal(stillDenied.results[0].recoveryPending,true);assert.equal(io,0);
 authorized=true;const recovered=await p.recover({eventIds:[f.event.id]});assert.equal(recovered.results[0].kind,'EVIDENCE');assert.equal(io,1);assert.equal(f.event.status,'PROCESSED');assert.equal(f.event.lastError,null);
 assert.equal((await p.process(f.event.id)).done,true);assert.equal(io,1);assert.equal(f.projection.projectId,'project-b');
});

test('ordinary authorization observations and a missing reservation remain terminal, with no callback-derived permission or fallback',async()=>{
 for(const options of [{deferAuthorization:undefined},{deferAuthorization:async()=>false}]){const f=companyMediaRecoveryMemory(),p=processor(f,options);const result=await p.process(f.event.id);assert.equal(result.processed,true);assert.equal(result.businessApplied,false);assert.equal(result.code,'WORKER_CHANNEL_PARTICIPANT_REQUIRED');assert.equal(f.event.status,'PROCESSED');assert.equal((await p.process(f.event.id)).done,true);}
 const f=companyMediaRecoveryMemory();f.prepared=null;assert.equal((await processor(f).process(f.event.id)).processed,true);
});

test('forged callback truthy values do not defer and proof errors never invoke the callback',async()=>{
 const f=companyMediaRecoveryMemory();assert.equal((await processor(f,{deferAuthorization:async()=>({ready:true})}).process(f.event.id)).processed,true);
 const g=companyMediaRecoveryMemory();let calls=0;const p=processor(g,{deferAuthorization:async()=>{calls++;return true;},dispatch:async()=>{throw new WorkspaceError('WORKER_CHANNEL_PROOF_INTEGRITY',409);}});
 await assert.rejects(p.process(g.event.id),{code:'WORKER_CHANNEL_PROOF_INTEGRITY'});assert.equal(calls,0);assert.equal(g.event.status,'PENDING');
});

test('lease expiry during the reservation check fails CAS and rolls back deferral instead of advertising recovery success',async()=>{
 const f=companyMediaRecoveryMemory();const p=processor(f,{deferAuthorization:async(client,context)=>{assert.equal(f.open,1);const valid=await companyPreparedMediaRecovery(client,context,{environment:f.environment});f.clock+=60001;return valid;}});
 await assert.rejects(p.process(f.event.id),{code:'META_CUSTOMER_INBOX_LEASE_CHANGED'});assert.equal(f.event.status,'PENDING');assert.equal(f.event.outcome,undefined);assert.equal(f.event.lastError,'META_CUSTOMER_INBOX_LEASE_CHANGED');assert.equal(f.event.leaseToken,null);
});

test('prepared media with a committed receipt preserves businessApplied when later outbound authorization fails; retry still uses outbound once-only state',async()=>{
 const f=companyMediaRecoveryMemory();let sends=0;const p=processor(f,{dispatch:async()=>({kind:'EVIDENCE',businessApplied:true,receiptId:'canonical-evidence-receipt',reply:{type:'text',body:'Controlled receipt'}}),outbound:{send:async()=>{sends++;throw new WorkspaceError('WORKER_CHANNEL_PERMISSION_REQUIRED',403);}}});
 const result=await p.process(f.event.id);assert.equal(result.recoveryPending,true);assert.equal(result.businessApplied,true);assert.equal(result.receiptId,'canonical-evidence-receipt');assert.equal(result.replySent,false);assert.equal(sends,1);assert.equal(f.event.status,'PENDING');
});

const admin={role:'ADMIN',organizationId:'org-a',actorId:'admin-a'};
async function pending(f){await processor(f).process(f.event.id);return f;}
test('reference-first retry affordance resolves the current authorized person again after a real processor deferral',async()=>{
 const f=await pending(finalVideoAuthorizationMemory());assert.equal(f.event.lastError,META_CUSTOMER_PREPARED_MEDIA_RECOVERY_CODE);assert.equal(f.event.leaseToken,null);
 assert.equal(await companyPreparedMediaRecoveryAuthorized(f.client,admin,{eventId:f.event.id,projectId:'project-b',environment:f.environment}),true);
 f.worker.metadata.participant.permissions.report=false;
 assert.equal(await companyPreparedMediaRecoveryAuthorized(f.client,admin,{eventId:f.event.id,projectId:'project-b',environment:f.environment}),false);
 assert.equal(f.event.status,'PENDING');assert.equal(f.event.outcome.businessApplied,false);
});
test('the existing web action is observable only for current ADMIN of B with approved individual identity, report permission, binding, assignment and active owner',async()=>{
 const f=await pending(companyMediaRecoveryMemory());assert.equal(await companyPreparedMediaRecoveryAuthorized(f.client,admin,{eventId:f.event.id,projectId:'project-b',environment:f.environment}),true);
 assert.equal(f.trace.some(q=>/FOR (UPDATE|SHARE)/.test(q)&&q.includes('"Worker"')),false,'The affordance is a read-only snapshot');
 for(const identity of [{...admin,role:'DIRECTOR'},{...admin,organizationId:'org-other'}])assert.equal(await companyPreparedMediaRecoveryAuthorized(f.client,identity,{eventId:f.event.id,projectId:'project-b',environment:f.environment}),false);
 assert.equal(await companyPreparedMediaRecoveryAuthorized(f.client,admin,{eventId:f.event.id,projectId:'project-a',environment:f.environment}),false);
});
for(const [name,change] of [
 ['PM revoked',f=>{f.projectMembershipActive=false;}],['TM revoked',f=>{f.tenantActive=false;}],
 ['report permission revoked',f=>{f.worker.metadata.participant.permissions.report=false;}],
 ['KYC no longer approved',f=>{f.worker.metadata.participant.kyc.status='REJECTED';}],
 ['binding revoked',f=>{f.binding.status='REVOKED';}],['owner suspended',f=>{f.owner.mode='SUSPENDED';}],
 ['assignment revoked',f=>{f.assignmentPresent=false;}],['assignment revision changed',f=>{f.owner.assignmentRevision++;}],
 ['project archived',f=>{f.projectActive=false;}],['grant expired',f=>{f.connection.metadata.customerVerification.expiresAt=new Date(f.clock-1).toISOString();}],
 ['generic pending error',f=>{f.event.lastError='META_CUSTOMER_PROCESSING_UNCONFIRMED';}],
 ['active lease',f=>{f.event.leaseToken='other-lease';f.event.leaseExpiresAt=new Date(f.clock+60000);}],
 ['malformed lease',f=>{f.event.leaseToken='other-lease';f.event.leaseExpiresAt='invalid';}],
])test('web recovery remains closed for '+name,async()=>{const f=await pending(companyMediaRecoveryMemory());change(f);assert.equal(await companyPreparedMediaRecoveryAuthorized(f.client,admin,{eventId:f.event.id,projectId:'project-b',environment:f.environment}),false);assert.equal(f.event.status,'PENDING');});

test('exact company operation GET reads A under immutable target B and reports only event state, never an invented saved/actor receipt',async()=>{
 const f=await pending(companyMediaRecoveryMemory()),connection={...f.connection,company:{mode:'COMPANY',targetProjectId:'project-b'}},request={operationId:'01234567-89ab-4cde-8fab-0123456789ab',eventId:f.event.id,action:'process_inbox'};
 const read=()=>readMetaCustomerInboxReceipt(f.client,admin,{id:'project-b'},connection,f.environment,request);
 const initial=await read();assert.equal(initial.state,'NOT_OBSERVED');assert.equal(initial.actorOperationVerified,false);assert.equal(initial.eventStatus,'PENDING');assert.equal(Object.hasOwn(initial,'saved'),false);assert.equal(Object.hasOwn(initial,'receiptId'),false);
 f.event.status='PROCESSED';f.event.outcome={version:1,businessApplied:true,receiptId:'canonical-evidence-receipt'};const result=await read();assert.equal(result.state,'EVENT_PROCESSED');assert.equal(result.actorOperationVerified,false);assert.equal(result.definitive,false);assert.equal(result.businessReceiptId,'canonical-evidence-receipt');assert.equal(Object.hasOwn(result,'saved'),false);
 for(const project of [{id:'project-a'},{id:'project-other'}])await assert.rejects(readMetaCustomerInboxReceipt(f.client,admin,project,connection,f.environment,request),{code:'META_CUSTOMER_INBOX_UNAVAILABLE'});
 await assert.rejects(readMetaCustomerInboxReceipt(f.client,{...admin,organizationId:'org-other'},{id:'project-b'},connection,f.environment,request),{code:'META_CUSTOMER_INBOX_UNAVAILABLE'});
 await assert.rejects(readMetaCustomerInboxReceipt(f.client,admin,{id:'project-b'},connection,f.environment,{...request,action:'review_inbox'}),{code:'META_CUSTOMER_INBOX_UNAVAILABLE'});
});
for(const state of ['SEND_STARTED','SEND_UNKNOWN',null])test('uncertain durable outbound blocks the web recovery affordance: '+state,async()=>{
 const f=await pending(companyMediaRecoveryMemory());f.currentOutbound={id:(await import('../src/lib/meta-customer-outbound.mjs')).customerOutboundId(f.event.id),payload:{},outcome:{state}};
 assert.equal(await companyPreparedMediaRecoveryAuthorized(f.client,admin,{eventId:f.event.id,projectId:'project-b',environment:f.environment}),false);assert.equal(f.event.status,'PENDING');
});
