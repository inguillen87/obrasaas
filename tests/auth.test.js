import test from "node:test";
import assert from "node:assert/strict";
import { generateWebviewToken, verifyWebviewToken } from "../src/lib/auth.js";

const secret = "test-secret-that-is-long-enough-for-hmac";
const issuedAt = Date.UTC(2026, 6, 14, 12, 0, 0);

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
