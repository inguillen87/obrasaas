import test from "node:test";
import assert from "node:assert/strict";
import { ATTENDANCE_ACTIONS, generateWebviewToken } from "../src/lib/auth.js";
import {
  WEBHOOK_MAX_ATTEMPTS,
  WEBHOOK_RETRY_CAP_MS,
  createMessageWebhookOutcome,
  deserializeWebhookPayload,
  drainWebhookProjectQueue,
  isTerminalWebhookFailure,
  isWebhookEventEligible,
  readAppliedMessageWebhookOutcome,
  scopedWebhookExternalId,
  serializeWebhookPayload,
  shouldDeadLetterWebhookEvent,
  webhookFailureTransition,
  webhookRetryDelayMs,
} from "../src/lib/webhook-queue.js";

test("an applied message retry reuses only its minimal delivery outcome", () => {
  const outcome = createMessageWebhookOutcome({
    reply: "Ingreso registrado.",
    flowPrompt: "shift-check-in",
    worker: { id: "must-not-leak", phone: "+5491100000000" },
    state: { incidents: ["must-not-leak"] },
  });
  assert.deepEqual(outcome, {
    version: 1,
    type: "message",
    reply: "Ingreso registrado.",
    flowPrompt: "shift-check-in",
  });

  const reused = readAppliedMessageWebhookOutcome({
    appliedAt: new Date("2026-07-16T12:00:00.000Z"),
    outcome,
  });
  assert.deepEqual(reused, outcome);
  assert.equal(readAppliedMessageWebhookOutcome({ appliedAt: null, outcome }), null);
});

test("a Flow delivery outcome retains only its non-secret durable session reference", () => {
  const outcome = createMessageWebhookOutcome({
    reply: "CompletÃ¡ el control de ingreso.",
    flowPrompt: "shift-check-in",
    flowSessionId: "123e4567-e89b-42d3-a456-426614174000",
    flowToken: "must-not-be-persisted",
  });
  assert.deepEqual(outcome, {
    version: 1,
    type: "message",
    reply: "CompletÃ¡ el control de ingreso.",
    flowPrompt: "shift-check-in",
    flowSessionId: "123e4567-e89b-42d3-a456-426614174000",
  });
  assert.equal(JSON.stringify(outcome).includes("must-not-be-persisted"), false);
  assert.throws(
    () => createMessageWebhookOutcome({
      reply: "InvÃ¡lido",
      flowPrompt: null,
      flowSessionId: "123e4567-e89b-42d3-a456-426614174000",
    }),
    (error) => error.code === "WEBHOOK_OUTCOME_INVALID",
  );
});

test("corrupt applied outcomes fail terminally instead of repeating internal effects", () => {
  assert.throws(
    () => readAppliedMessageWebhookOutcome({
      appliedAt: new Date("2026-07-16T12:00:00.000Z"),
      outcome: { version: 1, type: "message", state: { attendance: {} } },
    }),
    (error) => error.code === "WEBHOOK_OUTCOME_INVALID"
      && isTerminalWebhookFailure(error),
  );
});

