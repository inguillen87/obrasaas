import assert from 'node:assert/strict';
import test from 'node:test';

import {
  OperationalProposalInboxError,
  countPendingOperationalProposals,
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

function canonicalTask(overrides = {}) {
  return {
    id: 'canonical-task-a',
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    title: 'Mamposteria planta baja',
    description: null,
    status: 'READY',
    progress: 20,
    revision: 3,
    metadata: { source: 'canonical-task-v1' },
    ...overrides,
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
  canonicalTasks = [],
  canonicalUpdateConflict = false,
  proposalApplyConflict = false,
} = {}) {
  const records = proposals.map((record) => structuredClone(record));
  const audits = [];
  const projectedTasks = new Map();
  const canonicalTaskRecords = new Map(
    canonicalTasks.map((task) => [task.id, structuredClone(task)]),
  );
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
        if (proposalApplyConflict && data.status === OPERATIONAL_PROPOSAL_STATUSES.APPLIED) {
          return { count: 0 };
        }
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
    task: {
      async findMany(args) {
        calls.push(['task-find', args]);
        const source = args.where.metadata.equals;
        const sourceRows = source === 'canonical-task-v1'
          ? [...canonicalTaskRecords.values()]
          : [...projectedTasks.values()];
        return sourceRows
          .filter((task) => task.projectId === args.where.projectId)
          .filter((task) => (
            !args.where.project?.organizationId
            || task.organizationId === args.where.project.organizationId
          ))
          .filter((task) => (
            task.metadata?.source === source
          ))
          .slice(0, args.take || sourceRows.length)
          .map((task) => structuredClone(task));
      },
      async findFirst(args) {
        calls.push(['task-find-exact', args]);
        const task = canonicalTaskRecords.get(args.where.id);
        if (
          !task
          || task.projectId !== args.where.projectId
          || task.organizationId !== args.where.project?.organizationId
          || task.metadata?.source !== args.where.metadata.equals
        ) return null;
        return structuredClone(task);
      },
      async updateMany(args) {
        calls.push(['task-update', args]);
        if (canonicalUpdateConflict) return { count: 0 };
        const task = canonicalTaskRecords.get(args.where.id);
        if (
          !task
          || task.projectId !== args.where.projectId
          || task.metadata?.source !== args.where.metadata.equals
          || task.revision !== args.where.revision
          || task.progress !== args.where.progress
        ) return { count: 0 };
        task.progress = args.data.progress;
        task.revision += Number(args.data.revision?.increment) || 0;
        return { count: 1 };
      },
      async upsert(args) {
        calls.push(['task-upsert', args]);
        const externalId = args.where.projectId_externalId.externalId;
        const previous = projectedTasks.get(externalId);
        const stored = previous
          ? { ...previous, ...structuredClone(args.update) }
          : structuredClone(args.create);
        projectedTasks.set(externalId, stored);
        return structuredClone(stored);
      },
      async deleteMany(args) {
        calls.push(['task-delete', args]);
        let count = 0;
        for (const externalId of args.where.externalId.in) {
          const task = projectedTasks.get(externalId);
          if (
            task?.projectId === args.where.projectId
            && task.metadata?.source === args.where.metadata.equals
          ) {
            projectedTasks.delete(externalId);
            count += 1;
          }
        }
        return { count };
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
      const before = {
        records: structuredClone(records),
        audits: structuredClone(audits),
        projectedTasks: structuredClone([...projectedTasks.entries()]),
        canonicalTasks: structuredClone([...canonicalTaskRecords.entries()]),
        snapshot: structuredClone(snapshot),
      };
      try {
        return await callback(transaction);
      } catch (error) {
        records.splice(0, records.length, ...before.records);
        audits.splice(0, audits.length, ...before.audits);
        projectedTasks.clear();
        for (const [key, value] of before.projectedTasks) projectedTasks.set(key, value);
        canonicalTaskRecords.clear();
        for (const [key, value] of before.canonicalTasks) canonicalTaskRecords.set(key, value);
        snapshot = before.snapshot;
        throw error;
      }
    },
    operationalProposal: transaction.operationalProposal,
    projectSnapshot: transaction.projectSnapshot,
    task: transaction.task,
  };
  return {
    prisma,
    transaction,
    records,
    audits,
    projectedTasks,
    canonicalTasks: canonicalTaskRecords,
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

test('inbox uses canonical task IDs and revisions without mixing legacy snapshot tasks', async () => {
  const store = prismaStore({ canonicalTasks: [canonicalTask()] });
  const inbox = await listOperationalProposalInbox(store.prisma, scope, {
    filters: { view: 'all', type: null, limit: 50, offset: 0 },
    now,
  });

  assert.equal(inbox.taskAuthority, 'CANONICAL');
  assert.deepEqual(inbox.tasks, [{
    id: 'canonical-task-a',
    name: 'Mamposteria planta baja',
    progress: 20,
    revision: 3,
  }]);
  assert.equal(inbox.tasks.some((task) => task.id === 'task-a'), false);
  const canonicalRead = store.calls.find(([name]) => name === 'task-find')[1];
  assert.deepEqual(canonicalRead.where, {
    projectId: scope.projectId,
    project: { organizationId: scope.organizationId },
    metadata: { path: ['source'], equals: 'canonical-task-v1' },
  });
});

test('a redacted canonical catalog never falls back to legacy task identities', async () => {
  const store = prismaStore({
    canonicalTasks: [canonicalTask({
      title: 'Tratamiento VIH de Juan',
      description: 'Seguimiento de salud restringido',
    })],
  });
  const inbox = await listOperationalProposalInbox(store.prisma, scope, {
    filters: { view: 'all', type: null, limit: 50, offset: 0 },
    includeSensitiveDetails: false,
    now,
  });

  assert.equal(inbox.taskAuthority, 'CANONICAL');
  assert.deepEqual(inbox.tasks, []);
});

test('lightweight pending counts retain tenant, project and expiry boundaries', async () => {
  const store = prismaStore({
    proposals: [
      proposal(),
      proposal({
        id: 'proposal-expired',
        confirmationCode: 'VP-EXPIRED12345',
        expiresAt: new Date('2026-07-16T14:59:00.000Z'),
      }),
      proposal({
        id: 'proposal-applied',
        confirmationCode: 'VP-APPLIED12345',
        status: 'APPLIED',
      }),
    ],
  });

  const pendingCount = await countPendingOperationalProposals(
    store.prisma,
    scope,
    { now },
  );

  assert.equal(pendingCount, 1);
  const countCall = store.calls.find(([name]) => name === 'proposal-count');
  assert.equal(countCall[1].projectId, scope.projectId);
  assert.deepEqual(countCall[1].project, {
    organizationId: scope.organizationId,
  });
  assert.equal(countCall[1].status, 'PENDING');
  assert.deepEqual(countCall[1].expiresAt, { gt: now });
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
    taskExpectedRevision: 3,
  }), {
    decision: 'APPROVE',
    taskId: 'task-a',
    taskExpectedProgress: 20,
    taskExpectedRevision: 3,
  });
  assert.throws(
    () => parseOperationalProposalDecisionInput({
      decision: 'APPROVE',
      taskId: 'task-a',
      taskExpectedProgress: 20,
      taskExpectedRevision: -1,
    }),
    (error) => error.code === 'INVALID_TASK_SELECTION',
  );
  assert.throws(
    () => parseOperationalProposalDecisionInput({
      decision: 'APPROVE',
      taskExpectedRevision: 3,
    }),
    (error) => error.code === 'INVALID_TASK_SELECTION',
  );
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
  const canonicalRead = store.calls.find(([name, args]) => (
    name === 'task-find' && args.where.metadata.equals === 'canonical-task-v1'
  ))[1];
  assert.deepEqual(canonicalRead.where, {
    projectId: scope.projectId,
    project: { organizationId: scope.organizationId },
    metadata: { path: ['source'], equals: 'canonical-task-v1' },
  });
  const taskProjectionRead = store.calls.find(([name, args]) => (
    name === 'task-find' && args.where.metadata.equals === 'project-snapshot-v1'
  ))[1];
  assert.deepEqual(taskProjectionRead.where, {
    projectId: scope.projectId,
    metadata: { path: ['source'], equals: 'project-snapshot-v1' },
  });
  const taskProjectionWrite = store.calls.find(([name]) => name === 'task-upsert')[1];
  assert.deepEqual(taskProjectionWrite.where.projectId_externalId, {
    projectId: scope.projectId,
    externalId: 'snapshot:task-a',
  });
  assert.equal(taskProjectionWrite.create.progress, 75);
  assert.equal(taskProjectionWrite.create.status, 'IN_PROGRESS');
  assert.equal(taskProjectionWrite.create.metadata.projectStateVersion, 5);
  assert.equal(taskProjectionWrite.create.metadata.snapshotTaskId, 'task-a');
  assert.equal(store.projectedTasks.get('snapshot:task-a').progress, 75);
});

