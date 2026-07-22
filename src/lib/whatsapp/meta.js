import crypto from "node:crypto";
import { decryptCredential } from "../credentials.js";
import { whatsAppFlowTokenEvidence } from "./flow-sessions.js";

const MEDIA_POLICIES = Object.freeze({
  audio: {
    maxBytes: 16 * 1024 * 1024,
    mimeTypes: new Set(["audio/aac", "audio/mp4", "audio/mpeg", "audio/amr", "audio/ogg"]),
  },
  document: {
    maxBytes: 100 * 1024 * 1024,
    mimeTypes: new Set([
      "text/plain",
      "application/pdf",
      "application/msword",
      "application/vnd.ms-excel",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ]),
  },
  image: {
    maxBytes: 5 * 1024 * 1024,
    mimeTypes: new Set(["image/jpeg", "image/png"]),
  },
  sticker: {
    maxBytes: 100 * 1024,
    mimeTypes: new Set(["image/webp"]),
  },
  video: {
    maxBytes: 16 * 1024 * 1024,
    mimeTypes: new Set(["video/mp4", "video/3gpp"]),
  },
});

const META_MEDIA_HOST_SUFFIXES = [
  "facebook.com",
  "facebook.net",
  "fbcdn.net",
  "fbsbx.com",
];

export class MetaFlowDeliveryError extends Error {
  constructor(message, {
    code = "META_FLOW_DELIVERY_UNKNOWN",
    status = null,
    providerCode = null,
  } = {}) {
    super(message);
    this.name = "MetaFlowDeliveryError";
    this.code = code;
    this.status = status;
    this.providerCode = providerCode;
  }
}

function timingSafeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeMimeType(value) {
  return String(value || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
}

function requireMetaResourceId(value, name) {
  const normalized = String(value || "");
  if (!/^\d{5,40}$/.test(normalized)) {
    throw new Error(`Invalid Meta ${name}.`);
  }
  return normalized;
}

function mediaPolicy(kind, mimeType) {
  const normalizedKind = String(kind || "").toLowerCase();
  const policy = MEDIA_POLICIES[normalizedKind];
  if (!policy) throw new Error(`Unsupported WhatsApp media kind: ${normalizedKind || "unknown"}.`);

  const normalizedMimeType = normalizeMimeType(mimeType);
  if (!policy.mimeTypes.has(normalizedMimeType)) {
    throw new Error(`Unsupported WhatsApp ${normalizedKind} MIME type: ${normalizedMimeType || "unknown"}.`);
  }
  return { ...policy, kind: normalizedKind, mimeType: normalizedMimeType };
}

export function isAllowedMetaMediaUrl(value) {
  let url;
  try {
    url = value instanceof URL ? value : new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password) return false;

  const hostname = url.hostname.toLowerCase();
  return META_MEDIA_HOST_SUFFIXES.some(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
  );
}

export function verifyMetaSignature(rawBody, signatureHeader, appSecret) {
  if (!rawBody || !signatureHeader || !appSecret) return false;
  const [algorithm, providedSignature] = signatureHeader.split("=");
  if (algorithm !== "sha256" || !providedSignature) return false;

  const expectedSignature = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");
  return timingSafeEqual(expectedSignature, providedSignature);
}

export function verifyMetaSubscription(searchParams, verifyToken) {
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (
    mode !== "subscribe"
    || !verifyToken
    || !token
    || !timingSafeEqual(token, verifyToken)
    || !challenge
  ) {
    return { valid: false, challenge: null };
  }
  return { valid: true, challenge };
}

function safeJson(value) {
  if (!value || typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeFlowResponse(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { response: value, flowToken: null };
  }

  const { flow_token: rawFlowToken, ...response } = value;
  let flowToken = null;
  if (typeof rawFlowToken === "string") {
    try {
      flowToken = whatsAppFlowTokenEvidence(rawFlowToken);
    } catch {
      // Keep webhook ingestion durable and fail closed in the transactional
      // consumer. The raw token must never enter persisted payloads or logs.
    }
  }
  return { response, flowToken };
}

function normalizeInteractive(interactive) {
  if (!interactive) return { text: "", interactive: null };

  if (interactive.type === "button_reply") {
    return {
      text: interactive.button_reply?.title || interactive.button_reply?.id || "",
      interactive: { type: "button", ...interactive.button_reply },
    };
  }

  if (interactive.type === "list_reply") {
    return {
      text: interactive.list_reply?.title || interactive.list_reply?.id || "",
      interactive: { type: "list", ...interactive.list_reply },
    };
  }

  if (interactive.type === "nfm_reply") {
    const parsed = safeJson(interactive.nfm_reply?.response_json);
    const { response, flowToken } = normalizeFlowResponse(parsed);
    return {
      text: interactive.nfm_reply?.body || "Formulario de WhatsApp completado",
      interactive: {
        type: "flow",
        name: interactive.nfm_reply?.name || null,
        response,
        flowToken,
      },
    };
  }

  return { text: "Interacción de WhatsApp", interactive };
}

function sanitizedRawMessage(message, normalizedInteractive) {
  if (message?.interactive?.type !== "nfm_reply") return message;

  const {
    response_json: _rawResponse,
    flow_token: _unexpectedRawToken,
    ...safeNfmReply
  } = message.interactive.nfm_reply || {};
  return {
    ...message,
    interactive: {
      ...message.interactive,
      nfm_reply: {
        ...safeNfmReply,
        response_json: JSON.stringify(normalizedInteractive?.response ?? null),
      },
    },
  };
}

function normalizeMessage(message, value, contactNames) {
  const messageType = message.type || "unknown";
  const interactive = normalizeInteractive(message.interactive);
  const media = message[messageType] && ["image", "audio", "video", "document", "sticker"].includes(messageType)
    ? {
        id: message[messageType].id || null,
        mimeType: message[messageType].mime_type || null,
        filename: message[messageType].filename || null,
        caption: message[messageType].caption || null,
        sha256: message[messageType].sha256 || null,
      }
    : null;

  return {
    provider: "meta",
    eventType: "message",
    externalId: message.id,
    phoneNumberId: value.metadata?.phone_number_id || null,
    businessDisplayPhone: value.metadata?.display_phone_number || null,
    from: message.from || "",
    displayName: contactNames.get(message.from) || null,
    timestamp: message.timestamp ? new Date(Number(message.timestamp) * 1000) : new Date(),
    kind: messageType,
    text:
      message.text?.body ||
      interactive.text ||
      message.location?.name ||
      media?.caption ||
      "",
    location: message.location
      ? {
          latitude: Number(message.location.latitude),
          longitude: Number(message.location.longitude),
          name: message.location.name || null,
          address: message.location.address || null,
        }
      : null,
    media,
    interactive: interactive.interactive,
    context: message.context || null,
    raw: sanitizedRawMessage(message, interactive.interactive),
  };
}

function normalizeStatus(status, value) {
  return {
    provider: "meta",
    eventType: "status",
    externalId: `status:${status.id}:${status.status}:${status.timestamp || "unknown"}`,
    messageId: status.id,
    phoneNumberId: value.metadata?.phone_number_id || null,
    recipientId: status.recipient_id || null,
    status: status.status || "unknown",
    timestamp: status.timestamp ? new Date(Number(status.timestamp) * 1000) : new Date(),
    errors: status.errors || [],
    conversation: status.conversation || null,
    pricing: status.pricing || null,
    raw: status,
  };
}

const EMBEDDED_SIGNUP_WEBHOOK_FIELDS = new Set([
  "account_update",
  "account_review_update",
  "phone_number_name_update",
  "phone_number_quality_update",
  "message_template_status_update",
]);

function normalizeEmbeddedSignupChange(entry, change) {
  const value = change.value || {};
  const field = change.field;
  const signal = value.event || value.decision || value.status || "update";
  const resourceId = value.phone_number_id
    || value.message_template_id
    || value.display_phone_number
    || value.phone_number
    || entry.id
    || "unknown";
  const entryTime = Number(entry.time || 0);

  return {
    provider: "meta",
    eventType: "account",
    externalId: `account:${entry.id || "unknown"}:${field}:${signal}:${resourceId}:${entryTime || "unknown"}`,
    whatsappBusinessId: entry.id ? String(entry.id) : null,
    phoneNumberId: value.phone_number_id ? String(value.phone_number_id) : null,
    displayPhoneNumber: value.display_phone_number || value.phone_number || null,
    field,
    event: value.event || null,
    decision: value.decision || null,
    timestamp: entryTime ? new Date(entryTime * 1000) : new Date(),
    value,
    raw: {
      entryId: entry.id || null,
      entryTime: entry.time || null,
      field,
      value,
    },
  };
}

export function normalizeMetaWebhook(payload) {
  if (!payload || payload.object !== "whatsapp_business_account" || !Array.isArray(payload.entry)) {
    return [];
  }

  const events = [];
  for (const entry of payload.entry) {
    for (const change of entry.changes || []) {
      if (EMBEDDED_SIGNUP_WEBHOOK_FIELDS.has(change.field) && change.value) {
        events.push(normalizeEmbeddedSignupChange(entry, change));
        continue;
      }
      if (change.field !== "messages" || !change.value) continue;
      const value = change.value;
      const contactNames = new Map(
        (value.contacts || []).map((contact) => [
          contact.wa_id,
          contact.profile?.name || null,
        ]),
      );

      for (const message of value.messages || []) {
        if (message.id) events.push(normalizeMessage(message, value, contactNames));
      }
      for (const status of value.statuses || []) {
        if (status.id) events.push(normalizeStatus(status, value));
      }
    }
  }
  return events;
}

function requireMetaTenantScope(scope) {
  const organizationId = typeof scope?.organizationId === "string"
    ? scope.organizationId.trim()
    : "";
  const projectId = typeof scope?.projectId === "string"
    ? scope.projectId.trim()
    : "";
  if (!organizationId || !projectId) {
    throw new Error("WhatsApp tenant scope is required for phone-scoped credentials.");
  }
  return { organizationId, projectId };
}

async function requireMetaPhoneConfig(requestedPhoneNumberId, expectedScope) {
  const version = process.env.META_GRAPH_API_VERSION || "v25.0";
  const normalizedPhoneNumberId = requestedPhoneNumberId
    ? String(requestedPhoneNumberId).trim()
    : "";
  if (normalizedPhoneNumberId) {
    const { organizationId, projectId } = requireMetaTenantScope(expectedScope);
    if (!process.env.DATABASE_URL) {
      throw new Error("Durable WhatsApp credentials are required for phone-scoped delivery.");
    }
    const { getPrisma } = await import("@/lib/prisma");
    const connection = await getPrisma().whatsAppConnection.findFirst({
      where: {
        phoneNumberId: normalizedPhoneNumberId,
        projectId,
        enabled: true,
        connectionStatus: "CONNECTED",
        encryptedAccessToken: { not: null },
        project: { organizationId },
      },
      select: {
        phoneNumberId: true,
        projectId: true,
        enabled: true,
        connectionStatus: true,
        encryptedAccessToken: true,
        project: { select: { organizationId: true } },
      },
    });
    if (
      connection?.phoneNumberId === normalizedPhoneNumberId
      && connection.projectId === projectId
      && connection.project?.organizationId === organizationId
      && connection.enabled
      && connection.connectionStatus === "CONNECTED"
      && connection.encryptedAccessToken
    ) {
      return {
        version,
        accessToken: decryptCredential(connection.encryptedAccessToken),
        phoneNumberId: connection.phoneNumberId,
        appSecret: process.env.META_APP_SECRET || null,
      };
    }
    throw new Error("No active WhatsApp credential exists for this tenant project and phone number ID.");
  }

  const globalPhoneNumberId = process.env.META_PHONE_NUMBER_ID;
  const globalAccessToken = process.env.META_ACCESS_TOKEN;
  if (globalAccessToken && globalPhoneNumberId) {
    return {
      version,
      accessToken: globalAccessToken,
      phoneNumberId: globalPhoneNumberId,
      appSecret: process.env.META_APP_SECRET || null,
    };
  }
  throw new Error("No active WhatsApp credential exists for this phone number ID.");
}

async function readResponseWithLimit(response, maxBytes) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error(`WhatsApp media exceeds the ${maxBytes}-byte limit.`);
  }

  if (!response.body?.getReader) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxBytes) {
      throw new Error(`WhatsApp media exceeds the ${maxBytes}-byte limit.`);
    }
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel("WhatsApp media size limit exceeded").catch(() => {});
      throw new Error(`WhatsApp media exceeds the ${maxBytes}-byte limit.`);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, totalBytes);
}

