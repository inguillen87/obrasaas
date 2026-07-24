import assert from "node:assert/strict";
import test from "node:test";

import webhookRecoveryWorker, {
  invokeWebhookRecovery,
} from "../infra/cloudflare/webhook-recovery/src/index.js";

test("Cloudflare recovery calls only the configured HTTPS cron endpoint with bearer auth", async () => {
  let call;
  const result = await invokeWebhookRecovery({
    RECOVERY_URL: "https://obrasaas.vercel.app/api/cron/webhooks",
    CRON_SECRET: "secret-value",
  }, async (url, options) => {
    call = { url: String(url), options };
    return Response.json({
      ok: true,
      workHealthy: true,
      projects: 2,
      completed: 7,
      failed: 0,
      blocked: 0,
      flowRequestGc: { failedEndpoints: 0 },
    });
  });

  assert.equal(call.url, "https://obrasaas.vercel.app/api/cron/webhooks");
  assert.equal(call.options.headers.Authorization, "Bearer secret-value");
  assert.deepEqual(result, {
    workHealthy: true,
    reasons: [],
    projects: 2,
    completed: 7,
    failed: 0,
    blocked: 0,
    flowRequestGcFailed: 0,
  });
});

test("Cloudflare recovery returns explicit and legacy degradation without trusting contradictory health", async () => {
  const env = {
    RECOVERY_URL: "https://obrasaas.vercel.app/api/cron/webhooks",
    CRON_SECRET: "secret-value",
  };
  const explicit = await invokeWebhookRecovery(env, async () => Response.json({
    ok: true,
    workHealthy: false,
    reasons: ["FLOW_REQUEST_GC_FAILED"],
    failed: 0,
    blocked: 0,
    flowRequestGc: { failedEndpoints: 1 },
  }));
  assert.equal(explicit.workHealthy, false);
  assert.deepEqual(explicit.reasons, ["FLOW_REQUEST_GC_FAILED"]);
  assert.equal(explicit.flowRequestGcFailed, 1);

  const legacy = await invokeWebhookRecovery(env, async () => Response.json({
    ok: true,
    failed: 1,
    blocked: 1,
  }));
  assert.equal(legacy.workHealthy, false);
  assert.deepEqual(legacy.reasons, ["WEBHOOK_EVENTS_FAILED", "WEBHOOK_PROJECTS_BLOCKED"]);

  const contradiction = await invokeWebhookRecovery(env, async () => Response.json({
    ok: true,
    workHealthy: true,
    failed: 1,
    blocked: 0,
  }));
  assert.equal(contradiction.workHealthy, false);
  assert.deepEqual(contradiction.reasons, ["WEBHOOK_EVENTS_FAILED"]);
});

test("Cloudflare recovery rejects malformed health contracts", async () => {
  const env = {
    RECOVERY_URL: "https://obrasaas.vercel.app/api/cron/webhooks",
    CRON_SECRET: "secret-value",
  };
  await assert.rejects(
    invokeWebhookRecovery(env, async () => Response.json({ ok: true, failed: -1 })),
    (error) => error?.code === "WEBHOOK_RECOVERY_INVALID_RESPONSE",
  );
  await assert.rejects(
    invokeWebhookRecovery(env, async () => Response.json({ ok: true, workHealthy: "true" })),
    (error) => error?.code === "WEBHOOK_RECOVERY_INVALID_RESPONSE",
  );
  await assert.rejects(
    invokeWebhookRecovery(env, async () => new Response("not-json", { status: 200 })),
    (error) => error?.code === "WEBHOOK_RECOVERY_INVALID_RESPONSE",
  );
});

test("scheduled recovery disables immediate retries and exposes degraded work as a failed run", async (context) => {
  let noRetryCalls = 0;
  let noRetryCalledBeforeFetch = false;
  let scheduledPromise;
  const errorLog = context.mock.method(console, "error", () => {});
  const fetchMock = context.mock.method(globalThis, "fetch", async () => {
    noRetryCalledBeforeFetch = noRetryCalls === 1;
    return Response.json({
      ok: true,
      workHealthy: false,
      reasons: ["WEBHOOK_PROJECTS_BLOCKED"],
      failed: 0,
      blocked: 1,
      flowRequestGc: { failedEndpoints: 0 },
    });
  });

  await webhookRecoveryWorker.scheduled({
    noRetry() {
      noRetryCalls += 1;
    },
  }, {
    RECOVERY_URL: "https://obrasaas.vercel.app/api/cron/webhooks",
    CRON_SECRET: "secret-value",
  }, {
    waitUntil(promise) {
      scheduledPromise = promise;
    },
  });

  assert.equal(noRetryCalls, 1);
  assert.equal(noRetryCalledBeforeFetch, true);
  assert.equal(fetchMock.mock.callCount(), 1);
  await assert.rejects(
    scheduledPromise,
    (error) => error?.code === "WEBHOOK_RECOVERY_UNHEALTHY"
      && /WEBHOOK_PROJECTS_BLOCKED.*blocked=1/.test(error.message),
  );
  assert.equal(errorLog.mock.callCount(), 1);
  const logged = JSON.parse(errorLog.mock.calls[0].arguments[0]);
  assert.equal(logged.ok, false);
  assert.equal(logged.code, "WEBHOOK_RECOVERY_UNHEALTHY");
});

test("Cloudflare recovery fails closed for unsafe URLs, missing secrets and bad responses", async () => {
  const fetchMustNotRun = async () => {
    throw new Error("fetch should not run");
  };
  await assert.rejects(
    invokeWebhookRecovery({ RECOVERY_URL: "http://example.com/api/cron/webhooks", CRON_SECRET: "x" }, fetchMustNotRun),
    /not configured/,
  );
  await assert.rejects(
    invokeWebhookRecovery({ RECOVERY_URL: "https://example.com/not-cron", CRON_SECRET: "x" }, fetchMustNotRun),
    /not configured/,
  );
  await assert.rejects(
    invokeWebhookRecovery({ RECOVERY_URL: "https://example.com/api/cron/webhooks", CRON_SECRET: "x" }, fetchMustNotRun),
    /not configured/,
  );
  await assert.rejects(
    invokeWebhookRecovery({
      RECOVERY_URL: "https://obrasaas-preview.vercel.app/api/cron/webhooks",
      CRON_SECRET: "x",
    }, fetchMustNotRun),
    /not configured/,
  );
  await assert.rejects(
    invokeWebhookRecovery({
      RECOVERY_URL: "https://obrasaas.vercel.app/api/cron/webhooks?redirect=example.com",
      CRON_SECRET: "x",
    }, fetchMustNotRun),
    /not configured/,
  );
  await assert.rejects(
    invokeWebhookRecovery({ RECOVERY_URL: "https://example.com/api/cron/webhooks" }, fetchMustNotRun),
    /not configured/,
  );
  await assert.rejects(
    invokeWebhookRecovery({
      RECOVERY_URL: "https://obrasaas.vercel.app/api/cron/webhooks",
      CRON_SECRET: "x",
    }, async () => Response.json({ ok: false }, { status: 503 })),
    /HTTP 503/,
  );
});
