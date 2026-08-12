import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CanonicalTaskError,
  assertDependencyAcyclic,
  canonicalTaskScheduleFromMetadata,
  createCanonicalTask,
  deleteCanonicalTask,
  normalizeCanonicalTaskInput,
  normalizeCanonicalTaskSchedule,
  updateCanonicalTask,
} from '../src/lib/canonical-tasks.js';

test('canonical task input is bounded and preserves the schedule fields', () => {
  const task = normalizeCanonicalTaskInput({
    title: ' Fundaciones ',
    code: ' 1.2 ',
    type: 'TASK',
    status: 'READY',
    progress: 35,
    startsAt: '2026-08-01T00:00:00.000Z',
    endsAt: '2026-08-04T00:00:00.000Z',
    assignee: 'Cuadrilla A',
  });
  assert.deepEqual(task, {
    title: 'Fundaciones',
    description: null,
    code: '1.2',
    startsAt: new Date('2026-08-01T00:00:00.000Z'),
    endsAt: new Date('2026-08-04T00:00:00.000Z'),
    type: 'TASK',
    status: 'READY',
    progress: 35,
    assignee: 'Cuadrilla A',
    parentId: null,
  });
});

test('partial update does not erase omitted fields and rejects reversed dates', () => {
  assert.deepEqual(normalizeCanonicalTaskInput({ progress: 100 }, { partial: true }), { progress: 100 });
  assert.throws(
    () => normalizeCanonicalTaskInput({ title: 'T', startsAt: '2026-08-03', endsAt: '2026-08-01' }),
    (error) => error instanceof CanonicalTaskError,
  );
});

test('canonical task schedule keeps a bounded relative anchor for later calendar hydration', () => {
  const schedule = normalizeCanonicalTaskSchedule({
    schedule: { startDay: 12, durationDays: 6 },
  });
  assert.deepEqual(schedule, {
    schemaVersion: 1,
    anchor: 'PROJECT_START',
    startDay: 12,
    durationDays: 6,
  });
  assert.deepEqual(canonicalTaskScheduleFromMetadata({ schedule }), schedule);
  assert.equal(canonicalTaskScheduleFromMetadata({
    schedule: { schemaVersion: 1, anchor: 'PROJECT_START', startDay: 0, durationDays: 1 },
  }), null);
  assert.throws(
    () => normalizeCanonicalTaskSchedule({ schedule: { startDay: 1, durationDays: 2, actorId: 'forbidden' } }),
    CanonicalTaskError,
  );
  assert.throws(
    () => normalizeCanonicalTaskSchedule({ schedule: { startDay: 3_650, durationDays: 2 } }),
    CanonicalTaskError,
  );
});

test('dependency graph accepts a DAG and rejects a proposed cycle', () => {
  assert.equal(assertDependencyAcyclic([
    { predecessorId: 'a', successorId: 'b' },
    { predecessorId: 'b', successorId: 'c' },
  ]), true);
  assert.throws(
    () => assertDependencyAcyclic([
      { predecessorId: 'a', successorId: 'b' },
      { predecessorId: 'b', successorId: 'c' },
    ], { predecessorId: 'c', successorId: 'a' }),
    (error) => error instanceof CanonicalTaskError && error.code === 'CANONICAL_TASK_DEPENDENCY_CYCLE',
  );
});

test('dependency graph rejects self links and malformed progress', () => {
  assert.throws(
    () => assertDependencyAcyclic([], { predecessorId: 'a', successorId: 'a' }),
    CanonicalTaskError,
  );
  assert.throws(
    () => normalizeCanonicalTaskInput({ title: 'T', progress: 101 }),
    CanonicalTaskError,
  );
});

test('approved contract task-scope fence is an actionable 409 on create', async () => {
  const databaseError = Object.assign(new Error('constraint failed'), {
    code: 'P2004',
    meta: {
      database_error: 'PROJECT_CONTRACT_TASK_SCOPE_CHANGE_REQUIRES_CHANGE_CONTROL internal detail',
    },
  });
  await assert.rejects(
    createCanonicalTask({
      $transaction: async (operation) => operation({
        $executeRawUnsafe: async () => 1,
        project: {
          findFirst: async () => ({
            id: 'project-a', organizationId: 'organization-a', status: 'ACTIVE',
          }),
        },
        task: { create: async () => { throw databaseError; } },
      }),
    }, {
      scope: { organizationId: 'organization-a', projectId: 'project-a' },
      actorId: 'user-a',
      input: { title: 'Ampliación contractual' },
    }),
    (error) => error instanceof CanonicalTaskError
      && error.code === 'PROJECT_CONTRACT_CHANGE_CONTROL_REQUIRED'
      && error.status === 409
      && !error.message.includes('internal detail'),
  );
});

