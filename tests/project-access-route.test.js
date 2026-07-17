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

const {
  MAX_PROJECTS_PER_MEMBERSHIP,
  ProjectAccessRouteError,
  createProjectAccessPatchHandler,
  normalizeProjectAccessInput,
} = await import('../src/app/api/tenant/project-access/route.js');

function access() {
  return {
    databaseUserId: 'actor-a',
    isSuperadmin: false,
    orgId: 'org_clerk_a',
    tenantRole: 'ADMIN',
    organization: { id: 'organization-a' },
    subscription: { canRead: true, canWrite: true },
  };
}

function membership(overrides = {}) {
  return {
    id: 'membership-a',
    tenantRole: 'SITE_MANAGER',
    status: 'ACTIVE',
    user: { primaryEmail: 'jefe@obra.com' },
    ...overrides,
  };
}

function prismaDouble({
  targetMembership = membership(),
  validProjectIds = ['project-a', 'project-b'],
  previousProjectIds = ['project-a'],
  transactionFailures = [],
} = {}) {
  const calls = [];
  let transactionAttempt = 0;
  const transaction = {
    async $executeRawUnsafe(query, lockKey) {
      calls.push(['lock', query, lockKey]);
    },
    tenantMembership: {
      async findFirst(args) {
        calls.push(['membership', args]);
        return targetMembership;
      },
    },
    project: {
      async findMany(args) {
        calls.push(['projects', args]);
        return validProjectIds.map((id) => ({ id }));
      },
    },
    projectMembership: {
      async findMany(args) {
        calls.push(['access-read', args]);
        return previousProjectIds.map((projectId) => ({ projectId }));
      },
      async deleteMany(args) {
        calls.push(['access-delete', args]);
        return { count: previousProjectIds.length };
      },
      async createMany(args) {
        calls.push(['access-create', args]);
        return { count: args.data.length };
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
    async $transaction(callback, options) {
      calls.push(['transaction', options]);
      const failure = transactionFailures[transactionAttempt];
      transactionAttempt += 1;
      if (failure) throw failure;
      return callback(transaction);
    },
  };
  return { calls, prisma };
}

function request(body) {
  return new Request('http://localhost/api/tenant/project-access', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function handler(prisma) {
  return createProjectAccessPatchHandler({
    resolveAccess: async () => access(),
    prismaFactory: () => prisma,
  });
}

function callsNamed(calls, name) {
  return calls.filter(([callName]) => callName === name);
}

test('project access input is strict, bounded, duplicate-free and deterministic', () => {
  assert.deepEqual(normalizeProjectAccessInput({
    membershipId: 'membership-a',
    projectIds: ['project-b', 'project-a'],
    expectedProjectIds: ['project-a'],
  }), {
    membershipId: 'membership-a',
    projectIds: ['project-a', 'project-b'],
    expectedProjectIds: ['project-a'],
  });
  assert.throws(
    () => normalizeProjectAccessInput({
      membershipId: 'membership-a',
      projectIds: ['project-a', 'project-a'],
      expectedProjectIds: [],
    }),
    (error) => error instanceof ProjectAccessRouteError
      && error.code === 'PROJECT_ACCESS_DUPLICATE_PROJECT',
  );
  assert.throws(
    () => normalizeProjectAccessInput({
      membershipId: 'membership-a',
      projectIds: [],
      expectedProjectIds: [],
      organizationId: 'organization-b',
    }),
    (error) => error.code === 'PROJECT_ACCESS_UNKNOWN_FIELDS',
  );
  assert.throws(
    () => normalizeProjectAccessInput({
      membershipId: 'membership-a',
      projectIds: Array.from(
        { length: MAX_PROJECTS_PER_MEMBERSHIP + 1 },
        (_, index) => `project-${index}`,
      ),
      expectedProjectIds: [],
    }),
    (error) => error.code === 'PROJECT_ACCESS_PROJECT_LIMIT',
  );
  assert.throws(
    () => normalizeProjectAccessInput({
      membershipId: 'membership-a',
      projectIds: [],
    }),
    (error) => error.code === 'PROJECT_ACCESS_VERSION_REQUIRED',
  );
});

test('PATCH replaces the exact assignment set and records previous, next and diff atomically', async () => {
  const { calls, prisma } = prismaDouble();
  const response = await handler(prisma)(request({
    membershipId: 'membership-a',
    projectIds: ['project-b', 'project-a'],
    expectedProjectIds: ['project-a'],
  }));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), {
    projectAccess: {
      membershipId: 'membership-a',
      tenantRole: 'SITE_MANAGER',
      portfolioAccess: false,
      projectIds: ['project-a', 'project-b'],
      changed: true,
    },
  });
  assert.deepEqual(callsNamed(calls, 'transaction')[0][1], {
    isolationLevel: 'Serializable',
    maxWait: 5_000,
    timeout: 10_000,
  });
  assert.match(callsNamed(calls, 'lock')[0][1], /pg_advisory_xact_lock/);
  assert.equal(
    callsNamed(calls, 'lock')[0][2],
    'obrasaas:project-access:organization-a:membership-a',
  );
  assert.deepEqual(callsNamed(calls, 'membership')[0][1].where, {
    id: 'membership-a',
    organizationId: 'organization-a',
  });
  assert.deepEqual(callsNamed(calls, 'projects')[0][1].where, {
    id: { in: ['project-a', 'project-b'] },
    organizationId: 'organization-a',
    status: { not: 'ARCHIVED' },
  });
  assert.deepEqual(callsNamed(calls, 'access-read')[0][1].where, {
    tenantMembershipId: 'membership-a',
    status: 'ACTIVE',
    project: { status: { not: 'ARCHIVED' } },
  });
  assert.deepEqual(callsNamed(calls, 'access-delete')[0][1], {
    where: {
      tenantMembershipId: 'membership-a',
      project: { status: { not: 'ARCHIVED' } },
      OR: [
        { projectId: { notIn: ['project-a', 'project-b'] } },
        {
          projectId: { in: ['project-a', 'project-b'] },
          status: { not: 'ACTIVE' },
        },
      ],
    },
  });
  assert.deepEqual(callsNamed(calls, 'access-create')[0][1], {
    data: [
      { projectId: 'project-a', tenantMembershipId: 'membership-a', status: 'ACTIVE' },
      { projectId: 'project-b', tenantMembershipId: 'membership-a', status: 'ACTIVE' },
    ],
    skipDuplicates: true,
  });
  assert.deepEqual(callsNamed(calls, 'audit')[0][1].data.metadata, {
    userEmail: 'jefe@obra.com',
    tenantRole: 'SITE_MANAGER',
    previous: { projectIds: ['project-a'] },
    next: { projectIds: ['project-a', 'project-b'] },
    diff: { addedProjectIds: ['project-b'], removedProjectIds: [] },
    changed: true,
  });
});

test('PATCH rejects memberships outside the tenant before reading or writing project access', async () => {
  const { calls, prisma } = prismaDouble({ targetMembership: null });
  const response = await handler(prisma)(request({
    membershipId: 'membership-foreign',
    projectIds: [],
    expectedProjectIds: [],
  }));

  assert.equal(response.status, 404);
  assert.equal((await response.json()).code, 'PROJECT_ACCESS_MEMBERSHIP_NOT_FOUND');
  assert.equal(callsNamed(calls, 'projects').length, 0);
  assert.equal(callsNamed(calls, 'access-delete').length, 0);
  assert.equal(callsNamed(calls, 'audit').length, 0);
});

test('PATCH rejects portfolio roles because their effective access cannot be narrowed', async () => {
  const { calls, prisma } = prismaDouble({
    targetMembership: membership({ tenantRole: 'DIRECTOR' }),
  });
  const response = await handler(prisma)(request({
    membershipId: 'membership-a',
    projectIds: ['project-a'],
    expectedProjectIds: ['project-a'],
  }));

  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, 'PROJECT_ACCESS_PORTFOLIO_ROLE');
  assert.equal(callsNamed(calls, 'projects').length, 0);
  assert.equal(callsNamed(calls, 'access-delete').length, 0);
  assert.equal(callsNamed(calls, 'audit').length, 0);
});

test('PATCH rejects foreign or archived project IDs before replacing the current set', async () => {
  const { calls, prisma } = prismaDouble({ validProjectIds: ['project-a'] });
  const response = await handler(prisma)(request({
    membershipId: 'membership-a',
    projectIds: ['project-a', 'project-foreign'],
    expectedProjectIds: ['project-a'],
  }));

  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'PROJECT_ACCESS_PROJECT_NOT_FOUND');
  assert.equal(callsNamed(calls, 'access-read').length, 0);
  assert.equal(callsNamed(calls, 'access-delete').length, 0);
  assert.equal(callsNamed(calls, 'audit').length, 0);
});

