import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@clerk/nextjs/server') {
      return { url: 'mock:data-subject-review-routes-clerk', shortCircuit: true };
    }
    if (specifier === 'next/headers') {
      return { url: 'mock:data-subject-review-routes-next-headers', shortCircuit: true };
    }
    if (specifier === 'server-only') {
      return { url: 'mock:data-subject-review-routes-server-only', shortCircuit: true };
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
    if (url === 'mock:data-subject-review-routes-clerk') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export async function auth() { throw new Error('Unexpected auth call.'); }
          export async function clerkClient() { throw new Error('Unexpected Clerk call.'); }
        `,
      };
    }
    if (url === 'mock:data-subject-review-routes-next-headers') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `export async function cookies() { throw new Error('Unexpected cookie call.'); }`,
      };
    }
    if (url === 'mock:data-subject-review-routes-server-only') {
      return { format: 'module', shortCircuit: true, source: '' };
    }
    return nextLoad(url, context);
  },
});

const [
  { DataSubjectReviewError },
  { createDataSubjectRequestHandlers },
  { createDataSubjectReviewHandlers },
  { createDataSubjectVerificationEventHandlers },
  { createDataSubjectLegalAssessmentHandlers },
  { createDataSubjectLegalHoldHandlers },
  { createDataSubjectLegalHoldEventHandlers },
  { createDataSubjectDecisionHandlers },
  { createDataSubjectDecisionApprovalHandlers },
] = await Promise.all([
  import('../src/lib/data-subject-review.js'),
  import('../src/app/api/tenant/privacy/requests/route.js'),
  import('../src/app/api/tenant/privacy/requests/[requestId]/review/route.js'),
  import('../src/app/api/tenant/privacy/requests/[requestId]/verification-events/route.js'),
  import('../src/app/api/tenant/privacy/requests/[requestId]/legal-assessments/route.js'),
  import('../src/app/api/tenant/privacy/requests/[requestId]/holds/route.js'),
  import('../src/app/api/tenant/privacy/requests/[requestId]/holds/[holdId]/events/route.js'),
  import('../src/app/api/tenant/privacy/requests/[requestId]/decisions/route.js'),
  import('../src/app/api/tenant/privacy/requests/[requestId]/decisions/[decisionId]/approval/route.js'),
]);

const KEY = Buffer.alloc(32, 5);
const KEY_CONFIG = Object.freeze({ key: KEY, keyId: 'privacy-review-route-v1' });
const ADMIN_ACCESS = Object.freeze({
  organization: { id: 'organization-a', subscriptionStatus: 'SUSPENDED' },
  orgId: 'org_clerk_a',
  tenantMembershipId: 'membership-admin-a',
  tenantRole: 'ADMIN',
  isSuperadmin: false,
  subscription: { canRead: false, canWrite: false },
});
const PARAMS = Object.freeze({
  requestId: 'request-a',
  holdId: 'hold-a',
  decisionId: 'decision-a',
});

function postRequest({
  url = 'https://example.test/api/tenant/privacy/requests/request-a/verification-events',
  body = { marker: 'body-a' },
  rawBody = null,
  idempotencyKey = 'privacy-review-route-0001',
  contentType = 'application/json',
  headers: extraHeaders = {},
} = {}) {
  const headers = new Headers({ 'content-type': contentType, ...extraHeaders });
  if (idempotencyKey !== null) headers.set('idempotency-key', idempotencyKey);
  return new Request(url, {
    method: 'POST',
    headers,
    body: rawBody === null ? JSON.stringify(body) : rawBody,
  });
}

function routeDependencies(overrides = {}) {
  return {
    async resolveAccess(options) {
      assert.deepEqual(options, { requireProject: false, resolveProject: false });
      return ADMIN_ACCESS;
    },
    prismaFactory() { return { marker: 'prisma-a' }; },
    resolveKeyConfig() { return KEY_CONFIG; },
    resolveReviewKeyConfig() { return KEY_CONFIG; },
    resolveCorrelationId() { return 'correlation-review-a'; },
    ...overrides,
  };
}

function assertPrivateHeaders(response, { replayed = null } = {}) {
  assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
  assert.equal(response.headers.get('vary'), 'Cookie, Authorization');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
  assert.equal(response.headers.get('x-request-id'), 'correlation-review-a');
  assert.equal(
    response.headers.get('idempotency-replayed'),
    replayed === null ? null : String(replayed),
  );
}

const MUTATION_ROUTES = [
  {
    label: 'verification event',
    factory: createDataSubjectVerificationEventHandlers,
    dependency: 'appendVerification',
    url: '/verification-events',
    expectedParams: { requestId: PARAMS.requestId },
  },
  {
    label: 'legal assessment',
    factory: createDataSubjectLegalAssessmentHandlers,
    dependency: 'appendAssessment',
    url: '/legal-assessments',
    expectedParams: { requestId: PARAMS.requestId },
  },
  {
    label: 'hold creation',
    factory: createDataSubjectLegalHoldHandlers,
    dependency: 'createHold',
    url: '/holds',
    expectedParams: { requestId: PARAMS.requestId },
  },
  {
    label: 'hold event',
    factory: createDataSubjectLegalHoldEventHandlers,
    dependency: 'appendHoldEvent',
    url: '/holds/hold-a/events',
    expectedParams: { requestId: PARAMS.requestId, holdId: PARAMS.holdId },
  },
  {
    label: 'decision creation',
    factory: createDataSubjectDecisionHandlers,
    dependency: 'createDecision',
    url: '/decisions',
    expectedParams: { requestId: PARAMS.requestId },
  },
  {
    label: 'decision approval',
    factory: createDataSubjectDecisionApprovalHandlers,
    dependency: 'decide',
    url: '/decisions/decision-a/approval',
    expectedParams: { requestId: PARAMS.requestId, decisionId: PARAMS.decisionId },
  },
];

test('all six mutation routes await Next 16 params and return 201/200 replay contracts', async () => {
  for (const route of MUTATION_ROUTES) {
    const calls = [];
    const handlers = route.factory(routeDependencies({
      [route.dependency]: async (prisma, command) => {
        calls.push({ prisma, command });
        return {
          operation: route.label,
          replayed: command.idempotencyKey.endsWith('replay'),
          executionAllowed: false,
        };
      },
    }));
    for (const [idempotencyKey, expectedStatus, replayed] of [
      ['privacy-review-route-new', 201, false],
      ['privacy-review-route-replay', 200, true],
    ]) {
      const response = await handlers.POST(postRequest({
        url: `https://example.test/api/tenant/privacy/requests/request-a${route.url}`,
        idempotencyKey,
      }), { params: Promise.resolve(route.expectedParams) });
      assert.equal(response.status, expectedStatus, route.label);
      assertPrivateHeaders(response, { replayed });
      const payload = await response.json();
      assert.equal(payload.operation, route.label);
      assert.equal(payload.replayed, replayed);
    }
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0].prisma, { marker: 'prisma-a' });
    assert.deepEqual(calls[0].command.scope, {
      organizationId: 'organization-a',
      actorMembershipId: 'membership-admin-a',
    });
    assert.deepEqual(
      Object.fromEntries(Object.entries(calls[0].command)
        .filter(([key]) => Object.hasOwn(route.expectedParams, key))),
      route.expectedParams,
    );
    assert.deepEqual(calls[0].command.input, { marker: 'body-a' });
    assert.equal(calls[0].command.fingerprintKey, KEY);
    assert.equal(calls[0].command.fingerprintKeyId, KEY_CONFIG.keyId);
  }
});

