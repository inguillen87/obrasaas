import {
  decodeUtf8RequestBytes,
  readLimitedRequestBytes,
  RequestBodyError,
} from "../request-body.js";
import {
  decryptWhatsAppFlowRequest,
  encryptWhatsAppFlowResponse,
  WhatsAppFlowEndpointCryptoError,
} from "./flow-endpoint-crypto.js";
import {
  dispatchWhatsAppFlowDataRequest,
  WHATSAPP_FLOW_JOURNAL_REPLAY_POLICY_RECOMPUTE,
  WhatsAppFlowDataEndpointError,
} from "./flow-endpoint.js";
import {
  loadWhatsAppFlowEndpointRuntime,
  WhatsAppFlowEndpointKeyError,
} from "./flow-endpoint-keys.js";
import {
  completeWhatsAppFlowEndpointRequest,
  hashWhatsAppFlowEndpointRequest,
  reserveWhatsAppFlowEndpointRequest,
  WhatsAppFlowEndpointRequestError,
} from "./flow-endpoint-requests.js";
import { verifyMetaSignature } from "./meta.js";

export const WHATSAPP_FLOW_ENDPOINT_MAX_BODY_BYTES = 64 * 1024;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const RESPONSE_HEADERS = Object.freeze({
  "Cache-Control": "no-store",
  "Content-Type": "text/plain; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
});

function textResponse(body, status, extraHeaders = {}) {
  return new Response(body || null, {
    status,
    headers: { ...RESPONSE_HEADERS, ...extraHeaders },
  });
}

function emptyResponse(status, extraHeaders) {
  return textResponse(null, status, extraHeaders);
}

function endpointScope(runtime) {
  const endpoint = runtime?.endpoint || runtime;
  const connection = runtime?.connection || endpoint?.connection;
  const project = runtime?.project || connection?.project;
  return {
    endpointId: runtime?.endpointId || endpoint?.id,
    connectionId: endpoint?.connectionId || connection?.id,
    organizationId: runtime?.organizationId || project?.organizationId,
    projectId: runtime?.projectId || connection?.projectId || project?.id,
    phoneNumberId: runtime?.phoneNumberId || connection?.phoneNumberId,
    metadata: runtime?.metadata ?? connection?.metadata,
    enabled: (runtime?.enabled ?? endpoint?.enabled) === true,
    connectionEnabled: (runtime?.connectionEnabled ?? connection?.enabled) === true,
    connectionStatus: runtime?.connectionStatus || connection?.connectionStatus,
  };
}

function runtimeCryptoKeys(runtime) {
  const keys = Array.isArray(runtime?.keys) ? runtime.keys : [];
  return keys.map((key) => ({
    ...key,
    privateKey: key.privateKey ?? key.privateKeyPem,
  }));
}

function safeCompletionCode(error) {
  const code = String(error?.code || "WHATSAPP_FLOW_ENDPOINT_INTERNAL_ERROR");
  return /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/.test(code)
    ? code
    : "WHATSAPP_FLOW_ENDPOINT_INTERNAL_ERROR";
}

function requestAction(payload) {
  const action = String(payload?.action || "UNKNOWN");
  return /^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(action) ? action : "UNKNOWN";
}

function requestScreen(payload) {
  const screen = String(payload?.screen || "");
  return /^[A-Z][A-Z0-9_]{0,29}$/.test(screen) ? screen : null;
}

async function finishRequest({
  prisma,
  reservation,
  status,
  responseStatus,
  responseCiphertext = null,
  failureCode = null,
  payload = null,
  key = null,
  session = null,
  now,
  completeRequest,
}) {
  if (!reservation?.record?.id || !reservation.record.leaseToken) return;
  const workerOnboardingFlowSessionId = session?.kind === "worker_onboarding"
    ? session.id
    : null;
  const flowSessionId = session?.kind === "worker_onboarding"
    ? null
    : session?.id || null;
  await completeRequest(prisma, {
    requestId: reservation.record.id,
    leaseToken: reservation.record.leaseToken,
    status,
    responseStatus,
    responseCiphertext,
    failureCode,
    action: requestAction(payload),
    screen: requestScreen(payload),
    keyVersion: Number.isSafeInteger(key?.version) ? key.version : null,
    flowSessionId,
    workerOnboardingFlowSessionId,
    completedAt: now,
  });
}

function publicKeyLookupStatus(error) {
  if (error?.status === 429) return 429;
  if (
    error instanceof WhatsAppFlowEndpointKeyError
    && error.code === "WHATSAPP_FLOW_KEY_ENDPOINT_NOT_FOUND"
  ) return 404;
  return 503;
}

