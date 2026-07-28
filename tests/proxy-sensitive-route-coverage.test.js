import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@clerk/nextjs/server') {
      return { url: 'mock:proxy-clerk', shortCircuit: true };
    }
    if (specifier === 'next/server') {
      return nextResolve('next/server.js', context);
    }
    if (specifier.startsWith('@/')) {
      return nextResolve(
        new URL(`../src/${specifier.slice(2)}.js`, import.meta.url).href,
        context,
      );
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === 'mock:proxy-clerk') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export function clerkMiddleware(handler) { return handler; }
        `,
      };
    }
    return nextLoad(url, context);
  },
});

const [
  { unstable_doesMiddlewareMatch },
  { NextRequest },
  { default: clerkProxy, config, isProtectedPathname },
] = await Promise.all([
  import('next/experimental/testing/server.js'),
  import('next/server.js'),
  import('../src/proxy.js'),
]);

const appRoot = fileURLToPath(new URL('../src/app/', import.meta.url));
const apiRoot = path.join(appRoot, 'api');

async function routeFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return routeFiles(target);
    return entry.isFile() && entry.name === 'route.js' ? [target] : [];
  }))).flat();
}

function examplePathname(routeFile) {
  return `/${path.relative(appRoot, routeFile).replaceAll('\\', '/')}`
    .replace(/\/route\.js$/, '')
    .replace(/\[\[\.\.\.[^\]]+\]\]/g, 'example')
    .replace(/\[\.\.\.[^\]]+\]/g, 'example')
    .replace(/\[[^\]]+\]/g, 'example');
}

const SENSITIVE_API_PATHS = [
  '/api/worker-onboarding/claims',
  '/api/worker-onboarding/claims/claim-a/decision',
  '/api/field/workers/worker-a/payment-destinations',
  '/api/field/workers/worker-a/payment-destinations/destination-a/verification',
];

const PUBLIC_SELF_AUTHENTICATED_API_PATHS = [
  '/api/auth/verify',
  '/api/cron/notifications',
  '/api/cron/protected-uploads',
  '/api/cron/webhooks',
  '/api/leads',
  '/api/webhooks/clerk',
  '/api/webhooks/stripe',
  '/api/webhooks/whatsapp',
  '/api/webhooks/whatsapp/flows/example',
  '/api/webviews/attendance',
  '/api/webviews/medical',
];

test('Clerk proxy matches and protects every worker-sensitive API path', () => {
  for (const pathname of SENSITIVE_API_PATHS) {
    assert.equal(isProtectedPathname(pathname), true, `${pathname} must require Clerk protection`);
    assert.equal(
      unstable_doesMiddlewareMatch({ config, url: `https://app.obrasaas.test${pathname}` }),
      true,
      `${pathname} must execute the Clerk proxy`,
    );
  }
});

test('every API Route Handler is exhaustively classified behind Clerk or its own authentication', async () => {
  const publicRoutes = new Set(PUBLIC_SELF_AUTHENTICATED_API_PATHS);
  const discoveredPublicRoutes = [];
  let protectedRouteCount = 0;
  for (const routeFile of await routeFiles(apiRoot)) {
    const source = await readFile(routeFile, 'utf8');
    const pathname = examplePathname(routeFile);
    const usesPlatformAccess = /\b(?:getPlatformAccess|requireSuperadmin)\b/.test(source);

    if (publicRoutes.has(pathname)) {
      discoveredPublicRoutes.push(pathname);
      assert.equal(usesPlatformAccess, false, `${pathname} must keep its independent authentication`);
      assert.equal(isProtectedPathname(pathname), false, `${pathname} must stay outside Clerk protection`);
      assert.equal(
        unstable_doesMiddlewareMatch({ config, url: `https://app.obrasaas.test${pathname}` }),
        false,
        `${pathname} must not reinterpret its provider credential as a Clerk session`,
      );
      continue;
    }

    assert.equal(
      usesPlatformAccess,
      true,
      `${pathname} is neither Clerk-protected nor explicitly self-authenticated`,
    );
    protectedRouteCount += 1;
    assert.equal(isProtectedPathname(pathname), true, `${pathname} must require Clerk protection`);
    assert.equal(
      unstable_doesMiddlewareMatch({ config, url: `https://app.obrasaas.test${pathname}` }),
      true,
      `${pathname} must execute the Clerk proxy`,
    );
  }

  assert.equal(protectedRouteCount, 80, 'the complete current Clerk surface must remain classified');
  assert.deepEqual(discoveredPublicRoutes.sort(), PUBLIC_SELF_AUTHENTICATED_API_PATHS.toSorted());
});

test('proxy invokes Clerk protection only for classified private paths', async () => {
  for (const [pathname, expectedCalls] of [
    ['/api/progress', 1],
    ['/api/tasks/example', 1],
    ['/api/cron/protected-uploads', 0],
    ['/api/webhooks/whatsapp', 0],
  ]) {
    let protectCalls = 0;
    await clerkProxy(
      { protect: async () => { protectCalls += 1; } },
      new NextRequest(`https://app.obrasaas.test${pathname}`),
    );
    assert.equal(protectCalls, expectedCalls, `${pathname} has an unexpected Clerk protection boundary`);
  }
});
