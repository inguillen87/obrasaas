import crypto from "node:crypto";

import {
  subscriptionAllowsWrites,
  SubscriptionWriteBlockedError,
} from "../plans.js";
import { WorkerFinancialDataError } from "../worker-financial-data.js";
import { WorkerPaymentDestinationError } from "../worker-payment-destinations.js";
import { WorkerPrivacyChoiceError } from "../worker-privacy-choices.js";
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
import {
  submitAuthenticatedWorkerOnboardingFlow,
  WorkerOnboardingError,
} from "../worker-onboarding.js";
import {
  assertWorkerOnboardingPrivacyNoticeEvidence,
  WorkerOnboardingPrivacyNoticeError,
} from "../worker-onboarding-privacy-notices.js";
import {
  authenticateWorkerOnboardingFlowDataSession,
  markWorkerOnboardingFlowPrivacyPresented,
  WorkerOnboardingFlowSessionError,
} from "./worker-onboarding-flow-sessions.js";
import {
  completeWorkerPaymentFlowSubmission,
  loadWorkerPaymentFlowDataSession,
  markWorkerPaymentFlowPrivacyPresented,
  markWorkerPaymentFlowSubmissionUncertain,
  replayExpiredWorkerPaymentFlowSubmission,
  reserveWorkerPaymentFlowSubmission,
  WorkerPaymentFlowSessionError,
  WORKER_PAYMENT_FLOW_BLUEPRINT_KEY,
  WORKER_PAYMENT_FLOW_SCREEN_ID,
  WORKER_PAYMENT_FLOW_TYPE,
} from "./worker-payment-flow-sessions.js";
import {
  reconcileUncertainWorkerPaymentFlowSubmission,
} from "./worker-payment-flow-reconciliation.js";
import {
  submitWorkerPaymentDestinationFromWhatsAppFlow,
  WorkerPaymentFlowSubmissionError,
} from "./worker-payment-flow-submissions.js";

const ENDPOINT_PROTOCOL_VERSION = "3.0";
const SCREEN_PATTERN = /^[A-Z][A-Z0-9_]{0,29}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
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
const WORKER_ONBOARDING_TOKEN_PREFIX = "wofs1.";
const WORKER_ONBOARDING_BLUEPRINT_KEY = "worker-onboarding";
const WORKER_ONBOARDING_SCREEN_ID = "WORKER_ONBOARDING";
const WORKER_ONBOARDING_FORM_FIELDS = new Set([
  "given_names",
  "family_name",
  "cuil",
  "privacy_accepted",
]);

const ERROR_STATUS = Object.freeze({
  WHATSAPP_FLOW_ENDPOINT_REQUEST_INVALID: 400,
  WHATSAPP_FLOW_ENDPOINT_ACTION_UNSUPPORTED: 400,
  WHATSAPP_FLOW_ENDPOINT_SUBMISSION_CONFLICT: 409,
  WHATSAPP_FLOW_ENDPOINT_SESSION_INVALID: 427,
  WHATSAPP_FLOW_ENDPOINT_CONTEXT_UNAVAILABLE: 427,
  WHATSAPP_FLOW_ENDPOINT_RECONCILIATION_PENDING: 503,
  WHATSAPP_FLOW_ENDPOINT_CONFIGURATION_INVALID: 500,
});

export const WHATSAPP_FLOW_JOURNAL_REPLAY_POLICY_RECOMPUTE = "RECOMPUTE";

export class WhatsAppFlowDataEndpointError extends Error {
  constructor(message, code, { cause, journalSession, journalReplayPolicy } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "WhatsAppFlowDataEndpointError";
    this.code = code;
    this.status = ERROR_STATUS[code] || 500;
    const sessionId = String(journalSession?.id || "").trim().toLowerCase();
    if (journalSession?.kind === "worker_payment" && UUID_PATTERN.test(sessionId)) {
      Object.defineProperty(this, "journalSession", {
        configurable: false,
        enumerable: false,
        writable: false,
        value: Object.freeze({ id: sessionId, kind: "worker_payment" }),
      });
    }
    if (journalReplayPolicy === WHATSAPP_FLOW_JOURNAL_REPLAY_POLICY_RECOMPUTE) {
      Object.defineProperty(this, "journalReplayPolicy", {
        configurable: false,
        enumerable: false,
        writable: false,
        value: WHATSAPP_FLOW_JOURNAL_REPLAY_POLICY_RECOMPUTE,
      });
    }
  }
}

function endpointError(message, code, options) {
  return new WhatsAppFlowDataEndpointError(message, code, options);
}

