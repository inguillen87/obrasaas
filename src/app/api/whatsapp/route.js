import {
  DirectObraMessageError,
  applyDirectObraMessageAtomically,
  getMessages,
} from "@/lib/db";
import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  hasTenantPermission,
  requireTenantPermission,
} from "@/lib/access";
import {
  FIELD_WORKER_RESOLUTION,
  resolveActiveFieldWorkerById,
} from "@/lib/field-workers";
import { getPrisma } from "@/lib/prisma";
import { MEDICAL_EVIDENCE_PERMISSION } from "@/lib/medical-privacy";
import {
  RequestBodyError,
  readJsonRequest,
  requestBodyErrorResponse,
} from "@/lib/request-body";
import { processIncomingObraMessage } from "@/lib/whatsapp/obra-engine";

export const runtime = "nodejs";
const MAX_SIMULATOR_BODY_BYTES = 100_000;
const SIMULATOR_FIELDS = new Set([
  "workerId",
  "text",
  "bodyText",
  "mediaType",
  "kind",
  "mediaUrl",
  "fileName",
  "latitude",
  "longitude",
]);
const SIMULATOR_KINDS = new Set(["text", "audio", "image", "video", "document"]);

export async function GET() {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, "org:projects:read");
    return Response.json(await getMessages(access, {
      includeMedicalEvidence: hasTenantPermission(access, MEDICAL_EVIDENCE_PERMISSION),
    }));
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("Failed to load WhatsApp messages:", error);
    return Response.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    const isTwilio = contentType.includes("x-www-form-urlencoded") || contentType.includes("form-data");
    if (isTwilio) {
      return Response.json(
        { error: "El endpoint legado de Twilio fue retirado. Usá Meta Cloud API con webhook firmado." },
        { status: 410 },
      );
    }

    const scope = await getPlatformAccess();
    requireTenantPermission(scope, "org:field:manage");
    const body = await readJsonRequest(request, { maxBytes: MAX_SIMULATOR_BODY_BYTES });
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ error: "El cuerpo debe ser un objeto JSON." }, { status: 400 });
    }
    if (Object.keys(body).some((field) => !SIMULATOR_FIELDS.has(field))) {
      return Response.json({ error: "El evento contiene campos no permitidos." }, { status: 400 });
    }
    const resolution = await resolveActiveFieldWorkerById(
      getPrisma(),
      { organizationId: scope.organization.id, projectId: scope.project.id },
      String(body.workerId || ""),
    );
    if (resolution.status !== FIELD_WORKER_RESOLUTION.RESOLVED) {
      return Response.json({
        error: "Seleccioná una persona activa de la cuadrilla antes de simular el mensaje.",
        code: "FIELD_WORKER_REQUIRED",
      }, { status: 409 });
    }

    const mediaType = String(body.mediaType || "");
    const inferredKind = mediaType.startsWith("audio/")
      ? "audio"
      : mediaType.startsWith("image/")
        ? "image"
        : mediaType.startsWith("video/")
          ? "video"
          : body.mediaUrl
            ? "document"
            : "text";
    const kind = String(body.kind || inferredKind);
    if (!SIMULATOR_KINDS.has(kind)) {
      return Response.json({ error: "El tipo de evento de prueba no es válido." }, { status: 400 });
    }
    const text = String(body.text ?? body.bodyText ?? "").slice(0, 4_000);
    const event = {
      provider: "internal",
      from: resolution.worker.phone,
      displayName: resolution.worker.name,
      text,
      kind,
      media: body.mediaUrl
        ? {
            url: String(body.mediaUrl).slice(0, 2_000),
            mimeType: mediaType.slice(0, 160) || null,
            filename: String(body.fileName || body.mediaUrl).slice(0, 255),
            storage: { provider: "dashboard-simulator", status: "simulated" },
          }
        : null,
      transcription: kind === "audio" && text
        ? { status: "completed", provider: "dashboard-simulator", text }
        : null,
      location:
        Number.isFinite(Number(body.latitude)) && Number.isFinite(Number(body.longitude))
          ? { latitude: Number(body.latitude), longitude: Number(body.longitude) }
          : null,
      timestamp: new Date(),
    };

    const applied = await applyDirectObraMessageAtomically({
      event,
      scope,
      workerId: resolution.worker.id,
      apply: ({ prisma, state, projectSettings, worker, event: trustedEvent }) => (
        processIncomingObraMessage(trustedEvent, scope, {
          prisma,
          state,
          projectSettings,
          worker,
          persist: false,
        })
      ),
    });
    return Response.json({ success: true, ...applied.result });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
    if (error instanceof DirectObraMessageError) {
      if (error.code === "FIELD_WORKER_REQUIRED") {
        return Response.json({
          error: "Seleccioná una persona activa de la cuadrilla antes de simular el mensaje.",
          code: error.code,
        }, { status: 409 });
      }
      return Response.json({
        error: "No se pudo aplicar el evento de prueba de forma segura.",
        code: error.code,
      }, { status: error.status });
    }
    console.error("Failed to process compatibility WhatsApp request:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
