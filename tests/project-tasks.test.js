import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PROJECT_TASK_PROJECTION_SOURCE,
  projectTaskProjectionData,
  projectTaskProjectionExternalId,
  projectTaskProjectionStatus,
  snapshotTaskIdFromProjectionExternalId,
  synchronizeProjectTaskProjection,
} from '../src/lib/project-tasks.js';

function projectedRow(taskId, task, options = {}) {
  return {
    externalId: projectTaskProjectionExternalId(taskId),
    ...projectTaskProjectionData(task, {
      projectStartsAt: options.projectStartsAt ?? null,
      stateVersion: options.stateVersion ?? 1,
      snapshotTaskId: taskId,
    }),
  };
}

function projectionDouble(existing = []) {
  const calls = [];
  const task = {
    async findMany(args) {
      calls.push(['findMany', args]);
      return existing;
    },
    async deleteMany(args) {
      calls.push(['deleteMany', args]);
      return { count: args.where.externalId.in.length };
    },
    async upsert(args) {
      calls.push(['upsert', args]);
      return args.create;
    },
  };
  return { calls, transaction: { task } };
}

test('projection maps snapshot fields, statuses and project-relative dates', () => {
  assert.equal(projectTaskProjectionStatus({ progress: 0 }), 'READY');
  assert.equal(projectTaskProjectionStatus({ progress: 1 }), 'IN_PROGRESS');
  assert.equal(projectTaskProjectionStatus({ progress: 37, isDelayed: true }), 'BLOCKED');
  assert.equal(projectTaskProjectionStatus({ progress: 100, isDelayed: true }), 'DONE');
  assert.equal(projectTaskProjectionStatus({ progress: 140 }), 'DONE');

  const task = {
    name: '  Hormigonado de platea  ',
    assignee: '  Cuadrilla A  ',
    progress: 37.4,
    startDay: 3,
    duration: 4,
    dependencies: ['replanteo'],
    isDelayed: true,
  };
  const data = projectTaskProjectionData(task, {
    projectStartsAt: new Date('2026-07-15T18:45:00.000Z'),
    stateVersion: 12,
    snapshotTaskId: 'platea',
  });

  assert.equal(data.title, 'Hormigonado de platea');
  assert.equal(data.assignee, 'Cuadrilla A');
  assert.equal(data.progress, 37);
  assert.equal(data.status, 'BLOCKED');
  assert.equal(data.startsAt.toISOString(), '2026-07-17T00:00:00.000Z');
  assert.equal(data.endsAt.toISOString(), '2026-07-20T00:00:00.000Z');
  assert.deepEqual(data.metadata, {
    schemaVersion: 1,
    source: PROJECT_TASK_PROJECTION_SOURCE,
    projectStateVersion: 12,
    snapshotTaskId: 'platea',
    snapshot: task,
  });
});

test('projection identity is namespaced and never confuses unrelated external ids', () => {
  assert.equal(projectTaskProjectionExternalId('task-123'), 'snapshot:task-123');
  assert.equal(
    snapshotTaskIdFromProjectionExternalId('snapshot:task-123'),
    'task-123',
  );
  assert.equal(snapshotTaskIdFromProjectionExternalId('task-123'), null);
  assert.equal(snapshotTaskIdFromProjectionExternalId('whatsapp:task-123'), null);
});

