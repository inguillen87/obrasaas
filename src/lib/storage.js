import { createHash } from "node:crypto";
import path from "node:path";
import { BlobNotFoundError, del, get, head, put } from "@vercel/blob";
import {
  deleteProtectedFile as deleteCloudinaryProtectedFile,
  downloadProtectedFile as downloadCloudinaryProtectedFile,
  isCloudinaryConfigured,
  protectedCloudinaryUploadIdentity,
  uploadProtectedFile as uploadCloudinaryProtectedFile,
} from "./cloudinary.js";

function isVercelBlobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_OIDC_TOKEN);
}

function safePathSegment(value, fallback) {
  return String(value || fallback)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140) || fallback;
}

function idempotencyDigest(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) return null;
  return createHash("sha256").update(normalized).digest("hex").slice(0, 40);
}

export function protectedUploadPathname({ folder, fileName, idempotencyKey, now = Date.now() }) {
  const safeFolder = String(folder || "obrasaas/protected")
    .split("/")
    .filter(Boolean)
    .map((segment) => safePathSegment(segment, "files"))
    .join("/");
  const prefix = idempotencyDigest(idempotencyKey) || String(now);
  return `${safeFolder}/${prefix}-${safePathSegment(path.basename(fileName), "file.bin")}`;
}

function fileFormat(fileName) {
  const extension = path.extname(fileName).replace(/^\./, "").toLowerCase();
  return extension || null;
}

export function isProtectedStorageConfigured() {
  try {
    resolveProtectedStorageProvider();
    return true;
  } catch {
    return false;
  }
}

export function resolveProtectedStorageProvider() {
  const selectedProvider = String(process.env.PRIVATE_MEDIA_PROVIDER || "").trim();
  if (selectedProvider && !["vercel-blob", "cloudinary"].includes(selectedProvider)) {
    throw new Error("The selected protected media provider is not supported.");
  }
  if (selectedProvider === "vercel-blob") {
    if (!isVercelBlobConfigured()) {
      throw new Error("The selected Vercel Blob protected media provider is not configured.");
    }
    return selectedProvider;
  }
  if (selectedProvider === "cloudinary") {
    if (!isCloudinaryConfigured()) {
      throw new Error("The selected Cloudinary protected media provider is not configured.");
    }
    return selectedProvider;
  }
  if (isVercelBlobConfigured()) return "vercel-blob";
  if (isCloudinaryConfigured()) return "cloudinary";
  throw new Error("Protected media storage is not configured.");
}

function normalizeContentType(value) {
  return String(value || "application/octet-stream").split(";", 1)[0].trim().toLowerCase();
}

function storedVercelBlob(blob, file, { reused }) {
  return {
    provider: "vercel-blob",
    assetId: blob.url,
    publicId: blob.pathname,
    pathname: blob.pathname,
    resourceType: file.type?.split("/", 1)[0] || "raw",
    format: fileFormat(file.name),
    bytes: file.size,
    secureUrl: blob.url,
    downloadUrl: blob.downloadUrl || null,
    reused,
  };
}

function assertMatchingStoredBlob(blob, file, pathname) {
  if (
    blob.pathname !== pathname
    || blob.size !== file.size
    || normalizeContentType(blob.contentType) !== normalizeContentType(file.type)
  ) {
    throw new Error("Protected media idempotency key resolved to a different stored object.");
  }
}

async function findVercelPrivateBlob(pathname, file, abortSignal) {
  try {
    const blob = await head(pathname, { abortSignal });
    assertMatchingStoredBlob(blob, file, pathname);
    return storedVercelBlob(blob, file, { reused: true });
  } catch (error) {
    if (error instanceof BlobNotFoundError) return null;
    throw error;
  }
}

