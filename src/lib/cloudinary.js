import { createHash } from "node:crypto";
import path from "node:path";

const CLOUDINARY_RESOURCE_TYPES = new Set(["image", "video", "raw"]);
const CLOUDINARY_UPLOAD_RESOURCE_TYPES = new Set([...CLOUDINARY_RESOURCE_TYPES, "auto"]);

function resolveCloudinaryConfig() {
  if (process.env.CLOUDINARY_URL) {
    const url = new URL(process.env.CLOUDINARY_URL);
    return {
      cloudName: url.hostname,
      apiKey: decodeURIComponent(url.username),
      apiSecret: decodeURIComponent(url.password),
    };
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

export function isCloudinaryConfigured() {
  return Boolean(resolveCloudinaryConfig());
}

function deterministicPublicId(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) return null;
  return createHash("sha256").update(normalized).digest("hex").slice(0, 40);
}

function safePathSegment(value, fallback) {
  return String(value || fallback)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || fallback;
}

function safeFolder(value) {
  return String(value || "obrasaas/protected")
    .split("/")
    .filter(Boolean)
    .map((segment) => safePathSegment(segment, "files"))
    .join("/");
}

function fileFormat(fileName, mimeType = "") {
  const canonicalByMime = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
  };
  const canonical = canonicalByMime[String(mimeType).trim().toLowerCase()];
  if (canonical) return canonical;
  return safePathSegment(
    path.extname(fileName).replace(/^\./, "").toLowerCase(),
    "bin",
  ).slice(0, 16);
}

function normalizedResourceType(value, { upload = false } = {}) {
  const normalized = String(value || (upload ? "auto" : "")).trim().toLowerCase();
  const allowed = upload ? CLOUDINARY_UPLOAD_RESOURCE_TYPES : CLOUDINARY_RESOURCE_TYPES;
  if (!allowed.has(normalized)) {
    throw new Error("Cloudinary protected media has an unsupported resource type.");
  }
  return normalized;
}

export function protectedCloudinaryUploadIdentity(file, options = {}) {
  if (!(file instanceof File) || file.size < 1) {
    throw new Error("A non-empty file is required for Cloudinary protected storage.");
  }
  const resourceType = normalizedResourceType(options.resourceType, { upload: true });
  if (resourceType === "auto") {
    throw new Error("A deterministic protected upload requires an explicit resource type.");
  }
  const idempotentId = deterministicPublicId(options.idempotencyKey);
  if (!idempotentId) {
    throw new Error("A deterministic protected upload requires an idempotency key.");
  }
  const folder = safeFolder(options.folder);
  const extension = fileFormat(file.name, file.type);
  return {
    assetId: null,
    publicId: `${folder}/${idempotentId}${resourceType === "raw" ? `.${extension}` : ""}`,
    pathname: null,
    resourceType,
    format: extension,
    bytes: file.size,
    reused: false,
  };
}

