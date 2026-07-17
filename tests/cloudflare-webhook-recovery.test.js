import assert from "node:assert/strict";
import test from "node:test";

import { invokeWebhookRecovery } from "../infra/cloudflare/webhook-recovery/src/index.js";

test("Cloudflare recovery calls only the configured HTTPS cron endpoint with bearer auth", async () => {
  let call;
  const result = await invokeWebhookRecovery({
    RECOVERY_URL: "https://obrasaas.vercel.app/api/cron/webhooks",
    CRON_SECRET: "secret-value",
  }, async (url, options) => {
    call = { url: String(url), options };
    return Response.json({ ok: true, projects: 2, completed: 7, failed: 1, blocked: 0 });
  });

  assert.equal(call.url, "https://obrasaas.vercel.app/api/cron/webhooks");
  assert.equal(call.options.headers.Authorization, "Bearer secret-value");
  assert.deepEqual(result, { projects: 2, completed: 7, failed: 1, blocked: 0 });
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
