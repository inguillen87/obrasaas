// Public contracts. Idempotency/review values identify an operation, not authority.
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$/;
const KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const HASH = /^[a-f0-9]{64}$/;
const BLUEPRINTS = new Set(['incident-report', 'shift-check-in']);
const STATES = new Set(['sending', 'accepted', 'sent', 'delivered', 'read', 'failed', 'unknown']);
const string = (value, max = 2000) => typeof value === 'string' && value.length <= max;
const id = value => typeof value === 'string' && ID.test(value);
const timestamp = value => value === null || typeof value === 'string' && Number.isFinite(Date.parse(value));
export function flowOperationMatches(operation) {
  return Boolean(operation && typeof operation.key === 'string' && KEY.test(operation.key)
    && BLUEPRINTS.has(operation.blueprintKey) && typeof operation.reviewVersion === 'string' && HASH.test(operation.reviewVersion));
}
export function flowContextMatches(payload, scope) {
  return Boolean(scope && [scope.organizationId, scope.projectId, scope.conversationId].every(id)
    && payload?.context?.organizationId === scope.organizationId && payload.context.projectId === scope.projectId
    && payload.context.conversationId === scope.conversationId && payload.conversationId === scope.conversationId);
}
export function flowMessageMatches(message) {
  return Boolean(message && id(message.id) && message.direction === 'OUTBOUND' && message.kind === 'interactive'
    && string(message.body, 4096) && STATES.has(message.status) && timestamp(message.sentAt) && timestamp(message.recordedAt));
}
export function flowResultMatches(payload, operation, scope) {
  return Boolean(flowOperationMatches(operation) && flowContextMatches(payload, scope)
    && payload.operationKey === operation.key && payload.reviewVersion === operation.reviewVersion
    && payload.flow?.key === operation.blueprintKey && typeof payload.idempotent === 'boolean'
    && flowMessageMatches(payload.message)
    && (!Object.hasOwn(operation, 'bodyText') || payload.message.body === operation.bodyText));
}
export function flowReceiptMatches(payload, operation, scope) {
  return Boolean(flowOperationMatches(operation) && flowContextMatches(payload, scope)
    && payload.operationKey === operation.key && payload.reviewVersion === operation.reviewVersion
    && payload.flow?.key === operation.blueprintKey && typeof payload.found === 'boolean'
    && (payload.found ? flowResultMatches(payload, operation, scope) : payload.message === null));
}
export function flowResolutionMatches(payload, request, scope) {
  return Boolean(flowContextMatches(payload, scope) && payload.flow?.key === request.blueprintKey
    && payload.resolvedAttempt?.id === request.messageId && flowMessageMatches(payload.resolvedAttempt)
    && payload.resolvedAttempt.status === 'failed' && typeof payload.idempotent === 'boolean');
}
export function flowCatalogMatches(payload, scope) {
  if (!flowContextMatches(payload, scope) || typeof payload.capability?.allowed !== 'boolean'
    || !string(payload.capability.code, 100) || !(payload.capability.reason === null || string(payload.capability.reason))
    || !Array.isArray(payload.catalog) || payload.catalog.length > 2
    || new Set(payload.catalog.map(row => row?.key)).size !== payload.catalog.length) return false;
  if (payload.recipient !== null && (!string(payload.recipient?.name, 300) || !/^\+?\d{8,20}$/.test(payload.recipient?.phone || ''))) return false;
  return payload.catalog.every(row => {
    if (!row || !BLUEPRINTS.has(row.key) || !string(row.title, 300) || !string(row.description)
      || !Array.isArray(row.capabilities) || row.capabilities.length > 20 || !row.capabilities.every(value => string(value, 300))
      || !Number.isSafeInteger(row.expiresInMinutes) || row.expiresInMinutes < 1 || row.expiresInMinutes > 1440
      || typeof row.canSend !== 'boolean' || !string(row.template?.status, 40) || !string(row.template?.statusLabel, 200)
      || !(row.template.rejectionReason === null || string(row.template.rejectionReason))) return false;
    if (row.unresolvedAttempt !== null && (!id(row.unresolvedAttempt?.messageId)
      || !['sending', 'unknown'].includes(row.unresolvedAttempt.status))) return false;
    if (row.canSend && (!payload.capability.allowed || !payload.recipient || row.template.status !== 'APPROVED'
      || row.unresolvedAttempt || typeof row.reviewVersion !== 'string' || !HASH.test(row.reviewVersion)
      || !row.preview || !string(row.preview.bodyText, 1024) || !row.preview.bodyText.trim()
      || !string(row.preview.buttonText, 25) || !row.preview.buttonText.trim() || row.preview.language !== 'es_AR')) return false;
    return true;
  });
}
export function flowOutcomePresentation(status) {
  const values = {
    accepted: ['Aceptado por Meta', 'Todavía no hay confirmación de entrega.'],
    sent: ['Enviado', 'Todavía no hay confirmación de entrega.'],
    delivered: ['Entregado', 'No acredita lectura ni finalización del formulario.'],
    read: ['Leído', 'No acredita que se haya completado la tarea.'],
    failed: ['Intento rechazado', 'Revisá el estado antes de preparar otro envío.'],
    sending: ['En procesamiento', 'Consultá el mismo intento; no lo reenvíes.'],
    unknown: ['Resultado sin confirmar', 'Consultá el mismo intento; no lo reenvíes.'],
  };
  const [label, detail] = values[status] || values.unknown;
  return { label, detail, uncertain: !['accepted', 'sent', 'delivered', 'read', 'failed'].includes(status) };
}
