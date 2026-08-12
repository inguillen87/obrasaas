import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  syncPlatformUserFromClerk,
} from '../src/lib/clerk-user-sync.js';
import {
  disableDeletedClerkTenantMembership,
  persistClerkTenantMembership,
} from '../src/lib/clerk-membership-sync.js';

function singleFlightDatabase() {
  let active = false;
  let maximum = 0;
  return {
    async query(resolve) {
      assert.equal(active, false, 'transaction client received concurrent database queries');
      active = true;
      maximum = Math.max(maximum, 1);
      try {
        await new Promise((complete) => setImmediate(complete));
        return resolve();
      } finally {
        active = false;
      }
    },
    maximum() {
      return maximum;
    },
  };
}

function verifiedClerkUser() {
  return {
    id: 'user_serial',
    primaryEmailAddressId: 'email_primary',
    emailAddresses: [{
      id: 'email_primary',
      emailAddress: 'serial@example.com',
      verification: { status: 'verified' },
    }],
    firstName: 'Serial',
    lastName: 'User',
    imageUrl: null,
  };
}

test('Clerk user and membership synchronization keep one database query in flight', async () => {
  const userFlight = singleFlightDatabase();
  const user = await syncPlatformUserFromClerk({
    platformUser: {
      findUnique() {
        return userFlight.query(() => null);
      },
      async upsert({ create }) {
        return { id: 'platform_serial', ...create };
      },
    },
  }, verifiedClerkUser());
  assert.equal(user.id, 'platform_serial');
  assert.equal(userFlight.maximum(), 1);

  const membershipFlight = singleFlightDatabase();
  const transaction = {
    organization: {
      findUnique() {
        return membershipFlight.query(() => ({ clerkOrganizationId: 'org_serial' }));
      },
    },
    platformUser: {
      findUnique() {
        return membershipFlight.query(() => ({ clerkUserId: 'user_serial' }));
      },
    },
    tenantMembership: {
      async upsert({ create }) {
        return { id: 'membership_serial', ...create };
      },
    },
  };
  const membership = await persistClerkTenantMembership(transaction, {
    organizationId: 'organization_serial',
    userId: 'platform_serial',
    clerkRole: 'org:member',
    tenantRole: 'AUDITOR',
    status: 'ACTIVE',
    eventType: 'organizationMembership.created',
    currentMembership: null,
    expectedClerkOrganizationId: 'org_serial',
    expectedClerkUserId: 'user_serial',
  });
  assert.equal(membership.membership.id, 'membership_serial');
  assert.equal(membershipFlight.maximum(), 1);
});

test('deleted Clerk membership lookup is serialized before persistence', async () => {
  const flight = singleFlightDatabase();
  const current = {
    id: 'membership_serial',
    clerkRole: 'org:member',
    tenantRole: 'AUDITOR',
    status: 'ACTIVE',
  };
  const transaction = {
    tenantMembership: {
      async upsert({ update }) {
        return { ...current, ...update };
      },
    },
    projectMembership: {
      async updateMany() {
        return { count: 0 };
      },
    },
    auditLog: {
      async create({ data }) {
        return data;
      },
    },
  };
  const result = await disableDeletedClerkTenantMembership({
    organization: {
      findUnique() {
        return flight.query(() => ({ id: 'organization_serial' }));
      },
    },
    platformUser: {
      findUnique() {
        return flight.query(() => ({ id: 'platform_serial' }));
      },
    },
    tenantMembership: {
      async findUnique() {
        return current;
      },
    },
    async $transaction(callback) {
      return callback(transaction);
    },
  }, {
    clerkOrganizationId: 'org_serial',
    clerkUserId: 'user_serial',
  });
  assert.deepEqual(result, { found: true, changed: true });
  assert.equal(flight.maximum(), 1);
});

test('the Clerk transaction perimeter preserves only external API Promise.all calls', async () => {
  const root = new URL('../', import.meta.url);
  const sources = await Promise.all([
    'src/lib/access.js',
    'src/lib/clerk-user-sync.js',
    'src/lib/clerk-membership-sync.js',
    'src/app/api/tenant/members/route.js',
    'scripts/lib/clerk-membership-reconciler.mjs',
    'scripts/cutover-clerk-identities.mjs',
  ].map((path) => readFile(new URL(path, root), 'utf8')));

  for (const source of sources.slice(0, 4)) {
    assert.doesNotMatch(source, /Promise\.all\s*\(/);
  }

  const reconcilerPromiseAll = sources[4].match(/Promise\.all\s*\(/g) || [];
  assert.equal(reconcilerPromiseAll.length, 1);
  assert.match(sources[4], /loadAuthoritativeClerkMembershipState[\s\S]*Promise\.all\s*\(\[\s*clerk\.getUser/);

  const cutoverPromiseAll = sources[5].match(/Promise\.all\s*\(/g) || [];
  assert.equal(cutoverPromiseAll.length, 2);
  assert.match(sources[5], /Promise\.all\(coverage\.users\.map/);
  assert.match(sources[5], /Promise\.all\([\s\S]*coverage\.organizations\.map/);
});
