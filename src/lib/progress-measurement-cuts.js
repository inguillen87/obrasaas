import { createHash } from 'node:crypto';

import {
  normalizeProgressMeasurementQuantity,
  ProgressMeasurementQuantityError,
} from './progress-measurement-quantity.js';
import {
  civilFortnightForDate,
  PROGRESS_MEASUREMENT_METHODS,
  PROGRESS_MEASUREMENT_UNITS,
} from './progress-measurements.js';
import { isValidTimeZone } from './zoned-time.js';

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const CUT_LINE_STATES = new Set(['MEASURED', 'MISSING']);
const UNIT_SET = new Set(PROGRESS_MEASUREMENT_UNITS);
const METHOD_SET = new Set(PROGRESS_MEASUREMENT_METHODS);
const PROJECT_STATUS_SET = new Set(['PLANNING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']);
const READINESS_SET = new Set(['REVIEW_PENDING', 'EMPTY', 'READY', 'UP_TO_DATE', 'STALE']);
const MUTATION_RESULT_FIELDS = new Set([
  'cut_id',
  'organization_id',
  'project_id',
  'period_start',
  'period_end',
  'cut_version',
  'task_count',
  'measured_line_count',
  'missing_line_count',
  'snapshot_sha256',
  'sealed_by_membership_id',
  'sealed_at',
  'head_revision',
  'replayed',
]);

const SEAL_SQL = `
  SELECT *
  FROM "obrasaas_progress_measurement_cut_seal"(
    $1::text, $2::text, $3::date, $4::date,
    $5::text, $6::text, $7::text, $8::text, $9::text
  )
`;

const READ_SQL = `
  SELECT *
  FROM "obrasaas_progress_measurement_cut_read"(
    $1::text, $2::text, $3::date, $4::date, $5::text
  )
`;

const READ_RESULT_FIELDS = new Set([
  'organization_id',
  'project_id',
  'project_name',
  'project_status',
  'time_zone',
  'tenant_today',
  'period_start',
  'period_end',
  'head_current_cut_id',
  'head_revision',
  'candidate_sha256',
  'task_count',
  'measured_line_count',
  'missing_line_count',
  'review_pending',
  'actor_can_seal',
  'readiness',
  'candidate_lines',
  'current_cut',
]);

export const PROGRESS_MEASUREMENT_CUT_MAX_BODY_BYTES = 16 * 1024;

export class ProgressMeasurementCutError extends Error {
  constructor(message, code = 'PROGRESS_MEASUREMENT_CUT_INVALID', status = 400) {
    super(message);
    this.name = 'ProgressMeasurementCutError';
    this.code = code;
    this.status = status;
  }
}

function strictObject(value, field = 'body') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ProgressMeasurementCutError(`${field} debe ser un objeto.`);
  }
  return value;
}

function exactFields(value, allowed, required, field = 'body') {
  const keys = Object.keys(value);
  const unknown = keys.find((key) => !allowed.has(key));
  if (unknown) throw new ProgressMeasurementCutError(`${field}.${unknown} no está permitido.`);
  const missing = [...required].find((key) => !Object.hasOwn(value, key));
  if (missing) throw new ProgressMeasurementCutError(`${field}.${missing} es obligatorio.`);
}

function identifier(value, field, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (typeof value !== 'string' || !IDENTIFIER_PATTERN.test(value)) {
    throw new ProgressMeasurementCutError(`${field} es inválido.`);
  }
  return value;
}

function storedInteger(value, field, { minimum = 0, maximum = Number.MAX_SAFE_INTEGER } = {}) {
  const normalized = typeof value === 'bigint' ? Number(value) : value;
  if (
    !Number.isSafeInteger(normalized)
    || normalized < minimum
    || normalized > maximum
  ) throw contractError(field);
  return normalized;
}

function storedText(value, field, { maximum = 1_000, nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (
    typeof value !== 'string'
    || !value.trim()
    || value.length > maximum
    || /[\u0000-\u001f\u007f]/.test(value)
  ) throw contractError(field);
  return value;
}

function storedDate(value, field) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw contractError(field);
  return date.toISOString();
}

function storedCivilDate(value, field) {
  const text = value instanceof Date ? value.toISOString().slice(0, 10) : value;
  if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw contractError(field);
  }
  try {
    civilFortnightForDate(text);
  } catch {
    throw contractError(field);
  }
  return text;
}

