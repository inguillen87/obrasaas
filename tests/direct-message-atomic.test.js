import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { after, test } from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      const extension = specifier.startsWith('@/generated/') ? '.ts' : '.js';
      const sourcePath = new URL(`../src/${specifier.slice(2)}${extension}`, import.meta.url);
      return nextResolve(sourcePath.href, context);
    }
    return nextResolve(specifier, context);
  },
});

const originalDatabaseUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = 'postgresql://unit-test.invalid/obrasaas';

const [
  { applyDirectObraMessageAtomically },
  { sanitizeObraEngineResultForMedicalPrivacy },
] = await Promise.all([
  import('../src/lib/db.js'),
  import('../src/lib/medical-privacy.js'),
]);

after(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  delete globalThis.__obraSaasPrisma;
});

const project = {
  id: 'project-direct-a',
  organizationId: 'organization-direct-a',
  latitude: -34.6,
  longitude: -58.4,
  geofenceMeters: 120,
  organization: {
    timezone: 'America/Montevideo',
    subscriptionPlan: 'PRO',
    subscriptionStatus: 'ACTIVE',
    trialEndsAt: null,
  },
  snapshot: {
    state: { incidents: [], attendance: {}, tasks: {}, alertsCount: 0 },
    version: 4,
  },
};

const worker = {
  id: 'worker-direct-a',
  projectId: project.id,
  phone: '+5491112345678',
  name: 'Persona autorizada',
  role: 'Capataz',
  active: true,
  metadata: { whatsappRole: 'FOREMAN' },
  project: { organizationId: project.organizationId },
};

function transactionDouble({ priorOperation = null } = {}) {
  const calls = [];
  const transaction = {
    async $executeRawUnsafe(query, projectId) {
      calls.push(['lock', query, projectId]);
    },
    project: {
      async findFirst(args) {
        calls.push(['project', args]);
        return structuredClone(project);
      },
    },
    worker: {
      async findFirst(args) {
        calls.push(['worker', args]);
        return structuredClone(worker);
      },
    },
    auditLog: {
      async findUnique(args) {
        calls.push(['operation-read', args]);
        return priorOperation;
      },
      async create(args) {
        calls.push(['operation-create', args]);
        return args.data;
      },
    },
    projectSnapshot: {
      async upsert(args) {
        calls.push(['snapshot', args]);
        return args.update;
      },
    },
    task: {
      async findMany(args) {
        calls.push(['task-find', args]);
        return [];
      },
      async upsert(args) {
        calls.push(['task-upsert', args]);
        return args.create;
      },
      async deleteMany(args) {
        calls.push(['task-delete', args]);
        return { count: 0 };
      },
    },
    conversation: {
      async upsert(args) {
        calls.push(['conversation', args]);
        return { id: 'conversation-direct-a', ...args.create };
      },
    },
    message: {
      async findUnique(args) {
        calls.push(['message-read', args]);
        return null;
      },
      async create(args) {
        calls.push(['message-create', args]);
        return args.data;
      },
    },
  };
  const prisma = {
    async $transaction(callback, options) {
      calls.push(['transaction', options]);
      return callback(transaction);
    },
  };
  return { calls, prisma, transaction };
}

