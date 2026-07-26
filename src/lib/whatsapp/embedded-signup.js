import crypto from "node:crypto";

import { WHATSAPP_REQUIRED_SCOPES } from "./channel-readiness.js";

const RESOURCE_ID_PATTERN = /^\d{5,32}$/;
const REGISTRATION_PIN_PATTERN = /^\d{6}$/;
const REGISTERED_PHONE_SIGNALS = new Set([
  "CONNECTED",
  "REGISTERED",
  "VERIFIED",
]);
const UNREGISTERED_PHONE_SIGNALS = new Set(["DISCONNECTED", "UNREGISTERED"]);
const PILOT_GRAPH_DEADLINE_MS = 45_000;
const PILOT_TOKEN_MIN_TTL_MS = 5 * 60 * 1_000;

export const REQUIRED_META_SCOPES = WHATSAPP_REQUIRED_SCOPES;

export class MetaIntegrationError extends Error {
  constructor(
    message,
    { code = "META_INTEGRATION_FAILED", status = 502 } = {},
  ) {
    super(message);
    this.name = "MetaIntegrationError";
    this.code = code;
    this.status = status;
  }
}

export function isValidMetaResourceId(value) {
  return RESOURCE_ID_PATTERN.test(String(value || ""));
}

export function isValidRegistrationPin(value) {
  return REGISTRATION_PIN_PATTERN.test(String(value || ""));
}

export function createAppSecretProof(accessToken, appSecret) {
  if (!accessToken || !appSecret)
    throw new Error("Access token and app secret are required.");
  return crypto
    .createHmac("sha256", appSecret)
    .update(accessToken)
    .digest("hex");
}

export function missingRequiredMetaScopes(scopes) {
  const granted = new Set(Array.isArray(scopes) ? scopes.map(String) : []);
  return REQUIRED_META_SCOPES.filter((scope) => !granted.has(scope));
}

export function isMetaAppSubscribed(payload, appId) {
  const entries = Array.isArray(payload) ? payload : payload?.data;
  if (!Array.isArray(entries) || !appId) return false;
  return entries.some((entry) => {
    const candidate =
      entry?.whatsapp_business_api_data?.id ?? entry?.app_id ?? entry?.id;
    return String(candidate || "") === String(appId);
  });
}

export function whatsAppConnectionIdentityChanged(
  previousIdentity,
  nextIdentity,
) {
  if (
    !previousIdentity ||
    typeof previousIdentity !== "object" ||
    Array.isArray(previousIdentity)
  ) {
    return false;
  }
  if (
    !nextIdentity ||
    typeof nextIdentity !== "object" ||
    Array.isArray(nextIdentity)
  ) {
    return true;
  }
  return (
    previousIdentity.phoneNumberId !== nextIdentity.phoneNumberId ||
    previousIdentity.whatsappBusinessId !== nextIdentity.whatsappBusinessId
  );
}

export function mergeWhatsAppConnectionMetadata(
  current,
  verifiedAccount,
  { identityChanged = false, preservePilotImportCurrent = false } = {},
) {
  const existing =
    current && typeof current === "object" && !Array.isArray(current)
      ? current
      : {};
  const verified =
    verifiedAccount &&
    typeof verifiedAccount === "object" &&
    !Array.isArray(verifiedAccount)
      ? verifiedAccount
      : {};
  const merged = { ...existing, ...verified };
  if (!preservePilotImportCurrent) {
    // A completed non-pilot credential replacement supersedes any unfinished
    // Preview recovery escrow and must not retain its encrypted candidate PIN.
    delete merged.pilotImportReservation;
    const pilotImport =
      merged.pilotImport &&
      typeof merged.pilotImport === "object" &&
      !Array.isArray(merged.pilotImport)
        ? { ...merged.pilotImport }
        : null;
    if (pilotImport) {
      // A non-pilot credential replacement invalidates any prior successful
      // import replay marker, even when the WABA and phone IDs are unchanged.
      delete pilotImport.currentOperationKeyHash;
      if (Object.keys(pilotImport).length > 0) merged.pilotImport = pilotImport;
      else delete merged.pilotImport;
    }
  }
  if (identityChanged === true) {
    delete merged.whatsappFlows;
    delete merged.whatsappFlowDrafts;
    delete merged.whatsappFlowEndpoint;
    // Invalidates leases created by builds that persisted the lease in JSON.
    delete merged.whatsappFlowProvisioningLease;
  }
  return merged;
}

