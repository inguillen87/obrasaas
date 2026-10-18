import test from 'node:test';
import assert from 'node:assert/strict';
import {collectRetainedPages,retainedRows} from '../src/app/(identity)/cuenta/workspace-live-read.mjs';
const signal=()=>new AbortController().signal;
const row=(id,progress=0,revision='2026-10-18T12:00:00.000001',extra={})=>({id,progress,revision,...extra});
const incomplete={code:'WORKSITE_LIVE_READ_INCOMPLETE'};

test('three canonical tasks cost one GET and retain exact server progress/dates without inference',async()=>{
 const previous=[row('a'),row('b'),row('c')];let gets=0;
 const current=[row('a',25,'2026-10-18T12:01:00.000001',{startsOn:null,endsOn:null}),row('b'),row('c')];
 const result=await collectRetainedPages({ids:previous.map(r=>r.id),signal:signal(),readPage:async()=>{gets++;return {rows:current,cursor:null};}});
 assert.equal(gets,1);assert.deepEqual(retainedRows(previous,result.rows),current);assert.equal(result.hasUnloaded,false);
});

test('201 loaded tasks use three pages and never replace them with first 100',async()=>{
 const previous=Array.from({length:201},(_,i)=>row(String(i).padStart(3,'0')));let gets=0;
 const result=await collectRetainedPages({ids:previous.map(r=>r.id),signal:signal(),readPage:async cursor=>{
  gets++;const offset=cursor===null?0:Number(cursor)+1,rows=previous.slice(offset,offset+100).map(r=>r.id==='150'?row(r.id,75,'2026-10-18T12:02:00.000001'):r);
  return {rows,cursor:offset+100<previous.length?rows.at(-1).id:null};
 }});
 const merged=retainedRows(previous,result.rows);assert.equal(gets,3);assert.equal(merged.length,201);assert.deepEqual(merged.map(r=>r.id),previous.map(r=>r.id));assert.equal(merged[150].progress,75);
});

test('missing older IDs terminate after at most six pages with no partial commit',async()=>{
 let gets=0,commits=0;
 await assert.rejects(async()=>{const result=await collectRetainedPages({ids:['not-found'],signal:signal(),readPage:async cursor=>{const n=++gets;return {rows:[row('r'+n)],cursor:'cursor'+n};}});retainedRows([row('not-found')],result.rows);commits++;},incomplete);
 assert.equal(gets,6);assert.equal(commits,0);
});

test('more than 600 retained IDs are rejected before a GET',async()=>{
 let gets=0;await assert.rejects(collectRetainedPages({ids:Array.from({length:601},(_,i)=>String(i)),signal:signal(),readPage:async()=>{gets++;}}),incomplete);assert.equal(gets,0);
});

test('A to B to A cursor cycle and repeated row IDs fail closed',async()=>{
 let calls=0;await assert.rejects(collectRetainedPages({ids:['missing'],signal:signal(),readPage:async()=>({rows:[row('r'+(++calls))],cursor:['A','B','A'][calls-1]})}),incomplete);assert.equal(calls,3);
 calls=0;await assert.rejects(collectRetainedPages({ids:['missing'],signal:signal(),readPage:async()=>({rows:[row('same')],cursor:'c'+(++calls)})}),incomplete);assert.equal(calls,2);
});

test('a form opened while first page is pending prevents a second GET',async()=>{
 let release,allowed=true,gets=0;
 const pending=new Promise(resolve=>{release=resolve;});
 const run=collectRetainedPages({ids:['old'],signal:signal(),isCurrent:()=>allowed,readPage:async()=>{gets++;return pending;}});
 allowed=false;release({rows:[row('new')],cursor:'next'});
 await assert.rejects(run,{name:'AbortError'});assert.equal(gets,1);
});

test('a stale incoming revision rejects the whole merge instead of claiming CURRENT',()=>{
 const current=row('a',75,'2026-10-18T12:03:00.000001');
 assert.throws(()=>retainedRows([current],[row('a',25)]),incomplete);assert.equal(current.progress,75);
});

test('PENDING queues remove independently decided rows and never convert them to approval',()=>{
 const previous=[row('a',25,undefined,{status:'PENDING'}),row('b',0,undefined,{status:'PENDING'})];
 const incoming=[row('a',25,'2026-10-18T12:04:00.000001',{status:'APPLIED'}),row('b',0,'2026-10-18T12:04:00.000001',{status:'REJECTED'})];
 assert.deepEqual(retainedRows(previous,incoming,{pending:true}),[]);assert.deepEqual(previous.map(r=>r.status),['PENDING','PENDING']);
});

test('new rows before the loaded boundary are announced; rows after it do not invent a queue change',async()=>{
 const result=await collectRetainedPages({ids:['a','b'],signal:signal(),readPage:async()=>({rows:[row('new'),row('a'),row('old-approved',0,undefined,{status:'APPROVED'}),row('b'),row('older-tail')],cursor:null})});
 assert.deepEqual(result.unloadedRows.map(r=>r.id),['new','old-approved']);assert.equal(result.unloadedRows.some(r=>r.status==='PENDING'),false);assert.deepEqual(result.rows.map(r=>r.id),['a','b']);
});
