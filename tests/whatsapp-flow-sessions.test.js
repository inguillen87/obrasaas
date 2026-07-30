import assert from "node:assert/strict";
import test from "node:test";

import {
  authenticateWhatsAppFlowDataSession,
  consumeWhatsAppFlowSession,
  getWhatsAppFlowSessionForDelivery,
  getWhatsAppFlowSessionSentFence,
  issueWhatsAppFlowSession,
  markWhatsAppFlowSessionDeliveryAttempted,
  markWhatsAppFlowSessionDeliveryRejected,
  markWhatsAppFlowSessionSent,
  WhatsAppFlowSessionError,
  whatsAppFlowTokenEvidence,
} from "../src/lib/whatsapp/flow-sessions.js";

const SECRET = "test-only-whatsapp-flow-session-secret-with-32-bytes";
const NOW = new Date("2026-07-16T12:00:00.000Z");

const BASE_INPUT = Object.freeze({
  organizationId: "organization-a",
  projectId: "project-a",
  workerId: "worker-a",
  phoneNumberId: "123456789012345",
  recipient: "+5491112345678",
  blueprintKey: "incident-report",
  flowId: "987654321012345",
  screenId: "INCIDENT_REPORT",
  flowType: "incident",
  sourceExternalId: "wamid.inbound-a",
});

function prismaError(target) {
  return Object.assign(new Error("Unique constraint failed"), {
    code: "P2002",
    meta: { target },
  });
}

function matchesWhere(record, where) {
  return Object.entries(where).every(([field, expected]) => {
    const actual = record[field];
    if (
      expected
      && typeof expected === "object"
      && !Array.isArray(expected)
    ) {
      if (Object.hasOwn(expected, "gt")) {
        return new Date(actual).getTime() > new Date(expected.gt).getTime();
      }
      if (Object.hasOwn(expected, "lte")) {
        return new Date(actual).getTime() <= new Date(expected.lte).getTime();
      }
      if (Object.hasOwn(expected, "not")) {
        return actual !== expected.not;
      }
    }
    return actual === expected;
  });
}

function flowSessionStore() {
  const records = [];

  function find(where) {
    if (where.id) return records.find((record) => record.id === where.id) || null;
    const composite = where.projectId_sourceExternalId_blueprintKey;
    if (composite) {
      return records.find((record) => (
        record.projectId === composite.projectId
        && record.sourceExternalId === composite.sourceExternalId
        && record.blueprintKey === composite.blueprintKey
      )) || null;
    }
    return null;
  }

  function assertUnique(candidate, currentId = null) {
    const conflict = records.find((record) => (
      record.id !== currentId
      && (
        record.tokenSha256 === candidate.tokenSha256
        || (
          candidate.providerMessageId
          && record.providerMessageId === candidate.providerMessageId
        )
        || (
          record.projectId === candidate.projectId
          && record.sourceExternalId === candidate.sourceExternalId
          && record.blueprintKey === candidate.blueprintKey
        )
        || (
          candidate.consumedExternalId
          && record.projectId === candidate.projectId
          && record.consumedExternalId === candidate.consumedExternalId
        )
      )
    ));
    if (conflict) throw prismaError(["WhatsAppFlowSession"]);
  }

  const delegate = {
    async findUnique({ where }) {
      const record = find(where);
      return record ? { ...record } : null;
    },
    async create({ data }) {
      const createdAt = new Date();
      const record = {
        ...data,
        deliveryAttemptedAt: data.deliveryAttemptedAt ?? null,
        deliveryRejectedAt: data.deliveryRejectedAt ?? null,
        sentAt: data.sentAt ?? null,
        providerMessageId: data.providerMessageId ?? null,
        consumedAt: data.consumedAt ?? null,
        consumedExternalId: data.consumedExternalId ?? null,
        createdAt,
        updatedAt: createdAt,
      };
      assertUnique(record);
      records.push(record);
      return { ...record };
    },
    async updateMany({ where, data }) {
      const matching = records.filter((record) => matchesWhere(record, where));
      for (const record of matching) {
        assertUnique({ ...record, ...data }, record.id);
      }
      for (const record of matching) {
        Object.assign(record, data, { updatedAt: new Date() });
      }
      return { count: matching.length };
    },
  };

  return {
    prisma: { whatsAppFlowSession: delegate },
    records,
  };
}

function consumptionInput(tokenEvidence, overrides = {}) {
  return {
    tokenEvidence,
    consumedExternalId: "wamid.flow-reply-a",
    organizationId: BASE_INPUT.organizationId,
    projectId: BASE_INPUT.projectId,
    workerId: BASE_INPUT.workerId,
    phoneNumberId: BASE_INPUT.phoneNumberId,
    recipient: BASE_INPUT.recipient,
    blueprintKey: BASE_INPUT.blueprintKey,
    flowId: BASE_INPUT.flowId,
    screenId: BASE_INPUT.screenId,
    flowType: BASE_INPUT.flowType,
    ...overrides,
  };
}