export function buildDisabledWhatsAppConnectionData(observed) {
  return {
    enabled: false,
    connectionStatus: "DISABLED",
    encryptedAccessToken: null,
    encryptedPin: null,
    tokenLastFour: null,
    lastError: null,
    metadata: mergeWhatsAppConnectionMetadata(observed?.metadata, {}),
  };
}

function integrationConfig() {
  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const version = process.env.META_GRAPH_API_VERSION || "v25.0";
  if (!appId || !appSecret) {
    throw new MetaIntegrationError(
      "La integración de Meta todavía no está habilitada.",
      {
        code: "META_NOT_CONFIGURED",
        status: 503,
      },
    );
  }
  return { appId, appSecret, version };
}

async function metaResponse(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));
  if (response.ok) return payload;
  const graphCode = payload?.error?.code
    ? `META_${payload.error.code}`
    : "META_GRAPH_ERROR";
  throw new MetaIntegrationError(payload?.error?.message || fallbackMessage, {
    code: graphCode,
    status: response.status >= 400 && response.status < 500 ? 400 : 502,
  });
}

async function metaFetch(fetchImpl, url, options = {}) {
  try {
    return await fetchImpl(url, options);
  } catch (error) {
    if (error instanceof MetaIntegrationError) throw error;
    const timedOut =
      options.signal?.aborted === true ||
      error?.name === "AbortError" ||
      error?.name === "TimeoutError";
    throw new MetaIntegrationError(
      timedOut
        ? "Meta no respondi\u00f3 dentro del plazo operativo."
        : "No se pudo establecer una conexi\u00f3n segura con Meta.",
      {
        code: timedOut ? "META_GRAPH_TIMEOUT" : "META_GRAPH_NETWORK_ERROR",
        status: 502,
      },
    );
  }
}

async function graphRequest({
  path,
  accessToken,
  appSecret,
  version,
  method = "GET",
  body,
  fetchImpl,
  signal,
}) {
  const url = new URL(`https://graph.facebook.com/${version}/${path}`);
  url.searchParams.set(
    "appsecret_proof",
    createAppSecretProof(accessToken, appSecret),
  );
  const response = await metaFetch(fetchImpl, url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
    ...(signal ? { signal } : {}),
  });
  return metaResponse(
    response,
    "Meta no pudo completar la operación solicitada.",
  );
}

function assertRequiredMetaScopes(scopes) {
  const missingScopes = missingRequiredMetaScopes(scopes);
  if (missingScopes.length === 0) return;
  throw new MetaIntegrationError(
    `La autorización de Meta no incluye los permisos operativos requeridos: ${missingScopes.join(", ")}.`,
    { code: "META_SCOPES_INCOMPLETE", status: 403 },
  );
}

async function inspectAccessToken({
  accessToken,
  appId,
  appSecret,
  version,
  fetchImpl,
  signal,
}) {
  const debugUrl = new URL(`https://graph.facebook.com/${version}/debug_token`);
  debugUrl.searchParams.set("input_token", accessToken);
  const debugResponse = await metaFetch(fetchImpl, debugUrl, {
    headers: { Authorization: `Bearer ${appId}|${appSecret}` },
    cache: "no-store",
    ...(signal ? { signal } : {}),
  });
  const debug = await metaResponse(
    debugResponse,
    "No se pudo validar el token de Meta.",
  );
  if (!debug.data?.is_valid || String(debug.data?.app_id) !== String(appId)) {
    throw new MetaIntegrationError("El token no pertenece a la app ObraSaaS.", {
      code: "META_TOKEN_APP_MISMATCH",
      status: 403,
    });
  }
  const scopes = Array.isArray(debug.data?.scopes)
    ? debug.data.scopes.map(String)
    : [];
  assertRequiredMetaScopes(scopes);
  return {
    expiresAt: Number(debug.data?.expires_at || 0) || null,
    scopes,
  };
}

