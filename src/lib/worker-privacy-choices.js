import crypto from 'node:crypto';

import { createAuditLog } from './audit-log.js';
import { assertOrganizationSubscriptionAllowsWrites } from './plans.js';
import { assertWorkerPaymentPrivacyNoticeEvidence } from './worker-payment-privacy-notices.js';

const PAYMENT_PURPOSES = new Set(['SALARY', 'REIMBURSEMENT']);
const SUBMITTER_TYPES = new Set(['TENANT_MEMBERSHIP', 'WORKER_CHANNEL']);
const DASHBOARD_ACTOR_ROLES = new Set(['ADMIN', 'FINANCE']);
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const SAFE_IDENTIFIER_PATTERN = /^[^\u0000-\u001f\u007f]{1,190}$/;
const NOTICE_VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const DEFAULT_TRANSACTION_ATTEMPTS = 3;

const OPTION_FIELDS = new Set([
  'scope',
  'personId',
  'paymentPurpose',
  'submittedBy',
  'notice',
  'operationKey',
  'now',
  'idFactory',
  'correlationId',
  'transactionAttempts',
]);
const SCOPE_FIELDS = new Set(['organizationId']);
const SUBMITTER_FIELDS = new Set(['type', 'membershipId', 'channelIdentityId']);
const NOTICE_FIELDS = new Set(['version', 'contentSha256', 'presentedAt']);

const ERROR_STATUS = Object.freeze({
  WORKER_PRIVACY_CHOICE_INPUT_INVALID: 400,
  WORKER_PRIVACY_CHOICE_UNKNOWN_FIELDS: 400,
  WORKER_PRIVACY_CHOICE_ACTOR_FORBIDDEN: 403,
  WORKER_PRIVACY_CHOICE_SCOPE_FORBIDDEN: 403,
  WORKER_PRIVACY_CHOICE_IDENTITY_UNVERIFIED: 422,
  WORKER_PRIVACY_CHOICE_IDEMPOTENCY_CONFLICT: 409,
  WORKER_PRIVACY_CHOICE_PERSISTENCE_CONFLICT: 409,
  WORKER_PRIVACY_CHOICE_CONFIGURATION_INVALID: 500,
});

export const WORKER_PAYMENT_CAPTURE_PRIVACY_PURPOSE = 'PAYMENT_DESTINATION_CAPTURE';
export const WORKER_PAYMENT_ATTESTED_CONTRACT_VERSION = 'ATTESTED_V1';

export class WorkerPrivacyChoiceError extends Error {
  constructor(message, code = 'WORKER_PRIVACY_CHOICE_INPUT_INVALID', { cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'WorkerPrivacyChoiceError';
    this.code = code;
    this.status = ERROR_STATUS[code] || 500;
  }
}

function privacyError(message, code, options) {
  return new WorkerPrivacyChoiceError(message, code, options);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function objectInput(value, field) {
  if (!isPlainObject(value)) {
    throw privacyError(`${field} debe ser un objeto valido.`, 'WORKER_PRIVACY_CHOICE_INPUT_INVALID');
  }
  return value;
}

function rejectUnknownFields(value, allowedFields) {
  const unknown = Object.keys(value).filter((field) => !allowedFields.has(field));
  if (unknown.length > 0) {
    throw privacyError(
      'La evidencia de privacidad contiene campos no permitidos.',
      'WORKER_PRIVACY_CHOICE_UNKNOWN_FIELDS',
    );
  }
}

function identifier(value, field) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!SAFE_IDENTIFIER_PATTERN.test(normalized)) {
    throw privacyError(`${field} es invalido.`, 'WORKER_PRIVACY_CHOICE_INPUT_INVALID');
  }
  return normalized;
}

function normalizedScope(value) {
  const scope = objectInput(value, 'scope');
  rejectUnknownFields(scope, SCOPE_FIELDS);
  return { organizationId: identifier(scope.organizationId, 'organizationId') };
}

