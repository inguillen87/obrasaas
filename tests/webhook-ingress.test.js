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
} = {}) {
  return {
    enabled: true,
    phoneNumberId,
    whatsappBusinessId,
    displayPhoneNumber,
    project: { id: projectId, organizationId, status: projectStatus },
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