function workerPaymentJournalError(error, session) {
  const journalSession = { id: session?.id, kind: "worker_payment" };
  if (error instanceof WhatsAppFlowDataEndpointError) {
    return endpointError(error.message, error.code, {
      cause: error.cause || error,
      journalSession,
      journalReplayPolicy: error.journalReplayPolicy,
    });
  }
  return endpointError(
    "WhatsApp Flow payment processing is unavailable.",
    "WHATSAPP_FLOW_ENDPOINT_CONFIGURATION_INVALID",
    { cause: error, journalSession },
  );
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

function assertWorkerOnboardingPublishedSession(scope, session) {
  const published = getPublishedWhatsAppFlowReference(
    scope.metadata,
    WORKER_ONBOARDING_BLUEPRINT_KEY,
  );
  if (
    !published
    || published.flowAction !== "data_exchange"
    || session.blueprintKey !== WORKER_ONBOARDING_BLUEPRINT_KEY
    || session.flowId !== published.id
    || session.screenId !== published.screenId
    || session.flowType !== published.flowType
  ) {
    throw endpointError(
      "WhatsApp Flow session is no longer available.",
      "WHATSAPP_FLOW_ENDPOINT_CONTEXT_UNAVAILABLE",
    );
  }
  return published;
}

function workerOnboardingExpiryLabel(expiresAt, timeZone) {
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) {
    throw endpointError(
      "WhatsApp Flow session is invalid.",
      "WHATSAPP_FLOW_ENDPOINT_SESSION_INVALID",
    );
  }
  let formatted;
  try {
    formatted = new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: String(timeZone || "America/Argentina/Buenos_Aires"),
    }).format(expiry);
  } catch {
    formatted = expiry.toISOString().slice(0, 16).replace("T", " ");
  }
  return `Esta invitación vence el ${formatted}.`;
}

async function loadWorkerOnboardingFlowTrustedContext(prisma, authentication) {
  if (typeof prisma?.project?.findFirst !== "function") {
    throw endpointError(
      "WhatsApp Flow endpoint persistence is unavailable.",
      "WHATSAPP_FLOW_ENDPOINT_CONFIGURATION_INVALID",
    );
  }
  const session = authentication?.session;
  const claim = authentication?.claim;
  const project = await prisma.project.findFirst({
    where: {
      id: session?.projectId,
      organizationId: session?.organizationId,
      status: { in: ["PLANNING", "ACTIVE", "PAUSED"] },
    },
    select: {
      id: true,
      name: true,
      organization: {
        select: {
          subscriptionPlan: true,
          subscriptionStatus: true,
          trialEndsAt: true,
          timezone: true,
        },
      },
    },
  });
  if (
    !project
    || !subscriptionAllowsWrites(project.organization)
    || !claim
    || claim.id !== session.claimId
    || !["PENDING", "SUBMITTED"].includes(String(claim.status || ""))
  ) {
    throw endpointError(
      "WhatsApp Flow session is no longer available.",
      "WHATSAPP_FLOW_ENDPOINT_CONTEXT_UNAVAILABLE",
    );
  }
  return { project, session, claim };
}

function workerOnboardingScreenData(context) {
  const notice = assertWorkerOnboardingPrivacyNoticeEvidence(
    context.session.noticeVersion,
    context.session.noticeContentSha256,
  );
  return {
    project_name: safeDisplayText(context.project.name, 80) || "Obra",
    privacy_notice_version: notice.version,
    privacy_notice_text: notice.content,
    expires_label: workerOnboardingExpiryLabel(
      context.session.expiresAt,
      context.project.organization.timezone,
    ),
  };
}

function workerOnboardingIdentity(data) {
  if (
    !isPlainObject(data)
    || Object.keys(data).length !== WORKER_ONBOARDING_FORM_FIELDS.size
    || Object.keys(data).some((field) => !WORKER_ONBOARDING_FORM_FIELDS.has(field))
    || data.privacy_accepted !== true
  ) {
    throw endpointError(
      "WhatsApp Flow form data is invalid.",
      "WHATSAPP_FLOW_ENDPOINT_REQUEST_INVALID",
    );
  }
  return {
    givenNames: data.given_names,
    familyName: data.family_name,
    cuil: data.cuil,
    privacyAccepted: true,
  };
}

