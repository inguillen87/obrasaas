import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,mkdirSync,mkdtempSync,readFileSync,realpathSync,rmSync} from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {parse} from '@babel/parser';
import {prepareWorksiteLivePilotFixture} from '../scripts/lib/worksite-live-pilot-browser-fixture.mjs';

// Generate the canonical fixture without starting a server/browser. Execute its
// exact copied schedule callback prefix with controlled React hooks and reads.
const root=realpathSync(process.cwd()),parent=path.join(root,'.vercel/private');
mkdirSync(parent,{recursive:true});assert.equal(realpathSync(parent),parent);assert.equal(lstatSync(parent).isSymbolicLink(),false);
const fixture=mkdtempSync(path.join(parent,'live-pilot-fixture-unit-')),sourceManifest=[];
after(()=>{assert.equal(path.dirname(fixture),parent);assert.equal(realpathSync(fixture),fixture);assert.equal(lstatSync(fixture).isSymbolicLink(),false);rmSync(fixture,{recursive:true});assert.equal(existsSync(fixture),false);});
const proof=prepareWorksiteLivePilotFixture({root,fixture,sourceManifest});
const source=readFileSync(path.join(root,'src/app/(identity)/cuenta/workspace-client.js'),'utf8');
const page=readFileSync(path.join(fixture,'src/app/pilot-live-refresh/page.js'),'utf8');
const hash=value=>createHash('sha256').update(value).digest('hex');
function nodes(node,predicate,result=[]){if(!node||typeof node!=='object')return result;if(predicate(node))result.push(node);for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(child=>nodes(child,predicate,result));else if(value&&typeof value==='object')nodes(value,predicate,result);}return result;}
function declarations(text){const tree=parse(text,{sourceType:'module',plugins:['jsx']}),found=new Map();nodes(tree,node=>node.type==='VariableDeclaration').forEach(parent=>{for(const node of parent.declarations)if(node.id.type==='Identifier'){const prior=found.get(node.id.name)||[];prior.push({node,parent});found.set(node.id.name,prior);}});return name=>{const matches=found.get(name)||[];assert.equal(matches.length,1,'One generated declaration '+name);return matches[0];};}
const pageDeclaration=declarations(page),sourceDeclaration=declarations(source);
const context=pageDeclaration('scheduleLiveContext'),live=pageDeclaration('scheduleLive');
const generatedBlocked=nodes(parse(page,{sourceType:'module',plugins:['jsx']}),node=>node.type==='VariableDeclarator'&&node.id.name==='scheduleLiveBlocked')[0];
const snippet=page.slice(generatedBlocked?generatedBlocked.start-6:context.parent.start,live.parent.end);
function render({contextLocked=false,loading=false,planReadbackMatches=false}={}){
 const view={scope:'a'.repeat(64),project:{id:'synthetic-project'},tasks:[{id:'synthetic-task'}]},account={scope:view.scope,officeReviewOnly:false};let options,reads=0;
 const sandbox={account,view,contextLocked,loading,planReadbackMatches,observationEpoch:1,activeSection:'cronograma',mounted:{current:true},generation:{current:1},DOMException,
  useRef:()=>({current:null}),useLayoutEffect:callback=>callback(),useWorksiteLiveRefresh:value=>{options=value;return{};},
  collectRetainedPages:async()=>{reads++;return {first:{data:view},rows:view.tasks,hasUnloaded:false};}};
 vm.runInNewContext(snippet+'\nglobalThis.captured=scheduleLiveContext.current;',sandbox,{timeout:1000});
 return {options,captured:sandbox.captured,view,reads:()=>reads};
}

test('generated live-pilot schedule prefix executes without an unbound blocked declaration',()=>{
 const rendered=render();assert.equal(rendered.options.blocked,false);assert.equal(rendered.captured.blocked,false);
});

test('generated pilot explicitly declares its synthetic loading and no-plan-readback state',()=>{
 for(const name of ['loading','planReadbackMatches']){const node=pageDeclaration(name).node;assert.equal(node.init.type,'BooleanLiteral');assert.equal(node.init.value,false);}
});

test('generated production callbacks pause for loading, context locks and receipt readback',async()=>{
 for(let mask=0;mask<8;mask++){
  const flags={contextLocked:Boolean(mask&1),loading:Boolean(mask&2),planReadbackMatches:Boolean(mask&4)},rendered=render(flags),blocked=mask!==0;
  assert.equal(rendered.options.blocked,blocked);assert.equal(rendered.captured.blocked,blocked);
  if(blocked){await assert.rejects(rendered.options.read(new AbortController().signal),{name:'AbortError'});assert.equal(rendered.reads(),0);}
  else{const value=await rendered.options.read(new AbortController().signal);assert.equal(rendered.reads(),1);assert.equal(value.captured.view,rendered.view);}
 }
});

test('copier keeps the production blocked-through-live source slice exact',()=>{
 const blocked=sourceDeclaration('scheduleLiveBlocked'),context=sourceDeclaration('scheduleLiveContext'),live=sourceDeclaration('scheduleLive');
 assert.ok(blocked.parent.start<context.parent.start);const exact=source.slice(blocked.parent.start,live.parent.end);
 assert.equal(proof.canonicalScheduleSnippetSha256,hash(exact));assert.ok(page.includes(exact));
});

test('pure fixture generation preserves every source byte and starts no runtime',()=>{
 for(const entry of sourceManifest)assert.equal(hash(readFileSync(path.join(root,entry.path))),entry.sha256);
 assert.equal(proof.accountWorkspaceMounted,false);assert.equal(proof.scheduleWorkbenchMounted,true);assert.equal(proof.taskCount,3);
});
