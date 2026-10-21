import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {parse} from '@babel/parser';
import {collectRetainedPages,retainedRows} from '../src/app/(identity)/cuenta/workspace-live-read.mjs';
import {refreshLoadedTasks} from '../src/app/(identity)/cuenta/schedule-workbench.mjs';
import {confirmedWorksiteTaskPage} from '../src/app/(identity)/cuenta/workspace-task-page.mjs';
import {createWorksiteLiveRefreshController,worksiteLiveRefreshPresentation} from '../src/app/(identity)/cuenta/workspace-live-refresh-controller.mjs';
import {respondClosedCompanySubscription} from '../scripts/lib/company-subscription-ui-fixture.mjs';

// Current source callbacks and controller; only React scheduling, clocks and
// synthetic HTTP are controlled. This does not run a browser or a provider.
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const walk=(node,predicate,result=[])=>{if(!node||typeof node!=='object')return result;if(predicate(node))result.push(node);for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(child=>walk(child,predicate,result));else if(value&&typeof value==='object')walk(value,predicate,result);}return result;};
const only=(node,predicate)=>{const matches=walk(node,predicate);assert.equal(matches.length,1);return matches[0];};
const parseSource=source=>parse(source,{sourceType:'module',plugins:['jsx']});
const slice=(source,node)=>source.slice(node.start,node.end);
const declaration=(source,ast,name)=>'const '+slice(source,only(ast,node=>node.type==='VariableDeclarator'&&node.id?.name===name))+';';
const workspaceSource=read('src/app/(identity)/cuenta/workspace-client.js'),workspaceAst=parseSource(workspaceSource);
const workspace=only(workspaceAst,node=>node.type==='FunctionDeclaration'&&node.id?.name==='AccountWorkspace');
const liveSource=read('src/app/(identity)/cuenta/workspace-live-refresh.js');
const liveHook=slice(liveSource,only(parseSource(liveSource),node=>node.type==='FunctionDeclaration'&&node.id?.name==='useWorksiteLiveRefresh'));
const names=['planReadbackMatches','planReadbackPending','taskCreating','contextLocked','scheduleLiveBlocked','scheduleLiveContext'];
const layout=only(workspace,node=>node.type==='ExpressionStatement'&&node.expression?.callee?.name==='useLayoutEffect'&&walk(node,child=>child.type==='AssignmentExpression'&&child.left?.object?.name==='scheduleLiveContext').length===1);
const retry=only(workspace,node=>node.type==='JSXElement'&&node.openingElement.name.name==='button'&&node.children.some(child=>child.type==='JSXText'&&child.value==='Volver a consultar el cronograma'));
const attribute=name=>slice(workspaceSource,retry.openingElement.attributes.find(attr=>attr.name?.name===name).value.expression);
const body=names.map(name=>declaration(workspaceSource,workspace,name)).join('\n')+'\n'+slice(workspaceSource,layout)+'\n'+declaration(workspaceSource,workspace,'scheduleLive')+'\n'+slice(workspaceSource,only(workspace,node=>node.type==='FunctionDeclaration'&&node.id?.name==='readRecordedSchedule'));
const scope='a'.repeat(64),projectId='project-a',tick=()=>new Promise(resolve=>setImmediate(resolve));
const task=id=>({id,title:id,status:'BACKLOG',progress:0,startsOn:'2026-10-01',endsOn:'2026-10-05',revision:'2026-10-05T00:00:00.000001'});
const page=()=>({scope,project:{id:projectId,name:'Obra sintética',status:'ACTIVE'},roleLabel:'Administrador',canPlanSchedule:true,tasks:Array.from({length:100},(_,i)=>task('task-'+i)),totalTasks:150,nextCursor:'task-99'});
function fixture(){
 const state={account:{scope,role:'ADMIN'},view:page(),planReadback:null,saving:false,attempt:null,creatingTask:false,modulePending:{plan:true},draft:null,taskPageRead:{loading:false},loading:false,observationEpoch:1,activeSection:'cronograma',receipt:{id:'original-receipt'}};
 const refs={mounted:{current:true},generation:{current:1},controller:{current:null},identityNavigation:{current:null},identityNavigationEpoch:{current:0}};
 const calls=[],responses=[],timers=new Map(),hooks=[],effects=[],statuses=[],listeners=new Map();let cursor=0,effectCursor=0,queued=[],nextTimer=0;
 const same=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,i)=>Object.is(value,b[i]));
 const useRef=initial=>{const i=cursor++;return hooks[i]??(hooks[i]={current:initial});};
 const useState=initial=>{const i=cursor++;if(!(i in hooks))hooks[i]=initial;return[hooks[i],value=>{hooks[i]=typeof value==='function'?value(hooks[i]):value;statuses.push(hooks[i]);}];};
 const useEffect=(callback,deps)=>{const i=effectCursor++;if(!effects[i]||!same(effects[i].deps,deps))queued.push(()=>{effects[i]?.cleanup?.();effects[i]={deps,cleanup:callback()};});};
 const setters=Object.fromEntries(['View','PlanReadback','Loading','ObservationEpoch','ChannelSnapshot','Notice','GuideReadFailed'].map(name=>['set'+name,value=>{const key=name[0].toLowerCase()+name.slice(1);state[key]=typeof value==='function'?value(state[key]):value;}]));
 const request=async(url,options={})=>{calls.push({url,method:options.method||'GET'});const next=responses.shift();if(next instanceof Error)throw next;return typeof next==='function'?next():next??{...page(),totalTasks:151};};
 const deps={useRef,useState,useEffect,useLayoutEffect:useEffect,collectRetainedPages,retainedRows,refreshLoadedTasks,confirmedWorksiteTaskPage,worksiteLiveRefreshPresentation,
  createWorksiteLiveRefreshController:options=>createWorksiteLiveRefreshController({...options,setTimer:(fn,delay)=>{const id=++nextTimer;timers.set(id,{fn,delay});return id;},clearTimer:id=>timers.delete(id),now:()=>0,random:()=>.5}),
  window:{addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)},document:{visibilityState:'visible',addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)},navigator:{onLine:true}};
 const factory=Function('deps',`const {${Object.keys(deps).join(',')}}=deps;${liveHook}\n${declaration(workspaceSource,workspaceAst,'query')}\n${declaration(workspaceSource,workspaceAst,'guideAccessDenied')}\nreturn function render(state,refs,setters,request){const {account,view,planReadback,saving,attempt,creatingTask,modulePending,draft,taskPageRead,loading,observationEpoch,activeSection}=state;const {mounted,generation,controller,identityNavigation,identityNavigationEpoch}=refs;const {${Object.keys(setters).join(',')}}=setters;const restrictProject=()=>{throw Error('Unexpected authority mutation');};${body}\nreturn {scheduleLive,readRecordedSchedule,retryDisabled:${attribute('disabled')},retry:${attribute('onClick')}};};`)(deps);
 const render=()=>{cursor=effectCursor=0;queued=[];const result=factory(state,refs,setters,request);for(const commit of queued)commit();return result;};
 return{state,refs,calls,responses,timers,statuses,render,dispose:()=>{for(const effect of effects)effect?.cleanup?.();}};
}

