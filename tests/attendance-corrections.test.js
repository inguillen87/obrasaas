import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AttendanceCorrectionError,
  decideAttendanceCorrection,
  hashEffectiveAttendanceEvents,
  normalizeEffectiveAttendanceEvents,
  requestAttendanceCorrection,
  serializeAttendanceCorrection,
} from '../src/lib/attendance-corrections.js';

const NOW = new Date('2026-07-24T15:00:00.000Z');
const scope = Object.freeze({
  organizationId: 'organization-a',
  projectId: 'project-a',
});

function ledgerEvents() {
  return [
    {
      logicalId: 'entry-check-in',
      eventType: 'CHECK_IN',
      occurredAt: '2026-07-24T11:00:00.000Z',
    },
    {
      logicalId: 'entry-check-out',
      eventType: 'CHECK_OUT',
      occurredAt: '2026-07-24T20:00:00.000Z',
    },
  ];
}

function proposedEvents() {
  return [
    ledgerEvents()[0],
    {
      logicalId: 'entry-check-out',
      eventType: 'CHECK_OUT',
      occurredAt: '2026-07-24T20:15:00.000Z',
    },
  ];
}

function uniqueError(target = ['idempotencyKey']) {
  const error = new Error('Unique constraint failed');
  error.code = 'P2002';
  error.meta = { target };
  return error;
}

function initialDatabase() {
  return {
    projects: [{
      id: scope.projectId,
      organizationId: scope.organizationId,
      status: 'ACTIVE',
    }],
    tenantMemberships: [
      {
        id: 'membership-manager',
        organizationId: scope.organizationId,
        userId: 'platform-manager',
        tenantRole: 'SITE_MANAGER',
        status: 'ACTIVE',
      },
      {
        id: 'membership-director',
        organizationId: scope.organizationId,
        userId: 'platform-director',
        tenantRole: 'DIRECTOR',
        status: 'ACTIVE',
      },
      {
        id: 'membership-admin',
        organizationId: scope.organizationId,
        userId: 'platform-admin',
        tenantRole: 'ADMIN',
        status: 'ACTIVE',
      },
      {
        id: 'membership-auditor',
        organizationId: scope.organizationId,
        userId: 'platform-auditor',
        tenantRole: 'AUDITOR',
        status: 'ACTIVE',
      },
    ],
    projectMemberships: [{
      id: 'project-membership-manager',
      projectId: scope.projectId,
      tenantMembershipId: 'membership-manager',
      status: 'ACTIVE',
    }],
    workers: [{
      id: 'worker-a',
      projectId: scope.projectId,
      active: true,
    }],
    shifts: [{
      id: 'shift-a',
      projectId: scope.projectId,
      workerId: 'worker-a',
      expectationId: 'expectation-a',
      workDate: new Date('2026-07-24T00:00:00.000Z'),
      timezone: 'America/Argentina/Buenos_Aires',
      status: 'CLOSED',
      phase: 'WORKING',
      openedAt: new Date('2026-07-24T11:00:00.000Z'),
      closedAt: new Date('2026-07-24T20:00:00.000Z'),
      revision: 1,
    }],
    entries: [
      {
        id: 'entry-check-in',
        projectId: scope.projectId,
        workerId: 'worker-a',
        shiftId: 'shift-a',
        eventType: 'CHECK_IN',
        verificationStatus: 'VERIFIED',
        occurredAt: new Date('2026-07-24T11:00:00.000Z'),
        sequence: 1,
        latitude: -34.6037,
        longitude: -58.3816,
        evidence: { private: true },
      },
      {
        id: 'entry-check-out',
        projectId: scope.projectId,
        workerId: 'worker-a',
        shiftId: 'shift-a',
        eventType: 'CHECK_OUT',
        verificationStatus: 'VERIFIED',
        occurredAt: new Date('2026-07-24T20:00:00.000Z'),
        sequence: 2,
        latitude: -34.6037,
        longitude: -58.3816,
        evidence: { private: true },
      },
    ],
    requests: [],
    decisions: [],
    adjustments: [],
    audits: [],
    counters: { request: 0, decision: 0, adjustment: 0, audit: 0 },
  };
}

