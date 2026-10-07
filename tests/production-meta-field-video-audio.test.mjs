import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {planMetaFieldConversation,META_FIELD_MEDIA_AUTHORIZATION_VERSION,validMetaFieldMediaReference,metaFieldMediaAuthorizationValid} from '../src/lib/meta-field-conversation.mjs';
import {metaFieldMediaContextDigest,validateMetaFieldMediaOrigin,metaFieldVideoResultText} from '../src/lib/meta-field-bridge.mjs';
import {fieldMediaAnalysisConsent,fieldVideoAnalysisConsent,FIELD_VIDEO_PRIVACY_NOTICE,FIELD_VIDEO_AUDIO_PRIVACY_NOTICE} from '../src/lib/field-media-privacy.mjs';
import {createVoiceProgressDraft} from '../src/lib/voice-progress-draft.mjs';
import {digest} from '../src/lib/workspace-policy.mjs';
import {encryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {metaCustomerContentDigest} from '../src/lib/meta-customer-callback.mjs';
import {OBRASAAS_META_CHANNEL} from '../src/lib/meta-channel-binding.mjs';
import {META_CUSTOMER_PROTOCOL} from '../src/lib/meta-cloud-protocol.mjs';
import {COMPANY_CHANNEL_SCHEMA_CONTRACT} from '../src/lib/company-channel-schema.mjs';

const now=new Date('2026-10-07T12:00:00.000Z'),task={id:'task-a',title:'Mampostería',progress:0,revision:'2026-10-07T11:00:00.123456'};
const facts={projectName:'Obra sintética',workerId:'worker-a',permissions:{attendance:false,report:true},tasks:[task],sectors:[{id:'sector-a',name:'Planta baja'}],evidence:[],proposals:[],latest:null};
const referenceContext={sourceProjectId:'project-anchor',contextDigest:'c'.repeat(64),payloadDigest:'d'.repeat(64)};
const mime={image:'image/jpeg',audio:'audio/ogg',video:'video/mp4'};
let sequence=0;
function run(message,state=null,extra={}){
 const eventId=extra.eventId||'synthetic_event_'+(++sequence),currentFacts=extra.facts||facts;
 const result=planMetaFieldConversation({message,state,eventId,facts:{...currentFacts,mediaReferenceContext:{...referenceContext,eventId,...extra.referenceContext}},now:extra.now||now});
 // The actual bridge binds encrypted state to this event after the planner.
 if(result.state)result.state={...result.state,version:1,...(!result.media?{lastEventId:eventId}:{}),expiresAt:new Date((extra.now||now).getTime()+900000).toISOString()};
 return {...result,eventId,input:message};
}
const say=(body,state,extra)=>run({type:'text',text:{body}},state,extra);
function pick(plan,value,extra){const index=plan.state.choices.findIndex(c=>c.value===value);assert.ok(index>=0);return run({type:'interactive',interactive:{type:'list_reply',list_reply:{id:plan.reply.sections[0].rows[index].id}}},plan.state,extra);}
function filePrompt(extra={}){return pick(pick(say('EVIDENCIA',null,extra),'task-a',extra),'sector-a',extra);}
function fileNotice(kind='video',extra={}){const prompt=filePrompt(extra);return run({type:kind,[kind]:{id:'123456789',mime_type:mime[kind],caption:'Trabajo sintético del sector',url:'https://invalid.example/private',filename:'private-name.mp4'}},prompt.state,extra);}
function authorizeVideo(audio=true,extra={}){const notice=fileNotice('video',extra),audioNotice=pick(notice,'ANALYZE',extra),authorized=pick(audioNotice,audio?'WITH_AUDIO':'VISUAL_ONLY',extra);return {notice,audioNotice,authorized};}
const noEffect=plan=>{assert.equal(plan.media,undefined);assert.equal(plan.command,undefined);};

test('new media journey waits for actual file type and privately keeps only a bounded reference',()=>{
 const prompt=filePrompt();assert.equal(prompt.state.step,'MEDIA_FILE');assert.equal(prompt.state.mediaAuthorizationVersion,META_FIELD_MEDIA_AUTHORIZATION_VERSION);assert.equal(prompt.state.analysisConsent,undefined);noEffect(prompt);
 for(const kind of ['image','audio','video']){
  const notice=fileNotice(kind);noEffect(notice);assert.equal(notice.state.step,kind==='video'?'VIDEO_NOTICE':'MEDIA_TYPED_NOTICE');assert.equal(notice.state.pendingFile.kind,kind);assert.equal(notice.state.pendingFile.taskId,task.id);assert.equal(notice.state.pendingFile.taskRevision,task.revision);
  assert.deepEqual(Object.keys(notice.state.pendingFile).sort(),['version','eventId','payloadDigest','contextDigest','sourceProjectId','kind','mediaId','contentType','caption','receivedAt','expiresAt','taskId','taskRevision','sectorId'].sort());
  assert.equal(Date.parse(notice.state.pendingFile.expiresAt)-Date.parse(notice.state.pendingFile.receivedAt),900000);assert.ok(notice.reply.body.length+180<1024);
  assert.equal(notice.state.pendingFile.url,undefined);assert.equal(notice.state.pendingFile.filename,undefined);assert.equal(notice.state.analysisConsent,undefined);
 }
 assert.ok(FIELD_VIDEO_PRIVACY_NOTICE.length+180<1024);assert.ok(FIELD_VIDEO_AUDIO_PRIVACY_NOTICE.length+180<1024);
});
test('video visual authorization is separate from explicit audio authorization with no default opt-in',()=>{
 for(const audio of [false,true]){
  const {notice,audioNotice,authorized}=authorizeVideo(audio);noEffect(notice);noEffect(audioNotice);
  assert.deepEqual(audioNotice.state.analysisConsent,fieldVideoAnalysisConsent(true,false));assert.equal(audioNotice.state.videoVisualConsentEventId,audioNotice.eventId);assert.match(audioNotice.reply.body,/audio/);
  assert.deepEqual(authorized.media.analysisConsent,fieldVideoAnalysisConsent(true,audio));assert.equal(authorized.media.analysisConsentEventId,authorized.eventId);assert.deepEqual(authorized.media.sourceOrigin,notice.state.pendingFile);assert.equal(authorized.state.step,'MEDIA_AUTHORIZED');
  assert.equal(metaFieldMediaAuthorizationValid(authorized.input,authorized.media,authorized.state),true);assert.equal(authorized.command,undefined);
 }
 const saved=pick(fileNotice(),'SAVE_ONLY');assert.deepEqual(saved.media.analysisConsent,fieldVideoAnalysisConsent(false,false));assert.equal(metaFieldMediaAuthorizationValid(saved.input,saved.media,saved.state),true);
});
test('new image/audio references preserve optional v1 analysis rather than upgrading to video consent',()=>{
 for(const kind of ['image','audio'])for(const allowed of [false,true]){
  const notice=fileNotice(kind),authorized=pick(notice,allowed?'ANALYZE':'SAVE_ONLY');assert.deepEqual(authorized.media.analysisConsent,fieldMediaAnalysisConsent(allowed));assert.deepEqual(authorized.media.sourceOrigin,notice.state.pendingFile);assert.equal(metaFieldMediaAuthorizationValid(authorized.input,authorized.media,authorized.state),true);
 }
});
test('plain affirmation, old buttons, a second unsolicited file and cancel never authorize the referenced video',()=>{
 const notice=fileNotice(),audioNotice=pick(notice,'ANALYZE');
 for(const current of [notice,audioNotice]){const plain=say('sí',current.state);noEffect(plain);assert.equal(plain.state.step,current.state.step);const other=run({type:'video',video:{id:'987654321',mime_type:'video/mp4'}},current.state);noEffect(other);assert.deepEqual(other.state.pendingFile,current.state.pendingFile);}
 const stale=run(pick(notice,'SAVE_ONLY').input,audioNotice.state);noEffect(stale);assert.match(stale.reply.body,/paso anterior/);
 const cancelled=pick(audioNotice,'CANCEL');noEffect(cancelled);assert.equal(cancelled.state,null);assert.match(cancelled.reply.body,/No guardamos/);
});
test('reference expiration, task/sector removal, revision and current participation changes close without effects',()=>{
 const notice=fileNotice(),changes=[{now:new Date(now.getTime()+900000)},{facts:{...facts,tasks:[]}},{facts:{...facts,tasks:[{...task,revision:'2026-10-07T11:00:00.123457'}]}},{facts:{...facts,sectors:[]}},{referenceContext:{contextDigest:'f'.repeat(64)}},{referenceContext:{sourceProjectId:'project-foreign'}},{facts:{...facts,permissions:{attendance:false,report:false}}}];
 for(const change of changes){const stopped=pick(notice,'SAVE_ONLY',change);noEffect(stopped);assert.equal(stopped.state,null);}
});
test('malformed file references and unsupported MIME are rejected before attachment',()=>{
 const prompt=filePrompt();for(const asset of [{id:'bad-id',mime_type:'video/mp4'},{id:'123456789',mime_type:'audio/ogg'},{id:'123456789',mime_type:'video/mp4\nInjected'}]){const bad=run({type:'video',video:asset},prompt.state);noEffect(bad);assert.equal(bad.state,null);}
 const notice=fileNotice(),ref=notice.state.pendingFile,context={state:notice.state,facts:{...facts,mediaReferenceContext:referenceContext},now};
 for(const malformed of [{...ref,filename:'secret'},{...ref,eventId:'../foreign'},{...ref,expiresAt:new Date(now.getTime()+900001).toISOString()},{...ref,contextDigest:'C'.repeat(64)},{...ref,payloadDigest:null}])assert.equal(validMetaFieldMediaReference(malformed,context),false);
});
test('final button authorization matches its own prompt, kind and complete consent exactly',()=>{
 const {authorized}=authorizeVideo(),{media,state,input}=authorized;
 for(const changed of [{...state,lastEventId:'foreign-event'},{...state,videoVisualConsentEventId:'foreign-event'},{...state,mediaAuthorizationStep:'VIDEO_NOTICE'}])assert.equal(metaFieldMediaAuthorizationValid(input,media,changed),false);
 for(const changed of [{...media,analysisConsent:fieldVideoAnalysisConsent(true,false)},{...media,sourceOrigin:{...media.sourceOrigin,kind:'audio'}},{...media,analysisConsent:{...media.analysisConsent,token:'private'}}])assert.equal(metaFieldMediaAuthorizationValid(input,changed,state),false);
 assert.equal(metaFieldMediaAuthorizationValid({type:'text',text:{body:'sí'}},media,state),false);
});

// Read-only SQL fake with real encrypted signed proof. These controls exercise
// integrity and context binding, not canonical permission/KYC or provider I/O.
function originFixture(){
 const environment={META_CUSTOMER_CREDENTIALS_KEY:Buffer.alloc(32,17).toString('base64')};
 const member={organizationId:'organization-a',actorId:'actor-a',membershipId:'membership-a',clerkUserId:'user_Synthetic'},connection={id:'connection-a',organizationId:member.organizationId,projectId:'project-anchor',phoneNumberId:'120000001',whatsappBusinessId:'130000001'},binding={id:'binding-a'};
 const originalProof={wabaId:connection.whatsappBusinessId,phoneNumberId:connection.phoneNumberId,field:'messages',type:'message',value:{id:'wamid.SyntheticOriginal',from:'5491100001111',timestamp:'1791374400',type:'video',video:{id:'123456789',mime_type:'video/mp4',caption:'Trabajo sintético del sector'}}};
 const payloadDigest=metaCustomerContentDigest(originalProof),externalId=digest([originalProof.wabaId,originalProof.phoneNumberId,'message',originalProof.value.id]),id='customer_webhook_'+externalId,companyRouting={mode:'COMPANY',revision:4,contract:COMPANY_CHANNEL_SCHEMA_CONTRACT};
 const row={id,projectId:connection.projectId,provider:META_CUSTOMER_PROTOCOL.provider,eventType:'message',externalId,payload:{version:1,organizationId:member.organizationId,channelId:connection.id,payloadDigest,companyRouting}};
 row.payload.encryptedPayload=encryptCustomerSecret(JSON.stringify(originalProof),{organizationId:member.organizationId,projectId:connection.projectId,purpose:META_CUSTOMER_PROTOCOL.payloadPurpose,resourceId:id},environment);
 row.payload.encryptedProof=encryptCustomerSecret(JSON.stringify({scheme:META_CUSTOMER_PROTOCOL.scheme,appId:OBRASAAS_META_CHANNEL.appId,payloadDigest,channelId:connection.id,organizationId:member.organizationId,companyRouting}),{organizationId:member.organizationId,projectId:connection.projectId,purpose:META_CUSTOMER_PROTOCOL.proofPurpose,resourceId:id},environment);
 const projection={kind:'FIELD',sourceEventId:id,payloadDigest,organizationId:member.organizationId,connectionId:connection.id,projectId:'project-b',workerId:'worker-a',actorId:member.actorId,membershipId:member.membershipId,assignmentRevision:2,bindingId:binding.id,routeId:'route-a',routeEpoch:3};
 const r={member,project:{id:projection.projectId},worker:{id:projection.workerId},connection,channelBinding:binding,companyProjection:{...projection},sourceProjectId:connection.projectId,event:{id:'current-button-event',projectId:connection.projectId},proof:{senderE164:'+'+originalProof.value.from},now};
 const context={sourceProjectId:connection.projectId,contextDigest:metaFieldMediaContextDigest(r),payloadDigest,eventId:id};
 const notice=fileNotice('video',{referenceContext:context,eventId:id}),audioNotice=pick(notice,'ANALYZE',{referenceContext:context,eventId:'visual-button-event'}),authorized=pick(audioNotice,'WITH_AUDIO',{referenceContext:context,eventId:r.event.id});
 r.proof.value=authorized.input;
 const project={id:projection.projectId,organizationId:member.organizationId,status:'ACTIVE',metadata:{fieldOperations:{version:1,sectors:structuredClone(facts.sectors)}}},storedTask=structuredClone(task);
 const observed={version:1,projectId:projection.projectId,channelId:connection.id,channelBindingId:binding.id,eventId:id,payloadDigest,kind:'CONVERSATION',businessApplied:false};
 const data={row,projection,project,task:storedTask,observed},queries=[];
 const client={query:async(sql,args)=>{
  assert.match(sql,/^SELECT /);queries.push({sql,args});let values=[];
  if(sql.includes('FROM public."Task"')){if(data.task&&args[0]===task.id&&args[1]===projection.projectId)values=[data.task];}
  else if(sql.includes('FROM public."Project"')){if(data.project&&args[0]===data.project.id&&args[1]===data.project.organizationId&&data.project.status==='ACTIVE')values=[data.project];}
  else if(sql.includes('FROM public."WebhookEvent"')){if(data.row&&args[0]===data.row.id&&args[1]===data.row.projectId&&args[2]===data.row.provider)values=[data.row];}
  else if(sql.includes('FROM public."WhatsAppCompanyEventRoute"')){if(data.projection&&args[0]===id)values=[data.projection];}
  else if(sql.includes('FROM public."AuditLog"')){if(data.observed&&args[0]==='meta_field_'+digest(['meta-field-dispatch-v1',id])&&args[1]===member.organizationId&&args[2]===member.actorId&&args[3]===r.worker.id)values=[{metadata:data.observed}];}
  else assert.fail('Unexpected SQL: '+sql);
  return {rows:structuredClone(values),rowCount:values.length};
 }};
 return {r,media:authorized.media,state:authorized.state,environment,data,queries,client};
}
const validOrigin=f=>validateMetaFieldMediaOrigin(f.client,f.r,f.media,f.state,{environment:f.environment,now:f.r.now});
test('origin requires the original signed file, durable conversation receipt, current task and immutable company projection',async()=>{
 const f=originFixture();assert.equal(await validOrigin(f),true);assert.equal(f.queries.length,5);assert.equal(f.r.project.name,undefined);assert.equal(f.media.sourceOrigin.eventId,f.data.row.id);assert.notEqual(f.media.sourceOrigin.eventId,f.r.event.id);
});
test('origin rejects missing or altered durable original, foreign target and invalid decrypted proof',async()=>{
 const mutations=[f=>{f.data.row=null;},f=>{f.data.row.payload.payloadDigest='f'.repeat(64);},f=>{f.data.row.payload.encryptedProof='v2.invalid';},f=>{f.data.projection=null;},f=>{f.data.projection.projectId='project-other';},f=>{f.data.projection.actorId='actor-other';},f=>{f.data.projection.routeEpoch++;},f=>{f.data.observed=null;},f=>{f.data.observed.businessApplied=true;},f=>{f.data.observed.channelBindingId='binding-other';},f=>{f.data.observed.kind='EVIDENCE';}];
 for(const mutate of mutations){const f=originFixture();mutate(f);assert.equal(await validOrigin(f),false);}
});
test('origin rejects removed sectors/project/task, changed task revision and TTL even when sealed reference remains intact',async()=>{
 const mutations=[f=>{f.data.project.metadata.fieldOperations.sectors=[];},f=>{f.data.project.status='ARCHIVED';},f=>{f.data.project=null;},f=>{f.data.task=null;},f=>{f.data.task.revision='2026-10-07T11:00:00.123457';},f=>{f.r.now=new Date(now.getTime()+900000);}];
 for(const mutate of mutations){const f=originFixture();mutate(f);assert.equal(await validOrigin(f),false);}
});
test('origin cannot transfer final authorization or original reference across actors, projects, bindings or physical channels',async()=>{
 const mutations=[f=>{f.r.member.actorId='actor-other';},f=>{f.r.member.membershipId='member-other';},f=>{f.r.member.organizationId='organization-other';},f=>{f.r.project.id='project-other';},f=>{f.r.worker.id='worker-other';},f=>{f.r.channelBinding.id='binding-other';},f=>{f.r.connection.id='connection-other';},f=>{f.r.connection.phoneNumberId='150000001';},f=>{f.r.sourceProjectId='anchor-other';},f=>{f.r.proof.senderE164='+5491100002222';},f=>{f.media.mediaId='987654321';},f=>{f.media.analysisConsent=fieldVideoAnalysisConsent(true,false);},f=>{f.state.pendingFile={...f.state.pendingFile,caption:'Alterada'};},f=>{f.state.analysisConsentEventId='old-event';}];
 for(const mutate of mutations){const f=originFixture();mutate(f);assert.equal(await validOrigin(f),false);}
});

function videoEvidence(){
 const transcript='Hoy hicimos 2,5 metros cuadrados de mampostería.',transcriptSha256=createHash('sha256').update(transcript).digest('hex'),source={sourceSha256:'b'.repeat(64),sourceBytes:1000,sourceContentType:'video/mp4'};
 const visualSource={version:'server-video-frames-v1',...source,decoded:true,frameCount:4},extraction={version:'server-video-audio-v1',...source,sourceStream:{ordinal:0},wordTimestampsAvailable:false,sourceVideoFullDecodeVerified:false,nativeEnergy:{allChannelsDigitalZero:false},pcm:{sampleRate:16000,channels:1,bitsPerSample:16,sampleCount:16000,nonzeroSamples:100,sha256:'e'.repeat(64)},inputOrigin:{authority:'FFMPEG_DEFAULT_INPUT_START_NORMALIZATION',audioOnlyRebaseApplied:false},timing:{timestampAuthority:'DECODED_AUDIO_FRAME_PTS_AFTER_FFMPEG_INPUT_NORMALIZATION'}};
 const evidence={id:'evidence-video',title:'Video sintético revisado',taskId:task.id,revision:'2026-10-07T11:05:00.123456',status:'APPROVED',media:{kind:'video',sha256:source.sourceSha256,bytes:source.sourceBytes,contentType:source.sourceContentType},processing:{status:'ANALYZED_UNREVIEWED',analysisConsent:fieldVideoAnalysisConsent(true,true),result:{visual:{status:'ANALYZED_UNREVIEWED'},sampling:{...visualSource,audioAnalyzed:false},videoAudio:{version:'field-video-audio-result-v1',status:'TRANSCRIBED_UNREVIEWED',code:null,extraction,visualSource,transcription:{status:'TRANSCRIBED_UNREVIEWED',text:transcript,transcriptSha256,provider:'openai',providerModel:'whisper-1',inputAudioSha256:'e'.repeat(64),speakerVerified:false,identityVerified:false,attendanceRegistered:false,requiresHumanReview:true}}}}};
 evidence.processing.result.progressDraft=createVoiceProgressDraft({transcript,evidenceId:evidence.id,evidenceRevision:evidence.revision,mediaSha256:source.sourceSha256,transcriptSha256,task});return evidence;
}
test('video acknowledgments distinguish visual, confirmed private transcript and unconfirmed processing without sending transcript text',()=>{
 const e=videoEvidence(),reply=metaFieldVideoResultText(e,e.processing.analysisConsent);assert.match(reply,/cuatro cuadros/);assert.match(reply,/transcripción.*guardada/);assert.match(reply,/No verifica identidad ni registra asistencia/);assert.match(reply,/otro responsable apruebe.*AVANCE/);assert.ok(!reply.includes(e.processing.result.videoAudio.transcription.text));
 for(const status of ['NO_AUDIO_TRACK','DIGITAL_SILENCE','UNCONFIRMED']){const current=videoEvidence();current.processing.result.videoAudio.status=status;current.processing.result.videoAudio.transcription=null;const body=metaFieldVideoResultText(current,current.processing.analysisConsent);assert.ok(!body.includes('transcripción del audio quedó guardada'));assert.match(body,/tarea conserva/);assert.match(body,status==='NO_AUDIO_TRACK'?/No se encontró una pista/:status==='DIGITAL_SILENCE'?/silencio digital/:/transcripción no quedó confirmada/);}
 const visualMissing=videoEvidence();visualMissing.processing.result.visual.status='UNCONFIRMED';assert.match(metaFieldVideoResultText(visualMissing,visualMissing.processing.analysisConsent),/cuadros no quedó confirmado.*transcripción.*guardada/);
 const tampered=videoEvidence();tampered.processing.result.videoAudio.extraction.sourceSha256='f'.repeat(64);assert.match(metaFieldVideoResultText(tampered,tampered.processing.analysisConsent),/transcripción no quedó confirmada/);
 assert.match(metaFieldVideoResultText(e,fieldVideoAnalysisConsent(true,false)),/No autorizaste transcribir/);
});
test('only approved matching video transcript can feed existing manual PROPOSE_PROGRESS confirmation',()=>{
 const evidence=videoEvidence(),enhanced={...facts,evidence:[evidence]},extra={facts:enhanced},source=pick(pick(say('AVANCE',null,extra),'task-a',extra),'sector-a',extra);assert.match(source.reply.body,/audio o video/);
 const selected=pick(pick(source,'VOICE',extra),evidence.id,extra);assert.match(selected.reply.body,/audio del video/);assert.match(selected.reply.body,/video original/);noEffect(selected);
 const manual=pick(selected,'USE',extra);assert.equal(manual.state.sourceVoice.mediaKind,'video');assert.equal(manual.state.progress,undefined);noEffect(manual);
 const reason=say('2.5 / 10 M2',manual.state,extra),confirm=say('Medí el avance acumulado con la tarea y el video original.',reason.state,extra);noEffect(say('sí',confirm.state,extra));const saved=pick(confirm,'CONFIRM',extra);assert.equal(saved.command.action,'PROPOSE_PROGRESS');assert.equal(saved.command.payload.progress,25);assert.deepEqual(saved.command.payload.evidenceIds,[evidence.id]);assert.equal(saved.command.payload.revision,task.revision);
 for(const changed of [{...evidence,status:'PENDING'},{...evidence,revision:'2026-10-07T11:05:00.123457'}]){const stopped=pick(confirm,'CONFIRM',{facts:{...enhanced,evidence:[changed]}});noEffect(stopped);assert.match(stopped.reply.body,/video cambió/);}
});
test('silent, unconfirmed, unapproved or source-tampered videos never become a draft choice',()=>{
 const variants=[e=>{e.status='PENDING';},e=>{e.processing.result.videoAudio.status='DIGITAL_SILENCE';},e=>{e.processing.result.videoAudio.status='UNCONFIRMED';},e=>{e.processing.result.videoAudio.extraction.sourceSha256='f'.repeat(64);},e=>{e.processing.analysisConsent=fieldVideoAnalysisConsent(true,false);}];
 for(const mutate of variants){const e=videoEvidence();mutate(e);const extra={facts:{...facts,evidence:[e]}},measurement=pick(pick(say('AVANCE',null,extra),'task-a',extra),'sector-a',extra);assert.equal(measurement.state.step,'MEASUREMENT');noEffect(measurement);}
});