function normalizedPaymentPurpose(value) {
  const purpose = String(value || '').trim().toUpperCase();
  if (!PAYMENT_PURPOSES.has(purpose)) {
    throw privacyError(
      'El proposito del destino de cobro es invalido.',
      'WORKER_PRIVACY_CHOICE_INPUT_INVALID',
    );
  }
  return purpose;
}

function normalizedOperationKey(value) {
  const operationKey = typeof value === 'string' ? value.trim() : '';
  if (!IDEMPOTENCY_KEY_PATTERN.test(operationKey)) {
    throw privacyError(
      'operationKey debe tener entre 8 y 128 caracteres seguros.',
      'WORKER_PRIVACY_CHOICE_INPUT_INVALID',
    );
  }
  return operationKey;
}

function normalizedDate(value, field) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw privacyError(`${field} es invalido.`, 'WORKER_PRIVACY_CHOICE_INPUT_INVALID');
  }
  return date;
}

function normalizedNow(value) {
  return normalizedDate(value ?? Date.now(), 'now');
}

function normalizedAttempts(value) {
  if (value === undefined) return DEFAULT_TRANSACTION_ATTEMPTS;
  const attempts = Number(value);
  if (!Number.isSafeInteger(attempts) || attempts < 1 || attempts > 5) {
    throw privacyError(
      'transactionAttempts es invalido.',
      'WORKER_PRIVACY_CHOICE_INPUT_INVALID',
    );
  }
  return attempts;
}

function normalizedSubmitter(value) {
  const submittedBy = objectInput(value, 'submittedBy');
  rejectUnknownFields(submittedBy, SUBMITTER_FIELDS);
  const type = String(submittedBy.type || '').trim().toUpperCase();
  if (!SUBMITTER_TYPES.has(type)) {
    throw privacyError(
      'El origen de la atestacion es invalido.',
      'WORKER_PRIVACY_CHOICE_INPUT_INVALID',
    );
  }
  if (type === 'TENANT_MEMBERSHIP') {
    if (submittedBy.channelIdentityId !== undefined) {
      throw privacyError(
        'El actor de la atestacion es invalido.',
        'WORKER_PRIVACY_CHOICE_INPUT_INVALID',
      );
    }
    return {
      type,
      id: identifier(submittedBy.membershipId, 'membershipId'),
      channel: 'TENANT_DASHBOARD',
      action: 'ADMIN_ATTESTED',
    };
  }
  if (submittedBy.membershipId !== undefined) {
    throw privacyError(
      'El actor de la atestacion es invalido.',
      'WORKER_PRIVACY_CHOICE_INPUT_INVALID',
    );
  }
  return {
    type,
    id: identifier(submittedBy.channelIdentityId, 'channelIdentityId'),
    channel: 'WHATSAPP_FLOW',
    action: 'WORKER_ACKNOWLEDGED',
  };
}

function normalizedNotice(value, now) {
  const notice = objectInput(value, 'notice');
  rejectUnknownFields(notice, NOTICE_FIELDS);
  const version = typeof notice.version === 'string' ? notice.version.trim() : '';
  const contentSha256 = typeof notice.contentSha256 === 'string'
    ? notice.contentSha256.trim().toLowerCase()
    : '';
  const presentedAt = normalizedDate(notice.presentedAt, 'notice.presentedAt');
  if (!NOTICE_VERSION_PATTERN.test(version) || !SHA256_PATTERN.test(contentSha256)) {
    throw privacyError(
      'La evidencia del aviso de privacidad es invalida.',
      'WORKER_PRIVACY_CHOICE_INPUT_INVALID',
    );
  }
  try {
    assertWorkerPaymentPrivacyNoticeEvidence(version, contentSha256);
  } catch (cause) {
    throw privacyError(
      'El aviso de privacidad no coincide con el registro inmutable del producto.',
      'WORKER_PRIVACY_CHOICE_INPUT_INVALID',
      { cause },
    );
  }
  if (presentedAt.getTime() > now.getTime()) {
    throw privacyError(
      'El aviso no puede presentarse despues de la decision.',
      'WORKER_PRIVACY_CHOICE_INPUT_INVALID',
    );
  }
  return { version, contentSha256, presentedAt };
}

