import { createHash } from 'node:crypto';

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const CIVIL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EXACT_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const DECIMAL_PATTERN = /^(?:0|[1-9]\d{0,13})(?:\.\d{1,4})?$/;
const MINOR_AMOUNT_PATTERN = /^[1-9]\d{0,18}$/;
const MAX_SIGNED_BIGINT = 9_223_372_036_854_775_807n;
const PG_INTEGER_MAX = 2_147_483_647;
const UNIT_SET = new Set(['M', 'M2', 'M3', 'KG', 'T', 'L', 'UNIT', 'HOUR', 'DAY', 'LOT']);
const DECISION_SET = new Set(['APPROVED', 'REJECTED']);
const READINESS_SET = new Set([
  'AUTHORITY_REQUIRED',
  'AUTHORITY_REVIEW_PENDING',
  'CONTRACT_REQUIRED',
  'CONTRACT_REVIEW_PENDING',
  'ACTIVE',
]);
const COMPATIBILITY_SET = new Set(['UNESTABLISHED', 'MATCHED', 'MISMATCHED']);
const BASIS_SET = new Set(['UNESTABLISHED', 'MATCHED']);
const CANDIDATE_READINESS_SET = new Set(['READY', 'AUTHORITY_PENDING', 'CONTRACT_PENDING']);

export const PROJECT_CONTRACT_MAX_BODY_BYTES = 1024 * 1024;
export const PROJECT_CONTRACT_DECISION_MAX_BODY_BYTES = 16 * 1024;
export const PROJECT_CONTRACT_CURRENCIES = Object.freeze({ ARS: 2, USD: 2 });
export const PROJECT_CONTRACT_ROUNDING_POLICY = 'CERT_RETENTION_HALF_UP_V1';
export const PROJECT_CONTRACT_ADJUSTMENT_POLICY = 'NONE';

const AUTHORITY_CANDIDATE_SQL = `
  SELECT * FROM "obrasaas_project_contract_authority_candidate"(
    $1::text, $2::text, $3::text, $4::text, $5::text, $6::text
  )
`;
const AUTHORITY_PREPARE_REPLAY_SQL = `
  SELECT * FROM "obrasaas_project_contract_authority_prepare_replay"(
    $1::text, $2::text, $3::text, $4::integer, $5::text,
    $6::text, $7::text, $8::text, $9::text, $10::text
  )
`;
const AUTHORITY_PREPARE_SQL = `
  SELECT * FROM "obrasaas_project_contract_authority_prepare"(
    $1::text, $2::text, $3::text, $4::integer, $5::text,
    $6::text, $7::text, $8::text, $9::text, $10::text, $11::text
  )
`;
const AUTHORITY_DECIDE_SQL = `
  SELECT * FROM "obrasaas_project_contract_authority_decide"(
    $1::text, $2::text, $3::text, $4::integer, $5::text,
    $6::text, $7::text, $8::text, $9::text, $10::text
  )
`;
const CONTRACT_CANDIDATE_SQL = `
  SELECT * FROM "obrasaas_project_contract_sov_candidate"(
    $1::text, $2::text, $3::text, $4::text, $5::text, $6::text,
    $7::date, $8::text, $9::integer, $10::integer, $11::text,
    $12::text, $13::jsonb, $14::text
  )
`;
const CONTRACT_PREPARE_REPLAY_SQL = `
  SELECT * FROM "obrasaas_project_contract_prepare_replay"(
    $1::text, $2::text, $3::text, $4::integer, $5::text, $6::integer,
    $7::text, $8::text, $9::text, $10::date, $11::text, $12::integer,
    $13::integer, $14::text, $15::text, $16::jsonb, $17::text,
    $18::text, $19::text
  )
`;
const CONTRACT_PREPARE_SQL = `
  SELECT * FROM "obrasaas_project_contract_prepare"(
    $1::text, $2::text, $3::text, $4::integer, $5::text, $6::integer,
    $7::text, $8::text, $9::text, $10::text, $11::date, $12::text,
    $13::integer, $14::integer, $15::text, $16::text, $17::jsonb,
    $18::text, $19::text, $20::text
  )
`;
const CONTRACT_DECIDE_SQL = `
  SELECT * FROM "obrasaas_project_contract_decide"(
    $1::text, $2::text, $3::text, $4::integer, $5::text,
    $6::text, $7::text, $8::text, $9::text, $10::text
  )
`;
const CONTRACT_READ_SQL = `
  SELECT "obrasaas_project_contract_read"($1::text, $2::text, $3::text) AS snapshot
`;

export class ProjectContractError extends Error {
  constructor(message, code = 'PROJECT_CONTRACT_INVALID', status = 400) {
    super(message);
    this.name = 'ProjectContractError';
    this.code = code;
    this.status = status;
  }
}

function invalid(message, code = 'PROJECT_CONTRACT_INVALID', status = 400) {
  throw new ProjectContractError(message, code, status);
}

function contractError() {
  return new ProjectContractError(
    'La persistencia devolvió un contrato inválido.',
    'PROJECT_CONTRACT_PERSISTENCE_CONTRACT_INVALID',
    500,
  );
}

function strictObject(value, field = 'body') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    invalid(`${field} debe ser un objeto.`);
  }
  return value;
}

function exactFields(value, allowed, required = allowed, field = 'body') {
  const keys = Object.keys(value);
  const unknown = keys.find((key) => !allowed.has(key));
  if (unknown) invalid(`${field}.${unknown} no está permitido.`);
  const missing = [...required].find((key) => !Object.hasOwn(value, key));
  if (missing) invalid(`${field}.${missing} es obligatorio.`);
}

function exactStoredFields(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw contractError();
  const keys = Object.keys(value);
  if (
    keys.length !== fields.size
    || keys.some((key) => !fields.has(key))
    || [...fields].some((key) => !Object.hasOwn(value, key))
  ) throw contractError();
  return value;
}

function identifier(value, field, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (typeof value !== 'string' || !IDENTIFIER_PATTERN.test(value)) {
    invalid(`${field} es inválido.`);
  }
  return value;
}

function storedIdentifier(value, field, options) {
  try {
    return identifier(value, field, options);
  } catch {
    throw contractError();
  }
}

function boundedText(value, field, { minimum = 1, maximum } = {}) {
  if (
    typeof value !== 'string'
    || value !== value.trim()
    || value.length < minimum
    || value.length > maximum
    || /[\u0000-\u001f\u007f]/.test(value)
  ) invalid(`${field} es inválido.`);
  return value;
}

function storedText(value, field, options) {
  try {
    return boundedText(value, field, options);
  } catch {
    throw contractError();
  }
}

function integer(value, field, { minimum = 0, maximum = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    invalid(`${field} es inválido.`);
  }
  return value;
}

function storedInteger(value, field, options) {
  const normalized = typeof value === 'bigint' && value <= BigInt(Number.MAX_SAFE_INTEGER)
    ? Number(value)
    : value;
  try {
    return integer(normalized, field, options);
  } catch {
    throw contractError();
  }
}

function hash(value, field) {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    invalid(`${field} es inválido.`);
  }
  return value;
}

function storedHash(value, field) {
  try {
    return hash(value, field);
  } catch {
    throw contractError();
  }
}

