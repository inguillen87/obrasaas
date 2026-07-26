import crypto from "node:crypto";

import { credentialLastFour, encryptCredential } from "../credentials.js";
import { subscriptionAllowsWrites } from "../plans.js";
import { isExternalTenant } from "../superadmin-tenants.js";
import { roleHasPermission } from "../tenant-roles.js";
import { buildWhatsAppChannelHealthMetadata } from "./channel-health.js";
import {
  isValidMetaResourceId,
  isValidRegistrationPin,
  mergeWhatsAppConnectionMetadata,
  preparePilotWhatsAppCredential,
} from "./embedded-signup.js";
import {
  acquireWhatsAppConnectionLease,
  commitWhatsAppConnectionLease,
  releaseWhatsAppConnectionLease,
} from "./flow-provisioning-lease.js";

const BODY_FIELDS = new Set([
  "accessToken",
  "phoneNumberId",
  "projectId",
  "registrationPin",
  "whatsappBusinessId",
]);
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const PROJECT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const PILOT_ALLOWED_ASSET_PATTERN = /^\d{5,32}:\d{5,32}$/;
const PILOT_ALLOWED_ASSET_LIMIT = 20;
const PILOT_HISTORY_LIMIT = 8;
const PILOT_OPERATION_ALIAS_LIMIT = 32;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export class WhatsAppPilotImportError extends Error {
  constructor(
    message,
    { code = "WHATSAPP_PILOT_IMPORT_FAILED", status = 400 } = {},
  ) {
    super(message);
    this.name = "WhatsAppPilotImportError";
    this.code = code;
    this.status = status;
  }
}

function pilotError(message, code, status = 400) {
  return new WhatsAppPilotImportError(message, { code, status });
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function requiredFingerprintSecret(value) {
  const secret = typeof value === "string" ? value : "";
  if (secret.length < 32) {
    throw pilotError(
      "La importaci\u00f3n piloto no tiene protecci\u00f3n criptogr\u00e1fica disponible.",
      "WHATSAPP_PILOT_IMPORT_CRYPTO_UNAVAILABLE",
      503,
    );
  }
  return secret;
}

function hmac(secret, domain, payload) {
  return crypto
    .createHmac("sha256", secret)
    .update(`obrasaas:whatsapp-pilot-import:${domain}:v1\0`, "utf8")
    .update(JSON.stringify(payload), "utf8")
    .digest("hex");
}

function requiredAllowedPilotAssets(value) {
  const serialized = typeof value === "string" ? value : "";
  const entries = serialized ? serialized.split(",") : [];
  const uniqueEntries = new Set(entries);
  if (
    !serialized ||
    serialized.length > 2_048 ||
    entries.length > PILOT_ALLOWED_ASSET_LIMIT ||
    uniqueEntries.size !== entries.length ||
    entries.some((entry) => !PILOT_ALLOWED_ASSET_PATTERN.test(entry))
  ) {
    throw pilotError(
      "La lista segura de activos piloto no est\u00e1 disponible.",
      "PILOT_ASSET_ALLOWLIST_UNAVAILABLE",
      503,
    );
  }
  return uniqueEntries;
}

export function listAllowedWhatsAppPilotAssets(value) {
  return [...requiredAllowedPilotAssets(value)].map((entry) => {
    const [whatsappBusinessId, phoneNumberId] = entry.split(":");
    return { whatsappBusinessId, phoneNumberId };
  });
}

export function normalizeWhatsAppPilotImportRequest(
  body,
  {
    idempotencyKey,
    fingerprintSecret = process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY,
    allowedAssets = process.env.WHATSAPP_PILOT_ALLOWED_ASSETS,
  } = {},
) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw pilotError(
      "El cuerpo de la importaci\u00f3n es inv\u00e1lido.",
      "PILOT_IMPORT_BODY_INVALID",
    );
  }
  if (Object.keys(body).some((field) => !BODY_FIELDS.has(field))) {
    throw pilotError(
      "La solicitud contiene campos no permitidos.",
      "PILOT_IMPORT_FIELDS_INVALID",
    );
  }
  const operationKey = String(idempotencyKey || "").trim();
  if (!IDEMPOTENCY_KEY_PATTERN.test(operationKey)) {
    throw pilotError(
      "Envi\u00e1 un encabezado Idempotency-Key v\u00e1lido de entre 8 y 128 caracteres.",
      "IDEMPOTENCY_KEY_INVALID",
    );
  }

  const projectId =
    typeof body.projectId === "string" ? body.projectId.trim() : "";
  const whatsappBusinessId =
    typeof body.whatsappBusinessId === "string"
      ? body.whatsappBusinessId.trim()
      : "";
  const phoneNumberId =
    typeof body.phoneNumberId === "string" ? body.phoneNumberId.trim() : "";
  const accessToken = body.accessToken;
  const hasPin = Object.hasOwn(body, "registrationPin");
  const registrationPin =
    hasPin && typeof body.registrationPin === "string"
      ? body.registrationPin
      : undefined;
  if (!PROJECT_ID_PATTERN.test(projectId)) {
    throw pilotError(
      "La obra seleccionada es inv\u00e1lida.",
      "PILOT_PROJECT_INVALID",
    );
  }
  if (
    !isValidMetaResourceId(whatsappBusinessId) ||
    !isValidMetaResourceId(phoneNumberId)
  ) {
    throw pilotError(
      "Los identificadores de WhatsApp son inv\u00e1lidos.",
      "PILOT_META_IDS_INVALID",
    );
  }
  const allowedAssetPairs = requiredAllowedPilotAssets(allowedAssets);
  if (!allowedAssetPairs.has(`${whatsappBusinessId}:${phoneNumberId}`)) {
    throw pilotError(
      "El activo de WhatsApp no est\u00e1 habilitado para esta prueba.",
      "PILOT_ASSET_NOT_ALLOWED",
      403,
    );
  }
  if (
    typeof accessToken !== "string" ||
    accessToken.length < 20 ||
    accessToken.length > 4_096 ||
    accessToken.trim() !== accessToken
  ) {
    throw pilotError(
      "El token temporal es inv\u00e1lido.",
      "PILOT_TOKEN_INVALID",
    );
  }
  if (
    hasPin &&
    (typeof body.registrationPin !== "string" ||
      !isValidRegistrationPin(registrationPin))
  ) {
    throw pilotError(
      "El PIN de registro es inv\u00e1lido.",
      "PILOT_PIN_INVALID",
    );
  }

  const secret = requiredFingerprintSecret(fingerprintSecret);
  const idempotencyKeyHash = hmac(secret, "operation", { operationKey });
  const requestFingerprint = hmac(secret, "request", {
    projectId,
    whatsappBusinessId,
    phoneNumberId,
    accessToken,
    registrationPin: hasPin ? registrationPin : null,
  });
  return {
    accessToken,
    idempotencyKeyHash,
    phoneNumberId,
    projectId,
    registrationPin,
    requestFingerprint,
    whatsappBusinessId,
  };
}

