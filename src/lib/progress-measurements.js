import { createHash } from 'node:crypto';

import {
  compareProgressMeasurementQuantities,
  normalizeProgressMeasurementQuantity,
  ProgressMeasurementQuantityError,
  progressMeasurementPercent,
} from './progress-measurement-quantity.js';

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_EVIDENCE = 10;
const MAX_HISTORY = 100;

export const PROGRESS_MEASUREMENT_UNITS = Object.freeze([
  'M', 'M2', 'M3', 'KG', 'T', 'L', 'UNIT', 'HOUR', 'DAY', 'LOT',
]);
export const PROGRESS_MEASUREMENT_METHODS = Object.freeze([
  'DIRECT_COUNT',
  'DIMENSIONAL_CALCULATION',
  'INSTRUMENT_READING',
  'OTHER_REVIEWED',
]);
export const PROGRESS_MEASUREMENT_STATUSES = Object.freeze([
  'PENDING', 'APPROVED', 'REJECTED',
]);
const UNIT_SET = new Set(PROGRESS_MEASUREMENT_UNITS);
const METHOD_SET = new Set(PROGRESS_MEASUREMENT_METHODS);
const STATUS_SET = new Set(PROGRESS_MEASUREMENT_STATUSES);
const DECISION_SET = new Set(['APPROVE', 'REJECT']);
const MUTATION_RESULT_FIELDS = new Set([
  'head_id',
  'measurement_id',
  'organization_id',
  'project_id',
  'task_id',
  'period_start',
  'period_end',
  'unit_code',
  'base_quantity',
  'period_quantity',
  'cumulative_quantity',
  'method',
  'rationale',
  'task_revision',
  'measurement_revision',
  'head_revision',
  'status',
  'evidence_count',
  'prepared_by_membership_id',
  'decided_by_membership_id',
  'decision_reason',
  'approved_cumulative_quantity',
  'balance_revision',
  'replayed',
]);

const SUBMIT_SQL = `
  SELECT *
  FROM "obrasaas_progress_measurement_submit"(
    $1::text, $2::text, $3::text, $4::date, $5::date,
    $6::text, $7::numeric, $8::numeric, $9::text, $10::text,
    $11::jsonb, $12::text, $13::text, $14::text, $15::text
  )
`;

const REVIEW_SQL = `
  SELECT *
  FROM "obrasaas_progress_measurement_review"(
    $1::text, $2::text, $3::text, $4::integer, $5::text,
    $6::text, $7::text, $8::text, $9::text
  )
`;

const DATABASE_ERRORS = Object.freeze([
  [['IDEMPOTENCY_REPLAY_MUTATED', 'operation key was already used with a different'], 'PROGRESS_MEASUREMENT_IDEMPOTENCY_CONFLICT', 409, 'La clave de idempotencia ya fue usada con otro contenido.'],
  [['PROGRESS_MEASUREMENT_SCOPE_INVALID', 'PROGRESS_MEASUREMENT_TASK_TYPE_INVALID', 'PROGRESS_MEASUREMENT_TASK_NOT_CANONICAL', 'tenant-scoped project task was not found', 'tenant-scoped progress measurement was not found', 'tenant-scoped progress measurement head was not found'], 'PROGRESS_MEASUREMENT_NOT_FOUND', 404, 'No se encontró la medición en la obra activa.'],
  [['PROGRESS_MEASUREMENT_ACTOR_FORBIDDEN', 'requires an active authorized tenant membership', 'requires an active director or administrator membership', 'maker and checker memberships must be different'], 'PROGRESS_MEASUREMENT_FORBIDDEN', 403, 'No tenés permisos para esta operación de medición.'],
  [['PROGRESS_MEASUREMENT_HEAD_STALE', 'stale expected head measurement', 'expected head must be null', 'period head has a different civil period end', 'only the currently submitted head measurement may be reviewed'], 'PROGRESS_MEASUREMENT_HEAD_STALE', 409, 'La medición cambió. Actualizá el corte antes de continuar.'],
  [['PROGRESS_MEASUREMENT_REVISION_STALE', 'stale expected progress measurement head revision', 'progress measurement head changed during review'], 'PROGRESS_MEASUREMENT_REVISION_STALE', 409, 'La revisión cambió. Actualizá la medición antes de decidir.'],
  [['PROGRESS_MEASUREMENT_ALREADY_REVIEWED', 'measurement already has an append-only decision'], 'PROGRESS_MEASUREMENT_ALREADY_REVIEWED', 409, 'La medición ya tiene una decisión.'],
  [['PROGRESS_MEASUREMENT_REVIEW_PENDING', 'task already has a submitted measurement awaiting decision'], 'PROGRESS_MEASUREMENT_REVIEW_PENDING', 409, 'Ya existe una medición pendiente de decisión para esta tarea.'],
  [['PROGRESS_MEASUREMENT_BASIS_MISMATCH', 'approved base quantity and unit are fixed for the task'], 'PROGRESS_MEASUREMENT_BASIS_MISMATCH', 409, 'La unidad o cantidad base no coincide con la base aprobada vigente.'],
  [['PROGRESS_MEASUREMENT_PERIOD_CONFLICT', 'measurement periods must be approved chronologically', 'only the latest approved period may be corrected'], 'PROGRESS_MEASUREMENT_PERIOD_CONFLICT', 409, 'La quincena entra en conflicto con el último corte aprobado.'],
  [['PROGRESS_MEASUREMENT_OVER_BASELINE', 'derived cumulative quantity must remain between zero and the approved base', 'approval would exceed the fixed base quantity'], 'PROGRESS_MEASUREMENT_OVER_BASELINE', 409, 'La cantidad aprobada superaría la cantidad base.'],
  [['PROGRESS_MEASUREMENT_EVIDENCE_INVALID', 'all evidence must be approved and belong to the same project task'], 'PROGRESS_MEASUREMENT_EVIDENCE_INVALID', 409, 'La evidencia no es elegible para esta tarea y obra.'],
  [['PROGRESS_MEASUREMENT_PROJECTION_STALE', 'submitted cumulative quantity no longer matches the database projection'], 'PROGRESS_MEASUREMENT_PROJECTION_STALE', 409, 'El acumulado cambió. Actualizá el corte antes de continuar.'],
  [['PROGRESS_MEASUREMENT_PROJECT_READ_ONLY', 'project is read-only for progress measurements'], 'PROJECT_READ_ONLY', 409, 'La obra no admite cambios operativos en su estado actual.'],
  [['PROGRESS_MEASUREMENT_FUTURE_PERIOD'], 'PROGRESS_MEASUREMENT_FUTURE_PERIOD', 400, 'No se puede registrar una medición para una quincena futura.'],
  [['PROGRESS_MEASUREMENT_PROJECT_PENDING'], 'PROGRESS_MEASUREMENT_PROJECT_PENDING', 409, 'La obra tiene una medición pendiente de decisión.'],
]);