function civilDate(value, field) {
  if (typeof value !== 'string' || !CIVIL_DATE_PATTERN.test(value)) {
    invalid(`${field} debe usar YYYY-MM-DD.`);
  }
  const [year, month, day] = value.split('-').map((part) => Number(part));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) invalid(`${field} debe ser una fecha civil válida.`);
  return value;
}

function storedCivilDate(value, field) {
  try {
    return civilDate(value, field);
  } catch {
    throw contractError();
  }
}

function storedDateTime(value, field) {
  const parsed = typeof value === 'string' ? new Date(value) : null;
  if (
    typeof value !== 'string'
    || !EXACT_TIMESTAMP_PATTERN.test(value)
    || Number.isNaN(parsed.getTime())
    || parsed.toISOString() !== value
  ) throw contractError();
  return value;
}

function enumValue(value, allowed, field) {
  if (typeof value !== 'string' || !allowed.has(value)) invalid(`${field} es inválido.`);
  return value;
}

function storedEnum(value, allowed) {
  if (typeof value !== 'string' || !allowed.has(value)) throw contractError();
  return value;
}

function canonicalQuantity(value, field) {
  if (typeof value !== 'string' || value !== value.trim() || !DECIMAL_PATTERN.test(value)) {
    invalid(`${field} debe ser un decimal exacto positivo con hasta 4 decimales.`);
  }
  const [whole, fraction = ''] = value.split('.');
  const scaled = (BigInt(whole) * 10_000n) + BigInt(fraction.padEnd(4, '0'));
  if (scaled <= 0n) invalid(`${field} debe ser mayor que cero.`);
  return `${scaled / 10_000n}.${String(scaled % 10_000n).padStart(4, '0')}`;
}

function canonicalMinorAmount(value, field) {
  if (typeof value !== 'string' || value !== value.trim() || !MINOR_AMOUNT_PATTERN.test(value)) {
    invalid(`${field} debe ser un entero positivo canónico en minor units.`);
  }
  const amount = BigInt(value);
  if (amount > MAX_SIGNED_BIGINT) invalid(`${field} excede BIGINT.`);
  return amount.toString();
}

function requiredActorMembershipId(value) {
  if (value === null || value === undefined || value === '') {
    invalid(
      'Una membresía activa en la organización y obra es obligatoria.',
      'TENANT_PROJECT_MEMBERSHIP_REQUIRED',
      403,
    );
  }
  return identifier(value, 'actorMembershipId');
}

function trustedScope(scope, actorMembershipId) {
  const value = strictObject(scope, 'scope');
  return {
    organizationId: identifier(value.organizationId, 'scope.organizationId'),
    projectId: identifier(value.projectId, 'scope.projectId'),
    actorMembershipId: requiredActorMembershipId(actorMembershipId),
  };
}

export function requireProjectContractIdempotencyKey(value) {
  const candidate = typeof value === 'string' ? value : value?.headers?.get?.('Idempotency-Key');
  if (typeof candidate !== 'string' || !IDEMPOTENCY_KEY_PATTERN.test(candidate)) {
    invalid(
      'Idempotency-Key debe tener entre 8 y 128 caracteres seguros.',
      'PROJECT_CONTRACT_IDEMPOTENCY_KEY_INVALID',
    );
  }
  return candidate;
}

function noQuery(requestOrUrl) {
  const url = requestOrUrl instanceof URL ? requestOrUrl : new URL(requestOrUrl.url);
  if (url.searchParams.size !== 0) {
    invalid('La ruta no admite parámetros de consulta.', 'PROJECT_CONTRACT_QUERY_INVALID');
  }
}

export function normalizeProjectContractReadQuery(requestOrUrl) {
  noQuery(requestOrUrl);
  return Object.freeze({});
}

export function normalizeProjectContractAuthorityProposal(input, operationKey) {
  const body = strictObject(input);
  const fields = new Set([
    'expectedCurrentAuthorityVersionId',
    'expectedHeadRevision',
    'certifierMembershipId',
    'financeMembershipId',
    'registrarMembershipId',
  ]);
  exactFields(body, fields);
  const certifierMembershipId = identifier(body.certifierMembershipId, 'certifierMembershipId');
  const financeMembershipId = identifier(body.financeMembershipId, 'financeMembershipId');
  const registrarMembershipId = identifier(body.registrarMembershipId, 'registrarMembershipId');
  if (new Set([certifierMembershipId, financeMembershipId, registrarMembershipId]).size !== 3) {
    invalid(
      'Las tres autoridades deben ser membresías distintas.',
      'PROJECT_CONTRACT_AUTHORITY_SEPARATION_REQUIRED',
      422,
    );
  }
  return Object.freeze({
    expectedCurrentAuthorityVersionId: identifier(
      body.expectedCurrentAuthorityVersionId,
      'expectedCurrentAuthorityVersionId',
      { nullable: true },
    ),
    expectedHeadRevision: integer(body.expectedHeadRevision, 'expectedHeadRevision', {
      maximum: PG_INTEGER_MAX,
    }),
    certifierMembershipId,
    financeMembershipId,
    registrarMembershipId,
    operationKey: requireProjectContractIdempotencyKey(operationKey),
  });
}

function normalizeDecision(input, operationKey, digestField) {
  const body = strictObject(input);
  const fields = new Set(['expectedHeadRevision', digestField, 'decision', 'reason']);
  exactFields(body, fields);
  return Object.freeze({
    expectedHeadRevision: integer(body.expectedHeadRevision, 'expectedHeadRevision', {
      minimum: 1,
      maximum: PG_INTEGER_MAX,
    }),
    expectedDigest: hash(body[digestField], digestField),
    decision: enumValue(body.decision, DECISION_SET, 'decision'),
    reason: boundedText(body.reason, 'reason', { maximum: 1_000 }),
    operationKey: requireProjectContractIdempotencyKey(operationKey),
  });
}

export function normalizeProjectContractAuthorityDecision(input, operationKey) {
  return normalizeDecision(input, operationKey, 'expectedAuthorityDigest');
}

export function normalizeProjectContractDecision(input, operationKey) {
  return normalizeDecision(input, operationKey, 'expectedContractDigest');
}

function normalizeLine(raw, index) {
  const line = strictObject(raw, `lines[${index}]`);
  const fields = new Set([
    'taskId', 'state', 'unitCode', 'baseQuantity', 'contractAmountMinor', 'noClaimReason',
  ]);
  exactFields(line, fields, fields, `lines[${index}]`);
  const taskId = identifier(line.taskId, `lines[${index}].taskId`);
  const state = enumValue(line.state, new Set(['VALUED', 'NO_CLAIM']), `lines[${index}].state`);
  if (state === 'VALUED') {
    if (line.noClaimReason !== null) invalid(`lines[${index}].noClaimReason debe ser null.`);
    return Object.freeze({
      taskId,
      state,
      unitCode: enumValue(line.unitCode, UNIT_SET, `lines[${index}].unitCode`),
      baseQuantity: canonicalQuantity(line.baseQuantity, `lines[${index}].baseQuantity`),
      contractAmountMinor: canonicalMinorAmount(
        line.contractAmountMinor,
        `lines[${index}].contractAmountMinor`,
      ),
      noClaimReason: null,
    });
  }
  if (line.unitCode !== null || line.baseQuantity !== null || line.contractAmountMinor !== null) {
    invalid(`lines[${index}] NO_CLAIM exige unidad, base e importe null.`);
  }
  return Object.freeze({
    taskId,
    state,
    unitCode: null,
    baseQuantity: null,
    contractAmountMinor: null,
    noClaimReason: boundedText(line.noClaimReason, `lines[${index}].noClaimReason`, { maximum: 1_000 }),
  });
}