async function inspectPhone({
  whatsappBusinessId,
  phoneNumberId,
  accessToken,
  appSecret,
  version,
  fetchImpl,
  signal,
}) {
  const phones = await graphRequest({
    path: `${whatsappBusinessId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status,status&limit=100`,
    accessToken,
    appSecret,
    version,
    fetchImpl,
    signal,
  });
  const selectedPhone = (phones.data || []).find(
    (phone) => String(phone.id) === String(phoneNumberId),
  );
  if (!selectedPhone) {
    throw new MetaIntegrationError(
      "El número no pertenece a la cuenta de WhatsApp seleccionada.",
      {
        code: "PHONE_WABA_MISMATCH",
        status: 403,
      },
    );
  }
  return selectedPhone;
}

async function inspectSubscription({
  whatsappBusinessId,
  accessToken,
  appId,
  appSecret,
  version,
  fetchImpl,
  signal,
}) {
  const subscriptions = await graphRequest({
    path: `${whatsappBusinessId}/subscribed_apps`,
    accessToken,
    appSecret,
    version,
    fetchImpl,
    signal,
  });
  if (!isMetaAppSubscribed(subscriptions, appId)) {
    throw new MetaIntegrationError(
      "Meta no confirmó la suscripción de ObraSaaS al webhook de esta cuenta.",
      { code: "META_APP_NOT_SUBSCRIBED", status: 409 },
    );
  }
  return true;
}

function verifiedAccountResult({ token, phone }) {
  return {
    expiresAt: token.expiresAt,
    scopes: token.scopes,
    subscribed: true,
    displayPhoneNumber: phone.display_phone_number || null,
    verifiedBusinessName: phone.verified_name || null,
    qualityRating: phone.quality_rating || null,
    verificationStatus: phone.code_verification_status || null,
    phoneStatus: phone.status || null,
  };
}

function pilotPhoneRegistrationState(phone) {
  const signals = [phone?.status, phone?.code_verification_status]
    .map((value) =>
      String(value || "")
        .trim()
        .toUpperCase(),
    )
    .filter(Boolean);
  if (signals.some((signal) => UNREGISTERED_PHONE_SIGNALS.has(signal)))
    return "REQUIRED";
  if (signals.some((signal) => REGISTERED_PHONE_SIGNALS.has(signal)))
    return "REGISTERED";
  return "UNKNOWN";
}

function pilotClock(value) {
  const now =
    value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(now.getTime())) {
    throw new MetaIntegrationError(
      "No se pudo validar la vigencia del token.",
      {
        code: "META_PILOT_CLOCK_INVALID",
        status: 500,
      },
    );
  }
  return now;
}

/**
 * Validates and prepares an existing, expiring Meta credential for the
 * Preview-only pilot import. The raw token is deliberately never returned.
 */
