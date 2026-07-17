import { dependencyCycle, MAX_GANTT_DAYS, MAX_TASK_DEPENDENCIES } from './gantt.js';
import {
  StockpileInputError,
  stockpileNeedsConfiguration,
  validateStockpileCatalog,
} from './stockpiles.js';

const MAX_STATE_NODES = 20_000;
const MAX_STATE_DEPTH = 10;
const MAX_COLLECTION_SIZE = 2_000;
const MAX_PROJECT_STATE_VERSION = 2_147_483_647;
const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const PROJECT_STATE_FIELDS = new Set([
  'operariosCount',
  'avancePercentage',
  'alertsCount',
  'diasEstimados',
  'tasks',
  'incidents',
  'attendance',
  'stockpiles',
  'hrAttendance',
  'hrBonuses',
  'budget',
  'budgetTotal',
  'budgetExecuted',
  'budgetCurrency',
]);
const TASK_FIELDS = new Set([
  'name',
  'assignee',
  'progress',
  'duration',
  'startOffset',
  'startDay',
  'dependencies',
  'isDelayed',
  'isShifted',
]);
const INCIDENT_FIELDS = new Set([
  'id',
  'title',
  'description',
  'type',
  'badge',
  'timestamp',
  'reporter',
  'icon',
  'status',
  'sensitivity',
  'metadata',
  'evidence',
]);
const INCIDENT_METADATA_FIELDS = new Set([
  'kind',
  'stockpileKey',
  'stockRiskStatus',
  'resolvedAt',
  'updatedAt',
  'proposalId',
  'sourceContentRestricted',
  'rawContentRestricted',
  'detailRestricted',
  'redacted',
  'taskRef',
  'workArea',
]);
const INCIDENT_EVIDENCE_FIELDS = new Set([
  'kind',
  'url',
  'filename',
  'mimeType',
  'size',
  'sha256',
  'provider',
  'storageStatus',
  'assetId',
  'publicId',
  'pathname',
]);
const ATTENDANCE_FIELDS = new Set([
  'workerId',
  'name',
  'role',
  'checkin',
  'status',
  'latitude',
  'longitude',
  'accuracy',
  'distanceMeters',
]);
const HR_ATTENDANCE_FIELDS = new Set([
  'workerId',
  'name',
  'role',
  'presents',
  'excused',
  'unexcused',
  'status',
]);
const HR_BONUS_FIELDS = new Set([
  'name',
  'assignee',
  'worker',
  'type',
  'amount',
  'date',
  'description',
]);
const STOCKPILE_FIELDS = new Set([
  'name',
  'current',
  'min',
  'max',
  'unit',
  'supplier',
  'status',
]);
const BUDGET_FIELDS = new Set(['total', 'executed', 'currency']);
const INCIDENT_TYPES = new Set(['info', 'warning', 'critical', 'success']);
const INCIDENT_SENSITIVITIES = new Set(['medical', 'restricted']);
const INCIDENT_STATUSES = new Set(['active', 'open', 'pending', 'resolved', 'closed']);
const INCIDENT_METADATA_KINDS = new Set([
  'medical-leave',
  'stock-risk',
  'operational-proposal',
  'whatsapp-flow-incident',
  'whatsapp-flow-report',
  'sensitive-medical-report',
  'source-content-restricted',
]);
const STOCK_RISK_STATUSES = new Set(['active', 'resolved']);
const EVIDENCE_KINDS = new Set(['image', 'video', 'document', 'audio', 'sticker']);
const EVIDENCE_STORAGE_STATUSES = new Set(['stored']);
const ATTENDANCE_STATUSES = new Set([
  'Presente',
  'Ausente',
  'GPS pendiente',
  'GPS pendiente · EPP verificado',
  'GPS pendiente · EPP incompleto',
  'Presente (ubicación informada)',
  'Presente · EPP verificado',
  'Desvío (ubicación informada)',
  'Desvío (GPS)',
  'Ausente Justificado',
  'Registro operativo restringido',
]);
const HR_ATTENDANCE_STATUSES = new Set([
  'Presente',
  'Ausente',
  'Ausente Justificado',
  'Registro de personal restringido',
]);
const HR_BONUS_TYPES = new Set([
  'Bono de Puntualidad',
  'Reconocimiento de avance',
  'Reconocimiento de presentismo',
  'Detalle de reconocimiento restringido',
]);

export class ProjectStateInputError extends Error {
  constructor(message, { code = 'INVALID_PROJECT_STATE', status = 400 } = {}) {
    super(message);
    this.name = 'ProjectStateInputError';
    this.code = code;
    this.status = status;
  }
}

