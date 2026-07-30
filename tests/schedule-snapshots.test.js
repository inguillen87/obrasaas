import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ScheduleSnapshotError,
  calculateScheduleForecast,
  listScheduleBaselines,
  listScheduleForecastRuns,
  publishScheduleBaseline,
} from '../src/lib/schedule-snapshots.js';
import { canonicalPlanHash } from '../src/lib/visual-progress-assessments.js';

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

const REVIEWED_MEDIA_SHA256 = 'b'.repeat(64);

function reviewedLiveTask(overrides = {}) {
  return {
    id: 'task-reviewed',
    externalId: null,
    code: '2.1',
    title: 'Mampostería revisada',
    type: 'TASK',
    status: 'IN_PROGRESS',
    progress: 20,
    startsAt: new Date('2026-07-20T00:00:00.000Z'),
    endsAt: new Date('2026-07-30T00:00:00.000Z'),
    parentId: null,
    revision: 6,
    predecessors: [],
    ...overrides,
  };
}

function reviewedBaselineTask(task = reviewedLiveTask(), overrides = {}) {
  return {
    baselineId: 'baseline-reviewed',
    sourceTaskId: task.id,
    sourceTaskRevision: 2,
    code: task.code,
    title: task.title,
    type: task.type,
    plannedStart: new Date('2026-07-20T00:00:00.000Z'),
    plannedFinish: new Date('2026-07-30T00:00:00.000Z'),
    plannedDurationDays: 11,
    ...overrides,
  };
}

function reviewedAssessmentFixture(liveTasks, overrides = {}) {
  const base = {
    id: 'assessment-reviewed',
    projectId: SCOPE.projectId,
    taskId: liveTasks[0].id,
    evidenceId: 'evidence-reviewed',
    revision: 4,
    status: 'COMPLETED',
    reviewStatus: 'APPROVED',
    reviewedById: 'reviewer-a',
    reviewedAt: new Date('2026-07-29T12:00:00.000Z'),
    progressMin: 35,
    progressMax: 55,
    correctedProgressMin: null,
    correctedProgressMax: null,
    inputSha256: REVIEWED_MEDIA_SHA256,
    taskRevisionAtRequest: liveTasks[0].revision,
    evidenceRevisionAtRequest: 3,
    baselineHash: canonicalPlanHash(liveTasks),
    evidence: {
      id: 'evidence-reviewed',
      taskId: liveTasks[0].id,
      status: 'APPROVED',
      revision: 3,
      media: { sha256: REVIEWED_MEDIA_SHA256, storageKey: 'private/source.jpg' },
      capturedAt: new Date('2026-07-28T16:00:00.000Z'),
    },
  };
  return {
    ...base,
    ...overrides,
    evidence: { ...base.evidence, ...(overrides.evidence || {}) },
  };
}

function reviewedForecastInput({
  task = reviewedLiveTask(),
  assessment = null,
  progressPercent = 45,
  rationale = 'Punto confirmado por el director de obra.',
  observations = null,
} = {}) {
  const currentAssessment = assessment || reviewedAssessmentFixture([task]);
  return {
    asOfDate: '2026-07-29',
    baselineId: 'baseline-reviewed',
    expectedProjectStateVersion: 7,
    observations: observations || [{
      sourceTaskId: task.id,
      expectedTaskRevision: task.revision,
      progressPercent,
      progressSource: 'REVIEWED_EVIDENCE',
      reviewedEvidence: {
        assessmentId: currentAssessment.id,
        expectedAssessmentRevision: currentAssessment.revision,
        rationale,
      },
      actualStartDate: '2026-07-20',
      actualFinishDate: progressPercent === 100 ? '2026-07-29' : null,
      remainingDurationDays: progressPercent === 100 ? 0 : 4,
    }],
  };
}

