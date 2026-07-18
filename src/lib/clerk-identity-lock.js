export const CLERK_IDENTITY_ADVISORY_LOCK_ID = 2_026_071_701;
export const CLERK_IDENTITY_TRANSACTION_OPTIONS = Object.freeze({
  maxWait: 15_000,
  timeout: 30_000,
});

const clerkIdentityTransactions = new WeakSet();

export function isClerkIdentityTransaction(database) {
  return Boolean(
    database
    && (typeof database === 'object' || typeof database === 'function')
    && clerkIdentityTransactions.has(database),
  );
}

export function canUseClerkIdentitySyncLock(database) {
  return !isClerkIdentityTransaction(database)
    && typeof database?.$transaction === 'function'
    && typeof database?.$queryRawUnsafe === 'function';
}

export async function withClerkIdentitySyncLock(database, callback) {
  if (!canUseClerkIdentitySyncLock(database)) return callback(database);
  return database.$transaction(
    async (transaction) => {
      clerkIdentityTransactions.add(transaction);
      await transaction.$queryRawUnsafe(
        'SELECT 1::int AS locked FROM (SELECT pg_advisory_xact_lock_shared($1)) AS acquired',
        CLERK_IDENTITY_ADVISORY_LOCK_ID,
      );
      return callback(transaction);
    },
    { ...CLERK_IDENTITY_TRANSACTION_OPTIONS },
  );
}

export async function acquireClerkIdentityCutoverLock(transaction) {
  if (typeof transaction?.$queryRawUnsafe !== 'function') {
    throw new Error('Clerk identity cutover requires PostgreSQL advisory lock support.');
  }
  clerkIdentityTransactions.add(transaction);
  await transaction.$queryRawUnsafe(
    'SELECT 1::int AS locked FROM (SELECT pg_advisory_xact_lock($1)) AS acquired',
    CLERK_IDENTITY_ADVISORY_LOCK_ID,
  );
}
