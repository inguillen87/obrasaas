import crypto from 'node:crypto';

import { createAuditLog } from '../audit-log.js';
import { generateWebviewToken } from '../auth.js';
import {
  FIELD_WORKER_RESOLUTION,
  resolveActiveFieldWorkerByPhone,
} from '../field-workers.js';
import { assertOrganizationSubscriptionAllowsWrites } from '../plans.js';
import {
  buildProgressEvidenceLocationLink,
  PROGRESS_EVIDENCE_CAPTURE_TOKEN_PURPOSE,
  PROGRESS_EVIDENCE_LOCATION_NOTICE_CONTENT_SHA256,
  PROGRESS_EVIDENCE_LOCATION_NOTICE_VERSION,
} from '../progress-evidence-capture-sessions.js';

export const PROGRESS_EVIDENCE_LOCATION_DELIVERY_MIN_REMAINING_MS = 5 * 60 * 1_000;

export const PROGRESS_EVIDENCE_LOCATION_DURABLE_REPLY = [
  'Foto de avance recibida de forma privada.',
  'La opción personal para adjuntar una geolocalización reportada por el dispositivo se gestiona sólo en WhatsApp y su credencial no se muestra en el panel.',
  'La foto se conserva aunque esa opción venza o no sea utilizada.',
].join('\n');

export const PROGRESS_EVIDENCE_LOCATION_STALE_FALLBACK_REPLY = [
  'Foto de avance recibida de forma privada.',
  'La ventana para adjuntar una geolocalización reportada por el dispositivo ya no está disponible.',
  'La foto se conserva y puede vincularse a una tarea sin ubicación. Esto no registra asistencia ni afecta el presentismo.',
].join('\n');

const DELIVERY_FIELDS = new Set(['descriptor', 'scope', 'recipientPhone', 'eventId']);
const DESCRIPTOR_FIELDS = new Set(['version', 'sessionId']);
const SCOPE_FIELDS = new Set(['organizationId', 'projectId', 'phoneNumberId']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export class ProgressEvidenceLocationDeliveryError extends Error {
  constructor(message, code = 'PROGRESS_EVIDENCE_LOCATION_DELIVERY_INVALID', cause = null) {
    super(message, cause ? { cause } : undefined);
    this.name = 'ProgressEvidenceLocationDeliveryError';
    this.code = code;
  }
}

function deliveryError(message, code, cause = null) {
  return new ProgressEvidenceLocationDeliveryError(message, code, cause);
}

function objectInput(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw deliveryError(
      `${field} is invalid.`,
      'PROGRESS_EVIDENCE_LOCATION_DELIVERY_INPUT_INVALID',
    );
  }
  return value;
}

function rejectUnknownFields(value, fields, field) {
  const unknown = Object.keys(value).filter((key) => !fields.has(key));
  if (unknown.length > 0) {
    throw deliveryError(
      `${field} contains unsupported fields.`,
      'PROGRESS_EVIDENCE_LOCATION_DELIVERY_INPUT_INVALID',
    );
  }
}

function identifier(value, field) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (
    !normalized
    || normalized !== value
    || normalized.length > 190
    || /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    throw deliveryError(
      `${field} is invalid.`,
      'PROGRESS_EVIDENCE_LOCATION_DELIVERY_INPUT_INVALID',
    );
  }
  return normalized;
}

function normalizedInput(rawInput) {
  const input = objectInput(rawInput, 'input');
  rejectUnknownFields(input, DELIVERY_FIELDS, 'input');
  const descriptor = objectInput(input.descriptor, 'descriptor');
  rejectUnknownFields(descriptor, DESCRIPTOR_FIELDS, 'descriptor');
  const sessionId = typeof descriptor.sessionId === 'string'
    ? descriptor.sessionId.trim().toLowerCase()
    : '';
  if (descriptor.version !== 1 || !UUID_PATTERN.test(sessionId)) {
    throw deliveryError(
      'The progress-evidence delivery descriptor is invalid.',
      'PROGRESS_EVIDENCE_LOCATION_DELIVERY_DESCRIPTOR_INVALID',
    );
  }
  const scope = objectInput(input.scope, 'scope');
  rejectUnknownFields(scope, SCOPE_FIELDS, 'scope');
  const eventId = identifier(input.eventId, 'eventId');
  return {
    descriptor: { version: 1, sessionId },
    scope: {
      organizationId: identifier(scope.organizationId, 'organizationId'),
      projectId: identifier(scope.projectId, 'projectId'),
      phoneNumberId: identifier(scope.phoneNumberId, 'phoneNumberId'),
    },
    recipientPhone: identifier(input.recipientPhone, 'recipientPhone'),
    eventId,
  };
}

