import { createHash } from 'node:crypto';

import { parseDateKey, shiftDateKey } from './zoned-time.js';

export const FORECAST_ENGINE_VERSION = 'deterministic-civil-days-v1';
export const FORECAST_CALENDAR = 'CIVIL_CALENDAR_DAYS_V1';

const DAY_MILLISECONDS = 86_400_000;
const MAX_TASKS = 5_000;
const MAX_DEPENDENCIES = 100_000;
const MAX_DURATION_DAYS = 36_500;
const MAX_LAG_DAYS = 3_650;

const TASK_TYPES = new Set(['TASK', 'MILESTONE']);
const RELATIONSHIP_TYPES = new Map([
  ['FS', { code: 'FS', type: 'FINISH_TO_START', predecessorAnchor: 'FINISH', successorAnchor: 'START' }],
  ['FINISH_TO_START', { code: 'FS', type: 'FINISH_TO_START', predecessorAnchor: 'FINISH', successorAnchor: 'START' }],
  ['SS', { code: 'SS', type: 'START_TO_START', predecessorAnchor: 'START', successorAnchor: 'START' }],
  ['START_TO_START', { code: 'SS', type: 'START_TO_START', predecessorAnchor: 'START', successorAnchor: 'START' }],
  ['FF', { code: 'FF', type: 'FINISH_TO_FINISH', predecessorAnchor: 'FINISH', successorAnchor: 'FINISH' }],
  ['FINISH_TO_FINISH', { code: 'FF', type: 'FINISH_TO_FINISH', predecessorAnchor: 'FINISH', successorAnchor: 'FINISH' }],
  ['SF', { code: 'SF', type: 'START_TO_FINISH', predecessorAnchor: 'START', successorAnchor: 'FINISH' }],
  ['START_TO_FINISH', { code: 'SF', type: 'START_TO_FINISH', predecessorAnchor: 'START', successorAnchor: 'FINISH' }],
]);

export class DeterministicForecastError extends Error {
  constructor(message, code = 'FORECAST_INPUT_INVALID', details = null) {
    super(message);
    this.name = 'DeterministicForecastError';
    this.code = code;
    this.details = details;
  }
}

function fail(message, code, details = null) {
  throw new DeterministicForecastError(message, code, details);
}

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function taskId(value, field, details = null) {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value !== value.trim()
    || value.length > 190
    || /[\u0000-\u001f\u007f]/.test(value)
  ) {
    fail(`${field} debe ser un identificador no vacio y normalizado.`, 'FORECAST_TASK_ID_INVALID', details);
  }
  return value;
}

function integer(value, field, { minimum, maximum, required = true } = {}) {
  if (value === null || value === undefined) {
    if (!required) return null;
    fail(`${field} es obligatorio.`, 'FORECAST_TASK_INVALID', { field });
  }
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    fail(`${field} debe ser un entero entre ${minimum} y ${maximum}.`, 'FORECAST_TASK_INVALID', { field });
  }
  return value;
}

function civilDate(value, field, { required = true } = {}) {
  if (value === null || value === undefined || value === '') {
    if (!required) return null;
    fail(`${field} es obligatorio.`, 'FORECAST_DATE_INVALID', { field });
  }
  if (typeof value !== 'string') {
    fail(`${field} debe usar exactamente YYYY-MM-DD.`, 'FORECAST_DATE_INVALID', { field });
  }
  try {
    parseDateKey(value);
  } catch {
    fail(`${field} debe ser una fecha civil valida en formato YYYY-MM-DD.`, 'FORECAST_DATE_INVALID', {
      field,
      value,
    });
  }
  return value;
}

function ordinal(dateKey) {
  const { year, month, day } = parseDateKey(dateKey);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return Math.trunc(date.getTime() / DAY_MILLISECONDS);
}

function compareDates(left, right) {
  return ordinal(left) - ordinal(right);
}

function daysBetween(left, right) {
  return ordinal(right) - ordinal(left);
}

