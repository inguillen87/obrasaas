import { createHash } from 'node:crypto';

import {
  privateReceiptStorageReference,
  protectedStorageBelongsToPrefix,
  protectedStorageLookup,
} from './private-receipts.js';
import {
  MAX_PROTECTED_UPLOAD_BYTES,
  PROTECTED_UPLOAD_QUOTAS,
} from './protected-upload-policy.js';
import {
  deleteProtectedFile,
  protectedUploadExpectedStorage,
  resolveProtectedStorageProvider,
  uploadProtectedFile,
} from './storage.js';

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const DEFAULT_TTL_MS = 30 * 60 * 1000;
const UPLOAD_LEASE_MS = 2 * 60 * 1000;
export const PROTECTED_UPLOAD_PROVIDER_TIMEOUT_MS = 40 * 1000;
const DELETE_LEASE_MS = 60 * 1000;
export const PROTECTED_UPLOAD_DELETE_TIMEOUT_MS = 10 * 1000;
const MAX_DELETE_BACKOFF_MS = 60 * 60 * 1000;

export const PROTECTED_UPLOAD_PURPOSE = Object.freeze({
  CASH: 'CASH_RECEIPT',
  GOODS: 'GOODS_RECEIPT',
  SUPPLIER: 'SUPPLIER_INVOICE',
  PROGRESS: 'PROGRESS_EVIDENCE',
});

const PURPOSE_CONFIG = Object.freeze({
  [PROTECTED_UPLOAD_PURPOSE.CASH]: {
    folder: 'cash-receipts',
    entityType: 'CashMovement',
    allowVideo: false,
  },
  [PROTECTED_UPLOAD_PURPOSE.GOODS]: {
    folder: 'goods-receipts',
    entityType: 'GoodsReceipt',
    allowVideo: false,
  },
  [PROTECTED_UPLOAD_PURPOSE.SUPPLIER]: {
    folder: 'supplier-invoices',
    entityType: 'SupplierInvoice',
    allowVideo: false,
  },
  [PROTECTED_UPLOAD_PURPOSE.PROGRESS]: {
    folder: 'progress',
    entityType: 'ProgressEvidence',
    allowVideo: true,
  },
});

export class ProtectedUploadError extends Error {
  constructor(message, code = 'PROTECTED_UPLOAD_INVALID', status = 400, {
    retryAfterSeconds = null,
  } = {}) {
    super(message);
    this.name = 'ProtectedUploadError';
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = Number.isSafeInteger(retryAfterSeconds)
      ? Math.max(1, retryAfterSeconds)
      : null;
  }
}

function requiredText(value, field, max = 190) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new ProtectedUploadError(`${field} inválido.`);
  }
  return value.trim();
}

function trustedScope(value) {
  return {
    organizationId: requiredText(value?.organizationId, 'organizationId'),
    projectId: requiredText(value?.projectId, 'projectId'),
  };
}

function purposeConfig(purpose) {
  const config = PURPOSE_CONFIG[purpose];
  if (!config) throw new ProtectedUploadError('Propósito de carga inválido.');
  return config;
}

export function normalizeProtectedUploadIdempotencyKey(value) {
  const key = typeof value === 'string' ? value.trim() : '';
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw new ProtectedUploadError(
      'Enviá un encabezado Idempotency-Key válido de entre 8 y 128 caracteres.',
      'IDEMPOTENCY_KEY_INVALID',
      400,
    );
  }
  return key;
}

export function protectedUploadHash(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function operationHash({ scope, actorId, purpose, action, key }) {
  return protectedUploadHash(JSON.stringify({
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    actorId,
    purpose,
    action,
    key,
  }));
}

function canonicalValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]),
    );
  }
  if (value === undefined) return null;
  return value;
}

export function protectedUploadClaimFingerprint(payload) {
  return protectedUploadHash(JSON.stringify(canonicalValue(payload)));
}

function uploadRequestFingerprint({ scope, actorId, purpose, file, sha256 }) {
  return protectedUploadHash(JSON.stringify({
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    actorId,
    purpose,
    filename: file.name.normalize('NFC'),
    mimeType: file.type,
    size: file.size,
    sha256,
  }));
}

function deletionFingerprint({ scope, actorId, purpose, uploadId }) {
  return protectedUploadHash(JSON.stringify({
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    actorId,
    purpose,
    uploadId,
  }));
}

function storagePrefix(projectId, config) {
  return `obrasaas/projects/${projectId}/${config.folder}/`;
}

function ownedStorageReference(upload, fallbackBytes) {
  const storage = privateReceiptStorageReference(upload, fallbackBytes);
  return { ...storage, reused: false };
}

function assertStoredScope(storage, projectId, config) {
  if (!protectedStorageBelongsToPrefix(storage, storagePrefix(projectId, config), {
    allowVideo: config.allowVideo,
  })) {
    throw new ProtectedUploadError(
      'El proveedor devolvió una identidad fuera de la obra.',
      'PROTECTED_UPLOAD_STORAGE_SCOPE',
      502,
    );
  }
}

function assertStoredSize(storage, expectedBytes) {
  if (!Number.isSafeInteger(storage?.bytes) || storage.bytes !== expectedBytes) {
    throw new ProtectedUploadError(
      'El proveedor devolvió un tamaño distinto al archivo verificado.',
      'PROTECTED_UPLOAD_STORAGE_SIZE_MISMATCH',
      502,
    );
  }
}

function sameStorageIdentity(left, right) {
  const leftIdentity = protectedStorageLookup(left);
  const rightIdentity = protectedStorageLookup(right);
  return Boolean(
    leftIdentity
    && rightIdentity
    && left?.provider === right?.provider
    && leftIdentity.path.join('.') === rightIdentity.path.join('.')
    && leftIdentity.value === rightIdentity.value,
  );
}