test('canonical approval CAS-updates only Task, audits it and replays idempotently', async () => {
  const store = prismaStore({
    canonicalTasks: [canonicalTask()],
    proposals: [proposal({
      action: {
        version: 1,
        percentage: 75,
        taskKey: null,
        taskName: null,
        taskReference: 'mamposteria',
      },
      precondition: null,
    })],
  });
  const options = {
    scope,
    proposalId: 'proposal-a',
    actorId: 'platform-user-a',
    actorName: 'director@example.com',
    idempotencyKey: 'canonical-approval-123',
    input: {
      decision: 'APPROVE',
      taskId: 'canonical-task-a',
      taskExpectedProgress: 20,
      taskExpectedRevision: 3,
    },
    now,
  };

  const result = await resolveDashboardOperationalProposal(store.prisma, options);

  assert.equal(result.outcome, 'APPLIED');
  assert.equal(result.stateVersion, 0);
  assert.equal(store.canonicalTasks.get('canonical-task-a').progress, 75);
  assert.equal(store.canonicalTasks.get('canonical-task-a').revision, 4);
  assert.equal(store.snapshot.state.tasks['task-a'].progress, 20);
  assert.equal(store.calls.some(([name]) => name === 'snapshot-read'), false);
  assert.equal(store.calls.some(([name]) => name === 'snapshot-write'), false);
  assert.equal(store.calls.some(([name]) => name === 'task-upsert'), false);
  const taskUpdate = store.calls.find(([name]) => name === 'task-update')[1];
  assert.deepEqual(taskUpdate.where, {
    id: 'canonical-task-a',
    projectId: scope.projectId,
    revision: 3,
    progress: 20,
    metadata: { path: ['source'], equals: 'canonical-task-v1' },
  });
  assert.deepEqual(taskUpdate.data, {
    progress: 75,
    revision: { increment: 1 },
  });
  const taskAudit = store.audits.find((audit) => audit.action === 'task.progress.approved');
  assert.equal(taskAudit.entityId, 'canonical-task-a');
  assert.equal(taskAudit.metadata.proposalId, 'proposal-a');
  assert.equal(taskAudit.metadata.previousRevision, 3);
  assert.equal(taskAudit.metadata.nextRevision, 4);
  assert.equal(store.records[0].result.taskAuthority, 'CANONICAL');

  const writesBeforeRetry = store.calls.filter(([name]) => name === 'task-update').length;
  const retry = await resolveDashboardOperationalProposal(store.prisma, options);
  assert.equal(retry.alreadyApplied, true);
  assert.equal(retry.outcome, 'APPLIED');
  assert.equal(
    store.calls.filter(([name]) => name === 'task-update').length,
    writesBeforeRetry,
  );
});

