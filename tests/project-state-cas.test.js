import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      const sourcePath = new URL(`../src/${specifier.slice(2)}.js`, import.meta.url);
      return nextResolve(sourcePath.href, context);
    }
    return nextResolve(specifier, context);
  },
});

const { persistProjectStateTransaction } = await import('../src/lib/db.js');
const { ProjectStateVersionConflictError } = await import('../src/lib/project-state.js');

function durableContext() {
  return {
    organization: { id: 'org-1' },
    project: { id: 'project-1', organizationId: 'org-1' },
  };
}

function transactionDouble(currentSnapshot, projectStatus = 'ACTIVE', {
  projectedTasks = [],
  projectionError = null,
  snapshotError = null,
} = {}) {
  const calls = [];
  const transaction = {
    async $executeRawUnsafe(query, projectId) {
      calls.push(['lock', query, projectId]);
    },
    project: {
      async findFirst(args) {
        calls.push(['project', args]);
        return {
          id: 'project-1',
          organizationId: 'org-1',
          status: projectStatus,
          startsAt: new Date('2026-07-01T00:00:00.000Z'),
        };
      },
    },
    task: {
      async findMany(args) {
        calls.push(['task-read', args]);
        return projectedTasks;
      },
      async deleteMany(args) {
        calls.push(['task-delete', args]);
        return { count: args.where.externalId.in.length };
      },
      async upsert(args) {
        calls.push(['task-write', args]);
        if (projectionError) throw projectionError;
        return args.create;
      },
    },
    projectSnapshot: {
      async findUnique() {
        calls.push(['read']);
        return currentSnapshot;
      },
      async upsert(args) {
        calls.push(['write', args]);
        if (snapshotError) throw snapshotError;
        return {
          state: args.update.state,
          version: args.update.version,
          updatedAt: new Date('2026-07-16T12:00:00.000Z'),
        };
      },
    },
    auditLog: {
      async createMany(args) {
        calls.push(['audit', args]);
      },
    },
  };
  return { calls, transaction };
}

test('state CAS locks, reads, derives activities and increments in one transaction', async () => {
  const before = { tasks: {}, incidents: [] };
  const after = {
    tasks: {
      task: { name: 'Foundation', progress: 0, duration: 3, startOffset: 0 },
    },
    incidents: [],
  };
  const { calls, transaction } = transactionDouble({
    state: before,
    version: 7,
    updatedAt: new Date('2026-07-16T11:00:00.000Z'),
  });
  let derivationInput = null;

  const stored = await persistProjectStateTransaction(transaction, {
    context: durableContext(),
    scope: { databaseUserId: 'user-1' },
    state: after,
    expectedVersion: 7,
    deriveActivities(current, next) {
      derivationInput = { current, next };
      return [{
        action: 'project.task.created',
        category: 'TASK',
        title: 'Task created',
        description: 'Created from the locked state.',
      }];
    },
  });

  assert.deepEqual(calls.map(([name]) => name), [
    'lock',
    'project',
    'read',
    'task-read',
    'task-write',
    'write',
    'audit',
  ]);
  assert.match(calls[0][1], /pg_advisory_xact_lock/);
  assert.equal(calls[0][2], 'project-1');
  assert.deepEqual(derivationInput, { current: before, next: after });
  assert.equal(calls[3][1].where.projectId, 'project-1');
  assert.deepEqual(calls[4][1].where.projectId_externalId, {
    projectId: 'project-1',
    externalId: 'snapshot:task',
  });
  assert.equal(calls[4][1].create.projectId, 'project-1');
  assert.equal(calls[4][1].create.metadata.projectStateVersion, 8);
  assert.equal(calls[5][1].update.version, 8);
  assert.equal(calls[5][1].create.version, 8);
  assert.equal(calls[6][1].data[0].actorId, 'user-1');
  assert.equal(stored.version, 8);
  assert.deepEqual(stored.state, after);
});

test('state CAS rejects a stale writer before writing or auditing', async () => {
  const { calls, transaction } = transactionDouble({
    state: { tasks: {} },
    version: 5,
    updatedAt: new Date(),
  });

  await assert.rejects(
    persistProjectStateTransaction(transaction, {
      context: durableContext(),
      scope: {},
      state: { tasks: { stale: {} } },
      expectedVersion: 4,
      deriveActivities() {
        throw new Error('must not derive from a stale write');
      },
    }),
    (error) => (
      error instanceof ProjectStateVersionConflictError
      && error.code === 'STATE_VERSION_CONFLICT'
      && error.expectedVersion === 4
      && error.currentVersion === 5
    ),
  );

  assert.deepEqual(calls.map(([name]) => name), ['lock', 'project', 'read']);
});

