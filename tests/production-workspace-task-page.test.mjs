import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorksiteTaskPager,confirmedWorksiteTaskPage} from '../src/app/(identity)/cuenta/workspace-task-page.mjs';
import {mergeLoadedTasks} from '../src/app/(identity)/cuenta/schedule-workbench.mjs';

const scope='a'.repeat(64),taskId=n=>'task_'+String(n).padStart(3,'0');
const task=(n,revision='2026-10-16T10:00:00.123456')=>({id:taskId(n),title:'Tarea '+n,status:'BACKLOG',progress:0,startsOn:null,endsOn:null,revision});
const page=(start,count=100,total=205)=>({scope,project:{id:'project_a',name:'Obra A',status:'ACTIVE'},roleLabel:'Director de obra',canPlanSchedule:true,tasks:Array.from({length:count},(_,i)=>task(start+i)),totalTasks:total,nextCursor:start+count-1<total?taskId(start+count-1):null});
function harness(request=async()=>page(101)){
 let current={scope,projectId:'project_a',role:'DIRECTOR',generation:7,cursor:taskId(100),blocked:false,officeReviewOnly:false},tasks=page(1).tasks;
 const states=[],calls=[],pages=[],denials=[];
 const pager=createWorksiteTaskPager({request:(query,options)=>{calls.push({query,options});return request(query,options);},getContext:()=>current,onState:state=>states.push(state),onPage:(value,captured)=>{pages.push({value,captured});tasks=mergeLoadedTasks(tasks,value.tasks);current={...current,cursor:value.nextCursor};},onAccessRejected:(error,captured)=>denials.push({error,captured})});
 return {pager,states,calls,pages,denials,get current(){return current;},set current(value){current=value;},get tasks(){return tasks;}};
}
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};

