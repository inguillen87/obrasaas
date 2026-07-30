import crypto from 'node:crypto';

export const PRIVACY_DISCOVERY_CATALOG_VERSION = 'privacy-discovery-catalog-v1';
export const PRIVACY_DISCOVERY_FINGERPRINT_KEY_ID_ENV = 'PRIVACY_DISCOVERY_FINGERPRINT_KEY_ID';
export const PRIVACY_DISCOVERY_FINGERPRINT_SECRET_ENV = 'PRIVACY_DISCOVERY_FINGERPRINT_SECRET';
export const PRIVACY_DISCOVERY_FAMILY_LIMIT = 100;
export const PRIVACY_DISCOVERY_MANIFEST_ITEM_LIMIT = 1024;

const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

export class PrivacyDiscoveryError extends Error {
  constructor(message, code = 'PRIVACY_DISCOVERY_FAILED', status = 500) {
    super(message);
    this.name = 'PrivacyDiscoveryError';
    this.code = code;
    this.status = status;
  }
}

function privacyError(message, code, status) {
  return new PrivacyDiscoveryError(message, code, status);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmac(key, value) {
  return crypto.createHmac('sha256', key).update(value).digest('hex');
}

function utcTimestamp(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw privacyError(
      'Privacy discovery received an invalid database timestamp.',
      'PRIVACY_DISCOVERY_STATE_INVALID',
      500,
    );
  }
  return date.toISOString();
}

function lengthPrefix(value) {
  if (value === null || value === undefined) return '-1:';
  const text = String(value);
  return `${Buffer.byteLength(text, 'utf8')}:${text}`;
}

const DIRECT_RECORD_FAMILIES = Object.freeze([
  Object.freeze({
    family: 'worker-person',
    category: 'PERSONAL',
    resourceType: 'WorkerPerson',
    fieldSetCode: 'identity-core-v1',
    coverage: 'SUPPORTED',
    sql: `SELECT "id", to_char("updatedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "recordVersion"
            FROM "WorkerPerson"
           WHERE "organizationId" = $1 AND "id" = $2
           ORDER BY "id" ASC LIMIT $3::int`,
  }),
  Object.freeze({
    family: 'worker-channel-identities',
    category: 'PERSONAL',
    resourceType: 'WorkerChannelIdentity',
    fieldSetCode: 'channel-identity-v1',
    coverage: 'SUPPORTED',
    sql: `SELECT "id", to_char("updatedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "recordVersion"
            FROM "WorkerChannelIdentity"
           WHERE "organizationId" = $1 AND "personId" = $2
           ORDER BY "id" ASC LIMIT $3::int`,
  }),
  Object.freeze({
    family: 'worker-project-links',
    category: 'LABOR',
    resourceType: 'Worker',
    fieldSetCode: 'worker-project-link-v1',
    coverage: 'PARTIAL',
    sql: `SELECT "id", to_char("updatedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "recordVersion"
            FROM "Worker"
           WHERE "organizationId" = $1 AND "personId" = $2
           ORDER BY "id" ASC LIMIT $3::int`,
  }),
  Object.freeze({
    family: 'worker-onboarding-claims',
    category: 'PERSONAL',
    resourceType: 'WorkerOnboardingClaim',
    fieldSetCode: 'resolved-onboarding-claim-v1',
    coverage: 'PARTIAL',
    sql: `SELECT "id", to_char("updatedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "recordVersion"
            FROM "WorkerOnboardingClaim"
           WHERE "organizationId" = $1 AND "resolvedPersonId" = $2
           ORDER BY "id" ASC LIMIT $3::int`,
  }),
  Object.freeze({
    family: 'worker-privacy-choice-events',
    category: 'AUDIT',
    resourceType: 'WorkerPrivacyChoiceEvent',
    fieldSetCode: 'payment-privacy-choice-v1',
    coverage: 'SUPPORTED',
    sql: `SELECT "id", to_char("createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "recordVersion"
            FROM "WorkerPrivacyChoiceEvent"
           WHERE "organizationId" = $1 AND "personId" = $2
           ORDER BY "id" ASC LIMIT $3::int`,
  }),
  Object.freeze({
    family: 'worker-payment-destinations',
    category: 'FINANCIAL',
    resourceType: 'WorkerPaymentDestination',
    fieldSetCode: 'payment-destination-v1',
    coverage: 'SUPPORTED',
    sql: `SELECT "id", to_char("updatedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "recordVersion"
            FROM "WorkerPaymentDestination"
           WHERE "organizationId" = $1 AND "personId" = $2
           ORDER BY "id" ASC LIMIT $3::int`,
  }),
  Object.freeze({
    family: 'worker-sensitive-decisions',
    category: 'AUDIT',
    resourceType: 'WorkerSensitiveDecision',
    fieldSetCode: 'sensitive-decision-v1',
    coverage: 'SUPPORTED',
    sql: `SELECT "id", to_char("createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "recordVersion"
            FROM "WorkerSensitiveDecision"
           WHERE "organizationId" = $1 AND "workerPersonId" = $2
           ORDER BY "id" ASC LIMIT $3::int`,
  }),
  Object.freeze({
    family: 'worker-payment-flow-sessions',
    category: 'FINANCIAL',
    resourceType: 'WorkerPaymentFlowSession',
    fieldSetCode: 'payment-flow-session-v1',
    coverage: 'SUPPORTED',
    sql: `SELECT "flowSessionId" AS "id",
                  to_char("updatedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "recordVersion"
            FROM "WorkerPaymentFlowSession"
           WHERE "organizationId" = $1 AND "personId" = $2
           ORDER BY "flowSessionId" ASC LIMIT $3::int`,
  }),
  Object.freeze({
    family: 'worker-payment-private-receipts',
    category: 'FINANCIAL',
    resourceType: 'WorkerPaymentPrivateReceipt',
    fieldSetCode: 'payment-private-receipt-v1',
    coverage: 'SUPPORTED',
    sql: `SELECT "id", to_char("issuedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "recordVersion"
            FROM "WorkerPaymentPrivateReceipt"
           WHERE "organizationId" = $1 AND "personId" = $2
           ORDER BY "id" ASC LIMIT $3::int`,
  }),
]);

