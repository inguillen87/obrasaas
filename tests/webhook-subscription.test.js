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
  processMessageEvent,
  trySendPublishedFlow,
} = await import(
  '../src/lib/whatsapp/webhook-worker.js'
);
const { ATTENDANCE_ACTIONS, generateWebviewToken } = await import('../src/lib/auth.js');
const { readAppliedMessageWebhookOutcome } = await import('../src/lib/webhook-queue.js');

const NOW = new Date('2026-07-16T12:00:00.000Z');

function automaticDeliveryJournal(calls, {
  dispatch = true,
  state = dispatch ? 'sending' : 'accepted',
  providerMessageId = null,
  settleState = null,
} = {}) {
  return {
    async claimDelivery(input) {
      calls.push('claim-delivery');
      assert.equal(input.inboundExternalId.startsWith('wamid'), true);
      return dispatch
        ? {
            dispatch: true,
            state: 'sending',
            claim: {
              version: 1,
              eventId: input.eventId,
              leaseToken: input.leaseToken,
              projectId: input.scope.projectId,
              organizationId: input.scope.organizationId,
              phoneNumberId: input.scope.phoneNumberId,
              messageId: 'automatic-message-a',
              outboundExternalId: `obrasaas-reply:${input.inboundExternalId}`,
            },
          }
        : { dispatch: false, state, providerMessageId };
    },
    async settleDelivery(input) {
      calls.push(`settle-delivery:${input.state}`);
      return {
        settled: true,
        state: settleState || input.state,
        providerMessageId: input.providerMessageId || providerMessageId,
      };
    },
    async releaseDelivery(input) {
      calls.push('release-delivery');
      assert.equal(input.claim.messageId, 'automatic-message-a');
      return { released: true, state: 'prepared' };
    },
  };
}

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

test('published Flow delivery reuses the persisted token and records the provider fence', async () => {
  const calls = [];
  const sessionId = '1f967f35-9f99-4db0-bd42-2d88f734cc72';
  const scope = {
    organizationId: 'organization-1',
    projectId: 'project-1',
    phoneNumberId: '123456789012345',
  };
  const prisma = {
    whatsAppConnection: {
      async findUnique() {
        calls.push('connection');
        return {
          metadata: {
            whatsappFlows: {
              'incident-report': {
                id: '987654321012345',
                name: 'ObraSaaS | Incidencia de obra',
                status: 'PUBLISHED',
              },
            },
          },
        };
      },
    },
  };

  const result = await trySendPublishedFlow({
    blueprintKey: 'incident-report',
    flowSessionId: sessionId,
    event: {
      from: '+5491112345678',
      externalId: 'wamid.flow-source',
    },
    scope,
  }, {
    prisma,
    loadSentFence: async (selectedPrisma, input) => {
      calls.push('load-sent-fence');
      assert.equal(selectedPrisma, prisma);
      assert.deepEqual(input, {
        sessionId,
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        phoneNumberId: scope.phoneNumberId,
        recipientPhone: '+5491112345678',
        blueprintKey: 'incident-report',
        sourceExternalId: 'wamid.flow-source',
      });
      return {
        session: {
          id: sessionId,
          flowId: '987654321012345',
          screenId: 'INCIDENT_REPORT',
          flowType: 'incident',
          deliveryAttemptedAt: null,
          deliveryRejectedAt: null,
          sentAt: null,
          consumedAt: null,
          providerMessageId: null,
        },
      };
    },
    loadSession: async (selectedPrisma, input) => {
      calls.push('load-session');
      assert.equal(selectedPrisma, prisma);
      assert.deepEqual(input, {
        sessionId,
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        phoneNumberId: scope.phoneNumberId,
        recipientPhone: '+5491112345678',
        blueprintKey: 'incident-report',
        flowId: '987654321012345',
        screenId: 'INCIDENT_REPORT',
        flowType: 'incident',
        sourceExternalId: 'wamid.flow-source',
      });
      return {
        session: {
          id: sessionId,
          deliveryAttemptedAt: null,
          deliveryRejectedAt: null,
          sentAt: null,
          consumedAt: null,
          providerMessageId: null,
        },
        token: 'persisted-signed-token',
      };
    },
    markAttempted: async (selectedPrisma, input) => {
      calls.push('mark-attempted');
      assert.equal(selectedPrisma, prisma);
      assert.deepEqual(input, { sessionId });
      return {
        session: {
          id: sessionId,
          deliveryAttemptedAt: new Date('2026-07-16T12:00:00.000Z'),
          deliveryRejectedAt: null,
          sentAt: null,
          consumedAt: null,
        },
        alreadyAttempted: false,
      };
    },
    markRejected: async () => assert.fail('an accepted Flow must not be rejected'),
    sendProviderFlow: async (request) => {
      calls.push('send-provider');
      assert.equal(request.flowToken, 'persisted-signed-token');
      assert.equal(request.phoneNumberId, scope.phoneNumberId);
      assert.equal(request.flowId, '987654321012345');
      return { messages: [{ id: 'wamid.flow-provider' }] };
    },
    markSent: async (selectedPrisma, input) => {
      calls.push('mark-sent');
      assert.equal(selectedPrisma, prisma);
      assert.deepEqual(input, {
        sessionId,
        providerMessageId: 'wamid.flow-provider',
      });
    },
  });

  assert.deepEqual(calls, [
    'load-sent-fence',
    'connection',
    'load-session',
    'mark-attempted',
    'send-provider',
    'mark-sent',
  ]);
  assert.deepEqual(result, {
    sent: true,
    providerMessageId: 'wamid.flow-provider',
  });
});

test('an existing sent fence prevents a duplicate Meta Flow request', async () => {
  const sessionId = '1f967f35-9f99-4db0-bd42-2d88f734cc72';
  const prisma = {
    whatsAppConnection: {
      async findUnique() {
        assert.fail('mutable connection metadata is irrelevant after the sent fence');
      },
    },
  };
  const result = await trySendPublishedFlow({
    blueprintKey: 'incident-report',
    flowSessionId: sessionId,
    event: {
      from: '5491112345678',
      externalId: 'wamid.already-sent-source',
    },
    scope: {
      organizationId: 'organization-1',
      projectId: 'project-1',
      phoneNumberId: '123456789012345',
    },
  }, {
    prisma,
    loadSentFence: async () => ({
      session: {
        id: sessionId,
        sentAt: new Date('2026-07-16T12:00:00.000Z'),
        providerMessageId: 'wamid.already-sent',
      },
    }),
    loadSession: async () => assert.fail('a sent fence must short-circuit token reconstruction'),
    sendProviderFlow: async () => assert.fail('sent Flow sessions must never be resent'),
    markSent: async () => assert.fail('an existing sent fence must not be rewritten'),
  });

  assert.deepEqual(result, {
    sent: true,
    providerMessageId: 'wamid.already-sent',
  });
});