function matches(candidate, where = {}) {
  return Object.entries(where).every(([field, expected]) => {
    if (field === 'project' || field === 'correctionRequest') return true;
    const actual = candidate[field];
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      if (Array.isArray(expected.notIn)) return !expected.notIn.includes(actual);
      if (Object.hasOwn(expected, 'gt')) return Number(actual) > Number(expected.gt);
      return true;
    }
    return actual === expected;
  });
}

function createFakePrisma(seed = initialDatabase()) {
  let database = structuredClone(seed);
  const calls = [];
  const controls = {
    failAuditAction: null,
    injectDecisionRace: null,
  };

  function hydrateRequest(target, row) {
    if (!row) return null;
    return {
      ...structuredClone(row),
      decision: structuredClone(
        target.decisions.find((decision) => decision.requestId === row.id) || null,
      ),
      adjustment: structuredClone(
        target.adjustments.find((adjustment) => adjustment.correctionRequestId === row.id) || null,
      ),
    };
  }

  function makeClient(getTarget, { transaction = false } = {}) {
    const client = {
      async $executeRawUnsafe(query, projectId) {
        calls.push(['lock', query, projectId]);
        return 1;
      },
      project: {
        async findFirst({ where }) {
          const target = getTarget();
          calls.push(['project', where.id]);
          return structuredClone(target.projects.find((project) => (
            project.id === where.id
            && project.organizationId === where.organizationId
          )) || null);
        },
      },
      tenantMembership: {
        async findFirst({ where }) {
          const target = getTarget();
          return structuredClone(target.tenantMemberships.find((membership) => (
            membership.organizationId === where.organizationId
            && membership.userId === where.userId
            && membership.status === where.status
          )) || null);
        },
      },
      projectMembership: {
        async findFirst({ where }) {
          const target = getTarget();
          return structuredClone(target.projectMemberships.find((membership) => (
            membership.projectId === where.projectId
            && membership.tenantMembershipId === where.tenantMembershipId
            && membership.status === where.status
          )) || null);
        },
      },
      worker: {
        async findFirst({ where }) {
          const target = getTarget();
          const project = target.projects.find((item) => item.id === where.projectId);
          if (project?.organizationId !== where.project?.organizationId) return null;
          return structuredClone(target.workers.find((worker) => (
            worker.id === where.id
            && worker.projectId === where.projectId
            && worker.active === where.active
          )) || null);
        },
      },
      attendanceShift: {
        async findFirst({ where }) {
          const target = getTarget();
          const project = target.projects.find((item) => item.id === where.projectId);
          if (project?.organizationId !== where.project?.organizationId) return null;
          return structuredClone(target.shifts.find((shift) => matches(shift, where)) || null);
        },
        async updateMany({ where, data }) {
          const target = getTarget();
          const shift = target.shifts.find((candidate) => matches(candidate, where));
          if (!shift) return { count: 0 };
          for (const [field, value] of Object.entries(data)) {
            if (field === 'revision' && value && typeof value === 'object') {
              shift.revision += Number(value.increment || 0);
            } else {
              shift[field] = structuredClone(value);
            }
          }
          return { count: 1 };
        },
      },
      attendanceEntry: {
        async findMany({ where }) {
          const target = getTarget();
          return structuredClone(target.entries.filter((entry) => matches(entry, where)));
        },
        async findFirst({ where }) {
          const target = getTarget();
          return structuredClone(target.entries.find((entry) => matches(entry, where)) || null);
        },
      },
      attendanceCorrectionRequest: {
        async findUnique({ where }) {
          const target = getTarget();
          const row = target.requests.find((request) => (
            (where.idempotencyKey && request.idempotencyKey === where.idempotencyKey)
            || (where.id && request.id === where.id)
          ));
          return hydrateRequest(target, row);
        },
        async findFirst({ where }) {
          const target = getTarget();
          const project = target.projects.find((item) => item.id === where.projectId);
          if (project?.organizationId !== where.project?.organizationId) return null;
          return hydrateRequest(target, target.requests.find((request) => matches(request, where)));
        },
        async create({ data }) {
          const target = getTarget();
          if (target.requests.some((request) => request.idempotencyKey === data.idempotencyKey)) {
            throw uniqueError();
          }
          target.counters.request += 1;
          const row = { id: `correction-${target.counters.request}`, ...structuredClone(data) };
          target.requests.push(row);
          return structuredClone(row);
        },
      },
      attendanceCorrectionDecision: {
        async findUnique({ where }) {
          const target = getTarget();
          return structuredClone(target.decisions.find((decision) => (
            (where.idempotencyKey && decision.idempotencyKey === where.idempotencyKey)
            || (where.id && decision.id === where.id)
          )) || null);
        },
        async create({ data }) {
          const target = getTarget();
          if (transaction && controls.injectDecisionRace) {
            const concurrent = structuredClone(controls.injectDecisionRace);
            controls.injectDecisionRace = null;
            database.decisions.push(concurrent);
            throw uniqueError(['requestId']);
          }
          if (
            target.decisions.some((decision) => (
              decision.requestId === data.requestId
              || decision.idempotencyKey === data.idempotencyKey
            ))
          ) {
            throw uniqueError(['requestId']);
          }
          target.counters.decision += 1;
          const row = { id: `decision-${target.counters.decision}`, ...structuredClone(data) };
          target.decisions.push(row);
          return structuredClone(row);
        },
      },
      attendanceAdjustment: {
        async findFirst({ where }) {
          const target = getTarget();
          const requestScope = where.correctionRequest?.is || {};
          const rows = target.adjustments.filter((adjustment) => {
            const request = target.requests.find((item) => (
              item.id === adjustment.correctionRequestId
            ));
            return request && matches(request, requestScope);
          }).sort((left, right) => (
            right.appliedShiftRevision - left.appliedShiftRevision
            || new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
            || String(right.id).localeCompare(String(left.id))
          ));
          return structuredClone(rows[0] || null);
        },
        async create({ data }) {
          const target = getTarget();
          if (target.adjustments.some((item) => (
            item.correctionRequestId === data.correctionRequestId
          ))) {
            throw uniqueError(['correctionRequestId']);
          }
          target.counters.adjustment += 1;
          const row = { id: `adjustment-${target.counters.adjustment}`, ...structuredClone(data) };
          target.adjustments.push(row);
          return structuredClone(row);
        },
      },
      auditLog: {
        async create({ data }) {
          const target = getTarget();
          if (controls.failAuditAction === data.action) {
            throw new Error(`audit failed for ${data.action}`);
          }
          target.counters.audit += 1;
          const row = { id: `audit-${target.counters.audit}`, ...structuredClone(data) };
          target.audits.push(row);
          return structuredClone(row);
        },
      },
    };
    return client;
  }

  const prisma = makeClient(() => database);
  prisma.$transaction = async (callback, options) => {
    calls.push(['transaction', options]);
    const draft = structuredClone(database);
    const transaction = makeClient(() => draft, { transaction: true });
    const result = await callback(transaction);
    database = draft;
    return result;
  };

  return {
    prisma,
    calls,
    controls,
    snapshot: () => structuredClone(database),
    mutate: (operation) => operation(database),
  };
}

