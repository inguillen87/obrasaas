import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";

import {
  decryptWhatsAppFlowRequest,
} from "../src/lib/whatsapp/flow-endpoint-crypto.js";
import {
  activateWhatsAppFlowEndpointKey,
  decryptWhatsAppFlowEndpointPrivateKey,
  encryptWhatsAppFlowEndpointPrivateKey,
  ensureWhatsAppFlowEndpoint,
  getSafeWhatsAppFlowEndpointMetadata,
  loadWhatsAppFlowEndpointRuntime,
  markWhatsAppFlowEndpointKeyUploaded,
  markWhatsAppFlowEndpointKeyVerified,
  readWhatsAppFlowEndpointKekRegistry,
  stageWhatsAppFlowEndpointRotation,
  WhatsAppFlowEndpointKeyError,
  WHATSAPP_FLOW_ENDPOINT_RETIRING_WINDOW_MS,
} from "../src/lib/whatsapp/flow-endpoint-keys.js";

const ENDPOINT_ID = "11111111-1111-4111-8111-111111111111";
const CONNECTION_ID = "connection-a";
const CURRENT_KEK = Buffer.alloc(32, 0x21);
const PREVIOUS_KEK = Buffer.alloc(32, 0x42);
const ENV = Object.freeze({
  WHATSAPP_FLOW_ENDPOINT_KEK_ID: "flow-kek-2026-07",
  WHATSAPP_FLOW_ENDPOINT_KEK_REGISTRY_JSON: JSON.stringify({
    "flow-kek-2026-07": CURRENT_KEK.toString("base64"),
    "flow-kek-2026-06": PREVIOUS_KEK.toString("base64"),
  }),
});

