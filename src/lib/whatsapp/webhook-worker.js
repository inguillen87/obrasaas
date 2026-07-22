import {
  acquireWebhookEvent,
  applyWebhookMessageAtomically,
  completeWebhookEvent,
  linkOutboundWhatsAppMessage,
  persistEnrichedWebhookEvent,
  rescheduleWebhookEvent,
  updateWhatsAppMessageStatus,
} from "@/lib/db";
import {
  FIELD_WORKER_RESOLUTION,
  resolveActiveFieldWorkerByPhone,
} from "@/lib/field-workers";
import { tenantAiSettingsFromMetadata } from "@/lib/ai/tenant-settings";
import { assertOrganizationSubscriptionAllowsWrites } from "@/lib/plans";
import { getPrisma } from "@/lib/prisma";
import {
  deserializeWebhookPayload,
  drainWebhookProjectQueue,
  isTerminalWebhookFailure,
  readAppliedMessageWebhookOutcome,
} from "@/lib/webhook-queue";
import { getPublishedWhatsAppFlowReference } from "@/lib/whatsapp/flows";
import {
  getWhatsAppFlowSessionForDelivery,
  getWhatsAppFlowSessionSentFence,
  markWhatsAppFlowSessionDeliveryAttempted,
  markWhatsAppFlowSessionDeliveryRejected,
  markWhatsAppFlowSessionSent,
} from "@/lib/whatsapp/flow-sessions";
import { ingestAndPersistInboundWhatsAppMedia } from "@/lib/whatsapp/media";
import { sendWhatsAppFlow, sendWhatsAppText } from "@/lib/whatsapp/meta";
import { processIncomingObraMessage } from "@/lib/whatsapp/obra-engine";
import { synchronizeWhatsAppTemplateStatus } from "@/lib/whatsapp/templates";
import { validateStoredWebhookScope } from "@/lib/whatsapp/webhook-scope";

export const DEFAULT_WEBHOOK_DRAIN_EVENTS = 10;
const MAX_WEBHOOK_DRAIN_EVENTS = 25;
const QUARANTINE_UNASSIGNED_MEDIA = Symbol.for(
  "obrasaas.whatsapp.quarantine-unassigned-media",
);

function invalidWebhookPayload(message) {
  const error = new Error(message);
  error.code = "WEBHOOK_PAYLOAD_INVALID";
  return error;
}

export async function assertWebhookMessageSubscription(
  scope,
  { prisma = getPrisma(), now = new Date() } = {},
) {
  const organizationId = typeof scope?.organizationId === "string"
    ? scope.organizationId.trim()
    : "";
  return assertOrganizationSubscriptionAllowsWrites(prisma, organizationId, {
    now,
    code: "WEBHOOK_SUBSCRIPTION_BLOCKED",
    message: "La suscripción del tenant no permite procesar mensajes de WhatsApp.",
  });
}

export function providerMessageIdFromMetaResult(result) {
  const providerMessageId = result?.messages?.[0]?.id;
  if (typeof providerMessageId !== "string") return null;
  const normalized = providerMessageId.trim();
  if (!normalized || normalized.length > 500 || /[\u0000-\u001f\u007f]/.test(normalized)) return null;
  return normalized;
}

function unresolvedFlowDelivery() {
  const error = new Error(
    "WhatsApp Flow delivery has an unresolved prior provider attempt.",
  );
  error.code = "WHATSAPP_FLOW_DELIVERY_UNRESOLVED";
  return error;
}

