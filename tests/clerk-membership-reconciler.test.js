import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertExpectedPreviewClerkInstance,
  authorizePreviewReconciliationDatabase,
  buildClerkMembershipReconciliationPlan,
  createClerkBapiReadClient,
  loadAuthoritativeClerkMembershipState,
  parseClerkMembershipReconciliationArgs,
  PREVIEW_DATABASE_IDENTITY_ENV,
  reconcileClerkMembership,
  safeClerkMembershipReconciliationError,
} from '../scripts/lib/clerk-membership-reconciler.mjs';
import {
  databaseIdentityDigest,
  PRODUCTION_DATABASE_IDENTITY_ENV,
} from '../scripts/vercel-build.mjs';

const PRODUCTION_URL = 'postgresql://owner:secret@ep-production.neon.tech/obrasaas';
const PREVIEW_URL = 'postgresql://owner:secret@ep-preview.neon.tech/obrasaas';
const PREVIEW_POOLER_URL = 'postgresql://owner:secret@ep-preview-pooler.neon.tech/obrasaas';

function previewEnvironment(overrides = {}) {
  return {
    VERCEL_ENV: 'preview',
    DIRECT_URL: PREVIEW_URL,
    DATABASE_URL: PREVIEW_POOLER_URL,
    [PRODUCTION_DATABASE_IDENTITY_ENV]: databaseIdentityDigest(PRODUCTION_URL).toString('hex'),
    [PREVIEW_DATABASE_IDENTITY_ENV]: databaseIdentityDigest(PREVIEW_URL).toString('hex'),
    ...overrides,
  };
}

function clerkUser(overrides = {}) {
  return {
    id: 'user_Test123',
    primaryEmailAddressId: 'email_primary',
    emailAddresses: [{
      id: 'email_primary',
      emailAddress: 'worker@example.com',
      verification: { status: 'verified' },
    }],
    firstName: 'Test',
    lastName: 'Worker',
    imageUrl: null,
    ...overrides,
  };
}

function clerkOrganization(overrides = {}) {
  return {
    id: 'org_Test123',
    name: 'Test Organization',
    slug: 'test-organization',
    publicMetadata: {},
    privateMetadata: {},
    ...overrides,
  };
}

function clerkMembership(overrides = {}) {
  return {
    id: 'orgmem_Test123',
    role: 'org:member',
    publicUserData: { userId: 'user_Test123' },
    organization: { id: 'org_Test123' },
    publicMetadata: {},
    ...overrides,
  };
}

function authoritativeState(overrides = {}) {
  return {
    user: clerkUser(),
    organization: clerkOrganization(),
    membership: clerkMembership(),
    clerkRole: 'org:member',
    invitationLookup: { available: true, invitations: [] },
    ...overrides,
  };
}

function readOnlyDatabase({ user = null, organization = null, membership = null } = {}) {
  return {
    platformUser: {
      async findUnique({ where }) {
        if (where.clerkUserId) return user?.clerkUserId === where.clerkUserId ? user : null;
        if (where.primaryEmail) return user?.primaryEmail === where.primaryEmail ? user : null;
        return null;
      },
    },
    organization: {
      async findUnique({ where }) {
        if (where.clerkOrganizationId) {
          return organization?.clerkOrganizationId === where.clerkOrganizationId
            ? organization
            : null;
        }
        if (where.id) return organization?.id === where.id ? organization : null;
        return null;
      },
      async findFirst() {
        return null;
      },
    },
    tenantMembership: {
      async findUnique() {
        return membership;
      },
    },
  };
}

function clerkReadDouble() {
  return {
    async getInstance() {
      return { id: 'ins_Test123', environment_type: 'development' };
    },
    async getUser() {
      return clerkUser();
    },
    async getOrganization() {
      return clerkOrganization();
    },
    organizations: {
      async getOrganizationMembershipList() {
        return { data: [clerkMembership()], totalCount: 1 };
      },
    },
    async getAcceptedOrganizationInvitations() {
      return [];
    },
  };
}

