import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  buildWhatsAppFlowMessage,
  buildWhatsAppFlowTemplateMessage,
  downloadWhatsAppMedia,
  isAllowedMetaMediaUrl,
  normalizeMetaWebhook,
  sendWhatsAppFlow,
  sendWhatsAppFlowTemplate,
  verifyMetaSignature,
  verifyMetaSubscription,
} from "../src/lib/whatsapp/meta.js";

test("approved Flow templates use Meta's official button action envelope", () => {
  const message = buildWhatsAppFlowTemplateMessage({
    to: "+5491112345678",
    templateName: "obrasaas_incident_report_a1b2c3d4e5_f6a7b8c9d0",
    language: "es_AR",
    flowToken: "flow-session-token-123",
    flowActionData: { project_id: "project-a" },
  });

  assert.equal(message.type, "template");
  assert.equal(message.template.language.code, "es_AR");
  const button = message.template.components[0];
  assert.equal(button.type, "button");
  assert.equal(button.sub_type, "flow");
  assert.equal(button.index, "0");
  assert.deepEqual(button.parameters[0], {
    type: "action",
    action: {
      flow_token: "flow-session-token-123",
      flow_action_data: { project_id: "project-a" },
    },
  });
});

test("Flow template delivery remains phone-scoped and never logs provider bodies", async () => {
  let call;
  const input = {
    to: "5491112345678",
    phoneNumberId: "123456789012345",
    templateName: "obrasaas_incident_report_a1b2c3d4e5_f6a7b8c9d0",
    language: "es_AR",
    flowToken: "flow-session-token-123",
    credentials: {
      version: "v25.0",
      phoneNumberId: "123456789012345",
      accessToken: "tenant-template-token",
      appSecret: "meta-app-secret",
    },
  };
  const result = await sendWhatsAppFlowTemplate({
    ...input,
    fetchImpl: async (url, options) => {
      call = { url: new URL(url), options };
      return Response.json({ messages: [{ id: "wamid.template-flow" }] });
    },
  });

  assert.equal(result.messages[0].id, "wamid.template-flow");
  assert.match(call.url.searchParams.get("appsecret_proof"), /^[a-f0-9]{64}$/);
  assert.equal(JSON.parse(call.options.body).template.name, input.templateName);

  await assert.rejects(
    sendWhatsAppFlowTemplate({
      ...input,
      fetchImpl: async () => Response.json({
        error: { code: 132001, message: `Rejected ${input.flowToken}` },
      }, { status: 400 }),
    }),
    (error) => error.code === "META_FLOW_TEMPLATE_REJECTED"
      && error.providerCode === 132001
      && !error.message.includes(input.flowToken),
  );
});

test("published WhatsApp Flow messages use the official interactive v3 envelope", () => {
  const message = buildWhatsAppFlowMessage({
    to: "+5491112345678",
    flowId: "987654321012345",
    flowToken: "flow-session-token-123",
    screenId: "INCIDENT_REPORT",
    header: "Incidencia de obra",
    body: "Completá el reporte para registrar el riesgo.",
    footer: "Detené la tarea si existe riesgo.",
    cta: "Reportar",
  });
  assert.equal(message.type, "interactive");
  assert.equal(message.interactive.type, "flow");
  assert.equal(message.interactive.action.parameters.flow_message_version, "3");
  assert.equal(message.interactive.action.parameters.flow_id, "987654321012345");
  assert.equal(message.interactive.action.parameters.flow_action_payload.screen, "INCIDENT_REPORT");
  assert.equal("data" in message.interactive.action.parameters.flow_action_payload, false);
  assert.equal("mode" in message.interactive.action.parameters, false);
});

test("dynamic WhatsApp Flow messages start with data_exchange and no empty payload", () => {
  const message = buildWhatsAppFlowMessage({
    to: "+5491112345678",
    flowId: "987654321012345",
    flowToken: "flow-session-token-123",
    screenId: "INCIDENT_REPORT",
    flowAction: "data_exchange",
    header: "Incidencia de obra",
    body: "Completá el reporte para registrar el riesgo.",
    footer: "Detené la tarea si existe riesgo.",
    cta: "Reportar",
  });
  const parameters = message.interactive.action.parameters;
  assert.equal(parameters.flow_action, "data_exchange");
  assert.equal("flow_action_payload" in parameters, false);
});