test('a consumed session proves delivery even when the outbound sent fence was not persisted', async () => {
  const sessionId = '1f967f35-9f99-4db0-bd42-2d88f734cc72';
  const result = await trySendPublishedFlow({
    blueprintKey: 'incident-report',
    flowSessionId: sessionId,
    event: {
      from: '5491112345678',
      externalId: 'wamid.consumed-session-source',
    },
    scope: {
      organizationId: 'organization-1',
      projectId: 'project-1',
      phoneNumberId: '123456789012345',
    },
  }, {
    prisma: {
      whatsAppConnection: {
        async findUnique() {
          assert.fail('consumption must short-circuit mutable connection metadata');
        },
      },
    },
    loadSentFence: async () => ({
      session: {
        id: sessionId,
        sentAt: null,
        providerMessageId: null,
        consumedAt: new Date('2026-07-16T12:01:00.000Z'),
      },
    }),
    loadSession: async () => assert.fail('a consumed session must not reconstruct its token'),
    sendProviderFlow: async () => assert.fail('a consumed Flow session must never be resent'),
    markSent: async () => assert.fail('a consumed session must not rewrite the sent fence'),
  });

  assert.deepEqual(result, { sent: true, providerMessageId: null });
});

test('a sent fence won by another worker after preflight still prevents a duplicate POST', async () => {
  const sessionId = '1f967f35-9f99-4db0-bd42-2d88f734cc72';
  const result = await trySendPublishedFlow({
    blueprintKey: 'incident-report',
    flowSessionId: sessionId,
    event: {
      from: '5491112345678',
      externalId: 'wamid.concurrent-sent-source',
    },
    scope: {
      organizationId: 'organization-1',
      projectId: 'project-1',
      phoneNumberId: '123456789012345',
    },
  }, {
    prisma: {
      whatsAppConnection: {
        async findUnique() {
          return {
            metadata: {
              whatsappFlows: {
                'incident-report': {
                  id: '987654321012345',
                  name: 'ObraSaaS | Incidencia de obra',
                  status: 'PUBLISHED',
                },
              },
            },
          };
        },
      },
    },
    loadSentFence: async () => ({
      session: {
        id: sessionId,
        flowId: '987654321012345',
        screenId: 'INCIDENT_REPORT',
        flowType: 'incident',
        deliveryAttemptedAt: null,
        deliveryRejectedAt: null,
        sentAt: null,
        consumedAt: null,
      },
    }),
    loadSession: async () => ({
      session: {
        id: sessionId,
        sentAt: new Date('2026-07-16T12:00:00.000Z'),
        consumedAt: null,
        providerMessageId: 'wamid.concurrent-winner',
      },
      token: null,
    }),
    markAttempted: async () => assert.fail('the concurrent sent winner must short-circuit'),
    sendProviderFlow: async () => assert.fail('the concurrent sent winner must not be duplicated'),
  });

  assert.deepEqual(result, {
    sent: true,
    providerMessageId: 'wamid.concurrent-winner',
  });
});

test('an ambiguous prior attempt never changes to text when Flow metadata disappears', async () => {
  const sessionId = '1f967f35-9f99-4db0-bd42-2d88f734cc72';
  await assert.rejects(
    trySendPublishedFlow({
      blueprintKey: 'incident-report',
      flowSessionId: sessionId,
      event: {
        from: '5491112345678',
        externalId: 'wamid.unknown-metadata-source',
      },
      scope: {
        organizationId: 'organization-1',
        projectId: 'project-1',
        phoneNumberId: '123456789012345',
      },
    }, {
      prisma: {
        whatsAppConnection: {
          async findUnique() {
            return { metadata: {} };
          },
        },
      },
      loadSentFence: async () => ({
        session: {
          id: sessionId,
          deliveryAttemptedAt: new Date('2026-07-16T11:59:00.000Z'),
          deliveryRejectedAt: null,
          sentAt: null,
          consumedAt: null,
        },
      }),
      loadSession: async () => assert.fail('missing metadata must stop before token loading'),
      sendProviderFlow: async () => assert.fail('missing metadata must not resend'),
    }),
    (error) => error.code === 'WHATSAPP_FLOW_DELIVERY_UNRESOLVED',
  );
});

test('ambiguous Flow transport failures retry the same session instead of sending duplicate text', async () => {
  const sessionId = '1f967f35-9f99-4db0-bd42-2d88f734cc72';
  const prisma = {
    whatsAppConnection: {
      async findUnique() {
        return {
          metadata: {
            whatsappFlows: {
              'incident-report': {
                id: '987654321012345',
                name: 'ObraSaaS | Incidencia de obra',
                status: 'PUBLISHED',
              },
            },
          },
        };
      },
    },
  };
  const request = {
    blueprintKey: 'incident-report',
    flowSessionId: sessionId,
    event: {
      from: '5491112345678',
      externalId: 'wamid.ambiguous-source',
    },
    scope: {
      organizationId: 'organization-1',
      projectId: 'project-1',
      phoneNumberId: '123456789012345',
    },
  };
  const loadSession = async () => ({
    session: {
      id: sessionId,
      deliveryAttemptedAt: new Date('2026-07-16T12:00:00.000Z'),
      deliveryRejectedAt: null,
      sentAt: null,
      consumedAt: null,
      providerMessageId: null,
    },
    token: 'persisted-signed-token',
  });
  let marked = false;
  const ambiguous = Object.assign(new Error('timeout after request write'), {
    code: 'META_FLOW_DELIVERY_UNKNOWN',
  });

  await assert.rejects(
    trySendPublishedFlow(request, {
      prisma,
      loadSentFence: async () => ({
        session: {
          id: sessionId,
          flowId: '987654321012345',
          screenId: 'INCIDENT_REPORT',
          flowType: 'incident',
          deliveryAttemptedAt: new Date('2026-07-16T11:59:00.000Z'),
          deliveryRejectedAt: null,
          sentAt: null,
          consumedAt: null,
          providerMessageId: null,
        },
      }),
      loadSession,
      markAttempted: async () => ({
        session: {
          id: sessionId,
          deliveryAttemptedAt: new Date('2026-07-16T11:59:00.000Z'),
          deliveryRejectedAt: null,
          sentAt: null,
          consumedAt: null,
        },
        alreadyAttempted: true,
      }),
      markRejected: async () => assert.fail('an ambiguous request must not be rejected'),
      sendProviderFlow: async () => {
        throw ambiguous;
      },
      markSent: async () => {
        marked = true;
      },
    }),
    (error) => error === ambiguous,
  );
  assert.equal(marked, false);

  const warnings = [];
  await assert.rejects(
    trySendPublishedFlow(request, {
      prisma,
      loadSentFence: async () => ({
        session: {
          id: sessionId,
          flowId: '987654321012345',
          screenId: 'INCIDENT_REPORT',
          flowType: 'incident',
          deliveryAttemptedAt: new Date('2026-07-16T11:59:00.000Z'),
          deliveryRejectedAt: null,
          sentAt: null,
          consumedAt: null,
          providerMessageId: null,
        },
      }),
      loadSession,
      markAttempted: async () => ({
        session: {
          id: sessionId,
          deliveryAttemptedAt: new Date('2026-07-16T11:59:00.000Z'),
          deliveryRejectedAt: null,
          sentAt: null,
          consumedAt: null,
        },
        alreadyAttempted: true,
      }),
      markRejected: async () => assert.fail('a prior ambiguous attempt cannot become rejected'),
      sendProviderFlow: async () => {
        throw Object.assign(new Error('later definitive rejection'), {
          code: 'META_FLOW_REJECTED',
          status: 400,
        });
      },
      markSent: async () => {
        marked = true;
      },
      warn: (message) => warnings.push(message),
    }),
    (error) => error.code === 'WHATSAPP_FLOW_DELIVERY_UNRESOLVED',
  );
  assert.equal(marked, false);
  assert.equal(warnings.length, 0);
});

