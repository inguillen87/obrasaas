import 'server-only';

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const DATA_SUBJECT_REVIEW_FINGERPRINT_SECRET_ENV =
  'PRIVACY_REVIEW_FINGERPRINT_SECRET';
export const DATA_SUBJECT_REVIEW_FINGERPRINT_KEY_ID_ENV =
  'PRIVACY_REVIEW_FINGERPRINT_KEY_ID';
export const DATA_SUBJECT_REVIEW_MAX_BODY_BYTES = 16 * 1024;
export const DATA_SUBJECT_DECISION_MAX_BODY_BYTES = 512 * 1024;
export const DATA_SUBJECT_REVIEW_LIST_MAX_PAGE_SIZE = 50;
export const DATA_SUBJECT_REVIEW_ITEM_LIMIT = 1_024;
export const DATA_SUBJECT_ACTIVE_HOLD_LIMIT = 256;

const DATA_SUBJECT_REVIEW_ERROR = Symbol.for('obrasaas.data-subject-review-error');
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$/;
const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const REVISION_TOKEN_PATTERN = /^rv1\.[A-Za-z0-9_-]{43}$/;
const REQUESTER_KINDS = new Set(['SELF', 'REPRESENTATIVE']);
const VERIFICATION_EVENT_KINDS = new Set(['VERIFIED', 'REVOKED']);
const ASSURANCE_LEVELS = new Set(['SUBSTANTIAL']);
const DEADLINE_METHODS = new Set(['REVIEWED_EXPLICIT_DATE']);
const HOLD_SCOPE_KINDS = new Set(['ITEM', 'CATEGORY']);
const HOLD_EVENT_KINDS = new Set(['REVIEWED', 'RELEASED']);
const DATA_CATEGORIES = new Set([
  'PERSONAL',
  'LABOR',
  'FINANCIAL',
  'CONVERSATION',
  'MEDIA',
  'AI_DERIVED',
  'AUDIT',
]);
const DATA_SUBJECT_DISPOSITIONS = new Set([
  'REVIEW_REQUIRED',
  'ERASE_CANDIDATE',
  'CRYPTO_ERASE_CANDIDATE',
  'PSEUDONYMIZE_CANDIDATE',
  'KEEP_MINIMAL',
  'EXTERNAL_DELETE_CANDIDATE',
]);
const DECISION_OUTCOMES = new Set(['APPROVE', 'REJECT']);

export const DATA_SUBJECT_REQUEST_TYPES = Object.freeze([
  'ACCESS',
  'CORRECTION',
  'ERASURE',
  'RESTRICTION',
  'PORTABILITY',
  'OBJECTION',
]);

export const DATA_SUBJECT_DECISION_ACTIONS = Object.freeze([
  'DISCLOSE_CANDIDATE',
  'CORRECT_CANDIDATE',
  'RESTRICT_CANDIDATE',
  'PORTABILITY_CANDIDATE',
  'ERASE_CANDIDATE',
  'CRYPTO_ERASE_CANDIDATE',
  'PSEUDONYMIZE_CANDIDATE',
  'KEEP_WITH_BASIS',
  'WITHHOLD_WITH_BASIS',
  'NO_CHANGE_WITH_BASIS',
  'UNRESOLVED',
]);

const COMMON_RECORD_ACTIONS = Object.freeze([
  'KEEP_WITH_BASIS',
  'WITHHOLD_WITH_BASIS',
  'NO_CHANGE_WITH_BASIS',
]);

/**
 * This matrix constrains the vocabulary accepted for human review. It never
 * selects an action, legal basis, retention period or execution plan.
 */
export const DATA_SUBJECT_CANDIDATE_ACTIONS_BY_REQUEST_TYPE = Object.freeze({
  ACCESS: Object.freeze(['DISCLOSE_CANDIDATE', ...COMMON_RECORD_ACTIONS]),
  CORRECTION: Object.freeze([
    'CORRECT_CANDIDATE',
    'RESTRICT_CANDIDATE',
    ...COMMON_RECORD_ACTIONS,
  ]),
  ERASURE: Object.freeze([
    'ERASE_CANDIDATE',
    'CRYPTO_ERASE_CANDIDATE',
    'PSEUDONYMIZE_CANDIDATE',
    'RESTRICT_CANDIDATE',
    ...COMMON_RECORD_ACTIONS,
  ]),
  RESTRICTION: Object.freeze(['RESTRICT_CANDIDATE', ...COMMON_RECORD_ACTIONS]),
  PORTABILITY: Object.freeze([
    'PORTABILITY_CANDIDATE',
    'DISCLOSE_CANDIDATE',
    ...COMMON_RECORD_ACTIONS,
  ]),
  OBJECTION: Object.freeze([
    'RESTRICT_CANDIDATE',
    'PSEUDONYMIZE_CANDIDATE',
    ...COMMON_RECORD_ACTIONS,
  ]),
});

export class DataSubjectReviewError extends Error {
  constructor(
    message,
    code = 'PRIVACY_REVIEW_INVALID',
    status = 400,
    { retryAfterSeconds = null } = {},
  ) {
    super(message);
    this.name = 'DataSubjectReviewError';
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = Number.isSafeInteger(retryAfterSeconds)
      ? retryAfterSeconds
      : null;
    this[DATA_SUBJECT_REVIEW_ERROR] = true;
  }
}

function reviewError(message, code, status, options) {
  return new DataSubjectReviewError(message, code, status, options);
}

function exactObject(value, field = 'body') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw reviewError(
      `${field} debe ser un objeto JSON.`,
      'PRIVACY_REVIEW_BODY_INVALID',
      400,
    );
  }
  return value;
}

function exactFields(value, allowedFields, requiredFields, field = 'body') {
  const unknown = Object.keys(value).find((key) => !allowedFields.has(key));
  const missing = [...requiredFields].find((key) => !Object.hasOwn(value, key));
  if (!unknown && !missing) return;
  throw reviewError(
    unknown
      ? `${field}.${unknown} no está permitido.`
      : `${field}.${missing} es obligatorio.`,
    'PRIVACY_REVIEW_FIELDS_INVALID',
    400,
  );
}

function identifier(value, field, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (typeof value !== 'string' || !IDENTIFIER_PATTERN.test(value)) {
    throw reviewError(
      `${field} no es válido.`,
      'PRIVACY_REVIEW_IDENTIFIER_INVALID',
      400,
    );
  }
  return value;
}

function code(value, field, { nullable = false, maximum = 64 } = {}) {
  if (nullable && value === null) return null;
  if (
    typeof value !== 'string'
    || !CODE_PATTERN.test(value)
    || value.length > maximum
  ) {
    throw reviewError(
      `${field} no es válido.`,
      'PRIVACY_REVIEW_CODE_INVALID',
      400,
    );
  }
  return value;
}

function enumValue(value, field, allowed) {
  if (typeof value !== 'string' || !allowed.has(value)) {
    throw reviewError(
      `${field} no pertenece al vocabulario permitido.`,
      'PRIVACY_REVIEW_ENUM_INVALID',
      400,
    );
  }
  return value;
}

function sha256(value, field) {
  if (typeof value !== 'string' || !HASH_PATTERN.test(value)) {
    throw reviewError(
      `${field} debe ser un compromiso SHA-256 canónico.`,
      'PRIVACY_REVIEW_EVIDENCE_INVALID',
      400,
    );
  }
  return value;
}

function isoTimestamp(value, field, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (
    typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  ) {
    throw reviewError(
      `${field} debe ser una fecha ISO 8601 con zona horaria.`,
      'PRIVACY_REVIEW_TIMESTAMP_INVALID',
      400,
    );
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw reviewError(
      `${field} debe ser una fecha ISO 8601 válida.`,
      'PRIVACY_REVIEW_TIMESTAMP_INVALID',
      400,
    );
  }
  return parsed.toISOString();
}

function integer(value, field, { minimum = 0, maximum = Number.MAX_SAFE_INTEGER } = {}) {
  const normalized = typeof value === 'bigint' ? Number(value) : value;
  if (
    !Number.isSafeInteger(normalized)
    || normalized < minimum
    || normalized > maximum
  ) {
    throw reviewError(
      `${field} debe ser un entero válido.`,
      'PRIVACY_REVIEW_INTEGER_INVALID',
      400,
    );
  }
  return normalized;
}

function nullableIdentifier(value, field) {
  return identifier(value, field, { nullable: true });
}

function revisionTokenValue(value, field) {
  if (typeof value !== 'string' || !REVISION_TOKEN_PATTERN.test(value)) {
    throw reviewError(
      `${field} no es un token de revisión válido.`,
      'PRIVACY_REVIEW_REVISION_TOKEN_INVALID',
      400,
    );
  }
  return value;
}

export function normalizeDataSubjectVerificationInput(value) {
  const body = exactObject(value);
  const eventKind = enumValue(
    body.eventKind,
    'body.eventKind',
    VERIFICATION_EVENT_KINDS,
  );
  if (eventKind === 'REVOKED') {
    exactFields(
      body,
      new Set(['eventKind', 'expectedHeadEventId', 'revocationReasonCode']),
      new Set(['eventKind', 'expectedHeadEventId', 'revocationReasonCode']),
    );
    return {
      eventKind,
      expectedHeadEventId: identifier(
        body.expectedHeadEventId,
        'body.expectedHeadEventId',
      ),
      requesterKind: null,
      assuranceLevel: null,
      verificationMethodCode: null,
      verificationPolicyVersion: null,
      requesterFingerprintHmac: null,
      identityEvidenceSha256: null,
      challengeEvidenceSha256: null,
      subjectIdentityRecordVersion: null,
      representationMethodCode: null,
      representationEvidenceSha256: null,
      validUntil: null,
      representationValidUntil: null,
      revocationReasonCode: code(
        body.revocationReasonCode,
        'body.revocationReasonCode',
      ),
    };
  }

  exactFields(
    body,
    new Set([
      'eventKind',
      'expectedHeadEventId',
      'requesterKind',
      'assuranceLevel',
      'verificationMethodCode',
      'verificationPolicyVersion',
      'requesterEvidenceSha256',
      'challengeEvidenceSha256',
      'validUntil',
      'expectedSubjectIdentityRevision',
      'identityEvidenceSha256',
      'representation',
    ]),
    new Set([
      'eventKind',
      'expectedHeadEventId',
      'requesterKind',
      'assuranceLevel',
      'verificationMethodCode',
      'verificationPolicyVersion',
      'requesterEvidenceSha256',
      'challengeEvidenceSha256',
      'validUntil',
    ]),
  );
  const requesterKind = enumValue(
    body.requesterKind,
    'body.requesterKind',
    REQUESTER_KINDS,
  );
  let representationMethodCode = null;
  let representationEvidenceSha256 = null;
  let representationValidUntil = null;
  let identityEvidenceSha256 = null;
  if (requesterKind === 'SELF') {
    if (
      !Object.hasOwn(body, 'expectedSubjectIdentityRevision')
      || Object.hasOwn(body, 'identityEvidenceSha256')
      || Object.hasOwn(body, 'representation')
    ) {
      throw reviewError(
        'Una verificación SELF requiere la revisión esperada de identidad y no admite evidencia de representación.',
        'PRIVACY_REVIEW_VERIFICATION_FIELDS_INVALID',
        400,
      );
    }
  } else {
    if (
      Object.hasOwn(body, 'expectedSubjectIdentityRevision')
      || !Object.hasOwn(body, 'identityEvidenceSha256')
      || !Object.hasOwn(body, 'representation')
    ) {
      throw reviewError(
        'Una verificación REPRESENTATIVE requiere evidencia de identidad y representación.',
        'PRIVACY_REVIEW_VERIFICATION_FIELDS_INVALID',
        400,
      );
    }
    identityEvidenceSha256 = sha256(
      body.identityEvidenceSha256,
      'body.identityEvidenceSha256',
    );
    const representation = exactObject(body.representation, 'body.representation');
    exactFields(
      representation,
      new Set(['methodCode', 'evidenceSha256', 'validUntil']),
      new Set(['methodCode', 'evidenceSha256', 'validUntil']),
      'body.representation',
    );
    representationMethodCode = code(
      representation.methodCode,
      'body.representation.methodCode',
    );
    representationEvidenceSha256 = sha256(
      representation.evidenceSha256,
      'body.representation.evidenceSha256',
    );
    representationValidUntil = isoTimestamp(
      representation.validUntil,
      'body.representation.validUntil',
    );
  }
  return {
    eventKind,
    expectedHeadEventId: nullableIdentifier(
      body.expectedHeadEventId,
      'body.expectedHeadEventId',
    ),
    requesterKind,
    assuranceLevel: enumValue(
      body.assuranceLevel,
      'body.assuranceLevel',
      ASSURANCE_LEVELS,
    ),
    verificationMethodCode: code(
      body.verificationMethodCode,
      'body.verificationMethodCode',
    ),
    verificationPolicyVersion: code(
      body.verificationPolicyVersion,
      'body.verificationPolicyVersion',
    ),
    requesterEvidenceSha256: sha256(
      body.requesterEvidenceSha256,
      'body.requesterEvidenceSha256',
    ),
    identityEvidenceSha256,
    challengeEvidenceSha256: sha256(
      body.challengeEvidenceSha256,
      'body.challengeEvidenceSha256',
    ),
    subjectIdentityRecordVersion: requesterKind === 'SELF'
      ? integer(
          body.expectedSubjectIdentityRevision,
          'body.expectedSubjectIdentityRevision',
          { minimum: 1 },
        )
      : null,
    representationMethodCode,
    representationEvidenceSha256,
    validUntil: isoTimestamp(body.validUntil, 'body.validUntil'),
    representationValidUntil,
    revocationReasonCode: null,
  };
}

