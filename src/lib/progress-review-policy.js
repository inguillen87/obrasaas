export const PROGRESS_REVIEW_NOTE_LIMIT = 2000;
export class ProgressReviewPolicyError extends Error {
  constructor(message, code = 'PROGRESS_REVIEW_INVALID', status = 422) {
    super(message); this.name = 'ProgressReviewPolicyError'; this.code = code; this.status = status;
  }
}
export function normalizeProgressReviewNote(kind, status, value) {
  if (!['DAILY_LOG', 'EVIDENCE'].includes(kind) || !['SUBMITTED', 'APPROVED', 'REJECTED'].includes(status)) {
    throw new ProgressReviewPolicyError('La decisión de revisión no es válida.');
  }
  if (value != null && typeof value !== 'string') throw new ProgressReviewPolicyError('El fundamento debe ser texto.');
  const note = (value || '').trim().replace(/\r\n/g, '\n');
  if (note.length > PROGRESS_REVIEW_NOTE_LIMIT || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(note)) {
    throw new ProgressReviewPolicyError('El fundamento admite hasta 2000 caracteres válidos.');
  }
  if (status === 'REJECTED' && !note) {
    throw new ProgressReviewPolicyError('Indicá el motivo del rechazo para que la persona responsable sepa qué corregir.', 'PROGRESS_REVIEW_NOTE_REQUIRED');
  }
  if (kind === 'DAILY_LOG' && status !== 'REJECTED' && note) {
    throw new ProgressReviewPolicyError('Este parte admite fundamento al rechazar. No se guardó una nota fuera de ese alcance.', 'PROGRESS_REVIEW_NOTE_NOT_SUPPORTED');
  }
  return note || null;
}
export function confirmedProgressReview(body, { item, kind, status, projectId, note }) {
  const result = kind === 'DAILY_LOG' ? body?.dailyLog : body?.evidence;
  const reason = kind === 'DAILY_LOG' ? result?.rejectionReason : result?.reviewNote;
  if (!result || result.id !== item.id || result.projectId !== projectId || result.status !== status
    || result.revision !== item.revision + 1 || (status === 'REJECTED' && reason !== note)
    || (kind === 'EVIDENCE' && (reason || null) !== (note || null))) {
    throw new ProgressReviewPolicyError('La respuesta no permite confirmar la revisión. Conservá el fundamento y verificá el registro antes de volver a decidir.', 'PROGRESS_RESPONSE_UNCONFIRMED', 502);
  }
  return result;
}

export function progressReviewAttachmentHref(item) {
  if (!item?.attachment?.available || item.attachment.restricted || typeof item.id !== 'string') return null;
  const allowed = ['/api/progress/' + encodeURIComponent(item.id) + '/attachment'];
  if (typeof item.source?.messageId === 'string' && item.source.messageId) allowed.push('/api/evidence/' + encodeURIComponent(item.source.messageId));
  return allowed.includes(item.attachment.href) ? item.attachment.href : null;
}
