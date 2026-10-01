import assert from 'node:assert/strict';
import test from 'node:test';
import {workspaceSessionRequest} from '../src/app/(identity)/cuenta/workspace-session-request.mjs';

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
  }),error=>error.code==='SESSION_REQUIRED'&&error.status===401);
  assert.equal(sends,0);
});

test('an uncertain POST is sent once with its original operation and never retried',async()=>{
  const body=JSON.stringify({operationId:'original',scope:'original-scope'});
  const abort=new AbortController();
  let sends=0;
  await assert.rejects(workspaceSessionRequest('/api/identity/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body,signal:abort.signal}, {
    getSessionToken:async()=>'tab-token',fetchImpl:async(url,options)=>{
      sends++;
      assert.equal(options.body,body);assert.equal(options.signal,abort.signal);
      assert.equal(options.headers.get('content-type'),'application/json');
      throw new TypeError('lost confirmation');
    },
  }),/lost confirmation/);
  assert.equal(sends,1);
});

test('a hung SDK token request ends with a retryable error without sending a POST',async()=>{
  let sends=0;
  await assert.rejects(workspaceSessionRequest('/api/identity/workspace',{method:'POST'}, {
    getSessionToken:()=>new Promise(()=>{}),tokenTimeoutMs:10,fetchImpl:async()=>{sends++;},
  }),error=>error.code==='IDENTITY_PROVIDER_UNAVAILABLE'&&error.status===503);
  assert.equal(sends,0);
});

test('canceling a token wait prevents its late completion from sending an API request',async()=>{
  const controller=new AbortController();let finishToken,sends=0;
  const pending=workspaceSessionRequest('/api/identity/workspace',{signal:controller.signal},{
    getSessionToken:()=>new Promise(resolve=>{finishToken=resolve;}),fetchImpl:async()=>{sends++;},
  });
  await Promise.resolve();controller.abort();
  await assert.rejects(pending,error=>error.name==='AbortError');
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
