import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

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

const [{ unstable_doesMiddlewareMatch }, { config, isProtectedPathname }] = await Promise.all([
  import('next/experimental/testing/server.js'),
  import('../src/proxy.js'),
]);

const SENSITIVE_API_PATHS = [
  '/api/worker-onboarding/claims',
  '/api/worker-onboarding/claims/claim-a/decision',
  '/api/field/workers/worker-a/payment-destinations',
  '/api/field/workers/worker-a/payment-destinations/destination-a/verification',
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
