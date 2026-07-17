import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { WhatsAppFlowEndpointCryptoError } from "../src/lib/whatsapp/flow-endpoint-crypto.js";
import { handleWhatsAppFlowDataEndpointRequest } from "../src/lib/whatsapp/flow-endpoint-handler.js";
import { WhatsAppFlowEndpointKeyError } from "../src/lib/whatsapp/flow-endpoint-keys.js";
import { WhatsAppFlowDataEndpointError } from "../src/lib/whatsapp/flow-endpoint.js";

const APP_SECRET = "meta-app-secret-for-handler-tests";
const ENDPOINT_ID = "987e4567-e89b-42d3-a456-426614174000";
const REQUEST_ID = "123e4567-e89b-42d3-a456-426614174000";
const LEASE_ID = "223e4567-e89b-42d3-a456-426614174000";
const SESSION_ID = "323e4567-e89b-42d3-a456-426614174000";
const ENVELOPE = Object.freeze({
  encrypted_aes_key: "AA==",
  encrypted_flow_data: "AA==",
  initial_vector: "AA==",
});
const RUNTIME = Object.freeze({
  endpoint: {
    id: ENDPOINT_ID,
    connectionId: "connection-a",
    enabled: true,
  },
  connection: {
    id: "connection-a",
    projectId: "project-a",
    phoneNumberId: "123456789012345",
    enabled: true,
    connectionStatus: "CONNECTED",
    metadata: {},
    project: { id: "project-a", organizationId: "organization-a" },
  },
  keys: [{
    id: "423e4567-e89b-42d3-a456-426614174000",
    version: 1,
    privateKey: "private-key",
  }],
});

