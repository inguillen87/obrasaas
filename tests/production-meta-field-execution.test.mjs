import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {planMetaFieldConversation,metaFieldPlanDisclosure} from '../src/lib/meta-field-conversation.mjs';
import {metaFieldExecutionAcknowledgement} from '../src/lib/meta-field-execution-conversation.mjs';
import {publicTaskMeasurement} from '../src/lib/task-progress-measurement.js';
import {executionFactDigest} from '../src/lib/field-execution-policy.mjs';
import {fieldExecutionFixture} from './helpers/field-execution-fixture.mjs';

const now=new Date('2026-10-24T12:00:00.000Z');
async function fixture(measured=false){
 const f=fieldExecutionFixture({measured}),m=(await f.issue()).mandate,task={...f.state.task,...(measured?{measurement:publicTaskMeasurement(f.state.task)}:{})};delete task.metadata;
 const facts={projectName:'Obra sintética',projectId:'p-a',workerId:'w-worker',permissions:{report:true,attendance:false},attendanceOnly:false,replyBodyLimit:1024,tasks:[task],executionTasks:[task],sectors:[{id:'sector-a',name:'Sector sintético'}],evidence:[],proposals:[],latest:null,inventory:{...f.state.project.metadata.materialInventory,catalogHash:m.catalogHash},execution:{mandates:[m],mandatesTruncated:false,receipts:[],receiptsTruncated:false},executionEvidence:[{id:'e-a',title:'Evidencia aprobada',workerId:'w-worker',taskId:'task-a',sectorId:'sector-a',status:'APPROVED'}]};
 let sequence=0;const run=(message,state=null,extra={})=>{const result=planMetaFieldConversation({message,state,eventId:'event-'+(++sequence),facts,now,...extra});if(result.state)result.state={...result.state,version:1,expiresAt:result.state.executionDeadline||new Date(now.getTime()+900000).toISOString()};return result;},say=(body,state,extra)=>run({type:'text',text:{body}},state,extra),pick=(plan,value,extra)=>{const index=plan.state.choices.findIndex(row=>row.value===value);assert.ok(index>=0,'Missing choice '+value);return run({type:'interactive',interactive:{type:'list_reply',list_reply:{id:plan.reply.sections[0].rows[index].id}}},plan.state,extra);};
 const prepared=()=>{const list=say('REPORTAR'),first=pick(list,m.id),second=say('1.001',first.state),progress=say('0',second.state);return progress;};return {f,m,facts,run,say,pick,prepared};
}

test('the report menu offers real material execution while CONSUMO retains its explicit manual proposal path',async()=>{
 const x=await fixture(),menu=x.say('MENU');assert.ok(menu.state.choices.some(row=>row.value==='EXECUTION'));assert.equal(menu.reply.sections[0].rows.length<=10,true);assert.equal(x.pick(menu,'EXECUTION').state.purpose,'EXECUTION');
 const manualFacts={...x.facts,execution:undefined},manual=x.say('CONSUMO',null,{facts:manualFacts});assert.equal(manual.state.purpose,'CONSUMPTION');assert.equal(manual.state.step,'TASK');
 const list=x.say('REPORTAR'),manualChoice=x.pick(list,'MANUAL');assert.equal(manualChoice.state.purpose,'CONSUMPTION');assert.equal(manualChoice.command,undefined);
});

