import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  authenticateWorkerOnboardingFlowDataSession,
  consumeWorkerOnboardingFlowSession,
  getWorkerOnboardingFlowSessionForDelivery,
  issueWorkerOnboardingFlowSession,
  markWorkerOnboardingFlowPrivacyPresented,
  markWorkerOnboardingFlowSessionDeliveryAttempted,
  markWorkerOnboardingFlowSessionDeliveryRejected,
  markWorkerOnboardingFlowSessionSent,
  markWorkerOnboardingFlowSessionSubmitted,
  WorkerOnboardingFlowSessionError,
  workerOnboardingFlowTokenEvidence,
} from "../src/lib/whatsapp/worker-onboarding-flow-sessions.js";
import { workerFinancialFingerprint } from "../src/lib/worker-financial-data.js";
import {
  getCurrentWorkerOnboardingPrivacyNotice,
  getWorkerOnboardingPrivacyNotice,
} from "../src/lib/worker-onboarding-privacy-notices.js";

const SECRET = "test-only-worker-onboarding-flow-secret-over-32-bytes";
const NOW = new Date("2026-07-28T12:00:00.000Z");
const CLAIM_EXPIRY = new Date(NOW.getTime() + 2 * 60 * 60 * 1_000);
const SENDER_FINGERPRINT = "a".repeat(64);
const SENDER_FINGERPRINT_KEY_ID = "fingerprint-key-v1";
const CURRENT_NOTICE = getCurrentWorkerOnboardingPrivacyNotice();

const BASE_CLAIM = Object.freeze({
  id: "claim-a",
  organizationId: "organization-a",
  projectId: "project-a",
  connectionId: "connection-a",
  senderFingerprint: SENDER_FINGERPRINT,
  senderFingerprintKeyId: SENDER_FINGERPRINT_KEY_ID,
  senderRecordVersion: 1,
  claimTokenHash: "b".repeat(64),
  status: "PENDING",
  expiresAt: CLAIM_EXPIRY,
});

const BASE_INPUT = Object.freeze({
  claimId: BASE_CLAIM.id,
  organizationId: BASE_CLAIM.organizationId,
  projectId: BASE_CLAIM.projectId,
  connectionId: BASE_CLAIM.connectionId,
  phoneNumberId: "123456789012345",
  blueprintKey: "worker-onboarding",
  flowId: "987654321012345",
  screenId: "WORKER_ONBOARDING",
  flowType: "worker_onboarding",
  sourceExternalId: "obrasaas-worker-onboarding:request-a",
  noticeVersion: CURRENT_NOTICE.version,
  noticeContentSha256: CURRENT_NOTICE.contentSha256,
});

function prismaError(target) {
  return Object.assign(new Error("Unique constraint failed"), {
    code: "P2002",
    meta: { target },
  });
}

function cloneRecord(record) {
  if (!record) return null;
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [
    key,
    value instanceof Date ? new Date(value.getTime()) : value,
  ]));
}

function matchesWhere(record, where) {
  return Object.entries(where).every(([field, expected]) => {
    const actual = record[field];
    if (expected && typeof expected === "object" && !Array.isArray(expected)) {
      if (Object.hasOwn(expected, "gt")) {
        return new Date(actual).getTime() > new Date(expected.gt).getTime();
      }
      if (Object.hasOwn(expected, "lte")) {
        return new Date(actual).getTime() <= new Date(expected.lte).getTime();
      }
      if (Object.hasOwn(expected, "not")) return actual !== expected.not;
    }
    return actual === expected;
  });
}

