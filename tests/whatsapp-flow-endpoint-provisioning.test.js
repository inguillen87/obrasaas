import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import {
  buildWhatsAppFlowEndpointUri,
  flowRuntimeIsReady,
  provisionWhatsAppFlowDataEndpoint,
  remoteFlowUsesDataEndpoint,
  synchronizeWhatsAppFlowEndpointKey,
  whatsAppFlowHealthIsBlocked,
} from "../src/lib/whatsapp/flow-endpoint-provisioning.js";

const ENDPOINT_ID = "987e4567-e89b-42d3-a456-426614174000";
const KEY_ID = "123e4567-e89b-42d3-a456-426614174000";
const CONNECTION = Object.freeze({
  id: "connection-a",
  phoneNumberId: "123456789012345",
  whatsappBusinessId: "987654321012345",
});
const PUBLIC_KEY = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2_048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
}).publicKey;

function endpointKey(status = "STAGED") {
  return {
    endpoint: { id: ENDPOINT_ID, connectionId: CONNECTION.id, enabled: true },
    key: {
      id: KEY_ID,
      endpointId: ENDPOINT_ID,
      version: 1,
      status,
      publicKeyPem: PUBLIC_KEY,
      publicKeySha256: "a".repeat(64),
      uploadedAt: status === "ACTIVE" ? new Date() : null,
      verifiedAt: status === "ACTIVE" ? new Date() : null,
      activatedAt: status === "ACTIVE" ? new Date() : null,
    },
  };
}

test("the public Flow endpoint URI is stable, HTTPS, and opaque", () => {
  assert.equal(
    buildWhatsAppFlowEndpointUri("https://obrasaas.vercel.app", ENDPOINT_ID),
    `https://obrasaas.vercel.app/api/webhooks/whatsapp/flows/${ENDPOINT_ID}`,
  );
  assert.throws(
    () => buildWhatsAppFlowEndpointUri("http://localhost:3000", ENDPOINT_ID),
    (error) => error.code === "FLOW_PUBLIC_URL_INVALID" && error.status === 503,
  );
});

test("a staged per-connection key is registered, read back, verified, and only then activated", async () => {
  const calls = [];
  const staged = endpointKey("STAGED");
  const active = { ...staged.key, status: "ACTIVE", uploadedAt: new Date(), verifiedAt: new Date(), activatedAt: new Date() };
  const result = await synchronizeWhatsAppFlowEndpointKey({
    prisma: {},
    connection: CONNECTION,
    accessToken: "tenant-token",
  }, {
    ensureEndpoint: async () => staged,
    setEncryption: async (input) => {
      calls.push(["set", input.phoneNumberId, input.publicKey]);
      return { success: true };
    },
    markUploaded: async (_prisma, input) => {
      calls.push(["uploaded", input.keyId]);
      return { ...staged.key, uploadedAt: new Date() };
    },
    getEncryption: async () => ({ publicKey: PUBLIC_KEY, signatureStatus: "VALID" }),
    markVerified: async (_prisma, input) => {
      calls.push(["verified", input.signatureStatus]);
      return { ...staged.key, uploadedAt: new Date(), verifiedAt: new Date() };
    },
    activateKey: async () => {
      calls.push(["activate", KEY_ID]);
      return { endpoint: staged.endpoint, key: active, activated: true };
    },
  });
  assert.deepEqual(calls, [
    ["set", CONNECTION.phoneNumberId, PUBLIC_KEY],
    ["uploaded", KEY_ID],
    ["verified", "VALID"],
    ["activate", KEY_ID],
  ]);
  assert.equal(result.key.status, "ACTIVE");
  assert.equal(result.signatureStatus, "VALID");
});

test("an active key is reused when Meta confirms the exact signed public key", async () => {
  let registrations = 0;
  const active = endpointKey("ACTIVE");
  const result = await synchronizeWhatsAppFlowEndpointKey({
    prisma: {},
    connection: CONNECTION,
    accessToken: "tenant-token",
  }, {
    ensureEndpoint: async () => active,
    getEncryption: async () => ({ publicKey: PUBLIC_KEY, signatureStatus: "VALID" }),
    setEncryption: async () => { registrations += 1; },
  });
  assert.equal(registrations, 0);
  assert.equal(result.activated, false);
});