export function normalizeDataSubjectLegalAssessmentInput(value) {
  const body = exactObject(value);
  const fields = new Set([
    'expectedHeadAssessmentId',
    'jurisdictionCode',
    'deadlineMethod',
    'dueAt',
    'deadlinePolicyVersion',
    'deadlinePolicySha256',
    'retentionMatrixVersion',
    'retentionMatrixSha256',
    'legalReviewEvidenceSha256',
  ]);
  exactFields(body, fields, fields);
  return {
    expectedHeadAssessmentId: nullableIdentifier(
      body.expectedHeadAssessmentId,
      'body.expectedHeadAssessmentId',
    ),
    jurisdictionCode: code(
      body.jurisdictionCode,
      'body.jurisdictionCode',
      { maximum: 16 },
    ),
    deadlineMethod: enumValue(
      body.deadlineMethod,
      'body.deadlineMethod',
      DEADLINE_METHODS,
    ),
    dueAt: isoTimestamp(body.dueAt, 'body.dueAt'),
    deadlinePolicyVersion: code(
      body.deadlinePolicyVersion,
      'body.deadlinePolicyVersion',
    ),
    deadlinePolicySha256: sha256(
      body.deadlinePolicySha256,
      'body.deadlinePolicySha256',
    ),
    retentionMatrixVersion: code(
      body.retentionMatrixVersion,
      'body.retentionMatrixVersion',
    ),
    retentionMatrixSha256: sha256(
      body.retentionMatrixSha256,
      'body.retentionMatrixSha256',
    ),
    legalReviewEvidenceSha256: sha256(
      body.legalReviewEvidenceSha256,
      'body.legalReviewEvidenceSha256',
    ),
  };
}

export function normalizeDataSubjectHoldCreateInput(value) {
  const body = exactObject(value);
  const fields = new Set([
    'manifestId',
    'scope',
    'basisCode',
    'policyVersion',
    'evidenceSha256',
    'reviewDueAt',
  ]);
  exactFields(body, fields, fields);
  const scope = exactObject(body.scope, 'body.scope');
  const scopeKind = enumValue(scope.kind, 'body.scope.kind', HOLD_SCOPE_KINDS);
  if (scopeKind === 'ITEM') {
    exactFields(
      scope,
      new Set(['kind', 'reviewItemId']),
      new Set(['kind', 'reviewItemId']),
      'body.scope',
    );
  } else {
    exactFields(
      scope,
      new Set(['kind', 'category']),
      new Set(['kind', 'category']),
      'body.scope',
    );
  }
  return {
    manifestId: identifier(body.manifestId, 'body.manifestId'),
    scopeKind,
    discoveryItemId: scopeKind === 'ITEM'
      ? identifier(scope.reviewItemId, 'body.scope.reviewItemId')
      : null,
    category: scopeKind === 'CATEGORY'
      ? enumValue(scope.category, 'body.scope.category', DATA_CATEGORIES)
      : null,
    basisCode: code(body.basisCode, 'body.basisCode'),
    policyVersion: code(body.policyVersion, 'body.policyVersion'),
    evidenceSha256: sha256(body.evidenceSha256, 'body.evidenceSha256'),
    reviewDueAt: isoTimestamp(body.reviewDueAt, 'body.reviewDueAt'),
  };
}

export function normalizeDataSubjectHoldEventInput(value) {
  const body = exactObject(value);
  const eventKind = enumValue(body.eventKind, 'body.eventKind', HOLD_EVENT_KINDS);
  if (eventKind === 'RELEASED') {
    const fields = new Set([
      'eventKind',
      'expectedHeadEventId',
      'releaseReasonCode',
      'releaseEvidenceSha256',
    ]);
    exactFields(body, fields, fields);
    return {
      expectedHeadEventId: identifier(
        body.expectedHeadEventId,
        'body.expectedHeadEventId',
      ),
      eventKind,
      basisCode: null,
      policyVersion: null,
      evidenceSha256: null,
      reviewDueAt: null,
      releaseReasonCode: code(
        body.releaseReasonCode,
        'body.releaseReasonCode',
      ),
      releaseEvidenceSha256: sha256(
        body.releaseEvidenceSha256,
        'body.releaseEvidenceSha256',
      ),
    };
  }
  const fields = new Set([
    'eventKind',
    'expectedHeadEventId',
    'basisCode',
    'policyVersion',
    'evidenceSha256',
    'reviewDueAt',
  ]);
  exactFields(body, fields, fields);
  return {
    expectedHeadEventId: identifier(
      body.expectedHeadEventId,
      'body.expectedHeadEventId',
    ),
    eventKind,
    basisCode: code(body.basisCode, 'body.basisCode'),
    policyVersion: code(body.policyVersion, 'body.policyVersion'),
    evidenceSha256: sha256(body.evidenceSha256, 'body.evidenceSha256'),
    reviewDueAt: isoTimestamp(body.reviewDueAt, 'body.reviewDueAt'),
    releaseReasonCode: null,
    releaseEvidenceSha256: null,
  };
}

function normalizeDecisionItem(value, index) {
  const item = exactObject(value, `body.items[${index}]`);
  const fields = new Set([
    'reviewItemId',
    'action',
    'legalBasisCode',
    'retentionPolicyVersion',
    'retentionRuleCode',
    'retentionUntil',
  ]);
  exactFields(item, fields, fields, `body.items[${index}]`);
  const action = enumValue(
    item.action,
    `body.items[${index}].action`,
    new Set(DATA_SUBJECT_DECISION_ACTIONS),
  );
  const unresolved = action === 'UNRESOLVED';
  const legalBasisCode = unresolved
    ? code(item.legalBasisCode, `body.items[${index}].legalBasisCode`, { nullable: true })
    : code(item.legalBasisCode, `body.items[${index}].legalBasisCode`);
  const retentionPolicyVersion = unresolved
    ? code(
        item.retentionPolicyVersion,
        `body.items[${index}].retentionPolicyVersion`,
        { nullable: true },
      )
    : code(item.retentionPolicyVersion, `body.items[${index}].retentionPolicyVersion`);
  const retentionRuleCode = unresolved
    ? code(item.retentionRuleCode, `body.items[${index}].retentionRuleCode`, { nullable: true })
    : code(item.retentionRuleCode, `body.items[${index}].retentionRuleCode`);
  if (unresolved && (
    legalBasisCode !== null
    || retentionPolicyVersion !== null
    || retentionRuleCode !== null
    || item.retentionUntil !== null
  )) {
    throw reviewError(
      `body.items[${index}] no cumple el contrato de retención para ${action}.`,
      'PRIVACY_REVIEW_DECISION_RETENTION_INVALID',
      400,
    );
  }
  return {
    reviewItemId: identifier(item.reviewItemId, `body.items[${index}].reviewItemId`),
    action,
    legalBasisCode,
    retentionPolicyVersion,
    retentionRuleCode,
    retentionUntil: item.retentionUntil === null
      ? null
      : isoTimestamp(item.retentionUntil, `body.items[${index}].retentionUntil`),
  };
}

export function normalizeDataSubjectDecisionInput(value) {
  const body = exactObject(value);
  const fields = new Set([
    'manifestId',
    'expectedVerificationEventId',
    'expectedLegalAssessmentId',
    'holdSetRevisionToken',
    'expectedPreviousDecisionId',
    'items',
  ]);
  exactFields(body, fields, fields);
  if (
    !Array.isArray(body.items)
    || body.items.length < 1
    || body.items.length > DATA_SUBJECT_REVIEW_ITEM_LIMIT
  ) {
    throw reviewError(
      `body.items debe contener entre 1 y ${DATA_SUBJECT_REVIEW_ITEM_LIMIT} elementos.`,
      'PRIVACY_REVIEW_DECISION_ITEMS_INVALID',
      400,
    );
  }
  const items = body.items.map(normalizeDecisionItem)
    .sort((left, right) => left.reviewItemId.localeCompare(right.reviewItemId));
  if (new Set(items.map((item) => item.reviewItemId)).size !== items.length) {
    throw reviewError(
      'Cada reviewItemId puede aparecer una sola vez.',
      'PRIVACY_REVIEW_DECISION_ITEM_DUPLICATE',
      400,
    );
  }
  return {
    manifestId: identifier(body.manifestId, 'body.manifestId'),
    expectedVerificationEventId: identifier(
      body.expectedVerificationEventId,
      'body.expectedVerificationEventId',
    ),
    expectedLegalAssessmentId: identifier(
      body.expectedLegalAssessmentId,
      'body.expectedLegalAssessmentId',
    ),
    holdSetRevisionToken: revisionTokenValue(
      body.holdSetRevisionToken,
      'body.holdSetRevisionToken',
    ),
    expectedPreviousDecisionId: nullableIdentifier(
      body.expectedPreviousDecisionId,
      'body.expectedPreviousDecisionId',
    ),
    items,
  };
}