test('an exact confirmed WhatsApp report reaches the canonical execution store and moves stock instead of creating a pending proposal',async()=>{
 const x=await fixture(),reason=x.prepared(),confirmation=x.say('Uso exacto de cemento en la tarea informada.',reason.state);assert.match(confirmation.reply.body,/salida real de stock/);assert.equal(metaFieldPlanDisclosure(confirmation),'REPORT');const planned=x.pick(confirmation,'CONFIRM');assert.equal(planned.command.action,'REPORT_EXECUTION');assert.equal(planned.command.payload.lines.length,1);assert.equal(planned.command.payload.lines[0].quantity,'1.001');assert.equal(planned.command.payload.progress,null);
 const result=await x.f.operations.save(x.f.session('worker'),x.f.command(planned.command.action,planned.command.payload));assert.equal(result.kind,'EXECUTION_APPLIED');assert.equal(result.effectsApplied,true);assert.equal(x.f.state.project.metadata.materialInventory.materials[0].balance,'8.999');assert.equal(x.f.state.task.progress,0);assert.equal(x.f.state.proposals.length,0);assert.match(metaFieldExecutionAcknowledgement(result,x.facts.projectName),/salida registrada/);assert.doesNotMatch(metaFieldExecutionAcknowledgement(result,x.facts.projectName),/pendiente de revisión/);
});

test('repeated confirmation messages keep one report fact and line identity even with a new transport UUID',async()=>{
 const x=await fixture(),confirmation=x.say('Uso exacto de material en esta tarea.',x.prepared().state),one=x.pick(confirmation,'CONFIRM'),two=x.pick(confirmation,'CONFIRM');assert.deepEqual(one.command,two.command);assert.equal(executionFactDigest(one.command.payload),executionFactDigest(two.command.payload));
 const operation=x.f.command(one.command.action,one.command.payload);await x.f.operations.save(x.f.session('worker'),operation);const replay=await x.f.operations.save(x.f.session('worker'),{...operation,operationId:randomUUID()});assert.equal(replay.executionReplay,true);assert.equal(replay.effectsApplied,false);assert.equal(x.f.movements().length,1);
});

test('plain text, stale interactive nonces and changed permissions never confirm an OUT',async()=>{
 const x=await fixture(),confirmation=x.say('Uso exacto de material en esta tarea.',x.prepared().state);for(const body of ['sí','guardar','1','confirmo'])assert.equal(x.say(body,confirmation.state).command,undefined);
 const old=x.say('REPORTAR'),picked=x.pick(old,x.m.id),stale=x.run({type:'interactive',interactive:{type:'list_reply',list_reply:{id:old.reply.sections[0].rows[0].id}}},picked.state);assert.equal(stale.command,undefined);
 assert.equal(x.pick(confirmation,'CONFIRM',{facts:{...x.facts,permissions:{report:false,attendance:true}}}).command,undefined);const cancelled=x.pick(confirmation,'CANCEL');assert.equal(cancelled.state,null);assert.equal(cancelled.command,undefined);
});

test('lossy quantities and quota excess preserve the same draft without consuming or creating a fact',async()=>{
 const x=await fixture(),first=x.pick(x.say('REPORTAR'),x.m.id);for(const body of ['1e3','1,5','-1','1.0001','5']){const result=x.say(body,first.state);assert.equal(result.command,undefined);assert.deepEqual(result.state,first.state);}const zero=x.say('0',first.state),none=x.say('0',zero.state);assert.equal(none.command,undefined);assert.equal(none.state,null);assert.equal(x.f.movements().length,0);
});

test('report IDs and the fixed original deadline survive greetings and unrelated commands without silently starting another report',async()=>{
 const x=await fixture(),state=x.prepared().state;for(const body of ['HOLA','REPORTAR','CONSUMO','MENU','EJECUCIONES']){const result=x.say(body,state);assert.equal(result.state.reportId,state.reportId);assert.equal(result.state.executionDeadline,state.executionDeadline);assert.equal(result.preserveConversation,true);}const cancelled=x.say('CANCELAR',state);assert.equal(cancelled.state.purpose,'MENU');
});

