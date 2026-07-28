import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  requireTenantPermission,
} from "@/lib/access";
import {
  MEDICAL_EVIDENCE_PERMISSION,
  SOURCE_EVIDENCE_PERMISSION,
  isMedicalEvidenceRecord,
  isRestrictedEvidenceRecord,
} from "@/lib/medical-privacy";
import { getPrisma } from "@/lib/prisma";
import {
  isPrivateVercelBlobUrl,
  readProtectedFile,
} from "@/lib/storage";
import {
  WHATSAPP_MEDIA_ASSET_DESCRIPTOR_SELECT,
  resolveClaimedWhatsAppMessageMedia,
} from "@/lib/whatsapp/media-assets";

export const runtime = "nodejs";
export const maxDuration = 60;

const SAFE_INLINE_EVIDENCE_TYPES = new Set([
  "application/pdf",
  "audio/aac",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

function safeFileName(value, fallback) {
  const name = String(value || fallback)
    .replace(/[\r\n"\\/]+/g, "-")
    .replace(/[^a-zA-Z0-9._ -]+/g, "-")
    .trim()
    .slice(0, 140);
  return name || fallback;
}

function privateJson(body, status) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function evidenceNotFound() {
  return privateJson({ error: "Evidence not found" }, 404);
}

function jsonObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizedMimeType(value) {
  return String(value || "").split(";", 1)[0].trim().toLowerCase();
}

function managedAssetMarker(media) {
  if (!Object.hasOwn(media, "assetId")) return { present: false, value: null };
  return {
    present: true,
    value: typeof media.assetId === "string" ? media.assetId.trim() : "",
  };
}

async function discardStream(stream) {
  if (typeof stream?.cancel !== "function") return;
  await Promise.resolve(stream.cancel("Managed evidence descriptor mismatch."))
    .catch(() => undefined);
}

export function createEvidenceHandlers({
  resolveAccess = getPlatformAccess,
  authorize = requireTenantPermission,
  prismaFactory = getPrisma,
  readFile = readProtectedFile,
  isPrivateBlobUrl = isPrivateVercelBlobUrl,
  resolveManagedMedia = resolveClaimedWhatsAppMessageMedia,
  reportFailure = () => console.error("Protected evidence delivery failed."),
} = {}) {
  async function GET(request, { params }) {
    try {
      const access = await resolveAccess();
      authorize(access, "org:projects:read");
      const { messageId } = await params;
      const message = await prismaFactory().message.findFirst({
        where: {
          id: String(messageId || ""),
          conversation: { projectId: access.project.id },
        },
        select: {
          id: true,
          conversationId: true,
          direction: true,
          externalId: true,
          kind: true,
          body: true,
          mediaUrl: true,
          metadata: true,
          whatsappMediaAsset: { select: WHATSAPP_MEDIA_ASSET_DESCRIPTOR_SELECT },
        },
      });

      if (!message || !Object.hasOwn(message, "whatsappMediaAsset")) {
        return evidenceNotFound();
      }

      const metadata = jsonObject(message.metadata);
      const media = jsonObject(metadata.media);
      const marker = managedAssetMarker(media);
      const evidenceRecord = { ...message, metadata, media };
      const medicalEvidence = isMedicalEvidenceRecord(evidenceRecord);
      const restrictedEvidence = isRestrictedEvidenceRecord(evidenceRecord);
      if (medicalEvidence) {
        authorize(access, MEDICAL_EVIDENCE_PERMISSION);
      } else if (restrictedEvidence) {
        authorize(access, SOURCE_EVIDENCE_PERMISSION);
      }

      let managedMedia = null;
      if (message.whatsappMediaAsset !== null) {
        try {
          managedMedia = resolveManagedMedia(message, {
            scope: {
              organizationId: access.organization.id,
              projectId: access.project.id,
            },
          });
        } catch {
          return evidenceNotFound();
        }
        if (
          !managedMedia?.descriptor
          || (marker.present && marker.value !== managedMedia.descriptor.assetId)
        ) {
          return evidenceNotFound();
        }
      } else if (marker.present) {
        return evidenceNotFound();
      }

      let storage;
      let expectedMimeType = null;
      let expectedSize = null;
      let fileNameSource;
      if (managedMedia) {
        storage = managedMedia.descriptor.storage;
        expectedMimeType = normalizedMimeType(managedMedia.descriptor.mimeType);
        expectedSize = managedMedia.descriptor.size;
        fileNameSource = managedMedia.descriptor.filename;
      } else {
        if (!message.mediaUrl) return evidenceNotFound();
        const stored = jsonObject(media.storage);
        storage = stored.provider
          ? stored
          : isPrivateBlobUrl(message.mediaUrl)
            ? { provider: "vercel-blob", assetId: message.mediaUrl }
            : null;
        fileNameSource = media.filename;
      }

      if (!storage || !["vercel-blob", "cloudinary"].includes(storage.provider)) {
        return evidenceNotFound();
      }
      const result = await readFile(storage);
      if (!result?.stream) return evidenceNotFound();

      const observedMimeType = normalizedMimeType(result.contentType);
      if (
        managedMedia
        && (
          !Number.isSafeInteger(result.size)
          || result.size !== expectedSize
          || observedMimeType !== expectedMimeType
        )
      ) {
        await discardStream(result.stream);
        return evidenceNotFound();
      }

      const fileName = safeFileName(fileNameSource, `evidence-${message.id}`);
      const searchParams = new URL(request.url).searchParams;
      const asDownload = searchParams.get("download") === "1";
      const contentType = managedMedia
        ? expectedMimeType
        : result.contentType || media.mimeType || "application/octet-stream";
      const normalizedContentType = normalizedMimeType(contentType);
      const inlinePreview = (
        searchParams.get("preview") === "1"
        && SAFE_INLINE_EVIDENCE_TYPES.has(normalizedContentType)
      );
      const contentLength = Number.isSafeInteger(result.size)
        ? { "Content-Length": String(result.size) }
        : {};

      return new Response(result.stream, {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store",
          "Content-Disposition": `${asDownload || (restrictedEvidence && !inlinePreview) ? "attachment" : "inline"}; filename="${fileName}"`,
          ...contentLength,
          "Content-Type": contentType,
          "Content-Security-Policy": "sandbox",
          "Cross-Origin-Resource-Policy": "same-origin",
          "Referrer-Policy": "no-referrer",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch (error) {
      if (error instanceof AccessError) return accessErrorResponse(error);
      try {
        reportFailure();
      } catch {
        // Reporting must never alter the fail-closed response.
      }
      return privateJson({ error: "Unable to load evidence" }, 500);
    }
  }

  return { GET };
}

export const { GET } = createEvidenceHandlers();
