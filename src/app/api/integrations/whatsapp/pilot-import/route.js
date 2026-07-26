import {
  AccessError,
  accessErrorResponse,
  requireSuperadmin,
} from "@/lib/access";
import { getPrisma } from "@/lib/prisma";
import {
  RequestBodyError,
  readJsonRequest,
  requestBodyErrorResponse,
} from "@/lib/request-body";
import {
  resolveRequestCorrelationId,
  withCorrelationId,
} from "@/lib/request-correlation";
import { MetaIntegrationError } from "@/lib/whatsapp/embedded-signup";
import { WhatsAppFlowProvisioningLeaseError } from "@/lib/whatsapp/flow-provisioning-lease";
import {
  importPilotWhatsAppConnection,
  normalizeWhatsAppPilotImportRequest,
  WhatsAppPilotImportError,
} from "@/lib/whatsapp/pilot-import";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PILOT_IMPORT_JSON_BYTES = 8 * 1024;

function secureResponse(response, correlationId) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store, max-age=0");
  return withCorrelationId(
    new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    }),
    correlationId,
  );
}

function json(payload, correlationId, init = {}) {
  return secureResponse(
    Response.json(payload, {
      ...init,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        ...init.headers,
      },
    }),
    correlationId,
  );
}

function pilotEnabled(environment) {
  return (
    environment?.VERCEL_ENV === "preview" &&
    environment?.WHATSAPP_PILOT_IMPORT_ENABLED === "true"
  );
}

function auditIp(request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}

function safeLog(error, correlationId) {
  return {
    correlationId,
    name: typeof error?.name === "string" ? error.name : "Error",
    code: typeof error?.code === "string" ? error.code : "UNKNOWN",
    status: Number.isInteger(error?.status) ? error.status : null,
  };
}

export function createWhatsAppPilotImportHandlers({
  environment = process.env,
  resolveAccess = requireSuperadmin,
  prismaFactory = getPrisma,
  parseBody = readJsonRequest,
  normalizeInput = normalizeWhatsAppPilotImportRequest,
  importConnection = importPilotWhatsAppConnection,
  resolveCorrelationId = resolveRequestCorrelationId,
  clock = () => new Date(),
} = {}) {
  async function POST(request) {
    const correlationId = resolveCorrelationId(request);
    if (!pilotEnabled(environment)) {
      return json(
        { error: "Recurso no disponible.", code: "NOT_FOUND" },
        correlationId,
        {
          status: 404,
        },
      );
    }

    try {
      if (new URL(request.url).search) {
        throw new WhatsAppPilotImportError(
          "La importaci\u00f3n no admite query parameters.",
          {
            code: "PILOT_IMPORT_QUERY_FORBIDDEN",
            status: 400,
          },
        );
      }
      const access = await resolveAccess();
      const body = await parseBody(request, {
        maxBytes: MAX_PILOT_IMPORT_JSON_BYTES,
      });
      const input = normalizeInput(body, {
        idempotencyKey: request.headers.get("idempotency-key"),
        fingerprintSecret: environment.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY,
        allowedAssets: environment.WHATSAPP_PILOT_ALLOWED_ASSETS,
      });
      const result = await importConnection(prismaFactory(), {
        access,
        input,
        ipAddress: auditIp(request),
        now: clock(),
      });
      return json(result, correlationId);
    } catch (error) {
      if (error instanceof AccessError) {
        return secureResponse(accessErrorResponse(error), correlationId);
      }
      if (error instanceof RequestBodyError) {
        return secureResponse(requestBodyErrorResponse(error), correlationId);
      }
      if (error instanceof WhatsAppPilotImportError) {
        return json({ error: error.message, code: error.code }, correlationId, {
          status: error.status,
        });
      }
      if (error instanceof WhatsAppFlowProvisioningLeaseError) {
        return json(
          {
            error: "Hay otra operaci\u00f3n segura de WhatsApp en curso.",
            code: "PILOT_IMPORT_IN_PROGRESS",
          },
          correlationId,
          {
            status: 409,
            ...(error.retryAfterSeconds
              ? {
                  headers: { "Retry-After": String(error.retryAfterSeconds) },
                }
              : {}),
          },
        );
      }
      if (error instanceof MetaIntegrationError) {
        console.error(
          "WhatsApp pilot import validation failed:",
          safeLog(error, correlationId),
        );
        return json(
          {
            error: "Meta no pudo validar la conexi\u00f3n piloto.",
            code: "PILOT_IMPORT_VALIDATION_FAILED",
          },
          correlationId,
          {
            status: error.status >= 500 ? 502 : 400,
          },
        );
      }
      console.error(
        "WhatsApp pilot import failed:",
        safeLog(error, correlationId),
      );
      return json(
        {
          error: "No se pudo completar la importaci\u00f3n piloto.",
          code: "PILOT_IMPORT_FAILED",
        },
        correlationId,
        { status: 500 },
      );
    }
  }

  return { POST };
}

export const { POST } = createWhatsAppPilotImportHandlers();
