import crypto from "node:crypto";

export function isAuthorizedCronRequest(authorization, secret) {
  if (typeof secret !== "string" || !secret) return false;
  if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) return false;
  const provided = authorization.slice("Bearer ".length);
  const expectedBuffer = Buffer.from(secret);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}