test('canonical bound approval uses its stored revision precondition without client reselection', async () => {
  const store = prismaStore({
    canonicalTasks: [canonicalTask()],
    proposals: [proposal({
      action: {
        version: 1,
        percentage: 75,
        taskKey: 'canonical-task-a',
        taskName: 'Mamposteria planta baja',
        taskReference: 'mamposteria',
      },
      precondition: {
        version: 1,
        taskKey: 'canonical-task-a',
        taskName: 'Mamposteria planta baja',
        taskProgress: 20,
        taskRevision: 3,
      },
    })],
  });

  const result = await resolveDashboardOperationalProposal(store.prisma, {
    scope,
    proposalId: 'proposal-a',
    actorId: 'platform-user-a',
    actorName: 'director@example.com',
    idempotencyKey: 'canonical-bound-approval-123',
    input: { decision: 'APPROVE' },
    now,
  });

  assert.equal(result.outcome, 'APPLIED');
  assert.equal(result.stateVersion, 0);
  assert.equal(store.canonicalTasks.get('canonical-task-a').progress, 75);
  assert.equal(store.canonicalTasks.get('canonical-task-a').revision, 4);
  assert.equal(store.snapshot.state.tasks['task-a'].progress, 20);
  assert.equal(store.calls.some(([name]) => name === 'snapshot-read'), false);
  assert.equal(store.calls.some(([name]) => name === 'snapshot-write'), false);
  assert.equal(store.calls.some(([name]) => name === 'task-upsert'), false);
  assert.equal(store.records[0].result.taskRevision, 4);
  assert.equal(store.records[0].result.taskAuthority, 'CANONICAL');
});

