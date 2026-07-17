import crypto from "node:crypto";
import { TextDecoder } from "node:util";

const ENVELOPE_FIELDS = Object.freeze([
  "encrypted_aes_key",
  "encrypted_flow_data",
  "initial_vector",
]);

const AES_KEY_BYTES = 16;
const AUTH_TAG_BYTES = 16;
const INITIAL_VECTOR_BYTES = 16;
const MIN_RSA_CIPHERTEXT_BYTES = 128;
const MAX_RSA_CIPHERTEXT_BYTES = 512;
const MAX_ENCRYPTED_FLOW_DATA_BYTES = 64 * 1024;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

const ERROR_DEFINITIONS = Object.freeze({
  WHATSAPP_FLOW_CRYPTO_ENVELOPE_INVALID: 400,
  WHATSAPP_FLOW_CRYPTO_PAYLOAD_INVALID: 400,
  WHATSAPP_FLOW_CRYPTO_RSA_KEY_MISMATCH: 421,
  WHATSAPP_FLOW_CRYPTO_KEYRING_INVALID: 500,
  WHATSAPP_FLOW_CRYPTO_RESPONSE_INVALID: 500,
});

export class WhatsAppFlowEndpointCryptoError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "WhatsAppFlowEndpointCryptoError";
    this.code = code;
    this.status = ERROR_DEFINITIONS[code] || 500;
  }
}

function cryptoError(message, code) {
  return new WhatsAppFlowEndpointCryptoError(message, code);
}

function isPlainObject(value) {
  return (
    value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype
  );
}

function assertExactEnvelope(envelope) {
  if (!isPlainObject(envelope)) {
    throw cryptoError(
      "Invalid WhatsApp Flow encryption envelope.",
      "WHATSAPP_FLOW_CRYPTO_ENVELOPE_INVALID",
    );
  }

  const actualFields = Object.keys(envelope).sort();
  const expectedFields = [...ENVELOPE_FIELDS].sort();
  if (
    actualFields.length !== expectedFields.length
    || actualFields.some((field, index) => field !== expectedFields[index])
  ) {
    throw cryptoError(
      "Invalid WhatsApp Flow encryption envelope.",
      "WHATSAPP_FLOW_CRYPTO_ENVELOPE_INVALID",
    );
  }
}

function canonicalBase64(value, { field, minBytes, maxBytes }) {
  if (
    typeof value !== "string"
    || value.length === 0
    || value.length % 4 !== 0
    || value.length > Math.ceil(maxBytes / 3) * 4
    || !BASE64_PATTERN.test(value)
  ) {
    throw cryptoError(
      `Invalid WhatsApp Flow ${field}.`,
      "WHATSAPP_FLOW_CRYPTO_ENVELOPE_INVALID",
    );
  }

  const decoded = Buffer.from(value, "base64");
  if (
    decoded.length < minBytes
    || decoded.length > maxBytes
    || decoded.toString("base64") !== value
  ) {
    throw cryptoError(
      `Invalid WhatsApp Flow ${field}.`,
      "WHATSAPP_FLOW_CRYPTO_ENVELOPE_INVALID",
    );
  }
  return decoded;
}

function privateKeyMaterial(key) {
  if (
    key
    && typeof key === "object"
    && !Buffer.isBuffer(key)
    && key.type !== "private"
    && Object.hasOwn(key, "privateKey")
  ) {
    return key.privateKey;
  }
  return key;
}

function validatedKeyring(keys) {
  if (!Array.isArray(keys) || keys.length === 0 || keys.length > 3) {
    throw cryptoError(
      "WhatsApp Flow endpoint keyring is not configured.",
      "WHATSAPP_FLOW_CRYPTO_KEYRING_INVALID",
    );
  }

  return keys.map((key) => {
    try {
      const privateKey = crypto.createPrivateKey(privateKeyMaterial(key));
      if (privateKey.asymmetricKeyType !== "rsa") {
        throw new TypeError("Expected an RSA private key.");
      }
      const modulusLength = privateKey.asymmetricKeyDetails?.modulusLength;
      if (
        !Number.isSafeInteger(modulusLength)
        || modulusLength < 1024
        || modulusLength > 4096
        || modulusLength % 8 !== 0
      ) {
        throw new TypeError("Unsupported RSA modulus length.");
      }
      return { key, privateKey };
    } catch {
      throw cryptoError(
        "WhatsApp Flow endpoint keyring contains an invalid private key.",
        "WHATSAPP_FLOW_CRYPTO_KEYRING_INVALID",
      );
    }
  });
}

function decryptAesKey(encryptedAesKey, keys) {
  for (const candidate of validatedKeyring(keys)) {
    try {
      const aesKey = crypto.privateDecrypt(
        {
          key: candidate.privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: "sha256",
        },
        encryptedAesKey,
      );
      return { aesKey, key: candidate.key };
    } catch {
      // A rotating keyring is expected to contain a key that cannot decrypt
      // some requests. Only fail after every configured key has been tried.
    }
  }

  throw cryptoError(
    "WhatsApp Flow encryption key could not be resolved.",
    "WHATSAPP_FLOW_CRYPTO_RSA_KEY_MISMATCH",
  );
}

