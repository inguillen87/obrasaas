import { createHash } from 'node:crypto';

import { civilFortnightForDate } from './progress-measurements.js';

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const DEDUCTION_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const EXACT_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const QUANTITY_PATTERN = /^(?:0|[1-9]\d{0,13})\.\d{4}$/;
const NONNEGATIVE_MINOR_PATTERN = /^(?:0|[1-9]\d{0,18})$/;
const POSITIVE_MINOR_PATTERN = /^[1-9]\d{0,18}$/;
const MAX_SIGNED_BIGINT = 9_223_372_036_854_775_807n;
const PG_INTEGER_MAX = 2_147_483_647;
const UNIT_SET = new Set(['M', 'M2', 'M3', 'KG', 'T', 'L', 'UNIT', 'HOUR', 'DAY', 'LOT']);
const WIRE_DECISION_SET = new Set(['APPROVE', 'REJECT', 'CANCEL']);
const STORED_DECISION_SET = new Set(['APPROVED', 'REJECTED', 'CANCELLED']);
const OPERATION_KIND_SET = new Set(['PREPARE', 'APPROVE', 'REJECT', 'CANCEL']);
const READINESS_STATE_SET = new Set(['READY', 'UP_TO_DATE', 'BLOCKED', 'REVIEW_PENDING']);
const MODE_SET = new Set(['FIRST', 'NEXT_PERIOD', 'CORRECTION']);
const LINE_STATE_SET = new Set(['VALUED', 'NO_CLAIM']);
const CUT_STATE_SET = new Set(['MEASURED', 'MISSING']);
const CURRENCY_SET = new Set(['ARS', 'USD']);

export const PROJECT_CERTIFICATE_MAX_BODY_BYTES = 64 * 1024;
export const PROJECT_CERTIFICATE_DECISION_MAX_BODY_BYTES = 16 * 1024;
export const PROJECT_CERTIFICATE_HISTORY_LIMIT = 20;
export const PROJECT_CERTIFICATE_BLOCKER_CODES = Object.freeze([
  'CERT_PENDING_REVIEW',
  'CERT_PROJECT_ARCHIVED',
  'CERT_AUTHORITY_REVIEW_PENDING',
  'CERT_CONTRACT_REVIEW_PENDING',
  'CERT_AUTHORITY_REQUIRED',
  'CERT_CONTRACT_REQUIRED',
  'CERT_PINNED_PROVENANCE_MISMATCH',
  'CERT_AUTHORITY_INVALID',
  'HISTORICAL_RESTATEMENT_REQUIRED',
  'CORRECTION_REQUIRED',
  'CERT_PERIOD_ORDER_INVALID',
  'CERT_TECHNICAL_CUT_REQUIRED',
  'CERT_TECHNICAL_CUT_STALE',
  'CERT_TECHNICAL_MEASUREMENT_MISSING',
  'CERT_CONTRACT_TECHNICAL_BASIS_MISMATCH',
  'CERT_RETROACTIVE_CONTRACT_BASIS',
  'CERT_CONTRACT_POLICY_UNSUPPORTED',
  'CERT_AMOUNT_OVERFLOW',
]);

const BLOCKER_CODE_SET = new Set(PROJECT_CERTIFICATE_BLOCKER_CODES);
const BLOCKER_ORDER = new Map(PROJECT_CERTIFICATE_BLOCKER_CODES.map((code, index) => [code, index]));
const CAPABILITY_REASON_SET = new Set([
  'CERT_PREPARER_REQUIRED',
  'CERT_NOT_READY',
  'CERT_PENDING_REQUIRED',
  'CERT_CERTIFIER_REQUIRED',
  'CERT_MAKER_INVALID',
  'CERT_APPROVAL_STALE',
  'CERT_CANCEL_NOT_ORPHANED',
  'CERT_CANCELLER_REQUIRED',
]);

const READ_SQL = `
  SELECT payload FROM "obrasaas_project_certificate_read"(
    $1::text, $2::text, $3::date, $4::text
  )
`;
const PREPARE_SQL = `
  SELECT payload FROM "obrasaas_project_certificate_prepare"(
    $1::text, $2::text, $3::date, $4::integer, $5::integer,
    $6::text, $7::jsonb, $8::text, $9::text, $10::text
  )
`;
const DECIDE_SQL = `
  SELECT payload FROM "obrasaas_project_certificate_decide"(
    $1::text, $2::text, $3::text, $4::integer, $5::integer,
    $6::text, $7::text, $8::text, $9::text, $10::text, $11::text
  )
`;

export class ProjectCertificateError extends Error {
  constructor(message, code = 'PROJECT_CERTIFICATE_INVALID', status = 400) {
    super(message);
    this.name = 'ProjectCertificateError';
    this.code = code;
    this.status = status;
  }
}

function invalid(message, code = 'PROJECT_CERTIFICATE_INVALID', status = 400) {
  throw new ProjectCertificateError(message, code, status);
}

function persistenceError() {
  return new ProjectCertificateError(
    'La persistencia devolvió un certificado inválido.',
    'PROJECT_CERTIFICATE_PERSISTENCE_CONTRACT_INVALID',
    500,
  );
}

function strictObject(value, field = 'body') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    invalid(`${field} debe ser un objeto.`);
  }
  return value;
}

function exactFields(value, fields, required = fields, field = 'body') {
  const keys = Object.keys(value);
  const unknown = keys.find((key) => !fields.has(key));
  if (unknown) invalid(`${field}.${unknown} no está permitido.`);
  const missing = [...required].find((key) => !Object.hasOwn(value, key));
  if (missing) invalid(`${field}.${missing} es obligatorio.`);
}

function exactStoredFields(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw persistenceError();
  const keys = Object.keys(value);
  if (
    keys.length !== fields.size
    || keys.some((key) => !fields.has(key))
    || [...fields].some((key) => !Object.hasOwn(value, key))
  ) throw persistenceError();
  return value;
}

function identifier(value, field, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (typeof value !== 'string' || !IDENTIFIER_PATTERN.test(value)) invalid(`${field} es inválido.`);
  return value;
}

function storedIdentifier(value, field, options) {
  try {
    return identifier(value, field, options);
  } catch {
    throw persistenceError();
  }
}

function integer(value, field, { minimum = 0, maximum = PG_INTEGER_MAX } = {}) {
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
    throw persistenceError();
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
    throw persistenceError();
  }
}

function hash(value, field) {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) invalid(`${field} es inválido.`);
  return value;
}

function storedHash(value, field) {
  try {
    return hash(value, field);
  } catch {
    throw persistenceError();
  }
}

function storedEnum(value, values) {
  if (typeof value !== 'string' || !values.has(value)) throw persistenceError();
  return value;
}

function storedBoolean(value) {
  if (typeof value !== 'boolean') throw persistenceError();
  return value;
}

function storedDateTime(value) {
  const parsed = typeof value === 'string' ? new Date(value) : null;
  if (
    typeof value !== 'string'
    || !EXACT_TIMESTAMP_PATTERN.test(value)
    || Number.isNaN(parsed.getTime())
    || parsed.toISOString() !== value
  ) throw persistenceError();
  return value;
}