test('canonical bound approval resolves an exact task outside the 500-row presentation catalog', async () => {
  const catalogTasks = Array.from({ length: 500 }, (_, index) => canonicalTask({
    id: `canonical-catalog-${String(index).padStart(3, '0')}`,
    title: `Catalogo ${String(index).padStart(3, '0')}`,
  }));
  const exactTask = canonicalTask({
    id: 'canonical-outside-catalog',
    title: 'Z tarea fuera del catalogo',
    progress: 20,
    revision: 9,
  });
  const store = prismaStore({
    canonicalTasks: [...catalogTasks, exactTask],
    proposals: [proposal({
      action: {
        version: 1,
        percentage: 75,
        taskKey: exactTask.id,
        taskName: exactTask.title,
        taskReference: 'fuera del catalogo',
      },
      precondition: {
        version: 1,
        taskKey: exactTask.id,
        taskName: exactTask.title,
        taskProgress: 20,
        taskRevision: 9,
      },
    })],
  });

  const result = await resolveDashboardOperationalProposal(store.prisma, {
    scope,
    proposalId: 'proposal-a',
    actorId: 'platform-user-a',
    actorName: 'director@example.com',
    idempotencyKey: 'canonical-outside-catalog-123',
    input: { decision: 'APPROVE' },
    now,
  });

  assert.equal(result.outcome, 'APPLIED');
  assert.equal(store.canonicalTasks.get(exactTask.id).progress, 75);
  assert.equal(store.canonicalTasks.get(exactTask.id).revision, 10);
  const catalogRead = store.calls.find(([name]) => name === 'task-find')[1];
  assert.equal(catalogRead.take, 500);
  const exactRead = store.calls.find(([name]) => name === 'task-find-exact')[1];
  assert.deepEqual(exactRead.where, {
    id: exactTask.id,
    projectId: scope.projectId,
    project: { organizationId: scope.organizationId },
    metadata: { path: ['source'], equals: 'canonical-task-v1' },
  });
});

test('a privacy-hidden canonical task stays pending instead of being invalidated', async () => {
  const hiddenTask = canonicalTask({
    id: 'canonical-private-task',
    title: 'Tratamiento VIH de Juan',
    description: 'Seguimiento medico restringido',
  });
  const store = prismaStore({
    canonicalTasks: [hiddenTask],
    proposals: [proposal({
      action: {
        version: 1,
        percentage: 75,
        taskKey: hiddenTask.id,
        taskName: hiddenTask.title,
        taskReference: 'restringida',
      },
      precondition: {
        version: 1,
        taskKey: hiddenTask.id,
        taskName: hiddenTask.title,
        taskProgress: 20,
        taskRevision: 3,
      },
    })],
  });

  await assert.rejects(
    () => resolveDashboardOperationalProposal(store.prisma, {
      scope,
      proposalId: 'proposal-a',
      actorId: 'platform-user-a',
      actorName: 'site-manager@example.com',
      idempotencyKey: 'canonical-private-task-123',
      input: { decision: 'APPROVE' },
      includeSensitiveDetails: false,
      now,
    }),
    (error) => (
      error.code === 'TASK_REQUIRED'
      && error.status === 422
      && !/Juan|VIH|tratamiento/i.test(error.message)
    ),
  );

  assert.equal(store.records[0].status, OPERATIONAL_PROPOSAL_STATUSES.PENDING);
  assert.equal(store.canonicalTasks.get(hiddenTask.id).progress, 20);
  assert.equal(store.calls.some(([name]) => name === 'task-update'), false);
  assert.equal(
    store.audits.some((audit) => audit.action === 'voice.proposal.invalidated'),
    false,
  );
});