test('expired or revoked mandates and changed task revisions stop confirmation without inventing a new report fact',async()=>{
 const x=await fixture(),confirmation=x.say('Uso exacto de material en esta tarea.',x.prepared().state);
 for(const facts of [{...x.facts,execution:{...x.facts.execution,mandates:[]}},{...x.facts,execution:{...x.facts.execution,mandates:[{...x.m,state:'REVOKED'}]}},{...x.facts,executionTasks:[{...x.facts.executionTasks[0],revision:'2026-10-24T12:00:01.123456'}]}]){const result=x.pick(confirmation,'CONFIRM',{facts});assert.equal(result.command,undefined);assert.equal(result.state.reportId,confirmation.state.reportId);assert.equal(result.preserveConversation,true);}
 const expired=x.pick(confirmation,'CONFIRM',{now:new Date('2026-10-24T12:16:00.000Z')});assert.equal(expired.command,undefined);
});

test('explicit task metering plus approved evidence updates Gantt quantity under the same mandate; materials alone infer no percentage',async()=>{
 const x=await fixture(true),progress=x.prepared(),measurement=x.pick(progress,'MEASURED'),evidence=x.say('2.5001',measurement.state),reason=x.pick(evidence,'e-a'),confirmation=x.say('Verificación de superficie y material aplicado.',reason.state),planned=x.pick(confirmation,'CONFIRM');assert.equal(planned.command.payload.progress.quantity,'2.5001');assert.equal(planned.command.payload.progress.baseline,'10.0000');assert.deepEqual(planned.command.payload.evidenceIds,['e-a']);const result=await x.f.operations.save(x.f.session('worker'),x.f.command(planned.command.action,planned.command.payload));assert.equal(result.task.progress,25);assert.equal(result.task.status,'BLOCKED');assert.equal(result.task.measurement.executed,'2.5001');
 const y=await fixture(true),stock=y.pick(y.prepared(),'STOCK_ONLY');assert.equal(stock.state.progress,null);assert.deepEqual(stock.state.evidenceIds,[]);
});

test('missing or changed approved evidence cannot become an automated progress approval',async()=>{
 const x=await fixture(true),measurement=x.pick(x.prepared(),'MEASURED'),evidence=x.say('1.0001',measurement.state),reason=x.pick(evidence,'e-a'),confirmation=x.say('Verificación explícita de cantidad y materiales.',reason.state);assert.throws(()=>x.pick(confirmation,'CONFIRM',{facts:{...x.facts,executionEvidence:[]}}),{code:'FIELD_EVIDENCE_NOT_APPROVED'});
 const none=x.say('1.0001',measurement.state,{facts:{...x.facts,executionEvidence:[]}});assert.equal(none.state.step,'EXECUTION_EVIDENCE');assert.equal(none.command,undefined);assert.ok(none.state.choices.some(row=>row.value==='STOCK_ONLY'));
});

test('measurement above either mandate allowance stays editable in the same draft before evidence and confirmation',async()=>{
 const x=await fixture(true),measurement=x.pick(x.prepared(),'MEASURED'),excess=x.say('4.0001',measurement.state);assert.equal(excess.state.step,'EXECUTION_MEASUREMENT');assert.deepEqual(excess.state,measurement.state);assert.equal(excess.command,undefined);
 x.m.progress.used='7.0000';const total=x.say('2.0000',measurement.state);assert.deepEqual(total.state,measurement.state);assert.match(total.reply.body,/cupo vigente/);assert.equal(x.f.movements().length,0);
});

test('receipts are scoped own execution observations and their consultation emits no command',async()=>{
 const x=await fixture(),planned=x.pick(x.say('Uso exacto de material en esta tarea.',x.prepared().state),'CONFIRM'),result=await x.f.operations.save(x.f.session('worker'),x.f.command(planned.command.action,planned.command.payload));x.facts.execution.receipts=[result];const list=x.say('EJECUCIONES');assert.equal(list.state.purpose,'OWN_EXECUTIONS');const detail=x.pick(list,result.receiptId);assert.equal(detail.command,undefined);assert.match(detail.reply.body,new RegExp(result.execution.reportId));assert.match(detail.reply.body,/avance de la tarea se conservó/);assert.equal(metaFieldPlanDisclosure(detail),'REPORT');
});
