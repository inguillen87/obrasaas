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
    return Response.json({ error: "Meta webhook is not configured" }, { status: 503 });
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
    return Response.json({ error: "Invalid Meta signature" }, { status: 401 });
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
    return Response.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  let updateCount;
  try {
    updateCount = assertMetaWebhookBatchLimit(payload);
  } catch (error) {
    if (error instanceof MetaWebhookBatchError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    throw error;
  }

  const events = normalizeMetaWebhook(payload);
  const persistence = await storeMetaWebhookBatch({ events });
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

  return Response.json({
    received: true,
    updates: updateCount,
    accepted: persistence.accepted,
    duplicate: persistence.duplicate,
    unknownConnections: persistence.unknownConnections,
  });
}
