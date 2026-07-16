import { after } from "next/server";
import { resolveWhatsAppScopes, storeWebhookEvent } from "@/lib/db";
import {
  RequestBodyError,
  decodeUtf8RequestBytes,
  readLimitedRequestBytes,
  requestBodyErrorResponse,
} from "@/lib/request-body";
import {
  scopedWebhookExternalId,
  serializeWebhookPayload,
} from "@/lib/webhook-queue";
import {
  normalizeMetaWebhook,
  verifyMetaSignature,
  verifyMetaSubscription,
} from "@/lib/whatsapp/meta";
import { drainProjectWebhookEvents } from "@/lib/whatsapp/webhook-worker";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_WEBHOOK_BYTES = 1_000_000;
const MAX_WEBHOOK_EVENTS = 250;

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
      maxBytes: MAX_WEBHOOK_BYTES,
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

  const events = normalizeMetaWebhook(payload);
  if (events.length > MAX_WEBHOOK_EVENTS) {
    return Response.json({ error: "Webhook batch too large" }, { status: 413 });
  }
  const projectIds = new Set();
  let accepted = 0;
  let unknownConnections = 0;
  let duplicate = 0;
  for (const event of events) {
    const scopes = await resolveWhatsAppScopes({
      eventType: event.eventType,
      phoneNumberId: event.phoneNumberId,
      whatsappBusinessId: event.whatsappBusinessId,
      displayPhoneNumber: event.displayPhoneNumber || event.businessDisplayPhone,
    });
    if (scopes.length === 0) {
      unknownConnections += 1;
      console.warn(
        `Rejected Meta event for unknown connection: ${event.phoneNumberId || event.whatsappBusinessId || "missing"}`,
      );
      continue;
    }
    for (const scope of scopes) {
      const scopedEvent = {
        ...event,
        phoneNumberId: scope.phoneNumberId,
      };
      const result = await storeWebhookEvent({
        provider: scopedEvent.provider,
        externalId: scopedWebhookExternalId(scope.projectId, scopedEvent.externalId),
        eventType: scopedEvent.eventType,
        payload: serializeWebhookPayload(scopedEvent, scope),
        scope,
      });
      if (result.projectId) projectIds.add(result.projectId);
      if (result.stored) accepted += 1;
      else duplicate += 1;
    }
  }

  if (projectIds.size > 0) {
    after(async () => {
      for (const projectId of projectIds) {
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
    accepted,
    duplicate,
    unknownConnections,
  });
}
