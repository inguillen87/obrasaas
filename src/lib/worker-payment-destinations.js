import crypto from 'node:crypto';

import { createAuditLog } from './audit-log.js';
import { assertOrganizationSubscriptionAllowsWrites } from './plans.js';
import {
  WORKER_FINANCIAL_FIELDS,
  WORKER_FINANCIAL_PURPOSES,
  encryptWorkerFinancialPayload,
  normalizeWorkerBankKey,
  normalizeWorkerCuil,
  normalizeWorkerPaymentDestinationInput,
  readWorkerFinancialKeyConfiguration,
  serializeWorkerPaymentDestination,
  workerFinancialFingerprint,
  workerFinancialFingerprintCandidates,
  workerFinancialLastFour,
} from './worker-financial-data.js';

const PAYMENT_PURPOSES = new Set(['SALARY', 'REIMBURSEMENT']);
const SUBMITTER_TYPES = new Set(['TENANT_MEMBERSHIP', 'WORKER_CHANNEL']);
const READ_ROLES = new Set(['ADMIN', 'DIRECTOR', 'FINANCE']);
const MANAGE_ROLES = new Set(['ADMIN', 'FINANCE']);
const ACTIVATE_ROLES = new Set(['ADMIN', 'DIRECTOR']);
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const POLICY_VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const PROVIDER_PATTERN = /^[A-Z0-9][A-Z0-9._:-]{0,63}$/;
const MAX_EVIDENCE_BYTES = 16 * 1024;
const DEFAULT_TRANSACTION_ATTEMPTS = 3;
const MAX_PRISMA_INT = 2_147_483_647;

const LIST_OPTIONS = new Set(['scope', 'personId', 'actorMembershipId', 'purpose']);
const SUBMIT_OPTIONS = new Set([
  'scope',
  'personId',
  'submittedBy',
  'input',
  'now',
  'keyConfiguration',
  'randomBytes',
  'idFactory',
  'correlationId',
  'transactionAttempts',
]);
const DECISION_OPTIONS = new Set([
  'scope',
  'personId',
  'purpose',
  'destinationId',
  'actorMembershipId',
  'input',
  'trustedEvidence',
  'trustedVerification',
  'now',
  'keyConfiguration',
  'randomBytes',
  'correlationId',
  'transactionAttempts',
]);
const SUBMIT_INPUT_FIELDS = new Set([
  'purpose',
  'type',
  'value',
  'holderName',
  'holderCuil',
  'operationKey',
]);
const SUBMITTER_FIELDS = new Set(['type', 'membershipId', 'channelIdentityId']);
const VERIFY_INPUT_FIELDS = new Set([
  'expectedRevision',
  'operationKey',
  'policyVersion',
]);
const TRUSTED_VERIFICATION_FIELDS = new Set([
  'evidence',
  'verificationProvider',
  'providerReference',
  'serverResolution',
  'verifiedHolderCuil',
]);
const SERVER_RESOLUTION_FIELDS = new Set(['type', 'value']);
const ACTIVATE_INPUT_FIELDS = new Set([
  'expectedRevision',
  'operationKey',
  'policyVersion',
]);
const REASON_INPUT_FIELDS = new Set([
  'expectedRevision',
  'operationKey',
  'policyVersion',
  'reason',
]);

const ERROR_STATUS = Object.freeze({
  WORKER_PAYMENT_INPUT_INVALID: 400,
  WORKER_PAYMENT_UNKNOWN_FIELDS: 400,
  WORKER_PAYMENT_ACTOR_FORBIDDEN: 403,
  WORKER_PAYMENT_SCOPE_FORBIDDEN: 403,
  WORKER_PAYMENT_NOT_FOUND: 404,
  WORKER_PAYMENT_IDEMPOTENCY_CONFLICT: 409,
  WORKER_PAYMENT_DUPLICATE: 409,
  WORKER_PAYMENT_REVISION_STALE: 409,
  WORKER_PAYMENT_TRANSITION_CONFLICT: 409,
  WORKER_PAYMENT_SEPARATION_REQUIRED: 409,
  WORKER_PAYMENT_ALIAS_RESOLUTION_REQUIRED: 422,
  WORKER_PAYMENT_HOLDER_MISMATCH: 422,
  WORKER_PAYMENT_IDENTITY_UNVERIFIED: 422,
  WORKER_PAYMENT_PERSISTENCE_CONFLICT: 409,
  WORKER_PAYMENT_CONFIGURATION_INVALID: 500,
});

export class WorkerPaymentDestinationError extends Error {
  constructor(message, code = 'WORKER_PAYMENT_INPUT_INVALID', { cause, details = null } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'WorkerPaymentDestinationError';
    this.code = code;
    this.status = ERROR_STATUS[code] || 500;
    this.details = details;
  }
}

function paymentError(message, code, options) {
  return new WorkerPaymentDestinationError(message, code, options);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function objectInput(value, field) {
  if (!isPlainObject(value)) {
    throw paymentError(`${field} debe ser un objeto valido.`, 'WORKER_PAYMENT_INPUT_INVALID');
  }
  return value;
}

function rejectUnknownFields(value, allowedFields) {
  const unknownFields = Object.keys(value).filter((field) => !allowedFields.has(field));
  if (unknownFields.length > 0) {
    throw paymentError(
      'La solicitud contiene campos no permitidos.',
      'WORKER_PAYMENT_UNKNOWN_FIELDS',
      { details: { fields: unknownFields.sort() } },
    );
  }
}

function identifier(value, field, max = 190) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (
    !normalized
    || normalized.length > max
    || /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    throw paymentError(`${field} es invalido.`, 'WORKER_PAYMENT_INPUT_INVALID');
  }
  return normalized;
}

function normalizedScope(value) {
  const scope = objectInput(value, 'scope');
  rejectUnknownFields(scope, new Set(['organizationId']));
  return { organizationId: identifier(scope.organizationId, 'organizationId') };
}

function normalizedPurpose(value) {
  const purpose = String(value || '').trim().toUpperCase();
  if (!PAYMENT_PURPOSES.has(purpose)) {
    throw paymentError('El proposito de cobro es invalido.', 'WORKER_PAYMENT_INPUT_INVALID');
  }
  return purpose;
}

function normalizedRevision(value) {
  if (
    typeof value !== 'number'
    || !Number.isInteger(value)
    || value < 0
    || value > MAX_PRISMA_INT
  ) {
    throw paymentError(
      'expectedRevision debe ser un entero entre 0 y 2147483647.',
      'WORKER_PAYMENT_INPUT_INVALID',
    );
  }
  return value;
}

function persistedRevision(value) {
  if (
    typeof value !== 'number'
    || !Number.isInteger(value)
    || value < 0
    || value > MAX_PRISMA_INT
  ) {
    throw paymentError(
      'La revision persistida es invalida.',
      'WORKER_PAYMENT_CONFIGURATION_INVALID',
    );
  }
  return value;
}

function normalizedDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value ?? Date.now());
  if (Number.isNaN(date.getTime())) {
    throw paymentError('La fecha de la operacion es invalida.', 'WORKER_PAYMENT_INPUT_INVALID');
  }
  return date;
}

function boundedText(value, field, max, { min = 1 } = {}) {
  if (typeof value !== 'string') {
    throw paymentError(`${field} es invalido.`, 'WORKER_PAYMENT_INPUT_INVALID');
  }
  const normalized = value.normalize('NFC').trim().replace(/\s+/g, ' ');
  if (
    normalized.length < min
    || normalized.length > max
    || /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    throw paymentError(`${field} es invalido.`, 'WORKER_PAYMENT_INPUT_INVALID');
  }
  return normalized;
}

function normalizedOperationKey(value) {
  const operationKey = typeof value === 'string' ? value.trim() : '';
  if (!IDEMPOTENCY_KEY_PATTERN.test(operationKey)) {
    throw paymentError(
      'operationKey debe tener entre 8 y 128 caracteres seguros.',
      'WORKER_PAYMENT_INPUT_INVALID',
    );
  }
  return operationKey;
}

function normalizedPolicyVersion(value) {
  const policyVersion = typeof value === 'string' ? value.trim() : '';
  if (!POLICY_VERSION_PATTERN.test(policyVersion)) {
    throw paymentError('policyVersion es invalida.', 'WORKER_PAYMENT_INPUT_INVALID');
  }
  return policyVersion;
}

function normalizedProvider(value) {
  const provider = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!PROVIDER_PATTERN.test(provider)) {
    throw paymentError('verificationProvider es invalido.', 'WORKER_PAYMENT_INPUT_INVALID');
  }
  return provider;
}

function normalizedReason(value) {
  return boundedText(value, 'reason', 500);
}

function canonicalize(value, depth = 0) {
  if (depth > 16) {
    throw paymentError('La evidencia es demasiado compleja.', 'WORKER_PAYMENT_INPUT_INVALID');
  }
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map((entry) => canonicalize(entry, depth + 1));
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key], depth + 1)]),
    );
  }
  throw paymentError('La evidencia es invalida.', 'WORKER_PAYMENT_INPUT_INVALID');
}

function canonicalString(value) {
  const serialized = JSON.stringify(canonicalize(value));
  if (!serialized || Buffer.byteLength(serialized, 'utf8') > MAX_EVIDENCE_BYTES) {
    throw paymentError('La evidencia excede el limite permitido.', 'WORKER_PAYMENT_INPUT_INVALID');
  }
  return serialized;
}

function sha256(domain, value) {
  return crypto
    .createHash('sha256')
    .update(`${domain}\n${canonicalString(value)}`, 'utf8')
    .digest('hex');
}

function evidenceHash(value, action) {
  return sha256(`obrasaas:worker-payment:${action}:evidence:v1`, value);
}

function providerReferenceHash(value) {
  const reference = boundedText(value, 'providerReference', 512);
  return sha256('obrasaas:worker-payment:provider-reference:v1', reference);
}

function scopedOperationKey(action, context, rawOperationKey) {
  return `wp:${action}:${sha256('obrasaas:worker-payment:operation:v1', {
    ...context,
    rawOperationKey,
  })}`;
}

function requestFingerprint(action, value) {
  return sha256(`obrasaas:worker-payment:${action}:request:v1`, value);
}

function confidentialRequestFingerprints(action, value, registry) {
  if (!registry?.currentKeyId || !(registry.keys instanceof Map) || registry.keys.size === 0) {
    throw paymentError(
      'La configuracion de huellas no esta disponible.',
      'WORKER_PAYMENT_CONFIGURATION_INVALID',
    );
  }
  const serialized = canonicalString(value);
  const byKeyId = new Map();
  for (const [keyId, key] of registry.keys) {
    if (!Buffer.isBuffer(key) || key.length !== 32) {
      throw paymentError(
        'La configuracion de huellas no es valida.',
        'WORKER_PAYMENT_CONFIGURATION_INVALID',
      );
    }
    byKeyId.set(
      keyId,
      crypto
        .createHmac('sha256', key)
        .update(`obrasaas:worker-payment:${action}:confidential-request:v1\n${serialized}`, 'utf8')
        .digest('hex'),
    );
  }
  if (!byKeyId.has(registry.currentKeyId)) {
    throw paymentError(
      'La clave de huellas vigente no esta disponible.',
      'WORKER_PAYMENT_CONFIGURATION_INVALID',
    );
  }
  return { current: byKeyId.get(registry.currentKeyId), candidates: new Set(byKeyId.values()) };
}

function activeSlot(organizationId, personId, purpose) {
  return sha256('obrasaas:worker-payment:active-slot:v1', {
    organizationId,
    personId,
    purpose,
  });
}

function railForType(type) {
  if (type === 'CBU') return 'AR_CBU';
  if (type === 'CVU') return 'AR_CVU';
  return null;
}

function paymentDto(record) {
  if (record?.currency !== 'ARS') {
    throw paymentError(
      'La moneda persistida del destino de cobro es invalida.',
      'WORKER_PAYMENT_CONFIGURATION_INVALID',
    );
  }
  return {
    ...serializeWorkerPaymentDestination(record),
    purpose: normalizedPurpose(record?.purpose),
    currency: 'ARS',
  };
}

function normalizedSubmitter(value) {
  const submittedBy = objectInput(value, 'submittedBy');
  rejectUnknownFields(submittedBy, SUBMITTER_FIELDS);
  const type = String(submittedBy.type || '').trim().toUpperCase();
  if (!SUBMITTER_TYPES.has(type)) {
    throw paymentError('El origen de la presentacion es invalido.', 'WORKER_PAYMENT_INPUT_INVALID');
  }
  if (type === 'TENANT_MEMBERSHIP') {
    if (submittedBy.channelIdentityId !== undefined) {
      throw paymentError('El actor de la presentacion es invalido.', 'WORKER_PAYMENT_INPUT_INVALID');
    }
    return { type, id: identifier(submittedBy.membershipId, 'membershipId') };
  }
  if (submittedBy.membershipId !== undefined) {
    throw paymentError('El actor de la presentacion es invalido.', 'WORKER_PAYMENT_INPUT_INVALID');
  }
  return { type, id: identifier(submittedBy.channelIdentityId, 'channelIdentityId') };
}

function normalizedSubmitInput(value) {
  const input = objectInput(value, 'input');
  rejectUnknownFields(input, SUBMIT_INPUT_FIELDS);
  const purpose = normalizedPurpose(input.purpose);
  const destination = normalizeWorkerPaymentDestinationInput({
    type: input.type,
    value: input.value,
    holderName: input.holderName,
    holderCuil: input.holderCuil,
  });
  return {
    ...destination,
    purpose,
    operationKey: normalizedOperationKey(input.operationKey),
  };
}

