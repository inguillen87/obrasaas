import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import {
  isProgressEvidenceLocationRateLimitError,
  PROGRESS_EVIDENCE_LOCATION_RATE_LIMITS,
  progressEvidenceLocationTokenFingerprint,
  reserveProgressEvidenceLocationRequest,
} from "../src/lib/progress-evidence-location-rate-limit.js";

const NOW = new Date("2026-07-29T18:00:00.000Z");
const TOKEN = "signed-progress-evidence-token-never-persist";

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function session(overrides = {}) {
  const token = overrides.token || TOKEN;
  const result = {
    id: "session-1",
    organizationId: "org-1",
    projectId: "project-1",
    workerId: "worker-1",
    tokenHash: sha256(token),
    status: "AWAITING_LOCATION",
    expiresAt: new Date(NOW.getTime() + 30 * 60 * 1_000),
    ...overrides,
  };
  delete result.token;
  return result;
}

function matchesUnique(row, where) {
  const key = where?.organizationId_scope_scopeKeyHash;
  if (key) {
    return row.organizationId === key.organizationId
      && row.scope === key.scope
      && row.scopeKeyHash === key.scopeKeyHash;
  }
  return row.id === where?.id;
}

function fakePrisma({
  sessions = [session()],
  buckets = [],
  databaseNow = NOW,
  failLock = false,
  failClock = false,
  failCreate = false,
  transitionAfterLock = null,
} = {}) {
  const state = {
    sessions: structuredClone(sessions),
    buckets: structuredClone(buckets),
    databaseNow: new Date(databaseNow),
    calls: [],
    transactionOptions: [],
  };
  let lane = Promise.resolve();

  function transactionClient() {
    return {
      $executeRawUnsafe: async (...args) => {
        state.calls.push(["execute", ...args]);
        if (failLock && /pg_advisory_xact_lock/.test(args[0])) {
          throw Object.assign(new Error("lock timeout"), { code: "55P03" });
        }
        if (transitionAfterLock && /pg_advisory_xact_lock/.test(args[0])) {
          Object.assign(state.sessions[0], structuredClone(transitionAfterLock));
        }
      },
      $queryRawUnsafe: async (...args) => {
        state.calls.push(["query", ...args]);
        if (/FROM "ProgressEvidenceCaptureSession"[\s\S]*FOR SHARE/.test(args[0])) {
          const found = state.sessions.find((row) => (
            row.id === args[1] && row.workerId === args[2]
          ));
          return found ? [structuredClone(found)] : [];
        }
        if (/clock_timestamp/.test(args[0])) {
          if (failClock) return [{ now: "invalid-clock" }];
          return [{ now: new Date(state.databaseNow) }];
        }
        if (/DELETE FROM "ProgressEvidenceLocationRateBucket"/.test(args[0])) {
          const [organizationId, cutoffValue, limit] = args.slice(1);
          const cutoff = new Date(cutoffValue).getTime();
          const ids = state.buckets
            .filter((row) => (
              row.organizationId === organizationId
              && new Date(row.expiresAt).getTime() <= cutoff
            ))
            .sort((left, right) => (
              new Date(left.expiresAt) - new Date(right.expiresAt)
              || left.id.localeCompare(right.id)
            ))
            .slice(0, limit)
            .map((row) => row.id);
          state.buckets = state.buckets.filter((row) => !ids.includes(row.id));
          return ids.map((id) => ({ id }));
        }
        throw new Error("unexpected raw query");
      },
      progressEvidenceCaptureSession: {
        findFirst: async ({ where }) => {
          const found = state.sessions.find((row) => (
            row.id === where.id && row.workerId === where.workerId
          ));
          return found ? structuredClone(found) : null;
        },
      },
      progressEvidenceLocationRateBucket: {
        findUnique: async ({ where }) => {
          const found = state.buckets.find((row) => matchesUnique(row, where));
          return found ? structuredClone(found) : null;
        },
        create: async ({ data }) => {
          if (failCreate) throw new Error("bucket unavailable");
          const row = {
            id: `bucket-${state.buckets.length + 1}`,
            blockedCount: 0n,
            lastBlockedAt: null,
            createdAt: new Date(state.databaseNow),
            ...structuredClone(data),
          };
          state.buckets.push(row);
          return structuredClone(row);
        },
        update: async ({ where, data }) => {
          const index = state.buckets.findIndex((row) => matchesUnique(row, where));
          if (index < 0) throw new Error("bucket missing");
          const current = state.buckets[index];
          const next = { ...current, ...structuredClone(data) };
          if (data.blockedCount?.increment !== undefined) {
            next.blockedCount = BigInt(current.blockedCount || 0)
              + BigInt(data.blockedCount.increment);
          }
          state.buckets[index] = next;
          return structuredClone(next);
        },
      },
    };
  }

  return {
    state,
    async $transaction(operation, options) {
      state.transactionOptions.push(options);
      const previous = lane;
      let release;
      lane = new Promise((resolve) => { release = resolve; });
      await previous;
      try {
        return await operation(transactionClient());
      } finally {
        release();
      }
    },
  };
}

