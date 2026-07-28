import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CLERK_IDENTITY_ADVISORY_LOCK_ID,
  CLERK_IDENTITY_TRANSACTION_OPTIONS,
  CLERK_RUNTIME_IDENTITY_LOCK_NAMESPACE,
  acquireClerkIdentityCutoverLock,
  canUseClerkIdentitySyncLock,
  clerkIdentityRuntimeLockKeys,
  isClerkIdentityTransaction,
  withClerkIdentitySyncLock,
} from '../src/lib/clerk-identity-lock.js';

function deferred() {
  let resolve;
  const promise = new Promise((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

test('runtime identity sync takes a shared transaction lock', async () => {
  const calls = [];
  const transaction = {
    async $transaction() {
      throw new Error('marked identity transactions must never be nested');
    },
    async $queryRawUnsafe(query, lockId) {
      calls.push(['lock', query, lockId]);
    },
  };
  const database = {
    async $queryRawUnsafe() {},
    async $transaction(callback, options) {
      calls.push(['transaction', options]);
      return callback(transaction);
    },
  };

  const result = await withClerkIdentitySyncLock(database, async (locked) => {
    assert.equal(isClerkIdentityTransaction(locked), true);
    assert.equal(canUseClerkIdentitySyncLock(locked), false);
    calls.push(['callback', locked]);
    return 'ok';
  });

  assert.equal(result, 'ok');
  assert.deepEqual(calls.map(([name]) => name), ['transaction', 'lock', 'callback']);
  assert.deepEqual(calls[0][1], CLERK_IDENTITY_TRANSACTION_OPTIONS);
  assert.equal(calls[0][1].timeout, 30_000);
  assert.match(calls[1][1], /lock_shared/);
  assert.equal(calls[1][2], CLERK_IDENTITY_ADVISORY_LOCK_ID);
});

test('cutover requires and takes the exclusive advisory lock', async () => {
  const calls = [];
  await acquireClerkIdentityCutoverLock({
    async $queryRawUnsafe(query, lockId) {
      calls.push([query, lockId]);
    },
  });
  assert.match(calls[0][0], /pg_advisory_xact_lock\(/);
  assert.doesNotMatch(calls[0][0], /lock_shared/);
  assert.equal(calls[0][1], CLERK_IDENTITY_ADVISORY_LOCK_ID);
  await assert.rejects(
    () => acquireClerkIdentityCutoverLock({}),
    /requires PostgreSQL advisory lock support/,
  );
});

test('runtime identity locks serialize the same Clerk identity after the global shared lock', async () => {
  const held = new Set();
  const waiters = new Map();
  const contentionObserved = deferred();
  const acquire = async (key, transaction) => {
    if (!held.has(key)) {
      held.add(key);
      transaction.acquired.push(key);
      return;
    }
    contentionObserved.resolve();
    await new Promise((resolve) => {
      const queue = waiters.get(key) || [];
      queue.push(resolve);
      waiters.set(key, queue);
    });
    transaction.acquired.push(key);
  };
  const release = (key) => {
    const queue = waiters.get(key);
    const next = queue?.shift();
    if (queue?.length === 0) waiters.delete(key);
    if (next) next();
    else held.delete(key);
  };
  const database = {
    async $queryRawUnsafe() {},
    async $transaction(callback) {
      const transaction = {
        acquired: [],
        async $queryRawUnsafe(query, namespace, identityKey) {
          if (query.includes('pg_advisory_xact_lock_shared')) return [{ locked: 1 }];
          assert.equal(namespace, CLERK_RUNTIME_IDENTITY_LOCK_NAMESPACE);
          await acquire(identityKey, transaction);
          return [{ locked: 1 }];
        },
      };
      try {
        return await callback(transaction);
      } finally {
        for (const key of transaction.acquired.reverse()) release(key);
      }
    },
  };
  const identityKeys = clerkIdentityRuntimeLockKeys({
    clerkOrganizationId: 'org_a',
    clerkUserId: 'user_a',
  });
  const firstCanFinish = deferred();
  const firstRead = deferred();
  let providerRole = 'FINANCE';
  let persistedRole = null;
  const effects = [];

  const first = withClerkIdentitySyncLock(
    database,
    async () => {
      const snapshot = providerRole;
      effects.push(`first:read:${snapshot}`);
      firstRead.resolve();
      await firstCanFinish.promise;
      persistedRole = snapshot;
      effects.push(`first:write:${snapshot}`);
    },
    { identityKeys },
  );
  await firstRead.promise;
  providerRole = 'AUDITOR';
  let secondEntered = false;
  const second = withClerkIdentitySyncLock(
    database,
    async () => {
      secondEntered = true;
      const snapshot = providerRole;
      effects.push(`second:read:${snapshot}`);
      persistedRole = snapshot;
      effects.push(`second:write:${snapshot}`);
    },
    { identityKeys },
  );

  await contentionObserved.promise;
  assert.equal(secondEntered, false);
  firstCanFinish.resolve();
  await Promise.all([first, second]);

  assert.equal(persistedRole, 'AUDITOR');
  assert.deepEqual(effects, [
    'first:read:FINANCE',
    'first:write:FINANCE',
    'second:read:AUDITOR',
    'second:write:AUDITOR',
  ]);
  assert.deepEqual(identityKeys, [
    'clerk:organization:org_a',
    'clerk:user:user_a',
    'clerk:membership:org_a:user_a',
  ]);
});
