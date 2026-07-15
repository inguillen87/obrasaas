import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  downloadWhatsAppMedia,
  isAllowedMetaMediaUrl,
  normalizeMetaWebhook,
  verifyMetaSignature,
  verifyMetaSubscription,
} from "../src/lib/whatsapp/meta.js";

test("Meta media URLs reject non-Meta hosts and ambiguous suffixes", () => {
  assert.equal(isAllowedMetaMediaUrl("https://lookaside.fbsbx.com/whatsapp_business/attachments/"), true);
  assert.equal(isAllowedMetaMediaUrl("https://scontent-eze1-1.xx.fbcdn.net/file"), true);
  assert.equal(isAllowedMetaMediaUrl("http://lookaside.fbsbx.com/file"), false);
  assert.equal(isAllowedMetaMediaUrl("https://lookaside.fbsbx.com.evil.example/file"), false);
  assert.equal(isAllowedMetaMediaUrl("https://127.0.0.1/file"), false);
});

test("WhatsApp media retrieval is phone-scoped and verifies the downloaded SHA-256", async () => {
  const content = Buffer.from("verified voice note");
  const sha256 = crypto.createHash("sha256").update(content).digest("base64");
  const calls = [];
  const fetchImpl = async (input, init) => {
    const url = new URL(input);
    calls.push({ url, init });
    if (url.hostname === "graph.facebook.com") {
      return Response.json({
        id: "123456789012345",
        url: "https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=123",
        mime_type: "audio/ogg; codecs=opus",
        sha256,
        file_size: content.length,
      });
    }
    return new Response(content, {
      status: 200,
      headers: {
        "content-type": "audio/ogg",
        "content-length": String(content.length),
      },
    });
  };

  const result = await downloadWhatsAppMedia({
    mediaId: "123456789012345",
    phoneNumberId: "987654321098765",
    expectedKind: "audio",
    expectedMimeType: "audio/ogg",
    expectedSha256: sha256,
    fetchImpl,
    credentials: {
      version: "v25.0",
      accessToken: "test-access-token",
      phoneNumberId: "987654321098765",
      appSecret: "test-app-secret",
    },
  });

  assert.equal(result.buffer.toString(), content.toString());
  assert.equal(result.sha256, sha256);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url.searchParams.get("phone_number_id"), "987654321098765");
  assert.match(calls[0].url.searchParams.get("appsecret_proof"), /^[a-f0-9]{64}$/);
  assert.equal(calls[0].init.headers.Authorization, "Bearer test-access-token");
  assert.equal(calls[1].init.redirect, "manual");
});

test("WhatsApp media retrieval rejects untrusted download hosts", async () => {
  const content = Buffer.from("file");
  const sha256 = crypto.createHash("sha256").update(content).digest("base64");
  await assert.rejects(
    downloadWhatsAppMedia({
      mediaId: "123456789012345",
      phoneNumberId: "987654321098765",
      expectedKind: "image",
      expectedMimeType: "image/jpeg",
      expectedSha256: sha256,
      credentials: {
        version: "v25.0",
        accessToken: "test-access-token",
        phoneNumberId: "987654321098765",
      },
      fetchImpl: async () => Response.json({
        id: "123456789012345",
        url: "https://storage.attacker.example/media",
        mime_type: "image/jpeg",
        sha256,
        file_size: content.length,
      }),
    }),
    /untrusted media URL/,
  );
});

test("WhatsApp media retrieval rejects oversized audio before downloading", async () => {
  let callCount = 0;
  await assert.rejects(
    downloadWhatsAppMedia({
      mediaId: "123456789012345",
      phoneNumberId: "987654321098765",
      expectedKind: "audio",
      expectedMimeType: "audio/ogg",
      credentials: {
        version: "v25.0",
        accessToken: "test-access-token",
        phoneNumberId: "987654321098765",
      },
      fetchImpl: async () => {
        callCount += 1;
        return Response.json({
          id: "123456789012345",
          url: "https://lookaside.fbsbx.com/file",
          mime_type: "audio/ogg",
          file_size: 16 * 1024 * 1024 + 1,
        });
      },
    }),
    /exceeds/,
  );
  assert.equal(callCount, 1);
});

test("Meta webhook signatures are verified over the untouched body", () => {
  const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
  const secret = "meta-app-secret";
  const signature = crypto.createHmac("sha256", secret).update(body).digest("hex");

  assert.equal(verifyMetaSignature(body, `sha256=${signature}`, secret), true);
  assert.equal(verifyMetaSignature(`${body} `, `sha256=${signature}`, secret), false);
  assert.equal(verifyMetaSignature(body, `sha1=${signature}`, secret), false);
});

test("Meta subscription challenge requires the configured verify token", () => {
  const params = new URLSearchParams({
    "hub.mode": "subscribe",
    "hub.verify_token": "expected-token",
    "hub.challenge": "123456",
  });
  assert.deepEqual(verifyMetaSubscription(params, "expected-token"), {
    valid: true,
    challenge: "123456",
  });
  assert.equal(verifyMetaSubscription(params, "wrong-token").valid, false);
});

test("Meta webhook messages and WhatsApp Flow replies normalize into stable events", () => {
  const payload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba-1",
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: "phone-1", display_phone_number: "5491100000000" },
              contacts: [{ wa_id: "5491112345678", profile: { name: "Juan Gómez" } }],
              messages: [
                {
                  id: "wamid.text-1",
                  from: "5491112345678",
                  timestamp: "1784030400",
                  type: "text",
                  text: { body: "Avance 60% tarea 3" },
                },
                {
                  id: "wamid.flow-1",
                  from: "5491112345678",
                  timestamp: "1784030410",
                  type: "interactive",
                  interactive: {
                    type: "nfm_reply",
                    nfm_reply: {
                      name: "flow",
                      body: "Incidencia enviada",
                      response_json: JSON.stringify({ flow_token: "opaque", severity: "high", area: "PB" }),
                    },
                  },
                },
              ],
              statuses: [
                {
                  id: "wamid.outbound-1",
                  recipient_id: "5491112345678",
                  status: "delivered",
                  timestamp: "1784030420",
                },
              ],
            },
          },
        ],
      },
    ],
  };

  const events = normalizeMetaWebhook(payload);
  assert.equal(events.length, 3);
  assert.equal(events[0].text, "Avance 60% tarea 3");
  assert.equal(events[0].displayName, "Juan Gómez");
  assert.equal(events[1].interactive.type, "flow");
  assert.equal(events[1].interactive.response.severity, "high");
  assert.equal(events[2].externalId, "status:wamid.outbound-1:delivered:1784030420");
});

test("Meta Embedded Signup account updates retain the WABA scope", () => {
  const events = normalizeMetaWebhook({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "1877452050306771",
        time: 1784030500,
        changes: [
          {
            field: "account_update",
            value: {
              phone_number: "5491155555555",
              event: "VERIFIED_ACCOUNT",
            },
          },
          {
            field: "phone_number_quality_update",
            value: {
              display_phone_number: "5491155555555",
              event: "FLAGGED",
              current_limit: "TIER_10K",
            },
          },
        ],
      },
    ],
  });

  assert.equal(events.length, 2);
  assert.equal(events[0].eventType, "account");
  assert.equal(events[0].whatsappBusinessId, "1877452050306771");
  assert.equal(events[0].event, "VERIFIED_ACCOUNT");
  assert.equal(events[1].field, "phone_number_quality_update");
  assert.match(events[1].externalId, /^account:1877452050306771:/);
});
