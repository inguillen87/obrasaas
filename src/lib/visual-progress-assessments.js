import { createHash } from 'node:crypto';

import {
  VisualProgressProviderError,
  VISUAL_PROGRESS_SCHEMA_VERSION,
  analyzeVisualProgress,
} from './ai/visual-progress-provider.js';
import { tenantAiSettingsFromMetadata } from './ai/tenant-settings.js';
import {
  MODEL_ROLLOUT_ROLES,
  resolvePrimaryVisualProgressModel,
} from './ai/model-registry.js';
import { SOURCE_EVIDENCE_PERMISSION } from './medical-privacy.js';
import { subscriptionAllowsWrites } from './plans.js';
import { tenantRoleHasPortfolioAccess } from './project-access.js';
import {
  isDashboardProgressMediaForProject,
  isWhatsAppProgressMediaForProject,
  protectedStorageLookup,
} from './private-receipts.js';
import { runOperationalProjectMutation } from './project-write-policy.js';
import { readProtectedFile } from './storage.js';
import { roleHasPermission } from './tenant-roles.js';

const CONTRACT_VERSION = 'visual-progress-assessment:v1';
const ANALYZER_VERSION = `visual-progress-v${VISUAL_PROGRESS_SCHEMA_VERSION}`;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,189}$/;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const REVIEW_STATUSES = new Set(['APPROVED', 'CORRECTED', 'REJECTED']);
export const VISUAL_PROGRESS_LEASE_MS = 2 * 60 * 1000;
export const VISUAL_PROGRESS_LEASE_EXPIRED_CODE = 'VISUAL_PROGRESS_LEASE_EXPIRED';
const MAX_RECOVERY_BATCH = 200;

export class VisualProgressAssessmentError extends Error {
  constructor(message, {
    code = 'VISUAL_PROGRESS_ASSESSMENT_INVALID',
    status = 400,
    assessmentId = null,
  } = {}) {
    super(message);
    this.name = 'VisualProgressAssessmentError';
    this.code = code;
    this.status = status;
    this.assessmentId = assessmentId;
  }
}

function error(message, code, status = 400, assessmentId = null) {
  return new VisualProgressAssessmentError(message, {
    code,
    status,
    assessmentId,
  });
}

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function requiredText(value, field, maxLength = 190) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > maxLength) {
    throw error(`${field} no es válido.`, 'VISUAL_PROGRESS_INPUT_INVALID');
  }
  return normalized;
}

function trustedScope(value) {
  return {
    organizationId: requiredText(value?.organizationId, 'organizationId'),
    projectId: requiredText(value?.projectId, 'projectId'),
  };
}

function idempotencyKey(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!IDEMPOTENCY_KEY_PATTERN.test(normalized)) {
    throw error(
      'La operación requiere una clave de idempotencia válida.',
      'IDEMPOTENCY_KEY_INVALID',
    );
  }
  return normalized;
}

function hash(domain, value) {
  return createHash('sha256')
    .update(`${CONTRACT_VERSION}:${domain}`)
    .update('\0')
    .update(JSON.stringify(value))
    .digest('hex');
}

function iso(value) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function decimalNumber(value) {
  if (value == null) return null;
  const number = Number(value?.toString?.() ?? value);
  return Number.isFinite(number) ? number : null;
}

function notBefore(value, floor) {
  const candidate = value instanceof Date ? value : new Date(value);
  const minimum = floor instanceof Date ? floor : new Date(floor);
  if (Number.isNaN(candidate.getTime())) return minimum;
  if (Number.isNaN(minimum.getTime())) return candidate;
  return candidate.getTime() >= minimum.getTime() ? candidate : minimum;
}

function validDate(value, field = 'now') {
  const candidate = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(candidate.getTime())) {
    throw error(`${field} no es válido.`, 'VISUAL_PROGRESS_INPUT_INVALID');
  }
  return candidate;
}

function leaseDeadline(now) {
  return new Date(validDate(now).getTime() + VISUAL_PROGRESS_LEASE_MS);
}

function activeLeaseWhere(context, now) {
  const checkedAt = validDate(now);
  return {
    id: context.assessmentId,
    projectId: context.scope.projectId,
    status: 'RUNNING',
    revision: context.revision,
    attemptCount: context.attemptCount,
    leaseExpiresAt: {
      equals: validDate(context.leaseExpiresAt, 'leaseExpiresAt'),
      gt: checkedAt,
    },
  };
}

async function renewVisualProgressLease(prisma, context, now) {
  const renewedAt = validDate(now);
  const nextLeaseExpiresAt = leaseDeadline(renewedAt);
  const renewed = await prisma.visualProgressAssessment.updateMany({
    where: activeLeaseWhere(context, renewedAt),
    data: {
      leaseExpiresAt: nextLeaseExpiresAt,
      revision: { increment: 1 },
    },
  });
  if (renewed.count !== 1) {
    throw error(
      'La evaluación perdió su lease antes de contactar al proveedor.',
      'VISUAL_PROGRESS_LEASE_LOST',
      409,
      context.assessmentId,
    );
  }
  return {
    ...context,
    revision: context.revision + 1,
    leaseExpiresAt: nextLeaseExpiresAt,
  };
}