function publicConnection(connection, operation, { replayed }) {
  return {
    id: connection.id,
    projectId: connection.projectId,
    phoneNumberId: connection.phoneNumberId,
    whatsappBusinessId: connection.whatsappBusinessId,
    displayPhoneNumber: connection.displayPhoneNumber || null,
    verifiedBusinessName: connection.verifiedBusinessName || null,
    connectionStatus: connection.connectionStatus,
    credentialExpiresAt:
      Number(operation.expiresAt) > 0
        ? new Date(Number(operation.expiresAt) * 1_000).toISOString()
        : null,
    temporaryCredential: true,
    registrationPerformed: operation.registrationPerformed === true,
    registrationRecovered: operation.registrationRecovered === true,
    recoveryRekeyed: operation.recoveryRekeyed === true,
    replayed,
  };
}

function pilotOperationKeyAliases(entry) {
  if (!Array.isArray(entry.operationKeyAliases)) return [];
  return [
    ...new Set(
      entry.operationKeyAliases.filter(
        (value) =>
          typeof value === "string" &&
          SHA256_PATTERN.test(value) &&
          value !== entry.operationKeyHash,
      ),
    ),
  ].slice(0, PILOT_OPERATION_ALIAS_LIMIT);
}

function pilotOperationContainsKey(operation, operationKeyHash) {
  return (
    operation.operationKeyHash === operationKeyHash ||
    pilotOperationKeyAliases(operation).includes(operationKeyHash)
  );
}

