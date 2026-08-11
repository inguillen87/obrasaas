import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@clerk/nextjs/server') {
      return { url: 'mock:progress-measurement-route-clerk', shortCircuit: true };
    }
    if (specifier === 'next/headers') {
      return { url: 'mock:progress-measurement-route-next-headers', shortCircuit: true };
    }
    if (specifier === 'server-only') {
      return { url: 'mock:progress-measurement-route-server-only', shortCircuit: true };
    }
    if (specifier.startsWith('@/')) {
      const extension = specifier.startsWith('@/generated/') ? '.ts' : '.js';
      return nextResolve(new URL(`../src/${specifier.slice(2)}${extension}`, import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === 'mock:progress-measurement-route-clerk') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export async function auth() { throw new Error('Unexpected auth call.'); }
          export async function clerkClient() { throw new Error('Unexpected Clerk call.'); }
        `,
      };
    }
    if (url === 'mock:progress-measurement-route-next-headers') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `export async function cookies() { throw new Error('Unexpected cookie call.'); }`,
      };
    }
    if (url === 'mock:progress-measurement-route-server-only') {
      return { format: 'module', shortCircuit: true, source: '' };
    }
    return nextLoad(url, context);
  },
});

const [
  { createProgressMeasurementHandlers },
  { createProgressMeasurementReviewHandlers },
  { AccessError },
] = await Promise.all([
  import('../src/app/api/progress-measurements/route.js'),
  import('../src/app/api/progress-measurements/[measurementId]/review/route.js'),
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
  headers: extraHeaders = {},
} = {}) {
  const headers = new Headers({ 'x-request-id': 'measurement-route-correlation', ...extraHeaders });
  if (body !== null) headers.set('content-type', contentType);
  if (idempotencyKey !== null) headers.set('idempotency-key', idempotencyKey);
  return new Request(`https://example.test/api/progress-measurements${path}`, {
    method,
    headers,
    body: body === null ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)),
  });
}

function assertPrivate(response, replayed = null) {
  assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
  assert.equal(response.headers.get('vary'), 'Cookie, Authorization');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-request-id'), 'measurement-route-correlation');
  assert.equal(response.headers.get('idempotency-replayed'), replayed === null ? null : String(replayed));
}

test('GET requires measurement read permission and forwards only server-owned scope', async () => {
  const calls = [];
  const permissions = [];
  const handlers = createProgressMeasurementHandlers({
    resolveAccess: async () => ACCESS,
    authorize: (...args) => permissions.push(args),
    prismaFactory: () => ({ marker: 'prisma' }),
    normalizeQuery: () => ({ taskId: 'task-a', period: null, status: null, cursor: null, limit: 25 }),
    readSnapshot: async (...args) => {
      calls.push(args);
      return { task: { id: 'task-a' }, measurements: [] };
    },
  });
  const response = await handlers.GET(request('?taskId=task-a'));
  assert.equal(response.status, 200);
  assertPrivate(response);
  assert.deepEqual(permissions[0].slice(1), ['org:measurements:read', { subscriptionMode: 'read' }]);
  assert.deepEqual(calls[0][1], {
    scope: SCOPE,
    query: { taskId: 'task-a', period: null, status: null, cursor: null, limit: 25 },
    actorMembershipId: 'membership-a',
  });
});

test('POST requires prepare, membership, bounded JSON and forwards trusted actor/scope', async () => {
  const permissions = [];
  const calls = [];
  const body = { taskId: 'task-a' };
  let replayed = false;
  const handlers = createProgressMeasurementHandlers({
    resolveAccess: async () => ACCESS,
    authorize: (...args) => permissions.push(args),
    prismaFactory: () => ({ marker: 'prisma' }),
    parseBody: async (_request) => body,
    submit: async (...args) => {
      calls.push(args);
      return { measurement: { id: 'measurement-a' }, replayed };
    },
  });
  const send = () => handlers.POST(request('', {
    method: 'POST',
    body,
    idempotencyKey: 'measurement-operation-0001',
  }));
  const created = await send();
  assert.equal(created.status, 201);
  assertPrivate(created, false);
  assert.deepEqual(permissions[0].slice(1), ['org:measurements:prepare', { subscriptionMode: 'write' }]);
  assert.deepEqual(calls[0][1], {
    scope: SCOPE,
    actorMembershipId: 'membership-a',
    operationKey: 'measurement-operation-0001',
    input: body,
  });
  replayed = true;
  const replay = await send();
  assert.equal(replay.status, 200);
  assertPrivate(replay, true);
});