function mutableDatabase() {
  const calls = [];
  const state = { user: null, organization: null, membership: null };
  const transaction = {
    async $queryRawUnsafe(query) {
      calls.push(query.includes('pg_advisory_xact_lock_shared')
        ? 'identity-lock-shared'
        : 'identity-lock-exclusive');
      return [{ locked: 1 }];
    },
    platformUser: {
      async findUnique({ where }) {
        if (where.clerkUserId) return state.user?.clerkUserId === where.clerkUserId ? state.user : null;
        if (where.primaryEmail) return state.user?.primaryEmail === where.primaryEmail ? state.user : null;
        return null;
      },
      async upsert({ create, update }) {
        calls.push('platformUser.upsert');
        state.user = state.user
          ? { ...state.user, ...update }
          : { id: 'db_user', ...create };
        return state.user;
      },
    },
    organization: {
      async findUnique({ where }) {
        if (where.clerkOrganizationId) {
          return state.organization?.clerkOrganizationId === where.clerkOrganizationId
            ? state.organization
            : null;
        }
        if (where.id) return state.organization?.id === where.id ? state.organization : null;
        return null;
      },
      async findFirst() {
        return null;
      },
      async upsert({ create, update }) {
        calls.push('organization.upsert');
        state.organization = state.organization
          ? { ...state.organization, ...update }
          : { id: 'db_organization', metadata: {}, ...create };
        return state.organization;
      },
      async update() {
        throw new Error('Unexpected organization update path.');
      },
    },
    tenantMembership: {
      async findUnique() {
        return state.membership;
      },
      async upsert({ create, update }) {
        calls.push('tenantMembership.upsert');
        state.membership = state.membership
          ? { ...state.membership, ...update }
          : { id: 'db_membership', ...create };
        return state.membership;
      },
    },
  };
  const database = {
    ...transaction,
    async $transaction(callback, options) {
      calls.push(`transaction-${options?.isolationLevel || 'default'}`);
      return callback(transaction);
    },
  };
  return { calls, database };
}

test('CLI is strict and dry-run is the default', () => {
  const dryRun = parseClerkMembershipReconciliationArgs([
    '--organization-id', 'org_Test123',
    '--user-id', 'user_Test123',
    '--expected-instance-id', 'ins_Test123',
  ]);
  assert.equal(dryRun.apply, false);

  const apply = parseClerkMembershipReconciliationArgs([
    '--organization-id', 'org_Test123',
    '--user-id', 'user_Test123',
    '--expected-instance-id', 'ins_Test123',
    '--apply',
  ]);
  assert.equal(apply.apply, true);
  assert.throws(() => parseClerkMembershipReconciliationArgs([]));
  assert.throws(() => parseClerkMembershipReconciliationArgs([
    '--organization-id', 'org_Test123',
    '--organization-id', 'org_Other123',
    '--user-id', 'user_Test123',
    '--expected-instance-id', 'ins_Test123',
  ]));
  assert.throws(() => parseClerkMembershipReconciliationArgs([
    '--organization-id', 'not-an-org',
    '--user-id', 'user_Test123',
    '--expected-instance-id', 'ins_Test123',
  ]));
});

test('Preview authorization reuses the Neon identity gate and rejects production targets', () => {
  const authorization = authorizePreviewReconciliationDatabase(previewEnvironment());
  assert.equal(authorization.environment, 'preview');
  assert.equal(authorization.provider, 'neon');

  assert.throws(() => authorizePreviewReconciliationDatabase(
    previewEnvironment({ DIRECT_URL: PRODUCTION_URL, DATABASE_URL: PRODUCTION_URL }),
  ));
  assert.throws(() => authorizePreviewReconciliationDatabase(
    previewEnvironment({
      DIRECT_URL: PRODUCTION_URL,
      DATABASE_URL: PRODUCTION_URL,
      [PRODUCTION_DATABASE_IDENTITY_ENV]: 'a'.repeat(64),
    }),
  ));
  assert.throws(() => authorizePreviewReconciliationDatabase(
    previewEnvironment({ [PREVIEW_DATABASE_IDENTITY_ENV]: 'b'.repeat(64) }),
  ));
  assert.throws(() => authorizePreviewReconciliationDatabase(
    previewEnvironment({ VERCEL_ENV: 'production' }),
  ));
});