function storedEnum(value, allowed, field) {
  if (typeof value !== 'string' || !allowed.has(value)) throw contractError(field);
  return value;
}

function storedHash(value, field) {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) throw contractError(field);
  return value;
}

function storedQuantity(value, field, { allowZero = true } = {}) {
  if (typeof value !== 'string') throw contractError();
  try {
    const normalized = normalizeProgressMeasurementQuantity(value, { allowZero, field });
    if (normalized !== value) throw contractError();
    return normalized;
  } catch (error) {
    if (error instanceof ProgressMeasurementQuantityError) throw contractError();
    throw error;
  }
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

function candidateToken(value) {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    throw new ProgressMeasurementCutError(
      'expectedCandidateToken es inválido.',
      'PROGRESS_MEASUREMENT_CUT_CANDIDATE_TOKEN_INVALID',
    );
  }
  return value;
}

function contractError() {
  return new ProgressMeasurementCutError(
    'La persistencia devolvió un corte técnico inválido.',
    'PROGRESS_MEASUREMENT_CUT_CONTRACT_INVALID',
    500,
  );
}

function cutPeriod(value, field = 'period') {
  const start = storedCivilDate(value?.start, `${field}.start`);
  const end = storedCivilDate(value?.end, `${field}.end`);
  let period;
  try {
    period = civilFortnightForDate(start);
  } catch {
    throw contractError(field);
  }
  if (period.end !== end) throw contractError(field);
  return period;
}

const TASK_FIELDS = new Set(['id', 'code', 'title', 'revision']);
const APPROVED_MEASUREMENT_FIELDS = new Set([
  'id',
  'revision',
  'unit',
  'baselineQuantity',
  'executedQuantity',
  'cumulativeQuantity',
  'method',
  'rationale',
  'evidenceCount',
  'approvedAt',
]);
const CUT_LINE_FIELDS = new Set(['state', 'snapshotToken', 'task', 'approvedMeasurement']);
const CURRENT_CUT_FIELDS = new Set([
  'id',
  'previousCutId',
  'version',
  'taskCount',
  'measuredLineCount',
  'missingLineCount',
  'candidateToken',
  'integrityDigest',
  'sealedAt',
  'sealedByLabel',
  'sealedByIsCurrentActor',
  'lines',
]);

function serializeTask(value) {
  const task = exactStoredFields(value, TASK_FIELDS);
  return {
    id: identifier(task.id, 'line.task.id'),
    code: task.code === null
      ? null
      : storedText(task.code, 'line.task.code', { maximum: 64 }),
    title: storedText(task.title, 'line.task.title', { maximum: 1_000 }),
    revision: storedInteger(task.revision, 'line.task.revision'),
  };
}

function serializeApprovedMeasurement(value) {
  const measurement = exactStoredFields(value, APPROVED_MEASUREMENT_FIELDS);
  return {
    id: identifier(measurement.id, 'line.approvedMeasurement.id'),
    revision: storedInteger(
      measurement.revision,
      'line.approvedMeasurement.revision',
      { minimum: 1 },
    ),
    unit: storedEnum(measurement.unit, UNIT_SET, 'line.approvedMeasurement.unit'),
    baselineQuantity: storedQuantity(
      measurement.baselineQuantity,
      'line.approvedMeasurement.baselineQuantity',
      { allowZero: false },
    ),
    executedQuantity: storedQuantity(
      measurement.executedQuantity,
      'line.approvedMeasurement.executedQuantity',
      { allowZero: false },
    ),
    cumulativeQuantity: storedQuantity(
      measurement.cumulativeQuantity,
      'line.approvedMeasurement.cumulativeQuantity',
      { allowZero: false },
    ),
    method: storedEnum(
      measurement.method,
      METHOD_SET,
      'line.approvedMeasurement.method',
    ),
    rationale: storedText(
      measurement.rationale,
      'line.approvedMeasurement.rationale',
      { maximum: 1_000 },
    ),
    evidenceCount: storedInteger(
      measurement.evidenceCount,
      'line.approvedMeasurement.evidenceCount',
      { minimum: 1, maximum: 10 },
    ),
    approvedAt: storedDate(
      measurement.approvedAt,
      'line.approvedMeasurement.approvedAt',
    ),
  };
}

