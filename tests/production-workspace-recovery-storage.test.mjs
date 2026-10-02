import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserRecoveryStorage } from '../src/app/(identity)/cuenta/workspace-recovery-storage.mjs';

const prefix = 'obrasaas.pending-receipt.v1.', scope = 'a'.repeat(64);
const key = prefix + scope + '.workspace.11111111-1111-4111-8111-111111111111';
const raw = JSON.stringify({ version: 1, scope, resource: 'workspace', projectId: 'project-a', operationId: '11111111-1111-4111-8111-111111111111', createdAt: 1 });
const validateStored = (key, value) => { assert.ok(key.startsWith(prefix + scope + '.')); return JSON.parse(value); };
const unavailable = error => error.code === 'WORKSPACE_RECOVERY_STORAGE_UNAVAILABLE' && error.requestDispatched === false && error.status === 409;
const tick = () => new Promise(resolve => setImmediate(resolve));

// A fault adapter for IDB event ordering only, not a database emulator. Browser
// acceptance exercises actual atomic storage, migration and cross-tab records.
function events({ keyPath = 'key', autoIncrement = false, indexes = [], stored, putFailure, abortAfterCommit = false, timeoutMs = 1000 } = {}) {
  const state = { opens: 0, closes: 0, aborts: 0, puts: [], deletes: [], committed: false };
  const markerRequest = {}, cursorRequest = {};
  const tx = {
    objectStore(name) {
      if (name === 'migrations') return { keyPath: 'scope', autoIncrement: false, indexNames: [], get: () => markerRequest, put: value => state.puts.push(value) };
      return { keyPath, autoIncrement, indexNames: indexes, openCursor: () => cursorRequest, put: value => { if (putFailure) throw putFailure; state.puts.push(value); }, delete: value => state.deletes.push(value) };
    },
    abort() {
      state.aborts++;
      if (abortAfterCommit && state.committed) throw new DOMException('already finished', 'InvalidStateError');
      queueMicrotask(() => tx.onabort?.());
    },
  };
  const db = { version: 1, objectStoreNames: ['references', 'migrations'], close: () => state.closes++, transaction() {
    queueMicrotask(() => {
      markerRequest.result = { scope, version: 1 }; markerRequest.onsuccess?.();
      cursorRequest.result = stored ? { key, value: stored, continue: () => { cursorRequest.result = null; queueMicrotask(() => cursorRequest.onsuccess?.()); } } : null;
      cursorRequest.onsuccess?.();
    });
    return tx;
  } };
  const request = { result: db };
  const indexedDB = { open() { state.opens++; queueMicrotask(() => request.onsuccess?.()); return request; } };
  const withStorage = createBrowserRecoveryStorage({ prefix, validateStored, getIndexedDB: () => indexedDB, getKeyRange: () => ({ bound: () => ({}) }), timeoutMs });
  return { state, tx, request, db, withStorage, complete() { state.committed = true; tx.oncomplete?.(); } };
}

test('missing or rejected IDB access fails before the journal callback without exposing provider diagnostics', async () => {
  for (const getIndexedDB of [() => undefined, () => ({ open() { throw new Error('private diagnostic must not leak'); } })]) {
    let callbacks = 0;
    const storage = createBrowserRecoveryStorage({ prefix, validateStored, getIndexedDB });
    await assert.rejects(storage('readwrite', scope, () => callbacks++), error => unavailable(error) && !error.message.includes('private diagnostic'));
    assert.equal(callbacks, 0);
  }
});

test('a pre-aborted request never opens storage', async () => {
  const fixture = events(), controller = new AbortController(); controller.abort();
  await assert.rejects(fixture.withStorage('readwrite', scope, () => {}, controller.signal), error => error.name === 'AbortError' && error.requestDispatched === false);
  assert.equal(fixture.state.opens, 0);
});

test('a blocked open is bounded and a late upgrade cannot initialize or erase storage', async () => {
  const request = { transaction: { aborts: 0, abort() { this.aborts++; } }, result: { objectStoreNames: [], createObjectStore() { throw new Error('must not create'); } } };
  let callbacks = 0;
  const storage = createBrowserRecoveryStorage({ prefix, validateStored, getIndexedDB: () => ({ open: () => request }), timeoutMs: 10 });
  await assert.rejects(storage('readwrite', scope, () => callbacks++), unavailable);
  request.onupgradeneeded({ oldVersion: 0 });
  assert.ok(request.transaction.aborts >= 1); assert.equal(callbacks, 0);
});