export class ProjectStateVersionConflictError extends Error {
  constructor(expectedVersion, currentVersion) {
    super('El estado de la obra cambió mientras estabas editando. Recargamos la versión más reciente para evitar sobrescribir trabajo de otra persona.');
    this.name = 'ProjectStateVersionConflictError';
    this.code = 'STATE_VERSION_CONFLICT';
    this.status = 409;
    this.expectedVersion = parseNumericStateVersion(expectedVersion);
    this.currentVersion = parseNumericStateVersion(currentVersion);
  }
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function invalidStateVersion(message, { status = 400, code = 'STATE_VERSION_INVALID' } = {}) {
  throw new ProjectStateInputError(message, { code, status });
}

function parseNumericStateVersion(value) {
  const version = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/.test(value.trim())
      ? Number(value.trim())
      : Number.NaN;
  if (!Number.isSafeInteger(version) || version < 0 || version > MAX_PROJECT_STATE_VERSION) {
    invalidStateVersion('La versión del estado no es válida.');
  }
  return version;
}

export function formatProjectStateEtag(version) {
  return `"project-state-${parseNumericStateVersion(version)}"`;
}

export function parseProjectStateVersion(value, { required = true } = {}) {
  if (value == null || String(value).trim() === '') {
    if (!required) return null;
    invalidStateVersion(
      'Falta la versión esperada del estado. Recargá la obra antes de guardar.',
      { status: 428, code: 'STATE_VERSION_REQUIRED' },
    );
  }
  if (typeof value === 'number') return parseNumericStateVersion(value);
  const raw = String(value).trim();
  const etag = raw.match(/^"project-state-(\d+)"$/);
  if (etag) return parseNumericStateVersion(etag[1]);
  return parseNumericStateVersion(raw);
}

export function assertProjectStateVersion(expectedVersion, currentVersion) {
  if (expectedVersion == null) return parseNumericStateVersion(currentVersion);
  const expected = parseNumericStateVersion(expectedVersion);
  const current = parseNumericStateVersion(currentVersion);
  if (expected !== current) {
    throw new ProjectStateVersionConflictError(expected, current);
  }
  return current;
}

export function parseProjectStateWriteRequest(body, ifMatch = null) {
  const envelope = isPlainObject(body)
    && Object.keys(body).every((key) => key === 'state' || key === 'expectedVersion')
    && Object.hasOwn(body, 'state')
    && Object.hasOwn(body, 'expectedVersion');
  const headerVersion = parseProjectStateVersion(ifMatch, { required: false });
  const envelopeVersion = envelope
    ? parseProjectStateVersion(body.expectedVersion)
    : null;
  if (headerVersion != null && envelopeVersion != null && headerVersion !== envelopeVersion) {
    invalidStateVersion('If-Match y expectedVersion deben identificar la misma versión.');
  }
  const expectedVersion = headerVersion ?? envelopeVersion;
  if (expectedVersion == null) {
    invalidStateVersion(
      'Falta la versión esperada del estado. Recargá la obra antes de guardar.',
      { status: 428, code: 'STATE_VERSION_REQUIRED' },
    );
  }
  return {
    expectedVersion,
    state: envelope ? body.state : body,
  };
}

function assertJsonShape(value, path, depth, counter) {
  counter.count += 1;
  if (counter.count > MAX_STATE_NODES) {
    throw new ProjectStateInputError('El estado supera el límite operativo permitido.');
  }
  if (depth > MAX_STATE_DEPTH) {
    throw new ProjectStateInputError(`La estructura de ${path} es demasiado profunda.`);
  }
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new ProjectStateInputError(`${path} debe contener un número finito.`);
    }
    return;
  }
  if (typeof value === 'string') {
    if (value.length > 20_000) {
      throw new ProjectStateInputError(`${path} supera el máximo de caracteres permitido.`);
    }
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_COLLECTION_SIZE) {
      throw new ProjectStateInputError(`${path} contiene demasiados elementos.`);
    }
    value.forEach((item, index) => assertJsonShape(item, `${path}[${index}]`, depth + 1, counter));
    return;
  }
  if (!isPlainObject(value)) {
    throw new ProjectStateInputError(`${path} debe ser un objeto JSON válido.`);
  }
  const entries = Object.entries(value);
  if (entries.length > MAX_COLLECTION_SIZE) {
    throw new ProjectStateInputError(`${path} contiene demasiadas propiedades.`);
  }
  for (const [key, item] of entries) {
    if (BLOCKED_KEYS.has(key)) {
      throw new ProjectStateInputError(`La propiedad ${key} no está permitida.`);
    }
    assertJsonShape(item, `${path}.${key}`, depth + 1, counter);
  }
}

function assertNumber(value, path, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
    || value < min
    || value > max
  ) {
    throw new ProjectStateInputError(`${path} debe ser un número entre ${min} y ${max}.`);
  }
}

function assertInteger(value, path, options = {}) {
  assertNumber(value, path, options);
  if (!Number.isInteger(value)) {
    throw new ProjectStateInputError(`${path} debe ser un número entero.`);
  }
}

function assertStockpileNumber(value, path) {
  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
    || value < 0
    || value > 1_000_000_000_000
  ) {
    throw new ProjectStateInputError(
      `${path} no tiene un formato numérico válido.`,
      { code: 'STOCKPILE_QUANTITY_INVALID' },
    );
  }
}

function assertShortString(value, path, { required = false, max = 180 } = {}) {
  if (value == null && !required) return;
  if (typeof value !== 'string' || (required && !value.trim()) || value.length > max) {
    throw new ProjectStateInputError(`${path} no tiene un formato válido.`);
  }
}

function assertAllowedFields(value, path, allowedFields) {
  for (const key of Object.keys(value)) {
    if (!allowedFields.has(key)) {
      throw new ProjectStateInputError(`${path}.${key} no está permitido.`);
    }
  }
}