export async function trySendPublishedFlow({
  blueprintKey,
  flowSessionId,
  event,
  scope,
}, {
  prisma = getPrisma(),
  loadSession = getWhatsAppFlowSessionForDelivery,
  loadSentFence = getWhatsAppFlowSessionSentFence,
  markAttempted = markWhatsAppFlowSessionDeliveryAttempted,
  markRejected = markWhatsAppFlowSessionDeliveryRejected,
  markSent = markWhatsAppFlowSessionSent,
  sendProviderFlow = sendWhatsAppFlow,
  warn = console.warn,
} = {}) {
  if (!flowSessionId) return { sent: false, providerMessageId: null };

  const sentFence = await loadSentFence(prisma, {
    sessionId: flowSessionId,
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    phoneNumberId: scope.phoneNumberId,
    recipientPhone: event.from,
    blueprintKey,
    sourceExternalId: event.externalId,
  });
  if (sentFence.session.sentAt || sentFence.session.consumedAt) {
    return {
      sent: true,
      providerMessageId: sentFence.session.providerMessageId || null,
    };
  }
  if (sentFence.session.deliveryRejectedAt) {
    return { sent: false, providerMessageId: null };
  }
  const hadAmbiguousAttempt = Boolean(sentFence.session.deliveryAttemptedAt);

  const connection = await prisma.whatsAppConnection.findUnique({
    where: { phoneNumberId: scope.phoneNumberId },
    select: { metadata: true },
  });
  const flow = getPublishedWhatsAppFlowReference(connection?.metadata, blueprintKey);
  if (!flow) {
    if (hadAmbiguousAttempt) throw unresolvedFlowDelivery();
    return { sent: false, providerMessageId: null };
  }
  const persistedFlowMatches = (
    sentFence.session.flowId === flow.id
    && sentFence.session.screenId === flow.screenId
    && sentFence.session.flowType === flow.flowType
  );
  if (!persistedFlowMatches) {
    if (hadAmbiguousAttempt) throw unresolvedFlowDelivery();
    return { sent: false, providerMessageId: null };
  }

  let delivery;
  try {
    delivery = await loadSession(prisma, {
      sessionId: flowSessionId,
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      phoneNumberId: scope.phoneNumberId,
      recipientPhone: event.from,
      blueprintKey: flow.blueprintKey,
      flowId: flow.id,
      screenId: flow.screenId,
      flowType: flow.flowType,
      sourceExternalId: event.externalId,
    });
  } catch (error) {
    if (hadAmbiguousAttempt) throw unresolvedFlowDelivery();
    if (
      error?.code === "WHATSAPP_FLOW_SESSION_EXPIRED"
      || error?.code === "WHATSAPP_FLOW_SESSION_INVALID"
    ) {
      return { sent: false, providerMessageId: null };
    }
    throw error;
  }
  if (delivery.session.sentAt || delivery.session.consumedAt) {
    return {
      sent: true,
      providerMessageId: delivery.session.providerMessageId || null,
    };
  }
  if (delivery.session.deliveryRejectedAt) {
    return { sent: false, providerMessageId: null };
  }

  const attempt = await markAttempted(prisma, {
    sessionId: delivery.session.id,
  });
  if (attempt.session.sentAt || attempt.session.consumedAt) {
    return {
      sent: true,
      providerMessageId: attempt.session.providerMessageId || null,
    };
  }
  if (attempt.session.deliveryRejectedAt) {
    return { sent: false, providerMessageId: null };
  }
  let result;
  try {
    result = await sendProviderFlow({
      to: event.from,
      phoneNumberId: scope.phoneNumberId,
      scope,
      flowId: flow.id,
      flowToken: delivery.token,
      screenId: flow.screenId,
      flowAction: flow.flowAction,
      ...flow.message,
    });
  } catch (error) {
    if (error?.code !== "META_FLOW_REJECTED") throw error;
    if (attempt.alreadyAttempted) throw unresolvedFlowDelivery();
    const rejection = await markRejected(prisma, {
      sessionId: delivery.session.id,
    });
    if (rejection.session.sentAt || rejection.session.consumedAt) {
      return {
        sent: true,
        providerMessageId: rejection.session.providerMessageId || null,
      };
    }
    if (!rejection.session.deliveryRejectedAt) throw unresolvedFlowDelivery();
    warn(
      `Meta rejected published WhatsApp Flow ${blueprintKey}; using text fallback (${error.status || "4xx"}).`,
    );
    return { sent: false, providerMessageId: null };
  }

  const providerMessageId = providerMessageIdFromMetaResult(result);
  try {
    await markSent(prisma, {
      sessionId: delivery.session.id,
      providerMessageId,
    });
  } catch (error) {
    // Meta already accepted the Flow. Falling back to text here would duplicate
    // the outbound response, so correlation remains best-effort after 2xx.
    console.error(`Meta accepted WhatsApp Flow ${blueprintKey}, but its sent fence could not be persisted:`, error);
  }
  return { sent: true, providerMessageId };
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

function connectionStatusData(metadata, event, verifiedAt) {
  const data = {
    metadata: connectionMetadata(metadata, event),
    lastVerifiedAt: verifiedAt,
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

  return data;
}

export async function synchronizeWhatsAppConnectionStatus(
  event,
  scope,
  { prisma = getPrisma(), now = new Date(), maxAttempts = 4 } = {},
) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const connection = await prisma.whatsAppConnection.findUnique({
      where: { phoneNumberId: scope.phoneNumberId },
      select: { id: true, metadata: true, updatedAt: true },
    });
    if (!connection) return { updated: false, reason: "not_found" };

    const result = await prisma.whatsAppConnection.updateMany({
      where: { id: connection.id, updatedAt: connection.updatedAt },
      data: connectionStatusData(connection.metadata, event, now),
    });
    if (result.count === 1) return { updated: true };
  }

  const error = new Error(
    "WhatsApp connection metadata changed too many times while applying a webhook.",
  );
  error.code = "WHATSAPP_CONNECTION_WRITE_CONFLICT";
  throw error;
}