function pilotImportState(metadata) {
  const state = record(record(metadata).pilotImport);
  return {
    currentOperationKeyHash:
      typeof state.currentOperationKeyHash === "string"
        ? state.currentOperationKeyHash
        : null,
    operations: Array.isArray(state.operations)
      ? state.operations
          .map(record)
          .filter(
            (entry) =>
              SHA256_PATTERN.test(entry.operationKeyHash) &&
              SHA256_PATTERN.test(entry.requestFingerprint),
          )
          .map((entry) => {
            const operationKeyAliases = pilotOperationKeyAliases(entry);
            return {
              ...entry,
              ...(operationKeyAliases.length > 0
                ? { operationKeyAliases }
                : {}),
            };
          })
          .slice(-PILOT_HISTORY_LIMIT)
      : [],
  };
}

function replayForConnection(connection, input) {
  if (!connection) return null;
  const state = pilotImportState(connection.metadata);
  const operation = state.operations.find((entry) =>
    pilotOperationContainsKey(entry, input.idempotencyKeyHash),
  );
  if (!operation) return null;
  if (operation.requestFingerprint !== input.requestFingerprint) {
    throw pilotError(
      "La clave de idempotencia ya fue usada con otros datos.",
      "IDEMPOTENCY_PAYLOAD_MISMATCH",
      409,
    );
  }
  if (
    state.currentOperationKeyHash !== operation.operationKeyHash ||
    connection.projectId !== input.projectId ||
    connection.phoneNumberId !== input.phoneNumberId ||
    connection.whatsappBusinessId !== input.whatsappBusinessId ||
    connection.enabled !== true ||
    connection.connectionStatus !== "CONNECTED" ||
    !connection.encryptedAccessToken
  ) {
    throw pilotError(
      "La conexi\u00f3n cambi\u00f3 despu\u00e9s de esta operaci\u00f3n.",
      "PILOT_IMPORT_REPLAY_SUPERSEDED",
      409,
    );
  }
  return {
    connection: publicConnection(connection, operation, { replayed: true }),
  };
}

function nextPilotMetadata(
  metadata,
  input,
  verified,
  now,
  {
    identityChanged,
    registrationRecovered = false,
    recoveryOperationKeyHashes = [],
  },
) {
  const health = buildWhatsAppChannelHealthMetadata(metadata, verified, {
    now,
  });
  const merged = mergeWhatsAppConnectionMetadata(metadata, health, {
    identityChanged,
    preservePilotImportCurrent: true,
  });
  const state = pilotImportState(merged);
  const operationKeyAliases = pilotOperationKeyAliases({
    operationKeyHash: input.idempotencyKeyHash,
    operationKeyAliases: recoveryOperationKeyHashes,
  });
  const operation = {
    operationKeyHash: input.idempotencyKeyHash,
    ...(operationKeyAliases.length > 0 ? { operationKeyAliases } : {}),
    requestFingerprint: input.requestFingerprint,
    completedAt: now.toISOString(),
    projectId: input.projectId,
    phoneNumberId: input.phoneNumberId,
    whatsappBusinessId: input.whatsappBusinessId,
    expiresAt: verified.expiresAt,
    registrationPerformed: verified.registrationPerformed === true,
    registrationRecovered: registrationRecovered === true,
    recoveryRekeyed: operationKeyAliases.length > 0,
  };
  const operationKeyHashes = new Set([
    input.idempotencyKeyHash,
    ...pilotOperationKeyAliases(operation),
  ]);
  const operations = [
    ...state.operations.filter(
      (entry) =>
        ![entry.operationKeyHash, ...pilotOperationKeyAliases(entry)].some(
          (operationKeyHash) => operationKeyHashes.has(operationKeyHash),
        ),
    ),
    operation,
  ].slice(-PILOT_HISTORY_LIMIT);
  const nextMetadata = {
    ...merged,
    credentialOrigin: "meta_test_number",
    temporaryCredential: true,
    pilotImport: {
      version: 1,
      currentOperationKeyHash: input.idempotencyKeyHash,
      operations,
    },
  };
  delete nextMetadata.pilotImportReservation;
  return nextMetadata;
}

function reservationMetadata(input, now) {
  return {
    credentialOrigin: "meta_test_number",
    temporaryCredential: true,
    pilotImportReservation: {
      version: 1,
      operationKeyHash: input.idempotencyKeyHash,
      requestFingerprint: input.requestFingerprint,
      reservedAt: now.toISOString(),
    },
  };
}

