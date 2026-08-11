import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createProgressMeasurementCutReadAdapter,
  createProgressMeasurementCutSqlAdapter,
  normalizeProgressMeasurementCutQuery,
  normalizeProgressMeasurementCutSeal,
  ProgressMeasurementCutError,
  readProgressMeasurementCutSnapshot,
  sealProgressMeasurementCut,
} from '../src/lib/progress-measurement-cuts.js';

const SCOPE = Object.freeze({ organizationId: 'organization-a', projectId: 'project-a' });
const ACTOR = 'membership-director';
const CANDIDATE_TOKEN = 'a'.repeat(64);

function sealInput(overrides = {}) {
  return {
    periodDate: '2026-08-20',
    expectedHeadCutId: null,
    expectedCandidateToken: CANDIDATE_TOKEN,
    ...overrides,
  };
}

function resultRow(command, overrides = {}) {
  return {
    cut_id: 'cut-a',
    organization_id: command.organizationId,
    project_id: command.projectId,
    period_start: command.period.start,
    period_end: command.period.end,
    cut_version: 1,
    task_count: 3,
    measured_line_count: 2,
    missing_line_count: 1,
    snapshot_sha256: 'b'.repeat(64),
    sealed_by_membership_id: command.actorMembershipId,
    sealed_at: new Date('2026-09-01T12:00:00.000Z'),
    head_revision: 1,
    replayed: false,
    ...overrides,
  };
}

function measuredLine(taskId = 'task-a', overrides = {}) {
  return {
    state: 'MEASURED',
    snapshotToken: '1'.repeat(64),
    task: {
      id: taskId,
      code: 'A-01',
      title: 'Mampostería',
      revision: 3,
    },
    approvedMeasurement: {
      id: 'measurement-a',
      revision: 1,
      unit: 'M2',
      baselineQuantity: '100.0000',
      executedQuantity: '12.5000',
      cumulativeQuantity: '12.5000',
      method: 'DIMENSIONAL_CALCULATION',
      rationale: 'Cantidad técnica contrastada contra evidencia aprobada.',
      evidenceCount: 2,
      approvedAt: '2026-08-31T18:00:00.000Z',
    },
    ...overrides,
  };
}

function missingLine(taskId = 'task-b', overrides = {}) {
  return {
    state: 'MISSING',
    snapshotToken: '2'.repeat(64),
    task: {
      id: taskId,
      code: 'A-02',
      title: 'Revoques',
      revision: 1,
    },
    approvedMeasurement: null,
    ...overrides,
  };
}

function readRow(overrides = {}) {
  return {
    organization_id: SCOPE.organizationId,
    project_id: SCOPE.projectId,
    project_name: 'Torre Centro',
    project_status: 'ACTIVE',
    time_zone: 'America/Argentina/Buenos_Aires',
    tenant_today: '2026-09-01',
    period_start: '2026-08-16',
    period_end: '2026-08-31',
    head_current_cut_id: null,
    head_revision: 0,
    candidate_sha256: CANDIDATE_TOKEN,
    task_count: 2,
    measured_line_count: 1,
    missing_line_count: 1,
    review_pending: false,
    actor_can_seal: true,
    readiness: 'READY',
    candidate_lines: [measuredLine(), missingLine()],
    current_cut: null,
    ...overrides,
  };
}

function currentCut(overrides = {}) {
  return {
    id: 'cut-a',
    previousCutId: null,
    version: 1,
    taskCount: 2,
    measuredLineCount: 1,
    missingLineCount: 1,
    candidateToken: '3'.repeat(64),
    integrityDigest: '4'.repeat(64),
    sealedAt: '2026-09-01T12:00:00.000Z',
    sealedByLabel: 'Directora de obra',
    sealedByIsCurrentActor: true,
    lines: [measuredLine(), missingLine()],
    ...overrides,
  };
}