export function normalizeDataSubjectDecisionOutcomeInput(value) {
  const body = exactObject(value);
  const fields = new Set([
    'expectedRevision',
    'decisionRevisionToken',
    'decision',
    'reasonCode',
  ]);
  exactFields(body, fields, fields);
  const decision = enumValue(body.decision, 'body.decision', DECISION_OUTCOMES);
  if (
    (decision === 'APPROVE' && body.reasonCode !== null)
    || (decision === 'REJECT' && body.reasonCode === null)
  ) {
    throw reviewError(
      decision === 'APPROVE'
        ? 'body.reasonCode debe ser null al aprobar.'
        : 'body.reasonCode es obligatorio al rechazar.',
      'PRIVACY_REVIEW_DECISION_REASON_INVALID',
      400,
    );
  }
  return {
    expectedRevision: integer(body.expectedRevision, 'body.expectedRevision', { minimum: 1 }),
    decisionRevisionToken: revisionTokenValue(
      body.decisionRevisionToken,
      'body.decisionRevisionToken',
    ),
    decision,
    reasonCode: decision === 'APPROVE'
      ? null
      : code(body.reasonCode, 'body.reasonCode'),
  };
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function resolveDataSubjectReviewKeyConfig(environment = process.env) {
  const encoded = String(
    environment?.[DATA_SUBJECT_REVIEW_FINGERPRINT_SECRET_ENV] || '',
  ).trim();
  const keyId = String(
    environment?.[DATA_SUBJECT_REVIEW_FINGERPRINT_KEY_ID_ENV] || '',
  ).trim();
  if (!encoded || !BASE64URL_PATTERN.test(encoded)) return validateDataSubjectReviewKeyConfig({
    key: Buffer.alloc(0),
    keyId,
  });
  let key;
  try {
    key = Buffer.from(encoded, 'base64url');
  } catch {
    key = Buffer.alloc(0);
  }
  if (key.toString('base64url') !== encoded) key = Buffer.alloc(0);
  return validateDataSubjectReviewKeyConfig({ key, keyId });
}

export function validateDataSubjectReviewKeyConfig({ key, keyId } = {}) {
  if (
    !Buffer.isBuffer(key)
    || key.byteLength < 32
    || key.byteLength > 64
    || typeof keyId !== 'string'
    || !CODE_PATTERN.test(keyId)
  ) {
    throw reviewError(
      'La verificación criptográfica de revisiones no está configurada.',
      'PRIVACY_REVIEW_UNAVAILABLE',
      503,
    );
  }
  return { key, keyId };
}

export function requireDataSubjectReviewIdempotencyKey(request) {
  const value = String(request?.headers?.get?.('idempotency-key') || '').trim();
  if (!IDEMPOTENCY_KEY_PATTERN.test(value)) {
    throw reviewError(
      'Enviá un encabezado Idempotency-Key válido de entre 8 y 128 caracteres.',
      'PRIVACY_REVIEW_IDEMPOTENCY_KEY_INVALID',
      400,
    );
  }
  return value;
}

export function dataSubjectReviewOperationKeyHash({
  organizationId,
  requestId,
  operationKind,
  idempotencyKey,
}) {
  return createHash('sha256').update(canonicalJson({
    contract: 'obrasaas:data-subject-review-operation:v1',
    organizationId: identifier(organizationId, 'organizationId'),
    requestId: identifier(requestId, 'requestId'),
    operationKind: code(operationKind, 'operationKind'),
    idempotencyKey: requireIdempotencyValue(idempotencyKey),
  })).digest('hex');
}

function requireIdempotencyValue(value) {
  if (typeof value !== 'string' || !IDEMPOTENCY_KEY_PATTERN.test(value)) {
    throw reviewError(
      'Idempotency-Key no es válido.',
      'PRIVACY_REVIEW_IDEMPOTENCY_KEY_INVALID',
      400,
    );
  }
  return value;
}

export function dataSubjectReviewRequestFingerprint({ key, operationKind, payload }) {
  if (!Buffer.isBuffer(key) || key.byteLength < 32 || key.byteLength > 64) {
    throw reviewError(
      'La verificación criptográfica de revisiones no está configurada.',
      'PRIVACY_REVIEW_UNAVAILABLE',
      503,
    );
  }
  return createHmac('sha256', key).update(canonicalJson({
    contract: 'obrasaas:data-subject-review-request:v1',
    operationKind: code(operationKind, 'operationKind'),
    payload,
  })).digest('hex');
}

export function dataSubjectRequesterFingerprintHmac(key, {
  organizationId,
  requestId,
  requesterKind,
  requesterEvidenceSha256,
}) {
  validateDataSubjectReviewKeyConfig({ key, keyId: 'runtime-validation' });
  return createHmac('sha256', key).update(canonicalJson({
    contract: 'obrasaas:data-subject-requester-fingerprint:v1',
    organizationId: identifier(organizationId, 'organizationId'),
    requestId: identifier(requestId, 'requestId'),
    requesterKind: enumValue(requesterKind, 'requesterKind', REQUESTER_KINDS),
    requesterEvidenceSha256: sha256(
      requesterEvidenceSha256,
      'requesterEvidenceSha256',
    ),
  })).digest('hex');
}

function revisionToken(key, purpose, payload) {
  if (!Buffer.isBuffer(key) || key.byteLength < 32 || key.byteLength > 64) {
    throw reviewError(
      'La verificación criptográfica de revisiones no está configurada.',
      'PRIVACY_REVIEW_UNAVAILABLE',
      503,
    );
  }
  return `rv1.${createHmac('sha256', key).update(canonicalJson({
    contract: `obrasaas:data-subject-review-${purpose}:v1`,
    payload,
  })).digest('base64url')}`;
}

export function dataSubjectHoldSetRevisionToken(key, {
  organizationId,
  requestId,
  manifestId,
  holdSetSha256,
}) {
  return revisionToken(key, 'hold-set-revision', {
    organizationId: identifier(organizationId, 'organizationId'),
    requestId: identifier(requestId, 'requestId'),
    manifestId: identifier(manifestId, 'manifestId'),
    holdSetSha256: sha256(holdSetSha256, 'holdSetSha256'),
  });
}

export function dataSubjectDecisionRevisionToken(key, {
  organizationId,
  requestId,
  decisionId,
  revision,
  status,
  decisionSha256,
}) {
  return revisionToken(key, 'decision-revision', {
    organizationId: identifier(organizationId, 'organizationId'),
    requestId: identifier(requestId, 'requestId'),
    decisionId: identifier(decisionId, 'decisionId'),
    revision: integer(revision, 'revision', { minimum: 1 }),
    status: enumValue(
      status,
      'status',
      new Set(['PENDING_APPROVAL', 'SEALED_BLOCKED', 'REJECTED']),
    ),
    decisionSha256: sha256(decisionSha256, 'decisionSha256'),
  });
}

export function dataSubjectReviewRevisionTokenMatches(actual, expected) {
  if (
    typeof actual !== 'string'
    || typeof expected !== 'string'
    || !/^rv1\.[A-Za-z0-9_-]{43}$/.test(actual)
    || !/^rv1\.[A-Za-z0-9_-]{43}$/.test(expected)
  ) return false;
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.byteLength === expectedBytes.byteLength
    && timingSafeEqual(actualBytes, expectedBytes);
}

const VERIFICATION_APPEND_SQL = `
  SELECT * FROM "obrasaas_data_subject_verification_event_append"(
    $1::text, $2::text, $3::text, $4::text, $5::text, $6::text,
    $7::text, $8::text, $9::text, $10::text, $11::text, $12::text,
    $13::text, $14::text, $15::text, $16::integer, $17::text,
    $18::text, $19::timestamptz, $20::timestamptz, $21::text
  )
`;

const LEGAL_ASSESSMENT_APPEND_SQL = `
  SELECT * FROM "obrasaas_data_subject_legal_assessment_append"(
    $1::text, $2::text, $3::text, $4::text, $5::text, $6::text,
    $7::text, $8::text, $9::text, $10::timestamptz, $11::text,
    $12::text, $13::text, $14::text, $15::text
  )
`;

const HOLD_CREATE_SQL = `
  SELECT * FROM "obrasaas_data_subject_hold_create"(
    $1::text, $2::text, $3::text, $4::text, $5::text, $6::text,
    $7::text, $8::text, $9::text, $10::text, $11::text, $12::text,
    $13::text, $14::text, $15::text, $16::timestamptz
  )
`;

const HOLD_EVENT_APPEND_SQL = `
  SELECT * FROM "obrasaas_data_subject_hold_event_append"(
    $1::text, $2::text, $3::text, $4::text, $5::text, $6::text,
    $7::text, $8::text, $9::text, $10::text, $11::text, $12::text,
    $13::text, $14::timestamptz, $15::text, $16::text
  )
`;

const DECISION_CREATE_SQL = `
  SELECT * FROM "obrasaas_data_subject_decision_create"(
    $1::text, $2::text, $3::text, $4::text, $5::text, $6::text,
    $7::text, $8::text, $9::text, $10::text, $11::text, $12::text,
    $13::jsonb
  )
`;

const DECISION_DECIDE_SQL = `
  SELECT * FROM "obrasaas_data_subject_decision_decide"(
    $1::text, $2::text, $3::text, $4::text, $5::text, $6::text,
    $7::text, $8::text, $9::text, $10::text
  )
`;

const HOLD_SET_SHA_SQL = `
  SELECT "obrasaas_data_subject_hold_set_sha256"(
    $1::text, $2::text, $3::text
  ) AS "hold_set_sha256"
`;

const ACTIVE_HOLDS_SQL = `
  SELECT
    h."id" AS "hold_id",
    h."manifestId" AS "manifest_id",
    h."scopeKind"::text AS "scope_kind",
    h."discoveryItemId" AS "discovery_item_id",
    h."category"::text AS "category",
    h."createdAt" AS "created_at",
    e."id" AS "event_id",
    e."sequence" AS "sequence",
    e."kind"::text AS "event_kind",
    e."basisCode" AS "basis_code",
    e."policyVersion" AS "policy_version",
    e."evidenceSha256" AS "evidence_sha256",
    e."reviewDueAt" AS "review_due_at",
    e."occurredAt" AS "occurred_at"
  FROM "DataSubjectLegalHold" h
  JOIN LATERAL (
    SELECT he.*
    FROM "DataSubjectLegalHoldEvent" he
    WHERE he."organizationId" = h."organizationId"
      AND he."requestId" = h."requestId"
      AND he."holdId" = h."id"
    ORDER BY he."sequence" DESC, he."id" DESC
    LIMIT 1
  ) e ON TRUE
  WHERE h."organizationId" = $1::text
    AND h."requestId" = $2::text
    AND e."kind" <> 'RELEASED'::"DataSubjectHoldEventKind"
  ORDER BY h."createdAt" ASC, h."id" ASC
  LIMIT 257
`;

const MANIFEST_COUNTS_SQL = `
  SELECT
    COUNT(*)::integer AS "item_count",
    COUNT(*) FILTER (
      WHERE "blockerCode" IS NOT NULL
         OR "disposition" = 'REVIEW_REQUIRED'::"DataSubjectDisposition"
    )::integer AS "blocker_count",
    COUNT(*) FILTER (
      WHERE "kind" = 'COVERAGE_BLOCKER'::"DataSubjectDiscoveryItemKind"
    )::integer AS "coverage_blocker_count"
  FROM "DataSubjectDiscoveryItem"
  WHERE "organizationId" = $1::text
    AND "requestId" = $2::text
    AND "manifestId" = $3::text
`;

function databaseErrorCode(error) {
  const candidates = [
    error?.sqlState,
    error?.sqlstate,
    error?.cause?.code,
    error?.cause?.originalCode,
    error?.meta?.driverAdapterError?.cause?.code,
    error?.meta?.driverAdapterError?.cause?.originalCode,
    error?.meta?.code,
    error?.code,
  ];
  const recognized = new Set([
    'P0500',
    'P0503',
    'P0504',
    'P0509',
    '40001',
    '40P01',
    '55P03',
  ]);
  return candidates.find((value) => recognized.has(value)) || null;
}

function safeDatabaseError(error) {
  const databaseCode = databaseErrorCode(error);
  if (['40001', '40P01', '55P03'].includes(databaseCode)) {
    return reviewError(
      'La revisión tuvo una concurrencia transitoria. Reintentá la operación completa con la misma clave.',
      'PRIVACY_REVIEW_RETRY_REQUIRED',
      503,
      { retryAfterSeconds: 3 },
    );
  }
  if (databaseCode === 'P0500') {
    return reviewError(
      'La operación de revisión no cumple el contrato vigente.',
      'PRIVACY_REVIEW_INVALID',
      400,
    );
  }
  if (databaseCode === 'P0503') {
    return reviewError(
      'La operación requiere una membresía administradora activa en el tenant.',
      'PRIVACY_REVIEW_FORBIDDEN',
      403,
    );
  }
  if (databaseCode === 'P0504') {
    return reviewError(
      'No se encontró la revisión de privacidad solicitada.',
      'PRIVACY_REVIEW_NOT_FOUND',
      404,
    );
  }
  if (databaseCode === 'P0509') {
    return reviewError(
      'La revisión cambió o entra en conflicto con su estado actual. Actualizá el caso antes de continuar.',
      'PRIVACY_REVIEW_CONFLICT',
      409,
    );
  }
  return reviewError(
    'No se pudo completar la operación de revisión de privacidad.',
    'PRIVACY_REVIEW_FAILED',
    500,
  );
}

function requireSqlDatabase(prisma) {
  if (!prisma || typeof prisma.$queryRawUnsafe !== 'function') {
    throw reviewError(
      'El control durable de revisiones de privacidad no está disponible.',
      'PRIVACY_REVIEW_UNAVAILABLE',
      503,
    );
  }
  return prisma;
}

/**
 * Each mutating method executes exactly one fixed PostgreSQL function call in
 * the caller's ordinary READ COMMITTED context. The functions own locking and
 * CAS; this adapter deliberately does not retry or wrap them in another
 * transaction/isolation level.
 */
export function createDataSubjectReviewSqlAdapter(prisma) {
  const database = requireSqlDatabase(prisma);
  return Object.freeze({
    appendVerification(command) {
      return database.$queryRawUnsafe(
        VERIFICATION_APPEND_SQL,
        command.organizationId,
        command.requestId,
        command.actorMembershipId,
        command.operationKeyHash,
        command.requestFingerprint,
        command.fingerprintKeyId,
        command.eventKind,
        command.expectedHeadEventId,
        command.requesterKind,
        command.assuranceLevel,
        command.verificationMethodCode,
        command.verificationPolicyVersion,
        command.requesterFingerprintHmac,
        command.identityEvidenceSha256,
        command.challengeEvidenceSha256,
        command.subjectIdentityRecordVersion,
        command.representationMethodCode,
        command.representationEvidenceSha256,
        command.validUntil,
        command.representationValidUntil,
        command.revocationReasonCode,
      );
    },
    appendLegalAssessment(command) {
      return database.$queryRawUnsafe(
        LEGAL_ASSESSMENT_APPEND_SQL,
        command.organizationId,
        command.requestId,
        command.actorMembershipId,
        command.operationKeyHash,
        command.requestFingerprint,
        command.fingerprintKeyId,
        command.expectedHeadAssessmentId,
        command.jurisdictionCode,
        command.deadlineMethod,
        command.dueAt,
        command.deadlinePolicyVersion,
        command.deadlinePolicySha256,
        command.retentionMatrixVersion,
        command.retentionMatrixSha256,
        command.legalReviewEvidenceSha256,
      );
    },
    createHold(command) {
      return database.$queryRawUnsafe(
        HOLD_CREATE_SQL,
        command.organizationId,
        command.requestId,
        command.manifestId,
        command.expectedManifestSha256,
        command.actorMembershipId,
        command.operationKeyHash,
        command.requestFingerprint,
        command.fingerprintKeyId,
        command.scopeKind,
        command.discoveryItemId,
        command.category,
        command.basisCode,
        command.policyVersion,
        command.evidenceSha256,
        command.actorMembershipId,
        command.reviewDueAt,
      );
    },
    appendHoldEvent(command) {
      return database.$queryRawUnsafe(
        HOLD_EVENT_APPEND_SQL,
        command.organizationId,
        command.requestId,
        command.holdId,
        command.actorMembershipId,
        command.operationKeyHash,
        command.requestFingerprint,
        command.fingerprintKeyId,
        command.expectedHeadEventId,
        command.eventKind,
        command.basisCode,
        command.policyVersion,
        command.evidenceSha256,
        command.eventKind === 'REVIEWED' ? command.actorMembershipId : null,
        command.reviewDueAt,
        command.releaseReasonCode,
        command.releaseEvidenceSha256,
      );
    },
    createDecision(command) {
      return database.$queryRawUnsafe(
        DECISION_CREATE_SQL,
        command.organizationId,
        command.requestId,
        command.manifestId,
        command.expectedManifestSha256,
        command.actorMembershipId,
        command.operationKeyHash,
        command.requestFingerprint,
        command.fingerprintKeyId,
        command.expectedVerificationEventId,
        command.expectedLegalAssessmentId,
        command.expectedHoldSetSha256,
        command.expectedPreviousDecisionId,
        JSON.stringify(command.items),
      );
    },
    decide(command) {
      return database.$queryRawUnsafe(
        DECISION_DECIDE_SQL,
        command.organizationId,
        command.requestId,
        command.decisionId,
        command.actorMembershipId,
        command.operationKeyHash,
        command.requestFingerprint,
        command.fingerprintKeyId,
        command.expectedDecisionSha256,
        command.decision,
        command.reasonCode,
      );
    },
    holdSetSha256({ organizationId, requestId, manifestId }) {
      return database.$queryRawUnsafe(
        HOLD_SET_SHA_SQL,
        organizationId,
        requestId,
        manifestId,
      );
    },
    activeHolds({ organizationId, requestId }) {
      return database.$queryRawUnsafe(
        ACTIVE_HOLDS_SQL,
        organizationId,
        requestId,
      );
    },
    manifestCounts({ organizationId, requestId, manifestId }) {
      return database.$queryRawUnsafe(
        MANIFEST_COUNTS_SQL,
        organizationId,
        requestId,
        manifestId,
      );
    },
  });
}

function contractError() {
  return reviewError(
    'La persistencia devolvió un estado de revisión no reconocido.',
    'PRIVACY_REVIEW_CONTRACT_INVALID',
    500,
  );
}

function storedIdentifier(value) {
  if (typeof value !== 'string' || !IDENTIFIER_PATTERN.test(value)) throw contractError();
  return value;
}

function storedInteger(value, { minimum = 0 } = {}) {
  const normalized = typeof value === 'bigint' ? Number(value) : value;
  if (!Number.isSafeInteger(normalized) || normalized < minimum) throw contractError();
  return normalized;
}

function storedTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw contractError();
  return date.toISOString();
}