function deliveryInput(sessionId, overrides = {}) {
  return {
    sessionId,
    organizationId: BASE_INPUT.organizationId,
    projectId: BASE_INPUT.projectId,
    phoneNumberId: BASE_INPUT.phoneNumberId,
    recipient: BASE_INPUT.recipient,
    blueprintKey: BASE_INPUT.blueprintKey,
    flowId: BASE_INPUT.flowId,
    screenId: BASE_INPUT.screenId,
    flowType: BASE_INPUT.flowType,
    ...overrides,
  };
}

function sentFenceInput(sessionId, overrides = {}) {
  return {
    sessionId,
    organizationId: BASE_INPUT.organizationId,
    projectId: BASE_INPUT.projectId,
    phoneNumberId: BASE_INPUT.phoneNumberId,
    recipient: BASE_INPUT.recipient,
    blueprintKey: BASE_INPUT.blueprintKey,
    sourceExternalId: BASE_INPUT.sourceExternalId,
    ...overrides,
  };
}

async function fenceDeliveryAttempt(store, sessionId, now = NOW) {
  return markWhatsAppFlowSessionDeliveryAttempted(
    store.prisma,
    { sessionId },
    { now },
  );
}

function assertFlowError(code) {
  return (error) => {
    assert.equal(error instanceof WhatsAppFlowSessionError, true);
    assert.equal(error.code, code);
    return true;
  };
}

