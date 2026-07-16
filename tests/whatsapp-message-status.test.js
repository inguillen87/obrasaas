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
const {
  nextWhatsAppMessageStatus,
  updateWhatsAppMessageStatus,
} = await import('../src/lib/db.js');

after(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  delete globalThis.__obraSaasPrisma;
});

test('WhatsApp delivery states advance monotonically through accepted, sent, delivered and read', () => {
  assert.equal(nextWhatsAppMessageStatus(null, 'accepted'), 'accepted');
  assert.equal(nextWhatsAppMessageStatus('accepted', 'sent'), 'sent');
  assert.equal(nextWhatsAppMessageStatus('sent', 'delivered'), 'delivered');
  assert.equal(nextWhatsAppMessageStatus('delivered', 'read'), 'read');
  assert.equal(nextWhatsAppMessageStatus('read', 'delivered'), 'read');
  assert.equal(nextWhatsAppMessageStatus('delivered', 'sent'), 'delivered');
  assert.equal(nextWhatsAppMessageStatus('sent', 'accepted'), 'sent');
});

test('failed never degrades delivered/read and only a later delivery can recover a failure', () => {
  assert.equal(nextWhatsAppMessageStatus('accepted', 'failed'), 'failed');
  assert.equal(nextWhatsAppMessageStatus('sent', 'failed'), 'failed');
  assert.equal(nextWhatsAppMessageStatus('delivered', 'failed'), 'delivered');
  assert.equal(nextWhatsAppMessageStatus('read', 'failed'), 'read');
  assert.equal(nextWhatsAppMessageStatus('failed', 'sent'), 'failed');
  assert.equal(nextWhatsAppMessageStatus('failed', 'delivered'), 'delivered');
  assert.equal(nextWhatsAppMessageStatus('failed', 'read'), 'read');
});

test('unknown late provider states cannot overwrite a known delivery state', () => {
  assert.equal(nextWhatsAppMessageStatus('', 'custom'), 'custom');
  assert.equal(nextWhatsAppMessageStatus('delivered', 'custom'), 'delivered');
  assert.equal(nextWhatsAppMessageStatus('custom', 'read'), 'read');
  assert.equal(nextWhatsAppMessageStatus('custom', 'another-custom'), 'custom');
});

test('durable delivery updates retain the tenant conversation boundary', async () => {
  process.env.DATABASE_URL = 'postgresql://unit-test.invalid/obrasaas';
  let updated = false;
  const project = {
    id: 'project-status-a',
    organizationId: 'organization-status-a',
    organization: { id: 'organization-status-a' },
    whatsapp: null,
  };
  const transaction = {
    $executeRawUnsafe: async () => undefined,
    conversation: {
      upsert: async () => ({ id: 'conversation-status-a' }),
    },
    message: {
      findUnique: async () => ({
        id: 'message-status-a',
        conversationId: 'conversation-other-tenant',
        status: 'sent',
      }),
      update: async () => {
        updated = true;
      },
    },
  };
  globalThis.__obraSaasPrisma = {
    project: {
      findFirst: async () => project,
    },
    $transaction: async (callback) => callback(transaction),
  };

  await assert.rejects(
    updateWhatsAppMessageStatus({
      providerMessageId: 'wamid.status-a',
      status: 'read',
      scope: {
        organization: { id: project.organizationId },
        project: { id: project.id },
      },
    }),
    (error) => error.code === 'WEBHOOK_MESSAGE_SCOPE_MISMATCH',
  );
  assert.equal(updated, false);
});