function requestInput(overrides = {}) {
  return {
    scope,
    workerId: 'worker-a',
    shiftId: 'shift-a',
    expectationId: 'expectation-a',
    baseShiftRevision: 1,
    baseEffectiveHash: hashEffectiveAttendanceEvents(ledgerEvents()),
    proposedEvents: proposedEvents(),
    reasonCode: 'MISSED_CHECK_OUT',
    note: 'El capataz confirm\u00f3 la hora correcta.',
    requestedByPlatformUserId: 'platform-manager',
    idempotencyKey: 'request-correction-0001',
    now: NOW,
    ...overrides,
  };
}

function decisionInput(requestId, overrides = {}) {
  return {
    scope,
    requestId,
    decidedById: 'platform-director',
    decision: 'APPROVED',
    reasonCode: 'SUPERVISOR_VERIFIED',
    note: 'Validado contra el parte diario.',
    idempotencyKey: 'decision-correction-0001',
    now: new Date('2026-07-24T16:00:00.000Z'),
    ...overrides,
  };
}

async function expectCorrectionError(operation, code) {
  await assert.rejects(operation, (error) => (
    error instanceof AttendanceCorrectionError
    && error.code === code
  ));
}

test('normalizes a complete effective sequence to a strict location-free canonical shape', () => {
  const input = [
    {
      occurredAt: '2026-07-24T08:00:00-03:00',
      eventType: ' check_in ',
      logicalId: ' original:check-in ',
    },
    {
      logicalId: 'manual:break-start',
      eventType: 'BREAK_START',
      occurredAt: '2026-07-24T12:00:00-03:00',
    },
    {
      logicalId: 'manual:break-end',
      eventType: 'BREAK_END',
      occurredAt: '2026-07-24T12:30:00-03:00',
    },
    {
      logicalId: 'original:check-out',
      eventType: 'CHECK_OUT',
      occurredAt: new Date('2026-07-24T20:00:00.000Z'),
    },
  ];

  assert.deepEqual(normalizeEffectiveAttendanceEvents(input), [
    {
      logicalId: 'original:check-in',
      eventType: 'CHECK_IN',
      occurredAt: '2026-07-24T11:00:00.000Z',
    },
    {
      logicalId: 'manual:break-start',
      eventType: 'BREAK_START',
      occurredAt: '2026-07-24T15:00:00.000Z',
    },
    {
      logicalId: 'manual:break-end',
      eventType: 'BREAK_END',
      occurredAt: '2026-07-24T15:30:00.000Z',
    },
    {
      logicalId: 'original:check-out',
      eventType: 'CHECK_OUT',
      occurredAt: '2026-07-24T20:00:00.000Z',
    },
  ]);
  assert.equal(input[0].eventType, ' check_in ');
});

