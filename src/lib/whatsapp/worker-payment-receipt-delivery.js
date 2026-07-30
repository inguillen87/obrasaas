import { createAuditLog } from '../audit-log.js';
import {
  FIELD_WORKER_RESOLUTION,
  resolveActiveFieldWorkerByPhone,
} from '../field-workers.js';
import { assertOrganizationSubscriptionAllowsWrites } from '../plans.js';
import {
  WORKER_PAYMENT_PRIVATE_RECEIPT_MAX_ACCESSES,
  buildWorkerPaymentPrivateReceiptLink,
  reconstructWorkerPaymentPrivateReceiptToken,
} from '../worker-payment-private-receipts.js';

export const WORKER_PAYMENT_PRIVATE_RECEIPT_MIN_REMAINING_MS = 2 * 60 * 1_000;

export const WORKER_PAYMENT_PRIVATE_RECEIPT_DURABLE_REPLY = [
  'Destino de cobro recibido de forma privada para revisión.',
  'Si solicitaste una constancia, el enlace seguro se prepara sólo al momento de enviarlo y no muestra el dato completo.',
  'Esto no acredita titularidad, validación bancaria, activación, transferencia ni pago.',
].join('\n');

export const WORKER_PAYMENT_PRIVATE_RECEIPT_STALE_REPLY = [
  'Destino de cobro recibido de forma privada para revisión.',
  'La constancia temporal ya no está disponible. No reenvíes CBU, CVU ni alias por el chat; contactá a la administración por el canal oficial.',
  'Esto no acredita titularidad, validación bancaria, activación, transferencia ni pago.',
].join('\n');

const DELIVERY_FIELDS = new Set(['descriptor', 'scope', 'recipientPhone', 'eventId']);
const DESCRIPTOR_FIELDS = new Set(['version', 'receiptId']);
const SCOPE_FIELDS = new Set(['organizationId', 'projectId', 'phoneNumberId']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SAFE_IDENTIFIER_PATTERN = /^[^\u0000-\u001f\u007f]{1,190}$/;

export class WorkerPaymentPrivateReceiptDeliveryError extends Error {
  constructor(
    message,
    code = 'WORKER_PAYMENT_PRIVATE_RECEIPT_DELIVERY_INVALID',
    cause = null,
  ) {
    super(message, cause ? { cause } : undefined);
    this.name = 'WorkerPaymentPrivateReceiptDeliveryError';
    this.code = code;
  }
}

function deliveryError(message, code, cause = null) {
  return new WorkerPaymentPrivateReceiptDeliveryError(message, code, cause);
}

function objectInput(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw deliveryError(
      `${field} is invalid.`,
      'WORKER_PAYMENT_PRIVATE_RECEIPT_DELIVERY_INPUT_INVALID',
    );
  }
  return value;
}

function rejectUnknownFields(value, fields, field) {
  if (Object.keys(value).some((key) => !fields.has(key))) {
    throw deliveryError(
      `${field} contains unsupported fields.`,
      'WORKER_PAYMENT_PRIVATE_RECEIPT_DELIVERY_INPUT_INVALID',
    );
  }
}

function identifier(value, field) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (
    !normalized
    || normalized !== value
    || !SAFE_IDENTIFIER_PATTERN.test(normalized)
  ) {
    throw deliveryError(
      `${field} is invalid.`,
      'WORKER_PAYMENT_PRIVATE_RECEIPT_DELIVERY_INPUT_INVALID',
    );
  }
  return normalized;
}

