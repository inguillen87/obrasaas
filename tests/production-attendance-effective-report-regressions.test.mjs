import test from 'node:test';
import assert from 'node:assert/strict';
import {reportFixture,shift} from './helpers/field-hours-fixture.mjs';
import {fieldHoursCsv} from '../src/lib/field-hours-report.mjs';
import {latestEffectiveJourneys,assertEffectivePersonJourney,readScopedAttendanceAnnotations} from '../src/lib/attendance-effective-store.mjs';

test('a complete selected raw shift with mixed authors retains diagnostics and cannot certify effective hours from a subset',async()=>{
 const f=reportFixture(),events=shift();events[1].metadata.fieldOperations.recordedBy='actor-other';f.add(events);
 const report=await f.read();assert.equal(report.complete,true);assert.equal(report.rows.length,1);const row=report.rows[0];
 assert.equal(row.status,'INTEGRITY_REVIEW_REQUIRED');assert.equal(row.netMs,null);assert.equal(row.sourceEventIds.length,2);assert.equal(row.effective.state,'UNCONFIRMED');assert.equal(row.effective.netMs,null);assert.ok(row.issues.length>0);assert.equal(report.totals.closedEffectiveNetMs,null);assert.equal(report.totals.closedEffectiveEvidenceReadyNetMs,null);assert.equal(report.totals.effectiveTotalsComplete,false);assert.equal(report.totals.effectiveUnconfirmedShifts,1);
 const csv=fieldHoursCsv(report,report.reportDigest).csv;assert.match(csv,/UNCONFIRMED/);assert.doesNotMatch(csv,/closure_reason/);
});
test('another project and period missing a receipt cannot erase the selected report or change its digest',async()=>{
 const f=reportFixture();f.add(shift());const before=await f.read();const foreign=f.add(shift({projectId:'project-b',workerId:'worker-b',id:'foreign',times:['2026-09-05T11:00:00.000Z','2026-09-05T19:00:00.000Z']}));f.state.receipts=f.state.receipts.filter(a=>a.metadata.outcome.event.id!==foreign[1].id);
 const after=await f.read();assert.equal(after.complete,true);assert.equal(after.rows.length,1);assert.equal(after.rows[0].status,'CLOSED');assert.equal(after.rows[0].effective.state,'RECORDED_CLOSED');assert.equal(after.reportDigest,before.reportDigest);assert.equal(after.totals.closedEffectiveNetMs,28800000);
});
test('a directed complete read has no authority to establish a global guard or next arrival',()=>{
 const scoped={complete:true,selectionOnly:true,journeys:[],byKey:new Map()};
 assert.throws(()=>latestEffectiveJourneys(scoped),{code:'ATTENDANCE_GLOBAL_SOURCE_INCOMPLETE'});
 assert.throws(()=>assertEffectivePersonJourney(scoped,{projectId:'project-a',workerId:'worker-a',eventType:'CHECK_IN',at:'2026-10-28T20:00:00.000Z'}),{code:'ATTENDANCE_GLOBAL_SOURCE_INCOMPLETE'});
});
test('an empty navigation scope needs no correction query or attendance authority',async()=>{
 const result=await readScopedAttendanceAnnotations({query(){throw new Error('No attendance scope must not read private attendance');}},{organizationId:'company-a',projectId:'project-a',shifts:[]});assert.equal(result.ambiguous,false);assert.equal(result.keys.size,0);
});
test('an old unlocatable correction marker remains explicit ambiguity instead of overriding an ordinary head',async()=>{
 const calls=[],client={async query(sql,args){calls.push({sql,args});return {rows:sql.includes('public."AuditLog"')?[{id:'marker',metadata:{beneficiaryActorId:'actor-worker'}}]:[]};}};
 const result=await readScopedAttendanceAnnotations(client,{organizationId:'company-a',projectId:'project-a',shifts:[{workerId:'worker-a',shiftId:'shift-a'}]});assert.equal(result.ambiguous,true);assert.equal(calls.length,2);assert.deepEqual(calls[0].args,['project-a',['worker-a'],['shift-a']]);assert.deepEqual(calls[1].args,['company-a','project-a',['worker-a'],['shift-a']]);
});
