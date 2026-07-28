import assert from "node:assert/strict";
import test from "node:test";

import {
  expireAndPurgeWorkerOnboardingClaimsBatch,
  WORKER_ONBOARDING_RETENTION_BATCH_LIMIT,
  workerOnboardingSensitivePurgeData,
} from "../src/lib/worker-onboarding-retention.js";

const NOW = new Date("2026-07-28T09:30:00.000Z");
const PURGED_FIELDS = [
  "senderEncryptedPayload",
  "senderFingerprint",
  "senderFingerprintKeyId",
  "senderLastFour",
  "senderWrappingKeyId",
  "senderRecordVersion",
  "claimedIdentityEncryptedPayload",
  "claimedCuilFingerprint",
  "claimedCuilFingerprintKeyId",
  "claimedCuilLastFour",
  "claimedIdentityWrappingKeyId",
  "claimedIdentityRecordVersion",
];

function expiredRow(index = 1, overrides = {}) {
  return {
    id: `claim-${index}`,
    organizationId: `organization-${index}`,
    projectId: `project-${index}`,
    previousStatus: index % 2 === 0 ? "SUBMITTED" : "PENDING",
    revision: index + 1,
    ...overrides,
  };
}

function database(result, { auditResult, auditError } = {}) {
  const state = {
    query: null,
    queryArgs: null,
    audit: null,
    transactionOptions: null,
    transactionCount: 0,
  };
  const transaction = {
    async $queryRawUnsafe(sql, ...args) {
      state.query = sql;
      state.queryArgs = args;
      return result;
    },
    auditLog: {
      async createMany(input) {
        state.audit = input;
        if (auditError) throw auditError;
        return auditResult ?? { count: input.data.length };
      },
    },
  };
  return {
    state,
    prisma: {
      async $transaction(operation, options) {
        state.transactionCount += 1;
        state.transactionOptions = options;
        return operation(transaction);
      },
    },
  };
}

test("terminal purge data is shared, complete and refuses non-terminal states", () => {
  const data = workerOnboardingSensitivePurgeData({
    status: "approved",
    purgedAt: NOW,
  });
  assert.equal(data.status, "APPROVED");
  assert.equal(data.openClaimKey, null);
  assert.deepEqual(data.revision, { increment: 1 });
  assert.notEqual(data.sensitiveDataPurgedAt, NOW);
  assert.equal(data.sensitiveDataPurgedAt.toISOString(), NOW.toISOString());
  for (const field of PURGED_FIELDS) assert.equal(data[field], null, field);
  assert.throws(
    () => workerOnboardingSensitivePurgeData({ status: "SUBMITTED", purgedAt: NOW }),
    { code: "WORKER_ONBOARDING_RETENTION_INPUT_INVALID" },
  );
});