function onboardingSessionStore(claimOverrides = {}) {
  const claims = [{ ...cloneRecord(BASE_CLAIM), ...claimOverrides }];
  const records = [];

  function findSession(where) {
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
        record.claimId === candidate.claimId
        || record.tokenSha256 === candidate.tokenSha256
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
    if (conflict) throw prismaError(["WorkerOnboardingFlowSession"]);
  }

  const sessionDelegate = {
    async findUnique({ where }) {
      return cloneRecord(findSession(where));
    },
    async create({ data }) {
      const record = {
        ...cloneRecord(data),
        deliveryAttemptedAt: data.deliveryAttemptedAt ?? null,
        deliveryRejectedAt: data.deliveryRejectedAt ?? null,
        sentAt: data.sentAt ?? null,
        providerMessageId: data.providerMessageId ?? null,
        privacyPresentedAt: data.privacyPresentedAt ?? null,
        submittedAt: data.submittedAt ?? null,
        consumedAt: data.consumedAt ?? null,
        consumedExternalId: data.consumedExternalId ?? null,
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        updatedAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      };
      assertUnique(record);
      records.push(record);
      return cloneRecord(record);
    },
    async updateMany({ where, data }) {
      const matching = records.filter((record) => matchesWhere(record, where));
      for (const record of matching) assertUnique({ ...record, ...data }, record.id);
      for (const record of matching) {
        Object.assign(record, cloneRecord(data), { updatedAt: new Date() });
      }
      return { count: matching.length };
    },
  };

  const claimDelegate = {
    async findFirst({ where }) {
      return cloneRecord(claims.find((claim) => matchesWhere(claim, where)) || null);
    },
  };

  return {
    prisma: {
      workerOnboardingFlowSession: sessionDelegate,
      workerOnboardingClaim: claimDelegate,
    },
    claims,
    records,
  };
}

function deliveryInput(sessionId, overrides = {}) {
  return { sessionId, ...BASE_INPUT, ...overrides };
}

function endpointInput(token, overrides = {}) {
  return {
    token,
    organizationId: BASE_INPUT.organizationId,
    projectId: BASE_INPUT.projectId,
    connectionId: BASE_INPUT.connectionId,
    phoneNumberId: BASE_INPUT.phoneNumberId,
    ...overrides,
  };
}

function consumptionInput(tokenEvidence, overrides = {}) {
  return {
    tokenEvidence,
    organizationId: BASE_INPUT.organizationId,
    projectId: BASE_INPUT.projectId,
    connectionId: BASE_INPUT.connectionId,
    phoneNumberId: BASE_INPUT.phoneNumberId,
    senderFingerprint: SENDER_FINGERPRINT,
    senderFingerprintKeyId: SENDER_FINGERPRINT_KEY_ID,
    consumedExternalId: "wamid.onboarding-reply-a",
    ...overrides,
  };
}

function assertSessionError(code) {
  return (error) => {
    assert.equal(error instanceof WorkerOnboardingFlowSessionError, true);
    assert.equal(error.code, code);
    return true;
  };
}

async function issue(store, overrides = {}, options = {}) {
  return issueWorkerOnboardingFlowSession(
    store.prisma,
    { ...BASE_INPUT, ...overrides },
    { secret: SECRET, now: NOW, ...options },
  );
}

async function attempt(store, sessionId, now = NOW) {
  return markWorkerOnboardingFlowSessionDeliveryAttempted(
    store.prisma,
    { sessionId },
    { secret: SECRET, now },
  );
}

test("privacy notice registry is immutable, versioned, and committed by SHA-256", () => {
  const legacy = getWorkerOnboardingPrivacyNotice("worker-privacy-v1");
  assert.equal(Object.isFrozen(legacy), true);
  assert.equal(Object.isFrozen(CURRENT_NOTICE), true);
  assert.notEqual(legacy.version, CURRENT_NOTICE.version);
  assert.equal(
    crypto.createHash("sha256").update(CURRENT_NOTICE.content, "utf8").digest("hex"),
    CURRENT_NOTICE.contentSha256,
  );
  assert.match(
    CURRENT_NOTICE.content,
    /^La empresa responsable de esta obra, mediante ObraSaaS, tratará/,
  );
  assert.doesNotMatch(CURRENT_NOTICE.content, /revisi[oó]n legal|asesoramiento legal/i);
});

async function present(store, token, now = NOW) {
  return markWorkerOnboardingFlowPrivacyPresented(
    store.prisma,
    endpointInput(token),
    { secret: SECRET, now },
  );
}

