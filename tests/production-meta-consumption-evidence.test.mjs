import test from 'node:test';
import assert from 'node:assert/strict';
import {planMetaFieldConversation} from '../src/lib/meta-field-conversation.mjs';
import {fieldMediaAnalysisConsent} from '../src/lib/field-media-privacy.mjs';

const now=new Date('2026-10-20T12:00:00.000Z'),revision='2026-10-20T12:00:00.000001';let serial=0;
const image=(id='image-a')=>({id,title:'Foto propia '+id,workerId:'worker-a',taskId:'task-a',sectorId:'sector-a',revision,status:'PENDING',media:{kind:'image',contentType:'image/png',bytes:100,sha256:'b'.repeat(64)}});
const audio=()=>({...image('audio-a'),title:'Audio ya guardado',media:{kind:'audio',contentType:'audio/ogg',bytes:120,sha256:'c'.repeat(64)},processing:{status:'TRANSCRIBED_UNREVIEWED',analysisConsent:fieldMediaAnalysisConsent(true),result:{success:true,status:'TRANSCRIBED_UNREVIEWED',text:'Usamos 2,5 bolsas de cemento para la mezcla.'}}});
function facts(entries=[image(),audio()]){return {projectId:'project-a',projectName:'Obra sintética',workerId:'worker-a',permissions:{attendance:true,report:true},tasks:[{id:'task-a',title:'Mampostería',revision,progress:0}],sectors:[{id:'sector-a',name:'Sector A'}],inventory:{catalogHash:'a'.repeat(64),materials:[{id:'material-a',name:'Cemento',unit:'bolsa',active:true,balance:'25.000'}]},evidence:[],proposals:[],latest:null,consumptionEvidenceCatalog:{entries,evidence:entries,page:{contextDigest:'f'.repeat(64),first:null,last:null,hasPrevious:false,hasNext:false}}};}
function run(message,state,f){const plan=planMetaFieldConversation({message,state,eventId:'consumption-event-'+(++serial),facts:f,now});if(plan.state)plan.state={...plan.state,version:1,expiresAt:'2026-10-20T12:15:00.000Z'};return plan;}
const say=(body,state,f)=>run({type:'text',text:{body}},state,f);
function pick(plan,value,f){const index=plan.state.choices.findIndex(row=>row.value===value);assert.ok(index>=0,'Missing choice '+value);return run({type:'interactive',interactive:{type:'list_reply',list_reply:{id:plan.reply.sections[0].rows[index].id}}},plan.state,f);}
function begin(f){return pick(pick(pick(say('CONSUMO',null,f),'task-a',f),'sector-a',f),'material-a',f);}
function confirmManual(plan,f){const quantity=pick(plan,'CONTINUE_CONSUMPTION',f),reason=say('1.001',quantity.state,f);return say('Para la mezcla preparada en este sector.',reason.state,f);}

