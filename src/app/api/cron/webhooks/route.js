import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { listDueWebhookProjectIds } from "@/lib/db";
import { getPrisma } from "@/lib/prisma";
import { garbageCollectWhatsAppFlowEndpointRequestBacklog } from "@/lib/whatsapp/flow-endpoint-requests";
import { drainProjectWebhookEvents } from "@/lib/whatsapp/webhook-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_PROJECTS_PER_RUN = 4;
const MAX_EVENTS_PER_PROJECT = 5;

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

function webhookRecoveryHealth({ failed, blocked, flowRequestGc }) {
  const reasons = [];
  if (failed > 0) reasons.push("WEBHOOK_EVENTS_FAILED");
  if (blocked > 0) reasons.push("WEBHOOK_PROJECTS_BLOCKED");
  if (Number(flowRequestGc?.failedEndpoints || 0) > 0) {
    reasons.push("FLOW_REQUEST_GC_FAILED");
  }
  return {
    workHealthy: reasons.length === 0,
    status: reasons.length === 0 ? "healthy" : "degraded",
    reasons,
  };
}

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return json({ error: "Webhook recovery cron is not configured" }, 503);
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), secret)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const projectIds = await listDueWebhookProjectIds({ limit: MAX_PROJECTS_PER_RUN });
  let completed = 0;
  let failed = 0;
  let blocked = 0;
  for (const projectId of projectIds) {
    const result = await drainProjectWebhookEvents(projectId, {
      maxEvents: MAX_EVENTS_PER_PROJECT,
    });
    completed += result.completed;
    failed += result.failed;
    if (result.blocked) blocked += 1;
  }

  let flowRequestGc = {
    scannedEndpoints: 0,
    failedEndpoints: 0,
    deletedCount: 0,
    hasMore: false,
  };
  try {
    flowRequestGc = await garbageCollectWhatsAppFlowEndpointRequestBacklog(
      getPrisma(),
      { maxEndpoints: 2, batchSize: 250 },
    );
  } catch (error) {
    flowRequestGc.failedEndpoints = 1;
    console.error("WhatsApp Flow request GC failed:", {
      code: error?.code,
      name: error?.name,
      status: error?.status,
    });
  }

  const health = webhookRecoveryHealth({ failed, blocked, flowRequestGc });
  return json({
    ok: true,
    ...health,
    projects: projectIds.length,
    completed,
    failed,
    blocked,
    flowRequestGc,
  });
}