function decryptPayload(encryptedFlowData, aesKey, initialVector) {
  if (aesKey.length !== AES_KEY_BYTES) {
    throw cryptoError(
      "Invalid WhatsApp Flow AES key.",
      "WHATSAPP_FLOW_CRYPTO_PAYLOAD_INVALID",
    );
  }
  if (encryptedFlowData.length <= AUTH_TAG_BYTES) {
    throw cryptoError(
      "Invalid WhatsApp Flow encrypted payload.",
      "WHATSAPP_FLOW_CRYPTO_PAYLOAD_INVALID",
    );
  }

  const ciphertext = encryptedFlowData.subarray(0, -AUTH_TAG_BYTES);
  const authTag = encryptedFlowData.subarray(-AUTH_TAG_BYTES);
  try {
    const decipher = crypto.createDecipheriv(
      "aes-128-gcm",
      aesKey,
      initialVector,
    );
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw cryptoError(
      "Invalid WhatsApp Flow encrypted payload.",
      "WHATSAPP_FLOW_CRYPTO_PAYLOAD_INVALID",
    );
  }
}

function parsePayload(payloadBuffer) {
  let payloadText;
  try {
    payloadText = new TextDecoder("utf-8", { fatal: true }).decode(payloadBuffer);
  } catch {
    throw cryptoError(
      "Invalid WhatsApp Flow payload encoding.",
      "WHATSAPP_FLOW_CRYPTO_PAYLOAD_INVALID",
    );
  }

  let payload;
  try {
    payload = JSON.parse(payloadText);
  } catch {
    throw cryptoError(
      "Invalid WhatsApp Flow payload JSON.",
      "WHATSAPP_FLOW_CRYPTO_PAYLOAD_INVALID",
    );
  }
  if (!isPlainObject(payload)) {
    throw cryptoError(
      "WhatsApp Flow payload must be a JSON object.",
      "WHATSAPP_FLOW_CRYPTO_PAYLOAD_INVALID",
    );
  }
  return payload;
}

function exactBytes(value, size) {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) return null;
  const bytes = Buffer.from(value);
  return bytes.length === size ? bytes : null;
}

export function decryptWhatsAppFlowRequest(envelope, { keys } = {}) {
  assertExactEnvelope(envelope);
  const encryptedAesKey = canonicalBase64(envelope.encrypted_aes_key, {
    field: "encrypted AES key",
    minBytes: MIN_RSA_CIPHERTEXT_BYTES,
    maxBytes: MAX_RSA_CIPHERTEXT_BYTES,
  });
  const encryptedFlowData = canonicalBase64(envelope.encrypted_flow_data, {
    field: "encrypted data",
    minBytes: AUTH_TAG_BYTES + 1,
    maxBytes: MAX_ENCRYPTED_FLOW_DATA_BYTES,
  });
  const initialVector = canonicalBase64(envelope.initial_vector, {
    field: "initial vector",
    minBytes: INITIAL_VECTOR_BYTES,
    maxBytes: INITIAL_VECTOR_BYTES,
  });

  const { aesKey, key } = decryptAesKey(encryptedAesKey, keys);
  const plaintext = decryptPayload(encryptedFlowData, aesKey, initialVector);
  return {
    payload: parsePayload(plaintext),
    aesKey,
    initialVector,
    key,
  };
}

export function encryptWhatsAppFlowResponse(response, { aesKey, initialVector } = {}) {
  if (!isPlainObject(response)) {
    throw cryptoError(
      "WhatsApp Flow response must be a plain object.",
      "WHATSAPP_FLOW_CRYPTO_RESPONSE_INVALID",
    );
  }

  const normalizedAesKey = exactBytes(aesKey, AES_KEY_BYTES);
  const normalizedInitialVector = exactBytes(initialVector, INITIAL_VECTOR_BYTES);
  if (!normalizedAesKey || !normalizedInitialVector) {
    throw cryptoError(
      "Invalid WhatsApp Flow response encryption context.",
      "WHATSAPP_FLOW_CRYPTO_RESPONSE_INVALID",
    );
  }

  let plaintext;
  try {
    plaintext = Buffer.from(JSON.stringify(response), "utf8");
  } catch {
    throw cryptoError(
      "Invalid WhatsApp Flow response JSON.",
      "WHATSAPP_FLOW_CRYPTO_RESPONSE_INVALID",
    );
  }
  if (plaintext.length === 0 || plaintext.length + AUTH_TAG_BYTES > MAX_ENCRYPTED_FLOW_DATA_BYTES) {
    throw cryptoError(
      "WhatsApp Flow response exceeds the encryption limit.",
      "WHATSAPP_FLOW_CRYPTO_RESPONSE_INVALID",
    );
  }

  const responseVector = Buffer.from(normalizedInitialVector).map(
    (byte) => byte ^ 0xff,
  );
  try {
    const cipher = crypto.createCipheriv(
      "aes-128-gcm",
      normalizedAesKey,
      responseVector,
    );
    const ciphertext = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
    ]);
    return Buffer.concat([ciphertext, cipher.getAuthTag()]).toString("base64");
  } catch {
    throw cryptoError(
      "WhatsApp Flow response could not be encrypted.",
      "WHATSAPP_FLOW_CRYPTO_RESPONSE_INVALID",
    );
  }
}
