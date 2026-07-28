import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@clerk/nextjs/server') {
      return { url: 'mock:schedule-routes-clerk', shortCircuit: true };
    }
    if (specifier === 'next/headers') {
      return { url: 'mock:schedule-routes-next-headers', shortCircuit: true };
    }
    if (specifier === 'server-only') {
      return { url: 'mock:schedule-routes-server-only', shortCircuit: true };
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
    if (url === 'mock:schedule-routes-clerk') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export async function auth() { throw new Error('Unexpected auth call.'); }
          export async function clerkClient() { throw new Error('Unexpected Clerk call.'); }
        `,
      };
    }
    if (url === 'mock:schedule-routes-next-headers') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `export async function cookies() { throw new Error('Unexpected cookie call.'); }`,
      };
    }
    if (url === 'mock:schedule-routes-server-only') {
      return { format: 'module', shortCircuit: true, source: '' };
    }
    return nextLoad(url, context);
  },
});

const [
  { createScheduleBaselineHandlers },
  { createScheduleForecastHandlers },
] = await Promise.all([
  import('../src/app/api/schedule/baselines/route.js'),
  import('../src/app/api/schedule/forecasts/route.js'),
]);

function access(overrides = {}) {
  return {
    databaseUserId: 'user-a',
    organization: { id: 'organization-a' },
    project: { id: 'project-a', organizationId: 'organization-a' },
    subscription: { canRead: true, canWrite: true },
    tenantRole: 'ADMIN',
    ...overrides,
  };
}

function request(path, {
  method = 'GET',
  body,
  idempotencyKey,
  contentType = body === undefined ? null : 'application/json',
  headers: extraHeaders = {},
} = {}) {
  const headers = new Headers({ 'x-request-id': 'request-schedule-test', ...extraHeaders });
  if (contentType) headers.set('content-type', contentType);
  if (idempotencyKey) headers.set('idempotency-key', idempotencyKey);
  return new Request(`https://app.obrasaas.test${path}`, {
    method,
    headers,
    ...(body === undefined
      ? {}
      : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  });
}

function assertSecure(response, status) {
  assert.equal(response.status, status);
  assert.match(response.headers.get('cache-control') || '', /private/i);
  assert.match(response.headers.get('cache-control') || '', /no-store/i);
  assert.equal(response.headers.get('x-request-id'), 'request-schedule-test');
}

test('baseline list authorizes task reads and forwards only trusted tenant scope and filters', async () => {
  const authorizations = [];
  const calls = [];
  const handlers = createScheduleBaselineHandlers({
    resolveAccess: async () => access(),
    authorize: (...args) => authorizations.push(args),
    prismaFactory: () => ({ kind: 'prisma' }),
    listBaselines: async (...args) => {
      calls.push(args);
      return { baselines: [{ id: 'baseline-a' }], nextCursor: null, hasMore: false };
    },
  });
  const response = await handlers.GET(request(
    '/api/schedule/baselines?status=ACTIVE&cursor=opaque&limit=25',
  ));
  assertSecure(response, 200);
  assert.deepEqual(authorizations.map(([, permission, options]) => [permission, options]), [
    ['org:tasks:read', { subscriptionMode: 'read' }],
  ]);
  assert.deepEqual(calls[0][1], {
    scope: { organizationId: 'organization-a', projectId: 'project-a' },
    status: 'ACTIVE',
    cursor: 'opaque',
    limit: '25',
  });
});

test('schedule lists reject unknown and duplicate scope filters before Prisma', async () => {
  let baselineCalls = 0;
  let forecastCalls = 0;
  const baselineHandlers = createScheduleBaselineHandlers({
    resolveAccess: async () => access(),
    authorize: () => undefined,
    listBaselines: async () => { baselineCalls += 1; },
  });
  const forecastHandlers = createScheduleForecastHandlers({
    resolveAccess: async () => access(),
    authorize: () => undefined,
    listForecasts: async () => { forecastCalls += 1; },
  });
  for (const path of [
    '/api/schedule/baselines?organizationId=attacker',
    '/api/schedule/baselines?status=ACTIVE&status=SUPERSEDED',
  ]) {
    const response = await baselineHandlers.GET(request(path));
    assertSecure(response, 400);
    assert.equal((await response.json()).code, 'SCHEDULE_QUERY_INVALID');
  }
  for (const path of [
    '/api/schedule/forecasts?projectId=attacker',
    '/api/schedule/forecasts?baselineId=a&baselineId=b',
  ]) {
    const response = await forecastHandlers.GET(request(path));
    assertSecure(response, 400);
  }
  assert.equal(baselineCalls, 0);
  assert.equal(forecastCalls, 0);
});