function rsaKeyPair(modulusLength = 2048) {
  return crypto.generateKeyPairSync("rsa", {
    modulusLength,
    publicExponent: 0x10001,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
}

function publicFingerprint(publicKey) {
  const key = publicKey instanceof crypto.KeyObject && publicKey.type === "public"
    ? publicKey
    : crypto.createPublicKey(publicKey);
  const der = key.export({ type: "spki", format: "der" });
  return crypto.createHash("sha256").update(der).digest("hex");
}

function encryptFlowRequest(payload, publicKey) {
  const aesKey = Buffer.alloc(16, 0x51);
  const initialVector = Buffer.alloc(16, 0x62);
  const encryptedAesKey = crypto.publicEncrypt({
    key: publicKey,
    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: "sha256",
  }, aesKey);
  const cipher = crypto.createCipheriv("aes-128-gcm", aesKey, initialVector);
  const encryptedFlowData = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  return {
    encrypted_aes_key: encryptedAesKey.toString("base64"),
    encrypted_flow_data: encryptedFlowData.toString("base64"),
    initial_vector: initialVector.toString("base64"),
  };
}

const firstPair = rsaKeyPair();
const secondPair = rsaKeyPair();
const thirdPair = rsaKeyPair();

function assertKeyError(code, status) {
  return (error) => {
    assert.equal(error instanceof WhatsAppFlowEndpointKeyError, true);
    assert.equal(error.code, code);
    assert.equal(error.status, status);
    return true;
  };
}

function selected(value, select) {
  if (!select || !value) return value;
  return Object.fromEntries(
    Object.entries(select)
      .filter(([, include]) => include === true)
      .map(([field]) => [field, value[field]]),
  );
}

function matchesKey(key, where = {}) {
  if (where.id !== undefined && key.id !== where.id) return false;
  if (where.endpointId !== undefined && key.endpointId !== where.endpointId) return false;
  if (where.publicKeySha256 !== undefined && key.publicKeySha256 !== where.publicKeySha256) {
    return false;
  }
  if (where.status !== undefined && key.status !== where.status) return false;
  if (where.retireAfter?.gt !== undefined) {
    if (!key.retireAfter || new Date(key.retireAfter) <= new Date(where.retireAfter.gt)) return false;
  }
  if (Array.isArray(where.OR) && !where.OR.some((alternative) => matchesKey(key, alternative))) {
    return false;
  }
  return true;
}

function inMemoryPrisma({ connections = [] } = {}) {
  const state = {
    connections: structuredClone(connections),
    endpoints: [],
    keys: [],
    rawCalls: [],
    keyQueries: [],
    endpointSequence: 1,
    keySequence: 1,
  };

  function uuid(kind, sequence) {
    const prefix = kind === "endpoint" ? "1" : "2";
    return `${prefix}${String(sequence).padStart(7, "0")}-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
  }

  const transaction = {
    async $executeRawUnsafe(statement, ...params) {
      state.rawCalls.push([statement, ...params]);
      return 1;
    },
    whatsAppConnection: {
      async findUnique({ where, select }) {
        return selected(state.connections.find((item) => item.id === where.id) || null, select);
      },
    },
    whatsAppFlowEndpoint: {
      async findUnique({ where, select }) {
        const endpoint = state.endpoints.find((item) => (
          (where.connectionId !== undefined && item.connectionId === where.connectionId)
          || (where.id !== undefined && item.id === where.id)
        )) || null;
        if (!endpoint || !select?.connection) return selected(endpoint, select);
        const connection = state.connections.find((item) => item.id === endpoint.connectionId);
        return {
          id: endpoint.id,
          connectionId: endpoint.connectionId,
          enabled: endpoint.enabled,
          connection: structuredClone(connection),
        };
      },
      async create({ data }) {
        const endpoint = {
          id: uuid("endpoint", state.endpointSequence),
          enabled: true,
          createdAt: new Date("2026-07-16T00:00:00.000Z"),
          updatedAt: new Date("2026-07-16T00:00:00.000Z"),
          ...data,
        };
        state.endpointSequence += 1;
        state.endpoints.push(endpoint);
        return structuredClone(endpoint);
      },
    },
    whatsAppFlowEndpointKey: {
      async findFirst({ where, orderBy, select }) {
        state.keyQueries.push(structuredClone({ where, orderBy }));
        const candidates = state.keys.filter((key) => matchesKey(key, where));
        if (orderBy?.version === "desc") candidates.sort((a, b) => b.version - a.version);
        return selected(candidates[0] || null, select);
      },
      async findMany({ where, orderBy, take, select }) {
        state.keyQueries.push(structuredClone({ where, orderBy, take }));
        const candidates = state.keys.filter((key) => matchesKey(key, where));
        if (orderBy?.version === "desc") candidates.sort((a, b) => b.version - a.version);
        return candidates.slice(0, take).map((candidate) => selected(candidate, select));
      },
      async findUnique({ where, select }) {
        const key = state.keys.find((item) => matchesKey(item, where)) || null;
        return selected(key, select);
      },
      async create({ data }) {
        if (state.keys.some((key) => key.publicKeySha256 === data.publicKeySha256)) {
          const error = new Error("global public key fingerprint conflict");
          error.code = "P2002";
          throw error;
        }
        const now = new Date("2026-07-16T00:00:00.000Z");
        const key = {
          id: uuid("key", state.keySequence),
          uploadedAt: null,
          verifiedAt: null,
          activatedAt: null,
          retiringAt: null,
          retireAfter: null,
          lastUsedAt: null,
          createdAt: now,
          updatedAt: now,
          ...data,
        };
        state.keySequence += 1;
        state.keys.push(key);
        return structuredClone(key);
      },
      async update({ where, data }) {
        const index = state.keys.findIndex((item) => item.id === where.id);
        assert.notEqual(index, -1);
        state.keys[index] = {
          ...state.keys[index],
          ...data,
          updatedAt: new Date("2026-07-16T00:00:01.000Z"),
        };
        return structuredClone(state.keys[index]);
      },
    },
  };
  const prisma = {
    ...transaction,
    async $transaction(operation) {
      return operation(transaction);
    },
  };
  return { prisma, state };
}

function connection(id = CONNECTION_ID) {
  return {
    id,
    enabled: true,
    connectionStatus: "CONNECTED",
    phoneNumberId: "123456789012345",
    metadata: { whatsappFlows: { current: true } },
    encryptedAccessToken: "must-never-leave-storage",
    encryptedPin: "must-never-leave-storage",
    projectId: "project-a",
    project: {
      id: "project-a",
      organizationId: "organization-a",
      organization: {
        id: "organization-a",
        subscriptionPlan: "PRO",
        subscriptionStatus: "ACTIVE",
        trialEndsAt: null,
      },
    },
  };
}

test("KEK registry is strict, dedicated, and requires 32-byte keys", () => {
  const registry = readWhatsAppFlowEndpointKekRegistry(ENV);
  assert.equal(registry.currentKeyId, "flow-kek-2026-07");
  assert.deepEqual(registry.keys.get("flow-kek-2026-06"), PREVIOUS_KEK);

  for (const env of [
    {},
    { ...ENV, WHATSAPP_FLOW_ENDPOINT_KEK_ID: "missing" },
    { ...ENV, WHATSAPP_FLOW_ENDPOINT_KEK_REGISTRY_JSON: "{" },
    {
      ...ENV,
      WHATSAPP_FLOW_ENDPOINT_KEK_REGISTRY_JSON: JSON.stringify({
        "flow-kek-2026-07": Buffer.alloc(31).toString("base64"),
      }),
    },
  ]) {
    assert.throws(
      () => readWhatsAppFlowEndpointKekRegistry(env),
      assertKeyError("WHATSAPP_FLOW_KEY_CONFIGURATION_INVALID", 500),
    );
  }
});

test("AES-256-GCM envelope authenticates every tenant binding through AAD", () => {
  const publicKeySha256 = publicFingerprint(firstPair.publicKey);
  const binding = {
    endpointId: ENDPOINT_ID,
    connectionId: CONNECTION_ID,
    version: 1,
    publicKeySha256,
    wrappingKeyId: "flow-kek-2026-07",
  };
  const registry = readWhatsAppFlowEndpointKekRegistry(ENV);
  const encryptedPrivateKey = encryptWhatsAppFlowEndpointPrivateKey(
    firstPair.privateKey,
    binding,
    { registry, randomBytes: () => Buffer.alloc(12, 0x17) },
  );
  const [, iv, tag] = encryptedPrivateKey.split(".");
  assert.equal(Buffer.from(iv, "base64url").length, 12);
  assert.equal(Buffer.from(tag, "base64url").length, 16);

  const keyRecord = {
    encryptedPrivateKey,
    version: 1,
    publicKeySha256,
    wrappingKeyId: "flow-kek-2026-07",
  };
  const decrypted = decryptWhatsAppFlowEndpointPrivateKey(keyRecord, binding, { registry });
  assert.equal(publicFingerprint(crypto.createPublicKey(decrypted)), publicKeySha256);

  for (const changed of [
    { ...binding, endpointId: "22222222-2222-4222-8222-222222222222" },
    { ...binding, connectionId: "connection-b" },
  ]) {
    assert.throws(
      () => decryptWhatsAppFlowEndpointPrivateKey(keyRecord, changed, { registry }),
      assertKeyError("WHATSAPP_FLOW_KEY_MATERIAL_INVALID", 500),
    );
  }
  assert.throws(
    () => decryptWhatsAppFlowEndpointPrivateKey(
      { ...keyRecord, version: 2 },
      binding,
      { registry },
    ),
    assertKeyError("WHATSAPP_FLOW_KEY_MATERIAL_INVALID", 500),
  );

  const segments = encryptedPrivateKey.split(".");
  const ciphertext = Buffer.from(segments[3], "base64url");
  ciphertext[0] ^= 0xff;
  assert.throws(
    () => decryptWhatsAppFlowEndpointPrivateKey({
      ...keyRecord,
      encryptedPrivateKey: [segments[0], segments[1], segments[2], ciphertext.toString("base64url")].join("."),
    }, binding, { registry }),
    assertKeyError("WHATSAPP_FLOW_KEY_MATERIAL_INVALID", 500),
  );
});

test("RSA material is required to be a matching 2048-bit pair", () => {
  const weakPair = rsaKeyPair(1024);
  const fingerprint = publicFingerprint(weakPair.publicKey);
  assert.throws(
    () => encryptWhatsAppFlowEndpointPrivateKey(weakPair.privateKey, {
      endpointId: ENDPOINT_ID,
      connectionId: CONNECTION_ID,
      version: 1,
      publicKeySha256: fingerprint,
      wrappingKeyId: "flow-kek-2026-07",
    }, { registry: readWhatsAppFlowEndpointKekRegistry(ENV) }),
    assertKeyError("WHATSAPP_FLOW_KEY_MATERIAL_INVALID", 500),
  );
});

test("ensure is advisory-lock protected and idempotently creates only one STAGED key", async () => {
  const { prisma, state } = inMemoryPrisma({ connections: [connection()] });
  let generated = 0;
  const options = {
    env: ENV,
    keyPairFactory: () => {
      generated += 1;
      return firstPair;
    },
  };
  const first = await ensureWhatsAppFlowEndpoint(prisma, { connectionId: CONNECTION_ID }, options);
  const second = await ensureWhatsAppFlowEndpoint(prisma, { connectionId: CONNECTION_ID }, options);

  assert.equal(first.endpointCreated, true);
  assert.equal(first.keyCreated, true);
  assert.equal(second.endpointCreated, false);
  assert.equal(second.keyCreated, false);
  assert.equal(second.key.id, first.key.id);
  assert.equal(generated, 1);
  assert.equal(state.endpoints.length, 1);
  assert.equal(state.keys.length, 1);
  assert.equal(state.keys[0].status, "STAGED");
  assert.match(state.keys[0].encryptedPrivateKey, /^v1\./);
  assert.equal(state.keys[0].encryptedPrivateKey.includes("PRIVATE KEY"), false);
  assert.equal(
    state.rawCalls.filter(([statement]) => statement.includes("pg_advisory_xact_lock")).length,
    2,
  );
  assert.equal(JSON.stringify(first).includes("encryptedPrivateKey"), false);
  assert.equal(JSON.stringify(first).includes("privateKey"), false);
});

test("the same RSA fingerprint can never be reused by another connection", async () => {
  const { prisma, state } = inMemoryPrisma({
    connections: [connection("connection-a"), connection("connection-b")],
  });
  await ensureWhatsAppFlowEndpoint(
    prisma,
    { connectionId: "connection-a" },
    { env: ENV, keyPairFactory: () => firstPair },
  );
  await assert.rejects(
    ensureWhatsAppFlowEndpoint(
      prisma,
      { connectionId: "connection-b" },
      { env: ENV, keyPairFactory: () => firstPair },
    ),
    assertKeyError("WHATSAPP_FLOW_KEY_MATERIAL_INVALID", 500),
  );
  assert.equal(state.keys.length, 1);
});

test("activation requires Meta-confirmed upload and verification", async () => {
  const { prisma } = inMemoryPrisma({ connections: [connection()] });
  const ensured = await ensureWhatsAppFlowEndpoint(
    prisma,
    { connectionId: CONNECTION_ID },
    { env: ENV, keyPairFactory: () => firstPair },
  );
  const keyId = ensured.key.id;
  await assert.rejects(
    activateWhatsAppFlowEndpointKey(prisma, { connectionId: CONNECTION_ID, keyId }),
    assertKeyError("WHATSAPP_FLOW_KEY_NOT_VERIFIED", 409),
  );

  const uploadedAt = new Date("2026-07-16T10:00:00.000Z");
  await markWhatsAppFlowEndpointKeyUploaded(prisma, {
    connectionId: CONNECTION_ID,
    keyId,
    uploadedAt,
  });
  await assert.rejects(
    markWhatsAppFlowEndpointKeyVerified(prisma, {
      connectionId: CONNECTION_ID,
      keyId,
      publicKeyPem: ensured.key.publicKeyPem,
      signatureStatus: "INVALID",
      verifiedAt: new Date("2026-07-16T10:01:00.000Z"),
    }),
    assertKeyError("WHATSAPP_FLOW_KEY_NOT_VERIFIED", 409),
  );
  await markWhatsAppFlowEndpointKeyVerified(prisma, {
    connectionId: CONNECTION_ID,
    keyId,
    publicKeyPem: ensured.key.publicKeyPem,
    signatureStatus: "VALID",
    verifiedAt: new Date("2026-07-16T10:01:00.000Z"),
  });
  const activated = await activateWhatsAppFlowEndpointKey(prisma, {
    connectionId: CONNECTION_ID,
    keyId,
    activatedAt: new Date("2026-07-16T10:02:00.000Z"),
  });
  assert.equal(activated.key.status, "ACTIVE");
  assert.equal(activated.previousKey, null);
});

test("rotation preflight blocks a new STAGED key until the 48h retirement expires", async () => {
  const { prisma, state } = inMemoryPrisma({ connections: [connection()] });
  const pairs = [firstPair, secondPair, thirdPair];
  let generated = 0;
  const options = {
    env: ENV,
    keyPairFactory: () => {
      generated += 1;
      return pairs.shift();
    },
  };
  const initial = await ensureWhatsAppFlowEndpoint(
    prisma,
    { connectionId: CONNECTION_ID },
    options,
  );
  const initialUploaded = new Date("2026-07-15T10:00:00.000Z");
  await markWhatsAppFlowEndpointKeyUploaded(prisma, {
    connectionId: CONNECTION_ID,
    keyId: initial.key.id,
    uploadedAt: initialUploaded,
  });
  await markWhatsAppFlowEndpointKeyVerified(prisma, {
    connectionId: CONNECTION_ID,
    keyId: initial.key.id,
    publicKeyPem: initial.key.publicKeyPem,
    signatureStatus: "VALID",
    verifiedAt: new Date("2026-07-15T10:01:00.000Z"),
  });
  await activateWhatsAppFlowEndpointKey(prisma, {
    connectionId: CONNECTION_ID,
    keyId: initial.key.id,
    activatedAt: new Date("2026-07-15T10:02:00.000Z"),
  });

  const staged = await stageWhatsAppFlowEndpointRotation(
    prisma,
    { connectionId: CONNECTION_ID },
    { ...options, now: new Date("2026-07-16T08:58:00.000Z") },
  );
  const repeated = await stageWhatsAppFlowEndpointRotation(
    prisma,
    { connectionId: CONNECTION_ID },
    { ...options, now: new Date("2026-07-16T08:59:00.000Z") },
  );
  assert.equal(staged.keyCreated, true);
  assert.equal(repeated.keyCreated, false);
  assert.equal(repeated.key.id, staged.key.id);
  assert.equal(generated, 2);
  assert.deepEqual(state.keys.map((key) => key.status).sort(), ["ACTIVE", "STAGED"]);

  await markWhatsAppFlowEndpointKeyUploaded(prisma, {
    connectionId: CONNECTION_ID,
    keyId: staged.key.id,
    uploadedAt: new Date("2026-07-16T09:00:00.000Z"),
  });
  await markWhatsAppFlowEndpointKeyVerified(prisma, {
    connectionId: CONNECTION_ID,
    keyId: staged.key.id,
    publicKeyPem: staged.key.publicKeyPem,
    signatureStatus: "VALID",
    verifiedAt: new Date("2026-07-16T09:01:00.000Z"),
  });
  const rotationAt = new Date("2026-07-16T09:02:00.000Z");
  const activated = await activateWhatsAppFlowEndpointKey(prisma, {
    connectionId: CONNECTION_ID,
    keyId: staged.key.id,
    activatedAt: rotationAt,
  });
  assert.equal(activated.key.status, "ACTIVE");
  assert.equal(activated.previousKey.status, "RETIRING");
  assert.equal(new Date(activated.previousKey.retiringAt).getTime(), rotationAt.getTime());
  assert.equal(
    new Date(activated.previousKey.retireAfter).getTime() - rotationAt.getTime(),
    WHATSAPP_FLOW_ENDPOINT_RETIRING_WINDOW_MS,
  );

  await assert.rejects(
    stageWhatsAppFlowEndpointRotation(
      prisma,
      { connectionId: CONNECTION_ID },
      { ...options, now: new Date("2026-07-16T10:02:00.000Z") },
    ),
    assertKeyError("WHATSAPP_FLOW_KEY_ROTATION_IN_PROGRESS", 409),
  );
  assert.equal(generated, 2);
  assert.equal(state.keys.length, 2);
  assert.equal(state.keys.some((key) => key.status === "STAGED"), false);

  const next = await stageWhatsAppFlowEndpointRotation(
    prisma,
    { connectionId: CONNECTION_ID },
    { ...options, now: new Date("2026-07-18T09:02:01.000Z") },
  );
  assert.equal(next.keyCreated, true);
  assert.equal(next.key.status, "STAGED");
  assert.equal(generated, 3);
  assert.deepEqual(
    state.keys.map((key) => key.status).sort(),
    ["ACTIVE", "REVOKED", "STAGED"],
  );
});

test("runtime returns safe tenant scope and decrypts ACTIVE plus one unexpired RETIRING", async () => {
  const { prisma, state } = inMemoryPrisma({ connections: [connection()] });
  const pairs = [firstPair, secondPair];
  const options = { env: ENV, keyPairFactory: () => pairs.shift() };
  const first = await ensureWhatsAppFlowEndpoint(prisma, { connectionId: CONNECTION_ID }, options);
  await markWhatsAppFlowEndpointKeyUploaded(prisma, {
    connectionId: CONNECTION_ID,
    keyId: first.key.id,
    uploadedAt: new Date("2026-07-15T10:00:00.000Z"),
  });
  await markWhatsAppFlowEndpointKeyVerified(prisma, {
    connectionId: CONNECTION_ID,
    keyId: first.key.id,
    publicKeyPem: first.key.publicKeyPem,
    signatureStatus: "VALID",
    verifiedAt: new Date("2026-07-15T10:01:00.000Z"),
  });
  await activateWhatsAppFlowEndpointKey(prisma, {
    connectionId: CONNECTION_ID,
    keyId: first.key.id,
    activatedAt: new Date("2026-07-15T10:02:00.000Z"),
  });
  const second = await stageWhatsAppFlowEndpointRotation(
    prisma,
    { connectionId: CONNECTION_ID },
    options,
  );
  await markWhatsAppFlowEndpointKeyUploaded(prisma, {
    connectionId: CONNECTION_ID,
    keyId: second.key.id,
    uploadedAt: new Date("2026-07-16T09:00:00.000Z"),
  });
  await markWhatsAppFlowEndpointKeyVerified(prisma, {
    connectionId: CONNECTION_ID,
    keyId: second.key.id,
    publicKeyPem: second.key.publicKeyPem,
    signatureStatus: "VALID",
    verifiedAt: new Date("2026-07-16T09:01:00.000Z"),
  });
  await activateWhatsAppFlowEndpointKey(prisma, {
    connectionId: CONNECTION_ID,
    keyId: second.key.id,
    activatedAt: new Date("2026-07-16T09:02:00.000Z"),
  });

  state.keyQueries.length = 0;
  const runtime = await loadWhatsAppFlowEndpointRuntime(prisma, {
    endpointId: state.endpoints[0].id,
    now: new Date("2026-07-17T09:02:00.000Z"),
  }, { env: ENV });
  assert.equal(runtime.endpointId, state.endpoints[0].id);
  assert.equal(runtime.connectionId, CONNECTION_ID);
  assert.equal(runtime.projectId, "project-a");
  assert.equal(runtime.organizationId, "organization-a");
  assert.equal(runtime.keys.length, 2);
  assert.deepEqual(runtime.keys.map((key) => key.status), ["ACTIVE", "RETIRING"]);
  assert.equal(runtime.keys.every((key) => key.privateKey.includes("PRIVATE KEY")), true);
  const serialized = JSON.stringify(runtime);
  assert.equal(serialized.includes("must-never-leave-storage"), false);
  assert.equal(serialized.includes("encryptedAccessToken"), false);
  assert.equal(serialized.includes("encryptedPin"), false);
  assert.equal(state.keyQueries.length, 1);
  assert.equal(state.keyQueries[0].take, 3);
  assert.deepEqual(
    state.keyQueries[0].where.OR.map((candidate) => candidate.status),
    ["ACTIVE", "STAGED", "RETIRING"],
  );

  const afterRetirement = await loadWhatsAppFlowEndpointRuntime(prisma, {
    endpointId: state.endpoints[0].id,
    now: new Date("2026-07-18T09:02:01.000Z"),
  }, { env: ENV });
  assert.deepEqual(afterRetirement.keys.map((key) => key.status), ["ACTIVE"]);
});

test("runtime decrypts with an unpersisted STAGED key after the Meta upload crash window", async () => {
  const { prisma, state } = inMemoryPrisma({ connections: [connection()] });
  const pairs = [firstPair, secondPair];
  const options = { env: ENV, keyPairFactory: () => pairs.shift() };
  const first = await ensureWhatsAppFlowEndpoint(
    prisma,
    { connectionId: CONNECTION_ID },
    options,
  );
  await markWhatsAppFlowEndpointKeyUploaded(prisma, {
    connectionId: CONNECTION_ID,
    keyId: first.key.id,
    uploadedAt: new Date("2026-07-15T10:00:00.000Z"),
  });
  await markWhatsAppFlowEndpointKeyVerified(prisma, {
    connectionId: CONNECTION_ID,
    keyId: first.key.id,
    publicKeyPem: first.key.publicKeyPem,
    signatureStatus: "VALID",
    verifiedAt: new Date("2026-07-15T10:01:00.000Z"),
  });
  await activateWhatsAppFlowEndpointKey(prisma, {
    connectionId: CONNECTION_ID,
    keyId: first.key.id,
    activatedAt: new Date("2026-07-15T10:02:00.000Z"),
  });
  const staged = await stageWhatsAppFlowEndpointRotation(
    prisma,
    { connectionId: CONNECTION_ID },
    { ...options, now: new Date("2026-07-16T09:00:00.000Z") },
  );
  assert.equal(staged.key.uploadedAt, null);

  const runtime = await loadWhatsAppFlowEndpointRuntime(prisma, {
    endpointId: state.endpoints[0].id,
    now: new Date("2026-07-16T09:00:01.000Z"),
  }, { env: ENV });
  assert.deepEqual(runtime.keys.map((key) => key.status), ["ACTIVE", "STAGED"]);

  const expectedPayload = {
    version: "3.0",
    action: "ping",
    screen: "REPORT_INCIDENT",
    data: {},
  };
  const decrypted = decryptWhatsAppFlowRequest(
    encryptFlowRequest(expectedPayload, staged.key.publicKeyPem),
    { keys: runtime.keys },
  );
  assert.deepEqual(decrypted.payload, expectedPayload);
  assert.equal(decrypted.key.status, "STAGED");
});

test("safe metadata never serializes encrypted or decrypted private material", () => {
  const safe = getSafeWhatsAppFlowEndpointMetadata({
    id: ENDPOINT_ID,
    connectionId: CONNECTION_ID,
    enabled: true,
    encryptedPrivateKey: "root-secret",
    privateKey: "runtime-secret",
    keys: [{
      id: "22222222-2222-4222-8222-222222222222",
      endpointId: ENDPOINT_ID,
      version: 1,
      status: "ACTIVE",
      publicKeyPem: firstPair.publicKey,
      publicKeySha256: publicFingerprint(firstPair.publicKey),
      wrappingKeyId: "flow-kek-2026-07",
      encryptedPrivateKey: "row-secret",
      privateKey: "row-runtime-secret",
    }],
  });
  const serialized = JSON.stringify(safe);
  assert.equal(serialized.includes("secret"), false);
  assert.equal(serialized.includes("encryptedPrivateKey"), false);
  assert.equal(serialized.includes("privateKey"), false);
});

test("migration enforces cross-tenant uniqueness and audited rotation invariants", () => {
  const migration = fs.readFileSync(
    new URL("../prisma/migrations/20260717020000_whatsapp_flow_data_endpoints/migration.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /UNIQUE INDEX "WhatsAppFlowEndpointKey_publicKeySha256_key"[\s\S]*\("publicKeySha256"\)/);
  assert.match(migration, /one_retiring_per_endpoint_key[\s\S]*WHERE "status" = 'RETIRING'/);
  assert.match(migration, /"retireAfter" = "retiringAt" \+ INTERVAL '48 hours'/);
  assert.match(migration, /wrappingKeyId_status_idx/);
});