function periodForDate(value, field = 'periodDate') {
  try {
    const period = civilFortnightForDate(value);
    return Object.freeze({ start: period.start, end: period.end });
  } catch {
    invalid(`${field} debe ser una fecha civil válida con formato YYYY-MM-DD.`, 'PROJECT_CERTIFICATE_PERIOD_INVALID');
  }
}

function storedCivilDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw persistenceError();
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
    || parsed.toISOString().slice(0, 10) !== value
  ) throw persistenceError();
  return value;
}

function canonicalPositiveMinor(value, field) {
  if (typeof value !== 'string' || value !== value.trim() || !POSITIVE_MINOR_PATTERN.test(value)) {
    invalid(`${field} debe ser un entero positivo canónico en minor units.`);
  }
  if (BigInt(value) > MAX_SIGNED_BIGINT) invalid(`${field} excede BIGINT.`);
  return value;
}

function storedMinor(value, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  const text = typeof value === 'bigint' ? value.toString() : value;
  if (typeof text !== 'string' || !NONNEGATIVE_MINOR_PATTERN.test(text)) throw persistenceError();
  if (BigInt(text) > MAX_SIGNED_BIGINT) throw persistenceError();
  return text;
}

function storedPositiveBigInt(value) {
  const text = typeof value === 'bigint' ? value.toString() : value;
  if (typeof text !== 'string' || !POSITIVE_MINOR_PATTERN.test(text)) throw persistenceError();
  if (BigInt(text) > MAX_SIGNED_BIGINT) throw persistenceError();
  return text;
}

