import assert from 'node:assert/strict';
import test from 'node:test';

import {
  OperationalProposalInboxError,
  dashboardDecisionIdentity,
  listOperationalProposalInbox,
  parseOperationalProposalDecisionInput,
  parseOperationalProposalFilters,
  resolveDashboardOperationalProposal,
  serializeOperationalProposal,
  sweepExpiredOperationalProposals,
} from '../src/lib/operational-proposal-inbox.js';
import {
  OPERATIONAL_PROPOSAL_STATUSES,
  OPERATIONAL_PROPOSAL_TYPES,
} from '../src/lib/whatsapp/operational-proposals.js';

const scope = {
  organizationId: 'organization-a',
  projectId: 'project-a',
};
const now = new Date('2026-07-16T15:00:00.000Z');

function taskState(progress = 20) {
  return {
    attendance: {},
    incidents: [],
    tasks: {
      'task-a': {
        name: 'Estructura principal',
        progress,
        duration: 8,
        startOffset: 0,
        assignee: 'Cuadrilla A',
      },
    },
    alertsCount: 0,
    avancePercentage: progress,
    operariosCount: 1,
  };
}

function proposal(overrides = {}) {
  return {
    id: 'proposal-a',
    projectId: scope.projectId,
    proposedByWorkerId: 'worker-a',
    proposedByWorker: { name: 'Persona de campo' },
    resolvedByWorkerId: null,
    sourceProvider: 'meta',
    sourceExternalId: 'wamid.private-a',
    resolverProvider: null,
    resolverExternalId: null,
    confirmationCode: 'VP-ABCDEF123456',
    type: OPERATIONAL_PROPOSAL_TYPES.TASK_PROGRESS,
    status: OPERATIONAL_PROPOSAL_STATUSES.PENDING,
    summary: 'La estructura principal está al 75%.',
    action: {
      version: 1,
      percentage: 75,
      taskKey: 'task-a',
      taskName: 'Estructura principal',
      taskReference: 'estructura principal',
    },
    precondition: {
      version: 1,
      taskKey: 'task-a',
      taskName: 'Estructura principal',
      taskProgress: 20,
    },
    result: null,
    classifierVersion: 'private-classifier',
    transcriptSha256: 'a'.repeat(64),
    expiresAt: new Date('2026-07-16T15:30:00.000Z'),
    resolvedAt: null,
    createdAt: new Date('2026-07-16T14:55:00.000Z'),
    updatedAt: new Date('2026-07-16T14:55:00.000Z'),
    ...overrides,
  };
}

function matchesExpiry(record, expiresAt) {
  const timestamp = new Date(record.expiresAt).getTime();
  if (expiresAt?.gt && timestamp <= expiresAt.gt.getTime()) return false;
  if (expiresAt?.lte && timestamp > expiresAt.lte.getTime()) return false;
  return true;
}

