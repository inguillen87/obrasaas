import {
  acquireWebhookEvent,
  applyWebhookMessageAtomically,
  claimAutomaticWhatsAppDelivery,
  completeWebhookEvent,
  persistEnrichedWebhookEvent,
  releaseAutomaticWhatsAppDelivery,
  rescheduleWebhookEvent,
  settleAutomaticWhatsAppDelivery,
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
import {
  materializeProgressEvidenceLocationDelivery,
} from "@/lib/whatsapp/progress-evidence-location-delivery";
import {
  materializeWorkerPaymentPrivateReceiptDelivery,
} from "@/lib/whatsapp/worker-payment-receipt-delivery";
import {
  materializeSecureWebviewDelivery,
} from "@/lib/whatsapp/secure-webview-delivery";
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
      select: {
        id: true,
        metadata: true,
        updatedAt: true,
        flowProvisioningLeaseId: true,
        flowProvisioningLeaseExpiresAt: true,
      },
    });
    if (!connection) return { updated: false, reason: "not_found" };
    if (connection.flowProvisioningLeaseId) {
      const leaseExpiresAt = connection.flowProvisioningLeaseExpiresAt
        ? new Date(connection.flowProvisioningLeaseExpiresAt)
        : null;
      if (!leaseExpiresAt || Number.isNaN(leaseExpiresAt.getTime()) || leaseExpiresAt > now) {
        const error = new Error(
          "A WhatsApp connection operation is still using the current health snapshot.",
        );
        error.code = "WHATSAPP_CONNECTION_LEASE_ACTIVE";
        error.retryAfterSeconds = leaseExpiresAt && !Number.isNaN(leaseExpiresAt.getTime())
          ? Math.max(1, Math.ceil((leaseExpiresAt.getTime() - now.getTime()) / 1_000))
          : null;
        throw error;
      }
    }

    const result = await prisma.whatsAppConnection.updateMany({
      where: {
        id: connection.id,
        updatedAt: connection.updatedAt,
        OR: [
          { flowProvisioningLeaseId: null },
          { flowProvisioningLeaseExpiresAt: { lte: now } },
        ],
      },
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
  eventId = null,
  leaseToken = null,
}, {
  assertSubscription = assertWebhookMessageSubscription,
  claimDelivery = claimAutomaticWhatsAppDelivery,
  releaseDelivery = releaseAutomaticWhatsAppDelivery,
  settleDelivery = settleAutomaticWhatsAppDelivery,
  sendFlow = trySendPublishedFlow,
  sendText = sendWhatsAppText,
  materializeLocationDelivery = materializeProgressEvidenceLocationDelivery,
  materializePaymentReceiptDelivery = materializeWorkerPaymentPrivateReceiptDelivery,
  materializeWebviewDelivery = materializeSecureWebviewDelivery,
  prisma = null,
} = {}) {
  if (outcome?.quarantined === true) {
    return {
      flowSent: false,
      providerMessageId: null,
      deliverySuppressed: true,
    };
  }

  const deliveryScope = {
    ...scope,
    phoneNumberId: scope?.phoneNumberId || event?.phoneNumberId,
  };
  const reservation = await claimDelivery({
    eventId,
    leaseToken,
    inboundExternalId: event?.externalId,
    scope: deliveryScope,
  });
  const reservedState = String(reservation?.state || "").trim().toLowerCase();
  if (reservation?.dispatch !== true) {
    if (CONFIRMED_AUTOMATIC_DELIVERY_STATES.has(reservedState)) {
      return {
        flowSent: false,
        providerMessageId: reservation.providerMessageId || null,
        deliveryReplayed: true,
      };
    }
    if (reservedState === "failed" || reservedState === "unknown") {
      throw automaticDeliveryError(reservedState);
    }
    throw settlementPendingError();
  }

  const claim = reservation.claim;
  async function settle(state, providerMessageId = null, failureEvidence = null) {
    return settleDelivery({
      claim,
      state,
      ...(providerMessageId ? { providerMessageId } : {}),
      ...(failureEvidence || {}),
    });
  }

  async function settleProviderFailure(state, error, {
    providerDispatchStarted,
    redactCause = false,
  }) {
    let settlement;
    try {
      settlement = await settle(
        state,
        null,
        automaticProviderFailureEvidence(error, { providerDispatchStarted, state }),
      );
    } catch (settlementError) {
      throw settlementPendingError(settlementError);
    }
    const settledState = String(settlement?.state || state).trim().toLowerCase();
    if (CONFIRMED_AUTOMATIC_DELIVERY_STATES.has(settledState)) {
      return {
        flowSent: false,
        providerMessageId: settlement.providerMessageId || null,
        deliveryReplayed: true,
      };
    }
    throw automaticDeliveryError(
      settledState === "failed" ? "failed" : "unknown",
      redactCause ? null : error,
    );
  }

  let flowDelivery = { sent: false, providerMessageId: null };
  let providerMessageId = null;
  let providerDispatchStarted = false;
  try {
    if (outcome.flowPrompt && outcome.flowSessionId) {
      await assertSubscription(deliveryScope);
      providerDispatchStarted = true;
      flowDelivery = await sendFlow({
        blueprintKey: outcome.flowPrompt,
        flowSessionId: outcome.flowSessionId,
        event,
        scope: deliveryScope,
      });
    }

    providerMessageId = flowDelivery.providerMessageId;
    if (!flowDelivery.sent) {
      let deliveryText = outcome.reply;
      if (outcome.progressEvidenceLocationDelivery) {
        const prepared = await materializeLocationDelivery(
          prisma || getPrisma(),
          {
            descriptor: outcome.progressEvidenceLocationDelivery,
            scope: deliveryScope,
            recipientPhone: event.from,
            eventId,
          },
        );
        deliveryText = prepared.text;
      } else if (outcome.workerPaymentPrivateReceiptDelivery) {
        const prepared = await materializePaymentReceiptDelivery(
          prisma || getPrisma(),
          {
            descriptor: outcome.workerPaymentPrivateReceiptDelivery,
            scope: deliveryScope,
            recipientPhone: event.from,
            eventId,
          },
        );
        deliveryText = prepared.text;
      } else if (outcome.secureWebviewDelivery) {
        const prepared = await materializeWebviewDelivery(
          prisma || getPrisma(),
          {
            descriptor: outcome.secureWebviewDelivery,
            scope: deliveryScope,
            recipientPhone: event.from,
            eventId,
            reply: outcome.reply,
          },
        );
        deliveryText = prepared.text;
      }
      await assertSubscription(deliveryScope);
      providerDispatchStarted = true;
      const delivery = await sendText({
        to: event.from,
        text: deliveryText,
        replyToMessageId: event.externalId,
        phoneNumberId: deliveryScope.phoneNumberId,
        scope: deliveryScope,
      });
      providerMessageId = providerMessageIdFromMetaResult(delivery);
    }
  } catch (error) {
    if (!providerDispatchStarted && retryablePreProviderDeliveryFailure(error)) {
      let released = null;
      for (let attempt = 0; attempt < 2 && released?.state !== "prepared"; attempt += 1) {
        try {
          released = await releaseDelivery({ claim });
        } catch {
          released = null;
        }
      }
      if (released?.state !== "prepared") {
        throw settlementPendingError();
      }
      throw preProviderDeliveryRetryError();
    }
    const state = automaticProviderFailureState(error, { providerDispatchStarted });
    return settleProviderFailure(state, error, {
      providerDispatchStarted,
      // Protected one-time delivery text can contain a bearer only in memory.
      // Even a malformed provider/proxy error must not carry reflected request
      // content into the queue error chain or logs.
      redactCause: Boolean(
        outcome.progressEvidenceLocationDelivery
        || outcome.workerPaymentPrivateReceiptDelivery
        || outcome.secureWebviewDelivery
      ),
    });
  }

  if (!providerMessageId) {
    return settleProviderFailure(
      "unknown",
      Object.assign(new Error("Meta accepted the automatic response without a message ID."), {
        code: "META_PROVIDER_MESSAGE_ID_MISSING",
      }),
      { providerDispatchStarted: true },
    );
  }

  let settlement;
  let acceptanceError = null;
  for (let attempt = 0; attempt < 2 && !settlement; attempt += 1) {
    try {
      // Retrying this local CAS is safe: it never repeats the provider request,
      // and it can recover either a transient database failure or a lost reply
      // after the first settlement already committed.
      settlement = await settle("accepted", providerMessageId);
    } catch (error) {
      acceptanceError ||= error;
    }
  }
  if (!settlement) {
    try {
      settlement = await settle("unknown", null, {
        failureCode: "LOCAL_CORRELATION_FAILED",
      });
    } catch (recoveryError) {
      throw settlementPendingError(recoveryError);
    }
    const recoveredState = String(settlement?.state || "unknown").trim().toLowerCase();
    if (!CONFIRMED_AUTOMATIC_DELIVERY_STATES.has(recoveredState)) {
      throw automaticDeliveryError("unknown", acceptanceError);
    }
  }
  const settledState = String(settlement?.state || "").trim().toLowerCase();
  if (!CONFIRMED_AUTOMATIC_DELIVERY_STATES.has(settledState)) {
    if (settledState === "failed" || settledState === "unknown") {
      throw automaticDeliveryError(settledState);
    }
    throw settlementPendingError();
  }
  return {
    flowSent: flowDelivery.sent,
    providerMessageId,
  };
}

