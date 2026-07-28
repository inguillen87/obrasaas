import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { getPrisma } from "@/lib/prisma";
import { cleanupProtectedUploads } from "@/lib/protected-uploads";
import { cleanupWhatsAppMediaAssets } from "@/lib/whatsapp/media-assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_UPLOADS_PER_RUN = 100;
const MAX_WHATSAPP_ASSETS_PER_RUN = 50;
const MAX_CLEANUP_ROUNDS = 5;
const CLEANUP_BUDGET_MS = 45 * 1000;
const LANE_BUDGET_MS = 4 * 1000;
const SCHEDULE_INTERVAL_MS = 15 * 60 * 1000;

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

function safeCount(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
}

function safeMetrics(result) {
  return {
    expiredReserved: safeCount(result?.expiredReserved),
    scanned: safeCount(result?.scanned),
    deleted: safeCount(result?.deleted),
    failed: safeCount(result?.failed),
    hasMore: result?.hasMore === true,
  };
}

function safeWhatsAppMetrics(result) {
  return {
    expiredReserved: safeCount(result?.expiredReserved),
    uncertainReserved: safeCount(result?.uncertainReserved),
    scanned: safeCount(result?.scanned),
    deleted: safeCount(result?.deleted),
    failed: safeCount(result?.failed),
    hasMore: result?.hasMore === true,
  };
}

function addMetrics(total, batch) {
  return {
    expiredReserved: total.expiredReserved + batch.expiredReserved,
    scanned: total.scanned + batch.scanned,
    deleted: total.deleted + batch.deleted,
    failed: total.failed + batch.failed,
    hasMore: batch.hasMore,
  };
}

function addWhatsAppMetrics(total, batch) {
  return {
    expiredReserved: total.expiredReserved + batch.expiredReserved,
    uncertainReserved: total.uncertainReserved + batch.uncertainReserved,
    scanned: total.scanned + batch.scanned,
    deleted: total.deleted + batch.deleted,
    failed: total.failed + batch.failed,
    hasMore: batch.hasMore,
  };
}

function protectedMadeProgress(batch) {
  return batch.expiredReserved > 0 || batch.scanned > 0;
}

function whatsAppMadeProgress(batch) {
  return batch.expiredReserved > 0 || batch.uncertainReserved > 0 || batch.scanned > 0;
}

function safeResponse(metrics, whatsAppMediaAssets, extra = {}) {
  // Preserve the existing top-level protected-upload counters for monitoring
  // compatibility while exposing the new lane under its own bounded object.
  return {
    ...extra,
    ...metrics,
    whatsAppMediaAssets,
  };
}

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return json({
      ok: false,
      status: "unavailable",
      code: "PROTECTED_UPLOAD_GC_NOT_CONFIGURED",
    }, 503);
  }
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), secret)) {
    return json({ ok: false, status: "unauthorized", code: "UNAUTHORIZED" }, 401);
  }

  try {
    const startedAt = Date.now();
    const deadlineAt = new Date(startedAt + CLEANUP_BUDGET_MS);
    const prisma = getPrisma();
    let metrics = safeMetrics(null);
    let whatsAppMediaAssets = safeWhatsAppMetrics(null);
    const lanes = {
      protected: { done: false, threw: false },
      whatsapp: { done: false, threw: false },
    };
    // Rotate which lane starts on each scheduled interval. Combined with a
    // short per-call deadline, neither cleanup queue can starve the other.
    const laneOrder = Math.floor(startedAt / SCHEDULE_INTERVAL_MS) % 2 === 0
      ? ["protected", "whatsapp"]
      : ["whatsapp", "protected"];

    for (let round = 0; round < MAX_CLEANUP_ROUNDS; round += 1) {
      for (const lane of laneOrder) {
        if (lanes[lane].done || Date.now() >= deadlineAt.getTime()) continue;
        const laneDeadlineAt = new Date(Math.min(
          deadlineAt.getTime(),
          Date.now() + LANE_BUDGET_MS,
        ));
        try {
          if (lane === "protected") {
            const batch = safeMetrics(await cleanupProtectedUploads(prisma, {
              limit: MAX_UPLOADS_PER_RUN,
              deadlineAt: laneDeadlineAt,
            }));
            metrics = addMetrics(metrics, batch);
            lanes.protected.done = !batch.hasMore
              || batch.failed > 0
              || !protectedMadeProgress(batch);
          } else {
            const batch = safeWhatsAppMetrics(await cleanupWhatsAppMediaAssets(prisma, {
              limit: MAX_WHATSAPP_ASSETS_PER_RUN,
              deadlineAt: laneDeadlineAt,
            }));
            whatsAppMediaAssets = addWhatsAppMetrics(whatsAppMediaAssets, batch);
            lanes.whatsapp.done = !batch.hasMore
              || batch.failed > 0
              || !whatsAppMadeProgress(batch);
          }
        } catch {
          lanes[lane].threw = true;
          lanes[lane].done = true;
          console.error(lane === "protected"
            ? "Protected upload cleanup failed"
            : "WhatsApp media asset cleanup failed");
        }
      }
      if (
        (lanes.protected.done && lanes.whatsapp.done)
        || Date.now() >= deadlineAt.getTime()
      ) break;
    }

    if (lanes.protected.threw || lanes.whatsapp.threw) {
      return json(safeResponse(metrics, whatsAppMediaAssets, {
        ok: false,
        status: "failed",
        code: "MEDIA_GC_FAILED",
      }), 500);
    }

    if (metrics.failed > 0 || whatsAppMediaAssets.failed > 0) {
      return json(safeResponse(metrics, whatsAppMediaAssets, {
        ok: false,
        status: "degraded",
        code: metrics.failed > 0
          ? "PROTECTED_UPLOAD_GC_PARTIAL_FAILURE"
          : "WHATSAPP_MEDIA_ASSET_GC_PARTIAL_FAILURE",
      }), 503);
    }

    if (metrics.hasMore || whatsAppMediaAssets.hasMore) {
      // A bounded run that leaves backlog still completed correctly. Keep HTTP
      // 200 while making the degraded state machine-readable for monitoring.
      return json(safeResponse(metrics, whatsAppMediaAssets, {
        ok: true,
        status: "degraded",
        code: metrics.hasMore
          ? "PROTECTED_UPLOAD_GC_BACKLOG"
          : "WHATSAPP_MEDIA_ASSET_GC_BACKLOG",
      }));
    }

    return json(safeResponse(metrics, whatsAppMediaAssets, {
      ok: true,
      status: "healthy",
    }));
  } catch {
    // Do not expose provider paths, database identifiers or raw errors through
    // either the response body or the platform log stream.
    console.error("Protected upload cleanup failed");
    return json({
      ok: false,
      status: "failed",
      code: "MEDIA_GC_FAILED",
    }, 500);
  }
}
