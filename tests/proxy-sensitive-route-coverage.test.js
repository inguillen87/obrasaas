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
          export function clerkMiddleware(handler) {
            return async (auth, request) => {
              const response = await handler(auth, request);
              if (auth.__requestState?.reason) {
                response.headers.append('x-clerk-auth-reason', auth.__requestState.reason);
              }
              if (auth.__requestState?.status) {
                response.headers.append('x-clerk-auth-status', auth.__requestState.status);
              }
              return response;
            };
          }
        `,
      };
    }
    return nextLoad(url, context);
  },
});

const [
  { unstable_doesMiddlewareMatch },
  { NextRequest },
  {
    default: clerkProxy,
    config,
    isProtectedPathname,
    TENANT_PRIVACY_SURFACE_HEADER,
    TENANT_PRIVACY_SURFACE_VALUE,
  },
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
  '/api/superadmin/ai-cost-reconciliations',
  '/api/tenant/privacy/requests',
  '/api/tenant/privacy/requests/request-a/review',
  '/api/tenant/privacy/requests/request-a/decisions/decision-a/approval',
  '/api/worker-onboarding/claims',
  '/api/worker-onboarding/claims/claim-a/decision',
  '/api/whatsapp/inbox/conversation-a/worker-onboarding',
  '/api/field/workers/worker-a/payment-destinations',
  '/api/field/workers/worker-a/payment-destinations/destination-a/verification',
  '/api/tasks/task-a/material-reservations',
  '/api/progress-measurements',
  '/api/progress-measurements/measurement-a/review',
  '/api/progress-measurement-cuts',
  '/api/project-contract',
  '/api/project-contract/authorities',
  '/api/project-contract/authorities/authority-a/decision',
  '/api/project-contract/versions',
  '/api/project-contract/versions/contract-a/decision',
];

const PUBLIC_SELF_AUTHENTICATED_API_PATHS = [
  '/api/auth/verify',
  '/api/cron/notifications',
  '/api/cron/protected-uploads',
  '/api/cron/supplier-reminders',
  '/api/cron/webhooks',
  '/api/leads',
  '/api/webhooks/clerk',
  '/api/webhooks/stripe',
  '/api/webhooks/resend',
  '/api/webhooks/whatsapp',
  '/api/webhooks/whatsapp/flows/example',
  '/api/webviews/attendance',
  '/api/webviews/medical',
  '/api/webviews/progress-evidence-location',
  '/api/webviews/worker-payment-receipt',
];

function clerkAuth({
  onAuth = () => {},
  onProtect = () => {},
  requestReason = null,
  userId = 'user_test',
} = {}) {
  const auth = async () => {
    onAuth();
    return { userId };
  };
  auth.protect = async () => {
    onProtect();
  };
  auth.__requestState = {
    reason: requestReason,
    status: userId ? 'signed-in' : 'signed-out',
  };
  return auth;
}

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
    const usesPlatformAccess = /\b(?:getPlatformAccess|requireSuperadmin|createDataSubjectReviewMutationHandler)\b/
      .test(source);

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

  assert.equal(protectedRouteCount, 110, 'the complete current Clerk surface must remain classified');
  assert.deepEqual(discoveredPublicRoutes.sort(), PUBLIC_SELF_AUTHENTICATED_API_PATHS.toSorted());
});

test('proxy invokes Clerk protection only for classified private paths', async () => {
  for (const [pathname, expectedAuthCalls, expectedProtectCalls] of [
    ['/api/progress', 1, 1],
    ['/api/tasks/example', 1, 1],
    ['/api/cron/protected-uploads', 0, 0],
    ['/api/webhooks/whatsapp', 0, 0],
  ]) {
    let authCalls = 0;
    let protectCalls = 0;
    await clerkProxy(
      clerkAuth({
        onAuth: () => { authCalls += 1; },
        onProtect: () => { protectCalls += 1; },
      }),
      new NextRequest(`https://app.obrasaas.test${pathname}`),
    );
    assert.equal(authCalls, expectedAuthCalls, `${pathname} has an unexpected Clerk auth read`);
    assert.equal(
      protectCalls,
      expectedProtectCalls,
      `${pathname} has an unexpected Clerk protection boundary`,
    );
  }
});

