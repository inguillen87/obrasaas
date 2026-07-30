import { createAuditLog } from '../audit-log.js';

export const WORKER_PAYMENT_FLOW_RECONCILIATION_LIMITS = Object.freeze({
  batchSize: 50,
  maxBatchSize: 200,
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const KEY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const PRIVACY_OPERATION_KEY_PATTERN = /^wpc:[0-9a-f]{64}$/;
const DESTINATION_OPERATION_KEY_PATTERN = /^wp:submit:[0-9a-f]{64}$/;
const PAYMENT_PURPOSES = new Set(['SALARY', 'REIMBURSEMENT']);

export class WorkerPaymentFlowReconciliationError extends Error {
  constructor(message, code = 'WORKER_PAYMENT_FLOW_RECONCILIATION_UNAVAILABLE') {
    super(message);
    this.name = 'WorkerPaymentFlowReconciliationError';
    this.code = code;
    this.status = 503;
  }
}

function reconciliationError(message, code) {
  return new WorkerPaymentFlowReconciliationError(message, code);
}

function boundedInteger(value, name, { min, max }) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw reconciliationError(
      `Invalid worker-payment Flow reconciliation ${name}.`,
      'WORKER_PAYMENT_FLOW_RECONCILIATION_INPUT_INVALID',
    );
  }
  return parsed;
}

function requiredIdentifier(value, name, pattern = null) {
  const normalized = String(value || '').trim();
  if (!normalized || (pattern && !pattern.test(normalized))) {
    throw reconciliationError(
      `Invalid worker-payment Flow reconciliation ${name}.`,
      'WORKER_PAYMENT_FLOW_RECONCILIATION_STATE_INVALID',
    );
  }
  return normalized;
}

function requiredDate(value, name) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw reconciliationError(
      `Invalid worker-payment Flow reconciliation ${name}.`,
      'WORKER_PAYMENT_FLOW_RECONCILIATION_STATE_INVALID',
    );
  }
  return date;
}

function candidateRow(value) {
  const row = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const paymentPurpose = requiredIdentifier(row.paymentPurpose, 'payment purpose');
  if (!PAYMENT_PURPOSES.has(paymentPurpose)) {
    throw reconciliationError(
      'Invalid worker-payment Flow reconciliation payment purpose.',
      'WORKER_PAYMENT_FLOW_RECONCILIATION_STATE_INVALID',
    );
  }
  return {
    flowSessionId: requiredIdentifier(row.flowSessionId, 'session identity', UUID_PATTERN)
      .toLowerCase(),
    organizationId: requiredIdentifier(row.organizationId, 'organization identity'),
    projectId: requiredIdentifier(row.projectId, 'project identity'),
    workerId: requiredIdentifier(row.workerId, 'worker identity'),
    reservationId: requiredIdentifier(
      row.submissionReservationId,
      'reservation identity',
      UUID_PATTERN,
    ).toLowerCase(),
    fingerprintKeyId: requiredIdentifier(
      row.submissionFingerprintKeyId,
      'HMAC key identity',
      KEY_ID_PATTERN,
    ),
    paymentPurpose,
    expectedPrivacyOperationKey: requiredIdentifier(
      row.expectedPrivacyOperationKey,
      'privacy operation identity',
      PRIVACY_OPERATION_KEY_PATTERN,
    ),
    expectedDestinationOperationKey: requiredIdentifier(
      row.expectedDestinationOperationKey,
      'destination operation identity',
      DESTINATION_OPERATION_KEY_PATTERN,
    ),
    reservedAt: requiredDate(row.submissionReservedAt, 'reservation clock'),
    uncertainAt: requiredDate(row.submissionUncertainAt, 'uncertainty clock'),
    revision: boundedInteger(row.revision, 'revision', { min: 0, max: 2_147_483_646 }),
    destinationId: requiredIdentifier(row.destinationId, 'destination identity'),
    privacyChoiceEventId: requiredIdentifier(row.privacyChoiceEventId, 'privacy choice identity'),
    submittedAt: requiredDate(row.submittedAt, 'submission clock'),
  };
}

function safeCount(value, name) {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw reconciliationError(
      `Invalid worker-payment Flow reconciliation ${name}.`,
      'WORKER_PAYMENT_FLOW_RECONCILIATION_STATE_INVALID',
    );
  }
  return count;
}

function assertPersistence(prisma) {
  if (typeof prisma?.$transaction !== 'function') {
    throw reconciliationError('Worker-payment Flow reconciliation persistence is unavailable.');
  }
}

function normalizedTargetFlowSessionId(value) {
  if (value === undefined || value === null || value === '') return null;
  const normalized = String(value || '').trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    throw reconciliationError(
      'Invalid worker-payment Flow reconciliation target session identity.',
      'WORKER_PAYMENT_FLOW_RECONCILIATION_INPUT_INVALID',
    );
  }
  return normalized;
}