test('direct application couples claim, engine, snapshot, messages and idempotency outcome', async () => {
  const { calls, prisma, transaction } = transactionDouble();
  globalThis.__obraSaasPrisma = prisma;
  let callbackTransaction;

  const applied = await applyDirectObraMessageAtomically({
    event: {
      externalId: 'direct-event-a',
      provider: 'webview',
      from: '+000000000',
      displayName: 'Untrusted name',
      kind: 'text',
      text: 'incidencia',
      timestamp: new Date('2026-07-16T12:00:00.000Z'),
    },
    scope: { projectId: project.id, organizationId: project.organizationId },
    workerId: worker.id,
    operation: {
      id: 'direct-operation-a',
      action: 'webview.attendance.location_applied',
      actorId: 'platform-user-a',
    },
    async beforeApply({ prisma: scopedPrisma, project: scopedProject, worker: scopedWorker }) {
      callbackTransaction = scopedPrisma;
      calls.push(['claim', scopedProject.id, scopedWorker.id]);
    },
    async apply({ prisma: scopedPrisma, state, projectSettings, worker: scopedWorker, event }) {
      calls.push(['apply', projectSettings.id, event.from, event.displayName]);
      assert.equal(scopedPrisma, transaction);
      assert.equal(scopedWorker.id, worker.id);
      assert.equal(projectSettings.timezone, 'America/Montevideo');
      state.incidents.push({ id: 'incident-direct-a' });
      return {
        reply: 'Aplicado',
        flowPrompt: null,
        intent: 'INCIDENT',
        stateChanged: true,
        state,
        worker: scopedWorker,
        operationalProposal: {
          id: 'proposal-a',
          confirmationCode: 'VP-ABCDEF123456',
          type: 'TASK_PROGRESS',
          status: 'PENDING',
          expiresAt: '2026-07-16T12:30:00.000Z',
        },
        newMessages: [
          { externalId: 'direct-event-a', sender: 'user', kind: 'text', text: 'incidencia' },
          { externalId: 'obrasaas-reply:direct-event-a', sender: 'bot', kind: 'text', text: 'Aplicado' },
        ],
      };
    },
  });

  assert.equal(callbackTransaction, transaction);
  assert.equal(applied.alreadyApplied, false);
  assert.equal(applied.result.reply, 'Aplicado');
  assert.deepEqual(
    calls.map(([name]) => name),
    [
      'transaction',
      'lock',
      'project',
      'worker',
      'operation-read',
      'claim',
      'apply',
      'task-find',
      'snapshot',
      'conversation',
      'message-read',
      'message-create',
      'message-read',
      'message-create',
      'operation-create',
    ],
  );
  const snapshotArgs = calls.find(([name]) => name === 'snapshot')[1];
  assert.equal(snapshotArgs.update.version, 5);
  assert.equal(snapshotArgs.update.state.incidents[0].id, 'incident-direct-a');
  const taskProjectionRead = calls.find(([name]) => name === 'task-find')[1];
  assert.deepEqual(taskProjectionRead.where, {
    projectId: project.id,
    metadata: { path: ['source'], equals: 'project-snapshot-v1' },
  });
  assert.equal(calls.some(([name]) => name === 'task-upsert'), false);
  assert.equal(calls.some(([name]) => name === 'task-delete'), false);
  const operationArgs = calls.find(([name]) => name === 'operation-create')[1];
  assert.equal(operationArgs.data.actorId, 'platform-user-a');
  assert.equal(
    operationArgs.data.metadata.initiatedByPlatformUserId,
    'platform-user-a',
  );
  assert.equal(operationArgs.data.metadata.outcome.reply, 'Aplicado');
  assert.equal(
    operationArgs.data.metadata.outcome.operationalProposal.confirmationCode,
    'VP-ABCDEF123456',
  );
  assert.equal(JSON.stringify(operationArgs).includes('+000000000'), false);
});

test('direct field effects fail closed inside the project lock when the subscription is read-only', async () => {
  const { calls, prisma, transaction } = transactionDouble();
  transaction.project.findFirst = async (args) => {
    calls.push(['project', args]);
    return {
      ...structuredClone(project),
      organization: {
        ...structuredClone(project.organization),
        subscriptionStatus: 'PAST_DUE',
      },
    };
  };
  globalThis.__obraSaasPrisma = prisma;
  let applied = false;

  await assert.rejects(
    applyDirectObraMessageAtomically({
      event: {
        externalId: 'direct-blocked-a',
        provider: 'webview',
        kind: 'location',
      },
      scope: { projectId: project.id, organizationId: project.organizationId },
      workerId: worker.id,
      apply: async () => {
        applied = true;
        return null;
      },
    }),
    (error) => error.code === 'SUBSCRIPTION_READ_ONLY' && error.status === 402,
  );

  assert.equal(applied, false);
  assert.deepEqual(calls.map(([name]) => name), ['transaction', 'lock', 'project']);
});

test('an idempotent direct retry returns its stored outcome without reapplying effects', async () => {
  const priorOperation = {
    organizationId: project.organizationId,
    actorId: 'platform-user-a',
    action: 'webview.attendance.location_applied',
    entityType: 'Worker',
    entityId: worker.id,
    metadata: {
      projectId: project.id,
      outcome: {
        reply: 'Ya registrado',
        flowPrompt: null,
        intent: 'ATTENDANCE_LOCATION',
        operationalProposal: {
          id: 'proposal-a',
          confirmationCode: 'VP-ABCDEF123456',
          type: 'TASK_PROGRESS',
          status: 'PENDING',
          expiresAt: '2026-07-16T12:30:00.000Z',
        },
      },
    },
  };
  const { calls, prisma } = transactionDouble({ priorOperation });
  globalThis.__obraSaasPrisma = prisma;
  let appliedAgain = false;

  const result = await applyDirectObraMessageAtomically({
    event: { externalId: 'direct-event-a', kind: 'location' },
    scope: { projectId: project.id, organizationId: project.organizationId },
    workerId: worker.id,
    operation: {
      id: 'direct-operation-a',
      action: 'webview.attendance.location_applied',
      actorId: 'platform-user-a',
    },
    apply: async () => {
      appliedAgain = true;
      return null;
    },
  });

  assert.equal(result.alreadyApplied, true);
  assert.equal(result.result.reply, 'Ya registrado');
  assert.equal(
    result.result.operationalProposal.confirmationCode,
    'VP-ABCDEF123456',
  );
  assert.equal(appliedAgain, false);
  assert.deepEqual(
    calls.map(([name]) => name),
    ['transaction', 'lock', 'project', 'worker', 'operation-read'],
  );
});