test('rejects oversized, ambiguous, unbalanced, non-monotonic and sensitive sequences', () => {
  const tooMany = Array.from({ length: 65 }, (_, index) => ({
    logicalId: `event-${index}`,
    eventType: index === 0 ? 'CHECK_IN' : 'BREAK_START',
    occurredAt: new Date(NOW.getTime() + index).toISOString(),
  }));
  const invalidCases = [
    [tooMany, 'ATTENDANCE_CORRECTION_EVENTS_INVALID'],
    [Array(1), 'ATTENDANCE_CORRECTION_EVENTS_INVALID'],
    [[ledgerEvents()[0], { ...ledgerEvents()[1], logicalId: 'entry-check-in' }], 'ATTENDANCE_CORRECTION_LOGICAL_ID_DUPLICATE'],
    [[ledgerEvents()[0], { logicalId: 'second-in', eventType: 'CHECK_IN', occurredAt: '2026-07-24T12:00:00Z' }], 'ATTENDANCE_CORRECTION_CHECK_IN_INVALID'],
    [[ledgerEvents()[0], { logicalId: 'break', eventType: 'BREAK_START', occurredAt: '2026-07-24T12:00:00Z' }], 'ATTENDANCE_CORRECTION_BREAKS_UNBALANCED'],
    [[ledgerEvents()[0], { logicalId: 'break-end', eventType: 'BREAK_END', occurredAt: '2026-07-24T12:00:00Z' }], 'ATTENDANCE_CORRECTION_BREAKS_UNBALANCED'],
    [[ledgerEvents()[0], { ...ledgerEvents()[1], occurredAt: '2026-07-24T10:00:00Z' }], 'ATTENDANCE_CORRECTION_TIME_NOT_MONOTONIC'],
    [[{ ...ledgerEvents()[0], evidence: { photo: true } }], 'ATTENDANCE_CORRECTION_SENSITIVE_FIELDS_FORBIDDEN'],
    [[{ ...ledgerEvents()[0], latitude: -34.6 }], 'ATTENDANCE_CORRECTION_SENSITIVE_FIELDS_FORBIDDEN'],
    [[{ ...ledgerEvents()[0], source: 'dashboard' }], 'ATTENDANCE_CORRECTION_EVENTS_INVALID'],
  ];
  for (const [events, code] of invalidCases) {
    assert.throws(
      () => normalizeEffectiveAttendanceEvents(events),
      (error) => error instanceof AttendanceCorrectionError && error.code === code,
    );
  }
});