// A document-shaped navigation can be resolved by Clerk before this handler.
// This contract covers JSON API requests that reach the protected API branch.
test('signed-out JSON API requests reaching Proxy return an opaque 404 without downstream routing', async () => {
  let authCalls = 0;
  let protectCalls = 0;
  const response = await clerkProxy(
    clerkAuth({
      onAuth: () => { authCalls += 1; },
      onProtect: () => { protectCalls += 1; },
      requestReason: 'client-uat-but-no-session-token',
      userId: null,
    }),
    new NextRequest('https://app.obrasaas.test/api/progress-measurement-cuts', {
      headers: {
        Accept: 'application/json',
        'x-request-id': 's92-anonymous-boundary',
      },
    }),
  );

  assert.equal(authCalls, 1);
  assert.equal(protectCalls, 0);
  assert.equal(response.status, 404);
  assert.equal(await response.text(), '');
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store, max-age=0');
  assert.equal(response.headers.get('x-request-id'), 's92-anonymous-boundary');
  assert.equal(response.headers.get('x-clerk-auth-status'), 'signed-out');
  assert.deepEqual(
    response.headers.get('x-clerk-auth-reason').split(',').map((reason) => reason.trim()),
    ['protect-rewrite', 'client-uat-but-no-session-token'],
  );
  assert.equal(response.headers.get('Location'), null);
  assert.equal(response.headers.get('x-clerk-redirect-to'), null);
  assert.equal(response.headers.get('x-middleware-rewrite'), null);
  assert.equal(response.headers.get('x-middleware-next'), null);
});

test('signed-in protected APIs still run protect and continue with correlated request state', async () => {
  let authCalls = 0;
  let protectCalls = 0;
  const response = await clerkProxy(
    clerkAuth({
      onAuth: () => { authCalls += 1; },
      onProtect: () => { protectCalls += 1; },
    }),
    new NextRequest('https://app.obrasaas.test/api/progress-measurement-cuts'),
  );

  assert.equal(authCalls, 1);
  assert.equal(protectCalls, 1);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-middleware-next'), '1');
  assert.equal(response.headers.get('x-middleware-rewrite'), null);
  assert.equal(response.headers.get('Location'), null);
  assert.equal(
    response.headers.get('x-middleware-request-x-request-id'),
    response.headers.get('x-request-id'),
  );
});

test('protected pages retain Clerk protect without the API auth preflight', async () => {
  let authCalls = 0;
  let protectCalls = 0;
  const response = await clerkProxy(
    clerkAuth({
      onAuth: () => { authCalls += 1; },
      onProtect: () => { protectCalls += 1; },
      userId: null,
    }),
    new NextRequest('https://app.obrasaas.test/dashboard'),
  );

  assert.equal(authCalls, 0);
  assert.equal(protectCalls, 1);
  assert.equal(response.headers.get('x-middleware-next'), '1');
});

test('proxy propagates one correlation id upstream and back to the client', async () => {
  const response = await clerkProxy(
    clerkAuth(),
    new NextRequest('https://app.obrasaas.test/api/tenant/privacy/requests'),
  );
  const responseId = response.headers.get('x-request-id');
  assert.match(responseId, /^[0-9a-f-]{36}$/);
  assert.equal(response.headers.get('x-middleware-request-x-request-id'), responseId);
});

test('proxy owns the upstream privacy surface marker and rejects client spoofing', async () => {
  const response = await clerkProxy(
    clerkAuth(),
    new NextRequest('https://app.obrasaas.test/dashboard/privacy', {
      headers: { [TENANT_PRIVACY_SURFACE_HEADER]: 'client-controlled-value' },
    }),
  );

  assert.equal(
    response.headers.get(`x-middleware-request-${TENANT_PRIVACY_SURFACE_HEADER}`),
    TENANT_PRIVACY_SURFACE_VALUE,
  );
  assert.equal(response.headers.get(TENANT_PRIVACY_SURFACE_HEADER), null);
});

test('proxy strips the privacy marker from every non-exact dashboard path', async () => {
  for (const pathname of ['/dashboard', '/dashboard/privacy/extra']) {
    const response = await clerkProxy(
      clerkAuth(),
      new NextRequest(`https://app.obrasaas.test${pathname}`, {
        headers: { [TENANT_PRIVACY_SURFACE_HEADER]: TENANT_PRIVACY_SURFACE_VALUE },
      }),
    );
    assert.equal(
      response.headers.get(`x-middleware-request-${TENANT_PRIVACY_SURFACE_HEADER}`),
      null,
      `${pathname} must not reach the privacy shell`,
    );
    assert.equal(response.headers.get(TENANT_PRIVACY_SURFACE_HEADER), null);
  }
});