test('baseline publish injects trusted actor, scope and header idempotency with replay semantics', async () => {
  const authorizations = [];
  const calls = [];
  const handlers = createScheduleBaselineHandlers({
    resolveAccess: async () => access(),
    authorize: (...args) => authorizations.push(args),
    prismaFactory: () => ({ kind: 'prisma' }),
    publishBaseline: async (...args) => {
      calls.push(args);
      return {
        baseline: { id: 'baseline-a', version: 1 },
        replayed: calls.length > 1,
      };
    },
  });
  const body = {
    expectedProjectStateVersion: 5,
    name: 'Contrato aprobado',
    replaceActiveBaseline: false,
    timeZone: 'America/Argentina/Buenos_Aires',
  };
  const first = await handlers.POST(request('/api/schedule/baselines', {
    method: 'POST',
    idempotencyKey: 'baseline-route-0001',
    body,
  }));
  assertSecure(first, 201);
  assert.equal(first.headers.get('idempotency-replayed'), 'false');

  const replay = await handlers.POST(request('/api/schedule/baselines', {
    method: 'POST',
    idempotencyKey: 'baseline-route-0001',
    body,
  }));
  assertSecure(replay, 200);
  assert.equal(replay.headers.get('idempotency-replayed'), 'true');
  assert.deepEqual(authorizations.map(([, permission, options]) => [permission, options]), [
    ['org:tasks:manage', { subscriptionMode: 'write' }],
    ['org:tasks:manage', { subscriptionMode: 'write' }],
  ]);
  assert.deepEqual(calls[0][1], {
    scope: { organizationId: 'organization-a', projectId: 'project-a' },
    actorId: 'user-a',
    idempotencyKey: 'baseline-route-0001',
    input: body,
  });
});

test('baseline publish rejects body trust fields, missing keys, query scope, and oversized JSON', async () => {
  let calls = 0;
  const handlers = createScheduleBaselineHandlers({
    resolveAccess: async () => access(),
    authorize: () => undefined,
    publishBaseline: async () => { calls += 1; },
  });
  const validBody = {
    expectedProjectStateVersion: 5,
    name: 'Contrato aprobado',
    timeZone: 'America/Argentina/Buenos_Aires',
  };
  const unknown = await handlers.POST(request('/api/schedule/baselines', {
    method: 'POST',
    idempotencyKey: 'baseline-route-0002',
    body: { ...validBody, actorId: 'attacker' },
  }));
  assertSecure(unknown, 400);
  assert.equal((await unknown.json()).code, 'SCHEDULE_UNKNOWN_FIELDS');

  const missingKey = await handlers.POST(request('/api/schedule/baselines', {
    method: 'POST',
    body: validBody,
  }));
  assertSecure(missingKey, 400);
  assert.equal((await missingKey.json()).code, 'SCHEDULE_IDEMPOTENCY_KEY_INVALID');

  const queryScope = await handlers.POST(request('/api/schedule/baselines?projectId=attacker', {
    method: 'POST',
    idempotencyKey: 'baseline-route-0003',
    body: validBody,
  }));
  assertSecure(queryScope, 400);

  const oversized = await handlers.POST(request('/api/schedule/baselines', {
    method: 'POST',
    idempotencyKey: 'baseline-route-0004',
    body: '{}',
    headers: { 'content-length': String(16 * 1024 + 1) },
  }));
  assertSecure(oversized, 413);
  assert.equal((await oversized.json()).code, 'REQUEST_BODY_TOO_LARGE');
  assert.equal(calls, 0);
});

test('forecast calculate uses task-manage permission, bounded JSON, and trusted scope', async () => {
  const authorizations = [];
  const calls = [];
  const handlers = createScheduleForecastHandlers({
    resolveAccess: async () => access(),
    authorize: (...args) => authorizations.push(args),
    prismaFactory: () => ({ kind: 'prisma' }),
    calculateForecast: async (...args) => {
      calls.push(args);
      return { forecast: { id: 'forecast-a', baselineId: 'baseline-a' }, replayed: false };
    },
  });
  const body = {
    asOfDate: '2026-07-28',
    baselineId: 'baseline-a',
    expectedProjectStateVersion: 5,
    observations: [],
  };
  const response = await handlers.POST(request('/api/schedule/forecasts', {
    method: 'POST',
    idempotencyKey: 'forecast-route-0001',
    body,
  }));
  assertSecure(response, 201);
  assert.deepEqual(authorizations.map(([, permission, options]) => [permission, options]), [
    ['org:tasks:manage', { subscriptionMode: 'write' }],
  ]);
  assert.deepEqual(calls[0][1], {
    scope: { organizationId: 'organization-a', projectId: 'project-a' },
    actorId: 'user-a',
    idempotencyKey: 'forecast-route-0001',
    input: body,
  });

  const oversized = await handlers.POST(request('/api/schedule/forecasts', {
    method: 'POST',
    idempotencyKey: 'forecast-route-0002',
    body: '{}',
    headers: { 'content-length': String(4 * 1024 * 1024 + 1) },
  }));
  assertSecure(oversized, 413);
  assert.equal(calls.length, 1);
});

test('unexpected schedule failures are logged by correlation id and returned without internals', async () => {
  const logs = [];
  const handlers = createScheduleBaselineHandlers({
    resolveAccess: async () => access(),
    authorize: () => undefined,
    listBaselines: async () => {
      throw new Error('postgresql://secret@example.invalid/private');
    },
    logError: (...args) => logs.push(args),
  });
  const response = await handlers.GET(request('/api/schedule/baselines'));
  assertSecure(response, 500);
  const body = await response.json();
  assert.equal(body.code, 'SCHEDULE_BASELINE_LIST_FAILED');
  assert.equal(JSON.stringify(body).includes('secret'), false);
  assert.equal(logs[0][1].correlationId, 'request-schedule-test');
  assert.deepEqual(Object.keys(logs[0][1]).sort(), ['code', 'correlationId', 'name']);
});
