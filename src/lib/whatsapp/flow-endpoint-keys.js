import crypto from "node:crypto";

const ENVELOPE_VERSION = "v1";
const AAD_DOMAIN = "obrasaas:whatsapp-flow-endpoint-private-key";
const KEK_ID_ENV = "WHATSAPP_FLOW_ENDPOINT_KEK_ID";
const KEK_REGISTRY_ENV = "WHATSAPP_FLOW_ENDPOINT_KEK_REGISTRY_JSON";
const KEY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RETIRING_WINDOW_MS = 48 * 60 * 60 * 1_000;
const MAX_KEK_REGISTRY_BYTES = 32 * 1024;
const MAX_TRANSACTION_ATTEMPTS = 3;

const ERROR_STATUS = Object.freeze({
  WHATSAPP_FLOW_KEY_INPUT_INVALID: 400,
  WHATSAPP_FLOW_KEY_CONNECTION_NOT_FOUND: 404,
  WHATSAPP_FLOW_KEY_ENDPOINT_NOT_FOUND: 404,
  WHATSAPP_FLOW_KEY_NOT_FOUND: 404,
  WHATSAPP_FLOW_KEY_NOT_VERIFIED: 409,
  WHATSAPP_FLOW_KEY_ROTATION_IN_PROGRESS: 409,
  WHATSAPP_FLOW_KEY_STATE_CONFLICT: 409,
  WHATSAPP_FLOW_KEY_CONFIGURATION_INVALID: 500,
  WHATSAPP_FLOW_KEY_PERSISTENCE_UNAVAILABLE: 500,
  WHATSAPP_FLOW_KEY_MATERIAL_INVALID: 500,
});

export class WhatsAppFlowEndpointKeyError extends Error {
  constructor(message, code, { cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "WhatsAppFlowEndpointKeyError";
    this.code = code;
    this.status = ERROR_STATUS[code] || 500;
  }
}

function keyError(message, code, options) {
  return new WhatsAppFlowEndpointKeyError(message, code, options);
}

function isPlainObject(value) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function normalizedConnectionId(value) {
  const connectionId = typeof value === "string" ? value.trim() : "";
  if (!connectionId || connectionId.length > 191) {
    throw keyError(
      "WhatsApp connection id is invalid.",
      "WHATSAPP_FLOW_KEY_INPUT_INVALID",
    );
  }
  return connectionId;
}

function normalizedEndpointId(value) {
  const endpointId = typeof value === "string" ? value.trim() : "";
  if (!UUID_PATTERN.test(endpointId)) {
    throw keyError(
      "WhatsApp Flow endpoint id is invalid.",
      "WHATSAPP_FLOW_KEY_INPUT_INVALID",
    );
  }
  return endpointId.toLowerCase();
}

function normalizedKeyId(value) {
  const keyId = typeof value === "string" ? value.trim() : "";
  if (!UUID_PATTERN.test(keyId)) {
    throw keyError(
      "WhatsApp Flow endpoint key id is invalid.",
      "WHATSAPP_FLOW_KEY_INPUT_INVALID",
    );
  }
  return keyId.toLowerCase();
}

function normalizedDate(value = new Date()) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw keyError(
      "WhatsApp Flow endpoint key timestamp is invalid.",
      "WHATSAPP_FLOW_KEY_INPUT_INVALID",
    );
  }
  return date;
}

function decodeKek(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    return null;
  }
  const decoded = Buffer.from(value, "base64");
  return decoded.length === 32 && decoded.toString("base64") === value
    ? decoded
    : null;
}

/**
 * Reads the dedicated Flow-endpoint key-encryption-key registry. Credential
 * encryption intentionally uses another env var and another cryptographic
 * domain, so compromise or rotation of one store does not silently affect the
 * other.
 */
