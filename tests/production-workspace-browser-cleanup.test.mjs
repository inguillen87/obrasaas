import assert from 'node:assert/strict';
import test from 'node:test';
import {EventEmitter} from 'node:events';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {parse} from '@babel/parser';

// Execute the actual cleanup functions against owned synthetic handles and a
// controlled filesystem. No process is spawned or signalled by these tests.
const scripts=['verify-workspace-ui.mjs','verify-workspace-plan-recovery-ui.mjs'];
function fixture(script,options={}){
 const source=readFileSync(new URL('../scripts/'+script,import.meta.url),'utf8'),ast=parse(source,{sourceType:'module',plugins:['jsx']});
 const functions=['ownedAlive','ownedClosed','terminateOwned','stopOwnedBrowser','stopHarnessServer','removeOwnedFixture','cleanupHarness'];
 const code=functions.map(name=>{const node=ast.program.body.find(node=>node.type==='FunctionDeclaration'&&node.id.name===name);assert.ok(node);return source.slice(node.start,node.end);}).join('\n');
 const root=path.resolve('synthetic-owned-root'),parent=path.join(root,'.vercel',...(script.includes('plan-recovery')?['private']:[])),fixture=path.join(parent,'owned-fixture');
 const server=Object.assign(new EventEmitter(),{pid:101,exitCode:null,signalCode:null,stdio:[{destroyed:false}],spawnargs:['node',fixture]});
 const child=Object.assign(new EventEmitter(),{pid:102,exitCode:null,signalCode:null,stdio:[{destroyed:false}],kill:signal=>{signals.push({pid:102,signal});return true;}});
 const signals=[],removed=[],records=[],spawns=[];let exists=true,releaseBrowser;
 const browser=options.browser?{process:()=>child,close:()=>new Promise(resolve=>{releaseBrowser=resolve;}),disconnect:()=>{}}:undefined;
 const deps={assert,path,root,evidence:parent,fixture,server,browser,primaryFailure:options.primaryFailure,
  bounded:(promise,label)=>options.timeout&&label==='OWNED_NEXT_CLOSE_TIMEOUT'?Promise.reject(Error(label)):promise,
  process:{platform:options.platform||'linux',kill:(pid,signal)=>{signals.push({pid,signal});if(options.timeout&&signal==='SIGKILL')server.emit('close');}},
  spawnSync:(file,args,settings)=>{assert.equal(options.platform,'win32','No external process permitted');spawns.push({file,args,settings});return{status:0};},
  lstatSync:file=>({isSymbolicLink:()=>options.symlink===file}),realpathSync:file=>options.foreignRealpath&&file===fixture?path.resolve('foreign-fixture'):file,
  rmSync:(file,settings)=>{removed.push({file,settings});exists=false;},existsSync:()=>exists,writeFileSync:(_file,text)=>records.push(JSON.parse(text))};
 const build=Function('deps',`const {${Object.keys(deps).join(',')}}=deps;let serverDrained=false;const serverClosed=new Promise(resolve=>server.once('close',()=>{serverDrained=true;resolve();}));${code}\nreturn {stopHarnessServer,stopOwnedBrowser,removeOwnedFixture,cleanupHarness};`)(deps);
 return{...build,server,child,parent,fixture,signals,removed,records,spawns,releaseBrowser:()=>releaseBrowser(),drain:handle=>{handle.exitCode=0;handle.stdio.forEach(stream=>{stream.destroyed=true;});handle.emit('close');}};
}

for(const script of scripts){
 test(script+' waits for server close/drain rather than only exit or an elapsed sleep',async()=>{
  const f=fixture(script);let done=false;const closing=f.stopHarnessServer().then(()=>{done=true;});await new Promise(setImmediate);
  assert.deepEqual(f.signals,[{pid:-101,signal:'SIGTERM'}]);f.server.exitCode=0;await new Promise(setImmediate);assert.equal(done,false);assert.equal(f.removed.length,0);
  f.drain(f.server);await closing;assert.equal(done,true);await f.stopHarnessServer();assert.equal(f.signals.length,1);
 });
 test(script+' bounds Windows tree termination to the owned server PID',async()=>{
  const f=fixture(script,{platform:'win32'});let done=false;const closing=f.stopHarnessServer().then(()=>{done=true;});await new Promise(setImmediate);
  assert.deepEqual(f.spawns,[{file:'taskkill.exe',args:['/PID','101','/T','/F'],settings:{stdio:'ignore',windowsHide:true,timeout:10000}}]);assert.ok(f.signals.every(signal=>signal.pid===101&&signal.signal===0));assert.equal(done,false);f.drain(f.server);await closing;assert.equal(done,true);
 });
 test(script+' waits for the owned browser handle to drain after browser.close resolves',async()=>{
  const f=fixture(script,{browser:true});let done=false;const closing=f.stopOwnedBrowser().then(()=>{done=true;});f.releaseBrowser();await new Promise(setImmediate);assert.equal(done,false);assert.ok(f.signals.every(signal=>signal.pid===102));f.drain(f.child);await closing;assert.equal(done,true);
 });
 test(script+' removes only an absolute unreparsed fixture under its exact real parent',()=>{
  const f=fixture(script);f.removeOwnedFixture();assert.deepEqual(f.removed,[{file:f.fixture,settings:{recursive:true,force:true}}]);
  for(const options of [{symlink:f.parent},{symlink:f.fixture},{foreignRealpath:true}]){const unsafe=fixture(script,options);assert.throws(()=>unsafe.removeOwnedFixture());assert.deepEqual(unsafe.removed,[]);}
 });
 test(script+' preserves the primary failure and refuses fixture removal after a close timeout',async()=>{
  const primaryFailure=Error('Original assertion retained'),f=fixture(script,{timeout:true,primaryFailure});
  await assert.rejects(f.cleanupHarness(),error=>error instanceof AggregateError&&error.errors[0]===primaryFailure&&error.errors.some(error=>error.message==='OWNED_NEXT_CLOSE_TIMEOUT'));
  assert.deepEqual(f.removed,[]);assert.deepEqual(f.signals,[{pid:-101,signal:'SIGTERM'},{pid:-101,signal:'SIGKILL'}]);assert.equal(f.records[0].processesClosed,false);assert.equal(f.records[0].fixtureRemoved,false);assert.equal(f.records[0].primaryFailure,primaryFailure.message);
 });
}