test('mutation handler fails before execute for query, key, media type, malformed or oversized body', async () => {
  let executeCalls = 0;
  const handlers = createDataSubjectVerificationEventHandlers(routeDependencies({
    async appendVerification() {
      executeCalls += 1;
      return { replayed: false };
    },
  }));
  const cases = [
    [postRequest({ url: 'https://example.test/api/tenant/privacy/requests/request-a/verification-events?x=1' }), 400, 'PRIVACY_REVIEW_QUERY_INVALID'],
    [postRequest({ idempotencyKey: null }), 400, 'PRIVACY_REVIEW_IDEMPOTENCY_KEY_INVALID'],
    [postRequest({ idempotencyKey: 'short' }), 400, 'PRIVACY_REVIEW_IDEMPOTENCY_KEY_INVALID'],
    [postRequest({ contentType: 'text/plain' }), 415, 'UNSUPPORTED_MEDIA_TYPE'],
    [postRequest({ rawBody: '{not-json' }), 400, 'INVALID_JSON'],
    [postRequest({ body: { padding: 'x'.repeat(17 * 1024) } }), 413, 'REQUEST_BODY_TOO_LARGE'],
  ];
  for (const [request, status, code] of cases) {
    const response = await handlers.POST(request, { params: Promise.resolve(PARAMS) });
    assert.equal(response.status, status);
    assert.equal((await response.json()).code, code);
    assertPrivateHeaders(response);
  }
  assert.equal(executeCalls, 0);
});

