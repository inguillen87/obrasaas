import { randomUUID } from "node:crypto";

import { getPrisma } from "@/lib/prisma";
import {
  RequestBodyError,
  readJsonRequest,
} from "@/lib/request-body";
import {
  assertWorkerPaymentPrivateReceiptTokenSignature,
  isWorkerPaymentPrivateReceiptError,
  readWorkerPaymentPrivateReceipt,
} from "@/lib/worker-payment-private-receipts";
import {
  renderWorkerPaymentReceiptPdf,
  workerPaymentReceiptPdfFilename,
} from "@/lib/worker-payment-receipt-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 12 * 1_024;
const MAX_ID_LENGTH = 191;
const MAX_TOKEN_LENGTH = 4_096;
const REQUEST_FIELDS = new Set(["action", "worker", "receipt", "token"]);
const ACTIONS = new Set(["INIT", "PDF"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SAFE_ERROR_CODE_PATTERN = /^WORKER_PAYMENT_PRIVATE_RECEIPT_[A-Z0-9_]{1,95}$/;
const SAFE_ERROR_STATUSES = new Set([400, 401, 403, 404, 409, 410, 413, 415, 503]);
const CORRELATION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RESPONSE_HEADERS = Object.freeze({
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Content-Security-Policy": "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
});

class WorkerPaymentReceiptRouteError extends Error {
  constructor(message, code = "WORKER_PAYMENT_PRIVATE_RECEIPT_REQUEST_INVALID", status = 400) {
    super(message);
    this.name = "WorkerPaymentReceiptRouteError";
    this.code = code;
    this.status = status;
  }
}

function invalidRequest(message, code = "WORKER_PAYMENT_PRIVATE_RECEIPT_REQUEST_INVALID") {
  throw new WorkerPaymentReceiptRouteError(message, code, 400);
}

function exactString(input, field, maxLength, pattern = null) {
  const value = input[field];
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > maxLength
    || value.trim() !== value
    || /[\u0000-\u001f\u007f]/.test(value)
    || (pattern && !pattern.test(value))
  ) {
    invalidRequest(`El campo ${field} no es válido.`);
  }
  return value;
}

export function parseWorkerPaymentReceiptInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    invalidRequest("El cuerpo de la solicitud no es válido.");
  }
  const keys = Object.keys(input);
  if (keys.length !== REQUEST_FIELDS.size || keys.some((field) => !REQUEST_FIELDS.has(field))) {
    invalidRequest(
      "La solicitud contiene campos faltantes o no permitidos.",
      "WORKER_PAYMENT_PRIVATE_RECEIPT_FIELDS_INVALID",
    );
  }
  const action = exactString(input, "action", 8);
  if (!ACTIONS.has(action)) {
    invalidRequest(
      "La acción solicitada no es válida.",
      "WORKER_PAYMENT_PRIVATE_RECEIPT_ACTION_INVALID",
    );
  }
  return {
    action,
    worker: exactString(input, "worker", MAX_ID_LENGTH),
    receipt: exactString(input, "receipt", 36, UUID_PATTERN).toLowerCase(),
    token: exactString(input, "token", MAX_TOKEN_LENGTH),
  };
}

function responseHeaders(correlationId, extra = {}) {
  return {
    ...RESPONSE_HEADERS,
    ...(CORRELATION_ID_PATTERN.test(correlationId || "")
      ? { "X-Correlation-Id": correlationId }
      : {}),
    ...extra,
  };
}

function jsonResponse(payload, { status = 200, correlationId = null } = {}) {
  return Response.json(payload, {
    status,
    headers: responseHeaders(correlationId),
  });
}

function safeErrorResponse(error, correlationId) {
  if (error instanceof RequestBodyError) {
    const status = SAFE_ERROR_STATUSES.has(error.status) ? error.status : 400;
    return jsonResponse({
      success: false,
      error: "La solicitud no es válida.",
      code: "WORKER_PAYMENT_PRIVATE_RECEIPT_REQUEST_INVALID",
      correlationId,
    }, { status, correlationId });
  }
  if (error instanceof WorkerPaymentReceiptRouteError) {
    return jsonResponse({
      success: false,
      error: error.message,
      code: error.code,
      correlationId,
    }, { status: error.status, correlationId });
  }
  if (isWorkerPaymentPrivateReceiptError(error)) {
    const status = SAFE_ERROR_STATUSES.has(error.status) ? error.status : 503;
    const code = SAFE_ERROR_CODE_PATTERN.test(error.code || "")
      ? error.code
      : "WORKER_PAYMENT_PRIVATE_RECEIPT_UNAVAILABLE";
    const authorizationFailure = status === 401 || status === 403 || status === 404;
    return jsonResponse({
      success: false,
      error: authorizationFailure
        ? "El enlace venció, fue revocado o ya no autoriza esta constancia."
        : error.message,
      code,
      correlationId,
    }, { status, correlationId });
  }
  const safeName = typeof error?.name === "string"
    ? error.name.slice(0, 80)
    : "UnknownError";
  console.error(`Worker payment private receipt failed (${correlationId}; ${safeName}).`);
  return jsonResponse({
    success: false,
    error: "No pudimos generar la constancia privada de forma segura.",
    code: "WORKER_PAYMENT_PRIVATE_RECEIPT_UNAVAILABLE",
    correlationId,
  }, { status: 500, correlationId });
}

export async function POST(request) {
  const correlationId = randomUUID();
  try {
    const requestUrl = new URL(request.url);
    if (requestUrl.search || requestUrl.hash) {
      invalidRequest(
        "La autorización debe enviarse sólo en el cuerpo protegido.",
        "WORKER_PAYMENT_PRIVATE_RECEIPT_URL_FIELDS_FORBIDDEN",
      );
    }
    const input = parseWorkerPaymentReceiptInput(await readJsonRequest(request, {
      maxBytes: MAX_REQUEST_BYTES,
    }));
    const access = assertWorkerPaymentPrivateReceiptTokenSignature({
      workerId: input.worker,
      receiptId: input.receipt,
      token: input.token,
    });
    const result = await readWorkerPaymentPrivateReceipt(getPrisma(), access);

    if (input.action === "INIT") {
      return jsonResponse({
        success: true,
        action: "INIT",
        receipt: result.receipt,
      }, { correlationId });
    }

    const pdf = await renderWorkerPaymentReceiptPdf(result.receipt);
    const filename = workerPaymentReceiptPdfFilename(result.receipt);
    return new Response(pdf, {
      status: 200,
      headers: responseHeaders(correlationId, {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdf.byteLength),
      }),
    });
  } catch (error) {
    return safeErrorResponse(error, correlationId);
  }
}
