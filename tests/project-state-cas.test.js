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
    project: { id: 'project-1' },
  };
}

function transactionDouble(currentSnapshot) {
  const calls = [];
  const transaction = {
    async $executeRawUnsafe(query, projectId) {
      calls.push(['lock', query, projectId]);
    },
    projectSnapshot: {
      async findUnique() {
        calls.push(['read']);
        return currentSnapshot;
      },
      async upsert(args) {
        calls.push(['write', args]);
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

  assert.deepEqual(calls.map(([name]) => name), ['lock', 'read', 'write', 'audit']);
  assert.match(calls[0][1], /pg_advisory_xact_lock/);
  assert.equal(calls[0][2], 'project-1');
  assert.deepEqual(derivationInput, { current: before, next: after });
  assert.equal(calls[2][1].update.version, 8);
  assert.equal(calls[2][1].create.version, 8);
  assert.equal(calls[3][1].data[0].actorId, 'user-1');
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

  assert.deepEqual(calls.map(([name]) => name), ['lock', 'read']);
});

