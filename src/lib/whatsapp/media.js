import path from "node:path";
import { canTranscribeMimeType, isOpenAIConfigured, transcribeAudio } from "../ai/openai.js";
import { isProtectedStorageConfigured, uploadProtectedFile } from "../storage.js";
import { downloadWhatsAppMedia } from "./meta.js";

const EXTENSIONS_BY_MIME = new Map([
  ["audio/aac", "aac"],
  ["audio/amr", "amr"],
  ["audio/mp4", "m4a"],
  ["audio/mpeg", "mp3"],
  ["audio/ogg", "ogg"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["video/mp4", "mp4"],
  ["video/3gpp", "3gp"],
  ["application/pdf", "pdf"],
  ["text/plain", "txt"],
  ["application/msword", "doc"],
  ["application/vnd.ms-excel", "xls"],
  ["application/vnd.ms-powerpoint", "ppt"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"],
  ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "pptx"],
]);

function safeContextValue(value) {
  return String(value || "unknown").replace(/[^a-zA-Z0-9_.:-]+/g, "_").slice(0, 180);
}

function safeFileName(originalName, mediaId, mimeType) {
  const extension = EXTENSIONS_BY_MIME.get(mimeType) || "bin";
  const baseName = path.basename(String(originalName || `${mediaId}.${extension}`))
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return baseName || `${mediaId}.${extension}`;
}

export async function ingestInboundWhatsAppMedia(event, {
  download = downloadWhatsAppMedia,
  upload = uploadProtectedFile,
  transcribe = transcribeAudio,
  storageConfigured = isProtectedStorageConfigured,
  aiConfigured = isOpenAIConfigured,
} = {}) {
  if (!event?.media?.id) return event;
  if (!storageConfigured()) {
    throw new Error("Protected WhatsApp media storage is not configured.");
  }

  const downloaded = await download({
    mediaId: event.media.id,
    phoneNumberId: event.phoneNumberId,
    expectedKind: event.kind,
    expectedMimeType: event.media.mimeType,
    expectedSha256: event.media.sha256,
  });
  const fileName = safeFileName(event.media.filename, downloaded.id, downloaded.mimeType);
  const uploadResult = await upload(
    new File([downloaded.buffer], fileName, { type: downloaded.mimeType }),
    {
      folder: `obrasaas/whatsapp/${safeContextValue(event.phoneNumberId)}`,
      context: [
        `phone_number_id=${safeContextValue(event.phoneNumberId)}`,
        `message_id=${safeContextValue(event.externalId)}`,
        `kind=${safeContextValue(event.kind)}`,
      ].join("|"),
    },
  );

  let transcription = null;
  if (event.kind === "audio") {
    if (!aiConfigured()) {
      transcription = { status: "pending_configuration", provider: "openai", text: null };
    } else if (!canTranscribeMimeType(downloaded.mimeType)) {
      transcription = { status: "pending_conversion", provider: "openai", text: null };
    } else {
      try {
        const result = await transcribe({
          buffer: downloaded.buffer,
          mimeType: downloaded.mimeType,
          fileName,
          language: "es",
        });
        transcription = { ...result, status: "completed" };
      } catch (error) {
        console.error(`WhatsApp audio transcription failed for ${event.externalId}:`, error);
        transcription = { status: "failed", provider: "openai", text: null };
      }
    }
  }

  return {
    ...event,
    text: event.text || transcription?.text || "",
    transcription,
    media: {
      ...event.media,
      filename: fileName,
      mimeType: downloaded.mimeType,
      sha256: downloaded.sha256,
      size: downloaded.size,
      url: uploadResult.secureUrl,
      storage: {
        provider: uploadResult.provider || "protected-storage",
        status: "stored",
        assetId: uploadResult.assetId,
        publicId: uploadResult.publicId,
        resourceType: uploadResult.resourceType,
        format: uploadResult.format,
        bytes: uploadResult.bytes,
        pathname: uploadResult.pathname || null,
      },
    },
  };
}
