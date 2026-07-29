import { createHash } from 'node:crypto';

import {
  VISUAL_PROGRESS_SCHEMA_VERSION,
  validateVisualProgressAssessment,
} from './visual-progress-provider.js';
import { calculateDispatchCostMicros } from './dispatch-policy.js';
import {
  AI_SETTLEMENT_BASES,
  settleAiVisualBudget,
} from './daily-budget-ledger.js';
import { MODEL_REGISTRY } from './model-registry.js';

const RECEIPT_CONTRACT_VERSION = 'visual-progress-provider-result-receipt:v1';
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const MAX_STAGE_ATTEMPTS = 3;
const MAX_WORKER_BATCH = 100;

export const VISUAL_RESULT_SETTLEMENT_BASIS = AI_SETTLEMENT_BASES.RESPONSE_USAGE;

export class VisualResultReceiptError extends Error {
  constructor(message, {
    code = 'VISUAL_RESULT_RECEIPT_INVALID',
    status = 400,
    assessmentId = null,
    cause = undefined,
  } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'VisualResultReceiptError';
    this.code = code;
    this.status = status;
    this.assessmentId = assessmentId;
  }
}

function receiptError(message, code, status, assessmentId = null, cause = undefined) {
  return new VisualResultReceiptError(message, {
    code,
    status,
    assessmentId,
    cause,
  });
}

function requiredText(value, field, maxLength = 190) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > maxLength) {
    throw receiptError(
      `${field} is invalid for a visual result receipt.`,
      'VISUAL_RESULT_RECEIPT_INPUT_INVALID',
      400,
    );
  }
  return normalized;
}

function optionalText(value, maxLength = 190) {
  if (value == null) return null;
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized && normalized.length <= maxLength ? normalized : null;
}

function requiredHash(value, field) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!HASH_PATTERN.test(normalized)) {
    throw receiptError(
      `${field} is invalid for a visual result receipt.`,
      'VISUAL_RESULT_RECEIPT_INPUT_INVALID',
      400,
    );
  }
  return normalized;
}

function validDate(value, field) {
  const candidate = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(candidate.getTime())) {
    throw receiptError(
      `${field} is invalid for a visual result receipt.`,
      'VISUAL_RESULT_RECEIPT_INPUT_INVALID',
      400,
    );
  }
  return candidate;
}

function positiveInteger(value, field) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw receiptError(
      `${field} is invalid for a visual result receipt.`,
      'VISUAL_RESULT_RECEIPT_CONTENT_INVALID',
      502,
    );
  }
  return value;
}

function confidenceNumber(value) {
  const normalized = Number(value?.toString?.() ?? value);
  if (!Number.isFinite(normalized) || normalized < 0 || normalized > 1) {
    throw receiptError(
      'Provider confidence is invalid.',
      'VISUAL_RESULT_RECEIPT_CONTENT_INVALID',
      502,
    );
  }
  // Receipt and assessment columns are NUMERIC(5,4). Canonicalize before
  // hashing so a database round-trip cannot change the digest input.
  return Math.floor((normalized * 10_000) + 0.5) / 10_000;
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalValue(value[key])]),
    );
  }
  return value;
}

function hash(domain, value) {
  return createHash('sha256')
    .update(RECEIPT_CONTRACT_VERSION)
    .update('\0')
    .update(domain)
    .update('\0')
    .update(JSON.stringify(canonicalValue(value)))
    .digest('hex');
}

function normalizeUsage(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const fields = [
    'inputTokens',
    'outputTokens',
    'totalTokens',
    'cachedInputTokens',
    'cacheWriteTokens',
  ];
  const normalized = Object.fromEntries(fields.map((field) => [field, value[field]]));
  if (fields.some((field) => !Number.isSafeInteger(normalized[field]) || normalized[field] < 0)) {
    return null;
  }
  if (
    normalized.totalTokens !== normalized.inputTokens + normalized.outputTokens
    || normalized.cachedInputTokens > normalized.inputTokens
    || normalized.cacheWriteTokens !== 0
  ) {
    return null;
  }
  return normalized;
}

