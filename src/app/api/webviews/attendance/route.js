import { createHash } from "node:crypto";
import {
  ATTENDANCE_ACTIONS,
  ATTENDANCE_V1_COMPATIBILITY,
  isAttendanceAction,
  readWebviewToken,
} from "@/lib/auth";
import {
  AttendanceDomainError,
  getAttendanceJourney,
} from "@/lib/attendance";
import { expirePendingAttendanceForWorker } from "@/lib/attendance-expiry";
import {
  DirectObraMessageError,
  applyDirectObraMessageAtomically,
} from "@/lib/db";
import {
  MAX_REPORTED_LOCATION_ACCURACY_METERS,
  validateReportedLocation,
} from "@/lib/geo";
import {
  assertSubscriptionAllowsWrites,
  SubscriptionWriteBlockedError,
} from "@/lib/plans";
import { getPrisma } from "@/lib/prisma";
import {
  RequestBodyError,
  readJsonRequest,
  requestBodyErrorResponse,
} from "@/lib/request-body";
import { processIncomingObraMessage } from "@/lib/whatsapp/obra-engine";

export const runtime = "nodejs";
const MAX_ATTENDANCE_REQUEST_BYTES = 8 * 1024;
const LOCATION_NOTICE_VERSION = "2026-07-23";
const LEGACY_LOCATION_NOTICE_VERSION = "legacy-v1-ui-disclosure-unversioned";
const LEGACY_ATTENDANCE_PROVIDER = "webview-legacy-v1";
const LEGACY_ATTENDANCE_OPERATION_ACTION = "webview.attendance.location_applied";
const LOCATION_ACTIONS = new Set([
  ATTENDANCE_ACTIONS.CHECK_IN,
  ATTENDANCE_ACTIONS.CHECK_OUT,
]);
export const ATTENDANCE_LOCATION_CAPTURE_MAX_AGE_MS = 2 * 60 * 1_000;
const ATTENDANCE_LOCATION_CLOCK_SKEW_MS = 30 * 1_000;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,189}$/;

const ATTENDANCE_ERROR_MESSAGES = Object.freeze({
  NO_PENDING_CHECK_IN: "No hay un ingreso pendiente vigente. Pedí un enlace nuevo desde WhatsApp.",
  ATTENDANCE_SHIFT_ALREADY_OPEN: "Ya existe una jornada abierta para esta persona.",
  ATTENDANCE_SHIFT_NOT_OPEN: "No hay una jornada abierta para aplicar esta acción.",
  ATTENDANCE_BREAK_ALREADY_OPEN: "La jornada ya se encuentra en pausa.",
  ATTENDANCE_BREAK_NOT_OPEN: "La jornada no tiene una pausa activa.",
  ATTENDANCE_BREAK_OPEN: "Finalizá la pausa antes de registrar la salida.",
  ATTENDANCE_TRANSITION_INVALID: "La acción no coincide con el estado actual de la jornada.",
  ATTENDANCE_CONCURRENT_MODIFICATION: "La jornada cambió mientras se registraba la acción. Reintentá.",
  ATTENDANCE_IDEMPOTENCY_CONFLICT: "La misma solicitud ya fue usada con datos diferentes.",
  ATTENDANCE_LOCATION_INVALID: "La ubicación recibida no es válida.",
  ATTENDANCE_LOCATION_ACCURACY_INVALID: "La señal no tiene precisión suficiente para registrar la acción.",
  ATTENDANCE_LINK_STALE: "El enlace corresponde a una versión anterior de la jornada. Pedí uno nuevo.",
  LOCATION_CAPTURE_INVALID: "La hora de captura de la ubicación no es válida. Volvé a obtener la ubicación.",
  LOCATION_CAPTURE_EXPIRED: "La lectura de ubicación ya no es reciente. Volvé a obtenerla.",
  GEOFENCE_NOT_CONFIGURED: "La obra todavía no tiene una geocerca válida configurada.",
});

