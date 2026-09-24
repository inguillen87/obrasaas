import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@clerk/nextjs/server') {
      return { url: 'mock:clerk-nextjs-server', shortCircuit: true };
    }
    if (specifier === 'next/headers') {
      return { url: 'mock:next-headers', shortCircuit: true };
    }
    if (specifier.startsWith('@/')) {
      const extension = specifier.startsWith('@/generated/') ? '.ts' : '.js';
      return nextResolve(
        new URL(`../src/${specifier.slice(2)}${extension}`, import.meta.url).href,
        context,
      );
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === 'mock:clerk-nextjs-server') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export async function auth() { throw new Error('Unexpected auth call.'); }
          export async function clerkClient() { throw new Error('Unexpected Clerk call.'); }
        `,
      };
    }
    if (url === 'mock:next-headers') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `export async function cookies() { throw new Error('Unexpected cookie call.'); }`,
      };
    }
    return nextLoad(url, context);
  },
});

const [
  {
    readProactiveWhatsAppFlowReceipt,
    getProactiveWhatsAppFlowCatalog,
    resolveProactiveWhatsAppFlowUncertainty,
    sendProactiveWhatsAppFlowTemplate,
  },
  { consumeWhatsAppFlowSession },
  { createWhatsAppProactiveFlowHandlers },
] = await Promise.all([
  import('../src/lib/whatsapp/proactive-flows.js'),
  import('../src/lib/whatsapp/flow-sessions.js'),
  import('../src/app/api/whatsapp/inbox/[conversationId]/proactive-flows/route.js'),
]);

const { NOW, FLOW_SECRET, CONFIGURED_META_ENV, access, createDatabase } = await import('./helpers/proactive-flow-fixture.js');

test('catalog only enables the exact approved owned template for a resolved worker', async () => {
  const store = createDatabase();
  const result = await getProactiveWhatsAppFlowCatalog({
    prisma: store.prisma,
    access: access(),
    conversationId: 'conversation-a',
    canManage: true,
    clock: () => NOW,
    env: CONFIGURED_META_ENV,
  });

  assert.deepEqual(result.capability, { allowed: true, code: 'READY', reason: null });
  assert.equal(result.recipient.name, 'Ana Rojas');
  assert.equal(result.catalog.find((item) => item.key === 'incident-report').canSend, true);
  assert.equal(result.catalog.find((item) => item.key === 'shift-check-in').canSend, false);
});

test('proactive Flow send is durable and an idempotent retry reaches Meta once', async () => {
  const store = createDatabase();
  const providerCalls = [];
  const input = {
    prisma: store.prisma,
    access: access(),
    conversationId: 'conversation-a',
    blueprintKey: 'incident-report',
    idempotencyKey: 'flow-send-stable-a',
    sendTemplate: async (payload) => {
      providerCalls.push(payload);
      return { messages: [{ id: 'wamid.flow-template-a' }] };
    },
    flowSessionSecret: FLOW_SECRET,
    clock: () => NOW,
    env: CONFIGURED_META_ENV,
  };

  const first = await sendProactiveWhatsAppFlowTemplate(input);
  const retry = await sendProactiveWhatsAppFlowTemplate(input);

  assert.equal(first.idempotent, false);
  assert.equal(retry.idempotent, true);
  assert.equal(providerCalls.length, 1);
  assert.equal(providerCalls[0].to, '+5491111111111');
  assert.equal(providerCalls[0].phoneNumberId, '123456789012345');
  assert.deepEqual(providerCalls[0].scope, {
    organizationId: 'organization-a',
    projectId: 'project-a',
  });
  assert.equal(providerCalls[0].templateName, store.template.name);
  assert.equal(providerCalls[0].language, 'es_AR');
  assert.match(providerCalls[0].flowToken, /^ofs1\./);
  assert.equal(store.messages[0].status, 'accepted');
  assert.equal(store.messages[0].providerMessageId, 'wamid.flow-template-a');
  assert.equal(store.sessions[0].deliveryAttemptedAt instanceof Date, true);
  assert.equal(store.sessions[0].sentAt instanceof Date, true);
  assert.deepEqual(
    store.audits.map((entry) => entry.action),
    [
      'whatsapp.inbox.flow_template_send_requested',
      'whatsapp.inbox.flow_template_sent',
    ],
  );

  const consumptionInput = {
    token: providerCalls[0].flowToken,
    consumedExternalId: 'wamid.flow-reply-a',
    organizationId: 'organization-a',
    projectId: 'project-a',
    workerId: 'worker-a',
    phoneNumberId: '123456789012345',
    recipientPhone: '5491111111111',
    blueprintKey: 'incident-report',
    flowId: store.template.flowId,
    screenId: store.template.screenId,
    flowType: 'incident',
  };
  const consumed = await consumeWhatsAppFlowSession(store.prisma, consumptionInput, {
    secret: FLOW_SECRET,
    now: new Date(NOW.getTime() + 1_000),
  });
  assert.equal(consumed.session.id, store.sessions[0].id);
  await assert.rejects(
    consumeWhatsAppFlowSession(store.prisma, consumptionInput, {
      secret: FLOW_SECRET,
      now: new Date(NOW.getTime() + 2_000),
    }),
    (error) => error?.code === 'WHATSAPP_FLOW_SESSION_USED',
  );
});

test('approved template send works after the free-text 24-hour window closes', async () => {
  const store = createDatabase({
    inboundAt: new Date(NOW.getTime() - 15 * 24 * 60 * 60 * 1_000),
  });
  let providerCalls = 0;

  const result = await sendProactiveWhatsAppFlowTemplate({
    prisma: store.prisma,
    access: access(),
    conversationId: 'conversation-a',
    blueprintKey: 'incident-report',
    idempotencyKey: 'flow-send-window-a',
    sendTemplate: async () => {
      providerCalls += 1;
      return { messages: [{ id: 'wamid.flow-window-a' }] };
    },
    flowSessionSecret: FLOW_SECRET,
    clock: () => NOW,
    env: CONFIGURED_META_ENV,
  });

  assert.equal(result.message.status, 'accepted');
  assert.equal(providerCalls, 1);
});

test('cold outreach and unapproved templates fail closed before provider delivery', async () => {
  for (const store of [
    createDatabase({ inbound: false }),
    createDatabase({ templateStatus: 'PENDING' }),
  ]) {
    let providerCalls = 0;
    await assert.rejects(
      sendProactiveWhatsAppFlowTemplate({
        prisma: store.prisma,
        access: access(),
        conversationId: 'conversation-a',
        blueprintKey: 'incident-report',
        idempotencyKey: `flow-send-blocked-${store.template.status}`,
        sendTemplate: async () => {
          providerCalls += 1;
          return { messages: [{ id: 'must-not-exist' }] };
        },
        flowSessionSecret: FLOW_SECRET,
        clock: () => NOW,
        env: CONFIGURED_META_ENV,
      }),
      (error) => [
        'WHATSAPP_PRIOR_INBOUND_REQUIRED',
        'WHATSAPP_FLOW_TEMPLATE_NOT_APPROVED',
      ].includes(error?.code),
    );
    assert.equal(providerCalls, 0);
    assert.equal(store.messages.length, 0);
  }
});

test('ambiguous provider failure becomes unknown and is never auto-retried', async () => {
  const store = createDatabase();
  let providerCalls = 0;
  const input = {
    prisma: store.prisma,
    access: access(),
    conversationId: 'conversation-a',
    blueprintKey: 'incident-report',
    idempotencyKey: 'flow-send-ambiguous-a',
    sendTemplate: async () => {
      providerCalls += 1;
      throw Object.assign(new Error('timeout'), {
        code: 'META_FLOW_TEMPLATE_DELIVERY_RETRYABLE',
      });
    },
    flowSessionSecret: FLOW_SECRET,
    clock: () => NOW,
    env: CONFIGURED_META_ENV,
  };

  await assert.rejects(
    sendProactiveWhatsAppFlowTemplate(input),
    (error) => error?.code === 'WHATSAPP_FLOW_TEMPLATE_DELIVERY_UNKNOWN',
  );
  const retry = await sendProactiveWhatsAppFlowTemplate(input);

  assert.equal(providerCalls, 1);
  assert.equal(retry.idempotent, true);
  assert.equal(retry.message.status, 'unknown');
  assert.equal(store.sessions[0].deliveryAttemptedAt instanceof Date, true);
  assert.equal(store.sessions[0].sentAt, null);
});

test('an unresolved attempt blocks every new key until an explicit audited resolution', async () => {
  const store = createDatabase();
  let providerCalls = 0;
  let staleFlowToken = '';
  await assert.rejects(
    sendProactiveWhatsAppFlowTemplate({
      prisma: store.prisma,
      access: access(),
      conversationId: 'conversation-a',
      blueprintKey: 'incident-report',
      idempotencyKey: 'flow-unknown-durable-a',
      sendTemplate: async ({ flowToken }) => {
        providerCalls += 1;
        staleFlowToken = flowToken;
        throw Object.assign(new Error('timeout'), {
          code: 'META_FLOW_TEMPLATE_DELIVERY_RETRYABLE',
        });
      },
      clock: () => NOW,
      env: CONFIGURED_META_ENV,
    }),
    (error) => error?.code === 'WHATSAPP_FLOW_TEMPLATE_DELIVERY_UNKNOWN',
  );

  const catalog = await getProactiveWhatsAppFlowCatalog({
    prisma: store.prisma,
    access: access(),
    conversationId: 'conversation-a',
    canManage: true,
    clock: () => NOW,
    env: CONFIGURED_META_ENV,
  });
  const incident = catalog.catalog.find((item) => item.key === 'incident-report');
  assert.equal(incident.canSend, false);
  assert.equal(incident.unresolvedAttempt.messageId, store.messages[0].id);

  await assert.rejects(
    sendProactiveWhatsAppFlowTemplate({
      prisma: store.prisma,
      access: access(),
      conversationId: 'conversation-a',
      blueprintKey: 'incident-report',
      idempotencyKey: 'flow-unknown-durable-b',
      sendTemplate: async () => {
        providerCalls += 1;
        return { messages: [{ id: 'must-not-dispatch' }] };
      },
      clock: () => NOW,
      env: CONFIGURED_META_ENV,
    }),
    (error) => error?.code === 'WHATSAPP_FLOW_TEMPLATE_UNRESOLVED',
  );
  assert.equal(providerCalls, 1);

  const resolution = await resolveProactiveWhatsAppFlowUncertainty({
    prisma: store.prisma,
    access: access(),
    conversationId: 'conversation-a',
    blueprintKey: 'incident-report',
    messageId: store.messages[0].id,
    confirmation: 'ACEPTO_RIESGO_DE_DUPLICADO',
    clock: () => new Date(NOW.getTime() + 3 * 60 * 1_000),
  });
  assert.equal(resolution.resolvedAttempt.status, 'failed');
  assert.equal(store.messages[0].metadata.uncertaintyResolution.riskAccepted, true);
  assert.equal(store.sessions[0].deliveryRejectedAt instanceof Date, true);
  await assert.rejects(
    consumeWhatsAppFlowSession(store.prisma, {
      token: staleFlowToken,
      consumedExternalId: 'wamid.stale-after-resolution',
      organizationId: 'organization-a',
      projectId: 'project-a',
      workerId: 'worker-a',
      phoneNumberId: '123456789012345',
      recipientPhone: '5491111111111',
      blueprintKey: 'incident-report',
      flowId: store.template.flowId,
      screenId: store.template.screenId,
      flowType: 'incident',
    }, {
      secret: FLOW_SECRET,
      now: new Date(NOW.getTime() + 3 * 60 * 1_000),
    }),
    (error) => error?.code === 'WHATSAPP_FLOW_SESSION_INVALID',
  );
  assert.equal(
    store.audits.some((entry) => (
      entry.action === 'whatsapp.inbox.flow_template_uncertainty_resolved'
      && entry.metadata.riskAccepted === true
    )),
    true,
  );

  const accepted = await sendProactiveWhatsAppFlowTemplate({
    prisma: store.prisma,
    access: access(),
    conversationId: 'conversation-a',
    blueprintKey: 'incident-report',
    idempotencyKey: 'flow-unknown-durable-b',
    sendTemplate: async () => {
      providerCalls += 1;
      return { messages: [{ id: 'wamid.after-resolution' }] };
    },
    clock: () => new Date(NOW.getTime() + 3 * 60 * 1_000),
    env: CONFIGURED_META_ENV,
  });
  assert.equal(accepted.message.status, 'accepted');
  assert.equal(providerCalls, 2);
});

test('non-Flow unknown traffic cannot hide an older unresolved Flow attempt', async () => {
  const store = createDatabase();
  store.messages.push({
    id: 'outbound-flow-older',
    conversationId: 'conversation-a',
    externalId: 'flow-older',
    direction: 'OUTBOUND',
    kind: 'INTERACTIVE',
    body: 'Incidencia de obra',
    status: 'unknown',
    sentAt: new Date(NOW.getTime() - 10 * 60 * 1_000),
    createdAt: new Date(NOW.getTime() - 10 * 60 * 1_000),
    metadata: {
      messageType: 'whatsapp_flow_template',
      blueprintKey: 'incident-report',
    },
  });
  for (let index = 0; index < 120; index += 1) {
    store.messages.push({
      id: `outbound-noise-${index}`,
      conversationId: 'conversation-a',
      externalId: `noise-${index}`,
      direction: 'OUTBOUND',
      kind: 'TEXT',
      body: 'Mensaje manual',
      status: 'unknown',
      sentAt: new Date(NOW.getTime() - index * 1_000),
      createdAt: new Date(NOW.getTime() - index * 1_000),
      metadata: { source: 'dashboard-inbox' },
    });
  }

  const catalog = await getProactiveWhatsAppFlowCatalog({
    prisma: store.prisma,
    access: access(),
    conversationId: 'conversation-a',
    canManage: true,
    clock: () => NOW,
    env: CONFIGURED_META_ENV,
  });
  const incident = catalog.catalog.find((item) => item.key === 'incident-report');
  assert.equal(incident.canSend, false);
  assert.equal(incident.unresolvedAttempt.messageId, 'outbound-flow-older');

  let providerCalls = 0;
  await assert.rejects(
    sendProactiveWhatsAppFlowTemplate({
      prisma: store.prisma,
      access: access(),
      conversationId: 'conversation-a',
      blueprintKey: 'incident-report',
      idempotencyKey: 'flow-hidden-by-noise-a',
      sendTemplate: async () => {
        providerCalls += 1;
        return { messages: [{ id: 'must-not-dispatch' }] };
      },
      clock: () => NOW,
      env: CONFIGURED_META_ENV,
    }),
    (error) => error?.code === 'WHATSAPP_FLOW_TEMPLATE_UNRESOLVED',
  );
  assert.equal(providerCalls, 0);
});

test('catalog and send fail closed when the Flow endpoint or signing secret is not ready', async () => {
  for (const store of [
    createDatabase({ flowEndpoint: false }),
    createDatabase({ endpointEnabled: false }),
    createDatabase({ endpointFingerprintMatches: false }),
  ]) {
    const catalog = await getProactiveWhatsAppFlowCatalog({
      prisma: store.prisma,
      access: access(),
      conversationId: 'conversation-a',
      canManage: true,
      clock: () => NOW,
      env: CONFIGURED_META_ENV,
    });
    assert.equal(catalog.capability.code, 'WHATSAPP_FLOW_ENDPOINT_NOT_READY');
    assert.equal(catalog.catalog.every((item) => item.canSend === false), true);
    await assert.rejects(
      sendProactiveWhatsAppFlowTemplate({
        prisma: store.prisma,
        access: access(),
        conversationId: 'conversation-a',
        blueprintKey: 'incident-report',
        idempotencyKey: 'flow-endpoint-blocked-a',
        sendTemplate: async () => ({ messages: [{ id: 'must-not-dispatch' }] }),
        clock: () => NOW,
        env: CONFIGURED_META_ENV,
      }),
      (error) => error?.code === 'WHATSAPP_FLOW_ENDPOINT_NOT_READY',
    );
    assert.equal(store.messages.length, 0);
    assert.equal(store.sessions.length, 0);
  }

  const store = createDatabase();
  const envWithoutFlowSecret = { ...CONFIGURED_META_ENV };
  delete envWithoutFlowSecret.WHATSAPP_FLOW_TOKEN_SECRET;
  const catalog = await getProactiveWhatsAppFlowCatalog({
    prisma: store.prisma,
    access: access(),
    conversationId: 'conversation-a',
    canManage: true,
    clock: () => NOW,
    env: envWithoutFlowSecret,
  });
  assert.equal(catalog.capability.code, 'WHATSAPP_FLOW_TOKEN_SECRET_REQUIRED');
  assert.equal(catalog.catalog.every((item) => item.canSend === false), true);
});

test('an env-injected Flow secret signs the provider token without global state', async () => {
  const store = createDatabase();
  const originalSecret = process.env.WHATSAPP_FLOW_TOKEN_SECRET;
  delete process.env.WHATSAPP_FLOW_TOKEN_SECRET;
  let capturedToken = '';
  try {
    const result = await sendProactiveWhatsAppFlowTemplate({
      prisma: store.prisma,
      access: access(),
      conversationId: 'conversation-a',
      blueprintKey: 'incident-report',
      idempotencyKey: 'flow-env-secret-a',
      sendTemplate: async (payload) => {
        capturedToken = payload.flowToken;
        return { messages: [{ id: 'wamid.env-secret-a' }] };
      },
      clock: () => NOW,
      env: CONFIGURED_META_ENV,
    });
    assert.equal(result.message.status, 'accepted');
    assert.match(capturedToken, /^ofs1\./);
    assert.equal(process.env.WHATSAPP_FLOW_TOKEN_SECRET, undefined);
  } finally {
    if (originalSecret === undefined) delete process.env.WHATSAPP_FLOW_TOKEN_SECRET;
    else process.env.WHATSAPP_FLOW_TOKEN_SECRET = originalSecret;
  }
});

test('local template drift in category, body, or button fails exact ownership checks', async () => {
  for (const field of ['category', 'bodyText', 'buttonText']) {
    const store = createDatabase();
    store.template[field] = `${store.template[field]}-drift`;
    const catalog = await getProactiveWhatsAppFlowCatalog({
      prisma: store.prisma,
      access: access(),
      conversationId: 'conversation-a',
      canManage: true,
      clock: () => NOW,
      env: CONFIGURED_META_ENV,
    });
    assert.equal(
      catalog.catalog.find((item) => item.key === 'incident-report').canSend,
      false,
      field,
    );
    await assert.rejects(
      sendProactiveWhatsAppFlowTemplate({
        prisma: store.prisma,
        access: access(),
        conversationId: 'conversation-a',
        blueprintKey: 'incident-report',
        idempotencyKey: `flow-template-drift-${field}`,
        sendTemplate: async () => ({ messages: [{ id: 'must-not-dispatch' }] }),
        clock: () => NOW,
        env: CONFIGURED_META_ENV,
      }),
      (error) => error?.code === 'WHATSAPP_FLOW_TEMPLATE_NOT_APPROVED',
    );
    assert.equal(store.messages.length, 0);
  }
});

test('a unique-race fallback validates payload identity before returning a message', async () => {
  const store = createDatabase();
  let providerCalls = 0;
  store.prisma.message.create = async ({ data }) => {
    store.messages.push({
      id: 'outbound-raced',
      createdAt: NOW,
      ...data,
      metadata: { ...data.metadata, payloadDigest: 'attacker-payload' },
    });
    throw Object.assign(new Error('unique'), { code: 'P2002' });
  };
  await assert.rejects(
    sendProactiveWhatsAppFlowTemplate({
      prisma: store.prisma,
      access: access(),
      conversationId: 'conversation-a',
      blueprintKey: 'incident-report',
      idempotencyKey: 'flow-race-mismatch-a',
      sendTemplate: async () => {
        providerCalls += 1;
        return { messages: [{ id: 'must-not-dispatch' }] };
      },
      clock: () => NOW,
      env: CONFIGURED_META_ENV,
    }),
    (error) => error?.code === 'IDEMPOTENCY_PAYLOAD_MISMATCH' && error?.status === 409,
  );
  assert.equal(providerCalls, 0);
});

test('a known Meta WAMID survives local correlation failure and cannot be manually unlocked', async () => {
  const store = createDatabase();
  const originalTransaction = store.prisma.$transaction;
  let transactionCalls = 0;
  store.prisma.$transaction = async (...args) => {
    transactionCalls += 1;
    if (transactionCalls === 3) {
      throw Object.assign(new Error('local correlation outage'), {
        code: 'LOCAL_CORRELATION_OUTAGE',
      });
    }
    return originalTransaction(...args);
  };
  let providerCalls = 0;
  await assert.rejects(
    sendProactiveWhatsAppFlowTemplate({
      prisma: store.prisma,
      access: access(),
      conversationId: 'conversation-a',
      blueprintKey: 'incident-report',
      idempotencyKey: 'flow-correlation-pending-a',
      sendTemplate: async () => {
        providerCalls += 1;
        return { messages: [{ id: 'wamid.correlation-pending-a' }] };
      },
      clock: () => NOW,
      env: CONFIGURED_META_ENV,
    }),
    (error) => error?.code === 'WHATSAPP_FLOW_TEMPLATE_CORRELATION_PENDING',
  );
  assert.equal(providerCalls, 1);
  assert.equal(store.messages[0].status, 'unknown');
  assert.equal(store.messages[0].providerMessageId, 'wamid.correlation-pending-a');
  assert.equal(store.messages[0].metadata.correlationPending, true);
  assert.equal(store.sessions[0].providerMessageId, 'wamid.correlation-pending-a');
  assert.equal(store.sessions[0].sentAt instanceof Date, true);

  await assert.rejects(
    resolveProactiveWhatsAppFlowUncertainty({
      prisma: store.prisma,
      access: access(),
      conversationId: 'conversation-a',
      blueprintKey: 'incident-report',
      messageId: store.messages[0].id,
      confirmation: 'ACEPTO_RIESGO_DE_DUPLICADO',
      clock: () => new Date(NOW.getTime() + 3 * 60 * 1_000),
    }),
    (error) => error?.code === 'WHATSAPP_FLOW_TEMPLATE_DELIVERY_PROVEN',
  );
  await assert.rejects(
    sendProactiveWhatsAppFlowTemplate({
      prisma: store.prisma,
      access: access(),
      conversationId: 'conversation-a',
      blueprintKey: 'incident-report',
      idempotencyKey: 'flow-correlation-pending-b',
      sendTemplate: async () => {
        providerCalls += 1;
        return { messages: [{ id: 'must-not-dispatch' }] };
      },
      clock: () => new Date(NOW.getTime() + 3 * 60 * 1_000),
      env: CONFIGURED_META_ENV,
    }),
    (error) => error?.code === 'WHATSAPP_FLOW_TEMPLATE_UNRESOLVED',
  );
  assert.equal(providerCalls, 1);
});

test('provider acceptance wins atomically over a concurrent manual uncertainty resolution', async () => {
  const store = createDatabase();
  await assert.rejects(
    sendProactiveWhatsAppFlowTemplate({
      prisma: store.prisma,
      access: access(),
      conversationId: 'conversation-a',
      blueprintKey: 'incident-report',
      idempotencyKey: 'flow-resolution-race-a',
      sendTemplate: async () => {
        throw Object.assign(new Error('timeout'), {
          code: 'META_FLOW_TEMPLATE_DELIVERY_RETRYABLE',
        });
      },
      clock: () => NOW,
      env: CONFIGURED_META_ENV,
    }),
    (error) => error?.code === 'WHATSAPP_FLOW_TEMPLATE_DELIVERY_UNKNOWN',
  );

  const updateMany = store.prisma.whatsAppFlowSession.updateMany;
  store.prisma.whatsAppFlowSession.updateMany = async (args) => {
    if (args.data.deliveryRejectedAt) {
      store.sessions[0].providerMessageId = 'wamid.concurrent-provider-win';
      store.sessions[0].sentAt = new Date(NOW.getTime() + 2 * 60 * 1_000);
    }
    return updateMany(args);
  };

  await assert.rejects(
    resolveProactiveWhatsAppFlowUncertainty({
      prisma: store.prisma,
      access: access(),
      conversationId: 'conversation-a',
      blueprintKey: 'incident-report',
      messageId: store.messages[0].id,
      confirmation: 'ACEPTO_RIESGO_DE_DUPLICADO',
      clock: () => new Date(NOW.getTime() + 3 * 60 * 1_000),
    }),
    (error) => error?.code === 'WHATSAPP_FLOW_TEMPLATE_DELIVERY_PROVEN',
  );
  assert.equal(store.sessions[0].deliveryRejectedAt, null);
  assert.equal(store.messages[0].status, 'unknown');
  assert.equal(store.audits.some(
    (entry) => entry.action === 'whatsapp.inbox.flow_template_uncertainty_resolved',
  ), false);
});

test('a consumed ambiguous Flow session is hard proof and keeps duplicate dispatch blocked', async () => {
  const store = createDatabase();
  let flowToken = '';
  let providerCalls = 0;
  await assert.rejects(
    sendProactiveWhatsAppFlowTemplate({
      prisma: store.prisma,
      access: access(),
      conversationId: 'conversation-a',
      blueprintKey: 'incident-report',
      idempotencyKey: 'flow-consumed-unknown-a',
      sendTemplate: async (payload) => {
        providerCalls += 1;
        flowToken = payload.flowToken;
        throw Object.assign(new Error('timeout'), {
          code: 'META_FLOW_TEMPLATE_DELIVERY_RETRYABLE',
        });
      },
      clock: () => NOW,
      env: CONFIGURED_META_ENV,
    }),
    (error) => error?.code === 'WHATSAPP_FLOW_TEMPLATE_DELIVERY_UNKNOWN',
  );
  await consumeWhatsAppFlowSession(store.prisma, {
    token: flowToken,
    consumedExternalId: 'wamid.flow-consumed-unknown-a',
    organizationId: 'organization-a',
    projectId: 'project-a',
    workerId: 'worker-a',
    phoneNumberId: '123456789012345',
    recipientPhone: '5491111111111',
    blueprintKey: 'incident-report',
    flowId: store.template.flowId,
    screenId: store.template.screenId,
    flowType: 'incident',
  }, {
    secret: FLOW_SECRET,
    now: new Date(NOW.getTime() + 30_000),
  });

  await assert.rejects(
    resolveProactiveWhatsAppFlowUncertainty({
      prisma: store.prisma,
      access: access(),
      conversationId: 'conversation-a',
      blueprintKey: 'incident-report',
      messageId: store.messages[0].id,
      confirmation: 'ACEPTO_RIESGO_DE_DUPLICADO',
      clock: () => new Date(NOW.getTime() + 3 * 60 * 1_000),
    }),
    (error) => error?.code === 'WHATSAPP_FLOW_TEMPLATE_DELIVERY_PROVEN',
  );
  await assert.rejects(
    sendProactiveWhatsAppFlowTemplate({
      prisma: store.prisma,
      access: access(),
      conversationId: 'conversation-a',
      blueprintKey: 'incident-report',
      idempotencyKey: 'flow-consumed-unknown-b',
      sendTemplate: async () => {
        providerCalls += 1;
        return { messages: [{ id: 'must-not-dispatch' }] };
      },
      clock: () => new Date(NOW.getTime() + 3 * 60 * 1_000),
      env: CONFIGURED_META_ENV,
    }),
    (error) => error?.code === 'WHATSAPP_FLOW_TEMPLATE_UNRESOLVED',
  );
  assert.equal(providerCalls, 1);
});

test('conversation lookup remains tenant and project scoped', async () => {
  const store = createDatabase();
  await assert.rejects(
    getProactiveWhatsAppFlowCatalog({
      prisma: store.prisma,
      access: access({
        organization: { id: 'organization-b' },
        project: { id: 'project-b', organizationId: 'organization-b' },
      }),
      conversationId: 'conversation-a',
      canManage: true,
      clock: () => NOW,
      env: CONFIGURED_META_ENV,
    }),
    (error) => error?.code === 'INBOX_CONVERSATION_NOT_FOUND' && error?.status === 404,
  );
});

function routeContext(conversationId = 'conversation-a') {
  return { params: Promise.resolve({ conversationId }) };
}

function routeRequest({
  method = 'GET',
  projectId = 'project-a',
  body,
  idempotencyKey,
} = {}) {
  const headers = new Headers({ 'x-obrasaas-organization': 'organization-a', 'x-obrasaas-project': projectId });
  if (method === 'POST' && body && typeof body === 'object') body = { reviewVersion: 'a'.repeat(64), confirmed: true, ...body };
  if (body !== undefined) headers.set('content-type', 'application/json');
  if (idempotencyKey) headers.set('idempotency-key', idempotencyKey);
  return new Request(
    `http://localhost/api/whatsapp/inbox/conversation-a/proactive-flows?projectId=${projectId}`,
    {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
  );
}

