import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorksiteLiveRefreshController,worksiteLiveRefreshPresentation,worksiteLiveCheckedAtLabel} from '../src/app/(identity)/cuenta/workspace-live-refresh-controller.mjs';
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function fixture(overrides={}){
 let time=1800000000000,next=0,visible=true,online=true,source=1,authorityEpoch=0;
 const timers=new Map(),states=[],counts={read:0,apply:0,deny:0};
 const capturedSource=source;
 const spec={contextKey:'scope:project:generation',viewKey:'EVIDENCE',enabled:true,blocked:false,
  read:async()=>{counts.read++;return {taskProgress:25};},apply:()=>{counts.apply++;return {updates:false};},
  getAuthorityStamp:()=>authorityEpoch,
  isCurrent:stamp=>!spec.blocked&&source===capturedSource&&stamp===authorityEpoch,isAuthorityCurrent:stamp=>source===capturedSource&&stamp===authorityEpoch,
  onAccessRejected:()=>{counts.deny++;spec.enabled=false;},...overrides};
 const controller=createWorksiteLiveRefreshController({contextKey:spec.contextKey,getCurrent:()=>spec,onState:value=>states.push(value),
  setTimer:(fn,delay)=>{const id=++next;timers.set(id,{fn,due:time+delay,delay});return id;},clearTimer:id=>timers.delete(id),now:()=>time,random:()=>.5,isVisible:()=>visible,isOnline:()=>online});
 return {controller,spec,states,counts,timers,setTime:ms=>{time+=ms;},setVisible:value=>{visible=value;},setOnline:value=>{online=value;},newCanonicalSource:()=>{source++;},bumpAuthorityEpoch:()=>{authorityEpoch++;},
  async fireNext(){const first=[...timers.entries()].sort((a,b)=>a[1].due-b[1].due)[0];if(!first)return;timers.delete(first[0]);time=first[1].due;await first[1].fn();},
  delays:()=>[...timers.values()].map(t=>t.delay)};
}

test('a successful timer cycle is read-only, single-flight, and schedules 45 seconds',async()=>{
 const wait=deferred();let reads=0;const f=fixture({read:()=>{reads++;return wait.promise;}});
 const first=f.controller.check();await f.controller.check();assert.equal(reads,1);assert.equal(f.counts.apply,0);
 wait.resolve({progress:25});assert.equal(await first,true);assert.equal(f.counts.apply,1);assert.deepEqual(f.delays(),[45000]);f.controller.dispose();
});

test('hidden/offline and repeated focus events cause no GET storm',async()=>{
 const f=fixture();f.setVisible(false);f.controller.start();await f.controller.check();assert.equal(f.counts.read,0);
 f.setVisible(true);for(let i=0;i<5;i++)f.controller.environmentChanged();assert.equal(f.timers.size,1);assert.deepEqual(f.delays(),[5000]);
 await f.fireNext();assert.equal(f.counts.read,1);
 f.setOnline(false);f.controller.environmentChanged();await f.controller.check();assert.equal(f.counts.read,1);assert.equal(f.timers.size,0);f.controller.dispose();
});

test('known current 403 closes privacy even after a draft pauses/aborts the poll',async()=>{
 const wait=deferred();const f=fixture({read:()=>wait.promise});const run=f.controller.check();
 f.spec.blocked=true;f.controller.pause();wait.reject(Object.assign(new Error('revoked'),{status:403}));
 await run;assert.equal(f.counts.apply,0);assert.equal(f.counts.deny,1);assert.equal(f.states.at(-1).state,'ACCESS');assert.equal(f.timers.size,0);f.controller.dispose();
});

test('switching viewKey does not suppress a known denial of the same project',async()=>{
 const wait=deferred();const f=fixture({read:()=>wait.promise});const run=f.controller.check();f.spec.viewKey='PROGRESS';
 wait.reject(Object.assign(new Error('revoked'),{status:401}));await run;
 assert.equal(f.counts.deny,1);assert.equal(f.states.at(-1).viewKey,'PROGRESS');assert.equal(f.states.at(-1).state,'ACCESS');f.controller.dispose();
});

test('a denial from a source superseded by a later canonical read cannot hide the newer view',async()=>{
 const wait=deferred();const f=fixture({read:()=>wait.promise});const run=f.controller.check();f.newCanonicalSource();
 wait.reject(Object.assign(new Error('old denial'),{status:403}));await run;assert.equal(f.counts.deny,0);assert.equal(f.counts.apply,0);assert.ok(!f.states.some(s=>s.state==='ACCESS'));f.controller.dispose();
});

test('a blocked draft rejects a successful response without applying its data',async()=>{
 const wait=deferred();const f=fixture({read:()=>wait.promise});const run=f.controller.check();f.spec.blocked=true;f.controller.pause();
 wait.resolve({progress:100});await run;assert.equal(f.counts.apply,0);assert.ok(!f.states.some(s=>s.state==='CURRENT'));f.controller.dispose();
});

test('scope/generation changes and cleanup prevent old callbacks from reviving the new view',async()=>{
 for(const mode of ['scope','dispose']){
  const wait=deferred();const f=fixture({read:()=>wait.promise});const run=f.controller.check();
  if(mode==='scope')f.spec.contextKey='other-scope:project:generation';else f.controller.dispose();
  wait.reject(Object.assign(new Error('late'),{status:403}));await run;assert.equal(f.counts.deny,0);assert.equal(f.counts.apply,0);f.controller.dispose();
 }
});

