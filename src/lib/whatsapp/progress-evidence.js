import { createHash } from 'node:crypto';
import { isMedicalEvidenceRecord } from '../medical-privacy.js';
import { isWhatsAppProgressMediaForProject } from '../private-receipts.js';
import { subscriptionAllowsWrites } from '../plans.js';
import { runOperationalProjectMutation } from '../project-write-policy.js';
import { serializeProgressEvidence } from '../progress-journal.js';
import {
  PROGRESS_EVIDENCE_LOCATION_FUTURE_SKEW_MS,
  PROGRESS_EVIDENCE_LOCATION_MAX_AGE_MS,
} from '../progress-evidence-capture-sessions.js';
import { isEnrichedInboundWhatsAppMediaEvent } from './media.js';
import {
  resolveClaimedWhatsAppMessageMedia,
  WHATSAPP_MEDIA_ASSET_DESCRIPTOR_SELECT,
} from './media-assets.js';

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const SAFE_CORRELATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_STORAGE_PROVIDERS = new Set(['cloudinary', 'vercel-blob']);
const SOURCE_CONVERSATION_PREFIX = 'meta:';
const SOURCE_CONTRACT_VERSION = 'whatsapp-progress-evidence:v1';
const MANAGED_SOURCE_CONTRACT_VERSION = 'whatsapp-progress-evidence:v2';
const MAX_PROGRESS_IMAGE_BYTES = 20 * 1024 * 1024;

export class WhatsAppProgressEvidenceError extends Error {
  constructor(message, {
    code = 'WHATSAPP_PROGRESS_EVIDENCE_INVALID',
    status = 400,
  } = {}) {
    super(message);
    this.name = 'WhatsAppProgressEvidenceError';
    this.code = code;
    this.status = status;
  }
}

function requiredText(value, field, maxLength = 190) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > maxLength) {
    throw new WhatsAppProgressEvidenceError(`${field} no es válido.`, {
      code: 'WHATSAPP_PROGRESS_EVIDENCE_INPUT_INVALID',
    });
  }
  return normalized;
}

function trustedScope(scope) {
  return {
    organizationId: requiredText(scope?.organizationId, 'organizationId'),
    projectId: requiredText(scope?.projectId, 'projectId'),
  };
}

function normalizedIdempotencyKey(value) {
  const key = typeof value === 'string' ? value.trim() : '';
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw new WhatsAppProgressEvidenceError(
      'La operación requiere una clave de idempotencia válida.',
      { code: 'IDEMPOTENCY_KEY_INVALID' },
    );
  }
  return key;
}

function normalizedCorrelationId(value) {
  const correlationId = typeof value === 'string' ? value.trim() : '';
  return SAFE_CORRELATION_ID_PATTERN.test(correlationId) ? correlationId : null;
}

function jsonObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function sha256(domain, value) {
  return createHash('sha256')
    .update(domain)
    .update('\0')
    .update(JSON.stringify(value))
    .digest('hex');
}

function sourceOperationKeyHash(scope, idempotencyKey) {
  return sha256(`${SOURCE_CONTRACT_VERSION}:operation`, [
    scope.organizationId,
    scope.projectId,
    idempotencyKey,
  ]);
}

function sourceRequestFingerprint({
  scope,
  conversationId,
  message,
  taskId,
  workerId,
  media,
  caption,
  locationCaptureContext,
}) {
  const payload = {
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    conversationId,
    sourceMessageId: message.id,
    sourceExternalId: message.externalId || null,
    taskId,
    workerId,
    capturedAt: message.sentAt.toISOString(),
    captionSha256: sha256(`${SOURCE_CONTRACT_VERSION}:caption`, caption || ''),
    mediaSha256: media.sha256,
  };
  if (media.assetId) {
    payload.mediaAssetId = media.assetId;
    payload.mediaSchemaVersion = media.schemaVersion;
  }
  if (locationCaptureContext) {
    const { session, location } = locationCaptureContext;
    payload.locationCapture = location
      ? {
          sessionId: session.id,
          requestFingerprint: location.requestFingerprint,
          capturedAt: location.locationCapturedAt.toISOString(),
          source: location.locationSource,
          verification: location.locationVerification,
          latitude: decimalText(location.latitude),
          longitude: decimalText(location.longitude),
          accuracyMeters: decimalText(location.accuracyMeters),
        }
      : {
          sessionId: session.id,
          status: session.status,
        };
  }
  return sha256(
    `${media.assetId ? MANAGED_SOURCE_CONTRACT_VERSION : SOURCE_CONTRACT_VERSION}:request${
      locationCaptureContext ? ':location-v1' : ''
    }`,
    payload,
  );
}