export const PROGRESS_MEASUREMENT_MAX_BODY_BYTES = 64 * 1024;
export const PROGRESS_MEASUREMENT_REVIEW_MAX_BODY_BYTES = 16 * 1024;

export class ProgressMeasurementError extends Error {
  constructor(message, code = 'PROGRESS_MEASUREMENT_INVALID', status = 400) {
    super(message);
    this.name = 'ProgressMeasurementError';
    this.code = code;
    this.status = status;
  }
}

function strictObject(value, field = 'body') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ProgressMeasurementError(`${field} debe ser un objeto.`);
  }
  return value;
}

function exactFields(value, allowed, required, field = 'body') {
  const keys = Object.keys(value);
  const unknown = keys.find((key) => !allowed.has(key));
  if (unknown) throw new ProgressMeasurementError(`${field}.${unknown} no está permitido.`);
  const missing = [...required].find((key) => !Object.hasOwn(value, key));
  if (missing) throw new ProgressMeasurementError(`${field}.${missing} es obligatorio.`);
}

function identifier(value, field, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (typeof value !== 'string' || !IDENTIFIER_PATTERN.test(value)) {
    throw new ProgressMeasurementError(`${field} es inválido.`);
  }
  return value;
}

function boundedText(value, field, { minimum = 1, maximum = 1_000, nullable = false } = {}) {
  if (nullable && (value === null || value === undefined || value === '')) return null;
  if (typeof value !== 'string') throw new ProgressMeasurementError(`${field} debe ser texto.`);
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length < minimum || normalized.length > maximum || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new ProgressMeasurementError(`${field} es inválido.`);
  }
  return normalized;
}

function enumValue(value, allowed, field) {
  if (typeof value !== 'string' || !allowed.has(value)) {
    throw new ProgressMeasurementError(`${field} es inválido.`);
  }
  return value;
}

function dateParts(value, field) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    throw new ProgressMeasurementError(`${field} debe usar YYYY-MM-DD.`);
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) throw new ProgressMeasurementError(`${field} no es una fecha civil válida.`);
  return { year, month, day };
}

function civilDate(year, month, day) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function civilFortnightForDate(value) {
  const { year, month, day } = dateParts(value, 'periodDate');
  const startDay = day <= 15 ? 1 : 16;
  const endDay = day <= 15 ? 15 : new Date(Date.UTC(year, month, 0)).getUTCDate();
  const start = civilDate(year, month, startDay);
  const end = civilDate(year, month, endDay);
  return Object.freeze({
    key: `${start}/${end}`,
    start,
    end,
    label: `${startDay}-${endDay}/${String(month).padStart(2, '0')}/${year}`,
  });
}

