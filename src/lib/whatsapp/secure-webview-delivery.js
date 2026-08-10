import { createAuditLog } from '../audit-log.js';
import { ATTENDANCE_ACTIONS, generateWebviewToken, readWebviewToken } from '../auth.js';
import { ATTENDANCE_GEO_WINDOW_MS } from '../attendance.js';
import {
  FIELD_WORKER_RESOLUTION,
  resolveActiveFieldWorkerByPhone,
} from '../field-workers.js';
import { assertOrganizationSubscriptionAllowsWrites } from '../plans.js';
import { redactSensitiveText } from '../sensitive-text.js';
import { resolveWhatsAppPublicAppUrl } from './public-app-url.js';

export const SECURE_WEBVIEW_DELIVERY_VERSION = 1;
export const SECURE_WEBVIEW_DELIVERY_MARKER = '[enlace seguro disponible sólo en WhatsApp]';
export const SECURE_WEBVIEW_DELIVERY_MIN_REMAINING_MS = 60_000;

const DEFAULT_WEBVIEW_TTL_SECONDS = 2 * 60 * 60;
const LINK_PATTERN = /https?:\/\/[^\s<>"']+\/webview\/(?:attendance|medical)\?[^\s<>"']+/giu;
const KINDS = new Set(['ATTENDANCE_CHECK_IN', 'ATTENDANCE_CHECK_OUT', 'MEDICAL']);
const DESCRIPTOR_FIELDS = new Set([
  'version',
  'kind',
  'projectId',
  'workerId',
  'resourceId',
  'resourceRevision',
  'issuedAt',
  'expiresAt',
]);
const DELIVERY_FIELDS = new Set(['descriptor', 'scope', 'recipientPhone', 'eventId', 'reply']);
const SCOPE_FIELDS = new Set(['organizationId', 'projectId', 'phoneNumberId']);

export class SecureWebviewDeliveryError extends Error {
  constructor(message, code = 'SECURE_WEBVIEW_DELIVERY_INVALID', cause = null) {
    super(message, cause ? { cause } : undefined);
    this.name = 'SecureWebviewDeliveryError';
    this.code = code;
  }
}

function deliveryError(message, code, cause = null) {
  return new SecureWebviewDeliveryError(message, code, cause);
}

function objectInput(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw deliveryError(`${field} is invalid.`, 'SECURE_WEBVIEW_DELIVERY_INPUT_INVALID');
  }
  return value;
}

