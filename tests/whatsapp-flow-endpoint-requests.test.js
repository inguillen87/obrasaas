import assert from "node:assert/strict";
import test from "node:test";

import {
  completeWhatsAppFlowEndpointRequest,
  hashWhatsAppFlowEndpointRequest,
  reserveWhatsAppFlowEndpointRequest,
  WhatsAppFlowEndpointRequestError,
  WHATSAPP_FLOW_ENDPOINT_REQUEST_LIMITS,
} from "../src/lib/whatsapp/flow-endpoint-requests.js";

const ENDPOINT_ID = "987e4567-e89b-42d3-a456-426614174000";
const REQUEST_ID = "123e4567-e89b-42d3-a456-426614174000";
const LEASE_ID = "223e4567-e89b-42d3-a456-426614174000";
const NOW = new Date("2026-07-16T12:00:00.000Z");

function store({ recentCount = 0, initial = null } = {}) {
  let record = initial ? { ...initial } : null;
  const rawCalls = [];
  const delegate = {
    async findUnique() {
      return record ? { ...record } : null;
    },
    async count() {
      return recentCount;
    },
    async create({ data }) {
      record = { id: REQUEST_ID, attempts: 1, ...data };
      return { ...record };
    },
    async updateMany({ where, data }) {
      if (!record || (where.id && record.id !== where.id)) return { count: 0 };
      if (where.status && record.status !== where.status) return { count: 0 };
      if (where.leaseToken && record.leaseToken !== where.leaseToken) return { count: 0 };
      const next = { ...data };
      if (next.attempts && typeof next.attempts === "object") {
        next.attempts = Number(record.attempts || 0) + Number(next.attempts.increment || 0);
      }
      Object.assign(record, next);
      return { count: 1 };
    },
  };
  const transaction = {
    whatsAppFlowEndpointRequest: delegate,
    async $executeRawUnsafe(...args) {
      rawCalls.push(args);
      return 1;
    },
  };
  return {
    prisma: {
      whatsAppFlowEndpointRequest: delegate,
      async $transaction(callback) {
        return callback(transaction);
      },
    },
    get record() { return record; },
    rawCalls,
  };
}

test("request hashing is byte-exact", () => {
  const first = hashWhatsAppFlowEndpointRequest(Buffer.from("{}"));
  const second = hashWhatsAppFlowEndpointRequest(Buffer.from("{ }"));
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.notEqual(first, second);
});

test("a new signed transport request gets one durable lease under an advisory lock", async () => {
  const database = store();
  const reserved = await reserveWhatsAppFlowEndpointRequest(database.prisma, {
    endpointId: ENDPOINT_ID,
    requestSha256: "a".repeat(64),
    now: NOW,
  });
  assert.equal(reserved.state, "claimed");
  assert.match(reserved.record.leaseToken, /^[0-9a-f-]{36}$/);
  assert.equal(database.record.action, "UNKNOWN");
  assert.equal(database.rawCalls.length, 2);
  assert.match(database.rawCalls[1][0], /pg_advisory_xact_lock/);
  assert.equal(database.rawCalls[1][1], `obrasaas:flow-data:${ENDPOINT_ID}`);
});

