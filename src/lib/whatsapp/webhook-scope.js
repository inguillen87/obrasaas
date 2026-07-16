import { scopedWebhookExternalId } from "../webhook-queue.js";

function normalizedIdentifier(value) {
  return typeof value === "string" ? value.trim() : "";
}

function eventRequiresActiveProject(eventType) {
  return normalizedIdentifier(eventType).toLowerCase() === "message";
}

function connectionScope(connection, eventType) {
  const projectId = normalizedIdentifier(connection?.project?.id);
  const organizationId = normalizedIdentifier(connection?.project?.organizationId);
  const phoneNumberId = normalizedIdentifier(connection?.phoneNumberId);
  if (
    !projectId
    || !organizationId
    || !phoneNumberId
    || !connection.enabled
    || (
      eventRequiresActiveProject(eventType)
      && connection?.project?.status !== "ACTIVE"
    )
  ) {
    return null;
  }
  return {
    projectId,
    organizationId,
    phoneNumberId,
    whatsappBusinessId: connection.whatsappBusinessId || null,
    displayPhoneNumber: connection.displayPhoneNumber || null,
  };
}

function scopesWithinSingleOrganization(scopes) {
  const validScopes = scopes.filter(Boolean);
  if (validScopes.length === 0) return [];
  const organizationIds = new Set(validScopes.map((scope) => scope.organizationId));
  return organizationIds.size === 1 ? validScopes : [];
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
      select: { id: true, organizationId: true, status: true },
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
    const scope = connectionScope(connection, eventType);
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
      where: {
        enabled: true,
        whatsappBusinessId: exactWhatsappBusinessId,
      },
      select,
    });
  } else if (exactDisplayPhoneNumber) {
    connections = await prisma.whatsAppConnection.findMany({
      where: {
        enabled: true,
        displayPhoneNumber: exactDisplayPhoneNumber,
      },
      select,
    });
    // A display number is a weaker, non-unique database field. Refuse an
    // ambiguous cross-tenant match instead of broadcasting the update.
    if (connections.length !== 1) return [];
  } else {
    return [];
  }

  return scopesWithinSingleOrganization(
    connections.map((connection) => connectionScope(connection, eventType)),
  );
}

function addToLookup(lookup, key, value) {
  if (!key || !value) return;
  const existing = lookup.get(key);
  if (existing) existing.push(value);
  else lookup.set(key, [value]);
}

/**
 * Resolve an entire Meta delivery with one connection query. A supplied
 * phone_number_id remains authoritative and never falls back to a WABA or
 * display number, matching resolveWhatsAppConnectionScopes above.
 */
export async function resolveWhatsAppConnectionScopesBulk(prisma, events = []) {
  if (!Array.isArray(events) || events.length === 0) return [];

  const phoneNumberIds = new Set();
  const whatsappBusinessIds = new Set();
  const displayPhoneNumbers = new Set();

  for (const event of events) {
    const phoneIdentifierWasSupplied = event?.phoneNumberId !== null
      && event?.phoneNumberId !== undefined;
    if (phoneIdentifierWasSupplied) {
      const phoneNumberId = normalizedIdentifier(event.phoneNumberId);
      if (phoneNumberId) phoneNumberIds.add(phoneNumberId);
      continue;
    }
    if (normalizedIdentifier(event?.eventType).toLowerCase() !== "account") continue;

    const whatsappBusinessId = normalizedIdentifier(event?.whatsappBusinessId);
    if (whatsappBusinessId) {
      whatsappBusinessIds.add(whatsappBusinessId);
      continue;
    }
    const displayPhoneNumber = normalizedIdentifier(
      event?.displayPhoneNumber || event?.businessDisplayPhone,
    );
    if (displayPhoneNumber) displayPhoneNumbers.add(displayPhoneNumber);
  }

  const matchers = [];
  if (phoneNumberIds.size > 0) {
    matchers.push({ phoneNumberId: { in: [...phoneNumberIds] } });
  }
  if (whatsappBusinessIds.size > 0) {
    matchers.push({ whatsappBusinessId: { in: [...whatsappBusinessIds] } });
  }
  if (displayPhoneNumbers.size > 0) {
    matchers.push({ displayPhoneNumber: { in: [...displayPhoneNumbers] } });
  }
  if (matchers.length === 0) return events.map(() => []);

  const connections = await prisma.whatsAppConnection.findMany({
    where: {
      enabled: true,
      OR: matchers,
    },
    select: {
      enabled: true,
      phoneNumberId: true,
      whatsappBusinessId: true,
      displayPhoneNumber: true,
      project: {
        select: { id: true, organizationId: true, status: true },
      },
    },
  });

  const byPhoneNumberId = new Map();
  const byWhatsappBusinessId = new Map();
  const byDisplayPhoneNumber = new Map();
  for (const connection of connections) {
    if (!connectionScope(connection, "status")) continue;
    addToLookup(byPhoneNumberId, normalizedIdentifier(connection.phoneNumberId), connection);
    addToLookup(
      byWhatsappBusinessId,
      normalizedIdentifier(connection.whatsappBusinessId),
      connection,
    );
    addToLookup(
      byDisplayPhoneNumber,
      normalizedIdentifier(connection.displayPhoneNumber),
      connection,
    );
  }

  return events.map((event) => {
    const phoneIdentifierWasSupplied = event?.phoneNumberId !== null
      && event?.phoneNumberId !== undefined;
    if (phoneIdentifierWasSupplied) {
      const matches = (byPhoneNumberId.get(normalizedIdentifier(event.phoneNumberId)) || [])
        .map((connection) => connectionScope(connection, event.eventType))
        .filter(Boolean);
      return matches.length === 1 ? matches : [];
    }
    if (normalizedIdentifier(event?.eventType).toLowerCase() !== "account") return [];

    const whatsappBusinessId = normalizedIdentifier(event?.whatsappBusinessId);
    if (whatsappBusinessId) {
      return scopesWithinSingleOrganization(
        (byWhatsappBusinessId.get(whatsappBusinessId) || [])
          .map((connection) => connectionScope(connection, event.eventType))
          .filter(Boolean),
      );
    }

    const displayPhoneNumber = normalizedIdentifier(
      event?.displayPhoneNumber || event?.businessDisplayPhone,
    );
    const matches = (byDisplayPhoneNumber.get(displayPhoneNumber) || [])
      .map((connection) => connectionScope(connection, event.eventType))
      .filter(Boolean);
    return matches.length === 1 ? matches : [];
  });
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

  // Project status is an ingress decision for message events. Once an event is
  // durably accepted, a later pause must not erase it as a tenant-scope breach.
  // The immutable project/organization/phone binding and enabled connection
  // remain mandatory throughout processing.
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
      "Stored webhook scope no longer belongs to an enabled tenant connection.",
      "WEBHOOK_MESSAGE_SCOPE_MISMATCH",
    );
  }

  return { projectId, organizationId, phoneNumberId };
}