function assertPinnedStorage(actual, expected) {
  if (!sameStorageIdentity(actual, expected)) {
    throw new ProtectedUploadError(
      'El proveedor no respetó la identidad determinista reservada.',
      'PROTECTED_UPLOAD_PROVIDER_DRIFT',
      502,
    );
  }
}

function publicUpload(row) {
  return { uploadId: row.id };
}

function assertReservationOwner(row, { scope, actorId, purpose }) {
  if (
    row.organizationId !== scope.organizationId
    || row.projectId !== scope.projectId
    || row.actorId !== actorId
    || row.purpose !== purpose
  ) {
    throw new ProtectedUploadError(
      'La carga no existe en esta obra.',
      'PROTECTED_UPLOAD_NOT_FOUND',
      404,
    );
  }
}

function assertMatchingUploadReplay(row, requestFingerprint, now) {
  if (row.requestFingerprint !== requestFingerprint) {
    throw new ProtectedUploadError(
      'La Idempotency-Key ya fue usada con otro archivo o metadatos.',
      'IDEMPOTENCY_KEY_REUSED',
      409,
    );
  }
  if (row.status === 'DELETE_PENDING' || row.status === 'DELETED') {
    throw new ProtectedUploadError(
      'La reserva de carga ya fue descartada.',
      'PROTECTED_UPLOAD_DELETED',
      409,
    );
  }
  if (row.status !== 'CLAIMED' && row.expiresAt <= now) {
    throw new ProtectedUploadError(
      'La reserva de carga venció; repetí la carga con una nueva Idempotency-Key.',
      'PROTECTED_UPLOAD_EXPIRED',
      410,
    );
  }
}

function isUniqueConflict(error) {
  return error?.code === 'P2002';
}

function uploadResourceType(file) {
  if (file.type === 'application/pdf') return 'raw';
  if (file.type.startsWith('video/')) return 'video';
  return 'image';
}

function uploadProviderKey({ scope, actorId, purpose, operationKeyHash, requestFingerprint }) {
  return [
    'protected-upload',
    scope.organizationId,
    scope.projectId,
    actorId,
    purpose,
    operationKeyHash,
    requestFingerprint,
  ].join(':');
}

function activeUploadLeaseError(row, now) {
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((new Date(row.uploadLeaseExpiresAt).getTime() - now.getTime()) / 1_000),
  );
  return new ProtectedUploadError(
    'La carga ya está en curso. Reintentá con la misma Idempotency-Key.',
    'PROTECTED_UPLOAD_IN_PROGRESS',
    409,
    { retryAfterSeconds },
  );
}

function assertQuota({ actorActive, projectActive, organizationDayBytes, requestedBytes }) {
  if (actorActive >= PROTECTED_UPLOAD_QUOTAS.actorProjectActive) {
    throw new ProtectedUploadError(
      'Tenés demasiadas cargas privadas pendientes en esta obra.',
      'PROTECTED_UPLOAD_ACTOR_QUOTA',
      429,
      { retryAfterSeconds: 300 },
    );
  }
  if (projectActive >= PROTECTED_UPLOAD_QUOTAS.projectActive) {
    throw new ProtectedUploadError(
      'La obra alcanzó el límite de cargas privadas pendientes.',
      'PROTECTED_UPLOAD_PROJECT_QUOTA',
      429,
      { retryAfterSeconds: 300 },
    );
  }
  if (
    organizationDayBytes + requestedBytes
    > PROTECTED_UPLOAD_QUOTAS.organizationRollingDayBytes
  ) {
    throw new ProtectedUploadError(
      'La organización alcanzó el límite diario de cargas privadas.',
      'PROTECTED_UPLOAD_ORGANIZATION_QUOTA',
      429,
      { retryAfterSeconds: 3_600 },
    );
  }
}