function signedRequest({ envelope = ENVELOPE, secret = APP_SECRET, signature = true } = {}) {
  const rawBody = JSON.stringify(envelope);
  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return new Request(`https://obrasaas.vercel.app/api/webhooks/whatsapp/flows/${ENDPOINT_ID}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": signature ? `sha256=${digest}` : "sha256=invalid",
    },
    body: rawBody,
  });
}

function claimedReservation() {
  return {
    state: "claimed",
    record: { id: REQUEST_ID, leaseToken: LEASE_ID },
  };
}

function successfulDependencies(overrides = {}) {
  const completions = [];
  return {
    completions,
    dependencies: {
      loadRuntime: async () => RUNTIME,
      reserveRequest: async () => claimedReservation(),
      completeRequest: async (_prisma, completion) => {
        completions.push(completion);
        return true;
      },
      decryptRequest: () => ({
        payload: { version: "3.0", action: "ping" },
        aesKey: Buffer.alloc(16, 1),
        initialVector: Buffer.alloc(16, 2),
        key: RUNTIME.keys[0],
      }),
      encryptResponse: () => "encrypted-response",
      dispatchRequest: async () => ({
        response: { data: { status: "active" } },
        session: null,
      }),
      ...overrides,
    },
  };
}

test("invalid Meta signatures return 432 before endpoint lookup, persistence, or RSA", async () => {
  let calls = 0;
  const response = await handleWhatsAppFlowDataEndpointRequest(
    signedRequest({ signature: false }),
    { endpointId: ENDPOINT_ID, prisma: {}, appSecret: APP_SECRET },
    {
      loadRuntime: async () => { calls += 1; },
      reserveRequest: async () => { calls += 1; },
      decryptRequest: () => { calls += 1; },
    },
  );
  assert.equal(response.status, 432);
  assert.equal(calls, 0);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("runtime lookup returns 404 only for a known missing endpoint and 503 for outages", async () => {
  const cases = [
    {
      error: new WhatsAppFlowEndpointKeyError(
        "missing",
        "WHATSAPP_FLOW_KEY_ENDPOINT_NOT_FOUND",
      ),
      expectedStatus: 404,
    },
    {
      error: new WhatsAppFlowEndpointKeyError(
        "missing KEK",
        "WHATSAPP_FLOW_KEY_CONFIGURATION_INVALID",
      ),
      expectedStatus: 503,
    },
    { error: new Error("database connection failed"), expectedStatus: 503 },
  ];

  for (const { error, expectedStatus } of cases) {
    let reservations = 0;
    const response = await handleWhatsAppFlowDataEndpointRequest(
      signedRequest(),
      { endpointId: ENDPOINT_ID, prisma: {}, appSecret: APP_SECRET },
      {
        loadRuntime: async () => { throw error; },
        reserveRequest: async () => { reservations += 1; },
      },
    );
    assert.equal(response.status, expectedStatus);
    assert.equal(await response.text(), "");
    assert.equal(reservations, 0);
  }
});

test("a valid request is encrypted, committed, and returned as plain base64", async () => {
  const { dependencies, completions } = successfulDependencies();
  const prisma = {
    whatsAppFlowEndpointKey: {
      async updateMany() { return { count: 1 }; },
    },
  };
  const response = await handleWhatsAppFlowDataEndpointRequest(
    signedRequest(),
    { endpointId: ENDPOINT_ID, prisma, appSecret: APP_SECRET },
    dependencies,
  );
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "encrypted-response");
  assert.match(response.headers.get("content-type"), /^text\/plain/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(completions.length, 1);
  assert.equal(completions[0].status, "SUCCEEDED");
  assert.equal(completions[0].responseStatus, 200);
});

test("421 is reserved exclusively for RSA key mismatch and is durably classified", async () => {
  const { dependencies, completions } = successfulDependencies({
    decryptRequest: () => {
      throw new WhatsAppFlowEndpointCryptoError(
        "wrong key",
        "WHATSAPP_FLOW_CRYPTO_RSA_KEY_MISMATCH",
      );
    },
  });
  const response = await handleWhatsAppFlowDataEndpointRequest(
    signedRequest(),
    { endpointId: ENDPOINT_ID, prisma: {}, appSecret: APP_SECRET },
    dependencies,
  );
  assert.equal(response.status, 421);
  assert.equal(await response.text(), "");
  assert.equal(completions[0].status, "FAILED");
  assert.equal(completions[0].failureCode, "WHATSAPP_FLOW_CRYPTO_RSA_KEY_MISMATCH");
});

test("invalid or expired Flow sessions return an encrypted 427 and disable the stale CTA", async () => {
  const { dependencies, completions } = successfulDependencies({
    decryptRequest: () => ({
      payload: {
        version: "3.0",
        action: "INIT",
        flow_token: "ofs1.invalid",
      },
      aesKey: Buffer.alloc(16, 1),
      initialVector: Buffer.alloc(16, 2),
      key: RUNTIME.keys[0],
    }),
    dispatchRequest: async () => {
      throw new WhatsAppFlowDataEndpointError(
        "invalid",
        "WHATSAPP_FLOW_ENDPOINT_SESSION_INVALID",
      );
    },
    encryptResponse: (body) => {
      assert.match(body.error_msg, /solicitud venció/i);
      return "encrypted-427";
    },
  });
  const response = await handleWhatsAppFlowDataEndpointRequest(
    signedRequest(),
    { endpointId: ENDPOINT_ID, prisma: {}, appSecret: APP_SECRET },
    dependencies,
  );
  assert.equal(response.status, 427);
  assert.equal(await response.text(), "encrypted-427");
  assert.equal(completions[0].status, "REJECTED");
  assert.equal(completions[0].responseStatus, 427);
});

test("exact retries reuse the persisted ciphertext without another RSA operation", async () => {
  let decryptions = 0;
  const response = await handleWhatsAppFlowDataEndpointRequest(
    signedRequest(),
    { endpointId: ENDPOINT_ID, prisma: {}, appSecret: APP_SECRET },
    {
      loadRuntime: async () => RUNTIME,
      reserveRequest: async () => ({
        state: "replay",
        record: { responseStatus: 200, responseCiphertext: "same-ciphertext" },
      }),
      decryptRequest: () => { decryptions += 1; },
    },
  );
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "same-ciphertext");
  assert.equal(decryptions, 0);
});

test("cross-instance requests with an active lease get a bounded retry response", async () => {
  const response = await handleWhatsAppFlowDataEndpointRequest(
    signedRequest(),
    { endpointId: ENDPOINT_ID, prisma: {}, appSecret: APP_SECRET },
    {
      loadRuntime: async () => RUNTIME,
      reserveRequest: async () => ({ state: "in_flight", record: {} }),
    },
  );
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "1");
});

test("a failed success commit never encrypts or exposes a second response", async () => {
  let encryptions = 0;
  const { dependencies } = successfulDependencies({
    encryptResponse: () => {
      encryptions += 1;
      return `ciphertext-${encryptions}`;
    },
    completeRequest: async () => {
      throw new Error("ambiguous database outcome");
    },
  });
  const response = await handleWhatsAppFlowDataEndpointRequest(
    signedRequest(),
    { endpointId: ENDPOINT_ID, prisma: {}, appSecret: APP_SECRET },
    dependencies,
  );
  assert.equal(response.status, 503);
  assert.equal(await response.text(), "");
  assert.equal(encryptions, 1);
});

test("an error ciphertext is exposed only after its durable commit", async () => {
  let encryptions = 0;
  const { dependencies } = successfulDependencies({
    dispatchRequest: async () => {
      throw new WhatsAppFlowDataEndpointError(
        "invalid",
        "WHATSAPP_FLOW_ENDPOINT_SESSION_INVALID",
      );
    },
    encryptResponse: () => {
      encryptions += 1;
      return `ciphertext-${encryptions}`;
    },
    completeRequest: async () => {
      throw new Error("write was not confirmed");
    },
  });
  const response = await handleWhatsAppFlowDataEndpointRequest(
    signedRequest(),
    { endpointId: ENDPOINT_ID, prisma: {}, appSecret: APP_SECRET },
    dependencies,
  );
  assert.equal(response.status, 503);
  assert.equal(await response.text(), "");
  assert.equal(encryptions, 1);
});