export function normalizeProjectContractProposal(input, operationKey) {
  const body = strictObject(input);
  const fields = new Set([
    'authorityVersionId', 'expectedAuthorityRevision', 'expectedCurrentVersionId',
    'expectedHeadRevision', 'contractReference', 'title', 'counterpartyLabel',
    'effectiveFrom', 'currencyCode', 'currencyMinorUnits', 'retentionBps',
    'roundingPolicyVersion', 'adjustmentPolicyVersion', 'lines',
  ]);
  exactFields(body, fields);
  if (!Array.isArray(body.lines) || body.lines.length < 1 || body.lines.length > 5_000) {
    invalid('lines debe contener entre 1 y 5000 tareas.', 'PROJECT_CONTRACT_LINES_INVALID', 422);
  }
  const lines = body.lines.map(normalizeLine);
  if (new Set(lines.map((line) => line.taskId)).size !== lines.length) {
    invalid('Cada tarea debe aparecer exactamente una vez.', 'PROJECT_CONTRACT_TASK_COVERAGE_INVALID', 422);
  }
  const currencyCode = enumValue(
    body.currencyCode,
    new Set(Object.keys(PROJECT_CONTRACT_CURRENCIES)),
    'currencyCode',
  );
  if (body.currencyMinorUnits !== PROJECT_CONTRACT_CURRENCIES[currencyCode]) {
    invalid(
      'currencyCode y currencyMinorUnits no pertenecen a la allowlist S9.3.',
      'PROJECT_CONTRACT_CURRENCY_INVALID',
      422,
    );
  }
  if (body.roundingPolicyVersion !== PROJECT_CONTRACT_ROUNDING_POLICY) {
    invalid('roundingPolicyVersion es inválido.', 'PROJECT_CONTRACT_ROUNDING_POLICY_INVALID', 422);
  }
  if (body.adjustmentPolicyVersion !== PROJECT_CONTRACT_ADJUSTMENT_POLICY) {
    invalid('adjustmentPolicyVersion es inválido.', 'PROJECT_CONTRACT_ADJUSTMENT_POLICY_INVALID', 422);
  }
  return Object.freeze({
    authorityVersionId: identifier(body.authorityVersionId, 'authorityVersionId'),
    expectedAuthorityRevision: integer(
      body.expectedAuthorityRevision,
      'expectedAuthorityRevision',
      { minimum: 2, maximum: PG_INTEGER_MAX },
    ),
    expectedCurrentVersionId: identifier(
      body.expectedCurrentVersionId,
      'expectedCurrentVersionId',
      { nullable: true },
    ),
    expectedHeadRevision: integer(body.expectedHeadRevision, 'expectedHeadRevision', {
      maximum: PG_INTEGER_MAX,
    }),
    contractReference: boundedText(body.contractReference, 'contractReference', { maximum: 120 }),
    title: boundedText(body.title, 'title', { maximum: 240 }),
    counterpartyLabel: boundedText(body.counterpartyLabel, 'counterpartyLabel', { maximum: 240 }),
    effectiveFrom: civilDate(body.effectiveFrom, 'effectiveFrom'),
    currencyCode,
    currencyMinorUnits: body.currencyMinorUnits,
    retentionBps: integer(body.retentionBps, 'retentionBps', { maximum: 10_000 }),
    roundingPolicyVersion: body.roundingPolicyVersion,
    adjustmentPolicyVersion: body.adjustmentPolicyVersion,
    lines: Object.freeze(lines),
    operationKey: requireProjectContractIdempotencyKey(operationKey),
  });
}

function fingerprint(operation, command) {
  const payload = Object.fromEntries(Object.entries(command).filter(
    ([key]) => key !== 'operationKey' && key !== 'requestFingerprint',
  ));
  return createHash('sha256').update(JSON.stringify({ operation, ...payload })).digest('hex');
}

const DATABASE_ERRORS = Object.freeze([
  [['IDEMPOTENCY_CONFLICT'], 'PROJECT_CONTRACT_IDEMPOTENCY_CONFLICT', 409, 'La clave de idempotencia ya fue usada con otro contenido.'],
  [['SCOPE_INVALID'], 'PROJECT_CONTRACT_NOT_FOUND', 404, 'No se encontró el contrato en la obra activa.'],
  [['P0002', 'NO_DATA_FOUND'], 'PROJECT_CONTRACT_NOT_FOUND', 404, 'No se encontró el contrato en la obra activa.'],
  [['READ_FORBIDDEN', '_MAKER_FORBIDDEN', '_CHECKER_FORBIDDEN', '_PREPARER_FORBIDDEN', '_ROTATION_FORBIDDEN', '_BOOTSTRAP_FORBIDDEN', '_REPLACEMENT_REQUIRED', '_MAKER_CHECKER_REQUIRED', '_AUTHORITY_INVALID'], 'PROJECT_CONTRACT_FORBIDDEN', 403, 'No tenés permisos o la designación activa requerida para esta operación.'],
  [['_HEAD_STALE', '_CANDIDATE_STALE', '_TASKS_STALE', '_AUTHORITY_STALE'], 'PROJECT_CONTRACT_STALE', 409, 'El contrato cambió. Actualizá antes de continuar.'],
  [['_NOT_READY', '_BLOCKED_BY_'], 'PROJECT_CONTRACT_NOT_READY', 409, 'La cadena contractual tiene una decisión pendiente incompatible.'],
  [['_TOO_LARGE'], 'PROJECT_CONTRACT_TOO_LARGE', 422, 'La obra supera el máximo de 5000 tareas contractuales.'],
  [['_AUTHORITY_SEPARATION_REQUIRED', '_CURRENCY_IMMUTABLE', '_EMPTY', '_LINE_SHAPE_INVALID', '_LINE_VALUE_INVALID', '_NO_VALUED_LINES', '_TASK_COVERAGE_INVALID', '_TECHNICAL_BASIS_MISMATCH', '_AMOUNT_OVERFLOW'], 'PROJECT_CONTRACT_SEMANTIC_INVALID', 422, 'La propuesta contractual no cumple los invariantes requeridos.'],
]);

function databaseError(error) {
  const text = [
    error?.code,
    error?.message,
    error?.meta?.code,
    error?.meta?.message,
    error?.meta?.database_error,
  ]
    .filter((value) => typeof value === 'string')
    .join(' ')
    .toUpperCase();
  for (const [markers, code, status, message] of DATABASE_ERRORS) {
    if (markers.some((marker) => text.includes(marker))) {
      return new ProjectContractError(message, code, status);
    }
  }
  if (text.includes('INVALID SOV') || text.includes('INVALID AUTHORITY')) {
    return new ProjectContractError(
      'La solicitud contractual es inválida.',
      'PROJECT_CONTRACT_INVALID',
      422,
    );
  }
  return null;
}

export function projectContractErrorResponse(error) {
  if (!(error instanceof ProjectContractError)) return null;
  return Response.json({ error: error.message, code: error.code }, {
    status: error.status,
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  });
}

