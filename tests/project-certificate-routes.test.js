import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@clerk/nextjs/server') {
      return { url: 'mock:project-certificate-route-clerk', shortCircuit: true };
    }
    if (specifier === 'next/headers') {
      return { url: 'mock:project-certificate-route-next-headers', shortCircuit: true };
    }
    if (specifier === 'server-only') {
      return { url: 'mock:project-certificate-route-server-only', shortCircuit: true };
    }
    if (specifier.startsWith('@/')) {
      const extension = specifier.startsWith('@/generated/') ? '.ts' : '.js';
      return nextResolve(new URL(`../src/${specifier.slice(2)}${extension}`, import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === 'mock:project-certificate-route-clerk') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export async function auth() { throw new Error('Unexpected auth call.'); }
          export async function clerkClient() { throw new Error('Unexpected Clerk call.'); }
        `,
      };
    }
    if (url === 'mock:project-certificate-route-next-headers') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `export async function cookies() { throw new Error('Unexpected cookie call.'); }`,
      };
    }
    if (url === 'mock:project-certificate-route-server-only') {
      return { format: 'module', shortCircuit: true, source: '' };
    }
    return nextLoad(url, context);
  },
});

const [
  { createProjectCertificateHandlers },
  { createProjectCertificateDecisionHandlers },
  { ProjectCertificateError },
] = await Promise.all([
  import('../src/app/api/project-certificates/route.js'),
  import('../src/app/api/project-certificates/[certificateVersionId]/decision/route.js'),
  import('../src/lib/project-certificates.js'),
]);

const ACCESS = Object.freeze({
  organization: { id: 'organization-a' },
  project: { id: 'project-a' },
  tenantMembershipId: 'membership-a',
});
const SCOPE = Object.freeze({ organizationId: 'organization-a', projectId: 'project-a' });
const HASH = 'a'.repeat(64);

function request(path = '?periodDate=2026-01-03', {
  method = 'GET', body = null, key = null, contentType = 'application/json',
} = {}) {
  const headers = new Headers({ 'x-request-id': 'certificate-route-correlation' });
  if (body !== null) headers.set('content-type', contentType);
  if (key !== null) headers.set('idempotency-key', key);
  return new Request(`https://example.test/api/project-certificates${path}`, {
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
  assert.equal(response.headers.get('x-request-id'), 'certificate-route-correlation');
  assert.equal(response.headers.get('idempotency-replayed'), replayed === null ? null : String(replayed));
}

function operationReceipt(replayed, operationKind = 'PREPARE') {
  return {
    operationReceiptId: 'receipt-a',
    operationKind,
    certificateVersionId: 'certificate-a',
    decisionId: operationKind === 'PREPARE' ? null : 'decision-a',
    actorMembershipId: 'membership-a',
    bookRevisionAfter: operationKind === 'PREPARE' ? 1 : 2,
    periodHeadRevisionAfter: operationKind === 'PREPARE' ? 1 : 2,
    replayed,
  };
}

test('GET authorizes and verifies exact active project membership before query/read', async () => {
  const events = [];
  const permissions = [];
  const query = { period: { start: '2026-01-01', end: '2026-01-15' } };
  const handlers = createProjectCertificateHandlers({
    resolveAccess: async () => { events.push('access'); return ACCESS; },
    authorize: (...args) => { events.push('permission'); permissions.push(args); },
    prismaFactory: () => ({ marker: 'prisma' }),
    verifyMembership: async (prisma, input) => {
      events.push('membership');
      assert.equal(prisma.marker, 'prisma');
      assert.deepEqual(input, { scope: SCOPE, actorMembershipId: 'membership-a' });
    },
    normalizeQuery: () => { events.push('query'); return query; },
    readSnapshot: async (prisma, input) => {
      events.push('read');
      assert.deepEqual(input, { scope: SCOPE, actorMembershipId: 'membership-a', query });
      return { readiness: { state: 'BLOCKED' }, executionAllowed: false };
    },
  });
  const response = await handlers.GET(request());
  assert.equal(response.status, 200);
  assertPrivate(response);
  assert.deepEqual(events, ['access', 'permission', 'membership', 'query', 'read']);
  assert.deepEqual(permissions[0].slice(1), ['org:certificates:read', { subscriptionMode: 'read' }]);
});

test('prepare checks membership before query, key and body and returns replay semantics', async () => {
  const events = [];
  const permissions = [];
  const body = {
    periodDate: '2026-01-03', expectedBookRevision: 0,
    expectedPeriodHeadRevision: 0, expectedCurrentApprovedVersionId: null, deductions: [],
  };
  const handlers = createProjectCertificateHandlers({
    resolveAccess: async () => ACCESS,
    authorize: (...args) => permissions.push(args),
    prismaFactory: () => ({ marker: 'prisma' }),
    verifyMembership: async () => { events.push('membership'); },
    parseBody: async () => { events.push('body'); return body; },
    prepare: async (prisma, input) => {
      events.push('domain');
      assert.equal(prisma.marker, 'prisma');
      assert.deepEqual(input, {
        scope: SCOPE,
        actorMembershipId: 'membership-a',
        operationKey: 'certificate-operation-0001',
        input: body,
      });
      return {
        receipt: operationReceipt(false),
        certificate: { id: 'certificate-a' },
        executionAllowed: false,
      };
    },
  });
  const response = await handlers.POST(request('', {
    method: 'POST', body, key: 'certificate-operation-0001',
  }));
  assert.equal(response.status, 201);
  assertPrivate(response, false);
  const result = await response.json();
  assert.equal(result.receipt.replayed, false);
  assert.equal(Object.hasOwn(result, 'replayed'), false);
  assert.deepEqual(events, ['membership', 'body', 'domain']);
  assert.deepEqual(permissions[0].slice(1), ['org:certificates:read', { subscriptionMode: 'write' }]);
});

test('a role-rotated active member reaches DB replay through the stable read/write gate', async () => {
  const access = { ...ACCESS, tenantRole: 'AUDITOR' };
  const events = [];
  const handlers = createProjectCertificateHandlers({
    resolveAccess: async () => access,
    authorize: (current, permission, options) => {
      events.push(['permission', current.tenantRole, permission, options]);
    },
    prismaFactory: () => ({}),
    verifyMembership: async () => events.push(['membership']),
    parseBody: async () => ({
      periodDate: '2026-01-03', expectedBookRevision: 0,
      expectedPeriodHeadRevision: 0, expectedCurrentApprovedVersionId: null, deductions: [],
    }),
    prepare: async () => {
      events.push(['database-replay']);
       return {
         receipt: operationReceipt(true),
         certificate: { id: 'certificate-a' },
         executionAllowed: false,
       };
    },
  });
  const response = await handlers.POST(request('', {
    method: 'POST', body: {}, key: 'certificate-operation-0001',
  }));
  assert.equal(response.status, 200);
  assertPrivate(response, true);
  assert.deepEqual(events, [
    ['permission', 'AUDITOR', 'org:certificates:read', { subscriptionMode: 'write' }],
    ['membership'],
    ['database-replay'],
  ]);
});

test('a new FINANCE or AUDITOR mutation reaches DB authority and returns opaque forbidden', async () => {
  for (const tenantRole of ['FINANCE', 'AUDITOR']) {
    let databaseCalls = 0;
    const handlers = createProjectCertificateHandlers({
      resolveAccess: async () => ({ ...ACCESS, tenantRole }),
      authorize: (access, permission, options) => {
        assert.equal(permission, 'org:certificates:read');
        assert.deepEqual(options, { subscriptionMode: 'write' });
      },
      prismaFactory: () => ({}),
      verifyMembership: async () => {},
      parseBody: async () => ({
        periodDate: '2026-01-03', expectedBookRevision: 0,
        expectedPeriodHeadRevision: 0, expectedCurrentApprovedVersionId: null, deductions: [],
      }),
      prepare: async () => {
        databaseCalls += 1;
        throw new ProjectCertificateError(
          'No tenés la membresía activa o designación requerida para esta operación.',
          'PROJECT_CERTIFICATE_FORBIDDEN',
          403,
        );
      },
      logError: () => {},
    });
    const response = await handlers.POST(request('', {
      method: 'POST', body: {}, key: `certificate-${tenantRole.toLowerCase()}-operation`,
    }));
    assert.equal(databaseCalls, 1);
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      error: 'No tenés la membresía activa o designación requerida para esta operación.',
      code: 'PROJECT_CERTIFICATE_FORBIDDEN',
    });
  }
});

