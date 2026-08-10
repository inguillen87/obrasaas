import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') {
      return { url: 'mock:server-only', shortCircuit: true };
    }
    if (specifier === 'next/navigation') {
      return { url: 'mock:next-navigation', shortCircuit: true };
    }
    if (specifier === '@/lib/access') {
      return { url: 'mock:access', shortCircuit: true };
    }
    if (specifier.startsWith('@/')) {
      const sourcePath = new URL(`../src/${specifier.slice(2)}.js`, import.meta.url);
      return nextResolve(sourcePath.href, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === 'mock:server-only') {
      return { format: 'module', shortCircuit: true, source: '' };
    }
    if (url === 'mock:next-navigation') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export function forbidden() {
            globalThis.__pageAccessForbiddenCalls = (globalThis.__pageAccessForbiddenCalls || 0) + 1;
            const error = new Error('NEXT_FORBIDDEN');
            error.digest = 'NEXT_HTTP_ERROR_FALLBACK;403';
            throw error;
          }
        `,
      };
    }
    if (url === 'mock:access') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export class AccessError extends Error {
            constructor(message, { code = 'FORBIDDEN', status = 403 } = {}) {
              super(message);
              this.name = 'AccessError';
              this.code = code;
              this.status = status;
            }
          }
        `,
      };
    }
    return nextLoad(url, context);
  },
});

const [{ AccessError }, { resolvePageAccess }] = await Promise.all([
  import('@/lib/access'),
  import('../src/lib/page-access.js'),
]);

test('page access converts only a known 403 AccessError into the Next forbidden interrupt', async () => {
  globalThis.__pageAccessForbiddenCalls = 0;
  const denied = new AccessError('sensitive permission detail', {
    code: 'PERMISSION_REQUIRED',
    status: 403,
  });

  await assert.rejects(
    resolvePageAccess(async () => {
      throw denied;
    }),
    (error) => error.digest === 'NEXT_HTTP_ERROR_FALLBACK;403'
      && !error.message.includes(denied.message),
  );
  assert.equal(globalThis.__pageAccessForbiddenCalls, 1);
});

test('page access preserves successful results and non-403 failures', async () => {
  const access = { tenantRole: 'AUDITOR' };
  assert.equal(await resolvePageAccess(async () => access), access);

  for (const failure of [
    new AccessError('authentication required', { status: 401 }),
    new AccessError('subscription payment required', { status: 402 }),
    new AccessError('identity changed', { status: 409 }),
    new Error('database unavailable'),
  ]) {
    await assert.rejects(
      resolvePageAccess(async () => {
        throw failure;
      }),
      (error) => error === failure,
    );
  }
});

test('restricted RSC entry points use the 403 boundary before loading protected data', async () => {
  const [
    config,
    forbiddenSource,
    inboxSource,
    integrationsSource,
    teamSource,
    presupuestoSource,
    superadminSource,
  ] = await Promise.all([
    import('../next.config.mjs').then(({ default: value }) => value),
    readFile(new URL('../src/app/forbidden.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/dashboard/inbox/page.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/dashboard/integrations/page.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/dashboard/team/page.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/presupuesto/page.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/superadmin/page.js', import.meta.url), 'utf8'),
  ]);

  assert.equal(config.experimental?.authInterrupts, true);
  assert.match(forbiddenSource, /No tenés acceso a esta sección en el contexto actual/);
  assert.doesNotMatch(forbiddenSource, /error\.message|error\.code|digest/);
  assert.match(inboxSource, /resolvePageAccess\(async \(\) => \{[\s\S]*requireTenantPermission\(candidate, 'org:conversations:read'\);[\s\S]*return candidate;/);
  assert.match(integrationsSource, /resolvePageAccess\(async \(\) => \{[\s\S]*requireTenantPermission\(candidate, "org:integrations:manage"\);[\s\S]*return candidate;/);
  assert.match(teamSource, /resolvePageAccess\(async \(\) => \{[\s\S]*requireTenantPermission\(candidate, 'tenant:members:read'\);[\s\S]*return candidate;/);
  assert.match(presupuestoSource, /resolvePageAccess\(\(\) => requireSuperadmin\(\)\)/);
  assert.match(superadminSource, /resolvePageAccess\(\(\) => requireSuperadmin\(\)\)/);
});
