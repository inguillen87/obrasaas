import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {loadBindings,transform,parse} from 'next/dist/build/swc/index.js';
import {workspaceDestination,workspaceViewAllowed} from '../src/app/(identity)/cuenta/workspace-view-routing.mjs';

// Actual component JSX and request lifetime; only React scheduling, HTTP and
// imported visual dependencies are controlled. No browser/DOM/layout or live
// Clerk/provider acceptance is claimed by this rendered-subtree test.
const account=new URL('../src/app/(identity)/cuenta/',import.meta.url);
const source=readFileSync(new URL('office-chat-panel.js',account),'utf8').replace(/^import .*;\r?\n/gm,'');
const names=[...source.matchAll(/\[([A-Za-z]+),set[A-Za-z]+\]=useState/g)].map(m=>m[1]);
await loadBindings();
const compile=async(value,filename)=>{const out=await transform(value,{filename,jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022',transform:{react:{runtime:'classic'}}},module:{type:'es6'}});return 'data:text/javascript;base64,'+Buffer.from(out.code).toString('base64');};
const prefix=`import React from ${JSON.stringify(import.meta.resolve('react'))};
import {createWorkspaceRequestLifecycle as realLifecycle} from ${JSON.stringify(new URL('workspace-request-lifecycle.mjs',account).href)};
const styles={},Link='a';let states=[],memos=[],effects=[],stateCursor=0,memoCursor=0,effectCursor=0,pending=[],calls=[],responses=[],mounted=false,currentKey=null;
const useState=initial=>{const i=stateCursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],next=>{states[i]=typeof next==='function'?next(states[i]):next;}];};
const useMemo=(factory,deps)=>{const i=memoCursor++,old=memos[i];if(!old||deps.some((value,index)=>value!==old.deps[index]))memos[i]={deps,value:factory()};return memos[i].value;};
const useEffect=(callback,deps)=>{const i=effectCursor++,old=effects[i];if(!old||deps.some((value,index)=>value!==old.deps[index]))pending.push(()=>{old?.cleanup?.();effects[i]={deps,cleanup:callback()};});};
const createWorkspaceRequestLifecycle=getToken=>realLifecycle(getToken,{fetchImpl:async(url,options)=>{calls.push({url,method:options.method||'GET',body:options.body,signal:options.signal});if(!responses.length)throw Error('Unexpected controlled office HTTP');return await responses.shift();}});
`;
const suffix=`
export function unmount(){for(const effect of effects)effect?.cleanup?.();states=[];memos=[];effects=[];pending=[];mounted=false;currentKey=null;}
export function reset(values=[]){unmount();responses=[...values];calls=[];}
export function render(props){const element=OfficeChatSlot(props);if(!element){if(mounted)unmount();return null;}const key=props.scope+':'+props.projectId;if(mounted&&currentKey!==key)unmount();currentKey=key;mounted=true;stateCursor=memoCursor=effectCursor=0;pending=[];const tree=OfficeChatPanel(element.props);for(const effect of pending)effect();return tree;}
export const requests=()=>calls;export const state=()=>Object.fromEntries(${JSON.stringify(names)}.map((name,index)=>[name,states[index]]));
`;
const panel=await import(await compile(prefix+source+suffix,'actual-office-panel-controlled-lifecycle.js'));
function nodes(tree,predicate,out=[]){if(!tree||typeof tree!=='object')return out;if(predicate(tree))out.push(tree);for(const child of React.Children.toArray(tree.props?.children))nodes(child,predicate,out);return out;}
const text=node=>typeof node==='string'?node:typeof node==='number'?String(node):node?.props?React.Children.toArray(node.props.children).map(text).join(''):'';
const one=(tree,predicate)=>{const found=nodes(tree,predicate);assert.equal(found.length,1);return found[0];};
const button=(tree,label)=>one(tree,n=>n.type==='button'&&text(n)===label);
const json=value=>Response.json(value);
const token=async()=> 'synthetic-office-ui-session';
const props={active:true,role:'DIRECTOR',projectId:'project-a',scope:'a'.repeat(64),getSessionToken:token};
const prepared={state:'PREPARED',codeAvailable:true,message:'CUENTA '+'A'.repeat(43),expiresAt:new Date(Date.now()+300000).toISOString(),businessPhone:'+5491111111111'};
async function prepare(extra={}){let tree=panel.render({...props,...extra});await button(tree,'Continuar con mi cuenta').props.onClick();tree=panel.render({...props,...extra});one(tree,n=>n.type==='input').props.onChange({target:{value:'+5492222222222'}});tree=panel.render({...props,...extra});await button(tree,'Preparar código de cuenta').props.onClick();return panel.render({...props,...extra});}
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};}
async function dispatched(count){for(let i=0;i<30&&panel.requests().length<count;i++)await Promise.resolve();assert.equal(panel.requests().length,count);}

test('office slot renders nothing outside its active section or for other roles and makes no automatic requests',t=>{t.after(()=>panel.unmount());panel.reset();for(const role of ['ADMIN','DIRECTOR']){assert.equal(panel.render({...props,role,active:false}),null);assert.equal(panel.requests().length,0);assert.ok(panel.render({...props,role}));panel.unmount();}assert.equal(panel.render({...props,role:'AUDITOR'}),null);assert.equal(panel.requests().length,0);});
test('received ephemeral code does not remain pending; leaving removes its rendered subtree and returning never POSTs automatically',async t=>{t.after(()=>panel.unmount());const pending=[];const onPending=value=>pending.push(value);panel.reset([json({state:'NOT_BOUND'}),json(prepared)]);const tree=await prepare({onPending});assert.match(text(tree),/CUENTA A{43}/);assert.equal(pending.at(-1),false);assert.equal(panel.requests().filter(r=>r.method==='POST').length,1);assert.equal(panel.render({...props,active:false,onPending}),null);assert.equal(panel.state().message,undefined);const returned=panel.render({...props,onPending});assert.equal(nodes(returned,n=>n.type==='code').length,0);assert.equal(panel.requests().length,2);assert.equal(panel.requests().filter(r=>r.method==='POST').length,1);});
test('leaving during a dispatched prepare aborts delivery; its late response cannot restore a code on return',async t=>{t.after(()=>panel.unmount());const delayed=deferred();panel.reset([json({state:'NOT_BOUND'}),delayed.promise]);let tree=panel.render(props);await button(tree,'Continuar con mi cuenta').props.onClick();tree=panel.render(props);one(tree,n=>n.type==='input').props.onChange({target:{value:'+5492222222222'}});tree=panel.render(props);const operation=button(tree,'Preparar código de cuenta').props.onClick();await dispatched(2);const signal=panel.requests()[1].signal;assert.equal(panel.render({...props,active:false}),null);assert.equal(signal.aborted,true);panel.render(props);delayed.resolve(json(prepared));await operation;const after=panel.render(props);assert.equal(nodes(after,n=>n.type==='code').length,0);assert.equal(panel.requests().filter(r=>r.method==='POST').length,1);});
test('DIRECTOR without integration capability gets guidance rather than an inaccessible corporate-channel link',async t=>{t.after(()=>panel.unmount());panel.reset([json({state:'CONNECT_WHATSAPP'})]);let tree=panel.render(props);await button(tree,'Continuar con mi cuenta').props.onClick();tree=panel.render(props);assert.match(text(tree),/Pedile al administrador/);assert.equal(nodes(tree,n=>n.type==='a'&&n.props.href==='/cuenta?seccion=canal').length,0);panel.reset([json({state:'CONNECT_WHATSAPP'})]);tree=panel.render({...props,canManageCompanyChannel:true});await button(tree,'Continuar con mi cuenta').props.onClick();tree=panel.render({...props,canManageCompanyChannel:true});assert.equal(nodes(tree,n=>n.type==='a'&&n.props.href==='/cuenta?seccion=canal').length,1);});
test('loading or changing context disables its preparation action',async t=>{t.after(()=>panel.unmount());panel.reset([json({state:'NOT_BOUND'})]);let tree=panel.render(props);await button(tree,'Continuar con mi cuenta').props.onClick();tree=panel.render(props);one(tree,n=>n.type==='input').props.onChange({target:{value:'+5492222222222'}});tree=panel.render({...props,disabled:true});assert.equal(button(tree,'Preparar código de cuenta').props.disabled,true);assert.equal(panel.requests().filter(r=>r.method==='POST').length,0);});

test('both actual account placements are inside Mi WhatsApp with active-only slots and persistent WorkerChannelPanel siblings',async()=>{
 const accountSource=readFileSync(new URL('workspace-client.js',account),'utf8'),tree=await parse(accountSource,{filename:'workspace-client.js',syntax:'ecmascript',jsx:true});const slots=[];
 function walk(value,parents=[]){if(!value||typeof value!=='object')return;if(Array.isArray(value)){for(const row of value)walk(row,parents);return;}if(value.type==='JSXElement'&&value.opening.name?.value==='OfficeChatSlot')slots.push({value,parents});for(const [key,child]of Object.entries(value))if(key!=='span')walk(child,[...parents,value]);}walk(tree);assert.equal(slots.length,2);
 for(const slot of slots){const screen=slot.parents.filter(p=>p.type==='JSXElement'&&p.opening.name?.value==='WorkspaceScreen').at(-1);assert.ok(screen);assert.equal(screen.opening.attributes.find(a=>a.name?.value==='name').value.value,'mi-whatsapp');const active=slot.value.opening.attributes.find(a=>a.name?.value==='active').value.expression;assert.equal(active.operator,'===');assert.equal(active.right.value,'mi-whatsapp');const workers=[];walkWorker(screen,workers);assert.equal(workers.length,1);assert.equal(slot.value.children.length,0);}
 function walkWorker(value,out){if(!value||typeof value!=='object')return;if(Array.isArray(value)){for(const v of value)walkWorker(v,out);return;}if(value.type==='JSXElement'&&value.opening.name?.value==='WorkerChannelPanel')out.push(value);for(const [key,child]of Object.entries(value))if(key!=='span')walkWorker(child,out);}
});
test('pending office request points to the existing Mi WhatsApp destination for DIRECTOR',async()=>{
 const nav=readFileSync(new URL('workspace-tools-navigation.js',account),'utf8').replace(/^import .*;\r?\n/gm,'');
 const pre=`import React from ${JSON.stringify(import.meta.resolve('react'))};const styles={};const [House,CalendarDays,UsersRound,HardHat,Package,ShoppingBag,BriefcaseBusiness,MessageCircle,Settings2,Clock3,CreditCard]=Array(11).fill('i');const workspaceDestination=globalThis.__officeDestination;const workspaceViewAllowed=globalThis.__officeAllowed;const revealWorkspaceDestination=()=>{};`;
 // Bind real pure presentation helpers; no view permission is supplied by the test.
 globalThis.__officeDestination=workspaceDestination;globalThis.__officeAllowed=workspaceViewAllowed;let navModule;try{navModule=await import(await compile(pre+nav,'actual-office-pending-navigation.js'));}finally{delete globalThis.__officeDestination;delete globalThis.__officeAllowed;}
 const tree=navModule.WorkspaceToolsNavigation({role:'DIRECTOR',projectAvailable:true,pending:{officeChat:true}}),pending=one(tree,n=>n.props?.role==='status');assert.equal(nodes(pending,n=>n.type==='a'&&n.props.href==='#worker-channel-title').length,1);assert.match(text(pending),/Mi WhatsApp/);
});
