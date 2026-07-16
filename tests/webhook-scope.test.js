import assert from 'node:assert/strict';
import test from 'node:test';

import { scopedWebhookExternalId } from '../src/lib/webhook-queue.js';
import {
  resolveWhatsAppConnectionScopes,
  validateStoredWebhookScope,
} from '../src/lib/whatsapp/webhook-scope.js';

function connection({
  enabled = true,
  phoneNumberId = 'phone-1',
  whatsappBusinessId = 'waba-1',
  displayPhoneNumber = '+54 9 11 5555 0001',
  projectId = 'project-1',
  organizationId = 'organization-1',
} = {}) {
  return {
    enabled,
    phoneNumberId,
    whatsappBusinessId,
    displayPhoneNumber,
    project: { id: projectId, organizationId },
  };
}

function resolvingPrisma({ unique = null, many = [] } = {}) {
  const calls = [];
  return {
    calls,
    whatsAppConnection: {
      async findUnique(query) {
        calls.push(['findUnique', query]);
        return unique;
      },
      async findMany(query) {
        calls.push(['findMany', query]);
        return many;
      },
    },
  };
}

test('phone_number_id resolves only an exact enabled connection', async () => {
  const prisma = resolvingPrisma({ unique: connection() });
  const scopes = await resolveWhatsAppConnectionScopes(prisma, {
    eventType: 'message',
    phoneNumberId: ' phone-1 ',
    whatsappBusinessId: 'waba-other',
    displayPhoneNumber: '+54 9 11 9999 9999',
  });

  assert.deepEqual(scopes, [{
    projectId: 'project-1',
    organizationId: 'organization-1',
    phoneNumberId: 'phone-1',
    whatsappBusinessId: 'waba-1',
    displayPhoneNumber: '+54 9 11 5555 0001',
  }]);
  assert.equal(prisma.calls.length, 1);
  assert.deepEqual(prisma.calls[0][1].where, { phoneNumberId: 'phone-1' });
});

test('supplied unknown, blank or disabled phone_number_id never falls back for account events', async () => {
  for (const phoneNumberId of ['unknown-phone', '   ']) {
    const prisma = resolvingPrisma({
      many: [connection({ phoneNumberId: 'fallback-phone' })],
    });
    assert.deepEqual(await resolveWhatsAppConnectionScopes(prisma, {
      eventType: 'account',
      phoneNumberId,
      whatsappBusinessId: 'waba-1',
      displayPhoneNumber: '+54 9 11 5555 0001',
    }), []);
    assert.equal(prisma.calls.some(([method]) => method === 'findMany'), false);
  }

  const disabledPrisma = resolvingPrisma({ unique: connection({ enabled: false }) });
  assert.deepEqual(await resolveWhatsAppConnectionScopes(disabledPrisma, {
    eventType: 'account',
    phoneNumberId: 'phone-1',
    whatsappBusinessId: 'waba-1',
  }), []);
  assert.equal(disabledPrisma.calls.some(([method]) => method === 'findMany'), false);
});

test('WABA/display fallback is restricted to account events without phone_number_id', async () => {
  const messagePrisma = resolvingPrisma({ many: [connection()] });
  assert.deepEqual(await resolveWhatsAppConnectionScopes(messagePrisma, {
    eventType: 'message',
    whatsappBusinessId: 'waba-1',
  }), []);
  assert.equal(messagePrisma.calls.length, 0);

  const accountPrisma = resolvingPrisma({ many: [connection(), connection({
    phoneNumberId: 'phone-2',
    projectId: 'project-2',
  })] });
  const scopes = await resolveWhatsAppConnectionScopes(accountPrisma, {
    eventType: 'account',
    whatsappBusinessId: 'waba-1',
    displayPhoneNumber: 'mismatched-display-does-not-override-waba',
  });
  assert.equal(scopes.length, 2);
  assert.deepEqual(accountPrisma.calls[0][1].where, {
    enabled: true,
    whatsappBusinessId: 'waba-1',
  });

  const crossTenantWabaPrisma = resolvingPrisma({ many: [connection(), connection({
    phoneNumberId: 'phone-2',
    projectId: 'project-2',
    organizationId: 'organization-2',
  })] });
  assert.deepEqual(await resolveWhatsAppConnectionScopes(crossTenantWabaPrisma, {
    eventType: 'account',
    whatsappBusinessId: 'waba-1',
  }), []);

  const ambiguousDisplayPrisma = resolvingPrisma({ many: [connection(), connection({
    phoneNumberId: 'phone-2',
    projectId: 'project-2',
  })] });
  assert.deepEqual(await resolveWhatsAppConnectionScopes(ambiguousDisplayPrisma, {
    eventType: 'account',
    displayPhoneNumber: '+54 9 11 5555 0001',
  }), []);
});

test('stored webhook validation binds queue, provider, project, organization and phone scope', async () => {
  const queries = [];
  const prisma = {
    whatsAppConnection: {
      async findFirst(query) {
        queries.push(query);
        return { id: 'connection-1' };
      },
    },
  };
  const event = {
    provider: 'meta',
    eventType: 'status',
    externalId: 'status:wamid-1:delivered:1',
    phoneNumberId: 'phone-1',
  };
  const scope = {
    projectId: 'project-1',
    organizationId: 'organization-1',
    phoneNumberId: 'phone-1',
  };
  const leasedEvent = {
    provider: 'meta',
    projectId: 'project-1',
    eventType: 'status',
    externalId: scopedWebhookExternalId('project-1', event.externalId),
  };

  assert.deepEqual(await validateStoredWebhookScope(prisma, leasedEvent, event, scope), scope);
  assert.deepEqual(queries[0].where, {
    projectId: 'project-1',
    phoneNumberId: 'phone-1',
    enabled: true,
    project: { organizationId: 'organization-1' },
  });

  await assert.rejects(
    validateStoredWebhookScope(prisma, leasedEvent, { ...event, phoneNumberId: 'phone-2' }, scope),
    (error) => error.code === 'WEBHOOK_MESSAGE_SCOPE_MISMATCH',
  );
  await assert.rejects(
    validateStoredWebhookScope(prisma, { ...leasedEvent, provider: 'stripe' }, event, scope),
    (error) => error.code === 'WEBHOOK_MESSAGE_SCOPE_MISMATCH',
  );
  assert.equal(queries.length, 1);
});

test('stored webhook validation rejects a scope no longer owned by an active tenant connection', async () => {
  const prisma = {
    whatsAppConnection: {
      async findFirst() {
        return null;
      },
    },
  };
  const event = {
    provider: 'meta',
    eventType: 'account',
    externalId: 'account:waba-1:update',
    phoneNumberId: 'phone-1',
  };
  const scope = {
    projectId: 'project-1',
    organizationId: 'organization-2',
    phoneNumberId: 'phone-1',
  };
  const leasedEvent = {
    provider: 'meta',
    projectId: 'project-1',
    eventType: 'account',
    externalId: scopedWebhookExternalId('project-1', event.externalId),
  };

  await assert.rejects(
    validateStoredWebhookScope(prisma, leasedEvent, event, scope),
    (error) => error.code === 'WEBHOOK_MESSAGE_SCOPE_MISMATCH',
  );
});
