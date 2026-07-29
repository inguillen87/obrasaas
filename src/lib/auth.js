import crypto from "node:crypto";

const DEFAULT_TOKEN_TTL_SECONDS = 2 * 60 * 60;
const LOCAL_DEVELOPMENT_SECRET = "obrasaas-local-only-webview-secret";
const MIN_WEBVIEW_SECRET_BYTES = 32;

export const ATTENDANCE_ACTIONS = Object.freeze({
  CHECK_IN: "CHECK_IN",
  BREAK_START: "BREAK_START",
  BREAK_END: "BREAK_END",
  CHECK_OUT: "CHECK_OUT",
});

// Rolling-deploy bridge for attendance links issued by the pre-action-bound
// webview. V1 links already expire after two hours; this additional hard stop
// makes the temporary parser removable and prevents indefinite legacy use.
// TODO(attendance-webview-v1-removal): remove the v1 branch after this instant.
export const ATTENDANCE_V1_COMPATIBILITY = Object.freeze({
  acceptUntilExclusive: "2026-08-31T03:00:00.000Z",
  removalMarker: "attendance-webview-v1-remove-after-2026-08-31",
});

const ATTENDANCE_V1_ACCEPT_UNTIL_SECONDS = Math.floor(
  Date.parse(ATTENDANCE_V1_COMPATIBILITY.acceptUntilExclusive) / 1_000,
);

const ATTENDANCE_ACTION_VALUES = new Set(Object.values(ATTENDANCE_ACTIONS));
const ATTENDANCE_TOKEN_CLOCK_SKEW_SECONDS = 30;

export function isAttendanceAction(value) {
  return typeof value === "string" && ATTENDANCE_ACTION_VALUES.has(value);
}

function attendanceAction(value) {
  if (!isAttendanceAction(value)) {
    throw new Error("A valid attendance action is required for an attendance webview token.");
  }
  return value;
}

function attendanceResourceId(value, field) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (
    !normalized
    || normalized.length > 190
    || /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    throw new Error(`${field} is required for an attendance webview token.`);
  }
  return normalized;
}

function attendanceBinding(action, options) {
  if (action === ATTENDANCE_ACTIONS.CHECK_IN) {
    if (
      options.shiftId !== undefined
      || options.shiftRevision !== undefined
    ) {
      throw new Error("CHECK_IN attendance tokens cannot target a shift.");
    }
    return {
      pid: attendanceResourceId(options.pendingEntryId, "pendingEntryId"),
    };
  }

  if (options.pendingEntryId !== undefined) {
    throw new Error("Shift attendance tokens cannot target a pending check-in.");
  }
  const revision = Number(options.shiftRevision);
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new Error("shiftRevision must be a non-negative safe integer for an attendance webview token.");
  }
  return {
    sid: attendanceResourceId(options.shiftId, "shiftId"),
    rev: revision,
  };
}

function validAttendanceResourceId(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 190
    && !/[\u0000-\u001f\u007f]/.test(value);
}

function validSignedAttendanceBinding(decoded, action) {
  if (!Number.isInteger(decoded.iat)) return false;
  if (action === ATTENDANCE_ACTIONS.CHECK_IN) {
    return validAttendanceResourceId(decoded.pid)
      && !Object.hasOwn(decoded, "sid")
      && !Object.hasOwn(decoded, "rev");
  }
  return validAttendanceResourceId(decoded.sid)
    && Number.isSafeInteger(decoded.rev)
    && decoded.rev >= 0
    && !Object.hasOwn(decoded, "pid");
}

function isHostedRuntime() {
  return Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";
}

function resolveWebviewSecret(explicitSecret) {
  const hosted = isHostedRuntime();
  const secret = explicitSecret
    || process.env.WEBVIEW_TOKEN_SECRET
    || (!hosted ? process.env.JWT_SECRET : null)
    || (!hosted ? LOCAL_DEVELOPMENT_SECRET : null);
  if (!secret) throw new Error("WEBVIEW_TOKEN_SECRET is required in production.");
  if (Buffer.byteLength(String(secret), "utf8") < MIN_WEBVIEW_SECRET_BYTES) {
    throw new Error(`WEBVIEW_TOKEN_SECRET must contain at least ${MIN_WEBVIEW_SECRET_BYTES} bytes.`);
  }
  return secret;
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
  const purpose = options.purpose || "webview";
  if (
    purpose !== "attendance"
    && (
      options.action !== undefined
      || options.pendingEntryId !== undefined
      || options.shiftId !== undefined
      || options.shiftRevision !== undefined
    )
  ) {
    throw new Error("Attendance token actions and bindings are only supported for attendance tokens.");
  }
  const action = purpose === "attendance"
    ? attendanceAction(options.action ?? ATTENDANCE_ACTIONS.CHECK_IN)
    : null;
  const issuedAt = Math.floor(now / 1000);
  const binding = action ? attendanceBinding(action, options) : null;
  const payload = Buffer.from(
    JSON.stringify({
      v: action ? 2 : 1,
      sub: String(workerId),
      aud: purpose,
      ctx: options.scope ? String(options.scope) : null,
      exp: issuedAt + ttlSeconds,
      ...(action ? { act: action, iat: issuedAt, ...binding } : {}),
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
    const legacyAttendanceToken = decoded.v === 1
      && decoded.aud === "attendance"
      && !Object.hasOwn(decoded, "act")
      && nowSeconds < ATTENDANCE_V1_ACCEPT_UNTIL_SECONDS;
    const signedAttendanceAction = decoded.v === 2
      && decoded.aud === "attendance"
      && isAttendanceAction(decoded.act)
      && validSignedAttendanceBinding(decoded, decoded.act)
      && decoded.iat <= nowSeconds + ATTENDANCE_TOKEN_CLOCK_SKEW_SECONDS
      ? decoded.act
      : legacyAttendanceToken
        ? ATTENDANCE_ACTIONS.CHECK_IN
        : null;
    const versionMatchesPurpose = decoded.v === 1
      ? !Object.hasOwn(decoded, "act")
        && (decoded.aud !== "attendance" || legacyAttendanceToken)
      : decoded.v === 2 && signedAttendanceAction !== null;
    const requestedAction = options.action === undefined
      ? null
      : attendanceAction(options.action);
    const actionMatches = requestedAction === null
      || signedAttendanceAction === requestedAction;
    if (
      !versionMatchesPurpose ||
      decoded.sub !== String(workerId) ||
      !purposeMatches ||
      !scopeMatches ||
      !actionMatches ||
      !Number.isInteger(decoded.exp) ||
      decoded.exp < nowSeconds
    ) {
      return null;
    }
    return legacyAttendanceToken
      ? { ...decoded, act: ATTENDANCE_ACTIONS.CHECK_IN }
      : decoded;
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