export function requireProgressMeasurementIdempotencyKey(value) {
  const candidate = typeof value === 'string' ? value : value?.headers?.get?.('Idempotency-Key');
  if (typeof candidate !== 'string' || !IDEMPOTENCY_KEY_PATTERN.test(candidate)) {
    throw new ProgressMeasurementError(
      'Idempotency-Key debe tener entre 8 y 128 caracteres seguros.',
      'PROGRESS_MEASUREMENT_IDEMPOTENCY_KEY_INVALID',
    );
  }
  return candidate;
}

function evidenceIds(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_EVIDENCE) {
    throw new ProgressMeasurementError(`evidenceIds debe contener entre 1 y ${MAX_EVIDENCE} evidencias.`);
  }
  const normalized = value.map((item, index) => identifier(item, `evidenceIds[${index}]`));
  if (new Set(normalized).size !== normalized.length) {
    throw new ProgressMeasurementError('evidenceIds no admite duplicados.');
  }
  return normalized.toSorted();
}

function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function inputQuantity(value, options) {
  try {
    return normalizeProgressMeasurementQuantity(value, options);
  } catch (error) {
    if (error instanceof ProgressMeasurementQuantityError) {
      throw new ProgressMeasurementError(error.message, error.code, error.status);
    }
    throw error;
  }
}

export function normalizeProgressMeasurementSubmission(input, operationKey) {
  const body = strictObject(input);
  exactFields(
    body,
    new Set(['taskId', 'periodDate', 'unit', 'baselineQuantity', 'executedQuantity', 'method', 'rationale', 'evidenceIds', 'expectedHeadId']),
    new Set(['taskId', 'periodDate', 'unit', 'baselineQuantity', 'executedQuantity', 'method', 'rationale', 'evidenceIds', 'expectedHeadId']),
  );
  const normalized = {
    taskId: identifier(body.taskId, 'taskId'),
    period: civilFortnightForDate(body.periodDate),
    unit: enumValue(body.unit, UNIT_SET, 'unit'),
    baselineQuantity: inputQuantity(body.baselineQuantity, { allowZero: false, field: 'baselineQuantity' }),
    executedQuantity: inputQuantity(body.executedQuantity, { allowZero: false, field: 'executedQuantity' }),
    method: enumValue(body.method, METHOD_SET, 'method'),
    rationale: boundedText(body.rationale, 'rationale', { minimum: 10, maximum: 1_000 }),
    evidenceIds: evidenceIds(body.evidenceIds),
    expectedHeadId: identifier(body.expectedHeadId, 'expectedHeadId', { nullable: true }),
    operationKey: requireProgressMeasurementIdempotencyKey(operationKey),
  };
  return Object.freeze(normalized);
}

export function normalizeProgressMeasurementReview(input, operationKey) {
  const body = strictObject(input);
  exactFields(
    body,
    new Set(['expectedRevision', 'decision', 'reason']),
    new Set(['expectedRevision', 'decision', 'reason']),
  );
  if (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 1) {
    throw new ProgressMeasurementError('expectedRevision es inválido.');
  }
  const normalized = {
    expectedRevision: body.expectedRevision,
    decision: enumValue(body.decision, DECISION_SET, 'decision'),
    reason: boundedText(body.reason, 'reason', { minimum: 5, maximum: 1_000 }),
    operationKey: requireProgressMeasurementIdempotencyKey(operationKey),
  };
  return Object.freeze(normalized);
}

function boundRequestFingerprint(operation, command) {
  const payload = Object.fromEntries(Object.entries(command).filter(
    ([key]) => key !== 'operationKey' && key !== 'requestFingerprint',
  ));
  return fingerprint({ operation, ...payload });
}

export function normalizeProgressMeasurementListQuery(requestOrValue) {
  const params = requestOrValue instanceof URLSearchParams
    ? requestOrValue
    : new URL(requestOrValue.url).searchParams;
  const allowed = new Set(['taskId', 'periodDate', 'status', 'cursor', 'limit']);
  for (const [key] of params) {
    if (!allowed.has(key) || params.getAll(key).length !== 1) {
      throw new ProgressMeasurementError('La consulta de mediciones es inválida.', 'PROGRESS_MEASUREMENT_QUERY_INVALID');
    }
  }
  const taskId = identifier(params.get('taskId'), 'taskId');
  const period = params.has('periodDate')
    ? civilFortnightForDate(params.get('periodDate'))
    : null;
  const status = params.has('status') ? enumValue(params.get('status'), STATUS_SET, 'status') : null;
  const cursor = params.has('cursor') ? identifier(params.get('cursor'), 'cursor') : null;
  const rawLimit = params.get('limit') || '25';
  if (!/^\d{1,3}$/.test(rawLimit)) {
    throw new ProgressMeasurementError('limit es inválido.', 'PROGRESS_MEASUREMENT_QUERY_INVALID');
  }
  const limit = Number(rawLimit);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_HISTORY) {
    throw new ProgressMeasurementError('limit debe estar entre 1 y 100.', 'PROGRESS_MEASUREMENT_QUERY_INVALID');
  }
  return Object.freeze({ taskId, period, status, cursor, limit });
}