function assertRecordKey(value, path, { max = 180 } = {}) {
  if (
    typeof value !== 'string'
    || !value.trim()
    || value.length > max
    || BLOCKED_KEYS.has(value)
  ) {
    throw new ProjectStateInputError(`${path} no tiene un identificador válido.`);
  }
}

function assertEnum(value, path, allowedValues, { required = false } = {}) {
  if (value == null && !required) return;
  if (typeof value !== 'string' || !allowedValues.has(value)) {
    throw new ProjectStateInputError(`${path} no tiene un valor permitido.`);
  }
}

function assertBoolean(value, path) {
  if (typeof value !== 'boolean') {
    throw new ProjectStateInputError(`${path} debe ser booleano.`);
  }
}

function assertNullableShortString(value, path, { max = 180 } = {}) {
  if (value == null) return;
  assertShortString(value, path, { required: true, max });
}

function assertIsoTimestamp(value, path) {
  assertShortString(value, path, { required: true, max: 40 });
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new ProjectStateInputError(`${path} debe ser una fecha ISO válida.`);
  }
}

function assertCurrency(value, path) {
  if (typeof value !== 'string' || !/^[A-Za-z]{3}$/.test(value)) {
    throw new ProjectStateInputError(`${path} debe usar un código ISO de tres letras.`);
  }
}

function assertAttendanceStatus(value, path) {
  assertShortString(value, path, { required: true, max: 160 });
  const medicalLeave = /^Licencia informada (?:con certificado|· certificado pendiente) \((?:[1-9]|[12]\d|30) días\)$/;
  if (!ATTENDANCE_STATUSES.has(value) && !medicalLeave.test(value)) {
    throw new ProjectStateInputError(`${path} no tiene un estado de asistencia permitido.`);
  }
}

function assertCheckin(value, path) {
  assertShortString(value, path, { required: true, max: 10 });
  if (!/^(?:--:--|(?:[01]\d|2[0-4]):[0-5]\d)$/.test(value)) {
    throw new ProjectStateInputError(`${path} no tiene un horario válido.`);
  }
}

function assertEvidenceUrl(value, path) {
  assertShortString(value, path, { required: true, max: 2_048 });
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new ProjectStateInputError(`${path} debe ser una URL válida.`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new ProjectStateInputError(`${path} debe usar HTTP o HTTPS.`);
  }
}

function assertIncidentMetadata(metadata, path) {
  if (!isPlainObject(metadata)) {
    throw new ProjectStateInputError(`${path} debe ser un objeto.`);
  }
  assertAllowedFields(metadata, path, INCIDENT_METADATA_FIELDS);
  if (Object.hasOwn(metadata, 'kind')) {
    assertEnum(metadata.kind, `${path}.kind`, INCIDENT_METADATA_KINDS, { required: true });
  }
  if (Object.hasOwn(metadata, 'stockpileKey')) {
    assertRecordKey(metadata.stockpileKey, `${path}.stockpileKey`, { max: 160 });
  }
  if (Object.hasOwn(metadata, 'stockRiskStatus')) {
    assertEnum(
      metadata.stockRiskStatus,
      `${path}.stockRiskStatus`,
      STOCK_RISK_STATUSES,
      { required: true },
    );
  }
  if (Object.hasOwn(metadata, 'resolvedAt')) {
    assertIsoTimestamp(metadata.resolvedAt, `${path}.resolvedAt`);
  }
  if (Object.hasOwn(metadata, 'updatedAt')) {
    assertIsoTimestamp(metadata.updatedAt, `${path}.updatedAt`);
  }
  if (Object.hasOwn(metadata, 'proposalId')) {
    assertRecordKey(metadata.proposalId, `${path}.proposalId`, { max: 256 });
  }
  for (
    const field of [
      'sourceContentRestricted',
      'rawContentRestricted',
      'detailRestricted',
      'redacted',
    ]
  ) {
    if (Object.hasOwn(metadata, field)) assertBoolean(metadata[field], `${path}.${field}`);
  }
}

function assertIncidentEvidence(evidence, path) {
  if (!isPlainObject(evidence)) {
    throw new ProjectStateInputError(`${path} debe ser un objeto.`);
  }
  assertAllowedFields(evidence, path, INCIDENT_EVIDENCE_FIELDS);
  assertEnum(evidence.kind, `${path}.kind`, EVIDENCE_KINDS, { required: true });
  assertEvidenceUrl(evidence.url, `${path}.url`);
  assertShortString(evidence.provider, `${path}.provider`, { required: true, max: 80 });
  assertEnum(
    evidence.storageStatus,
    `${path}.storageStatus`,
    EVIDENCE_STORAGE_STATUSES,
    { required: true },
  );
  assertNullableShortString(evidence.filename, `${path}.filename`, { max: 255 });
  if (evidence.mimeType != null) {
    assertShortString(evidence.mimeType, `${path}.mimeType`, { required: true, max: 160 });
    if (!/^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/.test(evidence.mimeType)) {
      throw new ProjectStateInputError(`${path}.mimeType no tiene un formato válido.`);
    }
  }
  if (evidence.size != null) {
    assertInteger(evidence.size, `${path}.size`, { min: 0, max: Number.MAX_SAFE_INTEGER });
  }
  if (evidence.sha256 != null) {
    assertShortString(evidence.sha256, `${path}.sha256`, { required: true, max: 64 });
    if (
      !/^[a-f0-9]{64}$/i.test(evidence.sha256)
      && !/^[A-Za-z0-9+/]{43}=$/.test(evidence.sha256)
    ) {
      throw new ProjectStateInputError(`${path}.sha256 no tiene un formato válido.`);
    }
  }
  for (const field of ['assetId', 'publicId', 'pathname']) {
    assertNullableShortString(evidence[field], `${path}.${field}`, { max: 2_048 });
  }
}

