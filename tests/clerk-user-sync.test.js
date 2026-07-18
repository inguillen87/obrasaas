import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ClerkIdentityConflictError,
  ClerkIdentityRebindRequiredError,
  ClerkVerifiedEmailRequiredError,
  preserveDeletedClerkUser,
  rebindPlatformUserByVerifiedEmail,
  syncPlatformUserFromClerk,
  verifiedPrimaryEmail,
} from '../src/lib/clerk-user-sync.js';

function clerkUser(overrides = {}) {
  return {
    id: 'user_new',
    primaryEmailAddressId: 'email_primary',
    emailAddresses: [{
      id: 'email_primary',
      emailAddress: ' Person@Empresa.com ',
      verification: { status: 'verified' },
    }],
    firstName: 'Ana',
    lastName: 'Obra',
    imageUrl: 'https://img.example/ana.png',
    ...overrides,
  };
}

test('verified primary email is normalized and must be verified', () => {
  assert.equal(verifiedPrimaryEmail(clerkUser()), 'person@empresa.com');
  assert.equal(verifiedPrimaryEmail(clerkUser({
    emailAddresses: [{
      id: 'email_primary',
      emailAddress: 'person@empresa.com',
      verification: { status: 'unverified' },
    }],
  })), null);
});

test('sync reports an explicit verified-email requirement', async () => {
  await assert.rejects(
    () => syncPlatformUserFromClerk({}, clerkUser({
      emailAddresses: [{
        id: 'email_primary',
        emailAddress: 'person@empresa.com',
        verification: { status: 'unverified' },
      }],
    })),
    ClerkVerifiedEmailRequiredError,
  );
});

test('normal sync creates a new database identity without implicit rebind', async () => {
  const calls = [];
  const prisma = {
    platformUser: {
      async findUnique({ where }) {
        calls.push(['find', where]);
        return null;
      },
      async upsert(args) {
        calls.push(['upsert', args]);
        return { id: 'platform_new', ...args.create };
      },
    },
  };

  const now = new Date('2026-07-17T12:00:00.000Z');
  const user = await syncPlatformUserFromClerk(prisma, clerkUser(), {
    touchLastSeenAt: true,
    now,
  });

  assert.equal(user.id, 'platform_new');
  assert.equal(user.clerkUserId, 'user_new');
  assert.equal(user.primaryEmail, 'person@empresa.com');
  assert.equal(user.systemRole, 'TENANT_USER');
  assert.equal(user.lastSeenAt, now);
  assert.deepEqual(calls.map(([name]) => name), ['find', 'find', 'upsert']);
});

test('Prisma 7 transaction clients do not recursively open identity transactions', async () => {
  let rootTransactions = 0;
  let nestedTransactions = 0;
  const transaction = {
    async $transaction() {
      nestedTransactions += 1;
      throw new Error('identity sync opened a nested transaction');
    },
    async $queryRawUnsafe() {
      return [{ locked: 1 }];
    },
    platformUser: {
      async findUnique() {
        return null;
      },
      async upsert(args) {
        return { id: 'platform_new', ...args.create };
      },
    },
  };
  const prisma = {
    async $queryRawUnsafe() {},
    async $transaction(callback) {
      rootTransactions += 1;
      return callback(transaction);
    },
  };

  const user = await syncPlatformUserFromClerk(prisma, clerkUser());

  assert.equal(user.id, 'platform_new');
  assert.equal(rootTransactions, 1);
  assert.equal(nestedTransactions, 0);
});

test('concurrent first sync converges on the Clerk identity after a unique-key race', async () => {
  let lookupRound = 0;
  const existing = {
    id: 'platform_new',
    clerkUserId: 'user_new',
    primaryEmail: 'person@empresa.com',
  };
  const calls = [];
  const prisma = {
    platformUser: {
      async findUnique() {
        lookupRound += 1;
        return lookupRound <= 2 ? null : existing;
      },
      async upsert() {
        const error = new Error('Unique constraint failed');
        error.code = 'P2002';
        throw error;
      },
      async update(args) {
        calls.push(args);
        return { ...existing, ...args.data };
      },
    },
  };

  const result = await syncPlatformUserFromClerk(prisma, clerkUser());

  assert.equal(result.id, existing.id);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].where, { id: existing.id });
});