export function cloudinaryApiSignature(params, apiSecret) {
  if (!apiSecret) throw new Error("Cloudinary API secret is required for signing.");
  const payload = Object.entries(params || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("&");
  return createHash("sha256").update(`${payload}${apiSecret}`).digest("hex");
}

function cloudinaryBasicAuthorization(config) {
  return `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString("base64")}`;
}

function storedCloudinaryAsset(result, file, { requestedPublicId = null } = {}) {
  const resourceType = normalizedResourceType(result.resource_type);
  const publicId = String(result.public_id || requestedPublicId || "").trim();
  const format = String(result.format || fileFormat(file.name, file.type)).trim().toLowerCase();
  if (!publicId || !format) {
    throw new Error("Cloudinary did not return a reusable protected asset identity.");
  }
  return {
    assetId: result.asset_id || null,
    publicId,
    resourceType,
    format,
    bytes: Number.isSafeInteger(result.bytes) ? result.bytes : file.size,
    secureUrl: result.secure_url || null,
    version: Number.isSafeInteger(result.version) ? result.version : null,
    reused: result.existing === true,
  };
}

async function findCloudinaryResource(config, publicId, preferredResourceType, fetchImpl, signal) {
  const candidates = preferredResourceType === "auto"
    ? ["image", "video", "raw"]
    : [normalizedResourceType(preferredResourceType)];
  for (const resourceType of candidates) {
    const response = await fetchImpl(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/resources/${resourceType}/authenticated/${encodeURIComponent(publicId)}`,
      {
        headers: { Authorization: cloudinaryBasicAuthorization(config) },
        cache: "no-store",
        signal,
      },
    );
    if (response.status === 404) continue;
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`Cloudinary protected asset lookup failed (${response.status}).`);
    }
    return { ...result, existing: true, resource_type: result.resource_type || resourceType };
  }
  return null;
}

async function reconcileDeterministicCloudinaryUpload({
  config,
  requestedPublicId,
  resourceType,
  fetchImpl,
}) {
  if (!requestedPublicId) return null;
  try {
    return await findCloudinaryResource(
      config,
      requestedPublicId,
      resourceType,
      fetchImpl,
      AbortSignal.timeout(8_000),
    );
  } catch {
    return null;
  }
}

export async function uploadProtectedFile(file, options = {}) {
  const config = resolveCloudinaryConfig();
  if (!config) throw new Error("Cloudinary protected media storage is not configured.");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("A non-empty file is required for Cloudinary protected storage.");
  }

  const fetchImpl = options.fetchImpl || fetch;
  const resourceType = normalizedResourceType(options.resourceType, { upload: true });
  const deterministicIdentity = options.idempotencyKey
    ? protectedCloudinaryUploadIdentity(file, { ...options, resourceType })
    : null;
  const requestedPublicId = deterministicIdentity?.publicId || null;
  const folder = safeFolder(options.folder);
  const timestamp = Math.floor((options.now || Date.now()) / 1_000);
  const signedParams = {
    timestamp,
    type: "authenticated",
    ...(options.context ? { context: options.context } : {}),
    ...(requestedPublicId
      ? { overwrite: "false", public_id: requestedPublicId, unique_filename: "false" }
      : { folder }),
  };

  const formData = new FormData();
  formData.append("file", file, file.name);
  for (const [key, value] of Object.entries(signedParams)) {
    formData.append(key, String(value));
  }
  formData.append("api_key", config.apiKey);
  formData.append("signature", cloudinaryApiSignature(signedParams, config.apiSecret));

  let response;
  try {
    response = await fetchImpl(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/${resourceType}/upload`,
      { method: "POST", body: formData, signal: options.signal },
    );
  } catch (error) {
    const existing = await reconcileDeterministicCloudinaryUpload({
      config,
      requestedPublicId,
      resourceType,
      fetchImpl,
    });
    if (existing) return storedCloudinaryAsset(existing, file, { requestedPublicId });
    throw error;
  }
  let result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const existing = await reconcileDeterministicCloudinaryUpload({
      config,
      requestedPublicId,
      resourceType,
      fetchImpl,
    });
    if (existing) return storedCloudinaryAsset(existing, file, { requestedPublicId });
    throw new Error(`Cloudinary upload failed (${response.status}).`);
  }
  if (
    result.existing === true
    && (!result.public_id || !result.resource_type || !result.format)
    && requestedPublicId
  ) {
    const existing = await findCloudinaryResource(
      config,
      requestedPublicId,
      resourceType,
      fetchImpl,
      options.signal,
    );
    if (!existing) {
      throw new Error("Cloudinary reported an existing asset but it could not be verified.");
    }
    result = existing;
  }

  return storedCloudinaryAsset(result, file, { requestedPublicId });
}

export function cloudinaryPrivateDownloadUrl(storage, { now = Date.now() } = {}) {
  const config = resolveCloudinaryConfig();
  if (!config) throw new Error("Cloudinary protected media delivery is not configured.");
  const resourceType = normalizedResourceType(storage?.resourceType);
  const publicId = String(storage?.publicId || "").trim();
  const format = safePathSegment(storage?.format, "").toLowerCase();
  if (!publicId || !format) {
    throw new Error("Cloudinary protected media identity is incomplete.");
  }

  const timestamp = Math.floor(now / 1_000);
  const params = {
    expires_at: timestamp + 60,
    format,
    public_id: publicId,
    timestamp,
    type: "authenticated",
  };
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) query.set(key, String(value));
  query.set("api_key", config.apiKey);
  query.set("signature", cloudinaryApiSignature(params, config.apiSecret));
  return `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/${resourceType}/download?${query}`;
}

export async function downloadProtectedFile(storage, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(
    cloudinaryPrivateDownloadUrl(storage, { now: options.now }),
    {
      cache: "no-store",
      redirect: "error",
      signal: options.signal || AbortSignal.timeout(20_000),
    },
  );
  if (!response.ok || !response.body) {
    throw new Error(`Cloudinary protected media download failed (${response.status}).`);
  }
  const size = Number(response.headers.get("content-length"));
  return {
    stream: response.body,
    size: Number.isSafeInteger(size) && size >= 0 ? size : null,
    contentType: response.headers.get("content-type") || null,
  };
}

export async function deleteProtectedFile(storage, options = {}) {
  const config = resolveCloudinaryConfig();
  if (!config) throw new Error("Cloudinary protected media deletion is not configured.");
  const resourceType = normalizedResourceType(storage?.resourceType);
  const publicId = String(storage?.publicId || "").trim();
  if (!publicId) throw new Error("Cloudinary protected media identity is incomplete.");

  const timestamp = Math.floor((options.now || Date.now()) / 1_000);
  const params = {
    invalidate: "true",
    public_id: publicId,
    timestamp,
    type: "authenticated",
  };
  const formData = new FormData();
  for (const [key, value] of Object.entries(params)) formData.append(key, String(value));
  formData.append("api_key", config.apiKey);
  formData.append("signature", cloudinaryApiSignature(params, config.apiSecret));
  const response = await (options.fetchImpl || fetch)(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/${resourceType}/destroy`,
    { method: "POST", body: formData, signal: options.signal },
  );
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !["ok", "not found"].includes(result.result)) {
    throw new Error(`Cloudinary protected media deletion failed (${response.status}).`);
  }
  return result.result === "ok";
}