const AUTHORITY_CANDIDATE_FIELDS = new Set([
  'head_id', 'current_authority_version_id', 'latest_authority_version_id',
  'pending_authority_version_id', 'authority_revision', 'candidate_sha256', 'readiness',
]);
const AUTHORITY_PREPARE_FIELDS = new Set([
  'authority_version_id', 'organization_id', 'project_id', 'authority_version',
  'authority_sha256', 'prepared_by_membership_id', 'head_revision', 'replayed',
]);
const DECISION_FIELDS = new Set([
  'decision_id', 'authority_version_id', 'decision', 'decided_by_membership_id',
  'head_revision', 'replayed',
]);
const CONTRACT_DECISION_FIELDS = new Set([
  'decision_id', 'contract_version_id', 'decision', 'decided_by_membership_id',
  'head_revision', 'replayed',
]);
const CONTRACT_CANDIDATE_FIELDS = new Set([
  'head_id', 'current_version_id', 'latest_version_id', 'pending_version_id',
  'head_revision', 'authority_revision', 'line_count', 'valued_line_count',
  'no_claim_line_count', 'total_contract_amount_minor', 'candidate_sha256',
  'internal_lines', 'readiness',
]);
const CONTRACT_PREPARE_FIELDS = new Set([
  'contract_version_id', 'organization_id', 'project_id', 'contract_version',
  'contract_sha256', 'total_contract_amount_minor', 'prepared_by_membership_id',
  'head_revision', 'replayed',
]);

function onlyRow(rows, fields) {
  if (!Array.isArray(rows) || rows.length !== 1) throw contractError();
  return exactStoredFields(rows[0], fields);
}

function storedBoolean(value) {
  if (typeof value !== 'boolean') throw contractError();
  return value;
}

function storedMinorAmount(value) {
  const text = typeof value === 'bigint' ? value.toString() : value;
  try {
    return canonicalMinorAmount(text, 'amount');
  } catch {
    throw contractError();
  }
}

function exactReplayRows(rows) {
  if (!Array.isArray(rows) || rows.length > 1) throw contractError();
  if (rows.length === 0) return null;
  if (rows[0]?.replayed !== true) throw contractError();
  return rows;
}

function serializeAuthorityCandidate(rows) {
  const row = onlyRow(rows, AUTHORITY_CANDIDATE_FIELDS);
  storedNullableIdentifier(row.head_id, 'candidate.headId');
  storedNullableIdentifier(row.current_authority_version_id, 'candidate.currentAuthorityVersionId');
  storedNullableIdentifier(row.latest_authority_version_id, 'candidate.latestAuthorityVersionId');
  storedNullableIdentifier(row.pending_authority_version_id, 'candidate.pendingAuthorityVersionId');
  storedEnum(row.readiness, CANDIDATE_READINESS_SET);
  return {
    expectedCandidateDigest: storedHash(row.candidate_sha256, 'candidate'),
    authorityRevision: storedInteger(row.authority_revision, 'authorityRevision'),
  };
}

function serializeAuthorityPrepare(rows, command) {
  const row = onlyRow(rows, AUTHORITY_PREPARE_FIELDS);
  if (
    row.organization_id !== command.organizationId
    || row.project_id !== command.projectId
    || row.prepared_by_membership_id !== command.actorMembershipId
  ) throw contractError();
  return {
    authority: {
      id: storedIdentifier(row.authority_version_id, 'authority.id'),
      version: storedInteger(row.authority_version, 'authority.version', { minimum: 1 }),
      integrityDigest: storedHash(row.authority_sha256, 'authority.integrityDigest'),
      preparedByMembershipId: storedIdentifier(
        row.prepared_by_membership_id,
        'authority.preparedByMembershipId',
      ),
    },
    head: { revision: storedInteger(row.head_revision, 'head.revision', { minimum: 1 }) },
    executionAllowed: false,
    replayed: storedBoolean(row.replayed),
  };
}

function serializeDecision(rows, command, fields, idField) {
  const row = onlyRow(rows, fields);
  const rowIdField = idField === 'authorityVersionId'
    ? 'authority_version_id'
    : 'contract_version_id';
  const requestedId = idField === 'authorityVersionId'
    ? command.authorityVersionId
    : command.contractVersionId;
  if (
    row.decided_by_membership_id !== command.actorMembershipId
    || row[rowIdField] !== requestedId
    || row.decision !== command.decision
  ) throw contractError();
  return {
    decision: {
      id: storedIdentifier(row.decision_id, 'decision.id'),
      [idField]: storedIdentifier(row[rowIdField], `decision.${idField}`),
      decision: storedEnum(row.decision, DECISION_SET),
      decidedByMembershipId: storedIdentifier(
        row.decided_by_membership_id,
        'decision.decidedByMembershipId',
      ),
    },
    head: { revision: storedInteger(row.head_revision, 'head.revision', { minimum: 1 }) },
    executionAllowed: false,
    replayed: storedBoolean(row.replayed),
  };
}

function serializeContractCandidate(rows) {
  const row = onlyRow(rows, CONTRACT_CANDIDATE_FIELDS);
  storedIdentifier(row.head_id, 'candidate.headId');
  storedNullableIdentifier(row.current_version_id, 'candidate.currentVersionId');
  storedNullableIdentifier(row.latest_version_id, 'candidate.latestVersionId');
  storedNullableIdentifier(row.pending_version_id, 'candidate.pendingVersionId');
  storedInteger(row.head_revision, 'candidate.headRevision');
  storedInteger(row.authority_revision, 'candidate.authorityRevision');
  const lineCount = storedInteger(row.line_count, 'candidate.lineCount', { minimum: 1 });
  const valuedLineCount = storedInteger(row.valued_line_count, 'candidate.valuedLineCount', {
    minimum: 1,
  });
  const noClaimLineCount = storedInteger(row.no_claim_line_count, 'candidate.noClaimLineCount');
  if (
    lineCount !== valuedLineCount + noClaimLineCount
    || !Array.isArray(row.internal_lines)
  ) throw contractError();
  storedEnum(row.readiness, CANDIDATE_READINESS_SET);
  return {
    expectedCandidateDigest: storedHash(row.candidate_sha256, 'candidate'),
    totalContractAmountMinor: storedMinorAmount(row.total_contract_amount_minor),
  };
}

function serializeContractPrepare(rows, command) {
  const row = onlyRow(rows, CONTRACT_PREPARE_FIELDS);
  if (
    row.organization_id !== command.organizationId
    || row.project_id !== command.projectId
    || row.prepared_by_membership_id !== command.actorMembershipId
  ) throw contractError();
  return {
    contract: {
      id: storedIdentifier(row.contract_version_id, 'contract.id'),
      version: storedInteger(row.contract_version, 'contract.version', { minimum: 1 }),
      integrityDigest: storedHash(row.contract_sha256, 'contract.integrityDigest'),
      totalContractAmountMinor: storedMinorAmount(row.total_contract_amount_minor),
      preparedByMembershipId: storedIdentifier(
        row.prepared_by_membership_id,
        'contract.preparedByMembershipId',
      ),
    },
    head: { revision: storedInteger(row.head_revision, 'head.revision', { minimum: 1 }) },
    executionAllowed: false,
    replayed: storedBoolean(row.replayed),
  };
}

