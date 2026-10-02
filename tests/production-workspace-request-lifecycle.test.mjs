import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceRequestLifecycle} from '../src/app/(identity)/cuenta/workspace-request-lifecycle.mjs';

test('each leaf request uses the current tab token and consumes its correlated response',async()=>{
 let token='org-a',tokens=0;const calls=[];
 const lifecycle=createWorkspaceRequestLifecycle(async()=>{tokens++;return token;},{fetchImpl:async(url,options)=>{calls.push({url,options});return Response.json({scope:token});}});
 assert.deepEqual(await lifecycle.request('/read-a'),{scope:'org-a'});token='org-b';
 assert.deepEqual(await lifecycle.request('/read-b'),{scope:'org-b'});
 assert.equal(tokens,2);assert.deepEqual(calls.map(c=>c.options.headers.get('authorization')),['Bearer org-a','Bearer org-b']);
 assert.ok(calls.every(c=>c.options.credentials==='same-origin'&&c.options.cache==='no-store'));
 lifecycle.abort();
});

test('missing tab session never dispatches a command or creates an uncertain result',async()=>{
 let calls=0;const lifecycle=createWorkspaceRequestLifecycle(async()=>null,{fetchImpl:async()=>{calls++;}});
 await assert.rejects(lifecycle.request('/write',{method:'POST',body:'stable-attempt'}),error=>error.status===401&&error.requestDispatched===false);
 assert.equal(calls,0);lifecycle.abort();
});

test('unmount while waiting for a token blocks a late POST and further old-context requests',async()=>{
 let release,calls=0;const token=new Promise(resolve=>{release=resolve;});
 const lifecycle=createWorkspaceRequestLifecycle(()=>token,{fetchImpl:async()=>{calls++;return Response.json({saved:true});}});
 const pending=lifecycle.request('/write',{method:'POST',body:'stable-attempt'});lifecycle.abort();
 await assert.rejects(pending,error=>error.name==='AbortError'&&error.requestDispatched===false);
 release('late-token');await new Promise(resolve=>setImmediate(resolve));
 await assert.rejects(lifecycle.request('/old-context'),error=>error.requestDispatched===false);
 assert.equal(calls,0);
});

test('a dispatched command with lost confirmation is never retried by the lifecycle',async()=>{
 let calls=0;const body=JSON.stringify({operationId:'stable-operation',scope:'original-scope'});
 const lifecycle=createWorkspaceRequestLifecycle(async()=> 'active-tab',{fetchImpl:async(url,options)=>{calls++;assert.equal(options.body,body);throw new TypeError('Connection lost');}});
 await assert.rejects(lifecycle.request('/write',{method:'POST',body}),error=>error.requestDispatched===undefined);
 assert.equal(calls,1);lifecycle.abort();
});

test('the deadline includes an unresponsive response body and preserves dispatch uncertainty',async()=>{
 let calls=0;const lifecycle=createWorkspaceRequestLifecycle(async()=> 'active-tab',{fetchImpl:async()=>{calls++;return new Response('');}});
 await assert.rejects(lifecycle.request('/write',{method:'POST',requestTimeoutMs:20},()=>new Promise(()=>{})),error=>error.name==='AbortError'&&error.requestDispatched===undefined);
 assert.equal(calls,1);lifecycle.abort();
});

test('unmount during body consumption aborts delivery of a late old-context response',async()=>{
 let signal,release,start;const started=new Promise(resolve=>{start=resolve;});
 const lifecycle=createWorkspaceRequestLifecycle(async()=> 'active-tab',{fetchImpl:async(url,options)=>{signal=options.signal;return Response.json({projectId:'old-project'});}});
 const pending=lifecycle.request('/read',{},async response=>{start();await new Promise(resolve=>{release=resolve;});return response.json();});
 await started;lifecycle.abort();await assert.rejects(pending,error=>error.name==='AbortError');
 assert.equal(signal.aborted,true);release();
});

test('caller cancellation and HTTP status/code survive the lifecycle unchanged',async()=>{
 const lifecycle=createWorkspaceRequestLifecycle(async()=> 'active-tab',{fetchImpl:async()=>Response.json({code:'WORKSPACE_CONTEXT_CHANGED'},{status:409})});
 await assert.rejects(lifecycle.request('/read',{},async response=>{const result=await response.json();throw Object.assign(new Error('Refresh the workspace'),{status:response.status,code:result.code});}),error=>error.status===409&&error.code==='WORKSPACE_CONTEXT_CHANGED');
 const controller=new AbortController();controller.abort();
 await assert.rejects(lifecycle.request('/write',{method:'POST',signal:controller.signal}),error=>error.requestDispatched===false);
 lifecycle.abort();
});

test('private binary consumption preserves bytes and multipart commands keep their browser boundary',async()=>{
 const file=new Blob(['controlled-private-file'],{type:'image/png'}),form=new FormData();form.append('file',file,'private.png');form.append('operationId','same-operation');
 const lifecycle=createWorkspaceRequestLifecycle(async()=> 'active-tab',{fetchImpl:async(url,options)=>{assert.equal(options.body,form);assert.equal(options.headers.has('content-type'),false);assert.equal(options.headers.get('authorization'),'Bearer active-tab');return new Response(file);}});
 const result=await lifecycle.request('/media',{method:'POST',body:form},async response=>(await response.blob()).arrayBuffer());
 assert.equal(Buffer.from(result).toString(),'controlled-private-file');lifecycle.abort();
});

test('deadlines remain bounded without shortening existing 45–60 second provider operations',async()=>{
 let calls=0;const lifecycle=createWorkspaceRequestLifecycle(async()=> 'active-tab',{fetchImpl:async()=>{calls++;return Response.json({saved:true});}});
 await assert.rejects(lifecycle.request('/invalid',{requestTimeoutMs:60001}),TypeError);assert.equal(calls,0);
 assert.deepEqual(await lifecycle.request('/provider',{requestTimeoutMs:60000}),{saved:true});assert.equal(calls,1);lifecycle.abort();
});

for(const phase of ['settle','observe'])test(`cancellation during awaited ${phase} preserves confirmation without delivering an old-context result`,async()=>{
 let release,start,calls=0,delivered=false,confirmed=false,cleanupErrors=0;
 const started=new Promise(resolve=>{start=resolve;}),blocked=new Promise(resolve=>{release=resolve;});
 const controller=new AbortController(),ticket={id:'original-reference'};
 const journal={prepare:async()=>ticket,settle:async(current,result,error)=>{
  assert.equal(current,ticket);
  if(error){assert.equal(error.name,'AbortError');cleanupErrors++;return;}
  assert.deepEqual(result,{saved:true,projectId:'old-project'});
  if(phase==='settle'){start();await blocked;}
  confirmed=true;
 },observe:async()=>{if(phase==='observe'){start();await blocked;}}};
 const lifecycle=createWorkspaceRequestLifecycle(async()=> 'active-tab',{journal,fetchImpl:async()=>{calls++;return Response.json({saved:true,projectId:'old-project'});}});
 const pending=lifecycle.request('/write',{method:'POST',signal:controller.signal}).then(result=>{delivered=true;return result;});
 await started;
 if(phase==='settle')lifecycle.abort();else controller.abort();
 release();
 await assert.rejects(pending,error=>error.name==='AbortError'&&error.requestDispatched===undefined);
 assert.equal(delivered,false);assert.equal(confirmed,true);assert.equal(cleanupErrors,1);assert.equal(calls,1);
 lifecycle.abort();
});
