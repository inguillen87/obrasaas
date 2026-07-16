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
  if (!Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max) {
    throw new ProjectStateInputError(`${path} debe ser un número entre ${min} y ${max}.`);
  }
}

function assertInteger(value, path, options = {}) {
  assertNumber(value, path, options);
  if (!Number.isInteger(Number(value))) {
    throw new ProjectStateInputError(`${path} debe ser un número entero.`);
  }
}

function assertShortString(value, path, { required = false, max = 180 } = {}) {
  if (value == null && !required) return;
  if (typeof value !== 'string' || (required && !value.trim()) || value.length > max) {
    throw new ProjectStateInputError(`${path} no tiene un formato válido.`);
  }
}

function assertKnownCollections(state, previousState = null) {
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
      if (task.startOffset != null) {
        assertNumber(task.startOffset, `tasks.${taskId}.startOffset`, { min: 0, max: 100 });
      }
      if (task.startDay != null) {
        assertInteger(task.startDay, `tasks.${taskId}.startDay`, { min: 1, max: MAX_GANTT_DAYS });
      }
      if (task.dependencies != null) {
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
    }
    const cycle = dependencyCycle(state.tasks);
    if (cycle) {
      throw new ProjectStateInputError(`El cronograma contiene una dependencia circular: ${cycle.join(' → ')}.`);
    }
  }

  if (state.incidents != null && (!Array.isArray(state.incidents) || state.incidents.length > 1_000)) {
    throw new ProjectStateInputError('incidents debe ser una lista de hasta 1000 registros.');
  }

  if (state.stockpiles != null) {
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
