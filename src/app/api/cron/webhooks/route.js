import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runAttendanceAutomationBatch } from "@/lib/attendance-control";
import { expireStalePendingAttendanceBatch } from "@/lib/attendance-expiry";
import { listDueWebhookProjectIds } from "@/lib/db";
import { getPrisma } from "@/lib/prisma";
import { expireAndPurgeWorkerOnboardingClaimsBatch } from "@/lib/worker-onboarding-retention";
import { garbageCollectWhatsAppFlowEndpointRequestBacklog } from "@/lib/whatsapp/flow-endpoint-requests";
import { reconcileUncertainWorkerPaymentFlowSubmissions } from "@/lib/whatsapp/worker-payment-flow-reconciliation";
import { recoverExpiredWorkerPaymentFlowSubmissions } from "@/lib/whatsapp/worker-payment-flow-recovery";
import { drainProjectWebhookEvents } from "@/lib/whatsapp/webhook-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_PROJECTS_PER_RUN = 4;
const MAX_EVENTS_PER_PROJECT = 5;
const MAX_ATTENDANCE_EXPIRIES_PER_RUN = 100;
const MAX_WORKER_ONBOARDING_RETENTION_PER_RUN = 100;
const MAX_WORKER_PAYMENT_FLOW_RECOVERIES_PER_RUN = 50;
const MAX_WORKER_PAYMENT_FLOW_RECONCILIATIONS_PER_RUN = 50;

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

function safeNonnegativeInteger(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : 0;
}

function safeFailureCode(value, fallback) {
  const code = String(value || fallback || "WORKER_ONBOARDING_RETENTION_FAILED")
    .trim()
    .slice(0, 100);
  return /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/.test(code)
    ? code
    : "WORKER_ONBOARDING_RETENTION_FAILED";
}

function safeWorkerOnboardingRetentionMetrics(value = {}) {
  return {
    scanned: safeNonnegativeInteger(value.scanned),
    expired: safeNonnegativeInteger(value.expired),
    purged: safeNonnegativeInteger(value.purged),
    auditRows: safeNonnegativeInteger(value.auditRows),
    hasMore: value.hasMore === true,
    failedBatches: safeNonnegativeInteger(value.failedBatches),
    failureCodes: Array.isArray(value.failureCodes)
      ? value.failureCodes.slice(0, 10).map((code) => safeFailureCode(code))
      : [],
  };
}

function safeWorkerPaymentFlowRecoveryMetrics(value = {}) {
  return {
    scanned: safeNonnegativeInteger(value.scanned),
    recovered: safeNonnegativeInteger(value.recovered),
    auditRows: safeNonnegativeInteger(value.auditRows),
    hasMore: value.hasMore === true,
    failedBatches: safeNonnegativeInteger(value.failedBatches),
    failureCodes: Array.isArray(value.failureCodes)
      ? value.failureCodes.slice(0, 10).map((code) => safeFailureCode(
        code,
        "WORKER_PAYMENT_FLOW_RECOVERY_FAILED",
      ))
      : [],
  };
}

function safeWorkerPaymentFlowReconciliationMetrics(value = {}) {
  return {
    scanned: safeNonnegativeInteger(value.scanned),
    reconciled: safeNonnegativeInteger(value.reconciled),
    awaitingOutcome: safeNonnegativeInteger(value.awaitingOutcome),
    provenanceMismatches: safeNonnegativeInteger(value.provenanceMismatches),
    reconcilableRemaining: safeNonnegativeInteger(value.reconcilableRemaining),
    auditRows: safeNonnegativeInteger(value.auditRows),
    hasMore: value.hasMore === true,
    failedBatches: safeNonnegativeInteger(value.failedBatches),
    failureCodes: Array.isArray(value.failureCodes)
      ? value.failureCodes.slice(0, 10).map((code) => safeFailureCode(
        code,
        "WORKER_PAYMENT_FLOW_RECONCILIATION_FAILED",
      ))
      : [],
  };
}