function compareText(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function shiftCivilDate(dateKey, days, details) {
  try {
    return shiftDateKey(dateKey, days);
  } catch {
    fail('El calculo desplaza una fecha fuera del rango civil soportado.', 'FORECAST_DATE_OUT_OF_RANGE', details);
  }
}

function inclusiveDuration(startDate, finishDate, type) {
  return type === 'MILESTONE' ? 0 : daysBetween(startDate, finishDate) + 1;
}

function validateTask(rawTask, index, asOfDate) {
  const task = record(rawTask);
  if (!task) {
    fail('Cada tarea debe ser un objeto.', 'FORECAST_TASK_INVALID', { index });
  }

  const id = taskId(task.id, 'task.id', { index });
  const type = String(task.type || 'TASK');
  if (!TASK_TYPES.has(type)) {
    fail('task.type debe ser TASK o MILESTONE.', 'FORECAST_TASK_INVALID', { index, taskId: id, field: 'type' });
  }
  const progress = integer(task.progress ?? 0, 'task.progress', { minimum: 0, maximum: 100 });
  const baselineStartDate = civilDate(task.baselineStartDate, 'task.baselineStartDate');
  const baselineFinishDate = civilDate(task.baselineFinishDate, 'task.baselineFinishDate');
  if (compareDates(baselineFinishDate, baselineStartDate) < 0) {
    fail('La fecha final de baseline no puede preceder a su inicio.', 'FORECAST_TASK_INVALID', {
      index,
      taskId: id,
      field: 'baselineFinishDate',
    });
  }
  if (type === 'MILESTONE' && baselineStartDate !== baselineFinishDate) {
    fail('Un hito debe tener la misma fecha civil de inicio y fin.', 'FORECAST_TASK_INVALID', {
      index,
      taskId: id,
      field: 'baselineFinishDate',
    });
  }

  const actualStartDate = civilDate(task.actualStartDate, 'task.actualStartDate', { required: false });
  const actualFinishDate = civilDate(task.actualFinishDate, 'task.actualFinishDate', { required: false });
  const remainingDurationDays = integer(task.remainingDurationDays, 'task.remainingDurationDays', {
    minimum: 0,
    maximum: MAX_DURATION_DAYS,
    required: false,
  });
  const baselineDurationDays = inclusiveDuration(baselineStartDate, baselineFinishDate, type);
  if (baselineDurationDays > MAX_DURATION_DAYS) {
    fail(`La duracion de baseline no puede superar ${MAX_DURATION_DAYS} dias.`, 'FORECAST_TASK_INVALID', {
      index,
      taskId: id,
      field: 'baselineFinishDate',
    });
  }

  if (progress === 0) {
    if (actualStartDate || actualFinishDate) {
      fail('Una tarea con avance 0 no puede declarar fechas reales.', 'FORECAST_TASK_STATE_INVALID', {
        index,
        taskId: id,
      });
    }
    if (remainingDurationDays !== null) {
      fail('Una tarea no iniciada usa siempre la duracion de baseline y no admite remainingDurationDays.', 'FORECAST_REMAINING_DURATION_UNEXPECTED', {
        index,
        taskId: id,
      });
    }
  } else if (progress < 100) {
    if (type === 'MILESTONE') {
      fail('Un hito no admite avance parcial.', 'FORECAST_TASK_STATE_INVALID', { index, taskId: id });
    }
    if (!actualStartDate || actualFinishDate) {
      fail('Una tarea parcialmente ejecutada exige inicio real y no admite fin real.', 'FORECAST_TASK_STATE_INVALID', {
        index,
        taskId: id,
      });
    }
    if (remainingDurationDays === null || remainingDurationDays < 1) {
      fail('Una tarea con avance entre 1 y 99 exige remainingDurationDays explicito y positivo.', 'FORECAST_REMAINING_DURATION_REQUIRED', {
        index,
        taskId: id,
      });
    }
    if (compareDates(actualStartDate, asOfDate) > 0) {
      fail('El inicio real no puede ser posterior a la fecha de corte.', 'FORECAST_TASK_STATE_INVALID', {
        index,
        taskId: id,
      });
    }
  } else {
    if (!actualStartDate || !actualFinishDate) {
      fail('Una tarea finalizada exige inicio y fin reales.', 'FORECAST_TASK_STATE_INVALID', {
        index,
        taskId: id,
      });
    }
    if (compareDates(actualFinishDate, actualStartDate) < 0 || compareDates(actualFinishDate, asOfDate) > 0) {
      fail('Las fechas reales finalizadas son inconsistentes con la fecha de corte.', 'FORECAST_TASK_STATE_INVALID', {
        index,
        taskId: id,
      });
    }
    if (type === 'MILESTONE' && actualStartDate !== actualFinishDate) {
      fail('Un hito finalizado debe ocurrir en una sola fecha civil.', 'FORECAST_TASK_STATE_INVALID', {
        index,
        taskId: id,
      });
    }
    if (remainingDurationDays !== null && remainingDurationDays !== 0) {
      fail('Una tarea finalizada debe tener duracion restante cero.', 'FORECAST_REMAINING_DURATION_INVALID', {
        index,
        taskId: id,
      });
    }
  }

  const scheduledDurationDays = type === 'MILESTONE'
    ? 0
    : progress === 0
      ? baselineDurationDays
      : remainingDurationDays ?? baselineDurationDays;

  return {
    id,
    type,
    progress,
    baselineStartDate,
    baselineFinishDate,
    baselineDurationDays,
    actualStartDate,
    actualFinishDate,
    remainingDurationDays,
    scheduledDurationDays,
  };
}

function relationshipSortKey(relationship) {
  return [
    relationship.predecessorId,
    relationship.successorId,
    relationship.type,
    String(relationship.lagDays).padStart(6, '0'),
  ].join('\u0000');
}

function validateRelationship(rawRelationship, index, knownTaskIds) {
  const relationship = record(rawRelationship);
  if (!relationship) {
    fail('Cada dependencia debe ser un objeto.', 'FORECAST_DEPENDENCY_INVALID', { index });
  }
  const predecessorId = taskId(relationship.predecessorId, 'dependency.predecessorId', { index });
  const successorId = taskId(relationship.successorId, 'dependency.successorId', { index });
  if (!knownTaskIds.has(predecessorId) || !knownTaskIds.has(successorId)) {
    fail('Toda dependencia debe referenciar tareas incluidas en el calculo.', 'FORECAST_DEPENDENCY_UNKNOWN_TASK', {
      index,
      predecessorId,
      successorId,
    });
  }
  if (predecessorId === successorId) {
    fail('Una tarea no puede depender de si misma.', 'FORECAST_DEPENDENCY_SELF_REFERENCE', {
      index,
      taskId: predecessorId,
    });
  }

  const relationshipType = typeof relationship.type === 'string'
    ? RELATIONSHIP_TYPES.get(relationship.type)
    : null;
  if (!relationshipType) {
    fail('dependency.type debe ser FS, SS, FF, SF o su nombre canonico.', 'FORECAST_DEPENDENCY_TYPE_INVALID', {
      index,
      type: relationship.type ?? null,
    });
  }
  const lagDays = relationship.lagDays ?? 0;
  if (!Number.isSafeInteger(lagDays) || lagDays < -MAX_LAG_DAYS || lagDays > MAX_LAG_DAYS) {
    fail(`dependency.lagDays debe ser un entero entre -${MAX_LAG_DAYS} y ${MAX_LAG_DAYS}.`, 'FORECAST_DEPENDENCY_LAG_INVALID', {
      index,
      lagDays,
    });
  }

  return {
    predecessorId,
    successorId,
    code: relationshipType.code,
    type: relationshipType.type,
    predecessorAnchor: relationshipType.predecessorAnchor,
    successorAnchor: relationshipType.successorAnchor,
    lagDays,
  };
}

function insertSorted(values, value) {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (compareText(values[middle], value) < 0) low = middle + 1;
    else high = middle;
  }
  values.splice(low, 0, value);
}