function databaseError(error) {
  const text = [error?.code, error?.message, error?.meta?.message, error?.meta?.database_error]
    .filter((value) => typeof value === 'string')
    .join(' ')
    .toLowerCase();
  for (const [markers, code, status, message] of DATABASE_ERRORS) {
    if (markers.some((marker) => text.includes(marker.toLowerCase()))) {
      return new ProgressMeasurementError(message, code, status);
    }
  }
  return null;
}

function contractError() {
  return new ProgressMeasurementError(
    'La persistencia devolvió un resultado de medición inválido.',
    'PROGRESS_MEASUREMENT_CONTRACT_INVALID',
    500,
  );
}

function storedIdentifier(value, field, options) {
  try {
    return identifier(value, field, options);
  } catch {
    throw contractError();
  }
}

function storedEnum(value, allowed, field) {
  try {
    return enumValue(value, allowed, field);
  } catch {
    throw contractError();
  }
}

function storedText(value, field, options) {
  try {
    return boundedText(value, field, options);
  } catch {
    throw contractError();
  }
}

function storedQuantity(value, field, { allowZero = true } = {}) {
  const text = typeof value === 'string' ? value : value?.toString?.();
  try {
    return normalizeProgressMeasurementQuantity(text, { allowZero, field });
  } catch {
    throw contractError();
  }
}

function storedDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  throw contractError();
}

function storedCivilDate(value, field) {
  const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value || '').slice(0, 10);
  try {
    dateParts(text, field);
  } catch {
    throw contractError();
  }
  return text;
}

function storedPeriod(start, end, field) {
  const startText = storedCivilDate(start, `${field}.start`);
  const endText = storedCivilDate(end, `${field}.end`);
  let period;
  try {
    period = civilFortnightForDate(startText);
  } catch {
    throw contractError();
  }
  if (period.end !== endText) throw contractError();
  return period;
}

function storedInteger(value, field, { minimum = 0 } = {}) {
  const normalized = typeof value === 'bigint' ? Number(value) : value;
  if (!Number.isSafeInteger(normalized) || normalized < minimum) throw contractError();
  return normalized;
}

