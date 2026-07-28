import { MAX_GANTT_DAYS, ganttDateForDay } from './gantt.js';
import { runOperationalProjectMutation } from './project-write-policy.js';

const MAX_TITLE = 160;
const MAX_DESCRIPTION = 4000;
const MAX_CODE = 64;
const MAX_TASKS = 5000;
const DEPENDENCY_TYPES = new Set([
  'FINISH_TO_START',
  'START_TO_START',
  'FINISH_TO_FINISH',
  'START_TO_FINISH',
]);
const CANONICAL_TASK_SOURCE = 'canonical-task-v1';
const SCHEDULE_ANCHOR = 'PROJECT_START';
const SCHEDULE_SCHEMA_VERSION = 1;

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function boundedInteger(value, field, { minimum = 1, maximum = MAX_GANTT_DAYS } = {}) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new CanonicalTaskError(`${field} debe ser un entero entre ${minimum} y ${maximum}.`);
  }
  return parsed;
}

function validAnchoredSchedule(value) {
  const schedule = record(value);
  if (
    schedule.schemaVersion !== SCHEDULE_SCHEMA_VERSION
    || schedule.anchor !== SCHEDULE_ANCHOR
  ) return null;
  const startDay = Number(schedule.startDay);
  const durationDays = Number(schedule.durationDays);
  if (
    !Number.isInteger(startDay)
    || !Number.isInteger(durationDays)
    || startDay < 1
    || startDay > MAX_GANTT_DAYS
    || durationDays < 1
    || durationDays > MAX_GANTT_DAYS
    || startDay + durationDays - 1 > MAX_GANTT_DAYS
  ) return null;
  return {
    schemaVersion: SCHEDULE_SCHEMA_VERSION,
    anchor: SCHEDULE_ANCHOR,
    startDay,
    durationDays,
  };
}