function attendanceResponse(payload, { status = 200 } = {}) {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function attendanceJourneyResponse(journey) {
  if (!journey) return null;
  return {
    ...journey,
    events: Array.isArray(journey.events)
      ? journey.events.map((item) => {
          const event = { ...item };
          delete event.latitude;
          delete event.longitude;
          delete event.evidence;
          return event;
        })
      : [],
  };
}

function legacyOperationHash({ projectId, workerId, token }) {
  return createHash("sha256")
    .update(`attendance\0${projectId}\0${workerId}\0${token}`)
    .digest("hex");
}

function legacyIdempotencyKey(input) {
  return `legacy:${legacyOperationHash(input)}`;
}

function legacyOperationId(input) {
  // This is intentionally byte-for-byte compatible with the pre-v2 route so
  // a response-lost request can replay an audit outcome written by an old pod.
  return `webview-attendance-${legacyOperationHash(input)}`;
}

function requestFingerprint({ action, binding, location, locationNoticeVersion }) {
  return createHash("sha256")
    .update(JSON.stringify({ action, binding, location, locationNoticeVersion }))
    .digest("hex");
}

function normalizeAction(body, tokenPayload) {
  const action = body.action == null || body.action === ""
    ? ATTENDANCE_ACTIONS.CHECK_IN
    : String(body.action);
  if (!isAttendanceAction(action) || tokenPayload?.act !== action) return null;
  return action;
}

function normalizedCapturedAt(value, { required }) {
  if (!required && (value === null || value === undefined || value === "")) return null;
  if (typeof value !== "string" || value.length > 40) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  const canonical = new Date(timestamp).toISOString();
  return canonical === value ? canonical : null;
}

function normalizeLocation(body, action, { requireCapturedAt }) {
  if (!LOCATION_ACTIONS.has(action)) return { valid: true, location: null };
  const candidate = body.location && typeof body.location === "object" && !Array.isArray(body.location)
    ? body.location
    : body;
  const location = validateReportedLocation({
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    accuracy: candidate.accuracy,
  });
  const capturedAt = normalizedCapturedAt(candidate.capturedAt, { required: requireCapturedAt });
  if (requireCapturedAt && !capturedAt) {
    return { valid: false, reason: "INVALID_CAPTURE_TIMESTAMP" };
  }
  return location.valid
    ? {
        valid: true,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          ...(capturedAt ? { capturedAt } : {}),
        },
      }
    : location;
}

export function assertFreshAttendanceLocationCapture({ capturedAt, issuedAt, now }) {
  const captureTime = Date.parse(capturedAt);
  const requestTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const issuedAtTime = Number(issuedAt) * 1_000;
  if (
    !Number.isFinite(captureTime)
    || !Number.isFinite(requestTime)
    || !Number.isSafeInteger(Number(issuedAt))
  ) {
    throw new AttendanceDomainError(
      "The attendance location capture timestamp is invalid.",
      "LOCATION_CAPTURE_INVALID",
      400,
    );
  }
  if (
    captureTime > requestTime + ATTENDANCE_LOCATION_CLOCK_SKEW_MS
    || captureTime < issuedAtTime - ATTENDANCE_LOCATION_CLOCK_SKEW_MS
    || requestTime - captureTime > ATTENDANCE_LOCATION_CAPTURE_MAX_AGE_MS
  ) {
    throw new AttendanceDomainError(
      "The attendance location capture is outside the accepted freshness window.",
      "LOCATION_CAPTURE_EXPIRED",
      422,
    );
  }
}

function attendanceTokenBinding(tokenPayload) {
  if (tokenPayload.v === 1) return null;
  return tokenPayload.act === ATTENDANCE_ACTIONS.CHECK_IN
    ? { pendingEntryId: tokenPayload.pid }
    : { shiftId: tokenPayload.sid, expectedRevision: tokenPayload.rev };
}

async function activeFieldWorker(workerId, projectId) {
  return getPrisma().worker.findFirst({
    where: { id: workerId, projectId, active: true },
    include: {
      project: {
        select: {
          organizationId: true,
          organization: {
            select: {
              subscriptionPlan: true,
              subscriptionStatus: true,
              trialEndsAt: true,
            },
          },
        },
      },
    },
  });
}