function assertIncident(incident, path) {
  if (!isPlainObject(incident)) {
    throw new ProjectStateInputError(`${path} debe ser un objeto.`);
  }
  assertAllowedFields(incident, path, INCIDENT_FIELDS);
  if (Object.hasOwn(incident, 'id')) {
    assertShortString(incident.id, `${path}.id`, { required: true, max: 180 });
  }
  if (Object.hasOwn(incident, 'title')) {
    assertShortString(incident.title, `${path}.title`, { required: true, max: 240 });
  }
  if (Object.hasOwn(incident, 'description')) {
    assertShortString(
      incident.description,
      `${path}.description`,
      { required: true, max: 2_000 },
    );
  }
  if (Object.hasOwn(incident, 'type')) {
    assertEnum(incident.type, `${path}.type`, INCIDENT_TYPES, { required: true });
  }
  if (Object.hasOwn(incident, 'badge')) {
    assertShortString(incident.badge, `${path}.badge`, { required: true, max: 100 });
  }
  if (Object.hasOwn(incident, 'timestamp')) {
    assertShortString(
      incident.timestamp,
      `${path}.timestamp`,
      { required: true, max: 100 },
    );
  }
  if (Object.hasOwn(incident, 'reporter')) {
    assertShortString(incident.reporter, `${path}.reporter`, { required: true, max: 180 });
  }
  if (Object.hasOwn(incident, 'icon')) {
    assertShortString(incident.icon, `${path}.icon`, { required: true, max: 180 });
  }
  if (Object.hasOwn(incident, 'status')) {
    assertEnum(incident.status, `${path}.status`, INCIDENT_STATUSES, { required: true });
  }
  if (Object.hasOwn(incident, 'sensitivity')) {
    assertEnum(
      incident.sensitivity,
      `${path}.sensitivity`,
      INCIDENT_SENSITIVITIES,
      { required: true },
    );
  }
  if (Object.hasOwn(incident, 'metadata')) {
    assertIncidentMetadata(incident.metadata, `${path}.metadata`);
  }
  if (Object.hasOwn(incident, 'evidence')) {
    assertIncidentEvidence(incident.evidence, `${path}.evidence`);
  }
}

function assertAttendanceCatalog(attendance) {
  if (!isPlainObject(attendance) || Object.keys(attendance).length > 1_000) {
    throw new ProjectStateInputError('attendance debe ser un catálogo de hasta 1000 registros.');
  }
  for (const [workerKey, entry] of Object.entries(attendance)) {
    const path = `attendance.${workerKey}`;
    assertRecordKey(workerKey, 'attendance', { max: 180 });
    if (!isPlainObject(entry)) {
      throw new ProjectStateInputError(`${path} debe ser un objeto.`);
    }
    assertAllowedFields(entry, path, ATTENDANCE_FIELDS);
    if (Object.hasOwn(entry, 'workerId')) {
      assertShortString(entry.workerId, `${path}.workerId`, { required: true, max: 180 });
    }
    if (Object.hasOwn(entry, 'name')) {
      assertShortString(entry.name, `${path}.name`, { required: true, max: 180 });
    }
    if (Object.hasOwn(entry, 'role')) {
      assertShortString(entry.role, `${path}.role`, { required: true, max: 180 });
    }
    if (Object.hasOwn(entry, 'checkin')) assertCheckin(entry.checkin, `${path}.checkin`);
    if (Object.hasOwn(entry, 'status')) assertAttendanceStatus(entry.status, `${path}.status`);
    if (Object.hasOwn(entry, 'latitude')) {
      assertNumber(entry.latitude, `${path}.latitude`, { min: -90, max: 90 });
    }
    if (Object.hasOwn(entry, 'longitude')) {
      assertNumber(entry.longitude, `${path}.longitude`, { min: -180, max: 180 });
    }
    if (Object.hasOwn(entry, 'accuracy')) {
      assertNumber(entry.accuracy, `${path}.accuracy`, { min: 0, max: 1_000_000 });
    }
    if (Object.hasOwn(entry, 'distanceMeters')) {
      assertNumber(
        entry.distanceMeters,
        `${path}.distanceMeters`,
        { min: 0, max: 100_000_000 },
      );
    }
  }
}

function assertHrAttendanceCatalog(attendance) {
  if (!isPlainObject(attendance) || Object.keys(attendance).length > 1_000) {
    throw new ProjectStateInputError('hrAttendance debe ser un catálogo de hasta 1000 registros.');
  }
  for (const [workerKey, entry] of Object.entries(attendance)) {
    const path = `hrAttendance.${workerKey}`;
    assertRecordKey(workerKey, 'hrAttendance', { max: 180 });
    if (!isPlainObject(entry)) {
      throw new ProjectStateInputError(`${path} debe ser un objeto.`);
    }
    assertAllowedFields(entry, path, HR_ATTENDANCE_FIELDS);
    for (const field of ['workerId', 'name', 'role']) {
      if (Object.hasOwn(entry, field)) {
        assertShortString(entry[field], `${path}.${field}`, { required: true, max: 180 });
      }
    }
    for (const field of ['presents', 'excused', 'unexcused']) {
      if (Object.hasOwn(entry, field)) {
        assertInteger(entry[field], `${path}.${field}`, { min: 0, max: 1_000_000 });
      }
    }
    if (Object.hasOwn(entry, 'status')) {
      assertEnum(entry.status, `${path}.status`, HR_ATTENDANCE_STATUSES, { required: true });
    }
  }
}

