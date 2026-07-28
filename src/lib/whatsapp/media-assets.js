import { createHash, randomUUID as nodeRandomUUID } from 'node:crypto';

import {
  privateReceiptStorageReference,
  protectedStorageBelongsToPrefix,
  protectedStorageLookup,
} from '../private-receipts.js';
import {
  deleteProtectedFile,
  isPrivateVercelBlobUrl,
  protectedUploadExpectedStorage,
  resolveProtectedStorageProvider,
} from '../storage.js';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/;
const PHONE_NUMBER_ID_PATTERN = /^\d{5,40}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUPPORTED_MEDIA_KINDS = new Set(['IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT']);
const TERMINAL_WEBHOOK_STATUSES = Object.freeze(['PROCESSED', 'FAILED']);
const MAX_MEDIA_BYTES = 100 * 1024 * 1024;
const DEFAULT_RETENTION_MS = 24 * 60 * 60 * 1_000;
const MAX_RETENTION_MS = 365 * 24 * 60 * 60 * 1_000;
const MAX_DELETE_BACKOFF_MS = 60 * 60 * 1_000;

export const WHATSAPP_MEDIA_ASSET_UPLOAD_LEASE_MS = 2 * 60 * 1_000;
export const WHATSAPP_MEDIA_ASSET_DELETE_LEASE_MS = 60 * 1_000;
export const WHATSAPP_MEDIA_ASSET_DELETE_TIMEOUT_MS = 10 * 1_000;

export const WHATSAPP_MEDIA_UPLOAD_CERTAINTY = Object.freeze({
  DEFINITE: 'DEFINITE',
  UNCERTAIN: 'UNCERTAIN',
});

export const WHATSAPP_MEDIA_ASSET_DESCRIPTOR_SELECT = Object.freeze({
  id: true,
  organizationId: true,
  projectId: true,
  webhookEventId: true,
  status: true,
  mediaKind: true,
  declaredMimeType: true,
  storageProvider: true,
  storage: true,
  storageLocatorHash: true,
  fileName: true,
  mimeType: true,
  contentSha256: true,
  sizeBytes: true,
  messageConversationId: true,
  messageId: true,
  claimFingerprint: true,
  providerMessageIdHash: true,
  providerMediaIdHash: true,
});

export class WhatsAppMediaAssetError extends Error {
  constructor(message, code = 'WHATSAPP_MEDIA_ASSET_INVALID', status = 400, {
    retryAfterSeconds = null,
  } = {}) {
    super(message);
    this.name = 'WhatsAppMediaAssetError';
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = Number.isSafeInteger(retryAfterSeconds)
      ? Math.max(1, retryAfterSeconds)
      : null;
  }
}

function requiredText(value, field, max = 512) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > max || normalized.includes('\0')) {
    throw new WhatsAppMediaAssetError(`${field} inválido.`);
  }
  return normalized;
}

function tenantScope(value, { requirePhoneNumberId = false } = {}) {
  const scope = {
    organizationId: requiredText(value?.organizationId, 'organizationId', 190),
    projectId: requiredText(value?.projectId, 'projectId', 190),
  };
  if (requirePhoneNumberId) {
    const phoneNumberId = requiredText(value?.phoneNumberId, 'phoneNumberId', 40);
    if (!PHONE_NUMBER_ID_PATTERN.test(phoneNumberId)) {
      throw new WhatsAppMediaAssetError('phoneNumberId inválido.');
    }
    scope.phoneNumberId = phoneNumberId;
  }
  return scope;
}

function normalizedMediaKind(value) {
  const normalized = String(value || '').trim().toUpperCase();
  const kind = normalized === 'STICKER' ? 'IMAGE' : normalized;
  if (!SUPPORTED_MEDIA_KINDS.has(kind)) {
    throw new WhatsAppMediaAssetError('Tipo de medio de WhatsApp inválido.');
  }
  return kind;
}

function assertKindMime(mediaKind, mimeType) {
  const matchesKind = mediaKind === 'IMAGE'
    ? mimeType.startsWith('image/')
    : mediaKind === 'AUDIO'
      ? mimeType.startsWith('audio/')
      : mediaKind === 'VIDEO'
        ? mimeType.startsWith('video/')
        : !/^(?:image|audio|video)\//.test(mimeType);
  if (!matchesKind) {
    throw new WhatsAppMediaAssetError(
      'El MIME no coincide con el tipo de medio de WhatsApp.',
      'WHATSAPP_MEDIA_ASSET_KIND_MIME_MISMATCH',
      409,
    );
  }
}

function normalizedMimeType(value) {
  const mimeType = String(value || '').split(';', 1)[0].trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/.test(mimeType)) {
    throw new WhatsAppMediaAssetError('MIME type de WhatsApp inválido.');
  }
  return mimeType;
}

function normalizedFileName(value) {
  const fileName = requiredText(value, 'fileName', 255).normalize('NFC');
  if (
    fileName === '.'
    || fileName === '..'
    || fileName.includes('/')
    || fileName.includes('\\')
    || /[\r\n]/.test(fileName)
  ) {
    throw new WhatsAppMediaAssetError('fileName inválido.');
  }
  return fileName;
}

function safeErrorCode(value, fallback) {
  const normalized = String(value || '').trim().toUpperCase();
  return ERROR_CODE_PATTERN.test(normalized) ? normalized : fallback;
}

function validDate(value, field) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new WhatsAppMediaAssetError(`${field} inválido.`);
  }
  return date;
}

function validUuid(value, field) {
  const normalized = requiredText(value, field, 36);
  if (!UUID_PATTERN.test(normalized)) {
    throw new WhatsAppMediaAssetError(`${field} inválido.`);
  }
  return normalized;
}

function purgeDate(value, now) {
  const date = value == null
    ? new Date(now.getTime() + DEFAULT_RETENTION_MS)
    : validDate(value, 'purgeEligibleAt');
  const retentionMs = date.getTime() - now.getTime();
  if (retentionMs < 60_000 || retentionMs > MAX_RETENTION_MS) {
    throw new WhatsAppMediaAssetError('La retención del medio está fuera del rango permitido.');
  }
  return date;
}