function currentDate(deps) {
  const configured = typeof deps.clock === 'function'
    ? deps.clock()
    : deps.now ?? Date.now();
  const now = configured instanceof Date ? new Date(configured.getTime()) : new Date(configured);
  if (!Number.isFinite(now.getTime())) {
    throw deliveryError(
      'The progress-evidence delivery clock is unavailable.',
      'PROGRESS_EVIDENCE_LOCATION_DELIVERY_CONFIGURATION_INVALID',
    );
  }
  return now;
}

function minimumRemainingMilliseconds(deps) {
  const value = deps.minimumRemainingMs
    ?? PROGRESS_EVIDENCE_LOCATION_DELIVERY_MIN_REMAINING_MS;
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw deliveryError(
      'The minimum link validity is invalid.',
      'PROGRESS_EVIDENCE_LOCATION_DELIVERY_CONFIGURATION_INVALID',
    );
  }
  return value;
}

function assertPrisma(prisma) {
  if (
    !prisma
    || typeof prisma.progressEvidenceCaptureSession?.findFirst !== 'function'
    || typeof prisma.progressEvidenceCaptureSession?.updateMany !== 'function'
    || typeof prisma.project?.findFirst !== 'function'
    || typeof prisma.whatsAppConnection?.findFirst !== 'function'
    || typeof prisma.whatsAppMediaAsset?.findFirst !== 'function'
  ) {
    throw deliveryError(
      'The progress-evidence delivery store is unavailable.',
      'PROGRESS_EVIDENCE_LOCATION_DELIVERY_CONFIGURATION_INVALID',
    );
  }
}

async function runSerializable(prisma, operation) {
  if (typeof prisma.$transaction !== 'function') return operation(prisma);
  return prisma.$transaction(operation, { isolationLevel: 'Serializable' });
}

function safeHashEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length
    && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function reconstructToken(session, deps) {
  const issuedAt = new Date(session.issuedAt);
  const expiresAt = new Date(session.expiresAt);
  const ttlMilliseconds = expiresAt.getTime() - issuedAt.getTime();
  if (
    !Number.isFinite(issuedAt.getTime())
    || !Number.isFinite(expiresAt.getTime())
    || ttlMilliseconds <= 0
    || ttlMilliseconds % 1_000 !== 0
    || !SHA256_PATTERN.test(String(session.tokenHash || ''))
  ) {
    throw deliveryError(
      'The persisted capture session cannot reconstruct its access token.',
      'PROGRESS_EVIDENCE_LOCATION_DELIVERY_CONFIGURATION_INVALID',
    );
  }
  let token;
  try {
    const generator = deps.generateWebviewToken ?? generateWebviewToken;
    token = generator(session.workerId, {
      now: issuedAt.getTime(),
      ttlSeconds: ttlMilliseconds / 1_000,
      purpose: PROGRESS_EVIDENCE_CAPTURE_TOKEN_PURPOSE,
      scope: session.id,
      ...(deps.webviewSecret ? { secret: deps.webviewSecret } : {}),
    });
  } catch (cause) {
    throw deliveryError(
      'The capture access token could not be reconstructed.',
      'PROGRESS_EVIDENCE_LOCATION_DELIVERY_CONFIGURATION_INVALID',
      cause,
    );
  }
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  if (!safeHashEqual(tokenHash, session.tokenHash)) {
    throw deliveryError(
      'The reconstructed capture token does not match its durable fingerprint.',
      'PROGRESS_EVIDENCE_LOCATION_DELIVERY_CONFIGURATION_INVALID',
    );
  }
  return token;
}