function serializeCutLines(value, expectedCounts) {
  if (!Array.isArray(value) || value.length !== expectedCounts.taskCount) throw contractError();
  const seen = new Set();
  const seenSnapshotTokens = new Set();
  let previousTaskId = null;
  let measuredLineCount = 0;
  let missingLineCount = 0;
  const lines = value.map((rawLine) => {
    const line = exactStoredFields(rawLine, CUT_LINE_FIELDS);
    const state = storedEnum(line.state, CUT_LINE_STATES, 'line.state');
    const task = serializeTask(line.task);
    if (
      seen.has(task.id)
      || (previousTaskId !== null && task.id <= previousTaskId)
    ) throw contractError();
    seen.add(task.id);
    previousTaskId = task.id;
    const snapshotToken = storedHash(line.snapshotToken, 'line.snapshotToken');
    if (seenSnapshotTokens.has(snapshotToken)) throw contractError();
    seenSnapshotTokens.add(snapshotToken);
    if (state === 'MISSING') {
      if (line.approvedMeasurement !== null) throw contractError();
      missingLineCount += 1;
      return {
        state,
        snapshotToken,
        task,
        approvedMeasurement: null,
      };
    }
    if (line.approvedMeasurement === null) throw contractError();
    measuredLineCount += 1;
    return {
      state,
      snapshotToken,
      task,
      approvedMeasurement: serializeApprovedMeasurement(line.approvedMeasurement),
    };
  });
  if (
    measuredLineCount !== expectedCounts.measuredLineCount
    || missingLineCount !== expectedCounts.missingLineCount
  ) throw contractError();
  return lines;
}

function serializeCurrentCut(value, period, actorCandidateToken) {
  if (value === null) return null;
  const cut = exactStoredFields(value, CURRENT_CUT_FIELDS);
  const taskCount = storedInteger(
    cut.taskCount,
    'latestCut.taskCount',
    { minimum: 1, maximum: 5_000 },
  );
  const measuredLineCount = storedInteger(
    cut.measuredLineCount,
    'latestCut.measuredLineCount',
    { minimum: 1, maximum: 5_000 },
  );
  const missingLineCount = storedInteger(
    cut.missingLineCount,
    'latestCut.missingLineCount',
    { maximum: 5_000 },
  );
  if (taskCount !== measuredLineCount + missingLineCount) throw contractError();
  if (typeof cut.sealedByIsCurrentActor !== 'boolean') throw contractError();
  const candidateTokenValue = storedHash(cut.candidateToken, 'latestCut.candidateToken');
  const id = identifier(cut.id, 'latestCut.id');
  const previousCutId = identifier(
    cut.previousCutId,
    'latestCut.previousCutId',
    { nullable: true },
  );
  const version = storedInteger(cut.version, 'latestCut.version', { minimum: 1 });
  if ((version === 1) !== (previousCutId === null) || previousCutId === id) throw contractError();
  return {
    id,
    previousCutId,
    version,
    period,
    taskCount,
    measuredLineCount,
    missingLineCount,
    candidateToken: candidateTokenValue,
    integrity: {
      algorithm: 'SHA-256',
      digest: storedHash(cut.integrityDigest, 'latestCut.integrity.digest'),
    },
    sealedAt: storedDate(cut.sealedAt, 'latestCut.sealedAt'),
    sealedBy: {
      label: storedText(cut.sealedByLabel, 'latestCut.sealedBy.label', { maximum: 190 }),
      isCurrentActor: cut.sealedByIsCurrentActor,
    },
    lines: serializeCutLines(cut.lines, {
      taskCount,
      measuredLineCount,
      missingLineCount,
    }),
    stale: candidateTokenValue !== actorCandidateToken,
  };
}

function derivedReadiness({ reviewPending, measuredLineCount, currentCut, candidateTokenValue }) {
  if (reviewPending) return 'REVIEW_PENDING';
  if (measuredLineCount === 0) return 'EMPTY';
  if (!currentCut) return 'READY';
  return currentCut.candidateToken === candidateTokenValue ? 'UP_TO_DATE' : 'STALE';
}

