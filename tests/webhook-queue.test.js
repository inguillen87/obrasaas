import test from "node:test";
import assert from "node:assert/strict";
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

test("unknown or ambiguous WhatsApp identities are terminal before media processing", () => {
  assert.equal(isTerminalWebhookFailure({ code: "FIELD_WORKER_UNKNOWN" }), true);
  assert.equal(isTerminalWebhookFailure({ code: "FIELD_WORKER_AMBIGUOUS" }), true);
  assert.equal(isTerminalWebhookFailure({ code: "FIELD_WORKER_INVALID_PHONE" }), true);
  assert.equal(isTerminalWebhookFailure({ code: "WEBHOOK_PAYLOAD_INVALID" }), true);
  assert.equal(isTerminalWebhookFailure({ code: "WEBHOOK_SUBSCRIPTION_BLOCKED" }), true);
  assert.equal(isTerminalWebhookFailure({ code: "WHATSAPP_FLOW_REPLY_INVALID" }), true);
  assert.equal(isTerminalWebhookFailure({ code: "WHATSAPP_FLOW_SESSION_CONFLICT" }), true);
  assert.equal(isTerminalWebhookFailure({ code: "WHATSAPP_FLOW_SESSION_EXPIRED" }), true);
  assert.equal(isTerminalWebhookFailure({ code: "WHATSAPP_FLOW_SESSION_INPUT_INVALID" }), true);
  assert.equal(isTerminalWebhookFailure({ code: "WHATSAPP_FLOW_SESSION_INVALID" }), true);
  assert.equal(isTerminalWebhookFailure({ code: "WHATSAPP_FLOW_SESSION_USED" }), true);
  assert.equal(isTerminalWebhookFailure({ code: "WHATSAPP_FLOW_TOKEN_SECRET_INVALID" }), false);
  assert.equal(isTerminalWebhookFailure({ code: "WHATSAPP_FLOW_DELIVERY_UNRESOLVED" }), false);
  assert.equal(isTerminalWebhookFailure({ code: "META_TEMPORARY_FAILURE" }), false);
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