function routeProjectPrisma() {
  return {
    project: {
      async findFirst({ where }) {
        return where.id === 'project-a' && where.organizationId === 'organization-a'
          ? { id: 'project-a' }
          : null;
      },
    },
  };
}

test('proactive Flow route authorizes reads and forwards only trusted scope', async () => {
  const permissions = [];
  const calls = [];
  const handlers = createWhatsAppProactiveFlowHandlers({
    resolveAccess: async () => access(),
    authorize: (_access, permission) => permissions.push(permission),
    prismaFactory: routeProjectPrisma,
    loadCatalog: async (input) => {
      calls.push(input);
      return { context: { organizationId: 'organization-a', projectId: 'project-a', conversationId: input.conversationId }, conversationId: input.conversationId, capability: { allowed: true, code: 'READY', reason: null }, recipient: null, catalog: [] };
    },
    clock: () => NOW,
    env: CONFIGURED_META_ENV,
  });

  const response = await handlers.GET(routeRequest(), routeContext());
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control') || '', /no-store/i);
  assert.deepEqual(permissions, ['org:conversations:read']);
  assert.equal(calls[0].conversationId, 'conversation-a');
  assert.equal(calls[0].access.organization.id, 'organization-a');
  assert.equal(calls[0].canManage, true);
  assert.equal(payload.capability.code, 'READY');
});