export function whatsAppMediaAssetHash(value) {
  return createHash('sha256').update(String(value)).digest('hex');
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

function fingerprint(value) {
  return whatsAppMediaAssetHash(JSON.stringify(canonicalValue(value)));
}

function operationIdentity({ scope, webhookEventId, providerMessageIdHash, providerMediaIdHash }) {
  return fingerprint({
    version: 1,
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    webhookEventId,
    providerMessageIdHash,
    providerMediaIdHash,
  });
}

function requestIdentity({
  scope,
  webhookEventId,
  providerMessageIdHash,
  providerMediaIdHash,
  mediaKind,
  declaredMimeType,
  file,
  contentSha256,
}) {
  return fingerprint({
    version: 1,
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    phoneNumberId: scope.phoneNumberId,
    webhookEventId,
    providerMessageIdHash,
    providerMediaIdHash,
    mediaKind,
    declaredMimeType,
    filename: file.name.normalize('NFC'),
    sizeBytes: file.size,
    contentSha256,
  });
}

function storagePrefix(projectId) {
  return `obrasaas/projects/${projectId}/whatsapp/`;
}

function storageFolder(scope) {
  return `${storagePrefix(scope.projectId)}${scope.phoneNumberId}`.replace(/\/$/, '');
}

function storageReference(value, fallbackBytes) {
  return { ...privateReceiptStorageReference(value, fallbackBytes), reused: false };
}

function parsedHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

function providerDeliveryUrl(uploaded, storage) {
  if (storage.provider === 'vercel-blob') {
    const url = parsedHttpsUrl(storage.assetId);
    if (!url || !isPrivateVercelBlobUrl(url.toString())) {
      throw new WhatsAppMediaAssetError(
        'El proveedor no devolvió una URL privada verificable.',
        'WHATSAPP_MEDIA_ASSET_DELIVERY_URL_INVALID',
        502,
      );
    }
    return url.toString();
  }
  if (storage.provider === 'cloudinary') {
    const url = parsedHttpsUrl(uploaded?.secureUrl);
    let coherentPath = false;
    if (url && (url.hostname === 'res.cloudinary.com' || url.hostname.endsWith('.res.cloudinary.com'))) {
      try {
        const path = decodeURIComponent(url.pathname);
        const publicId = String(storage.publicId || '');
        const format = String(storage.format || '');
        const suffix = publicId.endsWith(`.${format}`)
          ? `/${publicId}`
          : `/${publicId}.${format}`;
        coherentPath = path.includes(`/${storage.resourceType}/authenticated/`)
          && path.endsWith(suffix);
      } catch {
        coherentPath = false;
      }
    }
    if (!url || !coherentPath) {
      throw new WhatsAppMediaAssetError(
        'El proveedor no devolvió una URL privada verificable.',
        'WHATSAPP_MEDIA_ASSET_DELIVERY_URL_INVALID',
        502,
      );
    }
    return url.toString();
  }
  throw new WhatsAppMediaAssetError(
    'El proveedor del medio no admite entrega privada.',
    'WHATSAPP_MEDIA_ASSET_DELIVERY_URL_INVALID',
    502,
  );
}

function durableDeliveryUrl(row, storage) {
  const candidate = storage.provider === 'vercel-blob'
    ? storage.assetId
    : row.storage?.deliveryUrl;
  return providerDeliveryUrl({ secureUrl: candidate }, storage);
}

function assertStorageScope(storage, projectId) {
  if (!protectedStorageBelongsToPrefix(storage, storagePrefix(projectId), { allowVideo: true })) {
    throw new WhatsAppMediaAssetError(
      'El almacenamiento del medio está fuera de la obra autorizada.',
      'WHATSAPP_MEDIA_ASSET_STORAGE_SCOPE',
      502,
    );
  }
}

function storageLocatorHash(storage) {
  const lookup = protectedStorageLookup(storage);
  if (!lookup) {
    throw new WhatsAppMediaAssetError(
      'La identidad privada del medio está incompleta.',
      'WHATSAPP_MEDIA_ASSET_STORAGE_INVALID',
      502,
    );
  }
  return fingerprint({
    provider: storage.provider,
    path: lookup.path,
    value: lookup.value,
  });
}

function assertStorageDescriptor(storage, row) {
  assertStorageScope(storage, row.projectId);
  if (storage.provider !== row.storageProvider) {
    throw new WhatsAppMediaAssetError(
      'El proveedor no coincide con el intent persistido.',
      'WHATSAPP_MEDIA_ASSET_PROVIDER_DRIFT',
      502,
    );
  }
  if (storage.resourceType !== providerResourceType(row.mediaKind)) {
    throw new WhatsAppMediaAssetError(
      'El tipo de recurso almacenado no coincide con el medio.',
      'WHATSAPP_MEDIA_ASSET_RESOURCE_TYPE_MISMATCH',
      502,
    );
  }
  if (storageLocatorHash(storage) !== row.storageLocatorHash) {
    throw new WhatsAppMediaAssetError(
      'El proveedor no respetó la identidad determinista reservada.',
      'WHATSAPP_MEDIA_ASSET_PROVIDER_DRIFT',
      502,
    );
  }
  if (!Number.isSafeInteger(storage.bytes) || storage.bytes !== row.sizeBytes) {
    throw new WhatsAppMediaAssetError(
      'El proveedor devolvió un tamaño distinto al medio verificado.',
      'WHATSAPP_MEDIA_ASSET_SIZE_MISMATCH',
      502,
    );
  }
}

function providerResourceType(mediaKind) {
  if (mediaKind === 'AUDIO' || mediaKind === 'VIDEO') return 'video';
  if (mediaKind === 'DOCUMENT') return 'raw';
  return 'image';
}

function publicAsset(row, { replayed = false } = {}) {
  return {
    mediaAssetId: row.id,
    status: row.status,
    replayed,
  };
}

function assertAssetScope(row, scope) {
  if (
    row.organizationId !== scope.organizationId
    || row.projectId !== scope.projectId
  ) {
    throw new WhatsAppMediaAssetError(
      'El medio no existe en esta organización y obra.',
      'WHATSAPP_MEDIA_ASSET_NOT_FOUND',
      404,
    );
  }
}

function assertMatchingReplay(row, requestFingerprint) {
  if (row.requestFingerprint !== requestFingerprint) {
    throw new WhatsAppMediaAssetError(
      'El mensaje de WhatsApp ya reservó otro medio o metadatos.',
      'WHATSAPP_MEDIA_ASSET_IDEMPOTENCY_REUSED',
      409,
    );
  }
}

function retryAfter(lease, now) {
  return Math.max(1, Math.ceil((new Date(lease).getTime() - now.getTime()) / 1_000));
}

function uploadInProgress(row, now) {
  return new WhatsAppMediaAssetError(
    'La carga privada del medio todavía está en curso.',
    'WHATSAPP_MEDIA_ASSET_UPLOAD_IN_PROGRESS',
    409,
    { retryAfterSeconds: retryAfter(row.uploadLeaseExpiresAt, now) },
  );
}

function deleteHashes(row, reason) {
  return {
    deleteOperationKeyHash: fingerprint({ version: 1, action: 'delete', reason, id: row.id }),
    deleteRequestFingerprint: fingerprint({
      version: 1,
      action: 'delete',
      reason,
      id: row.id,
      requestFingerprint: row.requestFingerprint,
      storageLocatorHash: row.storageLocatorHash,
    }),
  };
}

function isUniqueConflict(error) {
  return error?.code === 'P2002';
}

async function moveExpiredUploadToDeletePending(transaction, row, scope, now) {
  const hashes = deleteHashes(row, 'WHATSAPP_MEDIA_UPLOAD_UNCERTAIN');
  const transitioned = await transaction.whatsAppMediaAsset.updateMany({
    where: {
      id: row.id,
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      status: 'UPLOADING',
      requestFingerprint: row.requestFingerprint,
      uploadAttemptCount: row.uploadAttemptCount,
      uploadLeaseToken: row.uploadLeaseToken,
      uploadLeaseExpiresAt: row.uploadLeaseExpiresAt,
    },
    data: {
      status: 'DELETE_PENDING',
      uploadLeaseToken: null,
      uploadLeaseExpiresAt: null,
      nextUploadAttemptAt: null,
      ...hashes,
      deleteRequestedAt: now,
      nextDeleteAttemptAt: now,
      lastErrorCode: 'WHATSAPP_MEDIA_UPLOAD_UNCERTAIN',
    },
  });
  return transitioned.count === 1;
}

function replayResolution(row, now) {
  if (row.status === 'AVAILABLE' || row.status === 'CLAIMED') {
    return {
      kind: 'return',
      value: {
        ...publicAsset(row, { replayed: true }),
        descriptor: whatsAppMediaAssetDescriptor(row),
      },
    };
  }
  if (row.status === 'UPLOADING' && row.uploadLeaseExpiresAt > now) {
    return { kind: 'throw', error: uploadInProgress(row, now) };
  }
  if (row.status === 'FAILED') {
    return {
      kind: 'throw',
      error: new WhatsAppMediaAssetError(
        'La carga falló de forma terminal y requiere una nueva resolución explícita.',
        'WHATSAPP_MEDIA_ASSET_UPLOAD_FAILED',
        409,
      ),
    };
  }
  if (row.status === 'DELETE_PENDING' || row.status === 'DELETED') {
    return {
      kind: 'throw',
      error: new WhatsAppMediaAssetError(
        'La carga ambigua fue aislada para limpieza y no puede reenviarse automáticamente.',
        'WHATSAPP_MEDIA_ASSET_UPLOAD_UNCERTAIN',
        409,
      ),
    };
  }
  return null;
}

export async function createOrResumeWhatsAppMediaAssetIntent(prisma, {
  scope: rawScope,
  webhookEventId: rawWebhookEventId,
  webhookLeaseToken: rawWebhookLeaseToken,
  providerMessageId: rawProviderMessageId,
  providerMediaId: rawProviderMediaId,
  mediaKind: rawMediaKind,
  declaredMimeType: rawDeclaredMimeType,
  file,
  contentSha256: rawContentSha256,
  purgeEligibleAt: rawPurgeEligibleAt = null,
  now = new Date(),
  randomUUID = nodeRandomUUID,
  resolveProvider = resolveProtectedStorageProvider,
  expectedStorageForUpload = protectedUploadExpectedStorage,
}) {
  const scope = tenantScope(rawScope, { requirePhoneNumberId: true });
  const webhookEventId = requiredText(rawWebhookEventId, 'webhookEventId', 190);
  const webhookLeaseToken = requiredText(rawWebhookLeaseToken, 'webhookLeaseToken', 190);
  const providerMessageId = requiredText(rawProviderMessageId, 'providerMessageId');
  const providerMediaId = requiredText(rawProviderMediaId, 'providerMediaId');
  const providerMessageIdHash = whatsAppMediaAssetHash(providerMessageId);
  const providerMediaIdHash = whatsAppMediaAssetHash(providerMediaId);
  const mediaKind = normalizedMediaKind(rawMediaKind);
  const declaredMimeType = normalizedMimeType(rawDeclaredMimeType);
  assertKindMime(mediaKind, declaredMimeType);
  const contentSha256 = String(rawContentSha256 || '').trim().toLowerCase();
  if (
    !(file instanceof File)
    || normalizedFileName(file.name) !== file.name.normalize('NFC')
    || !Number.isSafeInteger(file.size)
    || file.size < 1
    || file.size > MAX_MEDIA_BYTES
    || normalizedMimeType(file.type) !== declaredMimeType
    || !SHA256_PATTERN.test(contentSha256)
  ) {
    throw new WhatsAppMediaAssetError('Archivo o huella del medio inválidos.');
  }
  const trustedNow = validDate(now, 'now');
  const purgeEligibleAt = purgeDate(rawPurgeEligibleAt, trustedNow);
  const operationKeyHash = operationIdentity({
    scope,
    webhookEventId,
    providerMessageIdHash,
    providerMediaIdHash,
  });
  const requestFingerprint = requestIdentity({
    scope,
    webhookEventId,
    providerMessageIdHash,
    providerMediaIdHash,
    mediaKind,
    declaredMimeType,
    file,
    contentSha256,
  });

  const createPlan = () => {
    const storageProvider = resolveProvider();
    const providerIdempotencyKey = [
      'whatsapp-media-asset',
      scope.organizationId,
      scope.projectId,
      operationKeyHash,
      requestFingerprint,
    ].join(':');
    const uploadOptions = {
      provider: storageProvider,
      folder: storageFolder(scope),
      context: [
        `project=${scope.projectId}`,
        `webhook_event=${webhookEventId}`,
        `message_hash=${providerMessageIdHash}`,
        `media_hash=${providerMediaIdHash}`,
        'private=true',
      ].join('|'),
      idempotencyKey: providerIdempotencyKey,
      resourceType: providerResourceType(mediaKind),
    };
    const storage = storageReference(
      expectedStorageForUpload(file, uploadOptions),
      file.size,
    );
    assertStorageScope(storage, scope.projectId);
    if (
      storage.provider !== storageProvider
      || storage.bytes !== file.size
      || storage.resourceType !== providerResourceType(mediaKind)
    ) {
      throw new WhatsAppMediaAssetError(
        'La identidad determinista del almacenamiento es inválida.',
        'WHATSAPP_MEDIA_ASSET_STORAGE_INVALID',
        502,
      );
    }
    return {
      storageProvider,
      storage,
      storageLocatorHash: storageLocatorHash(storage),
      uploadOptions,
    };
  };

  let result;
  try {
    result = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe("SET LOCAL lock_timeout = '3000ms'");
      await transaction.$executeRawUnsafe(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        `obrasaas:whatsapp-media:${scope.organizationId}:${scope.projectId}`,
      );
      const webhookEvent = await transaction.webhookEvent.findFirst({
        where: {
          id: webhookEventId,
          projectId: scope.projectId,
          provider: 'meta',
          eventType: 'message',
          status: 'PROCESSING',
          leaseToken: webhookLeaseToken,
          leaseExpiresAt: { gt: trustedNow },
          project: { organizationId: scope.organizationId },
        },
        select: { id: true },
      });
      if (!webhookEvent) {
        throw new WhatsAppMediaAssetError(
          'La concesión del webhook cambió antes de reservar el medio.',
          'WHATSAPP_MEDIA_ASSET_WEBHOOK_LEASE_LOST',
          409,
        );
      }
      const existing = await transaction.whatsAppMediaAsset.findFirst({
        where: {
          organizationId: scope.organizationId,
          projectId: scope.projectId,
          operationKeyHash,
        },
      });
      if (existing) {
        assertAssetScope(existing, scope);
        assertMatchingReplay(existing, requestFingerprint);
        const replay = replayResolution(existing, trustedNow);
        if (replay?.kind === 'return') return replay.value;
        if (replay?.kind === 'throw') throw replay.error;
        if (existing.status === 'UPLOADING') {
          // A crashed process may have contacted storage after committing the
          // intent. Treat the expired attempt as ambiguous: quarantine its
          // deterministic locator for deletion and never dispatch it again.
          const transitioned = await moveExpiredUploadToDeletePending(
            transaction,
            existing,
            scope,
            trustedNow,
          );
          return {
            mediaAssetId: existing.id,
            status: transitioned ? 'DELETE_PENDING' : 'UPLOADING',
            dispatch: false,
            uncertain: true,
          };
        }
        throw new WhatsAppMediaAssetError(
          'El intent del medio está en un estado inválido.',
          'WHATSAPP_MEDIA_ASSET_STATE_INVALID',
          409,
        );
      }

      const plan = createPlan();
      const uploadLeaseToken = validUuid(randomUUID(), 'uploadLeaseToken');
      const uploadLeaseExpiresAt = new Date(
        trustedNow.getTime() + WHATSAPP_MEDIA_ASSET_UPLOAD_LEASE_MS,
      );
      const row = await transaction.whatsAppMediaAsset.create({
        data: {
          organizationId: scope.organizationId,
          projectId: scope.projectId,
          webhookEventId,
          operationKeyHash,
          requestFingerprint,
          providerMediaIdHash,
          providerMessageIdHash,
          mediaKind,
          declaredMimeType,
          fileName: null,
          mimeType: null,
          status: 'UPLOADING',
          storageProvider: plan.storageProvider,
          storage: plan.storage,
          contentSha256,
          sizeBytes: file.size,
          storageLocatorHash: plan.storageLocatorHash,
          uploadAttemptCount: 1,
          uploadLeaseToken,
          uploadLeaseExpiresAt,
          nextUploadAttemptAt: null,
          purgeEligibleAt,
          lastErrorCode: null,
        },
      });
      return {
        ...publicAsset(row),
        dispatch: true,
        uploadLeaseToken,
        upload: {
          provider: plan.storageProvider,
          expectedStorage: plan.storage,
          options: plan.uploadOptions,
        },
      };
    });
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    const winner = await prisma.whatsAppMediaAsset.findFirst({
      where: {
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        operationKeyHash,
      },
    });
    if (!winner) throw error;
    assertMatchingReplay(winner, requestFingerprint);
    const replay = replayResolution(winner, trustedNow);
    if (replay?.kind === 'return') return replay.value;
    if (replay?.kind === 'throw') throw replay.error;
    throw uploadInProgress(winner, trustedNow);
  }

  if (result.uncertain) {
    throw new WhatsAppMediaAssetError(
      'La carga previa puede haber llegado al proveedor; quedó aislada para limpieza sin reenvío.',
      'WHATSAPP_MEDIA_ASSET_UPLOAD_UNCERTAIN',
      409,
    );
  }
  // Provider contact is authorized only after this committed result. The
  // caller must finalize AVAILABLE or record a DEFINITE/UNCERTAIN outcome;
  // calling createOrResume again can never auto-retry an ambiguous attempt.
  return result;
}

