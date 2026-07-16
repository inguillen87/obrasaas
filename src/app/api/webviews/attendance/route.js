import { createHash } from "node:crypto";
import { readWebviewToken } from "@/lib/auth";
import {
  DirectObraMessageError,
  applyDirectObraMessageAtomically,
} from "@/lib/db";
import {
  MAX_REPORTED_LOCATION_ACCURACY_METERS,
  validateReportedLocation,
} from "@/lib/geo";
import { getPrisma } from "@/lib/prisma";
import {
  RequestBodyError,
  readJsonRequest,
  requestBodyErrorResponse,
} from "@/lib/request-body";
import { processIncomingObraMessage } from "@/lib/whatsapp/obra-engine";

export const runtime = "nodejs";
const MAX_ATTENDANCE_REQUEST_BYTES = 8 * 1024;

export async function POST(request) {
  try {
    const body = await readJsonRequest(request, { maxBytes: MAX_ATTENDANCE_REQUEST_BYTES });
    const worker = String(body.worker || "");
    const token = String(body.token || "");
    const tokenPayload = readWebviewToken(worker, token, { purpose: "attendance" });
    if (!tokenPayload?.ctx) {
      return Response.json({ error: "El enlace venció o no es válido." }, { status: 401 });
    }
    const fieldWorker = await getPrisma().worker.findFirst({
      where: { id: worker, projectId: tokenPayload.ctx, active: true },
      include: { project: { select: { organizationId: true } } },
    });
    if (!fieldWorker) {
      return Response.json({ error: "La persona ya no está autorizada en esta obra." }, { status: 403 });
    }

    const location = validateReportedLocation({
      latitude: body.latitude,
      longitude: body.longitude,
      accuracy: body.accuracy,
    });
    if (!location.valid && location.reason === "INVALID_COORDINATES") {
      return Response.json({ error: "La ubicación recibida no es válida." }, { status: 400 });
    }
    if (!location.valid) {
      return Response.json({
        error: `La señal no tiene precisión suficiente. Esperá una lectura de hasta ${MAX_REPORTED_LOCATION_ACCURACY_METERS} m y reintentá.`,
        code: "INSUFFICIENT_LOCATION_ACCURACY",
      }, { status: 422 });
    }

    const operationId = `webview-attendance-${createHash("sha256")
      .update(`attendance\0${tokenPayload.ctx}\0${fieldWorker.id}\0${token}`)
      .digest("hex")}`;
    const event = {
      externalId: operationId,
      provider: "webview",
      from: fieldWorker.phone,
      displayName: fieldWorker.name,
      kind: "location",
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
      },
      timestamp: new Date(),
    };
    const atomicScope = {
      projectId: tokenPayload.ctx,
      organizationId: fieldWorker.project.organizationId,
    };
    const applied = await applyDirectObraMessageAtomically({
      event,
      scope: atomicScope,
      workerId: fieldWorker.id,
      operation: {
        id: operationId,
        action: "webview.attendance.location_applied",
      },
      apply: ({ prisma, state, projectSettings, worker: trustedWorker, event: trustedEvent }) => (
        processIncomingObraMessage(trustedEvent, atomicScope, {
          prisma,
          state,
          projectSettings,
          worker: trustedWorker,
          persist: false,
        })
      ),
    });
    return Response.json({ success: true, message: applied.result.reply });
  } catch (error) {
    if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
    if (error instanceof DirectObraMessageError) {
      const authorizationFailure = ["DIRECT_PROJECT_UNAVAILABLE", "FIELD_WORKER_REQUIRED"]
        .includes(error.code);
      return Response.json({
        error: authorizationFailure
          ? "La persona ya no está autorizada en esta obra."
          : "No pudimos registrar el fichaje de forma segura.",
        code: error.code,
      }, { status: error.status });
    }
    console.error("Attendance webview failed:", error);
    return Response.json({ error: "No pudimos registrar el fichaje." }, { status: 500 });
  }
}