test("issuance is deterministic, claim-bound, and persists no raw token or recipient address", async () => {
  const store = onboardingSessionStore();
  const first = await issue(store);
  const replay = await issue(store, {}, { now: new Date(NOW.getTime() + 1_000) });

  assert.match(
    first.token,
    /^wofs1\.[0-9a-f]{8}-[0-9a-f-]{27}\.[A-Za-z0-9_-]{43}$/,
  );
  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.equal(replay.session.id, first.session.id);
  assert.equal(replay.token, first.token);
  assert.equal(store.records.length, 1);
  assert.equal(
    first.session.expiresAt.getTime() - NOW.getTime(),
    60 * 60 * 1_000,
  );
  assert.equal(store.records[0].tokenSha256, workerOnboardingFlowTokenEvidence(first.token).tokenSha256);
  assert.equal(store.records[0].noticeVersion, CURRENT_NOTICE.version);
  assert.equal(store.records[0].noticeContentSha256, CURRENT_NOTICE.contentSha256);
  assert.equal(Object.hasOwn(store.records[0], "token"), false);
  assert.equal(Object.hasOwn(store.records[0], "recipientPhone"), false);
  assert.equal(Object.hasOwn(store.records[0], "senderFingerprint"), false);
  assert.equal(JSON.stringify(store.records[0]).includes(first.token), false);
});

test("issuance rejects cross-scope claims, non-onboarding contracts, and expiry beyond the claim", async () => {
  const store = onboardingSessionStore();
  await assert.rejects(
    issue(store, { projectId: "project-b" }),
    assertSessionError("WORKER_ONBOARDING_FLOW_SESSION_CLAIM_UNAVAILABLE"),
  );
  await assert.rejects(
    issue(store, { blueprintKey: "shift-check-in" }),
    assertSessionError("WORKER_ONBOARDING_FLOW_SESSION_INPUT_INVALID"),
  );
  await assert.rejects(
    issue(store, {}, { ttlMs: 3 * 60 * 60 * 1_000 }),
    assertSessionError("WORKER_ONBOARDING_FLOW_SESSION_INPUT_INVALID"),
  );
  store.claims[0].status = "CANCELLED";
  await assert.rejects(
    issue(store),
    assertSessionError("WORKER_ONBOARDING_FLOW_SESSION_CLAIM_UNAVAILABLE"),
  );
});

test("a cryptoshredded terminal claim retires delayed Flow operations with a stable 410", async () => {
  const store = onboardingSessionStore();
  const issued = await issue(store);
  store.claims[0].status = "CANCELLED";
  store.claims[0].sensitiveDataPurgedAt = new Date(NOW.getTime() + 1_000);
  store.claims[0].senderFingerprint = null;
  store.claims[0].senderFingerprintKeyId = null;
  store.claims[0].senderRecordVersion = null;

  await assert.rejects(
    getWorkerOnboardingFlowSessionForDelivery(
      store.prisma,
      deliveryInput(issued.session.id),
      { secret: SECRET, now: new Date(NOW.getTime() + 2_000) },
    ),
    (error) => {
      assert.equal(error instanceof WorkerOnboardingFlowSessionError, true);
      assert.equal(error.code, "WORKER_ONBOARDING_FLOW_SESSION_RETIRED");
      assert.equal(error.status, 410);
      return true;
    },
  );
});

test("production pre-worker sessions never reuse the operational Flow HMAC secret", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalOperational = process.env.WHATSAPP_FLOW_TOKEN_SECRET;
  const originalOnboarding = process.env.WORKER_ONBOARDING_FLOW_TOKEN_SECRET;
  try {
    process.env.NODE_ENV = "production";
    process.env.WHATSAPP_FLOW_TOKEN_SECRET = SECRET;
    delete process.env.WORKER_ONBOARDING_FLOW_TOKEN_SECRET;
    await assert.rejects(
      issueWorkerOnboardingFlowSession(
        onboardingSessionStore().prisma,
        BASE_INPUT,
        { now: NOW },
      ),
      assertSessionError("WORKER_ONBOARDING_FLOW_TOKEN_SECRET_REQUIRED"),
    );
    process.env.WORKER_ONBOARDING_FLOW_TOKEN_SECRET = SECRET;
    const issued = await issueWorkerOnboardingFlowSession(
      onboardingSessionStore().prisma,
      BASE_INPUT,
      { now: NOW },
    );
    assert.match(issued.token, /^wofs1\./);
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalOperational === undefined) delete process.env.WHATSAPP_FLOW_TOKEN_SECRET;
    else process.env.WHATSAPP_FLOW_TOKEN_SECRET = originalOperational;
    if (originalOnboarding === undefined) delete process.env.WORKER_ONBOARDING_FLOW_TOKEN_SECRET;
    else process.env.WORKER_ONBOARDING_FLOW_TOKEN_SECRET = originalOnboarding;
  }
});

