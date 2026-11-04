import test from 'node:test';
import assert from 'node:assert/strict';
import {approved,auditedInput,nextEvent,successorInput,recordingAudit} from './fixtures/attendance-effective-audited.fixture.mjs';
import {readAuditedAttendanceShift,projectAuditedAttendanceChronology,verifiedEffectiveAttendanceSummary,verifiedAttendanceTransition,prepareHumanClosureCheckpoint} from '../src/lib/attendance-chronology.mjs';
import {latestEffectiveJourneys,assertEffectivePersonJourney,nextClosureCheckpoint,effectiveHead,effectiveOverlap,effectiveHoursFact} from '../src/lib/attendance-effective-store.mjs';
const ledger=(...items)=>({complete:true,journeys:items.map(item=>({snapshot:item.snapshot,projection:item.projection})),byKey:new Map(items.map(item=>[JSON.stringify([item.projection.projectId,item.projection.workerId,item.projection.shiftId]),{snapshot:item.snapshot,projection:item.projection}]))});
test('human approval changes effective time while preserving every raw event and observed time',()=>{
 const input=auditedInput({breaks:true}),original=structuredClone(input),a=approved(input),summary=verifiedEffectiveAttendanceSummary(a.projection);
 assert.deepEqual(input,original);assert.equal(a.projection.rawState,'OPEN');assert.equal(summary.complete,true);assert.equal(summary.closureBasis,'HUMAN_APPROVED');assert.equal(summary.netMs,28800000);assert.equal(summary.observed.complete,false);assert.equal(summary.observed.endedAt,null);assert.equal(summary.closingEventId,input.events.at(-1).id);assert.equal(input.events.some(row=>row.metadata.fieldOperations.eventType==='CHECK_OUT'),false);
});
test('a copied or client supplied projection cannot authorize time or a transition',()=>{
 const a=approved();assert.throws(()=>verifiedEffectiveAttendanceSummary(structuredClone(a.projection)),{code:'ATTENDANCE_PROJECTION_UNVERIFIED'});assert.throws(()=>verifiedAttendanceTransition('CHECK_IN',a.snapshot.temporal.facts.at(-1).event,structuredClone(a.projection)),{code:'ATTENDANCE_PROJECTION_UNVERIFIED'});
});
test('same-person next check-in is allowed after an audited human close and retains the real previous event',()=>{
 const a=approved(),l=ledger(a),next=nextEvent(a.projection),last=a.snapshot.temporal.facts.at(-1).event;
 assert.equal(assertEffectivePersonJourney(l,{projectId:next.projectId,workerId:next.workerId,eventType:'CHECK_IN',at:next.recordedAt}).length,1);assert.deepEqual(verifiedAttendanceTransition('CHECK_IN',last,a.projection),{phase:'WORKING',closed:false});
 const checkpoint=nextClosureCheckpoint(l,next),input=successorInput(auditedInput(),a.projection,next,checkpoint),successor=readAuditedAttendanceShift(input);assert.equal(successor.summary.status,'OPEN');assert.equal(successor.temporal.facts[0].event.eventType,'CHECK_IN');assert.equal(input.events[0].metadata.fieldOperations.previousEventId,a.projection.lastRealEventId);
});
test('break, resume and a second exit cannot reopen a human-closed shift',()=>{
 const a=approved(),last=a.snapshot.temporal.facts.at(-1).event;
 for(const type of ['BREAK_START','BREAK_END','CHECK_OUT'])assert.throws(()=>verifiedAttendanceTransition(type,last,a.projection),{code:'ATTENDANCE_SHIFT_NOT_OPEN'});
});
test('global guard rejects another open worksite and forged completeness',()=>{
 const a=approved(),input=auditedInput();input.projectId='project_other';input.workerId='worker_other';input.shiftId='shift_other';input.events.forEach(row=>{row.projectId=input.projectId;row.workerId=input.workerId;row.metadata.fieldOperations.shiftId=input.shiftId;});input.recordingAudits=input.events.map(row=>recordingAudit(row));const snapshot=readAuditedAttendanceShift(input),projection=projectAuditedAttendanceChronology({snapshot});
 assert.throws(()=>assertEffectivePersonJourney(ledger(a,{snapshot,projection}),{projectId:a.projection.projectId,workerId:a.projection.workerId,eventType:'CHECK_IN',at:'2026-10-28T20:00:00.000Z'}),{code:'ATTENDANCE_PERSON_JOURNEY_OPEN'});assert.throws(()=>latestEffectiveJourneys({complete:false,journeys:[]}),{code:'ATTENDANCE_GLOBAL_SOURCE_INCOMPLETE'});
});
test('cross-project check-in gets a real human-closure checkpoint without fabricating a local predecessor',()=>{
 const a=approved(),next=nextEvent(a.projection,{otherProject:true}),checkpoint=nextClosureCheckpoint(ledger(a),next);assert.equal(checkpoint.sourceProjectId,a.projection.projectId);assert.equal(checkpoint.target.previousEventId,null);assert.equal(checkpoint.target.sequence,1);assert.equal(checkpoint.target.projectId,'project_other');
 const successor=readAuditedAttendanceShift(successorInput(auditedInput(),a.projection,next,checkpoint));assert.equal(successor.summary.status,'OPEN');
});
test('web head exposes raw event and explicit approved close, not a synthetic CHECK_OUT',()=>{
 const a=approved(),row=auditedInput().events[0],head=effectiveHead(row,ledger(a));assert.equal(head.id,row.id);assert.equal(head.eventType,'CHECK_IN');assert.equal(head.effectiveClosed,true);assert.equal(head.closureBasis,'HUMAN_APPROVED');assert.match(head.closureReceiptId,/^field_/);assert.equal(head.effectiveEndedAt,'2026-10-26T20:00:00.000Z');
});
test('checkpoint rejects time before approval, altered target and duplicate source',()=>{
 const a=approved(),next=nextEvent(a.projection);assert.throws(()=>nextClosureCheckpoint(ledger(a),{...next,recordedAt:'2026-10-26T19:00:00.000Z'}),{code:'ATTENDANCE_CHECKPOINT_INVALID'});assert.throws(()=>nextClosureCheckpoint(ledger(a),{...next,previousEventId:null}),{code:'ATTENDANCE_CHECKPOINT_LOCAL_PREDECESSOR_INVALID'});assert.throws(()=>prepareHumanClosureCheckpoint({prior:a.projection,next,global:{complete:true,journeys:[a.projection,a.projection]}}),{code:'ATTENDANCE_GLOBAL_SOURCE_INVALID'});
});
test('hours facts carry correction evidence and prohibit presence/payment claims',()=>{
 const a=approved(),fact=effectiveHoursFact(a.projection);assert.equal(fact.netMs,32400000);assert.equal(fact.closed,true);assert.equal(fact.basis,'HUMAN_APPROVED');assert.equal(fact.physicalPresenceConfirmed,false);assert.equal(fact.paymentEnabled,false);assert.equal(Object.hasOwn(fact,'reason'),false);assert.ok(a.projection.correction.reason.length>=8);assert.match(fact.sourceDigest,/^[a-f0-9]{64}$/);
});
test('the global guard rejects a new entry before an earlier close was approved',()=>{
 const a=approved();assert.throws(()=>assertEffectivePersonJourney(ledger(a),{projectId:'project_other',workerId:'worker_other',eventType:'CHECK_IN',at:'2026-10-26T21:00:00.000Z'}),{code:'ATTENDANCE_PERSON_CHRONOLOGY_CLOCK'});
});
