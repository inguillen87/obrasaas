import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertProjectStateVersion,
  deriveProjectStateActivities,
  flagStockRisks,
  formatProjectStateEtag,
  parseProjectStateVersion,
  parseProjectStateWriteRequest,
  ProjectStateInputError,
  ProjectStateVersionConflictError,
  validateProjectStateInput,
} from '../src/lib/project-state.js';

function state(overrides = {}) {
  return {
    operariosCount: 2,
    avancePercentage: 20,
    alertsCount: 0,
    diasEstimados: 'Día 2/10',
    tasks: {
      1: {
        name: 'Fundaciones',
        progress: 20,
        duration: 5,
        startOffset: 0,
        assignee: 'Ana Pérez',
      },
    },
    incidents: [],
    stockpiles: {
      cemento: {
        name: 'Cemento',
        current: 50,
        min: 20,
        max: 200,
        unit: 'bolsas',
      },
    },
    hrBonuses: [],
    ...overrides,
  };
}

test('project state validation accepts a bounded operational snapshot and clones it', () => {
  const input = state();
  const validated = validateProjectStateInput(input);
  assert.deepEqual(validated, input);
  assert.notEqual(validated, input);
});

test('project state write parsing accepts matching body and If-Match versions', () => {
  const input = state();
  assert.deepEqual(
    parseProjectStateWriteRequest(
      { state: input, expectedVersion: 7 },
      formatProjectStateEtag(7),
    ),
    { state: input, expectedVersion: 7 },
  );
  assert.equal(parseProjectStateVersion('"project-state-12"'), 12);
});

test('project state writes require a version and reject inconsistent preconditions', () => {
  assert.throws(
    () => parseProjectStateWriteRequest(state()),
    (error) => (
      error instanceof ProjectStateInputError
      && error.status === 428
      && error.code === 'STATE_VERSION_REQUIRED'
    ),
  );
  assert.throws(
    () => parseProjectStateWriteRequest(
      { state: state(), expectedVersion: 3 },
      formatProjectStateEtag(4),
    ),
    /misma versi/,
  );
});

test('project state version assertion exposes a machine-readable conflict', () => {
  assert.equal(assertProjectStateVersion(4, 4), 4);
  assert.throws(
    () => assertProjectStateVersion(4, 5),
    (error) => (
      error instanceof ProjectStateVersionConflictError
      && error.status === 409
      && error.code === 'STATE_VERSION_CONFLICT'
      && error.expectedVersion === 4
      && error.currentVersion === 5
    ),
  );
});

test('project state validation rejects invalid task progress and dangerous object shapes', () => {
  assert.throws(
    () => validateProjectStateInput(state({
      tasks: {
        1: { name: 'Fundaciones', progress: 140, duration: 5, startOffset: 0 },
      },
    })),
    ProjectStateInputError,
  );

  const polluted = JSON.parse('{"tasks":{},"__proto__":{"admin":true}}');
  assert.throws(() => validateProjectStateInput(polluted), /no está permitida/);
});

test('project state validation rejects oversized collections', () => {
  assert.throws(
    () => validateProjectStateInput(state({ incidents: Array.from({ length: 1_001 }, (_, id) => ({ id })) })),
    /hasta 1000 registros/,
  );
});

test('activity derivation captures task, incident, material and people changes', () => {
  const before = state();
  const after = state({
    tasks: {
      1: {
        ...before.tasks[1],
        progress: 55,
        assignee: 'Luis Martínez',
      },
      2: {
        name: 'Mampostería',
        progress: 0,
        duration: 4,
        startOffset: 30,
        assignee: 'Equipo B',
      },
    },
    incidents: [{
      id: 'inc-new',
      title: 'Desvío de seguridad',
      description: 'Falta baranda provisoria.',
      type: 'critical',
    }],
    stockpiles: {
      cemento: { ...before.stockpiles.cemento, current: 90 },
    },
    hrBonuses: [{ assignee: 'Ana Pérez', type: 'Bono de seguridad' }],
  });

  const activities = deriveProjectStateActivities(before, after);
  assert.deepEqual(
    activities.map((entry) => entry.action),
    [
      'project.task.updated',
      'project.task.created',
      'project.incident.created',
      'project.material.received',
      'project.hr.bonus_awarded',
    ],
  );
  assert.equal(activities.find((entry) => entry.category === 'INCIDENT').severity, 'CRITICAL');
  assert.equal(activities.find((entry) => entry.category === 'MATERIAL').metadata.delta, 40);
});

test('activity derivation records removed tasks as warnings', () => {
  const activities = deriveProjectStateActivities(state(), state({ tasks: {} }));
  assert.equal(activities.length, 1);
  assert.equal(activities[0].action, 'project.task.deleted');
  assert.equal(activities[0].severity, 'WARNING');
});

test('stock risk detection avoids duplicate and in-transit alerts', () => {
  const current = state({
    incidents: [{
      id: 'existing-risk',
      title: 'Quiebre de stock crítico',
      description: 'Cemento por debajo del mínimo de seguridad.',
      badge: 'Stock bajo',
    }],
    stockpiles: {
      cemento: {
        name: 'Cemento', current: 10, min: 20, max: 200, unit: 'bolsas', status: 'Crítico',
      },
      arena: {
        name: 'Arena fina', current: 4, min: 8, max: 20, unit: 'm³', status: 'En camino',
      },
    },
  });

  flagStockRisks(current);
  assert.equal(current.incidents.length, 1);
  assert.equal(current.alertsCount, 0);
});

test('stock risk detection adds one traceable alert when no action exists', () => {
  const current = state({ incidents: [], alertsCount: 0 });
  current.stockpiles.cemento.current = 10;
  flagStockRisks(current);
  flagStockRisks(current);

  assert.equal(current.incidents.length, 1);
  assert.equal(current.incidents[0].metadata.stockpileKey, 'cemento');
  assert.equal(current.alertsCount, 1);
});
