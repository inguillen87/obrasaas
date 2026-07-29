import { randomUUID } from "node:crypto";

import { getPrisma } from "@/lib/prisma";
import * as progressEvidenceCaptureSessions from "@/lib/progress-evidence-capture-sessions";
import {
  isProgressEvidenceLocationRateLimitError,
  reserveProgressEvidenceLocationRequest,
} from "@/lib/progress-evidence-location-rate-limit";
import {
  RequestBodyError,
  readJsonRequest,
} from "@/lib/request-body";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 12 * 1_024;
const MAX_ID_LENGTH = 191;
const MAX_TOKEN_LENGTH = 4_096;
const MIN_ACCURACY_METERS = 0.01;
const MAX_ACCURACY_METERS = 10_000;
const COMMON_BODY_FIELDS = [
  "action",
  "worker",
  "session",
  "token",
];
const CAPTURE_BODY_FIELDS = new Set([
  ...COMMON_BODY_FIELDS,
  "idempotencyKey",
  "privacyAccepted",
  "noticeVersion",
  "noticeContentSha256",
  "latitude",
  "longitude",
  "accuracyMeters",
  "capturedAt",
]);
const INIT_BODY_FIELDS = new Set(COMMON_BODY_FIELDS);
const CANCEL_BODY_FIELDS = new Set(COMMON_BODY_FIELDS);
const ACTIONS = new Set(["INIT", "CAPTURE", "CANCEL"]);
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const SAFE_ERROR_CODE_PATTERN = /^(?:PROGRESS_EVIDENCE_|LOCATION_|IDEMPOTENCY_|SUBSCRIPTION_|WORKER_|LINK_)[A-Z0-9_]{1,95}$/;
const SAFE_ERROR_STATUSES = new Set([400, 401, 402, 403, 404, 408, 409, 410, 422, 429, 503]);
const CAPTURED_SESSION_STATUSES = new Set(["LOCATION_CAPTURED", "CONSUMED"]);
const INIT_SESSION_STATUSES = new Set(["AWAITING_LOCATION", "LOCATION_CAPTURED", "CANCELLED"]);
const LOCATION_VERIFICATIONS = new Set(["IN_GEOFENCE", "REVIEW_REQUIRED"]);
const CORRELATION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RESPONSE_HEADERS = Object.freeze({
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
});

class ProgressEvidenceLocationRouteError extends Error {
  constructor(message, code = "PROGRESS_EVIDENCE_LOCATION_REQUEST_INVALID", status = 400) {
    super(message);
    this.name = "ProgressEvidenceLocationRouteError";
    this.code = code;
    this.status = status;
  }
}

function locationResponse(
  payload,
  { status = 200, correlationId = null, retryAfterSeconds = null } = {},
) {
  const headers = {
    ...RESPONSE_HEADERS,
    ...(Number.isSafeInteger(retryAfterSeconds) && retryAfterSeconds > 0
      ? { "Retry-After": String(retryAfterSeconds) }
      : {}),
    ...(CORRELATION_ID_PATTERN.test(correlationId || "")
      ? { "X-Correlation-Id": correlationId }
      : {}),
  };
  return Response.json(payload, { status, headers });
}

function invalidRequest(message, code = "PROGRESS_EVIDENCE_LOCATION_REQUEST_INVALID") {
  throw new ProgressEvidenceLocationRouteError(message, code, 400);
}

function exactString(input, field, maxLength) {
  const value = input[field];
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > maxLength
    || value.trim() !== value
  ) {
    invalidRequest(`El campo ${field} no es válido.`);
  }
  return value;
}

function boundedNumber(input, field, minimum, maximum) {
  const value = input[field];
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    invalidRequest(
      "La ubicación recibida no es válida.",
      "PROGRESS_EVIDENCE_LOCATION_INVALID",
    );
  }
  return value;
}

function exactCaptureTime(value) {
  if (typeof value !== "string" || value.length > 40) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  const canonical = new Date(timestamp).toISOString();
  return canonical === value ? canonical : null;
}

export function parseProgressEvidenceLocationInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    invalidRequest("El cuerpo de la solicitud no es válido.");
  }
  const action = typeof input.action === "string" ? input.action : "";
  if (!ACTIONS.has(action)) {
    invalidRequest(
      "La acción solicitada no es válida.",
      "PROGRESS_EVIDENCE_LOCATION_ACTION_INVALID",
    );
  }
  const allowedFields = action === "CAPTURE"
    ? CAPTURE_BODY_FIELDS
    : action === "INIT"
      ? INIT_BODY_FIELDS
      : CANCEL_BODY_FIELDS;
  const keys = Object.keys(input);
  if (keys.length !== allowedFields.size || keys.some((field) => !allowedFields.has(field))) {
    invalidRequest(
      "La solicitud contiene campos faltantes o no permitidos.",
      "PROGRESS_EVIDENCE_LOCATION_FIELDS_INVALID",
    );
  }

  const worker = exactString(input, "worker", MAX_ID_LENGTH);
  const session = exactString(input, "session", MAX_ID_LENGTH);
  const token = exactString(input, "token", MAX_TOKEN_LENGTH);
  if (action === "INIT" || action === "CANCEL") {
    return { action, worker, session, token };
  }
  const idempotencyKey = exactString(input, "idempotencyKey", 128);
  if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
    invalidRequest(
      "La identidad de la operación no es válida.",
      "IDEMPOTENCY_KEY_INVALID",
    );
  }
  const noticeVersion = exactString(input, "noticeVersion", 80);
  const noticeContentSha256 = exactString(input, "noticeContentSha256", 64).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(noticeContentSha256) || input.privacyAccepted !== true) {
    invalidRequest(
      "Confirmá la autorización de lectura puntual antes de continuar.",
      "PROGRESS_EVIDENCE_LOCATION_NOTICE_REQUIRED",
    );
  }
  const capturedAt = exactCaptureTime(input.capturedAt);
  if (!capturedAt) {
    invalidRequest(
      "La hora de captura de la ubicación no es válida.",
      "PROGRESS_EVIDENCE_LOCATION_CAPTURE_TIME_INVALID",
    );
  }

  return {
    action,
    worker,
    session,
    token,
    idempotencyKey,
    privacyAccepted: true,
    noticeVersion,
    noticeContentSha256,
    latitude: boundedNumber(input, "latitude", -90, 90),
    longitude: boundedNumber(input, "longitude", -180, 180),
    accuracyMeters: boundedNumber(
      input,
      "accuracyMeters",
      MIN_ACCURACY_METERS,
      MAX_ACCURACY_METERS,
    ),
    capturedAt,
  };
}

function typedErrorMessage(status) {
  if (status === 401 || status === 403) {
    return "El enlace ya no es válido o no autoriza esta captura.";
  }
  if (status === 402) {
    return "La organización está en modo lectura y no puede guardar esta ubicación.";
  }
  if (status === 404 || status === 410) {
    return "La sesión de ubicación ya no está disponible. Pedí un enlace nuevo.";
  }
  if (status === 408 || status === 429 || status === 503) {
    return "No pudimos confirmar la captura en este momento. Reintentá la misma solicitud.";
  }
  if (status === 409) {
    return "La sesión cambió o la solicitud no coincide. Reintentá o pedí un enlace nuevo.";
  }
  if (status === 422) {
    return "No pudimos validar esta lectura de ubicación. Obtené una nueva y reintentá.";
  }
  return "No pudimos procesar la ubicación enviada.";
}

export function progressEvidenceLocationErrorResponse(error, { correlationId = null } = {}) {
  if (error instanceof RequestBodyError || error instanceof ProgressEvidenceLocationRouteError) {
    return locationResponse(
      { error: error.message, code: error.code },
      { status: error.status, correlationId },
    );
  }

  if (isProgressEvidenceLocationRateLimitError(error)) {
    const status = Number(error.status);
    const code = typeof error.code === "string" && SAFE_ERROR_CODE_PATTERN.test(error.code)
      ? error.code
      : null;
    if (code && SAFE_ERROR_STATUSES.has(status)) {
      const retryAfterSeconds = (status === 429 || status === 503)
        && Number.isSafeInteger(Number(error.retryAfterSeconds))
        && Number(error.retryAfterSeconds) > 0
        ? Number(error.retryAfterSeconds)
        : status === 429
          ? 60
          : null;
      return locationResponse(
        { error: typedErrorMessage(status), code },
        {
          status,
          correlationId,
          retryAfterSeconds,
        },
      );
    }
  }

  const isCaptureSessionError = typeof progressEvidenceCaptureSessions
    .isProgressEvidenceCaptureSessionError === "function"
    && progressEvidenceCaptureSessions.isProgressEvidenceCaptureSessionError(error);
  const status = Number(error?.status);
  const code = typeof error?.code === "string" && SAFE_ERROR_CODE_PATTERN.test(error.code)
    ? error.code
    : null;
  if (isCaptureSessionError && code && SAFE_ERROR_STATUSES.has(status)) {
    return locationResponse(
      { error: typedErrorMessage(status), code },
      { status, correlationId },
    );
  }
  return locationResponse(
    {
      error: "No pudimos vincular la ubicación con esta foto.",
      code: "PROGRESS_EVIDENCE_LOCATION_CAPTURE_FAILED",
    },
    { status: 500, correlationId },
  );
}

