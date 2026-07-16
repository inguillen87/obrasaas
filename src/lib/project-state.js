const MAX_STATE_NODES = 20_000;
const MAX_STATE_DEPTH = 10;
const MAX_COLLECTION_SIZE = 2_000;
const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export class ProjectStateInputError extends Error {
  constructor(message, { code = 'INVALID_PROJECT_STATE', status = 400 } = {}) {
    super(message);
    this.name = 'ProjectStateInputError';
    this.code = code;
    this.status = status;
  }
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
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
  if (!Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max) {
    throw new ProjectStateInputError(`${path} debe ser un número entre ${min} y ${max}.`);
  }
}

function assertShortString(value, path, { required = false, max = 180 } = {}) {
  if (value == null && !required) return;
  if (typeof value !== 'string' || (required && !value.trim()) || value.length > max) {
    throw new ProjectStateInputError(`${path} no tiene un formato válido.`);
  }
}

function assertKnownCollections(state) {
  if (state.tasks != null) {
    if (!isPlainObject(state.tasks) || Object.keys(state.tasks).length > 500) {
      throw new ProjectStateInputError('tasks debe ser un catálogo de hasta 500 tareas.');
    }
    for (const [taskId, task] of Object.entries(state.tasks)) {
      if (!isPlainObject(task)) {
        throw new ProjectStateInputError(`tasks.${taskId} debe ser un objeto.`);
      }
      assertShortString(task.name, `tasks.${taskId}.name`, { required: true, max: 160 });
      assertShortString(task.assignee, `tasks.${taskId}.assignee`, { max: 160 });
      assertNumber(task.progress, `tasks.${taskId}.progress`, { min: 0, max: 100 });
      assertNumber(task.duration, `tasks.${taskId}.duration`, { min: 1, max: 3_650 });
      assertNumber(task.startOffset, `tasks.${taskId}.startOffset`, { min: 0, max: 100 });
    }
  }

  if (state.incidents != null && (!Array.isArray(state.incidents) || state.incidents.length > 1_000)) {
    throw new ProjectStateInputError('incidents debe ser una lista de hasta 1000 registros.');
  }

  if (state.stockpiles != null) {
    if (!isPlainObject(state.stockpiles) || Object.keys(state.stockpiles).length > 500) {
      throw new ProjectStateInputError('stockpiles debe ser un catálogo de hasta 500 materiales.');
    }
    for (const [materialId, material] of Object.entries(state.stockpiles)) {
      if (!isPlainObject(material)) {
        throw new ProjectStateInputError(`stockpiles.${materialId} debe ser un objeto.`);
      }
      assertShortString(material.name, `stockpiles.${materialId}.name`, { required: true, max: 160 });
      assertShortString(material.unit, `stockpiles.${materialId}.unit`, { max: 40 });
      for (const field of ['current', 'min', 'max']) {
        assertNumber(material[field], `stockpiles.${materialId}.${field}`, { min: 0, max: 1_000_000_000_000 });
      }
    }
  }

  for (const field of ['operariosCount', 'alertsCount']) {
    if (state[field] != null) assertNumber(state[field], field, { min: 0, max: 1_000_000 });
  }
  if (state.avancePercentage != null) {
    assertNumber(state.avancePercentage, 'avancePercentage', { min: 0, max: 100 });
  }
  if (state.diasEstimados != null) {
    assertShortString(state.diasEstimados, 'diasEstimados', { max: 100 });
  }
}

export function validateProjectStateInput(value) {
  if (!isPlainObject(value)) {
    throw new ProjectStateInputError('El estado de la obra debe ser un objeto JSON.');
  }
  assertJsonShape(value, 'state', 0, { count: 0 });
  assertKnownCollections(value);
  return structuredClone(value);
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