function stableCyclePath(taskIds, outgoing, remaining) {
  const state = new Map();
  const path = [];
  const pathIndex = new Map();

  for (const rootId of [...taskIds].sort(compareText)) {
    if (!remaining.has(rootId) || state.has(rootId)) continue;
    const frames = [{ id: rootId, relationshipIndex: 0 }];
    state.set(rootId, 1);
    pathIndex.set(rootId, path.length);
    path.push(rootId);

    while (frames.length > 0) {
      const frame = frames.at(-1);
      const relationships = outgoing.get(frame.id) || [];
      let descended = false;
      while (frame.relationshipIndex < relationships.length) {
        const relationship = relationships[frame.relationshipIndex];
        frame.relationshipIndex += 1;
        const child = relationship.successorId;
        if (!remaining.has(child)) continue;
        if (state.get(child) === 1) {
          return [...path.slice(pathIndex.get(child)), child];
        }
        if (state.has(child)) continue;
        state.set(child, 1);
        pathIndex.set(child, path.length);
        path.push(child);
        frames.push({ id: child, relationshipIndex: 0 });
        descended = true;
        break;
      }
      if (descended) continue;

      frames.pop();
      state.set(frame.id, 2);
      pathIndex.delete(frame.id);
      path.pop();
    }
  }
  return [];
}