test('review awaits Next 16 params, requires approve and uses POST CAS body', async () => {
  const calls = [];
  const permissions = [];
  const body = { expectedRevision: 2, decision: 'APPROVE', reason: 'Verificado.' };
  const handlers = createProgressMeasurementReviewHandlers({
    resolveAccess: async () => ACCESS,
    authorize: (...args) => permissions.push(args),
    prismaFactory: () => ({ marker: 'prisma' }),
    parseBody: async () => body,
    review: async (...args) => {
      calls.push(args);
      return { measurement: { id: 'measurement-a' }, replayed: false };
    },
  });
  const response = await handlers.POST(request('/measurement-a/review', {
    method: 'POST',
    body,
    idempotencyKey: 'measurement-review-0001',
  }), { params: Promise.resolve({ measurementId: 'measurement-a' }) });
  assert.equal(response.status, 201);
  assertPrivate(response, false);
  assert.deepEqual(permissions[0].slice(1), ['org:measurements:approve', { subscriptionMode: 'write' }]);
  assert.deepEqual(calls[0][1], {
    scope: SCOPE,
    actorMembershipId: 'membership-a',
    measurementId: 'measurement-a',
    operationKey: 'measurement-review-0001',
    input: body,
  });
});

test('authorization and missing membership fail before body/domain work', async () => {
  let bodyCalls = 0;
  let domainCalls = 0;
  const denied = createProgressMeasurementHandlers({
    resolveAccess: async () => ACCESS,
    authorize: () => { throw new AccessError('Denied.', { code: 'PERMISSION_REQUIRED', status: 403 }); },
    parseBody: async () => { bodyCalls += 1; },
    submit: async () => { domainCalls += 1; },
  });
  const deniedResponse = await denied.POST(request('', {
    method: 'POST', body: {}, idempotencyKey: 'measurement-operation-0001',
  }));
  assert.equal(deniedResponse.status, 403);

  const missing = createProgressMeasurementHandlers({
    resolveAccess: async () => ({ ...ACCESS, tenantMembershipId: null }),
    authorize: () => {},
    parseBody: async () => { bodyCalls += 1; },
    submit: async () => { domainCalls += 1; },
  });
  const missingResponse = await missing.POST(request('', {
    method: 'POST', body: {}, idempotencyKey: 'measurement-operation-0001',
  }));
  assert.equal(missingResponse.status, 403);
  assert.equal(bodyCalls, 0);
  assert.equal(domainCalls, 0);
});

test('GET rejects a superadmin without an active tenant membership before query/storage work', async () => {
  let queryCalls = 0;
  let readCalls = 0;
  const handlers = createProgressMeasurementHandlers({
    resolveAccess: async () => ({ ...ACCESS, tenantMembershipId: null }),
    authorize: () => {},
    normalizeQuery: () => { queryCalls += 1; },
    readSnapshot: async () => { readCalls += 1; },
  });
  const response = await handlers.GET(request('?taskId=task-a'));
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, 'TENANT_MEMBERSHIP_REQUIRED');
  assert.equal(queryCalls, 0);
  assert.equal(readCalls, 0);
});

test('query, idempotency, media type, malformed and oversized bodies fail safely', async () => {
  let submitCalls = 0;
  const handlers = createProgressMeasurementHandlers({
    resolveAccess: async () => ACCESS,
    authorize: () => {},
    submit: async () => { submitCalls += 1; },
  });
  const cases = [
    [request('?projectId=attacker', { method: 'POST', body: {}, idempotencyKey: 'measurement-operation-0001' }), 400, 'PROGRESS_MEASUREMENT_QUERY_INVALID'],
    [request('', { method: 'POST', body: {}, idempotencyKey: null }), 400, 'PROGRESS_MEASUREMENT_IDEMPOTENCY_KEY_INVALID'],
    [request('', { method: 'POST', body: {}, idempotencyKey: 'measurement-operation-0001', contentType: 'text/plain' }), 415, 'UNSUPPORTED_MEDIA_TYPE'],
    [request('', { method: 'POST', body: '{bad', idempotencyKey: 'measurement-operation-0001' }), 400, 'INVALID_JSON'],
    [request('', { method: 'POST', body: { pad: 'x'.repeat(65 * 1024) }, idempotencyKey: 'measurement-operation-0001' }), 413, 'REQUEST_BODY_TOO_LARGE'],
  ];
  for (const [input, status, code] of cases) {
    const response = await handlers.POST(input);
    assert.equal(response.status, status);
    assert.equal((await response.json()).code, code);
    assertPrivate(response);
  }
  assert.equal(submitCalls, 0);
});

test('unexpected DB failures are redacted and correlation-only', async () => {
  const logs = [];
  const handlers = createProgressMeasurementHandlers({
    resolveAccess: async () => ACCESS,
    authorize: () => {},
    parseBody: async () => ({}),
    submit: async () => { throw new Error('postgres://secret'); },
    logError: (...args) => logs.push(args),
  });
  const response = await handlers.POST(request('', {
    method: 'POST', body: {}, idempotencyKey: 'measurement-operation-0001',
  }));
  assert.equal(response.status, 500);
  assert.equal(JSON.stringify(logs).includes('postgres://secret'), false);
  assert.deepEqual(await response.json(), {
    error: 'No se pudo registrar la medición.',
    code: 'PROGRESS_MEASUREMENT_WRITE_FAILED',
  });
});