function serializeMutationResult(rows, command, operation) {
  if (!Array.isArray(rows) || rows.length !== 1) throw contractError();
  const row = rows[0];
  if (!row || typeof row !== 'object' || Array.isArray(row)) throw contractError();
  const fields = Object.keys(row);
  if (
    fields.length !== MUTATION_RESULT_FIELDS.size
    || fields.some((field) => !MUTATION_RESULT_FIELDS.has(field))
    || [...MUTATION_RESULT_FIELDS].some((field) => !Object.hasOwn(row, field))
  ) throw contractError();
  const period = storedPeriod(row.period_start, row.period_end, 'period');
  const baselineQuantity = storedQuantity(row.base_quantity, 'baselineQuantity', { allowZero: false });
  const executedQuantity = storedQuantity(row.period_quantity, 'executedQuantity');
  const cumulativeQuantity = storedQuantity(row.cumulative_quantity, 'cumulativeQuantity');
  if (
    (row.approved_cumulative_quantity === null) !== (row.balance_revision === null)
  ) throw contractError();
  const approvedQuantity = row.approved_cumulative_quantity === null
    ? '0.0000'
    : storedQuantity(row.approved_cumulative_quantity, 'approvedQuantity');
  const status = storedEnum(row.status, STATUS_SET, 'status');
  const evidenceCount = storedInteger(row.evidence_count, 'evidenceCount');
  const taskRevision = storedInteger(row.task_revision, 'taskRevision');
  const measurementRevision = storedInteger(row.measurement_revision, 'measurementRevision', { minimum: 1 });
  const headRevision = storedInteger(row.head_revision, 'headRevision', { minimum: 1 });
  const balanceRevision = row.balance_revision === null
    ? 0
    : storedInteger(row.balance_revision, 'balanceRevision');
  const hasApprovedBalance = balanceRevision > 0;
  const preparedByMembershipId = storedIdentifier(
    row.prepared_by_membership_id,
    'preparedByMembershipId',
  );
  const decidedByMembershipId = storedIdentifier(
    row.decided_by_membership_id,
    'decidedByMembershipId',
    { nullable: true },
  );
  const decisionReason = decidedByMembershipId === null
    ? null
    : storedText(row.decision_reason, 'decisionReason', { minimum: 1, maximum: 1_000 });
  if (
    row.organization_id !== command.organizationId
    || row.project_id !== command.projectId
    || (operation === 'submit' && row.task_id !== command.taskId)
    || (operation === 'review' && row.measurement_id !== command.measurementId)
    || typeof row.replayed !== 'boolean'
    || (operation === 'submit' && (
      period.start !== command.period.start
      || period.end !== command.period.end
      || row.unit_code !== command.unit
      || baselineQuantity !== command.baselineQuantity
      || executedQuantity !== command.executedQuantity
      || row.method !== command.method
      || row.rationale !== command.rationale
      || evidenceCount !== command.evidenceIds.length
      || preparedByMembershipId !== command.actorMembershipId
    ))
    || (operation === 'review' && decidedByMembershipId !== command.actorMembershipId)
    || (status === 'PENDING' && decidedByMembershipId !== null)
    || (status !== 'PENDING' && decidedByMembershipId === null)
    || (status === 'PENDING' && row.decision_reason !== null)
    || (status === 'APPROVED' && operation === 'review' && command.decision !== 'APPROVE')
    || (status === 'REJECTED' && operation === 'review' && command.decision !== 'REJECT')
    || (operation === 'review' && decisionReason !== command.reason)
    || (balanceRevision === 0 && approvedQuantity !== '0.0000')
    || !isApprovedMeasurementWithinBaseline(approvedQuantity, baselineQuantity)
  ) throw contractError();
  const review = decidedByMembershipId === null ? null : {
    decision: status === 'APPROVED' ? 'APPROVE' : 'REJECT',
    reason: decisionReason,
    reviewedBy: {
      label: null,
      isCurrentActor: decidedByMembershipId === command.actorMembershipId,
    },
  };
  return {
    measurement: {
      id: storedIdentifier(row.measurement_id, 'measurement.id'),
      taskId: storedIdentifier(row.task_id, 'measurement.taskId'),
      revision: measurementRevision,
      taskRevision,
      status,
      period,
      unit: storedEnum(row.unit_code, UNIT_SET, 'unit'),
      baselineQuantity,
      executedQuantity,
      cumulativeQuantity,
      method: storedEnum(row.method, METHOD_SET, 'method'),
      rationale: storedText(row.rationale, 'rationale', { minimum: 1, maximum: 1_000 }),
      evidenceCount,
      preparedBy: {
        label: null,
        isCurrentActor: preparedByMembershipId === command.actorMembershipId,
      },
      review,
    },
    head: {
      id: storedIdentifier(row.head_id, 'head.id'),
      revision: headRevision,
      balanceRevision,
    },
    approved: {
      unit: hasApprovedBalance ? storedEnum(row.unit_code, UNIT_SET, 'approved.unit') : null,
      quantity: approvedQuantity,
      baselineQuantity: hasApprovedBalance ? baselineQuantity : null,
      percent: hasApprovedBalance
        ? progressMeasurementPercent(approvedQuantity, baselineQuantity)
        : null,
    },
    replayed: row.replayed,
  };
}

export function createProgressMeasurementSqlAdapter(prisma) {
  if (!prisma || typeof prisma.$queryRawUnsafe !== 'function') {
    throw new ProgressMeasurementError('El control durable de mediciones no está disponible.', 'PROGRESS_MEASUREMENT_UNAVAILABLE', 503);
  }
  return Object.freeze({
    submit(command) {
      return prisma.$queryRawUnsafe(
        SUBMIT_SQL,
        command.organizationId,
        command.projectId,
        command.taskId,
        command.period.start,
        command.period.end,
        command.unit,
        command.baselineQuantity,
        command.executedQuantity,
        command.method,
        command.rationale,
        JSON.stringify(command.evidenceIds),
        command.expectedHeadId,
        command.operationKey,
        command.requestFingerprint,
        command.actorMembershipId,
      );
    },
    review(command) {
      return prisma.$queryRawUnsafe(
        REVIEW_SQL,
        command.organizationId,
        command.projectId,
        command.measurementId,
        command.expectedRevision,
        command.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        command.reason,
        command.operationKey,
        command.requestFingerprint,
        command.actorMembershipId,
      );
    },
  });
}

function trustedCommand(scope, actorMembershipId) {
  const value = strictObject(scope, 'scope');
  return {
    organizationId: identifier(value.organizationId, 'scope.organizationId'),
    projectId: identifier(value.projectId, 'scope.projectId'),
    actorMembershipId: requiredActorMembershipId(actorMembershipId),
  };
}

function requiredActorMembershipId(value) {
  if (value === null || value === undefined || value === '') {
    throw new ProgressMeasurementError(
      'Una membresía activa en la organización es obligatoria.',
      'TENANT_MEMBERSHIP_REQUIRED',
      403,
    );
  }
  return identifier(value, 'actorMembershipId');
}

