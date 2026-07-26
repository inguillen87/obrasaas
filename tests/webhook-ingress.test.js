import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import {
  normalizeMetaWebhook,
  verifyMetaSignature,
} from '../src/lib/whatsapp/meta.js';
import {
  assertMetaWebhookBatchLimit,
  META_WEBHOOK_MAX_BODY_BYTES,
  META_WEBHOOK_MAX_UPDATES,
  MetaWebhookBatchError,
  persistDurableMetaWebhookBatch,
} from '../src/lib/whatsapp/webhook-ingress.js';
import { resolveWhatsAppConnectionScopesBulk } from '../src/lib/whatsapp/webhook-scope.js';

function messageUpdate(index, phoneNumberId = '106540352242922') {
  return {
    field: 'messages',
    value: {
      messaging_product: 'whatsapp',
      metadata: {
        display_phone_number: '15550783881',
        phone_number_id: phoneNumberId,
      },
      contacts: [{
        profile: { name: `Worker ${index}` },
        wa_id: `1650555${String(index).padStart(4, '0')}`,
      }],
      messages: [{
        from: `1650555${String(index).padStart(4, '0')}`,
        id: `wamid.synthetic-${index}`,
        timestamp: String(1_784_030_400 + index),
        type: 'text',
        text: { body: `Parte de obra ${index}` },
      }],
    },
  };
}

function syntheticPayload(updateCount) {
  return {
    object: 'whatsapp_business_account',
    entry: [{
      id: '102290129340398',
      changes: Array.from({ length: updateCount }, (_, index) => messageUpdate(index)),
    }],
  };
}

function connection({
  phoneNumberId = '106540352242922',
  whatsappBusinessId = '102290129340398',
  displayPhoneNumber = '15550783881',
  projectId = 'project-1',
  organizationId = 'organization-1',
  projectStatus = 'ACTIVE',
  subscriptionStatus = 'ACTIVE',
  trialEndsAt = null,
} = {}) {
  return {
    enabled: true,
    phoneNumberId,
    whatsappBusinessId,
    displayPhoneNumber,
    project: {
      id: projectId,
      organizationId,
      status: projectStatus,
      organization: {
        subscriptionPlan: subscriptionStatus === 'TRIALING' ? 'TRIAL' : 'PRO',
        subscriptionStatus,
        trialEndsAt,
      },
    },
  };
}

function fakeDurablePrisma(connections = [connection()]) {
  const storedKeys = new Set();
  const scopeQueries = [];
  const insertCalls = [];
  return {
    scopeQueries,
    insertCalls,
    storedKeys,
    whatsAppConnection: {
      async findMany(query) {
        scopeQueries.push(query);
        return connections;
      },
    },
    webhookEvent: {
      async createMany({ data, skipDuplicates }) {
        insertCalls.push({ data, skipDuplicates });
        let count = 0;
        for (const row of data) {
          const key = `${row.provider}\u0000${row.externalId}`;
          if (storedKeys.has(key)) continue;
          storedKeys.add(key);
          count += 1;
        }
        return { count };
      },
    },
  };
}

test('Meta webhook envelope follows the provider 3 MiB delivery contract', () => {
  assert.equal(META_WEBHOOK_MAX_BODY_BYTES, 3 * 1024 * 1024);
});

test('signed Meta batch persists 1,000 updates in bulk and replay is entirely idempotent', async () => {
  const payload = syntheticPayload(META_WEBHOOK_MAX_UPDATES);
  const rawBody = JSON.stringify(payload);
  const secret = 'synthetic-meta-app-secret';
  const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  assert.ok(Buffer.byteLength(rawBody) < META_WEBHOOK_MAX_BODY_BYTES);
  assert.equal(verifyMetaSignature(rawBody, `sha256=${signature}`, secret), true);
  assert.equal(assertMetaWebhookBatchLimit(payload), META_WEBHOOK_MAX_UPDATES);

  const events = normalizeMetaWebhook(payload);
  assert.equal(events.length, META_WEBHOOK_MAX_UPDATES);

  const prisma = fakeDurablePrisma();
  const first = await persistDurableMetaWebhookBatch(prisma, events);
  assert.deepEqual(first, {
    accepted: META_WEBHOOK_MAX_UPDATES,
    duplicate: 0,
    unknownConnections: 0,
    projectIds: ['project-1'],
  });
  assert.equal(prisma.scopeQueries.length, 1);
  assert.equal(prisma.insertCalls.length, 1);
  assert.equal(prisma.insertCalls[0].skipDuplicates, true);
  assert.equal(prisma.insertCalls[0].data.length, META_WEBHOOK_MAX_UPDATES);

  const replay = await persistDurableMetaWebhookBatch(prisma, events);
  assert.deepEqual(replay, {
    accepted: 0,
    duplicate: META_WEBHOOK_MAX_UPDATES,
    unknownConnections: 0,
    projectIds: ['project-1'],
  });
  assert.equal(prisma.scopeQueries.length, 2);
  assert.equal(prisma.insertCalls.length, 2);
  assert.equal(prisma.storedKeys.size, META_WEBHOOK_MAX_UPDATES);
});

