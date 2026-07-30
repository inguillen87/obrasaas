import assert from 'node:assert/strict';
import test from 'node:test';

import {
  reconcileUncertainWorkerPaymentFlowSubmission,
  reconcileUncertainWorkerPaymentFlowSubmissions,
  WORKER_PAYMENT_FLOW_RECONCILIATION_LIMITS,
  WorkerPaymentFlowReconciliationError,
} from '../src/lib/whatsapp/worker-payment-flow-reconciliation.js';

const FLOW_SESSION_ID = '323e4567-e89b-42d3-a456-426614174000';
const RESERVATION_ID = '423e4567-e89b-42d3-a456-426614174000';
const RESERVED_AT = new Date('2026-07-30T10:00:00.000Z');
const UNCERTAIN_AT = new Date('2026-07-30T10:02:00.000Z');
const SUBMITTED_AT = new Date('2026-07-30T10:01:00.000Z');
const PRIVACY_OPERATION_KEY = `wpc:${'a'.repeat(64)}`;
const DESTINATION_OPERATION_KEY = `wp:submit:${'b'.repeat(64)}`;
const DESTINATION_FINGERPRINT = 'c'.repeat(64);

function candidate(overrides = {}) {
  return {
    flowSessionId: FLOW_SESSION_ID,
    organizationId: 'organization-a',
    projectId: 'project-a',
    workerId: 'worker-a',
    submissionReservationId: RESERVATION_ID,
    submissionFingerprintKeyId: 'payment-flow-v1',
    submissionReservedAt: RESERVED_AT,
    submissionUncertainAt: UNCERTAIN_AT,
    paymentPurpose: 'SALARY',
    expectedDestinationType: 'CBU',
    expectedDestinationFingerprintKeyId: 'financial-v1',
    expectedDestinationFingerprint: DESTINATION_FINGERPRINT,
    expectedPrivacyOperationKey: PRIVACY_OPERATION_KEY,
    expectedDestinationOperationKey: DESTINATION_OPERATION_KEY,
    revision: 8,
    destinationId: 'destination-a',
    privacyChoiceEventId: 'privacy-choice-a',
    submittedAt: SUBMITTED_AT,
    ...overrides,
  };
}

