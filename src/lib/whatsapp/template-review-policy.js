const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$/;
const NAME = /^[a-z0-9_]{1,512}$/;
const HASH = /^[a-f0-9]{64}$/;
const STATUS = /^[A-Z_]{2,40}$/;
const META_ID = /^\d{5,32}$/;
const KEY = /^[a-z][a-z0-9_.-]{0,63}$/;
const safeText = (value, max) => typeof value === 'string' && value.trim().length > 0
  && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);

export class TemplateReviewError extends Error {
  constructor(message, code = 'WHATSAPP_TEMPLATE_REVIEW_INVALID', status = 422) {
    super(message); this.name = 'TemplateReviewError'; this.code = code; this.status = status;
  }
}
export function normalizeTemplateReview(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).some(key => !['blueprintKey', 'expectedName', 'contentSha256', 'confirmed'].includes(key))
    || typeof input.blueprintKey !== 'string' || typeof input.expectedName !== 'string' || typeof input.contentSha256 !== 'string'
    || !KEY.test(input.blueprintKey) || !NAME.test(input.expectedName)
    || !HASH.test(input.contentSha256 || '') || input.confirmed !== true) {
    throw new TemplateReviewError('Consultá el mensaje y confirmá la plantilla exacta antes de enviarla a revisión.');
  }
  return { blueprintKey: input.blueprintKey, expectedName: input.expectedName, contentSha256: input.contentSha256, confirmed: true };
}
export function assertTemplateReviewDefinition(review, definition) {
  const input = normalizeTemplateReview(review);
  if (input.blueprintKey !== definition?.blueprintKey || input.expectedName !== definition.name
    || input.contentSha256 !== definition.contentSha256) {
    throw new TemplateReviewError('El formulario o la conexión cambiaron. Consultá de nuevo el mensaje antes de confirmar.', 'WHATSAPP_TEMPLATE_REVIEW_CHANGED', 409);
  }
  return input;
}
export function templateEntryMatches(entry) {
  const p = entry?.preview, t = entry?.template;
  return Boolean(entry && KEY.test(entry.blueprintKey || '') && NAME.test(entry.expectedName || '')
    && HASH.test(entry.contentSha256 || '') && p && safeText(p.bodyText, 1024) && safeText(p.buttonText, 25)
    && p.language === 'es_AR' && p.category === 'UTILITY' && META_ID.test(p.flowId || '')
    && /^[A-Z][A-Z0-9_]{0,29}$/.test(p.screenId || '') && ['navigate', 'data_exchange'].includes(p.flowAction)
    && (t === null || t && typeof t === 'object' && t.name === entry.expectedName
      && t.blueprintKey === entry.blueprintKey && t.language === p.language
      && t.flowId === p.flowId && t.screenId === p.screenId && STATUS.test(t.status || '')
      && STATUS.test(t.category || '') && META_ID.test(t.id || '')
      && t.canSend === (t.status === 'APPROVED' && t.category === 'UTILITY')
      && (t.rejectionReason === null || typeof t.rejectionReason === 'string' && t.rejectionReason.length <= 2000)
      && (t.lastSyncedAt === null || typeof t.lastSyncedAt === 'string' && Number.isFinite(Date.parse(t.lastSyncedAt)))));
}
export function templateCatalogMatches(payload, scope) {
  return Boolean(scope && ID.test(scope.organizationId || '') && ID.test(scope.projectId || '')
    && payload?.context?.organizationId === scope.organizationId && payload.context.projectId === scope.projectId
    && Array.isArray(payload.templates) && payload.templates.length <= 32
    && payload.templates.every(templateEntryMatches)
    && new Set(payload.templates.map(row => row.blueprintKey)).size === payload.templates.length);
}
export function templateProvisionMatches(payload, review, scope) {
  const result = payload?.result;
  return Boolean(templateCatalogMatches({ context: payload?.context, templates: result ? [result] : null }, scope)
    && typeof result.created === 'boolean' && result.template
    && result.blueprintKey === review.blueprintKey && result.expectedName === review.expectedName
    && result.contentSha256 === review.contentSha256);
}
export function templateStatusPresentation(template) {
  if (!template) return { label: 'Sin solicitar', tone: 'idle', detail: 'Revisá el mensaje antes de solicitar su aprobación.' };
  if (template.category !== 'UTILITY') return { label: 'Categoría distinta', tone: 'blocked', detail: 'Meta informa otra categoría. No se habilita como plantilla operativa de este circuito.' };
  const statuses = {
    APPROVED: ['Aprobada por Meta', 'ready', 'La plantilla está aprobada. Cada envío requiere además canal vigente, destinatario autorizado y revisión en la conversación.'],
    PENDING: ['En revisión de Meta', 'pending', 'La solicitud existe. Consultá su estado; no hace falta crear otra plantilla.'],
    IN_APPEAL: ['En apelación', 'pending', 'Meta todavía debe resolver la revisión. No está habilitada para envío.'],
    PAUSED: ['Pausada por Meta', 'blocked', 'No se puede usar mientras esté pausada. Revisá la situación de esta plantilla en Meta.'],
    REJECTED: ['Rechazada por Meta', 'blocked', 'La solicitud fue rechazada. Revisá el motivo; no se enviará a trabajadores.'],
    DISABLED: ['Deshabilitada por Meta', 'blocked', 'No está disponible para envío. Consultá su estado y revisá la cuenta.'],
    MISSING: ['No encontrada en Meta', 'pending', 'La última consulta no encontró la versión esperada. No equivale a una plantilla aprobada.'],
    DELETED: ['Eliminada', 'blocked', 'Esta versión ya no está disponible para envío.'],
    FLAGGED: ['Requiere revisión', 'blocked', 'Meta marcó esta plantilla. No se habilita para envío.'],
  };
  const [label, tone, detail] = statuses[template.status] || ['Estado no habilitado', 'blocked', 'No hay un estado válido que habilite el envío. Consultá nuevamente.'];
  return { label, tone, detail };
}

// Only these exact, confirmed pre-provider rejections may release a review.
// Unknown POST outcomes stay uncertain even when their HTTP status is 409/422.
export function templateRequestRejectedBeforeProvider(error) {
  return Boolean(error && (error.status === 422 && error.code === 'WHATSAPP_TEMPLATE_REVIEW_INVALID'
    || error.status === 409 && ['WHATSAPP_TEMPLATE_REVIEW_CHANGED', 'WHATSAPP_FLOW_PROVISIONING_IN_PROGRESS',
      'WHATSAPP_FLOW_PROVISIONING_CONNECTION_CHANGED'].includes(error.code)));
}