async function reserveUploadIntent(prisma, {
  scope,
  actorId,
  purpose,
  operationKeyHash,
  requestFingerprint,
  createIntentPlan,
  file,
  sha256,
  now,
  ttlMs,
}) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe("SET LOCAL lock_timeout = '3000ms'");
    await transaction.$executeRawUnsafe(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      `obrasaas:protected-upload:${scope.organizationId}`,
    );

    const existing = await transaction.protectedUpload.findFirst({
      where: { projectId: scope.projectId, actorId, purpose, operationKeyHash },
    });
    if (existing) {
      assertReservationOwner(existing, { scope, actorId, purpose });
      assertMatchingUploadReplay(existing, requestFingerprint, now);
      if (existing.status === 'AVAILABLE' || existing.status === 'CLAIMED') {
        return { row: existing, dispatch: false };
      }
      if (existing.status !== 'UPLOADING') {
        throw new ProtectedUploadError(
          'La reserva de carga no puede continuar.',
          'PROTECTED_UPLOAD_STATE_INVALID',
          409,
        );
      }
      if (existing.uploadLeaseExpiresAt > now) throw activeUploadLeaseError(existing, now);
      const leaseExpiresAt = new Date(now.getTime() + UPLOAD_LEASE_MS);
      const acquired = await transaction.protectedUpload.updateMany({
        where: {
          id: existing.id,
          projectId: scope.projectId,
          actorId,
          purpose,
          status: 'UPLOADING',
          requestFingerprint,
          uploadAttemptCount: existing.uploadAttemptCount,
          uploadLeaseExpiresAt: existing.uploadLeaseExpiresAt,
          expiresAt: { gt: now },
        },
        data: {
          uploadAttemptCount: { increment: 1 },
          uploadLeaseExpiresAt: leaseExpiresAt,
          lastErrorCode: null,
        },
      });
      if (acquired.count !== 1) {
        throw new ProtectedUploadError(
          'Otra instancia retomó la carga. Reintentá con la misma Idempotency-Key.',
          'PROTECTED_UPLOAD_IN_PROGRESS',
          409,
          { retryAfterSeconds: 2 },
        );
      }
      return {
        row: {
          ...existing,
          uploadAttemptCount: existing.uploadAttemptCount + 1,
          uploadLeaseExpiresAt: leaseExpiresAt,
          lastErrorCode: null,
        },
        dispatch: true,
      };
    }

    const activeStatuses = ['UPLOADING', 'AVAILABLE', 'DELETE_PENDING'];
    const rollingDayStart = new Date(now.getTime() - (24 * 60 * 60 * 1_000));
    const [actorActive, projectActive, organizationUsage] = await Promise.all([
      transaction.protectedUpload.count({
        where: {
          actorId,
          projectId: scope.projectId,
          status: { in: activeStatuses },
        },
      }),
      transaction.protectedUpload.count({
        where: { projectId: scope.projectId, status: { in: activeStatuses } },
      }),
      transaction.protectedUpload.aggregate({
        where: {
          organizationId: scope.organizationId,
          createdAt: { gte: rollingDayStart },
        },
        _sum: { size: true },
      }),
    ]);
    assertQuota({
      actorActive,
      projectActive,
      organizationDayBytes: Number(organizationUsage?._sum?.size || 0),
      requestedBytes: file.size,
    });

    const { storageProvider, expectedStorage } = createIntentPlan();

    const leaseExpiresAt = new Date(now.getTime() + UPLOAD_LEASE_MS);
    const row = await transaction.protectedUpload.create({
      data: {
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        actorId,
        purpose,
        status: 'UPLOADING',
        operationKeyHash,
        requestFingerprint,
        storageProvider,
        storage: expectedStorage,
        mimeType: file.type,
        filename: file.name.normalize('NFC').slice(0, 255),
        size: file.size,
        sha256,
        expiresAt: new Date(
          now.getTime() + Math.max(60_000, Number(ttlMs) || DEFAULT_TTL_MS),
        ),
        uploadAttemptCount: 1,
        uploadLeaseExpiresAt: leaseExpiresAt,
      },
    });
    return { row, dispatch: true };
  });
}

function internalDeletionHashes(row, reason) {
  return {
    deleteOperationKeyHash: protectedUploadHash(`system:${reason}:${row.id}`),
    deleteRequestFingerprint: protectedUploadHash(
      `system:${reason}:${row.id}:${row.requestFingerprint}`,
    ),
  };
}

async function scheduleUploadCleanup(prisma, {
  row,
  scope,
  actorId,
  purpose,
  attemptCount,
  leaseExpiresAt,
  storage,
  now,
  reason,
}) {
  const hashes = internalDeletionHashes(row, reason);
  const transitioned = await prisma.protectedUpload.updateMany({
    where: {
      id: row.id,
      projectId: scope.projectId,
      actorId,
      purpose,
      status: 'UPLOADING',
      requestFingerprint: row.requestFingerprint,
      uploadAttemptCount: attemptCount,
      uploadLeaseExpiresAt: leaseExpiresAt,
    },
    data: {
      status: 'DELETE_PENDING',
      storage,
      uploadLeaseExpiresAt: null,
      deleteOperationKeyHash: hashes.deleteOperationKeyHash,
      deleteRequestFingerprint: hashes.deleteRequestFingerprint,
      deleteRequestedAt: now,
      nextDeleteAttemptAt: now,
      lastErrorCode: reason,
    },
  });
  return transitioned.count === 1;
}

async function recordUploadFailure(prisma, row, now) {
  await prisma.protectedUpload.updateMany({
    where: {
      id: row.id,
      status: 'UPLOADING',
      uploadAttemptCount: row.uploadAttemptCount,
      uploadLeaseExpiresAt: row.uploadLeaseExpiresAt,
    },
    data: {
      uploadLeaseExpiresAt: now,
      lastErrorCode: 'PROVIDER_UPLOAD_FAILED',
    },
  });
}

async function reconcileLostUploadLease(prisma, {
  row,
  scope,
  actorId,
  purpose,
  requestFingerprint,
  now,
}) {
  const current = await prisma.protectedUpload.findFirst({
    where: { id: row.id, projectId: scope.projectId },
  });
  if (!current) {
    throw new ProtectedUploadError(
      'La carga no existe en esta obra.',
      'PROTECTED_UPLOAD_NOT_FOUND',
      404,
    );
  }
  assertReservationOwner(current, { scope, actorId, purpose });
  assertMatchingUploadReplay(current, requestFingerprint, now);
  if (current.status === 'AVAILABLE' || current.status === 'CLAIMED') return publicUpload(current);
  throw new ProtectedUploadError(
    'La instancia perdió la concesión de carga. Reintentá con la misma Idempotency-Key.',
    'PROTECTED_UPLOAD_LEASE_LOST',
    409,
    { retryAfterSeconds: 2 },
  );
}

