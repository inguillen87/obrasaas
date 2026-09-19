import { createHash } from 'node:crypto';
import { runOperationalProjectMutation } from './project-write-policy.js';
import { JournalTaskLinkError, journalTaskIdentifier, normalizeJournalTaskLink } from './journal-task-link-policy.js';
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const iso = value => value?.toISOString?.() || null;
function serialize(row) { return { id: row.id, projectId: row.projectId, taskId: row.taskId, authorWorkerId: row.authorWorkerId || null, title: row.title, summary: row.summary, workDate: iso(row.workDate)?.slice(0, 10), status: row.status, revision: row.revision, rejectionReason: row.rejectionReason || null, submittedAt: iso(row.submittedAt), approvedAt: iso(row.approvedAt), createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) }; }
export async function linkJournalDraftToTask(prisma, { scope, actorId, recordId, operationKey, input }) {
  const organizationId = journalTaskIdentifier(scope?.organizationId), projectId = journalTaskIdentifier(scope?.projectId);
  journalTaskIdentifier(actorId); journalTaskIdentifier(recordId);
  const command = normalizeJournalTaskLink(input);
  if (typeof operationKey !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(operationKey)) throw new JournalTaskLinkError('La operación necesita una clave de reintento válida.');
  const receiptId = 'journal_task_' + digest([organizationId, projectId, actorId, recordId, operationKey]);
  const fingerprint = digest(command);
  return runOperationalProjectMutation(prisma, { organizationId, projectId }, async tx => {
    const row = await tx.dailyLog.findFirst({ where: { id: recordId, projectId } });
    if (!row) throw new JournalTaskLinkError('El parte no está disponible en esta obra.', 'JOURNAL_TASK_LINK_NOT_FOUND', 404);
    const receipt = await tx.auditLog.findFirst({ where: { id: receiptId, organizationId, actorId, entityId: recordId, entityType: 'DailyLog', action: 'progress.daily_log.task_linked' } });
    if (receipt) {
      if (receipt.metadata?.fingerprint !== fingerprint) throw new JournalTaskLinkError('La clave de operación ya se usó con otro contenido.', 'JOURNAL_TASK_LINK_REPLAY_CONFLICT', 409);
      if (row.taskId !== command.taskId) throw new JournalTaskLinkError('El parte fue vinculado nuevamente después de este intento. Consultá su estado actual.', 'JOURNAL_TASK_LINK_CHANGED', 409);
      return { dailyLog: serialize(row), assignment: { taskId: command.taskId, appliedRevision: receipt.metadata.appliedRevision, replayed: true } };
    }
    if (row.status !== 'DRAFT') throw new JournalTaskLinkError('Sólo se puede vincular un borrador. Un parte enviado o decidido conserva su tarea.', 'JOURNAL_TASK_LINK_LOCKED', 409);
    if (row.revision !== command.expectedRevision) throw new JournalTaskLinkError('El borrador cambió. Actualizá la bitácora antes de vincularlo.', 'JOURNAL_TASK_LINK_STALE', 409);
    if (row.taskId === command.taskId) throw new JournalTaskLinkError('El parte ya está vinculado a esta tarea.', 'JOURNAL_TASK_LINK_UNCHANGED', 409);
    const task = await tx.task.findFirst({ where: { id: command.taskId, projectId, type: 'TASK', metadata: { path: ['source'], equals: 'canonical-task-v1' } }, select: { id: true } });
    if (!task) throw new JournalTaskLinkError('La tarea no está disponible en esta obra.', 'JOURNAL_TASK_LINK_TASK_NOT_FOUND', 404);
    const update = await tx.dailyLog.updateMany({ where: { id: recordId, projectId, status: 'DRAFT', revision: command.expectedRevision }, data: { taskId: task.id, revision: { increment: 1 } } });
    if (update.count !== 1) throw new JournalTaskLinkError('El borrador cambió durante la vinculación.', 'JOURNAL_TASK_LINK_STALE', 409);
    const appliedRevision = command.expectedRevision + 1;
    await tx.auditLog.create({ data: { id: receiptId, organizationId, actorId, action: 'progress.daily_log.task_linked', entityType: 'DailyLog', entityId: recordId,
      metadata: { projectId, previousTaskId: row.taskId || null, taskId: task.id, expectedRevision: command.expectedRevision, appliedRevision, fingerprint } } });
    const saved = await tx.dailyLog.findFirst({ where: { id: recordId, projectId } });
    return { dailyLog: serialize(saved), assignment: { taskId: task.id, appliedRevision, replayed: false } };
  });
}