function dateFingerprint(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function canonicalMetadata(existingMetadata, schedule = undefined) {
  const metadata = record(existingMetadata);
  const next = {
    ...metadata,
    schemaVersion: Math.max(1, Number(metadata.schemaVersion) || 1),
    source: CANONICAL_TASK_SOURCE,
  };
  if (schedule === null) {
    delete next.schedule;
  } else if (schedule !== undefined) {
    next.schedule = schedule;
  }
  return next;
}

export function canonicalTaskScheduleFromMetadata(metadata) {
  return validAnchoredSchedule(record(metadata).schedule);
}

export function normalizeCanonicalTaskSchedule(input = {}) {
  if (!Object.hasOwn(input, 'schedule') || input.schedule === undefined) return undefined;
  if (input.schedule === null) return null;
  if (!input.schedule || typeof input.schedule !== 'object' || Array.isArray(input.schedule)) {
    throw new CanonicalTaskError('schedule debe ser un objeto válido.');
  }
  const unknownFields = Object.keys(input.schedule).filter((field) => !['startDay', 'durationDays'].includes(field));
  if (unknownFields.length > 0) {
    throw new CanonicalTaskError(`Campo de schedule no permitido: ${unknownFields[0]}.`);
  }
  const startDay = boundedInteger(input.schedule.startDay, 'schedule.startDay');
  const durationDays = boundedInteger(input.schedule.durationDays, 'schedule.durationDays');
  if (startDay + durationDays - 1 > MAX_GANTT_DAYS) {
    throw new CanonicalTaskError(`schedule supera el horizonte máximo de ${MAX_GANTT_DAYS} días.`);
  }
  return {
    schemaVersion: SCHEDULE_SCHEMA_VERSION,
    anchor: SCHEDULE_ANCHOR,
    startDay,
    durationDays,
  };
}

export class CanonicalTaskError extends Error {
  constructor(message, code = 'CANONICAL_TASK_INVALID', status = 400, details = null) {
    super(message);
    this.name = 'CanonicalTaskError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function text(value, field, max, { required = false } = {}) {
  if (value === null || value === undefined || value === '') {
    if (!required) return null;
    throw new CanonicalTaskError(`${field} es obligatorio.`);
  }
  if (typeof value !== 'string') throw new CanonicalTaskError(`${field} debe ser texto.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > max || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new CanonicalTaskError(`${field} no cumple los límites de formato.`);
  }
  return normalized;
}

function safeDate(value, field) {
  if (value === null || value === undefined || value === '') return null;
  const result = new Date(value);
  if (Number.isNaN(result.getTime())) throw new CanonicalTaskError(`${field} no es una fecha válida.`);
  return result;
}

function safeProgress(value) {
  const result = Number(value ?? 0);
  if (!Number.isInteger(result) || result < 0 || result > 100) {
    throw new CanonicalTaskError('progress debe ser un entero entre 0 y 100.');
  }
  return result;
}

function safeRevision(value, field = 'expectedRevision') {
  const result = Number(value ?? 0);
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new CanonicalTaskError(`${field} debe ser un entero no negativo.`);
  }
  return result;
}

function dependencyIds(value) {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || value.length > 100) {
    throw new CanonicalTaskError('dependencies debe ser una lista de hasta 100 tareas.');
  }
  return [...new Set(value.map((item) => text(item, 'dependencyId', 190, { required: true })))]
    .filter(Boolean);
}

export function normalizeCanonicalTaskInput(input = {}, { partial = false } = {}) {
  const title = input.title === undefined && partial ? undefined : text(input.title, 'title', MAX_TITLE, { required: true });
  const description = input.description === undefined && partial
    ? undefined
    : text(input.description, 'description', MAX_DESCRIPTION);
  const code = input.code === undefined && partial ? undefined : text(input.code, 'code', MAX_CODE);
  const startsAt = input.startsAt === undefined && partial ? undefined : safeDate(input.startsAt, 'startsAt');
  const endsAt = input.endsAt === undefined && partial ? undefined : safeDate(input.endsAt, 'endsAt');
  if (startsAt && endsAt && endsAt < startsAt) {
    throw new CanonicalTaskError('endsAt no puede preceder a startsAt.');
  }
  const type = input.type === undefined && partial ? undefined : String(input.type || 'TASK');
  if (type !== undefined && !['TASK', 'MILESTONE'].includes(type)) {
    throw new CanonicalTaskError('type de tarea inválido.');
  }
  const status = input.status === undefined && partial ? undefined : String(input.status || 'BACKLOG');
  if (status !== undefined && !['BACKLOG', 'READY', 'IN_PROGRESS', 'BLOCKED', 'DONE'].includes(status)) {
    throw new CanonicalTaskError('status de tarea inválido.');
  }
  return {
    ...(title === undefined ? {} : { title }),
    ...(description === undefined ? {} : { description }),
    ...(code === undefined ? {} : { code }),
    ...(startsAt === undefined ? {} : { startsAt }),
    ...(endsAt === undefined ? {} : { endsAt }),
    ...(type === undefined ? {} : { type }),
    ...(status === undefined ? {} : { status }),
    ...(input.progress === undefined && partial ? {} : { progress: safeProgress(input.progress) }),
    ...(input.assignee === undefined && partial ? {} : { assignee: text(input.assignee, 'assignee', 160) }),
    ...(input.parentId === undefined && partial ? {} : { parentId: text(input.parentId, 'parentId', 190) }),
  };
}

export function assertDependencyAcyclic(edges, proposed = null) {
  const graph = new Map();
  for (const edge of Array.isArray(edges) ? edges : []) {
    const from = String(edge.predecessorId);
    const to = String(edge.successorId);
    if (!from || !to || from === to) throw new CanonicalTaskError('Una tarea no puede depender de sí misma.');
    const successors = graph.get(from) || new Set();
    successors.add(to);
    graph.set(from, successors);
  }
  if (proposed) {
    const from = String(proposed.predecessorId);
    const to = String(proposed.successorId);
    if (!from || !to || from === to) throw new CanonicalTaskError('Una tarea no puede depender de sí misma.');
    (graph.get(from) || graph.set(from, new Set()).get(from)).add(to);
  }
  const visiting = new Set();
  const visited = new Set();
  function visit(id, path = []) {
    if (visiting.has(id)) {
      throw new CanonicalTaskError('La dependencia crea un ciclo.', 'CANONICAL_TASK_DEPENDENCY_CYCLE', 409, { path: [...path, id] });
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const child of graph.get(id) || []) visit(child, [...path, id]);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of graph.keys()) visit(id);
  return true;
}

function serializeTask(task) {
  return {
    id: task.id,
    projectId: task.projectId,
    externalId: task.externalId || null,
    code: task.code || null,
    title: task.title,
    description: task.description || null,
    type: task.type,
    status: task.status,
    progress: task.progress,
    startsAt: task.startsAt?.toISOString?.() || null,
    endsAt: task.endsAt?.toISOString?.() || null,
    schedule: canonicalTaskScheduleFromMetadata(task.metadata),
    assignee: task.assignee || null,
    revision: task.revision,
    parentId: task.parentId || null,
    dependencies: (task.successors || []).map((dependency) => ({
      id: dependency.id,
      predecessorId: dependency.predecessorId,
      successorId: dependency.successorId,
      type: dependency.type,
      lagDays: dependency.lagDays,
    })),
    createdAt: task.createdAt?.toISOString?.() || null,
    updatedAt: task.updatedAt?.toISOString?.() || null,
  };
}

function taskInclude() {
  return { successors: true };
}

export async function listCanonicalTasks(prisma, { projectId, cursor = null, limit = 100 } = {}) {
  const safeProjectId = text(projectId, 'projectId', 190, { required: true });
  const take = Math.min(MAX_TASKS, Math.max(1, Math.trunc(Number(limit) || 100)));
  const rows = await prisma.task.findMany({
    where: {
      projectId: safeProjectId,
      metadata: { path: ['source'], equals: 'canonical-task-v1' },
      ...(cursor ? { id: { gt: text(cursor, 'cursor', 190, { required: true }) } } : {}),
    },
    orderBy: { id: 'asc' },
    take: take + 1,
    include: taskInclude(),
  });
  const hasMore = rows.length > take;
  const page = rows.slice(0, take);
  return { tasks: page.map(serializeTask), nextCursor: hasMore ? page.at(-1)?.id || null : null, hasMore };
}

export async function createCanonicalTask(prisma, {
  scope,
  actorId,
  input,
} = {}) {
  const normalized = normalizeCanonicalTaskInput(input);
  const schedule = normalizeCanonicalTaskSchedule(input);
  const requestedDependencies = dependencyIds(input?.dependencies) || [];
  const projectId = text(scope?.projectId, 'projectId', 190, { required: true });
  const organizationId = text(scope?.organizationId, 'organizationId', 190, { required: true });
  const actor = text(actorId, 'actorId', 190, { required: true });
  return runOperationalProjectMutation(prisma, { organizationId, projectId }, async (transaction) => {
    if (normalized.parentId) {
      const parent = await transaction.task.findFirst({ where: { id: normalized.parentId, projectId }, select: { id: true } });
      if (!parent) throw new CanonicalTaskError('La tarea padre no pertenece a esta obra.', 'CANONICAL_TASK_PARENT_SCOPE', 409);
    }
    const created = await transaction.task.create({
      data: {
        projectId,
        ...normalized,
        metadata: canonicalMetadata(null, schedule),
      },
      include: taskInclude(),
    });
    if (requestedDependencies.length > 0) {
      const existingEdges = await transaction.taskDependency.findMany({
        where: { projectId },
        select: { predecessorId: true, successorId: true },
      });
      const dependencyTasks = await transaction.task.findMany({
        where: {
          projectId,
          id: { in: requestedDependencies },
          metadata: { path: ['source'], equals: 'canonical-task-v1' },
        },
        select: { id: true },
      });
      if (dependencyTasks.length !== requestedDependencies.length) {
        throw new CanonicalTaskError('Toda predecesora debe pertenecer a esta obra.', 'CANONICAL_TASK_SCOPE', 409);
      }
      for (const predecessorId of requestedDependencies) {
        assertDependencyAcyclic(existingEdges, { predecessorId, successorId: created.id });
      }
      await transaction.taskDependency.createMany({
        data: requestedDependencies.map((predecessorId) => ({
          projectId,
          predecessorId,
          successorId: created.id,
        })),
      });
    }
    const persisted = requestedDependencies.length > 0
      ? await transaction.task.findFirst({ where: { id: created.id, projectId }, include: taskInclude() })
      : created;
    await transaction.auditLog.create({
      data: {
        organizationId,
        actorId: actor,
        action: 'task.created',
        entityType: 'Task',
        entityId: persisted.id,
        metadata: { projectId, code: persisted.code, title: persisted.title, revision: persisted.revision },
      },
    });
    return serializeTask(persisted);
  });
}

export async function updateCanonicalTask(prisma, {
  scope,
  actorId,
  taskId,
  expectedRevision,
  input,
} = {}) {
  const projectId = text(scope?.projectId, 'projectId', 190, { required: true });
  const organizationId = text(scope?.organizationId, 'organizationId', 190, { required: true });
  const actor = text(actorId, 'actorId', 190, { required: true });
  const id = text(taskId, 'taskId', 190, { required: true });
  const revision = safeRevision(expectedRevision);
  const normalized = normalizeCanonicalTaskInput(input, { partial: true });
  const schedule = normalizeCanonicalTaskSchedule(input);
  const requestedDependencies = dependencyIds(input?.dependencies);
  return runOperationalProjectMutation(prisma, { organizationId, projectId }, async (transaction) => {
    if (normalized.parentId) {
      if (normalized.parentId === id) throw new CanonicalTaskError('Una tarea no puede ser su propio padre.');
      const parent = await transaction.task.findFirst({ where: { id: normalized.parentId, projectId }, select: { id: true } });
      if (!parent) throw new CanonicalTaskError('La tarea padre no pertenece a esta obra.', 'CANONICAL_TASK_PARENT_SCOPE', 409);
    }
    if (requestedDependencies) {
      const dependencyTasks = await transaction.task.findMany({
        where: {
          projectId,
          id: { in: requestedDependencies },
          metadata: { path: ['source'], equals: 'canonical-task-v1' },
        },
        select: { id: true },
      });
      if (dependencyTasks.length !== requestedDependencies.length || requestedDependencies.includes(id)) {
        throw new CanonicalTaskError('Las predecesoras deben pertenecer a la obra y no pueden incluir la tarea actual.', 'CANONICAL_TASK_SCOPE', 409);
      }
      const otherEdges = await transaction.taskDependency.findMany({
        where: { projectId, successorId: { not: id } },
        select: { predecessorId: true, successorId: true },
      });
      for (const predecessorId of requestedDependencies) {
        assertDependencyAcyclic(otherEdges, { predecessorId, successorId: id });
      }
    }
    let metadata;
    if (schedule !== undefined) {
      const current = await transaction.task.findFirst({
        where: { id, projectId, revision, metadata: { path: ['source'], equals: CANONICAL_TASK_SOURCE } },
        select: { metadata: true },
      });
      if (!current) throw new CanonicalTaskError('La tarea cambiÃ³; recargÃ¡ y reintentÃ¡.', 'CANONICAL_TASK_STALE', 409);
      metadata = canonicalMetadata(current.metadata, schedule);
    }
    const updated = await transaction.task.updateMany({
      where: { id, projectId, revision, metadata: { path: ['source'], equals: 'canonical-task-v1' } },
      data: { ...normalized, ...(metadata ? { metadata } : {}), revision: { increment: 1 } },
    });
    if (updated.count !== 1) throw new CanonicalTaskError('La tarea cambió; recargá y reintentá.', 'CANONICAL_TASK_STALE', 409);
    if (requestedDependencies) {
      await transaction.taskDependency.deleteMany({ where: { projectId, successorId: id } });
      if (requestedDependencies.length > 0) {
        await transaction.taskDependency.createMany({
          data: requestedDependencies.map((predecessorId) => ({ projectId, predecessorId, successorId: id })),
        });
      }
    }
    const result = await transaction.task.findFirst({ where: { id, projectId }, include: taskInclude() });
    await transaction.auditLog.create({ data: { organizationId, actorId: actor, action: 'task.updated', entityType: 'Task', entityId: id, metadata: { projectId, revision: revision + 1 } } });
    return serializeTask(result);
  });
}

export async function reprojectCanonicalTaskSchedules(transaction, {
  projectId,
  projectStartsAt = null,
} = {}) {
  const safeProjectId = text(projectId, 'projectId', 190, { required: true });
  if (
    typeof transaction?.task?.findMany !== 'function'
    || typeof transaction?.task?.updateMany !== 'function'
  ) {
    throw new Error('Canonical task schedule persistence is unavailable.');
  }
  const tasks = await transaction.task.findMany({
    where: {
      projectId: safeProjectId,
      metadata: { path: ['source'], equals: CANONICAL_TASK_SOURCE },
    },
    select: {
      id: true,
      revision: true,
      startsAt: true,
      endsAt: true,
      metadata: true,
    },
  });
  let reprojected = 0;
  for (const task of tasks) {
    const schedule = canonicalTaskScheduleFromMetadata(task.metadata);
    if (!schedule) continue;
    const startsAt = projectStartsAt
      ? ganttDateForDay(projectStartsAt, schedule.startDay)
      : null;
    const endsAt = startsAt
      ? ganttDateForDay(projectStartsAt, schedule.startDay + schedule.durationDays - 1)
      : null;
    if (
      dateFingerprint(task.startsAt) === dateFingerprint(startsAt)
      && dateFingerprint(task.endsAt) === dateFingerprint(endsAt)
    ) continue;
    const updated = await transaction.task.updateMany({
      where: {
        id: task.id,
        projectId: safeProjectId,
        revision: task.revision,
        metadata: { path: ['source'], equals: CANONICAL_TASK_SOURCE },
      },
      data: {
        startsAt,
        endsAt,
        revision: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new CanonicalTaskError('La tarea cambiÃ³ durante la replanificaciÃ³n; recargÃ¡ y reintentÃ¡.', 'CANONICAL_TASK_STALE', 409);
    }
    reprojected += 1;
  }
  return reprojected;
}

export async function createCanonicalTaskDependency(prisma, {
  scope,
  actorId,
  predecessorId,
  successorId,
  type = 'FINISH_TO_START',
  lagDays = 0,
} = {}) {
  const projectId = text(scope?.projectId, 'projectId', 190, { required: true });
  const organizationId = text(scope?.organizationId, 'organizationId', 190, { required: true });
  const actor = text(actorId, 'actorId', 190, { required: true });
  const predecessor = text(predecessorId, 'predecessorId', 190, { required: true });
  const successor = text(successorId, 'successorId', 190, { required: true });
  if (!DEPENDENCY_TYPES.has(type)) throw new CanonicalTaskError('Tipo de dependencia inválido.');
  const lag = Number(lagDays);
  if (!Number.isInteger(lag) || lag < -3650 || lag > 3650) throw new CanonicalTaskError('lagDays fuera de rango.');
  return runOperationalProjectMutation(prisma, { organizationId, projectId }, async (transaction) => {
    const tasks = await transaction.task.findMany({ where: { projectId, id: { in: [predecessor, successor] }, metadata: { path: ['source'], equals: 'canonical-task-v1' } }, select: { id: true } });
    if (tasks.length !== 2) throw new CanonicalTaskError('Ambas tareas deben pertenecer a esta obra y ser canónicas.', 'CANONICAL_TASK_SCOPE', 409);
    const edges = await transaction.taskDependency.findMany({ where: { projectId }, select: { predecessorId: true, successorId: true } });
    assertDependencyAcyclic(edges, { predecessorId: predecessor, successorId: successor });
    const dependency = await transaction.taskDependency.create({ data: { projectId, predecessorId: predecessor, successorId: successor, type, lagDays: lag } });
    await transaction.auditLog.create({ data: { organizationId, actorId: actor, action: 'task.dependency.created', entityType: 'TaskDependency', entityId: dependency.id, metadata: { projectId, predecessorId: predecessor, successorId: successor, type, lagDays: lag } } });
    return dependency;
  });
}

export async function deleteCanonicalTask(prisma, {
  scope,
  actorId,
  taskId,
} = {}) {
  const projectId = text(scope?.projectId, 'projectId', 190, { required: true });
  const organizationId = text(scope?.organizationId, 'organizationId', 190, { required: true });
  const actor = text(actorId, 'actorId', 190, { required: true });
  const id = text(taskId, 'taskId', 190, { required: true });
  return runOperationalProjectMutation(prisma, { organizationId, projectId }, async (transaction) => {
    const task = await transaction.task.findFirst({
      where: { id, projectId, metadata: { path: ['source'], equals: 'canonical-task-v1' } },
      select: { id: true, title: true, revision: true },
    });
    if (!task) throw new CanonicalTaskError('La tarea canónica no existe en esta obra.', 'CANONICAL_TASK_NOT_FOUND', 404);
    const children = await transaction.task.count({ where: { projectId, parentId: id } });
    if (children > 0) throw new CanonicalTaskError('No se puede eliminar una tarea con subtareas.', 'CANONICAL_TASK_HAS_CHILDREN', 409);
    await transaction.task.delete({ where: { id } });
    await transaction.auditLog.create({ data: { organizationId, actorId: actor, action: 'task.deleted', entityType: 'Task', entityId: id, metadata: { projectId, title: task.title, revision: task.revision } } });
    return { id, deleted: true };
  });
}

export function canonicalTaskErrorResponse(error) {
  if (!(error instanceof CanonicalTaskError)) return null;
  return Response.json({ error: error.message, code: error.code, ...(error.details ? { details: error.details } : {}) }, { status: error.status });
}

export { serializeTask as serializeCanonicalTask };