for(const fault of ['503','scope','project'])test('actual '+fault+' readback preserves the snapshot until an enabled manual GET',async()=>{
 const f=fixture(),oldView=f.state.view,receipt=f.state.receipt;
 f.responses.push(fault==='503'?Object.assign(new Error('Synthetic unavailable'),{status:503}):{...page(),...(fault==='scope'?{scope:'b'.repeat(64)}:{project:{id:'other-project'}}),totalTasks:999});
 let ui=f.render();await ui.readRecordedSchedule({scope,projectId,kind:'plan'});f.state.modulePending={};ui=f.render();await tick();ui=f.render();
 assert.equal(f.calls.length,1);assert.ok(f.calls.every(call=>call.method==='GET'));assert.equal(f.state.view,oldView);assert.equal(f.state.receipt,receipt);assert.equal(f.state.view.totalTasks,150);assert.equal(f.state.planReadback.status,'failed');assert.match(f.state.notice,/no pudimos actualizar el cronograma/);assert.equal(ui.retryDisabled,false);assert.equal(f.timers.size,0);
 f.responses.push({...page(),totalTasks:151});await ui.retry();assert.equal(f.calls.length,2);assert.equal(f.state.view.totalTasks,151);assert.equal(f.state.planReadback,null);assert.equal(f.state.receipt,receipt);assert.match(f.state.notice,/Cronograma actualizado/);f.dispose();
});

test('a pending readback cannot start an automatic GET and keeps manual retry disabled',async()=>{
 const f=fixture();let release;f.responses.push(()=>new Promise(resolve=>{release=resolve;}));let ui=f.render();const pending=ui.readRecordedSchedule({scope,projectId,kind:'task'});f.state.modulePending={};ui=f.render();await tick();
 assert.equal(f.calls.length,1);assert.equal(ui.retryDisabled,true);assert.equal(f.state.planReadback.status,'pending');release({...page(),totalTasks:151});await pending;assert.equal(f.state.planReadback,null);assert.equal(f.state.view.totalTasks,151);f.dispose();
});