function decimalText(value) {
  if (value === null || value === undefined) return null;
  const normalized = value?.toString?.() ?? String(value);
  return normalized === '' ? null : normalized;
}

function validDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function completeLocationCapture(session, expected) {
  if (!session) return null;
  if (
    session.organizationId !== expected.scope.organizationId
    || session.projectId !== expected.scope.projectId
    || session.workerId !== expected.workerId
    || session.mediaAssetId !== expected.mediaAssetId
  ) {
    throw invalidSource('La captura de ubicación no pertenece a la foto o al operario de origen.');
  }

  if (session.status === 'AWAITING_LOCATION') {
    const expiresAt = validDate(session.expiresAt);
    if (!expiresAt) {
      throw invalidSource('La captura de ubicación pendiente no tiene un vencimiento confiable.');
    }
    if (expiresAt && expiresAt.getTime() > expected.now.getTime()) {
      throw new WhatsAppProgressEvidenceError(
        'La foto espera que el operario confirme una lectura puntual de ubicación.',
        {
          code: 'WHATSAPP_PROGRESS_EVIDENCE_LOCATION_PENDING',
          status: 409,
        },
      );
    }
    return null;
  }
  if (['EXPIRED', 'CANCELLED'].includes(session.status)) return null;
  if (!['LOCATION_CAPTURED', 'CONSUMED'].includes(session.status)) {
    throw invalidSource('La captura de ubicación tiene un estado incompatible.');
  }

  const locationCapturedAt = validDate(session.locationCapturedAt);
  const locationReceivedAt = validDate(session.locationReceivedAt);
  const privacyAcceptedAt = validDate(session.privacyAcceptedAt);
  const issuedAt = validDate(session.issuedAt);
  const expiresAt = validDate(session.expiresAt);
  const latitude = Number(session.latitude);
  const longitude = Number(session.longitude);
  const accuracyMeters = Number(session.accuracyMeters);
  if (
    !locationCapturedAt
    || !locationReceivedAt
    || !privacyAcceptedAt
    || !issuedAt
    || !expiresAt
    || locationReceivedAt.getTime() - locationCapturedAt.getTime()
      > PROGRESS_EVIDENCE_LOCATION_MAX_AGE_MS
    || locationCapturedAt.getTime() - locationReceivedAt.getTime()
      > PROGRESS_EVIDENCE_LOCATION_FUTURE_SKEW_MS
    || locationReceivedAt.getTime() < issuedAt.getTime()
    || privacyAcceptedAt.getTime() > locationReceivedAt.getTime()
    || locationReceivedAt.getTime() > expiresAt.getTime()
    || typeof session.privacyNoticeVersion !== 'string'
    || !session.privacyNoticeVersion.trim()
    || !SHA256_PATTERN.test(String(session.privacyNoticeContentSha256 || '').toLowerCase())
    || session.latitude === null
    || session.latitude === undefined
    || !Number.isFinite(latitude)
    || latitude < -90
    || latitude > 90
    || session.longitude === null
    || session.longitude === undefined
    || !Number.isFinite(longitude)
    || longitude < -180
    || longitude > 180
    || session.accuracyMeters === null
    || session.accuracyMeters === undefined
    || !Number.isFinite(accuracyMeters)
    || accuracyMeters <= 0
    || session.locationSource !== 'WEBVIEW_GEOLOCATION'
    || !['IN_GEOFENCE', 'REVIEW_REQUIRED'].includes(session.locationVerification)
    || !SHA256_PATTERN.test(String(session.requestFingerprint || '').toLowerCase())
  ) {
    throw invalidSource('La captura de ubicación está incompleta o no es verificable.');
  }
  return {
    ...session,
    locationCapturedAt,
    locationReceivedAt,
    privacyAcceptedAt,
    latitude,
    longitude,
    accuracyMeters,
  };
}