export function readWhatsAppFlowEndpointKekRegistry(env = process.env) {
  const currentKeyId = String(env?.[KEK_ID_ENV] || "").trim();
  const rawRegistry = String(env?.[KEK_REGISTRY_ENV] || "");
  if (
    !KEY_ID_PATTERN.test(currentKeyId)
    || !rawRegistry
    || Buffer.byteLength(rawRegistry, "utf8") > MAX_KEK_REGISTRY_BYTES
  ) {
    throw keyError(
      "WhatsApp Flow endpoint key encryption is not configured.",
      "WHATSAPP_FLOW_KEY_CONFIGURATION_INVALID",
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(rawRegistry);
  } catch (cause) {
    throw keyError(
      "WhatsApp Flow endpoint key registry is invalid.",
      "WHATSAPP_FLOW_KEY_CONFIGURATION_INVALID",
      { cause },
    );
  }
  if (!isPlainObject(parsed) || Object.keys(parsed).length === 0 || Object.keys(parsed).length > 32) {
    throw keyError(
      "WhatsApp Flow endpoint key registry is invalid.",
      "WHATSAPP_FLOW_KEY_CONFIGURATION_INVALID",
    );
  }

  const keys = new Map();
  for (const [keyId, encoded] of Object.entries(parsed)) {
    const key = KEY_ID_PATTERN.test(keyId) ? decodeKek(encoded) : null;
    if (!key) {
      throw keyError(
        "WhatsApp Flow endpoint key registry is invalid.",
        "WHATSAPP_FLOW_KEY_CONFIGURATION_INVALID",
      );
    }
    keys.set(keyId, key);
  }
  if (!keys.has(currentKeyId)) {
    throw keyError(
      "WhatsApp Flow endpoint active wrapping key is unavailable.",
      "WHATSAPP_FLOW_KEY_CONFIGURATION_INVALID",
    );
  }
  return { currentKeyId, keys };
}

function canonicalPublicKey(publicKey) {
  let key;
  try {
    key = publicKey instanceof crypto.KeyObject && publicKey.type === "public"
      ? publicKey
      : crypto.createPublicKey(publicKey);
  } catch (cause) {
    throw keyError(
      "WhatsApp Flow endpoint public key is invalid.",
      "WHATSAPP_FLOW_KEY_MATERIAL_INVALID",
      { cause },
    );
  }
  if (
    key.asymmetricKeyType !== "rsa"
    || key.asymmetricKeyDetails?.modulusLength !== 2048
  ) {
    throw keyError(
      "WhatsApp Flow endpoint keys must use RSA-2048.",
      "WHATSAPP_FLOW_KEY_MATERIAL_INVALID",
    );
  }
  const der = key.export({ type: "spki", format: "der" });
  return {
    pem: key.export({ type: "spki", format: "pem" }).toString("utf8"),
    sha256: crypto.createHash("sha256").update(der).digest("hex"),
  };
}

function canonicalPrivateKey(privateKey, expectedPublicKeySha256) {
  let key;
  try {
    key = crypto.createPrivateKey(privateKey);
  } catch (cause) {
    throw keyError(
      "WhatsApp Flow endpoint private key is invalid.",
      "WHATSAPP_FLOW_KEY_MATERIAL_INVALID",
      { cause },
    );
  }
  if (
    key.asymmetricKeyType !== "rsa"
    || key.asymmetricKeyDetails?.modulusLength !== 2048
  ) {
    throw keyError(
      "WhatsApp Flow endpoint keys must use RSA-2048.",
      "WHATSAPP_FLOW_KEY_MATERIAL_INVALID",
    );
  }
  const canonical = key.export({ type: "pkcs8", format: "pem" }).toString("utf8");
  const derivedPublic = canonicalPublicKey(crypto.createPublicKey(key));
  if (derivedPublic.sha256 !== expectedPublicKeySha256) {
    throw keyError(
      "WhatsApp Flow endpoint key pair does not match.",
      "WHATSAPP_FLOW_KEY_MATERIAL_INVALID",
    );
  }
  return canonical;
}

function keyAad({
  endpointId,
  connectionId,
  version,
  publicKeySha256,
  wrappingKeyId,
}) {
  const normalized = {
    domain: AAD_DOMAIN,
    envelopeVersion: ENVELOPE_VERSION,
    endpointId: normalizedEndpointId(endpointId),
    connectionId: normalizedConnectionId(connectionId),
    keyVersion: Number(version),
    publicKeySha256: String(publicKeySha256 || ""),
    wrappingKeyId: String(wrappingKeyId || ""),
  };
  if (
    !Number.isSafeInteger(normalized.keyVersion)
    || normalized.keyVersion < 1
    || !SHA256_PATTERN.test(normalized.publicKeySha256)
    || !KEY_ID_PATTERN.test(normalized.wrappingKeyId)
  ) {
    throw keyError(
      "WhatsApp Flow endpoint key binding is invalid.",
      "WHATSAPP_FLOW_KEY_MATERIAL_INVALID",
    );
  }
  return Buffer.from(JSON.stringify(normalized), "utf8");
}

function decodeBase64UrlCanonical(value) {
  if (typeof value !== "string" || !value || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const decoded = Buffer.from(value, "base64url");
  return decoded.toString("base64url") === value ? decoded : null;
}

export function encryptWhatsAppFlowEndpointPrivateKey(privateKey, binding, {
  registry = readWhatsAppFlowEndpointKekRegistry(),
  randomBytes = crypto.randomBytes,
} = {}) {
  const wrappingKeyId = binding?.wrappingKeyId || registry.currentKeyId;
  const kek = registry.keys.get(wrappingKeyId);
  if (!kek || kek.length !== 32) {
    throw keyError(
      "WhatsApp Flow endpoint wrapping key is unavailable.",
      "WHATSAPP_FLOW_KEY_CONFIGURATION_INVALID",
    );
  }
  const canonical = canonicalPrivateKey(privateKey, binding.publicKeySha256);
  const aad = keyAad({ ...binding, wrappingKeyId });
  const iv = Buffer.from(randomBytes(12));
  if (iv.length !== 12) {
    throw keyError(
      "WhatsApp Flow endpoint encryption IV is invalid.",
      "WHATSAPP_FLOW_KEY_CONFIGURATION_INVALID",
    );
  }
  try {
    const cipher = crypto.createCipheriv("aes-256-gcm", kek, iv);
    cipher.setAAD(aad, { plaintextLength: Buffer.byteLength(canonical, "utf8") });
    const ciphertext = Buffer.concat([cipher.update(canonical, "utf8"), cipher.final()]);
    return [
      ENVELOPE_VERSION,
      iv.toString("base64url"),
      cipher.getAuthTag().toString("base64url"),
      ciphertext.toString("base64url"),
    ].join(".");
  } catch (cause) {
    if (cause instanceof WhatsAppFlowEndpointKeyError) throw cause;
    throw keyError(
      "WhatsApp Flow endpoint private key could not be encrypted.",
      "WHATSAPP_FLOW_KEY_MATERIAL_INVALID",
      { cause },
    );
  }
}

export function decryptWhatsAppFlowEndpointPrivateKey(keyRecord, binding, {
  registry = readWhatsAppFlowEndpointKekRegistry(),
} = {}) {
  const wrappingKeyId = String(keyRecord?.wrappingKeyId || "");
  const kek = registry.keys.get(wrappingKeyId);
  if (!kek || kek.length !== 32) {
    throw keyError(
      "WhatsApp Flow endpoint wrapping key is unavailable.",
      "WHATSAPP_FLOW_KEY_CONFIGURATION_INVALID",
    );
  }
  const segments = String(keyRecord?.encryptedPrivateKey || "").split(".");
  const iv = decodeBase64UrlCanonical(segments[1]);
  const authTag = decodeBase64UrlCanonical(segments[2]);
  const ciphertext = decodeBase64UrlCanonical(segments[3]);
  if (
    segments.length !== 4
    || segments[0] !== ENVELOPE_VERSION
    || iv?.length !== 12
    || authTag?.length !== 16
    || !ciphertext?.length
  ) {
    throw keyError(
      "WhatsApp Flow endpoint encrypted key is invalid.",
      "WHATSAPP_FLOW_KEY_MATERIAL_INVALID",
    );
  }

  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", kek, iv);
    const aad = keyAad({
      ...binding,
      version: keyRecord.version,
      publicKeySha256: keyRecord.publicKeySha256,
      wrappingKeyId,
    });
    decipher.setAAD(aad, { plaintextLength: ciphertext.length });
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
    return canonicalPrivateKey(plaintext, keyRecord.publicKeySha256);
  } catch (cause) {
    if (cause instanceof WhatsAppFlowEndpointKeyError) throw cause;
    throw keyError(
      "WhatsApp Flow endpoint private key could not be decrypted.",
      "WHATSAPP_FLOW_KEY_MATERIAL_INVALID",
      { cause },
    );
  }
}

function generateRsaKeyPair() {
  return crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicExponent: 0x10001,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
}

function safeKeyMetadata(key) {
  if (!key) return null;
  return {
    id: key.id,
    endpointId: key.endpointId,
    version: key.version,
    status: key.status,
    publicKeyPem: key.publicKeyPem,
    publicKeySha256: key.publicKeySha256,
    wrappingKeyId: key.wrappingKeyId,
    uploadedAt: key.uploadedAt || null,
    verifiedAt: key.verifiedAt || null,
    activatedAt: key.activatedAt || null,
    retiringAt: key.retiringAt || null,
    retireAfter: key.retireAfter || null,
    lastUsedAt: key.lastUsedAt || null,
    createdAt: key.createdAt || null,
    updatedAt: key.updatedAt || null,
  };
}

export function getSafeWhatsAppFlowEndpointMetadata(endpoint, keys = endpoint?.keys || []) {
  if (!endpoint) return null;
  return {
    id: endpoint.id,
    connectionId: endpoint.connectionId,
    enabled: endpoint.enabled === true,
    createdAt: endpoint.createdAt || null,
    updatedAt: endpoint.updatedAt || null,
    keys: Array.from(keys || [], safeKeyMetadata).filter(Boolean),
  };
}

function assertPersistence(prisma) {
  if (typeof prisma?.$transaction !== "function") {
    throw keyError(
      "WhatsApp Flow endpoint key persistence is unavailable.",
      "WHATSAPP_FLOW_KEY_PERSISTENCE_UNAVAILABLE",
    );
  }
}

async function withConnectionKeyLock(prisma, connectionId, operation) {
  assertPersistence(prisma);
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(async (transaction) => {
        if (typeof transaction?.$executeRawUnsafe !== "function") {
          throw keyError(
            "WhatsApp Flow endpoint key locking is unavailable.",
            "WHATSAPP_FLOW_KEY_PERSISTENCE_UNAVAILABLE",
          );
        }
        await transaction.$executeRawUnsafe("SET LOCAL lock_timeout = '5000ms'");
        await transaction.$executeRawUnsafe(
          "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
          `obrasaas:whatsapp-flow-endpoint:${connectionId}`,
        );
        return operation(transaction);
      }, {
        isolationLevel: "ReadCommitted",
        maxWait: 5_000,
        timeout: 20_000,
      });
    } catch (error) {
      if (error?.code !== "P2034" || attempt === MAX_TRANSACTION_ATTEMPTS) throw error;
    }
  }
  throw keyError(
    "WhatsApp Flow endpoint key transaction failed.",
    "WHATSAPP_FLOW_KEY_PERSISTENCE_UNAVAILABLE",
  );
}

