import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@clerk/nextjs/server') {
      return { url: 'mock:project-contract-route-clerk', shortCircuit: true };
    }
    if (specifier === 'next/headers') {
      return { url: 'mock:project-contract-route-next-headers', shortCircuit: true };
    }
    if (specifier === 'server-only') {
      return { url: 'mock:project-contract-route-server-only', shortCircuit: true };
    }
    if (specifier.startsWith('@/')) {
      const extension = specifier.startsWith('@/generated/') ? '.ts' : '.js';
      return nextResolve(new URL(`../src/${specifier.slice(2)}${extension}`, import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === 'mock:project-contract-route-clerk') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export async function auth() { throw new Error('Unexpected auth call.'); }
          export async function clerkClient() { throw new Error('Unexpected Clerk call.'); }
        `,
      };
    }
    if (url === 'mock:project-contract-route-next-headers') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `export async function cookies() { throw new Error('Unexpected cookie call.'); }`,
      };
    }
    if (url === 'mock:project-contract-route-server-only') {
      return { format: 'module', shortCircuit: true, source: '' };
    }
    return nextLoad(url, context);
  },
});

const [
  { createProjectContractReadHandlers },
  { createProjectContractAuthorityHandlers },
  { createProjectContractAuthorityDecisionHandlers },
  { createProjectContractVersionHandlers },
  { createProjectContractDecisionHandlers },
] = await Promise.all([
  import('../src/app/api/project-contract/route.js'),
  import('../src/app/api/project-contract/authorities/route.js'),
  import('../src/app/api/project-contract/authorities/[authorityVersionId]/decision/route.js'),
  import('../src/app/api/project-contract/versions/route.js'),
  import('../src/app/api/project-contract/versions/[contractVersionId]/decision/route.js'),
]);

const ACCESS = Object.freeze({
  organization: { id: 'organization-a' },
  project: { id: 'project-a' },
  tenantMembershipId: 'membership-a',
});
const SCOPE = Object.freeze({ organizationId: 'organization-a', projectId: 'project-a' });
const HASH = 'a'.repeat(64);

function request(path = '', { method = 'GET', body = null, key = null, contentType = 'application/json' } = {}) {
  const headers = new Headers({ 'x-request-id': 'contract-route-correlation' });
  if (body !== null) headers.set('content-type', contentType);
  if (key !== null) headers.set('idempotency-key', key);
  return new Request(`https://example.test/api/project-contract${path}`, {
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
  assert.equal(response.headers.get('x-request-id'), 'contract-route-correlation');
  assert.equal(response.headers.get('idempotency-replayed'), replayed === null ? null : String(replayed));
}

test('GET verifies tenant and project membership before query/read and uses read permission', async () => {
  const events = [];
  const permissions = [];
  const handlers = createProjectContractReadHandlers({
    resolveAccess: async () => { events.push('access'); return ACCESS; },
    authorize: (...args) => { events.push('permission'); permissions.push(args); },
    prismaFactory: () => ({ marker: 'prisma' }),
    verifyMembership: async (prisma, input) => {
      events.push('membership');
      assert.equal(prisma.marker, 'prisma');
      assert.deepEqual(input, { scope: SCOPE, actorMembershipId: 'membership-a' });
    },
    normalizeQuery: () => { events.push('query'); },
    readSnapshot: async (prisma, input) => {
      events.push('read');
      assert.equal(prisma.marker, 'prisma');
      assert.deepEqual(input, { scope: SCOPE, actorMembershipId: 'membership-a' });
      return { readiness: 'AUTHORITY_REQUIRED', executionAllowed: false };
    },
  });
  const response = await handlers.GET(request());
  assert.equal(response.status, 200);
  assertPrivate(response);
  assert.deepEqual(events, ['access', 'permission', 'membership', 'query', 'read']);
  assert.deepEqual(permissions[0].slice(1), ['org:contracts:read', { subscriptionMode: 'read' }]);
});

test('authority proposal verifies project membership before parsing and forwards trusted scope only', async () => {
  const events = [];
  const permissions = [];
  const body = {
    expectedCurrentAuthorityVersionId: null,
    expectedHeadRevision: 0,
    certifierMembershipId: 'membership-director',
    financeMembershipId: 'membership-finance',
    registrarMembershipId: 'membership-admin',
  };
  const handlers = createProjectContractAuthorityHandlers({
    resolveAccess: async () => ACCESS,
    authorize: (...args) => permissions.push(args),
    prismaFactory: () => ({ marker: 'prisma' }),
    verifyMembership: async () => { events.push('membership'); },
    parseBody: async () => { events.push('body'); return body; },
    propose: async (prisma, input) => {
      events.push('domain');
      assert.equal(prisma.marker, 'prisma');
      assert.deepEqual(input, {
        scope: SCOPE,
        actorMembershipId: 'membership-a',
        operationKey: 'contract-operation-0001',
        input: body,
      });
      return { authority: { id: 'authority-a' }, replayed: false, executionAllowed: false };
    },
  });
  const response = await handlers.POST(request('/authorities', {
    method: 'POST', body, key: 'contract-operation-0001',
  }));
  assert.equal(response.status, 201);
  assertPrivate(response, false);
  assert.deepEqual(events, ['membership', 'body', 'domain']);
  assert.deepEqual(permissions[0].slice(1), [
    'org:contracts:authorities:manage', { subscriptionMode: 'write' },
  ]);
});

test('authority decision uses async params, same authority permission and replay status', async () => {
  const calls = [];
  const body = {
    expectedHeadRevision: 1,
    expectedAuthorityDigest: HASH,
    decision: 'APPROVED',
    reason: 'Autoridades verificadas.',
  };
  const handlers = createProjectContractAuthorityDecisionHandlers({
    resolveAccess: async () => ACCESS,
    authorize: (...args) => calls.push(['permission', ...args.slice(1)]),
    prismaFactory: () => ({}),
    verifyMembership: async () => calls.push(['membership']),
    parseBody: async () => body,
    decide: async (prisma, input) => {
      calls.push(['domain', input]);
      return { decision: { id: 'decision-a' }, replayed: true, executionAllowed: false };
    },
  });
  const response = await handlers.POST(request('/authorities/authority-a/decision', {
    method: 'POST', body, key: 'contract-operation-0001',
  }), { params: Promise.resolve({ authorityVersionId: 'authority-a' }) });
  assert.equal(response.status, 200);
  assertPrivate(response, true);
  assert.deepEqual(calls[0], [
    'permission', 'org:contracts:authorities:manage', { subscriptionMode: 'write' },
  ]);
  assert.equal(calls[2][1].authorityVersionId, 'authority-a');
});

test('contract proposal and decision use separate prepare/approve permissions', async () => {
  const checked = [];
  const common = {
    resolveAccess: async () => ACCESS,
    authorize: (access, permission, options) => checked.push([permission, options]),
    prismaFactory: () => ({}),
    verifyMembership: async () => {},
    parseBody: async () => ({}),
  };
  const proposal = createProjectContractVersionHandlers({
    ...common,
    propose: async () => ({ contract: { id: 'contract-a' }, replayed: false }),
  });
  const proposed = await proposal.POST(request('/versions', {
    method: 'POST', body: {}, key: 'contract-operation-0001',
  }));
  assert.equal(proposed.status, 201);
  const decisionHandlers = createProjectContractDecisionHandlers({
    ...common,
    decide: async () => ({ decision: { id: 'decision-a' }, replayed: false }),
  });
  const decided = await decisionHandlers.POST(request('/versions/contract-a/decision', {
    method: 'POST', body: {}, key: 'contract-operation-0002',
  }), { params: Promise.resolve({ contractVersionId: 'contract-a' }) });
  assert.equal(decided.status, 201);
  assert.deepEqual(checked, [
    ['org:contracts:prepare', { subscriptionMode: 'write' }],
    ['org:contracts:approve', { subscriptionMode: 'write' }],
  ]);
});

test('superadmin without tenant membership fails before project lookup or body parsing', async () => {
  let membershipCalls = 0;
  let bodyCalls = 0;
  const handlers = createProjectContractAuthorityHandlers({
    resolveAccess: async () => ({ ...ACCESS, tenantMembershipId: null, isSuperadmin: true }),
    authorize: () => {},
    verifyMembership: async () => { membershipCalls += 1; },
    parseBody: async () => { bodyCalls += 1; },
  });
  const response = await handlers.POST(request('/authorities', {
    method: 'POST', body: {}, key: 'contract-operation-0001',
  }));
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, 'TENANT_PROJECT_MEMBERSHIP_REQUIRED');
  assert.equal(membershipCalls, 0);
  assert.equal(bodyCalls, 0);
});

