import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@clerk/nextjs/server') {
      return { url: 'mock:progress-measurement-cut-route-clerk', shortCircuit: true };
    }
    if (specifier === 'next/headers') {
      return { url: 'mock:progress-measurement-cut-route-next-headers', shortCircuit: true };
    }
    if (specifier === 'server-only') {
      return { url: 'mock:progress-measurement-cut-route-server-only', shortCircuit: true };
    }
    if (specifier.startsWith('@/')) {
      const extension = specifier.startsWith('@/generated/') ? '.ts' : '.js';
      return nextResolve(new URL(`../src/${specifier.slice(2)}${extension}`, import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === 'mock:progress-measurement-cut-route-clerk') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export async function auth() { throw new Error('Unexpected auth call.'); }
          export async function clerkClient() { throw new Error('Unexpected Clerk call.'); }
        `,
      };
    }
    if (url === 'mock:progress-measurement-cut-route-next-headers') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `export async function cookies() { throw new Error('Unexpected cookie call.'); }`,
      };
    }
    if (url === 'mock:progress-measurement-cut-route-server-only') {
      return { format: 'module', shortCircuit: true, source: '' };
    }
    return nextLoad(url, context);
  },
});

const [
  { createProgressMeasurementCutHandlers },
  { AccessError },
] = await Promise.all([
  import('../src/app/api/progress-measurement-cuts/route.js'),
  import('../src/lib/access.js'),
]);

const ACCESS = Object.freeze({
  organization: { id: 'organization-a' },
  project: { id: 'project-a' },
  tenantMembershipId: 'membership-a',
});
const SCOPE = Object.freeze({ organizationId: 'organization-a', projectId: 'project-a' });

function request(path = '', {
  method = 'GET',
  body = null,
  idempotencyKey = null,
  contentType = 'application/json',
} = {}) {
  const headers = new Headers({ 'x-request-id': 'cut-route-correlation' });
  if (body !== null) headers.set('content-type', contentType);
  if (idempotencyKey !== null) headers.set('idempotency-key', idempotencyKey);
  return new Request(`https://example.test/api/progress-measurement-cuts${path}`, {
    method,
    headers,
    body: body === null ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)),
  });
}

function assertPrivate(response, replayed = null) {
  assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
  assert.equal(response.headers.get('vary'), 'Cookie, Authorization');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
  assert.equal(response.headers.get('x-request-id'), 'cut-route-correlation');
  assert.equal(response.headers.get('idempotency-replayed'), replayed === null ? null : String(replayed));
}

test('GET requires cut read permission and forwards only server-owned scope', async () => {
  const calls = [];
  const permissions = [];
  const query = { period: { start: '2026-08-16', end: '2026-08-31' } };
  const handlers = createProgressMeasurementCutHandlers({
    resolveAccess: async () => ACCESS,
    authorize: (...args) => permissions.push(args),
    prismaFactory: () => ({ marker: 'prisma' }),
    normalizeQuery: () => query,
    readSnapshot: async (...args) => {
      calls.push(args);
      return { readiness: { state: 'EMPTY' }, candidate: { lines: [] }, latestCut: null };
    },
  });
  const response = await handlers.GET(request('?periodDate=2026-08-20'));
  assert.equal(response.status, 200);
  assertPrivate(response);
  assert.deepEqual(permissions[0].slice(1), ['org:measurement-cuts:read', { subscriptionMode: 'read' }]);
  assert.deepEqual(calls[0][1], {
    scope: SCOPE,
    query,
    actorMembershipId: 'membership-a',
  });
});

test('POST requires seal permission and forwards only period, dual CAS, trusted scope and actor', async () => {
  const calls = [];
  const permissions = [];
  const body = {
    periodDate: '2026-08-20',
    expectedHeadCutId: null,
    expectedCandidateToken: 'a'.repeat(64),
  };
  let replayed = false;
  const handlers = createProgressMeasurementCutHandlers({
    resolveAccess: async () => ACCESS,
    authorize: (...args) => permissions.push(args),
    prismaFactory: () => ({ marker: 'prisma' }),
    parseBody: async () => body,
    seal: async (...args) => {
      calls.push(args);
      return {
        cut: { id: 'cut-a' },
        head: { currentCutId: 'cut-a', revision: 1 },
        executionAllowed: false,
        replayed,
      };
    },
  });
  const send = () => handlers.POST(request('', {
    method: 'POST', body, idempotencyKey: 'measurement-cut-operation-0001',
  }));
  const created = await send();
  assert.equal(created.status, 201);
  assertPrivate(created, false);
  assert.deepEqual(permissions[0].slice(1), ['org:measurement-cuts:seal', { subscriptionMode: 'write' }]);
  assert.deepEqual(calls[0][1], {
    scope: SCOPE,
    actorMembershipId: 'membership-a',
    operationKey: 'measurement-cut-operation-0001',
    input: body,
  });
  replayed = true;
  const replay = await send();
  assert.equal(replay.status, 200);
  assertPrivate(replay, true);
});

