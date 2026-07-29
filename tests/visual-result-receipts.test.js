import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyPendingVisualProgressProviderResultReceipts,
  applyVisualProgressProviderResultReceipt,
  stageVisualProgressProviderResultReceipt,
  VisualResultReceiptError,
  VISUAL_RESULT_SETTLEMENT_BASIS,
} from '../src/lib/ai/visual-result-receipts.js';

const organizationId = 'organization-a';
const projectId = 'project-a';
const assessmentId = 'assessment-a';

function assessmentRow(overrides = {}) {
  return {
    id: assessmentId,
    projectId,
    taskId: 'task-a',
    evidenceId: 'evidence-a',
    requestFingerprint: 'a'.repeat(64),
    provider: 'openai',
    providerModel: 'gpt-5.6-sol',
    registryModelId: 'openai:gpt-5.6-sol',
    providerRoute: 'openai-responses-visual',
    routePolicyVersion: 'ai-dispatch-plan-v1',
    pricingVersion: '2026-07-28',
    analyzerVersion: 'visual-progress-v1',
    inputSha256: 'b'.repeat(64),
    estimatedCostMicros: 250_000n,
    actualCostMicros: null,
    providerDispatchStartedAt: new Date('2026-07-28T12:00:00.000Z'),
    status: 'RUNNING',
    failureCode: null,
    revision: 1,
    createdAt: new Date('2026-07-28T11:59:00.000Z'),
    updatedAt: new Date('2026-07-28T12:00:00.000Z'),
    ...overrides,
  };
}

function providerResult(overrides = {}) {
  return {
    provider: 'openai',
    model: 'gpt-5.6-sol',
    registryModelId: 'openai:gpt-5.6-sol',
    requestId: 'req-receipt-a',
    responseId: 'resp-receipt-a',
    input: {
      inputSha256: 'b'.repeat(64),
      submittedSha256: 'c'.repeat(64),
      width: 1280,
      height: 720,
    },
    assessment: {
      schemaVersion: 1,
      abstained: false,
      abstentionReason: null,
      summary: 'Mampostería parcialmente ejecutada.',
      elementType: 'mampostería',
      progressMin: 35,
      progressMax: 50,
      confidence: 0.74,
      facts: ['Se observan hiladas terminadas y un paño superior abierto.'],
      quality: {
        overall: 'good',
        angle: 'good',
        lighting: 'good',
        occlusion: 'none',
      },
      limitations: ['Una sola toma no permite medir toda la superficie.'],
    },
    usage: {
      inputTokens: 120,
      outputTokens: 30,
      totalTokens: 150,
      cachedInputTokens: 40,
      cacheWriteTokens: 0,
    },
    ...overrides,
  };
}

function matches(row, where = {}) {
  return Object.entries(where).every(([key, expected]) => {
    if (key === 'OR') return expected.some((condition) => matches(row, condition));
    if (expected instanceof Date) return new Date(row[key]).getTime() === expected.getTime();
    if (expected && typeof expected === 'object') {
      if (Object.hasOwn(expected, 'not') && row[key] === expected.not) return false;
      if (Object.hasOwn(expected, 'in') && !expected.in.includes(row[key])) return false;
      return true;
    }
    return row[key] === expected;
  });
}

function applyData(row, data) {
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && value.increment != null) {
      row[key] = (row[key] || 0) + value.increment;
    } else {
      row[key] = value;
    }
  }
}

function ordered(rows, orderBy = []) {
  return [...rows].sort((left, right) => {
    for (const clause of orderBy) {
      const [field, direction] = Object.entries(clause)[0];
      const leftValue = left[field] instanceof Date ? left[field].getTime() : left[field];
      const rightValue = right[field] instanceof Date ? right[field].getTime() : right[field];
      if (leftValue === rightValue) continue;
      const compared = leftValue < rightValue ? -1 : 1;
      return direction === 'desc' ? -compared : compared;
    }
    return 0;
  });
}

