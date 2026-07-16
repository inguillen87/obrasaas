import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertSubscriptionAllowsWrites,
  createOfficeInvitationWithinPlan,
  fieldUserCapacity,
  getSubscriptionEntitlements,
  OfficeSeatCheckError,
  OfficeSeatLimitError,
  officeUserCapacity,
  SubscriptionWriteBlockedError,
} from '../src/lib/plans.js';

const NOW = new Date('2026-07-14T12:00:00.000Z');

function transactionPrisma(calls = []) {
  return {
    async $transaction(callback, options) {
      calls.push(['transaction', options]);
      return callback({
        async $executeRawUnsafe(query, ...params) {
          calls.push(['sql', query, ...params]);
        },
      });
    },
  };
}

test('an active trial can read and write', () => {
  const access = getSubscriptionEntitlements({
    subscriptionPlan: 'TRIAL',
    subscriptionStatus: 'TRIALING',
    trialEndsAt: new Date('2026-07-20T12:00:00.000Z'),
  }, NOW);

  assert.equal(access.status, 'TRIALING');
  assert.equal(access.trialDaysRemaining, 6);
  assert.equal(access.canRead, true);
  assert.equal(access.canWrite, true);
});

test('an expired trial becomes read-only', () => {
  const access = getSubscriptionEntitlements({
    subscriptionPlan: 'TRIAL',
    subscriptionStatus: 'TRIALING',
    trialEndsAt: new Date('2026-07-13T12:00:00.000Z'),
  }, NOW);

  assert.equal(access.status, 'TRIAL_EXPIRED');
  assert.equal(access.trialDaysRemaining, 0);
  assert.equal(access.canRead, true);
  assert.equal(access.canWrite, false);
});

test('a trial is read-only at the exact trialEndsAt boundary', () => {
  const access = getSubscriptionEntitlements({
    subscriptionPlan: 'TRIAL',
    subscriptionStatus: 'TRIALING',
    trialEndsAt: NOW,
  }, NOW);

  assert.equal(access.status, 'TRIAL_EXPIRED');
  assert.equal(access.trialDaysRemaining, 0);
  assert.equal(access.canWrite, false);
});

test('active plans work and suspended tenants are blocked', () => {
  assert.deepEqual(
    getSubscriptionEntitlements({
      subscriptionPlan: 'PRO',
      subscriptionStatus: 'ACTIVE',
    }, NOW),
    {
      plan: 'PRO',
      status: 'ACTIVE',
      trialEndsAt: null,
      trialDaysRemaining: null,
      canRead: true,
      canWrite: true,
    },
  );

  const suspended = getSubscriptionEntitlements({
    subscriptionPlan: 'ENTERPRISE',
    subscriptionStatus: 'SUSPENDED',
  }, NOW);
  assert.equal(suspended.canRead, false);
  assert.equal(suspended.canWrite, false);
});

test('operational writes allow ACTIVE and current trials but reject every read-only status', () => {
  const active = {
    subscriptionPlan: 'PRO',
    subscriptionStatus: 'ACTIVE',
  };
  const currentTrial = {
    subscriptionPlan: 'TRIAL',
    subscriptionStatus: 'TRIALING',
    trialEndsAt: new Date('2026-07-20T12:00:00.000Z'),
  };
  assert.equal(assertSubscriptionAllowsWrites(active, { now: NOW }).canWrite, true);
  assert.equal(assertSubscriptionAllowsWrites(currentTrial, { now: NOW }).canWrite, true);

  const blocked = [
    {
      label: 'expired trial',
      organization: {
        subscriptionPlan: 'TRIAL',
        subscriptionStatus: 'TRIALING',
        trialEndsAt: new Date('2026-07-13T12:00:00.000Z'),
      },
      expectedStatus: 'TRIAL_EXPIRED',
    },
    {
      label: 'past due',
      organization: { subscriptionPlan: 'PRO', subscriptionStatus: 'PAST_DUE' },
      expectedStatus: 'PAST_DUE',
    },
    {
      label: 'canceled',
      organization: { subscriptionPlan: 'PRO', subscriptionStatus: 'CANCELED' },
      expectedStatus: 'CANCELED',
    },
    {
      label: 'suspended',
      organization: { subscriptionPlan: 'ENTERPRISE', subscriptionStatus: 'SUSPENDED' },
      expectedStatus: 'SUSPENDED',
    },
  ];

  for (const scenario of blocked) {
    assert.throws(
      () => assertSubscriptionAllowsWrites(scenario.organization, { now: NOW }),
      (error) => {
        assert.equal(error instanceof SubscriptionWriteBlockedError, true, scenario.label);
        assert.equal(error.code, 'SUBSCRIPTION_READ_ONLY', scenario.label);
        assert.equal(error.status, 402, scenario.label);
        assert.equal(error.entitlements.status, scenario.expectedStatus, scenario.label);
        return true;
      },
    );
  }
});

