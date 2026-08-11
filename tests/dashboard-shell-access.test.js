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

const [
  { AccessError },
  {
    canAccessTenantPrivacyControl,
    dashboardProjectAccessRequiredModel,
    requireDashboardShellReadAccess,
    resolveDashboardShellAccessState,
  },
] = await Promise.all([
  import('../src/lib/access.js'),
  import('../src/lib/dashboard-shell-access.js'),
]);

function tenantAccess(canRead) {
  return {
    isSuperadmin: false,
    orgId: 'org_tenant',
    tenantRole: 'ADMIN',
    subscription: { canRead, canWrite: canRead },
  };
}

test('dashboard shell blocks suspended tenants before a data loader can run', () => {
  let loaderCalls = 0;
  const loadShell = (access) => {
    requireDashboardShellReadAccess(access);
    loaderCalls += 1;
  };

  assert.throws(
    () => loadShell(tenantAccess(false)),
    (error) => error instanceof AccessError
      && error.code === 'SUBSCRIPTION_SUSPENDED'
      && error.status === 403,
  );
  assert.equal(loaderCalls, 0);
});

test('dashboard shell admits authorized tenant readers', () => {
  assert.equal(requireDashboardShellReadAccess(tenantAccess(true)).orgId, 'org_tenant');
});

test('dashboard deep links render the pending-access state before project pages load', () => {
  const pending = dashboardProjectAccessRequiredModel({
    email: 'jefe@obra.com',
    tenantRole: 'SITE_MANAGER',
    tenantMembershipId: 'membership-site-manager',
    organization: { id: 'organization-a', name: 'Constructora Norte' },
    project: null,
  });

  assert.deepEqual(pending, {
    email: 'jefe@obra.com',
    tenantRole: 'SITE_MANAGER',
    organization: { name: 'Constructora Norte' },
    canManagePrivacy: false,
  });
  assert.equal(dashboardProjectAccessRequiredModel({
    organization: { name: 'Constructora Norte' },
    project: { id: 'project-a' },
  }), null);
  assert.equal(dashboardProjectAccessRequiredModel({ organization: null }), null);
});

test('only an active tenant ADMIN membership discovers the isolated privacy control', () => {
  const base = {
    organization: { id: 'organization-a', name: 'Constructora Norte' },
    orgId: 'org_tenant',
    tenantMembershipId: 'membership-admin',
    tenantRole: 'ADMIN',
    databaseTenantRole: 'ADMIN',
    isSuperadmin: false,
  };
  assert.equal(canAccessTenantPrivacyControl(base), true);
  assert.equal(canAccessTenantPrivacyControl({ ...base, tenantRole: 'DIRECTOR' }), false);
  assert.equal(canAccessTenantPrivacyControl({ ...base, tenantMembershipId: null }), false);
  assert.equal(canAccessTenantPrivacyControl({
    ...base,
    isSuperadmin: true,
    tenantRole: 'SUPERADMIN',
  }), true);
  assert.equal(canAccessTenantPrivacyControl({
    ...base,
    isSuperadmin: true,
    tenantRole: 'SUPERADMIN',
    databaseTenantRole: 'SITE_MANAGER',
  }), false);
  assert.equal(canAccessTenantPrivacyControl({
    ...base,
    isSuperadmin: true,
    tenantRole: 'SUPERADMIN',
    tenantMembershipId: null,
  }), false);

  assert.deepEqual(dashboardProjectAccessRequiredModel({
    ...base,
    email: 'admin@obra.com',
    project: null,
  }), {
    email: 'admin@obra.com',
    tenantRole: 'ADMIN',
    organization: { name: 'Constructora Norte' },
    canManagePrivacy: true,
  });
});

test('subscription suspension is enforced before the no-project deep-link state', () => {
  assert.throws(
    () => resolveDashboardShellAccessState({
      ...tenantAccess(false),
      email: 'jefe@obra.com',
      organization: { id: 'organization-a', name: 'Constructora Norte' },
      project: null,
    }),
    (error) => error instanceof AccessError
      && error.code === 'SUBSCRIPTION_SUSPENDED',
  );
});