test('instance verification requires the exact expected development instance', () => {
  assert.equal(assertExpectedPreviewClerkInstance({
    id: 'ins_Test123',
    environment_type: 'development',
  }, 'ins_Test123'), true);
  assert.equal(assertExpectedPreviewClerkInstance({
    id: 'ins_Test123',
    environmentType: 'development',
  }, 'ins_Test123'), true);
  assert.throws(() => assertExpectedPreviewClerkInstance({
    id: 'ins_Other123',
    environment_type: 'development',
  }, 'ins_Test123'));
  assert.throws(() => assertExpectedPreviewClerkInstance({
    id: 'ins_Test123',
    environment_type: 'production',
  }, 'ins_Test123'));
});

test('Clerk BAPI client issues GET-only reads and sanitizes provider failures', async () => {
  const requests = [];
  const sdkCalls = [];
  const timeoutSignals = [];
  const client = createClerkBapiReadClient({
    secretKey: 'sk_test_do-not-log',
    instanceReadTimeoutMs: 4_000,
    abortSignalFactory(timeoutMs) {
      timeoutSignals.push(timeoutMs);
      return AbortSignal.abort();
    },
    sdkClientFactory() {
      return {
        users: {
          async getUser() {
            sdkCalls.push('getUser');
            return clerkUser();
          },
        },
        organizations: {
          async getOrganization() {
            sdkCalls.push('getOrganization');
            return clerkOrganization();
          },
          async getOrganizationMembershipList() {
            sdkCalls.push('getOrganizationMembershipList');
            return { data: [clerkMembership()] };
          },
          async getOrganizationInvitationList() {
            sdkCalls.push('getOrganizationInvitationList');
            return { data: [] };
          },
        },
      };
    },
    async fetchImpl(url, options) {
      requests.push({ url: String(url), options });
      return {
        ok: true,
        status: 200,
        async json() {
          return { id: 'ins_Test123', environment_type: 'development' };
        },
      };
    },
  });
  await client.getInstance();
  await client.getUser('user_Test123');
  await client.getOrganization('org_Test123');
  await client.organizations.getOrganizationMembershipList({
    organizationId: 'org_Test123',
    userId: ['user_Test123'],
    limit: 10,
  });
  await client.getAcceptedOrganizationInvitations('org_Test123');
  assert.deepEqual(requests.map(({ options }) => options.method), ['GET']);
  assert.equal(requests[0].url, 'https://api.clerk.com/v1/instance');
  assert.deepEqual(timeoutSignals, [4_000]);
  assert.equal(requests[0].options.headers['Clerk-API-Version'], '2026-05-12');
  assert.equal(requests[0].options.signal.aborted, true);
  assert.deepEqual(sdkCalls, [
    'getUser',
    'getOrganization',
    'getOrganizationMembershipList',
    'getOrganizationInvitationList',
  ]);
  assert.equal(Object.keys(client).some((name) => /create|update|delete/i.test(name)), false);

  const failing = createClerkBapiReadClient({
    secretKey: 'sk_test_do-not-log',
    async fetchImpl() {
      throw new Error('sk_test_do-not-log user_Test123 worker@example.com');
    },
  });
  const error = await failing.getInstance().catch((caught) => caught);
  const serialized = JSON.stringify(safeClerkMembershipReconciliationError(error));
  assert.equal(serialized.includes('sk_test_do-not-log'), false);
  assert.equal(serialized.includes('user_Test123'), false);
  assert.equal(serialized.includes('worker@example.com'), false);
});