test('state CAS removes projected tasks before storing an empty task catalog', async () => {
  const projectedTasks = [{
    externalId: 'snapshot:removed',
    title: 'Tarea eliminada',
    status: 'READY',
    progress: 0,
    startsAt: null,
    endsAt: null,
    assignee: null,
    metadata: {
      source: 'project-snapshot-v1',
      snapshotTaskId: 'removed',
      snapshot: { name: 'Tarea eliminada' },
    },
  }];
  const { calls, transaction } = transactionDouble({
    state: { tasks: { removed: { name: 'Tarea eliminada' } } },
    version: 2,
    updatedAt: new Date(),
  }, 'ACTIVE', { projectedTasks });

  await persistProjectStateTransaction(transaction, {
    context: durableContext(),
    scope: {},
    state: { tasks: {} },
    expectedVersion: 2,
  });

  assert.deepEqual(calls.map(([name]) => name), [
    'lock',
    'project',
    'read',
    'task-read',
    'task-delete',
    'write',
  ]);
  assert.deepEqual(calls[4][1].where, {
    projectId: 'project-1',
    externalId: { in: ['snapshot:removed'] },
    metadata: { path: ['source'], equals: 'project-snapshot-v1' },
  });
});

test('a projection failure aborts before the snapshot and audit writes', async () => {
  const projectionError = new Error('task projection unavailable');
  const { calls, transaction } = transactionDouble({
    state: { tasks: {} },
    version: 3,
    updatedAt: new Date(),
  }, 'ACTIVE', { projectionError });

  await assert.rejects(
    persistProjectStateTransaction(transaction, {
      context: durableContext(),
      scope: { databaseUserId: 'user-1' },
      state: { tasks: { unsafe: { name: 'No debe persistirse' } } },
      expectedVersion: 3,
      activities: [{
        action: 'project.task.created',
        category: 'TASK',
        title: 'Task created',
        description: 'Must roll back with the projection.',
      }],
    }),
    projectionError,
  );

  assert.deepEqual(calls.map(([name]) => name), [
    'lock',
    'project',
    'read',
    'task-read',
    'task-write',
  ]);
  assert.equal(calls.some(([name]) => name === 'write'), false);
  assert.equal(calls.some(([name]) => name === 'audit'), false);
});

test('a snapshot failure occurs after projection and before audit in the same transaction', async () => {
  const snapshotError = new Error('snapshot persistence unavailable');
  const { calls, transaction } = transactionDouble({
    state: { tasks: {} },
    version: 6,
    updatedAt: new Date(),
  }, 'ACTIVE', { snapshotError });

  await assert.rejects(
    persistProjectStateTransaction(transaction, {
      context: durableContext(),
      scope: { databaseUserId: 'user-1' },
      state: { tasks: { projected: { name: 'Debe revertirse' } } },
      expectedVersion: 6,
      activities: [{
        action: 'project.task.created',
        category: 'TASK',
        title: 'Task created',
        description: 'Must not audit a failed snapshot.',
      }],
    }),
    snapshotError,
  );

  assert.deepEqual(calls.map(([name]) => name), [
    'lock',
    'project',
    'read',
    'task-read',
    'task-write',
    'write',
  ]);
  assert.equal(calls.some(([name]) => name === 'audit'), false);
});

for (const status of ['COMPLETED', 'ARCHIVED']) {
  test(`state writes reject a ${status.toLowerCase()} project under the project lock`, async () => {
    const { calls, transaction } = transactionDouble({
      state: { tasks: {} },
      version: 5,
      updatedAt: new Date(),
    }, status);

    await assert.rejects(
      persistProjectStateTransaction(transaction, {
        context: durableContext(),
        scope: {},
        state: { tasks: { unsafe: {} } },
        expectedVersion: 5,
      }),
      (error) => (
        error.code === 'PROJECT_READ_ONLY'
        && error.status === 409
        && error.projectStatus === status
      ),
    );
    assert.deepEqual(calls.map(([name]) => name), ['lock', 'project']);
  });
}