test('a definitive rejection on the first fenced attempt safely enables text fallback', async () => {
  const sessionId = '1f967f35-9f99-4db0-bd42-2d88f734cc72';
  const warnings = [];
  const result = await trySendPublishedFlow({
    blueprintKey: 'incident-report',
    flowSessionId: sessionId,
    event: {
      from: '5491112345678',
      externalId: 'wamid.first-rejected-source',
    },
    scope: {
      organizationId: 'organization-1',
      projectId: 'project-1',
      phoneNumberId: '123456789012345',
    },
  }, {
    prisma: {
      whatsAppConnection: {
        async findUnique() {
          return {
            metadata: {
              whatsappFlows: {
                'incident-report': {
                  id: '987654321012345',
                  name: 'ObraSaaS | Incidencia de obra',
                  status: 'PUBLISHED',
                },
              },
            },
          };
        },
      },
    },
    loadSentFence: async () => ({
      session: {
        id: sessionId,
        flowId: '987654321012345',
        screenId: 'INCIDENT_REPORT',
        flowType: 'incident',
        deliveryAttemptedAt: null,
        deliveryRejectedAt: null,
        sentAt: null,
        consumedAt: null,
      },
    }),
    loadSession: async () => ({
      session: {
        id: sessionId,
        deliveryAttemptedAt: null,
        deliveryRejectedAt: null,
        sentAt: null,
        consumedAt: null,
      },
      token: 'persisted-signed-token',
    }),
    markAttempted: async () => ({
      session: {
        id: sessionId,
        deliveryAttemptedAt: new Date('2026-07-16T12:00:00.000Z'),
        deliveryRejectedAt: null,
        sentAt: null,
        consumedAt: null,
      },
      alreadyAttempted: false,
    }),
    sendProviderFlow: async () => {
      throw Object.assign(new Error('definitive rejection'), {
        code: 'META_FLOW_REJECTED',
        status: 400,
      });
    },
    markRejected: async () => ({
      session: {
        id: sessionId,
        deliveryAttemptedAt: new Date('2026-07-16T12:00:00.000Z'),
        deliveryRejectedAt: new Date('2026-07-16T12:00:01.000Z'),
        sentAt: null,
        consumedAt: null,
      },
      alreadyRejected: false,
    }),
    markSent: async () => assert.fail('a rejected Flow must not be marked sent'),
    warn: (message) => warnings.push(message),
  });

  assert.deepEqual(result, { sent: false, providerMessageId: null });
  assert.equal(warnings.length, 1);
});

test('an unsent Flow that expires before delivery falls back to text', async () => {
  let providerCalls = 0;
  const sessionId = '1f967f35-9f99-4db0-bd42-2d88f734cc72';
  const result = await trySendPublishedFlow({
    blueprintKey: 'incident-report',
    flowSessionId: sessionId,
    event: {
      from: '5491112345678',
      externalId: 'wamid.expired-before-send',
    },
    scope: {
      organizationId: 'organization-1',
      projectId: 'project-1',
      phoneNumberId: '123456789012345',
    },
  }, {
    prisma: {
      whatsAppConnection: {
        async findUnique() {
          return {
            metadata: {
              whatsappFlows: {
                'incident-report': {
                  id: '987654321012345',
                  name: 'ObraSaaS | Incidencia de obra',
                  status: 'PUBLISHED',
                },
              },
            },
          };
        },
      },
    },
    loadSentFence: async () => ({
      session: {
        id: sessionId,
        flowId: '987654321012345',
        screenId: 'INCIDENT_REPORT',
        flowType: 'incident',
        deliveryAttemptedAt: null,
        deliveryRejectedAt: null,
        sentAt: null,
        consumedAt: null,
        providerMessageId: null,
      },
    }),
    loadSession: async () => {
      throw Object.assign(new Error('expired'), {
        code: 'WHATSAPP_FLOW_SESSION_EXPIRED',
      });
    },
    sendProviderFlow: async () => {
      providerCalls += 1;
      return { messages: [{ id: 'must-not-send' }] };
    },
  });

  assert.equal(providerCalls, 0);
  assert.deepEqual(result, { sent: false, providerMessageId: null });
});

test('an expired session with a prior ambiguous attempt never changes to text', async () => {
  const sessionId = '1f967f35-9f99-4db0-bd42-2d88f734cc72';
  await assert.rejects(
    trySendPublishedFlow({
      blueprintKey: 'incident-report',
      flowSessionId: sessionId,
      event: {
        from: '5491112345678',
        externalId: 'wamid.expired-after-attempt',
      },
      scope: {
        organizationId: 'organization-1',
        projectId: 'project-1',
        phoneNumberId: '123456789012345',
      },
    }, {
      prisma: {
        whatsAppConnection: {
          async findUnique() {
            return {
              metadata: {
                whatsappFlows: {
                  'incident-report': {
                    id: '987654321012345',
                    name: 'ObraSaaS | Incidencia de obra',
                    status: 'PUBLISHED',
                  },
                },
              },
            };
          },
        },
      },
      loadSentFence: async () => ({
        session: {
          id: sessionId,
          flowId: '987654321012345',
          screenId: 'INCIDENT_REPORT',
          flowType: 'incident',
          deliveryAttemptedAt: new Date('2026-07-16T11:30:00.000Z'),
          deliveryRejectedAt: null,
          sentAt: null,
          consumedAt: null,
        },
      }),
      loadSession: async () => {
        throw Object.assign(new Error('expired'), {
          code: 'WHATSAPP_FLOW_SESSION_EXPIRED',
        });
      },
      sendProviderFlow: async () => assert.fail('expired ambiguous delivery must not resend'),
    }),
    (error) => error.code === 'WHATSAPP_FLOW_DELIVERY_UNRESOLVED',
  );
});

test('Meta delivery revalidates immediately before every provider send', async () => {
  let subscriptionChecks = 0;
  let flowCalls = 0;
  let flowRequest = null;
  let textCalls = 0;
  const journal = automaticDeliveryJournal([], {});
  const blocked = Object.assign(new Error('blocked before fallback'), {
    code: 'WEBHOOK_SUBSCRIPTION_BLOCKED',
  });

  await assert.rejects(
    deliverWhatsAppMessageOutcome({
      outcome: {
        reply: 'Respuesta',
        flowPrompt: 'shift-check-in',
        flowSessionId: '1f967f35-9f99-4db0-bd42-2d88f734cc72',
      },
      event: {
        externalId: 'wamid-delivery-fence',
        from: '5491112345678',
        phoneNumberId: 'phone-1',
      },
      scope: { organizationId: 'organization-1', projectId: 'project-1' },
    }, {
      ...journal,
      assertSubscription: async () => {
        subscriptionChecks += 1;
        if (subscriptionChecks === 2) throw blocked;
      },
      sendFlow: async (request) => {
        flowCalls += 1;
        flowRequest = request;
        return { sent: false, providerMessageId: null };
      },
      sendText: async () => {
        textCalls += 1;
        return { messages: [{ id: 'must-not-send' }] };
      },
    }),
    (error) => (
      error.code === 'WHATSAPP_AUTOMATIC_DELIVERY_REJECTED'
      && error.cause === blocked
    ),
  );

  assert.equal(subscriptionChecks, 2);
  assert.equal(flowCalls, 1);
  assert.equal(flowRequest.flowSessionId, '1f967f35-9f99-4db0-bd42-2d88f734cc72');
  assert.equal(textCalls, 0);
});