function assertHrBonuses(bonuses) {
  if (!Array.isArray(bonuses) || bonuses.length > 1_000) {
    throw new ProjectStateInputError('hrBonuses debe ser una lista de hasta 1000 registros.');
  }
  bonuses.forEach((bonus, index) => {
    const path = `hrBonuses[${index}]`;
    if (!isPlainObject(bonus)) {
      throw new ProjectStateInputError(`${path} debe ser un objeto.`);
    }
    assertAllowedFields(bonus, path, HR_BONUS_FIELDS);
    for (const field of ['name', 'assignee', 'worker']) {
      if (Object.hasOwn(bonus, field)) {
        assertShortString(bonus[field], `${path}.${field}`, { required: true, max: 180 });
      }
    }
    if (Object.hasOwn(bonus, 'type')) {
      assertEnum(bonus.type, `${path}.type`, HR_BONUS_TYPES, { required: true });
    }
    if (Object.hasOwn(bonus, 'amount') && bonus.amount != null) {
      assertNumber(bonus.amount, `${path}.amount`, { min: 0, max: Number.MAX_SAFE_INTEGER });
    }
    if (Object.hasOwn(bonus, 'date')) {
      assertShortString(bonus.date, `${path}.date`, { required: true, max: 100 });
    }
    if (Object.hasOwn(bonus, 'description')) {
      assertShortString(
        bonus.description,
        `${path}.description`,
        { required: true, max: 500 },
      );
    }
  });
}

function assertBudget(budget) {
  if (!isPlainObject(budget)) {
    throw new ProjectStateInputError('budget debe ser un objeto.');
  }
  assertAllowedFields(budget, 'budget', BUDGET_FIELDS);
  if (Object.hasOwn(budget, 'total')) {
    assertNumber(budget.total, 'budget.total', { min: 0, max: Number.MAX_SAFE_INTEGER });
  }
  if (Object.hasOwn(budget, 'executed')) {
    assertNumber(budget.executed, 'budget.executed', { min: 0, max: Number.MAX_SAFE_INTEGER });
  }
  if (
    Object.hasOwn(budget, 'total')
    && Object.hasOwn(budget, 'executed')
    && budget.executed > budget.total
  ) {
    throw new ProjectStateInputError('budget.executed no puede superar budget.total.');
  }
  if (Object.hasOwn(budget, 'currency')) assertCurrency(budget.currency, 'budget.currency');
}

