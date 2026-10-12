import test from 'node:test';
import assert from 'node:assert/strict';
import {planMetaFieldConversation} from '../src/lib/meta-field-conversation.mjs';
import {normalizeFieldCommand} from '../src/lib/field-operations-policy.mjs';
import {TASK_MEASUREMENT_VERSION} from '../src/lib/task-progress-measurement.js';

const now=new Date('2026-10-12T12:00:00.000Z'),revision='2026-10-12T12:00:00.000001';
const facts={projectName:'Synthetic metrado',workerId:'worker-synthetic',permissions:{report:true,attendance:false},latest:null,proposals:[],sectors:[{id:'sector-synthetic',name:'Sector sintético'}],tasks:[{id:'task-synthetic',title:'Revoque sintético',progress:20,revision,measurement:{version:TASK_MEASUREMENT_VERSION,definitionId:'measurement-synthetic',baseline:'100.0000',unit:'M2',executed:'20.0000',sourceReference:'Cómputo sintético revisado',configuredAt:now.toISOString(),approvedProposalId:'proposal-synthetic-previous',approvedAt:now.toISOString()}}],evidence:[{id:'evidence-synthetic',taskId:'task-synthetic',title:'Evidencia sintética revisada',status:'APPROVED'}]};
let event=0;
function run(message,state=null,current=facts){const plan=planMetaFieldConversation({message,state,eventId:'synthetic_daily_'+(++event),facts:current,now});if(plan.state)plan.state={...plan.state,version:1,expiresAt:new Date(now.getTime()+900000).toISOString()};return plan;}
const say=(body,state,current)=>run({type:'text',text:{body}},state,current);
function pick(plan,value,current=facts){const index=plan.state.choices.findIndex(choice=>choice.value===value);assert.ok(index>=0);return run({type:'interactive',interactive:{type:'list_reply',list_reply:{id:plan.reply.sections[0].rows[index].id}}},plan.state,current);}
function measured(mode='DELTA',quantity='15'){const task=say('AVANCE'),sector=pick(task,'task-synthetic'),scope=pick(sector,'sector-synthetic');assert.equal(scope.state.step,'MEASUREMENT_SCOPE');const amount=pick(scope,mode),proof=say(quantity,amount.state),reason=pick(proof,'evidence-synthetic');return say('Medición propia revisada contra el cómputo.',reason.state);}

test('WhatsApp daily addition shows previous, delta and resulting total before an exact pending command',()=>{
 const confirmation=measured();assert.match(confirmation.reply.body,/Acumulado aprobado: 20 m²/);assert.match(confirmation.reply.body,/Adicional propuesto: 15 m²/);assert.match(confirmation.reply.body,/Nuevo acumulado: 35 \/ 100 m² · 35%/);
 assert.equal(say('Guardar',confirmation.state).command,undefined);
 const saved=pick(confirmation,'CONFIRM');assert.deepEqual(saved.command.payload,{workerId:facts.workerId,taskId:'task-synthetic',revision,measurement:{mode:'DELTA',quantity:'15.0000'},reason:'Medición propia revisada contra el cómputo.',evidenceIds:['evidence-synthetic']});
 assert.equal(saved.command.payload.progress,undefined);assert.equal(saved.command.payload.baseline,undefined);assert.equal(saved.command.payload.unit,undefined);
 assert.equal(normalizeFieldCommand({operationId:'10000000-0000-4000-a000-000000000001',projectId:'project-synthetic',scope:'a'.repeat(64),...saved.command}).payload.measurement.quantity,'15.0000');
});
test('cumulative report subtracts already approved quantity rather than adding the total twice',()=>{const confirmation=measured('CUMULATIVE','35');assert.match(confirmation.reply.body,/Adicional propuesto: 15 m²/);assert.deepEqual(pick(confirmation,'CONFIRM').command.payload.measurement,{mode:'CUMULATIVE',quantity:'35.0000'});});
test('daily zero, base overflow, malformed decimal and invented baseline preserve the input without dispatch',()=>{
 for(const quantity of ['0','81','1,5','15 / 100 M2','01','1.00001']){const scope=pick(pick(say('AVANCE'),'task-synthetic'),'sector-synthetic'),amount=pick(scope,'DELTA'),failed=say(quantity,amount.state);assert.equal(failed.command,undefined);assert.deepEqual(failed.state,amount.state);assert.match(failed.reply.body,/Conservamos el borrador/);}
 const scope=pick(pick(say('AVANCE'),'task-synthetic'),'sector-synthetic'),amount=pick(scope,'CUMULATIVE'),failed=say('19',amount.state);assert.equal(failed.command,undefined);assert.deepEqual(failed.state,amount.state);
});
test('a task, definition or approved-total change blocks stale confirmation without adding any quantity',()=>{
 const confirmation=measured();
 for(const task of [{...facts.tasks[0],revision:'2026-10-12T12:00:00.000002'},{...facts.tasks[0],measurement:{...facts.tasks[0].measurement,definitionId:'measurement-new'}}]){const stopped=pick(confirmation,'CONFIRM',{...facts,tasks:[task]});assert.equal(stopped.command,undefined);assert.deepEqual(stopped.state,confirmation.state);assert.match(stopped.reply.body,/no sumamos cantidades/);}
});
test('revoked report or evidence approval does not produce a measured progress command',()=>{
 const confirmation=measured(),denied=pick(confirmation,'CONFIRM',{...facts,permissions:{report:false,attendance:false}});assert.equal(denied.command,undefined);assert.equal(denied.state,null);
 const stopped=pick(confirmation,'CONFIRM',{...facts,evidence:[{...facts.evidence[0],status:'REJECTED'}]});assert.equal(stopped.command,undefined);assert.deepEqual(stopped.state,confirmation.state);
});
test('tasks query exposes measured approved total while leaving pending reports separate',()=>{const details=pick(say('TAREAS'),'task-synthetic');assert.equal(details.command,undefined);assert.match(details.reply.body,/Metrado aprobado: 20 \/ 100 m²/);});
test('worker cannot add a progress or a baseline field to the derived-measurement input',()=>{
 const command={operationId:'10000000-0000-4000-a000-000000000002',projectId:'project-synthetic',scope:'a'.repeat(64),...pick(measured(),'CONFIRM').command};
 for(const extra of [{progress:99},{baseline:'999.0000'},{unit:'M3'}])assert.throws(()=>normalizeFieldCommand({...command,payload:{...command.payload,...extra}}),{code:'SITE_INPUT_INVALID'});
});
