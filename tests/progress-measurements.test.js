import assert from 'node:assert/strict';
import test from 'node:test';

import {
  civilFortnightForDate,
  createProgressMeasurementReadAdapter,
  createProgressMeasurementSqlAdapter,
  normalizeProgressMeasurementListQuery,
  normalizeProgressMeasurementReview,
  normalizeProgressMeasurementSubmission,
  ProgressMeasurementError,
  readTaskProgressMeasurementSnapshot,
  reviewProgressMeasurement,
  submitProgressMeasurement,
} from '../src/lib/progress-measurements.js';

const SCOPE = Object.freeze({ organizationId: 'organization-a', projectId: 'project-a' });
const ACTOR = 'membership-a';

function submission(overrides = {}) {
  return {
    taskId: 'task-a',
    periodDate: '2026-08-20',
    unit: 'M2',
    baselineQuantity: '100',
    executedQuantity: '12.5',
    method: 'DIMENSIONAL_CALCULATION',
    rationale: 'Medición contrastada contra dimensiones verificadas en obra.',
    evidenceIds: ['evidence-b', 'evidence-a'],
    expectedHeadId: null,
    ...overrides,
  };
}

function resultRow(command, overrides = {}) {
  const approved = overrides.status === 'APPROVED';
  return {
    head_id: 'head-a',
    measurement_id: command.measurementId || 'measurement-a',
    organization_id: command.organizationId,
    project_id: command.projectId,
    task_id: command.taskId || 'task-a',
    period_start: command.period?.start || '2026-08-16',
    period_end: command.period?.end || '2026-08-31',
    unit_code: command.unit || 'M2',
    base_quantity: command.baselineQuantity || '100.0000',
    period_quantity: command.executedQuantity || '12.5000',
    cumulative_quantity: '12.5000',
    method: command.method || 'DIMENSIONAL_CALCULATION',
    rationale: command.rationale || 'Medición contrastada contra dimensiones verificadas en obra.',
    task_revision: 3,
    measurement_revision: 1,
    head_revision: 1,
    status: 'PENDING',
    evidence_count: command.evidenceIds?.length || 2,
    prepared_by_membership_id: operationActor(command, false),
    decided_by_membership_id: null,
    decision_reason: null,
    approved_cumulative_quantity: approved ? '12.5000' : null,
    balance_revision: approved ? 1 : null,
    replayed: false,
    ...overrides,
  };
}

function operationActor(command, review) {
  return review ? 'membership-maker' : command.actorMembershipId;
}

test('civil fortnights use exact calendar halves including leap-year month end', () => {
  assert.deepEqual(civilFortnightForDate('2028-02-15'), {
    key: '2028-02-01/2028-02-15', start: '2028-02-01', end: '2028-02-15', label: '1-15/02/2028',
  });
  assert.deepEqual(civilFortnightForDate('2028-02-16'), {
    key: '2028-02-16/2028-02-29', start: '2028-02-16', end: '2028-02-29', label: '16-29/02/2028',
  });
  assert.throws(() => civilFortnightForDate('2026-02-30'), /fecha civil/);
});

test('submission is strict, canonicalizes Decimal/evidence and fingerprints exact content', () => {
  const value = normalizeProgressMeasurementSubmission(submission(), 'measurement-operation-0001');
  assert.equal(value.baselineQuantity, '100.0000');
  assert.equal(value.executedQuantity, '12.5000');
  assert.deepEqual(value.evidenceIds, ['evidence-a', 'evidence-b']);
  assert.equal(Object.hasOwn(value, 'requestFingerprint'), false);
  assert.throws(() => normalizeProgressMeasurementSubmission(
    submission({ projectId: 'attacker-project' }),
    'measurement-operation-0001',
  ), /no está permitido/);
  assert.throws(() => normalizeProgressMeasurementSubmission(
    submission({ evidenceIds: ['evidence-a', 'evidence-a'] }),
    'measurement-operation-0001',
  ), /duplicados/);
  assert.throws(() => normalizeProgressMeasurementSubmission(
    submission({ executedQuantity: '0' }),
    'measurement-operation-0001',
  ), /mayor que cero/);
});