test('proactive Flow route validates project, body fields, and idempotency before dispatch', async () => {
  const sends = [];
  const handlers = createWhatsAppProactiveFlowHandlers({
    resolveAccess: async () => access(),
    authorize: () => undefined,
    prismaFactory: routeProjectPrisma,
    sendFlow: async (input) => {
      sends.push(input);
      return { context: { organizationId: 'organization-a', projectId: 'project-a', conversationId: input.conversationId }, conversationId: input.conversationId, flow: { key: input.blueprintKey }, operationKey: input.idempotencyKey, reviewVersion: input.reviewVersion, idempotent: false, message: { id: 'outbound-a', status: 'accepted', direction: 'OUTBOUND', kind: 'interactive', body: 'Prueba', sentAt: null, recordedAt: null } };
    },
    clock: () => NOW,
    env: CONFIGURED_META_ENV,
  });
  const valid = await handlers.POST(routeRequest({
    method: 'POST',
    idempotencyKey: 'flow-route-stable-a',
    body: { projectId: 'project-a', blueprintKey: 'incident-report' },
  }), routeContext());
  assert.equal(valid.status, 200);
  assert.equal(sends.length, 1);
  assert.equal(sends[0].idempotencyKey, 'flow-route-stable-a');
  assert.equal(sends[0].blueprintKey, 'incident-report');

  const unknownField = await handlers.POST(routeRequest({
    method: 'POST',
    idempotencyKey: 'flow-route-invalid-a',
    body: {
      projectId: 'project-a',
      blueprintKey: 'incident-report',
      workerId: 'attacker-selected-worker',
    },
  }), routeContext());
  assert.equal(unknownField.status, 400);

  const mismatchedProject = await handlers.POST(routeRequest({
    method: 'POST',
    idempotencyKey: 'flow-route-invalid-b',
    body: { projectId: 'project-b', blueprintKey: 'incident-report' },
  }), routeContext());
  assert.equal(mismatchedProject.status, 403);
  assert.equal(sends.length, 1);

  for (const idempotencyKey of [undefined, 'short-7', `a${'b'.repeat(128)}`]) {
    const invalidKey = await handlers.POST(routeRequest({
      method: 'POST',
      idempotencyKey,
      body: { projectId: 'project-a', blueprintKey: 'incident-report' },
    }), routeContext());
    assert.equal(invalidKey.status, 400);
  }
  assert.equal(sends.length, 1);
});