test('an exact bound task from another project is invalidated without cross-project writes', async () => {
  const foreignTask = canonicalTask({
    id: 'canonical-project-b',
    projectId: 'project-b',
    title: 'Tarea privada proyecto B',
  });
  const store = prismaStore({
    canonicalTasks: [canonicalTask(), foreignTask],
    proposals: [proposal({
      action: {
        version: 1,
        percentage: 75,
        taskKey: foreignTask.id,
        taskName: foreignTask.title,
      },
      precondition: {
        version: 1,
        taskKey: foreignTask.id,
        taskName: foreignTask.title,
        taskProgress: 20,
        taskRevision: 3,
      },
    })],
  });

  await assert.rejects(
    () => resolveDashboardOperationalProposal(store.prisma, {
      scope,
      proposalId: 'proposal-a',
      actorId: 'platform-user-a',
      actorName: 'director@example.com',
      idempotencyKey: 'canonical-cross-project-123',
      input: { decision: 'APPROVE' },
      now,
    }),
    (error) => error.code === 'PROPOSAL_INVALIDATED' && !/proyecto B/i.test(error.message),
  );

  assert.equal(store.records[0].status, OPERATIONAL_PROPOSAL_STATUSES.INVALIDATED);
  assert.equal(store.canonicalTasks.get(foreignTask.id).progress, 20);
  assert.equal(store.calls.some(([name]) => name === 'task-update'), false);
  const exactRead = store.calls.find(([name]) => name === 'task-find-exact')[1];
  assert.deepEqual(exactRead.where, {
    id: foreignTask.id,
    projectId: scope.projectId,
    project: { organizationId: scope.organizationId },
    metadata: { path: ['source'], equals: 'canonical-task-v1' },
  });
});

test('an exact bound task from another tenant is invalidated without cross-tenant writes', async () => {
  const foreignTask = canonicalTask({
    id: 'canonical-tenant-b',
    organizationId: 'organization-b',
    title: 'Tarea privada tenant B',
  });
  const store = prismaStore({
    canonicalTasks: [canonicalTask(), foreignTask],
    proposals: [proposal({
      action: {
        version: 1,
        percentage: 75,
        taskKey: foreignTask.id,
        taskName: foreignTask.title,
      },
      precondition: {
        version: 1,
        taskKey: foreignTask.id,
        taskName: foreignTask.title,
        taskProgress: 20,
        taskRevision: 3,
      },
    })],
  });

  await assert.rejects(
    () => resolveDashboardOperationalProposal(store.prisma, {
      scope,
      proposalId: 'proposal-a',
      actorId: 'platform-user-a',
      actorName: 'director@example.com',
      idempotencyKey: 'canonical-cross-tenant-123',
      input: { decision: 'APPROVE' },
      now,
    }),
    (error) => error.code === 'PROPOSAL_INVALIDATED' && !/tenant B/i.test(error.message),
  );

  assert.equal(store.records[0].status, OPERATIONAL_PROPOSAL_STATUSES.INVALIDATED);
  assert.equal(store.canonicalTasks.get(foreignTask.id).progress, 20);
  assert.equal(store.calls.some(([name]) => name === 'task-update'), false);
  const exactRead = store.calls.find(([name]) => name === 'task-find-exact')[1];
  assert.deepEqual(exactRead.where, {
    id: foreignTask.id,
    projectId: scope.projectId,
    project: { organizationId: scope.organizationId },
    metadata: { path: ['source'], equals: 'canonical-task-v1' },
  });
});