export async function stageProtectedUpload(prisma, {
  scope: rawScope,
  actorId: rawActorId,
  purpose,
  idempotencyKey: rawIdempotencyKey,
  file,
  sha256: rawSha256,
  now = new Date(),
  ttlMs = DEFAULT_TTL_MS,
  clock = () => new Date(),
  uploadFile = uploadProtectedFile,
  deleteFile = deleteProtectedFile,
  resolveProvider = resolveProtectedStorageProvider,
  expectedStorageForUpload = protectedUploadExpectedStorage,
}) {
  const scope = trustedScope(rawScope);
  const actorId = requiredText(rawActorId, 'actorId');
  const config = purposeConfig(purpose);
  const idempotencyKey = normalizeProtectedUploadIdempotencyKey(rawIdempotencyKey);
  const sha256 = String(rawSha256 || '').toLowerCase();
  if (
    !(file instanceof File)
    || file.size < 1
    || file.size > MAX_PROTECTED_UPLOAD_BYTES
    || !file.name
    || !file.type
    || !SHA256_PATTERN.test(sha256)
  ) {
    throw new ProtectedUploadError('Archivo o huella de carga inválidos.');
  }
  const operationKeyHash = operationHash({
    scope,
    actorId,
    purpose,
    action: 'stage',
    key: idempotencyKey,
  });
  const requestFingerprint = uploadRequestFingerprint({ scope, actorId, purpose, file, sha256 });
  const providerIdempotencyKey = uploadProviderKey({
    scope,
    actorId,
    purpose,
    operationKeyHash,
    requestFingerprint,
  });
  const baseUploadOptions = {
    folder: `obrasaas/projects/${scope.projectId}/${config.folder}`,
    context: `project=${scope.projectId}|purpose=${purpose}|sha256=${sha256}|private=true`,
    idempotencyKey: providerIdempotencyKey,
    resourceType: uploadResourceType(file),
  };
  const createIntentPlan = () => {
    const storageProvider = resolveProvider();
    const expectedStorage = ownedStorageReference(
      expectedStorageForUpload(file, { ...baseUploadOptions, provider: storageProvider }),
      file.size,
    );
    assertStoredScope(expectedStorage, scope.projectId, config);
    assertStoredSize(expectedStorage, file.size);
    return { storageProvider, expectedStorage };
  };

  let intent;
  try {
    intent = await reserveUploadIntent(prisma, {
      scope,
      actorId,
      purpose,
      operationKeyHash,
      requestFingerprint,
      createIntentPlan,
      file,
      sha256,
      now,
      ttlMs,
    });
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    const winner = await prisma.protectedUpload.findFirst({
      where: { projectId: scope.projectId, actorId, purpose, operationKeyHash },
    });
    if (!winner) throw error;
    assertReservationOwner(winner, { scope, actorId, purpose });
    assertMatchingUploadReplay(winner, requestFingerprint, now);
    if (winner.status === 'AVAILABLE' || winner.status === 'CLAIMED') return publicUpload(winner);
    throw activeUploadLeaseError(winner, now);
  }
  if (!intent.dispatch) return publicUpload(intent.row);

  const expectedStorage = ownedStorageReference(intent.row.storage, file.size);
  const uploadOptions = {
    ...baseUploadOptions,
    provider: intent.row.storageProvider,
    signal: AbortSignal.timeout(PROTECTED_UPLOAD_PROVIDER_TIMEOUT_MS),
  };
  assertStoredScope(expectedStorage, scope.projectId, config);
  assertStoredSize(expectedStorage, file.size);

  let uploaded;
  try {
    uploaded = await uploadFile(file, uploadOptions);
  } catch {
    await recordUploadFailure(prisma, intent.row, clock());
    throw new ProtectedUploadError(
      'El almacenamiento privado no confirmó la carga. Reintentá con la misma Idempotency-Key.',
      'PROTECTED_UPLOAD_PROVIDER_FAILED',
      502,
      { retryAfterSeconds: 2 },
    );
  }

  let actualStorage;
  try {
    actualStorage = ownedStorageReference(uploaded, file.size);
  } catch {
    const cleanupAt = clock();
    await scheduleUploadCleanup(prisma, {
      row: intent.row,
      scope,
      actorId,
      purpose,
      attemptCount: intent.row.uploadAttemptCount,
      leaseExpiresAt: intent.row.uploadLeaseExpiresAt,
      storage: expectedStorage,
      now: cleanupAt,
      reason: 'PROTECTED_UPLOAD_PROVIDER_DRIFT',
    });
    throw new ProtectedUploadError(
      'El proveedor devolvió una identidad de almacenamiento inválida.',
      'PROTECTED_UPLOAD_PROVIDER_DRIFT',
      502,
    );
  }

  try {
    // Scope is deliberately validated before size or any external deletion.
    assertStoredScope(actualStorage, scope.projectId, config);
    assertPinnedStorage(actualStorage, expectedStorage);
  } catch (error) {
    const cleanupAt = clock();
    const scheduled = await scheduleUploadCleanup(prisma, {
      row: intent.row,
      scope,
      actorId,
      purpose,
      attemptCount: intent.row.uploadAttemptCount,
      leaseExpiresAt: intent.row.uploadLeaseExpiresAt,
      storage: expectedStorage,
      now: cleanupAt,
      reason: error.code,
    });
    if (scheduled) {
      await attemptPendingDeletion(prisma, {
        row: { ...intent.row, status: 'DELETE_PENDING', storage: expectedStorage,
          uploadLeaseExpiresAt: null, nextDeleteAttemptAt: cleanupAt,
          deleteAttemptCount: intent.row.deleteAttemptCount || 0,
          ...internalDeletionHashes(intent.row, error.code) },
        now: cleanupAt,
        deleteFile,
      });
    }
    throw error;
  }

  try {
    assertStoredSize(actualStorage, file.size);
  } catch (error) {
    const cleanupAt = clock();
    const scheduled = await scheduleUploadCleanup(prisma, {
      row: intent.row,
      scope,
      actorId,
      purpose,
      attemptCount: intent.row.uploadAttemptCount,
      leaseExpiresAt: intent.row.uploadLeaseExpiresAt,
      storage: actualStorage,
      now: cleanupAt,
      reason: error.code,
    });
    if (scheduled) {
      await attemptPendingDeletion(prisma, {
        row: { ...intent.row, status: 'DELETE_PENDING', storage: actualStorage,
          uploadLeaseExpiresAt: null, nextDeleteAttemptAt: cleanupAt,
          deleteAttemptCount: intent.row.deleteAttemptCount || 0,
          ...internalDeletionHashes(intent.row, error.code) },
        now: cleanupAt,
        deleteFile,
      });
    }
    throw error;
  }

  const completedAt = clock();
  if (intent.row.uploadLeaseExpiresAt <= completedAt) {
    return reconcileLostUploadLease(prisma, {
      row: intent.row,
      scope,
      actorId,
      purpose,
      requestFingerprint,
      now: completedAt,
    });
  }
  const finalized = await prisma.protectedUpload.updateMany({
    where: {
      id: intent.row.id,
      projectId: scope.projectId,
      actorId,
      purpose,
      status: 'UPLOADING',
      requestFingerprint,
      uploadAttemptCount: intent.row.uploadAttemptCount,
      uploadLeaseExpiresAt: intent.row.uploadLeaseExpiresAt,
    },
    data: {
      status: 'AVAILABLE',
      storage: actualStorage,
      uploadLeaseExpiresAt: null,
      lastErrorCode: null,
    },
  });
  if (finalized.count !== 1) {
    return reconcileLostUploadLease(prisma, {
      row: intent.row,
      scope,
      actorId,
      purpose,
      requestFingerprint,
      now: completedAt,
    });
  }
  return publicUpload(intent.row);
}

