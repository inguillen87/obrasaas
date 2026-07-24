const RECOVERY_TIMEOUT_MS = 55_000;
const RECOVERY_ORIGIN = "https://obrasaas.vercel.app";
const RECOVERY_REASON_ORDER = [
  "ATTENDANCE_EXPIRY_FAILED",
  "ATTENDANCE_EXPIRY_BACKLOG",
  "WEBHOOK_EVENTS_FAILED",
  "WEBHOOK_PROJECTS_BLOCKED",
  "FLOW_REQUEST_GC_FAILED",
];

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

function recoveryError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function responseCount(value, field) {
  if (value === undefined || value === null) return 0;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw recoveryError(
      `ObraSaaS recovery response has an invalid ${field} counter.`,
      "WEBHOOK_RECOVERY_INVALID_RESPONSE",
    );
  }
  return value;
}

function recoveryResult(body) {
  if (body?.workHealthy !== undefined && typeof body.workHealthy !== "boolean") {
    throw recoveryError(
      "ObraSaaS recovery response has an invalid workHealthy flag.",
      "WEBHOOK_RECOVERY_INVALID_RESPONSE",
    );
  }
  const failed = responseCount(body?.failed, "failed");
  const blocked = responseCount(body?.blocked, "blocked");
  const flowRequestGcFailed = responseCount(
    body?.flowRequestGc?.failedEndpoints,
    "flowRequestGc.failedEndpoints",
  );
  const attendanceExpiryFailedProjects = responseCount(
    body?.attendanceExpiry?.failedProjects,
    "attendanceExpiry.failedProjects",
  );
  for (const [field, value] of [
    ["attendanceExpiry.hasMore", body?.attendanceExpiry?.hasMore],
    ["attendanceExpiry.backlogCheckFailed", body?.attendanceExpiry?.backlogCheckFailed],
  ]) {
    if (value !== undefined && typeof value !== "boolean") {
      throw recoveryError(
        `ObraSaaS recovery response has an invalid ${field} flag.`,
        "WEBHOOK_RECOVERY_INVALID_RESPONSE",
      );
    }
  }
  const attendanceExpiryBacklog = body?.attendanceExpiry?.hasMore === true;
  const attendanceExpiryBacklogCheckFailed = body?.attendanceExpiry?.backlogCheckFailed === true;
  const countersHealthy = failed === 0
    && blocked === 0
    && flowRequestGcFailed === 0
    && attendanceExpiryFailedProjects === 0
    && !attendanceExpiryBacklog
    && !attendanceExpiryBacklogCheckFailed;
  const workHealthy = body?.workHealthy === undefined
    ? countersHealthy
    : body.workHealthy === true && countersHealthy;
  const reportedReasons = Array.isArray(body?.reasons)
    ? RECOVERY_REASON_ORDER.filter((reason) => body.reasons.includes(reason))
    : [];
  const reasons = reportedReasons.length > 0
    ? reportedReasons
    : [
        failed > 0 ? "WEBHOOK_EVENTS_FAILED" : null,
        blocked > 0 ? "WEBHOOK_PROJECTS_BLOCKED" : null,
        flowRequestGcFailed > 0 ? "FLOW_REQUEST_GC_FAILED" : null,
      ].filter(Boolean);
  if (attendanceExpiryFailedProjects > 0 || attendanceExpiryBacklogCheckFailed) {
    if (!reasons.includes("ATTENDANCE_EXPIRY_FAILED")) {
      reasons.unshift("ATTENDANCE_EXPIRY_FAILED");
    }
  }
  if (attendanceExpiryBacklog && !reasons.includes("ATTENDANCE_EXPIRY_BACKLOG")) {
    const failedIndex = reasons.indexOf("ATTENDANCE_EXPIRY_FAILED");
    reasons.splice(failedIndex >= 0 ? failedIndex + 1 : 0, 0, "ATTENDANCE_EXPIRY_BACKLOG");
  }
  if (!workHealthy && reasons.length === 0) reasons.push("RECOVERY_REPORTED_DEGRADED");
  return {
    workHealthy,
    reasons,
    projects: responseCount(body?.projects, "projects"),
    completed: responseCount(body?.completed, "completed"),
    failed,
    blocked,
    flowRequestGcFailed,
    attendanceExpiryFailedProjects,
    attendanceExpiryBacklog,
    attendanceExpiryBacklogCheckFailed,
  };
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
  if (!response.ok) {
    throw recoveryError(
      `ObraSaaS recovery endpoint returned HTTP ${response.status}.`,
      "WEBHOOK_RECOVERY_ENDPOINT_ERROR",
    );
  }
  if (body?.ok !== true) {
    throw recoveryError(
      "ObraSaaS recovery endpoint returned an invalid success response.",
      "WEBHOOK_RECOVERY_INVALID_RESPONSE",
    );
  }
  return recoveryResult(body);
}

function unhealthyRecoveryError(result) {
  const reasons = result.reasons.join(",");
  return recoveryError(
    `ObraSaaS recovery work is degraded (${reasons}; failed=${result.failed}; blocked=${result.blocked}; flowGcFailed=${result.flowRequestGcFailed}; attendanceExpiryFailed=${result.attendanceExpiryFailedProjects}; attendanceExpiryBacklog=${result.attendanceExpiryBacklog}).`,
    "WEBHOOK_RECOVERY_UNHEALTHY",
  );
}

const webhookRecoveryWorker = {
  async scheduled(controller, env, context) {
    controller.noRetry();
    context.waitUntil(
      invokeWebhookRecovery(env)
        .then((result) => {
          if (!result.workHealthy) throw unhealthyRecoveryError(result);
          console.log(JSON.stringify({ event: "webhook_recovery", ok: true, ...result }));
        })
        .catch((error) => {
          console.error(JSON.stringify({
            event: "webhook_recovery",
            ok: false,
            code: error?.code || "WEBHOOK_RECOVERY_UNKNOWN",
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