test('canonical bound approval detects ABA through its stored revision even when progress matches', async () => {
  const store = prismaStore({
    canonicalTasks: [canonicalTask({ revision: 5, progress: 20 })],
    proposals: [proposal({
      action: {
        version: 1,
        percentage: 75,
        taskKey: 'canonical-task-a',
        taskName: 'Mamposteria planta baja',
        taskReference: 'mamposteria',
      },
      precondition: {
        version: 1,
        taskKey: 'canonical-task-a',
        taskName: 'Mamposteria planta baja',
        taskProgress: 20,
        taskRevision: 3,
      },
    })],
  });

  await assert.rejects(
    () => resolveDashboardOperationalProposal(store.prisma, {
      scope,
      proposalId: 'proposal-a',
      actorId: 'platform-user-a',
      actorName: 'director@example.com',
      idempotencyKey: 'canonical-bound-aba-123',
      input: { decision: 'APPROVE' },
      now,
    }),
    (error) => error.code === 'PROPOSAL_INVALIDATED' && error.status === 409,
  );

  assert.equal(store.canonicalTasks.get('canonical-task-a').progress, 20);
  assert.equal(store.canonicalTasks.get('canonical-task-a').revision, 5);
  assert.equal(store.records[0].status, OPERATIONAL_PROPOSAL_STATUSES.INVALIDATED);
  assert.equal(store.calls.some(([name]) => name === 'task-update'), false);
  assert.equal(store.calls.some(([name]) => name === 'snapshot-read'), false);
  assert.equal(store.calls.some(([name]) => name === 'snapshot-write'), false);
});

test('canonical approval rejects a stale client revision without touching task or proposal', async () => {
  const store = prismaStore({
    canonicalTasks: [canonicalTask()],
    proposals: [proposal({
      action: { version: 1, percentage: 75, taskKey: null, taskName: null },
      precondition: null,
    })],
  });

  await assert.rejects(
    () => resolveDashboardOperationalProposal(store.prisma, {
      scope,
      proposalId: 'proposal-a',
      actorId: 'platform-user-a',
      actorName: 'director@example.com',
      idempotencyKey: 'canonical-stale-123',
      input: {
        decision: 'APPROVE',
        taskId: 'canonical-task-a',
        taskExpectedProgress: 20,
        taskExpectedRevision: 2,
      },
      now,
    }),
    (error) => error.code === 'TASK_PRECONDITION_STALE' && error.status === 409,
  );

  assert.equal(store.canonicalTasks.get('canonical-task-a').progress, 20);
  assert.equal(store.canonicalTasks.get('canonical-task-a').revision, 3);
  assert.equal(store.records[0].status, OPERATIONAL_PROPOSAL_STATUSES.PENDING);
  assert.equal(store.calls.some(([name]) => name === 'task-update'), false);
  assert.equal(store.calls.some(([name]) => name === 'snapshot-write'), false);
});

test('canonical approval fails closed when the CAS loses after the protected read', async () => {
  const store = prismaStore({
    canonicalTasks: [canonicalTask()],
    canonicalUpdateConflict: true,
    proposals: [proposal({
      action: { version: 1, percentage: 75, taskKey: null, taskName: null },
      precondition: null,
    })],
  });

  await assert.rejects(
    () => resolveDashboardOperationalProposal(store.prisma, {
      scope,
      proposalId: 'proposal-a',
      actorId: 'platform-user-a',
      actorName: 'director@example.com',
      idempotencyKey: 'canonical-race-123',
      input: {
        decision: 'APPROVE',
        taskId: 'canonical-task-a',
        taskExpectedProgress: 20,
        taskExpectedRevision: 3,
      },
      now,
    }),
    (error) => error.code === 'TASK_PRECONDITION_STALE' && error.status === 409,
  );

  assert.equal(store.calls.filter(([name]) => name === 'task-update').length, 1);
  assert.equal(store.records[0].status, OPERATIONAL_PROPOSAL_STATUSES.PENDING);
  assert.equal(store.audits.some((audit) => audit.action === 'task.progress.approved'), false);
  assert.equal(store.calls.some(([name]) => name === 'snapshot-write'), false);
});

