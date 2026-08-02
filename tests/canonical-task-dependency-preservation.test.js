import assert from 'node:assert/strict';
import test from 'node:test';

import { updateCanonicalTask } from '../src/lib/canonical-tasks.js';

function fakePrisma({ inputHasDependencies = true } = {}) {
  const calls = { deleted: 0, created: [] };
  const incoming = [{ predecessorId: 'task-a', successorId: 'task-b', type: 'START_TO_START', lagDays: 3 }];
  const transaction = {
    async $executeRawUnsafe() {},
    project: {
      async findFirst() {
        return { id: 'project-a', organizationId: 'organization-a', status: 'ACTIVE' };
      },
    },
    task: {
      async findMany(query) {
        if (query.where?.id?.in) return query.where.id.in.map((id) => ({ id }));
        return [];
      },
      async updateMany() {
        return { count: 1 };
      },
      async findFirst(query) {
        if (query.select?.metadata) return { metadata: { source: 'canonical-task-v1' } };
        return {
          id: 'task-b',
          projectId: 'project-a',
          title: 'Tarea B',
          description: null,
          type: 'TASK',
          status: 'READY',
          progress: 25,
          startsAt: new Date('2026-08-05T00:00:00.000Z'),
          endsAt: new Date('2026-08-07T00:00:00.000Z'),
          assignee: null,
          revision: 1,
          parentId: null,
          metadata: { source: 'canonical-task-v1' },
          predecessors: inputHasDependencies ? incoming : [],
          createdAt: new Date('2026-08-01T00:00:00.000Z'),
          updatedAt: new Date('2026-08-01T00:00:00.000Z'),
        };
      },
    },
    taskDependency: {
      async findMany(query) {
        if (query.where?.successorId === 'task-b') return incoming;
        return [];
      },
      async deleteMany() {
        calls.deleted += 1;
        return { count: 1 };
      },
      async createMany({ data }) {
        calls.created.push(...data);
        return { count: data.length };
      },
    },
    auditLog: { async create() {} },
  };
  return {
    calls,
    prisma: {
      async $transaction(callback) {
        return callback(transaction);
      },
    },
  };
}

test('editing a canonical task without dependencies never deletes incoming edges', async () => {
  const state = fakePrisma();
  const result = await updateCanonicalTask(state.prisma, {
    scope: { organizationId: 'organization-a', projectId: 'project-a' },
    actorId: 'user-a',
    taskId: 'task-b',
    expectedRevision: 0,
    input: { progress: 25 },
  });
  assert.equal(state.calls.deleted, 0);
  assert.deepEqual(result.dependencies, incomingDependency());
});

test('editing the dependency selection preserves type and lag on retained edges', async () => {
  const state = fakePrisma();
  await updateCanonicalTask(state.prisma, {
    scope: { organizationId: 'organization-a', projectId: 'project-a' },
    actorId: 'user-a',
    taskId: 'task-b',
    expectedRevision: 0,
    input: { progress: 25, dependencies: ['task-a'] },
  });
  assert.equal(state.calls.deleted, 1);
  assert.deepEqual(state.calls.created, [{
    projectId: 'project-a',
    predecessorId: 'task-a',
    successorId: 'task-b',
    type: 'START_TO_START',
    lagDays: 3,
  }]);
});

function incomingDependency() {
  return [{
    id: undefined,
    predecessorId: 'task-a',
    successorId: 'task-b',
    type: 'START_TO_START',
    lagDays: 3,
  }];
}