async function requireBoundContext(transaction, session, input, now, deps) {
  const subscriptionFence = deps.assertSubscription
    ?? assertOrganizationSubscriptionAllowsWrites;
  const resolveWorker = deps.resolveWorker ?? resolveActiveFieldWorkerByPhone;
  await subscriptionFence(transaction, input.scope.organizationId, { now });
  const [project, connection, mediaAsset, workerResolution] = await Promise.all([
    transaction.project.findFirst({
      where: {
        id: input.scope.projectId,
        organizationId: input.scope.organizationId,
        status: { in: ['ACTIVE', 'PAUSED'] },
      },
      select: { id: true, organizationId: true, status: true },
    }),
    transaction.whatsAppConnection.findFirst({
      where: {
        id: session.connectionId,
        projectId: input.scope.projectId,
        phoneNumberId: input.scope.phoneNumberId,
        enabled: true,
        connectionStatus: 'CONNECTED',
      },
      select: {
        id: true,
        projectId: true,
        phoneNumberId: true,
        enabled: true,
        connectionStatus: true,
      },
    }),
    transaction.whatsAppMediaAsset.findFirst({
      where: {
        id: session.mediaAssetId,
        organizationId: input.scope.organizationId,
        projectId: input.scope.projectId,
        webhookEventId: input.eventId,
        mediaKind: 'IMAGE',
        status: 'CLAIMED',
      },
      select: {
        id: true,
        organizationId: true,
        projectId: true,
        webhookEventId: true,
        mediaKind: true,
        status: true,
      },
    }),
    resolveWorker(
      transaction,
      {
        organizationId: input.scope.organizationId,
        projectId: input.scope.projectId,
      },
      input.recipientPhone,
    ),
  ]);
  if (
    !project
    || !connection
    || !mediaAsset
    || workerResolution?.status !== FIELD_WORKER_RESOLUTION.RESOLVED
    || workerResolution.worker?.id !== session.workerId
  ) {
    throw deliveryError(
      'The capture session is no longer bound to the delivery context.',
      'PROGRESS_EVIDENCE_LOCATION_DELIVERY_CONTEXT_INVALID',
    );
  }
  if (
    session.privacyNoticeVersion !== PROGRESS_EVIDENCE_LOCATION_NOTICE_VERSION
    || session.privacyNoticeContentSha256
      !== PROGRESS_EVIDENCE_LOCATION_NOTICE_CONTENT_SHA256
  ) {
    throw deliveryError(
      'The capture session privacy notice is no longer valid.',
      'PROGRESS_EVIDENCE_LOCATION_DELIVERY_CONTEXT_INVALID',
    );
  }
}

async function auditTransition(transaction, session, status, eventId, deps) {
  const audit = deps.createAuditLog ?? createAuditLog;
  return audit(transaction, {
    organizationId: session.organizationId,
    actorId: null,
    action: status === 'EXPIRED'
      ? 'progress_evidence.location_delivery.expired_before_send'
      : 'progress_evidence.location_delivery.cancelled_insufficient_validity',
    entityType: 'ProgressEvidenceCaptureSession',
    entityId: session.id,
    correlationId: eventId,
    metadata: {
      projectId: session.projectId,
      workerId: session.workerId,
      mediaAssetId: session.mediaAssetId,
      connectionId: session.connectionId,
      status,
      secretPersisted: false,
    },
  });
}

function safeFallback(session, reason) {
  return {
    mode: 'FALLBACK',
    reason,
    sessionId: session.id,
    text: PROGRESS_EVIDENCE_LOCATION_STALE_FALLBACK_REPLY,
  };
}

async function transitionAwaitingSession(transaction, session, input, now, status, deps) {
  const expiring = status === 'EXPIRED';
  const result = await transaction.progressEvidenceCaptureSession.updateMany({
    where: {
      id: session.id,
      organizationId: input.scope.organizationId,
      projectId: input.scope.projectId,
      workerId: session.workerId,
      status: 'AWAITING_LOCATION',
      expiresAt: expiring
        ? { lte: now }
        : {
            gt: now,
            lte: new Date(now.getTime() + minimumRemainingMilliseconds(deps)),
          },
    },
    data: expiring
      ? {
          status: 'EXPIRED',
          expiredAt: now,
          revision: { increment: 1 },
        }
      : {
          status: 'CANCELLED',
          cancelledAt: now,
          revision: { increment: 1 },
        },
  });
  if (result.count !== 1) return null;
  const transitioned = { ...session, status };
  await auditTransition(transaction, transitioned, status, input.eventId, deps);
  return transitioned;
}