function normalizedDecisionBase(value, allowedFields, action, trustedEvidence) {
  const input = objectInput(value, 'input');
  rejectUnknownFields(input, allowedFields);
  const normalizedEvidence = canonicalize(trustedEvidence);
  canonicalString(normalizedEvidence);
  return {
    expectedRevision: normalizedRevision(input.expectedRevision),
    rawOperationKey: normalizedOperationKey(input.operationKey),
    policyVersion: normalizedPolicyVersion(input.policyVersion),
    evidenceHash: evidenceHash(normalizedEvidence, action),
  };
}

function normalizedServerResolution(value) {
  const resolution = objectInput(value, 'serverResolution');
  rejectUnknownFields(resolution, SERVER_RESOLUTION_FIELDS);
  const type = String(resolution.type || '').trim().toUpperCase();
  if (!['CBU', 'CVU'].includes(type)) {
    throw paymentError(
      'La resolucion del alias debe identificar una CBU o CVU.',
      'WORKER_PAYMENT_ALIAS_RESOLUTION_REQUIRED',
    );
  }
  return { type, value: normalizeWorkerBankKey(resolution.value, type) };
}

function normalizedAttempts(value) {
  if (value === undefined) return DEFAULT_TRANSACTION_ATTEMPTS;
  const attempts = Number(value);
  if (!Number.isSafeInteger(attempts) || attempts < 1 || attempts > 5) {
    throw paymentError('transactionAttempts es invalido.', 'WORKER_PAYMENT_INPUT_INVALID');
  }
  return attempts;
}

function resolveKeyConfiguration(value) {
  const configuration = value ?? readWorkerFinancialKeyConfiguration();
  if (!configuration?.kekRegistry || !configuration?.fingerprintRegistry) {
    throw paymentError(
      'La configuracion criptografica no esta disponible.',
      'WORKER_PAYMENT_CONFIGURATION_INVALID',
    );
  }
  return configuration;
}

