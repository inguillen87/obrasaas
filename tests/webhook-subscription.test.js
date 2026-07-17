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
  trySendPublishedFlow,
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
      linkMessage: async () => assert.fail('an unsent message must not be linked'),
    }),
    (error) => error === blocked,
  );

  assert.equal(subscriptionChecks, 2);
  assert.equal(flowCalls, 1);
  assert.equal(flowRequest.flowSessionId, '1f967f35-9f99-4db0-bd42-2d88f734cc72');
  assert.equal(textCalls, 0);
});

test('legacy Flow outcomes without a durable session use the safe text fallback', async () => {
  const calls = [];
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
    assertSubscription: async () => calls.push('subscription-fence'),
    sendFlow: async () => assert.fail('a Flow without a trusted session must not be sent'),
    sendText: async () => {
      calls.push('send-text');
      return { messages: [{ id: 'wamid-fallback' }] };
    },
    linkMessage: async () => {
      calls.push('link-message');
      return true;
    },
  });

  assert.deepEqual(calls, ['subscription-fence', 'send-text', 'link-message']);
  assert.deepEqual(result, {
    flowSent: false,
    providerMessageId: 'wamid-fallback',
  });
});

test('a Meta-accepted Flow never triggers duplicate text when no provider ID is returned', async () => {
  let textCalls = 0;
  const result = await deliverWhatsAppMessageOutcome({
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
    assertSubscription: async () => {},
    sendFlow: async () => ({ sent: true, providerMessageId: null }),
    sendText: async () => {
      textCalls += 1;
      return { messages: [{ id: 'must-not-send' }] };
    },
    linkMessage: async () => assert.fail('there is no provider ID to correlate'),
  });

  assert.equal(textCalls, 0);
  assert.deepEqual(result, { flowSent: true, providerMessageId: null });
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
    sendText: async (request) => {
      assert.deepEqual(request.scope, {
        organizationId: 'organization-1',
        projectId: 'project-1',
      });
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
    assertSubscription: async () => assert.fail('quarantine must not reach the delivery fence'),
    sendFlow: async () => assert.fail('quarantine must not send a Flow'),
    sendText: async () => assert.fail('quarantine must not send text'),
    linkMessage: async () => assert.fail('quarantine has no outbound message to correlate'),
  });

  assert.deepEqual(result, {
    flowSent: false,
    providerMessageId: null,
    deliverySuppressed: true,
  });
});
