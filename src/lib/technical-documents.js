const HASH = /^[a-f0-9]{64}$/;
const TYPES = new Set(['PDF', 'DWG', 'IMAGE', 'OTHER']);
const STATUSES = new Set(['DRAFT', 'ISSUED', 'SUPERSEDED', 'VOIDED']);

export class TechnicalDocumentError extends Error {
  constructor(message, code = 'TECHNICAL_DOCUMENT_INVALID', status = 400) {
    super(message);
    this.name = 'TechnicalDocumentError';
    this.code = code;
    this.status = status;
  }
}

function text(value, field, max) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new TechnicalDocumentError(`${field} inválido.`);
  return value.trim();
}

function date(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new TechnicalDocumentError(`${field} inválido.`);
  return parsed;
}

export function normalizeTechnicalDocumentInput(input = {}) {
  const type = text(input.type, 'type', 16).toUpperCase();
  if (!TYPES.has(type)) throw new TechnicalDocumentError('Tipo de plano no permitido.', 'TECHNICAL_DOCUMENT_TYPE');
  const revision = text(input.revision, 'revision', 32).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._-]{0,31}$/.test(revision)) throw new TechnicalDocumentError('revision inválida.', 'TECHNICAL_DOCUMENT_REVISION');
  const sha256 = text(input.sha256, 'sha256', 64).toLowerCase();
  if (!HASH.test(sha256)) throw new TechnicalDocumentError('sha256 inválido.', 'TECHNICAL_DOCUMENT_HASH');
  const effectiveAt = date(input.effectiveAt, 'effectiveAt');
  const supersedesId = input.supersedesId === undefined || input.supersedesId === null ? null : text(input.supersedesId, 'supersedesId', 190);
  return { name: text(input.name, 'name', 190), discipline: text(input.discipline, 'discipline', 64), type, revision, sha256, effectiveAt, supersedesId };
}

export function normalizeTechnicalDocumentStatus(status) {
  const normalized = text(status, 'status', 24).toUpperCase();
  if (!STATUSES.has(normalized)) throw new TechnicalDocumentError('Estado de documento técnico no permitido.', 'TECHNICAL_DOCUMENT_STATUS');
  return normalized;
}

export function assertTechnicalDocumentTransition(from, to) {
  const current = normalizeTechnicalDocumentStatus(from);
  const next = normalizeTechnicalDocumentStatus(to);
  const allowed = { DRAFT: new Set(['ISSUED', 'VOIDED']), ISSUED: new Set(['SUPERSEDED']), SUPERSEDED: new Set(), VOIDED: new Set() };
  if (!allowed[current].has(next)) throw new TechnicalDocumentError('Transición de documento técnico no permitida.', 'TECHNICAL_DOCUMENT_TRANSITION', 409);
  return next;
}