function stableTopologicalOrder(tasks, relationships) {
  const taskIds = tasks.map((task) => task.id);
  const incomingCount = new Map(taskIds.map((id) => [id, 0]));
  const outgoing = new Map(taskIds.map((id) => [id, []]));
  for (const relationship of relationships) {
    incomingCount.set(relationship.successorId, incomingCount.get(relationship.successorId) + 1);
    outgoing.get(relationship.predecessorId).push(relationship);
  }
  for (const values of outgoing.values()) {
    values.sort((left, right) => compareText(relationshipSortKey(left), relationshipSortKey(right)));
  }

  const ready = taskIds.filter((id) => incomingCount.get(id) === 0)
    .sort(compareText);
  const order = [];
  while (ready.length > 0) {
    const id = ready.shift();
    order.push(id);
    for (const relationship of outgoing.get(id)) {
      const child = relationship.successorId;
      const nextCount = incomingCount.get(child) - 1;
      incomingCount.set(child, nextCount);
      if (nextCount === 0) insertSorted(ready, child);
    }
  }

  if (order.length !== taskIds.length) {
    const remaining = new Set(taskIds.filter((id) => incomingCount.get(id) > 0));
    fail('Las dependencias contienen un ciclo.', 'FORECAST_DEPENDENCY_CYCLE', {
      cycle: stableCyclePath(taskIds, outgoing, remaining),
    });
  }
  return order;
}

function canonicalHash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function inputHash(asOfDate, tasks, relationships) {
  return canonicalHash({
    engineVersion: FORECAST_ENGINE_VERSION,
    calendar: FORECAST_CALENDAR,
    asOfDate,
    tasks: [...tasks]
      .sort((left, right) => compareText(left.id, right.id))
      .map((task) => ({
        id: task.id,
        type: task.type,
        progress: task.progress,
        baselineStartDate: task.baselineStartDate,
        baselineFinishDate: task.baselineFinishDate,
        actualStartDate: task.actualStartDate,
        actualFinishDate: task.actualFinishDate,
        remainingDurationDays: task.remainingDurationDays,
      })),
    dependencies: [...relationships]
      .sort((left, right) => compareText(relationshipSortKey(left), relationshipSortKey(right)))
      .map((relationship) => ({
        predecessorId: relationship.predecessorId,
        successorId: relationship.successorId,
        type: relationship.type,
        lagDays: relationship.lagDays,
      })),
  });
}

function startConstraint(relationship, predecessor, successorDurationDays) {
  const predecessorDate = relationship.predecessorAnchor === 'START'
    ? predecessor.forecast.startDate
    : predecessor.forecast.finishDate;
  const requiredAnchorDate = shiftCivilDate(predecessorDate, relationship.lagDays, {
    predecessorId: relationship.predecessorId,
    successorId: relationship.successorId,
  });
  if (relationship.successorAnchor === 'START') {
    const requiredStartDate = relationship.code === 'FS'
      ? shiftCivilDate(requiredAnchorDate, 1, {
        predecessorId: relationship.predecessorId,
        successorId: relationship.successorId,
      })
      : requiredAnchorDate;
    return { requiredAnchorDate: requiredStartDate, requiredStartDate };
  }
  const successorFinishOffset = Math.max(0, successorDurationDays - 1);
  return {
    requiredAnchorDate,
    requiredStartDate: shiftCivilDate(requiredAnchorDate, -successorFinishOffset, {
      predecessorId: relationship.predecessorId,
      successorId: relationship.successorId,
    }),
  };
}

function selectDriver(candidates) {
  return candidates.reduce((selected, candidate) => {
    if (!selected) return candidate;
    const dateComparison = compareDates(candidate.constraintDate, selected.constraintDate);
    if (dateComparison > 0) return candidate;
    if (dateComparison < 0) return selected;
    if (candidate.priority > selected.priority) return candidate;
    if (candidate.priority < selected.priority) return selected;
    return compareText(candidate.sortKey, selected.sortKey) < 0 ? candidate : selected;
  }, null);
}