test('canonical approval rolls back the task when proposal finalization loses a race', async () => {
  const store = prismaStore({
    canonicalTasks: [canonicalTask()],
    proposalApplyConflict: true,
    proposals: [proposal({
      action: { version: 1, percentage: 75, taskKey: null, taskName: null },
      precondition: null,
    })],
  });

  await assert.rejects(
    () => resolveDashboardOperationalProposal(store.prisma, {
      scope,
      proposalId: 'proposal-a',
      actorId: 'platform-user-a',
      actorName: 'director@example.com',
      idempotencyKey: 'canonical-finalize-race-123',
      input: {
        decision: 'APPROVE',
        taskId: 'canonical-task-a',
        taskExpectedProgress: 20,
        taskExpectedRevision: 3,
      },
      now,
    }),
    (error) => error.code === 'PROPOSAL_RACE_LOST' && error.status === 409,
  );

  assert.equal(store.calls.filter(([name]) => name === 'task-update').length, 1);
  assert.equal(store.canonicalTasks.get('canonical-task-a').progress, 20);
  assert.equal(store.canonicalTasks.get('canonical-task-a').revision, 3);
  assert.equal(store.records[0].status, OPERATIONAL_PROPOSAL_STATUSES.PENDING);
  assert.equal(store.audits.some((audit) => audit.action === 'task.progress.approved'), false);
});

test('canonical approval denies an exact foreign task ID without leaking or writing', async () => {
  const store = prismaStore({
    canonicalTasks: [
      canonicalTask(),
      canonicalTask({ id: 'foreign-task', projectId: 'project-b', title: 'Obra ajena' }),
    ],
    proposals: [proposal({
      action: { version: 1, percentage: 75, taskKey: null, taskName: null },
      precondition: null,
    })],
  });

  await assert.rejects(
    () => resolveDashboardOperationalProposal(store.prisma, {
      scope,
      proposalId: 'proposal-a',
      actorId: 'platform-user-a',
      actorName: 'director@example.com',
      idempotencyKey: 'canonical-foreign-123',
      input: {
        decision: 'APPROVE',
        taskId: 'foreign-task',
        taskExpectedProgress: 20,
        taskExpectedRevision: 3,
      },
      now,
    }),
    (error) => error.code === 'TASK_REQUIRED' && !/obra ajena/i.test(error.message),
  );

  assert.equal(store.calls.some(([name]) => name === 'task-update'), false);
  assert.equal(store.records[0].status, OPERATIONAL_PROPOSAL_STATUSES.PENDING);
});

test('a legacy-bound proposal is invalidated instead of crossing into canonical authority', async () => {
  const store = prismaStore({ canonicalTasks: [canonicalTask()] });

  await assert.rejects(
    () => resolveDashboardOperationalProposal(store.prisma, {
      scope,
      proposalId: 'proposal-a',
      actorId: 'platform-user-a',
      actorName: 'director@example.com',
      idempotencyKey: 'canonical-legacy-bound-123',
      input: { decision: 'APPROVE' },
      now,
    }),
    (error) => error.code === 'PROPOSAL_INVALIDATED',
  );

  assert.equal(store.records[0].status, OPERATIONAL_PROPOSAL_STATUSES.INVALIDATED);
  assert.equal(store.canonicalTasks.get('canonical-task-a').progress, 20);
  assert.equal(store.calls.some(([name]) => name === 'task-update'), false);
  assert.equal(store.calls.some(([name]) => name === 'snapshot-write'), false);
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
  const taskWritesBeforeRetry = store.calls.filter(([name]) => name === 'task-upsert').length;
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
    store.calls.filter(([name]) => name === 'task-upsert').length,
    taskWritesBeforeRetry,
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
