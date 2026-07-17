import crypto from "node:crypto";

export const WHATSAPP_FLOW_PROVISIONING_LEASE = Object.freeze({
  ttlMs: 2 * 60 * 1_000,
  maxTtlMs: 10 * 60 * 1_000,
  maxCasAttempts: 5,
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CONNECTION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const BLUEPRINT_KEY_PATTERN = /^[a-z][a-z0-9_.-]{0,63}$/;
const META_RESOURCE_ID_PATTERN = /^\d{1,32}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const CONNECTION_MUTATION_FIELDS = new Set([
  "phoneNumberId",
  "whatsappBusinessId",
  "displayPhoneNumber",
  "verifiedBusinessName",
  "enabled",
  "connectionStatus",
  "encryptedAccessToken",
  "encryptedPin",
  "tokenLastFour",
  "embeddedSignupVersion",
  "connectedAt",
  "lastVerifiedAt",
  "lastError",
  "metadata",
]);

export class WhatsAppFlowProvisioningLeaseError extends Error {
  constructor(message, { code, status, retryAfterSeconds = null }) {
    super(message);
    this.name = "WhatsAppFlowProvisioningLeaseError";
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function leaseError(message, code, status, retryAfterSeconds = null) {
  return new WhatsAppFlowProvisioningLeaseError(message, {
    code,
    status,
    retryAfterSeconds,
  });
}

function storedMetadata(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function validDate(value, name) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw leaseError(
      `Invalid WhatsApp Flow provisioning ${name}.`,
      "WHATSAPP_FLOW_PROVISIONING_LEASE_INVALID",
      500,
    );
  }
  return date;
}

function normalizedConnectionId(value) {
  const id = String(value || "").trim();
  if (!CONNECTION_ID_PATTERN.test(id)) {
    throw leaseError(
      "Invalid WhatsApp connection identity.",
      "WHATSAPP_FLOW_PROVISIONING_LEASE_INVALID",
      500,
    );
  }
  return id;
}

function normalizedBlueprintKey(value) {
  const key = String(value || "").trim();
  if (!BLUEPRINT_KEY_PATTERN.test(key)) {
    throw leaseError(
      "Invalid WhatsApp Flow blueprint identity.",
      "WHATSAPP_FLOW_PROVISIONING_LEASE_INVALID",
      500,
    );
  }
  return key;
}

function normalizedLeaseId(value) {
  const id = String(value || "").trim().toLowerCase();
  if (!UUID_PATTERN.test(id)) {
    throw leaseError(
      "Invalid WhatsApp Flow provisioning lease identity.",
      "WHATSAPP_FLOW_PROVISIONING_LEASE_INVALID",
      500,
    );
  }
  return id;
}

function hashEncryptedAccessToken(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizedExpectedConnectionIdentity(value) {
  const phoneNumberId = String(value?.phoneNumberId || "").trim();
  const whatsappBusinessId = String(value?.whatsappBusinessId || "").trim();
  const encryptedAccessToken = typeof value?.encryptedAccessToken === "string"
    ? value.encryptedAccessToken
    : "";
  if (
    !META_RESOURCE_ID_PATTERN.test(phoneNumberId)
    || !META_RESOURCE_ID_PATTERN.test(whatsappBusinessId)
    || !encryptedAccessToken
    || Buffer.byteLength(encryptedAccessToken, "utf8") > 131_072
  ) {
    throw leaseError(
      "Invalid WhatsApp connection identity snapshot.",
      "WHATSAPP_FLOW_PROVISIONING_LEASE_INVALID",
      500,
    );
  }
  return {
    phoneNumberId,
    whatsappBusinessId,
    encryptedAccessToken,
    encryptedAccessTokenSha256: hashEncryptedAccessToken(encryptedAccessToken),
  };
}

function normalizedConnectionIdentityFingerprint(value) {
  const phoneNumberId = String(value?.phoneNumberId || "").trim();
  const whatsappBusinessId = String(value?.whatsappBusinessId || "").trim();
  const encryptedAccessTokenSha256 = String(
    value?.encryptedAccessTokenSha256 || "",
  ).trim().toLowerCase();
  if (
    !META_RESOURCE_ID_PATTERN.test(phoneNumberId)
    || !META_RESOURCE_ID_PATTERN.test(whatsappBusinessId)
    || !SHA256_PATTERN.test(encryptedAccessTokenSha256)
  ) {
    throw leaseError(
      "Invalid WhatsApp connection identity fingerprint.",
      "WHATSAPP_FLOW_PROVISIONING_LEASE_INVALID",
      500,
    );
  }
  return { phoneNumberId, whatsappBusinessId, encryptedAccessTokenSha256 };
}

function publicConnectionIdentity(identity) {
  return {
    phoneNumberId: identity.phoneNumberId,
    whatsappBusinessId: identity.whatsappBusinessId,
    encryptedAccessTokenSha256: identity.encryptedAccessTokenSha256,
  };
}

function connectionMatchesIdentity(connection, expected) {
  return connection.phoneNumberId === expected.phoneNumberId
    && connection.whatsappBusinessId === expected.whatsappBusinessId
    && typeof connection.encryptedAccessToken === "string"
    && hashEncryptedAccessToken(connection.encryptedAccessToken)
      === expected.encryptedAccessTokenSha256;
}

function connectionDelegate(prisma) {
  const delegate = prisma?.whatsAppConnection;
  if (
    !delegate
    || typeof delegate.findUnique !== "function"
    || typeof delegate.updateMany !== "function"
  ) {
    throw leaseError(
      "WhatsApp Flow provisioning lease persistence is unavailable.",
      "WHATSAPP_FLOW_PROVISIONING_LEASE_UNAVAILABLE",
      503,
    );
  }
  return delegate;
}

function nextUpdatedAt(observedUpdatedAt, requestedAt) {
  const observed = validDate(observedUpdatedAt, "version");
  const requested = validDate(requestedAt, "clock");
  return new Date(Math.max(requested.getTime(), observed.getTime() + 1));
}

function leaseFromConnection(connection) {
  if (!connection?.flowProvisioningLeaseId) return null;
  const acquiredAt = validDate(
    connection.flowProvisioningLeaseAcquiredAt,
    "lease acquisition",
  );
  const expiresAt = validDate(
    connection.flowProvisioningLeaseExpiresAt,
    "lease expiry",
  );
  return {
    id: normalizedLeaseId(connection.flowProvisioningLeaseId),
    blueprintKey: normalizedBlueprintKey(connection.flowProvisioningBlueprintKey),
    acquiredAt,
    expiresAt,
  };
}

async function readConnection(delegate, connectionId) {
  const connection = await delegate.findUnique({
    where: { id: connectionId },
    select: {
      metadata: true,
      updatedAt: true,
      enabled: true,
      connectionStatus: true,
      phoneNumberId: true,
      whatsappBusinessId: true,
      encryptedAccessToken: true,
      flowProvisioningLeaseId: true,
      flowProvisioningBlueprintKey: true,
      flowProvisioningLeaseAcquiredAt: true,
      flowProvisioningLeaseExpiresAt: true,
    },
  });
  if (!connection) {
    throw leaseError(
      "WhatsApp connection is no longer available.",
      "WHATSAPP_FLOW_PROVISIONING_CONNECTION_NOT_FOUND",
      409,
    );
  }
  return {
    ...connection,
    metadata: storedMetadata(connection.metadata),
    updatedAt: validDate(connection.updatedAt, "version"),
    lease: leaseFromConnection(connection),
  };
}

function activeLeaseRetryAfter(lease, now) {
  if (!lease || lease.expiresAt <= now) return null;
  return Math.max(1, Math.ceil((lease.expiresAt.getTime() - now.getTime()) / 1_000));
}

function publicLease(lease) {
  return {
    id: lease.id,
    blueprintKey: lease.blueprintKey,
    acquiredAt: lease.acquiredAt.toISOString(),
    expiresAt: lease.expiresAt.toISOString(),
  };
}

function clearedLeaseColumns() {
  return {
    flowProvisioningLeaseId: null,
    flowProvisioningBlueprintKey: null,
    flowProvisioningLeaseAcquiredAt: null,
    flowProvisioningLeaseExpiresAt: null,
  };
}

function normalizedConnectionMutation(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw leaseError(
      "WhatsApp connection lease mutation is invalid.",
      "WHATSAPP_FLOW_PROVISIONING_LEASE_INVALID",
      500,
    );
  }
  const mutation = {};
  for (const [key, fieldValue] of Object.entries(value)) {
    if (!CONNECTION_MUTATION_FIELDS.has(key)) {
      throw leaseError(
        `WhatsApp connection lease cannot mutate ${key}.`,
        "WHATSAPP_FLOW_PROVISIONING_LEASE_INVALID",
        500,
      );
    }
    if (fieldValue !== undefined) mutation[key] = fieldValue;
  }
  return mutation;
}

export async function acquireWhatsAppConnectionLease(
  prisma,
  {
    connectionId: rawConnectionId,
    operationKey: rawOperationKey,
    expectedUpdatedAt: rawExpectedUpdatedAt,
    expectedConnectionIdentity: rawExpectedConnectionIdentity = null,
    requireActive = false,
    now = new Date(),
    ttlMs = WHATSAPP_FLOW_PROVISIONING_LEASE.ttlMs,
    leaseId: requestedLeaseId = crypto.randomUUID(),
  },
) {
  const delegate = connectionDelegate(prisma);
  const connectionId = normalizedConnectionId(rawConnectionId);
  const operationKey = normalizedBlueprintKey(rawOperationKey);
  const expectedUpdatedAt = validDate(rawExpectedUpdatedAt, "expected version");
  const expectedConnectionIdentity = rawExpectedConnectionIdentity
    ? normalizedExpectedConnectionIdentity(rawExpectedConnectionIdentity)
    : null;
  if (requireActive && !expectedConnectionIdentity) {
    throw leaseError(
      "Active WhatsApp connection leases require an identity snapshot.",
      "WHATSAPP_FLOW_PROVISIONING_LEASE_INVALID",
      500,
    );
  }
  const acquiredAt = validDate(now, "clock");
  const leaseId = normalizedLeaseId(requestedLeaseId);
  if (
    !Number.isSafeInteger(ttlMs)
    || ttlMs < 1_000
    || ttlMs > WHATSAPP_FLOW_PROVISIONING_LEASE.maxTtlMs
  ) {
    throw leaseError(
      "Invalid WhatsApp Flow provisioning lease duration.",
      "WHATSAPP_FLOW_PROVISIONING_LEASE_INVALID",
      500,
    );
  }
  const expiresAt = new Date(acquiredAt.getTime() + ttlMs);
  const lease = { id: leaseId, blueprintKey: operationKey, acquiredAt, expiresAt };

  const claimed = await delegate.updateMany({
    where: {
      id: connectionId,
      updatedAt: expectedUpdatedAt,
      ...(requireActive ? { enabled: true, connectionStatus: "CONNECTED" } : {}),
      ...(expectedConnectionIdentity ? {
        phoneNumberId: expectedConnectionIdentity.phoneNumberId,
        whatsappBusinessId: expectedConnectionIdentity.whatsappBusinessId,
        encryptedAccessToken: expectedConnectionIdentity.encryptedAccessToken,
      } : {}),
      OR: [
        { flowProvisioningLeaseId: null },
        { flowProvisioningLeaseExpiresAt: { lte: acquiredAt } },
      ],
    },
    data: {
      flowProvisioningLeaseId: leaseId,
      flowProvisioningBlueprintKey: operationKey,
      flowProvisioningLeaseAcquiredAt: acquiredAt,
      flowProvisioningLeaseExpiresAt: expiresAt,
    },
  });
  const observed = await readConnection(delegate, connectionId);
  if (claimed.count === 1) {
    if (
      observed.lease?.id === leaseId
      && (!requireActive || (
        observed.enabled === true
        && observed.connectionStatus === "CONNECTED"
      ))
      && (!expectedConnectionIdentity || connectionMatchesIdentity(
        observed,
        expectedConnectionIdentity,
      ))
    ) {
      return {
        lease: publicLease(lease),
        connectionIdentity: expectedConnectionIdentity
          ? publicConnectionIdentity(expectedConnectionIdentity)
          : null,
        metadata: observed.metadata,
        updatedAt: observed.updatedAt,
      };
    }
    if (observed.lease?.id === leaseId) {
      await delegate.updateMany({
        where: { id: connectionId, flowProvisioningLeaseId: leaseId },
        data: clearedLeaseColumns(),
      });
    }
    throw leaseError(
      "WhatsApp connection changed while acquiring its Flow provisioning lease.",
      "WHATSAPP_FLOW_PROVISIONING_CONNECTION_CHANGED",
      409,
    );
  }

  const retryAfterSeconds = activeLeaseRetryAfter(observed.lease, acquiredAt);
  if (retryAfterSeconds !== null) {
    throw leaseError(
      "Another WhatsApp Flow provisioning operation is already in progress.",
      "WHATSAPP_FLOW_PROVISIONING_IN_PROGRESS",
      409,
      retryAfterSeconds,
    );
  }
  throw leaseError(
    "WhatsApp connection changed before its Flow provisioning lease was acquired.",
    "WHATSAPP_FLOW_PROVISIONING_CONNECTION_CHANGED",
    409,
  );
}

export function acquireWhatsAppFlowProvisioningLease(
  prisma,
  { blueprintKey, ...options },
) {
  return acquireWhatsAppConnectionLease(prisma, {
    ...options,
    operationKey: blueprintKey,
    requireActive: true,
  });
}

export async function commitWhatsAppConnectionLease(
  prisma,
  {
    connectionId: rawConnectionId,
    leaseId: rawLeaseId,
    expectedConnectionIdentity: rawExpectedConnectionIdentity = null,
    requireActive = false,
    buildConnectionData,
    createAuditLog = null,
    now = new Date(),
  },
) {
  const connectionId = normalizedConnectionId(rawConnectionId);
  const leaseId = normalizedLeaseId(rawLeaseId);
  const requestedAt = validDate(now, "clock");
  const expectedConnectionIdentity = rawExpectedConnectionIdentity
    ? normalizedConnectionIdentityFingerprint(rawExpectedConnectionIdentity)
    : null;
  if (requireActive && !expectedConnectionIdentity) {
    throw leaseError(
      "Active WhatsApp connection commits require an identity fingerprint.",
      "WHATSAPP_FLOW_PROVISIONING_LEASE_INVALID",
      500,
    );
  }
  if (typeof buildConnectionData !== "function") {
    throw leaseError(
      "WhatsApp connection lease mutation builder is unavailable.",
      "WHATSAPP_FLOW_PROVISIONING_LEASE_INVALID",
      500,
    );
  }
  if (createAuditLog !== null && typeof createAuditLog !== "function") {
    throw leaseError(
      "WhatsApp Flow provisioning audit writer is invalid.",
      "WHATSAPP_FLOW_PROVISIONING_LEASE_INVALID",
      500,
    );
  }

  for (let attempt = 0; attempt < WHATSAPP_FLOW_PROVISIONING_LEASE.maxCasAttempts; attempt += 1) {
    const delegate = connectionDelegate(prisma);
    const observed = await readConnection(delegate, connectionId);
    if (observed.lease?.id !== leaseId) {
      throw leaseError(
        "WhatsApp Flow provisioning lease ownership was lost.",
        "WHATSAPP_FLOW_PROVISIONING_LEASE_LOST",
        409,
      );
    }
    if (
      (requireActive && (
        observed.enabled !== true
        || observed.connectionStatus !== "CONNECTED"
      ))
      || (expectedConnectionIdentity && !connectionMatchesIdentity(
        observed,
        expectedConnectionIdentity,
      ))
    ) {
      throw leaseError(
        "WhatsApp connection changed during Flow provisioning.",
        "WHATSAPP_FLOW_PROVISIONING_CONNECTION_CHANGED",
        409,
      );
    }
    const nextMutation = normalizedConnectionMutation(buildConnectionData(observed));
    const version = nextUpdatedAt(observed.updatedAt, requestedAt);

    const performUpdate = async (transaction) => {
      const transactionDelegate = connectionDelegate(transaction);
      const updated = await transactionDelegate.updateMany({
        where: {
          id: connectionId,
          updatedAt: observed.updatedAt,
          flowProvisioningLeaseId: leaseId,
        },
        data: {
          ...nextMutation,
          ...clearedLeaseColumns(),
          updatedAt: version,
        },
      });
      if (updated.count !== 1) return false;
      if (createAuditLog) await createAuditLog(transaction);
      return true;
    };

    let committed;
    if (createAuditLog) {
      if (typeof prisma?.$transaction !== "function") {
        throw leaseError(
          "WhatsApp Flow provisioning transactions are unavailable.",
          "WHATSAPP_FLOW_PROVISIONING_LEASE_UNAVAILABLE",
          503,
        );
      }
      committed = await prisma.$transaction(
        performUpdate,
        { maxWait: 3_000, timeout: 5_000 },
      );
    } else {
      committed = await performUpdate(prisma);
    }
    if (committed) {
      return {
        data: nextMutation,
        metadata: Object.hasOwn(nextMutation, "metadata")
          ? nextMutation.metadata
          : observed.metadata,
        updatedAt: version,
      };
    }
  }

  throw leaseError(
    "WhatsApp Flow provisioning metadata changed too many times.",
    "WHATSAPP_FLOW_PROVISIONING_CONFLICT",
    409,
  );
}

export function commitWhatsAppFlowProvisioningLease(
  prisma,
  {
    buildMetadata,
    expectedConnectionIdentity,
    ...options
  },
) {
  if (typeof buildMetadata !== "function") {
    throw leaseError(
      "WhatsApp Flow provisioning metadata builder is unavailable.",
      "WHATSAPP_FLOW_PROVISIONING_LEASE_INVALID",
      500,
    );
  }
  return commitWhatsAppConnectionLease(prisma, {
    ...options,
    expectedConnectionIdentity,
    requireActive: true,
    buildConnectionData: (connection) => ({
      metadata: buildMetadata(connection.metadata),
    }),
  });
}

export async function releaseWhatsAppConnectionLease(
  prisma,
  { connectionId: rawConnectionId, leaseId: rawLeaseId },
) {
  const delegate = connectionDelegate(prisma);
  const connectionId = normalizedConnectionId(rawConnectionId);
  const leaseId = normalizedLeaseId(rawLeaseId);
  const released = await delegate.updateMany({
    where: { id: connectionId, flowProvisioningLeaseId: leaseId },
    data: clearedLeaseColumns(),
  });
  return released.count === 1;
}

export const releaseWhatsAppFlowProvisioningLease = releaseWhatsAppConnectionLease;