const MANDATORY_COVERAGE_BLOCKERS = Object.freeze([
  Object.freeze({
    category: 'LABOR',
    resourceType: 'WorkerOperationalGraph',
    fieldSetCode: 'worker-operational-relations-v1',
    blockerCode: 'WORKER_OPERATIONAL_GRAPH_PARTIAL',
  }),
  Object.freeze({
    category: 'CONVERSATION',
    resourceType: 'ConversationMessage',
    fieldSetCode: 'channel-subject-binding-v1',
    blockerCode: 'CONVERSATION_SUBJECT_BINDING_MISSING',
  }),
  Object.freeze({
    category: 'MEDIA',
    resourceType: 'ClaimedMediaStorage',
    fieldSetCode: 'claimed-media-provider-v1',
    blockerCode: 'CLAIMED_MEDIA_DELETE_ADAPTER_MISSING',
  }),
  Object.freeze({
    category: 'AI_DERIVED',
    resourceType: 'AiDerivedProviderData',
    fieldSetCode: 'ai-provider-propagation-v1',
    blockerCode: 'AI_PROVIDER_RECEIPTS_MISSING',
  }),
  Object.freeze({
    category: 'AUDIT',
    resourceType: 'UntypedJsonAndAuditMetadata',
    fieldSetCode: 'untyped-subject-index-v1',
    blockerCode: 'UNTYPED_SUBJECT_INDEX_MISSING',
  }),
  Object.freeze({
    category: 'AUDIT',
    resourceType: 'BackupRestoreReplay',
    fieldSetCode: 'backup-tombstone-replay-v1',
    blockerCode: 'BACKUP_TOMBSTONE_REPLAY_MISSING',
  }),
]);

const CATALOG_DESCRIPTOR = Object.freeze({
  version: PRIVACY_DISCOVERY_CATALOG_VERSION,
  subjectKind: 'WORKER_PERSON',
  records: DIRECT_RECORD_FAMILIES.map((entry) => ({
    family: entry.family,
    category: entry.category,
    resourceType: entry.resourceType,
    fieldSetCode: entry.fieldSetCode,
    coverage: entry.coverage,
    querySha256: sha256(entry.sql.replace(/\s+/g, ' ').trim()),
  })),
  blockers: MANDATORY_COVERAGE_BLOCKERS,
});

