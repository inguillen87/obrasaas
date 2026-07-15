import crypto from "node:crypto";

const DEFAULT_TOKEN_TTL_SECONDS = 2 * 60 * 60;
const LOCAL_DEVELOPMENT_SECRET = "obrasaas-local-only-webview-secret";

function isHostedRuntime() {
  return Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";
}

function resolveWebviewSecret(explicitSecret) {
  const secret = explicitSecret || process.env.WEBVIEW_TOKEN_SECRET || process.env.JWT_SECRET;
  if (secret) return secret;
  if (!isHostedRuntime()) return LOCAL_DEVELOPMENT_SECRET;
  throw new Error("WEBVIEW_TOKEN_SECRET is required in production.");
}

function sign(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

/**
 * Creates a signed, expiring webview token. The worker identifier lives inside
 * the signed payload, so changing either the subject or expiration invalidates it.
 */
export function generateWebviewToken(workerId, options = {}) {
  if (!workerId) throw new Error("workerId is required to generate a webview token.");

  const now = options.now ?? Date.now();
  const ttlSeconds = options.ttlSeconds ?? DEFAULT_TOKEN_TTL_SECONDS;
  const payload = Buffer.from(
    JSON.stringify({
      v: 1,
      sub: String(workerId),
      aud: options.purpose || "webview",
      ctx: options.scope ? String(options.scope) : null,
      exp: Math.floor(now / 1000) + ttlSeconds,
    }),
  ).toString("base64url");
  const signature = sign(payload, resolveWebviewSecret(options.secret));
  return `${payload}.${signature}`;
}

export function readWebviewToken(workerId, token, options = {}) {
  if (!workerId || !token || !token.includes(".")) return null;

  try {
    const [payload, providedSignature, extra] = token.split(".");
    if (!payload || !providedSignature || extra) return null;
    const expectedSignature = sign(payload, resolveWebviewSecret(options.secret));
    if (!safeEqual(providedSignature, expectedSignature)) return null;

    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const nowSeconds = Math.floor((options.now ?? Date.now()) / 1000);
    const purposeMatches = !options.purpose || decoded.aud === options.purpose;
    const scopeMatches = !options.scope || decoded.ctx === String(options.scope);
    if (
      decoded.v !== 1 ||
      decoded.sub !== String(workerId) ||
      !purposeMatches ||
      !scopeMatches ||
      !Number.isInteger(decoded.exp) ||
      decoded.exp < nowSeconds
    ) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function verifyWebviewToken(workerId, token, options = {}) {
  return Boolean(readWebviewToken(workerId, token, options));
}

/**
 * Legacy Twilio sandbox validation. Hosted environments fail closed when the
 * auth token is missing; the official Meta endpoint has its own SHA-256 check.
 */
export async function verifyTwilioSignature(request, authToken) {
  if (!authToken) return !isHostedRuntime();

  try {
    const signature = request.headers.get("x-twilio-signature");
    if (!signature) return false;

    const clone = request.clone();
    const formData = await clone.formData();
    const params = [...formData.entries()].sort(([left], [right]) => left.localeCompare(right));
    const signatureString = params.reduce(
      (value, [key, item]) => `${value}${key}${item}`,
      request.url,
    );
    const expectedSignature = crypto
      .createHmac("sha1", authToken)
      .update(signatureString)
      .digest("base64");

    return safeEqual(expectedSignature, signature);
  } catch (error) {
    console.error("Twilio signature validation failed:", error);
    return false;
  }
}