test('uncertainty resolution route requires manage permission and forwards exact audited input', async () => {
  const permissions = [];
  const resolutions = [];
  const handlers = createWhatsAppProactiveFlowHandlers({
    resolveAccess: async () => access(),
    authorize: (_access, permission) => permissions.push(permission),
    prismaFactory: routeProjectPrisma,
    resolveUncertainty: async (input) => {
      resolutions.push(input);
      return {
        context: { organizationId: 'organization-a', projectId: 'project-a', conversationId: input.conversationId },
        conversationId: input.conversationId, flow: { key: input.blueprintKey }, idempotent: false,
        resolvedAttempt: { id: input.messageId, status: 'failed', direction: 'OUTBOUND', kind: 'interactive', body: 'Prueba', sentAt: null, recordedAt: null },
      };
    },
    clock: () => NOW,
    env: CONFIGURED_META_ENV,
  });
  const valid = await handlers.PATCH(routeRequest({
    method: 'PATCH',
    body: {
      projectId: 'project-a',
      blueprintKey: 'incident-report',
      messageId: 'outbound-unknown-a',
      confirmation: 'ACEPTO_RIESGO_DE_DUPLICADO',
    },
  }), routeContext());
  assert.equal(valid.status, 200);
  assert.deepEqual(permissions, ['org:conversations:manage']);
  assert.equal(resolutions.length, 1);
  assert.equal(resolutions[0].conversationId, 'conversation-a');
  assert.equal(resolutions[0].access.organization.id, 'organization-a');
  assert.equal(resolutions[0].messageId, 'outbound-unknown-a');

  const extraField = await handlers.PATCH(routeRequest({
    method: 'PATCH',
    body: {
      projectId: 'project-a',
      blueprintKey: 'incident-report',
      messageId: 'outbound-unknown-a',
      confirmation: 'ACEPTO_RIESGO_DE_DUPLICADO',
      status: 'accepted',
    },
  }), routeContext());
  assert.equal(extraField.status, 400);
  assert.equal(resolutions.length, 1);
});