test("terminal ciphertext replays exactly and active concurrent leases have one winner", async () => {
  const replayDatabase = store({
    initial: {
      id: REQUEST_ID,
      endpointId: ENDPOINT_ID,
      requestSha256: "b".repeat(64),
      status: "SUCCEEDED",
      responseStatus: 200,
      responseCiphertext: "encrypted-response",
      expiresAt: new Date(NOW.getTime() + 60_000),
      attempts: 1,
    },
  });
  const replay = await reserveWhatsAppFlowEndpointRequest(replayDatabase.prisma, {
    endpointId: ENDPOINT_ID,
    requestSha256: "b".repeat(64),
    now: NOW,
  });
  assert.equal(replay.state, "replay");
  assert.equal(replay.record.responseCiphertext, "encrypted-response");

  const expiredReplayDatabase = store({
    initial: {
      id: REQUEST_ID,
      endpointId: ENDPOINT_ID,
      requestSha256: "e".repeat(64),
      status: "SUCCEEDED",
      responseStatus: 200,
      responseCiphertext: "permanent-cryptographic-tombstone",
      expiresAt: new Date(NOW.getTime() - 1),
      attempts: 1,
    },
  });
  const expiredReplay = await reserveWhatsAppFlowEndpointRequest(
    expiredReplayDatabase.prisma,
    {
      endpointId: ENDPOINT_ID,
      requestSha256: "e".repeat(64),
      now: NOW,
    },
  );
  assert.equal(expiredReplay.state, "replay");
  assert.equal(
    expiredReplay.record.responseCiphertext,
    "permanent-cryptographic-tombstone",
  );
  assert.equal(expiredReplayDatabase.record.status, "SUCCEEDED");

  const expiredNegativeCacheDatabase = store({
    initial: {
      id: REQUEST_ID,
      endpointId: ENDPOINT_ID,
      requestSha256: "f".repeat(64),
      status: "FAILED",
      responseStatus: 421,
      responseCiphertext: null,
      failureCode: "WHATSAPP_FLOW_CRYPTO_RSA_KEY_MISMATCH",
      expiresAt: new Date(NOW.getTime() - 1),
      attempts: 1,
    },
  });
  const recovered = await reserveWhatsAppFlowEndpointRequest(
    expiredNegativeCacheDatabase.prisma,
    {
      endpointId: ENDPOINT_ID,
      requestSha256: "f".repeat(64),
      now: NOW,
    },
  );
  assert.equal(recovered.state, "claimed");
  assert.equal(expiredNegativeCacheDatabase.record.status, "PROCESSING");
  assert.equal(expiredNegativeCacheDatabase.record.responseCiphertext, null);

  const inFlightDatabase = store({
    initial: {
      id: REQUEST_ID,
      endpointId: ENDPOINT_ID,
      requestSha256: "c".repeat(64),
      status: "PROCESSING",
      leaseToken: LEASE_ID,
      leaseExpiresAt: new Date(NOW.getTime() + 5_000),
      expiresAt: new Date(NOW.getTime() + 60_000),
      attempts: 1,
    },
  });
  const inFlight = await reserveWhatsAppFlowEndpointRequest(inFlightDatabase.prisma, {
    endpointId: ENDPOINT_ID,
    requestSha256: "c".repeat(64),
    now: NOW,
  });
  assert.equal(inFlight.state, "in_flight");
  assert.equal(inFlight.record.leaseToken, LEASE_ID);
});

test("per-connection rate limiting happens before creating a new RSA workload", async () => {
  const database = store({
    recentCount: WHATSAPP_FLOW_ENDPOINT_REQUEST_LIMITS.connectionPerMinute,
  });
  await assert.rejects(
    reserveWhatsAppFlowEndpointRequest(database.prisma, {
      endpointId: ENDPOINT_ID,
      requestSha256: "d".repeat(64),
      now: NOW,
    }),
    (error) => error instanceof WhatsAppFlowEndpointRequestError
      && error.code === "WHATSAPP_FLOW_ENDPOINT_RATE_LIMIT"
      && error.status === 429
      && error.retryAfterSeconds === 60,
  );
  assert.equal(database.record, null);
});

test("only the lease owner can commit terminal ciphertext", async () => {
  const database = store({
    initial: {
      id: REQUEST_ID,
      status: "PROCESSING",
      leaseToken: LEASE_ID,
      attempts: 1,
    },
  });
  await completeWhatsAppFlowEndpointRequest(database.prisma, {
    requestId: REQUEST_ID,
    leaseToken: LEASE_ID,
    status: "SUCCEEDED",
    responseStatus: 200,
    responseCiphertext: "encrypted-response",
    action: "INIT",
    screen: "SHIFT_CHECK_IN",
    keyVersion: 1,
    flowSessionId: "323e4567-e89b-42d3-a456-426614174000",
    completedAt: NOW,
  });
  assert.equal(database.record.status, "SUCCEEDED");
  assert.equal(database.record.leaseToken, null);
  assert.equal(database.record.responseCiphertext, "encrypted-response");

  await assert.rejects(
    completeWhatsAppFlowEndpointRequest(database.prisma, {
      requestId: REQUEST_ID,
      leaseToken: LEASE_ID,
      status: "FAILED",
      responseStatus: 500,
      failureCode: "INTERNAL",
      action: "INIT",
      completedAt: NOW,
    }),
    (error) => error instanceof WhatsAppFlowEndpointRequestError
      && error.code === "WHATSAPP_FLOW_ENDPOINT_REQUEST_CONFLICT",
  );
});