export async function deliverWhatsAppMessageOutcome({
  outcome,
  event,
  scope,
}, {
  assertSubscription = assertWebhookMessageSubscription,
  sendFlow = trySendPublishedFlow,
  sendText = sendWhatsAppText,
  linkMessage = linkOutboundWhatsAppMessage,
} = {}) {
  if (outcome?.quarantined === true) {
    return {
      flowSent: false,
      providerMessageId: null,
      deliverySuppressed: true,
    };
  }

  let flowDelivery = { sent: false, providerMessageId: null };
  if (outcome.flowPrompt && outcome.flowSessionId) {
    await assertSubscription(scope);
    flowDelivery = await sendFlow({
      blueprintKey: outcome.flowPrompt,
      flowSessionId: outcome.flowSessionId,
      event,
      scope,
    });
  }

  let providerMessageId = flowDelivery.providerMessageId;
  if (!flowDelivery.sent) {
    await assertSubscription(scope);
    const delivery = await sendText({
      to: event.from,
      text: outcome.reply,
      replyToMessageId: event.externalId,
      phoneNumberId: event.phoneNumberId,
      scope,
    });
    providerMessageId = providerMessageIdFromMetaResult(delivery);
  }
  if (providerMessageId) {
    const linked = await linkMessage({
      inboundExternalId: event.externalId,
      providerMessageId,
      scope,
      status: "accepted",
    });
    if (!linked) {
      console.warn(`Meta accepted outbound message ${providerMessageId}, but its local correlation row was missing.`);
    }
  }
  return {
    flowSent: flowDelivery.sent,
    providerMessageId,
  };
}