function reservationRecoveryRequired() {
  return pilotError(
    "La operaci\u00f3n remota anterior qued\u00f3 incierta y requiere recuperaci\u00f3n expl\u00edcita.",
    "PILOT_IMPORT_RECOVERY_REQUIRED",
    409,
  );
}

function reservationOperationKeyAliases(marker) {
  if (!Object.hasOwn(marker, "operationKeyAliases")) return [];
  if (
    !Array.isArray(marker.operationKeyAliases) ||
    marker.operationKeyAliases.length > PILOT_OPERATION_ALIAS_LIMIT
  ) {
    throw reservationRecoveryRequired();
  }
  const aliases = marker.operationKeyAliases;
  if (
    new Set(aliases).size !== aliases.length ||
    aliases.some(
      (value) =>
        typeof value !== "string" ||
        !SHA256_PATTERN.test(value) ||
        value === marker.operationKeyHash,
    )
  ) {
    throw reservationRecoveryRequired();
  }
  return [...aliases];
}

function pilotReservationDecision(metadata, input) {
  const stored = record(metadata);
  if (!Object.hasOwn(stored, "pilotImportReservation")) {
    return { marker: null, remoteAttempted: false };
  }
  const marker = record(stored.pilotImportReservation);
  const operationKeyHash =
    typeof marker.operationKeyHash === "string"
      ? marker.operationKeyHash
      : null;
  const requestFingerprint =
    typeof marker.requestFingerprint === "string"
      ? marker.requestFingerprint
      : null;
  if (!operationKeyHash || !requestFingerprint) {
    throw reservationRecoveryRequired();
  }
  if (
    operationKeyHash === input.idempotencyKeyHash &&
    requestFingerprint !== input.requestFingerprint
  ) {
    throw pilotError(
      "La clave de idempotencia ya fue usada con otros datos.",
      "IDEMPOTENCY_PAYLOAD_MISMATCH",
      409,
    );
  }

  const hasRemoteAttemptedAt = Object.hasOwn(marker, "remoteAttemptedAt");
  if (hasRemoteAttemptedAt && typeof marker.remoteAttemptedAt !== "string") {
    throw reservationRecoveryRequired();
  }
  const attemptedAt = hasRemoteAttemptedAt
    ? new Date(marker.remoteAttemptedAt)
    : null;
  const remoteAttempted = attemptedAt !== null;
  if (remoteAttempted && !Number.isFinite(attemptedAt.getTime())) {
    throw reservationRecoveryRequired();
  }
  if (!remoteAttempted) {
    return { marker, remoteAttempted: false, recoveryRekeyed: false };
  }
  if (requestFingerprint !== input.requestFingerprint) {
    throw reservationRecoveryRequired();
  }

  const attemptCount = Number(marker.attemptCount);
  if (typeof marker.registrationRequired !== "boolean") {
    throw reservationRecoveryRequired();
  }
  const registrationRequired = marker.registrationRequired === true;
  const operationKeyAliases = reservationOperationKeyAliases(marker);
  const registrationPinEscrow =
    typeof marker.registrationPinEscrow === "string" &&
    marker.registrationPinEscrow.length > 0 &&
    marker.registrationPinEscrow.length <= 131_072
      ? marker.registrationPinEscrow
      : null;
  if (
    !Number.isSafeInteger(attemptCount) ||
    attemptCount < 1 ||
    attemptCount > 1_000 ||
    (registrationRequired && !registrationPinEscrow)
  ) {
    throw reservationRecoveryRequired();
  }
  return {
    marker,
    remoteAttempted: true,
    attemptCount,
    registrationRequired,
    registrationPinEscrow,
    operationKeyAliases,
    recoveryRekeyed: operationKeyHash !== input.idempotencyKeyHash,
  };
}