async function fetchAllowedMetaMedia(url, accessToken, fetchImpl, redirectCount = 0) {
  if (!isAllowedMetaMediaUrl(url)) {
    throw new Error("Meta returned an untrusted media URL.");
  }
  if (redirectCount > 3) throw new Error("Meta media download exceeded the redirect limit.");

  const response = await fetchImpl(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
    redirect: "manual",
    signal: AbortSignal.timeout(45_000),
  });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location) throw new Error("Meta media redirect omitted its destination.");
    return fetchAllowedMetaMedia(new URL(location, url), accessToken, fetchImpl, redirectCount + 1);
  }
  return response;
}

export async function downloadWhatsAppMedia({
  mediaId,
  phoneNumberId: requestedPhoneNumberId,
  scope,
  expectedKind,
  expectedMimeType,
  expectedSha256,
  fetchImpl = fetch,
  credentials,
}) {
  const safeMediaId = requireMetaResourceId(mediaId, "media ID");
  const safePhoneNumberId = requireMetaResourceId(requestedPhoneNumberId, "phone number ID");
  const resolvedCredentials = credentials || await requireMetaPhoneConfig(safePhoneNumberId, scope);
  if (String(resolvedCredentials.phoneNumberId) !== safePhoneNumberId) {
    throw new Error("WhatsApp media credential scope mismatch.");
  }

  const graphUrl = new URL(
    `https://graph.facebook.com/${resolvedCredentials.version || "v25.0"}/${safeMediaId}`,
  );
  graphUrl.searchParams.set("phone_number_id", safePhoneNumberId);
  const appSecret = resolvedCredentials.appSecret || process.env.META_APP_SECRET;
  if (appSecret) {
    graphUrl.searchParams.set(
      "appsecret_proof",
      crypto.createHmac("sha256", appSecret).update(resolvedCredentials.accessToken).digest("hex"),
    );
  }

  const metadataResponse = await fetchImpl(graphUrl, {
    method: "GET",
    headers: { Authorization: `Bearer ${resolvedCredentials.accessToken}` },
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
  });
  const metadata = await metadataResponse.json().catch(() => ({}));
  if (!metadataResponse.ok) {
    throw new Error(`Meta media metadata lookup failed (${metadataResponse.status}).`);
  }
  if (String(metadata.id || "") !== safeMediaId) {
    throw new Error("Meta media metadata ID mismatch.");
  }

  const metadataMimeType = normalizeMimeType(metadata.mime_type);
  const webhookMimeType = normalizeMimeType(expectedMimeType);
  if (webhookMimeType && metadataMimeType !== webhookMimeType) {
    throw new Error("WhatsApp media MIME type changed between webhook and retrieval.");
  }
  const policy = mediaPolicy(expectedKind, metadataMimeType);

  const declaredSize = Number(metadata.file_size);
  if (!Number.isSafeInteger(declaredSize) || declaredSize < 0) {
    throw new Error("Meta media metadata omitted a valid file size.");
  }
  if (declaredSize > policy.maxBytes) {
    throw new Error(`WhatsApp ${policy.kind} exceeds the ${policy.maxBytes}-byte limit.`);
  }

  if (expectedSha256 && metadata.sha256 && !timingSafeEqual(expectedSha256, metadata.sha256)) {
    throw new Error("WhatsApp media SHA-256 changed between webhook and retrieval.");
  }

  const mediaResponse = await fetchAllowedMetaMedia(
    metadata.url,
    resolvedCredentials.accessToken,
    fetchImpl,
  );
  if (!mediaResponse.ok) {
    throw new Error(`Meta media download failed (${mediaResponse.status}).`);
  }
  const responseMimeType = normalizeMimeType(mediaResponse.headers.get("content-type"));
  if (responseMimeType && responseMimeType !== policy.mimeType) {
    throw new Error("Downloaded WhatsApp media MIME type does not match Meta metadata.");
  }

  const buffer = await readResponseWithLimit(mediaResponse, policy.maxBytes);
  if (buffer.length !== declaredSize) {
    throw new Error("Downloaded WhatsApp media size does not match Meta metadata.");
  }
  const computedSha256 = crypto.createHash("sha256").update(buffer).digest("base64");
  const trustedSha256 = metadata.sha256 || expectedSha256;
  if (trustedSha256 && !timingSafeEqual(trustedSha256, computedSha256)) {
    throw new Error("Downloaded WhatsApp media failed SHA-256 verification.");
  }

  return {
    id: safeMediaId,
    buffer,
    kind: policy.kind,
    mimeType: policy.mimeType,
    size: buffer.length,
    sha256: computedSha256,
  };
}

