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
for(const [body,taskChoice] of [
 ['ENTRADA',null],
 ['EVIDENCIA','task-a'],
 ['MATERIALES','NONE']
])test(body+' without configured sectors directs the worker to an administrator or director',()=>{
 const extra={facts:{...facts,sectors:[]}};
 const initial=say(body,null,extra);
 const result=taskChoice?pickValue(initial,taskChoice,extra):initial;
 assert.equal(result.state,null);
 assert.equal(result.command,undefined);
 assert.equal(result.media,undefined);
 assert.equal(result.reply.type,'text');
 assert.match(result.reply.body,/Pedí al administrador o director/);
 assert.match(result.reply.body,/al menos un sector.*Mi cuenta/);
 assert.match(result.reply.body,/volvé a iniciar este registro/);
 assert.doesNotMatch(result.reply.body,/Podés hacerlo/);
});

test('direct requests without a field permission explain the next step without a business effect',()=>{
 for(const [body,permissions] of [['ENTRADA',{attendance:false,report:true}],['INCIDENCIA',{attendance:true,report:false}]]){
  const result=say(body,null,{facts:{...facts,permissions}});assert.equal(result.state,null);assert.equal(result.command,undefined);assert.equal(result.media,undefined);assert.match(result.reply.body,/responsable.*permisos/);
 }
});

