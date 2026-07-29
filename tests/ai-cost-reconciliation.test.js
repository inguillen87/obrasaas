import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@clerk/nextjs/server') {
      return { url: 'mock:clerk-nextjs-server', shortCircuit: true };
    }
    if (specifier === 'next/headers') {
      return { url: 'mock:next-headers', shortCircuit: true };
    }
    if (specifier.startsWith('@/')) {
      const extension = specifier.startsWith('@/generated/') ? '.ts' : '.js';
      const sourcePath = new URL(`../src/${specifier.slice(2)}${extension}`, import.meta.url);
      return nextResolve(sourcePath.href, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === 'mock:clerk-nextjs-server') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export async function auth() { throw new Error('Unexpected auth call.'); }
          export async function clerkClient() { throw new Error('Unexpected Clerk call.'); }
        `,
      };
    }
    if (url === 'mock:next-headers') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `export async function cookies() { throw new Error('Unexpected cookie call.'); }`,
      };
    }
    return nextLoad(url, context);
  },
});

const {
  AiCostReconciliationError,
  MANUAL_AI_SETTLEMENT_BASES,
  normalizeAiCostReconciliationRequest,
  reconcileAiVisualCost,
} = await import('../src/lib/ai/cost-reconciliation.js');
const { AccessError } = await import('../src/lib/access.js');
const { createAiCostReconciliationHandlers } = await import(
  '../src/app/api/superadmin/ai-cost-reconciliations/route.js'
);

const EVIDENCE_SHA = 'b'.repeat(64);
const BODY = Object.freeze({
  organizationId: 'organization-a',
  projectId: 'project-a',
  assessmentId: 'assessment-a',
  settlementBasis: 'PROVIDER_BILLING',
  actualCostMicros: 4321,
  evidenceSha256: EVIDENCE_SHA,
});

function normalized(body = BODY, idempotencyKey = 'reconcile-operation-0001') {
  return normalizeAiCostReconciliationRequest(body, { idempotencyKey });
}

function fixture({ systemRole = 'SUPERADMIN' } = {}) {
  const state = {
    audits: [],
    lockQueries: [],
    assessmentActualMicros: null,
    reservation: {
      assessmentId: 'assessment-a',
      organizationId: 'organization-a',
      projectId: 'project-a',
      actualMicros: null,
      status: 'RESERVED',
      settlementBasis: null,
      settlementOperationKeyHash: null,
      settlementEvidenceSha256: null,
      settledById: null,
    },
  };
  const transaction = {
    platformUser: {
      findUnique: async () => ({ id: 'actor-a', systemRole }),
    },
    project: {
      findFirst: async ({ where }) => (
        where.id === 'project-a' && where.organizationId === 'organization-a'
          ? { id: 'project-a', organizationId: 'organization-a' }
          : null
      ),
    },
    visualProgressAssessment: {
      findFirst: async ({ where }) => (
        where.id === 'assessment-a' && where.projectId === 'project-a'
          ? {
            id: 'assessment-a',
            projectId: 'project-a',
            evidenceId: 'evidence-a',
            providerDispatchStartedAt: new Date('2026-07-28T12:00:00.000Z'),
          }
          : null
      ),
    },
    aiDispatchBudgetReservation: {
      findUnique: async () => ({ ...state.reservation }),
    },
    auditLog: {
      create: async ({ data }) => {
        state.audits.push(data);
        return data;
      },
    },
    $queryRaw: async (strings) => {
      const sql = strings.join('?');
      state.lockQueries.push(sql);
      return sql.includes('VisualProgressAssessment')
        ? [{
          id: 'assessment-a',
          actualCostMicros: state.assessmentActualMicros,
        }]
        : [{ assessmentId: state.reservation.assessmentId }];
    },
  };
  const prisma = {
    $transaction: async (callback) => callback(transaction),
  };
  const settleBudget = async (_transaction, input) => {
    state.assessmentActualMicros = BigInt(input.actualCostMicros);
    Object.assign(state.reservation, {
      actualMicros: BigInt(input.actualCostMicros),
      status: 'SETTLED',
      settlementBasis: input.settlementBasis,
      settlementOperationKeyHash: input.settlementOperationKeyHash,
      settlementEvidenceSha256: input.settlementEvidenceSha256,
      settledById: input.settledById,
    });
    return { ...state.reservation };
  };
  return { prisma, settleBudget, state };
}

test('normalizer hashes the idempotency key, fail-closes usage bases and enforces no-charge zero', () => {
  assert.deepEqual(MANUAL_AI_SETTLEMENT_BASES, [
    'PROVIDER_BILLING',
    'CONFIRMED_NO_CHARGE',
  ]);
  const first = normalized();
  const replay = normalized();
  assert.equal(first.settlementOperationKeyHash, replay.settlementOperationKeyHash);
  assert.equal(first.settlementOperationKeyHash.includes('reconcile-operation-0001'), false);
  assert.match(first.settlementOperationKeyHash, /^[a-f0-9]{64}$/);

  assert.throws(
    () => normalized({ ...BODY, settlementBasis: 'RESPONSE_USAGE' }),
    (error) => error instanceof AiCostReconciliationError
      && error.code === 'AI_COST_RECONCILIATION_BASIS_FORBIDDEN',
  );
  assert.throws(
    () => normalized({ ...BODY, settlementBasis: 'RECONCILED_USAGE' }),
    (error) => error instanceof AiCostReconciliationError
      && error.code === 'AI_COST_RECONCILIATION_BASIS_FORBIDDEN',
  );
  assert.throws(
    () => normalized({
      ...BODY,
      settlementBasis: 'CONFIRMED_NO_CHARGE',
      actualCostMicros: 1,
    }),
    (error) => error instanceof AiCostReconciliationError
      && error.code === 'AI_COST_RECONCILIATION_COST_CONFLICT',
  );
});

test('reconciliation revalidates the database superadmin and rejects access snapshots alone', async () => {
  const { prisma, settleBudget } = fixture({ systemRole: 'TENANT_USER' });
  await assert.rejects(
    reconcileAiVisualCost(prisma, {
      access: { databaseUserId: 'actor-a', isSuperadmin: true },
      input: normalized(),
      settleBudget,
    }),
    (error) => error instanceof AiCostReconciliationError
      && error.code === 'AI_COST_RECONCILIATION_SUPERADMIN_REQUIRED'
      && error.status === 403,
  );
});

test('reconciliation settles and audits once; exact replay is a read', async () => {
  const { prisma, settleBudget, state } = fixture();
  const input = normalized();
  const first = await reconcileAiVisualCost(prisma, {
    access: { databaseUserId: 'actor-a', isSuperadmin: true },
    input,
    ipAddress: '127.0.0.1',
    settleBudget,
  });
  const replay = await reconcileAiVisualCost(prisma, {
    access: { databaseUserId: 'actor-a', isSuperadmin: true },
    input,
    settleBudget,
  });

  assert.equal(first.replayed, false);
  assert.equal(first.actualCostMicros, '4321');
  assert.equal(replay.replayed, true);
  assert.equal(state.audits.length, 1);
  assert.match(state.lockQueries[0], /VisualProgressAssessment/);
  assert.match(state.lockQueries[1], /AiDispatchBudgetReservation/);
  assert.equal(state.audits[0].metadata.actualCostMicros, '4321');
  assert.equal(JSON.stringify(state.audits[0]).includes('reconcile-operation-0001'), false);
});

test('terminal settlement rejects a changed payload or a different operation key', async () => {
  const { prisma, settleBudget } = fixture();
  await reconcileAiVisualCost(prisma, {
    access: { databaseUserId: 'actor-a' },
    input: normalized(),
    settleBudget,
  });
  await assert.rejects(
    reconcileAiVisualCost(prisma, {
      access: { databaseUserId: 'actor-a' },
      input: normalized({ ...BODY, actualCostMicros: 4322 }),
      settleBudget,
    }),
    (error) => error instanceof AiCostReconciliationError
      && error.code === 'AI_COST_RECONCILIATION_TERMINAL_CONFLICT'
      && error.status === 409,
  );
});

test('terminal replay rejects a reservation whose assessment cost projection drifted', async () => {
  const { prisma, settleBudget, state } = fixture();
  const input = normalized();
  await reconcileAiVisualCost(prisma, {
    access: { databaseUserId: 'actor-a' },
    input,
    settleBudget,
  });
  state.assessmentActualMicros = 4322n;

  await assert.rejects(
    reconcileAiVisualCost(prisma, {
      access: { databaseUserId: 'actor-a' },
      input,
      settleBudget,
    }),
    (error) => error instanceof AiCostReconciliationError
      && error.code === 'AI_COST_RECONCILIATION_TERMINAL_CONFLICT'
      && error.status === 409,
  );
});

test('route requires access, bounded JSON and Idempotency-Key before reconciliation', async () => {
  const calls = [];
  const { POST } = createAiCostReconciliationHandlers({
    resolveAccess: async () => ({ databaseUserId: 'actor-a', isSuperadmin: true }),
    prismaFactory: () => ({}),
    reconcile: async (_prisma, options) => {
      calls.push(options);
      return {
        assessmentId: 'assessment-a',
        status: 'SETTLED',
        settlementBasis: 'PROVIDER_BILLING',
        actualCostMicros: '4321',
        replayed: false,
      };
    },
    resolveCorrelationId: () => 'correlation-a',
  });
  const response = await POST(new Request(
    'https://preview.example/api/superadmin/ai-cost-reconciliations',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'reconcile-operation-0001',
        'x-vercel-forwarded-for': '203.0.113.10',
      },
      body: JSON.stringify(BODY),
    },
  ));
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
  assert.equal(response.headers.get('x-request-id'), 'correlation-a');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].input.actualCostMicros, 4321);
  assert.equal(calls[0].ipAddress, '203.0.113.10');

  const missingKey = await POST(new Request(
    'https://preview.example/api/superadmin/ai-cost-reconciliations',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(BODY),
    },
  ));
  assert.equal(missingKey.status, 400);
  assert.equal(calls.length, 1);
});

test('route authenticates before exposing query validation', async () => {
  const order = [];
  const { POST } = createAiCostReconciliationHandlers({
    resolveAccess: async () => {
      order.push('access');
      throw new AccessError('denied', {
        code: 'SUPERADMIN_REQUIRED',
        status: 403,
      });
    },
    parseBody: async () => {
      order.push('body');
      return BODY;
    },
    resolveCorrelationId: () => 'correlation-denied',
  });
  const response = await POST(new Request(
    'https://preview.example/api/superadmin/ai-cost-reconciliations?probe=1',
    { method: 'POST' },
  ));
  assert.equal(response.status, 403);
  assert.deepEqual(order, ['access']);
});
