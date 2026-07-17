import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import {
  decryptWhatsAppFlowRequest,
  encryptWhatsAppFlowResponse,
  WhatsAppFlowEndpointCryptoError,
} from "../src/lib/whatsapp/flow-endpoint-crypto.js";

function rsaKeyPair() {
  return crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
}

function encryptRequest(publicKey, payload, options = {}) {
  const aesKey = options.aesKey || crypto.randomBytes(16);
  const initialVector = options.initialVector || crypto.randomBytes(16);
  const plaintext = options.plaintext || Buffer.from(JSON.stringify(payload), "utf8");
  const cipher = crypto.createCipheriv("aes-128-gcm", aesKey, initialVector);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const encryptedFlowData = Buffer.concat([ciphertext, cipher.getAuthTag()]);
  const encryptedAesKey = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    aesKey,
  );
  return {
    envelope: {
      encrypted_aes_key: encryptedAesKey.toString("base64"),
      encrypted_flow_data: encryptedFlowData.toString("base64"),
      initial_vector: initialVector.toString("base64"),
    },
    aesKey,
    initialVector,
  };
}

function decryptResponse(encryptedResponse, { aesKey, initialVector }) {
  const bytes = Buffer.from(encryptedResponse, "base64");
  const ciphertext = bytes.subarray(0, -16);
  const authTag = bytes.subarray(-16);
  const responseVector = Buffer.from(initialVector).map((byte) => byte ^ 0xff);
  const decipher = crypto.createDecipheriv("aes-128-gcm", aesKey, responseVector);
  decipher.setAuthTag(authTag);
  return JSON.parse(Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8"));
}

function assertCryptoError(fn, { status, code }) {
  assert.throws(fn, (error) => {
    assert.equal(error instanceof WhatsAppFlowEndpointCryptoError, true);
    assert.equal(error.status, status);
    assert.equal(error.code, code);
    return true;
  });
}

function nonCanonicalEquivalent(base64) {
  assert.equal(base64.endsWith("=="), true);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const index = base64.length - 3;
  const canonical = alphabet.indexOf(base64[index]);
  const replacement = alphabet[(canonical & 0b110000) | 0b000001];
  const altered = `${base64.slice(0, index)}${replacement}${base64.slice(index + 1)}`;
  assert.deepEqual(Buffer.from(altered, "base64"), Buffer.from(base64, "base64"));
  assert.notEqual(altered, base64);
  return altered;
}

const primary = rsaKeyPair();
const secondary = rsaKeyPair();

test("decrypts an official-shape Flow request and encrypts the response", () => {
  const request = encryptRequest(primary.publicKey, {
    action: "ping",
    version: "3.0",
  });
  const selectedKey = { id: "key-v1", privateKey: primary.privateKey };
  const decrypted = decryptWhatsAppFlowRequest(request.envelope, {
    keys: [selectedKey],
  });

  assert.deepEqual(decrypted.payload, { action: "ping", version: "3.0" });
  assert.deepEqual(decrypted.aesKey, request.aesKey);
  assert.deepEqual(decrypted.initialVector, request.initialVector);
  assert.equal(decrypted.key, selectedKey);

  const response = { data: { status: "active" } };
  const encryptedResponse = encryptWhatsAppFlowResponse(response, decrypted);
  assert.match(encryptedResponse, /^[A-Za-z0-9+/]+={0,2}$/);
  assert.deepEqual(decryptResponse(encryptedResponse, request), response);
});

test("tries only the supplied keyring and returns the matching key", () => {
  const request = encryptRequest(secondary.publicKey, { action: "INIT" });
  const oldKey = { id: "retiring", privateKey: primary.privateKey };
  const currentKey = { id: "active", privateKey: secondary.privateKey };

  const decrypted = decryptWhatsAppFlowRequest(request.envelope, {
    keys: [oldKey, currentKey],
  });
  assert.equal(decrypted.key, currentKey);
  assert.deepEqual(decrypted.payload, { action: "INIT" });
});

test("returns 421 only when every supplied RSA key fails", () => {
  const request = encryptRequest(secondary.publicKey, { action: "ping" });

  assertCryptoError(
    () => decryptWhatsAppFlowRequest(request.envelope, {
      keys: [{ id: "wrong", privateKey: primary.privateKey }],
    }),
    {
      status: 421,
      code: "WHATSAPP_FLOW_CRYPTO_RSA_KEY_MISMATCH",
    },
  );
});

test("maps a tampered GCM tag to 400 and never to 421", () => {
  const request = encryptRequest(primary.publicKey, { action: "ping" });
  const encrypted = Buffer.from(request.envelope.encrypted_flow_data, "base64");
  encrypted[encrypted.length - 1] ^= 0xff;
  request.envelope.encrypted_flow_data = encrypted.toString("base64");

  assertCryptoError(
    () => decryptWhatsAppFlowRequest(request.envelope, {
      keys: [{ privateKey: primary.privateKey }],
    }),
    {
      status: 400,
      code: "WHATSAPP_FLOW_CRYPTO_PAYLOAD_INVALID",
    },
  );
});

test("rejects non-canonical standard base64 and extra envelope fields", () => {
  const request = encryptRequest(primary.publicKey, { action: "ping" });
  const nonCanonical = {
    ...request.envelope,
    initial_vector: nonCanonicalEquivalent(request.envelope.initial_vector),
  };
  assertCryptoError(
    () => decryptWhatsAppFlowRequest(nonCanonical, {
      keys: [{ privateKey: primary.privateKey }],
    }),
    {
      status: 400,
      code: "WHATSAPP_FLOW_CRYPTO_ENVELOPE_INVALID",
    },
  );

  assertCryptoError(
    () => decryptWhatsAppFlowRequest(
      { ...request.envelope, unexpected: "field" },
      { keys: [{ privateKey: primary.privateKey }] },
    ),
    {
      status: 400,
      code: "WHATSAPP_FLOW_CRYPTO_ENVELOPE_INVALID",
    },
  );
});

test("rejects invalid IV, decrypted AES key length, and missing auth tag as 400", () => {
  const request = encryptRequest(primary.publicKey, { action: "ping" });
  assertCryptoError(
    () => decryptWhatsAppFlowRequest(
      {
        ...request.envelope,
        initial_vector: crypto.randomBytes(12).toString("base64"),
      },
      { keys: [{ privateKey: primary.privateKey }] },
    ),
    {
      status: 400,
      code: "WHATSAPP_FLOW_CRYPTO_ENVELOPE_INVALID",
    },
  );

  const longAesKeyRequest = encryptRequest(primary.publicKey, { action: "ping" });
  longAesKeyRequest.envelope.encrypted_aes_key = crypto.publicEncrypt(
    {
      key: primary.publicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    crypto.randomBytes(32),
  ).toString("base64");
  assertCryptoError(
    () => decryptWhatsAppFlowRequest(longAesKeyRequest.envelope, {
      keys: [{ privateKey: primary.privateKey }],
    }),
    {
      status: 400,
      code: "WHATSAPP_FLOW_CRYPTO_PAYLOAD_INVALID",
    },
  );

  assertCryptoError(
    () => decryptWhatsAppFlowRequest(
      {
        ...request.envelope,
        encrypted_flow_data: crypto.randomBytes(16).toString("base64"),
      },
      { keys: [{ privateKey: primary.privateKey }] },
    ),
    {
      status: 400,
      code: "WHATSAPP_FLOW_CRYPTO_ENVELOPE_INVALID",
    },
  );
});

test("rejects invalid UTF-8, invalid JSON, and non-object JSON as payload errors", () => {
  const cases = [
    Buffer.from([0xc3, 0x28]),
    Buffer.from("{invalid-json", "utf8"),
    Buffer.from("[]", "utf8"),
  ];

  for (const plaintext of cases) {
    const request = encryptRequest(primary.publicKey, null, { plaintext });
    assertCryptoError(
      () => decryptWhatsAppFlowRequest(request.envelope, {
        keys: [{ privateKey: primary.privateKey }],
      }),
      {
        status: 400,
        code: "WHATSAPP_FLOW_CRYPTO_PAYLOAD_INVALID",
      },
    );
  }
});

test("uses the bitwise-inverted request IV for response encryption", () => {
  const request = encryptRequest(primary.publicKey, { action: "ping" });
  const decrypted = decryptWhatsAppFlowRequest(request.envelope, {
    keys: [{ privateKey: primary.privateKey }],
  });
  const encryptedResponse = encryptWhatsAppFlowResponse(
    { data: { acknowledged: true } },
    decrypted,
  );

  assert.deepEqual(
    decryptResponse(encryptedResponse, request),
    { data: { acknowledged: true } },
  );

  const bytes = Buffer.from(encryptedResponse, "base64");
  const decipher = crypto.createDecipheriv(
    "aes-128-gcm",
    request.aesKey,
    request.initialVector,
  );
  decipher.setAuthTag(bytes.subarray(-16));
  assert.throws(() => Buffer.concat([
    decipher.update(bytes.subarray(0, -16)),
    decipher.final(),
  ]));
});

test("rejects invalid response objects and encryption context", () => {
  assertCryptoError(
    () => encryptWhatsAppFlowResponse([], {
      aesKey: crypto.randomBytes(16),
      initialVector: crypto.randomBytes(16),
    }),
    {
      status: 500,
      code: "WHATSAPP_FLOW_CRYPTO_RESPONSE_INVALID",
    },
  );
  assertCryptoError(
    () => encryptWhatsAppFlowResponse({}, {
      aesKey: crypto.randomBytes(32),
      initialVector: crypto.randomBytes(12),
    }),
    {
      status: 500,
      code: "WHATSAPP_FLOW_CRYPTO_RESPONSE_INVALID",
    },
  );
});
