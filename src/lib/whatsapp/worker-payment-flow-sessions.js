import crypto from 'node:crypto';

import { subscriptionAllowsWrites } from '../plans.js';
import {
  normalizeWorkerBankKey,
  normalizeWorkerPaymentAlias,
  normalizeWorkerWhatsAppAddress,
  normalizeWorkerWhatsAppProviderSubject,
  readWorkerFinancialFingerprintKeyRegistry,
  workerFinancialFingerprintCandidates,
} from '../worker-financial-data.js';
import {
  assertWorkerPaymentPrivacyNoticeEvidence,
  getWorkerPaymentPrivacyNotice,
} from '../worker-payment-privacy-notices.js';
import {
  DEFAULT_WHATSAPP_FLOW_SESSION_TTL_MS,
  issueWhatsAppFlowSession,
} from './flow-sessions.js';
import {
  validateWhatsAppFlowReply,
  WhatsAppFlowReplyError,
} from './flows.js';
import { workerPaymentFlowExpectedOperationKeys } from './worker-payment-flow-submissions.js';

export const WORKER_PAYMENT_FLOW_BLUEPRINT_KEY = 'worker-payment-destination';
export const WORKER_PAYMENT_FLOW_SCREEN_ID = 'WORKER_PAYMENT_DESTINATION';
export const WORKER_PAYMENT_FLOW_TYPE = 'worker_payment_destination';
export const WORKER_PAYMENT_FLOW_MIN_RESERVATION_REMAINING_MS = 60 * 1_000;
export const WORKER_PAYMENT_FLOW_SUCCEEDED_REPLAY_GRACE_MS = 24 * 60 * 60 * 1_000;

const SESSION_SECRET_ENV = 'WORKER_PAYMENT_FLOW_SESSION_SECRET';
const SESSION_SECRET_ACTIVE_KEY_ID_ENV = 'WORKER_PAYMENT_FLOW_SESSION_HMAC_ACTIVE_KEY_ID';
const SESSION_SECRET_REGISTRY_ENV = 'WORKER_PAYMENT_FLOW_SESSION_HMAC_KEYRING_JSON';
const SESSION_SECRET_KEY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const MAX_SESSION_HMAC_KEYS = 32;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SAFE_IDENTIFIER_PATTERN = /^[^\u0000-\u001f\u007f]{1,190}$/;
const NOTICE_VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const DEFAULT_TRANSACTION_ATTEMPTS = 3;
const MAX_TRANSACTION_ATTEMPTS = 5;

const ISSUE_FIELDS = new Set([
  'organizationId',
  'projectId',
  'connectionId',
  'workerId',
  'personId',
  'channelIdentityId',
  'phoneNumberId',
  'recipient',
  'recipientPhone',
  'blueprintKey',
  'flowId',
  'screenId',
  'flowType',
  'sourceExternalId',
  'notice',
]);
const NOTICE_FIELDS = new Set(['version', 'contentSha256']);
const ENDPOINT_SCOPE_FIELDS = new Set([
  'flowSessionId',
  'organizationId',
  'projectId',
  'connectionId',
  'phoneNumberId',
]);
const FORM_FIELDS = new Set([
  'purpose',
  'destination_type',
  'destination_value',
  'holder_declaration',
  'capture_notice_acknowledged',
]);
const PAYMENT_PURPOSES = new Map([
  ['salary', 'SALARY'],
  ['reimbursement', 'REIMBURSEMENT'],
]);
const DESTINATION_TYPES = new Set(['cbu', 'cvu', 'alias']);

const ERROR_STATUS = Object.freeze({
  WORKER_PAYMENT_FLOW_SESSION_INPUT_INVALID: 400,
  WORKER_PAYMENT_FLOW_SESSION_UNKNOWN_FIELDS: 400,
  WORKER_PAYMENT_FLOW_SESSION_SCOPE_FORBIDDEN: 403,
  WORKER_PAYMENT_FLOW_SESSION_CHANNEL_UNVERIFIED: 403,
  WORKER_PAYMENT_FLOW_SESSION_IDENTITY_UNVERIFIED: 422,
  WORKER_PAYMENT_FLOW_SESSION_SUBSCRIPTION_BLOCKED: 402,
  WORKER_PAYMENT_FLOW_SESSION_CONFLICT: 409,
  WORKER_PAYMENT_FLOW_SESSION_OUTCOME_UNCERTAIN: 409,
  WORKER_PAYMENT_FLOW_SESSION_EXPIRED: 410,
  WORKER_PAYMENT_FLOW_SESSION_INVALID: 427,
  WORKER_PAYMENT_FLOW_SESSION_CONFIGURATION_INVALID: 500,
  WORKER_PAYMENT_FLOW_SESSION_SECRET_INVALID: 503,
  WORKER_PAYMENT_FLOW_SESSION_SECRET_REQUIRED: 503,
});

export class WorkerPaymentFlowSessionError extends Error {
  constructor(message, code = 'WORKER_PAYMENT_FLOW_SESSION_INPUT_INVALID', { cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'WorkerPaymentFlowSessionError';
    this.code = code;
    this.status = ERROR_STATUS[code] || 500;
  }
}

function sessionError(message, code, options) {
  return new WorkerPaymentFlowSessionError(message, code, options);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function objectInput(value, field) {
  if (!isPlainObject(value)) {
    throw sessionError(
      `${field} debe ser un objeto valido.`,
      'WORKER_PAYMENT_FLOW_SESSION_INPUT_INVALID',
    );
  }
  return value;
}

function rejectUnknownFields(value, allowed) {
  if (Object.keys(value).some((field) => !allowed.has(field))) {
    // Field names are deliberately not reflected: future clients must not be
    // able to bounce financial data into errors or logs.
    throw sessionError(
      'La solicitud contiene campos no permitidos.',
      'WORKER_PAYMENT_FLOW_SESSION_UNKNOWN_FIELDS',
    );
  }
}

function identifier(value, field, { max = 190, pattern = SAFE_IDENTIFIER_PATTERN } = {}) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > max || !pattern.test(normalized)) {
    throw sessionError(
      `${field} es invalido.`,
      'WORKER_PAYMENT_FLOW_SESSION_INPUT_INVALID',
    );
  }
  return normalized;
}

function uuid(value, field) {
  return identifier(value, field, { max: 36, pattern: UUID_PATTERN }).toLowerCase();
}

function normalizedDate(value, field) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw sessionError(`${field} es invalido.`, 'WORKER_PAYMENT_FLOW_SESSION_INPUT_INVALID');
  }
  return date;
}

function normalizedNow(value) {
  return normalizedDate(value ?? Date.now(), 'now');
}

function normalizedAttempts(value) {
  const attempts = value ?? DEFAULT_TRANSACTION_ATTEMPTS;
  if (
    !Number.isSafeInteger(attempts)
    || attempts < 1
    || attempts > MAX_TRANSACTION_ATTEMPTS
  ) {
    throw sessionError(
      'transactionAttempts es invalido.',
      'WORKER_PAYMENT_FLOW_SESSION_INPUT_INVALID',
    );
  }
  return attempts;
}

function normalizedWorkerPaymentFlowTtl(value) {
  const ttlMs = value ?? DEFAULT_WHATSAPP_FLOW_SESSION_TTL_MS;
  if (
    !Number.isSafeInteger(ttlMs)
    || ttlMs <= 0
    || ttlMs > DEFAULT_WHATSAPP_FLOW_SESSION_TTL_MS
  ) {
    throw sessionError(
      'El Flow de destino de cobro no puede superar 30 minutos.',
      'WORKER_PAYMENT_FLOW_SESSION_INPUT_INVALID',
    );
  }
  return ttlMs;
}

function normalizedNotice(value) {
  const notice = objectInput(value, 'notice');
  rejectUnknownFields(notice, NOTICE_FIELDS);
  const version = typeof notice.version === 'string' ? notice.version.trim() : '';
  const contentSha256 = typeof notice.contentSha256 === 'string'
    ? notice.contentSha256.trim().toLowerCase()
    : '';
  if (!NOTICE_VERSION_PATTERN.test(version) || !SHA256_PATTERN.test(contentSha256)) {
    throw sessionError(
      'El aviso de privacidad fijado es invalido.',
      'WORKER_PAYMENT_FLOW_SESSION_INPUT_INVALID',
    );
  }
  try {
    assertWorkerPaymentPrivacyNoticeEvidence(version, contentSha256);
  } catch (cause) {
    throw sessionError(
      'El aviso de privacidad no coincide con el registro inmutable.',
      'WORKER_PAYMENT_FLOW_SESSION_INPUT_INVALID',
      { cause },
    );
  }
  return { version, contentSha256 };
}

