import { runOperationalProjectMutation } from './project-write-policy.js';
import {
  assertProtectedUploadReplay,
  claimProtectedUpload,
  PROTECTED_UPLOAD_PURPOSE,
  protectedUploadClaimFingerprint,
} from './protected-uploads.js';

const statuses = new Set(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']);
const evidenceStatuses = new Set(['PENDING', 'APPROVED', 'REJECTED']);
const reviewTransitions = Object.freeze({
  DAILY_LOG: Object.freeze({
    DRAFT: new Set(['SUBMITTED']),
    SUBMITTED: new Set(['APPROVED', 'REJECTED']),
    APPROVED: new Set(),
    REJECTED: new Set(),
  }),
  EVIDENCE: Object.freeze({
    PENDING: new Set(['APPROVED', 'REJECTED']),
    APPROVED: new Set(),
    REJECTED: new Set(),
  }),
});

export class ProgressJournalError extends Error {
  constructor(message, code = 'PROGRESS_JOURNAL_INVALID', status = 400) { super(message); this.name = 'ProgressJournalError'; this.code = code; this.status = status; }
}

function requiredText(value, field, max) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new ProgressJournalError(`${field} es obligatorio y tiene un límite de ${max} caracteres.`);
  return value.trim();
}
function optionalText(value, field, max) { if (value == null || value === '') return null; return requiredText(value, field, max); }
function parsedDate(value, field) { const result = new Date(value); if (!value || Number.isNaN(result.getTime())) throw new ProgressJournalError(`${field} no es válida.`); return result; }
function expectedRevision(value) { const result = Number(value); if (!Number.isSafeInteger(result) || result < 0) throw new ProgressJournalError('expectedRevision inválida.'); return result; }
function scope(scope) { if (!scope?.projectId || !scope?.organizationId) throw new ProgressJournalError('Alcance incompleto.'); return scope; }
function assertReviewTransition(kind, currentStatus, nextStatus) {
  if (!reviewTransitions[kind]?.[currentStatus]?.has(nextStatus)) {
    throw new ProgressJournalError(
      'La transición solicitada no está permitida para el estado actual.',
      'PROGRESS_JOURNAL_TRANSITION_INVALID',
      409,
    );
  }
}

