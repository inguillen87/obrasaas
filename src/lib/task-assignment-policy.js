const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$/;
export const ASSIGNMENT_LABELS = Object.freeze({ PLANNED: 'Planificada', ACTIVE: 'En curso', ENDED: 'Finalizada', CANCELLED: 'Cancelada' });
export const ASSIGNMENT_TRANSITIONS = Object.freeze({ PLANNED: Object.freeze(['ACTIVE','CANCELLED']), ACTIVE: Object.freeze(['ENDED','CANCELLED']), ENDED: Object.freeze([]), CANCELLED: Object.freeze([]) });
export class TaskAssignmentError extends Error {
  constructor(message, code = 'ASSIGNMENT_INVALID', status = 422) { super(message); this.name = 'TaskAssignmentError'; this.code = code; this.status = status; }
}
export function assignmentId(value) {
  if (typeof value !== 'string' || !ID.test(value)) throw new TaskAssignmentError('El identificador de la asignación o su contexto no es válido.');
  return value;
}
function revision(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TaskAssignmentError('La versión consultada es obligatoria.');
  return value;
}
function fields(input, allowed) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !allowed.includes(key))) throw new TaskAssignmentError('La solicitud contiene campos no admitidos.');
}
function day(value) {
  if (value === '' || value == null) return null;
  if (typeof value !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) throw new TaskAssignmentError('Usá una fecha de calendario válida.');
  const date = new Date(value + 'T00:00:00.000Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== value) throw new TaskAssignmentError('La fecha de calendario no existe.');
  return date.toISOString();
}
export function normalizeAssignmentPlan(input) {
  fields(input, ['taskId','expectedTaskRevision','ownerKind','ownerId','startsOn','endsOn']);
  if (!['WORKER','TEAM'].includes(input.ownerKind)) throw new TaskAssignmentError('Elegí una persona o una cuadrilla.');
  const startsAt = day(input.startsOn), endsAt = day(input.endsOn);
  if (endsAt && (!startsAt || endsAt < startsAt)) throw new TaskAssignmentError('La fecha final requiere un inicio anterior o del mismo día.');
  return { taskId: assignmentId(input.taskId), expectedTaskRevision: revision(input.expectedTaskRevision),
    workerId: input.ownerKind === 'WORKER' ? assignmentId(input.ownerId) : null,
    teamId: input.ownerKind === 'TEAM' ? assignmentId(input.ownerId) : null, startsAt, endsAt };
}
export function normalizeAssignmentDecision(input) {
  fields(input, ['expectedRevision','status','note']);
  if (!['ACTIVE','ENDED','CANCELLED'].includes(input.status)) throw new TaskAssignmentError('La acción solicitada no está disponible.');
  if (typeof input.note !== 'string' || !input.note.trim() || input.note.trim().length > 1000 || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(input.note)) throw new TaskAssignmentError('Explicá el cambio en hasta 1.000 caracteres.');
  return { expectedRevision: revision(input.expectedRevision), status: input.status, note: input.note.trim().replace(/\r\n/g,'\n') };
}
export function assignmentFailure(error) {
  return error instanceof TaskAssignmentError ? Response.json({ error: error.message, code: error.code }, { status: error.status }) : null;
}
export function assignmentRecordMatches(row,projectId,original=null) {
  return Boolean(row&&typeof row.id==='string'&&ID.test(row.id)&&row.projectId===projectId&&typeof row.taskId==='string'&&ID.test(row.taskId)
    &&Object.hasOwn(ASSIGNMENT_LABELS,row.status)&&Number.isSafeInteger(row.revision)&&row.revision>=0
    &&(!row.lastDecision||typeof row.lastDecision.note==='string'&&row.lastDecision.revision===row.revision&&row.lastDecision.status===row.status)
    &&(!original||row.id===original.id&&row.taskId===original.taskId&&row.revision>=original.revision));
}
function creationReceiptMatches(receipt,row,command) {
  return Boolean(receipt?.schemaVersion===1&&receipt.assignmentId===row?.id
    &&['taskId','expectedTaskRevision','workerId','teamId','startsAt','endsAt'].every(field=>receipt[field]===command[field]));
}
function calendarPeriod(row) {
  const valid=value=>value===null||typeof value==='string'&&/^20\d{2}-\d{2}-\d{2}T00:00:00\.000Z$/.test(value)
    &&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
  return valid(row.startsAt)&&valid(row.endsAt)&&(!row.endsAt||row.startsAt&&row.endsAt>=row.startsAt);
}
export function confirmAssignmentPlan(payload,command,scope) {
  const row=payload?.assignment;
  const samePeriod=row?.startsAt===command.startsAt&&row?.endsAt===command.endsAt;
  const hasReceipt=Boolean(payload&&Object.hasOwn(payload,'creationReceipt'));
  const verifiedReceipt=creationReceiptMatches(payload?.creationReceipt,row,command);
  if(payload?.context?.organizationId!==scope.organizationId||payload.context.projectId!==scope.projectId||!assignmentRecordMatches(row,scope.projectId)
    ||typeof payload.replayed!=='boolean'||row.taskId!==command.taskId||row.workerId!==command.workerId||row.teamId!==command.teamId
    ||hasReceipt&&!verifiedReceipt||!samePeriod&&(!payload.replayed||row.revision<1||!verifiedReceipt||!calendarPeriod(row))
    ||!payload.replayed&&(row.status!=='PLANNED'||row.revision!==0)) {
    throw new TaskAssignmentError('La respuesta no confirmó la asignación solicitada. Conservá el intento para verificarlo.','ASSIGNMENT_UNCONFIRMED',503);
  }
  return row;
}
export function assignmentPlanFeedback({replayed=false,periodChanged=false}={}) {
  if(replayed&&periodChanged)return 'Se recuperó la asignación original. Sus fechas cambiaron después: la tarjeta muestra el período vigente, sin restaurar el anterior ni crear otra asignación.';
  if(replayed)return 'Se recuperó la asignación ya guardada. No se creó otra ni se reinició su estado; revisá su tarjeta actual.';
  return 'Asignación confirmada. Continuá desde su tarjeta; no se modificó el avance de la actividad.';
}