function prismaStore({
  proposals = [proposal()],
  state = taskState(),
  version = 4,
  projectStatus = 'ACTIVE',
} = {}) {
  const records = proposals.map((record) => structuredClone(record));
  const audits = [];
  const calls = [];
  let snapshot = {
    state: structuredClone(state),
    version,
    updatedAt: new Date('2026-07-16T14:58:00.000Z'),
  };

  const transaction = {
    async $executeRawUnsafe(query, projectId) {
      calls.push(['lock', query, projectId]);
    },
    project: {
      async findFirst(args) {
        calls.push(['project', args]);
        if (
          args.where.id !== scope.projectId
          || args.where.organizationId !== scope.organizationId
        ) {
          return null;
        }
        return {
          id: scope.projectId,
          organizationId: scope.organizationId,
          status: projectStatus,
        };
      },
    },
    operationalProposal: {
      async findFirst(args) {
        calls.push(['proposal-find-first', args]);
        return records.find((record) => (
          record.id === args.where.id
          && record.projectId === args.where.projectId
        )) || null;
      },
      async findUnique({ where }) {
        calls.push(['proposal-find-unique', where]);
        const key = where.projectId_confirmationCode;
        if (!key) return null;
        return records.find((record) => (
          record.projectId === key.projectId
          && record.confirmationCode === key.confirmationCode
        )) || null;
      },
      async findMany(args) {
        calls.push(['proposal-find-many', args]);
        return records
          .filter((record) => record.projectId === args.where.projectId)
          .filter((record) => (
            !args.where.status || record.status === args.where.status
          ))
          .filter((record) => matchesExpiry(record, args.where.expiresAt))
          .slice(0, args.take);
      },
      async count({ where }) {
        calls.push(['proposal-count', where]);
        return records.filter((record) => {
          if (record.projectId !== where.projectId) return false;
          if (typeof where.status === 'string' && record.status !== where.status) return false;
          if (!matchesExpiry(record, where.expiresAt)) return false;
          if (where.OR) {
            return where.OR.some((condition) => {
              if (typeof condition.status === 'string' && record.status !== condition.status) {
                return false;
              }
              if (
                condition.status?.not
                && record.status === condition.status.not
              ) {
                return false;
              }
              return matchesExpiry(record, condition.expiresAt);
            });
          }
          return true;
        }).length;
      },
      async updateMany({ where, data }) {
        calls.push(['proposal-update', { where, data }]);
        const record = records.find((candidate) => (
          candidate.id === where.id
          && candidate.projectId === where.projectId
          && candidate.status === where.status
          && matchesExpiry(candidate, where.expiresAt)
        ));
        if (!record) return { count: 0 };
        Object.assign(record, structuredClone(data));
        return { count: 1 };
      },
    },
    projectSnapshot: {
      async findUnique(args) {
        calls.push(['snapshot-read', args]);
        return structuredClone(snapshot);
      },
      async upsert(args) {
        calls.push(['snapshot-write', args]);
        snapshot = {
          state: structuredClone(args.update.state),
          version: args.update.version,
          updatedAt: now,
        };
        return structuredClone(snapshot);
      },
    },
    auditLog: {
      async findUnique({ where }) {
        calls.push(['audit-find', where]);
        return audits.find((audit) => audit.id === where.id) || null;
      },
      async create({ data }) {
        calls.push(['audit-create', data]);
        const stored = {
          id: data.id || `audit-${audits.length + 1}`,
          ...structuredClone(data),
        };
        audits.push(stored);
        return stored;
      },
    },
  };
  const prisma = {
    async $transaction(callback, options) {
      calls.push(['transaction', options]);
      return callback(transaction);
    },
    operationalProposal: transaction.operationalProposal,
    projectSnapshot: transaction.projectSnapshot,
  };
  return {
    prisma,
    transaction,
    records,
    audits,
    calls,
    get snapshot() {
      return snapshot;
    },
  };
}

test('inbox filters are strict and bounded', () => {
  assert.deepEqual(
    parseOperationalProposalFilters(
      new URLSearchParams('view=history&type=delay_report&limit=25&offset=50'),
    ),
    {
      view: 'history',
      type: 'DELAY_REPORT',
      limit: 25,
      offset: 50,
    },
  );
  assert.throws(
    () => parseOperationalProposalFilters(new URLSearchParams('limit=101')),
    (error) => (
      error instanceof OperationalProposalInboxError
      && error.code === 'INVALID_PROPOSAL_FILTER'
    ),
  );
  assert.throws(
    () => parseOperationalProposalFilters(new URLSearchParams('tenantId=other')),
    (error) => error.code === 'INVALID_PROPOSAL_FILTER',
  );
});

test('private DTOs redact critical details and never expose source identities or hashes', () => {
  const record = proposal({
    type: OPERATIONAL_PROPOSAL_TYPES.CRITICAL_INCIDENT,
    summary: 'Persona herida con detalle clínico sensible.',
    action: { version: 1, riskSignals: ['injury'] },
    precondition: null,
  });
  const redacted = serializeOperationalProposal(record, {
    includeSensitiveDetails: false,
    now,
  });
  const serialized = JSON.stringify(redacted);

  assert.match(redacted.summary, /detalle sensible está restringido/i);
  assert.equal(serialized.includes('wamid.private-a'), false);
  assert.equal(serialized.includes('private-classifier'), false);
  assert.equal(serialized.includes('a'.repeat(64)), false);
  assert.equal(serialized.includes('worker-a'), false);
  assert.equal(redacted.proposedBy, null);
  assert.equal(redacted.resolvedAt, null);
});