function rejectUnknownFields(value, fields, field) {
  if (Object.keys(value).some((key) => !fields.has(key))) {
    throw deliveryError(
      `${field} contains unsupported fields.`,
      'SECURE_WEBVIEW_DELIVERY_INPUT_INVALID',
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
    throw deliveryError(`${field} is invalid.`, 'SECURE_WEBVIEW_DELIVERY_INPUT_INVALID');
  }
  return normalized;
}

export function normalizeSecureWebviewDeliveryDescriptor(rawDescriptor) {
  const descriptor = objectInput(rawDescriptor, 'descriptor');
  rejectUnknownFields(descriptor, DESCRIPTOR_FIELDS, 'descriptor');
  const kind = typeof descriptor.kind === 'string' ? descriptor.kind.trim().toUpperCase() : '';
  const issuedAt = Number(descriptor.issuedAt);
  const expiresAt = Number(descriptor.expiresAt);
  const resourceRevision = descriptor.resourceRevision === null
    ? null
    : Number(descriptor.resourceRevision);
  if (
    descriptor.version !== SECURE_WEBVIEW_DELIVERY_VERSION
    || !KINDS.has(kind)
    || !Number.isSafeInteger(issuedAt)
    || !Number.isSafeInteger(expiresAt)
    || issuedAt <= 0
    || expiresAt <= issuedAt
    || expiresAt - issuedAt > DEFAULT_WEBVIEW_TTL_SECONDS
  ) {
    throw deliveryError(
      'The secure-webview delivery descriptor is invalid.',
      'SECURE_WEBVIEW_DELIVERY_DESCRIPTOR_INVALID',
    );
  }
  const attendance = kind.startsWith('ATTENDANCE_');
  const resourceId = attendance ? identifier(descriptor.resourceId, 'resourceId') : null;
  if (
    (kind === 'ATTENDANCE_CHECK_IN' && resourceRevision !== null)
    || (
      kind === 'ATTENDANCE_CHECK_OUT'
      && (!Number.isSafeInteger(resourceRevision) || resourceRevision < 0)
    )
    || (kind === 'MEDICAL' && (descriptor.resourceId !== null || resourceRevision !== null))
  ) {
    throw deliveryError(
      'The secure-webview resource binding is invalid.',
      'SECURE_WEBVIEW_DELIVERY_DESCRIPTOR_INVALID',
    );
  }
  return {
    version: SECURE_WEBVIEW_DELIVERY_VERSION,
    kind,
    projectId: identifier(descriptor.projectId, 'projectId'),
    workerId: identifier(descriptor.workerId, 'workerId'),
    resourceId,
    resourceRevision,
    issuedAt,
    expiresAt,
  };
}

function descriptorFromPayload(pathname, workerId, projectId, payload) {
  if (pathname === '/webview/medical') {
    return normalizeSecureWebviewDeliveryDescriptor({
      version: SECURE_WEBVIEW_DELIVERY_VERSION,
      kind: 'MEDICAL',
      projectId,
      workerId,
      resourceId: null,
      resourceRevision: null,
      issuedAt: payload.exp - DEFAULT_WEBVIEW_TTL_SECONDS,
      expiresAt: payload.exp,
    });
  }
  const checkout = payload.act === ATTENDANCE_ACTIONS.CHECK_OUT;
  if (payload.act !== ATTENDANCE_ACTIONS.CHECK_IN && !checkout) return null;
  return normalizeSecureWebviewDeliveryDescriptor({
    version: SECURE_WEBVIEW_DELIVERY_VERSION,
    kind: checkout ? 'ATTENDANCE_CHECK_OUT' : 'ATTENDANCE_CHECK_IN',
    projectId,
    workerId,
    resourceId: checkout ? payload.sid : payload.pid,
    resourceRevision: checkout ? payload.rev : null,
    issuedAt: payload.iat,
    expiresAt: payload.exp,
  });
}

/**
 * Converts the one signed webview URL produced by the obra engine into a
 * non-secret, strictly validated descriptor. The bearer remains in memory and
 * is never included in the returned value.
 */
export function extractSecureWebviewDelivery(reply, {
  projectId,
  secret,
  now = Date.now(),
} = {}) {
  const text = String(reply || '');
  const matches = [...text.matchAll(LINK_PATTERN)];
  if (matches.length === 0) return null;
  if (matches.length !== 1) {
    throw deliveryError(
      'A delivery reply must contain exactly one supported secure webview.',
      'SECURE_WEBVIEW_DELIVERY_DESCRIPTOR_INVALID',
    );
  }
  let link;
  try {
    link = new URL(matches[0][0]);
  } catch (cause) {
    throw deliveryError(
      'The secure webview URL is invalid.',
      'SECURE_WEBVIEW_DELIVERY_DESCRIPTOR_INVALID',
      cause,
    );
  }
  const workerValues = link.searchParams.getAll('worker');
  const tokenValues = link.searchParams.getAll('token');
  if (workerValues.length !== 1 || tokenValues.length !== 1) {
    throw deliveryError(
      'The secure webview URL has an ambiguous bearer binding.',
      'SECURE_WEBVIEW_DELIVERY_DESCRIPTOR_INVALID',
    );
  }
  const workerId = identifier(workerValues[0], 'workerId');
  const normalizedProjectId = identifier(projectId, 'projectId');
  const purpose = link.pathname === '/webview/attendance'
    ? 'attendance'
    : link.pathname === '/webview/medical'
      ? 'medical'
      : null;
  if (!purpose) return null;
  const payload = readWebviewToken(workerId, tokenValues[0], {
    purpose,
    scope: normalizedProjectId,
    now,
    ...(secret ? { secret } : {}),
  });
  if (!payload) {
    throw deliveryError(
      'The secure webview bearer cannot be converted into a durable descriptor.',
      'SECURE_WEBVIEW_DELIVERY_DESCRIPTOR_INVALID',
    );
  }
  return descriptorFromPayload(link.pathname, workerId, normalizedProjectId, payload);
}

export function secureWebviewDurableReply(reply, descriptor = null) {
  return redactSensitiveText(reply, {
    secureLinkReplacement: descriptor
      ? SECURE_WEBVIEW_DELIVERY_MARKER
      : undefined,
  });
}

function normalizedInput(rawInput) {
  const input = objectInput(rawInput, 'input');
  rejectUnknownFields(input, DELIVERY_FIELDS, 'input');
  const descriptor = normalizeSecureWebviewDeliveryDescriptor(input.descriptor);
  const scope = objectInput(input.scope, 'scope');
  rejectUnknownFields(scope, SCOPE_FIELDS, 'scope');
  const normalizedScope = {
    organizationId: identifier(scope.organizationId, 'organizationId'),
    projectId: identifier(scope.projectId, 'projectId'),
    phoneNumberId: identifier(scope.phoneNumberId, 'phoneNumberId'),
  };
  if (descriptor.projectId !== normalizedScope.projectId) {
    throw deliveryError(
      'The secure-webview descriptor crossed its project scope.',
      'SECURE_WEBVIEW_DELIVERY_CONTEXT_INVALID',
    );
  }
  const reply = String(input.reply || '');
  if (reply.split(SECURE_WEBVIEW_DELIVERY_MARKER).length !== 2) {
    throw deliveryError(
      'The durable reply is not bound to one secure-webview placeholder.',
      'SECURE_WEBVIEW_DELIVERY_INPUT_INVALID',
    );
  }
  return {
    descriptor,
    scope: normalizedScope,
    recipientPhone: identifier(input.recipientPhone, 'recipientPhone'),
    eventId: identifier(input.eventId, 'eventId'),
    reply,
  };
}

function currentDate(deps) {
  const configured = typeof deps.clock === 'function'
    ? deps.clock()
    : deps.now ?? Date.now();
  const now = configured instanceof Date ? new Date(configured.getTime()) : new Date(configured);
  if (!Number.isFinite(now.getTime())) {
    throw deliveryError(
      'The secure-webview delivery clock is unavailable.',
      'SECURE_WEBVIEW_DELIVERY_CONFIGURATION_INVALID',
    );
  }
  return now;
}

function minimumRemainingMilliseconds(deps) {
  const value = deps.minimumRemainingMs ?? SECURE_WEBVIEW_DELIVERY_MIN_REMAINING_MS;
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw deliveryError(
      'The secure-webview minimum validity is invalid.',
      'SECURE_WEBVIEW_DELIVERY_CONFIGURATION_INVALID',
    );
  }
  return value;
}