export function protectedUploadDescriptor(row) {
  return {
    provider: row.storage?.provider,
    storage: row.storage,
    visibility: 'private',
    mimeType: row.mimeType,
    filename: row.filename,
    size: row.size,
    sha256: row.sha256,
  };
}

export function publicProtectedAttachment(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const mimeType = typeof value.mimeType === 'string' ? value.mimeType : null;
  const filename = typeof value.filename === 'string' ? value.filename : null;
  const size = Number.isSafeInteger(value.size) ? value.size : null;
  if (!mimeType || !filename || !size) return { available: true, visibility: 'private' };
  return { available: true, visibility: 'private', mimeType, filename, size };
}

export async function claimProtectedUpload(transaction, {
  scope: rawScope,
  actorId: rawActorId,
  purpose,
  uploadId: rawUploadId,
  now = new Date(),
  claimFingerprint: rawClaimFingerprint,
  createEntity,
}) {
  if (typeof createEntity !== 'function') throw new TypeError('createEntity es obligatorio.');
  const scope = trustedScope(rawScope);
  const actorId = requiredText(rawActorId, 'actorId');
  const config = purposeConfig(purpose);
  const uploadId = requiredText(rawUploadId, 'uploadId');
  const claimFingerprint = String(rawClaimFingerprint || '').toLowerCase();
  if (!SHA256_PATTERN.test(claimFingerprint)) {
    throw new ProtectedUploadError(
      'Huella de operación inválida.',
      'PROTECTED_UPLOAD_CLAIM_FINGERPRINT_INVALID',
    );
  }
  const row = await transaction.protectedUpload.findFirst({
    where: { id: uploadId, projectId: scope.projectId },
  });
  if (!row) {
    throw new ProtectedUploadError(
      'La carga no existe en esta obra.',
      'PROTECTED_UPLOAD_NOT_FOUND',
      404,
    );
  }
  assertReservationOwner(row, { scope, actorId, purpose });
  if (row.status !== 'AVAILABLE') {
    const state = row.status === 'CLAIMED'
      ? ['La carga ya fue reclamada.', 'PROTECTED_UPLOAD_ALREADY_CLAIMED']
      : row.status === 'UPLOADING'
        ? ['La carga todavía está en curso.', 'PROTECTED_UPLOAD_IN_PROGRESS']
        : ['La carga ya fue descartada.', 'PROTECTED_UPLOAD_DELETED'];
    throw new ProtectedUploadError(state[0], state[1], 409);
  }
  if (row.expiresAt <= now) {
    throw new ProtectedUploadError('La carga venció.', 'PROTECTED_UPLOAD_EXPIRED', 410);
  }
  assertStoredScope(row.storage, scope.projectId, config);
  assertStoredSize(row.storage, row.size);
  if (row.storageProvider !== row.storage?.provider) {
    throw new ProtectedUploadError(
      'La identidad persistida no coincide con el proveedor reservado.',
      'PROTECTED_UPLOAD_PROVIDER_DRIFT',
      500,
    );
  }
  const entity = await createEntity(protectedUploadDescriptor(row), row);
  const entityId = requiredText(entity?.id, 'entityId');
  const claimed = await transaction.protectedUpload.updateMany({
    where: {
      id: row.id,
      projectId: scope.projectId,
      actorId,
      purpose,
      status: 'AVAILABLE',
      requestFingerprint: row.requestFingerprint,
      expiresAt: { gt: now },
    },
    data: {
      status: 'CLAIMED',
      claimedAt: now,
      claimedEntityType: config.entityType,
      claimedEntityId: entityId,
      claimFingerprint,
    },
  });
  if (claimed.count !== 1) {
    throw new ProtectedUploadError(
      'La carga fue reclamada o eliminada por otra operación.',
      'PROTECTED_UPLOAD_CLAIM_CONFLICT',
      409,
    );
  }
  return entity;
}