test('pages 2 and 3 use canonical read parameters and append all 205 tasks',async()=>{
 const h=harness(async query=>new URLSearchParams(query).get('afterTask')===taskId(100)?page(101):page(201,5));
 assert.equal(await h.pager.loadMore(),true);assert.equal(await h.pager.loadMore(),true);
 assert.equal(h.tasks.length,205);assert.equal(h.tasks.at(-1).id,taskId(205));assert.equal(h.current.cursor,null);
 assert.deepEqual(h.calls.map(c=>Object.fromEntries(new URLSearchParams(c.query))),[{projectId:'project_a',scope,afterTask:taskId(100)},{projectId:'project_a',scope,afterTask:taskId(200)}]);
 assert.ok(h.calls.every(c=>Object.keys(c.options).join('|')==='signal'&&c.options.signal instanceof AbortSignal));
 assert.deepEqual(h.states.at(-1),{loading:false,error:''});assert.equal(await h.pager.loadMore(),false);assert.equal(h.calls.length,2);
});
test('overlapping clicks issue one request, and the response needs the original cursor',async()=>{
 const d=deferred(),h=harness(()=>d.promise),first=h.pager.loadMore();
 assert.equal(await h.pager.loadMore(),false);assert.equal(h.calls.length,1);
 h.current={...h.current,cursor:taskId(200)};d.resolve(page(101));assert.equal(await first,false);assert.equal(h.pages.length,0);
});
test('a transient failure preserves the cursor and can be retried without a write',async()=>{
 let count=0;const h=harness(async()=>{if(!count++)throw Object.assign(new Error('private transport diagnostics'),{status:503});return page(101);});
 assert.equal(await h.pager.loadMore(),false);assert.equal(h.current.cursor,taskId(100));assert.equal(h.tasks.length,100);
 assert.deepEqual(h.states.at(-1),{loading:false,error:'No se pudieron cargar más tareas. Conservamos tu borrador; intentá nuevamente.'});
 assert.equal(await h.pager.loadMore(),true);assert.equal(h.calls[0].query,h.calls[1].query);assert.ok(h.calls.every(c=>!Object.hasOwn(c.options,'method')&&!Object.hasOwn(c.options,'body')));
});
for(const change of [{scope:'b'.repeat(64)},{projectId:'project_b'},{role:'AUDITOR'},{generation:8},{officeReviewOnly:true}])test('a late page cannot enter a changed context '+JSON.stringify(change),async()=>{
 const d=deferred(),h=harness(()=>d.promise),first=h.pager.loadMore(),stateCount=h.states.length;
 h.current={...h.current,...change};d.resolve(page(101));assert.equal(await first,false);assert.equal(h.pages.length,0);assert.equal(h.states.length,stateCount);assert.equal(h.denials.length,0);
});
test('reset aborts an old read; a new generation completes while the old callback is ignored',async()=>{
 const d=deferred();let count=0;const h=harness(()=>count++?Promise.resolve(page(101)):d.promise),old=h.pager.loadMore();
 h.pager.reset();assert.equal(h.calls[0].options.signal.aborted,true);h.current={...h.current,generation:8};
 assert.equal(await h.pager.loadMore(),true);const states=h.states.length;d.resolve(page(101));assert.equal(await old,false);assert.equal(h.pages.length,1);assert.equal(h.states.length,states);
});
test('dispose aborts and prevents callbacks or new reads after unmount',async()=>{
 const d=deferred(),h=harness(()=>d.promise),old=h.pager.loadMore();h.pager.dispose();const stateCount=h.states.length;
 assert.equal(h.calls[0].options.signal.aborted,true);d.resolve(page(101));assert.equal(await old,false);assert.equal(await h.pager.loadMore(),false);assert.equal(h.pages.length,0);assert.equal(h.states.length,stateCount);
});
for(const denial of [{status:401},{status:403},{status:409,code:'WORKSPACE_CONTEXT_CHANGED'},{status:404,code:'WORKSPACE_PROJECT_UNAVAILABLE'}])test('access rejection reaches the canonical parent handler '+JSON.stringify(denial),async()=>{
 const h=harness(async()=>{throw Object.assign(new Error('denied'),denial);});assert.equal(await h.pager.loadMore(),false);assert.equal(h.pages.length,0);assert.equal(h.denials.length,1);assert.equal(h.denials[0].captured.projectId,'project_a');
 assert.equal(h.states.at(-1).loading,false);assert.match(h.states.at(-1).error,/acceso cambió/);
});
test('a generic 404 is a retryable read error without a canonical project denial',async()=>{
 let reads=0;const h=harness(async()=>{if(!reads++)throw Object.assign(new Error('route not found'),{status:404});return page(101);});
 assert.equal(await h.pager.loadMore(),false);assert.equal(h.denials.length,0);assert.equal(h.tasks.length,100);assert.equal(h.current.cursor,taskId(100));
 assert.match(h.states.at(-1).error,/Conservamos tu borrador/);assert.equal(await h.pager.loadMore(),true);assert.equal(h.tasks.length,200);
});
test('a write or uncertain attempt blocks reads, including one that starts after the request',async()=>{
 const h=harness();h.current={...h.current,blocked:true};assert.equal(await h.pager.loadMore(),false);assert.equal(h.calls.length,0);
 const d=deferred(),second=harness(()=>d.promise),old=second.pager.loadMore();second.current={...second.current,blocked:true};d.resolve(page(101));assert.equal(await old,false);assert.equal(second.pages.length,0);assert.equal(second.current.cursor,taskId(100));
 second.current={...second.current,blocked:false};assert.equal(await second.pager.loadMore(),true);assert.equal(second.pages.length,1);
});
test('a previously consumed cursor cannot loop the same page indefinitely',async()=>{
 const h=harness();assert.equal(await h.pager.loadMore(),true);h.current={...h.current,cursor:taskId(100)};
 assert.equal(await h.pager.loadMore(),false);assert.equal(h.calls.length,1);assert.match(h.states.at(-1).error,/ya se consultó/);
});
test('revision-aware merge does not replace an already approved task with an older page snapshot',async()=>{
 const fresh=harness(async()=>page(101));fresh.tasks.push({...task(151),progress:75,revision:'2026-10-16T10:00:01.000001'});
 assert.equal(await fresh.pager.loadMore(),true);const approved=fresh.tasks.find(t=>t.id===taskId(151));assert.equal(approved.progress,75);assert.equal(approved.revision,'2026-10-16T10:00:01.000001');
});
for(const change of [{scope:'invalid'},{projectId:'../other'},{generation:-1},{officeReviewOnly:true},{cursor:'../../other'},{cursor:null}])test('an unavailable context issues no read: '+JSON.stringify(change),async()=>{
 const h=harness();h.current={...h.current,...change};assert.equal(await h.pager.loadMore(),false);assert.equal(h.calls.length,0);assert.equal(h.states.length,0);
});
const invalidPages=[['wrong scope',p=>{p.scope='b'.repeat(64);}],['wrong project',p=>{p.project.id='project_b';}],['inactive project',p=>{p.project.status='ARCHIVED';}],['unknown response shape',p=>{p.other=true;}],['too many rows',p=>{p.tasks.push(task(205));}],['duplicate task',p=>{p.tasks[1]=p.tasks[0];}],['bad revision',p=>{p.tasks[0].revision='2026-10-16';}],['unconfirmed quantity basis',p=>{p.tasks[0].measurement={version:99};}],['bad total',p=>{p.totalTasks=-1;}],['cursor outside page',p=>{p.nextCursor=taskId(205);}],['reused cursor',p=>{p.tasks[99]=task(100);p.nextCursor=taskId(100);}]];
for(const [name,change] of invalidPages)test('unconfirmed page leaves the current task list untouched: '+name,async()=>{
 const value=page(101);change(value);const h=harness(async()=>value);assert.equal(await h.pager.loadMore(),false);assert.equal(h.tasks.length,100);assert.equal(h.pages.length,0);assert.equal(h.current.cursor,taskId(100));assert.equal(h.states.at(-1).loading,false);assert.ok(h.states.at(-1).error);assert.equal(h.denials.length,0);
});
test('the canonical page validator accepts an empty final page',()=>{
 assert.equal(confirmedWorksiteTaskPage(page(206,0),{scope,projectId:'project_a',cursor:taskId(205)}).nextCursor,null);
});
