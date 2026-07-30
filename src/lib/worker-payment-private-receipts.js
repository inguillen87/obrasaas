import crypto from 'node:crypto';

import { generateWebviewToken, verifyWebviewToken } from './auth.js';
import { resolveWhatsAppPublicAppUrl } from './whatsapp/public-app-url.js';

export const WORKER_PAYMENT_PRIVATE_RECEIPT_TOKEN_PURPOSE = 'worker-payment-private-receipt';
export const WORKER_PAYMENT_PRIVATE_RECEIPT_CONTENT_VERSION = 'worker-payment-private-receipt-v1';
export const WORKER_PAYMENT_PRIVATE_RECEIPT_TTL_MS = 15 * 60 * 1_000;
export const WORKER_PAYMENT_PRIVATE_RECEIPT_MAX_ACCESSES = 5;
export const WORKER_PAYMENT_PRIVATE_RECEIPT_STATUS = 'RECEIVED_FOR_REVIEW';

const ISSUE_FIELDS = new Set([
  'organizationId',
  'projectId',
  'connectionId',
  'flowSessionId',
  'workerId',
  'personId',
  'channelIdentityId',
  'sourceWebhookEventId',
  'consumedExternalId',
]);
const ACCESS_FIELDS = new Set(['workerId', 'receiptId', 'token']);
const LINK_FIELDS = new Set(['receipt', 'token', 'publicAppUrl']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SAFE_IDENTIFIER_PATTERN = /^[^\u0000-\u001f\u007f]{1,190}$/;
const TOKEN_PATTERN = /^[^\u0000-\u001f\u007f]{1,4096}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const BANK_LAST_FOUR_PATTERN = /^[0-9]{4}$/;
const ALIAS_LAST_FOUR_PATTERN = /^[a-z0-9.-]{4}$/;
const PURPOSES = new Set(['SALARY', 'REIMBURSEMENT']);
const DESTINATION_TYPES = new Set(['CBU', 'CVU', 'ALIAS']);
const CONTENT_HASH_DOMAIN = 'obrasaas:worker-payment-private-receipt-content:v1';

const ERROR_STATUS = Object.freeze({
  WORKER_PAYMENT_PRIVATE_RECEIPT_INPUT_INVALID: 400,
  WORKER_PAYMENT_PRIVATE_RECEIPT_UNKNOWN_FIELDS: 400,
  WORKER_PAYMENT_PRIVATE_RECEIPT_TOKEN_INVALID: 401,
  WORKER_PAYMENT_PRIVATE_RECEIPT_SCOPE_FORBIDDEN: 403,
  WORKER_PAYMENT_PRIVATE_RECEIPT_NOT_FOUND: 404,
  WORKER_PAYMENT_PRIVATE_RECEIPT_NOT_REQUESTED: 409,
  WORKER_PAYMENT_PRIVATE_RECEIPT_CONFLICT: 409,
  WORKER_PAYMENT_PRIVATE_RECEIPT_REVOKED: 410,
  WORKER_PAYMENT_PRIVATE_RECEIPT_EXPIRED: 410,
  WORKER_PAYMENT_PRIVATE_RECEIPT_ACCESS_LIMIT: 410,
  WORKER_PAYMENT_PRIVATE_RECEIPT_CONFIGURATION_INVALID: 503,
});

export class WorkerPaymentPrivateReceiptError extends Error {
  constructor(message, code = 'WORKER_PAYMENT_PRIVATE_RECEIPT_INPUT_INVALID', options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'WorkerPaymentPrivateReceiptError';
    this.code = code;
    this.status = ERROR_STATUS[code] || 500;
  }
}

function receiptError(message, code, cause = null) {
  return new WorkerPaymentPrivateReceiptError(message, code, cause ? { cause } : {});
}

export function isWorkerPaymentPrivateReceiptError(error) {
  return error instanceof WorkerPaymentPrivateReceiptError;
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function objectInput(value, field) {
  if (!isPlainObject(value)) {
    throw receiptError(
      `${field} no es válido.`,
      'WORKER_PAYMENT_PRIVATE_RECEIPT_INPUT_INVALID',
    );
  }
  return value;
}

function rejectUnknownFields(value, fields) {
  if (Object.keys(value).some((field) => !fields.has(field))) {
    throw receiptError(
      'La solicitud contiene campos no permitidos.',
      'WORKER_PAYMENT_PRIVATE_RECEIPT_UNKNOWN_FIELDS',
    );
  }
}

function identifier(value, field, { max = 190, pattern = SAFE_IDENTIFIER_PATTERN } = {}) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (
    !normalized
    || normalized !== value
    || normalized.length > max
    || !pattern.test(normalized)
  ) {
    throw receiptError(
      `${field} no es válido.`,
      'WORKER_PAYMENT_PRIVATE_RECEIPT_INPUT_INVALID',
    );
  }
  return normalized;
}

function uuid(value, field) {
  return identifier(value, field, { max: 36, pattern: UUID_PATTERN }).toLowerCase();
}

function normalizedDate(value, field) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw receiptError(
      `${field} no es válido.`,
      'WORKER_PAYMENT_PRIVATE_RECEIPT_INPUT_INVALID',
    );
  }
  return date;
}

