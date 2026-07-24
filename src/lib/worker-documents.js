const SHA256 = /^[a-f0-9]{64}$/;
const DOCUMENT_TYPES = new Set(['DNI', 'OBRA_SOCIAL', 'ART', 'CERTIFICATION', 'OTHER']);
const DOCUMENT_STATUSES = new Set(['PENDING_REVIEW', 'VALID', 'EXPIRED', 'REJECTED', 'ARCHIVED']);
const ACT_STATUSES = new Set(['DRAFT', 'PENDING_SIGNATURES', 'SIGNED', 'VOIDED']);

export class WorkerDocumentError extends Error {
  constructor(message, code = 'WORKER_DOCUMENT_INVALID', status = 400) {
    super(message);
    this.name = 'WorkerDocumentError';
    this.code = code;
    this.status = status;
  }
}

function boundedText(value, field, max) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new WorkerDocumentError(`${field} inválido.`);
  }
  return value.trim();
}

function optionalDate(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new WorkerDocumentError(`${field} inválido.`);
  return parsed;
}

function jsonObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new WorkerDocumentError(`${field} inválido.`);
  }
  return value;
}

export function normalizeWorkerDocumentInput(input = {}) {
  const type = boundedText(input.type, 'type', 32).toUpperCase();
  if (!DOCUMENT_TYPES.has(type)) throw new WorkerDocumentError('Tipo de documento no permitido.', 'WORKER_DOCUMENT_TYPE');
  const sha256 = boundedText(input.sha256, 'sha256', 64).toLowerCase();
  if (!SHA256.test(sha256)) throw new WorkerDocumentError('sha256 inválido.', 'WORKER_DOCUMENT_HASH');
  const version = Number(input.version ?? 1);
  if (!Number.isSafeInteger(version) || version < 1) throw new WorkerDocumentError('version inválida.');
  const issuedAt = optionalDate(input.issuedAt, 'issuedAt');
  const expiresAt = optionalDate(input.expiresAt, 'expiresAt');
  if (issuedAt && expiresAt && expiresAt <= issuedAt) throw new WorkerDocumentError('expiresAt debe ser posterior a issuedAt.');
  return {
    workerId: boundedText(input.workerId, 'workerId', 190),
    type,
    version,
    sha256,
    storage: jsonObject(input.storage, 'storage'),
    issuedAt,
    expiresAt,
    metadata: input.metadata === undefined || input.metadata === null ? null : jsonObject(input.metadata, 'metadata'),
  };
}

export function normalizeWorkerDocumentStatus(status) {
  const normalized = boundedText(status, 'status', 32).toUpperCase();
  if (!DOCUMENT_STATUSES.has(normalized)) throw new WorkerDocumentError('Estado de documento no permitido.', 'WORKER_DOCUMENT_STATUS');
  return normalized;
}

export function assertWorkerDocumentTransition(from, to) {
  const current = normalizeWorkerDocumentStatus(from);
  const next = normalizeWorkerDocumentStatus(to);
  const allowed = {
    PENDING_REVIEW: new Set(['VALID', 'REJECTED', 'ARCHIVED']),
    VALID: new Set(['EXPIRED', 'ARCHIVED']),
    EXPIRED: new Set(['VALID', 'ARCHIVED']),
    REJECTED: new Set(['PENDING_REVIEW', 'ARCHIVED']),
    ARCHIVED: new Set(),
  };
  if (!allowed[current].has(next)) throw new WorkerDocumentError('Transición de documento no permitida.', 'WORKER_DOCUMENT_TRANSITION', 409);
  return next;
}

export function normalizeStartActInput(input = {}) {
  const version = Number(input.version ?? 1);
  if (!Number.isSafeInteger(version) || version < 1) throw new WorkerDocumentError('version inválida.');
  const participants = Array.isArray(input.participants) ? input.participants : [];
  if (participants.length === 0 || participants.length > 100) throw new WorkerDocumentError('El acta requiere participantes.');
  const seen = new Set();
  const normalizedParticipants = participants.map((participant) => {
    const subjectType = boundedText(participant.subjectType, 'subjectType', 32).toUpperCase();
    const subjectId = boundedText(participant.subjectId, 'subjectId', 190);
    const key = `${subjectType}:${subjectId}`;
    if (seen.has(key)) throw new WorkerDocumentError('Participante duplicado.', 'START_ACT_PARTICIPANT_DUPLICATE', 409);
    seen.add(key);
    return {
      subjectType,
      subjectId,
      displayName: boundedText(participant.displayName, 'displayName', 190),
      role: boundedText(participant.role, 'role', 64),
    };
  });
  return { version, document: jsonObject(input.document, 'document'), sha256: boundedText(input.sha256, 'sha256', 64).toLowerCase(), participants: normalizedParticipants };
}

export function normalizeStartActStatus(status) {
  const normalized = boundedText(status, 'status', 32).toUpperCase();
  if (!ACT_STATUSES.has(normalized)) throw new WorkerDocumentError('Estado de acta no permitido.', 'START_ACT_STATUS');
  return normalized;
}

export function assertStartActTransition(from, to) {
  const current = normalizeStartActStatus(from);
  const next = normalizeStartActStatus(to);
  const allowed = {
    DRAFT: new Set(['PENDING_SIGNATURES', 'VOIDED']),
    PENDING_SIGNATURES: new Set(['SIGNED', 'VOIDED']),
    SIGNED: new Set(['VOIDED']),
    VOIDED: new Set(),
  };
  if (!allowed[current].has(next)) throw new WorkerDocumentError('Transición de acta no permitida.', 'START_ACT_TRANSITION', 409);
  return next;
}