test('private DTOs redact clinical details independently of the operational proposal type', () => {
  const record = proposal({
    type: OPERATIONAL_PROPOSAL_TYPES.DELAY_REPORT,
    summary: 'Hay una demora porque Juan tiene cáncer y está bajo tratamiento médico.',
    action: { version: 1, delaySignals: ['DEMORA'], riskSignals: [] },
    precondition: null,
  });
  const redacted = serializeOperationalProposal(record, {
    includeSensitiveDetails: false,
    now,
  });
  const authorized = serializeOperationalProposal(record, {
    includeSensitiveDetails: true,
    now,
  });

  assert.doesNotMatch(redacted.summary, /Juan|cáncer|tratamiento médico/i);
  assert.match(redacted.summary, /restringido/i);
  assert.equal(redacted.detailRestricted, true);
  assert.match(authorized.summary, /Juan tiene cáncer/i);
  assert.equal(authorized.detailRestricted, false);
});

test('private DTOs redact additional high-risk clinical terms in delay reports', () => {
  const record = proposal({
    type: OPERATIONAL_PROPOSAL_TYPES.DELAY_REPORT,
    summary: 'La demora se debe a que Juan tiene VIH y requiere diálisis.',
    action: { version: 1, delaySignals: ['DEMORA'], riskSignals: [] },
    precondition: null,
  });
  const redacted = serializeOperationalProposal(record, {
    includeSensitiveDetails: false,
    now,
  });

  assert.doesNotMatch(redacted.summary, /Juan|VIH|diálisis/i);
  assert.equal(redacted.detailRestricted, true);
});

test('sensitive task proposals redact every content-bearing task field', () => {
  const clinicalTaskName = 'Tratamiento médico de Juan';
  const record = proposal({
    type: OPERATIONAL_PROPOSAL_TYPES.TASK_PROGRESS,
    summary: 'Juan tiene VIH y la tarea de tratamiento médico está al 75%.',
    action: {
      version: 1,
      percentage: 75,
      taskKey: 'task-medical',
      taskName: clinicalTaskName,
      taskReference: clinicalTaskName,
    },
    precondition: {
      version: 1,
      taskKey: 'task-medical',
      taskName: clinicalTaskName,
      taskProgress: 20,
    },
    result: {
      taskKey: 'task-medical',
      taskName: clinicalTaskName,
      previousProgress: 20,
      nextProgress: 75,
    },
  });
  const redacted = serializeOperationalProposal(record, {
    includeSensitiveDetails: false,
    now,
  });
  const serialized = JSON.stringify(redacted);

  assert.equal(redacted.detailRestricted, true);
  assert.doesNotMatch(serialized, /Juan|VIH|tratamiento médico/i);
  assert.equal(redacted.change.taskId, null);
  assert.equal(redacted.change.percentage, 75);
  assert.equal(redacted.precondition.progress, 20);
  assert.equal(redacted.result.nextProgress, 75);
});

test('nested clinical task fields cannot bypass redaction through a benign summary', () => {
  const clinicalTaskName = 'Tratamiento médico de Juan';
  const record = proposal({
    summary: 'Avance informado al 75%.',
    action: {
      version: 1,
      percentage: 75,
      taskKey: 'task-medical',
      taskName: clinicalTaskName,
      taskReference: 'tarea task-medical',
    },
    precondition: {
      version: 1,
      taskKey: 'task-medical',
      taskName: clinicalTaskName,
      taskProgress: 20,
    },
    result: {
      taskKey: 'task-medical',
      taskName: clinicalTaskName,
      previousProgress: 20,
      nextProgress: 75,
    },
  });
  const redacted = serializeOperationalProposal(record, {
    includeSensitiveDetails: false,
    now,
  });
  const authorized = serializeOperationalProposal(record, {
    includeSensitiveDetails: true,
    now,
  });

  assert.equal(redacted.detailRestricted, true);
  assert.doesNotMatch(
    JSON.stringify(redacted),
    /Juan|tratamiento médico|task-medical/i,
  );
  assert.equal(redacted.change.percentage, 75);
  assert.equal(redacted.precondition.progress, 20);
  assert.equal(redacted.result.nextProgress, 75);
  assert.equal(authorized.detailRestricted, false);
  assert.equal(authorized.change.taskName, clinicalTaskName);
  assert.equal(authorized.precondition.taskName, clinicalTaskName);
  assert.equal(authorized.result.taskName, clinicalTaskName);
});

