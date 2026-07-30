import { randomUUID } from 'node:crypto';

import pg from 'pg';

const CONNECTION_ENV = 'SCHEDULE_SNAPSHOT_MIGRATION_DATABASE_URL';
const SCHEMA_ENV = 'SCHEDULE_SNAPSHOT_MIGRATION_SCHEMA';
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
      'The schedule snapshot migration schema must be a safe PostgreSQL identifier of at most 63 ASCII characters.',
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
    .replace(/'(-?\d+(?:\.\d+)?)'/g, '$1')
    .replaceAll('"', '')
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePredicate(value) {
  return normalizeDefinition(value).replace(/\s+/g, '');
}

const databaseSchema = resolveDatabaseSchema(connectionString);
const verifierConnectionString = hardenedVerifierConnectionString(connectionString);

const EXPECTED_MIGRATIONS = Object.freeze([
  '20260726190000_schedule_baseline_forecast_snapshots',
  '20260728040000_schedule_snapshot_request_fingerprints',
  '20260729120000_reviewed_progress_forecast_provenance',
]);

const EXPECTED_ENUMS = Object.freeze({
  ScheduleBaselineStatus: ['ACTIVE', 'SUPERSEDED'],
  ScheduleCalendarPolicy: ['CIVIL_CALENDAR_DAYS_V1'],
  ScheduleProgressSource: [
    'CANONICAL_TASK',
    'MANUAL_OVERRIDE',
    'REVIEWED_EVIDENCE',
  ],
  VisualProgressAssessmentReviewStatus: [
    'PENDING',
    'APPROVED',
    'CORRECTED',
    'REJECTED',
  ],
});

const TABLES = Object.freeze([
  'ScheduleBaseline',
  'ScheduleBaselineTask',
  'ScheduleBaselineDependency',
  'ScheduleForecastRun',
  'ScheduleForecastTask',
  'ScheduleProgressObservation',
]);

const REQUIRED_TABLES = Object.freeze([
  ...TABLES,
  'Organization',
  'Project',
  'PlatformUser',
  'Task',
  'ProgressEvidence',
  'VisualProgressAssessment',
  'ReplanScenario',
]);

const TEXT = Object.freeze({ nullable: 'NO', dataType: 'text', udtName: 'text' });
const NULLABLE_TEXT = Object.freeze({ nullable: 'YES', dataType: 'text', udtName: 'text' });
const INTEGER = Object.freeze({ nullable: 'NO', dataType: 'integer', udtName: 'int4' });
const DATE = Object.freeze({ nullable: 'NO', dataType: 'date', udtName: 'date' });
const NULLABLE_DATE = Object.freeze({ nullable: 'YES', dataType: 'date', udtName: 'date' });
const JSONB = Object.freeze({ nullable: 'NO', dataType: 'jsonb', udtName: 'jsonb' });
const TIMESTAMP = Object.freeze({
  nullable: 'NO',
  dataType: 'timestamp without time zone',
  udtName: 'timestamp',
  datetimePrecision: 3,
});
const CREATED_AT = Object.freeze({ ...TIMESTAMP, defaultPattern: /^CURRENT_TIMESTAMP$/i });

function varchar(length, nullable = false) {
  return {
    nullable: nullable ? 'YES' : 'NO',
    dataType: 'character varying',
    udtName: 'varchar',
    maxLength: length,
  };
}

function char(length) {
  return {
    nullable: 'NO',
    dataType: 'character',
    udtName: 'bpchar',
    maxLength: length,
  };
}

function enumeration(name, defaultValue = null) {
  return {
    nullable: 'NO',
    dataType: 'USER-DEFINED',
    udtName: name,
    ...(defaultValue ? { defaultPattern: new RegExp(`'${defaultValue}'`) } : {}),
  };
}

const EXPECTED_COLUMNS = Object.freeze({
  ScheduleBaseline: [
    ['id', TEXT],
    ['organizationId', TEXT],
    ['projectId', TEXT],
    ['version', INTEGER],
    ['status', enumeration('ScheduleBaselineStatus', 'ACTIVE')],
    ['name', varchar(220)],
    ['timeZone', varchar(64)],
    ['calendarPolicy', enumeration('ScheduleCalendarPolicy', 'CIVIL_CALENDAR_DAYS_V1')],
    ['operationKeyHash', char(64)],
    ['sourcePlanHash', char(64)],
    ['contentHash', char(64)],
    ['taskCount', INTEGER],
    ['dependencyCount', INTEGER],
    ['publishedAt', { ...TIMESTAMP, defaultPattern: /^CURRENT_TIMESTAMP$/i }],
    ['createdAt', CREATED_AT],
    ['supersededAt', { ...TIMESTAMP, nullable: 'YES' }],
    ['supersededById', NULLABLE_TEXT],
    ['supersessionHash', { ...char(64), nullable: 'YES' }],
    ['requestFingerprint', char(64)],
  ],
  ScheduleBaselineTask: [
    ['id', TEXT],
    ['organizationId', TEXT],
    ['projectId', TEXT],
    ['baselineId', TEXT],
    ['sourceTaskId', varchar(190)],
    ['sourceTaskRevision', INTEGER],
    ['code', varchar(64, true)],
    ['title', varchar(160)],
    ['description', NULLABLE_TEXT],
    ['type', enumeration('TaskType', 'TASK')],
    ['parentSourceTaskId', varchar(190, true)],
    ['plannedStart', DATE],
    ['plannedFinish', DATE],
    ['plannedDurationDays', INTEGER],
    ['createdAt', CREATED_AT],
  ],
  ScheduleBaselineDependency: [
    ['id', TEXT],
    ['organizationId', TEXT],
    ['projectId', TEXT],
    ['baselineId', TEXT],
    ['predecessorSourceTaskId', varchar(190)],
    ['successorSourceTaskId', varchar(190)],
    ['type', enumeration('TaskDependencyType', 'FINISH_TO_START')],
    ['lagDays', { ...INTEGER, defaultPattern: /^0$/ }],
    ['createdAt', CREATED_AT],
  ],
  ScheduleForecastRun: [
    ['id', TEXT],
    ['organizationId', TEXT],
    ['projectId', TEXT],
    ['baselineId', TEXT],
    ['scenarioId', { ...NULLABLE_TEXT }],
    ['scenarioRevision', { ...INTEGER, nullable: 'YES' }],
    ['scenarioInputHash', { ...char(64), nullable: 'YES' }],
    ['schemaVersion', { ...INTEGER, defaultPattern: /^1$/ }],
    ['engineVersion', varchar(64)],
    ['calendarPolicy', enumeration('ScheduleCalendarPolicy', 'CIVIL_CALENDAR_DAYS_V1')],
    ['operationKeyHash', char(64)],
    ['inputHash', char(64)],
    ['resultHash', char(64)],
    ['asOfDate', DATE],
    ['baselineStartDate', DATE],
    ['baselineFinishDate', DATE],
    ['forecastStartDate', DATE],
    ['forecastFinishDate', DATE],
    ['startDeltaDays', INTEGER],
    ['finishDeltaDays', INTEGER],
    ['taskCount', INTEGER],
    ['topologicalOrder', JSONB],
    ['createdAt', CREATED_AT],
    ['requestFingerprint', char(64)],
  ],
  ScheduleForecastTask: [
    ['id', TEXT],
    ['organizationId', TEXT],
    ['projectId', TEXT],
    ['forecastRunId', TEXT],
    ['baselineId', TEXT],
    ['sourceTaskId', varchar(190)],
    ['observedTaskRevision', INTEGER],
    ['progressSource', enumeration('ScheduleProgressSource')],
    ['progressPercent', INTEGER],
    ['observedOn', DATE],
    ['actualStart', NULLABLE_DATE],
    ['actualFinish', NULLABLE_DATE],
    ['remainingDurationDays', { ...INTEGER, nullable: 'YES' }],
    ['baselineStart', DATE],
    ['baselineFinish', DATE],
    ['forecastStart', DATE],
    ['forecastFinish', DATE],
    ['forecastDurationDays', INTEGER],
    ['forecastRemainingDays', INTEGER],
    ['startDeltaDays', INTEGER],
    ['finishDeltaDays', INTEGER],
    ['durationDeltaDays', INTEGER],
    ['driver', JSONB],
    ['relationshipConstraints', JSONB],
    ['createdAt', CREATED_AT],
    ['progressObservationId', NULLABLE_TEXT],
  ],
  ScheduleProgressObservation: [
    ['id', TEXT],
    ['organizationId', TEXT],
    ['projectId', TEXT],
    ['taskId', TEXT],
    ['evidenceId', TEXT],
    ['assessmentId', TEXT],
    ['source', enumeration('ScheduleProgressSource', 'REVIEWED_EVIDENCE')],
    ['assessmentRevision', INTEGER],
    ['evidenceRevision', INTEGER],
    ['taskRevision', INTEGER],
    ['evidenceSha256', char(64)],
    ['evidenceCapturedAt', TIMESTAMP],
    ['planHash', char(64)],
    ['reviewStatus', enumeration('VisualProgressAssessmentReviewStatus')],
    ['reviewedById', TEXT],
    ['reviewedAt', TIMESTAMP],
    ['progressMin', INTEGER],
    ['progressMax', INTEGER],
    ['progressPercent', INTEGER],
    ['decisionPolicyVersion', {
      ...varchar(64),
      defaultPattern: /'human-point-within-reviewed-range-v1'/,
    }],
    ['observedOn', DATE],
    ['actualStart', NULLABLE_DATE],
    ['actualFinish', NULLABLE_DATE],
    ['remainingDurationDays', { ...INTEGER, nullable: 'YES' }],
    ['rationale', varchar(1000)],
    ['operationKeyHash', char(64)],
    ['requestFingerprint', char(64)],
    ['createdById', TEXT],
    ['createdAt', CREATED_AT],
  ],
});