function requireSql(prisma) {
  if (
    !prisma
    || typeof prisma.$transaction !== 'function'
    || typeof prisma.$queryRawUnsafe !== 'function'
  ) {
    invalid(
      'La autoridad contractual durable no está disponible.',
      'PROJECT_CONTRACT_UNAVAILABLE',
      503,
    );
  }
  return prisma;
}

export async function requireProjectContractRouteMembership(prisma, {
  scope,
  actorMembershipId,
} = {}) {
  const command = trustedScope(scope, actorMembershipId);
  if (!prisma?.projectMembership || typeof prisma.projectMembership.findFirst !== 'function') {
    invalid(
      'La verificación de membresía de obra no está disponible.',
      'PROJECT_CONTRACT_UNAVAILABLE',
      503,
    );
  }
  const membership = await prisma.projectMembership.findFirst({
    where: {
      projectId: command.projectId,
      tenantMembershipId: command.actorMembershipId,
      status: 'ACTIVE',
      tenantMembership: {
        organizationId: command.organizationId,
        status: 'ACTIVE',
      },
      project: {
        organizationId: command.organizationId,
        status: { not: 'ARCHIVED' },
      },
    },
    select: { id: true },
  });
  if (!membership) {
    invalid(
      'Una membresía activa en la organización y obra es obligatoria.',
      'TENANT_PROJECT_MEMBERSHIP_REQUIRED',
      403,
    );
  }
  return command.actorMembershipId;
}

export function createProjectContractSqlAdapter(prisma) {
  requireSql(prisma);
  return Object.freeze({
    proposeAuthority(command) {
      return prisma.$transaction(async (database) => {
        const replayRows = exactReplayRows(await database.$queryRawUnsafe(
          AUTHORITY_PREPARE_REPLAY_SQL,
          command.organizationId,
          command.projectId,
          command.expectedCurrentAuthorityVersionId,
          command.expectedHeadRevision,
          command.certifierMembershipId,
          command.financeMembershipId,
          command.registrarMembershipId,
          command.operationKey,
          command.requestFingerprint,
          command.actorMembershipId,
        ));
        if (replayRows) return replayRows;
        const candidateRows = await database.$queryRawUnsafe(
          AUTHORITY_CANDIDATE_SQL,
          command.organizationId,
          command.projectId,
          command.certifierMembershipId,
          command.financeMembershipId,
          command.registrarMembershipId,
          command.actorMembershipId,
        );
        const candidate = serializeAuthorityCandidate(candidateRows, command);
        return database.$queryRawUnsafe(
          AUTHORITY_PREPARE_SQL,
          command.organizationId,
          command.projectId,
          command.expectedCurrentAuthorityVersionId,
          command.expectedHeadRevision,
          candidate.expectedCandidateDigest,
          command.certifierMembershipId,
          command.financeMembershipId,
          command.registrarMembershipId,
          command.operationKey,
          command.requestFingerprint,
          command.actorMembershipId,
        );
      }, { isolationLevel: 'ReadCommitted' });
    },
    decideAuthority(command) {
      return prisma.$queryRawUnsafe(
        AUTHORITY_DECIDE_SQL,
        command.organizationId,
        command.projectId,
        command.authorityVersionId,
        command.expectedHeadRevision,
        command.expectedDigest,
        command.decision,
        command.reason,
        command.operationKey,
        command.requestFingerprint,
        command.actorMembershipId,
      );
    },
    proposeContract(command) {
      const linesJson = JSON.stringify(command.lines);
      return prisma.$transaction(async (database) => {
        const replayRows = exactReplayRows(await database.$queryRawUnsafe(
          CONTRACT_PREPARE_REPLAY_SQL,
          command.organizationId,
          command.projectId,
          command.authorityVersionId,
          command.expectedAuthorityRevision,
          command.expectedCurrentVersionId,
          command.expectedHeadRevision,
          command.contractReference,
          command.title,
          command.counterpartyLabel,
          command.effectiveFrom,
          command.currencyCode,
          command.currencyMinorUnits,
          command.retentionBps,
          command.roundingPolicyVersion,
          command.adjustmentPolicyVersion,
          linesJson,
          command.operationKey,
          command.requestFingerprint,
          command.actorMembershipId,
        ));
        if (replayRows) return replayRows;
        const candidateRows = await database.$queryRawUnsafe(
          CONTRACT_CANDIDATE_SQL,
          command.organizationId,
          command.projectId,
          command.authorityVersionId,
          command.contractReference,
          command.title,
          command.counterpartyLabel,
          command.effectiveFrom,
          command.currencyCode,
          command.currencyMinorUnits,
          command.retentionBps,
          command.roundingPolicyVersion,
          command.adjustmentPolicyVersion,
          linesJson,
          command.actorMembershipId,
        );
        const candidate = serializeContractCandidate(candidateRows, command);
        return database.$queryRawUnsafe(
          CONTRACT_PREPARE_SQL,
          command.organizationId,
          command.projectId,
          command.authorityVersionId,
          command.expectedAuthorityRevision,
          command.expectedCurrentVersionId,
          command.expectedHeadRevision,
          candidate.expectedCandidateDigest,
          command.contractReference,
          command.title,
          command.counterpartyLabel,
          command.effectiveFrom,
          command.currencyCode,
          command.currencyMinorUnits,
          command.retentionBps,
          command.roundingPolicyVersion,
          command.adjustmentPolicyVersion,
          linesJson,
          command.operationKey,
          command.requestFingerprint,
          command.actorMembershipId,
        );
      }, { isolationLevel: 'ReadCommitted' });
    },
    decideContract(command) {
      return prisma.$queryRawUnsafe(
        CONTRACT_DECIDE_SQL,
        command.organizationId,
        command.projectId,
        command.contractVersionId,
        command.expectedHeadRevision,
        command.expectedDigest,
        command.decision,
        command.reason,
        command.operationKey,
        command.requestFingerprint,
        command.actorMembershipId,
      );
    },
    read(command) {
      return prisma.$transaction(
        (database) => database.$queryRawUnsafe(
          CONTRACT_READ_SQL,
          command.organizationId,
          command.projectId,
          command.actorMembershipId,
        ),
        { isolationLevel: 'RepeatableRead' },
      );
    },
  });
}

async function runMutation(operation, command, adapter, serializer) {
  try {
    return serializer(await adapter[operation](command), command);
  } catch (error) {
    if (error instanceof ProjectContractError) throw error;
    throw databaseError(error) || error;
  }
}

export async function proposeProjectContractAuthority(prisma, {
  scope, actorMembershipId, operationKey, input,
} = {}, options = {}) {
  const draft = {
    ...trustedScope(scope, actorMembershipId),
    ...normalizeProjectContractAuthorityProposal(input, operationKey),
  };
  const command = Object.freeze({
    ...draft,
    requestFingerprint: fingerprint('AUTHORITY_PROPOSE', draft),
  });
  return runMutation(
    'proposeAuthority',
    command,
    options.sqlAdapter || createProjectContractSqlAdapter(prisma),
    serializeAuthorityPrepare,
  );
}