test("unusable or corrupt WhatsApp identities are terminal before media processing", () => {
  assert.equal(isTerminalWebhookFailure({ code: "FIELD_WORKER_UNKNOWN" }), true);
  assert.equal(isTerminalWebhookFailure({ code: "FIELD_WORKER_AMBIGUOUS" }), true);
  assert.equal(isTerminalWebhookFailure({ code: "FIELD_WORKER_CANONICAL_BLOCKED" }), true);
  assert.equal(isTerminalWebhookFailure({ code: "FIELD_WORKER_CANONICAL_IDENTITY_CORRUPT" }), true);
  assert.equal(isTerminalWebhookFailure({ code: "FIELD_WORKER_INVALID_PHONE" }), true);
  assert.equal(isTerminalWebhookFailure({ code: "WEBHOOK_PAYLOAD_INVALID" }), true);
  assert.equal(isTerminalWebhookFailure({ code: "WEBHOOK_SUBSCRIPTION_BLOCKED" }), true);
  assert.equal(isTerminalWebhookFailure({ code: "WHATSAPP_FLOW_REPLY_INVALID" }), true);
  assert.equal(isTerminalWebhookFailure({ code: "WHATSAPP_FLOW_SESSION_CONFLICT" }), true);
  assert.equal(isTerminalWebhookFailure({ code: "WHATSAPP_FLOW_SESSION_EXPIRED" }), true);
  assert.equal(isTerminalWebhookFailure({ code: "WHATSAPP_FLOW_SESSION_INPUT_INVALID" }), true);
  assert.equal(isTerminalWebhookFailure({ code: "WHATSAPP_FLOW_SESSION_INVALID" }), true);
  assert.equal(isTerminalWebhookFailure({ code: "WHATSAPP_FLOW_SESSION_USED" }), true);
  assert.equal(isTerminalWebhookFailure({ code: "WHATSAPP_AUTOMATIC_DELIVERY_REJECTED" }), true);
  assert.equal(isTerminalWebhookFailure({ code: "WHATSAPP_AUTOMATIC_DELIVERY_UNKNOWN" }), true);
  for (const code of [
    "WHATSAPP_MEDIA_ASSET_UPLOAD_UNCERTAIN",
    "WHATSAPP_MEDIA_ASSET_UPLOAD_FAILED",
    "WHATSAPP_MEDIA_ASSET_IDEMPOTENCY_REUSED",
    "WHATSAPP_MEDIA_ASSET_STORAGE_SCOPE",
    "WHATSAPP_MEDIA_ASSET_STORAGE_INVALID",
    "WHATSAPP_MEDIA_ASSET_PROVIDER_DRIFT",
    "WHATSAPP_MEDIA_ASSET_SIZE_MISMATCH",
    "WHATSAPP_MEDIA_ASSET_MIME_MISMATCH",
    "WHATSAPP_MEDIA_ASSET_KIND_MIME_MISMATCH",
    "WHATSAPP_MEDIA_ASSET_RESOURCE_TYPE_MISMATCH",
    "WHATSAPP_MEDIA_ASSET_DELIVERY_URL_INVALID",
    "WHATSAPP_MEDIA_ASSET_RETENTION_EXPIRED",
    "WHATSAPP_MEDIA_ASSET_DESCRIPTOR_INVALID",
    "WHATSAPP_MEDIA_ASSET_NOT_AVAILABLE",
    "WHATSAPP_MEDIA_ASSET_EXPIRED",
    "WHATSAPP_MEDIA_ASSET_ALREADY_CLAIMED",
    "WHATSAPP_MEDIA_ASSET_MESSAGE_SCOPE_MISMATCH",
    "WHATSAPP_MEDIA_ASSET_CLAIM_CONFLICT",
  ]) {
    assert.equal(isTerminalWebhookFailure({ code }), true, `${code} must not be auto-retried`);
  }
  assert.equal(isTerminalWebhookFailure({ code: "WHATSAPP_MEDIA_ASSET_UPLOAD_IN_PROGRESS" }), false);
  assert.equal(isTerminalWebhookFailure({ code: "WHATSAPP_MEDIA_ASSET_UPLOAD_LEASE_LOST" }), false);
  assert.equal(isTerminalWebhookFailure({ code: "WHATSAPP_FLOW_TOKEN_SECRET_INVALID" }), false);
  assert.equal(isTerminalWebhookFailure({ code: "WHATSAPP_FLOW_DELIVERY_UNRESOLVED" }), false);
  assert.equal(isTerminalWebhookFailure({ code: "WHATSAPP_AUTOMATIC_DELIVERY_SETTLEMENT_PENDING" }), false);
  assert.equal(isTerminalWebhookFailure({ code: "WHATSAPP_AUTOMATIC_DELIVERY_PRE_PROVIDER_RETRY" }), false);
  assert.equal(isTerminalWebhookFailure({ code: "FIELD_WORKER_CANONICAL_IDENTITY_CONFIGURATION_INVALID" }), false);
  assert.equal(isTerminalWebhookFailure({ code: "META_TEMPORARY_FAILURE" }), false);
});