export async function assertProtectedUploadReplay(transaction, {
  scope: rawScope,
  actorId: rawActorId,
  purpose,
  uploadId: rawUploadId,
  entityId: rawEntityId,
  entityProtectedUploadId: rawEntityProtectedUploadId,
  claimFingerprint: rawClaimFingerprint,
  entityHasAttachment,
}) {
  const scope = trustedScope(rawScope);
  const actorId = requiredText(rawActorId, 'actorId');
  const config = purposeConfig(purpose);
  const entityId = requiredText(rawEntityId, 'entityId');
  const claimFingerprint = String(rawClaimFingerprint || '').toLowerCase();
  if (!SHA256_PATTERN.test(claimFingerprint)) {
    throw new ProtectedUploadError(
      'Huella de operación inválida.',
      'PROTECTED_UPLOAD_CLAIM_FINGERPRINT_INVALID',
    );
  }
  const uploadId = typeof rawUploadId === 'string' && rawUploadId.trim()
    ? rawUploadId.trim()
    : null;
  if (!uploadId) {
    if (entityHasAttachment) {
      throw new ProtectedUploadError(
        'El reintento omitió la carga vinculada a la operación original.',
        'IDEMPOTENCY_REPLAY_MUTATED',
        409,
      );
    }
    return;
  }
  if (!entityHasAttachment) {
    throw new ProtectedUploadError(
      'El reintento agregó una carga distinta a la operación original.',
      'IDEMPOTENCY_REPLAY_MUTATED',
      409,
    );
  }
  const row = await transaction.protectedUpload.findFirst({
    where: { id: uploadId, projectId: scope.projectId },
  });
  if (!row) {
    throw new ProtectedUploadError(
      'La carga no existe en esta obra.',
      'PROTECTED_UPLOAD_NOT_FOUND',
      404,
    );
  }
  assertReservationOwner(row, { scope, actorId, purpose });
  if (
    row.status !== 'CLAIMED'
    || row.claimedEntityType !== config.entityType
    || row.claimedEntityId !== entityId
    || row.claimFingerprint !== claimFingerprint
    || rawEntityProtectedUploadId !== uploadId
  ) {
    throw new ProtectedUploadError(
      'El reintento no coincide con la carga de la operación original.',
      'IDEMPOTENCY_REPLAY_MUTATED',
      409,
    );
  }
}

async function reserveDeletion(prisma, {
  scope,
  actorId,
  purpose,
  uploadId,
  operationKeyHash,
  requestFingerprint,
  now,
}) {
  return prisma.$transaction(async (transaction) => {
    const row = await transaction.protectedUpload.findFirst({
      where: { id: uploadId, projectId: scope.projectId },
    });
    if (!row) {
      throw new ProtectedUploadError(
        'La carga no existe en esta obra.',
        'PROTECTED_UPLOAD_NOT_FOUND',
        404,
      );
    }
    assertReservationOwner(row, { scope, actorId, purpose });
    const config = purposeConfig(purpose);
    assertStoredScope(row.storage, scope.projectId, config);
    assertStoredSize(row.storage, row.size);
    if (row.storageProvider !== row.storage?.provider) {
      throw new ProtectedUploadError(
        'La identidad persistida no coincide con el proveedor reservado.',
        'PROTECTED_UPLOAD_PROVIDER_DRIFT',
        500,
      );
    }
    if (row.status === 'CLAIMED') {
      throw new ProtectedUploadError('La carga ya está vinculada.', 'PROTECTED_UPLOAD_IN_USE', 409);
    }
    if (row.status === 'UPLOADING') {
      throw new ProtectedUploadError(
        'La carga todavía está en curso.',
        'PROTECTED_UPLOAD_IN_PROGRESS',
        409,
      );
    }
    if (row.status === 'DELETED') {
      // A terminal tombstone makes any authorized DELETE replay a no-op. No
      // historical idempotency key is required because no mutation can occur.
      return { row, replayed: true };
    }
    if (row.status === 'DELETE_PENDING') {
      if (
        row.deleteOperationKeyHash !== operationKeyHash
        || row.deleteRequestFingerprint !== requestFingerprint
      ) {
        const expiredCleanup = internalDeletionHashes(row, 'PROTECTED_UPLOAD_EXPIRED');
        if (
          row.deleteOperationKeyHash === expiredCleanup.deleteOperationKeyHash
          && row.deleteRequestFingerprint === expiredCleanup.deleteRequestFingerprint
        ) {
          // Keep the internal cleanup identity immutable, but let this
          // authorized request help the bounded deletion attempt progress.
          return { row, replayed: true };
        }
        throw new ProtectedUploadError(
          'La carga ya tiene otra operación de eliminación.',
          'IDEMPOTENCY_KEY_REUSED',
          409,
        );
      }
      return { row, replayed: true };
    }
    const reserved = await transaction.protectedUpload.updateMany({
      where: {
        id: row.id,
        projectId: scope.projectId,
        actorId,
        purpose,
        status: 'AVAILABLE',
      },
      data: {
        status: 'DELETE_PENDING',
        deleteOperationKeyHash: operationKeyHash,
        deleteRequestFingerprint: requestFingerprint,
        deleteRequestedAt: now,
        nextDeleteAttemptAt: now,
        lastErrorCode: null,
      },
    });
    if (reserved.count !== 1) {
      throw new ProtectedUploadError(
        'La carga fue reclamada o eliminada por otra operación.',
        'PROTECTED_UPLOAD_DELETE_CONFLICT',
        409,
      );
    }
    return {
      row: {
        ...row,
        status: 'DELETE_PENDING',
        deleteOperationKeyHash: operationKeyHash,
        deleteRequestFingerprint: requestFingerprint,
        deleteRequestedAt: now,
        nextDeleteAttemptAt: now,
      },
      replayed: false,
    };
  }).catch((error) => {
    if (isUniqueConflict(error)) {
      throw new ProtectedUploadError(
        'La Idempotency-Key ya fue usada para eliminar otra carga.',
        'IDEMPOTENCY_KEY_REUSED',
        409,
      );
    }
    throw error;
  });
}

