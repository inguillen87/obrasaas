import crypto, { createHash } from 'node:crypto';

import { assertOrganizationSubscriptionAllowsWrites } from './plans.js';
import { runOperationalProjectMutation } from './project-write-policy.js';
import { roleHasPermission } from './tenant-roles.js';
import {
  WORKER_FINANCIAL_FIELDS,
  WORKER_FINANCIAL_PURPOSES,
  decryptWorkerFinancialPayload,
  encryptWorkerFinancialPayload,
  maskWorkerFinancialValue,
  normalizeWorkerIdentityInput,
  normalizeWorkerWhatsAppAddress,
  normalizeWorkerWhatsAppProviderSubject,
  readWorkerFinancialKeyConfiguration,
  workerFinancialFingerprint,
  workerFinancialFingerprintCandidates,
  workerFinancialLastFour,
} from './worker-financial-data.js';

const CLAIM_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const POLICY_VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const MAX_CLAIM_LIFETIME_MS = 24 * 60 * 60 * 1_000;
const MIN_CLAIM_LIFETIME_MS = 5 * 60 * 1_000;
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;
const MAX_PRISMA_INT = 2_147_483_647;
const ONBOARDING_READ_PERMISSION = 'org:workers:onboarding:read';
const ONBOARDING_MANAGE_PERMISSION = 'org:workers:onboarding:manage';
const PORTFOLIO_ROLES = new Set(['ADMIN', 'DIRECTOR']);
const CLAIM_STATUSES = new Set([
  'PENDING',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'CANCELLED',
]);

const ERROR_STATUS = Object.freeze({
  WORKER_ONBOARDING_INPUT_INVALID: 400,
  WORKER_ONBOARDING_TOKEN_INVALID: 400,
  WORKER_ONBOARDING_PRIVACY_REQUIRED: 400,
  WORKER_ONBOARDING_FORBIDDEN: 403,
  WORKER_ONBOARDING_SCOPE_INVALID: 403,
  WORKER_ONBOARDING_NOT_FOUND: 404,
  WORKER_ONBOARDING_CONFLICT: 409,
  WORKER_ONBOARDING_IDEMPOTENCY_CONFLICT: 409,
  WORKER_ONBOARDING_EXPIRED: 410,
  WORKER_ONBOARDING_ALREADY_DECIDED: 409,
  WORKER_ONBOARDING_STALE_REVISION: 409,
  WORKER_ONBOARDING_IDENTITY_CONFLICT: 409,
  WORKER_ONBOARDING_CHANNEL_CONFLICT: 409,
  WORKER_ONBOARDING_LEGACY_AMBIGUITY: 409,
  WORKER_ONBOARDING_CONCURRENT_MODIFICATION: 409,
  WORKER_ONBOARDING_STATE_CORRUPT: 500,
});

export class WorkerOnboardingError extends Error {
  constructor(message, code = 'WORKER_ONBOARDING_INPUT_INVALID', { cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'WorkerOnboardingError';
    this.code = code;
    this.status = ERROR_STATUS[code] || 500;
  }
}

function onboardingError(message, code, options) {
  return new WorkerOnboardingError(message, code, options);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requiredIdentifier(value, field, max = 190) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (
    !normalized
    || normalized.length > max
    || /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    throw onboardingError(
      `${field} no es valido.`,
      'WORKER_ONBOARDING_INPUT_INVALID',
    );
  }
  return normalized;
}

function normalizeScope(scope) {
  return {
    organizationId: requiredIdentifier(scope?.organizationId, 'organizationId'),
    projectId: requiredIdentifier(scope?.projectId, 'projectId'),
  };
}

function normalizeDate(value, field) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw onboardingError(`${field} no es valido.`, 'WORKER_ONBOARDING_INPUT_INVALID');
  }
  return date;
}

function operationNow(now, dependencies) {
  const value = now ?? dependencies?.clock?.() ?? new Date();
  return normalizeDate(value, 'now');
}

function normalizeExpiry(value) {
  return normalizeDate(value, 'expiresAt');
}

function assertNewClaimExpiry(expiresAt, now) {
  const lifetime = expiresAt.getTime() - now.getTime();
  if (lifetime < MIN_CLAIM_LIFETIME_MS || lifetime > MAX_CLAIM_LIFETIME_MS) {
    throw onboardingError(
      'La vigencia del alta debe ser de entre 5 minutos y 24 horas.',
      'WORKER_ONBOARDING_INPUT_INVALID',
    );
  }
  return expiresAt;
}

function normalizeRevision(value) {
  if (
    typeof value !== 'number'
    || !Number.isInteger(value)
    || value < 0
    || value > MAX_PRISMA_INT
  ) {
    throw onboardingError(
      'expectedRevision debe ser un entero entre 0 y 2147483647.',
      'WORKER_ONBOARDING_INPUT_INVALID',
    );
  }
  return value;
}

function normalizeIdempotencyKey(value) {
  const key = typeof value === 'string' ? value.trim() : '';
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw onboardingError(
      'La operacion requiere una clave de idempotencia valida.',
      'WORKER_ONBOARDING_INPUT_INVALID',
    );
  }
  return key;
}

function normalizePolicyVersion(value) {
  const version = typeof value === 'string' ? value.trim() : '';
  if (!POLICY_VERSION_PATTERN.test(version)) {
    throw onboardingError(
      'policyVersion no es valida.',
      'WORKER_ONBOARDING_INPUT_INVALID',
    );
  }
  return version;
}

function normalizeEvidenceHash(value) {
  const hash = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!HASH_PATTERN.test(hash)) {
    throw onboardingError(
      'evidenceHash debe ser un SHA-256 valido.',
      'WORKER_ONBOARDING_INPUT_INVALID',
    );
  }
  return hash;
}

function normalizeClaimToken(value) {
  const token = typeof value === 'string' ? value.trim() : '';
  if (!CLAIM_TOKEN_PATTERN.test(token)) {
    throw onboardingError(
      'El token opaco de alta debe codificar exactamente 256 bits en base64url.',
      'WORKER_ONBOARDING_TOKEN_INVALID',
    );
  }
  const decoded = Buffer.from(token, 'base64url');
  if (
    decoded.length !== 32
    || decoded.toString('base64url') !== token
    || new Set(decoded).size < 16
  ) {
    throw onboardingError(
      'El token opaco de alta no es canonico.',
      'WORKER_ONBOARDING_TOKEN_INVALID',
    );
  }
  return token;
}

function normalizeDecision(value) {
  const decision = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (decision === 'APPROVE' || decision === 'APPROVED') return 'APPROVED';
  if (decision === 'REJECT' || decision === 'REJECTED') return 'REJECTED';
  throw onboardingError(
    'decision debe ser APPROVE o REJECT.',
    'WORKER_ONBOARDING_INPUT_INVALID',
  );
}

function normalizeRejectionReason(value, decision) {
  if (decision === 'APPROVED') {
    if (value !== null && value !== undefined && value !== '') {
      throw onboardingError(
        'Una aprobacion no admite motivo de rechazo.',
        'WORKER_ONBOARDING_INPUT_INVALID',
      );
    }
    return null;
  }
  const reason = typeof value === 'string'
    ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
    : '';
  if (!reason || reason.length > 500) {
    throw onboardingError(
      'El rechazo requiere un motivo de hasta 500 caracteres.',
      'WORKER_ONBOARDING_INPUT_INVALID',
    );
  }
  return reason;
}

function canonicalValue(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]),
  );
}

function canonicalHash(namespace, value) {
  return createHash('sha256')
    .update(`${namespace}\0${JSON.stringify(canonicalValue(value))}`)
    .digest('hex');
}

function scopedOperationKey(kind, scope, actorId, rawKey) {
  const digest = canonicalHash(`obrasaas:worker-onboarding:${kind}:operation:v1`, {
    scope,
    actorId,
    rawKey,
  });
  return `worker-onboarding-${kind}:v1:${digest}`;
}

function claimTokenHash(token, scope, connectionId) {
  return createHash('sha256')
    .update(
      `obrasaas:worker-onboarding:claim-token:v1\0${scope.organizationId}\0${scope.projectId}\0${connectionId}\0${token}`,
    )
    .digest('hex');
}