export function serializeVisualProgressAssessment(row) {
  return {
    id: row.id,
    projectId: row.projectId,
    taskId: row.taskId,
    evidenceId: row.evidenceId,
    provider: row.provider,
    model: row.providerModel,
    analyzerVersion: row.analyzerVersion,
    baselineHash: row.baselineHash,
    taskRevisionAtRequest: row.taskRevisionAtRequest,
    evidenceRevisionAtRequest: row.evidenceRevisionAtRequest,
    status: row.status,
    summary: row.summary || null,
    elementType: row.elementType || null,
    progressMin: row.progressMin ?? null,
    progressMax: row.progressMax ?? null,
    confidence: decimalNumber(row.confidence),
    quality: record(row.quality),
    observations: Array.isArray(row.observations) ? row.observations : [],
    limitations: Array.isArray(row.limitations) ? row.limitations : [],
    failureCode: row.failureCode || null,
    reviewStatus: row.reviewStatus || null,
    reviewNote: row.reviewNote || null,
    correctedProgressMin: row.correctedProgressMin ?? null,
    correctedProgressMax: row.correctedProgressMax ?? null,
    revision: row.revision,
    completedAt: iso(row.completedAt),
    reviewedAt: iso(row.reviewedAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

// Public/dashboard DTO. Provider identities, hashes and internal failure details
// remain available to audit/service code, but never cross the tenant API boundary.
export function serializePublicVisualProgressAssessment(row) {
  const assessment = serializeVisualProgressAssessment(row);
  return {
    id: assessment.id,
    evidenceId: assessment.evidenceId,
    status: assessment.status,
    summary: assessment.summary,
    elementType: assessment.elementType,
    progressMin: assessment.progressMin,
    progressMax: assessment.progressMax,
    confidence: assessment.confidence,
    quality: assessment.quality,
    observations: assessment.observations,
    limitations: assessment.limitations,
    reviewStatus: assessment.reviewStatus,
    reviewNote: assessment.reviewNote,
    correctedProgressMin: assessment.correctedProgressMin,
    correctedProgressMax: assessment.correctedProgressMax,
    revision: assessment.revision,
    completedAt: assessment.completedAt,
    reviewedAt: assessment.reviewedAt,
    createdAt: assessment.createdAt,
    updatedAt: assessment.updatedAt,
  };
}

async function findOpenVisualAssessment(prisma, { projectId, evidenceId }) {
  const active = await prisma.visualProgressAssessment.findFirst({
    where: {
      projectId,
      evidenceId,
      status: { in: ['PENDING', 'RUNNING'] },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  if (active) return active;
  return prisma.visualProgressAssessment.findFirst({
    where: {
      projectId,
      evidenceId,
      status: { in: ['COMPLETED', 'ABSTAINED'] },
      reviewStatus: 'PENDING',
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
}

function normalizedPlanTask(task) {
  return {
    id: task.id,
    externalId: task.externalId || null,
    code: task.code || null,
    title: task.title,
    type: task.type,
    status: task.status,
    progress: task.progress,
    startsAt: iso(task.startsAt),
    endsAt: iso(task.endsAt),
    parentId: task.parentId || null,
    revision: task.revision,
    predecessors: (Array.isArray(task.predecessors) ? task.predecessors : [])
      .map((dependency) => ({
        predecessorId: dependency.predecessorId,
        type: dependency.type,
        lagDays: dependency.lagDays,
      }))
      .sort((left, right) => (
        left.predecessorId.localeCompare(right.predecessorId)
        || left.type.localeCompare(right.type)
        || left.lagDays - right.lagDays
      )),
  };
}

export function canonicalPlanHash(tasks) {
  const canonical = (Array.isArray(tasks) ? tasks : [])
    .map(normalizedPlanTask)
    .sort((left, right) => left.id.localeCompare(right.id));
  return hash('canonical-plan', canonical);
}

const PLAN_SELECT = {
  id: true,
  externalId: true,
  code: true,
  title: true,
  type: true,
  status: true,
  progress: true,
  startsAt: true,
  endsAt: true,
  parentId: true,
  revision: true,
  predecessors: {
    select: {
      predecessorId: true,
      type: true,
      lagDays: true,
    },
  },
};

function taskProviderContext(task, baselineHash) {
  return {
    title: String(task.title || '').slice(0, 300),
    code: task.code ? String(task.code).slice(0, 64) : null,
    description: task.description ? String(task.description).slice(0, 2_000) : null,
    type: task.type,
    status: task.status,
    currentProgress: task.progress,
    plannedStart: iso(task.startsAt),
    plannedEnd: iso(task.endsAt),
    baselineHash,
  };
}

function mediaSource(evidence, connection = null) {
  const media = record(evidence.media);
  const fromWhatsApp = Boolean(evidence.sourceMessageId);
  const valid = fromWhatsApp
    ? isWhatsAppProgressMediaForProject({
        media,
        sourceMessage: evidence.sourceMessage,
        connection,
        projectId: evidence.projectId,
      })
    : isDashboardProgressMediaForProject(media, evidence.projectId, { visualOnly: true });
  const sourceMedia = fromWhatsApp
    ? record(record(evidence.sourceMessage?.metadata).media)
    : media;
  const expectedSha256 = String(media.sha256 || '').toLowerCase();
  const mimeType = String(media.mimeType || '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase();
  const storage = record(sourceMedia.storage);
  const size = Number(media.size || 0);
  const identity = protectedStorageLookup(storage);

  if (
    !valid
    || !identity
  ) {
    throw error(
      'La evidencia no contiene una imagen privada verificable.',
      'VISUAL_PROGRESS_EVIDENCE_INVALID',
      422,
    );
  }
  return {
    expectedSha256,
    mimeType,
    storage,
    size,
    identity: `${storage.provider}:${identity.value}`,
  };
}

async function streamToBoundedBuffer(stream, {
  declaredSize = null,
  maxBytes = MAX_IMAGE_BYTES,
} = {}) {
  if (Number.isSafeInteger(declaredSize) && declaredSize > maxBytes) {
    throw error(
      'La imagen supera el límite de análisis visual.',
      'VISUAL_PROGRESS_IMAGE_TOO_LARGE',
      422,
    );
  }
  if (Buffer.isBuffer(stream)) {
    if (stream.length > maxBytes) {
      throw error(
        'La imagen supera el límite de análisis visual.',
        'VISUAL_PROGRESS_IMAGE_TOO_LARGE',
        422,
      );
    }
    return Buffer.from(stream);
  }
  if (!stream || typeof stream[Symbol.asyncIterator] !== 'function') {
    throw error(
      'No se pudo leer la imagen privada.',
      'VISUAL_PROGRESS_EVIDENCE_READ_FAILED',
      502,
    );
  }

  const chunks = [];
  let total = 0;
  for await (const chunk of stream) {
    const bytes = Buffer.from(chunk);
    total += bytes.length;
    if (total > maxBytes) {
      if (typeof stream.cancel === 'function') {
        try {
          await stream.cancel();
        } catch {
          // The size violation is the actionable failure.
        }
      }
      throw error(
        'La imagen supera el límite de análisis visual.',
        'VISUAL_PROGRESS_IMAGE_TOO_LARGE',
        422,
      );
    }
    chunks.push(bytes);
  }
  return Buffer.concat(chunks, total);
}

function providerStatus(errorValue) {
  if (!(errorValue instanceof VisualProgressProviderError)) return 502;
  if (errorValue.code === 'PROVIDER_NOT_CONFIGURED') return 503;
  if (errorValue.code === 'PROVIDER_TIMEOUT') return 504;
  if (errorValue.code.startsWith('IMAGE_')) return 422;
  if (errorValue.status === 429) return 429;
  return 502;
}

function failureCode(errorValue) {
  const candidate = String(errorValue?.code || '').toUpperCase();
  return /^[A-Z][A-Z0-9_]{0,63}$/.test(candidate)
    ? candidate
    : 'VISUAL_PROGRESS_ANALYSIS_FAILED';
}

export async function recoverExpiredVisualProgressAssessments(prisma, {
  projectId: rawProjectId,
  organizationId: rawOrganizationId = null,
  evidenceId: rawEvidenceId = null,
  assessmentId: rawAssessmentId = null,
  assessmentIds: rawAssessmentIds = null,
  now = new Date(),
  limit = MAX_RECOVERY_BATCH,
} = {}) {
  const projectId = requiredText(rawProjectId, 'projectId');
  const organizationId = rawOrganizationId
    ? requiredText(rawOrganizationId, 'organizationId')
    : null;
  const evidenceId = rawEvidenceId ? requiredText(rawEvidenceId, 'evidenceId') : null;
  const assessmentId = rawAssessmentId ? requiredText(rawAssessmentId, 'assessmentId') : null;
  const assessmentIds = Array.isArray(rawAssessmentIds)
    ? [...new Set(rawAssessmentIds.map((value) => requiredText(value, 'assessmentId')))]
      .slice(0, MAX_RECOVERY_BATCH)
    : null;
  const recoveredAt = validDate(now);
  const take = Math.min(Math.max(Number(limit) || MAX_RECOVERY_BATCH, 1), MAX_RECOVERY_BATCH);

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      ...(organizationId ? { organizationId } : {}),
    },
    select: { id: true, organizationId: true },
  });
  if (!project) return { recoveredIds: [] };

  const candidates = await prisma.visualProgressAssessment.findMany({
    where: {
      projectId,
      status: 'RUNNING',
      leaseExpiresAt: { lte: recoveredAt },
      ...(evidenceId ? { evidenceId } : {}),
      ...(assessmentId ? { id: assessmentId } : {}),
      ...(!assessmentId && assessmentIds ? { id: { in: assessmentIds } } : {}),
    },
    orderBy: [{ leaseExpiresAt: 'asc' }, { id: 'asc' }],
    take,
  });
  const recoveredIds = [];
  for (const candidate of candidates) {
    const completedAt = notBefore(recoveredAt, candidate.createdAt);
    const recovered = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.visualProgressAssessment.updateMany({
        where: {
          id: candidate.id,
          projectId,
          status: 'RUNNING',
          revision: candidate.revision,
          attemptCount: candidate.attemptCount,
          leaseExpiresAt: {
            equals: candidate.leaseExpiresAt,
            lte: recoveredAt,
          },
        },
        data: {
          status: 'FAILED',
          failureCode: VISUAL_PROGRESS_LEASE_EXPIRED_CODE,
          completedAt,
          leaseExpiresAt: null,
          revision: { increment: 1 },
        },
      });
      if (updated.count !== 1) return false;
      await transaction.auditLog.create({
        data: {
          organizationId: project.organizationId,
          actorId: null,
          action: 'progress.visual_assessment.lease_expired',
          entityType: 'VisualProgressAssessment',
          entityId: candidate.id,
          metadata: {
            projectId,
            taskId: candidate.taskId,
            evidenceId: candidate.evidenceId,
            provider: candidate.provider,
            model: candidate.providerModel,
            failureCode: VISUAL_PROGRESS_LEASE_EXPIRED_CODE,
            attemptCount: candidate.attemptCount,
            recoveredRevision: candidate.revision + 1,
          },
        },
      });
      return true;
    });
    if (recovered) recoveredIds.push(candidate.id);
  }
  return { recoveredIds };
}

async function recoverReplayIfExpired(prisma, row, { scope, now }) {
  if (
    row.status !== 'RUNNING'
    || !row.leaseExpiresAt
    || new Date(row.leaseExpiresAt).getTime() > validDate(now).getTime()
  ) {
    return row;
  }
  await recoverExpiredVisualProgressAssessments(prisma, {
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    evidenceId: row.evidenceId,
    assessmentId: row.id,
    now,
    limit: 1,
  });
  const refreshed = await prisma.visualProgressAssessment.findFirst({
    where: { id: row.id, projectId: scope.projectId },
  });
  return refreshed || row;
}

async function markFailed(prisma, context, errorValue, now) {
  const code = failureCode(errorValue);
  return prisma.$transaction(async (transaction) => {
    const result = await transaction.visualProgressAssessment.updateMany({
      where: activeLeaseWhere(context, now),
      data: {
        status: 'FAILED',
        failureCode: code,
        completedAt: now,
        leaseExpiresAt: null,
        revision: { increment: 1 },
      },
    });
    if (result.count === 1) {
      await transaction.auditLog.create({
        data: {
          organizationId: context.scope.organizationId,
          actorId: context.actorId,
          action: 'progress.visual_assessment.failed',
          entityType: 'VisualProgressAssessment',
          entityId: context.assessmentId,
          metadata: {
            projectId: context.scope.projectId,
            evidenceId: context.evidenceId,
            provider: context.provider.provider,
            model: context.provider.model,
            failureCode: code,
          },
        },
      });
    }
    return transaction.visualProgressAssessment.findFirst({
      where: { id: context.assessmentId, projectId: context.scope.projectId },
    });
  });
}

async function finalizeAssessment(prisma, context, result, now) {
  if (result.input.inputSha256 !== context.inputSha256) {
    throw error(
      'La huella procesada no coincide con la evidencia registrada.',
      'VISUAL_PROGRESS_EVIDENCE_INTEGRITY_FAILED',
      422,
      context.assessmentId,
    );
  }
  const assessment = result.assessment;
  const status = assessment.abstained ? 'ABSTAINED' : 'COMPLETED';
  return prisma.$transaction(async (transaction) => {
    const updated = await transaction.visualProgressAssessment.updateMany({
      where: activeLeaseWhere(context, now),
      data: {
        status,
        summary: assessment.summary.trim(),
        elementType: assessment.elementType?.trim() || null,
        progressMin: assessment.abstained ? null : assessment.progressMin,
        progressMax: assessment.abstained ? null : assessment.progressMax,
        confidence: assessment.confidence,
        quality: assessment.quality,
        observations: assessment.facts,
        limitations: assessment.limitations,
        providerResponseId: result.responseId || null,
        completedAt: now,
        leaseExpiresAt: null,
        reviewStatus: 'PENDING',
        revision: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw error(
        'La evaluación cambió mientras se procesaba.',
        'VISUAL_PROGRESS_ASSESSMENT_CONFLICT',
        409,
        context.assessmentId,
      );
    }
    await transaction.auditLog.create({
      data: {
        organizationId: context.scope.organizationId,
        actorId: context.actorId,
        action: assessment.abstained
          ? 'progress.visual_assessment.abstained'
          : 'progress.visual_assessment.completed',
        entityType: 'VisualProgressAssessment',
        entityId: context.assessmentId,
        metadata: {
          projectId: context.scope.projectId,
          evidenceId: context.evidenceId,
          taskId: context.taskId,
          provider: result.provider,
          model: result.model,
          schemaVersion: VISUAL_PROGRESS_SCHEMA_VERSION,
          inputSha256: context.inputSha256,
          submittedSha256: result.input.submittedSha256,
          width: result.input.width,
          height: result.input.height,
          abstained: assessment.abstained,
        },
      },
    });
    return transaction.visualProgressAssessment.findFirst({
      where: { id: context.assessmentId, projectId: context.scope.projectId },
    });
  });
}

async function freshProviderGate(prisma, context, now) {
  const [organization, evidence, actor] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: context.scope.organizationId },
      select: {
        id: true,
        metadata: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        trialEndsAt: true,
      },
    }),
    prisma.progressEvidence.findFirst({
      where: {
        id: context.evidenceId,
        projectId: context.scope.projectId,
      },
      select: {
        id: true,
        projectId: true,
        sourceMessageId: true,
        status: true,
        media: true,
        task: { select: { revision: true } },
        sourceMessage: {
          select: {
            direction: true,
            kind: true,
            mediaUrl: true,
            metadata: true,
            conversation: { select: { projectId: true, channel: true, externalId: true } },
          },
        },
      },
    }),
    prisma.platformUser.findUnique({
      where: { id: context.actorId },
      select: {
        systemRole: true,
        memberships: {
          where: {
            organizationId: context.scope.organizationId,
            status: 'ACTIVE',
          },
          select: {
            tenantRole: true,
            projectMemberships: {
              where: {
                projectId: context.scope.projectId,
                status: 'ACTIVE',
              },
              select: { id: true },
              take: 1,
            },
          },
          take: 1,
        },
      },
    }),
  ]);
  if (!organization || !subscriptionAllowsWrites(organization, now)) {
    throw error(
      'La suscripción activa no permite iniciar análisis visuales.',
      'SUBSCRIPTION_READ_ONLY',
      402,
      context.assessmentId,
    );
  }
  if (!tenantAiSettingsFromMetadata(organization.metadata).visualProgressEnabled) {
    throw error(
      'La lectura visual está desactivada para esta organización.',
      'VISUAL_PROGRESS_DISABLED',
      409,
      context.assessmentId,
    );
  }
  const membership = actor?.memberships?.[0] || null;
  const actorCanDispatch = actor?.systemRole === 'SUPERADMIN' || Boolean(
    membership
    && roleHasPermission(membership.tenantRole, 'org:execution:manage')
    && roleHasPermission(membership.tenantRole, SOURCE_EVIDENCE_PERMISSION)
    && (
      tenantRoleHasPortfolioAccess(membership.tenantRole)
      || membership.projectMemberships?.length > 0
    )
  );
  if (!actorCanDispatch) {
    throw error(
      'Tu acceso a la evidencia cambió antes de iniciar el análisis.',
      'VISUAL_PROGRESS_ACTOR_ACCESS_REVOKED',
      403,
      context.assessmentId,
    );
  }
  const connection = evidence?.sourceMessageId
    ? await prisma.whatsAppConnection.findFirst({
        where: { projectId: context.scope.projectId },
        select: { projectId: true, phoneNumberId: true, enabled: true },
      })
    : null;
  let freshSource = null;
  try {
    if (evidence) freshSource = mediaSource(evidence, connection);
  } catch {
    freshSource = null;
  }
  if (
    !evidence
    || evidence.status === 'REJECTED'
    || evidence.task.revision !== context.taskRevisionAtRequest
    || freshSource?.expectedSha256 !== context.inputSha256
    || freshSource?.identity !== context.sourceIdentity
    || freshSource?.mimeType !== context.sourceMimeType
    || freshSource?.size !== context.sourceSize
  ) {
    throw error(
      'La evidencia o la tarea cambió antes de iniciar el análisis.',
      'VISUAL_PROGRESS_SOURCE_CHANGED',
      409,
      context.assessmentId,
    );
  }
}

async function prepareAssessment(prisma, {
  scope,
  actorId,
  evidenceId,
  operationKeyHash,
  provider,
  now,
}) {
  return runOperationalProjectMutation(prisma, scope, async (transaction) => {
    const organization = await transaction.organization.findUnique({
      where: { id: scope.organizationId },
      select: {
        id: true,
        metadata: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        trialEndsAt: true,
      },
    });
    if (!organization || !subscriptionAllowsWrites(organization, now)) {
      throw error(
        'La suscripción activa no permite iniciar análisis visuales.',
        'SUBSCRIPTION_READ_ONLY',
        402,
      );
    }
    if (!tenantAiSettingsFromMetadata(organization.metadata).visualProgressEnabled) {
      throw error(
        'La lectura visual está desactivada para esta organización.',
        'VISUAL_PROGRESS_DISABLED',
        409,
      );
    }

    const evidence = await transaction.progressEvidence.findFirst({
      where: {
        id: evidenceId,
        projectId: scope.projectId,
      },
      select: {
        id: true,
        projectId: true,
        taskId: true,
        capturedAt: true,
        caption: true,
        media: true,
        status: true,
        revision: true,
        sourceMessageId: true,
        task: {
          select: {
            id: true,
            code: true,
            title: true,
            description: true,
            type: true,
            status: true,
            progress: true,
            startsAt: true,
            endsAt: true,
            revision: true,
          },
        },
        sourceMessage: {
          select: {
            direction: true,
            kind: true,
            mediaUrl: true,
            metadata: true,
            conversation: { select: { projectId: true, channel: true, externalId: true } },
          },
        },
      },
    });
    if (!evidence) {
      throw error(
        'La evidencia no está disponible en la obra activa.',
        'VISUAL_PROGRESS_EVIDENCE_NOT_FOUND',
        404,
      );
    }
    if (evidence.status === 'REJECTED') {
      throw error(
        'La evidencia rechazada no puede analizarse.',
        'VISUAL_PROGRESS_EVIDENCE_REJECTED',
        409,
      );
    }
    const openAssessment = await findOpenVisualAssessment(transaction, {
      projectId: scope.projectId,
      evidenceId: evidence.id,
    });
    if (openAssessment) {
      throw error(
        openAssessment.reviewStatus === 'PENDING'
          ? 'Esta evidencia ya tiene una lectura pendiente de revisión humana.'
          : 'Esta evidencia ya tiene una lectura visual en curso.',
        'VISUAL_PROGRESS_EVIDENCE_BUSY',
        409,
        openAssessment.id,
      );
    }
    const connection = evidence.sourceMessageId
      ? await transaction.whatsAppConnection.findFirst({
          where: { projectId: scope.projectId },
          select: { projectId: true, phoneNumberId: true, enabled: true },
        })
      : null;
    const source = mediaSource(evidence, connection);
    const planTasks = await transaction.task.findMany({
      where: { projectId: scope.projectId },
      select: PLAN_SELECT,
      orderBy: { id: 'asc' },
    });
    const baselineHash = canonicalPlanHash(planTasks);
    const requestFingerprint = hash('request', {
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      evidenceId: evidence.id,
      evidenceRevision: evidence.revision,
      inputSha256: source.expectedSha256,
      taskId: evidence.taskId,
      taskRevision: evidence.task.revision,
      baselineHash,
      provider: provider.provider,
      model: provider.model,
      analyzerVersion: ANALYZER_VERSION,
    });
    const row = await transaction.visualProgressAssessment.create({
      data: {
        projectId: scope.projectId,
        taskId: evidence.taskId,
        evidenceId: evidence.id,
        operationKeyHash,
        requestFingerprint,
        provider: provider.provider,
        providerModel: provider.model,
        analyzerVersion: ANALYZER_VERSION,
        inputSha256: source.expectedSha256,
        baselineHash,
        taskRevisionAtRequest: evidence.task.revision,
        evidenceRevisionAtRequest: evidence.revision,
        status: 'RUNNING',
        leaseExpiresAt: leaseDeadline(now),
        attemptCount: 1,
        requestedById: actorId,
      },
    });
    await transaction.auditLog.create({
      data: {
        organizationId: scope.organizationId,
        actorId,
        action: 'progress.visual_assessment.requested',
        entityType: 'VisualProgressAssessment',
        entityId: row.id,
        metadata: {
          projectId: scope.projectId,
          taskId: evidence.taskId,
          evidenceId: evidence.id,
          provider: provider.provider,
          model: provider.model,
          analyzerVersion: ANALYZER_VERSION,
          baselineHash,
        },
      },
    });
    return {
      row,
      source,
      caption: evidence.caption || '',
      taskContext: taskProviderContext(evidence.task, baselineHash),
    };
  });
}

function replayResult(row) {
  return {
    assessment: serializeVisualProgressAssessment(row),
    replayed: true,
    pending: row.status === 'RUNNING' || row.status === 'PENDING',
  };
}

export async function requestVisualProgressAssessment(prisma, {
  scope: rawScope,
  actorId: rawActorId,
  evidenceId: rawEvidenceId,
  idempotencyKey: rawIdempotencyKey,
  now = new Date(),
  analyze = analyzeVisualProgress,
  readFile = readProtectedFile,
  provider = resolvePrimaryVisualProgressModel(),
  clock = () => new Date(),
} = {}) {
  const scope = trustedScope(rawScope);
  const actorId = requiredText(rawActorId, 'actorId');
  const evidenceId = requiredText(rawEvidenceId, 'evidenceId');
  const operationKey = idempotencyKey(rawIdempotencyKey);
  const operationKeyHash = hash('operation', [
    scope.organizationId,
    scope.projectId,
    operationKey,
  ]);
  let existing = await prisma.visualProgressAssessment.findFirst({
    where: { projectId: scope.projectId, operationKeyHash },
  });
  if (existing) {
    if (existing.evidenceId !== evidenceId) {
      throw error(
        'La clave de idempotencia ya fue usada para otra evidencia.',
        'IDEMPOTENCY_PAYLOAD_MISMATCH',
        409,
        existing.id,
      );
    }
    existing = await recoverReplayIfExpired(prisma, existing, { scope, now });
    return replayResult(existing);
  }

  // A fenced recovery prevents an abandoned worker from blocking the evidence
  // forever before the project-serialized create checks for an open analysis.
  await recoverExpiredVisualProgressAssessments(prisma, {
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    evidenceId,
    now,
  });

  let prepared;
  try {
    prepared = await prepareAssessment(prisma, {
      scope,
      actorId,
      evidenceId,
      operationKeyHash,
      provider,
      now,
    });
  } catch (cause) {
    if (cause?.code === 'P2002') {
      let replay = await prisma.visualProgressAssessment.findFirst({
        where: { projectId: scope.projectId, operationKeyHash },
      });
      if (replay && replay.evidenceId === evidenceId) {
        replay = await recoverReplayIfExpired(prisma, replay, { scope, now });
        return replayResult(replay);
      }
      const openAssessment = await findOpenVisualAssessment(prisma, {
        projectId: scope.projectId,
        evidenceId,
      });
      if (openAssessment) {
        throw error(
          'Esta evidencia ya tiene una lectura visual activa o pendiente de revisión.',
          'VISUAL_PROGRESS_EVIDENCE_BUSY',
          409,
          openAssessment.id,
        );
      }
    }
    throw cause;
  }

  let context = {
    scope,
    actorId,
    assessmentId: prepared.row.id,
    revision: prepared.row.revision,
    attemptCount: prepared.row.attemptCount,
    leaseExpiresAt: prepared.row.leaseExpiresAt,
    evidenceId,
    taskId: prepared.row.taskId,
    taskRevisionAtRequest: prepared.row.taskRevisionAtRequest,
    inputSha256: prepared.row.inputSha256,
    sourceIdentity: prepared.source.identity,
    sourceMimeType: prepared.source.mimeType,
    sourceSize: prepared.source.size,
    createdAt: prepared.row.createdAt,
    provider,
  };
  try {
    await freshProviderGate(prisma, context, now);
    const protectedFile = await readFile(prepared.source.storage);
    if (!protectedFile?.stream) {
      throw error(
        'La imagen privada ya no está disponible.',
        'VISUAL_PROGRESS_EVIDENCE_NOT_FOUND',
        404,
        context.assessmentId,
      );
    }
    const imageBuffer = await streamToBoundedBuffer(protectedFile.stream, {
      declaredSize: protectedFile.size,
    });
    if (imageBuffer.length !== prepared.source.size) {
      throw error(
        'El tamaño de la imagen no coincide con la evidencia registrada.',
        'VISUAL_PROGRESS_EVIDENCE_INTEGRITY_FAILED',
        422,
        context.assessmentId,
      );
    }
    const digest = createHash('sha256').update(imageBuffer).digest('hex');
    if (digest !== context.inputSha256) {
      throw error(
        'La huella de la imagen no coincide con la evidencia registrada.',
        'VISUAL_PROGRESS_EVIDENCE_INTEGRITY_FAILED',
        422,
        context.assessmentId,
      );
    }
    // Authorization and billing state can change while private bytes are read.
    // Recheck at the last possible boundary before any image leaves ObraSaaS.
    const dispatchAt = validDate(clock(), 'clock');
    await freshProviderGate(prisma, context, dispatchAt);
    context = await renewVisualProgressLease(prisma, context, dispatchAt);
    const providerResult = await analyze({
      modelId: provider.id,
      allowedRolloutRoles: [MODEL_ROLLOUT_ROLES.PRIMARY],
      imageBuffer,
      mimeType: prepared.source.mimeType,
      organizationId: scope.organizationId,
      safetySubjectId: actorId,
      taskContext: prepared.taskContext,
      caption: prepared.caption,
    });
    const completedAt = notBefore(validDate(clock(), 'clock'), context.createdAt);
    const completed = await finalizeAssessment(prisma, context, providerResult, completedAt);
    return {
      assessment: serializeVisualProgressAssessment(completed),
      replayed: false,
      pending: false,
    };
  } catch (cause) {
    const failedAt = notBefore(validDate(clock(), 'clock'), context.createdAt);
    await markFailed(prisma, context, cause, failedAt).catch(() => null);
    if (cause instanceof VisualProgressAssessmentError) throw cause;
    throw error(
      cause instanceof VisualProgressProviderError && cause.code === 'PROVIDER_NOT_CONFIGURED'
        ? 'El proveedor de lectura visual no está configurado.'
        : cause instanceof VisualProgressProviderError && cause.code.startsWith('IMAGE_')
          ? 'La imagen no cumple los requisitos del análisis visual.'
          : 'El proveedor no pudo completar el análisis visual.',
      failureCode(cause),
      providerStatus(cause),
      context.assessmentId,
    );
  }
}

export async function listVisualProgressAssessments(prisma, {
  projectId: rawProjectId,
  evidenceId: rawEvidenceId = null,
  evidenceIds: rawEvidenceIds = null,
  latestPerEvidence = false,
  limit = 100,
  now = new Date(),
} = {}) {
  const projectId = requiredText(rawProjectId, 'projectId');
  const evidenceId = rawEvidenceId ? requiredText(rawEvidenceId, 'evidenceId') : null;
  const evidenceIds = Array.isArray(rawEvidenceIds)
    ? [...new Set(rawEvidenceIds.map((value) => requiredText(value, 'evidenceId')))].slice(0, 200)
    : null;
  const take = Math.min(Math.max(Number(limit) || 100, 1), 200);
  const checkedAt = validDate(now);
  if (evidenceIds && evidenceIds.length === 0) return { assessments: [] };
  const where = {
    projectId,
    ...(evidenceId
      ? { evidenceId }
      : evidenceIds
        ? { evidenceId: { in: evidenceIds } }
        : {}),
  };
  let rows = await prisma.visualProgressAssessment.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    ...(!latestPerEvidence ? { take } : {}),
  });
  const expiredIds = rows
    .filter((row) => (
      row.status === 'RUNNING'
      && row.leaseExpiresAt
      && new Date(row.leaseExpiresAt).getTime() <= checkedAt.getTime()
    ))
    .map((row) => row.id);
  if (expiredIds.length > 0) {
    await recoverExpiredVisualProgressAssessments(prisma, {
      projectId,
      evidenceId,
      assessmentIds: expiredIds,
      now: checkedAt,
      limit: expiredIds.length,
    });
    rows = await prisma.visualProgressAssessment.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(!latestPerEvidence ? { take } : {}),
    });
  }
  if (latestPerEvidence) {
    const latest = new Map();
    for (const row of rows) {
      if (!latest.has(row.evidenceId)) latest.set(row.evidenceId, row);
    }
    rows = [...latest.values()];
  }
  return { assessments: rows.map(serializeVisualProgressAssessment) };
}