test('builds one domain-separated canonical hash for equivalent timestamps', () => {
  const utc = ledgerEvents();
  const offset = [
    { logicalId: 'entry-check-in', eventType: 'check_in', occurredAt: '2026-07-24T08:00:00-03:00' },
    { logicalId: 'entry-check-out', eventType: 'check_out', occurredAt: '2026-07-24T17:00:00-03:00' },
  ];
  assert.equal(hashEffectiveAttendanceEvents(utc), hashEffectiveAttendanceEvents(offset));
  assert.match(hashEffectiveAttendanceEvents(utc), /^[a-f0-9]{64}$/);
});

test('requests under exact scope and replays only the identical idempotent operation', async () => {
  const fake = createFakePrisma();
  const created = await requestAttendanceCorrection(fake.prisma, requestInput());

  assert.equal(created.status, 'PENDING');
  assert.equal(created.replayed, false);
  assert.equal(created.hasNote, true);
  assert.equal(Object.hasOwn(created, 'note'), false);
  assert.equal(Object.hasOwn(created, 'idempotencyKey'), false);
  assert.equal(Object.hasOwn(created, 'requestFingerprint'), false);
  assert.deepEqual(Object.keys(created.proposedEvents[0]), ['logicalId', 'eventType', 'occurredAt']);
  assert.equal(fake.snapshot().requests.length, 1);
  assert.equal(fake.snapshot().audits[0].action, 'attendance.correction.requested');
  assert.equal(fake.calls.filter(([name]) => name === 'lock').length, 1);

  const replay = await requestAttendanceCorrection(fake.prisma, requestInput({
    now: new Date('2026-07-24T15:05:00.000Z'),
  }));
  assert.equal(replay.id, created.id);
  assert.equal(replay.replayed, true);
  assert.equal(fake.snapshot().requests.length, 1);
  assert.equal(fake.snapshot().audits.length, 1);

  await expectCorrectionError(
    () => requestAttendanceCorrection(fake.prisma, requestInput({ reasonCode: 'OTHER_REASON' })),
    'ATTENDANCE_CORRECTION_IDEMPOTENCY_CONFLICT',
  );
});

test('requires exactly one requester and confines a worker requester to their own shift', async () => {
  const fake = createFakePrisma();
  await expectCorrectionError(
    () => requestAttendanceCorrection(fake.prisma, requestInput({
      requestedByPlatformUserId: null,
      requestedByWorkerId: null,
    })),
    'ATTENDANCE_CORRECTION_ACTOR_INVALID',
  );
  await expectCorrectionError(
    () => requestAttendanceCorrection(fake.prisma, requestInput({
      requestedByWorkerId: 'worker-a',
    })),
    'ATTENDANCE_CORRECTION_ACTOR_INVALID',
  );
  await expectCorrectionError(
    () => requestAttendanceCorrection(fake.prisma, requestInput({
      requestedByPlatformUserId: null,
      requestedByWorkerId: 'worker-b',
    })),
    'ATTENDANCE_CORRECTION_ACTOR_SCOPE_INVALID',
  );
});

