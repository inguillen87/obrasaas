import { after } from "next/server";
import { storeMetaWebhookBatch } from "@/lib/db";
import {
  RequestBodyError,
  decodeUtf8RequestBytes,
  readLimitedRequestBytes,
  requestBodyErrorResponse,
} from "@/lib/request-body";
import {
  normalizeMetaWebhook,
  verifyMetaSignature,
  verifyMetaSubscription,
} from "@/lib/whatsapp/meta";
import {
  assertMetaWebhookBatchLimit,
  META_WEBHOOK_MAX_BODY_BYTES,
  MetaWebhookBatchError,
} from "@/lib/whatsapp/webhook-ingress";
import { drainProjectWebhookEvents } from "@/lib/whatsapp/webhook-worker";

export const runtime = "nodejs";
export const maxDuration = 60;

function json(payload, init = {}) {
  return Response.json(payload, { ...init, headers: { 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' } });
}

export async function GET(request) {
  const verification = verifyMetaSubscription(
    new URL(request.url).searchParams,
    process.env.META_VERIFY_TOKEN,
  );
  if (!verification.valid) return new Response("Forbidden", { status: 403 });
  return new Response(verification.challenge, { status: 200 });
}

export async function POST(request) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    return json({ error: "Meta webhook is not configured" }, { status: 503 });
  }

  let rawBytes;
  try {
    rawBytes = await readLimitedRequestBytes(request, {
      maxBytes: META_WEBHOOK_MAX_BODY_BYTES,
      requireJson: true,
    });
  } catch (error) {
    if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
    throw error;
  }
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyMetaSignature(rawBytes, signature, appSecret)) {
    return json({ error: "Invalid Meta signature" }, { status: 401 });
  }

  let rawBody;
  try {
    rawBody = decodeUtf8RequestBytes(rawBytes);
  } catch (error) {
    if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
    throw error;
  }
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  let updateCount;
  let events;
  try {
    updateCount = assertMetaWebhookBatchLimit(payload);
    events = normalizeMetaWebhook(payload);
  } catch (error) {
    if (error instanceof MetaWebhookBatchError) {
      return json({ error: error.message, code: error.code }, { status: error.status });
    }
    // Signed bytes can still contain malformed collections. Do not acknowledge
    // or enqueue a partial normalization, and never echo the provider body.
    return json({ error: "Invalid Meta webhook payload", code: "META_WEBHOOK_BATCH_INVALID" }, { status: 400 });
  }

  let persistence;
  try {
    persistence = await storeMetaWebhookBatch({ events });
  } catch {
    // No ACK and no after() work before durable storage succeeds. A retry uses
    // the existing scoped event identity; provider data/SQL errors stay private.
    console.error("Meta webhook persistence unavailable", { code: "META_WEBHOOK_PERSISTENCE_UNAVAILABLE" });
    return json({ error: "Meta webhook storage unavailable", code: "META_WEBHOOK_PERSISTENCE_UNAVAILABLE" }, { status: 503 });
  }
  if (persistence.unknownConnections > 0) {
    console.warn(
      `Rejected ${persistence.unknownConnections} Meta event(s) for unknown tenant connections.`,
    );
  }

  if (persistence.projectIds.length > 0) {
    after(async () => {
      for (const projectId of persistence.projectIds) {
        try {
          await drainProjectWebhookEvents(projectId);
        } catch (error) {
          console.error(`Meta webhook queue drain for project ${projectId} failed:`, error);
        }
      }
    });
  }

  return json({
    received: true,
    updates: updateCount,
    accepted: persistence.accepted,
    duplicate: persistence.duplicate,
    unknownConnections: persistence.unknownConnections,
  });
}