async function dispatchWorkerOnboardingFlowDataRequest({
  request,
  scope,
  prisma,
  now,
  tokenSignature,
}, {
  authenticateOnboardingSession,
  presentOnboardingPrivacy,
  submitOnboardingFlow,
}) {
  let authentication;
  try {
    authentication = await authenticateOnboardingSession(prisma, {
      token: request.flow_token,
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      connectionId: scope.connectionId,
      phoneNumberId: scope.phoneNumberId,
    }, { now });
  } catch (error) {
    if (!(error instanceof WorkerOnboardingFlowSessionError)) throw error;
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
  assertWorkerOnboardingPublishedSession(scope, session);
  let authenticatedSession = session;

  if (request.action === "INIT") {
    let presentation;
    try {
      presentation = await presentOnboardingPrivacy(prisma, {
        tokenEvidence: authentication.tokenEvidence,
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        connectionId: scope.connectionId,
        phoneNumberId: scope.phoneNumberId,
      }, { now });
    } catch (error) {
      if (!(error instanceof WorkerOnboardingFlowSessionError)) throw error;
      throw endpointError(
        "WhatsApp Flow session is invalid.",
        "WHATSAPP_FLOW_ENDPOINT_SESSION_INVALID",
        { cause: error },
      );
    }
    if (!presentation?.session) {
      throw endpointError(
        "WhatsApp Flow privacy presentation could not be recorded.",
        "WHATSAPP_FLOW_ENDPOINT_CONFIGURATION_INVALID",
      );
    }
    authenticatedSession = presentation.session;
  }

  if (request.action === "data_exchange" && !authenticatedSession.privacyPresentedAt) {
    throw endpointError(
      "WhatsApp Flow privacy notice was not presented by INIT.",
      "WHATSAPP_FLOW_ENDPOINT_SESSION_INVALID",
    );
  }

  const context = await loadWorkerOnboardingFlowTrustedContext(prisma, {
    ...authentication,
    session: authenticatedSession,
  });

  if (request.action === "INIT" || request.action === "BACK") {
    let data;
    try {
      data = workerOnboardingScreenData(context);
    } catch (error) {
      if (!(error instanceof WorkerOnboardingPrivacyNoticeError)) throw error;
      throw endpointError(
        "WhatsApp Flow privacy notice configuration is invalid.",
        "WHATSAPP_FLOW_ENDPOINT_CONFIGURATION_INVALID",
        { cause: error },
      );
    }
    return {
      response: {
        screen: WORKER_ONBOARDING_SCREEN_ID,
        data,
      },
      session: { ...authenticatedSession, kind: "worker_onboarding" },
      signaturePresent: tokenSignature.present,
    };
  }
  if (request.screen !== WORKER_ONBOARDING_SCREEN_ID) {
    throw endpointError(
      "WhatsApp Flow screen transition is invalid.",
      "WHATSAPP_FLOW_ENDPOINT_REQUEST_INVALID",
    );
  }
  let submitted;
  try {
    submitted = await submitOnboardingFlow(prisma, {
      scope: {
        organizationId: scope.organizationId,
        projectId: scope.projectId,
      },
      connectionId: scope.connectionId,
      phoneNumberId: scope.phoneNumberId,
      claimId: authenticatedSession.claimId,
      sessionId: authenticatedSession.id,
      flowId: authenticatedSession.flowId,
      tokenSha256: authentication.tokenEvidence?.tokenSha256,
      identity: workerOnboardingIdentity(request.data),
      now,
    });
  } catch (error) {
    if (!(error instanceof WorkerOnboardingError) && !(error instanceof WorkerFinancialDataError)) {
      throw error;
    }
    const expired = error?.code === "WORKER_ONBOARDING_EXPIRED";
    const sessionChanged = error?.code === "WORKER_ONBOARDING_FLOW_SESSION_INVALID"
      || error?.code === "WORKER_ONBOARDING_STATE_CORRUPT";
    throw endpointError(
      expired
        ? "WhatsApp Flow session is no longer available."
        : sessionChanged
          ? "WhatsApp Flow session could not be finalized."
          : "WhatsApp Flow form data is invalid.",
      expired
        ? "WHATSAPP_FLOW_ENDPOINT_SESSION_INVALID"
        : sessionChanged
          ? "WHATSAPP_FLOW_ENDPOINT_CONFIGURATION_INVALID"
          : "WHATSAPP_FLOW_ENDPOINT_REQUEST_INVALID",
      { cause: error },
    );
  }

  return {
    response: {
      screen: "SUCCESS",
      data: {
        extension_message_response: {
          params: {
            flow_token: request.flow_token,
            flow_type: "worker_onboarding",
            claim_ref: submitted.id,
            submission_status: "submitted",
          },
        },
      },
    },
    session: { ...authenticatedSession, kind: "worker_onboarding" },
    signaturePresent: tokenSignature.present,
  };
}

function workerPaymentEndpointScope(scope, session) {
  return {
    flowSessionId: session.id,
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    connectionId: scope.connectionId,
    phoneNumberId: scope.phoneNumberId,
  };
}

function assertWorkerPaymentDataSession(baseSession, scope, loaded) {
  const session = loaded?.session;
  const paymentSession = loaded?.paymentSession;
  const notice = loaded?.notice;
  if (
    !session
    || !paymentSession
    || !notice
    || session.kind !== "worker_payment"
    || session.id !== baseSession.id
    || session.organizationId !== scope.organizationId
    || session.projectId !== scope.projectId
    || session.workerId !== baseSession.workerId
    || session.phoneNumberId !== scope.phoneNumberId
    || session.blueprintKey !== WORKER_PAYMENT_FLOW_BLUEPRINT_KEY
    || session.flowId !== baseSession.flowId
    || session.screenId !== WORKER_PAYMENT_FLOW_SCREEN_ID
    || session.flowType !== WORKER_PAYMENT_FLOW_TYPE
    || paymentSession.flowSessionId !== baseSession.id
    || paymentSession.organizationId !== scope.organizationId
    || paymentSession.projectId !== scope.projectId
    || paymentSession.connectionId !== scope.connectionId
    || paymentSession.workerId !== baseSession.workerId
    || paymentSession.noticeVersion !== notice.version
    || paymentSession.noticeContentSha256 !== notice.contentSha256
  ) {
    throw endpointError(
      "WhatsApp Flow payment session binding is invalid.",
      "WHATSAPP_FLOW_ENDPOINT_CONFIGURATION_INVALID",
    );
  }
  return { session, paymentSession, notice };
}

function workerPaymentExpiryLabel(expiresAt, timeZone) {
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) {
    throw endpointError(
      "WhatsApp Flow payment session is invalid.",
      "WHATSAPP_FLOW_ENDPOINT_CONFIGURATION_INVALID",
    );
  }
  let formatted;
  try {
    formatted = new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: String(timeZone || "America/Argentina/Buenos_Aires"),
    }).format(expiry);
  } catch {
    formatted = expiry.toISOString().slice(0, 16).replace("T", " ");
  }
  return `Este formulario vence el ${formatted}.`;
}