function nextRemoteAttemptMetadata(
  metadata,
  input,
  now,
  decision,
  { registrationRequired, encryptedPinCandidate },
) {
  const priorMarker = decision.marker || {};
  const priorRemoteAttempt = decision.remoteAttempted === true;
  const registrationWasRequired = priorRemoteAttempt
    ? decision.registrationRequired === true
    : registrationRequired === true;
  const registrationPinEscrow = registrationWasRequired
    ? decision.registrationPinEscrow || encryptedPinCandidate
    : null;
  if (registrationWasRequired && !registrationPinEscrow) {
    throw pilotError(
      "No se pudo proteger el PIN para una recuperaci\u00f3n segura.",
      "PILOT_IMPORT_CRYPTO_UNAVAILABLE",
      503,
    );
  }
  const operationKeyAliases = priorRemoteAttempt
    ? [
        ...new Set([
          ...decision.operationKeyAliases,
          priorMarker.operationKeyHash,
        ]),
      ].filter(
        (operationKeyHash) => operationKeyHash !== input.idempotencyKeyHash,
      )
    : [];
  if (operationKeyAliases.length > PILOT_OPERATION_ALIAS_LIMIT) {
    throw pilotError(
      "La cadena segura de recuperación alcanzó su límite. Reintentá con una clave anterior.",
      "PILOT_IMPORT_RECOVERY_CHAIN_LIMIT",
      409,
    );
  }
  const attemptedAt = now.toISOString();
  return {
    ...record(metadata),
    pilotImportReservation: {
      version: 2,
      operationKeyHash: input.idempotencyKeyHash,
      requestFingerprint: input.requestFingerprint,
      reservedAt:
        typeof priorMarker.reservedAt === "string"
          ? priorMarker.reservedAt
          : attemptedAt,
      remoteAttemptedAt: priorRemoteAttempt
        ? priorMarker.remoteAttemptedAt
        : attemptedAt,
      lastRemoteAttemptAt: attemptedAt,
      attemptCount: (priorRemoteAttempt ? decision.attemptCount : 0) + 1,
      registrationRequired: registrationWasRequired,
      ...(operationKeyAliases.length > 0 ? { operationKeyAliases } : {}),
      ...(registrationPinEscrow ? { registrationPinEscrow } : {}),
    },
  };
}

async function resolvePilotTarget(prisma, access, input, now) {
  if (access?.isSuperadmin !== true || !access.databaseUserId) {
    throw pilotError(
      "Se requiere autorizaci\u00f3n de superadministrador.",
      "SUPERADMIN_REQUIRED",
      403,
    );
  }
  const project = await prisma.project.findFirst({
    where: { id: input.projectId, status: "ACTIVE" },
    select: {
      id: true,
      organizationId: true,
      status: true,
      organization: {
        select: {
          id: true,
          clerkOrganizationId: true,
          metadata: true,
          subscriptionPlan: true,
          subscriptionStatus: true,
          trialEndsAt: true,
        },
      },
    },
  });
  if (!project || !isExternalTenant(project.organization)) {
    throw pilotError(
      "La obra piloto no est\u00e1 disponible.",
      "PILOT_PROJECT_NOT_FOUND",
      404,
    );
  }
  if (!subscriptionAllowsWrites(project.organization, now)) {
    throw pilotError(
      "El tenant piloto no admite cambios.",
      "PILOT_TENANT_WRITE_BLOCKED",
      403,
    );
  }
  const membership = await prisma.tenantMembership.findFirst({
    where: {
      organizationId: project.organizationId,
      userId: access.databaseUserId,
      status: "ACTIVE",
    },
    select: { id: true, tenantRole: true, userId: true, status: true },
  });
  if (
    !membership ||
    !roleHasPermission(membership.tenantRole, "org:integrations:manage")
  ) {
    throw pilotError(
      "Se requiere una membres\u00eda activa con permiso de integraciones en el tenant.",
      "PILOT_TENANT_MEMBERSHIP_REQUIRED",
      403,
    );
  }
  return { membership, project };
}

function connectionSelect() {
  return {
    id: true,
    projectId: true,
    phoneNumberId: true,
    whatsappBusinessId: true,
    displayPhoneNumber: true,
    verifiedBusinessName: true,
    enabled: true,
    connectionStatus: true,
    encryptedAccessToken: true,
    encryptedPin: true,
    metadata: true,
    updatedAt: true,
  };
}

function connectionMatchesPilotIdentity(connection, input) {
  return (
    connection?.projectId === input.projectId &&
    connection?.phoneNumberId === input.phoneNumberId &&
    connection?.whatsappBusinessId === input.whatsappBusinessId
  );
}

function connectionConflict() {
  return pilotError(
    "La obra o el n\u00famero ya tienen otra conexi\u00f3n.",
    "PILOT_IMPORT_CONNECTION_CONFLICT",
    409,
  );
}

