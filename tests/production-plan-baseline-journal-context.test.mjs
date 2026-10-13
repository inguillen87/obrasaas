import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {loadBindings,transform} from 'next/dist/build/swc/index.js';
import {planBaselineHarness,session} from './fixtures/plan-baseline-synthetic.mjs';
import {planBaselineCommandDigest} from '../src/app/(identity)/cuenta/plan-baseline-view.mjs';

const require=createRequire(import.meta.url),reactUrl=pathToFileURL(require.resolve('react')).href;
const source=readFileSync(new URL('../src/app/(identity)/cuenta/plan-baseline-panel.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
const viewUrl=new URL('../src/app/(identity)/cuenta/plan-baseline-view.mjs',import.meta.url).href;
await loadBindings();

async function component(){
 const shim=`import React from ${JSON.stringify(reactUrl)};
import {planBaselineCandidateView,planBaselineListView,planBaselineOutcome,planBaselineCommandDigest} from ${JSON.stringify(viewUrl)};
let values=[],refs=[],memos=[],layouts=[],effects=[],queued=[],stateIndex=0,refIndex=0,memoIndex=0,layoutIndex=0,effectIndex=0,transport,journal;
const changed=(prior,deps)=>!prior||deps.some((value,index)=>value!==prior.deps[index]);
const useMemo=(fn,deps)=>{const index=memoIndex++,prior=memos[index];if(changed(prior,deps))memos[index]={deps,value:fn()};return memos[index].value;};
const useCallback=(fn,deps)=>useMemo(()=>fn,deps),useRef=value=>refs[refIndex++]??(refs[refIndex-1]={current:value});
const useState=value=>{const index=stateIndex++;if(values[index]===undefined)values[index]=value;return [values[index],next=>{values[index]=typeof next==='function'?next(values[index]):next;}];};
const useLayoutEffect=(fn,deps)=>{const index=layoutIndex++,prior=layouts[index];if(changed(prior,deps)){prior?.cleanup?.();layouts[index]={deps,cleanup:fn()};}};
const useEffect=(fn,deps)=>{const index=effectIndex++,prior=effects[index];if(changed(prior,deps)||prior?.pending){effects[index]={deps,cleanup:prior?.cleanup,pending:true};queued.push(()=>{effects[index].cleanup?.();effects[index].cleanup=fn();effects[index].pending=false;});}};
const useWorkspaceRequest=()=>transport,RECOVERY_EVENT='synthetic-baseline-receipts';
const browserRecoveryJournal={list:()=>journal()},recoveryQuery=value=>'/api/identity/plan-baseline?'+new URLSearchParams({scope:value.scope,projectId:value.projectId,operationId:value.operationId});
const styles=new Proxy({},{get:(_,key)=>key}),PlanSourceCurve=props=>React.createElement('section',{'data-curve-profile':props.profile});
export const setup=(state,send,list)=>{values=state;transport=send;journal=list;};
export const render=props=>{stateIndex=refIndex=memoIndex=layoutIndex=effectIndex=0;queued=[];return PlanBaselinePanel({...props,onPending:()=>{}});};
export const flushEffects=()=>{for(const run of queued)run();queued=[];};
export const state=()=>values;
export const cleanup=()=>{for(const effect of effects)effect?.cleanup?.();for(const layout of layouts)layout?.cleanup?.();};
`;
 const compiled=await transform(shim+source,{filename:'plan-baseline-panel.js',jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022',transform:{react:{runtime:'classic'}}},module:{type:'es6'}});
 return import('data:text/javascript;base64,'+Buffer.from(compiled.code).toString('base64')+'#'+Math.random());
}
function nodes(node,predicate,result=[]){
 if(!node||typeof node!=='object')return result;
 if(Array.isArray(node)){for(const child of node)nodes(child,predicate,result);return result;}
 if(predicate(node))result.push(node);nodes(node.props?.children,predicate,result);return result;
}
const text=node=>typeof node==='string'?node:Array.isArray(node)?node.map(text).join(''):node?.props?text(node.props.children):'';
const button=(tree,label)=>nodes(tree,node=>node.type==='button'&&text(node)===label)[0];
function surfaces(){
 const originals=new Map(['window','document','BroadcastChannel'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 globalThis.window={addEventListener(){},removeEventListener(){}};
 globalThis.document={visibilityState:'visible',addEventListener(){},removeEventListener(){}};
 globalThis.BroadcastChannel=undefined;
 return()=>{for(const [key,value]of originals)if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];};
}

async function scenario(action){
 const restore=surfaces(),ui=await component(),h=await planBaselineHarness(),data=await h.baselines.read(session,h.context()),input=h.input();
 const props={...h.context(),canonicalAccess:true,getSessionToken:async()=>'synthetic-session'},next={...props,projectId:'new-project-synthetic'};
 const reference={...h.context(),resource:'plan-baseline',operationId:input.operationId,inputDigest:await planBaselineCommandDigest(input)};
 if(action==='RECOVER')await h.baselines.select(session,input);
 const choice={candidate:data.candidates[0],expectedBaselineId:null,expectedBaselineRevision:0};
 let entered,rejectOld,posts=0,gets=0,listCalls=0;
 const oldListEntered=new Promise(resolve=>{entered=resolve;}),oldList=new Promise((_,reject)=>{rejectOld=reject;});
 ui.setup([true,false,data,action==='SELECT'?choice:null,'Reviewed synthetic source',true,'',action==='RECOVER'?reference:null,true,null],async(url,options,consume)=>{
  if(options.method==='POST'){posts++;return consume(Response.json(await h.baselines.select(session,JSON.parse(options.body))));}
  gets++;const params=new URL(url,'https://obrasaas.com').searchParams;
  // Old recovery uses the actual in-memory canonical store. The fresh project
  // read is a controlled DTO: it supplies no authority or database evidence.
  const result=params.has('operationId')?await h.baselines.read(session,{...h.context(),operationId:params.get('operationId')}):{...data,projectId:params.get('projectId')};
  return consume(Response.json(result));
 },()=>{listCalls++;if(listCalls===1){entered();return oldList;}return Promise.resolve([]);});
 try{
  const tree=ui.render(props),pending=action==='SELECT'?nodes(tree,node=>node.type==='form')[0].props.onSubmit({preventDefault(){}}):button(tree,'Comprobar guardado').props.onClick();
  await oldListEntered;
  // React discards the first render when the conditional state owner reset
  // changes state. The second render reflects that new owner's empty state.
  ui.render(next);ui.render(next);ui.flushEffects();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(ui.state()[8],true,'The new owner independently confirmed its journal references');
  await button(ui.render(next),'Consultar curva').props.onClick();
  assert.equal(ui.state()[2].projectId,next.projectId);assert.equal(ui.state()[8],true);
  rejectOld(new Error('Synthetic previous-project journal rejection'));await pending;
  assert.equal(ui.state()[2].projectId,next.projectId,'Old completion cannot replace private data belonging to the new project');
  assert.equal(ui.state()[8],true,'Old journal rejection cannot disable the new owner reference readiness');
  assert.equal(ui.state()[6],'','Old journal rejection cannot overwrite the new owner notice');
  assert.equal(posts,action==='SELECT'?1:0);assert.equal(gets,action==='SELECT'?1:2);assert.equal(listCalls,2);
 }finally{ui.cleanup();restore();}
}

test('late SELECT journal rejection cannot alter the next project after its current read succeeds',{timeout:5000},()=>scenario('SELECT'));
test('late RECOVER journal rejection cannot alter the next project or repeat selection',{timeout:5000},()=>scenario('RECOVER'));