test("token parsing is domain-separated and rejects tampering", async () => {
  const store = onboardingSessionStore();
  const issued = await issue(store);
  const evidence = workerOnboardingFlowTokenEvidence(issued.token);
  assert.deepEqual(evidence, {
    kind: "worker_onboarding",
    sessionId: issued.session.id,
    tokenSha256: store.records[0].tokenSha256,
  });
  const syntacticallyValidMutation = `${issued.token.slice(0, -1)}${issued.token.endsWith("x") ? "y" : "x"}`;
  assert.notEqual(
    workerOnboardingFlowTokenEvidence(syntacticallyValidMutation).tokenSha256,
    evidence.tokenSha256,
  );
  assert.throws(
    () => workerOnboardingFlowTokenEvidence(`ofs1.${issued.session.id}.${"a".repeat(43)}`),
    assertSessionError("WORKER_ONBOARDING_FLOW_SESSION_INVALID"),
  );

  const tampered = `${issued.token.slice(0, -1)}${issued.token.endsWith("A") ? "B" : "A"}`;
  await attempt(store, issued.session.id);
  await assert.rejects(
    authenticateWorkerOnboardingFlowDataSession(
      store.prisma,
      endpointInput(tampered),
      { secret: SECRET, now: NOW },
    ),
    assertSessionError("WORKER_ONBOARDING_FLOW_SESSION_INVALID"),
  );
});

test("delivery authentication requires an attempted, unexpired, exact endpoint scope", async () => {
  const store = onboardingSessionStore();
  const issued = await issue(store);
  await assert.rejects(
    authenticateWorkerOnboardingFlowDataSession(
      store.prisma,
      endpointInput(issued.token),
      { secret: SECRET, now: NOW },
    ),
    assertSessionError("WORKER_ONBOARDING_FLOW_SESSION_INVALID"),
  );

  await attempt(store, issued.session.id);
  const authenticated = await authenticateWorkerOnboardingFlowDataSession(
    store.prisma,
    endpointInput(issued.token),
    { secret: SECRET, now: NOW },
  );
  assert.equal(authenticated.session.id, issued.session.id);
  assert.equal(authenticated.claim.id, BASE_CLAIM.id);

  for (const mismatch of [
    { organizationId: "organization-b" },
    { projectId: "project-b" },
    { connectionId: "connection-b" },
    { phoneNumberId: "999999999999999" },
  ]) {
    await assert.rejects(
      authenticateWorkerOnboardingFlowDataSession(
        store.prisma,
        endpointInput(issued.token, mismatch),
        { secret: SECRET, now: NOW },
      ),
      assertSessionError("WORKER_ONBOARDING_FLOW_SESSION_INVALID"),
    );
  }

  await assert.rejects(
    authenticateWorkerOnboardingFlowDataSession(
      store.prisma,
      endpointInput(issued.token),
      { secret: SECRET, now: new Date(issued.session.expiresAt) },
    ),
    assertSessionError("WORKER_ONBOARDING_FLOW_SESSION_EXPIRED"),
  );
});

test("attempt fence makes ambiguous provider delivery non-retryable", async () => {
  const store = onboardingSessionStore();
  const issued = await issue(store);
  const first = await attempt(store, issued.session.id);
  const replay = await attempt(store, issued.session.id, new Date(NOW.getTime() + 1_000));
  assert.equal(first.alreadyAttempted, false);
  assert.equal(replay.alreadyAttempted, true);

  await assert.rejects(
    getWorkerOnboardingFlowSessionForDelivery(
      store.prisma,
      deliveryInput(issued.session.id),
      { secret: SECRET, now: NOW },
    ),
    assertSessionError("WORKER_ONBOARDING_FLOW_SESSION_DELIVERY_AMBIGUOUS"),
  );
});

