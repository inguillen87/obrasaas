import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CANONICAL_PREVIEW_ORIGIN,
  CANONICAL_PRODUCTION_ORIGIN,
  resolveClerkAuthorizedParties,
} from '../src/lib/clerk-authorized-parties.js';

test('production accepts only explicit ObraSaaS and current Vercel origins', () => {
  const parties = resolveClerkAuthorizedParties({
    VERCEL_ENV: 'production',
    NEXT_PUBLIC_APP_URL: 'https://obrasaas.vercel.app',
    VERCEL_PROJECT_PRODUCTION_URL: 'obrasaas-saas.vercel.app',
    VERCEL_URL: 'obrasaas-saas-build.vercel.app',
  });

  assert.deepEqual(parties, [
    CANONICAL_PRODUCTION_ORIGIN,
    'https://obrasaas-saas.vercel.app',
    'https://obrasaas-saas-build.vercel.app',
  ]);
  assert.equal(parties.some((origin) => origin.includes('localhost')), false);
});

test('preview accepts its stable alias and exact deployment origin without trusting production', () => {
  assert.deepEqual(resolveClerkAuthorizedParties({
    VERCEL_ENV: 'preview',
    NEXT_PUBLIC_APP_URL: 'https://obrasaas.vercel.app',
    VERCEL_URL: 'obrasaas-preview-git-feature.vercel.app',
  }), [
    CANONICAL_PREVIEW_ORIGIN,
    'https://obrasaas-preview-git-feature.vercel.app',
  ]);
});

test('local development accepts both loopback names and its configured app origin', () => {
  assert.deepEqual(resolveClerkAuthorizedParties({
    NODE_ENV: 'development',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3100',
  }), [
    'http://localhost:3100',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3100',
  ]);
});

test('configured origins are normalized, deduplicated and reject paths or credentials', () => {
  assert.deepEqual(resolveClerkAuthorizedParties({
    VERCEL_ENV: 'production',
    CLERK_AUTHORIZED_PARTIES: 'https://auth.obrasaas.test, auth.obrasaas.test',
  }), [
    'https://auth.obrasaas.test',
    CANONICAL_PRODUCTION_ORIGIN,
  ]);

  assert.throws(
    () => resolveClerkAuthorizedParties({
      VERCEL_ENV: 'production',
      CLERK_AUTHORIZED_PARTIES: 'https://user@example.com/private',
    }),
    /Invalid Clerk authorized party origin/,
  );
});
