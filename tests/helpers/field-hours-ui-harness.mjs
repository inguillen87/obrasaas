import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {loadBindings,transform} from 'next/dist/build/swc/index.js';
const account=new URL('../../src/app/(identity)/cuenta/',import.meta.url);
const stripImports=source=>source.replace(/^import .*;\r?\n/gm,'');
export async function createHoursUiHarness(){
 await loadBindings();
 const compile=async(source,filename)=>{const value=await transform(source,{filename,jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022',transform:{react:{runtime:'classic'}}},module:{type:'es6'}});return 'data:text/javascript;base64,'+Buffer.from(value.code).toString('base64');};
 const react=`import React from ${JSON.stringify(import.meta.resolve('react'))};\n`;
 const overtime=await compile(react+'const styles={};\n'+stripImports(readFileSync(new URL('field-overtime-view.js',account),'utf8')),'isolated-hours-duration.js');
 const source=stripImports(readFileSync(new URL('field-hours-report-panel.js',account),'utf8'));
 const stateNames=[...source.matchAll(/\[([A-Za-z]+),set[A-Za-z]+\]=useState/g)].map(match=>match[1]);
 const prefix=react+`import {createWorkspaceRequestLifecycle} from ${JSON.stringify(new URL('workspace-request-lifecycle.mjs',account).href)};
 import {recordedDuration} from ${JSON.stringify(overtime)};
 const styles={};let states=[],refs=[],effects=[],stateCursor=0,refCursor=0,effectCursor=0,pendingEffects=[],calls=[],responses=[],lifecycle,tokenOwner;
 const useState=initial=>{const index=stateCursor++;if(!(index in states))states[index]=typeof initial==='function'?initial():initial;return [states[index],next=>{states[index]=typeof next==='function'?next(states[index]):next;}];};
 const useRef=initial=>{const index=refCursor++;return refs[index]??(refs[index]={current:initial});};
 const useEffect=(callback,deps)=>{const index=effectCursor++;const previous=effects[index];if(!previous||deps.some((item,i)=>item!==previous.deps[i]))pendingEffects.push(()=>{previous?.cleanup?.();effects[index]={deps,cleanup:callback()};});};
 const fetchImpl=async(url,options)=>{const next=responses.shift();if(next===undefined)throw Error('Unexpected synthetic UI HTTP');calls.push({url,method:options.method||'GET',headers:Object.fromEntries(options.headers)});return typeof next==='function'?await next(url,options):await next;};
 const useWorkspaceRequest=getToken=>{if(!lifecycle||getToken!==tokenOwner){lifecycle?.abort();tokenOwner=getToken;lifecycle=createWorkspaceRequestLifecycle(getToken,{fetchImpl});}return lifecycle.request;};
 `;
 const suffix=`\nexport function unmount(){for(const effect of effects)effect?.cleanup?.();lifecycle?.abort();}
 export function reset(seed,replies){unmount();states=[];refs=[];effects=[];pendingEffects=[];calls=[];responses=[...replies];lifecycle=null;tokenOwner=null;for(const [name,value]of Object.entries(seed)){const index=${JSON.stringify(stateNames)}.indexOf(name);if(index<0)throw Error('Unknown harness seed '+name);states[index]=value;}}
 export function render(props){stateCursor=refCursor=effectCursor=0;pendingEffects=[];const tree=FieldHoursReportPanel(props);for(const effect of pendingEffects)effect();return tree;}
 export const state=()=>Object.fromEntries(${JSON.stringify(stateNames)}.map((name,index)=>[name,states[index]]));export const requests=()=>calls;
 `;
 const panel=await import(await compile(prefix+source+suffix,'actual-hours-panel-isolated.js'));
 const parent=await import(await compile(react+stripImports(readFileSync(new URL('field-operations-panel.js',account),'utf8')),'actual-field-panel-wrapper-isolated.js'));
 return {panel,parent};
}
export function nodes(tree,predicate,result=[],ancestors=[]){if(!tree||typeof tree!=='object')return result;if(predicate(tree,ancestors))result.push(tree);for(const child of React.Children.toArray(tree.props?.children))nodes(child,predicate,result,[...ancestors,tree]);return result;}
export const text=tree=>typeof tree==='string'?tree:typeof tree==='number'?String(tree):tree?.props?React.Children.toArray(tree.props.children).map(text).join(''):'';
export function one(tree,predicate){const found=nodes(tree,predicate);assert.equal(found.length,1);return found[0];}
export function change(tree,predicate,value){one(tree,predicate).props.onChange({target:{value,checked:value}});}
export function configure(panel,props){
 let tree=panel.render(props);const dates=nodes(tree,node=>node.type==='input'&&node.props.type==='date');dates[0].props.onChange({target:{value:'2026-10-01'}});tree=panel.render(props);nodes(tree,node=>node.type==='input'&&node.props.type==='date')[1].props.onChange({target:{value:'2026-11-01'}});tree=panel.render(props);change(tree,node=>node.type==='select','America/Argentina/Buenos_Aires');tree=panel.render(props);change(tree,node=>node.type==='input'&&node.props.type==='checkbox',true);return panel.render(props);
}
export function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};}
export const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
export async function dispatched(panel,count=1){for(let i=0;i<30&&panel.requests().length<count;i++)await Promise.resolve();assert.equal(panel.requests().length,count,'Expected bounded synthetic request dispatch');}