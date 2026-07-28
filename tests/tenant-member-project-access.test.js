import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@clerk/nextjs/server') {
      return { url: 'mock:clerk-nextjs-server', shortCircuit: true };
    }
    if (specifier === 'next/headers') {
      return { url: 'mock:next-headers', shortCircuit: true };
    }
    if (specifier.startsWith('@/')) {
      const extension = specifier.startsWith('@/generated/') ? '.ts' : '.js';
      const sourcePath = new URL(`../src/${specifier.slice(2)}${extension}`, import.meta.url);
      return nextResolve(sourcePath.href, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === 'mock:clerk-nextjs-server') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export async function auth() { throw new Error('Unexpected auth call.'); }
          export async function clerkClient() { throw new Error('Unexpected Clerk call.'); }
        `,
      };
    }
    if (url === 'mock:next-headers') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `export async function cookies() { throw new Error('Unexpected cookie call.'); }`,
      };
    }
    return nextLoad(url, context);
  },
});

const { patchTenantMemberRole } = await import(
  '../src/app/api/tenant/members/route.js'
);
const { hasTenantPermission } = await import('../src/lib/access.js');
const {
  clerkIdentityRuntimeLockKeys,
  withClerkIdentitySyncLock,
} = await import('../src/lib/clerk-identity-lock.js');

function deferred() {
  let resolve;
  const promise = new Promise((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function platformAccess() {
  return {
    databaseUserId: 'actor-a',
    isSuperadmin: false,
    orgId: 'org_clerk_a',
    tenantRole: 'ADMIN',
    tenantMembershipId: 'actor-membership-a',
    organization: { id: 'organization-a' },
    subscription: { canRead: true, canWrite: true },
  };
}

function membership(tenantRole, overrides = {}) {
  return {
    id: 'membership-a',
    organizationId: 'organization-a',
    userId: 'target-user-a',
    clerkRole: 'org:member',
    tenantRole,
    status: 'ACTIVE',
    user: {
      clerkUserId: 'user_clerk_target_a',
      fullName: 'Dirección Técnica',
      primaryEmail: 'direccion@obra.com',
      avatarUrl: null,
    },
    updatedAt: new Date('2026-07-17T06:00:00.000Z'),
    ...overrides,
  };
}

function request(tenantRole) {
  return new Request('http://localhost/api/tenant/members', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ membershipId: 'membership-a', tenantRole }),
  });
}

function prismaDouble({
  previousRole,
  nextRole,
  targetMembership = membership(previousRole),
  actorMembership: actorMembershipOverride = null,
  organization: organizationOverride = null,
}) {
  const calls = [];
  let currentMembership = targetMembership ? structuredClone(targetMembership) : null;
  if (currentMembership) currentMembership.updatedAt = targetMembership.updatedAt;
  const actorMembership = actorMembershipOverride || {
    id: 'actor-membership-a',
    organizationId: 'organization-a',
    userId: 'actor-a',
    clerkRole: 'org:admin',
    tenantRole: 'ADMIN',
    status: 'ACTIVE',
  };
  const tx = {
    async $queryRawUnsafe(query, _namespace, identityKey) {
      if (query.includes('pg_advisory_xact_lock_shared')) {
        calls.push(['lock:shared']);
      } else if (query.includes('FOR NO KEY UPDATE')) {
        calls.push(['lock:rows']);
      } else {
        calls.push(['lock:identity', identityKey]);
      }
      return [{ locked: 1 }];
    },
    organization: {
      async findUnique(args) {
        calls.push(['organization', args]);
        return organizationOverride || {
          clerkOrganizationId: 'org_clerk_a',
          metadata: {},
          subscriptionPlan: 'PRO',
          subscriptionStatus: 'ACTIVE',
          trialEndsAt: null,
        };
      },
    },
    tenantMembership: {
      async findFirst(args) {
        const identityRead = Boolean(args.select);
        calls.push([identityRead ? 'find:identity' : 'find:authoritative', args]);
        if (!currentMembership) return null;
        if (identityRead) {
          return { user: { clerkUserId: currentMembership.user.clerkUserId } };
        }
        return structuredClone(currentMembership);
      },
      async findUnique(args) {
        calls.push(['find:actor', args]);
        return { ...actorMembership };
      },
      async update(args) {
        calls.push(['update', args]);
        currentMembership = membership(nextRole, {
          ...currentMembership,
          tenantRole: nextRole,
          user: { ...currentMembership.user },
        });
        return structuredClone(currentMembership);
      },
    },
    projectMembership: {
      async updateMany(args) {
        calls.push(['reset', args]);
        return { count: 4 };
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
    async $queryRawUnsafe() {},
    async $transaction(callback, options) {
      calls.push(['transaction']);
      assert.equal(options.timeout, 30_000);
      return callback(tx);
    },
  };
  return { calls, prisma };
}

function callNames(calls) {
  return calls.map(([name]) => name);
}

function concurrentMembershipDatabase() {
  const effects = [];
  const lockStates = new Map();
  const contentionObserved = deferred();
  const state = {
    organization: {
      clerkOrganizationId: 'org_clerk_a',
      metadata: {},
      subscriptionPlan: 'PRO',
      subscriptionStatus: 'ACTIVE',
      trialEndsAt: null,
    },
    actor: {
      id: 'actor-membership-a',
      organizationId: 'organization-a',
      userId: 'actor-a',
      clerkRole: 'org:admin',
      tenantRole: 'ADMIN',
      status: 'ACTIVE',
    },
    target: membership('ADMIN', { clerkRole: 'org:admin' }),
    patchWrites: 0,
  };

  const acquire = async (identityKey, transaction) => {
    let lockState = lockStates.get(identityKey);
    if (!lockState) {
      lockState = { owner: null, waiters: [] };
      lockStates.set(identityKey, lockState);
    }
    if (lockState.owner === transaction) {
      effects.push(`lock:reentrant:${identityKey}`);
      return;
    }
    if (!lockState.owner) {
      lockState.owner = transaction;
      transaction.acquired.push(identityKey);
      effects.push(`lock:acquired:${identityKey}`);
      return;
    }
    effects.push(`lock:waiting:${identityKey}`);
    contentionObserved.resolve(identityKey);
    await new Promise((resolve) => {
      lockState.waiters.push({ resolve, transaction });
    });
    transaction.acquired.push(identityKey);
    effects.push(`lock:acquired:${identityKey}`);
  };
  const release = (identityKey, transaction) => {
    const lockState = lockStates.get(identityKey);
    assert.equal(lockState?.owner, transaction);
    const next = lockState.waiters.shift();
    if (next) {
      lockState.owner = next.transaction;
      next.resolve();
    } else {
      lockStates.delete(identityKey);
    }
  };
  const database = {
    async $queryRawUnsafe() {},
    async $transaction(callback) {
      const transaction = {
        acquired: [],
        async $queryRawUnsafe(query, _namespace, identityKey) {
          if (query.includes('pg_advisory_xact_lock_shared')) {
            effects.push('lock:shared');
            return [{ locked: 1 }];
          }
          if (query.includes('FOR NO KEY UPDATE')) {
            effects.push('patch:rows-locked');
            return [{ id: state.actor.id }, { id: state.target.id }];
          }
          await acquire(identityKey, transaction);
          return [{ locked: 1 }];
        },
        organization: {
          async findUnique() {
            effects.push('patch:organization-read');
            return { ...state.organization };
          },
        },
        tenantMembership: {
          async findFirst(args) {
            if (args.select) {
              effects.push(`patch:identity-read:${state.target.clerkRole}`);
              return { user: { clerkUserId: state.target.user.clerkUserId } };
            }
            effects.push(`patch:authoritative-read:${state.target.clerkRole}`);
            return structuredClone(state.target);
          },
          async findUnique() {
            effects.push(`patch:actor-read:${state.actor.tenantRole}`);
            return { ...state.actor };
          },
          async update({ data }) {
            state.patchWrites += 1;
            state.target = { ...state.target, ...data };
            effects.push(`patch:write:${data.tenantRole}`);
            return structuredClone(state.target);
          },
        },
        projectMembership: {
          async updateMany() {
            effects.push('patch:project-reset');
            return { count: 0 };
          },
        },
        auditLog: {
          async create() {
            effects.push('patch:audit');
          },
        },
      };
      try {
        return await callback(transaction);
      } finally {
        for (const identityKey of transaction.acquired.reverse()) {
          release(identityKey, transaction);
        }
      }
    },
  };
  return { contentionObserved, database, effects, state };
}

test('portfolio to restricted role reset is atomic and clears client assignment state', async () => {
  const { calls, prisma } = prismaDouble({
    previousRole: 'DIRECTOR',
    nextRole: 'SITE_MANAGER',
  });
  const response = await patchTenantMemberRole(request('SITE_MANAGER'), {
    resolveAccess: async () => platformAccess(),
    prismaFactory: () => prisma,
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(payload.membership.projectIds, []);
  assert.equal(payload.membership.tenantRole, 'SITE_MANAGER');
  assert.deepEqual(
    calls.filter(([name]) => name === 'lock:identity').map(([, identityKey]) => identityKey),
    [
      'clerk:organization:org_clerk_a',
      'clerk:organization:org_clerk_a',
      'clerk:user:user_clerk_target_a',
      'clerk:membership:org_clerk_a:user_clerk_target_a',
    ],
  );
  assert.ok(callNames(calls).indexOf('find:authoritative') < callNames(calls).indexOf('update'));
  assert.ok(callNames(calls).indexOf('lock:rows') < callNames(calls).indexOf('find:actor'));
  assert.deepEqual(calls.find(([name]) => name === 'reset')[1], {
    where: { tenantMembershipId: 'membership-a', status: 'ACTIVE' },
    data: { status: 'DISABLED' },
  });
  assert.equal(
    calls.find(([name]) => name === 'audit')[1].data.metadata.resetProjectAccessCount,
    4,
  );
});

test('restricted role changes preserve explicit project assignments', async () => {
  const { calls, prisma } = prismaDouble({
    previousRole: 'SITE_MANAGER',
    nextRole: 'FINANCE',
  });
  const response = await patchTenantMemberRole(request('FINANCE'), {
    resolveAccess: async () => platformAccess(),
    prismaFactory: () => prisma,
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(Object.hasOwn(payload.membership, 'projectIds'), false);
  assert.equal(callNames(calls).includes('reset'), false);
});

test('a concurrent Clerk admin downgrade is authoritative and PATCH never restores ADMIN', async () => {
  const scenario = concurrentMembershipDatabase();
  const webhookMayFinish = deferred();
  const webhookHasLocks = deferred();
  const identityKeys = clerkIdentityRuntimeLockKeys({
    clerkOrganizationId: 'org_clerk_a',
    clerkUserId: 'user_clerk_target_a',
  });
  const webhook = withClerkIdentitySyncLock(
    scenario.database,
    async () => {
      scenario.effects.push('webhook:locked');
      webhookHasLocks.resolve();
      await webhookMayFinish.promise;
      scenario.state.target = membership('AUDITOR', { clerkRole: 'org:auditor' });
      scenario.effects.push('webhook:write:AUDITOR');
    },
    { identityKeys },
  );
  await webhookHasLocks.promise;

  const patch = patchTenantMemberRole(request('ADMIN'), {
    resolveAccess: async () => platformAccess(),
    prismaFactory: () => scenario.database,
  });
  assert.equal(
    await scenario.contentionObserved.promise,
    'clerk:organization:org_clerk_a',
  );
  assert.equal(scenario.state.patchWrites, 0);

  webhookMayFinish.resolve();
  const [, response] = await Promise.all([webhook, patch]);

  assert.equal(response.status, 409);
  assert.equal(scenario.state.target.clerkRole, 'org:auditor');
  assert.equal(scenario.state.target.tenantRole, 'AUDITOR');
  assert.equal(scenario.state.patchWrites, 0);
  assert.ok(
    scenario.effects.indexOf('patch:authoritative-read:org:auditor')
      > scenario.effects.indexOf('webhook:write:AUDITOR'),
  );
});

test('a concurrent organization suspension blocks PATCH after it acquires the tenant lock', async () => {
  const scenario = concurrentMembershipDatabase();
  scenario.state.target = membership('SITE_MANAGER');
  const suspensionMayFinish = deferred();
  const suspensionHasLock = deferred();
  const suspension = withClerkIdentitySyncLock(
    scenario.database,
    async () => {
      scenario.effects.push('suspension:locked');
      suspensionHasLock.resolve();
      await suspensionMayFinish.promise;
      scenario.state.organization.subscriptionStatus = 'SUSPENDED';
      scenario.effects.push('suspension:write:SUSPENDED');
    },
    {
      identityKeys: clerkIdentityRuntimeLockKeys({
        clerkOrganizationId: 'org_clerk_a',
      }),
    },
  );
  await suspensionHasLock.promise;

  const patch = patchTenantMemberRole(request('FINANCE'), {
    resolveAccess: async () => platformAccess(),
    prismaFactory: () => scenario.database,
  });
  assert.equal(
    await scenario.contentionObserved.promise,
    'clerk:organization:org_clerk_a',
  );
  suspensionMayFinish.resolve();
  const [, response] = await Promise.all([suspension, patch]);

  assert.equal(response.status, 402);
  assert.equal((await response.json()).code, 'SUBSCRIPTION_READ_ONLY');
  assert.equal(scenario.state.organization.subscriptionStatus, 'SUSPENDED');
  assert.equal(scenario.state.target.tenantRole, 'SITE_MANAGER');
  assert.equal(scenario.state.patchWrites, 0);
  assert.ok(
    scenario.effects.indexOf('patch:organization-read')
      > scenario.effects.indexOf('suspension:write:SUSPENDED'),
  );
});

test('member role updates revalidate the actor after acquiring identity locks', async () => {
  const { calls, prisma } = prismaDouble({
    previousRole: 'SITE_MANAGER',
    nextRole: 'FINANCE',
    actorMembership: {
      id: 'actor-membership-a',
      organizationId: 'organization-a',
      userId: 'actor-a',
      clerkRole: 'org:auditor',
      tenantRole: 'AUDITOR',
      status: 'ACTIVE',
    },
  });

  const response = await patchTenantMemberRole(request('FINANCE'), {
    resolveAccess: async () => platformAccess(),
    prismaFactory: () => prisma,
  });

  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, 'PERMISSION_REQUIRED');
  assert.equal(callNames(calls).includes('find:actor'), true);
  assert.equal(callNames(calls).includes('update'), false);
  assert.equal(callNames(calls).includes('audit'), false);
});

test('member role updates revalidate tenant suspension after acquiring identity locks', async () => {
  const { calls, prisma } = prismaDouble({
    previousRole: 'SITE_MANAGER',
    nextRole: 'FINANCE',
    organization: {
      clerkOrganizationId: 'org_clerk_a',
      metadata: {},
      subscriptionPlan: 'PRO',
      subscriptionStatus: 'SUSPENDED',
      trialEndsAt: null,
    },
  });

  const response = await patchTenantMemberRole(request('FINANCE'), {
    resolveAccess: async () => platformAccess(),
    prismaFactory: () => prisma,
  });

  assert.equal(response.status, 402);
  assert.equal((await response.json()).code, 'SUBSCRIPTION_READ_ONLY');
  assert.equal(callNames(calls).includes('organization'), true);
  assert.equal(callNames(calls).includes('update'), false);
  assert.equal(callNames(calls).includes('audit'), false);
});

test('member role updates reject cross-tenant membership IDs inside the locked transaction', async () => {
  const { calls, prisma } = prismaDouble({
    previousRole: 'DIRECTOR',
    nextRole: 'SITE_MANAGER',
    targetMembership: null,
  });
  const response = await patchTenantMemberRole(request('SITE_MANAGER'), {
    resolveAccess: async () => platformAccess(),
    prismaFactory: () => prisma,
  });

  assert.equal(response.status, 404);
  assert.deepEqual(callNames(calls), [
    'transaction',
    'lock:shared',
    'lock:identity',
    'find:identity',
  ]);
});

test('member role updates reject the internal workspace before reading memberships', async () => {
  const { calls, prisma } = prismaDouble({
    previousRole: 'DIRECTOR',
    nextRole: 'SITE_MANAGER',
  });
  const response = await patchTenantMemberRole(request('SITE_MANAGER'), {
    resolveAccess: async () => ({
      ...platformAccess(),
      isSuperadmin: true,
      organization: {
        id: 'organization-internal',
        metadata: { internal: true },
      },
    }),
    prismaFactory: () => prisma,
  });

  assert.equal(response.status, 403);
  assert.equal(
    (await response.json()).code,
    'INTERNAL_ORGANIZATION_MEMBERSHIP_FORBIDDEN',
  );
  assert.deepEqual(calls, []);
});

test('internal workspace never exposes tenant membership management controls', () => {
  assert.equal(hasTenantPermission({
    ...platformAccess(),
    isSuperadmin: true,
    organization: {
      id: 'organization-internal',
      metadata: { internal: true },
    },
  }, 'tenant:members:manage'), false);
});
