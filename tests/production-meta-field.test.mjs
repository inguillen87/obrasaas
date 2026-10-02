import test from 'node:test';
import assert from 'node:assert/strict';
import {planMetaFieldConversation} from '../src/lib/meta-field-conversation.mjs';
import {metaFieldOperationId} from '../src/lib/meta-field-bridge.mjs';
import {operationId} from '../src/lib/workspace-policy.mjs';
import {fieldTransition,FIELD_ACTIONS} from '../src/lib/field-operations-policy.mjs';
const now=new Date('2026-10-01T12:00:00Z'),facts={projectName:'Synthetic obra',workerId:'worker-a',permissions:{attendance:true,report:true},sectors:[{id:'sector-a',name:'Planta baja'}],tasks:[{id:'task-a',title:'Mampostería',progress:0,revision:'2026-10-01T12:00:00.123456'}],evidence:[],proposals:[],latest:null};
let sequence=0;
const run=(message,state=null,extra={})=>{const result=planMetaFieldConversation({message,state,eventId:'synthetic_'+(++sequence),facts,now,...extra});if(result.state)result.state={...result.state,version:1,expiresAt:new Date(now.getTime()+900000).toISOString()};return result;};
const say=(body,state,extra)=>run({type:'text',text:{body}},state,extra);
const pick=(plan,index=0,extra)=>run({type:'interactive',interactive:{type:'list_reply',list_reply:{id:plan.reply.sections[0].rows[index].id}}},plan.state,extra);
const pickValue=(plan,value,extra)=>pick(plan,plan.state.choices.findIndex(choice=>choice.value===value),extra);
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
test('media is attached only after canonical task and sector selection, never from webhook URLs',()=>{
 const task=say('EVIDENCIA'),sector=pick(task),pending=pick(sector),result=run({type:'image',image:{id:'123456789012345',mime_type:'image/jpeg',caption:'Trabajo del sector',url:'https://evil.invalid/private'}},pending.state);
 assert.equal(result.media.mediaId,'123456789012345');assert.equal(result.media.taskId,'task-a');assert.equal(result.media.sectorId,'sector-a');assert.equal(result.media.url,undefined);
 const unsolicited=run({type:'image',image:{id:'123456789012345'}});assert.equal(unsolicited.media,undefined);
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