function serializeLog(log) { return { ...log, workDate: log.workDate?.toISOString?.().slice(0, 10), submittedAt: log.submittedAt?.toISOString?.() || null, approvedAt: log.approvedAt?.toISOString?.() || null, createdAt: log.createdAt?.toISOString?.() || null, updatedAt: log.updatedAt?.toISOString?.() || null }; }
function jsonObject(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function safeMediaKind(media) {
  const explicit = String(media.kind || '').toLowerCase();
  if (['image', 'video', 'document'].includes(explicit)) return explicit;
  const mimeType = String(media.mimeType || '').toLowerCase();
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return mimeType ? 'document' : null;
}
function safeAttachment(item, includeSourceEvidence) {
  const media = jsonObject(item.media);
  const available = Object.keys(media).length > 0;
  if (!includeSourceEvidence) return { available, restricted: available };
  const mimeType = /^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/i.test(String(media.mimeType || '')) ? String(media.mimeType) : null;
  const filename = typeof media.filename === 'string' && media.filename.trim() ? media.filename.trim().slice(0, 255) : null;
  const size = Number.isSafeInteger(media.size) && media.size > 0 ? media.size : null;
  return {
    available,
    restricted: false,
    kind: safeMediaKind(media),
    mimeType,
    filename,
    size,
    href: available
      ? item.sourceMessageId
        ? `/api/evidence/${encodeURIComponent(item.sourceMessageId)}`
        : `/api/progress/${encodeURIComponent(item.id)}/attachment`
      : null,
  };
}
export function serializeProgressEvidence(item, { includeSourceEvidence = false } = {}) {
  const sourcedFromWhatsApp = Boolean(item.sourceMessageId);
  const location = item.locationVerification
    ? {
        capturedAt: item.locationCapturedAt?.toISOString?.() || null,
        source: item.locationSource || null,
        verification: item.locationVerification,
      }
    : null;
  return {
    id: item.id,
    projectId: item.projectId,
    taskId: item.taskId,
    authorWorkerId: item.authorWorkerId || null,
    capturedAt: item.capturedAt?.toISOString?.() || null,
    caption: item.caption || null,
    location,
    ...(includeSourceEvidence
      ? {
          latitude: item.latitude?.toString?.() || null,
          longitude: item.longitude?.toString?.() || null,
          accuracyMeters: item.accuracyMeters?.toString?.() || null,
        }
      : {}),
    status: item.status,
    reviewNote: item.reviewNote || null,
    revision: item.revision,
    reviewedAt: item.reviewedAt?.toISOString?.() || null,
    createdAt: item.createdAt?.toISOString?.() || null,
    updatedAt: item.updatedAt?.toISOString?.() || null,
    source: sourcedFromWhatsApp
      ? {
          channel: 'whatsapp',
          ...(includeSourceEvidence
            ? {
                conversationId: item.sourceConversationId,
                messageId: item.sourceMessageId,
              }
            : {}),
        }
      : { channel: 'dashboard' },
    attachment: safeAttachment(item, includeSourceEvidence),
  };
}

export async function listProgressJournal(prisma, { projectId, limit = 50, before = null, kind = null, status = null, taskId = null, includeSourceEvidence = false } = {}) {
  const take = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const beforeDate = before ? new Date(before) : null;
  if (before && Number.isNaN(beforeDate?.getTime?.())) throw new ProgressJournalError('before no es una fecha válida.');
  const dateFilter = beforeDate ? { lt: beforeDate } : undefined;
  const normalizedKind = kind ? String(kind).toUpperCase() : null;
  const normalizedStatus = status ? String(status).toUpperCase() : null;
  if (normalizedKind && !['DAILY_LOG', 'EVIDENCE', 'BLOCKER', 'INCIDENT'].includes(normalizedKind)) throw new ProgressJournalError('kind de timeline inválido.');
  const [dailyLogs, evidence, blockers, incidents] = await Promise.all([
    (!normalizedKind || normalizedKind === 'DAILY_LOG') ? prisma.dailyLog.findMany({ where: { projectId, ...(taskId ? { taskId } : {}), ...(normalizedStatus ? { status: normalizedStatus } : {}), ...(dateFilter ? { createdAt: dateFilter } : {}) }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take }) : [],
    (!normalizedKind || normalizedKind === 'EVIDENCE') ? prisma.progressEvidence.findMany({ where: { projectId, ...(taskId ? { taskId } : {}), ...(normalizedStatus ? { status: normalizedStatus } : {}), ...(dateFilter ? { capturedAt: dateFilter } : {}) }, orderBy: [{ capturedAt: 'desc' }, { id: 'desc' }], take }) : [],
    (!normalizedKind || normalizedKind === 'BLOCKER') ? prisma.projectBlocker.findMany({ where: { projectId, ...(taskId ? { taskId } : {}), ...(normalizedStatus ? { status: normalizedStatus } : {}), ...(dateFilter ? { createdAt: dateFilter } : {}) }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take, select: { id: true, title: true, status: true, severity: true, taskId: true, createdAt: true, updatedAt: true } }) : [],
    (!normalizedKind || normalizedKind === 'INCIDENT') ? prisma.incident.findMany({ where: { projectId, ...(normalizedStatus ? { status: normalizedStatus } : {}), ...(dateFilter ? { occurredAt: dateFilter } : {}) }, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], take, select: { id: true, title: true, severity: true, status: true, occurredAt: true } }) : [],
  ]);
  const timeline = [
    ...dailyLogs.map((item) => ({ id: item.id, kind: 'DAILY_LOG', occurredAt: item.createdAt?.toISOString?.() || null, taskId: item.taskId || null, title: item.title, status: item.status, severity: null })),
    ...evidence.map((item) => ({ id: item.id, kind: 'EVIDENCE', occurredAt: item.capturedAt?.toISOString?.() || null, taskId: item.taskId, title: item.caption || 'Evidencia de avance', status: item.status, severity: null })),
    ...blockers.map((item) => ({ id: item.id, kind: 'BLOCKER', occurredAt: item.createdAt?.toISOString?.() || null, taskId: item.taskId || null, title: item.title, status: item.status, severity: item.severity })),
    ...incidents.map((item) => ({ id: item.id, kind: 'INCIDENT', occurredAt: item.occurredAt?.toISOString?.() || null, taskId: null, title: item.title, status: item.status, severity: item.severity })),
  ].sort((left, right) => String(right.occurredAt).localeCompare(String(left.occurredAt)) || String(right.id).localeCompare(String(left.id))).slice(0, take);
  return { dailyLogs: dailyLogs.map(serializeLog), evidence: evidence.map((item) => serializeProgressEvidence(item, { includeSourceEvidence })), timeline, page: { limit: take, nextBefore: timeline.length === take ? timeline[timeline.length - 1].occurredAt : null, hasMore: timeline.length === take } };
}

