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

const { resolveActiveProject } = await import('../src/lib/access.js');

function restrictedAccess() {
  return {
    isSuperadmin: false,
    tenantRole: 'SITE_MANAGER',
    tenantMembershipId: 'membership-a',
    organization: { id: 'organization-a' },
  };
}

test('a stale same-tenant cookie falls back to an assigned active project', async () => {
  const calls = [];
  const assignedProject = {
    id: 'project-assigned',
    status: 'ACTIVE',
  };
  const prisma = {
    project: {
      async findFirst(args) {
        calls.push(args);
        if (args.where.id === 'project-unassigned') return null;
        if (args.where.status === 'ACTIVE') return assignedProject;
        return null;
      },
      async create() {
        throw new Error('Restricted access must never bootstrap a project.');
      },
    },
  };

  const project = await resolveActiveProject(prisma, restrictedAccess(), {
    selectedProjectId: 'project-unassigned',
  });

  assert.equal(project, assignedProject);
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call.where.organizationId, 'organization-a');
    assert.deepEqual(call.where.projectMemberships, {
      some: {
        tenantMembershipId: 'membership-a',
        status: 'ACTIVE',
        tenantMembership: {
          organizationId: 'organization-a',
          status: 'ACTIVE',
        },
      },
    });
  }
});

test('a restricted member without assignments gets no project and no bootstrap', async () => {
  const calls = [];
  let createCalls = 0;
  const prisma = {
    project: {
      async findFirst(args) {
        calls.push(args);
        return null;
      },
      async create() {
        createCalls += 1;
        return { id: 'unexpected' };
      },
    },
  };

  const project = await resolveActiveProject(prisma, restrictedAccess(), {
    selectedProjectId: null,
  });

  assert.equal(project, null);
  assert.equal(createCalls, 0);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((call) => call.where.status), [
    'ACTIVE',
    { not: 'ARCHIVED' },
  ]);
});