function webhookRecoveryHealth({
  failed,
  blocked,
  flowRequestGc,
  attendanceExpiry,
  attendanceAutomation,
  workerOnboardingRetention,
  workerPaymentFlowRecovery,
  workerPaymentFlowReconciliation,
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
  if (Number(workerOnboardingRetention?.failedBatches || 0) > 0) {
    reasons.push("WORKER_ONBOARDING_RETENTION_FAILED");
  }
  if (workerOnboardingRetention?.hasMore === true) {
    reasons.push("WORKER_ONBOARDING_RETENTION_BACKLOG");
  }
  if (Number(workerPaymentFlowRecovery?.failedBatches || 0) > 0) {
    reasons.push("WORKER_PAYMENT_FLOW_RECOVERY_FAILED");
  }
  if (workerPaymentFlowRecovery?.hasMore === true) {
    reasons.push("WORKER_PAYMENT_FLOW_RECOVERY_BACKLOG");
  }
  if (Number(workerPaymentFlowReconciliation?.failedBatches || 0) > 0) {
    reasons.push("WORKER_PAYMENT_FLOW_RECONCILIATION_FAILED");
  }
  if (Number(workerPaymentFlowReconciliation?.awaitingOutcome || 0) > 0) {
    reasons.push("WORKER_PAYMENT_FLOW_RECONCILIATION_AWAITING_OUTCOME");
  }
  if (Number(workerPaymentFlowReconciliation?.provenanceMismatches || 0) > 0) {
    reasons.push("WORKER_PAYMENT_FLOW_RECONCILIATION_PROVENANCE_MISMATCH");
  }
  if (workerPaymentFlowReconciliation?.hasMore === true) {
    reasons.push("WORKER_PAYMENT_FLOW_RECONCILIATION_BACKLOG");
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

  let workerOnboardingRetention = safeWorkerOnboardingRetentionMetrics();
  try {
    workerOnboardingRetention = safeWorkerOnboardingRetentionMetrics(
      await expireAndPurgeWorkerOnboardingClaimsBatch(getPrisma(), {
        batchSize: MAX_WORKER_ONBOARDING_RETENTION_PER_RUN,
      }),
    );
  } catch (error) {
    workerOnboardingRetention = safeWorkerOnboardingRetentionMetrics({
      hasMore: true,
      failedBatches: 1,
      failureCodes: [safeFailureCode(error?.code || error?.name)],
    });
    console.error("Worker-onboarding retention batch failed:", {
      code: error?.code,
      name: error?.name,
      status: error?.status,
    });
  }

  let workerPaymentFlowRecovery = safeWorkerPaymentFlowRecoveryMetrics();
  try {
    // A crashed process must never leave a payment submission indefinitely in
    // PROCESSING. The recovery is conservative: it only fences expired,
    // DB-clock-qualified reservations as UNCERTAIN and never retries a send.
    workerPaymentFlowRecovery = safeWorkerPaymentFlowRecoveryMetrics(
      await recoverExpiredWorkerPaymentFlowSubmissions(getPrisma(), {
        batchSize: MAX_WORKER_PAYMENT_FLOW_RECOVERIES_PER_RUN,
      }),
    );
  } catch (error) {
    workerPaymentFlowRecovery = safeWorkerPaymentFlowRecoveryMetrics({
      hasMore: true,
      failedBatches: 1,
      failureCodes: [safeFailureCode(
        error?.code || error?.name,
        "WORKER_PAYMENT_FLOW_RECOVERY_FAILED",
      )],
    });
    console.error("Worker-payment Flow recovery batch failed:", {
      code: error?.code,
      name: error?.name,
      status: error?.status,
    });
  }

  let workerPaymentFlowReconciliation = safeWorkerPaymentFlowReconciliationMetrics();
  try {
    // Run after stale PROCESSING fencing so this invocation can close only an
    // already-committed, reservation-bound destination. No bridge/provider or
    // WhatsApp delivery is retried by this recovery edge.
    workerPaymentFlowReconciliation = safeWorkerPaymentFlowReconciliationMetrics(
      await reconcileUncertainWorkerPaymentFlowSubmissions(getPrisma(), {
        batchSize: MAX_WORKER_PAYMENT_FLOW_RECONCILIATIONS_PER_RUN,
      }),
    );
  } catch (error) {
    workerPaymentFlowReconciliation = safeWorkerPaymentFlowReconciliationMetrics({
      hasMore: true,
      failedBatches: 1,
      failureCodes: [safeFailureCode(
        error?.code || error?.name,
        "WORKER_PAYMENT_FLOW_RECONCILIATION_FAILED",
      )],
    });
    console.error("Worker-payment Flow reconciliation batch failed:", {
      code: error?.code,
      name: error?.name,
      status: error?.status,
    });
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
    workerOnboardingRetention,
    workerPaymentFlowRecovery,
    workerPaymentFlowReconciliation,
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
    workerOnboardingRetention,
    workerPaymentFlowRecovery,
    workerPaymentFlowReconciliation,
  });
}
