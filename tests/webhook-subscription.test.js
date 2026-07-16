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

const {
  assertWebhookMessageSubscription,
  deliverWhatsAppMessageOutcome,
} = await import(
  '../src/lib/whatsapp/webhook-worker.js'
);

const NOW = new Date('2026-07-16T12:00:00.000Z');

function organization(subscriptionStatus, trialEndsAt = null) {
  return {
    subscriptionPlan: subscriptionStatus === 'TRIALING' ? 'TRIAL' : 'PRO',
    subscriptionStatus,
    trialEndsAt,
  };
}

function prismaFor(currentOrganization) {
  const calls = [];
  return {
    calls,
    organization: {
      async findUnique(query) {
        calls.push(query);
        return currentOrganization;
      },
    },
  };
}

test('webhook drain rejects every read-only subscription with a terminal code', async () => {
  const scenarios = [
    ['expired trial', organization('TRIALING', new Date('2026-07-15T12:00:00.000Z'))],
    ['past due', organization('PAST_DUE')],
    ['canceled', organization('CANCELED')],
    ['suspended', organization('SUSPENDED')],
  ];

  for (const [label, currentOrganization] of scenarios) {
    const prisma = prismaFor(currentOrganization);
    await assert.rejects(
      assertWebhookMessageSubscription(
        { organizationId: 'organization-1' },
        { prisma, now: NOW },
      ),
      (error) => {
        assert.equal(error.code, 'WEBHOOK_SUBSCRIPTION_BLOCKED', label);
        assert.equal(error.status, 402, label);
        return true;
      },
    );
    assert.deepEqual(prisma.calls[0], {
      where: { id: 'organization-1' },
      select: {
        subscriptionPlan: true,
        subscriptionStatus: true,
        trialEndsAt: true,
      },
    });
  }
});

test('webhook drain allows ACTIVE and current TRIALING subscriptions', async () => {
  const allowed = [
    organization('ACTIVE'),
    organization('TRIALING', new Date('2026-07-17T12:00:00.000Z')),
  ];
  for (const currentOrganization of allowed) {
    const entitlements = await assertWebhookMessageSubscription(
      { organizationId: 'organization-1' },
      { prisma: prismaFor(currentOrganization), now: NOW },
    );
    assert.equal(entitlements.canWrite, true);
  }
});

test('Meta delivery revalidates immediately before every provider send', async () => {
  let subscriptionChecks = 0;
  let flowCalls = 0;
  let textCalls = 0;
  const blocked = Object.assign(new Error('blocked before fallback'), {
    code: 'WEBHOOK_SUBSCRIPTION_BLOCKED',
  });

  await assert.rejects(
    deliverWhatsAppMessageOutcome({
      outcome: { reply: 'Respuesta', flowPrompt: 'attendance-check-in' },
      event: {
        externalId: 'wamid-delivery-fence',
        from: '5491112345678',
        phoneNumberId: 'phone-1',
      },
      scope: { organizationId: 'organization-1', projectId: 'project-1' },
    }, {
      assertSubscription: async () => {
        subscriptionChecks += 1;
        if (subscriptionChecks === 2) throw blocked;
      },
      sendFlow: async () => {
        flowCalls += 1;
        return { sent: false, providerMessageId: null };
      },
      sendText: async () => {
        textCalls += 1;
        return { messages: [{ id: 'must-not-send' }] };
      },
      linkMessage: async () => assert.fail('an unsent message must not be linked'),
    }),
    (error) => error === blocked,
  );

  assert.equal(subscriptionChecks, 2);
  assert.equal(flowCalls, 1);
  assert.equal(textCalls, 0);
});

test('Meta text delivery remains operational when the last-moment fence is writable', async () => {
  const calls = [];
  const result = await deliverWhatsAppMessageOutcome({
    outcome: { reply: 'Respuesta permitida', flowPrompt: null },
    event: {
      externalId: 'wamid-delivery-allowed',
      from: '5491112345678',
      phoneNumberId: 'phone-1',
    },
    scope: { organizationId: 'organization-1', projectId: 'project-1' },
  }, {
    assertSubscription: async () => calls.push('subscription-fence'),
    sendText: async () => {
      calls.push('send-text');
      return { messages: [{ id: 'wamid-outbound-allowed' }] };
    },
    linkMessage: async () => {
      calls.push('link-message');
      return true;
    },
  });

  assert.deepEqual(calls, ['subscription-fence', 'send-text', 'link-message']);
  assert.deepEqual(result, {
    flowSent: false,
    providerMessageId: 'wamid-outbound-allowed',
  });
});