export async function loadWorkerPaymentFlowTrustedContext(
  prisma,
  session,
  paymentSession,
) {
  if (
    typeof prisma?.project?.findFirst !== "function"
    || typeof prisma?.worker?.findFirst !== "function"
  ) {
    throw endpointError(
      "WhatsApp Flow payment context persistence is unavailable.",
      "WHATSAPP_FLOW_ENDPOINT_CONFIGURATION_INVALID",
    );
  }
  const [project, worker] = await Promise.all([
    prisma.project.findFirst({
      where: {
        id: session.projectId,
        organizationId: session.organizationId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        organization: {
          select: {
            subscriptionPlan: true,
            subscriptionStatus: true,
            trialEndsAt: true,
            timezone: true,
          },
        },
      },
    }),
    prisma.worker.findFirst({
      where: {
        id: session.workerId,
        organizationId: session.organizationId,
        projectId: session.projectId,
        personId: paymentSession.personId,
        active: true,
      },
      select: { id: true, name: true, personId: true, active: true },
    }),
  ]);
  if (
    !project
    || !worker
    || worker.id !== session.workerId
    || worker.personId !== paymentSession.personId
    || worker.active !== true
    || !subscriptionAllowsWrites(project.organization)
  ) {
    throw endpointError(
      "WhatsApp Flow payment context is no longer available.",
      "WHATSAPP_FLOW_ENDPOINT_CONTEXT_UNAVAILABLE",
    );
  }
  return { project, worker };
}

function workerPaymentScreenData(context, paymentSession, notice) {
  return {
    project_name: safeDisplayText(context.project.name, 80) || "Obra",
    worker_name: safeDisplayText(context.worker.name, 80) || "Colaborador",
    capture_notice_version: notice.version,
    capture_notice_text: notice.content,
    expires_label: workerPaymentExpiryLabel(
      paymentSession.expiresAt,
      context.project.organization.timezone,
    ),
  };
}

function workerPaymentSessionEndpointError(error) {
  if (!(error instanceof WorkerPaymentFlowSessionError)) return null;
  if (
    error.code === "WORKER_PAYMENT_FLOW_SESSION_INPUT_INVALID"
    || error.code === "WORKER_PAYMENT_FLOW_SESSION_UNKNOWN_FIELDS"
  ) {
    return endpointError(
      "WhatsApp Flow payment form is invalid.",
      "WHATSAPP_FLOW_ENDPOINT_REQUEST_INVALID",
      { cause: error },
    );
  }
  if (
    error.code === "WORKER_PAYMENT_FLOW_SESSION_CONFLICT"
    || error.code === "WORKER_PAYMENT_FLOW_SESSION_OUTCOME_UNCERTAIN"
  ) {
    return endpointError(
      "WhatsApp Flow payment submission conflicts with its session.",
      "WHATSAPP_FLOW_ENDPOINT_SUBMISSION_CONFLICT",
      { cause: error },
    );
  }
  if (error.code === "WORKER_PAYMENT_FLOW_SESSION_SUBSCRIPTION_BLOCKED") {
    return endpointError(
      "WhatsApp Flow payment context is no longer available.",
      "WHATSAPP_FLOW_ENDPOINT_CONTEXT_UNAVAILABLE",
      { cause: error },
    );
  }
  if (
    error.code === "WORKER_PAYMENT_FLOW_SESSION_CONFIGURATION_INVALID"
    || error.code === "WORKER_PAYMENT_FLOW_SESSION_SECRET_INVALID"
    || error.code === "WORKER_PAYMENT_FLOW_SESSION_SECRET_REQUIRED"
  ) {
    return endpointError(
      "WhatsApp Flow payment configuration is unavailable.",
      "WHATSAPP_FLOW_ENDPOINT_CONFIGURATION_INVALID",
      { cause: error },
    );
  }
  return endpointError(
    "WhatsApp Flow payment session is no longer available.",
    "WHATSAPP_FLOW_ENDPOINT_SESSION_INVALID",
    { cause: error },
  );
}

