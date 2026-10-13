import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadBindings,transform} from 'next/dist/build/swc/index.js';
import {planBaselineHarness,session} from './fixtures/plan-baseline-synthetic.mjs';
const require=createRequire(import.meta.url),reactUrl=pathToFileURL(require.resolve('react')).href;
const url=name=>new URL('../src/app/(identity)/cuenta/'+name,import.meta.url).href;
const source=readFileSync(new URL('../src/app/(identity)/cuenta/plan-baseline-panel.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
await loadBindings();
const shim=`import React from ${JSON.stringify(reactUrl)};
import {planBaselineCandidateView,planBaselineListView,planBaselineOutcome,planBaselineCommandDigest} from ${JSON.stringify(url('plan-baseline-view.mjs'))};
let values=[],refs=[],memos=[],layouts=[],refIndex=0,stateIndex=0,memoIndex=0,layoutIndex=0,transport=null,entries=[],pending=[],requests=[];
const useMemo=(fn,deps)=>{const index=memoIndex++,prior=memos[index];if(!prior||deps.some((value,i)=>value!==prior.deps[i]))memos[index]={value:fn(),deps};return memos[index].value;},useCallback=fn=>fn,useRef=value=>refs[refIndex++]??(refs[refIndex-1]={current:value});
const useLayoutEffect=(fn,deps)=>{const index=layoutIndex++,prior=layouts[index];if(!prior||deps.some((value,i)=>value!==prior.deps[i])){prior?.cleanup?.();layouts[index]={deps,cleanup:fn()};}},useEffect=()=>{},useState=value=>{const index=stateIndex++;if(values[index]===undefined)values[index]=value;return [values[index],next=>{values[index]=typeof next==='function'?next(values[index]):next;}];};
const useWorkspaceRequest=()=>transport,RECOVERY_EVENT='synthetic-receipts';
const browserRecoveryJournal={list:async()=>entries},recoveryQuery=value=>'/api/identity/plan-baseline?'+new URLSearchParams({scope:value.scope,projectId:value.projectId,operationId:value.operationId});
const styles=new Proxy({},{get:(_,key)=>key}),PlanSourceCurve=props=>React.createElement('section',{'data-curve-profile':props.profile},React.createElement('p',{},'Curva prevista · moneda por confirmar'));
export const setup=(state,send,rows=[])=>{values=state;refs=[];memos=[];layouts=[];entries=rows;transport=send;requests=[];pending=[];};
export const render=props=>{stateIndex=0;refIndex=0;memoIndex=0;layoutIndex=0;return PlanBaselinePanel({...props,onPending:value=>pending.push(value)});};
export const state=()=>values;
`;
const compiled=await transform(shim+source,{filename:'plan-baseline-panel.js',jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022',transform:{react:{runtime:'classic'}}},module:{type:'es6'}});
const ui=await import('data:text/javascript;base64,'+Buffer.from(compiled.code).toString('base64'));
function find(node,predicate,found=[]){if(!node||typeof node!=='object')return found;if(Array.isArray(node)){for(const value of node)find(value,predicate,found);return found;}if(predicate(node))found.push(node);find(node.props?.children,predicate,found);return found;}
const text=node=>typeof node==='string'?node:typeof node==='number'?String(node):Array.isArray(node)?node.map(text).join(''):node?.props?text(node.props.children):'';
const button=(tree,label)=>find(tree,node=>node.type==='button'&&text(node)===label)[0];
const initial=()=>[false,false,null,null,'',false,'',null,true,null];
async function fixture(){const h=await planBaselineHarness(),data=await h.baselines.read(session,h.context());return {h,data,props:{...h.context(),canonicalAccess:true,getSessionToken:async()=>'synthetic'}};}

test('baseline starts with one explicit read and never selects an import on mount',async()=>{
 const {props}=await fixture();let calls=0;ui.setup(initial(),async()=>{calls++;});const tree=ui.render(props),html=renderToStaticMarkup(tree);
 assert.ok(button(tree,'Consultar curva'));assert.ok(!html.includes('Confirmar línea base'));assert.equal(calls,0);
});
test('canonical access loss hides already loaded financial data and all selection controls',async()=>{
 const {h,data,props}=await fixture(),result=await h.baselines.select(session,h.input());
 ui.setup([true,false,{...data,active:result.active},null,'',false,'',null,true,null],async()=>{});
 assert.equal(ui.render({...props,canonicalAccess:false}),null);
});
test('review controls require explicit confirmation, preserve nullable money metadata, and block pending attempt',async()=>{
 const {data,props}=await fixture(),candidate=data.candidates[0],choice={candidate,expectedBaselineId:null,expectedBaselineRevision:0};
 ui.setup([true,false,data,choice,'Reviewed source choice',false,'',null,true,null],async()=>{});let tree=ui.render(props);
 assert.equal(button(tree,'Confirmar línea base').props.disabled,true);assert.match(renderToStaticMarkup(tree),/moneda y el calendario/);
 ui.setup([true,false,data,choice,'Reviewed source choice',true,'',{operationId:'pending'},true,null],async()=>{});tree=ui.render(props);assert.equal(button(tree,'Confirmar línea base').props.disabled,true);
});
test('actual SELECT handler sends source selectors and original CAS only, never browser curve or costs',async()=>{
 const {h,data,props}=await fixture(),candidate=data.candidates[0],choice={candidate,expectedBaselineId:null,expectedBaselineRevision:0};let posted;
 ui.setup([true,false,data,choice,'Reviewed source choice',true,'',null,true,null],async(url,options,parse)=>{posted=JSON.parse(options.body);assert.equal(url,'/api/identity/plan-baseline');return parse(Response.json(await h.baselines.select(session,posted)));});
 const tree=ui.render(props),form=find(tree,node=>node.type==='form')[0];await form.props.onSubmit({preventDefault(){}});
 assert.equal(posted.confirmed,true);assert.equal(posted.draftId,candidate.draftId);assert.equal(posted.expectedBaselineId,null);assert.equal(posted.expectedBaselineRevision,0);assert.equal(posted.reason,'Reviewed source choice');
 for(const key of ['curve','amount','currency','calendarStart','selectedBy','active'])assert.equal(Object.hasOwn(posted,key),false,key);
 assert.equal(ui.state()[3],null);assert.equal(ui.state()[4],'');assert.equal(ui.state()[2].active.revision,1);
});
test('audited CAS conflict preserves the motive and requires fresh explicit review before another confirmation',async()=>{
 const {h,data,props}=await fixture(),candidate=data.candidates[0],choice={candidate,expectedBaselineId:null,expectedBaselineRevision:0};await h.baselines.select(session,h.input());let calls=0;
 ui.setup([true,false,data,choice,'Keep my review reason',true,'',null,true,null],async(url,options,parse)=>{calls++;return parse(Response.json(await h.baselines.select(session,JSON.parse(options.body))));});
 let tree=ui.render(props);await find(tree,node=>node.type==='form')[0].props.onSubmit({preventDefault(){}});
 assert.equal(ui.state()[3].needsReview,true);assert.equal(ui.state()[4],'Keep my review reason');assert.equal(ui.state()[5],false);assert.equal(ui.state()[2],null);
 tree=ui.render(props);assert.equal(button(tree,'Confirmar línea base').props.disabled,true);await find(tree,node=>node.type==='form')[0].props.onSubmit({preventDefault(){}});assert.equal(calls,1);
});
test('actual recovery handler issues only receipt GET and leaves unobserved attempt blocked',async()=>{
 const {h,data,props}=await fixture(),operation=h.input(),reference={...h.context(),resource:'plan-baseline',operationId:operation.operationId,inputDigest:'e'.repeat(64)};let optionsRead,calledUrl;
 ui.setup([true,false,data,null,'',false,'',reference,true,null],async(url,options,parse)=>{calledUrl=url;optionsRead=options;return parse(Response.json(await h.baselines.read(session,{...h.context(),operationId:reference.operationId})));},[reference]);
 const tree=ui.render(props);await button(tree,'Comprobar guardado').props.onClick();
 assert.ok(calledUrl.includes('operationId='+reference.operationId));assert.equal(optionsRead.method,undefined);assert.equal(ui.state()[7].operationId,reference.operationId);assert.match(ui.state()[6],/no repetimos la selección/);
});
test('current permission denial clears private curve and local selection while retaining pending references',async()=>{
 const {data,props}=await fixture(),candidate=data.candidates[0],choice={candidate,expectedBaselineId:null,expectedBaselineRevision:0};
 ui.setup([true,false,data,choice,'Private review reason',false,'',null,true,null],async(url,options,parse)=>parse(Response.json({code:'PLAN_BASELINE_PERMISSION_REQUIRED'},{status:403})));
 await button(ui.render(props),'Actualizar curva').props.onClick();assert.equal(ui.state()[2],null);assert.equal(ui.state()[3],null);assert.equal(ui.state()[4],'');assert.equal(ui.state()[5],false);
});
test('a late financial read from the previous project cannot populate the new project view',async()=>{
 const {h,props}=await fixture();let resolve;
 ui.setup(initial(),async(url,options,parse)=>{await new Promise(done=>{resolve=done;});return parse(Response.json(await h.baselines.read(session,h.context())));});
 const previous=ui.render(props),reading=button(previous,'Consultar curva').props.onClick();
 const changed={...props,projectId:'another-synthetic-project'};ui.render(changed);ui.render(changed);
 resolve();await reading;assert.equal(ui.state()[2],null);assert.equal(ui.state()[3],null);assert.equal(ui.state()[1],false);
});
test('source review presents one curve and keeps the current baseline reference distinct from the pending selection',async()=>{
 const {h,data,props}=await fixture(),saved=await h.baselines.select(session,h.input()),current={...data,active:saved.active},choice={candidate:data.candidates[0],expectedBaselineId:saved.active.id,expectedBaselineRevision:saved.active.revision};
 ui.setup([true,false,current,choice,'Reviewed source selection',false,'',null,true,null],async()=>{});
 const tree=ui.render(props);assert.equal(find(tree,node=>node.type?.name==='PlanSourceCurve').length,1);assert.ok(!renderToStaticMarkup(tree).includes('Recibo de selección vigente:'));
});
