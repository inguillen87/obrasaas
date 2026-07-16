const DAY_MILLISECONDS = 86_400_000;
const LEGACY_TIMELINE_DAYS = 14;

export const MAX_GANTT_DAYS = 3_650;
export const MAX_TASK_DEPENDENCIES = 20;

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function integer(value, fallback, minimum = 0, maximum = MAX_GANTT_DAYS) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(parsed)));
}

function dateParts(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const time = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(time) ? null : { time, key: `${match[1]}-${match[2]}-${match[3]}` };
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const time = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return { time, key: new Date(time).toISOString().slice(0, 10) };
}

export function ganttDateForDay(projectStartsAt, day) {
  const start = dateParts(projectStartsAt);
  if (!start) return null;
  const offset = integer(day, 1, 1) - 1;
  return new Date(start.time + offset * DAY_MILLISECONDS);
}

export function ganttDayForDate(projectStartsAt, value) {
  const start = dateParts(projectStartsAt);
  const date = dateParts(value);
  if (!start || !date) return null;
  return integer((date.time - start.time) / DAY_MILLISECONDS + 1, 1, 1);
}

export function ganttTaskStartDay(task) {
  const candidate = record(task);
  if (Number.isFinite(Number(candidate.startDay))) {
    return integer(candidate.startDay, 1, 1);
  }
  const legacyOffset = Math.min(100, Math.max(0, Number(candidate.startOffset) || 0));
  return integer((legacyOffset / 100) * (LEGACY_TIMELINE_DAYS - 1) + 1, 1, 1);
}

export function ganttTaskDependencies(task, { knownIds = null, taskId = null } = {}) {
  const candidate = record(task);
  const raw = Array.isArray(candidate.dependencies)
    ? candidate.dependencies
    : candidate.predecessorId
      ? [candidate.predecessorId]
      : [];
  const allowed = knownIds ? new Set([...knownIds].map(String)) : null;
  return [...new Set(raw.map((dependency) => (
    typeof dependency === 'string' ? dependency : dependency?.taskId
  )).filter(Boolean).map(String))]
    .filter((dependencyId) => dependencyId !== String(taskId || ''))
    .filter((dependencyId) => !allowed || allowed.has(dependencyId))
    .slice(0, MAX_TASK_DEPENDENCIES);
}

export function dependencyCycle(tasks) {
  const catalog = record(tasks);
  const ids = new Set(Object.keys(catalog));
  const visiting = new Set();
  const visited = new Set();

  function visit(taskId, path) {
    if (visiting.has(taskId)) {
      const cycleStart = path.indexOf(taskId);
      return [...path.slice(Math.max(0, cycleStart)), taskId];
    }
    if (visited.has(taskId)) return null;
    visiting.add(taskId);
    const dependencies = ganttTaskDependencies(catalog[taskId], { knownIds: ids, taskId });
    for (const dependencyId of dependencies) {
      const found = visit(dependencyId, [...path, taskId]);
      if (found) return found;
    }
    visiting.delete(taskId);
    visited.add(taskId);
    return null;
  }

  for (const taskId of ids) {
    const found = visit(taskId, []);
    if (found) return found;
  }
  return null;
}

export function earliestGanttStartDay(tasks, dependencyIds, fallback = 1) {
  const catalog = record(tasks);
  return [...new Set((Array.isArray(dependencyIds) ? dependencyIds : []).map(String))]
    .reduce((earliest, dependencyId) => {
      const dependency = record(catalog[dependencyId]);
      if (!dependency.name) return earliest;
      return Math.max(
        earliest,
        ganttTaskStartDay(dependency) + integer(dependency.duration, 1, 1),
      );
    }, integer(fallback, 1, 1));
}

function projectDurationDays(startsAt, endsAt) {
  const start = dateParts(startsAt);
  const end = dateParts(endsAt);
  if (!start || !end || end.time < start.time) return 0;
  return integer((end.time - start.time) / DAY_MILLISECONDS + 1, 0, 0);
}

function formatDay(value, options) {
  return new Intl.DateTimeFormat('es-AR', { timeZone: 'UTC', ...options }).format(value);
}

function columnLabel({ projectStartsAt, startDay, span, unitDays }) {
  const start = ganttDateForDay(projectStartsAt, startDay);
  if (!start) {
    if (unitDays === 1) return `D${startDay}`;
    return `D${startDay}–${startDay + span - 1}`;
  }
  if (unitDays === 1) {
    return formatDay(start, { weekday: 'narrow', day: 'numeric' });
  }
  if (unitDays >= 28) {
    return formatDay(start, { month: 'short', year: '2-digit' }).replace('.', '');
  }
  const end = ganttDateForDay(projectStartsAt, startDay + span - 1);
  return `${formatDay(start, { day: 'numeric', month: 'short' }).replace('.', '')}–${formatDay(end, { day: 'numeric', month: 'short' }).replace('.', '')}`;
}