function singleResultRow(rows, fields) {
  if (!Array.isArray(rows) || rows.length !== 1) throw contractError();
  const row = rows[0];
  if (
    !row
    || typeof row !== 'object'
    || Array.isArray(row)
    || Object.keys(row).length !== fields.size
    || Object.keys(row).some((key) => !fields.has(key))
    || [...fields].some((key) => !Object.hasOwn(row, key))
  ) throw contractError();
  return row;
}

function normalizeReviewScope(scope) {
  return {
    organizationId: identifier(scope?.organizationId, 'organizationId'),
    actorMembershipId: identifier(scope?.actorMembershipId, 'actorMembershipId'),
  };
}

function mutationCommand({
  scope,
  requestId,
  idempotencyKey,
  key,
  keyId,
  operationKind,
  input,
}) {
  const normalizedScope = normalizeReviewScope(scope);
  const normalizedRequestId = identifier(requestId, 'requestId');
  validateDataSubjectReviewKeyConfig({ key, keyId });
  return {
    ...normalizedScope,
    requestId: normalizedRequestId,
    operationKeyHash: dataSubjectReviewOperationKeyHash({
      organizationId: normalizedScope.organizationId,
      requestId: normalizedRequestId,
      operationKind,
      idempotencyKey: requireIdempotencyValue(idempotencyKey),
    }),
    requestFingerprint: dataSubjectReviewRequestFingerprint({
      key,
      operationKind,
      payload: {
        organizationId: normalizedScope.organizationId,
        requestId: normalizedRequestId,
        actorMembershipId: normalizedScope.actorMembershipId,
        input,
      },
    }),
    fingerprintKeyId: keyId,
    ...input,
  };
}

function notFound() {
  return reviewError(
    'No se encontró la revisión de privacidad solicitada.',
    'PRIVACY_REVIEW_NOT_FOUND',
    404,
  );
}

function forbidden() {
  return reviewError(
    'La operación requiere una membresía administradora activa en el tenant.',
    'PRIVACY_REVIEW_FORBIDDEN',
    403,
  );
}