test('media type/query/idempotency failures remain private and never call domain', async () => {
  let domainCalls = 0;
  const handlers = createProjectContractAuthorityHandlers({
    resolveAccess: async () => ACCESS,
    authorize: () => {},
    prismaFactory: () => ({}),
    verifyMembership: async () => {},
    propose: async () => { domainCalls += 1; },
  });
  for (const [input, status, code] of [
    [request('/authorities?organizationId=attacker', {
      method: 'POST', body: {}, key: 'contract-operation-0001',
    }), 400, 'PROJECT_CONTRACT_QUERY_INVALID'],
    [request('/authorities', { method: 'POST', body: {}, key: null }), 400, 'PROJECT_CONTRACT_IDEMPOTENCY_KEY_INVALID'],
    [request('/authorities', {
      method: 'POST', body: {}, key: 'contract-operation-0001', contentType: 'text/plain',
    }), 415, 'UNSUPPORTED_MEDIA_TYPE'],
  ]) {
    const response = await handlers.POST(input);
    assert.equal(response.status, status);
    assert.equal((await response.json()).code, code);
    assertPrivate(response);
  }
  assert.equal(domainCalls, 0);
});

test('unexpected errors are redacted and log only correlation metadata', async () => {
  const logs = [];
  const handlers = createProjectContractReadHandlers({
    resolveAccess: async () => ACCESS,
    authorize: () => {},
    prismaFactory: () => ({}),
    verifyMembership: async () => {},
    normalizeQuery: () => {},
    readSnapshot: async () => { throw new Error('postgres://secret'); },
    logError: (...args) => logs.push(args),
  });
  const response = await handlers.GET(request());
  assert.equal(response.status, 500);
  assert.equal(JSON.stringify(logs).includes('postgres://secret'), false);
  assert.deepEqual(await response.json(), {
    error: 'No se pudo cargar la autoridad contractual.',
    code: 'PROJECT_CONTRACT_READ_FAILED',
  });
});