test('approval atomically writes decision, immutable adjustment and audit while preserving entries', async () => {
  const fake = createFakePrisma();
  const request = await requestAttendanceCorrection(fake.prisma, requestInput());
  const entriesBefore = fake.snapshot().entries;

  const approved = await decideAttendanceCorrection(
    fake.prisma,
    decisionInput(request.id),
  );
  const state = fake.snapshot();
  assert.equal(approved.status, 'APPROVED');
  assert.equal(approved.replayed, false);
  assert.equal(approved.adjustment.appliedShiftRevision, 2);
  assert.equal(state.shifts[0].revision, 2);
  assert.equal(state.shifts[0].status, 'CLOSED');
  assert.equal(state.shifts[0].closedAt.toISOString(), '2026-07-24T20:15:00.000Z');
  assert.equal(state.decisions.length, 1);
  assert.equal(state.adjustments.length, 1);
  assert.deepEqual(state.entries, entriesBefore);
  assert.deepEqual(
    state.audits.map((audit) => audit.action),
    [
      'attendance.correction.requested',
      'attendance.correction.approved',
      'attendance.adjustment.applied',
    ],
  );
  assert.equal(JSON.stringify(state.audits).includes('Validado contra'), false);
  assert.equal(JSON.stringify(state.audits).includes('latitude'), false);

  const replay = await decideAttendanceCorrection(
    fake.prisma,
    decisionInput(request.id, { now: new Date('2026-07-24T16:10:00.000Z') }),
  );
  assert.equal(replay.replayed, true);
  assert.equal(fake.snapshot().decisions.length, 1);
  assert.equal(fake.snapshot().adjustments.length, 1);

  await expectCorrectionError(
    () => decideAttendanceCorrection(fake.prisma, decisionInput(request.id, {
      idempotencyKey: 'decision-correction-0002',
    })),
    'ATTENDANCE_CORRECTION_ALREADY_DECIDED',
  );
});

test('rejection is terminal but does not change the shift or create an adjustment', async () => {
  const fake = createFakePrisma();
  const request = await requestAttendanceCorrection(fake.prisma, requestInput());
  const shiftBefore = fake.snapshot().shifts[0];

  const rejected = await decideAttendanceCorrection(fake.prisma, decisionInput(request.id, {
    decision: 'REJECTED',
    reasonCode: 'INSUFFICIENT_SUPPORT',
  }));
  const state = fake.snapshot();
  assert.equal(rejected.status, 'REJECTED');
  assert.deepEqual(state.shifts[0], shiftBefore);
  assert.equal(state.adjustments.length, 0);
  assert.equal(state.decisions.length, 1);
  assert.equal(state.audits.at(-1).action, 'attendance.correction.rejected');
});

test('a later request is based on the latest approved effective sequence, not rewritten entries', async () => {
  const fake = createFakePrisma();
  const firstRequest = await requestAttendanceCorrection(fake.prisma, requestInput());
  await decideAttendanceCorrection(fake.prisma, decisionInput(firstRequest.id));
  const entriesAfterFirstApproval = fake.snapshot().entries;
  const secondProposal = [
    proposedEvents()[0],
    {
      logicalId: 'entry-check-out',
      eventType: 'CHECK_OUT',
      occurredAt: '2026-07-24T20:30:00.000Z',
    },
  ];

  const secondRequest = await requestAttendanceCorrection(fake.prisma, requestInput({
    baseShiftRevision: 2,
    baseEffectiveHash: hashEffectiveAttendanceEvents(proposedEvents()),
    proposedEvents: secondProposal,
    idempotencyKey: 'request-correction-0002',
    now: new Date('2026-07-24T16:20:00.000Z'),
  }));
  const approved = await decideAttendanceCorrection(fake.prisma, decisionInput(secondRequest.id, {
    idempotencyKey: 'decision-correction-0002',
    now: new Date('2026-07-24T16:30:00.000Z'),
  }));

  assert.equal(approved.adjustment.appliedShiftRevision, 3);
  assert.equal(fake.snapshot().shifts[0].revision, 3);
  assert.equal(fake.snapshot().adjustments.length, 2);
  assert.deepEqual(fake.snapshot().entries, entriesAfterFirstApproval);
});

