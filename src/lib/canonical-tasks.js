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
        metadata: { schemaVersion: 1, source: 'canonical-task-v1' },
      },
      include: taskInclude(),
    });
    await transaction.auditLog.create({
      data: {
        organizationId,
        actorId: actor,
        action: 'task.created',
        entityType: 'Task',
        entityId: created.id,
        metadata: { projectId, code: created.code, title: created.title, revision: created.revision },
      },
    });
    return serializeTask(created);
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
  return runOperationalProjectMutation(prisma, { organizationId, projectId }, async (transaction) => {
    if (normalized.parentId) {
      if (normalized.parentId === id) throw new CanonicalTaskError('Una tarea no puede ser su propio padre.');
      const parent = await transaction.task.findFirst({ where: { id: normalized.parentId, projectId }, select: { id: true } });
      if (!parent) throw new CanonicalTaskError('La tarea padre no pertenece a esta obra.', 'CANONICAL_TASK_PARENT_SCOPE', 409);
    }
    const updated = await transaction.task.updateMany({
      where: { id, projectId, revision, metadata: { path: ['source'], equals: 'canonical-task-v1' } },
      data: { ...normalized, revision: { increment: 1 } },
    });
    if (updated.count !== 1) throw new CanonicalTaskError('La tarea cambió; recargá y reintentá.', 'CANONICAL_TASK_STALE', 409);
    const result = await transaction.task.findFirst({ where: { id, projectId }, include: taskInclude() });
    await transaction.auditLog.create({ data: { organizationId, actorId: actor, action: 'task.updated', entityType: 'Task', entityId: id, metadata: { projectId, revision: revision + 1 } } });
    return serializeTask(result);
  });
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

export function canonicalTaskErrorResponse(error) {
  if (!(error instanceof CanonicalTaskError)) return null;
  return Response.json({ error: error.message, code: error.code, ...(error.details ? { details: error.details } : {}) }, { status: error.status });
}

export { serializeTask as serializeCanonicalTask };