function input(overrides = {}) {
  return {
    action: "INIT",
    workerId: "worker-1",
    sessionId: "session-1",
    token: TOKEN,
    correlationId: "123e4567-e89b-42d3-a456-426614174000",
    ...overrides,
  };
}

function isRateError(code, status) {
  return (error) => isProgressEvidenceLocationRateLimitError(error)
    && error.code === code
    && error.status === status;
}

function bucketFor(prisma, scope, organizationId = "org-1") {
  return prisma.state.buckets.find((row) => (
    row.organizationId === organizationId && row.scope === scope
  ));
}

function serialized(value) {
  return JSON.stringify(value, (_key, item) => (
    typeof item === "bigint" ? item.toString() : item
  ));
}

test("reservation uses an organization lock, then the PostgreSQL clock, and stores bounded buckets only", async () => {
  const prisma = fakePrisma();
  const result = await reserveProgressEvidenceLocationRequest(
    prisma,
    input({ action: "CAPTURE" }),
  );

  assert.deepEqual(result, {
    organizationId: "org-1",
    projectId: "project-1",
    sessionId: "session-1",
    action: "CAPTURE",
  });
  assert.deepEqual(prisma.state.transactionOptions, [{
    isolationLevel: "ReadCommitted",
    maxWait: 3_000,
    timeout: 5_000,
  }]);
  const lockIndex = prisma.state.calls.findIndex((call) => (
    call[0] === "execute" && /pg_advisory_xact_lock/.test(call[1])
  ));
  const clockIndex = prisma.state.calls.findIndex((call) => (
    call[0] === "query" && /clock_timestamp/.test(call[1])
  ));
  const sessionLockIndex = prisma.state.calls.findIndex((call) => (
    call[0] === "query" && /ProgressEvidenceCaptureSession/.test(call[1])
  ));
  assert.ok(lockIndex >= 0 && lockIndex < sessionLockIndex);
  assert.ok(sessionLockIndex < clockIndex);
  assert.equal(prisma.state.buckets.length, 2);
  assert.deepEqual(bucketFor(prisma, "ACTIVE_SESSION").windowBuckets, [[NOW.getTime() / 1_000, 1]]);
  assert.deepEqual(bucketFor(prisma, "ACTIVE_ORGANIZATION").windowBuckets, [[NOW.getTime() / 1_000, 1]]);
  const persisted = serialized(prisma.state.buckets);
  for (const forbidden of [TOKEN, "tokenHash", "latitude", "longitude", "accuracyMeters", "ipAddress", "body"]) {
    assert.equal(persisted.includes(forbidden), false, `${forbidden} must not be persisted`);
  }
});