function readinessBlocker({ state, periodClosed, projectStatus, actorCanSeal }) {
  if (state === 'REVIEW_PENDING') return 'REVIEW_PENDING';
  if (state === 'EMPTY') return 'NO_APPROVED_MEASUREMENTS';
  if (state === 'UP_TO_DATE') return 'CUT_UNCHANGED';
  if (projectStatus === 'ARCHIVED') return 'PROJECT_ARCHIVED';
  if (!periodClosed) return 'PERIOD_OPEN';
  if (!actorCanSeal) return 'PERMISSION_REQUIRED';
  return null;
}

function serializeReadSnapshot(rows, command) {
  if (!Array.isArray(rows) || rows.length !== 1) throw contractError();
  const row = exactStoredFields(rows[0], READ_RESULT_FIELDS);
  if (
    row.organization_id !== command.organizationId
    || row.project_id !== command.projectId
  ) throw contractError();

  const period = cutPeriod({ start: row.period_start, end: row.period_end });
  if (period.start !== command.period.start || period.end !== command.period.end) {
    throw contractError();
  }
  const tenantToday = storedCivilDate(row.tenant_today, 'tenantToday');
  const timeZone = storedText(row.time_zone, 'project.timeZone', { maximum: 190 });
  if (!isValidTimeZone(timeZone)) throw contractError();
  const projectStatus = storedEnum(row.project_status, PROJECT_STATUS_SET, 'project.status');
  const taskCount = storedInteger(row.task_count, 'candidate.taskCount', { maximum: 5_000 });
  const measuredLineCount = storedInteger(
    row.measured_line_count,
    'candidate.measuredLineCount',
    { maximum: 5_000 },
  );
  const missingLineCount = storedInteger(
    row.missing_line_count,
    'candidate.missingLineCount',
    { maximum: 5_000 },
  );
  if (taskCount !== measuredLineCount + missingLineCount) throw contractError();
  if (typeof row.review_pending !== 'boolean') throw contractError();
  if (typeof row.actor_can_seal !== 'boolean') throw contractError();
  const candidateTokenValue = storedHash(row.candidate_sha256, 'candidate.token');
  const candidateLines = serializeCutLines(row.candidate_lines, {
    taskCount,
    measuredLineCount,
    missingLineCount,
  });
  const latestCut = serializeCurrentCut(row.current_cut, period, candidateTokenValue);
  const currentCutId = identifier(
    row.head_current_cut_id,
    'head.currentCutId',
    { nullable: true },
  );
  const headRevision = storedInteger(row.head_revision, 'head.revision');
  if (
    (latestCut === null && (currentCutId !== null || headRevision !== 0))
    || (latestCut !== null && (
      currentCutId !== latestCut.id
      || headRevision < 1
      || headRevision !== latestCut.version
      || latestCut.previousCutId === latestCut.id
    ))
  ) throw contractError();

  const state = storedEnum(row.readiness, READINESS_SET, 'readiness.state');
  const expectedState = derivedReadiness({
    reviewPending: row.review_pending,
    measuredLineCount,
    currentCut: latestCut,
    candidateTokenValue,
  });
  if (state !== expectedState || row.review_pending !== (state === 'REVIEW_PENDING')) {
    throw contractError();
  }
  const periodClosed = period.end < tenantToday;
  const candidateReady = (
    (state === 'READY' || state === 'STALE')
    && periodClosed
    && projectStatus !== 'ARCHIVED'
    && measuredLineCount > 0
  );
  const canSeal = candidateReady && row.actor_can_seal;
  const blockingReason = readinessBlocker({
    state,
    periodClosed,
    projectStatus,
    actorCanSeal: row.actor_can_seal,
  });
  if (canSeal !== (blockingReason === null)) throw contractError();

  return {
    project: {
      id: identifier(row.project_id, 'project.id'),
      name: storedText(row.project_name, 'project.name', { maximum: 1_000 }),
      status: projectStatus,
      timeZone,
    },
    requestedPeriod: period,
    tenantToday,
    head: latestCut ? {
      currentCutId,
      revision: headRevision,
    } : null,
    readiness: {
      state,
      candidateReady,
      canSeal,
      blockingReason,
      reviewPending: row.review_pending,
      periodClosed,
      taskCount,
      measuredLineCount,
      missingLineCount,
    },
    candidate: {
      expectedHeadCutId: currentCutId,
      token: candidateTokenValue,
      taskCount,
      measuredLineCount,
      missingLineCount,
      lines: candidateLines,
    },
    latestCut,
    executionAllowed: false,
  };
}

