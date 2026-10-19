import test from 'node:test';
import assert from 'node:assert/strict';
import {fieldHoursPeriod,fieldHoursCsv} from '../src/lib/field-hours-report.mjs';
import {period,clone,shift,addReview,reportFixture,csvRows,ledgerReads} from './helpers/field-hours-fixture.mjs';

for(const selected of [null,{},[],{...period,fromDate:'2026-02-30'},{...period,fromDate:'2026-11-01'},{...period,untilDate:'2026-10-01'},{...period,timeZone:''},{...period,timeZone:'No/Such_Zone'},{...period,timeZone:' UTC '},{...period,role:'ADMIN'}])test('invalid or injected period is refused before any ledger read '+JSON.stringify(selected),async()=>{
 const f=reportFixture();await assert.rejects(f.read(selected),{code:'FIELD_HOURS_PERIOD_INVALID'});assert.equal(ledgerReads(f),0);
});
test('one and 31 calendar days are accepted; 32 days do not become a partial report',async()=>{
 assert.equal(fieldHoursPeriod({...period,untilDate:'2026-10-02'}).untilExclusive,true);assert.equal(fieldHoursPeriod(period).selection,'SHIFT_CHECK_IN_RECORDED_AT_LOCAL_DATE');
 const f=reportFixture();await assert.rejects(f.read({...period,untilDate:'2026-11-02'}),{code:'FIELD_HOURS_PERIOD_TOO_LONG'});assert.equal(ledgerReads(f),0);
});
test('midnight selection belongs to the explicitly chosen local date, with exclusive upper bound',async()=>{
 const f=reportFixture();f.add(shift({id:'at-start',workerId:'worker-start',times:['2026-10-01T03:00:00.000Z','2026-10-01T04:00:00.000Z']}));f.add(shift({id:'before-start',workerId:'worker-before',times:['2026-10-01T02:59:59.999Z','2026-10-01T04:00:00.000Z']}));f.add(shift({id:'at-end',workerId:'worker-end',times:['2026-10-02T03:00:00.000Z','2026-10-02T04:00:00.000Z']}));
 const value=await f.read({...period,untilDate:'2026-10-02'});assert.equal(value.complete,true);assert.deepEqual(value.rows.map(row=>row.shiftId),['at-start']);assert.equal(value.rows[0].localStartDate,'2026-10-01');assert.equal(value.totals.closedObservedNetMs,3600000);
 const utc=await f.read({...period,untilDate:'2026-10-02',timeZone:'UTC'});assert.deepEqual(utc.rows.map(row=>row.shiftId),['before-start','at-start']);
});
for(const [name,fromDate,untilDate,start,end,expectedMs]of [
 ['spring DST','2026-03-08','2026-03-09','2026-03-08T05:00:00.000Z','2026-03-09T04:00:00.000Z',23*3600000],
 ['fall DST','2026-11-01','2026-11-02','2026-11-01T04:00:00.000Z','2026-11-02T05:00:00.000Z',25*3600000]
])test('a complete '+name+' shift keeps physical UTC duration instead of assuming 24 hours',async()=>{
 const f=reportFixture();f.add(shift({times:[start,end]}));const value=await f.read({fromDate,untilDate,timeZone:'America/New_York'});assert.equal(value.rows.length,1);assert.equal(value.rows[0].netMs,expectedMs);assert.equal(value.totals.closedObservedNetMs,expectedMs);assert.equal(value.rows[0].durationScope,'FULL_CLOSED_SHIFT');
});
test('whole-shift allocation includes a later close and excludes an earlier start, without clipping either',async()=>{
 const f=reportFixture();f.add(shift({id:'starts-inside',workerId:'inside',times:['2026-10-01T20:00:00.000Z','2026-10-03T05:00:00.000Z']}));f.add(shift({id:'starts-before',workerId:'before',times:['2026-09-30T22:00:00.000Z','2026-10-01T20:00:00.000Z']}));
 const value=await f.read({...period,untilDate:'2026-10-02',timeZone:'UTC'});assert.deepEqual(value.rows.map(row=>row.shiftId),['starts-inside']);assert.equal(value.rows[0].netMs,33*3600000);assert.equal(value.period.allocation,'WHOLE_SHIFT_NOT_SPLIT_AT_PERIOD_BOUNDARIES');
});
test('multiple registered pauses are subtracted exactly, including milliseconds',async()=>{
 const f=reportFixture();f.add(shift({types:['CHECK_IN','BREAK_START','BREAK_END','BREAK_START','BREAK_END','CHECK_OUT'],times:['2026-10-05T11:00:00.000Z','2026-10-05T13:00:00.000Z','2026-10-05T13:20:00.250Z','2026-10-05T15:00:00.000Z','2026-10-05T15:10:00.125Z','2026-10-05T19:00:00.000Z']}));const value=await f.read();assert.equal(value.rows[0].elapsedMs,28800000);assert.equal(value.rows[0].breakMs,1800375);assert.equal(value.rows[0].netMs,26999625);assert.equal(value.totals.closedEvidenceReadyNetMs,26999625);assert.equal(value.rows[0].events.length,6);
});
test('zero-length closed shift remains an explicit valid zero, with two source events',async()=>{
 const f=reportFixture();f.add(shift({times:['2026-10-05T11:00:00.000Z','2026-10-05T11:00:00.000Z']}));const value=await f.read();assert.equal(value.rows[0].complete,true);assert.equal(value.rows[0].netMs,0);assert.equal(value.totals.closed,1);assert.equal(value.rows[0].sourceEventIds.length,2);
});
for(const [types,times,status,expectedMs]of [
 [['CHECK_IN'],['2026-10-05T11:00:00.000Z'],'OPEN',0],
 [['CHECK_IN','BREAK_START'],['2026-10-05T11:00:00.000Z','2026-10-05T13:00:00.000Z'],'ON_BREAK',7200000]
])test(status+' shift exports an exact observed-through instant and never counts as closed time',async()=>{
 const f=reportFixture();f.add(shift({types,times}));const before=await f.read();f.state.generatedAt='2026-10-19T17:22:00.000Z';const after=await f.read();const row=after.rows[0];assert.equal(row.status,status);assert.equal(row.netMs,expectedMs);assert.equal(row.lastRecordedAt,times.at(-1));assert.equal(row.endedAt,null);assert.equal(row.durationScope,'RECORDED_INTERVALS_ONLY_OPEN_SHIFT');assert.equal(after.totals.closedObservedNetMs,0);assert.equal(after.totals.closed,0);assert.equal(after.totals.open,1);assert.equal(before.reportDigest,after.reportDigest);
 const exported=csvRows(fieldHoursCsv(after,after.reportDigest).csv)[0];assert.equal(exported.observed_through_at_utc,times.at(-1));assert.equal(exported.duration_scope,'RECORDED_INTERVALS_ONLY_OPEN_SHIFT');assert.equal(exported.ended_at_utc,'');
});
for(const [name,change]of [
 ['sequence gap',rows=>rows[1].metadata.fieldOperations.sequence=3],
 ['wrong previous reference',rows=>rows[1].metadata.fieldOperations.previousEventId='missing-event'],
 ['different author',rows=>rows[1].metadata.fieldOperations.recordedBy='other-person'],
 ['decreasing clock',rows=>rows[1].metadata.fieldOperations.recordedAt='2026-10-05T10:00:00.000Z'],
 ['open break at close',rows=>{rows.splice(1,0,clone(rows[0]));rows[1].id='attendance-break';Object.assign(rows[1].metadata.fieldOperations,{eventType:'BREAK_START',phase:'ON_BREAK',sequence:2,previousEventId:rows[0].id,recordedAt:'2026-10-05T12:00:00.000Z',verificationStatus:'NOT_REQUIRED',location:null});Object.assign(rows[2].metadata.fieldOperations,{sequence:3,previousEventId:rows[1].id});}],
 ['self-reviewed evidence',rows=>{rows[1].metadata.fieldOperations.verificationStatus='REVIEW_REQUIRED';rows[1].metadata.fieldOperations.review={decision:'APPROVE',actorId:'actor-worker',recordedAt:'2026-10-06T00:00:00.000Z',reason:'Synthetic self-review must fail'};}]
])test('invalid chain '+name+' retains a correction row without a computable/payable duration',async()=>{
 const f=reportFixture(),rows=shift();change(rows);f.add(rows);const value=await f.read();assert.equal(value.complete,true);assert.equal(value.rows[0].status,'INTEGRITY_REVIEW_REQUIRED');assert.equal(value.rows[0].netMs,null);assert.equal(value.rows[0].durationScope,'UNCONFIRMED');assert.equal(value.rows[0].readyForOperationalReview,false);assert.equal(value.totals.closedObservedNetMs,0);assert.ok(value.rows[0].issues.length>0);assert.deepEqual(new Set(value.rows[0].sourceEventIds),new Set(rows.map(row=>row.id)));
});
test('prior close outside the period remains chain evidence, not another paid-period shift',async()=>{
 const f=reportFixture(),prior=shift({id:'prior',times:['2026-09-30T10:00:00.000Z','2026-09-30T11:00:00.000Z']});f.add(prior);const current=shift({id:'current',initialSequence:3,previousEventId:prior[1].id});f.add(current);const valid=await f.read();assert.equal(valid.rows.length,1);assert.equal(valid.rows[0].status,'CLOSED');assert.equal(valid.rows[0].previousEventId,prior[1].id);assert.equal(valid.rows[0].sourceEventIds.length,2);
 f.state.ledger=f.state.ledger.filter(row=>row.id!==prior[1].id);const invalid=await f.read();assert.equal(invalid.rows[0].netMs,null);assert.ok(invalid.rows[0].issues.includes('CHAIN_PREDECESSOR_INVALID'));
});
for(const decision of [null,'APPROVE','REJECT'])test('review '+decision+' preserves observed time but changes the operationally-ready total',async()=>{
 const f=reportFixture(),rows=f.add(shift({verificationStatus:'REVIEW_REQUIRED'}));if(decision)for(const row of rows)addReview(f,row,decision);
 const value=await f.read();assert.equal(value.rows[0].netMs,28800000);assert.equal(value.totals.closedObservedNetMs,28800000);assert.equal(value.totals.closedEvidenceReadyNetMs,decision==='APPROVE'?28800000:0);assert.equal(value.rows[0].evidenceStatus,decision==='APPROVE'?'READY':decision==='REJECT'?'REJECTED':'PENDING_REVIEW');assert.equal(value.rows[0].auditStatus,'CONFIRMED');
});
for(const [name,change]of [
 ['missing source receipt',f=>f.state.receipts.shift()],
 ['duplicate source receipt',f=>f.state.receipts.push({...clone(f.state.receipts[0]),id:'field_'+'9'.repeat(64)})],
 ['receipt belongs to another project',f=>f.state.receipts[0].entityId='project-foreign'],
 ['receipt has another actor',f=>f.state.receipts[0].actorId='foreign-actor'],
 ['receipt content changed',f=>f.state.receipts[0].metadata.outcome.event.recordedAt='2026-10-05T11:01:00.000Z'],
 ['request digest is malformed',f=>f.state.receipts[0].metadata.requestDigest='forged']
])test(name+' does not turn observed hours into confirmed evidence',async()=>{
 const f=reportFixture();f.add(shift());change(f);const value=await f.read();assert.equal(value.rows[0].netMs,28800000);assert.equal(value.rows[0].auditStatus,'REVIEW_REQUIRED');assert.equal(value.totals.closedEvidenceReadyNetMs,0);assert.equal(value.rows[0].readyForOperationalReview,false);
});
test('a review receipt is independently required and free-text reasons never enter the JSON or CSV projection',async()=>{
 const f=reportFixture(),rows=f.add(shift({verificationStatus:'REVIEW_REQUIRED'}));for(const row of rows)addReview(f,row,'APPROVE',{reason:'PRIVATE_DNI_COORDINATES_URL_SENTINEL'});const complete=await f.read();assert.equal(complete.rows[0].auditStatus,'CONFIRMED');const text=JSON.stringify(complete)+fieldHoursCsv(complete,complete.reportDigest).csv;assert.ok(!text.includes('PRIVATE_DNI_COORDINATES_URL_SENTINEL'));assert.ok(!text.includes('latitude'));assert.ok(!text.includes('12.345678'));assert.ok(!text.includes('PRIVATE_METADATA_NOT_IN_PROJECTION'));
 f.state.receipts=f.state.receipts.filter(audit=>!(audit.metadata.command==='REVIEW_ATTENDANCE'&&audit.metadata.outcome.event.id===rows[0].id));const incomplete=await f.read();assert.equal(incomplete.rows[0].auditStatus,'REVIEW_REQUIRED');assert.equal(incomplete.totals.closedEvidenceReadyNetMs,0);
});
test('later overtime metadata does not rewrite attendance facts or fabricate money',async()=>{
 const f=reportFixture(),rows=f.add(shift());const before=await f.read();rows[1].metadata.fieldOperations.overtime={status:'APPROVED',requestedExtraMs:1000,reason:'PRIVATE_OVERTIME_NOT_PART_OF_ATTENDANCE'};const after=await f.read();assert.equal(after.rows[0].auditStatus,'CONFIRMED');assert.equal(after.rows[0].netMs,before.rows[0].netMs);assert.equal(after.reportDigest,before.reportDigest);assert.equal(after.salaryCalculated,false);assert.equal(after.paymentEnabled,false);assert.ok(!JSON.stringify(after).includes('PRIVATE_OVERTIME_NOT_PART_OF_ATTENDANCE'));
});
test('source and review changes invalidate the exact preview digest; generation clock alone does not',async()=>{
 const f=reportFixture(),rows=f.add(shift({verificationStatus:'REVIEW_REQUIRED'}));const before=await f.read();f.state.generatedAt='2026-10-18T13:00:00.000Z';const clock=await f.read();assert.equal(clock.reportDigest,before.reportDigest);for(const row of rows)addReview(f,row,'APPROVE');const after=await f.read();assert.notEqual(after.reportDigest,before.reportDigest);assert.throws(()=>fieldHoursCsv(after,before.reportDigest),{code:'FIELD_HOURS_SOURCE_CHANGED'});assert.equal(csvRows(fieldHoursCsv(after,after.reportDigest).csv).length,1);
});
for(const [name,change,reason]of [
 ['legacy source',f=>f.state.ledger.push({id:'legacy-source',projectId:'project-a',workerId:'legacy-person',metadata:{legacy:true}}),'UNSUPPORTED_LEDGER_RECORDS'],
 ['unlocatable timestamp',f=>f.state.ledger[0].metadata.fieldOperations.recordedAt='2026-02-30T00:00:00.000Z','UNLOCATABLE_LEDGER_RECORD'],
 ['duplicate row ID',f=>f.state.ledger.push(clone(f.state.ledger[0])),'UNLOCATABLE_LEDGER_RECORD'],
 ['orphan outside the period',f=>f.state.ledger.push(...shift({id:'orphan',workerId:'orphan-person',types:['CHECK_OUT'],times:['2026-09-01T12:00:00.000Z']})),'SHIFT_ANCHOR_INTEGRITY_REQUIRED'],
 ['two starts in one shift',f=>{const another=clone(f.state.ledger[0]);another.id='duplicate-check-in';f.state.ledger.push(another);},'SHIFT_ANCHOR_INTEGRITY_REQUIRED']
])test(name+' cannot disappear behind a partial or apparently empty export',async()=>{
 const f=reportFixture();f.add(shift());change(f);const value=await f.read();assert.equal(value.state,'INCOMPLETE');assert.equal(value.complete,false);assert.equal(value.exportable,false);assert.deepEqual(value.rows,[]);assert.equal(value.totals,null);assert.equal(value.completeness.reason,reason);assert.throws(()=>fieldHoursCsv(value,'a'.repeat(64)),{code:'FIELD_HOURS_INCOMPLETE'});
});
test('10000 project events are enumerable; event 10001 blocks instead of silently dropping history',async()=>{
 const f=reportFixture();for(let i=0;i<4999;i++)f.add(shift({id:'old-'+i,workerId:'old-person-'+i,times:['2026-09-01T10:00:00.000Z','2026-09-01T11:00:00.000Z']}),{audited:false});f.add(shift());assert.equal(f.state.ledger.length,10000);const complete=await f.read();assert.equal(complete.complete,true);assert.equal(complete.rows.length,1);assert.equal(complete.completeness.ledgerEvents,10000);
 const extra=clone(f.state.ledger[0]);extra.id='sentinel-extra';f.state.ledger.push(extra);const partial=await f.read();assert.equal(partial.completeness.reason,'PROJECT_LEDGER_LIMIT');assert.equal(partial.totals,null);assert.equal(partial.exportable,false);
});
test('200 selected journeys are complete; 201 produce no partial totals or CSV',async()=>{
 const f=reportFixture();for(let i=0;i<200;i++)f.add(shift({id:'batch-'+i,workerId:'person-'+i}));const complete=await f.read();assert.equal(complete.complete,true);assert.equal(complete.rows.length,200);f.add(shift({id:'batch-201',workerId:'person-201'}));const partial=await f.read();assert.equal(partial.completeness.reason,'PERIOD_SHIFT_LIMIT');assert.deepEqual(partial.rows,[]);assert.equal(partial.totals,null);
});
test('a source audit cardinality beyond its sentinel prevents incomplete receipt enumeration',async()=>{
 const f=reportFixture();f.add(shift());while(f.state.receipts.length<5)f.state.receipts.push({...clone(f.state.receipts[0]),id:'field_'+String(f.state.receipts.length).repeat(64)});const value=await f.read();assert.equal(value.completeness.reason,'SOURCE_AUDIT_CARDINALITY_REQUIRED');assert.equal(value.exportable,false);
});
test('duration aggregation never overflows into an approximate or negative period total',async()=>{
 const f=reportFixture();for(let i=0;i<50;i++)f.add(shift({id:'long-'+i,workerId:'long-person-'+i,times:['2026-10-01T03:00:00.000Z','9999-01-01T00:00:00.000Z']}));await assert.rejects(f.read(),{code:'FIELD_HOURS_DURATION_UNSAFE'});
});
test('a truly empty complete period preserves context without a fictional worker or zero shift',async()=>{
 const f=reportFixture(),value=await f.read(),rows=csvRows(fieldHoursCsv(value,value.reportDigest).csv);assert.equal(value.totals.shifts,0);assert.equal(rows.length,1);assert.equal(rows[0].shift_status,'NO_SHIFTS_IN_SELECTION');assert.equal(rows[0].worker_id,'');assert.equal(rows[0].observed_net_ms,'');assert.equal(rows[0].from_local_date,period.fromDate);assert.equal(rows[0].until_local_date_exclusive,period.untilDate);
});
for(const name of ['=HYPERLINK("https://invalid.test","x")',' +SUM(1,2)','\t-1+2','\r@SUM(A1)','Guillén, "Ensayo"\nSegunda línea'])test('CSV safely represents text cell '+JSON.stringify(name)+' while keeping numeric milliseconds exact',async()=>{
 const f=reportFixture();f.add(shift(),{name});const value=await f.read(),file=fieldHoursCsv(value,value.reportDigest),row=csvRows(file.csv)[0];assert.ok(file.csv.startsWith('\uFEFF'));assert.ok(file.csv.endsWith('\r\n'));assert.equal(row.worker_current_name,/^[\s\u0001-\u001f]*[=+@-]/u.test(name)?"'"+name:name);assert.equal(row.observed_net_ms,'28800000');assert.deepEqual(JSON.parse(row.source_event_ids_json),value.rows[0].sourceEventIds);assert.equal(row.salary_calculated,'false');assert.equal(row.payment_enabled,'false');assert.ok(!file.csv.includes('hourly_rate'));
});
test('the exporter refuses absent/wrong preview digest and an oversized complete file',async()=>{
 const f=reportFixture();f.add(shift());const value=await f.read();for(const wrong of [null,'','f'.repeat(64)])assert.throws(()=>fieldHoursCsv(value,wrong),{code:'FIELD_HOURS_SOURCE_CHANGED'});f.state.workers[0].name='x'.repeat(3*1024*1024);const large=await f.read();assert.throws(()=>fieldHoursCsv(large,large.reportDigest),{code:'FIELD_HOURS_EXPORT_TOO_LARGE'});
});
test('reassigned or missing current worker labels do not transfer the original actor or hide recorded history',async()=>{
 const f=reportFixture();f.add(shift());f.state.workers[0].name='Nombre actual distinto';f.state.workers[0].active=false;const inactive=await f.read();assert.equal(inactive.rows[0].workerCurrentName,'Nombre actual distinto');assert.equal(inactive.rows[0].recordedBy,'actor-worker');assert.equal(inactive.rows[0].workerCurrentlyActive,false);f.state.workers=[];const absent=await f.read();assert.equal(absent.rows[0].workerCurrentName,null);assert.equal(absent.rows[0].recordedBy,'actor-worker');assert.equal(absent.rows[0].netMs,28800000);assert.equal(absent.rows[0].readyForOperationalReview,false);
});