async function locationCaptureForSource(transaction, {
  scope,
  workerId,
  mediaAssetId,
  now,
}) {
  if (!mediaAssetId || !transaction.progressEvidenceCaptureSession?.findFirst) return null;
  const session = await transaction.progressEvidenceCaptureSession.findFirst({
    where: {
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      workerId,
      mediaAssetId,
    },
  });
  if (!session) return null;
  if (session.status === 'AWAITING_LOCATION') {
    const expiresAt = validDate(session.expiresAt);
    if (expiresAt && expiresAt.getTime() <= now.getTime()) {
      const expired = await transaction.progressEvidenceCaptureSession.updateMany({
        where: {
          id: session.id,
          projectId: scope.projectId,
          status: 'AWAITING_LOCATION',
          revision: session.revision,
        },
        data: {
          status: 'EXPIRED',
          expiredAt: now,
          revision: { increment: 1 },
        },
      });
      if (expired.count === 1) {
        const expiredSession = {
          ...session,
          status: 'EXPIRED',
          expiredAt: now,
          revision: session.revision + 1,
        };
        return { session: expiredSession, location: null };
      }
      const current = await transaction.progressEvidenceCaptureSession.findFirst({
        where: {
          id: session.id,
          organizationId: scope.organizationId,
          projectId: scope.projectId,
          workerId,
          mediaAssetId,
        },
      });
      if (!current) throw invalidSource('La captura de ubicación dejó de estar disponible.');
      const location = completeLocationCapture(current, {
        scope,
        workerId,
        mediaAssetId,
        now,
      });
      return { session: current, location };
    }
  }
  const location = completeLocationCapture(session, {
    scope,
    workerId,
    mediaAssetId,
    now,
  });
  return { session, location };
}

function accuracyBand(accuracyMeters) {
  if (!Number.isFinite(accuracyMeters)) return null;
  if (accuracyMeters <= 15) return 'LE_15M';
  if (accuracyMeters <= 50) return 'LE_50M';
  if (accuracyMeters <= 100) return 'LE_100M';
  return 'GT_100M';
}

function sourceNotFound() {
  return new WhatsAppProgressEvidenceError(
    'La evidencia solicitada no está disponible.',
    { code: 'WHATSAPP_PROGRESS_EVIDENCE_NOT_FOUND', status: 404 },
  );
}

function invalidSource(message) {
  return new WhatsAppProgressEvidenceError(message, {
    code: 'WHATSAPP_PROGRESS_EVIDENCE_SOURCE_INVALID',
    status: 422,
  });
}

function canonicalCaption(body) {
  const caption = typeof body === 'string' ? body.trim() : '';
  if (!caption || /^\[image\]$/i.test(caption)) return null;
  if (caption.length > 2_000) {
    throw invalidSource('El comentario original de la foto supera el límite permitido.');
  }
  return caption;
}

function canonicalPrivateMedia(message) {
  const metadata = jsonObject(message.metadata);
  const media = jsonObject(metadata.media);
  const storage = jsonObject(media.storage);
  const event = { kind: 'image', media };
  if (
    !isEnrichedInboundWhatsAppMediaEvent(event)
    || !ALLOWED_IMAGE_MIME_TYPES.has(media.mimeType)
    || !ALLOWED_STORAGE_PROVIDERS.has(storage.provider)
    || !SHA256_PATTERN.test(String(media.sha256 || '').toLowerCase())
    || message.mediaUrl !== media.url
  ) {
    throw invalidSource('La foto todavía no tiene una referencia privada verificada.');
  }
  return {
    schemaVersion: 1,
    source: 'whatsapp-message',
    kind: 'image',
    mimeType: media.mimeType,
    filename: String(media.filename).slice(0, 255),
    size: media.size,
    sha256: String(media.sha256).toLowerCase(),
  };
}

