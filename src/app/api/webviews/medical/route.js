import { readWebviewToken } from "@/lib/auth";
import {
  DirectObraMessageError,
  applyDirectObraMessageAtomically,
} from "@/lib/db";
import {
  MAX_MEDICAL_CERTIFICATE_BYTES,
  MAX_MEDICAL_CERTIFICATE_MEGABYTES,
  MAX_MEDICAL_MULTIPART_BYTES,
  buildProtectedMedicalMedia,
  inspectMedicalCertificateFile,
  medicalCertificateUploadIdempotencyKey,
  normalizedMedicalCertificateFile,
  shouldDeleteUncommittedMedicalUpload,
} from "@/lib/medical-upload";
import { getPrisma } from "@/lib/prisma";
import {
  RequestBodyError,
  readMultipartFormDataRequest,
  requestBodyErrorResponse,
} from "@/lib/request-body";
import {
  deleteProtectedFile,
  isProtectedStorageConfigured,
  uploadProtectedFile,
} from "@/lib/storage";
import {
  WebviewSecurityError,
  claimMedicalWebviewToken,
  medicalWebviewTokenFingerprint,
} from "@/lib/webview-security";
import { processIncomingObraMessage } from "@/lib/whatsapp/obra-engine";

export const runtime = "nodejs";
export const maxDuration = 60;

async function cleanupUncommittedMedicalUpload({ prisma, externalId, media, upload }) {
  if (!upload || upload.reused === true) return;
  try {
    const committed = await prisma.message.findUnique({
      where: { externalId },
      select: { mediaUrl: true },
    });
    if (!shouldDeleteUncommittedMedicalUpload({
      upload,
      uploadedMediaUrl: media?.url,
      committedMediaUrl: committed?.mediaUrl,
    })) return;
    await deleteProtectedFile({ provider: upload.provider, ...upload });
  } catch (cleanupError) {
    console.error("Uncommitted medical certificate cleanup failed:", cleanupError);
  }
}

export async function POST(request) {
  try {
    const formData = await readMultipartFormDataRequest(request, {
      maxBytes: MAX_MEDICAL_MULTIPART_BYTES,
    });
    const worker = String(formData.get("worker") || "");
    const token = String(formData.get("token") || "");
    const days = Number(formData.get("days"));
    const file = formData.get("certificate");

    const tokenPayload = readWebviewToken(worker, token, { purpose: "medical" });
    if (!tokenPayload?.ctx) {
      return Response.json({ error: "El enlace venció o no es válido." }, { status: 401 });
    }
    const prisma = getPrisma();
    const fieldWorker = await prisma.worker.findFirst({
      where: { id: worker, projectId: tokenPayload.ctx, active: true },
      include: { project: { select: { organizationId: true } } },
    });
    if (!fieldWorker) {
      return Response.json({ error: "La persona ya no está autorizada en esta obra." }, { status: 403 });
    }
    if (!Number.isInteger(days) || days < 1 || days > 30) {
      return Response.json({ error: "La licencia debe tener entre 1 y 30 días." }, { status: 400 });
    }
    if (!(file instanceof File) || file.size === 0) {
      return Response.json({ error: "Adjuntá una foto o PDF del certificado." }, { status: 400 });
    }
    if (file.size > MAX_MEDICAL_CERTIFICATE_BYTES) {
      return Response.json({
        error: `El certificado supera el máximo permitido de ${MAX_MEDICAL_CERTIFICATE_MEGABYTES} MB.`,
        code: "MEDICAL_FILE_TOO_LARGE",
      }, { status: 413 });
    }
    const detectedType = await inspectMedicalCertificateFile(file);
    if (!detectedType) {
      return Response.json({
        error: "El contenido del archivo no corresponde a un PDF, JPG, PNG o WebP válido.",
        code: "INVALID_MEDICAL_FILE_CONTENT",
      }, { status: 400 });
    }
    if (!isProtectedStorageConfigured()) {
      return Response.json(
        { error: "El almacenamiento protegido todavía no está configurado.", code: "STORAGE_NOT_CONFIGURED" },
        { status: 503 },
      );
    }

    const tokenFingerprint = medicalWebviewTokenFingerprint({
      token,
      workerId: fieldWorker.id,
      projectId: fieldWorker.projectId,
    });
    const existingClaim = await prisma.auditLog.findUnique({
      where: { id: `medical-token-${tokenFingerprint}` },
      select: { id: true },
    });
    if (existingClaim) {
      throw new WebviewSecurityError(
        "Este enlace ya fue utilizado. Pedí uno nuevo desde el chat oficial de la obra.",
        "MEDICAL_WEBVIEW_TOKEN_USED",
        409,
      );
    }
    const protectedFile = normalizedMedicalCertificateFile(file, detectedType);
    const idempotencyKey = await medicalCertificateUploadIdempotencyKey({
      file: protectedFile,
      projectId: fieldWorker.projectId,
      workerId: fieldWorker.id,
      tokenFingerprint,
    });
    const upload = await uploadProtectedFile(protectedFile, {
      folder: "obrasaas/medical-certificates",
      context: `worker=${fieldWorker.id}|days=${days}`,
      idempotencyKey,
      resourceType: "raw",
    });
    const media = buildProtectedMedicalMedia({
      upload,
      file: protectedFile,
      detectedType,
    });
    const event = {
      externalId: `webview-medical-${tokenFingerprint}`,
      provider: "webview",
      from: fieldWorker.phone,
      displayName: fieldWorker.name,
      kind: "interactive",
      media,
      interactive: {
        type: "flow",
        name: "medical_leave",
        response: {
          days,
          certificate_asset_id: upload.assetId,
          certificate_public_id: upload.publicId,
          filename: protectedFile.name,
          mime_type: detectedType.mimeType,
        },
      },
      timestamp: new Date(),
    };
    const atomicScope = {
      projectId: tokenPayload.ctx,
      organizationId: fieldWorker.project.organizationId,
    };
    let applied;
    try {
      applied = await applyDirectObraMessageAtomically({
        event,
        scope: atomicScope,
        workerId: fieldWorker.id,
        beforeApply: ({ prisma: transaction, project, worker: trustedWorker }) => (
          claimMedicalWebviewToken(transaction, {
            token,
            workerId: trustedWorker.id,
            projectId: project.id,
            organizationId: project.organizationId,
          })
        ),
        apply: ({ prisma: transaction, state, projectSettings, worker: trustedWorker, event: trustedEvent }) => (
          processIncomingObraMessage(trustedEvent, atomicScope, {
            prisma: transaction,
            state,
            projectSettings,
            worker: trustedWorker,
            persist: false,
          })
        ),
      });
    } catch (error) {
      await cleanupUncommittedMedicalUpload({
        prisma,
        externalId: event.externalId,
        media,
        upload,
      });
      throw error;
    }

    return Response.json({ success: true, message: applied.result.reply });
  } catch (error) {
    if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
    if (error instanceof WebviewSecurityError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof DirectObraMessageError) {
      const authorizationFailure = ["DIRECT_PROJECT_UNAVAILABLE", "FIELD_WORKER_REQUIRED"]
        .includes(error.code);
      return Response.json({
        error: authorizationFailure
          ? "La persona ya no está autorizada en esta obra."
          : "No pudimos registrar el certificado de forma segura.",
        code: error.code,
      }, { status: error.status });
    }
    console.error("Medical webview failed:", error);
    return Response.json({ error: "No pudimos registrar el certificado." }, { status: 500 });
  }
}
