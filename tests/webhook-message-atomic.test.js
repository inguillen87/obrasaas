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

const { applyWebhookMessageAtomically } = await import('../src/lib/db.js');

after(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  delete globalThis.__obraSaasPrisma;
});

test('an accepted message can finish draining after its project is paused', async () => {
  const scope = {
    projectId: 'project-paused-after-ingress',
    organizationId: 'organization-a',
    phoneNumberId: 'phone-a',
  };
  const worker = {
    id: 'worker-a',
    projectId: scope.projectId,
    phone: '+5491112345678',
    name: 'Capataz autorizado',
    role: 'Capataz',
    active: true,
    metadata: { whatsappRole: 'FOREMAN' },
    createdAt: new Date('2026-07-16T12:00:00.000Z'),
    updatedAt: new Date('2026-07-16T12:00:00.000Z'),
    project: { organizationId: scope.organizationId },
  };
  const calls = [];
  const transaction = {
    async $executeRawUnsafe(query, projectId) {
      calls.push(['lock', query, projectId]);
    },
    webhookEvent: {
      async findFirst(args) {
        calls.push(['event-read', args]);
        return { id: 'event-a', appliedAt: null, outcome: null };
      },
      async updateMany(args) {
        calls.push(['event-apply', args]);
        return { count: 1 };
      },
    },
    project: {
      async findFirst(args) {
        calls.push(['project', args]);
        return {
          id: scope.projectId,
          organizationId: scope.organizationId,
          status: 'PAUSED',
          latitude: -34.6037,
          longitude: -58.3816,
          geofenceMeters: 100,
          snapshot: { state: { incidents: [], attendance: {}, tasks: {} } },
          whatsapp: { phoneNumberId: scope.phoneNumberId, enabled: true },
        };
      },
    },
    worker: {
      async findMany(args) {
        calls.push(['worker', args]);
        return [worker];
      },
    },
    conversation: {
      async upsert(args) {
        calls.push(['conversation', args]);
        return { id: 'conversation-a' };
      },
    },
  };
  globalThis.__obraSaasPrisma = {
    async $transaction(callback, options) {
      calls.push(['transaction', options]);
      return callback(transaction);
    },
  };

  const result = await applyWebhookMessageAtomically({
    eventId: 'event-a',
    leaseToken: 'lease-a',
    event: {
      provider: 'meta',
      eventType: 'message',
      externalId: 'wamid.accepted-before-pause',
      phoneNumberId: scope.phoneNumberId,
      from: worker.phone,
    },
    scope,
    apply: async ({ projectSettings, worker: trustedWorker }) => {
      assert.equal(projectSettings.id, scope.projectId);
      assert.equal(trustedWorker.id, worker.id);
      return {
        reply: 'Evento aplicado',
        flowPrompt: null,
        stateChanged: false,
        newMessages: [],
      };
    },
  });

  assert.equal(result.alreadyApplied, false);
  assert.equal(result.outcome.reply, 'Evento aplicado');
  const projectQuery = calls.find(([name]) => name === 'project')[1];
  assert.deepEqual(projectQuery.where, {
    id: scope.projectId,
    organizationId: scope.organizationId,
    status: { in: ['ACTIVE', 'PAUSED'] },
  });
  assert.equal(calls.some(([name]) => name === 'event-apply'), true);
});

for (const terminalStatus of ['COMPLETED', 'ARCHIVED']) {
  test(`an accepted message cannot mutate a project after it becomes ${terminalStatus.toLowerCase()}`, async () => {
    const scope = {
      projectId: `project-${terminalStatus.toLowerCase()}`,
      organizationId: 'organization-a',
      phoneNumberId: 'phone-a',
    };
    const calls = [];
    const transaction = {
      async $executeRawUnsafe(query, projectId) {
        calls.push(['lock', query, projectId]);
      },
      webhookEvent: {
        async findFirst(args) {
          calls.push(['event-read', args]);
          return { id: 'event-terminal', appliedAt: null, outcome: null };
        },
      },
      project: {
        async findFirst(args) {
          calls.push(['project', args]);
          return args.where.status.in.includes(terminalStatus)
            ? {
                id: scope.projectId,
                organizationId: scope.organizationId,
                status: terminalStatus,
              }
            : null;
        },
      },
    };
    globalThis.__obraSaasPrisma = {
      async $transaction(callback) {
        return callback(transaction);
      },
    };

    await assert.rejects(
      applyWebhookMessageAtomically({
        eventId: 'event-terminal',
        leaseToken: 'lease-terminal',
        event: {
          provider: 'meta',
          eventType: 'message',
          externalId: `wamid.${terminalStatus.toLowerCase()}`,
          phoneNumberId: scope.phoneNumberId,
          from: '+5491112345678',
        },
        scope,
        apply: async () => {
          throw new Error('The engine must not run for a terminal project.');
        },
      }),
      (error) => error.code === 'WEBHOOK_MESSAGE_SCOPE_MISMATCH',
    );

    const projectQuery = calls.find(([name]) => name === 'project')[1];
    assert.deepEqual(projectQuery.where.status, { in: ['ACTIVE', 'PAUSED'] });
    assert.equal(calls.some(([name]) => name === 'event-apply'), false);
  });
}