function canonicalManagedPrivateMedia(message, scope) {
  let managed;
  try {
    managed = resolveClaimedWhatsAppMessageMedia(message, { scope });
  } catch {
    throw invalidSource('El activo durable de la foto no coincide con su mensaje de origen.');
  }
  if (managed === null) return null;
  const { asset, descriptor } = managed;
  if (
    asset.mediaKind !== 'IMAGE'
    || !ALLOWED_IMAGE_MIME_TYPES.has(descriptor.mimeType)
    || !ALLOWED_STORAGE_PROVIDERS.has(descriptor.provider)
    || !SHA256_PATTERN.test(String(descriptor.sha256 || '').toLowerCase())
    || !Number.isSafeInteger(descriptor.size)
    || descriptor.size < 1
    || descriptor.size > MAX_PROGRESS_IMAGE_BYTES
    || descriptor.assetId !== asset.id
  ) {
    throw invalidSource('El activo durable no contiene una foto privada operativa válida.');
  }
  return {
    schemaVersion: 2,
    source: 'whatsapp-media-asset',
    assetId: descriptor.assetId,
    kind: 'image',
    mimeType: descriptor.mimeType,
    filename: descriptor.filename,
    size: descriptor.size,
    sha256: String(descriptor.sha256).toLowerCase(),
  };
}

function validateSourceMessage(message, scope) {
  const metadata = jsonObject(message.metadata);
  if (
    message.direction !== 'INBOUND'
    || message.kind !== 'IMAGE'
    || metadata.provider !== 'meta'
    || metadata.authorized !== true
    || metadata.quarantined === true
    || message.conversation?.channel !== 'whatsapp'
    || !String(message.conversation?.externalId || '').startsWith(SOURCE_CONVERSATION_PREFIX)
  ) {
    throw invalidSource('El mensaje no es una foto operativa autorizada de Meta.');
  }
  if (isMedicalEvidenceRecord(message)) {
    throw new WhatsAppProgressEvidenceError(
      'La evidencia médica no puede incorporarse a la bitácora operativa.',
      { code: 'WHATSAPP_PROGRESS_EVIDENCE_MEDICAL_RESTRICTED', status: 409 },
    );
  }
  const workerId = requiredText(metadata.workerId, 'workerId');
  const sentAt = message.sentAt instanceof Date ? message.sentAt : new Date(message.sentAt);
  if (Number.isNaN(sentAt.getTime())) {
    throw invalidSource('El mensaje no tiene una fecha de captura confiable.');
  }
  return {
    workerId,
    sentAt,
    caption: canonicalCaption(message.body),
    media: canonicalManagedPrivateMedia(message, scope) || canonicalPrivateMedia(message),
  };
}

function exactReplay(existing, expected) {
  return existing
    && existing.projectId === expected.projectId
    && existing.taskId === expected.taskId
    && existing.authorWorkerId === expected.workerId
    && existing.sourceConversationId === expected.conversationId
    && existing.sourceMessageId === expected.messageId
    && existing.sourceRequestFingerprint === expected.fingerprint;
}

function replayOrThrow(existing, expected) {
  if (exactReplay(existing, expected)) {
    return {
      evidence: serializeProgressEvidence(existing, { includeSourceEvidence: true }),
      replayed: true,
    };
  }
  throw new WhatsAppProgressEvidenceError(
    'La clave de idempotencia o la foto ya fue utilizada con otra vinculación.',
    { code: 'IDEMPOTENCY_PAYLOAD_MISMATCH', status: 409 },
  );
}

async function readExistingEvidence(transaction, {
  scope,
  operationKeyHash,
  sourceMessageId,
}) {
  const [byOperation, bySource] = await Promise.all([
    transaction.progressEvidence.findFirst({
      where: {
        projectId: scope.projectId,
        sourceOperationKeyHash: operationKeyHash,
      },
    }),
    transaction.progressEvidence.findUnique({
      where: { sourceMessageId },
    }),
  ]);
  if (bySource && bySource.projectId !== scope.projectId) throw sourceNotFound();
  return byOperation || bySource || null;
}