export async function createProgressJournalRecord(prisma, {
  scope: rawScope,
  actorId,
  input,
  includeSourceEvidence = false,
}) {
  const currentScope = scope(rawScope); const actor = requiredText(actorId, 'actorId', 190); const kind = String(input?.kind || '').toUpperCase();
  return runOperationalProjectMutation(prisma, currentScope, async (tx) => {
    if (kind === 'DAILY_LOG') {
      const title = requiredText(input.title, 'title', 220); const summary = requiredText(input.summary, 'summary', 10000); const workDate = parsedDate(input.workDate, 'workDate');
      const taskId = input.taskId ? requiredText(input.taskId, 'taskId', 190) : null; const authorWorkerId = input.authorWorkerId ? requiredText(input.authorWorkerId, 'authorWorkerId', 190) : null;
      if (taskId && !(await tx.task.findFirst({ where: { projectId: currentScope.projectId, id: taskId } }))) throw new ProgressJournalError('La tarea no pertenece a la obra.');
      if (authorWorkerId && !(await tx.worker.findFirst({ where: { projectId: currentScope.projectId, id: authorWorkerId, active: true } }))) throw new ProgressJournalError('El autor no pertenece a la obra o está inactivo.');
      const log = await tx.dailyLog.create({ data: { projectId: currentScope.projectId, taskId, authorWorkerId, workDate, title, summary } });
      await tx.auditLog.create({ data: { organizationId: currentScope.organizationId, actorId: actor, action: 'progress.daily_log.created', entityType: 'DailyLog', entityId: log.id, metadata: { projectId: currentScope.projectId, taskId } } });
      return { dailyLog: serializeLog(log) };
    }
    if (kind === 'EVIDENCE') {
      if (input.media !== undefined && input.media !== null) throw new ProgressJournalError('La media debe referenciarse únicamente mediante uploadId.', 'PROGRESS_MEDIA_DESCRIPTOR_FORBIDDEN');
      const taskId = requiredText(input.taskId, 'taskId', 190);
      const capturedAt = parsedDate(input.capturedAt, 'capturedAt');
      const caption = optionalText(input.caption, 'caption', 2000);
      const uploadId = requiredText(input.uploadId, 'uploadId', 190);
      const operationKey = requiredText(input.operationKey, 'operationKey', 190);
      const operationKeyHash = protectedUploadClaimFingerprint({ projectId: currentScope.projectId, kind: 'EVIDENCE', operationKey });
      const authorWorkerId = input.authorWorkerId ? requiredText(input.authorWorkerId, 'authorWorkerId', 190) : null;
      const requestFingerprint = protectedUploadClaimFingerprint({ taskId, capturedAt: capturedAt.toISOString(), caption, authorWorkerId, uploadId });
      const replay = await tx.progressEvidence.findFirst({ where: { projectId: currentScope.projectId, sourceOperationKeyHash: operationKeyHash } });
      if (replay) {
        if (replay.sourceRequestFingerprint !== requestFingerprint) throw new ProgressJournalError('La operationKey ya fue usada con otro contenido.', 'IDEMPOTENCY_REPLAY_MUTATED', 409);
        await assertProtectedUploadReplay(tx, { scope: currentScope, actorId: actor, purpose: PROTECTED_UPLOAD_PURPOSE.PROGRESS, uploadId, entityId: replay.id, entityProtectedUploadId: replay.protectedUploadId, claimFingerprint: requestFingerprint, entityHasAttachment: Boolean(replay.media) });
        return {
          evidence: serializeProgressEvidence(replay, { includeSourceEvidence }),
          replayed: true,
        };
      }
      if (!(await tx.task.findFirst({ where: { projectId: currentScope.projectId, id: taskId } }))) throw new ProgressJournalError('La tarea no pertenece a la obra.');
      if (authorWorkerId && !(await tx.worker.findFirst({ where: { projectId: currentScope.projectId, id: authorWorkerId, active: true } }))) throw new ProgressJournalError('El autor no pertenece a la obra o está inactivo.');
      const item = await claimProtectedUpload(tx, {
        scope: currentScope,
        actorId: actor,
        purpose: PROTECTED_UPLOAD_PURPOSE.PROGRESS,
        uploadId,
        claimFingerprint: requestFingerprint,
        createEntity: (media) => tx.progressEvidence.create({ data: { projectId: currentScope.projectId, taskId, authorWorkerId, capturedAt, caption, media, protectedUploadId: uploadId, sourceOperationKeyHash: operationKeyHash, sourceRequestFingerprint: requestFingerprint } }),
      });
      await tx.auditLog.create({ data: { organizationId: currentScope.organizationId, actorId: actor, action: 'progress.evidence.created', entityType: 'ProgressEvidence', entityId: item.id, metadata: { projectId: currentScope.projectId, taskId } } });
      return {
        evidence: serializeProgressEvidence(item, { includeSourceEvidence }),
      };
    }
    throw new ProgressJournalError('kind debe ser DAILY_LOG o EVIDENCE.');
  });
}