test("remote Flow readiness binds versions, endpoint, application, health, and local key state", () => {
  const endpointUri = buildWhatsAppFlowEndpointUri("https://obrasaas.vercel.app", ENDPOINT_ID);
  const flow = {
    id: "123456789012345",
    status: "PUBLISHED",
    jsonVersion: "7.3",
    dataApiVersion: "4.0",
    dataChannelUri: endpointUri,
    applicationId: "1665088767899217",
    healthStatus: { can_send_message: "AVAILABLE", entities: [] },
  };
  assert.equal(remoteFlowUsesDataEndpoint(flow, {
    endpointUri,
    applicationId: "1665088767899217",
  }), true);
  assert.equal(flowRuntimeIsReady(flow, {
    id: flow.id,
    status: "PUBLISHED",
    dataExchange: true,
  }, { ready: true }, {
    endpointUri,
    applicationId: "1665088767899217",
  }), true);
  assert.equal(whatsAppFlowHealthIsBlocked({ can_send_message: "BLOCKED" }), true);
  assert.equal(whatsAppFlowHealthIsBlocked({ entities: [{ errors: [{ code: 1 }] }] }), true);
});

test("provisioning wires the dedicated endpoint and does not claim legacy published Flows as dynamic", async () => {
  let draftInput;
  const provisioned = await provisionWhatsAppFlowDataEndpoint({
    prisma: {},
    connection: CONNECTION,
    blueprintKey: "incident-report",
    accessToken: "tenant-token",
    appUrl: "https://obrasaas.vercel.app",
    applicationId: "1665088767899217",
  }, {
    synchronizeKey: async () => ({
      ...endpointKey("ACTIVE"),
      signatureStatus: "VALID",
    }),
    provisionDraft: async (input) => {
      draftInput = input;
      return {
        blueprintKey: input.blueprintKey,
        flow: {
          id: "123456789012345",
          status: "PUBLISHED",
          jsonVersion: "7.2",
          dataApiVersion: null,
          endpointUri: null,
          applicationId: null,
        },
      };
    },
  });
  assert.equal(draftInput.endpointUri, `https://obrasaas.vercel.app/api/webhooks/whatsapp/flows/${ENDPOINT_ID}`);
  assert.equal(draftInput.flowScope, ENDPOINT_ID);
  assert.equal(draftInput.existingFlowId, null);
  assert.equal(provisioned.dataExchange, false);
  assert.equal(provisioned.endpoint.ready, true);
});

test("provisioning resumes the scoped pending draft instead of overwriting the legacy active Flow", async () => {
  let draftInput;
  const pendingFlowId = "123456789012346";
  const connection = {
    ...CONNECTION,
    metadata: {
      whatsappFlows: {
        "incident-report": {
          id: "123456789012345",
          name: "ObraSaaS | Incidencia de obra",
          status: "PUBLISHED",
        },
      },
      whatsappFlowDrafts: {
        "incident-report": {
          id: pendingFlowId,
          name: "ObraSaaS | Incidencia de obra \u00b7 0e38e8c5ecb2",
          status: "DRAFT",
          flowScope: ENDPOINT_ID,
          whatsappBusinessId: CONNECTION.whatsappBusinessId,
        },
      },
    },
  };
  await provisionWhatsAppFlowDataEndpoint({
    prisma: {},
    connection,
    blueprintKey: "incident-report",
    accessToken: "tenant-token",
    appUrl: "https://obrasaas.vercel.app",
    applicationId: "1665088767899217",
  }, {
    synchronizeKey: async () => ({
      ...endpointKey("ACTIVE"),
      signatureStatus: "VALID",
    }),
    provisionDraft: async (input) => {
      draftInput = input;
      return {
        blueprintKey: input.blueprintKey,
        flow: {
          id: pendingFlowId,
          name: input.flowScope,
          status: "DRAFT",
          jsonVersion: "7.3",
          dataApiVersion: "4.0",
        },
      };
    },
  });
  assert.equal(draftInput.existingFlowId, pendingFlowId);
});

test("provisioning ignores a pending Flow bound to a different WABA", async () => {
  let draftInput;
  const connection = {
    ...CONNECTION,
    metadata: {
      whatsappFlowDrafts: {
        "incident-report": {
          id: "123456789012346",
          name: "ObraSaaS | Incidencia de obra \u00b7 0e38e8c5ecb2",
          status: "DRAFT",
          flowScope: ENDPOINT_ID,
          whatsappBusinessId: "987654321012399",
        },
      },
    },
  };
  await provisionWhatsAppFlowDataEndpoint({
    prisma: {},
    connection,
    blueprintKey: "incident-report",
    accessToken: "tenant-token",
    appUrl: "https://obrasaas.vercel.app",
    applicationId: "1665088767899217",
  }, {
    synchronizeKey: async () => ({
      ...endpointKey("ACTIVE"),
      signatureStatus: "VALID",
    }),
    provisionDraft: async (input) => {
      draftInput = input;
      return {
        blueprintKey: input.blueprintKey,
        flow: {
          id: "123456789012347",
          status: "DRAFT",
          jsonVersion: "7.3",
          dataApiVersion: "4.0",
        },
      };
    },
  });
  assert.equal(draftInput.existingFlowId, null);
});