test('a late readback cannot replace a new project or its receipt',async()=>{
 const f=fixture();let release;f.responses.push(()=>new Promise(resolve=>{release=resolve;}));const pending=f.render().readRecordedSchedule({scope,projectId,kind:'plan'});
 const other={...page(),project:{id:'new-project'},totalTasks:7};f.refs.generation.current++;f.state.view=other;f.state.planReadback=null;const receipt=f.state.receipt;release({...page(),totalTasks:999});await pending;assert.equal(f.state.view,other);assert.equal(f.state.receipt,receipt);assert.equal(f.state.planReadback,null);assert.equal(f.calls.length,1);f.dispose();
});

const planSource=read('scripts/verify-workspace-plan-recovery-ui.mjs'),planAst=parseSource(planSource),scenario=only(planAst,node=>node.type==='FunctionDeclaration'&&node.id?.name==='scenario');
const requestListener=only(scenario,node=>node.type==='CallExpression'&&node.callee?.property?.name==='on'&&node.arguments[0]?.value==='request');
const planDefinitions=['scope','scopeB','projectId','projectB','row','importedTask','existingTasks'].map(name=>declaration(planSource,planAst,name)).join('\n');
const planLocals=['draft','posts'].map(name=>slice(planSource,only(scenario,node=>node.type==='VariableDeclaration'&&node.declarations.some(value=>value.id?.name===name)))).join('\n');
for(const mode of ['read-failure','scope-mismatch','project-mismatch'])test('actual '+mode+' fixture arms once after APPLY despite earlier project GETs',async()=>{
 const replies=[],errors=[],fixtureScope='a'.repeat(64),fixtureProject='project-plan-A';
 const send=(_request,body,status=200)=>replies.push({body,status});
 const fixture=Function('mode','send','errors','assert','respondClosedCompanySubscription',`${planDefinitions}\n${planLocals}\ndraft={id:'draft-plan-A',revision:3};const origin='http://127.0.0.1:3179',width=320;return {listener:${slice(planSource,requestListener.arguments[1])},row,reads:workspaceReads};`)(mode,send,errors,assert,respondClosedCompanySubscription);
 const request=(path,method='GET',payload)=>({url:()=>`http://127.0.0.1:3179/api/identity/${path}`,method:()=>method,headers:()=>({authorization:'Bearer synthetic-workspace-plan-A','content-type':'application/json'}),postData:()=>JSON.stringify(payload),isInterceptResolutionHandled:()=>true});
 const get=()=>fixture.listener(request('workspace?'+new URLSearchParams({projectId:fixtureProject,scope:fixtureScope})));
 await get();await get();await get();assert.ok(replies.every(reply=>reply.status===200&&reply.body.totalTasks===150));
 await fixture.listener(request('plan-import','POST',{action:'APPLY',scope:fixtureScope,projectId:fixtureProject,draftId:'draft-plan-A',expectedRevision:3,rows:[fixture.row]}));await get();
 const injected=replies.at(-1);assert.equal(fixture.reads.at(-1).phase,'recorded-readback');assert.equal(mode==='read-failure'?injected.status:injected.body.totalTasks,mode==='read-failure'?503:999);await get();assert.equal(replies.at(-1).body.totalTasks,151);assert.equal(fixture.reads.filter(value=>value.phase==='recorded-readback').length,1);assert.deepEqual(errors,[]);
});

test('the actual HTML denial fixture first supplies a canonical live-refresh page and cursor',()=>{
 const source=read('scripts/verify-workspace-ui.mjs'),ast=parseSource(source),scenario=only(ast,node=>node.type==='FunctionDeclaration'&&node.id?.name==='guideHttpDenialScenario');
 const moduleVariables={body:ast.program.body.filter(node=>node.type==='VariableDeclaration')};
 const definitions=['scope','revision','baseTask'].map(name=>declaration(source,moduleVariables,name)).join('\n')+['httpTasks','httpCursor'].map(name=>declaration(source,scenario,name)).join('\n');
 const positive=only(scenario,node=>node.type==='ObjectExpression'&&node.properties.some(property=>property.key?.name==='tasks'&&property.value?.name==='httpTasks'));
 const body=Function(definitions+'\nreturn '+slice(source,positive)+';')();
 assert.equal(confirmedWorksiteTaskPage(body,{scope,projectId:'p-a',cursor:null}),body);assert.equal(body.tasks.length,100);assert.equal(body.totalTasks,101);assert.equal(body.nextCursor,body.tasks.at(-1).id);
});
