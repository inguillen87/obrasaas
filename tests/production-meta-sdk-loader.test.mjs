import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCustomerMetaSdk} from '../src/app/(identity)/cuenta/meta-sdk-loader.mjs';
const config={appId:'1234567890',version:'v25.0'};
function fixture(){
 const windowObject={},scripts=[],timers=new Map();let id=0;
 const documentObject={getElementById:name=>scripts.find(script=>script.id===name)||null,createElement:()=>({remove(){scripts.splice(scripts.indexOf(this),1);}}),body:{appendChild:script=>scripts.push(script)}};
 const runtime={windowObject,documentObject,schedule:callback=>{timers.set(++id,callback);return id;},unschedule:key=>timers.delete(key)};
 return {runtime,scripts,timers,windowObject,ready(){let initialized;windowObject.FB={init:value=>{initialized=value;},login:()=>{throw new Error('SDK loading must not authorize');}};windowObject.fbAsyncInit?.();return initialized;}};
}
test('SDK load error removes only its script and permits a fresh deliberate retry',async()=>{
 const f=fixture(),previous=()=>{};f.windowObject.fbAsyncInit=previous;
 const failed=loadCustomerMetaSdk(config,f.runtime);assert.equal(f.scripts.length,1);f.scripts[0].onerror();
 await assert.rejects(failed,/Reintentar acceso a Meta/);assert.equal(f.scripts.length,0);assert.equal(f.timers.size,0);assert.equal(f.windowObject.fbAsyncInit,previous);
 const retry=loadCustomerMetaSdk(config,f.runtime);assert.equal(f.scripts.length,1);
 assert.deepEqual(f.ready(),{...config,autoLogAppEvents:false,xfbml:false});await retry;assert.equal(f.timers.size,0);
});
test('SDK timeout settles, detaches its callback and ignores a late initialization',async()=>{
 const f=fixture(),failed=loadCustomerMetaSdk(config,f.runtime),late=f.windowObject.fbAsyncInit;
 f.timers.values().next().value();await assert.rejects(failed,/La preparación se conserva/);
 assert.equal(f.scripts.length,0);assert.equal(f.timers.size,0);assert.equal(f.windowObject.fbAsyncInit,undefined);
 let initialized=0;f.windowObject.FB={init:()=>initialized++,login:()=>{}};late();assert.equal(initialized,0);
 await loadCustomerMetaSdk(config,f.runtime);assert.equal(initialized,1);
});
test('Concurrent callers share one SDK load and initialize the declared app once',async()=>{
 const f=fixture(),first=loadCustomerMetaSdk(config,f.runtime),second=loadCustomerMetaSdk(config,f.runtime);
 assert.equal(first,second);assert.equal(f.scripts.length,1);f.ready();await first;
 assert.equal(loadCustomerMetaSdk(config,f.runtime),first);assert.equal(f.timers.size,0);
});
test('An existing SDK is initialized for this app; broken SDK initialization is recoverable',async()=>{
 const f=fixture();let initialized;f.windowObject.FB={init:value=>{initialized=value;},login:()=>{}};
 await loadCustomerMetaSdk(config,f.runtime);assert.equal(initialized.appId,config.appId);assert.equal(f.scripts.length,0);
 f.windowObject.FB.init=()=>{throw new Error('Controlled initialization failure');};
 await assert.rejects(loadCustomerMetaSdk({...config,version:'v24.0'},f.runtime),/Reintentar/);
 f.windowObject.FB.init=value=>{initialized=value;};await loadCustomerMetaSdk({...config,version:'v24.0'},f.runtime);assert.equal(initialized.version,'v24.0');
});
