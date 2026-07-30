import assert from 'node:assert/strict';
import test from 'node:test';

import {
  WORKER_PAYMENT_FLOW_RECOVERY_LIMITS,
  WorkerPaymentFlowRecoveryError,
  recoverExpiredWorkerPaymentFlowSubmissions,
} from '../src/lib/whatsapp/worker-payment-flow-recovery.js';

const FLOW_SESSION_ID = '323e4567-e89b-42d3-a456-426614174000';
const RESERVATION_ID = '423e4567-e89b-42d3-a456-426614174000';
const RESERVED_AT = new Date('2026-07-30T10:00:00.000Z');
const EXPIRES_AT = new Date('2026-07-30T10:30:00.000Z');

function recoveryCandidate(overrides = {}) {
  return {
    flowSessionId: FLOW_SESSION_ID,
    organizationId: 'organization-a',
    projectId: 'project-a',
    workerId: 'worker-a',
    submissionReservationId: RESERVATION_ID,
    submissionFingerprintKeyId: 'payment-flow-v1',
    submissionReservedAt: RESERVED_AT,
    expiresAt: EXPIRES_AT,
    revision: 7,
    ...overrides,
  };
}

function createPersistence({
  rows = [recoveryCandidate()],
  updateCount = 1,
  auditError = null,
} = {}) {
  const state = {
    session: { submissionStatus: 'PROCESSING', revision: 7 },
    audits: [],
  };
  const calls = {
    queries: [],
    updates: [],
    auditCreates: [],
    transactionOptions: null,
  };
  const prisma = {
    async $transaction(operation, options) {
      calls.transactionOptions = options;
      const staged = {
        session: { ...state.session },
        audits: [...state.audits],
      };
      const transaction = {
        async $queryRawUnsafe(...args) {
          calls.queries.push(args);
          return rows;
        },
        workerPaymentFlowSession: {
          async updateMany(args) {
            calls.updates.push(args);
            if (updateCount === 1) {
              staged.session.submissionStatus = args.data.submissionStatus;
              staged.session.revision += args.data.revision.increment;
            }
            return { count: updateCount };
          },
        },
        auditLog: {
          async create(args) {
            calls.auditCreates.push(args);
            if (auditError) throw auditError;
            staged.audits.push(args.data);
            return args.data;
          },
        },
      };
      const result = await operation(transaction);
      state.session = staged.session;
      state.audits = staged.audits;
      return result;
    },
  };
  return { prisma, state, calls };
}

function assertRecoveryError(code) {
  return (error) => (
    error instanceof WorkerPaymentFlowRecoveryError
    && error.code === code
  );
}

test('recovery eligibility is DB-authoritative and claims a bounded SKIP LOCKED batch', async () => {
  const store = createPersistence({ rows: [] });
  const result = await recoverExpiredWorkerPaymentFlowSubmissions(store.prisma, {
    batchSize: 17,
    staleGraceMs: 123_000,
  });

  assert.deepEqual(result, {
    scanned: 0,
    recovered: 0,
    auditRows: 0,
    hasMore: false,
  });
  assert.equal(store.calls.queries.length, 1);
  const [sql, graceMs, batchSize] = store.calls.queries[0];
  assert.match(sql, /payment_session\."submissionStatus" = 'PROCESSING'/);
  assert.match(sql, /payment_session\."expiresAt" <= statement_timestamp\(\)/);
  assert.match(sql, /base_session\."expiresAt" <= statement_timestamp\(\)/);
  assert.match(
    sql,
    /payment_session\."submissionReservedAt"[\s\S]*<= statement_timestamp\(\) - \(\$1::bigint \* INTERVAL '1 millisecond'\)/,
  );
  assert.match(sql, /LIMIT \$2::int[\s\S]*FOR UPDATE OF payment_session SKIP LOCKED/);
  assert.equal(sql.includes(new Date().toISOString()), false);
  assert.equal(graceMs, 123_000);
  assert.equal(batchSize, 17);
  assert.deepEqual(store.calls.transactionOptions, { maxWait: 3_000, timeout: 10_000 });
});