function currentDate(deps) {
  const configured = typeof deps.clock === 'function'
    ? deps.clock()
    : deps.now ?? Date.now();
  const date = normalizedDate(configured, 'now');
  return new Date(Math.floor(date.getTime() / 1_000) * 1_000);
}

function canonicalValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]),
    );
  }
  return value === undefined ? null : value;
}

function sha256(value) {
  const content = typeof value === 'string'
    ? value
    : JSON.stringify(canonicalValue(value));
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

function validDestinationLastFour(destinationType, value) {
  if (destinationType === 'CBU' || destinationType === 'CVU') {
    return BANK_LAST_FOUR_PATTERN.test(value);
  }
  return destinationType === 'ALIAS' && ALIAS_LAST_FOUR_PATTERN.test(value);
}

function lengthPrefixed(parts) {
  return parts.map((part) => {
    const value = String(part);
    return `${Buffer.byteLength(value, 'utf8')}:${value}`;
  }).join('|');
}

export function workerPaymentPrivateReceiptContentSha256(receipt) {
  const id = String(receipt?.id || '').trim().toLowerCase();
  const contentVersion = String(receipt?.contentVersion || '').trim();
  const paymentPurpose = String(receipt?.paymentPurpose || '').trim().toUpperCase();
  const destinationType = String(receipt?.destinationType || '').trim().toUpperCase();
  const destinationLastFour = String(receipt?.destinationLastFour || '').trim();
  if (
    !UUID_PATTERN.test(id)
    || contentVersion !== WORKER_PAYMENT_PRIVATE_RECEIPT_CONTENT_VERSION
    || !PURPOSES.has(paymentPurpose)
    || !DESTINATION_TYPES.has(destinationType)
    || !validDestinationLastFour(destinationType, destinationLastFour)
  ) {
    throw receiptError(
      'El contenido de la constancia almacenada no es válido.',
      'WORKER_PAYMENT_PRIVATE_RECEIPT_CONFIGURATION_INVALID',
    );
  }
  const receivedAt = normalizedDate(receipt.receivedAt, 'receivedAt').toISOString();
  const issuedAt = normalizedDate(receipt.issuedAt, 'issuedAt').toISOString();
  const publicLastFour = destinationType === 'CBU' || destinationType === 'CVU'
    ? destinationLastFour
    : '';
  return sha256(lengthPrefixed([
    CONTENT_HASH_DOMAIN,
    contentVersion,
    id,
    receivedAt,
    issuedAt,
    paymentPurpose,
    destinationType,
    publicLastFour,
    WORKER_PAYMENT_PRIVATE_RECEIPT_STATUS,
  ]));
}

function safeHashEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length
    && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function exactRecord(record, expected) {
  return Boolean(record)
    && Object.entries(expected).every(([field, value]) => record[field] === value);
}

function normalizedIssueInput(rawInput) {
  const input = objectInput(rawInput, 'input');
  rejectUnknownFields(input, ISSUE_FIELDS);
  return {
    organizationId: identifier(input.organizationId, 'organizationId'),
    projectId: identifier(input.projectId, 'projectId'),
    connectionId: identifier(input.connectionId, 'connectionId'),
    flowSessionId: uuid(input.flowSessionId, 'flowSessionId'),
    workerId: identifier(input.workerId, 'workerId'),
    personId: identifier(input.personId, 'personId'),
    channelIdentityId: identifier(input.channelIdentityId, 'channelIdentityId'),
    sourceWebhookEventId: identifier(input.sourceWebhookEventId, 'sourceWebhookEventId'),
    consumedExternalId: identifier(input.consumedExternalId, 'consumedExternalId', { max: 512 }),
  };
}

function normalizedAccessInput(rawInput) {
  const input = objectInput(rawInput, 'input');
  rejectUnknownFields(input, ACCESS_FIELDS);
  return {
    workerId: identifier(input.workerId, 'workerId'),
    receiptId: uuid(input.receiptId, 'receiptId'),
    token: identifier(input.token, 'token', { max: 4_096, pattern: TOKEN_PATTERN }),
  };
}

function receiptDelegate(prisma) {
  if (
    !prisma
    || typeof prisma.workerPaymentPrivateReceipt?.findUnique !== 'function'
    || typeof prisma.workerPaymentPrivateReceipt?.findFirst !== 'function'
    || typeof prisma.workerPaymentPrivateReceipt?.create !== 'function'
    || typeof prisma.workerPaymentPrivateReceipt?.updateMany !== 'function'
  ) {
    throw receiptError(
      'La persistencia de constancias privadas no está disponible.',
      'WORKER_PAYMENT_PRIVATE_RECEIPT_CONFIGURATION_INVALID',
    );
  }
  return prisma.workerPaymentPrivateReceipt;
}

function assertIssueStore(prisma) {
  receiptDelegate(prisma);
  if (
    typeof prisma.workerPaymentFlowSession?.findUnique !== 'function'
    || typeof prisma.whatsAppFlowSession?.findFirst !== 'function'
    || typeof prisma.workerPaymentDestination?.findFirst !== 'function'
    || typeof prisma.webhookEvent?.findFirst !== 'function'
    || typeof prisma.project?.findFirst !== 'function'
    || typeof prisma.whatsAppConnection?.findFirst !== 'function'
    || typeof prisma.worker?.findFirst !== 'function'
    || typeof prisma.workerPerson?.findFirst !== 'function'
    || typeof prisma.workerChannelIdentity?.findFirst !== 'function'
  ) {
    throw receiptError(
      'La persistencia de constancias privadas no está disponible.',
      'WORKER_PAYMENT_PRIVATE_RECEIPT_CONFIGURATION_INVALID',
    );
  }
}

function assertCompanionStore(prisma) {
  if (!prisma || typeof prisma.workerPaymentFlowSession?.findUnique !== 'function') {
    throw receiptError(
      'La persistencia de sesiones de cobro no está disponible.',
      'WORKER_PAYMENT_PRIVATE_RECEIPT_CONFIGURATION_INVALID',
    );
  }
}

function assertAccessStore(prisma) {
  receiptDelegate(prisma);
  if (
    typeof prisma.project?.findFirst !== 'function'
    || typeof prisma.whatsAppConnection?.findFirst !== 'function'
    || typeof prisma.worker?.findFirst !== 'function'
    || typeof prisma.workerPerson?.findFirst !== 'function'
    || typeof prisma.workerChannelIdentity?.findFirst !== 'function'
  ) {
    throw receiptError(
      'La persistencia de constancias privadas no está disponible.',
      'WORKER_PAYMENT_PRIVATE_RECEIPT_CONFIGURATION_INVALID',
    );
  }
}

function generatedToken(receipt, deps) {
  const issuedAt = normalizedDate(receipt.issuedAt, 'issuedAt');
  const expiresAt = normalizedDate(receipt.expiresAt, 'expiresAt');
  const ttlMs = expiresAt.getTime() - issuedAt.getTime();
  if (ttlMs !== WORKER_PAYMENT_PRIVATE_RECEIPT_TTL_MS || ttlMs % 1_000 !== 0) {
    throw receiptError(
      'La vigencia de la constancia privada no es válida.',
      'WORKER_PAYMENT_PRIVATE_RECEIPT_CONFIGURATION_INVALID',
    );
  }
  try {
    const generator = deps.generateWebviewToken ?? generateWebviewToken;
    return generator(receipt.workerId, {
      now: issuedAt.getTime(),
      ttlSeconds: ttlMs / 1_000,
      purpose: WORKER_PAYMENT_PRIVATE_RECEIPT_TOKEN_PURPOSE,
      scope: receipt.id,
      ...(deps.webviewSecret ? { secret: deps.webviewSecret } : {}),
    });
  } catch (cause) {
    throw receiptError(
      'No se pudo emitir el acceso protegido a la constancia.',
      'WORKER_PAYMENT_PRIVATE_RECEIPT_CONFIGURATION_INVALID',
      cause,
    );
  }
}

export function reconstructWorkerPaymentPrivateReceiptToken(receipt, deps = {}) {
  const tokenHash = typeof receipt?.tokenHash === 'string'
    ? receipt.tokenHash.trim().toLowerCase()
    : '';
  if (!SHA256_PATTERN.test(tokenHash)) {
    throw receiptError(
      'La constancia privada no puede reconstruir su acceso.',
      'WORKER_PAYMENT_PRIVATE_RECEIPT_CONFIGURATION_INVALID',
    );
  }
  const token = generatedToken(receipt, deps);
  if (!safeHashEqual(sha256(token), tokenHash)) {
    throw receiptError(
      'La credencial reconstruida no coincide con la constancia.',
      'WORKER_PAYMENT_PRIVATE_RECEIPT_CONFIGURATION_INVALID',
    );
  }
  return token;
}

function exactExistingReceipt(receipt, input, companion) {
  return exactRecord(receipt, {
    organizationId: input.organizationId,
    projectId: input.projectId,
    connectionId: input.connectionId,
    flowSessionId: input.flowSessionId,
    workerId: input.workerId,
    personId: input.personId,
    channelIdentityId: input.channelIdentityId,
    destinationId: companion.destinationId,
    sourceWebhookEventId: input.sourceWebhookEventId,
    paymentPurpose: companion.paymentPurpose,
    contentVersion: WORKER_PAYMENT_PRIVATE_RECEIPT_CONTENT_VERSION,
  });
}

async function requireIssueContext(prisma, input) {
  const companion = await prisma.workerPaymentFlowSession.findUnique({
    where: { flowSessionId: input.flowSessionId },
  });
  if (!companion?.receiptDeliveryRequested) return { requested: false, companion: null };
  if (
    !exactRecord(companion, {
      flowSessionId: input.flowSessionId,
      organizationId: input.organizationId,
      projectId: input.projectId,
      connectionId: input.connectionId,
      workerId: input.workerId,
      personId: input.personId,
      channelIdentityId: input.channelIdentityId,
      submissionStatus: 'SUCCEEDED',
    })
    || typeof companion.destinationId !== 'string'
    || !companion.destinationId
    || !PURPOSES.has(companion.paymentPurpose)
    || !companion.submittedAt
  ) {
    throw receiptError(
      'La constancia no coincide con una recepción terminal confirmada.',
      'WORKER_PAYMENT_PRIVATE_RECEIPT_SCOPE_FORBIDDEN',
    );
  }

  const [base, destination, webhook, project, connection, worker, person, channel] = await Promise.all([
    prisma.whatsAppFlowSession.findFirst({
      where: {
        id: input.flowSessionId,
        organizationId: input.organizationId,
        projectId: input.projectId,
        workerId: input.workerId,
        consumedExternalId: input.consumedExternalId,
        consumedAt: { not: null },
      },
    }),
    prisma.workerPaymentDestination.findFirst({
      where: {
        id: companion.destinationId,
        organizationId: input.organizationId,
        personId: input.personId,
        purpose: companion.paymentPurpose,
        flowSubmissionReservationId: companion.submissionReservationId,
      },
      select: {
        id: true,
        organizationId: true,
        personId: true,
        purpose: true,
        type: true,
        lastFour: true,
        flowSubmissionReservationId: true,
      },
    }),
    prisma.webhookEvent.findFirst({
      where: {
        id: input.sourceWebhookEventId,
        projectId: input.projectId,
        eventType: 'message',
        status: 'PROCESSING',
        appliedAt: null,
      },
      select: { id: true, projectId: true, eventType: true, status: true, appliedAt: true },
    }),
    prisma.project.findFirst({
      where: {
        id: input.projectId,
        organizationId: input.organizationId,
        status: { in: ['ACTIVE', 'PAUSED'] },
      },
      select: { id: true, organizationId: true, status: true },
    }),
    prisma.whatsAppConnection.findFirst({
      where: { id: input.connectionId, projectId: input.projectId, enabled: true },
      select: { id: true, projectId: true, enabled: true },
    }),
    prisma.worker.findFirst({
      where: {
        id: input.workerId,
        projectId: input.projectId,
        organizationId: input.organizationId,
        personId: input.personId,
        active: true,
      },
      select: { id: true, projectId: true, organizationId: true, personId: true, active: true },
    }),
    prisma.workerPerson.findFirst({
      where: {
        id: input.personId,
        organizationId: input.organizationId,
        status: 'ACTIVE',
        identityStatus: 'VERIFIED',
      },
      select: { id: true, organizationId: true, status: true, identityStatus: true },
    }),
    prisma.workerChannelIdentity.findFirst({
      where: {
        id: input.channelIdentityId,
        organizationId: input.organizationId,
        personId: input.personId,
        provider: 'WHATSAPP',
        status: 'VERIFIED',
        revokedAt: null,
      },
      select: { id: true, organizationId: true, personId: true, provider: true, status: true },
    }),
  ]);
  if (
    !base
    || !destination
    || !webhook
    || !project
    || !connection
    || !worker
    || !person
    || !channel
    || !DESTINATION_TYPES.has(destination.type)
    || !validDestinationLastFour(destination.type, destination.lastFour)
  ) {
    throw receiptError(
      'La constancia no coincide con el contexto laboral verificado.',
      'WORKER_PAYMENT_PRIVATE_RECEIPT_SCOPE_FORBIDDEN',
    );
  }
  return { requested: true, companion, destination };
}

/**
 * Creates only the privacy-minimal receipt record. The candidate bearer is
 * discarded after hashing and is deterministically reconstructed only after
 * the WhatsApp automatic-delivery claim has been won.
 */
export async function issueWorkerPaymentPrivateReceiptInTransaction(
  prisma,
  rawInput,
  deps = {},
) {
  assertCompanionStore(prisma);
  const input = normalizedIssueInput(rawInput);
  const context = await requireIssueContext(prisma, input);
  if (!context.requested) return null;
  assertIssueStore(prisma);

  const existing = await receiptDelegate(prisma).findUnique({
    where: { flowSessionId: input.flowSessionId },
  });
  if (existing) {
    if (!exactExistingReceipt(existing, input, context.companion)) {
      throw receiptError(
        'La sesión ya está vinculada a otra constancia privada.',
        'WORKER_PAYMENT_PRIVATE_RECEIPT_CONFLICT',
      );
    }
    return {
      receipt: existing,
      descriptor: { version: 1, receiptId: existing.id },
      replayed: true,
    };
  }

  const issuedAt = currentDate(deps);
  const expiresAt = new Date(issuedAt.getTime() + WORKER_PAYMENT_PRIVATE_RECEIPT_TTL_MS);
  const idFactory = deps.idFactory ?? crypto.randomUUID;
  const id = uuid(idFactory(), 'receiptId');
  const data = {
    id,
    organizationId: input.organizationId,
    projectId: input.projectId,
    connectionId: input.connectionId,
    flowSessionId: input.flowSessionId,
    workerId: input.workerId,
    personId: input.personId,
    channelIdentityId: input.channelIdentityId,
    destinationId: context.companion.destinationId,
    sourceWebhookEventId: input.sourceWebhookEventId,
    paymentPurpose: context.companion.paymentPurpose,
    destinationType: context.destination.type,
    destinationLastFour: context.destination.lastFour,
    receivedAt: normalizedDate(context.companion.submittedAt, 'submittedAt'),
    contentVersion: WORKER_PAYMENT_PRIVATE_RECEIPT_CONTENT_VERSION,
    contentSha256: '',
    tokenHash: '',
    issuedAt,
    expiresAt,
    accessCount: 0,
  };
  data.contentSha256 = workerPaymentPrivateReceiptContentSha256(data);
  const candidateToken = generatedToken(data, deps);
  data.tokenHash = sha256(candidateToken);
  const receipt = await receiptDelegate(prisma).create({ data });
  return {
    receipt,
    descriptor: { version: 1, receiptId: receipt.id },
    replayed: false,
  };
}

function verifyTokenBeforeStore(input, now, deps) {
  const verifier = deps.verifyWebviewToken ?? verifyWebviewToken;
  let verified = false;
  try {
    verified = verifier(input.workerId, input.token, {
      now: now.getTime(),
      purpose: WORKER_PAYMENT_PRIVATE_RECEIPT_TOKEN_PURPOSE,
      scope: input.receiptId,
      ...(deps.webviewSecret ? { secret: deps.webviewSecret } : {}),
    });
  } catch (cause) {
    throw receiptError(
      'No se pudo verificar el acceso protegido.',
      'WORKER_PAYMENT_PRIVATE_RECEIPT_CONFIGURATION_INVALID',
      cause,
    );
  }
  if (!verified) {
    throw receiptError(
      'El acceso a la constancia no es válido.',
      'WORKER_PAYMENT_PRIVATE_RECEIPT_TOKEN_INVALID',
    );
  }
}

export function assertWorkerPaymentPrivateReceiptTokenSignature(rawInput, deps = {}) {
  const input = normalizedAccessInput(rawInput);
  const now = currentDate(deps);
  verifyTokenBeforeStore(input, now, deps);
  return input;
}

async function runSerializable(prisma, operation) {
  if (typeof prisma.$transaction !== 'function') return operation(prisma);
  return prisma.$transaction(operation, { isolationLevel: 'Serializable' });
}

async function requireLiveAccessContext(transaction, receipt) {
  const [project, connection, worker, person, channel] = await Promise.all([
    transaction.project.findFirst({
      where: {
        id: receipt.projectId,
        organizationId: receipt.organizationId,
        status: { in: ['ACTIVE', 'PAUSED'] },
      },
      select: { id: true },
    }),
    transaction.whatsAppConnection.findFirst({
      where: {
        id: receipt.connectionId,
        projectId: receipt.projectId,
        enabled: true,
      },
      select: { id: true },
    }),
    transaction.worker.findFirst({
      where: {
        id: receipt.workerId,
        projectId: receipt.projectId,
        organizationId: receipt.organizationId,
        personId: receipt.personId,
        active: true,
      },
      select: { id: true },
    }),
    transaction.workerPerson.findFirst({
      where: {
        id: receipt.personId,
        organizationId: receipt.organizationId,
        status: 'ACTIVE',
        identityStatus: 'VERIFIED',
      },
      select: { id: true },
    }),
    transaction.workerChannelIdentity.findFirst({
      where: {
        id: receipt.channelIdentityId,
        organizationId: receipt.organizationId,
        personId: receipt.personId,
        provider: 'WHATSAPP',
        status: 'VERIFIED',
        revokedAt: null,
      },
      select: { id: true },
    }),
  ]);
  if (!project || !connection || !worker || !person || !channel) {
    throw receiptError(
      'La constancia ya no está vinculada al contexto laboral verificado.',
      'WORKER_PAYMENT_PRIVATE_RECEIPT_SCOPE_FORBIDDEN',
    );
  }
}

export function workerPaymentPrivateReceiptDto(receipt) {
  const destinationType = String(receipt?.destinationType || '').toUpperCase();
  const paymentPurpose = String(receipt?.paymentPurpose || '').toUpperCase();
  const destinationLastFour = typeof receipt?.destinationLastFour === 'string'
    ? receipt.destinationLastFour.trim()
    : '';
  const contentSha256 = typeof receipt?.contentSha256 === 'string'
    ? receipt.contentSha256.trim().toLowerCase()
    : '';
  if (
    !UUID_PATTERN.test(String(receipt?.id || ''))
    || !DESTINATION_TYPES.has(destinationType)
    || !PURPOSES.has(paymentPurpose)
    || receipt?.contentVersion !== WORKER_PAYMENT_PRIVATE_RECEIPT_CONTENT_VERSION
    || !validDestinationLastFour(destinationType, destinationLastFour)
    || !SHA256_PATTERN.test(contentSha256)
  ) {
    throw receiptError(
      'La constancia almacenada no es válida.',
      'WORKER_PAYMENT_PRIVATE_RECEIPT_CONFIGURATION_INVALID',
    );
  }
  const expectedContentSha256 = workerPaymentPrivateReceiptContentSha256(receipt);
  if (!safeHashEqual(contentSha256, expectedContentSha256)) {
    throw receiptError(
      'La huella de contenido de la constancia no coincide.',
      'WORKER_PAYMENT_PRIVATE_RECEIPT_CONFIGURATION_INVALID',
    );
  }
  return Object.freeze({
    reference: receipt.id,
    receivedAt: normalizedDate(receipt.receivedAt, 'receivedAt').toISOString(),
    issuedAt: normalizedDate(receipt.issuedAt, 'issuedAt').toISOString(),
    paymentPurpose,
    destinationType,
    maskedReference: destinationType === 'CBU' || destinationType === 'CVU'
      ? `•••• ${destinationLastFour}`
      : null,
    status: WORKER_PAYMENT_PRIVATE_RECEIPT_STATUS,
    integritySha256: contentSha256,
  });
}

/**
 * Verifies the signed bearer before any database lookup, then consumes one of
 * the bounded private accesses with a serializable compare-and-swap.
 */
export async function readWorkerPaymentPrivateReceipt(prisma, rawInput, deps = {}) {
  assertAccessStore(prisma);
  const input = normalizedAccessInput(rawInput);
  const now = currentDate(deps);
  verifyTokenBeforeStore(input, now, deps);

  return runSerializable(prisma, async (transaction) => {
    const receipt = await transaction.workerPaymentPrivateReceipt.findFirst({
      where: { id: input.receiptId, workerId: input.workerId },
    });
    if (!receipt) {
      throw receiptError(
        'La constancia privada no está disponible.',
        'WORKER_PAYMENT_PRIVATE_RECEIPT_NOT_FOUND',
      );
    }
    if (!safeHashEqual(sha256(input.token), receipt.tokenHash)) {
      throw receiptError(
        'El acceso a la constancia no es válido.',
        'WORKER_PAYMENT_PRIVATE_RECEIPT_TOKEN_INVALID',
      );
    }
    if (receipt.revokedAt) {
      throw receiptError(
        'La constancia privada fue revocada.',
        'WORKER_PAYMENT_PRIVATE_RECEIPT_REVOKED',
      );
    }
    const expiresAt = normalizedDate(receipt.expiresAt, 'expiresAt');
    if (expiresAt.getTime() <= now.getTime()) {
      throw receiptError(
        'La constancia privada venció.',
        'WORKER_PAYMENT_PRIVATE_RECEIPT_EXPIRED',
      );
    }
    if (
      !Number.isSafeInteger(receipt.accessCount)
      || receipt.accessCount < 0
      || receipt.accessCount >= WORKER_PAYMENT_PRIVATE_RECEIPT_MAX_ACCESSES
    ) {
      throw receiptError(
        'La constancia privada alcanzó su límite de accesos.',
        'WORKER_PAYMENT_PRIVATE_RECEIPT_ACCESS_LIMIT',
      );
    }
    await requireLiveAccessContext(transaction, receipt);
    const updated = await transaction.workerPaymentPrivateReceipt.updateMany({
      where: {
        id: receipt.id,
        workerId: receipt.workerId,
        tokenHash: receipt.tokenHash,
        accessCount: receipt.accessCount,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: {
        accessCount: { increment: 1 },
        firstAccessedAt: receipt.firstAccessedAt || now,
        lastAccessedAt: now,
      },
    });
    if (updated.count !== 1) {
      throw receiptError(
        'La constancia cambió mientras se validaba el acceso.',
        'WORKER_PAYMENT_PRIVATE_RECEIPT_CONFLICT',
      );
    }
    return {
      receipt: workerPaymentPrivateReceiptDto(receipt),
      expiresAt: expiresAt.toISOString(),
      remainingAccesses: WORKER_PAYMENT_PRIVATE_RECEIPT_MAX_ACCESSES - receipt.accessCount - 1,
    };
  });
}

function hostedEnvironment(environment) {
  const vercelEnvironment = String(environment?.VERCEL_ENV || '').toLowerCase();
  return Boolean(environment?.VERCEL)
    || environment?.NODE_ENV === 'production'
    || vercelEnvironment === 'production'
    || vercelEnvironment === 'preview';
}

function strictPublicOrigin(value, environment) {
  let parsed;
  try {
    parsed = new URL(String(value));
  } catch {
    throw receiptError(
      'La URL pública de la constancia no es válida.',
      'WORKER_PAYMENT_PRIVATE_RECEIPT_CONFIGURATION_INVALID',
    );
  }
  const localHostname = ['localhost', '127.0.0.1', '[::1]'].includes(
    parsed.hostname.toLowerCase(),
  );
  const permittedLocalHttp = parsed.protocol === 'http:'
    && localHostname
    && !hostedEnvironment(environment);
  if (
    (parsed.protocol !== 'https:' && !permittedLocalHttp)
    || parsed.username
    || parsed.password
    || parsed.pathname !== '/'
    || parsed.search
    || parsed.hash
  ) {
    throw receiptError(
      'La URL pública de la constancia no es un origen seguro.',
      'WORKER_PAYMENT_PRIVATE_RECEIPT_CONFIGURATION_INVALID',
    );
  }
  return parsed.toString().replace(/\/$/, '');
}

export function buildWorkerPaymentPrivateReceiptLink(
  rawInput,
  environment = process.env,
  deps = {},
) {
  const input = objectInput(rawInput, 'input');
  rejectUnknownFields(input, LINK_FIELDS);
  const receipt = objectInput(input.receipt, 'receipt');
  const receiptId = uuid(receipt.id, 'receiptId');
  const workerId = identifier(receipt.workerId, 'workerId');
  const token = identifier(input.token, 'token', { max: 4_096, pattern: TOKEN_PATTERN });
  const resolver = deps.resolveWhatsAppPublicAppUrl ?? resolveWhatsAppPublicAppUrl;
  let publicAppUrl;
  try {
    publicAppUrl = input.publicAppUrl === undefined
      ? resolver(environment)
      : input.publicAppUrl;
  } catch (cause) {
    throw receiptError(
      'La URL pública de la constancia no está configurada.',
      'WORKER_PAYMENT_PRIVATE_RECEIPT_CONFIGURATION_INVALID',
      cause,
    );
  }
  const url = new URL(
    '/webview/worker-payment-receipt',
    strictPublicOrigin(publicAppUrl, environment),
  );
  url.searchParams.set('worker', workerId);
  url.searchParams.set('receipt', receiptId);
  url.hash = `token=${encodeURIComponent(token)}`;
  return url.toString();
}