function normalizeAssessmentResult(value, assessmentId) {
  try {
    validateVisualProgressAssessment(value);
  } catch (cause) {
    throw receiptError(
      'The provider result does not satisfy the visual assessment contract.',
      'VISUAL_RESULT_RECEIPT_CONTENT_INVALID',
      502,
      assessmentId,
      cause,
    );
  }
  return {
    schemaVersion: value.schemaVersion,
    abstained: value.abstained,
    abstentionReason: value.abstentionReason,
    summary: value.summary.trim(),
    elementType: value.elementType?.trim() || null,
    progressMin: value.progressMin,
    progressMax: value.progressMax,
    confidence: confidenceNumber(value.confidence),
    quality: canonicalValue(value.quality),
    observations: value.facts.map((fact) => fact.trim()),
    limitations: value.limitations.map((limitation) => limitation.trim()),
  };
}

function normalizeStoredReceipt(receipt) {
  return {
    schemaVersion: receipt.schemaVersion,
    providerRequestId: optionalText(receipt.providerRequestId),
    providerResponseId: optionalText(receipt.providerResponseId),
    inputSha256: requiredHash(receipt.inputSha256, 'receipt.inputSha256'),
    submittedSha256: requiredHash(receipt.submittedSha256, 'receipt.submittedSha256'),
    width: positiveInteger(receipt.width, 'receipt.width'),
    height: positiveInteger(receipt.height, 'receipt.height'),
    abstained: receipt.abstained,
    abstentionReason: receipt.abstentionReason ?? null,
    summary: requiredText(receipt.summary, 'receipt.summary', 700),
    elementType: optionalText(receipt.elementType, 120),
    progressMin: receipt.progressMin ?? null,
    progressMax: receipt.progressMax ?? null,
    confidence: confidenceNumber(receipt.confidence),
    quality: canonicalValue(receipt.quality),
    observations: Array.isArray(receipt.observations)
      ? receipt.observations.map((item) => requiredText(item, 'receipt.observations', 300))
      : [],
    limitations: Array.isArray(receipt.limitations)
      ? receipt.limitations.map((item) => requiredText(item, 'receipt.limitations', 300))
      : [],
    usage: normalizeUsage(receipt),
  };
}

function normalizeProviderResult(result, assessment) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw receiptError(
      'The provider returned no stageable visual result.',
      'VISUAL_RESULT_RECEIPT_CONTENT_INVALID',
      502,
      assessment.id,
    );
  }
  if (
    result.provider !== assessment.provider
    || result.model !== assessment.providerModel
    || result.registryModelId !== assessment.registryModelId
  ) {
    throw receiptError(
      'The provider result route does not match the authorized assessment route.',
      'VISUAL_RESULT_RECEIPT_ROUTE_MISMATCH',
      502,
      assessment.id,
    );
  }
  if (result.input?.inputSha256 !== assessment.inputSha256) {
    throw receiptError(
      'The provider result input does not match the assessment evidence.',
      'VISUAL_RESULT_RECEIPT_INPUT_MISMATCH',
      422,
      assessment.id,
    );
  }
  const output = normalizeAssessmentResult(result.assessment, assessment.id);
  return {
    ...output,
    providerRequestId: optionalText(result.requestId),
    providerResponseId: optionalText(result.responseId),
    inputSha256: requiredHash(result.input.inputSha256, 'result.input.inputSha256'),
    submittedSha256: requiredHash(
      result.input.submittedSha256,
      'result.input.submittedSha256',
    ),
    width: positiveInteger(result.input.width, 'result.input.width'),
    height: positiveInteger(result.input.height, 'result.input.height'),
    usage: normalizeUsage(result.usage),
  };
}