test('decision body alone permits 512 KiB while still rejecting larger payloads', async () => {
  let executeCalls = 0;
  const handlers = createDataSubjectDecisionHandlers(routeDependencies({
    async createDecision() {
      executeCalls += 1;
      return { replayed: false, executionAllowed: false };
    },
  }));
  const accepted = await handlers.POST(postRequest({
    url: 'https://example.test/api/tenant/privacy/requests/request-a/decisions',
    body: { padding: 'x'.repeat(20 * 1024) },
  }), { params: Promise.resolve({ requestId: PARAMS.requestId }) });
  assert.equal(accepted.status, 201);
  assert.equal(executeCalls, 1);

  const rejected = await handlers.POST(postRequest({
    url: 'https://example.test/api/tenant/privacy/requests/request-a/decisions',
    body: { padding: 'x'.repeat(513 * 1024) },
  }), { params: Promise.resolve({ requestId: PARAMS.requestId }) });
  assert.equal(rejected.status, 413);
  assert.equal((await rejected.json()).code, 'REQUEST_BODY_TOO_LARGE');
  assert.equal(executeCalls, 1);
});

test('review mutations are ADMIN-only, deny superadmin without tenant membership, and ignore billing state', async () => {
  let executeCalls = 0;
  const build = (access) => createDataSubjectVerificationEventHandlers(routeDependencies({
    async resolveAccess() { return access; },
    async appendVerification() {
      executeCalls += 1;
      return { replayed: false, executionAllowed: false };
    },
  }));
  for (const access of [
    { ...ADMIN_ACCESS, tenantRole: 'DIRECTOR' },
    {
      ...ADMIN_ACCESS,
      isSuperadmin: true,
      tenantRole: 'SUPERADMIN',
      tenantMembershipId: null,
    },
  ]) {
    const response = await build(access).POST(postRequest(), {
      params: Promise.resolve({ requestId: PARAMS.requestId }),
    });
    assert.equal(response.status, 403);
    assertPrivateHeaders(response);
  }
  assert.equal(executeCalls, 0);

  const suspended = await build(ADMIN_ACCESS).POST(postRequest(), {
    params: Promise.resolve({ requestId: PARAMS.requestId }),
  });
  assert.equal(suspended.status, 201);
  assert.equal(executeCalls, 1, 'privacy rights must not be blocked by billing suspension');

  const canonicalWithMembership = await build({
    ...ADMIN_ACCESS,
    isSuperadmin: true,
    tenantRole: 'SUPERADMIN',
  }).POST(postRequest(), { params: Promise.resolve({ requestId: PARAMS.requestId }) });
  assert.equal(canonicalWithMembership.status, 201);
  assert.equal(executeCalls, 2, 'SQL/read adapter revalidates the real ADMIN membership');
});

test('GET list is tenant-scoped, cursor-aware, no-store and billing-independent', async () => {
  const calls = {};
  const handlers = createDataSubjectRequestHandlers(routeDependencies({
    async resolveAccess() { return ADMIN_ACCESS; },
    normalizeListQuery(request, configuration) {
      calls.url = request.url;
      calls.configuration = configuration;
      return { limit: 50, cursor: null };
    },
    async listRequests(prisma, command) {
      calls.prisma = prisma;
      calls.command = command;
      return { requests: [], nextCursor: null, pageSize: 0, executionAllowed: false };
    },
  }));
  const response = await handlers.GET(new Request(
    'https://example.test/api/tenant/privacy/requests?limit=50',
  ));
  assert.equal(response.status, 200);
  assertPrivateHeaders(response);
  assert.equal(calls.configuration.organizationId, ADMIN_ACCESS.organization.id);
  assert.equal(calls.configuration.fingerprintKey, KEY);
  assert.deepEqual(calls.command.scope, {
    organizationId: ADMIN_ACCESS.organization.id,
    actorMembershipId: ADMIN_ACCESS.tenantMembershipId,
  });
  assert.deepEqual(calls.command.query, { limit: 50, cursor: null });
  assert.equal((await response.json()).executionAllowed, false);
});

