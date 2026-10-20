// Real overview JSX, live hook and controller; synthetic transport and clocks.
// This does not assert browser layout, real sessions or human pilot acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadBindings,transform} from 'next/dist/build/swc/index.js';
import {renderToStaticMarkup} from 'react-dom/server';
import {FIELD_EVIDENCE_PENDING_EVENT} from '../src/app/(identity)/cuenta/field-review-page-view.mjs';
const file=name=>readFileSync(new URL('../src/app/(identity)/cuenta/'+name,import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
const controllerUrl=new URL('../src/app/(identity)/cuenta/workspace-live-refresh-controller.mjs',import.meta.url).href;
const inventoryUrl=new URL('../src/app/(identity)/cuenta/material-inventory-view.mjs',import.meta.url).href;
const fieldUrl=new URL('../src/app/(identity)/cuenta/field-review-page-view.mjs',import.meta.url).href;
const harness=`let bridge,states=[],refs=[],effects=[],si=0,ri=0,ei=0;
const useState=initial=>{const i=si++;if(!(i in states))states[i]=initial;return[states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];};
const useRef=initial=>refs[ri++]??(refs[ri-1]={current:initial});
const useEffect=(callback,deps)=>{const i=ei++,old=effects[i];if(!old||!deps||!old.deps||deps.length!==old.deps.length||deps.some((x,j)=>!Object.is(x,old.deps[j]))){old?.cleanup?.();effects[i]={deps,cleanup:callback()};}};
const useLayoutEffect=useEffect,styles=new Proxy({},{get:(_,key)=>key});
const ArrowUpRight=()=>null,CalendarDays=()=>null,UsersRound=()=>null,Package=()=>null,HardHat=()=>null,RefreshCw=()=>null;
const useWorkspaceRequest=()=>bridge.request;
const window={addEventListener:(name,fn)=>bridge.listeners.set(name,fn),removeEventListener:name=>bridge.listeners.delete(name),dispatchEvent:event=>bridge.events.push(event)};
const document={get visibilityState(){return bridge.visible?'visible':'hidden';},addEventListener:window.addEventListener,removeEventListener:window.removeEventListener};
const navigator={get onLine(){return bridge.online;}};
const CustomEvent=class{constructor(type,options){this.type=type;this.detail=options.detail;}};
const createWorksiteLiveRefreshController=options=>actualController({...options,setTimer:(fn,delay)=>bridge.setTimer(fn,delay),clearTimer:id=>bridge.timers.delete(id),now:()=>bridge.now,random:()=>.5});
export function unmount(){for(const effect of effects)effect?.cleanup?.();effects=[];}
export function reset(value){unmount();bridge=value;states=[];refs=[];effects=[];}
export function render(props){si=0;ri=0;ei=0;return Decisions(props);}`;
await loadBindings();
const result=await transform(`import React from ${JSON.stringify(import.meta.resolve('react'))};import {createWorksiteLiveRefreshController as actualController,worksiteLiveRefreshPresentation} from ${JSON.stringify(controllerUrl)};import {inventoryPendingCounts,INVENTORY_PENDING_EVENT} from ${JSON.stringify(inventoryUrl)};import {FIELD_EVIDENCE_PENDING_EVENT,FIELD_PROGRESS_PENDING_EVENT} from ${JSON.stringify(fieldUrl)};${harness}\n${file('workspace-live-refresh.js')}\n${file('workspace-overview.js')}`,{filename:'real-overview-live.js',jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022',transform:{react:{runtime:'classic'}}},module:{type:'es6'}});
const component=await import('data:text/javascript;base64,'+Buffer.from(result.code).toString('base64'));
const scope='a'.repeat(64),projectId='project-a';
const payload=(evidence=149,project=projectId)=>({scope,projectId:project,view:'decisions',observedAt:'2026-10-20T16:00:00.000Z',evidence:{pending:evidence},proposals:{pending:237},inventory:{canManage:true,pendingCounts:{consumptions:132,adjustments:4}}});
function setup(){
 const state={visible:true,online:true,now:0,timers:new Map(),listeners:new Map(),events:[],calls:[],responses:[],denials:[],nextId:0};
 state.setTimer=(fn,delay)=>{const id=++state.nextId;state.timers.set(id,{fn,delay});return id;};
 state.request=async(url,options,consume)=>{state.calls.push({url,options});const next=state.responses.shift(),value=await(typeof next==='function'?next():next??payload());return consume(value instanceof Response?value:new Response(JSON.stringify(value)));};
 const props={scope,projectId,active:true,allowed:true,blocked:false,observationKey:1,getSessionToken:()=>assert.fail('No real token or provider permitted'),onAccessRejected:error=>state.denials.push(error.status)};
 component.reset(state);return{state,props};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function nodes(tree,predicate){const found=[];function visit(value){if(!value||typeof value!=='object')return;if(predicate(value))found.push(value);for(const child of [value.props?.children].flat(Infinity))visit(child);}visit(tree);return found;}
const label=node=>[node?.props?.children].flat(Infinity).filter(value=>typeof value==='string').join('').trim();
const find=(tree,type,text)=>{const node=nodes(tree,n=>n.type===type&&label(n)===text)[0];assert.ok(node,'Missing '+text);return node;};
const html=props=>renderToStaticMarkup(component.render(props));
async function ready(props){component.render(props);await settle();return component.render(props);}
function cycle(state){const match=[...state.timers].find(([,timer])=>timer.delay===45000);assert.ok(match,'Existing 45-second timer');state.timers.delete(match[0]);state.now+=match[1].delay;return match[1].fn();}
const hold=()=>{let release;const promise=new Promise(resolve=>{release=resolve;});return {promise,release};};

test('actual overview renders complete evidence totals and opens only the scoped pending queue through GETs',async()=>{
 const {state,props}=setup(),tree=await ready(props);assert.match(renderToStaticMarkup(tree),/>149</);assert.match(renderToStaticMarkup(tree),/archivos pendientes de revisión/);
 const event={preventDefault:()=>assert.fail('Current navigation is allowed')};find(tree,'a','Revisar evidencias').props.onClick(event);
 assert.deepEqual(state.events.map(({type,detail})=>({type,detail})),[{type:FIELD_EVIDENCE_PENDING_EVENT,detail:{projectId,scope}}]);
 assert.equal(state.calls.length,1);const call=state.calls[0],query=new URL(call.url,'https://example.invalid');assert.equal(query.pathname,'/api/identity/operations-status');assert.deepEqual(Object.fromEntries(query.searchParams),{projectId,scope,view:'decisions'});assert.equal(call.options.method,undefined);assert.equal(call.options.body,undefined);assert.equal(call.options.requestTimeoutMs,15000);
 component.unmount();
});

test('the existing 45-second controller refreshes totals without polling hidden offline or inactive Home',async()=>{
 const {state,props}=setup();await ready(props);state.responses.push(payload(150));await cycle(state);assert.match(html(props),/>150</);assert.equal(state.calls.length,2);
 state.visible=false;state.listeners.get('visibilitychange')();component.render(props);assert.equal(state.timers.size,0);assert.match(html(props),/pestaña no está visible/);
 state.online=false;state.visible=true;state.listeners.get('online')();component.render(props);assert.equal(state.timers.size,0);assert.equal(state.calls.length,2);
 state.online=true;props.active=false;component.render(props);state.listeners.get('focus')();assert.equal(state.timers.size,0);assert.equal(state.calls.length,2);
 state.now+=5000;props.active=true;component.render(props);await settle();assert.equal(state.calls.length,3);assert.ok(state.calls.every(call=>call.options.method===undefined&&call.options.body===undefined));component.unmount();
});

test('a prepared operation pauses reads and navigation and ignores a successful response arriving after the pause',async()=>{
 const {state,props}=setup();props.blocked=true;component.render(props);await settle();assert.equal(state.calls.length,0);
 props.blocked=false;const tree=await ready(props),oldLink=find(tree,'a','Revisar evidencias'),pending=hold();state.responses.push(()=>pending.promise);state.now+=5000;find(tree,'button','Actualizar pendientes').props.onClick();
 props.blocked=true;component.render(props);let stopped=false;oldLink.props.onClick({preventDefault(){stopped=true;}});assert.equal(stopped,true);assert.equal(state.events.length,0);assert.equal(state.calls.at(-1).options.signal.aborted,true);
 pending.release(payload(999));await settle();assert.match(html(props),/>149</);assert.doesNotMatch(html(props),/>999</);assert.match(html(props),/en pausa/);assert.equal(state.calls.length,2);component.unmount();
});

test('a known current 401 or 403 purges totals even when a draft pauses its in-flight read',async()=>{
 for(const status of [401,403]){
  const {state,props}=setup(),tree=await ready(props),pending=hold();state.responses.push(()=>pending.promise);state.now+=5000;find(tree,'button','Actualizar pendientes').props.onClick();props.blocked=true;component.render(props);
  pending.release(new Response(JSON.stringify({code:'WORKSPACE_MEMBERSHIP_REQUIRED'}),{status}));await settle();assert.doesNotMatch(html(props),/>149</);assert.match(html(props),/Tu acceso cambió/);assert.deepEqual(state.denials,[status]);assert.equal(nodes(component.render(props),node=>node.type==='a').length,0);component.unmount();
 }
});

test('an old project or generation response cannot replace new totals or revoke the new owner',async()=>{
 for(const oldResponse of [payload(999),new Response('{}',{status:403})]){
  const {state,props}=setup(),pending=hold();state.responses.push(()=>pending.promise);component.render(props);props.projectId='project-b';props.observationKey=2;state.responses.push(payload(7,'project-b'));
  // WorkspaceOverview keys Decisions by project, scope and observation epoch.
  component.reset(state);component.render(props);await settle();assert.match(html(props),/>7</);
  pending.release(oldResponse);await settle();assert.match(html(props),/>7</);assert.doesNotMatch(html(props),/>999</);assert.equal(state.denials.length,0);component.unmount();
 }
});

test('malformed counts extra private fields and crossed context do not become a zero or overwrite a confirmed snapshot',async()=>{
 for(const broken of [{...payload(),evidence:{pending:-1}},{...payload(),evidence:{pending:'149'}},{...payload(),evidence:{}},{...payload(),evidence:{pending:0,ids:['private-id']}},{...payload(),scope:'b'.repeat(64)},payload(0,'other-project')]){
  const {state,props}=setup(),tree=await ready(props);state.responses.push(broken);state.now+=5000;find(tree,'button','Actualizar pendientes').props.onClick();await settle();assert.match(html(props),/>149</);assert.match(html(props),/No pudimos actualizar/);assert.equal(state.denials.length,0);component.unmount();
 }
 const {state,props}=setup();state.responses.push({...payload(),evidence:null});await ready(props);assert.equal(nodes(component.render(props),node=>node.type==='article').length,0);assert.match(html(props),/No pudimos actualizar/);component.unmount();
});

test('role withdrawal and unmount abort owned reads and prevent late data or navigation from restoring a retired view',async()=>{
 const {state,props}=setup(),tree=await ready(props),oldLink=find(tree,'a','Revisar evidencias'),pending=hold();state.responses.push(()=>pending.promise);state.now+=5000;find(tree,'button','Actualizar pendientes').props.onClick();props.allowed=false;assert.equal(component.render(props),null);
 let prevented=false;oldLink.props.onClick({preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(state.events.length,0);assert.equal(state.calls.at(-1).options.signal.aborted,true);component.unmount();pending.release(payload(999));await settle();assert.equal(state.timers.size,0);assert.equal(state.denials.length,0);
});

test('confirmed zero evidence remains an explicit count and an ignored stale access callback does not purge it',async()=>{
 const {state,props}=setup();state.responses.push(payload(0));const tree=await ready(props);assert.match(renderToStaticMarkup(tree),/>0</);props.onAccessRejected=()=>false;component.render(props);state.responses.push(new Response('{}',{status:403}));state.now+=5000;find(component.render(props),'button','Actualizar pendientes').props.onClick();await settle();assert.match(html(props),/>0</);assert.doesNotMatch(html(props),/Tu acceso cambió/);component.unmount();
});