function reservationAuditData({
  access,
  target,
  input,
  connectionId,
  ipAddress,
}) {
  return {
    organizationId: target.project.organizationId,
    actorId: access.databaseUserId,
    action: "integration.whatsapp.pilot_reserved",
    entityType: "WhatsAppConnection",
    entityId: connectionId,
    ipAddress,
    metadata: {
      projectId: input.projectId,
      tenantMembershipId: target.membership.id,
      phoneNumberId: input.phoneNumberId,
      whatsappBusinessId: input.whatsappBusinessId,
      credentialOrigin: "meta_test_number",
      temporaryCredential: true,
      reservationVersion: 1,
    },
  };
}

async function readPilotConnectionCandidates(prisma, input) {
  const [byProject, byPhone] = await Promise.all([
    prisma.whatsAppConnection.findUnique({
      where: { projectId: input.projectId },
      select: connectionSelect(),
    }),
    prisma.whatsAppConnection.findUnique({
      where: { phoneNumberId: input.phoneNumberId },
      select: connectionSelect(),
    }),
  ]);
  return { byPhone, byProject };
}

function reconcilePilotConnectionCandidates({ byProject, byPhone }, input) {
  if (byProject && !connectionMatchesPilotIdentity(byProject, input)) {
    throw connectionConflict();
  }
  if (byPhone && !connectionMatchesPilotIdentity(byPhone, input)) {
    throw connectionConflict();
  }
  if (byProject && byPhone && byProject.id !== byPhone.id) {
    throw connectionConflict();
  }
  return byProject || byPhone || null;
}

async function createPilotReservation(
  prisma,
  { access, target, input, ipAddress, now },
) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.whatsAppConnection.create({
      data: {
        projectId: input.projectId,
        phoneNumberId: input.phoneNumberId,
        whatsappBusinessId: input.whatsappBusinessId,
        enabled: false,
        connectionStatus: "PENDING",
        encryptedAccessToken: null,
        encryptedPin: null,
        tokenLastFour: null,
        embeddedSignupVersion: "pilot-preview-reservation-v1",
        connectedAt: null,
        lastVerifiedAt: null,
        lastError: null,
        metadata: reservationMetadata(input, now),
      },
    });
    await tx.auditLog.create({
      data: reservationAuditData({
        access,
        target,
        input,
        connectionId: created.id,
        ipAddress,
      }),
    });
    return created;
  });
}

function remoteAttemptAuditData({
  access,
  target,
  input,
  connectionId,
  ipAddress,
  registrationRequired,
  resumed,
  recoveryRekeyed,
  attemptCount,
}) {
  return {
    organizationId: target.project.organizationId,
    actorId: access.databaseUserId,
    action: "integration.whatsapp.pilot_remote_attempted",
    entityType: "WhatsAppConnection",
    entityId: connectionId,
    ipAddress,
    metadata: {
      projectId: input.projectId,
      tenantMembershipId: target.membership.id,
      phoneNumberId: input.phoneNumberId,
      whatsappBusinessId: input.whatsappBusinessId,
      credentialOrigin: "meta_test_number",
      temporaryCredential: true,
      registrationRequired,
      resumed,
      recoveryRekeyed,
      attemptCount,
    },
  };
}

async function markPilotRemoteAttempt(
  prisma,
  {
    access,
    target,
    input,
    connectionId,
    leaseId,
    ipAddress,
    now,
    expectedUpdatedAt,
    metadata,
    decision,
    registrationRequired,
    encryptedPinCandidate,
  },
) {
  const observedVersion =
    expectedUpdatedAt instanceof Date
      ? new Date(expectedUpdatedAt.getTime())
      : new Date(expectedUpdatedAt);
  if (!Number.isFinite(observedVersion.getTime())) {
    throw pilotError(
      "La versi\u00f3n de la reserva piloto es inv\u00e1lida.",
      "PILOT_IMPORT_CONNECTION_CONFLICT",
      409,
    );
  }
  const nextVersion = new Date(
    Math.max(now.getTime(), observedVersion.getTime() + 1),
  );
  const nextMetadata = nextRemoteAttemptMetadata(
    metadata,
    input,
    now,
    decision,
    { registrationRequired, encryptedPinCandidate },
  );
  const nextMarker = nextMetadata.pilotImportReservation;
  await prisma.$transaction(
    async (tx) => {
      const updated = await tx.whatsAppConnection.updateMany({
        where: {
          id: connectionId,
          updatedAt: observedVersion,
          flowProvisioningLeaseId: leaseId,
        },
        data: {
          metadata: nextMetadata,
          updatedAt: nextVersion,
        },
      });
      if (updated.count !== 1) throw connectionConflict();
      await tx.auditLog.create({
        data: remoteAttemptAuditData({
          access,
          target,
          input,
          connectionId,
          ipAddress,
          registrationRequired: nextMarker.registrationRequired === true,
          resumed: decision.remoteAttempted === true,
          recoveryRekeyed: decision.recoveryRekeyed === true,
          attemptCount: nextMarker.attemptCount,
        }),
      });
    },
    { maxWait: 3_000, timeout: 5_000 },
  );
  return nextMetadata;
}