test('raw voice summaries and untrusted task references stay restricted by source, not vocabulary', () => {
  const record = proposal({
    summary: 'La estructura principal está al 75%.',
    action: {
      version: 1,
      percentage: 75,
      taskKey: 'task-a',
      taskName: 'Estructura principal',
      taskReference: 'estructura principal',
    },
  });
  const redacted = serializeOperationalProposal(record, {
    includeSensitiveDetails: false,
    now,
  });
  const authorized = serializeOperationalProposal(record, {
    includeSensitiveDetails: true,
    now,
  });

  assert.equal(redacted.summaryRestricted, true);
  assert.doesNotMatch(redacted.summary, /estructura principal/i);
  assert.equal(redacted.detailRestricted, false);
  assert.equal(redacted.change.taskId, 'task-a');
  assert.equal(redacted.change.taskName, 'Estructura principal');
  assert.equal(redacted.change.taskReference, null);
  assert.equal(authorized.summaryRestricted, false);
  assert.match(authorized.summary, /estructura principal/i);
  assert.equal(authorized.change.taskReference, 'estructura principal');
});

test('list results stay tenant-project scoped and expose current task progress safely', async () => {
  const store = prismaStore();
  const inbox = await listOperationalProposalInbox(store.prisma, scope, {
    filters: { view: 'all', type: null, limit: 50, offset: 0 },
    now,
  });

  assert.equal(inbox.proposals.length, 1);
  assert.equal(inbox.proposals[0].change.currentProgress, 20);
  assert.deepEqual(inbox.tasks, [{
    id: 'task-a',
    name: 'Estructura principal',
    progress: 20,
  }]);
  const findCall = store.calls.find(([name]) => name === 'proposal-find-many');
  assert.deepEqual(findCall[1].where.project, {
    organizationId: scope.organizationId,
  });
});

test('inbox task options omit clinical task identities unless sensitive access is authorized', async () => {
  const clinicalTaskName = 'Tratamiento médico de Juan';
  const store = prismaStore({
    state: {
      ...taskState(),
      tasks: {
        ...taskState().tasks,
        'task-medical': {
          name: clinicalTaskName,
          progress: 20,
          duration: 4,
        },
        'task-nested-medical': {
          name: 'Seguimiento especial',
          progress: 40,
          notes: clinicalTaskName,
        },
      },
    },
  });
  const filters = { view: 'all', type: null, limit: 50, offset: 0 };
  const redacted = await listOperationalProposalInbox(store.prisma, scope, {
    filters,
    includeSensitiveDetails: false,
    now,
  });
  const authorized = await listOperationalProposalInbox(store.prisma, scope, {
    filters,
    includeSensitiveDetails: true,
    now,
  });

  assert.deepEqual(redacted.tasks, [{
    id: 'task-a',
    name: 'Estructura principal',
    progress: 20,
  }]);
  assert.doesNotMatch(JSON.stringify(redacted.tasks), /Juan|tratamiento médico/i);
  assert.equal(
    authorized.tasks.find((task) => task.id === 'task-medical')?.name,
    clinicalTaskName,
  );
  assert.equal(
    authorized.tasks.find((task) => task.id === 'task-nested-medical')?.name,
    'Seguimiento especial',
  );
});

test('decision input requires the selected task precondition supplied by the client', () => {
  assert.throws(
    () => parseOperationalProposalDecisionInput({
      decision: 'APPROVE',
      taskId: 'task-a',
    }),
    (error) => (
      error.code === 'TASK_CONFIRMATION_REQUIRED'
      && error.status === 422
    ),
  );
  assert.deepEqual(parseOperationalProposalDecisionInput({
    decision: 'APPROVE',
    taskId: 'task-a',
    taskExpectedProgress: 20,
  }), {
    decision: 'APPROVE',
    taskId: 'task-a',
    taskExpectedProgress: 20,
  });
});