function deleteBackoffMs(attemptCount) {
  return Math.min(
    MAX_DELETE_BACKOFF_MS,
    30_000 * (2 ** Math.min(Math.max(attemptCount - 1, 0), 7)),
  );
}

async function attemptPendingDeletion(prisma, {
  row,
  now = new Date(),
  deleteFile = deleteProtectedFile,
  deleteTimeoutMs = PROTECTED_UPLOAD_DELETE_TIMEOUT_MS,
}) {
  if (row.status !== 'DELETE_PENDING') return { attempted: false, deleted: false, failed: false };
  if (row.nextDeleteAttemptAt && row.nextDeleteAttemptAt > now) {
    return { attempted: false, deleted: false, failed: false };
  }
  if (row.deleteLeaseExpiresAt && row.deleteLeaseExpiresAt > now) {
    return { attempted: false, deleted: false, failed: false };
  }
  const leaseExpiresAt = new Date(now.getTime() + DELETE_LEASE_MS);
  const previousAttempts = Number(row.deleteAttemptCount || 0);
  const acquired = await prisma.protectedUpload.updateMany({
    where: {
      id: row.id,
      status: 'DELETE_PENDING',
      deleteAttemptCount: previousAttempts,
      deleteLeaseExpiresAt: row.deleteLeaseExpiresAt || null,
      deleteOperationKeyHash: row.deleteOperationKeyHash,
      deleteRequestFingerprint: row.deleteRequestFingerprint,
    },
    data: {
      deleteAttemptCount: { increment: 1 },
      deleteLeaseExpiresAt: leaseExpiresAt,
    },
  });
  if (acquired.count !== 1) return { attempted: false, deleted: false, failed: false };
  const attemptCount = previousAttempts + 1;
  const controller = new AbortController();
  let timeout;
  try {
    const config = purposeConfig(row.purpose);
    assertStoredScope(row.storage, row.projectId, config);
    if (row.storageProvider !== row.storage?.provider) {
      throw new ProtectedUploadError(
        'La identidad persistida no coincide con el proveedor reservado.',
        'PROTECTED_UPLOAD_PROVIDER_DRIFT',
        500,
      );
    }
    const providerDeletion = Promise.resolve().then(() => deleteFile(
      { ...row.storage, reused: false },
      { signal: controller.signal },
    ));
    const providerTimeout = new Promise((_, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new ProtectedUploadError(
          'El proveedor no confirmó la eliminación dentro del tiempo permitido.',
          'PROTECTED_UPLOAD_PROVIDER_DELETE_TIMEOUT',
          502,
        ));
      }, Math.max(1, Math.trunc(Number(deleteTimeoutMs) || 1)));
    });
    await Promise.race([providerDeletion, providerTimeout]);
    const completedAt = now;
    const completed = await prisma.protectedUpload.updateMany({
      where: {
        id: row.id,
        status: 'DELETE_PENDING',
        deleteAttemptCount: attemptCount,
        deleteLeaseExpiresAt: leaseExpiresAt,
        deleteOperationKeyHash: row.deleteOperationKeyHash,
        deleteRequestFingerprint: row.deleteRequestFingerprint,
      },
      data: {
        status: 'DELETED',
        deletedAt: completedAt,
        deleteLeaseExpiresAt: null,
        nextDeleteAttemptAt: null,
        lastErrorCode: null,
      },
    });
    return {
      attempted: true,
      deleted: completed.count === 1,
      failed: completed.count !== 1,
    };
  } catch (error) {
    const safeCode = error instanceof ProtectedUploadError
      ? error.code
      : 'PROTECTED_UPLOAD_PROVIDER_DELETE_FAILED';
    await prisma.protectedUpload.updateMany({
      where: {
        id: row.id,
        status: 'DELETE_PENDING',
        deleteAttemptCount: attemptCount,
        deleteLeaseExpiresAt: leaseExpiresAt,
      },
      data: {
        deleteLeaseExpiresAt: null,
        nextDeleteAttemptAt: new Date(now.getTime() + deleteBackoffMs(attemptCount)),
        lastErrorCode: safeCode,
      },
    });
    return { attempted: true, deleted: false, failed: true };
  } finally {
    clearTimeout(timeout);
  }
}

export async function deleteProtectedUpload(prisma, {
  scope: rawScope,
  actorId: rawActorId,
  purpose,
  uploadId: rawUploadId,
  idempotencyKey: rawIdempotencyKey,
  now = new Date(),
  deleteFile = deleteProtectedFile,
}) {
  const scope = trustedScope(rawScope);
  const actorId = requiredText(rawActorId, 'actorId');
  purposeConfig(purpose);
  const uploadId = requiredText(rawUploadId, 'uploadId');
  const idempotencyKey = normalizeProtectedUploadIdempotencyKey(rawIdempotencyKey);
  const operationKeyHash = operationHash({
    scope,
    actorId,
    purpose,
    action: 'delete',
    key: idempotencyKey,
  });
  const requestFingerprint = deletionFingerprint({ scope, actorId, purpose, uploadId });
  const reservation = await reserveDeletion(prisma, {
    scope,
    actorId,
    purpose,
    uploadId,
    operationKeyHash,
    requestFingerprint,
    now,
  });
  if (reservation.row.status === 'DELETED') {
    return { uploadId, replayed: true };
  }
  const result = await attemptPendingDeletion(prisma, {
    row: reservation.row,
    now,
    deleteFile,
  });
  if (result.deleted) return { uploadId, replayed: reservation.replayed };
  if (!result.attempted) {
    const retryAt = reservation.row.nextDeleteAttemptAt || reservation.row.deleteLeaseExpiresAt;
    const retryAfterSeconds = retryAt
      ? Math.max(1, Math.ceil((new Date(retryAt).getTime() - now.getTime()) / 1_000))
      : 2;
    throw new ProtectedUploadError(
      'La eliminación privada está en curso. Reintentá con la misma Idempotency-Key.',
      'PROTECTED_UPLOAD_DELETE_IN_PROGRESS',
      409,
      { retryAfterSeconds },
    );
  }
  throw new ProtectedUploadError(
    'El almacenamiento no confirmó la eliminación; quedó programada para reintento.',
    'PROTECTED_UPLOAD_DELETE_FAILED',
    502,
    { retryAfterSeconds: Math.ceil(deleteBackoffMs((reservation.row.deleteAttemptCount || 0) + 1) / 1_000) },
  );
}

