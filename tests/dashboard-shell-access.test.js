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
  { requireDashboardShellReadAccess },
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