const EXPECTED_CHECKS = Object.freeze({
  ScheduleBaseline_identity_check: {
    table: 'ScheduleBaseline',
    fragments: [
      'version >= 1',
      'version <= 2147483647',
      'taskCount >= 1',
      'taskCount <= 5000',
      'dependencyCount >= 0',
      'dependencyCount <= 100000',
      'dependencyCount <= taskCount * 100',
    ],
  },
  ScheduleBaseline_text_check: {
    table: 'ScheduleBaseline',
    fragments: ['name', 'timeZone', '^[A-Za-z0-9._+/-]{1,64}$'],
  },
  ScheduleBaseline_hashes_check: {
    table: 'ScheduleBaseline',
    fragments: ['operationKeyHash', 'sourcePlanHash', 'contentHash', '^[0-9a-f]{64}$'],
  },
  ScheduleBaseline_lifecycle_check: {
    table: 'ScheduleBaseline',
    fragments: [
      "status = 'ACTIVE'",
      'supersededAt IS NULL',
      'supersededById IS NULL',
      'supersessionHash IS NULL',
      "status = 'SUPERSEDED'",
      'supersededAt IS NOT NULL',
      'supersededAt >= createdAt',
      'supersededById IS NOT NULL',
      'supersessionHash IS NOT NULL',
      '^[0-9a-f]{64}$',
    ],
  },
  ScheduleBaseline_request_fingerprint_check: {
    table: 'ScheduleBaseline',
    fragments: ['requestFingerprint', '^[0-9a-f]{64}$'],
  },
  ScheduleBaselineTask_identity_check: {
    table: 'ScheduleBaselineTask',
    fragments: ['sourceTaskRevision >= 0', 'sourceTaskId', 'parentSourceTaskId <> sourceTaskId'],
  },
  ScheduleBaselineTask_text_check: {
    table: 'ScheduleBaselineTask',
    fragments: ['title', 'code', 'description', '4000'],
  },
  ScheduleBaselineTask_dates_check: {
    table: 'ScheduleBaselineTask',
    fragments: [
      "type = 'MILESTONE'",
      'plannedFinish = plannedStart',
      'plannedDurationDays = 0',
      "type = 'TASK'",
      'plannedDurationDays >= 1',
      'plannedDurationDays <= 36500',
      'plannedFinish - plannedStart + 1 = plannedDurationDays',
    ],
  },
  ScheduleBaselineDependency_edge_check: {
    table: 'ScheduleBaselineDependency',
    fragments: [
      'predecessorSourceTaskId <> successorSourceTaskId',
      'lagDays >= -3650',
      'lagDays <= 3650',
    ],
  },
  ScheduleForecastRun_identity_check: {
    table: 'ScheduleForecastRun',
    fragments: [
      'schemaVersion >= 1',
      'schemaVersion <= 2147483647',
      'engineVersion',
      'scenarioId',
      'scenarioId IS NOT NULL',
      'scenarioRevision',
      'scenarioInputHash',
      'taskCount >= 1',
      'taskCount <= 5000',
    ],
  },
  ScheduleForecastRun_hashes_check: {
    table: 'ScheduleForecastRun',
    fragments: ['operationKeyHash', 'inputHash', 'resultHash', '^[0-9a-f]{64}$'],
  },
  ScheduleForecastRun_request_fingerprint_check: {
    table: 'ScheduleForecastRun',
    fragments: ['requestFingerprint', '^[0-9a-f]{64}$'],
  },
  ScheduleForecastRun_range_check: {
    table: 'ScheduleForecastRun',
    fragments: [
      'baselineFinishDate >= baselineStartDate',
      'forecastFinishDate >= forecastStartDate',
      'forecastStartDate - baselineStartDate = startDeltaDays',
      'forecastFinishDate - baselineFinishDate = finishDeltaDays',
    ],
  },
  ScheduleForecastRun_topology_check: {
    table: 'ScheduleForecastRun',
    fragments: ['jsonb_typeoftopologicalOrder', 'jsonb_array_lengthtopologicalOrder = taskCount', '1048576'],
  },
  ScheduleForecastTask_identity_check: {
    table: 'ScheduleForecastTask',
    fragments: ['observedTaskRevision >= 0', 'sourceTaskId'],
  },
  ScheduleForecastTask_progress_check: {
    table: 'ScheduleForecastTask',
    fragments: [
      'progressPercent = 0',
      'remainingDurationDays IS NULL',
      'progressPercent >= 1',
      'progressPercent <= 99',
      'remainingDurationDays IS NOT NULL',
      'remainingDurationDays >= 1',
      'remainingDurationDays <= 36500',
      'progressPercent = 100',
      'actualFinish >= actualStart',
      'actualFinish <= observedOn',
    ],
  },
  ScheduleForecastTask_dates_check: {
    table: 'ScheduleForecastTask',
    fragments: [
      'baselineFinish >= baselineStart',
      'forecastFinish >= forecastStart',
      'forecastDurationDays >= 0',
      'forecastDurationDays <= 36500',
      'forecastStart - baselineStart = startDeltaDays',
      'forecastFinish - baselineFinish = finishDeltaDays',
    ],
  },
  ScheduleForecastTask_explanation_check: {
    table: 'ScheduleForecastTask',
    fragments: [
      'jsonb_typeofdriver',
      "driver ? 'kind'",
      'DATA_DATE_AND_REMAINING_DURATION',
      'jsonb_typeofrelationshipConstraints',
      'jsonb_array_lengthrelationshipConstraints <= 100',
      '131072',
    ],
  },
  ScheduleForecastTask_progress_observation_check: {
    table: 'ScheduleForecastTask',
    fragments: [
      "progressSource = 'CANONICAL_TASK'",
      'progressObservationId IS NULL',
      "progressSource = 'REVIEWED_EVIDENCE'",
      'progressObservationId IS NOT NULL',
    ],
    forbiddenFragments: ["progressSource = 'MANUAL_OVERRIDE'"],
  },
  ScheduleProgressObservation_identity_check: {
    table: 'ScheduleProgressObservation',
    fragments: [
      'assessmentRevision >= 0',
      'evidenceRevision >= 0',
      'taskRevision >= 0',
      'taskId',
      'evidenceId',
      'assessmentId',
      'reviewedById',
      'createdById',
    ],
  },
  ScheduleProgressObservation_provenance_check: {
    table: 'ScheduleProgressObservation',
    fragments: [
      "source = 'REVIEWED_EVIDENCE'",
      'reviewStatus',
      'APPROVED',
      'CORRECTED',
    ],
  },
  ScheduleProgressObservation_hashes_check: {
    table: 'ScheduleProgressObservation',
    fragments: [
      'evidenceSha256',
      'planHash',
      'operationKeyHash',
      'requestFingerprint',
      '^[0-9a-f]{64}$',
    ],
  },
  ScheduleProgressObservation_reviewed_range_check: {
    table: 'ScheduleProgressObservation',
    fragments: [
      'progressMin >= 0',
      'progressMin <= 100',
      'progressMax >= 0',
      'progressMax <= 100',
      'progressPercent >= 0',
      'progressPercent <= 100',
      'progressMin <= progressPercent',
      'progressPercent <= progressMax',
    ],
  },
  ScheduleProgressObservation_decision_policy_check: {
    table: 'ScheduleProgressObservation',
    fragments: ["decisionPolicyVersion = 'human-point-within-reviewed-range-v1'"],
  },
  ScheduleProgressObservation_progress_state_check: {
    table: 'ScheduleProgressObservation',
    fragments: [
      'progressPercent = 0',
      'actualStart IS NULL',
      'actualFinish IS NULL',
      'remainingDurationDays IS NULL',
      'progressPercent >= 1',
      'progressPercent <= 99',
      'actualStart <= observedOn',
      'remainingDurationDays >= 1',
      'remainingDurationDays <= 3650',
      'progressPercent = 100',
      'actualFinish >= actualStart',
      'actualFinish <= observedOn',
    ],
  },
  ScheduleProgressObservation_timestamps_check: {
    table: 'ScheduleProgressObservation',
    fragments: [
      'evidenceCapturedAt <= reviewedAt',
      'reviewedAt <= createdAt',
    ],
  },
  ScheduleProgressObservation_rationale_check: {
    table: 'ScheduleProgressObservation',
    fragments: ['rationale', '1000', '[[:cntrl:]]'],
  },
});

const ACTIVE_BASELINE_PREDICATE = normalizePredicate("status = 'ACTIVE'");