function workerPaymentBridgeEndpointError(error) {
  if (error instanceof SubscriptionWriteBlockedError) {
    return endpointError(
      "WhatsApp Flow payment context is no longer available.",
      "WHATSAPP_FLOW_ENDPOINT_CONTEXT_UNAVAILABLE",
      { cause: error },
    );
  }
  const known = error instanceof WorkerPaymentFlowSubmissionError
    || error instanceof WorkerPaymentDestinationError
    || error instanceof WorkerPrivacyChoiceError
    || error instanceof WorkerFinancialDataError;
  if (!known) return null;
  const code = String(error.code || "");
  if (error.status >= 500 || code.includes("CONFIGURATION")) {
    return endpointError(
      "WhatsApp Flow payment persistence is unavailable.",
      "WHATSAPP_FLOW_ENDPOINT_CONFIGURATION_INVALID",
      { cause: error },
    );
  }
  if (error.status === 409) {
    return endpointError(
      "WhatsApp Flow payment submission conflicts with its session.",
      "WHATSAPP_FLOW_ENDPOINT_SUBMISSION_CONFLICT",
      { cause: error },
    );
  }
  if (/(SCOPE|CHANNEL|IDENTITY|ACTOR|NOT_FOUND|REATTESTATION)/.test(code)) {
    return endpointError(
      "WhatsApp Flow payment session is no longer available.",
      "WHATSAPP_FLOW_ENDPOINT_SESSION_INVALID",
      { cause: error },
    );
  }
  return endpointError(
    "WhatsApp Flow payment form is invalid.",
    "WHATSAPP_FLOW_ENDPOINT_REQUEST_INVALID",
    { cause: error },
  );
}

function validatedWorkerPaymentReceipt(receipt) {
  try {
    return validateWhatsAppFlowReply(WORKER_PAYMENT_FLOW_BLUEPRINT_KEY, {
      flow_type: receipt?.flow_type,
      destination_ref: receipt?.destination_ref,
      submission_status: receipt?.submission_status,
    });
  } catch (error) {
    if (!(error instanceof WhatsAppFlowReplyError)) throw error;
    throw endpointError(
      "WhatsApp Flow payment receipt is invalid.",
      "WHATSAPP_FLOW_ENDPOINT_CONFIGURATION_INVALID",
      { cause: error },
    );
  }
}

function workerPaymentSuccessResponse(flowToken, receipt) {
  return {
    screen: "SUCCESS",
    data: {
      extension_message_response: {
        params: {
          flow_token: flowToken,
          ...validatedWorkerPaymentReceipt(receipt),
        },
      },
    },
  };
}

function workerPaymentReconciliationPendingError(cause) {
  return endpointError(
    "WhatsApp Flow payment outcome is awaiting safe reconciliation.",
    "WHATSAPP_FLOW_ENDPOINT_RECONCILIATION_PENDING",
    {
      cause,
      journalReplayPolicy: WHATSAPP_FLOW_JOURNAL_REPLAY_POLICY_RECOMPUTE,
    },
  );
}