function routeIdentity(assessment) {
  return {
    provider: requiredText(assessment.provider, 'assessment.provider', 64),
    model: requiredText(assessment.providerModel, 'assessment.providerModel', 120),
    registryModelId: requiredText(
      assessment.registryModelId,
      'assessment.registryModelId',
      190,
    ),
    providerRoute: requiredText(assessment.providerRoute, 'assessment.providerRoute', 120),
    routePolicyVersion: requiredText(
      assessment.routePolicyVersion,
      'assessment.routePolicyVersion',
      64,
    ),
    pricingVersion: requiredText(assessment.pricingVersion, 'assessment.pricingVersion', 64),
    analyzerVersion: requiredText(assessment.analyzerVersion, 'assessment.analyzerVersion', 64),
  };
}

function receiptHashPayload(assessment, normalized) {
  return {
    scope: {
      projectId: requiredText(assessment.projectId, 'assessment.projectId'),
      assessmentId: requiredText(assessment.id, 'assessment.id'),
    },
    requestFingerprint: requiredHash(
      assessment.requestFingerprint,
      'assessment.requestFingerprint',
    ),
    route: routeIdentity(assessment),
    input: {
      inputSha256: normalized.inputSha256,
      submittedSha256: normalized.submittedSha256,
      width: normalized.width,
      height: normalized.height,
    },
    result: {
      schemaVersion: normalized.schemaVersion,
      abstained: normalized.abstained,
      abstentionReason: normalized.abstentionReason,
      summary: normalized.summary,
      elementType: normalized.elementType,
      progressMin: normalized.progressMin,
      progressMax: normalized.progressMax,
      confidence: normalized.confidence,
      quality: normalized.quality,
      observations: normalized.observations,
      limitations: normalized.limitations,
    },
    providerCorrelation: {
      requestId: normalized.providerRequestId,
      responseId: normalized.providerResponseId,
    },
    usage: normalized.usage,
  };
}

export function visualResultReceiptSha256(assessment, normalizedReceipt) {
  return hash('receipt', receiptHashPayload(assessment, normalizedReceipt));
}

export function visualResultSettlementOperationKeyHash({ assessmentId, receiptSha256 }) {
  return hash('settlement:response-usage', {
    assessmentId: requiredText(assessmentId, 'assessmentId'),
    receiptSha256: requiredHash(receiptSha256, 'receiptSha256'),
    basis: VISUAL_RESULT_SETTLEMENT_BASIS,
  });
}

async function loadScopedAssessment(prisma, { organizationId, projectId, assessmentId }) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId },
    select: { id: true, organizationId: true },
  });
  if (!project) {
    throw receiptError(
      'The visual assessment is not available in this organization.',
      'VISUAL_RESULT_RECEIPT_NOT_FOUND',
      404,
      assessmentId,
    );
  }
  const assessment = await prisma.visualProgressAssessment.findFirst({
    where: { id: assessmentId, projectId },
  });
  if (!assessment) {
    throw receiptError(
      'The visual assessment was not found.',
      'VISUAL_RESULT_RECEIPT_NOT_FOUND',
      404,
      assessmentId,
    );
  }
  return assessment;
}

function assertStageableAssessment(assessment) {
  routeIdentity(assessment);
  requiredHash(assessment.requestFingerprint, 'assessment.requestFingerprint');
  requiredHash(assessment.inputSha256, 'assessment.inputSha256');
  if (!assessment.providerDispatchStartedAt || assessment.actualCostMicros != null) {
    throw receiptError(
      'The assessment no longer accepts a provider result receipt.',
      'VISUAL_RESULT_RECEIPT_ASSESSMENT_CONFLICT',
      409,
      assessment.id,
    );
  }
}