function assertKnownCollections(state, previousState = null) {
  assertAllowedFields(state, 'state', PROJECT_STATE_FIELDS);

  if (Object.hasOwn(state, 'tasks')) {
    if (!isPlainObject(state.tasks) || Object.keys(state.tasks).length > 500) {
      throw new ProjectStateInputError('tasks debe ser un catálogo de hasta 500 tareas.');
    }
    for (const [taskId, task] of Object.entries(state.tasks)) {
      assertRecordKey(taskId, 'tasks', { max: 160 });
      if (!isPlainObject(task)) {
        throw new ProjectStateInputError(`tasks.${taskId} debe ser un objeto.`);
      }
      assertAllowedFields(task, `tasks.${taskId}`, TASK_FIELDS);
      assertShortString(task.name, `tasks.${taskId}.name`, { required: true, max: 160 });
      if (Object.hasOwn(task, 'assignee')) {
        assertShortString(
          task.assignee,
          `tasks.${taskId}.assignee`,
          { required: true, max: 160 },
        );
      }
      assertNumber(task.progress, `tasks.${taskId}.progress`, { min: 0, max: 100 });
      assertNumber(task.duration, `tasks.${taskId}.duration`, { min: 1, max: 3_650 });
      if (Object.hasOwn(task, 'startOffset')) {
        assertNumber(task.startOffset, `tasks.${taskId}.startOffset`, { min: 0, max: 100 });
      }
      if (Object.hasOwn(task, 'startDay')) {
        assertInteger(task.startDay, `tasks.${taskId}.startDay`, { min: 1, max: MAX_GANTT_DAYS });
      }
      if (Object.hasOwn(task, 'dependencies')) {
        if (!Array.isArray(task.dependencies) || task.dependencies.length > MAX_TASK_DEPENDENCIES) {
          throw new ProjectStateInputError(`tasks.${taskId}.dependencies debe contener hasta ${MAX_TASK_DEPENDENCIES} predecesoras.`);
        }
        const dependencyIds = new Set();
        for (const dependencyId of task.dependencies) {
          assertShortString(dependencyId, `tasks.${taskId}.dependencies`, { required: true, max: 160 });
          if (dependencyId === taskId) {
            throw new ProjectStateInputError(`tasks.${taskId} no puede depender de sí misma.`);
          }
          if (!Object.hasOwn(state.tasks, dependencyId)) {
            throw new ProjectStateInputError(`tasks.${taskId} depende de una tarea inexistente.`);
          }
          if (dependencyIds.has(dependencyId)) {
            throw new ProjectStateInputError(`tasks.${taskId} contiene una dependencia repetida.`);
          }
          dependencyIds.add(dependencyId);
        }
      }
      for (const field of ['isDelayed', 'isShifted']) {
        if (Object.hasOwn(task, field)) assertBoolean(task[field], `tasks.${taskId}.${field}`);
      }
    }
    const cycle = dependencyCycle(state.tasks);
    if (cycle) {
      throw new ProjectStateInputError(`El cronograma contiene una dependencia circular: ${cycle.join(' → ')}.`);
    }
  }

  if (Object.hasOwn(state, 'incidents')) {
    if (!Array.isArray(state.incidents) || state.incidents.length > 1_000) {
      throw new ProjectStateInputError('incidents debe ser una lista de hasta 1000 registros.');
    }
    state.incidents.forEach((incident, index) => assertIncident(incident, `incidents[${index}]`));
  }

  if (Object.hasOwn(state, 'attendance')) {
    assertAttendanceCatalog(state.attendance);
  }

  if (Object.hasOwn(state, 'hrAttendance')) {
    assertHrAttendanceCatalog(state.hrAttendance);
  }

  if (Object.hasOwn(state, 'hrBonuses')) {
    assertHrBonuses(state.hrBonuses);
  }

  if (Object.hasOwn(state, 'stockpiles')) {
    if (!isPlainObject(state.stockpiles)) {
      throw new ProjectStateInputError('stockpiles debe ser un catálogo de materiales.');
    }
    for (const [materialId, item] of Object.entries(state.stockpiles)) {
      const path = `stockpiles.${materialId}`;
      if (!isPlainObject(item)) {
        throw new ProjectStateInputError(`${path} debe ser un objeto.`);
      }
      assertAllowedFields(item, path, STOCKPILE_FIELDS);
      assertShortString(item.name, `${path}.name`, { required: true, max: 160 });
      if (Object.hasOwn(item, 'unit')) {
        assertShortString(item.unit, `${path}.unit`, { max: 40 });
      }
      assertStockpileNumber(item.current, `${path}.current`);
      assertStockpileNumber(item.min, `${path}.min`);
      assertStockpileNumber(item.max, `${path}.max`);
      if (Object.hasOwn(item, 'supplier')) {
        assertShortString(
          item.supplier,
          `${path}.supplier`,
          { required: true, max: 180 },
        );
      }
      if (Object.hasOwn(item, 'status')) {
        assertShortString(item.status, `${path}.status`, { required: true, max: 80 });
      }
    }
    try {
      validateStockpileCatalog(state.stockpiles, {
        maxItems: 500,
        previousCatalog: isPlainObject(previousState?.stockpiles)
          ? previousState.stockpiles
          : null,
      });
    } catch (error) {
      if (error instanceof StockpileInputError) {
        throw new ProjectStateInputError(error.message, { code: error.code });
      }
      throw error;
    }
  }

  if (Object.hasOwn(state, 'budget')) assertBudget(state.budget);
  if (Object.hasOwn(state, 'budgetTotal')) {
    assertNumber(state.budgetTotal, 'budgetTotal', { min: 0, max: Number.MAX_SAFE_INTEGER });
  }
  if (Object.hasOwn(state, 'budgetExecuted')) {
    assertNumber(
      state.budgetExecuted,
      'budgetExecuted',
      { min: 0, max: Number.MAX_SAFE_INTEGER },
    );
  }
  if (
    Object.hasOwn(state, 'budgetTotal')
    && Object.hasOwn(state, 'budgetExecuted')
    && state.budgetExecuted > state.budgetTotal
  ) {
    throw new ProjectStateInputError('budgetExecuted no puede superar budgetTotal.');
  }
  if (Object.hasOwn(state, 'budgetCurrency')) {
    assertCurrency(state.budgetCurrency, 'budgetCurrency');
  }

  for (const field of ['operariosCount', 'alertsCount']) {
    if (Object.hasOwn(state, field)) {
      assertNumber(state[field], field, { min: 0, max: 1_000_000 });
    }
  }
  if (Object.hasOwn(state, 'avancePercentage')) {
    assertNumber(state.avancePercentage, 'avancePercentage', { min: 0, max: 100 });
  }
  if (Object.hasOwn(state, 'diasEstimados')) {
    if (typeof state.diasEstimados !== 'string' || state.diasEstimados.length > 100) {
      throw new ProjectStateInputError('diasEstimados no tiene un formato válido.');
    }
  }
}

export function validateProjectStateInput(value, { previousState = null } = {}) {
  if (!isPlainObject(value)) {
    throw new ProjectStateInputError('El estado de la obra debe ser un objeto JSON.');
  }
  assertJsonShape(value, 'state', 0, { count: 0 });
  assertKnownCollections(value, previousState);
  return structuredClone(value);
}