export async function decideProjectContractAuthority(prisma, {
  scope, actorMembershipId, authorityVersionId, operationKey, input,
} = {}, options = {}) {
  const draft = {
    ...trustedScope(scope, actorMembershipId),
    authorityVersionId: identifier(authorityVersionId, 'authorityVersionId'),
    ...normalizeProjectContractAuthorityDecision(input, operationKey),
  };
  const command = Object.freeze({
    ...draft,
    requestFingerprint: fingerprint('AUTHORITY_DECIDE', draft),
  });
  return runMutation(
    'decideAuthority',
    command,
    options.sqlAdapter || createProjectContractSqlAdapter(prisma),
    (rows, current) => serializeDecision(rows, current, DECISION_FIELDS, 'authorityVersionId'),
  );
}

export async function proposeProjectContractVersion(prisma, {
  scope, actorMembershipId, operationKey, input,
} = {}, options = {}) {
  const draft = {
    ...trustedScope(scope, actorMembershipId),
    ...normalizeProjectContractProposal(input, operationKey),
  };
  const command = Object.freeze({
    ...draft,
    requestFingerprint: fingerprint('CONTRACT_PROPOSE', draft),
  });
  return runMutation(
    'proposeContract',
    command,
    options.sqlAdapter || createProjectContractSqlAdapter(prisma),
    serializeContractPrepare,
  );
}

export async function decideProjectContractVersion(prisma, {
  scope, actorMembershipId, contractVersionId, operationKey, input,
} = {}, options = {}) {
  const draft = {
    ...trustedScope(scope, actorMembershipId),
    contractVersionId: identifier(contractVersionId, 'contractVersionId'),
    ...normalizeProjectContractDecision(input, operationKey),
  };
  const command = Object.freeze({
    ...draft,
    requestFingerprint: fingerprint('CONTRACT_DECIDE', draft),
  });
  return runMutation(
    'decideContract',
    command,
    options.sqlAdapter || createProjectContractSqlAdapter(prisma),
    (rows, current) => serializeDecision(rows, current, CONTRACT_DECISION_FIELDS, 'contractVersionId'),
  );
}

const SNAPSHOT_FIELDS = new Set([
  'organizationId', 'projectId', 'authorityRevision', 'headRevision', 'readiness',
  'currentAuthority', 'pendingAuthority', 'currentContract', 'pendingContract',
  'historyLimit', 'authorityHistory', 'contractHistory', 'canonicalTasks',
  'capabilities', 'currentTechnicalCompatibility', 's10BlockerCode',
]);
const AUTHORITY_FIELDS = new Set([
  'id', 'version', 'previousAuthorityVersionId', 'authorities', 'candidateToken',
  'integrityDigest', 'preparedByMembershipId', 'preparedAt', 'decision',
]);
const AUTHORITIES_FIELDS = new Set([
  'certifierMembershipId', 'financeMembershipId', 'registrarMembershipId',
]);
const STORED_DECISION_FIELDS = new Set([
  'id', 'decision', 'reason', 'decidedByMembershipId', 'decidedAt',
]);
const CONTRACT_FIELDS = new Set([
  'id', 'version', 'previousContractVersionId', 'authorityVersionId',
  'contractReference', 'title', 'counterpartyLabel', 'effectiveFrom',
  'currencyCode', 'currencyMinorUnits', 'retentionBps', 'roundingPolicyVersion',
  'adjustmentPolicyVersion', 'lineCount', 'valuedLineCount', 'noClaimLineCount',
  'totalContractAmountMinor', 'candidateToken', 'integrityDigest',
  'preparedByMembershipId', 'preparedAt', 'currentTechnicalCompatibility',
  's10BlockerCode', 'decision', 'lines',
]);
const CONTRACT_SUMMARY_FIELDS = new Set([...CONTRACT_FIELDS].filter((field) => field !== 'lines'));
const CONTRACT_LINE_FIELDS = new Set([
  'ordinal', 'state', 'taskId', 'taskCode', 'taskTitle', 'taskRevision',
  'unitCode', 'baseQuantity', 'contractAmountMinor', 'noClaimReason',
  'technicalBasisStatusAtPrepare', 'currentTechnicalCompatibility', 'integrityDigest',
]);
const CANONICAL_TASK_FIELDS = new Set([
  'taskId', 'taskCode', 'taskTitle', 'taskRevision', 'technicalBasis',
]);
const TECHNICAL_BASIS_FIELDS = new Set(['status', 'unitCode', 'baseQuantity']);
const CAPABILITIES_FIELDS = new Set([
  'read', 'proposeAuthority', 'decideAuthority', 'prepareContract', 'decideContract',
]);
const READ_CAPABILITY_FIELDS = new Set(['allowed', 'reasonCode']);
const ASSIGNED_CAPABILITY_FIELDS = new Set([
  'allowed', 'reasonCode', 'expectedActorMembershipId',
]);
const DECISION_CAPABILITY_FIELDS = new Set([
  'allowed', 'reasonCode', 'expectedActorMembershipId', 'targetId',
]);
const CAPABILITY_REASON_PATTERN = /^PROJECT_CONTRACT_[A-Z0-9_]{1,120}$/;

function storedNullableIdentifier(value, field) {
  return value === null ? null : storedIdentifier(value, field);
}

function storedNullableText(value, field, maximum = 1_000) {
  return value === null ? null : storedText(value, field, { maximum });
}

function serializeStoredDecision(value) {
  if (value === null) return null;
  const decision = exactStoredFields(value, STORED_DECISION_FIELDS);
  return {
    id: storedIdentifier(decision.id, 'decision.id'),
    decision: storedEnum(decision.decision, DECISION_SET),
    reason: storedText(decision.reason, 'decision.reason', { maximum: 1_000 }),
    decidedByMembershipId: storedIdentifier(
      decision.decidedByMembershipId,
      'decision.decidedByMembershipId',
    ),
    decidedAt: storedDateTime(decision.decidedAt, 'decision.decidedAt'),
  };
}

function serializeAuthoritySnapshot(value) {
  if (value === null) return null;
  const authority = exactStoredFields(value, AUTHORITY_FIELDS);
  const authorities = exactStoredFields(authority.authorities, AUTHORITIES_FIELDS);
  const result = {
    id: storedIdentifier(authority.id, 'authority.id'),
    version: storedInteger(authority.version, 'authority.version', { minimum: 1 }),
    previousAuthorityVersionId: storedNullableIdentifier(
      authority.previousAuthorityVersionId,
      'authority.previousAuthorityVersionId',
    ),
    authorities: {
      certifierMembershipId: storedIdentifier(
        authorities.certifierMembershipId,
        'authority.certifierMembershipId',
      ),
      financeMembershipId: storedIdentifier(
        authorities.financeMembershipId,
        'authority.financeMembershipId',
      ),
      registrarMembershipId: storedIdentifier(
        authorities.registrarMembershipId,
        'authority.registrarMembershipId',
      ),
    },
    candidateToken: storedHash(authority.candidateToken, 'authority.candidateToken'),
    integrityDigest: storedHash(authority.integrityDigest, 'authority.integrityDigest'),
    preparedByMembershipId: storedIdentifier(
      authority.preparedByMembershipId,
      'authority.preparedByMembershipId',
    ),
    preparedAt: storedDateTime(authority.preparedAt, 'authority.preparedAt'),
    decision: serializeStoredDecision(authority.decision),
  };
  if (new Set(Object.values(result.authorities)).size !== 3) throw contractError();
  if ((result.version === 1) !== (result.previousAuthorityVersionId === null)) {
    throw contractError();
  }
  return result;
}

