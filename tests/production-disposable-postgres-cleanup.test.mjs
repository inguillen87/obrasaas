import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {trackDisposablePool,closeDisposablePool} from '../scripts/lib/disposable-postgres-cleanup.mjs';

test('database cleanup waits for every socket after pool end resolves',async()=>{
 const pool=new EventEmitter(),first=new EventEmitter(),second=new EventEmitter();
 let endCalls=0,closed=false;
 pool.end=async()=>{endCalls++;};
 trackDisposablePool(pool);pool.emit('connect',first);pool.emit('connect',second);
 const closing=closeDisposablePool(pool).then(()=>{closed=true;});
 await new Promise(setImmediate);assert.equal(endCalls,1);assert.equal(closed,false);
 first.emit('end');await new Promise(setImmediate);assert.equal(closed,false);
 second.emit('end');await closing;assert.equal(closed,true);
});

test('already closed connections and an unused pool finish without forced termination',async()=>{
 const pool=new EventEmitter(),client=new EventEmitter();pool.end=async()=>{};
 trackDisposablePool(pool);pool.emit('connect',client);client.emit('end');await closeDisposablePool(pool);
 const unused=new EventEmitter();unused.end=async()=>{};await closeDisposablePool(trackDisposablePool(unused));
 await closeDisposablePool(undefined);
});

test('unexpected pool errors propagate unchanged and untracked pools are rejected',async()=>{
 const failure=new Error('Synthetic unexpected shutdown error'),pool=new EventEmitter();pool.end=async()=>{throw failure;};
 await assert.rejects(closeDisposablePool(trackDisposablePool(pool)),error=>error===failure);
 await assert.rejects(closeDisposablePool(new EventEmitter()),TypeError);
});
