import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  ATTENDANCE_ACTIONS,
  ATTENDANCE_V1_COMPATIBILITY,
  generateWebviewToken,
  readWebviewToken,
  verifyWebviewToken,
} from "../src/lib/auth.js";

const secret = "test-secret-that-is-long-enough-for-hmac";
const issuedAt = Date.UTC(2026, 6, 14, 12, 0, 0);

function legacyAttendanceToken({
  expiresAt = Math.floor(issuedAt / 1_000) + 60,
} = {}) {
  const payload = Buffer.from(JSON.stringify({
    v: 1,
    sub: "worker-123",
    aud: "attendance",
    ctx: "project-123",
    exp: expiresAt,
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function attendanceBinding(action) {
  return action === ATTENDANCE_ACTIONS.CHECK_IN
    ? { pendingEntryId: "pending-123" }
    : { shiftId: "shift-123", shiftRevision: 4 };
}

function signedToken(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

test("webview tokens bind the subject and expire", () => {
  const token = generateWebviewToken("worker-123", {
    secret,
    now: issuedAt,
    ttlSeconds: 60,
  });

  assert.equal(verifyWebviewToken("worker-123", token, { secret, now: issuedAt + 59_000 }), true);
  assert.equal(verifyWebviewToken("worker-456", token, { secret, now: issuedAt + 59_000 }), false);
  assert.equal(verifyWebviewToken("worker-123", token, { secret, now: issuedAt + 61_000 }), false);
});

test("webview tokens reject tampering", () => {
  const token = generateWebviewToken("worker-123", { secret, now: issuedAt });
  const [payload, signature] = token.split(".");
  assert.equal(verifyWebviewToken("worker-123", `${payload}x.${signature}`, { secret, now: issuedAt }), false);
  assert.equal(verifyWebviewToken("worker-123", `${payload}.${signature}x`, { secret, now: issuedAt }), false);
});

test("webview tokens cannot cross purposes", () => {
  const token = generateWebviewToken("worker-123", {
    secret,
    now: issuedAt,
    purpose: "medical",
  });
  assert.equal(verifyWebviewToken("worker-123", token, { secret, now: issuedAt, purpose: "medical" }), true);
  assert.equal(verifyWebviewToken("worker-123", token, { secret, now: issuedAt, purpose: "attendance" }), false);
});

test("webview signing rejects weak secrets and hosted JWT fallback", () => {
  assert.throws(
    () => generateWebviewToken("worker-123", { secret: "too-short" }),
    /at least 32 bytes/i,
  );

  const previousNodeEnv = process.env.NODE_ENV;
  const previousWebviewSecret = process.env.WEBVIEW_TOKEN_SECRET;
  const previousJwtSecret = process.env.JWT_SECRET;
  try {
    process.env.NODE_ENV = "production";
    delete process.env.WEBVIEW_TOKEN_SECRET;
    process.env.JWT_SECRET = "jwt-secret-must-not-sign-hosted-webviews";
    assert.throws(
      () => generateWebviewToken("worker-123"),
      /WEBVIEW_TOKEN_SECRET is required in production/i,
    );
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousWebviewSecret === undefined) delete process.env.WEBVIEW_TOKEN_SECRET;
    else process.env.WEBVIEW_TOKEN_SECRET = previousWebviewSecret;
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
  }
});

test("new attendance tokens sign a versioned action and default to check-in", () => {
  const token = generateWebviewToken("worker-123", {
    secret,
    now: issuedAt,
    purpose: "attendance",
    scope: "project-123",
    pendingEntryId: "pending-123",
  });
  const decoded = readWebviewToken("worker-123", token, {
    secret,
    now: issuedAt,
    purpose: "attendance",
    scope: "project-123",
  });

  assert.equal(decoded.v, 2);
  assert.equal(decoded.act, ATTENDANCE_ACTIONS.CHECK_IN);
  assert.equal(decoded.iat, Math.floor(issuedAt / 1_000));
  assert.equal(decoded.pid, "pending-123");
  assert.equal(readWebviewToken("worker-123", token, {
    secret,
    now: issuedAt,
    purpose: "attendance",
    action: ATTENDANCE_ACTIONS.CHECK_OUT,
  }), null);
});

test("attendance tokens bind every supported action", () => {
  for (const action of Object.values(ATTENDANCE_ACTIONS)) {
    const token = generateWebviewToken("worker-123", {
      secret,
      now: issuedAt,
      purpose: "attendance",
      scope: "project-123",
      action,
      ...attendanceBinding(action),
    });
    const decoded = readWebviewToken("worker-123", token, {
      secret,
      now: issuedAt,
      purpose: "attendance",
      scope: "project-123",
      action,
    });
    assert.equal(decoded.act, action);
    if (action === ATTENDANCE_ACTIONS.CHECK_IN) {
      assert.equal(decoded.pid, "pending-123");
    } else {
      assert.equal(decoded.sid, "shift-123");
      assert.equal(decoded.rev, 4);
    }
  }
});

test("legacy v1 attendance tokens can only mean check-in", () => {
  const token = legacyAttendanceToken();

  const decoded = readWebviewToken("worker-123", token, {
    secret,
    now: issuedAt,
    purpose: "attendance",
    action: ATTENDANCE_ACTIONS.CHECK_IN,
  });
  assert.equal(decoded.v, 1);
  assert.equal(decoded.act, ATTENDANCE_ACTIONS.CHECK_IN);
  assert.equal(readWebviewToken("worker-123", token, {
    secret,
    now: issuedAt,
    purpose: "attendance",
    action: ATTENDANCE_ACTIONS.BREAK_START,
  }), null);
});

test("legacy v1 attendance compatibility closes at the explicit removal instant", () => {
  const cutoff = Date.parse(ATTENDANCE_V1_COMPATIBILITY.acceptUntilExclusive);
  const token = legacyAttendanceToken({
    expiresAt: Math.floor(cutoff / 1_000) + 60,
  });

  assert.equal(readWebviewToken("worker-123", token, {
    secret,
    now: cutoff - 1,
    purpose: "attendance",
  }).act, ATTENDANCE_ACTIONS.CHECK_IN);
  assert.equal(readWebviewToken("worker-123", token, {
    secret,
    now: cutoff,
    purpose: "attendance",
  }), null);
  assert.equal(readWebviewToken("worker-123", token, {
    secret,
    now: cutoff,
  }), null);
  assert.match(
    ATTENDANCE_V1_COMPATIBILITY.removalMarker,
    /remove-after-2026-08-31$/,
  );
});

test("attendance token generation rejects unknown actions and actions on other purposes", () => {
  assert.throws(
    () => generateWebviewToken("worker-123", {
      secret,
      purpose: "attendance",
      action: "DELETE_SHIFT",
      pendingEntryId: "pending-123",
    }),
    /valid attendance action/i,
  );
  assert.throws(
    () => generateWebviewToken("worker-123", {
      secret,
      purpose: "medical",
      action: ATTENDANCE_ACTIONS.CHECK_IN,
    }),
    /only supported for attendance/i,
  );
});

test("v2 attendance tokens fail closed without one exact resource binding", () => {
  assert.throws(
    () => generateWebviewToken("worker-123", {
      secret,
      purpose: "attendance",
      action: ATTENDANCE_ACTIONS.CHECK_IN,
    }),
    /pendingEntryId is required/i,
  );
  assert.throws(
    () => generateWebviewToken("worker-123", {
      secret,
      purpose: "attendance",
      action: ATTENDANCE_ACTIONS.CHECK_OUT,
      shiftId: "shift-123",
    }),
    /shiftRevision/i,
  );
  assert.throws(
    () => generateWebviewToken("worker-123", {
      secret,
      purpose: "attendance",
      action: ATTENDANCE_ACTIONS.CHECK_IN,
      pendingEntryId: "pending-123",
      shiftId: "shift-123",
      shiftRevision: 0,
    }),
    /cannot target a shift/i,
  );

  const base = {
    v: 2,
    sub: "worker-123",
    aud: "attendance",
    ctx: "project-123",
    act: ATTENDANCE_ACTIONS.CHECK_OUT,
    iat: Math.floor(issuedAt / 1_000),
    exp: Math.floor(issuedAt / 1_000) + 60,
  };
  assert.equal(readWebviewToken("worker-123", signedToken(base), {
    secret,
    now: issuedAt,
    purpose: "attendance",
  }), null);
  assert.equal(readWebviewToken("worker-123", signedToken({
    ...base,
    pid: "pending-123",
    sid: "shift-123",
    rev: 0,
  }), {
    secret,
    now: issuedAt,
    purpose: "attendance",
  }), null);
});