test('optional own photo reaches only the explicit pending-consumption command with evidenceIds',()=>{
 const f=facts(),picker=begin(f);assert.equal(picker.state.step,'CONSUMPTION_EVIDENCE');assert.equal(picker.command,undefined);
 const selected=pick(picker,'image-a',f),confirmation=confirmManual(selected,f);assert.match(confirmation.reply.body,/Adjuntos privados: 1/);assert.equal(confirmation.command,undefined);assert.equal(say('Guardar',confirmation.state,f).command,undefined);
 const saved=pick(confirmation,'CONFIRM',f);assert.deepEqual(saved.command,{action:'PROPOSE_CONSUMPTION',payload:{workerId:'worker-a',taskId:'task-a',sectorId:'sector-a',materialId:'material-a',catalogHash:f.inventory.catalogHash,quantity:'1.001',reason:'Para la mezcla preparada en este sector.',evidenceIds:['image-a']}});assert.equal(saved.command.payload.progress,undefined);assert.equal(saved.command.payload.baseline,undefined);
});
test('audio draft is disclosed only on selection and needs separate draft and final confirmations',()=>{
 const f=facts(),picker=begin(f);assert.doesNotMatch(picker.reply.body,/Usamos 2,5/);const review=pick(picker,'audio-a',f);assert.equal(review.state.step,'CONSUMPTION_AUDIO_REVIEW');assert.match(review.reply.body,/2.500 bolsa/);assert.equal(review.state.quantity,undefined);assert.equal(review.command,undefined);
 assert.equal(say('sí',review.state,f).command,undefined);const confirmation=pick(review,'USE_CONSUMPTION_VOICE',f);assert.equal(confirmation.command,undefined);assert.equal(confirmation.state.quantity,'2.500');assert.equal(say('sí',confirmation.state,f).command,undefined);
 const saved=pick(confirmation,'CONFIRM',f);assert.equal(saved.command.action,'PROPOSE_CONSUMPTION');assert.equal(saved.command.payload.quantity,'2.500');assert.deepEqual(saved.command.payload.evidenceIds,['audio-a']);assert.equal(saved.command.payload.progress,undefined);assert.equal(saved.command.payload.measurement,undefined);
});
test('audio without authorized transcription is an attachment only and does not trigger a new analysis',()=>{
 const e=audio();e.processing.analysisConsent=fieldMediaAnalysisConsent(false);const f=facts([e]),selected=pick(begin(f),'audio-a',f);assert.equal(selected.state.step,'CONSUMPTION_EVIDENCE');assert.equal(selected.state.quantity,undefined);assert.equal(selected.media,undefined);assert.equal(selected.command,undefined);const confirmation=confirmManual(selected,f);assert.equal(pick(confirmation,'CONFIRM',f).command.payload.quantity,'1.001');
});
test('uncertain or mismatched audio keeps manual quantity entry without conversion or metrado',()=>{
 const e=audio();e.processing.result.text='Usamos 2 kilos de cemento.';const f=facts([e]),review=pick(begin(f),'audio-a',f);assert.equal(review.state.consumptionVoiceCandidate.quantity,null);assert.equal(review.state.choices.some(row=>row.value==='USE_CONSUMPTION_VOICE'),false);const picker=pick(review,'ATTACH_CONSUMPTION_AUDIO',f);assert.equal(confirmManual(picker,f).state.quantity,'1.001');
});
test('evidence and transcription mutations block final confirmation while preserving the current draft',()=>{
 const f=facts(),confirmation=confirmManual(pick(begin(f),'image-a',f),f);
 for(const change of [e=>({...e,revision:'2026-10-20T12:00:00.000002'}),e=>({...e,status:'REJECTED'}),e=>({...e,workerId:'worker-other'}),e=>({...e,taskId:'task-other'}),e=>({...e,sectorId:'sector-other'}),e=>({...e,media:{...e.media,sha256:'e'.repeat(64)}})]){const changed=facts([change(image())]),stopped=pick(confirmation,'CONFIRM',changed);assert.equal(stopped.command,undefined);assert.deepEqual(stopped.state,confirmation.state);assert.equal(stopped.preserveConversation,true);}
 const voice=pick(pick(begin(f),'audio-a',f),'USE_CONSUMPTION_VOICE',f),e=audio();e.processing.result.text='Usamos 3 bolsas de cemento.';assert.equal(pick(voice,'CONFIRM',facts([e])).command,undefined);
 const cancelled=pick(confirmation,'CANCEL',facts([]));assert.equal(cancelled.state,null);assert.equal(cancelled.command,undefined);assert.match(cancelled.reply.body,/cancelada/);
});
test('current report permission expiry and old nonce prevent any linked consumption command',()=>{
 const f=facts(),first=begin(f),selected=pick(first,'image-a',f),confirmation=confirmManual(selected,f),denied=pick(confirmation,'CONFIRM',{...f,permissions:{attendance:true,report:false}});assert.equal(denied.command,undefined);assert.equal(denied.state,null);
 const stale=run({type:'interactive',interactive:{type:'list_reply',list_reply:{id:first.reply.sections[0].rows[0].id}}},selected.state,f);assert.equal(stale.command,undefined);assert.match(stale.reply.body,/paso anterior/);
 const expired=run({type:'interactive',interactive:{type:'list_reply',list_reply:{id:confirmation.reply.sections[0].rows[0].id}}},{...confirmation.state,expiresAt:'2026-10-20T11:59:00.000Z'},f);assert.equal(expired.command,undefined);assert.notEqual(expired.state?.step,'CONFIRM');
});
test('six-row pages allow up to ten attachments and always respect the ten-row WhatsApp menu limit',()=>{
 const all=Array.from({length:12},(_,i)=>image('image-'+i)),first=facts(all.slice(0,6));first.consumptionEvidenceCatalog.page.hasNext=true;let plan=begin(first);for(const e of all.slice(0,6)){plan=pick(plan,e.id,first);assert.ok(plan.state.choices.length<=10);}
 const second=facts(all.slice(6));second.consumptionEvidenceCatalog.evidence=all;second.consumptionEvidenceCatalog.page.hasPrevious=true;plan=pick(plan,'NEXT_CONSUMPTION_EVIDENCE',second);for(const e of all.slice(6,10)){plan=pick(plan,e.id,second);assert.ok(plan.state.choices.length<=10);}
 const blocked=pick(plan,all[10].id,second);assert.equal(blocked.state.evidenceIds.length,10);assert.equal(blocked.command,undefined);assert.match(blocked.reply.body,/10 adjuntos/);const cleared=pick(plan,'CLEAR_CONSUMPTION_EVIDENCE',second);assert.deepEqual(cleared.state.evidenceIds,[]);assert.deepEqual(cleared.state.consumptionEvidenceRefs,[]);
});
test('omitting evidence and general greeting preserve existing manual and draft semantics',()=>{
 const f=facts([]),quantity=begin(f);assert.equal(quantity.state.step,'CONSUMPTION_QUANTITY');const reason=say('2',quantity.state,f),confirmation=say('Consumo verificado para la mezcla.',reason.state,f),saved=pick(confirmation,'CONFIRM',f);assert.equal(saved.command.payload.evidenceIds,undefined);
 const selected=pick(begin(facts()),'image-a',facts()),greeting=say('HOLA',selected.state,facts());assert.deepEqual(greeting.state,selected.state);assert.equal(greeting.preserveConversation,true);assert.equal(greeting.command,undefined);
});
