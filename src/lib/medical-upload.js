import { createHash } from "node:crypto";

export const MAX_MEDICAL_CERTIFICATE_MEGABYTES = 4;
export const MAX_MEDICAL_CERTIFICATE_BYTES = MAX_MEDICAL_CERTIFICATE_MEGABYTES * 1024 * 1024;
export const MAX_MEDICAL_MULTIPART_BYTES = MAX_MEDICAL_CERTIFICATE_BYTES + (128 * 1024);

const MEDICAL_FILE_TYPES = Object.freeze({
  PDF: Object.freeze({ mimeType: "application/pdf", extension: "pdf" }),
  JPEG: Object.freeze({ mimeType: "image/jpeg", extension: "jpg" }),
  PNG: Object.freeze({ mimeType: "image/png", extension: "png" }),
  WEBP: Object.freeze({ mimeType: "image/webp", extension: "webp" }),
});

function bytesEqual(bytes, offset, expected) {
  if (bytes.length < offset + expected.length) return false;
  return expected.every((value, index) => bytes[offset + index] === value);
}

function isAsciiDigit(value) {
  return value >= 0x30 && value <= 0x39;
}

export function detectMedicalCertificateFileType(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input || 0);
  if (
    bytesEqual(bytes, 0, [0x25, 0x50, 0x44, 0x46, 0x2d])
    && isAsciiDigit(bytes[5])
    && bytes[6] === 0x2e
    && isAsciiDigit(bytes[7])
  ) {
    return MEDICAL_FILE_TYPES.PDF;
  }
  if (
    bytesEqual(bytes, 0, [0xff, 0xd8, 0xff])
    && bytes[3] >= 0xc0
    && bytes[3] <= 0xfe
    && ![0xd8, 0xd9].includes(bytes[3])
  ) {
    return MEDICAL_FILE_TYPES.JPEG;
  }
  if (
    bytesEqual(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    && bytesEqual(bytes, 12, [0x49, 0x48, 0x44, 0x52])
  ) {
    return MEDICAL_FILE_TYPES.PNG;
  }
  if (
    bytesEqual(bytes, 0, [0x52, 0x49, 0x46, 0x46])
    && bytesEqual(bytes, 8, [0x57, 0x45, 0x42, 0x50])
    && (
      bytesEqual(bytes, 12, [0x56, 0x50, 0x38, 0x20])
      || bytesEqual(bytes, 12, [0x56, 0x50, 0x38, 0x4c])
      || bytesEqual(bytes, 12, [0x56, 0x50, 0x38, 0x58])
    )
  ) {
    return MEDICAL_FILE_TYPES.WEBP;
  }
  return null;
}

export async function inspectMedicalCertificateFile(file) {
  if (!(file instanceof File) || file.size === 0) return null;
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  return detectMedicalCertificateFileType(header);
}

function safeMedicalFileBaseName(fileName) {
  const leaf = String(fileName || "certificado-medico")
    .split(/[\\/]/)
    .pop()
    .replace(/\.[^.]*$/, "");
  return leaf
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "certificado-medico";
}

export function normalizedMedicalCertificateFile(file, detectedType) {
  if (!(file instanceof File) || !detectedType?.mimeType || !detectedType?.extension) {
    throw new TypeError("A validated medical certificate file is required.");
  }
  return new File(
    [file],
    `${safeMedicalFileBaseName(file.name)}.${detectedType.extension}`,
    {
      type: detectedType.mimeType,
      lastModified: Number.isFinite(file.lastModified) ? file.lastModified : Date.now(),
    },
  );
}

export async function medicalCertificateUploadIdempotencyKey({
  file,
  projectId,
  workerId,
  tokenFingerprint,
}) {
  if (
    !(file instanceof File)
    || file.size === 0
    || !String(projectId || "").trim()
    || !String(workerId || "").trim()
    || !String(tokenFingerprint || "").trim()
  ) {
    throw new TypeError("Validated certificate and claimed token identity are required for upload idempotency.");
  }
  const fileDigest = createHash("sha256")
    .update(new Uint8Array(await file.arrayBuffer()))
    .digest("hex");
  const digest = createHash("sha256")
    .update([
      "medical-certificate",
      "v1",
      String(projectId).trim(),
      String(workerId).trim(),
      String(tokenFingerprint).trim(),
      fileDigest,
    ].join("\0"))
    .digest("hex");
  return `medical-certificate:v1:${digest}`;
}

export function shouldDeleteUncommittedMedicalUpload({
  upload,
  uploadedMediaUrl,
  committedMediaUrl,
}) {
  return Boolean(
    upload
    && upload.reused !== true
    && String(uploadedMediaUrl || "")
    && String(committedMediaUrl || "") !== String(uploadedMediaUrl),
  );
}

export function buildProtectedMedicalMedia({ upload, file, detectedType }) {
  const storageIdentity = upload?.assetId || upload?.publicId || upload?.pathname;
  const protectedUrl = upload?.secureUrl || upload?.downloadUrl || upload?.assetId;
  if (
    !(file instanceof File)
    || !detectedType?.mimeType
    || !upload?.provider
    || !storageIdentity
    || !protectedUrl
  ) {
    throw new TypeError("A completed protected upload is required.");
  }

  return {
    kind: "document",
    sensitivity: "medical",
    url: protectedUrl,
    filename: file.name,
    mimeType: detectedType.mimeType,
    size: Number.isSafeInteger(upload.bytes) ? upload.bytes : file.size,
    storage: {
      provider: upload.provider,
      status: "stored",
      sensitivity: "medical",
      assetId: upload.assetId || null,
      publicId: upload.publicId || null,
      pathname: upload.pathname || null,
      resourceType: upload.resourceType || null,
      format: upload.format || detectedType.extension,
      bytes: Number.isSafeInteger(upload.bytes) ? upload.bytes : file.size,
      version: Number.isSafeInteger(upload.version) ? upload.version : null,
    },
  };
}

export function isProtectedMedicalMedia(media) {
  const storage = media?.storage;
  return Boolean(
    media?.url
    && storage?.status === "stored"
    && storage?.provider
    && (storage.assetId || storage.publicId || storage.pathname),
  );
}

export function medicalFlowRecord({ days, workerName, media, uploadLink }) {
  const safeDays = Math.min(30, Math.max(1, Number(days) || 1));
  const safeWorkerName = String(workerName || "la persona autorizada");
  const hasEvidence = isProtectedMedicalMedia(media);

  if (hasEvidence) {
    return {
      hasEvidence: true,
      attendanceStatus: `Licencia informada con certificado (${safeDays} días)`,
      title: "Certificado médico recibido",
      description: `Licencia informada de ${safeWorkerName}. El certificado quedó almacenado como evidencia protegida.`,
      badge: "Evidencia protegida",
      reply: "Certificado recibido y asociado al registro de la persona. La licencia quedó informada al equipo autorizado.",
    };
  }

  return {
    hasEvidence: false,
    attendanceStatus: `Licencia informada · certificado pendiente (${safeDays} días)`,
    title: "Licencia informada sin certificado",
    description: `Licencia informada de ${safeWorkerName}, pendiente de adjuntar el certificado.`,
    badge: "Certificado pendiente",
    reply: `La licencia quedó informada, pero falta adjuntar el certificado.${uploadLink ? ` Cargalo desde este enlace seguro:\n${uploadLink}` : ""}`,
  };
}
