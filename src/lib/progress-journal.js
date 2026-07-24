import { runOperationalProjectMutation } from './project-write-policy.js';

const statuses = new Set(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']);
const evidenceStatuses = new Set(['PENDING', 'APPROVED', 'REJECTED']);

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

function serializeLog(log) { return { ...log, workDate: log.workDate?.toISOString?.().slice(0, 10), submittedAt: log.submittedAt?.toISOString?.() || null, approvedAt: log.approvedAt?.toISOString?.() || null, createdAt: log.createdAt?.toISOString?.() || null, updatedAt: log.updatedAt?.toISOString?.() || null }; }
function serializeEvidence(item) { return { ...item, capturedAt: item.capturedAt?.toISOString?.() || null, reviewedAt: item.reviewedAt?.toISOString?.() || null, latitude: item.latitude?.toString?.() || null, longitude: item.longitude?.toString?.() || null, accuracyMeters: item.accuracyMeters?.toString?.() || null, createdAt: item.createdAt?.toISOString?.() || null }; }

export async function listProgressJournal(prisma, { projectId }) {
  const [dailyLogs, evidence, blockers, incidents] = await Promise.all([
    prisma.dailyLog.findMany({ where: { projectId }, orderBy: [{ workDate: 'desc' }, { createdAt: 'desc' }], take: 100 }),
    prisma.progressEvidence.findMany({ where: { projectId }, orderBy: { capturedAt: 'desc' }, take: 100 }),
    prisma.projectBlocker.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, title: true, status: true, severity: true, taskId: true, createdAt: true, updatedAt: true } }),
    prisma.incident.findMany({ where: { projectId }, orderBy: { occurredAt: 'desc' }, take: 100, select: { id: true, title: true, severity: true, status: true, occurredAt: true } }),
  ]);
  const timeline = [
    ...dailyLogs.map((item) => ({ id: item.id, kind: 'DAILY_LOG', occurredAt: item.createdAt?.toISOString?.() || null, taskId: item.taskId || null, title: item.title, status: item.status, severity: null })),
    ...evidence.map((item) => ({ id: item.id, kind: 'EVIDENCE', occurredAt: item.capturedAt?.toISOString?.() || null, taskId: item.taskId, title: item.caption || 'Evidencia de avance', status: item.status, severity: null })),
    ...blockers.map((item) => ({ id: item.id, kind: 'BLOCKER', occurredAt: item.createdAt?.toISOString?.() || null, taskId: item.taskId || null, title: item.title, status: item.status, severity: item.severity })),
    ...incidents.map((item) => ({ id: item.id, kind: 'INCIDENT', occurredAt: item.occurredAt?.toISOString?.() || null, taskId: null, title: item.title, status: item.status, severity: item.severity })),
  ].sort((left, right) => String(right.occurredAt).localeCompare(String(left.occurredAt))).slice(0, 200);
  return { dailyLogs: dailyLogs.map(serializeLog), evidence: evidence.map(serializeEvidence), timeline };
}

export async function createProgressJournalRecord(prisma, { scope: rawScope, actorId, input }) {
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
      const taskId = requiredText(input.taskId, 'taskId', 190); const capturedAt = parsedDate(input.capturedAt, 'capturedAt'); const caption = optionalText(input.caption, 'caption', 2000); const media = input.media;
      if (!media || typeof media !== 'object' || Array.isArray(media)) throw new ProgressJournalError('media debe ser un objeto de referencia privada.');
      if (!(await tx.task.findFirst({ where: { projectId: currentScope.projectId, id: taskId } }))) throw new ProgressJournalError('La tarea no pertenece a la obra.');
      const authorWorkerId = input.authorWorkerId ? requiredText(input.authorWorkerId, 'authorWorkerId', 190) : null;
      if (authorWorkerId && !(await tx.worker.findFirst({ where: { projectId: currentScope.projectId, id: authorWorkerId, active: true } }))) throw new ProgressJournalError('El autor no pertenece a la obra o está inactivo.');
      const item = await tx.progressEvidence.create({ data: { projectId: currentScope.projectId, taskId, authorWorkerId, capturedAt, caption, media } });
      await tx.auditLog.create({ data: { organizationId: currentScope.organizationId, actorId: actor, action: 'progress.evidence.created', entityType: 'ProgressEvidence', entityId: item.id, metadata: { projectId: currentScope.projectId, taskId } } });
      return { evidence: serializeEvidence(item) };
    }
    throw new ProgressJournalError('kind debe ser DAILY_LOG o EVIDENCE.');
  });
}

export async function reviewProgressRecord(prisma, { scope: rawScope, actorId, id, kind, status, expected, reviewNote }) {
  const currentScope = scope(rawScope); const actor = requiredText(actorId, 'actorId', 190); const revision = expectedRevision(expected); const normalizedKind = String(kind || '').toUpperCase();
  if (normalizedKind === 'DAILY_LOG' && !statuses.has(status)) throw new ProgressJournalError('Estado de bitácora inválido.');
  if (normalizedKind === 'EVIDENCE' && !evidenceStatuses.has(status)) throw new ProgressJournalError('Estado de evidencia inválido.');
  return runOperationalProjectMutation(prisma, currentScope, async (tx) => {
    const table = normalizedKind === 'DAILY_LOG' ? tx.dailyLog : normalizedKind === 'EVIDENCE' ? tx.progressEvidence : null;
    if (!table) throw new ProgressJournalError('kind inválido.');
    const current = await table.findFirst({ where: { projectId: currentScope.projectId, id } }); if (!current) throw new ProgressJournalError('Registro no encontrado.', 'PROGRESS_JOURNAL_NOT_FOUND', 404);
    if (current.revision !== revision) throw new ProgressJournalError('El registro cambió; recargá antes de revisar.', 'PROGRESS_JOURNAL_CONFLICT', 409);
    const updated = await table.update({ where: { id }, data: normalizedKind === 'DAILY_LOG' ? { status, revision: { increment: 1 }, submittedAt: status === 'SUBMITTED' ? new Date() : current.submittedAt, approvedAt: status === 'APPROVED' ? new Date() : current.approvedAt, rejectionReason: status === 'REJECTED' ? optionalText(reviewNote, 'reviewNote', 2000) : current.rejectionReason } : { status, revision: { increment: 1 }, reviewedAt: new Date(), reviewNote: optionalText(reviewNote, 'reviewNote', 2000) } });
    await tx.auditLog.create({ data: { organizationId: currentScope.organizationId, actorId: actor, action: `progress.${normalizedKind.toLowerCase()}.reviewed`, entityType: normalizedKind === 'DAILY_LOG' ? 'DailyLog' : 'ProgressEvidence', entityId: id, metadata: { projectId: currentScope.projectId, status, revision: revision + 1 } } });
    return normalizedKind === 'DAILY_LOG' ? { dailyLog: serializeLog(updated) } : { evidence: serializeEvidence(updated) };
  });
}

export function progressJournalErrorResponse(error) { if (!(error instanceof ProgressJournalError)) return null; return Response.json({ error: error.message, code: error.code }, { status: error.status }); }