function receiptDatabase({ ambiguousCommitOnce = false, failCreateOnce = false } = {}) {
  let state = {
    assessment: assessmentRow(),
    receipts: [],
    audits: [],
  };
  const calls = [];
  let transactionTail = Promise.resolve();
  let throwAfterCommit = ambiguousCommitOnce;
  let rejectCreate = failCreateOnce;
  const transaction = {
    project: {
      async findFirst({ where }) {
        return where.id === projectId && where.organizationId === organizationId
          ? { id: projectId, organizationId }
          : null;
      },
    },
    visualProgressAssessment: {
      async findFirst({ where, include }) {
        if (!matches(state.assessment, where)) return null;
        return {
          ...structuredClone(state.assessment),
          ...(include?.project ? { project: { organizationId } } : {}),
        };
      },
      async updateMany({ where, data }) {
        calls.push(['assessment-update', where, data]);
        if (!matches(state.assessment, where)) return { count: 0 };
        applyData(state.assessment, data);
        return { count: 1 };
      },
    },
    visualProgressProviderResultReceipt: {
      async findUnique({ where }) {
        const receipt = state.receipts.find((row) => row.assessmentId === where.assessmentId);
        return receipt ? structuredClone(receipt) : null;
      },
      async findMany({ where, orderBy, take }) {
        return ordered(
          state.receipts.filter((row) => matches(row, where)),
          orderBy,
        ).slice(0, take).map((row) => structuredClone(row));
      },
      async create({ data }) {
        calls.push(['receipt-create', data.receiptSha256]);
        if (rejectCreate) {
          rejectCreate = false;
          const transient = new Error('temporary connection loss before insert');
          transient.code = 'P1001';
          throw transient;
        }
        if (state.receipts.some((row) => row.assessmentId === data.assessmentId)) {
          const conflict = new Error('unique receipt');
          conflict.code = 'P2002';
          throw conflict;
        }
        const receipt = { ...structuredClone(data), appliedAt: null, revision: 0 };
        state.receipts.push(receipt);
        return structuredClone(receipt);
      },
      async updateMany({ where, data }) {
        calls.push(['receipt-update', where, data]);
        const receipt = state.receipts.find((row) => matches(row, where));
        if (!receipt) return { count: 0 };
        applyData(receipt, data);
        return { count: 1 };
      },
    },
    auditLog: {
      async create({ data }) {
        calls.push(['audit-create', data.action]);
        state.audits.push(structuredClone(data));
        return data;
      },
    },
  };
  const prisma = {
    ...transaction,
    $transaction(callback) {
      const run = transactionTail.then(async () => {
        const snapshot = structuredClone(state);
        try {
          const result = await callback(transaction);
          if (throwAfterCommit) {
            throwAfterCommit = false;
            const ambiguous = new Error('commit acknowledgement lost');
            ambiguous.code = 'P1001';
            ambiguous.committed = true;
            throw ambiguous;
          }
          return result;
        } catch (cause) {
          if (!cause.committed) state = snapshot;
          throw cause;
        }
      });
      transactionTail = run.catch(() => null);
      return run;
    },
  };
  return {
    prisma,
    calls,
    get state() { return state; },
  };
}

function stageInput(overrides = {}) {
  return {
    organizationId,
    projectId,
    assessmentId,
    providerResult: providerResult(),
    receivedAt: new Date('2026-07-28T12:00:30.000Z'),
    ...overrides,
  };
}

function assertReceiptError(code, status) {
  return (cause) => {
    assert.equal(cause instanceof VisualResultReceiptError, true);
    assert.equal(cause.code, code);
    assert.equal(cause.status, status);
    return true;
  };
}