test('normal sync fails closed when a verified email belongs to a previous Clerk ID', async () => {
  const prisma = {
    platformUser: {
      async findUnique({ where }) {
        if (where.clerkUserId) return null;
        return {
          id: 'platform_existing',
          clerkUserId: 'user_old',
          primaryEmail: 'person@empresa.com',
        };
      },
    },
  };

  await assert.rejects(
    () => syncPlatformUserFromClerk(prisma, clerkUser()),
    (error) => (
      error instanceof ClerkIdentityRebindRequiredError
      && error.code === 'CLERK_IDENTITY_REBIND_REQUIRED'
      && error.existingClerkUserId === 'user_old'
    ),
  );
});

test('explicit migration rebind preserves the database user and records an audit event', async () => {
  const calls = [];
  const existing = {
    id: 'platform_existing',
    clerkUserId: 'user_old',
    primaryEmail: 'person@empresa.com',
  };
  const transaction = {
    platformUser: {
      async findUnique({ where }) {
        if (where.id) return { ...existing, clerkUserId: 'user_new' };
        return where.clerkUserId ? null : existing;
      },
      async updateMany(args) {
        calls.push(['update-many', args]);
        return { count: 1 };
      },
    },
    auditLog: {
      async create(args) {
        calls.push(['audit', args]);
        return args.data;
      },
    },
  };
  const prisma = {
    async $transaction(callback) {
      return callback(transaction);
    },
  };

  const user = await rebindPlatformUserByVerifiedEmail(prisma, clerkUser(), {
    expectedPreviousClerkUserId: 'user_old',
  });

  assert.equal(user.id, 'platform_existing');
  assert.equal(user.clerkUserId, 'user_new');
  assert.deepEqual(calls.map(([name]) => name), ['update-many', 'audit']);
  assert.equal(calls[1][1].data.action, 'identity.clerk_user_rebound');
  assert.deepEqual(calls[1][1].data.metadata, {
    previousClerkUserId: 'user_old',
    nextClerkUserId: 'user_new',
    reason: 'explicit_verified_email_migration',
  });
});

test('explicit user rebind requires the exact previous Clerk ID', async () => {
  const existing = {
    id: 'platform_existing',
    clerkUserId: 'user_current',
    primaryEmail: 'person@empresa.com',
  };
  const prisma = {
    async $transaction(callback) {
      return callback({
        platformUser: {
          async findUnique({ where }) {
            return where.clerkUserId ? null : existing;
          },
        },
      });
    },
  };

  await assert.rejects(
    () => rebindPlatformUserByVerifiedEmail(prisma, clerkUser(), {
      expectedPreviousClerkUserId: 'user_stale',
    }),
    ClerkIdentityConflictError,
  );
});

test('explicit migration refuses to merge two different database identities', async () => {
  const prisma = {
    async $transaction(callback) {
      return callback({
        platformUser: {
          async findUnique({ where }) {
            return where.clerkUserId
              ? { id: 'platform_a', clerkUserId: 'user_new' }
              : { id: 'platform_b', clerkUserId: 'user_old' };
          },
        },
      });
    },
  };

  await assert.rejects(
    () => rebindPlatformUserByVerifiedEmail(prisma, clerkUser()),
    ClerkIdentityConflictError,
  );
});

test('Clerk deletion preserves the platform user while disabling tenant and project access', async () => {
  const calls = [];
  const transaction = {
    platformUser: {
      async findUnique() {
        calls.push(['find-user']);
        return { id: 'platform_existing' };
      },
    },
    tenantMembership: {
      async findMany() {
        calls.push(['find-memberships']);
        return [{ id: 'membership_a' }, { id: 'membership_b' }];
      },
      async updateMany(args) {
        calls.push(['disable-memberships', args]);
        return { count: 2 };
      },
    },
    projectMembership: {
      async updateMany(args) {
        calls.push(['disable-projects', args]);
        return { count: 3 };
      },
    },
    auditLog: {
      async create(args) {
        calls.push(['audit', args]);
        return args.data;
      },
    },
  };
  const prisma = {
    async $transaction(callback) {
      calls.push(['transaction']);
      return callback(transaction);
    },
  };

  const result = await preserveDeletedClerkUser(prisma, 'user_deleted');

  assert.deepEqual(result, { found: true, membershipCount: 2, projectAccessCount: 3 });
  assert.deepEqual(calls.map(([name]) => name), [
    'transaction',
    'find-user',
    'find-memberships',
    'disable-memberships',
    'disable-projects',
    'audit',
  ]);
  assert.equal(calls.some(([name]) => name === 'delete'), false);
  assert.deepEqual(calls[4][1].where, {
    tenantMembershipId: { in: ['membership_a', 'membership_b'] },
    status: { not: 'DISABLED' },
  });
});