test('field worker capacity enforces the published organization-wide limits', () => {
  assert.deepEqual(fieldUserCapacity({ plan: 'TRIAL', activeCount: 19 }), {
    limit: 20,
    used: 19,
    remaining: 1,
    canActivate: true,
  });
  assert.deepEqual(fieldUserCapacity({ plan: 'TRIAL', activeCount: 20 }), {
    limit: 20,
    used: 20,
    remaining: 0,
    canActivate: false,
  });
  assert.equal(fieldUserCapacity({ plan: 'PRO', activeCount: 99 }).canActivate, true);
  assert.equal(fieldUserCapacity({ plan: 'ENTERPRISE', activeCount: 500 }).canActivate, false);
  assert.equal(fieldUserCapacity({ plan: 'UNKNOWN', activeCount: 0 }).canActivate, false);
});

test('office capacity reserves seats for active memberships and pending invitations', () => {
  assert.deepEqual(officeUserCapacity({
    plan: 'TRIAL',
    activeMemberships: 1,
    pendingInvitations: 1,
  }), {
    plan: 'TRIAL',
    limit: 3,
    activeMemberships: 1,
    pendingInvitations: 1,
    used: 2,
    remaining: 1,
    canInvite: true,
  });
  assert.equal(officeUserCapacity({
    plan: 'PRO',
    activeMemberships: 7,
    pendingInvitations: 3,
  }).canInvite, false);
  assert.equal(officeUserCapacity({
    plan: 'ENTERPRISE',
    activeMemberships: 49,
    pendingInvitations: 0,
  }).canInvite, true);
  assert.equal(officeUserCapacity({
    plan: 'ENTERPRISE',
    activeMemberships: 49,
    pendingInvitations: 1,
  }).canInvite, false);
  assert.equal(officeUserCapacity({
    plan: 'UNKNOWN',
    activeMemberships: 0,
    pendingInvitations: 0,
  }).canInvite, false);
});

test('office invitation preflight scopes both Clerk counts and creation to the tenant org', async () => {
  const calls = [];
  const databaseCalls = [];
  const organizations = {
    async getOrganization(params) {
      calls.push(['organization', params]);
      return { id: params.organizationId, maxAllowedMemberships: 50 };
    },
    async updateOrganization(organizationId, params) {
      calls.push(['update-organization', organizationId, params]);
      return { id: organizationId, maxAllowedMemberships: params.maxAllowedMemberships };
    },
    async getOrganizationMembershipList(params) {
      calls.push(['memberships', params]);
      return { data: [], totalCount: 4 };
    },
    async getOrganizationInvitationList(params) {
      calls.push(['invitations', params]);
      return { data: [], totalCount: 2 };
    },
    async createOrganizationInvitation(params) {
      calls.push(['create', params]);
      return { id: 'orginv_test' };
    },
  };

  const result = await createOfficeInvitationWithinPlan({
    prisma: transactionPrisma(databaseCalls),
    organizations,
    organizationId: 'org_authoritative',
    plan: 'PRO',
    invitationParams: {
      organizationId: 'org_client_supplied',
      emailAddress: 'persona@empresa.com',
      role: 'org:member',
    },
  });

  assert.equal(result.invitation.id, 'orginv_test');
  assert.equal(result.capacity.used, 6);
  assert.deepEqual(calls, [
    ['organization', { organizationId: 'org_authoritative' }],
    ['update-organization', 'org_authoritative', { maxAllowedMemberships: 10 }],
    ['invitations', {
      organizationId: 'org_authoritative',
      status: ['pending'],
      limit: 1,
      offset: 0,
    }],
    ['memberships', { organizationId: 'org_authoritative', limit: 1, offset: 0 }],
    ['create', {
      organizationId: 'org_authoritative',
      emailAddress: 'persona@empresa.com',
      role: 'org:member',
    }],
  ]);
  assert.deepEqual(databaseCalls[0], [
    'transaction',
    { maxWait: 5_000, timeout: 20_000 },
  ]);
  assert.match(databaseCalls[1][1], /SET LOCAL lock_timeout = '5000ms'/);
  assert.match(databaseCalls[2][1], /pg_advisory_xact_lock/);
  assert.equal(databaseCalls[2][2], 'obrasaas:office-seats:org_authoritative');
});

