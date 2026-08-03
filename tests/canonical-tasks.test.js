import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CanonicalTaskError,
  assertDependencyAcyclic,
  canonicalTaskScheduleFromMetadata,
  deleteCanonicalTask,
  normalizeCanonicalTaskInput,
  normalizeCanonicalTaskSchedule,
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

function canonicalDeletePrisma({ materialRevisionCount = 0 } = {}) {
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
      delete: async () => { state.deleted += 1; },
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