function reviewInput({ status, reviewNote, correctedProgressMin, correctedProgressMax }) {
  const normalizedStatus = String(status || '').trim().toUpperCase();
  if (!REVIEW_STATUSES.has(normalizedStatus)) {
    throw error(
      'La decisión de revisión no es válida.',
      'VISUAL_PROGRESS_REVIEW_INVALID',
    );
  }
  const note = typeof reviewNote === 'string' ? reviewNote.trim().slice(0, 10_000) : '';
  if ((normalizedStatus === 'REJECTED' || normalizedStatus === 'CORRECTED') && !note) {
    throw error(
      'La corrección o rechazo requiere una explicación.',
      'VISUAL_PROGRESS_REVIEW_NOTE_REQUIRED',
    );
  }
  const min = correctedProgressMin;
  const max = correctedProgressMax;
  if (
    normalizedStatus === 'CORRECTED'
    && (
      !Number.isSafeInteger(min)
      || !Number.isSafeInteger(max)
      || min < 0
      || max > 100
      || min > max
    )
  ) {
    throw error(
      'El rango corregido debe contener enteros entre 0 y 100.',
      'VISUAL_PROGRESS_REVIEW_RANGE_INVALID',
    );
  }
  return {
    status: normalizedStatus,
    reviewNote: note || null,
    correctedProgressMin: normalizedStatus === 'CORRECTED' ? min : null,
    correctedProgressMax: normalizedStatus === 'CORRECTED' ? max : null,
  };
}