function storedQuantity(value) {
  try {
    const normalized = canonicalQuantity(value, 'quantity');
    if (normalized !== value) throw contractError();
    return normalized;
  } catch (error) {
    if (error instanceof ProjectContractError) throw contractError();
    throw error;
  }
}

function serializeContractLine(value, expectedOrdinal) {
  const line = exactStoredFields(value, CONTRACT_LINE_FIELDS);
  const state = storedEnum(line.state, new Set(['VALUED', 'NO_CLAIM']));
  const result = {
    ordinal: storedInteger(line.ordinal, 'line.ordinal', { minimum: 1, maximum: 5_000 }),
    state,
    taskId: storedIdentifier(line.taskId, 'line.taskId'),
    taskCode: storedNullableText(line.taskCode, 'line.taskCode', 64),
    taskTitle: storedText(line.taskTitle, 'line.taskTitle', { maximum: 10_000 }),
    taskRevision: storedInteger(line.taskRevision, 'line.taskRevision'),
    unitCode: line.unitCode === null ? null : storedEnum(line.unitCode, UNIT_SET),
    baseQuantity: line.baseQuantity === null ? null : storedQuantity(line.baseQuantity),
    contractAmountMinor: line.contractAmountMinor === null
      ? null
      : storedMinorAmount(line.contractAmountMinor),
    noClaimReason: storedNullableText(line.noClaimReason, 'line.noClaimReason'),
    technicalBasisStatusAtPrepare: line.technicalBasisStatusAtPrepare === null
      ? null
      : storedEnum(line.technicalBasisStatusAtPrepare, BASIS_SET),
    currentTechnicalCompatibility: line.currentTechnicalCompatibility === null
      ? null
      : storedEnum(line.currentTechnicalCompatibility, COMPATIBILITY_SET),
    integrityDigest: storedHash(line.integrityDigest, 'line.integrityDigest'),
  };
  if (result.ordinal !== expectedOrdinal) throw contractError();
  if (state === 'VALUED') {
    if (
      result.unitCode === null
      || result.baseQuantity === null
      || result.contractAmountMinor === null
      || result.noClaimReason !== null
      || result.technicalBasisStatusAtPrepare === null
      || result.currentTechnicalCompatibility === null
    ) throw contractError();
  } else if (
    result.unitCode !== null
    || result.baseQuantity !== null
    || result.contractAmountMinor !== null
    || result.noClaimReason === null
    || result.technicalBasisStatusAtPrepare !== null
    || result.currentTechnicalCompatibility !== null
  ) throw contractError();
  return result;
}

function serializeContractSnapshot(value, { summary = false } = {}) {
  if (value === null) return null;
  const contract = exactStoredFields(value, summary ? CONTRACT_SUMMARY_FIELDS : CONTRACT_FIELDS);
  const lineCount = storedInteger(contract.lineCount, 'contract.lineCount', {
    minimum: 1,
    maximum: 5_000,
  });
  const valuedLineCount = storedInteger(contract.valuedLineCount, 'contract.valuedLineCount', {
    minimum: 1,
    maximum: 5_000,
  });
  const noClaimLineCount = storedInteger(contract.noClaimLineCount, 'contract.noClaimLineCount', {
    maximum: 5_000,
  });
  if (lineCount !== valuedLineCount + noClaimLineCount) throw contractError();
  const result = {
    id: storedIdentifier(contract.id, 'contract.id'),
    version: storedInteger(contract.version, 'contract.version', { minimum: 1 }),
    previousContractVersionId: storedNullableIdentifier(
      contract.previousContractVersionId,
      'contract.previousContractVersionId',
    ),
    authorityVersionId: storedIdentifier(contract.authorityVersionId, 'contract.authorityVersionId'),
    contractReference: storedText(contract.contractReference, 'contract.contractReference', { maximum: 120 }),
    title: storedText(contract.title, 'contract.title', { maximum: 240 }),
    counterpartyLabel: storedText(contract.counterpartyLabel, 'contract.counterpartyLabel', { maximum: 240 }),
    effectiveFrom: storedCivilDate(contract.effectiveFrom, 'contract.effectiveFrom'),
    currencyCode: storedEnum(contract.currencyCode, new Set(Object.keys(PROJECT_CONTRACT_CURRENCIES))),
    currencyMinorUnits: storedInteger(contract.currencyMinorUnits, 'contract.currencyMinorUnits', { maximum: 4 }),
    retentionBps: storedInteger(contract.retentionBps, 'contract.retentionBps', { maximum: 10_000 }),
    roundingPolicyVersion: contract.roundingPolicyVersion,
    adjustmentPolicyVersion: contract.adjustmentPolicyVersion,
    lineCount,
    valuedLineCount,
    noClaimLineCount,
    totalContractAmountMinor: storedMinorAmount(contract.totalContractAmountMinor),
    candidateToken: storedHash(contract.candidateToken, 'contract.candidateToken'),
    integrityDigest: storedHash(contract.integrityDigest, 'contract.integrityDigest'),
    preparedByMembershipId: storedIdentifier(
      contract.preparedByMembershipId,
      'contract.preparedByMembershipId',
    ),
    preparedAt: storedDateTime(contract.preparedAt, 'contract.preparedAt'),
    currentTechnicalCompatibility: storedEnum(
      contract.currentTechnicalCompatibility,
      COMPATIBILITY_SET,
    ),
    s10BlockerCode: contract.s10BlockerCode === null
      ? null
      : storedEnum(contract.s10BlockerCode, new Set(['CONTRACT_TECHNICAL_BASIS_MISMATCH'])),
    decision: serializeStoredDecision(contract.decision),
  };
  if (
    result.currencyMinorUnits !== PROJECT_CONTRACT_CURRENCIES[result.currencyCode]
    || result.roundingPolicyVersion !== PROJECT_CONTRACT_ROUNDING_POLICY
    || result.adjustmentPolicyVersion !== PROJECT_CONTRACT_ADJUSTMENT_POLICY
    || (result.version === 1) !== (result.previousContractVersionId === null)
    || (result.currentTechnicalCompatibility === 'MISMATCHED')
      !== (result.s10BlockerCode === 'CONTRACT_TECHNICAL_BASIS_MISMATCH')
  ) throw contractError();
  if (!summary) {
    if (!Array.isArray(contract.lines) || contract.lines.length !== lineCount) throw contractError();
    result.lines = contract.lines.map((line, index) => serializeContractLine(line, index + 1));
    if (new Set(result.lines.map((line) => line.taskId)).size !== result.lines.length) {
      throw contractError();
    }
  }
  return result;
}

