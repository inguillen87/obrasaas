const RECOVERY_TIMEOUT_MS = 55_000;
const RECOVERY_ORIGIN = "https://obrasaas-preview.vercel.app";

function configuredRecoveryUrl(value) {
  try {
    const url = new URL(value);
    if (
      url.origin !== RECOVERY_ORIGIN
      || url.pathname !== "/api/cron/webhooks"
      || url.search
      || url.hash
      || url.username
      || url.password
    ) return null;
    return url;
  } catch {
    return null;
  }
}

export async function invokeWebhookRecovery(env, fetchImpl = fetch) {
  const url = configuredRecoveryUrl(env?.RECOVERY_URL);
  const secret = typeof env?.CRON_SECRET === "string" ? env.CRON_SECRET : "";
  if (!url || !secret) throw new Error("Webhook recovery Worker is not configured.");

  const response = await fetchImpl(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secret}`,
      Accept: "application/json",
      "User-Agent": "ObraSaaS-Webhook-Recovery/1.0",
    },
    signal: AbortSignal.timeout(RECOVERY_TIMEOUT_MS),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.ok !== true) {
    throw new Error(`ObraSaaS recovery endpoint returned HTTP ${response.status}.`);
  }
  return {
    projects: Number(body.projects || 0),
    completed: Number(body.completed || 0),
    failed: Number(body.failed || 0),
    blocked: Number(body.blocked || 0),
  };
}

const webhookRecoveryWorker = {
  async scheduled(_controller, env, context) {
    context.waitUntil(
      invokeWebhookRecovery(env)
        .then((result) => {
          console.log(JSON.stringify({ event: "webhook_recovery", ok: true, ...result }));
        })
        .catch((error) => {
          console.error(JSON.stringify({
            event: "webhook_recovery",
            ok: false,
            error: error instanceof Error ? error.message : "Unknown recovery error",
          }));
          throw error;
        }),
    );
  },

  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "GET" || url.pathname !== "/health") {
      return new Response("Not found", { status: 404 });
    }
    return Response.json(
      { ok: true, service: "obrasaas-webhook-recovery" },
      { headers: { "Cache-Control": "no-store" } },
    );
  },
};

export default webhookRecoveryWorker;