function assertPrisma(prisma) {
  if (!prisma || typeof prisma.$transaction !== 'function') {
    throw paymentError(
      'La persistencia de destinos de cobro no esta disponible.',
      'WORKER_PAYMENT_CONFIGURATION_INVALID',
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
  throw paymentError(
    'No se pudo completar la operacion serializable.',
    'WORKER_PAYMENT_PERSISTENCE_CONFLICT',
  );
}

async function lockPaymentScope(transaction, scope, personId, purpose) {
  await transaction.$executeRawUnsafe(
    'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
    `worker-payment:${scope.organizationId}:${personId}:${purpose}`,
  );
}

async function requireWritableSubscription(transaction, scope, now) {
  return assertOrganizationSubscriptionAllowsWrites(transaction, scope.organizationId, { now });
}

async function requireMembership(transaction, scope, membershipId, allowedRoles) {
  const membership = await transaction.tenantMembership.findFirst({
    where: {
      id: membershipId,
      organizationId: scope.organizationId,
      status: 'ACTIVE',
      tenantRole: { in: [...allowedRoles] },
    },
    select: { id: true, organizationId: true, userId: true, tenantRole: true, status: true },
  });
  if (!membership) {
    throw paymentError(
      'El actor no tiene una membresia activa con permisos suficientes.',
      'WORKER_PAYMENT_ACTOR_FORBIDDEN',
    );
  }
  return membership;
}

async function requirePerson(transaction, scope, personId, { active = false } = {}) {
  const person = await transaction.workerPerson.findFirst({
    where: {
      id: personId,
      organizationId: scope.organizationId,
      ...(active ? { status: 'ACTIVE' } : {}),
    },
    select: {
      id: true,
      organizationId: true,
      status: true,
      identityStatus: true,
      cuilFingerprint: true,
      cuilFingerprintKeyId: true,
    },
  });
  if (!person) {
    throw paymentError(
      'La persona no pertenece a la organizacion activa.',
      'WORKER_PAYMENT_SCOPE_FORBIDDEN',
    );
  }
  return person;
}

async function requireSubmitter(transaction, scope, personId, submitter) {
  if (submitter.type === 'TENANT_MEMBERSHIP') {
    const membership = await requireMembership(transaction, scope, submitter.id, MANAGE_ROLES);
    return { ...submitter, membership, actorId: membership.userId };
  }
  const channel = await transaction.workerChannelIdentity.findFirst({
    where: {
      id: submitter.id,
      organizationId: scope.organizationId,
      personId,
      status: 'VERIFIED',
    },
    select: { id: true, organizationId: true, personId: true, status: true },
  });
  if (!channel) {
    throw paymentError(
      'El canal del trabajador no esta verificado para esta persona.',
      'WORKER_PAYMENT_ACTOR_FORBIDDEN',
    );
  }
  return { ...submitter, channel, actorId: null };
}

function candidateWhere(candidates, fields = {}) {
  return candidates.map(({ fingerprint, fingerprintKeyId }) => ({
    ...fields,
    fingerprint,
    fingerprintKeyId,
  }));
}

function canonicalCandidateWhere(candidates, type) {
  return candidates.map(({ fingerprint, fingerprintKeyId }) => ({
    canonicalType: type,
    canonicalFingerprint: fingerprint,
    canonicalFingerprintKeyId: fingerprintKeyId,
  }));
}

function resolvedCandidateWhere(candidates, type) {
  return candidates.map(({ fingerprint, fingerprintKeyId }) => ({
    resolvedType: type,
    resolvedFingerprint: fingerprint,
    resolvedFingerprintKeyId: fingerprintKeyId,
  }));
}

function canonicalIdentityDuplicateClauses(candidates, type) {
  return [
    ...candidateWhere(candidates, { type }),
    ...canonicalCandidateWhere(candidates, type),
    // Transitional compatibility while rows written before canonical identity
    // backfill still carry only the alias-resolution fingerprint.
    ...resolvedCandidateWhere(candidates, type),
  ];
}

function assertHolderBelongsToPerson(person, holderCandidates) {
  const matches = holderCandidates.some((candidate) => (
    candidate.fingerprint === person.cuilFingerprint
    && candidate.fingerprintKeyId === person.cuilFingerprintKeyId
  ));
  if (!matches) {
    throw paymentError(
      'El CUIL del titular no coincide con la identidad de la persona.',
      'WORKER_PAYMENT_HOLDER_MISMATCH',
    );
  }
}

function assertVerifiedHolderMatchesDestination(person, destination, verifiedHolderCandidates) {
  assertHolderBelongsToPerson(person, verifiedHolderCandidates);
  const matchesSubmittedHolder = verifiedHolderCandidates.some((candidate) => (
    candidate.fingerprint === destination.holderCuilFingerprint
    && candidate.fingerprintKeyId === destination.holderCuilFingerprintKeyId
  ));
  if (!matchesSubmittedHolder) {
    throw paymentError(
      'El CUIL verificado por el proveedor no coincide con el titular presentado.',
      'WORKER_PAYMENT_HOLDER_MISMATCH',
    );
  }
}

function assertReplay(row, expected) {
  if (!row) return null;
  const exact = row.organizationId === expected.organizationId
    && row.personId === expected.personId
    && row.purpose === expected.purpose
    && row.operationKey === expected.operationKey
    && expected.requestFingerprints.has(row.requestFingerprint)
    && row.submissionSource === expected.submissionSource
    && (row.submittedByMembershipId ?? null) === expected.submittedByMembershipId
    && (row.submittedByChannelIdentityId ?? null) === expected.submittedByChannelIdentityId;
  if (!exact) {
    throw paymentError(
      'La clave de idempotencia ya fue utilizada con otra solicitud.',
      'WORKER_PAYMENT_IDEMPOTENCY_CONFLICT',
    );
  }
  return row;
}

function assertDecisionReplay(ledger, expected) {
  if (!ledger) return null;
  const exact = ledger.organizationId === expected.organizationId
    && ledger.actorMembershipId === expected.actorMembershipId
    && ledger.action === expected.action
    && (ledger.workerPersonId ?? null) === null
    && (ledger.onboardingClaimId ?? null) === null
    && ledger.paymentDestinationId === expected.destinationId
    && ledger.operationKey === expected.operationKey
    && expected.requestFingerprints.has(ledger.requestFingerprint);
  if (!exact) {
    throw paymentError(
      'La clave de idempotencia ya fue utilizada con otra decision.',
      'WORKER_PAYMENT_IDEMPOTENCY_CONFLICT',
    );
  }
  return ledger;
}

async function findScopedDestination(transaction, scope, personId, purpose, destinationId) {
  return transaction.workerPaymentDestination.findFirst({
    where: {
      id: destinationId,
      organizationId: scope.organizationId,
      personId,
      purpose,
    },
  });
}

function isUniqueError(error) {
  return error?.code === 'P2002' || error?.code === '23505';
}

async function createPaymentAudit(transaction, {
  scope,
  actorId,
  action,
  destination,
  correlationId,
  decisionId = null,
}) {
  const dto = paymentDto(destination);
  return createAuditLog(transaction, {
    organizationId: scope.organizationId,
    actorId,
    action,
    entityType: 'WorkerPaymentDestination',
    entityId: destination.id,
    correlationId,
    metadata: {
      personId: destination.personId,
      purpose: destination.purpose,
      type: destination.type,
      maskedValue: dto.maskedValue,
      status: destination.status,
      version: destination.version,
      revision: destination.revision,
      ...(decisionId ? { decisionId } : {}),
    },
  });
}

function normalizeListOptions(value) {
  const options = objectInput(value, 'options');
  rejectUnknownFields(options, LIST_OPTIONS);
  return {
    scope: normalizedScope(options.scope),
    personId: identifier(options.personId, 'personId'),
    actorMembershipId: identifier(options.actorMembershipId, 'actorMembershipId'),
    purpose: options.purpose === undefined ? null : normalizedPurpose(options.purpose),
  };
}

export async function listWorkerPaymentDestinations(prisma, rawOptions) {
  assertPrisma(prisma);
  const options = normalizeListOptions(rawOptions);
  return prisma.$transaction(async (transaction) => {
    await requireMembership(transaction, options.scope, options.actorMembershipId, READ_ROLES);
    await requirePerson(transaction, options.scope, options.personId);
    const rows = await transaction.workerPaymentDestination.findMany({
      where: {
        organizationId: options.scope.organizationId,
        personId: options.personId,
        ...(options.purpose ? { purpose: options.purpose } : {}),
      },
      orderBy: [{ purpose: 'asc' }, { version: 'desc' }],
      select: {
        id: true,
        personId: true,
        purpose: true,
        type: true,
        currency: true,
        lastFour: true,
        status: true,
        version: true,
        revision: true,
        availableFrom: true,
        verifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return { paymentDestinations: rows.map(paymentDto) };
  }, { isolationLevel: 'ReadCommitted' });
}

export async function submitWorkerPaymentDestination(prisma, rawOptions) {
  const options = objectInput(rawOptions, 'options');
  rejectUnknownFields(options, SUBMIT_OPTIONS);
  const scope = normalizedScope(options.scope);
  const personId = identifier(options.personId, 'personId');
  const submitter = normalizedSubmitter(options.submittedBy);
  const input = normalizedSubmitInput(options.input);
  const now = normalizedDate(options.now);
  const keyConfiguration = resolveKeyConfiguration(options.keyConfiguration);
  const attempts = normalizedAttempts(options.transactionAttempts);
  const idFactory = options.idFactory ?? crypto.randomUUID;
  if (typeof idFactory !== 'function') {
    throw paymentError('idFactory es invalido.', 'WORKER_PAYMENT_INPUT_INVALID');
  }
  const destinationId = identifier(idFactory(), 'destinationId');
  const actorContext = {
    organizationId: scope.organizationId,
    personId,
    submitterType: submitter.type,
    submitterId: submitter.id,
  };
  const operationKey = scopedOperationKey('submit', actorContext, input.operationKey);
  const requestFingerprints = confidentialRequestFingerprints('submit', {
    ...actorContext,
    purpose: input.purpose,
    type: input.type,
    value: input.value,
    holderName: input.holderName,
    holderCuil: input.holderCuil,
    currency: input.currency,
  }, keyConfiguration.fingerprintRegistry);
  const replayIdentity = {
    organizationId: scope.organizationId,
    personId,
    purpose: input.purpose,
    operationKey,
    requestFingerprints: requestFingerprints.candidates,
    submissionSource: submitter.type,
    submittedByMembershipId: submitter.type === 'TENANT_MEMBERSHIP' ? submitter.id : null,
    submittedByChannelIdentityId: submitter.type === 'WORKER_CHANNEL' ? submitter.id : null,
  };
  const destinationCandidates = workerFinancialFingerprintCandidates(input.value, {
    organizationId: scope.organizationId,
    valueType: input.type,
  }, { registry: keyConfiguration.fingerprintRegistry });
  const holderCandidates = workerFinancialFingerprintCandidates(input.holderCuil, {
    organizationId: scope.organizationId,
    valueType: 'CUIL',
  }, { registry: keyConfiguration.fingerprintRegistry });
  const currentDestinationFingerprint = workerFinancialFingerprint(input.value, {
    organizationId: scope.organizationId,
    valueType: input.type,
  }, { registry: keyConfiguration.fingerprintRegistry });
  const currentHolderFingerprint = workerFinancialFingerprint(input.holderCuil, {
    organizationId: scope.organizationId,
    valueType: 'CUIL',
  }, { registry: keyConfiguration.fingerprintRegistry });
  const encrypted = encryptWorkerFinancialPayload({
    value: input.value,
    holderName: input.holderName,
    holderCuil: input.holderCuil,
    currency: input.currency,
  }, {
    organizationId: scope.organizationId,
    subjectId: personId,
    recordId: destinationId,
    recordVersion: 1,
    purpose: WORKER_FINANCIAL_PURPOSES.PAYMENT_DESTINATION,
    destinationType: input.type,
    field: WORKER_FINANCIAL_FIELDS.PAYMENT_DESTINATION,
  }, {
    registry: keyConfiguration.kekRegistry,
    ...(options.randomBytes ? { randomBytes: options.randomBytes } : {}),
  });

  try {
    return await runSerializable(prisma, async (transaction) => {
      await lockPaymentScope(transaction, scope, personId, input.purpose);
      const actor = await requireSubmitter(transaction, scope, personId, submitter);
      await requireWritableSubscription(transaction, scope, now);
      const person = await requirePerson(transaction, scope, personId, { active: true });
      const replay = assertReplay(
        await transaction.workerPaymentDestination.findFirst({
          where: { organizationId: scope.organizationId, personId, operationKey },
        }),
        replayIdentity,
      );
      if (replay) return { paymentDestination: paymentDto(replay), replayed: true };
      assertHolderBelongsToPerson(person, holderCandidates);

      const duplicate = await transaction.workerPaymentDestination.findFirst({
        where: {
          organizationId: scope.organizationId,
          personId,
          purpose: input.purpose,
          OR: input.type === 'ALIAS'
            ? candidateWhere(destinationCandidates, { type: 'ALIAS' })
            : canonicalIdentityDuplicateClauses(destinationCandidates, input.type),
        },
        select: { id: true },
      });
      if (duplicate) {
        throw paymentError(
          'Ese destino de cobro ya fue presentado para la persona.',
          'WORKER_PAYMENT_DUPLICATE',
        );
      }

      const previous = await transaction.workerPaymentDestination.findFirst({
        where: { organizationId: scope.organizationId, personId, purpose: input.purpose },
        orderBy: { version: 'desc' },
        select: { id: true, version: true },
      });
      const previousVersion = previous?.version ?? 0;
      if (
        typeof previousVersion !== 'number'
        || !Number.isInteger(previousVersion)
        || previousVersion < 0
        || previousVersion >= MAX_PRISMA_INT
      ) {
        throw paymentError(
          'La secuencia de versiones persistida es invalida.',
          'WORKER_PAYMENT_CONFIGURATION_INVALID',
        );
      }
      const version = previousVersion + 1;
      const row = await transaction.workerPaymentDestination.create({
        data: {
          id: destinationId,
          organizationId: scope.organizationId,
          personId,
          purpose: input.purpose,
          type: input.type,
          rail: railForType(input.type),
          currency: input.currency,
          encryptedPayload: encrypted.encryptedPayload,
          fingerprint: currentDestinationFingerprint.fingerprint,
          fingerprintKeyId: currentDestinationFingerprint.fingerprintKeyId,
          lastFour: workerFinancialLastFour(input.value, input.type),
          wrappingKeyId: encrypted.wrappingKeyId,
          recordVersion: 1,
          holderCuilFingerprint: currentHolderFingerprint.fingerprint,
          holderCuilFingerprintKeyId: currentHolderFingerprint.fingerprintKeyId,
          canonicalType: input.type === 'ALIAS' ? null : input.type,
          canonicalFingerprint: input.type === 'ALIAS'
            ? null
            : currentDestinationFingerprint.fingerprint,
          canonicalFingerprintKeyId: input.type === 'ALIAS'
            ? null
            : currentDestinationFingerprint.fingerprintKeyId,
          status: 'PENDING_VERIFICATION',
          version,
          revision: 0,
          activeSlot: null,
          previousDestinationId: previous?.id ?? null,
          operationKey,
          requestFingerprint: requestFingerprints.current,
          submissionSource: submitter.type,
          submittedAt: now,
          submittedByMembershipId: submitter.type === 'TENANT_MEMBERSHIP' ? submitter.id : null,
          submittedByChannelIdentityId: submitter.type === 'WORKER_CHANNEL' ? submitter.id : null,
        },
      });
      await createPaymentAudit(transaction, {
        scope,
        actorId: actor.actorId,
        action: 'worker.payment_destination.submitted',
        destination: row,
        correlationId: options.correlationId,
      });
      return { paymentDestination: paymentDto(row), replayed: false };
    }, attempts);
  } catch (error) {
    if (!isUniqueError(error)) throw error;
    return runSerializable(prisma, async (transaction) => {
      await lockPaymentScope(transaction, scope, personId, input.purpose);
      await requireSubmitter(transaction, scope, personId, submitter);
      await requireWritableSubscription(transaction, scope, now);
      const replay = assertReplay(
        await transaction.workerPaymentDestination.findFirst({
          where: { organizationId: scope.organizationId, personId, operationKey },
        }),
        replayIdentity,
      );
      if (replay) return { paymentDestination: paymentDto(replay), replayed: true };
      throw paymentError(
        'El destino de cobro entro en conflicto con otra operacion.',
        'WORKER_PAYMENT_PERSISTENCE_CONFLICT',
        { cause: error },
      );
    }, attempts);
  }
}

function normalizedDecisionContext(rawOptions, allowedInputFields, action) {
  const options = objectInput(rawOptions, 'options');
  rejectUnknownFields(options, DECISION_OPTIONS);
  if (action === 'verify' && options.trustedEvidence !== undefined) {
    throw paymentError(
      'La verificacion debe recibir evidencia dentro de trustedVerification.',
      'WORKER_PAYMENT_UNKNOWN_FIELDS',
    );
  }
  if (action !== 'verify' && options.trustedVerification !== undefined) {
    throw paymentError(
      'trustedVerification solo se admite al verificar.',
      'WORKER_PAYMENT_UNKNOWN_FIELDS',
    );
  }
  const scope = normalizedScope(options.scope);
  const personId = identifier(options.personId, 'personId');
  const purpose = normalizedPurpose(options.purpose);
  const destinationId = identifier(options.destinationId, 'destinationId');
  const actorMembershipId = identifier(options.actorMembershipId, 'actorMembershipId');
  const base = normalizedDecisionBase(
    options.input,
    allowedInputFields,
    action,
    action === 'verify' ? options.trustedVerification?.evidence : options.trustedEvidence,
  );
  const now = normalizedDate(options.now);
  const operationKey = scopedOperationKey(action, {
    organizationId: scope.organizationId,
    personId,
    purpose,
    destinationId,
    actorMembershipId,
  }, base.rawOperationKey);
  return {
    options,
    scope,
    personId,
    purpose,
    destinationId,
    actorMembershipId,
    now,
    operationKey,
    attempts: normalizedAttempts(options.transactionAttempts),
    ...base,
  };
}

function decisionIdentity(context, action, fingerprints) {
  return {
    organizationId: context.scope.organizationId,
    actorMembershipId: context.actorMembershipId,
    action,
    destinationId: context.destinationId,
    operationKey: context.operationKey,
    requestFingerprints: fingerprints instanceof Set ? fingerprints : new Set([fingerprints]),
  };
}

async function decisionReplay(transaction, context, identity) {
  const ledger = assertDecisionReplay(
    await transaction.workerSensitiveDecision.findFirst({
      where: {
        organizationId: context.scope.organizationId,
        operationKey: context.operationKey,
      },
    }),
    identity,
  );
  if (!ledger) return null;
  const destination = await findScopedDestination(
    transaction,
    context.scope,
    context.personId,
    context.purpose,
    context.destinationId,
  );
  if (!destination) {
    throw paymentError(
      'La decision persistida no tiene un destino valido.',
      'WORKER_PAYMENT_CONFIGURATION_INVALID',
    );
  }
  return { paymentDestination: paymentDto(destination), replayed: true };
}

async function writeDecisionAndAudit(transaction, context, actor, {
  action,
  auditAction,
  fingerprint,
  destination,
}) {
  const decision = await transaction.workerSensitiveDecision.create({
    data: {
      organizationId: context.scope.organizationId,
      actorMembershipId: actor.id,
      action,
      paymentDestinationId: context.destinationId,
      policyVersion: context.policyVersion,
      evidenceHash: context.evidenceHash,
      operationKey: context.operationKey,
      requestFingerprint: fingerprint,
    },
  });
  await createPaymentAudit(transaction, {
    scope: context.scope,
    actorId: actor.userId,
    action: auditAction,
    destination,
    correlationId: context.options.correlationId,
    decisionId: decision.id,
  });
  return { paymentDestination: paymentDto(destination), replayed: false };
}

/**
 * `trustedVerification` is deliberately outside `input`: it must be assembled
 * by a server-side bank/provider adapter. Route handlers must never copy these
 * fields from a caller-controlled JSON body.
 */
export async function verifyWorkerPaymentDestination(prisma, rawOptions) {
  const context = normalizedDecisionContext(rawOptions, VERIFY_INPUT_FIELDS, 'verify');
  const trustedVerification = objectInput(
    context.options.trustedVerification,
    'trustedVerification',
  );
  rejectUnknownFields(trustedVerification, TRUSTED_VERIFICATION_FIELDS);
  const verificationProvider = normalizedProvider(trustedVerification.verificationProvider);
  const referenceHash = providerReferenceHash(trustedVerification.providerReference);
  const resolution = trustedVerification.serverResolution === undefined
    ? null
    : normalizedServerResolution(trustedVerification.serverResolution);
  const verifiedHolderCuil = normalizeWorkerCuil(trustedVerification.verifiedHolderCuil);
  const verificationEvidence = canonicalize(trustedVerification.evidence);
  canonicalString(verificationEvidence);
  context.evidenceHash = evidenceHash(verificationEvidence, 'verify');
  const keyConfiguration = resolveKeyConfiguration(context.options.keyConfiguration);
  const normalizedRequest = {
    expectedRevision: context.expectedRevision,
    policyVersion: context.policyVersion,
    evidenceHash: context.evidenceHash,
    verificationProvider,
    providerReferenceHash: referenceHash,
  };
  const resolutionFingerprintCandidates = resolution
    ? workerFinancialFingerprintCandidates(resolution.value, {
        organizationId: context.scope.organizationId,
        valueType: resolution.type,
      }, { registry: keyConfiguration.fingerprintRegistry })
    : [];
  const verifiedHolderCandidates = workerFinancialFingerprintCandidates(verifiedHolderCuil, {
    organizationId: context.scope.organizationId,
    valueType: 'CUIL',
  }, { registry: keyConfiguration.fingerprintRegistry });
  const requestFingerprintEntries = verifiedHolderCandidates.map((holderCandidate) => {
    const resolutionCandidate = resolution
      ? resolutionFingerprintCandidates.find((candidate) => (
          candidate.fingerprintKeyId === holderCandidate.fingerprintKeyId
        ))
      : null;
    if (resolution && !resolutionCandidate) return null;
    return {
      keyId: holderCandidate.fingerprintKeyId,
      value: requestFingerprint('verify', {
        organizationId: context.scope.organizationId,
        personId: context.personId,
        purpose: context.purpose,
        destinationId: context.destinationId,
        actorMembershipId: context.actorMembershipId,
        ...normalizedRequest,
        verifiedHolder: {
          fingerprint: holderCandidate.fingerprint,
          fingerprintKeyId: holderCandidate.fingerprintKeyId,
        },
        resolution: resolutionCandidate
          ? {
              type: resolution.type,
              fingerprint: resolutionCandidate.fingerprint,
              fingerprintKeyId: resolutionCandidate.fingerprintKeyId,
            }
          : null,
      }),
    };
  });
  if (requestFingerprintEntries.some((entry) => entry === null)) {
    throw paymentError(
      'La rotacion de huellas no permite correlacionar la verificacion.',
      'WORKER_PAYMENT_CONFIGURATION_INVALID',
    );
  }
  const currentResolutionFingerprint = resolution
    ? resolutionFingerprintCandidates.find((candidate) => (
        candidate.fingerprintKeyId === keyConfiguration.fingerprintRegistry.currentKeyId
      ))
    : null;
  const currentRequestFingerprint = requestFingerprintEntries.find((entry) => (
    entry.keyId === keyConfiguration.fingerprintRegistry.currentKeyId
  ));
  if (!currentRequestFingerprint || (resolution && !currentResolutionFingerprint)) {
    throw paymentError(
      'La clave de huellas vigente no esta disponible.',
      'WORKER_PAYMENT_CONFIGURATION_INVALID',
    );
  }
  const fingerprint = currentRequestFingerprint.value;
  const identity = decisionIdentity(
    context,
    'PAYMENT_VERIFIED',
    new Set(requestFingerprintEntries.map((entry) => entry.value)),
  );

  return runSerializable(prisma, async (transaction) => {
    await lockPaymentScope(transaction, context.scope, context.personId, context.purpose);
    const actor = await requireMembership(
      transaction,
      context.scope,
      context.actorMembershipId,
      MANAGE_ROLES,
    );
    await requireWritableSubscription(transaction, context.scope, context.now);
    const replay = await decisionReplay(transaction, context, identity);
    if (replay) return replay;
    const person = await requirePerson(transaction, context.scope, context.personId, { active: true });
    if (person.identityStatus !== 'VERIFIED') {
      throw paymentError(
        'La identidad de la persona debe estar verificada antes de validar el cobro.',
        'WORKER_PAYMENT_IDENTITY_UNVERIFIED',
      );
    }
    const current = await findScopedDestination(
      transaction,
      context.scope,
      context.personId,
      context.purpose,
      context.destinationId,
    );
    if (!current) {
      throw paymentError('El destino de cobro no existe.', 'WORKER_PAYMENT_NOT_FOUND');
    }
    assertVerifiedHolderMatchesDestination(person, current, verifiedHolderCandidates);
    const currentRevision = persistedRevision(current.revision);
    if (currentRevision !== context.expectedRevision) {
      throw paymentError(
        'El destino cambio desde que fue revisado.',
        'WORKER_PAYMENT_REVISION_STALE',
        { details: { currentRevision } },
      );
    }
    if (current.status !== 'PENDING_VERIFICATION') {
      throw paymentError(
        'El destino ya no esta pendiente de verificacion.',
        'WORKER_PAYMENT_TRANSITION_CONFLICT',
      );
    }
    if (current.submittedByMembershipId === actor.id) {
      throw paymentError(
        'La persona que presento el destino no puede verificarlo.',
        'WORKER_PAYMENT_SEPARATION_REQUIRED',
      );
    }
    if (current.type === 'ALIAS' && !resolution) {
      throw paymentError(
        'El alias debe resolverse en el servidor a una CBU o CVU antes de verificarlo.',
        'WORKER_PAYMENT_ALIAS_RESOLUTION_REQUIRED',
      );
    }
    if (current.type !== 'ALIAS' && resolution) {
      throw paymentError(
        'Una CBU o CVU directa no admite una resolucion de alias.',
        'WORKER_PAYMENT_INPUT_INVALID',
      );
    }

    let resolutionData = {
      resolvedType: null,
      resolvedEncryptedPayload: null,
      resolvedFingerprint: null,
      resolvedFingerprintKeyId: null,
      resolvedWrappingKeyId: null,
      resolvedRecordVersion: null,
    };
    if (resolution) {
      const candidates = resolutionFingerprintCandidates;
      const duplicate = await transaction.workerPaymentDestination.findFirst({
        where: {
          organizationId: context.scope.organizationId,
          personId: context.personId,
          purpose: context.purpose,
          id: { not: context.destinationId },
          OR: canonicalIdentityDuplicateClauses(candidates, resolution.type),
        },
        select: { id: true },
      });
      if (duplicate) {
        throw paymentError(
          'La cuenta resuelta ya esta registrada para la persona.',
          'WORKER_PAYMENT_DUPLICATE',
        );
      }
      const resolvedFingerprint = currentResolutionFingerprint;
      const encryptedResolution = encryptWorkerFinancialPayload({ value: resolution.value }, {
        organizationId: context.scope.organizationId,
        subjectId: context.personId,
        recordId: context.destinationId,
        recordVersion: 1,
        purpose: WORKER_FINANCIAL_PURPOSES.PAYMENT_RESOLUTION,
        destinationType: resolution.type,
        field: WORKER_FINANCIAL_FIELDS.PAYMENT_RESOLUTION,
      }, {
        registry: keyConfiguration.kekRegistry,
        ...(context.options.randomBytes ? { randomBytes: context.options.randomBytes } : {}),
      });
      resolutionData = {
        resolvedType: resolution.type,
        resolvedEncryptedPayload: encryptedResolution.encryptedPayload,
        resolvedFingerprint: resolvedFingerprint.fingerprint,
        resolvedFingerprintKeyId: resolvedFingerprint.fingerprintKeyId,
        resolvedWrappingKeyId: encryptedResolution.wrappingKeyId,
        resolvedRecordVersion: 1,
        canonicalType: resolution.type,
        canonicalFingerprint: resolvedFingerprint.fingerprint,
        canonicalFingerprintKeyId: resolvedFingerprint.fingerprintKeyId,
      };
    }

    const updated = await transaction.workerPaymentDestination.updateMany({
      where: {
        id: context.destinationId,
        organizationId: context.scope.organizationId,
        personId: context.personId,
        purpose: context.purpose,
        revision: context.expectedRevision,
        status: 'PENDING_VERIFICATION',
      },
      data: {
        ...resolutionData,
        rail: resolution ? railForType(resolution.type) : current.rail,
        verificationProvider,
        providerReferenceHash: referenceHash,
        verificationEvidenceHash: context.evidenceHash,
        verifiedAt: context.now,
        verifiedByMembershipId: actor.id,
        status: 'VERIFIED',
        revision: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw paymentError(
        'El destino cambio durante la verificacion.',
        'WORKER_PAYMENT_REVISION_STALE',
      );
    }
    const destination = await findScopedDestination(
      transaction,
      context.scope,
      context.personId,
      context.purpose,
      context.destinationId,
    );
    return writeDecisionAndAudit(transaction, context, actor, {
      action: 'PAYMENT_VERIFIED',
      auditAction: 'worker.payment_destination.verified',
      fingerprint,
      destination,
    });
  }, context.attempts);
}

async function runReasonDecision(prisma, rawOptions, {
  action,
  auditAction,
  targetStatus,
  timestampField,
  actorField,
  reasonField,
  allowedStatuses,
}) {
  const context = normalizedDecisionContext(rawOptions, REASON_INPUT_FIELDS, action);
  const reason = normalizedReason(context.options.input.reason);
  const fingerprint = requestFingerprint(action, {
    organizationId: context.scope.organizationId,
    personId: context.personId,
    purpose: context.purpose,
    destinationId: context.destinationId,
    actorMembershipId: context.actorMembershipId,
    expectedRevision: context.expectedRevision,
    policyVersion: context.policyVersion,
    evidenceHash: context.evidenceHash,
    reason,
  });
  const identity = decisionIdentity(context, action, fingerprint);
  return runSerializable(prisma, async (transaction) => {
    await lockPaymentScope(transaction, context.scope, context.personId, context.purpose);
    const actor = await requireMembership(
      transaction,
      context.scope,
      context.actorMembershipId,
      MANAGE_ROLES,
    );
    await requireWritableSubscription(transaction, context.scope, context.now);
    const replay = await decisionReplay(transaction, context, identity);
    if (replay) return replay;
    await requirePerson(transaction, context.scope, context.personId, { active: true });
    const current = await findScopedDestination(
      transaction,
      context.scope,
      context.personId,
      context.purpose,
      context.destinationId,
    );
    if (!current) throw paymentError('El destino de cobro no existe.', 'WORKER_PAYMENT_NOT_FOUND');
    const currentRevision = persistedRevision(current.revision);
    if (currentRevision !== context.expectedRevision) {
      throw paymentError(
        'El destino cambio desde que fue revisado.',
        'WORKER_PAYMENT_REVISION_STALE',
        { details: { currentRevision } },
      );
    }
    if (!allowedStatuses.includes(current.status)) {
      throw paymentError(
        'El destino no admite esta decision en su estado actual.',
        'WORKER_PAYMENT_TRANSITION_CONFLICT',
      );
    }
    if (action === 'PAYMENT_REJECTED' && current.submittedByMembershipId === actor.id) {
      throw paymentError(
        'La persona que presento el destino no puede rechazar su propia presentacion.',
        'WORKER_PAYMENT_SEPARATION_REQUIRED',
      );
    }
    if (action === 'PAYMENT_REVOKED' && current.activatedByMembershipId === actor.id) {
      throw paymentError(
        'La persona que activo el destino no puede revocarlo.',
        'WORKER_PAYMENT_SEPARATION_REQUIRED',
      );
    }
    const result = await transaction.workerPaymentDestination.updateMany({
      where: {
        id: context.destinationId,
        organizationId: context.scope.organizationId,
        personId: context.personId,
        purpose: context.purpose,
        revision: context.expectedRevision,
        status: { in: allowedStatuses },
      },
      data: {
        status: targetStatus,
        [timestampField]: context.now,
        [actorField]: actor.id,
        [reasonField]: reason,
        ...(targetStatus === 'REVOKED' ? { activeSlot: null } : {}),
        revision: { increment: 1 },
      },
    });
    if (result.count !== 1) {
      throw paymentError('El destino cambio durante la decision.', 'WORKER_PAYMENT_REVISION_STALE');
    }
    const destination = await findScopedDestination(
      transaction,
      context.scope,
      context.personId,
      context.purpose,
      context.destinationId,
    );
    return writeDecisionAndAudit(transaction, context, actor, {
      action,
      auditAction,
      fingerprint,
      destination,
    });
  }, context.attempts);
}

/** `trustedEvidence` must be server-side decision context, never raw route input. */
export async function rejectWorkerPaymentDestination(prisma, rawOptions) {
  return runReasonDecision(prisma, rawOptions, {
    action: 'PAYMENT_REJECTED',
    auditAction: 'worker.payment_destination.rejected',
    targetStatus: 'REJECTED',
    timestampField: 'rejectedAt',
    actorField: 'rejectedByMembershipId',
    reasonField: 'rejectionReason',
    allowedStatuses: ['PENDING_VERIFICATION'],
  });
}

/** `trustedEvidence` must be server-side decision context, never raw route input. */
export async function activateWorkerPaymentDestination(prisma, rawOptions) {
  const context = normalizedDecisionContext(rawOptions, ACTIVATE_INPUT_FIELDS, 'activate');
  const fingerprint = requestFingerprint('activate', {
    organizationId: context.scope.organizationId,
    personId: context.personId,
    purpose: context.purpose,
    destinationId: context.destinationId,
    actorMembershipId: context.actorMembershipId,
    expectedRevision: context.expectedRevision,
    policyVersion: context.policyVersion,
    evidenceHash: context.evidenceHash,
  });
  const identity = decisionIdentity(context, 'PAYMENT_ACTIVATED', fingerprint);
  try {
    return await runSerializable(prisma, async (transaction) => {
      await lockPaymentScope(transaction, context.scope, context.personId, context.purpose);
      const actor = await requireMembership(
        transaction,
        context.scope,
        context.actorMembershipId,
        ACTIVATE_ROLES,
      );
      await requireWritableSubscription(transaction, context.scope, context.now);
      const replay = await decisionReplay(transaction, context, identity);
      if (replay) return replay;
      const person = await requirePerson(transaction, context.scope, context.personId, { active: true });
      if (person.identityStatus !== 'VERIFIED') {
        throw paymentError(
          'La identidad de la persona debe estar verificada antes de activar el cobro.',
          'WORKER_PAYMENT_IDENTITY_UNVERIFIED',
        );
      }
      const current = await findScopedDestination(
        transaction,
        context.scope,
        context.personId,
        context.purpose,
        context.destinationId,
      );
      if (!current) throw paymentError('El destino de cobro no existe.', 'WORKER_PAYMENT_NOT_FOUND');
      const currentRevision = persistedRevision(current.revision);
      if (currentRevision !== context.expectedRevision) {
        throw paymentError(
          'El destino cambio desde que fue aprobado.',
          'WORKER_PAYMENT_REVISION_STALE',
          { details: { currentRevision } },
        );
      }
      if (current.status !== 'VERIFIED' || !current.verifiedByMembershipId) {
        throw paymentError(
          'Solo un destino verificado por una persona puede activarse.',
          'WORKER_PAYMENT_TRANSITION_CONFLICT',
        );
      }
      if (
        current.submittedByMembershipId === actor.id
        || current.verifiedByMembershipId === actor.id
      ) {
        throw paymentError(
          'La activacion requiere una tercera persona distinta de quien presento y verifico.',
          'WORKER_PAYMENT_SEPARATION_REQUIRED',
        );
      }
      const previousActive = await transaction.workerPaymentDestination.findFirst({
        where: {
          organizationId: context.scope.organizationId,
          personId: context.personId,
          purpose: context.purpose,
          status: 'ACTIVE',
          id: { not: context.destinationId },
        },
      });
      if (previousActive) {
        const previousActiveRevision = persistedRevision(previousActive.revision);
        const superseded = await transaction.workerPaymentDestination.updateMany({
          where: {
            id: previousActive.id,
            organizationId: context.scope.organizationId,
            personId: context.personId,
            purpose: context.purpose,
            status: 'ACTIVE',
            revision: previousActiveRevision,
          },
          data: { status: 'SUPERSEDED', activeSlot: null, revision: { increment: 1 } },
        });
        if (superseded.count !== 1) {
          throw paymentError(
            'El destino activo cambio durante la activacion.',
            'WORKER_PAYMENT_REVISION_STALE',
          );
        }
      }
      const activated = await transaction.workerPaymentDestination.updateMany({
        where: {
          id: context.destinationId,
          organizationId: context.scope.organizationId,
          personId: context.personId,
          purpose: context.purpose,
          status: 'VERIFIED',
          revision: context.expectedRevision,
        },
        data: {
          status: 'ACTIVE',
          activeSlot: activeSlot(context.scope.organizationId, context.personId, context.purpose),
          activatedAt: context.now,
          activatedByMembershipId: actor.id,
          availableFrom: context.now,
          revision: { increment: 1 },
        },
      });
      if (activated.count !== 1) {
        throw paymentError('El destino cambio durante la activacion.', 'WORKER_PAYMENT_REVISION_STALE');
      }
      const destination = await findScopedDestination(
        transaction,
        context.scope,
        context.personId,
        context.purpose,
        context.destinationId,
      );
      return writeDecisionAndAudit(transaction, context, actor, {
        action: 'PAYMENT_ACTIVATED',
        auditAction: 'worker.payment_destination.activated',
        fingerprint,
        destination,
      });
    }, context.attempts);
  } catch (error) {
    if (!isUniqueError(error)) throw error;
    throw paymentError(
      'Ya existe otro destino activo para este proposito.',
      'WORKER_PAYMENT_PERSISTENCE_CONFLICT',
      { cause: error },
    );
  }
}

/** `trustedEvidence` must be server-side decision context, never raw route input. */
export async function revokeWorkerPaymentDestination(prisma, rawOptions) {
  return runReasonDecision(prisma, rawOptions, {
    action: 'PAYMENT_REVOKED',
    auditAction: 'worker.payment_destination.revoked',
    targetStatus: 'REVOKED',
    timestampField: 'revokedAt',
    actorField: 'revokedByMembershipId',
    reasonField: 'revocationReason',
    allowedStatuses: ['VERIFIED', 'ACTIVE'],
  });
}