test('GET list and detail both reject non-admin and superadmin without a real tenant membership before read', async () => {
  for (const access of [
    { ...ADMIN_ACCESS, tenantRole: 'SITE_MANAGER' },
    {
      ...ADMIN_ACCESS,
      isSuperadmin: true,
      tenantRole: 'SUPERADMIN',
      tenantMembershipId: null,
    },
  ]) {
    let listCalls = 0;
    const list = createDataSubjectRequestHandlers(routeDependencies({
      async resolveAccess() { return access; },
      async listRequests() { listCalls += 1; return {}; },
    }));
    const listResponse = await list.GET(new Request(
      'https://example.test/api/tenant/privacy/requests',
    ));
    assert.equal(listResponse.status, 403);
    assert.equal(listCalls, 0);
    assertPrivateHeaders(listResponse);

    let detailCalls = 0;
    const detail = createDataSubjectReviewHandlers(routeDependencies({
      async resolveAccess() { return access; },
      async readReview() { detailCalls += 1; return {}; },
    }));
    const detailResponse = await detail.GET(new Request(
      'https://example.test/api/tenant/privacy/requests/request-a/review',
    ), { params: Promise.resolve({ requestId: PARAMS.requestId }) });
    assert.equal(detailResponse.status, 403);
    assert.equal(detailCalls, 0);
    assertPrivateHeaders(detailResponse);
  }
});

test('GET detail awaits params, rejects query and emits an indistinguishable scoped 404', async () => {
  const calls = [];
  const found = createDataSubjectReviewHandlers(routeDependencies({
    async readReview(prisma, command) {
      calls.push({ prisma, command });
      return { request: { id: command.requestId }, executionAllowed: false };
    },
  }));
  const success = await found.GET(new Request(
    'https://example.test/api/tenant/privacy/requests/request-a/review',
  ), { params: Promise.resolve({ requestId: PARAMS.requestId }) });
  assert.equal(success.status, 200);
  assert.equal((await success.json()).request.id, PARAMS.requestId);
  assert.equal(calls[0].command.fingerprintKey, KEY);
  assertPrivateHeaders(success);

  const query = await found.GET(new Request(
    'https://example.test/api/tenant/privacy/requests/request-a/review?expand=pii',
  ), { params: Promise.resolve({ requestId: PARAMS.requestId }) });
  assert.equal(query.status, 400);
  assert.equal((await query.json()).code, 'PRIVACY_REVIEW_QUERY_INVALID');
  assert.equal(calls.length, 1);

  const bodies = [];
  for (const requestId of ['absent-request', 'foreign-request']) {
    const missing = createDataSubjectReviewHandlers(routeDependencies({
      async readReview() {
        throw new DataSubjectReviewError(
          'No se encontró la revisión de privacidad solicitada.',
          'PRIVACY_REVIEW_NOT_FOUND',
          404,
        );
      },
    }));
    const response = await missing.GET(new Request(
      `https://example.test/api/tenant/privacy/requests/${requestId}/review`,
    ), { params: Promise.resolve({ requestId }) });
    assert.equal(response.status, 404);
    assertPrivateHeaders(response);
    bodies.push(await response.text());
  }
  assert.equal(bodies[0], bodies[1]);
});

test('mutation cross-tenant 404 is indistinguishable and unexpected failures redact logs', async () => {
  const bodies = [];
  for (const requestId of ['absent-request', 'foreign-request']) {
    const handlers = createDataSubjectVerificationEventHandlers(routeDependencies({
      async appendVerification() {
        throw new DataSubjectReviewError(
          'No se encontró la revisión de privacidad solicitada.',
          'PRIVACY_REVIEW_NOT_FOUND',
          404,
        );
      },
    }));
    const response = await handlers.POST(postRequest({
      url: `https://example.test/api/tenant/privacy/requests/${requestId}/verification-events`,
    }), { params: Promise.resolve({ requestId }) });
    assert.equal(response.status, 404);
    assertPrivateHeaders(response);
    bodies.push(await response.text());
  }
  assert.equal(bodies[0], bodies[1]);

  const secret = `private-${crypto.randomUUID()}`;
  const logs = [];
  const failed = createDataSubjectVerificationEventHandlers(routeDependencies({
    async appendVerification() {
      const error = new Error(secret);
      error.name = secret;
      error.code = secret;
      throw error;
    },
    logError(...parts) { logs.push(parts); },
  }));
  const response = await failed.POST(postRequest(), {
    params: Promise.resolve({ requestId: PARAMS.requestId }),
  });
  assert.equal(response.status, 500);
  assert.equal((await response.text()).includes(secret), false);
  assert.equal(JSON.stringify(logs).includes(secret), false);
  assertPrivateHeaders(response);
});