async function withEnvironment(changes, callback) {
  const previous = new Map();
  for (const [name, value] of Object.entries(changes)) {
    previous.set(name, process.env[name]);
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  try {
    return await callback();
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

test("Flow issuance is deterministic per source and stores only SHA-256 evidence", async () => {
  const store = flowSessionStore();
  const first = await issueWhatsAppFlowSession(store.prisma, BASE_INPUT, {
    secret: SECRET,
    now: NOW,
  });
  const retry = await issueWhatsAppFlowSession(store.prisma, BASE_INPUT, {
    secret: SECRET,
    now: new Date(NOW.getTime() + 5_000),
  });

  assert.match(
    first.token,
    /^ofs1\.[0-9a-f]{8}-[0-9a-f-]{27}\.[A-Za-z0-9_-]{43}$/,
  );
  assert.equal(retry.session.id, first.session.id);
  assert.equal(retry.token, first.token);
  assert.equal(store.records.length, 1);

  const evidence = whatsAppFlowTokenEvidence(first.token);
  assert.deepEqual(evidence, {
    sessionId: first.session.id,
    tokenSha256: first.session.tokenSha256,
  });
  assert.match(store.records[0].tokenSha256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(store.records[0]).includes(first.token), false);
  assert.equal(Object.hasOwn(store.records[0], "token"), false);
  assert.equal(Object.hasOwn(store.records[0], "encryptedToken"), false);
});

test("the same source cannot be rebound to a different immutable scope", async () => {
  const store = flowSessionStore();
  await issueWhatsAppFlowSession(store.prisma, BASE_INPUT, { secret: SECRET, now: NOW });

  await assert.rejects(
    issueWhatsAppFlowSession(store.prisma, {
      ...BASE_INPUT,
      workerId: "worker-b",
    }, { secret: SECRET, now: NOW }),
    assertFlowError("WHATSAPP_FLOW_SESSION_CONFLICT"),
  );
});

test("every persisted claim participates in token integrity", async () => {
  const mutableClaims = [
    ["organizationId", "organization-b"],
    ["projectId", "project-b"],
    ["workerId", "worker-b"],
    ["phoneNumberId", "223456789012345"],
    ["recipientPhone", "5491199999999"],
    ["blueprintKey", "shift-check-in"],
    ["flowId", "887654321012345"],
    ["screenId", "OTHER_SCREEN"],
    ["flowType", "attendance"],
    ["sourceExternalId", "wamid.inbound-b"],
  ];

  for (const [field, value] of mutableClaims) {
    const store = flowSessionStore();
    await issueWhatsAppFlowSession(store.prisma, BASE_INPUT, { secret: SECRET, now: NOW });
    store.records[0][field] = value;
    const changedInput = {
      ...deliveryInput(store.records[0].id),
      [field === "recipientPhone" ? "recipient" : field]: value,
    };
    await assert.rejects(
      getWhatsAppFlowSessionForDelivery(store.prisma, changedInput, {
        secret: SECRET,
        now: NOW,
      }),
      assertFlowError("WHATSAPP_FLOW_SESSION_INVALID"),
      field,
    );
  }

  const expiryStore = flowSessionStore();
  await issueWhatsAppFlowSession(expiryStore.prisma, BASE_INPUT, { secret: SECRET, now: NOW });
  expiryStore.records[0].expiresAt = new Date(expiryStore.records[0].expiresAt.getTime() + 1_000);
  await assert.rejects(
    getWhatsAppFlowSessionForDelivery(
      expiryStore.prisma,
      deliveryInput(expiryStore.records[0].id),
      {
        secret: SECRET,
        now: NOW,
      },
    ),
    assertFlowError("WHATSAPP_FLOW_SESSION_INVALID"),
  );
});

test("delivery looks up by durable session ID and strictly validates the available scope", async () => {
  const store = flowSessionStore();
  const issued = await issueWhatsAppFlowSession(store.prisma, BASE_INPUT, {
    secret: SECRET,
    now: NOW,
  });

  const minimal = await getWhatsAppFlowSessionForDelivery(
    store.prisma,
    deliveryInput(issued.session.id),
    { secret: SECRET, now: NOW },
  );
  assert.equal(minimal.token, issued.token);

  const fullyBound = await getWhatsAppFlowSessionForDelivery(
    store.prisma,
    deliveryInput(issued.session.id, {
      workerId: BASE_INPUT.workerId,
      sourceExternalId: BASE_INPUT.sourceExternalId,
    }),
    { secret: SECRET, now: NOW },
  );
  assert.equal(fullyBound.token, issued.token);

  for (const mismatch of [
    { phoneNumberId: "223456789012345" },
    { recipient: "+5491199999999" },
    { blueprintKey: "shift-check-in" },
    { flowId: "887654321012345" },
    { screenId: "OTHER_SCREEN" },
    { flowType: "attendance" },
    { workerId: "worker-b" },
    { sourceExternalId: "wamid.inbound-b" },
  ]) {
    await assert.rejects(
      getWhatsAppFlowSessionForDelivery(
        store.prisma,
        deliveryInput(issued.session.id, mismatch),
        { secret: SECRET, now: NOW },
      ),
      assertFlowError("WHATSAPP_FLOW_SESSION_INVALID"),
    );
  }
});

test("delivery reuses the deterministic token and rejects the exact expiration boundary", async () => {
  const store = flowSessionStore();
  const issued = await issueWhatsAppFlowSession(store.prisma, BASE_INPUT, {
    secret: SECRET,
    now: NOW,
    ttlMs: 60_000,
  });
  const beforeBoundary = await getWhatsAppFlowSessionForDelivery(store.prisma, deliveryInput(issued.session.id), {
    secret: SECRET,
    now: new Date(NOW.getTime() + 59_999),
    minRemainingMs: 0,
  });
  assert.equal(beforeBoundary.token, issued.token);

  await assert.rejects(
    getWhatsAppFlowSessionForDelivery(store.prisma, deliveryInput(issued.session.id), {
      secret: SECRET,
      now: new Date(NOW.getTime() + 60_000),
      minRemainingMs: 0,
    }),
    assertFlowError("WHATSAPP_FLOW_SESSION_EXPIRED"),
  );
});

test("an authenticated expired reply is consumed once for safe reissuance without applying it", async () => {
  const store = flowSessionStore();
  const issued = await issueWhatsAppFlowSession(store.prisma, BASE_INPUT, {
    secret: SECRET,
    now: NOW,
    ttlMs: 60_000,
  });
  await fenceDeliveryAttempt(store, issued.session.id, NOW);
  const tokenEvidence = whatsAppFlowTokenEvidence(issued.token);
  const recoveryTime = new Date(NOW.getTime() + 60_000);

  await assert.rejects(
    consumeWhatsAppFlowSession(
      store.prisma,
      consumptionInput(tokenEvidence, { projectId: "project-b" }),
      {
        secret: SECRET,
        now: recoveryTime,
        recoverExpired: true,
      },
    ),
    assertFlowError("WHATSAPP_FLOW_SESSION_INVALID"),
  );
  assert.equal(store.records[0].consumedAt, null);

  const recovered = await consumeWhatsAppFlowSession(
    store.prisma,
    consumptionInput(tokenEvidence),
    {
      secret: SECRET,
      now: recoveryTime,
      recoverExpired: true,
    },
  );
  assert.equal(recovered.expired, true);
  assert.equal(recovered.session.consumedExternalId, "wamid.flow-reply-a");
  assert.equal(
    recovered.session.consumedAt.toISOString(),
    recoveryTime.toISOString(),
  );

  await assert.rejects(
    consumeWhatsAppFlowSession(
      store.prisma,
      consumptionInput(tokenEvidence, {
        consumedExternalId: "wamid.flow-reply-replay",
      }),
      {
        secret: SECRET,
        now: new Date(recoveryTime.getTime() + 1_000),
        recoverExpired: true,
      },
    ),
    assertFlowError("WHATSAPP_FLOW_SESSION_USED"),
  );
});

test("pre-consumption validation runs after authentication and before the single-use CAS", async () => {
  const store = flowSessionStore();
  const issued = await issueWhatsAppFlowSession(store.prisma, BASE_INPUT, {
    secret: SECRET,
    now: NOW,
  });
  await fenceDeliveryAttempt(store, issued.session.id, NOW);
  const tokenEvidence = whatsAppFlowTokenEvidence(issued.token);
  let validations = 0;
  await assert.rejects(
    consumeWhatsAppFlowSession(
      store.prisma,
      consumptionInput(tokenEvidence),
      {
        secret: SECRET,
        now: new Date(NOW.getTime() + 1_000),
        beforeConsume: async (_prisma, context) => {
          validations += 1;
          assert.equal(context.session.id, issued.session.id);
          assert.equal(context.expired, false);
          throw Object.assign(new Error('terminal receipt mismatch'), {
            code: 'WHATSAPP_FLOW_SESSION_INVALID',
          });
        },
      },
    ),
    (error) => error.code === 'WHATSAPP_FLOW_SESSION_INVALID',
  );
  assert.equal(validations, 1);
  assert.equal(store.records[0].consumedAt, null);

  const consumed = await consumeWhatsAppFlowSession(
    store.prisma,
    consumptionInput(tokenEvidence),
    {
      secret: SECRET,
      now: new Date(NOW.getTime() + 2_000),
      beforeConsume: async () => { validations += 1; },
    },
  );
  assert.equal(consumed.session.consumedExternalId, 'wamid.flow-reply-a');
  assert.equal(validations, 2);
});

test("an already-sent session remains an idempotent delivery fence after expiry", async () => {
  const store = flowSessionStore();
  const issued = await issueWhatsAppFlowSession(store.prisma, BASE_INPUT, {
    secret: SECRET,
    now: NOW,
    ttlMs: 60_000,
  });
  await fenceDeliveryAttempt(store, issued.session.id);
  await markWhatsAppFlowSessionSent(store.prisma, {
    sessionId: issued.session.id,
    providerMessageId: "wamid.sent-before-expiry",
  }, { now: new Date(NOW.getTime() + 1_000) });

  const delivery = await getWhatsAppFlowSessionForDelivery(
    store.prisma,
    deliveryInput(issued.session.id),
    {
      secret: SECRET,
      now: new Date(NOW.getTime() + 120_000),
    },
  );
  assert.equal(delivery.token, null);
  assert.equal(delivery.session.providerMessageId, "wamid.sent-before-expiry");
});

test("the sent fence survives missing signing secrets and rejects cross-scope lookups", async () => {
  const store = flowSessionStore();
  const issued = await issueWhatsAppFlowSession(store.prisma, BASE_INPUT, {
    secret: SECRET,
    now: NOW,
  });
  await fenceDeliveryAttempt(store, issued.session.id);
  await markWhatsAppFlowSessionSent(store.prisma, {
    sessionId: issued.session.id,
    providerMessageId: "wamid.sent-fence",
  }, { now: new Date(NOW.getTime() + 1_000) });

  const fence = await getWhatsAppFlowSessionSentFence(
    store.prisma,
    sentFenceInput(issued.session.id),
  );
  assert.equal(fence.session.providerMessageId, "wamid.sent-fence");

  await assert.rejects(
    getWhatsAppFlowSessionSentFence(
      store.prisma,
      sentFenceInput(issued.session.id, { projectId: "project-b" }),
    ),
    assertFlowError("WHATSAPP_FLOW_SESSION_INVALID"),
  );
});

test("delivery refuses a token that is inside the minimum safe completion window", async () => {
  const store = flowSessionStore();
  const issued = await issueWhatsAppFlowSession(store.prisma, BASE_INPUT, {
    secret: SECRET,
    now: NOW,
    ttlMs: 10 * 60_000,
  });

  await assert.rejects(
    getWhatsAppFlowSessionForDelivery(
      store.prisma,
      deliveryInput(issued.session.id),
      {
        secret: SECRET,
        now: new Date(NOW.getTime() + 5 * 60_000),
        minRemainingMs: 5 * 60_000,
      },
    ),
    assertFlowError("WHATSAPP_FLOW_SESSION_EXPIRED"),
  );
});

test("scope mismatches cannot consume or burn a valid Flow session", async () => {
  const store = flowSessionStore();
  const { token } = await issueWhatsAppFlowSession(store.prisma, BASE_INPUT, {
    secret: SECRET,
    now: NOW,
  });
  await fenceDeliveryAttempt(store, store.records[0].id);
  const tokenEvidence = whatsAppFlowTokenEvidence(token);
  const mismatches = [
    { organizationId: "organization-b" },
    { projectId: "project-b" },
    { workerId: "worker-b" },
    { phoneNumberId: "223456789012345" },
    { recipient: "+5491199999999" },
    { blueprintKey: "shift-check-in" },
    { flowId: "887654321012345" },
    { screenId: "OTHER_SCREEN" },
    { flowType: "attendance" },
  ];

  for (const mismatch of mismatches) {
    await assert.rejects(
      consumeWhatsAppFlowSession(
        store.prisma,
        consumptionInput(tokenEvidence, mismatch),
        { secret: SECRET, now: NOW },
      ),
      assertFlowError("WHATSAPP_FLOW_SESSION_INVALID"),
    );
    assert.equal(store.records[0].consumedAt, null);
  }
});

test("Flow consumption is single-use and rejects every replay, including the same webhook ID", async () => {
  const store = flowSessionStore();
  const { token } = await issueWhatsAppFlowSession(store.prisma, BASE_INPUT, {
    secret: SECRET,
    now: NOW,
  });
  await fenceDeliveryAttempt(store, store.records[0].id);
  const tokenEvidence = whatsAppFlowTokenEvidence(token);
  const first = await consumeWhatsAppFlowSession(
    store.prisma,
    consumptionInput(tokenEvidence),
    { secret: SECRET, now: NOW },
  );
  assert.equal(first.session.consumedExternalId, "wamid.flow-reply-a");

  await assert.rejects(
    consumeWhatsAppFlowSession(
      store.prisma,
      consumptionInput(tokenEvidence),
      { secret: SECRET, now: new Date(NOW.getTime() + 1_000) },
    ),
    assertFlowError("WHATSAPP_FLOW_SESSION_USED"),
  );

  await assert.rejects(
    consumeWhatsAppFlowSession(
      store.prisma,
      consumptionInput(tokenEvidence, { consumedExternalId: "wamid.flow-replay-b" }),
      { secret: SECRET, now: new Date(NOW.getTime() + 2_000) },
    ),
    assertFlowError("WHATSAPP_FLOW_SESSION_USED"),
  );
});

test("invalid evidence and unknown sessions fail with the same non-oracle code", async () => {
  const store = flowSessionStore();
  const { token } = await issueWhatsAppFlowSession(store.prisma, BASE_INPUT, {
    secret: SECRET,
    now: NOW,
  });
  await fenceDeliveryAttempt(store, store.records[0].id);
  const evidence = whatsAppFlowTokenEvidence(token);

  await assert.rejects(
    consumeWhatsAppFlowSession(
      store.prisma,
      consumptionInput({ ...evidence, tokenSha256: "0".repeat(64) }),
      { secret: SECRET, now: NOW },
    ),
    assertFlowError("WHATSAPP_FLOW_SESSION_INVALID"),
  );
  await assert.rejects(
    consumeWhatsAppFlowSession(
      store.prisma,
      consumptionInput({
        sessionId: "d9428888-122b-4d1f-bc5d-001122334455",
        tokenSha256: "1".repeat(64),
      }),
      { secret: SECRET, now: NOW },
    ),
    assertFlowError("WHATSAPP_FLOW_SESSION_INVALID"),
  );
  assert.equal(store.records[0].consumedAt, null);
});

test("concurrent Flow claims have one CAS winner", async () => {
  const store = flowSessionStore();
  const { token } = await issueWhatsAppFlowSession(store.prisma, BASE_INPUT, {
    secret: SECRET,
    now: NOW,
  });
  await fenceDeliveryAttempt(store, store.records[0].id);
  const tokenEvidence = whatsAppFlowTokenEvidence(token);
  const claims = await Promise.allSettled([
    consumeWhatsAppFlowSession(
      store.prisma,
      consumptionInput(tokenEvidence, { consumedExternalId: "wamid.concurrent-a" }),
      { secret: SECRET, now: NOW },
    ),
    consumeWhatsAppFlowSession(
      store.prisma,
      consumptionInput(tokenEvidence, { consumedExternalId: "wamid.concurrent-b" }),
      { secret: SECRET, now: NOW },
    ),
  ]);

  assert.equal(claims.filter(({ status }) => status === "fulfilled").length, 1);
  const rejected = claims.find(({ status }) => status === "rejected");
  assert.equal(rejected.reason.code, "WHATSAPP_FLOW_SESSION_USED");
});

test("one inbound external ID cannot consume two different sessions", async () => {
  const store = flowSessionStore();
  const first = await issueWhatsAppFlowSession(store.prisma, BASE_INPUT, {
    secret: SECRET,
    now: NOW,
  });
  const secondInput = {
    ...BASE_INPUT,
    sourceExternalId: "wamid.inbound-b",
  };
  const second = await issueWhatsAppFlowSession(store.prisma, secondInput, {
    secret: SECRET,
    now: NOW,
  });
  await fenceDeliveryAttempt(store, first.session.id);
  await fenceDeliveryAttempt(store, second.session.id);
  await consumeWhatsAppFlowSession(
    store.prisma,
    consumptionInput(whatsAppFlowTokenEvidence(first.token)),
    { secret: SECRET, now: NOW },
  );

  await assert.rejects(
    consumeWhatsAppFlowSession(
      store.prisma,
      consumptionInput(whatsAppFlowTokenEvidence(second.token)),
      { secret: SECRET, now: NOW },
    ),
    assertFlowError("WHATSAPP_FLOW_SESSION_USED"),
  );
  assert.equal(store.records[1].consumedAt, null);
});

test("an expired token cannot be consumed at the exact boundary", async () => {
  const store = flowSessionStore();
  const { token } = await issueWhatsAppFlowSession(store.prisma, BASE_INPUT, {
    secret: SECRET,
    now: NOW,
    ttlMs: 60_000,
  });
  await fenceDeliveryAttempt(store, store.records[0].id);
  const tokenEvidence = whatsAppFlowTokenEvidence(token);

  await assert.rejects(
    consumeWhatsAppFlowSession(
      store.prisma,
      consumptionInput(tokenEvidence),
      { secret: SECRET, now: new Date(NOW.getTime() + 60_000) },
    ),
    assertFlowError("WHATSAPP_FLOW_SESSION_EXPIRED"),
  );
  assert.equal(store.records[0].consumedAt, null);
});

test("delivery attempt and rejection fences are durable and idempotent", async () => {
  const store = flowSessionStore();
  const issued = await issueWhatsAppFlowSession(store.prisma, BASE_INPUT, {
    secret: SECRET,
    now: NOW,
  });
  const firstAttempt = await fenceDeliveryAttempt(store, issued.session.id);
  assert.equal(firstAttempt.alreadyAttempted, false);
  assert.equal(firstAttempt.session.deliveryAttemptedAt.toISOString(), NOW.toISOString());

  const retryAttempt = await fenceDeliveryAttempt(
    store,
    issued.session.id,
    new Date(NOW.getTime() + 1_000),
  );
  assert.equal(retryAttempt.alreadyAttempted, true);
  assert.equal(retryAttempt.session.deliveryAttemptedAt.toISOString(), NOW.toISOString());

  const rejected = await markWhatsAppFlowSessionDeliveryRejected(
    store.prisma,
    { sessionId: issued.session.id },
    { now: new Date(NOW.getTime() + 2_000) },
  );
  assert.equal(rejected.alreadyRejected, false);
  assert.equal(
    rejected.session.deliveryRejectedAt.toISOString(),
    new Date(NOW.getTime() + 2_000).toISOString(),
  );

  const rejectedRetry = await markWhatsAppFlowSessionDeliveryRejected(
    store.prisma,
    { sessionId: issued.session.id },
    { now: new Date(NOW.getTime() + 3_000) },
  );
  assert.equal(rejectedRetry.alreadyRejected, true);
  await assert.rejects(
    consumeWhatsAppFlowSession(
      store.prisma,
      consumptionInput(whatsAppFlowTokenEvidence(issued.token)),
      { secret: SECRET, now: new Date(NOW.getTime() + 4_000) },
    ),
    assertFlowError("WHATSAPP_FLOW_SESSION_INVALID"),
  );
});

test("sent and consumed states cannot exist without a durable delivery attempt", async () => {
  const store = flowSessionStore();
  const issued = await issueWhatsAppFlowSession(store.prisma, BASE_INPUT, {
    secret: SECRET,
    now: NOW,
  });

  await assert.rejects(
    markWhatsAppFlowSessionSent(store.prisma, {
      sessionId: issued.session.id,
      providerMessageId: "wamid.must-not-link",
    }, { now: NOW }),
    assertFlowError("WHATSAPP_FLOW_SESSION_PROVIDER_MESSAGE_CONFLICT"),
  );
  await assert.rejects(
    consumeWhatsAppFlowSession(
      store.prisma,
      consumptionInput(whatsAppFlowTokenEvidence(issued.token)),
      { secret: SECRET, now: NOW },
    ),
    assertFlowError("WHATSAPP_FLOW_SESSION_INVALID"),
  );
});

test("sent correlation is idempotent and refuses a different provider message", async () => {
  const store = flowSessionStore();
  const issued = await issueWhatsAppFlowSession(store.prisma, BASE_INPUT, {
    secret: SECRET,
    now: NOW,
  });
  await fenceDeliveryAttempt(store, issued.session.id);
  const first = await markWhatsAppFlowSessionSent(store.prisma, {
    sessionId: issued.session.id,
    providerMessageId: "wamid.outbound-flow-a",
  }, { now: NOW });
  assert.equal(first.alreadySent, false);
  assert.equal(first.session.providerMessageId, "wamid.outbound-flow-a");

  const retry = await markWhatsAppFlowSessionSent(store.prisma, {
    sessionId: issued.session.id,
    providerMessageId: "wamid.outbound-flow-a",
  }, { now: new Date(NOW.getTime() + 1_000) });
  assert.equal(retry.alreadySent, true);

  await assert.rejects(
    markWhatsAppFlowSessionSent(store.prisma, {
      sessionId: issued.session.id,
      providerMessageId: "wamid.outbound-flow-b",
    }, { now: new Date(NOW.getTime() + 2_000) }),
    assertFlowError("WHATSAPP_FLOW_SESSION_PROVIDER_MESSAGE_CONFLICT"),
  );
});

test("the encrypted Data Endpoint authenticates a delivered token without consuming it", async () => {
  const store = flowSessionStore();
  const issued = await issueWhatsAppFlowSession(store.prisma, BASE_INPUT, {
    secret: SECRET,
    now: NOW,
  });

  await assert.rejects(
    authenticateWhatsAppFlowDataSession(store.prisma, {
      token: issued.token,
      organizationId: BASE_INPUT.organizationId,
      projectId: BASE_INPUT.projectId,
      phoneNumberId: BASE_INPUT.phoneNumberId,
    }, { secret: SECRET, now: NOW }),
    assertFlowError("WHATSAPP_FLOW_SESSION_INVALID"),
  );

  await fenceDeliveryAttempt(store, issued.session.id);
  const authenticated = await authenticateWhatsAppFlowDataSession(store.prisma, {
    token: issued.token,
    organizationId: BASE_INPUT.organizationId,
    projectId: BASE_INPUT.projectId,
    phoneNumberId: BASE_INPUT.phoneNumberId,
  }, { secret: SECRET, now: new Date(NOW.getTime() + 1_000) });

  assert.equal(authenticated.session.id, issued.session.id);
  assert.equal(authenticated.session.consumedAt, null);
  assert.equal(store.records[0].consumedAt, null);
});

test("the encrypted Data Endpoint rejects tampering, cross-tenant scope, expiry, and reuse", async () => {
  const store = flowSessionStore();
  const issued = await issueWhatsAppFlowSession(store.prisma, BASE_INPUT, {
    secret: SECRET,
    now: NOW,
    ttlMs: 2_000,
  });
  await fenceDeliveryAttempt(store, issued.session.id);
  const input = {
    token: issued.token,
    organizationId: BASE_INPUT.organizationId,
    projectId: BASE_INPUT.projectId,
    phoneNumberId: BASE_INPUT.phoneNumberId,
  };

  await assert.rejects(
    authenticateWhatsAppFlowDataSession(store.prisma, {
      ...input,
      projectId: "project-b",
    }, { secret: SECRET, now: NOW }),
    assertFlowError("WHATSAPP_FLOW_SESSION_INVALID"),
  );
  await assert.rejects(
    authenticateWhatsAppFlowDataSession(store.prisma, {
      ...input,
      token: `${issued.token.slice(0, -1)}${issued.token.endsWith("A") ? "B" : "A"}`,
    }, { secret: SECRET, now: NOW }),
    assertFlowError("WHATSAPP_FLOW_SESSION_INVALID"),
  );
  await assert.rejects(
    authenticateWhatsAppFlowDataSession(store.prisma, input, {
      secret: SECRET,
      now: new Date(NOW.getTime() + 2_000),
    }),
    assertFlowError("WHATSAPP_FLOW_SESSION_EXPIRED"),
  );

  const expiredRecoveryAuthentication = await authenticateWhatsAppFlowDataSession(
    store.prisma,
    input,
    {
      secret: SECRET,
      now: new Date(NOW.getTime() + 2_000),
      allowExpired: true,
    },
  );
  assert.equal(expiredRecoveryAuthentication.session.id, issued.session.id);
  assert.equal(expiredRecoveryAuthentication.session.consumedAt, null);
  assert.equal(store.records[0].consumedAt, null);
  await assert.rejects(
    authenticateWhatsAppFlowDataSession(store.prisma, {
      ...input,
      projectId: "project-b",
    }, {
      secret: SECRET,
      now: new Date(NOW.getTime() + 2_000),
      allowExpired: true,
    }),
    assertFlowError("WHATSAPP_FLOW_SESSION_INVALID"),
  );
  await assert.rejects(
    authenticateWhatsAppFlowDataSession(store.prisma, {
      ...input,
      token: `${issued.token.slice(0, -1)}${issued.token.endsWith("A") ? "B" : "A"}`,
    }, {
      secret: SECRET,
      now: new Date(NOW.getTime() + 2_000),
      allowExpired: true,
    }),
    assertFlowError("WHATSAPP_FLOW_SESSION_INVALID"),
  );

  await consumeWhatsAppFlowSession(
    store.prisma,
    consumptionInput(whatsAppFlowTokenEvidence(issued.token)),
    { secret: SECRET, now: new Date(NOW.getTime() + 1_000) },
  );
  await assert.rejects(
    authenticateWhatsAppFlowDataSession(store.prisma, input, {
      secret: SECRET,
      now: new Date(NOW.getTime() + 1_500),
    }),
    assertFlowError("WHATSAPP_FLOW_SESSION_USED"),
  );
});

test("expired Data Endpoint authentication remains fenced by delivery rejection and consumption", async () => {
  const rejectedStore = flowSessionStore();
  const rejected = await issueWhatsAppFlowSession(rejectedStore.prisma, BASE_INPUT, {
    secret: SECRET,
    now: NOW,
    ttlMs: 2_000,
  });
  await fenceDeliveryAttempt(rejectedStore, rejected.session.id);
  rejectedStore.records[0].deliveryRejectedAt = new Date(NOW.getTime() + 1_000);
  const rejectedInput = {
    token: rejected.token,
    organizationId: BASE_INPUT.organizationId,
    projectId: BASE_INPUT.projectId,
    phoneNumberId: BASE_INPUT.phoneNumberId,
  };
  await assert.rejects(
    authenticateWhatsAppFlowDataSession(rejectedStore.prisma, rejectedInput, {
      secret: SECRET,
      now: new Date(NOW.getTime() + 2_000),
      allowExpired: true,
    }),
    assertFlowError("WHATSAPP_FLOW_SESSION_INVALID"),
  );

  const consumedStore = flowSessionStore();
  const consumed = await issueWhatsAppFlowSession(consumedStore.prisma, {
    ...BASE_INPUT,
    sourceExternalId: "wamid.inbound-consumed-expired",
  }, {
    secret: SECRET,
    now: NOW,
    ttlMs: 2_000,
  });
  await fenceDeliveryAttempt(consumedStore, consumed.session.id);
  await consumeWhatsAppFlowSession(
    consumedStore.prisma,
    consumptionInput(whatsAppFlowTokenEvidence(consumed.token), {
      consumedExternalId: "wamid.flow-reply-consumed-expired",
    }),
    { secret: SECRET, now: new Date(NOW.getTime() + 1_000) },
  );
  await assert.rejects(
    authenticateWhatsAppFlowDataSession(consumedStore.prisma, {
      token: consumed.token,
      organizationId: BASE_INPUT.organizationId,
      projectId: BASE_INPUT.projectId,
      phoneNumberId: BASE_INPUT.phoneNumberId,
    }, {
      secret: SECRET,
      now: new Date(NOW.getTime() + 2_000),
      allowExpired: true,
    }),
    assertFlowError("WHATSAPP_FLOW_SESSION_USED"),
  );
});

test("a successful send without a provider message ID still sets the idempotent sent fence", async () => {
  const store = flowSessionStore();
  const issued = await issueWhatsAppFlowSession(store.prisma, BASE_INPUT, {
    secret: SECRET,
    now: NOW,
  });
  await fenceDeliveryAttempt(store, issued.session.id);
  const first = await markWhatsAppFlowSessionSent(store.prisma, {
    sessionId: issued.session.id,
  }, { now: NOW });
  assert.equal(first.alreadySent, false);
  assert.equal(first.session.sentAt.toISOString(), NOW.toISOString());
  assert.equal(first.session.providerMessageId, null);

  const retry = await markWhatsAppFlowSessionSent(store.prisma, {
    sessionId: issued.session.id,
    providerMessageId: null,
  }, { now: new Date(NOW.getTime() + 1_000) });
  assert.equal(retry.alreadySent, true);
  assert.equal(retry.session.sentAt.toISOString(), NOW.toISOString());
  assert.equal(retry.session.providerMessageId, null);

  const delivery = await getWhatsAppFlowSessionForDelivery(
    store.prisma,
    deliveryInput(issued.session.id),
    { secret: SECRET, now: new Date(NOW.getTime() + 2_000) },
  );
  assert.equal(delivery.session.sentAt.toISOString(), NOW.toISOString());
  assert.equal(delivery.session.providerMessageId, null);
});

test("hosted runtimes fail closed when no Flow signing secret exists", async () => {
  await withEnvironment({
    NODE_ENV: "production",
    VERCEL: "1",
    WHATSAPP_FLOW_TOKEN_SECRET: undefined,
    WEBVIEW_TOKEN_SECRET: "must-not-sign-whatsapp-flow-sessions",
    JWT_SECRET: "must-not-sign-whatsapp-flow-sessions-either",
  }, async () => {
    const store = flowSessionStore();
    await assert.rejects(
      issueWhatsAppFlowSession(store.prisma, BASE_INPUT, { now: NOW }),
      assertFlowError("WHATSAPP_FLOW_TOKEN_SECRET_REQUIRED"),
    );
    assert.equal(store.records.length, 0);
  });
});

test("the public local secret is available only in explicit development or test runtimes", async () => {
  await withEnvironment({
    NODE_ENV: undefined,
    VERCEL: undefined,
    WHATSAPP_FLOW_TOKEN_SECRET: undefined,
  }, async () => {
    const store = flowSessionStore();
    await assert.rejects(
      issueWhatsAppFlowSession(store.prisma, BASE_INPUT, { now: NOW }),
      assertFlowError("WHATSAPP_FLOW_TOKEN_SECRET_REQUIRED"),
    );
  });

  await withEnvironment({
    NODE_ENV: "development",
    VERCEL: undefined,
    WHATSAPP_FLOW_TOKEN_SECRET: undefined,
  }, async () => {
    const store = flowSessionStore();
    const issued = await issueWhatsAppFlowSession(store.prisma, BASE_INPUT, { now: NOW });
    assert.match(issued.token, /^ofs1\./);
  });
});

test("weak and placeholder Flow signing secrets are rejected", async () => {
  for (const secret of [
    "short",
    "replace-with-a-different-long-random-secret",
    "example-secret-that-is-long-but-public",
  ]) {
    const store = flowSessionStore();
    await assert.rejects(
      issueWhatsAppFlowSession(store.prisma, BASE_INPUT, {
        secret,
        now: NOW,
      }),
      assertFlowError("WHATSAPP_FLOW_TOKEN_SECRET_INVALID"),
    );
    assert.equal(store.records.length, 0);
  }
});