test('review accepts only explicit APPROVE/REJECT, CAS and exact idempotency', () => {
  const value = normalizeProgressMeasurementReview({
    expectedRevision: 3,
    decision: 'APPROVE',
    reason: 'Cantidad técnica verificada.',
  }, 'measurement-review-0001');
  assert.equal(value.expectedRevision, 3);
  assert.equal(Object.hasOwn(value, 'requestFingerprint'), false);
  assert.throws(() => normalizeProgressMeasurementReview({
    expectedRevision: 3,
    decision: 'APPROVED',
    reason: 'Cantidad técnica verificada.',
  }, 'measurement-review-0001'), /decision/);
});

test('submit forwards only trusted scope/membership and validates the exact SQL result', async () => {
  let command;
  const result = await submitProgressMeasurement(null, {
    scope: SCOPE,
    actorMembershipId: ACTOR,
    operationKey: 'measurement-operation-0001',
    input: submission(),
  }, {
    sqlAdapter: {
      async submit(value) {
        command = value;
        return [resultRow(value)];
      },
    },
  });
  assert.equal(command.organizationId, SCOPE.organizationId);
  assert.equal(command.projectId, SCOPE.projectId);
  assert.equal(command.actorMembershipId, ACTOR);
  assert.match(command.requestFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(result.measurement.executedQuantity, '12.5000');
  assert.deepEqual(result.approved, {
    unit: null,
    quantity: '0.0000',
    baselineQuantity: null,
    percent: null,
  });
  assert.equal(Object.hasOwn(result.measurement, 'requestFingerprint'), false);
});

test('request fingerprint binds tenant/project/actor/body but excludes the operation key', async () => {
  const commands = [];
  const submit = (scope, actorMembershipId, operationKey) => submitProgressMeasurement(null, {
    scope,
    actorMembershipId,
    operationKey,
    input: submission(),
  }, {
    sqlAdapter: {
      async submit(command) {
        commands.push(command);
        return [resultRow(command)];
      },
    },
  });
  await submit(SCOPE, ACTOR, 'measurement-operation-0001');
  await submit(SCOPE, ACTOR, 'measurement-operation-0002');
  await submit({ ...SCOPE, projectId: 'project-b' }, ACTOR, 'measurement-operation-0003');
  await submit(SCOPE, 'membership-b', 'measurement-operation-0004');
  assert.equal(commands[0].requestFingerprint, commands[1].requestFingerprint);
  assert.notEqual(commands[0].requestFingerprint, commands[2].requestFingerprint);
  assert.notEqual(commands[0].requestFingerprint, commands[3].requestFingerprint);
});

test('review validates CAS/result actor and exposes a separate decision DTO', async () => {
  const input = { expectedRevision: 1, decision: 'APPROVE', reason: 'Cantidad verificada en obra.' };
  const result = await reviewProgressMeasurement(null, {
    scope: SCOPE,
    actorMembershipId: 'membership-checker',
    measurementId: 'measurement-a',
    operationKey: 'measurement-review-0001',
    input,
  }, {
    sqlAdapter: {
      async review(command) {
        return [resultRow(command, {
          status: 'APPROVED',
          prepared_by_membership_id: 'membership-maker',
          decided_by_membership_id: 'membership-checker',
          decision_reason: input.reason,
          approved_cumulative_quantity: '12.5000',
          balance_revision: 1,
        })];
      },
    },
  });
  assert.deepEqual(result.measurement.review, {
    decision: 'APPROVE',
    reason: input.reason,
    reviewedBy: { label: null, isCurrentActor: true },
  });
  assert.equal(result.approved.percent, '12.5000');
});

test('SQL adapter preserves the frozen function signatures and maps API decisions to DB enums', async () => {
  const calls = [];
  const adapter = createProgressMeasurementSqlAdapter({
    async $queryRawUnsafe(sql, ...values) {
      calls.push({ sql, values });
      return [];
    },
  });
  await adapter.submit({
    organizationId: 'organization-a',
    projectId: 'project-a',
    taskId: 'task-a',
    period: civilFortnightForDate('2026-08-20'),
    unit: 'M2',
    baselineQuantity: '100.0000',
    executedQuantity: '12.5000',
    method: 'DIRECT_COUNT',
    rationale: 'Cantidad verificada en obra.',
    evidenceIds: ['evidence-a'],
    expectedHeadId: null,
    operationKey: 'measurement-operation-0001',
    requestFingerprint: 'a'.repeat(64),
    actorMembershipId: 'membership-a',
  });
  await adapter.review({
    organizationId: 'organization-a',
    projectId: 'project-a',
    measurementId: 'measurement-a',
    expectedRevision: 1,
    decision: 'APPROVE',
    reason: 'Cantidad verificada.',
    operationKey: 'measurement-review-0001',
    requestFingerprint: 'b'.repeat(64),
    actorMembershipId: 'membership-b',
  });
  assert.match(calls[0].sql, /obrasaas_progress_measurement_submit/);
  assert.equal(calls[0].values.length, 15);
  assert.equal(calls[0].values[11], null);
  assert.equal(calls[0].values[14], 'membership-a');
  assert.match(calls[1].sql, /obrasaas_progress_measurement_review/);
  assert.equal(calls[1].values.length, 9);
  assert.equal(calls[1].values[4], 'APPROVED');
  assert.equal(calls[1].values[8], 'membership-b');
});

test('result contract fails closed and database errors are allowlisted/redacted', async () => {
  await assert.rejects(
    () => submitProgressMeasurement(null, {
      scope: SCOPE,
      actorMembershipId: ACTOR,
      operationKey: 'measurement-operation-0001',
      input: submission(),
    }, { sqlAdapter: { submit: async () => [{ measurement_id: 'partial' }] } }),
    (error) => error.code === 'PROGRESS_MEASUREMENT_CONTRACT_INVALID',
  );
  await assert.rejects(
    () => submitProgressMeasurement(null, {
      scope: SCOPE,
      actorMembershipId: ACTOR,
      operationKey: 'measurement-operation-0001',
      input: submission(),
    }, { sqlAdapter: { submit: async () => { throw new Error('secret DSN PROGRESS_MEASUREMENT_HEAD_STALE'); } } }),
    (error) => error.code === 'PROGRESS_MEASUREMENT_HEAD_STALE'
      && !error.message.includes('secret'),
  );
  await assert.rejects(
    () => submitProgressMeasurement(null, {
      scope: SCOPE,
      actorMembershipId: ACTOR,
      operationKey: 'measurement-operation-0002',
      input: submission(),
    }, { sqlAdapter: { submit: async () => { throw new Error('private PROGRESS_MEASUREMENT_FUTURE_PERIOD'); } } }),
    (error) => error.code === 'PROGRESS_MEASUREMENT_FUTURE_PERIOD'
      && error.status === 400
      && !error.message.includes('private'),
  );
});

test('GET query is bounded and snapshot rejects cross-scope task absence', async () => {
  assert.deepEqual(normalizeProgressMeasurementListQuery(new Request(
    'https://example.test/api/progress-measurements?taskId=task-a&status=APPROVED&limit=10',
  )), { taskId: 'task-a', period: null, status: 'APPROVED', cursor: null, limit: 10 });
  assert.deepEqual(normalizeProgressMeasurementListQuery(new URLSearchParams({
    taskId: 'task-a', periodDate: '2028-02-29',
  })).period, {
    key: '2028-02-16/2028-02-29',
    start: '2028-02-16',
    end: '2028-02-29',
    label: '16-29/02/2028',
  });
  assert.throws(() => normalizeProgressMeasurementListQuery(new Request(
    'https://example.test/api/progress-measurements?taskId=task-a&organizationId=attacker',
  )), /consulta/);
  await assert.rejects(
    () => readTaskProgressMeasurementSnapshot(null, {
      scope: SCOPE,
      actorMembershipId: ACTOR,
      query: { taskId: 'task-a', status: null, cursor: null, limit: 25 },
    }, { readAdapter: { read: async () => ({ task: null }) } }),
    (error) => error instanceof ProgressMeasurementError && error.status === 404,
  );
});

test('snapshot derives status from append-only decision, head readiness and balance without IDs', async () => {
  const snapshot = await readTaskProgressMeasurementSnapshot(null, {
    scope: SCOPE,
    actorMembershipId: ACTOR,
    query: {
      taskId: 'task-a',
      period: civilFortnightForDate('2026-08-20'),
      status: null,
      cursor: null,
      limit: 25,
    },
  }, {
    readAdapter: {
      async read() {
        return {
          task: { id: 'task-a', code: 'A-01', title: 'Mampostería', revision: 3 },
          head: {
            id: 'head-a',
            periodStart: new Date('2026-08-16T00:00:00.000Z'),
            periodEnd: new Date('2026-08-31T00:00:00.000Z'),
            headMeasurementId: 'measurement-a',
            pendingMeasurementId: null,
            approvedMeasurementId: 'measurement-a',
            revision: 2,
            headMeasurement: { unitCode: 'M2', baseQuantity: '100.0000' },
          },
          balance: {
            unitCode: 'M2',
            baseQuantity: '100.0000',
            approvedCumulativeQuantity: '12.5000',
            revision: 1,
          },
          rows: [{
            id: 'measurement-a',
            taskId: 'task-a',
            revision: 1,
            taskRevision: 3,
            evidenceCount: 1,
            unitCode: 'M2',
            baseQuantity: '100.0000',
            periodQuantity: '12.5000',
            cumulativeQuantity: '12.5000',
            method: 'DIMENSIONAL_CALCULATION',
            rationale: 'Medición verificada en obra.',
            preparedByMembershipId: ACTOR,
            preparedByMembership: { user: { fullName: 'Jefa de obra' } },
            createdAt: new Date('2026-08-20T14:00:00.000Z'),
            head: {
              periodStart: new Date('2026-08-16T00:00:00.000Z'),
              periodEnd: new Date('2026-08-31T00:00:00.000Z'),
            },
            evidenceLinks: [{
              progressEvidenceId: 'evidence-a',
              evidenceRevision: 2,
              evidenceCapturedAt: new Date('2026-08-20T12:00:00.000Z'),
            }],
            decision: {
              decision: 'APPROVED',
              reason: 'Cantidad contrastada.',
              decidedByMembershipId: 'membership-checker',
              decidedByMembership: { user: { fullName: 'Director de obra' } },
              createdAt: new Date('2026-08-20T15:00:00.000Z'),
            },
          }],
        };
      },
    },
  });
  assert.equal(snapshot.readiness.state, 'READY');
  assert.equal(snapshot.requestedPeriod.start, '2026-08-16');
  assert.equal(snapshot.measurements[0].status, 'APPROVED');
  assert.deepEqual(snapshot.measurements[0].preparedBy, {
    label: 'Jefa de obra', isCurrentActor: true,
  });
  assert.equal(Object.hasOwn(snapshot.measurements[0].preparedBy, 'id'), false);
  assert.equal(snapshot.approved.percent, '12.5000');
  assert.equal(snapshot.approved.unit, 'M2');
});

test('snapshot reports a task-wide pending blocker while keeping the requested period head scoped', async () => {
  const requested = civilFortnightForDate('2026-09-02');
  const snapshot = await readTaskProgressMeasurementSnapshot(null, {
    scope: SCOPE,
    actorMembershipId: ACTOR,
    query: { taskId: 'task-a', period: requested, status: null, cursor: null, limit: 25 },
  }, {
    readAdapter: {
      async read(command) {
        assert.equal(command.period.start, '2026-09-01');
        return {
          task: { id: 'task-a', code: null, title: 'Tarea', revision: 0 },
          head: null,
          balance: null,
          rows: [],
          pendingHead: {
            id: 'head-august',
            periodStart: new Date('2026-08-16T00:00:00.000Z'),
            periodEnd: new Date('2026-08-31T00:00:00.000Z'),
            pendingMeasurementId: 'measurement-august',
            revision: 1,
          },
        };
      },
    },
  });
  assert.equal(snapshot.head, null);
  assert.equal(snapshot.requestedPeriod.start, '2026-09-01');
  assert.equal(snapshot.readiness.state, 'REVIEW_PENDING');
  assert.equal(snapshot.readiness.pendingIsRequestedPeriod, false);
  assert.equal(snapshot.readiness.blockingPeriod.start, '2026-08-16');
  assert.deepEqual(snapshot.approved, {
    unit: null,
    quantity: '0.0000',
    baselineQuantity: null,
    percent: null,
    revision: 0,
  });
});

test('default read adapter serializes repeatable-read queries and selects the requested civil-period head', async () => {
  const calls = [];
  let taskQuery = null;
  let headQuery = null;
  let isolationLevel = null;
  let activeQueries = 0;
  const singleFlight = async (label, result) => {
    assert.equal(activeQueries, 0, `${label} overlapped another interactive-transaction query`);
    activeQueries += 1;
    calls.push(label);
    try {
      await Promise.resolve();
      return typeof result === 'function' ? result() : result;
    } finally {
      activeQueries -= 1;
    }
  };
  const head = {
    id: 'head-a',
    periodStart: new Date('2026-08-16T00:00:00.000Z'),
    periodEnd: new Date('2026-08-31T00:00:00.000Z'),
  };
  const database = {
    tenantMembership: {
      findFirst: () => singleFlight('membership', { id: ACTOR }),
    },
    task: {
      findFirst: (options) => singleFlight('task', () => {
        taskQuery = options;
        return { id: 'task-a' };
      }),
    },
    taskProgressMeasurement: {
      findMany: () => singleFlight('measurements', []),
      findFirst: () => singleFlight('cursor', null),
    },
    taskProgressMeasurementHead: {
      findFirst(options) {
        const pending = Boolean(options.where.pendingMeasurementId);
        if (!pending) headQuery = options;
        return singleFlight(pending ? 'pending-head' : 'period-head', () => (
          pending ? null : head
        ));
      },
    },
    taskProgressMeasurementBalance: {
      findFirst: () => singleFlight('balance', null),
    },
  };
  const adapter = createProgressMeasurementReadAdapter({
    async $transaction(callback, options) {
      isolationLevel = options.isolationLevel;
      return callback(database);
    },
  });
  const raw = await adapter.read({
    ...SCOPE,
    taskId: 'task-a',
    period: civilFortnightForDate('2026-08-20'),
    status: null,
    cursor: null,
    limit: 25,
  });
  assert.equal(isolationLevel, 'RepeatableRead');
  assert.equal(raw.head, head);
  assert.equal(taskQuery.where.type, 'TASK');
  assert.deepEqual(taskQuery.where.metadata, {
    path: ['source'], equals: 'canonical-task-v1',
  });
  assert.equal(headQuery.where.periodStart.toISOString(), '2026-08-16T00:00:00.000Z');
  assert.deepEqual(calls, [
    'membership',
    'task',
    'measurements',
    'period-head',
    'balance',
    'pending-head',
  ]);
});

test('GET fails closed for legacy and milestone task ids even inside the active project', async () => {
  let taskQuery = null;
  const prisma = {
    async $transaction(callback) {
      return callback({
        tenantMembership: { findFirst: async () => ({ id: ACTOR }) },
        task: {
          async findFirst(options) {
            taskQuery = options;
            return null;
          },
        },
      });
    },
  };
  await assert.rejects(
    () => readTaskProgressMeasurementSnapshot(prisma, {
      scope: SCOPE,
      actorMembershipId: ACTOR,
      query: {
        taskId: 'legacy-or-milestone',
        period: civilFortnightForDate('2026-08-20'),
        status: null,
        cursor: null,
        limit: 25,
      },
    }),
    (error) => error.code === 'PROGRESS_MEASUREMENT_TASK_NOT_FOUND' && error.status === 404,
  );
  assert.deepEqual(taskQuery.where.metadata, {
    path: ['source'], equals: 'canonical-task-v1',
  });
  assert.equal(taskQuery.where.type, 'TASK');
});

test('domain read rejects a superadmin without an active tenant membership before storage', async () => {
  let readCalls = 0;
  await assert.rejects(
    () => readTaskProgressMeasurementSnapshot(null, {
      scope: SCOPE,
      actorMembershipId: null,
      query: { taskId: 'task-a', period: null, status: null, cursor: null, limit: 25 },
    }, {
      readAdapter: { read: async () => { readCalls += 1; } },
    }),
    (error) => error.code === 'TENANT_MEMBERSHIP_REQUIRED' && error.status === 403,
  );
  assert.equal(readCalls, 0);
});

test('default GET adapter revalidates ACTIVE tenant membership in the same snapshot', async () => {
  let taskCalls = 0;
  const prisma = {
    async $transaction(callback) {
      return callback({
        tenantMembership: { findFirst: async () => null },
        task: { findFirst: async () => { taskCalls += 1; } },
      });
    },
  };
  await assert.rejects(
    () => readTaskProgressMeasurementSnapshot(prisma, {
      scope: SCOPE,
      actorMembershipId: ACTOR,
      query: { taskId: 'task-a', period: null, status: null, cursor: null, limit: 25 },
    }),
    (error) => error.code === 'TENANT_MEMBERSHIP_REQUIRED' && error.status === 403,
  );
  assert.equal(taskCalls, 0);
});