function createPersistence({
  rows = [candidate()],
  updateCount = 1,
  outcomeCounts = updateCount === 1
    ? { awaitingOutcome: 0, provenanceMismatches: 0, reconcilableRemaining: 0 }
    : { awaitingOutcome: 0, provenanceMismatches: 0, reconcilableRemaining: 1 },
  auditError = null,
} = {}) {
  const state = {
    session: { submissionStatus: 'UNCERTAIN', revision: 8 },
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
          return calls.queries.length === 1
            ? rows
            : [{
                awaitingOutcome: BigInt(outcomeCounts.awaitingOutcome),
                provenanceMismatches: BigInt(outcomeCounts.provenanceMismatches),
                reconcilableRemaining: BigInt(outcomeCounts.reconcilableRemaining),
              }];
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

function assertReconciliationError(code) {
  return (error) => (
    error instanceof WorkerPaymentFlowReconciliationError
    && error.code === code
  );
}

test('reconciliation locks a bounded DB-selected UNCERTAIN batch and proves every binding in SQL', async () => {
  const store = createPersistence({ rows: [] });
  const result = await reconcileUncertainWorkerPaymentFlowSubmissions(store.prisma, {
    batchSize: 17,
  });

  assert.deepEqual(result, {
    scanned: 0,
    reconciled: 0,
    awaitingOutcome: 0,
    provenanceMismatches: 0,
    reconcilableRemaining: 0,
    auditRows: 0,
    hasMore: false,
    outcomes: [],
  });
  const [sql, targetOrganizationId, targetFlowSessionId, batchSize] = store.calls.queries[0];
  assert.equal(targetOrganizationId, null);
  assert.equal(targetFlowSessionId, null);
  assert.equal(batchSize, 17);
  assert.match(sql, /payment_session\."submissionStatus" = 'UNCERTAIN'/);
  assert.match(sql, /destination\."flowSubmissionReservationId"[\s\S]*payment_session\."submissionReservationId"/);
  assert.match(sql, /destination\."flowSubmissionFingerprintHmac"[\s\S]*payment_session\."submissionFingerprintHmac"/);
  assert.match(sql, /destination\."operationKey"[\s\S]*payment_session\."expectedDestinationOperationKey"/);
  assert.match(sql, /destination\."type"[\s\S]*payment_session\."expectedDestinationType"/);
  assert.match(sql, /destination\."fingerprint"[\s\S]*payment_session\."expectedDestinationFingerprint"/);
  assert.doesNotMatch(sql, /destination\."status"\s+IN/);
  assert.match(sql, /privacy_choice\."operationKey"[\s\S]*payment_session\."expectedPrivacyOperationKey"/);
  assert.match(sql, /privacy_choice\."noticeContentSha256"[\s\S]*payment_session\."noticeContentSha256"/);
  assert.match(sql, /privacy_choice\."presentedAt"[\s\S]*payment_session\."privacyPresentedAt"/);
  assert.match(
    sql,
    /LIMIT \$3::int[\s\S]*FOR UPDATE OF payment_session, destination, privacy_choice SKIP LOCKED/,
  );
  assert.match(store.calls.queries[1][0], /AS "awaitingOutcome"/);
  assert.match(store.calls.queries[1][0], /AS "provenanceMismatches"/);
  assert.match(store.calls.queries[1][0], /AS "reconcilableRemaining"/);
  assert.deepEqual(store.calls.transactionOptions, { maxWait: 3_000, timeout: 10_000 });
});

test('an exact committed destination advances UNCERTAIN by CAS and appends one audit atomically', async () => {
  const store = createPersistence();
  const result = await reconcileUncertainWorkerPaymentFlowSubmissions(store.prisma);

  assert.equal(result.scanned, 1);
  assert.equal(result.reconciled, 1);
  assert.equal(result.awaitingOutcome, 0);
  assert.equal(result.provenanceMismatches, 0);
  assert.equal(result.reconcilableRemaining, 0);
  assert.equal(result.auditRows, 1);
  assert.equal(result.hasMore, false);
  assert.deepEqual(result.outcomes, [{
    flowSessionId: FLOW_SESSION_ID,
    reservationId: RESERVATION_ID,
    destinationId: 'destination-a',
    privacyChoiceEventId: 'privacy-choice-a',
    submittedAt: SUBMITTED_AT.toISOString(),
  }]);
  assert.deepEqual(store.calls.updates[0].where, {
    flowSessionId: FLOW_SESSION_ID,
    submissionStatus: 'UNCERTAIN',
    submissionReservationId: RESERVATION_ID,
    submissionFingerprintKeyId: 'payment-flow-v1',
    paymentPurpose: 'SALARY',
    expectedPrivacyOperationKey: PRIVACY_OPERATION_KEY,
    expectedDestinationOperationKey: DESTINATION_OPERATION_KEY,
    privacyChoiceEventId: null,
    destinationId: null,
    submittedAt: null,
    submissionReconciledAt: null,
    reconciliationMethod: null,
    revision: 8,
  });
  assert.deepEqual(store.calls.updates[0].data, {
    submissionStatus: 'SUCCEEDED',
    privacyChoiceEventId: 'privacy-choice-a',
    destinationId: 'destination-a',
    submittedAt: SUBMITTED_AT,
    revision: { increment: 1 },
  });
  assert.deepEqual(store.state.session, { submissionStatus: 'SUCCEEDED', revision: 9 });
  assert.equal(store.state.audits.length, 1);
  assert.equal(store.state.audits[0].action, 'worker.payment_flow.uncertain_reconciled');
  assert.equal(store.state.audits[0].metadata.correlationId, `wpf-reconcile:${FLOW_SESSION_ID}`);
  assert.equal(store.state.audits[0].metadata.reconciliationMethod, 'OPERATION_PROVENANCE_V1');
});

test('older missing outcomes cannot starve an exact candidate and remain separately visible', async () => {
  const store = createPersistence({
    rows: [candidate()],
    outcomeCounts: {
      awaitingOutcome: 50,
      provenanceMismatches: 0,
      reconcilableRemaining: 0,
    },
  });
  const result = await reconcileUncertainWorkerPaymentFlowSubmissions(store.prisma);

  assert.deepEqual(result, {
    scanned: 1,
    reconciled: 1,
    awaitingOutcome: 50,
    provenanceMismatches: 0,
    reconcilableRemaining: 0,
    auditRows: 1,
    hasMore: false,
    outcomes: [{
      flowSessionId: FLOW_SESSION_ID,
      reservationId: RESERVATION_ID,
      destinationId: 'destination-a',
      privacyChoiceEventId: 'privacy-choice-a',
      submittedAt: SUBMITTED_AT.toISOString(),
    }],
  });
  assert.equal(store.calls.updates.length, 1);
  assert.equal(store.calls.auditCreates.length, 1);
  assert.deepEqual(store.state.session, { submissionStatus: 'SUCCEEDED', revision: 9 });
});

test('a lost CAS cannot emit an audit or claim a reconciliation', async () => {
  const store = createPersistence({ updateCount: 0 });
  const result = await reconcileUncertainWorkerPaymentFlowSubmissions(store.prisma);

  assert.equal(result.reconciled, 0);
  assert.equal(result.auditRows, 0);
  assert.deepEqual(result.outcomes, []);
  assert.equal(store.calls.auditCreates.length, 0);
  assert.deepEqual(store.state.session, { submissionStatus: 'UNCERTAIN', revision: 8 });
});

test('audit failure rolls back the reconciliation instead of leaving an unaudited success', async () => {
  const auditError = Object.assign(new Error('audit unavailable'), { code: 'P1001' });
  const store = createPersistence({ auditError });

  await assert.rejects(
    reconcileUncertainWorkerPaymentFlowSubmissions(store.prisma),
    (error) => error === auditError,
  );
  assert.deepEqual(store.state.session, { submissionStatus: 'UNCERTAIN', revision: 8 });
  assert.deepEqual(store.state.audits, []);
});

test('the exact resolver binds one UUID and returns only the reconciled outcome', async () => {
  const store = createPersistence();
  const result = await reconcileUncertainWorkerPaymentFlowSubmission(store.prisma, {
    flowSessionId: FLOW_SESSION_ID.toUpperCase(),
    organizationId: 'organization-a',
  });

  assert.equal(store.calls.queries[0][1], 'organization-a');
  assert.equal(store.calls.queries[0][2], FLOW_SESSION_ID);
  assert.equal(store.calls.queries[0][3], 1);
  assert.equal(result.hasMore, false);
  assert.deepEqual(result.outcome, result.outcomes[0]);
});

test('bounds and target identity fail before a transaction is opened', async () => {
  const store = createPersistence();
  const invalidOptions = [
    { batchSize: 0 },
    { batchSize: WORKER_PAYMENT_FLOW_RECONCILIATION_LIMITS.maxBatchSize + 1 },
    { batchSize: 1.5 },
    { flowSessionId: 'not-a-uuid' },
    { flowSessionId: FLOW_SESSION_ID },
  ];
  for (const options of invalidOptions) {
    await assert.rejects(
      reconcileUncertainWorkerPaymentFlowSubmissions(store.prisma, options),
      assertReconciliationError('WORKER_PAYMENT_FLOW_RECONCILIATION_INPUT_INVALID'),
    );
  }
  assert.equal(store.calls.queries.length, 0);
});

test('reconciliation never places financial values, form data, HMACs, tokens, or secrets in audit', async () => {
  const sensitiveValues = [
    '2850590940090418135201',
    '20-12345678-3',
    'mi.alias.secreto',
    'f'.repeat(64),
    'flow-token-secret',
    'hmac-secret-material',
  ];
  const store = createPersistence({
    rows: [candidate({
      destinationValue: sensitiveValues[0],
      holderCuil: sensitiveValues[1],
      rawForm: { destination_value: sensitiveValues[2] },
      submissionFingerprintHmac: sensitiveValues[3],
      flowToken: sensitiveValues[4],
      secret: sensitiveValues[5],
    })],
  });

  await reconcileUncertainWorkerPaymentFlowSubmissions(store.prisma);
  const serializedAudit = JSON.stringify(store.calls.auditCreates[0]);
  for (const sensitive of sensitiveValues) {
    assert.equal(serializedAudit.includes(sensitive), false);
  }
});