function normalizeSender(value) {
  if (
    !isPlainObject(value)
    || Object.keys(value).length !== 2
    || !Object.hasOwn(value, 'address')
    || !Object.hasOwn(value, 'providerSubject')
  ) {
    throw onboardingError(
      'sender debe incluir solamente address y providerSubject.',
      'WORKER_ONBOARDING_INPUT_INVALID',
    );
  }
  return {
    address: normalizeWorkerWhatsAppAddress(value.address),
    providerSubject: normalizeWorkerWhatsAppProviderSubject(value.providerSubject),
  };
}

function resolveCryptoDependencies(dependencies = {}) {
  const configuration = dependencies.keyConfiguration
    ?? (
      dependencies.kekRegistry && dependencies.fingerprintRegistry
        ? {
            kekRegistry: dependencies.kekRegistry,
            fingerprintRegistry: dependencies.fingerprintRegistry,
          }
        : readWorkerFinancialKeyConfiguration(dependencies.env)
    );
  const kekRegistry = dependencies.kekRegistry ?? configuration.kekRegistry;
  const fingerprintRegistry = dependencies.fingerprintRegistry
    ?? configuration.fingerprintRegistry;
  if (!kekRegistry?.keys || !fingerprintRegistry?.keys) {
    throw onboardingError(
      'La configuracion criptografica del alta no esta disponible.',
      'WORKER_ONBOARDING_STATE_CORRUPT',
    );
  }
  return {
    kekRegistry,
    fingerprintRegistry,
    randomBytes: dependencies.randomBytes ?? crypto.randomBytes,
    idFactory: dependencies.idFactory ?? ((kind) => {
      const prefix = kind === 'person'
        ? 'wp'
        : kind === 'channel'
          ? 'wci'
          : kind === 'worker'
            ? 'w'
            : 'woc';
      return `${prefix}_${Buffer.from((dependencies.randomBytes ?? crypto.randomBytes)(18)).toString('base64url')}`;
    }),
  };
}

function generatedId(dependencies, kind) {
  return requiredIdentifier(dependencies.idFactory(kind), `${kind}Id`);
}

function fingerprintCandidates(value, organizationId, valueType, dependencies) {
  return workerFinancialFingerprintCandidates(
    value,
    { organizationId, valueType },
    { registry: dependencies.fingerprintRegistry },
  );
}

function activeFingerprint(value, organizationId, valueType, dependencies) {
  return workerFinancialFingerprint(
    value,
    { organizationId, valueType },
    { registry: dependencies.fingerprintRegistry },
  );
}

function fingerprintWithKey(value, organizationId, valueType, keyId, dependencies) {
  return workerFinancialFingerprint(
    value,
    { organizationId, valueType },
    { registry: dependencies.fingerprintRegistry, keyId },
  );
}

function candidateWhere(keyField, fingerprintField, candidates) {
  return candidates.map((candidate) => ({
    [keyField]: candidate.fingerprintKeyId,
    [fingerprintField]: candidate.fingerprint,
  }));
}

function matchesFingerprint(record, keyField, fingerprintField, candidates) {
  return candidates.some((candidate) => (
    record?.[keyField] === candidate.fingerprintKeyId
    && record?.[fingerprintField] === candidate.fingerprint
  ));
}

async function lockSensitiveKeys(transaction, keys) {
  const stableKeys = [...new Set(keys.filter(Boolean))].sort();
  for (const key of stableKeys) {
    await transaction.$executeRawUnsafe(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      key,
    );
  }
}

function sensitiveLockKey(kind, organizationId, fingerprint) {
  return canonicalHash('obrasaas:worker-onboarding:sensitive-lock:v1', {
    kind,
    organizationId,
    fingerprint,
  });
}

function sensitiveCandidateLockKeys(kind, organizationId, candidates) {
  return candidates.map((candidate) => sensitiveLockKey(
    kind,
    organizationId,
    candidate.fingerprint,
  ));
}

function claimSenderBinding(claim) {
  return {
    organizationId: claim.organizationId,
    subjectId: claim.id,
    recordId: claim.id,
    recordVersion: Number(claim.senderRecordVersion),
    purpose: WORKER_FINANCIAL_PURPOSES.CLAIM_SENDER,
    destinationType: 'WHATSAPP_E164',
    field: WORKER_FINANCIAL_FIELDS.CLAIM_SENDER,
  };
}

function claimIdentityBinding(claim, recordVersion = claim.claimedIdentityRecordVersion) {
  return {
    organizationId: claim.organizationId,
    subjectId: claim.id,
    recordId: claim.id,
    recordVersion: Number(recordVersion),
    purpose: WORKER_FINANCIAL_PURPOSES.CLAIM_IDENTITY,
    destinationType: 'CUIL',
    field: WORKER_FINANCIAL_FIELDS.CLAIM_IDENTITY,
  };
}

function personIdentityBinding(person, recordVersion = person.recordVersion) {
  return {
    organizationId: person.organizationId,
    subjectId: person.id,
    recordId: person.id,
    recordVersion: Number(recordVersion),
    purpose: WORKER_FINANCIAL_PURPOSES.IDENTITY_CUIL,
    destinationType: 'CUIL',
    field: WORKER_FINANCIAL_FIELDS.IDENTITY_CUIL,
  };
}

function channelAddressBinding(channel, recordVersion = channel.recordVersion) {
  return {
    organizationId: channel.organizationId,
    subjectId: channel.personId,
    recordId: channel.id,
    recordVersion: Number(recordVersion),
    purpose: WORKER_FINANCIAL_PURPOSES.CHANNEL_ADDRESS,
    destinationType: 'WHATSAPP_E164',
    field: WORKER_FINANCIAL_FIELDS.CHANNEL_ADDRESS,
  };
}

function channelProviderSubjectBinding(channel, recordVersion = channel.recordVersion) {
  return {
    organizationId: channel.organizationId,
    subjectId: channel.personId,
    recordId: channel.id,
    recordVersion: Number(recordVersion),
    purpose: WORKER_FINANCIAL_PURPOSES.CHANNEL_ADDRESS,
    destinationType: 'WHATSAPP_PROVIDER_SUBJECT',
    field: WORKER_FINANCIAL_FIELDS.CHANNEL_PROVIDER_SUBJECT,
  };
}

function encryptPayload(payload, binding, dependencies) {
  return encryptWorkerFinancialPayload(payload, binding, {
    registry: dependencies.kekRegistry,
    randomBytes: dependencies.randomBytes,
  });
}

function decryptPayload(encryptedPayload, wrappingKeyId, binding, dependencies) {
  return decryptWorkerFinancialPayload(
    { encryptedPayload, wrappingKeyId },
    binding,
    { registry: dependencies.kekRegistry },
  );
}

function decryptClaimSender(claim, dependencies) {
  const payload = decryptPayload(
    claim.senderEncryptedPayload,
    claim.senderWrappingKeyId,
    claimSenderBinding(claim),
    dependencies,
  );
  if (
    Object.keys(payload).some((key) => !['address', 'providerSubject'].includes(key))
    || !Object.hasOwn(payload, 'address')
    || !Object.hasOwn(payload, 'providerSubject')
  ) {
    throw onboardingError(
      'La identidad de canal almacenada no supera la verificacion de integridad.',
      'WORKER_ONBOARDING_STATE_CORRUPT',
    );
  }
  return normalizeSender(payload);
}

function encryptedIdentityPayload(identity) {
  return {
    givenNames: identity.givenNames,
    familyName: identity.familyName,
    cuil: identity.cuil,
    privacyNoticeVersion: identity.privacyNoticeVersion,
  };
}

function decryptClaimIdentity(claim, dependencies) {
  const payload = decryptPayload(
    claim.claimedIdentityEncryptedPayload,
    claim.claimedIdentityWrappingKeyId,
    claimIdentityBinding(claim),
    dependencies,
  );
  if (
    Object.keys(payload).some((key) => ![
      'givenNames',
      'familyName',
      'cuil',
      'privacyNoticeVersion',
    ].includes(key))
    || payload.privacyNoticeVersion !== claim.privacyNoticeVersion
  ) {
    throw onboardingError(
      'La identidad declarada almacenada no supera la verificacion de integridad.',
      'WORKER_ONBOARDING_STATE_CORRUPT',
    );
  }
  return normalizeWorkerIdentityInput({
    ...payload,
    privacyAccepted: true,
  }, { now: claim.privacyAcceptedAt });
}

