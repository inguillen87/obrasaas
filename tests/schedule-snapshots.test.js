import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ScheduleSnapshotError,
  calculateScheduleForecast,
  listScheduleBaselines,
  listScheduleForecastRuns,
  publishScheduleBaseline,
} from '../src/lib/schedule-snapshots.js';

const SCOPE = Object.freeze({ organizationId: 'organization-a', projectId: 'project-a' });
const ACTOR_ID = 'user-a';
const BASELINE_INPUT = Object.freeze({
  expectedProjectStateVersion: 7,
  name: 'Contrato aprobado',
  replaceActiveBaseline: false,
  timeZone: 'America/Argentina/Buenos_Aires',
});

function canonicalTask(overrides = {}) {
  return {
    id: 'task-a',
    code: '1.1',
    title: 'Levantar muro',
    description: null,
    type: 'TASK',
    startsAt: new Date('2026-07-28T00:00:00.000Z'),
    endsAt: new Date('2026-07-30T00:00:00.000Z'),
    revision: 2,
    parentId: null,
    ...overrides,
  };
}

function transactionHarness(overrides = {}) {
  const calls = [];
  const transaction = {
    async $executeRawUnsafe(query, projectId) {
      calls.push(['project-lock', query, projectId]);
      return 1;
    },
    project: {
      async findFirst(args) {
        calls.push(['project-policy', args]);
        return { id: SCOPE.projectId, organizationId: SCOPE.organizationId, status: 'ACTIVE' };
      },
    },
    ...overrides,
  };
  const prisma = {
    async $transaction(operation, options) {
      calls.push(['transaction', options]);
      return operation(transaction);
    },
  };
  return { calls, prisma, transaction };
}

function publishHarness({ replay = null, tasks = [canonicalTask()], dependencies = [] } = {}) {
  const captured = { audit: [], roots: [], taskBatches: [], dependencyBatches: [] };
  const harness = transactionHarness({
    projectSnapshot: {
      async findUnique(args) {
        captured.snapshotQuery = args;
        return { version: 7 };
      },
    },
    task: {
      async findMany(args) {
        captured.taskQuery = args;
        return tasks;
      },
    },
    taskDependency: {
      async findMany(args) {
        captured.dependencyQuery = args;
        return dependencies;
      },
    },
    scheduleBaseline: {
      async findFirst(args) {
        captured.baselineQueries ||= [];
        captured.baselineQueries.push(args);
        if (args.where.operationKeyHash) return replay;
        return null;
      },
      async create(args) {
        harness.calls.push(['baseline-root']);
        captured.roots.push(args.data);
        return { ...args.data, createdAt: new Date('2026-07-28T12:00:00.000Z') };
      },
      async updateMany() {
        throw new Error('Unexpected rebaseline update.');
      },
    },
    scheduleBaselineTask: {
      async createMany(args) {
        harness.calls.push(['baseline-tasks']);
        captured.taskBatches.push(args.data);
        return { count: args.data.length };
      },
    },
    scheduleBaselineDependency: {
      async createMany(args) {
        harness.calls.push(['baseline-dependencies']);
        captured.dependencyBatches.push(args.data);
        return { count: args.data.length };
      },
    },
    auditLog: {
      async create(args) {
        captured.audit.push(args.data);
        return args.data;
      },
    },
  });
  return { ...harness, captured };
}