test('GET query accepts one required periodDate and rejects tenant scope or duplicates', () => {
  const normalized = normalizeProgressMeasurementCutQuery(new Request(
    'https://example.test/api/progress-measurement-cuts?periodDate=2026-08-20',
  ));
  assert.deepEqual(normalized.period, {
    key: '2026-08-16/2026-08-31',
    start: '2026-08-16',
    end: '2026-08-31',
    label: '16-31/08/2026',
  });
  for (const url of [
    'https://example.test/api/progress-measurement-cuts',
    'https://example.test/api/progress-measurement-cuts?periodDate=2026-08-20&projectId=attacker',
    'https://example.test/api/progress-measurement-cuts?periodDate=2026-08-20&periodDate=2026-08-21',
  ]) {
    assert.throws(
      () => normalizeProgressMeasurementCutQuery(new Request(url)),
      (error) => error.code === 'PROGRESS_MEASUREMENT_CUT_QUERY_INVALID',
    );
  }
});

test('GET serializes the authoritative DB candidate with explicit MISSING and closed-period readiness', async () => {
  let command;
  const snapshot = await readProgressMeasurementCutSnapshot(null, {
    scope: SCOPE,
    actorMembershipId: ACTOR,
    query: normalizeProgressMeasurementCutQuery(new URLSearchParams({
      periodDate: '2026-08-20',
    })),
  }, {
    readAdapter: {
      async read(value) {
        command = value;
        return [readRow()];
      },
    },
  });
  assert.equal(command.actorMembershipId, ACTOR);
  assert.equal(snapshot.readiness.state, 'READY');
  assert.equal(snapshot.readiness.canSeal, true);
  assert.equal(snapshot.readiness.candidateReady, true);
  assert.equal(snapshot.readiness.periodClosed, true);
  assert.equal(snapshot.readiness.missingLineCount, 1);
  assert.equal(snapshot.candidate.expectedHeadCutId, null);
  assert.equal(snapshot.candidate.token, CANDIDATE_TOKEN);
  assert.equal(snapshot.candidate.lines[0].snapshotToken, '1'.repeat(64));
  assert.equal(snapshot.candidate.lines[0].approvedMeasurement.executedQuantity, '12.5000');
  assert.deepEqual(snapshot.candidate.lines[1], {
    state: 'MISSING',
    snapshotToken: '2'.repeat(64),
    task: { id: 'task-b', code: 'A-02', title: 'Revoques', revision: 1 },
    approvedMeasurement: null,
  });
  assert.equal(snapshot.latestCut, null);
  assert.equal(snapshot.executionAllowed, false);
  assert.equal(JSON.stringify(snapshot).includes(ACTOR), false);
});

test('GET marks a corrected composition STALE and keeps the prior cut immutable', async () => {
  const oldCut = currentCut();
  const snapshot = await readProgressMeasurementCutSnapshot(null, {
    scope: SCOPE,
    actorMembershipId: ACTOR,
    query: normalizeProgressMeasurementCutQuery(new URLSearchParams({
      periodDate: '2026-08-20',
    })),
  }, {
    readAdapter: {
      read: async () => [readRow({
        head_current_cut_id: oldCut.id,
        head_revision: 1,
        readiness: 'STALE',
        current_cut: oldCut,
      })],
    },
  });
  assert.equal(snapshot.readiness.state, 'STALE');
  assert.equal(snapshot.readiness.canSeal, true);
  assert.equal(snapshot.latestCut.stale, true);
  assert.equal(snapshot.latestCut.candidateToken, '3'.repeat(64));
  assert.equal(snapshot.latestCut.previousCutId, null);
  assert.equal(snapshot.latestCut.lines[1].approvedMeasurement, null);
  assert.deepEqual(snapshot.head, { currentCutId: 'cut-a', revision: 1 });
});

test('GET fails seal readiness closed for open periods and archived projects', async () => {
  for (const [overrides, blockingReason] of [
    [{ tenant_today: '2026-08-31' }, 'PERIOD_OPEN'],
    [{ project_status: 'ARCHIVED' }, 'PROJECT_ARCHIVED'],
  ]) {
    const snapshot = await readProgressMeasurementCutSnapshot(null, {
      scope: SCOPE,
      actorMembershipId: ACTOR,
      query: normalizeProgressMeasurementCutQuery(new URLSearchParams({
        periodDate: '2026-08-20',
      })),
    }, { readAdapter: { read: async () => [readRow(overrides)] } });
    assert.equal(snapshot.readiness.state, 'READY');
    assert.equal(snapshot.readiness.canSeal, false);
    assert.equal(snapshot.readiness.candidateReady, false);
    assert.equal(snapshot.readiness.blockingReason, blockingReason);
  }
});