export const PRIVACY_DISCOVERY_CATALOG_SHA256 = sha256(JSON.stringify(CATALOG_DESCRIPTOR));

export function validatePrivacyDiscoveryKeyConfig({ key, keyId } = {}) {
  if (
    !Buffer.isBuffer(key)
    || key.byteLength < 32
    || key.byteLength > 64
    || typeof keyId !== 'string'
    || !CODE_PATTERN.test(keyId)
  ) {
    throw privacyError(
      'Privacy discovery fingerprinting is not configured.',
      'PRIVACY_DISCOVERY_UNAVAILABLE',
      503,
    );
  }
  return { key, keyId };
}

export function resolvePrivacyDiscoveryKeyConfig(environment = process.env) {
  const encoded = String(environment?.[PRIVACY_DISCOVERY_FINGERPRINT_SECRET_ENV] || '').trim();
  const keyId = String(environment?.[PRIVACY_DISCOVERY_FINGERPRINT_KEY_ID_ENV] || '').trim();
  if (!encoded || !BASE64URL_PATTERN.test(encoded)) {
    throw privacyError(
      'Privacy discovery fingerprinting is not configured.',
      'PRIVACY_DISCOVERY_UNAVAILABLE',
      503,
    );
  }
  let key;
  try {
    key = Buffer.from(encoded, 'base64url');
  } catch {
    key = Buffer.alloc(0);
  }
  if (key.toString('base64url') !== encoded) {
    throw privacyError(
      'Privacy discovery fingerprinting is not configured.',
      'PRIVACY_DISCOVERY_UNAVAILABLE',
      503,
    );
  }
  return validatePrivacyDiscoveryKeyConfig({ key, keyId });
}

export function privacyOperationKeyHash(organizationId, idempotencyKey) {
  return sha256(JSON.stringify({
    contract: 'obrasaas:data-subject-request-operation:v1',
    organizationId,
    idempotencyKey,
  }));
}

export function privacyRequestFingerprint({ organizationId, personId, requestType }) {
  return sha256(JSON.stringify({
    contract: 'obrasaas:data-subject-request:v1',
    organizationId,
    personId,
    requestType,
  }));
}

export function privacyAdminAttestationEvidenceSha256({
  organizationId,
  requestId,
  personId,
  requestType,
  actorMembershipId,
}) {
  return sha256(JSON.stringify({
    contract: 'obrasaas:tenant-admin-privacy-attestation:v1',
    organizationId,
    requestId,
    personId,
    requestType,
    actorMembershipId,
  }));
}

function recordItem({
  key,
  keyId,
  organizationId,
  requestId,
  manifestId,
  entry,
  record,
  ordinal,
  observedAt,
}) {
  const id = String(record?.id || '').trim();
  const recordVersion = String(record?.recordVersion || '').trim();
  if (!id || !recordVersion) {
    throw privacyError(
      'Privacy discovery returned an invalid source record.',
      'PRIVACY_DISCOVERY_STATE_INVALID',
      500,
    );
  }
  const locatorFingerprintHmac = hmac(
    key,
    `obrasaas:privacy-resource-locator:v1\0${organizationId}\0${entry.resourceType}\0${id}`,
  );
  const recordFingerprintHmac = hmac(
    key,
    `obrasaas:privacy-resource-record:v1\0${organizationId}\0${entry.resourceType}\0${id}\0${recordVersion}`,
  );
  return {
    id: `pri_${hmac(key, `item\0${requestId}\0${entry.resourceType}\0${id}`).slice(0, 40)}`,
    organizationId,
    requestId,
    manifestId,
    ordinal,
    kind: 'RECORD',
    category: entry.category,
    sourceSystem: 'postgresql',
    resourceType: entry.resourceType,
    fieldSetCode: entry.fieldSetCode,
    fingerprintKeyId: keyId,
    locatorFingerprintHmac,
    recordFingerprintHmac,
    disposition: 'REVIEW_REQUIRED',
    retentionPolicyVersion: null,
    retentionBasisCode: null,
    retentionUntil: null,
    blockerCode: 'LEGAL_CLASSIFICATION_REQUIRED',
    observedAt,
  };
}