test('task IDs remain exact and unsafe long prefixes cannot collide in the DTO', async () => {
  const prefix = 'x'.repeat(128);
  const store = prismaStore({
    state: {
      ...taskState(),
      tasks: {
        [prefix]: {
          name: 'Tarea exacta representable',
          progress: 20,
          duration: 8,
        },
        [`${prefix}-second`]: {
          name: 'Tarea demasiado larga',
          progress: 20,
          duration: 8,
        },
      },
    },
  });
  const inbox = await listOperationalProposalInbox(store.prisma, scope, {
    filters: { view: 'all', type: null, limit: 50, offset: 0 },
    now,
  });

  assert.deepEqual(inbox.tasks.map((task) => task.id), [prefix]);
  assert.throws(
    () => parseOperationalProposalDecisionInput({
      decision: 'APPROVE',
      taskId: `${prefix}-second`,
      taskExpectedProgress: 20,
    }),
    (error) => error.code === 'INVALID_TASK_SELECTION',
  );
});

test('dashboard identities are actor and tenant scoped without retaining the raw key', () => {
  const first = dashboardDecisionIdentity(scope, 'platform-user-a', 'decision-key-123');
  const retry = dashboardDecisionIdentity(scope, 'platform-user-a', 'decision-key-123');
  const otherActor = dashboardDecisionIdentity(scope, 'platform-user-b', 'decision-key-123');

  assert.deepEqual(first, retry);
  assert.notEqual(first.operationId, otherActor.operationId);
  assert.equal(JSON.stringify(first).includes('decision-key-123'), false);
});

test('approval atomically applies state, increments the snapshot and audits the platform actor', async () => {
  const store = prismaStore();
  const result = await resolveDashboardOperationalProposal(store.prisma, {
    scope,
    proposalId: 'proposal-a',
    actorId: 'platform-user-a',
    actorName: 'director@example.com',
    idempotencyKey: 'approve-operation-123',
    input: { decision: 'APPROVE' },
    now,
  });

  assert.equal(result.outcome, 'APPLIED');
  assert.equal(result.stateVersion, 5);
  assert.equal(store.snapshot.state.tasks['task-a'].progress, 75);
  assert.equal(store.records[0].status, OPERATIONAL_PROPOSAL_STATUSES.APPLIED);
  assert.equal(store.records[0].resolvedByWorkerId, null);
  assert.equal(store.records[0].resolverProvider, 'dashboard');
  const transitionAudit = store.audits.find((audit) => (
    audit.action === 'voice.proposal.applied'
  ));
  assert.equal(transitionAudit.actorId, 'platform-user-a');
  assert.equal(transitionAudit.metadata.auditSource, 'dashboard-approval-inbox');
  const operationAudit = store.audits.find((audit) => (
    audit.action === 'operational.proposal.dashboard_decision'
  ));
  assert.equal(operationAudit.actorId, 'platform-user-a');
  assert.equal(
    JSON.stringify(operationAudit).includes('approve-operation-123'),
    false,
  );
  assert.deepEqual(
    store.calls.slice(0, 5).map(([name]) => name),
    ['transaction', 'lock', 'project', 'audit-find', 'proposal-find-first'],
  );
});

test('an exact idempotent retry returns the stored outcome without repeating effects', async () => {
  const store = prismaStore();
  const options = {
    scope,
    proposalId: 'proposal-a',
    actorId: 'platform-user-a',
    actorName: 'director@example.com',
    idempotencyKey: 'approve-operation-456',
    input: { decision: 'APPROVE' },
    now,
  };
  await resolveDashboardOperationalProposal(store.prisma, options);
  const writesBeforeRetry = store.calls.filter(([name]) => name === 'snapshot-write').length;
  const transitionAuditsBeforeRetry = store.audits.filter((audit) => (
    audit.action === 'voice.proposal.applied'
  )).length;

  const retry = await resolveDashboardOperationalProposal(store.prisma, options);

  assert.equal(retry.alreadyApplied, true);
  assert.equal(retry.outcome, 'APPLIED');
  assert.equal(
    store.calls.filter(([name]) => name === 'snapshot-write').length,
    writesBeforeRetry,
  );
  assert.equal(
    store.audits.filter((audit) => audit.action === 'voice.proposal.applied').length,
    transitionAuditsBeforeRetry,
  );
});