function normalizedInput(rawInput) {
  const input = objectInput(rawInput, 'input');
  rejectUnknownFields(input, DELIVERY_FIELDS, 'input');
  const descriptor = objectInput(input.descriptor, 'descriptor');
  rejectUnknownFields(descriptor, DESCRIPTOR_FIELDS, 'descriptor');
  const receiptId = typeof descriptor.receiptId === 'string'
    ? descriptor.receiptId.trim().toLowerCase()
    : '';
  if (descriptor.version !== 1 || !UUID_PATTERN.test(receiptId)) {
    throw deliveryError(
      'The private-receipt delivery descriptor is invalid.',
      'WORKER_PAYMENT_PRIVATE_RECEIPT_DELIVERY_DESCRIPTOR_INVALID',
    );
  }
  const scope = objectInput(input.scope, 'scope');
  rejectUnknownFields(scope, SCOPE_FIELDS, 'scope');
  return {
    descriptor: { version: 1, receiptId },
    scope: {
      organizationId: identifier(scope.organizationId, 'organizationId'),
      projectId: identifier(scope.projectId, 'projectId'),
      phoneNumberId: identifier(scope.phoneNumberId, 'phoneNumberId'),
    },
    recipientPhone: identifier(input.recipientPhone, 'recipientPhone'),
    eventId: identifier(input.eventId, 'eventId'),
  };
}

function currentDate(deps) {
  const configured = typeof deps.clock === 'function'
    ? deps.clock()
    : deps.now ?? Date.now();
  const now = configured instanceof Date ? new Date(configured.getTime()) : new Date(configured);
  if (!Number.isFinite(now.getTime())) {
    throw deliveryError(
      'The private-receipt delivery clock is unavailable.',
      'WORKER_PAYMENT_PRIVATE_RECEIPT_DELIVERY_CONFIGURATION_INVALID',
    );
  }
  return now;
}

function minimumRemainingMilliseconds(deps) {
  const value = deps.minimumRemainingMs
    ?? WORKER_PAYMENT_PRIVATE_RECEIPT_MIN_REMAINING_MS;
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw deliveryError(
      'The minimum private-receipt validity is invalid.',
      'WORKER_PAYMENT_PRIVATE_RECEIPT_DELIVERY_CONFIGURATION_INVALID',
    );
  }
  return value;
}

function assertPrisma(prisma) {
  if (
    !prisma
    || typeof prisma.workerPaymentPrivateReceipt?.findFirst !== 'function'
    || typeof prisma.project?.findFirst !== 'function'
    || typeof prisma.whatsAppConnection?.findFirst !== 'function'
  ) {
    throw deliveryError(
      'The private-receipt delivery store is unavailable.',
      'WORKER_PAYMENT_PRIVATE_RECEIPT_DELIVERY_CONFIGURATION_INVALID',
    );
  }
}

async function runSerializable(prisma, operation) {
  if (typeof prisma.$transaction !== 'function') return operation(prisma);
  return prisma.$transaction(operation, { isolationLevel: 'Serializable' });
}

async function requireBoundContext(transaction, receipt, input, now, deps) {
  const subscriptionFence = deps.assertSubscription
    ?? assertOrganizationSubscriptionAllowsWrites;
  const resolveWorker = deps.resolveWorker ?? resolveActiveFieldWorkerByPhone;
  await subscriptionFence(transaction, input.scope.organizationId, { now });
  const [project, connection, workerResolution] = await Promise.all([
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
        id: receipt.connectionId,
        projectId: input.scope.projectId,
        phoneNumberId: input.scope.phoneNumberId,
        enabled: true,
        connectionStatus: 'CONNECTED',
      },
      select: { id: true, projectId: true, phoneNumberId: true },
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
    || workerResolution.source !== 'CANONICAL'
    || workerResolution.worker?.id !== receipt.workerId
    || workerResolution.worker?.personId !== receipt.personId
    || workerResolution.worker?.person?.identityStatus !== 'VERIFIED'
    || workerResolution.channelIdentityId !== receipt.channelIdentityId
  ) {
    throw deliveryError(
      'The private receipt is no longer bound to the WhatsApp recipient.',
      'WORKER_PAYMENT_PRIVATE_RECEIPT_DELIVERY_CONTEXT_INVALID',
    );
  }
}