async function findScopedAsset(prisma, scope, mediaAssetId) {
  const row = await prisma.whatsAppMediaAsset.findFirst({
    where: {
      id: mediaAssetId,
      organizationId: scope.organizationId,
      projectId: scope.projectId,
    },
  });
  if (!row) {
    throw new WhatsAppMediaAssetError(
      'El medio no existe en esta organización y obra.',
      'WHATSAPP_MEDIA_ASSET_NOT_FOUND',
      404,
    );
  }
  assertAssetScope(row, scope);
  return row;
}

export async function markWhatsAppMediaAssetUploadFailure(prisma, {
  scope: rawScope,
  mediaAssetId: rawMediaAssetId,
  uploadLeaseToken: rawUploadLeaseToken,
  certainty = WHATSAPP_MEDIA_UPLOAD_CERTAINTY.UNCERTAIN,
  errorCode = null,
  now = new Date(),
}) {
  const scope = tenantScope(rawScope);
  const mediaAssetId = requiredText(rawMediaAssetId, 'mediaAssetId', 190);
  const uploadLeaseToken = requiredText(rawUploadLeaseToken, 'uploadLeaseToken', 190);
  const trustedNow = validDate(now, 'now');
  if (!Object.values(WHATSAPP_MEDIA_UPLOAD_CERTAINTY).includes(certainty)) {
    throw new WhatsAppMediaAssetError('Certeza de fallo inválida.');
  }
  const row = await findScopedAsset(prisma, scope, mediaAssetId);
  if (row.status === 'DELETE_PENDING' && certainty === WHATSAPP_MEDIA_UPLOAD_CERTAINTY.UNCERTAIN) {
    return publicAsset(row, { replayed: true });
  }
  if (row.status === 'FAILED' && certainty === WHATSAPP_MEDIA_UPLOAD_CERTAINTY.DEFINITE) {
    return publicAsset(row, { replayed: true });
  }
  if (row.status !== 'UPLOADING' || row.uploadLeaseToken !== uploadLeaseToken) {
    throw new WhatsAppMediaAssetError(
      'La concesión de carga cambió antes de registrar el fallo.',
      'WHATSAPP_MEDIA_ASSET_UPLOAD_LEASE_LOST',
      409,
    );
  }

  const uncertain = certainty === WHATSAPP_MEDIA_UPLOAD_CERTAINTY.UNCERTAIN;
  const safeCode = safeErrorCode(
    errorCode,
    uncertain ? 'WHATSAPP_MEDIA_UPLOAD_UNCERTAIN' : 'WHATSAPP_MEDIA_UPLOAD_FAILED',
  );
  const hashes = uncertain ? deleteHashes(row, safeCode) : {};
  const update = uncertain
    ? {
        status: 'DELETE_PENDING',
        uploadLeaseToken: null,
        uploadLeaseExpiresAt: null,
        nextUploadAttemptAt: null,
        ...hashes,
        deleteRequestedAt: trustedNow,
        nextDeleteAttemptAt: trustedNow,
        lastErrorCode: safeCode,
      }
    : {
        status: 'FAILED',
        storageProvider: null,
        storage: null,
        contentSha256: null,
        sizeBytes: null,
        storageLocatorHash: null,
        fileName: null,
        mimeType: null,
        uploadLeaseToken: null,
        uploadLeaseExpiresAt: null,
        nextUploadAttemptAt: null,
        purgeEligibleAt: null,
        lastErrorCode: safeCode,
      };
  const changed = await prisma.whatsAppMediaAsset.updateMany({
    where: {
      id: row.id,
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      status: 'UPLOADING',
      requestFingerprint: row.requestFingerprint,
      uploadLeaseToken,
      uploadAttemptCount: row.uploadAttemptCount,
    },
    data: update,
  });
  if (changed.count !== 1) {
    throw new WhatsAppMediaAssetError(
      'La concesión de carga cambió antes de registrar el fallo.',
      'WHATSAPP_MEDIA_ASSET_UPLOAD_LEASE_LOST',
      409,
    );
  }
  return { mediaAssetId: row.id, status: update.status, replayed: false };
}