test('baseline publication snapshots canonical work child-first and binds idempotency to payload', async () => {
  const first = publishHarness();
  const created = await publishScheduleBaseline(first.prisma, {
    scope: SCOPE,
    actorId: ACTOR_ID,
    idempotencyKey: 'baseline-publication-0001',
    input: BASELINE_INPUT,
  });

  assert.equal(created.replayed, false);
  assert.equal(created.baseline.version, 1);
  assert.equal(first.captured.taskBatches.length, 1);
  assert.equal(first.captured.taskBatches[0][0].organizationId, SCOPE.organizationId);
  assert.equal(first.captured.taskBatches[0][0].projectId, SCOPE.projectId);
  assert.equal(first.captured.taskBatches[0][0].sourceTaskRevision, 2);
  assert.match(first.captured.roots[0].operationKeyHash, /^[0-9a-f]{64}$/);
  assert.match(first.captured.roots[0].requestFingerprint, /^[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(first.captured.roots[0]).includes('baseline-publication-0001'), false);
  assert.ok(
    first.calls.findIndex(([name]) => name === 'baseline-tasks')
      < first.calls.findIndex(([name]) => name === 'baseline-root'),
    'immutable child rows must be inserted before the sealed root',
  );
  assert.deepEqual(first.captured.taskQuery.where, {
    projectId: SCOPE.projectId,
    metadata: { path: ['source'], equals: 'canonical-task-v1' },
  });
  assert.equal(first.captured.audit[0].action, 'schedule.baseline.published');

  const persisted = {
    ...first.captured.roots[0],
    publishedAt: new Date('2026-07-28T12:00:00.000Z'),
  };
  const replay = publishHarness({ replay: persisted });
  const replayed = await publishScheduleBaseline(replay.prisma, {
    scope: SCOPE,
    actorId: ACTOR_ID,
    idempotencyKey: 'baseline-publication-0001',
    input: BASELINE_INPUT,
  });
  assert.equal(replayed.replayed, true);
  assert.equal(replay.captured.taskBatches.length, 0);

  const mismatch = publishHarness({ replay: persisted });
  await assert.rejects(
    publishScheduleBaseline(mismatch.prisma, {
      scope: SCOPE,
      actorId: ACTOR_ID,
      idempotencyKey: 'baseline-publication-0001',
      input: { ...BASELINE_INPUT, name: 'Otro contrato' },
    }),
    (error) => error instanceof ScheduleSnapshotError
      && error.status === 409
      && error.code === 'SCHEDULE_IDEMPOTENCY_PAYLOAD_MISMATCH',
  );
  assert.equal(mismatch.captured.taskBatches.length, 0);
});

test('baseline publication rejects ambiguous input and canonical-to-external dependencies before writes', async () => {
  const unknown = publishHarness();
  await assert.rejects(
    publishScheduleBaseline(unknown.prisma, {
      scope: SCOPE,
      actorId: ACTOR_ID,
      idempotencyKey: 'baseline-publication-0002',
      input: { ...BASELINE_INPUT, organizationId: 'attacker' },
    }),
    (error) => error.code === 'SCHEDULE_SNAPSHOT_INPUT_INVALID',
  );
  assert.equal(unknown.captured.taskBatches.length, 0);

  const crossing = publishHarness({
    dependencies: [{
      predecessorId: 'task-a',
      successorId: 'external-task',
      type: 'FINISH_TO_START',
      lagDays: 0,
    }],
  });
  await assert.rejects(
    publishScheduleBaseline(crossing.prisma, {
      scope: SCOPE,
      actorId: ACTOR_ID,
      idempotencyKey: 'baseline-publication-0003',
      input: BASELINE_INPUT,
    }),
    (error) => error.code === 'SCHEDULE_BASELINE_DEPENDENCY_SCOPE' && error.status === 409,
  );
  assert.equal(crossing.captured.taskBatches.length, 0);
});

test('baseline pagination is compound, opaque, tenant-scoped, and filter-bound', async () => {
  const calls = [];
  const firstPrisma = {
    scheduleBaseline: {
      async findMany(args) {
        calls.push(args);
        return [
          { id: 'baseline-c', version: 3, status: 'ACTIVE' },
          { id: 'baseline-b', version: 2, status: 'SUPERSEDED' },
        ];
      },
    },
  };
  const first = await listScheduleBaselines(firstPrisma, { scope: SCOPE, limit: 1 });
  assert.equal(first.hasMore, true);
  assert.match(first.nextCursor, /^[A-Za-z0-9_-]+$/);
  assert.equal(first.nextCursor.includes('baseline-c'), false);
  assert.deepEqual(calls[0].where, SCOPE);

  const secondCalls = [];
  const second = await listScheduleBaselines({
    scheduleBaseline: {
      async findMany(args) {
        secondCalls.push(args);
        return [];
      },
    },
  }, { scope: SCOPE, cursor: first.nextCursor, limit: 1 });
  assert.equal(second.hasMore, false);
  assert.deepEqual(secondCalls[0].where, {
    ...SCOPE,
    OR: [
      { version: { lt: 3 } },
      { version: 3, id: { lt: 'baseline-c' } },
    ],
  });

  await assert.rejects(
    listScheduleBaselines(firstPrisma, {
      scope: SCOPE,
      status: 'ACTIVE',
      cursor: first.nextCursor,
      limit: 1,
    }),
    (error) => error.code === 'SCHEDULE_CURSOR_INVALID',
  );
});

function baselineTask(overrides = {}) {
  return {
    baselineId: 'baseline-a',
    sourceTaskId: 'task-a',
    sourceTaskRevision: 2,
    type: 'TASK',
    plannedStart: new Date('2026-07-28T00:00:00.000Z'),
    plannedFinish: new Date('2026-07-30T00:00:00.000Z'),
    plannedDurationDays: 3,
    ...overrides,
  };
}

function forecastHarness() {
  const captured = { taskBatches: [], roots: [], audit: [] };
  const tasks = [
    baselineTask(),
    baselineTask({
      sourceTaskId: 'task-b',
      sourceTaskRevision: 4,
      plannedStart: new Date('2026-07-31T00:00:00.000Z'),
      plannedFinish: new Date('2026-08-01T00:00:00.000Z'),
      plannedDurationDays: 2,
    }),
  ];
  const dependencies = [{
    predecessorSourceTaskId: 'task-a',
    successorSourceTaskId: 'task-b',
    type: 'FINISH_TO_START',
    lagDays: 0,
  }];
  const harness = transactionHarness({
    projectSnapshot: { findUnique: async () => ({ version: 7 }) },
    scheduleForecastRun: {
      findFirst: async () => null,
      async create(args) {
        harness.calls.push(['forecast-root']);
        captured.roots.push(args.data);
        return { ...args.data, createdAt: new Date('2026-07-28T12:00:00.000Z') };
      },
    },
    scheduleForecastTask: {
      async createMany(args) {
        harness.calls.push(['forecast-tasks']);
        captured.taskBatches.push(args.data);
        return { count: args.data.length };
      },
    },
    scheduleBaseline: {
      findFirst: async () => ({
        id: 'baseline-a',
        taskCount: 2,
        dependencyCount: 1,
        contentHash: 'a'.repeat(64),
      }),
    },
    scheduleBaselineTask: { findMany: async () => tasks },
    scheduleBaselineDependency: { findMany: async () => dependencies },
    task: {
      findMany: async () => [
        { id: 'task-a', revision: 2, progress: 50 },
        { id: 'task-b', revision: 4, progress: 0 },
      ],
    },
    auditLog: {
      async create(args) {
        captured.audit.push(args.data);
        return args.data;
      },
    },
  });
  return { ...harness, captured };
}

function forecastInput() {
  return {
    asOfDate: '2026-07-29',
    baselineId: 'baseline-a',
    expectedProjectStateVersion: 7,
    observations: [
      {
        sourceTaskId: 'task-b',
        expectedTaskRevision: 4,
        progressPercent: 0,
        progressSource: 'CANONICAL_TASK',
        actualStartDate: null,
        actualFinishDate: null,
        remainingDurationDays: null,
      },
      {
        sourceTaskId: 'task-a',
        expectedTaskRevision: 2,
        progressPercent: 50,
        progressSource: 'CANONICAL_TASK',
        actualStartDate: '2026-07-28',
        actualFinishDate: null,
        remainingDurationDays: 2,
      },
    ],
  };
}

test('forecast calculation persists a reproducible complete run child-first', async () => {
  const harness = forecastHarness();
  const result = await calculateScheduleForecast(harness.prisma, {
    scope: SCOPE,
    actorId: ACTOR_ID,
    idempotencyKey: 'forecast-calculation-0001',
    input: forecastInput(),
  });
  assert.equal(result.replayed, false);
  assert.equal(result.forecast.baselineId, 'baseline-a');
  assert.equal(harness.captured.taskBatches[0].length, 2);
  assert.equal(harness.captured.roots[0].taskCount, 2);
  assert.match(harness.captured.roots[0].inputHash, /^[0-9a-f]{64}$/);
  assert.match(harness.captured.roots[0].resultHash, /^[0-9a-f]{64}$/);
  assert.match(harness.captured.roots[0].requestFingerprint, /^[0-9a-f]{64}$/);
  assert.ok(
    harness.calls.findIndex(([name]) => name === 'forecast-tasks')
      < harness.calls.findIndex(([name]) => name === 'forecast-root'),
  );
  const second = harness.captured.taskBatches[0].find((task) => task.sourceTaskId === 'task-b');
  assert.equal(second.driver.kind, 'DEPENDENCY');
  assert.equal(second.relationshipConstraints[0].predecessorId, 'task-a');
  assert.ok(harness.captured.taskBatches[0].every((task) => task.progressSource === 'CANONICAL_TASK'));
  assert.equal(harness.captured.audit[0].action, 'schedule.forecast.calculated');
});

test('forecast fails closed for reviewed evidence without durable provenance before opening a transaction', async () => {
  let transactions = 0;
  const input = forecastInput();
  input.observations[0].progressSource = 'REVIEWED_EVIDENCE';
  input.observations[0].progressPercent = 35;

  await assert.rejects(
    calculateScheduleForecast({
      async $transaction() {
        transactions += 1;
      },
    }, {
      scope: SCOPE,
      actorId: ACTOR_ID,
      idempotencyKey: 'forecast-reviewed-evidence-0001',
      input,
    }),
    (error) => error instanceof ScheduleSnapshotError
      && error.status === 409
      && error.code === 'SCHEDULE_FORECAST_REVIEWED_EVIDENCE_PROVENANCE_REQUIRED'
      && error.details?.index === 0,
  );
  assert.equal(transactions, 0);
});

test('forecast rejects unknown observation fields before opening a transaction', async () => {
  let transactions = 0;
  const input = forecastInput();
  input.observations[0].organizationId = 'attacker';
  await assert.rejects(
    calculateScheduleForecast({
      async $transaction() {
        transactions += 1;
      },
    }, {
      scope: SCOPE,
      actorId: ACTOR_ID,
      idempotencyKey: 'forecast-calculation-0002',
      input,
    }),
    (error) => error.code === 'SCHEDULE_FORECAST_INPUT_INVALID',
  );
  assert.equal(transactions, 0);
});

test('forecast pagination uses createdAt plus id and binds the baseline filter', async () => {
  const createdAt = new Date('2026-07-28T12:00:00.000Z');
  const first = await listScheduleForecastRuns({
    scheduleForecastRun: {
      findMany: async () => [
        { id: 'forecast-c', createdAt, asOfDate: createdAt, baselineStartDate: createdAt, baselineFinishDate: createdAt, forecastStartDate: createdAt, forecastFinishDate: createdAt },
        { id: 'forecast-b', createdAt: new Date('2026-07-27T12:00:00.000Z'), asOfDate: createdAt, baselineStartDate: createdAt, baselineFinishDate: createdAt, forecastStartDate: createdAt, forecastFinishDate: createdAt },
      ],
    },
  }, { scope: SCOPE, baselineId: 'baseline-a', limit: 1 });
  assert.equal(first.hasMore, true);

  const calls = [];
  await listScheduleForecastRuns({
    scheduleForecastRun: {
      async findMany(args) {
        calls.push(args);
        return [];
      },
    },
  }, { scope: SCOPE, baselineId: 'baseline-a', cursor: first.nextCursor, limit: 1 });
  assert.deepEqual(calls[0].where, {
    ...SCOPE,
    baselineId: 'baseline-a',
    OR: [
      { createdAt: { lt: createdAt } },
      { createdAt, id: { lt: 'forecast-c' } },
    ],
  });

  await assert.rejects(
    listScheduleForecastRuns({ scheduleForecastRun: { findMany: async () => [] } }, {
      scope: SCOPE,
      baselineId: 'baseline-b',
      cursor: first.nextCursor,
      limit: 1,
    }),
    (error) => error.code === 'SCHEDULE_CURSOR_INVALID',
  );
});