test("a secure-webview outcome persists a non-secret descriptor and redacts its durable reply", () => {
  const descriptor = {
    version: 1,
    kind: "ATTENDANCE_CHECK_IN",
    projectId: "project-a",
    workerId: "worker-a",
    resourceId: "pending-entry-a",
    resourceRevision: null,
    issuedAt: 1_786_342_200,
    expiresAt: 1_786_349_400,
  };
  const bearer = "eyJ2IjoyLCJzdWIiOiJ3b3JrZXItYSJ9.must-not-be-persisted";
  const rawReply = `Registré tu ingreso. Abrí https://obra.test/webview/attendance?worker=worker-a&token=${bearer}`;
  const outcome = createMessageWebhookOutcome({
    reply: rawReply,
    secureWebviewDelivery: descriptor,
  });

  assert.deepEqual(outcome, {
    version: 1,
    type: "message",
    reply: "Registré tu ingreso. Abrí [enlace seguro disponible sólo en WhatsApp]",
    flowPrompt: null,
    secureWebviewDelivery: descriptor,
  });
  assert.doesNotMatch(JSON.stringify(outcome), /must-not-be-persisted|token=|\/webview\/attendance/i);
  assert.deepEqual(readAppliedMessageWebhookOutcome({
    appliedAt: new Date("2026-08-10T12:00:00.000Z"),
    outcome,
  }), outcome);

  assert.throws(
    () => createMessageWebhookOutcome({
      reply: rawReply,
      secureWebviewDelivery: { ...descriptor, token: bearer },
    }),
    (error) => error.code === "WEBHOOK_OUTCOME_INVALID",
  );
});

test("a rolling deployment bridges a valid legacy signed webview without returning its bearer", () => {
  const projectId = "project-rolling-a";
  const workerId = "worker-rolling-a";
  const pendingEntryId = "pending-entry-rolling-a";
  const appliedAt = new Date("2026-08-10T12:00:00.000Z");
  const issuedAt = appliedAt.getTime() - 30_000;
  const secret = "rolling-deploy-webview-secret-at-least-32-bytes";
  const bearer = generateWebviewToken(workerId, {
    action: ATTENDANCE_ACTIONS.CHECK_IN,
    pendingEntryId,
    purpose: "attendance",
    scope: projectId,
    now: issuedAt,
    ttlSeconds: 7_200,
    secret,
  });
  const legacyOutcome = {
    version: 1,
    type: "message",
    reply: `Registré tu ingreso. Abrí https://obra.test/webview/attendance?worker=${workerId}&token=${bearer}`,
    flowPrompt: null,
  };

  const bridged = readAppliedMessageWebhookOutcome({
    projectId,
    appliedAt,
    outcome: legacyOutcome,
  }, { webviewSecret: secret });

  assert.deepEqual(bridged.secureWebviewDelivery, {
    version: 1,
    kind: "ATTENDANCE_CHECK_IN",
    projectId,
    workerId,
    resourceId: pendingEntryId,
    resourceRevision: null,
    issuedAt: Math.floor(issuedAt / 1_000),
    expiresAt: Math.floor(issuedAt / 1_000) + 7_200,
  });
  assert.match(bridged.reply, /enlace seguro disponible sólo en WhatsApp/i);
  assert.doesNotMatch(JSON.stringify(bridged), /token=|\/webview\/attendance/i);
  assert.equal(JSON.stringify(bridged).includes(bearer), false);

  const medicalBearer = generateWebviewToken(workerId, {
    purpose: "medical",
    scope: projectId,
    now: issuedAt,
    ttlSeconds: 7_200,
    secret,
  });
  const medical = readAppliedMessageWebhookOutcome({
    projectId,
    appliedAt,
    outcome: {
      version: 1,
      type: "message",
      reply: `Adjuntá el certificado en https://obra.test/webview/medical?worker=${workerId}&token=${medicalBearer}`,
      flowPrompt: null,
    },
  }, { webviewSecret: secret });
  assert.deepEqual(medical.secureWebviewDelivery, {
    version: 1,
    kind: "MEDICAL",
    projectId,
    workerId,
    resourceId: null,
    resourceRevision: null,
    issuedAt: Math.floor(issuedAt / 1_000),
    expiresAt: Math.floor(issuedAt / 1_000) + 7_200,
  });
  assert.doesNotMatch(JSON.stringify(medical), /token=|\/webview\/medical/i);
  assert.equal(JSON.stringify(medical).includes(medicalBearer), false);

  for (const [label, webhookEvent] of [
    ["invalid bearer", {
      projectId,
      appliedAt,
      outcome: {
        ...legacyOutcome,
        reply: legacyOutcome.reply.replace(bearer, `${bearer}tampered`),
      },
    }],
    ["wrong project scope", { projectId: "project-rolling-b", appliedAt, outcome: legacyOutcome }],
    ["missing project scope", { appliedAt, outcome: legacyOutcome }],
  ]) {
    const rejected = readAppliedMessageWebhookOutcome(webhookEvent, { webviewSecret: secret });
    assert.equal(rejected.secureWebviewDelivery, undefined, label);
    assert.match(rejected.reply, /enlace seguro omitido/i, label);
    assert.doesNotMatch(JSON.stringify(rejected), /token=|\/webview\/attendance/i, label);
    assert.equal(JSON.stringify(rejected).includes(bearer), false, label);
  }
});