test("twenty concurrent requests admit exactly twelve without growing rows per request", async () => {
  const prisma = fakePrisma();
  const results = await Promise.allSettled(Array.from({ length: 20 }, (_, index) => (
    reserveProgressEvidenceLocationRequest(
      prisma,
      input({ correlationId: `rate-concurrency-${String(index).padStart(3, "0")}` }),
    )
  )));

  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result) => result.status === "rejected");
  assert.equal(fulfilled.length, PROGRESS_EVIDENCE_LOCATION_RATE_LIMITS.activeSessionPerMinute);
  assert.equal(rejected.length, 8);
  for (const result of rejected) {
    assert.equal(
      isRateError("PROGRESS_EVIDENCE_LOCATION_SESSION_RATE_LIMIT", 429)(result.reason),
      true,
    );
    assert.equal(result.reason.retryAfterSeconds, 60);
  }
  assert.equal(prisma.state.buckets.length, 2);
  assert.deepEqual(bucketFor(prisma, "ACTIVE_SESSION").windowBuckets, [[NOW.getTime() / 1_000, 12]]);
  assert.equal(bucketFor(prisma, "ACTIVE_SESSION").blockedCount, 8n);
  assert.deepEqual(bucketFor(prisma, "ACTIVE_ORGANIZATION").windowBuckets, [[NOW.getTime() / 1_000, 12]]);
});

test("sliding-window Retry-After derives from the oldest PostgreSQL second", async () => {
  const prisma = fakePrisma({ databaseNow: new Date(NOW.getTime() - 30_000) });
  for (let index = 0; index < PROGRESS_EVIDENCE_LOCATION_RATE_LIMITS.activeSessionPerMinute; index += 1) {
    await reserveProgressEvidenceLocationRequest(prisma, input());
  }
  prisma.state.databaseNow = new Date(NOW);
  await assert.rejects(
    reserveProgressEvidenceLocationRequest(prisma, input()),
    (error) => isRateError(
      "PROGRESS_EVIDENCE_LOCATION_SESSION_RATE_LIMIT",
      429,
    )(error) && error.retryAfterSeconds === 30,
  );
});

test("organization quota spans sessions while another tenant remains isolated", async () => {
  const secondToken = "signed-progress-evidence-token-second";
  const thirdToken = "signed-progress-evidence-token-third";
  const prisma = fakePrisma({
    sessions: [
      session(),
      session({ id: "session-2", workerId: "worker-2", token: secondToken }),
      session({
        id: "session-3",
        organizationId: "org-2",
        projectId: "project-2",
        workerId: "worker-3",
        token: thirdToken,
      }),
    ],
  });
  await reserveProgressEvidenceLocationRequest(prisma, input());
  const organizationBucket = bucketFor(prisma, "ACTIVE_ORGANIZATION");
  organizationBucket.windowBuckets = [[
    NOW.getTime() / 1_000,
    PROGRESS_EVIDENCE_LOCATION_RATE_LIMITS.activeOrganizationPerMinute,
  ]];

  await assert.rejects(
    reserveProgressEvidenceLocationRequest(prisma, input({
      workerId: "worker-2",
      sessionId: "session-2",
      token: secondToken,
    })),
    isRateError("PROGRESS_EVIDENCE_LOCATION_ORGANIZATION_RATE_LIMIT", 429),
  );
  const admitted = await reserveProgressEvidenceLocationRequest(prisma, input({
    workerId: "worker-3",
    sessionId: "session-3",
    token: thirdToken,
  }));
  assert.equal(admitted.organizationId, "org-2");
  assert.equal(prisma.state.buckets.filter((row) => row.organizationId === "org-2").length, 2);
});

test("stored token hash and worker/session scope are exact before lock or bucket writes", async () => {
  for (const overrides of [
    { token: `${TOKEN}-tampered` },
    { workerId: "worker-other" },
    { sessionId: "session-other" },
  ]) {
    const prisma = fakePrisma();
    await assert.rejects(
      reserveProgressEvidenceLocationRequest(prisma, input(overrides)),
      isRateError("PROGRESS_EVIDENCE_CAPTURE_TOKEN_INVALID", 401),
    );
    assert.equal(prisma.state.buckets.length, 0);
    assert.equal(prisma.state.calls.length, 0);
  }
});