function auditData({
  access,
  target,
  input,
  verified,
  connectionId,
  ipAddress,
  identityChanged,
  registrationRecovered,
  recoveryRekeyed,
}) {
  return {
    organizationId: target.project.organizationId,
    actorId: access.databaseUserId,
    action: "integration.whatsapp.pilot_imported",
    entityType: "WhatsAppConnection",
    entityId: connectionId,
    ipAddress,
    metadata: {
      projectId: input.projectId,
      tenantMembershipId: target.membership.id,
      phoneNumberId: input.phoneNumberId,
      whatsappBusinessId: input.whatsappBusinessId,
      credentialOrigin: "meta_test_number",
      temporaryCredential: true,
      expiresAt: verified.expiresAt,
      registrationPerformed: verified.registrationPerformed === true,
      registrationRecovered: registrationRecovered === true,
      recoveryRekeyed: recoveryRekeyed === true,
      identityChanged,
    },
  };
}

export async function importPilotWhatsAppConnection(
  prisma,
  { access, input, ipAddress = null, now = new Date() },
  {
    prepareCredential = preparePilotWhatsAppCredential,
    encrypt = encryptCredential,
    lastFour = credentialLastFour,
    acquireLease = acquireWhatsAppConnectionLease,
    commitLease = commitWhatsAppConnectionLease,
    releaseLease = releaseWhatsAppConnectionLease,
    markRemoteAttempt = markPilotRemoteAttempt,
  } = {},
) {
  const observedAt =
    now instanceof Date ? new Date(now.getTime()) : new Date(now);
  if (!Number.isFinite(observedAt.getTime())) {
    throw pilotError(
      "El reloj de la operaci\u00f3n es inv\u00e1lido.",
      "PILOT_IMPORT_CLOCK_INVALID",
      500,
    );
  }
  const target = await resolvePilotTarget(prisma, access, input, observedAt);
  let connection = reconcilePilotConnectionCandidates(
    await readPilotConnectionCandidates(prisma, input),
    input,
  );
  const initialReplay = replayForConnection(connection, input);
  if (initialReplay) return initialReplay;

  if (!connection) {
    try {
      connection = await createPilotReservation(prisma, {
        access,
        target,
        input,
        ipAddress,
        now: observedAt,
      });
    } catch (error) {
      if (error?.code !== "P2002") throw error;
      connection = reconcilePilotConnectionCandidates(
        await readPilotConnectionCandidates(prisma, input),
        input,
      );
      if (!connection) throw connectionConflict();
    }
  }

  if (!connectionMatchesPilotIdentity(connection, input))
    throw connectionConflict();
  const racedReplay = replayForConnection(connection, input);
  if (racedReplay) return racedReplay;

  let lease = null;
  let leaseCommitted = false;
  try {
    const acquired = await acquireLease(prisma, {
      connectionId: connection.id,
      operationKey: "pilot_import",
      expectedUpdatedAt: connection.updatedAt,
      requireActive: false,
      now: observedAt,
    });
    lease = { connectionId: connection.id, leaseId: acquired.lease.id };

    // Prove local credential persistence is available before the first remote
    // subscription or registration effect is attempted.
    const encryptedAccessToken = encrypt(input.accessToken);
    const tokenLastFour = lastFour(input.accessToken);
    const encryptedPinCandidate = input.registrationPin
      ? encrypt(input.registrationPin)
      : null;
    const reservationDecision = pilotReservationDecision(
      acquired.metadata,
      input,
    );
    let remoteAttemptMetadata = null;
    let registrationRecovered = false;
    const recoveryRekeyed =
      reservationDecision.recoveryRekeyed === true ||
      reservationDecision.operationKeyAliases?.length > 0;
    const verified = await prepareCredential({
      accessToken: input.accessToken,
      whatsappBusinessId: input.whatsappBusinessId,
      phoneNumberId: input.phoneNumberId,
      registrationPin: input.registrationPin,
      now: observedAt,
      beforeRemoteMutation: async ({ registrationRequired }) => {
        if (remoteAttemptMetadata) {
          throw pilotError(
            "Meta intent\u00f3 abrir dos mutaciones para la misma operaci\u00f3n.",
            "PILOT_IMPORT_MUTATION_FENCE_INVALID",
            500,
          );
        }
        remoteAttemptMetadata = await markRemoteAttempt(prisma, {
          access,
          target,
          input,
          connectionId: connection.id,
          leaseId: lease.leaseId,
          ipAddress,
          now: observedAt,
          expectedUpdatedAt: acquired.updatedAt,
          metadata: acquired.metadata,
          decision: reservationDecision,
          registrationRequired,
          encryptedPinCandidate,
        });
        registrationRecovered =
          reservationDecision.remoteAttempted === true &&
          reservationDecision.registrationRequired === true &&
          registrationRequired !== true;
      },
    });
    if (!remoteAttemptMetadata) {
      throw pilotError(
        "La mutaci\u00f3n de Meta no qued\u00f3 protegida por una reserva durable.",
        "PILOT_IMPORT_MUTATION_FENCE_MISSING",
        500,
      );
    }
    const protectedRegistrationPin =
      record(remoteAttemptMetadata.pilotImportReservation)
        .registrationPinEscrow || encryptedPinCandidate;
    const committed = await commitLease(prisma, {
      ...lease,
      requireActive: false,
      now: observedAt,
      buildConnectionData(observed) {
        if (
          observed.phoneNumberId !== input.phoneNumberId ||
          observed.whatsappBusinessId !== input.whatsappBusinessId
        ) {
          throw connectionConflict();
        }
        return {
          phoneNumberId: input.phoneNumberId,
          whatsappBusinessId: input.whatsappBusinessId,
          displayPhoneNumber: verified.displayPhoneNumber,
          verifiedBusinessName: verified.verifiedBusinessName,
          enabled: true,
          connectionStatus: "CONNECTED",
          encryptedAccessToken,
          encryptedPin:
            verified.registrationPerformed === true
              ? protectedRegistrationPin
              : registrationRecovered
                ? protectedRegistrationPin
                : observed.encryptedPin || null,
          tokenLastFour,
          embeddedSignupVersion: "pilot-preview-v1",
          connectedAt: observedAt,
          lastVerifiedAt: observedAt,
          lastError: null,
          metadata: nextPilotMetadata(
            observed.metadata,
            input,
            verified,
            observedAt,
            {
              identityChanged: false,
              registrationRecovered,
              recoveryOperationKeyHashes: pilotOperationKeyAliases(
                record(remoteAttemptMetadata.pilotImportReservation),
              ),
            },
          ),
        };
      },
      createAuditLog: (tx) =>
        tx.auditLog.create({
          data: auditData({
            access,
            target,
            input,
            verified,
            connectionId: connection.id,
            ipAddress,
            identityChanged: false,
            registrationRecovered,
            recoveryRekeyed,
          }),
        }),
    });
    leaseCommitted = true;
    const saved = {
      ...connection,
      projectId: input.projectId,
      ...committed.data,
    };

    const state = pilotImportState(saved.metadata);
    const operation = state.operations.find(
      (entry) => entry.operationKeyHash === input.idempotencyKeyHash,
    );
    if (!operation) {
      throw pilotError(
        "No se pudo confirmar la importaci\u00f3n.",
        "PILOT_IMPORT_COMMIT_INVALID",
        500,
      );
    }
    return {
      connection: publicConnection(saved, operation, { replayed: false }),
    };
  } catch (error) {
    if (error?.code === "P2002") {
      throw connectionConflict();
    }
    throw error;
  } finally {
    if (lease && !leaseCommitted) {
      try {
        await releaseLease(prisma, lease);
      } catch {
        // The original operation error remains authoritative. A stale lease is
        // bounded by its short TTL and must never expose credential material.
      }
    }
  }
}
