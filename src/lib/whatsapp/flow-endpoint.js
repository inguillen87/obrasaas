import crypto from "node:crypto";

import { subscriptionAllowsWrites } from "../plans.js";
import {
  PROJECT_TASK_PROJECTION_SOURCE,
  snapshotTaskIdFromProjectionExternalId,
} from "../project-tasks.js";
import {
  getPublishedWhatsAppFlowReference,
  validateWhatsAppFlowReply,
  WhatsAppFlowReplyError,
} from "./flows.js";
import {
  authenticateWhatsAppFlowDataSession,
  WhatsAppFlowSessionError,
} from "./flow-sessions.js";

const ENDPOINT_PROTOCOL_VERSION = "3.0";
const SCREEN_PATTERN = /^[A-Z][A-Z0-9_]{0,29}$/;
const JWT_SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/;
const MAX_TOKEN_SIGNATURE_BYTES = 4 * 1024;
const ALLOWED_PAYLOAD_FIELDS = new Set([
  "version",
  "action",
  "flow_token",
  "flow_token_signature",
  "screen",
  "data",
]);

const ERROR_STATUS = Object.freeze({
  WHATSAPP_FLOW_ENDPOINT_REQUEST_INVALID: 400,
  WHATSAPP_FLOW_ENDPOINT_ACTION_UNSUPPORTED: 400,
  WHATSAPP_FLOW_ENDPOINT_SESSION_INVALID: 427,
  WHATSAPP_FLOW_ENDPOINT_CONTEXT_UNAVAILABLE: 427,
  WHATSAPP_FLOW_ENDPOINT_CONFIGURATION_INVALID: 500,
});

