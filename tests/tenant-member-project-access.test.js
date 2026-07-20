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

function platformAccess() {
  return {
    databaseUserId: 'actor-a',
    isSuperadmin: false,
    orgId: 'org_clerk_a',
    tenantRole: 'ADMIN',
    organization: { id: 'organization-a' },
    subscription: { canRead: true, canWrite: true },
  };
}

function membership(tenantRole) {
  return {
    id: 'membership-a',
    clerkRole: 'org:member',
    tenantRole,
    status: 'ACTIVE',
    user: {
      fullName: 'Dirección Técnica',
      primaryEmail: 'direccion@obra.com',
      avatarUrl: null,
    },
    updatedAt: new Date('2026-07-17T06:00:00.000Z'),
  };
}

function request(tenantRole) {
  return new Request('http://localhost/api/tenant/members', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ membershipId: 'membership-a', tenantRole }),
  });
}

function prismaDouble({ previousRole, nextRole, targetMembership = membership(previousRole) }) {
  const calls = [];
  const prisma = {
    tenantMembership: {
      async findFirst(args) {
        calls.push(['find', args]);
        return targetMembership;
      },
    },
    async $transaction(callback) {
      calls.push(['transaction']);
      return callback({
        tenantMembership: {
          async update(args) {
            calls.push(['update', args]);
            return membership(nextRole);
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
      });
    },
  };
  return { calls, prisma };
}

function callNames(calls) {
  return calls.map(([name]) => name);
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
  assert.deepEqual(callNames(calls), ['find', 'transaction', 'update', 'reset', 'audit']);
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

test('member role updates reject cross-tenant membership IDs before a transaction', async () => {
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
  assert.equal(callNames(calls).includes('transaction'), false);
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