function blockerItem({
  key,
  organizationId,
  requestId,
  manifestId,
  blocker,
  ordinal,
  observedAt,
}) {
  return {
    id: `pri_${hmac(key, `blocker\0${requestId}\0${blocker.resourceType}\0${blocker.blockerCode}`).slice(0, 40)}`,
    organizationId,
    requestId,
    manifestId,
    ordinal,
    kind: 'COVERAGE_BLOCKER',
    category: blocker.category,
    sourceSystem: 'control-plane',
    resourceType: blocker.resourceType,
    fieldSetCode: blocker.fieldSetCode,
    fingerprintKeyId: null,
    locatorFingerprintHmac: null,
    recordFingerprintHmac: null,
    disposition: 'REVIEW_REQUIRED',
    retentionPolicyVersion: null,
    retentionBasisCode: null,
    retentionUntil: null,
    blockerCode: blocker.blockerCode,
    observedAt,
  };
}

function canonicalItem(item) {
  return [
    item.id,
    item.ordinal,
    item.kind,
    item.category,
    item.sourceSystem,
    item.resourceType,
    item.fieldSetCode,
    item.fingerprintKeyId,
    item.locatorFingerprintHmac,
    item.recordFingerprintHmac,
    item.disposition,
    item.retentionPolicyVersion,
    item.retentionBasisCode,
    item.retentionUntil ? utcTimestamp(item.retentionUntil) : null,
    item.blockerCode,
    utcTimestamp(item.observedAt),
  ].map(lengthPrefix).join('|');
}

export function dataSubjectManifestSha256(manifest, items) {
  const ordered = [...items].sort((left, right) => left.ordinal - right.ordinal);
  const itemCommitment = ordered.map(canonicalItem).join('');
  const canonical = [
    'obrasaas:data-subject-discovery-manifest:v1',
    manifest.id,
    manifest.organizationId,
    manifest.requestId,
    manifest.schemaVersion,
    manifest.catalogVersion,
    manifest.catalogSha256,
    utcTimestamp(manifest.sourceSnapshotAt),
    manifest.outcome,
    manifest.itemCount,
    manifest.blockerCount,
    manifest.operationKeyHash,
    manifest.requestFingerprint,
    manifest.sealedByMembershipId,
    itemCommitment,
  ].map(lengthPrefix).join('|');
  return sha256(canonical);
}

export function buildWorkerPersonDiscoveryManifest({
  organizationId,
  requestId,
  requestOperationKeyHash,
  requestFingerprint,
  sealedByMembershipId,
  sourceSnapshotAt,
  rowsByFamily,
  key,
  keyId,
  extraBlockers = [],
}) {
  validatePrivacyDiscoveryKeyConfig({ key, keyId });
  for (const value of [organizationId, requestId, requestOperationKeyHash, requestFingerprint, sealedByMembershipId]) {
    if (typeof value !== 'string' || !value.trim()) {
      throw privacyError(
        'Privacy discovery received an invalid scope.',
        'PRIVACY_DISCOVERY_INPUT_INVALID',
        400,
      );
    }
  }
  if (!HASH_PATTERN.test(requestOperationKeyHash) || !HASH_PATTERN.test(requestFingerprint)) {
    throw privacyError(
      'Privacy discovery received an invalid request commitment.',
      'PRIVACY_DISCOVERY_STATE_INVALID',
      500,
    );
  }

  const observedAt = new Date(utcTimestamp(sourceSnapshotAt));
  const manifestId = `prm_${hmac(key, `manifest\0${organizationId}\0${requestId}`).slice(0, 40)}`;
  const items = [];
  for (const entry of DIRECT_RECORD_FAMILIES) {
    const rows = rowsByFamily?.get?.(entry.family);
    if (!Array.isArray(rows)) {
      throw privacyError(
        'Privacy discovery did not return every catalog family.',
        'PRIVACY_DISCOVERY_STATE_INVALID',
        500,
      );
    }
    for (const record of rows) {
      items.push(recordItem({
        key,
        keyId,
        organizationId,
        requestId,
        manifestId,
        entry,
        record,
        ordinal: items.length,
        observedAt,
      }));
    }
  }
  for (const blocker of [...MANDATORY_COVERAGE_BLOCKERS, ...extraBlockers]) {
    items.push(blockerItem({
      key,
      organizationId,
      requestId,
      manifestId,
      blocker,
      ordinal: items.length,
      observedAt,
    }));
  }
  if (items.length > PRIVACY_DISCOVERY_MANIFEST_ITEM_LIMIT) {
    throw privacyError(
      'Privacy discovery exceeded its bounded manifest size.',
      'PRIVACY_DISCOVERY_LIMIT_EXCEEDED',
      503,
    );
  }

  const blockerCount = items.filter((item) => item.blockerCode || item.disposition === 'REVIEW_REQUIRED').length;
  const manifest = {
    id: manifestId,
    organizationId,
    requestId,
    outcome: blockerCount === 0 ? 'COMPLETE' : 'BLOCKED',
    schemaVersion: 1,
    catalogVersion: PRIVACY_DISCOVERY_CATALOG_VERSION,
    catalogSha256: PRIVACY_DISCOVERY_CATALOG_SHA256,
    sourceSnapshotAt: observedAt,
    itemCount: items.length,
    blockerCount,
    operationKeyHash: requestOperationKeyHash,
    requestFingerprint,
    sealedByMembershipId,
  };
  return {
    manifest: {
      ...manifest,
      manifestSha256: dataSubjectManifestSha256(manifest, items),
    },
    items,
  };
}