async function dispatchExpiredWorkerPaymentFlowReceipt({
  request,
  scope,
  prisma,
  tokenSignature,
  baseSession,
}, {
  replayExpiredPaymentSubmission,
  reconcilePaymentSubmission,
}) {
  if (
    request.action !== "data_exchange"
    || request.screen !== WORKER_PAYMENT_FLOW_SCREEN_ID
  ) {
    throw endpointError(
      "WhatsApp Flow expired payment replay is invalid.",
      "WHATSAPP_FLOW_ENDPOINT_SESSION_INVALID",
    );
  }
  const paymentScope = workerPaymentEndpointScope(scope, baseSession);
  try {
    await reconcilePaymentSubmission(prisma, {
      flowSessionId: baseSession.id,
      organizationId: paymentScope.organizationId,
    });
  } catch (error) {
    throw workerPaymentReconciliationPendingError(error);
  }
  let loaded;
  try {
    loaded = await replayExpiredPaymentSubmission(
      prisma,
      paymentScope,
      request.data,
    );
  } catch (error) {
    const mapped = workerPaymentSessionEndpointError(error);
    if (mapped) throw mapped;
    throw error;
  }
  const bound = assertWorkerPaymentDataSession(baseSession, scope, loaded);
  if (bound.paymentSession.submissionStatus !== "SUCCEEDED" || !loaded.receipt) {
    throw endpointError(
      "WhatsApp Flow expired payment result is unavailable.",
      "WHATSAPP_FLOW_ENDPOINT_SESSION_INVALID",
    );
  }
  return {
    response: workerPaymentSuccessResponse(request.flow_token, loaded.receipt),
    session: bound.session,
    signaturePresent: tokenSignature.present,
  };
}

