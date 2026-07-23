import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

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

const { applyWhatsAppTemplateStatusEvent, synchronizeWhatsAppConnectionStatus } = await import(
  '../src/lib/whatsapp/webhook-worker.js'
);

const WEBHOOK_AT = new Date('2026-07-17T12:00:00.000Z');
const VERIFIED_AT = new Date('2026-07-17T12:00:01.000Z');

function accountEvent(overrides = {}) {
  return {
    eventType: 'account',
    field: 'account_update',
    event: 'VERIFIED_ACCOUNT',
    decision: null,
    value: {},
    timestamp: WEBHOOK_AT,
    ...overrides,
  };
}

test('status webhook retries its CAS and preserves concurrently published Flow metadata', async () => {
  const versions = [
    {
      id: 'connection-1',
      metadata: { embeddedSignup: { completedAt: 'earlier' } },
      updatedAt: new Date('2026-07-17T11:59:58.000Z'),
    },
    {
      id: 'connection-1',
      metadata: {
        embeddedSignup: { completedAt: 'earlier' },
        whatsappFlows: { daily_report: { id: 'flow-active', status: 'PUBLISHED' } },
        whatsappFlowDrafts: { site_checkin: { id: 'flow-draft', status: 'DRAFT' } },
        whatsappFlowDataEndpoint: { endpointId: 'endpoint-1' },
      },
      updatedAt: new Date('2026-07-17T11:59:59.000Z'),
    },
  ];
  const writes = [];
  const prisma = {
    whatsAppConnection: {
      async findUnique() {
        return versions.shift();
      },
      async updateMany(query) {
        writes.push(query);
        return { count: writes.length === 1 ? 0 : 1 };
      },
    },
  };

  const result = await synchronizeWhatsAppConnectionStatus(
    accountEvent(),
    { phoneNumberId: 'phone-1' },
    { prisma, now: VERIFIED_AT },
  );

  assert.deepEqual(result, { updated: true });
  assert.equal(writes.length, 2);
  assert.equal(writes[1].data.metadata.whatsappFlows.daily_report.id, 'flow-active');
  assert.equal(writes[1].data.metadata.whatsappFlowDrafts.site_checkin.id, 'flow-draft');
  assert.equal(writes[1].data.metadata.whatsappFlowDataEndpoint.endpointId, 'endpoint-1');
  assert.deepEqual(writes[1].data.metadata.metaWebhook, {
    field: 'account_update',
    event: 'VERIFIED_ACCOUNT',
    decision: null,
    value: {},
    receivedAt: WEBHOOK_AT.toISOString(),
  });
  assert.equal(writes[1].data.connectionStatus, 'CONNECTED');
  assert.equal(writes[1].data.lastError, null);
  assert.equal(writes[1].data.lastVerifiedAt, VERIFIED_AT);
  assert.equal(Object.hasOwn(writes[1].data, 'flowProvisioningLeaseId'), false);
});

test('status webhook yields a retryable conflict instead of overwriting a newer connection', async () => {
  let reads = 0;
  const prisma = {
    whatsAppConnection: {
      async findUnique() {
        reads += 1;
        return {
          id: 'connection-1',
          metadata: { revision: reads },
          updatedAt: new Date(`2026-07-17T12:00:0${reads}.000Z`),
        };
      },
      async updateMany() {
        return { count: 0 };
      },
    },
  };

  await assert.rejects(
    synchronizeWhatsAppConnectionStatus(
      accountEvent(),
      { phoneNumberId: 'phone-1' },
      { prisma, now: VERIFIED_AT, maxAttempts: 2 },
    ),
    (error) => error.code === 'WHATSAPP_CONNECTION_WRITE_CONFLICT',
  );
  assert.equal(reads, 2);
});

test('status webhook treats a connection removed during retry as a safe no-op', async () => {
  const versions = [
    {
      id: 'connection-1',
      metadata: {},
      updatedAt: new Date('2026-07-17T12:00:00.000Z'),
    },
    null,
  ];
  const prisma = {
    whatsAppConnection: {
      async findUnique() {
        return versions.shift();
      },
      async updateMany() {
        return { count: 0 };
      },
    },
  };

  assert.deepEqual(
    await synchronizeWhatsAppConnectionStatus(
      accountEvent(),
      { phoneNumberId: 'phone-1' },
      { prisma, now: VERIFIED_AT },
    ),
    { updated: false, reason: 'not_found' },
  );
});

test('template status events use the dedicated owned-template synchronizer', async () => {
  const calls = [];
  const event = accountEvent({
    field: 'message_template_status_update',
    event: 'APPROVED',
    whatsappBusinessId: '123456789012345',
    value: { message_template_id: '555555555555555' },
  });
  const scope = {
    projectId: 'project-a',
    whatsappBusinessId: '123456789012345',
  };
  const prisma = { marker: 'tenant-prisma' };
  const result = await applyWhatsAppTemplateStatusEvent(event, scope, {
    prisma,
    synchronize: async (...args) => {
      calls.push(args);
      return { updated: true, status: 'APPROVED' };
    },
  });

  assert.deepEqual(result, { updated: true, status: 'APPROVED' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], event);
  assert.equal(calls[0][1], scope);
  assert.equal(calls[0][2].prisma, prisma);
});
