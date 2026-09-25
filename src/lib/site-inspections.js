import { createHash } from 'node:crypto';

export const INSPECTION_TEMPLATES = Object.freeze([
  { key: 'SEGURIDAD', title: 'Seguridad e higiene', items: ['Protecciones colectivas', 'Equipos de protección personal', 'Accesos y circulación', 'Emergencias y señalización'] },
  { key: 'HORMIGONADO', title: 'Pre-hormigonado', items: ['Planos y revisión vigente', 'Armaduras y recubrimientos según proyecto', 'Encofrado y apuntalamiento', 'Plan de recepción y ensayos'] },
  { key: 'ELECTRICA', title: 'Instalación eléctrica', items: ['Documentación y circuitos', 'Protecciones eléctricas', 'Puesta a tierra y mediciones', 'Identificación y accesibilidad'] },
  { key: 'SANITARIA', title: 'Instalación sanitaria', items: ['Materiales y trazado', 'Uniones y soportes', 'Ensayo según procedimiento', 'Registro de resultados'] },
  { key: 'TERMINACIONES', title: 'Terminaciones', items: ['Superficies y encuentros', 'Carpinterías y sellados', 'Instalaciones y accesorios', 'Pendientes de entrega'] },
].map(template => Object.freeze({ ...template, version: 1, items: Object.freeze(template.items.map((label, index) => Object.freeze({ key: 'item-' + (index + 1), label }))) })));
export const INSPECTION_STATUSES = Object.freeze(['DRAFT', 'SUBMITTED', 'APPROVED', 'OBSERVED', 'REJECTED']);
export const INSPECTION_RESULTS = Object.freeze(['PENDING', 'PASS', 'FAIL', 'NA']);
export class InspectionError extends Error {
  constructor(message, code = 'INSPECTION_INVALID', status = 422) {
    super(message); this.name = 'InspectionError'; this.code = code; this.status = status;
  }
}
export function inspectionErrorResponse(error) {
  return error instanceof InspectionError ? Response.json({ error: error.message, code: error.code }, { status: error.status, headers: { 'Cache-Control': 'private, no-store' } }) : null;
}
function text(value, field, max, required = false) {
  if (value !== undefined && value !== null && typeof value !== 'string') throw new InspectionError(field + ': formato inválido.');
  const result = (value || '').trim();
  if (result.length > max || (required && !result)) throw new InspectionError(field + ': completá un valor de hasta ' + max + ' caracteres.');
  return result;
}
export function inspectionTemplate(key) {
  const template = INSPECTION_TEMPLATES.find(item => item.key === key);
  if (!template) throw new InspectionError('Seleccioná una plantilla válida.');
  return template;
}
export function trustedInspectionScope(scope) {
  return {
    organizationId: text(scope?.organizationId, 'Empresa', 190, true),
    projectId: text(scope?.projectId, 'Obra', 190, true),
  };
}
export function normalizeInspectionDraft(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new InspectionError('La inspección debe ser un objeto.');
  const template = inspectionTemplate(input.templateKey);
  const supplied = input.checklist ?? template.items.map(item => ({ key: item.key, result: 'PENDING' }));
  if (!Array.isArray(supplied) || supplied.length !== template.items.length) throw new InspectionError('El checklist debe contener todos los controles.');
  if (new Set(supplied.map(item => item?.key)).size !== template.items.length) throw new InspectionError('Hay controles duplicados.');
  const checklist = template.items.map(item => {
    const answer = supplied.find(value => value?.key === item.key);
    if (!answer || !INSPECTION_RESULTS.includes(answer.result)) throw new InspectionError('Resultado de control inválido.');
    const criterion = text(answer.criterion, 'Criterio', 1000);
    const observation = text(answer.observation, 'Observación', 2000);
    if (['FAIL', 'NA'].includes(answer.result) && !observation) throw new InspectionError('Una no conformidad o un control no aplicable requiere justificación.');
    return { key: item.key, label: item.label, result: answer.result, criterion, observation };
  });
  return {
    title: text(input.title, 'Título', 180, true), location: text(input.location, 'Ubicación o elemento', 240, true),
    templateKey: template.key, templateVersion: template.version,
    technicalReference: text(input.technicalReference, 'Documento y revisión', 500),
    notes: text(input.notes, 'Notas', 4000), checklist,
  };
}
export function assertInspectionSubmittable(record) {
  if (!record.technicalReference) throw new InspectionError('Indicá el plano, pliego o procedimiento y su revisión.');
  if (record.checklist.some(item => item.result === 'PENDING' || !item.criterion)) throw new InspectionError('Completá cada control y su criterio de aceptación antes de enviar.');
}
export function resolveInspectionMutation(record, input, { canReview = false } = {}) {
  if (!input || !Number.isSafeInteger(input.version) || input.version < 1) throw new InspectionError('La versión de la inspección es obligatoria.');
  if (record.version !== input.version) throw new InspectionError('La inspección cambió. Actualizá antes de guardar.', 'INSPECTION_STALE', 409);
  if (input.action === 'SAVE_DRAFT') {
    if (record.status !== 'DRAFT') throw new InspectionError('Sólo se puede editar un borrador.', 'INSPECTION_LOCKED', 409);
    if (input.draft?.templateKey !== record.templateKey) throw new InspectionError('La plantilla no puede cambiar después del alta.');
    return { ...normalizeInspectionDraft(input.draft), status: 'DRAFT', reviewNotes: null, reviewedAt: null, reviewedById: null };
  }
  if (input.action === 'SUBMIT') {
    if (record.status !== 'DRAFT') throw new InspectionError('La inspección no es un borrador.', 'INSPECTION_LOCKED', 409);
    assertInspectionSubmittable(record);
    return { status: 'SUBMITTED' };
  }
  if (input.action === 'REOPEN') {
    if (record.status !== 'OBSERVED') throw new InspectionError('Sólo se pueden corregir inspecciones observadas.', 'INSPECTION_LOCKED', 409);
    return { status: 'DRAFT', reviewNotes: null, reviewedAt: null, reviewedById: null };
  }
  if (['APPROVE', 'OBSERVE', 'REJECT'].includes(input.action)) {
    if (!canReview) throw new InspectionError('Se requiere permiso de Dirección para emitir el dictamen.', 'INSPECTION_REVIEW_FORBIDDEN', 403);
    if (record.status !== 'SUBMITTED') throw new InspectionError('El dictamen requiere una inspección enviada a revisión.', 'INSPECTION_LOCKED', 409);
    assertInspectionSubmittable(record);
    if (input.action === 'APPROVE' && record.checklist.some(item => item.result === 'FAIL')) throw new InspectionError('No se puede aprobar una inspección con no conformidades.');
    const reviewNotes = text(input.reviewNotes, 'Dictamen y alcance', 4000, true);
    return { status: { APPROVE: 'APPROVED', OBSERVE: 'OBSERVED', REJECT: 'REJECTED' }[input.action], reviewNotes };
  }
  throw new InspectionError('Acción de inspección no admitida.');
}
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
export function inspectionHash(value) { return createHash('sha256').update(canonical(value)).digest('hex'); }
export function inspectionSnapshot(record) {
  return {
    id: record.id, organizationId: record.organizationId, projectId: record.projectId,
    version: record.version, title: record.title, location: record.location,
    templateKey: record.templateKey, templateVersion: record.templateVersion,
    technicalReference: record.technicalReference, notes: record.notes, checklist: record.checklist,
    status: record.status, createdById: record.createdById,
    reviewedById: record.reviewedById ?? null, reviewedAt: record.reviewedAt ? new Date(record.reviewedAt).toISOString() : null,
    reviewNotes: record.reviewNotes ?? null,
  };
}