export async function submitProgressMeasurement(prisma, {
  scope,
  actorMembershipId,
  operationKey,
  input,
} = {}, { sqlAdapter = createProgressMeasurementSqlAdapter(prisma) } = {}) {
  const draft = {
    ...trustedCommand(scope, actorMembershipId),
    ...normalizeProgressMeasurementSubmission(input, operationKey),
  };
  const command = Object.freeze({
    ...draft,
    requestFingerprint: boundRequestFingerprint('SUBMIT', draft),
  });
  try {
    return serializeMutationResult(await sqlAdapter.submit(command), command, 'submit');
  } catch (error) {
    if (error instanceof ProgressMeasurementError) throw error;
    throw databaseError(error) || error;
  }
}

export async function reviewProgressMeasurement(prisma, {
  scope,
  actorMembershipId,
  measurementId,
  operationKey,
  input,
} = {}, { sqlAdapter = createProgressMeasurementSqlAdapter(prisma) } = {}) {
  const draft = {
    ...trustedCommand(scope, actorMembershipId),
    measurementId: identifier(measurementId, 'measurementId'),
    ...normalizeProgressMeasurementReview(input, operationKey),
  };
  const command = Object.freeze({
    ...draft,
    requestFingerprint: boundRequestFingerprint('REVIEW', draft),
  });
  try {
    const rows = await sqlAdapter.review(command);
    return serializeMutationResult(rows, command, 'review');
  } catch (error) {
    if (error instanceof ProgressMeasurementError) throw error;
    throw databaseError(error) || error;
  }
}

export function createProgressMeasurementReadAdapter(prisma) {
  if (!prisma || typeof prisma.$transaction !== 'function') {
    throw new ProgressMeasurementError('La lectura de mediciones no está disponible.', 'PROGRESS_MEASUREMENT_UNAVAILABLE', 503);
  }
  return Object.freeze({
    async read(command) {
      return prisma.$transaction(async (database) => {
        const where = {
          organizationId: command.organizationId,
          projectId: command.projectId,
          taskId: command.taskId,
        };
        const measurementWhere = {
          ...where,
          ...(command.status === 'PENDING' ? { decision: null } : {}),
          ...(command.status === 'APPROVED' ? { decision: { is: { decision: 'APPROVED' } } } : {}),
          ...(command.status === 'REJECTED' ? { decision: { is: { decision: 'REJECTED' } } } : {}),
        };
        const actorMembership = await database.tenantMembership.findFirst({
          where: {
            id: command.actorMembershipId,
            organizationId: command.organizationId,
            status: 'ACTIVE',
          },
          select: { id: true },
        });
        if (!actorMembership) {
          throw new ProgressMeasurementError(
            'Una membresía activa en la organización es obligatoria.',
            'TENANT_MEMBERSHIP_REQUIRED',
            403,
          );
        }
        const task = await database.task.findFirst({
          where: {
            id: command.taskId,
            projectId: command.projectId,
            type: 'TASK',
            metadata: { path: ['source'], equals: 'canonical-task-v1' },
            project: { organizationId: command.organizationId },
          },
          select: { id: true, code: true, title: true, revision: true },
        });
        if (!task) return { task: null };
        if (command.cursor) {
          const cursor = await database.taskProgressMeasurement.findFirst({
            where: { ...measurementWhere, id: command.cursor },
            select: { id: true },
          });
          if (!cursor) {
            throw new ProgressMeasurementError('El cursor no pertenece a la tarea activa.', 'PROGRESS_MEASUREMENT_CURSOR_INVALID');
          }
        }
        const [rows, head, balance, pendingHead] = await Promise.all([
          database.taskProgressMeasurement.findMany({
            where: measurementWhere,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            ...(command.cursor ? { cursor: { id: command.cursor }, skip: 1 } : {}),
            take: command.limit + 1,
            include: {
              head: { select: { periodStart: true, periodEnd: true } },
              evidenceLinks: {
                orderBy: { ordinal: 'asc' },
                select: {
                  progressEvidenceId: true,
                  evidenceRevision: true,
                  evidenceCapturedAt: true,
                },
              },
              preparedByMembership: { include: { user: { select: { fullName: true } } } },
              decision: {
                include: { decidedByMembership: { include: { user: { select: { fullName: true } } } } },
              },
            },
          }),
          database.taskProgressMeasurementHead.findFirst({
            where: {
              ...where,
              ...(command.period ? { periodStart: new Date(`${command.period.start}T00:00:00.000Z`) } : {}),
            },
            ...(!command.period ? { orderBy: [{ periodStart: 'desc' }, { id: 'desc' }] } : {}),
            include: { headMeasurement: true },
          }),
          database.taskProgressMeasurementBalance.findFirst({ where }),
          database.taskProgressMeasurementHead.findFirst({
            where: { ...where, pendingMeasurementId: { not: null } },
            orderBy: [{ periodStart: 'desc' }, { id: 'desc' }],
            select: {
              id: true,
              periodStart: true,
              periodEnd: true,
              pendingMeasurementId: true,
              revision: true,
            },
          }),
        ]);
        return { task, rows, head, balance, pendingHead };
      }, { isolationLevel: 'RepeatableRead' });
    },
  });
}