function reviewedForecastHarness({
  liveTasks = [reviewedLiveTask()],
  baselineTasks = null,
  assessments = null,
  existingObservation = null,
  baseline = {},
} = {}) {
  const scopedBaselineTasks = baselineTasks || liveTasks.map((task) => reviewedBaselineTask(task));
  const assessmentRows = assessments || [reviewedAssessmentFixture(liveTasks)];
  const captured = {
    assessmentQueries: [],
    audits: [],
    forecastTasks: [],
    forecastRuns: [],
    observationCreates: [],
    observationQueries: [],
    taskUpdates: 0,
    baselineUpdates: 0,
  };
  const transaction = {
    async $executeRawUnsafe() { return 1; },
    project: {
      findFirst: async () => ({ id: SCOPE.projectId, organizationId: SCOPE.organizationId, status: 'ACTIVE' }),
    },
    projectSnapshot: { findUnique: async () => ({ version: 7 }) },
    scheduleForecastRun: {
      findFirst: async () => null,
      async create(args) {
        captured.forecastRuns.push(args.data);
        return { ...args.data, createdAt: new Date('2026-07-29T18:00:00.000Z') };
      },
    },
    scheduleBaseline: {
      findFirst: async () => ({
        id: 'baseline-reviewed',
        organizationId: SCOPE.organizationId,
        projectId: SCOPE.projectId,
        status: 'ACTIVE',
        timeZone: 'America/Argentina/Buenos_Aires',
        taskCount: scopedBaselineTasks.length,
        dependencyCount: 0,
        contentHash: 'a'.repeat(64),
        ...baseline,
      }),
      async update() { captured.baselineUpdates += 1; },
      async updateMany() { captured.baselineUpdates += 1; },
    },
    scheduleBaselineTask: { findMany: async () => scopedBaselineTasks },
    scheduleBaselineDependency: { findMany: async () => [] },
    task: {
      findMany: async () => liveTasks,
      async update() { captured.taskUpdates += 1; },
      async updateMany() { captured.taskUpdates += 1; },
    },
    visualProgressAssessment: {
      async findMany(args) {
        captured.assessmentQueries.push(args);
        const ids = new Set(args.where.id.in);
        return assessmentRows.filter((row) => ids.has(row.id));
      },
    },
    scheduleProgressObservation: {
      async findFirst(args) {
        captured.observationQueries.push(args);
        if (!existingObservation) return null;
        return existingObservation.assessmentId === args.where.assessmentId
          && existingObservation.assessmentRevision === args.where.assessmentRevision
          ? existingObservation
          : null;
      },
      async create(args) {
        captured.observationCreates.push(args.data);
        return args.data;
      },
    },
    scheduleForecastTask: {
      async createMany(args) {
        captured.forecastTasks.push(...args.data);
        return { count: args.data.length };
      },
    },
    auditLog: {
      async create(args) {
        captured.audits.push(args.data);
        return args.data;
      },
    },
  };
  return {
    captured,
    prisma: { $transaction: async (operation) => operation(transaction) },
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

test('reviewed evidence materializes one immutable observation and links it without mutating task or baseline', async () => {
  const task = reviewedLiveTask();
  const assessment = reviewedAssessmentFixture([task]);
  const harness = reviewedForecastHarness({ liveTasks: [task], assessments: [assessment] });
  const rationale = 'AUDIT-PRIVATE-RATIONALE: contraste humano del paño ejecutado.';
  const result = await calculateScheduleForecast(harness.prisma, {
    scope: SCOPE,
    actorId: ACTOR_ID,
    idempotencyKey: 'forecast-reviewed-success-0001',
    input: reviewedForecastInput({ task, assessment, progressPercent: 45, rationale }),
  });

  assert.equal(result.replayed, false);
  assert.equal(harness.captured.observationCreates.length, 1);
  const observation = harness.captured.observationCreates[0];
  assert.equal(observation.source, 'REVIEWED_EVIDENCE');
  assert.equal(observation.assessmentId, assessment.id);
  assert.equal(observation.assessmentRevision, assessment.revision);
  assert.equal(observation.progressMin, 35);
  assert.equal(observation.progressMax, 55);
  assert.equal(observation.progressPercent, 45);
  assert.equal(observation.rationale, rationale);
  assert.match(observation.requestFingerprint, /^[0-9a-f]{64}$/);
  assert.equal(harness.captured.forecastTasks[0].progressObservationId, observation.id);
  assert.equal(harness.captured.forecastTasks[0].progressSource, 'REVIEWED_EVIDENCE');
  assert.equal(harness.captured.taskUpdates, 0);
  assert.equal(harness.captured.baselineUpdates, 0);
  assert.deepEqual(harness.captured.assessmentQueries[0].where, {
    projectId: SCOPE.projectId,
    id: { in: [assessment.id] },
  });

  const observationAudit = harness.captured.audits.find((row) => (
    row.action === 'schedule.progress_observation.created'
  ));
  assert.ok(observationAudit);
  assert.deepEqual(Object.keys(observationAudit.metadata).sort(), [
    'asOfDate',
    'assessmentId',
    'assessmentRevision',
    'baselineId',
    'decisionPolicyVersion',
    'evidenceCapturedOn',
    'evidenceId',
    'evidenceRevision',
    'progressPercent',
    'projectId',
    'reviewStatus',
    'taskId',
  ]);
  const auditJson = JSON.stringify(observationAudit);
  for (const secret of [rationale, REVIEWED_MEDIA_SHA256, 'storageKey', 'latitude', 'longitude', 'accuracyMeters']) {
    assert.equal(auditJson.includes(secret), false, `audit leaked ${secret}`);
  }
});

test('corrected visual review uses its corrected range and rejects a human point outside it', async () => {
  const task = reviewedLiveTask();
  const corrected = reviewedAssessmentFixture([task], {
    reviewStatus: 'CORRECTED',
    progressMin: 10,
    progressMax: 20,
    correctedProgressMin: 62,
    correctedProgressMax: 70,
  });
  const accepted = reviewedForecastHarness({ liveTasks: [task], assessments: [corrected] });
  await calculateScheduleForecast(accepted.prisma, {
    scope: SCOPE,
    actorId: ACTOR_ID,
    idempotencyKey: 'forecast-reviewed-corrected-0001',
    input: reviewedForecastInput({ task, assessment: corrected, progressPercent: 66 }),
  });
  assert.equal(accepted.captured.observationCreates[0].reviewStatus, 'CORRECTED');
  assert.equal(accepted.captured.observationCreates[0].progressMin, 62);
  assert.equal(accepted.captured.observationCreates[0].progressMax, 70);
  assert.equal(accepted.captured.observationCreates[0].progressPercent, 66);

  const rejected = reviewedForecastHarness({ liveTasks: [task], assessments: [corrected] });
  await assert.rejects(
    calculateScheduleForecast(rejected.prisma, {
      scope: SCOPE,
      actorId: ACTOR_ID,
      idempotencyKey: 'forecast-reviewed-corrected-0002',
      input: reviewedForecastInput({ task, assessment: corrected, progressPercent: 71 }),
    }),
    (error) => error instanceof ScheduleSnapshotError
      && error.code === 'SCHEDULE_FORECAST_REVIEWED_EVIDENCE_POINT_OUT_OF_RANGE'
      && error.details?.minimum === 62
      && error.details?.maximum === 70,
  );
  assert.equal(rejected.captured.observationCreates.length, 0);
  assert.equal(rejected.captured.forecastTasks.length, 0);
});

test('reviewed evidence rejects cross-task, stale source, and stale plan provenance', async () => {
  const task = reviewedLiveTask();
  const cases = [
    {
      code: 'SCHEDULE_FORECAST_REVIEWED_EVIDENCE_SCOPE',
      assessment: reviewedAssessmentFixture([task], {
        taskId: 'foreign-task',
        evidence: { taskId: 'foreign-task' },
      }),
    },
    {
      code: 'SCHEDULE_FORECAST_REVIEWED_EVIDENCE_SOURCE_STALE',
      assessment: reviewedAssessmentFixture([task], {
        evidence: { status: 'PENDING' },
      }),
    },
    {
      code: 'SCHEDULE_FORECAST_REVIEWED_EVIDENCE_SOURCE_STALE',
      assessment: reviewedAssessmentFixture([task], {
        evidence: { revision: 4 },
      }),
    },
    {
      code: 'SCHEDULE_FORECAST_REVIEWED_EVIDENCE_PLAN_STALE',
      assessment: reviewedAssessmentFixture([task], {
        baselineHash: 'f'.repeat(64),
      }),
    },
  ];
  for (const [index, candidate] of cases.entries()) {
    const harness = reviewedForecastHarness({ liveTasks: [task], assessments: [candidate.assessment] });
    await assert.rejects(
      calculateScheduleForecast(harness.prisma, {
        scope: SCOPE,
        actorId: ACTOR_ID,
        idempotencyKey: `forecast-reviewed-stale-000${index + 1}`,
        input: reviewedForecastInput({ task, assessment: candidate.assessment }),
      }),
      (error) => error instanceof ScheduleSnapshotError && error.code === candidate.code,
    );
    assert.equal(harness.captured.observationCreates.length, 0);
    assert.equal(harness.captured.forecastTasks.length, 0);
  }
});

test('one visual assessment cannot feed two tasks in the same forecast', async () => {
  const first = reviewedLiveTask();
  const second = reviewedLiveTask({
    id: 'task-reviewed-b',
    code: '2.2',
    title: 'Mampostería sur',
    progress: 0,
    revision: 2,
  });
  const assessment = reviewedAssessmentFixture([first, second]);
  const observations = [first, second].map((task) => ({
    sourceTaskId: task.id,
    expectedTaskRevision: task.revision,
    progressPercent: 40,
    progressSource: 'REVIEWED_EVIDENCE',
    reviewedEvidence: {
      assessmentId: assessment.id,
      expectedAssessmentRevision: assessment.revision,
      rationale: `Punto revisado para ${task.id}.`,
    },
    actualStartDate: '2026-07-20',
    actualFinishDate: null,
    remainingDurationDays: 4,
  }));
  const harness = reviewedForecastHarness({
    liveTasks: [first, second],
    baselineTasks: [reviewedBaselineTask(first), reviewedBaselineTask(second)],
    assessments: [assessment],
  });
  await assert.rejects(
    calculateScheduleForecast(harness.prisma, {
      scope: SCOPE,
      actorId: ACTOR_ID,
      idempotencyKey: 'forecast-reviewed-duplicate-0001',
      input: reviewedForecastInput({ task: first, assessment, observations }),
    }),
    (error) => error instanceof ScheduleSnapshotError
      && error.code === 'SCHEDULE_FORECAST_REVIEWED_EVIDENCE_DUPLICATE',
  );
  assert.equal(harness.captured.assessmentQueries.length, 0);
  assert.equal(harness.captured.observationCreates.length, 0);
});

test('immutable reviewed observation is reused only for the identical normalized payload', async () => {
  const task = reviewedLiveTask();
  const assessment = reviewedAssessmentFixture([task]);
  const input = reviewedForecastInput({ task, assessment });
  const first = reviewedForecastHarness({ liveTasks: [task], assessments: [assessment] });
  await calculateScheduleForecast(first.prisma, {
    scope: SCOPE,
    actorId: ACTOR_ID,
    idempotencyKey: 'forecast-reviewed-reuse-0001',
    input,
  });
  const persisted = first.captured.observationCreates[0];

  const replay = reviewedForecastHarness({
    liveTasks: [task], assessments: [assessment], existingObservation: persisted,
  });
  await calculateScheduleForecast(replay.prisma, {
    scope: SCOPE,
    actorId: ACTOR_ID,
    idempotencyKey: 'forecast-reviewed-reuse-0002',
    input,
  });
  assert.equal(replay.captured.observationCreates.length, 0);
  assert.equal(replay.captured.forecastTasks[0].progressObservationId, persisted.id);
  assert.equal(replay.captured.audits.some((row) => row.action === 'schedule.progress_observation.created'), false);

  const mismatch = reviewedForecastHarness({
    liveTasks: [task], assessments: [assessment], existingObservation: persisted,
  });
  await assert.rejects(
    calculateScheduleForecast(mismatch.prisma, {
      scope: SCOPE,
      actorId: ACTOR_ID,
      idempotencyKey: 'forecast-reviewed-reuse-0003',
      input: reviewedForecastInput({
        task,
        assessment,
        rationale: 'Un fundamento humano diferente no puede reescribir la observación.',
      }),
    }),
    (error) => error instanceof ScheduleSnapshotError
      && error.code === 'SCHEDULE_FORECAST_REVIEWED_EVIDENCE_ALREADY_USED',
  );
  assert.equal(mismatch.captured.observationCreates.length, 0);
  assert.equal(mismatch.captured.forecastTasks.length, 0);
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
      && error.code === 'SCHEDULE_FORECAST_REVIEWED_EVIDENCE_PROVENANCE_REQUIRED',
  );
  assert.equal(transactions, 0);
});

test('forecast fails closed for a free manual override before opening a transaction', async () => {
  let transactions = 0;
  const input = forecastInput();
  input.observations[0].progressSource = 'MANUAL_OVERRIDE';
  await assert.rejects(
    calculateScheduleForecast({
      async $transaction() {
        transactions += 1;
      },
    }, {
      scope: SCOPE,
      actorId: ACTOR_ID,
      idempotencyKey: 'forecast-manual-override-0001',
      input,
    }),
    (error) => error instanceof ScheduleSnapshotError
      && error.status === 409
      && error.code === 'SCHEDULE_FORECAST_MANUAL_OVERRIDE_PROVENANCE_REQUIRED',
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