function receiptCreateData({ organizationId, projectId, assessment, normalized, receivedAt }) {
  const receiptSha256 = visualResultReceiptSha256(assessment, normalized);
  return {
    assessmentId: assessment.id,
    organizationId,
    projectId,
    schemaVersion: normalized.schemaVersion,
    receiptSha256,
    providerRequestId: normalized.providerRequestId,
    providerResponseId: normalized.providerResponseId,
    inputSha256: normalized.inputSha256,
    submittedSha256: normalized.submittedSha256,
    width: normalized.width,
    height: normalized.height,
    abstained: normalized.abstained,
    abstentionReason: normalized.abstentionReason,
    summary: normalized.summary,
    elementType: normalized.elementType,
    progressMin: normalized.progressMin,
    progressMax: normalized.progressMax,
    confidence: normalized.confidence,
    quality: normalized.quality,
    observations: normalized.observations,
    limitations: normalized.limitations,
    inputTokens: normalized.usage?.inputTokens ?? null,
    outputTokens: normalized.usage?.outputTokens ?? null,
    totalTokens: normalized.usage?.totalTokens ?? null,
    cachedInputTokens: normalized.usage?.cachedInputTokens ?? null,
    cacheWriteTokens: normalized.usage?.cacheWriteTokens ?? null,
    receivedAt,
  };
}

function assertIdempotentReceipt(existing, expected) {
  if (
    existing.organizationId !== expected.organizationId
    || existing.projectId !== expected.projectId
    || existing.assessmentId !== expected.assessmentId
    || existing.receiptSha256 !== expected.receiptSha256
  ) {
    throw receiptError(
      'A different provider result is already staged for this assessment.',
      'VISUAL_RESULT_RECEIPT_HASH_CONFLICT',
      409,
      expected.assessmentId,
    );
  }
  return existing;
}

async function readReceipt(prisma, assessmentId) {
  return prisma.visualProgressProviderResultReceipt.findUnique({
    where: { assessmentId },
  });
}

function retryableStageFailure(cause) {
  return cause?.code == null || ['P1001', 'P1002', 'P2028', 'P2034'].includes(cause.code);
}

export async function stageVisualProgressProviderResultReceipt(prisma, {
  organizationId: rawOrganizationId,
  projectId: rawProjectId,
  assessmentId: rawAssessmentId,
  providerResult,
  receivedAt = new Date(),
  maxAttempts = MAX_STAGE_ATTEMPTS,
} = {}) {
  const organizationId = requiredText(rawOrganizationId, 'organizationId');
  const projectId = requiredText(rawProjectId, 'projectId');
  const assessmentId = requiredText(rawAssessmentId, 'assessmentId');
  const requestedReceivedAt = validDate(receivedAt, 'receivedAt');
  const attempts = Math.min(Math.max(Number(maxAttempts) || MAX_STAGE_ATTEMPTS, 1), 5);
  const assessment = await loadScopedAssessment(prisma, {
    organizationId,
    projectId,
    assessmentId,
  });
  const stagedAt = notBefore(requestedReceivedAt, assessment.providerDispatchStartedAt);
  const normalized = normalizeProviderResult(providerResult, assessment);
  const data = receiptCreateData({
    organizationId,
    projectId,
    assessment,
    normalized,
    receivedAt: stagedAt,
  });
  const preexisting = await readReceipt(prisma, assessmentId);
  if (preexisting) {
    return { receipt: assertIdempotentReceipt(preexisting, data), replayed: true };
  }
  assertStageableAssessment(assessment);

  let lastCause;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const staged = await prisma.$transaction(async (transaction) => {
        const existing = await readReceipt(transaction, assessmentId);
        if (existing) return { receipt: assertIdempotentReceipt(existing, data), replayed: true };
        const receipt = await transaction.visualProgressProviderResultReceipt.create({ data });
        return { receipt, replayed: false };
      });
      return staged;
    } catch (cause) {
      if (cause instanceof VisualResultReceiptError) throw cause;
      lastCause = cause;
      // A failed commit can be ambiguous. Resolve it before deciding whether a
      // retry is safe; no provider request is ever repeated by this function.
      try {
        const existing = await readReceipt(prisma, assessmentId);
        if (existing) {
          return { receipt: assertIdempotentReceipt(existing, data), replayed: true };
        }
      } catch (readCause) {
        if (readCause instanceof VisualResultReceiptError) throw readCause;
        lastCause = readCause;
      }
      if (cause?.code !== 'P2002' && !retryableStageFailure(cause)) break;
    }
  }
  throw receiptError(
    'The provider result could not be durably staged.',
    'VISUAL_RESULT_RECEIPT_STAGE_FAILED',
    503,
    assessmentId,
    lastCause,
  );
}