test('a physical event after an adjustment is merged once using the ledger sequence cut', async () => {
  const fake = createFakePrisma();
  const checkInOnly = [ledgerEvents()[0]];
  const firstRequest = await requestAttendanceCorrection(fake.prisma, requestInput({
    proposedEvents: checkInOnly,
  }));
  const firstApproval = await decideAttendanceCorrection(
    fake.prisma,
    decisionInput(firstRequest.id),
  );
  assert.equal(firstApproval.adjustment.baseLedgerSequence, 2);
  assert.equal(fake.snapshot().shifts[0].status, 'PENDING_CLOSE');

  fake.mutate((database) => {
    database.entries.push({
      id: 'entry-later-check-out',
      projectId: scope.projectId,
      workerId: 'worker-a',
      shiftId: 'shift-a',
      eventType: 'CHECK_OUT',
      verificationStatus: 'VERIFIED',
      occurredAt: new Date('2026-07-24T20:20:00.000Z'),
      sequence: 4,
    });
    database.shifts[0].revision = 3;
    database.shifts[0].status = 'CLOSED';
    database.shifts[0].closedAt = new Date('2026-07-24T20:20:00.000Z');
  });
  const mergedBase = [
    ledgerEvents()[0],
    {
      logicalId: 'entry-later-check-out',
      eventType: 'CHECK_OUT',
      occurredAt: '2026-07-24T20:20:00.000Z',
    },
  ];
  const proposal = [
    mergedBase[0],
    { ...mergedBase[1], occurredAt: '2026-07-24T20:25:00.000Z' },
  ];
  const secondRequest = await requestAttendanceCorrection(fake.prisma, requestInput({
    baseShiftRevision: 3,
    baseEffectiveHash: hashEffectiveAttendanceEvents(mergedBase),
    proposedEvents: proposal,
    idempotencyKey: 'request-correction-ledger-cut-0002',
    now: new Date('2026-07-24T16:20:00.000Z'),
  }));
  assert.deepEqual(secondRequest.proposedEvents, proposal);
  const secondApproval = await decideAttendanceCorrection(fake.prisma, decisionInput(
    secondRequest.id,
    {
      idempotencyKey: 'decision-correction-ledger-cut-0002',
      now: new Date('2026-07-24T16:30:00.000Z'),
    },
  ));
  assert.equal(secondApproval.adjustment.baseLedgerSequence, 4);
  assert.equal(secondApproval.adjustment.effectiveEvents.length, 2);
  assert.equal(
    secondApproval.adjustment.effectiveEvents.filter((event) => (
      event.logicalId === 'entry-later-check-out'
    )).length,
    1,
  );
});

test('approval forbids self-approval, expired requests and unauthorized decider roles', async () => {
  const selfFake = createFakePrisma();
  const selfRequest = await requestAttendanceCorrection(selfFake.prisma, requestInput({
    requestedByPlatformUserId: 'platform-director',
  }));
  await expectCorrectionError(
    () => decideAttendanceCorrection(selfFake.prisma, decisionInput(selfRequest.id)),
    'ATTENDANCE_CORRECTION_SELF_APPROVAL_FORBIDDEN',
  );
  assert.equal(selfFake.snapshot().decisions.length, 0);

  const expiredFake = createFakePrisma();
  const expiredRequest = await requestAttendanceCorrection(expiredFake.prisma, requestInput({
    expiresAt: new Date('2026-07-24T15:30:00.000Z'),
  }));
  await expectCorrectionError(
    () => decideAttendanceCorrection(expiredFake.prisma, decisionInput(expiredRequest.id, {
      now: new Date('2026-07-24T15:30:00.000Z'),
    })),
    'ATTENDANCE_CORRECTION_EXPIRED',
  );

  const roleFake = createFakePrisma();
  const roleRequest = await requestAttendanceCorrection(roleFake.prisma, requestInput());
  await expectCorrectionError(
    () => decideAttendanceCorrection(roleFake.prisma, decisionInput(roleRequest.id, {
      decidedById: 'platform-auditor',
    })),
    'ATTENDANCE_CORRECTION_FORBIDDEN',
  );
});

