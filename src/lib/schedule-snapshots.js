import { createHash, randomUUID } from 'node:crypto';

import {
  calculateDeterministicForecast,
  DeterministicForecastError,
  FORECAST_CALENDAR,
  FORECAST_ENGINE_VERSION,
} from './deterministic-forecast.js';
import { runOperationalProjectMutation } from './project-write-policy.js';
import {
  canonicalPlanHash,
  VISUAL_PROGRESS_PLAN_SELECT,
} from './visual-progress-assessments.js';
import { localDateKey } from './zoned-time.js';

const MAX_TASKS = 5_000;
const MAX_DEPENDENCIES = 100_000;
const MAX_PAGE_SIZE = 100;
const MAX_DURATION_DAYS = 3_650;
const MAX_CURSOR_LENGTH = 512;
const MAX_RATIONALE_LENGTH = 1_000;
const REVIEWED_EVIDENCE_DECISION_POLICY = 'human-point-within-reviewed-range-v1';
const SAFE_TEXT = /[\u0000-\u001f\u007f]/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const PROGRESS_SOURCES = new Set([
  'CANONICAL_TASK',
  'MANUAL_OVERRIDE',
  'REVIEWED_EVIDENCE',
]);
const BASELINE_INPUT_FIELDS = new Set([
  'expectedProjectStateVersion',
  'name',
  'replaceActiveBaseline',
  'timeZone',
]);
const FORECAST_INPUT_FIELDS = new Set([
  'asOfDate',
  'baselineId',
  'expectedProjectStateVersion',
  'observations',
]);
const OBSERVATION_FIELDS = new Set([
  'actualFinishDate',
  'actualStartDate',
  'expectedTaskRevision',
  'progressPercent',
  'progressSource',
  'remainingDurationDays',
  'reviewedEvidence',
  'sourceTaskId',
]);
const REVIEWED_EVIDENCE_FIELDS = new Set([
  'assessmentId',
  'expectedAssessmentRevision',
  'rationale',
]);

export class ScheduleSnapshotError extends Error {
  constructor(message, code = 'SCHEDULE_SNAPSHOT_INVALID', status = 400, details = null) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function fail(message, code, status = 400, details = null) {
  throw new ScheduleSnapshotError(message, code, status, details);
}

function text(value, field, max, { required = true } = {}) {
  if (value === null || value === undefined || value === '') {
    if (!required) return null;
    fail(`${field} es obligatorio.`, 'SCHEDULE_SNAPSHOT_INPUT_INVALID');
  }
  if (typeof value !== 'string') fail(`${field} debe ser texto.`, 'SCHEDULE_SNAPSHOT_INPUT_INVALID');
  const normalized = value.trim();
  if (!normalized || normalized.length > max || SAFE_TEXT.test(normalized)) {
    fail(`${field} no cumple los límites de formato.`, 'SCHEDULE_SNAPSHOT_INPUT_INVALID');
  }
  return normalized;
}

function safeInteger(value, field, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    fail(`${field} debe ser un entero entre ${minimum} y ${maximum}.`, 'SCHEDULE_SNAPSHOT_INPUT_INVALID');
  }
  return value;
}