test('unexpected schema is rejected without a callback or schema repair', async () => {
  for (const schema of [{ keyPath: 'other' }, { autoIncrement: true }, { indexes: ['unexpected-index'] }]) {
    const fixture = events(schema); let callbacks = 0;
    await assert.rejects(fixture.withStorage('readwrite', scope, () => callbacks++), unavailable);
    assert.equal(callbacks, 0); assert.equal(fixture.state.aborts, 1); assert.deepEqual(fixture.state.puts, []);
  }
  const fixture = events(); fixture.db.objectStoreNames.push('unexpected-store');
  await assert.rejects(fixture.withStorage('readwrite', scope, () => {}), unavailable);
  assert.equal(fixture.state.aborts, 0); assert.equal(fixture.state.closes, 1);
});

test('a reservation is not exposed before the transaction completes', async () => {
  const fixture = events(); let resolved = false;
  const pending = fixture.withStorage('readwrite', scope, storage => { storage.setItem(key, raw); return { ticket: 'reserved' }; }).then(value => { resolved = true; return value; });
  await tick(); assert.equal(resolved, false); assert.deepEqual(fixture.state.puts, [{ key, value: raw }]);
  fixture.complete(); assert.deepEqual(await pending, { ticket: 'reserved' }); assert.equal(fixture.state.closes, 1);
});

test('a transaction without confirmation reaches its deadline and never returns the reservation', async () => {
  const fixture = events({ timeoutMs: 10 });
  await assert.rejects(fixture.withStorage('readwrite', scope, storage => { storage.setItem(key, raw); return 'unconfirmed-ticket'; }), unavailable);
  assert.equal(fixture.state.aborts, 1); assert.equal(fixture.state.closes, 1);
});

test('abort before completion rejects the reservation instead of acknowledging request success', async () => {
  const fixture = events(), controller = new AbortController();
  const pending = fixture.withStorage('readwrite', scope, storage => { storage.setItem(key, raw); return 'ticket'; }, controller.signal);
  await tick(); controller.abort();
  await assert.rejects(pending, error => error.name === 'AbortError' && error.requestDispatched === false);
  assert.equal(fixture.state.aborts, 1);
});

test('cancellation inside the synchronous callback preserves AbortError and queues no write', async () => {
  const fixture = events(), controller = new AbortController();
  await assert.rejects(fixture.withStorage('readwrite', scope, storage => { storage.setItem(key, raw); controller.abort(); return 'cancelled-ticket'; }, controller.signal), error => error.name === 'AbortError' && error.requestDispatched === false);
  assert.deepEqual(fixture.state.puts, []);
});

test('cancel after a commit but before complete preserves the committed ticket', async () => {
  const fixture = events({ abortAfterCommit: true }), controller = new AbortController();
  const pending = fixture.withStorage('readwrite', scope, storage => { storage.setItem(key, raw); return 'committed-ticket'; }, controller.signal);
  await tick(); fixture.state.committed = true; controller.abort(); fixture.complete();
  assert.equal(await pending, 'committed-ticket');
});

test('quota failure and corrupted stored values never expose a successful reservation', async () => {
  const quota = events({ putFailure: new DOMException('private quota detail', 'QuotaExceededError') });
  await assert.rejects(quota.withStorage('readwrite', scope, storage => { storage.setItem(key, raw); return 'ticket'; }), error => unavailable(error) && !error.message.includes('private quota detail'));
  assert.equal(quota.state.aborts, 1);
  const corrupt = events({ stored: { key, value: 'not-json-private-data' } }); let callbacks = 0;
  await assert.rejects(corrupt.withStorage('readonly', scope, () => callbacks++), error => unavailable(error) && !error.message.includes('not-json-private-data'));
  assert.equal(callbacks, 0); assert.deepEqual(corrupt.state.puts, []);
});

test('callbacks must stay synchronous and scoped, and readonly views cannot write', async () => {
  for (const [mode, callback] of [
    ['readwrite', () => Promise.resolve('late-ticket')],
    ['readwrite', storage => storage.setItem(prefix + 'b'.repeat(64) + '.workspace.id', raw)],
    ['readonly', storage => storage.setItem(key, raw)],
  ]) {
    const fixture = events();
    await assert.rejects(fixture.withStorage(mode, scope, callback), unavailable);
    assert.deepEqual(fixture.state.puts, []); assert.equal(fixture.state.aborts, 1);
  }
});