function readyReply(link) {
  return [
    'Foto de avance recibida de forma privada.',
    'Si querés asociar una geolocalización reportada por el dispositivo a esta misma foto, autorizala desde este enlace seguro:',
    link,
    'El enlace vence pronto. No registra asistencia ni activa seguimiento continuo.',
  ].join('\n');
}

/**
 * Reconstructs an H2 capture link only after the automatic-delivery claim was
 * won. The returned text is ephemeral and must never be written back to the
 * Message or WebhookEvent records.
 */
export async function materializeProgressEvidenceLocationDelivery(
  prisma,
  rawInput,
  deps = {},
) {
  assertPrisma(prisma);
  const input = normalizedInput(rawInput);
  const now = currentDate(deps);
  const minimumRemainingMs = minimumRemainingMilliseconds(deps);

  return runSerializable(prisma, async (transaction) => {
    let session = await transaction.progressEvidenceCaptureSession.findFirst({
      where: {
        id: input.descriptor.sessionId,
        organizationId: input.scope.organizationId,
        projectId: input.scope.projectId,
      },
    });
    if (!session) {
      throw deliveryError(
        'The capture session does not exist in the delivery scope.',
        'PROGRESS_EVIDENCE_LOCATION_DELIVERY_CONTEXT_INVALID',
      );
    }
    await requireBoundContext(transaction, session, input, now, deps);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (session.status === 'EXPIRED' || session.status === 'CANCELLED') {
        return safeFallback(session, session.status);
      }
      if (session.status === 'LOCATION_CAPTURED' || session.status === 'CONSUMED') {
        return safeFallback(session, 'LOCATION_ALREADY_RECORDED');
      }
      if (session.status !== 'AWAITING_LOCATION') {
        throw deliveryError(
          'The capture session has an unsupported delivery state.',
          'PROGRESS_EVIDENCE_LOCATION_DELIVERY_STATE_INVALID',
        );
      }

      const expiresAt = new Date(session.expiresAt);
      if (!Number.isFinite(expiresAt.getTime())) {
        throw deliveryError(
          'The capture session expiration is invalid.',
          'PROGRESS_EVIDENCE_LOCATION_DELIVERY_CONFIGURATION_INVALID',
        );
      }
      const remainingMs = expiresAt.getTime() - now.getTime();
      if (remainingMs <= 0) {
        const expired = await transitionAwaitingSession(
          transaction,
          session,
          input,
          now,
          'EXPIRED',
          deps,
        );
        if (expired) return safeFallback(expired, 'EXPIRED');
      } else if (remainingMs < minimumRemainingMs) {
        const cancelled = await transitionAwaitingSession(
          transaction,
          session,
          input,
          now,
          'CANCELLED',
          deps,
        );
        if (cancelled) return safeFallback(cancelled, 'INSUFFICIENT_VALIDITY');
      } else {
        const token = reconstructToken(session, deps);
        const buildLink = deps.buildLink ?? buildProgressEvidenceLocationLink;
        const link = buildLink(
          { session, token },
          deps.environment ?? process.env,
          deps.linkDependencies ?? {},
        );
        return {
          mode: 'LINK',
          reason: null,
          sessionId: session.id,
          text: readyReply(link),
        };
      }

      session = await transaction.progressEvidenceCaptureSession.findFirst({
        where: {
          id: input.descriptor.sessionId,
          organizationId: input.scope.organizationId,
          projectId: input.scope.projectId,
        },
      });
      if (!session) {
        throw deliveryError(
          'The capture session changed during delivery preparation.',
          'PROGRESS_EVIDENCE_LOCATION_DELIVERY_CAS_CONFLICT',
        );
      }
    }
    throw deliveryError(
      'The capture session changed during delivery preparation.',
      'PROGRESS_EVIDENCE_LOCATION_DELIVERY_CAS_CONFLICT',
    );
  });
}