async function reserveExpiredForCleanup(prisma, row, now) {
  if (row.status === 'CLAIMED' || row.status === 'DELETE_PENDING' || row.status === 'DELETED') {
    return false;
  }
  if (row.expiresAt > now) return false;
  if (row.status === 'UPLOADING' && row.uploadLeaseExpiresAt > now) return false;
  const hashes = internalDeletionHashes(row, 'PROTECTED_UPLOAD_EXPIRED');
  const where = {
    id: row.id,
    status: row.status,
    expiresAt: { lte: now },
  };
  if (row.status === 'UPLOADING') {
    where.uploadAttemptCount = row.uploadAttemptCount;
    where.uploadLeaseExpiresAt = row.uploadLeaseExpiresAt;
  }
  const updated = await prisma.protectedUpload.updateMany({
    where,
    data: {
      status: 'DELETE_PENDING',
      uploadLeaseExpiresAt: null,
      deleteOperationKeyHash: hashes.deleteOperationKeyHash,
      deleteRequestFingerprint: hashes.deleteRequestFingerprint,
      deleteRequestedAt: now,
      nextDeleteAttemptAt: now,
      lastErrorCode: 'PROTECTED_UPLOAD_EXPIRED',
    },
  });
  return updated.count === 1;
}

export async function cleanupProtectedUploads(prisma, {
  now = new Date(),
  limit = 50,
  deleteFile = deleteProtectedFile,
  deleteTimeoutMs = PROTECTED_UPLOAD_DELETE_TIMEOUT_MS,
  deadlineAt = null,
  clock = () => new Date(),
} = {}) {
  const take = Math.min(Math.max(Math.trunc(Number(limit) || 1), 1), 100);
  const deadlineMs = deadlineAt == null ? Number.POSITIVE_INFINITY : new Date(deadlineAt).getTime();
  if (!Number.isFinite(deadlineMs) && deadlineAt != null) {
    throw new TypeError('deadlineAt debe ser una fecha válida.');
  }
  const remainingBudgetMs = () => deadlineMs - new Date(clock()).getTime();
  const hasBudget = () => remainingBudgetMs() > 0;
  const expirable = await prisma.protectedUpload.findMany({
    where: {
      expiresAt: { lte: now },
      OR: [
        { status: 'AVAILABLE' },
        { status: 'UPLOADING', uploadLeaseExpiresAt: { lte: now } },
      ],
    },
    orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
    take,
  });
  let expiredReserved = 0;
  for (const row of expirable) {
    if (!hasBudget()) break;
    if (await reserveExpiredForCleanup(prisma, row, now)) expiredReserved += 1;
  }

  // Reserving an expired object and deleting it are separate bounded phases.
  // Sharing one quota let a full expiration batch consume every slot and left
  // all newly DELETE_PENDING objects untouched until a later cron invocation.
  const pending = hasBudget()
    ? await prisma.protectedUpload.findMany({
      where: {
        status: 'DELETE_PENDING',
        nextDeleteAttemptAt: { lte: now },
        OR: [
          { deleteLeaseExpiresAt: null },
          { deleteLeaseExpiresAt: { lte: now } },
        ],
      },
      orderBy: [{ nextDeleteAttemptAt: 'asc' }, { id: 'asc' }],
      take,
    })
    : [];
  let scanned = 0;
  let deleted = 0;
  let failed = 0;
  for (const row of pending) {
    if (!hasBudget()) break;
    if (row.deleteLeaseExpiresAt && row.deleteLeaseExpiresAt > now) continue;
    const result = await attemptPendingDeletion(prisma, {
      row,
      now,
      deleteFile,
      deleteTimeoutMs: Math.min(
        Math.max(1, remainingBudgetMs()),
        Math.max(1, Math.trunc(Number(deleteTimeoutMs) || 1)),
      ),
    });
    if (!result.attempted) continue;
    scanned += 1;
    if (result.deleted) deleted += 1;
    if (result.failed) failed += 1;
  }
  const [moreExpired, morePending] = await Promise.all([
    prisma.protectedUpload.findFirst({
      where: {
        expiresAt: { lte: now },
        OR: [
          { status: 'AVAILABLE' },
          { status: 'UPLOADING', uploadLeaseExpiresAt: { lte: now } },
        ],
      },
      select: { id: true },
    }),
    prisma.protectedUpload.findFirst({
      where: {
        status: 'DELETE_PENDING',
        nextDeleteAttemptAt: { lte: now },
        OR: [
          { deleteLeaseExpiresAt: null },
          { deleteLeaseExpiresAt: { lte: now } },
        ],
      },
      select: { id: true },
    }),
  ]);
  const hasMore = Boolean(moreExpired || morePending);
  return { expiredReserved, scanned, deleted, failed, hasMore };
}

export function protectedUploadErrorResponse(error) {
  if (!(error instanceof ProtectedUploadError)) return null;
  const headers = { 'Cache-Control': 'private, no-store' };
  if (error.retryAfterSeconds) headers['Retry-After'] = String(error.retryAfterSeconds);
  return Response.json(
    { error: error.message, code: error.code },
    { status: error.status, headers },
  );
}