test('stage is canonical, read-after-write idempotent, and rejects a different result hash', async () => {
  const database = receiptDatabase({ ambiguousCommitOnce: true });
  const first = await stageVisualProgressProviderResultReceipt(database.prisma, stageInput());
  assert.equal(first.replayed, true);
  assert.match(first.receipt.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(database.state.receipts.length, 1);
  assert.equal(database.calls.filter(([name]) => name === 'receipt-create').length, 1);

  const replay = await stageVisualProgressProviderResultReceipt(database.prisma, stageInput({
    receivedAt: new Date('2026-07-28T12:01:00.000Z'),
  }));
  assert.equal(replay.replayed, true);
  assert.equal(replay.receipt.receiptSha256, first.receipt.receiptSha256);
  assert.equal(database.calls.filter(([name]) => name === 'receipt-create').length, 1);

  await assert.rejects(
    stageVisualProgressProviderResultReceipt(database.prisma, stageInput({
      providerResult: providerResult({
        assessment: {
          ...providerResult().assessment,
          summary: 'Un resultado materialmente diferente.',
        },
      }),
    })),
    assertReceiptError('VISUAL_RESULT_RECEIPT_HASH_CONFLICT', 409),
  );
});

test('stage retries a transient pre-write failure only within the bounded receipt operation', async () => {
  const database = receiptDatabase({ failCreateOnce: true });
  const staged = await stageVisualProgressProviderResultReceipt(database.prisma, stageInput());
  assert.equal(staged.replayed, false);
  assert.equal(database.state.receipts.length, 1);
  assert.equal(database.calls.filter(([name]) => name === 'receipt-create').length, 2);
});

test('a failed settlement rolls the projection back and the worker resumes the receipt once', async () => {
  const database = receiptDatabase();
  await stageVisualProgressProviderResultReceipt(database.prisma, stageInput());
  const settlementCalls = [];
  let failOnce = true;
  const settleBudget = async (_transaction, input) => {
    settlementCalls.push(structuredClone(input));
    if (failOnce) {
      failOnce = false;
      throw new Error('fault injection after assessment projection');
    }
    database.state.assessment.actualCostMicros = BigInt(input.actualCostMicros);
    return { status: 'SETTLED' };
  };

  await assert.rejects(
    applyVisualProgressProviderResultReceipt(database.prisma, {
      organizationId,
      projectId,
      assessmentId,
      now: new Date('2026-07-28T12:00:31.000Z'),
      settleBudget,
    }),
    assertReceiptError('VISUAL_RESULT_RECEIPT_APPLY_FAILED', 503),
  );
  assert.equal(database.state.assessment.status, 'RUNNING');
  assert.equal(database.state.assessment.actualCostMicros, null);
  assert.equal(database.state.receipts[0].appliedAt, null);
  assert.equal(database.state.audits.length, 0);

  const worked = await applyPendingVisualProgressProviderResultReceipts(database.prisma, {
    organizationId,
    projectId,
    now: new Date('2026-07-28T12:00:32.000Z'),
    settleBudget,
  });
  assert.deepEqual(worked.appliedIds, [assessmentId]);
  assert.deepEqual(worked.pending, []);
  assert.equal(database.state.assessment.status, 'COMPLETED');
  assert.equal(database.state.assessment.actualCostMicros, 1320n);
  assert.equal(database.state.receipts[0].revision, 1);
  assert.equal(database.state.receipts[0].appliedAt instanceof Date, true);
  assert.equal(database.state.audits.length, 1);
  assert.equal(settlementCalls.length, 2);
  const settled = settlementCalls.at(-1);
  assert.equal(settled.settlementBasis, VISUAL_RESULT_SETTLEMENT_BASIS);
  assert.equal(settled.settlementEvidenceSha256, database.state.receipts[0].receiptSha256);
  assert.match(settled.settlementOperationKeyHash, /^[a-f0-9]{64}$/);
  assert.equal(settled.settledById, null);
  const appliedReplay = await stageVisualProgressProviderResultReceipt(
    database.prisma,
    stageInput({ receivedAt: new Date('2026-07-28T12:05:00.000Z') }),
  );
  assert.equal(appliedReplay.replayed, true);
  assert.equal(appliedReplay.receipt.appliedAt instanceof Date, true);
});

test('concurrent workers produce one projection, settlement, and audit', async () => {
  const database = receiptDatabase();
  await stageVisualProgressProviderResultReceipt(database.prisma, stageInput());
  let settlements = 0;
  const settleBudget = async (_transaction, input) => {
    settlements += 1;
    database.state.assessment.actualCostMicros = BigInt(input.actualCostMicros);
  };
  await Promise.all([
    applyPendingVisualProgressProviderResultReceipts(database.prisma, { settleBudget }),
    applyPendingVisualProgressProviderResultReceipts(database.prisma, { settleBudget }),
  ]);
  assert.equal(settlements, 1);
  assert.equal(database.state.audits.length, 1);
  assert.equal(database.state.assessment.status, 'COMPLETED');
  assert.equal(database.state.receipts[0].revision, 1);
});

test('missing or incomplete usage applies the human result but retains the budget fence', async () => {
  for (const usage of [
    null,
    {
      inputTokens: 120,
      outputTokens: 30,
      totalTokens: 150,
      cachedInputTokens: 40,
      // A missing cache-write signal is deliberately not billable telemetry.
    },
  ]) {
    const database = receiptDatabase();
    await stageVisualProgressProviderResultReceipt(database.prisma, stageInput({
      providerResult: providerResult({ usage }),
    }));
    let settlements = 0;
    await applyVisualProgressProviderResultReceipt(database.prisma, {
      organizationId,
      projectId,
      assessmentId,
      settleBudget: async () => { settlements += 1; },
    });
    assert.equal(database.state.assessment.status, 'COMPLETED');
    assert.equal(database.state.assessment.actualCostMicros, null);
    assert.equal(database.state.receipts[0].appliedAt instanceof Date, true);
    assert.equal(database.state.receipts[0].inputTokens, null);
    assert.equal(database.state.receipts[0].cacheWriteTokens, null);
    assert.equal(settlements, 0);
  }
});

test('worker clock rollback floors appliedAt and completedAt at receipt receivedAt', async () => {
  const database = receiptDatabase();
  await stageVisualProgressProviderResultReceipt(database.prisma, stageInput({
    receivedAt: new Date('2026-07-28T12:10:00.000Z'),
  }));
  await applyVisualProgressProviderResultReceipt(database.prisma, {
    organizationId,
    projectId,
    assessmentId,
    now: new Date('2026-07-28T12:00:01.000Z'),
    settleBudget: async (_transaction, input) => {
      database.state.assessment.actualCostMicros = BigInt(input.actualCostMicros);
    },
  });
  assert.equal(
    database.state.receipts[0].appliedAt.toISOString(),
    '2026-07-28T12:10:00.000Z',
  );
  assert.equal(
    database.state.assessment.completedAt.toISOString(),
    '2026-07-28T12:10:00.000Z',
  );
});

test('scope and canonical integrity fail closed without applying a receipt', async () => {
  const database = receiptDatabase();
  await assert.rejects(
    stageVisualProgressProviderResultReceipt(database.prisma, stageInput({
      organizationId: 'organization-b',
    })),
    assertReceiptError('VISUAL_RESULT_RECEIPT_NOT_FOUND', 404),
  );

  await stageVisualProgressProviderResultReceipt(database.prisma, stageInput());
  database.state.receipts[0].summary = 'Contenido alterado después del stage.';
  await assert.rejects(
    applyVisualProgressProviderResultReceipt(database.prisma, {
      organizationId,
      projectId,
      assessmentId,
      settleBudget: async () => assert.fail('settlement must not run'),
    }),
    assertReceiptError('VISUAL_RESULT_RECEIPT_INTEGRITY_FAILED', 409),
  );
  assert.equal(database.state.assessment.status, 'RUNNING');
  assert.equal(database.state.receipts[0].appliedAt, null);
  assert.equal(database.state.audits.length, 0);
});