export async function reviewProgressRecord(prisma, { scope: rawScope, actorId, id, kind, status, expected, reviewNote, includeSourceEvidence = false }) {
  const currentScope = scope(rawScope); const actor = requiredText(actorId, 'actorId', 190); const revision = expectedRevision(expected); const normalizedKind = String(kind || '').toUpperCase(); const normalizedStatus = String(status || '').toUpperCase();
  if (normalizedKind === 'DAILY_LOG' && !statuses.has(normalizedStatus)) throw new ProgressJournalError('Estado de bitácora inválido.');
  if (normalizedKind === 'EVIDENCE' && !evidenceStatuses.has(normalizedStatus)) throw new ProgressJournalError('Estado de evidencia inválido.');
  return runOperationalProjectMutation(prisma, currentScope, async (tx) => {
    const table = normalizedKind === 'DAILY_LOG' ? tx.dailyLog : normalizedKind === 'EVIDENCE' ? tx.progressEvidence : null;
    if (!table) throw new ProgressJournalError('kind inválido.');
    const current = await table.findFirst({ where: { projectId: currentScope.projectId, id } }); if (!current) throw new ProgressJournalError('Registro no encontrado.', 'PROGRESS_JOURNAL_NOT_FOUND', 404);
    if (current.revision !== revision) throw new ProgressJournalError('El registro cambió; recargá antes de revisar.', 'PROGRESS_JOURNAL_CONFLICT', 409);
    assertReviewTransition(normalizedKind, current.status, normalizedStatus);
    const updated = await table.update({ where: { id }, data: normalizedKind === 'DAILY_LOG' ? { status: normalizedStatus, revision: { increment: 1 }, submittedAt: normalizedStatus === 'SUBMITTED' ? new Date() : current.submittedAt, approvedAt: normalizedStatus === 'APPROVED' ? new Date() : current.approvedAt, rejectionReason: normalizedStatus === 'REJECTED' ? optionalText(reviewNote, 'reviewNote', 2000) : current.rejectionReason } : { status: normalizedStatus, revision: { increment: 1 }, reviewedAt: new Date(), reviewNote: optionalText(reviewNote, 'reviewNote', 2000) } });
    await tx.auditLog.create({ data: { organizationId: currentScope.organizationId, actorId: actor, action: `progress.${normalizedKind.toLowerCase()}.reviewed`, entityType: normalizedKind === 'DAILY_LOG' ? 'DailyLog' : 'ProgressEvidence', entityId: id, metadata: { projectId: currentScope.projectId, previousStatus: current.status, status: normalizedStatus, revision: revision + 1 } } });
    return normalizedKind === 'DAILY_LOG' ? { dailyLog: serializeLog(updated) } : { evidence: serializeProgressEvidence(updated, { includeSourceEvidence }) };
  });
}

export function progressJournalErrorResponse(error) { if (!(error instanceof ProgressJournalError)) return null; return Response.json({ error: error.message, code: error.code }, { status: error.status }); }