function exactObject(value, field, allowedFields, code = 'SCHEDULE_SNAPSHOT_INPUT_INVALID') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${field} debe ser un objeto JSON.`, code);
  }
  if (Object.keys(value).some((key) => !allowedFields.has(key))) {
    fail(`${field} contiene campos no permitidos.`, code);
  }
  return value;
}

function scopeOf(value) {
  return {
    organizationId: text(value?.organizationId, 'organizationId', 180),
    projectId: text(value?.projectId, 'projectId', 180),
  };
}

function actorOf(value) {
  return text(value, 'actorId', 190);
}

function dateKey(value, field) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) fail(`${field} no es una fecha válida.`, 'SCHEDULE_SNAPSHOT_DATE_INVALID');
    return value.toISOString().slice(0, 10);
  }
  if (typeof value !== 'string' || !ISO_DATE.test(value)) {
    fail(`${field} debe usar YYYY-MM-DD.`, 'SCHEDULE_SNAPSHOT_DATE_INVALID');
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    fail(`${field} debe ser una fecha civil válida.`, 'SCHEDULE_SNAPSHOT_DATE_INVALID');
  }
  return value;
}

function databaseDate(value, field) {
  return new Date(`${dateKey(value, field)}T00:00:00.000Z`);
}

function hash(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value instanceof Date ? value.toISOString() : value ?? null;
}

function operationHash(scope, operation, rawKey) {
  const key = text(rawKey, 'idempotencyKey', 128);
  if (!IDEMPOTENCY_KEY.test(key)) {
    fail(
      'Idempotency-Key debe tener entre 8 y 128 caracteres seguros.',
      'SCHEDULE_IDEMPOTENCY_KEY_INVALID',
    );
  }
  return hash({ contract: 'schedule-snapshots-v1', operation, scope, key });
}

function requestFingerprint(operation, value) {
  return hash({ contract: 'schedule-snapshot-request:v1', operation, value });
}

function paginationFilterFingerprint(kind, scope, filters) {
  return hash({ contract: 'schedule-snapshot-pagination:v1', kind, scope, filters });
}

function encodeCursor(kind, filterFingerprint, position) {
  return Buffer.from(JSON.stringify({ v: 1, k: kind, f: filterFingerprint, p: position }))
    .toString('base64url');
}

function decodeCursor(rawCursor, kind, filterFingerprint) {
  if (rawCursor === null || rawCursor === undefined || rawCursor === '') return null;
  const cursor = text(rawCursor, 'cursor', MAX_CURSOR_LENGTH);
  if (!BASE64URL.test(cursor)) fail('cursor no es válido.', 'SCHEDULE_CURSOR_INVALID');
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    if (Buffer.from(decoded).toString('base64url') !== cursor) {
      fail('cursor no es canónico.', 'SCHEDULE_CURSOR_INVALID');
    }
    const envelope = JSON.parse(decoded);
    if (
      !envelope
      || typeof envelope !== 'object'
      || Array.isArray(envelope)
      || envelope.v !== 1
      || envelope.k !== kind
      || envelope.f !== filterFingerprint
      || !envelope.p
      || typeof envelope.p !== 'object'
      || Array.isArray(envelope.p)
    ) {
      fail('cursor no corresponde a esta consulta.', 'SCHEDULE_CURSOR_INVALID');
    }
    return envelope.p;
  } catch (error) {
    if (error instanceof ScheduleSnapshotError) throw error;
    fail('cursor no es válido.', 'SCHEDULE_CURSOR_INVALID');
  }
}

function baselineCursorPosition(rawCursor, filterFingerprint) {
  const position = decodeCursor(rawCursor, 'baseline', filterFingerprint);
  if (!position) return null;
  return {
    version: safeInteger(position.version, 'cursor.version', 1, 2_147_483_647),
    id: text(position.id, 'cursor.id', 190),
  };
}

function forecastCursorPosition(rawCursor, filterFingerprint) {
  const position = decodeCursor(rawCursor, 'forecast', filterFingerprint);
  if (!position) return null;
  const createdAtText = text(position.createdAt, 'cursor.createdAt', 40);
  const createdAt = new Date(createdAtText);
  if (Number.isNaN(createdAt.getTime()) || createdAt.toISOString() !== createdAtText) {
    fail('cursor contiene una fecha inválida.', 'SCHEDULE_CURSOR_INVALID');
  }
  return { createdAt, id: text(position.id, 'cursor.id', 190) };
}

function assertReplayMatches(row, expectedFingerprint) {
  if (row.requestFingerprint !== expectedFingerprint) {
    fail(
      'La clave de idempotencia ya fue utilizada con otros datos.',
      'SCHEDULE_IDEMPOTENCY_PAYLOAD_MISMATCH',
      409,
    );
  }
}

function normalizeTimeZone(value) {
  const zone = text(value, 'timeZone', 64);
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone }).format(new Date());
  } catch {
    fail('timeZone debe ser una zona horaria IANA válida.', 'SCHEDULE_TIMEZONE_INVALID');
  }
  return zone;
}

function projectStateVersion(value) {
  return safeInteger(value, 'expectedProjectStateVersion', 0, 2_147_483_647);
}

function taskSourceId(task) {
  return text(task?.id, 'task.id', 190);
}

function taskDate(task, field) {
  if (!task?.[field]) {
    fail(`La tarea ${task?.id || 'sin id'} no tiene ${field}; corregí el cronograma antes de publicar.`, 'SCHEDULE_BASELINE_TASK_DATES_REQUIRED', 409, { taskId: task?.id || null, field });
  }
  return dateKey(task[field], `task.${field}`);
}

function normalizedBaselineTask(task, sourceIdByTaskId) {
  const sourceTaskId = taskSourceId(task);
  const type = task.type === 'MILESTONE' ? 'MILESTONE' : task.type === 'TASK' ? 'TASK' : null;
  if (!type) fail('La tarea tiene un tipo no admitido.', 'SCHEDULE_BASELINE_TASK_INVALID', 409, { taskId: sourceTaskId });
  const plannedStart = taskDate(task, 'startsAt');
  const plannedFinish = taskDate(task, 'endsAt');
  if (type === 'MILESTONE' && plannedStart !== plannedFinish) {
    fail('Un hito debe iniciar y terminar el mismo día civil.', 'SCHEDULE_BASELINE_TASK_INVALID', 409, { taskId: sourceTaskId });
  }
  const duration = Math.round((Date.parse(`${plannedFinish}T00:00:00.000Z`) - Date.parse(`${plannedStart}T00:00:00.000Z`)) / 86_400_000) + (type === 'MILESTONE' ? 0 : 1);
  if ((type === 'TASK' && (duration < 1 || duration > MAX_DURATION_DAYS)) || (type === 'MILESTONE' && duration !== 0)) {
    fail('La duración planificada de la tarea es inválida.', 'SCHEDULE_BASELINE_TASK_INVALID', 409, { taskId: sourceTaskId });
  }
  const parentSourceTaskId = task.parentId ? sourceIdByTaskId.get(task.parentId) : null;
  if (task.parentId && !parentSourceTaskId) {
    fail('La tarea padre no pertenece al cronograma publicado.', 'SCHEDULE_BASELINE_PARENT_SCOPE', 409, { taskId: sourceTaskId });
  }
  return {
    sourceTaskId,
    sourceTaskRevision: safeInteger(Number(task.revision ?? 0), 'task.revision', 0, 2_147_483_647),
    code: task.code ? text(task.code, 'task.code', 64) : null,
    title: text(task.title, 'task.title', 160),
    description: task.description ? text(task.description, 'task.description', 4_000) : null,
    type,
    parentSourceTaskId,
    plannedStart,
    plannedFinish,
    plannedDurationDays: duration,
  };
}

function normalizedDependency(dependency, sourceIdByTaskId) {
  const predecessorSourceTaskId = sourceIdByTaskId.get(dependency.predecessorId);
  const successorSourceTaskId = sourceIdByTaskId.get(dependency.successorId);
  if (!predecessorSourceTaskId || !successorSourceTaskId || predecessorSourceTaskId === successorSourceTaskId) {
    fail('Una dependencia no referencia tareas válidas del cronograma.', 'SCHEDULE_BASELINE_DEPENDENCY_SCOPE', 409);
  }
  const type = dependency.type;
  if (!['FINISH_TO_START', 'START_TO_START', 'FINISH_TO_FINISH', 'START_TO_FINISH'].includes(type)) {
    fail('La dependencia tiene un tipo no admitido.', 'SCHEDULE_BASELINE_DEPENDENCY_INVALID', 409);
  }
  return {
    predecessorSourceTaskId,
    successorSourceTaskId,
    type,
    lagDays: safeInteger(Number(dependency.lagDays ?? 0), 'dependency.lagDays', -3_650, 3_650),
  };
}

function stableTaskRows(rows) {
  const ids = new Set();
  for (const row of rows) {
    const id = taskSourceId(row);
    if (ids.has(id)) fail('El origen contiene tareas duplicadas.', 'SCHEDULE_BASELINE_TASK_DUPLICATE', 409, { taskId: id });
    ids.add(id);
  }
  if (rows.length === 0) fail('La obra no tiene tareas canónicas para publicar.', 'SCHEDULE_BASELINE_EMPTY', 409);
  if (rows.length > MAX_TASKS) fail('El cronograma supera el máximo de 5000 tareas.', 'SCHEDULE_BASELINE_LIMIT', 409);
  return [...rows].sort((left, right) => taskSourceId(left).localeCompare(taskSourceId(right)));
}

function serializeBaseline(row) {
  if (!row) return null;
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    name: row.name,
    timeZone: row.timeZone,
    calendarPolicy: row.calendarPolicy,
    taskCount: row.taskCount,
    dependencyCount: row.dependencyCount,
    sourcePlanHash: row.sourcePlanHash,
    contentHash: row.contentHash,
    publishedAt: row.publishedAt?.toISOString?.() || row.publishedAt || null,
    supersededAt: row.supersededAt?.toISOString?.() || row.supersededAt || null,
    supersededById: row.supersededById || null,
  };
}

function serializeForecast(row) {
  if (!row) return null;
  return {
    id: row.id,
    baselineId: row.baselineId,
    engineVersion: row.engineVersion,
    calendarPolicy: row.calendarPolicy,
    asOfDate: dateKey(row.asOfDate, 'asOfDate'),
    baselineStartDate: dateKey(row.baselineStartDate, 'baselineStartDate'),
    baselineFinishDate: dateKey(row.baselineFinishDate, 'baselineFinishDate'),
    forecastStartDate: dateKey(row.forecastStartDate, 'forecastStartDate'),
    forecastFinishDate: dateKey(row.forecastFinishDate, 'forecastFinishDate'),
    startDeltaDays: row.startDeltaDays,
    finishDeltaDays: row.finishDeltaDays,
    taskCount: row.taskCount,
    inputHash: row.inputHash,
    resultHash: row.resultHash,
    createdAt: row.createdAt?.toISOString?.() || row.createdAt || null,
  };
}

function serializeForecastTask(row) {
  return {
    sourceTaskId: row.sourceTaskId,
    code: row.baselineTask?.code || null,
    title: row.baselineTask?.title || row.sourceTaskId,
    type: row.baselineTask?.type || null,
    progressSource: row.progressSource,
    progressPercent: row.progressPercent,
    observedOn: dateKey(row.observedOn, 'observedOn'),
    actualStart: row.actualStart ? dateKey(row.actualStart, 'actualStart') : null,
    actualFinish: row.actualFinish ? dateKey(row.actualFinish, 'actualFinish') : null,
    remainingDurationDays: row.remainingDurationDays,
    baselineStart: dateKey(row.baselineStart, 'baselineStart'),
    baselineFinish: dateKey(row.baselineFinish, 'baselineFinish'),
    forecastStart: dateKey(row.forecastStart, 'forecastStart'),
    forecastFinish: dateKey(row.forecastFinish, 'forecastFinish'),
    forecastDurationDays: row.forecastDurationDays,
    forecastRemainingDays: row.forecastRemainingDays,
    startDeltaDays: row.startDeltaDays,
    finishDeltaDays: row.finishDeltaDays,
    durationDeltaDays: row.durationDeltaDays,
    driver: row.driver && typeof row.driver === 'object' && !Array.isArray(row.driver)
      ? row.driver
      : {},
    relationshipConstraints: Array.isArray(row.relationshipConstraints)
      ? row.relationshipConstraints
      : [],
  };
}

function assertProjectSnapshotVersion(snapshot, expected) {
  const actual = Number(snapshot?.version ?? 0);
  if (actual !== expected) {
    fail('La obra cambió desde que abriste el cronograma; recargá y reintentá.', 'SCHEDULE_PROJECT_STALE', 409, { expected, actual });
  }
}

function baselineContent({ name, timeZone, tasks, dependencies }) {
  const sourcePlanHash = hash({
    calendarPolicy: FORECAST_CALENDAR,
    tasks: tasks.map((task) => ({ ...task })),
    dependencies: dependencies.map((dependency) => ({ ...dependency })),
  });
  return {
    sourcePlanHash,
    contentHash: hash({ name, timeZone, calendarPolicy: FORECAST_CALENDAR, sourcePlanHash }),
  };
}

async function loadCanonicalPlan(transaction, scope) {
  const [tasks, dependencies] = await Promise.all([
    transaction.task.findMany({
      where: { projectId: scope.projectId, metadata: { path: ['source'], equals: 'canonical-task-v1' } },
      select: {
        id: true, code: true, title: true, description: true, type: true,
        startsAt: true, endsAt: true, revision: true, parentId: true,
      },
    }),
    transaction.taskDependency.findMany({
      where: { projectId: scope.projectId },
      select: { predecessorId: true, successorId: true, type: true, lagDays: true },
    }),
  ]);
  const orderedTasks = stableTaskRows(tasks);
  const sourceIdByTaskId = new Map(orderedTasks.map((task) => [task.id, taskSourceId(task)]));
  const normalizedTasks = orderedTasks.map((task) => normalizedBaselineTask(task, sourceIdByTaskId));
  const scopedDependencies = dependencies.filter((dependency) => {
    const predecessorIsCanonical = sourceIdByTaskId.has(dependency.predecessorId);
    const successorIsCanonical = sourceIdByTaskId.has(dependency.successorId);
    if (predecessorIsCanonical !== successorIsCanonical) {
      fail(
        'Una dependencia cruza el cronograma canónico con una tarea externa.',
        'SCHEDULE_BASELINE_DEPENDENCY_SCOPE',
        409,
      );
    }
    return predecessorIsCanonical && successorIsCanonical;
  });
  const normalizedDependencies = scopedDependencies
    .map((dependency) => normalizedDependency(dependency, sourceIdByTaskId))
    .sort((left, right) => `${left.predecessorSourceTaskId}\u0000${left.successorSourceTaskId}`.localeCompare(`${right.predecessorSourceTaskId}\u0000${right.successorSourceTaskId}`));
  if (normalizedDependencies.length > MAX_DEPENDENCIES) fail('El cronograma supera el máximo de dependencias.', 'SCHEDULE_BASELINE_LIMIT', 409);
  return { tasks: normalizedTasks, dependencies: normalizedDependencies };
}

async function existingBaselineByOperation(transaction, scope, operationKeyHash) {
  return transaction.scheduleBaseline.findFirst({
    where: { ...scope, operationKeyHash },
  });
}

function retryable(error) {
  return error?.code === 'P2034' || error?.code === 'P2002';
}

export async function publishScheduleBaseline(prisma, {
  scope: rawScope,
  actorId,
  idempotencyKey,
  input,
} = {}) {
  const scope = scopeOf(rawScope);
  const actor = actorOf(actorId);
  const normalizedInput = exactObject(input, 'input', BASELINE_INPUT_FIELDS);
  const name = text(normalizedInput.name, 'name', 220);
  const timeZone = normalizeTimeZone(normalizedInput.timeZone);
  const expectedProjectStateVersion = projectStateVersion(normalizedInput.expectedProjectStateVersion);
  if (
    normalizedInput.replaceActiveBaseline !== undefined
    && typeof normalizedInput.replaceActiveBaseline !== 'boolean'
  ) {
    fail('replaceActiveBaseline debe ser booleano.', 'SCHEDULE_SNAPSHOT_INPUT_INVALID');
  }
  const replaceActiveBaseline = normalizedInput.replaceActiveBaseline === true;
  const opHash = operationHash(scope, 'publish-baseline', idempotencyKey);
  const fingerprint = requestFingerprint('publish-baseline', {
    expectedProjectStateVersion,
    name,
    replaceActiveBaseline,
    timeZone,
  });

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await runOperationalProjectMutation(prisma, scope, async (transaction) => {
        const replay = await existingBaselineByOperation(transaction, scope, opHash);
        if (replay) {
          assertReplayMatches(replay, fingerprint);
          return { baseline: serializeBaseline(replay), replayed: true };
        }
        const snapshot = await transaction.projectSnapshot.findUnique({
          where: { projectId: scope.projectId }, select: { version: true },
        });
        assertProjectSnapshotVersion(snapshot, expectedProjectStateVersion);
        const plan = await loadCanonicalPlan(transaction, scope);
        const hashes = baselineContent({ name, timeZone, ...plan });
        const active = await transaction.scheduleBaseline.findFirst({
          where: { ...scope, status: 'ACTIVE' }, select: { id: true, version: true, status: true },
        });
        if (active && !replaceActiveBaseline) {
          fail('Ya existe una línea base activa. Confirmá replaceActiveBaseline para rebaselinar.', 'SCHEDULE_BASELINE_ACTIVE_EXISTS', 409, { baselineId: active.id });
        }
        const id = randomUUID();
        const now = new Date();
        await transaction.scheduleBaselineTask.createMany({
          data: plan.tasks.map((task) => ({
            id: randomUUID(), ...scope, baselineId: id,
            ...task,
            plannedStart: databaseDate(task.plannedStart, 'plannedStart'),
            plannedFinish: databaseDate(task.plannedFinish, 'plannedFinish'),
          })),
        });
        if (plan.dependencies.length > 0) {
          await transaction.scheduleBaselineDependency.createMany({
            data: plan.dependencies.map((dependency) => ({ id: randomUUID(), ...scope, baselineId: id, ...dependency })),
          });
        }
        if (active) {
          const superseded = await transaction.scheduleBaseline.updateMany({
            where: { ...scope, id: active.id, status: 'ACTIVE' },
            data: {
              status: 'SUPERSEDED', supersededAt: now, supersededById: id,
              supersessionHash: hash({ previousBaselineId: active.id, nextBaselineId: id, contentHash: hashes.contentHash }),
            },
          });
          if (superseded.count !== 1) fail('La línea base activa cambió; recargá y reintentá.', 'SCHEDULE_BASELINE_CONFLICT', 409);
        }
        const baseline = await transaction.scheduleBaseline.create({
          data: {
            id, ...scope, version: active ? active.version + 1 : 1, status: 'ACTIVE', name, timeZone,
            calendarPolicy: FORECAST_CALENDAR, operationKeyHash: opHash, ...hashes,
            taskCount: plan.tasks.length, dependencyCount: plan.dependencies.length, publishedAt: now,
            requestFingerprint: fingerprint,
          },
        });
        await transaction.auditLog.create({
          data: {
            organizationId: scope.organizationId, actorId: actor, action: 'schedule.baseline.published',
            entityType: 'ScheduleBaseline', entityId: baseline.id,
            metadata: { projectId: scope.projectId, version: baseline.version, taskCount: baseline.taskCount, dependencyCount: baseline.dependencyCount, replacedBaselineId: active?.id || null },
          },
        });
        return { baseline: serializeBaseline(baseline), replayed: false };
      }, { attempts: 1, transactionOptions: { isolationLevel: 'Serializable' } });
    } catch (error) {
      if (!retryable(error) || attempt === 3) throw error;
    }
  }
  throw new Error('Schedule baseline publication retry loop exhausted.');
}

export async function listScheduleBaselines(prisma, { scope: rawScope, status = null, cursor = null, limit = 25 } = {}) {
  const scope = scopeOf(rawScope);
  const normalizedStatus = status === null || status === undefined || status === '' ? null : String(status);
  if (normalizedStatus && !['ACTIVE', 'SUPERSEDED'].includes(normalizedStatus)) fail('status no es válido.', 'SCHEDULE_QUERY_INVALID');
  const take = safeInteger(Number(limit), 'limit', 1, MAX_PAGE_SIZE);
  const filterFingerprint = paginationFilterFingerprint('baseline', scope, { status: normalizedStatus });
  const position = baselineCursorPosition(cursor, filterFingerprint);
  const rows = await prisma.scheduleBaseline.findMany({
    where: {
      ...scope,
      ...(normalizedStatus ? { status: normalizedStatus } : {}),
      ...(position ? {
        OR: [
          { version: { lt: position.version } },
          { version: position.version, id: { lt: position.id } },
        ],
      } : {}),
    },
    orderBy: [{ version: 'desc' }, { id: 'desc' }], take: take + 1,
  });
  const hasMore = rows.length > take;
  const page = rows.slice(0, take);
  const last = page.at(-1);
  return {
    baselines: page.map(serializeBaseline),
    nextCursor: hasMore && last
      ? encodeCursor('baseline', filterFingerprint, { version: last.version, id: last.id })
      : null,
    hasMore,
  };
}

function normalizedObservation(value, index) {
  exactObject(value, `observations[${index}]`, OBSERVATION_FIELDS, 'SCHEDULE_FORECAST_INPUT_INVALID');
  const sourceTaskId = text(value.sourceTaskId, `observations[${index}].sourceTaskId`, 190);
  const expectedTaskRevision = safeInteger(value.expectedTaskRevision, `observations[${index}].expectedTaskRevision`, 0, 2_147_483_647);
  const progressPercent = safeInteger(value.progressPercent, `observations[${index}].progressPercent`, 0, 100);
  const progressSource = String(value.progressSource || 'CANONICAL_TASK');
  if (!PROGRESS_SOURCES.has(progressSource)) fail('progressSource no es válido.', 'SCHEDULE_FORECAST_INPUT_INVALID', 400, { index });
  if (progressSource === 'MANUAL_OVERRIDE') {
    fail(
      'El avance manual exige una observación persistida y revisable; el override libre está deshabilitado.',
      'SCHEDULE_FORECAST_MANUAL_OVERRIDE_PROVENANCE_REQUIRED',
      409,
      { index },
    );
  }
  let reviewedEvidence = null;
  if (progressSource === 'REVIEWED_EVIDENCE') {
    if (!value.reviewedEvidence || typeof value.reviewedEvidence !== 'object' || Array.isArray(value.reviewedEvidence)) {
      fail(
        'El avance por evidencia revisada exige una evaluación y revisión persistidas.',
        'SCHEDULE_FORECAST_REVIEWED_EVIDENCE_PROVENANCE_REQUIRED',
        409,
        { index },
      );
    }
    const provenance = exactObject(
      value.reviewedEvidence,
      `observations[${index}].reviewedEvidence`,
      REVIEWED_EVIDENCE_FIELDS,
      'SCHEDULE_FORECAST_INPUT_INVALID',
    );
    reviewedEvidence = {
      assessmentId: text(
        provenance.assessmentId,
        `observations[${index}].reviewedEvidence.assessmentId`,
        190,
      ),
      expectedAssessmentRevision: safeInteger(
        provenance.expectedAssessmentRevision,
        `observations[${index}].reviewedEvidence.expectedAssessmentRevision`,
        0,
        2_147_483_647,
      ),
      rationale: text(
        provenance.rationale,
        `observations[${index}].reviewedEvidence.rationale`,
        MAX_RATIONALE_LENGTH,
      ),
    };
  } else if (Object.hasOwn(value, 'reviewedEvidence')) {
    fail(
      'La procedencia visual sólo puede acompañar avance por evidencia revisada.',
      'SCHEDULE_FORECAST_INPUT_INVALID',
      400,
      { index },
    );
  }
  const actualStartDate = value.actualStartDate == null ? null : dateKey(value.actualStartDate, `observations[${index}].actualStartDate`);
  const actualFinishDate = value.actualFinishDate == null ? null : dateKey(value.actualFinishDate, `observations[${index}].actualFinishDate`);
  const remainingDurationDays = value.remainingDurationDays == null ? null : safeInteger(value.remainingDurationDays, `observations[${index}].remainingDurationDays`, 0, MAX_DURATION_DAYS);
  return {
    sourceTaskId,
    expectedTaskRevision,
    progressPercent,
    progressSource,
    actualStartDate,
    actualFinishDate,
    remainingDurationDays,
    ...(reviewedEvidence ? { reviewedEvidence } : {}),
  };
}

function observationsByTask(observations, baselineTasks, liveTasks) {
  if (!Array.isArray(observations) || observations.length !== baselineTasks.length || observations.length > MAX_TASKS) {
    fail('El forecast exige exactamente una observación por tarea de la línea base.', 'SCHEDULE_FORECAST_OBSERVATIONS_REQUIRED');
  }
  const byId = new Map();
  for (const observation of observations) {
    if (byId.has(observation.sourceTaskId)) fail('Hay observaciones duplicadas para una tarea.', 'SCHEDULE_FORECAST_OBSERVATION_DUPLICATE', 400, { sourceTaskId: observation.sourceTaskId });
    byId.set(observation.sourceTaskId, observation);
  }
  const baselineIds = new Set(baselineTasks.map((task) => task.sourceTaskId));
  if (byId.size !== baselineIds.size || [...byId.keys()].some((id) => !baselineIds.has(id))) {
    fail('Las observaciones no coinciden con la línea base seleccionada.', 'SCHEDULE_FORECAST_OBSERVATION_SCOPE', 409);
  }
  const liveById = new Map(liveTasks.map((task) => [task.id, task]));
  for (const [sourceTaskId, observation] of byId) {
    const live = liveById.get(sourceTaskId);
    if (!live || Number(live.revision) !== observation.expectedTaskRevision) {
      fail('Una tarea cambió o ya no existe; recargá antes de calcular.', 'SCHEDULE_FORECAST_TASK_STALE', 409, { sourceTaskId });
    }
    if (observation.progressSource === 'CANONICAL_TASK' && Number(live.progress) !== observation.progressPercent) {
      fail('El avance canónico cambió; usá el valor vigente o una fuente explícita revisada.', 'SCHEDULE_FORECAST_PROGRESS_STALE', 409, { sourceTaskId });
    }
  }
  return byId;
}

function mediaSha256(value) {
  const candidate = value && typeof value === 'object' && !Array.isArray(value)
    ? String(value.sha256 || '').toLowerCase()
    : '';
  return /^[0-9a-f]{64}$/.test(candidate) ? candidate : null;
}

function reviewedRange(assessment) {
  const corrected = assessment.reviewStatus === 'CORRECTED';
  const minimum = corrected ? assessment.correctedProgressMin : assessment.progressMin;
  const maximum = corrected ? assessment.correctedProgressMax : assessment.progressMax;
  if (
    !Number.isSafeInteger(minimum)
    || !Number.isSafeInteger(maximum)
    || minimum < 0
    || maximum > 100
    || minimum > maximum
  ) {
    fail(
      'La revisión visual no conserva un rango de avance utilizable.',
      'SCHEDULE_FORECAST_REVIEWED_EVIDENCE_RANGE_INVALID',
      409,
      { assessmentId: assessment.id },
    );
  }
  return { minimum, maximum };
}

function reviewedObservationFingerprint({ scope, assessment, evidence, observation, range, evidenceSha, planHash }) {
  return hash({
    contract: 'schedule-progress-observation:v1',
    scope,
    assessmentId: assessment.id,
    assessmentRevision: assessment.revision,
    evidenceId: evidence.id,
    evidenceRevision: evidence.revision,
    evidenceSha256: evidenceSha,
    evidenceCapturedAt: evidence.capturedAt,
    taskId: assessment.taskId,
    taskRevision: observation.expectedTaskRevision,
    planHash,
    reviewStatus: assessment.reviewStatus,
    reviewedById: assessment.reviewedById,
    reviewedAt: assessment.reviewedAt,
    progressMin: range.minimum,
    progressMax: range.maximum,
    progressPercent: observation.progressPercent,
    decisionPolicyVersion: REVIEWED_EVIDENCE_DECISION_POLICY,
    observedOn: observation.observedOn,
    actualStartDate: observation.actualStartDate,
    actualFinishDate: observation.actualFinishDate,
    remainingDurationDays: observation.remainingDurationDays,
    rationale: observation.reviewedEvidence.rationale,
  });
}

async function materializeReviewedProgressObservations(transaction, {
  scope,
  actorId,
  baseline,
  asOfDate,
  observations,
  liveTasks,
}) {
  const reviewed = observations.filter((observation) => observation.progressSource === 'REVIEWED_EVIDENCE');
  if (reviewed.length === 0) return new Map();
  if (baseline.status !== 'ACTIVE') {
    fail(
      'La evidencia revisada sólo puede proyectarse sobre la línea base activa.',
      'SCHEDULE_FORECAST_REVIEWED_EVIDENCE_BASELINE_STALE',
      409,
    );
  }

  const assessmentIds = [...new Set(reviewed.map((observation) => observation.reviewedEvidence.assessmentId))];
  if (assessmentIds.length !== reviewed.length) {
    fail(
      'Una evaluación visual no puede alimentar más de una observación del mismo corte.',
      'SCHEDULE_FORECAST_REVIEWED_EVIDENCE_DUPLICATE',
      409,
    );
  }
  const assessments = await transaction.visualProgressAssessment.findMany({
    where: { projectId: scope.projectId, id: { in: assessmentIds } },
    include: {
      evidence: {
        select: {
          id: true,
          taskId: true,
          status: true,
          revision: true,
          media: true,
          capturedAt: true,
        },
      },
    },
  });
  const planHash = canonicalPlanHash(liveTasks);
  const assessmentById = new Map(assessments.map((assessment) => [assessment.id, assessment]));
  const liveById = new Map(liveTasks.map((task) => [task.id, task]));
  const persistedByTask = new Map();

  for (const observation of reviewed) {
    const reference = observation.reviewedEvidence;
    const assessment = assessmentById.get(reference.assessmentId);
    const liveTask = liveById.get(observation.sourceTaskId);
    if (!assessment || assessment.taskId !== observation.sourceTaskId || !liveTask) {
      fail(
        'La evaluación visual no pertenece a la tarea y obra seleccionadas.',
        'SCHEDULE_FORECAST_REVIEWED_EVIDENCE_SCOPE',
        409,
        { sourceTaskId: observation.sourceTaskId },
      );
    }
    if (
      assessment.revision !== reference.expectedAssessmentRevision
      || assessment.status !== 'COMPLETED'
      || !['APPROVED', 'CORRECTED'].includes(assessment.reviewStatus)
      || !assessment.reviewedById
      || !assessment.reviewedAt
    ) {
      fail(
        'La evaluación visual cambió o todavía no tiene una revisión humana utilizable.',
        'SCHEDULE_FORECAST_REVIEWED_EVIDENCE_STALE',
        409,
        { assessmentId: assessment.id },
      );
    }
    const evidence = assessment.evidence;
    const evidenceSha = mediaSha256(evidence?.media);
    if (
      !evidence
      || evidence.taskId !== observation.sourceTaskId
      || evidence.status !== 'APPROVED'
      || !evidenceSha
      || evidenceSha !== assessment.inputSha256
      || evidence.revision !== assessment.evidenceRevisionAtRequest
    ) {
      fail(
        'La evidencia fuente cambió, no está aprobada o perdió su integridad.',
        'SCHEDULE_FORECAST_REVIEWED_EVIDENCE_SOURCE_STALE',
        409,
        { assessmentId: assessment.id },
      );
    }
    if (
      Number(liveTask.revision) !== observation.expectedTaskRevision
      || Number(liveTask.revision) !== assessment.taskRevisionAtRequest
      || planHash !== assessment.baselineHash
    ) {
      fail(
        'El plan o la tarea cambiaron desde la lectura visual; generá una evaluación nueva.',
        'SCHEDULE_FORECAST_REVIEWED_EVIDENCE_PLAN_STALE',
        409,
        { assessmentId: assessment.id },
      );
    }
    let capturedOn;
    try {
      capturedOn = localDateKey(evidence.capturedAt, baseline.timeZone);
    } catch {
      fail(
        'La fecha de captura de la evidencia no puede verificarse en la zona horaria de la línea base.',
        'SCHEDULE_FORECAST_REVIEWED_EVIDENCE_DATE_INVALID',
        409,
        { assessmentId: assessment.id },
      );
    }
    if (capturedOn > asOfDate) {
      fail(
        'La evidencia fue capturada después de la fecha de corte.',
        'SCHEDULE_FORECAST_REVIEWED_EVIDENCE_AFTER_CUTOFF',
        409,
        { assessmentId: assessment.id },
      );
    }
    const range = reviewedRange(assessment);
    if (observation.progressPercent < range.minimum || observation.progressPercent > range.maximum) {
      fail(
        'El avance puntual elegido debe permanecer dentro del rango revisado por la persona responsable.',
        'SCHEDULE_FORECAST_REVIEWED_EVIDENCE_POINT_OUT_OF_RANGE',
        409,
        { assessmentId: assessment.id, minimum: range.minimum, maximum: range.maximum },
      );
    }
    const observationForFingerprint = { ...observation, observedOn: asOfDate };
    const fingerprint = reviewedObservationFingerprint({
      scope,
      assessment,
      evidence,
      observation: observationForFingerprint,
      range,
      evidenceSha,
      planHash,
    });
    const operationKeyHash = hash({
      contract: 'schedule-progress-observation-operation:v1',
      scope,
      assessmentId: assessment.id,
      assessmentRevision: assessment.revision,
    });
    let persisted = await transaction.scheduleProgressObservation.findFirst({
      where: {
        ...scope,
        assessmentId: assessment.id,
        assessmentRevision: assessment.revision,
      },
    });
    if (persisted) {
      if (persisted.requestFingerprint !== fingerprint) {
        fail(
          'Esta revisión visual ya originó otra observación inmutable.',
          'SCHEDULE_FORECAST_REVIEWED_EVIDENCE_ALREADY_USED',
          409,
          { assessmentId: assessment.id },
        );
      }
    } else {
      persisted = await transaction.scheduleProgressObservation.create({
        data: {
          id: randomUUID(),
          ...scope,
          taskId: assessment.taskId,
          evidenceId: evidence.id,
          assessmentId: assessment.id,
          source: 'REVIEWED_EVIDENCE',
          assessmentRevision: assessment.revision,
          evidenceRevision: evidence.revision,
          taskRevision: observation.expectedTaskRevision,
          evidenceSha256: evidenceSha,
          evidenceCapturedAt: evidence.capturedAt,
          planHash,
          reviewStatus: assessment.reviewStatus,
          reviewedById: assessment.reviewedById,
          reviewedAt: assessment.reviewedAt,
          progressMin: range.minimum,
          progressMax: range.maximum,
          progressPercent: observation.progressPercent,
          decisionPolicyVersion: REVIEWED_EVIDENCE_DECISION_POLICY,
          observedOn: databaseDate(asOfDate, 'asOfDate'),
          actualStart: observation.actualStartDate
            ? databaseDate(observation.actualStartDate, 'actualStartDate')
            : null,
          actualFinish: observation.actualFinishDate
            ? databaseDate(observation.actualFinishDate, 'actualFinishDate')
            : null,
          remainingDurationDays: observation.remainingDurationDays,
          rationale: reference.rationale,
          operationKeyHash,
          requestFingerprint: fingerprint,
          createdById: actorId,
        },
      });
      await transaction.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          actorId,
          action: 'schedule.progress_observation.created',
          entityType: 'ScheduleProgressObservation',
          entityId: persisted.id,
          metadata: {
            projectId: scope.projectId,
            taskId: assessment.taskId,
            evidenceId: evidence.id,
            assessmentId: assessment.id,
            assessmentRevision: assessment.revision,
            evidenceRevision: evidence.revision,
            evidenceCapturedOn: capturedOn,
            reviewStatus: assessment.reviewStatus,
            progressPercent: observation.progressPercent,
            decisionPolicyVersion: REVIEWED_EVIDENCE_DECISION_POLICY,
            asOfDate,
            baselineId: baseline.id,
          },
        },
      });
    }
    persistedByTask.set(observation.sourceTaskId, persisted);
  }
  return persistedByTask;
}

function forecastInput(baselineTasks, dependencies, observations, asOfDate) {
  return {
    asOfDate,
    tasks: baselineTasks.map((task) => {
      const observation = observations.get(task.sourceTaskId);
      return {
        id: task.sourceTaskId, type: task.type, progress: observation.progressPercent,
        baselineStartDate: dateKey(task.plannedStart, 'plannedStart'), baselineFinishDate: dateKey(task.plannedFinish, 'plannedFinish'),
        actualStartDate: observation.actualStartDate, actualFinishDate: observation.actualFinishDate,
        remainingDurationDays: observation.remainingDurationDays,
      };
    }),
    dependencies: dependencies.map((dependency) => ({
      predecessorId: dependency.predecessorSourceTaskId, successorId: dependency.successorSourceTaskId,
      type: dependency.type, lagDays: dependency.lagDays,
    })),
  };
}

export async function calculateScheduleForecast(prisma, {
  scope: rawScope,
  actorId,
  idempotencyKey,
  input,
} = {}) {
  const scope = scopeOf(rawScope);
  const actor = actorOf(actorId);
  const normalizedInput = exactObject(input, 'input', FORECAST_INPUT_FIELDS, 'SCHEDULE_FORECAST_INPUT_INVALID');
  const asOfDate = dateKey(normalizedInput.asOfDate, 'asOfDate');
  const expectedProjectStateVersion = projectStateVersion(normalizedInput.expectedProjectStateVersion);
  const requestedBaselineId = normalizedInput.baselineId
    ? text(normalizedInput.baselineId, 'baselineId', 190)
    : null;
  if (!Array.isArray(normalizedInput.observations) || normalizedInput.observations.length > MAX_TASKS) {
    fail(
      'observations debe ser una lista acotada.',
      'SCHEDULE_FORECAST_OBSERVATIONS_REQUIRED',
    );
  }
  const normalizedObservations = normalizedInput.observations
    .map(normalizedObservation)
    .sort((left, right) => left.sourceTaskId.localeCompare(right.sourceTaskId));
  const opHash = operationHash(scope, 'calculate-forecast', idempotencyKey);
  const fingerprint = requestFingerprint('calculate-forecast', {
    asOfDate,
    baselineId: requestedBaselineId,
    expectedProjectStateVersion,
    observations: normalizedObservations,
  });
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await runOperationalProjectMutation(prisma, scope, async (transaction) => {
        const replay = await transaction.scheduleForecastRun.findFirst({ where: { ...scope, operationKeyHash: opHash } });
        if (replay) {
          assertReplayMatches(replay, fingerprint);
          return { forecast: serializeForecast(replay), replayed: true };
        }
        const [snapshot, baseline] = await Promise.all([
          transaction.projectSnapshot.findUnique({ where: { projectId: scope.projectId }, select: { version: true } }),
          transaction.scheduleBaseline.findFirst({ where: { ...scope, ...(requestedBaselineId ? { id: requestedBaselineId } : { status: 'ACTIVE' }) } }),
        ]);
        assertProjectSnapshotVersion(snapshot, expectedProjectStateVersion);
        if (!baseline) fail('No existe la línea base solicitada dentro de esta obra.', 'SCHEDULE_BASELINE_NOT_FOUND', 404);
        const [baselineTasks, dependencies, liveTasks] = await Promise.all([
          transaction.scheduleBaselineTask.findMany({ where: { ...scope, baselineId: baseline.id }, orderBy: { sourceTaskId: 'asc' } }),
          transaction.scheduleBaselineDependency.findMany({ where: { ...scope, baselineId: baseline.id }, orderBy: [{ predecessorSourceTaskId: 'asc' }, { successorSourceTaskId: 'asc' }] }),
          transaction.task.findMany({
            where: { projectId: scope.projectId },
            select: VISUAL_PROGRESS_PLAN_SELECT,
            orderBy: { id: 'asc' },
          }),
        ]);
        if (baselineTasks.length !== baseline.taskCount || dependencies.length !== baseline.dependencyCount) {
          fail('La línea base inmutable no está íntegra.', 'SCHEDULE_BASELINE_INTEGRITY_FAILED', 409);
        }
        const observations = observationsByTask(normalizedObservations, baselineTasks, liveTasks);
        let calculated;
        try {
          calculated = calculateDeterministicForecast(forecastInput(baselineTasks, dependencies, observations, asOfDate));
        } catch (error) {
          if (error instanceof DeterministicForecastError) {
            throw new ScheduleSnapshotError(error.message, error.code, 400, error.details);
          }
          throw error;
        }
        const progressObservations = await materializeReviewedProgressObservations(transaction, {
          scope,
          actorId: actor,
          baseline,
          asOfDate,
          observations: normalizedObservations,
          liveTasks,
        });
        const immutableInputHash = hash({ baselineContentHash: baseline.contentHash, engineInputHash: calculated.inputHash, observations: [...observations.values()] });
        const id = randomUUID();
        await transaction.scheduleForecastTask.createMany({
          data: calculated.tasks.map((task) => {
            const observation = observations.get(task.id);
            return {
              id: randomUUID(), ...scope, forecastRunId: id, baselineId: baseline.id, sourceTaskId: task.id,
              observedTaskRevision: observation.expectedTaskRevision, progressSource: observation.progressSource,
              progressObservationId: progressObservations.get(task.id)?.id || null,
              progressPercent: task.progress, observedOn: databaseDate(asOfDate, 'asOfDate'),
              actualStart: observation.actualStartDate ? databaseDate(observation.actualStartDate, 'actualStartDate') : null,
              actualFinish: observation.actualFinishDate ? databaseDate(observation.actualFinishDate, 'actualFinishDate') : null,
              remainingDurationDays: observation.remainingDurationDays,
              baselineStart: databaseDate(task.baseline.startDate, 'baselineStart'), baselineFinish: databaseDate(task.baseline.finishDate, 'baselineFinish'),
              forecastStart: databaseDate(task.forecast.startDate, 'forecastStart'), forecastFinish: databaseDate(task.forecast.finishDate, 'forecastFinish'),
              forecastDurationDays: task.forecast.durationDays, forecastRemainingDays: task.forecast.remainingDurationDays,
              startDeltaDays: task.deltas.startDays, finishDeltaDays: task.deltas.finishDays, durationDeltaDays: task.deltas.durationDays,
              driver: task.driver, relationshipConstraints: task.relationshipConstraints,
            };
          }),
        });
        const forecast = await transaction.scheduleForecastRun.create({
          data: {
            id, ...scope, baselineId: baseline.id, engineVersion: calculated.engineVersion, calendarPolicy: FORECAST_CALENDAR,
            operationKeyHash: opHash, inputHash: immutableInputHash, resultHash: calculated.resultHash, asOfDate: databaseDate(asOfDate, 'asOfDate'),
            baselineStartDate: databaseDate(calculated.project.baseline.startDate, 'baselineStartDate'), baselineFinishDate: databaseDate(calculated.project.baseline.finishDate, 'baselineFinishDate'),
            forecastStartDate: databaseDate(calculated.project.forecast.startDate, 'forecastStartDate'), forecastFinishDate: databaseDate(calculated.project.forecast.finishDate, 'forecastFinishDate'),
            startDeltaDays: calculated.project.deltas.startDays, finishDeltaDays: calculated.project.deltas.finishDays,
            taskCount: calculated.tasks.length, topologicalOrder: calculated.topologicalOrder,
            requestFingerprint: fingerprint,
          },
        });
        await transaction.auditLog.create({
          data: {
            organizationId: scope.organizationId, actorId: actor, action: 'schedule.forecast.calculated',
            entityType: 'ScheduleForecastRun', entityId: forecast.id,
            metadata: {
              projectId: scope.projectId,
              baselineId: baseline.id,
              taskCount: forecast.taskCount,
              reviewedEvidenceTaskCount: progressObservations.size,
              asOfDate,
            },
          },
        });
        return { forecast: serializeForecast(forecast), replayed: false };
      }, { attempts: 1, transactionOptions: { isolationLevel: 'Serializable' } });
    } catch (error) {
      if (!retryable(error) || attempt === 3) throw error;
    }
  }
  throw new Error('Schedule forecast calculation retry loop exhausted.');
}

export async function listScheduleForecastRuns(prisma, { scope: rawScope, baselineId = null, cursor = null, limit = 25 } = {}) {
  const scope = scopeOf(rawScope);
  const normalizedBaselineId = baselineId ? text(baselineId, 'baselineId', 190) : null;
  const take = safeInteger(Number(limit), 'limit', 1, MAX_PAGE_SIZE);
  const filterFingerprint = paginationFilterFingerprint('forecast', scope, { baselineId: normalizedBaselineId });
  const position = forecastCursorPosition(cursor, filterFingerprint);
  const rows = await prisma.scheduleForecastRun.findMany({
    where: {
      ...scope,
      ...(normalizedBaselineId ? { baselineId: normalizedBaselineId } : {}),
      ...(position ? {
        OR: [
          { createdAt: { lt: position.createdAt } },
          { createdAt: position.createdAt, id: { lt: position.id } },
        ],
      } : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: take + 1,
  });
  const hasMore = rows.length > take;
  const page = rows.slice(0, take);
  const last = page.at(-1);
  const lastCreatedAt = last?.createdAt instanceof Date
    ? last.createdAt.toISOString()
    : last?.createdAt
      ? new Date(last.createdAt).toISOString()
      : null;
  return {
    forecasts: page.map(serializeForecast),
    nextCursor: hasMore && last && lastCreatedAt
      ? encodeCursor('forecast', filterFingerprint, { createdAt: lastCreatedAt, id: last.id })
      : null,
    hasMore,
  };
}

export async function getScheduleForecastRun(prisma, {
  scope: rawScope,
  forecastId: rawForecastId,
} = {}) {
  const scope = scopeOf(rawScope);
  const forecastId = text(rawForecastId, 'forecastId', 190);
  const row = await prisma.scheduleForecastRun.findFirst({
    where: { ...scope, id: forecastId },
    include: {
      tasks: {
        include: {
          baselineTask: {
            select: { code: true, title: true, type: true },
          },
        },
      },
    },
  });
  if (!row) {
    fail(
      'El pronóstico no existe dentro de esta obra.',
      'SCHEDULE_FORECAST_NOT_FOUND',
      404,
    );
  }
  const tasksById = new Map(row.tasks.map((task) => [task.sourceTaskId, task]));
  const topologicalOrder = Array.isArray(row.topologicalOrder)
    ? row.topologicalOrder.filter((taskId) => typeof taskId === 'string')
    : [];
  const ordered = [];
  for (const taskId of topologicalOrder) {
    const task = tasksById.get(taskId);
    if (task) {
      ordered.push(task);
      tasksById.delete(taskId);
    }
  }
  ordered.push(...[...tasksById.values()].sort((left, right) => (
    left.sourceTaskId.localeCompare(right.sourceTaskId)
  )));
  return {
    forecast: {
      ...serializeForecast(row),
      tasks: ordered.map(serializeForecastTask),
    },
  };
}

export function scheduleSnapshotErrorResponse(error) {
  if (!(error instanceof ScheduleSnapshotError)) return null;
  return Response.json({
    error: error.message,
    code: error.code,
    ...(error.details ? { details: error.details } : {}),
  }, { status: error.status });
}

export const SCHEDULE_SNAPSHOT_LIMITS = Object.freeze({ MAX_TASKS, MAX_DEPENDENCIES, MAX_PAGE_SIZE });