test('legacy Flow outcomes without a durable session use the safe text fallback', async () => {
  const calls = [];
  const journal = automaticDeliveryJournal(calls);
  const result = await deliverWhatsAppMessageOutcome({
    outcome: { reply: 'Usá el enlace seguro.', flowPrompt: 'incident-report' },
    event: {
      externalId: 'wamid-legacy-flow-outcome',
      from: '5491112345678',
      phoneNumberId: '1234567890',
    },
    scope: {
      organizationId: 'organization-1',
      projectId: 'project-1',
      phoneNumberId: '1234567890',
    },
  }, {
    ...journal,
    assertSubscription: async () => calls.push('subscription-fence'),
    sendFlow: async () => assert.fail('a Flow without a trusted session must not be sent'),
    sendText: async () => {
      calls.push('send-text');
      return { messages: [{ id: 'wamid-fallback' }] };
    },
  });

  assert.deepEqual(calls, [
    'claim-delivery',
    'subscription-fence',
    'send-text',
    'settle-delivery:accepted',
  ]);
  assert.deepEqual(result, {
    flowSent: false,
    providerMessageId: 'wamid-fallback',
  });
});

test('a Meta-accepted Flow never triggers duplicate text when no provider ID is returned', async () => {
  let textCalls = 0;
  const journalCalls = [];
  await assert.rejects(
    deliverWhatsAppMessageOutcome({
      outcome: {
        reply: 'Respuesta de respaldo',
        flowPrompt: 'incident-report',
        flowSessionId: '1f967f35-9f99-4db0-bd42-2d88f734cc72',
      },
      event: {
        externalId: 'wamid-flow-accepted-without-id',
        from: '5491112345678',
        phoneNumberId: '1234567890',
      },
      scope: {
        organizationId: 'organization-1',
        projectId: 'project-1',
        phoneNumberId: '1234567890',
      },
    }, {
      ...automaticDeliveryJournal(journalCalls),
      assertSubscription: async () => {},
      sendFlow: async () => ({ sent: true, providerMessageId: null }),
      sendText: async () => {
        textCalls += 1;
        return { messages: [{ id: 'must-not-send' }] };
      },
    }),
    (error) => error.code === 'WHATSAPP_AUTOMATIC_DELIVERY_UNKNOWN',
  );

  assert.equal(textCalls, 0);
  assert.deepEqual(journalCalls, ['claim-delivery', 'settle-delivery:unknown']);
});

test('Meta text delivery remains operational when the last-moment fence is writable', async () => {
  const calls = [];
  const journal = automaticDeliveryJournal(calls);
  const result = await deliverWhatsAppMessageOutcome({
    outcome: { reply: 'Respuesta permitida', flowPrompt: null },
    event: {
      externalId: 'wamid-delivery-allowed',
      from: '5491112345678',
      phoneNumberId: 'phone-1',
    },
    scope: { organizationId: 'organization-1', projectId: 'project-1' },
  }, {
    ...journal,
    assertSubscription: async () => calls.push('subscription-fence'),
    sendText: async (request) => {
      assert.deepEqual(request.scope, {
        organizationId: 'organization-1',
        projectId: 'project-1',
        phoneNumberId: 'phone-1',
      });
      calls.push('send-text');
      return { messages: [{ id: 'wamid-outbound-allowed' }] };
    },
  });

  assert.deepEqual(calls, [
    'claim-delivery',
    'subscription-fence',
    'send-text',
    'settle-delivery:accepted',
  ]);
  assert.deepEqual(result, {
    flowSent: false,
    providerMessageId: 'wamid-outbound-allowed',
  });
});

test('H2 materializes its bearer after the delivery claim and never mutates the durable outcome', async () => {
  const calls = [];
  const journal = automaticDeliveryJournal(calls);
  const durableOutcome = {
    reply: 'Foto de avance recibida; credencial restringida.',
    flowPrompt: null,
    progressEvidenceLocationDelivery: {
      version: 1,
      sessionId: '123e4567-e89b-42d3-a456-426614174321',
    },
  };
  const result = await deliverWhatsAppMessageOutcome({
    outcome: durableOutcome,
    event: {
      externalId: 'wamid-progress-location-ready',
      from: '15551234567',
      phoneNumberId: 'phone-h2',
    },
    scope: { organizationId: 'organization-1', projectId: 'project-1' },
    eventId: 'event-progress-location-ready',
    leaseToken: 'lease-progress-location-ready',
  }, {
    ...journal,
    prisma: { marker: 'delivery-prisma' },
    materializeLocationDelivery: async (prisma, input) => {
      calls.push('materialize-location-link');
      assert.equal(prisma.marker, 'delivery-prisma');
      assert.deepEqual(input.descriptor, durableOutcome.progressEvidenceLocationDelivery);
      assert.equal(input.recipientPhone, '15551234567');
      assert.equal(input.scope.phoneNumberId, 'phone-h2');
      return {
        mode: 'LINK',
        text: 'Enlace efímero https://obrasaas.example/capture?token=ephemeral',
      };
    },
    assertSubscription: async () => calls.push('subscription-fence'),
    sendText: async (request) => {
      calls.push('send-text');
      assert.equal(
        request.text,
        'Enlace efímero https://obrasaas.example/capture?token=ephemeral',
      );
      return { messages: [{ id: 'wamid-progress-location-ready-outbound' }] };
    },
  });

  assert.deepEqual(calls, [
    'claim-delivery',
    'materialize-location-link',
    'subscription-fence',
    'send-text',
    'settle-delivery:accepted',
  ]);
  assert.deepEqual(durableOutcome, {
    reply: 'Foto de avance recibida; credencial restringida.',
    flowPrompt: null,
    progressEvidenceLocationDelivery: {
      version: 1,
      sessionId: '123e4567-e89b-42d3-a456-426614174321',
    },
  });
  assert.deepEqual(result, {
    flowSent: false,
    providerMessageId: 'wamid-progress-location-ready-outbound',
  });
});