async function auditPreparation(transaction, receipt, mode, eventId, deps) {
  const audit = deps.createAuditLog ?? createAuditLog;
  return audit(transaction, {
    organizationId: receipt.organizationId,
    actorId: null,
    action: mode === 'LINK'
      ? 'worker_payment.private_receipt.link_materialized'
      : 'worker_payment.private_receipt.link_unavailable',
    entityType: 'WorkerPaymentPrivateReceipt',
    entityId: receipt.id,
    correlationId: eventId,
    metadata: {
      projectId: receipt.projectId,
      workerId: receipt.workerId,
      flowSessionId: receipt.flowSessionId,
      mode,
      secretPersisted: false,
      financialValuePersisted: false,
    },
  });
}

function fallback(receipt, reason) {
  return {
    mode: 'FALLBACK',
    reason,
    receiptId: receipt.id,
    text: WORKER_PAYMENT_PRIVATE_RECEIPT_STALE_REPLY,
  };
}

function readyReply(link) {
  return [
    'Destino de cobro recibido de forma privada para revisión.',
    'Solicitaste una constancia sin mostrar el dato completo. Podés abrirla o descargarla desde este enlace seguro:',
    link,
    'El enlace vence pronto. La constancia no acredita titularidad, validación bancaria, activación, transferencia ni pago.',
  ].join('\n');
}

/**
 * Reconstructs the bearer only after the caller won the durable automatic
 * delivery claim. The returned text is ephemeral and must never be persisted.
 */
export async function materializeWorkerPaymentPrivateReceiptDelivery(
  prisma,
  rawInput,
  deps = {},
) {
  assertPrisma(prisma);
  const input = normalizedInput(rawInput);
  const now = currentDate(deps);
  const minimumRemainingMs = minimumRemainingMilliseconds(deps);

  return runSerializable(prisma, async (transaction) => {
    const receipt = await transaction.workerPaymentPrivateReceipt.findFirst({
      where: {
        id: input.descriptor.receiptId,
        organizationId: input.scope.organizationId,
        projectId: input.scope.projectId,
        sourceWebhookEventId: input.eventId,
      },
    });
    if (!receipt) {
      throw deliveryError(
        'The private receipt does not exist in the delivery scope.',
        'WORKER_PAYMENT_PRIVATE_RECEIPT_DELIVERY_CONTEXT_INVALID',
      );
    }
    await requireBoundContext(transaction, receipt, input, now, deps);

    const expiresAt = new Date(receipt.expiresAt);
    if (!Number.isFinite(expiresAt.getTime())) {
      throw deliveryError(
        'The private receipt expiration is invalid.',
        'WORKER_PAYMENT_PRIVATE_RECEIPT_DELIVERY_CONFIGURATION_INVALID',
      );
    }
    let unavailableReason = null;
    if (receipt.revokedAt) unavailableReason = 'REVOKED';
    else if (expiresAt.getTime() <= now.getTime()) unavailableReason = 'EXPIRED';
    else if (expiresAt.getTime() - now.getTime() < minimumRemainingMs) {
      unavailableReason = 'INSUFFICIENT_VALIDITY';
    } else if (
      !Number.isSafeInteger(receipt.accessCount)
      || receipt.accessCount < 0
      || receipt.accessCount >= WORKER_PAYMENT_PRIVATE_RECEIPT_MAX_ACCESSES
    ) {
      unavailableReason = 'ACCESS_LIMIT';
    }
    if (unavailableReason) {
      await auditPreparation(transaction, receipt, 'FALLBACK', input.eventId, deps);
      return fallback(receipt, unavailableReason);
    }

    let token;
    let link;
    try {
      token = reconstructWorkerPaymentPrivateReceiptToken(receipt, deps);
      const buildLink = deps.buildLink ?? buildWorkerPaymentPrivateReceiptLink;
      link = buildLink(
        { receipt, token },
        deps.environment ?? process.env,
        deps.linkDependencies ?? {},
      );
    } catch (cause) {
      throw deliveryError(
        'The private-receipt link could not be materialized.',
        'WORKER_PAYMENT_PRIVATE_RECEIPT_DELIVERY_CONFIGURATION_INVALID',
        cause,
      );
    }
    await auditPreparation(transaction, receipt, 'LINK', input.eventId, deps);
    return {
      mode: 'LINK',
      reason: null,
      receiptId: receipt.id,
      text: readyReply(link),
    };
  });
}
