import test from 'node:test';
import assert from 'node:assert/strict';
import {createFieldHandlers} from '../src/lib/field-operations-http.mjs';
import {planMetaFieldConversation} from '../src/lib/meta-field-conversation.mjs';
const scope='a'.repeat(64),session={authenticated:true,verification:'clerk-production-jwt',userId:'user_Synthetic',organizationId:'org_Synthetic',organizationRole:'org:admin'},path='https://obrasaas.com/api/identity/field-operations';
test('closure read uses exact bounded selectors, canonical identity and private no-store headers',async()=>{
 const calls=[],handlers=createFieldHandlers({verify:async()=>session,operations:{attendanceClosureView:async(...args)=>{calls.push(args);return {readOnly:true};}}}),url=path+'?'+new URLSearchParams({projectId:'project_a',scope,closureWorkerId:'worker_a',closureShiftId:'shift_a'}),response=await handlers.GET(new Request(url));
 assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/private, no-store/);assert.equal(calls.length,1);assert.deepEqual(calls[0],[session,{projectId:'project_a',scope,workerId:'worker_a',shiftId:'shift_a'}]);
});
test('missing, duplicated and mixed closure selectors fail before the operation reader',async()=>{
 let calls=0;const h=createFieldHandlers({verify:async()=>session,operations:{attendanceClosureView:async()=>{calls++;}}});
 for(const query of [`projectId=project_a&scope=${scope}&closureWorkerId=worker_a`,`projectId=project_a&scope=${scope}&closureWorkerId=worker_a&closureShiftId=shift_a&closureShiftId=shift_b`,`projectId=project_a&scope=${scope}&closureWorkerId=worker_a&closureShiftId=shift_a&hoursFormat=json`])assert.equal((await h.GET(new Request(path+'?'+query))).status,400);assert.equal(calls,0);
});
test('an expired session or cross-site read cannot disclose a closure',async()=>{
 const operations={attendanceClosureView:async()=>assert.fail('Private reader called')},query='?'+new URLSearchParams({projectId:'project_a',scope,closureWorkerId:'worker_a',closureShiftId:'shift_a'});
 const expired=createFieldHandlers({verify:async()=>({authenticated:false}),operations});assert.equal((await expired.GET(new Request(path+query))).status,401);
 const cross=createFieldHandlers({verify:async()=>session,operations});assert.equal((await cross.GET(new Request(path+query,{headers:{'sec-fetch-site':'cross-site'}}))).status,403);
});
test('WhatsApp presents a new entry after a human close without offering another exit or losing the real predecessor',()=>{
 const facts={projectName:'Obra sintética',projectId:'project_a',workerId:'worker_a',permissions:{attendance:true,report:false},attendanceOnly:true,sectors:[{id:'sector_a',name:'Acceso'}],tasks:[],evidence:[],proposals:[],inventory:{materials:[]},latest:{id:'mark_real',eventType:'BREAK_END',phase:'WORKING',effectiveClosed:true,closureBasis:'HUMAN_APPROVED',sequence:3,recordedAt:'2026-10-26T16:00:00.000Z'}},now=new Date('2026-10-29T12:00:00.000Z');
 const menu=planMetaFieldConversation({message:{type:'text',text:{body:'HOLA'}},state:null,eventId:'message_a',facts,now});assert.ok(menu.state.choices.some(row=>row.value==='ATTEND_IN'));assert.ok(!menu.state.choices.some(row=>['ATTEND_OUT','ATTEND_PAUSE','ATTEND_RESUME'].includes(row.value)));
 const entry=planMetaFieldConversation({message:{type:'text',text:{body:'ENTRADA'}},state:null,eventId:'message_b',facts,now});assert.equal(entry.state.eventType,'CHECK_IN');assert.equal(entry.state.expectedEventId,'mark_real');assert.equal(entry.command,undefined);
});