test('new memberships resolve to least privilege unless authoritative evidence grants more', async () => {
  const database = readOnlyDatabase();
  const leastPrivilege = await buildClerkMembershipReconciliationPlan(
    database,
    authoritativeState(),
  );
  assert.deepEqual(leastPrivilege.summary, {
    user: 'create',
    organization: 'create',
    membership: 'create',
    membershipStatus: 'ACTIVE',
    tenantRole: 'AUDITOR',
    invitationEvidence: 'not_found',
    projectAccessReset: false,
  });

  const invited = await buildClerkMembershipReconciliationPlan(
    database,
    authoritativeState({
      invitationLookup: {
        available: true,
        invitations: [{
          status: 'accepted',
          emailAddress: 'worker@example.com',
          role: 'org:member',
          publicMetadata: { obrasaasTenantRole: 'SITE_MANAGER' },
          updatedAt: 1,
        }],
      },
    }),
  );
  assert.equal(invited.summary.tenantRole, 'SITE_MANAGER');
  assert.equal(invited.summary.invitationEvidence, 'matched');
});

test('authoritative targeting rejects an absent or different Clerk membership', async () => {
  const clerk = clerkReadDouble();
  clerk.organizations.getOrganizationMembershipList = async () => ({
    data: [clerkMembership({ publicUserData: { userId: 'user_Other123' } })],
    totalCount: 1,
  });
  await assert.rejects(() => loadAuthoritativeClerkMembershipState(clerk, {
    organizationId: 'org_Test123',
    userId: 'user_Test123',
  }), (error) => error.code === 'RECONCILIATION_CLERK_TARGET_INVALID');
});

test('narrow reconciliation rejects transitions that require project-access reset', async () => {
  const user = { id: 'db_user', clerkUserId: 'user_Test123', primaryEmail: 'worker@example.com' };
  const organization = {
    id: 'db_organization',
    clerkOrganizationId: 'org_Test123',
    metadata: {},
  };
  const membership = {
    id: 'db_membership',
    clerkRole: 'org:admin',
    tenantRole: 'ADMIN',
    status: 'ACTIVE',
  };
  await assert.rejects(() => buildClerkMembershipReconciliationPlan(
    readOnlyDatabase({ user, organization, membership }),
    authoritativeState({
      clerkRole: 'org:finance',
      membership: clerkMembership({ role: 'org:finance' }),
    }),
  ), (error) => error.code === 'RECONCILIATION_PROJECT_ACCESS_RESET_REQUIRED');
});

test('dry-run performs no transaction or upsert, while apply uses one transaction and only three identity upserts', async () => {
  const authorization = authorizePreviewReconciliationDatabase(previewEnvironment());
  const dry = mutableDatabase();
  const dryResult = await reconcileClerkMembership({
    database: dry.database,
    clerk: clerkReadDouble(),
    organizationId: 'org_Test123',
    userId: 'user_Test123',
    expectedInstanceId: 'ins_Test123',
    databaseAuthorization: authorization,
  });
  assert.equal(dryResult.applied, false);
  assert.deepEqual(dry.calls, []);

  const applying = mutableDatabase();
  const applyResult = await reconcileClerkMembership({
    database: applying.database,
    clerk: clerkReadDouble(),
    organizationId: 'org_Test123',
    userId: 'user_Test123',
    expectedInstanceId: 'ins_Test123',
    apply: true,
    databaseAuthorization: authorization,
  });
  assert.equal(applyResult.applied, true);
  assert.deepEqual(applying.calls, [
    'transaction-Serializable',
    'identity-lock-exclusive',
    'organization.upsert',
    'platformUser.upsert',
    'tenantMembership.upsert',
  ]);
});