function serializeCanonicalTask(value) {
  const task = exactStoredFields(value, CANONICAL_TASK_FIELDS);
  const basis = exactStoredFields(task.technicalBasis, TECHNICAL_BASIS_FIELDS);
  const status = storedEnum(basis.status, new Set(['UNESTABLISHED', 'ESTABLISHED']));
  const result = {
    taskId: storedIdentifier(task.taskId, 'task.taskId'),
    taskCode: storedNullableText(task.taskCode, 'task.taskCode', 64),
    taskTitle: storedText(task.taskTitle, 'task.taskTitle', { maximum: 10_000 }),
    taskRevision: storedInteger(task.taskRevision, 'task.taskRevision'),
    technicalBasis: {
      status,
      unitCode: basis.unitCode === null ? null : storedEnum(basis.unitCode, UNIT_SET),
      baseQuantity: basis.baseQuantity === null ? null : storedQuantity(basis.baseQuantity),
    },
  };
  if (
    (status === 'UNESTABLISHED' && (
      result.technicalBasis.unitCode !== null || result.technicalBasis.baseQuantity !== null
    ))
    || (status === 'ESTABLISHED' && (
      result.technicalBasis.unitCode === null || result.technicalBasis.baseQuantity === null
    ))
  ) throw contractError();
  return result;
}

function capabilityReason(value) {
  if (value === null) return null;
  if (typeof value !== 'string' || !CAPABILITY_REASON_PATTERN.test(value)) throw contractError();
  return value;
}

function serializeCapability(value, fields, { decision = false } = {}) {
  const capability = exactStoredFields(value, fields);
  if (typeof capability.allowed !== 'boolean') throw contractError();
  const result = {
    allowed: capability.allowed,
    reasonCode: capabilityReason(capability.reasonCode),
  };
  if (fields.has('expectedActorMembershipId')) {
    result.expectedActorMembershipId = storedNullableIdentifier(
      capability.expectedActorMembershipId,
      'capability.expectedActorMembershipId',
    );
  }
  if (decision) result.targetId = storedNullableIdentifier(capability.targetId, 'capability.targetId');
  if (result.allowed && result.reasonCode !== null) throw contractError();
  if (!result.allowed && result.reasonCode === null) throw contractError();
  if (
    result.allowed
    && fields.has('expectedActorMembershipId')
    && result.expectedActorMembershipId === null
  ) throw contractError();
  if (decision && result.allowed && result.targetId === null) {
    throw contractError();
  }
  return result;
}

function serializeCapabilities(value) {
  const capabilities = exactStoredFields(value, CAPABILITIES_FIELDS);
  const result = {
    read: serializeCapability(capabilities.read, READ_CAPABILITY_FIELDS),
    proposeAuthority: serializeCapability(
      capabilities.proposeAuthority,
      ASSIGNED_CAPABILITY_FIELDS,
    ),
    decideAuthority: serializeCapability(
      capabilities.decideAuthority,
      DECISION_CAPABILITY_FIELDS,
      { decision: true },
    ),
    prepareContract: serializeCapability(
      capabilities.prepareContract,
      ASSIGNED_CAPABILITY_FIELDS,
    ),
    decideContract: serializeCapability(
      capabilities.decideContract,
      DECISION_CAPABILITY_FIELDS,
      { decision: true },
    ),
  };
  if (!result.read.allowed || result.read.reasonCode !== null) throw contractError();
  return result;
}

function descendingUniqueHistory(values, serializer) {
  if (!Array.isArray(values) || values.length > 20) throw contractError();
  const result = values.map((value) => serializer(value));
  const ids = new Set();
  let previousVersion = Number.MAX_SAFE_INTEGER;
  for (const item of result) {
    if (ids.has(item.id) || item.version >= previousVersion) throw contractError();
    ids.add(item.id);
    previousVersion = item.version;
  }
  return result;
}

export function serializeProjectContractSnapshot(raw, command) {
  const snapshot = exactStoredFields(raw, SNAPSHOT_FIELDS);
  if (snapshot.organizationId !== command.organizationId || snapshot.projectId !== command.projectId) {
    throw contractError();
  }
  const currentAuthority = serializeAuthoritySnapshot(snapshot.currentAuthority);
  const pendingAuthority = serializeAuthoritySnapshot(snapshot.pendingAuthority);
  const currentContract = serializeContractSnapshot(snapshot.currentContract);
  const pendingContract = serializeContractSnapshot(snapshot.pendingContract);
  const authorityHistory = descendingUniqueHistory(
    snapshot.authorityHistory,
    serializeAuthoritySnapshot,
  );
  const contractHistory = descendingUniqueHistory(
    snapshot.contractHistory,
    (value) => serializeContractSnapshot(value, { summary: true }),
  );
  if (!Array.isArray(snapshot.canonicalTasks) || snapshot.canonicalTasks.length > 5_000) {
    throw contractError();
  }
  const canonicalTasks = snapshot.canonicalTasks.map(serializeCanonicalTask);
  if (new Set(canonicalTasks.map((task) => task.taskId)).size !== canonicalTasks.length) {
    throw contractError();
  }
  const result = {
    organizationId: command.organizationId,
    projectId: command.projectId,
    authorityRevision: storedInteger(snapshot.authorityRevision, 'authorityRevision'),
    headRevision: storedInteger(snapshot.headRevision, 'headRevision'),
    readiness: storedEnum(snapshot.readiness, READINESS_SET),
    currentAuthority,
    pendingAuthority,
    currentContract,
    pendingContract,
    historyLimit: storedInteger(snapshot.historyLimit, 'historyLimit', { minimum: 20, maximum: 20 }),
    authorityHistory,
    contractHistory,
    canonicalTasks,
    capabilities: serializeCapabilities(snapshot.capabilities),
    currentTechnicalCompatibility: storedEnum(
      snapshot.currentTechnicalCompatibility,
      COMPATIBILITY_SET,
    ),
    s10BlockerCode: snapshot.s10BlockerCode === null
      ? null
      : storedEnum(snapshot.s10BlockerCode, new Set(['CONTRACT_TECHNICAL_BASIS_MISMATCH'])),
    executionAllowed: false,
  };
  if (
    (result.readiness === 'AUTHORITY_REQUIRED' && currentAuthority !== null)
    || (result.readiness === 'AUTHORITY_REVIEW_PENDING' && pendingAuthority === null)
    || (result.readiness === 'CONTRACT_REQUIRED' && (
      currentAuthority === null || currentContract !== null
    ))
    || (result.readiness === 'CONTRACT_REVIEW_PENDING' && pendingContract === null)
    || (result.readiness === 'ACTIVE' && (
      currentAuthority === null || currentContract === null
      || pendingAuthority !== null || pendingContract !== null
    ))
    || (result.currentTechnicalCompatibility === 'MISMATCHED')
      !== (result.s10BlockerCode === 'CONTRACT_TECHNICAL_BASIS_MISMATCH')
  ) throw contractError();
  return result;
}

export async function readProjectContractSnapshot(prisma, {
  scope, actorMembershipId,
} = {}, options = {}) {
  const command = Object.freeze(trustedScope(scope, actorMembershipId));
  const adapter = options.sqlAdapter || createProjectContractSqlAdapter(prisma);
  try {
    const rows = await adapter.read(command);
    if (!Array.isArray(rows) || rows.length !== 1 || !Object.hasOwn(rows[0], 'snapshot')) {
      throw contractError();
    }
    const snapshot = typeof rows[0].snapshot === 'string'
      ? JSON.parse(rows[0].snapshot)
      : rows[0].snapshot;
    return serializeProjectContractSnapshot(snapshot, command);
  } catch (error) {
    if (error instanceof ProjectContractError) throw error;
    throw databaseError(error) || error;
  }
}
