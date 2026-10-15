import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import React from 'react';
import {loadBindings,transform} from 'next/dist/build/swc/index.js';

// Execute the actual JSX and event handlers with controlled hooks and transport.
// This exercises component state; it does not certify React scheduling or a browser.
const root=new URL('../src/app/(identity)/cuenta/',import.meta.url);
const reactUrl=import.meta.resolve('react');
const source=name=>readFileSync(new URL(name,root),'utf8').replace(/^import .*;\r?\n/gm,'');
const hooks=`
let states=[],refs=[],effects=[],memos=[],pending=[],stateCursor=0,refCursor=0,effectCursor=0,memoCursor=0;
const same=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,i)=>Object.is(value,b[i]));
const useState=initial=>{const i=stateCursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];};
const useRef=initial=>{const i=refCursor++;return refs[i]??(refs[i]={current:initial});};
const useCallback=(fn,deps)=>{const i=memoCursor++;if(!memos[i]||!same(memos[i].deps,deps))memos[i]={fn,deps};return memos[i].fn;};
const useEffect=(fn,deps)=>{const i=effectCursor++;if(!effects[i]||!same(effects[i].deps,deps))pending.push({i,fn,deps});};const useLayoutEffect=useEffect;
const React={...ActualReact,useLayoutEffect},styles={},identityStyles={};
const cursors=()=>{stateCursor=refCursor=effectCursor=memoCursor=0;pending=[];};
export const flushEffects=()=>{const next=pending;pending=[];for(const {i,fn,deps} of next){effects[i]?.cleanup?.();effects[i]={deps,cleanup:fn()};}};
export const unmount=()=>{for(const effect of effects)effect?.cleanup?.();effects=[];pending=[];};
export const reset=()=>{states=[];refs=[];effects=[];memos=[];pending=[];};
`;
await loadBindings();
async function compile(text,prefix,entry){
 const result=await transform('import ActualReact from '+JSON.stringify(reactUrl)+';'+hooks+prefix+text+entry,{filename:'actual-bootstrap-context-components.js',jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022',transform:{react:{runtime:'classic'}}},module:{type:'es6'}});
 return import('data:text/javascript;base64,'+Buffer.from(result.code).toString('base64'));
}
const panel=await compile(source('company-bootstrap-panel.js'),`
import {workspaceActiveToken} from ${JSON.stringify(new URL('workspace-session-request.mjs',root).href)};
import {companyPhoneE164} from ${JSON.stringify(new URL('../src/lib/company-phone-format.mjs',import.meta.url).href)};
let calls=[],queue=[];
const fetch=async(url,options)=>{calls.push({url,method:options.method,body:options.body,signal:options.signal});const next=queue.shift();if(!next)throw Error('Unexpected controlled request');if(next.wait)await next.wait;if(next.error)throw next.error;return {ok:(next.status??200)<400,status:next.status??200,json:async()=>next.data};};
export const configure=next=>{calls=[];queue=next;};export const requests=()=>calls;
`,'export const render=props=>{cursors();return CompanyBootstrapPanel(props);};');
const identity=await compile(source('workspace-identity.js'),`
const Link=function Link(){return null;},OrganizationSwitcher=function OrganizationSwitcher(){return null;},AccountWorkspace=function AccountWorkspace(){return null;},CompanyBootstrapPanel=function CompanyBootstrapPanel(){return null;},ParticipantSelfServicePanel=()=>null,OfficeJoinPanel=()=>null,OnboardingGuide=()=>null,IdentityLoadingNotice=()=>null;
`,'export const render=props=>{cursors();return WorkspaceIdentityContext(props);};');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
function nodes(tree,predicate,result=[]){if(!tree||typeof tree!=='object')return result;if(predicate(tree))result.push(tree);for(const child of React.Children.toArray(tree.props?.children))nodes(child,predicate,result);return result;}
const text=node=>React.Children.toArray(node.props?.children).filter(value=>typeof value==='string').join('');
function button(tree,label){const result=nodes(tree,node=>node.type==='button'&&text(node)===label)[0];assert.ok(result,'Missing actual button: '+label);return result;}
function edit(tree,label,value){const node=nodes(tree,node=>node.type==='label'&&text(node)===label)[0];assert.ok(node);const input=nodes(node,element=>element.type==='input')[0];assert.ok(input);input.props.onChange({target:{value}});}
const baseProps={organizationId:'org_ContextA',organizationName:'Constructora A',getSessionToken:async()=> 'controlled-session',getProfileToken:async()=> 'controlled-profile'};
async function renderPanel(props){const tree=panel.render(props);panel.flushEffects();await tick();return tree;}
async function newPanel(extra={},queue=[{data:{state:'NOT_CREATED',canCreate:true}}]){
 panel.reset();panel.configure(queue);const observations=[],props={...baseProps,onPending:value=>observations.push(value),...extra};
 await renderPanel(props);const tree=await renderPanel(props);return {props,tree,observations};
}
function prepare(fixture){edit(fixture.tree,'Nombre de la primera obra','Obra elegida');const tree=panel.render(fixture.props);const checkbox=nodes(tree,node=>node.type==='input'&&node.props.type==='checkbox')[0];checkbox.props.onChange({target:{checked:true}});return panel.render(fixture.props);}
const created={state:'CREATED',created:true,receiptId:'company_bootstrap_'+'a'.repeat(64),projectId:'project_synthetic',organizationId:'company_synthetic',companyName:'Constructora A',projectName:'Obra elegida',initialTaskCount:0};

test('actual blank initial form stays switchable; typed company/project data publishes its pending lock',async()=>{
 const fixture=await newPanel();assert.equal(fixture.observations.at(-1),false);
 edit(fixture.tree,'Nombre de la primera obra','Obra conservada');await renderPanel(fixture.props);
 assert.equal(fixture.observations.at(-1),true);assert.equal(panel.requests().length,1);assert.equal(panel.requests()[0].method,'GET');panel.unmount();
});

test('explicit local discard resets actual fields and confirmation without a POST',async()=>{
 const fixture=await newPanel();const tree=prepare(fixture);await renderPanel(fixture.props);
 assert.equal(fixture.observations.at(-1),true);button(tree,'Descartar borrador de alta').props.onClick();const cleared=await renderPanel(fixture.props);
 assert.equal(fixture.observations.at(-1),false);const fields=nodes(cleared,node=>node.type==='input');assert.equal(fields[0].props.value,'Constructora A');assert.equal(fields[1].props.value,'');assert.equal(fields.find(node=>node.props.type==='checkbox').props.checked,false);assert.equal(panel.requests().filter(row=>row.method==='POST').length,0);panel.unmount();
});

test('actual in-flight creation retains its exact command and prevents local discard until receipt recovery',async()=>{
 const wait=deferred(),fixture=await newPanel({},[{data:{state:'NOT_CREATED',canCreate:true}},{wait:wait.promise,error:new Error('Controlled lost response')},{data:{state:'NOT_OBSERVED',canCreate:true}},{data:created}]);
 const tree=prepare(fixture),form=nodes(tree,node=>node.type==='form')[0],sending=form.props.onSubmit({preventDefault(){}});await tick();let current=await renderPanel(fixture.props);
 assert.equal(fixture.observations.at(-1),true);assert.equal(nodes(current,node=>node.type==='button'&&text(node)==='Descartar borrador de alta').length,0);assert.equal(panel.requests().filter(row=>row.method==='POST').length,1);
 const original=panel.requests().find(row=>row.method==='POST').body;wait.resolve();await sending;current=await renderPanel(fixture.props);assert.equal(fixture.observations.at(-1),true);
 await button(current,'Comprobar creación').props.onClick();current=await renderPanel(fixture.props);assert.equal(fixture.observations.at(-1),true);assert.equal(panel.requests().filter(row=>row.method==='POST').length,1);
 const recovery=panel.requests().at(-1);assert.equal(new URL(recovery.url,'https://fixture.invalid').searchParams.get('operationId'),JSON.parse(original).operationId);
 await button(current,'Reenviar mismo intento').props.onClick();await renderPanel(fixture.props);const posts=panel.requests().filter(row=>row.method==='POST');assert.equal(posts.length,2);assert.equal(posts[1].body,original);assert.equal(fixture.observations.at(-1),false);panel.unmount();
});

test('pre-dispatch credential failure preserves the pending UUID and never unlocks an unconfirmed attempt',async()=>{
 const fixture=await newPanel({getProfileToken:async()=>{throw Error('Controlled profile unavailable');}});const tree=prepare(fixture);
 await nodes(tree,node=>node.type==='form')[0].props.onSubmit({preventDefault(){}});const current=await renderPanel(fixture.props);
 assert.equal(fixture.observations.at(-1),true);assert.equal(panel.requests().filter(row=>row.method==='POST').length,0);assert.ok(button(current,'Comprobar creación'));assert.equal(nodes(current,node=>node.type==='button'&&text(node)==='Descartar borrador de alta').length,0);panel.unmount();
});

test('existing configured company passes to its workspace without a bootstrap-only pending lock',async()=>{
 const fixture=await newPanel({},[{data:{state:'ALREADY_CONFIGURED',currentCompany:null}}]);assert.equal(fixture.observations.at(-1),false);assert.equal(nodes(fixture.tree,node=>node.type==='form').length,0);assert.equal(panel.requests().length,1);panel.unmount();
});

const contextProps=(contextKey='A')=>({contextKey,returnPath:'/cuenta',signInPath:'/sign-in',initialProjectId:'',initialPlanId:'',isLoaded:true,isSignedIn:true,userId:'user_Context',sessionId:'session_Controlled',orgId:'org_'+contextKey,orgRole:'org:admin',organization:{id:'org_'+contextKey,name:'Constructora '+contextKey},sessionToken:async()=> 'controlled-session',profileToken:async()=> 'controlled-profile'});
function context(contextKey='A'){identity.reset();const props=contextProps(contextKey),tree=identity.render(props);identity.flushEffects();const bootstrap=nodes(tree,node=>node.type?.name==='CompanyBootstrapPanel')[0],workspace=nodes(tree,node=>node.type?.name==='AccountWorkspace')[0];assert.ok(bootstrap);assert.ok(workspace);return {props,bootstrap,workspace};}
const selectorVisible=fixture=>nodes(identity.render(fixture.props),node=>node.type?.name==='OrganizationSwitcher').length===1;

test('actual identity JSX wires bootstrap and nested workspace to separate pending sources',()=>{
 const fixture=context();assert.equal(typeof fixture.bootstrap.props.onPending,'function');assert.equal(typeof fixture.workspace.props.onContextPending,'function');assert.equal(selectorVisible(fixture),true);
 fixture.bootstrap.props.onPending(true);assert.equal(selectorVisible(fixture),false);fixture.bootstrap.props.onPending(false);assert.equal(selectorVisible(fixture),true);identity.unmount();
});

test('ready-stage bootstrap false and its cleanup cannot clear a nested pending workspace',()=>{
 const fixture=context();fixture.workspace.props.onContextPending(true);fixture.bootstrap.props.onPending(false);assert.equal(selectorVisible(fixture),false);
 fixture.bootstrap.props.onPending(true);fixture.workspace.props.onContextPending(false);assert.equal(selectorVisible(fixture),false);fixture.bootstrap.props.onPending(false);assert.equal(selectorVisible(fixture),true);identity.unmount();
});

test('nonboolean callback values cannot clear either current pending source',()=>{
 const fixture=context();fixture.bootstrap.props.onPending(true);for(const value of [null,undefined,0,'false',{}]){fixture.bootstrap.props.onPending(value);fixture.workspace.props.onContextPending(value);assert.equal(selectorVisible(fixture),false);}identity.unmount();
});

test('old callbacks cannot clear a new context even after returning to the same context key',()=>{
 for(const key of ['B','A']){const old=context('A'),callbacks=[old.bootstrap.props.onPending,old.workspace.props.onContextPending];identity.unmount();const current=context(key);current.bootstrap.props.onPending(true);for(const callback of callbacks)callback(false);assert.equal(selectorVisible(current),false);current.bootstrap.props.onPending(false);assert.equal(selectorVisible(current),true);identity.unmount();}
});

test('members and anonymous sessions never acquire a company-creation component or new authority',()=>{
 for(const extra of [{orgRole:'org:member'},{isSignedIn:false}]){identity.reset();const tree=identity.render({...contextProps(),...extra});identity.flushEffects();assert.equal(nodes(tree,node=>node.type?.name==='CompanyBootstrapPanel').length,0);identity.unmount();}
});
