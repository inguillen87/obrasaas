import { CRM_STAGES, CRM_SEGMENTS, CRM_SOURCES, CrmAccountInputError, normalizeCrmAccountInput } from './enterprise-crm-policy.mjs';

// Browser-safe policy. Contact details are commercial records, never verified
// channel identities, messaging consent, or a source of tenant permissions.
export const CONSTRUCTOR_CRM_FIELDS = Object.freeze(['name', 'contactName', 'email', 'phone', 'stage', 'segment', 'source', 'nextFollowUpOn', 'notes']);
export const CONSTRUCTOR_CRM_STAGES = CRM_STAGES;
export const CONSTRUCTOR_CRM_SEGMENTS = CRM_SEGMENTS;
export const CONSTRUCTOR_CRM_SOURCES = CRM_SOURCES;
export const CONSTRUCTOR_CRM_MAX_REVISION = 2147483647;
export const CONSTRUCTOR_CRM_LIMITS = Object.freeze({ name: 120, contactName: 120, email: 254, phone: 40, notes: 5000 });
export class ConstructorCrmInputError extends Error {
  constructor(code = 'CONSTRUCTOR_CRM_INPUT_INVALID', status = 422, message = 'Revisá los datos del cliente.') {
    super(message); this.name = 'ConstructorCrmInputError'; this.code = code; this.status = status;
  }
}
const own = (input, key) => Object.hasOwn(input, key);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
export const constructorCrmId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
// A literal contact lookup, never a SQL pattern or a commercial automation.
export const constructorCrmSearch = value => value === undefined ? '' : typeof value === 'string' && value.length <= 120 && !/[\u0000-\u001f\u007f]/.test(value) ? value.trim() : null;
export const constructorCrmCursor = (value, search = '') => typeof value === 'string' && (search ? /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}~[a-f0-9]{64}$/.test(value) : constructorCrmId(value));
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const revision = value => Number.isInteger(value) && value >= 1 && value <= CONSTRUCTOR_CRM_MAX_REVISION;
const fail = () => { throw new ConstructorCrmInputError(); };
function canonicalPayload(payload, create) {
  if (!record(payload) || Object.keys(payload).some(key => !CONSTRUCTOR_CRM_FIELDS.includes(key)) || Object.keys(payload).length === 0) fail();
  for (const value of Object.values(payload)) if (typeof value === 'string' && /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) fail();
  if (own(payload, 'stage') && !CRM_STAGES.includes(payload.stage)) fail();
  const body = {};
  for (const field of CONSTRUCTOR_CRM_FIELDS) if (own(payload, field)) body[field === 'nextFollowUpOn' ? 'nextFollowUpAt' : field] = payload[field];
  // The enterprise normalizer validates a patch independently of a changing
  // database row. Its synthetic name is discarded when a patch omits name.
  if (!create && !own(body, 'name')) body.name = 'Canonical patch';
  let normalized;
  try { normalized = normalizeCrmAccountInput(body).data; }
  catch (error) { if (!(error instanceof CrmAccountInputError)) throw error; throw new ConstructorCrmInputError('CONSTRUCTOR_CRM_INPUT_INVALID', 422, error.message); }
  const result = {};
  for (const field of CONSTRUCTOR_CRM_FIELDS) {
    if (!own(payload, field) && !(create && field === 'stage')) continue;
    const value = normalized[field === 'nextFollowUpOn' ? 'nextFollowUpAt' : field];
    if (value === undefined) fail();
    result[field] = field === 'nextFollowUpOn' && value instanceof Date ? value.toISOString().slice(0, 10) : value;
  }
  return result;
}
export function validateConstructorCrmCommand(input) {
  const keys = ['action', 'operationId', 'projectId', 'scope', 'payload'];
  if (!record(input) || Object.keys(input).sort().join('|') !== [...keys].sort().join('|') || !['CREATE', 'UPDATE'].includes(input.action) || !uuid(input.operationId) || !constructorCrmId(input.projectId) || !/^[a-f0-9]{64}$/.test(input.scope || '') || !record(input.payload)) fail();
  const business = { ...input.payload };
  let id, expectedRevision;
  if (input.action === 'UPDATE') {
    id = business.id; expectedRevision = business.revision;
    if (!constructorCrmId(id) || !revision(expectedRevision)) fail();
    delete business.id; delete business.revision;
  }
  const payload = canonicalPayload(business, input.action === 'CREATE');
  return { action: input.action, operationId: input.operationId.toLowerCase(), projectId: input.projectId, scope: input.scope, ...(input.action === 'UPDATE' ? { id, revision: expectedRevision } : {}), payload };
}
export function normalizeConstructorCrmInput(payload, current = null) {
  const clean = canonicalPayload(payload, current === null);
  const body = {};
  for (const field of CONSTRUCTOR_CRM_FIELDS) if (own(clean, field)) body[field === 'nextFollowUpOn' ? 'nextFollowUpAt' : field] = clean[field];
  try { return normalizeCrmAccountInput(body, current); }
  catch (error) {
    if (!(error instanceof CrmAccountInputError)) throw error;
    if (error.message === 'No hay cambios para guardar.') throw new ConstructorCrmInputError('CONSTRUCTOR_CRM_NO_CHANGES', 409, error.message);
    throw new ConstructorCrmInputError('CONSTRUCTOR_CRM_INPUT_INVALID', 422, error.message);
  }
}
export function serializeConstructorCrmAccount(row) {
  if (!record(row) || !constructorCrmId(row.id) || !revision(row.revision) || !CRM_STAGES.includes(row.stage) || typeof row.name !== 'string' || row.name.length < 2 || row.name.length > 120) throw new ConstructorCrmInputError('CONSTRUCTOR_CRM_RECORD_UNCONFIRMED', 503);
  for (const [field, max] of Object.entries(CONSTRUCTOR_CRM_LIMITS)) if (row[field] !== null && row[field] !== undefined && (typeof row[field] !== 'string' || row[field].length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(row[field]))) throw new ConstructorCrmInputError('CONSTRUCTOR_CRM_RECORD_UNCONFIRMED', 503);
  if (row.segment !== null && row.segment !== undefined && !CRM_SEGMENTS.includes(row.segment) || row.source !== null && row.source !== undefined && !CRM_SOURCES.includes(row.source)) throw new ConstructorCrmInputError('CONSTRUCTOR_CRM_RECORD_UNCONFIRMED', 503);
  const result = { id: row.id, revision: row.revision };
  for (const field of CONSTRUCTOR_CRM_FIELDS) {
    if (field === 'nextFollowUpOn') {
      if (row.nextFollowUpAt === null || row.nextFollowUpAt === undefined) result[field] = null;
      else {
        const date = row.nextFollowUpAt instanceof Date ? row.nextFollowUpAt : new Date(row.nextFollowUpAt);
        if (!Number.isFinite(date.getTime())) throw new ConstructorCrmInputError('CONSTRUCTOR_CRM_RECORD_UNCONFIRMED', 503);
        result[field] = date.toISOString().slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(result[field])) throw new ConstructorCrmInputError('CONSTRUCTOR_CRM_RECORD_UNCONFIRMED', 503);
      }
    } else result[field] = row[field] ?? null;
  }
  return result;
}
