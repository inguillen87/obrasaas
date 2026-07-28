import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    const mocks = {
      '@clerk/nextjs/server': 'mock:clerk-server',
      '@/lib/prisma': 'mock:prisma',
      'next/headers': 'mock:next-headers',
      react: 'mock:react',
    };
    if (mocks[specifier]) return { url: mocks[specifier], shortCircuit: true };
    if (specifier.startsWith('@/')) {
      return nextResolve(
        new URL(`../src/${specifier.slice(2)}.js`, import.meta.url).href,
        context,
      );
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === 'mock:clerk-server') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export async function auth() { throw new Error('Unexpected auth call.'); }
          export async function clerkClient() { throw new Error('Unexpected client call.'); }
        `,
      };
    }
    if (url === 'mock:prisma') {
      return {
        format: 'module',
        shortCircuit: true,
        source: 'export function getPrisma() { throw new Error("Unexpected Prisma call."); }',
      };
    }
    if (url === 'mock:next-headers') {
      return {
        format: 'module',
        shortCircuit: true,
        source: 'export async function cookies() { throw new Error("Unexpected cookies call."); }',
      };
    }
    if (url === 'mock:react') {
      return {
        format: 'module',
        shortCircuit: true,
        source: 'export function cache(callback) { return callback; }',
      };
    }
    return nextLoad(url, context);
  },
});

const { resolveLockedPlatformIdentity } = await import('../src/lib/access.js');

const SESSION = Object.freeze({
  userId: 'user_Test123',
  orgId: 'org_Test123',
  orgSlug: 'tenant-test',
  orgRole: 'org:member',
});

function identityDouble({
  membership = {
    id: 'membership_db',
    organizationId: 'organization_db',
    userId: 'user_db',
    clerkRole: 'org:finance',
    tenantRole: 'FINANCE',
    status: 'ACTIVE',
  },
  clerkRoleBeforeLock = 'org:finance',
  clerkRoleAfterLock = clerkRoleBeforeLock,
  clerkMembershipPresent = true,
  acceptedInvitations = [],
} = {}) {
  const calls = [];
  const state = {
    clerkRole: clerkRoleBeforeLock,
    userVersion: 'Old',
    organizationName: 'Old Organization',
    user: {
      id: 'user_db',
      clerkUserId: SESSION.userId,
      primaryEmail: 'worker@example.com',
      fullName: 'Old User',
      avatarUrl: null,
      systemRole: 'TENANT_USER',
    },
    organization: {
      id: 'organization_db',
      clerkOrganizationId: SESSION.orgId,
      name: 'Old Organization',
      slug: 'tenant-test',
      metadata: {},
      subscriptionPlan: 'TRIAL',
      subscriptionStatus: 'TRIALING',
      trialEndsAt: new Date('2026-08-01T00:00:00.000Z'),
    },
    membership: membership ? { ...membership } : null,
  };

  const transaction = {
    async $queryRawUnsafe(query, _lockNamespace, identityKey) {
      if (query.includes('pg_advisory_xact_lock_shared')) {
        calls.push('lock:shared');
        state.clerkRole = clerkRoleAfterLock;
        state.userVersion = 'Fresh';
        state.organizationName = 'Fresh Organization';
        return [{ locked: 1 }];
      }
      assert.match(query, /pg_advisory_xact_lock\(/);
      calls.push(`lock:identity:${identityKey}`);
      return [{ locked: 1 }];
    },
    platformUser: {
      async findUnique({ where }) {
        if (where.clerkUserId) calls.push('db:user-by-clerk');
        else if (where.primaryEmail) calls.push('db:user-by-email');
        else calls.push('db:user-bound');
        if (where.clerkUserId && state.user.clerkUserId !== where.clerkUserId) return null;
        if (where.primaryEmail && state.user.primaryEmail !== where.primaryEmail) return null;
        if (where.id && state.user.id !== where.id) return null;
        return { ...state.user };
      },
      async upsert({ update }) {
        calls.push('db:user-upsert');
        state.user = { ...state.user, ...update };
        return { ...state.user };
      },
    },
    organization: {
      async findUnique({ where }) {
        if (where.clerkOrganizationId) calls.push('db:organization-by-clerk');
        else calls.push('db:organization-bound');
        if (
          where.clerkOrganizationId
          && state.organization.clerkOrganizationId !== where.clerkOrganizationId
        ) return null;
        if (where.id && state.organization.id !== where.id) return null;
        return { ...state.organization };
      },
      async update({ data }) {
        calls.push('db:organization-update');
        state.organization = { ...state.organization, ...data };
        return { ...state.organization };
      },
    },
    tenantMembership: {
      async findUnique() {
        calls.push('db:membership-read');
        return state.membership ? { ...state.membership } : null;
      },
      async upsert({ create, update }) {
        calls.push('db:membership-upsert');
        state.membership = state.membership
          ? { ...state.membership, ...update }
          : { id: 'membership_db', status: 'ACTIVE', ...create };
        return { ...state.membership };
      },
    },
    projectMembership: {
      async updateMany() {
        calls.push('db:project-access-reset');
        return { count: 0 };
      },
    },
    auditLog: {
      async create() {
        calls.push('db:audit');
      },
    },
  };
  const database = {
    async $queryRawUnsafe() {},
    async $transaction(callback, options) {
      calls.push(`transaction:${options?.isolationLevel || 'default'}`);
      return callback(transaction);
    },
  };
  const clerk = {
    users: {
      async getUser() {
        calls.push('clerk:user-read');
        return {
          id: SESSION.userId,
          primaryEmailAddressId: 'email_primary',
          emailAddresses: [{
            id: 'email_primary',
            emailAddress: 'worker@example.com',
            verification: { status: 'verified' },
          }],
          firstName: state.userVersion,
          lastName: 'User',
          imageUrl: null,
        };
      },
    },
    organizations: {
      async getOrganization() {
        calls.push('clerk:organization-read');
        return {
          id: SESSION.orgId,
          name: state.organizationName,
          slug: 'tenant-test',
          publicMetadata: {},
          privateMetadata: {},
        };
      },
      async getOrganizationMembershipList() {
        calls.push('clerk:membership-read');
        if (!clerkMembershipPresent) {
          return { data: [], totalCount: 0 };
        }
        return {
          data: [{
            id: 'membership_clerk',
            role: state.clerkRole,
            publicUserData: { userId: SESSION.userId },
            organization: { id: SESSION.orgId },
            publicMetadata: {},
          }],
          totalCount: 1,
        };
      },
      async getOrganizationInvitationList() {
        calls.push('clerk:invitation-read');
        return { data: acceptedInvitations };
      },
    },
  };

  return { calls, clerk, database, state };
}

function index(calls, name) {
  const position = calls.indexOf(name);
  assert.notEqual(position, -1, `${name} was not observed`);
  return position;
}

test('session identity fetches and FINANCE to AUDITOR repair occur after the shared lock', async () => {
  const scenario = identityDouble({
    clerkRoleBeforeLock: 'org:finance',
    clerkRoleAfterLock: 'org:auditor',
  });

  const identity = await resolveLockedPlatformIdentity({
    prisma: scenario.database,
    clerk: scenario.clerk,
    session: SESSION,
  });

  const lock = index(scenario.calls, 'lock:shared');
  const membershipLock = index(
    scenario.calls,
    `lock:identity:clerk:membership:${SESSION.orgId}:${SESSION.userId}`,
  );
  const userLock = index(
    scenario.calls,
    `lock:identity:clerk:user:${SESSION.userId}`,
  );
  assert.ok(membershipLock > lock);
  assert.ok(index(scenario.calls, 'clerk:user-read') > lock);
  assert.ok(membershipLock > userLock);
  assert.ok(index(scenario.calls, 'clerk:user-read') > membershipLock);
  assert.ok(index(scenario.calls, 'db:user-upsert') > index(scenario.calls, 'clerk:user-read'));
  assert.ok(index(scenario.calls, 'clerk:organization-read') > lock);
  assert.ok(
    index(scenario.calls, 'db:organization-update')
      > index(scenario.calls, 'clerk:organization-read'),
  );
  assert.ok(index(scenario.calls, 'clerk:membership-read') > lock);
  assert.ok(
    index(scenario.calls, 'db:membership-upsert')
      > index(scenario.calls, 'clerk:membership-read'),
  );
  assert.equal(identity.user.fullName, 'Fresh User');
  assert.equal(identity.organization.name, 'Fresh Organization');
  assert.equal(identity.membership.clerkRole, 'org:auditor');
  assert.equal(identity.membership.tenantRole, 'AUDITOR');
  assert.equal(scenario.calls.includes('db:project-access-reset'), false);
});

test('new-lifecycle invitation evidence and role calculation stay inside the shared lock', async () => {
  const scenario = identityDouble({
    membership: null,
    clerkRoleBeforeLock: 'org:member',
    acceptedInvitations: [{
      id: 'invitation_clerk',
      status: 'accepted',
      emailAddress: 'worker@example.com',
      role: 'org:member',
      publicMetadata: { obrasaasTenantRole: 'FINANCE' },
      updatedAt: 1,
    }],
  });

  const identity = await resolveLockedPlatformIdentity({
    prisma: scenario.database,
    clerk: scenario.clerk,
    session: SESSION,
  });

  const lock = index(scenario.calls, 'lock:shared');
  const membershipRead = index(scenario.calls, 'clerk:membership-read');
  const invitationRead = index(scenario.calls, 'clerk:invitation-read');
  const membershipWrite = index(scenario.calls, 'db:membership-upsert');
  assert.ok(membershipRead > lock);
  assert.ok(invitationRead > membershipRead);
  assert.ok(membershipWrite > invitationRead);
  assert.equal(identity.membership.tenantRole, 'FINANCE');
});

test('missing Clerk membership is disabled before the resolver returns its denial sentinel', async () => {
  const scenario = identityDouble({ clerkMembershipPresent: false });

  const identity = await resolveLockedPlatformIdentity({
    prisma: scenario.database,
    clerk: scenario.clerk,
    session: SESSION,
  });

  const lock = index(scenario.calls, 'lock:shared');
  const membershipRead = index(scenario.calls, 'clerk:membership-read');
  const membershipWrite = index(scenario.calls, 'db:membership-upsert');
  assert.ok(membershipRead > lock);
  assert.ok(membershipWrite > membershipRead);
  assert.equal(identity.membershipMissing, true);
  assert.equal(identity.membership, null);
  assert.equal(scenario.state.membership.status, 'DISABLED');
  assert.equal(scenario.calls.includes('clerk:invitation-read'), false);
});