function normalizePeriodDate(value) {
  try {
    return civilFortnightForDate(value);
  } catch {
    throw new ProgressMeasurementCutError(
      'periodDate debe ser una fecha civil válida con formato YYYY-MM-DD.',
      'PROGRESS_MEASUREMENT_CUT_PERIOD_INVALID',
    );
  }
}

export function requireProgressMeasurementCutIdempotencyKey(value) {
  const candidate = typeof value === 'string' ? value : value?.headers?.get?.('Idempotency-Key');
  if (typeof candidate !== 'string' || !IDEMPOTENCY_KEY_PATTERN.test(candidate)) {
    throw new ProgressMeasurementCutError(
      'Idempotency-Key debe tener entre 8 y 128 caracteres seguros.',
      'PROGRESS_MEASUREMENT_CUT_IDEMPOTENCY_KEY_INVALID',
    );
  }
  return candidate;
}

export function normalizeProgressMeasurementCutQuery(requestOrValue) {
  const params = requestOrValue instanceof URLSearchParams
    ? requestOrValue
    : new URL(requestOrValue.url).searchParams;
  for (const [key] of params) {
    if (key !== 'periodDate' || params.getAll(key).length !== 1) {
      throw new ProgressMeasurementCutError(
        'La consulta del corte técnico es inválida.',
        'PROGRESS_MEASUREMENT_CUT_QUERY_INVALID',
      );
    }
  }
  if (!params.has('periodDate')) {
    throw new ProgressMeasurementCutError(
      'periodDate es obligatorio.',
      'PROGRESS_MEASUREMENT_CUT_QUERY_INVALID',
    );
  }
  return Object.freeze({ period: normalizePeriodDate(params.get('periodDate')) });
}

export function normalizeProgressMeasurementCutSeal(input, operationKey) {
  const body = strictObject(input);
  exactFields(
    body,
    new Set(['periodDate', 'expectedHeadCutId', 'expectedCandidateToken']),
    new Set(['periodDate', 'expectedHeadCutId', 'expectedCandidateToken']),
  );
  return Object.freeze({
    period: normalizePeriodDate(body.periodDate),
    expectedHeadCutId: identifier(body.expectedHeadCutId, 'expectedHeadCutId', { nullable: true }),
    expectedCandidateToken: candidateToken(body.expectedCandidateToken),
    operationKey: requireProgressMeasurementCutIdempotencyKey(operationKey),
  });
}

