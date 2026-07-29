import { createHash } from 'node:crypto';

import {
  AI_SETTLEMENT_BASES,
  AiBudgetLedgerError,
  settleAiVisualBudget,
} from './daily-budget-ledger.js';
import { safeMicrosNumber } from './visual-progress-dispatch.js';

const CONTRACT_VERSION = 'ai-visual-cost-reconciliation:v1';
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,191}$/;
const ALLOWED_INPUT_KEYS = new Set([
  'organizationId',
  'projectId',
  'assessmentId',
  'settlementBasis',
  'actualCostMicros',
  'evidenceSha256',
]);

export const MANUAL_AI_SETTLEMENT_BASES = Object.freeze([
  AI_SETTLEMENT_BASES.PROVIDER_BILLING,
  AI_SETTLEMENT_BASES.CONFIRMED_NO_CHARGE,
]);

const MANUAL_BASIS_SET = new Set(MANUAL_AI_SETTLEMENT_BASES);

export class AiCostReconciliationError extends Error {
  constructor(message, {
    code = 'AI_COST_RECONCILIATION_INVALID',
    status = 400,
    cause = undefined,
  } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'AiCostReconciliationError';
    this.code = code;
    this.status = status;
  }
}

function reconciliationError(message, code, status, cause = undefined) {
  return new AiCostReconciliationError(message, { code, status, cause });
}

function requiredText(value, field, maxLength = 190) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > maxLength) {
    throw reconciliationError(
      `${field} is required.`,
      'AI_COST_RECONCILIATION_INPUT_INVALID',
      400,
    );
  }
  return normalized;
}

function requiredSha256(value, field) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!HASH_PATTERN.test(normalized)) {
    throw reconciliationError(
      `${field} must be a lowercase SHA-256 digest.`,
      'AI_COST_RECONCILIATION_INPUT_INVALID',
      400,
    );
  }
  return normalized;
}

function requiredIdempotencyKey(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!IDEMPOTENCY_KEY_PATTERN.test(normalized)) {
    throw reconciliationError(
      'A valid Idempotency-Key header is required.',
      'AI_COST_RECONCILIATION_IDEMPOTENCY_REQUIRED',
      400,
    );
  }
  return normalized;
}

function normalizedActualCost(value) {
  let candidate = value;
  if (typeof candidate === 'string' && /^(0|[1-9][0-9]*)$/.test(candidate)) {
    candidate = Number(candidate);
  }
  try {
    return safeMicrosNumber(candidate, 'actualCostMicros');
  } catch (cause) {
    throw reconciliationError(
      'actualCostMicros must be a non-negative safe integer.',
      'AI_COST_RECONCILIATION_INPUT_INVALID',
      400,
      cause,
    );
  }
}

function canonicalHash(domain, value) {
  return createHash('sha256')
    .update(CONTRACT_VERSION)
    .update('\0')
    .update(domain)
    .update('\0')
    .update(JSON.stringify(value))
    .digest('hex');
}

export function normalizeAiCostReconciliationRequest(body, { idempotencyKey } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw reconciliationError(
      'The reconciliation body must be a JSON object.',
      'AI_COST_RECONCILIATION_INPUT_INVALID',
      400,
    );
  }
  const unknownKeys = Object.keys(body).filter((key) => !ALLOWED_INPUT_KEYS.has(key));
  if (unknownKeys.length > 0) {
    throw reconciliationError(
      'The reconciliation body contains unsupported fields.',
      'AI_COST_RECONCILIATION_INPUT_INVALID',
      400,
    );
  }
  const settlementBasis = requiredText(body.settlementBasis, 'settlementBasis', 64);
  if (!MANUAL_BASIS_SET.has(settlementBasis)) {
    throw reconciliationError(
      'Only externally evidenced provider billing or confirmed no-charge settlements are allowed.',
      'AI_COST_RECONCILIATION_BASIS_FORBIDDEN',
      400,
    );
  }
  const actualCostMicros = normalizedActualCost(body.actualCostMicros);
  if (
    settlementBasis === AI_SETTLEMENT_BASES.CONFIRMED_NO_CHARGE
    && actualCostMicros !== 0
  ) {
    throw reconciliationError(
      'CONFIRMED_NO_CHARGE requires an exact zero cost.',
      'AI_COST_RECONCILIATION_COST_CONFLICT',
      400,
    );
  }
  const organizationId = requiredText(body.organizationId, 'organizationId');
  const projectId = requiredText(body.projectId, 'projectId');
  const assessmentId = requiredText(body.assessmentId, 'assessmentId');
  const evidenceSha256 = requiredSha256(body.evidenceSha256, 'evidenceSha256');
  const rawIdempotencyKey = requiredIdempotencyKey(idempotencyKey);
  const settlementOperationKeyHash = canonicalHash('operation', [
    organizationId,
    projectId,
    assessmentId,
    rawIdempotencyKey,
  ]);
  const requestFingerprint = canonicalHash('request', {
    organizationId,
    projectId,
    assessmentId,
    settlementBasis,
    actualCostMicros,
    evidenceSha256,
  });
  return {
    organizationId,
    projectId,
    assessmentId,
    settlementBasis,
    actualCostMicros,
    evidenceSha256,
    settlementOperationKeyHash,
    requestFingerprint,
  };
}