test('WebhookEvent persistence excludes raw Flow tokens and sensitive response values', async () => {
  const rawFlowToken = `ofs1.1f967f35-9f99-4db0-bd42-2d88f734cc72.${'A'.repeat(43)}`;
  const sensitiveDescription = 'CUIT 20-12345678-9 y CBU 0000000000000000000000';
  const events = normalizeMetaWebhook({
    object: 'whatsapp_business_account',
    entry: [{
      id: '102290129340398',
      changes: [{
        field: 'messages',
        value: {
          metadata: {
            display_phone_number: '15550783881',
            phone_number_id: '106540352242922',
          },
          messages: [{
            from: '16505550001',
            id: 'wamid.flow-sensitive',
            timestamp: '1784030400',
            type: 'interactive',
            interactive: {
              type: 'nfm_reply',
              nfm_reply: {
                name: 'flow',
                body: 'Incidencia enviada',
                response_json: JSON.stringify({
                  flow_token: rawFlowToken,
                  flow_type: 'incident',
                  severity: 'critical',
                  area: 'Planta baja',
                  description: sensitiveDescription,
                  task_ref: 'task-structure-02',
                }),
              },
            },
          }],
        },
      }],
    }],
  });
  const prisma = fakeDurablePrisma();

  const result = await persistDurableMetaWebhookBatch(prisma, events);

  assert.equal(result.accepted, 1);
  const stored = prisma.insertCalls[0].data[0].payload;
  const serialized = JSON.stringify(stored);
  assert.equal(serialized.includes(rawFlowToken), false);
  assert.equal(serialized.includes(sensitiveDescription), false);
  assert.deepEqual(stored.event.interactive.response, {
    flow_type: 'incident',
    severity: 'critical',
    area: 'Planta baja',
    description: '[contenido restringido]',
    task_ref: 'task-structure-02',
  });
  assert.deepEqual(
    JSON.parse(stored.event.raw.interactive.nfm_reply.response_json),
    stored.event.interactive.response,
  );
  assert.deepEqual(stored.event.interactive.flowToken, {
    sessionId: '1f967f35-9f99-4db0-bd42-2d88f734cc72',
    tokenSha256: crypto.createHash('sha256').update(rawFlowToken).digest('hex'),
  });
});

test('Meta batch limit counts official changes updates and rejects update 1,001', () => {
  assert.equal(assertMetaWebhookBatchLimit(syntheticPayload(1_000)), 1_000);
  assert.throws(
    () => assertMetaWebhookBatchLimit(syntheticPayload(1_001)),
    (error) => (
      error instanceof MetaWebhookBatchError
      && error.code === 'META_WEBHOOK_BATCH_TOO_LARGE'
      && error.status === 413
    ),
  );
});

test('bulk scope resolution uses one query and preserves phone, WABA and display boundaries', async () => {
  const projectOne = connection();
  const projectTwo = connection({
    phoneNumberId: '106540352242923',
    whatsappBusinessId: '102290129340399',
    displayPhoneNumber: '15550783882',
    projectId: 'project-2',
    organizationId: 'organization-2',
  });
  const duplicateDisplay = connection({
    phoneNumberId: '106540352242924',
    whatsappBusinessId: '102290129340400',
    displayPhoneNumber: '15550783882',
    projectId: 'project-3',
    organizationId: 'organization-3',
  });
  const prisma = fakeDurablePrisma([projectOne, projectTwo, duplicateDisplay]);
  const events = [
    { eventType: 'message', phoneNumberId: projectOne.phoneNumberId },
    {
      eventType: 'account',
      phoneNumberId: undefined,
      whatsappBusinessId: projectTwo.whatsappBusinessId,
    },
    {
      eventType: 'account',
      phoneNumberId: undefined,
      displayPhoneNumber: projectTwo.displayPhoneNumber,
    },
    {
      eventType: 'account',
      phoneNumberId: 'unknown-phone',
      whatsappBusinessId: projectOne.whatsappBusinessId,
    },
  ];

  const scopes = await resolveWhatsAppConnectionScopesBulk(prisma, events);
  assert.equal(prisma.scopeQueries.length, 1);
  assert.deepEqual(scopes.map((matches) => matches.map((scope) => scope.projectId)), [
    ['project-1'],
    ['project-2'],
    [],
    [],
  ]);
});

test('paused projects reject new messages but keep delivery and account events routable', async () => {
  const pausedConnection = connection({ projectStatus: 'PAUSED' });
  const prisma = fakeDurablePrisma([pausedConnection]);
  const scopes = await resolveWhatsAppConnectionScopesBulk(prisma, [
    { eventType: 'message', phoneNumberId: pausedConnection.phoneNumberId },
    { eventType: 'status', phoneNumberId: pausedConnection.phoneNumberId },
    { eventType: 'account', phoneNumberId: pausedConnection.phoneNumberId },
  ]);

  assert.deepEqual(scopes.map((matches) => matches.map((scope) => scope.projectId)), [
    [],
    ['project-1'],
    ['project-1'],
  ]);
  assert.equal(prisma.scopeQueries.length, 1);
  assert.equal(Object.hasOwn(prisma.scopeQueries[0].where, 'project'), false);
});