test('GET preserves DB readiness precedence for pending, empty and up-to-date sources', async () => {
  const oldCut = currentCut();
  const cases = [
    [readRow({ review_pending: true, readiness: 'REVIEW_PENDING' }), 'REVIEW_PENDING'],
    [readRow({
      task_count: 1,
      measured_line_count: 0,
      missing_line_count: 1,
      candidate_lines: [missingLine()],
      readiness: 'EMPTY',
    }), 'NO_APPROVED_MEASUREMENTS'],
    [readRow({
      head_current_cut_id: oldCut.id,
      head_revision: 1,
      candidate_sha256: oldCut.candidateToken,
      readiness: 'UP_TO_DATE',
      current_cut: oldCut,
    }), 'CUT_UNCHANGED'],
  ];
  for (const [raw, blocker] of cases) {
    const snapshot = await readProgressMeasurementCutSnapshot(null, {
      scope: SCOPE,
      actorMembershipId: ACTOR,
      query: normalizeProgressMeasurementCutQuery(new URLSearchParams({
        periodDate: '2026-08-20',
      })),
    }, { readAdapter: { read: async () => [raw] } });
    assert.equal(snapshot.readiness.canSeal, false);
    assert.equal(snapshot.readiness.candidateReady, false);
    assert.equal(snapshot.readiness.blockingReason, blocker);
  }
});

test('GET never advertises seal authority to read-only roles', async () => {
  const snapshot = await readProgressMeasurementCutSnapshot(null, {
    scope: SCOPE,
    actorMembershipId: 'membership-auditor',
    query: normalizeProgressMeasurementCutQuery(new URLSearchParams({
      periodDate: '2026-08-20',
    })),
  }, { readAdapter: { read: async () => [readRow({ actor_can_seal: false })] } });
  assert.equal(snapshot.readiness.state, 'READY');
  assert.equal(snapshot.readiness.candidateReady, true);
  assert.equal(snapshot.readiness.canSeal, false);
  assert.equal(snapshot.readiness.blockingReason, 'PERMISSION_REQUIRED');
});

test('GET rejects DB readiness drift, duplicate/out-of-order task lines and corrupt counts', async () => {
  const badRows = [
    readRow({ readiness: 'UP_TO_DATE' }),
    readRow({ candidate_lines: [missingLine('task-b'), measuredLine('task-a')] }),
    readRow({ candidate_lines: [measuredLine(), missingLine('task-a')] }),
    readRow({ candidate_lines: [measuredLine('task-a', { snapshotToken: 'invalid' }), missingLine()] }),
    readRow({
      candidate_lines: [
        measuredLine(),
        missingLine('task-b', { snapshotToken: '1'.repeat(64) }),
      ],
    }),
    readRow({ missing_line_count: 2 }),
  ];
  for (const raw of badRows) {
    await assert.rejects(
      () => readProgressMeasurementCutSnapshot(null, {
        scope: SCOPE,
        actorMembershipId: ACTOR,
        query: normalizeProgressMeasurementCutQuery(new URLSearchParams({
          periodDate: '2026-08-20',
        })),
      }, { readAdapter: { read: async () => [raw] } }),
      (error) => error.code === 'PROGRESS_MEASUREMENT_CUT_CONTRACT_INVALID',
    );
  }
});

test('default GET adapter uses one authoritative helper statement inside repeatable-read', async () => {
  const calls = [];
  let isolationLevel = null;
  const adapter = createProgressMeasurementCutReadAdapter({
    async $transaction(callback, options) {
      isolationLevel = options.isolationLevel;
      return callback({
        async $queryRawUnsafe(sql, ...values) {
          calls.push({ sql, values });
          return [];
        },
      });
    },
  });
  await adapter.read({
    ...SCOPE,
    actorMembershipId: ACTOR,
    period: { start: '2026-08-16', end: '2026-08-31' },
  });
  assert.equal(isolationLevel, 'RepeatableRead');
  assert.match(calls[0].sql, /obrasaas_progress_measurement_cut_read/);
  assert.deepEqual(calls[0].values, [
    SCOPE.organizationId,
    SCOPE.projectId,
    '2026-08-16',
    '2026-08-31',
    ACTOR,
  ]);
});