function storedQuantity(value, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (typeof value !== 'string' || !QUANTITY_PATTERN.test(value)) throw persistenceError();
  return value;
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

export function requireProjectCertificateIdempotencyKey(value) {
  const key = typeof value === 'string' ? value : value?.headers?.get?.('Idempotency-Key');
  if (typeof key !== 'string' || !IDEMPOTENCY_KEY_PATTERN.test(key)) {
    invalid(
      'Idempotency-Key debe tener entre 8 y 128 caracteres seguros.',
      'PROJECT_CERTIFICATE_IDEMPOTENCY_KEY_INVALID',
    );
  }
  return key;
}

export function normalizeProjectCertificateReadQuery(requestOrValue) {
  const params = requestOrValue instanceof URLSearchParams
    ? requestOrValue
    : new URL(requestOrValue.url).searchParams;
  for (const [key] of params) {
    if (key !== 'periodDate' || params.getAll(key).length !== 1) {
      invalid('La consulta del certificado es inválida.', 'PROJECT_CERTIFICATE_QUERY_INVALID');
    }
  }
  if (!params.has('periodDate')) {
    invalid('periodDate es obligatorio.', 'PROJECT_CERTIFICATE_QUERY_INVALID');
  }
  return Object.freeze({ period: periodForDate(params.get('periodDate')) });
}

function normalizeDeduction(value, index) {
  const field = `deductions[${index}]`;
  const deduction = strictObject(value, field);
  const fields = new Set(['code', 'reason', 'amountMinor']);
  exactFields(deduction, fields, fields, field);
  if (typeof deduction.code !== 'string' || !DEDUCTION_CODE_PATTERN.test(deduction.code)) {
    invalid(`${field}.code es inválido.`);
  }
  return Object.freeze({
    code: deduction.code,
    reason: boundedText(deduction.reason, `${field}.reason`, { maximum: 1_000 }),
    amountMinor: canonicalPositiveMinor(deduction.amountMinor, `${field}.amountMinor`),
  });
}

export function normalizeProjectCertificatePrepare(input, operationKey) {
  const body = strictObject(input);
  const fields = new Set([
    'periodDate', 'expectedBookRevision', 'expectedPeriodHeadRevision',
    'expectedCurrentApprovedVersionId', 'deductions',
  ]);
  exactFields(body, fields);
  if (!Array.isArray(body.deductions) || body.deductions.length > 50) {
    invalid('deductions debe ser un array de hasta 50 elementos.');
  }
  const deductions = body.deductions.map(normalizeDeduction);
  if (new Set(deductions.map((deduction) => deduction.code)).size !== deductions.length) {
    invalid('Cada código de deducción debe ser único.', 'PROJECT_CERTIFICATE_DEDUCTIONS_INVALID', 422);
  }
  return Object.freeze({
    period: periodForDate(body.periodDate),
    expectedBookRevision: integer(body.expectedBookRevision, 'expectedBookRevision'),
    expectedPeriodHeadRevision: integer(body.expectedPeriodHeadRevision, 'expectedPeriodHeadRevision'),
    expectedCurrentApprovedVersionId: identifier(
      body.expectedCurrentApprovedVersionId,
      'expectedCurrentApprovedVersionId',
      { nullable: true },
    ),
    deductions: Object.freeze(deductions),
    operationKey: requireProjectCertificateIdempotencyKey(operationKey),
  });
}

export function normalizeProjectCertificateDecision(input, operationKey) {
  const body = strictObject(input);
  const fields = new Set([
    'expectedBookRevision', 'expectedPeriodHeadRevision', 'expectedCertificateDigest',
    'decision', 'reason',
  ]);
  exactFields(body, fields);
  if (typeof body.decision !== 'string' || !WIRE_DECISION_SET.has(body.decision)) {
    invalid('decision es inválida.');
  }
  return Object.freeze({
    expectedBookRevision: integer(body.expectedBookRevision, 'expectedBookRevision', { minimum: 1 }),
    expectedPeriodHeadRevision: integer(
      body.expectedPeriodHeadRevision,
      'expectedPeriodHeadRevision',
      { minimum: 1 },
    ),
    expectedCertificateDigest: hash(body.expectedCertificateDigest, 'expectedCertificateDigest'),
    decision: body.decision,
    reason: boundedText(body.reason, 'reason', { maximum: 1_000 }),
    operationKey: requireProjectCertificateIdempotencyKey(operationKey),
  });
}

function fingerprint(operationKind, command) {
  const payload = Object.fromEntries(Object.entries(command).filter(
    ([key]) => key !== 'operationKey' && key !== 'requestFingerprint',
  ));
  return createHash('sha256').update(JSON.stringify({ operationKind, ...payload })).digest('hex');
}

const DATABASE_ERRORS = Object.freeze([
  [['IDEMPOTENCY_CONFLICT'], 'PROJECT_CERTIFICATE_IDEMPOTENCY_CONFLICT', 409, 'La clave de idempotencia ya fue usada con otro contenido.'],
  [['P0002', 'NO_DATA_FOUND', 'SCOPE_INVALID', '_NOT_FOUND'], 'PROJECT_CERTIFICATE_NOT_FOUND', 404, 'No se encontró el certificado en la obra activa.'],
  [['_READ_FORBIDDEN', '_PREPARER_REQUIRED', '_CERTIFIER_REQUIRED', '_CANCELLER_REQUIRED', '_MAKER_INVALID'], 'PROJECT_CERTIFICATE_FORBIDDEN', 403, 'No tenés la membresía activa o designación requerida para esta operación.'],
  [['P2034', '40001', '_STALE', '_CAS_', '_UNCHANGED', '_PENDING_REVIEW', '_PENDING_REQUIRED', '_CANCEL_NOT_ORPHANED', '_NOT_READY'], 'PROJECT_CERTIFICATE_CONFLICT', 409, 'El certificado cambió o no está listo. Actualizá antes de continuar.'],
  [['_NET_NEGATIVE', '_AMOUNT_OVERFLOW', '_DEDUCTIONS_INVALID', '_POLICY_UNSUPPORTED', '_BASIS_MISMATCH', '_RETROACTIVE_'], 'PROJECT_CERTIFICATE_SEMANTIC_INVALID', 422, 'El certificado no cumple los invariantes requeridos.'],
]);

function databaseError(error) {
  const text = [
    error?.code,
    error?.message,
    error?.meta?.code,
    error?.meta?.message,
    error?.meta?.database_error,
  ].filter((value) => typeof value === 'string').join(' ').toUpperCase();
  for (const [markers, code, status, message] of DATABASE_ERRORS) {
    if (markers.some((marker) => text.includes(marker))) {
      return new ProjectCertificateError(message, code, status);
    }
  }
  return null;
}

export function projectCertificateErrorResponse(error) {
  if (!(error instanceof ProjectCertificateError)) return null;
  return Response.json({ error: error.message, code: error.code }, {
    status: error.status,
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  });
}

const SOURCE_FIELDS = new Set([
  'cutId', 'cutCandidateDigest', 'cutIntegrityDigest', 'contractHeadId',
  'contractVersionId', 'contractDigest', 'authorityVersionId', 'authorityDigest',
]);
const TERMS_FIELDS = new Set([
  'currencyCode', 'currencyMinorUnits', 'retentionBps', 'contractRoundingPolicyVersion',
  'certificateGrossPolicyVersion', 'certificateRetentionPolicyVersion',
  'adjustmentPolicyVersion',
]);
const PERIOD_FIELDS = new Set(['start', 'end']);
const TOTAL_FIELDS = new Set([
  'previousApprovedCumulativeGrossMinor', 'cumulativeGrossMinor',
  'certificateIncrementGrossMinor', 'previousApprovedCumulativeRetentionMinor',
  'cumulativeRetentionMinor', 'certificateIncrementRetentionMinor',
]);
const CERTIFICATE_TOTAL_FIELDS = new Set([
  ...TOTAL_FIELDS, 'certificateIncrementDeductionsMinor', 'certificateIncrementNetMinor',
]);
const CANDIDATE_LINE_FIELDS = new Set([
  'ordinal', 'state', 'cutState', 'taskId', 'taskCode', 'taskTitle', 'taskRevision',
  'cutLineId', 'cutLineDigest', 'contractLineId', 'contractLineDigest', 'unitCode',
  'baseQuantity', 'periodQuantity', 'cumulativeQuantity',
  'technicalCumulativeOriginPeriodStart', 'previousApprovedCumulativeGrossMinor',
  'cumulativeGrossMinor', 'certificateIncrementGrossMinor', 'noClaimReason',
]);
const CERTIFICATE_LINE_FIELDS = new Set([...CANDIDATE_LINE_FIELDS, 'integrityDigest']);
const CANDIDATE_FIELDS = new Set([
  'period', 'mode', 'expectedBookRevision', 'expectedPeriodHeadRevision',
  'expectedCurrentApprovedVersionId', 'coverageFrom', 'coverageThrough',
  'previousApprovedCertificateVersionId', 'supersedesApprovedVersionId', 'source',
  'terms', 'lineCount', 'valuedLineCount', 'noClaimLineCount', 'totals', 'lines',
]);
const DECISION_FIELDS = new Set([
  'id', 'decision', 'reason', 'decidedByMembershipId', 'decidedAt',
]);
const DEDUCTION_FIELDS = new Set(['ordinal', 'code', 'reason', 'amountMinor', 'integrityDigest']);
const CERTIFICATE_SUMMARY_FIELDS = new Set([
  'id', 'projectSequence', 'periodVersion', 'predecessorId', 'supersedesApprovedVersionId',
  'previousApprovedCertificateVersionId', 'period', 'coverageFrom', 'coverageThrough',
  'source', 'terms', 'preparedByMembershipId', 'preparedAt', 'lineCount',
  'valuedLineCount', 'noClaimLineCount', 'deductionCount', 'totals', 'candidateDigest',
  'integrityDigest', 'decision',
]);
const CERTIFICATE_FULL_FIELDS = new Set([...CERTIFICATE_SUMMARY_FIELDS, 'lines', 'deductions']);
const BOOK_FIELDS = new Set([
  'id', 'revision', 'pinnedContractHeadId', 'pinnedContractVersionId',
  'pinnedAuthorityVersionId', 'latestApprovedPeriodStart',
  'latestApprovedCertificateVersionId', 'pendingCertificateVersionId',
]);
const PERIOD_HEAD_FIELDS = new Set([
  'id', 'revision', 'currentApprovedVersionId', 'latestVersionId',
]);
const READINESS_FIELDS = new Set([
  'state', 'mode', 'blockingReasons', 'candidateReady',
]);
const READ_CAPABILITY_FIELDS = new Set(['allowed', 'reasonCode']);
const PREPARE_CAPABILITY_FIELDS = new Set(['allowed', 'reasonCode', 'expectedActorMembershipId']);
const DECISION_CAPABILITY_FIELDS = new Set([
  'allowed', 'reasonCode', 'expectedActorMembershipId', 'targetId',
]);
const CAPABILITIES_FIELDS = new Set(['read', 'prepare', 'approve', 'reject', 'cancel']);
const READ_ROOT_FIELDS = new Set([
  'book', 'periodHead', 'currentApprovedCertificate', 'pendingCertificate',
  'history', 'readiness', 'candidate', 'capabilities',
]);
const RECEIPT_FIELDS = new Set([
  'operationReceiptId', 'operationKind', 'certificateVersionId', 'decisionId',
  'actorMembershipId', 'bookRevisionAfter', 'periodHeadRevisionAfter', 'replayed',
]);
const MUTATION_ROOT_FIELDS = new Set(['receipt', 'certificate', 'decision', 'book', 'periodHead']);

function serializePeriod(value) {
  const period = exactStoredFields(value, PERIOD_FIELDS);
  const start = storedCivilDate(period.start);
  const end = storedCivilDate(period.end);
  let canonical;
  try {
    canonical = civilFortnightForDate(start);
  } catch {
    throw persistenceError();
  }
  if (canonical.start !== start || canonical.end !== end) throw persistenceError();
  return { start, end };
}

function serializeSource(value) {
  const source = exactStoredFields(value, SOURCE_FIELDS);
  return {
    cutId: storedIdentifier(source.cutId, 'source.cutId'),
    cutCandidateDigest: storedHash(source.cutCandidateDigest, 'source.cutCandidateDigest'),
    cutIntegrityDigest: storedHash(source.cutIntegrityDigest, 'source.cutIntegrityDigest'),
    contractHeadId: storedIdentifier(source.contractHeadId, 'source.contractHeadId'),
    contractVersionId: storedIdentifier(source.contractVersionId, 'source.contractVersionId'),
    contractDigest: storedHash(source.contractDigest, 'source.contractDigest'),
    authorityVersionId: storedIdentifier(source.authorityVersionId, 'source.authorityVersionId'),
    authorityDigest: storedHash(source.authorityDigest, 'source.authorityDigest'),
  };
}

function serializeTerms(value) {
  const terms = exactStoredFields(value, TERMS_FIELDS);
  const result = {
    currencyCode: storedEnum(terms.currencyCode, CURRENCY_SET),
    currencyMinorUnits: storedInteger(terms.currencyMinorUnits, 'terms.currencyMinorUnits', { minimum: 2, maximum: 2 }),
    retentionBps: storedInteger(terms.retentionBps, 'terms.retentionBps', { maximum: 10_000 }),
    contractRoundingPolicyVersion: terms.contractRoundingPolicyVersion,
    certificateGrossPolicyVersion: terms.certificateGrossPolicyVersion,
    certificateRetentionPolicyVersion: terms.certificateRetentionPolicyVersion,
    adjustmentPolicyVersion: terms.adjustmentPolicyVersion,
  };
  if (
    result.contractRoundingPolicyVersion !== 'CERT_RETENTION_HALF_UP_V1'
    || result.certificateGrossPolicyVersion !== 'CERT_CUMULATIVE_GROSS_HALF_UP_V1'
    || result.certificateRetentionPolicyVersion !== 'CERT_CUMULATIVE_RETENTION_HALF_UP_V1'
    || result.adjustmentPolicyVersion !== 'NONE'
  ) throw persistenceError();
  return result;
}

function serializeTotals(value, fields) {
  const totals = exactStoredFields(value, fields);
  const result = Object.fromEntries([...fields].map((field) => [field, storedMinor(totals[field])]));
  if (
    BigInt(result.previousApprovedCumulativeGrossMinor)
      + BigInt(result.certificateIncrementGrossMinor) !== BigInt(result.cumulativeGrossMinor)
    || BigInt(result.previousApprovedCumulativeRetentionMinor)
      + BigInt(result.certificateIncrementRetentionMinor) !== BigInt(result.cumulativeRetentionMinor)
  ) throw persistenceError();
  if (fields.has('certificateIncrementDeductionsMinor')) {
    const expectedNet = BigInt(result.certificateIncrementGrossMinor)
      - BigInt(result.certificateIncrementRetentionMinor)
      - BigInt(result.certificateIncrementDeductionsMinor);
    if (expectedNet < 0n || expectedNet !== BigInt(result.certificateIncrementNetMinor)) {
      throw persistenceError();
    }
  }
  return result;
}

function nullableStoredIdentifier(value, field) {
  return value === null ? null : storedIdentifier(value, field);
}

function nullableStoredText(value, field, maximum = 1_000) {
  return value === null ? null : storedText(value, field, { maximum });
}

function serializeLine(value, expectedOrdinal, { certificate = false } = {}) {
  const line = exactStoredFields(value, certificate ? CERTIFICATE_LINE_FIELDS : CANDIDATE_LINE_FIELDS);
  const state = storedEnum(line.state, LINE_STATE_SET);
  const result = {
    ordinal: storedInteger(line.ordinal, 'line.ordinal', { minimum: 1, maximum: 5_000 }),
    state,
    cutState: storedEnum(line.cutState, CUT_STATE_SET),
    taskId: storedIdentifier(line.taskId, 'line.taskId'),
    taskCode: nullableStoredText(line.taskCode, 'line.taskCode', 64),
    taskTitle: storedText(line.taskTitle, 'line.taskTitle', { maximum: 10_000 }),
    taskRevision: storedInteger(line.taskRevision, 'line.taskRevision'),
    cutLineId: storedIdentifier(line.cutLineId, 'line.cutLineId'),
    cutLineDigest: storedHash(line.cutLineDigest, 'line.cutLineDigest'),
    contractLineId: storedIdentifier(line.contractLineId, 'line.contractLineId'),
    contractLineDigest: storedHash(line.contractLineDigest, 'line.contractLineDigest'),
    unitCode: line.unitCode === null ? null : storedEnum(line.unitCode, UNIT_SET),
    baseQuantity: storedQuantity(line.baseQuantity, { nullable: true }),
    periodQuantity: storedQuantity(line.periodQuantity, { nullable: true }),
    cumulativeQuantity: storedQuantity(line.cumulativeQuantity, { nullable: true }),
    technicalCumulativeOriginPeriodStart: line.technicalCumulativeOriginPeriodStart === null
      ? null
      : storedCivilDate(line.technicalCumulativeOriginPeriodStart),
    previousApprovedCumulativeGrossMinor: storedMinor(
      line.previousApprovedCumulativeGrossMinor,
      { nullable: true },
    ),
    cumulativeGrossMinor: storedMinor(line.cumulativeGrossMinor, { nullable: true }),
    certificateIncrementGrossMinor: storedMinor(
      line.certificateIncrementGrossMinor,
      { nullable: true },
    ),
    noClaimReason: nullableStoredText(line.noClaimReason, 'line.noClaimReason'),
  };
  if (certificate) result.integrityDigest = storedHash(line.integrityDigest, 'line.integrityDigest');
  if (result.ordinal !== expectedOrdinal) throw persistenceError();
  const valuedFields = [
    'unitCode', 'baseQuantity', 'periodQuantity', 'cumulativeQuantity',
    'technicalCumulativeOriginPeriodStart', 'previousApprovedCumulativeGrossMinor',
    'cumulativeGrossMinor', 'certificateIncrementGrossMinor',
  ];
  if (state === 'VALUED') {
    if (
      result.cutState !== 'MEASURED'
      || valuedFields.some((field) => result[field] === null)
      || result.baseQuantity === '0.0000'
      || BigInt(result.previousApprovedCumulativeGrossMinor)
        + BigInt(result.certificateIncrementGrossMinor) !== BigInt(result.cumulativeGrossMinor)
      || result.noClaimReason !== null
    ) {
      throw persistenceError();
    }
  } else if (valuedFields.some((field) => result[field] !== null) || result.noClaimReason === null) {
    throw persistenceError();
  }
  return result;
}

function serializeCandidate(value) {
  if (value === null) return null;
  const candidate = exactStoredFields(value, CANDIDATE_FIELDS);
  const lineCount = storedInteger(candidate.lineCount, 'candidate.lineCount', { minimum: 1, maximum: 5_000 });
  const valuedLineCount = storedInteger(candidate.valuedLineCount, 'candidate.valuedLineCount', { minimum: 1, maximum: 5_000 });
  const noClaimLineCount = storedInteger(candidate.noClaimLineCount, 'candidate.noClaimLineCount', { maximum: 5_000 });
  if (!Array.isArray(candidate.lines) || candidate.lines.length !== lineCount || lineCount !== valuedLineCount + noClaimLineCount) {
    throw persistenceError();
  }
  const lines = candidate.lines.map((line, index) => serializeLine(line, index + 1));
  if (new Set(lines.map((line) => line.taskId)).size !== lineCount) throw persistenceError();
  const result = {
    period: serializePeriod(candidate.period),
    mode: storedEnum(candidate.mode, MODE_SET),
    expectedBookRevision: storedInteger(candidate.expectedBookRevision, 'candidate.expectedBookRevision'),
    expectedPeriodHeadRevision: storedInteger(candidate.expectedPeriodHeadRevision, 'candidate.expectedPeriodHeadRevision'),
    expectedCurrentApprovedVersionId: nullableStoredIdentifier(
      candidate.expectedCurrentApprovedVersionId,
      'candidate.expectedCurrentApprovedVersionId',
    ),
    coverageFrom: storedCivilDate(candidate.coverageFrom),
    coverageThrough: storedCivilDate(candidate.coverageThrough),
    previousApprovedCertificateVersionId: nullableStoredIdentifier(
      candidate.previousApprovedCertificateVersionId,
      'candidate.previousApprovedCertificateVersionId',
    ),
    supersedesApprovedVersionId: nullableStoredIdentifier(
      candidate.supersedesApprovedVersionId,
      'candidate.supersedesApprovedVersionId',
    ),
    source: serializeSource(candidate.source),
    terms: serializeTerms(candidate.terms),
    lineCount,
    valuedLineCount,
    noClaimLineCount,
    totals: serializeTotals(candidate.totals, TOTAL_FIELDS),
    lines,
  };
  const summedLineTotals = lines.reduce((totalsByLine, line) => {
    if (line.state === 'NO_CLAIM') return totalsByLine;
    return {
      previous: totalsByLine.previous + BigInt(line.previousApprovedCumulativeGrossMinor),
      cumulative: totalsByLine.cumulative + BigInt(line.cumulativeGrossMinor),
      increment: totalsByLine.increment + BigInt(line.certificateIncrementGrossMinor),
    };
  }, { previous: 0n, cumulative: 0n, increment: 0n });
  if (
    result.coverageThrough !== result.period.end
    || result.coverageFrom > result.coverageThrough
    || lines.some((line) => (
      line.state === 'VALUED'
      && line.technicalCumulativeOriginPeriodStart > result.period.start
    ))
    || summedLineTotals.previous !== BigInt(result.totals.previousApprovedCumulativeGrossMinor)
    || summedLineTotals.cumulative !== BigInt(result.totals.cumulativeGrossMinor)
    || summedLineTotals.increment !== BigInt(result.totals.certificateIncrementGrossMinor)
    || (result.mode === 'FIRST' && (
      result.previousApprovedCertificateVersionId !== null
      || result.supersedesApprovedVersionId !== null
      || result.expectedCurrentApprovedVersionId !== null
    ))
    || (result.mode === 'NEXT_PERIOD' && (
      result.previousApprovedCertificateVersionId === null
      || result.supersedesApprovedVersionId !== null
      || result.expectedCurrentApprovedVersionId !== null
    ))
    || (result.mode === 'CORRECTION' && (
      result.supersedesApprovedVersionId === null
      || result.expectedCurrentApprovedVersionId !== result.supersedesApprovedVersionId
    ))
  ) throw persistenceError();
  return result;
}

function serializeDecision(value) {
  if (value === null) return null;
  const decision = exactStoredFields(value, DECISION_FIELDS);
  return {
    id: storedIdentifier(decision.id, 'decision.id'),
    decision: storedEnum(decision.decision, STORED_DECISION_SET),
    reason: storedText(decision.reason, 'decision.reason', { maximum: 1_000 }),
    decidedByMembershipId: storedIdentifier(decision.decidedByMembershipId, 'decision.decidedByMembershipId'),
    decidedAt: storedDateTime(decision.decidedAt),
  };
}

function serializeDeduction(value, expectedOrdinal) {
  const deduction = exactStoredFields(value, DEDUCTION_FIELDS);
  const result = {
    ordinal: storedInteger(deduction.ordinal, 'deduction.ordinal', { minimum: 1, maximum: 50 }),
    code: deduction.code,
    reason: storedText(deduction.reason, 'deduction.reason', { maximum: 1_000 }),
    amountMinor: storedMinor(deduction.amountMinor),
    integrityDigest: storedHash(deduction.integrityDigest, 'deduction.integrityDigest'),
  };
  if (!DEDUCTION_CODE_PATTERN.test(result.code) || result.amountMinor === '0' || result.ordinal !== expectedOrdinal) {
    throw persistenceError();
  }
  return result;
}

export function serializeProjectCertificate(value, { summary = false } = {}) {
  if (value === null) return null;
  const certificate = exactStoredFields(
    value,
    summary ? CERTIFICATE_SUMMARY_FIELDS : CERTIFICATE_FULL_FIELDS,
  );
  const lineCount = storedInteger(certificate.lineCount, 'certificate.lineCount', { minimum: 1, maximum: 5_000 });
  const valuedLineCount = storedInteger(certificate.valuedLineCount, 'certificate.valuedLineCount', { minimum: 1, maximum: 5_000 });
  const noClaimLineCount = storedInteger(certificate.noClaimLineCount, 'certificate.noClaimLineCount', { maximum: 5_000 });
  const deductionCount = storedInteger(certificate.deductionCount, 'certificate.deductionCount', { maximum: 50 });
  if (lineCount !== valuedLineCount + noClaimLineCount) {
    throw persistenceError();
  }
  const result = {
    id: storedIdentifier(certificate.id, 'certificate.id'),
    projectSequence: storedPositiveBigInt(certificate.projectSequence),
    periodVersion: storedInteger(certificate.periodVersion, 'certificate.periodVersion', { minimum: 1 }),
    predecessorId: nullableStoredIdentifier(certificate.predecessorId, 'certificate.predecessorId'),
    supersedesApprovedVersionId: nullableStoredIdentifier(certificate.supersedesApprovedVersionId, 'certificate.supersedesApprovedVersionId'),
    previousApprovedCertificateVersionId: nullableStoredIdentifier(certificate.previousApprovedCertificateVersionId, 'certificate.previousApprovedCertificateVersionId'),
    period: serializePeriod(certificate.period),
    coverageFrom: storedCivilDate(certificate.coverageFrom),
    coverageThrough: storedCivilDate(certificate.coverageThrough),
    source: serializeSource(certificate.source),
    terms: serializeTerms(certificate.terms),
    preparedByMembershipId: storedIdentifier(certificate.preparedByMembershipId, 'certificate.preparedByMembershipId'),
    preparedAt: storedDateTime(certificate.preparedAt),
    lineCount,
    valuedLineCount,
    noClaimLineCount,
    deductionCount,
    totals: serializeTotals(certificate.totals, CERTIFICATE_TOTAL_FIELDS),
    candidateDigest: storedHash(certificate.candidateDigest, 'certificate.candidateDigest'),
    integrityDigest: storedHash(certificate.integrityDigest, 'certificate.integrityDigest'),
    decision: serializeDecision(certificate.decision),
  };
  if (!summary) {
    if (!Array.isArray(certificate.lines) || certificate.lines.length !== lineCount) throw persistenceError();
    if (!Array.isArray(certificate.deductions) || certificate.deductions.length !== deductionCount) throw persistenceError();
    result.lines = certificate.lines.map((line, index) => serializeLine(line, index + 1, { certificate: true }));
    result.deductions = certificate.deductions.map(
      (deduction, index) => serializeDeduction(deduction, index + 1),
    );
    const summedLines = result.lines.reduce((totalsByLine, line) => {
      if (line.state === 'NO_CLAIM') return totalsByLine;
      return {
        previous: totalsByLine.previous + BigInt(line.previousApprovedCumulativeGrossMinor),
        cumulative: totalsByLine.cumulative + BigInt(line.cumulativeGrossMinor),
        increment: totalsByLine.increment + BigInt(line.certificateIncrementGrossMinor),
      };
    }, { previous: 0n, cumulative: 0n, increment: 0n });
    const summedDeductions = result.deductions.reduce(
      (sum, deduction) => sum + BigInt(deduction.amountMinor),
      0n,
    );
    if (
      new Set(result.lines.map((line) => line.taskId)).size !== lineCount
      || new Set(result.deductions.map((deduction) => deduction.code)).size !== deductionCount
      || summedLines.previous !== BigInt(result.totals.previousApprovedCumulativeGrossMinor)
      || summedLines.cumulative !== BigInt(result.totals.cumulativeGrossMinor)
      || summedLines.increment !== BigInt(result.totals.certificateIncrementGrossMinor)
      || summedDeductions !== BigInt(result.totals.certificateIncrementDeductionsMinor)
    ) throw persistenceError();
  }
  if (
    result.coverageThrough !== result.period.end
    || result.coverageFrom > result.coverageThrough
    || (result.periodVersion === 1) !== (result.predecessorId === null)
    || (result.decision !== null && result.decision.decidedAt < result.preparedAt)
    || (!summary && result.lines.some((line) => (
      line.state === 'VALUED'
      && line.technicalCumulativeOriginPeriodStart > result.period.start
    )))
  ) throw persistenceError();
  return result;
}

function serializeBook(value) {
  if (value === null) return null;
  const book = exactStoredFields(value, BOOK_FIELDS);
  const result = {
    id: storedIdentifier(book.id, 'book.id'),
    revision: storedInteger(book.revision, 'book.revision'),
    pinnedContractHeadId: nullableStoredIdentifier(book.pinnedContractHeadId, 'book.pinnedContractHeadId'),
    pinnedContractVersionId: nullableStoredIdentifier(book.pinnedContractVersionId, 'book.pinnedContractVersionId'),
    pinnedAuthorityVersionId: nullableStoredIdentifier(book.pinnedAuthorityVersionId, 'book.pinnedAuthorityVersionId'),
    latestApprovedPeriodStart: book.latestApprovedPeriodStart === null ? null : storedCivilDate(book.latestApprovedPeriodStart),
    latestApprovedCertificateVersionId: nullableStoredIdentifier(book.latestApprovedCertificateVersionId, 'book.latestApprovedCertificateVersionId'),
    pendingCertificateVersionId: nullableStoredIdentifier(book.pendingCertificateVersionId, 'book.pendingCertificateVersionId'),
  };
  const pins = [
    result.pinnedContractHeadId,
    result.pinnedContractVersionId,
    result.pinnedAuthorityVersionId,
  ];
  if (
    pins.some((pin) => pin === null) && pins.some((pin) => pin !== null)
    || (result.latestApprovedPeriodStart === null)
      !== (result.latestApprovedCertificateVersionId === null)
    || (pins[0] === null) !== (result.latestApprovedCertificateVersionId === null)
  ) throw persistenceError();
  return result;
}

function serializePeriodHead(value) {
  if (value === null) return null;
  const head = exactStoredFields(value, PERIOD_HEAD_FIELDS);
  return {
    id: storedIdentifier(head.id, 'periodHead.id'),
    revision: storedInteger(head.revision, 'periodHead.revision'),
    currentApprovedVersionId: nullableStoredIdentifier(head.currentApprovedVersionId, 'periodHead.currentApprovedVersionId'),
    latestVersionId: nullableStoredIdentifier(head.latestVersionId, 'periodHead.latestVersionId'),
  };
}

function capabilityReason(value) {
  if (value === null) return null;
  return storedEnum(value, CAPABILITY_REASON_SET);
}

function serializeCapability(value, fields, { decision = false } = {}) {
  const capability = exactStoredFields(value, fields);
  const result = {
    allowed: storedBoolean(capability.allowed),
    reasonCode: capabilityReason(capability.reasonCode),
  };
  if (fields.has('expectedActorMembershipId')) {
    result.expectedActorMembershipId = nullableStoredIdentifier(
      capability.expectedActorMembershipId,
      'capability.expectedActorMembershipId',
    );
  }
  if (decision) result.targetId = nullableStoredIdentifier(capability.targetId, 'capability.targetId');
  if (result.allowed) {
    if (
      result.reasonCode !== null
      || (fields.has('expectedActorMembershipId') && result.expectedActorMembershipId === null)
      || (decision && result.targetId === null)
    ) throw persistenceError();
  } else if (result.reasonCode === null) throw persistenceError();
  return result;
}

function serializeCapabilities(value) {
  const capabilities = exactStoredFields(value, CAPABILITIES_FIELDS);
  const result = {
    read: serializeCapability(capabilities.read, READ_CAPABILITY_FIELDS),
    prepare: serializeCapability(capabilities.prepare, PREPARE_CAPABILITY_FIELDS),
    approve: serializeCapability(capabilities.approve, DECISION_CAPABILITY_FIELDS, { decision: true }),
    reject: serializeCapability(capabilities.reject, DECISION_CAPABILITY_FIELDS, { decision: true }),
    cancel: serializeCapability(capabilities.cancel, DECISION_CAPABILITY_FIELDS, { decision: true }),
  };
  if (!result.read.allowed || result.read.reasonCode !== null) throw persistenceError();
  return result;
}

function serializeReadiness(value, candidate) {
  const readiness = exactStoredFields(value, READINESS_FIELDS);
  const state = storedEnum(readiness.state, READINESS_STATE_SET);
  const mode = readiness.mode === null ? null : storedEnum(readiness.mode, MODE_SET);
  if (!Array.isArray(readiness.blockingReasons)) throw persistenceError();
  const blockingReasons = readiness.blockingReasons.map((reason) => storedEnum(reason, BLOCKER_CODE_SET));
  if (
    new Set(blockingReasons).size !== blockingReasons.length
    || blockingReasons.some((reason, index) => index > 0 && BLOCKER_ORDER.get(reason) <= BLOCKER_ORDER.get(blockingReasons[index - 1]))
  ) throw persistenceError();
  const candidateReady = storedBoolean(readiness.candidateReady);
  if (state === 'READY') {
    if (mode === null || blockingReasons.length !== 0 || !candidateReady || candidate === null) throw persistenceError();
  } else if (state === 'UP_TO_DATE') {
    if (mode !== null || blockingReasons.length !== 0 || candidateReady || candidate !== null) throw persistenceError();
  } else if (mode !== null || blockingReasons.length === 0 || candidateReady || candidate !== null) {
    throw persistenceError();
  }
  return { state, mode, blockingReasons, candidateReady };
}

export function serializeProjectCertificateSnapshot(raw, command) {
  const snapshot = exactStoredFields(raw, READ_ROOT_FIELDS);
  const candidate = serializeCandidate(snapshot.candidate);
  if (!Array.isArray(snapshot.history) || snapshot.history.length > PROJECT_CERTIFICATE_HISTORY_LIMIT) {
    throw persistenceError();
  }
  const history = snapshot.history.map((item) => serializeProjectCertificate(item, { summary: true }));
  const ids = new Set();
  let previousVersion = Number.MAX_SAFE_INTEGER;
  for (const item of history) {
    if (
      ids.has(item.id)
      || item.period.start !== command.period.start
      || item.period.end !== command.period.end
      || item.periodVersion >= previousVersion
    ) throw persistenceError();
    ids.add(item.id);
    previousVersion = item.periodVersion;
  }
  const book = serializeBook(snapshot.book);
  const periodHead = serializePeriodHead(snapshot.periodHead);
  const current = serializeProjectCertificate(snapshot.currentApprovedCertificate);
  const pending = serializeProjectCertificate(snapshot.pendingCertificate);
  const readiness = serializeReadiness(snapshot.readiness, candidate);
  const capabilities = serializeCapabilities(snapshot.capabilities);
  const expectedBookRevision = book?.revision ?? 0;
  const expectedPeriodHeadRevision = periodHead?.revision ?? 0;
  const expectedCurrentApprovedVersionId = periodHead?.currentApprovedVersionId ?? null;
  const pendingId = book?.pendingCertificateVersionId ?? null;
  const decisionCapabilities = [capabilities.approve, capabilities.reject, capabilities.cancel];
  const provenanceSnapshots = [candidate, current, pending].filter(Boolean);
  const historyIds = new Set(history.map((item) => item.id));
  const pendingTargetsRequestedPeriod = pending !== null
    && pending.period.start === command.period.start
    && pending.period.end === command.period.end;
  if (
    (book === null && periodHead !== null)
    || (book === null && (current !== null || pending !== null))
    || (current !== null && current.decision?.decision !== 'APPROVED')
    || (readiness.state === 'UP_TO_DATE' && current === null)
    || (pending !== null && pending.decision !== null)
    || (pending !== null && book?.pendingCertificateVersionId !== pending.id)
    || (pending === null && book !== null && book.pendingCertificateVersionId !== null)
    || (current !== null && periodHead?.currentApprovedVersionId !== current.id)
    || (current === null && periodHead !== null && periodHead.currentApprovedVersionId !== null)
    || (current !== null && (
      current.period.start !== command.period.start
      || current.period.end !== command.period.end
      || !historyIds.has(current.id)
    ))
    || (pendingTargetsRequestedPeriod && !historyIds.has(pending.id))
    || (periodHead !== null && periodHead.latestVersionId !== null && !historyIds.has(periodHead.latestVersionId))
    || (candidate !== null && (
      candidate.period.start !== command.period.start
      || candidate.period.end !== command.period.end
      || candidate.mode !== readiness.mode
      || candidate.expectedBookRevision !== expectedBookRevision
      || candidate.expectedPeriodHeadRevision !== expectedPeriodHeadRevision
      || candidate.expectedCurrentApprovedVersionId !== expectedCurrentApprovedVersionId
    ))
    || (capabilities.prepare.allowed && (
      readiness.state !== 'READY'
      || capabilities.prepare.expectedActorMembershipId !== command.actorMembershipId
    ))
    || decisionCapabilities.some((capability) => capability.targetId !== pendingId)
    || decisionCapabilities.some((capability) => (
      capability.allowed && capability.expectedActorMembershipId !== command.actorMembershipId
    ))
    || (book !== null && book.pinnedContractHeadId !== null && provenanceSnapshots.some((item) => (
      item.source.contractHeadId !== book.pinnedContractHeadId
      || item.source.contractVersionId !== book.pinnedContractVersionId
      || item.source.authorityVersionId !== book.pinnedAuthorityVersionId
    )))
  ) throw persistenceError();
  return {
    organizationId: command.organizationId,
    projectId: command.projectId,
    requestedPeriod: { ...command.period },
    book,
    periodHead,
    currentApprovedCertificate: current,
    pendingCertificate: pending,
    historyLimit: PROJECT_CERTIFICATE_HISTORY_LIMIT,
    history,
    readiness,
    candidate,
    capabilities,
    executionAllowed: false,
  };
}

function serializeOperationReceipt(value, command) {
  const receipt = exactStoredFields(value, RECEIPT_FIELDS);
  const operationKind = storedEnum(receipt.operationKind, OPERATION_KIND_SET);
  const result = {
    operationReceiptId: storedIdentifier(receipt.operationReceiptId, 'receipt.operationReceiptId'),
    operationKind,
    certificateVersionId: storedIdentifier(receipt.certificateVersionId, 'receipt.certificateVersionId'),
    decisionId: nullableStoredIdentifier(receipt.decisionId, 'receipt.decisionId'),
    actorMembershipId: storedIdentifier(receipt.actorMembershipId, 'receipt.actorMembershipId'),
    bookRevisionAfter: storedInteger(receipt.bookRevisionAfter, 'receipt.bookRevisionAfter', { minimum: 1 }),
    periodHeadRevisionAfter: storedInteger(receipt.periodHeadRevisionAfter, 'receipt.periodHeadRevisionAfter', { minimum: 1 }),
    replayed: storedBoolean(receipt.replayed),
  };
  if (
    operationKind !== command.operationKind
    || result.actorMembershipId !== command.actorMembershipId
    || (operationKind === 'PREPARE') !== (result.decisionId === null)
  ) throw persistenceError();
  return result;
}

function serializeMutationPayload(raw, command) {
  const payload = exactStoredFields(raw, MUTATION_ROOT_FIELDS);
  const receipt = serializeOperationReceipt(payload.receipt, command);
  const certificate = serializeProjectCertificate(payload.certificate, { summary: true });
  const decision = serializeDecision(payload.decision);
  const book = serializeBook(payload.book);
  const periodHead = serializePeriodHead(payload.periodHead);
  const persistedDecisionForOperation = Object.freeze({
    APPROVE: 'APPROVED',
    REJECT: 'REJECTED',
    CANCEL: 'CANCELLED',
  });
  const decisionMovesApprovedHead = command.operationKind === 'APPROVE';
  const inputDeductionTotal = command.operationKind === 'PREPARE'
    ? command.deductions.reduce((sum, deduction) => sum + BigInt(deduction.amountMinor), 0n)
    : null;
  if (
    certificate.id !== receipt.certificateVersionId
    || book === null
    || periodHead === null
    || book.revision !== receipt.bookRevisionAfter
    || periodHead.revision !== receipt.periodHeadRevisionAfter
    || (command.operationKind === 'PREPARE' && (
      decision !== null
      || certificate.decision !== null
      || certificate.preparedByMembershipId !== command.actorMembershipId
      || certificate.period.start !== command.period.start
      || certificate.period.end !== command.period.end
      || certificate.deductionCount !== command.deductions.length
      || BigInt(certificate.totals.certificateIncrementDeductionsMinor) !== inputDeductionTotal
      || periodHead.currentApprovedVersionId !== command.expectedCurrentApprovedVersionId
      || book.pendingCertificateVersionId !== certificate.id
      || periodHead.latestVersionId !== certificate.id
    ))
    || (command.operationKind !== 'PREPARE' && (
      decision === null
      || decision.id !== receipt.decisionId
      || receipt.certificateVersionId !== command.certificateVersionId
      || decision.decidedByMembershipId !== command.actorMembershipId
      || decision.decision !== persistedDecisionForOperation[command.operationKind]
      || decision.reason !== command.reason
      || certificate.integrityDigest !== command.expectedCertificateDigest
      || JSON.stringify(certificate.decision) !== JSON.stringify(decision)
      || book.pendingCertificateVersionId !== null
      || periodHead.latestVersionId !== certificate.id
      || (decisionMovesApprovedHead && (
        book.latestApprovedPeriodStart !== certificate.period.start
        || book.latestApprovedCertificateVersionId !== certificate.id
        || periodHead.currentApprovedVersionId !== certificate.id
      ))
      || (!decisionMovesApprovedHead && (
        book.latestApprovedCertificateVersionId === certificate.id
        || periodHead.currentApprovedVersionId !== certificate.supersedesApprovedVersionId
      ))
    ))
    || (book.pinnedContractHeadId !== null && (
      book.pinnedContractHeadId !== certificate.source.contractHeadId
      || book.pinnedContractVersionId !== certificate.source.contractVersionId
      || book.pinnedAuthorityVersionId !== certificate.source.authorityVersionId
    ))
    || receipt.bookRevisionAfter !== command.expectedBookRevision + 1
    || receipt.periodHeadRevisionAfter !== command.expectedPeriodHeadRevision + 1
  ) throw persistenceError();
  if (command.operationKind === 'PREPARE') {
    return {
      receipt,
      certificate,
      book: { revision: book.revision, pendingCertificateVersionId: certificate.id },
      periodHead: {
        revision: periodHead.revision,
        currentApprovedVersionId: periodHead.currentApprovedVersionId,
        latestVersionId: certificate.id,
      },
      executionAllowed: false,
    };
  }
  return {
    receipt,
    decision,
    certificate: {
      id: certificate.id,
      period: certificate.period,
      integrityDigest: certificate.integrityDigest,
    },
    book: {
      revision: book.revision,
      pendingCertificateVersionId: null,
      latestApprovedPeriodStart: book.latestApprovedPeriodStart,
      latestApprovedCertificateVersionId: book.latestApprovedCertificateVersionId,
    },
    periodHead: {
      revision: periodHead.revision,
      currentApprovedVersionId: periodHead.currentApprovedVersionId,
      latestVersionId: certificate.id,
    },
    executionAllowed: false,
  };
}

function requireSql(prisma) {
  if (
    !prisma
    || typeof prisma.$transaction !== 'function'
    || typeof prisma.$queryRawUnsafe !== 'function'
  ) invalid('El certificado durable no está disponible.', 'PROJECT_CERTIFICATE_UNAVAILABLE', 503);
  return prisma;
}

function onePayload(rows) {
  if (
    !Array.isArray(rows)
    || rows.length !== 1
    || !rows[0]
    || typeof rows[0] !== 'object'
    || Array.isArray(rows[0])
    || Object.keys(rows[0]).length !== 1
    || !Object.hasOwn(rows[0], 'payload')
  ) {
    throw persistenceError();
  }
  let value = rows[0].payload;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      throw persistenceError();
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw persistenceError();
  return value;
}

export function createProjectCertificateSqlAdapter(prisma) {
  requireSql(prisma);
  return Object.freeze({
    read(command) {
      return prisma.$transaction(
        (database) => database.$queryRawUnsafe(
          READ_SQL,
          command.organizationId,
          command.projectId,
          command.period.start,
          command.actorMembershipId,
        ),
        { isolationLevel: 'ReadCommitted' },
      );
    },
    prepare(command) {
      return prisma.$transaction(
        (database) => database.$queryRawUnsafe(
          PREPARE_SQL,
          command.organizationId,
          command.projectId,
          command.period.start,
          command.expectedBookRevision,
          command.expectedPeriodHeadRevision,
          command.expectedCurrentApprovedVersionId,
          JSON.stringify(command.deductions),
          command.operationKey,
          command.requestFingerprint,
          command.actorMembershipId,
        ),
        { isolationLevel: 'ReadCommitted' },
      );
    },
    decide(command) {
      return prisma.$transaction(
        (database) => database.$queryRawUnsafe(
          DECIDE_SQL,
          command.organizationId,
          command.projectId,
          command.certificateVersionId,
          command.expectedBookRevision,
          command.expectedPeriodHeadRevision,
          command.expectedCertificateDigest,
          command.decision,
          command.reason,
          command.operationKey,
          command.requestFingerprint,
          command.actorMembershipId,
        ),
        { isolationLevel: 'ReadCommitted' },
      );
    },
  });
}

async function execute(adapter, operation, command, serializer) {
  try {
    return serializer(onePayload(await adapter[operation](command)), command);
  } catch (error) {
    if (error instanceof ProjectCertificateError) throw error;
    throw databaseError(error) || error;
  }
}

export async function readProjectCertificateSnapshot(prisma, {
  scope, actorMembershipId, query,
} = {}, options = {}) {
  const trusted = trustedScope(scope, actorMembershipId);
  const period = query?.period ? periodForDate(query.period.start, 'period.start') : null;
  if (!period || period.end !== query?.period?.end) {
    invalid('La quincena del certificado es inválida.', 'PROJECT_CERTIFICATE_PERIOD_INVALID');
  }
  const command = Object.freeze({ ...trusted, period });
  return execute(
    options.sqlAdapter || createProjectCertificateSqlAdapter(prisma),
    'read',
    command,
    serializeProjectCertificateSnapshot,
  );
}

export async function prepareProjectCertificate(prisma, {
  scope, actorMembershipId, operationKey, input,
} = {}, options = {}) {
  const draft = {
    ...trustedScope(scope, actorMembershipId),
    ...normalizeProjectCertificatePrepare(input, operationKey),
  };
  const command = Object.freeze({
    ...draft,
    operationKind: 'PREPARE',
    requestFingerprint: fingerprint('PREPARE', draft),
  });
  return execute(
    options.sqlAdapter || createProjectCertificateSqlAdapter(prisma),
    'prepare',
    command,
    serializeMutationPayload,
  );
}

export async function decideProjectCertificate(prisma, {
  scope, actorMembershipId, certificateVersionId, operationKey, input,
} = {}, options = {}) {
  const normalized = normalizeProjectCertificateDecision(input, operationKey);
  const draft = {
    ...trustedScope(scope, actorMembershipId),
    certificateVersionId: identifier(certificateVersionId, 'certificateVersionId'),
    ...normalized,
  };
  const command = Object.freeze({
    ...draft,
    operationKind: normalized.decision,
    requestFingerprint: fingerprint(normalized.decision, draft),
  });
  return execute(
    options.sqlAdapter || createProjectCertificateSqlAdapter(prisma),
    'decide',
    command,
    serializeMutationPayload,
  );
}

export async function requireProjectCertificateRouteMembership(prisma, {
  scope, actorMembershipId,
} = {}) {
  const command = trustedScope(scope, actorMembershipId);
  if (!prisma?.projectMembership || typeof prisma.projectMembership.findFirst !== 'function') {
    invalid('La verificación de membresía de obra no está disponible.', 'PROJECT_CERTIFICATE_UNAVAILABLE', 503);
  }
  const membership = await prisma.projectMembership.findFirst({
    where: {
      projectId: command.projectId,
      tenantMembershipId: command.actorMembershipId,
      status: 'ACTIVE',
      tenantMembership: { organizationId: command.organizationId, status: 'ACTIVE' },
      project: { organizationId: command.organizationId, status: { not: 'ARCHIVED' } },
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
