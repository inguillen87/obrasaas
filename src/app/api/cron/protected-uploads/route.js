import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { getPrisma } from "@/lib/prisma";
import { cleanupProtectedUploads } from "@/lib/protected-uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_UPLOADS_PER_RUN = 100;
const MAX_CLEANUP_BATCHES = 10;
const CLEANUP_BUDGET_MS = 45 * 1000;

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

function addMetrics(total, batch) {
  return {
    expiredReserved: total.expiredReserved + batch.expiredReserved,
    scanned: total.scanned + batch.scanned,
    deleted: total.deleted + batch.deleted,
    failed: total.failed + batch.failed,
    hasMore: batch.hasMore,
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
    for (let batchIndex = 0; batchIndex < MAX_CLEANUP_BATCHES; batchIndex += 1) {
      const batch = safeMetrics(await cleanupProtectedUploads(prisma, {
        limit: MAX_UPLOADS_PER_RUN,
        deadlineAt,
      }));
      metrics = addMetrics(metrics, batch);
      const madeProgress = batch.expiredReserved > 0 || batch.scanned > 0;
      if (!batch.hasMore || batch.failed > 0 || !madeProgress || Date.now() >= deadlineAt.getTime()) {
        break;
      }
    }

    if (metrics.failed > 0) {
      return json({
        ok: false,
        status: "degraded",
        code: "PROTECTED_UPLOAD_GC_PARTIAL_FAILURE",
        ...metrics,
      }, 503);
    }

    if (metrics.hasMore) {
      // A bounded run that leaves backlog still completed correctly. Keep HTTP
      // 200 while making the degraded state machine-readable for monitoring.
      return json({
        ok: true,
        status: "degraded",
        code: "PROTECTED_UPLOAD_GC_BACKLOG",
        ...metrics,
      });
    }

    return json({ ok: true, status: "healthy", ...metrics });
  } catch {
    // Do not expose provider paths, database identifiers or raw errors through
    // either the response body or the platform log stream.
    console.error("Protected upload cleanup failed");
    return json({
      ok: false,
      status: "failed",
      code: "PROTECTED_UPLOAD_GC_FAILED",
    }, 500);
  }
}