async function executeLink(prisma, context) {
  return runOperationalProjectMutation(prisma, context.scope, async (transaction) => {
    const organization = await transaction.organization.findUnique({
      where: { id: context.scope.organizationId },
      select: {
        id: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        trialEndsAt: true,
      },
    });
    if (!organization || !subscriptionAllowsWrites(organization, context.now)) {
      throw new WhatsAppProgressEvidenceError(
        'La suscripción activa no permite guardar nueva evidencia.',
        { code: 'SUBSCRIPTION_READ_ONLY', status: 402 },
      );
    }

    const message = await transaction.message.findFirst({
      where: {
        id: context.messageId,
        conversationId: context.conversationId,
        conversation: {
          projectId: context.scope.projectId,
          project: { organizationId: context.scope.organizationId },
        },
      },
      select: {
        id: true,
        externalId: true,
        conversationId: true,
        direction: true,
        kind: true,
        body: true,
        mediaUrl: true,
        metadata: true,
        sentAt: true,
        createdAt: true,
        conversation: {
          select: {
            id: true,
            projectId: true,
            channel: true,
            externalId: true,
          },
        },
        whatsappMediaAsset: {
          select: WHATSAPP_MEDIA_ASSET_DESCRIPTOR_SELECT,
        },
      },
    });
    if (!message) throw sourceNotFound();

    const source = validateSourceMessage(message, context.scope);
    if (source.media.schemaVersion === 1) {
      const connection = await transaction.whatsAppConnection.findFirst({
        where: { projectId: context.scope.projectId, enabled: true },
        select: { projectId: true, phoneNumberId: true, enabled: true },
      });
      if (!isWhatsAppProgressMediaForProject({
        media: source.media,
        sourceMessage: message,
        connection,
        projectId: context.scope.projectId,
      })) {
        throw invalidSource('La foto privada no pertenece a la conexión Meta de esta obra.');
      }
    }
    message.sentAt = source.sentAt;

    const task = await transaction.task.findFirst({
      where: { id: context.taskId, projectId: context.scope.projectId },
      select: { id: true },
    });
    if (!task) {
      throw new WhatsAppProgressEvidenceError(
        'La tarea solicitada no está disponible.',
        { code: 'WHATSAPP_PROGRESS_EVIDENCE_TASK_NOT_FOUND', status: 404 },
      );
    }

    const worker = await transaction.worker.findFirst({
      where: { id: source.workerId, projectId: context.scope.projectId },
      select: { id: true },
    });
    if (!worker) throw invalidSource('El autor original ya no pertenece a esta obra.');

    const locationCaptureContext = await locationCaptureForSource(transaction, {
      scope: context.scope,
      workerId: worker.id,
      mediaAssetId: source.media.assetId || null,
      now: context.now,
    });
    const locationCapture = locationCaptureContext?.location || null;

    const fingerprint = sourceRequestFingerprint({
      scope: context.scope,
      conversationId: context.conversationId,
      message,
      taskId: task.id,
      workerId: worker.id,
      media: source.media,
      caption: source.caption,
      locationCaptureContext,
    });
    const replayIdentity = {
      projectId: context.scope.projectId,
      taskId: task.id,
      workerId: worker.id,
      conversationId: context.conversationId,
      messageId: message.id,
      fingerprint,
    };
    const existing = await readExistingEvidence(transaction, {
      scope: context.scope,
      operationKeyHash: context.operationKeyHash,
      sourceMessageId: message.id,
    });
    if (existing) return replayOrThrow(existing, replayIdentity);
    if (locationCapture?.status === 'CONSUMED') {
      throw invalidSource('La captura de ubicación ya fue consumida por otra operación.');
    }

    const evidence = await transaction.progressEvidence.create({
      data: {
        projectId: context.scope.projectId,
        taskId: task.id,
        authorWorkerId: worker.id,
        sourceConversationId: context.conversationId,
        sourceMessageId: message.id,
        sourceOperationKeyHash: context.operationKeyHash,
        sourceRequestFingerprint: fingerprint,
        capturedAt: source.sentAt,
        caption: source.caption,
        media: source.media,
        ...(locationCapture
          ? {
              locationCaptureSessionId: locationCapture.id,
              locationCapturedAt: locationCapture.locationCapturedAt,
              locationSource: locationCapture.locationSource,
              locationVerification: locationCapture.locationVerification,
              latitude: locationCapture.latitude,
              longitude: locationCapture.longitude,
              accuracyMeters: locationCapture.accuracyMeters,
            }
          : {}),
        status: 'PENDING',
      },
    });
    if (locationCapture) {
      const consumed = await transaction.progressEvidenceCaptureSession.updateMany({
        where: {
          id: locationCapture.id,
          projectId: context.scope.projectId,
          status: 'LOCATION_CAPTURED',
          revision: locationCapture.revision,
        },
        data: {
          status: 'CONSUMED',
          consumedAt: context.now,
          revision: { increment: 1 },
        },
      });
      if (consumed.count !== 1) {
        throw new WhatsAppProgressEvidenceError(
          'La ubicación cambió mientras se vinculaba la foto. Reintentá la operación.',
          {
            code: 'WHATSAPP_PROGRESS_EVIDENCE_LOCATION_CONFLICT',
            status: 409,
          },
        );
      }
    }
    await transaction.auditLog.create({
      data: {
        organizationId: context.scope.organizationId,
        actorId: context.actorId,
        action: 'progress.evidence.linked_from_whatsapp',
        entityType: 'ProgressEvidence',
        entityId: evidence.id,
        metadata: {
          projectId: context.scope.projectId,
          taskId: task.id,
          workerId: worker.id,
          conversationId: context.conversationId,
          sourceMessageId: message.id,
          sourceOperationKeyHash: context.operationKeyHash,
          sourceRequestFingerprint: fingerprint,
          mediaSha256: source.media.sha256,
          ...(source.media.assetId ? { mediaAssetId: source.media.assetId } : {}),
          ...(locationCaptureContext
            ? {
                locationCaptureSessionId: locationCaptureContext.session.id,
                locationCaptureStatus: locationCaptureContext.session.status,
                ...(locationCapture
                  ? {
                      locationSource: locationCapture.locationSource,
                      locationVerification: locationCapture.locationVerification,
                      locationAccuracyBand: accuracyBand(locationCapture.accuracyMeters),
                      locationCapturedAt: locationCapture.locationCapturedAt.toISOString(),
                    }
                  : {}),
              }
            : {}),
          ...(context.correlationId ? { correlationId: context.correlationId } : {}),
        },
      },
    });
    return {
      evidence: serializeProgressEvidence(evidence, { includeSourceEvidence: true }),
      replayed: false,
    };
  });
}

