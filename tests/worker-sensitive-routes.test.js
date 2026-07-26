import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@clerk/nextjs/server') {
      return { url: 'mock:worker-routes-clerk', shortCircuit: true };
    }
    if (specifier === 'next/headers') {
      return { url: 'mock:worker-routes-next-headers', shortCircuit: true };
    }
    if (specifier === 'server-only') {
      return { url: 'mock:worker-routes-server-only', shortCircuit: true };
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
    if (url === 'mock:worker-routes-clerk') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export async function auth() { throw new Error('Unexpected auth call.'); }
          export async function clerkClient() { throw new Error('Unexpected Clerk call.'); }
        `,
      };
    }
    if (url === 'mock:worker-routes-next-headers') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `export async function cookies() { throw new Error('Unexpected cookie call.'); }`,
      };
    }
    if (url === 'mock:worker-routes-server-only') {
      return { format: 'module', shortCircuit: true, source: '' };
    }
    return nextLoad(url, context);
  },
});

const [
  { createWorkerOnboardingClaimHandlers, requireWorkerSensitiveRevision },
  { createWorkerOnboardingDecisionHandlers },
  { createWorkerPaymentDestinationHandlers, requireWorkerPaymentRevision },
  { createWorkerPaymentVerificationHandlers },
  { createWorkerPaymentActivationHandlers },
  { createWorkerPaymentRevocationHandlers },
] = await Promise.all([
  import('../src/app/api/worker-onboarding/claims/route.js'),
  import('../src/app/api/worker-onboarding/claims/[claimId]/decision/route.js'),
  import('../src/app/api/field/workers/[workerId]/payment-destinations/route.js'),
  import('../src/app/api/field/workers/[workerId]/payment-destinations/[destinationId]/verification/route.js'),
  import('../src/app/api/field/workers/[workerId]/payment-destinations/[destinationId]/activation/route.js'),
  import('../src/app/api/field/workers/[workerId]/payment-destinations/[destinationId]/revocation/route.js'),
]);

const NOW = new Date('2026-07-25T18:00:00.000Z');

test('sensitive route revisions stay within the PostgreSQL Int range', () => {
  assert.equal(requireWorkerSensitiveRevision(2_147_483_647), 2_147_483_647);
  assert.equal(requireWorkerPaymentRevision(2_147_483_647), 2_147_483_647);
  for (const invalid of [false, null, '0', 0.5, 2_147_483_648]) {
    assert.throws(() => requireWorkerSensitiveRevision(invalid));
    assert.throws(() => requireWorkerPaymentRevision(invalid));
  }
});

function access(overrides = {}) {
  return {
    databaseUserId: 'user-a',
    tenantMembershipId: 'membership-a',
    tenantRole: 'ADMIN',
    isSuperadmin: false,
    subscription: { canRead: true, canWrite: true },
    organization: { id: 'organization-a' },
    project: { id: 'project-a', organizationId: 'organization-a' },
    ...overrides,
  };
}

function routeContext(overrides = {}) {
  return {
    params: Promise.resolve({
      workerId: 'worker-a',
      destinationId: 'destination-a',
      claimId: 'claim-a',
      ...overrides,
    }),
  };
}

function request(path, {
  method = 'GET',
  body,
  idempotencyKey,
  contentType = body === undefined ? null : 'application/json',
  headers: extraHeaders = {},
} = {}) {
  const headers = new Headers({ 'x-request-id': 'request-route-test', ...extraHeaders });
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
  assert.equal(response.headers.get('x-request-id'), 'request-route-test');
}

function workerBridge() {
  return { id: 'worker-a', personId: 'person-a', active: true };
}

function paymentTarget() {
  return { id: 'destination-a', purpose: 'SALARY' };
}

test('onboarding claim list forwards only active scope, membership, and supported cursor filters', async () => {
  const authorizations = [];
  const calls = [];
  const expected = { items: [{ id: 'claim-a', sender: 'WhatsApp •••• 1234' }], nextCursor: null };
  const handlers = createWorkerOnboardingClaimHandlers({
    resolveAccess: async () => access(),
    authorize: (...args) => authorizations.push(args),
    prismaFactory: () => ({ kind: 'prisma' }),
    listClaims: async (...args) => {
      calls.push(args);
      return expected;
    },
    clock: () => NOW,
  });
  const response = await handlers.GET(request(
    '/api/worker-onboarding/claims?status=SUBMITTED&cursor=cursor-a&limit=25',
  ));
  assertSecure(response, 200);
  assert.deepEqual(await response.json(), expected);
  assert.deepEqual(authorizations.map(([, permission, options]) => [permission, options]), [
    ['org:workers:onboarding:read', { subscriptionMode: 'read' }],
  ]);
  assert.deepEqual(calls[0][1], {
    scope: { organizationId: 'organization-a', projectId: 'project-a' },
    requestedByMembershipId: 'membership-a',
    status: 'SUBMITTED',
    cursor: 'cursor-a',
    limit: '25',
    now: NOW,
  });
});

test('onboarding claim list rejects unknown or duplicated query filters before the service', async () => {
  let serviceCalls = 0;
  const handlers = createWorkerOnboardingClaimHandlers({
    resolveAccess: async () => access(),
    authorize: () => undefined,
    listClaims: async () => { serviceCalls += 1; },
  });
  for (const query of ['organizationId=attacker', 'status=SUBMITTED&status=APPROVED']) {
    const response = await handlers.GET(request(`/api/worker-onboarding/claims?${query}`));
    assertSecure(response, 400);
  }
  assert.equal(serviceCalls, 0);
});

test('sensitive onboarding operations fail closed for a superadmin without tenant membership', async () => {
  let serviceCalls = 0;
  const handlers = createWorkerOnboardingClaimHandlers({
    resolveAccess: async () => access({
      isSuperadmin: true,
      tenantMembershipId: null,
    }),
    authorize: () => undefined,
    listClaims: async () => { serviceCalls += 1; },
  });
  const response = await handlers.GET(request('/api/worker-onboarding/claims'));
  assertSecure(response, 403);
  assert.equal((await response.json()).code, 'TENANT_MEMBERSHIP_REQUIRED');
  assert.equal(serviceCalls, 0);
});

test('onboarding decision uses async params, header idempotency, write permission, and server evidence', async () => {
  const authorizations = [];
  const decisions = [];
  const evidenceCalls = [];
  const handlers = createWorkerOnboardingDecisionHandlers({
    resolveAccess: async () => access(),
    authorize: (...args) => authorizations.push(args),
    prismaFactory: () => ({ kind: 'prisma' }),
    buildDecisionEvidence: async (input) => {
      evidenceCalls.push(input);
      return { evidenceHash: 'a'.repeat(64), policyVersion: 'onboarding-route-v1' };
    },
    decideClaim: async (...args) => {
      decisions.push(args);
      return { id: 'claim-a', status: 'APPROVED', replayed: false };
    },
    clock: () => NOW,
  });
  const response = await handlers.POST(request(
    '/api/worker-onboarding/claims/claim-a/decision',
    {
      method: 'POST',
      idempotencyKey: 'onboarding-decision-a',
      body: { action: 'APPROVE', expectedRevision: 2 },
    },
  ), routeContext());
  assertSecure(response, 200);
  assert.deepEqual(await response.json(), {
    id: 'claim-a', status: 'APPROVED', replayed: false,
  });
  assert.deepEqual(authorizations.map(([, permission, options]) => [permission, options]), [
    ['org:workers:onboarding:manage', { subscriptionMode: 'write' }],
  ]);
  assert.equal(evidenceCalls[0].actorMembershipId, 'membership-a');
  assert.equal(evidenceCalls[0].claimId, 'claim-a');
  assert.deepEqual(decisions[0][1], {
    scope: { organizationId: 'organization-a', projectId: 'project-a' },
    claimId: 'claim-a',
    decidedByMembershipId: 'membership-a',
    decision: 'APPROVE',
    expectedRevision: 2,
    evidenceHash: 'a'.repeat(64),
    policyVersion: 'onboarding-route-v1',
    rejectionReason: null,
    idempotencyKey: 'onboarding-decision-a',
    now: NOW,
  });
});

test('onboarding decision rejects client evidence and body idempotency before side effects', async () => {
  let evidenceCalls = 0;
  let serviceCalls = 0;
  const handlers = createWorkerOnboardingDecisionHandlers({
    resolveAccess: async () => access(),
    authorize: () => undefined,
    buildDecisionEvidence: async () => { evidenceCalls += 1; },
    decideClaim: async () => { serviceCalls += 1; },
  });
  for (const extra of [
    { evidenceHash: 'b'.repeat(64) },
    { policyVersion: 'client-policy' },
    { idempotencyKey: 'body-idempotency' },
  ]) {
    const response = await handlers.POST(request(
      '/api/worker-onboarding/claims/claim-a/decision',
      {
        method: 'POST',
        idempotencyKey: 'onboarding-invalid-a',
        body: { action: 'APPROVE', expectedRevision: 0, ...extra },
      },
    ), routeContext());
    assertSecure(response, 400);
  }
  assert.equal(evidenceCalls, 0);
  assert.equal(serviceCalls, 0);
});

test('payment list resolves the worker through active project and organization before using personId', async () => {
  const authorizations = [];
  const workerQueries = [];
  const calls = [];
  const prisma = {
    worker: {
      async findFirst(args) {
        workerQueries.push(args);
        return workerBridge();
      },
    },
  };
  const handlers = createWorkerPaymentDestinationHandlers({
    resolveAccess: async () => access(),
    authorize: (...args) => authorizations.push(args),
    prismaFactory: () => prisma,
    listPaymentDestinations: async (...args) => {
      calls.push(args);
      return { paymentDestinations: [{ id: 'destination-a', maskedValue: 'CBU •••• 1234' }] };
    },
  });
  const response = await handlers.GET(request(
    '/api/field/workers/worker-a/payment-destinations?purpose=SALARY',
  ), routeContext());
  assertSecure(response, 200);
  assert.equal((await response.json()).paymentDestinations[0].maskedValue, 'CBU •••• 1234');
  assert.deepEqual(authorizations.map(([, permission, options]) => [permission, options]), [
    ['org:payroll:destinations:read', { subscriptionMode: 'read' }],
  ]);
  assert.deepEqual(workerQueries[0].where, {
    id: 'worker-a',
    projectId: 'project-a',
    project: { organizationId: 'organization-a' },
  });
  assert.deepEqual(calls[0][1], {
    scope: { organizationId: 'organization-a' },
    personId: 'person-a',
    actorMembershipId: 'membership-a',
    purpose: 'SALARY',
  });
});

test('payment routes return an opaque 404 when the worker is outside active scope', async () => {
  let serviceCalls = 0;
  const handlers = createWorkerPaymentDestinationHandlers({
    resolveAccess: async () => access(),
    authorize: () => undefined,
    prismaFactory: () => ({ worker: { findFirst: async () => null } }),
    listPaymentDestinations: async () => { serviceCalls += 1; },
  });
  const response = await handlers.GET(request(
    '/api/field/workers/foreign/payment-destinations',
  ), routeContext({ workerId: 'foreign' }));
  assertSecure(response, 404);
  assert.equal((await response.json()).code, 'WORKER_PAYMENT_NOT_FOUND');
  assert.equal(serviceCalls, 0);
});

test('payment list rejects unsupported and duplicated filters before resolving a worker', async () => {
  let workerCalls = 0;
  let serviceCalls = 0;
  const handlers = createWorkerPaymentDestinationHandlers({
    resolveAccess: async () => access(),
    authorize: () => undefined,
    resolveWorkerBridge: async () => { workerCalls += 1; },
    listPaymentDestinations: async () => { serviceCalls += 1; },
  });
  for (const query of ['status=ACTIVE', 'purpose=SALARY&purpose=REIMBURSEMENT']) {
    const response = await handlers.GET(request(
      `/api/field/workers/worker-a/payment-destinations?${query}`,
    ), routeContext());
    assertSecure(response, 400);
  }
  assert.equal(workerCalls, 0);
  assert.equal(serviceCalls, 0);
});

test('payment submission accepts only business fields and injects trusted actor, scope, and header key', async () => {
  const authorizations = [];
  const submissions = [];
  const handlers = createWorkerPaymentDestinationHandlers({
    resolveAccess: async () => access(),
    authorize: (...args) => authorizations.push(args),
    prismaFactory: () => ({ kind: 'prisma' }),
    resolveWorkerBridge: async () => workerBridge(),
    submitPaymentDestination: async (...args) => {
      submissions.push(args);
      return {
        paymentDestination: { id: 'destination-a', maskedValue: 'Alias •••• obra' },
        replayed: false,
      };
    },
    clock: () => NOW,
  });
  const response = await handlers.POST(request(
    '/api/field/workers/worker-a/payment-destinations',
    {
      method: 'POST',
      idempotencyKey: 'payment-submit-a',
      body: {
        purpose: 'SALARY',
        type: 'ALIAS',
        value: 'carlos.obra',
        holderName: 'Carlos Albañil',
        holderCuil: '20-12345678-6',
      },
    },
  ), routeContext());
  assertSecure(response, 201);
  assert.deepEqual(authorizations.map(([, permission, options]) => [permission, options]), [
    ['org:payroll:destinations:manage', { subscriptionMode: 'write' }],
  ]);
  assert.deepEqual(submissions[0][1], {
    scope: { organizationId: 'organization-a' },
    personId: 'person-a',
    submittedBy: { type: 'TENANT_MEMBERSHIP', membershipId: 'membership-a' },
    input: {
      purpose: 'SALARY',
      type: 'ALIAS',
      value: 'carlos.obra',
      holderName: 'Carlos Albañil',
      holderCuil: '20-12345678-6',
      operationKey: 'payment-submit-a',
    },
    now: NOW,
    correlationId: 'request-route-test',
  });
});

test('payment submission rejects body operation keys and oversized JSON before the service', async () => {
  let serviceCalls = 0;
  const handlers = createWorkerPaymentDestinationHandlers({
    resolveAccess: async () => access(),
    authorize: () => undefined,
    resolveWorkerBridge: async () => workerBridge(),
    submitPaymentDestination: async () => { serviceCalls += 1; },
  });
  const bodyWithKey = await handlers.POST(request(
    '/api/field/workers/worker-a/payment-destinations',
    {
      method: 'POST',
      idempotencyKey: 'payment-submit-b',
      body: {
        purpose: 'SALARY', type: 'CBU', value: 'x', holderName: 'X', holderCuil: 'x',
        operationKey: 'body-key-forbidden',
      },
    },
  ), routeContext());
  assertSecure(bodyWithKey, 400);

  const oversized = await handlers.POST(request(
    '/api/field/workers/worker-a/payment-destinations',
    {
      method: 'POST',
      idempotencyKey: 'payment-submit-c',
      body: '{}',
      headers: { 'content-length': String(8 * 1024 + 1) },
    },
  ), routeContext());
  assertSecure(oversized, 413);

  const missingHeader = await handlers.POST(request(
    '/api/field/workers/worker-a/payment-destinations',
    {
      method: 'POST',
      body: { purpose: 'SALARY', type: 'CBU', value: 'x', holderName: 'X', holderCuil: 'x' },
    },
  ), routeContext());
  assertSecure(missingHeader, 400);
  assert.equal((await missingHeader.json()).code, 'IDEMPOTENCY_KEY_INVALID');
  assert.equal(serviceCalls, 0);
});

test('payment submission fails closed before Prisma for superadmin without tenant membership', async () => {
  let prismaCalls = 0;
  let serviceCalls = 0;
  const handlers = createWorkerPaymentDestinationHandlers({
    resolveAccess: async () => access({ isSuperadmin: true, tenantMembershipId: null }),
    authorize: () => undefined,
    prismaFactory: () => { prismaCalls += 1; return {}; },
    submitPaymentDestination: async () => { serviceCalls += 1; },
  });
  const response = await handlers.POST(request(
    '/api/field/workers/worker-a/payment-destinations',
    {
      method: 'POST',
      idempotencyKey: 'payment-submit-d',
      body: { purpose: 'SALARY', type: 'CBU', value: 'x', holderName: 'X', holderCuil: 'x' },
    },
  ), routeContext());
  assertSecure(response, 403);
  assert.equal(prismaCalls, 0);
  assert.equal(serviceCalls, 0);
});

function paymentDecisionDependencies(overrides = {}) {
  return {
    resolveAccess: async () => access(),
    authorize: () => undefined,
    prismaFactory: () => ({ kind: 'prisma' }),
    resolveWorkerBridge: async () => workerBridge(),
    resolvePaymentDestination: async () => paymentTarget(),
    clock: () => NOW,
    ...overrides,
  };
}

test('verification rejects client-supplied trusted fields before resolver and service', async () => {
  let resolverCalls = 0;
  let serviceCalls = 0;
  const handlers = createWorkerPaymentVerificationHandlers(paymentDecisionDependencies({
    resolveTrustedVerification: async () => { resolverCalls += 1; },
    verifyPaymentDestination: async () => { serviceCalls += 1; },
  }));
  for (const trustedField of [
    ['evidence', { forged: true }],
    ['verificationProvider', 'CLIENT'],
    ['providerReference', 'client-reference'],
    ['verifiedHolderCuil', '20123456786'],
    ['serverResolution', { type: 'CBU', value: 'client-value' }],
    ['policyVersion', 'client-policy'],
  ]) {
    const response = await handlers.POST(request(
      '/api/field/workers/worker-a/payment-destinations/destination-a/verification',
      {
        method: 'POST',
        idempotencyKey: 'payment-verify-invalid',
        body: {
          decision: 'VERIFY',
          expectedRevision: 1,
          [trustedField[0]]: trustedField[1],
        },
      },
    ), routeContext());
    assertSecure(response, 400);
  }
  assert.equal(resolverCalls, 0);
  assert.equal(serviceCalls, 0);
});

test('verification fails closed with 503 until a trusted provider is configured', async () => {
  let serviceCalls = 0;
  const handlers = createWorkerPaymentVerificationHandlers(paymentDecisionDependencies({
    verifyPaymentDestination: async () => { serviceCalls += 1; },
  }));
  const response = await handlers.POST(request(
    '/api/field/workers/worker-a/payment-destinations/destination-a/verification',
    {
      method: 'POST',
      idempotencyKey: 'payment-verify-provider-missing',
      body: { decision: 'VERIFY', expectedRevision: 1 },
    },
  ), routeContext());
  assertSecure(response, 503);
  assert.equal(response.headers.get('retry-after'), '300');
  assert.equal((await response.json()).code, 'WORKER_PAYMENT_VERIFICATION_UNAVAILABLE');
  assert.equal(serviceCalls, 0);
});

test('trusted verification output, not browser input, is forwarded to the verification service', async () => {
  const authorizations = [];
  const calls = [];
  const handlers = createWorkerPaymentVerificationHandlers(paymentDecisionDependencies({
    authorize: (...args) => authorizations.push(args),
    resolveTrustedVerification: async () => ({
      policyVersion: 'bank-verification-v1',
      evidence: { providerResult: 'MATCHED' },
      verificationProvider: 'TRUSTED_BANK',
      providerReference: 'provider-reference-a',
      verifiedHolderCuil: '20123456786',
      serverResolution: { type: 'CBU', value: 'server-resolved-value' },
    }),
    verifyPaymentDestination: async (...args) => {
      calls.push(args);
      return { paymentDestination: { id: 'destination-a', status: 'VERIFIED' }, replayed: false };
    },
  }));
  const response = await handlers.POST(request(
    '/api/field/workers/worker-a/payment-destinations/destination-a/verification',
    {
      method: 'POST',
      idempotencyKey: 'payment-verify-trusted',
      body: { decision: 'VERIFY', expectedRevision: 1 },
    },
  ), routeContext());
  assertSecure(response, 200);
  assert.deepEqual(authorizations.map(([, permission, options]) => [permission, options]), [
    ['org:payroll:destinations:manage', { subscriptionMode: 'write' }],
  ]);
  assert.deepEqual(calls[0][1].input, {
    expectedRevision: 1,
    operationKey: 'payment-verify-trusted',
    policyVersion: 'bank-verification-v1',
  });
  assert.deepEqual(calls[0][1].trustedVerification, {
    evidence: { providerResult: 'MATCHED' },
    verificationProvider: 'TRUSTED_BANK',
    providerReference: 'provider-reference-a',
    verifiedHolderCuil: '20123456786',
    serverResolution: { type: 'CBU', value: 'server-resolved-value' },
  });
});

test('rejection skips the trusted verifier and builds evidence only on the server', async () => {
  let resolverCalls = 0;
  const evidenceCalls = [];
  const rejectionCalls = [];
  const handlers = createWorkerPaymentVerificationHandlers(paymentDecisionDependencies({
    resolveTrustedVerification: async () => { resolverCalls += 1; },
    buildDecisionEvidence: async (input) => {
      evidenceCalls.push(input);
      return { policyVersion: 'rejection-v1', evidence: { control: 'maker-checker' } };
    },
    rejectPaymentDestination: async (...args) => {
      rejectionCalls.push(args);
      return { paymentDestination: { id: 'destination-a', status: 'REJECTED' }, replayed: false };
    },
  }));
  const response = await handlers.POST(request(
    '/api/field/workers/worker-a/payment-destinations/destination-a/verification',
    {
      method: 'POST',
      idempotencyKey: 'payment-reject-a',
      body: { decision: 'REJECT', expectedRevision: 1, rejectionReason: 'Titular no coincide' },
    },
  ), routeContext());
  assertSecure(response, 200);
  assert.equal(resolverCalls, 0);
  assert.equal(evidenceCalls[0].action, 'PAYMENT_REJECTED');
  assert.deepEqual(rejectionCalls[0][1].input, {
    expectedRevision: 1,
    operationKey: 'payment-reject-a',
    policyVersion: 'rejection-v1',
    reason: 'Titular no coincide',
  });
  assert.deepEqual(rejectionCalls[0][1].trustedEvidence, { control: 'maker-checker' });
});

test('activation requires its exact write permission and injects server decision evidence', async () => {
  const authorizations = [];
  const evidenceCalls = [];
  const activationCalls = [];
  const handlers = createWorkerPaymentActivationHandlers(paymentDecisionDependencies({
    authorize: (...args) => authorizations.push(args),
    buildDecisionEvidence: async (input) => {
      evidenceCalls.push(input);
      return { policyVersion: 'activation-v1', evidence: { control: 'third-actor' } };
    },
    activatePaymentDestination: async (...args) => {
      activationCalls.push(args);
      return { paymentDestination: { id: 'destination-a', status: 'ACTIVE' }, replayed: false };
    },
  }));
  const response = await handlers.POST(request(
    '/api/field/workers/worker-a/payment-destinations/destination-a/activation',
    {
      method: 'POST',
      idempotencyKey: 'payment-activate-a',
      body: { expectedRevision: 2 },
    },
  ), routeContext());
  assertSecure(response, 200);
  assert.deepEqual(authorizations.map(([, permission, options]) => [permission, options]), [
    ['org:payroll:destinations:activate', { subscriptionMode: 'write' }],
  ]);
  assert.equal(evidenceCalls[0].action, 'PAYMENT_ACTIVATED');
  assert.deepEqual(activationCalls[0][1].input, {
    expectedRevision: 2,
    operationKey: 'payment-activate-a',
    policyVersion: 'activation-v1',
  });
  assert.deepEqual(activationCalls[0][1].trustedEvidence, { control: 'third-actor' });
});

test('revocation requires manage permission and keeps reason out of trusted evidence inputs from clients', async () => {
  const authorizations = [];
  const evidenceCalls = [];
  const revocationCalls = [];
  const handlers = createWorkerPaymentRevocationHandlers(paymentDecisionDependencies({
    authorize: (...args) => authorizations.push(args),
    buildDecisionEvidence: async (input) => {
      evidenceCalls.push(input);
      return { policyVersion: 'revocation-v1', evidence: { control: 'authorized-revocation' } };
    },
    revokePaymentDestination: async (...args) => {
      revocationCalls.push(args);
      return { paymentDestination: { id: 'destination-a', status: 'REVOKED' }, replayed: false };
    },
  }));
  const response = await handlers.POST(request(
    '/api/field/workers/worker-a/payment-destinations/destination-a/revocation',
    {
      method: 'POST',
      idempotencyKey: 'payment-revoke-a',
      body: { expectedRevision: 3, reason: 'Cuenta cerrada' },
    },
  ), routeContext());
  assertSecure(response, 200);
  assert.deepEqual(authorizations.map(([, permission, options]) => [permission, options]), [
    ['org:payroll:destinations:manage', { subscriptionMode: 'write' }],
  ]);
  assert.equal(evidenceCalls[0].reason, 'Cuenta cerrada');
  assert.deepEqual(revocationCalls[0][1].input, {
    expectedRevision: 3,
    operationKey: 'payment-revoke-a',
    policyVersion: 'revocation-v1',
    reason: 'Cuenta cerrada',
  });
  assert.deepEqual(
    revocationCalls[0][1].trustedEvidence,
    { control: 'authorized-revocation' },
  );
});

test('activation and revocation reject client evidence, policy, operation key, and query scope', async () => {
  let activationCalls = 0;
  let revocationCalls = 0;
  const activation = createWorkerPaymentActivationHandlers(paymentDecisionDependencies({
    activatePaymentDestination: async () => { activationCalls += 1; },
  }));
  const revocation = createWorkerPaymentRevocationHandlers(paymentDecisionDependencies({
    revokePaymentDestination: async () => { revocationCalls += 1; },
  }));
  for (const extra of [
    { evidence: { forged: true } },
    { policyVersion: 'client-policy' },
    { operationKey: 'client-operation-key' },
  ]) {
    const response = await activation.POST(request(
      '/api/field/workers/worker-a/payment-destinations/destination-a/activation',
      {
        method: 'POST',
        idempotencyKey: 'payment-activate-invalid',
        body: { expectedRevision: 1, ...extra },
      },
    ), routeContext());
    assertSecure(response, 400);
  }
  const forgedRevocation = await revocation.POST(request(
    '/api/field/workers/worker-a/payment-destinations/destination-a/revocation',
    {
      method: 'POST',
      idempotencyKey: 'payment-revoke-invalid',
      body: { expectedRevision: 1, reason: 'x', trustedEvidence: { forged: true } },
    },
  ), routeContext());
  assertSecure(forgedRevocation, 400);

  const queryScope = await activation.POST(request(
    '/api/field/workers/worker-a/payment-destinations/destination-a/activation?personId=foreign',
    {
      method: 'POST',
      idempotencyKey: 'payment-activate-query',
      body: { expectedRevision: 1 },
    },
  ), routeContext());
  assertSecure(queryScope, 400);
  assert.equal(activationCalls, 0);
  assert.equal(revocationCalls, 0);
});
