import { scopedWebhookExternalId } from "../webhook-queue.js";

function normalizedIdentifier(value) {
  return typeof value === "string" ? value.trim() : "";
}

function connectionScope(connection) {
  const projectId = normalizedIdentifier(connection?.project?.id);
  const organizationId = normalizedIdentifier(connection?.project?.organizationId);
  const phoneNumberId = normalizedIdentifier(connection?.phoneNumberId);
  if (!projectId || !organizationId || !phoneNumberId || !connection.enabled) return null;
  return {
    projectId,
    organizationId,
    phoneNumberId,
    whatsappBusinessId: connection.whatsappBusinessId || null,
    displayPhoneNumber: connection.displayPhoneNumber || null,
  };
}

export async function resolveWhatsAppConnectionScopes(prisma, {
  eventType,
  phoneNumberId,
  whatsappBusinessId,
  displayPhoneNumber,
} = {}) {
  const phoneIdentifierWasSupplied = phoneNumberId !== null && phoneNumberId !== undefined;
  const exactPhoneNumberId = normalizedIdentifier(phoneNumberId);
  const select = {
    enabled: true,
    phoneNumberId: true,
    whatsappBusinessId: true,
    displayPhoneNumber: true,
    project: {
      select: { id: true, organizationId: true },
    },
  };

  // A phone_number_id is Meta's strongest routing identifier. Once supplied,
  // it must resolve exactly and must never degrade to a WABA/display lookup.
  if (phoneIdentifierWasSupplied) {
    if (!exactPhoneNumberId) return [];
    const connection = await prisma.whatsAppConnection.findUnique({
      where: { phoneNumberId: exactPhoneNumberId },
      select,
    });
    const scope = connectionScope(connection);
    return scope ? [scope] : [];
  }

  // WABA/display routing exists only for account-level Embedded Signup events,
  // which legitimately do not always include a phone_number_id.
  if (normalizedIdentifier(eventType).toLowerCase() !== "account") return [];

  const exactWhatsappBusinessId = normalizedIdentifier(whatsappBusinessId);
  const exactDisplayPhoneNumber = normalizedIdentifier(displayPhoneNumber);
  let connections = [];
  if (exactWhatsappBusinessId) {
    connections = await prisma.whatsAppConnection.findMany({
      where: { enabled: true, whatsappBusinessId: exactWhatsappBusinessId },
      select,
    });
  } else if (exactDisplayPhoneNumber) {
    connections = await prisma.whatsAppConnection.findMany({
      where: { enabled: true, displayPhoneNumber: exactDisplayPhoneNumber },
      select,
    });
    // A display number is a weaker, non-unique database field. Refuse an
    // ambiguous cross-tenant match instead of broadcasting the update.
    if (connections.length !== 1) return [];
  } else {
    return [];
  }

  return connections.map(connectionScope).filter(Boolean);
}

function webhookScopeError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export async function validateStoredWebhookScope(prisma, leasedEvent, event, scope) {
  const projectId = normalizedIdentifier(scope?.projectId);
  const organizationId = normalizedIdentifier(scope?.organizationId);
  const phoneNumberId = normalizedIdentifier(scope?.phoneNumberId);
  if (!projectId || !organizationId || !phoneNumberId) {
    throw webhookScopeError(
      "Stored webhook tenant scope is incomplete.",
      "WEBHOOK_PAYLOAD_INVALID",
    );
  }

  if (
    leasedEvent?.provider !== "meta"
    || event?.provider !== "meta"
    || leasedEvent?.projectId !== projectId
    || leasedEvent?.eventType !== event?.eventType
    || leasedEvent?.externalId !== scopedWebhookExternalId(projectId, event?.externalId)
    || normalizedIdentifier(event?.phoneNumberId) !== phoneNumberId
  ) {
    throw webhookScopeError(
      "Stored webhook event does not match its queue and connection scope.",
      "WEBHOOK_MESSAGE_SCOPE_MISMATCH",
    );
  }

  const connection = await prisma.whatsAppConnection.findFirst({
    where: {
      projectId,
      phoneNumberId,
      enabled: true,
      project: { organizationId },
    },
    select: { id: true },
  });
  if (!connection) {
    throw webhookScopeError(
      "Stored webhook scope no longer belongs to an active tenant connection.",
      "WEBHOOK_MESSAGE_SCOPE_MISMATCH",
    );
  }

  return { projectId, organizationId, phoneNumberId };
}