function searchableText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function stockRiskMatches(incident, key, material) {
  if (!isPlainObject(incident)) return false;
  const explicitRisk = incident.id === `stock-risk-${key}`
    || (
      incident.metadata?.stockpileKey === key
      && incident.metadata?.kind === 'stock-risk'
    );
  if (explicitRisk) return true;
  if (incident.type === 'success') return false;

  const materialName = searchableText(material.name);
  const incidentText = searchableText(
    `${incident.title || ''} ${incident.description || ''} ${incident.badge || ''}`,
  );
  return materialName
    && incidentText.includes(materialName)
    && /(stock (bajo|critico)|quiebre(?: de)? stock|faltante|debajo del minimo|por debajo del minimo)/.test(incidentText);
}

function stockRiskResolved(incident) {
  return incident?.status === 'resolved'
    || incident?.metadata?.stockRiskStatus === 'resolved'
    || Boolean(incident?.metadata?.resolvedAt);
}

function matchingStockRisks(state, key, material) {
  return state.incidents.filter((incident) => stockRiskMatches(incident, key, material));
}

function activeStockRiskKeys(state) {
  const keys = new Set();
  for (const [key, material] of Object.entries(state.stockpiles)) {
    if (matchingStockRisks(state, key, material).some((incident) => !stockRiskResolved(incident))) {
      keys.add(key);
    }
  }
  return keys;
}

function resolveStockRisk(incident, key, material, resolution) {
  const resolvedAt = new Date().toISOString();
  incident.title = resolution.title;
  incident.description = resolution.description;
  incident.type = resolution.type;
  incident.badge = resolution.badge;
  incident.status = 'resolved';
  incident.metadata = {
    ...(isPlainObject(incident.metadata) ? incident.metadata : {}),
    kind: 'stock-risk',
    stockpileKey: key,
    stockRiskStatus: 'resolved',
    resolvedAt,
  };
}

function upsertStockRisk(state, key, material) {
  const risks = matchingStockRisks(state, key, material);
  const incident = risks.find((candidate) => !stockRiskResolved(candidate)) || risks[0];
  const timestamp = new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date());
  const canonical = incident || {
    id: `stock-risk-${key}`,
    timestamp,
  };

  canonical.title = `Stock bajo: ${material.name}`;
  canonical.description = `${material.current} ${material.unit} disponibles frente a un mínimo de ${material.min}. Requiere revisar el abastecimiento; no se generó ninguna compra automática.`;
  canonical.type = 'warning';
  canonical.badge = 'Stock crítico';
  canonical.reporter = 'Control de acopio';
  canonical.icon = 'fa-solid fa-triangle-exclamation';
  delete canonical.status;
  canonical.metadata = {
    ...(isPlainObject(canonical.metadata) ? canonical.metadata : {}),
    kind: 'stock-risk',
    stockpileKey: key,
    stockRiskStatus: 'active',
    updatedAt: new Date().toISOString(),
  };
  delete canonical.metadata.resolvedAt;

  if (!incident) state.incidents.unshift(canonical);
}

export function flagStockRisks(state) {
  if (!isPlainObject(state?.stockpiles)) return state;
  state.incidents = Array.isArray(state.incidents) ? state.incidents : [];
  const activeBefore = activeStockRiskKeys(state);
  const nonStockAlerts = Math.max(0, numeric(state.alertsCount) - activeBefore.size);

  for (const [key, material] of Object.entries(state.stockpiles)) {
    if (!material) continue;
    const risks = matchingStockRisks(state, key, material);
    const activeRisks = risks.filter((incident) => !stockRiskResolved(incident));
    if (stockpileNeedsConfiguration(material)) {
      material.status = 'Revisar configuración';
      for (const incident of activeRisks) {
        resolveStockRisk(incident, key, material, {
          title: `Revisar acopio: ${material.name}`,
          description: 'La alerta automática quedó pausada porque la unidad, la capacidad o los rangos heredados requieren corrección.',
          type: 'info',
          badge: 'Revisar configuración',
        });
      }
      continue;
    }

    if (numeric(material.current) >= numeric(material.min)) {
      material.status = 'Stock OK';
      for (const incident of activeRisks) {
        resolveStockRisk(incident, key, material, {
          title: `Stock normalizado: ${material.name}`,
          description: `${material.current} ${material.unit} disponibles; el mínimo operativo es ${material.min}.`,
          type: 'success',
          badge: 'Stock normalizado',
        });
      }
      continue;
    }

    const replenishmentStatus = searchableText(material.status);
    if (/(en camino|en transito|pedido|despachado|comprado)/.test(replenishmentStatus)) {
      for (const incident of activeRisks) {
        resolveStockRisk(incident, key, material, {
          title: `Abastecimiento en curso: ${material.name}`,
          description: `${material.current} ${material.unit} disponibles frente a un mínimo de ${material.min}; el material figura ${material.status}.`,
          type: 'info',
          badge: 'En seguimiento',
        });
      }
      continue;
    }

    material.status = 'Crítico';
    upsertStockRisk(state, key, material);
  }
  state.incidents = state.incidents.slice(0, 1_000);
  state.alertsCount = nonStockAlerts + activeStockRiskKeys(state).size;
  return state;
}