export async function markWhatsAppMediaAssetAvailable(prisma, {
  scope: rawScope,
  mediaAssetId: rawMediaAssetId,
  uploadLeaseToken: rawUploadLeaseToken,
  uploaded,
  fileName: rawFileName,
  mimeType: rawMimeType,
  now = new Date(),
}) {
  const scope = tenantScope(rawScope);
  const mediaAssetId = requiredText(rawMediaAssetId, 'mediaAssetId', 190);
  const uploadLeaseToken = requiredText(rawUploadLeaseToken, 'uploadLeaseToken', 190);
  const trustedNow = validDate(now, 'now');
  const row = await findScopedAsset(prisma, scope, mediaAssetId);
  if (row.status === 'AVAILABLE' || row.status === 'CLAIMED') {
    return {
      ...publicAsset(row, { replayed: true }),
      descriptor: whatsAppMediaAssetDescriptor(row, { scope }),
    };
  }
  if (row.status !== 'UPLOADING' || row.uploadLeaseToken !== uploadLeaseToken) {
    throw new WhatsAppMediaAssetError(
      'La concesión de carga cambió antes de confirmar el almacenamiento.',
      'WHATSAPP_MEDIA_ASSET_UPLOAD_LEASE_LOST',
      409,
    );
  }

  let storage;
  let fileName;
  let mimeType;
  try {
    const persistedStorage = storageReference(row.storage, row.sizeBytes);
    assertStorageDescriptor(persistedStorage, row);
    fileName = normalizedFileName(rawFileName);
    mimeType = normalizedMimeType(rawMimeType);
    if (mimeType !== row.declaredMimeType) {
      throw new WhatsAppMediaAssetError(
        'El MIME verificado no coincide con el declarado por Meta.',
        'WHATSAPP_MEDIA_ASSET_MIME_MISMATCH',
        409,
      );
    }
    const normalizedStorage = storageReference(uploaded, row.sizeBytes);
    assertStorageDescriptor(normalizedStorage, row);
    storage = {
      ...normalizedStorage,
      deliveryUrl: providerDeliveryUrl(uploaded, normalizedStorage),
    };
  } catch (error) {
    await markWhatsAppMediaAssetUploadFailure(prisma, {
      scope,
      mediaAssetId,
      uploadLeaseToken,
      certainty: WHATSAPP_MEDIA_UPLOAD_CERTAINTY.UNCERTAIN,
      errorCode: error?.code || 'WHATSAPP_MEDIA_ASSET_STORAGE_INVALID',
      now: trustedNow,
    });
    throw error;
  }

  if (row.purgeEligibleAt <= trustedNow) {
    await markWhatsAppMediaAssetUploadFailure(prisma, {
      scope,
      mediaAssetId,
      uploadLeaseToken,
      certainty: WHATSAPP_MEDIA_UPLOAD_CERTAINTY.UNCERTAIN,
      errorCode: 'WHATSAPP_MEDIA_ASSET_RETENTION_EXPIRED',
      now: trustedNow,
    });
    throw new WhatsAppMediaAssetError(
      'La retención venció antes de confirmar la carga; se programó su limpieza.',
      'WHATSAPP_MEDIA_ASSET_RETENTION_EXPIRED',
      410,
    );
  }

  const completed = await prisma.whatsAppMediaAsset.updateMany({
    where: {
      id: row.id,
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      status: 'UPLOADING',
      requestFingerprint: row.requestFingerprint,
      uploadLeaseToken,
      uploadAttemptCount: row.uploadAttemptCount,
    },
    data: {
      status: 'AVAILABLE',
      storage,
      fileName,
      mimeType,
      uploadLeaseToken: null,
      uploadLeaseExpiresAt: null,
      nextUploadAttemptAt: null,
      lastErrorCode: null,
    },
  });
  if (completed.count === 1) {
    const current = await findScopedAsset(prisma, scope, mediaAssetId);
    return {
      mediaAssetId: row.id,
      status: 'AVAILABLE',
      replayed: false,
      descriptor: whatsAppMediaAssetDescriptor(current, { scope }),
    };
  }
  const current = await findScopedAsset(prisma, scope, mediaAssetId);
  if (current.status === 'AVAILABLE' || current.status === 'CLAIMED') {
    return {
      ...publicAsset(current, { replayed: true }),
      descriptor: whatsAppMediaAssetDescriptor(current, { scope }),
    };
  }
  throw new WhatsAppMediaAssetError(
    'El resultado del proveedor quedó incierto y no se reenviará automáticamente.',
    'WHATSAPP_MEDIA_ASSET_UPLOAD_UNCERTAIN',
    409,
  );
}