test('write entitlement is still enforced before membership, body and DB replay', async () => {
  let membershipCalls = 0;
  let bodyCalls = 0;
  let databaseCalls = 0;
  const handlers = createProjectCertificateHandlers({
    resolveAccess: async () => ACCESS,
    authorize: (access, permission, options) => {
      assert.equal(permission, 'org:certificates:read');
      assert.deepEqual(options, { subscriptionMode: 'write' });
      throw new ProjectCertificateError(
        'La suscripción no habilita escrituras.',
        'SUBSCRIPTION_WRITE_REQUIRED',
        403,
      );
    },
    verifyMembership: async () => { membershipCalls += 1; },
    parseBody: async () => { bodyCalls += 1; },
    prepare: async () => { databaseCalls += 1; },
  });
  const response = await handlers.POST(request('', {
    method: 'POST', body: {}, key: 'certificate-operation-0001',
  }));
  assert.equal(response.status, 403);
  assert.equal(membershipCalls, 0);
  assert.equal(bodyCalls, 0);
  assert.equal(databaseCalls, 0);
});

test('decision awaits Next 16 params and uses coarse write gate with target only from path', async () => {
  const calls = [];
  const body = {
    expectedBookRevision: 1,
    expectedPeriodHeadRevision: 1,
    expectedCertificateDigest: HASH,
    decision: 'REJECT',
    reason: 'No corresponde certificar.',
  };
  const handlers = createProjectCertificateDecisionHandlers({
    resolveAccess: async () => ACCESS,
    authorize: (...args) => calls.push(['permission', ...args.slice(1)]),
    prismaFactory: () => ({}),
    verifyMembership: async () => calls.push(['membership']),
    parseBody: async () => body,
    decide: async (prisma, input) => {
      calls.push(['domain', input]);
      return {
        receipt: operationReceipt(true, 'REJECT'),
        decision: { id: 'decision-a' },
        executionAllowed: false,
      };
    },
  });
  const response = await handlers.POST(request('/certificate-a/decision', {
    method: 'POST', body, key: 'certificate-operation-0002',
  }), { params: Promise.resolve({ certificateVersionId: 'certificate-a' }) });
  assert.equal(response.status, 200);
  assertPrivate(response, true);
  assert.deepEqual(calls[0], [
    'permission', 'org:certificates:read', { subscriptionMode: 'write' },
  ]);
  assert.equal(calls[2][1].certificateVersionId, 'certificate-a');
  assert.equal(Object.hasOwn(body, 'certificateVersionId'), false);
});

