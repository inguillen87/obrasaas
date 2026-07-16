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
          export async function auth() {
            throw new Error('Unexpected Clerk auth call in supervisor route test.');
          }
          export async function clerkClient() {
            throw new Error('Unexpected Clerk client call in supervisor route test.');
          }
        `,
      };
    }
    if (url === 'mock:next-headers') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export async function cookies() {
            throw new Error('Unexpected cookies call in supervisor route test.');
          }
        `,
      };
    }
    return nextLoad(url, context);
  },
});

const [
  { SUPERVISOR_ACCESS_REQUIREMENT },
  { getSubscriptionEntitlements },
  { createSupervisorPostHandler },
] = await Promise.all([
  import('../src/lib/ai/supervisor.js'),
  import('../src/lib/plans.js'),
  import('../src/app/api/ai/supervisor/route.js'),
]);

const NOW = new Date('2026-07-16T12:00:00.000Z');

function accessFor(organization) {
  return {
    isSuperadmin: false,
    orgId: 'org_clerk_tenant',
    tenantRole: 'AUDITOR',
    organization,
    subscription: getSubscriptionEntitlements(organization, NOW),
  };
}

test('Supervisor IA uses write-mode subscription enforcement for all blocked states', () => {
  assert.deepEqual(SUPERVISOR_ACCESS_REQUIREMENT, {
    permission: 'org:projects:read',
    subscriptionMode: 'write',
  });
  const blocked = [
    {
      subscriptionPlan: 'TRIAL',
      subscriptionStatus: 'TRIALING',
      trialEndsAt: new Date('2026-07-15T12:00:00.000Z'),
    },
    { subscriptionPlan: 'PRO', subscriptionStatus: 'PAST_DUE' },
    { subscriptionPlan: 'PRO', subscriptionStatus: 'CANCELED' },
    { subscriptionPlan: 'ENTERPRISE', subscriptionStatus: 'SUSPENDED' },
  ];

  for (const organization of blocked) {
    assert.equal(accessFor(organization).subscription.canWrite, false);
  }
});

test('Supervisor IA remains available to authorized ACTIVE and current trial tenants', () => {
  const allowed = [
    { subscriptionPlan: 'PRO', subscriptionStatus: 'ACTIVE' },
    {
      subscriptionPlan: 'TRIAL',
      subscriptionStatus: 'TRIALING',
      trialEndsAt: new Date('2026-07-17T12:00:00.000Z'),
    },
  ];

  for (const organization of allowed) {
    assert.equal(accessFor(organization).subscription.canWrite, true);
  }
});

test('Supervisor route returns 402 before invoking the provider for a blocked tenant', async () => {
  let providerCalls = 0;
  const organization = {
    id: 'organization-blocked',
    name: 'Tenant bloqueado',
    metadata: { aiProcessing: { supervisorEnabled: true } },
    subscriptionPlan: 'PRO',
    subscriptionStatus: 'PAST_DUE',
  };
  const access = {
    ...accessFor(organization),
    databaseUserId: 'user-blocked',
    project: { id: 'project-blocked', name: 'Obra bloqueada', status: 'ACTIVE' },
  };
  const post = createSupervisorPostHandler({
    resolveAccess: async () => access,
    requestAnswer: async () => {
      providerCalls += 1;
      throw new Error('provider must not run');
    },
  });

  const response = await post(new Request('http://localhost/api/ai/supervisor', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question: '¿Cómo está la obra?' }),
  }));

  assert.equal(response.status, 402);
  assert.deepEqual(await response.json(), {
    error: 'La organización está en modo lectura. El plan debe activarse para realizar cambios.',
    code: 'SUBSCRIPTION_READ_ONLY',
  });
  assert.equal(providerCalls, 0);
});