test("INIT privacy presentation is an exact, idempotent CAS over the pinned notice", async () => {
  const store = onboardingSessionStore();
  const issued = await issue(store);
  await attempt(store, issued.session.id);
  const first = await present(store, issued.token, new Date(NOW.getTime() + 1_000));
  const replay = await present(store, issued.token, new Date(NOW.getTime() + 2_000));
  assert.equal(first.alreadyPresented, false);
  assert.equal(replay.alreadyPresented, true);
  assert.equal(
    new Date(replay.session.privacyPresentedAt).getTime(),
    new Date(first.session.privacyPresentedAt).getTime(),
  );
  assert.equal(replay.session.noticeVersion, CURRENT_NOTICE.version);
  assert.equal(replay.session.noticeContentSha256, CURRENT_NOTICE.contentSha256);
});

test("issuance pins a historical notice even after the registry current version rotates", async () => {
  const legacy = getWorkerOnboardingPrivacyNotice("worker-privacy-v1");
  assert.notEqual(legacy.version, CURRENT_NOTICE.version);
  const store = onboardingSessionStore();
  const issued = await issue(store, {
    noticeVersion: legacy.version,
    noticeContentSha256: legacy.contentSha256,
  });
  await attempt(store, issued.session.id);
  const served = await present(store, issued.token, new Date(NOW.getTime() + 1_000));
  assert.equal(served.session.noticeVersion, legacy.version);
  assert.equal(served.session.noticeContentSha256, legacy.contentSha256);
  assert.equal(
    workerOnboardingFlowTokenEvidence(issued.token).tokenSha256,
    served.session.tokenSha256,
  );
});

test("delivery lookup is fail-closed on immutable scope and minimum lifetime", async () => {
  const store = onboardingSessionStore();
  const issued = await issue(store, {}, { ttlMs: 6 * 60 * 1_000 });
  const delivery = await getWorkerOnboardingFlowSessionForDelivery(
    store.prisma,
    deliveryInput(issued.session.id),
    { secret: SECRET, now: NOW },
  );
  assert.equal(delivery.token, issued.token);

  await assert.rejects(
    getWorkerOnboardingFlowSessionForDelivery(
      store.prisma,
      deliveryInput(issued.session.id, { connectionId: "connection-b" }),
      { secret: SECRET, now: NOW },
    ),
    assertSessionError("WORKER_ONBOARDING_FLOW_SESSION_INVALID"),
  );
  await assert.rejects(
    getWorkerOnboardingFlowSessionForDelivery(
      store.prisma,
      deliveryInput(issued.session.id),
      { secret: SECRET, now: new Date(NOW.getTime() + 2 * 60 * 1_000) },
    ),
    assertSessionError("WORKER_ONBOARDING_FLOW_SESSION_EXPIRED"),
  );
});

test("definitive rejection is idempotent and blocks sent/auth/submitted transitions", async () => {
  const store = onboardingSessionStore();
  const issued = await issue(store);
  await attempt(store, issued.session.id);
  const rejected = await markWorkerOnboardingFlowSessionDeliveryRejected(
    store.prisma,
    { sessionId: issued.session.id },
    { secret: SECRET, now: NOW },
  );
  const replay = await markWorkerOnboardingFlowSessionDeliveryRejected(
    store.prisma,
    { sessionId: issued.session.id },
    { secret: SECRET, now: new Date(NOW.getTime() + 1_000) },
  );
  assert.equal(rejected.alreadyRejected, false);
  assert.equal(replay.alreadyRejected, true);
  await assert.rejects(
    markWorkerOnboardingFlowSessionSent(
      store.prisma,
      { sessionId: issued.session.id, providerMessageId: "wamid.rejected" },
      { secret: SECRET, now: NOW },
    ),
    assertSessionError("WORKER_ONBOARDING_FLOW_SESSION_PROVIDER_MESSAGE_CONFLICT"),
  );
  await assert.rejects(
    authenticateWorkerOnboardingFlowDataSession(
      store.prisma,
      endpointInput(issued.token),
      { secret: SECRET, now: NOW },
    ),
    assertSessionError("WORKER_ONBOARDING_FLOW_SESSION_INVALID"),
  );
});

