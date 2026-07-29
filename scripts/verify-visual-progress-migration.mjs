import { randomUUID } from 'node:crypto';

import pg from 'pg';

const CONNECTION_ENV = 'VISUAL_PROGRESS_MIGRATION_DATABASE_URL';
const SCHEMA_ENV = 'VISUAL_PROGRESS_MIGRATION_SCHEMA';
const AI_DISPATCH_MIGRATION_SCHEMA = 'public';
const connectionString = process.env[CONNECTION_ENV];
const SCHEMA_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_$]{0,62}$/;

if (!connectionString) {
  throw new Error(
    `${CONNECTION_ENV} is required; DATABASE_URL is intentionally ignored.`,
  );
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function parsePostgresUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${CONNECTION_ENV} must be a valid PostgreSQL URL.`);
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error(`${CONNECTION_ENV} must use PostgreSQL.`);
  }
  return parsed;
}

function resolveDatabaseSchema(value) {
  const parsed = parsePostgresUrl(value);
  const dsnSchemas = parsed.searchParams.getAll('schema');
  if (dsnSchemas.length > 1 && new Set(dsnSchemas).size > 1) {
    throw new Error(`${CONNECTION_ENV} contains conflicting schema parameters.`);
  }

  const dsnSchema = dsnSchemas[0] || null;
  const explicitSchema = process.env[SCHEMA_ENV] || null;
  if (explicitSchema && dsnSchema && explicitSchema !== dsnSchema) {
    throw new Error(
      `${SCHEMA_ENV} does not match the schema declared in the database URL.`,
    );
  }

  const schema = explicitSchema || dsnSchema;
  if (!schema) {
    throw new Error(
      `Declare ${SCHEMA_ENV} or add an explicit schema parameter to the database URL.`,
    );
  }
  if (!SCHEMA_IDENTIFIER_PATTERN.test(schema)) {
    throw new Error(
      'The visual progress migration schema must be a safe PostgreSQL identifier of at most 63 ASCII characters.',
    );
  }
  return schema;
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function hardenedVerifierConnectionString(value) {
  const parsed = parsePostgresUrl(value);
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  const isLocal = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname);

  if (hostname.endsWith('.neon.tech')) {
    parsed.searchParams.set('sslmode', 'verify-full');
  } else if (!isLocal && parsed.searchParams.get('sslmode') !== 'verify-full') {
    throw new Error(
      `${CONNECTION_ENV} must use sslmode=verify-full for a remote PostgreSQL host.`,
    );
  }
  return parsed.toString();
}

function sameValues(actual, expected) {
  return actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

function normalizeDefinition(value) {
  return String(value || '')
    .replace(/::(?:(?:"[^"]+")|[A-Za-z_][A-Za-z0-9_.$]*)(?:\[\])?/g, '')
    .replaceAll('"', '')
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePredicate(value) {
  return normalizeDefinition(value).replace(/\s+/g, '');
}

const databaseSchema = resolveDatabaseSchema(connectionString);
if (databaseSchema !== AI_DISPATCH_MIGRATION_SCHEMA) {
  throw new Error(
    `AI Dispatch Plan v1 is schema-qualified to ${AI_DISPATCH_MIGRATION_SCHEMA}; ${SCHEMA_ENV} must be ${AI_DISPATCH_MIGRATION_SCHEMA}.`,
  );
}
const verifierConnectionString = hardenedVerifierConnectionString(connectionString);

const EXPECTED_MIGRATIONS = Object.freeze([
  '20260726143000_visual_progress_assessments',
  '20260728080000_ai_dispatch_plan_persistence',
]);

const EXPECTED_ENUMS = Object.freeze({
  VisualProgressAssessmentStatus: [
    'PENDING',
    'RUNNING',
    'COMPLETED',
    'ABSTAINED',
    'FAILED',
  ],
  VisualProgressAssessmentReviewStatus: [
    'PENDING',
    'APPROVED',
    'CORRECTED',
    'REJECTED',
  ],
  AiDispatchBudgetReservationStatus: [
    'RESERVED',
    'SETTLED',
    'RELEASED',
  ],
  AiDispatchSettlementBasis: [
    'PRE_DISPATCH_RELEASE',
    'RESPONSE_USAGE',
    'RECONCILED_USAGE',
    'PROVIDER_BILLING',
    'CONFIRMED_NO_CHARGE',
  ],
});

const REQUIRED_TABLES = Object.freeze([
  'VisualProgressAssessment',
  'Project',
  'Task',
  'ProgressEvidence',
  'PlatformUser',
  'VisualProgressProviderResultReceipt',
  'AiDailyBudgetLedger',
  'AiDispatchBudgetReservation',
]);

const TEXT = Object.freeze({ nullable: 'NO', dataType: 'text', udtName: 'text' });
const NULLABLE_TEXT = Object.freeze({ nullable: 'YES', dataType: 'text', udtName: 'text' });
const INTEGER = Object.freeze({
  nullable: 'NO', dataType: 'integer', udtName: 'int4', numericPrecision: 32, numericScale: 0,
});
const NULLABLE_INTEGER = Object.freeze({
  nullable: 'YES', dataType: 'integer', udtName: 'int4', numericPrecision: 32, numericScale: 0,
});
const BIGINT = Object.freeze({
  nullable: 'NO', dataType: 'bigint', udtName: 'int8', numericPrecision: 64, numericScale: 0,
});
const NULLABLE_BIGINT = Object.freeze({
  nullable: 'YES', dataType: 'bigint', udtName: 'int8', numericPrecision: 64, numericScale: 0,
});
const NULLABLE_TIMESTAMP = Object.freeze({
  nullable: 'YES', dataType: 'timestamp without time zone', udtName: 'timestamp', datetimePrecision: 3,
});
const TIMESTAMP = Object.freeze({
  nullable: 'NO', dataType: 'timestamp without time zone', udtName: 'timestamp', datetimePrecision: 3,
});
const BOOLEAN = Object.freeze({ nullable: 'NO', dataType: 'boolean', udtName: 'bool' });
const JSONB = Object.freeze({ nullable: 'NO', dataType: 'jsonb', udtName: 'jsonb' });

const EXPECTED_COLUMNS = Object.freeze({
  id: TEXT,
  projectId: TEXT,
  taskId: TEXT,
  evidenceId: TEXT,
  operationKeyHash: {
    nullable: 'NO', dataType: 'character', udtName: 'bpchar', maxLength: 64,
  },
  requestFingerprint: {
    nullable: 'NO', dataType: 'character', udtName: 'bpchar', maxLength: 64,
  },
  provider: {
    nullable: 'NO', dataType: 'character varying', udtName: 'varchar', maxLength: 64,
  },
  providerModel: {
    nullable: 'NO', dataType: 'character varying', udtName: 'varchar', maxLength: 120,
  },
  registryModelId: {
    nullable: 'YES', dataType: 'character varying', udtName: 'varchar', maxLength: 190,
  },
  providerRoute: {
    nullable: 'YES', dataType: 'character varying', udtName: 'varchar', maxLength: 120,
  },
  routePolicyVersion: {
    nullable: 'YES', dataType: 'character varying', udtName: 'varchar', maxLength: 64,
  },
  routeReasonCode: {
    nullable: 'YES', dataType: 'character varying', udtName: 'varchar', maxLength: 64,
  },
  pricingVersion: {
    nullable: 'YES', dataType: 'character varying', udtName: 'varchar', maxLength: 64,
  },
  budgetCivilDayUtc: { nullable: 'YES', dataType: 'date', udtName: 'date' },
  budgetWorkload: {
    nullable: 'YES', dataType: 'character varying', udtName: 'varchar', maxLength: 64,
  },
  quotaPolicyVersion: {
    nullable: 'YES', dataType: 'character varying', udtName: 'varchar', maxLength: 64,
  },
  budgetLimitMicros: NULLABLE_BIGINT,
  budgetReservationMicros: NULLABLE_BIGINT,
  estimateBasis: {
    nullable: 'YES', dataType: 'character varying', udtName: 'varchar', maxLength: 64,
  },
  providerDispatchStartedAt: NULLABLE_TIMESTAMP,
  analyzerVersion: {
    nullable: 'NO', dataType: 'character varying', udtName: 'varchar', maxLength: 64,
  },
  inputSha256: {
    nullable: 'NO', dataType: 'character', udtName: 'bpchar', maxLength: 64,
  },
  baselineHash: {
    nullable: 'NO', dataType: 'character', udtName: 'bpchar', maxLength: 64,
  },
  taskRevisionAtRequest: INTEGER,
  evidenceRevisionAtRequest: INTEGER,
  status: {
    nullable: 'NO',
    dataType: 'USER-DEFINED',
    udtName: 'VisualProgressAssessmentStatus',
    defaultPattern: /'PENDING'/,
  },
  leaseExpiresAt: NULLABLE_TIMESTAMP,
  attemptCount: { ...INTEGER, defaultPattern: /^0$/ },
  summary: NULLABLE_TEXT,
  elementType: {
    nullable: 'YES', dataType: 'character varying', udtName: 'varchar', maxLength: 120,
  },
  progressMin: NULLABLE_INTEGER,
  progressMax: NULLABLE_INTEGER,
  confidence: {
    nullable: 'YES', dataType: 'numeric', udtName: 'numeric', numericPrecision: 5, numericScale: 4,
  },
  quality: { nullable: 'YES', dataType: 'jsonb', udtName: 'jsonb' },
  observations: { nullable: 'YES', dataType: 'jsonb', udtName: 'jsonb' },
  limitations: { nullable: 'YES', dataType: 'jsonb', udtName: 'jsonb' },
  providerResponseId: {
    nullable: 'YES', dataType: 'character varying', udtName: 'varchar', maxLength: 190,
  },
  providerRequestId: {
    nullable: 'YES', dataType: 'character varying', udtName: 'varchar', maxLength: 190,
  },
  inputTokens: NULLABLE_INTEGER,
  outputTokens: NULLABLE_INTEGER,
  totalTokens: NULLABLE_INTEGER,
  cachedInputTokens: NULLABLE_INTEGER,
  estimatedCostMicros: NULLABLE_BIGINT,
  actualCostMicros: NULLABLE_BIGINT,
  failureCode: {
    nullable: 'YES', dataType: 'character varying', udtName: 'varchar', maxLength: 64,
  },
  completedAt: NULLABLE_TIMESTAMP,
  requestedById: NULLABLE_TEXT,
  reviewStatus: {
    nullable: 'YES', dataType: 'USER-DEFINED', udtName: 'VisualProgressAssessmentReviewStatus',
  },
  reviewedById: NULLABLE_TEXT,
  reviewedAt: NULLABLE_TIMESTAMP,
  reviewNote: NULLABLE_TEXT,
  correctedProgressMin: NULLABLE_INTEGER,
  correctedProgressMax: NULLABLE_INTEGER,
  revision: { ...INTEGER, defaultPattern: /^0$/ },
  createdAt: { ...TIMESTAMP, defaultPattern: /^CURRENT_TIMESTAMP$/i },
  updatedAt: TIMESTAMP,
});

const EXPECTED_CHECKS = Object.freeze({
  VisualProgressAssessment_hashes_check: [
    'operationKeyHash',
    'requestFingerprint',
    'inputSha256',
    'baselineHash',
    '^[0-9a-f]{64}$',
  ],
  VisualProgressAssessment_versions_check: [
    'taskRevisionAtRequest >= 0',
    'evidenceRevisionAtRequest >= 0',
    'attemptCount >= 0',
    'revision >= 0',
  ],
  VisualProgressAssessment_lease_state_check: [
    "status = 'PENDING'",
    'leaseExpiresAt IS NULL',
    'attemptCount = 0',
    "status = 'RUNNING'",
    'leaseExpiresAt IS NOT NULL',
    'leaseExpiresAt >= createdAt',
    'attemptCount >= 1',
    "status = ANY ARRAY['COMPLETED', 'ABSTAINED', 'FAILED']",
  ],
  VisualProgressAssessment_provider_identity_check: [
    'provider',
    'providerModel',
    'analyzerVersion',
    'providerResponseId',
  ],
  VisualProgressAssessment_dispatch_audit_check: [
    'num_nonnulls',
    'registryModelId',
    'providerRoute',
    'providerRoute IS NOT NULL',
    'routePolicyVersion',
    'routeReasonCode',
    '^[a-z][a-z0-9_]{0,63}$',
    'pricingVersion',
    'budgetCivilDayUtc',
    'budgetWorkload',
    'quotaPolicyVersion',
    'budgetLimitMicros > 0',
    'budgetReservationMicros >= 0',
    'budgetReservationMicros <= budgetLimitMicros',
    'estimateBasis',
    'providerDispatchStartedAt >= createdAt',
    'providerRequestId',
    'num_nonnulls',
    'inputTokens IS NOT NULL',
    'inputTokens >= 0',
    'outputTokens IS NOT NULL',
    'outputTokens >= 0',
    'totalTokens IS NOT NULL',
    'totalTokens >= 0',
    'cachedInputTokens >= 0',
    'cachedInputTokens <= inputTokens',
    'estimatedCostMicros IS NOT NULL',
    'estimatedCostMicros >= 0',
    'actualCostMicros >= 0',
  ],
  VisualProgressAssessment_element_type_check: ['elementType'],
  VisualProgressAssessment_progress_range_check: [
    'progressMin >= 0',
    'progressMin <= 100',
    'progressMax >= 0',
    'progressMax <= 100',
    'progressMin <= progressMax',
  ],
  VisualProgressAssessment_confidence_check: ['confidence >= 0', 'confidence <= 1'],
  VisualProgressAssessment_json_shape_check: [
    "jsonb_typeofquality = 'object'",
    "jsonb_typeofobservations = 'array'",
    "jsonb_typeoflimitations = 'array'",
  ],
  VisualProgressAssessment_failure_code_check: [
    'failureCode',
    '^[A-Z][A-Z0-9_]{0,63}$',
  ],
  VisualProgressAssessment_result_state_check: [
    "status = ANY ARRAY['PENDING', 'RUNNING']",
    "status = 'COMPLETED'",
    "status = 'ABSTAINED'",
    'jsonb_array_lengthlimitations > 0',
    "status = 'FAILED'",
    'failureCode IS NOT NULL',
    'completedAt IS NOT NULL',
  ],
  VisualProgressAssessment_review_state_check: [
    "status = ANY ARRAY['PENDING', 'RUNNING', 'FAILED']",
    "reviewStatus = 'PENDING'",
    "reviewStatus = 'APPROVED'",
    "reviewStatus = 'CORRECTED'",
    'correctedProgressMin >= 0',
    'correctedProgressMin <= 100',
    'correctedProgressMax >= 0',
    'correctedProgressMax <= 100',
    'correctedProgressMin <= correctedProgressMax',
    "reviewStatus = 'REJECTED'",
  ],
  VisualProgressAssessment_timestamps_check: [
    'completedAt >= createdAt',
    'reviewedAt >= completedAt',
  ],
});

const OPEN_PREDICATE = normalizePredicate(`
  "status" = ANY (ARRAY['PENDING', 'RUNNING'])
  OR (
    "status" = ANY (ARRAY['COMPLETED', 'ABSTAINED'])
    AND "reviewStatus" = 'PENDING'
  )
`);

const UNSETTLED_DISPATCH_PREDICATE = normalizePredicate(`
  "registryModelId" IS NOT NULL AND "actualCostMicros" IS NULL
`);

const EXPECTED_INDEXES = Object.freeze({
  VisualProgressAssessment_pkey: {
    columns: ['id'], unique: true, primary: true,
  },
  VisualProgressAssessment_projectId_id_key: {
    columns: ['projectId', 'id'], unique: true,
  },
  VisualProgressAssessment_project_operation_key: {
    columns: ['projectId', 'operationKeyHash'], unique: true,
  },
  VPA_project_evidence_open_key: {
    columns: ['projectId', 'evidenceId'], unique: true, predicate: OPEN_PREDICATE,
  },
  VisualProgressAssessment_project_fingerprint_idx: {
    columns: ['projectId', 'requestFingerprint'], unique: false,
  },
  VPA_project_registry_created_idx: {
    columns: ['projectId', 'registryModelId', 'createdAt'], unique: false,
  },
  VPA_project_evidence_unsettled_dispatch_key: {
    columns: ['projectId', 'evidenceId'],
    unique: true,
    predicate: UNSETTLED_DISPATCH_PREDICATE,
  },
  VPA_project_status_lease_idx: {
    columns: ['projectId', 'status', 'leaseExpiresAt'], unique: false,
  },
  VPA_project_task_status_created_idx: {
    columns: ['projectId', 'taskId', 'status', 'createdAt'], unique: false,
  },
  VPA_project_evidence_created_idx: {
    columns: ['projectId', 'evidenceId', 'createdAt'], unique: false,
  },
  VPA_project_review_created_idx: {
    columns: ['projectId', 'reviewStatus', 'createdAt'], unique: false,
  },
  VPA_requester_created_idx: {
    columns: ['requestedById', 'createdAt'], unique: false,
  },
  VPA_reviewer_reviewed_idx: {
    columns: ['reviewedById', 'reviewedAt'], unique: false,
  },
});

const EXPECTED_FOREIGN_KEYS = Object.freeze({
  VisualProgressAssessment_projectId_fkey: {
    target: 'Project',
    columns: ['projectId'],
    targetColumns: ['id'],
    deleteAction: 'c',
  },
  VisualProgressAssessment_project_task_fkey: {
    target: 'Task',
    columns: ['projectId', 'taskId'],
    targetColumns: ['projectId', 'id'],
    deleteAction: 'r',
  },
  VisualProgressAssessment_project_evidence_fkey: {
    target: 'ProgressEvidence',
    columns: ['projectId', 'evidenceId'],
    targetColumns: ['projectId', 'id'],
    deleteAction: 'r',
  },
  VisualProgressAssessment_requestedById_fkey: {
    target: 'PlatformUser',
    columns: ['requestedById'],
    targetColumns: ['id'],
    deleteAction: 'r',
  },
  VisualProgressAssessment_reviewedById_fkey: {
    target: 'PlatformUser',
    columns: ['reviewedById'],
    targetColumns: ['id'],
    deleteAction: 'r',
  },
});

const EXPECTED_RECEIPT_COLUMNS = Object.freeze({
  assessmentId: TEXT,
  organizationId: TEXT,
  projectId: TEXT,
  schemaVersion: INTEGER,
  receiptSha256: {
    nullable: 'NO', dataType: 'character', udtName: 'bpchar', maxLength: 64,
  },
  providerRequestId: {
    nullable: 'YES', dataType: 'character varying', udtName: 'varchar', maxLength: 190,
  },
  providerResponseId: {
    nullable: 'YES', dataType: 'character varying', udtName: 'varchar', maxLength: 190,
  },
  inputSha256: {
    nullable: 'NO', dataType: 'character', udtName: 'bpchar', maxLength: 64,
  },
  submittedSha256: {
    nullable: 'NO', dataType: 'character', udtName: 'bpchar', maxLength: 64,
  },
  width: INTEGER,
  height: INTEGER,
  abstained: BOOLEAN,
  abstentionReason: {
    nullable: 'YES', dataType: 'character varying', udtName: 'varchar', maxLength: 64,
  },
  summary: TEXT,
  elementType: {
    nullable: 'YES', dataType: 'character varying', udtName: 'varchar', maxLength: 120,
  },
  progressMin: NULLABLE_INTEGER,
  progressMax: NULLABLE_INTEGER,
  confidence: {
    nullable: 'NO', dataType: 'numeric', udtName: 'numeric', numericPrecision: 5, numericScale: 4,
  },
  quality: JSONB,
  observations: JSONB,
  limitations: JSONB,
  inputTokens: NULLABLE_INTEGER,
  outputTokens: NULLABLE_INTEGER,
  totalTokens: NULLABLE_INTEGER,
  cachedInputTokens: NULLABLE_INTEGER,
  cacheWriteTokens: NULLABLE_INTEGER,
  receivedAt: { ...TIMESTAMP, defaultPattern: /^CURRENT_TIMESTAMP$/i },
  appliedAt: NULLABLE_TIMESTAMP,
  revision: { ...INTEGER, defaultPattern: /^0$/ },
});

const EXPECTED_RECEIPT_CHECKS = Object.freeze({
  VPRR_identity_check: [
    'schemaVersion = 1',
    'receiptSha256',
    '^[0-9a-f]{64}$',
    'inputSha256',
    'submittedSha256',
    'providerRequestId',
    'providerResponseId',
  ],
  VPRR_dimensions_check: [
    'width >= 32',
    'width <= 12000',
    'height >= 32',
    'height <= 12000',
    'width * height <= 50000000',
  ],
  VPRR_result_check: [
    'summary',
    'confidence >= 0',
    'confidence <= 1',
    'abstained',
    'abstentionReason',
    'image_quality',
    'progressMin IS NULL',
    'progressMax IS NULL',
    'NOT abstained',
    'progressMin >= 0',
    'progressMax <= 100',
  ],
  VPRR_json_shape_check: [
    'jsonb_typeof',
    'quality',
    'observations',
    'limitations',
    'jsonb_array_length',
  ],
  VPRR_usage_check: [
    'num_nonnulls',
    'inputTokens',
    'outputTokens',
    'totalTokens',
    'cachedInputTokens',
    'cacheWriteTokens',
    'cacheWriteTokens = 0',
    'cachedInputTokens + cacheWriteTokens <= inputTokens',
    'totalTokens = inputTokens + outputTokens',
  ],
  VPRR_lifecycle_check: [
    'appliedAt IS NULL',
    'revision = 0',
    'appliedAt IS NOT NULL',
    'appliedAt >= receivedAt',
    'revision = 1',
  ],
});

const RECEIPT_PENDING_PREDICATE = normalizePredicate('"appliedAt" IS NULL');

const EXPECTED_RECEIPT_INDEXES = Object.freeze({
  VisualProgressProviderResultReceipt_pkey: {
    columns: ['assessmentId'], unique: true, primary: true,
  },
  VPRR_project_assessment_key: {
    columns: ['projectId', 'assessmentId'], unique: true,
  },
  VPRR_org_receipt_sha_key: {
    columns: ['organizationId', 'receiptSha256'], unique: true,
  },
  VPRR_org_received_idx: {
    columns: ['organizationId', 'receivedAt'], unique: false,
  },
  VPRR_project_received_idx: {
    columns: ['projectId', 'receivedAt'], unique: false,
  },
  VPRR_project_pending_received_idx: {
    columns: ['projectId', 'receivedAt'], unique: false, predicate: RECEIPT_PENDING_PREDICATE,
  },
});

const EXPECTED_RECEIPT_FOREIGN_KEYS = Object.freeze({
  VPRR_project_scope_fkey: {
    target: 'Project',
    columns: ['organizationId', 'projectId'],
    targetColumns: ['organizationId', 'id'],
    deleteAction: 'c',
  },
  VPRR_assessment_scope_fkey: {
    target: 'VisualProgressAssessment',
    columns: ['projectId', 'assessmentId'],
    targetColumns: ['projectId', 'id'],
    deleteAction: 'c',
  },
});

const EXPECTED_LEDGER_COLUMNS = Object.freeze({
  organizationId: TEXT,
  civilDayUtc: { nullable: 'NO', dataType: 'date', udtName: 'date' },
  workload: {
    nullable: 'NO', dataType: 'character varying', udtName: 'varchar', maxLength: 64,
  },
  quotaPolicyVersion: {
    nullable: 'NO', dataType: 'character varying', udtName: 'varchar', maxLength: 64,
  },
  budgetLimitMicros: BIGINT,
  reservedMicros: { ...BIGINT, defaultPattern: /^(?:0|0::bigint|'0'::bigint)$/ },
  settledMicros: { ...BIGINT, defaultPattern: /^(?:0|0::bigint|'0'::bigint)$/ },
  requestCount: { ...BIGINT, defaultPattern: /^(?:0|0::bigint|'0'::bigint)$/ },
  revision: { ...INTEGER, defaultPattern: /^0$/ },
  createdAt: { ...TIMESTAMP, defaultPattern: /^CURRENT_TIMESTAMP$/i },
  updatedAt: TIMESTAMP,
});

const EXPECTED_LEDGER_CHECKS = Object.freeze({
  AiDailyBudgetLedger_identity_check: [
    'workload',
    '^[a-z][a-z0-9_-]{0,63}$',
    'quotaPolicyVersion',
    '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$',
  ],
  AiDailyBudgetLedger_counters_check: [
    'budgetLimitMicros > 0',
    'reservedMicros >= 0',
    'settledMicros >= 0',
    'requestCount >= 0',
    'revision >= 0',
  ],
  AiDailyBudgetLedger_timestamps_check: [
    'updatedAt >= createdAt',
  ],
});

const EXPECTED_LEDGER_INDEXES = Object.freeze({
  AiDailyBudgetLedger_pkey: {
    columns: ['organizationId', 'civilDayUtc', 'workload'], unique: true, primary: true,
  },
  AiDailyBudgetLedger_day_workload_idx: {
    columns: ['civilDayUtc', 'workload'], unique: false,
  },
  AiDailyBudgetLedger_org_updated_idx: {
    columns: ['organizationId', 'updatedAt'], unique: false,
  },
});

const EXPECTED_RESERVATION_COLUMNS = Object.freeze({
  assessmentId: TEXT,
  organizationId: TEXT,
  projectId: TEXT,
  civilDayUtc: { nullable: 'NO', dataType: 'date', udtName: 'date' },
  workload: {
    nullable: 'NO', dataType: 'character varying', udtName: 'varchar', maxLength: 64,
  },
  quotaPolicyVersion: {
    nullable: 'NO', dataType: 'character varying', udtName: 'varchar', maxLength: 64,
  },
  budgetLimitMicros: BIGINT,
  reservedMicros: BIGINT,
  actualMicros: NULLABLE_BIGINT,
  status: {
    nullable: 'NO',
    dataType: 'USER-DEFINED',
    udtName: 'AiDispatchBudgetReservationStatus',
    defaultPattern: /'RESERVED'/,
  },
  settlementBasis: {
    nullable: 'YES', dataType: 'USER-DEFINED', udtName: 'AiDispatchSettlementBasis',
  },
  settlementOperationKeyHash: {
    nullable: 'YES', dataType: 'character', udtName: 'bpchar', maxLength: 64,
  },
  settlementEvidenceSha256: {
    nullable: 'YES', dataType: 'character', udtName: 'bpchar', maxLength: 64,
  },
  settledById: NULLABLE_TEXT,
  reservedAt: { ...TIMESTAMP, defaultPattern: /^CURRENT_TIMESTAMP$/i },
  settledAt: NULLABLE_TIMESTAMP,
  revision: { ...INTEGER, defaultPattern: /^0$/ },
  createdAt: { ...TIMESTAMP, defaultPattern: /^CURRENT_TIMESTAMP$/i },
  updatedAt: TIMESTAMP,
});

const EXPECTED_RESERVATION_CHECKS = Object.freeze({
  AiDispatchBudgetReservation_identity_check: [
    'workload',
    'quotaPolicyVersion',
    'budgetLimitMicros > 0',
    'reservedMicros >= 0',
    'reservedMicros <= budgetLimitMicros',
    'actualMicros >= 0',
    'settlementOperationKeyHash',
    'settlementEvidenceSha256',
    '^[0-9a-f]{64}$',
    'settledById',
    'revision >= 0',
  ],
  AiDispatchBudgetReservation_state_check: [
    "status = 'RESERVED'",
    'actualMicros IS NULL',
    'settlementBasis IS NULL',
    'settlementOperationKeyHash IS NULL',
    'settlementEvidenceSha256 IS NULL',
    'settledById IS NULL',
    'settledAt IS NULL',
    'revision = 0',
    "status = 'SETTLED'",
    'actualMicros IS NOT NULL',
    'RESPONSE_USAGE',
    'PROVIDER_BILLING',
    'CONFIRMED_NO_CHARGE',
    'settlementOperationKeyHash IS NOT NULL',
    'settlementEvidenceSha256 IS NOT NULL',
    'settledAt IS NOT NULL',
    'revision = 1',
    "status = 'RELEASED'",
    'actualMicros = 0',
    "settlementBasis = 'PRE_DISPATCH_RELEASE'",
  ],
  AiDispatchBudgetReservation_timestamps_check: [
    'reservedAt >= createdAt',
    'updatedAt >= createdAt',
    'settledAt >= reservedAt',
  ],
});

const EXPECTED_RESERVATION_INDEXES = Object.freeze({
  AiDispatchBudgetReservation_pkey: {
    columns: ['assessmentId'], unique: true, primary: true,
  },
  AiDispatchBudgetReservation_project_assessment_key: {
    columns: ['projectId', 'assessmentId'], unique: true,
  },
  AiDispatchBudgetReservation_org_settlement_operation_key: {
    columns: ['organizationId', 'settlementOperationKeyHash'], unique: true,
  },
  AiDispatchBudgetReservation_ledger_status_idx: {
    columns: ['organizationId', 'civilDayUtc', 'workload', 'status'], unique: false,
  },
  AiDispatchBudgetReservation_org_status_updated_idx: {
    columns: ['organizationId', 'status', 'updatedAt'], unique: false,
  },
  AiDispatchBudgetReservation_settled_by_idx: {
    columns: ['settledById', 'settledAt'], unique: false,
  },
});

const EXPECTED_RESERVATION_FOREIGN_KEYS = Object.freeze({
  AiDispatchBudgetReservation_project_scope_fkey: {
    target: 'Project',
    columns: ['organizationId', 'projectId'],
    targetColumns: ['organizationId', 'id'],
    deleteAction: 'c',
  },
  AiDispatchBudgetReservation_assessment_scope_fkey: {
    target: 'VisualProgressAssessment',
    columns: ['projectId', 'assessmentId'],
    targetColumns: ['projectId', 'id'],
    deleteAction: 'c',
  },
  AiDispatchBudgetReservation_daily_ledger_fkey: {
    target: 'AiDailyBudgetLedger',
    columns: ['organizationId', 'civilDayUtc', 'workload'],
    targetColumns: ['organizationId', 'civilDayUtc', 'workload'],
    deleteAction: 'a',
  },
  AiDispatchBudgetReservation_settledById_fkey: {
    target: 'PlatformUser',
    columns: ['settledById'],
    targetColumns: ['id'],
    deleteAction: 'r',
  },
});

const EXPECTED_BUDGET_FUNCTIONS = Object.freeze({
  obrasaas_ai_daily_budget_reserve: [
    'p_assessment_id',
    'pg_advisory_xact_lock',
    'hashtextextended',
    'ai-daily-budget:',
    'AiDispatchBudgetReservation',
    'AiDispatchBudgetReservation_replay_mismatch',
    'AiDispatchBudgetReservation_started_without_reservation',
    'on conflict on constraint AiDailyBudgetLedger_pkey do update',
    'ledger.settledMicros <= ledger.budgetLimitMicros - p_reserve_micros',
    'obrasaas.ai_budget_ledger_action',
    'obrasaas.ai_reservation_insert_assessment',
    'AiDailyBudgetLedger_budget_exceeded',
  ],
  obrasaas_ai_daily_budget_settle: [
    'p_assessment_id',
    'pg_advisory_xact_lock',
    'hashtextextended',
    'ai-daily-budget:',
    'AiDispatchBudgetReservation_settlement_replay_mismatch',
    'AiDispatchBudgetReservation_pre_dispatch_release_guard',
    'AiDispatchBudgetReservation_response_receipt_guard',
    'AiDispatchBudgetReservation_manual_receipt_guard',
    'AiDispatchBudgetReservation_unsupported_settlement_basis',
    'AiDispatchBudgetReservation_settlement_actor_guard',
    "actor.systemRole = 'SUPERADMIN'",
    'for share of actor',
    'settlementBasis = p_settlement_basis',
    'settlementOperationKeyHash = p_settlement_operation_key_hash',
    'settlementEvidenceSha256 = p_settlement_evidence_sha256',
    'settledById = p_settled_by_id',
    'VisualProgressProviderResultReceipt',
    'reservedMicros - existing_reservation.reservedMicros',
    'settledMicros + p_actual_micros',
    'actualCostMicros = p_actual_micros',
    'obrasaas.ai_settlement_assessment',
    'set_config',
    'AiDispatchBudgetReservation_settlement_guard',
  ],
});

const DISPATCH_AUDIT_TRIGGER = 'VisualProgressAssessment_ai_dispatch_write_once';
const DISPATCH_AUDIT_FUNCTION = 'obrasaas_ai_dispatch_audit_write_once';
const EXPECTED_PERSISTENCE_TRIGGERS = Object.freeze({
  AiDailyBudgetLedger_write_guard: {
    table: 'AiDailyBudgetLedger',
    functionName: 'obrasaas_ai_budget_ledger_write_guard',
    triggerFragments: ['before insert or update'],
    functionFragments: [
      'obrasaas.ai_budget_ledger_key',
      'obrasaas.ai_budget_ledger_action',
      'AiDailyBudgetLedger_transition_guard',
      'old.reservedMicros + marker_reserved_delta',
      'old.settledMicros + marker_settled_delta',
    ],
    deferrable: false,
    initiallyDeferred: false,
  },
  AiDailyBudgetLedger_organization_retention: {
    table: 'AiDailyBudgetLedger',
    functionName: 'obrasaas_ai_budget_ledger_retention',
    triggerFragments: ['after delete'],
    functionFragments: ['AiDailyBudgetLedger_organization_retention_guard'],
    deferrable: true,
    initiallyDeferred: true,
  },
  VPRR_write_once: {
    table: 'VisualProgressProviderResultReceipt',
    functionName: 'obrasaas_visual_progress_receipt_write_once',
    triggerFragments: ['before insert or update'],
    functionFragments: [
      'VPRR_json_items_check',
      'VPRR_assessment_dispatch_guard',
      'VPRR_reservation_guard',
      'VPRR_content_immutable',
      'VPRR_applied_immutable',
      'VPRR_projection_guard',
      'VPRR_settlement_projection_guard',
    ],
    deferrable: false,
    initiallyDeferred: false,
  },
  VPRR_assessment_retention: {
    table: 'VisualProgressProviderResultReceipt',
    functionName: 'obrasaas_visual_progress_receipt_retention',
    triggerFragments: ['after delete'],
    functionFragments: ['VPRR_assessment_retention_guard', 'Organization'],
    deferrable: true,
    initiallyDeferred: true,
  },
  AiDispatchBudgetReservation_write_once: {
    table: 'AiDispatchBudgetReservation',
    functionName: 'obrasaas_ai_budget_reservation_write_once',
    triggerFragments: ['before insert or update'],
    functionFragments: [
      'AiDispatchBudgetReservation_insert_guard',
      'obrasaas.ai_reservation_insert_assessment',
      'AiDispatchBudgetReservation_identity_immutable',
      'AiDispatchBudgetReservation_terminal_immutable',
      'AiDispatchBudgetReservation_transition_guard',
      'obrasaas.ai_settlement_assessment',
    ],
    deferrable: false,
    initiallyDeferred: false,
  },
  AiDispatchBudgetReservation_assessment_retention: {
    table: 'AiDispatchBudgetReservation',
    functionName: 'obrasaas_ai_budget_reservation_retention',
    triggerFragments: ['after delete'],
    functionFragments: [
      'AiDispatchBudgetReservation_assessment_retention_guard',
      'Organization',
    ],
    deferrable: true,
    initiallyDeferred: true,
  },
  VisualProgressAssessment_budget_reservation_required: {
    table: 'VisualProgressAssessment',
    functionName: 'obrasaas_ai_assessment_budget_reservation_required',
    triggerFragments: ['after insert or update'],
    functionFragments: [
      'VisualProgressAssessment_budget_reservation_required',
      'AiDispatchBudgetReservation',
      'AiDailyBudgetLedger',
      'actualCostMicros',
    ],
    deferrable: true,
    initiallyDeferred: true,
  },
});

async function assertMigrations(client) {
  const result = await client.query(
    `SELECT "migration_name"
       FROM "_prisma_migrations"
      WHERE "migration_name" = ANY($1::text[])
        AND "finished_at" IS NOT NULL
        AND "rolled_back_at" IS NULL`,
    [EXPECTED_MIGRATIONS],
  );
  const applied = new Set(result.rows.map((row) => row.migration_name));
  const missing = EXPECTED_MIGRATIONS.filter((name) => !applied.has(name));
  invariant(
    missing.length === 0,
    `Missing visual progress migrations: ${missing.join(', ')}.`,
  );
}

async function assertTables(client) {
  const result = await client.query(
    `SELECT tablename
       FROM pg_tables
      WHERE schemaname = current_schema()
        AND tablename = ANY($1::text[])`,
    [REQUIRED_TABLES],
  );
  const found = new Set(result.rows.map((row) => row.tablename));
  const missing = REQUIRED_TABLES.filter((name) => !found.has(name));
  invariant(missing.length === 0, `Missing visual progress tables: ${missing.join(', ')}.`);
}

async function assertEnums(client) {
  const result = await client.query(
    `SELECT type_record.typname,
            array_agg(enum_record.enumlabel::text ORDER BY enum_record.enumsortorder) AS labels
       FROM pg_type AS type_record
       JOIN pg_enum AS enum_record ON enum_record.enumtypid = type_record.oid
       JOIN pg_namespace AS namespace_record ON namespace_record.oid = type_record.typnamespace
      WHERE namespace_record.nspname = current_schema()
        AND type_record.typname = ANY($1::text[])
      GROUP BY type_record.typname`,
    [Object.keys(EXPECTED_ENUMS)],
  );
  const actual = new Map(result.rows.map((row) => [row.typname, row.labels]));
  for (const [name, labels] of Object.entries(EXPECTED_ENUMS)) {
    invariant(actual.has(name), `Missing visual progress enum ${name}.`);
    invariant(
      sameValues(actual.get(name), labels),
      `Visual progress enum ${name} does not match the governed contract.`,
    );
  }
}

async function assertColumns(client) {
  const result = await client.query(
    `SELECT column_name, is_nullable, data_type, udt_name,
            character_maximum_length, numeric_precision, numeric_scale,
            datetime_precision, column_default
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'VisualProgressAssessment'`,
  );
  const columns = new Map(result.rows.map((row) => [row.column_name, row]));

  for (const [name, expected] of Object.entries(EXPECTED_COLUMNS)) {
    const column = columns.get(name);
    invariant(column, `Missing governed column VisualProgressAssessment.${name}.`);
    invariant(column.is_nullable === expected.nullable, `${name} has unexpected nullability.`);
    invariant(column.data_type === expected.dataType, `${name} has an unexpected SQL type.`);
    invariant(column.udt_name === expected.udtName, `${name} has an unexpected base type.`);
    for (const [actualKey, expectedKey, label] of [
      ['character_maximum_length', 'maxLength', 'maximum length'],
      ['numeric_precision', 'numericPrecision', 'numeric precision'],
      ['numeric_scale', 'numericScale', 'numeric scale'],
      ['datetime_precision', 'datetimePrecision', 'datetime precision'],
    ]) {
      invariant(
        Number(column[actualKey] || 0) === Number(expected[expectedKey] || 0),
        `${name} has an unexpected ${label}.`,
      );
    }
    if (expected.defaultPattern) {
      invariant(
        expected.defaultPattern.test(String(column.column_default || '')),
        `${name} has an unexpected default.`,
      );
    } else {
      invariant(column.column_default === null, `${name} must not have a database default.`);
    }
  }
}

async function assertReceiptColumns(client) {
  const result = await client.query(
    `SELECT column_name, is_nullable, data_type, udt_name,
            character_maximum_length, numeric_precision, numeric_scale,
            datetime_precision, column_default
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'VisualProgressProviderResultReceipt'`,
  );
  const columns = new Map(result.rows.map((row) => [row.column_name, row]));
  for (const [name, expected] of Object.entries(EXPECTED_RECEIPT_COLUMNS)) {
    const column = columns.get(name);
    invariant(column, `Missing governed receipt column ${name}.`);
    invariant(column.is_nullable === expected.nullable, `${name} has unexpected receipt nullability.`);
    invariant(column.data_type === expected.dataType, `${name} has an unexpected receipt SQL type.`);
    invariant(column.udt_name === expected.udtName, `${name} has an unexpected receipt base type.`);
    for (const [actualKey, expectedKey, label] of [
      ['character_maximum_length', 'maxLength', 'maximum length'],
      ['numeric_precision', 'numericPrecision', 'numeric precision'],
      ['numeric_scale', 'numericScale', 'numeric scale'],
      ['datetime_precision', 'datetimePrecision', 'datetime precision'],
    ]) {
      invariant(
        Number(column[actualKey] || 0) === Number(expected[expectedKey] || 0),
        `${name} has an unexpected receipt ${label}.`,
      );
    }
    if (expected.defaultPattern) {
      invariant(
        expected.defaultPattern.test(String(column.column_default || '')),
        `${name} has an unexpected receipt default.`,
      );
    } else {
      invariant(column.column_default === null, `${name} must not have a receipt default.`);
    }
  }
}

async function assertLedgerColumns(client) {
  const result = await client.query(
    `SELECT column_name, is_nullable, data_type, udt_name,
            character_maximum_length, numeric_precision, numeric_scale,
            datetime_precision, column_default
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'AiDailyBudgetLedger'`,
  );
  const columns = new Map(result.rows.map((row) => [row.column_name, row]));

  for (const [name, expected] of Object.entries(EXPECTED_LEDGER_COLUMNS)) {
    const column = columns.get(name);
    invariant(column, `Missing governed column AiDailyBudgetLedger.${name}.`);
    invariant(column.is_nullable === expected.nullable, `${name} has unexpected ledger nullability.`);
    invariant(column.data_type === expected.dataType, `${name} has an unexpected ledger SQL type.`);
    invariant(column.udt_name === expected.udtName, `${name} has an unexpected ledger base type.`);
    for (const [actualKey, expectedKey, label] of [
      ['character_maximum_length', 'maxLength', 'maximum length'],
      ['numeric_precision', 'numericPrecision', 'numeric precision'],
      ['numeric_scale', 'numericScale', 'numeric scale'],
      ['datetime_precision', 'datetimePrecision', 'datetime precision'],
    ]) {
      invariant(
        Number(column[actualKey] || 0) === Number(expected[expectedKey] || 0),
        `${name} has an unexpected ledger ${label}.`,
      );
    }
    if (expected.defaultPattern) {
      invariant(
        expected.defaultPattern.test(String(column.column_default || '')),
        `${name} has an unexpected ledger default.`,
      );
    } else {
      invariant(column.column_default === null, `${name} must not have a ledger default.`);
    }
  }
}

async function assertReservationColumns(client) {
  const result = await client.query(
    `SELECT column_name, is_nullable, data_type, udt_name,
            character_maximum_length, numeric_precision, numeric_scale,
            datetime_precision, column_default
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'AiDispatchBudgetReservation'`,
  );
  const columns = new Map(result.rows.map((row) => [row.column_name, row]));

  for (const [name, expected] of Object.entries(EXPECTED_RESERVATION_COLUMNS)) {
    const column = columns.get(name);
    invariant(column, `Missing governed column AiDispatchBudgetReservation.${name}.`);
    invariant(column.is_nullable === expected.nullable, `${name} has unexpected reservation nullability.`);
    invariant(column.data_type === expected.dataType, `${name} has an unexpected reservation SQL type.`);
    invariant(column.udt_name === expected.udtName, `${name} has an unexpected reservation base type.`);
    for (const [actualKey, expectedKey, label] of [
      ['character_maximum_length', 'maxLength', 'maximum length'],
      ['numeric_precision', 'numericPrecision', 'numeric precision'],
      ['numeric_scale', 'numericScale', 'numeric scale'],
      ['datetime_precision', 'datetimePrecision', 'datetime precision'],
    ]) {
      invariant(
        Number(column[actualKey] || 0) === Number(expected[expectedKey] || 0),
        `${name} has an unexpected reservation ${label}.`,
      );
    }
    if (expected.defaultPattern) {
      invariant(
        expected.defaultPattern.test(String(column.column_default || '')),
        `${name} has an unexpected reservation default.`,
      );
    } else {
      invariant(column.column_default === null, `${name} must not have a reservation default.`);
    }
  }
}

async function assertChecks(client) {
  const names = Object.keys(EXPECTED_CHECKS);
  const result = await client.query(
    `SELECT constraint_record.conname,
            relation_record.relname AS table_name,
            constraint_record.contype,
            constraint_record.convalidated,
            constraint_record.condeferrable,
            pg_get_constraintdef(constraint_record.oid, true) AS definition
       FROM pg_constraint AS constraint_record
       JOIN pg_class AS relation_record ON relation_record.oid = constraint_record.conrelid
       JOIN pg_namespace AS namespace_record ON namespace_record.oid = relation_record.relnamespace
      WHERE namespace_record.nspname = current_schema()
        AND constraint_record.conname = ANY($1::text[])`,
    [names],
  );
  const checks = new Map(result.rows.map((row) => [row.conname, row]));
  for (const [name, fragments] of Object.entries(EXPECTED_CHECKS)) {
    const check = checks.get(name);
    invariant(check, `Missing governed check constraint ${name}.`);
    invariant(check.table_name === 'VisualProgressAssessment', `${name} is attached to the wrong table.`);
    invariant(check.contype === 'c', `${name} is not a CHECK constraint.`);
    invariant(check.convalidated === true, `${name} is still NOT VALID.`);
    invariant(check.condeferrable === false, `${name} must remain non-deferrable.`);
    const definition = normalizeDefinition(check.definition);
    for (const fragment of fragments) {
      invariant(
        definition.includes(normalizeDefinition(fragment)),
        `${name} is missing a governed invariant.`,
      );
    }
  }
}

async function assertReceiptChecks(client) {
  const names = Object.keys(EXPECTED_RECEIPT_CHECKS);
  const result = await client.query(
    `SELECT constraint_record.conname,
            relation_record.relname AS table_name,
            constraint_record.contype,
            constraint_record.convalidated,
            constraint_record.condeferrable,
            pg_get_constraintdef(constraint_record.oid, true) AS definition
       FROM pg_constraint AS constraint_record
       JOIN pg_class AS relation_record ON relation_record.oid = constraint_record.conrelid
       JOIN pg_namespace AS namespace_record ON namespace_record.oid = relation_record.relnamespace
      WHERE namespace_record.nspname = current_schema()
        AND constraint_record.conname = ANY($1::text[])`,
    [names],
  );
  const checks = new Map(result.rows.map((row) => [row.conname, row]));
  for (const [name, fragments] of Object.entries(EXPECTED_RECEIPT_CHECKS)) {
    const check = checks.get(name);
    invariant(check, `Missing governed receipt check ${name}.`);
    invariant(check.table_name === 'VisualProgressProviderResultReceipt', `${name} is attached to the wrong table.`);
    invariant(check.contype === 'c' && check.convalidated, `${name} is not a validated CHECK.`);
    invariant(check.condeferrable === false, `${name} must remain non-deferrable.`);
    const definition = normalizeDefinition(check.definition);
    for (const fragment of fragments) {
      invariant(
        definition.includes(normalizeDefinition(fragment)),
        `${name} is missing a governed receipt invariant.`,
      );
    }
  }
}

async function assertLedgerChecks(client) {
  const names = Object.keys(EXPECTED_LEDGER_CHECKS);
  const result = await client.query(
    `SELECT constraint_record.conname,
            relation_record.relname AS table_name,
            constraint_record.contype,
            constraint_record.convalidated,
            constraint_record.condeferrable,
            pg_get_constraintdef(constraint_record.oid, true) AS definition
       FROM pg_constraint AS constraint_record
       JOIN pg_class AS relation_record ON relation_record.oid = constraint_record.conrelid
       JOIN pg_namespace AS namespace_record ON namespace_record.oid = relation_record.relnamespace
      WHERE namespace_record.nspname = current_schema()
        AND constraint_record.conname = ANY($1::text[])`,
    [names],
  );
  const checks = new Map(result.rows.map((row) => [row.conname, row]));
  for (const [name, fragments] of Object.entries(EXPECTED_LEDGER_CHECKS)) {
    const check = checks.get(name);
    invariant(check, `Missing governed check constraint ${name}.`);
    invariant(check.table_name === 'AiDailyBudgetLedger', `${name} is attached to the wrong table.`);
    invariant(check.contype === 'c', `${name} is not a CHECK constraint.`);
    invariant(check.convalidated === true, `${name} is still NOT VALID.`);
    invariant(check.condeferrable === false, `${name} must remain non-deferrable.`);
    const definition = normalizeDefinition(check.definition);
    for (const fragment of fragments) {
      invariant(
        definition.includes(normalizeDefinition(fragment)),
        `${name} is missing a governed invariant.`,
      );
    }
  }
}

async function assertReservationChecks(client) {
  const names = Object.keys(EXPECTED_RESERVATION_CHECKS);
  const result = await client.query(
    `SELECT constraint_record.conname,
            relation_record.relname AS table_name,
            constraint_record.contype,
            constraint_record.convalidated,
            constraint_record.condeferrable,
            pg_get_constraintdef(constraint_record.oid, true) AS definition
       FROM pg_constraint AS constraint_record
       JOIN pg_class AS relation_record ON relation_record.oid = constraint_record.conrelid
       JOIN pg_namespace AS namespace_record ON namespace_record.oid = relation_record.relnamespace
      WHERE namespace_record.nspname = current_schema()
        AND constraint_record.conname = ANY($1::text[])`,
    [names],
  );
  const checks = new Map(result.rows.map((row) => [row.conname, row]));
  for (const [name, fragments] of Object.entries(EXPECTED_RESERVATION_CHECKS)) {
    const check = checks.get(name);
    invariant(check, `Missing governed check constraint ${name}.`);
    invariant(check.table_name === 'AiDispatchBudgetReservation', `${name} is attached to the wrong table.`);
    invariant(check.contype === 'c', `${name} is not a CHECK constraint.`);
    invariant(check.convalidated === true, `${name} is still NOT VALID.`);
    invariant(check.condeferrable === false, `${name} must remain non-deferrable.`);
    const definition = normalizeDefinition(check.definition);
    for (const fragment of fragments) {
      invariant(
        definition.includes(normalizeDefinition(fragment)),
        `${name} is missing a governed invariant.`,
      );
    }
  }
}

async function assertIndexes(client) {
  const names = Object.keys(EXPECTED_INDEXES);
  const result = await client.query(
    `SELECT indexes.tablename, indexes.indexname,
            index_state.indisvalid, index_state.indisready,
            index_state.indisunique, index_state.indisprimary,
            index_state.indnullsnotdistinct,
            pg_get_expr(index_state.indpred, index_state.indrelid, true) AS predicate,
            ARRAY(
              SELECT pg_get_indexdef(index_state.indexrelid, position, true)
                FROM generate_series(1, index_state.indnkeyatts) AS position
               ORDER BY position
            ) AS key_columns
       FROM pg_indexes AS indexes
       JOIN pg_class AS index_class ON index_class.relname = indexes.indexname
       JOIN pg_namespace AS index_namespace
         ON index_namespace.oid = index_class.relnamespace
        AND index_namespace.nspname = indexes.schemaname
       JOIN pg_index AS index_state ON index_state.indexrelid = index_class.oid
      WHERE indexes.schemaname = current_schema()
        AND index_state.indrelid = to_regclass(
          format('%I.%I', indexes.schemaname, indexes.tablename)
        )
        AND indexes.indexname = ANY($1::text[])`,
    [names],
  );
  const indexes = new Map(result.rows.map((row) => [row.indexname, row]));
  for (const [name, expected] of Object.entries(EXPECTED_INDEXES)) {
    const index = indexes.get(name);
    invariant(index, `Missing governed index ${name}.`);
    invariant(index.tablename === 'VisualProgressAssessment', `${name} is attached to the wrong table.`);
    invariant(index.indisvalid && index.indisready, `${name} is not valid and ready.`);
    invariant(index.indisunique === expected.unique, `${name} has unexpected uniqueness.`);
    invariant(index.indisprimary === Boolean(expected.primary), `${name} has unexpected primary status.`);
    invariant(index.indnullsnotdistinct === false, `${name} must keep NULLS DISTINCT.`);
    const columns = index.key_columns.map((column) => column.replaceAll('"', '').trim());
    invariant(sameValues(columns, expected.columns), `${name} has unexpected ordered columns.`);
    if (expected.predicate) {
      invariant(index.predicate !== null, `${name} must remain a partial index.`);
      invariant(
        normalizePredicate(index.predicate) === expected.predicate,
        `${name} has an unexpected open-assessment predicate.`,
      );
    } else {
      invariant(index.predicate === null, `${name} must govern every row.`);
    }
  }
}

async function assertReceiptIndexes(client) {
  const names = Object.keys(EXPECTED_RECEIPT_INDEXES);
  const result = await client.query(
    `SELECT indexes.tablename, indexes.indexname,
            index_state.indisvalid, index_state.indisready,
            index_state.indisunique, index_state.indisprimary,
            index_state.indnullsnotdistinct,
            pg_get_expr(index_state.indpred, index_state.indrelid, true) AS predicate,
            ARRAY(
              SELECT pg_get_indexdef(index_state.indexrelid, position, true)
                FROM generate_series(1, index_state.indnkeyatts) AS position
               ORDER BY position
            ) AS key_columns
       FROM pg_indexes AS indexes
       JOIN pg_class AS index_class ON index_class.relname = indexes.indexname
       JOIN pg_namespace AS index_namespace
         ON index_namespace.oid = index_class.relnamespace
        AND index_namespace.nspname = indexes.schemaname
       JOIN pg_index AS index_state ON index_state.indexrelid = index_class.oid
      WHERE indexes.schemaname = current_schema()
        AND index_state.indrelid = to_regclass(
          format('%I.%I', indexes.schemaname, indexes.tablename)
        )
        AND indexes.indexname = ANY($1::text[])`,
    [names],
  );
  const indexes = new Map(result.rows.map((row) => [row.indexname, row]));
  for (const [name, expected] of Object.entries(EXPECTED_RECEIPT_INDEXES)) {
    const index = indexes.get(name);
    invariant(index, `Missing governed receipt index ${name}.`);
    invariant(index.tablename === 'VisualProgressProviderResultReceipt', `${name} is attached to the wrong table.`);
    invariant(index.indisvalid && index.indisready, `${name} is not valid and ready.`);
    invariant(index.indisunique === expected.unique, `${name} has unexpected uniqueness.`);
    invariant(index.indisprimary === Boolean(expected.primary), `${name} has unexpected primary status.`);
    invariant(index.indnullsnotdistinct === false, `${name} must keep NULLS DISTINCT.`);
    const columns = index.key_columns.map((column) => column.replaceAll('"', '').trim());
    invariant(sameValues(columns, expected.columns), `${name} has unexpected ordered columns.`);
    if (expected.predicate) {
      invariant(index.predicate !== null, `${name} must remain partial.`);
      invariant(normalizePredicate(index.predicate) === expected.predicate, `${name} has an unexpected pending predicate.`);
    } else {
      invariant(index.predicate === null, `${name} must govern every receipt row.`);
    }
  }
}

async function assertLedgerIndexes(client) {
  const names = Object.keys(EXPECTED_LEDGER_INDEXES);
  const result = await client.query(
    `SELECT indexes.tablename, indexes.indexname,
            index_state.indisvalid, index_state.indisready,
            index_state.indisunique, index_state.indisprimary,
            index_state.indnullsnotdistinct,
            pg_get_expr(index_state.indpred, index_state.indrelid, true) AS predicate,
            ARRAY(
              SELECT pg_get_indexdef(index_state.indexrelid, position, true)
                FROM generate_series(1, index_state.indnkeyatts) AS position
               ORDER BY position
            ) AS key_columns
       FROM pg_indexes AS indexes
       JOIN pg_class AS index_class ON index_class.relname = indexes.indexname
       JOIN pg_namespace AS index_namespace
         ON index_namespace.oid = index_class.relnamespace
        AND index_namespace.nspname = indexes.schemaname
       JOIN pg_index AS index_state ON index_state.indexrelid = index_class.oid
      WHERE indexes.schemaname = current_schema()
        AND index_state.indrelid = to_regclass(
          format('%I.%I', indexes.schemaname, indexes.tablename)
        )
        AND indexes.indexname = ANY($1::text[])`,
    [names],
  );
  const indexes = new Map(result.rows.map((row) => [row.indexname, row]));
  for (const [name, expected] of Object.entries(EXPECTED_LEDGER_INDEXES)) {
    const index = indexes.get(name);
    invariant(index, `Missing governed index ${name}.`);
    invariant(index.tablename === 'AiDailyBudgetLedger', `${name} is attached to the wrong table.`);
    invariant(index.indisvalid && index.indisready, `${name} is not valid and ready.`);
    invariant(index.indisunique === expected.unique, `${name} has unexpected uniqueness.`);
    invariant(index.indisprimary === Boolean(expected.primary), `${name} has unexpected primary status.`);
    invariant(index.indnullsnotdistinct === false, `${name} must keep NULLS DISTINCT.`);
    const columns = index.key_columns.map((column) => column.replaceAll('"', '').trim());
    invariant(sameValues(columns, expected.columns), `${name} has unexpected ordered columns.`);
    invariant(index.predicate === null, `${name} must govern every ledger row.`);
  }
}

async function assertReservationIndexes(client) {
  const names = Object.keys(EXPECTED_RESERVATION_INDEXES);
  const result = await client.query(
    `SELECT indexes.tablename, indexes.indexname,
            index_state.indisvalid, index_state.indisready,
            index_state.indisunique, index_state.indisprimary,
            index_state.indnullsnotdistinct,
            pg_get_expr(index_state.indpred, index_state.indrelid, true) AS predicate,
            ARRAY(
              SELECT pg_get_indexdef(index_state.indexrelid, position, true)
                FROM generate_series(1, index_state.indnkeyatts) AS position
               ORDER BY position
            ) AS key_columns
       FROM pg_indexes AS indexes
       JOIN pg_class AS index_class ON index_class.relname = indexes.indexname
       JOIN pg_namespace AS index_namespace
         ON index_namespace.oid = index_class.relnamespace
        AND index_namespace.nspname = indexes.schemaname
       JOIN pg_index AS index_state ON index_state.indexrelid = index_class.oid
      WHERE indexes.schemaname = current_schema()
        AND index_state.indrelid = to_regclass(
          format('%I.%I', indexes.schemaname, indexes.tablename)
        )
        AND indexes.indexname = ANY($1::text[])`,
    [names],
  );
  const indexes = new Map(result.rows.map((row) => [row.indexname, row]));
  for (const [name, expected] of Object.entries(EXPECTED_RESERVATION_INDEXES)) {
    const index = indexes.get(name);
    invariant(index, `Missing governed index ${name}.`);
    invariant(index.tablename === 'AiDispatchBudgetReservation', `${name} is attached to the wrong table.`);
    invariant(index.indisvalid && index.indisready, `${name} is not valid and ready.`);
    invariant(index.indisunique === expected.unique, `${name} has unexpected uniqueness.`);
    invariant(index.indisprimary === Boolean(expected.primary), `${name} has unexpected primary status.`);
    invariant(index.indnullsnotdistinct === false, `${name} must keep NULLS DISTINCT.`);
    const columns = index.key_columns.map((column) => column.replaceAll('"', '').trim());
    invariant(sameValues(columns, expected.columns), `${name} has unexpected ordered columns.`);
    invariant(index.predicate === null, `${name} must govern every reservation row.`);
  }
}

async function assertForeignKeys(client) {
  const names = Object.keys(EXPECTED_FOREIGN_KEYS);
  const result = await client.query(
    `SELECT constraint_record.conname,
            source_relation.relname AS table_name,
            target_relation.relname AS target_table,
            constraint_record.contype,
            constraint_record.convalidated,
            constraint_record.condeferrable,
            constraint_record.condeferred,
            constraint_record.confdeltype,
            constraint_record.confupdtype,
            constraint_record.confmatchtype,
            ARRAY(
              SELECT source_attribute.attname::text
                FROM unnest(constraint_record.conkey) WITH ORDINALITY AS key_record(attnum, position)
                JOIN pg_attribute AS source_attribute
                  ON source_attribute.attrelid = constraint_record.conrelid
                 AND source_attribute.attnum = key_record.attnum
               ORDER BY key_record.position
            ) AS source_columns,
            ARRAY(
              SELECT target_attribute.attname::text
                FROM unnest(constraint_record.confkey) WITH ORDINALITY AS key_record(attnum, position)
                JOIN pg_attribute AS target_attribute
                  ON target_attribute.attrelid = constraint_record.confrelid
                 AND target_attribute.attnum = key_record.attnum
               ORDER BY key_record.position
            ) AS target_columns
       FROM pg_constraint AS constraint_record
       JOIN pg_class AS source_relation ON source_relation.oid = constraint_record.conrelid
       JOIN pg_namespace AS source_namespace ON source_namespace.oid = source_relation.relnamespace
       JOIN pg_class AS target_relation ON target_relation.oid = constraint_record.confrelid
      WHERE source_namespace.nspname = current_schema()
        AND constraint_record.conname = ANY($1::text[])`,
    [names],
  );
  const foreignKeys = new Map(result.rows.map((row) => [row.conname, row]));
  for (const [name, expected] of Object.entries(EXPECTED_FOREIGN_KEYS)) {
    const foreignKey = foreignKeys.get(name);
    invariant(foreignKey, `Missing governed foreign key ${name}.`);
    invariant(foreignKey.table_name === 'VisualProgressAssessment', `${name} is attached to the wrong table.`);
    invariant(foreignKey.target_table === expected.target, `${name} references the wrong table.`);
    invariant(foreignKey.contype === 'f' && foreignKey.convalidated, `${name} is not a validated foreign key.`);
    invariant(!foreignKey.condeferrable && !foreignKey.condeferred, `${name} must remain immediate.`);
    invariant(foreignKey.confdeltype === expected.deleteAction, `${name} has an unsafe delete policy.`);
    invariant(foreignKey.confupdtype === 'c', `${name} must remain ON UPDATE CASCADE.`);
    invariant(foreignKey.confmatchtype === 's', `${name} must remain MATCH SIMPLE.`);
    invariant(sameValues(foreignKey.source_columns, expected.columns), `${name} has wrong source columns.`);
    invariant(sameValues(foreignKey.target_columns, expected.targetColumns), `${name} has wrong target columns.`);
  }
}

async function assertReceiptForeignKeys(client) {
  const names = Object.keys(EXPECTED_RECEIPT_FOREIGN_KEYS);
  const result = await client.query(
    `SELECT constraint_record.conname,
            source_relation.relname AS table_name,
            target_relation.relname AS target_table,
            constraint_record.contype,
            constraint_record.convalidated,
            constraint_record.condeferrable,
            constraint_record.condeferred,
            constraint_record.confdeltype,
            constraint_record.confupdtype,
            constraint_record.confmatchtype,
            ARRAY(
              SELECT source_attribute.attname::text
                FROM unnest(constraint_record.conkey) WITH ORDINALITY AS source_key(attnum, position)
                JOIN pg_attribute AS source_attribute
                  ON source_attribute.attrelid = constraint_record.conrelid
                 AND source_attribute.attnum = source_key.attnum
               ORDER BY source_key.position
            ) AS source_columns,
            ARRAY(
              SELECT target_attribute.attname::text
                FROM unnest(constraint_record.confkey) WITH ORDINALITY AS target_key(attnum, position)
                JOIN pg_attribute AS target_attribute
                  ON target_attribute.attrelid = constraint_record.confrelid
                 AND target_attribute.attnum = target_key.attnum
               ORDER BY target_key.position
            ) AS target_columns
       FROM pg_constraint AS constraint_record
       JOIN pg_class AS source_relation ON source_relation.oid = constraint_record.conrelid
       JOIN pg_namespace AS source_namespace ON source_namespace.oid = source_relation.relnamespace
       JOIN pg_class AS target_relation ON target_relation.oid = constraint_record.confrelid
      WHERE source_namespace.nspname = current_schema()
        AND constraint_record.conname = ANY($1::text[])`,
    [names],
  );
  const foreignKeys = new Map(result.rows.map((row) => [row.conname, row]));
  for (const [name, expected] of Object.entries(EXPECTED_RECEIPT_FOREIGN_KEYS)) {
    const foreignKey = foreignKeys.get(name);
    invariant(foreignKey, `Missing governed receipt foreign key ${name}.`);
    invariant(foreignKey.table_name === 'VisualProgressProviderResultReceipt', `${name} is attached to the wrong table.`);
    invariant(foreignKey.target_table === expected.target, `${name} references the wrong table.`);
    invariant(foreignKey.contype === 'f' && foreignKey.convalidated, `${name} is not validated.`);
    invariant(!foreignKey.condeferrable && !foreignKey.condeferred, `${name} must remain immediate.`);
    invariant(foreignKey.confdeltype === expected.deleteAction, `${name} has an unsafe delete policy.`);
    invariant(foreignKey.confupdtype === 'c', `${name} must remain ON UPDATE CASCADE.`);
    invariant(foreignKey.confmatchtype === 's', `${name} must remain MATCH SIMPLE.`);
    invariant(sameValues(foreignKey.source_columns, expected.columns), `${name} has wrong source columns.`);
    invariant(sameValues(foreignKey.target_columns, expected.targetColumns), `${name} has wrong target columns.`);
  }
}

async function assertLedgerForeignKey(client) {
  const result = await client.query(
    `SELECT source_relation.relname AS table_name,
            target_relation.relname AS target_table,
            constraint_record.contype,
            constraint_record.convalidated,
            constraint_record.condeferrable,
            constraint_record.condeferred,
            constraint_record.confdeltype,
            constraint_record.confupdtype,
            constraint_record.confmatchtype,
            ARRAY(
              SELECT source_attribute.attname::text
                FROM unnest(constraint_record.conkey) WITH ORDINALITY AS key_record(attnum, position)
                JOIN pg_attribute AS source_attribute
                  ON source_attribute.attrelid = constraint_record.conrelid
                 AND source_attribute.attnum = key_record.attnum
               ORDER BY key_record.position
            ) AS source_columns,
            ARRAY(
              SELECT target_attribute.attname::text
                FROM unnest(constraint_record.confkey) WITH ORDINALITY AS key_record(attnum, position)
                JOIN pg_attribute AS target_attribute
                  ON target_attribute.attrelid = constraint_record.confrelid
                 AND target_attribute.attnum = key_record.attnum
               ORDER BY key_record.position
            ) AS target_columns
       FROM pg_constraint AS constraint_record
       JOIN pg_class AS source_relation ON source_relation.oid = constraint_record.conrelid
       JOIN pg_namespace AS source_namespace ON source_namespace.oid = source_relation.relnamespace
       JOIN pg_class AS target_relation ON target_relation.oid = constraint_record.confrelid
      WHERE source_namespace.nspname = current_schema()
        AND constraint_record.conname = 'AiDailyBudgetLedger_organizationId_fkey'`,
  );
  const foreignKey = result.rows[0];
  invariant(foreignKey, 'Missing governed AiDailyBudgetLedger organization foreign key.');
  invariant(foreignKey.table_name === 'AiDailyBudgetLedger', 'Ledger foreign key is attached to the wrong table.');
  invariant(foreignKey.target_table === 'Organization', 'Ledger foreign key references the wrong table.');
  invariant(foreignKey.contype === 'f' && foreignKey.convalidated, 'Ledger organization scope is not validated.');
  invariant(!foreignKey.condeferrable && !foreignKey.condeferred, 'Ledger organization scope must remain immediate.');
  invariant(foreignKey.confdeltype === 'c', 'Ledger organization scope must cascade tenant deletion.');
  invariant(foreignKey.confupdtype === 'c', 'Ledger organization scope must remain ON UPDATE CASCADE.');
  invariant(foreignKey.confmatchtype === 's', 'Ledger organization scope must remain MATCH SIMPLE.');
  invariant(sameValues(foreignKey.source_columns, ['organizationId']), 'Ledger foreign key has wrong source columns.');
  invariant(sameValues(foreignKey.target_columns, ['id']), 'Ledger foreign key has wrong target columns.');
}

async function assertReservationForeignKeys(client) {
  const names = Object.keys(EXPECTED_RESERVATION_FOREIGN_KEYS);
  const result = await client.query(
    `SELECT constraint_record.conname,
            source_relation.relname AS table_name,
            target_relation.relname AS target_table,
            constraint_record.contype,
            constraint_record.convalidated,
            constraint_record.condeferrable,
            constraint_record.condeferred,
            constraint_record.confdeltype,
            constraint_record.confupdtype,
            constraint_record.confmatchtype,
            ARRAY(
              SELECT source_attribute.attname::text
                FROM unnest(constraint_record.conkey) WITH ORDINALITY AS key_record(attnum, position)
                JOIN pg_attribute AS source_attribute
                  ON source_attribute.attrelid = constraint_record.conrelid
                 AND source_attribute.attnum = key_record.attnum
               ORDER BY key_record.position
            ) AS source_columns,
            ARRAY(
              SELECT target_attribute.attname::text
                FROM unnest(constraint_record.confkey) WITH ORDINALITY AS key_record(attnum, position)
                JOIN pg_attribute AS target_attribute
                  ON target_attribute.attrelid = constraint_record.confrelid
                 AND target_attribute.attnum = key_record.attnum
               ORDER BY key_record.position
            ) AS target_columns
       FROM pg_constraint AS constraint_record
       JOIN pg_class AS source_relation ON source_relation.oid = constraint_record.conrelid
       JOIN pg_namespace AS source_namespace ON source_namespace.oid = source_relation.relnamespace
       JOIN pg_class AS target_relation ON target_relation.oid = constraint_record.confrelid
      WHERE source_namespace.nspname = current_schema()
        AND constraint_record.conname = ANY($1::text[])`,
    [names],
  );
  const foreignKeys = new Map(result.rows.map((row) => [row.conname, row]));
  for (const [name, expected] of Object.entries(EXPECTED_RESERVATION_FOREIGN_KEYS)) {
    const foreignKey = foreignKeys.get(name);
    invariant(foreignKey, `Missing governed reservation foreign key ${name}.`);
    invariant(foreignKey.table_name === 'AiDispatchBudgetReservation', `${name} is attached to the wrong table.`);
    invariant(foreignKey.target_table === expected.target, `${name} references the wrong table.`);
    invariant(foreignKey.contype === 'f' && foreignKey.convalidated, `${name} is not validated.`);
    invariant(!foreignKey.condeferrable && !foreignKey.condeferred, `${name} must remain immediate.`);
    invariant(foreignKey.confdeltype === expected.deleteAction, `${name} has an unsafe delete policy.`);
    invariant(foreignKey.confupdtype === 'c', `${name} must remain ON UPDATE CASCADE.`);
    invariant(foreignKey.confmatchtype === 's', `${name} must remain MATCH SIMPLE.`);
    invariant(sameValues(foreignKey.source_columns, expected.columns), `${name} has wrong source columns.`);
    invariant(sameValues(foreignKey.target_columns, expected.targetColumns), `${name} has wrong target columns.`);
  }
}

async function assertBudgetFunctions(client) {
  const names = Object.keys(EXPECTED_BUDGET_FUNCTIONS);
  const result = await client.query(
    `SELECT procedure_record.proname,
            procedure_record.prosecdef,
            procedure_record.provolatile,
            procedure_record.proconfig,
            pg_get_function_identity_arguments(procedure_record.oid) AS identity_arguments,
            pg_get_function_result(procedure_record.oid) AS result_type,
            pg_get_functiondef(procedure_record.oid) AS definition
       FROM pg_proc AS procedure_record
       JOIN pg_namespace AS namespace_record
         ON namespace_record.oid = procedure_record.pronamespace
      WHERE namespace_record.nspname = current_schema()
        AND procedure_record.proname = ANY($1::text[])`,
    [names],
  );
  const functions = new Map(result.rows.map((row) => [row.proname, row]));
  invariant(
    result.rows.length === names.length && functions.size === names.length,
    'AI budget function overloads or definitions are missing.',
  );
  for (const [name, fragments] of Object.entries(EXPECTED_BUDGET_FUNCTIONS)) {
    const procedure = functions.get(name);
    invariant(procedure, `Missing governed AI budget function ${name}.`);
    invariant(procedure.prosecdef === false, `${name} must remain SECURITY INVOKER.`);
    invariant(procedure.provolatile === 'v', `${name} must remain VOLATILE.`);
    invariant(
      Array.isArray(procedure.proconfig)
        && procedure.proconfig.includes('search_path=pg_catalog'),
      `${name} must pin search_path to pg_catalog.`,
    );
    const identityArguments = String(procedure.identity_arguments);
    invariant(
      identityArguments.includes('p_assessment_id text'),
      `${name} must be keyed by assessmentId.`,
    );
    if (name === 'obrasaas_ai_daily_budget_reserve') {
      invariant(
        identityArguments.includes('p_civil_day_utc date')
          && identityArguments.includes('p_workload text')
          && identityArguments.includes('p_quota_policy_version text')
          && identityArguments.includes('p_budget_limit_micros bigint')
          && identityArguments.includes('p_reserve_micros bigint'),
        `${name} has an unexpected reservation signature.`,
      );
    } else {
      invariant(
        identityArguments.includes('p_actual_micros bigint')
          && identityArguments.includes('p_settlement_basis')
          && identityArguments.includes('AiDispatchSettlementBasis')
          && identityArguments.includes('p_settlement_operation_key_hash text')
          && identityArguments.includes('p_settlement_evidence_sha256 text')
          && identityArguments.includes('p_settled_by_id text')
          && !identityArguments.includes('p_reserved_micros'),
        `${name} must derive the held amount from durable reservation identity.`,
      );
    }
    invariant(
      String(procedure.result_type).includes('AiDispatchBudgetReservation'),
      `${name} must return the durable reservation row.`,
    );
    const definition = normalizeDefinition(procedure.definition).toLowerCase();
    for (const fragment of fragments) {
      invariant(
        definition.includes(normalizeDefinition(fragment).toLowerCase()),
        `${name} is missing a governed concurrency invariant.`,
      );
    }
  }
}

async function assertDispatchAuditTrigger(client) {
  const result = await client.query(
    `SELECT trigger_record.tgenabled,
            trigger_record.tgisinternal,
            procedure_record.prosecdef,
            procedure_record.proconfig,
            pg_get_function_result(procedure_record.oid) AS result_type,
            pg_get_functiondef(procedure_record.oid) AS function_definition,
            pg_get_triggerdef(trigger_record.oid) AS trigger_definition
       FROM pg_trigger AS trigger_record
       JOIN pg_class AS relation_record
         ON relation_record.oid = trigger_record.tgrelid
       JOIN pg_namespace AS namespace_record
         ON namespace_record.oid = relation_record.relnamespace
       JOIN pg_proc AS procedure_record
         ON procedure_record.oid = trigger_record.tgfoid
      WHERE namespace_record.nspname = current_schema()
        AND relation_record.relname = 'VisualProgressAssessment'
        AND trigger_record.tgname = $1
        AND procedure_record.proname = $2`,
    [DISPATCH_AUDIT_TRIGGER, DISPATCH_AUDIT_FUNCTION],
  );
  invariant(result.rows.length === 1, 'Missing AI dispatch write-once audit trigger.');
  const trigger = result.rows[0];
  invariant(trigger.tgenabled === 'O' && trigger.tgisinternal === false, 'AI dispatch audit trigger is not enabled.');
  invariant(trigger.prosecdef === false, 'AI dispatch audit trigger must remain SECURITY INVOKER.');
  invariant(
    Array.isArray(trigger.proconfig)
      && trigger.proconfig.includes('search_path=pg_catalog'),
    'AI dispatch audit trigger must pin search_path to pg_catalog.',
  );
  invariant(String(trigger.result_type) === 'trigger', 'AI dispatch audit helper must return trigger.');
  const triggerDefinition = normalizeDefinition(trigger.trigger_definition).toLowerCase();
  invariant(triggerDefinition.includes('before insert or update'), 'AI dispatch audit trigger has the wrong timing.');
  invariant(triggerDefinition.includes(DISPATCH_AUDIT_FUNCTION), 'AI dispatch audit trigger invokes the wrong helper.');
  const functionDefinition = normalizeDefinition(trigger.function_definition).toLowerCase();
  for (const fragment of [
    'AiDispatchAudit_core_immutable',
    'AiDispatchAudit_dispatch_start_immutable',
    'AiDispatchAudit_dispatch_reservation_required',
    'AiDispatchAudit_request_id_immutable',
    'AiDispatchAudit_response_id_immutable',
    'AiDispatchAudit_usage_immutable',
    'AiDispatchAudit_actual_cost_immutable',
    'AiDispatchAudit_settlement_required',
    'obrasaas.ai_settlement_assessment',
    'providerResponseId',
    'providerRequestId',
    'AiDispatchBudgetReservation',
  ]) {
    invariant(
      functionDefinition.includes(normalizeDefinition(fragment).toLowerCase()),
      'AI dispatch audit trigger is missing a write-once invariant.',
    );
  }
}

async function assertPersistenceTriggers(client) {
  const names = Object.keys(EXPECTED_PERSISTENCE_TRIGGERS);
  const result = await client.query(
    `SELECT trigger_record.tgname,
            relation_record.relname AS table_name,
            trigger_record.tgenabled,
            trigger_record.tgisinternal,
            procedure_record.proname,
            procedure_record.prosecdef,
            procedure_record.proconfig,
            pg_get_function_result(procedure_record.oid) AS result_type,
            pg_get_functiondef(procedure_record.oid) AS function_definition,
            pg_get_triggerdef(trigger_record.oid) AS trigger_definition,
            COALESCE(constraint_record.condeferrable, false) AS condeferrable,
            COALESCE(constraint_record.condeferred, false) AS condeferred
       FROM pg_trigger AS trigger_record
       JOIN pg_class AS relation_record ON relation_record.oid = trigger_record.tgrelid
       JOIN pg_namespace AS namespace_record ON namespace_record.oid = relation_record.relnamespace
       JOIN pg_proc AS procedure_record ON procedure_record.oid = trigger_record.tgfoid
       LEFT JOIN pg_constraint AS constraint_record
         ON constraint_record.oid = trigger_record.tgconstraint
      WHERE namespace_record.nspname = current_schema()
        AND trigger_record.tgname = ANY($1::text[])`,
    [names],
  );
  const triggers = new Map(result.rows.map((row) => [row.tgname, row]));
  for (const [name, expected] of Object.entries(EXPECTED_PERSISTENCE_TRIGGERS)) {
    const trigger = triggers.get(name);
    invariant(trigger, `Missing governed persistence trigger ${name}.`);
    invariant(trigger.table_name === expected.table, `${name} is attached to the wrong table.`);
    invariant(trigger.proname === expected.functionName, `${name} invokes the wrong helper.`);
    invariant(trigger.tgenabled === 'O' && trigger.tgisinternal === false, `${name} is not enabled.`);
    invariant(trigger.prosecdef === false, `${name} must remain SECURITY INVOKER.`);
    invariant(
      Array.isArray(trigger.proconfig)
        && trigger.proconfig.includes('search_path=pg_catalog'),
      `${name} must pin search_path to pg_catalog.`,
    );
    invariant(String(trigger.result_type) === 'trigger', `${name} helper must return trigger.`);
    invariant(trigger.condeferrable === expected.deferrable, `${name} has unexpected deferrability.`);
    invariant(trigger.condeferred === expected.initiallyDeferred, `${name} has unexpected initial timing.`);
    const triggerDefinition = normalizeDefinition(trigger.trigger_definition).toLowerCase();
    for (const fragment of expected.triggerFragments) {
      invariant(triggerDefinition.includes(fragment), `${name} has unexpected trigger timing.`);
    }
    const functionDefinition = normalizeDefinition(trigger.function_definition).toLowerCase();
    for (const fragment of expected.functionFragments) {
      invariant(
        functionDefinition.includes(normalizeDefinition(fragment).toLowerCase()),
        `${name} is missing a persistence invariant.`,
      );
    }
  }
}

let savepointSequence = 0;

async function expectSqlFailure(
  client,
  query,
  parameters,
  expectedCode,
  expectedConstraint,
  label,
) {
  savepointSequence += 1;
  const savepoint = `visual_progress_verify_${savepointSequence}`;
  await client.query(`SAVEPOINT ${savepoint}`);
  let caught = null;
  try {
    await client.query(query, parameters);
  } catch (error) {
    caught = error;
  }
  await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
  await client.query(`RELEASE SAVEPOINT ${savepoint}`);
  invariant(caught, `${label} unexpectedly succeeded.`);
  invariant(caught.code === expectedCode, `${label} failed with an unexpected SQLSTATE.`);
  if (expectedConstraint) {
    invariant(caught.constraint === expectedConstraint, `${label} failed on an unexpected constraint.`);
  }
}

async function expectDeferredConstraintFailure(
  client,
  constraintName,
  query,
  parameters,
  expectedConstraint,
  label,
) {
  savepointSequence += 1;
  const savepoint = `visual_progress_verify_${savepointSequence}`;
  await client.query(`SAVEPOINT ${savepoint}`);
  let caught = null;
  try {
    await client.query(`SET CONSTRAINTS "${constraintName}" IMMEDIATE`);
    await client.query(query, parameters);
  } catch (error) {
    caught = error;
  }
  await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
  await client.query(`RELEASE SAVEPOINT ${savepoint}`);
  invariant(caught, `${label} unexpectedly succeeded.`);
  invariant(caught.code === '23503', `${label} failed with an unexpected SQLSTATE.`);
  invariant(caught.constraint === expectedConstraint, `${label} failed on an unexpected constraint.`);
}

const INSERT_ASSESSMENT_SQL = `
  INSERT INTO "VisualProgressAssessment" (
    "id", "projectId", "taskId", "evidenceId", "operationKeyHash",
    "requestFingerprint", "provider", "providerModel", "analyzerVersion",
    "inputSha256", "baselineHash", "taskRevisionAtRequest",
    "evidenceRevisionAtRequest", "status", "leaseExpiresAt", "attemptCount",
    "summary", "elementType", "progressMin", "progressMax", "confidence",
    "quality", "observations", "limitations", "providerResponseId",
    "failureCode", "completedAt", "requestedById", "reviewStatus",
    "reviewedById", "reviewedAt", "reviewNote", "correctedProgressMin",
    "correctedProgressMax", "createdAt", "updatedAt"
  ) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
    $14, $15, $16, $17, $18, $19, $20, $21, $22::jsonb, $23::jsonb,
    $24::jsonb, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $35
  )`;

function jsonParameter(value) {
  return value == null ? null : JSON.stringify(value);
}

function assessmentParameters(fixtures, overrides = {}) {
  const status = overrides.status || 'PENDING';
  const recordedAt = overrides.updatedAt ?? overrides.completedAt ?? new Date();
  return [
    overrides.id || `vpa_${randomUUID()}`,
    overrides.projectId || fixtures.projectId,
    overrides.taskId || fixtures.taskId,
    overrides.evidenceId || fixtures.evidenceId,
    overrides.operationKeyHash || randomUUID().replaceAll('-', '').padEnd(64, '0'),
    overrides.requestFingerprint || randomUUID().replaceAll('-', '').padEnd(64, '1'),
    overrides.provider || 'openai',
    overrides.providerModel || 'migration-verifier',
    overrides.analyzerVersion || 'migration-verifier-v1',
    overrides.inputSha256 || randomUUID().replaceAll('-', '').padEnd(64, '2'),
    overrides.baselineHash || randomUUID().replaceAll('-', '').padEnd(64, '3'),
    overrides.taskRevisionAtRequest ?? 0,
    overrides.evidenceRevisionAtRequest ?? 0,
    status,
    overrides.leaseExpiresAt ?? null,
    overrides.attemptCount ?? 0,
    overrides.summary ?? null,
    overrides.elementType ?? null,
    overrides.progressMin ?? null,
    overrides.progressMax ?? null,
    overrides.confidence ?? null,
    jsonParameter(overrides.quality),
    jsonParameter(overrides.observations),
    jsonParameter(overrides.limitations),
    overrides.providerResponseId ?? null,
    overrides.failureCode ?? null,
    overrides.completedAt ?? null,
    overrides.requestedById === undefined ? fixtures.requesterId : overrides.requestedById,
    overrides.reviewStatus ?? null,
    overrides.reviewedById ?? null,
    overrides.reviewedAt ?? null,
    overrides.reviewNote ?? null,
    overrides.correctedProgressMin ?? null,
    overrides.correctedProgressMax ?? null,
    recordedAt,
  ];
}

const INSERT_RECEIPT_SQL = `
  INSERT INTO "VisualProgressProviderResultReceipt" (
    "assessmentId", "organizationId", "projectId", "schemaVersion",
    "receiptSha256", "providerRequestId", "providerResponseId",
    "inputSha256", "submittedSha256", "width", "height", "abstained",
    "abstentionReason", "summary", "elementType", "progressMin",
    "progressMax", "confidence", "quality", "observations", "limitations",
    "inputTokens", "outputTokens", "totalTokens", "cachedInputTokens",
    "cacheWriteTokens", "receivedAt", "appliedAt", "revision"
  ) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
    $14, $15, $16, $17, $18, $19::jsonb, $20::jsonb, $21::jsonb,
    $22, $23, $24, $25, $26, $27, $28, $29
  )`;

function receiptParameters({
  assessmentId,
  organizationId,
  projectId,
  inputSha256,
  receivedAt,
}, overrides = {}) {
  return [
    assessmentId,
    organizationId,
    projectId,
    1,
    overrides.receiptSha256 ?? 'a'.repeat(64),
    overrides.providerRequestId ?? 'req_migration_verifier',
    overrides.providerResponseId ?? 'resp_migration_verifier',
    inputSha256,
    overrides.submittedSha256 ?? 'b'.repeat(64),
    overrides.width ?? 640,
    overrides.height ?? 480,
    overrides.abstained ?? false,
    overrides.abstentionReason ?? null,
    overrides.summary ?? 'Muro de mamposteria parcialmente ejecutado.',
    overrides.elementType ?? 'masonry-wall',
    overrides.progressMin ?? 45,
    overrides.progressMax ?? 55,
    overrides.confidence ?? 0.8,
    JSON.stringify(overrides.quality ?? {
      overall: 'good', angle: 'good', lighting: 'good', occlusion: 'none',
    }),
    JSON.stringify(overrides.observations ?? ['Muro visible']),
    JSON.stringify(overrides.limitations ?? ['Una sola toma']),
    overrides.inputTokens ?? 300,
    overrides.outputTokens ?? 120,
    overrides.totalTokens ?? 420,
    overrides.cachedInputTokens ?? 100,
    overrides.cacheWriteTokens === undefined ? 0 : overrides.cacheWriteTokens,
    receivedAt,
    overrides.appliedAt ?? null,
    overrides.revision ?? 0,
  ];
}

async function insertEvidence(client, { id, projectId, taskId, suffix, now }) {
  await client.query(
    `INSERT INTO "ProgressEvidence" (
       "id", "projectId", "taskId", "capturedAt", "caption", "media",
       "createdAt", "updatedAt"
     ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $4, $4)`,
    [id, projectId, taskId, now, `Visual migration ${suffix}`, JSON.stringify({ kind: 'image' })],
  );
}

async function applyDispatchBudgetAudit(client, {
  assessmentId,
  civilDayUtc,
  reservationMicros,
  budgetLimitMicros = 1_000,
}) {
  await client.query(
    `UPDATE "VisualProgressAssessment"
        SET "registryModelId" = 'openai:gpt-5.6-sol',
            "providerRoute" = 'openai-responses-visual',
            "routePolicyVersion" = 'ai-dispatch-plan-v1',
            "routeReasonCode" = 'primary_default',
            "pricingVersion" = '2026-07-28',
            "budgetCivilDayUtc" = $2::date,
            "budgetWorkload" = 'visual-progress',
            "quotaPolicyVersion" = 'ai-budget-v1',
            "budgetLimitMicros" = $3,
            "budgetReservationMicros" = $4,
            "estimateBasis" = 'pre-byte-conservative-cap',
            "estimatedCostMicros" = $4
      WHERE "id" = $1`,
    [assessmentId, civilDayUtc, budgetLimitMicros, reservationMicros],
  );
}

async function assertTransactionalSmoke(client) {
  const suffix = randomUUID().replaceAll('-', '');
  const now = new Date();
  const fixtures = {
    organizationId: `vpa_verify_org_${suffix}`,
    projectId: `vpa_verify_project_${suffix}`,
    otherProjectId: `vpa_verify_other_project_${suffix}`,
    taskId: `vpa_verify_task_${suffix}`,
    otherTaskId: `vpa_verify_other_task_${suffix}`,
    evidenceId: `vpa_verify_evidence_${suffix}`,
    reviewEvidenceId: `vpa_verify_review_evidence_${suffix}`,
    secondBudgetEvidenceId: `vpa_verify_budget_second_${suffix}`,
    blockedBudgetEvidenceId: `vpa_verify_budget_blocked_${suffix}`,
    otherEvidenceId: `vpa_verify_other_evidence_${suffix}`,
    requesterId: `vpa_verify_requester_${suffix}`,
    reviewerId: `vpa_verify_reviewer_${suffix}`,
  };

  await client.query(
    `INSERT INTO "Organization" ("id", "name", "slug", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $4)`,
    [fixtures.organizationId, 'Visual progress migration verifier', `vpa-verify-${suffix}`, now],
  );
  for (const [id, clerkSuffix] of [
    [fixtures.requesterId, 'requester'],
    [fixtures.reviewerId, 'reviewer'],
  ]) {
    await client.query(
      `INSERT INTO "PlatformUser" (
         "id", "clerkUserId", "primaryEmail", "createdAt", "updatedAt"
       ) VALUES ($1, $2, $3, $4, $4)`,
      [id, `clerk_vpa_${clerkSuffix}_${suffix}`, `vpa-${clerkSuffix}-${suffix}@invalid.example`, now],
    );
  }
  for (const [id, slug] of [
    [fixtures.projectId, `vpa-project-${suffix}`],
    [fixtures.otherProjectId, `vpa-other-project-${suffix}`],
  ]) {
    await client.query(
      `INSERT INTO "Project" (
         "id", "organizationId", "name", "slug", "createdAt", "updatedAt"
       ) VALUES ($1, $2, $3, $4, $5, $5)`,
      [id, fixtures.organizationId, 'Visual progress verifier project', slug, now],
    );
  }
  for (const [id, projectId] of [
    [fixtures.taskId, fixtures.projectId],
    [fixtures.otherTaskId, fixtures.otherProjectId],
  ]) {
    await client.query(
      `INSERT INTO "Task" ("id", "projectId", "title", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $4)`,
      [id, projectId, 'Visual progress verifier task', now],
    );
  }
  await insertEvidence(client, {
    id: fixtures.evidenceId,
    projectId: fixtures.projectId,
    taskId: fixtures.taskId,
    suffix,
    now,
  });
  await insertEvidence(client, {
    id: fixtures.reviewEvidenceId,
    projectId: fixtures.projectId,
    taskId: fixtures.taskId,
    suffix,
    now,
  });
  await insertEvidence(client, {
    id: fixtures.secondBudgetEvidenceId,
    projectId: fixtures.projectId,
    taskId: fixtures.taskId,
    suffix,
    now,
  });
  await insertEvidence(client, {
    id: fixtures.blockedBudgetEvidenceId,
    projectId: fixtures.projectId,
    taskId: fixtures.taskId,
    suffix,
    now,
  });
  await insertEvidence(client, {
    id: fixtures.otherEvidenceId,
    projectId: fixtures.otherProjectId,
    taskId: fixtures.otherTaskId,
    suffix,
    now,
  });

  const civilDayUtc = now.toISOString().slice(0, 10);
  const pending = assessmentParameters(fixtures);
  await client.query(INSERT_ASSESSMENT_SQL, pending);

  await expectSqlFailure(
    client,
    `UPDATE "VisualProgressAssessment"
        SET "inputTokens" = 1
      WHERE "id" = $1`,
    [pending[0]],
    '23514',
    'VisualProgressAssessment_dispatch_audit_check',
    'VisualProgressAssessment orphan usage telemetry guard',
  );
  await applyDispatchBudgetAudit(client, {
    assessmentId: pending[0],
    civilDayUtc,
    reservationMicros: 600,
  });
  await expectSqlFailure(
    client,
    `UPDATE "VisualProgressAssessment"
        SET "providerRoute" = NULL
      WHERE "id" = $1`,
    [pending[0]],
    '23514',
    'AiDispatchAudit_core_immutable',
    'VisualProgressAssessment governed provider route guard',
  );
  await expectSqlFailure(
    client,
    `UPDATE "VisualProgressAssessment"
        SET "providerDispatchStartedAt" = $2
      WHERE "id" = $1`,
    [pending[0], new Date(Date.now() + 1_000)],
    '23514',
    'AiDispatchAudit_dispatch_reservation_required',
    'VisualProgressAssessment pre-reservation dispatch guard',
  );

  await expectSqlFailure(
    client,
    INSERT_ASSESSMENT_SQL,
    assessmentParameters(fixtures, { operationKeyHash: 'not-a-sha256' }),
    '23514',
    'VisualProgressAssessment_hashes_check',
    'VisualProgressAssessment hash guard',
  );
  await expectSqlFailure(
    client,
    INSERT_ASSESSMENT_SQL,
    assessmentParameters(fixtures, {
      evidenceId: fixtures.reviewEvidenceId,
      status: 'RUNNING',
      attemptCount: 1,
    }),
    '23514',
    'VisualProgressAssessment_lease_state_check',
    'VisualProgressAssessment RUNNING lease guard',
  );
  await expectSqlFailure(
    client,
    INSERT_ASSESSMENT_SQL,
    assessmentParameters(fixtures, {
      evidenceId: fixtures.reviewEvidenceId,
      status: 'COMPLETED',
      attemptCount: 1,
      completedAt: new Date(),
      reviewStatus: 'PENDING',
    }),
    '23514',
    'VisualProgressAssessment_result_state_check',
    'VisualProgressAssessment completed result guard',
  );
  await expectSqlFailure(
    client,
    INSERT_ASSESSMENT_SQL,
    assessmentParameters(fixtures),
    '23505',
    'VPA_project_evidence_open_key',
    'VisualProgressAssessment open evidence uniqueness',
  );
  await expectSqlFailure(
    client,
    INSERT_ASSESSMENT_SQL,
    assessmentParameters(fixtures, {
      taskId: fixtures.otherTaskId,
      evidenceId: fixtures.reviewEvidenceId,
    }),
    '23503',
    'VisualProgressAssessment_project_task_fkey',
    'VisualProgressAssessment cross-project task scope',
  );
  await expectSqlFailure(
    client,
    INSERT_ASSESSMENT_SQL,
    assessmentParameters(fixtures, { evidenceId: fixtures.otherEvidenceId }),
    '23503',
    'VisualProgressAssessment_project_evidence_fkey',
    'VisualProgressAssessment cross-project evidence scope',
  );

  const completedAt = new Date(Date.now() + 1_000);
  const completed = assessmentParameters(fixtures, {
    evidenceId: fixtures.reviewEvidenceId,
    status: 'COMPLETED',
    attemptCount: 1,
    summary: 'Mamposteria parcialmente ejecutada.',
    elementType: 'masonry-wall',
    progressMin: 40,
    progressMax: 60,
    confidence: 0.75,
    quality: { usable: true },
    observations: ['Muro visible'],
    limitations: ['Una sola toma'],
    providerResponseId: 'migration-verifier-response',
    completedAt,
    reviewStatus: 'PENDING',
    updatedAt: completedAt,
  });
  await client.query(INSERT_ASSESSMENT_SQL, completed);
  await expectSqlFailure(
    client,
    INSERT_ASSESSMENT_SQL,
    assessmentParameters(fixtures, { evidenceId: fixtures.reviewEvidenceId }),
    '23505',
    'VPA_project_evidence_open_key',
    'VisualProgressAssessment unresolved review uniqueness',
  );

  const reviewedAt = new Date(completedAt.getTime() + 1_000);
  await client.query(
    `UPDATE "VisualProgressAssessment"
        SET "reviewStatus" = 'APPROVED', "reviewedById" = $2,
            "reviewedAt" = $3, "updatedAt" = $3
      WHERE "id" = $1`,
    [completed[0], fixtures.reviewerId, reviewedAt],
  );
  await client.query(
    INSERT_ASSESSMENT_SQL,
    assessmentParameters(fixtures, { evidenceId: fixtures.reviewEvidenceId }),
  );

  await expectSqlFailure(
    client,
    'DELETE FROM "PlatformUser" WHERE "id" = $1',
    [fixtures.requesterId],
    '23503',
    'VisualProgressAssessment_requestedById_fkey',
    'VisualProgressAssessment requester retention policy',
  );

  const secondBudgetAssessment = assessmentParameters(fixtures, {
    evidenceId: fixtures.secondBudgetEvidenceId,
  });
  await client.query(INSERT_ASSESSMENT_SQL, secondBudgetAssessment);
  await applyDispatchBudgetAudit(client, {
    assessmentId: secondBudgetAssessment[0],
    civilDayUtc,
    reservationMicros: 400,
  });
  const blockedBudgetAssessment = assessmentParameters(fixtures, {
    evidenceId: fixtures.blockedBudgetEvidenceId,
  });
  await client.query(INSERT_ASSESSMENT_SQL, blockedBudgetAssessment);
  await applyDispatchBudgetAudit(client, {
    assessmentId: blockedBudgetAssessment[0],
    civilDayUtc,
    reservationMicros: 1,
  });

  const firstReservation = await client.query(
    `SELECT * FROM "obrasaas_ai_daily_budget_reserve"(
       $1, $2::date, 'visual-progress', 'ai-budget-v1', 1000, 600
     )`,
    [pending[0], civilDayUtc],
  );
  invariant(
    firstReservation.rows[0]?.assessmentId === pending[0]
      && firstReservation.rows[0]?.status === 'RESERVED'
      && String(firstReservation.rows[0]?.reservedMicros) === '600'
      && firstReservation.rows[0]?.revision === 0,
    'First AI assessment reservation did not persist its exact identity.',
  );
  const exactReservationReplay = await client.query(
    `SELECT * FROM "obrasaas_ai_daily_budget_reserve"(
       $1, $2::date, 'visual-progress', 'ai-budget-v1', 1000, 600
     )`,
    [pending[0], civilDayUtc],
  );
  invariant(
    exactReservationReplay.rows[0]?.assessmentId === pending[0]
      && exactReservationReplay.rows[0]?.status === 'RESERVED',
    'Exact reservation replay did not return its durable row.',
  );
  let ledger = await client.query(
    `SELECT "reservedMicros", "settledMicros", "requestCount", "revision"
       FROM "AiDailyBudgetLedger"
      WHERE "organizationId" = $1
        AND "civilDayUtc" = $2::date
        AND "workload" = 'visual-progress'`,
    [fixtures.organizationId, civilDayUtc],
  );
  invariant(
    String(ledger.rows[0]?.reservedMicros) === '600'
      && String(ledger.rows[0]?.settledMicros) === '0'
      && String(ledger.rows[0]?.requestCount) === '1'
      && ledger.rows[0]?.revision === 0,
    'Exact reservation replay mutated the daily aggregate.',
  );
  await expectSqlFailure(
    client,
    `SELECT "obrasaas_ai_daily_budget_reserve"(
       $1, $2::date, 'visual-progress', 'ai-budget-v1', 1000, 599
     )`,
    [pending[0], civilDayUtc],
    '23514',
    'AiDispatchBudgetReservation_replay_mismatch',
    'AI assessment reservation replay identity guard',
  );

  await client.query(
    `SELECT * FROM "obrasaas_ai_daily_budget_reserve"(
       $1, $2::date, 'visual-progress', 'ai-budget-v1', 1000, 400
     )`,
    [secondBudgetAssessment[0], civilDayUtc],
  );
  ledger = await client.query(
    `SELECT "reservedMicros", "settledMicros", "requestCount", "revision"
       FROM "AiDailyBudgetLedger"
      WHERE "organizationId" = $1
        AND "civilDayUtc" = $2::date
        AND "workload" = 'visual-progress'`,
    [fixtures.organizationId, civilDayUtc],
  );
  invariant(
    String(ledger.rows[0]?.reservedMicros) === '1000'
      && String(ledger.rows[0]?.requestCount) === '2'
      && ledger.rows[0]?.revision === 1,
    'Second assessment did not consume only the remaining budget headroom.',
  );

  const dispatchStartedAt = new Date(Date.now() + 5_000);
  await client.query(
    `UPDATE "VisualProgressAssessment"
        SET "providerDispatchStartedAt" = $2,
            "providerRequestId" = 'req_migration_verifier',
            "updatedAt" = $2
      WHERE "id" = $1`,
    [pending[0], dispatchStartedAt],
  );
  await expectSqlFailure(
    client,
    `UPDATE "VisualProgressAssessment"
        SET "inputTokens" = 300,
            "outputTokens" = 120,
            "totalTokens" = 419,
            "cachedInputTokens" = 100
      WHERE "id" = $1`,
    [pending[0]],
    '23514',
    'VisualProgressAssessment_dispatch_audit_check',
    'VisualProgressAssessment token accounting guard',
  );
  await client.query(
    `UPDATE "VisualProgressAssessment"
        SET "inputTokens" = 300,
            "outputTokens" = 120,
            "totalTokens" = 420,
            "cachedInputTokens" = 100
      WHERE "id" = $1`,
    [pending[0]],
  );
  await expectSqlFailure(
    client,
    `UPDATE "VisualProgressAssessment"
        SET "inputTokens" = 301,
            "totalTokens" = 421
      WHERE "id" = $1`,
    [pending[0]],
    '23514',
    'AiDispatchAudit_usage_immutable',
    'VisualProgressAssessment usage immutability guard',
  );
  await expectSqlFailure(
    client,
    `UPDATE "VisualProgressAssessment"
        SET "providerRequestId" = 'req_migration_verifier_rewritten'
      WHERE "id" = $1`,
    [pending[0]],
    '23514',
    'AiDispatchAudit_request_id_immutable',
    'VisualProgressAssessment provider correlation immutability guard',
  );

  const receiptReceivedAt = new Date(dispatchStartedAt.getTime() + 500);
  const normalizedReceipt = receiptParameters({
    assessmentId: pending[0],
    organizationId: fixtures.organizationId,
    projectId: fixtures.projectId,
    inputSha256: pending[9],
    receivedAt: receiptReceivedAt,
  });
  await expectSqlFailure(
    client,
    INSERT_RECEIPT_SQL,
    receiptParameters({
      assessmentId: pending[0],
      organizationId: fixtures.organizationId,
      projectId: fixtures.projectId,
      inputSha256: pending[9],
      receivedAt: receiptReceivedAt,
    }, { cacheWriteTokens: null }),
    '23514',
    'VPRR_usage_check',
    'Normalized visual provider receipt complete-usage guard',
  );
  await client.query(INSERT_RECEIPT_SQL, normalizedReceipt);

  await expectSqlFailure(
    client,
    `UPDATE "VisualProgressAssessment"
        SET "actualCostMicros" = 1
      WHERE "id" = $1`,
    [pending[0]],
    '23514',
    'AiDispatchAudit_settlement_required',
    'VisualProgressAssessment durable settlement requirement',
  );

  const failedAt = new Date(dispatchStartedAt.getTime() + 1_000);
  await client.query(
    `UPDATE "VisualProgressAssessment"
        SET "status" = 'FAILED',
            "attemptCount" = 1,
            "failureCode" = 'PROVIDER_TIMEOUT',
            "completedAt" = $2,
            "leaseExpiresAt" = NULL,
            "updatedAt" = $2
      WHERE "id" = $1`,
    [pending[0], failedAt],
  );
  const unsettledEvidenceReplay = assessmentParameters(fixtures, {
    evidenceId: fixtures.evidenceId,
    updatedAt: failedAt,
  });
  await client.query(INSERT_ASSESSMENT_SQL, unsettledEvidenceReplay);
  await expectSqlFailure(
    client,
    `UPDATE "VisualProgressAssessment"
        SET "registryModelId" = 'openai:gpt-5.6-sol',
            "providerRoute" = 'openai-responses-visual',
            "routePolicyVersion" = 'ai-dispatch-plan-v1',
            "routeReasonCode" = 'recovery_retry',
            "pricingVersion" = '2026-07-28',
            "budgetCivilDayUtc" = $2::date,
            "budgetWorkload" = 'visual-progress',
            "quotaPolicyVersion" = 'ai-budget-v1',
            "budgetLimitMicros" = 1000,
            "budgetReservationMicros" = 1,
            "estimateBasis" = 'pre-byte-conservative-cap',
            "estimatedCostMicros" = 1
      WHERE "id" = $1`,
    [unsettledEvidenceReplay[0], civilDayUtc],
    '23505',
    'VPA_project_evidence_unsettled_dispatch_key',
    'VisualProgressAssessment unsettled governed evidence fence',
  );
  await client.query(
    `DELETE FROM "VisualProgressAssessment" WHERE "id" = $1`,
    [unsettledEvidenceReplay[0]],
  );

  const projectedAt = new Date(failedAt.getTime() + 1_000);
  await client.query(
    `UPDATE "VisualProgressAssessment"
        SET "status" = 'COMPLETED',
            "attemptCount" = 1,
            "failureCode" = NULL,
            "summary" = 'Muro de mamposteria parcialmente ejecutado.',
            "elementType" = 'masonry-wall',
            "progressMin" = 45,
            "progressMax" = 55,
            "confidence" = 0.8,
            "quality" = $2::jsonb,
            "observations" = $3::jsonb,
            "limitations" = $4::jsonb,
            "providerResponseId" = 'resp_migration_verifier',
            "completedAt" = $5,
            "reviewStatus" = 'PENDING',
            "leaseExpiresAt" = NULL,
            "updatedAt" = $5
      WHERE "id" = $1`,
    [
      pending[0],
      JSON.stringify({
        overall: 'good', angle: 'good', lighting: 'good', occlusion: 'none',
      }),
      JSON.stringify(['Muro visible']),
      JSON.stringify(['Una sola toma']),
      projectedAt,
    ],
  );

  const responseSettlementOperation = 'c'.repeat(64);
  const responseReceiptSha256 = 'a'.repeat(64);
  const overrunSettlement = await client.query(
    `SELECT * FROM "obrasaas_ai_daily_budget_settle"(
       $1, 1200, 'RESPONSE_USAGE'::"AiDispatchSettlementBasis", $2, $3, NULL
     )`,
    [pending[0], responseSettlementOperation, responseReceiptSha256],
  );
  invariant(
    overrunSettlement.rows[0]?.assessmentId === pending[0]
      && overrunSettlement.rows[0]?.status === 'SETTLED'
      && String(overrunSettlement.rows[0]?.reservedMicros) === '600'
      && String(overrunSettlement.rows[0]?.actualMicros) === '1200'
      && overrunSettlement.rows[0]?.settlementBasis === 'RESPONSE_USAGE'
      && overrunSettlement.rows[0]?.settlementOperationKeyHash === responseSettlementOperation
      && overrunSettlement.rows[0]?.settlementEvidenceSha256 === responseReceiptSha256
      && overrunSettlement.rows[0]?.settledById == null
      && overrunSettlement.rows[0]?.revision === 1,
    'AI settlement did not retain truthful cost and exact receipt provenance.',
  );
  const exactSettlementReplay = await client.query(
    `SELECT * FROM "obrasaas_ai_daily_budget_settle"(
       $1, 1200, 'RESPONSE_USAGE'::"AiDispatchSettlementBasis", $2, $3, NULL
     )`,
    [pending[0], responseSettlementOperation, responseReceiptSha256],
  );
  invariant(
    exactSettlementReplay.rows[0]?.status === 'SETTLED'
      && String(exactSettlementReplay.rows[0]?.actualMicros) === '1200',
    'Exact settlement replay did not return its terminal durable row.',
  );
  await expectSqlFailure(
    client,
    `SELECT * FROM "obrasaas_ai_daily_budget_settle"(
       $1, 1200, 'RESPONSE_USAGE'::"AiDispatchSettlementBasis", $2, $3, NULL
     )`,
    [pending[0], 'd'.repeat(64), responseReceiptSha256],
    '23514',
    'AiDispatchBudgetReservation_settlement_replay_mismatch',
    'AI assessment settlement provenance replay guard',
  );

  const receiptAppliedAt = new Date(projectedAt.getTime() + 1_000);
  await client.query(
    `UPDATE "VisualProgressProviderResultReceipt"
        SET "appliedAt" = $2, "revision" = 1
      WHERE "assessmentId" = $1`,
    [pending[0], receiptAppliedAt],
  );
  const appliedReceipt = await client.query(
    `SELECT "receiptSha256", "appliedAt", "revision"
       FROM "VisualProgressProviderResultReceipt"
      WHERE "assessmentId" = $1`,
    [pending[0]],
  );
  invariant(
    appliedReceipt.rows[0]?.receiptSha256 === responseReceiptSha256
      && appliedReceipt.rows[0]?.appliedAt != null
      && appliedReceipt.rows[0]?.revision === 1,
    'Normalized visual provider receipt was not applied exactly once.',
  );
  await expectSqlFailure(
    client,
    `UPDATE "VisualProgressProviderResultReceipt"
        SET "summary" = 'contenido reescrito'
      WHERE "assessmentId" = $1`,
    [pending[0]],
    '23514',
    'VPRR_content_immutable',
    'Normalized visual provider receipt content immutability guard',
  );
  await expectDeferredConstraintFailure(
    client,
    'VPRR_assessment_retention',
    `DELETE FROM "VisualProgressProviderResultReceipt" WHERE "assessmentId" = $1`,
    [pending[0]],
    'VPRR_assessment_retention_guard',
    'Normalized visual provider receipt retention guard',
  );
  ledger = await client.query(
    `SELECT "reservedMicros", "settledMicros", "requestCount", "revision"
       FROM "AiDailyBudgetLedger"
      WHERE "organizationId" = $1
        AND "civilDayUtc" = $2::date
        AND "workload" = 'visual-progress'`,
    [fixtures.organizationId, civilDayUtc],
  );
  invariant(
    String(ledger.rows[0]?.reservedMicros) === '400'
      && String(ledger.rows[0]?.settledMicros) === '1200'
      && String(ledger.rows[0]?.requestCount) === '2'
      && ledger.rows[0]?.revision === 2,
    'Overrun settlement did not preserve the other assessment reservation.',
  );
  const assessmentCost = await client.query(
    `SELECT "actualCostMicros" FROM "VisualProgressAssessment" WHERE "id" = $1`,
    [pending[0]],
  );
  invariant(
    String(assessmentCost.rows[0]?.actualCostMicros) === '1200',
    'Truthful overrun cost was not compare-and-set on the assessment.',
  );
  await expectSqlFailure(
    client,
    `UPDATE "VisualProgressAssessment"
        SET "actualCostMicros" = 1199
      WHERE "id" = $1`,
    [pending[0]],
    '23514',
    'AiDispatchAudit_actual_cost_immutable',
    'VisualProgressAssessment actual cost immutability guard',
  );
  const settledReviewAt = new Date(receiptAppliedAt.getTime() + 1_000);
  await client.query(
    `UPDATE "VisualProgressAssessment"
        SET "reviewStatus" = 'APPROVED',
            "reviewedById" = $2,
            "reviewedAt" = $3,
            "updatedAt" = $3
      WHERE "id" = $1`,
    [pending[0], fixtures.reviewerId, settledReviewAt],
  );
  const postSettlementReplay = assessmentParameters(fixtures, {
    evidenceId: fixtures.evidenceId,
  });
  await client.query(INSERT_ASSESSMENT_SQL, postSettlementReplay);
  await applyDispatchBudgetAudit(client, {
    assessmentId: postSettlementReplay[0],
    civilDayUtc,
    reservationMicros: 0,
  });
  const admittedPostSettlementReplay = await client.query(
    `SELECT "registryModelId", "actualCostMicros"
       FROM "VisualProgressAssessment"
      WHERE "id" = $1`,
    [postSettlementReplay[0]],
  );
  invariant(
    admittedPostSettlementReplay.rows[0]?.registryModelId === 'openai:gpt-5.6-sol'
      && admittedPostSettlementReplay.rows[0]?.actualCostMicros == null,
    'Settled evidence did not release its governed dispatch fence.',
  );
  await client.query(
    `DELETE FROM "VisualProgressAssessment" WHERE "id" = $1`,
    [postSettlementReplay[0]],
  );

  await expectSqlFailure(
    client,
    `UPDATE "AiDispatchBudgetReservation"
        SET "actualMicros" = 0,
            "status" = 'RELEASED',
            "settlementBasis" = 'PRE_DISPATCH_RELEASE',
            "settlementOperationKeyHash" = $2,
            "settlementEvidenceSha256" = $3,
            "settledAt" = CURRENT_TIMESTAMP,
            "revision" = 1,
            "updatedAt" = CURRENT_TIMESTAMP
      WHERE "assessmentId" = $1`,
    [secondBudgetAssessment[0], 'e'.repeat(64), secondBudgetAssessment[5]],
    '23514',
    'AiDispatchBudgetReservation_transition_guard',
    'AI reservation direct terminal-transition guard',
  );
  await expectSqlFailure(
    client,
    `SELECT * FROM "obrasaas_ai_daily_budget_settle"(
       $1, 1, 'RESPONSE_USAGE'::"AiDispatchSettlementBasis", $2, $3, NULL
     )`,
    [secondBudgetAssessment[0], 'f'.repeat(64), '9'.repeat(64)],
    '23514',
    'AiDispatchBudgetReservation_dispatch_start_guard',
    'AI settlement dispatch-start guard',
  );
  ledger = await client.query(
    `SELECT "reservedMicros", "settledMicros" FROM "AiDailyBudgetLedger"
      WHERE "organizationId" = $1 AND "civilDayUtc" = $2::date
        AND "workload" = 'visual-progress'`,
    [fixtures.organizationId, civilDayUtc],
  );
  invariant(
    String(ledger.rows[0]?.reservedMicros) === '400'
      && String(ledger.rows[0]?.settledMicros) === '1200',
    'Rejected settlement consumed another assessment reservation.',
  );
  const releaseOperation = '7'.repeat(64);
  const releasedReservation = await client.query(
    `SELECT * FROM "obrasaas_ai_daily_budget_settle"(
       $1, 0, 'PRE_DISPATCH_RELEASE'::"AiDispatchSettlementBasis", $2, $3, NULL
     )`,
    [secondBudgetAssessment[0], releaseOperation, secondBudgetAssessment[5]],
  );
  invariant(
    releasedReservation.rows[0]?.status === 'RELEASED'
      && String(releasedReservation.rows[0]?.actualMicros) === '0'
      && releasedReservation.rows[0]?.settlementBasis === 'PRE_DISPATCH_RELEASE'
      && releasedReservation.rows[0]?.settlementOperationKeyHash === releaseOperation
      && releasedReservation.rows[0]?.settlementEvidenceSha256 === secondBudgetAssessment[5]
      && releasedReservation.rows[0]?.settledById == null,
    'A never-dispatched assessment did not release its own reservation.',
  );
  const exactReleaseReplay = await client.query(
    `SELECT * FROM "obrasaas_ai_daily_budget_settle"(
       $1, 0, 'PRE_DISPATCH_RELEASE'::"AiDispatchSettlementBasis", $2, $3, NULL
     )`,
    [secondBudgetAssessment[0], releaseOperation, secondBudgetAssessment[5]],
  );
  invariant(
    exactReleaseReplay.rows[0]?.status === 'RELEASED'
      && exactReleaseReplay.rows[0]?.settlementOperationKeyHash === releaseOperation,
    'Exact pre-dispatch release replay did not return its terminal provenance.',
  );
  await expectDeferredConstraintFailure(
    client,
    'AiDispatchBudgetReservation_assessment_retention',
    `DELETE FROM "AiDispatchBudgetReservation" WHERE "assessmentId" = $1`,
    [secondBudgetAssessment[0]],
    'AiDispatchBudgetReservation_assessment_retention_guard',
    'AI reservation retention guard',
  );
  ledger = await client.query(
    `SELECT "reservedMicros", "settledMicros", "requestCount", "revision"
       FROM "AiDailyBudgetLedger"
      WHERE "organizationId" = $1 AND "civilDayUtc" = $2::date
        AND "workload" = 'visual-progress'`,
    [fixtures.organizationId, civilDayUtc],
  );
  invariant(
    String(ledger.rows[0]?.reservedMicros) === '0'
      && String(ledger.rows[0]?.settledMicros) === '1200'
      && String(ledger.rows[0]?.requestCount) === '2'
      && ledger.rows[0]?.revision === 3,
    'Release did not preserve truthful overrun and exact request count.',
  );

  await expectSqlFailure(
    client,
    `SELECT * FROM "obrasaas_ai_daily_budget_reserve"(
       $1, $2::date, 'visual-progress', 'ai-budget-v1', 1000, 1
     )`,
    [blockedBudgetAssessment[0], civilDayUtc],
    '23514',
    'AiDailyBudgetLedger_budget_exceeded',
    'AI post-overrun admission guard',
  );
  await expectSqlFailure(
    client,
    `INSERT INTO "AiDispatchBudgetReservation" (
       "assessmentId", "organizationId", "projectId", "civilDayUtc",
       "workload", "quotaPolicyVersion", "budgetLimitMicros",
       "reservedMicros", "updatedAt"
     ) VALUES ($1, $2, $3, $4::date, 'visual-progress', 'ai-budget-v1', 1000, 1,
       CURRENT_TIMESTAMP)`,
    [
      blockedBudgetAssessment[0],
      fixtures.organizationId,
      fixtures.projectId,
      civilDayUtc,
    ],
    '23514',
    'AiDispatchBudgetReservation_insert_guard',
    'AI reservation direct insert guard',
  );
  await expectSqlFailure(
    client,
    `UPDATE "AiDailyBudgetLedger"
        SET "settledMicros" = "settledMicros" + 1,
            "revision" = "revision" + 1,
            "updatedAt" = CURRENT_TIMESTAMP
      WHERE "organizationId" = $1 AND "civilDayUtc" = $2::date
        AND "workload" = 'visual-progress'`,
    [fixtures.organizationId, civilDayUtc],
    '23514',
    'AiDailyBudgetLedger_transition_guard',
    'AI daily budget direct update guard',
  );
  await expectSqlFailure(
    client,
    `DELETE FROM "AiDailyBudgetLedger"
      WHERE "organizationId" = $1 AND "civilDayUtc" = $2::date
        AND "workload" = 'visual-progress'`,
    [fixtures.organizationId, civilDayUtc],
    '23503',
    'AiDispatchBudgetReservation_daily_ledger_fkey',
    'AI reservation ledger retention policy',
  );
  await expectSqlFailure(
    client,
    `INSERT INTO "AiDailyBudgetLedger" (
       "organizationId", "civilDayUtc", "workload", "quotaPolicyVersion",
       "budgetLimitMicros", "reservedMicros", "settledMicros", "updatedAt"
     ) VALUES ($1, $2::date, 'document-ocr', 'ai-budget-v1', 1000, 0, 0, $3)`,
    [fixtures.organizationId, civilDayUtc, now],
    '23514',
    'AiDailyBudgetLedger_transition_guard',
    'AI daily budget direct insert guard',
  );

  const clearedMarkers = await client.query(
    `SELECT
       current_setting('obrasaas.ai_budget_ledger_key', true) AS ledger_key,
       current_setting('obrasaas.ai_budget_ledger_action', true) AS ledger_action,
       current_setting('obrasaas.ai_budget_ledger_reserved_delta', true) AS reserved_delta,
       current_setting('obrasaas.ai_budget_ledger_settled_delta', true) AS settled_delta,
       current_setting('obrasaas.ai_reservation_insert_assessment', true) AS reservation_insert,
       current_setting('obrasaas.ai_settlement_assessment', true) AS settlement_assessment`,
  );
  invariant(
    Object.values(clearedMarkers.rows[0] || {}).every((value) => value === ''),
    'AI budget transaction-local capability markers leaked after success.',
  );

  await expectDeferredConstraintFailure(
    client,
    'AiDispatchBudgetReservation_assessment_retention',
    `DELETE FROM "VisualProgressAssessment" WHERE "id" = $1`,
    [secondBudgetAssessment[0]],
    'AiDispatchBudgetReservation_assessment_retention_guard',
    'Governed assessment tenant-lifetime retention guard',
  );
  await expectDeferredConstraintFailure(
    client,
    'AiDispatchBudgetReservation_assessment_retention',
    `DELETE FROM "Project" WHERE "id" = $1`,
    [fixtures.projectId],
    'AiDispatchBudgetReservation_assessment_retention_guard',
    'Governed project tenant-lifetime retention guard',
  );
  ledger = await client.query(
    `SELECT "reservedMicros", "settledMicros"
       FROM "AiDailyBudgetLedger"
      WHERE "organizationId" = $1 AND "civilDayUtc" = $2::date
        AND "workload" = 'visual-progress'`,
    [fixtures.organizationId, civilDayUtc],
  );
  invariant(
    String(ledger.rows[0]?.reservedMicros) === '0'
      && String(ledger.rows[0]?.settledMicros) === '1200',
    'Rejected assessment/project deletion changed the authoritative ledger.',
  );

  await expectDeferredConstraintFailure(
    client,
    'VisualProgressAssessment_budget_reservation_required',
    'SELECT 1',
    [],
    'VisualProgressAssessment_budget_reservation_required',
    'Governed assessment deferred reservation requirement',
  );

  const deletedTenant = await client.query(
    `DELETE FROM "Organization" WHERE "id" = $1 RETURNING "id"`,
    [fixtures.organizationId],
  );
  invariant(
    deletedTenant.rowCount === 1,
    'Tenant cascade did not delete the governed AI budget graph.',
  );
  await client.query('SET CONSTRAINTS ALL IMMEDIATE');
  const retainedBudgetRows = await client.query(
    `SELECT
       (SELECT count(*) FROM "AiDispatchBudgetReservation"
         WHERE "organizationId" = $1)::INTEGER AS reservations,
       (SELECT count(*) FROM "AiDailyBudgetLedger"
         WHERE "organizationId" = $1)::INTEGER AS ledgers,
       (SELECT count(*) FROM "VisualProgressProviderResultReceipt"
         WHERE "organizationId" = $1)::INTEGER AS receipts,
       (SELECT count(*) FROM "Project"
         WHERE "organizationId" = $1)::INTEGER AS projects`,
    [fixtures.organizationId],
  );
  invariant(
    retainedBudgetRows.rows[0]?.reservations === 0
      && retainedBudgetRows.rows[0]?.ledgers === 0
      && retainedBudgetRows.rows[0]?.receipts === 0
      && retainedBudgetRows.rows[0]?.projects === 0,
    'Tenant cascade retained part of the governed AI budget graph.',
  );
}

const client = new pg.Client({
  connectionString: verifierConnectionString,
  application_name: 'obrasaas-visual-progress-migration-verifier',
  statement_timeout: 30_000,
  query_timeout: 35_000,
});

let connected = false;
let transactionOpen = false;
try {
  try {
    await client.connect();
    connected = true;
  } catch {
    throw new Error('Unable to connect to the dedicated visual progress verification database.');
  }
  await client.query('BEGIN');
  transactionOpen = true;
  const schemaExists = await client.query(
    'SELECT to_regnamespace($1) IS NOT NULL AS exists',
    [databaseSchema],
  );
  invariant(
    schemaExists.rows[0]?.exists,
    `Configured PostgreSQL schema ${databaseSchema} does not exist.`,
  );
  await client.query(`SET LOCAL search_path TO ${quoteIdentifier(databaseSchema)}, pg_catalog`);
  const activeSchema = await client.query('SELECT current_schema() AS name');
  invariant(
    activeSchema.rows[0]?.name === databaseSchema,
    'PostgreSQL did not activate the configured visual progress migration schema.',
  );
  await client.query("SET LOCAL lock_timeout = '5s'");
  await client.query("SET LOCAL idle_in_transaction_session_timeout = '30s'");
  await assertMigrations(client);
  await assertTables(client);
  await assertEnums(client);
  await assertColumns(client);
  await assertReceiptColumns(client);
  await assertLedgerColumns(client);
  await assertReservationColumns(client);
  await assertChecks(client);
  await assertReceiptChecks(client);
  await assertLedgerChecks(client);
  await assertReservationChecks(client);
  await assertIndexes(client);
  await assertReceiptIndexes(client);
  await assertLedgerIndexes(client);
  await assertReservationIndexes(client);
  await assertForeignKeys(client);
  await assertReceiptForeignKeys(client);
  await assertLedgerForeignKey(client);
  await assertReservationForeignKeys(client);
  await assertBudgetFunctions(client);
  await assertDispatchAuditTrigger(client);
  await assertPersistenceTriggers(client);
  await assertTransactionalSmoke(client);
  console.log(
    'Verified visual progress migrations: governed lifecycle, dispatch audit, concurrent daily budget admission and rollback-only smoke.',
  );
  await client.query('ROLLBACK');
  transactionOpen = false;
} finally {
  if (transactionOpen) {
    await client.query('ROLLBACK').catch(() => undefined);
  }
  if (connected) {
    await client.end();
  }
}