test('seal input is strict and requires both head and candidate CAS from GET', () => {
  const normalized = normalizeProgressMeasurementCutSeal(
    sealInput(),
    'measurement-cut-operation-0001',
  );
  assert.equal(normalized.expectedHeadCutId, null);
  assert.equal(normalized.expectedCandidateToken, CANDIDATE_TOKEN);
  assert.equal(Object.hasOwn(normalized, 'taskIds'), false);
  assert.throws(
    () => normalizeProgressMeasurementCutSeal(
      sealInput({ approvedMeasurementIds: ['measurement-a'] }),
      'measurement-cut-operation-0001',
    ),
    /no está permitido/,
  );
  assert.throws(
    () => normalizeProgressMeasurementCutSeal(
      sealInput({ expectedCandidateToken: 'A'.repeat(64) }),
      'measurement-cut-operation-0001',
    ),
    (error) => error.code === 'PROGRESS_MEASUREMENT_CUT_CANDIDATE_TOKEN_INVALID',
  );
  assert.throws(
    () => normalizeProgressMeasurementCutSeal(
      sealInput({ expectedCandidateToken: 'not-a-token' }),
      'measurement-cut-operation-0001',
    ),
    (error) => error.code === 'PROGRESS_MEASUREMENT_CUT_CANDIDATE_TOKEN_INVALID',
  );
});

test('seal binds tenant, actor, period and dual CAS then emits an allowlisted receipt', async () => {
  let command;
  const result = await sealProgressMeasurementCut(null, {
    scope: SCOPE,
    actorMembershipId: ACTOR,
    operationKey: 'measurement-cut-operation-0001',
    input: sealInput(),
  }, {
    sqlAdapter: {
      async seal(value) {
        command = value;
        return [resultRow(value)];
      },
    },
  });
  assert.equal(command.organizationId, SCOPE.organizationId);
  assert.equal(command.projectId, SCOPE.projectId);
  assert.equal(command.actorMembershipId, ACTOR);
  assert.equal(command.expectedCandidateToken, CANDIDATE_TOKEN);
  assert.match(command.requestFingerprint, /^[a-f0-9]{64}$/);
  assert.deepEqual(result, {
    cut: {
      id: 'cut-a',
      previousCutId: null,
      version: 1,
      period: {
        key: '2026-08-16/2026-08-31',
        start: '2026-08-16',
        end: '2026-08-31',
        label: '16-31/08/2026',
      },
      taskCount: 3,
      measuredLineCount: 2,
      missingLineCount: 1,
      candidateToken: CANDIDATE_TOKEN,
      integrity: { algorithm: 'SHA-256', digest: 'b'.repeat(64) },
      sealedAt: '2026-09-01T12:00:00.000Z',
      sealedBy: { label: null, isCurrentActor: true },
    },
    head: { currentCutId: 'cut-a', revision: 1 },
    executionAllowed: false,
    replayed: false,
  });
  assert.equal(JSON.stringify(result).includes(ACTOR), false);
  assert.equal(JSON.stringify(result).includes(command.requestFingerprint), false);
});

test('fingerprint excludes operation key but binds head, candidate, tenant and actor', async () => {
  const commands = [];
  async function run({ scope = SCOPE, actor = ACTOR, operationKey, input = sealInput() }) {
    return sealProgressMeasurementCut(null, {
      scope,
      actorMembershipId: actor,
      operationKey,
      input,
    }, {
      sqlAdapter: {
        async seal(command) {
          commands.push(command);
          return [resultRow(command)];
        },
      },
    });
  }
  await run({ operationKey: 'measurement-cut-operation-0001' });
  await run({ operationKey: 'measurement-cut-operation-0002' });
  await run({
    operationKey: 'measurement-cut-operation-0003',
    input: sealInput({ expectedCandidateToken: 'c'.repeat(64) }),
  });
  await run({
    operationKey: 'measurement-cut-operation-0004',
    input: sealInput({ expectedHeadCutId: 'cut-prior' }),
  });
  await run({ operationKey: 'measurement-cut-operation-0005', actor: 'membership-admin' });
  assert.equal(commands[0].requestFingerprint, commands[1].requestFingerprint);
  assert.notEqual(commands[0].requestFingerprint, commands[2].requestFingerprint);
  assert.notEqual(commands[0].requestFingerprint, commands[3].requestFingerprint);
  assert.notEqual(commands[0].requestFingerprint, commands[4].requestFingerprint);
});