export async function handleWhatsAppFlowDataEndpointRequest(
  request,
  {
    endpointId: rawEndpointId,
    prisma,
    appSecret,
    now = new Date(),
  },
  {
    loadRuntime = loadWhatsAppFlowEndpointRuntime,
    reserveRequest = reserveWhatsAppFlowEndpointRequest,
    completeRequest = completeWhatsAppFlowEndpointRequest,
    decryptRequest = decryptWhatsAppFlowRequest,
    encryptResponse = encryptWhatsAppFlowResponse,
    dispatchRequest = dispatchWhatsAppFlowDataRequest,
  } = {},
) {
  const endpointId = String(rawEndpointId || "").trim().toLowerCase();
  if (!UUID_PATTERN.test(endpointId)) return emptyResponse(404);
  if (typeof appSecret !== "string" || !appSecret) return emptyResponse(503);

  let rawBytes;
  try {
    rawBytes = await readLimitedRequestBytes(request, {
      maxBytes: WHATSAPP_FLOW_ENDPOINT_MAX_BODY_BYTES,
      requireJson: true,
    });
  } catch (error) {
    if (error instanceof RequestBodyError) return emptyResponse(error.status);
    return emptyResponse(400);
  }

  if (!verifyMetaSignature(
    rawBytes,
    request.headers.get("x-hub-signature-256"),
    appSecret,
  )) {
    return emptyResponse(432);
  }

  let envelope;
  try {
    envelope = JSON.parse(decodeUtf8RequestBytes(rawBytes));
  } catch {
    return emptyResponse(400);
  }

  let runtime;
  try {
    runtime = await loadRuntime(prisma, { endpointId, now });
  } catch (error) {
    return emptyResponse(publicKeyLookupStatus(error));
  }

  const requestSha256 = hashWhatsAppFlowEndpointRequest(rawBytes);
  let reservation;
  try {
    reservation = await reserveRequest(prisma, { endpointId, requestSha256, now });
  } catch (error) {
    if (error instanceof WhatsAppFlowEndpointRequestError && error.status === 429) {
      return emptyResponse(429, {
        "Retry-After": String(error.retryAfterSeconds || 60),
      });
    }
    return emptyResponse(error?.status === 503 ? 503 : 500);
  }
  if (reservation.state === "replay") {
    return textResponse(
      reservation.record.responseCiphertext,
      reservation.record.responseStatus || 500,
    );
  }
  if (reservation.state === "in_flight") {
    return emptyResponse(429, { "Retry-After": "1" });
  }

  let decrypted;
  try {
    decrypted = decryptRequest(envelope, { keys: runtimeCryptoKeys(runtime) });
  } catch (error) {
    const status = error instanceof WhatsAppFlowEndpointCryptoError ? error.status : 500;
    await finishRequest({
      prisma,
      reservation,
      status: "FAILED",
      responseStatus: status,
      failureCode: safeCompletionCode(error),
      now,
      completeRequest,
    }).catch(() => {});
    return emptyResponse(status);
  }

  let dispatched;
  try {
    dispatched = await dispatchRequest({
      payload: decrypted.payload,
      endpoint: endpointScope(runtime),
      prisma,
      appSecret,
      now,
    });
  } catch (error) {
    const knownEndpointError = error instanceof WhatsAppFlowDataEndpointError;
    const responseStatus = knownEndpointError ? error.status : 500;
    const journalSession = knownEndpointError ? error.journalSession : null;
    if (
      knownEndpointError
      && error.journalReplayPolicy === WHATSAPP_FLOW_JOURNAL_REPLAY_POLICY_RECOMPUTE
    ) {
      try {
        await finishRequest({
          prisma,
          reservation,
          status: "FAILED",
          responseStatus: 503,
          failureCode: safeCompletionCode(error),
          payload: decrypted.payload,
          key: decrypted.key,
          session: journalSession,
          now,
          completeRequest,
        });
      } catch {
        return emptyResponse(503, { "Retry-After": "1" });
      }
      // No AES-GCM ciphertext may be exposed here. The exact envelope must be
      // reclaimable after a fresh DB reconciliation query, and encrypting both
      // a provisional error and a later success would reuse Meta's nonce.
      return emptyResponse(503, { "Retry-After": "1" });
    }
    let responseCiphertext;
    try {
      responseCiphertext = encryptResponse({
        error_msg: responseStatus === 427
          ? "Esta solicitud venció. Volvé al chat para abrir una nueva."
          : "No se pudo procesar la solicitud.",
      }, {
        aesKey: decrypted.aesKey,
        initialVector: decrypted.initialVector,
      });
    } catch (encryptionError) {
      await finishRequest({
        prisma,
        reservation,
        status: "FAILED",
        responseStatus: 500,
        failureCode: safeCompletionCode(encryptionError),
        payload: decrypted.payload,
        key: decrypted.key,
        session: journalSession,
        now,
        completeRequest,
      }).catch(() => {});
      return emptyResponse(500);
    }
    try {
      await finishRequest({
        prisma,
        reservation,
        status: responseStatus >= 400 && responseStatus < 500 ? "REJECTED" : "FAILED",
        responseStatus,
        responseCiphertext,
        failureCode: safeCompletionCode(error),
        payload: decrypted.payload,
        key: decrypted.key,
        session: journalSession,
        now,
        completeRequest,
      });
    } catch {
      // Ciphertext is observable only after its durable commit is confirmed.
      // A retry then either replays the exact committed bytes or safely
      // recomputes an unobserved response after the abandoned lease expires.
      return emptyResponse(503);
    }
    return textResponse(responseCiphertext, responseStatus);
  }

  let responseCiphertext;
  try {
    responseCiphertext = encryptResponse(dispatched.response, {
      aesKey: decrypted.aesKey,
      initialVector: decrypted.initialVector,
    });
  } catch (error) {
    await finishRequest({
      prisma,
      reservation,
      status: "FAILED",
      responseStatus: 500,
      failureCode: safeCompletionCode(error),
      payload: decrypted.payload,
      key: decrypted.key,
      session: dispatched.session,
      now,
      completeRequest,
    }).catch(() => {});
    return emptyResponse(500);
  }

  try {
    await finishRequest({
      prisma,
      reservation,
      status: "SUCCEEDED",
      responseStatus: 200,
      responseCiphertext,
      payload: decrypted.payload,
      key: decrypted.key,
      session: dispatched.session,
      now,
      completeRequest,
    });
  } catch {
    return emptyResponse(503);
  }
  if (decrypted.key?.id && typeof prisma?.whatsAppFlowEndpointKey?.updateMany === "function") {
    await prisma.whatsAppFlowEndpointKey.updateMany({
      where: { id: decrypted.key.id, endpointId },
      data: { lastUsedAt: now },
    }).catch(() => {});
  }
  return textResponse(responseCiphertext, 200);
}
