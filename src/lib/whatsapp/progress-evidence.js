import { createHash } from 'node:crypto';
import { isMedicalEvidenceRecord } from '../medical-privacy.js';
import { subscriptionAllowsWrites } from '../plans.js';
import { runOperationalProjectMutation } from '../project-write-policy.js';
import { serializeProgressEvidence } from '../progress-journal.js';
import { isEnrichedInboundWhatsAppMediaEvent } from './media.js';

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const SAFE_CORRELATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_STORAGE_PROVIDERS = new Set(['cloudinary', 'vercel-blob']);
const SOURCE_CONVERSATION_PREFIX = 'meta:';
const SOURCE_CONTRACT_VERSION = 'whatsapp-progress-evidence:v1';

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

function sourceRequestFingerprint({ scope, conversationId, message, taskId, workerId, media, caption }) {
  return sha256(`${SOURCE_CONTRACT_VERSION}:request`, {
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
  });
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

function validateSourceMessage(message) {
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
    media: canonicalPrivateMedia(message),
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
      },
    });
    if (!message) throw sourceNotFound();

    const source = validateSourceMessage(message);
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

    const fingerprint = sourceRequestFingerprint({
      scope: context.scope,
      conversationId: context.conversationId,
      message,
      taskId: task.id,
      workerId: worker.id,
      media: source.media,
      caption: source.caption,
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
        status: 'PENDING',
      },
    });
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