function sha256(domain, value) {
  return crypto
    .createHash('sha256')
    .update(`${domain}\n${JSON.stringify(value)}`, 'utf8')
    .digest('hex');
}

function scopedOperationKey(context, rawOperationKey) {
  return `wpc:${sha256('obrasaas:worker-privacy-choice:operation:v1', {
    ...context,
    rawOperationKey,
  })}`;
}

export function workerPaymentCapturePrivacyChoiceOperationKey(
  {
    organizationId,
    personId,
    paymentPurpose,
    channelIdentityId,
  },
  rawOperationKey,
) {
  const scope = normalizedScope({ organizationId });
  const normalizedPersonId = identifier(personId, 'personId');
  const purpose = normalizedPaymentPurpose(paymentPurpose);
  const submitter = normalizedSubmitter({
    type: 'WORKER_CHANNEL',
    channelIdentityId,
  });
  return scopedOperationKey({
    organizationId: scope.organizationId,
    personId: normalizedPersonId,
    paymentPurpose: purpose,
    submitterType: submitter.type,
    submitterId: submitter.id,
  }, normalizedOperationKey(rawOperationKey));
}

function privacyRequestFingerprint(value) {
  return sha256('obrasaas:worker-privacy-choice:request:v1', value);
}

function serializePrivacyChoiceEvent(row) {
  return {
    id: identifier(row?.id, 'privacyChoiceEvent.id'),
    purpose: row?.purpose,
    paymentPurpose: row?.paymentPurpose,
    channel: row?.channel,
    action: row?.action,
    noticeVersion: row?.noticeVersion,
    noticeContentSha256: row?.noticeContentSha256,
    presentedAt: normalizedDate(row?.presentedAt, 'privacyChoiceEvent.presentedAt').toISOString(),
    decidedAt: normalizedDate(row?.decidedAt, 'privacyChoiceEvent.decidedAt').toISOString(),
    createdAt: normalizedDate(row?.createdAt, 'privacyChoiceEvent.createdAt').toISOString(),
  };
}

function assertPrisma(prisma) {
  if (!prisma || typeof prisma.$transaction !== 'function') {
    throw privacyError(
      'La persistencia de decisiones de privacidad no esta disponible.',
      'WORKER_PRIVACY_CHOICE_CONFIGURATION_INVALID',
    );
  }
}

async function runSerializable(prisma, operation, attempts) {
  assertPrisma(prisma);
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (error?.code !== 'P2034' || attempt === attempts) throw error;
    }
  }
  throw privacyError(
    'No se pudo persistir la decision de privacidad.',
    'WORKER_PRIVACY_CHOICE_PERSISTENCE_CONFLICT',
  );
}

async function lockPrivacyScope(transaction, organizationId, personId, paymentPurpose) {
  await transaction.$executeRawUnsafe(
    'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
    `worker-payment:${organizationId}:${personId}:${paymentPurpose}`,
  );
}

async function requirePerson(transaction, organizationId, personId) {
  const person = await transaction.workerPerson.findFirst({
    where: { id: personId, organizationId, status: 'ACTIVE' },
    select: { id: true, organizationId: true, status: true, identityStatus: true },
  });
  if (!person) {
    throw privacyError(
      'La persona no pertenece a la organizacion activa.',
      'WORKER_PRIVACY_CHOICE_SCOPE_FORBIDDEN',
    );
  }
  if (person.identityStatus !== 'VERIFIED') {
    throw privacyError(
      'La identidad laboral debe estar verificada antes de registrar esta decision.',
      'WORKER_PRIVACY_CHOICE_IDENTITY_UNVERIFIED',
    );
  }
  return person;
}

