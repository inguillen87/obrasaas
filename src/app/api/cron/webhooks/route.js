import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { listDueWebhookProjectIds } from "@/lib/db";
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

  return json({
    ok: true,
    projects: projectIds.length,
    completed,
    failed,
    blocked,
  });
}