function canonicalDeletePrisma({
  deleteError = null,
  materialRevisionCount = 0,
  progressMeasurementHead = null,
} = {}) {
  const state = { deleted: 0, audits: 0 };
  const transaction = {
    $executeRawUnsafe: async () => 1,
    project: {
      findFirst: async () => ({
        id: 'project-a',
        organizationId: 'organization-a',
        status: 'ACTIVE',
      }),
    },
    task: {
      findFirst: async () => ({ id: 'task-a', title: 'Fundaciones', revision: 2 }),
      count: async () => 0,
      delete: async () => {
        if (deleteError) throw deleteError;
        state.deleted += 1;
      },
    },
    taskMaterialRequirementRevision: {
      count: async ({ where }) => {
        assert.deepEqual(where, {
          organizationId: 'organization-a',
          projectId: 'project-a',
          taskId: 'task-a',
        });
        return materialRevisionCount;
      },
    },
    taskProgressMeasurementHead: {
      findFirst: async ({ where, select }) => {
        assert.deepEqual(where, {
          organizationId: 'organization-a',
          projectId: 'project-a',
          taskId: 'task-a',
        });
        assert.deepEqual(select, { id: true });
        return progressMeasurementHead;
      },
    },
    auditLog: {
      create: async () => { state.audits += 1; },
    },
  };
  return {
    state,
    prisma: {
      $transaction: async (operation) => operation(transaction),
    },
  };
}

test('canonical task deletion preserves published material history', async () => {
  const protectedStore = canonicalDeletePrisma({ materialRevisionCount: 1 });
  await assert.rejects(
    deleteCanonicalTask(protectedStore.prisma, {
      scope: { organizationId: 'organization-a', projectId: 'project-a' },
      actorId: 'user-a',
      taskId: 'task-a',
    }),
    (error) => error instanceof CanonicalTaskError
      && error.code === 'CANONICAL_TASK_HAS_MATERIAL_REQUIREMENTS'
      && error.status === 409,
  );
  assert.deepEqual(protectedStore.state, { deleted: 0, audits: 0 });

  const emptyStore = canonicalDeletePrisma();
  const result = await deleteCanonicalTask(emptyStore.prisma, {
    scope: { organizationId: 'organization-a', projectId: 'project-a' },
    actorId: 'user-a',
    taskId: 'task-a',
  });
  assert.deepEqual(result, { id: 'task-a', deleted: true });
  assert.deepEqual(emptyStore.state, { deleted: 1, audits: 1 });
});

test('canonical task deletion preserves progress measurement history', async () => {
  const protectedStore = canonicalDeletePrisma({
    progressMeasurementHead: { id: 'measurement-head-a' },
  });
  await assert.rejects(
    deleteCanonicalTask(protectedStore.prisma, {
      scope: { organizationId: 'organization-a', projectId: 'project-a' },
      actorId: 'user-a',
      taskId: 'task-a',
    }),
    (error) => error instanceof CanonicalTaskError
      && error.code === 'CANONICAL_TASK_HAS_PROGRESS_MEASUREMENTS'
      && error.status === 409,
  );
  assert.deepEqual(protectedStore.state, { deleted: 0, audits: 0 });
});

test('a concurrent progress measurement FK blocks canonical task deletion with a safe 409', async () => {
  const databaseError = Object.assign(new Error('Foreign key constraint failed'), {
    code: 'P2003',
    meta: { field_name: 'TPMHead_task_identity_fkey (index)' },
  });
  const store = canonicalDeletePrisma({ deleteError: databaseError });
  await assert.rejects(
    deleteCanonicalTask(store.prisma, {
      scope: { organizationId: 'organization-a', projectId: 'project-a' },
      actorId: 'user-a',
      taskId: 'task-a',
    }),
    (error) => error instanceof CanonicalTaskError
      && error.code === 'CANONICAL_TASK_HAS_PROGRESS_MEASUREMENTS'
      && error.status === 409
      && !error.message.includes('TPMHead'),
  );
  assert.deepEqual(store.state, { deleted: 0, audits: 0 });
});