async function requireConnection(transaction, connectionId) {
  if (typeof transaction?.whatsAppConnection?.findUnique !== "function") {
    throw keyError(
      "WhatsApp Flow endpoint key persistence is unavailable.",
      "WHATSAPP_FLOW_KEY_PERSISTENCE_UNAVAILABLE",
    );
  }
  const connection = await transaction.whatsAppConnection.findUnique({
    where: { id: connectionId },
    select: { id: true },
  });
  if (!connection) {
    throw keyError(
      "WhatsApp connection was not found.",
      "WHATSAPP_FLOW_KEY_CONNECTION_NOT_FOUND",
    );
  }
  return connection;
}

async function getOrCreateEndpoint(transaction, connectionId) {
  if (
    typeof transaction?.whatsAppFlowEndpoint?.findUnique !== "function"
    || typeof transaction?.whatsAppFlowEndpoint?.create !== "function"
  ) {
    throw keyError(
      "WhatsApp Flow endpoint persistence is unavailable.",
      "WHATSAPP_FLOW_KEY_PERSISTENCE_UNAVAILABLE",
    );
  }
  const existing = await transaction.whatsAppFlowEndpoint.findUnique({
    where: { connectionId },
  });
  if (existing) return { endpoint: existing, created: false };
  return {
    endpoint: await transaction.whatsAppFlowEndpoint.create({
      data: { connectionId },
    }),
    created: true,
  };
}