test('a stale task selection fails before mutating proposal or project state', async () => {
  const store = prismaStore({
    proposals: [proposal({
      action: {
        version: 1,
        percentage: 75,
        taskKey: null,
        taskName: null,
        taskReference: 'estructura',
      },
      precondition: null,
    })],
    state: taskState(35),
  });

  await assert.rejects(
    resolveDashboardOperationalProposal(store.prisma, {
      scope,
      proposalId: 'proposal-a',
      actorId: 'platform-user-a',
      actorName: 'director@example.com',
      idempotencyKey: 'stale-operation-123',
      input: {
        decision: 'APPROVE',
        taskId: 'task-a',
        taskExpectedProgress: 20,
      },
      now,
    }),
    (error) => (
      error.code === 'TASK_PRECONDITION_STALE'
      && error.status === 409
    ),
  );
  assert.equal(store.records[0].status, OPERATIONAL_PROPOSAL_STATUSES.PENDING);
  assert.equal(store.snapshot.version, 4);
  assert.equal(
    store.audits.some((audit) => audit.action === 'voice.proposal.applied'),
    false,
  );
});

test('an unbound task proposal applies only with the client-confirmed current progress', async () => {
  const store = prismaStore({
    proposals: [proposal({
      action: {
        version: 1,
        percentage: 75,
        taskKey: null,
        taskName: null,
        taskReference: 'estructura',
      },
      precondition: null,
    })],
    state: taskState(35),
  });

  const result = await resolveDashboardOperationalProposal(store.prisma, {
    scope,
    proposalId: 'proposal-a',
    actorId: 'platform-user-a',
    actorName: 'director@example.com',
    idempotencyKey: 'selected-task-operation-123',
    input: {
      decision: 'APPROVE',
      taskId: 'task-a',
      taskExpectedProgress: 35,
    },
    now,
  });

  assert.equal(result.outcome, 'APPLIED');
  assert.equal(result.proposal.result.taskId, 'task-a');
  assert.equal(result.proposal.result.previousProgress, 35);
  assert.equal(store.snapshot.state.tasks['task-a'].progress, 75);
  assert.equal(store.records[0].result.taskKey, 'task-a');
});

test('rejection is durable without a snapshot write and conflicting key reuse is rejected', async () => {
  const store = prismaStore();
  const base = {
    scope,
    proposalId: 'proposal-a',
    actorId: 'platform-user-a',
    actorName: 'director@example.com',
    idempotencyKey: 'reject-operation-123',
    now,
  };
  const rejected = await resolveDashboardOperationalProposal(store.prisma, {
    ...base,
    input: { decision: 'REJECT' },
  });

  assert.equal(rejected.outcome, 'REJECTED');
  assert.equal(store.records[0].status, OPERATIONAL_PROPOSAL_STATUSES.REJECTED);
  assert.equal(
    store.calls.some(([name]) => name === 'snapshot-write'),
    false,
  );
  await assert.rejects(
    resolveDashboardOperationalProposal(store.prisma, {
      ...base,
      input: { decision: 'APPROVE' },
    }),
    (error) => (
      error.code === 'IDEMPOTENCY_KEY_CONFLICT'
      && error.status === 409
    ),
  );
});

test('foreign proposal ids return 404 without revealing another project', async () => {
  const store = prismaStore({
    proposals: [proposal({ id: 'other-proposal', projectId: 'project-b' })],
  });

  await assert.rejects(
    resolveDashboardOperationalProposal(store.prisma, {
      scope,
      proposalId: 'other-proposal',
      actorId: 'platform-user-a',
      actorName: 'director@example.com',
      idempotencyKey: 'foreign-operation-123',
      input: { decision: 'REJECT' },
      now,
    }),
    (error) => (
      error.code === 'OPERATIONAL_PROPOSAL_NOT_FOUND'
      && error.status === 404
    ),
  );
  assert.equal(store.audits.length, 0);
});

test('bounded expiry sweep persists an audited terminal state without a worker identity', async () => {
  const store = prismaStore({
    proposals: [proposal({
      expiresAt: new Date('2026-07-16T14:30:00.000Z'),
    })],
  });
  const swept = await sweepExpiredOperationalProposals(store.prisma, scope, {
    now,
    limit: 10,
  });

  assert.deepEqual(swept, { expiredCount: 1, skippedReadOnly: false });
  assert.equal(store.records[0].status, OPERATIONAL_PROPOSAL_STATUSES.EXPIRED);
  assert.equal(store.records[0].resolvedByWorkerId, null);
  const audit = store.audits.find((entry) => entry.action === 'voice.proposal.expired');
  assert.equal(audit.actorId, undefined);
  assert.equal(audit.metadata.auditSource, 'dashboard-approval-inbox-expiry');
});
