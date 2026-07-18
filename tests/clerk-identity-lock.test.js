import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CLERK_IDENTITY_ADVISORY_LOCK_ID,
  CLERK_IDENTITY_TRANSACTION_OPTIONS,
  acquireClerkIdentityCutoverLock,
  canUseClerkIdentitySyncLock,
  isClerkIdentityTransaction,
  withClerkIdentitySyncLock,
} from '../src/lib/clerk-identity-lock.js';

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