test("provider acceptance is idempotent only for the same message identity", async () => {
  const store = onboardingSessionStore();
  const issued = await issue(store);
  await attempt(store, issued.session.id);
  const first = await markWorkerOnboardingFlowSessionSent(
    store.prisma,
    { sessionId: issued.session.id, providerMessageId: "wamid.accepted-a" },
    { secret: SECRET, now: NOW },
  );
  const replay = await markWorkerOnboardingFlowSessionSent(
    store.prisma,
    { sessionId: issued.session.id, providerMessageId: "wamid.accepted-a" },
    { secret: SECRET, now: new Date(NOW.getTime() + 1_000) },
  );
  assert.equal(first.alreadySent, false);
  assert.equal(replay.alreadySent, true);
  await assert.rejects(
    markWorkerOnboardingFlowSessionSent(
      store.prisma,
      { sessionId: issued.session.id, providerMessageId: "wamid.accepted-b" },
      { secret: SECRET, now: NOW },
    ),
    assertSessionError("WORKER_ONBOARDING_FLOW_SESSION_PROVIDER_MESSAGE_CONFLICT"),
  );
});

test("a submitted Flow may prove delivery even when provider acceptance stayed ambiguous", async () => {
  const store = onboardingSessionStore();
  const issued = await issue(store);
  await attempt(store, issued.session.id);
  await assert.rejects(
    markWorkerOnboardingFlowSessionSubmitted(
      store.prisma,
      { sessionId: issued.session.id, claimId: BASE_CLAIM.id },
      { secret: SECRET, now: NOW },
    ),
    assertSessionError("WORKER_ONBOARDING_FLOW_SESSION_INVALID"),
  );
  await present(store, issued.token, NOW);
  await assert.rejects(
    markWorkerOnboardingFlowSessionSubmitted(
      store.prisma,
      { sessionId: issued.session.id, claimId: "claim-b" },
      { secret: SECRET, now: NOW },
    ),
    assertSessionError("WORKER_ONBOARDING_FLOW_SESSION_INVALID"),
  );
  const first = await markWorkerOnboardingFlowSessionSubmitted(
    store.prisma,
    { sessionId: issued.session.id, claimId: BASE_CLAIM.id },
    { secret: SECRET, now: NOW },
  );
  const replay = await markWorkerOnboardingFlowSessionSubmitted(
    store.prisma,
    { sessionId: issued.session.id, claimId: BASE_CLAIM.id },
    { secret: SECRET, now: new Date(NOW.getTime() + 1_000) },
  );
  assert.equal(first.alreadySubmitted, false);
  assert.equal(replay.alreadySubmitted, true);
  assert.equal(first.session.sentAt, null);
  await assert.rejects(
    markWorkerOnboardingFlowSessionDeliveryRejected(
      store.prisma,
      { sessionId: issued.session.id },
      { secret: SECRET, now: NOW },
    ),
    assertSessionError("WORKER_ONBOARDING_FLOW_SESSION_PROVIDER_MESSAGE_CONFLICT"),
  );
});

test("terminal consumption binds token, endpoint scope, claim sender fingerprint, and event", async () => {
  const store = onboardingSessionStore();
  const issued = await issue(store);
  const evidence = workerOnboardingFlowTokenEvidence(issued.token);
  await attempt(store, issued.session.id);
  await present(store, issued.token, NOW);
  await markWorkerOnboardingFlowSessionSubmitted(
    store.prisma,
    { sessionId: issued.session.id },
    { secret: SECRET, now: NOW },
  );
  store.claims[0].status = "SUBMITTED";

  for (const mismatch of [
    { senderFingerprint: "c".repeat(64) },
    { senderFingerprintKeyId: "fingerprint-key-v2" },
    { connectionId: "connection-b" },
  ]) {
    await assert.rejects(
      consumeWorkerOnboardingFlowSession(
        store.prisma,
        consumptionInput(evidence, mismatch),
        { secret: SECRET, now: NOW },
      ),
      assertSessionError("WORKER_ONBOARDING_FLOW_SESSION_INVALID"),
    );
  }

  const consumed = await consumeWorkerOnboardingFlowSession(
    store.prisma,
    consumptionInput(evidence),
    { secret: SECRET, now: NOW },
  );
  assert.equal(consumed.expired, false);
  assert.equal(consumed.session.consumedExternalId, "wamid.onboarding-reply-a");
  await assert.rejects(
    consumeWorkerOnboardingFlowSession(
      store.prisma,
      consumptionInput(evidence),
      { secret: SECRET, now: NOW },
    ),
    assertSessionError("WORKER_ONBOARDING_FLOW_SESSION_USED"),
  );
});