test('reconciliation repairs drift, deletes missing projections and remains project scoped', async () => {
  const nextTasks = {
    retained: {
      name: 'Estructura',
      assignee: 'Marta',
      progress: 65,
      startDay: 4,
      duration: 2,
    },
  };
  const drifted = projectedRow('retained', nextTasks.retained, {
    projectStartsAt: '2026-07-01',
    stateVersion: 2,
  });
  drifted.title = 'Nombre obsoleto';
  drifted.progress = 10;
  const removed = projectedRow('removed', { name: 'Tarea eliminada' });
  const unrelatedIdentity = {
    ...projectedRow('ignored', { name: 'Integracion externa' }),
    externalId: 'meta:ignored',
  };
  const { calls, transaction } = projectionDouble([
    drifted,
    removed,
    unrelatedIdentity,
  ]);

  const result = await synchronizeProjectTaskProjection(transaction, {
    projectId: 'project-a',
    nextTasks,
    projectStartsAt: '2026-07-01',
    stateVersion: 9,
  });

  assert.deepEqual(result, { changed: 1, removed: 1 });
  assert.deepEqual(calls.map(([name]) => name), ['findMany', 'deleteMany', 'upsert']);
  assert.deepEqual(calls[0][1], {
    where: {
      projectId: 'project-a',
      metadata: { path: ['source'], equals: PROJECT_TASK_PROJECTION_SOURCE },
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
  assert.deepEqual(calls[1][1].where, {
    projectId: 'project-a',
    externalId: { in: ['snapshot:removed'] },
    metadata: { path: ['source'], equals: PROJECT_TASK_PROJECTION_SOURCE },
  });
  assert.deepEqual(calls[2][1].where, {
    projectId_externalId: {
      projectId: 'project-a',
      externalId: 'snapshot:retained',
    },
  });
  assert.equal(calls[2][1].create.projectId, 'project-a');
  assert.equal(calls[2][1].create.externalId, 'snapshot:retained');
  assert.equal(calls[2][1].update.title, 'Estructura');
  assert.equal(calls[2][1].update.metadata.projectStateVersion, 9);
});

test('empty snapshots remove every projected task without touching other task sources', async () => {
  const { calls, transaction } = projectionDouble([
    projectedRow('one', { name: 'Uno' }),
    projectedRow('two', { name: 'Dos' }),
  ]);

  const result = await synchronizeProjectTaskProjection(transaction, {
    projectId: 'project-empty',
    nextTasks: {},
    stateVersion: 3,
  });

  assert.deepEqual(result, { changed: 0, removed: 2 });
  assert.deepEqual(calls.map(([name]) => name), ['findMany', 'deleteMany']);
  assert.deepEqual(calls[1][1].where.externalId.in, ['snapshot:one', 'snapshot:two']);
  assert.equal(calls[1][1].where.projectId, 'project-empty');
  assert.deepEqual(calls[1][1].where.metadata, {
    path: ['source'],
    equals: PROJECT_TASK_PROJECTION_SOURCE,
  });
});

test('duplicate display names keep independent snapshot identities', async () => {
  const { calls, transaction } = projectionDouble();

  const result = await synchronizeProjectTaskProjection(transaction, {
    projectId: 'project-duplicates',
    nextTasks: {
      'task-a': { name: 'Inspeccion', progress: 0 },
      'task-b': { name: 'Inspeccion', progress: 40 },
    },
    stateVersion: 4,
  });

  assert.deepEqual(result, { changed: 2, removed: 0 });
  const upserts = calls.filter(([name]) => name === 'upsert').map(([, args]) => args);
  assert.equal(upserts.length, 2);
  assert.deepEqual(
    upserts.map((args) => args.where.projectId_externalId.externalId),
    ['snapshot:task-a', 'snapshot:task-b'],
  );
  assert.deepEqual(upserts.map((args) => args.create.title), ['Inspeccion', 'Inspeccion']);
  assert.deepEqual(upserts.map((args) => args.create.status), ['READY', 'IN_PROGRESS']);
});

test('an unchanged catalog is a persistence no-op even when the snapshot version advances', async () => {
  const task = {
    name: 'Mamposteria',
    assignee: 'Cuadrilla B',
    progress: 20,
    startDay: 8,
    duration: 5,
  };
  const existing = projectedRow('mamposteria', task, {
    projectStartsAt: '2026-07-01',
    stateVersion: 7,
  });
  existing.metadata.snapshot = {
    duration: 5,
    progress: 20,
    name: 'Mamposteria',
    startDay: 8,
    assignee: 'Cuadrilla B',
  };
  const { calls, transaction } = projectionDouble([existing]);

  const result = await synchronizeProjectTaskProjection(transaction, {
    projectId: 'project-noop',
    nextTasks: { mamposteria: task },
    projectStartsAt: '2026-07-01',
    stateVersion: 8,
  });

  assert.deepEqual(result, { changed: 0, removed: 0 });
  assert.deepEqual(calls.map(([name]) => name), ['findMany']);
});

test('projection refuses to run without a trusted project or complete transaction delegate', async () => {
  await assert.rejects(
    synchronizeProjectTaskProjection({ task: {} }, {
      projectId: '',
      nextTasks: {},
    }),
    /trusted project/i,
  );
  await assert.rejects(
    synchronizeProjectTaskProjection({ task: {} }, {
      projectId: 'project-a',
      nextTasks: {},
    }),
    /persistence is unavailable/i,
  );
});