export async function preparePilotWhatsAppCredential({
  accessToken,
  whatsappBusinessId,
  phoneNumberId,
  registrationPin,
  now = new Date(),
  fetchImpl = fetch,
  beforeRemoteMutation = null,
}) {
  if (
    typeof accessToken !== "string" ||
    accessToken.length < 20 ||
    accessToken.length > 4_096 ||
    accessToken.trim() !== accessToken
  ) {
    throw new MetaIntegrationError(
      "El token temporal de Meta es inv\u00e1lido.",
      {
        code: "META_PILOT_TOKEN_INVALID",
        status: 400,
      },
    );
  }
  if (
    !isValidMetaResourceId(whatsappBusinessId) ||
    !isValidMetaResourceId(phoneNumberId)
  ) {
    throw new MetaIntegrationError(
      "Los identificadores de WhatsApp son inv\u00e1lidos.",
      {
        code: "INVALID_WHATSAPP_IDS",
        status: 400,
      },
    );
  }
  const hasPin = registrationPin !== undefined && registrationPin !== null;
  if (
    hasPin &&
    (typeof registrationPin !== "string" ||
      !isValidRegistrationPin(registrationPin))
  ) {
    throw new MetaIntegrationError("El PIN de registro es inv\u00e1lido.", {
      code: "INVALID_REGISTRATION_PIN",
      status: 400,
    });
  }
  if (
    beforeRemoteMutation !== null &&
    typeof beforeRemoteMutation !== "function"
  ) {
    throw new MetaIntegrationError(
      "La protección transaccional del piloto es inválida.",
      {
        code: "META_PILOT_MUTATION_FENCE_INVALID",
        status: 500,
      },
    );
  }

  const observedAt = pilotClock(now);
  const signal = AbortSignal.timeout(PILOT_GRAPH_DEADLINE_MS);
  const { appId, appSecret, version } = integrationConfig();
  const token = await inspectAccessToken({
    accessToken,
    appId,
    appSecret,
    version,
    fetchImpl,
    signal,
  });
  if (!Number.isSafeInteger(token.expiresAt) || token.expiresAt <= 0) {
    throw new MetaIntegrationError(
      "La importaci\u00f3n piloto requiere un token temporal con vencimiento.",
      {
        code: "META_PILOT_TOKEN_EXPIRY_REQUIRED",
        status: 403,
      },
    );
  }
  const expiresAtMs = token.expiresAt * 1_000;
  if (!Number.isSafeInteger(expiresAtMs)) {
    throw new MetaIntegrationError(
      "La vigencia del token temporal de Meta es inv\u00e1lida.",
      {
        code: "META_PILOT_TOKEN_EXPIRY_INVALID",
        status: 403,
      },
    );
  }
  if (expiresAtMs <= observedAt.getTime()) {
    throw new MetaIntegrationError(
      "El token temporal de Meta est\u00e1 vencido.",
      {
        code: "META_PILOT_TOKEN_EXPIRED",
        status: 403,
      },
    );
  }
  if (expiresAtMs < observedAt.getTime() + PILOT_TOKEN_MIN_TTL_MS) {
    throw new MetaIntegrationError(
      "El token temporal de Meta vence demasiado pronto.",
      {
        code: "META_PILOT_TOKEN_TTL_INSUFFICIENT",
        status: 403,
      },
    );
  }

  let selectedPhone = await inspectPhone({
    whatsappBusinessId,
    phoneNumberId,
    accessToken,
    appSecret,
    version,
    fetchImpl,
    signal,
  });
  const registrationState = pilotPhoneRegistrationState(selectedPhone);
  if (registrationState === "UNKNOWN") {
    throw new MetaIntegrationError(
      "Meta no confirm\u00f3 el estado operativo del n\u00famero.",
      {
        code: "META_PILOT_PHONE_STATUS_UNKNOWN",
        status: 409,
      },
    );
  }
  if (registrationState === "REQUIRED" && !hasPin) {
    throw new MetaIntegrationError(
      "Meta requiere un PIN para registrar el n\u00famero.",
      {
        code: "META_PILOT_PIN_REQUIRED",
        status: 409,
      },
    );
  }
  // A retry can observe REGISTERED after an earlier attempt completed the
  // remote /register call but failed before the local transaction committed.
  // In that state the PIN is deliberately ignored and never sent again.

  if (beforeRemoteMutation) {
    await beforeRemoteMutation({
      registrationRequired: registrationState === "REQUIRED",
    });
  }

  await graphRequest({
    path: `${whatsappBusinessId}/subscribed_apps`,
    accessToken,
    appSecret,
    version,
    method: "POST",
    fetchImpl,
    signal,
  });
  await inspectSubscription({
    whatsappBusinessId,
    accessToken,
    appId,
    appSecret,
    version,
    fetchImpl,
    signal,
  });

  const registrationPerformed = registrationState === "REQUIRED";
  if (registrationPerformed) {
    await graphRequest({
      path: `${phoneNumberId}/register`,
      accessToken,
      appSecret,
      version,
      method: "POST",
      body: { messaging_product: "whatsapp", pin: registrationPin },
      fetchImpl,
      signal,
    });
    selectedPhone = await inspectPhone({
      whatsappBusinessId,
      phoneNumberId,
      accessToken,
      appSecret,
      version,
      fetchImpl,
      signal,
    });
    if (pilotPhoneRegistrationState(selectedPhone) !== "REGISTERED") {
      throw new MetaIntegrationError(
        "Meta no confirm\u00f3 el registro operativo del n\u00famero.",
        {
          code: "META_PILOT_PHONE_REGISTRATION_UNCONFIRMED",
          status: 409,
        },
      );
    }
  }

  return {
    tokenType: "temporary",
    registrationPerformed,
    ...verifiedAccountResult({ token, phone: selectedPhone }),
  };
}