function dispatchPlanFromAssessment(assessment) {
  const registered = MODEL_REGISTRY[assessment.registryModelId];
  if (
    !registered
    || registered.provider !== assessment.provider
    || registered.model !== assessment.providerModel
    || registered.adapterId !== assessment.providerRoute
  ) {
    throw receiptError(
      'The staged result route is no longer a registered immutable route.',
      'VISUAL_RESULT_RECEIPT_ROUTE_MISMATCH',
      409,
      assessment.id,
    );
  }
  return {
    routePolicyVersion: assessment.routePolicyVersion,
    pricingVersion: assessment.pricingVersion,
    selected: {
      registryModelId: registered.id,
      provider: registered.provider,
      model: registered.model,
      adapterId: registered.adapterId,
      rolloutRole: registered.rolloutRole,
    },
  };
}

function assertReceiptIntegrity(assessment, receipt) {
  if (
    receipt.organizationId !== assessment.project?.organizationId
    || receipt.projectId !== assessment.projectId
    || receipt.assessmentId !== assessment.id
    || receipt.schemaVersion !== VISUAL_PROGRESS_SCHEMA_VERSION
    || receipt.inputSha256 !== assessment.inputSha256
  ) {
    throw receiptError(
      'The staged provider result does not match its assessment.',
      'VISUAL_RESULT_RECEIPT_INTEGRITY_FAILED',
      409,
      assessment.id,
    );
  }
  const normalized = normalizeStoredReceipt(receipt);
  const expectedHash = visualResultReceiptSha256(assessment, normalized);
  if (receipt.receiptSha256 !== expectedHash) {
    throw receiptError(
      'The staged provider result failed its canonical integrity check.',
      'VISUAL_RESULT_RECEIPT_INTEGRITY_FAILED',
      409,
      assessment.id,
    );
  }
  return normalized;
}

function receiptAssessmentData(normalized, completedAt) {
  return {
    status: normalized.abstained ? 'ABSTAINED' : 'COMPLETED',
    summary: normalized.summary,
    elementType: normalized.elementType,
    progressMin: normalized.abstained ? null : normalized.progressMin,
    progressMax: normalized.abstained ? null : normalized.progressMax,
    confidence: normalized.confidence,
    quality: normalized.quality,
    observations: normalized.observations,
    limitations: normalized.limitations,
    providerResponseId: normalized.providerResponseId,
    providerRequestId: normalized.providerRequestId,
    inputTokens: normalized.usage?.inputTokens ?? null,
    outputTokens: normalized.usage?.outputTokens ?? null,
    totalTokens: normalized.usage?.totalTokens ?? null,
    cachedInputTokens: normalized.usage?.cachedInputTokens ?? null,
    completedAt,
    leaseExpiresAt: null,
    failureCode: null,
    reviewStatus: 'PENDING',
    revision: { increment: 1 },
  };
}

function notBefore(value, floor) {
  const candidate = validDate(value, 'now');
  const minimum = validDate(floor, 'assessment.createdAt');
  return candidate.getTime() >= minimum.getTime() ? candidate : minimum;
}

async function readAppliedResult(prisma, { organizationId, projectId, assessmentId }) {
  const receipt = await readReceipt(prisma, assessmentId);
  if (!receipt?.appliedAt) return null;
  if (receipt.organizationId !== organizationId || receipt.projectId !== projectId) return null;
  const assessment = await prisma.visualProgressAssessment.findFirst({
    where: { id: assessmentId, projectId },
  });
  return assessment ? {
    assessment,
    receipt,
    replayed: true,
    costPending: receipt.inputTokens == null,
  } : null;
}