test("a progress-evidence location outcome persists only its non-secret descriptor", () => {
  const sessionId = "123e4567-e89b-42d3-a456-426614174001";
  const outcome = createMessageWebhookOutcome({
    reply: "Foto de avance recibida.",
    progressEvidenceLocationDelivery: {
      version: 1,
      sessionId,
    },
    token: "must-not-be-persisted",
    link: "https://example.test/webview?token=must-not-be-persisted",
  });

  assert.deepEqual(outcome, {
    version: 1,
    type: "message",
    reply: "Foto de avance recibida.",
    flowPrompt: null,
    progressEvidenceLocationDelivery: {
      version: 1,
      sessionId,
    },
  });
  assert.equal(JSON.stringify(outcome).includes("must-not-be-persisted"), false);
  assert.deepEqual(readAppliedMessageWebhookOutcome({
    appliedAt: new Date("2026-07-29T12:00:00.000Z"),
    outcome,
  }), outcome);

  assert.throws(
    () => createMessageWebhookOutcome({
      reply: "Inválido",
      progressEvidenceLocationDelivery: {
        version: 1,
        sessionId,
        token: "secret",
      },
    }),
    (error) => error.code === "WEBHOOK_OUTCOME_INVALID",
  );
  assert.throws(
    () => createMessageWebhookOutcome({
      reply: "Inválido",
      flowPrompt: "incident-report",
      progressEvidenceLocationDelivery: { version: 1, sessionId },
    }),
    (error) => error.code === "WEBHOOK_OUTCOME_INVALID",
  );
});

