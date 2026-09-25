import { historyId, FlowHistoryError } from './proactive-flow-history-policy.js';
const fields = (value, names) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === names.length && names.every(key => Object.hasOwn(value, key));
const instant = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const statuses = ['PENDING', 'VERIFIED', 'REVIEW_REQUIRED', 'EXPIRED', 'VOIDED', 'MANUAL_APPROVED'];
export function flowAttendanceReceiptMatches(receipt, session) {
  try {
    return Boolean(fields(receipt, ['version','entryId','projectId','workerId','sessionId']) && receipt.version === 1
      && historyId(receipt.entryId) && historyId(session.projectId) && historyId(session.workerId) && uuid(session.id)
      && session.blueprintKey === 'shift-check-in' && receipt.projectId === session.projectId
      && receipt.workerId === session.workerId && receipt.sessionId === session.id);
  } catch { return false; }
}
// Called with the attendance domain result, never with a worker-supplied entry id.
export function buildFlowAttendanceReceipt(entry, session) {
  const receipt = { version: 1, entryId: entry?.id, projectId: session?.projectId, workerId: session?.workerId, sessionId: session?.id };
  if (!flowAttendanceReceiptMatches(receipt, session) || entry?.projectId !== session.projectId
    || entry?.workerId !== session.workerId || entry?.eventType !== 'CHECK_IN') {
    throw new FlowHistoryError('No se pudo vincular el resultado del ingreso.', 'WHATSAPP_FLOW_ATTENDANCE_BINDING_INVALID', 503);
  }
  return receipt;
}
export function normalizeFlowAttendanceQuery(params) {
  if (!(params instanceof URLSearchParams) || params.get('mode') !== 'attendance'
    || [...params.keys()].some(key => !['projectId','mode','messageId'].includes(key) || params.getAll(key).length !== 1)) {
    throw new FlowHistoryError('La consulta de ingreso no es válida.');
  }
  return { messageId: historyId(params.get('messageId')) };
}
export function flowAttendanceMatches(value, scope, sourceMessageId) {
  try {
    historyId(sourceMessageId); [scope.organizationId,scope.projectId,scope.conversationId].forEach(historyId);
    if (!fields(value, ['context','sourceMessageId','observedAt','state','entry'])
      || !fields(value.context, ['organizationId','projectId','conversationId'])
      || Object.keys(value.context).some(key => value.context[key] !== scope[key])
      || value.sourceMessageId !== sourceMessageId || !instant(value.observedAt)
      || !['available','not_recorded','unavailable','unlinked','unsupported'].includes(value.state)) return false;
    if (value.state !== 'available') return value.entry === null;
    const entry = value.entry;
    return Boolean(fields(entry, ['id','verificationStatus','occurredAt','locationDeadlineAt','shift'])
      && historyId(entry.id) && statuses.includes(entry.verificationStatus) && instant(entry.occurredAt) && entry.occurredAt <= value.observedAt
      && instant(entry.locationDeadlineAt) && entry.locationDeadlineAt > entry.occurredAt
      && (entry.shift === null
        ? ['PENDING','EXPIRED','VOIDED'].includes(entry.verificationStatus)
        : fields(entry.shift, ['id','status','revision','workDate']) && historyId(entry.shift.id)
          && ['OPEN','PENDING_CLOSE','CLOSED','VOIDED'].includes(entry.shift.status)
          && Number.isSafeInteger(entry.shift.revision) && entry.shift.revision >= 0
          && typeof entry.shift.workDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.shift.workDate)
          && instant(entry.shift.workDate + 'T00:00:00.000Z')
          && !['PENDING','EXPIRED'].includes(entry.verificationStatus)));
  } catch { return false; }
}
export function flowAttendancePresentation(entry, observedAt) {
  if (entry.verificationStatus === 'PENDING') return entry.locationDeadlineAt <= observedAt
    ? { label: 'Plazo de ubicación vencido', detail: 'El registro sigue pendiente en la base. Esta consulta no lo completa ni cambia su estado.' }
    : { label: 'Ubicación pendiente', detail: 'El formulario no acredita presencia: falta completar y comprobar la ubicación.' };
  return {
    VERIFIED: { label: 'Ubicación verificada', detail: 'La ubicación fue validada por el módulo de asistencia. No certifica identidad, horas pagables ni aprobación de nómina.' },
    REVIEW_REQUIRED: { label: 'Requiere revisión de ubicación', detail: 'El ingreso tiene un desvío que debe revisarse en Asistencia; no se presenta como presencia validada.' },
    EXPIRED: { label: 'Ingreso pendiente vencido', detail: 'El registro venció sin completar el ingreso. No se genera otro fichaje.' },
    VOIDED: { label: 'Registro anulado', detail: 'Se conserva el vínculo histórico. No se reactiva ni reemplaza el registro.' },
    MANUAL_APPROVED: { label: 'Validación manual registrada', detail: 'La decisión pertenece al módulo de asistencia, no al formulario ni a esta consulta.' },
  }[entry.verificationStatus];
}