test("terminal replay requests use a lower isolated lane and never consume active capacity", async () => {
  const prisma = fakePrisma({ sessions: [session({ status: "CANCELLED" })] });
  for (let index = 0; index < PROGRESS_EVIDENCE_LOCATION_RATE_LIMITS.inactiveSessionPerMinute; index += 1) {
    await reserveProgressEvidenceLocationRequest(
      prisma,
      input({ action: "CANCEL", correlationId: `terminal-replay-${index}` }),
    );
  }
  await assert.rejects(
    reserveProgressEvidenceLocationRequest(
      prisma,
      input({ action: "CANCEL", correlationId: "terminal-replay-limited" }),
    ),
    isRateError("PROGRESS_EVIDENCE_LOCATION_SESSION_RATE_LIMIT", 429),
  );
  assert.equal(prisma.state.buckets.length, 2);
  assert.equal(bucketFor(prisma, "ACTIVE_SESSION"), undefined);
  assert.equal(bucketFor(prisma, "ACTIVE_ORGANIZATION"), undefined);
  assert.deepEqual(
    bucketFor(prisma, "INACTIVE_SESSION").windowBuckets,
    [[NOW.getTime() / 1_000, PROGRESS_EVIDENCE_LOCATION_RATE_LIMITS.inactiveSessionPerMinute]],
  );
});

test("the exact expiry boundary and every terminal state use only the inactive lane", async () => {
  const terminalStatuses = ["LOCATION_CAPTURED", "CONSUMED", "CANCELLED", "EXPIRED"];
  for (const current of [
    session({ expiresAt: new Date(NOW) }),
    ...terminalStatuses.map((status) => session({ status })),
  ]) {
    const prisma = fakePrisma({ sessions: [current] });
    await reserveProgressEvidenceLocationRequest(prisma, input());
    assert.equal(bucketFor(prisma, "ACTIVE_SESSION"), undefined);
    assert.equal(bucketFor(prisma, "ACTIVE_ORGANIZATION"), undefined);
    assert.ok(bucketFor(prisma, "INACTIVE_SESSION"));
    assert.ok(bucketFor(prisma, "INACTIVE_ORGANIZATION"));
  }
});

test("a status transition while waiting for the organization lock is classified from the locked row", async () => {
  const prisma = fakePrisma({ transitionAfterLock: { status: "CANCELLED" } });
  await reserveProgressEvidenceLocationRequest(prisma, input());
  assert.equal(bucketFor(prisma, "ACTIVE_SESSION"), undefined);
  assert.equal(bucketFor(prisma, "ACTIVE_ORGANIZATION"), undefined);
  assert.ok(bucketFor(prisma, "INACTIVE_SESSION"));
  assert.ok(bucketFor(prisma, "INACTIVE_ORGANIZATION"));
});

test("saturating inactive organization capacity cannot block a new active session", async () => {
  const activeToken = "signed-progress-evidence-token-active";
  const prisma = fakePrisma({
    sessions: [
      session({ status: "EXPIRED" }),
      session({ id: "session-active", workerId: "worker-active", token: activeToken }),
    ],
  });
  await reserveProgressEvidenceLocationRequest(prisma, input());
  bucketFor(prisma, "INACTIVE_ORGANIZATION").windowBuckets = [[
    NOW.getTime() / 1_000,
    PROGRESS_EVIDENCE_LOCATION_RATE_LIMITS.inactiveOrganizationPerMinute,
  ]];
  await assert.rejects(
    reserveProgressEvidenceLocationRequest(prisma, input()),
    isRateError("PROGRESS_EVIDENCE_LOCATION_ORGANIZATION_RATE_LIMIT", 429),
  );

  const active = await reserveProgressEvidenceLocationRequest(prisma, input({
    workerId: "worker-active",
    sessionId: "session-active",
    token: activeToken,
  }));
  assert.equal(active.sessionId, "session-active");
  assert.ok(bucketFor(prisma, "ACTIVE_SESSION"));
  assert.ok(bucketFor(prisma, "ACTIVE_ORGANIZATION"));
});