function assertPrisma(prisma) {
  if (
    !prisma
    || typeof prisma.project?.findFirst !== 'function'
    || typeof prisma.whatsAppConnection?.findFirst !== 'function'
  ) {
    throw deliveryError(
      'The secure-webview delivery store is unavailable.',
      'SECURE_WEBVIEW_DELIVERY_CONFIGURATION_INVALID',
    );
  }
}

async function runSerializable(prisma, operation) {
  if (typeof prisma.$transaction !== 'function') return operation(prisma);
  return prisma.$transaction(operation, { isolationLevel: 'Serializable' });
}

async function requireBoundContext(transaction, input, now, deps) {
  const resolveWorker = deps.resolveWorker ?? resolveActiveFieldWorkerByPhone;
  const assertSubscription = deps.assertSubscription
    ?? assertOrganizationSubscriptionAllowsWrites;
  await assertSubscription(transaction, input.scope.organizationId, { now });
  const [project, connection, workerResolution] = await Promise.all([
    transaction.project.findFirst({
      where: {
        id: input.scope.projectId,
        organizationId: input.scope.organizationId,
        status: { in: ['ACTIVE', 'PAUSED'] },
      },
      select: { id: true },
    }),
    transaction.whatsAppConnection.findFirst({
      where: {
        projectId: input.scope.projectId,
        phoneNumberId: input.scope.phoneNumberId,
        enabled: true,
        connectionStatus: 'CONNECTED',
      },
      select: { id: true },
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
    || workerResolution?.status !== FIELD_WORKER_RESOLUTION.RESOLVED
    || workerResolution.worker?.id !== input.descriptor.workerId
  ) {
    throw deliveryError(
      'The secure webview is no longer bound to the delivery context.',
      'SECURE_WEBVIEW_DELIVERY_CONTEXT_INVALID',
    );
  }

  if (input.descriptor.kind === 'ATTENDANCE_CHECK_IN') {
    if (typeof transaction.attendanceEntry?.findFirst !== 'function') {
      throw deliveryError(
        'The attendance-entry store is unavailable.',
        'SECURE_WEBVIEW_DELIVERY_CONFIGURATION_INVALID',
      );
    }
    const pending = await transaction.attendanceEntry.findFirst({
      where: {
        id: input.descriptor.resourceId,
        projectId: input.scope.projectId,
        workerId: input.descriptor.workerId,
        eventType: 'CHECK_IN',
        status: 'PENDING_GEO',
        verificationStatus: 'PENDING',
        occurredAt: {
          gt: new Date(now.getTime() - ATTENDANCE_GEO_WINDOW_MS),
        },
      },
      select: { id: true },
    });
    if (!pending) {
      throw deliveryError(
        'The pending attendance capture is no longer available.',
        'SECURE_WEBVIEW_DELIVERY_CONTEXT_INVALID',
      );
    }
  }
  if (input.descriptor.kind === 'ATTENDANCE_CHECK_OUT') {
    if (typeof transaction.attendanceShift?.findFirst !== 'function') {
      throw deliveryError(
        'The attendance-shift store is unavailable.',
        'SECURE_WEBVIEW_DELIVERY_CONFIGURATION_INVALID',
      );
    }
    const shift = await transaction.attendanceShift.findFirst({
      where: {
        id: input.descriptor.resourceId,
        projectId: input.scope.projectId,
        workerId: input.descriptor.workerId,
        revision: input.descriptor.resourceRevision,
        status: 'OPEN',
        phase: 'WORKING',
      },
      select: { id: true },
    });
    if (!shift) {
      throw deliveryError(
        'The attendance shift is no longer eligible for checkout.',
        'SECURE_WEBVIEW_DELIVERY_CONTEXT_INVALID',
      );
    }
  }
}

function reconstructToken(descriptor, deps) {
  const attendance = descriptor.kind.startsWith('ATTENDANCE_');
  const action = descriptor.kind === 'ATTENDANCE_CHECK_IN'
    ? ATTENDANCE_ACTIONS.CHECK_IN
    : descriptor.kind === 'ATTENDANCE_CHECK_OUT'
      ? ATTENDANCE_ACTIONS.CHECK_OUT
      : null;
  try {
    const generator = deps.generateWebviewToken ?? generateWebviewToken;
    return generator(descriptor.workerId, {
      now: descriptor.issuedAt * 1_000,
      ttlSeconds: descriptor.expiresAt - descriptor.issuedAt,
      purpose: attendance ? 'attendance' : 'medical',
      scope: descriptor.projectId,
      ...(action ? { action } : {}),
      ...(action === ATTENDANCE_ACTIONS.CHECK_IN
        ? { pendingEntryId: descriptor.resourceId }
        : action === ATTENDANCE_ACTIONS.CHECK_OUT
          ? {
              shiftId: descriptor.resourceId,
              shiftRevision: descriptor.resourceRevision,
            }
          : {}),
      ...(deps.webviewSecret ? { secret: deps.webviewSecret } : {}),
    });
  } catch (cause) {
    throw deliveryError(
      'The secure-webview bearer could not be reconstructed.',
      'SECURE_WEBVIEW_DELIVERY_CONFIGURATION_INVALID',
      cause,
    );
  }
}

function buildLink(descriptor, token, environment) {
  const appUrl = resolveWhatsAppPublicAppUrl(environment);
  const path = descriptor.kind === 'MEDICAL'
    ? '/webview/medical'
    : '/webview/attendance';
  const query = new URLSearchParams({ worker: descriptor.workerId, token }).toString();
  return `${appUrl}${path}?${query}`;
}

function fallbackReply(reply) {
  return reply.replace(
    SECURE_WEBVIEW_DELIVERY_MARKER,
    '[el enlace seguro venció; solicitá uno nuevo desde el chat oficial]',
  );
}

async function auditPreparation(transaction, input, mode, deps) {
  const audit = deps.createAuditLog ?? createAuditLog;
  return audit(transaction, {
    organizationId: input.scope.organizationId,
    actorId: null,
    action: mode === 'LINK'
      ? 'webview.secure_link.materialized'
      : 'webview.secure_link.unavailable',
    entityType: input.descriptor.kind.startsWith('ATTENDANCE_')
      ? 'AttendanceEntry'
      : 'Worker',
    entityId: input.descriptor.resourceId || input.descriptor.workerId,
    correlationId: input.eventId,
    metadata: {
      projectId: input.scope.projectId,
      workerId: input.descriptor.workerId,
      kind: input.descriptor.kind,
      mode,
      secretPersisted: false,
    },
  });
}

/**
 * Reconstructs a signed URL only after the automatic-delivery claim is won.
 * The returned text is ephemeral and must never be written to Message,
 * WebhookEvent, audit metadata, logs, or client DTOs.
 */
export async function materializeSecureWebviewDelivery(prisma, rawInput, deps = {}) {
  assertPrisma(prisma);
  const input = normalizedInput(rawInput);
  const now = currentDate(deps);
  const minimumRemainingMs = minimumRemainingMilliseconds(deps);

  return runSerializable(prisma, async (transaction) => {
    await requireBoundContext(transaction, input, now, deps);
    if ((input.descriptor.expiresAt * 1_000) - now.getTime() < minimumRemainingMs) {
      await auditPreparation(transaction, input, 'FALLBACK', deps);
      return {
        mode: 'FALLBACK',
        reason: 'INSUFFICIENT_VALIDITY',
        text: fallbackReply(input.reply),
      };
    }
    const token = reconstructToken(input.descriptor, deps);
    const link = (deps.buildLink ?? buildLink)(
      input.descriptor,
      token,
      deps.environment ?? process.env,
    );
    await auditPreparation(transaction, input, 'LINK', deps);
    return {
      mode: 'LINK',
      reason: null,
      text: input.reply.replace(SECURE_WEBVIEW_DELIVERY_MARKER, link),
    };
  });
}