export function successfulProgressEvidenceLocationResponse(
  action,
  result,
  { correlationId = null } = {},
) {
  const status = result?.session?.status;
  if (action === "CANCEL") {
    if (status !== "CANCELLED") {
      throw new Error("Progress evidence cancellation returned an invalid result.");
    }
    return locationResponse({
      success: true,
      action,
      outcome: result.replayed === true ? "REPLAYED" : "RECORDED",
      status,
    }, { correlationId });
  }
  const locationVerification = result?.session?.locationVerification;
  if (
    action !== "CAPTURE"
    || !CAPTURED_SESSION_STATUSES.has(status)
    || !LOCATION_VERIFICATIONS.has(locationVerification)
  ) throw new Error("Progress evidence capture returned an invalid result.");
  return locationResponse({
    success: true,
    action,
    outcome: result.replayed === true ? "REPLAYED" : "RECORDED",
    status,
    locationVerification,
  }, { correlationId });
}

function safeDtoString(value, maxLength) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
}

function safeDtoExpiration(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function successfulProgressEvidenceLocationInitResponse(
  result,
  { workerId, sessionId, correlationId = null } = {},
) {
  const captureSession = result?.session;
  const worker = captureSession?.worker;
  const project = captureSession?.project;
  const notice = captureSession?.notice;
  const status = captureSession?.status;
  const workerName = safeDtoString(worker?.name, 180);
  const projectName = safeDtoString(project?.name, 180);
  const noticeVersion = safeDtoString(notice?.version, 80);
  const noticeContent = safeDtoString(notice?.content, 2_000);
  const noticeContentSha256 = typeof notice?.contentSha256 === "string"
    ? notice.contentSha256.toLowerCase()
    : "";
  const expiresAt = safeDtoExpiration(captureSession?.expiresAt);
  const locationVerification = captureSession?.locationVerification ?? null;
  const validVerification = status === "LOCATION_CAPTURED"
    ? LOCATION_VERIFICATIONS.has(locationVerification)
    : locationVerification === null;

  if (
    captureSession?.id !== sessionId
    || captureSession?.workerId !== workerId
    || worker?.id !== workerId
    || !safeDtoString(project?.id, MAX_ID_LENGTH)
    || !INIT_SESSION_STATUSES.has(status)
    || !validVerification
    || !workerName
    || !projectName
    || !noticeVersion
    || !noticeContent
    || !/^[a-f0-9]{64}$/.test(noticeContentSha256)
    || !expiresAt
  ) {
    throw new Error("Progress evidence initialization returned an invalid result.");
  }

  return locationResponse({
    success: true,
    action: "INIT",
    worker: { id: workerId, name: workerName },
    project: { id: project.id, name: projectName },
    notice: {
      version: noticeVersion,
      content: noticeContent,
      contentSha256: noticeContentSha256,
    },
    expiresAt,
    status,
    locationVerification,
  }, { correlationId });
}

export async function POST(request) {
  const correlationId = randomUUID();
  try {
    if (new URL(request.url).searchParams.size !== 0) {
      invalidRequest(
        "No se permiten parámetros en la URL de esta operación.",
        "PROGRESS_EVIDENCE_LOCATION_URL_FIELDS_FORBIDDEN",
      );
    }
    const input = parseProgressEvidenceLocationInput(
      await readJsonRequest(request, { maxBytes: MAX_REQUEST_BYTES }),
    );
    progressEvidenceCaptureSessions.assertProgressEvidenceCaptureTokenSignature({
      workerId: input.worker,
      sessionId: input.session,
      token: input.token,
    });
    const prisma = getPrisma();
    await reserveProgressEvidenceLocationRequest(prisma, {
      action: input.action,
      workerId: input.worker,
      sessionId: input.session,
      token: input.token,
      correlationId,
    });
    if (input.action === "INIT") {
      const context = await progressEvidenceCaptureSessions.getProgressEvidenceCaptureContext(
        prisma,
        {
          workerId: input.worker,
          sessionId: input.session,
          token: input.token,
        },
      );
      return successfulProgressEvidenceLocationInitResponse(context, {
        workerId: input.worker,
        sessionId: input.session,
        correlationId,
      });
    }

    const common = {
      workerId: input.worker,
      sessionId: input.session,
      token: input.token,
      correlationId,
    };
    const result = input.action === "CANCEL"
      ? await progressEvidenceCaptureSessions.cancelProgressEvidenceLocation(
          prisma,
          common,
        )
      : await progressEvidenceCaptureSessions.captureProgressEvidenceLocation(
          prisma,
          {
            ...common,
            idempotencyKey: input.idempotencyKey,
            privacyAccepted: input.privacyAccepted,
            noticeVersion: input.noticeVersion,
            noticeContentSha256: input.noticeContentSha256,
            latitude: input.latitude,
            longitude: input.longitude,
            accuracyMeters: input.accuracyMeters,
            capturedAt: input.capturedAt,
          },
        );
    return successfulProgressEvidenceLocationResponse(
      input.action,
      result,
      { correlationId },
    );
  } catch (error) {
    return progressEvidenceLocationErrorResponse(error, { correlationId });
  }
}