test("unknown persisted session state fails closed without creating buckets", async () => {
  const prisma = fakePrisma({ sessions: [session({ status: "UNKNOWN_STATE" })] });
  await assert.rejects(
    reserveProgressEvidenceLocationRequest(prisma, input()),
    isRateError("PROGRESS_EVIDENCE_LOCATION_RATE_LIMIT_UNAVAILABLE", 503),
  );
  assert.equal(prisma.state.buckets.length, 0);
});

test("expired bucket garbage collection is tenant-scoped and corrupt buckets fail closed", async () => {
  const expiredForOrganization = Array.from({ length: 101 }, (_, index) => ({
    id: `expired-org-1-${String(index).padStart(3, "0")}`,
    organizationId: "org-1",
    scope: "ACTIVE_SESSION",
    scopeKeyHash: sha256(`expired-org-1-${index}`),
    windowBuckets: [],
    blockedCount: 0n,
    expiresAt: new Date(NOW.getTime() - 1),
  }));
  const otherTenant = {
    ...expiredForOrganization[0],
    id: "expired-org-2",
    organizationId: "org-2",
  };
  const prisma = fakePrisma({ buckets: [...expiredForOrganization, otherTenant] });
  await reserveProgressEvidenceLocationRequest(prisma, input());
  assert.equal(
    prisma.state.buckets.filter((row) => row.id.startsWith("expired-org-1-")).length,
    1,
  );
  assert.equal(prisma.state.buckets.some((row) => row.id === "expired-org-2"), true);

  const activeSessionBucket = prisma.state.buckets.find((row) => (
    row.organizationId === "org-1"
    && row.scope === "ACTIVE_SESSION"
    && new Date(row.expiresAt).getTime() > NOW.getTime()
  ));
  activeSessionBucket.windowBuckets = [[NOW.getTime() / 1_000, -1]];
  await assert.rejects(
    reserveProgressEvidenceLocationRequest(prisma, input()),
    isRateError("PROGRESS_EVIDENCE_LOCATION_RATE_LIMIT_UNAVAILABLE", 503),
  );
});

test("fingerprints are deterministic, tenant-scoped and never contain the stored hash", () => {
  const base = {
    organizationId: "org-1",
    projectId: "project-1",
    workerId: "worker-1",
    sessionId: "session-1",
    storedTokenHash: sha256(TOKEN),
  };
  const first = progressEvidenceLocationTokenFingerprint(base);
  const replay = progressEvidenceLocationTokenFingerprint(base);
  const otherTenant = progressEvidenceLocationTokenFingerprint({
    ...base,
    organizationId: "org-2",
  });
  const inactive = progressEvidenceLocationTokenFingerprint({
    ...base,
    lane: "INACTIVE",
  });
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first, replay);
  assert.notEqual(first, otherTenant);
  assert.notEqual(first, inactive);
  assert.equal(first.includes(base.storedTokenHash), false);
});

test("lock, database clock and durable bucket failures fail closed with retry guidance", async () => {
  for (const prisma of [
    fakePrisma({ failLock: true }),
    fakePrisma({ failClock: true }),
    fakePrisma({ failCreate: true }),
  ]) {
    await assert.rejects(
      reserveProgressEvidenceLocationRequest(prisma, input()),
      (error) => isRateError(
        "PROGRESS_EVIDENCE_LOCATION_RATE_LIMIT_UNAVAILABLE",
        503,
      )(error) && error.retryAfterSeconds === 2,
    );
  }
});