test('HOLA reads current journey and permissions with no draft or from a menu',()=>{
 const working={...facts,latest:{id:'attendance-a',eventType:'CHECK_IN',phase:'WORKING',verificationStatus:'REVIEW_REQUIRED'}},oldMenu=say('MENU');
 for(const state of [null,oldMenu.state]){
  const greeting=planMetaFieldConversation({message:{type:'text',text:{body:'  hOlA  '}},state,eventId:'hello-current-menu',facts:working,now});
  assert.deepEqual(greeting.state.choices.filter(choice=>choice.value.startsWith('ATTEND_')).map(choice=>choice.value),['ATTEND_PAUSE','ATTEND_OUT']);
  assert.equal(greeting.state.step,'MENU');assert.equal(greeting.command,undefined);assert.equal(greeting.media,undefined);assert.equal(greeting.preserveConversation,undefined);
 }
 const reportOnly=say('HOLA',null,{facts:{...facts,permissions:{attendance:false,report:true}}});assert.ok(reportOnly.state.choices.every(choice=>!choice.value.startsWith('ATTEND_')));assert.ok(reportOnly.state.choices.some(choice=>choice.value==='MEDIA'));
 const pilot=say('HOLA',null,{facts:{...facts,attendanceOnly:true,permissions:{attendance:true,report:false}}});assert.deepEqual(pilot.state.choices.map(choice=>choice.value),['ATTEND_IN','STATUS']);
});
test('GANTT and CRONOGRAMA consult current registered dates and progress without an import role',()=>{
 const current={...facts,projectId:'project-a',planImportRole:'AUDITOR',permissions:{attendance:true,report:false},tasks:[{...facts.tasks[0],status:'IN_PROGRESS',progress:37,startsOn:'2026-10-13',endsOn:'2026-10-21',budgetAmount:'PRIVATE_FINANCIAL_AMOUNT'}]};
 for(const body of ['GANTT','CRONOGRAMA','TAREAS']){
  const read=say(body,null,{facts:current});assert.equal(read.state.purpose,'TASKS');assert.match(read.reply.body,/2026-10-13 → 2026-10-21/);assert.match(read.reply.body,/37%/);assert.match(read.reply.body,/https:\/\/obrasaas.com\/cuenta\?obra=project-a#schedule-gantt-title/);assert.doesNotMatch(read.reply.body,/PRIVATE_FINANCIAL_AMOUNT/);assert.equal(read.command,undefined);assert.equal(read.media,undefined);assert.equal(read.planImport,undefined);
  const detail=pickValue(read,'task-a',{facts:current});assert.match(detail.reply.body,/Estado registrado: En curso/);assert.match(detail.reply.body,/Avance registrado: 37%/);assert.equal(detail.state.taskId,undefined);assert.equal(detail.command,undefined);
 }
});
test('schedule reads preserve exact live attendance, media, incident and material drafts and their original choice',()=>{
 for(const body of ['ENTRADA','EVIDENCIA','INCIDENCIA','MATERIALES'])for(const command of ['GANTT','CRONOGRAMA','TAREAS']){
  const original=say(body),state=Object.freeze({...original.state,lastEventId:'original-draft-event',expiresAt:'2026-10-01T12:01:00.000Z',choices:Object.freeze(original.state.choices.map(choice=>Object.freeze({...choice})))}),before=JSON.stringify(state);
  const read=planMetaFieldConversation({message:{type:'text',text:{body:command}},state,eventId:'later-read-event',facts:{...facts,projectId:'project-a'},now});
  assert.equal(read.state,state);assert.equal(read.preserveConversation,true);assert.equal(JSON.stringify(state),before);assert.match(read.reply.body,/Conservamos el borrador y su mensaje original/);assert.equal(read.command,undefined);assert.equal(read.media,undefined);assert.equal(read.planImport,undefined);
  const continued=planMetaFieldConversation({message:{type:'interactive',interactive:{type:'list_reply',list_reply:{id:original.reply.sections[0].rows[0].id}}},state:read.state,eventId:'resume-original-event',facts,now});assert.equal(continued.state.step,body==='ENTRADA'?'LOCATION_NOTICE':'SECTOR');assert.equal(continued.command,undefined);assert.equal(continued.media,undefined);
 }
});
test('attendance-only pilot refuses schedule aliases and legacy TASKS capabilities without losing a draft',()=>{
 const limited={...facts,attendanceOnly:true,projectId:'project-a',tasks:[{...facts.tasks[0],startsOn:'2026-10-13',endsOn:'2026-10-21',progress:37}]},original=say('ENTRADA'),state=Object.freeze({...original.state}),legacy=say('TAREAS');
 for(const command of ['GANTT','CRONOGRAMA','TAREAS'])for(const active of [null,state]){
  const read=planMetaFieldConversation({message:{type:'text',text:{body:command}},state:active,eventId:'limited-read',facts:limited,now});assert.equal(read.state,active);assert.match(read.reply.body,/sólo habilita jornada/);assert.doesNotMatch(read.reply.body,/Mampostería|2026-10-13|37%|cuenta\?/);assert.equal(read.command,undefined);assert.equal(read.planImport,undefined);if(active)assert.equal(read.preserveConversation,true);
 }
 const oldChoice=planMetaFieldConversation({message:{type:'interactive',interactive:{type:'list_reply',list_reply:{id:legacy.reply.sections[0].rows[0].id}}},state:legacy.state,eventId:'legacy-limited-read',facts:limited,now});assert.equal(oldChoice.state,legacy.state);assert.equal(oldChoice.preserveConversation,true);assert.doesNotMatch(oldChoice.reply.body,/Mampostería|37%/);
 const menu=planMetaFieldConversation({message:{type:'text',text:{body:'MENU'}},state:legacy.state,eventId:'leave-legacy-limited-read',facts:limited,now});assert.equal(menu.state.purpose,'MENU');assert.deepEqual(menu.state.choices.map(choice=>choice.value),['ATTEND_IN','STATUS']);assert.equal(menu.preserveConversation,undefined);assert.doesNotMatch(menu.reply.body,/Mampostería|37%/);
});
test('unknown or invalid task dates/status/progress are shown for review without inventing registered values',()=>{
 for(const patch of [{startsOn:null,endsOn:null,status:null,progress:NaN},{startsOn:'2026-02-30',endsOn:'2026-03-01',status:'constructor',progress:101},{startsOn:'2026-10-21',endsOn:'2026-10-13',status:'UNKNOWN',progress:-1}]){
  const current={...facts,tasks:[{...facts.tasks[0],...patch}]},read=say('GANTT',null,{facts:current}),detail=pickValue(read,'task-a',{facts:current});assert.match(detail.reply.body,/Sin fechas previstas|Fechas por revisar/);assert.match(detail.reply.body,/Estado por confirmar/);assert.match(detail.reply.body,/Avance registrado: sin confirmar/);assert.doesNotMatch(detail.reply.body,/2026-02-30|101%|-1%|\[object Object\]/);assert.equal(detail.command,undefined);assert.equal(detail.planImport,undefined);
 }
});
test('schedule keeps all eight tasks and both page controls within the COMPANY body budget at maximum names',()=>{
 const prefix='Obra: '+'O'.repeat(160)+'\n',rows=Array.from({length:8},(_,index)=>({...facts.tasks[0],id:'task-'+index,title:'😀'.repeat(80),progress:37.12345678901234,status:'IN_PROGRESS',startsOn:'2026-10-13',endsOn:'2026-10-21'})),current={...facts,projectName:'O'.repeat(160),projectId:'p'.repeat(128),replyBodyLimit:1024-prefix.length,tasks:rows,taskPage:{hasPrevious:true,hasNext:true}};
 const read=say('GANTT',null,{facts:current});assert.ok(prefix.length+read.reply.body.length<=1024);assert.equal(read.state.choices.length,10);assert.deepEqual(read.state.choices.map(choice=>choice.value),[...rows.map(row=>row.id),'PREVIOUS_TASKS','NEXT_TASKS']);assert.match(read.reply.body,/Vista parcial/);assert.match(read.reply.body,/2026-10-13 → 2026-10-21/);assert.equal(read.planImport,undefined);
 const detail=pickValue(read,'task-7',{facts:current});assert.ok(prefix.length+detail.reply.body.length<=1024);assert.equal(detail.state.choices.length,10);assert.match(detail.reply.body,/Avance registrado: 37\.12345678901234%/);
});
test('maximum COMPANY schedule read reserves the live draft and authorized-attempt instruction inside its body budget',()=>{
 const at=new Date('2026-10-13T20:00:00.000Z'),prefix='Obra: '+'O'.repeat(160)+'\n',rows=Array.from({length:8},(_,index)=>({id:'task-'+index,title:'😀'.repeat(80),progress:37.12345678901234,status:'IN_PROGRESS',startsOn:'2026-10-13',endsOn:'2026-10-21'})),current={...facts,projectName:'O'.repeat(160),projectId:'p'.repeat(128),replyBodyLimit:1024-prefix.length,tasks:rows,taskPage:{hasPrevious:true,hasNext:true}};
 for(const step of ['PLAN_IMPORT_FILE','PLAN_IMPORT_NOTICE','PLAN_IMPORT_AUTHORIZED']){
  const state=Object.freeze({version:1,purpose:'PLAN_IMPORT',step,nonce:'c'.repeat(20),lastEventId:'original-plan-event',expiresAt:'2026-10-13T20:30:00.000Z',pendingFile:Object.freeze({eventId:'original-file-event'})}),before=JSON.stringify(state),read=planMetaFieldConversation({message:{type:'text',text:{body:'GANTT'}},state,eventId:'maximum-draft-read-event',facts:current,now:at});
  assert.ok(prefix.length+read.reply.body.length<=1024,'Actual COMPANY body length '+(prefix.length+read.reply.body.length));assert.equal(read.state,state);assert.equal(JSON.stringify(state),before);assert.equal(read.preserveConversation,true);assert.match(read.reply.body,/\nConservamos el borrador y su mensaje original/);assert.match(read.reply.body,/Respondé a ese paso para continuar/);assert.match(read.reply.body,/esta consulta no guarda ni extrae otro archivo/);assert.equal(read.reply.body.split('2026-10-13 → 2026-10-21').length-1,8);assert.equal(read.reply.body.split('37.12345678901234%').length-1,8);assert.match(read.reply.body,/Vista parcial/);assert.equal(read.command,undefined);assert.equal(read.planImport,undefined);assert.equal(read.media,undefined);
  if(step==='PLAN_IMPORT_AUTHORIZED')assert.match(read.reply.body,/El archivo ya fue autorizado: comprobá el mismo intento desde Cuenta\.$/);
 }
});
test('schedule link accepts only the canonical local project hint and never a caller URL or source-project override',()=>{
 for(const projectId of ['../foreign','https://foreign.invalid',undefined]){const read=say('GANTT',null,{facts:{...facts,projectId,sourceProjectId:'foreign-source-project',link:'https://foreign.invalid/private'}});assert.doesNotMatch(read.reply.body,/https:\/\/|foreign/);assert.equal(read.state.purpose,'TASKS');}
});
test('HOLA preserves exact live attendance, media and material drafts then accepts only their original nonce',()=>{
 for(const body of ['ENTRADA','EVIDENCIA','MATERIALES']){
  const initial=say(body),state=Object.freeze({...initial.state,lastEventId:'durable-original-event',lastReceivedAt:'2026-10-01T11:59:59.900Z',lastMessageTimestamp:1790855999,expiresAt:'2026-10-01T12:01:00.000Z',choices:Object.freeze(initial.state.choices.map(choice=>Object.freeze({...choice})))}),before=JSON.stringify(state);
  const greeting=planMetaFieldConversation({message:{type:'text',text:{body:'HOLA'}},state,eventId:'later-hello-event',facts,now});
  assert.equal(greeting.state,state);assert.equal(JSON.stringify(state),before);assert.equal(greeting.preserveConversation,true);assert.equal(greeting.command,undefined);assert.equal(greeting.media,undefined);assert.match(greeting.reply.body,/mensaje original/);
  const wrong=planMetaFieldConversation({message:{type:'interactive',interactive:{type:'list_reply',list_reply:{id:'obra:'+'f'.repeat(20)+':0'}}},state:greeting.state,eventId:'wrong-choice',facts,now});assert.equal(wrong.state,state);assert.equal(wrong.command,undefined);assert.equal(wrong.media,undefined);assert.match(wrong.reply.body,/paso anterior/);
  const continued=planMetaFieldConversation({message:{type:'interactive',interactive:{type:'list_reply',list_reply:{id:initial.reply.sections[0].rows[0].id}}},state:greeting.state,eventId:'original-choice-after-hello',facts,now});
  assert.equal(continued.state.step,body==='ENTRADA'?'LOCATION_NOTICE':'SECTOR');assert.equal(continued.command,undefined);assert.equal(continued.media,undefined);
 }
});
test('HOLA does not grant a revoked draft permission or replace its durable state',()=>{
 for(const [body,permissions] of [['ENTRADA',{attendance:false,report:true}],['EVIDENCIA',{attendance:true,report:false}],['MATERIALES',{attendance:true,report:false}]]){
  const initial=say(body),state=Object.freeze({...initial.state,lastEventId:'durable-before-revocation'}),changed={...facts,permissions};
  const greeting=planMetaFieldConversation({message:{type:'text',text:{body:'HOLA'}},state,eventId:'hello-after-permission-change',facts:changed,now});
  assert.equal(greeting.state,state);assert.equal(greeting.preserveConversation,true);assert.equal(greeting.command,undefined);assert.equal(greeting.media,undefined);assert.match(greeting.reply.body,/permisos/);assert.doesNotMatch(greeting.reply.body,/para continuar/);
  const denied=planMetaFieldConversation({message:{type:'interactive',interactive:{type:'list_reply',list_reply:{id:initial.reply.sections[0].rows[0].id}}},state:greeting.state,eventId:'old-choice-after-revocation',facts:changed,now});assert.equal(denied.state,null);assert.equal(denied.command,undefined);assert.equal(denied.media,undefined);
 }
});
test('HOLA preserves an exact material quantity step until the original draft is continued or explicitly cancelled',()=>{
 const task=say('MATERIALES'),sector=pick(task,0),name=pick(sector),amount=say('Cemento',name.state),state=Object.freeze({...amount.state,lastEventId:'original-material-prompt'}),before=JSON.stringify(state);
 const hello=planMetaFieldConversation({message:{type:'text',text:{body:'HOLA'}},state,eventId:'hello-material-quantity',facts,now});
 assert.equal(hello.state,state);assert.equal(JSON.stringify(state),before);assert.equal(hello.preserveConversation,true);assert.equal(hello.command,undefined);assert.equal(hello.media,undefined);
 const unit=say('002.500',hello.state),reason=pick(unit,6),confirmation=say('Para la mezcla de la obra.',reason.state),saved=pick(confirmation);
 assert.equal(saved.command.action,'REQUEST_MATERIAL');assert.equal(saved.command.payload.name,'Cemento');assert.equal(saved.command.payload.quantity,'2.5');assert.equal(saved.command.payload.unit,'bolsa');
 const cancelled=say('CANCELAR',state);assert.equal(cancelled.state.purpose,'MENU');assert.equal(cancelled.command,undefined);assert.equal(cancelled.media,undefined);
});
test('HOLA cannot renew an expired draft or authorize its old choice',()=>{
 const initial=say('ENTRADA'),expired=Object.freeze({...initial.state,expiresAt:now.toISOString(),lastEventId:'expired-original-event'}),before=JSON.stringify(expired);
 const greeting=planMetaFieldConversation({message:{type:'text',text:{body:'HOLA'}},state:expired,eventId:'hello-after-expiry',facts,now});
 assert.equal(JSON.stringify(expired),before);assert.notEqual(greeting.state,expired);assert.equal(greeting.state.step,'MENU');assert.equal(greeting.preserveConversation,undefined);assert.equal(greeting.command,undefined);assert.equal(greeting.media,undefined);
 const stale=planMetaFieldConversation({message:{type:'interactive',interactive:{type:'list_reply',list_reply:{id:initial.reply.sections[0].rows[0].id}}},state:{...greeting.state,version:1,expiresAt:'2026-10-01T12:15:00.000Z'},eventId:'old-expired-choice',facts,now});assert.equal(stale.command,undefined);assert.equal(stale.media,undefined);assert.match(stale.reply.body,/paso anterior/);
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
const progressDeadline='2026-10-01T12:04:00.000Z';
const waitingAt=new Date('2026-10-01T12:01:00.000Z');
function rawProgress(message,state,current=facts,at=waitingAt){return planMetaFieldConversation({message,state,eventId:'progress_wait_'+(++sequence),facts:current,now:at});}
const waitSay=(body,state,current,at)=>rawProgress({type:'text',text:{body}},state,current,at);
function waitPick(plan,value,current,at){const index=plan.state.choices.findIndex(choice=>choice.value===value);assert.notEqual(index,-1);return rawProgress({type:'interactive',interactive:{type:'list_reply',list_reply:{id:plan.reply.sections[0].rows[index].id}}},plan.state,current,at);}
function waitingProgress(value='25%',current=facts,mode=null){
 const extra={facts:current},task=say('AVANCE',null,extra),sector=pick(task,0,extra),measurement=pick(sector,0,extra),input=mode?pickValue(measurement,mode,extra):measurement;
 const state=Object.freeze({...input.state,expiresAt:progressDeadline}),before=JSON.stringify(state),result=waitSay(value,state,current);
 assert.equal(JSON.stringify(state),before);return result;
}
function measuredWaitFacts(){return {...facts,tasks:[{...facts.tasks[0],progress:25,measurement:{version:'task-progress-measurement-v1',definitionId:'measurement-a',baseline:'10.0000',unit:'M2',executed:'2.5000',sourceReference:'Planilla sintética A-01',configuredAt:'2026-10-01T11:00:00.000Z',approvedProposalId:'previous-proposal',approvedAt:'2026-10-01T11:30:00.000Z'}}]};}
const reviewedPhoto={id:'evidence-a',title:'Foto revisada',taskId:'task-a',status:'APPROVED'};

for(const [label,value,mode]of [['percentage','25%',null],['legacy quantity','2.5 / 10 M2',null],['daily quantity','1','DELTA'],['cumulative quantity','3.5','CUMULATIVE']])test('missing approved evidence retains '+label+' and its original deadline without a proposal',()=>{
 const current=mode?measuredWaitFacts():facts,result=waitingProgress(value,current,mode);
 assert.equal(result.state.step,'PROGRESS_EVIDENCE_WAIT');assert.equal(result.state.taskId,'task-a');assert.equal(result.state.sectorId,'sector-a');assert.equal(result.state.taskRevision,current.tasks[0].revision);assert.equal(result.state.expiresAt,progressDeadline);assert.deepEqual(result.state.progressEvidenceWait,{version:1,deadline:progressDeadline});
 assert.equal(result.state.progress,mode?35:25);assert.equal(result.state.quantity,label==='percentage'?null:mode?'3.5000':'2.5000');assert.equal(result.state.baseline,label==='percentage'?null:'10.0000');assert.equal(result.state.unit,label==='percentage'?null:'M2');
 if(mode){assert.deepEqual(result.state.measurement,{mode,quantity:mode==='DELTA'?'1.0000':'3.5000'});assert.equal(result.state.measurementDefinitionId,'measurement-a');assert.equal(result.state.measurementSummary.previous,'2.5000');}
 assert.deepEqual(result.state.choices.map(choice=>choice.value),['RECHECK_EVIDENCE','CANCEL']);assert.ok(result.reply.sections[0].rows.every(row=>row.title.length<=24));assert.match(result.reply.body,/evidencia revisada y aprobada/);assert.equal(result.preserveConversation,undefined);assert.equal(result.command,undefined);assert.equal(result.media,undefined);
});

test('rechecking rotates only the prompt and reaches a proposal only after approved evidence, reason and final confirmation',()=>{
 const current={...facts,evidence:[{...reviewedPhoto,status:'PENDING'},{...reviewedPhoto,id:'rejected-photo',status:'REJECTED'},{...reviewedPhoto,id:'other-task-photo',taskId:'other-task'}]},waiting=waitingProgress('2.5 / 10 M2',current),before=JSON.stringify(waiting.state),rechecked=waitPick(waiting,'RECHECK_EVIDENCE',current,new Date('2026-10-01T12:02:00.000Z'));
 assert.equal(JSON.stringify(waiting.state),before);assert.notEqual(rechecked.state.nonce,waiting.state.nonce);assert.equal(rechecked.state.expiresAt,progressDeadline);assert.equal(rechecked.command,undefined);assert.equal(rechecked.preserveConversation,undefined);
 for(const key of ['taskId','taskRevision','sectorId','progress','quantity','baseline','unit','progressEvidenceWait'])assert.deepEqual(rechecked.state[key],waiting.state[key]);
 const stale=rawProgress({type:'interactive',interactive:{type:'list_reply',list_reply:{id:waiting.reply.sections[0].rows[0].id}}},rechecked.state,current,new Date('2026-10-01T12:02:30.000Z'));assert.equal(stale.state,rechecked.state);assert.equal(stale.preserveConversation,true);assert.match(stale.reply.body,/paso anterior/);assert.equal(stale.command,undefined);
 const approved={...current,evidence:[reviewedPhoto]},evidence=waitPick(rechecked,'RECHECK_EVIDENCE',approved,new Date('2026-10-01T12:03:00.000Z'));assert.equal(evidence.state.step,'PROGRESS_EVIDENCE');assert.equal(evidence.state.expiresAt,progressDeadline);assert.equal(evidence.command,undefined);
 const afterApproval=new Date('2026-10-01T12:03:30.000Z'),invalidChoice=waitSay('evidence-a',evidence.state,approved,afterApproval);assert.equal(invalidChoice.state,evidence.state);assert.equal(invalidChoice.preserveConversation,true);assert.equal(invalidChoice.command,undefined);
 const reason=waitPick(evidence,'evidence-a',approved,afterApproval),invalid=waitSay('corto',reason.state,approved,afterApproval);assert.equal(invalid.state,reason.state);assert.equal(invalid.state.expiresAt,progressDeadline);assert.equal(invalid.command,undefined);
 const confirmation=waitSay('Medí el área ejecutada en el sector.',reason.state,approved,afterApproval),plain=waitSay('Guardar',confirmation.state,approved,afterApproval);assert.equal(confirmation.state.expiresAt,progressDeadline);assert.equal(plain.command,undefined);assert.equal(plain.state.step,'CONFIRM');
 const saved=waitPick(confirmation,'CONFIRM',approved,afterApproval);assert.equal(saved.state,null);assert.deepEqual(saved.command,{action:'PROPOSE_PROGRESS',payload:{workerId:'worker-a',taskId:'task-a',revision:facts.tasks[0].revision,progress:25,quantity:'2.5000',baseline:'10.0000',unit:'M2',reason:'Medí el área ejecutada en el sector.',evidenceIds:['evidence-a']}});
});

test('resumed daily and cumulative drafts keep the original reported quantity and approved baseline through confirmation',()=>{
 for(const mode of ['DELTA','CUMULATIVE']){
  const current=measuredWaitFacts(),waiting=waitingProgress(mode==='DELTA'?'1':'3.5',current,mode),approved={...current,evidence:[reviewedPhoto]},evidence=waitPick(waiting,'RECHECK_EVIDENCE',approved),reason=waitPick(evidence,'evidence-a',approved),confirmation=waitSay('Verifiqué la cantidad y el alcance informado.',reason.state,approved);
  for(const step of [evidence,reason,confirmation]){assert.deepEqual(step.state.measurement,waiting.state.measurement);assert.deepEqual(step.state.measurementSummary,waiting.state.measurementSummary);assert.equal(step.state.measurementDefinitionId,'measurement-a');assert.equal(step.state.expiresAt,progressDeadline);assert.equal(step.command,undefined);}
  const saved=waitPick(confirmation,'CONFIRM',approved);assert.deepEqual(saved.command,{action:'PROPOSE_PROGRESS',payload:{workerId:'worker-a',taskId:'task-a',revision:current.tasks[0].revision,measurement:{mode,quantity:mode==='DELTA'?'1.0000':'3.5000'},reason:'Verifiqué la cantidad y el alcance informado.',evidenceIds:['evidence-a']}});
 }
});

test('waiting progress reads, plain text and other aliases preserve the exact prompt until explicit cancellation',()=>{
 const waiting=waitingProgress(),state=Object.freeze({...waiting.state,lastEventId:'original-wait-prompt'}),before=JSON.stringify(state);
 for(const body of ['HOLA','ESTADO','TAREAS','AVANCES','EVIDENCIAS','CONSUMOS','AVANCE','EVIDENCIA','MENU','Consultar evidencia','RECHECK_EVIDENCE','sí']){
  const read=waitSay(body,state,facts,new Date('2026-10-01T12:03:59.000Z'));assert.equal(read.state,state,body);assert.equal(read.preserveConversation,true,body);assert.equal(read.command,undefined);assert.equal(read.media,undefined);assert.equal(read.state.expiresAt,progressDeadline);
 }
 assert.equal(JSON.stringify(state),before);
 const cancelled=waitPick(waiting,'CANCEL');assert.equal(cancelled.state,null);assert.equal(cancelled.command,undefined);assert.match(cancelled.reply.body,/cancelado/);
 const textCancelled=waitSay('CANCELAR',state);assert.equal(textCancelled.state.purpose,'MENU');assert.equal(textCancelled.state.progressEvidenceWait,undefined);assert.equal(textCancelled.command,undefined);
});

test('waiting progress cannot resume with changed task revision, removed task or changed measurement definition',()=>{
 for(const current of [facts,measuredWaitFacts()]){
  const waiting=waitingProgress(current===facts?'25%':'1',current,current===facts?null:'DELTA'),task=current.tasks[0],changes=[{...current,tasks:[]},{...current,tasks:[{...task,revision:'2026-10-01T12:02:00.000001'}]},{...current,tasks:[{...task,measurement:{...(task.measurement||{}),definitionId:'changed-definition'}}]}];
  for(const changed of changes){const stopped=waitPick(waiting,'RECHECK_EVIDENCE',changed);assert.equal(stopped.state,waiting.state);assert.equal(stopped.preserveConversation,true);assert.equal(stopped.command,undefined);assert.match(stopped.reply.body,/cambió/);const cancelled=waitPick(waiting,'CANCEL',changed);assert.equal(cancelled.state,null);assert.equal(cancelled.command,undefined);}
 }
 const waiting=waitingProgress(),denied=waitPick(waiting,'RECHECK_EVIDENCE',{...facts,permissions:{attendance:true,report:false}});assert.equal(denied.state,null);assert.equal(denied.command,undefined);assert.match(denied.reply.body,/permisos/);
});

test('the original waiting deadline also bounds resumed evidence, reason and confirmation without renewal',()=>{
 const waiting=waitingProgress(),approved={...facts,evidence:[reviewedPhoto]},evidence=waitPick(waiting,'RECHECK_EVIDENCE',approved),reason=waitPick(evidence,'evidence-a',approved),confirmation=waitSay('Medí el avance con la evidencia revisada.',reason.state,approved);
 for(const plan of [waiting,evidence,reason,confirmation]){
  assert.equal(plan.state.expiresAt,progressDeadline);assert.deepEqual(plan.state.progressEvidenceWait,{version:1,deadline:progressDeadline});
  const expired=rawProgress({type:'interactive',interactive:{type:'list_reply',list_reply:{id:plan.reply.type==='interactive'?plan.reply.sections[0].rows[0].id:'obra:'+'f'.repeat(20)+':0'}}},plan.state,approved,new Date(progressDeadline));assert.equal(expired.state,null);assert.equal(expired.command,undefined);assert.equal(expired.media,undefined);
 }
 const changed={...approved,tasks:[{...facts.tasks[0],revision:'2026-10-01T12:02:00.000001'}]},stopped=waitPick(confirmation,'CONFIRM',changed);assert.equal(stopped.state,confirmation.state);assert.equal(stopped.command,undefined);
 const rejected=waitPick(confirmation,'CONFIRM',{...approved,evidence:[{...reviewedPhoto,status:'REJECTED'}]});assert.equal(rejected.state,confirmation.state);assert.equal(rejected.preserveConversation,true);assert.equal(rejected.command,undefined);
 for(const progressEvidenceWait of [{version:2,deadline:progressDeadline},{version:1,deadline:'2026-10-01T12:05:00.000Z'}])assert.throws(()=>waitSay('dato',{...waiting.state,progressEvidenceWait}),error=>error.code==='META_CHANNEL_RECEIPT_INTEGRITY');
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
