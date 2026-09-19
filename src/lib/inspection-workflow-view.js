export const INSPECTION_STATUS_LABELS = Object.freeze({
  DRAFT: 'Borrador', SUBMITTED: 'En revisión', APPROVED: 'Aprobada',
  OBSERVED: 'Observada', REJECTED: 'Rechazada',
});
export const INSPECTION_ACTION_LABELS = Object.freeze({
  CREATE: 'Borrador creado', SAVE_DRAFT: 'Borrador guardado',
  SUBMIT: 'Enviada a revisión', APPROVE: 'Aprobada',
  OBSERVE: 'Observada', REJECT: 'Rechazada', REOPEN: 'Reabierta para corregir',
});
const clean = value => typeof value === 'string' ? value.trim() : '';
export function inspectionDraftView(source = {}) {
  return {
    templateKey: source.templateKey || '', title: source.title || '',
    location: source.location || '', technicalReference: source.technicalReference || '',
    notes: source.notes || '', checklist: (source.checklist || []).map(item => ({
      key: item.key, result: item.result || 'PENDING',
      criterion: item.criterion || '', observation: item.observation || '',
    })),
  };
}
export function inspectionDraftChanged(draft, baseline) {
  return JSON.stringify(inspectionDraftView(draft)) !== JSON.stringify(inspectionDraftView(baseline));
}
export function inspectionReadiness(draft = {}) {
  const issues = [];
  if (!clean(draft.title)) issues.push('Completá el título.');
  if (!clean(draft.location)) issues.push('Indicá la ubicación o el elemento.');
  if (!clean(draft.technicalReference)) issues.push('Indicá el documento y su revisión.');
  const checklist = Array.isArray(draft.checklist) ? draft.checklist : [];
  let completed = 0;
  for (const [index, item] of checklist.entries()) {
    const prefix = 'Control ' + (index + 1) + ': ';
    const validResult = ['PASS', 'FAIL', 'NA'].includes(item.result);
    const criterion = Boolean(clean(item.criterion));
    const justified = !['FAIL', 'NA'].includes(item.result) || Boolean(clean(item.observation));
    if (!validResult) issues.push(prefix + 'seleccioná un resultado.');
    if (!criterion) issues.push(prefix + 'falta el criterio de aceptación.');
    if (!justified) issues.push(prefix + 'justificá el resultado.');
    if (validResult && criterion && justified) completed += 1;
  }
  if (!checklist.length) issues.push('La inspección no tiene controles.');
  return {
    issues, completed, total: checklist.length, ready: issues.length === 0,
    failures: checklist.filter(item => item.result === 'FAIL').length,
  };
}
export function inspectionNextStep({ record, draft, dirty, canManage, canReview }) {
  const readiness = inspectionReadiness(draft);
  if (!record) return canManage
    ? { title: 'Prepará y guardá el primer borrador', detail: 'El registro se crea dentro de la obra activa; los controles pueden completarse después.' }
    : { title: 'Seleccioná una inspección', detail: 'Tu acceso permite consultar registros, no crear ni modificar inspecciones.' };
  if (record.status === 'DRAFT') return {
    title: dirty ? 'Guardá los cambios' : readiness.ready ? 'Lista para enviar a revisión' : 'Completá los controles pendientes',
    detail: canManage ? 'Primero se guarda, después se envía a Dirección. Enviar no significa aprobar.' : 'Un responsable con permiso de edición debe completar y enviar este borrador.',
  };
  if (record.status === 'SUBMITTED') return {
    title: canReview ? 'Emití el dictamen de Dirección' : 'Pendiente de Dirección',
    detail: 'El registro enviado no se edita. Una observación permite reabrirlo; una decisión final conserva la versión cerrada.',
  };
  if (record.status === 'OBSERVED') return {
    title: canManage ? 'Reabrí, corregí y volvé a enviar' : 'Corrección pendiente',
    detail: 'Consultá el dictamen antes de corregir. La observación permanece en el historial.',
  };
  if (record.status === 'APPROVED' || record.status === 'REJECTED') return {
    title: 'Dictamen cerrado · solo lectura',
    detail: 'Consultá el historial o descargá el registro. Este cierre no permite sobrescribir la inspección.',
  };
  return { title: 'Revisá el estado del registro', detail: 'Actualizá los datos antes de continuar.' };
}