async function processMessageEvent(leasedEvent, event, scope) {
  await assertWebhookMessageSubscription(scope);
  const storedOutcome = readAppliedMessageWebhookOutcome(leasedEvent);
  let mediaWorkerResolution = null;
  if (!storedOutcome && event.media) {
    mediaWorkerResolution = await resolveActiveFieldWorkerByPhone(
      getPrisma(),
      { organizationId: scope.organizationId, projectId: scope.projectId },
      event.from,
    );
    if (
      mediaWorkerResolution.status !== FIELD_WORKER_RESOLUTION.RESOLVED
      && mediaWorkerResolution.status !== FIELD_WORKER_RESOLUTION.UNKNOWN
    ) {
      const error = new Error(`WhatsApp sender could not be resolved as an active field worker: ${mediaWorkerResolution.status}`);
      error.code = `FIELD_WORKER_${mediaWorkerResolution.status}`;
      throw error;
    }
  }

  let transcriptionEnabled = false;
  if (
    !storedOutcome
    && event.kind === "audio"
    && event.media
    && mediaWorkerResolution?.status === FIELD_WORKER_RESOLUTION.RESOLVED
  ) {
    const organization = await getPrisma().organization.findUnique({
      where: { id: scope.organizationId },
      select: { metadata: true },
    });
    transcriptionEnabled = tenantAiSettingsFromMetadata(
      organization?.metadata,
    ).audioTranscriptionEnabled;
  }

  const enrichedEvent = (
    !storedOutcome
    && event.media
    && mediaWorkerResolution?.status === FIELD_WORKER_RESOLUTION.RESOLVED
  )
      ? await ingestAndPersistInboundWhatsAppMedia(
        { leasedEvent, event, scope },
        {
          persist: persistEnrichedWebhookEvent,
          transcriptionEnabled,
          beforeTranscribe: () => assertWebhookMessageSubscription(scope),
        },
      )
    : mediaWorkerResolution?.status === FIELD_WORKER_RESOLUTION.UNKNOWN
      ? {
          ...event,
          [QUARANTINE_UNASSIGNED_MEDIA]: true,
        }
      : event;
  const application = await applyWebhookMessageAtomically({
    eventId: leasedEvent.id,
    leaseToken: leasedEvent.leaseToken,
    event: enrichedEvent,
    scope,
    apply: ({
      prisma,
      state,
      projectSettings,
      worker,
      flowSession,
      expiredFlowSession,
      expiredFlowCanReissue,
    }) => processIncomingObraMessage(
      enrichedEvent,
      scope,
      {
        prisma,
        state,
        projectSettings,
        worker,
        flowSession,
        expiredFlowSession,
        expiredFlowCanReissue,
        persist: false,
      },
    ),
  });
  const outcome = application.outcome;

  // Internal writes are exactly-once under the project lock and lease CAS. Meta
  // delivery is necessarily at-least-once: a crash after Meta accepts but before
  // local correlation/completion can cause the stored outcome to be sent again.
  await deliverWhatsAppMessageOutcome({ outcome, event, scope });
}

export async function applyWhatsAppStatusEvent(
  event,
  scope,
  { updateStatus = updateWhatsAppMessageStatus } = {},
) {
  const correlated = await updateStatus({
    providerMessageId: event.messageId,
    status: event.status,
    scope,
  });
  if (!correlated) {
    const error = new Error(
      'WhatsApp delivery status arrived before its outbound message correlation.',
    );
    error.code = 'WHATSAPP_STATUS_CORRELATION_PENDING';
    throw error;
  }
  return true;
}

export async function applyWhatsAppTemplateStatusEvent(
  event,
  scope,
  {
    prisma = getPrisma(),
    synchronize = synchronizeWhatsAppTemplateStatus,
  } = {},
) {
  return synchronize(event, scope, { prisma });
}

async function processLeasedEvent(leasedEvent) {
  const stored = deserializeWebhookPayload(leasedEvent.payload);
  const event = stored.event;
  const scope = stored.scope;
  await validateStoredWebhookScope(getPrisma(), leasedEvent, event, scope);

  if (event.eventType === "message") {
    await processMessageEvent(leasedEvent, event, scope);
    return;
  }
  if (event.eventType === "status") {
    await applyWhatsAppStatusEvent(event, scope);
    return;
  }
  if (event.eventType === "account") {
    if (event.field === "message_template_status_update") {
      await applyWhatsAppTemplateStatusEvent(event, scope);
      return;
    }
    await synchronizeWhatsAppConnectionStatus(event, scope);
    return;
  }
  throw invalidWebhookPayload("Stored webhook event type is not supported.");
}

export async function drainProjectWebhookEvents(
  projectId,
  { maxEvents = DEFAULT_WEBHOOK_DRAIN_EVENTS } = {},
) {
  const normalizedMaxEvents = Math.min(
    MAX_WEBHOOK_DRAIN_EVENTS,
    Math.max(1, Math.trunc(Number(maxEvents) || DEFAULT_WEBHOOK_DRAIN_EVENTS)),
  );
  return drainWebhookProjectQueue({
    projectId,
    acquire: (selectedProjectId) => acquireWebhookEvent({ projectId: selectedProjectId }),
    process: processLeasedEvent,
    complete: (event) => completeWebhookEvent({
      eventId: event.id,
      leaseToken: event.leaseToken,
    }),
    reschedule: async (event, error) => {
      console.error(`Meta webhook event ${event.externalId} failed:`, error);
      return rescheduleWebhookEvent({
        eventId: event.id,
        leaseToken: event.leaseToken,
        error,
        terminal: isTerminalWebhookFailure(error),
      });
    },
    maxEvents: normalizedMaxEvents,
  });
}