export async function linkWhatsAppMessageToProgressEvidence(prisma, {
  scope: rawScope,
  actorId,
  conversationId,
  messageId,
  taskId,
  idempotencyKey,
  correlationId = null,
  clock = () => new Date(),
}) {
  const scope = trustedScope(rawScope);
  const normalizedActorId = requiredText(actorId, 'actorId');
  const normalizedConversationId = requiredText(conversationId, 'conversationId');
  const normalizedMessageId = requiredText(messageId, 'messageId');
  const normalizedTaskId = requiredText(taskId, 'taskId');
  const normalizedKey = normalizedIdempotencyKey(idempotencyKey);
  const now = clock();
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('clock must return a valid Date.');
  }
  const context = {
    scope,
    actorId: normalizedActorId,
    conversationId: normalizedConversationId,
    messageId: normalizedMessageId,
    taskId: normalizedTaskId,
    operationKeyHash: sourceOperationKeyHash(scope, normalizedKey),
    correlationId: normalizedCorrelationId(correlationId),
    now,
  };
  try {
    return await executeLink(prisma, context);
  } catch (error) {
    if (error?.code !== 'P2002') throw error;
    return executeLink(prisma, context);
  }
}

export function whatsAppProgressEvidenceErrorResponse(error) {
  if (!(error instanceof WhatsAppProgressEvidenceError)) return null;
  return Response.json(
    { error: error.message, code: error.code },
    { status: error.status, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
  );
}