export async function applyVisualProgressProviderResultReceipt(prisma, {
  organizationId: rawOrganizationId,
  projectId: rawProjectId,
  assessmentId: rawAssessmentId,
  now = new Date(),
  settleBudget = settleAiVisualBudget,
} = {}) {
  const organizationId = requiredText(rawOrganizationId, 'organizationId');
  const projectId = requiredText(rawProjectId, 'projectId');
  const assessmentId = requiredText(rawAssessmentId, 'assessmentId');
  const appliedAt = validDate(now, 'now');
  if (typeof settleBudget !== 'function') {
    throw receiptError(
      'The receipt settlement dependency is unavailable.',
      'VISUAL_RESULT_RECEIPT_INPUT_INVALID',
      400,
      assessmentId,
    );
  }

  try {
    return await prisma.$transaction(async (transaction) => {
      const assessment = await transaction.visualProgressAssessment.findFirst({
        where: { id: assessmentId, projectId },
        include: { project: { select: { organizationId: true } } },
      });
      const receipt = await readReceipt(transaction, assessmentId);
      if (!assessment || assessment.project?.organizationId !== organizationId || !receipt) {
        throw receiptError(
          'The staged provider result was not found in this organization.',
          'VISUAL_RESULT_RECEIPT_NOT_FOUND',
          404,
          assessmentId,
        );
      }
      const normalized = assertReceiptIntegrity(assessment, receipt);
      if (receipt.appliedAt) {
        return {
          assessment,
          receipt,
          replayed: true,
          costPending: receipt.inputTokens == null,
        };
      }
      if (!assessment.providerDispatchStartedAt || assessment.actualCostMicros != null) {
        throw receiptError(
          'The assessment no longer accepts this staged result.',
          'VISUAL_RESULT_RECEIPT_ASSESSMENT_CONFLICT',
          409,
          assessmentId,
        );
      }
      // A worker clock can move backwards after the provider result was
      // received. The receipt lifecycle requires APPLIED to be no earlier than
      // its durable receivedAt boundary; using the same timestamp for the VPA
      // projection also satisfies the projection trigger atomically.
      const completedAt = notBefore(appliedAt, receipt.receivedAt);
      const updated = await transaction.visualProgressAssessment.updateMany({
        where: {
          id: assessmentId,
          projectId,
          revision: assessment.revision,
          actualCostMicros: null,
          providerDispatchStartedAt: { not: null },
          OR: [
            { status: 'RUNNING' },
            { status: 'FAILED' },
          ],
        },
        data: receiptAssessmentData(normalized, completedAt),
      });
      if (updated.count !== 1) {
        throw receiptError(
          'The assessment changed while its staged result was being applied.',
          'VISUAL_RESULT_RECEIPT_ASSESSMENT_CONFLICT',
          409,
          assessmentId,
        );
      }

      let actualCostMicros = null;
      let budgetDisposition = 'retained_usage_missing';
      if (normalized.usage) {
        actualCostMicros = calculateDispatchCostMicros(
          dispatchPlanFromAssessment(assessment),
          normalized.usage,
        );
        await settleBudget(transaction, {
          assessmentId,
          actualCostMicros,
          settlementBasis: VISUAL_RESULT_SETTLEMENT_BASIS,
          settlementOperationKeyHash: visualResultSettlementOperationKeyHash({
            assessmentId,
            receiptSha256: receipt.receiptSha256,
          }),
          settlementEvidenceSha256: receipt.receiptSha256,
          settledById: null,
        });
        budgetDisposition = 'settled_from_response_usage';
      }

      // The receipt write-once trigger requires the projected assessment and
      // any usage settlement to be aligned before the terminal APPLIED flip.
      // All three mutations share this transaction, so any later failure rolls
      // the projection and settlement back with the receipt.
      const claimed = await transaction.visualProgressProviderResultReceipt.updateMany({
        where: {
          assessmentId,
          projectId,
          organizationId,
          appliedAt: null,
          revision: receipt.revision,
        },
        data: {
          appliedAt: completedAt,
          revision: { increment: 1 },
        },
      });
      if (claimed.count !== 1) {
        throw receiptError(
          'Another worker is applying this provider result.',
          'VISUAL_RESULT_RECEIPT_APPLY_CONFLICT',
          409,
          assessmentId,
        );
      }

      await transaction.auditLog.create({
        data: {
          organizationId,
          actorId: null,
          action: normalized.abstained
            ? 'progress.visual_assessment.abstained'
            : 'progress.visual_assessment.completed',
          entityType: 'VisualProgressAssessment',
          entityId: assessmentId,
          metadata: {
            projectId,
            evidenceId: assessment.evidenceId,
            taskId: assessment.taskId,
            provider: assessment.provider,
            model: assessment.providerModel,
            registryModelId: assessment.registryModelId,
            providerRoute: assessment.providerRoute,
            routePolicyVersion: assessment.routePolicyVersion,
            pricingVersion: assessment.pricingVersion,
            schemaVersion: normalized.schemaVersion,
            abstained: normalized.abstained,
            abstentionReason: normalized.abstentionReason,
            providerResponseId: normalized.providerResponseId,
            providerRequestId: normalized.providerRequestId,
            usage: normalized.usage,
            estimatedCostMicros: String(assessment.estimatedCostMicros),
            actualCostMicros: actualCostMicros == null ? null : String(actualCostMicros),
            budgetDisposition,
            resultReceiptSha256: receipt.receiptSha256,
          },
        },
      });
      const projected = await transaction.visualProgressAssessment.findFirst({
        where: { id: assessmentId, projectId },
      });
      const applied = await readReceipt(transaction, assessmentId);
      return {
        assessment: projected,
        receipt: applied,
        replayed: false,
        costPending: normalized.usage == null,
      };
    });
  } catch (cause) {
    // Resolve an ambiguous commit. If it committed, the receipt and projection
    // are already durable; otherwise the pending receipt remains replayable.
    try {
      const applied = await readAppliedResult(prisma, {
        organizationId,
        projectId,
        assessmentId,
      });
      if (applied) return applied;
    } catch {
      // Preserve the original actionable failure.
    }
    if (cause instanceof VisualResultReceiptError) throw cause;
    throw receiptError(
      'The staged provider result could not be applied yet.',
      'VISUAL_RESULT_RECEIPT_APPLY_FAILED',
      503,
      assessmentId,
      cause,
    );
  }
}