function normalizedRecipient(value) {
  try {
    const address = normalizeWorkerWhatsAppAddress(String(value || ''));
    return {
      address,
      providerSubject: normalizeWorkerWhatsAppProviderSubject(address),
      digits: address.slice(1),
    };
  } catch (cause) {
    throw sessionError(
      'El destinatario de WhatsApp es invalido.',
      'WORKER_PAYMENT_FLOW_SESSION_INPUT_INVALID',
      { cause },
    );
  }
}

function normalizedIssueInput(rawInput) {
  const input = objectInput(rawInput, 'input');
  rejectUnknownFields(input, ISSUE_FIELDS);
  const blueprintKey = identifier(input.blueprintKey, 'blueprintKey', {
    max: 100,
    pattern: /^[a-z0-9][a-z0-9-]{0,99}$/,
  });
  const screenId = identifier(input.screenId, 'screenId', {
    max: 30,
    pattern: /^[A-Z][A-Z0-9_]{0,29}$/,
  });
  const flowType = identifier(input.flowType, 'flowType', {
    max: 64,
    pattern: /^[a-z0-9][a-z0-9_-]{0,63}$/,
  });
  if (
    blueprintKey !== WORKER_PAYMENT_FLOW_BLUEPRINT_KEY
    || screenId !== WORKER_PAYMENT_FLOW_SCREEN_ID
    || flowType !== WORKER_PAYMENT_FLOW_TYPE
  ) {
    throw sessionError(
      'La sesion no corresponde al Flow de destino de cobro.',
      'WORKER_PAYMENT_FLOW_SESSION_INPUT_INVALID',
    );
  }
  const recipient = normalizedRecipient(input.recipient ?? input.recipientPhone);
  return {
    organizationId: identifier(input.organizationId, 'organizationId'),
    projectId: identifier(input.projectId, 'projectId'),
    connectionId: identifier(input.connectionId, 'connectionId'),
    workerId: identifier(input.workerId, 'workerId'),
    personId: identifier(input.personId, 'personId'),
    channelIdentityId: identifier(input.channelIdentityId, 'channelIdentityId'),
    phoneNumberId: identifier(input.phoneNumberId, 'phoneNumberId', {
      max: 40,
      pattern: /^\d{5,40}$/,
    }),
    recipient,
    blueprintKey,
    flowId: identifier(input.flowId, 'flowId', { max: 40, pattern: /^\d{5,40}$/ }),
    screenId,
    flowType,
    sourceExternalId: identifier(input.sourceExternalId, 'sourceExternalId', { max: 512 }),
    notice: normalizedNotice(input.notice),
  };
}

function normalizedEndpointScope(rawInput) {
  const input = objectInput(rawInput, 'scope');
  rejectUnknownFields(input, ENDPOINT_SCOPE_FIELDS);
  return {
    flowSessionId: uuid(input.flowSessionId, 'flowSessionId'),
    organizationId: identifier(input.organizationId, 'organizationId'),
    projectId: identifier(input.projectId, 'projectId'),
    connectionId: identifier(input.connectionId, 'connectionId'),
    phoneNumberId: identifier(input.phoneNumberId, 'phoneNumberId', {
      max: 40,
      pattern: /^\d{5,40}$/,
    }),
  };
}

function normalizedForm(rawForm) {
  const form = objectInput(rawForm, 'form');
  rejectUnknownFields(form, FORM_FIELDS);
  if (form.holder_declaration !== true || form.capture_notice_acknowledged !== true) {
    throw sessionError(
      'Las declaraciones obligatorias deben aceptarse expresamente.',
      'WORKER_PAYMENT_FLOW_SESSION_INPUT_INVALID',
    );
  }
  const purpose = typeof form.purpose === 'string' ? form.purpose.trim().toLowerCase() : '';
  const destinationType = typeof form.destination_type === 'string'
    ? form.destination_type.trim().toLowerCase()
    : '';
  if (!PAYMENT_PURPOSES.has(purpose) || !DESTINATION_TYPES.has(destinationType)) {
    throw sessionError(
      'El destino de cobro es invalido.',
      'WORKER_PAYMENT_FLOW_SESSION_INPUT_INVALID',
    );
  }
  let destinationValue;
  try {
    destinationValue = destinationType === 'alias'
      ? normalizeWorkerPaymentAlias(form.destination_value)
      : normalizeWorkerBankKey(form.destination_value, destinationType.toUpperCase());
  } catch (cause) {
    throw sessionError(
      'El destino de cobro es invalido.',
      'WORKER_PAYMENT_FLOW_SESSION_INPUT_INVALID',
      { cause },
    );
  }
  return {
    purpose,
    paymentPurpose: PAYMENT_PURPOSES.get(purpose),
    destinationType,
    destinationValue,
    holderDeclaration: true,
    noticeAcknowledged: true,
  };
}

export function assertWorkerPaymentFlowSessionSecret(value = process.env[SESSION_SECRET_ENV]) {
  const secret = typeof value === 'string' ? value.trim() : '';
  if (!secret) {
    throw sessionError(
      `${SESSION_SECRET_ENV} es obligatorio.`,
      'WORKER_PAYMENT_FLOW_SESSION_SECRET_REQUIRED',
    );
  }
  if (
    Buffer.byteLength(secret, 'utf8') < 32
    || /replace-with|change-?me|placeholder|example-secret/i.test(secret)
  ) {
    throw sessionError(
      `${SESSION_SECRET_ENV} debe ser un secreto dedicado de al menos 32 bytes.`,
      'WORKER_PAYMENT_FLOW_SESSION_SECRET_INVALID',
    );
  }
  return secret;
}

function normalizedSessionSecretRegistry(value) {
  const registry = objectInput(value, 'secretRegistry');
  const activeKeyId = typeof registry.activeKeyId === 'string'
    ? registry.activeKeyId.trim()
    : '';
  const rawKeys = registry.keys;
  if (
    !SESSION_SECRET_KEY_ID_PATTERN.test(activeKeyId)
    || !isPlainObject(rawKeys)
  ) {
    throw sessionError(
      'El keyring HMAC de sesiones de cobro es invalido.',
      'WORKER_PAYMENT_FLOW_SESSION_SECRET_INVALID',
    );
  }
  const entries = Object.entries(rawKeys);
  if (entries.length < 1 || entries.length > MAX_SESSION_HMAC_KEYS) {
    throw sessionError(
      'El keyring HMAC de sesiones de cobro tiene una cantidad invalida de claves.',
      'WORKER_PAYMENT_FLOW_SESSION_SECRET_INVALID',
    );
  }
  const keys = new Map();
  const uniqueSecrets = new Set();
  for (const [rawKeyId, rawSecret] of entries) {
    const keyId = String(rawKeyId || '').trim();
    if (!SESSION_SECRET_KEY_ID_PATTERN.test(keyId) || keys.has(keyId)) {
      throw sessionError(
        'El keyring HMAC de sesiones de cobro contiene un identificador invalido.',
        'WORKER_PAYMENT_FLOW_SESSION_SECRET_INVALID',
      );
    }
    const secret = assertWorkerPaymentFlowSessionSecret(rawSecret);
    if (uniqueSecrets.has(secret)) {
      throw sessionError(
        'Cada identificador del keyring HMAC debe tener una clave distinta.',
        'WORKER_PAYMENT_FLOW_SESSION_SECRET_INVALID',
      );
    }
    uniqueSecrets.add(secret);
    keys.set(keyId, secret);
  }
  if (!keys.has(activeKeyId)) {
    throw sessionError(
      'La clave HMAC activa no existe en el keyring de sesiones de cobro.',
      'WORKER_PAYMENT_FLOW_SESSION_SECRET_INVALID',
    );
  }
  return { activeKeyId, keys };
}

export function readWorkerPaymentFlowSessionSecretRegistry({
  activeKeyId = process.env[SESSION_SECRET_ACTIVE_KEY_ID_ENV],
  keyringJson = process.env[SESSION_SECRET_REGISTRY_ENV],
  legacySecret = process.env[SESSION_SECRET_ENV],
} = {}) {
  const hasKeyringConfiguration = Boolean(
    String(activeKeyId || '').trim() || String(keyringJson || '').trim(),
  );
  if (!hasKeyringConfiguration) {
    return normalizedSessionSecretRegistry({
      activeKeyId: 'legacy-v1',
      keys: { 'legacy-v1': assertWorkerPaymentFlowSessionSecret(legacySecret) },
    });
  }
  let keys;
  try {
    keys = JSON.parse(String(keyringJson || ''));
  } catch {
    throw sessionError(
      `${SESSION_SECRET_REGISTRY_ENV} debe ser JSON valido.`,
      'WORKER_PAYMENT_FLOW_SESSION_SECRET_INVALID',
    );
  }
  return normalizedSessionSecretRegistry({ activeKeyId, keys });
}