function serializeReadSnapshot(raw, command) {
  if (!raw?.task) {
    throw new ProgressMeasurementError('No se encontró la tarea en la obra activa.', 'PROGRESS_MEASUREMENT_TASK_NOT_FOUND', 404);
  }
  const rows = Array.isArray(raw.rows) ? raw.rows : [];
  const hasMore = rows.length > command.limit;
  const visible = rows.slice(0, command.limit);
  const headPeriod = raw.head
    ? storedPeriod(raw.head.periodStart, raw.head.periodEnd, 'head.period')
    : null;
  if (command.period && headPeriod && headPeriod.start !== command.period.start) throw contractError();
  const requestedPeriod = command.period || headPeriod;
  const pendingPeriod = raw.pendingHead
    ? storedPeriod(raw.pendingHead.periodStart, raw.pendingHead.periodEnd, 'pendingHead.period')
    : null;
  if (raw.pendingHead) {
    storedIdentifier(raw.pendingHead.id, 'pendingHead.id');
    storedIdentifier(raw.pendingHead.pendingMeasurementId, 'pendingHead.pendingMeasurementId');
    storedInteger(raw.pendingHead.revision, 'pendingHead.revision', { minimum: 1 });
  }
  const approvedUnit = raw.balance
    ? storedEnum(raw.balance.unitCode, UNIT_SET, 'balance.unit')
    : null;
  const approvedBaselineQuantity = raw.balance
    ? storedQuantity(raw.balance.baseQuantity, 'balance.baseQuantity', { allowZero: false })
    : null;
  const approvedQuantity = raw.balance
    ? storedQuantity(raw.balance.approvedCumulativeQuantity, 'balance.approvedCumulativeQuantity')
    : '0.0000';
  const approvedRevision = raw.balance
    ? storedInteger(raw.balance.revision, 'balance.revision', { minimum: 1 })
    : 0;
  if (
    approvedBaselineQuantity !== null
    && !isApprovedMeasurementWithinBaseline(approvedQuantity, approvedBaselineQuantity)
  ) throw contractError();
  const proposedUnit = raw.head?.headMeasurement
    ? storedEnum(raw.head.headMeasurement.unitCode, UNIT_SET, 'head.unit')
    : null;
  const proposedBaselineQuantity = raw.head?.headMeasurement
    ? storedQuantity(raw.head.headMeasurement.baseQuantity, 'head.baselineQuantity', { allowZero: false })
    : null;
  const measurements = visible.map((row) => {
    if (row.taskId !== command.taskId) throw contractError();
    const status = row.decision
      ? storedEnum(row.decision.decision, new Set(['APPROVED', 'REJECTED']), 'measurement.status')
      : 'PENDING';
    const period = storedPeriod(
      row.head?.periodStart,
      row.head?.periodEnd,
      'measurement.period',
    );
    const preparedByMembershipId = storedIdentifier(
      row.preparedByMembershipId,
      'measurement.preparedByMembershipId',
    );
    const evidence = (row.evidenceLinks || []).map((link) => ({
      id: storedIdentifier(link.progressEvidenceId, 'evidence.id'),
      revision: storedInteger(link.evidenceRevision, 'evidence.revision'),
      capturedAt: storedDate(link.evidenceCapturedAt),
    }));
    if (storedInteger(row.evidenceCount, 'measurement.evidenceCount') !== evidence.length) {
      throw contractError();
    }
    return {
      id: storedIdentifier(row.id, 'measurement.id'),
      taskId: command.taskId,
      revision: storedInteger(row.revision, 'measurement.revision', { minimum: 1 }),
      taskRevision: storedInteger(row.taskRevision, 'measurement.taskRevision'),
      status,
      period,
      unit: storedEnum(row.unitCode, UNIT_SET, 'measurement.unit'),
      baselineQuantity: storedQuantity(row.baseQuantity, 'measurement.baselineQuantity', { allowZero: false }),
      executedQuantity: storedQuantity(row.periodQuantity, 'measurement.executedQuantity'),
      cumulativeQuantity: storedQuantity(row.cumulativeQuantity, 'measurement.cumulativeQuantity'),
      method: storedEnum(row.method, METHOD_SET, 'measurement.method'),
      rationale: storedText(row.rationale, 'measurement.rationale', { minimum: 1, maximum: 1_000 }),
      evidence,
      preparedBy: {
        label: storedText(row.preparedByMembership?.user?.fullName || 'Usuario de obra', 'preparedBy.label', { maximum: 190 }),
        isCurrentActor: preparedByMembershipId === command.actorMembershipId,
      },
      preparedAt: storedDate(row.createdAt),
      review: row.decision ? {
        decision: status === 'APPROVED' ? 'APPROVE' : 'REJECT',
        reason: storedText(row.decision.reason, 'review.reason', { minimum: 1, maximum: 1_000 }),
        reviewedBy: {
          label: storedText(row.decision.decidedByMembership?.user?.fullName || 'Usuario de obra', 'reviewedBy.label', { maximum: 190 }),
          isCurrentActor: storedIdentifier(
            row.decision.decidedByMembershipId,
            'review.decidedByMembershipId',
          ) === command.actorMembershipId,
        },
        reviewedAt: storedDate(row.decision.createdAt),
      } : null,
    };
  });
  const task = {
    id: storedIdentifier(raw.task.id, 'task.id'),
    code: raw.task.code === null
      ? null
      : storedText(raw.task.code, 'task.code', { maximum: 64 }),
    title: storedText(raw.task.title, 'task.title', { maximum: 1_000 }),
    revision: storedInteger(raw.task.revision, 'task.revision'),
  };
  const pendingIsRequestedPeriod = Boolean(
    pendingPeriod
    && requestedPeriod
    && pendingPeriod.start === requestedPeriod.start,
  );
  return {
    task,
    requestedPeriod,
    head: raw.head ? {
      id: storedIdentifier(raw.head.id, 'head.id'),
      revision: storedInteger(raw.head.revision, 'head.revision', { minimum: 1 }),
      period: headPeriod,
      latestMeasurementId: storedIdentifier(raw.head.headMeasurementId, 'head.latestMeasurementId', { nullable: true }),
      pendingMeasurementId: storedIdentifier(raw.head.pendingMeasurementId, 'head.pendingMeasurementId', { nullable: true }),
      approvedMeasurementId: storedIdentifier(raw.head.approvedMeasurementId, 'head.approvedMeasurementId', { nullable: true }),
      unit: proposedUnit,
      baselineQuantity: proposedBaselineQuantity,
    } : null,
    readiness: pendingPeriod ? {
      state: 'REVIEW_PENDING',
      reviewPending: true,
      blockingPeriod: pendingPeriod,
      pendingIsRequestedPeriod,
    } : {
      state: raw.balance ? 'READY' : 'NOT_DEFINED',
      reviewPending: false,
      blockingPeriod: null,
      pendingIsRequestedPeriod: false,
    },
    approved: {
      unit: approvedUnit,
      quantity: approvedQuantity,
      baselineQuantity: approvedBaselineQuantity,
      percent: approvedBaselineQuantity === null
        ? null
        : progressMeasurementPercent(approvedQuantity, approvedBaselineQuantity),
      revision: approvedRevision,
    },
    measurements,
    nextCursor: hasMore ? visible.at(-1).id : null,
  };
}