export class WhatsAppMetaSendError extends Error {
  constructor(message, {
    status = null,
    providerCode = null,
    ambiguous = false,
    cause,
  } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'WhatsAppMetaSendError';
    this.code = providerCode ? `META_${providerCode}` : 'META_SEND_FAILED';
    this.status = status;
    this.providerCode = providerCode;
    this.ambiguous = ambiguous;
  }
}

export async function sendWhatsAppText({
  to,
  text,
  replyToMessageId,
  phoneNumberId: requestedPhoneNumberId,
  scope,
  fetchImpl = fetch,
}) {
  const { version, accessToken, phoneNumberId, appSecret } = await requireMetaPhoneConfig(
    requestedPhoneNumberId,
    scope,
  );
  const url = new URL(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`);
  if (appSecret) {
    url.searchParams.set(
      "appsecret_proof",
      crypto.createHmac("sha256", appSecret).update(accessToken).digest("hex"),
    );
  }
  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body: text },
        ...(replyToMessageId ? { context: { message_id: replyToMessageId } } : {}),
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw new WhatsAppMetaSendError(
      'Meta did not confirm whether the text message was accepted.',
      { ambiguous: true, cause: error },
    );
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = String(result?.error?.message || "Meta rejected the text message.").slice(0, 500);
    throw new WhatsAppMetaSendError(`Meta send failed (${response.status}): ${message}`, {
      status: response.status,
      providerCode: result?.error?.code || null,
      ambiguous: response.status >= 500,
    });
  }
  return result;
}

function boundedFlowText(value, name, maxLength) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.length > maxLength) {
    throw new Error(`WhatsApp Flow ${name} must contain between 1 and ${maxLength} characters.`);
  }
  return normalized;
}

export function buildWhatsAppFlowMessage({
  to,
  flowId,
  flowToken,
  screenId,
  flowAction = 'navigate',
  flowData,
  header,
  body,
  footer,
  cta,
}) {
  const recipient = String(to || '').replace(/^\+/, '');
  if (!/^\d{8,20}$/.test(recipient)) throw new Error('Invalid WhatsApp Flow recipient.');
  const safeFlowId = requireMetaResourceId(flowId, 'Flow ID');
  const safeFlowAction = String(flowAction || '');
  if (!new Set(['navigate', 'data_exchange']).has(safeFlowAction)) {
    throw new Error('Invalid WhatsApp Flow action.');
  }
  const safeScreenId = String(screenId || '');
  if (safeFlowAction === 'navigate' && !/^[A-Z][A-Z0-9_]{0,29}$/.test(safeScreenId)) {
    throw new Error('Invalid WhatsApp Flow screen ID.');
  }
  const safeToken = String(flowToken || '');
  if (!/^[A-Za-z0-9._~-]{12,256}$/.test(safeToken)) {
    throw new Error('Invalid WhatsApp Flow session token.');
  }

  let flowActionPayload;
  if (safeFlowAction === 'navigate') {
    if (flowData !== undefined) {
      if (
        !flowData
        || typeof flowData !== 'object'
        || Array.isArray(flowData)
        || Object.keys(flowData).length === 0
      ) {
        throw new Error('WhatsApp Flow navigation data must be a non-empty object when provided.');
      }
      flowActionPayload = { screen: safeScreenId, data: flowData };
    } else {
      flowActionPayload = { screen: safeScreenId };
    }
  }

  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'interactive',
    interactive: {
      type: 'flow',
      header: { type: 'text', text: boundedFlowText(header, 'header', 60) },
      body: { text: boundedFlowText(body, 'body', 1_024) },
      footer: { text: boundedFlowText(footer, 'footer', 60) },
      action: {
        name: 'flow',
        parameters: {
          flow_message_version: '3',
          flow_action: safeFlowAction,
          flow_token: safeToken,
          flow_id: safeFlowId,
          flow_cta: boundedFlowText(cta, 'CTA', 20),
          ...(flowActionPayload ? { flow_action_payload: flowActionPayload } : {}),
        },
      },
    },
  };
}

const WHATSAPP_TEMPLATE_NAME_PATTERN = /^[a-z0-9_]{1,512}$/;
const WHATSAPP_TEMPLATE_LANGUAGE_PATTERN = /^[a-z]{2}_[A-Z]{2}$/;

function safeFlowActionData(value) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('WhatsApp Flow template action data must be an object.');
  }
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new Error('WhatsApp Flow template action data must be JSON serializable.');
  }
  if (serialized === '{}' || Buffer.byteLength(serialized, 'utf8') > 4_096) {
    throw new Error('WhatsApp Flow template action data must be non-empty and at most 4096 bytes.');
  }
  return JSON.parse(serialized);
}

export function buildWhatsAppFlowTemplateMessage({
  to,
  templateName,
  language = 'es_AR',
  flowToken,
  flowActionData,
}) {
  const recipient = String(to || '').replace(/^\+/, '');
  if (!/^\d{8,20}$/.test(recipient)) throw new Error('Invalid WhatsApp Flow recipient.');
  const safeTemplateName = String(templateName || '');
  if (!WHATSAPP_TEMPLATE_NAME_PATTERN.test(safeTemplateName)) {
    throw new Error('Invalid WhatsApp Flow template name.');
  }
  const safeLanguage = String(language || '');
  if (!WHATSAPP_TEMPLATE_LANGUAGE_PATTERN.test(safeLanguage)) {
    throw new Error('Invalid WhatsApp Flow template language.');
  }
  const safeToken = String(flowToken || '');
  if (!/^[A-Za-z0-9._~-]{12,256}$/.test(safeToken)) {
    throw new Error('Invalid WhatsApp Flow session token.');
  }
  const actionData = safeFlowActionData(flowActionData);

  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'template',
    template: {
      name: safeTemplateName,
      language: { code: safeLanguage },
      components: [
        {
          type: 'button',
          sub_type: 'flow',
          index: '0',
          parameters: [
            {
              type: 'action',
              action: {
                flow_token: safeToken,
                ...(actionData ? { flow_action_data: actionData } : {}),
              },
            },
          ],
        },
      ],
    },
  };
}

export async function sendWhatsAppFlow({
  phoneNumberId: requestedPhoneNumberId,
  scope,
  fetchImpl = fetch,
  credentials,
  ...messageInput
}) {
  const safePhoneNumberId = requireMetaResourceId(requestedPhoneNumberId, 'phone number ID');
  const resolved = credentials || await requireMetaPhoneConfig(safePhoneNumberId, scope);
  if (String(resolved.phoneNumberId) !== safePhoneNumberId) {
    throw new Error('WhatsApp Flow credential scope mismatch.');
  }
  const url = new URL(
    `https://graph.facebook.com/${resolved.version || 'v25.0'}/${safePhoneNumberId}/messages`,
  );
  const appSecret = resolved.appSecret || process.env.META_APP_SECRET;
  if (appSecret) {
    url.searchParams.set(
      'appsecret_proof',
      crypto.createHmac('sha256', appSecret).update(resolved.accessToken).digest('hex'),
    );
  }
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resolved.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildWhatsAppFlowMessage(messageInput)),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new MetaFlowDeliveryError(
      'Meta Flow delivery ended without a definitive provider response.',
    );
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const parsedProviderCode = Number(result?.error?.code);
    const providerCode = Number.isSafeInteger(parsedProviderCode)
      && parsedProviderCode > 0
      ? parsedProviderCode
      : null;
    const canFallback = response.status >= 400
      && response.status < 500
      && ![408, 425, 429].includes(response.status);
    throw new MetaFlowDeliveryError(
      `Meta Flow send failed (${response.status}${providerCode === null ? '' : `, code ${providerCode}`}).`,
      {
        code: canFallback
          ? 'META_FLOW_REJECTED'
          : 'META_FLOW_DELIVERY_RETRYABLE',
        status: response.status,
        providerCode,
      },
    );
  }
  return result;
}