export function whatsAppMediaAssetClaimFingerprint({
  scope: rawScope,
  mediaAssetId: rawMediaAssetId,
  messageConversationId: rawConversationId,
  messageId: rawMessageId,
  requestFingerprint,
}) {
  const scope = tenantScope(rawScope);
  return fingerprint({
    version: 1,
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    mediaAssetId: requiredText(rawMediaAssetId, 'mediaAssetId', 190),
    messageConversationId: requiredText(rawConversationId, 'messageConversationId', 190),
    messageId: requiredText(rawMessageId, 'messageId', 190),
    requestFingerprint: requiredText(requestFingerprint, 'requestFingerprint', 64),
  });
}

export async function claimWhatsAppMediaAsset(transaction, {
  scope: rawScope,
  mediaAssetId: rawMediaAssetId,
  messageConversationId: rawConversationId,
  messageId: rawMessageId,
  now = new Date(),
}) {
  const scope = tenantScope(rawScope);
  const mediaAssetId = requiredText(rawMediaAssetId, 'mediaAssetId', 190);
  const messageConversationId = requiredText(rawConversationId, 'messageConversationId', 190);
  const messageId = requiredText(rawMessageId, 'messageId', 190);
  const trustedNow = validDate(now, 'now');
  const row = await findScopedAsset(transaction, scope, mediaAssetId);
  const claimFingerprint = whatsAppMediaAssetClaimFingerprint({
    scope,
    mediaAssetId,
    messageConversationId,
    messageId,
    requestFingerprint: row.requestFingerprint,
  });
  if (row.status === 'CLAIMED') {
    if (
      row.messageConversationId === messageConversationId
      && row.messageId === messageId
      && row.claimFingerprint === claimFingerprint
    ) return { ...publicAsset(row, { replayed: true }), messageId };
    throw new WhatsAppMediaAssetError(
      'El medio ya fue vinculado a otro mensaje.',
      'WHATSAPP_MEDIA_ASSET_ALREADY_CLAIMED',
      409,
    );
  }
  if (row.status !== 'AVAILABLE') {
    throw new WhatsAppMediaAssetError(
      'El medio no está disponible para vincular.',
      'WHATSAPP_MEDIA_ASSET_NOT_AVAILABLE',
      409,
    );
  }
  if (row.purgeEligibleAt <= trustedNow) {
    throw new WhatsAppMediaAssetError(
      'El medio venció antes de ser vinculado.',
      'WHATSAPP_MEDIA_ASSET_EXPIRED',
      410,
    );
  }
  if (
    !row.fileName
    || !row.mimeType
    || normalizedFileName(row.fileName) !== row.fileName
    || normalizedMimeType(row.mimeType) !== row.mimeType
    || row.mimeType !== row.declaredMimeType
  ) {
    throw new WhatsAppMediaAssetError(
      'El descriptor verificado del medio está incompleto.',
      'WHATSAPP_MEDIA_ASSET_DESCRIPTOR_INVALID',
      500,
    );
  }
  assertStorageDescriptor(storageReference(row.storage, row.sizeBytes), row);

  const message = await transaction.message.findFirst({
    where: {
      id: messageId,
      conversationId: messageConversationId,
      direction: 'INBOUND',
      conversation: {
        id: messageConversationId,
        projectId: scope.projectId,
        project: { organizationId: scope.organizationId },
      },
    },
    select: {
      id: true,
      conversationId: true,
      externalId: true,
      direction: true,
      kind: true,
    },
  });
  if (
    !message
    || whatsAppMediaAssetHash(message.externalId || '') !== row.providerMessageIdHash
    || message.kind !== row.mediaKind
  ) {
    throw new WhatsAppMediaAssetError(
      'El mensaje no prueba el origen y alcance del medio.',
      'WHATSAPP_MEDIA_ASSET_MESSAGE_SCOPE_MISMATCH',
      409,
    );
  }

  const claimed = await transaction.whatsAppMediaAsset.updateMany({
    where: {
      id: row.id,
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      status: 'AVAILABLE',
      requestFingerprint: row.requestFingerprint,
      purgeEligibleAt: { gt: trustedNow },
    },
    data: {
      status: 'CLAIMED',
      messageConversationId,
      messageId,
      claimedAt: trustedNow,
      claimFingerprint,
      purgeEligibleAt: null,
      lastErrorCode: null,
    },
  });
  if (claimed.count !== 1) {
    throw new WhatsAppMediaAssetError(
      'El medio fue vinculado o reservado por otra operación.',
      'WHATSAPP_MEDIA_ASSET_CLAIM_CONFLICT',
      409,
    );
  }
  return { mediaAssetId: row.id, status: 'CLAIMED', messageId, replayed: false };
}