function terminalReservationMatches(reservation, input, actorId) {
  return reservation.status === 'SETTLED'
    && String(reservation.actualMicros) === String(input.actualCostMicros)
    && reservation.settlementBasis === input.settlementBasis
    && reservation.settlementOperationKeyHash === input.settlementOperationKeyHash
    && reservation.settlementEvidenceSha256 === input.evidenceSha256
    && reservation.settledById === actorId;
}

function safeResult(reservation, { replayed }) {
  return {
    assessmentId: reservation.assessmentId,
    status: reservation.status,
    settlementBasis: reservation.settlementBasis,
    actualCostMicros: String(reservation.actualMicros),
    replayed,
  };
}

function assertNormalizedInput(input) {
  const organizationId = requiredText(input?.organizationId, 'input.organizationId');
  const projectId = requiredText(input?.projectId, 'input.projectId');
  const assessmentId = requiredText(input?.assessmentId, 'input.assessmentId');
  const settlementBasis = requiredText(
    input?.settlementBasis,
    'input.settlementBasis',
    64,
  );
  if (!MANUAL_BASIS_SET.has(settlementBasis)) {
    throw reconciliationError(
      'Only externally evidenced provider billing or confirmed no-charge settlements are allowed.',
      'AI_COST_RECONCILIATION_BASIS_FORBIDDEN',
      400,
    );
  }
  const actualCostMicros = normalizedActualCost(input?.actualCostMicros);
  if (
    settlementBasis === AI_SETTLEMENT_BASES.CONFIRMED_NO_CHARGE
    && actualCostMicros !== 0
  ) {
    throw reconciliationError(
      'CONFIRMED_NO_CHARGE requires an exact zero cost.',
      'AI_COST_RECONCILIATION_COST_CONFLICT',
      400,
    );
  }
  return {
    organizationId,
    projectId,
    assessmentId,
    settlementBasis,
    actualCostMicros,
    evidenceSha256: requiredSha256(input?.evidenceSha256, 'input.evidenceSha256'),
    settlementOperationKeyHash: requiredSha256(
      input?.settlementOperationKeyHash,
      'input.settlementOperationKeyHash',
    ),
    requestFingerprint: requiredSha256(
      input?.requestFingerprint,
      'input.requestFingerprint',
    ),
  };
}

async function lockSettlementGraph(transaction, assessmentId) {
  // Match the database settlement function's lock order exactly: assessment
  // first, reservation second. Reversing this order could deadlock a manual
  // reconciliation against an automatic response-usage settlement.
  const assessments = await transaction.$queryRaw`
    SELECT "id", "actualCostMicros"
      FROM "public"."VisualProgressAssessment"
     WHERE "id" = ${assessmentId}::TEXT
     FOR UPDATE
  `;
  if (!Array.isArray(assessments) || assessments.length !== 1) {
    throw reconciliationError(
      'The visual assessment is no longer available for reconciliation.',
      'AI_COST_RECONCILIATION_NOT_FOUND',
      404,
    );
  }
  const reservations = await transaction.$queryRaw`
    SELECT "assessmentId"
      FROM "public"."AiDispatchBudgetReservation"
     WHERE "assessmentId" = ${assessmentId}::TEXT
     FOR UPDATE
  `;
  if (!Array.isArray(reservations) || reservations.length !== 1) {
    throw reconciliationError(
      'The assessment has no governed AI budget reservation.',
      'AI_COST_RECONCILIATION_NOT_FOUND',
      404,
    );
  }
  return assessments[0];
}