test('a rotated certifier can replay its decision while a new read-only decision remains DB-forbidden', async () => {
  const body = {
    expectedBookRevision: 1,
    expectedPeriodHeadRevision: 1,
    expectedCertificateDigest: HASH,
    decision: 'REJECT',
    reason: 'No corresponde certificar.',
  };
  for (const [replayed, status] of [[true, 200], [false, 403]]) {
    let databaseCalls = 0;
    const handlers = createProjectCertificateDecisionHandlers({
      resolveAccess: async () => ({ ...ACCESS, tenantRole: 'AUDITOR' }),
      authorize: (access, permission, options) => {
        assert.equal(permission, 'org:certificates:read');
        assert.deepEqual(options, { subscriptionMode: 'write' });
      },
      prismaFactory: () => ({}),
      verifyMembership: async () => {},
      parseBody: async () => body,
      decide: async () => {
        databaseCalls += 1;
        if (!replayed) {
          throw new ProjectCertificateError(
            'No tenés la membresía activa o designación requerida para esta operación.',
            'PROJECT_CERTIFICATE_FORBIDDEN',
            403,
          );
        }
        return {
          receipt: operationReceipt(true, 'REJECT'),
          decision: { id: 'decision-a' },
          executionAllowed: false,
        };
      },
    });
    const response = await handlers.POST(request('/certificate-a/decision', {
      method: 'POST', body, key: `certificate-decision-${replayed ? 'replay' : 'new'}-0001`,
    }), { params: Promise.resolve({ certificateVersionId: 'certificate-a' }) });
    assert.equal(response.status, status);
    assert.equal(databaseCalls, 1);
    if (replayed) assertPrivate(response, true);
    else assert.equal((await response.json()).code, 'PROJECT_CERTIFICATE_FORBIDDEN');
  }
});