function deleteBackoffMs(attemptCount) {
  return Math.min(
    MAX_DELETE_BACKOFF_MS,
    30_000 * (2 ** Math.min(Math.max(Number(attemptCount) - 1, 0), 7)),
  );
}

async function reserveOrphanForDeletion(prisma, row, now) {
  if (row.status === 'CLAIMED' || row.status === 'DELETE_PENDING' || row.status === 'DELETED') {
    return false;
  }
  let reason;
  const where = {
    id: row.id,
    organizationId: row.organizationId,
    projectId: row.projectId,
    status: row.status,
  };
  if (row.status === 'AVAILABLE') {
    if (!row.purgeEligibleAt || row.purgeEligibleAt > now) return false;
    reason = 'WHATSAPP_MEDIA_ASSET_RETENTION_EXPIRED';
    where.purgeEligibleAt = { lte: now };
  } else if (row.status === 'UPLOADING') {
    const leaseExpired = row.uploadLeaseExpiresAt && row.uploadLeaseExpiresAt <= now;
    const backoffExpired = row.nextUploadAttemptAt && row.nextUploadAttemptAt <= now;
    if (!leaseExpired && !backoffExpired) return false;
    reason = 'WHATSAPP_MEDIA_UPLOAD_UNCERTAIN';
    where.uploadAttemptCount = row.uploadAttemptCount;
    where.uploadLeaseToken = row.uploadLeaseToken;
    where.uploadLeaseExpiresAt = row.uploadLeaseExpiresAt;
    where.nextUploadAttemptAt = row.nextUploadAttemptAt;
  } else {
    return false;
  }
  const hashes = deleteHashes(row, reason);
  const changed = await prisma.whatsAppMediaAsset.updateMany({
    where,
    data: {
      status: 'DELETE_PENDING',
      uploadLeaseToken: null,
      uploadLeaseExpiresAt: null,
      nextUploadAttemptAt: null,
      ...hashes,
      deleteRequestedAt: now,
      nextDeleteAttemptAt: now,
      lastErrorCode: reason,
    },
  });
  return changed.count === 1;
}

