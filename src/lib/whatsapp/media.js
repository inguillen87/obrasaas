import { createHash } from "node:crypto";
import path from "node:path";
import { canTranscribeMimeType, isOpenAIConfigured, transcribeAudio } from "../ai/openai.js";
import { isProtectedStorageConfigured, uploadProtectedFile } from "../storage.js";
import { downloadWhatsAppMedia } from "./meta.js";
import {
  WHATSAPP_MEDIA_UPLOAD_CERTAINTY,
  WhatsAppMediaAssetError,
  createOrResumeWhatsAppMediaAssetIntent,
  markWhatsAppMediaAssetAvailable,
  markWhatsAppMediaAssetUploadFailure,
} from "./media-assets.js";

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
const TRANSCRIPTION_STATUSES = new Set([
  "completed",
  "disabled_by_tenant",
  "failed",
  "pending_configuration",
  "pending_conversion",
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

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function isEnrichedInboundWhatsAppMediaEvent(event) {
  const media = event?.media;
  const storage = media?.storage;
  const storedIdentity = storage?.assetId || storage?.publicId || storage?.pathname;
  const managedAssetId = typeof media?.assetId === "string" ? media.assetId.trim() : "";
  if (
    !media?.id
    || !media.filename
    || !EXTENSIONS_BY_MIME.has(media.mimeType)
    || typeof media.sha256 !== "string"
    || !media.sha256.trim()
    || !Number.isSafeInteger(media.size)
    || media.size <= 0
    || !isHttpsUrl(media.url)
    || storage?.status !== "stored"
    || !storage?.provider
    || !storedIdentity
    || (Object.hasOwn(media || {}, "assetId") && !managedAssetId)
    || (managedAssetId && storage?.ledgerAssetId !== managedAssetId)
  ) {
    return false;
  }

  if (event.kind !== "audio") return true;
  const transcription = event.transcription;
  if (!TRANSCRIPTION_STATUSES.has(transcription?.status)) return false;
  return transcription.status !== "completed"
    || (typeof transcription.text === "string" && Boolean(transcription.text.trim()));
}

export function whatsAppMediaUploadIdempotencyKey(event, downloaded) {
  const values = [
    event?.phoneNumberId,
    event?.externalId,
    event?.media?.id,
    downloaded?.sha256,
    downloaded?.size,
    downloaded?.mimeType,
  ];
  if (values.some((value) => value === null || value === undefined || String(value).trim() === "")) {
    throw new TypeError("Verified WhatsApp media identity is required for an idempotent upload.");
  }
  const digest = createHash("sha256")
    .update(`whatsapp-media\0${values.join("\0")}`)
    .digest("hex");
  return `whatsapp-media:v1:${digest}`;
}

export async function ingestAndPersistInboundWhatsAppMedia({
  leasedEvent,
  event,
  scope,
}, {
  ingest = ingestInboundWhatsAppMedia,
  persist,
  transcriptionEnabled = false,
  beforeTranscribe = null,
} = {}) {
  if (!event?.media) return event;
  if (typeof persist !== "function") {
    throw new TypeError("Durable enriched-media persistence is required for webhook ingestion.");
  }

  const wasEnriched = isEnrichedInboundWhatsAppMediaEvent(event);
  const enrichedEvent = await ingest(event, {
    scope,
    mediaAssetContext: {
      webhookEventId: leasedEvent?.id,
      webhookLeaseToken: leasedEvent?.leaseToken,
    },
    transcriptionEnabled,
    beforeTranscribe,
  });
  const isEnriched = isEnrichedInboundWhatsAppMediaEvent(enrichedEvent);
  if (!wasEnriched && isEnriched) {
    await persist({
      eventId: leasedEvent?.id,
      leaseToken: leasedEvent?.leaseToken,
      event: enrichedEvent,
      scope,
    });
  }
  return enrichedEvent;
}

export async function ingestInboundWhatsAppMedia(event, {
  scope,
  download = downloadWhatsAppMedia,
  upload = uploadProtectedFile,
  transcribe = transcribeAudio,
  storageConfigured = isProtectedStorageConfigured,
  aiConfigured = isOpenAIConfigured,
  transcriptionEnabled = false,
  beforeTranscribe = null,
  mediaAssetContext = null,
  prisma = null,
  createMediaAssetIntent = createOrResumeWhatsAppMediaAssetIntent,
  finalizeMediaAsset = markWhatsAppMediaAssetAvailable,
  failMediaAssetUpload = markWhatsAppMediaAssetUploadFailure,
} = {}) {
  if (!event?.media?.id) return event;
  if (isEnrichedInboundWhatsAppMediaEvent(event)) return event;
  if (!storageConfigured()) {
    throw new Error("Protected WhatsApp media storage is not configured.");
  }

  const downloaded = await download({
    mediaId: event.media.id,
    phoneNumberId: event.phoneNumberId,
    scope,
    expectedKind: event.kind,
    expectedMimeType: event.media.mimeType,
    expectedSha256: event.media.sha256,
  });
  const fileName = safeFileName(event.media.filename, downloaded.id, downloaded.mimeType);
  const idempotencyKey = whatsAppMediaUploadIdempotencyKey(event, downloaded);
  const file = new File([downloaded.buffer], fileName, { type: downloaded.mimeType });
  let uploadResult;
  let managedAsset = null;
  if (mediaAssetContext) {
    const database = prisma || (await import("../prisma.js")).getPrisma();
    const intent = await createMediaAssetIntent(database, {
      scope: {
        organizationId: scope?.organizationId,
        projectId: scope?.projectId,
        phoneNumberId: event.phoneNumberId,
      },
      webhookEventId: mediaAssetContext.webhookEventId,
      webhookLeaseToken: mediaAssetContext.webhookLeaseToken,
      providerMessageId: event.externalId,
      providerMediaId: event.media.id,
      mediaKind: event.kind,
      declaredMimeType: downloaded.mimeType,
      file,
      contentSha256: downloaded.sha256,
    });
    if (intent.dispatch) {
      try {
        uploadResult = await upload(file, intent.upload.options);
      } catch (error) {
        let isolated = false;
        try {
          await failMediaAssetUpload(database, {
            scope,
            mediaAssetId: intent.mediaAssetId,
            uploadLeaseToken: intent.uploadLeaseToken,
            certainty: WHATSAPP_MEDIA_UPLOAD_CERTAINTY.UNCERTAIN,
            errorCode: error?.code,
          });
          isolated = true;
        } catch {
          // The durable upload lease still prevents an immediate redispatch.
          // A later worker pass will isolate the expired intent for cleanup.
        }
        if (isolated) {
          throw new WhatsAppMediaAssetError(
            "El proveedor no confirmó la carga privada; el objeto quedó aislado para limpieza.",
            "WHATSAPP_MEDIA_ASSET_UPLOAD_UNCERTAIN",
            409,
          );
        }
        throw error;
      }
      managedAsset = await finalizeMediaAsset(database, {
        scope,
        mediaAssetId: intent.mediaAssetId,
        uploadLeaseToken: intent.uploadLeaseToken,
        uploaded: uploadResult,
        fileName,
        mimeType: downloaded.mimeType,
      });
    } else {
      managedAsset = intent;
    }
    if (!managedAsset?.descriptor || managedAsset.descriptor.assetId !== managedAsset.mediaAssetId) {
      throw new WhatsAppMediaAssetError(
        "El registro durable del medio no devolvió un descriptor verificable.",
        "WHATSAPP_MEDIA_ASSET_DESCRIPTOR_INVALID",
        500,
      );
    }
    uploadResult = {
      ...managedAsset.descriptor.storage,
      secureUrl: managedAsset.descriptor.url,
    };
  } else {
    // Kept only for isolated/local callers. Production webhook ingestion always
    // supplies mediaAssetContext through ingestAndPersistInboundWhatsAppMedia.
    uploadResult = await upload(file, {
      folder: `obrasaas/whatsapp/${safeContextValue(event.phoneNumberId)}`,
      context: [
        `phone_number_id=${safeContextValue(event.phoneNumberId)}`,
        `message_id=${safeContextValue(event.externalId)}`,
        `kind=${safeContextValue(event.kind)}`,
      ].join("|"),
      idempotencyKey,
    });
  }

  let transcription = null;
  if (event.kind === "audio") {
    if (!transcriptionEnabled) {
      transcription = { status: "disabled_by_tenant", provider: "openai", text: null };
    } else if (!aiConfigured()) {
      transcription = { status: "pending_configuration", provider: "openai", text: null };
    } else if (!canTranscribeMimeType(downloaded.mimeType)) {
      transcription = { status: "pending_conversion", provider: "openai", text: null };
    } else {
      if (typeof beforeTranscribe === "function") await beforeTranscribe();
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
      ...(managedAsset ? { assetId: managedAsset.mediaAssetId } : {}),
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
        reused: uploadResult.reused === true,
        ...(managedAsset ? { ledgerAssetId: managedAsset.mediaAssetId } : {}),
      },
    },
  };
}