function canonicalIdentityUpdatePrisma({
  progressMeasurementHead = null,
  updateError = null,
} = {}) {
  const state = { updates: 0, audits: 0, progressPrechecks: 0 };
  const transaction = {
    $executeRawUnsafe: async () => 1,
    project: {
      findFirst: async () => ({
        id: 'project-a',
        organizationId: 'organization-a',
        status: 'ACTIVE',
      }),
    },
    task: {
      findFirst: async ({ select }) => {
        if (select?.metadata && select?.type) {
          return { metadata: { source: 'canonical-task-v1' }, type: 'TASK' };
        }
        return null;
      },
      updateMany: async () => {
        if (updateError) throw updateError;
        state.updates += 1;
        return { count: 1 };
      },
    },
    taskProgressMeasurementHead: {
      findFirst: async ({ where, select }) => {
        state.progressPrechecks += 1;
        assert.deepEqual(where, {
          organizationId: 'organization-a',
          projectId: 'project-a',
          taskId: 'task-a',
        });
        assert.deepEqual(select, { id: true });
        return progressMeasurementHead;
      },
    },
    auditLog: {
      create: async () => { state.audits += 1; },
    },
  };
  return {
    state,
    prisma: {
      $transaction: async (operation) => operation(transaction),
    },
  };
}

test('measured canonical tasks cannot change executable identity', async () => {
  const store = canonicalIdentityUpdatePrisma({
    progressMeasurementHead: { id: 'measurement-head-a' },
  });
  await assert.rejects(
    updateCanonicalTask(store.prisma, {
      scope: { organizationId: 'organization-a', projectId: 'project-a' },
      actorId: 'user-a',
      taskId: 'task-a',
      expectedRevision: 2,
      input: { type: 'MILESTONE' },
    }),
    (error) => error instanceof CanonicalTaskError
      && error.code === 'CANONICAL_TASK_HAS_PROGRESS_MEASUREMENTS'
      && error.status === 409,
  );
  assert.deepEqual(store.state, { updates: 0, audits: 0, progressPrechecks: 1 });
});

test('the structural task identity guard is mapped race-safely to a canonical 409', async () => {
  const databaseError = Object.assign(new Error('constraint failed'), {
    code: 'P2004',
    meta: {
      database_error: 'PROGRESS_MEASUREMENT_TASK_IDENTITY_IMMUTABLE internal structural detail',
    },
  });
  const store = canonicalIdentityUpdatePrisma({ updateError: databaseError });
  await assert.rejects(
    updateCanonicalTask(store.prisma, {
      scope: { organizationId: 'organization-a', projectId: 'project-a' },
      actorId: 'user-a',
      taskId: 'task-a',
      expectedRevision: 2,
      input: { type: 'MILESTONE' },
    }),
    (error) => error instanceof CanonicalTaskError
      && error.code === 'CANONICAL_TASK_HAS_PROGRESS_MEASUREMENTS'
      && error.status === 409
      && !error.message.includes('internal structural detail'),
  );
  assert.deepEqual(store.state, { updates: 0, audits: 0, progressPrechecks: 1 });
});

test('task-scope change-control marker is also mapped on update', async () => {
  const databaseError = Object.assign(new Error('constraint failed'), {
    code: 'P2004',
    meta: {
      database_error: 'PROJECT_CONTRACT_TASK_SCOPE_CHANGE_REQUIRES_CHANGE_CONTROL internal detail',
    },
  });
  const store = canonicalIdentityUpdatePrisma({ updateError: databaseError });
  await assert.rejects(
    updateCanonicalTask(store.prisma, {
      scope: { organizationId: 'organization-a', projectId: 'project-a' },
      actorId: 'user-a',
      taskId: 'task-a',
      expectedRevision: 2,
      input: { type: 'TASK' },
    }),
    (error) => error instanceof CanonicalTaskError
      && error.code === 'PROJECT_CONTRACT_CHANGE_CONTROL_REQUIRED'
      && error.status === 409
      && !error.message.includes('internal detail'),
  );
});