test("a worker-payment private receipt outcome persists only its opaque descriptor", () => {
  const receiptId = "123e4567-e89b-42d3-a456-426614174009";
  const outcome = createMessageWebhookOutcome({
    reply: "Destino recibido; constancia restringida.",
    workerPaymentPrivateReceiptDelivery: { version: 1, receiptId },
    token: "must-not-be-persisted",
    destinationValue: "0000000000000000000000",
  });

  assert.deepEqual(outcome, {
    version: 1,
    type: "message",
    reply: "Destino recibido; constancia restringida.",
    flowPrompt: null,
    workerPaymentPrivateReceiptDelivery: { version: 1, receiptId },
  });
  assert.equal(JSON.stringify(outcome).includes("must-not-be-persisted"), false);
  assert.equal(JSON.stringify(outcome).includes("0000000000000000000000"), false);
  assert.deepEqual(readAppliedMessageWebhookOutcome({
    appliedAt: new Date("2026-07-29T12:00:00.000Z"),
    outcome,
  }), outcome);

  assert.throws(
    () => createMessageWebhookOutcome({
      reply: "Inválido",
      workerPaymentPrivateReceiptDelivery: { version: 1, receiptId, token: "secret" },
    }),
    (error) => error.code === "WEBHOOK_OUTCOME_INVALID",
  );
  assert.throws(
    () => createMessageWebhookOutcome({
      reply: "Inválido",
      flowPrompt: "worker-payment-destination",
      workerPaymentPrivateReceiptDelivery: { version: 1, receiptId },
    }),
    (error) => error.code === "WEBHOOK_OUTCOME_INVALID",
  );
  assert.throws(
    () => createMessageWebhookOutcome({
      reply: "Inválido",
      progressEvidenceLocationDelivery: { version: 1, sessionId: receiptId },
      workerPaymentPrivateReceiptDelivery: { version: 1, receiptId },
    }),
    (error) => error.code === "WEBHOOK_OUTCOME_INVALID",
  );
});

test("webhook retry backoff is deterministic, jittered and capped", () => {
  const first = webhookRetryDelayMs({ attempts: 1, externalId: "wamid.1" });
  assert.equal(first, webhookRetryDelayMs({ attempts: 1, externalId: "wamid.1" }));
  assert.ok(first >= 4_000 && first <= 6_000);
  assert.ok(webhookRetryDelayMs({ attempts: 50, externalId: "wamid.1" }) <= WEBHOOK_RETRY_CAP_MS);

  const now = new Date("2026-07-16T12:00:00.000Z");
  const retry = webhookFailureTransition({ attempts: 2, externalId: "wamid.1", now });
  assert.equal(retry.status, "PENDING");
  assert.ok(retry.nextAttemptAt > now);
  assert.deepEqual(
    webhookFailureTransition({ attempts: WEBHOOK_MAX_ATTEMPTS, externalId: "wamid.1", now }),
    { status: "FAILED", nextAttemptAt: null },
  );
});

test("only due pending events and expired leases are eligible", () => {
  const now = new Date("2026-07-16T12:00:00.000Z");
  assert.equal(isWebhookEventEligible({ status: "PENDING", attempts: 0, nextAttemptAt: now }, now), true);
  assert.equal(isWebhookEventEligible({
    status: "PENDING",
    attempts: 1,
    nextAttemptAt: new Date(now.getTime() + 1),
  }, now), false);
  assert.equal(isWebhookEventEligible({
    status: "PROCESSING",
    attempts: 1,
    leaseExpiresAt: new Date(now.getTime() - 1),
  }, now), true);
  assert.equal(isWebhookEventEligible({
    status: "PROCESSING",
    attempts: 1,
    leaseExpiresAt: new Date(now.getTime() + 1),
  }, now), false);
  assert.equal(isWebhookEventEligible({
    status: "PENDING",
    attempts: WEBHOOK_MAX_ATTEMPTS,
    nextAttemptAt: now,
  }, now), false);
  assert.equal(shouldDeadLetterWebhookEvent({
    status: "PROCESSING",
    attempts: WEBHOOK_MAX_ATTEMPTS,
    leaseExpiresAt: new Date(now.getTime() - 1),
  }, now), true);
});

