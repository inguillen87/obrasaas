import test from 'node:test';
import assert from 'node:assert/strict';
import {planMetaFieldConversation} from '../src/lib/meta-field-conversation.mjs';
import {metaFieldOperationId} from '../src/lib/meta-field-bridge.mjs';
import {operationId} from '../src/lib/workspace-policy.mjs';
const now=new Date('2026-10-01T12:00:00Z'),facts={projectName:'Synthetic obra',workerId:'worker-a',permissions:{attendance:true,report:true},sectors:[{id:'sector-a',name:'Planta baja'}],tasks:[{id:'task-a',title:'Mampostería',progress:0,revision:'2026-10-01T12:00:00.123456'}],evidence:[],proposals:[],latest:null};
let sequence=0;
const run=(message,state=null,extra={})=>{const result=planMetaFieldConversation({message,state,eventId:'synthetic_'+(++sequence),facts,now,...extra});if(result.state)result.state={...result.state,version:1,expiresAt:new Date(now.getTime()+900000).toISOString()};return result;};
const say=(body,state,extra)=>run({type:'text',text:{body}},state,extra);
const pick=(plan,index=0,extra)=>run({type:'interactive',interactive:{type:'list_reply',list_reply:{id:plan.reply.sections[0].rows[index].id}}},plan.state,extra);
test('stale choices, plain affirmative text and expired drafts cannot authorize a business effect',()=>{
 const menu=say('MENU'),next=pick(menu,6),old=pick(menu,6,{state:next.state});assert.equal(old.command,undefined);assert.match(old.reply.body,/paso anterior/);
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
test('permission changes stop attendance and report entry instead of downgrading identity',()=>{
 assert.throws(()=>say('ENTRADA',null,{facts:{...facts,permissions:{attendance:false,report:true}}}),{code:'WORKER_CHANNEL_PERMISSION_REQUIRED'});
 assert.throws(()=>say('INCIDENCIA',null,{facts:{...facts,permissions:{attendance:true,report:false}}}),{code:'WORKER_CHANNEL_PERMISSION_REQUIRED'});
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