test('blocked subscriptions terminally redact message ingress while status and account sync remain operational', async () => {
  const now = new Date('2026-07-16T12:00:00.000Z');
  const blockedScenarios = [
    { label: 'expired trial', subscriptionStatus: 'TRIALING', trialEndsAt: new Date('2026-07-15T12:00:00.000Z') },
    { label: 'past due', subscriptionStatus: 'PAST_DUE' },
    { label: 'canceled', subscriptionStatus: 'CANCELED' },
    { label: 'suspended', subscriptionStatus: 'SUSPENDED' },
  ];

  for (const scenario of blockedScenarios) {
    const blockedConnection = connection(scenario);
    const prisma = fakeDurablePrisma([blockedConnection]);
    const events = [
      {
        provider: 'meta',
        externalId: `wamid-${scenario.label}`,
        eventType: 'message',
        phoneNumberId: blockedConnection.phoneNumberId,
        timestamp: now,
        text: 'contenido que debe quedar redactado',
      },
      {
        provider: 'meta',
        externalId: `status-${scenario.label}`,
        eventType: 'status',
        phoneNumberId: blockedConnection.phoneNumberId,
        timestamp: now,
      },
      {
        provider: 'meta',
        externalId: `account-${scenario.label}`,
        eventType: 'account',
        phoneNumberId: blockedConnection.phoneNumberId,
        timestamp: now,
      },
    ];

    const result = await persistDurableMetaWebhookBatch(prisma, events, { now });
    assert.equal(result.accepted, 3, scenario.label);
    assert.deepEqual(result.projectIds, ['project-1'], scenario.label);

    const rows = prisma.insertCalls[0].data;
    const messageRow = rows.find((row) => row.eventType === 'message');
    assert.equal(messageRow.status, 'FAILED', scenario.label);
    assert.match(messageRow.lastError, /WEBHOOK_SUBSCRIPTION_BLOCKED/, scenario.label);
    assert.deepEqual(messageRow.payload, { version: 1, redacted: true }, scenario.label);
    assert.equal(JSON.stringify(messageRow).includes('contenido que debe quedar redactado'), false);

    for (const eventType of ['status', 'account']) {
      const row = rows.find((candidate) => candidate.eventType === eventType);
      assert.equal(Object.hasOwn(row, 'status'), false, `${scenario.label}: ${eventType}`);
      assert.equal(row.payload.redacted, undefined, `${scenario.label}: ${eventType}`);
    }
  }
});

test('ACTIVE and current TRIALING subscriptions enqueue WhatsApp messages normally', async () => {
  const now = new Date('2026-07-16T12:00:00.000Z');
  const allowedConnections = [
    connection({ projectId: 'project-active', organizationId: 'organization-active' }),
    connection({
      phoneNumberId: 'phone-trial',
      projectId: 'project-trial',
      organizationId: 'organization-trial',
      subscriptionStatus: 'TRIALING',
      trialEndsAt: new Date('2026-07-17T12:00:00.000Z'),
    }),
  ];

  for (const allowedConnection of allowedConnections) {
    const prisma = fakeDurablePrisma([allowedConnection]);
    const result = await persistDurableMetaWebhookBatch(prisma, [{
      provider: 'meta',
      externalId: `wamid-${allowedConnection.project.id}`,
      eventType: 'message',
      phoneNumberId: allowedConnection.phoneNumberId,
      timestamp: now,
      text: 'parte permitido',
    }], { now });
    const row = prisma.insertCalls[0].data[0];
    assert.equal(Object.hasOwn(row, 'status'), false);
    assert.equal(row.payload.event.text, 'parte permitido');
    assert.deepEqual(result.projectIds, [allowedConnection.project.id]);
  }
});

test('WABA account events fan out only inside one tenant organization', async () => {
  const sameTenantA = connection({
    phoneNumberId: 'phone-a',
    whatsappBusinessId: 'waba-shared',
    projectId: 'project-a',
    organizationId: 'organization-a',
  });
  const sameTenantB = connection({
    phoneNumberId: 'phone-b',
    whatsappBusinessId: 'waba-shared',
    projectId: 'project-b',
    organizationId: 'organization-a',
  });
  const crossTenant = connection({
    phoneNumberId: 'phone-c',
    whatsappBusinessId: 'waba-cross-tenant',
    projectId: 'project-c',
    organizationId: 'organization-b',
  });
  const otherTenant = connection({
    phoneNumberId: 'phone-d',
    whatsappBusinessId: 'waba-cross-tenant',
    projectId: 'project-d',
    organizationId: 'organization-c',
  });
  const prisma = fakeDurablePrisma([sameTenantA, sameTenantB, crossTenant, otherTenant]);
  const scopes = await resolveWhatsAppConnectionScopesBulk(prisma, [
    { eventType: 'account', whatsappBusinessId: 'waba-shared' },
    { eventType: 'account', whatsappBusinessId: 'waba-cross-tenant' },
  ]);

  assert.deepEqual(scopes[0].map((scope) => scope.projectId), ['project-a', 'project-b']);
  assert.deepEqual(scopes[1], []);
});
