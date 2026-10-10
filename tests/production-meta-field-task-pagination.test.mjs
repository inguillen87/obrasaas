import test from 'node:test';
import assert from 'node:assert/strict';
import {planMetaFieldConversation} from '../src/lib/meta-field-conversation.mjs';

const now=new Date('2026-10-10T12:00:00Z');
const tasks=Array.from({length:189},(_,i)=>({id:'task-'+(i+1),title:'Partida '+(i+1),progress:0,revision:'2026-10-10T12:00:00.123456',createdAt:'2026-10-10T12:00:00.000000'}));
const base={projectName:'Obra sintética',workerId:'worker-a',permissions:{attendance:true,report:true},sectors:Array.from({length:19},(_,i)=>({id:'sector-'+(i+1),name:'Sector '+(i+1)})),evidence:[],proposals:[],latest:null};
let seq=0;
function page(offset=0,optional=false,extra={}){
 const limit=optional?7:8,rows=tasks.slice(offset,offset+limit),cursor=t=>({id:t.id,createdAt:t.createdAt});
 return {...base,tasks:rows,taskPage:{first:cursor(rows[0]),last:cursor(rows.at(-1)),hasPrevious:offset>0,hasNext:offset+limit<tasks.length},...extra};
}
function run(message,state=null,facts=page()){
 const result=planMetaFieldConversation({message,state,facts,eventId:'page-event-'+(++seq),now});
 if(result.state)result.state={...result.state,version:1,expiresAt:'2026-10-10T12:15:00.000Z'};
 return result;
}
const say=(body,state,facts)=>run({type:'text',text:{body}},state,facts);
function pick(plan,value,facts){const index=plan.state.choices.findIndex(row=>row.value===value);assert.ok(index>=0,value);return run({type:'interactive',interactive:{type:'list_reply',list_reply:{id:plan.reply.sections[0].rows[index].id}}},plan.state,facts);}
const bounded=plan=>assert.ok(plan.reply.sections.flatMap(s=>s.rows).length<=10);

test('evidence and progress can select task 189 with fresh nonces and no business effect during paging',()=>{
 for(const action of ['EVIDENCIA','AVANCE']){
  let plan=say(action),offset=0;bounded(plan);
  while(offset+8<189){const old=plan;offset+=8;plan=pick(plan,'NEXT_TASKS',page(offset));bounded(plan);assert.notEqual(plan.state.nonce,old.state.nonce);assert.equal(plan.command,undefined);assert.equal(plan.media,undefined);}
  const selected=pick(plan,'task-189',page(offset));assert.equal(selected.state.taskId,'task-189');assert.equal(selected.state.taskRevision,tasks[188].revision);assert.equal(selected.state.step,'SECTOR');
  const same=page(offset),more=pick(selected,'NEXT_SECTORS',same),last=pick(more,'NEXT_SECTORS',same),sector=pick(last,'sector-19',same);assert.equal(sector.state.sectorId,'sector-19');assert.equal(sector.state.taskId,'task-189');assert.equal(sector.command,undefined);assert.equal(sector.media,undefined);bounded(more);bounded(last);
 }
});
test('optional task pages retain NONE and never skip the seventh/eighth boundary',()=>{
 for(const action of ['INCIDENCIA','MATERIALES','CONSUMO']){
  const first=say(action,null,page(0,true)),second=pick(first,'NEXT_TASKS',page(7,true));bounded(second);
  assert.equal(second.state.choices[0].value,'NONE');assert.equal(second.state.choices[1].value,'task-8');
  const back=pick(second,'PREVIOUS_TASKS',page(0,true));assert.equal(back.state.choices[1].value,'task-1');
  const none=pick(second,'NONE',page(7,true));assert.equal(none.state.taskId,null);assert.equal(none.state.step,'SECTOR');assert.equal(none.command,undefined);
 }
});
test('task consultation pages are available without report permission and cannot write',()=>{
 const facts=page(0,false,{permissions:{attendance:false,report:false}}),initial=say('TAREAS',null,facts),nextFacts=page(8,false,{permissions:facts.permissions}),next=pick(initial,'NEXT_TASKS',nextFacts),detail=pick(next,'task-11',nextFacts);
 assert.match(detail.reply.body,/Partida 11/);assert.match(detail.reply.body,/Avance aprobado: 0%/);assert.equal(detail.state.step,'TASK');assert.equal(detail.state.taskId,undefined);assert.equal(detail.command,undefined);assert.equal(detail.media,undefined);bounded(detail);
});
test('old page replies, expired choices, revoked permission and missing current task cannot continue',()=>{
 const first=say('EVIDENCIA'),next=pick(first,'NEXT_TASKS',page(8));
 const stale=run({type:'interactive',interactive:{type:'list_reply',list_reply:{id:first.reply.sections[0].rows[0].id}}},next.state,page(8));assert.match(stale.reply.body,/paso anterior/);assert.equal(stale.command,undefined);assert.equal(stale.media,undefined);
 const expired=run({type:'interactive',interactive:{type:'list_reply',list_reply:{id:next.reply.sections[0].rows[0].id}}},{...next.state,expiresAt:now.toISOString()},page(8));assert.equal(expired.command,undefined);assert.equal(expired.media,undefined);
 const revoked=pick(next,'NEXT_TASKS',page(16,false,{permissions:{attendance:true,report:false}}));assert.equal(revoked.state,null);assert.equal(revoked.command,undefined);assert.equal(revoked.media,undefined);
 assert.throws(()=>pick(next,'task-11',page(8,false,{tasks:[]})),{code:'WORKSPACE_TASK_UNAVAILABLE'});
 const hello=planMetaFieldConversation({message:{type:'text',text:{body:'HOLA'}},state:next.state,eventId:'hello-page',facts:page(8),now});assert.equal(hello.state,next.state);assert.equal(hello.preserveConversation,true);
});