test('superadmin without tenant membership fails before Prisma, query or body', async () => {
  let prismaCalls = 0;
  let queryCalls = 0;
  let bodyCalls = 0;
  const handlers = createProjectCertificateHandlers({
    resolveAccess: async () => ({ ...ACCESS, tenantMembershipId: null, isSuperadmin: true }),
    authorize: () => {},
    prismaFactory: () => { prismaCalls += 1; return {}; },
    normalizeQuery: () => { queryCalls += 1; },
    parseBody: async () => { bodyCalls += 1; },
  });
  const getResponse = await handlers.GET(request());
  assert.equal(getResponse.status, 403);
  assert.equal((await getResponse.json()).code, 'TENANT_PROJECT_MEMBERSHIP_REQUIRED');
  const postResponse = await handlers.POST(request('', {
    method: 'POST', body: {}, key: 'certificate-operation-0001',
  }));
  assert.equal(postResponse.status, 403);
  assert.equal(prismaCalls, 0);
  assert.equal(queryCalls, 0);
  assert.equal(bodyCalls, 0);
});

test('query, idempotency and media failures are private and never reach domain', async () => {
  let domainCalls = 0;
  const handlers = createProjectCertificateHandlers({
    resolveAccess: async () => ACCESS,
    authorize: () => {},
    prismaFactory: () => ({}),
    verifyMembership: async () => {},
    prepare: async () => { domainCalls += 1; },
  });
  for (const [input, status, code] of [
    [request('?organizationId=attacker', {
      method: 'POST', body: {}, key: 'certificate-operation-0001',
    }), 400, 'PROJECT_CERTIFICATE_QUERY_INVALID'],
    [request('', { method: 'POST', body: {}, key: null }), 400, 'PROJECT_CERTIFICATE_IDEMPOTENCY_KEY_INVALID'],
    [request('', {
      method: 'POST', body: {}, key: 'certificate-operation-0001', contentType: 'text/plain',
    }), 415, 'UNSUPPORTED_MEDIA_TYPE'],
  ]) {
    const response = await handlers.POST(input);
    assert.equal(response.status, status);
    assert.equal((await response.json()).code, code);
    assertPrivate(response);
  }
  assert.equal(domainCalls, 0);
});

test('unexpected route failures redact messages and logs carry only correlation metadata', async () => {
  const logs = [];
  const handlers = createProjectCertificateHandlers({
    resolveAccess: async () => ACCESS,
    authorize: () => {},
    prismaFactory: () => ({}),
    verifyMembership: async () => {},
    normalizeQuery: () => ({ period: { start: '2026-01-01', end: '2026-01-15' } }),
    readSnapshot: async () => { throw new Error('postgres://secret'); },
    logError: (...args) => logs.push(args),
  });
  const response = await handlers.GET(request());
  assert.equal(response.status, 500);
  assert.equal(JSON.stringify(logs).includes('postgres://secret'), false);
  assert.deepEqual(await response.json(), {
    error: 'No se pudo cargar el certificado contractual.',
    code: 'PROJECT_CERTIFICATE_READ_FAILED',
  });
  assertPrivate(response);
});