async function reviewedSendInput(store, extra = {}) {
  const common = { prisma: store.prisma, access: access(), conversationId: 'conversation-a', clock: () => NOW, env: CONFIGURED_META_ENV };
  const catalog = await getProactiveWhatsAppFlowCatalog({ ...common, canManage: true });
  const row = catalog.catalog.find(item => item.key === 'incident-report');
  assert.equal(row.preview.bodyText, store.template.bodyText);
  return { ...common, blueprintKey: row.key, reviewVersion: row.reviewVersion, idempotencyKey: 'reviewed-send-attempt-a', sendTemplate: async () => ({ messages: [{ id: 'wamid.reviewed-attempt-a' }] }), ...extra };
}

test('read-only receipt recovers the accepted operation without another provider call', async () => {
  const store=createDatabase();let sends=0;
  const input=await reviewedSendInput(store,{sendTemplate:async()=>{sends++;return {messages:[{id:'wamid.receipt-a'}]};}});
  const first=await sendProactiveWhatsAppFlowTemplate(input);const before=JSON.stringify({messages:store.messages,audits:store.audits,sessions:store.sessions});
  const receipt=await readProactiveWhatsAppFlowReceipt(input);
  assert.equal(receipt.found,true);assert.equal(receipt.message.id,first.message.id);assert.equal(receipt.message.status,'accepted');assert.equal(receipt.reviewVersion,input.reviewVersion);
  assert.equal(sends,1);assert.equal(JSON.stringify({messages:store.messages,audits:store.audits,sessions:store.sessions}),before);
});
test('missing receipt returns no message and never materializes a send',async()=>{
  const store=createDatabase(),input=await reviewedSendInput(store);
  const before=store.calls.length;const result=await readProactiveWhatsAppFlowReceipt(input);
  assert.equal(result.found,false);assert.equal(result.message,null);assert.equal(store.messages.length,0);assert.equal(store.audits.length,0);assert.equal(store.sessions.length,0);
  assert.ok(store.calls.slice(before).every(([name])=>name==='conversation'));
});
test('receipt remains readable after channel credential or template changes',async()=>{
  const store=createDatabase(),input=await reviewedSendInput(store);await sendProactiveWhatsAppFlowTemplate(input);
  store.connection.enabled=false;store.connection.encryptedAccessToken=null;store.template.status='PAUSED';store.worker.active=false;
  const result=await readProactiveWhatsAppFlowReceipt(input);assert.equal(result.message.status,'accepted');assert.equal(store.messages.length,1);
});
for(const patch of [{reviewVersion:'b'.repeat(64)},{access:access({databaseUserId:'another-user'})},{access:access({organization:{id:'foreign'}})},{conversationId:'foreign'}])test('receipt refuses changed scope/actor/review '+JSON.stringify(patch),async()=>{
  const store=createDatabase(),input=await reviewedSendInput(store);await sendProactiveWhatsAppFlowTemplate(input);
  const before=JSON.stringify({messages:store.messages,audits:store.audits});
  await assert.rejects(readProactiveWhatsAppFlowReceipt({...input,...patch}));assert.equal(JSON.stringify({messages:store.messages,audits:store.audits}),before);
});
test('changing the resolved worker after review rejects before provider or reservation',async()=>{
  const store=createDatabase();let calls=0;const input=await reviewedSendInput(store,{sendTemplate:async()=>{calls++;throw new Error('Should not reach provider');}});
  store.worker.id='worker-reassigned';await assert.rejects(sendProactiveWhatsAppFlowTemplate(input),{code:'WHATSAPP_FLOW_REVIEW_CHANGED'});
  assert.equal(calls,0);assert.equal(store.messages.length,0);assert.equal(store.sessions.length,0);assert.equal(store.audits.length,0);
});
test('reviewed message is checked again before dispatch after reservation',async()=>{
  const store=createDatabase();let transactions=0,calls=0;
  const input=await reviewedSendInput(store,{sendTemplate:async()=>{calls++;throw new Error('Should not dispatch');}});
  store.prisma.$transaction=async fn=>{transactions++;if(transactions===2)store.worker.id='worker-changed';return fn(store.prisma);};
  await assert.rejects(sendProactiveWhatsAppFlowTemplate(input),{code:'WHATSAPP_FLOW_REVIEW_CHANGED'});assert.equal(calls,0);assert.equal(store.messages[0].status,'failed');
});
test('receipt with an accepted status but no provider reference fails closed to unknown',async()=>{
  const store=createDatabase(),input=await reviewedSendInput(store);await sendProactiveWhatsAppFlowTemplate(input);store.messages[0].providerMessageId=null;
  assert.equal((await readProactiveWhatsAppFlowReceipt(input)).message.status,'unknown');assert.equal(store.messages[0].status,'accepted');
});
test('transport success with malformed domain output is rejected by the route',async()=>{
  for(const returned of [{},{message:{id:'outbound-a',status:'accepted'}},{context:{},conversationId:'other',flow:{key:'shift-check-in'}}]){
    const handlers=createWhatsAppProactiveFlowHandlers({resolveAccess:async()=>access(),authorize:()=>{},prismaFactory:routeProjectPrisma,sendFlow:async()=>returned});
    const response=await handlers.POST(routeRequest({method:'POST',idempotencyKey:'flow-invalid-receipt',body:{projectId:'project-a',blueprintKey:'incident-report'}}),routeContext());
    assert.equal(response.status,503);assert.equal((await response.json()).code,'WHATSAPP_FLOW_RESPONSE_UNCONFIRMED');
  }
});
test('a malformed PATCH response never authorizes a new attempt in the route',async()=>{
  const handlers=createWhatsAppProactiveFlowHandlers({resolveAccess:async()=>access(),authorize:()=>{},prismaFactory:routeProjectPrisma,resolveUncertainty:async()=>({})});
  const response=await handlers.PATCH(routeRequest({method:'PATCH',body:{projectId:'project-a',blueprintKey:'incident-report',messageId:'outbound-a',confirmation:'ACEPTO_RIESGO_DE_DUPLICADO'}}),routeContext());
  assert.equal(response.status,503);
});
for(const method of ['GET','POST','PATCH'])test(method+' denies stale context and cross-site origin before database or provider',async()=>{
  let reads=0;
  const handlers=createWhatsAppProactiveFlowHandlers({resolveAccess:async()=>access(),authorize:()=>{},prismaFactory:()=>{reads++;return routeProjectPrisma();}});
  for(const headers of [{'X-ObraSaaS-Organization':'other'},{'X-ObraSaaS-Project':'other'},{'X-ObraSaaS-Project':''},{Origin:'https://foreign.test'},{'Sec-Fetch-Site':'cross-site'}]){
    const request=routeRequest({method,body:method==='GET'?undefined:{},idempotencyKey:'scope-tests-a'});for(const [k,v] of Object.entries(headers))request.headers.set(k,v);
    const response=await handlers[method](request,routeContext());assert.ok([403,409].includes(response.status));assert.match(response.headers.get('cache-control'),/private, no-store/);
  }
  assert.equal(reads,0);
});
test('duplicate query keys and mismatched header/body identities are rejected',async()=>{
  let sends=0;const handlers=createWhatsAppProactiveFlowHandlers({resolveAccess:async()=>access(),authorize:()=>{},prismaFactory:routeProjectPrisma,sendFlow:async()=>{sends++;}});
  const original=routeRequest();const duplicate=new Request(original.url+'&projectId=other',{headers:original.headers});assert.equal((await handlers.GET(duplicate,routeContext())).status,400);
  const mismatched=routeRequest({method:'POST',idempotencyKey:'header-key-a',body:{projectId:'project-a',blueprintKey:'incident-report',idempotencyKey:'body-key-a'}});
  assert.equal((await handlers.POST(mismatched,routeContext())).status,400);assert.equal(sends,0);
});
test('GET receipt goes through the read service, never through send or manual resolution',async()=>{
  const store=createDatabase(),input=await reviewedSendInput(store);await sendProactiveWhatsAppFlowTemplate(input);
  let sends=0,resolves=0;
  const handlers=createWhatsAppProactiveFlowHandlers({resolveAccess:async()=>access(),authorize:()=>{},prismaFactory:()=>store.prisma,sendFlow:async()=>{sends++;},resolveUncertainty:async()=>{resolves++;}});
  const base=routeRequest(),request=new Request(base.url+'&mode=receipt&blueprintKey=incident-report',{headers:base.headers});request.headers.set('Idempotency-Key',input.idempotencyKey);request.headers.set('X-ObraSaaS-Flow-Review',input.reviewVersion);
  const response=await handlers.GET(request,routeContext());assert.equal(response.status,200);assert.equal((await response.json()).message.status,'accepted');assert.equal(sends,0);assert.equal(resolves,0);
});