test("terminal receipt derives the sender fingerprint at the retained claim key before CAS", async () => {
  const fingerprintRegistry = {
    currentKeyId: SENDER_FINGERPRINT_KEY_ID,
    keys: new Map([[SENDER_FINGERPRINT_KEY_ID, Buffer.alloc(32, 41)]]),
  };
  const senderAddress = "+5491112345678";
  const sender = workerFinancialFingerprint(senderAddress, {
    organizationId: BASE_INPUT.organizationId,
    valueType: "WHATSAPP_E164",
  }, { registry: fingerprintRegistry, keyId: SENDER_FINGERPRINT_KEY_ID });
  const store = onboardingSessionStore({
    senderFingerprint: sender.fingerprint,
    senderFingerprintKeyId: sender.fingerprintKeyId,
  });
  const issued = await issue(store);
  const evidence = workerOnboardingFlowTokenEvidence(issued.token);
  await attempt(store, issued.session.id);
  await present(store, issued.token, NOW);
  await markWorkerOnboardingFlowSessionSubmitted(
    store.prisma,
    { sessionId: issued.session.id, claimId: BASE_CLAIM.id },
    { secret: SECRET, now: NOW },
  );
  store.claims[0].status = "SUBMITTED";
  const receiptInput = consumptionInput(evidence, {
    claimRef: BASE_CLAIM.id,
    senderAddress,
  });

  await assert.rejects(
    consumeWorkerOnboardingFlowSession(
      store.prisma,
      { ...receiptInput, claimRef: "claim-mismatch" },
      { secret: SECRET, now: NOW, fingerprintRegistry },
    ),
    assertSessionError("WORKER_ONBOARDING_FLOW_SESSION_INVALID"),
  );
  await assert.rejects(
    consumeWorkerOnboardingFlowSession(
      store.prisma,
      { ...receiptInput, senderAddress: "+5491112345679" },
      { secret: SECRET, now: NOW, fingerprintRegistry },
    ),
    assertSessionError("WORKER_ONBOARDING_FLOW_SESSION_INVALID"),
  );

  const consumed = await consumeWorkerOnboardingFlowSession(
    store.prisma,
    receiptInput,
    { secret: SECRET, now: NOW, fingerprintRegistry },
  );
  assert.equal(consumed.session.consumedExternalId, "wamid.onboarding-reply-a");
});

test("expired terminal replies require explicit recovery after a proven submission", async () => {
  const store = onboardingSessionStore();
  const issued = await issue(store, {}, { ttlMs: 10 * 60 * 1_000 });
  const evidence = workerOnboardingFlowTokenEvidence(issued.token);
  await attempt(store, issued.session.id);
  await present(store, issued.token, new Date(NOW.getTime() + 30_000));
  await markWorkerOnboardingFlowSessionSubmitted(
    store.prisma,
    { sessionId: issued.session.id },
    { secret: SECRET, now: new Date(NOW.getTime() + 60_000) },
  );
  store.claims[0].status = "SUBMITTED";
  const late = new Date(issued.session.expiresAt.getTime() + 1_000);
  await assert.rejects(
    consumeWorkerOnboardingFlowSession(
      store.prisma,
      consumptionInput(evidence),
      { secret: SECRET, now: late },
    ),
    assertSessionError("WORKER_ONBOARDING_FLOW_SESSION_EXPIRED"),
  );
  const recovered = await consumeWorkerOnboardingFlowSession(
    store.prisma,
    consumptionInput(evidence),
    { secret: SECRET, now: late, recoverExpired: true },
  );
  assert.equal(recovered.expired, true);
});