export async function sendWhatsAppFlowTemplate({
  phoneNumberId: requestedPhoneNumberId,
  scope,
  fetchImpl = fetch,
  credentials,
  ...messageInput
}) {
  const safePhoneNumberId = requireMetaResourceId(requestedPhoneNumberId, 'phone number ID');
  const resolved = credentials || await requireMetaPhoneConfig(safePhoneNumberId, scope);
  if (String(resolved.phoneNumberId) !== safePhoneNumberId) {
    throw new Error('WhatsApp Flow template credential scope mismatch.');
  }
  const url = new URL(
    `https://graph.facebook.com/${resolved.version || 'v25.0'}/${safePhoneNumberId}/messages`,
  );
  const appSecret = resolved.appSecret || process.env.META_APP_SECRET;
  if (appSecret) {
    url.searchParams.set(
      'appsecret_proof',
      crypto.createHmac('sha256', appSecret).update(resolved.accessToken).digest('hex'),
    );
  }
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resolved.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildWhatsAppFlowTemplateMessage(messageInput)),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new MetaFlowDeliveryError(
      'Meta template delivery ended without a definitive provider response.',
      { code: 'META_FLOW_TEMPLATE_DELIVERY_UNKNOWN' },
    );
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const parsedProviderCode = Number(result?.error?.code);
    const providerCode = Number.isSafeInteger(parsedProviderCode)
      && parsedProviderCode > 0
      ? parsedProviderCode
      : null;
    const definitive = response.status >= 400
      && response.status < 500
      && ![408, 425, 429].includes(response.status);
    throw new MetaFlowDeliveryError(
      `Meta Flow template send failed (${response.status}${providerCode === null ? '' : `, code ${providerCode}`}).`,
      {
        code: definitive
          ? 'META_FLOW_TEMPLATE_REJECTED'
          : 'META_FLOW_TEMPLATE_DELIVERY_RETRYABLE',
        status: response.status,
        providerCode,
      },
    );
  }
  return result;
}