test("navigate accepts only meaningful optional initialization data", () => {
  const input = {
    to: "+5491112345678",
    flowId: "987654321012345",
    flowToken: "flow-session-token-123",
    screenId: "INCIDENT_REPORT",
    header: "Incidencia de obra",
    body: "Completá el reporte para registrar el riesgo.",
    footer: "Detené la tarea si existe riesgo.",
    cta: "Reportar",
  };
  assert.throws(() => buildWhatsAppFlowMessage({ ...input, flowData: {} }), /non-empty object/);
  const message = buildWhatsAppFlowMessage({
    ...input,
    flowData: { project_name: "Torre Norte" },
  });
  assert.deepEqual(
    message.interactive.action.parameters.flow_action_payload.data,
    { project_name: "Torre Norte" },
  );
});

test("Flow delivery stays phone-scoped and falls through appsecret proof", async () => {
  let call;
  const result = await sendWhatsAppFlow({
    to: "5491112345678",
    phoneNumberId: "123456789012345",
    flowId: "987654321012345",
    flowToken: "flow-session-token-123",
    screenId: "INCIDENT_REPORT",
    header: "Incidencia de obra",
    body: "Completá el reporte para registrar el riesgo.",
    footer: "Detené la tarea si existe riesgo.",
    cta: "Reportar",
    credentials: {
      version: "v25.0",
      phoneNumberId: "123456789012345",
      accessToken: "tenant-flow-token",
      appSecret: "meta-app-secret",
    },
    fetchImpl: async (url, options) => {
      call = { url: new URL(url), options };
      return Response.json({ messages: [{ id: "wamid.flow-outbound" }] });
    },
  });
  assert.equal(result.messages[0].id, "wamid.flow-outbound");
  assert.equal(call.options.headers.Authorization, "Bearer tenant-flow-token");
  assert.match(call.url.searchParams.get("appsecret_proof"), /^[a-f0-9]{64}$/);
  assert.equal(JSON.parse(call.options.body).interactive.action.parameters.flow_id, "987654321012345");
});

test("Flow delivery classifies explicit rejection separately from ambiguous transport failure", async () => {
  const input = {
    to: "5491112345678",
    phoneNumberId: "123456789012345",
    flowId: "987654321012345",
    flowToken: "flow-session-token-123",
    screenId: "INCIDENT_REPORT",
    header: "Incidencia de obra",
    body: "Completá el reporte para registrar el riesgo.",
    footer: "Detené la tarea si existe riesgo.",
    cta: "Reportar",
    credentials: {
      version: "v25.0",
      phoneNumberId: "123456789012345",
      accessToken: "tenant-flow-token",
      appSecret: "meta-app-secret",
    },
  };

  await assert.rejects(
    sendWhatsAppFlow({
      ...input,
      fetchImpl: async () => {
        throw new Error("socket reset");
      },
    }),
    (error) => error.code === "META_FLOW_DELIVERY_UNKNOWN"
      && error.status === null,
  );
  await assert.rejects(
    sendWhatsAppFlow({
      ...input,
      fetchImpl: async () => Response.json(
        {
          error: {
            message: `Flow is not available: ${input.flowToken}`,
            code: 131009,
          },
        },
        { status: 400 },
      ),
    }),
    (error) => error.code === "META_FLOW_REJECTED"
      && error.status === 400
      && error.providerCode === 131009
      && !error.message.includes(input.flowToken),
  );
  await assert.rejects(
    sendWhatsAppFlow({
      ...input,
      fetchImpl: async () => Response.json(
        { error: { message: `Temporary provider failure: ${input.flowToken}` } },
        { status: 503 },
      ),
    }),
    (error) => error.code === "META_FLOW_DELIVERY_RETRYABLE"
      && error.status === 503
      && !error.message.includes(input.flowToken),
  );
});

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
  const flowToken = `ofs1.1f967f35-9f99-4db0-bd42-2d88f734cc72.${"A".repeat(43)}`;
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
                      response_json: JSON.stringify({
                        flow_token: flowToken,
                        flow_type: "incident-report",
                        severity: "high",
                        area: "PB",
                      }),
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
  assert.equal("flow_token" in events[1].interactive.response, false);
  assert.deepEqual(events[1].interactive.flowToken, {
    sessionId: "1f967f35-9f99-4db0-bd42-2d88f734cc72",
    tokenSha256: crypto.createHash("sha256").update(flowToken).digest("hex"),
  });
  assert.equal(JSON.stringify(events[1]).includes(flowToken), false);
  assert.equal(
    JSON.parse(events[1].raw.interactive.nfm_reply.response_json).flow_token,
    undefined,
  );
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