test('a claimed PROCESSING session is fenced by CAS and audited in the same transaction', async () => {
  const store = createPersistence();
  const result = await recoverExpiredWorkerPaymentFlowSubmissions(store.prisma);

  assert.deepEqual(result, {
    scanned: 1,
    recovered: 1,
    auditRows: 1,
    hasMore: false,
  });
  assert.equal(store.calls.updates.length, 1);
  assert.deepEqual(store.calls.updates[0].where, {
    flowSessionId: FLOW_SESSION_ID,
    submissionStatus: 'PROCESSING',
    submissionReservationId: RESERVATION_ID,
    submissionFingerprintKeyId: 'payment-flow-v1',
    revision: 7,
  });
  assert.equal(store.calls.updates[0].data.submissionStatus, 'UNCERTAIN');
  assert.equal(store.calls.updates[0].data.submissionUncertainAt instanceof Date, true);
  assert.deepEqual(store.calls.updates[0].data.revision, { increment: 1 });
  assert.deepEqual(store.state.session, { submissionStatus: 'UNCERTAIN', revision: 8 });
  assert.equal(store.state.audits.length, 1);
  assert.deepEqual(store.state.audits[0], {
    organizationId: 'organization-a',
    actorId: null,
    action: 'worker.payment_flow.processing_expired_uncertain',
    entityType: 'WorkerPaymentFlowSession',
    entityId: FLOW_SESSION_ID,
    metadata: {
      projectId: 'project-a',
      workerId: 'worker-a',
      reservationId: RESERVATION_ID,
      fingerprintKeyId: 'payment-flow-v1',
      previousStatus: 'PROCESSING',
      status: 'UNCERTAIN',
      reason: 'STALE_PROCESSING_AFTER_EXPIRY',
      reservedAt: RESERVED_AT.toISOString(),
      expiresAt: EXPIRES_AT.toISOString(),
      correlationId: `wpf-recovery:${FLOW_SESSION_ID}`,
    },
  });
});

test('an audit failure rolls back the session fence instead of producing an unaudited outcome', async () => {
  const auditError = Object.assign(new Error('audit unavailable'), { code: 'P1001' });
  const store = createPersistence({ auditError });

  await assert.rejects(
    recoverExpiredWorkerPaymentFlowSubmissions(store.prisma),
    (error) => error === auditError,
  );
  assert.equal(store.calls.updates.length, 1);
  assert.equal(store.calls.auditCreates.length, 1);
  assert.deepEqual(store.state.session, { submissionStatus: 'PROCESSING', revision: 7 });
  assert.deepEqual(store.state.audits, []);
});

test('a lost CAS does not emit an audit row or claim a recovery', async () => {
  const store = createPersistence({ updateCount: 0 });
  const result = await recoverExpiredWorkerPaymentFlowSubmissions(store.prisma);

  assert.deepEqual(result, {
    scanned: 1,
    recovered: 0,
    auditRows: 0,
    hasMore: false,
  });
  assert.equal(store.calls.updates.length, 1);
  assert.equal(store.calls.auditCreates.length, 0);
  assert.deepEqual(store.state.session, { submissionStatus: 'PROCESSING', revision: 7 });
  assert.deepEqual(store.state.audits, []);
});

test('recovery bounds batch size and stale grace before opening a transaction', async () => {
  const store = createPersistence();
  const invalidOptions = [
    { batchSize: 0 },
    { batchSize: WORKER_PAYMENT_FLOW_RECOVERY_LIMITS.maxBatchSize + 1 },
    { batchSize: 1.5 },
    { staleGraceMs: 59_999 },
    { staleGraceMs: 60 * 60 * 1_000 + 1 },
    { staleGraceMs: Number.NaN },
  ];

  for (const options of invalidOptions) {
    await assert.rejects(
      recoverExpiredWorkerPaymentFlowSubmissions(store.prisma, options),
      assertRecoveryError('WORKER_PAYMENT_FLOW_RECOVERY_INPUT_INVALID'),
    );
  }
  assert.equal(store.calls.queries.length, 0);
});

test('audit metadata excludes raw financial values, form payloads, HMACs, tokens, and secrets', async () => {
  const sensitiveValues = [
    '2850590940090418135201',
    '20-12345678-3',
    'mi.alias.secreto',
    'f'.repeat(64),
    'flow-token-secret',
    'hmac-secret-material',
  ];
  const store = createPersistence({
    rows: [recoveryCandidate({
      destinationValue: sensitiveValues[0],
      holderCuil: sensitiveValues[1],
      rawForm: { destination_value: sensitiveValues[2] },
      submissionFingerprintHmac: sensitiveValues[3],
      flowToken: sensitiveValues[4],
      secret: sensitiveValues[5],
    })],
  });

  await recoverExpiredWorkerPaymentFlowSubmissions(store.prisma);

  const serializedAudit = JSON.stringify(store.calls.auditCreates[0]);
  for (const sensitive of sensitiveValues) {
    assert.equal(serializedAudit.includes(sensitive), false);
  }
  assert.deepEqual(
    Object.keys(store.calls.auditCreates[0].data.metadata).sort(),
    [
      'correlationId',
      'expiresAt',
      'fingerprintKeyId',
      'previousStatus',
      'projectId',
      'reason',
      'reservationId',
      'reservedAt',
      'status',
      'workerId',
    ],
  );
});
