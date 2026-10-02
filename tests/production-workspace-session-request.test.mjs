import assert from 'node:assert/strict';
import test from 'node:test';
import {workspaceActiveToken,workspaceSessionRequest} from '../src/app/(identity)/cuenta/workspace-session-request.mjs';

test('workspace requests use the active tab token rather than a competing organization cookie',async()=>{
  let tokenReads=0;
  const seen=[];
  const getSessionToken=async()=>++tokenReads===1?'tab-A-first':'tab-A-refreshed';
  const fetchImpl=async(url,options)=>{seen.push({url,options});return new Response('{}');};
  await workspaceSessionRequest('/api/identity/workspace',{}, {getSessionToken,fetchImpl});
  await workspaceSessionRequest('/api/identity/workspace?projectId=one',{}, {getSessionToken,fetchImpl});
  assert.deepEqual(seen.map(value=>value.options.headers.get('authorization')),['Bearer tab-A-first','Bearer tab-A-refreshed']);
  assert.ok(seen.every(value=>value.options.cache==='no-store'&&value.options.credentials==='same-origin'));
});

test('missing active session does not fall back to cookies or send a mutation',async()=>{
  let sends=0;
  await assert.rejects(workspaceSessionRequest('/api/identity/workspace',{method:'POST'}, {
    getSessionToken:async()=>null,fetchImpl:async()=>{sends++;},
  }),error=>error.code==='SESSION_REQUIRED'&&error.status===401&&error.requestDispatched===false);
  assert.equal(sends,0);
  await assert.rejects(workspaceSessionRequest('/api/identity/workspace',{method:'POST'}, {fetchImpl:async()=>{sends++;}}),error=>error.code==='SESSION_REQUIRED'&&error.requestDispatched===false);
  assert.equal(sends,0);
});

test('an uncertain POST is sent once with its original operation and never retried',async()=>{
  const body=JSON.stringify({operationId:'original',scope:'original-scope'});
  const abort=new AbortController();
  let sends=0;
  await assert.rejects(workspaceSessionRequest('/api/identity/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body,signal:abort.signal}, {
    getSessionToken:async()=>'tab-token',fetchImpl:async(url,options)=>{
      sends++;
      assert.equal(options.body,body);assert.equal(options.signal.aborted,false);
      assert.equal(options.headers.get('content-type'),'application/json');
      throw new TypeError('lost confirmation');
    },
  }),error=>error.message==='lost confirmation'&&error.requestDispatched===undefined);
  assert.equal(sends,1);
});

test('a hung SDK token request ends with a retryable error without sending a POST',async()=>{
  let sends=0;
  await assert.rejects(workspaceSessionRequest('/api/identity/workspace',{method:'POST'}, {
    getSessionToken:()=>new Promise(()=>{}),tokenTimeoutMs:10,fetchImpl:async()=>{sends++;},
  }),error=>error.code==='IDENTITY_PROVIDER_UNAVAILABLE'&&error.status===503&&error.requestDispatched===false);
  assert.equal(sends,0);
});

test('canceling a token wait prevents its late completion from sending an API request',async()=>{
  const controller=new AbortController();let finishToken,sends=0;
  const pending=workspaceSessionRequest('/api/identity/workspace',{signal:controller.signal},{
    getSessionToken:()=>new Promise(resolve=>{finishToken=resolve;}),fetchImpl:async()=>{sends++;},
  });
  await Promise.resolve();controller.abort();
  await assert.rejects(pending,error=>error.name==='AbortError'&&error.requestDispatched===false);
  finishToken('late-token');await new Promise(resolve=>setImmediate(resolve));
  assert.equal(sends,0);
});

test('SDK diagnostics are sanitized and an already canceled request never calls the SDK',async()=>{
  await assert.rejects(workspaceSessionRequest('/api/identity/workspace',{}, {
    getSessionToken:async()=>{throw new Error('private diagnostic with token');},
  }),error=>error.code==='IDENTITY_PROVIDER_UNAVAILABLE'&&!error.message.includes('diagnostic'));
  let reads=0;const controller=new AbortController();controller.abort();
  await assert.rejects(workspaceSessionRequest('/api/identity/workspace',{signal:controller.signal},{
    getSessionToken:async()=>{reads++;return 'never';},
  }),error=>error.name==='AbortError');
  assert.equal(reads,0);
});

test('the profile token wait shares the bounded SDK contract without exposing provider diagnostics',async()=>{
  await assert.rejects(workspaceActiveToken(()=>new Promise(()=>{}),{tokenTimeoutMs:10}),error=>error.code==='IDENTITY_PROVIDER_UNAVAILABLE'&&error.requestDispatched===false);
  const controller=new AbortController();let resolveToken;
  const pending=workspaceActiveToken(()=>new Promise(resolve=>{resolveToken=resolve;}),{signal:controller.signal});
  await Promise.resolve();controller.abort();
  await assert.rejects(pending,error=>error.name==='AbortError'&&error.requestDispatched===false);
  resolveToken('late-profile');
  await assert.rejects(workspaceActiveToken(async()=>{throw new Error('private-profile-token');}),error=>!error.message.includes('private-profile-token')&&error.requestDispatched===false);
});

test('a deadline after dispatch remains uncertain and is never classified as an unsent operation',async()=>{
  let sends=0;
  const pending=workspaceSessionRequest('/api/identity/workspace',{method:'POST'},{
    getSessionToken:async()=>'active',requestTimeoutMs:10,
    fetchImpl:async(url,{signal})=>{sends++;return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));},
  });
  // AbortSignal.timeout does not keep Node alive. This handle represents a browser's running event loop.
  const keepAlive=setTimeout(()=>{},100);
  try{await assert.rejects(pending,error=>error.name==='TimeoutError'&&error.requestDispatched===undefined);}finally{clearTimeout(keepAlive);}
  assert.equal(sends,1);
});

test('canceling after dispatch reaches fetch and keeps receipt recovery required',async()=>{
  const controller=new AbortController();let dispatched;
  const started=new Promise(resolve=>{dispatched=resolve;});let sends=0;
  const pending=workspaceSessionRequest('/api/identity/workspace',{method:'POST',signal:controller.signal},{
    getSessionToken:async()=>'active',fetchImpl:async(url,{signal})=>{
      sends++;dispatched();return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));
    },
  });
  await started;controller.abort();
  await assert.rejects(pending,error=>error.name==='AbortError'&&error.requestDispatched===undefined);
  assert.equal(sends,1);
});
