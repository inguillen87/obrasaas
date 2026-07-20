import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ClerkMembershipStatePendingError,
  getCurrentClerkOrganizationMembership,
  resolveClerkMembershipEventState,
  resolveClerkTenantRole,
} from '../src/lib/clerk-membership-state.js';

function clerkMembership(overrides = {}) {
  return {
    id: 'orgmem_current',
    role: 'org:member',
    createdAt: 200,
    updatedAt: 200,
    publicMetadata: {},
    publicUserData: { userId: 'user_a' },
    ...overrides,
  };
}

function membershipEvent(type, overrides = {}) {
  return {
    type,
    data: {
      id: 'orgmem_current',
      updated_at: 200,
      organization: { id: 'org_a' },
      public_user_data: { user_id: 'user_a' },
      ...overrides,
    },
  };
}

test('authoritative Clerk membership lookup filters by exact user identity', async () => {
  const calls = [];
  const organizations = {
    async getOrganizationMembershipList(args) {
      calls.push(args);
      return {
        data: [
          clerkMembership({ id: 'orgmem_other', publicUserData: { userId: 'user_other' } }),
          clerkMembership(),
        ],
      };
    },
  };

  const result = await getCurrentClerkOrganizationMembership(organizations, {
    organizationId: 'org_a',
    userId: 'user_a',
  });

  assert.equal(result.id, 'orgmem_current');
  assert.deepEqual(calls, [{ organizationId: 'org_a', userId: ['user_a'], limit: 10 }]);
});

test('authoritative lookup treats a deleted Clerk organization as no active membership', async () => {
  const result = await getCurrentClerkOrganizationMembership({
    async getOrganizationMembershipList() {
      const error = new Error('not found');
      error.status = 404;
      throw error;
    },
  }, { organizationId: 'org_deleted', userId: 'user_a' });
  assert.equal(result, null);
});

test('a stale create or update cannot reactivate a membership absent from Clerk', () => {
  assert.deepEqual(
    resolveClerkMembershipEventState(
      membershipEvent('organizationMembership.updated'),
      null,
    ),
    { active: false, staleEvent: false, newerLifecycle: false },
  );
});

test('a deletion waits for Clerk convergence while the same membership still exists', () => {
  assert.throws(
    () => resolveClerkMembershipEventState(
      membershipEvent('organizationMembership.deleted'),
      clerkMembership(),
    ),
    ClerkMembershipStatePendingError,
  );
});

test('a stale deletion cannot disable a newer re-invitation lifecycle', () => {
  assert.deepEqual(
    resolveClerkMembershipEventState(
      membershipEvent('organizationMembership.deleted', {
        id: 'orgmem_previous',
        updated_at: 100,
      }),
      clerkMembership(),
    ),
    { active: true, staleEvent: true, newerLifecycle: true },
  );
});

test('an event newer than the current BAPI snapshot is retried instead of applying stale state', () => {
  assert.throws(
    () => resolveClerkMembershipEventState(
      membershipEvent('organizationMembership.updated', { updated_at: 300 }),
      clerkMembership({ updatedAt: 200 }),
    ),
    ClerkMembershipStatePendingError,
  );
  assert.throws(
    () => resolveClerkMembershipEventState(
      membershipEvent('organizationMembership.created', {
        id: 'orgmem_next',
        updated_at: 300,
      }),
      clerkMembership({ id: 'orgmem_previous', updatedAt: 200 }),
    ),
    ClerkMembershipStatePendingError,
  );
});

test('a disabled member never inherits its historical tenant role on reactivation', () => {
  assert.equal(resolveClerkTenantRole({
    clerkRole: 'org:member',
    databaseMembership: { status: 'DISABLED', tenantRole: 'DIRECTOR' },
    clerkMembership: clerkMembership(),
    invitedTenantRole: 'AUDITOR',
  }), 'AUDITOR');
});

test('a new lifecycle uses Clerk membership metadata or the accepted invitation safely', () => {
  assert.equal(resolveClerkTenantRole({
    clerkRole: 'org:member',
    databaseMembership: { status: 'DISABLED', tenantRole: 'DIRECTOR' },
    clerkMembership: clerkMembership({
      publicMetadata: { obrasaasTenantRole: 'FINANCE' },
    }),
    invitedTenantRole: 'SITE_MANAGER',
  }), 'FINANCE');
  assert.equal(resolveClerkTenantRole({
    clerkRole: 'org:member',
    databaseMembership: null,
    clerkMembership: clerkMembership(),
    invitedTenantRole: 'SITE_MANAGER',
  }), 'SITE_MANAGER');
});

test('an active generic Clerk member keeps the current database operational role', () => {
  assert.equal(resolveClerkTenantRole({
    clerkRole: 'org:member',
    databaseMembership: { status: 'ACTIVE', tenantRole: 'DIRECTOR' },
    clerkMembership: clerkMembership(),
    invitedTenantRole: 'AUDITOR',
  }), 'DIRECTOR');
});
