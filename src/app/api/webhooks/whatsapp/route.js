import crypto from "node:crypto";
import { after } from "next/server";
import { claimWebhookEvent, resolveWhatsAppScopes, updateWebhookEvent } from "@/lib/db";
import { getPrisma } from "@/lib/prisma";
import {
  normalizeMetaWebhook,
  sendWhatsAppFlow,
  sendWhatsAppText,
  verifyMetaSignature,
  verifyMetaSubscription,
} from "@/lib/whatsapp/meta";
import { ingestInboundWhatsAppMedia } from "@/lib/whatsapp/media";
import { processIncomingObraMessage } from "@/lib/whatsapp/obra-engine";
import { getPublishedWhatsAppFlowReference } from "@/lib/whatsapp/flows";

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

async function processClaimedEvent(event, scope) {
  await updateWebhookEvent({
    provider: event.provider,
    externalId: event.externalId,
    status: "PROCESSING",
  });

  try {
    if (event.eventType === "message") {
      const enrichedEvent = event.media
        ? await ingestInboundWhatsAppMedia(event)
        : event;
      const result = await processIncomingObraMessage(enrichedEvent, scope);
      const flowSent = result.flowPrompt
        ? await trySendPublishedFlow({
            blueprintKey: result.flowPrompt,
            event,
            scope,
          })
        : false;
      if (!flowSent) {
        await sendWhatsAppText({
          to: event.from,
          text: result.reply,
          replyToMessageId: event.externalId,
          phoneNumberId: event.phoneNumberId,
        });
      }
    } else if (event.eventType === "account") {
      await synchronizeConnectionStatus(event, scope);
    }
    await updateWebhookEvent({
      provider: event.provider,
      externalId: event.externalId,
      status: "PROCESSED",
    });
  } catch (error) {
    console.error(`Meta webhook event ${event.externalId} failed:`, error);
    await updateWebhookEvent({
      provider: event.provider,
      externalId: event.externalId,
      status: "FAILED",
      error: error instanceof Error ? error.message.slice(0, 2_000) : "Unknown processing error",
    });
  }
}

async function trySendPublishedFlow({ blueprintKey, event, scope }) {
  const connection = await getPrisma().whatsAppConnection.findUnique({
    where: { phoneNumberId: scope.phoneNumberId },
    select: { metadata: true },
  });
  const flow = getPublishedWhatsAppFlowReference(connection?.metadata, blueprintKey);
  if (!flow) return false;

  try {
    await sendWhatsAppFlow({
      to: event.from,
      phoneNumberId: event.phoneNumberId,
      flowId: flow.id,
      flowToken: crypto.randomBytes(18).toString("base64url"),
      screenId: flow.screenId,
      ...flow.message,
    });
    return true;
  } catch (error) {
    console.warn(`Published WhatsApp Flow ${blueprintKey} was unavailable; using text fallback:`, error);
    return false;
  }
}

function connectionMetadata(metadata, event) {
  const current = metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? metadata
    : {};
  return {
    ...current,
    metaWebhook: {
      field: event.field,
      event: event.event,
      decision: event.decision,
      value: event.value,
      receivedAt: event.timestamp.toISOString(),
    },
  };
}

async function synchronizeConnectionStatus(event, scope) {
  const prisma = getPrisma();
  const connection = await prisma.whatsAppConnection.findUnique({
    where: { phoneNumberId: scope.phoneNumberId },
    select: { id: true, metadata: true },
  });
  if (!connection) return;

  const data = {
    metadata: connectionMetadata(connection.metadata, event),
    lastVerifiedAt: new Date(),
  };

  if (event.field === "account_update") {
    if (event.event === "VERIFIED_ACCOUNT") {
      data.connectionStatus = "CONNECTED";
      data.lastError = null;
    } else if (event.event === "DISABLED_UPDATE") {
      data.connectionStatus = "ERROR";
      data.lastError = "Meta informó que la cuenta de WhatsApp fue deshabilitada.";
    }
  } else if (event.field === "account_review_update") {
    if (event.decision === "APPROVED") {
      data.connectionStatus = "CONNECTED";
      data.lastError = null;
    } else if (event.decision === "REJECTED") {
      data.connectionStatus = "ERROR";
      data.lastError = event.value?.rejection_reason
        ? `Meta rechazó la cuenta: ${String(event.value.rejection_reason).slice(0, 1_900)}`
        : "Meta rechazó la revisión de la cuenta de WhatsApp.";
    }
  } else if (
    event.field === "phone_number_name_update"
    && event.decision === "APPROVED"
    && event.value?.requested_verified_name
  ) {
    data.verifiedBusinessName = String(event.value.requested_verified_name).slice(0, 255);
  }

  await prisma.whatsAppConnection.update({
    where: { id: connection.id },
    data,
  });
}

export async function POST(request) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    return Response.json({ error: "Meta webhook is not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyMetaSignature(rawBody, signature, appSecret)) {
    return Response.json({ error: "Invalid Meta signature" }, { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const events = normalizeMetaWebhook(payload);
  const claimed = [];
  let unknownConnections = 0;
  let duplicate = 0;
  for (const event of events) {
    const scopes = await resolveWhatsAppScopes({
      phoneNumberId: event.phoneNumberId,
      whatsappBusinessId: event.whatsappBusinessId,
      displayPhoneNumber: event.displayPhoneNumber,
    });
    if (scopes.length === 0) {
      unknownConnections += 1;
      console.warn(
        `Rejected Meta event for unknown connection: ${event.phoneNumberId || event.whatsappBusinessId || "missing"}`,
      );
      continue;
    }
    for (const scope of scopes) {
      const scopedEvent = scopes.length > 1
        ? { ...event, externalId: `${event.externalId}:${scope.phoneNumberId}` }
        : event;
      const result = await claimWebhookEvent({
        provider: scopedEvent.provider,
        externalId: scopedEvent.externalId,
        eventType: scopedEvent.eventType,
        payload: scopedEvent.raw,
        scope,
      });
      if (result.claimed) claimed.push({ event: scopedEvent, scope });
      else duplicate += 1;
    }
  }

  if (claimed.length > 0) {
    after(async () => {
      await Promise.all(claimed.map(({ event, scope }) => processClaimedEvent(event, scope)));
    });
  }

  return Response.json({
    received: true,
    accepted: claimed.length,
    duplicate,
    unknownConnections,
  });
}