export async function discoverWorkerPersonData(
  transaction,
  {
    organizationId,
    personId,
    requestId,
    requestOperationKeyHash,
    requestFingerprint,
    sealedByMembershipId,
    key,
    keyId,
    familyLimit = PRIVACY_DISCOVERY_FAMILY_LIMIT,
  },
) {
  if (
    typeof transaction?.$executeRawUnsafe !== 'function'
    || typeof transaction?.$queryRawUnsafe !== 'function'
  ) {
    throw privacyError(
      'Privacy discovery persistence is unavailable.',
      'PRIVACY_DISCOVERY_UNAVAILABLE',
      503,
    );
  }
  if (!Number.isSafeInteger(familyLimit) || familyLimit < 1 || familyLimit > PRIVACY_DISCOVERY_FAMILY_LIMIT) {
    throw privacyError(
      'Privacy discovery family limit is invalid.',
      'PRIVACY_DISCOVERY_INPUT_INVALID',
      400,
    );
  }

  await transaction.$executeRawUnsafe('SET TRANSACTION READ ONLY');
  const clockRows = await transaction.$queryRawUnsafe(
    'SELECT statement_timestamp() AS "observedAt"',
  );
  const sourceSnapshotAt = clockRows?.[0]?.observedAt;
  const rowsByFamily = new Map();
  const extraBlockers = [];
  for (const entry of DIRECT_RECORD_FAMILIES) {
    const rows = await transaction.$queryRawUnsafe(
      entry.sql,
      organizationId,
      personId,
      familyLimit + 1,
    );
    if (!Array.isArray(rows)) {
      throw privacyError(
        'Privacy discovery returned an invalid database result.',
        'PRIVACY_DISCOVERY_STATE_INVALID',
        500,
      );
    }
    if (rows.length > familyLimit) {
      extraBlockers.push({
        category: entry.category,
        resourceType: entry.resourceType,
        fieldSetCode: 'bounded-family-overflow-v1',
        blockerCode: 'DISCOVERY_FAMILY_LIMIT_EXCEEDED',
      });
    }
    rowsByFamily.set(entry.family, rows.slice(0, familyLimit));
    if (entry.coverage !== 'SUPPORTED') {
      extraBlockers.push({
        category: entry.category,
        resourceType: entry.resourceType,
        fieldSetCode: entry.fieldSetCode,
        blockerCode: `${entry.family.replaceAll('-', '_').toUpperCase()}_PARTIAL`,
      });
    }
  }

  return buildWorkerPersonDiscoveryManifest({
    organizationId,
    requestId,
    requestOperationKeyHash,
    requestFingerprint,
    sealedByMembershipId,
    sourceSnapshotAt,
    rowsByFamily,
    key,
    keyId,
    extraBlockers,
  });
}

export function privacyDiscoveryCatalogDescriptor() {
  return structuredClone(CATALOG_DESCRIPTOR);
}