async function requireActor(transaction, organizationId, personId, submitter) {
  if (submitter.type === 'TENANT_MEMBERSHIP') {
    const membership = await transaction.tenantMembership.findFirst({
      where: {
        id: submitter.id,
        organizationId,
        status: 'ACTIVE',
        tenantRole: { in: [...DASHBOARD_ACTOR_ROLES] },
      },
      select: { id: true, organizationId: true, userId: true, tenantRole: true, status: true },
    });
    if (!membership) {
      throw privacyError(
        'La membresia no puede registrar esta atestacion.',
        'WORKER_PRIVACY_CHOICE_ACTOR_FORBIDDEN',
      );
    }
    return { membership, actorId: membership.userId };
  }
  const channel = await transaction.workerChannelIdentity.findFirst({
    where: {
      id: submitter.id,
      organizationId,
      personId,
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
    },
  });
  if (!channel) {
    throw privacyError(
      'El canal del trabajador no esta verificado para esta persona.',
      'WORKER_PRIVACY_CHOICE_ACTOR_FORBIDDEN',
    );
  }
  return { channel, actorId: null };
}

function assertReplay(row, expected) {
  if (!row) return null;
  const exact = row.organizationId === expected.organizationId
    && row.personId === expected.personId
    && row.purpose === WORKER_PAYMENT_CAPTURE_PRIVACY_PURPOSE
    && row.paymentPurpose === expected.paymentPurpose
    && row.channel === expected.channel
    && row.action === expected.action
    && (row.actorMembershipId ?? null) === expected.actorMembershipId
    && (row.channelIdentityId ?? null) === expected.channelIdentityId
    && row.noticeVersion === expected.noticeVersion
    && row.noticeContentSha256 === expected.noticeContentSha256
    && row.operationKey === expected.operationKey
    && row.requestFingerprint === expected.requestFingerprint;
  if (!exact) {
    throw privacyError(
      'La clave de idempotencia ya fue utilizada con otra decision de privacidad.',
      'WORKER_PRIVACY_CHOICE_IDEMPOTENCY_CONFLICT',
    );
  }
  return row;
}

function isUniqueError(error) {
  return error?.code === 'P2002' || error?.code === '23505';
}

/**
 * Records one server-observed payment-capture privacy choice. `notice.presentedAt`
 * must come from the authenticated dashboard/Flow session, never from arbitrary
 * request JSON. The accepted shape intentionally has no financial-value fields.
 */