export async function GET(request) {
  try {
    const query = new URL(request.url).searchParams;
    const worker = String(query.get("worker") || "");
    const token = String(query.get("token") || "");
    const tokenPayload = readWebviewToken(worker, token, { purpose: "attendance" });
    if (!tokenPayload?.ctx) {
      return attendanceResponse(
        { error: "El enlace venció o no es válido.", code: "LINK_EXPIRED" },
        { status: 401 },
      );
    }
    const fieldWorker = await activeFieldWorker(worker, tokenPayload.ctx);
    if (!fieldWorker) {
      return attendanceResponse(
        { error: "La persona ya no está autorizada en esta obra.", code: "WORKER_INACTIVE" },
        { status: 403 },
      );
    }
    const journey = await getAttendanceJourney(getPrisma(), {
      projectId: tokenPayload.ctx,
      workerId: fieldWorker.id,
    });
    return attendanceResponse({
      success: true,
      action: tokenPayload.act,
      journey: attendanceJourneyResponse(journey),
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Attendance webview state failed:", error);
    return attendanceResponse(
      { error: "No pudimos recuperar el estado de la jornada." },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const body = await readJsonRequest(request, { maxBytes: MAX_ATTENDANCE_REQUEST_BYTES });
    const worker = String(body.worker || "");
    const token = String(body.token || "");
    const tokenPayload = readWebviewToken(worker, token, { purpose: "attendance" });
    const action = normalizeAction(body, tokenPayload);
    if (!tokenPayload?.ctx || !action) {
      return attendanceResponse(
        { error: "El enlace venció, no es válido o corresponde a otra acción.", code: "LINK_EXPIRED" },
        { status: 401 },
      );
    }
    const fieldWorker = await activeFieldWorker(worker, tokenPayload.ctx);
    if (!fieldWorker) {
      return attendanceResponse(
        { error: "La persona ya no está autorizada en esta obra.", code: "WORKER_INACTIVE" },
        { status: 403 },
      );
    }
    assertSubscriptionAllowsWrites(fieldWorker.project.organization);
    const legacyV1 = tokenPayload.v === 1;
    const requestNow = new Date();

    const locationResult = normalizeLocation(body, action, { requireCapturedAt: !legacyV1 });
    if (!locationResult.valid && locationResult.reason === "INVALID_CAPTURE_TIMESTAMP") {
      return attendanceResponse(
        {
          error: ATTENDANCE_ERROR_MESSAGES.LOCATION_CAPTURE_INVALID,
          code: "LOCATION_CAPTURE_INVALID",
        },
        { status: 400 },
      );
    }
    if (!locationResult.valid && locationResult.reason === "INVALID_COORDINATES") {
      return attendanceResponse(
        { error: "La ubicación recibida no es válida.", code: "INVALID_COORDINATES" },
        { status: 400 },
      );
    }
    if (!locationResult.valid) {
      return attendanceResponse({
        error: `La señal no tiene precisión suficiente. Esperá una lectura de hasta ${MAX_REPORTED_LOCATION_ACCURACY_METERS} m y reintentá.`,
        code: "INSUFFICIENT_LOCATION_ACCURACY",
      }, { status: 422 });
    }
    const modernLocationNotice = body.locationNoticeAcknowledged === true
      && body.locationNoticeVersion === LOCATION_NOTICE_VERSION;
    const legacyLocationNotice = legacyV1
      && body.locationNoticeAcknowledged == null
      && body.locationNoticeVersion == null;
    if (LOCATION_ACTIONS.has(action) && !modernLocationNotice && !legacyLocationNotice) {
      return attendanceResponse(
        {
          error: "Confirmá la autorización de lectura puntual antes de continuar.",
          code: "LOCATION_NOTICE_REQUIRED",
        },
        { status: 400 },
      );
    }
    const privacyNoticeVersion = LOCATION_ACTIONS.has(action)
      ? modernLocationNotice
        ? LOCATION_NOTICE_VERSION
        : LEGACY_LOCATION_NOTICE_VERSION
      : null;

    const legacyIdentity = legacyV1
      ? { projectId: tokenPayload.ctx, workerId: fieldWorker.id, token }
      : null;
    const idempotencyKey = legacyV1
      ? legacyIdempotencyKey(legacyIdentity)
      : String(body.idempotencyKey || "").trim();
    if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
      return attendanceResponse(
        { error: "La identidad de la operación no es válida.", code: "IDEMPOTENCY_KEY_INVALID" },
        { status: 400 },
      );
    }

    const binding = attendanceTokenBinding(tokenPayload);
    const fingerprint = requestFingerprint({
      action,
      binding,
      location: locationResult.location,
      locationNoticeVersion: privacyNoticeVersion,
    });
    const operationId = legacyV1
      ? legacyOperationId(legacyIdentity)
      : `webview-attendance-${createHash("sha256")
          .update(`${tokenPayload.ctx}\0${fieldWorker.id}\0${idempotencyKey}`)
          .digest("hex")}`;
    const event = {
      externalId: operationId,
      provider: legacyV1 ? LEGACY_ATTENDANCE_PROVIDER : "webview",
      from: fieldWorker.phone,
      displayName: fieldWorker.name,
      kind: locationResult.location ? "location" : "interactive",
      location: locationResult.location,
      attendanceAction: action,
      attendanceIdempotencyKey: idempotencyKey,
      attendancePrivacyNoticeVersion: privacyNoticeVersion,
      attendanceLocationCapturedAt: locationResult.location?.capturedAt || null,
      attendancePendingEntryId: binding?.pendingEntryId || null,
      attendanceShiftId: binding?.shiftId || null,
      attendanceExpectedRevision: binding?.expectedRevision ?? null,
      timestamp: requestNow,
    };
    const atomicScope = {
      projectId: tokenPayload.ctx,
      organizationId: fieldWorker.project.organizationId,
    };
    if (action === ATTENDANCE_ACTIONS.CHECK_IN) {
      // This lifecycle transition must commit before the direct-message
      // transaction. A subsequent NO_PENDING_CHECK_IN response intentionally
      // rolls its own transaction back without reviving the expired capture.
      await expirePendingAttendanceForWorker(getPrisma(), {
        projectId: tokenPayload.ctx,
        workerId: fieldWorker.id,
        now: requestNow,
      });
    }
    const applied = await applyDirectObraMessageAtomically({
      event,
      scope: atomicScope,
      workerId: fieldWorker.id,
      operation: {
        id: operationId,
        action: legacyV1
          ? LEGACY_ATTENDANCE_OPERATION_ACTION
          : `webview.attendance.${action.toLowerCase()}.${fingerprint}`,
      },
      beforeApply: () => {
        if (!legacyV1 && locationResult.location) {
          assertFreshAttendanceLocationCapture({
            capturedAt: locationResult.location.capturedAt,
            issuedAt: tokenPayload.iat,
            now: requestNow,
          });
        }
      },
      apply: ({ prisma, state, projectSettings, worker: trustedWorker, event: trustedEvent }) => (
        processIncomingObraMessage(trustedEvent, atomicScope, {
          prisma,
          state,
          projectSettings,
          worker: trustedWorker,
          processingTime: requestNow,
          persist: false,
        })
      ),
    });
    const journey = await getAttendanceJourney(getPrisma(), {
      projectId: tokenPayload.ctx,
      workerId: fieldWorker.id,
    });
    const response = attendanceResponse({
      success: true,
      outcome: applied.alreadyApplied ? "REPLAYED" : "RECORDED",
      action,
      message: applied.result.reply,
      journey: attendanceJourneyResponse(journey),
    });
    if (legacyV1) {
      response.headers.set("Deprecation", "true");
      response.headers.set(
        "Sunset",
        new Date(ATTENDANCE_V1_COMPATIBILITY.acceptUntilExclusive).toUTCString(),
      );
      response.headers.set(
        "X-ObraSaaS-Removal-Marker",
        ATTENDANCE_V1_COMPATIBILITY.removalMarker,
      );
    }
    return response;
  } catch (error) {
    if (error instanceof RequestBodyError) {
      const response = requestBodyErrorResponse(error);
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }
    if (error instanceof SubscriptionWriteBlockedError) {
      return attendanceResponse(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    if (error instanceof AttendanceDomainError) {
      return attendanceResponse(
        {
          error: ATTENDANCE_ERROR_MESSAGES[error.code] || error.message,
          code: error.code,
        },
        { status: error.status || 409 },
      );
    }
    if (error instanceof DirectObraMessageError) {
      const authorizationFailure = ["DIRECT_PROJECT_UNAVAILABLE", "FIELD_WORKER_REQUIRED"]
        .includes(error.code);
      return attendanceResponse({
        error: authorizationFailure
          ? "La persona ya no está autorizada en esta obra."
          : "No pudimos registrar el fichaje de forma segura.",
        code: error.code,
      }, { status: error.status });
    }
    console.error("Attendance webview failed:", error);
    return attendanceResponse(
      { error: "No pudimos registrar el fichaje." },
      { status: 500 },
    );
  }
}
