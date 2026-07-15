import path from "node:path";
import { put } from "@vercel/blob";
import {
  isCloudinaryConfigured,
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

function safeBlobPath(folder, fileName) {
  const safeFolder = String(folder || "obrasaas/protected")
    .split("/")
    .filter(Boolean)
    .map((segment) => safePathSegment(segment, "files"))
    .join("/");
  return `${safeFolder}/${Date.now()}-${safePathSegment(path.basename(fileName), "file.bin")}`;
}

function fileFormat(fileName) {
  const extension = path.extname(fileName).replace(/^\./, "").toLowerCase();
  return extension || null;
}

export function isProtectedStorageConfigured() {
  return isVercelBlobConfigured() || isCloudinaryConfigured();
}

async function uploadVercelPrivateBlob(file, options) {
  const pathname = safeBlobPath(options.folder, file.name);
  const blob = await put(pathname, file, {
    access: "private",
    addRandomSuffix: true,
    cacheControlMaxAge: 3600,
    contentType: file.type || "application/octet-stream",
  });

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
  };
}

export async function uploadProtectedFile(file, options = {}) {
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("A non-empty file is required for protected storage.");
  }

  const preferredProvider = process.env.PRIVATE_MEDIA_PROVIDER || "vercel-blob";
  if (preferredProvider === "cloudinary" && isCloudinaryConfigured()) {
    return {
      provider: "cloudinary",
      ...await uploadCloudinaryProtectedFile(file, options),
    };
  }
  if (isVercelBlobConfigured()) {
    return uploadVercelPrivateBlob(file, options);
  }
  if (isCloudinaryConfigured()) {
    return {
      provider: "cloudinary",
      ...await uploadCloudinaryProtectedFile(file, options),
    };
  }
  throw new Error("Protected media storage is not configured.");
}