test("stored webhook payload preserves normalized event and trusted tenant scope", () => {
  const timestamp = new Date("2026-07-16T12:00:00.000Z");
  const payload = serializeWebhookPayload(
    { externalId: "wamid.1", eventType: "message", timestamp },
    {
      projectId: "project-1",
      organizationId: "organization-1",
      phoneNumberId: "phone-1",
      whatsappBusinessId: "waba-1",
    },
  );
  const restored = deserializeWebhookPayload(payload);
  assert.equal(restored.event.timestamp.toISOString(), timestamp.toISOString());
  assert.equal(restored.scope.projectId, "project-1");
  assert.equal(restored.scope.organizationId, "organization-1");
  assert.equal(restored.scope.phoneNumberId, "phone-1");
});

test("Meta text payment destinations are fully redacted before queue persistence", () => {
  const cases = [
    {
      externalId: "wamid.payment-cbu",
      text: "Mi CBU es 1234-5678 9012-3456 7890-12; depositame el viernes.",
      secret: "1234567890123456789012",
      suffix: "9012",
    },
    {
      externalId: "wamid.payment-alias",
      text: "Hola, mi alias es sueldo.carlos y prefiero cobrar por transferencia.",
      secret: "sueldo.carlos",
      suffix: "carlos",
    },
    {
      externalId: "wamid.payment-cvu-typo",
      text: "Mi CVU: 1234.5678.9012.3456.7890.1; lo reviso después.",
      secret: "1234.5678.9012.3456.7890.1",
      suffix: "7890",
    },
  ];

  for (const scenario of cases) {
    const payload = serializeWebhookPayload({
      provider: "meta",
      eventType: "message",
      externalId: scenario.externalId,
      phoneNumberId: "phone-1",
      businessDisplayPhone: "5491100000000",
      from: "5491112345678",
      displayName: "Operario",
      timestamp: new Date("2026-07-30T12:00:00.000Z"),
      kind: "text",
      text: scenario.text,
      location: null,
      media: null,
      interactive: null,
      context: { id: "must-be-dropped" },
      futureBankAccount: scenario.secret,
      raw: {
        id: scenario.externalId,
        from: "5491112345678",
        timestamp: "1785412800",
        type: "text",
        text: { body: scenario.text },
        lastFour: scenario.suffix,
        unexpectedSensitiveEnvelope: scenario.secret,
      },
    }, {
      projectId: "project-1",
      organizationId: "organization-1",
      phoneNumberId: "phone-1",
      whatsappBusinessId: "waba-1",
    });

    const serialized = JSON.stringify(payload);
    assert.equal(payload.event.text, "[destino de cobro restringido]");
    assert.deepEqual(payload.event.raw, {
      id: scenario.externalId,
      from: "5491112345678",
      timestamp: "1785412800",
      type: "text",
      text: { body: "[destino de cobro restringido]" },
    });
    assert.equal(payload.event.context, null);
    assert.equal(payload.event.futureBankAccount, undefined);
    assert.equal(serialized.includes(scenario.secret), false);
    assert.equal(serialized.includes(scenario.suffix), false);
  }
});

test("innocuous Meta questions about configuring payment data remain intact", () => {
  for (const text of [
    "¿Cómo configuro mi alias?",
    "¿Cómo configuro mi CBU?",
    "¿Cómo configuro mi alias/CBU desde WhatsApp?",
  ]) {
    const payload = serializeWebhookPayload({
      provider: "meta",
      eventType: "message",
      externalId: `wamid.question-${text.length}`,
      phoneNumberId: "phone-1",
      from: "5491112345678",
      timestamp: new Date("2026-07-30T12:00:00.000Z"),
      kind: "text",
      text,
      raw: {
        id: `wamid.question-${text.length}`,
        from: "5491112345678",
        timestamp: "1785412800",
        type: "text",
        text: { body: text },
      },
    }, {
      projectId: "project-1",
      organizationId: "organization-1",
      phoneNumberId: "phone-1",
    });

    assert.equal(payload.event.text, text);
    assert.equal(payload.event.raw.text.body, text);
  }
});