function resolvedSessionSecretRegistry(secret, registry) {
  if (secret !== undefined && registry !== undefined) {
    throw sessionError(
      'La clave HMAC singular y el keyring no pueden configurarse juntos.',
      'WORKER_PAYMENT_FLOW_SESSION_SECRET_INVALID',
    );
  }
  if (registry !== undefined) return normalizedSessionSecretRegistry(registry);
  if (secret !== undefined) {
    return normalizedSessionSecretRegistry({
      activeKeyId: 'injected-v1',
      keys: { 'injected-v1': assertWorkerPaymentFlowSessionSecret(secret) },
    });
  }
  return readWorkerPaymentFlowSessionSecretRegistry();
}

function constantTimeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');
  return leftBuffer.length === rightBuffer.length
    && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function submissionFingerprint(flowSessionId, form, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify({
      domain: 'obrasaas:worker-payment-flow-submission',
      version: 'v1',
      flowSessionId,
      purpose: form.purpose,
      destinationType: form.destinationType,
      destinationValue: form.destinationValue,
      holderDeclaration: form.holderDeclaration,
      noticeAcknowledged: form.noticeAcknowledged,
    }), 'utf8')
    .digest('hex');
}

function submissionFingerprintSet(flowSessionId, form, registry) {
  const candidates = [...registry.keys.entries()].map(([keyId, secret]) => ({
    keyId,
    fingerprint: submissionFingerprint(flowSessionId, form, secret),
  }));
  const active = candidates.find((candidate) => candidate.keyId === registry.activeKeyId);
  if (!active) {
    throw sessionError(
      'La clave HMAC activa no esta disponible.',
      'WORKER_PAYMENT_FLOW_SESSION_SECRET_INVALID',
    );
  }
  return { active: active.fingerprint, activeKeyId: active.keyId, candidates };
}

export function workerPaymentFlowSubmissionOperationKey(flowSessionId, reservationId) {
  return `wpf-terminal:${uuid(flowSessionId, 'flowSessionId')}:${uuid(
    reservationId,
    'reservationId',
  )}`;
}

function isUniqueConstraintError(error) {
  return error?.code === 'P2002' || error?.code === '23505';
}

function assertPrisma(prisma) {
  if (!prisma || typeof prisma.$transaction !== 'function') {
    throw sessionError(
      'La persistencia de sesiones de cobro no esta disponible.',
      'WORKER_PAYMENT_FLOW_SESSION_CONFIGURATION_INVALID',
    );
  }
}

function paymentSessionDelegate(prisma) {
  const delegate = prisma?.workerPaymentFlowSession;
  if (
    !delegate
    || typeof delegate.findUnique !== 'function'
    || typeof delegate.create !== 'function'
    || typeof delegate.updateMany !== 'function'
  ) {
    throw sessionError(
      'La persistencia de sesiones de cobro no esta disponible.',
      'WORKER_PAYMENT_FLOW_SESSION_CONFIGURATION_INVALID',
    );
  }
  return delegate;
}

function baseSessionDelegate(prisma) {
  const delegate = prisma?.whatsAppFlowSession;
  if (!delegate || typeof delegate.findUnique !== 'function') {
    throw sessionError(
      'La sesion criptografica de WhatsApp no esta disponible.',
      'WORKER_PAYMENT_FLOW_SESSION_CONFIGURATION_INVALID',
    );
  }
  return delegate;
}

async function runSerializable(prisma, operation, attempts, { retryUnique = false } = {}) {
  assertPrisma(prisma);
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: 'Serializable' });
    } catch (error) {
      const retryable = error?.code === 'P2034'
        || (retryUnique && isUniqueConstraintError(error));
      if (!retryable || attempt === attempts) throw error;
    }
  }
  throw sessionError(
    'No se pudo establecer una transaccion serializable.',
    'WORKER_PAYMENT_FLOW_SESSION_CONFIGURATION_INVALID',
  );
}

function isReservationWindowPersistenceRejection(error) {
  let current = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (String(current.message || '').includes(
      'worker payment Flow reservation requires a safe live delivery window',
    )) return true;
    current = current.cause;
  }
  return false;
}

function exactRecord(record, expected) {
  return record && Object.entries(expected).every(([field, value]) => record[field] === value);
}

function fingerprintMatches(recordKeyId, recordFingerprint, candidates) {
  return candidates.some((candidate) => (
    candidate.fingerprintKeyId === recordKeyId
    && constantTimeEqual(candidate.fingerprint, recordFingerprint)
  ));
}

function resolvedFingerprintRegistry(value) {
  try {
    return value ?? readWorkerFinancialFingerprintKeyRegistry();
  } catch (cause) {
    throw sessionError(
      'Las claves de identidad de WhatsApp no estan disponibles.',
      'WORKER_PAYMENT_FLOW_SESSION_CONFIGURATION_INVALID',
      { cause },
    );
  }
}

function expectedDestinationFingerprint(form, organizationId, registry) {
  let candidates;
  try {
    candidates = workerFinancialFingerprintCandidates(form.destinationValue, {
      organizationId,
      valueType: form.destinationType.toUpperCase(),
    }, { registry });
  } catch (cause) {
    throw sessionError(
      'No se pudo fijar la huella del destino de cobro.',
      'WORKER_PAYMENT_FLOW_SESSION_CONFIGURATION_INVALID',
      { cause },
    );
  }
  const current = candidates.find(
    (candidate) => candidate.fingerprintKeyId === registry.currentKeyId,
  );
  if (!current || !/^[0-9a-f]{64}$/.test(String(current.fingerprint || ''))) {
    throw sessionError(
      'La huella activa del destino de cobro no esta disponible.',
      'WORKER_PAYMENT_FLOW_SESSION_CONFIGURATION_INVALID',
    );
  }
  return Object.freeze({
    type: form.destinationType.toUpperCase(),
    fingerprintKeyId: current.fingerprintKeyId,
    fingerprint: current.fingerprint,
  });
}