test('authorization and missing tenant membership fail before parsing or domain work', async () => {
  let bodyCalls = 0;
  let domainCalls = 0;
  const denied = createProgressMeasurementCutHandlers({
    resolveAccess: async () => ACCESS,
    authorize: () => { throw new AccessError('Denied.', { code: 'PERMISSION_REQUIRED', status: 403 }); },
    parseBody: async () => { bodyCalls += 1; },
    seal: async () => { domainCalls += 1; },
  });
  const deniedResponse = await denied.POST(request('', {
    method: 'POST', body: {}, idempotencyKey: 'measurement-cut-operation-0001',
  }));
  assert.equal(deniedResponse.status, 403);

  const missing = createProgressMeasurementCutHandlers({
    resolveAccess: async () => ({ ...ACCESS, tenantMembershipId: null }),
    authorize: () => {},
    parseBody: async () => { bodyCalls += 1; },
    seal: async () => { domainCalls += 1; },
  });
  const missingResponse = await missing.POST(request('', {
    method: 'POST', body: {}, idempotencyKey: 'measurement-cut-operation-0001',
  }));
  assert.equal(missingResponse.status, 403);
  assert.equal((await missingResponse.json()).code, 'TENANT_MEMBERSHIP_REQUIRED');
  assert.equal(bodyCalls, 0);
  assert.equal(domainCalls, 0);
});

test('GET rejects a superadmin without active tenant membership before query/storage', async () => {
  let queryCalls = 0;
  let readCalls = 0;
  const handlers = createProgressMeasurementCutHandlers({
    resolveAccess: async () => ({ ...ACCESS, tenantMembershipId: null }),
    authorize: () => {},
    normalizeQuery: () => { queryCalls += 1; },
    readSnapshot: async () => { readCalls += 1; },
  });
  const response = await handlers.GET(request('?periodDate=2026-08-20'));
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, 'TENANT_MEMBERSHIP_REQUIRED');
  assert.equal(queryCalls, 0);
  assert.equal(readCalls, 0);
});

test('GET accepts only one periodDate and never accepts tenant scope from the URL', async () => {
  let readCalls = 0;
  const handlers = createProgressMeasurementCutHandlers({
    resolveAccess: async () => ACCESS,
    authorize: () => {},
    readSnapshot: async () => { readCalls += 1; },
  });
  for (const path of [
    '',
    '?projectId=attacker&periodDate=2026-08-20',
    '?periodDate=2026-08-20&periodDate=2026-08-21',
  ]) {
    const response = await handlers.GET(request(path));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, 'PROGRESS_MEASUREMENT_CUT_QUERY_INVALID');
    assertPrivate(response);
  }
  assert.equal(readCalls, 0);
});

test('query, idempotency, media type, malformed and oversized bodies fail safely', async () => {
  let sealCalls = 0;
  const handlers = createProgressMeasurementCutHandlers({
    resolveAccess: async () => ACCESS,
    authorize: () => {},
    seal: async () => { sealCalls += 1; },
  });
  const cases = [
    [request('?projectId=attacker', { method: 'POST', body: {}, idempotencyKey: 'measurement-cut-operation-0001' }), 400, 'PROGRESS_MEASUREMENT_CUT_QUERY_INVALID'],
    [request('', { method: 'POST', body: {}, idempotencyKey: null }), 400, 'PROGRESS_MEASUREMENT_CUT_IDEMPOTENCY_KEY_INVALID'],
    [request('', { method: 'POST', body: {}, idempotencyKey: 'measurement-cut-operation-0001', contentType: 'text/plain' }), 415, 'UNSUPPORTED_MEDIA_TYPE'],
    [request('', { method: 'POST', body: '{bad', idempotencyKey: 'measurement-cut-operation-0001' }), 400, 'INVALID_JSON'],
    [request('', { method: 'POST', body: { pad: 'x'.repeat(17 * 1024) }, idempotencyKey: 'measurement-cut-operation-0001' }), 413, 'REQUEST_BODY_TOO_LARGE'],
  ];
  for (const [input, status, code] of cases) {
    const response = await handlers.POST(input);
    assert.equal(response.status, status);
    assert.equal((await response.json()).code, code);
    assertPrivate(response);
  }
  assert.equal(sealCalls, 0);
});

test('unexpected failures are redacted and correlation-only', async () => {
  const logs = [];
  const handlers = createProgressMeasurementCutHandlers({
    resolveAccess: async () => ACCESS,
    authorize: () => {},
    parseBody: async () => ({}),
    seal: async () => { throw new Error('postgres://secret'); },
    logError: (...args) => logs.push(args),
  });
  const response = await handlers.POST(request('', {
    method: 'POST', body: {}, idempotencyKey: 'measurement-cut-operation-0001',
  }));
  assert.equal(response.status, 500);
  assert.equal(JSON.stringify(logs).includes('postgres://secret'), false);
  assert.deepEqual(await response.json(), {
    error: 'No se pudo sellar el corte técnico.',
    code: 'PROGRESS_MEASUREMENT_CUT_WRITE_FAILED',
  });
});