function publicDriver(candidate) {
  const { priority: _priority, sortKey: _sortKey, ...driver } = candidate;
  return driver;
}

function relationshipConstraint(relationship, predecessor, task, forecast) {
  const constraint = startConstraint(relationship, predecessor, task.scheduledDurationDays);
  const forecastAnchorDate = relationship.successorAnchor === 'START'
    ? forecast.startDate
    : forecast.finishDate;
  return {
    predecessorId: relationship.predecessorId,
    type: relationship.type,
    code: relationship.code,
    lagDays: relationship.lagDays,
    successorAnchor: relationship.successorAnchor,
    requiredDate: constraint.requiredAnchorDate,
    violated: compareDates(forecastAnchorDate, constraint.requiredAnchorDate) < 0,
  };
}

function calculateTask(task, incoming, calculatedById, asOfDate) {
  if (task.progress === 100) {
    const forecast = {
      startDate: task.actualStartDate,
      finishDate: task.actualFinishDate,
      durationDays: inclusiveDuration(task.actualStartDate, task.actualFinishDate, task.type),
      remainingDurationDays: 0,
    };
    return {
      forecast,
      driver: {
        kind: 'ACTUAL',
        constraintDate: task.actualFinishDate,
      },
      relationshipConstraints: incoming.map((relationship) => relationshipConstraint(
        relationship,
        calculatedById.get(relationship.predecessorId),
        task,
        forecast,
      )),
    };
  }

  if (task.progress > 0) {
    const finishDate = shiftCivilDate(asOfDate, task.remainingDurationDays - 1, { taskId: task.id });
    const forecast = {
      startDate: task.actualStartDate,
      finishDate,
      durationDays: inclusiveDuration(task.actualStartDate, finishDate, task.type),
      remainingDurationDays: task.remainingDurationDays,
    };
    return {
      forecast,
      driver: {
        kind: 'DATA_DATE_AND_REMAINING_DURATION',
        constraintDate: asOfDate,
      },
      relationshipConstraints: incoming.map((relationship) => relationshipConstraint(
        relationship,
        calculatedById.get(relationship.predecessorId),
        task,
        forecast,
      )),
    };
  }

  const candidates = [{
    kind: 'BASELINE',
    constraintDate: task.baselineStartDate,
    priority: 10,
    sortKey: 'baseline',
  }];
  if (compareDates(asOfDate, task.baselineStartDate) > 0) {
    candidates.push({
      kind: 'DATA_DATE',
      constraintDate: asOfDate,
      priority: 20,
      sortKey: 'data-date',
    });
  }

  for (const relationship of incoming) {
    const predecessor = calculatedById.get(relationship.predecessorId);
    const constraint = startConstraint(relationship, predecessor, task.scheduledDurationDays);
    candidates.push({
      kind: 'DEPENDENCY',
      predecessorId: relationship.predecessorId,
      type: relationship.type,
      code: relationship.code,
      lagDays: relationship.lagDays,
      constraintDate: constraint.requiredStartDate,
      priority: 30,
      sortKey: relationshipSortKey(relationship),
    });
  }

  const selected = selectDriver(candidates);
  const startDate = selected.constraintDate;
  const finishDate = task.type === 'MILESTONE'
    ? startDate
    : shiftCivilDate(startDate, task.scheduledDurationDays - 1, { taskId: task.id });
  const forecast = {
    startDate,
    finishDate,
    durationDays: task.scheduledDurationDays,
    remainingDurationDays: task.scheduledDurationDays,
  };
  return {
    forecast,
    driver: publicDriver(selected),
    relationshipConstraints: incoming.map((relationship) => relationshipConstraint(
      relationship,
      calculatedById.get(relationship.predecessorId),
      task,
      forecast,
    )),
  };
}

function projectRange(tasks, field) {
  if (tasks.length === 0) return { startDate: null, finishDate: null };
  return tasks.reduce((range, task) => {
    const dates = task[field];
    return {
      startDate: !range.startDate || compareDates(dates.startDate, range.startDate) < 0
        ? dates.startDate
        : range.startDate,
      finishDate: !range.finishDate || compareDates(dates.finishDate, range.finishDate) > 0
        ? dates.finishDate
        : range.finishDate,
    };
  }, { startDate: null, finishDate: null });
}

