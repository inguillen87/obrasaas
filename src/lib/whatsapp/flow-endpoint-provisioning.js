import {
  activateWhatsAppFlowEndpointKey,
  ensureWhatsAppFlowEndpoint,
  markWhatsAppFlowEndpointKeyUploaded,
  markWhatsAppFlowEndpointKeyVerified,
} from "./flow-endpoint-keys.js";
import {
  getWhatsAppBusinessEncryptionPublicKey,
  getWhatsAppFlowProvisioningReference,
  normalizeWhatsAppFlowPublicKey,
  provisionWhatsAppFlowDraft,
  setWhatsAppBusinessEncryptionPublicKey,
} from "./flows.js";
import { MetaIntegrationError } from "./embedded-signup.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function canonicalUrl(value) {
  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
}

export function buildWhatsAppFlowEndpointUri(appUrl, endpointId) {
  const normalizedEndpointId = String(endpointId || "").trim().toLowerCase();
  if (!UUID_PATTERN.test(normalizedEndpointId)) {
    throw new MetaIntegrationError("El Data Endpoint de WhatsApp no tiene una identidad válida.", {
      code: "FLOW_ENDPOINT_ID_INVALID",
      status: 500,
    });
  }
  try {
    const base = new URL(appUrl);
    if (
      base.protocol !== "https:"
      || !base.hostname
      || base.username
      || base.password
      || base.hash
    ) throw new Error("unsafe base URL");
    return new URL(
      `/api/webhooks/whatsapp/flows/${normalizedEndpointId}`,
      base,
    ).toString();
  } catch {
    throw new MetaIntegrationError(
      "Configurá NEXT_PUBLIC_APP_URL con la URL HTTPS estable de ObraSaaS antes de crear Flows.",
      { code: "FLOW_PUBLIC_URL_INVALID", status: 503 },
    );
  }
}

function samePublicKey(left, right) {
  if (!left || !right) return false;
  try {
    return normalizeWhatsAppFlowPublicKey(left) === normalizeWhatsAppFlowPublicKey(right);
  } catch {
    return false;
  }
}

async function requireRemoteKeyConfirmation({
  phoneNumberId,
  accessToken,
  publicKeyPem,
  fetchImpl,
  getEncryption,
}) {
  const remote = await getEncryption({
    phoneNumberId,
    accessToken,
    fetchImpl,
  });
  if (
    remote?.signatureStatus !== "VALID"
    || !samePublicKey(remote.publicKey, publicKeyPem)
  ) {
    throw new MetaIntegrationError(
      "Meta no confirmó la clave RSA dedicada del Data Endpoint.",
      { code: "FLOW_PUBLIC_KEY_NOT_VERIFIED", status: 502 },
    );
  }
  return remote;
}

export async function synchronizeWhatsAppFlowEndpointKey({
  prisma,
  connection,
  accessToken,
  fetchImpl = fetch,
}, {
  ensureEndpoint = ensureWhatsAppFlowEndpoint,
  markUploaded = markWhatsAppFlowEndpointKeyUploaded,
  markVerified = markWhatsAppFlowEndpointKeyVerified,
  activateKey = activateWhatsAppFlowEndpointKey,
  getEncryption = getWhatsAppBusinessEncryptionPublicKey,
  setEncryption = setWhatsAppBusinessEncryptionPublicKey,
} = {}) {
  if (!connection?.id || !connection?.phoneNumberId) {
    throw new MetaIntegrationError("La conexión de WhatsApp no está disponible.", {
      code: "WHATSAPP_NOT_CONNECTED",
      status: 409,
    });
  }
  const ensured = await ensureEndpoint(prisma, { connectionId: connection.id });
  const endpoint = ensured.endpoint;
  let key = ensured.key;

  if (key.status === "ACTIVE") {
    const current = await getEncryption({
      phoneNumberId: connection.phoneNumberId,
      accessToken,
      fetchImpl,
    }).catch(() => null);
    if (
      current?.signatureStatus !== "VALID"
      || !samePublicKey(current.publicKey, key.publicKeyPem)
    ) {
      const registration = await setEncryption({
        phoneNumberId: connection.phoneNumberId,
        accessToken,
        publicKey: key.publicKeyPem,
        fetchImpl,
      });
      if (!registration?.success) {
        throw new MetaIntegrationError("Meta rechazó la clave pública del Data Endpoint.", {
          code: "FLOW_PUBLIC_KEY_REJECTED",
          status: 502,
        });
      }
    }
    const remote = await requireRemoteKeyConfirmation({
      phoneNumberId: connection.phoneNumberId,
      accessToken,
      publicKeyPem: key.publicKeyPem,
      fetchImpl,
      getEncryption,
    });
    return {
      endpoint,
      key,
      signatureStatus: remote.signatureStatus,
      activated: false,
    };
  }

  if (key.status !== "STAGED") {
    throw new MetaIntegrationError("La clave del Data Endpoint no está lista para registrarse.", {
      code: "FLOW_PUBLIC_KEY_STATE_INVALID",
      status: 409,
    });
  }
  const registration = await setEncryption({
    phoneNumberId: connection.phoneNumberId,
    accessToken,
    publicKey: key.publicKeyPem,
    fetchImpl,
  });
  if (!registration?.success) {
    throw new MetaIntegrationError("Meta rechazó la clave pública del Data Endpoint.", {
      code: "FLOW_PUBLIC_KEY_REJECTED",
      status: 502,
    });
  }
  key = await markUploaded(prisma, {
    connectionId: connection.id,
    keyId: key.id,
  });
  const remote = await requireRemoteKeyConfirmation({
    phoneNumberId: connection.phoneNumberId,
    accessToken,
    publicKeyPem: key.publicKeyPem,
    fetchImpl,
    getEncryption,
  });
  key = await markVerified(prisma, {
    connectionId: connection.id,
    keyId: key.id,
    publicKeyPem: remote.publicKey,
    signatureStatus: remote.signatureStatus,
  });
  const activation = await activateKey(prisma, {
    connectionId: connection.id,
    keyId: key.id,
  });
  return {
    endpoint: activation.endpoint,
    key: activation.key,
    signatureStatus: remote.signatureStatus,
    activated: activation.activated,
  };
}