function decryptPersonIdentity(person, dependencies) {
  const payload = decryptPayload(
    person.encryptedIdentityPayload,
    person.wrappingKeyId,
    personIdentityBinding(person),
    dependencies,
  );
  if (Object.keys(payload).some((key) => ![
    'givenNames',
    'familyName',
    'cuil',
    'privacyNoticeVersion',
  ].includes(key))) {
    throw onboardingError(
      'La identidad laboral almacenada no supera la verificacion de integridad.',
      'WORKER_ONBOARDING_STATE_CORRUPT',
    );
  }
  return normalizeWorkerIdentityInput({
    ...payload,
    privacyAccepted: true,
  }, { now: person.privacyAcceptedAt });
}

function sameIdentity(left, right) {
  return sameCivilIdentity(left, right)
    && left.privacyNoticeVersion === right.privacyNoticeVersion;
}

function sameCivilIdentity(left, right) {
  return left.cuil === right.cuil
    && left.givenNames === right.givenNames
    && left.familyName === right.familyName;
}

function dateIso(value) {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function effectiveClaimStatus(claim, now) {
  if (
    (claim.status === 'PENDING' || claim.status === 'SUBMITTED')
    && new Date(claim.expiresAt).getTime() <= now.getTime()
  ) return 'EXPIRED';
  return claim.status;
}

/**
 * A privacy-minimal DTO. The claim token, ciphertexts, raw identity values,
 * fingerprints, wrapping keys, operation keys and audit metadata never cross
 * this boundary.
 */
function serializeClaim(claim, { now, replayed = false, legalName = null } = {}) {
  const currentTime = now ?? new Date();
  return {
    id: claim.id,
    projectId: claim.projectId,
    connectionId: claim.connectionId,
    status: effectiveClaimStatus(claim, currentTime),
    revision: Number(claim.revision),
    sender: maskWorkerFinancialValue('WHATSAPP_E164', claim.senderLastFour),
    identity: claim.claimedCuilLastFour
      ? {
          maskedCuil: maskWorkerFinancialValue('CUIL', claim.claimedCuilLastFour),
          hasLegalName: true,
          privacyNoticeVersion: claim.privacyNoticeVersion,
          ...(legalName ? { legalName } : {}),
        }
      : null,
    createdAt: dateIso(claim.createdAt),
    expiresAt: dateIso(claim.expiresAt),
    submittedAt: dateIso(claim.submittedAt),
    reviewedAt: dateIso(claim.reviewedAt),
    hasRejectionReason: Boolean(claim.rejectionReason),
    resolution: claim.status === 'APPROVED'
      ? {
          personId: claim.resolvedPersonId,
          channelIdentityId: claim.resolvedChannelIdentityId,
          workerId: claim.resolvedWorkerId,
        }
      : null,
    replayed: Boolean(replayed),
  };
}

function decodeListCursor(value) {
  if (value === null || value === undefined || value === '') return null;
  const encoded = typeof value === 'string' ? value.trim() : '';
  if (!/^[A-Za-z0-9_-]{8,512}$/.test(encoded)) {
    throw onboardingError('cursor no es valido.', 'WORKER_ONBOARDING_INPUT_INVALID');
  }
  try {
    const decoded = Buffer.from(encoded, 'base64url');
    if (decoded.toString('base64url') !== encoded) throw new TypeError('non-canonical');
    const parsed = JSON.parse(decoded.toString('utf8'));
    if (
      !isPlainObject(parsed)
      || Object.keys(parsed).length !== 2
      || !Object.hasOwn(parsed, 'createdAt')
      || !Object.hasOwn(parsed, 'id')
    ) throw new TypeError('invalid shape');
    return {
      createdAt: normalizeDate(parsed.createdAt, 'cursor.createdAt'),
      id: requiredIdentifier(parsed.id, 'cursor.id'),
    };
  } catch (cause) {
    if (cause instanceof WorkerOnboardingError) throw cause;
    throw onboardingError(
      'cursor no es valido.',
      'WORKER_ONBOARDING_INPUT_INVALID',
      { cause },
    );
  }
}

function encodeListCursor(claim) {
  return Buffer.from(JSON.stringify({
    createdAt: normalizeDate(claim.createdAt, 'createdAt').toISOString(),
    id: requiredIdentifier(claim.id, 'claimId'),
  }), 'utf8').toString('base64url');
}

async function requireMembership(transaction, scope, membershipId, permission) {
  const id = requiredIdentifier(membershipId, 'membershipId');
  const membership = await transaction.tenantMembership.findFirst({
    where: {
      id,
      organizationId: scope.organizationId,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      organizationId: true,
      userId: true,
      tenantRole: true,
      status: true,
    },
  });
  if (!membership || !roleHasPermission(membership.tenantRole, permission)) {
    throw onboardingError(
      'La membresia no tiene permisos vigentes para esta operacion.',
      'WORKER_ONBOARDING_FORBIDDEN',
    );
  }
  if (!PORTFOLIO_ROLES.has(membership.tenantRole)) {
    const projectMembership = await transaction.projectMembership.findFirst({
      where: {
        projectId: scope.projectId,
        tenantMembershipId: membership.id,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    if (!projectMembership) {
      throw onboardingError(
        'La membresia no tiene acceso vigente a esta obra.',
        'WORKER_ONBOARDING_FORBIDDEN',
      );
    }
  }
  return membership;
}

async function requireConnection(transaction, scope, connectionId) {
  const connection = await transaction.whatsAppConnection.findFirst({
    where: {
      id: connectionId,
      projectId: scope.projectId,
      enabled: true,
      connectionStatus: 'CONNECTED',
    },
    select: {
      id: true,
      projectId: true,
      enabled: true,
      connectionStatus: true,
    },
  });
  if (!connection) {
    throw onboardingError(
      'La conexion de WhatsApp no esta activa dentro de la obra.',
      'WORKER_ONBOARDING_SCOPE_INVALID',
    );
  }
  return connection;
}

function issueReplayMatches(claim, expected) {
  const storedSender = decryptClaimSender(claim, expected.dependencies);
  return claim.organizationId === expected.scope.organizationId
    && claim.projectId === expected.scope.projectId
    && claim.connectionId === expected.connectionId
    && claim.operationKey === expected.operationKey
    && claim.claimTokenHash === expected.tokenHash
    && dateIso(claim.expiresAt) === expected.expiresAt.toISOString()
    && matchesFingerprint(
      claim,
      'senderFingerprintKeyId',
      'senderFingerprint',
      expected.senderCandidates,
    )
    && storedSender.address === expected.sender.address
    && storedSender.providerSubject === expected.sender.providerSubject;
}

function assertIssueReplay(claim, expected, now) {
  if (!issueReplayMatches(claim, expected)) {
    throw onboardingError(
      'La clave de idempotencia ya fue utilizada con otros datos.',
      'WORKER_ONBOARDING_IDEMPOTENCY_CONFLICT',
    );
  }
  return serializeClaim(claim, { now, replayed: true });
}

function isUniqueConstraintError(error) {
  return error?.code === 'P2002';
}

/**
 * Persists a pre-authorized claim, but intentionally does not generate or
 * return its bearer token. A trusted Flow-session transport must generate a
 * canonical 256-bit token, retain it only long enough to deliver it, and pass
 * it here. This persistence boundary stores only the scoped SHA-256 hash.
 */
export async function issueWorkerOnboardingClaim(prisma, {
  scope: scopeInput,
  connectionId: connectionIdInput,
  sender: senderInput,
  claimToken: claimTokenInput,
  expiresAt: expiresAtInput,
  issuedByMembershipId,
  idempotencyKey: idempotencyKeyInput,
  now: nowInput,
  dependencies = {},
}) {
  const scope = normalizeScope(scopeInput);
  const connectionId = requiredIdentifier(connectionIdInput, 'connectionId');
  const sender = normalizeSender(senderInput);
  const token = normalizeClaimToken(claimTokenInput);
  const rawIdempotencyKey = normalizeIdempotencyKey(idempotencyKeyInput);
  const currentTime = operationNow(nowInput, dependencies);
  const expiresAt = normalizeExpiry(expiresAtInput);
  const cryptoDependencies = resolveCryptoDependencies(dependencies);
  const senderCandidates = fingerprintCandidates(
    sender.address,
    scope.organizationId,
    'WHATSAPP_E164',
    cryptoDependencies,
  );
  const senderFingerprint = activeFingerprint(
    sender.address,
    scope.organizationId,
    'WHATSAPP_E164',
    cryptoDependencies,
  );
  const operationKey = scopedOperationKey(
    'issue',
    scope,
    requiredIdentifier(issuedByMembershipId, 'issuedByMembershipId'),
    rawIdempotencyKey,
  );
  const tokenHash = claimTokenHash(token, scope, connectionId);
  const requestFingerprint = canonicalHash('obrasaas:worker-onboarding:issue:v1', {
    scope,
    connectionId,
    senderFingerprint,
    tokenHash,
    expiresAt,
    issuedByMembershipId,
  });
  const openClaimKey = canonicalHash('obrasaas:worker-onboarding:open-claim:v1', {
    scope,
    senderFingerprint,
  });
  const claimId = generatedId(cryptoDependencies, 'claim');
  const encryptedSender = encryptPayload(
    sender,
    claimSenderBinding({
      id: claimId,
      organizationId: scope.organizationId,
      senderRecordVersion: 1,
    }),
    cryptoDependencies,
  );
  const expected = {
    scope,
    connectionId,
    operationKey,
    tokenHash,
    expiresAt,
    senderCandidates,
    sender,
    dependencies: cryptoDependencies,
  };

  try {
    return await runOperationalProjectMutation(prisma, scope, async (transaction) => {
      await assertOrganizationSubscriptionAllowsWrites(transaction, scope.organizationId, {
        code: 'WORKER_ONBOARDING_SUBSCRIPTION_READ_ONLY',
      });
      const issuer = await requireMembership(
        transaction,
        scope,
        issuedByMembershipId,
        ONBOARDING_MANAGE_PERMISSION,
      );
      await requireConnection(transaction, scope, connectionId);

      const operationReplay = await transaction.workerOnboardingClaim.findFirst({
        where: { connectionId, operationKey },
      });
      if (operationReplay) return assertIssueReplay(operationReplay, expected, currentTime);
      assertNewClaimExpiry(expiresAt, currentTime);

      await lockSensitiveKeys(transaction, [
        ...sensitiveCandidateLockKeys('sender', scope.organizationId, senderCandidates),
      ]);
      const senderWhere = candidateWhere(
        'senderFingerprintKeyId',
        'senderFingerprint',
        senderCandidates,
      );
      await transaction.workerOnboardingClaim.updateMany({
        where: {
          organizationId: scope.organizationId,
          projectId: scope.projectId,
          status: { in: ['PENDING', 'SUBMITTED'] },
          expiresAt: { lte: currentTime },
          OR: senderWhere,
        },
        data: {
          status: 'EXPIRED',
          openClaimKey: null,
          revision: { increment: 1 },
        },
      });
      const activeClaims = await transaction.workerOnboardingClaim.findMany({
        where: {
          organizationId: scope.organizationId,
          projectId: scope.projectId,
          status: { in: ['PENDING', 'SUBMITTED'] },
          expiresAt: { gt: currentTime },
          OR: senderWhere,
        },
        take: 2,
      });
      if (activeClaims.length > 0) {
        throw onboardingError(
          activeClaims.length > 1
            ? 'Hay mas de un alta abierta para esta identidad de canal.'
            : 'Ya existe un alta abierta para esta identidad de canal.',
          'WORKER_ONBOARDING_CONFLICT',
        );
      }

      const claim = await transaction.workerOnboardingClaim.create({
        data: {
          id: claimId,
          organizationId: scope.organizationId,
          projectId: scope.projectId,
          connectionId,
          senderEncryptedPayload: encryptedSender.encryptedPayload,
          senderFingerprint: senderFingerprint.fingerprint,
          senderFingerprintKeyId: senderFingerprint.fingerprintKeyId,
          senderLastFour: workerFinancialLastFour(sender.address, 'WHATSAPP_E164'),
          senderWrappingKeyId: encryptedSender.wrappingKeyId,
          senderRecordVersion: 1,
          claimTokenHash: tokenHash,
          openClaimKey,
          status: 'PENDING',
          expiresAt,
          operationKey,
          requestFingerprint,
          revision: 0,
          createdAt: currentTime,
        },
      });
      await transaction.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          actorId: issuer.userId,
          action: 'worker.onboarding.claim_issued',
          entityType: 'WorkerOnboardingClaim',
          entityId: claim.id,
          metadata: {
            projectId: scope.projectId,
            connectionId,
            status: 'PENDING',
            revision: 0,
          },
          createdAt: currentTime,
        },
      });
      return serializeClaim(claim, { now: currentTime });
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    await requireMembership(
      prisma,
      scope,
      issuedByMembershipId,
      ONBOARDING_MANAGE_PERMISSION,
    );
    const replay = await prisma.workerOnboardingClaim.findFirst({
      where: { connectionId, operationKey },
    });
    if (replay) return assertIssueReplay(replay, expected, currentTime);
    throw onboardingError(
      'Otra operacion creo el alta al mismo tiempo.',
      'WORKER_ONBOARDING_CONCURRENT_MODIFICATION',
    );
  }
}

function assertClaimSender(claim, sender, candidates, dependencies) {
  if (!matchesFingerprint(
    claim,
    'senderFingerprintKeyId',
    'senderFingerprint',
    candidates,
  )) {
    throw onboardingError(
      'El remitente no coincide con el alta preautorizada.',
      'WORKER_ONBOARDING_FORBIDDEN',
    );
  }
  const storedSender = decryptClaimSender(claim, dependencies);
  if (
    storedSender.address !== sender.address
    || storedSender.providerSubject !== sender.providerSubject
  ) {
    throw onboardingError(
      'El remitente no coincide con el alta preautorizada.',
      'WORKER_ONBOARDING_FORBIDDEN',
    );
  }
}

function submissionRequestFingerprint(scope, connectionId, claim, sender, identity, cuilFingerprint) {
  return canonicalHash('obrasaas:worker-onboarding:submit:v1', {
    scope,
    connectionId,
    claimId: claim.id,
    senderFingerprint: {
      fingerprint: claim.senderFingerprint,
      fingerprintKeyId: claim.senderFingerprintKeyId,
    },
    providerSubject: sender.providerSubject,
    identity: {
      givenNames: identity.givenNames,
      familyName: identity.familyName,
      cuilFingerprint,
      privacyNoticeVersion: identity.privacyNoticeVersion,
    },
    privacyAccepted: true,
  });
}

export async function submitWorkerOnboardingClaim(prisma, {
  scope: scopeInput,
  connectionId: connectionIdInput,
  sender: senderInput,
  claimToken: claimTokenInput,
  identity: identityInput,
  now: nowInput,
  dependencies = {},
}) {
  const scope = normalizeScope(scopeInput);
  const connectionId = requiredIdentifier(connectionIdInput, 'connectionId');
  const sender = normalizeSender(senderInput);
  const token = normalizeClaimToken(claimTokenInput);
  const currentTime = operationNow(nowInput, dependencies);
  const identity = normalizeWorkerIdentityInput(identityInput, { now: currentTime });
  const cryptoDependencies = resolveCryptoDependencies(dependencies);
  const tokenHash = claimTokenHash(token, scope, connectionId);
  const senderCandidates = fingerprintCandidates(
    sender.address,
    scope.organizationId,
    'WHATSAPP_E164',
    cryptoDependencies,
  );
  return runOperationalProjectMutation(prisma, scope, async (transaction) => {
    await assertOrganizationSubscriptionAllowsWrites(transaction, scope.organizationId, {
      code: 'WORKER_ONBOARDING_SUBSCRIPTION_READ_ONLY',
    });
    await requireConnection(transaction, scope, connectionId);
    const claim = await transaction.workerOnboardingClaim.findFirst({
      where: {
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        connectionId,
        claimTokenHash: tokenHash,
      },
    });
    if (!claim) {
      throw onboardingError(
        'El alta no existe dentro del alcance activo.',
        'WORKER_ONBOARDING_NOT_FOUND',
      );
    }
    await lockSensitiveKeys(transaction, [
      ...sensitiveCandidateLockKeys('sender', scope.organizationId, senderCandidates),
    ]);
    assertClaimSender(claim, sender, senderCandidates, cryptoDependencies);
    if (new Date(claim.expiresAt).getTime() <= currentTime.getTime()) {
      throw onboardingError(
        'El token de alta expiro y ya no puede utilizarse.',
        'WORKER_ONBOARDING_EXPIRED',
      );
    }
    const cuilFingerprint = claim.status === 'SUBMITTED'
      ? fingerprintWithKey(
          identity.cuil,
          scope.organizationId,
          'CUIL',
          claim.claimedCuilFingerprintKeyId,
          cryptoDependencies,
        )
      : activeFingerprint(
          identity.cuil,
          scope.organizationId,
          'CUIL',
          cryptoDependencies,
        );
    const submissionFingerprint = submissionRequestFingerprint(
      scope,
      connectionId,
      claim,
      sender,
      identity,
      cuilFingerprint,
    );
    if (claim.status === 'SUBMITTED') {
      const storedIdentity = decryptClaimIdentity(claim, cryptoDependencies);
      if (
        claim.requestFingerprint !== submissionFingerprint
        || claim.claimedCuilFingerprint !== cuilFingerprint.fingerprint
        || !sameIdentity(storedIdentity, identity)
      ) {
        throw onboardingError(
          'El token ya fue utilizado con otra declaracion.',
          'WORKER_ONBOARDING_IDEMPOTENCY_CONFLICT',
        );
      }
      return serializeClaim(claim, { now: currentTime, replayed: true });
    }
    if (claim.status !== 'PENDING') {
      throw onboardingError(
        'El token ya no admite una nueva declaracion.',
        'WORKER_ONBOARDING_ALREADY_DECIDED',
      );
    }

    const recordVersion = 1;
    const encryptedIdentity = encryptPayload(
      encryptedIdentityPayload(identity),
      claimIdentityBinding(claim, recordVersion),
      cryptoDependencies,
    );
    const updated = await transaction.workerOnboardingClaim.updateMany({
      where: {
        id: claim.id,
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        connectionId,
        status: 'PENDING',
        revision: Number(claim.revision),
        claimTokenHash: tokenHash,
      },
      data: {
        claimedIdentityEncryptedPayload: encryptedIdentity.encryptedPayload,
        claimedCuilFingerprint: cuilFingerprint.fingerprint,
        claimedCuilFingerprintKeyId: cuilFingerprint.fingerprintKeyId,
        claimedCuilLastFour: workerFinancialLastFour(identity.cuil, 'CUIL'),
        claimedIdentityWrappingKeyId: encryptedIdentity.wrappingKeyId,
        claimedIdentityRecordVersion: recordVersion,
        privacyNoticeVersion: identity.privacyNoticeVersion,
        privacyAcceptedAt: identity.privacyAcceptedAt,
        status: 'SUBMITTED',
        submittedAt: currentTime,
        requestFingerprint: submissionFingerprint,
        revision: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw onboardingError(
        'El alta cambio durante la declaracion.',
        'WORKER_ONBOARDING_CONCURRENT_MODIFICATION',
      );
    }
    const submitted = {
      ...claim,
      claimedIdentityEncryptedPayload: encryptedIdentity.encryptedPayload,
      claimedCuilFingerprint: cuilFingerprint.fingerprint,
      claimedCuilFingerprintKeyId: cuilFingerprint.fingerprintKeyId,
      claimedCuilLastFour: workerFinancialLastFour(identity.cuil, 'CUIL'),
      claimedIdentityWrappingKeyId: encryptedIdentity.wrappingKeyId,
      claimedIdentityRecordVersion: recordVersion,
      privacyNoticeVersion: identity.privacyNoticeVersion,
      privacyAcceptedAt: identity.privacyAcceptedAt,
      status: 'SUBMITTED',
      submittedAt: currentTime,
      requestFingerprint: submissionFingerprint,
      revision: Number(claim.revision) + 1,
    };
    await transaction.auditLog.create({
      data: {
        organizationId: scope.organizationId,
        actorId: null,
        action: 'worker.onboarding.claim_submitted',
        entityType: 'WorkerOnboardingClaim',
        entityId: claim.id,
        metadata: {
          projectId: scope.projectId,
          connectionId,
          status: 'SUBMITTED',
          revision: submitted.revision,
        },
        createdAt: currentTime,
      },
    });
    return serializeClaim(submitted, { now: currentTime });
  });
}

async function findMatchingPerson(transaction, scope, identity, candidates, dependencies) {
  const people = await transaction.workerPerson.findMany({
    where: {
      organizationId: scope.organizationId,
      OR: candidateWhere('cuilFingerprintKeyId', 'cuilFingerprint', candidates),
    },
    take: 2,
  });
  if (people.length > 1) {
    throw onboardingError(
      'La identidad coincide con mas de una persona laboral.',
      'WORKER_ONBOARDING_IDENTITY_CONFLICT',
    );
  }
  const person = people[0] ?? null;
  if (!person) return null;
  if (person.status !== 'ACTIVE' || person.identityStatus === 'REJECTED') {
    throw onboardingError(
      'La identidad coincide con una persona que no admite altas automaticas.',
      'WORKER_ONBOARDING_IDENTITY_CONFLICT',
    );
  }
  const storedIdentity = decryptPersonIdentity(person, dependencies);
  if (!sameCivilIdentity(storedIdentity, identity)) {
    throw onboardingError(
      'La identidad declarada contradice los datos laborales existentes.',
      'WORKER_ONBOARDING_IDENTITY_CONFLICT',
    );
  }
  return person;
}

async function createOrRefreshPerson(transaction, scope, identity, dependencies) {
  const candidates = fingerprintCandidates(
    identity.cuil,
    scope.organizationId,
    'CUIL',
    dependencies,
  );
  const active = activeFingerprint(
    identity.cuil,
    scope.organizationId,
    'CUIL',
    dependencies,
  );
  let person = await findMatchingPerson(
    transaction,
    scope,
    identity,
    candidates,
    dependencies,
  );
  if (!person) {
    const personId = generatedId(dependencies, 'person');
    const recordVersion = 1;
    const encryptedIdentity = encryptPayload(
      encryptedIdentityPayload(identity),
      personIdentityBinding({
        id: personId,
        organizationId: scope.organizationId,
        recordVersion,
      }),
      dependencies,
    );
    person = await transaction.workerPerson.create({
      data: {
        id: personId,
        organizationId: scope.organizationId,
        status: 'ACTIVE',
        identityStatus: 'PENDING_REVIEW',
        encryptedIdentityPayload: encryptedIdentity.encryptedPayload,
        cuilFingerprint: active.fingerprint,
        cuilFingerprintKeyId: active.fingerprintKeyId,
        cuilLastFour: workerFinancialLastFour(identity.cuil, 'CUIL'),
        wrappingKeyId: encryptedIdentity.wrappingKeyId,
        recordVersion,
        privacyNoticeVersion: identity.privacyNoticeVersion,
        privacyAcceptedAt: identity.privacyAcceptedAt,
        revision: 0,
      },
    });
    return person;
  }

  // Re-encrypt only identities that are still awaiting civil review. A
  // previously verified record is integrity-checked above but never silently
  // rewritten, because doing so would invalidate its human decision evidence.
  if (person.identityStatus === 'PENDING_REVIEW') {
    const nextRecordVersion = Number(person.recordVersion) + 1;
    const encryptedIdentity = encryptPayload(
      encryptedIdentityPayload(identity),
      personIdentityBinding(person, nextRecordVersion),
      dependencies,
    );
    const updated = await transaction.workerPerson.updateMany({
      where: {
        id: person.id,
        organizationId: scope.organizationId,
        status: 'ACTIVE',
        identityStatus: 'PENDING_REVIEW',
        revision: Number(person.revision),
      },
      data: {
        encryptedIdentityPayload: encryptedIdentity.encryptedPayload,
        cuilFingerprint: active.fingerprint,
        cuilFingerprintKeyId: active.fingerprintKeyId,
        cuilLastFour: workerFinancialLastFour(identity.cuil, 'CUIL'),
        wrappingKeyId: encryptedIdentity.wrappingKeyId,
        recordVersion: nextRecordVersion,
        privacyNoticeVersion: identity.privacyNoticeVersion,
        privacyAcceptedAt: identity.privacyAcceptedAt,
        revision: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw onboardingError(
        'La identidad laboral cambio durante el alta.',
        'WORKER_ONBOARDING_CONCURRENT_MODIFICATION',
      );
    }
    person = {
      ...person,
      encryptedIdentityPayload: encryptedIdentity.encryptedPayload,
      cuilFingerprint: active.fingerprint,
      cuilFingerprintKeyId: active.fingerprintKeyId,
      cuilLastFour: workerFinancialLastFour(identity.cuil, 'CUIL'),
      wrappingKeyId: encryptedIdentity.wrappingKeyId,
      recordVersion: nextRecordVersion,
      revision: Number(person.revision) + 1,
    };
  }
  return person;
}

function decryptChannelAddress(channel, dependencies) {
  const payload = decryptPayload(
    channel.encryptedAddressPayload,
    channel.wrappingKeyId,
    channelAddressBinding(channel),
    dependencies,
  );
  if (Object.keys(payload).length !== 1 || !Object.hasOwn(payload, 'address')) {
    throw onboardingError(
      'La direccion de canal almacenada no supera la verificacion de integridad.',
      'WORKER_ONBOARDING_STATE_CORRUPT',
    );
  }
  return normalizeWorkerWhatsAppAddress(payload.address);
}

function decryptChannelProviderSubject(channel, dependencies) {
  if (
    !channel.encryptedProviderSubjectPayload
    || !channel.providerSubjectFingerprint
    || !channel.providerSubjectFingerprintKeyId
  ) {
    throw onboardingError(
      'La identidad de canal heredada no tiene un sujeto de proveedor verificable.',
      'WORKER_ONBOARDING_CHANNEL_CONFLICT',
    );
  }
  const payload = decryptPayload(
    channel.encryptedProviderSubjectPayload,
    channel.wrappingKeyId,
    channelProviderSubjectBinding(channel),
    dependencies,
  );
  if (Object.keys(payload).length !== 1 || !Object.hasOwn(payload, 'providerSubject')) {
    throw onboardingError(
      'El sujeto de proveedor almacenado no supera la verificacion de integridad.',
      'WORKER_ONBOARDING_STATE_CORRUPT',
    );
  }
  return normalizeWorkerWhatsAppProviderSubject(payload.providerSubject);
}

async function createOrVerifyChannel(transaction, scope, person, sender, now, dependencies) {
  const addressCandidates = fingerprintCandidates(
    sender.address,
    scope.organizationId,
    'WHATSAPP_E164',
    dependencies,
  );
  const providerCandidates = fingerprintCandidates(
    sender.providerSubject,
    scope.organizationId,
    'WHATSAPP_PROVIDER_SUBJECT',
    dependencies,
  );
  const channels = await transaction.workerChannelIdentity.findMany({
    where: {
      organizationId: scope.organizationId,
      provider: 'WHATSAPP',
      OR: [
        ...candidateWhere(
          'addressFingerprintKeyId',
          'addressFingerprint',
          addressCandidates,
        ),
        ...candidateWhere(
          'providerSubjectFingerprintKeyId',
          'providerSubjectFingerprint',
          providerCandidates,
        ),
      ],
    },
    take: 2,
  });
  if (channels.length > 1) {
    throw onboardingError(
      'La direccion de WhatsApp coincide con multiples identidades de canal.',
      'WORKER_ONBOARDING_CHANNEL_CONFLICT',
    );
  }
  let channel = channels[0] ?? null;
  if (channel) {
    if (
      channel.personId !== person.id
      || channel.status === 'CONFLICT'
      || channel.status === 'REVOKED'
      || !matchesFingerprint(
        channel,
        'addressFingerprintKeyId',
        'addressFingerprint',
        addressCandidates,
      )
      || !matchesFingerprint(
        channel,
        'providerSubjectFingerprintKeyId',
        'providerSubjectFingerprint',
        providerCandidates,
      )
      || decryptChannelAddress(channel, dependencies) !== sender.address
      || decryptChannelProviderSubject(channel, dependencies) !== sender.providerSubject
    ) {
      throw onboardingError(
        'La direccion de WhatsApp contradice una identidad de canal existente.',
        'WORKER_ONBOARDING_CHANNEL_CONFLICT',
      );
    }
    if (channel.status === 'VERIFIED') return channel;
    if (channel.status !== 'PENDING') {
      throw onboardingError(
        'La identidad de canal no admite verificacion automatica.',
        'WORKER_ONBOARDING_CHANNEL_CONFLICT',
      );
    }
    const updated = await transaction.workerChannelIdentity.updateMany({
      where: {
        id: channel.id,
        organizationId: scope.organizationId,
        personId: person.id,
        status: 'PENDING',
        revision: Number(channel.revision),
      },
      data: {
        status: 'VERIFIED',
        verifiedAt: now,
        verificationMethod: 'ONBOARDING_CLAIM_TOKEN_V1',
        revision: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw onboardingError(
        'La identidad de canal cambio durante el alta.',
        'WORKER_ONBOARDING_CONCURRENT_MODIFICATION',
      );
    }
    return {
      ...channel,
      status: 'VERIFIED',
      verifiedAt: now,
      verificationMethod: 'ONBOARDING_CLAIM_TOKEN_V1',
      revision: Number(channel.revision) + 1,
    };
  }

  const channelId = generatedId(dependencies, 'channel');
  const recordVersion = 1;
  const addressFingerprint = activeFingerprint(
    sender.address,
    scope.organizationId,
    'WHATSAPP_E164',
    dependencies,
  );
  const providerFingerprint = activeFingerprint(
    sender.providerSubject,
    scope.organizationId,
    'WHATSAPP_PROVIDER_SUBJECT',
    dependencies,
  );
  const baseChannel = {
    id: channelId,
    organizationId: scope.organizationId,
    personId: person.id,
    recordVersion,
  };
  const encryptedAddress = encryptPayload(
    { address: sender.address },
    channelAddressBinding(baseChannel),
    dependencies,
  );
  const encryptedProviderSubject = encryptPayload(
    { providerSubject: sender.providerSubject },
    channelProviderSubjectBinding(baseChannel),
    dependencies,
  );
  if (encryptedAddress.wrappingKeyId !== encryptedProviderSubject.wrappingKeyId) {
    throw onboardingError(
      'La rotacion de claves cambio durante el alta.',
      'WORKER_ONBOARDING_CONCURRENT_MODIFICATION',
    );
  }
  channel = await transaction.workerChannelIdentity.create({
    data: {
      ...baseChannel,
      provider: 'WHATSAPP',
      status: 'VERIFIED',
      encryptedAddressPayload: encryptedAddress.encryptedPayload,
      addressFingerprint: addressFingerprint.fingerprint,
      addressFingerprintKeyId: addressFingerprint.fingerprintKeyId,
      addressLastFour: workerFinancialLastFour(sender.address, 'WHATSAPP_E164'),
      wrappingKeyId: encryptedAddress.wrappingKeyId,
      encryptedProviderSubjectPayload: encryptedProviderSubject.encryptedPayload,
      providerSubjectFingerprint: providerFingerprint.fingerprint,
      providerSubjectFingerprintKeyId: providerFingerprint.fingerprintKeyId,
      verifiedAt: now,
      verificationMethod: 'ONBOARDING_CLAIM_TOKEN_V1',
      revision: 0,
    },
  });
  return channel;
}

function tryNormalizeLegacyPhone(value) {
  if (value === null || value === undefined || value === '') return null;
  try {
    return normalizeWorkerWhatsAppAddress(String(value));
  } catch {
    return null;
  }
}

async function createOrReuseWorkerBridge(transaction, scope, person, sender, claim) {
  const workers = await transaction.worker.findMany({
    where: {
      projectId: scope.projectId,
      project: { organizationId: scope.organizationId },
    },
    select: {
      id: true,
      organizationId: true,
      projectId: true,
      personId: true,
      phone: true,
      name: true,
      active: true,
      metadata: true,
    },
  });
  const personBridges = workers.filter((worker) => (
    worker.organizationId === scope.organizationId && worker.personId === person.id
  ));
  const legacyMatches = workers.filter((worker) => (
    tryNormalizeLegacyPhone(worker.phone) === sender.address
  ));
  if (personBridges.length > 1 || legacyMatches.length > 1) {
    throw onboardingError(
      'La obra contiene registros heredados ambiguos para esta persona.',
      'WORKER_ONBOARDING_LEGACY_AMBIGUITY',
    );
  }
  const bridge = personBridges[0] ?? null;
  const legacy = legacyMatches[0] ?? null;
  if (legacy?.personId && legacy.personId !== person.id) {
    throw onboardingError(
      'El telefono heredado no puede vincularse de forma inequivoca.',
      'WORKER_ONBOARDING_LEGACY_AMBIGUITY',
    );
  }
  if (bridge) {
    if (!bridge.active) {
      throw onboardingError(
        'La persona ya tiene un vinculo inactivo en esta obra.',
        'WORKER_ONBOARDING_IDENTITY_CONFLICT',
      );
    }
    if (bridge.phone) {
      if (tryNormalizeLegacyPhone(bridge.phone) !== sender.address) {
        throw onboardingError(
          'El telefono heredado contradice la identidad de canal verificada.',
          'WORKER_ONBOARDING_LEGACY_AMBIGUITY',
        );
      }
      const cleared = await transaction.worker.updateMany({
        where: {
          id: bridge.id,
          projectId: scope.projectId,
          organizationId: scope.organizationId,
          personId: person.id,
          phone: bridge.phone,
          active: true,
        },
        data: { phone: null },
      });
      if (cleared.count !== 1) {
        throw onboardingError(
          'El vinculo laboral cambio durante la migracion del canal.',
          'WORKER_ONBOARDING_CONCURRENT_MODIFICATION',
        );
      }
      return { ...bridge, phone: null };
    }
    return bridge;
  }
  if (legacy) {
    if (
      legacy.personId !== null
      || (legacy.organizationId !== null && legacy.organizationId !== scope.organizationId)
      || !legacy.active
    ) {
      throw onboardingError(
        'El telefono heredado no puede vincularse de forma inequivoca.',
        'WORKER_ONBOARDING_LEGACY_AMBIGUITY',
      );
    }
    const adopted = await transaction.worker.updateMany({
      where: {
        id: legacy.id,
        projectId: scope.projectId,
        personId: null,
        phone: legacy.phone,
        active: true,
        OR: [
          { organizationId: null },
          { organizationId: scope.organizationId },
        ],
      },
      data: {
        organizationId: scope.organizationId,
        personId: person.id,
        phone: null,
      },
    });
    if (adopted.count !== 1) {
      throw onboardingError(
        'El registro heredado cambio durante su adopcion.',
        'WORKER_ONBOARDING_CONCURRENT_MODIFICATION',
      );
    }
    return {
      ...legacy,
      organizationId: scope.organizationId,
      personId: person.id,
      phone: null,
    };
  }
  return transaction.worker.create({
    data: {
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      personId: person.id,
      phone: null,
      name: `Operario **** ${claim.senderLastFour}`,
      active: true,
      metadata: { identitySource: 'WORKER_ONBOARDING_CLAIM_V1' },
    },
  });
}

async function resolveApproval(transaction, scope, claim, identity, sender, now, dependencies) {
  const cuilCandidates = fingerprintCandidates(
    identity.cuil,
    scope.organizationId,
    'CUIL',
    dependencies,
  );
  if (!matchesFingerprint(
    claim,
    'claimedCuilFingerprintKeyId',
    'claimedCuilFingerprint',
    cuilCandidates,
  )) {
    throw onboardingError(
      'La huella de identidad declarada no supera la verificacion de integridad.',
      'WORKER_ONBOARDING_STATE_CORRUPT',
    );
  }
  const senderCandidates = fingerprintCandidates(
    sender.address,
    scope.organizationId,
    'WHATSAPP_E164',
    dependencies,
  );
  await lockSensitiveKeys(transaction, [
    ...sensitiveCandidateLockKeys('cuil', scope.organizationId, cuilCandidates),
    ...sensitiveCandidateLockKeys('sender', scope.organizationId, senderCandidates),
  ]);
  const person = await createOrRefreshPerson(transaction, scope, identity, dependencies);
  const channel = await createOrVerifyChannel(
    transaction,
    scope,
    person,
    sender,
    now,
    dependencies,
  );
  const worker = await createOrReuseWorkerBridge(
    transaction,
    scope,
    person,
    sender,
    claim,
  );
  return { person, channel, worker };
}

function decisionReplayMatches(decision, expected) {
  return decision.organizationId === expected.scope.organizationId
    && decision.actorMembershipId === expected.membershipId
    && decision.onboardingClaimId === expected.claimId
    && decision.action === expected.action
    && decision.policyVersion === expected.policyVersion
    && decision.evidenceHash === expected.evidenceHash
    && decision.operationKey === expected.operationKey
    && decision.requestFingerprint === expected.requestFingerprint;
}

async function loadExactDecisionReplay(prisma, expected, now) {
  await requireMembership(
    prisma,
    expected.scope,
    expected.membershipId,
    ONBOARDING_MANAGE_PERMISSION,
  );
  const storedDecision = await prisma.workerSensitiveDecision.findFirst({
    where: {
      organizationId: expected.scope.organizationId,
      operationKey: expected.operationKey,
    },
  });
  if (!storedDecision) return null;
  if (!decisionReplayMatches(storedDecision, expected)) {
    throw onboardingError(
      'La clave de idempotencia ya fue utilizada con otra decision.',
      'WORKER_ONBOARDING_IDEMPOTENCY_CONFLICT',
    );
  }
  const terminalStatus = expected.action === 'ONBOARDING_APPROVED'
    ? 'APPROVED'
    : 'REJECTED';
  const claim = await prisma.workerOnboardingClaim.findFirst({
    where: {
      id: expected.claimId,
      organizationId: expected.scope.organizationId,
      projectId: expected.scope.projectId,
    },
  });
  if (!claim || claim.status !== terminalStatus) {
    throw onboardingError(
      'La decision almacenada no coincide con el estado del alta.',
      'WORKER_ONBOARDING_STATE_CORRUPT',
    );
  }
  return serializeClaim(claim, { now, replayed: true });
}

export async function decideWorkerOnboardingClaim(prisma, {
  scope: scopeInput,
  claimId: claimIdInput,
  decidedByMembershipId: membershipIdInput,
  decision: decisionInput,
  expectedRevision: revisionInput,
  evidenceHash: evidenceHashInput,
  policyVersion: policyVersionInput,
  rejectionReason: rejectionReasonInput = null,
  idempotencyKey: idempotencyKeyInput,
  now: nowInput,
  dependencies = {},
}) {
  const scope = normalizeScope(scopeInput);
  const claimId = requiredIdentifier(claimIdInput, 'claimId');
  const membershipId = requiredIdentifier(membershipIdInput, 'decidedByMembershipId');
  const decision = normalizeDecision(decisionInput);
  const expectedRevision = normalizeRevision(revisionInput);
  const evidenceHash = normalizeEvidenceHash(evidenceHashInput);
  const policyVersion = normalizePolicyVersion(policyVersionInput);
  const rejectionReason = normalizeRejectionReason(rejectionReasonInput, decision);
  const rawIdempotencyKey = normalizeIdempotencyKey(idempotencyKeyInput);
  const currentTime = operationNow(nowInput, dependencies);
  const cryptoDependencies = resolveCryptoDependencies(dependencies);
  const operationKey = scopedOperationKey(
    'decision',
    scope,
    membershipId,
    rawIdempotencyKey,
  );
  const action = decision === 'APPROVED'
    ? 'ONBOARDING_APPROVED'
    : 'ONBOARDING_REJECTED';
  const requestFingerprint = canonicalHash('obrasaas:worker-onboarding:decision:v1', {
    scope,
    claimId,
    membershipId,
    decision,
    expectedRevision,
    evidenceHash,
    policyVersion,
    rejectionReason,
  });
  const expectedReplay = {
    scope,
    claimId,
    membershipId,
    action,
    evidenceHash,
    policyVersion,
    operationKey,
    requestFingerprint,
  };

  try {
    return await runOperationalProjectMutation(prisma, scope, async (transaction) => {
    await assertOrganizationSubscriptionAllowsWrites(transaction, scope.organizationId, {
      code: 'WORKER_ONBOARDING_SUBSCRIPTION_READ_ONLY',
    });
    const membership = await requireMembership(
      transaction,
      scope,
      membershipId,
      ONBOARDING_MANAGE_PERMISSION,
    );
    const storedDecision = await transaction.workerSensitiveDecision.findFirst({
      where: {
        organizationId: scope.organizationId,
        operationKey,
      },
    });
    if (storedDecision) {
      if (!decisionReplayMatches(storedDecision, expectedReplay)) {
        throw onboardingError(
          'La clave de idempotencia ya fue utilizada con otra decision.',
          'WORKER_ONBOARDING_IDEMPOTENCY_CONFLICT',
        );
      }
      const replayedClaim = await transaction.workerOnboardingClaim.findFirst({
        where: {
          id: claimId,
          organizationId: scope.organizationId,
          projectId: scope.projectId,
        },
      });
      if (!replayedClaim || replayedClaim.status !== decision) {
        throw onboardingError(
          'La decision almacenada no coincide con el estado del alta.',
          'WORKER_ONBOARDING_STATE_CORRUPT',
        );
      }
      return serializeClaim(replayedClaim, { now: currentTime, replayed: true });
    }

    const claim = await transaction.workerOnboardingClaim.findFirst({
      where: {
        id: claimId,
        organizationId: scope.organizationId,
        projectId: scope.projectId,
      },
    });
    if (!claim) {
      throw onboardingError(
        'El alta no existe dentro del alcance activo.',
        'WORKER_ONBOARDING_NOT_FOUND',
      );
    }
    if (claim.status !== 'SUBMITTED') {
      throw onboardingError(
        'El alta no esta pendiente de decision.',
        'WORKER_ONBOARDING_ALREADY_DECIDED',
      );
    }
    if (Number(claim.revision) !== expectedRevision) {
      throw onboardingError(
        'El alta cambio desde que fue revisada.',
        'WORKER_ONBOARDING_STALE_REVISION',
      );
    }
    if (new Date(claim.expiresAt).getTime() <= currentTime.getTime()) {
      throw onboardingError(
        'El alta expiro antes de la decision.',
        'WORKER_ONBOARDING_EXPIRED',
      );
    }

    const sender = decryptClaimSender(claim, cryptoDependencies);
    const identity = decryptClaimIdentity(claim, cryptoDependencies);
    const senderCandidates = fingerprintCandidates(
      sender.address,
      scope.organizationId,
      'WHATSAPP_E164',
      cryptoDependencies,
    );
    if (!matchesFingerprint(
      claim,
      'senderFingerprintKeyId',
      'senderFingerprint',
      senderCandidates,
    )) {
      throw onboardingError(
        'La huella del remitente no supera la verificacion de integridad.',
        'WORKER_ONBOARDING_STATE_CORRUPT',
      );
    }

    let resolution = null;
    if (decision === 'APPROVED') {
      resolution = await resolveApproval(
        transaction,
        scope,
        claim,
        identity,
        sender,
        currentTime,
        cryptoDependencies,
      );
    }

    const claimUpdate = {
      status: decision,
      openClaimKey: null,
      reviewedAt: currentTime,
      reviewedById: membership.userId,
      reviewedByMembershipId: membership.id,
      reviewEvidenceHash: evidenceHash,
      rejectionReason,
      resolvedPersonId: resolution?.person.id ?? null,
      resolvedChannelIdentityId: resolution?.channel.id ?? null,
      resolvedWorkerId: resolution?.worker.id ?? null,
      revision: { increment: 1 },
    };
    const updated = await transaction.workerOnboardingClaim.updateMany({
      where: {
        id: claim.id,
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        status: 'SUBMITTED',
        revision: expectedRevision,
      },
      data: claimUpdate,
    });
    if (updated.count !== 1) {
      throw onboardingError(
        'El alta cambio durante la decision.',
        'WORKER_ONBOARDING_CONCURRENT_MODIFICATION',
      );
    }
    const decisionRecord = await transaction.workerSensitiveDecision.create({
      data: {
        organizationId: scope.organizationId,
        actorMembershipId: membership.id,
        action,
        onboardingClaimId: claim.id,
        policyVersion,
        evidenceHash,
        operationKey,
        requestFingerprint,
        createdAt: currentTime,
      },
    });
    await transaction.auditLog.create({
      data: {
        organizationId: scope.organizationId,
        actorId: membership.userId,
        action: decision === 'APPROVED'
          ? 'worker.onboarding.approved'
          : 'worker.onboarding.rejected',
        entityType: 'WorkerOnboardingClaim',
        entityId: claim.id,
        metadata: {
          projectId: scope.projectId,
          status: decision,
          revision: expectedRevision + 1,
          decisionId: decisionRecord.id,
        },
        createdAt: currentTime,
      },
    });
    return serializeClaim({
      ...claim,
      ...claimUpdate,
      revision: expectedRevision + 1,
    }, { now: currentTime });
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const replay = await loadExactDecisionReplay(prisma, expectedReplay, currentTime);
    if (replay) return replay;
    throw onboardingError(
      'Otra operacion decidio el alta al mismo tiempo.',
      'WORKER_ONBOARDING_CONCURRENT_MODIFICATION',
    );
  }
}

export async function listWorkerOnboardingClaims(prisma, {
  scope: scopeInput,
  requestedByMembershipId,
  status: statusInput = null,
  limit: limitInput = DEFAULT_LIST_LIMIT,
  cursor: cursorInput = null,
  now: nowInput,
  dependencies = {},
}) {
  const scope = normalizeScope(scopeInput);
  const currentTime = operationNow(nowInput, dependencies);
  const cryptoDependencies = resolveCryptoDependencies(dependencies);
  const cursor = decodeListCursor(cursorInput);
  const status = statusInput == null || statusInput === ''
    ? null
    : String(statusInput).trim().toUpperCase();
  if (status && !CLAIM_STATUSES.has(status)) {
    throw onboardingError('status no es valido.', 'WORKER_ONBOARDING_INPUT_INVALID');
  }
  const limit = Number(limitInput);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIST_LIMIT) {
    throw onboardingError(
      `limit debe estar entre 1 y ${MAX_LIST_LIMIT}.`,
      'WORKER_ONBOARDING_INPUT_INVALID',
    );
  }
  const project = await prisma.project.findFirst({
    where: {
      id: scope.projectId,
      organizationId: scope.organizationId,
    },
    select: { id: true },
  });
  if (!project) {
    throw onboardingError(
      'La obra no existe dentro de la organizacion activa.',
      'WORKER_ONBOARDING_SCOPE_INVALID',
    );
  }
  await requireMembership(
    prisma,
    scope,
    requestedByMembershipId,
    ONBOARDING_READ_PERMISSION,
  );
  const filters = [{
    organizationId: scope.organizationId,
    projectId: scope.projectId,
  }];
  if (status === 'EXPIRED') {
    filters.push({
      OR: [
        { status: 'EXPIRED' },
        {
          status: { in: ['PENDING', 'SUBMITTED'] },
          expiresAt: { lte: currentTime },
        },
      ],
    });
  } else if (status === 'PENDING' || status === 'SUBMITTED') {
    filters.push({ status, expiresAt: { gt: currentTime } });
  } else if (status) {
    filters.push({ status });
  }
  if (cursor) {
    filters.push({
      OR: [
        { createdAt: { lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, id: { lt: cursor.id } },
      ],
    });
  }
  const claims = await prisma.workerOnboardingClaim.findMany({
    where: { AND: filters },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    select: {
      id: true,
      organizationId: true,
      projectId: true,
      connectionId: true,
      status: true,
      revision: true,
      senderLastFour: true,
      claimedCuilLastFour: true,
      privacyNoticeVersion: true,
      expiresAt: true,
      submittedAt: true,
      reviewedAt: true,
      rejectionReason: true,
      resolvedPersonId: true,
      resolvedChannelIdentityId: true,
      resolvedWorkerId: true,
      claimedIdentityEncryptedPayload: true,
      claimedIdentityWrappingKeyId: true,
      claimedIdentityRecordVersion: true,
      privacyAcceptedAt: true,
      createdAt: true,
    },
  });
  const hasMore = claims.length > limit;
  const page = hasMore ? claims.slice(0, limit) : claims;
  const items = page.map((claim) => {
    const legalName = claim.claimedIdentityEncryptedPayload
      ? decryptClaimIdentity(claim, cryptoDependencies).legalName
      : null;
    return serializeClaim(claim, { now: currentTime, legalName });
  });
  return {
    items,
    nextCursor: hasMore && page.length > 0 ? encodeListCursor(page.at(-1)) : null,
  };
}

export function workerOnboardingErrorResponse(error) {
  if (!(error instanceof WorkerOnboardingError)) return null;
  return Response.json({ error: error.message, code: error.code }, { status: error.status });
}
