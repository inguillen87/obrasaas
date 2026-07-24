import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runAttendanceAutomationBatch } from "@/lib/attendance-control";
import { expireStalePendingAttendanceBatch } from "@/lib/attendance-expiry";
import { listDueWebhookProjectIds } from "@/lib/db";
import { getPrisma } from "@/lib/prisma";
import { garbageCollectWhatsAppFlowEndpointRequestBacklog } from "@/lib/whatsapp/flow-endpoint-requests";
import { drainProjectWebhookEvents } from "@/lib/whatsapp/webhook-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_PROJECTS_PER_RUN = 4;
const MAX_EVENTS_PER_PROJECT = 5;
const MAX_ATTENDANCE_EXPIRIES_PER_RUN = 100;

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

function webhookRecoveryHealth({
  failed,
  blocked,
  flowRequestGc,
  attendanceExpiry,
  attendanceAutomation,
}) {
  const reasons = [];
  if (failed > 0) reasons.push("WEBHOOK_EVENTS_FAILED");
  if (blocked > 0) reasons.push("WEBHOOK_PROJECTS_BLOCKED");
  if (Number(flowRequestGc?.failedEndpoints || 0) > 0) {
    reasons.push("FLOW_REQUEST_GC_FAILED");
  }
  if (
    Number(attendanceExpiry?.failedProjects || 0) > 0
    || attendanceExpiry?.backlogCheckFailed === true
  ) {
    reasons.push("ATTENDANCE_EXPIRY_FAILED");
  }
  if (attendanceExpiry?.hasMore === true) {
    reasons.push("ATTENDANCE_EXPIRY_BACKLOG");
  }
  if (Number(attendanceAutomation?.failedProjects || 0) > 0) {
    reasons.push("ATTENDANCE_AUTOMATION_FAILED");
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

  let attendanceExpiry = {
    scannedEntries: 0,
    processedProjects: 0,
    failedProjects: 0,
    expiredCount: 0,
    reconciledProjections: 0,
    hasMore: false,
    backlogCheckFailed: false,
    failureCodes: [],
    cutoff: null,
  };
  try {
    // Expiration is clock-driven correctness work. Run it before webhook/GC
    // backlog so unrelated recovery cannot starve pending-GPS cleanup.
    attendanceExpiry = await expireStalePendingAttendanceBatch(getPrisma(), {
      maxEntries: MAX_ATTENDANCE_EXPIRIES_PER_RUN,
    });
  } catch (error) {
    attendanceExpiry.failedProjects = 1;
    attendanceExpiry.hasMore = true;
    attendanceExpiry.backlogCheckFailed = true;
    attendanceExpiry.failureCodes = [
      String(error?.code || error?.name || "ATTENDANCE_EXPIRY_FAILED").slice(0, 100),
    ];
    console.error("Attendance pending-GPS expiry failed:", {
      code: error?.code,
      name: error?.name,
      status: error?.status,
    });
  }

  let attendanceAutomation = {
    eligibleProjects: 0,
    processedProjects: 0,
    failedProjects: 0,
    hasMore: false,
    totals: {
      materialized: 0,
      evaluated: 0,
      shiftsMarkedPendingClose: 0,
      alertsOpened: 0,
      alertsResolved: 0,
    },
    failureCodes: [],
  };
  try {
    // Attendance classification and durable alert transitions are also
    // clock-driven correctness work; execute them before unrelated backlogs.
    attendanceAutomation = await runAttendanceAutomationBatch(getPrisma(), {
      maxProjects: MAX_PROJECTS_PER_RUN,
    });
  } catch (error) {
    attendanceAutomation.failedProjects = 1;
    attendanceAutomation.failureCodes = [
      String(error?.code || error?.name || "ATTENDANCE_AUTOMATION_FAILED").slice(0, 100),
    ];
    console.error("Attendance automation batch failed:", {
      code: error?.code,
      name: error?.name,
      status: error?.status,
    });
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

  const health = webhookRecoveryHealth({
    failed,
    blocked,
    flowRequestGc,
    attendanceExpiry,
    attendanceAutomation,
  });
  return json({
    ok: true,
    ...health,
    projects: projectIds.length,
    completed,
    failed,
    blocked,
    flowRequestGc,
    attendanceExpiry,
    attendanceAutomation,
  });
}
