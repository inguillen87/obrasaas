import test from 'node:test';
import assert from 'node:assert/strict';
import {closureUtcFromLocal,attendanceClosureViewMatches,attendanceClosurePayload,attendanceClosureOutcome} from '../src/app/(identity)/cuenta/attendance-closure-view.mjs';
import {createWorkspaceRecoveryJournal,recoveryQuery} from '../src/app/(identity)/cuenta/workspace-recovery-journal.mjs';
import {approved} from './fixtures/attendance-effective-audited.fixture.mjs';
const a=approved(),p=a.bundle.proposalEnvelope.proposal,scope='a'.repeat(64),expected={projectId:p.projectId,scope,workerId:p.workerId,shiftId:p.shiftId};
const view=()=>({...expected,readOnly:true,observedAt:'2026-10-29T12:00:00.000Z',chronology:a.projection,source:a.snapshot.source129,paymentCalculated:false,paymentEnabled:false,capabilities:{canPropose:true,decisions:[]},proposals:[]});
const proposalPayload=()=>({workerId:p.workerId,shiftId:p.shiftId,anchorEventId:a.snapshot.source129.anchorEventId,expectedHeadEventId:a.snapshot.source129.headEventId,sourceDigest:a.snapshot.source129.sourceDigest,effectiveLocalInput:'2026-10-26T17:00',effectiveTimeZone:'America/Argentina/Buenos_Aires',reason:'Hora declarada con respaldo para revisión independiente.'});
const pending=()=>({...view(),proposals:[{proposalEnvelope:a.bundle.proposalEnvelope,decisionEnvelope:null,state:'PENDING',currentSource:true}],capabilities:{canPropose:false,decisions:[{proposalId:p.id,canDecide:true}]}});
test('the typed view matches the selected account/worksite/person/shift and rejects a foreign capability',()=>{
 assert.equal(attendanceClosureViewMatches(view(),expected),true);for(const change of [v=>v.scope='b'.repeat(64),v=>v.chronology={...v.chronology,workerId:'worker_other'},v=>v.capabilities=null,v=>v.paymentEnabled=true]){const v=structuredClone(view());change(v);assert.equal(attendanceClosureViewMatches(v,expected),false);}
});
test('Argentina/Mendoza wall time resolves explicitly to UTC independently of the office computer zone',()=>{
 for(const zone of ['America/Argentina/Buenos_Aires','America/Argentina/Mendoza'])assert.deepEqual(closureUtcFromLocal('2026-10-26T17:00',zone),{effectiveEndAt:'2026-10-26T20:00:00.000Z',effectiveLocalEnd:'2026-10-26T17:00:00.000',effectiveTimeZone:zone});
});
test('ambiguous DST, nonexistent DST and invalid calendar inputs are refused',()=>{
 for(const [time,zone]of [['2026-03-08T02:30','America/New_York'],['2026-11-01T01:30','America/New_York'],['2026-02-30T12:00','UTC'],['2026-10-26T17:00','Not/AZone']])assert.throws(()=>closureUtcFromLocal(time,zone));
});
test('proposal payload binds the original exact head/source and contains no UI-only fields',()=>{
 const value=attendanceClosurePayload('PROPOSE_ATTENDANCE_CLOSURE',proposalPayload(),view());assert.equal(value.effectiveEndAt,'2026-10-26T20:00:00.000Z');assert.equal(value.expectedHeadEventId,a.snapshot.source129.headEventId);assert.equal(Object.hasOwn(value,'effectiveLocalInput'),false);assert.equal(Object.keys(value).length,9);
 for(const changed of [{...proposalPayload(),expectedHeadEventId:'another'},{...proposalPayload(),sourceDigest:'b'.repeat(64)}])assert.throws(()=>attendanceClosurePayload('PROPOSE_ATTENDANCE_CLOSURE',changed,view()),/jornada cambió/);
});
test('no client-side proposal is prepared when the canonical capability was revoked',()=>{const v=view();v.capabilities.canPropose=false;assert.throws(()=>attendanceClosurePayload('PROPOSE_ATTENDANCE_CLOSURE',proposalPayload(),v));});
test('decision binds the selected exact proposal and refuses same-account, superseded and stale versions',()=>{
 const input={proposalId:p.id,proposalRevision:p.revision,proposalDigest:p.proposalDigest,sourceDigest:p.sourceDigest,decision:'APPROVE',reason:'Revisión independiente del cierre declarado.'};assert.deepEqual(attendanceClosurePayload('DECIDE_ATTENDANCE_CLOSURE',input,pending()),input);
 for(const change of [v=>v.capabilities.decisions[0].canDecide=false,v=>v.proposals[0].state='SUPERSEDED',v=>v.proposals[0].currentSource=false]){const v=structuredClone(pending());change(v);assert.throws(()=>attendanceClosurePayload('DECIDE_ATTENDANCE_CLOSURE',input,v));}assert.throws(()=>attendanceClosurePayload('DECIDE_ATTENDANCE_CLOSURE',{...input,proposalRevision:2},pending()));
});
const op='11111111-1111-4111-8111-111111111111',ref={scope,projectId:p.projectId,operationId:op,action:'PROPOSE_ATTENDANCE_CLOSURE'},outcome={...ref,state:'RECORDED',saved:true,receiptId:p.proposalReceiptId,kind:'ATTENDANCE_CHRONOLOGY_CLOSURE_PROPOSAL',proposalEnvelope:{...a.bundle.proposalEnvelope,proposal:{...p,operationId:op}}};
test('a success or recovery receipt must match account scope, project, operation and action',()=>{
 assert.equal(attendanceClosureOutcome(outcome,ref),true);for(const change of [{operationId:'22222222-2222-4222-8222-222222222222'},{scope:'c'.repeat(64)},{action:'DECIDE_ATTENDANCE_CLOSURE'},{projectId:'project_other'},{receiptId:'invented'}])assert.equal(attendanceClosureOutcome({...outcome,...change},ref),false);assert.equal(attendanceClosureOutcome({...ref,state:'NOT_OBSERVED',definitive:false},ref),true);
});
function storage(){const map=new Map();return {get length(){return map.size;},key:i=>[...map.keys()][i]??null,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k),clear:()=>map.clear(),map};}
const command=action=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...ref,action,payload:{...proposalPayload(),privateNote:'PRIVATE_REASON_NEVER_STORED'}})});
test('shared recovery journal persists only typed receipt references, not the declared time or reason',async()=>{
 const s=storage(),j=createWorkspaceRecoveryJournal({getStorage:()=>s,now:()=>123,withLock:async(_key,_signal,reserve)=>reserve()}),ticket=await j.prepare('/api/identity/field-operations',command(ref.action));assert.equal(ticket.entry.action,ref.action);const raw=[...s.map.values()].join('');assert.doesNotMatch(raw,/PRIVATE_REASON|2026-10-26|effectiveLocal|reason|workerId/);assert.deepEqual(Object.keys(ticket.entry).sort(),['version','resource','scope','projectId','operationId','createdAt','action'].sort());assert.match(recoveryQuery(ticket.entry),/operationId=11111111/);
});
test('an unknown result keeps the original receipt and another write is blocked until recovery',async()=>{
 const s=storage(),j=createWorkspaceRecoveryJournal({getStorage:()=>s,now:()=>123,withLock:async(_key,_signal,reserve)=>reserve()}),ticket=await j.prepare('/api/identity/field-operations',command(ref.action));await j.settle(ticket,undefined,new Error('Synthetic transport interruption'));assert.equal(s.length,1);await assert.rejects(j.prepare('/api/identity/field-operations',{...command(ref.action),body:JSON.stringify({...ref,operationId:'22222222-2222-4222-8222-222222222222'})}),{code:'WORKSPACE_RECOVERY_REQUIRED'});
});
test('wrong-action success cannot release a closure reference, while an exact typed receipt can',async()=>{
 const s=storage(),j=createWorkspaceRecoveryJournal({getStorage:()=>s,now:()=>123,withLock:async(_key,_signal,reserve)=>reserve()}),ticket=await j.prepare('/api/identity/field-operations',command(ref.action));await j.settle(ticket,{...outcome,action:'DECIDE_ATTENDANCE_CLOSURE'});assert.equal(s.length,1);await j.settle(ticket,outcome);assert.equal(s.length,0);
});
