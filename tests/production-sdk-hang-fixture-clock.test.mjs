import assert from 'node:assert/strict';
import test from 'node:test';
import {runInNewContext} from 'node:vm';
import {installSdkHangFixtureClock} from '../scripts/lib/sdk-hang-fixture-clock.mjs';
import {createWorkspaceRequestLifecycle} from '../src/app/(identity)/cuenta/workspace-request-lifecycle.mjs';

const nativeTimeout = globalThis.setTimeout;
const wait = ms => new Promise(resolve => nativeTimeout(resolve,ms));
const endpoint = '/api/identity/constructor-crm?scope=synthetic&projectId=synthetic';
async function withFixture(mode, fetchImpl, run) {
  const surface = {performance,setTimeout:nativeTimeout,fetch:fetchImpl};
  runInNewContext(`(${installSdkHangFixtureClock.toString()})(${JSON.stringify({mode})})`,{window:surface});
  globalThis.setTimeout = surface.setTimeout;
  try { await run(surface); }
  finally { globalThis.setTimeout = nativeTimeout; }
}
const rejectHttp = async response => {
  const body = await response.json();
  if (!response.ok) throw Object.assign(new Error('Controlled denial'),{status:response.status,code:body.code});
  return body;
};

for (const [mode,status,code] of [['search-denied',403,'WORKSPACE_CONTEXT_CHANGED'],['search-session-expired',401,'SESSION_REQUIRED']]) {
  test(`ordinary ${status} delayed beyond the old 180 ms clock reaches the real lifecycle with its status`,async () => {
    let calls = 0;
    await withFixture(mode,async () => {calls++;await wait(250);return Response.json({code},{status});},async surface => {
      const lifecycle = createWorkspaceRequestLifecycle(async () => 'synthetic-token',{fetchImpl:surface.fetch});
      try {
        await assert.rejects(lifecycle.request(endpoint,{requestTimeoutMs:15000},rejectHttp),error => error.status === status && error.code === code);
        assert.equal(calls,1);
        const events = surface.__fixtureRequestTimeline;
        assert.equal(events.filter(event => event.type === 'fetch-response' && event.status === status).length,1);
        assert.equal(events.some(event => event.type === 'fetch-aborted'),false);
        assert.ok(events.filter(event => event.type === 'timer-scheduled').every(event => event.effective === event.delay));
      } finally { lifecycle.abort(); }
    });
  });
}

test('initial and unrelated GET deadlines in the sdk-hang scenario stay natural while only an actual token wait can be accelerated',async () => {
  await withFixture('sdk-hang',async () => {await wait(250);return Response.json({scope:'synthetic'});},async surface => {
    const lifecycle = createWorkspaceRequestLifecycle(async () => 'synthetic-token',{fetchImpl:surface.fetch});
    try {
      assert.deepEqual(await lifecycle.request(endpoint,{requestTimeoutMs:15000}),{scope:'synthetic'});
      assert.ok(surface.__fixtureRequestTimeline.filter(event => event.type === 'timer-scheduled').every(event => event.effective === event.delay));
      surface.__tokenMode = 'hang';
      const pending = lifecycle.request(endpoint,{requestTimeoutMs:15000});
      await wait(200);
      assert.ok(surface.__fixtureRequestTimeline.filter(event => event.type === 'timer-scheduled' && event.delay === 15000 && !event.accelerated).length >= 3,'An unrelated GET lifecycle deadline stays natural even while the fixture holds another SDK token');
      assert.deepEqual(await pending,{scope:'synthetic'});
    } finally { lifecycle.abort(); }
  });
});

test('only the deliberately held SDK token is accelerated and its unsent POST retains the natural 20 second deadline',async () => {
  let calls = 0;
  await withFixture('sdk-hang',async () => {calls++;},async surface => {
    surface.__tokenMode = 'hang';
    const lifecycle = createWorkspaceRequestLifecycle(() => new Promise(() => {}),{fetchImpl:surface.fetch});
    try {
      await assert.rejects(lifecycle.request(endpoint,{method:'POST'}),error => error.code === 'IDENTITY_PROVIDER_UNAVAILABLE' && error.requestDispatched === false);
      assert.equal(calls,0);
      const timers = surface.__fixtureRequestTimeline.filter(event => event.type === 'timer-scheduled');
      assert.ok(timers.some(event => event.delay === 15000 && event.effective === 180));
      assert.ok(timers.some(event => event.delay === 20000 && event.effective === 20000));
    } finally { lifecycle.abort(); }
  });
});

test('identity cancellation remains explicit after 250 ms and a late token cannot dispatch the old POST',async () => {
  let release, calls = 0;
  await withFixture('identity-cancel',async () => {calls++;return Response.json({saved:true});},async surface => {
    surface.__tokenMode = 'hang';
    const lifecycle = createWorkspaceRequestLifecycle(() => new Promise(resolve => {release=resolve;}),{fetchImpl:surface.fetch});
    let settled = false;
    const pending = lifecycle.request(endpoint,{method:'POST'}).finally(() => {settled=true;});
    await wait(250);
    assert.equal(settled,false,'The fixture must not substitute a timeout for explicit identity cancellation');
    lifecycle.abort();
    await assert.rejects(pending,error => error.name === 'AbortError' && error.requestDispatched === false);
    release('late-synthetic-token');await wait(0);
    assert.equal(calls,0);
    assert.ok(surface.__fixtureRequestTimeline.filter(event => event.type === 'timer-scheduled').every(event => event.effective === event.delay));
  });
});

test('an ordinary provider POST keeps its natural 55 second deadline and is not retried by the timed fixture',async () => {
  let calls = 0;
  await withFixture('saved',async (url,options) => {calls++;assert.equal(options.method,'POST');await wait(250);return Response.json({saved:true});},async surface => {
    const lifecycle = createWorkspaceRequestLifecycle(async () => 'synthetic-token',{fetchImpl:surface.fetch});
    try {
      assert.deepEqual(await lifecycle.request(endpoint,{method:'POST',body:'synthetic-command',requestTimeoutMs:55000}),{saved:true});
      assert.equal(calls,1);
      assert.ok(surface.__fixtureRequestTimeline.some(event => event.type === 'timer-scheduled' && event.delay === 55000 && event.effective === 55000));
    } finally { lifecycle.abort(); }
  });
});

test('the timeline records a real caller abort before the fetch error while preserving the original error and no retry',async () => {
  let started, calls = 0;
  const ready = new Promise(resolve => {started=resolve;});
  await withFixture('search-identity-cancel',async (url,{signal}) => {
    calls++;started();return new Promise((resolve,reject) => signal.addEventListener('abort',() => reject(signal.reason),{once:true}));
  },async surface => {
    const controller = new AbortController();
    const lifecycle = createWorkspaceRequestLifecycle(async () => 'synthetic-token',{fetchImpl:surface.fetch});
    try {
      const pending = lifecycle.request(endpoint,{signal:controller.signal,requestTimeoutMs:15000});
      await ready;controller.abort();
      await assert.rejects(pending,error => error.name === 'AbortError' && error.requestDispatched === undefined);
      const events = surface.__fixtureRequestTimeline.filter(event => event.type.startsWith('fetch-'));
      assert.deepEqual(Array.from(events,event => event.type),['fetch-start','fetch-aborted','fetch-error']);
      assert.equal(new Set(events.map(event => event.requestId)).size,1);
      assert.equal(calls,1);
    } finally { lifecycle.abort(); }
  });
});