export async function readTaskProgressMeasurementSnapshot(prisma, {
  scope,
  query,
  actorMembershipId = null,
} = {}, { readAdapter = createProgressMeasurementReadAdapter(prisma) } = {}) {
  const command = Object.freeze({
    organizationId: identifier(scope?.organizationId, 'scope.organizationId'),
    projectId: identifier(scope?.projectId, 'scope.projectId'),
    taskId: identifier(query?.taskId, 'query.taskId'),
    status: query?.status === null || query?.status === undefined ? null : enumValue(query.status, STATUS_SET, 'query.status'),
    cursor: query?.cursor === null || query?.cursor === undefined ? null : identifier(query.cursor, 'query.cursor'),
    limit: Number.isSafeInteger(query?.limit) && query.limit >= 1 && query.limit <= MAX_HISTORY ? query.limit : 25,
    period: query?.period === null || query?.period === undefined
      ? null
      : civilFortnightForDate(query.period.start),
    actorMembershipId: requiredActorMembershipId(actorMembershipId),
  });
  try {
    return serializeReadSnapshot(await readAdapter.read(command), command);
  } catch (error) {
    if (error instanceof ProgressMeasurementError) throw error;
    throw databaseError(error) || error;
  }
}

export function progressMeasurementErrorResponse(error) {
  if (!(error instanceof ProgressMeasurementError)) return null;
  return Response.json({ error: error.message, code: error.code }, {
    status: error.status,
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  });
}

export function isApprovedMeasurementWithinBaseline(approvedQuantity, baselineQuantity) {
  return compareProgressMeasurementQuantities(approvedQuantity, baselineQuantity) <= 0;
}