test("retention batch uses one bounded SKIP LOCKED update and atomic PII-free audits", async () => {
  const secretPhone = "+5491112345678";
  const secretCuil = "20-12345678-9";
  const stored = database([
    expiredRow(1, {
      senderEncryptedPayload: secretPhone,
      claimedIdentityEncryptedPayload: secretCuil,
    }),
    expiredRow(2),
  ]);

  const metrics = await expireAndPurgeWorkerOnboardingClaimsBatch(stored.prisma, {
    now: NOW,
    batchSize: 2,
  });

  assert.deepEqual(metrics, {
    scanned: 2,
    expired: 2,
    purged: 2,
    auditRows: 2,
    hasMore: true,
    failedBatches: 0,
    failureCodes: [],
  });
  assert.equal(stored.state.transactionCount, 1);
  assert.deepEqual(stored.state.transactionOptions, {
    isolationLevel: "ReadCommitted",
    maxWait: 3_000,
    timeout: 10_000,
  });
  assert.match(stored.state.query, /FOR UPDATE OF claim SKIP LOCKED/i);
  assert.match(stored.state.query, /"status" IN \('PENDING', 'SUBMITTED'\)/i);
  assert.match(stored.state.query, /"expiresAt" <= \$1/i);
  assert.match(stored.state.query, /"sensitiveDataPurgedAt" IS NULL/i);
  assert.match(stored.state.query, /LIMIT \$2::int/i);
  assert.match(stored.state.query, /"status" = 'EXPIRED'/i);
  assert.match(stored.state.query, /"openClaimKey" = NULL/i);
  assert.match(stored.state.query, /"revision" = claim\."revision" \+ 1/i);
  for (const field of PURGED_FIELDS) {
    assert.match(stored.state.query, new RegExp(`"${field}" = NULL`), field);
  }
  assert.deepEqual(stored.state.queryArgs, [NOW, 2]);
  assert.equal(stored.state.audit.data.length, 2);
  for (const audit of stored.state.audit.data) {
    assert.match(audit.id, /^[0-9a-f-]{36}$/);
    assert.equal(audit.actorId, null);
    assert.equal(audit.action, "worker.onboarding.sensitive_bundle_purged");
    assert.equal(audit.entityType, "WorkerOnboardingClaim");
    assert.equal(audit.metadata.reason, "AUTOMATIC_EXPIRY");
    assert.equal(audit.metadata.retentionPolicyVersion, "worker-onboarding-transient-v1");
  }
  const publicResult = JSON.stringify(metrics);
  const auditResult = JSON.stringify(stored.state.audit);
  for (const pii of [secretPhone, secretCuil]) {
    assert.equal(publicResult.includes(pii), false);
    assert.equal(auditResult.includes(pii), false);
  }
});

test("retention batch rejects invalid bounds before persistence", async () => {
  for (const batchSize of [0, -1, 1.5, WORKER_ONBOARDING_RETENTION_BATCH_LIMIT + 1]) {
    const stored = database([]);
    await assert.rejects(
      expireAndPurgeWorkerOnboardingClaimsBatch(stored.prisma, { now: NOW, batchSize }),
      { code: "WORKER_ONBOARDING_RETENTION_INPUT_INVALID" },
    );
    assert.equal(stored.state.transactionCount, 0);
  }
  await assert.rejects(
    expireAndPurgeWorkerOnboardingClaimsBatch({}, { now: NOW }),
    { code: "WORKER_ONBOARDING_RETENTION_UNAVAILABLE" },
  );
});

test("retention batch never updates or audits more than 100 claims", async () => {
  const rows = Array.from(
    { length: WORKER_ONBOARDING_RETENTION_BATCH_LIMIT },
    (_, index) => expiredRow(index + 1),
  );
  const stored = database(rows);
  const metrics = await expireAndPurgeWorkerOnboardingClaimsBatch(stored.prisma, { now: NOW });
  assert.equal(stored.state.queryArgs[1], WORKER_ONBOARDING_RETENTION_BATCH_LIMIT);
  assert.equal(stored.state.audit.data.length, WORKER_ONBOARDING_RETENTION_BATCH_LIMIT);
  assert.equal(metrics.purged, WORKER_ONBOARDING_RETENTION_BATCH_LIMIT);
  assert.equal(metrics.hasMore, true);
});

test("audit failure rejects the same transaction instead of reporting an unaudited purge", async () => {
  const failure = Object.assign(new Error("audit persistence unavailable"), { code: "P1001" });
  const stored = database([expiredRow(1)], { auditError: failure });
  await assert.rejects(
    expireAndPurgeWorkerOnboardingClaimsBatch(stored.prisma, { now: NOW, batchSize: 1 }),
    failure,
  );
  assert.equal(stored.state.transactionCount, 1);
  assert.equal(stored.state.audit.data.length, 1);

  const mismatched = database([expiredRow(2)], { auditResult: { count: 0 } });
  await assert.rejects(
    expireAndPurgeWorkerOnboardingClaimsBatch(mismatched.prisma, { now: NOW, batchSize: 1 }),
    { code: "WORKER_ONBOARDING_RETENTION_AUDIT_FAILED" },
  );
});
