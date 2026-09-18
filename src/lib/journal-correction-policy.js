const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$/;
const FIELDS = new Set(['expectedRevision', 'sourceVersion', 'title', 'summary', 'taskId']);
export class JournalCorrectionError extends Error {
  constructor(message, code = 'JOURNAL_CORRECTION_INVALID', status = 422) {
    super(message); this.name = 'JournalCorrectionError'; this.code = code; this.status = status;
  }
}
export function correctionIdentifier(value) {
  if (typeof value !== 'string' || !ID.test(value)) throw new JournalCorrectionError('El identificador del registro o contexto no es válido.');
  return value;
}
function text(value, label, maximum, multiline = false) {
  if (typeof value !== 'string') throw new JournalCorrectionError(label + ': completá el campo.');
  const result = value.trim().replace(/\r\n/g, '\n');
  const forbidden = multiline ? /[\u0000-\u0008\u000b-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/;
  if (!result || result.length > maximum || forbidden.test(result)) throw new JournalCorrectionError(label + ': usá hasta ' + maximum + ' caracteres válidos.');
  return result;
}
export function normalizeJournalCorrection(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !FIELDS.has(key))) throw new JournalCorrectionError('La corrección contiene campos no admitidos.');
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) throw new JournalCorrectionError('La versión del parte es obligatoria.');
  if (typeof input.sourceVersion !== 'string' || !/^[a-f0-9]{64}$/.test(input.sourceVersion)) throw new JournalCorrectionError('Volvé a consultar el parte antes de corregirlo.');
  return { expectedRevision: input.expectedRevision, sourceVersion: input.sourceVersion,
    title: text(input.title, 'Título', 220), summary: text(input.summary, 'Detalle corregido', 10000, true),
    taskId: input.taskId == null || input.taskId === '' ? null : correctionIdentifier(input.taskId) };
}
export function correctionErrorResponse(error) {
  return error instanceof JournalCorrectionError ? Response.json({ error: error.message, code: error.code }, { status: error.status }) : null;
}