async function dispatchWorkerPaymentFlowDataRequest({
  request,
  scope,
  prisma,
  now,
  tokenSignature,
  baseSession,
}, {
  loadPaymentSession,
  presentPaymentPrivacy,
  loadPaymentTrustedContext,
  reservePaymentSubmission,
  completePaymentSubmission,
  markPaymentSubmissionUncertain,
  reconcilePaymentSubmission,
  submitPaymentFlow,
}) {
  const paymentScope = workerPaymentEndpointScope(scope, baseSession);
  let loaded;
  try {
    loaded = request.action === "INIT" || request.action === "BACK"
      ? await presentPaymentPrivacy(prisma, paymentScope, { now })
      : await loadPaymentSession(prisma, paymentScope, { now });
  } catch (error) {
    const mapped = workerPaymentSessionEndpointError(error);
    if (mapped) throw mapped;
    throw error;
  }
  const bound = assertWorkerPaymentDataSession(baseSession, scope, loaded);

  const reconcileUncertainOutcome = async (cause, terminalError = null) => {
    let reconciliation;
    try {
      reconciliation = await reconcilePaymentSubmission(prisma, {
        flowSessionId: baseSession.id,
        organizationId: bound.paymentSession.organizationId,
      });
    } catch (reconciliationError) {
      throw workerPaymentReconciliationPendingError(reconciliationError);
    }
    const unresolved = Number(reconciliation?.awaitingOutcome || 0)
      + Number(reconciliation?.provenanceMismatches || 0);
    if (!reconciliation?.outcome && unresolved > 0) {
      if (terminalError) throw terminalError;
      throw endpointError(
        "WhatsApp Flow payment outcome requires audited resolution.",
        "WHATSAPP_FLOW_ENDPOINT_SUBMISSION_CONFLICT",
        { cause },
      );
    }
    try {
      const refreshed = await loadPaymentSession(prisma, paymentScope, { now });
      const refreshedBound = assertWorkerPaymentDataSession(baseSession, scope, refreshed);
      if (
        refreshedBound.paymentSession.submissionStatus === "SUCCEEDED"
        && refreshed.receipt
      ) {
        return refreshed.receipt;
      }
    } catch (reloadError) {
      throw workerPaymentReconciliationPendingError(reloadError);
    }
    if (terminalError) throw terminalError;
    throw endpointError(
      "WhatsApp Flow payment outcome requires audited resolution.",
      "WHATSAPP_FLOW_ENDPOINT_SUBMISSION_CONFLICT",
      { cause },
    );
  };

  if (request.action === "INIT" || request.action === "BACK") {
    if (bound.paymentSession.submissionStatus === "SUCCEEDED" && loaded.receipt) {
      return {
        response: workerPaymentSuccessResponse(request.flow_token, loaded.receipt),
        session: bound.session,
        signaturePresent: tokenSignature.present,
      };
    }
    if (bound.paymentSession.submissionStatus === "UNCERTAIN") {
      const receipt = await reconcileUncertainOutcome(
        new Error("Worker-payment Flow outcome remains uncertain."),
      );
      return {
        response: workerPaymentSuccessResponse(request.flow_token, receipt),
        session: bound.session,
        signaturePresent: tokenSignature.present,
      };
    }
    if (bound.paymentSession.submissionStatus !== "OPEN") {
      throw endpointError(
        "WhatsApp Flow payment outcome requires audited resolution.",
        "WHATSAPP_FLOW_ENDPOINT_SUBMISSION_CONFLICT",
      );
    }
    let context;
    try {
      context = await loadPaymentTrustedContext(
        prisma,
        bound.session,
        bound.paymentSession,
      );
    } catch (error) {
      if (error instanceof WhatsAppFlowDataEndpointError) throw error;
      throw endpointError(
        "WhatsApp Flow payment context is unavailable.",
        "WHATSAPP_FLOW_ENDPOINT_CONFIGURATION_INVALID",
        { cause: error },
      );
    }
    return {
      response: {
        screen: WORKER_PAYMENT_FLOW_SCREEN_ID,
        data: workerPaymentScreenData(context, bound.paymentSession, bound.notice),
      },
      session: bound.session,
      signaturePresent: tokenSignature.present,
    };
  }

  if (request.screen !== WORKER_PAYMENT_FLOW_SCREEN_ID) {
    throw endpointError(
      "WhatsApp Flow payment screen transition is invalid.",
      "WHATSAPP_FLOW_ENDPOINT_REQUEST_INVALID",
    );
  }
  if (!bound.paymentSession.privacyPresentedAt) {
    throw endpointError(
      "WhatsApp Flow payment privacy notice was not presented by INIT.",
      "WHATSAPP_FLOW_ENDPOINT_SESSION_INVALID",
    );
  }

  let reservation;
  try {
    reservation = await reservePaymentSubmission(prisma, paymentScope, request.data, { now });
  } catch (error) {
    const mapped = workerPaymentSessionEndpointError(error);
    if (mapped) throw mapped;
    throw error;
  }
  if (reservation?.state === "replay") {
    return {
      response: workerPaymentSuccessResponse(request.flow_token, reservation.receipt),
      session: bound.session,
      signaturePresent: tokenSignature.present,
    };
  }
  if (reservation?.state === "uncertain") {
    const receipt = await reconcileUncertainOutcome(
      new Error("Worker-payment Flow submission remains uncertain."),
    );
    return {
      response: workerPaymentSuccessResponse(request.flow_token, receipt),
      session: bound.session,
      signaturePresent: tokenSignature.present,
    };
  }
  if (
    !["reserved", "reconcile"].includes(reservation?.state)
    || typeof reservation.reservationId !== "string"
    || typeof reservation.operationKey !== "string"
    || reservation.flowSubmission?.reservationId !== reservation.reservationId
    || typeof reservation.flowSubmission?.fingerprintKeyId !== "string"
    || typeof reservation.flowSubmission?.fingerprintHmac !== "string"
  ) {
    throw endpointError(
      "WhatsApp Flow payment reservation is invalid.",
      "WHATSAPP_FLOW_ENDPOINT_CONFIGURATION_INVALID",
    );
  }

  const fenceUncertain = async (cause) => {
    let fenced;
    try {
      fenced = await markPaymentSubmissionUncertain(
        prisma,
        paymentScope,
        request.data,
        { reservationId: reservation.reservationId },
        { now },
      );
    } catch (fenceError) {
      throw workerPaymentReconciliationPendingError(fenceError);
    }
    if (fenced?.state === "replay" && fenced.receipt) return fenced.receipt;
    void cause;
    return null;
  };

  let submission;
  try {
    submission = await submitPaymentFlow(prisma, {
      scope: {
        organizationId: bound.paymentSession.organizationId,
        projectId: bound.paymentSession.projectId,
        workerId: bound.paymentSession.workerId,
        personId: bound.paymentSession.personId,
        channelIdentityId: bound.paymentSession.channelIdentityId,
      },
      form: request.data,
      notice: {
        version: bound.paymentSession.noticeVersion,
        contentSha256: bound.paymentSession.noticeContentSha256,
        presentedAt: bound.paymentSession.privacyPresentedAt,
      },
      operationKey: reservation.operationKey,
      flowSubmission: reservation.flowSubmission,
      correlationId: `worker-payment-flow:${baseSession.id}:${reservation.reservationId}`,
      now,
    });
  } catch (error) {
    const mapped = workerPaymentBridgeEndpointError(error);
    // Every failure after the OPEN -> PROCESSING reservation is terminally
    // fenced, including deterministic validation/scope failures. Otherwise a
    // replay would keep invoking the bridge against a stranded reservation.
    const fencedReceipt = await fenceUncertain(error);
    const receipt = fencedReceipt || await reconcileUncertainOutcome(error, mapped);
    return {
      response: workerPaymentSuccessResponse(request.flow_token, receipt),
      session: bound.session,
      signaturePresent: tokenSignature.present,
    };
  }

  let completed;
  try {
    completed = await completePaymentSubmission(
      prisma,
      paymentScope,
      request.data,
      {
        reservationId: reservation.reservationId,
        destinationId: submission?.destinationRef,
      },
    );
  } catch (error) {
    const fencedReceipt = await fenceUncertain(error);
    const receipt = fencedReceipt || await reconcileUncertainOutcome(error);
    return {
      response: workerPaymentSuccessResponse(request.flow_token, receipt),
      session: bound.session,
      signaturePresent: tokenSignature.present,
    };
  }
  return {
    response: workerPaymentSuccessResponse(request.flow_token, completed?.receipt),
    // The request journal is intentionally anchored to the generic, already
    // HMAC-authenticated Flow session UUID. The payment companion is 1:1 but
    // must never be allowed to redirect that transport audit relationship.
    session: bound.session,
    signaturePresent: tokenSignature.present,
  };
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
  authenticateOnboardingSession = authenticateWorkerOnboardingFlowDataSession,
  presentOnboardingPrivacy = markWorkerOnboardingFlowPrivacyPresented,
  submitOnboardingFlow = submitAuthenticatedWorkerOnboardingFlow,
  loadPaymentSession = loadWorkerPaymentFlowDataSession,
  presentPaymentPrivacy = markWorkerPaymentFlowPrivacyPresented,
  loadPaymentTrustedContext = loadWorkerPaymentFlowTrustedContext,
  reservePaymentSubmission = reserveWorkerPaymentFlowSubmission,
  completePaymentSubmission = completeWorkerPaymentFlowSubmission,
  markPaymentSubmissionUncertain = markWorkerPaymentFlowSubmissionUncertain,
  reconcilePaymentSubmission = reconcileUncertainWorkerPaymentFlowSubmission,
  replayExpiredPaymentSubmission = replayExpiredWorkerPaymentFlowSubmission,
  submitPaymentFlow = submitWorkerPaymentDestinationFromWhatsAppFlow,
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

  if (request.flow_token.startsWith(WORKER_ONBOARDING_TOKEN_PREFIX)) {
    return dispatchWorkerOnboardingFlowDataRequest({
      request,
      scope,
      prisma,
      now,
      tokenSignature,
    }, {
      authenticateOnboardingSession,
      presentOnboardingPrivacy,
      submitOnboardingFlow,
    });
  }

  let authentication;
  let expiredPaymentReplay = false;
  try {
    authentication = await authenticateSession(prisma, {
      token: request.flow_token,
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      phoneNumberId: scope.phoneNumberId,
    }, { now });
  } catch (error) {
    if (!(error instanceof WhatsAppFlowSessionError)) throw error;
    if (
      error.code === "WHATSAPP_FLOW_SESSION_EXPIRED"
      && request.action === "data_exchange"
      && request.screen === WORKER_PAYMENT_FLOW_SCREEN_ID
    ) {
      try {
        authentication = await authenticateSession(prisma, {
          token: request.flow_token,
          organizationId: scope.organizationId,
          projectId: scope.projectId,
          phoneNumberId: scope.phoneNumberId,
        }, { now, allowExpired: true });
        expiredPaymentReplay = true;
      } catch (recoveryError) {
        if (!(recoveryError instanceof WhatsAppFlowSessionError)) throw recoveryError;
        throw endpointError(
          "WhatsApp Flow session is invalid.",
          "WHATSAPP_FLOW_ENDPOINT_SESSION_INVALID",
          { cause: recoveryError },
        );
      }
    } else {
      throw endpointError(
        "WhatsApp Flow session is invalid.",
        "WHATSAPP_FLOW_ENDPOINT_SESSION_INVALID",
        { cause: error },
      );
    }
  }
  const session = authentication?.session;
  if (!session) {
    throw endpointError(
      "WhatsApp Flow session is invalid.",
      "WHATSAPP_FLOW_ENDPOINT_SESSION_INVALID",
    );
  }
  if (expiredPaymentReplay && session.blueprintKey !== WORKER_PAYMENT_FLOW_BLUEPRINT_KEY) {
    throw endpointError(
      "WhatsApp Flow expired session is not replayable.",
      "WHATSAPP_FLOW_ENDPOINT_SESSION_INVALID",
    );
  }
  assertDynamicPublishedSession(scope, session);
  if (session.blueprintKey === WORKER_PAYMENT_FLOW_BLUEPRINT_KEY) {
    try {
      if (expiredPaymentReplay) {
        return await dispatchExpiredWorkerPaymentFlowReceipt({
          request,
          scope,
          prisma,
          tokenSignature,
          baseSession: session,
        }, { replayExpiredPaymentSubmission, reconcilePaymentSubmission });
      }
      return await dispatchWorkerPaymentFlowDataRequest({
        request,
        scope,
        prisma,
        now,
        tokenSignature,
        baseSession: session,
      }, {
        loadPaymentSession,
        presentPaymentPrivacy,
        loadPaymentTrustedContext,
        reservePaymentSubmission,
        completePaymentSubmission,
        markPaymentSubmissionUncertain,
        reconcilePaymentSubmission,
        submitPaymentFlow,
      });
    } catch (error) {
      // Preserve only the authenticated generic Flow UUID for the transport
      // journal. No form values, tokens, or payment companion data cross this
      // error boundary.
      throw workerPaymentJournalError(error, session);
    }
  }
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