test('unreviewed legacy HTTP requests cannot send through the new route',async()=>{
  let reads=0;const handlers=createWhatsAppProactiveFlowHandlers({resolveAccess:async()=>access(),authorize:()=>{},prismaFactory:()=>{reads++;return routeProjectPrisma();}});
  const base=routeRequest();const request=new Request(base.url,{method:'POST',headers:{...Object.fromEntries(base.headers),'Content-Type':'application/json','Idempotency-Key':'unreviewed-request-a'},body:JSON.stringify({projectId:'project-a',blueprintKey:'incident-report'})});
  const result=await handlers.POST(request,routeContext());assert.equal(result.status,400);assert.equal((await result.json()).code,'WHATSAPP_FLOW_REVIEW_REQUIRED');assert.equal(reads,0);
});
test('revoked read permission stops receipt lookup before database access',async()=>{
  const {AccessError}=await import('../src/lib/access.js');let reads=0;
  const handlers=createWhatsAppProactiveFlowHandlers({resolveAccess:async()=>access(),authorize:()=>{throw new AccessError('Revoked',{status:403,code:'REVOKED'});},prismaFactory:()=>{reads++;return routeProjectPrisma();}});
  const base=routeRequest(),request=new Request(base.url+'&mode=receipt&blueprintKey=incident-report',{headers:base.headers});request.headers.set('Idempotency-Key','denied-receipt-a');request.headers.set('X-ObraSaaS-Flow-Review','a'.repeat(64));
  assert.equal((await handlers.GET(request,routeContext())).status,403);assert.equal(reads,0);
});
