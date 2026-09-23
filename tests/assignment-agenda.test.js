import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAssignmentAgenda, selectAgendaRows, validAgendaDay, shiftAgendaDay, assignmentAgendaToday } from '../src/lib/assignment-agenda.js';
const iso = day => day === null ? null : day + 'T00:00:00.000Z';
const row = (id, start, end, extra = {}) => ({ id, projectId:'p1', taskId:'t1', workerId:'w1', teamId:null, status:'PLANNED', startsAt:iso(start), endsAt:iso(end), revision:0, ...extra });
const model = (rows, day='2026-09-23') => buildAssignmentAgenda(rows,{projectId:'p1',day});
const ids = rows => rows.map(item => item.id);
for (const value of ['2024-02-29','2026-09-23','2000-02-29','2026-12-31']) test('valid civil day '+value,()=>assert.equal(validAgendaDay(value),true));
for (const value of ['',null,undefined,'2026-02-29','2026-02-30','2026-13-01','2026-9-23','2026-09-23T00:00:00Z',20260923]) test('reject malformed civil day '+String(value),()=>assert.equal(validAgendaDay(value),false));
test('civil shifts cross months and years independently of DST',()=>{
  assert.equal(shiftAgendaDay('2026-12-28',7),'2027-01-04');assert.equal(shiftAgendaDay('2024-02-28',1),'2024-02-29');
  assert.equal(shiftAgendaDay('2026-03-08',1),'2026-03-09');assert.equal(shiftAgendaDay('2026-09-01',-1),'2026-08-31');
  for(const count of [NaN,1.5,367,'7'])assert.equal(shiftAgendaDay('2026-09-23',count),null);
});
test('tenant civil day differs across LATAM without taking the host day',()=>{
  const instant=new Date('2026-09-23T01:30:00.000Z');
  assert.equal(assignmentAgendaToday('America/Argentina/Buenos_Aires',instant),'2026-09-22');
  assert.equal(assignmentAgendaToday('America/Bogota',instant),'2026-09-22');assert.equal(assignmentAgendaToday('UTC',instant),'2026-09-23');
  assert.equal(assignmentAgendaToday('Pacific/Kiritimati',new Date('2026-12-31T12:00:00Z')),'2027-01-01');
});
for(const zone of [undefined,null,'','  ','America/Invented',' UTC ','+02:00'])test('no silent timezone fallback '+String(zone),()=>assert.equal(assignmentAgendaToday(zone,new Date('2026-09-23')),null));
test('invalid clock is not replaced with now',()=>{
  assert.equal(assignmentAgendaToday('UTC',new Date(NaN)),null);assert.equal(assignmentAgendaToday('UTC','2026-09-23'),null);
});
test('overdue is strictly before reference; one-day periods include the whole day',()=>{
  const m=model([row('old','2026-09-20','2026-09-22'),row('now','2026-09-23','2026-09-23'),row('ongoing','2026-09-01','2026-09-30')]);
  assert.deepEqual(ids(m.buckets.overdue),['old']);assert.deepEqual(ids(m.buckets.onDate),['now','ongoing']);assert.equal(m.open,3);
});
test('upcoming starts exclude today and include precisely the following seven days',()=>{
  const m=model([row('today','2026-09-23','2026-09-23'),row('tomorrow','2026-09-24','2026-10-10'),row('edge','2026-09-30','2026-10-01'),row('later','2026-10-01','2026-10-02')]);
  assert.deepEqual(ids(m.buckets.upcoming),['tomorrow','edge']);assert.equal(m.horizon,'2026-09-30');assert.equal(m.counts.all,4);
});
test('completed and cancelled assignments never acquire open planning warnings',()=>{
  const m=model([row('done','2026-09-01','2026-09-02',{status:'ENDED'}),row('cancelled',null,null,{status:'CANCELLED'})]);
  assert.equal(m.open,0);for(const key of ['overdue','onDate','upcoming','review'])assert.equal(m.counts[key],0);assert.equal(m.counts.all,2);
});
test('missing periods are distinguished from inconsistent and non-midnight legacy dates',()=>{
  const m=model([row('none',null,null),row('no-end','2026-09-01',null),row('only-end',null,'2026-09-20'),row('reversed','2026-09-30','2026-09-20'),row('time','2026-09-01','2026-09-20',{startsAt:'2026-09-01T12:00:00.000Z'}),row('broken','2026-09-01','2026-09-20',{endsAt:'2026-02-30T00:00:00.000Z'})]);
  assert.equal(m.incomplete,2);assert.equal(m.invalid,4);assert.equal(m.counts.review,6);assert.equal(m.counts.overdue,0);
});
test('input rows and order are not mutated; overdue entries sort oldest first with stable ID ties',()=>{
  const rows=[row('b','2026-09-01','2026-09-10'),row('c','2026-09-01','2026-09-05'),row('a','2026-09-01','2026-09-10')];
  const before=structuredClone(rows);rows.forEach(Object.freeze);Object.freeze(rows);const m=model(rows);
  assert.deepEqual(ids(m.buckets.all),['b','c','a']);assert.deepEqual(ids(m.buckets.overdue),['c','a','b']);assert.deepEqual(rows,before);
});
test('only rows of the supplied worksite enter totals, search, or buckets',()=>{
  const m=model([row('own','2026-09-01','2026-09-20'),row('other','2026-09-01','2026-09-20',{projectId:'p2'}),null]);
  assert.equal(m.counts.all,1);assert.deepEqual(ids(selectAgendaRows(m)),['own']);
  for(const scope of [undefined,null,{}, {projectId:''}])assert.throws(()=>buildAssignmentAgenda([],scope),TypeError);
});
test('missing reference leaves the list usable but never guesses a date',()=>{
  const m=model([row('dated','2026-09-01','2026-09-20'),row('missing',null,null)],null);
  assert.equal(m.day,null);assert.equal(m.horizon,null);assert.equal(m.counts.overdue,0);assert.equal(m.counts.review,1);assert.equal(m.counts.all,2);
});
test('search handles accents, multiple tokens, task codes and mixed person/team assignments',()=>{
  const m=model([row('person','2026-09-23','2026-09-25'),row('crew','2026-09-23','2026-09-25',{workerId:null,teamId:'c1'})]);
  const names={tasks:[{id:'t1',title:'Hormigón armado',code:'EST-08'}],workers:[{id:'w1',name:'José Álvarez'}],teams:[{id:'c1',name:'Cuadrilla Norte'}]};
  assert.deepEqual(ids(selectAgendaRows(m,{...names,query:' jose  hormigon '})),['person']);assert.deepEqual(ids(selectAgendaRows(m,{...names,query:'est-08 norte'})),['crew']);
  assert.equal(selectAgendaRows(m,{...names,query:'sin coincidencias'}).length,0);
});
test('search and state never overwrite aggregate counts',()=>{
  const m=model([row('open','2026-09-01','2026-09-20'),row('closed','2026-09-01','2026-09-20',{status:'ENDED'})]);
  assert.equal(selectAgendaRows(m,{bucket:'overdue',status:'closed'}).length,0);assert.equal(m.counts.all,2);assert.equal(m.counts.overdue,1);
  assert.deepEqual(ids(selectAgendaRows(m,{status:'closed'})),['closed']);
  assert.deepEqual(selectAgendaRows(m,{bucket:'invented'}),[]);assert.deepEqual(selectAgendaRows(m,{status:'invented'}),[]);
});
test('empty data is not substituted with demo assignments',()=>{
  const m=model([]);assert.deepEqual(m.counts,{all:0,overdue:0,onDate:0,upcoming:0,review:0});assert.equal(selectAgendaRows(m).length,0);
});
test('reprogramming updates its derived bucket without creating another assignment or changing status',()=>{
  const source=row('same','2026-09-01','2026-09-10');assert.equal(model([source]).counts.overdue,1);
  const updated={...source,startsAt:iso('2026-09-25'),endsAt:iso('2026-09-28'),revision:1};const m=model([updated]);
  assert.equal(m.counts.overdue,0);assert.equal(m.counts.upcoming,1);assert.equal(m.counts.all,1);assert.equal(updated.status,'PLANNED');
});
test('calendar groups are disjoint for a range of complete open intervals',()=>{
  const rows=[];for(let i=-20;i<=20;i++)rows.push(row('r'+(i+20),shiftAgendaDay('2026-09-23',i),shiftAgendaDay('2026-09-23',i+3)));
  const m=model(rows),classified=['overdue','onDate','upcoming','review'].flatMap(key=>ids(m.buckets[key]));
  assert.equal(new Set(classified).size,classified.length);assert.ok(classified.length<m.open);
});