export async function markWhatsAppMediaAssetDeleted(prisma, {
  scope: rawScope,
  mediaAssetId: rawMediaAssetId,
  deleteLeaseToken: rawDeleteLeaseToken,
  deleteAttemptCount,
  now = new Date(),
}) {
  const scope = tenantScope(rawScope);
  const mediaAssetId = requiredText(rawMediaAssetId, 'mediaAssetId', 190);
  const deleteLeaseToken = requiredText(rawDeleteLeaseToken, 'deleteLeaseToken', 190);
  const trustedNow = validDate(now, 'now');
  const row = await findScopedAsset(prisma, scope, mediaAssetId);
  if (row.status === 'DELETED') return publicAsset(row, { replayed: true });
  if (row.status !== 'DELETE_PENDING') {
    throw new WhatsAppMediaAssetError(
      'El medio no está reservado para eliminación.',
      'WHATSAPP_MEDIA_ASSET_DELETE_STATE_INVALID',
      409,
    );
  }
  const tombstoneSha256 = fingerprint({
    version: 1,
    id: row.id,
    organizationId: row.organizationId,
    projectId: row.projectId,
    provider: row.storageProvider,
    storageLocatorHash: row.storageLocatorHash,
    contentSha256: row.contentSha256,
    deletedAt: trustedNow,
  });
  const changed = await prisma.whatsAppMediaAsset.updateMany({
    where: {
      id: row.id,
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      status: 'DELETE_PENDING',
      deleteLeaseToken,
      deleteAttemptCount,
    },
    data: {
      status: 'DELETED',
      storage: null,
      fileName: null,
      mimeType: null,
      deleteLeaseToken: null,
      deleteLeaseExpiresAt: null,
      nextDeleteAttemptAt: null,
      deletedAt: trustedNow,
      tombstoneSha256,
      lastErrorCode: null,
    },
  });
  if (changed.count !== 1) {
    throw new WhatsAppMediaAssetError(
      'La concesión de eliminación cambió antes del tombstone.',
      'WHATSAPP_MEDIA_ASSET_DELETE_LEASE_LOST',
      409,
    );
  }
  return { mediaAssetId: row.id, status: 'DELETED', replayed: false };
}

export async function markWhatsAppMediaAssetDeleteFailure(prisma, {
  scope: rawScope,
  mediaAssetId: rawMediaAssetId,
  deleteLeaseToken: rawDeleteLeaseToken,
  deleteAttemptCount,
  errorCode = null,
  now = new Date(),
}) {
  const scope = tenantScope(rawScope);
  const mediaAssetId = requiredText(rawMediaAssetId, 'mediaAssetId', 190);
  const deleteLeaseToken = requiredText(rawDeleteLeaseToken, 'deleteLeaseToken', 190);
  const trustedNow = validDate(now, 'now');
  const safeCode = safeErrorCode(errorCode, 'WHATSAPP_MEDIA_ASSET_PROVIDER_DELETE_FAILED');
  const changed = await prisma.whatsAppMediaAsset.updateMany({
    where: {
      id: mediaAssetId,
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      status: 'DELETE_PENDING',
      deleteLeaseToken,
      deleteAttemptCount,
    },
    data: {
      deleteLeaseToken: null,
      deleteLeaseExpiresAt: null,
      nextDeleteAttemptAt: new Date(trustedNow.getTime() + deleteBackoffMs(deleteAttemptCount)),
      lastErrorCode: safeCode,
    },
  });
  if (changed.count !== 1) {
    throw new WhatsAppMediaAssetError(
      'La concesión de eliminación cambió antes de registrar el fallo.',
      'WHATSAPP_MEDIA_ASSET_DELETE_LEASE_LOST',
      409,
    );
  }
  return { mediaAssetId, status: 'DELETE_PENDING', replayed: false };
}

async function attemptOrphanDeletion(prisma, row, {
  now,
  deleteFile,
  deleteTimeoutMs,
  randomUUID,
}) {
  if (row.status !== 'DELETE_PENDING') return { attempted: false, deleted: false, failed: false };
  if (row.nextDeleteAttemptAt && row.nextDeleteAttemptAt > now) {
    return { attempted: false, deleted: false, failed: false };
  }
  if (row.deleteLeaseExpiresAt && row.deleteLeaseExpiresAt > now) {
    return { attempted: false, deleted: false, failed: false };
  }
  const deleteLeaseToken = validUuid(randomUUID(), 'deleteLeaseToken');
  const deleteLeaseExpiresAt = new Date(now.getTime() + WHATSAPP_MEDIA_ASSET_DELETE_LEASE_MS);
  const previousAttempts = Number(row.deleteAttemptCount || 0);
  const acquired = await prisma.whatsAppMediaAsset.updateMany({
    where: {
      id: row.id,
      organizationId: row.organizationId,
      projectId: row.projectId,
      status: 'DELETE_PENDING',
      deleteAttemptCount: previousAttempts,
      deleteLeaseToken: row.deleteLeaseToken || null,
      deleteLeaseExpiresAt: row.deleteLeaseExpiresAt || null,
      deleteOperationKeyHash: row.deleteOperationKeyHash,
      deleteRequestFingerprint: row.deleteRequestFingerprint,
    },
    data: {
      deleteAttemptCount: { increment: 1 },
      deleteLeaseToken,
      deleteLeaseExpiresAt,
    },
  });
  if (acquired.count !== 1) return { attempted: false, deleted: false, failed: false };
  const deleteAttemptCount = previousAttempts + 1;
  const controller = new AbortController();
  let timeout;
  try {
    const storage = storageReference(row.storage, row.sizeBytes);
    assertStorageDescriptor(storage, row);
    const providerDeletion = Promise.resolve().then(() => deleteFile(
      { ...storage, reused: false },
      { signal: controller.signal },
    ));
    const providerTimeout = new Promise((_, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new WhatsAppMediaAssetError(
          'El proveedor no confirmó la eliminación dentro del tiempo permitido.',
          'WHATSAPP_MEDIA_ASSET_PROVIDER_DELETE_TIMEOUT',
          502,
        ));
      }, Math.max(1, Math.trunc(Number(deleteTimeoutMs) || 1)));
    });
    await Promise.race([providerDeletion, providerTimeout]);
    await markWhatsAppMediaAssetDeleted(prisma, {
      scope: row,
      mediaAssetId: row.id,
      deleteLeaseToken,
      deleteAttemptCount,
      now,
    });
    return { attempted: true, deleted: true, failed: false };
  } catch (error) {
    await markWhatsAppMediaAssetDeleteFailure(prisma, {
      scope: row,
      mediaAssetId: row.id,
      deleteLeaseToken,
      deleteAttemptCount,
      errorCode: error?.code,
      now,
    }).catch(() => {});
    return { attempted: true, deleted: false, failed: true };
  } finally {
    clearTimeout(timeout);
  }
}