export async function recordWorkerPaymentCapturePrivacyChoice(prisma, rawOptions) {
  const options = objectInput(rawOptions, 'options');
  rejectUnknownFields(options, OPTION_FIELDS);
  const scope = normalizedScope(options.scope);
  const personId = identifier(options.personId, 'personId');
  const paymentPurpose = normalizedPaymentPurpose(options.paymentPurpose);
  const submitter = normalizedSubmitter(options.submittedBy);
  const now = normalizedNow(options.now);
  const notice = normalizedNotice(options.notice, now);
  const rawOperationKey = normalizedOperationKey(options.operationKey);
  const attempts = normalizedAttempts(options.transactionAttempts);
  const idFactory = options.idFactory ?? crypto.randomUUID;
  if (typeof idFactory !== 'function') {
    throw privacyError('idFactory es invalido.', 'WORKER_PRIVACY_CHOICE_INPUT_INVALID');
  }
  const eventId = identifier(idFactory(), 'privacyChoiceEventId');
  const identity = {
    organizationId: scope.organizationId,
    personId,
    paymentPurpose,
    channel: submitter.channel,
    action: submitter.action,
    actorMembershipId: submitter.type === 'TENANT_MEMBERSHIP' ? submitter.id : null,
    channelIdentityId: submitter.type === 'WORKER_CHANNEL' ? submitter.id : null,
    noticeVersion: notice.version,
    noticeContentSha256: notice.contentSha256,
    presentedAt: notice.presentedAt,
  };
  const operationKey = scopedOperationKey({
    organizationId: scope.organizationId,
    personId,
    paymentPurpose,
    submitterType: submitter.type,
    submitterId: submitter.id,
  }, rawOperationKey);
  // `presentedAt` is server-observed evidence, not caller intent. A retried
  // dashboard request necessarily observes a later clock value; binding that
  // timestamp to the idempotency fingerprint would make the same operation
  // key conflict with itself after a transient failure. The first committed
  // event keeps its original immutable timestamp and is returned on replay.
  const requestFingerprint = privacyRequestFingerprint({
    organizationId: identity.organizationId,
    personId: identity.personId,
    paymentPurpose: identity.paymentPurpose,
    channel: identity.channel,
    action: identity.action,
    actorMembershipId: identity.actorMembershipId,
    channelIdentityId: identity.channelIdentityId,
    noticeVersion: identity.noticeVersion,
    noticeContentSha256: identity.noticeContentSha256,
  });
  const replayIdentity = { ...identity, operationKey, requestFingerprint };

  const operation = async (transaction) => {
    await lockPrivacyScope(transaction, scope.organizationId, personId, paymentPurpose);
    await assertOrganizationSubscriptionAllowsWrites(transaction, scope.organizationId, { now });
    await requirePerson(transaction, scope.organizationId, personId);
    const actor = await requireActor(transaction, scope.organizationId, personId, submitter);
    const replay = assertReplay(
      await transaction.workerPrivacyChoiceEvent.findFirst({
        where: { organizationId: scope.organizationId, operationKey },
      }),
      replayIdentity,
    );
    if (replay) {
      return { privacyChoiceEvent: serializePrivacyChoiceEvent(replay), replayed: true };
    }
    const row = await transaction.workerPrivacyChoiceEvent.create({
      data: {
        id: eventId,
        organizationId: scope.organizationId,
        personId,
        purpose: WORKER_PAYMENT_CAPTURE_PRIVACY_PURPOSE,
        paymentPurpose,
        channel: submitter.channel,
        action: submitter.action,
        actorMembershipId: submitter.type === 'TENANT_MEMBERSHIP' ? submitter.id : null,
        channelIdentityId: submitter.type === 'WORKER_CHANNEL' ? submitter.id : null,
        noticeVersion: notice.version,
        noticeContentSha256: notice.contentSha256,
        presentedAt: notice.presentedAt,
        decidedAt: now,
        operationKey,
        requestFingerprint,
        createdAt: now,
      },
    });
    await createAuditLog(transaction, {
      organizationId: scope.organizationId,
      actorId: actor.actorId,
      action: 'worker.payment_privacy_choice.recorded',
      entityType: 'WorkerPrivacyChoiceEvent',
      entityId: row.id,
      correlationId: options.correlationId,
      metadata: {
        personId,
        purpose: WORKER_PAYMENT_CAPTURE_PRIVACY_PURPOSE,
        paymentPurpose,
        channel: submitter.channel,
        action: submitter.action,
        noticeVersion: notice.version,
      },
    });
    return { privacyChoiceEvent: serializePrivacyChoiceEvent(row), replayed: false };
  };

  try {
    return await runSerializable(prisma, operation, attempts);
  } catch (error) {
    if (!isUniqueError(error)) throw error;
    return runSerializable(prisma, async (transaction) => {
      await lockPrivacyScope(transaction, scope.organizationId, personId, paymentPurpose);
      const replay = assertReplay(
        await transaction.workerPrivacyChoiceEvent.findFirst({
          where: { organizationId: scope.organizationId, operationKey },
        }),
        replayIdentity,
      );
      if (replay) {
        return { privacyChoiceEvent: serializePrivacyChoiceEvent(replay), replayed: true };
      }
      throw privacyError(
        'La decision de privacidad entro en conflicto con otra operacion.',
        'WORKER_PRIVACY_CHOICE_PERSISTENCE_CONFLICT',
        { cause: error },
      );
    }, attempts);
  }
}