export function calculateDeterministicForecast(input = {}) {
  const candidate = record(input);
  if (!candidate) fail('El input del forecast debe ser un objeto.', 'FORECAST_INPUT_INVALID');
  const asOfDate = civilDate(candidate.asOfDate, 'asOfDate');
  if (!Array.isArray(candidate.tasks) || candidate.tasks.length > MAX_TASKS) {
    fail(`tasks debe ser una lista de hasta ${MAX_TASKS} tareas.`, 'FORECAST_INPUT_INVALID', { field: 'tasks' });
  }
  if (!Array.isArray(candidate.dependencies) || candidate.dependencies.length > MAX_DEPENDENCIES) {
    fail(`dependencies debe ser una lista de hasta ${MAX_DEPENDENCIES} relaciones.`, 'FORECAST_INPUT_INVALID', {
      field: 'dependencies',
    });
  }

  const tasks = candidate.tasks.map((task, index) => validateTask(task, index, asOfDate));
  const taskById = new Map();
  for (const task of tasks) {
    if (taskById.has(task.id)) {
      fail('Los identificadores de tarea deben ser unicos.', 'FORECAST_TASK_DUPLICATE', { taskId: task.id });
    }
    taskById.set(task.id, task);
  }

  const knownTaskIds = new Set(taskById.keys());
  const relationships = candidate.dependencies.map((relationship, index) => (
    validateRelationship(relationship, index, knownTaskIds)
  ));
  const pairs = new Set();
  for (const relationship of relationships) {
    const pair = `${relationship.predecessorId}\u0000${relationship.successorId}`;
    if (pairs.has(pair)) {
      fail('No puede haber mas de una relacion entre el mismo par de tareas.', 'FORECAST_DEPENDENCY_DUPLICATE', {
        predecessorId: relationship.predecessorId,
        successorId: relationship.successorId,
      });
    }
    pairs.add(pair);
  }

  const topologicalOrder = stableTopologicalOrder(tasks, relationships);
  const incomingById = new Map(topologicalOrder.map((id) => [id, []]));
  for (const relationship of relationships) incomingById.get(relationship.successorId).push(relationship);
  for (const values of incomingById.values()) {
    values.sort((left, right) => compareText(relationshipSortKey(left), relationshipSortKey(right)));
  }

  const calculatedById = new Map();
  for (const id of topologicalOrder) {
    const task = taskById.get(id);
    const calculation = calculateTask(task, incomingById.get(id), calculatedById, asOfDate);
    calculatedById.set(id, {
      id,
      type: task.type,
      progress: task.progress,
      baseline: {
        startDate: task.baselineStartDate,
        finishDate: task.baselineFinishDate,
        durationDays: task.baselineDurationDays,
      },
      actual: {
        startDate: task.actualStartDate,
        finishDate: task.actualFinishDate,
      },
      forecast: calculation.forecast,
      deltas: {
        startDays: daysBetween(task.baselineStartDate, calculation.forecast.startDate),
        finishDays: daysBetween(task.baselineFinishDate, calculation.forecast.finishDate),
        durationDays: calculation.forecast.durationDays - task.baselineDurationDays,
      },
      driver: calculation.driver,
      relationshipConstraints: calculation.relationshipConstraints,
    });
  }

  const calculatedTasks = topologicalOrder.map((id) => calculatedById.get(id));
  const baseline = projectRange(calculatedTasks, 'baseline');
  const forecast = projectRange(calculatedTasks, 'forecast');
  const coreResult = {
    engineVersion: FORECAST_ENGINE_VERSION,
    calendar: FORECAST_CALENDAR,
    asOfDate,
    inputHash: inputHash(asOfDate, tasks, relationships),
    topologicalOrder,
    project: {
      baseline,
      forecast,
      deltas: {
        startDays: baseline.startDate ? daysBetween(baseline.startDate, forecast.startDate) : 0,
        finishDays: baseline.finishDate ? daysBetween(baseline.finishDate, forecast.finishDate) : 0,
      },
    },
    tasks: calculatedTasks,
  };
  return {
    ...coreResult,
    resultHash: canonicalHash(coreResult),
  };
}