const EXPECTED_INDEXES = Object.freeze({
  ScheduleBaseline_pkey: {
    table: 'ScheduleBaseline', columns: ['id'], unique: true, primary: true,
  },
  ScheduleBaseline_scope_id_key: {
    table: 'ScheduleBaseline', columns: ['organizationId', 'projectId', 'id'], unique: true,
  },
  ScheduleBaseline_scope_version_key: {
    table: 'ScheduleBaseline', columns: ['organizationId', 'projectId', 'version'], unique: true,
  },
  ScheduleBaseline_scope_operation_key: {
    table: 'ScheduleBaseline', columns: ['organizationId', 'projectId', 'operationKeyHash'], unique: true,
  },
  ScheduleBaseline_scope_superseded_by_key: {
    table: 'ScheduleBaseline', columns: ['organizationId', 'projectId', 'supersededById'], unique: true,
  },
  ScheduleBaseline_scope_supersession_hash_key: {
    table: 'ScheduleBaseline', columns: ['organizationId', 'projectId', 'supersessionHash'], unique: true,
  },
  ScheduleBaseline_one_active_per_project_key: {
    table: 'ScheduleBaseline',
    columns: ['organizationId', 'projectId'],
    unique: true,
    predicate: ACTIVE_BASELINE_PREDICATE,
  },
  ScheduleBaseline_scope_status_version_idx: {
    table: 'ScheduleBaseline',
    columns: ['organizationId', 'projectId', 'status', 'version'],
    unique: false,
  },
  ScheduleBaselineTask_pkey: {
    table: 'ScheduleBaselineTask', columns: ['id'], unique: true, primary: true,
  },
  ScheduleBaselineTask_scope_source_key: {
    table: 'ScheduleBaselineTask',
    columns: ['organizationId', 'projectId', 'baselineId', 'sourceTaskId'],
    unique: true,
  },
  ScheduleBaselineTask_scope_parent_idx: {
    table: 'ScheduleBaselineTask',
    columns: ['organizationId', 'projectId', 'baselineId', 'parentSourceTaskId'],
    unique: false,
  },
  ScheduleBaselineDependency_pkey: {
    table: 'ScheduleBaselineDependency', columns: ['id'], unique: true, primary: true,
  },
  ScheduleBaselineDependency_scope_edge_key: {
    table: 'ScheduleBaselineDependency',
    columns: [
      'organizationId',
      'projectId',
      'baselineId',
      'predecessorSourceTaskId',
      'successorSourceTaskId',
    ],
    unique: true,
  },
  ScheduleBaselineDependency_scope_successor_idx: {
    table: 'ScheduleBaselineDependency',
    columns: ['organizationId', 'projectId', 'baselineId', 'successorSourceTaskId'],
    unique: false,
  },
  ScheduleForecastRun_pkey: {
    table: 'ScheduleForecastRun', columns: ['id'], unique: true, primary: true,
  },
  ScheduleForecastRun_scope_id_key: {
    table: 'ScheduleForecastRun', columns: ['organizationId', 'projectId', 'id'], unique: true,
  },
  ScheduleForecastRun_scope_baseline_key: {
    table: 'ScheduleForecastRun',
    columns: ['organizationId', 'projectId', 'id', 'baselineId'],
    unique: true,
  },
  ScheduleForecastRun_scope_operation_key: {
    table: 'ScheduleForecastRun',
    columns: ['organizationId', 'projectId', 'operationKeyHash'],
    unique: true,
  },
  ScheduleForecastRun_project_scenario_created_idx: {
    table: 'ScheduleForecastRun',
    columns: ['projectId', 'scenarioId', 'createdAt'],
    unique: false,
  },
  ScheduleForecastRun_scope_baseline_created_idx: {
    table: 'ScheduleForecastRun',
    columns: ['organizationId', 'projectId', 'baselineId', 'createdAt'],
    unique: false,
  },
  ScheduleForecastTask_pkey: {
    table: 'ScheduleForecastTask', columns: ['id'], unique: true, primary: true,
  },
  ScheduleForecastTask_scope_source_key: {
    table: 'ScheduleForecastTask',
    columns: ['organizationId', 'projectId', 'forecastRunId', 'sourceTaskId'],
    unique: true,
  },
  ScheduleForecastTask_scope_finish_delta_idx: {
    table: 'ScheduleForecastTask',
    columns: ['organizationId', 'projectId', 'forecastRunId', 'finishDeltaDays'],
    unique: false,
  },
  ScheduleForecastTask_scope_progress_observation_idx: {
    table: 'ScheduleForecastTask',
    columns: ['organizationId', 'projectId', 'progressObservationId'],
    unique: false,
  },
  ScheduleProgressObservation_pkey: {
    table: 'ScheduleProgressObservation', columns: ['id'], unique: true, primary: true,
  },
  ScheduleProgressObservation_scope_id_key: {
    table: 'ScheduleProgressObservation',
    columns: ['organizationId', 'projectId', 'id'],
    unique: true,
  },
  ScheduleProgressObservation_scope_assessment_revision_key: {
    table: 'ScheduleProgressObservation',
    columns: ['organizationId', 'projectId', 'assessmentId', 'assessmentRevision'],
    unique: true,
  },
  ScheduleProgressObservation_scope_operation_key: {
    table: 'ScheduleProgressObservation',
    columns: ['organizationId', 'projectId', 'operationKeyHash'],
    unique: true,
  },
  ScheduleProgressObservation_scope_task_observed_idx: {
    table: 'ScheduleProgressObservation',
    columns: ['organizationId', 'projectId', 'taskId', 'observedOn'],
    unique: false,
  },
  ScheduleProgressObservation_scope_evidence_created_idx: {
    table: 'ScheduleProgressObservation',
    columns: ['organizationId', 'projectId', 'evidenceId', 'createdAt'],
    unique: false,
  },
  ScheduleProgressObservation_reviewer_reviewed_idx: {
    table: 'ScheduleProgressObservation',
    columns: ['reviewedById', 'reviewedAt'],
    unique: false,
  },
});

const EXPECTED_FOREIGN_KEYS = Object.freeze({
  ScheduleBaseline_project_scope_fkey: {
    table: 'ScheduleBaseline',
    target: 'Project',
    columns: ['organizationId', 'projectId'],
    targetColumns: ['organizationId', 'id'],
    deferred: false,
  },
  ScheduleBaseline_superseded_by_scope_fkey: {
    table: 'ScheduleBaseline',
    target: 'ScheduleBaseline',
    columns: ['organizationId', 'projectId', 'supersededById'],
    targetColumns: ['organizationId', 'projectId', 'id'],
    deferred: true,
  },
  ScheduleBaselineTask_baseline_scope_fkey: {
    table: 'ScheduleBaselineTask',
    target: 'ScheduleBaseline',
    columns: ['organizationId', 'projectId', 'baselineId'],
    targetColumns: ['organizationId', 'projectId', 'id'],
    deferred: true,
  },
  ScheduleBaselineTask_parent_scope_fkey: {
    table: 'ScheduleBaselineTask',
    target: 'ScheduleBaselineTask',
    columns: ['organizationId', 'projectId', 'baselineId', 'parentSourceTaskId'],
    targetColumns: ['organizationId', 'projectId', 'baselineId', 'sourceTaskId'],
    deferred: true,
  },
  ScheduleBaselineDependency_baseline_scope_fkey: {
    table: 'ScheduleBaselineDependency',
    target: 'ScheduleBaseline',
    columns: ['organizationId', 'projectId', 'baselineId'],
    targetColumns: ['organizationId', 'projectId', 'id'],
    deferred: true,
  },
  ScheduleBaselineDependency_predecessor_scope_fkey: {
    table: 'ScheduleBaselineDependency',
    target: 'ScheduleBaselineTask',
    columns: ['organizationId', 'projectId', 'baselineId', 'predecessorSourceTaskId'],
    targetColumns: ['organizationId', 'projectId', 'baselineId', 'sourceTaskId'],
    deferred: true,
  },
  ScheduleBaselineDependency_successor_scope_fkey: {
    table: 'ScheduleBaselineDependency',
    target: 'ScheduleBaselineTask',
    columns: ['organizationId', 'projectId', 'baselineId', 'successorSourceTaskId'],
    targetColumns: ['organizationId', 'projectId', 'baselineId', 'sourceTaskId'],
    deferred: true,
  },
  ScheduleForecastRun_project_scope_fkey: {
    table: 'ScheduleForecastRun',
    target: 'Project',
    columns: ['organizationId', 'projectId'],
    targetColumns: ['organizationId', 'id'],
    deferred: false,
  },
  ScheduleForecastRun_baseline_scope_fkey: {
    table: 'ScheduleForecastRun',
    target: 'ScheduleBaseline',
    columns: ['organizationId', 'projectId', 'baselineId'],
    targetColumns: ['organizationId', 'projectId', 'id'],
    deferred: false,
  },
  ScheduleForecastRun_scenario_scope_fkey: {
    table: 'ScheduleForecastRun',
    target: 'ReplanScenario',
    columns: ['projectId', 'scenarioId'],
    targetColumns: ['projectId', 'id'],
    deferred: false,
  },
  ScheduleForecastTask_run_baseline_scope_fkey: {
    table: 'ScheduleForecastTask',
    target: 'ScheduleForecastRun',
    columns: ['organizationId', 'projectId', 'forecastRunId', 'baselineId'],
    targetColumns: ['organizationId', 'projectId', 'id', 'baselineId'],
    deferred: true,
  },
  ScheduleForecastTask_baseline_task_scope_fkey: {
    table: 'ScheduleForecastTask',
    target: 'ScheduleBaselineTask',
    columns: ['organizationId', 'projectId', 'baselineId', 'sourceTaskId'],
    targetColumns: ['organizationId', 'projectId', 'baselineId', 'sourceTaskId'],
    deferred: false,
  },
  ScheduleForecastTask_progress_observation_scope_fkey: {
    table: 'ScheduleForecastTask',
    target: 'ScheduleProgressObservation',
    columns: ['organizationId', 'projectId', 'progressObservationId'],
    targetColumns: ['organizationId', 'projectId', 'id'],
    deferred: false,
  },
  ScheduleProgressObservation_project_scope_fkey: {
    table: 'ScheduleProgressObservation',
    target: 'Project',
    columns: ['organizationId', 'projectId'],
    targetColumns: ['organizationId', 'id'],
    deferred: false,
  },
  ScheduleProgressObservation_task_scope_fkey: {
    table: 'ScheduleProgressObservation',
    target: 'Task',
    columns: ['projectId', 'taskId'],
    targetColumns: ['projectId', 'id'],
    deferred: false,
  },
  ScheduleProgressObservation_evidence_scope_fkey: {
    table: 'ScheduleProgressObservation',
    target: 'ProgressEvidence',
    columns: ['projectId', 'evidenceId'],
    targetColumns: ['projectId', 'id'],
    deferred: false,
  },
  ScheduleProgressObservation_assessment_scope_fkey: {
    table: 'ScheduleProgressObservation',
    target: 'VisualProgressAssessment',
    columns: ['projectId', 'assessmentId'],
    targetColumns: ['projectId', 'id'],
    deferred: false,
  },
  ScheduleProgressObservation_reviewedById_fkey: {
    table: 'ScheduleProgressObservation',
    target: 'PlatformUser',
    columns: ['reviewedById'],
    targetColumns: ['id'],
    deferred: false,
  },
  ScheduleProgressObservation_createdById_fkey: {
    table: 'ScheduleProgressObservation',
    target: 'PlatformUser',
    columns: ['createdById'],
    targetColumns: ['id'],
    deferred: false,
  },
});