export function remoteFlowUsesDataEndpoint(flow, { endpointUri, applicationId }) {
  return Boolean(
    flow
    && flow.jsonVersion === "7.3"
    && flow.dataApiVersion === "4.0"
    && canonicalUrl(flow.dataChannelUri || flow.endpointUri) === canonicalUrl(endpointUri)
    && String(flow.applicationId || "") === String(applicationId || "")
  );
}

function healthEntries(healthStatus) {
  if (!healthStatus || typeof healthStatus !== "object" || Array.isArray(healthStatus)) return [];
  return [healthStatus, ...(Array.isArray(healthStatus.entities) ? healthStatus.entities : [])];
}

export function whatsAppFlowHealthIsBlocked(healthStatus) {
  if (typeof healthStatus === "string") {
    return new Set(["BLOCKED", "ERROR", "UNHEALTHY"]).has(healthStatus.toUpperCase());
  }
  return healthEntries(healthStatus).some((entry) => {
    const state = String(entry?.can_send_message || entry?.canSendMessage || "").toUpperCase();
    return new Set(["BLOCKED", "ERROR", "UNHEALTHY"]).has(state)
      || (Array.isArray(entry?.errors) && entry.errors.length > 0);
  });
}

export function flowRuntimeIsReady(flow, storedFlow, endpointState, {
  endpointUri,
  applicationId,
} = {}) {
  return Boolean(
    flow?.status === "PUBLISHED"
    && storedFlow?.status === "PUBLISHED"
    && String(storedFlow?.id || "") === flow.id
    && storedFlow?.dataExchange === true
    && endpointState?.ready === true
    && remoteFlowUsesDataEndpoint(flow, { endpointUri, applicationId })
    && !whatsAppFlowHealthIsBlocked(flow.healthStatus)
  );
}

export async function readWhatsAppFlowEndpointState(prisma, connectionId) {
  if (!connectionId || typeof prisma?.whatsAppFlowEndpoint?.findUnique !== "function") return null;
  const endpoint = await prisma.whatsAppFlowEndpoint.findUnique({
    where: { connectionId },
    select: {
      id: true,
      enabled: true,
      keys: {
        where: { status: "ACTIVE" },
        orderBy: { version: "desc" },
        take: 1,
        select: {
          id: true,
          version: true,
          status: true,
          publicKeySha256: true,
          uploadedAt: true,
          verifiedAt: true,
          activatedAt: true,
        },
      },
    },
  });
  if (!endpoint) return null;
  const key = endpoint.keys[0] || null;
  return {
    id: endpoint.id,
    enabled: endpoint.enabled,
    ready: Boolean(
      endpoint.enabled
      && key?.status === "ACTIVE"
      && key.uploadedAt
      && key.verifiedAt
      && key.activatedAt
    ),
    keyFingerprint: key?.publicKeySha256 || null,
    keyVersion: key?.version || null,
    verifiedAt: key?.verifiedAt || null,
  };
}

export async function provisionWhatsAppFlowDataEndpoint({
  prisma,
  connection,
  blueprintKey,
  accessToken,
  appUrl,
  applicationId,
  fetchImpl = fetch,
}, {
  synchronizeKey = synchronizeWhatsAppFlowEndpointKey,
  provisionDraft = provisionWhatsAppFlowDraft,
} = {}) {
  const keyState = await synchronizeKey({
    prisma,
    connection,
    accessToken,
    fetchImpl,
  });
  const endpointUri = buildWhatsAppFlowEndpointUri(appUrl, keyState.endpoint.id);
  const existingFlow = getWhatsAppFlowProvisioningReference(
    connection?.metadata,
    blueprintKey,
    keyState.endpoint.id,
    connection.whatsappBusinessId,
  );
  const result = await provisionDraft({
    blueprintKey,
    whatsappBusinessId: connection.whatsappBusinessId,
    accessToken,
    endpointUri,
    applicationId,
    flowScope: keyState.endpoint.id,
    existingFlowId: existingFlow?.id || null,
    fetchImpl,
  });
  const dataExchange = remoteFlowUsesDataEndpoint(result.flow, {
    endpointUri,
    applicationId,
  });
  return {
    result,
    endpointUri,
    dataExchange,
    endpoint: {
      id: keyState.endpoint.id,
      ready: true,
      keyFingerprint: keyState.key.publicKeySha256,
      keyVersion: keyState.key.version,
      signatureStatus: keyState.signatureStatus,
      verifiedAt: keyState.key.verifiedAt || null,
    },
  };
}