async function uploadVercelPrivateBlob(file, options) {
  const pathname = protectedUploadPathname({
    folder: options.folder,
    fileName: file.name,
    idempotencyKey: options.idempotencyKey,
  });
  const deterministic = Boolean(idempotencyDigest(options.idempotencyKey));
  if (deterministic) {
    const existing = await findVercelPrivateBlob(pathname, file, options.signal);
    if (existing) return existing;
  }

  let blob;
  try {
    blob = await put(pathname, file, {
      access: "private",
      addRandomSuffix: !deterministic,
      allowOverwrite: false,
      cacheControlMaxAge: 3600,
      contentType: file.type || "application/octet-stream",
      abortSignal: options.signal,
    });
  } catch (error) {
    // A timeout or concurrent retry can happen after Blob accepted the write.
    // Re-read only deterministic paths and reuse the object if it matches.
    if (deterministic) {
      try {
        const existing = await findVercelPrivateBlob(pathname, file, options.signal);
        if (existing) return existing;
      } catch {
        // Preserve the original write error; it is the actionable failure.
      }
    }
    throw error;
  }

  return storedVercelBlob({ ...blob, size: file.size }, file, { reused: false });
}

export function protectedUploadExpectedStorage(file, options = {}) {
  if (!(file instanceof File) || file.size < 1) {
    throw new Error("A non-empty file is required for protected storage.");
  }
  const provider = options.provider || resolveProtectedStorageProvider();
  if (provider === "cloudinary") {
    return {
      provider,
      ...protectedCloudinaryUploadIdentity(file, options),
    };
  }
  if (provider !== "vercel-blob") {
    throw new Error("The selected protected media provider is not supported.");
  }
  const pathname = protectedUploadPathname({
    folder: options.folder,
    fileName: file.name,
    idempotencyKey: options.idempotencyKey,
  });
  return {
    provider,
    assetId: null,
    publicId: pathname,
    pathname,
    resourceType: options.resourceType || file.type?.split("/", 1)[0] || "raw",
    format: fileFormat(file.name),
    bytes: file.size,
    reused: false,
  };
}

export async function uploadProtectedFile(file, options = {}) {
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("A non-empty file is required for protected storage.");
  }

  const selectedProvider = options.provider || resolveProtectedStorageProvider();
  if (selectedProvider === "cloudinary") {
    return {
      provider: "cloudinary",
      ...await uploadCloudinaryProtectedFile(file, options),
    };
  }
  if (selectedProvider === "vercel-blob") {
    return uploadVercelPrivateBlob(file, options);
  }
  throw new Error("The selected protected media provider is not supported.");
}

export function isPrivateVercelBlobUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && (
        url.hostname === "private.blob.vercel-storage.com"
        || url.hostname.endsWith(".private.blob.vercel-storage.com")
      );
  } catch {
    return false;
  }
}

export async function readProtectedFile(storage, options = {}) {
  if (storage?.provider === "vercel-blob") {
    const assetId = String(storage.assetId || "").trim();
    const pathname = String(storage.pathname || "").trim();
    const identity = isPrivateVercelBlobUrl(assetId) ? assetId : pathname;
    if (!identity || (assetId && !isPrivateVercelBlobUrl(assetId))) {
      throw new Error("Vercel Blob protected media identity is invalid.");
    }
    const result = await get(identity, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    return {
      stream: result.stream,
      size: result.blob.size,
      contentType: result.blob.contentType || null,
    };
  }
  if (storage?.provider === "cloudinary") {
    if (!isCloudinaryConfigured()) {
      throw new Error("Cloudinary protected media delivery is not configured.");
    }
    return downloadCloudinaryProtectedFile(storage, options);
  }
  throw new Error("Protected media provider is not supported for delivery.");
}

export async function deleteProtectedFile(storage, options = {}) {
  if (storage?.reused === true) return false;
  if (storage?.provider === "vercel-blob") {
    const identity = storage.pathname || storage.assetId;
    if (!identity) throw new Error("Vercel Blob protected media identity is incomplete.");
    await del(identity, { abortSignal: options.signal });
    return true;
  }
  if (storage?.provider === "cloudinary") {
    return deleteCloudinaryProtectedFile(storage, options);
  }
  throw new Error("Protected media provider is not supported for deletion.");
}
