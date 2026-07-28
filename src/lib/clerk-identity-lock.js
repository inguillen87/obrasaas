export const CLERK_IDENTITY_ADVISORY_LOCK_ID = 2_026_071_701;
export const CLERK_RUNTIME_IDENTITY_LOCK_NAMESPACE = 20_260_728;
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

function normalizedRuntimeIdentityKeys(identityKeys) {
  if (!Array.isArray(identityKeys)) {
    throw new TypeError('Clerk runtime identity lock keys must be an array.');
  }
  const normalizedKeys = [...new Set(identityKeys.map((identityKey) => {
    if (typeof identityKey !== 'string' || !identityKey.trim()) {
      throw new TypeError('Clerk runtime identity lock keys must be non-empty strings.');
    }
    return identityKey.trim();
  }))];
  const identityRank = (identityKey) => {
    if (identityKey.startsWith('clerk:organization:')) return 1;
    if (identityKey.startsWith('clerk:user:')) return 2;
    if (identityKey.startsWith('clerk:membership:')) return 3;
    return 4;
  };
  return normalizedKeys.sort((left, right) => {
    const rankDifference = identityRank(left) - identityRank(right);
    if (rankDifference) return rankDifference;
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  });
}

export function clerkIdentityRuntimeLockKeys({
  clerkUserId = null,
  clerkOrganizationId = null,
} = {}) {
  const keys = [];
  if (clerkOrganizationId) keys.push(`clerk:organization:${clerkOrganizationId}`);
  if (clerkUserId) keys.push(`clerk:user:${clerkUserId}`);
  if (clerkOrganizationId && clerkUserId) {
    keys.push(`clerk:membership:${clerkOrganizationId}:${clerkUserId}`);
  }
  return normalizedRuntimeIdentityKeys(keys);
}

export async function acquireClerkRuntimeIdentityLocks(transaction, identityKeys) {
  if (!isClerkIdentityTransaction(transaction)) {
    throw new Error('Runtime identity locks require the global Clerk identity transaction lock.');
  }
  const normalizedKeys = normalizedRuntimeIdentityKeys(identityKeys);
  for (const identityKey of normalizedKeys) {
    await transaction.$queryRawUnsafe(
      `SELECT 1::int AS locked
       FROM (SELECT pg_advisory_xact_lock($1::int, hashtext($2::text))) AS acquired`,
      CLERK_RUNTIME_IDENTITY_LOCK_NAMESPACE,
      identityKey,
    );
  }
}

export async function withClerkIdentitySyncLock(
  database,
  callback,
  { identityKeys = [] } = {},
) {
  if (!canUseClerkIdentitySyncLock(database)) {
    if (isClerkIdentityTransaction(database) && identityKeys.length > 0) {
      await acquireClerkRuntimeIdentityLocks(database, identityKeys);
    }
    return callback(database);
  }
  return database.$transaction(
    async (transaction) => {
      clerkIdentityTransactions.add(transaction);
      await transaction.$queryRawUnsafe(
        'SELECT 1::int AS locked FROM (SELECT pg_advisory_xact_lock_shared($1)) AS acquired',
        CLERK_IDENTITY_ADVISORY_LOCK_ID,
      );
      await acquireClerkRuntimeIdentityLocks(transaction, identityKeys);
      return callback(transaction);
    },
    { ...CLERK_IDENTITY_TRANSACTION_OPTIONS },
  );
}

export async function acquireClerkIdentityCutoverLock(transaction) {
  if (typeof transaction?.$queryRawUnsafe !== 'function') {
    throw new Error('Clerk identity cutover requires PostgreSQL advisory lock support.');
  }
  return acquireClerkIdentityExclusiveLock(transaction);
}

export async function acquireClerkIdentityExclusiveLock(transaction) {
  if (typeof transaction?.$queryRawUnsafe !== 'function') {
    throw new Error('Exclusive Clerk identity synchronization requires PostgreSQL advisory lock support.');
  }
  clerkIdentityTransactions.add(transaction);
  await transaction.$queryRawUnsafe(
    'SELECT 1::int AS locked FROM (SELECT pg_advisory_xact_lock($1)) AS acquired',
    CLERK_IDENTITY_ADVISORY_LOCK_ID,
  );
}