test('office invitation is not created when active plus pending seats reach the plan limit', async () => {
  let createCalls = 0;
  const organizations = {
    async getOrganization() {
      return { maxAllowedMemberships: 10 };
    },
    async updateOrganization() {
      throw new Error('must not update an already synchronized limit');
    },
    async getOrganizationMembershipList() {
      return { data: [], totalCount: 8 };
    },
    async getOrganizationInvitationList() {
      return { data: [], totalCount: 2 };
    },
    async createOrganizationInvitation() {
      createCalls += 1;
      return { id: 'must_not_exist' };
    },
  };

  await assert.rejects(
    createOfficeInvitationWithinPlan({
      prisma: transactionPrisma(),
      organizations,
      organizationId: 'org_tenant',
      plan: 'PRO',
      invitationParams: { emailAddress: 'persona@empresa.com', role: 'org:member' },
    }),
    (error) => {
      assert.equal(error instanceof OfficeSeatLimitError, true);
      assert.equal(error.code, 'OFFICE_SEAT_LIMIT_REACHED');
      assert.equal(error.capacity.limit, 10);
      assert.equal(error.capacity.used, 10);
      return true;
    },
  );
  assert.equal(createCalls, 0);
});

test('office invitation fails closed when Clerk cannot provide exact seat totals', async () => {
  let createCalls = 0;
  const organizations = {
    async getOrganization() {
      return { maxAllowedMemberships: 3 };
    },
    async updateOrganization() {
      throw new Error('must not update an already synchronized limit');
    },
    async getOrganizationMembershipList() {
      return { data: [] };
    },
    async getOrganizationInvitationList() {
      return { data: [], totalCount: 0 };
    },
    async createOrganizationInvitation() {
      createCalls += 1;
      return { id: 'must_not_exist' };
    },
  };

  await assert.rejects(
    createOfficeInvitationWithinPlan({
      prisma: transactionPrisma(),
      organizations,
      organizationId: 'org_tenant',
      plan: 'TRIAL',
      invitationParams: { emailAddress: 'persona@empresa.com', role: 'org:member' },
    }),
    (error) => {
      assert.equal(error instanceof OfficeSeatCheckError, true);
      assert.equal(error.code, 'OFFICE_SEAT_CHECK_UNAVAILABLE');
      return true;
    },
  );
  assert.equal(createCalls, 0);
});

test('office invitation fails closed when Clerk does not confirm the synchronized cap', async () => {
  let countCalls = 0;
  let createCalls = 0;
  const organizations = {
    async getOrganization() {
      return { maxAllowedMemberships: 0 };
    },
    async updateOrganization() {
      return { maxAllowedMemberships: 0 };
    },
    async getOrganizationMembershipList() {
      countCalls += 1;
      return { data: [], totalCount: 0 };
    },
    async getOrganizationInvitationList() {
      countCalls += 1;
      return { data: [], totalCount: 0 };
    },
    async createOrganizationInvitation() {
      createCalls += 1;
      return { id: 'must_not_exist' };
    },
  };

  await assert.rejects(
    createOfficeInvitationWithinPlan({
      prisma: transactionPrisma(),
      organizations,
      organizationId: 'org_tenant',
      plan: 'PRO',
      invitationParams: { emailAddress: 'persona@empresa.com', role: 'org:member' },
    }),
    (error) => error instanceof OfficeSeatCheckError,
  );
  assert.equal(countCalls, 0);
  assert.equal(createCalls, 0);
});

