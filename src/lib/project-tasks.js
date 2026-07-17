import {
  ganttDateForDay,
  ganttTaskStartDay,
  MAX_GANTT_DAYS,
} from './gantt.js';

const TASK_PROJECTION_SOURCE = 'project-snapshot-v1';
const TASK_EXTERNAL_ID_PREFIX = 'snapshot:';
const TASK_FIELDS = Object.freeze([
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

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function integer(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(parsed)));
}

function normalizedTaskCatalog(value) {
  return record(value);
}

function taskFingerprint(value) {
  const task = record(value);
  return JSON.stringify(TASK_FIELDS.map((field) => task[field] ?? null));
}

function taskDates(task, projectStartsAt) {
  if (!projectStartsAt) return { startsAt: null, endsAt: null };
  const startDay = ganttTaskStartDay(task);
  const duration = integer(task?.duration, 1, 1, MAX_GANTT_DAYS);
  const startsAt = ganttDateForDay(projectStartsAt, startDay);
  const endsAt = ganttDateForDay(projectStartsAt, startDay + duration - 1);
  return startsAt && endsAt
    ? { startsAt, endsAt }
    : { startsAt: null, endsAt: null };
}

function projectionExternalId(snapshotTaskId) {
  return `${TASK_EXTERNAL_ID_PREFIX}${snapshotTaskId}`;
}

function projectionTaskId(externalId) {
  const normalized = String(externalId || '');
  return normalized.startsWith(TASK_EXTERNAL_ID_PREFIX)
    ? normalized.slice(TASK_EXTERNAL_ID_PREFIX.length)
    : null;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalJson(value[key])]),
    );
  }
  return value ?? null;
}

function jsonFingerprint(value) {
  return JSON.stringify(canonicalJson(value));
}

function dateFingerprint(value) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function projectionRecordMatches(recordValue, expected) {
  const metadata = record(recordValue?.metadata);
  return recordValue?.title === expected.title
    && recordValue?.status === expected.status
    && Number(recordValue?.progress) === expected.progress
    && (recordValue?.assignee || null) === (expected.assignee || null)
    && dateFingerprint(recordValue?.startsAt) === dateFingerprint(expected.startsAt)
    && dateFingerprint(recordValue?.endsAt) === dateFingerprint(expected.endsAt)
    && metadata.source === TASK_PROJECTION_SOURCE
    && jsonFingerprint(metadata.snapshot) === jsonFingerprint(expected.metadata.snapshot);
}

export function projectTaskProjectionStatus(task) {
  const progress = integer(task?.progress, 0, 0, 100);
  if (progress >= 100) return 'DONE';
  if (task?.isDelayed === true) return 'BLOCKED';
  if (progress > 0) return 'IN_PROGRESS';
  return 'READY';
}

export function projectTaskProjectionData(task, {
  projectStartsAt = null,
  stateVersion = null,
  snapshotTaskId = null,
} = {}) {
  const normalized = record(task);
  const progress = integer(normalized.progress, 0, 0, 100);
  return {
    title: String(normalized.name || 'Tarea sin nombre').trim().slice(0, 160)
      || 'Tarea sin nombre',
    status: projectTaskProjectionStatus(normalized),
    progress,
    assignee: normalized.assignee
      ? String(normalized.assignee).trim().slice(0, 160) || null
      : null,
    ...taskDates(normalized, projectStartsAt),
    metadata: {
      schemaVersion: 1,
      source: TASK_PROJECTION_SOURCE,
      projectStateVersion: Number.isSafeInteger(stateVersion) ? stateVersion : null,
      snapshotTaskId: snapshotTaskId ? String(snapshotTaskId) : null,
      snapshot: normalized,
    },
  };
}

export function diffProjectTasks(previousTasks, nextTasks) {
  const previous = normalizedTaskCatalog(previousTasks);
  const next = normalizedTaskCatalog(nextTasks);
  const removed = Object.keys(previous).filter((taskId) => !Object.hasOwn(next, taskId));
  const changed = Object.entries(next).filter(([taskId, task]) => (
    !Object.hasOwn(previous, taskId)
    || taskFingerprint(previous[taskId]) !== taskFingerprint(task)
  ));
  return { changed, removed };
}

export async function synchronizeProjectTaskProjection(transaction, {
  projectId,
  nextTasks,
  projectStartsAt = null,
  stateVersion = null,
}) {
  const normalizedProjectId = String(projectId || '').trim();
  if (!normalizedProjectId) throw new Error('A trusted project is required to project tasks.');
  if (
    typeof transaction?.task?.findMany !== 'function'
    || typeof transaction?.task?.upsert !== 'function'
    || typeof transaction?.task?.deleteMany !== 'function'
  ) {
    throw new Error('Project task projection persistence is unavailable.');
  }

  const normalizedNextTasks = normalizedTaskCatalog(nextTasks);
  const existing = await transaction.task.findMany({
    where: {
      projectId: normalizedProjectId,
      metadata: { path: ['source'], equals: TASK_PROJECTION_SOURCE },
    },
    select: {
      externalId: true,
      title: true,
      status: true,
      progress: true,
      startsAt: true,
      endsAt: true,
      assignee: true,
      metadata: true,
    },
  });
  const existingByTaskId = new Map();
  for (const row of existing) {
    const taskId = projectionTaskId(row.externalId);
    if (taskId) existingByTaskId.set(taskId, row);
  }
  const removed = [...existingByTaskId.keys()].filter(
    (taskId) => !Object.hasOwn(normalizedNextTasks, taskId),
  );
  if (removed.length > 0) {
    await transaction.task.deleteMany({
      where: {
        projectId: normalizedProjectId,
        externalId: { in: removed.map(projectionExternalId) },
        metadata: { path: ['source'], equals: TASK_PROJECTION_SOURCE },
      },
    });
  }
  let changed = 0;
  for (const [taskId, task] of Object.entries(normalizedNextTasks)) {
    const data = projectTaskProjectionData(task, {
      projectStartsAt,
      stateVersion,
      snapshotTaskId: taskId,
    });
    if (projectionRecordMatches(existingByTaskId.get(taskId), data)) continue;
    const externalId = projectionExternalId(taskId);
    await transaction.task.upsert({
      where: {
        projectId_externalId: {
          projectId: normalizedProjectId,
          externalId,
        },
      },
      update: data,
      create: {
        projectId: normalizedProjectId,
        externalId,
        ...data,
      },
    });
    changed += 1;
  }
  return { changed, removed: removed.length };
}

export const PROJECT_TASK_PROJECTION_SOURCE = TASK_PROJECTION_SOURCE;
export { projectionExternalId as projectTaskProjectionExternalId };
export { projectionTaskId as snapshotTaskIdFromProjectionExternalId };