function automaticUnitDays(totalDays) {
  if (totalDays <= 45) return 1;
  if (totalDays <= 420) return 7;
  return 30;
}

export function buildGanttModel(tasks, {
  projectStartsAt = null,
  projectEndsAt = null,
  minimumDays = LEGACY_TIMELINE_DAYS,
  unitDays = null,
} = {}) {
  const catalog = record(tasks);
  const knownIds = new Set(Object.keys(catalog));
  const normalized = Object.entries(catalog).map(([id, rawTask], order) => {
    const task = record(rawTask);
    const startDay = ganttTaskStartDay(task);
    const duration = integer(task.duration, 1, 1);
    const progress = integer(task.progress, 0, 0, 100);
    return {
      ...task,
      id,
      order,
      name: String(task.name || 'Tarea sin nombre').trim() || 'Tarea sin nombre',
      assignee: String(task.assignee || 'Sin asignar').trim() || 'Sin asignar',
      startDay,
      duration,
      endDay: Math.min(MAX_GANTT_DAYS, startDay + duration - 1),
      progress,
      dependencies: ganttTaskDependencies(task, { knownIds, taskId: id }),
    };
  });
  const taskById = new Map(normalized.map((task) => [task.id, task]));
  const tasksWithRisk = normalized.map((task) => {
    const dependencyTasks = task.dependencies.map((id) => taskById.get(id)).filter(Boolean);
    const earliestStartDay = dependencyTasks.reduce(
      (earliest, dependency) => Math.max(earliest, dependency.endDay + 1),
      1,
    );
    const dependencyConflict = dependencyTasks.length > 0 && task.startDay < earliestStartDay;
    const delayed = Boolean(task.isDelayed) || dependencyConflict;
    const shifted = Boolean(task.isShifted);
    const complete = task.progress >= 100;
    return {
      ...task,
      dependencyTasks,
      dependencyNames: dependencyTasks.map((dependency) => dependency.name),
      earliestStartDay,
      dependencyConflict,
      delayed,
      shifted,
      status: complete
        ? 'Finalizada'
        : dependencyConflict
          ? 'Conflicto de secuencia'
          : delayed
            ? 'Demorada'
            : shifted
              ? 'Reprogramada'
            : task.progress > 0
              ? 'En curso'
              : 'Planificada',
      tone: complete ? 'success' : delayed ? 'danger' : shifted || task.progress > 0 ? 'warning' : 'neutral',
    };
  });
  const latestTaskDay = tasksWithRisk.reduce((latest, task) => Math.max(latest, task.endDay), 0);
  const plannedDays = projectDurationDays(projectStartsAt, projectEndsAt);
  const requestedDays = Math.max(integer(minimumDays, LEGACY_TIMELINE_DAYS, 1), plannedDays, latestTaskDay);
  const totalDays = Math.min(MAX_GANTT_DAYS, Math.max(7, Math.ceil(requestedDays / 7) * 7));
  const resolvedUnitDays = [1, 7, 30].includes(Number(unitDays))
    ? Number(unitDays)
    : automaticUnitDays(totalDays);
  const columns = Array.from({ length: Math.ceil(totalDays / resolvedUnitDays) }, (_, index) => {
    const startDay = index * resolvedUnitDays + 1;
    const span = Math.min(resolvedUnitDays, totalDays - startDay + 1);
    return {
      id: `${startDay}-${span}`,
      startDay,
      span,
      label: columnLabel({ projectStartsAt, startDay, span, unitDays: resolvedUnitDays }),
    };
  });
  const taskModels = tasksWithRisk
    .map((task) => ({
      ...task,
      leftPercentage: ((task.startDay - 1) / totalDays) * 100,
      widthPercentage: Math.max((1 / totalDays) * 100, (Math.min(task.duration, totalDays) / totalDays) * 100),
      startDate: ganttDateForDay(projectStartsAt, task.startDay),
      endDate: ganttDateForDay(projectStartsAt, task.endDay),
    }))
    .sort((left, right) => left.startDay - right.startDay || left.order - right.order);
  const dependencyEdges = taskModels.flatMap((task) => (
    task.dependencies.map((fromId) => ({ fromId, toId: task.id }))
  ));

  return {
    tasks: taskModels,
    taskById: new Map(taskModels.map((task) => [task.id, task])),
    dependencyEdges,
    dependencyCount: dependencyEdges.length,
    dependencyConflicts: taskModels.filter((task) => task.dependencyConflict).length,
    delayedTasks: taskModels.filter((task) => task.delayed && task.progress < 100).length,
    completeTasks: taskModels.filter((task) => task.progress >= 100).length,
    totalDays,
    plannedDays,
    unitDays: resolvedUnitDays,
    columns,
    startsAt: ganttDateForDay(projectStartsAt, 1),
    endsAt: ganttDateForDay(projectStartsAt, totalDays),
  };
}