test('partial pagination is INFO/LIMITED with no automatic retry loop; explicit check can recover',async()=>{
 let fail=true;const f=fixture({read:async()=>{if(fail)throw Object.assign(new Error('use manual pagination'),{code:'WORKSITE_LIVE_READ_INCOMPLETE'});return {};}});
 await f.controller.check();assert.equal(f.states.at(-1).state,'LIMITED');assert.equal(f.timers.size,0);
 f.controller.environmentChanged();await f.controller.check();assert.equal(f.timers.size,0);
 fail=false;f.setTime(5000);assert.equal(await f.controller.check({manual:true}),true);assert.equal(f.counts.apply,1);f.controller.dispose();
});

test('network failure backoff is bounded at 90/180 seconds',async()=>{
 const f=fixture({read:async()=>{throw Object.assign(new Error('unavailable'),{status:503});}});
 await f.controller.check();assert.deepEqual(f.delays(),[90000]);
 f.setTime(6000);await f.controller.check({manual:true});assert.deepEqual(f.delays(),[180000]);
 f.setTime(6000);await f.controller.check({manual:true});assert.deepEqual(f.delays(),[180000]);assert.ok(f.states.every(s=>s.state!=='CURRENT'));f.controller.dispose();
});

test('a stopped partial query stays actionable after switching view, but never crosses project context',()=>{
 const limited={contextKey:'same-project',viewKey:'EVIDENCE',state:'LIMITED',message:'Use explicit query',updates:false};
 assert.equal(worksiteLiveRefreshPresentation(limited,{contextKey:'same-project',viewKey:'PROGRESS',enabled:true}).state,'LIMITED');
 assert.equal(worksiteLiveRefreshPresentation(limited,{contextKey:'another-project',viewKey:'PROGRESS',enabled:true}).state,'PAUSED');
});

test('StrictMode-style dispose/setup leaves only the new controller and timer alive',async()=>{
 const first=fixture();first.controller.start();assert.equal(first.timers.size,1);first.controller.dispose();assert.equal(first.timers.size,0);
 const second=fixture();second.controller.start();assert.equal(second.timers.size,1);await second.fireNext();assert.equal(second.counts.read,1);assert.equal(first.counts.read,0);second.controller.dispose();
});



test('an authority epoch change with the same data reference rejects both late data and a late 401',async()=>{
 for(const response of ['success','denial']){
  const wait=deferred(),seen=[];const f=fixture({read:()=>wait.promise});
  const capture=f.spec.getAuthorityStamp;f.spec.getAuthorityStamp=()=>{const stamp=capture();seen.push(stamp);return stamp;};
  const run=f.controller.check();f.bumpAuthorityEpoch();
  if(response==='success')wait.resolve({progress:100});else wait.reject(Object.assign(new Error('old epoch denied'),{status:401}));
  await run;assert.deepEqual(seen,[0]);assert.equal(f.counts.apply,0);assert.equal(f.counts.deny,0);assert.ok(!f.states.some(state=>['CURRENT','ACCESS'].includes(state.state)));f.controller.dispose();
 }
});

test('a new draft in the same authority epoch still honors a known late 401',async()=>{
 const wait=deferred();const f=fixture({read:()=>wait.promise});const run=f.controller.check();
 f.spec.blocked=true;f.controller.pause();wait.reject(Object.assign(new Error('current epoch denied'),{status:401}));
 await run;assert.equal(f.counts.apply,0);assert.equal(f.counts.deny,1);assert.equal(f.states.at(-1).state,'ACCESS');assert.equal(f.timers.size,0);f.controller.dispose();
});


test('completed check shows an Argentine date and unambiguous24 hour time without changing the captured instant',()=>{
 const checkedAt='2026-10-20T21:59:13.000Z',label=worksiteLiveCheckedAtLabel(checkedAt);
 assert.match(label,/20\/10\/2026/);assert.match(label,/18:59:13/);assert.match(label,/\(hora de Argentina\)$/);
 assert.doesNotMatch(label,/06:59:13/);assert.equal(checkedAt,'2026-10-20T21:59:13.000Z');
});
test('Argentine midnight changes the local date only at03 UTC and renders00 rather than24',()=>{
 const before=worksiteLiveCheckedAtLabel('2026-10-21T02:59:59.999Z'),midnight=worksiteLiveCheckedAtLabel('2026-10-21T03:00:00.000Z');
 assert.match(before,/20\/10\/2026/);assert.match(before,/23:59:59/);
 assert.match(midnight,/21\/10\/2026/);assert.match(midnight,/00:00:00/);assert.doesNotMatch(midnight,/24:00:00/);
});
test('completed check formatting remains Argentine and24 hour under three different host formatting defaults',{concurrency:false},()=>{
 const original=Intl.DateTimeFormat;
 try{
  for(const hostZone of ['UTC','Asia/Tokyo','America/Los_Angeles']){
   // Keep the real Intl implementation; vary only its omitted-option defaults.
   Intl.DateTimeFormat=function(locales,options){return new original(locales,{timeZone:hostZone,hourCycle:'h12',...options});};
   const label=worksiteLiveCheckedAtLabel('2026-10-20T21:59:13.000Z');
   assert.match(label,/20\/10\/2026/);assert.match(label,/18:59:13/);assert.match(label,/\(hora de Argentina\)$/);
  }
 }finally{Intl.DateTimeFormat=original;}
 assert.equal(Intl.DateTimeFormat,original);
});
test('missing noncanonical and impossible check instants never display epoch time or a normalized date',()=>{
 const hostile={toString(){throw Error('No coercion of an unconfirmed instant');}};
 for(const value of [undefined,null,0,NaN,hostile,'','not-an-instant','2026-02-30T21:59:13.000Z','2026-10-20T18:59:13.000-03:00','2026-10-20T21:59:13Z'])assert.equal(worksiteLiveCheckedAtLabel(value),'Fecha y hora sin confirmar');
});