export async function reviewVisualProgressAssessment(prisma, {
  scope: rawScope,
  actorId: rawActorId,
  assessmentId: rawAssessmentId,
  evidenceId: rawEvidenceId = null,
  expectedRevision,
  status,
  reviewNote,
  correctedProgressMin,
  correctedProgressMax,
  now = new Date(),
} = {}) {
  const scope = trustedScope(rawScope);
  const actorId = requiredText(rawActorId, 'actorId');
  const assessmentId = requiredText(rawAssessmentId, 'assessmentId');
  const evidenceId = rawEvidenceId ? requiredText(rawEvidenceId, 'evidenceId') : null;
  const revision = Number(expectedRevision);
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw error(
      'La revisión esperada no es válida.',
      'VISUAL_PROGRESS_REVIEW_INVALID',
    );
  }
  const decision = reviewInput({
    status,
    reviewNote,
    correctedProgressMin,
    correctedProgressMax,
  });

  return runOperationalProjectMutation(prisma, scope, async (transaction) => {
    const current = await transaction.visualProgressAssessment.findFirst({
      where: {
        id: assessmentId,
        projectId: scope.projectId,
        ...(evidenceId ? { evidenceId } : {}),
      },
      include: {
        evidence: { select: { status: true, media: true } },
        task: { select: { revision: true } },
      },
    });
    if (!current) {
      throw error(
        'La evaluación visual no está disponible.',
        'VISUAL_PROGRESS_ASSESSMENT_NOT_FOUND',
        404,
      );
    }
    if (
      current.revision !== revision
      || !['COMPLETED', 'ABSTAINED'].includes(current.status)
      || current.reviewStatus !== 'PENDING'
    ) {
      throw error(
        'La evaluación cambió o ya fue revisada.',
        'VISUAL_PROGRESS_ASSESSMENT_CONFLICT',
        409,
      );
    }
    const currentMediaSha = String(record(current.evidence.media).sha256 || '').toLowerCase();
    const planTasks = await transaction.task.findMany({
      where: { projectId: scope.projectId },
      select: PLAN_SELECT,
      orderBy: { id: 'asc' },
    });
    const stale = (
      current.evidence.status === 'REJECTED'
      || currentMediaSha !== current.inputSha256
      || current.task.revision !== current.taskRevisionAtRequest
      || canonicalPlanHash(planTasks) !== current.baselineHash
    );
    if (stale && decision.status !== 'REJECTED') {
      throw error(
        'La evidencia o el plan canónico cambió. Rechazá esta lectura obsoleta antes de generar una nueva.',
        'VISUAL_PROGRESS_ASSESSMENT_STALE',
        409,
      );
    }
    const reviewedAt = notBefore(now, current.completedAt);
    const updated = await transaction.visualProgressAssessment.updateMany({
      where: {
        id: assessmentId,
        projectId: scope.projectId,
        revision,
        reviewStatus: 'PENDING',
      },
      data: {
        reviewStatus: decision.status,
        reviewedById: actorId,
        reviewedAt,
        reviewNote: decision.reviewNote,
        correctedProgressMin: decision.correctedProgressMin,
        correctedProgressMax: decision.correctedProgressMax,
        revision: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw error(
        'La evaluación cambió o ya fue revisada.',
        'VISUAL_PROGRESS_ASSESSMENT_CONFLICT',
        409,
      );
    }
    await transaction.auditLog.create({
      data: {
        organizationId: scope.organizationId,
        actorId,
        action: 'progress.visual_assessment.reviewed',
        entityType: 'VisualProgressAssessment',
        entityId: assessmentId,
        metadata: {
          projectId: scope.projectId,
          taskId: current.taskId,
          evidenceId: current.evidenceId,
          reviewStatus: decision.status,
          staleAtReview: stale,
          revision: revision + 1,
          baselineHash: current.baselineHash,
        },
      },
    });
    const row = await transaction.visualProgressAssessment.findFirst({
      where: { id: assessmentId, projectId: scope.projectId },
    });
    return { assessment: serializeVisualProgressAssessment(row) };
  });
}

export function visualProgressAssessmentErrorResponse(errorValue) {
  if (!(errorValue instanceof VisualProgressAssessmentError)) return null;
  return Response.json({
    error: errorValue.message,
    code: errorValue.code,
    ...(errorValue.assessmentId ? { assessmentId: errorValue.assessmentId } : {}),
  }, {
    status: errorValue.status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
