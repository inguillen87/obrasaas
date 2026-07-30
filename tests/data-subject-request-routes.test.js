import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@clerk/nextjs/server') {
      return { url: 'mock:privacy-routes-clerk', shortCircuit: true };
    }
    if (specifier === 'next/headers') {
      return { url: 'mock:privacy-routes-next-headers', shortCircuit: true };
    }
    if (specifier === 'server-only') {
      return { url: 'mock:privacy-routes-server-only', shortCircuit: true };
    }
    if (specifier.startsWith('@/')) {
      const extension = specifier.startsWith('@/generated/') ? '.ts' : '.js';
      return nextResolve(
        new URL(`../src/${specifier.slice(2)}${extension}`, import.meta.url).href,
        context,
      );
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === 'mock:privacy-routes-clerk') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export async function auth() { throw new Error('Unexpected auth call.'); }
          export async function clerkClient() { throw new Error('Unexpected Clerk call.'); }
        `,
      };
    }
    if (url === 'mock:privacy-routes-next-headers') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `export async function cookies() { throw new Error('Unexpected cookie call.'); }`,
      };
    }
    if (url === 'mock:privacy-routes-server-only') {
      return { format: 'module', shortCircuit: true, source: '' };
    }
    return nextLoad(url, context);
  },
});

const [
  { AccessError },
  { DataSubjectRequestError },
  { PrivacyDiscoveryError },
  { createDataSubjectRequestHandlers },
] = await Promise.all([
  import('../src/lib/access.js'),
  import('../src/lib/data-subject-requests.js'),
  import('../src/lib/privacy-discovery.js'),
  import('../src/app/api/tenant/privacy/requests/route.js'),
]);

const ACCESS = {
  organization: { id: 'organization-a' },
  tenantMembershipId: 'membership-admin-a',
};

function request({
  url = 'https://example.test/api/tenant/privacy/requests',
  body = { personId: 'person-a', requestType: 'ACCESS' },
  rawBody = null,
  idempotencyKey = 'privacy-request-0001',
  contentType = 'application/json',
  extraHeaders = {},
} = {}) {
  const headers = new Headers({ 'content-type': contentType, ...extraHeaders });
  if (idempotencyKey !== null) headers.set('idempotency-key', idempotencyKey);
  return new Request(url, {
    method: 'POST',
    headers,
    body: rawBody === null ? JSON.stringify(body) : rawBody,
  });
}

function successResult(replayed = false) {
  return {
    replayed,
    request: { id: 'request-a', type: 'ACCESS', status: 'DISCOVERY_BLOCKED' },
    discovery: {
      completed: true,
      coverageComplete: false,
      executionAllowed: false,
      blockers: [{ code: 'BACKUP_TOMBSTONE_REPLAY_MISSING' }],
    },
  };
}

test('privacy request route is organization-scoped, project-independent and no-store', async () => {
  const calls = {};
  const handlers = createDataSubjectRequestHandlers({
    async resolveAccess(options) {
      calls.accessOptions = options;
      return ACCESS;
    },
    authorize(access) { calls.authorized = access; },
    prismaFactory() { return { marker: 'prisma' }; },
    resolveKeyConfig() {
      return { key: crypto.randomBytes(32), keyId: 'privacy-key-v1' };
    },
    async createRequest(prisma, input) {
      calls.prisma = prisma;
      calls.input = input;
      return successResult(false);
    },
    resolveCorrelationId() { return 'correlation-a'; },
  });
  const response = await handlers.POST(request());
  assert.equal(response.status, 201);
  assert.deepEqual(calls.accessOptions, {
    requireProject: false,
    resolveProject: false,
  });
  assert.equal(calls.authorized, ACCESS);
  assert.equal(calls.prisma.marker, 'prisma');
  assert.deepEqual(calls.input.scope, {
    organizationId: 'organization-a',
    actorMembershipId: 'membership-admin-a',
  });
  assert.equal(calls.input.idempotencyKey, 'privacy-request-0001');
  assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
  assert.equal(response.headers.get('x-request-id'), 'correlation-a');
  assert.equal(response.headers.get('idempotency-replayed'), 'false');
  const payload = await response.json();
  assert.equal(payload.discovery.executionAllowed, false);
});

test('privacy request route reports exact replays with 200', async () => {
  const handlers = createDataSubjectRequestHandlers({
    async resolveAccess() { return ACCESS; },
    authorize() {},
    prismaFactory() { return {}; },
    resolveKeyConfig() { return { key: crypto.randomBytes(32), keyId: 'privacy-key-v1' }; },
    async createRequest() { return successResult(true); },
    resolveCorrelationId() { return 'correlation-replay'; },
  });
  const response = await handlers.POST(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('idempotency-replayed'), 'true');
});

test('privacy request route rejects query parameters and invalid idempotency before persistence', async () => {
  let called = false;
  const handlers = createDataSubjectRequestHandlers({
    async resolveAccess() { return ACCESS; },
    authorize() {},
    prismaFactory() { return {}; },
    resolveKeyConfig() { return { key: crypto.randomBytes(32), keyId: 'privacy-key-v1' }; },
    async createRequest() { called = true; return successResult(false); },
    resolveCorrelationId() { return 'correlation-invalid'; },
  });
  const queryResponse = await handlers.POST(request({
    url: 'https://example.test/api/tenant/privacy/requests?dryRun=true',
  }));
  assert.equal(queryResponse.status, 400);
  assert.equal((await queryResponse.json()).code, 'PRIVACY_QUERY_INVALID');

  const keyResponse = await handlers.POST(request({ idempotencyKey: 'short' }));
  assert.equal(keyResponse.status, 400);
  assert.equal((await keyResponse.json()).code, 'PRIVACY_IDEMPOTENCY_KEY_INVALID');
  assert.equal(called, false);
});

test('privacy request route preserves access and bounded-body errors', async () => {
  const denied = createDataSubjectRequestHandlers({
    async resolveAccess() { return ACCESS; },
    authorize() {
      throw new AccessError('denied', { code: 'PERMISSION_REQUIRED', status: 403 });
    },
    resolveCorrelationId() { return 'correlation-denied'; },
  });
  const deniedResponse = await denied.POST(request());
  assert.equal(deniedResponse.status, 403);
  assert.equal((await deniedResponse.json()).code, 'PERMISSION_REQUIRED');

  const bounded = createDataSubjectRequestHandlers({
    async resolveAccess() { return ACCESS; },
    authorize() {},
    resolveCorrelationId() { return 'correlation-bounded'; },
  });
  const mediaResponse = await bounded.POST(request({ contentType: 'text/plain' }));
  assert.equal(mediaResponse.status, 415);
  assert.equal((await mediaResponse.json()).code, 'UNSUPPORTED_MEDIA_TYPE');
});

test('the real route authorizer is ADMIN-only and billing suspension does not hide rights intake', async () => {
  const baseAccess = {
    ...ACCESS,
    orgId: 'organization-a',
    isSuperadmin: false,
  };
  for (const tenantRole of ['DIRECTOR', 'SITE_MANAGER', 'FINANCE', 'AUDITOR']) {
    const denied = createDataSubjectRequestHandlers({
      async resolveAccess() { return { ...baseAccess, tenantRole }; },
      prismaFactory() { return {}; },
      resolveKeyConfig() { return { key: crypto.randomBytes(32), keyId: 'privacy-key-v1' }; },
      async createRequest() { return successResult(false); },
      resolveCorrelationId() { return `correlation-${tenantRole.toLowerCase()}`; },
    });
    const response = await denied.POST(request());
    assert.equal(response.status, 403, tenantRole);
    assert.equal((await response.json()).code, 'PERMISSION_REQUIRED', tenantRole);
  }

  const admin = createDataSubjectRequestHandlers({
    async resolveAccess() {
      return {
        ...baseAccess,
        tenantRole: 'ADMIN',
        subscription: { canRead: false, canWrite: false },
      };
    },
    prismaFactory() { return {}; },
    resolveKeyConfig() { return { key: crypto.randomBytes(32), keyId: 'privacy-key-v1' }; },
    async createRequest() { return successResult(false); },
    resolveCorrelationId() { return 'correlation-admin'; },
  });
  const response = await admin.POST(request());
  assert.equal(response.status, 201);
});

test('platform superadmin authority cannot replace an active tenant ADMIN membership', async () => {
  const handlers = createDataSubjectRequestHandlers({
    async resolveAccess() {
      return {
        organization: { id: 'organization-a' },
        orgId: 'organization-a',
        tenantMembershipId: null,
        tenantRole: 'SUPERADMIN',
        isSuperadmin: true,
      };
    },
    prismaFactory() { return {}; },
    resolveKeyConfig() { return { key: crypto.randomBytes(32), keyId: 'privacy-key-v1' }; },
    resolveCorrelationId() { return 'correlation-superadmin'; },
  });
  const response = await handlers.POST(request());
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, 'TENANT_MEMBERSHIP_REQUIRED');
});

test('privacy route maps body, key configuration and durable quota failures safely', async () => {
  const common = {
    async resolveAccess() {
      return {
        ...ACCESS,
        orgId: 'organization-a',
        tenantRole: 'ADMIN',
        isSuperadmin: false,
      };
    },
    prismaFactory() { return {}; },
    resolveCorrelationId() { return 'correlation-errors'; },
  };

  const bodyHandlers = createDataSubjectRequestHandlers({
    ...common,
    resolveKeyConfig() { return { key: crypto.randomBytes(32), keyId: 'privacy-key-v1' }; },
    async createRequest() { return successResult(false); },
  });
  const oversized = await bodyHandlers.POST(request({
    extraHeaders: { 'content-length': String((8 * 1024) + 1) },
  }));
  assert.equal(oversized.status, 413);
  assert.equal((await oversized.json()).code, 'REQUEST_BODY_TOO_LARGE');

  const malformed = await bodyHandlers.POST(request({ rawBody: '{not-json' }));
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).code, 'INVALID_JSON');

  const noKey = createDataSubjectRequestHandlers({
    ...common,
    resolveKeyConfig() {
      throw new PrivacyDiscoveryError(
        'Privacy discovery fingerprinting is not configured.',
        'PRIVACY_DISCOVERY_UNAVAILABLE',
        503,
      );
    },
  });
  const unavailable = await noKey.POST(request());
  assert.equal(unavailable.status, 503);
  assert.equal((await unavailable.json()).code, 'PRIVACY_DISCOVERY_UNAVAILABLE');

  const limited = createDataSubjectRequestHandlers({
    ...common,
    resolveKeyConfig() { return { key: crypto.randomBytes(32), keyId: 'privacy-key-v1' }; },
    async createRequest() {
      throw new DataSubjectRequestError(
        'Límite seguro alcanzado.',
        'PRIVACY_REQUEST_RATE_LIMIT',
        429,
        { retryAfterSeconds: 3600 },
      );
    },
  });
  const quota = await limited.POST(request());
  assert.equal(quota.status, 429);
  assert.equal(quota.headers.get('retry-after'), '3600');
  assert.equal(quota.headers.get('x-request-id'), 'correlation-errors');

  const contended = createDataSubjectRequestHandlers({
    ...common,
    resolveKeyConfig() { return { key: crypto.randomBytes(32), keyId: 'privacy-key-v1' }; },
    async createRequest() {
      throw new DataSubjectRequestError(
        'Admisión temporalmente ocupada.',
        'PRIVACY_REQUEST_TEMPORARILY_UNAVAILABLE',
        503,
        { retryAfterSeconds: 3 },
      );
    },
  });
  const unavailableRetry = await contended.POST(request());
  assert.equal(unavailableRetry.status, 503);
  assert.equal(unavailableRetry.headers.get('retry-after'), '3');
  assert.equal(
    (await unavailableRetry.json()).code,
    'PRIVACY_REQUEST_TEMPORARILY_UNAVAILABLE',
  );
});

test('unexpected route failures expose a generic response and allowlisted logs only', async () => {
  const logs = [];
  const sensitiveMessage = 'private-worker-phone-and-api-token';
  const handlers = createDataSubjectRequestHandlers({
    async resolveAccess() { return ACCESS; },
    authorize() {},
    prismaFactory() { return {}; },
    resolveKeyConfig() { return { key: crypto.randomBytes(32), keyId: 'privacy-key-v1' }; },
    async createRequest() { throw new Error(sensitiveMessage); },
    resolveCorrelationId() { return 'correlation-unexpected'; },
    logError(...values) { logs.push(values); },
  });
  const response = await handlers.POST(request());
  assert.equal(response.status, 500);
  assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
  assert.equal(response.headers.get('x-request-id'), 'correlation-unexpected');
  assert.deepEqual(await response.json(), {
    error: 'No se pudo procesar la solicitud de privacidad.',
    code: 'PRIVACY_REQUEST_FAILED',
  });
  assert.equal(JSON.stringify(logs).includes(sensitiveMessage), false);
  assert.equal(logs[0][1].correlationId, 'correlation-unexpected');
});