test('approval fails closed on stale revision or stale effective hash', async () => {
  const revisionFake = createFakePrisma();
  const revisionRequest = await requestAttendanceCorrection(revisionFake.prisma, requestInput());
  revisionFake.mutate((database) => { database.shifts[0].revision += 1; });
  await expectCorrectionError(
    () => decideAttendanceCorrection(revisionFake.prisma, decisionInput(revisionRequest.id)),
    'ATTENDANCE_CORRECTION_BASE_REVISION_STALE',
  );
  assert.equal(revisionFake.snapshot().decisions.length, 0);

  const hashFake = createFakePrisma();
  const hashRequest = await requestAttendanceCorrection(hashFake.prisma, requestInput());
  hashFake.mutate((database) => {
    database.entries[1].occurredAt = new Date('2026-07-24T20:01:00.000Z');
  });
  await expectCorrectionError(
    () => decideAttendanceCorrection(hashFake.prisma, decisionInput(hashRequest.id)),
    'ATTENDANCE_CORRECTION_BASE_HASH_STALE',
  );
  assert.equal(hashFake.snapshot().decisions.length, 0);
});

test('a downstream audit failure rolls back CAS, decision and adjustment together', async () => {
  const fake = createFakePrisma();
  const request = await requestAttendanceCorrection(fake.prisma, requestInput());
  const before = fake.snapshot();
  fake.controls.failAuditAction = 'attendance.adjustment.applied';

  await assert.rejects(
    () => decideAttendanceCorrection(fake.prisma, decisionInput(request.id)),
    /audit failed/,
  );
  const after = fake.snapshot();
  assert.deepEqual(after.shifts, before.shifts);
  assert.deepEqual(after.entries, before.entries);
  assert.equal(after.decisions.length, 0);
  assert.equal(after.adjustments.length, 0);
  assert.deepEqual(after.audits, before.audits);
});

test('a unique decision race produces one terminal result and never a second decision', async () => {
  const fake = createFakePrisma();
  const request = await requestAttendanceCorrection(fake.prisma, requestInput());
  fake.controls.injectDecisionRace = {
    id: 'decision-concurrent',
    requestId: request.id,
    decision: 'REJECTED',
    reasonCode: 'CONCURRENT_REVIEW',
    note: null,
    decidedById: 'platform-admin',
    idempotencyKey: 'attendance-correction-decision:v1:concurrent',
    requestFingerprint: 'a'.repeat(64),
    createdAt: new Date('2026-07-24T16:00:00.000Z'),
  };

  await expectCorrectionError(
    () => decideAttendanceCorrection(fake.prisma, decisionInput(request.id, {
      decision: 'REJECTED',
    })),
    'ATTENDANCE_CORRECTION_ALREADY_DECIDED',
  );
  assert.equal(fake.snapshot().decisions.length, 1);
  assert.equal(fake.snapshot().decisions[0].id, 'decision-concurrent');
  assert.equal(fake.snapshot().adjustments.length, 0);
});

test('the DTO derives expiry without exposing stored free text or internal keys', () => {
  const dto = serializeAttendanceCorrection({
    id: 'request-expired',
    projectId: scope.projectId,
    workerId: 'worker-a',
    expectationId: null,
    shiftId: 'shift-a',
    targetEntryId: null,
    baseShiftRevision: 1,
    baseEffectiveHash: 'a'.repeat(64),
    proposedEffectiveHash: 'b'.repeat(64),
    proposedEvents: proposedEvents(),
    reasonCode: 'MISSED_CHECK_OUT',
    note: 'texto interno',
    requestedByPlatformUserId: null,
    requestedByWorkerId: 'worker-a',
    idempotencyKey: 'secret',
    requestFingerprint: 'c'.repeat(64),
    expiresAt: new Date('2026-07-24T14:59:59.000Z'),
    createdAt: new Date('2026-07-24T14:00:00.000Z'),
    decision: null,
    adjustment: null,
  }, { now: NOW });

  assert.equal(dto.status, 'EXPIRED');
  assert.equal(dto.hasNote, true);
  assert.equal(Object.hasOwn(dto, 'note'), false);
  assert.equal(Object.hasOwn(dto, 'idempotencyKey'), false);
  assert.equal(Object.hasOwn(dto, 'requestFingerprint'), false);
});
