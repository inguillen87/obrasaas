import test from 'node:test';
import assert from 'node:assert/strict';
import {planMetaFieldConversation} from '../src/lib/meta-field-conversation.mjs';
import {createVoiceProgressDraft} from '../src/lib/voice-progress-draft.mjs';
import {createHash} from 'node:crypto';

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
 assert.match(detail.reply.body,/Partida 11/);assert.match(detail.reply.body,/Avance registrado: 0%/);assert.equal(detail.state.step,'TASK');assert.equal(detail.state.taskId,undefined);assert.equal(detail.command,undefined);assert.equal(detail.media,undefined);bounded(detail);
});
test('schedule aliases traverse all 189 tasks with current dates/status, bounded pages and no import or write',()=>{
 const rows=tasks.map((task,index)=>({...task,status:index===188?'BLOCKED':'IN_PROGRESS',progress:index===188?37:12,startsOn:'2026-10-10',endsOn:'2026-10-19'}));
 for(const command of ['GANTT','CRONOGRAMA']){
  const view=offset=>page(offset,false,{tasks:rows.slice(offset,offset+8),projectId:'project-a',permissions:{attendance:true,report:false}});
  let plan=say(command,null,view(0)),offset=0;assert.match(plan.reply.body,/2026-10-10 → 2026-10-19/);assert.equal(plan.state.purpose,'TASKS');
  while(offset+8<189){offset+=8;plan=pick(plan,'NEXT_TASKS',view(offset));bounded(plan);assert.ok(plan.reply.body.length<=1024);assert.equal(plan.command,undefined);assert.equal(plan.planImport,undefined);}
  const detail=pick(plan,'task-189',view(offset));assert.match(detail.reply.body,/Partida 189/);assert.match(detail.reply.body,/Estado registrado: Bloqueada/);assert.match(detail.reply.body,/Avance registrado: 37%/);assert.match(detail.reply.body,/cuenta\?obra=project-a#schedule-gantt-title/);assert.equal(detail.state.taskId,undefined);assert.equal(detail.media,undefined);bounded(detail);
 }
});
test('old page replies, expired choices, revoked permission and missing current task cannot continue',()=>{
 const first=say('EVIDENCIA'),next=pick(first,'NEXT_TASKS',page(8));
 const stale=run({type:'interactive',interactive:{type:'list_reply',list_reply:{id:first.reply.sections[0].rows[0].id}}},next.state,page(8));assert.match(stale.reply.body,/paso anterior/);assert.equal(stale.command,undefined);assert.equal(stale.media,undefined);
 const expired=run({type:'interactive',interactive:{type:'list_reply',list_reply:{id:next.reply.sections[0].rows[0].id}}},{...next.state,expiresAt:now.toISOString()},page(8));assert.equal(expired.command,undefined);assert.equal(expired.media,undefined);
 const revoked=pick(next,'NEXT_TASKS',page(16,false,{permissions:{attendance:true,report:false}}));assert.equal(revoked.state,null);assert.equal(revoked.command,undefined);assert.equal(revoked.media,undefined);
 assert.throws(()=>pick(next,'task-11',page(8,false,{tasks:[]})),{code:'WORKSPACE_TASK_UNAVAILABLE'});
 const hello=planMetaFieldConversation({message:{type:'text',text:{body:'HOLA'}},state:next.state,eventId:'hello-page',facts:page(8),now});assert.equal(hello.state,next.state);assert.equal(hello.preserveConversation,true);
});

const approved=Array.from({length:11},(_,i)=>({id:'approved-'+(i+1),title:'Adjunto '+(i+1),taskId:tasks[0].id,workerId:base.workerId,status:'APPROVED',revision:'2026-10-10T12:00:00.123458',media:{kind:'image',sha256:'b'.repeat(64)}}));
function evidenceFacts(offset=0,{voice=false,retained=[],permission=true,records=approved}={}){
 const size=voice?7:8,rows=records.slice(offset,offset+size);
 return {...base,permissions:{attendance:true,report:permission},tasks:[tasks[0]],taskPage:{first:{id:tasks[0].id,createdAt:tasks[0].createdAt},last:{id:tasks[0].id,createdAt:tasks[0].createdAt},hasPrevious:false,hasNext:false},evidence:[...rows,...retained.filter(row=>!rows.some(value=>value.id===row.id))],pagedEvidence:rows,evidencePage:{first:rows[0]?.id||null,last:rows.at(-1)?.id||null,hasPrevious:offset>0,hasNext:offset+size<records.length}};
}
const measuring={version:1,purpose:'PROGRESS',step:'MEASUREMENT',taskId:tasks[0].id,taskRevision:tasks[0].revision,sectorId:'sector-1',expiresAt:'2026-10-10T12:15:00.000Z'};

test('eleventh approved evidence is reachable, paging is read-only and old nonce cannot select it',()=>{
 const first=say('25%',measuring,evidenceFacts()),next=pick(first,'NEXT_EVIDENCE',evidenceFacts(8));bounded(first);bounded(next);assert.notEqual(next.state.nonce,first.state.nonce);
 assert.equal(first.command,undefined);assert.equal(next.command,undefined);assert.equal(next.media,undefined);
 const stale=run({type:'interactive',interactive:{type:'list_reply',list_reply:{id:first.reply.sections[0].rows[0].id}}},next.state,evidenceFacts(8));assert.match(stale.reply.body,/paso anterior/);assert.deepEqual(stale.state,next.state);assert.equal(stale.command,undefined);
 const backward=pick(next,'PREVIOUS_EVIDENCE',evidenceFacts());assert.equal(backward.state.choices[0].value,approved[0].id);bounded(backward);
 const reason=pick(next,'approved-11',evidenceFacts(8)),current=evidenceFacts(0,{retained:[approved[10]]}),confirmation=say('Medición verificada con el adjunto once.',reason.state,current),saved=pick(confirmation,'CONFIRM',current);
 assert.deepEqual(saved.command.payload.evidenceIds,['approved-11']);assert.equal(saved.command.action,'PROPOSE_PROGRESS');assert.equal(saved.command.payload.revision,tasks[0].revision);
 const expired=run({type:'interactive',interactive:{type:'list_reply',list_reply:{id:next.reply.sections[0].rows[0].id}}},{...next.state,expiresAt:now.toISOString()},evidenceFacts(8));assert.equal(expired.command,undefined);
 const revoked=pick(next,'PREVIOUS_EVIDENCE',evidenceFacts(0,{permission:false}));assert.equal(revoked.command,undefined);assert.equal(revoked.state,null);
});
test('selected evidence is reread at selection and confirmation and cannot be foreign-task or no longer approved',()=>{
 const first=say('25%',measuring,evidenceFacts()),next=pick(first,'NEXT_EVIDENCE',evidenceFacts(8));
 for(const replacement of [{...approved[10],taskId:'foreign-task'},{...approved[10],status:'REJECTED'}]){
  const changed=evidenceFacts(8,{records:approved.map(row=>row.id===replacement.id?replacement:row)}),stopped=pick(next,'approved-11',changed);assert.equal(stopped.command,undefined);assert.deepEqual(stopped.state,next.state);
 }
 const reason=pick(next,'approved-11',evidenceFacts(8)),confirmation=say('Medición acumulada revisada independientemente.',reason.state,evidenceFacts(0,{retained:[approved[10]]}));
 const lost=pick(confirmation,'CONFIRM',evidenceFacts());assert.equal(lost.command,undefined);assert.deepEqual(lost.state,confirmation.state);assert.match(lost.reply.body,/ya no está aprobada/);
 const legacyNonce='e'.repeat(20),legacy={...measuring,step:'PROGRESS_EVIDENCE',progress:25,quantity:null,baseline:null,unit:null,nonce:legacyNonce,choices:approved.slice(0,10).map(row=>({value:row.id,title:row.title}))},legacySelection=run({type:'interactive',interactive:{type:'list_reply',list_reply:{id:'obra:'+legacyNonce+':9'}}},legacy,evidenceFacts(0,{retained:[approved[9]]}));
 assert.equal(legacySelection.state.step,'REASON');assert.deepEqual(legacySelection.state.evidenceIds,['approved-10']);assert.equal(legacySelection.command,undefined);
});
test('voice selection reaches the eleventh approved draft through bounded pages and retains canonical source review',()=>{
 const transcript='Hoy hicimos 2,5 metros cuadrados de mampostería.',records=approved.map(row=>({...row,media:{kind:'audio',sha256:'b'.repeat(64)},processing:{status:'TRANSCRIBED_UNREVIEWED',result:{text:transcript,progressDraft:createVoiceProgressDraft({transcript,evidenceId:row.id,evidenceRevision:'2026-10-10T12:00:00.123457',mediaSha256:'b'.repeat(64),transcriptSha256:createHash('sha256').update(transcript).digest('hex'),task:tasks[0]})}}})),facts=evidenceFacts(0,{voice:true,records});
 const task=say('AVANCE',null,facts),sector=pick(task,tasks[0].id,facts),source=pick(sector,'sector-1',facts),first=pick(source,'VOICE',facts),nextFacts=evidenceFacts(7,{voice:true,records}),next=pick(first,'NEXT_EVIDENCE',nextFacts);bounded(first);bounded(next);assert.equal(next.command,undefined);
 const reviewed=pick(next,'approved-11',nextFacts);assert.equal(reviewed.state.voiceCandidate.evidenceId,'approved-11');assert.equal(reviewed.state.step,'VOICE_REVIEW');assert.equal(reviewed.command,undefined);
 const measurement=pick(reviewed,'USE',evidenceFacts(0,{records,retained:[records[10]]}));assert.equal(measurement.state.sourceVoice.confirmed,true);assert.equal(measurement.state.step,'MEASUREMENT');assert.equal(measurement.command,undefined);
 // A page containing only photos remains navigable; it never treats one as voice.
 const noVoice=say('AVANCE',null,evidenceFacts()),noVoiceSector=pick(pick(noVoice,tasks[0].id,evidenceFacts()),'sector-1',evidenceFacts()),search=pick(noVoiceSector,'VOICE',evidenceFacts(0,{voice:true}));bounded(search);assert.ok(search.state.choices.some(row=>row.value==='NEXT_EVIDENCE'));assert.ok(search.state.choices.some(row=>row.value==='MANUAL'));assert.ok(!search.state.choices.some(row=>row.value==='approved-1'));
});
