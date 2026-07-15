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

export async function uploadProtectedFile(file, options = {}) {
  const config = resolveCloudinaryConfig();
  if (!config) throw new Error("Cloudinary protected media storage is not configured.");

  const formData = new FormData();
  formData.append("file", file, file.name);
  formData.append("folder", options.folder || "obrasaas/protected");
  formData.append("type", "authenticated");
  if (options.context) formData.append("context", options.context);

  const authorization = Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString("base64");
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/auto/upload`,
    {
      method: "POST",
      headers: { Authorization: `Basic ${authorization}` },
      body: formData,
    },
  );
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Cloudinary upload failed (${response.status}): ${JSON.stringify(result)}`);
  }

  return {
    assetId: result.asset_id,
    publicId: result.public_id,
    resourceType: result.resource_type,
    format: result.format,
    bytes: result.bytes,
    secureUrl: result.secure_url,
  };
}
