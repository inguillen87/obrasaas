const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TASKS = 5_000;
const MAX_DURATION_DAYS = 3_650;
const MAX_REVISION = 2_147_483_647;

export class ScheduleObservationError extends Error {
  constructor(message, code = 'SCHEDULE_OBSERVATION_INVALID', details = null) {
    super(message);
    this.name = 'ScheduleObservationError';
    this.code = code;
    this.details = details;
  }
}

function fail(message, code = 'SCHEDULE_OBSERVATION_INVALID', details = null) {
  throw new ScheduleObservationError(message, code, details);
}

function dateKey(value, field, { required = false } = {}) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    if (!required) return null;
    fail(`${field} es obligatorio.`);
  }
  if (!ISO_DATE.test(normalized)) fail(`${field} debe usar YYYY-MM-DD.`);
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    fail(`${field} no es una fecha civil válida.`);
  }
  return normalized;
}

function integer(value, field, minimum, maximum) {
  const normalized = typeof value === 'string' && /^\d+$/.test(value.trim())
    ? Number(value.trim())
    : value;
  if (
    !Number.isSafeInteger(normalized)
    || normalized < minimum
    || normalized > maximum
  ) {
    fail(`${field} debe ser un entero entre ${minimum} y ${maximum}.`);
  }
  return normalized;
}

function normalizedTask(task, index) {
  const sourceTaskId = typeof task?.id === 'string' ? task.id.trim() : '';
  if (!sourceTaskId || /[\u0000-\u001f\u007f]/.test(sourceTaskId) || sourceTaskId.length > 190) {
    fail('La tarea no tiene un identificador válido.', 'SCHEDULE_OBSERVATION_TASK_INVALID', { index });
  }
  const type = task.type === 'MILESTONE' ? 'MILESTONE' : task.type === 'TASK' ? 'TASK' : null;
  if (!type) fail('La tarea tiene un tipo no admitido.', 'SCHEDULE_OBSERVATION_TASK_INVALID', { sourceTaskId });
  return {
    sourceTaskId,
    title: typeof task.title === 'string' && task.title.trim() ? task.title.trim() : sourceTaskId,
    type,
    expectedTaskRevision: integer(task.revision, 'revision', 0, MAX_REVISION),
    progressPercent: integer(task.progress, 'progress', 0, 100),
  };
}

function normalizedTasks(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0 || tasks.length > MAX_TASKS) {
    fail('El cronograma debe contener entre 1 y 5000 tareas canónicas.', 'SCHEDULE_OBSERVATION_TASKS_REQUIRED');
  }
  const rows = tasks.map(normalizedTask)
    .sort((left, right) => left.sourceTaskId.localeCompare(right.sourceTaskId));
  const ids = new Set();
  for (const task of rows) {
    if (ids.has(task.sourceTaskId)) {
      fail('El cronograma contiene tareas duplicadas.', 'SCHEDULE_OBSERVATION_TASK_DUPLICATE', {
        sourceTaskId: task.sourceTaskId,
      });
    }
    ids.add(task.sourceTaskId);
  }
  return rows;
}

export function scheduleObservationRequirements(tasks) {
  return normalizedTasks(tasks)
    .filter((task) => task.progressPercent > 0)
    .map((task) => ({
      sourceTaskId: task.sourceTaskId,
      title: task.title,
      type: task.type,
      progressPercent: task.progressPercent,
      requiresActualStart: true,
      requiresActualFinish: task.progressPercent === 100,
      requiresRemainingDuration: task.progressPercent > 0 && task.progressPercent < 100,
    }));
}

export function buildScheduleObservations(tasks, entries = {}, { asOfDate } = {}) {
  const dataDate = dateKey(asOfDate, 'asOfDate', { required: true });
  const normalizedEntries = entries && typeof entries === 'object' && !Array.isArray(entries)
    ? entries
    : {};
  return normalizedTasks(tasks).map((task) => {
    const entry = normalizedEntries[task.sourceTaskId];
    const values = entry && typeof entry === 'object' && !Array.isArray(entry) ? entry : {};
    if (task.progressPercent === 0) {
      return {
        sourceTaskId: task.sourceTaskId,
        expectedTaskRevision: task.expectedTaskRevision,
        progressPercent: 0,
        progressSource: 'CANONICAL_TASK',
        actualStartDate: null,
        actualFinishDate: null,
        remainingDurationDays: null,
      };
    }

    const actualStartDate = dateKey(values.actualStartDate, `${task.title}: inicio real`, {
      required: true,
    });
    if (actualStartDate > dataDate) {
      fail(`${task.title}: el inicio real no puede ser posterior a la fecha de corte.`, undefined, {
        sourceTaskId: task.sourceTaskId,
      });
    }

    if (task.progressPercent === 100) {
      const actualFinishDate = dateKey(values.actualFinishDate, `${task.title}: fin real`, {
        required: true,
      });
      if (actualFinishDate < actualStartDate || actualFinishDate > dataDate) {
        fail(`${task.title}: el fin real debe estar entre el inicio real y la fecha de corte.`, undefined, {
          sourceTaskId: task.sourceTaskId,
        });
      }
      if (task.type === 'MILESTONE' && actualFinishDate !== actualStartDate) {
        fail(`${task.title}: un hito completado debe iniciar y terminar el mismo día.`, undefined, {
          sourceTaskId: task.sourceTaskId,
        });
      }
      return {
        sourceTaskId: task.sourceTaskId,
        expectedTaskRevision: task.expectedTaskRevision,
        progressPercent: 100,
        progressSource: 'CANONICAL_TASK',
        actualStartDate,
        actualFinishDate,
        remainingDurationDays: 0,
      };
    }

    if (task.type === 'MILESTONE') {
      fail(`${task.title}: un hito no admite avance parcial; debe estar pendiente o completado.`, undefined, {
        sourceTaskId: task.sourceTaskId,
      });
    }
    const remainingDurationDays = integer(
      values.remainingDurationDays,
      `${task.title}: duración restante`,
      1,
      MAX_DURATION_DAYS,
    );
    return {
      sourceTaskId: task.sourceTaskId,
      expectedTaskRevision: task.expectedTaskRevision,
      progressPercent: task.progressPercent,
      progressSource: 'CANONICAL_TASK',
      actualStartDate,
      actualFinishDate: null,
      remainingDurationDays,
    };
  });
}
