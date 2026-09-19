import { createHash } from 'node:crypto';
import { runOperationalProjectMutation, isOperationalProjectWriteStatus } from './project-write-policy.js';
import { JournalCorrectionError, correctionIdentifier, normalizeJournalCorrection } from './journal-correction-policy.js';
const ACTION = 'progress.daily_log.correction_created';
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const receiptId = (projectId, sourceId) => 'jcor_receipt_' + digest(['journal-correction-v1', projectId, sourceId]);
const childId = (organizationId, projectId, sourceId) => 'jcor_' + digest(['journal-correction-v1', organizationId, projectId, sourceId]);
const iso = value => value ? new Date(value).toISOString() : null;
function record(row) {
  return { id: row.id, projectId: row.projectId, taskId: row.taskId || null, authorWorkerId: row.authorWorkerId || null,
    title: row.title, summary: row.summary, workDate: iso(row.workDate)?.slice(0, 10), status: row.status, revision: row.revision,
    rejectionReason: row.rejectionReason || null, submittedAt: iso(row.submittedAt), approvedAt: iso(row.approvedAt),
    createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) };
}
function sourceVersion(row) {
  const { id, projectId, title, summary, workDate, taskId, authorWorkerId, status, revision, rejectionReason } = record(row);
  return digest({ id, projectId, title, summary, workDate, taskId, authorWorkerId, status, revision, rejectionReason });
}
function trustedScope(scope) {
  return { organizationId: correctionIdentifier(scope?.organizationId), projectId: correctionIdentifier(scope?.projectId) };
}
async function rejectedSource(tx, projectId, sourceId) {
  const source = await tx.dailyLog.findFirst({ where: { id: sourceId, projectId } });
  if (!source) throw new JournalCorrectionError('El parte no está disponible en esta obra.', 'JOURNAL_CORRECTION_NOT_FOUND', 404);
  if (source.status !== 'REJECTED') throw new JournalCorrectionError('Esta acción sólo admite partes rechazados; el original no se modifica.', 'JOURNAL_CORRECTION_SOURCE_LOCKED', 409);
  return source;
}
const relation = row => ({ id: row.id, title: row.title, status: row.status, revision: row.revision });
async function existingCorrection(tx, scope, sourceId) {
  const id = childId(scope.organizationId, scope.projectId, sourceId);
  const receipt = await tx.auditLog.findFirst({ where: { id: receiptId(scope.projectId, sourceId), organizationId: scope.organizationId, action: ACTION, entityType: 'DailyLog', entityId: id } });
  const child = await tx.dailyLog.findFirst({ where: { id, projectId: scope.projectId } });
  if (!receipt && !child) return null;
  if (!receipt || receipt.metadata?.projectId !== scope.projectId || receipt.metadata?.sourceId !== sourceId || receipt.metadata?.correctionId !== id) throw new JournalCorrectionError('No se pudo verificar la trazabilidad de la corrección.', 'JOURNAL_CORRECTION_INTEGRITY', 409);
  if (!child) throw new JournalCorrectionError('La corrección ya fue creada y no está disponible. No se recreó el registro.', 'JOURNAL_CORRECTION_GONE', 410);
  return { child, receipt };
}
export async function prepareJournalCorrection(prisma, { scope: rawScope, sourceId }) {
  const scope = trustedScope(rawScope); correctionIdentifier(sourceId);
  return prisma.$transaction(async tx => {
    const project = await tx.project.findFirst({ where: { id: scope.projectId, organizationId: scope.organizationId }, select: { id: true, status: true } });
    if (!project) throw new JournalCorrectionError('Obra no disponible.', 'JOURNAL_CORRECTION_NOT_FOUND', 404);
    const source = await rejectedSource(tx, scope.projectId, sourceId);
    const existing = await existingCorrection(tx, scope, sourceId);
    return { canCreate: isOperationalProjectWriteStatus(project.status), source: { ...record(source), version: sourceVersion(source) }, existing: existing ? record(existing.child) : null };
  }, { isolationLevel: 'RepeatableRead' });
}
export async function createJournalCorrection(prisma, { scope: rawScope, actorId, sourceId, operationKey, input }) {
  const scope = trustedScope(rawScope); correctionIdentifier(actorId); correctionIdentifier(sourceId);
  const command = normalizeJournalCorrection(input);
  if (typeof operationKey !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(operationKey)) throw new JournalCorrectionError('La solicitud requiere una clave de operación válida.');
  const fingerprint = digest(command);
  return runOperationalProjectMutation(prisma, scope, async tx => {
    const source = await rejectedSource(tx, scope.projectId, sourceId);
    if (source.revision !== command.expectedRevision || sourceVersion(source) !== command.sourceVersion) throw new JournalCorrectionError('El parte de origen cambió. Revisalo nuevamente antes de corregir.', 'JOURNAL_CORRECTION_SOURCE_CHANGED', 409);
    const existing = await existingCorrection(tx, scope, sourceId);
    if (existing) {
      if (existing.receipt.metadata?.fingerprint !== fingerprint) throw new JournalCorrectionError('Este parte ya tiene una corrección con otro contenido. Consultá el registro existente.', 'JOURNAL_CORRECTION_ALREADY_EXISTS', 409);
      return { dailyLog: { ...record(existing.child), correctionOf: relation(source) }, source: relation(source), replayed: true };
    }
    if (command.title === source.title.trim() && command.summary === source.summary.trim().replace(/\r\n/g, '\n') && command.taskId === (source.taskId || null)) throw new JournalCorrectionError('Modificá el contenido o la tarea para responder a la observación.', 'JOURNAL_CORRECTION_UNCHANGED');
    if (command.taskId && !(await tx.task.findFirst({ where: { id: command.taskId, projectId: scope.projectId, type: 'TASK', metadata: { path: ['source'], equals: 'canonical-task-v1' } }, select: { id: true } }))) throw new JournalCorrectionError('La tarea no está disponible dentro de esta obra.', 'JOURNAL_CORRECTION_TASK_NOT_FOUND', 404);
    const id = childId(scope.organizationId, scope.projectId, sourceId);
    const child = await tx.dailyLog.create({ data: { id, projectId: scope.projectId, title: command.title, summary: command.summary,
      taskId: command.taskId, workDate: source.workDate, authorWorkerId: source.authorWorkerId, status: 'DRAFT' } });
    await tx.auditLog.create({ data: { id: receiptId(scope.projectId, sourceId), organizationId: scope.organizationId, actorId,
      action: ACTION, entityType: 'DailyLog', entityId: id, metadata: { version: 1, projectId: scope.projectId,
        sourceId, sourceRevision: source.revision, correctionId: id, sourceVersion: command.sourceVersion, fingerprint,
        previousTaskId: source.taskId || null, taskId: child.taskId || null, operationKeyHash: digest(operationKey) } } });
    return { dailyLog: { ...record(child), correctionOf: relation(source) }, source: relation(source), replayed: false };
  });
}