export async function cleanupWhatsAppMediaAssets(prisma, {
  now = new Date(),
  limit = 50,
  deleteFile = deleteProtectedFile,
  deleteTimeoutMs = WHATSAPP_MEDIA_ASSET_DELETE_TIMEOUT_MS,
  deadlineAt = null,
  clock = () => new Date(),
  randomUUID = nodeRandomUUID,
} = {}) {
  const trustedNow = validDate(now, 'now');
  const take = Math.min(Math.max(Math.trunc(Number(limit) || 1), 1), 100);
  const deadlineMs = deadlineAt == null
    ? Number.POSITIVE_INFINITY
    : validDate(deadlineAt, 'deadlineAt').getTime();
  const remainingBudgetMs = () => deadlineMs - validDate(clock(), 'clock').getTime();
  const hasBudget = () => remainingBudgetMs() > 0;

  const expirable = await prisma.whatsAppMediaAsset.findMany({
    where: {
      webhookEvent: { status: { in: TERMINAL_WEBHOOK_STATUSES } },
      OR: [
        { status: 'AVAILABLE', purgeEligibleAt: { lte: trustedNow } },
        { status: 'UPLOADING', uploadLeaseExpiresAt: { lte: trustedNow } },
        { status: 'UPLOADING', nextUploadAttemptAt: { lte: trustedNow } },
      ],
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take,
  });
  let expiredReserved = 0;
  let uncertainReserved = 0;
  for (const row of expirable) {
    if (!hasBudget()) break;
    if (!await reserveOrphanForDeletion(prisma, row, trustedNow)) continue;
    if (row.status === 'AVAILABLE') expiredReserved += 1;
    if (row.status === 'UPLOADING') uncertainReserved += 1;
  }

  const pending = hasBudget()
    ? await prisma.whatsAppMediaAsset.findMany({
        where: {
          status: 'DELETE_PENDING',
          webhookEvent: { status: { in: TERMINAL_WEBHOOK_STATUSES } },
          nextDeleteAttemptAt: { lte: trustedNow },
          OR: [
            { deleteLeaseExpiresAt: null },
            { deleteLeaseExpiresAt: { lte: trustedNow } },
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
    const result = await attemptOrphanDeletion(prisma, row, {
      now: trustedNow,
      deleteFile,
      deleteTimeoutMs: Math.min(
        Math.max(1, remainingBudgetMs()),
        Math.max(1, Math.trunc(Number(deleteTimeoutMs) || 1)),
      ),
      randomUUID,
    });
    if (!result.attempted) continue;
    scanned += 1;
    if (result.deleted) deleted += 1;
    if (result.failed) failed += 1;
  }

  const [moreExpirable, morePending] = await Promise.all([
    prisma.whatsAppMediaAsset.findFirst({
      where: {
        webhookEvent: { status: { in: TERMINAL_WEBHOOK_STATUSES } },
        OR: [
          { status: 'AVAILABLE', purgeEligibleAt: { lte: trustedNow } },
          { status: 'UPLOADING', uploadLeaseExpiresAt: { lte: trustedNow } },
          { status: 'UPLOADING', nextUploadAttemptAt: { lte: trustedNow } },
        ],
      },
      select: { id: true },
    }),
    prisma.whatsAppMediaAsset.findFirst({
      where: {
        status: 'DELETE_PENDING',
        webhookEvent: { status: { in: TERMINAL_WEBHOOK_STATUSES } },
        nextDeleteAttemptAt: { lte: trustedNow },
        OR: [
          { deleteLeaseExpiresAt: null },
          { deleteLeaseExpiresAt: { lte: trustedNow } },
        ],
      },
      select: { id: true },
    }),
  ]);
  return {
    expiredReserved,
    uncertainReserved,
    scanned,
    deleted,
    failed,
    hasMore: Boolean(moreExpirable || morePending),
  };
}

export function whatsAppMediaAssetErrorResponse(error) {
  if (!(error instanceof WhatsAppMediaAssetError)) return null;
  return {
    status: error.status,
    body: {
      error: error.message,
      code: error.code,
      ...(error.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {}),
    },
  };
}

export function claimedWhatsAppMediaAssetDescriptor(row, {
  scope: rawScope = row,
} = {}) {
  if (!row || row.status !== 'CLAIMED') {
    throw new WhatsAppMediaAssetError(
      'El activo durable no está vinculado al mensaje.',
      'WHATSAPP_MEDIA_ASSET_NOT_CLAIMED',
      409,
    );
  }
  return whatsAppMediaAssetDescriptor(row, { scope: rawScope });
}

export function resolveClaimedWhatsAppMessageMedia(message, {
  scope: rawScope = message?.whatsappMediaAsset,
} = {}) {
  if (!message || !Object.hasOwn(message, 'whatsappMediaAsset')) {
    throw new WhatsAppMediaAssetError(
      'La consulta no incluyó la relación durable del medio.',
      'WHATSAPP_MEDIA_ASSET_RELATION_REQUIRED',
      500,
    );
  }
  const row = message.whatsappMediaAsset;
  if (row === null) return null;
  const descriptor = claimedWhatsAppMediaAssetDescriptor(row, { scope: rawScope });
  if (
    row.messageId !== message.id
    || row.messageConversationId !== message.conversationId
    || String(message.direction || '').toUpperCase() !== 'INBOUND'
    || String(message.kind || '').toUpperCase() !== row.mediaKind
    || row.providerMessageIdHash !== whatsAppMediaAssetHash(message.externalId || '')
  ) {
    throw new WhatsAppMediaAssetError(
      'El activo durable no coincide con su mensaje de origen.',
      'WHATSAPP_MEDIA_ASSET_MESSAGE_SCOPE_MISMATCH',
      409,
    );
  }
  return {
    managed: true,
    asset: row,
    descriptor,
  };
}

export function whatsAppMediaAssetDescriptor(row, {
  scope: rawScope = row,
} = {}) {
  const scope = tenantScope(rawScope);
  if (!row || (row.status !== 'AVAILABLE' && row.status !== 'CLAIMED')) {
    throw new WhatsAppMediaAssetError(
      'El activo durable no está disponible para lectura.',
      'WHATSAPP_MEDIA_ASSET_NOT_AVAILABLE',
      409,
    );
  }
  assertAssetScope(row, scope);
  const fileName = normalizedFileName(row.fileName);
  const mimeType = normalizedMimeType(row.mimeType);
  if (
    mimeType !== row.declaredMimeType
    || !SHA256_PATTERN.test(String(row.contentSha256 || ''))
    || !Number.isSafeInteger(row.sizeBytes)
    || row.sizeBytes < 1
    || (
      row.status === 'CLAIMED'
      && (
        !SHA256_PATTERN.test(String(row.claimFingerprint || ''))
        || !row.messageConversationId
        || !row.messageId
      )
    )
  ) {
    throw new WhatsAppMediaAssetError(
      'El descriptor durable vinculado está corrupto.',
      'WHATSAPP_MEDIA_ASSET_DESCRIPTOR_INVALID',
      500,
    );
  }
  const storage = storageReference(row.storage, row.sizeBytes);
  assertStorageDescriptor(storage, row);
  const url = durableDeliveryUrl(row, storage);
  return {
    assetId: row.id,
    provider: row.storageProvider,
    storage,
    url,
    visibility: 'private',
    mimeType,
    filename: fileName,
    size: row.sizeBytes,
    sha256: row.contentSha256,
  };
}
