const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$/;
export class JournalTaskLinkError extends Error {
  constructor(message, code = 'JOURNAL_TASK_LINK_INVALID', status = 422) { super(message); this.code = code; this.status = status; }
}
export function journalTaskIdentifier(value) {
  if (typeof value !== 'string' || !ID.test(value)) throw new JournalTaskLinkError('El identificador no es válido.');
  return value;
}
export function normalizeJournalTaskLink(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !['taskId', 'expectedRevision'].includes(key))) throw new JournalTaskLinkError('La solicitud de vinculación no es válida.');
  const taskId = journalTaskIdentifier(input.taskId);
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 || input.expectedRevision >= 2147483647) throw new JournalTaskLinkError('La versión del parte no es válida.');
  return { taskId, expectedRevision: input.expectedRevision };
}
export function confirmedJournalTaskLink(payload, { recordId, projectId, taskId, expectedRevision }) {
  const row = payload?.dailyLog, link = payload?.assignment;
  if (!row || row.id !== recordId || row.projectId !== projectId || row.taskId !== taskId
    || !['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'].includes(row.status)
    || !Number.isSafeInteger(row.revision) || row.revision < expectedRevision + 1
    || link?.taskId !== taskId || link?.appliedRevision !== expectedRevision + 1 || typeof link?.replayed !== 'boolean') {
    throw new JournalTaskLinkError('No se pudo confirmar la vinculación. Conservá este intento y consultá el estado del parte antes de repetirlo.', 'JOURNAL_TASK_LINK_UNCONFIRMED', 502);
  }
  return row;
}
export function journalTaskLinkErrorResponse(error) {
  return error instanceof JournalTaskLinkError ? Response.json({ error: error.message, code: error.code }, { status: error.status, headers: { 'Cache-Control': 'private, no-store' } }) : null;
}
