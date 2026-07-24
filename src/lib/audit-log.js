const MAX_CORRELATION_ID_LENGTH = 128;
const CORRELATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function auditMetadata(metadata = {}, correlationId = null) {
  const base = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? { ...metadata } : {};
  if (typeof correlationId === 'string' && correlationId.length <= MAX_CORRELATION_ID_LENGTH && CORRELATION_ID_PATTERN.test(correlationId)) base.correlationId = correlationId;
  return base;
}

export async function createAuditLog(transaction, { organizationId, actorId, action, entityType, entityId, metadata, correlationId }) {
  return transaction.auditLog.create({ data: { organizationId, actorId, action, entityType, entityId, metadata: auditMetadata(metadata, correlationId) } });
}