export async function processMessageEvent(leasedEvent, event, scope, {
  assertSubscription = assertWebhookMessageSubscription,
  applyMessage = applyWebhookMessageAtomically,
  deliverOutcome = deliverWhatsAppMessageOutcome,
} = {}) {
  await assertSubscription(scope);
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
  const application = await applyMessage({
    eventId: leasedEvent.id,
    leaseToken: leasedEvent.leaseToken,
    event: enrichedEvent,
    scope,
    apply: ({
      prisma,
      state,
      projectSettings,
      worker,
      workerPaymentFlowEligible,
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
        workerPaymentFlowEligible,
        flowSession,
        expiredFlowSession,
        expiredFlowCanReissue,
        persist: false,
      },
    ),
  });
  const outcome = application.outcome;

  // Internal writes are exactly-once under the project lock and lease CAS. The
  // durable outbound claim prevents a retry after an ambiguous provider attempt:
  // availability is sacrificed rather than risking a duplicate worker reply.
  await deliverOutcome({
    outcome,
    event,
    scope,
    eventId: leasedEvent.id,
    leaseToken: leasedEvent.leaseToken,
  });
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

const CONFIRMED_AUTOMATIC_DELIVERY_STATES = new Set([
  "accepted",
  "sent",
  "delivered",
  "read",
]);
const AMBIGUOUS_PROVIDER_STATUSES = new Set([408, 425, 429]);
const SAFE_AUTOMATIC_PROVIDER_FAILURE_CODES = new Set([
  "META_FLOW_DELIVERY_UNKNOWN",
  "META_FLOW_DELIVERY_RETRYABLE",
  "WHATSAPP_FLOW_DELIVERY_UNRESOLVED",
  "META_PROVIDER_MESSAGE_ID_MISSING",
]);
const RETRYABLE_PRE_PROVIDER_DELIVERY_CODES = new Set([
  "P1001",
  "P1002",
  "P2024",
  "P2028",
  "P2034",
  "40001",
  "40P01",
  "57P01",
  "08000",
  "08001",
  "08003",
  "08006",
]);

export class AutomaticWhatsAppDeliveryError extends Error {
  constructor(message, code, { cause = null } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "AutomaticWhatsAppDeliveryError";
    this.code = code;
  }
}

function automaticDeliveryError(state, cause = null) {
  const rejected = state === "failed";
  return new AutomaticWhatsAppDeliveryError(
    rejected
      ? "Meta rechazó la respuesta automática y no se volverá a enviar."
      : "Meta no confirmó la respuesta automática y no se volverá a enviar para evitar duplicados.",
    rejected
      ? "WHATSAPP_AUTOMATIC_DELIVERY_REJECTED"
      : "WHATSAPP_AUTOMATIC_DELIVERY_UNKNOWN",
    { cause },
  );
}

function automaticProviderFailureState(error, { providerDispatchStarted }) {
  if (!providerDispatchStarted) return "failed";
  const status = Number(error?.status);
  if (
    error?.ambiguous === true
    || AMBIGUOUS_PROVIDER_STATUSES.has(status)
    || status >= 500
    || error?.name === "AbortError"
    || error?.name === "TimeoutError"
    || error instanceof TypeError
    || [
      "META_FLOW_DELIVERY_UNKNOWN",
      "META_FLOW_DELIVERY_RETRYABLE",
      "WHATSAPP_FLOW_DELIVERY_UNRESOLVED",
      "LOCAL_CORRELATION_FAILED",
    ].includes(error?.code)
  ) {
    return "unknown";
  }
  return "failed";
}

function retryablePreProviderDeliveryFailure(error) {
  const code = typeof error?.code === "string" ? error.code.trim().toUpperCase() : "";
  const causeCode = typeof error?.cause?.code === "string"
    ? error.cause.code.trim().toUpperCase()
    : "";
  return RETRYABLE_PRE_PROVIDER_DELIVERY_CODES.has(code)
    || RETRYABLE_PRE_PROVIDER_DELIVERY_CODES.has(causeCode);
}

function preProviderDeliveryRetryError() {
  return new AutomaticWhatsAppDeliveryError(
    "La preparación local de la respuesta automática falló antes de contactar a Meta y se reintentará de forma segura.",
    "WHATSAPP_AUTOMATIC_DELIVERY_PRE_PROVIDER_RETRY",
  );
}

function automaticProviderFailureEvidence(error, {
  providerDispatchStarted,
  state,
}) {
  if (!providerDispatchStarted) {
    return { failureCode: "PRE_PROVIDER_DELIVERY_BLOCKED" };
  }
  const status = Number(error?.status);
  const providerStatus = Number.isInteger(status) && status >= 100 && status <= 599
    ? status
    : null;
  const controlledCode = SAFE_AUTOMATIC_PROVIDER_FAILURE_CODES.has(error?.code)
    ? error.code
    : null;
  let failureCode = controlledCode;
  if (!failureCode && (error?.name === "AbortError" || error?.name === "TimeoutError" || error instanceof TypeError)) {
    failureCode = "META_TRANSPORT_AMBIGUOUS";
  }
  if (!failureCode && providerStatus) {
    failureCode = state === "unknown" ? "META_HTTP_AMBIGUOUS" : "META_HTTP_REJECTED";
  }
  if (!failureCode) {
    failureCode = state === "unknown" ? "META_DELIVERY_AMBIGUOUS" : "META_DELIVERY_REJECTED";
  }
  return {
    failureCode,
    ...(providerStatus ? { providerStatus } : {}),
  };
}

function settlementPendingError(cause) {
  const error = new Error(
    "The automatic WhatsApp delivery claim could not be settled durably.",
    cause ? { cause } : undefined,
  );
  error.code = "WHATSAPP_AUTOMATIC_DELIVERY_SETTLEMENT_PENDING";
  return error;
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