function normalizedTargetOrganizationId(value) {
  if (value === undefined || value === null || value === '') return null;
  const normalized = String(value).trim();
  if (!normalized || normalized.length > 191) {
    throw reconciliationError(
      'Invalid worker-payment Flow reconciliation target organization identity.',
      'WORKER_PAYMENT_FLOW_RECONCILIATION_INPUT_INVALID',
    );
  }
  return normalized;
}

/**
 * Resolves only an outcome that was already committed by the destination
 * transaction and is immutably tied to the exact reservation, keyed form HMAC,
 * operation keys, notice and worker channel. It never receives form values and
 * never invokes a bridge, provider or WhatsApp send.
 */
export async function reconcileUncertainWorkerPaymentFlowSubmissions(
  prisma,
  {
    batchSize = WORKER_PAYMENT_FLOW_RECONCILIATION_LIMITS.batchSize,
    flowSessionId = null,
    organizationId = null,
  } = {},
) {
  assertPersistence(prisma);
  const boundedBatchSize = boundedInteger(batchSize, 'batch size', {
    min: 1,
    max: WORKER_PAYMENT_FLOW_RECONCILIATION_LIMITS.maxBatchSize,
  });
  const targetFlowSessionId = normalizedTargetFlowSessionId(flowSessionId);
  const targetOrganizationId = normalizedTargetOrganizationId(organizationId);
  if (targetFlowSessionId && !targetOrganizationId) {
    throw reconciliationError(
      'Targeted worker-payment Flow reconciliation requires an organization identity.',
      'WORKER_PAYMENT_FLOW_RECONCILIATION_INPUT_INVALID',
    );
  }

  return prisma.$transaction(async (transaction) => {
    if (
      typeof transaction?.$queryRawUnsafe !== 'function'
      || typeof transaction?.workerPaymentFlowSession?.updateMany !== 'function'
      || typeof transaction?.auditLog?.create !== 'function'
    ) {
      throw reconciliationError('Worker-payment Flow reconciliation persistence is unavailable.');
    }
    const rows = await transaction.$queryRawUnsafe(
      `SELECT
         payment_session."flowSessionId",
         payment_session."organizationId",
         payment_session."projectId",
         payment_session."workerId",
         payment_session."submissionReservationId",
         payment_session."submissionFingerprintKeyId",
         payment_session."submissionReservedAt",
         payment_session."submissionUncertainAt",
         payment_session."paymentPurpose"::text AS "paymentPurpose",
         payment_session."expectedPrivacyOperationKey",
         payment_session."expectedDestinationOperationKey",
         payment_session."revision",
         destination."id" AS "destinationId",
         destination."privacyChoiceEventId",
         destination."submittedAt"
       FROM "WorkerPaymentFlowSession" AS payment_session
       INNER JOIN "WorkerPaymentDestination" AS destination
         ON destination."flowSubmissionReservationId"
           = payment_session."submissionReservationId"
        AND destination."organizationId" = payment_session."organizationId"
        AND destination."personId" = payment_session."personId"
        AND destination."purpose" = payment_session."paymentPurpose"
        AND destination."type" = payment_session."expectedDestinationType"
        AND destination."fingerprintKeyId"
          = payment_session."expectedDestinationFingerprintKeyId"
        AND destination."fingerprint"
          = payment_session."expectedDestinationFingerprint"
        AND destination."submissionSource" = 'WORKER_CHANNEL'
        AND destination."submittedByMembershipId" IS NULL
        AND destination."submittedByChannelIdentityId" = payment_session."channelIdentityId"
        AND destination."submissionContractVersion" = 'ATTESTED_V1'
        AND destination."operationKey" = payment_session."expectedDestinationOperationKey"
        AND destination."flowSubmissionFingerprintKeyId"
          = payment_session."submissionFingerprintKeyId"
        AND destination."flowSubmissionFingerprintHmac"
          = payment_session."submissionFingerprintHmac"
        AND destination."submittedAt" >= payment_session."submissionReservedAt"
       INNER JOIN "WorkerPrivacyChoiceEvent" AS privacy_choice
         ON privacy_choice."id" = destination."privacyChoiceEventId"
        AND privacy_choice."organizationId" = destination."organizationId"
        AND privacy_choice."personId" = destination."personId"
        AND privacy_choice."paymentPurpose" = destination."purpose"
        AND privacy_choice."organizationId" = payment_session."organizationId"
        AND privacy_choice."personId" = payment_session."personId"
        AND privacy_choice."purpose" = 'PAYMENT_DESTINATION_CAPTURE'
        AND privacy_choice."paymentPurpose" = payment_session."paymentPurpose"
        AND privacy_choice."channel" = 'WHATSAPP_FLOW'
        AND privacy_choice."action" = 'WORKER_ACKNOWLEDGED'
        AND privacy_choice."actorMembershipId" IS NULL
        AND privacy_choice."channelIdentityId" = payment_session."channelIdentityId"
        AND privacy_choice."noticeVersion" = payment_session."noticeVersion"
        AND privacy_choice."noticeContentSha256" = payment_session."noticeContentSha256"
        AND privacy_choice."presentedAt" = payment_session."privacyPresentedAt"
        AND privacy_choice."decidedAt" = destination."submittedAt"
        AND privacy_choice."decidedAt" >= payment_session."submissionReservedAt"
        AND privacy_choice."operationKey" = payment_session."expectedPrivacyOperationKey"
       WHERE payment_session."submissionStatus" = 'UNCERTAIN'
         AND payment_session."privacyChoiceEventId" IS NULL
         AND payment_session."destinationId" IS NULL
         AND payment_session."submittedAt" IS NULL
         AND payment_session."submissionReconciledAt" IS NULL
         AND payment_session."reconciliationMethod" IS NULL
         AND ($1::text IS NULL OR payment_session."organizationId" = $1::text)
         AND ($2::uuid IS NULL OR payment_session."flowSessionId" = $2::uuid)
       ORDER BY payment_session."submissionUncertainAt" ASC,
                payment_session."flowSessionId" ASC
       LIMIT $3::int
       FOR UPDATE OF payment_session, destination, privacy_choice SKIP LOCKED`,
      targetOrganizationId,
      targetFlowSessionId,
      boundedBatchSize,
    );
    if (!Array.isArray(rows)) {
      throw reconciliationError(
        'Worker-payment Flow reconciliation returned an invalid candidate set.',
        'WORKER_PAYMENT_FLOW_RECONCILIATION_STATE_INVALID',
      );
    }

    let reconciled = 0;
    let auditRows = 0;
    const outcomes = [];
    for (const rawRow of rows) {
      const row = candidateRow(rawRow);
      const update = await transaction.workerPaymentFlowSession.updateMany({
        where: {
          flowSessionId: row.flowSessionId,
          submissionStatus: 'UNCERTAIN',
          submissionReservationId: row.reservationId,
          submissionFingerprintKeyId: row.fingerprintKeyId,
          paymentPurpose: row.paymentPurpose,
          expectedPrivacyOperationKey: row.expectedPrivacyOperationKey,
          expectedDestinationOperationKey: row.expectedDestinationOperationKey,
          privacyChoiceEventId: null,
          destinationId: null,
          submittedAt: null,
          submissionReconciledAt: null,
          reconciliationMethod: null,
          revision: row.revision,
        },
        data: {
          submissionStatus: 'SUCCEEDED',
          privacyChoiceEventId: row.privacyChoiceEventId,
          destinationId: row.destinationId,
          submittedAt: row.submittedAt,
          revision: { increment: 1 },
        },
      });
      if (update?.count !== 1) continue;
      reconciled += 1;
      const outcome = Object.freeze({
        flowSessionId: row.flowSessionId,
        reservationId: row.reservationId,
        destinationId: row.destinationId,
        privacyChoiceEventId: row.privacyChoiceEventId,
        submittedAt: row.submittedAt.toISOString(),
      });
      outcomes.push(outcome);
      await createAuditLog(transaction, {
        organizationId: row.organizationId,
        actorId: null,
        action: 'worker.payment_flow.uncertain_reconciled',
        entityType: 'WorkerPaymentFlowSession',
        entityId: row.flowSessionId,
        correlationId: `wpf-reconcile:${row.flowSessionId}`,
        metadata: {
          projectId: row.projectId,
          workerId: row.workerId,
          reservationId: row.reservationId,
          fingerprintKeyId: row.fingerprintKeyId,
          destinationId: row.destinationId,
          privacyChoiceEventId: row.privacyChoiceEventId,
          previousStatus: 'UNCERTAIN',
          status: 'SUCCEEDED',
          reason: 'EXACT_OPERATION_PROVENANCE_MATCH',
          reconciliationMethod: 'OPERATION_PROVENANCE_V1',
          reservedAt: row.reservedAt.toISOString(),
          uncertainAt: row.uncertainAt.toISOString(),
          submittedAt: row.submittedAt.toISOString(),
        },
      });
      auditRows += 1;
    }
    const unresolvedRows = await transaction.$queryRawUnsafe(
      `SELECT
         COUNT(*) FILTER (WHERE raw_destination."id" IS NULL)::bigint
           AS "awaitingOutcome",
         COUNT(*) FILTER (
           WHERE raw_destination."id" IS NOT NULL
             AND proof_privacy."id" IS NULL
         )::bigint AS "provenanceMismatches",
         COUNT(*) FILTER (WHERE proof_privacy."id" IS NOT NULL)::bigint
           AS "reconcilableRemaining"
       FROM "WorkerPaymentFlowSession" AS payment_session
       LEFT JOIN "WorkerPaymentDestination" AS raw_destination
         ON raw_destination."flowSubmissionReservationId"
           = payment_session."submissionReservationId"
       LEFT JOIN "WorkerPaymentDestination" AS proof_destination
         ON proof_destination."id" = raw_destination."id"
        AND proof_destination."organizationId" = payment_session."organizationId"
        AND proof_destination."personId" = payment_session."personId"
        AND proof_destination."purpose" = payment_session."paymentPurpose"
        AND proof_destination."type" = payment_session."expectedDestinationType"
        AND proof_destination."fingerprintKeyId"
          = payment_session."expectedDestinationFingerprintKeyId"
        AND proof_destination."fingerprint"
          = payment_session."expectedDestinationFingerprint"
        AND proof_destination."submissionSource" = 'WORKER_CHANNEL'
        AND proof_destination."submittedByMembershipId" IS NULL
        AND proof_destination."submittedByChannelIdentityId"
          = payment_session."channelIdentityId"
        AND proof_destination."submissionContractVersion" = 'ATTESTED_V1'
        AND proof_destination."operationKey"
          = payment_session."expectedDestinationOperationKey"
        AND proof_destination."flowSubmissionFingerprintKeyId"
          = payment_session."submissionFingerprintKeyId"
        AND proof_destination."flowSubmissionFingerprintHmac"
          = payment_session."submissionFingerprintHmac"
        AND proof_destination."submittedAt" >= payment_session."submissionReservedAt"
       LEFT JOIN "WorkerPrivacyChoiceEvent" AS proof_privacy
         ON proof_privacy."id" = proof_destination."privacyChoiceEventId"
        AND proof_privacy."organizationId" = payment_session."organizationId"
        AND proof_privacy."personId" = payment_session."personId"
        AND proof_privacy."paymentPurpose" = payment_session."paymentPurpose"
        AND proof_privacy."purpose" = 'PAYMENT_DESTINATION_CAPTURE'
        AND proof_privacy."channel" = 'WHATSAPP_FLOW'
        AND proof_privacy."action" = 'WORKER_ACKNOWLEDGED'
        AND proof_privacy."actorMembershipId" IS NULL
        AND proof_privacy."channelIdentityId" = payment_session."channelIdentityId"
        AND proof_privacy."noticeVersion" = payment_session."noticeVersion"
        AND proof_privacy."noticeContentSha256" = payment_session."noticeContentSha256"
        AND proof_privacy."presentedAt" = payment_session."privacyPresentedAt"
        AND proof_privacy."decidedAt" = proof_destination."submittedAt"
        AND proof_privacy."decidedAt" >= payment_session."submissionReservedAt"
        AND proof_privacy."operationKey" = payment_session."expectedPrivacyOperationKey"
       WHERE payment_session."submissionStatus" = 'UNCERTAIN'
         AND ($1::text IS NULL OR payment_session."organizationId" = $1::text)
         AND ($2::uuid IS NULL OR payment_session."flowSessionId" = $2::uuid)`,
      targetOrganizationId,
      targetFlowSessionId,
    );
    if (!Array.isArray(unresolvedRows) || unresolvedRows.length !== 1) {
      throw reconciliationError(
        'Worker-payment Flow reconciliation returned an invalid unresolved count.',
        'WORKER_PAYMENT_FLOW_RECONCILIATION_STATE_INVALID',
      );
    }
    const awaitingOutcome = safeCount(
      unresolvedRows[0]?.awaitingOutcome,
      'awaiting-outcome count',
    );
    const provenanceMismatches = safeCount(
      unresolvedRows[0]?.provenanceMismatches,
      'provenance-mismatch count',
    );
    const reconcilableRemaining = safeCount(
      unresolvedRows[0]?.reconcilableRemaining,
      'reconcilable-remaining count',
    );
    return {
      scanned: rows.length,
      reconciled,
      awaitingOutcome,
      provenanceMismatches,
      reconcilableRemaining,
      auditRows,
      hasMore: targetFlowSessionId ? false : reconcilableRemaining > 0,
      outcomes: Object.freeze(outcomes),
    };
  }, { maxWait: 3_000, timeout: 10_000 });
}

export async function reconcileUncertainWorkerPaymentFlowSubmission(
  prisma,
  { flowSessionId, organizationId } = {},
) {
  const result = await reconcileUncertainWorkerPaymentFlowSubmissions(prisma, {
    batchSize: 1,
    flowSessionId,
    organizationId,
  });
  return {
    ...result,
    outcome: result.outcomes[0] || null,
  };
}