test("durable Flow payload keeps only token evidence and its schema projection", () => {
  const rawFlowToken = "ofs1.raw-token-that-must-never-persist";
  const sensitiveDescription = "CUIT 20-12345678-9, CBU 0000000000000000000000";
  const payload = serializeWebhookPayload({
    provider: "meta",
    eventType: "message",
    externalId: "wamid.flow-1",
    phoneNumberId: "phone-1",
    businessDisplayPhone: "5491100000000",
    from: "5491112345678",
    displayName: "Operario",
    timestamp: new Date("2026-07-16T12:00:00.000Z"),
    kind: "interactive",
    text: "Incidencia enviada",
    interactive: {
      type: "flow",
      name: "flow",
      response: {
        flow_type: "incident",
        severity: "high",
        area: "Planta baja",
        description: sensitiveDescription,
        task_ref: "task-structure-02",
      },
      flowToken: {
        sessionId: "1f967f35-9f99-4db0-bd42-2d88f734cc72",
        tokenSha256: "a".repeat(64),
        rawFlowToken,
      },
    },
    futureBankAccount: "alias.sueldo.carlos",
    raw: {
      id: "wamid.flow-1",
      from: "5491112345678",
      timestamp: "1784030410",
      type: "interactive",
      unexpectedSensitiveEnvelope: "alias.sueldo.carlos",
      interactive: {
        type: "nfm_reply",
        nfm_reply: {
          response_json: JSON.stringify({
            flow_token: rawFlowToken,
            description: sensitiveDescription,
          }),
        },
      },
    },
  }, {
    projectId: "project-1",
    organizationId: "organization-1",
    phoneNumberId: "phone-1",
    whatsappBusinessId: "waba-1",
  });

  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes(rawFlowToken), false);
  assert.equal(serialized.includes(sensitiveDescription), false);
  assert.equal(serialized.includes("alias.sueldo.carlos"), false);
  assert.deepEqual(payload.event.interactive.flowToken, {
    sessionId: "1f967f35-9f99-4db0-bd42-2d88f734cc72",
    tokenSha256: "a".repeat(64),
  });
  assert.deepEqual(payload.event.interactive.response, {
    flow_type: "incident",
    severity: "high",
    area: "Planta baja",
    description: "[contenido restringido]",
    task_ref: "task-structure-02",
  });
  assert.deepEqual(
    JSON.parse(payload.event.raw.interactive.nfm_reply.response_json),
    payload.event.interactive.response,
  );
});

test("durable Flow payload stores an empty response for future or invalid schemas", () => {
  const sensitiveValue = "alias.sueldo.carlos";
  const payload = serializeWebhookPayload({
    provider: "meta",
    eventType: "message",
    externalId: "wamid.future-flow",
    phoneNumberId: "phone-1",
    from: "5491112345678",
    timestamp: new Date("2026-07-16T12:00:00.000Z"),
    kind: "interactive",
    interactive: {
      type: "flow",
      name: "future-onboarding",
      response: {
        flow_type: "worker-onboarding-future",
        full_name: "Carlos Pérez",
        cuit: "20-12345678-9",
        alias: sensitiveValue,
      },
      flowToken: {
        sessionId: "1f967f35-9f99-4db0-bd42-2d88f734cc72",
        tokenSha256: "b".repeat(64),
      },
    },
    raw: {
      interactive: {
        type: "nfm_reply",
        nfm_reply: { response_json: JSON.stringify({ alias: sensitiveValue }) },
      },
    },
  }, {
    projectId: "project-1",
    organizationId: "organization-1",
    phoneNumberId: "phone-1",
  });

  assert.deepEqual(payload.event.interactive.response, {});
  assert.deepEqual(JSON.parse(payload.event.raw.interactive.nfm_reply.response_json), {});
  assert.equal(JSON.stringify(payload).includes(sensitiveValue), false);
  assert.equal(JSON.stringify(payload).includes("Carlos Pérez"), false);
  assert.equal(JSON.stringify(payload).includes("20-12345678-9"), false);
});