export async function verifyConnectedWhatsAppAccount({
  accessToken,
  whatsappBusinessId,
  phoneNumberId,
  fetchImpl = fetch,
}) {
  if (!accessToken || typeof accessToken !== "string") {
    throw new MetaIntegrationError(
      "La conexión no tiene un token utilizable.",
      {
        code: "META_TOKEN_MISSING",
        status: 409,
      },
    );
  }
  if (
    !isValidMetaResourceId(whatsappBusinessId) ||
    !isValidMetaResourceId(phoneNumberId)
  ) {
    throw new MetaIntegrationError(
      "Los identificadores de WhatsApp son inválidos.",
      {
        code: "INVALID_WHATSAPP_IDS",
        status: 400,
      },
    );
  }

  const { appId, appSecret, version } = integrationConfig();
  const token = await inspectAccessToken({
    accessToken,
    appId,
    appSecret,
    version,
    fetchImpl,
  });
  const phone = await inspectPhone({
    whatsappBusinessId,
    phoneNumberId,
    accessToken,
    appSecret,
    version,
    fetchImpl,
  });
  await inspectSubscription({
    whatsappBusinessId,
    accessToken,
    appId,
    appSecret,
    version,
    fetchImpl,
  });
  return verifiedAccountResult({ token, phone });
}

export async function completeEmbeddedSignup({
  code,
  whatsappBusinessId,
  phoneNumberId,
  registrationPin,
  fetchImpl = fetch,
}) {
  if (!code || typeof code !== "string" || code.length > 2_048) {
    throw new MetaIntegrationError(
      "El código de registro de Meta es inválido.",
      {
        code: "INVALID_META_CODE",
        status: 400,
      },
    );
  }
  if (
    !isValidMetaResourceId(whatsappBusinessId) ||
    !isValidMetaResourceId(phoneNumberId)
  ) {
    throw new MetaIntegrationError(
      "Los identificadores de WhatsApp son inválidos.",
      {
        code: "INVALID_WHATSAPP_IDS",
        status: 400,
      },
    );
  }
  if (!isValidRegistrationPin(registrationPin)) {
    throw new MetaIntegrationError("El PIN debe tener exactamente 6 números.", {
      code: "INVALID_REGISTRATION_PIN",
      status: 400,
    });
  }

  const { appId, appSecret, version } = integrationConfig();
  const exchangeUrl = new URL(
    `https://graph.facebook.com/${version}/oauth/access_token`,
  );
  exchangeUrl.searchParams.set("client_id", appId);
  exchangeUrl.searchParams.set("client_secret", appSecret);
  exchangeUrl.searchParams.set("code", code);
  const exchangeResponse = await fetchImpl(exchangeUrl, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const exchange = await metaResponse(
    exchangeResponse,
    "Meta rechazó el código de registro.",
  );
  if (!exchange.access_token) {
    throw new MetaIntegrationError("Meta no devolvió un token de acceso.", {
      code: "META_TOKEN_MISSING",
    });
  }
  const accessToken = exchange.access_token;

  const token = await inspectAccessToken({
    accessToken,
    appId,
    appSecret,
    version,
    fetchImpl,
  });
  await inspectPhone({
    whatsappBusinessId,
    phoneNumberId,
    accessToken,
    appSecret,
    version,
    fetchImpl,
  });

  await graphRequest({
    path: `${whatsappBusinessId}/subscribed_apps`,
    accessToken,
    appSecret,
    version,
    method: "POST",
    fetchImpl,
  });
  await inspectSubscription({
    whatsappBusinessId,
    accessToken,
    appId,
    appSecret,
    version,
    fetchImpl,
  });
  await graphRequest({
    path: `${phoneNumberId}/register`,
    accessToken,
    appSecret,
    version,
    method: "POST",
    body: { messaging_product: "whatsapp", pin: registrationPin },
    fetchImpl,
  });
  const selectedPhone = await inspectPhone({
    whatsappBusinessId,
    phoneNumberId,
    accessToken,
    appSecret,
    version,
    fetchImpl,
  });

  return {
    accessToken,
    tokenType: exchange.token_type || null,
    ...verifiedAccountResult({ token, phone: selectedPhone }),
  };
}