test('a bridged legacy attendance outcome materializes its bearer only after the delivery claim', async () => {
  const calls = [];
  const journal = automaticDeliveryJournal(calls);
  const appliedAt = new Date('2026-08-10T12:00:00.000Z');
  const webviewSecret = 'rolling-delivery-webview-secret-at-least-32-bytes';
  const bearer = generateWebviewToken('worker-1', {
    action: ATTENDANCE_ACTIONS.CHECK_IN,
    pendingEntryId: 'pending-entry-1',
    purpose: 'attendance',
    scope: 'project-1',
    now: appliedAt.getTime() - 30_000,
    ttlSeconds: 7_200,
    secret: webviewSecret,
  });
  const durableOutcome = readAppliedMessageWebhookOutcome({
    id: 'event-attendance-link-ready',
    projectId: 'project-1',
    appliedAt,
    outcome: {
      version: 1,
      type: 'message',
      reply: `Registré tu ingreso. https://obrasaas.example/webview/attendance?worker=worker-1&token=${bearer}`,
      flowPrompt: null,
    },
  }, { webviewSecret });
  assert.doesNotMatch(JSON.stringify(durableOutcome), /token=|\/webview\/attendance/i);
  assert.equal(JSON.stringify(durableOutcome).includes(bearer), false);
  const result = await deliverWhatsAppMessageOutcome({
    outcome: durableOutcome,
    event: {
      externalId: 'wamid-attendance-link-ready',
      from: '15551234567',
      phoneNumberId: 'phone-attendance',
    },
    scope: { organizationId: 'organization-1', projectId: 'project-1' },
    eventId: 'event-attendance-link-ready',
    leaseToken: 'lease-attendance-link-ready',
  }, {
    ...journal,
    prisma: { marker: 'delivery-prisma' },
    materializeWebviewDelivery: async (prisma, input) => {
      calls.push('materialize-attendance-link');
      assert.equal(prisma.marker, 'delivery-prisma');
      assert.deepEqual(input.descriptor, durableOutcome.secureWebviewDelivery);
      assert.equal(input.reply, durableOutcome.reply);
      assert.equal(input.recipientPhone, '15551234567');
      assert.equal(input.scope.phoneNumberId, 'phone-attendance');
      assert.equal(input.eventId, 'event-attendance-link-ready');
      return {
        mode: 'LINK',
        text: 'Registré tu ingreso. https://obrasaas.example/webview/attendance?token=ephemeral',
      };
    },
    assertSubscription: async () => calls.push('subscription-fence'),
    sendText: async ({ text }) => {
      calls.push('send-text');
      assert.match(text, /token=ephemeral/);
      return { messages: [{ id: 'wamid-attendance-link-ready-outbound' }] };
    },
  });

  assert.deepEqual(calls, [
    'claim-delivery',
    'materialize-attendance-link',
    'subscription-fence',
    'send-text',
    'settle-delivery:accepted',
  ]);
  assert.doesNotMatch(JSON.stringify(durableOutcome), /token=ephemeral/);
  assert.deepEqual(result, {
    flowSent: false,
    providerMessageId: 'wamid-attendance-link-ready-outbound',
  });
});