test("storage IDs are stable and tenant-scoped without changing provider payload IDs", () => {
  assert.equal(
    scopedWebhookExternalId("project-1", "wamid.1"),
    "project:project-1:wamid.1",
  );
  assert.throws(
    () => scopedWebhookExternalId("", "wamid.1"),
    (error) => error.code === "WEBHOOK_PAYLOAD_INVALID",
  );
});

test("unsupported stored payloads fail terminally instead of consuming retries", () => {
  assert.throws(
    () => deserializeWebhookPayload({ version: 99, event: {}, scope: {} }),
    (error) => error.code === "WEBHOOK_PAYLOAD_INVALID"
      && isTerminalWebhookFailure(error),
  );
  assert.throws(
    () => deserializeWebhookPayload(serializeWebhookPayload(
      { externalId: "wamid.1", eventType: "message", timestamp: "not-a-date" },
      { projectId: "project-1", organizationId: "organization-1" },
    )),
    (error) => error.code === "WEBHOOK_PAYLOAD_INVALID",
  );
});

test("project drain processes leased events serially and in acquisition order", async () => {
  const queue = [
    { id: "event-1", leaseToken: "lease-1" },
    { id: "event-2", leaseToken: "lease-2" },
    { id: "event-3", leaseToken: "lease-3" },
  ];
  const processed = [];
  const completed = [];
  let active = 0;
  let maxActive = 0;

  const result = await drainWebhookProjectQueue({
    projectId: "project-1",
    acquire: async () => queue.shift() || null,
    process: async (event) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      processed.push(event.id);
      active -= 1;
    },
    complete: async (event) => {
      completed.push(event.id);
      return true;
    },
    reschedule: async () => assert.fail("successful events must not be rescheduled"),
  });

  assert.deepEqual(processed, ["event-1", "event-2", "event-3"]);
  assert.deepEqual(completed, processed);
  assert.equal(maxActive, 1);
  assert.deepEqual(result, { completed: 3, failed: 0, blocked: false });
});

test("project drain reschedules a failed head and does not overtake it", async () => {
  const queue = [
    { id: "event-1", leaseToken: "lease-1" },
    { id: "event-2", leaseToken: "lease-2" },
  ];
  const rescheduled = [];
  const result = await drainWebhookProjectQueue({
    projectId: "project-1",
    acquire: async () => queue.shift() || null,
    process: async () => {
      throw new Error("temporary Meta failure");
    },
    complete: async () => assert.fail("failed events must not complete"),
    reschedule: async (event, error) => rescheduled.push([event.id, error.message]),
  });

  assert.deepEqual(rescheduled, [["event-1", "temporary Meta failure"]]);
  assert.equal(queue[0].id, "event-2");
  assert.deepEqual(result, { completed: 0, failed: 0, blocked: true });
});

test("project drain retires a terminal head and continues with the next event", async () => {
  const queue = [
    { id: "event-terminal", leaseToken: "lease-1" },
    { id: "event-valid", leaseToken: "lease-2" },
  ];
  const completed = [];
  const result = await drainWebhookProjectQueue({
    projectId: "project-1",
    acquire: async () => queue.shift() || null,
    process: async (event) => {
      if (event.id === "event-terminal") {
        const error = new Error("invalid payload");
        error.code = "WEBHOOK_PAYLOAD_INVALID";
        throw error;
      }
    },
    complete: async (event) => {
      completed.push(event.id);
      return true;
    },
    reschedule: async (_event, error) => ({
      status: isTerminalWebhookFailure(error) ? "FAILED" : "PENDING",
      nextAttemptAt: null,
    }),
  });

  assert.deepEqual(completed, ["event-valid"]);
  assert.deepEqual(result, { completed: 1, failed: 1, blocked: false });
});
