import { readWebviewToken } from "@/lib/auth";
import { isProtectedStorageConfigured, uploadProtectedFile } from "@/lib/storage";
import { processIncomingObraMessage } from "@/lib/whatsapp/obra-engine";

export const runtime = "nodejs";
export const maxDuration = 60;

const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const maxFileBytes = 10 * 1024 * 1024;

export async function POST(request) {
  try {
    const formData = await request.formData();
    const worker = String(formData.get("worker") || "");
    const token = String(formData.get("token") || "");
    const days = Number(formData.get("days"));
    const file = formData.get("certificate");

    const tokenPayload = readWebviewToken(worker, token, { purpose: "medical" });
    if (!tokenPayload?.ctx) {
      return Response.json({ error: "El enlace venció o no es válido." }, { status: 401 });
    }
    if (!Number.isInteger(days) || days < 1 || days > 30) {
      return Response.json({ error: "La licencia debe tener entre 1 y 30 días." }, { status: 400 });
    }
    if (!(file instanceof File) || file.size === 0) {
      return Response.json({ error: "Adjuntá una foto o PDF del certificado." }, { status: 400 });
    }
    if (!allowedTypes.has(file.type) || file.size > maxFileBytes) {
      return Response.json({ error: "Usá PDF, JPG, PNG o WebP de hasta 10 MB." }, { status: 400 });
    }
    if (!isProtectedStorageConfigured()) {
      return Response.json(
        { error: "El almacenamiento protegido todavía no está configurado.", code: "STORAGE_NOT_CONFIGURED" },
        { status: 503 },
      );
    }

    const upload = await uploadProtectedFile(file, {
      folder: "obrasaas/medical-certificates",
      context: `worker=${worker}|days=${days}`,
    });
    const result = await processIncomingObraMessage({
      provider: "webview",
      from: worker,
      kind: "interactive",
      interactive: {
        type: "flow",
        name: "medical_leave",
        response: {
          days,
          certificate_asset_id: upload.assetId,
          certificate_public_id: upload.publicId,
          filename: file.name,
        },
      },
      timestamp: new Date(),
    }, { projectId: tokenPayload.ctx });

    return Response.json({ success: true, message: result.reply });
  } catch (error) {
    console.error("Medical webview failed:", error);
    return Response.json({ error: "No pudimos registrar el certificado." }, { status: 500 });
  }
}