test('restricted simulator replies stay redacted across an idempotent retry', async () => {
  const firstTransaction = transactionDouble();
  globalThis.__obraSaasPrisma = firstTransaction.prisma;

  await applyDirectObraMessageAtomically({
    event: {
      externalId: 'direct-private-a',
      provider: 'internal',
      kind: 'audio',
      text: 'Condición privada XQ-17 de Juan.',
      timestamp: new Date('2026-07-16T12:00:00.000Z'),
    },
    scope: { projectId: project.id, organizationId: project.organizationId },
    workerId: worker.id,
    operation: {
      id: 'dashboard-field-simulation:private-a',
      action: 'dashboard.field_simulation.applied',
      actorId: 'platform-user-a',
    },
    apply: async ({ worker: scopedWorker }) => ({
      reply: 'Guardé y transcribí el audio: condición privada XQ-17 de Juan.',
      flowPrompt: null,
      intent: 'DELAY_REPORT',
      stateChanged: false,
      state: structuredClone(project.snapshot.state),
      worker: scopedWorker,
      operationalProposal: null,
      newMessages: [{
        externalId: 'obrasaas-reply:direct-private-a',
        sender: 'bot',
        kind: 'text',
        text: 'Guardé y transcribí el audio: condición privada XQ-17 de Juan.',
        metadata: {
          sensitivity: 'restricted',
          sourceContentRestricted: true,
        },
      }],
    }),
  });

  const operationCreate = firstTransaction.calls.find(
    ([name]) => name === 'operation-create',
  )[1];
  assert.equal(
    operationCreate.data.metadata.outcome.replySensitivity,
    'restricted',
  );

  const retryTransaction = transactionDouble({
    priorOperation: operationCreate.data,
  });
  globalThis.__obraSaasPrisma = retryTransaction.prisma;
  const retried = await applyDirectObraMessageAtomically({
    event: { externalId: 'direct-private-a', provider: 'internal', kind: 'audio' },
    scope: { projectId: project.id, organizationId: project.organizationId },
    workerId: worker.id,
    operation: {
      id: 'dashboard-field-simulation:private-a',
      action: 'dashboard.field_simulation.applied',
      actorId: 'platform-user-a',
    },
    apply: async () => {
      throw new Error('The idempotent retry must not reapply effects.');
    },
  });

  assert.equal(retried.alreadyApplied, true);
  assert.equal(retried.result.__replySensitivity, 'restricted');
  assert.equal(
    Object.prototype.propertyIsEnumerable.call(
      retried.result,
      '__replySensitivity',
    ),
    false,
  );
  const sanitized = sanitizeObraEngineResultForMedicalPrivacy(retried.result);
  assert.doesNotMatch(JSON.stringify(sanitized), /Juan|XQ-17/i);
  assert.match(sanitized.reply, /contenido original permanece restringido/i);
});

test('legacy simulator outcomes fail closed when reply sensitivity is absent', async () => {
  const priorOperation = {
    organizationId: project.organizationId,
    actorId: 'platform-user-a',
    action: 'dashboard.field_simulation.applied',
    entityType: 'Worker',
    entityId: worker.id,
    metadata: {
      projectId: project.id,
      outcome: {
        reply: 'Condición privada antigua XQ-18 de Juan.',
        flowPrompt: null,
        intent: 'DELAY_REPORT',
        operationalProposal: null,
      },
    },
  };
  const { prisma } = transactionDouble({ priorOperation });
  globalThis.__obraSaasPrisma = prisma;

  const retried = await applyDirectObraMessageAtomically({
    event: { externalId: 'direct-private-legacy', provider: 'internal', kind: 'audio' },
    scope: { projectId: project.id, organizationId: project.organizationId },
    workerId: worker.id,
    operation: {
      id: 'dashboard-field-simulation:private-legacy',
      action: 'dashboard.field_simulation.applied',
      actorId: 'platform-user-a',
    },
    apply: async () => {
      throw new Error('The idempotent retry must not reapply effects.');
    },
  });

  const sanitized = sanitizeObraEngineResultForMedicalPrivacy(retried.result);
  assert.doesNotMatch(JSON.stringify(sanitized), /Juan|XQ-18/i);
  assert.match(sanitized.reply, /contenido original permanece restringido/i);
});