async function loadTrustedScope(
  prisma,
  binding,
  fingerprintRegistry,
  now = new Date(),
  { requireWritableSubscription = true } = {},
) {
  if (
    typeof prisma?.project?.findFirst !== 'function'
    || typeof prisma?.whatsAppConnection?.findFirst !== 'function'
    || typeof prisma?.worker?.findFirst !== 'function'
    || typeof prisma?.workerPerson?.findFirst !== 'function'
    || typeof prisma?.workerChannelIdentity?.findFirst !== 'function'
  ) {
    throw sessionError(
      'La persistencia del alcance de cobro no esta disponible.',
      'WORKER_PAYMENT_FLOW_SESSION_CONFIGURATION_INVALID',
    );
  }

  const [project, connection, worker, person, channel] = await Promise.all([
    prisma.project.findFirst({
      where: {
        id: binding.projectId,
        organizationId: binding.organizationId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        organizationId: true,
        status: true,
        organization: {
          select: {
            subscriptionPlan: true,
            subscriptionStatus: true,
            trialEndsAt: true,
          },
        },
      },
    }),
    prisma.whatsAppConnection.findFirst({
      where: {
        id: binding.connectionId,
        projectId: binding.projectId,
        phoneNumberId: binding.phoneNumberId,
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
    prisma.worker.findFirst({
      where: {
        id: binding.workerId,
        organizationId: binding.organizationId,
        projectId: binding.projectId,
        personId: binding.personId,
        active: true,
      },
      select: {
        id: true,
        organizationId: true,
        projectId: true,
        personId: true,
        active: true,
      },
    }),
    prisma.workerPerson.findFirst({
      where: {
        id: binding.personId,
        organizationId: binding.organizationId,
        status: 'ACTIVE',
        identityStatus: 'VERIFIED',
      },
      select: {
        id: true,
        organizationId: true,
        status: true,
        identityStatus: true,
      },
    }),
    prisma.workerChannelIdentity.findFirst({
      where: {
        id: binding.channelIdentityId,
        organizationId: binding.organizationId,
        personId: binding.personId,
        provider: 'WHATSAPP',
        status: 'VERIFIED',
        revokedAt: null,
      },
      select: {
        id: true,
        organizationId: true,
        personId: true,
        provider: true,
        status: true,
        revokedAt: true,
        addressFingerprintKeyId: true,
        addressFingerprint: true,
        providerSubjectFingerprintKeyId: true,
        providerSubjectFingerprint: true,
      },
    }),
  ]);

  if (!exactRecord(project, {
    id: binding.projectId,
    organizationId: binding.organizationId,
    status: 'ACTIVE',
  }) || !exactRecord(connection, {
    id: binding.connectionId,
    projectId: binding.projectId,
    phoneNumberId: binding.phoneNumberId,
    enabled: true,
    connectionStatus: 'CONNECTED',
  }) || !exactRecord(worker, {
    id: binding.workerId,
    organizationId: binding.organizationId,
    projectId: binding.projectId,
    personId: binding.personId,
    active: true,
  })) {
    throw sessionError(
      'El trabajador no pertenece al alcance activo del Flow.',
      'WORKER_PAYMENT_FLOW_SESSION_SCOPE_FORBIDDEN',
    );
  }
  if (
    requireWritableSubscription
    && !subscriptionAllowsWrites(project.organization, normalizedNow(now))
  ) {
    throw sessionError(
      'La suscripcion de la organizacion no permite registrar destinos de cobro.',
      'WORKER_PAYMENT_FLOW_SESSION_SUBSCRIPTION_BLOCKED',
    );
  }
  if (!exactRecord(person, {
    id: binding.personId,
    organizationId: binding.organizationId,
    status: 'ACTIVE',
    identityStatus: 'VERIFIED',
  })) {
    throw sessionError(
      'La identidad laboral debe estar verificada.',
      'WORKER_PAYMENT_FLOW_SESSION_IDENTITY_UNVERIFIED',
    );
  }
  if (!exactRecord(channel, {
    id: binding.channelIdentityId,
    organizationId: binding.organizationId,
    personId: binding.personId,
    provider: 'WHATSAPP',
    status: 'VERIFIED',
    revokedAt: null,
  })) {
    throw sessionError(
      'El canal de WhatsApp no esta verificado para la persona.',
      'WORKER_PAYMENT_FLOW_SESSION_CHANNEL_UNVERIFIED',
    );
  }

  let addressCandidates;
  let subjectCandidates;
  try {
    addressCandidates = workerFinancialFingerprintCandidates(
      binding.recipient.address,
      { organizationId: binding.organizationId, valueType: 'WHATSAPP_E164' },
      { registry: fingerprintRegistry },
    );
    subjectCandidates = workerFinancialFingerprintCandidates(
      binding.recipient.providerSubject,
      { organizationId: binding.organizationId, valueType: 'WHATSAPP_PROVIDER_SUBJECT' },
      { registry: fingerprintRegistry },
    );
  } catch (cause) {
    throw sessionError(
      'No se pudo verificar criptograficamente el canal de WhatsApp.',
      'WORKER_PAYMENT_FLOW_SESSION_CONFIGURATION_INVALID',
      { cause },
    );
  }
  if (
    !fingerprintMatches(
      channel.addressFingerprintKeyId,
      channel.addressFingerprint,
      addressCandidates,
    )
    || !fingerprintMatches(
      channel.providerSubjectFingerprintKeyId,
      channel.providerSubjectFingerprint,
      subjectCandidates,
    )
  ) {
    throw sessionError(
      'El destinatario no coincide con el canal verificado de la persona.',
      'WORKER_PAYMENT_FLOW_SESSION_CHANNEL_UNVERIFIED',
    );
  }
  return { project, connection, worker, person, channel };
}

function baseBindingFromIssue(binding) {
  return {
    organizationId: binding.organizationId,
    projectId: binding.projectId,
    workerId: binding.workerId,
    phoneNumberId: binding.phoneNumberId,
    recipient: binding.recipient.address,
    blueprintKey: binding.blueprintKey,
    flowId: binding.flowId,
    screenId: binding.screenId,
    flowType: binding.flowType,
    sourceExternalId: binding.sourceExternalId,
  };
}

function exactBaseBinding(base, binding) {
  return exactRecord(base, {
    organizationId: binding.organizationId,
    projectId: binding.projectId,
    workerId: binding.workerId,
    phoneNumberId: binding.phoneNumberId,
    recipientPhone: binding.recipient.digits,
    blueprintKey: binding.blueprintKey,
    flowId: binding.flowId,
    screenId: binding.screenId,
    flowType: binding.flowType,
    sourceExternalId: binding.sourceExternalId,
  });
}

function exactCompanionBinding(companion, base, binding) {
  return exactRecord(companion, {
    flowSessionId: base.id,
    organizationId: binding.organizationId,
    projectId: binding.projectId,
    connectionId: binding.connectionId,
    workerId: binding.workerId,
    personId: binding.personId,
    channelIdentityId: binding.channelIdentityId,
    noticeVersion: binding.notice.version,
    noticeContentSha256: binding.notice.contentSha256,
  }) && normalizedDate(companion.expiresAt, 'expiresAt').getTime()
    === normalizedDate(base.expiresAt, 'expiresAt').getTime();
}

function publicPaymentSession(companion) {
  return {
    flowSessionId: companion.flowSessionId,
    organizationId: companion.organizationId,
    projectId: companion.projectId,
    connectionId: companion.connectionId,
    workerId: companion.workerId,
    personId: companion.personId,
    channelIdentityId: companion.channelIdentityId,
    noticeVersion: companion.noticeVersion,
    noticeContentSha256: companion.noticeContentSha256,
    expiresAt: normalizedDate(companion.expiresAt, 'expiresAt').toISOString(),
    privacyPresentedAt: companion.privacyPresentedAt
      ? normalizedDate(companion.privacyPresentedAt, 'privacyPresentedAt').toISOString()
      : null,
    submissionStatus: companion.submissionStatus,
    revision: Number(companion.revision),
  };
}

/**
 * Produces privacy-minimal evidence for an HMAC retirement gate. A retired key
 * is still required by every bounded terminal replay and by PROCESSING sessions
 * that may need idempotent reconciliation after their transport token expires.
 */
export async function getWorkerPaymentFlowHmacKeyRetirementStatus(
  prisma,
  rawKeyId,
) {
  const keyId = identifier(rawKeyId, 'keyId', {
    max: 64,
    pattern: SESSION_SECRET_KEY_ID_PATTERN,
  });
  if (typeof prisma?.$queryRawUnsafe !== 'function') {
    throw sessionError(
      'La persistencia no puede evaluar el retiro de la clave HMAC.',
      'WORKER_PAYMENT_FLOW_SESSION_CONFIGURATION_INVALID',
    );
  }
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::bigint AS "blockingSessions"
       FROM "WorkerPaymentFlowSession"
      WHERE "submissionFingerprintKeyId" = $1
        AND (
          "expiresAt" + INTERVAL '24 hours' > statement_timestamp()
          OR "submissionStatus" = 'PROCESSING'
        )`,
    keyId,
  );
  const rawCount = Array.isArray(rows) && rows.length === 1
    ? rows[0]?.blockingSessions
    : null;
  const blockingSessions = Number(rawCount);
  if (!Number.isSafeInteger(blockingSessions) || blockingSessions < 0) {
    throw sessionError(
      'La persistencia devolvio un conteo HMAC invalido.',
      'WORKER_PAYMENT_FLOW_SESSION_CONFIGURATION_INVALID',
    );
  }
  return { keyId, retirable: blockingSessions === 0, blockingSessions };
}

function specializedBaseSession(base) {
  return { ...base, kind: 'worker_payment' };
}

function assertBaseNotFinalized(base, now) {
  if (normalizedDate(base.expiresAt, 'expiresAt').getTime() <= now.getTime()) {
    throw sessionError(
      'La sesion de destino de cobro vencio.',
      'WORKER_PAYMENT_FLOW_SESSION_EXPIRED',
    );
  }
  assertBaseReplayable(base);
}

function assertBaseReplayable(base) {
  if (!base.deliveryAttemptedAt || base.deliveryRejectedAt || base.consumedAt) {
    throw sessionError(
      'La sesion de destino de cobro no esta disponible.',
      'WORKER_PAYMENT_FLOW_SESSION_INVALID',
    );
  }
}

async function loadWorkerPaymentFlowDatabaseClock(prisma) {
  if (typeof prisma?.$queryRawUnsafe !== 'function') {
    throw sessionError(
      'La persistencia no puede fijar el reloj del replay de cobro.',
      'WORKER_PAYMENT_FLOW_SESSION_CONFIGURATION_INVALID',
    );
  }
  const rows = await prisma.$queryRawUnsafe(
    'SELECT statement_timestamp() AS "observedAt"',
  );
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw sessionError(
      'La persistencia devolvio un reloj de replay invalido.',
      'WORKER_PAYMENT_FLOW_SESSION_CONFIGURATION_INVALID',
    );
  }
  return normalizedDate(rows[0]?.observedAt, 'observedAt');
}

function assertReservationWindow(base, now) {
  const remainingMs = normalizedDate(base.expiresAt, 'expiresAt').getTime() - now.getTime();
  if (remainingMs <= WORKER_PAYMENT_FLOW_MIN_RESERVATION_REMAINING_MS) {
    throw sessionError(
      'La sesion de destino de cobro no tiene tiempo seguro para confirmar el envio.',
      'WORKER_PAYMENT_FLOW_SESSION_EXPIRED',
    );
  }
}

function assertBoundBase(base, companion, scope) {
  if (!base || !companion || String(base.id || '').toLowerCase() !== scope.flowSessionId) {
    throw sessionError(
      'La sesion de destino de cobro es invalida.',
      'WORKER_PAYMENT_FLOW_SESSION_INVALID',
    );
  }
  if (
    !exactRecord(base, {
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      phoneNumberId: scope.phoneNumberId,
      blueprintKey: WORKER_PAYMENT_FLOW_BLUEPRINT_KEY,
      screenId: WORKER_PAYMENT_FLOW_SCREEN_ID,
      flowType: WORKER_PAYMENT_FLOW_TYPE,
    })
    || !exactRecord(companion, {
      flowSessionId: scope.flowSessionId,
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      connectionId: scope.connectionId,
      workerId: base.workerId,
    })
    || normalizedDate(companion.expiresAt, 'expiresAt').getTime()
      !== normalizedDate(base.expiresAt, 'expiresAt').getTime()
  ) {
    throw sessionError(
      'La sesion de destino de cobro no pertenece a este endpoint.',
      'WORKER_PAYMENT_FLOW_SESSION_INVALID',
    );
  }
  try {
    assertWorkerPaymentPrivacyNoticeEvidence(
      companion.noticeVersion,
      companion.noticeContentSha256,
    );
  } catch (cause) {
    throw sessionError(
      'El aviso fijado por la sesion no supera la validacion de integridad.',
      'WORKER_PAYMENT_FLOW_SESSION_INVALID',
      { cause },
    );
  }
}

async function loadBoundSession(prisma, scope) {
  const [base, companion] = await Promise.all([
    baseSessionDelegate(prisma).findUnique({ where: { id: scope.flowSessionId } }),
    paymentSessionDelegate(prisma).findUnique({ where: { flowSessionId: scope.flowSessionId } }),
  ]);
  assertBoundBase(base, companion, scope);
  return { base, companion };
}

function trustedBindingFromStored(base, companion) {
  return {
    organizationId: companion.organizationId,
    projectId: companion.projectId,
    connectionId: companion.connectionId,
    workerId: companion.workerId,
    personId: companion.personId,
    channelIdentityId: companion.channelIdentityId,
    phoneNumberId: base.phoneNumberId,
    recipient: normalizedRecipient(base.recipientPhone),
  };
}

/**
 * Issues/reuses the generic signed Flow session and attaches exactly one
 * purpose-bound payment companion in the same serializable transaction.
 */
export async function issueWorkerPaymentFlowSession(
  prisma,
  rawInput,
  {
    flowTokenSecret,
    now = new Date(),
    ttlMs = DEFAULT_WHATSAPP_FLOW_SESSION_TTL_MS,
    fingerprintRegistry,
    transactionAttempts = DEFAULT_TRANSACTION_ATTEMPTS,
  } = {},
) {
  const input = normalizedIssueInput(rawInput);
  const issuedAt = normalizedNow(now);
  const paymentTtlMs = normalizedWorkerPaymentFlowTtl(ttlMs);
  const attempts = normalizedAttempts(transactionAttempts);
  const registry = resolvedFingerprintRegistry(fingerprintRegistry);

  return runSerializable(prisma, async (transaction) => {
    await loadTrustedScope(transaction, input, registry, issuedAt);
    const issued = await issueWhatsAppFlowSession(
      transaction,
      baseBindingFromIssue(input),
      {
        secret: flowTokenSecret,
        now: issuedAt,
        ttlMs: paymentTtlMs,
        propagateUniqueConstraint: true,
      },
    );
    if (!exactBaseBinding(issued.session, input)) {
      throw sessionError(
        'La sesion criptografica no coincide con el alcance de cobro.',
        'WORKER_PAYMENT_FLOW_SESSION_CONFLICT',
      );
    }
    if (
      issued.session.consumedAt
      || issued.session.deliveryRejectedAt
      || normalizedDate(issued.session.expiresAt, 'expiresAt').getTime() <= issuedAt.getTime()
    ) {
      throw sessionError(
        'La sesion criptografica ya no puede especializarse para cobro.',
        'WORKER_PAYMENT_FLOW_SESSION_CONFLICT',
      );
    }

    const delegate = paymentSessionDelegate(transaction);
    let companion = await delegate.findUnique({ where: { flowSessionId: issued.session.id } });
    if (companion) {
      if (!exactCompanionBinding(companion, issued.session, input)) {
        throw sessionError(
          'La sesion ya esta vinculada a otro alcance de cobro.',
          'WORKER_PAYMENT_FLOW_SESSION_CONFLICT',
        );
      }
      return {
        session: specializedBaseSession(issued.session),
        paymentSession: publicPaymentSession(companion),
        token: issued.token,
        replayed: true,
      };
    }

    companion = await delegate.create({
      data: {
        flowSessionId: issued.session.id,
        organizationId: input.organizationId,
        projectId: input.projectId,
        connectionId: input.connectionId,
        workerId: input.workerId,
        personId: input.personId,
        channelIdentityId: input.channelIdentityId,
        noticeVersion: input.notice.version,
        noticeContentSha256: input.notice.contentSha256,
        expiresAt: issued.session.expiresAt,
      },
    });
    return {
      session: specializedBaseSession(issued.session),
      paymentSession: publicPaymentSession(companion),
      token: issued.token,
      replayed: false,
    };
  }, attempts, { retryUnique: true });
}

/**
 * Binds an already HMAC-authenticated generic Data Endpoint session to the
 * payment companion. The returned `session.id` remains the generic UUID so the
 * existing WhatsAppFlowEndpointRequest.flowSessionId journal stays authoritative.
 */
export async function loadWorkerPaymentFlowDataSession(
  prisma,
  rawScope,
  { now = new Date(), fingerprintRegistry } = {},
) {
  const scope = normalizedEndpointScope(rawScope);
  const observedAt = normalizedNow(now);
  const registry = resolvedFingerprintRegistry(fingerprintRegistry);
  const { base, companion } = await loadBoundSession(prisma, scope);
  assertBaseNotFinalized(base, observedAt);
  await loadTrustedScope(
    prisma,
    trustedBindingFromStored(base, companion),
    registry,
    observedAt,
  );
  return {
    session: specializedBaseSession(base),
    paymentSession: publicPaymentSession(companion),
    notice: getWorkerPaymentPrivacyNotice(companion.noticeVersion),
    receipt: companion.submissionStatus === 'SUCCEEDED' ? safeReceipt(companion) : null,
  };
}

/**
 * Reconstructs only an already-committed terminal receipt when Meta retries an
 * exact encrypted data_exchange after the transport TTL. It cannot reserve,
 * submit, complete, or alter any domain state.
 */
export async function replayExpiredWorkerPaymentFlowSubmission(
  prisma,
  rawScope,
  rawForm,
  {
    secret,
    secretRegistry,
    fingerprintRegistry,
  } = {},
) {
  const scope = normalizedEndpointScope(rawScope);
  const form = normalizedForm(rawForm);
  const hmacRegistry = resolvedSessionSecretRegistry(secret, secretRegistry);
  const registry = resolvedFingerprintRegistry(fingerprintRegistry);
  const [observedAt, bound] = await Promise.all([
    loadWorkerPaymentFlowDatabaseClock(prisma),
    loadBoundSession(prisma, scope),
  ]);
  const { base, companion } = bound;
  assertBaseReplayable(base);

  const expiresAt = normalizedDate(base.expiresAt, 'expiresAt');
  const elapsedMs = observedAt.getTime() - expiresAt.getTime();
  if (elapsedMs < 0 || elapsedMs >= WORKER_PAYMENT_FLOW_SUCCEEDED_REPLAY_GRACE_MS) {
    throw sessionError(
      'La ventana de recuperacion del comprobante vencio.',
      'WORKER_PAYMENT_FLOW_SESSION_EXPIRED',
    );
  }
  if (companion.submissionStatus !== 'SUCCEEDED') {
    throw sessionError(
      'La sesion vencida no tiene un resultado confirmado.',
      'WORKER_PAYMENT_FLOW_SESSION_INVALID',
    );
  }
  const reservedAt = normalizedDate(companion.submissionReservedAt, 'submissionReservedAt');
  if (reservedAt.getTime() >= expiresAt.getTime()) {
    throw sessionError(
      'La reserva terminal no precede al vencimiento de la sesion.',
      'WORKER_PAYMENT_FLOW_SESSION_INVALID',
    );
  }
  if (!hmacRegistry.keys.has(companion.submissionFingerprintKeyId)) {
    throw sessionError(
      'La clave HMAC necesaria para recuperar el comprobante no esta disponible.',
      'WORKER_PAYMENT_FLOW_SESSION_SECRET_INVALID',
    );
  }
  const fingerprints = submissionFingerprintSet(scope.flowSessionId, form, hmacRegistry);
  assertSameFingerprint(companion, fingerprints.candidates);
  await loadTrustedScope(
    prisma,
    trustedBindingFromStored(base, companion),
    registry,
    observedAt,
    { requireWritableSubscription: false },
  );
  return {
    session: specializedBaseSession(base),
    paymentSession: publicPaymentSession(companion),
    notice: getWorkerPaymentPrivacyNotice(companion.noticeVersion),
    receipt: safeReceipt(companion),
    replayed: true,
  };
}

export async function markWorkerPaymentFlowPrivacyPresented(
  prisma,
  rawScope,
  {
    now = new Date(),
    fingerprintRegistry,
    transactionAttempts = DEFAULT_TRANSACTION_ATTEMPTS,
  } = {},
) {
  const scope = normalizedEndpointScope(rawScope);
  const presentedAt = normalizedNow(now);
  const registry = resolvedFingerprintRegistry(fingerprintRegistry);
  const attempts = normalizedAttempts(transactionAttempts);
  return runSerializable(prisma, async (transaction) => {
    const { base, companion: before } = await loadBoundSession(transaction, scope);
    assertBaseNotFinalized(base, presentedAt);
    await loadTrustedScope(
      transaction,
      trustedBindingFromStored(base, before),
      registry,
      presentedAt,
    );
    const deliveryAttemptedAt = normalizedDate(base.deliveryAttemptedAt, 'deliveryAttemptedAt');
    if (presentedAt.getTime() < deliveryAttemptedAt.getTime()) {
      throw sessionError(
        'La presentacion del aviso no puede preceder al intento de entrega.',
        'WORKER_PAYMENT_FLOW_SESSION_INVALID',
      );
    }
    if (before.privacyPresentedAt) {
      return {
        session: specializedBaseSession(base),
        paymentSession: publicPaymentSession(before),
        notice: getWorkerPaymentPrivacyNotice(before.noticeVersion),
        receipt: before.submissionStatus === 'SUCCEEDED' ? safeReceipt(before) : null,
        replayed: true,
      };
    }
    if (before.submissionStatus !== 'OPEN') {
      throw sessionError(
        'El aviso no puede fijarse despues de reservar el envio.',
        'WORKER_PAYMENT_FLOW_SESSION_CONFLICT',
      );
    }
    const marked = await paymentSessionDelegate(transaction).updateMany({
      where: {
        flowSessionId: scope.flowSessionId,
        submissionStatus: 'OPEN',
        privacyPresentedAt: null,
        revision: before.revision,
      },
      data: {
        privacyPresentedAt: presentedAt,
        revision: { increment: 1 },
      },
    });
    const companion = await paymentSessionDelegate(transaction).findUnique({
      where: { flowSessionId: scope.flowSessionId },
    });
    if (marked.count !== 1 && !companion?.privacyPresentedAt) {
      throw sessionError(
        'No se pudo fijar la presentacion del aviso.',
        'WORKER_PAYMENT_FLOW_SESSION_CONFLICT',
      );
    }
    return {
      session: specializedBaseSession(base),
      paymentSession: publicPaymentSession(companion),
      notice: getWorkerPaymentPrivacyNotice(companion.noticeVersion),
      receipt: null,
      replayed: marked.count !== 1,
    };
  }, attempts);
}

function safeReceipt(companion) {
  if (
    companion?.submissionStatus !== 'SUCCEEDED'
    || typeof companion.destinationId !== 'string'
    || !companion.destinationId
    || !companion.submittedAt
  ) {
    throw sessionError(
      'La sesion no tiene un resultado terminal seguro.',
      'WORKER_PAYMENT_FLOW_SESSION_INVALID',
    );
  }
  return {
    flow_type: WORKER_PAYMENT_FLOW_TYPE,
    destination_ref: companion.destinationId,
    submission_status: 'received',
    submitted_at: normalizedDate(companion.submittedAt, 'submittedAt').toISOString(),
  };
}

/**
 * Authenticates the delayed nfm_reply receipt against the terminal companion
 * before the generic bearer session can be consumed. The Data Endpoint already
 * performed the financial mutation; this path only acknowledges that exact,
 * immutable result and never sees the raw destination value.
 */
export async function assertWorkerPaymentFlowTerminalReceipt(
  prisma,
  { session, connectionId, response },
) {
  const base = objectInput(session, 'session');
  const expectedConnectionId = identifier(connectionId, 'connectionId');
  let receipt;
  try {
    receipt = validateWhatsAppFlowReply(WORKER_PAYMENT_FLOW_BLUEPRINT_KEY, response);
  } catch (cause) {
    if (!(cause instanceof WhatsAppFlowReplyError)) throw cause;
    throw sessionError(
      'El acuse terminal del Flow de cobro es invalido.',
      'WORKER_PAYMENT_FLOW_SESSION_INVALID',
      { cause },
    );
  }
  const companion = await paymentSessionDelegate(prisma).findUnique({
    where: { flowSessionId: uuid(base.id, 'session.id') },
  });
  let storedReceipt;
  try {
    storedReceipt = safeReceipt(companion);
  } catch (cause) {
    if (!(cause instanceof WorkerPaymentFlowSessionError)) throw cause;
    throw sessionError(
      'El acuse terminal no tiene un resultado de cobro confirmado.',
      'WORKER_PAYMENT_FLOW_SESSION_INVALID',
      { cause },
    );
  }
  if (
    base.blueprintKey !== WORKER_PAYMENT_FLOW_BLUEPRINT_KEY
    || base.screenId !== WORKER_PAYMENT_FLOW_SCREEN_ID
    || base.flowType !== WORKER_PAYMENT_FLOW_TYPE
    || !exactRecord(companion, {
      flowSessionId: base.id,
      organizationId: base.organizationId,
      projectId: base.projectId,
      connectionId: expectedConnectionId,
      workerId: base.workerId,
      submissionStatus: 'SUCCEEDED',
    })
    || normalizedDate(companion.expiresAt, 'expiresAt').getTime()
      !== normalizedDate(base.expiresAt, 'session.expiresAt').getTime()
    || typeof companion.personId !== 'string'
    || !companion.personId
    || typeof companion.channelIdentityId !== 'string'
    || !companion.channelIdentityId
    || typeof companion.privacyChoiceEventId !== 'string'
    || !companion.privacyChoiceEventId
    || storedReceipt.flow_type !== receipt.flow_type
    || storedReceipt.destination_ref !== receipt.destination_ref
    || storedReceipt.submission_status !== receipt.submission_status
  ) {
    throw sessionError(
      'El acuse terminal no coincide con la sesion de cobro confirmada.',
      'WORKER_PAYMENT_FLOW_SESSION_INVALID',
    );
  }
  return { receipt, paymentSession: publicPaymentSession(companion) };
}

function assertSameFingerprint(companion, fingerprints) {
  if (!fingerprints.some((candidate) => (
    companion.submissionFingerprintKeyId === candidate.keyId
    && constantTimeEqual(companion.submissionFingerprintHmac, candidate.fingerprint)
  ))) {
    throw sessionError(
      'La sesion ya fue usada con otro destino de cobro.',
      'WORKER_PAYMENT_FLOW_SESSION_CONFLICT',
    );
  }
  return companion.submissionFingerprintHmac;
}

function existingSubmissionResult(companion, fingerprints) {
  assertSameFingerprint(companion, fingerprints);
  if (companion.submissionStatus === 'SUCCEEDED') {
    return { state: 'replay', receipt: safeReceipt(companion), replayed: true };
  }
  if (companion.submissionStatus === 'PROCESSING') {
    const reservationId = uuid(companion.submissionReservationId, 'submissionReservationId');
    return withFlowSubmissionEvidence({
      state: 'reconcile',
      reservationId,
      operationKey: workerPaymentFlowSubmissionOperationKey(
        companion.flowSessionId,
        reservationId,
      ),
      replayed: true,
    }, companion);
  }
  if (companion.submissionStatus === 'UNCERTAIN') {
    return { state: 'uncertain', replayed: true };
  }
  throw sessionError(
    'El estado de la sesion de cobro es invalido.',
    'WORKER_PAYMENT_FLOW_SESSION_INVALID',
  );
}

function withFlowSubmissionEvidence(result, companion) {
  const reservationId = uuid(
    companion?.submissionReservationId,
    'submissionReservationId',
  );
  const fingerprintKeyId = identifier(
    companion?.submissionFingerprintKeyId,
    'submissionFingerprintKeyId',
    { max: 64, pattern: SESSION_SECRET_KEY_ID_PATTERN },
  );
  const fingerprintHmac = identifier(
    companion?.submissionFingerprintHmac,
    'submissionFingerprintHmac',
    { max: 64, pattern: SHA256_PATTERN },
  );
  const output = { ...result };
  Object.defineProperty(output, 'flowSubmission', {
    value: Object.freeze({ reservationId, fingerprintKeyId, fingerprintHmac }),
    enumerable: false,
    writable: false,
    configurable: false,
  });
  return output;
}

/**
 * Reserves a terminal submission. `reconcile` is intentionally distinct from
 * a fresh reservation: callers may only re-run the idempotent local bridge
 * with the returned stable operationKey. They must never invent a new key or
 * auto-retry an external/provider operation. `uncertain` requires a new Flow
 * session or an audited operator resolution.
 */
export async function reserveWorkerPaymentFlowSubmission(
  prisma,
  rawScope,
  rawForm,
  {
    secret,
    secretRegistry,
    now = new Date(),
    fingerprintRegistry,
    transactionAttempts = DEFAULT_TRANSACTION_ATTEMPTS,
    idFactory = crypto.randomUUID,
  } = {},
) {
  const scope = normalizedEndpointScope(rawScope);
  const form = normalizedForm(rawForm);
  const reservedAt = normalizedNow(now);
  const attempts = normalizedAttempts(transactionAttempts);
  const hmacRegistry = resolvedSessionSecretRegistry(secret, secretRegistry);
  const fingerprints = submissionFingerprintSet(scope.flowSessionId, form, hmacRegistry);
  const registry = resolvedFingerprintRegistry(fingerprintRegistry);
  const expectedDestination = expectedDestinationFingerprint(
    form,
    scope.organizationId,
    registry,
  );

  try {
    return await runSerializable(prisma, async (transaction) => {
      const { base, companion: before } = await loadBoundSession(transaction, scope);
      assertBaseNotFinalized(base, reservedAt);
      if (before.submissionStatus !== 'OPEN') {
        return existingSubmissionResult(before, fingerprints.candidates);
      }
      // Fast application guard. The trigger repeats this check against the
      // PostgreSQL statement clock, which is the authoritative linearization
      // boundary and cannot be weakened by host clock skew.
      assertReservationWindow(base, reservedAt);
      if (!before.privacyPresentedAt) {
        throw sessionError(
          'INIT no presento el aviso de privacidad fijado.',
          'WORKER_PAYMENT_FLOW_SESSION_INVALID',
        );
      }

      // Recheck active project/worker/person/channel immediately before the CAS.
      // The downstream bridge must repeat this check inside its authoritative
      // mutation boundary; this guard cannot by itself eliminate that TOCTOU.
      await loadTrustedScope(
        transaction,
        trustedBindingFromStored(base, before),
        registry,
        reservedAt,
      );

      const reservationId = uuid(idFactory(), 'reservationId');
      const operationKey = workerPaymentFlowSubmissionOperationKey(
        scope.flowSessionId,
        reservationId,
      );
      const expectedOperationKeys = workerPaymentFlowExpectedOperationKeys(
        {
          organizationId: before.organizationId,
          projectId: before.projectId,
          workerId: before.workerId,
          personId: before.personId,
          channelIdentityId: before.channelIdentityId,
        },
        operationKey,
        form.paymentPurpose,
      );
      const marked = await paymentSessionDelegate(transaction).updateMany({
        where: {
          flowSessionId: scope.flowSessionId,
          submissionStatus: 'OPEN',
          submissionFingerprintKeyId: null,
          submissionFingerprintHmac: null,
          submissionReservationId: null,
          privacyPresentedAt: { not: null },
          revision: before.revision,
        },
        data: {
          submissionStatus: 'PROCESSING',
          submissionFingerprintKeyId: fingerprints.activeKeyId,
          submissionFingerprintHmac: fingerprints.active,
          submissionReservationId: reservationId,
          submissionReservedAt: reservedAt,
          paymentPurpose: form.paymentPurpose,
          expectedDestinationType: expectedDestination.type,
          expectedDestinationFingerprintKeyId: expectedDestination.fingerprintKeyId,
          expectedDestinationFingerprint: expectedDestination.fingerprint,
          expectedPrivacyOperationKey: expectedOperationKeys.privacy,
          expectedDestinationOperationKey: expectedOperationKeys.destination,
          revision: { increment: 1 },
        },
      });
      const companion = await paymentSessionDelegate(transaction).findUnique({
        where: { flowSessionId: scope.flowSessionId },
      });
      if (marked.count !== 1) {
        return existingSubmissionResult(companion, fingerprints.candidates);
      }
      return withFlowSubmissionEvidence({
        state: 'reserved',
        reservationId,
        operationKey,
        paymentPurpose: form.paymentPurpose,
        replayed: false,
      }, companion);
    }, attempts);
  } catch (error) {
    if (isReservationWindowPersistenceRejection(error)) {
      throw sessionError(
        'La sesion de destino de cobro no tiene tiempo seguro para confirmar el envio.',
        'WORKER_PAYMENT_FLOW_SESSION_EXPIRED',
        { cause: error },
      );
    }
    throw error;
  }
}

function normalizedCompletionInput(rawInput) {
  const input = objectInput(rawInput, 'completion');
  const allowed = new Set(['reservationId', 'destinationId']);
  rejectUnknownFields(input, allowed);
  return {
    reservationId: uuid(input.reservationId, 'reservationId'),
    destinationId: identifier(input.destinationId, 'destinationId'),
  };
}

async function loadExactSuccessfulDestination(
  prisma,
  companion,
  form,
  destinationId,
  fingerprintRegistry,
) {
  if (typeof prisma?.workerPaymentDestination?.findFirst !== 'function') {
    throw sessionError(
      'La persistencia del destino de cobro no esta disponible.',
      'WORKER_PAYMENT_FLOW_SESSION_CONFIGURATION_INVALID',
    );
  }
  const destination = await prisma.workerPaymentDestination.findFirst({
    where: {
      id: destinationId,
      organizationId: companion.organizationId,
      personId: companion.personId,
      purpose: form.paymentPurpose,
      status: { in: ['PENDING_VERIFICATION', 'VERIFIED', 'ACTIVE'] },
      submissionContractVersion: 'ATTESTED_V1',
    },
    select: {
      id: true,
      organizationId: true,
      personId: true,
      purpose: true,
      status: true,
      type: true,
      fingerprint: true,
      fingerprintKeyId: true,
      submissionContractVersion: true,
      privacyChoiceEventId: true,
      submittedAt: true,
      privacyChoiceEvent: {
        select: {
          id: true,
          organizationId: true,
          personId: true,
          purpose: true,
          paymentPurpose: true,
          channel: true,
          action: true,
          channelIdentityId: true,
          noticeVersion: true,
          noticeContentSha256: true,
          presentedAt: true,
          decidedAt: true,
        },
      },
    },
  });
  const privacy = destination?.privacyChoiceEvent;
  let destinationCandidates = [];
  try {
    destinationCandidates = workerFinancialFingerprintCandidates(
      form.destinationValue,
      {
        organizationId: companion.organizationId,
        valueType: form.destinationType.toUpperCase(),
      },
      { registry: fingerprintRegistry },
    );
  } catch (cause) {
    throw sessionError(
      'No se pudo verificar el destino terminal del Flow.',
      'WORKER_PAYMENT_FLOW_SESSION_CONFIGURATION_INVALID',
      { cause },
    );
  }
  const submittedAt = privacy?.decidedAt
    ? normalizedDate(privacy.decidedAt, 'privacyChoice.decidedAt')
    : null;
  if (
    !exactRecord(destination, {
      id: destinationId,
      organizationId: companion.organizationId,
      personId: companion.personId,
      purpose: form.paymentPurpose,
      submissionContractVersion: 'ATTESTED_V1',
    })
    || !['PENDING_VERIFICATION', 'VERIFIED', 'ACTIVE'].includes(destination.status)
    || destination.type !== form.destinationType.toUpperCase()
    || !fingerprintMatches(
      destination.fingerprintKeyId,
      destination.fingerprint,
      destinationCandidates,
    )
    || typeof destination.privacyChoiceEventId !== 'string'
    || !destination.privacyChoiceEventId
    || !submittedAt
    || submittedAt.getTime()
      < normalizedDate(companion.submissionReservedAt, 'submissionReservedAt').getTime()
    || !exactRecord(privacy, {
      id: destination.privacyChoiceEventId,
      organizationId: companion.organizationId,
      personId: companion.personId,
      purpose: 'PAYMENT_DESTINATION_CAPTURE',
      paymentPurpose: form.paymentPurpose,
      channel: 'WHATSAPP_FLOW',
      action: 'WORKER_ACKNOWLEDGED',
      channelIdentityId: companion.channelIdentityId,
      noticeVersion: companion.noticeVersion,
      noticeContentSha256: companion.noticeContentSha256,
    })
    || normalizedDate(privacy.presentedAt, 'privacyChoice.presentedAt').getTime()
      !== normalizedDate(companion.privacyPresentedAt, 'privacyPresentedAt').getTime()
  ) {
    throw sessionError(
      'El resultado del bridge no coincide con la sesion de cobro.',
      'WORKER_PAYMENT_FLOW_SESSION_CONFLICT',
    );
  }
  return { destination, submittedAt };
}

export async function completeWorkerPaymentFlowSubmission(
  prisma,
  rawScope,
  rawForm,
  rawCompletion,
  {
    secret,
    secretRegistry,
    fingerprintRegistry,
    transactionAttempts = DEFAULT_TRANSACTION_ATTEMPTS,
  } = {},
) {
  const scope = normalizedEndpointScope(rawScope);
  const form = normalizedForm(rawForm);
  const completion = normalizedCompletionInput(rawCompletion);
  const attempts = normalizedAttempts(transactionAttempts);
  const hmacRegistry = resolvedSessionSecretRegistry(secret, secretRegistry);
  const fingerprints = submissionFingerprintSet(scope.flowSessionId, form, hmacRegistry);
  const registry = resolvedFingerprintRegistry(fingerprintRegistry);

  return runSerializable(prisma, async (transaction) => {
    const { base, companion: before } = await loadBoundSession(transaction, scope);
    if (before.submissionStatus === 'SUCCEEDED') {
      assertSameFingerprint(before, fingerprints.candidates);
      if (
        before.destinationId !== completion.destinationId
        || before.submissionReservationId !== completion.reservationId
      ) {
        throw sessionError(
          'El resultado terminal no coincide con el destino ya registrado.',
          'WORKER_PAYMENT_FLOW_SESSION_CONFLICT',
        );
      }
      return {
        session: specializedBaseSession(base),
        receipt: safeReceipt(before),
        replayed: true,
      };
    }
    if (before.submissionStatus === 'UNCERTAIN') {
      throw sessionError(
        'El resultado de la sesion es incierto y no puede reintentarse.',
        'WORKER_PAYMENT_FLOW_SESSION_OUTCOME_UNCERTAIN',
      );
    }
    if (
      before.submissionStatus !== 'PROCESSING'
      || before.submissionReservationId !== completion.reservationId
    ) {
      throw sessionError(
        'La reserva no coincide con la sesion de cobro.',
        'WORKER_PAYMENT_FLOW_SESSION_CONFLICT',
      );
    }
    const persistedFingerprint = assertSameFingerprint(before, fingerprints.candidates);
    const { destination, submittedAt } = await loadExactSuccessfulDestination(
      transaction,
      before,
      form,
      completion.destinationId,
      registry,
    );
    const marked = await paymentSessionDelegate(transaction).updateMany({
      where: {
        flowSessionId: scope.flowSessionId,
        submissionStatus: 'PROCESSING',
        submissionFingerprintKeyId: before.submissionFingerprintKeyId,
        submissionFingerprintHmac: persistedFingerprint,
        submissionReservationId: completion.reservationId,
        privacyChoiceEventId: null,
        destinationId: null,
        revision: before.revision,
      },
      data: {
        submissionStatus: 'SUCCEEDED',
        paymentPurpose: form.paymentPurpose,
        privacyChoiceEventId: destination.privacyChoiceEventId,
        destinationId: destination.id,
        submittedAt,
        revision: { increment: 1 },
      },
    });
    const companion = await paymentSessionDelegate(transaction).findUnique({
      where: { flowSessionId: scope.flowSessionId },
    });
    if (marked.count !== 1) {
      assertSameFingerprint(companion, fingerprints.candidates);
      if (
        companion.submissionStatus !== 'SUCCEEDED'
        || companion.destinationId !== completion.destinationId
        || companion.submissionReservationId !== completion.reservationId
      ) {
        throw sessionError(
          'El resultado terminal cambio durante la confirmacion.',
          'WORKER_PAYMENT_FLOW_SESSION_CONFLICT',
        );
      }
    }
    return {
      session: specializedBaseSession(base),
      receipt: safeReceipt(companion),
      replayed: marked.count !== 1,
    };
  }, attempts);
}

function normalizedUncertaintyInput(rawInput) {
  const input = objectInput(rawInput, 'uncertainty');
  rejectUnknownFields(input, new Set(['reservationId']));
  return { reservationId: uuid(input.reservationId, 'reservationId') };
}

/**
 * Irreversibly fences an ambiguous bridge outcome. There is intentionally no
 * release/reset primitive: operator resolution or a newly issued Flow session
 * is required after UNCERTAIN.
 */
export async function markWorkerPaymentFlowSubmissionUncertain(
  prisma,
  rawScope,
  rawForm,
  rawUncertainty,
  {
    secret,
    secretRegistry,
    now = new Date(),
    transactionAttempts = DEFAULT_TRANSACTION_ATTEMPTS,
  } = {},
) {
  const scope = normalizedEndpointScope(rawScope);
  const form = normalizedForm(rawForm);
  const uncertainty = normalizedUncertaintyInput(rawUncertainty);
  const uncertainAt = normalizedNow(now);
  const attempts = normalizedAttempts(transactionAttempts);
  const hmacRegistry = resolvedSessionSecretRegistry(secret, secretRegistry);
  const fingerprints = submissionFingerprintSet(scope.flowSessionId, form, hmacRegistry);

  return runSerializable(prisma, async (transaction) => {
    const { base, companion: before } = await loadBoundSession(transaction, scope);
    const persistedFingerprint = assertSameFingerprint(before, fingerprints.candidates);
    if (before.submissionStatus === 'SUCCEEDED') {
      if (before.submissionReservationId !== uncertainty.reservationId) {
        throw sessionError(
          'La reserva no coincide con el resultado terminal registrado.',
          'WORKER_PAYMENT_FLOW_SESSION_CONFLICT',
        );
      }
      return {
        session: specializedBaseSession(base),
        state: 'replay',
        receipt: safeReceipt(before),
        replayed: true,
      };
    }
    if (
      before.submissionReservationId !== uncertainty.reservationId
      || !before.submissionReservedAt
    ) {
      throw sessionError(
        'La reserva no coincide con el resultado incierto.',
        'WORKER_PAYMENT_FLOW_SESSION_CONFLICT',
      );
    }
    if (before.submissionStatus === 'UNCERTAIN') {
      return {
        session: specializedBaseSession(base),
        state: 'uncertain',
        replayed: true,
      };
    }
    if (before.submissionStatus !== 'PROCESSING') {
      throw sessionError(
        'La sesion no tiene una reserva que pueda cerrarse como incierta.',
        'WORKER_PAYMENT_FLOW_SESSION_CONFLICT',
      );
    }
    const marked = await paymentSessionDelegate(transaction).updateMany({
      where: {
        flowSessionId: scope.flowSessionId,
        submissionStatus: 'PROCESSING',
        submissionFingerprintKeyId: before.submissionFingerprintKeyId,
        submissionFingerprintHmac: persistedFingerprint,
        submissionReservationId: uncertainty.reservationId,
        revision: before.revision,
      },
      data: {
        submissionStatus: 'UNCERTAIN',
        // PostgreSQL replaces this caller clock with statement_timestamp().
        submissionUncertainAt: uncertainAt,
        revision: { increment: 1 },
      },
    });
    const companion = await paymentSessionDelegate(transaction).findUnique({
      where: { flowSessionId: scope.flowSessionId },
    });
    if (marked.count !== 1) {
      assertSameFingerprint(companion, fingerprints.candidates);
      if (companion.submissionStatus !== 'UNCERTAIN') {
        throw sessionError(
          'El estado de la sesion cambio durante el cierre incierto.',
          'WORKER_PAYMENT_FLOW_SESSION_CONFLICT',
        );
      }
    }
    return {
      session: specializedBaseSession(base),
      state: 'uncertain',
      replayed: marked.count !== 1,
    };
  }, attempts);
}