test('PATCH rejects a stale assignment snapshot without overwriting the newer state', async () => {
  const { calls, prisma } = prismaDouble({
    previousProjectIds: ['project-a', 'project-b'],
    validProjectIds: ['project-a', 'project-c'],
  });
  const response = await handler(prisma)(request({
    membershipId: 'membership-a',
    projectIds: ['project-a', 'project-c'],
    expectedProjectIds: ['project-a'],
  }));

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    error: 'El alcance cambió en otra sesión. Revisá el estado actualizado antes de guardar.',
    code: 'PROJECT_ACCESS_STALE',
    currentProjectIds: ['project-a', 'project-b'],
  });
  assert.equal(callsNamed(calls, 'access-delete').length, 0);
  assert.equal(callsNamed(calls, 'access-create').length, 0);
  assert.equal(callsNamed(calls, 'audit').length, 0);
});

test('PATCH retries serialization conflicts and re-runs the complete locked transaction', async () => {
  const retryable = Object.assign(new Error('serialization conflict'), { code: 'P2034' });
  const { calls, prisma } = prismaDouble({ transactionFailures: [retryable] });
  const response = await handler(prisma)(request({
    membershipId: 'membership-a',
    projectIds: ['project-a', 'project-b'],
    expectedProjectIds: ['project-a'],
  }));

  assert.equal(response.status, 200);
  assert.equal(callsNamed(calls, 'transaction').length, 2);
  assert.equal(callsNamed(calls, 'lock').length, 1);
  assert.equal(callsNamed(calls, 'audit').length, 1);
});

test('PATCH rejects duplicate project IDs before opening a transaction', async () => {
  const { calls, prisma } = prismaDouble();
  const response = await handler(prisma)(request({
    membershipId: 'membership-a',
    projectIds: ['project-a', 'project-a'],
    expectedProjectIds: ['project-a'],
  }));

  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'PROJECT_ACCESS_DUPLICATE_PROJECT');
  assert.equal(callsNamed(calls, 'transaction').length, 0);
});