test('H2 stale preparation sends one safe fallback without exposing or retrying a link', async () => {
  const calls = [];
  const journal = automaticDeliveryJournal(calls);
  let providerCalls = 0;
  const result = await deliverWhatsAppMessageOutcome({
    outcome: {
      reply: 'Foto de avance recibida; credencial restringida.',
      flowPrompt: null,
      progressEvidenceLocationDelivery: {
        version: 1,
        sessionId: '123e4567-e89b-42d3-a456-426614174322',
      },
    },
    event: {
      externalId: 'wamid-progress-location-stale',
      from: '15551234567',
      phoneNumberId: 'phone-h2',
    },
    scope: { organizationId: 'organization-1', projectId: 'project-1' },
  }, {
    ...journal,
    prisma: {},
    materializeLocationDelivery: async () => {
      calls.push('materialize-stale-fallback');
      return {
        mode: 'FALLBACK',
        text: 'La foto se conserva y puede vincularse sin ubicación.',
      };
    },
    assertSubscription: async () => calls.push('subscription-fence'),
    sendText: async ({ text }) => {
      providerCalls += 1;
      calls.push('send-text');
      assert.equal(text, 'La foto se conserva y puede vincularse sin ubicación.');
      assert.doesNotMatch(text, /token=|https?:\/\//i);
      return { messages: [{ id: 'wamid-progress-location-stale-outbound' }] };
    },
  });

  assert.equal(providerCalls, 1);
  assert.deepEqual(calls, [
    'claim-delivery',
    'materialize-stale-fallback',
    'subscription-fence',
    'send-text',
    'settle-delivery:accepted',
  ]);
  assert.equal(result.providerMessageId, 'wamid-progress-location-stale-outbound');
});

test('H2 strips a provider-reflected bearer from the terminal queue error chain', async () => {
  const calls = [];
  const reflectedBearer = 'token=ephemeral-must-not-reach-logs';
  await assert.rejects(
    deliverWhatsAppMessageOutcome({
      outcome: {
        reply: 'Foto de avance recibida; credencial restringida.',
        flowPrompt: null,
        progressEvidenceLocationDelivery: {
          version: 1,
          sessionId: '123e4567-e89b-42d3-a456-426614174323',
        },
      },
      event: {
        externalId: 'wamid-progress-location-reflected-error',
        from: '15551234567',
        phoneNumberId: 'phone-h2',
      },
      scope: { organizationId: 'organization-1', projectId: 'project-1' },
    }, {
      ...automaticDeliveryJournal(calls),
      prisma: {},
      materializeLocationDelivery: async () => ({
        mode: 'LINK',
        text: `Enlace efímero https://obrasaas.example/capture#${reflectedBearer}`,
      }),
      assertSubscription: async () => calls.push('subscription-fence'),
      sendText: async () => {
        const error = new Error(`provider reflected ${reflectedBearer}`);
        error.status = 400;
        throw error;
      },
    }),
    (error) => {
      assert.equal(error.code, 'WHATSAPP_AUTOMATIC_DELIVERY_REJECTED');
      assert.equal(error.cause, undefined);
      assert.equal(String(error.stack).includes(reflectedBearer), false);
      return true;
    },
  );
  assert.deepEqual(calls, [
    'claim-delivery',
    'subscription-fence',
    'settle-delivery:failed',
  ]);
});

test('H4 materializes the private receipt bearer only after winning the delivery claim', async () => {
  const calls = [];
  const journal = automaticDeliveryJournal(calls);
  const durableOutcome = {
    reply: 'Destino recibido; constancia restringida.',
    flowPrompt: null,
    workerPaymentPrivateReceiptDelivery: {
      version: 1,
      receiptId: '123e4567-e89b-42d3-a456-426614174324',
    },
  };
  const result = await deliverWhatsAppMessageOutcome({
    outcome: durableOutcome,
    event: {
      externalId: 'wamid-payment-receipt-ready',
      from: '15551234567',
      phoneNumberId: 'phone-h4',
    },
    scope: { organizationId: 'organization-1', projectId: 'project-1' },
    eventId: 'event-payment-receipt-ready',
    leaseToken: 'lease-payment-receipt-ready',
  }, {
    ...journal,
    prisma: { marker: 'delivery-prisma' },
    materializePaymentReceiptDelivery: async (prisma, input) => {
      calls.push('materialize-payment-receipt-link');
      assert.equal(prisma.marker, 'delivery-prisma');
      assert.deepEqual(
        input.descriptor,
        durableOutcome.workerPaymentPrivateReceiptDelivery,
      );
      assert.equal(input.recipientPhone, '15551234567');
      assert.equal(input.scope.phoneNumberId, 'phone-h4');
      assert.equal(input.eventId, 'event-payment-receipt-ready');
      return {
        mode: 'LINK',
        text: 'Constancia privada https://obrasaas.example/receipt#token=ephemeral',
      };
    },
    assertSubscription: async () => calls.push('subscription-fence'),
    sendText: async ({ text }) => {
      calls.push('send-text');
      assert.equal(
        text,
        'Constancia privada https://obrasaas.example/receipt#token=ephemeral',
      );
      return { messages: [{ id: 'wamid-payment-receipt-ready-outbound' }] };
    },
  });

  assert.deepEqual(calls, [
    'claim-delivery',
    'materialize-payment-receipt-link',
    'subscription-fence',
    'send-text',
    'settle-delivery:accepted',
  ]);
  assert.deepEqual(result, {
    flowSent: false,
    providerMessageId: 'wamid-payment-receipt-ready-outbound',
  });
  assert.deepEqual(durableOutcome, {
    reply: 'Destino recibido; constancia restringida.',
    flowPrompt: null,
    workerPaymentPrivateReceiptDelivery: {
      version: 1,
      receiptId: '123e4567-e89b-42d3-a456-426614174324',
    },
  });
});

test('H4 safely releases a transient pre-provider materialization failure for retry', async () => {
  const calls = [];
  const secretMarker = 'token=must-not-enter-the-retry-error';
  await assert.rejects(
    deliverWhatsAppMessageOutcome({
      outcome: {
        reply: 'Destino recibido; constancia restringida.',
        flowPrompt: null,
        workerPaymentPrivateReceiptDelivery: {
          version: 1,
          receiptId: '123e4567-e89b-42d3-a456-426614174326',
        },
      },
      event: {
        externalId: 'wamid-payment-receipt-transient-prepare',
        from: '15551234567',
        phoneNumberId: 'phone-h4',
      },
      scope: { organizationId: 'organization-1', projectId: 'project-1' },
    }, {
      ...automaticDeliveryJournal(calls),
      prisma: {},
      materializePaymentReceiptDelivery: async () => {
        calls.push('materialize-payment-receipt-transient');
        const error = new Error(`temporary database outage ${secretMarker}`);
        error.code = 'P1001';
        throw error;
      },
      assertSubscription: async () => assert.fail('provider fence must not run'),
      sendText: async () => assert.fail('Meta must not be contacted'),
    }),
    (error) => {
      assert.equal(error.code, 'WHATSAPP_AUTOMATIC_DELIVERY_PRE_PROVIDER_RETRY');
      assert.equal(error.cause, undefined);
      assert.equal(String(error.stack).includes(secretMarker), false);
      return true;
    },
  );
  assert.deepEqual(calls, [
    'claim-delivery',
    'materialize-payment-receipt-transient',
    'release-delivery',
  ]);
});

test('H4 strips a provider-reflected private receipt bearer from the queue error chain', async () => {
  const calls = [];
  const reflectedBearer = 'token=payment-receipt-ephemeral';
  await assert.rejects(
    deliverWhatsAppMessageOutcome({
      outcome: {
        reply: 'Destino recibido; constancia restringida.',
        flowPrompt: null,
        workerPaymentPrivateReceiptDelivery: {
          version: 1,
          receiptId: '123e4567-e89b-42d3-a456-426614174325',
        },
      },
      event: {
        externalId: 'wamid-payment-receipt-reflected-error',
        from: '15551234567',
        phoneNumberId: 'phone-h4',
      },
      scope: { organizationId: 'organization-1', projectId: 'project-1' },
    }, {
      ...automaticDeliveryJournal(calls),
      prisma: {},
      materializePaymentReceiptDelivery: async () => ({
        mode: 'LINK',
        text: `Constancia https://obrasaas.example/receipt#${reflectedBearer}`,
      }),
      assertSubscription: async () => calls.push('subscription-fence'),
      sendText: async () => {
        const error = new Error(`provider reflected ${reflectedBearer}`);
        error.status = 400;
        throw error;
      },
    }),
    (error) => {
      assert.equal(error.code, 'WHATSAPP_AUTOMATIC_DELIVERY_REJECTED');
      assert.equal(error.cause, undefined);
      assert.equal(String(error.stack).includes(reflectedBearer), false);
      return true;
    },
  );
  assert.deepEqual(calls, [
    'claim-delivery',
    'subscription-fence',
    'settle-delivery:failed',
  ]);
});

test('a confirmed automatic journal replay skips every provider request', async () => {
  let providerCalls = 0;
  const result = await deliverWhatsAppMessageOutcome({
    outcome: { reply: 'Ya enviada', flowPrompt: null },
    event: {
      externalId: 'wamid-automatic-replay',
      from: '5491112345678',
      phoneNumberId: 'phone-1',
    },
    scope: { organizationId: 'organization-1', projectId: 'project-1' },
  }, {
    ...automaticDeliveryJournal([], {
      dispatch: false,
      state: 'accepted',
      providerMessageId: 'wamid-already-accepted',
    }),
    assertSubscription: async () => assert.fail('replay must skip the delivery fence'),
    sendFlow: async () => { providerCalls += 1; },
    sendText: async () => { providerCalls += 1; },
  });

  assert.equal(providerCalls, 0);
  assert.deepEqual(result, {
    flowSent: false,
    providerMessageId: 'wamid-already-accepted',
    deliveryReplayed: true,
  });
});

test('a transient accepted-settlement failure retries only the local CAS', async () => {
  const journalCalls = [];
  let providerCalls = 0;
  let acceptedSettlementAttempts = 0;
  const journal = automaticDeliveryJournal(journalCalls);

  const result = await deliverWhatsAppMessageOutcome({
    outcome: { reply: 'Respuesta con correlaciÃ³n recuperable.', flowPrompt: null },
    event: {
      externalId: 'wamid-automatic-local-retry',
      from: '5491112345678',
      phoneNumberId: 'phone-1',
    },
    scope: {
      organizationId: 'organization-1',
      projectId: 'project-1',
      phoneNumberId: 'phone-1',
    },
    eventId: 'event-automatic-local-retry',
    leaseToken: 'lease-automatic-local-retry',
  }, {
    ...journal,
    settleDelivery: async (input) => {
      journalCalls.push(`settle-delivery:${input.state}`);
      acceptedSettlementAttempts += 1;
      if (acceptedSettlementAttempts === 1) throw new Error('transient database response loss');
      return { settled: true, state: input.state };
    },
    assertSubscription: async () => {},
    sendText: async () => {
      providerCalls += 1;
      return { messages: [{ id: 'wamid-provider-local-retry' }] };
    },
  });

  assert.equal(providerCalls, 1);
  assert.equal(result.providerMessageId, 'wamid-provider-local-retry');
  assert.deepEqual(journalCalls, [
    'claim-delivery',
    'settle-delivery:accepted',
    'settle-delivery:accepted',
  ]);
});

test('an unrecoverable local correlation settles unknown and a replay never posts again', async () => {
  let journalState = 'prepared';
  let providerCalls = 0;
  const settlementInputs = [];
  const dependencies = {
    claimDelivery: async (input) => {
      if (journalState !== 'prepared') return { dispatch: false, state: journalState };
      journalState = 'sending';
      return {
        dispatch: true,
        state: 'sending',
        claim: {
          version: 1,
          eventId: input.eventId,
          leaseToken: input.leaseToken,
          projectId: input.scope.projectId,
          organizationId: input.scope.organizationId,
          phoneNumberId: input.scope.phoneNumberId,
          messageId: 'automatic-local-unknown-a',
          outboundExternalId: `obrasaas-reply:${input.inboundExternalId}`,
        },
      };
    },
    settleDelivery: async (input) => {
      settlementInputs.push(input);
      if (input.state === 'accepted') throw new Error('persistent local correlation failure');
      journalState = input.state;
      return { settled: true, state: input.state };
    },
    assertSubscription: async () => {},
    sendText: async () => {
      providerCalls += 1;
      return { messages: [{ id: 'wamid-provider-local-unknown' }] };
    },
  };
  const input = {
    outcome: { reply: 'Respuesta aceptada sin correlaciÃ³n durable.', flowPrompt: null },
    event: {
      externalId: 'wamid-automatic-local-unknown',
      from: '5491112345678',
      phoneNumberId: 'phone-1',
    },
    scope: {
      organizationId: 'organization-1',
      projectId: 'project-1',
      phoneNumberId: 'phone-1',
    },
    eventId: 'event-automatic-local-unknown',
  };

  for (const leaseToken of ['lease-local-unknown-a', 'lease-local-unknown-b']) {
    await assert.rejects(
      deliverWhatsAppMessageOutcome({ ...input, leaseToken }, dependencies),
      (error) => error.code === 'WHATSAPP_AUTOMATIC_DELIVERY_UNKNOWN',
    );
  }

  assert.equal(providerCalls, 1);
  assert.deepEqual(settlementInputs.map(({ state }) => state), [
    'accepted',
    'accepted',
    'unknown',
  ]);
  assert.equal(settlementInputs[2].failureCode, 'LOCAL_CORRELATION_FAILED');
});

test('an ambiguous automatic attempt is terminal and a replay never sends twice', async () => {
  let journalState = 'prepared';
  let providerCalls = 0;
  const claimedLeaseTokens = [];
  const settlements = [];
  const dependencies = {
    claimDelivery: async (input) => {
      claimedLeaseTokens.push(input.leaseToken);
      if (journalState === 'prepared') {
        journalState = 'sending';
        return {
          dispatch: true,
          state: 'sending',
          claim: {
            version: 1,
            eventId: input.eventId,
            leaseToken: input.leaseToken,
            projectId: input.scope.projectId,
            organizationId: input.scope.organizationId,
            phoneNumberId: input.scope.phoneNumberId,
            messageId: 'automatic-timeout-a',
            outboundExternalId: `obrasaas-reply:${input.inboundExternalId}`,
          },
        };
      }
      if (journalState === 'sending') journalState = 'unknown';
      return { dispatch: false, state: journalState };
    },
    settleDelivery: async (input) => {
      const { state } = input;
      settlements.push(input);
      journalState = state;
      return { settled: true, state };
    },
    assertSubscription: async () => {},
    sendText: async () => {
      providerCalls += 1;
      throw new TypeError('simulated transport timeout after request start');
    },
  };
  const input = {
    outcome: { reply: 'Respuesta automática', flowPrompt: null },
    event: {
      externalId: 'wamid-automatic-timeout',
      from: '5491112345678',
      phoneNumberId: 'phone-1',
    },
    scope: {
      organizationId: 'organization-1',
      projectId: 'project-1',
      phoneNumberId: 'phone-1',
    },
    eventId: 'event-automatic-timeout',
  };

  for (const leaseToken of [
    'lease-automatic-timeout-a',
    'lease-automatic-timeout-b',
  ]) {
    await assert.rejects(
      deliverWhatsAppMessageOutcome({ ...input, leaseToken }, dependencies),
      (error) => error.code === 'WHATSAPP_AUTOMATIC_DELIVERY_UNKNOWN',
    );
  }
  assert.equal(providerCalls, 1);
  assert.equal(journalState, 'unknown');
  assert.deepEqual(claimedLeaseTokens, [
    'lease-automatic-timeout-a',
    'lease-automatic-timeout-b',
  ]);
  assert.equal(settlements[0].failureCode, 'META_TRANSPORT_AMBIGUOUS');
  assert.equal('providerStatus' in settlements[0], false);
});

test('a stale automatic sending claim becomes unknown without another provider request', async () => {
  const calls = [];
  let providerCalls = 0;

  await assert.rejects(
    deliverWhatsAppMessageOutcome({
      outcome: { reply: 'Respuesta automática pendiente', flowPrompt: null },
      event: {
        externalId: 'wamid-automatic-stale',
        from: '5491112345678',
        phoneNumberId: 'phone-1',
      },
      scope: {
        organizationId: 'organization-1',
        projectId: 'project-1',
        phoneNumberId: 'phone-1',
      },
      eventId: 'event-automatic-stale',
      leaseToken: 'lease-automatic-stale-b',
    }, {
      claimDelivery: async ({ leaseToken }) => {
        calls.push(['claim-delivery', leaseToken]);
        return {
          dispatch: false,
          state: 'unknown',
          reason: 'STALE_DISPATCH_CLAIM',
        };
      },
      settleDelivery: async () => assert.fail('a stale claim is already settled by the journal'),
      assertSubscription: async () => assert.fail('a stale claim must skip the delivery fence'),
      sendFlow: async () => {
        providerCalls += 1;
      },
      sendText: async () => {
        providerCalls += 1;
      },
    }),
    (error) => error.code === 'WHATSAPP_AUTOMATIC_DELIVERY_UNKNOWN',
  );

  assert.equal(providerCalls, 0);
  assert.deepEqual(calls, [['claim-delivery', 'lease-automatic-stale-b']]);
});

test('a text 2xx without WAMID becomes unknown and a replay never sends twice', async () => {
  let journalState = 'prepared';
  let providerCalls = 0;
  const settlements = [];
  const dependencies = {
    claimDelivery: async (input) => {
      if (journalState !== 'prepared') {
        return { dispatch: false, state: journalState };
      }
      journalState = 'sending';
      return {
        dispatch: true,
        state: 'sending',
        claim: {
          version: 1,
          eventId: input.eventId,
          leaseToken: input.leaseToken,
          projectId: input.scope.projectId,
          organizationId: input.scope.organizationId,
          phoneNumberId: input.scope.phoneNumberId,
          messageId: 'automatic-no-wamid-a',
          outboundExternalId: `obrasaas-reply:${input.inboundExternalId}`,
        },
      };
    },
    settleDelivery: async (input) => {
      const { state } = input;
      settlements.push(input);
      journalState = state;
      return { settled: true, state };
    },
    assertSubscription: async () => {},
    sendText: async () => {
      providerCalls += 1;
      return { messages: [] };
    },
  };
  const input = {
    outcome: { reply: 'Meta respondió sin WAMID', flowPrompt: null },
    event: {
      externalId: 'wamid-automatic-no-wamid',
      from: '5491112345678',
      phoneNumberId: 'phone-1',
    },
    scope: {
      organizationId: 'organization-1',
      projectId: 'project-1',
      phoneNumberId: 'phone-1',
    },
    eventId: 'event-automatic-no-wamid',
  };

  for (const leaseToken of [
    'lease-automatic-no-wamid-a',
    'lease-automatic-no-wamid-b',
  ]) {
    await assert.rejects(
      deliverWhatsAppMessageOutcome({ ...input, leaseToken }, dependencies),
      (error) => error.code === 'WHATSAPP_AUTOMATIC_DELIVERY_UNKNOWN',
    );
  }

  assert.equal(providerCalls, 1);
  assert.equal(journalState, 'unknown');
  assert.equal(settlements.length, 1);
  assert.equal(settlements[0].state, 'unknown');
  assert.equal(settlements[0].failureCode, 'META_PROVIDER_MESSAGE_ID_MISSING');
});

test('a deterministic text 4xx becomes failed and a replay never sends twice', async () => {
  let journalState = 'prepared';
  let providerCalls = 0;
  const settlements = [];
  const dependencies = {
    claimDelivery: async (input) => {
      if (journalState !== 'prepared') {
        return { dispatch: false, state: journalState };
      }
      journalState = 'sending';
      return {
        dispatch: true,
        state: 'sending',
        claim: {
          version: 1,
          eventId: input.eventId,
          leaseToken: input.leaseToken,
          projectId: input.scope.projectId,
          organizationId: input.scope.organizationId,
          phoneNumberId: input.scope.phoneNumberId,
          messageId: 'automatic-rejected-a',
          outboundExternalId: `obrasaas-reply:${input.inboundExternalId}`,
        },
      };
    },
    settleDelivery: async (input) => {
      const { state } = input;
      settlements.push(input);
      journalState = state;
      return { settled: true, state };
    },
    assertSubscription: async () => {},
    sendText: async () => {
      providerCalls += 1;
      throw Object.assign(new Error('Provider detail must not be persisted.'), {
        code: 'META_131030',
        providerCode: 131030,
        status: 400,
        ambiguous: false,
        error_data: { recipient: '+5491112345678' },
      });
    },
  };
  const input = {
    outcome: { reply: 'Respuesta rechazada', flowPrompt: null },
    event: {
      externalId: 'wamid-automatic-rejected',
      from: '5491112345678',
      phoneNumberId: 'phone-1',
    },
    scope: {
      organizationId: 'organization-1',
      projectId: 'project-1',
      phoneNumberId: 'phone-1',
    },
    eventId: 'event-automatic-rejected',
  };

  for (const leaseToken of [
    'lease-automatic-rejected-a',
    'lease-automatic-rejected-b',
  ]) {
    await assert.rejects(
      deliverWhatsAppMessageOutcome({ ...input, leaseToken }, dependencies),
      (error) => error.code === 'WHATSAPP_AUTOMATIC_DELIVERY_REJECTED',
    );
  }

  assert.equal(providerCalls, 1);
  assert.equal(journalState, 'failed');
  assert.equal(settlements.length, 1);
  assert.equal(settlements[0].state, 'failed');
  assert.equal(settlements[0].failureCode, 'META_HTTP_REJECTED');
  assert.equal(settlements[0].providerStatus, 400);
  assert.equal(settlements[0].providerCode, 131030);
  assert.doesNotMatch(
    JSON.stringify(settlements[0]),
    /provider detail|error_data|5491112345678/i,
  );
});

test('an ambiguous Flow never falls back to a duplicate text response', async () => {
  let textCalls = 0;
  const journalCalls = [];
  await assert.rejects(
    deliverWhatsAppMessageOutcome({
      outcome: {
        reply: 'No duplicar',
        flowPrompt: 'incident-report',
        flowSessionId: '1f967f35-9f99-4db0-bd42-2d88f734cc72',
      },
      event: {
        externalId: 'wamid-flow-ambiguous',
        from: '5491112345678',
        phoneNumberId: 'phone-1',
      },
      scope: {
        organizationId: 'organization-1',
        projectId: 'project-1',
        phoneNumberId: 'phone-1',
      },
    }, {
      ...automaticDeliveryJournal(journalCalls),
      assertSubscription: async () => {},
      sendFlow: async () => {
        throw Object.assign(new Error('ambiguous Flow'), {
          code: 'META_FLOW_DELIVERY_RETRYABLE',
          status: 503,
        });
      },
      sendText: async () => {
        textCalls += 1;
        return { messages: [{ id: 'must-not-send' }] };
      },
    }),
    (error) => error.code === 'WHATSAPP_AUTOMATIC_DELIVERY_UNKNOWN',
  );

  assert.equal(textCalls, 0);
  assert.deepEqual(journalCalls, ['claim-delivery', 'settle-delivery:unknown']);
});

test('quarantined inbound contacts never trigger a provider delivery', async () => {
  const result = await deliverWhatsAppMessageOutcome({
    outcome: {
      reply: 'Internal quarantine receipt that must not be sent.',
      flowPrompt: null,
      quarantined: true,
      deliverySuppressed: true,
    },
    event: {
      externalId: 'wamid-quarantined-contact',
      from: '5491155551212',
      phoneNumberId: 'phone-1',
    },
    scope: { organizationId: 'organization-1', projectId: 'project-1' },
  }, {
    ...automaticDeliveryJournal([], {
      dispatch: false,
      state: 'accepted',
    }),
    claimDelivery: async () => assert.fail('quarantine must not claim an outbound delivery'),
    settleDelivery: async () => assert.fail('quarantine must not settle an outbound delivery'),
    assertSubscription: async () => assert.fail('quarantine must not reach the delivery fence'),
    sendFlow: async () => assert.fail('quarantine must not send a Flow'),
    sendText: async () => assert.fail('quarantine must not send text'),
  });

  assert.deepEqual(result, {
    flowSent: false,
    providerMessageId: null,
    deliverySuppressed: true,
  });
});

test('message processing forwards the current webhook lease into automatic delivery', async () => {
  const outcome = {
    version: 1,
    type: 'message',
    reply: 'Respuesta durable.',
    flowPrompt: null,
  };
  const leasedEvent = {
    id: 'webhook-event-current-lease',
    leaseToken: 'lease-current-a',
    appliedAt: NOW,
    outcome,
  };
  const event = {
    provider: 'meta',
    eventType: 'message',
    externalId: 'wamid-current-lease',
    from: '5491112345678',
    phoneNumberId: 'phone-1',
    kind: 'text',
    media: null,
  };
  const scope = {
    organizationId: 'organization-1',
    projectId: 'project-1',
    phoneNumberId: 'phone-1',
  };
  const calls = [];

  await processMessageEvent(leasedEvent, event, scope, {
    assertSubscription: async (receivedScope) => {
      assert.equal(receivedScope, scope);
      calls.push('subscription');
    },
    applyMessage: async (input) => {
      assert.equal(input.eventId, leasedEvent.id);
      assert.equal(input.leaseToken, leasedEvent.leaseToken);
      assert.equal(input.event, event);
      assert.equal(input.scope, scope);
      calls.push('apply');
      return { alreadyApplied: true, outcome };
    },
    deliverOutcome: async (input) => {
      assert.equal(input.eventId, leasedEvent.id);
      assert.equal(input.leaseToken, leasedEvent.leaseToken);
      assert.equal(input.outcome, outcome);
      assert.equal(input.event, event);
      assert.equal(input.scope, scope);
      calls.push('deliver');
    },
  });

  assert.deepEqual(calls, ['subscription', 'apply', 'deliver']);
});
