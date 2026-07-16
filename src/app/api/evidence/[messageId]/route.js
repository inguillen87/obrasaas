import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  requireTenantPermission,
} from "@/lib/access";
import {
  MEDICAL_EVIDENCE_PERMISSION,
  isMedicalEvidenceRecord,
} from "@/lib/medical-privacy";
import { getPrisma } from "@/lib/prisma";
import {
  isPrivateVercelBlobUrl,
  readProtectedFile,
} from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

function safeFileName(value, fallback) {
  const name = String(value || fallback)
    .replace(/[\r\n"\\/]+/g, "-")
    .replace(/[^a-zA-Z0-9._ -]+/g, "-")
    .trim()
    .slice(0, 140);
  return name || fallback;
}

export async function GET(request, { params }) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, "org:projects:read");
    const { messageId } = await params;
    const message = await getPrisma().message.findFirst({
      where: {
        id: String(messageId || ""),
        conversation: { projectId: access.project.id },
      },
      select: {
        id: true,
        externalId: true,
        kind: true,
        mediaUrl: true,
        metadata: true,
      },
    });

    if (!message?.mediaUrl) {
      return Response.json({ error: "Evidence not found" }, { status: 404 });
    }

    const metadata = message.metadata && typeof message.metadata === "object" && !Array.isArray(message.metadata)
      ? message.metadata
      : {};
    const media = metadata.media && typeof metadata.media === "object" ? metadata.media : {};
    const medicalEvidence = isMedicalEvidenceRecord({ ...message, metadata, media });
    if (medicalEvidence) requireTenantPermission(access, MEDICAL_EVIDENCE_PERMISSION);

    const stored = media.storage && typeof media.storage === "object"
      ? media.storage
      : {};
    const storage = stored.provider
      ? stored
      : isPrivateVercelBlobUrl(message.mediaUrl)
        ? { provider: "vercel-blob", assetId: message.mediaUrl }
        : null;
    if (!storage || !["vercel-blob", "cloudinary"].includes(storage.provider)) {
      return Response.json({ error: "Evidence not found" }, { status: 404 });
    }
    const result = await readProtectedFile(storage);
    if (!result?.stream) {
      return Response.json({ error: "Evidence not found" }, { status: 404 });
    }

    const fileName = safeFileName(media.filename, `evidence-${message.id}`);
    const asDownload = new URL(request.url).searchParams.get("download") === "1";
    const contentLength = Number.isSafeInteger(result.size)
      ? { "Content-Length": String(result.size) }
      : {};

    return new Response(result.stream, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `${medicalEvidence || asDownload ? "attachment" : "inline"}; filename="${fileName}"`,
        ...contentLength,
        "Content-Type": result.contentType || media.mimeType || "application/octet-stream",
        "Content-Security-Policy": "sandbox",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("Failed to deliver protected evidence:", error);
    return Response.json({ error: "Unable to load evidence" }, { status: 500 });
  }
}
