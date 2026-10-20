import test from 'node:test';
import assert from 'node:assert/strict';
import {readConsumptionEvidenceCatalog} from '../src/lib/consumption-evidence-catalog.mjs';

const context={organizationId:'org-a',projectId:'project-a',workerId:'worker-a',actorId:'actor-a',taskId:'task-a',sectorId:'sector-a'},web={lockRetained:false,includeRetainedProcessing:false,requireAllRetained:true},key=row=>row.createdAt+'|'+row.id;
function record(n,extra={}){return {id:'evidence-'+String(n).padStart(3,'0'),title:'Registro '+n,projectId:'project-a',organizationId:'org-a',recordedBy:'actor-a',workerId:'worker-a',taskId:'task-a',sectorId:'sector-a',revision:'2026-10-20T12:00:00.000001',createdAt:new Date(Date.parse('2026-10-19T12:00:00Z')+n*1000).toISOString().replace('Z','000'),status:'PENDING',mediaKind:n===0?'audio':'image',contentType:n===0?'audio/ogg':'image/png',mediaBytes:'100',mediaSha256:'a'.repeat(64),processing:{result:{text:'PRIVATE_TRANSCRIPT'}},pathname:'PRIVATE_PATH',url:'PRIVATE_URL',...extra};}
function fixture(records){
 const queries=[],client={async query(sql,args){
  queries.push({sql,args:structuredClone(args)});assert.match(sql,/^SELECT /);assert.doesNotMatch(sql,/FOR SHARE|processing|LIMIT 101/);assert.match(sql,/p\."organizationId"=\$5/);assert.match(sql,/workerId'=\$3/);assert.match(sql,/recordedBy'=\$4/);assert.match(sql,/taskId' IS NOT DISTINCT FROM \$2::text/);assert.match(sql,/sectorId'=\$6/);
  assert.deepEqual(args.slice(0,6),['project-a','task-a','worker-a','actor-a','org-a','sector-a']);
  let rows=records.filter(row=>row.projectId===args[0]&&row.taskId===args[1]&&row.workerId===args[2]&&row.recordedBy===args[3]&&row.organizationId===args[4]&&row.sectorId===args[5]&&row.status!=='REJECTED'&&['image','audio'].includes(row.mediaKind));
  if(sql.includes('i.id=ANY')){rows=rows.filter(row=>args[6].includes(row.id));if(sql.endsWith('ORDER BY i.id')){assert.deepEqual(args[6],args[6].toSorted());return {rows:rows.sort((a,b)=>a.id.localeCompare(b.id))};}return {rows:rows.map(row=>({id:row.id,createdAt:row.createdAt}))};}
  if(sql.startsWith('SELECT EXISTS')){const first=args[6]+'|'+args[7],last=args[8]+'|'+args[9];return {rows:[{hasPrevious:rows.some(row=>key(row)>first),hasNext:rows.some(row=>key(row)<last)}]};}
  if(args.length===8){const anchor=args[6]+'|'+args[7],operator=/\(i\."createdAt",i\.id\)\s*(<=|<|>)\s*\(\$7/.exec(sql)?.[1];assert.ok(operator);rows=rows.filter(row=>operator==='>'?key(row)>anchor:operator==='<'?key(row)<anchor:key(row)<=anchor);}
  rows.sort((a,b)=>key(b).localeCompare(key(a)));if(sql.includes('"createdAt" ASC'))rows.reverse();assert.match(sql,/LIMIT 7$/);return {rows:rows.slice(0,7)};
 }};return {queries,read:(change={})=>readConsumptionEvidenceCatalog(client,{...context,...change},web)};
}
test('web pages traverse own evidence beyond one hundred foreign records and return to the exact prior page',async()=>{
 const own=Array.from({length:13},(_,i)=>record(i)),f=fixture([...own,...Array.from({length:117},(_,i)=>record(200+i,{workerId:'other-worker'})),record(500,{recordedBy:'other-author'}),record(501,{taskId:'other-task'}),record(502,{sectorId:'other-sector'}),record(503,{organizationId:'other-org'}),record(504,{projectId:'other-project'}),record(505,{status:'REJECTED'})]);
 const first=await f.read(),second=await f.read({page:first.page,direction:'NEXT'}),third=await f.read({page:second.page,direction:'NEXT'});
 assert.deepEqual([first.entries.length,second.entries.length,third.entries.length],[6,6,1]);assert.deepEqual([...first.entries,...second.entries,...third.entries].map(e=>e.id),own.toReversed().map(e=>e.id));
 assert.deepEqual((await f.read({page:second.page,direction:'PREVIOUS'})).entries,first.entries);assert.deepEqual((await f.read({page:second.page,direction:'REFRESH'})).entries,second.entries);assert.equal(third.page.hasNext,false);
});
test('ten retained attachments use one scoped nonlocking batch and neither public collection exposes processing or storage details',async()=>{
 const selected=Array.from({length:10},(_,i)=>record(i).id).toReversed(),f=fixture(Array.from({length:30},(_,i)=>record(i))),result=await f.read({retainedIds:selected});
 assert.equal(result.entries.length,6);assert.ok(selected.every(id=>result.evidence.some(e=>e.id===id)));const batches=f.queries.filter(q=>q.sql.endsWith('ORDER BY i.id'));assert.equal(batches.length,1);assert.deepEqual(batches[0].args[6],selected.toSorted());
 for(const row of [...result.entries,...result.evidence]){assert.deepEqual(Object.keys(row).sort(),['id','title','taskId','workerId','sectorId','revision','status','media'].sort());assert.deepEqual(Object.keys(row.media).sort(),['kind','contentType','bytes','sha256'].sort());}
 assert.doesNotMatch(JSON.stringify(result),/PRIVATE_|processing|pathname|"url"/);
});
test('a retained attachment that disappeared changed owner or was rejected fails without silently dropping selected IDs',async()=>{
 for(const extra of [null,{workerId:'other-worker'},{recordedBy:'other-author'},{status:'REJECTED'}]){const f=fixture(extra?[record(0,extra)]:[]);await assert.rejects(f.read({retainedIds:['evidence-000']}),{code:'FIELD_EVIDENCE_UNAVAILABLE'});assert.equal(f.queries.filter(q=>q.sql.endsWith('ORDER BY i.id')).length,1);}
});
test('foreign context rollover dates changed anchors and unavailable directions reject instead of falling back to a first page',async()=>{
 const rows=Array.from({length:13},(_,i)=>record(i)),f=fixture(rows),first=await f.read();
 for(const page of [{...first.page,contextDigest:'f'.repeat(64)},{...first.page,first:{...first.page.first,createdAt:'2026-02-30T12:00:00.000001'}},{...first.page,extra:true}]){const count=f.queries.length;await assert.rejects(f.read({page,direction:'REFRESH'}),{code:'FIELD_EVIDENCE_UNAVAILABLE'});assert.equal(f.queries.length,count);}
 await assert.rejects(f.read({page:first.page,direction:'PREVIOUS'}),{code:'FIELD_EVIDENCE_UNAVAILABLE'});rows.find(row=>row.id===first.page.first.id).recordedBy='other-author';await assert.rejects(f.read({page:first.page,direction:'NEXT'}),{code:'FIELD_EVIDENCE_UNAVAILABLE'});
});
test('web cannot accept malformed returned media or duplicate retained SQL rows as an empty successful catalogue',async()=>{
 for(const extra of [{mediaBytes:'0'},{mediaSha256:'bad'},{contentType:'video/mp4'}]){const f=fixture([record(0,extra)]);await assert.rejects(f.read(),{code:'FIELD_EVIDENCE_UNAVAILABLE'});}
 const row=record(0),client={query:async sql=>({rows:sql.includes('ANY')?[row,row]:sql.startsWith('SELECT EXISTS')?[{hasPrevious:false,hasNext:false}]:[row]})};await assert.rejects(readConsumptionEvidenceCatalog(client,{...context,retainedIds:[row.id]},web),{code:'FIELD_EVIDENCE_UNAVAILABLE'});
});