test('unknown plans fail closed before opening a transaction or touching Clerk', async () => {
  let transactionCalls = 0;
  let clerkCalls = 0;
  const prisma = {
    async $transaction() {
      transactionCalls += 1;
    },
  };
  const organizations = new Proxy({}, {
    get() {
      return async () => {
        clerkCalls += 1;
      };
    },
  });

  await assert.rejects(
    createOfficeInvitationWithinPlan({
      prisma,
      organizations,
      organizationId: 'org_tenant',
      plan: 'UNRECOGNIZED',
      invitationParams: {},
    }),
    (error) => error instanceof OfficeSeatCheckError,
  );
  assert.equal(transactionCalls, 0);
  assert.equal(clerkCalls, 0);
});

test('an unavailable organization lock fails closed before any Clerk request', async () => {
  let clerkCalls = 0;
  const prisma = {
    async $transaction(callback) {
      return callback({
        async $executeRawUnsafe() {
          throw new Error('canceling statement due to lock timeout');
        },
      });
    },
  };
  const organizations = new Proxy({}, {
    get() {
      return async () => {
        clerkCalls += 1;
      };
    },
  });

  await assert.rejects(
    createOfficeInvitationWithinPlan({
      prisma,
      organizations,
      organizationId: 'org_tenant',
      plan: 'TRIAL',
      invitationParams: {},
    }),
    (error) => error instanceof OfficeSeatCheckError,
  );
  assert.equal(clerkCalls, 0);
});

test('the organization lock serializes concurrent invitations at the last seat', async () => {
  let tail = Promise.resolve();
  const prisma = {
    async $transaction(callback) {
      const previous = tail;
      let release;
      tail = new Promise((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        return await callback({ async $executeRawUnsafe() {} });
      } finally {
        release();
      }
    },
  };
  const pending = [];
  let createCalls = 0;
  const organizations = {
    async getOrganization() {
      return { maxAllowedMemberships: 3 };
    },
    async updateOrganization() {
      throw new Error('must not update an already synchronized limit');
    },
    async getOrganizationMembershipList() {
      return { data: [], totalCount: 2 };
    },
    async getOrganizationInvitationList() {
      return { data: [], totalCount: pending.length };
    },
    async createOrganizationInvitation(params) {
      createCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      const invitation = { id: `orginv_${createCalls}`, ...params };
      pending.push(invitation);
      return invitation;
    },
  };

  const results = await Promise.allSettled([
    createOfficeInvitationWithinPlan({
      prisma,
      organizations,
      organizationId: 'org_tenant',
      plan: 'TRIAL',
      invitationParams: { emailAddress: 'uno@empresa.com', role: 'org:member' },
    }),
    createOfficeInvitationWithinPlan({
      prisma,
      organizations,
      organizationId: 'org_tenant',
      plan: 'TRIAL',
      invitationParams: { emailAddress: 'dos@empresa.com', role: 'org:member' },
    }),
  ]);

  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const rejected = results.find((result) => result.status === 'rejected');
  assert.equal(rejected.reason instanceof OfficeSeatLimitError, true);
  assert.equal(createCalls, 1);
  assert.equal(pending.length, 1);
});

test('Clerk invitation errors keep their original status for the route response', async () => {
  const clerkError = Object.assign(new Error('invitation already exists'), { status: 422 });
  const organizations = {
    async getOrganization() {
      return { maxAllowedMemberships: 3 };
    },
    async updateOrganization() {
      throw new Error('must not update an already synchronized limit');
    },
    async getOrganizationMembershipList() {
      return { data: [], totalCount: 1 };
    },
    async getOrganizationInvitationList() {
      return { data: [], totalCount: 0 };
    },
    async createOrganizationInvitation() {
      throw clerkError;
    },
  };

  await assert.rejects(
    createOfficeInvitationWithinPlan({
      prisma: transactionPrisma(),
      organizations,
      organizationId: 'org_tenant',
      plan: 'TRIAL',
      invitationParams: { emailAddress: 'persona@empresa.com', role: 'org:member' },
    }),
    (error) => error === clerkError,
  );
});