function requiredActorMembershipId(value) {
  if (value === null || value === undefined || value === '') {
    throw new ProgressMeasurementCutError(
      'Una membresía activa en la organización es obligatoria.',
      'TENANT_MEMBERSHIP_REQUIRED',
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

function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function boundRequestFingerprint(operation, command) {
  const payload = Object.fromEntries(Object.entries(command).filter(
    ([key]) => key !== 'operationKey' && key !== 'requestFingerprint',
  ));
  return fingerprint({ operation, ...payload });
}

const DATABASE_ERRORS = Object.freeze([
  [['IDEMPOTENCY_REPLAY_MUTATED', 'operation key was already used with a different'], 'PROGRESS_MEASUREMENT_CUT_IDEMPOTENCY_CONFLICT', 409, 'La clave de idempotencia ya fue usada con otro contenido.'],
  [['PROGRESS_MEASUREMENT_CUT_SCOPE_INVALID', 'tenant-scoped progress measurement cut was not found'], 'PROGRESS_MEASUREMENT_CUT_NOT_FOUND', 404, 'No se encontró el corte técnico en la obra activa.'],
  [['PROGRESS_MEASUREMENT_CUT_ACTOR_FORBIDDEN', 'PROGRESS_MEASUREMENT_CUT_READ_FORBIDDEN', 'requires an active director or administrator membership'], 'PROGRESS_MEASUREMENT_CUT_FORBIDDEN', 403, 'No tenés permisos para operar este corte técnico.'],
  [['PROGRESS_MEASUREMENT_CUT_HEAD_STALE', 'stale expected progress measurement cut'], 'PROGRESS_MEASUREMENT_CUT_HEAD_STALE', 409, 'El corte técnico cambió. Actualizá antes de continuar.'],
  [['PROGRESS_MEASUREMENT_CUT_CANDIDATE_STALE'], 'PROGRESS_MEASUREMENT_CUT_CANDIDATE_STALE', 409, 'La composición técnica cambió. Actualizá antes de sellar.'],
  [['PROGRESS_MEASUREMENT_CUT_REVIEW_PENDING'], 'PROGRESS_MEASUREMENT_CUT_REVIEW_PENDING', 409, 'Hay mediciones pendientes de decisión en la obra.'],
  [['PROGRESS_MEASUREMENT_CUT_EMPTY'], 'PROGRESS_MEASUREMENT_CUT_EMPTY', 409, 'No hay mediciones aprobadas para sellar en esta quincena.'],
  [['PROGRESS_MEASUREMENT_CUT_NO_CHANGE', 'PROGRESS_MEASUREMENT_CUT_UNCHANGED'], 'PROGRESS_MEASUREMENT_CUT_UNCHANGED', 409, 'La composición aprobada ya está sellada sin cambios.'],
  [['PROGRESS_MEASUREMENT_CUT_PERIOD_OPEN', 'PROGRESS_MEASUREMENT_CUT_FUTURE_PERIOD'], 'PROGRESS_MEASUREMENT_CUT_PERIOD_OPEN', 409, 'La quincena debe estar cerrada antes de sellarla.'],
  [['PROGRESS_MEASUREMENT_CUT_TOO_LARGE'], 'PROGRESS_MEASUREMENT_CUT_TOO_LARGE', 409, 'La obra supera el máximo de 5000 tareas por corte técnico.'],
  [['PROGRESS_MEASUREMENT_CUT_PERIOD_INVALID'], 'PROGRESS_MEASUREMENT_CUT_PERIOD_INVALID', 400, 'La quincena del corte técnico es inválida.'],
  [['PROGRESS_MEASUREMENT_CUT_PROJECT_ARCHIVED', 'PROGRESS_MEASUREMENT_CUT_PROJECT_READ_ONLY'], 'PROJECT_READ_ONLY', 409, 'La obra no admite nuevos cortes técnicos en su estado actual.'],
]);

function databaseError(error) {
  const text = [error?.code, error?.message, error?.meta?.message, error?.meta?.database_error]
    .filter((value) => typeof value === 'string')
    .join(' ')
    .toLowerCase();
  for (const [markers, code, status, message] of DATABASE_ERRORS) {
    if (markers.some((marker) => text.includes(marker.toLowerCase()))) {
      return new ProgressMeasurementCutError(message, code, status);
    }
  }
  return null;
}

export function progressMeasurementCutErrorResponse(error) {
  if (!(error instanceof ProgressMeasurementCutError)) return null;
  return Response.json({ error: error.message, code: error.code }, {
    status: error.status,
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  });
}

function serializeMutationResult(rows, command) {
  if (!Array.isArray(rows) || rows.length !== 1) throw contractError();
  const row = rows[0];
  if (!row || typeof row !== 'object' || Array.isArray(row)) throw contractError();
  const fields = Object.keys(row);
  if (
    fields.length !== MUTATION_RESULT_FIELDS.size
    || fields.some((field) => !MUTATION_RESULT_FIELDS.has(field))
    || [...MUTATION_RESULT_FIELDS].some((field) => !Object.hasOwn(row, field))
  ) throw contractError();

  const period = cutPeriod({ start: row.period_start, end: row.period_end });
  const cutId = identifier(row.cut_id, 'cut.id');
  const version = storedInteger(row.cut_version, 'cut.version', { minimum: 1 });
  const taskCount = storedInteger(
    row.task_count,
    'cut.taskCount',
    { minimum: 1, maximum: 5_000 },
  );
  const measuredLineCount = storedInteger(
    row.measured_line_count,
    'cut.measuredLineCount',
    { minimum: 1, maximum: 5_000 },
  );
  const missingLineCount = storedInteger(
    row.missing_line_count,
    'cut.missingLineCount',
    { maximum: 5_000 },
  );
  const headRevision = storedInteger(row.head_revision, 'head.revision', { minimum: 1 });
  const sealedByMembershipId = identifier(
    row.sealed_by_membership_id,
    'cut.sealedByMembershipId',
  );
  if (
    row.organization_id !== command.organizationId
    || row.project_id !== command.projectId
    || period.start !== command.period.start
    || period.end !== command.period.end
    || taskCount !== measuredLineCount + missingLineCount
    || version !== headRevision
    || sealedByMembershipId !== command.actorMembershipId
    || typeof row.replayed !== 'boolean'
  ) throw contractError();

  return {
    cut: {
      id: cutId,
      previousCutId: command.expectedHeadCutId,
      version,
      period,
      taskCount,
      measuredLineCount,
      missingLineCount,
      candidateToken: command.expectedCandidateToken,
      integrity: {
        algorithm: 'SHA-256',
        digest: storedHash(row.snapshot_sha256, 'cut.integrity.digest'),
      },
      sealedAt: storedDate(row.sealed_at, 'cut.sealedAt'),
      sealedBy: {
        label: null,
        isCurrentActor: true,
      },
    },
    head: {
      currentCutId: cutId,
      revision: headRevision,
    },
    executionAllowed: false,
    replayed: row.replayed,
  };
}

export function createProgressMeasurementCutSqlAdapter(prisma) {
  if (!prisma || typeof prisma.$queryRawUnsafe !== 'function') {
    throw new ProgressMeasurementCutError(
      'El sellado durable de cortes técnicos no está disponible.',
      'PROGRESS_MEASUREMENT_CUT_UNAVAILABLE',
      503,
    );
  }
  return Object.freeze({
    seal(command) {
      return prisma.$queryRawUnsafe(
        SEAL_SQL,
        command.organizationId,
        command.projectId,
        command.period.start,
        command.period.end,
        command.expectedHeadCutId,
        command.expectedCandidateToken,
        command.operationKey,
        command.requestFingerprint,
        command.actorMembershipId,
      );
    },
  });
}

export function createProgressMeasurementCutReadAdapter(prisma) {
  if (!prisma || typeof prisma.$transaction !== 'function') {
    throw new ProgressMeasurementCutError(
      'La lectura durable de cortes técnicos no está disponible.',
      'PROGRESS_MEASUREMENT_CUT_UNAVAILABLE',
      503,
    );
  }
  return Object.freeze({
    read(command) {
      return prisma.$transaction(
        (database) => database.$queryRawUnsafe(
          READ_SQL,
          command.organizationId,
          command.projectId,
          command.period.start,
          command.period.end,
          command.actorMembershipId,
        ),
        { isolationLevel: 'RepeatableRead' },
      );
    },
  });
}

export async function readProgressMeasurementCutSnapshot(prisma, {
  scope,
  actorMembershipId,
  query,
} = {}, options = {}) {
  const trusted = trustedScope(scope, actorMembershipId);
  const period = query?.period
    ? normalizePeriodDate(query.period.start)
    : null;
  if (!period || period.end !== query?.period?.end) {
    throw new ProgressMeasurementCutError(
      'La quincena del corte técnico es inválida.',
      'PROGRESS_MEASUREMENT_CUT_PERIOD_INVALID',
    );
  }
  const command = Object.freeze({ ...trusted, period });
  const readAdapter = options.readAdapter || createProgressMeasurementCutReadAdapter(prisma);
  try {
    return serializeReadSnapshot(await readAdapter.read(command), command);
  } catch (error) {
    if (error instanceof ProgressMeasurementCutError) throw error;
    throw databaseError(error) || error;
  }
}

export async function sealProgressMeasurementCut(prisma, {
  scope,
  actorMembershipId,
  operationKey,
  input,
} = {}, options = {}) {
  const draft = {
    ...trustedScope(scope, actorMembershipId),
    ...normalizeProgressMeasurementCutSeal(input, operationKey),
  };
  const command = Object.freeze({
    ...draft,
    requestFingerprint: boundRequestFingerprint('SEAL', draft),
  });
  const sqlAdapter = options.sqlAdapter || createProgressMeasurementCutSqlAdapter(prisma);
  try {
    return serializeMutationResult(await sqlAdapter.seal(command), command);
  } catch (error) {
    if (error instanceof ProgressMeasurementCutError) throw error;
    throw databaseError(error) || error;
  }
}