export class WhatsAppFlowDataEndpointError extends Error {
  constructor(message, code, { cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "WhatsAppFlowDataEndpointError";
    this.code = code;
    this.status = ERROR_STATUS[code] || 500;
  }
}

function endpointError(message, code, options) {
  return new WhatsAppFlowDataEndpointError(message, code, options);
}

function isPlainObject(value) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function constantTimeTextEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""), "utf8");
  const rightBuffer = Buffer.from(String(right || ""), "utf8");
  return leftBuffer.length === rightBuffer.length
    && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function parseJwtJson(segment) {
  if (
    typeof segment !== "string"
    || !segment
    || segment.length > MAX_TOKEN_SIGNATURE_BYTES
    || !JWT_SEGMENT_PATTERN.test(segment)
  ) return null;
  try {
    const decoded = Buffer.from(segment, "base64url");
    if (decoded.toString("base64url") !== segment) return null;
    const parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(decoded));
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Data API 4.0 optionally includes a JWT that binds the outer flow_token to
 * the Meta application. Meta documents HS256 and the flow_token claim only;
 * undocumented temporal/audience claims are intentionally not invented here.
 */
export function verifyWhatsAppFlowTokenSignature({
  signature,
  flowToken,
  appSecret,
}) {
  if (signature === undefined || signature === null || signature === "") {
    return { present: false, valid: false };
  }
  if (
    typeof signature !== "string"
    || Buffer.byteLength(signature, "utf8") > MAX_TOKEN_SIGNATURE_BYTES
    || typeof flowToken !== "string"
    || !flowToken
    || typeof appSecret !== "string"
    || !appSecret
  ) {
    throw endpointError(
      "WhatsApp Flow session is invalid.",
      "WHATSAPP_FLOW_ENDPOINT_SESSION_INVALID",
    );
  }

  const segments = signature.split(".");
  if (segments.length !== 3) {
    throw endpointError(
      "WhatsApp Flow session is invalid.",
      "WHATSAPP_FLOW_ENDPOINT_SESSION_INVALID",
    );
  }
  const [encodedHeader, encodedPayload, encodedSignature] = segments;
  const header = parseJwtJson(encodedHeader);
  const claims = parseJwtJson(encodedPayload);
  if (
    !header
    || header.alg !== "HS256"
    || !claims
    || typeof claims.flow_token !== "string"
    || !JWT_SEGMENT_PATTERN.test(encodedSignature)
  ) {
    throw endpointError(
      "WhatsApp Flow session is invalid.",
      "WHATSAPP_FLOW_ENDPOINT_SESSION_INVALID",
    );
  }

  const expected = crypto
    .createHmac("sha256", appSecret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");
  if (
    !constantTimeTextEqual(encodedSignature, expected)
    || !constantTimeTextEqual(claims.flow_token, flowToken)
  ) {
    throw endpointError(
      "WhatsApp Flow session is invalid.",
      "WHATSAPP_FLOW_ENDPOINT_SESSION_INVALID",
    );
  }
  return { present: true, valid: true };
}

function validatePayloadEnvelope(payload) {
  if (!isPlainObject(payload)) {
    throw endpointError(
      "WhatsApp Flow request must be an object.",
      "WHATSAPP_FLOW_ENDPOINT_REQUEST_INVALID",
    );
  }
  const unexpected = Object.keys(payload).filter((field) => !ALLOWED_PAYLOAD_FIELDS.has(field));
  if (unexpected.length > 0 || payload.version !== ENDPOINT_PROTOCOL_VERSION) {
    throw endpointError(
      "WhatsApp Flow request contract is invalid.",
      "WHATSAPP_FLOW_ENDPOINT_REQUEST_INVALID",
    );
  }
  if (typeof payload.action !== "string" || payload.action.length > 32) {
    throw endpointError(
      "WhatsApp Flow action is invalid.",
      "WHATSAPP_FLOW_ENDPOINT_REQUEST_INVALID",
    );
  }
  if (payload.screen !== undefined && !SCREEN_PATTERN.test(String(payload.screen))) {
    throw endpointError(
      "WhatsApp Flow screen is invalid.",
      "WHATSAPP_FLOW_ENDPOINT_REQUEST_INVALID",
    );
  }
  if (payload.data !== undefined && !isPlainObject(payload.data)) {
    throw endpointError(
      "WhatsApp Flow data is invalid.",
      "WHATSAPP_FLOW_ENDPOINT_REQUEST_INVALID",
    );
  }
  return payload;
}

function normalizedEndpointScope(endpoint) {
  const scope = {
    endpointId: String(endpoint?.endpointId || endpoint?.id || ""),
    connectionId: String(endpoint?.connectionId || ""),
    organizationId: String(endpoint?.organizationId || ""),
    projectId: String(endpoint?.projectId || ""),
    phoneNumberId: String(endpoint?.phoneNumberId || ""),
    metadata: endpoint?.metadata,
    enabled: endpoint?.enabled === true,
    connectionEnabled: endpoint?.connectionEnabled === true,
    connectionStatus: String(endpoint?.connectionStatus || ""),
  };
  if (
    !scope.endpointId
    || !scope.connectionId
    || !scope.organizationId
    || !scope.projectId
    || !/^\d{5,40}$/.test(scope.phoneNumberId)
  ) {
    throw endpointError(
      "WhatsApp Flow endpoint context is unavailable.",
      "WHATSAPP_FLOW_ENDPOINT_CONFIGURATION_INVALID",
    );
  }
  if (!scope.enabled || !scope.connectionEnabled || scope.connectionStatus !== "CONNECTED") {
    throw endpointError(
      "WhatsApp Flow session is no longer available.",
      "WHATSAPP_FLOW_ENDPOINT_CONTEXT_UNAVAILABLE",
    );
  }
  return scope;
}

function safeDisplayText(value, maxLength) {
  const text = String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, maxLength) : null;
}

function stableTaskWorkAreaId(projectId, taskId) {
  return `task_${crypto
    .createHash("sha256")
    .update(JSON.stringify([
      "obrasaas:whatsapp-flow:work-area",
      String(projectId),
      String(taskId),
    ]))
    .digest("hex")
    .slice(0, 24)}`;
}

function workAreaOptions(tasks, project) {
  const candidates = [];
  for (const task of tasks || []) {
    const taskRef = snapshotTaskIdFromProjectionExternalId(task?.externalId);
    const title = safeDisplayText(task?.title, 80);
    if (!taskRef || !title) continue;
    candidates.push({
      taskRef,
      title,
      assignee: safeDisplayText(task?.assignee, 24),
    });
  }
  const titleCounts = new Map();
  for (const candidate of candidates) {
    titleCounts.set(candidate.title, (titleCounts.get(candidate.title) || 0) + 1);
  }

  const options = [];
  const seenTaskIds = new Set();
  for (const candidate of candidates) {
    if (seenTaskIds.has(candidate.taskRef)) continue;
    seenTaskIds.add(candidate.taskRef);
    const optionId = stableTaskWorkAreaId(project?.id, candidate.taskRef);
    const duplicateSuffix = titleCounts.get(candidate.title) > 1
      ? ` · ${candidate.assignee ? `${candidate.assignee} · ` : ""}${optionId.slice(-6).toUpperCase()}`
      : "";
    const title = duplicateSuffix
      ? `${candidate.title.slice(0, 80 - duplicateSuffix.length)}${duplicateSuffix}`
      : candidate.title;
    options.push({
      id: optionId,
      title,
      taskRef: candidate.taskRef,
    });
    if (options.length === 20) break;
  }
  if (options.length === 0) {
    options.push({
      id: "project_site",
      title: safeDisplayText(project?.address, 80) || "Frente principal",
    });
  }
  return options;
}

export async function loadWhatsAppFlowTrustedContext(prisma, session) {
  if (
    typeof prisma?.project?.findFirst !== "function"
    || typeof prisma?.worker?.findFirst !== "function"
    || typeof prisma?.task?.findMany !== "function"
  ) {
    throw endpointError(
      "WhatsApp Flow endpoint persistence is unavailable.",
      "WHATSAPP_FLOW_ENDPOINT_CONFIGURATION_INVALID",
    );
  }
  const [project, worker, tasks] = await Promise.all([
    prisma.project.findFirst({
      where: {
        id: session.projectId,
        organizationId: session.organizationId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        address: true,
        organization: {
          select: {
            subscriptionPlan: true,
            subscriptionStatus: true,
            trialEndsAt: true,
          },
        },
      },
    }),
    prisma.worker.findFirst({
      where: {
        id: session.workerId,
        projectId: session.projectId,
        active: true,
      },
      select: { id: true, name: true },
    }),
    prisma.task.findMany({
      where: {
        projectId: session.projectId,
        externalId: { startsWith: "snapshot:" },
        metadata: { path: ["source"], equals: PROJECT_TASK_PROJECTION_SOURCE },
        status: { in: ["READY", "IN_PROGRESS", "BLOCKED"] },
      },
      orderBy: [{ status: "desc" }, { updatedAt: "desc" }],
      take: 40,
      select: { externalId: true, title: true, assignee: true },
    }),
  ]);

  if (!project || !worker || !subscriptionAllowsWrites(project.organization)) {
    throw endpointError(
      "WhatsApp Flow session is no longer available.",
      "WHATSAPP_FLOW_ENDPOINT_CONTEXT_UNAVAILABLE",
    );
  }
  return {
    project,
    worker,
    workAreas: workAreaOptions(tasks, project),
  };
}

function trustedScreenData(context) {
  return {
    project_name: safeDisplayText(context.project.name, 80) || "Obra",
    worker_name: safeDisplayText(context.worker.name, 80) || "Colaborador",
    work_areas: context.workAreas.map(({ id, title }) => ({ id, title })),
  };
}

function validateDynamicReply(session, data, context) {
  if (
    !isPlainObject(data)
    || Object.hasOwn(data, "flow_type")
    || Object.hasOwn(data, "task_ref")
  ) {
    throw endpointError(
      "WhatsApp Flow form data is invalid.",
      "WHATSAPP_FLOW_ENDPOINT_REQUEST_INVALID",
    );
  }
  const areaField = session.blueprintKey === "incident-report" ? "area" : "work_area";
  const selectedArea = context.workAreas.find((option) => option.id === data[areaField]);
  if (!selectedArea) {
    throw endpointError(
      "WhatsApp Flow work area is invalid.",
      "WHATSAPP_FLOW_ENDPOINT_REQUEST_INVALID",
    );
  }
  const normalizedData = {
    ...data,
    [areaField]: selectedArea.title,
    flow_type: session.flowType,
    ...(selectedArea.taskRef ? { task_ref: selectedArea.taskRef } : {}),
  };
  try {
    return validateWhatsAppFlowReply(session.blueprintKey, normalizedData);
  } catch (error) {
    if (!(error instanceof WhatsAppFlowReplyError)) throw error;
    throw endpointError(
      "WhatsApp Flow form data is invalid.",
      "WHATSAPP_FLOW_ENDPOINT_REQUEST_INVALID",
      { cause: error },
    );
  }
}

function assertDynamicPublishedSession(scope, session) {
  const published = getPublishedWhatsAppFlowReference(scope.metadata, session.blueprintKey);
  if (
    !published
    || published.flowAction !== "data_exchange"
    || published.id !== session.flowId
    || published.screenId !== session.screenId
    || published.flowType !== session.flowType
  ) {
    throw endpointError(
      "WhatsApp Flow session is no longer available.",
      "WHATSAPP_FLOW_ENDPOINT_CONTEXT_UNAVAILABLE",
    );
  }
  return published;
}

export async function dispatchWhatsAppFlowDataRequest({
  payload,
  endpoint,
  prisma,
  appSecret,
  now = new Date(),
}, {
  authenticateSession = authenticateWhatsAppFlowDataSession,
  loadTrustedContext = loadWhatsAppFlowTrustedContext,
} = {}) {
  const request = validatePayloadEnvelope(payload);
  const scope = normalizedEndpointScope(endpoint);

  if (request.action === "ping") {
    return { response: { data: { status: "active" } }, session: null, signaturePresent: false };
  }
  if (request.data?.error !== undefined) {
    return { response: { data: { acknowledged: true } }, session: null, signaturePresent: false };
  }
  if (!new Set(["INIT", "BACK", "data_exchange"]).has(request.action)) {
    throw endpointError(
      "WhatsApp Flow action is not supported.",
      "WHATSAPP_FLOW_ENDPOINT_ACTION_UNSUPPORTED",
    );
  }
  if (typeof request.flow_token !== "string" || !request.flow_token) {
    throw endpointError(
      "WhatsApp Flow session is invalid.",
      "WHATSAPP_FLOW_ENDPOINT_SESSION_INVALID",
    );
  }

  const tokenSignature = verifyWhatsAppFlowTokenSignature({
    signature: request.flow_token_signature,
    flowToken: request.flow_token,
    appSecret,
  });

  let authentication;
  try {
    authentication = await authenticateSession(prisma, {
      token: request.flow_token,
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      phoneNumberId: scope.phoneNumberId,
    }, { now });
  } catch (error) {
    if (!(error instanceof WhatsAppFlowSessionError)) throw error;
    throw endpointError(
      "WhatsApp Flow session is invalid.",
      "WHATSAPP_FLOW_ENDPOINT_SESSION_INVALID",
      { cause: error },
    );
  }
  const session = authentication?.session;
  if (!session) {
    throw endpointError(
      "WhatsApp Flow session is invalid.",
      "WHATSAPP_FLOW_ENDPOINT_SESSION_INVALID",
    );
  }
  assertDynamicPublishedSession(scope, session);
  const context = await loadTrustedContext(prisma, session);

  if (request.action === "INIT" || request.action === "BACK") {
    return {
      response: {
        screen: session.screenId,
        data: trustedScreenData(context),
      },
      session,
      signaturePresent: tokenSignature.present,
    };
  }
  if (request.screen !== session.screenId) {
    throw endpointError(
      "WhatsApp Flow screen transition is invalid.",
      "WHATSAPP_FLOW_ENDPOINT_REQUEST_INVALID",
    );
  }

  const validatedReply = validateDynamicReply(session, request.data, context);
  return {
    response: {
      screen: "SUCCESS",
      data: {
        extension_message_response: {
          params: {
            flow_token: request.flow_token,
            ...validatedReply,
          },
        },
      },
    },
    session,
    signaturePresent: tokenSignature.present,
  };
}