export async function reconcileAiVisualCost(prisma, {
  access,
  input,
  ipAddress = null,
  settleBudget = settleAiVisualBudget,
} = {}) {
  const actorId = requiredText(access?.databaseUserId, 'access.databaseUserId');
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw reconciliationError(
      'A normalized reconciliation request is required.',
      'AI_COST_RECONCILIATION_INPUT_INVALID',
      400,
    );
  }
  const normalizedInput = assertNormalizedInput(input);
  if (typeof prisma?.$transaction !== 'function' || typeof settleBudget !== 'function') {
    throw reconciliationError(
      'AI cost reconciliation is temporarily unavailable.',
      'AI_COST_RECONCILIATION_UNAVAILABLE',
      503,
    );
  }

  try {
    return await prisma.$transaction(async (transaction) => {
      const actor = await transaction.platformUser.findUnique({
        where: { id: actorId },
        select: { id: true, systemRole: true },
      });
      if (!actor || actor.systemRole !== 'SUPERADMIN') {
        throw reconciliationError(
          'Superadmin access is required.',
          'AI_COST_RECONCILIATION_SUPERADMIN_REQUIRED',
          403,
        );
      }
      const project = await transaction.project.findFirst({
        where: {
          id: normalizedInput.projectId,
          organizationId: normalizedInput.organizationId,
        },
        select: { id: true, organizationId: true },
      });
      if (!project) {
        throw reconciliationError(
          'The requested tenant project was not found.',
          'AI_COST_RECONCILIATION_NOT_FOUND',
          404,
        );
      }
      const assessment = await transaction.visualProgressAssessment.findFirst({
        where: {
          id: normalizedInput.assessmentId,
          projectId: normalizedInput.projectId,
        },
        select: {
          id: true,
          projectId: true,
          evidenceId: true,
          providerDispatchStartedAt: true,
        },
      });
      if (!assessment) {
        throw reconciliationError(
          'The visual assessment was not found in this project.',
          'AI_COST_RECONCILIATION_NOT_FOUND',
          404,
        );
      }
      if (!assessment.providerDispatchStartedAt) {
        throw reconciliationError(
          'A provider dispatch was not durably recorded for this assessment.',
          'AI_COST_RECONCILIATION_DISPATCH_NOT_STARTED',
          409,
        );
      }

      // This lock makes the terminal-read decision and its audit exactly once.
      // The SQL settlement function reuses the same row lock in this transaction.
      const lockedAssessment = await lockSettlementGraph(
        transaction,
        normalizedInput.assessmentId,
      );
      const reservation = await transaction.aiDispatchBudgetReservation.findUnique({
        where: { assessmentId: normalizedInput.assessmentId },
      });
      if (
        !reservation
        || reservation.organizationId !== normalizedInput.organizationId
        || reservation.projectId !== normalizedInput.projectId
      ) {
        throw reconciliationError(
          'The AI budget reservation does not match the tenant project.',
          'AI_COST_RECONCILIATION_SCOPE_CONFLICT',
          409,
        );
      }
      if (reservation.status !== 'RESERVED') {
        if (
          terminalReservationMatches(reservation, normalizedInput, actorId)
          && String(lockedAssessment.actualCostMicros)
            === String(normalizedInput.actualCostMicros)
        ) {
          return safeResult(reservation, { replayed: true });
        }
        throw reconciliationError(
          'The AI budget reservation already has a different terminal settlement.',
          'AI_COST_RECONCILIATION_TERMINAL_CONFLICT',
          409,
        );
      }

      const settled = await settleBudget(transaction, {
        assessmentId: normalizedInput.assessmentId,
        actualCostMicros: normalizedInput.actualCostMicros,
        settlementBasis: normalizedInput.settlementBasis,
        settlementOperationKeyHash: normalizedInput.settlementOperationKeyHash,
        settlementEvidenceSha256: normalizedInput.evidenceSha256,
        settledById: actorId,
      });
      await transaction.auditLog.create({
        data: {
          organizationId: normalizedInput.organizationId,
          actorId,
          action: 'progress.visual_assessment.cost_reconciled',
          entityType: 'VisualProgressAssessment',
          entityId: normalizedInput.assessmentId,
          ipAddress: typeof ipAddress === 'string' ? ipAddress.slice(0, 64) : null,
          metadata: {
            projectId: normalizedInput.projectId,
            evidenceId: assessment.evidenceId,
            settlementBasis: normalizedInput.settlementBasis,
            actualCostMicros: String(normalizedInput.actualCostMicros),
            settlementOperationKeyHash: normalizedInput.settlementOperationKeyHash,
            settlementEvidenceSha256: normalizedInput.evidenceSha256,
            requestFingerprint: normalizedInput.requestFingerprint,
          },
        },
      });
      return safeResult(settled, { replayed: false });
    });
  } catch (cause) {
    if (cause instanceof AiCostReconciliationError) throw cause;
    if (cause instanceof AiBudgetLedgerError) {
      throw reconciliationError(
        'The governed AI budget settlement was rejected.',
        cause.code,
        cause.status,
        cause,
      );
    }
    throw reconciliationError(
      'AI cost reconciliation could not be completed.',
      'AI_COST_RECONCILIATION_FAILED',
      503,
      cause,
    );
  }
}