export async function applyPendingVisualProgressProviderResultReceipts(prisma, {
  organizationId: rawOrganizationId = null,
  projectId: rawProjectId = null,
  limit = 25,
  now = new Date(),
  settleBudget = settleAiVisualBudget,
} = {}) {
  const organizationId = rawOrganizationId
    ? requiredText(rawOrganizationId, 'organizationId')
    : null;
  const projectId = rawProjectId ? requiredText(rawProjectId, 'projectId') : null;
  const take = Math.min(Math.max(Number(limit) || 25, 1), MAX_WORKER_BATCH);
  const candidates = await prisma.visualProgressProviderResultReceipt.findMany({
    where: {
      appliedAt: null,
      ...(organizationId ? { organizationId } : {}),
      ...(projectId ? { projectId } : {}),
    },
    orderBy: [{ receivedAt: 'asc' }, { assessmentId: 'asc' }],
    take,
  });
  const appliedIds = [];
  const pending = [];
  for (const receipt of candidates) {
    try {
      await applyVisualProgressProviderResultReceipt(prisma, {
        organizationId: receipt.organizationId,
        projectId: receipt.projectId,
        assessmentId: receipt.assessmentId,
        now,
        settleBudget,
      });
      appliedIds.push(receipt.assessmentId);
    } catch (cause) {
      pending.push({
        assessmentId: receipt.assessmentId,
        code: cause instanceof VisualResultReceiptError
          ? cause.code
          : 'VISUAL_RESULT_RECEIPT_APPLY_FAILED',
      });
    }
  }
  return { examined: candidates.length, appliedIds, pending };
}