test("claim fingerprint or token commitment mutation invalidates every reconstructed token", async () => {
  for (const mutation of [
    { senderFingerprint: "d".repeat(64) },
    { senderFingerprintKeyId: "fingerprint-key-v9" },
    { claimTokenHash: "e".repeat(64) },
  ]) {
    const store = onboardingSessionStore();
    const issued = await issue(store);
    Object.assign(store.claims[0], mutation);
    await assert.rejects(
      getWorkerOnboardingFlowSessionForDelivery(
        store.prisma,
        deliveryInput(issued.session.id),
        { secret: SECRET, now: NOW },
      ),
      assertSessionError("WORKER_ONBOARDING_FLOW_SESSION_INVALID"),
    );
  }
});

test("privacy notice version or content commitment tampering invalidates the HMAC binding", async () => {
  const legacy = getWorkerOnboardingPrivacyNotice("worker-privacy-v1");
  for (const mutation of [
    { noticeVersion: legacy.version, noticeContentSha256: legacy.contentSha256 },
    { noticeContentSha256: "f".repeat(64) },
  ]) {
    const store = onboardingSessionStore();
    const issued = await issue(store);
    Object.assign(store.records[0], mutation);
    await assert.rejects(
      getWorkerOnboardingFlowSessionForDelivery(
        store.prisma,
        deliveryInput(issued.session.id),
        { secret: SECRET, now: NOW },
      ),
      assertSessionError("WORKER_ONBOARDING_FLOW_SESSION_INVALID"),
    );
  }
});

test("schema and migration keep recipient data out and session domains mutually exclusive", () => {
  const root = process.cwd();
  const schema = fs.readFileSync(path.join(root, "prisma", "schema.prisma"), "utf8");
  const migration = fs.readFileSync(
    path.join(
      root,
      "prisma",
      "migrations",
      "20260728052000_worker_onboarding_flow_sessions",
      "migration.sql",
    ),
    "utf8",
  );
  const model = schema.match(/model WorkerOnboardingFlowSession \{([\s\S]*?)\n\}/)?.[1] || "";
  assert.doesNotMatch(model, /recipientPhone|senderEncryptedPayload|providerSubject|claimedCuil/);
  assert.match(model, /claim\s+WorkerOnboardingClaim/);
  assert.match(model, /noticeVersion\s+String/);
  assert.match(model, /noticeContentSha256\s+String/);
  assert.match(model, /privacyPresentedAt\s+DateTime\?/);
  assert.match(schema, /privacyNoticeContentSha256\s+String\?/);
  assert.match(migration, /WorkerClaim_privacy_notice_evidence_check/);
  assert.match(
    migration,
    /"privacyNoticeContentSha256" IS NULL[\s\S]*?"claimedIdentityEncryptedPayload" IS NULL[\s\S]*?"privacyNoticeVersion" IS NULL[\s\S]*?"privacyAcceptedAt" IS NULL[\s\S]*?OR[\s\S]*?"privacyNoticeContentSha256" ~ '\^\[0-9a-f\]\{64\}\$'[\s\S]*?"claimedIdentityEncryptedPayload" IS NOT NULL[\s\S]*?"privacyNoticeVersion" IS NOT NULL[\s\S]*?"privacyAcceptedAt" IS NOT NULL/,
  );
  assert.match(migration, /"privacyPresentedAt" IS NOT NULL/);
  assert.match(migration, /num_nonnulls\("flowSessionId", "workerOnboardingFlowSessionId"\) <= 1/);
  assert.match(
    migration,
    /FOREIGN KEY \("flowSessionId"\)[\s\S]*?ON DELETE SET NULL ON UPDATE CASCADE/,
  );
  assert.match(
    migration,
    /FOREIGN KEY \("workerOnboardingFlowSessionId"\)[\s\S]*?ON DELETE SET NULL ON UPDATE CASCADE/,
  );
  assert.match(
    migration,
    /FOREIGN KEY \("organizationId", "projectId", "connectionId", "claimId"\)[\s\S]*?ON DELETE CASCADE ON UPDATE CASCADE/,
  );
  assert.match(migration, /cryptographic replay tombstone/i);
  assert.match(migration, /data_exchange and no authenticated session/);
});