export function createDataSubjectReviewReadAdapter(prisma) {
  if (
    !prisma
    || typeof prisma?.tenantMembership?.findFirst !== 'function'
    || typeof prisma?.dataSubjectDiscoveryManifest?.findFirst !== 'function'
    || typeof prisma?.dataSubjectRequest?.findFirst !== 'function'
  ) {
    throw reviewError(
      'La lectura durable de revisiones de privacidad no está disponible.',
      'PRIVACY_REVIEW_UNAVAILABLE',
      503,
    );
  }
  return Object.freeze({
    async requireAdmin({ organizationId, actorMembershipId }) {
      const actor = await prisma.tenantMembership.findFirst({
        where: {
          id: actorMembershipId,
          organizationId,
          tenantRole: 'ADMIN',
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      if (!actor) throw forbidden();
      return actor;
    },
    async manifest({ organizationId, requestId, manifestId, includeItems = false }) {
      const manifest = await prisma.dataSubjectDiscoveryManifest.findFirst({
        where: { id: manifestId, organizationId, requestId },
        select: {
          id: true,
          organizationId: true,
          requestId: true,
          outcome: true,
          itemCount: true,
          blockerCount: true,
          manifestSha256: true,
          ...(includeItems ? {
            items: {
              select: { id: true, kind: true },
              orderBy: { ordinal: 'asc' },
              take: DATA_SUBJECT_REVIEW_ITEM_LIMIT + 1,
            },
          } : {}),
        },
      });
      if (!manifest) throw notFound();
      return manifest;
    },
    async request({ organizationId, requestId }) {
      const request = await prisma.dataSubjectRequest.findFirst({
        where: { id: requestId, organizationId },
        select: {
          id: true,
          organizationId: true,
          type: true,
          status: true,
        },
      });
      if (!request) throw notFound();
      return request;
    },
    async verifiedWorkerIdentity({ organizationId, requestId, expectedRevision }) {
      const request = await prisma.dataSubjectRequest.findFirst({
        where: { id: requestId, organizationId, subjectKind: 'WORKER_PERSON' },
        select: {
          id: true,
          workerPerson: {
            select: {
              identityStatus: true,
              recordVersion: true,
              identityDecisionEvidenceHash: true,
            },
          },
        },
      });
      if (!request) throw notFound();
      const identity = request.workerPerson;
      if (
        identity?.identityStatus !== 'VERIFIED'
        || identity.recordVersion !== expectedRevision
        || !HASH_PATTERN.test(identity.identityDecisionEvidenceHash)
      ) {
        throw reviewError(
          'La identidad canónica cambió o no está verificada. Actualizá el caso antes de continuar.',
          'PRIVACY_REVIEW_SUBJECT_IDENTITY_STALE',
          409,
        );
      }
      return identity;
    },
    async verificationOperation({ organizationId, requestId, operationKeyHash }) {
      if (typeof prisma?.dataSubjectRequesterVerificationEvent?.findFirst !== 'function') {
        throw reviewError(
          'La lectura durable de verificaciones de privacidad no está disponible.',
          'PRIVACY_REVIEW_UNAVAILABLE',
          503,
        );
      }
      return prisma.dataSubjectRequesterVerificationEvent.findFirst({
        where: { organizationId, requestId, operationKeyHash },
        select: { id: true },
      });
    },
    async decision({ organizationId, requestId, decisionId }) {
      if (typeof prisma?.dataSubjectDecisionSet?.findFirst !== 'function') {
        throw reviewError(
          'La lectura durable de decisiones de privacidad no está disponible.',
          'PRIVACY_REVIEW_UNAVAILABLE',
          503,
        );
      }
      const decision = await prisma.dataSubjectDecisionSet.findFirst({
        where: { id: decisionId, organizationId, requestId },
        select: {
          id: true,
          organizationId: true,
          requestId: true,
          revision: true,
          status: true,
          decisionSha256: true,
        },
      });
      if (!decision) throw notFound();
      return decision;
    },
    async decisionCreationOperation({ organizationId, requestId, operationKeyHash }) {
      if (typeof prisma?.dataSubjectDecisionSet?.findFirst !== 'function') {
        throw reviewError(
          'La lectura durable de decisiones de privacidad no está disponible.',
          'PRIVACY_REVIEW_UNAVAILABLE',
          503,
        );
      }
      return prisma.dataSubjectDecisionSet.findFirst({
        where: { organizationId, requestId, operationKeyHash },
        select: { manifestSha256: true, holdSetSha256: true },
      });
    },
    async decisionOutcomeOperation({ organizationId, requestId, operationKeyHash }) {
      if (typeof prisma?.dataSubjectDecisionSet?.findFirst !== 'function') {
        throw reviewError(
          'La lectura durable de decisiones de privacidad no está disponible.',
          'PRIVACY_REVIEW_UNAVAILABLE',
          503,
        );
      }
      return prisma.dataSubjectDecisionSet.findFirst({
        where: { organizationId, requestId, decisionOperationKeyHash: operationKeyHash },
        select: { decisionSha256: true },
      });
    },
    async list({ organizationId, cursor, limit }) {
      if (typeof prisma?.dataSubjectRequest?.findMany !== 'function') {
        throw reviewError(
          'La lectura durable de revisiones de privacidad no está disponible.',
          'PRIVACY_REVIEW_UNAVAILABLE',
          503,
        );
      }
      return prisma.dataSubjectRequest.findMany({
        where: {
          organizationId,
          status: { in: ['DISCOVERED', 'DISCOVERY_BLOCKED'] },
          manifest: { isNot: null },
          ...(cursor ? {
            OR: [
              { receivedAt: { lt: cursor.receivedAt } },
              { receivedAt: cursor.receivedAt, id: { lt: cursor.id } },
            ],
          } : {}),
        },
        orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        select: {
          id: true,
          organizationId: true,
          type: true,
          subjectKind: true,
          status: true,
          receivedAt: true,
          terminalAt: true,
          terminalReasonCode: true,
          workerPerson: { select: { recordVersion: true, identityStatus: true } },
          manifest: {
            select: {
              id: true,
              organizationId: true,
              requestId: true,
              outcome: true,
              itemCount: true,
              blockerCount: true,
              manifestSha256: true,
              sealedAt: true,
            },
          },
          requesterVerificationEvents: {
            orderBy: [{ sequence: 'desc' }, { id: 'desc' }],
            take: 2,
            select: {
              id: true,
              sequence: true,
              predecessorEventId: true,
              kind: true,
              requesterKind: true,
              assuranceLevel: true,
              validUntil: true,
              representationValidUntil: true,
              subjectIdentityRecordVersion: true,
              occurredAt: true,
            },
          },
          legalAssessmentRevisions: {
            orderBy: [{ sequence: 'desc' }, { id: 'desc' }],
            take: 2,
            select: {
              id: true,
              manifestId: true,
              sequence: true,
              predecessorAssessmentId: true,
              jurisdictionCode: true,
              dueAt: true,
              assessedAt: true,
            },
          },
          decisionSets: {
            orderBy: [{ revision: 'desc' }, { id: 'desc' }],
            take: 2,
            select: {
              id: true,
              manifestId: true,
              revision: true,
              predecessorDecisionId: true,
              status: true,
              verificationEventId: true,
              legalAssessmentId: true,
              itemCount: true,
              unresolvedCount: true,
              activeHoldCount: true,
              manifestSha256: true,
              holdSetSha256: true,
              preparedAt: true,
              pendingAt: true,
              decidedAt: true,
            },
          },
        },
      });
    },
    async review({ organizationId, requestId }) {
      return prisma.dataSubjectRequest.findFirst({
        where: { id: requestId, organizationId },
        select: {
          id: true,
          organizationId: true,
          type: true,
          subjectKind: true,
          status: true,
          receivedAt: true,
          terminalAt: true,
          terminalReasonCode: true,
          workerPerson: {
            select: { recordVersion: true, identityStatus: true },
          },
          manifest: {
            select: {
              id: true,
              organizationId: true,
              requestId: true,
              outcome: true,
              itemCount: true,
              blockerCount: true,
              manifestSha256: true,
              sealedAt: true,
              items: {
                orderBy: { ordinal: 'asc' },
                take: DATA_SUBJECT_REVIEW_ITEM_LIMIT + 1,
                select: {
                  id: true,
                  ordinal: true,
                  kind: true,
                  category: true,
                  resourceType: true,
                  disposition: true,
                  blockerCode: true,
                },
              },
            },
          },
          requesterVerificationEvents: {
            orderBy: [{ sequence: 'desc' }, { id: 'desc' }],
            take: 2,
            select: {
              id: true,
              sequence: true,
              predecessorEventId: true,
              kind: true,
              requesterKind: true,
              assuranceLevel: true,
              verificationMethodCode: true,
              verificationPolicyVersion: true,
              requesterFingerprintHmac: true,
              identityEvidenceSha256: true,
              challengeEvidenceSha256: true,
              subjectIdentityRecordVersion: true,
              representationMethodCode: true,
              representationEvidenceSha256: true,
              validUntil: true,
              representationValidUntil: true,
              revocationReasonCode: true,
              occurredAt: true,
            },
          },
          legalAssessmentRevisions: {
            orderBy: [{ sequence: 'desc' }, { id: 'desc' }],
            take: 2,
            select: {
              id: true,
              manifestId: true,
              sequence: true,
              predecessorAssessmentId: true,
              jurisdictionCode: true,
              deadlineMethod: true,
              dueAt: true,
              deadlinePolicyVersion: true,
              deadlinePolicySha256: true,
              retentionMatrixVersion: true,
              retentionMatrixSha256: true,
              legalReviewEvidenceSha256: true,
              assessedAt: true,
            },
          },
          decisionSets: {
            orderBy: [{ revision: 'desc' }, { id: 'desc' }],
            take: 2,
            select: {
              id: true,
              manifestId: true,
              revision: true,
              predecessorDecisionId: true,
              status: true,
              verificationEventId: true,
              legalAssessmentId: true,
              manifestSha256: true,
              holdSetSha256: true,
              itemCount: true,
              unresolvedCount: true,
              activeHoldCount: true,
              decisionSha256: true,
              preparedByMembershipId: true,
              decidedByMembershipId: true,
              preparedAt: true,
              pendingAt: true,
              decidedAt: true,
              items: {
                orderBy: { ordinal: 'asc' },
                take: DATA_SUBJECT_REVIEW_ITEM_LIMIT + 1,
                select: {
                  discoveryItemId: true,
                  ordinal: true,
                  action: true,
                  legalBasisCode: true,
                  retentionPolicyVersion: true,
                  retentionRuleCode: true,
                  retentionUntil: true,
                },
              },
            },
          },
        },
      });
    },
  });
}

export function createDataSubjectReviewSnapshotAdapter(prisma) {
  if (!prisma || typeof prisma.$transaction !== 'function') {
    throw reviewError(
      'La lectura consistente de revisiones de privacidad no está disponible.',
      'PRIVACY_REVIEW_UNAVAILABLE',
      503,
    );
  }
  return Object.freeze({
    read(operation) {
      return prisma.$transaction(async (transaction) => {
        if (typeof transaction?.$executeRawUnsafe !== 'function') {
          throw reviewError(
            'La lectura consistente de revisiones de privacidad no está disponible.',
            'PRIVACY_REVIEW_UNAVAILABLE',
            503,
          );
        }
        await transaction.$executeRawUnsafe('SET TRANSACTION READ ONLY');
        return operation({
          readAdapter: createDataSubjectReviewReadAdapter(transaction),
          sqlAdapter: createDataSubjectReviewSqlAdapter(transaction),
        });
      }, {
        isolationLevel: 'RepeatableRead',
        maxWait: 5_000,
        timeout: 20_000,
      });
    },
  });
}

function verificationResult(rows) {
  const row = singleResultRow(rows, new Set([
    'event_id',
    'sequence',
    'event_kind',
    'replayed',
    'occurred_at',
  ]));
  if (
    !VERIFICATION_EVENT_KINDS.has(row.event_kind)
    || typeof row.replayed !== 'boolean'
  ) throw contractError();
  return {
    verification: {
      id: storedIdentifier(row.event_id),
      sequence: storedInteger(row.sequence, { minimum: 1 }),
      eventKind: row.event_kind,
      occurredAt: storedTimestamp(row.occurred_at),
      evidenceCommitted: row.event_kind === 'VERIFIED',
    },
    replayed: row.replayed,
    executionAllowed: false,
  };
}

function assessmentResult(rows, input) {
  const row = singleResultRow(rows, new Set([
    'assessment_id',
    'sequence',
    'replayed',
    'due_at',
    'assessed_at',
  ]));
  if (typeof row.replayed !== 'boolean') throw contractError();
  const dueAt = storedTimestamp(row.due_at);
  if (dueAt !== input.dueAt) throw contractError();
  return {
    legalAssessment: {
      id: storedIdentifier(row.assessment_id),
      sequence: storedInteger(row.sequence, { minimum: 1 }),
      jurisdictionCode: input.jurisdictionCode,
      deadlineMethod: input.deadlineMethod,
      dueAt,
      policyVersion: input.deadlinePolicyVersion,
      retentionMatrixVersion: input.retentionMatrixVersion,
      assessedAt: storedTimestamp(row.assessed_at),
      evidenceCommitted: true,
    },
    replayed: row.replayed,
    executionAllowed: false,
  };
}

function holdResult(rows) {
  const row = singleResultRow(rows, new Set([
    'hold_id',
    'event_id',
    'sequence',
    'event_kind',
    'replayed',
    'occurred_at',
  ]));
  if (
    !new Set(['CREATED', 'REVIEWED', 'RELEASED']).has(row.event_kind)
    || typeof row.replayed !== 'boolean'
  ) throw contractError();
  return {
    hold: {
      id: storedIdentifier(row.hold_id),
      headEvent: {
        id: storedIdentifier(row.event_id),
        sequence: storedInteger(row.sequence, { minimum: 1 }),
        eventKind: row.event_kind,
        occurredAt: storedTimestamp(row.occurred_at),
        evidenceCommitted: true,
      },
    },
    replayed: row.replayed,
    executionAllowed: false,
  };
}

function decisionResult(rows, key, { decided = false } = {}) {
  const dateField = decided ? 'decided_at' : 'prepared_at';
  const row = singleResultRow(rows, new Set([
    'decision_id',
    'revision',
    'status',
    'decision_sha256',
    'hold_set_sha256',
    'replayed',
    dateField,
  ]));
  if (
    !new Set(['PENDING_APPROVAL', 'SEALED_BLOCKED', 'REJECTED']).has(row.status)
    || !HASH_PATTERN.test(row.decision_sha256)
    || !HASH_PATTERN.test(row.hold_set_sha256)
    || typeof row.replayed !== 'boolean'
  ) throw contractError();
  const revision = storedInteger(row.revision, { minimum: 1 });
  const decision = {
    id: storedIdentifier(row.decision_id),
    revision,
    status: row.status,
    evidenceCommitted: true,
    executionAllowed: false,
    [decided ? 'decidedAt' : 'preparedAt']: storedTimestamp(row[dateField]),
  };
  return {
    decision: {
      ...decision,
      decisionRevisionToken: dataSubjectDecisionRevisionToken(key, {
        organizationId: rows.__organizationId,
        requestId: rows.__requestId,
        decisionId: decision.id,
        revision,
        status: row.status,
        decisionSha256: row.decision_sha256,
      }),
    },
    replayed: row.replayed,
    executionAllowed: false,
  };
}

function withResultScope(rows, command) {
  Object.defineProperties(rows, {
    __organizationId: { value: command.organizationId },
    __requestId: { value: command.requestId },
  });
  return rows;
}

async function executeMutation(operation) {
  try {
    return await operation();
  } catch (error) {
    if (
      error instanceof DataSubjectReviewError
      || error?.[DATA_SUBJECT_REVIEW_ERROR] === true
    ) throw error;
    throw safeDatabaseError(error);
  }
}

export async function appendDataSubjectRequesterVerificationEvent(prisma, {
  scope,
  requestId,
  idempotencyKey,
  input: rawInput,
  fingerprintKey,
  fingerprintKeyId,
}, { sqlAdapter = null, readAdapter = null } = {}) {
  const input = normalizeDataSubjectVerificationInput(rawInput);
  const command = mutationCommand({
    scope,
    requestId,
    idempotencyKey,
    key: fingerprintKey,
    keyId: fingerprintKeyId,
    operationKind: 'REQUESTER_VERIFICATION_EVENT',
    input,
  });
  command.requesterFingerprintHmac = command.eventKind === 'VERIFIED'
    ? dataSubjectRequesterFingerprintHmac(fingerprintKey, {
        organizationId: command.organizationId,
        requestId: command.requestId,
        requesterKind: command.requesterKind,
        requesterEvidenceSha256: command.requesterEvidenceSha256,
      })
    : null;
  delete command.requesterEvidenceSha256;
  const reader = readAdapter || createDataSubjectReviewReadAdapter(prisma);
  await reader.requireAdmin(command);
  const replay = await reader.verificationOperation(command);
  if (
    !replay
    && command.eventKind === 'VERIFIED'
    && command.requesterKind === 'SELF'
  ) {
    const identity = await reader.verifiedWorkerIdentity({
      ...command,
      expectedRevision: command.subjectIdentityRecordVersion,
    });
    command.identityEvidenceSha256 = identity.identityDecisionEvidenceHash;
  }
  const adapter = sqlAdapter || createDataSubjectReviewSqlAdapter(prisma);
  return executeMutation(async () => verificationResult(
    await adapter.appendVerification(command),
  ));
}

export async function appendDataSubjectLegalAssessment(prisma, {
  scope,
  requestId,
  idempotencyKey,
  input: rawInput,
  fingerprintKey,
  fingerprintKeyId,
}, { sqlAdapter = null } = {}) {
  const input = normalizeDataSubjectLegalAssessmentInput(rawInput);
  const command = mutationCommand({
    scope,
    requestId,
    idempotencyKey,
    key: fingerprintKey,
    keyId: fingerprintKeyId,
    operationKind: 'LEGAL_ASSESSMENT_REVISION',
    input,
  });
  const adapter = sqlAdapter || createDataSubjectReviewSqlAdapter(prisma);
  return executeMutation(async () => assessmentResult(
    await adapter.appendLegalAssessment(command),
    input,
  ));
}

async function requireAdminAndManifest(readAdapter, command, manifestId, includeItems = false) {
  await readAdapter.requireAdmin(command);
  const manifest = await readAdapter.manifest({
    ...command,
    manifestId,
    includeItems,
  });
  if (!HASH_PATTERN.test(manifest.manifestSha256)) throw contractError();
  return manifest;
}

export async function createDataSubjectLegalHold(prisma, {
  scope,
  requestId,
  idempotencyKey,
  input: rawInput,
  fingerprintKey,
  fingerprintKeyId,
}, { sqlAdapter = null, readAdapter = null } = {}) {
  const input = normalizeDataSubjectHoldCreateInput(rawInput);
  const command = mutationCommand({
    scope,
    requestId,
    idempotencyKey,
    key: fingerprintKey,
    keyId: fingerprintKeyId,
    operationKind: 'LEGAL_HOLD_CREATE',
    input,
  });
  const reader = readAdapter || createDataSubjectReviewReadAdapter(prisma);
  const manifest = await requireAdminAndManifest(reader, command, command.manifestId);
  command.expectedManifestSha256 = manifest.manifestSha256;
  const adapter = sqlAdapter || createDataSubjectReviewSqlAdapter(prisma);
  return executeMutation(async () => holdResult(await adapter.createHold(command)));
}

export async function appendDataSubjectLegalHoldEvent(prisma, {
  scope,
  requestId,
  holdId,
  idempotencyKey,
  input: rawInput,
  fingerprintKey,
  fingerprintKeyId,
}, { sqlAdapter = null } = {}) {
  const input = normalizeDataSubjectHoldEventInput(rawInput);
  const command = mutationCommand({
    scope,
    requestId,
    idempotencyKey,
    key: fingerprintKey,
    keyId: fingerprintKeyId,
    operationKind: 'LEGAL_HOLD_EVENT',
    input: {
      holdId: identifier(holdId, 'holdId'),
      ...input,
    },
  });
  const adapter = sqlAdapter || createDataSubjectReviewSqlAdapter(prisma);
  return executeMutation(async () => holdResult(
    await adapter.appendHoldEvent(command),
  ));
}

function assertDecisionCoverage(request, manifest, items) {
  if (
    !DATA_SUBJECT_REQUEST_TYPES.includes(request.type)
    || !['DISCOVERED', 'DISCOVERY_BLOCKED'].includes(request.status)
    || !Number.isSafeInteger(manifest.itemCount)
    || manifest.itemCount < 1
    || manifest.itemCount > DATA_SUBJECT_REVIEW_ITEM_LIMIT
    || !Array.isArray(manifest.items)
    || manifest.items.length !== manifest.itemCount
    || items.length !== manifest.itemCount
  ) {
    throw reviewError(
      'El manifiesto no está completo para preparar una decisión.',
      'PRIVACY_REVIEW_MANIFEST_INCONSISTENT',
      409,
    );
  }
  const supplied = new Map(items.map((item) => [item.reviewItemId, item]));
  const allowedRecordActions = new Set(
    DATA_SUBJECT_CANDIDATE_ACTIONS_BY_REQUEST_TYPE[request.type],
  );
  for (const manifestItem of manifest.items) {
    const decisionItem = supplied.get(manifestItem.id);
    if (!decisionItem) {
      throw reviewError(
        'La decisión debe cubrir exactamente todos los ítems del manifiesto.',
        'PRIVACY_REVIEW_DECISION_COVERAGE_INVALID',
        400,
      );
    }
    if (
      (manifestItem.kind === 'COVERAGE_BLOCKER' && decisionItem.action !== 'UNRESOLVED')
      || (manifestItem.kind === 'RECORD' && !allowedRecordActions.has(decisionItem.action))
      || !new Set(['RECORD', 'COVERAGE_BLOCKER']).has(manifestItem.kind)
    ) {
      throw reviewError(
        'Una acción propuesta no corresponde al tipo de solicitud o ítem.',
        'PRIVACY_REVIEW_DECISION_ACTION_INVALID',
        400,
      );
    }
    supplied.delete(manifestItem.id);
  }
  if (supplied.size !== 0) {
    throw reviewError(
      'La decisión contiene ítems que no pertenecen al manifiesto.',
      'PRIVACY_REVIEW_DECISION_COVERAGE_INVALID',
      400,
    );
  }
}

async function currentHoldSetSha256(sqlAdapter, command) {
  const rows = await sqlAdapter.holdSetSha256(command);
  const row = singleResultRow(rows, new Set(['hold_set_sha256']));
  if (!HASH_PATTERN.test(row.hold_set_sha256)) throw contractError();
  return row.hold_set_sha256;
}

async function currentManifestCounts(sqlAdapter, command) {
  const rows = await sqlAdapter.manifestCounts(command);
  const row = singleResultRow(
    rows,
    new Set(['item_count', 'blocker_count', 'coverage_blocker_count']),
  );
  const itemCount = storedInteger(row.item_count);
  const blockerCount = storedInteger(row.blocker_count);
  const coverageBlockerCount = storedInteger(row.coverage_blocker_count);
  if (
    coverageBlockerCount > blockerCount
    || blockerCount > itemCount
    || itemCount > DATA_SUBJECT_REVIEW_ITEM_LIMIT
  ) throw contractError();
  return { itemCount, blockerCount, coverageBlockerCount };
}

export async function createDataSubjectDecision(prisma, {
  scope,
  requestId,
  idempotencyKey,
  input: rawInput,
  fingerprintKey,
  fingerprintKeyId,
}, { sqlAdapter = null, readAdapter = null } = {}) {
  const input = normalizeDataSubjectDecisionInput(rawInput);
  const command = mutationCommand({
    scope,
    requestId,
    idempotencyKey,
    key: fingerprintKey,
    keyId: fingerprintKeyId,
    operationKind: 'DECISION_CREATE',
    input,
  });
  const reader = readAdapter || createDataSubjectReviewReadAdapter(prisma);
  await reader.requireAdmin(command);
  const replay = await reader.decisionCreationOperation(command);
  const adapter = sqlAdapter || createDataSubjectReviewSqlAdapter(prisma);
  if (replay) {
    if (
      !HASH_PATTERN.test(replay.manifestSha256)
      || !HASH_PATTERN.test(replay.holdSetSha256)
    ) throw contractError();
    command.expectedManifestSha256 = replay.manifestSha256;
    command.expectedHoldSetSha256 = replay.holdSetSha256;
    return executeMutation(async () => decisionResult(
      withResultScope(await adapter.createDecision(command), command),
      fingerprintKey,
    ));
  }
  const [request, manifest] = await Promise.all([
    reader.request(command),
    reader.manifest({ ...command, manifestId: command.manifestId, includeItems: true }),
  ]);
  if (!HASH_PATTERN.test(manifest.manifestSha256)) throw contractError();
  assertDecisionCoverage(request, manifest, command.items);
  const holdSetSha256 = await currentHoldSetSha256(adapter, command);
  const expectedToken = dataSubjectHoldSetRevisionToken(fingerprintKey, {
    organizationId: command.organizationId,
    requestId: command.requestId,
    manifestId: command.manifestId,
    holdSetSha256,
  });
  if (!dataSubjectReviewRevisionTokenMatches(command.holdSetRevisionToken, expectedToken)) {
    throw reviewError(
      'Las retenciones legales cambiaron. Actualizá el caso antes de continuar.',
      'PRIVACY_REVIEW_HOLD_SET_STALE',
      409,
    );
  }
  command.expectedManifestSha256 = manifest.manifestSha256;
  command.expectedHoldSetSha256 = holdSetSha256;
  return executeMutation(async () => decisionResult(
    withResultScope(await adapter.createDecision(command), command),
    fingerprintKey,
  ));
}

export async function decideDataSubjectDecision(prisma, {
  scope,
  requestId,
  decisionId,
  idempotencyKey,
  input: rawInput,
  fingerprintKey,
  fingerprintKeyId,
}, { sqlAdapter = null, readAdapter = null } = {}) {
  const input = normalizeDataSubjectDecisionOutcomeInput(rawInput);
  const command = mutationCommand({
    scope,
    requestId,
    idempotencyKey,
    key: fingerprintKey,
    keyId: fingerprintKeyId,
    operationKind: 'DECISION_DECIDE',
    input: {
      decisionId: identifier(decisionId, 'decisionId'),
      ...input,
    },
  });
  const reader = readAdapter || createDataSubjectReviewReadAdapter(prisma);
  await reader.requireAdmin(command);
  const replay = await reader.decisionOutcomeOperation(command);
  const adapter = sqlAdapter || createDataSubjectReviewSqlAdapter(prisma);
  if (replay) {
    if (!HASH_PATTERN.test(replay.decisionSha256)) throw contractError();
    command.expectedDecisionSha256 = replay.decisionSha256;
    return executeMutation(async () => decisionResult(
      withResultScope(await adapter.decide(command), command),
      fingerprintKey,
      { decided: true },
    ));
  }
  const current = await reader.decision(command);
  if (
    current.revision !== command.expectedRevision
    || !HASH_PATTERN.test(current.decisionSha256)
  ) {
    throw reviewError(
      'La decisión cambió. Actualizá el caso antes de continuar.',
      'PRIVACY_REVIEW_DECISION_STALE',
      409,
    );
  }
  const expectedToken = dataSubjectDecisionRevisionToken(fingerprintKey, {
    organizationId: command.organizationId,
    requestId: command.requestId,
    decisionId: command.decisionId,
    revision: current.revision,
    status: current.status,
    decisionSha256: current.decisionSha256,
  });
  if (!dataSubjectReviewRevisionTokenMatches(command.decisionRevisionToken, expectedToken)) {
    throw reviewError(
      'La decisión cambió. Actualizá el caso antes de continuar.',
      'PRIVACY_REVIEW_DECISION_STALE',
      409,
    );
  }
  command.expectedDecisionSha256 = current.decisionSha256;
  return executeMutation(async () => decisionResult(
    withResultScope(await adapter.decide(command), command),
    fingerprintKey,
    { decided: true },
  ));
}

function cursorSignature(key, organizationId, payload) {
  return createHmac('sha256', key).update(canonicalJson({
    contract: 'obrasaas:data-subject-review-cursor:v1',
    organizationId,
    payload,
  })).digest('base64url');
}

function encodeReviewCursor(key, organizationId, row) {
  const payload = Buffer.from(canonicalJson({
    id: storedIdentifier(row.id),
    receivedAt: storedTimestamp(row.receivedAt),
  })).toString('base64url');
  return `pc1.${payload}.${cursorSignature(key, organizationId, payload)}`;
}

function decodeReviewCursor(key, organizationId, value) {
  if (
    typeof value !== 'string'
    || value.length > 512
    || !/^pc1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(value)
  ) {
    throw reviewError(
      'cursor no es válido.',
      'PRIVACY_REVIEW_CURSOR_INVALID',
      400,
    );
  }
  const [, payload, signature] = value.split('.');
  const expected = cursorSignature(key, organizationId, payload);
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (
    actualBytes.byteLength !== expectedBytes.byteLength
    || !timingSafeEqual(actualBytes, expectedBytes)
  ) {
    throw reviewError(
      'cursor no es válido.',
      'PRIVACY_REVIEW_CURSOR_INVALID',
      400,
    );
  }
  let decoded;
  try {
    decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    throw reviewError(
      'cursor no es válido.',
      'PRIVACY_REVIEW_CURSOR_INVALID',
      400,
    );
  }
  const body = exactObject(decoded, 'cursor');
  exactFields(body, new Set(['id', 'receivedAt']), new Set(['id', 'receivedAt']), 'cursor');
  return {
    id: identifier(body.id, 'cursor.id'),
    receivedAt: new Date(isoTimestamp(body.receivedAt, 'cursor.receivedAt')),
  };
}

export function normalizeDataSubjectReviewListQuery(request, {
  organizationId,
  fingerprintKey,
} = {}) {
  identifier(organizationId, 'organizationId');
  validateDataSubjectReviewKeyConfig({
    key: fingerprintKey,
    keyId: 'runtime-validation',
  });
  const searchParams = new URL(request.url).searchParams;
  const allowed = new Set(['cursor', 'limit']);
  for (const key of new Set(searchParams.keys())) {
    if (!allowed.has(key) || searchParams.getAll(key).length !== 1) {
      throw reviewError(
        'La consulta de revisiones contiene parámetros no permitidos.',
        'PRIVACY_REVIEW_QUERY_INVALID',
        400,
      );
    }
  }
  const rawLimit = searchParams.get('limit');
  const limit = rawLimit === null
    ? 25
    : (/^[1-9]\d*$/.test(rawLimit)
      ? Number(rawLimit)
      : Number.NaN);
  if (!Number.isSafeInteger(limit) || limit > DATA_SUBJECT_REVIEW_LIST_MAX_PAGE_SIZE) {
    throw reviewError(
      `limit debe estar entre 1 y ${DATA_SUBJECT_REVIEW_LIST_MAX_PAGE_SIZE}.`,
      'PRIVACY_REVIEW_QUERY_INVALID',
      400,
    );
  }
  const rawCursor = searchParams.get('cursor');
  return {
    limit,
    cursor: rawCursor === null
      ? null
      : decodeReviewCursor(fingerprintKey, organizationId, rawCursor),
  };
}

function assertHeadChain(entries, predecessorField, counterField = 'sequence') {
  if (!Array.isArray(entries) || entries.length > 2) throw contractError();
  if (entries.length === 0) return null;
  const head = entries[0];
  const sequence = storedInteger(head[counterField], { minimum: 1 });
  storedIdentifier(head.id);
  if (entries.length === 1) {
    if (sequence !== 1 || head[predecessorField] !== null) throw contractError();
    return head;
  }
  const predecessor = entries[1];
  if (
    storedInteger(predecessor[counterField], { minimum: 1 }) !== sequence - 1
    || head[predecessorField] !== predecessor.id
  ) throw contractError();
  return head;
}

function activeHoldEntries(rows) {
  if (!Array.isArray(rows) || rows.length > DATA_SUBJECT_ACTIVE_HOLD_LIMIT) {
    throw contractError();
  }
  return rows.map((row) => {
    if (
      !row
      || !['CREATED', 'REVIEWED'].includes(row.event_kind)
      || !HOLD_SCOPE_KINDS.has(row.scope_kind)
    ) {
      throw contractError();
    }
    return {
      hold: {
        id: storedIdentifier(row.hold_id),
        manifestId: storedIdentifier(row.manifest_id),
        scopeKind: row.scope_kind,
        discoveryItemId: row.discovery_item_id,
        category: row.category,
        createdAt: row.created_at,
      },
      head: {
        id: storedIdentifier(row.event_id),
        sequence: storedInteger(row.sequence, { minimum: 1 }),
        kind: row.event_kind,
        basisCode: row.basis_code,
        policyVersion: row.policy_version,
        evidenceSha256: row.evidence_sha256,
        reviewDueAt: row.review_due_at,
        occurredAt: row.occurred_at,
      },
    };
  });
}

function currentVerificationState(head, workerPerson, observedAt) {
  if (!head) return { state: 'IDENTITY_PENDING', stale: false };
  if (!VERIFICATION_EVENT_KINDS.has(head.kind)) throw contractError();
  if (head.kind === 'REVOKED') {
    return { state: 'IDENTITY_REVOKED_OR_EXPIRED', stale: false };
  }
  if (
    !REQUESTER_KINDS.has(head.requesterKind)
    || head.assuranceLevel !== 'SUBSTANTIAL'
    || !head.validUntil
  ) throw contractError();
  const validUntil = new Date(head.validUntil);
  const representationUntil = head.requesterKind === 'REPRESENTATIVE'
    ? new Date(head.representationValidUntil)
    : null;
  if (
    Number.isNaN(validUntil.getTime())
    || (representationUntil && Number.isNaN(representationUntil.getTime()))
    || validUntil <= observedAt
    || (representationUntil && representationUntil <= observedAt)
  ) return { state: 'IDENTITY_REVOKED_OR_EXPIRED', stale: false };
  if (
    head.requesterKind === 'SELF'
    && (
      !workerPerson
      || workerPerson.identityStatus !== 'VERIFIED'
      || head.subjectIdentityRecordVersion !== workerPerson.recordVersion
    )
  ) return { state: 'STALE', stale: true };
  return { state: null, stale: false };
}

function deriveReviewState({
  verification,
  assessment,
  manifest,
  decision,
  workerPerson,
  holdSetStale = false,
  observedAt,
}) {
  const identity = currentVerificationState(verification, workerPerson, observedAt);
  if (identity.state) return identity.state;
  if (!assessment) return 'LEGAL_ASSESSMENT_PENDING';
  if (assessment.manifestId !== manifest.id) return 'STALE';
  if (!decision || decision.status === 'REJECTED') return 'DECISION_PREPARATION_PENDING';
  if (
    decision.manifestId !== manifest.id
    || decision.verificationEventId !== verification.id
    || decision.legalAssessmentId !== assessment.id
    || holdSetStale
  ) return 'STALE';
  if (decision.status === 'PENDING_APPROVAL') return 'APPROVAL_PENDING';
  if (decision.status === 'SEALED_BLOCKED') return 'REVIEW_BLOCKED';
  return 'STALE';
}

function listEntry(row, observedAt, holdSnapshot) {
  if (
    !row
    || row.organizationId === undefined
    || !DATA_SUBJECT_REQUEST_TYPES.includes(row.type)
    || !['DISCOVERED', 'DISCOVERY_BLOCKED'].includes(row.status)
    || !holdSnapshot
    || !Array.isArray(holdSnapshot.activeHolds)
    || !holdSnapshot.manifestCounts
  ) throw contractError();
  const verification = assertHeadChain(
    row.requesterVerificationEvents,
    'predecessorEventId',
  );
  const assessment = assertHeadChain(
    row.legalAssessmentRevisions,
    'predecessorAssessmentId',
  );
  const decision = assertHeadChain(
    row.decisionSets,
    'predecessorDecisionId',
    'revision',
  );
  const activeHolds = activeHoldEntries(holdSnapshot.activeHolds).length;
  const currentHoldSetSha256Value = holdSnapshot.holdSetSha256;
  const manifestCounts = holdSnapshot.manifestCounts;
  const manifest = row.manifest;
  if (
    !manifest
    || manifest.organizationId !== row.organizationId
    || manifest.requestId !== row.id
    || !['COMPLETE', 'BLOCKED'].includes(manifest.outcome)
    || (row.status === 'DISCOVERED' && manifest.outcome !== 'COMPLETE')
    || (row.status === 'DISCOVERY_BLOCKED' && manifest.outcome !== 'BLOCKED')
    || !HASH_PATTERN.test(manifest.manifestSha256)
    || !Number.isSafeInteger(manifest.itemCount)
    || !Number.isSafeInteger(manifest.blockerCount)
    || manifest.itemCount < 1
    || manifest.itemCount > DATA_SUBJECT_REVIEW_ITEM_LIMIT
    || manifest.blockerCount < 0
    || manifest.blockerCount > manifest.itemCount
    || manifestCounts.itemCount !== manifest.itemCount
    || manifestCounts.blockerCount !== manifest.blockerCount
    || manifestCounts.coverageBlockerCount > manifest.blockerCount
    || (manifest.outcome === 'COMPLETE' && manifestCounts.blockerCount !== 0)
    || (manifest.outcome === 'BLOCKED' && manifestCounts.blockerCount === 0)
  ) {
    throw reviewError(
      'El caso tiene un manifiesto inconsistente y quedó bloqueado para revisión.',
      'PRIVACY_REVIEW_MANIFEST_INCONSISTENT',
      409,
    );
  }
  if (
    decision
    && (
      !new Set(['PENDING_APPROVAL', 'SEALED_BLOCKED', 'REJECTED']).has(decision.status)
      || !Number.isSafeInteger(decision.itemCount)
      || !Number.isSafeInteger(decision.unresolvedCount)
      || !Number.isSafeInteger(decision.activeHoldCount)
      || decision.itemCount !== manifest.itemCount
      || decision.unresolvedCount !== manifestCounts.coverageBlockerCount
      || decision.unresolvedCount < 0
      || decision.unresolvedCount > decision.itemCount
      || decision.activeHoldCount < 0
      || decision.activeHoldCount > DATA_SUBJECT_ACTIVE_HOLD_LIMIT
      || !HASH_PATTERN.test(decision.manifestSha256)
      || !HASH_PATTERN.test(decision.holdSetSha256)
      || !HASH_PATTERN.test(currentHoldSetSha256Value)
    )
  ) throw contractError();
  const holdSetStale = Boolean(decision && (
    decision.manifestSha256 !== manifest.manifestSha256
    || decision.holdSetSha256 !== currentHoldSetSha256Value
    || decision.activeHoldCount !== activeHolds
  ));
  const reviewState = deriveReviewState({
    verification,
    assessment,
    manifest,
    decision,
    workerPerson: row.workerPerson,
    holdSetStale,
    observedAt,
  });
  const dueAt = assessment ? storedTimestamp(assessment.dueAt) : null;
  return {
    id: storedIdentifier(row.id),
    type: row.type,
    subjectKind: row.subjectKind,
    status: row.status,
    receivedAt: storedTimestamp(row.receivedAt),
    terminalAt: row.terminalAt ? storedTimestamp(row.terminalAt) : null,
    failureCode: row.terminalReasonCode || null,
    subjectIdentityRevision: Number.isSafeInteger(row.workerPerson?.recordVersion)
      ? row.workerPerson.recordVersion
      : null,
    discovery: {
      outcome: manifest.outcome,
      itemCount: manifest.itemCount,
      blockerCount: manifest.blockerCount,
      coverageBlockerCount: manifestCounts.coverageBlockerCount,
      sealedAt: storedTimestamp(manifest.sealedAt),
      coverageComplete: manifest.outcome === 'COMPLETE',
      evidenceCommitted: true,
    },
    requesterVerification: verification ? {
      id: storedIdentifier(verification.id),
      sequence: storedInteger(verification.sequence, { minimum: 1 }),
      eventKind: verification.kind,
      requesterKind: verification.requesterKind,
      assuranceLevel: verification.assuranceLevel,
      validUntil: verification.validUntil
        ? storedTimestamp(verification.validUntil)
        : null,
      evidenceCommitted: verification.kind === 'VERIFIED',
    } : null,
    legalAssessment: assessment ? {
      id: storedIdentifier(assessment.id),
      sequence: storedInteger(assessment.sequence, { minimum: 1 }),
      jurisdictionCode: assessment.jurisdictionCode,
      dueAt,
      assessedAt: storedTimestamp(assessment.assessedAt),
      evidenceCommitted: true,
    } : null,
    activeHoldCount: activeHolds,
    decision: decision ? {
      id: storedIdentifier(decision.id),
      revision: storedInteger(decision.revision, { minimum: 1 }),
      status: decision.status,
      preparedAt: storedTimestamp(decision.preparedAt),
      pendingAt: decision.pendingAt ? storedTimestamp(decision.pendingAt) : null,
      decidedAt: decision.decidedAt ? storedTimestamp(decision.decidedAt) : null,
    } : null,
    reviewState,
    deadlineOverdue: Boolean(dueAt && new Date(dueAt) < observedAt),
    executionAllowed: false,
  };
}

async function listWithinReviewSnapshot({
  scope,
  query,
  fingerprintKey,
  observedAt,
  readAdapter,
  sqlAdapter,
}) {
  const reader = readAdapter;
  const database = sqlAdapter;
  if (!reader || !database) throw contractError();
  await reader.requireAdmin(scope);
  const rows = await reader.list({ ...scope, ...query });
  if (!Array.isArray(rows) || rows.length > query.limit + 1) throw contractError();
  const hasMore = rows.length > query.limit;
  const page = rows.slice(0, query.limit);
  if (page.some((row) => row.organizationId !== scope.organizationId)) throw contractError();
  const holdSnapshots = await executeMutation(() => Promise.all(page.map(async (row) => {
    const [activeHolds, holdSetSha256, manifestCounts] = await Promise.all([
      database.activeHolds({
        organizationId: scope.organizationId,
        requestId: row.id,
      }),
      row.decisionSets?.length > 0
        ? currentHoldSetSha256(database, {
          organizationId: scope.organizationId,
          requestId: row.id,
          manifestId: row.manifest.id,
        })
        : null,
      currentManifestCounts(database, {
        organizationId: scope.organizationId,
        requestId: row.id,
        manifestId: row.manifest.id,
      }),
    ]);
    return { activeHolds, holdSetSha256, manifestCounts };
  })));
  return {
    requests: page.map((row, index) => listEntry(row, observedAt, holdSnapshots[index])),
    nextCursor: hasMore
      ? encodeReviewCursor(fingerprintKey, scope.organizationId, page.at(-1))
      : null,
    pageSize: page.length,
    executionAllowed: false,
  };
}

export async function listDataSubjectRequestsForReview(prisma, {
  scope: rawScope,
  query,
  fingerprintKey,
}, {
  readAdapter = null,
  sqlAdapter = null,
  snapshotAdapter = null,
  observedAt = new Date(),
} = {}) {
  const scope = normalizeReviewScope(rawScope);
  if (readAdapter || sqlAdapter) {
    if (!readAdapter || !sqlAdapter) throw contractError();
    return listWithinReviewSnapshot({
      scope,
      query,
      fingerprintKey,
      observedAt,
      readAdapter,
      sqlAdapter,
    });
  }
  const snapshot = snapshotAdapter || createDataSubjectReviewSnapshotAdapter(prisma);
  return snapshot.read((adapters) => listWithinReviewSnapshot({
    scope,
    query,
    fingerprintKey,
    observedAt,
    ...adapters,
  }));
}

function serializeVerificationHead(head) {
  if (!head) return null;
  const base = {
    id: storedIdentifier(head.id),
    sequence: storedInteger(head.sequence, { minimum: 1 }),
    eventKind: head.kind,
    occurredAt: storedTimestamp(head.occurredAt),
  };
  if (head.kind === 'REVOKED') {
    if (
      typeof head.revocationReasonCode !== 'string'
      || head.requesterKind !== null
      || head.assuranceLevel !== null
      || head.verificationMethodCode !== null
      || head.verificationPolicyVersion !== null
      || head.requesterFingerprintHmac !== null
      || head.identityEvidenceSha256 !== null
      || head.challengeEvidenceSha256 !== null
      || head.subjectIdentityRecordVersion !== null
      || head.representationMethodCode !== null
      || head.representationEvidenceSha256 !== null
      || head.validUntil !== null
      || head.representationValidUntil !== null
    ) throw contractError();
    return {
      ...base,
      requesterKind: null,
      assuranceLevel: null,
      verificationMethodCode: null,
      verificationPolicyVersion: null,
      validUntil: null,
      representationValidUntil: null,
      revocationReasonCode: head.revocationReasonCode,
      evidenceCommitted: false,
    };
  }
  const self = head.requesterKind === 'SELF';
  const representative = head.requesterKind === 'REPRESENTATIVE';
  if (
    head.kind !== 'VERIFIED'
    || (!self && !representative)
    || head.assuranceLevel !== 'SUBSTANTIAL'
    || typeof head.verificationMethodCode !== 'string'
    || typeof head.verificationPolicyVersion !== 'string'
    || !HASH_PATTERN.test(head.requesterFingerprintHmac)
    || !HASH_PATTERN.test(head.identityEvidenceSha256)
    || !HASH_PATTERN.test(head.challengeEvidenceSha256)
    || !head.validUntil
    || (self && (
      !Number.isSafeInteger(head.subjectIdentityRecordVersion)
      || head.subjectIdentityRecordVersion < 1
      || head.representationMethodCode !== null
      || head.representationEvidenceSha256 !== null
      || head.representationValidUntil !== null
    ))
    || (representative && (
      head.subjectIdentityRecordVersion !== null
      || typeof head.representationMethodCode !== 'string'
      || !HASH_PATTERN.test(head.representationEvidenceSha256)
      || !head.representationValidUntil
    ))
  ) throw contractError();
  return {
    ...base,
    requesterKind: head.requesterKind,
    assuranceLevel: head.assuranceLevel,
    verificationMethodCode: head.verificationMethodCode,
    verificationPolicyVersion: head.verificationPolicyVersion,
    validUntil: storedTimestamp(head.validUntil),
    representationValidUntil: representative
      ? storedTimestamp(head.representationValidUntil)
      : null,
    revocationReasonCode: null,
    evidenceCommitted: true,
  };
}

function serializeAssessmentHead(head, manifestId) {
  if (!head) return null;
  if (
    head.manifestId !== manifestId
    || head.deadlineMethod !== 'REVIEWED_EXPLICIT_DATE'
    || typeof head.jurisdictionCode !== 'string'
    || typeof head.deadlinePolicyVersion !== 'string'
    || typeof head.retentionMatrixVersion !== 'string'
    || !HASH_PATTERN.test(head.deadlinePolicySha256)
    || !HASH_PATTERN.test(head.retentionMatrixSha256)
    || !HASH_PATTERN.test(head.legalReviewEvidenceSha256)
  ) throw contractError();
  return {
    id: storedIdentifier(head.id),
    sequence: storedInteger(head.sequence, { minimum: 1 }),
    jurisdictionCode: head.jurisdictionCode,
    deadlineMethod: head.deadlineMethod,
    dueAt: storedTimestamp(head.dueAt),
    deadlinePolicyVersion: head.deadlinePolicyVersion,
    retentionMatrixVersion: head.retentionMatrixVersion,
    assessedAt: storedTimestamp(head.assessedAt),
    evidenceCommitted: true,
  };
}

function serializeHold({ hold, head }, manifestId) {
  if (
    hold.manifestId !== manifestId
    || !HOLD_SCOPE_KINDS.has(hold.scopeKind)
    || (hold.scopeKind === 'ITEM' && !hold.discoveryItemId)
    || (hold.scopeKind === 'CATEGORY' && !DATA_CATEGORIES.has(hold.category))
  ) throw contractError();
  const active = head.kind !== 'RELEASED';
  if (
    (active && (
      typeof head.basisCode !== 'string'
      || typeof head.policyVersion !== 'string'
      || !HASH_PATTERN.test(head.evidenceSha256)
      || !head.reviewDueAt
    ))
    || (!active && (
      typeof head.releaseReasonCode !== 'string'
      || !HASH_PATTERN.test(head.releaseEvidenceSha256)
    ))
  ) throw contractError();
  return {
    id: storedIdentifier(hold.id),
    scope: hold.scopeKind === 'ITEM'
      ? { kind: 'ITEM', reviewItemId: storedIdentifier(hold.discoveryItemId) }
      : { kind: 'CATEGORY', category: hold.category },
    headEvent: {
      id: storedIdentifier(head.id),
      sequence: storedInteger(head.sequence, { minimum: 1 }),
      eventKind: head.kind,
      basisCode: active ? head.basisCode : null,
      policyVersion: active ? head.policyVersion : null,
      reviewDueAt: active ? storedTimestamp(head.reviewDueAt) : null,
      releaseReasonCode: active ? null : head.releaseReasonCode,
      occurredAt: storedTimestamp(head.occurredAt),
      evidenceCommitted: true,
    },
    active,
    createdAt: storedTimestamp(hold.createdAt),
  };
}

function validateManifest(manifest, request) {
  if (
    !manifest
    || manifest.organizationId !== request.organizationId
    || manifest.requestId !== request.id
    || !['COMPLETE', 'BLOCKED'].includes(manifest.outcome)
    || (request.status === 'DISCOVERED' && manifest.outcome !== 'COMPLETE')
    || (request.status === 'DISCOVERY_BLOCKED' && manifest.outcome !== 'BLOCKED')
    || !HASH_PATTERN.test(manifest.manifestSha256)
    || !Number.isSafeInteger(manifest.itemCount)
    || manifest.itemCount < 1
    || manifest.itemCount > DATA_SUBJECT_REVIEW_ITEM_LIMIT
    || !Number.isSafeInteger(manifest.blockerCount)
    || manifest.blockerCount < 0
    || manifest.blockerCount > manifest.itemCount
    || !Array.isArray(manifest.items)
    || manifest.items.length !== manifest.itemCount
  ) {
    throw reviewError(
      'El caso tiene un manifiesto inconsistente y quedó bloqueado para revisión.',
      'PRIVACY_REVIEW_MANIFEST_INCONSISTENT',
      409,
    );
  }
  let blockerCount = 0;
  let coverageBlockerCount = 0;
  manifest.items.forEach((item, ordinal) => {
    const coverageBlocker = item.kind === 'COVERAGE_BLOCKER';
    const itemBlocked = item.blockerCode !== null || item.disposition === 'REVIEW_REQUIRED';
    if (
      item.ordinal !== ordinal
      || !new Set(['RECORD', 'COVERAGE_BLOCKER']).has(item.kind)
      || !DATA_CATEGORIES.has(item.category)
      || typeof item.resourceType !== 'string'
      || !item.resourceType
      || !DATA_SUBJECT_DISPOSITIONS.has(item.disposition)
      || (item.blockerCode !== null && (
        typeof item.blockerCode !== 'string'
        || !item.blockerCode
      ))
      || (coverageBlocker && (
        typeof item.blockerCode !== 'string'
        || !item.blockerCode
        || item.disposition !== 'REVIEW_REQUIRED'
      ))
    ) throw contractError();
    storedIdentifier(item.id);
    if (itemBlocked) blockerCount += 1;
    if (coverageBlocker) coverageBlockerCount += 1;
  });
  if (
    blockerCount !== manifest.blockerCount
    || (manifest.outcome === 'COMPLETE' && blockerCount !== 0)
    || (manifest.outcome === 'BLOCKED' && blockerCount === 0)
  ) throw contractError();
  return { ...manifest, coverageBlockerCount };
}

function serializeDecisionHead(decision, {
  request,
  manifest,
  verification,
  assessment,
  activeHoldCount,
  currentHoldSetSha256Value,
  fingerprintKey,
}) {
  if (!decision) return { value: null, stale: false, items: new Map() };
  const revision = storedInteger(decision.revision, { minimum: 1 });
  if (
    !new Set(['PENDING_APPROVAL', 'SEALED_BLOCKED', 'REJECTED']).has(decision.status)
    || !HASH_PATTERN.test(decision.manifestSha256)
    || !HASH_PATTERN.test(decision.holdSetSha256)
    || !HASH_PATTERN.test(decision.decisionSha256)
    || !Number.isSafeInteger(decision.itemCount)
    || !Number.isSafeInteger(decision.unresolvedCount)
    || !Number.isSafeInteger(decision.activeHoldCount)
    || !Array.isArray(decision.items)
    || decision.items.length !== decision.itemCount
    || decision.itemCount !== manifest.itemCount
  ) throw contractError();
  const byItem = new Map();
  let unresolvedCount = 0;
  decision.items.forEach((item, ordinal) => {
    const manifestItem = manifest.items[ordinal];
    const unresolved = item.action === 'UNRESOLVED';
    const legalFieldsValid = unresolved
      ? item.legalBasisCode === null
        && item.retentionPolicyVersion === null
        && item.retentionRuleCode === null
        && item.retentionUntil === null
      : typeof item.legalBasisCode === 'string'
        && typeof item.retentionPolicyVersion === 'string'
        && typeof item.retentionRuleCode === 'string';
    if (
      item.ordinal !== ordinal
      || byItem.has(item.discoveryItemId)
      || !DATA_SUBJECT_DECISION_ACTIONS.includes(item.action)
      || item.discoveryItemId !== manifestItem?.id
      || !legalFieldsValid
      || (manifestItem?.kind === 'COVERAGE_BLOCKER' && !unresolved)
      || (manifestItem?.kind === 'RECORD' && (
        unresolved
        || !DATA_SUBJECT_CANDIDATE_ACTIONS_BY_REQUEST_TYPE[request.type]
          ?.includes(item.action)
      ))
    ) throw contractError();
    const reviewItemId = storedIdentifier(item.discoveryItemId);
    if (unresolved) unresolvedCount += 1;
    byItem.set(reviewItemId, {
      action: item.action,
      legalBasisCode: item.legalBasisCode,
      retentionPolicyVersion: item.retentionPolicyVersion,
      retentionRuleCode: item.retentionRuleCode,
      retentionUntil: item.retentionUntil ? storedTimestamp(item.retentionUntil) : null,
    });
  });
  if (
    unresolvedCount !== decision.unresolvedCount
    || unresolvedCount !== manifest.coverageBlockerCount
    || decision.activeHoldCount < 0
    || decision.activeHoldCount > DATA_SUBJECT_ACTIVE_HOLD_LIMIT
  ) throw contractError();
  const makerCheckerCompleted = Boolean(
    decision.decidedByMembershipId
    && decision.decidedByMembershipId !== decision.preparedByMembershipId,
  );
  if (
    (decision.status === 'PENDING_APPROVAL' && decision.decidedByMembershipId !== null)
    || (decision.status !== 'PENDING_APPROVAL' && !makerCheckerCompleted)
  ) throw contractError();
  const stale = (
    decision.manifestId !== manifest.id
    || decision.manifestSha256 !== manifest.manifestSha256
    || decision.verificationEventId !== verification?.id
    || decision.legalAssessmentId !== assessment?.id
    || decision.holdSetSha256 !== currentHoldSetSha256Value
    || decision.activeHoldCount !== activeHoldCount
  );
  return {
    value: {
      id: storedIdentifier(decision.id),
      revision,
      status: decision.status,
      itemCount: decision.itemCount,
      unresolvedCount: decision.unresolvedCount,
      activeHoldCount: decision.activeHoldCount,
      preparedAt: storedTimestamp(decision.preparedAt),
      pendingAt: decision.pendingAt ? storedTimestamp(decision.pendingAt) : null,
      decidedAt: decision.decidedAt ? storedTimestamp(decision.decidedAt) : null,
      makerCheckerCompleted,
      evidenceCommitted: true,
      decisionRevisionToken: dataSubjectDecisionRevisionToken(fingerprintKey, {
        organizationId: request.organizationId,
        requestId: request.id,
        decisionId: decision.id,
        revision,
        status: decision.status,
        decisionSha256: decision.decisionSha256,
      }),
      executionAllowed: false,
    },
    stale,
    items: byItem,
  };
}

function reviewEntry(row, {
  fingerprintKey,
  holdSetSha256,
  activeHolds,
  observedAt,
}) {
  if (
    !row
    || !DATA_SUBJECT_REQUEST_TYPES.includes(row.type)
    || !['DISCOVERED', 'DISCOVERY_BLOCKED'].includes(row.status)
  ) {
    throw reviewError(
      'El caso todavía no tiene un descubrimiento revisable.',
      'PRIVACY_REVIEW_DISCOVERY_REQUIRED',
      409,
    );
  }
  const manifest = validateManifest(row.manifest, row);
  const verificationHead = assertHeadChain(
    row.requesterVerificationEvents,
    'predecessorEventId',
  );
  const assessmentHead = assertHeadChain(
    row.legalAssessmentRevisions,
    'predecessorAssessmentId',
  );
  const decisionHead = assertHeadChain(
    row.decisionSets,
    'predecessorDecisionId',
    'revision',
  );
  const holdHeads = activeHoldEntries(activeHolds);
  const holds = holdHeads.map((entry) => serializeHold(entry, manifest.id));
  const activeHoldCount = holds.filter((hold) => hold.active).length;
  if (!HASH_PATTERN.test(holdSetSha256)) throw contractError();
  const verification = serializeVerificationHead(verificationHead);
  const assessment = serializeAssessmentHead(assessmentHead, manifest.id);
  const decision = serializeDecisionHead(decisionHead, {
    request: row,
    manifest,
    verification: verificationHead,
    assessment: assessmentHead,
    activeHoldCount,
    currentHoldSetSha256Value: holdSetSha256,
    fingerprintKey,
  });
  const reviewState = deriveReviewState({
    verification: verificationHead,
    assessment: assessmentHead,
    manifest,
    decision: decisionHead,
    workerPerson: row.workerPerson,
    holdSetStale: decision.stale,
    observedAt,
  });
  const reviewItems = manifest.items.map((item) => ({
    reviewItemId: item.id,
    ordinal: item.ordinal,
    kind: item.kind,
    category: item.category,
    recordType: item.resourceType,
    blockerCode: item.blockerCode,
    proposedDecision: decision.items.get(item.id) || null,
  }));
  const dueAt = assessment?.dueAt || null;
  return {
    request: {
      id: storedIdentifier(row.id),
      type: row.type,
      subjectKind: row.subjectKind,
      status: row.status,
      receivedAt: storedTimestamp(row.receivedAt),
      terminalAt: row.terminalAt ? storedTimestamp(row.terminalAt) : null,
      failureCode: row.terminalReasonCode || null,
      subjectIdentityRevision: Number.isSafeInteger(row.workerPerson?.recordVersion)
        ? row.workerPerson.recordVersion
        : null,
    },
    discovery: {
      id: storedIdentifier(manifest.id),
      outcome: manifest.outcome,
      itemCount: manifest.itemCount,
      blockerCount: manifest.blockerCount,
      coverageBlockerCount: manifest.coverageBlockerCount,
      sealedAt: storedTimestamp(manifest.sealedAt),
      coverageComplete: manifest.outcome === 'COMPLETE',
      evidenceCommitted: true,
    },
    requesterVerification: verification,
    legalAssessment: assessment,
    holds,
    holdSetRevisionToken: dataSubjectHoldSetRevisionToken(fingerprintKey, {
      organizationId: row.organizationId,
      requestId: row.id,
      manifestId: manifest.id,
      holdSetSha256,
    }),
    decision: decision.value,
    reviewItems,
    reviewState,
    deadlineOverdue: Boolean(dueAt && new Date(dueAt) < observedAt),
    executionAllowed: false,
  };
}

async function readWithinReviewSnapshot({
  scope,
  requestId,
  fingerprintKey,
  observedAt,
  readAdapter,
  sqlAdapter,
}) {
  const reader = readAdapter;
  const database = sqlAdapter;
  if (!reader || !database) throw contractError();
  await reader.requireAdmin(scope);
  const row = await reader.review({ ...scope, requestId });
  if (!row) throw notFound();
  if (row.organizationId !== scope.organizationId || row.id !== requestId) throw contractError();
  if (!row.manifest) {
    throw reviewError(
      'El caso todavía no tiene un descubrimiento revisable.',
      'PRIVACY_REVIEW_DISCOVERY_REQUIRED',
      409,
    );
  }
  const snapshot = await executeMutation(async () => {
    const holdSetSha256 = await currentHoldSetSha256(database, {
      organizationId: scope.organizationId,
      requestId,
      manifestId: row.manifest.id,
    });
    const activeHolds = await database.activeHolds({
      organizationId: scope.organizationId,
      requestId,
    });
    return { holdSetSha256, activeHolds };
  });
  return reviewEntry(row, {
    fingerprintKey,
    ...snapshot,
    observedAt,
  });
}

export async function readDataSubjectRequestReview(prisma, {
  scope: rawScope,
  requestId: rawRequestId,
  fingerprintKey,
}, {
  readAdapter = null,
  sqlAdapter = null,
  snapshotAdapter = null,
  observedAt = new Date(),
} = {}) {
  const scope = normalizeReviewScope(rawScope);
  const requestId = identifier(rawRequestId, 'requestId');
  if (readAdapter || sqlAdapter) {
    if (!readAdapter || !sqlAdapter) throw contractError();
    return readWithinReviewSnapshot({
      scope,
      requestId,
      fingerprintKey,
      observedAt,
      readAdapter,
      sqlAdapter,
    });
  }
  const consistent = snapshotAdapter || createDataSubjectReviewSnapshotAdapter(prisma);
  return consistent.read((adapters) => readWithinReviewSnapshot({
    scope,
    requestId,
    fingerprintKey,
    observedAt,
    ...adapters,
  }));
}

export function dataSubjectReviewErrorResponse(error) {
  if (
    !(error instanceof DataSubjectReviewError)
    && error?.[DATA_SUBJECT_REVIEW_ERROR] !== true
  ) return null;
  return Response.json(
    { error: error.message, code: error.code },
    {
      status: error.status,
      headers: {
        'Cache-Control': 'private, no-store, max-age=0',
        ...(error.retryAfterSeconds
          ? { 'Retry-After': String(error.retryAfterSeconds) }
          : {}),
      },
    },
  );
}

export const dataSubjectReviewValidation = Object.freeze({
  code,
  enumValue,
  exactFields,
  exactObject,
  identifier,
  integer,
  isoTimestamp,
  sha256,
});