function normalizedText(value, fallback = 'Sin detalle') {
  const text = String(value || '').trim();
  return (text || fallback).slice(0, 500);
}

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function taskChanges(before, after) {
  const changes = [];
  if (before.name !== after.name) changes.push(`nombre: ${normalizedText(after.name, 'sin nombre')}`);
  if (numeric(before.progress) !== numeric(after.progress)) changes.push(`avance: ${numeric(after.progress)}%`);
  if (before.assignee !== after.assignee) changes.push(`responsable: ${normalizedText(after.assignee, 'sin asignar')}`);
  if (numeric(before.duration) !== numeric(after.duration)) changes.push(`duración: ${numeric(after.duration)} días`);
  if (numeric(before.startOffset) !== numeric(after.startOffset)) changes.push(`inicio relativo: ${numeric(after.startOffset)}%`);
  if (numeric(before.startDay) !== numeric(after.startDay)) changes.push(`inicio planificado: día ${numeric(after.startDay)}`);
  const beforeDependencies = Array.isArray(before.dependencies) ? before.dependencies : [];
  const afterDependencies = Array.isArray(after.dependencies) ? after.dependencies : [];
  if (JSON.stringify(beforeDependencies) !== JSON.stringify(afterDependencies)) {
    changes.push(`predecesoras: ${afterDependencies.length}`);
  }
  return changes;
}

function activity(entry) {
  return {
    source: 'dashboard',
    severity: 'INFO',
    ...entry,
    title: normalizedText(entry.title),
    description: normalizedText(entry.description),
  };
}

export function deriveProjectStateActivities(beforeState, afterState) {
  const before = isPlainObject(beforeState) ? beforeState : {};
  const after = isPlainObject(afterState) ? afterState : {};
  const entries = [];
  const beforeTasks = isPlainObject(before.tasks) ? before.tasks : {};
  const afterTasks = isPlainObject(after.tasks) ? after.tasks : {};

  for (const [taskId, task] of Object.entries(afterTasks)) {
    const previous = beforeTasks[taskId];
    if (!previous) {
      entries.push(activity({
        action: 'project.task.created',
        category: 'TASK',
        title: `Tarea creada · ${task.name}`,
        description: `${task.assignee || 'Sin responsable'} · avance inicial ${numeric(task.progress)}%.`,
        metadata: { taskId: String(taskId) },
      }));
      continue;
    }
    const changes = taskChanges(previous, task);
    if (changes.length) {
      entries.push(activity({
        action: 'project.task.updated',
        category: 'TASK',
        title: `Tarea actualizada · ${task.name}`,
        description: changes.join(' · '),
        metadata: { taskId: String(taskId) },
      }));
    }
  }
  for (const [taskId, task] of Object.entries(beforeTasks)) {
    if (afterTasks[taskId]) continue;
    entries.push(activity({
      action: 'project.task.deleted',
      category: 'TASK',
      severity: 'WARNING',
      title: `Tarea eliminada · ${task.name}`,
      description: `Se retiró la tarea del cronograma operativo.`,
      metadata: { taskId: String(taskId) },
    }));
  }

  const knownIncidentIds = new Set(
    (Array.isArray(before.incidents) ? before.incidents : []).map((item) => String(item?.id || '')),
  );
  for (const incident of Array.isArray(after.incidents) ? after.incidents : []) {
    const incidentId = String(incident?.id || '');
    if (!incidentId || knownIncidentIds.has(incidentId)) continue;
    const severity = incident.type === 'critical'
      ? 'CRITICAL'
      : incident.type === 'warning'
        ? 'WARNING'
        : incident.type === 'success'
          ? 'SUCCESS'
          : 'INFO';
    entries.push(activity({
      action: 'project.incident.created',
      category: 'INCIDENT',
      severity,
      title: incident.title || 'Incidencia registrada',
      description: incident.description || incident.badge || 'Nueva incidencia de obra.',
      metadata: { incidentId },
    }));
  }

  const beforeStock = isPlainObject(before.stockpiles) ? before.stockpiles : {};
  const afterStock = isPlainObject(after.stockpiles) ? after.stockpiles : {};
  for (const [materialId, material] of Object.entries(afterStock)) {
    const previous = beforeStock[materialId];
    if (!previous || numeric(previous.current) === numeric(material.current)) continue;
    const delta = numeric(material.current) - numeric(previous.current);
    entries.push(activity({
      action: delta > 0 ? 'project.material.received' : 'project.material.adjusted',
      category: 'MATERIAL',
      severity: numeric(material.current) < numeric(material.min) ? 'WARNING' : 'SUCCESS',
      title: `${delta > 0 ? 'Ingreso' : 'Ajuste'} de material · ${material.name}`,
      description: `${numeric(previous.current)} → ${numeric(material.current)} ${material.unit || 'unidades'} (${delta > 0 ? '+' : ''}${delta}).`,
      metadata: { materialId: String(materialId), delta },
    }));
  }

  const beforeBonuses = Array.isArray(before.hrBonuses) ? before.hrBonuses : [];
  const afterBonuses = Array.isArray(after.hrBonuses) ? after.hrBonuses : [];
  for (const bonus of afterBonuses.slice(beforeBonuses.length)) {
    entries.push(activity({
      action: 'project.hr.bonus_awarded',
      category: 'PEOPLE',
      severity: 'SUCCESS',
      title: `Reconocimiento registrado · ${bonus.assignee || bonus.worker || 'Equipo de obra'}`,
      description: bonus.type || bonus.description || 'Reconocimiento de desempeño.',
    }));
  }

  return entries.slice(0, 100);
}