const EXPECTED_TRIGGERS = Object.freeze({
  ScheduleBaselineTask_before_seal: {
    table: 'ScheduleBaselineTask', type: 7, functionName: 'obrasaas_schedule_baseline_child_before_seal',
  },
  ScheduleBaselineDependency_before_seal: {
    table: 'ScheduleBaselineDependency', type: 7, functionName: 'obrasaas_schedule_baseline_child_before_seal',
  },
  ScheduleBaseline_seal: {
    table: 'ScheduleBaseline', type: 7, functionName: 'obrasaas_schedule_baseline_seal',
  },
  ScheduleForecastTask_before_seal: {
    table: 'ScheduleForecastTask', type: 7, functionName: 'obrasaas_schedule_forecast_child_before_seal',
  },
  ScheduleForecastRun_seal: {
    table: 'ScheduleForecastRun', type: 7, functionName: 'obrasaas_schedule_forecast_seal',
  },
  ScheduleProgressObservation_provenance_validate: {
    table: 'ScheduleProgressObservation',
    type: 7,
    functionName: 'obrasaas_schedule_progress_observation_validate',
  },
  ScheduleForecastTask_progress_observation_validate: {
    table: 'ScheduleForecastTask',
    type: 7,
    functionName: 'obrasaas_schedule_forecast_progress_observation_validate',
  },
  ...Object.fromEntries(TABLES.flatMap((table) => [
    [`${table}_append_only`, {
      table, type: 27, functionName: 'obrasaas_schedule_snapshot_append_only',
    }],
    [`${table}_no_truncate`, {
      table, type: 34, functionName: 'obrasaas_schedule_snapshot_append_only',
    }],
  ])),
  ScheduleBaseline_append_only: {
    table: 'ScheduleBaseline', type: 27, functionName: 'obrasaas_schedule_baseline_lifecycle_guard',
  },
  ScheduleBaseline_supersession_integrity: {
    table: 'ScheduleBaseline',
    type: 21,
    functionName: 'obrasaas_schedule_baseline_supersession_integrity',
    constraint: true,
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
  invariant(missing.length === 0, `Missing schedule snapshot migrations: ${missing.join(', ')}.`);
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
  invariant(missing.length === 0, `Missing schedule snapshot tables: ${missing.join(', ')}.`);
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
    invariant(actual.has(name), `Missing schedule snapshot enum ${name}.`);
    invariant(sameValues(actual.get(name), labels), `${name} does not match the governed enum contract.`);
  }
}

async function assertColumns(client) {
  const result = await client.query(
    `SELECT table_name, column_name, ordinal_position, is_nullable, data_type,
            udt_name, character_maximum_length, datetime_precision, column_default
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = ANY($1::text[])
      ORDER BY table_name, ordinal_position`,
    [TABLES],
  );
  const byTable = new Map(TABLES.map((table) => [table, []]));
  for (const row of result.rows) byTable.get(row.table_name)?.push(row);

  for (const [table, expectedColumns] of Object.entries(EXPECTED_COLUMNS)) {
    const columns = byTable.get(table) || [];
    invariant(
      sameValues(columns.map((column) => column.column_name), expectedColumns.map(([name]) => name)),
      `${table} has missing, extra, or reordered governed columns.`,
    );
    for (let index = 0; index < expectedColumns.length; index += 1) {
      const [name, expected] = expectedColumns[index];
      const column = columns[index];
      invariant(column.is_nullable === expected.nullable, `${table}.${name} has unexpected nullability.`);
      invariant(column.data_type === expected.dataType, `${table}.${name} has an unexpected SQL type.`);
      invariant(column.udt_name === expected.udtName, `${table}.${name} has an unexpected base type.`);
      invariant(
        Number(column.character_maximum_length || 0) === Number(expected.maxLength || 0),
        `${table}.${name} has an unexpected maximum length.`,
      );
      invariant(
        Number(column.datetime_precision || 0) === Number(expected.datetimePrecision || 0),
        `${table}.${name} has an unexpected datetime precision.`,
      );
      if (expected.defaultPattern) {
        invariant(
          expected.defaultPattern.test(String(column.column_default || '')),
          `${table}.${name} has an unexpected default.`,
        );
      } else {
        invariant(column.column_default === null, `${table}.${name} must not have a database default.`);
      }
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
  for (const [name, expected] of Object.entries(EXPECTED_CHECKS)) {
    const check = checks.get(name);
    invariant(check, `Missing governed check constraint ${name}.`);
    invariant(check.table_name === expected.table, `${name} is attached to the wrong table.`);
    invariant(check.contype === 'c', `${name} is not a CHECK constraint.`);
    invariant(check.convalidated === true, `${name} is still NOT VALID.`);
    invariant(check.condeferrable === false, `${name} must remain non-deferrable.`);
    const definition = normalizeDefinition(check.definition);
    for (const fragment of expected.fragments) {
      invariant(
        definition.includes(normalizeDefinition(fragment)),
        `${name} is missing a governed invariant: ${fragment}.`,
      );
    }
    for (const fragment of expected.forbiddenFragments || []) {
      invariant(
        !definition.includes(normalizeDefinition(fragment)),
        `${name} contains a forbidden invariant: ${fragment}.`,
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
    invariant(index.tablename === expected.table, `${name} is attached to the wrong table.`);
    invariant(index.indisvalid && index.indisready, `${name} is not valid and ready.`);
    invariant(index.indisunique === expected.unique, `${name} has unexpected uniqueness.`);
    invariant(index.indisprimary === Boolean(expected.primary), `${name} has unexpected primary status.`);
    const columns = index.key_columns.map((column) => column.replaceAll('"', '').trim());
    invariant(sameValues(columns, expected.columns), `${name} has unexpected ordered columns.`);
    if (expected.predicate) {
      invariant(index.predicate !== null, `${name} must remain a partial index.`);
      invariant(
        normalizePredicate(index.predicate) === expected.predicate,
        `${name} has an unexpected active-baseline predicate.`,
      );
    } else {
      invariant(index.predicate === null, `${name} must govern every row.`);
    }
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
    invariant(foreignKey.table_name === expected.table, `${name} is attached to the wrong table.`);
    invariant(foreignKey.target_table === expected.target, `${name} references the wrong table.`);
    invariant(foreignKey.contype === 'f' && foreignKey.convalidated, `${name} is not a validated foreign key.`);
    invariant(
      foreignKey.condeferrable === expected.deferred
        && foreignKey.condeferred === expected.deferred,
      `${name} has an unexpected deferral policy.`,
    );
    invariant(foreignKey.confdeltype === 'r', `${name} must remain ON DELETE RESTRICT.`);
    invariant(foreignKey.confupdtype === 'c', `${name} must remain ON UPDATE CASCADE.`);
    invariant(foreignKey.confmatchtype === 's', `${name} must remain MATCH SIMPLE.`);
    invariant(sameValues(foreignKey.source_columns, expected.columns), `${name} has wrong source columns.`);
    invariant(sameValues(foreignKey.target_columns, expected.targetColumns), `${name} has wrong target columns.`);
  }
}

async function assertTriggers(client) {
  const names = Object.keys(EXPECTED_TRIGGERS);
  const result = await client.query(
    `SELECT trigger_record.tgname,
            relation_record.relname AS table_name,
            trigger_record.tgenabled,
            trigger_record.tgtype::integer AS trigger_type,
            procedure_record.proname AS function_name,
            trigger_record.tgconstraint <> 0 AS is_constraint,
            constraint_record.condeferrable,
            constraint_record.condeferred,
            pg_get_triggerdef(trigger_record.oid, true) AS definition
       FROM pg_trigger AS trigger_record
       JOIN pg_class AS relation_record ON relation_record.oid = trigger_record.tgrelid
       JOIN pg_namespace AS namespace_record ON namespace_record.oid = relation_record.relnamespace
       JOIN pg_proc AS procedure_record ON procedure_record.oid = trigger_record.tgfoid
       LEFT JOIN pg_constraint AS constraint_record
         ON constraint_record.oid = trigger_record.tgconstraint
      WHERE namespace_record.nspname = current_schema()
        AND NOT trigger_record.tgisinternal
        AND trigger_record.tgname = ANY($1::text[])`,
    [names],
  );
  const triggers = new Map(result.rows.map((row) => [row.tgname, row]));
  for (const [name, expected] of Object.entries(EXPECTED_TRIGGERS)) {
    const trigger = triggers.get(name);
    invariant(trigger, `Missing governed trigger ${name}.`);
    invariant(trigger.table_name === expected.table, `${name} is attached to the wrong table.`);
    invariant(trigger.tgenabled === 'O', `${name} is not enabled for ordinary writes.`);
    invariant(Number(trigger.trigger_type) === expected.type, `${name} protects the wrong events.`);
    invariant(trigger.function_name === expected.functionName, `${name} invokes the wrong function.`);
    invariant(trigger.is_constraint === Boolean(expected.constraint), `${name} has the wrong trigger class.`);
    if (expected.constraint) {
      invariant(trigger.condeferrable && trigger.condeferred, `${name} must be deferred until commit.`);
    }
  }
}

async function assertTriggerFunctions(client) {
  const expected = {
    obrasaas_schedule_baseline_child_before_seal: [
      'pg_advisory_xact_lock',
      'ScheduleBaseline is already sealed',
      '55000',
    ],
    obrasaas_schedule_baseline_seal: [
      'pg_advisory_xact_lock',
      'actual_task_count',
      'actual_dependency_count',
      'max_predecessor_edges',
      'expected_version',
      '55000',
    ],
    obrasaas_schedule_forecast_child_before_seal: [
      'pg_advisory_xact_lock',
      'sourceTaskRevision',
      'baselineStart',
      'observedTaskRevision',
      'forecastDurationDays',
      'ScheduleForecastRun is already sealed',
      '55000',
    ],
    obrasaas_schedule_forecast_seal: [
      'pg_advisory_xact_lock',
      'expected_task_count',
      'observed_date_violation_count',
      'partial_finish_violation_count',
      'topology_order_violation_count',
      'relationship_explanation_violation_count',
      'expected_baseline_finish',
      'actual_forecast_finish',
      '55000',
    ],
    obrasaas_schedule_baseline_lifecycle_guard: [
      'ACTIVE',
      'SUPERSEDED',
      'to_jsonb',
      'ScheduleBaseline content is append-only',
      '55000',
    ],
    obrasaas_schedule_baseline_supersession_integrity: [
      'successor_version',
      'successor_status',
      'newer active baseline',
      '55000',
    ],
    obrasaas_schedule_progress_observation_validate: [
      'TG_TABLE_SCHEMA',
      'ProgressEvidence',
      'VisualProgressAssessment',
      'COMPLETED',
      'APPROVED',
      'CORRECTED',
      'inputSha256',
      'baselineHash',
      'capturedAt',
      'evidenceCapturedAt',
      'human-point-within-reviewed-range-v1',
      'FOR SHARE',
      '55000',
    ],
    obrasaas_schedule_forecast_progress_observation_validate: [
      'TG_TABLE_SCHEMA',
      'ScheduleProgressObservation',
      'CANONICAL_TASK',
      'MANUAL_OVERRIDE',
      'REVIEWED_EVIDENCE',
      'progressObservationId',
      'IS DISTINCT FROM',
      'human-point-within-reviewed-range-v1',
      '55000',
    ],
    obrasaas_schedule_snapshot_append_only: ['append-only', '55000'],
  };
  const result = await client.query(
    `SELECT procedure_record.proname,
            procedure_record.prosrc,
            procedure_record.proconfig,
            procedure_record.prorettype = 'pg_catalog.trigger'::regtype AS returns_trigger
       FROM pg_proc AS procedure_record
       JOIN pg_namespace AS namespace_record ON namespace_record.oid = procedure_record.pronamespace
      WHERE namespace_record.nspname = current_schema()
        AND procedure_record.proname = ANY($1::text[])`,
    [Object.keys(expected)],
  );
  const functions = new Map(result.rows.map((row) => [row.proname, row]));
  for (const [name, fragments] of Object.entries(expected)) {
    const entry = functions.get(name);
    invariant(entry?.returns_trigger, `Missing governed trigger function ${name}.`);
    invariant(
      Array.isArray(entry.proconfig)
        && entry.proconfig.includes('search_path=pg_catalog'),
      `${name} must pin search_path to pg_catalog.`,
    );
    for (const fragment of fragments) {
      invariant(entry.prosrc.includes(fragment), `${name} is missing ${fragment}.`);
    }
  }
}

let savepointSequence = 0;

async function expectSqlFailure(
  client,
  operation,
  expectedCode,
  expectedConstraint,
  label,
) {
  savepointSequence += 1;
  const savepoint = `schedule_snapshot_verify_${savepointSequence}`;
  await client.query(`SAVEPOINT ${savepoint}`);
  let caught = null;
  try {
    await operation();
  } catch (error) {
    caught = error;
  }
  await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
  await client.query(`RELEASE SAVEPOINT ${savepoint}`);
  await client.query('SET CONSTRAINTS ALL DEFERRED');
  invariant(caught, `${label} unexpectedly succeeded.`);
  invariant(caught.code === expectedCode, `${label} failed with an unexpected SQLSTATE.`);
  if (expectedConstraint) {
    invariant(caught.constraint === expectedConstraint, `${label} failed on an unexpected constraint.`);
  }
}

function sha256Fixture(seed) {
  return seed.toString(16).padStart(64, '0');
}

async function insertReviewedProgressSourceFixtures(client, fixtures) {
  const capturedAt = '2026-01-02 12:00:00';
  const completedAt = '2026-01-02 13:00:00';
  const reviewedAt = '2026-01-02 14:00:00';

  for (const [id, emailSuffix] of [
    [fixtures.reviewerId, 'reviewer'],
    [fixtures.creatorId, 'creator'],
  ]) {
    await client.query(
      `INSERT INTO "PlatformUser" (
         "id", "clerkUserId", "primaryEmail", "fullName", "updatedAt"
       ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [
        id,
        `clerk_${emailSuffix}_${fixtures.suffix}`,
        `${emailSuffix}-${fixtures.suffix}@schedule-verifier.invalid`,
        `Schedule verifier ${emailSuffix}`,
      ],
    );
  }

  for (const [id, title, revision] of [
    [fixtures.firstSourceTaskId, 'Reviewed progress task', 2],
    [fixtures.secondSourceTaskId, 'Canonical progress task', 1],
  ]) {
    await client.query(
      `INSERT INTO "Task" (
         "id", "projectId", "title", "revision", "createdAt", "updatedAt"
       ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [id, fixtures.projectId, title, revision],
    );
  }

  await client.query(
    `INSERT INTO "ProgressEvidence" (
       "id", "projectId", "taskId", "capturedAt", "media", "status",
       "revision", "reviewedAt", "createdAt", "updatedAt"
     ) VALUES (
       $1, $2, $3, $4, $5::jsonb, 'APPROVED', 1, $6, $4, $6
     )`,
    [
      fixtures.evidenceId,
      fixtures.projectId,
      fixtures.firstSourceTaskId,
      capturedAt,
      JSON.stringify({ sha256: fixtures.evidenceSha256, mimeType: 'image/jpeg' }),
      completedAt,
    ],
  );

  await client.query(
    `INSERT INTO "VisualProgressAssessment" (
       "id", "projectId", "taskId", "evidenceId", "operationKeyHash",
       "requestFingerprint", "provider", "providerModel", "analyzerVersion",
       "inputSha256", "baselineHash", "taskRevisionAtRequest",
       "evidenceRevisionAtRequest", "status", "leaseExpiresAt", "attemptCount",
       "summary", "elementType", "progressMin", "progressMax", "confidence",
       "quality", "observations", "limitations", "providerResponseId",
       "failureCode", "completedAt", "requestedById", "reviewStatus",
       "reviewedById", "reviewedAt", "reviewNote", "correctedProgressMin",
       "correctedProgressMax", "revision", "createdAt", "updatedAt"
     ) VALUES (
       $1, $2, $3, $4, $5, $6, 'openai', 'verification-fixture',
       'visual-progress-v1', $7, $8, 2, 1, 'COMPLETED', NULL, 1,
       'Reviewed construction progress fixture', 'wall', 40, 60, 0.8,
       $9::jsonb, $10::jsonb, $11::jsonb, 'fixture-response', NULL, $12,
       $13, 'APPROVED', $14, $15, NULL, NULL, NULL, 2, $16, $15
     )`,
    [
      fixtures.assessmentId,
      fixtures.projectId,
      fixtures.firstSourceTaskId,
      fixtures.evidenceId,
      sha256Fixture(701),
      sha256Fixture(702),
      fixtures.evidenceSha256,
      fixtures.planHash,
      JSON.stringify({ overall: 'good' }),
      JSON.stringify(['Visible wall progress']),
      JSON.stringify([]),
      completedAt,
      fixtures.creatorId,
      fixtures.reviewerId,
      reviewedAt,
      capturedAt,
    ],
  );
}

async function insertScheduleProgressObservation(client, fixtures, overrides = {}) {
  await client.query(
    `INSERT INTO "ScheduleProgressObservation" (
       "id", "organizationId", "projectId", "taskId", "evidenceId",
       "assessmentId", "source", "assessmentRevision", "evidenceRevision",
       "taskRevision", "evidenceSha256", "evidenceCapturedAt", "planHash",
       "reviewStatus", "reviewedById", "reviewedAt", "progressMin",
       "progressMax", "progressPercent", "decisionPolicyVersion", "observedOn",
       "actualStart", "actualFinish", "remainingDurationDays", "rationale",
       "operationKeyHash", "requestFingerprint", "createdById"
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
       $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28
     )`,
    [
      overrides.id || `schedule_observation_${randomUUID()}`,
      overrides.organizationId || fixtures.organizationId,
      overrides.projectId || fixtures.projectId,
      overrides.taskId || fixtures.firstSourceTaskId,
      overrides.evidenceId || fixtures.evidenceId,
      overrides.assessmentId || fixtures.assessmentId,
      overrides.source || 'REVIEWED_EVIDENCE',
      overrides.assessmentRevision ?? 2,
      overrides.evidenceRevision ?? 1,
      overrides.taskRevision ?? 2,
      overrides.evidenceSha256 || fixtures.evidenceSha256,
      overrides.evidenceCapturedAt || '2026-01-02 12:00:00',
      overrides.planHash || fixtures.planHash,
      overrides.reviewStatus || 'APPROVED',
      overrides.reviewedById || fixtures.reviewerId,
      overrides.reviewedAt || '2026-01-02 14:00:00',
      overrides.progressMin ?? 40,
      overrides.progressMax ?? 60,
      overrides.progressPercent ?? 50,
      overrides.decisionPolicyVersion || 'human-point-within-reviewed-range-v1',
      overrides.observedOn || '2026-01-02',
      overrides.actualStart === undefined ? '2026-01-01' : overrides.actualStart,
      overrides.actualFinish ?? null,
      overrides.remainingDurationDays === undefined ? 2 : overrides.remainingDurationDays,
      overrides.rationale || 'Human-selected point inside the approved review range.',
      overrides.operationKeyHash || sha256Fixture(overrides.hashSeed || 710),
      overrides.requestFingerprint || sha256Fixture((overrides.hashSeed || 710) + 1),
      overrides.createdById || fixtures.creatorId,
    ],
  );
}

async function insertBaselineTask(client, fixtures, overrides = {}) {
  await client.query(
    `INSERT INTO "ScheduleBaselineTask" (
       "id", "organizationId", "projectId", "baselineId", "sourceTaskId",
       "sourceTaskRevision", "code", "title", "description", "type",
       "parentSourceTaskId", "plannedStart", "plannedFinish", "plannedDurationDays"
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
     )`,
    [
      overrides.id || `baseline_task_${randomUUID()}`,
      overrides.organizationId || fixtures.organizationId,
      overrides.projectId || fixtures.projectId,
      overrides.baselineId,
      overrides.sourceTaskId,
      overrides.sourceTaskRevision ?? 1,
      overrides.code ?? null,
      overrides.title || `Snapshot ${overrides.sourceTaskId}`,
      overrides.description ?? null,
      overrides.type || 'TASK',
      overrides.parentSourceTaskId ?? null,
      overrides.plannedStart,
      overrides.plannedFinish,
      overrides.plannedDurationDays,
    ],
  );
}

async function insertBaselineDependency(client, fixtures, overrides) {
  await client.query(
    `INSERT INTO "ScheduleBaselineDependency" (
       "id", "organizationId", "projectId", "baselineId",
       "predecessorSourceTaskId", "successorSourceTaskId", "type", "lagDays"
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      overrides.id || `baseline_dependency_${randomUUID()}`,
      overrides.organizationId || fixtures.organizationId,
      overrides.projectId || fixtures.projectId,
      overrides.baselineId,
      overrides.predecessorSourceTaskId,
      overrides.successorSourceTaskId,
      overrides.type || 'FINISH_TO_START',
      overrides.lagDays ?? 0,
    ],
  );
}

async function insertBaselineRoot(client, fixtures, overrides) {
  await client.query(
    `INSERT INTO "ScheduleBaseline" (
       "id", "organizationId", "projectId", "version", "status", "name",
       "timeZone", "calendarPolicy", "operationKeyHash", "sourcePlanHash",
       "contentHash", "taskCount", "dependencyCount", "requestFingerprint"
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
     )`,
    [
      overrides.id,
      overrides.organizationId || fixtures.organizationId,
      overrides.projectId || fixtures.projectId,
      overrides.version,
      overrides.status || 'ACTIVE',
      overrides.name || `Baseline v${overrides.version}`,
      overrides.timeZone || 'America/Argentina/Buenos_Aires',
      overrides.calendarPolicy || 'CIVIL_CALENDAR_DAYS_V1',
      overrides.operationKeyHash || sha256Fixture(100 + overrides.version),
      overrides.sourcePlanHash || sha256Fixture(200 + overrides.version),
      overrides.contentHash || sha256Fixture(300 + overrides.version),
      overrides.taskCount,
      overrides.dependencyCount,
      overrides.requestFingerprint || sha256Fixture(400 + overrides.version),
    ],
  );
}

async function supersedeBaseline(client, fixtures, { id, successorId, hash = sha256Fixture(900) }) {
  await client.query(
    `UPDATE "ScheduleBaseline"
        SET "status" = 'SUPERSEDED',
            "supersededAt" = CURRENT_TIMESTAMP,
            "supersededById" = $4,
            "supersessionHash" = $5
      WHERE "organizationId" = $1 AND "projectId" = $2 AND "id" = $3`,
    [fixtures.organizationId, fixtures.projectId, id, successorId, hash],
  );
}

async function insertTwoTaskBaselineChildren(client, fixtures, baselineId) {
  await insertBaselineTask(client, fixtures, {
    baselineId,
    sourceTaskId: fixtures.firstSourceTaskId,
    sourceTaskRevision: 1,
    code: '1.1',
    plannedStart: '2026-01-01',
    plannedFinish: '2026-01-03',
    plannedDurationDays: 3,
  });
  await insertBaselineTask(client, fixtures, {
    baselineId,
    sourceTaskId: fixtures.secondSourceTaskId,
    sourceTaskRevision: 1,
    code: '1.2',
    plannedStart: '2026-01-04',
    plannedFinish: '2026-01-05',
    plannedDurationDays: 2,
  });
  await insertBaselineDependency(client, fixtures, {
    baselineId,
    predecessorSourceTaskId: fixtures.firstSourceTaskId,
    successorSourceTaskId: fixtures.secondSourceTaskId,
  });
}

function forecastTaskValues(fixtures, overrides) {
  const first = overrides.sourceTaskId === fixtures.firstSourceTaskId;
  const defaults = first
    ? {
        observedTaskRevision: 2,
        progressPercent: 50,
        actualStart: '2026-01-01',
        actualFinish: null,
        remainingDurationDays: 2,
        baselineStart: '2026-01-01',
        baselineFinish: '2026-01-03',
        forecastStart: '2026-01-01',
        forecastFinish: '2026-01-03',
        forecastDurationDays: 3,
        forecastRemainingDays: 2,
        startDeltaDays: 0,
        finishDeltaDays: 0,
        durationDeltaDays: 0,
        driver: { kind: 'DATA_DATE_AND_REMAINING_DURATION', constraintDate: '2026-01-02' },
        relationshipConstraints: [],
      }
    : {
        observedTaskRevision: 1,
        progressPercent: 0,
        actualStart: null,
        actualFinish: null,
        remainingDurationDays: null,
        baselineStart: '2026-01-04',
        baselineFinish: '2026-01-05',
        forecastStart: '2026-01-04',
        forecastFinish: '2026-01-05',
        forecastDurationDays: 2,
        forecastRemainingDays: 2,
        startDeltaDays: 0,
        finishDeltaDays: 0,
        durationDeltaDays: 0,
        driver: {
          kind: 'DEPENDENCY',
          predecessorId: fixtures.firstSourceTaskId,
          type: 'FINISH_TO_START',
          code: 'FS',
          lagDays: 0,
          constraintDate: '2026-01-04',
        },
        relationshipConstraints: [{
          predecessorId: fixtures.firstSourceTaskId,
          type: 'FINISH_TO_START',
          code: 'FS',
          lagDays: 0,
          successorAnchor: 'START',
          requiredDate: '2026-01-04',
          violated: false,
        }],
      };
  return { ...defaults, ...overrides };
}

async function insertForecastTask(client, fixtures, rawOverrides) {
  const overrides = forecastTaskValues(fixtures, rawOverrides);
  await client.query(
    `INSERT INTO "ScheduleForecastTask" (
       "id", "organizationId", "projectId", "forecastRunId", "baselineId",
       "sourceTaskId", "observedTaskRevision", "progressSource",
       "progressPercent", "observedOn", "actualStart", "actualFinish",
       "remainingDurationDays", "baselineStart", "baselineFinish",
       "forecastStart", "forecastFinish", "forecastDurationDays",
       "forecastRemainingDays", "startDeltaDays", "finishDeltaDays",
       "durationDeltaDays", "driver", "relationshipConstraints",
       "progressObservationId"
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
       $14, $15, $16, $17, $18, $19, $20, $21, $22, $23::jsonb, $24::jsonb,
       $25
     )`,
    [
      overrides.id || `forecast_task_${randomUUID()}`,
      overrides.organizationId || fixtures.organizationId,
      overrides.projectId || fixtures.projectId,
      overrides.forecastRunId,
      overrides.baselineId,
      overrides.sourceTaskId,
      overrides.observedTaskRevision,
      overrides.progressSource || 'CANONICAL_TASK',
      overrides.progressPercent,
      overrides.observedOn || '2026-01-02',
      overrides.actualStart,
      overrides.actualFinish,
      overrides.remainingDurationDays,
      overrides.baselineStart,
      overrides.baselineFinish,
      overrides.forecastStart,
      overrides.forecastFinish,
      overrides.forecastDurationDays,
      overrides.forecastRemainingDays,
      overrides.startDeltaDays,
      overrides.finishDeltaDays,
      overrides.durationDeltaDays,
      JSON.stringify(overrides.driver),
      JSON.stringify(overrides.relationshipConstraints),
      overrides.progressObservationId ?? null,
    ],
  );
}

async function insertTwoForecastTasks(client, fixtures, { runId, baselineId, first = {}, second = {} }) {
  await insertForecastTask(client, fixtures, {
    forecastRunId: runId,
    baselineId,
    sourceTaskId: fixtures.firstSourceTaskId,
    ...first,
  });
  await insertForecastTask(client, fixtures, {
    forecastRunId: runId,
    baselineId,
    sourceTaskId: fixtures.secondSourceTaskId,
    ...second,
  });
}

async function insertForecastRun(client, fixtures, overrides) {
  await client.query(
    `INSERT INTO "ScheduleForecastRun" (
       "id", "organizationId", "projectId", "baselineId", "scenarioId",
       "schemaVersion", "engineVersion", "calendarPolicy", "operationKeyHash",
       "inputHash", "resultHash", "asOfDate", "baselineStartDate",
       "baselineFinishDate", "forecastStartDate", "forecastFinishDate",
       "startDeltaDays", "finishDeltaDays", "taskCount", "topologicalOrder",
       "requestFingerprint"
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
       $15, $16, $17, $18, $19, $20::jsonb, $21
     )`,
    [
      overrides.id,
      overrides.organizationId || fixtures.organizationId,
      overrides.projectId || fixtures.projectId,
      overrides.baselineId,
      overrides.scenarioId ?? null,
      overrides.schemaVersion ?? 1,
      overrides.engineVersion || 'deterministic-civil-days-v1',
      overrides.calendarPolicy || 'CIVIL_CALENDAR_DAYS_V1',
      overrides.operationKeyHash || sha256Fixture(overrides.hashSeed || 500),
      overrides.inputHash || sha256Fixture((overrides.hashSeed || 500) + 1),
      overrides.resultHash || sha256Fixture((overrides.hashSeed || 500) + 2),
      overrides.asOfDate || '2026-01-02',
      overrides.baselineStartDate || '2026-01-01',
      overrides.baselineFinishDate || '2026-01-05',
      overrides.forecastStartDate || '2026-01-01',
      overrides.forecastFinishDate || '2026-01-05',
      overrides.startDeltaDays ?? 0,
      overrides.finishDeltaDays ?? 0,
      overrides.taskCount ?? 2,
      JSON.stringify(overrides.topologicalOrder || [
        fixtures.firstSourceTaskId,
        fixtures.secondSourceTaskId,
      ]),
      overrides.requestFingerprint || sha256Fixture((overrides.hashSeed || 500) + 3),
    ],
  );
}

async function assertTransactionalSmoke(client) {
  const suffix = randomUUID().replaceAll('-', '');
  const now = new Date();
  const fixtures = {
    suffix,
    organizationId: `schedule_verify_org_${suffix}`,
    projectId: `schedule_verify_project_${suffix}`,
    otherProjectId: `schedule_verify_other_project_${suffix}`,
    firstSourceTaskId: `schedule_verify_task_a_${suffix}`,
    secondSourceTaskId: `schedule_verify_task_b_${suffix}`,
    reviewerId: `schedule_verify_reviewer_${suffix}`,
    creatorId: `schedule_verify_creator_${suffix}`,
    evidenceId: `schedule_verify_evidence_${suffix}`,
    assessmentId: `schedule_verify_assessment_${suffix}`,
    observationId: `schedule_verify_observation_${suffix}`,
    evidenceSha256: sha256Fixture(703),
    planHash: sha256Fixture(704),
    baselineV1Id: `schedule_verify_baseline_v1_${suffix}`,
    baselineV2Id: `schedule_verify_baseline_v2_${suffix}`,
    forecastRunId: `schedule_verify_forecast_${suffix}`,
  };

  await client.query(
    `INSERT INTO "Organization" ("id", "name", "slug", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $4)`,
    [
      fixtures.organizationId,
      'Schedule snapshot migration verifier',
      `schedule-verify-${suffix}`,
      now,
    ],
  );
  for (const [id, slug] of [
    [fixtures.projectId, `schedule-project-${suffix}`],
    [fixtures.otherProjectId, `schedule-other-project-${suffix}`],
  ]) {
    await client.query(
      `INSERT INTO "Project" (
         "id", "organizationId", "name", "slug", "createdAt", "updatedAt"
       ) VALUES ($1, $2, $3, $4, $5, $5)`,
      [id, fixtures.organizationId, 'Schedule verifier project', slug, now],
    );
  }

  await insertReviewedProgressSourceFixtures(client, fixtures);
  await insertScheduleProgressObservation(client, fixtures, {
    id: fixtures.observationId,
    hashSeed: 710,
  });

  await expectSqlFailure(
    client,
    () => insertScheduleProgressObservation(client, fixtures, {
      evidenceCapturedAt: '2026-01-02 12:00:01',
      hashSeed: 720,
    }),
    '55000',
    null,
    'ScheduleProgressObservation captured-at provenance guard',
  );
  await expectSqlFailure(
    client,
    () => insertScheduleProgressObservation(client, fixtures, {
      taskRevision: 1,
      hashSeed: 722,
    }),
    '55000',
    null,
    'ScheduleProgressObservation revision-only stale task guard',
  );
  await expectSqlFailure(
    client,
    () => insertScheduleProgressObservation(client, fixtures, {
      evidenceRevision: 0,
      hashSeed: 724,
    }),
    '55000',
    null,
    'ScheduleProgressObservation revision-only stale evidence guard',
  );
  await expectSqlFailure(
    client,
    () => insertScheduleProgressObservation(client, fixtures, {
      planHash: sha256Fixture(999),
      hashSeed: 726,
    }),
    '55000',
    null,
    'ScheduleProgressObservation assessment plan-hash guard',
  );
  await expectSqlFailure(
    client,
    () => insertScheduleProgressObservation(client, fixtures, {
      decisionPolicyVersion: 'midpoint-v0',
      hashSeed: 728,
    }),
    '55000',
    null,
    'ScheduleProgressObservation human decision policy guard',
  );
  await expectSqlFailure(
    client,
    () => insertScheduleProgressObservation(client, fixtures, {
      progressPercent: 61,
      hashSeed: 730,
    }),
    '23514',
    'ScheduleProgressObservation_reviewed_range_check',
    'ScheduleProgressObservation reviewed range guard',
  );
  await expectSqlFailure(
    client,
    () => insertScheduleProgressObservation(client, fixtures, {
      rationale: 'Unsafe\ncontrol',
      hashSeed: 732,
    }),
    '23514',
    'ScheduleProgressObservation_rationale_check',
    'ScheduleProgressObservation rationale control-character guard',
  );

  await insertTwoTaskBaselineChildren(client, fixtures, fixtures.baselineV1Id);
  await insertBaselineRoot(client, fixtures, {
    id: fixtures.baselineV1Id,
    version: 1,
    taskCount: 2,
    dependencyCount: 1,
    operationKeyHash: sha256Fixture(101),
  });
  await client.query('SET CONSTRAINTS ALL IMMEDIATE');
  await client.query('SET CONSTRAINTS ALL DEFERRED');

  await insertTwoTaskBaselineChildren(client, fixtures, fixtures.baselineV2Id);
  await supersedeBaseline(client, fixtures, {
    id: fixtures.baselineV1Id,
    successorId: fixtures.baselineV2Id,
    hash: sha256Fixture(902),
  });
  await insertBaselineRoot(client, fixtures, {
    id: fixtures.baselineV2Id,
    version: 2,
    taskCount: 2,
    dependencyCount: 1,
    operationKeyHash: sha256Fixture(102),
  });
  await client.query('SET CONSTRAINTS ALL IMMEDIATE');
  await client.query('SET CONSTRAINTS ALL DEFERRED');

  const lifecycle = await client.query(
    `SELECT "id", "version", "status"::TEXT AS status,
            "supersededById", "name", "contentHash"
       FROM "ScheduleBaseline"
      WHERE "organizationId" = $1 AND "projectId" = $2
      ORDER BY "version"`,
    [fixtures.organizationId, fixtures.projectId],
  );
  invariant(lifecycle.rowCount === 2, 'Atomic rebaseline did not retain both immutable versions.');
  invariant(
    lifecycle.rows[0].status === 'SUPERSEDED'
      && lifecycle.rows[0].supersededById === fixtures.baselineV2Id
      && lifecycle.rows[0].name === 'Baseline v1'
      && lifecycle.rows[0].contentHash.trim() === sha256Fixture(301),
    'Atomic rebaseline mutated v1 content or lost its successor link.',
  );
  invariant(
    lifecycle.rows[1].status === 'ACTIVE' && lifecycle.rows[1].version === 2,
    'Atomic rebaseline did not leave exactly the expected active v2.',
  );

  await expectSqlFailure(
    client,
    () => client.query(
      `UPDATE "ScheduleBaseline" SET "name" = 'mutated'
        WHERE "id" = $1`,
      [fixtures.baselineV2Id],
    ),
    '55000',
    null,
    'ScheduleBaseline content immutability guard',
  );
  await expectSqlFailure(
    client,
    () => client.query(
      `UPDATE "ScheduleBaseline" SET "requestFingerprint" = $2
        WHERE "id" = $1`,
      [fixtures.baselineV2Id, sha256Fixture(998)],
    ),
    '55000',
    null,
    'ScheduleBaseline request fingerprint immutability guard',
  );
  await expectSqlFailure(
    client,
    () => client.query(
      `UPDATE "ScheduleBaseline"
          SET "status" = 'ACTIVE', "supersededAt" = NULL,
              "supersededById" = NULL, "supersessionHash" = NULL
        WHERE "id" = $1`,
      [fixtures.baselineV1Id],
    ),
    '55000',
    null,
    'ScheduleBaseline lifecycle reversal guard',
  );
  await expectSqlFailure(
    client,
    async () => {
      const nextId = `schedule_verify_missing_successor_${suffix}`;
      await supersedeBaseline(client, fixtures, {
        id: fixtures.baselineV2Id,
        successorId: nextId,
        hash: sha256Fixture(903),
      });
      await client.query('SET CONSTRAINTS ALL IMMEDIATE');
    },
    '23503',
    'ScheduleBaseline_superseded_by_scope_fkey',
    'ScheduleBaseline missing successor scope guard',
  );

  await expectSqlFailure(
    client,
    async () => {
      const baselineId = `schedule_verify_duplicate_active_${suffix}`;
      await insertTwoTaskBaselineChildren(client, fixtures, baselineId);
      await insertBaselineRoot(client, fixtures, {
        id: baselineId,
        version: 3,
        taskCount: 2,
        dependencyCount: 1,
      });
    },
    '23505',
    'ScheduleBaseline_one_active_per_project_key',
    'ScheduleBaseline one-active uniqueness',
  );

  await expectSqlFailure(
    client,
    async () => {
      const baselineId = `schedule_verify_bad_hash_${suffix}`;
      await insertTwoTaskBaselineChildren(client, fixtures, baselineId);
      await supersedeBaseline(client, fixtures, {
        id: fixtures.baselineV2Id,
        successorId: baselineId,
        hash: sha256Fixture(904),
      });
      await insertBaselineRoot(client, fixtures, {
        id: baselineId,
        version: 3,
        taskCount: 2,
        dependencyCount: 1,
        contentHash: 'not-a-sha256',
      });
    },
    '23514',
    'ScheduleBaseline_hashes_check',
    'ScheduleBaseline hash guard',
  );

  await expectSqlFailure(
    client,
    async () => {
      const baselineId = `schedule_verify_duplicate_operation_${suffix}`;
      await insertTwoTaskBaselineChildren(client, fixtures, baselineId);
      await supersedeBaseline(client, fixtures, {
        id: fixtures.baselineV2Id,
        successorId: baselineId,
        hash: sha256Fixture(905),
      });
      await insertBaselineRoot(client, fixtures, {
        id: baselineId,
        version: 3,
        taskCount: 2,
        dependencyCount: 1,
        operationKeyHash: sha256Fixture(102),
      });
    },
    '23505',
    'ScheduleBaseline_scope_operation_key',
    'ScheduleBaseline operation idempotency',
  );

  await expectSqlFailure(
    client,
    async () => {
      const baselineId = `schedule_verify_skipped_version_${suffix}`;
      await insertTwoTaskBaselineChildren(client, fixtures, baselineId);
      await supersedeBaseline(client, fixtures, {
        id: fixtures.baselineV2Id,
        successorId: baselineId,
        hash: sha256Fixture(906),
      });
      await insertBaselineRoot(client, fixtures, {
        id: baselineId,
        version: 4,
        taskCount: 2,
        dependencyCount: 1,
      });
    },
    '55000',
    null,
    'ScheduleBaseline contiguous version guard',
  );

  await expectSqlFailure(
    client,
    () => insertBaselineRoot(client, fixtures, {
      id: `schedule_verify_count_mismatch_${suffix}`,
      version: 3,
      taskCount: 2,
      dependencyCount: 0,
    }),
    '55000',
    null,
    'ScheduleBaseline aggregate count seal',
  );

  await expectSqlFailure(
    client,
    () => insertBaselineTask(client, fixtures, {
      baselineId: `schedule_verify_invalid_dates_${suffix}`,
      sourceTaskId: `schedule_verify_invalid_task_${suffix}`,
      plannedStart: '2026-01-01',
      plannedFinish: '2026-01-03',
      plannedDurationDays: 2,
    }),
    '23514',
    'ScheduleBaselineTask_dates_check',
    'ScheduleBaselineTask inclusive duration guard',
  );

  await expectSqlFailure(
    client,
    async () => {
      await insertBaselineTask(client, fixtures, {
        organizationId: fixtures.organizationId,
        projectId: fixtures.otherProjectId,
        baselineId: fixtures.baselineV2Id,
        sourceTaskId: `schedule_verify_cross_project_${suffix}`,
        plannedStart: '2026-01-01',
        plannedFinish: '2026-01-01',
        plannedDurationDays: 1,
      });
      await client.query('SET CONSTRAINTS ALL IMMEDIATE');
    },
    '23503',
    'ScheduleBaselineTask_baseline_scope_fkey',
    'ScheduleBaselineTask cross-project scope guard',
  );

  await expectSqlFailure(
    client,
    async () => {
      const baselineId = `schedule_verify_cross_baseline_${suffix}`;
      const localTask = `schedule_verify_local_task_${suffix}`;
      await insertBaselineTask(client, fixtures, {
        baselineId,
        sourceTaskId: localTask,
        plannedStart: '2026-02-01',
        plannedFinish: '2026-02-01',
        plannedDurationDays: 1,
      });
      await insertBaselineDependency(client, fixtures, {
        baselineId,
        predecessorSourceTaskId: fixtures.firstSourceTaskId,
        successorSourceTaskId: localTask,
      });
      await supersedeBaseline(client, fixtures, {
        id: fixtures.baselineV2Id,
        successorId: baselineId,
        hash: sha256Fixture(907),
      });
      await insertBaselineRoot(client, fixtures, {
        id: baselineId,
        version: 3,
        taskCount: 1,
        dependencyCount: 1,
      });
      await client.query('SET CONSTRAINTS ALL IMMEDIATE');
    },
    '23503',
    'ScheduleBaselineDependency_predecessor_scope_fkey',
    'ScheduleBaselineDependency cross-baseline scope guard',
  );

  await expectSqlFailure(
    client,
    () => insertBaselineTask(client, fixtures, {
      baselineId: fixtures.baselineV2Id,
      sourceTaskId: `schedule_verify_late_task_${suffix}`,
      plannedStart: '2026-01-06',
      plannedFinish: '2026-01-06',
      plannedDurationDays: 1,
    }),
    '55000',
    null,
    'ScheduleBaseline late-child seal',
  );

  await insertTwoForecastTasks(client, fixtures, {
    runId: fixtures.forecastRunId,
    baselineId: fixtures.baselineV2Id,
    first: {
      progressSource: 'REVIEWED_EVIDENCE',
      progressObservationId: fixtures.observationId,
    },
  });
  await insertForecastRun(client, fixtures, {
    id: fixtures.forecastRunId,
    baselineId: fixtures.baselineV2Id,
    hashSeed: 600,
  });
  await client.query('SET CONSTRAINTS ALL IMMEDIATE');
  await client.query('SET CONSTRAINTS ALL DEFERRED');

  await expectSqlFailure(
    client,
    () => insertForecastTask(client, fixtures, {
      forecastRunId: `schedule_verify_manual_closed_${suffix}`,
      baselineId: fixtures.baselineV2Id,
      sourceTaskId: fixtures.firstSourceTaskId,
      progressSource: 'MANUAL_OVERRIDE',
    }),
    '55000',
    null,
    'ScheduleForecastTask manual override closure',
  );
  await expectSqlFailure(
    client,
    () => insertForecastTask(client, fixtures, {
      forecastRunId: `schedule_verify_reviewed_missing_${suffix}`,
      baselineId: fixtures.baselineV2Id,
      sourceTaskId: fixtures.firstSourceTaskId,
      progressSource: 'REVIEWED_EVIDENCE',
    }),
    '55000',
    null,
    'ScheduleForecastTask reviewed observation required guard',
  );
  await expectSqlFailure(
    client,
    () => insertForecastTask(client, fixtures, {
      forecastRunId: `schedule_verify_canonical_link_${suffix}`,
      baselineId: fixtures.baselineV2Id,
      sourceTaskId: fixtures.firstSourceTaskId,
      progressObservationId: fixtures.observationId,
    }),
    '55000',
    null,
    'ScheduleForecastTask canonical observation exclusion guard',
  );
  await expectSqlFailure(
    client,
    () => insertForecastTask(client, fixtures, {
      forecastRunId: `schedule_verify_reviewed_mismatch_${suffix}`,
      baselineId: fixtures.baselineV2Id,
      sourceTaskId: fixtures.firstSourceTaskId,
      progressSource: 'REVIEWED_EVIDENCE',
      progressObservationId: fixtures.observationId,
      progressPercent: 51,
    }),
    '55000',
    null,
    'ScheduleForecastTask exact observation projection guard',
  );

  await expectSqlFailure(
    client,
    () => client.query(
      `UPDATE "ScheduleForecastRun" SET "requestFingerprint" = $2
        WHERE "id" = $1`,
      [fixtures.forecastRunId, sha256Fixture(999)],
    ),
    '55000',
    null,
    'ScheduleForecastRun request fingerprint immutability guard',
  );

  await expectSqlFailure(
    client,
    () => insertForecastTask(client, fixtures, {
      forecastRunId: `schedule_verify_bad_projection_run_${suffix}`,
      baselineId: fixtures.baselineV2Id,
      sourceTaskId: fixtures.firstSourceTaskId,
      baselineStart: '2025-12-31',
      startDeltaDays: 1,
    }),
    '55000',
    null,
    'ScheduleForecastTask baseline projection guard',
  );

  await expectSqlFailure(
    client,
    async () => {
      const runId = `schedule_verify_partial_finish_${suffix}`;
      await insertTwoForecastTasks(client, fixtures, {
        runId,
        baselineId: fixtures.baselineV2Id,
        first: {
          forecastFinish: '2026-01-04',
          forecastDurationDays: 4,
          finishDeltaDays: 1,
          durationDeltaDays: 1,
        },
      });
      await insertForecastRun(client, fixtures, {
        id: runId,
        baselineId: fixtures.baselineV2Id,
        hashSeed: 610,
      });
    },
    '55000',
    null,
    'ScheduleForecastRun partial finish calculation guard',
  );

  await expectSqlFailure(
    client,
    async () => {
      const runId = `schedule_verify_reverse_topology_${suffix}`;
      await insertTwoForecastTasks(client, fixtures, {
        runId,
        baselineId: fixtures.baselineV2Id,
      });
      await insertForecastRun(client, fixtures, {
        id: runId,
        baselineId: fixtures.baselineV2Id,
        hashSeed: 620,
        topologicalOrder: [fixtures.secondSourceTaskId, fixtures.firstSourceTaskId],
      });
    },
    '55000',
    null,
    'ScheduleForecastRun dependency order guard',
  );

  await expectSqlFailure(
    client,
    async () => {
      const runId = `schedule_verify_wrong_explanation_${suffix}`;
      await insertTwoForecastTasks(client, fixtures, {
        runId,
        baselineId: fixtures.baselineV2Id,
        second: {
          driver: {
            kind: 'DEPENDENCY',
            predecessorId: fixtures.firstSourceTaskId,
            type: 'FINISH_TO_START',
            code: 'FS',
            lagDays: 1,
            constraintDate: '2026-01-04',
          },
          relationshipConstraints: [{
            predecessorId: fixtures.firstSourceTaskId,
            type: 'FINISH_TO_START',
            lagDays: 1,
          }],
        },
      });
      await insertForecastRun(client, fixtures, {
        id: runId,
        baselineId: fixtures.baselineV2Id,
        hashSeed: 630,
      });
    },
    '55000',
    null,
    'ScheduleForecastRun exact dependency explanation guard',
  );

  await expectSqlFailure(
    client,
    () => insertForecastRun(client, fixtures, {
      id: `schedule_verify_forecast_count_${suffix}`,
      baselineId: fixtures.baselineV2Id,
      hashSeed: 640,
    }),
    '55000',
    null,
    'ScheduleForecastRun aggregate count seal',
  );

  await expectSqlFailure(
    client,
    () => insertForecastRun(client, fixtures, {
      id: `schedule_verify_bad_topology_${suffix}`,
      baselineId: fixtures.baselineV2Id,
      hashSeed: 650,
      topologicalOrder: {},
    }),
    '23514',
    'ScheduleForecastRun_topology_check',
    'ScheduleForecastRun topology shape guard',
  );

  await expectSqlFailure(
    client,
    async () => {
      const runId = `schedule_verify_cross_baseline_run_${suffix}`;
      await insertTwoForecastTasks(client, fixtures, {
        runId,
        baselineId: fixtures.baselineV1Id,
      });
      await insertForecastRun(client, fixtures, {
        id: runId,
        baselineId: fixtures.baselineV2Id,
        hashSeed: 660,
      });
      await client.query('SET CONSTRAINTS ALL IMMEDIATE');
    },
    '23503',
    'ScheduleForecastTask_run_baseline_scope_fkey',
    'ScheduleForecastTask run-baseline scope guard',
  );

  await expectSqlFailure(
    client,
    () => insertForecastTask(client, fixtures, {
      forecastRunId: fixtures.forecastRunId,
      baselineId: fixtures.baselineV2Id,
      sourceTaskId: fixtures.firstSourceTaskId,
    }),
    '55000',
    null,
    'ScheduleForecastRun late-child seal',
  );

  const immutableTargets = [
    {
      table: 'ScheduleBaseline',
      predicate: '"id" = $1',
      parameters: [fixtures.baselineV2Id],
    },
    {
      table: 'ScheduleBaselineTask',
      predicate: '"baselineId" = $1 AND "sourceTaskId" = $2',
      parameters: [fixtures.baselineV2Id, fixtures.firstSourceTaskId],
    },
    {
      table: 'ScheduleBaselineDependency',
      predicate: '"baselineId" = $1',
      parameters: [fixtures.baselineV2Id],
    },
    {
      table: 'ScheduleForecastRun',
      predicate: '"id" = $1',
      parameters: [fixtures.forecastRunId],
    },
    {
      table: 'ScheduleForecastTask',
      predicate: '"forecastRunId" = $1 AND "sourceTaskId" = $2',
      parameters: [fixtures.forecastRunId, fixtures.firstSourceTaskId],
    },
    {
      table: 'ScheduleProgressObservation',
      predicate: '"id" = $1',
      parameters: [fixtures.observationId],
    },
  ];
  for (const target of immutableTargets) {
    await expectSqlFailure(
      client,
      () => client.query(
        `UPDATE "${target.table}" SET "id" = "id" WHERE ${target.predicate}`,
        target.parameters,
      ),
      '55000',
      null,
      `${target.table} UPDATE immutability`,
    );
    await expectSqlFailure(
      client,
      () => client.query(
        `DELETE FROM "${target.table}" WHERE ${target.predicate}`,
        target.parameters,
      ),
      '55000',
      null,
      `${target.table} DELETE immutability`,
    );
    await expectSqlFailure(
      client,
      // CASCADE bypasses PostgreSQL's earlier inbound-FK refusal so this smoke
      // reaches the table's own BEFORE TRUNCATE append-only trigger. The whole
      // verifier still runs inside a rollback-only transaction and savepoint.
      () => client.query(`TRUNCATE TABLE "${target.table}" CASCADE`),
      '55000',
      null,
      `${target.table} TRUNCATE immutability`,
    );
  }
}

const client = new pg.Client({
  connectionString: verifierConnectionString,
  application_name: 'obrasaas-schedule-snapshot-migration-verifier',
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
    throw new Error('Unable to connect to the dedicated schedule snapshot verification database.');
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
    'PostgreSQL did not activate the configured schedule snapshot migration schema.',
  );
  await client.query("SET LOCAL lock_timeout = '5s'");
  await client.query("SET LOCAL idle_in_transaction_session_timeout = '30s'");
  await assertMigrations(client);
  await assertTables(client);
  await assertEnums(client);
  await assertColumns(client);
  await assertChecks(client);
  await assertIndexes(client);
  await assertForeignKeys(client);
  await assertTriggers(client);
  await assertTriggerFunctions(client);
  await assertTransactionalSmoke(client);
  console.log(
    'Verified immutable schedule baseline/forecast snapshots, reviewed progress provenance, atomic rebaseline, scoped relations and rollback-only smoke.',
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
