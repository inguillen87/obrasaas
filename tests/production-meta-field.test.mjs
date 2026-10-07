import test from 'node:test';
import assert from 'node:assert/strict';
import {planMetaFieldConversation} from '../src/lib/meta-field-conversation.mjs';
import {metaFieldOperationId} from '../src/lib/meta-field-bridge.mjs';
import {operationId} from '../src/lib/workspace-policy.mjs';
import {fieldTransition,FIELD_ACTIONS} from '../src/lib/field-operations-policy.mjs';
import {FIELD_MEDIA_PRIVACY_NOTICE,FIELD_MEDIA_PRIVACY_NOTICE_SHA256,fieldMediaAnalysisConsent} from '../src/lib/field-media-privacy.mjs';
import {createHash} from 'node:crypto';
import {createVoiceProgressDraft} from '../src/lib/voice-progress-draft.mjs';
const now=new Date('2026-10-01T12:00:00Z'),facts={projectName:'Synthetic obra',workerId:'worker-a',permissions:{attendance:true,report:true},sectors:[{id:'sector-a',name:'Planta baja'}],tasks:[{id:'task-a',title:'Mampostería',progress:0,revision:'2026-10-01T12:00:00.123456'}],evidence:[],proposals:[],latest:null};
let sequence=0;
const run=(message,state=null,extra={})=>{const result=planMetaFieldConversation({message,state,eventId:'synthetic_'+(++sequence),facts,now,...extra});if(result.state)result.state={...result.state,version:1,expiresAt:new Date(now.getTime()+900000).toISOString()};return result;};
const say=(body,state,extra)=>run({type:'text',text:{body}},state,extra);
const pick=(plan,index=0,extra)=>run({type:'interactive',interactive:{type:'list_reply',list_reply:{id:plan.reply.sections[0].rows[index].id}}},plan.state,extra);
const pickValue=(plan,value,extra)=>pick(plan,plan.state.choices.findIndex(choice=>choice.value===value),extra);
// A persisted, markerless v1 selection keeps its original notice-before-file
// journey. New EVIDENCIA entries are exercised separately with real file type.
function legacyMediaNotice(){return run({type:'interactive',interactive:{type:'list_reply',list_reply:{id:'obra:'+'a'.repeat(20)+':0'}}},{version:1,purpose:'MEDIA',step:'SECTOR',taskId:facts.tasks[0].id,taskRevision:facts.tasks[0].revision,nonce:'a'.repeat(20),choices:[{value:'sector-a',title:'Planta baja'}],expiresAt:new Date(now.getTime()+900000).toISOString()});}
function voiceFacts(status='APPROVED',transcript='Hoy hicimos 2,5 metros cuadrados de mampostería.'){
 const task=facts.tasks[0],e={id:'evidence-voice',title:'Audio sintético revisado',taskId:task.id,revision:'2026-10-01T12:00:00.123458',status,media:{kind:'audio',sha256:'b'.repeat(64)},processing:{status:'TRANSCRIBED_UNREVIEWED',result:{text:transcript,progressDraft:createVoiceProgressDraft({transcript,evidenceId:'evidence-voice',evidenceRevision:'2026-10-01T12:00:00.123457',mediaSha256:'b'.repeat(64),transcriptSha256:createHash('sha256').update(transcript).digest('hex'),task})}}};
 return {...facts,evidence:[e]};
}
function startVoice(enhanced){const extra={facts:enhanced},task=say('AVANCE',null,extra),sector=pick(task,0,extra),source=pick(sector,0,extra),audio=pickValue(source,'VOICE',extra),review=pick(audio,0,extra);return {extra,review};}
test('approved voice draft stays in conversation but requires review, manual measurement and final interactive confirmation',()=>{
 const enhanced=voiceFacts(),{extra,review}=startVoice(enhanced);assert.match(review.reply.body,/Del día o adicional/);assert.match(review.reply.body,/2,5 m²/);assert.equal(review.command,undefined);assert.equal(review.state.progress,undefined);assert.equal(review.state.quantity,undefined);
 const plain=say('sí',review.state,extra);assert.equal(plain.command,undefined);assert.equal(plain.state.step,'VOICE_REVIEW');
 const measurement=pickValue(review,'USE',extra);assert.equal(measurement.command,undefined);assert.equal(measurement.state.progress,undefined);assert.match(measurement.reply.body,/cantidad acumulada/);
 const reason=say('2.5 / 10 M2',measurement.state,extra),confirmation=say('Verifiqué la cantidad acumulada y la unidad.',reason.state,extra),plainSave=say('Guardar',confirmation.state,extra);assert.equal(plainSave.command,undefined);
 const saved=pickValue(confirmation,'CONFIRM',extra);assert.deepEqual(saved.command,{action:'PROPOSE_PROGRESS',payload:{workerId:'worker-a',taskId:'task-a',revision:facts.tasks[0].revision,progress:25,quantity:'2.5000',baseline:'10.0000',unit:'M2',reason:'Verifiqué la cantidad acumulada y la unidad.',evidenceIds:['evidence-voice']}});
});
test('unreviewed, foreign-task or stale-context audio cannot appear as a proposal source',()=>{
 for(const status of ['PENDING','REJECTED']){const enhanced=voiceFacts(status),extra={facts:enhanced},measurement=pick(pick(say('AVANCE',null,extra),0,extra),0,extra);assert.equal(measurement.state.step,'MEASUREMENT');}
 const enhanced=voiceFacts();enhanced.tasks=[{...enhanced.tasks[0],revision:'2026-10-01T12:00:00.123459'}];const extra={facts:enhanced},measurement=pick(pick(say('AVANCE',null,extra),0,extra),0,extra);assert.equal(measurement.state.step,'MEASUREMENT');
});
test('task/evidence changes or revoked report permission block a prepared voice confirmation without a command',()=>{
 const enhanced=voiceFacts(),{extra,review}=startVoice(enhanced),measurement=pickValue(review,'USE',extra),reason=say('2.5 / 10 M2',measurement.state,extra),confirmation=say('Verifiqué la cantidad acumulada y la unidad.',reason.state,extra);
 for(const changed of [{...enhanced,tasks:[{...enhanced.tasks[0],revision:'2026-10-01T12:00:00.123459'}]},{...enhanced,evidence:[{...enhanced.evidence[0],status:'REJECTED'}]},{...enhanced,evidence:[{...enhanced.evidence[0],revision:'2026-10-01T12:00:00.123460'}]}]){
  const stopped=pickValue(confirmation,'CONFIRM',{facts:changed});assert.equal(stopped.command,undefined);assert.match(stopped.reply.body,/cambió/);assert.deepEqual(stopped.state,confirmation.state);
 }
 const denied=pickValue(confirmation,'CONFIRM',{facts:{...enhanced,permissions:{attendance:true,report:false}}});assert.equal(denied.command,undefined);assert.equal(denied.state,null);assert.match(denied.reply.body,/permisos/);
});
test('stale choices, plain affirmative text and expired drafts cannot authorize a business effect',()=>{
 const menu=say('MENU'),next=pickValue(menu,'INCIDENT'),old=pickValue(menu,'INCIDENT',{state:next.state});assert.equal(old.command,undefined);assert.match(old.reply.body,/paso anterior/);
 const task=pick(next),sector=pick(task),title=say('Acceso bloqueado',sector.state),details=say('El acceso principal requiere revisión.',title.state),priority=pick(details,1),plain=say('sí',priority.state);assert.equal(plain.command,undefined);
 const expired=pick(priority,0,{state:{...priority.state,expiresAt:'2026-09-01T12:00:00Z'}});assert.equal(expired.command,undefined);
 const final=pick(priority);assert.equal(final.command.action,'REPORT_INCIDENT');assert.equal(final.command.payload.severity,'MEDIUM');assert.equal(final.command.payload.workerId,facts.workerId);
});
test('worker material request confirms exact decimal, unit and reason without purchase authority',()=>{
 const task=say('MATERIALES'),sector=pick(task,0),name=pick(sector),amount=say('Cemento',name.state),unit=say('002.500',amount.state),reason=pick(unit,6),confirmation=say('Para la mezcla de la obra.',reason.state),saved=pick(confirmation);
 assert.deepEqual(saved.command.payload,{workerId:'worker-a',taskId:null,sectorId:'sector-a',name:'Cemento',quantity:'2.5',unit:'bolsa',reason:'Para la mezcla de la obra.',evidenceIds:[]});
 assert.equal(saved.command.action,'REQUEST_MATERIAL');assert.equal(saved.command.payload.purchaseAuthorized,undefined);
});
test('WhatsApp location needs explicit notice acceptance and remains unmeasured for review',()=>{
 const sector=say('ENTRADA'),notice=pick(sector),location=pick(notice),confirmation=run({type:'location',timestamp:String(now.getTime()/1000),location:{latitude:0,longitude:0}},location.state),saved=pick(confirmation);
 assert.equal(saved.command.action,'ATTENDANCE');assert.equal(saved.command.payload.location.accuracy,null);assert.equal(saved.command.payload.qrToken,null);assert.equal(saved.command.payload.location.noticeVersion,'field-location-v1');
 const unsolicited=run({type:'location',timestamp:String(now.getTime()/1000),location:{latitude:0,longitude:0}});assert.equal(unsolicited.command,undefined);
});
test('direct requests without a field permission explain the next step without a business effect',()=>{
 for(const [body,permissions] of [['ENTRADA',{attendance:false,report:true}],['INCIDENCIA',{attendance:true,report:false}]]){
  const result=say(body,null,{facts:{...facts,permissions}});assert.equal(result.state,null);assert.equal(result.command,undefined);assert.equal(result.media,undefined);assert.match(result.reply.body,/responsable.*permisos/);
 }
});
test('menus expose only current capabilities while retaining help and task/status reads',()=>{
 const reportOnly=say('MENU',null,{facts:{...facts,permissions:{attendance:false,report:true}}});
 assert.deepEqual(reportOnly.state.choices.map(choice=>choice.value),['TASKS','MEDIA','INCIDENT','MATERIAL','PROGRESS','STATUS']);
 const attendanceOnly=say('MENU',null,{facts:{...facts,permissions:{attendance:true,report:false}}});
 assert.deepEqual(attendanceOnly.state.choices.map(choice=>choice.value),['ATTEND_IN','TASKS','STATUS']);
 for(const menu of [reportOnly,attendanceOnly])assert.ok(menu.reply.sections[0].rows.length<=10);
});
test('revoked draft permission blocks a previously offered confirmation and media capability',()=>{
 const working={...facts,latest:{id:'attendance-a',eventType:'CHECK_IN',phase:'WORKING',verificationStatus:'REVIEW_REQUIRED'}},sector=say('PAUSA',null,{facts:working}),confirmation=pick(sector,0,{facts:working}),revoked=pick(confirmation,0,{facts:{...working,permissions:{attendance:false,report:true}}});
 assert.equal(revoked.state,null);assert.equal(revoked.command,undefined);assert.match(revoked.reply.body,/no tiene habilitado/);
 const task=say('EVIDENCIA'),place=pick(task),pending=pick(place),media=run({type:'image',image:{id:'123456789012345',mime_type:'image/jpeg'}},pending.state,{facts:{...facts,permissions:{attendance:true,report:false}}});
 assert.equal(media.state,null);assert.equal(media.media,undefined);assert.match(media.reply.body,/permisos/);
});
test('progress with no approved evidence preserves task and asks for human review first',()=>{
 const task=say('AVANCE'),sector=pick(task),measurement=pick(sector),result=say('25%',measurement.state);assert.equal(result.command,undefined);assert.equal(result.state,null);assert.match(result.reply.body,/evidencia revisada/);
});
test('quantitative proposal binds the selected task revision and approved evidence',()=>{
 const enhanced={...facts,evidence:[{id:'evidence-a',title:'Foto revisada',taskId:'task-a',status:'APPROVED'}]},task=say('AVANCE',null,{facts:enhanced}),sector=pick(task,0,{facts:enhanced}),measurement=pick(sector,0,{facts:enhanced}),evidence=say('2.5 / 10 M2',measurement.state,{facts:enhanced}),reason=pick(evidence,0,{facts:enhanced}),confirmation=say('Medí el área ejecutada en el sector.',reason.state,{facts:enhanced}),saved=pick(confirmation,0,{facts:enhanced});
 assert.equal(saved.command.action,'PROPOSE_PROGRESS');assert.equal(saved.command.payload.progress,25);assert.equal(saved.command.payload.quantity,'2.5000');assert.equal(saved.command.payload.revision,facts.tasks[0].revision);assert.deepEqual(saved.command.payload.evidenceIds,['evidence-a']);
});
test('legacy v1 media is attached only after canonical task and sector selection, never from webhook URLs',()=>{
 const notice=legacyMediaNotice(),pending=pickValue(notice,'ANALYZE'),result=run({type:'image',image:{id:'123456789012345',mime_type:'image/jpeg',caption:'Trabajo del sector',url:'https://evil.invalid/private'}},pending.state);
 assert.equal(result.media.mediaId,'123456789012345');assert.equal(result.media.taskId,'task-a');assert.equal(result.media.sectorId,'sector-a');assert.equal(result.media.url,undefined);
 const unsolicited=run({type:'image',image:{id:'123456789012345'}});assert.equal(unsolicited.media,undefined);
});
test('legacy v1 optional media analysis requires a current interactive choice for image, audio and video',()=>{
 assert.equal(createHash('sha256').update(FIELD_MEDIA_PRIVACY_NOTICE).digest('hex'),FIELD_MEDIA_PRIVACY_NOTICE_SHA256);
 for(const kind of ['image','audio','video'])for(const allowed of [false,true]){
  const notice=legacyMediaNotice();assert.match(notice.reply.body,/OpenAI.*cuatro cuadros/);assert.match(notice.reply.body,/sin audio/);
  const plain=say('sí',notice.state);assert.equal(plain.media,undefined);assert.equal(plain.state.step,'MEDIA_NOTICE');
  const pending=pickValue(notice,allowed?'ANALYZE':'SAVE_ONLY'),uploaded=run({type:kind,[kind]:{id:'123456789012345',mime_type:kind==='image'?'image/jpeg':kind==='audio'?'audio/ogg':'video/mp4'}},pending.state);
  assert.deepEqual(uploaded.media.analysisConsent,fieldMediaAnalysisConsent(allowed));assert.ok(uploaded.media.analysisConsentEventId);assert.equal(uploaded.media.taskId,'task-a');assert.equal(uploaded.media.sectorId,'sector-a');
 }
 const legacy={version:1,expiresAt:new Date(now.getTime()+900000).toISOString(),purpose:'MEDIA',step:'MEDIA',taskId:'task-a',sectorId:'sector-a'};
 const old=run({type:'video',video:{id:'123456789012345',mime_type:'video/mp4'}},legacy);assert.equal(old.media,undefined);assert.equal(old.state.step,'MEDIA_NOTICE');
 const forged=run({type:'video',video:{id:'123456789012345',mime_type:'video/mp4'}},{...legacy,analysisConsent:{...fieldMediaAnalysisConsent(true),noticeSha256:'f'.repeat(64)}});assert.equal(forged.media,undefined);
});
test('event-derived operation id survives restarts and distinguishes business purposes',()=>{
 const first=metaFieldOperationId('event-a','ATTENDANCE');assert.ok(operationId(first));assert.equal(first,metaFieldOperationId('event-a','ATTENDANCE'));assert.notEqual(first,metaFieldOperationId('event-a','REPORT_INCIDENT'));assert.notEqual(first,metaFieldOperationId('event-b','ATTENDANCE'));
});
test('journey options follow the canonical transition for empty, working, paused and closed shifts',()=>{
 const actionByEvent={CHECK_IN:'ATTEND_IN',BREAK_START:'ATTEND_PAUSE',BREAK_END:'ATTEND_RESUME',CHECK_OUT:'ATTEND_OUT'};
 for(const latest of [null,{id:'attendance-a',eventType:'CHECK_IN',phase:'WORKING',verificationStatus:'REVIEW_REQUIRED'},{id:'attendance-b',eventType:'BREAK_START',phase:'ON_BREAK'},{id:'attendance-c',eventType:'BREAK_END',phase:'WORKING'},{id:'attendance-d',eventType:'CHECK_OUT',phase:'WORKING'}]){
  const expected=FIELD_ACTIONS.filter(action=>{try{fieldTransition(action,latest);return true;}catch{return false;}}).map(action=>actionByEvent[action]);
  const result=say('AYUDA',null,{facts:{...facts,latest}});
  assert.deepEqual(result.state.choices.filter(choice=>choice.value.startsWith('ATTEND_')).map(choice=>choice.value),expected);
  assert.ok(result.state.choices.some(choice=>choice.value==='STATUS'));assert.ok(result.reply.sections[0].rows.length<=10);
 }
});
test('unavailable direct journey commands explain the next action without collecting location or confirming',()=>{
 for(const [body,latest,expected] of [['SALIDA',null,/entrada/],['ENTRADA',{id:'attendance-a',eventType:'CHECK_IN',phase:'WORKING'},/jornada abierta/],['SALIDA',{id:'attendance-b',eventType:'BREAK_START',phase:'ON_BREAK'},/regreso de pausa/]]){
  const result=say(body,null,{facts:{...facts,latest}});
  assert.equal(result.command,undefined);assert.equal(result.state.purpose,'MENU');assert.match(result.reply.body,expected);
 }
});
test('invalid progress quantities remain a correction step and can complete the same evidence-backed draft',()=>{
 const enhanced={...facts,evidence:[{id:'evidence-a',title:'Foto revisada',taskId:'task-a',status:'APPROVED'}]},task=say('AVANCE',null,{facts:enhanced}),sector=pick(task,0,{facts:enhanced}),measurement=pick(sector,0,{facts:enhanced});
 for(const value of ['2.5 / 0 M2','02.5 / 10 M2','100000000000000 / 100000000000000 M2','11 / 10 M2','2,5 / 10 M2']){
  const correction=say(value,measurement.state,{facts:enhanced});assert.equal(correction.command,undefined);assert.deepEqual(correction.state,measurement.state);assert.match(correction.reply.body,/25%.*2\.5 \/ 10 M2/);
 }
 const evidence=say('2.5 / 10 M2',measurement.state,{facts:enhanced}),reason=pick(evidence,0,{facts:enhanced}),confirmation=say('Medí el área ejecutada en el sector.',reason.state,{facts:enhanced}),saved=pick(confirmation,0,{facts:enhanced});
 assert.equal(saved.command.payload.taskId,'task-a');assert.equal(confirmation.state.sectorId,'sector-a');assert.equal(saved.command.payload.progress,25);assert.deepEqual(saved.command.payload.evidenceIds,['evidence-a']);
});
test('invalid text and material amount preserve selected context and ask for a specific correction',()=>{
 const task=say('MATERIALES'),sector=pick(task,0),name=pick(sector),quantity=say('Cemento',name.state);
 for(const value of ['2,5','0','1000000000','2.1234']){const result=say(value,quantity.state);assert.deepEqual(result.state,quantity.state);assert.equal(result.command,undefined);assert.match(result.reply.body,/2\.5.*3 decimales/);}
 const unit=say('2.5',quantity.state),reason=pick(unit,6),invalid=say('corto',reason.state);assert.deepEqual(invalid.state,reason.state);assert.match(invalid.reply.body,/8.*2000/);
 const saved=pick(say('Para la mezcla de la obra.',invalid.state));assert.equal(saved.command.payload.name,'Cemento');assert.equal(saved.command.payload.quantity,'2.5');assert.equal(saved.command.payload.sectorId,'sector-a');
 const incident=pick(pick(say('INCIDENCIA'),0));const short=say('ab',incident.state);assert.deepEqual(short.state,incident.state);assert.match(short.reply.body,/3.*160/);
});
