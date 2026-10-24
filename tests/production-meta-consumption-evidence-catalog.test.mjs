import test from 'node:test';
import assert from 'node:assert/strict';
import {readMetaConsumptionEvidenceCatalog} from '../src/lib/meta-consumption-evidence-catalog.mjs';

const context={organizationId:'org-a',projectId:'project-a',workerId:'worker-a',actorId:'actor-a',tasks:[{id:'task-a'}],sectors:[{id:'sector-a'}]},state={purpose:'CONSUMPTION',step:'CONSUMPTION_MATERIAL',taskId:'task-a',sectorId:'sector-a'},key=row=>row.createdAt+'|'+row.id;
function record(n,extra={}){return {id:'evidence-'+String(n).padStart(3,'0'),title:'Registro '+n,projectId:'project-a',organizationId:'org-a',recordedBy:'actor-a',workerId:'worker-a',taskId:'task-a',sectorId:'sector-a',revision:'2026-10-20T12:00:00.000001',createdAt:new Date(Date.parse('2026-10-19T12:00:00Z')+n*1000).toISOString().replace('Z','000'),status:'PENDING',mediaKind:n===0?'audio':'image',contentType:n===0?'audio/ogg':'image/png',mediaBytes:'100',mediaSha256:'a'.repeat(64),processing:{result:{text:'Private persisted transcript'}},pathname:'MUST_NOT_BE_RETURNED',...extra};}
function fixture(records){
 const queries=[],client={async query(sql,args){queries.push({sql,args:structuredClone(args)});assert.match(sql,/^SELECT /);assert.match(sql,/p\."organizationId"=\$5/);assert.match(sql,/workerId'=\$3/);assert.match(sql,/recordedBy'=\$4/);assert.match(sql,/taskId' IS NOT DISTINCT FROM \$2::text/);assert.match(sql,/sectorId'=\$6/);assert.deepEqual(args.slice(0,6),['project-a','task-a','worker-a','actor-a','org-a','sector-a']);
  let rows=records.filter(row=>row.projectId===args[0]&&row.taskId===args[1]&&row.workerId===args[2]&&row.recordedBy===args[3]&&row.organizationId===args[4]&&row.sectorId===args[5]&&row.status!=='REJECTED'&&['image','audio'].includes(row.mediaKind));
  if(sql.includes('FOR SHARE OF i')){assert.match(sql,/i\.id=ANY\(\$7::text\[\]\) ORDER BY i\.id FOR SHARE OF i$/);assert.deepEqual(args[6],[...new Set(args[6])].sort());assert.ok(args[6].length<=13);return {rows:rows.filter(row=>args[6].includes(row.id)).sort((a,b)=>a.id.localeCompare(b.id))};}
  if(sql.includes('i.id=ANY'))return {rows:rows.filter(row=>args[6].includes(row.id)).map(row=>({id:row.id,createdAt:row.createdAt}))};
  if(sql.startsWith('SELECT EXISTS')){const first=args[6]+'|'+args[7],last=args[8]+'|'+args[9];return {rows:[{hasPrevious:rows.some(row=>key(row)>first),hasNext:rows.some(row=>key(row)<last)}]};}
  if(args.length===8){const anchor=args[6]+'|'+args[7],operator=/\(i\."createdAt",i\.id\)\s*(<=|<|>)\s*\(\$7/.exec(sql)?.[1];assert.ok(operator,'Explicit current page predicate');rows=rows.filter(row=>operator==='>'?key(row)>anchor:operator==='<'?key(row)<anchor:key(row)<=anchor);}
  rows.sort((a,b)=>key(b).localeCompare(key(a)));if(sql.includes('"createdAt" ASC'))rows.reverse();assert.match(sql,/LIMIT 7$/);return {rows:rows.slice(0,7)};
 }};return {client,queries,read:(s=state,message=null)=>readMetaConsumptionEvidenceCatalog(client,{...context,state:s,message})};
}
const selection=(s,value)=>{const nonce='a'.repeat(20);return {state:{...s,nonce,choices:[{value}]},message:{type:'interactive',interactive:{type:'list_reply',list_reply:{id:'obra:'+nonce+':0'}}}};};

test('own context catalog reaches evidence outside the general one-hundred-row feed and excludes every foreign attribution',async()=>{
 const own=Array.from({length:13},(_,i)=>record(i)),foreign=Array.from({length:117},(_,i)=>record(i+200,{workerId:'worker-other'})),f=fixture([...own,...foreign,record(500,{recordedBy:'other-author'}),record(501,{sectorId:'sector-other'}),record(502,{taskId:'task-other'}),record(503,{organizationId:'org-other'}),record(504,{projectId:'project-other'}),record(505,{status:'REJECTED'}),record(506,{mediaKind:'video'})]);
 let page=await f.read(),seen=page.entries.map(e=>e.id);while(page.page.hasNext){const selected=selection({...state,step:'CONSUMPTION_EVIDENCE',consumptionEvidencePage:page.page,evidenceIds:[]},'NEXT_CONSUMPTION_EVIDENCE');page=await f.read(selected.state,selected.message);seen.push(...page.entries.map(e=>e.id));}
 assert.deepEqual(seen,own.toReversed().map(e=>e.id));assert.equal(new Set(seen).size,13);assert.ok(f.queries.every(q=>!q.sql.includes('LIMIT 101')));
});
test('list DTO contains no private path processing transcript or URL; explicit selected audio gets internal processing only',async()=>{
 const f=fixture([record(0)]),listed=await f.read();assert.equal(listed.entries[0].processing,undefined);assert.equal(listed.entries[0].pathname,undefined);assert.equal(JSON.stringify(listed).includes('Private persisted transcript'),false);
 const selected=selection({...state,step:'CONSUMPTION_EVIDENCE',consumptionEvidencePage:listed.page,evidenceIds:[]},'evidence-000'),result=await f.read(selected.state,selected.message);assert.equal(result.entries[0].processing,undefined);assert.equal(result.evidence[0].processing.result.text,'Private persisted transcript');assert.equal(result.evidence[0].pathname,undefined);assert.ok(f.queries.some(q=>q.sql.includes('FOR SHARE OF i')&&q.args[6].includes('evidence-000')));
});
test('retained attachments are re-read and share-locked independently of the current page at final confirmation',async()=>{
 const ids=Array.from({length:10},(_,i)=>record(i).id).toReversed(),f=fixture(Array.from({length:30},(_,i)=>record(i))),result=await f.read({...state,step:'CONFIRM',evidenceIds:ids});
 assert.equal(result.entries.length,6);assert.ok(ids.every(id=>!result.entries.some(e=>e.id===id)));assert.ok(ids.every(id=>result.evidence.some(e=>e.id===id)));
 const locks=f.queries.filter(q=>q.sql.includes('FOR SHARE OF i'));assert.equal(locks.length,1);assert.deepEqual(locks[0].args[6],ids.toSorted());
});
test('foreign or changed cursor context and removed anchors are rejected without fallback to a global feed',async()=>{
 const records=Array.from({length:13},(_,i)=>record(i)),f=fixture(records),first=await f.read();await assert.rejects(f.read({...state,step:'CONSUMPTION_EVIDENCE',consumptionEvidencePage:{...first.page,contextDigest:'f'.repeat(64)}}),{code:'FIELD_EVIDENCE_UNAVAILABLE'});
 const beforeMalformed=f.queries.length;await assert.rejects(f.read({...state,step:'CONSUMPTION_EVIDENCE',consumptionEvidencePage:{...first.page,first:{...first.page.first,createdAt:'2026-99-20T12:00:00.000001'}}}),{code:'FIELD_EVIDENCE_UNAVAILABLE'});assert.equal(f.queries.length,beforeMalformed);
 records.find(row=>row.id===first.page.first.id).recordedBy='other-author';await assert.rejects(f.read({...state,step:'CONSUMPTION_EVIDENCE',consumptionEvidencePage:first.page}),{code:'FIELD_EVIDENCE_UNAVAILABLE'});
});
test('old interactive nonce cannot request a private transcript and retained foreign IDs disclose no row',async()=>{
 const f=fixture([record(0),record(1,{workerId:'worker-other'})]),old={...state,step:'CONSUMPTION_EVIDENCE',nonce:'a'.repeat(20),choices:[{value:'evidence-000'}]},message={type:'interactive',interactive:{type:'list_reply',list_reply:{id:'obra:'+'b'.repeat(20)+':0'}}};await f.read(old,message);assert.equal(f.queries.some(q=>q.sql.includes('FOR SHARE OF i')),false);
 const result=await f.read({...state,step:'CONFIRM',evidenceIds:['evidence-001']});assert.equal(result.evidence.some(row=>row.id==='evidence-001'),false);
});
test('malformed oversized duplicated or wrong-task selection fails before issuing a query',async()=>{
 for(const changed of [{...state,evidenceIds:['a','a']},{...state,evidenceIds:Array.from({length:11},(_,i)=>'e-'+i)},{...state,taskId:'task-other'},{...state,sectorId:'sector-other'}]){const f=fixture([]);await assert.rejects(f.read(changed),{code:'FIELD_EVIDENCE_UNAVAILABLE'});assert.equal(f.queries.length,0);}
});