async function findEndpointKey(transaction, endpointId, status) {
  return transaction.whatsAppFlowEndpointKey.findFirst({
    where: { endpointId, status },
    orderBy: { version: "desc" },
  });
}

async function createStagedKey(transaction, endpoint, connectionId, {
  env = process.env,
  keyPairFactory = generateRsaKeyPair,
  randomBytes = crypto.randomBytes,
} = {}) {
  const latest = await transaction.whatsAppFlowEndpointKey.findFirst({
    where: { endpointId: endpoint.id },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = Number(latest?.version || 0) + 1;
  if (!Number.isSafeInteger(version) || version < 1) {
    throw keyError(
      "WhatsApp Flow endpoint key version is invalid.",
      "WHATSAPP_FLOW_KEY_STATE_CONFLICT",
    );
  }
  const registry = readWhatsAppFlowEndpointKekRegistry(env);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const pair = keyPairFactory();
    const publicKey = canonicalPublicKey(pair?.publicKey);
    canonicalPrivateKey(pair?.privateKey, publicKey.sha256);
    const collision = typeof transaction.whatsAppFlowEndpointKey.findUnique === "function"
      ? await transaction.whatsAppFlowEndpointKey.findUnique({
          where: { publicKeySha256: publicKey.sha256 },
          select: { id: true },
        })
      : null;
    if (collision) continue;

    const binding = {
      endpointId: endpoint.id,
      connectionId,
      version,
      publicKeySha256: publicKey.sha256,
      wrappingKeyId: registry.currentKeyId,
    };
    const encryptedPrivateKey = encryptWhatsAppFlowEndpointPrivateKey(
      pair.privateKey,
      binding,
      { registry, randomBytes },
    );
    return transaction.whatsAppFlowEndpointKey.create({
      data: {
        endpointId: endpoint.id,
        version,
        status: "STAGED",
        encryptedPrivateKey,
        publicKeyPem: publicKey.pem,
        publicKeySha256: publicKey.sha256,
        wrappingKeyId: registry.currentKeyId,
      },
    });
  }
  throw keyError(
    "WhatsApp Flow endpoint generated a duplicate RSA key.",
    "WHATSAPP_FLOW_KEY_MATERIAL_INVALID",
  );
}

/**
 * Idempotently creates the per-connection endpoint and its initial STAGED key.
 * An existing ACTIVE or STAGED key is reused. Rotation is intentionally a
 * separate operation so normal provisioning cannot rotate production keys.
 */
export async function ensureWhatsAppFlowEndpoint(prisma, { connectionId }, options = {}) {
  const normalizedId = normalizedConnectionId(connectionId);
  return withConnectionKeyLock(prisma, normalizedId, async (transaction) => {
    await requireConnection(transaction, normalizedId);
    const { endpoint, created: endpointCreated } = await getOrCreateEndpoint(
      transaction,
      normalizedId,
    );
    const staged = await findEndpointKey(transaction, endpoint.id, "STAGED");
    const active = staged
      ? null
      : await findEndpointKey(transaction, endpoint.id, "ACTIVE");
    const key = staged || active || await createStagedKey(
      transaction,
      endpoint,
      normalizedId,
      options,
    );
    return {
      endpoint: getSafeWhatsAppFlowEndpointMetadata(endpoint, [key]),
      key: safeKeyMetadata(key),
      endpointCreated,
      keyCreated: !staged && !active,
    };
  });
}

export const ensureWhatsAppFlowEndpointStagedKey = ensureWhatsAppFlowEndpoint;

/** Explicit rotation may stage one new key next to the current ACTIVE key. */
export async function stageWhatsAppFlowEndpointRotation(
  prisma,
  { connectionId },
  options = {},
) {
  const normalizedId = normalizedConnectionId(connectionId);
  const timestamp = normalizedDate(options.now ?? new Date());
  return withConnectionKeyLock(prisma, normalizedId, async (transaction) => {
    await requireConnection(transaction, normalizedId);
    const endpoint = await transaction.whatsAppFlowEndpoint.findUnique({
      where: { connectionId: normalizedId },
    });
    if (!endpoint) {
      throw keyError(
        "WhatsApp Flow endpoint was not found.",
        "WHATSAPP_FLOW_KEY_ENDPOINT_NOT_FOUND",
      );
    }
    const active = await findEndpointKey(transaction, endpoint.id, "ACTIVE");
    if (!active) {
      throw keyError(
        "WhatsApp Flow endpoint has no active key to rotate.",
        "WHATSAPP_FLOW_KEY_STATE_CONFLICT",
      );
    }

    const existingRetiring = await findEndpointKey(transaction, endpoint.id, "RETIRING");
    if (existingRetiring) {
      if (new Date(existingRetiring.retireAfter).getTime() > timestamp.getTime()) {
        throw keyError(
          "A WhatsApp Flow endpoint key rotation is still in progress.",
          "WHATSAPP_FLOW_KEY_ROTATION_IN_PROGRESS",
        );
      }
      await transaction.whatsAppFlowEndpointKey.update({
        where: { id: existingRetiring.id },
        data: { status: "REVOKED" },
      });
    }

    const existingStaged = await findEndpointKey(transaction, endpoint.id, "STAGED");
    const key = existingStaged || await createStagedKey(
      transaction,
      endpoint,
      normalizedId,
      options,
    );
    return {
      endpoint: getSafeWhatsAppFlowEndpointMetadata(endpoint, [active, key]),
      key: safeKeyMetadata(key),
      keyCreated: !existingStaged,
    };
  });
}

async function requireEndpointAndKey(transaction, connectionId, keyId) {
  await requireConnection(transaction, connectionId);
  const endpoint = await transaction.whatsAppFlowEndpoint.findUnique({
    where: { connectionId },
  });
  if (!endpoint) {
    throw keyError(
      "WhatsApp Flow endpoint was not found.",
      "WHATSAPP_FLOW_KEY_ENDPOINT_NOT_FOUND",
    );
  }
  const key = await transaction.whatsAppFlowEndpointKey.findFirst({
    where: { id: keyId, endpointId: endpoint.id },
  });
  if (!key) {
    throw keyError(
      "WhatsApp Flow endpoint key was not found.",
      "WHATSAPP_FLOW_KEY_NOT_FOUND",
    );
  }
  return { endpoint, key };
}

export async function markWhatsAppFlowEndpointKeyUploaded(
  prisma,
  { connectionId, keyId, uploadedAt = new Date() },
) {
  const normalizedId = normalizedConnectionId(connectionId);
  const normalizedKey = normalizedKeyId(keyId);
  const timestamp = normalizedDate(uploadedAt);
  return withConnectionKeyLock(prisma, normalizedId, async (transaction) => {
    const { key } = await requireEndpointAndKey(transaction, normalizedId, normalizedKey);
    if (key.status !== "STAGED") {
      throw keyError(
        "Only a staged WhatsApp Flow endpoint key can be uploaded.",
        "WHATSAPP_FLOW_KEY_STATE_CONFLICT",
      );
    }
    if (key.uploadedAt) return safeKeyMetadata(key);
    const updated = await transaction.whatsAppFlowEndpointKey.update({
      where: { id: key.id },
      data: { uploadedAt: timestamp },
    });
    return safeKeyMetadata(updated);
  });
}

export async function markWhatsAppFlowEndpointKeyVerified(
  prisma,
  {
    connectionId,
    keyId,
    publicKeyPem,
    signatureStatus,
    verifiedAt = new Date(),
  },
) {
  const normalizedId = normalizedConnectionId(connectionId);
  const normalizedKey = normalizedKeyId(keyId);
  const timestamp = normalizedDate(verifiedAt);
  return withConnectionKeyLock(prisma, normalizedId, async (transaction) => {
    const { key } = await requireEndpointAndKey(transaction, normalizedId, normalizedKey);
    if (key.status !== "STAGED" || !key.uploadedAt) {
      throw keyError(
        "WhatsApp Flow endpoint key must be uploaded before verification.",
        "WHATSAPP_FLOW_KEY_STATE_CONFLICT",
      );
    }
    const confirmed = canonicalPublicKey(publicKeyPem);
    if (
      signatureStatus !== "VALID"
      || confirmed.sha256 !== key.publicKeySha256
      || timestamp.getTime() < new Date(key.uploadedAt).getTime()
    ) {
      throw keyError(
        "Meta did not verify the staged WhatsApp Flow endpoint key.",
        "WHATSAPP_FLOW_KEY_NOT_VERIFIED",
      );
    }
    if (key.verifiedAt) return safeKeyMetadata(key);
    const updated = await transaction.whatsAppFlowEndpointKey.update({
      where: { id: key.id },
      data: { verifiedAt: timestamp },
    });
    return safeKeyMetadata(updated);
  });
}

export async function activateWhatsAppFlowEndpointKey(
  prisma,
  { connectionId, keyId, activatedAt = new Date() },
) {
  const normalizedId = normalizedConnectionId(connectionId);
  const normalizedKey = normalizedKeyId(keyId);
  const timestamp = normalizedDate(activatedAt);
  return withConnectionKeyLock(prisma, normalizedId, async (transaction) => {
    const { endpoint, key } = await requireEndpointAndKey(
      transaction,
      normalizedId,
      normalizedKey,
    );
    if (key.status === "ACTIVE") {
      return {
        endpoint: getSafeWhatsAppFlowEndpointMetadata(endpoint, [key]),
        key: safeKeyMetadata(key),
        previousKey: null,
        activated: false,
      };
    }
    if (
      key.status !== "STAGED"
      || !key.uploadedAt
      || !key.verifiedAt
      || timestamp.getTime() < new Date(key.verifiedAt).getTime()
    ) {
      throw keyError(
        "WhatsApp Flow endpoint key has not been verified.",
        "WHATSAPP_FLOW_KEY_NOT_VERIFIED",
      );
    }

    const existingRetiring = await findEndpointKey(transaction, endpoint.id, "RETIRING");
    if (existingRetiring) {
      if (new Date(existingRetiring.retireAfter).getTime() > timestamp.getTime()) {
        throw keyError(
          "A WhatsApp Flow endpoint key rotation is still in progress.",
          "WHATSAPP_FLOW_KEY_ROTATION_IN_PROGRESS",
        );
      }
      await transaction.whatsAppFlowEndpointKey.update({
        where: { id: existingRetiring.id },
        data: { status: "REVOKED" },
      });
    }

    const active = await findEndpointKey(transaction, endpoint.id, "ACTIVE");
    let previousKey = null;
    if (active) {
      previousKey = await transaction.whatsAppFlowEndpointKey.update({
        where: { id: active.id },
        data: {
          status: "RETIRING",
          retiringAt: timestamp,
          retireAfter: new Date(timestamp.getTime() + RETIRING_WINDOW_MS),
        },
      });
    }
    const activated = await transaction.whatsAppFlowEndpointKey.update({
      where: { id: key.id },
      data: {
        status: "ACTIVE",
        activatedAt: timestamp,
        retiringAt: null,
        retireAfter: null,
      },
    });
    return {
      endpoint: getSafeWhatsAppFlowEndpointMetadata(
        endpoint,
        previousKey ? [activated, previousKey] : [activated],
      ),
      key: safeKeyMetadata(activated),
      previousKey: safeKeyMetadata(previousKey),
      activated: true,
    };
  });
}

/**
 * Loads only the public tenant scope needed by the data endpoint and decrypts
 * the ACTIVE key, the sole STAGED key, and the newest unexpired RETIRING key.
 * STAGED is a deliberate crash-recovery fallback: Meta may begin encrypting
 * with a just-uploaded public key before local upload/activation persistence
 * completes. Access tokens, PINs and REVOKED keys are not selected.
 */
export async function loadWhatsAppFlowEndpointRuntime(
  prisma,
  { endpointId, now = new Date() },
  { env = process.env } = {},
) {
  const normalizedEndpoint = normalizedEndpointId(endpointId);
  const timestamp = normalizedDate(now);
  if (
    typeof prisma?.whatsAppFlowEndpoint?.findUnique !== "function"
    || typeof prisma?.whatsAppFlowEndpointKey?.findMany !== "function"
  ) {
    throw keyError(
      "WhatsApp Flow endpoint persistence is unavailable.",
      "WHATSAPP_FLOW_KEY_PERSISTENCE_UNAVAILABLE",
    );
  }
  const endpoint = await prisma.whatsAppFlowEndpoint.findUnique({
    where: { id: normalizedEndpoint },
    select: {
      id: true,
      connectionId: true,
      enabled: true,
      connection: {
        select: {
          id: true,
          enabled: true,
          connectionStatus: true,
          phoneNumberId: true,
          metadata: true,
          projectId: true,
          project: {
            select: {
              id: true,
              organizationId: true,
              organization: {
                select: {
                  id: true,
                  subscriptionPlan: true,
                  subscriptionStatus: true,
                  trialEndsAt: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!endpoint?.connection?.project?.organization) {
    throw keyError(
      "WhatsApp Flow endpoint was not found.",
      "WHATSAPP_FLOW_KEY_ENDPOINT_NOT_FOUND",
    );
  }

  // One statement gives the request a coherent rotation snapshot. Three
  // independent reads could otherwise straddle STAGED -> ACTIVE and return a
  // keyring containing neither representation of the newly uploaded key.
  const runtimeKeyRecords = await prisma.whatsAppFlowEndpointKey.findMany({
    where: {
      endpointId: endpoint.id,
      OR: [
        { status: "ACTIVE" },
        { status: "STAGED" },
        {
          status: "RETIRING",
          retireAfter: { gt: timestamp },
        },
      ],
    },
    orderBy: { version: "desc" },
    take: 3,
  });
  const active = runtimeKeyRecords.find((key) => key.status === "ACTIVE") || null;
  const staged = runtimeKeyRecords.find((key) => key.status === "STAGED") || null;
  const retiring = runtimeKeyRecords.find((key) => key.status === "RETIRING") || null;
  if (!active && !staged) {
    throw keyError(
      "WhatsApp Flow endpoint has no usable key.",
      "WHATSAPP_FLOW_KEY_STATE_CONFLICT",
    );
  }

  const registry = readWhatsAppFlowEndpointKekRegistry(env);
  const connection = endpoint.connection;
  const project = connection.project;
  const keyRecords = [active, staged, retiring].filter(Boolean);
  const keys = keyRecords.map((key) => ({
    id: key.id,
    version: key.version,
    status: key.status,
    privateKey: decryptWhatsAppFlowEndpointPrivateKey(key, {
      endpointId: endpoint.id,
      connectionId: endpoint.connectionId,
    }, { registry }),
  }));

  return {
    endpointId: endpoint.id,
    connectionId: endpoint.connectionId,
    organizationId: project.organizationId,
    projectId: project.id,
    phoneNumberId: connection.phoneNumberId,
    enabled: endpoint.enabled === true,
    connectionEnabled: connection.enabled === true,
    connectionStatus: connection.connectionStatus,
    metadata: connection.metadata,
    project: {
      id: project.id,
      organizationId: project.organizationId,
    },
    organization: {
      id: project.organization.id,
      subscriptionPlan: project.organization.subscriptionPlan,
      subscriptionStatus: project.organization.subscriptionStatus,
      trialEndsAt: project.organization.trialEndsAt,
    },
    keys,
  };
}

export const WHATSAPP_FLOW_ENDPOINT_RETIRING_WINDOW_MS = RETIRING_WINDOW_MS;
