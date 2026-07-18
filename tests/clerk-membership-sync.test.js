import assert from 'node:assert/strict';
import test from 'node:test';

import {
  disableDeletedClerkTenantMembership,
  persistClerkTenantMembership,
} from '../src/lib/clerk-membership-sync.js';

function prismaDouble(nextMembership, resetCount = 2) {
  const calls = [];
  const prisma = {
    async $transaction(callback) {
      calls.push(['transaction']);
      return callback({
        tenantMembership: {
          async upsert(args) {
            calls.push(['upsert', args]);
            return nextMembership;
          },
        },
        projectMembership: {
          async updateMany(args) {
            calls.push(['reset', args]);
            return { count: resetCount };
          },
        },
        auditLog: {
          async create(args) {
            calls.push(['audit', args]);
            return args.data;
          },
        },
      });
    },
  };
  return { calls, prisma };
}

function input(overrides = {}) {
  return {
    organizationId: 'organization-a',
    userId: 'user-a',
    clerkRole: 'org:member',
    tenantRole: 'SITE_MANAGER',
    status: 'ACTIVE',
    eventType: 'organizationMembership.updated',
    currentMembership: {
      id: 'membership-a',
      tenantRole: 'DIRECTOR',
      status: 'ACTIVE',
    },
    ...overrides,
  };
}

function nextMembership(overrides = {}) {
  return {
    id: 'membership-a',
    tenantRole: 'SITE_MANAGER',
    status: 'ACTIVE',
    ...overrides,
  };
}

function names(calls) {
  return calls.map(([name]) => name);
}

test('Clerk portfolio-to-restricted sync disables latent project grants and audits the reset', async () => {
  const { calls, prisma } = prismaDouble(nextMembership(), 3);
  const result = await persistClerkTenantMembership(prisma, input());

  assert.equal(result.projectAccessResetApplied, true);
  assert.equal(result.resetCount, 3);
  assert.deepEqual(names(calls), ['transaction', 'upsert', 'reset', 'audit']);
  assert.deepEqual(calls.find(([name]) => name === 'reset')[1], {
    where: { tenantMembershipId: 'membership-a', status: 'ACTIVE' },
    data: { status: 'DISABLED' },
  });
  assert.deepEqual(calls.find(([name]) => name === 'audit')[1].data.metadata, {
    clerkEventType: 'organizationMembership.updated',
    previousTenantRole: 'DIRECTOR',
    nextTenantRole: 'SITE_MANAGER',
    previousStatus: 'ACTIVE',
    nextStatus: 'ACTIVE',
    resetProjectAccessCount: 3,
  });
});

test('Clerk reactivation stays fail-closed even when no active grant row remains', async () => {
  const { calls, prisma } = prismaDouble(nextMembership(), 0);
  const result = await persistClerkTenantMembership(prisma, input({
    eventType: 'organizationMembership.created',
    currentMembership: {
      id: 'membership-a',
      tenantRole: 'SITE_MANAGER',
      status: 'DISABLED',
    },
  }));

  assert.equal(result.projectAccessResetApplied, true);
  assert.equal(result.resetCount, 0);
  assert.deepEqual(names(calls), ['transaction', 'upsert', 'reset', 'audit']);
});

test('a genuinely new Clerk member starts without implicit project grants', async () => {
  const { calls, prisma } = prismaDouble(nextMembership());
  const result = await persistClerkTenantMembership(prisma, input({
    eventType: 'organizationMembership.created',
    currentMembership: null,
  }));

  assert.equal(result.projectAccessResetApplied, false);
  assert.equal(result.resetCount, 0);
  assert.deepEqual(names(calls), ['transaction', 'upsert']);
});

test('membership deletion uses only existing database identities and preserves roles', async () => {
  const currentMembership = {
    id: 'membership-a',
    clerkRole: 'org:member',
    tenantRole: 'SITE_MANAGER',
    status: 'ACTIVE',
  };
  const { calls, prisma } = prismaDouble({ ...currentMembership, status: 'DISABLED' }, 1);
  prisma.organization = {
    async findUnique() {
      calls.push(['find-organization']);
      return { id: 'organization-a' };
    },
  };
  prisma.platformUser = {
    async findUnique() {
      calls.push(['find-user']);
      return { id: 'user-a' };
    },
  };
  prisma.tenantMembership = {
    async findUnique() {
      calls.push(['find-membership']);
      return currentMembership;
    },
  };

  const result = await disableDeletedClerkTenantMembership(prisma, {
    clerkOrganizationId: 'org_clerk_a',
    clerkUserId: 'user_clerk_a',
  });

  assert.deepEqual(result, { found: true, changed: true });
  const upsert = calls.find(([name]) => name === 'upsert')[1];
  assert.equal(upsert.update.status, 'DISABLED');
  assert.equal(upsert.update.clerkRole, currentMembership.clerkRole);
  assert.equal(upsert.update.tenantRole, currentMembership.tenantRole);
});

test('membership deletion is a successful no-op for identities absent from Neon', async () => {
  let transactionCalled = false;
  const prisma = {
    organization: { async findUnique() { return null; } },
    platformUser: { async findUnique() { return { id: 'user-a' }; } },
    async $transaction() {
      transactionCalled = true;
    },
  };

  const result = await disableDeletedClerkTenantMembership(prisma, {
    clerkOrganizationId: 'org_missing',
    clerkUserId: 'user_clerk_a',
  });

  assert.deepEqual(result, { found: false, changed: false });
  assert.equal(transactionCalled, false);
});