test('SQL adapter preserves the frozen nine-argument function signature', async () => {
  const calls = [];
  const adapter = createProgressMeasurementCutSqlAdapter({
    async $queryRawUnsafe(sql, ...values) {
      calls.push({ sql, values });
      return [];
    },
  });
  await adapter.seal({
    ...SCOPE,
    actorMembershipId: ACTOR,
    period: {
      start: '2026-08-16',
      end: '2026-08-31',
    },
    expectedHeadCutId: 'cut-prior',
    expectedCandidateToken: CANDIDATE_TOKEN,
    operationKey: 'measurement-cut-operation-0001',
    requestFingerprint: 'd'.repeat(64),
  });
  assert.match(calls[0].sql, /obrasaas_progress_measurement_cut_seal/);
  assert.equal(calls[0].values.length, 9);
  assert.equal(calls[0].values[4], 'cut-prior');
  assert.equal(calls[0].values[5], CANDIDATE_TOKEN);
  assert.equal(calls[0].values[8], ACTOR);
});

test('membership is required before storage and SQL results fail closed', async () => {
  let sealCalls = 0;
  await assert.rejects(
    () => sealProgressMeasurementCut(null, {
      scope: SCOPE,
      actorMembershipId: null,
      operationKey: 'measurement-cut-operation-0001',
      input: sealInput(),
    }, { sqlAdapter: { seal: async () => { sealCalls += 1; } } }),
    (error) => error.code === 'TENANT_MEMBERSHIP_REQUIRED' && error.status === 403,
  );
  assert.equal(sealCalls, 0);

  await assert.rejects(
    () => sealProgressMeasurementCut(null, {
      scope: SCOPE,
      actorMembershipId: ACTOR,
      operationKey: 'measurement-cut-operation-0001',
      input: sealInput(),
    }, { sqlAdapter: { seal: async () => [{ cut_id: 'partial' }] } }),
    (error) => error.code === 'PROGRESS_MEASUREMENT_CUT_CONTRACT_INVALID',
  );
});

test('database errors are allowlisted and secrets are redacted', async () => {
  const cases = [
    ['PROGRESS_MEASUREMENT_CUT_HEAD_STALE', 'PROGRESS_MEASUREMENT_CUT_HEAD_STALE'],
    ['PROGRESS_MEASUREMENT_CUT_CANDIDATE_STALE', 'PROGRESS_MEASUREMENT_CUT_CANDIDATE_STALE'],
    ['PROGRESS_MEASUREMENT_CUT_NO_CHANGE', 'PROGRESS_MEASUREMENT_CUT_UNCHANGED'],
    ['PROGRESS_MEASUREMENT_CUT_UNCHANGED', 'PROGRESS_MEASUREMENT_CUT_UNCHANGED'],
    ['IDEMPOTENCY_REPLAY_MUTATED', 'PROGRESS_MEASUREMENT_CUT_IDEMPOTENCY_CONFLICT'],
  ];
  for (const [marker, code] of cases) {
    await assert.rejects(
      () => sealProgressMeasurementCut(null, {
        scope: SCOPE,
        actorMembershipId: ACTOR,
        operationKey: 'measurement-cut-operation-0001',
        input: sealInput(),
      }, {
        sqlAdapter: {
          seal: async () => { throw new Error(`postgres://private ${marker}`); },
        },
      }),
      (error) => error instanceof ProgressMeasurementCutError
        && error.code === code
        && error.status === 409
        && !error.message.includes('private'),
    );
  }
});