// Bounded provenance lookup. Follow only records that remain in this project.
export async function withJournalCorrectionLinks(prisma, { organizationId, projectId, journal }) {
  correctionIdentifier(projectId);
  const logs = journal.dailyLogs || [];
  const rejectedIds = logs.filter(row => row.status === 'REJECTED').map(row => row.id);
  const childIds = logs.filter(row => row.id.startsWith('jcor_')).map(row => row.id);
  if (!rejectedIds.length && !childIds.length) return journal;
  correctionIdentifier(organizationId);
  const receipts = await prisma.auditLog.findMany({ where: { organizationId, action: ACTION, entityType: 'DailyLog',
    metadata: { path: ['projectId'], equals: projectId }, OR: [{ id: { in: rejectedIds.map(id => receiptId(projectId, id)) } }, { entityId: { in: childIds } }] },
    take: Math.min(logs.length * 2, 200), select: { entityId: true, metadata: true } });
  const links = receipts.filter(row => row.entityId === row.metadata?.correctionId).map(row => row.metadata).filter(meta => meta?.version === 1 && meta.projectId === projectId
    && typeof meta.sourceId === 'string' && typeof meta.correctionId === 'string' && meta.sourceId !== meta.correctionId);
  const ids = [...new Set(links.flatMap(link => [link.sourceId, link.correctionId]))];
  if (!ids.length) return journal;
  const linkedRecords = await prisma.dailyLog.findMany({ where: { projectId, id: { in: ids } },
    take: Math.min(ids.length, 400), select: { id: true, title: true, status: true, revision: true } });
  const available = new Map(linkedRecords.map(row => [row.id, row]));
  const validLinks = links.filter(link => available.has(link.sourceId) && available.has(link.correctionId));
  return { ...journal, dailyLogs: logs.map(row => {
    const parent = validLinks.find(link => link.correctionId === row.id);
    const successor = validLinks.find(link => link.sourceId === row.id);
    return { ...row, ...(parent ? { correctionOf: relation(available.get(parent.sourceId)) } : {}),
      ...(successor ? { correction: relation(available.get(successor.correctionId)) } : {}) };
  }) };
}
