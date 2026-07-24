import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

import { config } from 'dotenv';
import pg from 'pg';

const { Pool } = pg;
const DATABASE_ENV = 'ATTENDANCE_MIGRATION_DATABASE_URL';
const APPLICATION_NAME = 'obrasaas-attendance-s2-migration-verifier';

const REQUIRED_MIGRATIONS = Object.freeze([
  '20260724100000_attendance_s2_pending_close_enum',
  '20260724100500_attendance_s2_entry_scope_index',
  '20260724101000_attendance_s2_core',
  '20260724102000_attendance_s2_existing_indexes',
  '20260724103000_attendance_s2_existing_constraints',
]);
const CORE_MIGRATION = '20260724101000_attendance_s2_core';
const S1_SHIFT_MIGRATIONS = Object.freeze([
  '20260723151000_attendance_ledger_expand',
  '20260723152100_attendance_ledger_backfill_run',
]);

const REQUIRED_ENUMS = Object.freeze({
  AttendanceShiftStatus: [
    'OPEN',
    'PENDING_CLOSE',
    'CLOSED',
    'LEGACY_INCOMPLETE',
    'VOIDED',
  ],
  AttendanceScheduleStatus: ['ACTIVE', 'ARCHIVED'],
  AttendanceScheduleVersionStatus: ['DRAFT', 'PUBLISHED', 'RETIRED'],
  AttendanceLatePolicy: ['FULL_FROM_SCHEDULE', 'EXCLUDE_GRACE'],
  AttendanceExpectationKind: ['WORKING', 'NON_WORKING', 'EXCUSED'],
  AttendanceExceptionAction: ['SET', 'CANCEL'],
  AttendanceExceptionType: [
    'EXCUSED_ABSENCE',
    'APPROVED_LEAVE',
    'NON_WORKING_DAY',
    'OFFSITE_WORK',
  ],
  AttendanceCorrectionDecisionKind: ['APPROVED', 'REJECTED'],
  AttendanceAlertType: ['NO_SHOW', 'PENDING_CLOSE'],
  AttendanceAlertTransition: ['OPENED', 'ACKNOWLEDGED', 'RESOLVED'],
});

const REQUIRED_TABLE_COLUMNS = Object.freeze({
  AttendanceSchedule: [
    'id',
    'projectId',
    'name',
    'status',
    'revision',
    'createdAt',
    'updatedAt',
  ],
  AttendanceScheduleVersion: [
    'id',
    'projectId',
    'scheduleId',
    'version',
    'effectiveFrom',
    'timezone',
    'earlyCheckInMinutes',
    'lateToleranceMinutes',
    'latePolicy',
    'noShowAfterMinutes',
    'pendingCloseAfterMinutes',
    'absenceFinalizeAfterMinutes',
    'status',
    'configHash',
    'idempotencyKey',
    'requestFingerprint',
    'createdById',
    'publishedAt',
    'createdAt',
  ],
  AttendanceScheduleDay: [
    'id',
    'projectId',
    'scheduleVersionId',
    'isoWeekday',
    'isWorkingDay',
    'startMinute',
    'endMinute',
    'endDayOffset',
    'expectedBreakMinutes',
  ],
  AttendanceScheduleAssignment: [
    'id',
    'projectId',
    'workerId',
    'scheduleVersionId',
    'effectiveFrom',
    'effectiveThrough',
    'reasonCode',
    'idempotencyKey',
    'requestFingerprint',
    'createdById',
    'endedById',
    'endedAt',
    'createdAt',
  ],
  AttendanceExpectation: [
    'id',
    'projectId',
    'workerId',
    'workDate',
    'revision',
    'createdAt',
    'updatedAt',
  ],
  AttendanceExpectationRevision: [
    'id',
    'projectId',
    'workerId',
    'workDate',
    'expectationId',
    'revision',
    'kind',
    'scheduleVersionId',
    'scheduleDayId',
    'exceptionRevisionId',
    'timezone',
    'expectedStartAt',
    'expectedEndAt',
    'graceEndsAt',
    'noShowAt',
    'pendingCloseAt',
    'absenceAt',
    'latePolicy',
    'expectedBreakMinutes',
    'classifierVersion',
    'policyHash',
    'createdAt',
  ],
  AttendanceException: [
    'id',
    'projectId',
    'workerId',
    'workDate',
    'revision',
    'active',
    'currentType',
    'createdAt',
    'updatedAt',
  ],
  AttendanceExceptionRevision: [
    'id',
    'projectId',
    'workerId',
    'workDate',
    'exceptionId',
    'revision',
    'action',
    'type',
    'reasonCode',
    'note',
    'idempotencyKey',
    'requestFingerprint',
    'createdById',
    'createdAt',
  ],
  AttendanceCorrectionRequest: [
    'id',
    'projectId',
    'workerId',
    'expectationId',
    'shiftId',
    'targetEntryId',
    'baseShiftRevision',
    'baseEffectiveHash',
    'proposedEvents',
    'proposedEffectiveHash',
    'reasonCode',
    'note',
    'requestedByPlatformUserId',
    'requestedByWorkerId',
    'idempotencyKey',
    'requestFingerprint',
    'expiresAt',
    'createdAt',
  ],
  AttendanceCorrectionDecision: [
    'id',
    'requestId',
    'decision',
    'reasonCode',
    'note',
    'decidedById',
    'idempotencyKey',
    'requestFingerprint',
    'createdAt',
  ],
  AttendanceAdjustment: [
    'id',
    'correctionRequestId',
    'appliedShiftRevision',
    'baseLedgerSequence',
    'baseEffectiveHash',
    'effectiveHash',
    'effectiveEvents',
    'createdAt',
  ],
  AttendanceAlertEvent: [
    'id',
    'projectId',
    'workerId',
    'expectationId',
    'expectationRevisionId',
    'shiftId',
    'type',
    'transition',
    'dedupeKey',
    'causationId',
    'classifierVersion',
    'payload',
    'actorId',
    'occurredAt',
    'createdAt',
  ],
});

const NULLABLE_COLUMNS = Object.freeze({
  AttendanceSchedule: [],
  AttendanceScheduleVersion: ['createdById', 'publishedAt'],
  AttendanceScheduleDay: ['startMinute', 'endMinute'],
  AttendanceScheduleAssignment: [
    'effectiveThrough',
    'reasonCode',
    'createdById',
    'endedById',
    'endedAt',
  ],
  AttendanceExpectation: [],
  AttendanceExpectationRevision: [
    'scheduleVersionId',
    'scheduleDayId',
    'exceptionRevisionId',
    'expectedStartAt',
    'expectedEndAt',
    'graceEndsAt',
    'noShowAt',
    'pendingCloseAt',
    'absenceAt',
    'latePolicy',
    'expectedBreakMinutes',
  ],
  AttendanceException: ['currentType'],
  AttendanceExceptionRevision: ['type', 'note', 'createdById'],
  AttendanceCorrectionRequest: [
    'expectationId',
    'targetEntryId',
    'note',
    'requestedByPlatformUserId',
    'requestedByWorkerId',
  ],
  AttendanceCorrectionDecision: ['note'],
  AttendanceAdjustment: [],
  AttendanceAlertEvent: ['shiftId', 'causationId', 'payload', 'actorId'],
});

const REQUIRED_CHECKS = Object.freeze([
  'AttendanceAdjustment_events_check',
  'AttendanceAdjustment_hashes_check',
  'AttendanceAdjustment_revision_check',
  'AttendanceAlertEvent_classifier_not_blank_check',
  'AttendanceAlertEvent_dedupe_not_blank_check',
  'AttendanceAlertEvent_payload_object_check',
  'AttendanceCorrectionDecision_idempotency_not_blank_check',
  'AttendanceCorrectionDecision_reason_not_blank_check',
  'AttendanceCorrectionDecision_request_fingerprint_check',
  'AttendanceCorrectionRequest_actor_check',
  'AttendanceCorrectionRequest_base_revision_check',
  'AttendanceCorrectionRequest_events_check',
  'AttendanceCorrectionRequest_expiry_check',
  'AttendanceCorrectionRequest_hashes_check',
  'AttendanceCorrectionRequest_idempotency_not_blank_check',
  'AttendanceCorrectionRequest_reason_not_blank_check',
  'AttendanceException_current_state_check',
  'AttendanceException_revision_nonnegative_check',
  'AttendanceExceptionRevision_action_shape_check',
  'AttendanceExceptionRevision_idempotency_not_blank_check',
  'AttendanceExceptionRevision_reason_not_blank_check',
  'AttendanceExceptionRevision_request_fingerprint_check',
  'AttendanceExceptionRevision_revision_positive_check',
  'AttendanceExpectation_revision_nonnegative_check',
  'AttendanceExpectationRevision_classifier_not_blank_check',
  'AttendanceExpectationRevision_policy_hash_check',
  'AttendanceExpectationRevision_revision_positive_check',
  'AttendanceExpectationRevision_schedule_link_check',
  'AttendanceExpectationRevision_shape_check',
  'AttendanceExpectationRevision_timezone_not_blank_check',
  'AttendanceSchedule_name_not_blank_check',
  'AttendanceSchedule_revision_nonnegative_check',
  'AttendanceScheduleAssignment_idempotency_not_blank_check',
  'AttendanceScheduleAssignment_range_check',
  'AttendanceScheduleAssignment_request_fingerprint_check',
  'AttendanceScheduleDay_break_check',
  'AttendanceScheduleDay_offset_check',
  'AttendanceScheduleDay_shape_check',
  'AttendanceScheduleDay_weekday_check',
  'AttendanceScheduleVersion_config_hash_check',
  'AttendanceScheduleVersion_idempotency_not_blank_check',
  'AttendanceScheduleVersion_policy_ranges_check',
  'AttendanceScheduleVersion_publish_state_check',
  'AttendanceScheduleVersion_request_fingerprint_check',
  'AttendanceScheduleVersion_timezone_not_blank_check',
  'AttendanceScheduleVersion_version_positive_check',
  'AttendanceShift_lifecycle_check',
  'AttendanceShift_phase_check',
]);

const REQUIRED_FOREIGN_KEYS = Object.freeze([
  'AttendanceAdjustment_correctionRequestId_fkey',
  'AttendanceAlertEvent_actorId_fkey',
  'AttendanceAlertEvent_expectation_scope_fkey',
  'AttendanceAlertEvent_revision_scope_fkey',
  'AttendanceAlertEvent_projectId_fkey',
  'AttendanceAlertEvent_shift_scope_fkey',
  'AttendanceAlertEvent_worker_scope_fkey',
  'AttendanceCorrectionDecision_decidedById_fkey',
  'AttendanceCorrectionDecision_requestId_fkey',
  'AttendanceCorrectionRequest_entry_scope_fkey',
  'AttendanceCorrectionRequest_expectation_scope_fkey',
  'AttendanceCorrectionRequest_projectId_fkey',
  'AttendanceCorrectionRequest_requestedByPlatformUserId_fkey',
  'AttendanceCorrectionRequest_requester_scope_fkey',
  'AttendanceCorrectionRequest_shift_scope_fkey',
  'AttendanceCorrectionRequest_worker_scope_fkey',
  'AttendanceException_projectId_fkey',
  'AttendanceException_worker_scope_fkey',
  'AttendanceExceptionRevision_createdById_fkey',
  'AttendanceExceptionRevision_exception_scope_fkey',
  'AttendanceExpectation_projectId_fkey',
  'AttendanceExpectation_worker_scope_fkey',
  'AttendanceExpectationRevision_day_scope_fkey',
  'AttendanceExpectationRevision_exception_scope_fkey',
  'AttendanceExpectationRevision_expectation_scope_fkey',
  'AttendanceExpectationRevision_version_scope_fkey',
  'AttendanceSchedule_projectId_fkey',
  'AttendanceScheduleAssignment_createdById_fkey',
  'AttendanceScheduleAssignment_endedById_fkey',
  'AttendanceScheduleAssignment_projectId_fkey',
  'AttendanceScheduleAssignment_version_scope_fkey',
  'AttendanceScheduleAssignment_worker_scope_fkey',
  'AttendanceScheduleDay_version_scope_fkey',
  'AttendanceScheduleVersion_createdById_fkey',
  'AttendanceScheduleVersion_projectId_fkey',
  'AttendanceScheduleVersion_schedule_scope_fkey',
  'AttendanceShift_expectation_scope_fkey',
]);

const REQUIRED_INDEXES = Object.freeze([
  'AttendanceAdjustment_created_idx',
  'AttendanceAdjustment_request_key',
  'AttendanceAlertEvent_dedupe_key',
  'AttendanceAlertEvent_expectation_type_idx',
  'AttendanceAlertEvent_project_occurred_idx',
  'AttendanceCorrectionDecision_idempotency_key',
  'AttendanceCorrectionDecision_request_key',
  'AttendanceCorrectionRequest_idempotency_key',
  'AttendanceCorrectionRequest_project_created_idx',
  'AttendanceCorrectionRequest_shift_created_idx',
  'AttendanceEntry_id_project_worker_key',
  'AttendanceException_id_project_worker_key',
  'AttendanceException_id_scope_date_key',
  'AttendanceException_project_date_idx',
  'AttendanceException_worker_date_key',
  'AttendanceExceptionRevision_exception_revision_key',
  'AttendanceExceptionRevision_id_scope_date_key',
  'AttendanceExceptionRevision_idempotency_key',
  'AttendanceExpectation_id_project_worker_key',
  'AttendanceExpectation_id_scope_date_key',
  'AttendanceExpectation_project_date_idx',
  'AttendanceExpectation_worker_date_key',
  'AttendanceExpectationRevision_expectation_revision_key',
  'AttendanceExpectationRevision_id_expectation_scope_key',
  'AttendanceExpectationRevision_no_show_idx',
  'AttendanceExpectationRevision_pending_close_idx',
  'AttendanceSchedule_id_project_key',
  'AttendanceSchedule_project_name_key',
  'AttendanceSchedule_project_status_idx',
  'AttendanceScheduleAssignment_idempotency_key',
  'AttendanceScheduleAssignment_project_effective_idx',
  'AttendanceScheduleAssignment_worker_effective_idx',
  'AttendanceScheduleAssignment_worker_from_key',
  'AttendanceScheduleDay_version_weekday_key',
  'AttendanceScheduleDay_id_version_project_key',
  'AttendanceScheduleVersion_id_project_key',
  'AttendanceScheduleVersion_idempotency_key',
  'AttendanceScheduleVersion_project_effective_idx',
  'AttendanceScheduleVersion_schedule_effective_key',
  'AttendanceScheduleVersion_schedule_version_key',
  'AttendanceShift_expectation_scope_key',
]);

const UNIQUE_INDEXES = new Set([
  'AttendanceAdjustment_request_key',
  'AttendanceAlertEvent_dedupe_key',
  'AttendanceCorrectionDecision_idempotency_key',
  'AttendanceCorrectionDecision_request_key',
  'AttendanceCorrectionRequest_idempotency_key',
  'AttendanceEntry_id_project_worker_key',
  'AttendanceException_id_project_worker_key',
  'AttendanceException_id_scope_date_key',
  'AttendanceException_worker_date_key',
  'AttendanceExceptionRevision_exception_revision_key',
  'AttendanceExceptionRevision_id_scope_date_key',
  'AttendanceExceptionRevision_idempotency_key',
  'AttendanceExpectation_id_project_worker_key',
  'AttendanceExpectation_id_scope_date_key',
  'AttendanceExpectation_worker_date_key',
  'AttendanceExpectationRevision_expectation_revision_key',
  'AttendanceExpectationRevision_id_expectation_scope_key',
  'AttendanceSchedule_id_project_key',
  'AttendanceSchedule_project_name_key',
  'AttendanceScheduleAssignment_idempotency_key',
  'AttendanceScheduleAssignment_worker_from_key',
  'AttendanceScheduleDay_version_weekday_key',
  'AttendanceScheduleDay_id_version_project_key',
  'AttendanceScheduleVersion_id_project_key',
  'AttendanceScheduleVersion_idempotency_key',
  'AttendanceScheduleVersion_schedule_effective_key',
  'AttendanceScheduleVersion_schedule_version_key',
  'AttendanceShift_expectation_scope_key',
]);

function loadEnvironment() {
  config({ path: '.env.local', quiet: true });
  config({ quiet: true });
}

function migrationDatabaseUrl() {
  const value = String(process.env[DATABASE_ENV] || '').trim();
  assert.ok(
    value,
    `${DATABASE_ENV} is required; generic DATABASE_URL values are deliberately ignored.`,
  );

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    assert.fail(`${DATABASE_ENV} must be a valid PostgreSQL URL.`);
  }
  assert.ok(
    ['postgres:', 'postgresql:'].includes(parsed.protocol),
    `${DATABASE_ENV} must use PostgreSQL.`,
  );
  return value;
}

function assertSameMembers(actual, expected, message) {
  assert.deepEqual([...actual].sort(), [...expected].sort(), message);
}

function definitionByName(rows, name) {
  const row = rows.find((candidate) => candidate.name === name);
  assert.ok(row, `${name} must exist.`);
  return String(row.definition || '');
}

function assertDefinition(rows, name, pattern) {
  assert.match(
    definitionByName(rows, name),
    pattern,
    `${name} has an unexpected PostgreSQL definition.`,
  );
}

async function expectDatabaseRejection(
  client,
  { label, text, values, code, constraint = undefined },
) {
  expectDatabaseRejection.sequence += 1;
  const savepoint = `attendance_s2_verify_${expectDatabaseRejection.sequence}`;
  await client.query(`SAVEPOINT ${savepoint}`);

  let rejection;
  try {
    await client.query(text, values);
  } catch (error) {
    rejection = error;
  }

  await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
  await client.query(`RELEASE SAVEPOINT ${savepoint}`);

  assert.ok(rejection, `${label}: PostgreSQL accepted an invalid row.`);
  assert.equal(
    rejection.code,
    code,
    `${label}: expected SQLSTATE ${code}.`,
  );
  if (constraint !== undefined) {
    assert.equal(
      rejection.constraint,
      constraint,
      `${label}: expected constraint ${constraint}.`,
    );
  }
}
expectDatabaseRejection.sequence = 0;

async function verifyCatalog(client) {
  const schemaResult = await client.query(`
    SELECT current_schema() AS "schemaName",
           current_setting('server_version_num')::integer AS "serverVersion"
  `);
  const [schema] = schemaResult.rows;
  assert.equal(schema.schemaName, 'public', 'Attendance S2 must be installed in public.');
  assert.ok(
    schema.serverVersion >= 170000 && schema.serverVersion < 180000,
    'Attendance S2 verification requires PostgreSQL 17.x.',
  );

  const migrationsResult = await client.query(`
    SELECT "migration_name" AS "migrationName"
    FROM "_prisma_migrations"
    WHERE "migration_name" = ANY($1::text[])
      AND "finished_at" IS NOT NULL
      AND "rolled_back_at" IS NULL
    ORDER BY "migration_name"
  `, [REQUIRED_MIGRATIONS]);
  assert.deepEqual(
    migrationsResult.rows.map((row) => row.migrationName),
    [...REQUIRED_MIGRATIONS].sort(),
    'Every Attendance S2 migration must be applied successfully.',
  );

  const enumResult = await client.query(`
    SELECT enum_type.typname::text AS "typeName",
           enum_value.enumlabel::text AS "label"
    FROM pg_type AS enum_type
    INNER JOIN pg_enum AS enum_value ON enum_value.enumtypid = enum_type.oid
    INNER JOIN pg_namespace AS enum_schema ON enum_schema.oid = enum_type.typnamespace
    WHERE enum_schema.nspname = 'public'
      AND enum_type.typname = ANY($1::text[])
    ORDER BY enum_type.typname, enum_value.enumsortorder
  `, [Object.keys(REQUIRED_ENUMS)]);
  for (const [typeName, labels] of Object.entries(REQUIRED_ENUMS)) {
    assert.deepEqual(
      enumResult.rows
        .filter((row) => row.typeName === typeName)
        .map((row) => row.label),
      labels,
      `${typeName} must retain its ordered S2 contract.`,
    );
  }

  const extensionResult = await client.query(`
    SELECT extension_state.extname::text AS "name"
    FROM pg_extension AS extension_state
    WHERE extension_state.extname = 'btree_gist'
  `);
  assert.equal(
    extensionResult.rows.length,
    1,
    'The btree_gist extension must be installed exactly once.',
  );

  const tableNames = Object.keys(REQUIRED_TABLE_COLUMNS);
  const tableResult = await client.query(`
    SELECT table_name AS "tableName"
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name = ANY($1::text[])
  `, [tableNames]);
  assertSameMembers(
    tableResult.rows.map((row) => row.tableName),
    tableNames,
    'Every Attendance S2 table must exist in public.',
  );

  const columnsResult = await client.query(`
    SELECT table_name AS "tableName",
           column_name AS "columnName",
           is_nullable AS "isNullable"
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ANY($1::text[])
  `, [tableNames]);
  for (const [tableName, expectedColumns] of Object.entries(REQUIRED_TABLE_COLUMNS)) {
    const tableColumns = columnsResult.rows.filter((row) => row.tableName === tableName);
    assertSameMembers(
      tableColumns.map((row) => row.columnName),
      expectedColumns,
      `${tableName} must expose its exact S2 column contract.`,
    );
    assertSameMembers(
      tableColumns
        .filter((row) => row.isNullable === 'YES')
        .map((row) => row.columnName),
      NULLABLE_COLUMNS[tableName],
      `${tableName} nullability must match the S2 contract.`,
    );
  }

  const existingColumnsResult = await client.query(`
    SELECT table_name AS "tableName",
           column_name AS "columnName",
           is_nullable AS "isNullable"
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('AttendanceEntry', 'AttendanceShift')
      AND column_name IN ('expectationId')
  `);
  assert.deepEqual(
    existingColumnsResult.rows,
    [{ tableName: 'AttendanceShift', columnName: 'expectationId', isNullable: 'YES' }],
    'Only AttendanceShift may gain nullable expectationId; AttendanceEntry remains physical evidence.',
  );

  const constraintsResult = await client.query(`
    SELECT constraint_state.conname::text AS "name",
           constraint_state.contype::text AS "type",
           constraint_state.convalidated AS "isValidated",
           source_table.relname::text AS "tableName",
           pg_get_constraintdef(constraint_state.oid, TRUE) AS "definition"
    FROM pg_constraint AS constraint_state
    INNER JOIN pg_class AS source_table ON source_table.oid = constraint_state.conrelid
    INNER JOIN pg_namespace AS source_schema ON source_schema.oid = source_table.relnamespace
    WHERE source_schema.nspname = 'public'
      AND constraint_state.conname = ANY($1::text[])
  `, [[...REQUIRED_CHECKS, ...REQUIRED_FOREIGN_KEYS]]);
  const checks = constraintsResult.rows.filter((row) => REQUIRED_CHECKS.includes(row.name));
  const foreignKeys = constraintsResult.rows.filter(
    (row) => REQUIRED_FOREIGN_KEYS.includes(row.name),
  );
  assertSameMembers(
    checks.map((row) => row.name),
    REQUIRED_CHECKS,
    'Every Attendance S2 check constraint must exist.',
  );
  assert.equal(
    checks.every((row) => row.type === 'c' && row.isValidated === true),
    true,
    'Every Attendance S2 check constraint must be validated.',
  );
  assertSameMembers(
    foreignKeys.map((row) => row.name),
    REQUIRED_FOREIGN_KEYS,
    'Every Attendance S2 foreign key must exist.',
  );
  assert.equal(
    foreignKeys.every((row) => row.type === 'f' && row.isValidated === true),
    true,
    'Every Attendance S2 foreign key must be validated.',
  );

  assertDefinition(
    checks,
    'AttendanceScheduleVersion_policy_ranges_check',
    /lateToleranceMinutes[\s\S]*noShowAfterMinutes[\s\S]*pendingCloseAfterMinutes[\s\S]*absenceFinalizeAfterMinutes/i,
  );
  assertDefinition(
    checks,
    'AttendanceScheduleDay_shape_check',
    /isWorkingDay[\s\S]*startMinute[\s\S]*endMinute[\s\S]*endDayOffset[\s\S]*expectedBreakMinutes/i,
  );
  assertDefinition(
    checks,
    'AttendanceExpectationRevision_shape_check',
    /WORKING[\s\S]*NON_WORKING[\s\S]*EXCUSED/i,
  );
  assertDefinition(
    checks,
    'AttendanceExpectationRevision_schedule_link_check',
    /scheduleDayId[\s\S]*IS NULL[\s\S]*scheduleVersionId[\s\S]*IS NOT NULL/i,
  );
  assertDefinition(
    checks,
    'AttendanceCorrectionRequest_actor_check',
    /requestedByPlatformUserId[\s\S]*requestedByWorkerId[\s\S]*= 1/i,
  );
  assertDefinition(
    checks,
    'AttendanceCorrectionRequest_events_check',
    /jsonb_typeof[\s\S]*array[\s\S]*jsonb_array_length[\s\S]*1[\s\S]*64/i,
  );
  assertDefinition(
    checks,
    'AttendanceCorrectionRequest_hashes_check',
    /baseEffectiveHash[\s\S]*proposedEffectiveHash[\s\S]*requestFingerprint[\s\S]*0-9a-f[\s\S]*64/i,
  );
  assertDefinition(
    checks,
    'AttendanceAdjustment_revision_check',
    /appliedShiftRevision[\s\S]*> 0[\s\S]*baseLedgerSequence[\s\S]*> 0/i,
  );
  assertDefinition(
    checks,
    'AttendanceShift_lifecycle_check',
    /OPEN[\s\S]*PENDING_CLOSE[\s\S]*CLOSED[\s\S]*LEGACY_INCOMPLETE[\s\S]*VOIDED/i,
  );

  assertDefinition(
    foreignKeys,
    'AttendanceScheduleVersion_schedule_scope_fkey',
    /FOREIGN KEY.*scheduleId.*projectId.*REFERENCES.*AttendanceSchedule.*id.*projectId/i,
  );
  assertDefinition(
    foreignKeys,
    'AttendanceScheduleAssignment_worker_scope_fkey',
    /FOREIGN KEY.*projectId.*workerId.*REFERENCES.*Worker.*projectId.*id/i,
  );
  assertDefinition(
    foreignKeys,
    'AttendanceScheduleAssignment_version_scope_fkey',
    /FOREIGN KEY.*scheduleVersionId.*projectId.*REFERENCES.*AttendanceScheduleVersion.*id.*projectId/i,
  );
  assertDefinition(
    foreignKeys,
    'AttendanceScheduleDay_version_scope_fkey',
    /FOREIGN KEY.*scheduleVersionId.*projectId.*REFERENCES.*AttendanceScheduleVersion.*id.*projectId/i,
  );
  assertDefinition(
    foreignKeys,
    'AttendanceExpectationRevision_expectation_scope_fkey',
    /FOREIGN KEY.*expectationId.*projectId.*workerId.*workDate.*REFERENCES.*AttendanceExpectation.*id.*projectId.*workerId.*workDate/i,
  );
  assertDefinition(
    foreignKeys,
    'AttendanceExpectationRevision_version_scope_fkey',
    /FOREIGN KEY.*scheduleVersionId.*projectId.*REFERENCES.*AttendanceScheduleVersion.*id.*projectId/i,
  );
  assertDefinition(
    foreignKeys,
    'AttendanceExpectationRevision_day_scope_fkey',
    /FOREIGN KEY.*scheduleDayId.*scheduleVersionId.*projectId.*REFERENCES.*AttendanceScheduleDay.*id.*scheduleVersionId.*projectId/i,
  );
  assertDefinition(
    foreignKeys,
    'AttendanceExpectationRevision_exception_scope_fkey',
    /FOREIGN KEY.*exceptionRevisionId.*projectId.*workerId.*workDate.*REFERENCES.*AttendanceExceptionRevision.*id.*projectId.*workerId.*workDate/i,
  );
  assertDefinition(
    foreignKeys,
    'AttendanceAlertEvent_revision_scope_fkey',
    /FOREIGN KEY.*expectationRevisionId.*expectationId.*projectId.*workerId.*REFERENCES.*AttendanceExpectationRevision.*id.*expectationId.*projectId.*workerId/i,
  );
  assertDefinition(
    foreignKeys,
    'AttendanceCorrectionRequest_expectation_scope_fkey',
    /FOREIGN KEY.*expectationId.*projectId.*workerId.*REFERENCES.*AttendanceExpectation.*id.*projectId.*workerId/i,
  );
  assertDefinition(
    foreignKeys,
    'AttendanceCorrectionRequest_shift_scope_fkey',
    /FOREIGN KEY.*shiftId.*projectId.*workerId.*REFERENCES.*AttendanceShift.*id.*projectId.*workerId/i,
  );
  assertDefinition(
    foreignKeys,
    'AttendanceCorrectionRequest_entry_scope_fkey',
    /FOREIGN KEY.*targetEntryId.*projectId.*workerId.*REFERENCES.*AttendanceEntry.*id.*projectId.*workerId/i,
  );
  assertDefinition(
    foreignKeys,
    'AttendanceShift_expectation_scope_fkey',
    /FOREIGN KEY.*expectationId.*projectId.*workerId.*REFERENCES.*AttendanceExpectation.*id.*projectId.*workerId/i,
  );

  const indexesResult = await client.query(`
    SELECT index_class.relname::text AS "name",
           index_state.indisunique AS "isUnique",
           index_state.indisvalid AS "isValid",
           index_state.indisready AS "isReady",
           pg_get_indexdef(index_state.indexrelid) AS "definition"
    FROM pg_class AS index_class
    INNER JOIN pg_index AS index_state ON index_state.indexrelid = index_class.oid
    INNER JOIN pg_namespace AS index_schema ON index_schema.oid = index_class.relnamespace
    WHERE index_schema.nspname = 'public'
      AND index_class.relname = ANY($1::text[])
  `, [REQUIRED_INDEXES]);
  const indexes = indexesResult.rows;
  assertSameMembers(
    indexes.map((row) => row.name),
    REQUIRED_INDEXES,
    'Every Attendance S2 index must exist.',
  );
  assert.equal(
    indexes.every((row) => row.isValid === true && row.isReady === true),
    true,
    'Every Attendance S2 index must be valid and ready.',
  );
  for (const index of indexes) {
    assert.equal(
      index.isUnique,
      UNIQUE_INDEXES.has(index.name),
      `${index.name} uniqueness must match the S2 contract.`,
    );
  }
  assertDefinition(
    indexes,
    'AttendanceEntry_id_project_worker_key',
    /UNIQUE INDEX.*AttendanceEntry.*id.*projectId.*workerId/i,
  );
  assertDefinition(
    indexes,
    'AttendanceShift_expectation_scope_key',
    /UNIQUE INDEX.*AttendanceShift.*expectationId.*projectId.*workerId/i,
  );

  const exclusionResult = await client.query(`
    SELECT constraint_state.conname::text AS "name",
           constraint_state.contype::text AS "type",
           constraint_state.convalidated AS "isValidated",
           access_method.amname::text AS "accessMethod",
           index_state.indisvalid AS "isValid",
           index_state.indisready AS "isReady",
           pg_get_constraintdef(constraint_state.oid, TRUE) AS "definition"
    FROM pg_constraint AS constraint_state
    INNER JOIN pg_class AS source_table ON source_table.oid = constraint_state.conrelid
    INNER JOIN pg_namespace AS source_schema ON source_schema.oid = source_table.relnamespace
    INNER JOIN pg_class AS backing_index ON backing_index.oid = constraint_state.conindid
    INNER JOIN pg_am AS access_method ON access_method.oid = backing_index.relam
    INNER JOIN pg_index AS index_state ON index_state.indexrelid = backing_index.oid
    WHERE source_schema.nspname = 'public'
      AND source_table.relname = 'AttendanceScheduleAssignment'
      AND constraint_state.conname = 'AttendanceScheduleAssignment_no_overlap_excl'
  `);
  assert.equal(exclusionResult.rows.length, 1, 'The assignment exclusion must exist once.');
  const [exclusion] = exclusionResult.rows;
  assert.equal(exclusion.type, 'x', 'The assignment overlap invariant must be an exclusion.');
  assert.equal(exclusion.isValidated, true, 'The assignment exclusion must be validated.');
  assert.equal(exclusion.accessMethod, 'gist', 'The assignment exclusion must use GiST.');
  assert.equal(
    exclusion.isValid === true && exclusion.isReady === true,
    true,
    'The assignment exclusion index must be valid and ready.',
  );
  assert.match(exclusion.definition, /EXCLUDE USING gist/i);
  assert.match(exclusion.definition, /projectId.*WITH =/i);
  assert.match(exclusion.definition, /workerId.*WITH =/i);
  assert.match(exclusion.definition, /daterange.*effectiveFrom.*effectiveThrough.*infinity[\s\S]*WITH &&/i);

  return {
    serverVersion: schema.serverVersion,
    tableCount: tableNames.length,
    checkCount: checks.length,
    foreignKeyCount: foreignKeys.length,
    indexCount: indexes.length,
  };
}

async function verifyHistoricalIsolation(client) {
  const integrityResult = await client.query(`
    WITH s2_cutover AS (
      SELECT "finished_at" AS "finishedAt"
      FROM "_prisma_migrations"
      WHERE "migration_name" = $1
        AND "finished_at" IS NOT NULL
        AND "rolled_back_at" IS NULL
    )
    SELECT
      (
        SELECT COUNT(*)::integer
        FROM "AttendanceShift" AS shift
        CROSS JOIN s2_cutover
        WHERE shift."createdAt" <= s2_cutover."finishedAt"
          AND shift."expectationId" IS NOT NULL
      ) AS "historicalShiftsWithExpectation",
      (
        SELECT COUNT(*)::integer
        FROM "AttendanceShift"
        WHERE "status" = 'LEGACY_INCOMPLETE'::"AttendanceShiftStatus"
          AND "expectationId" IS NOT NULL
      ) AS "legacyShiftsWithExpectation",
      (
        SELECT COUNT(*)::integer
        FROM "AttendanceShift"
        WHERE (
          "metadata"->>'rollingCompatibility' = 'true'
          OR "metadata"->>'migration' = ANY($2::text[])
        )
          AND "expectationId" IS NOT NULL
      ) AS "s1CompatibilityShiftsWithExpectation"
  `, [CORE_MIGRATION, S1_SHIFT_MIGRATIONS]);
  assert.deepEqual(integrityResult.rows[0], {
    historicalShiftsWithExpectation: 0,
    legacyShiftsWithExpectation: 0,
    s1CompatibilityShiftsWithExpectation: 0,
  }, 'S1 and legacy shifts must not be assigned invented S2 expectations.');
}

function fixtureIds() {
  const token = randomUUID();
  const prefix = `attendance-s2-verifier:${token}`;
  return {
    prefix,
    organization: `${prefix}:organization`,
    platformUser: `${prefix}:platform-user`,
    projectA: `${prefix}:project-a`,
    projectB: `${prefix}:project-b`,
    workerA: `${prefix}:worker-a`,
    workerB: `${prefix}:worker-b`,
    scheduleA: `${prefix}:schedule-a`,
    scheduleB: `${prefix}:schedule-b`,
    versionA: `${prefix}:version-a`,
    versionB: `${prefix}:version-b`,
    dayA: `${prefix}:day-a`,
    dayB: `${prefix}:day-b`,
    assignmentA: `${prefix}:assignment-a`,
    expectationA: `${prefix}:expectation-a`,
    expectationB: `${prefix}:expectation-b`,
    expectationRevisionA: `${prefix}:expectation-revision-a`,
    expectationRevisionB: `${prefix}:expectation-revision-b`,
    exceptionA: `${prefix}:exception-a`,
    exceptionB: `${prefix}:exception-b`,
    exceptionRevisionA: `${prefix}:exception-revision-a`,
    exceptionRevisionB: `${prefix}:exception-revision-b`,
    shiftA: `${prefix}:shift-a`,
    shiftB: `${prefix}:shift-b`,
    legacyShift: `${prefix}:legacy-shift`,
    entryA: `${prefix}:entry-a`,
    entryB: `${prefix}:entry-b`,
  };
}

async function insertScheduleVersion(client, {
  id,
  projectId,
  scheduleId,
  version,
  effectiveFrom,
  hash,
  idempotencyKey,
  fingerprint,
  lateToleranceMinutes = 10,
  noShowAfterMinutes = 30,
}) {
  await client.query(`
    INSERT INTO "AttendanceScheduleVersion" (
      "id", "projectId", "scheduleId", "version", "effectiveFrom", "timezone",
      "earlyCheckInMinutes", "lateToleranceMinutes", "latePolicy",
      "noShowAfterMinutes", "pendingCloseAfterMinutes", "absenceFinalizeAfterMinutes",
      "status", "configHash", "idempotencyKey", "requestFingerprint", "publishedAt"
    ) VALUES (
      $1, $2, $3, $4, $5::date, 'UTC',
      120, $6, 'FULL_FROM_SCHEDULE',
      $7, 60, 120,
      'PUBLISHED', $8, $9, $10, CURRENT_TIMESTAMP
    )
  `, [
    id,
    projectId,
    scheduleId,
    version,
    effectiveFrom,
    lateToleranceMinutes,
    noShowAfterMinutes,
    hash,
    idempotencyKey,
    fingerprint,
  ]);
}

const CORRECTION_INSERT = `
  INSERT INTO "AttendanceCorrectionRequest" (
    "id", "projectId", "workerId", "expectationId", "shiftId", "targetEntryId",
    "baseShiftRevision", "baseEffectiveHash", "proposedEvents", "proposedEffectiveHash",
    "reasonCode", "note", "requestedByPlatformUserId", "requestedByWorkerId",
    "idempotencyKey", "requestFingerprint", "expiresAt", "createdAt"
  ) VALUES (
    $1, $2, $3, $4, $5, $6,
    $7, $8, $9::jsonb, $10,
    $11, $12, $13, $14,
    $15, $16, CURRENT_TIMESTAMP + INTERVAL '1 day', CURRENT_TIMESTAMP
  )
`;

function correctionValues(ids, suffix, overrides = {}) {
  const defaults = {
    projectId: ids.projectA,
    workerId: ids.workerA,
    expectationId: ids.expectationA,
    shiftId: ids.shiftA,
    targetEntryId: ids.entryA,
    baseShiftRevision: 0,
    baseEffectiveHash: 'a'.repeat(64),
    proposedEvents: JSON.stringify([{ eventType: 'CHECK_OUT' }]),
    proposedEffectiveHash: 'b'.repeat(64),
    reasonCode: 'TIME_CORRECTION',
    note: null,
    requestedByPlatformUserId: null,
    requestedByWorkerId: ids.workerA,
    idempotencyKey: `${ids.prefix}:correction:${suffix}`,
    requestFingerprint: 'c'.repeat(64),
    ...overrides,
  };
  return [
    `${ids.prefix}:correction-request:${suffix}`,
    defaults.projectId,
    defaults.workerId,
    defaults.expectationId,
    defaults.shiftId,
    defaults.targetEntryId,
    defaults.baseShiftRevision,
    defaults.baseEffectiveHash,
    defaults.proposedEvents,
    defaults.proposedEffectiveHash,
    defaults.reasonCode,
    defaults.note,
    defaults.requestedByPlatformUserId,
    defaults.requestedByWorkerId,
    defaults.idempotencyKey,
    defaults.requestFingerprint,
  ];
}

async function verifySemanticConstraints(client) {
  const ids = fixtureIds();
  const hashA = '1'.repeat(64);
  const hashB = '2'.repeat(64);
  const fingerprint = 'f'.repeat(64);
  let transactionOpen = false;

  try {
    await client.query('BEGIN');
    transactionOpen = true;
    await client.query(`SET LOCAL lock_timeout = '5s'`);
    await client.query(`SET LOCAL statement_timeout = '15s'`);

    await client.query(`
      INSERT INTO "Organization" ("id", "name", "slug", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [ids.organization, 'Attendance S2 verifier', `attendance-s2-${ids.prefix.slice(-36)}`]);
    await client.query(`
      INSERT INTO "PlatformUser" (
        "id", "clerkUserId", "primaryEmail", "fullName", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      ids.platformUser,
      `${ids.prefix}:clerk`,
      `attendance-s2-${ids.prefix.slice(-36)}@example.invalid`,
      'Attendance S2 verifier',
    ]);
    await client.query(`
      INSERT INTO "Project" (
        "id", "organizationId", "name", "slug", "createdAt", "updatedAt"
      ) VALUES
        ($1, $3, 'Attendance S2 project A', $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ($2, $3, 'Attendance S2 project B', $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      ids.projectA,
      ids.projectB,
      ids.organization,
      `attendance-s2-a-${ids.prefix.slice(-36)}`,
      `attendance-s2-b-${ids.prefix.slice(-36)}`,
    ]);
    await client.query(`
      INSERT INTO "Worker" (
        "id", "projectId", "phone", "name", "createdAt", "updatedAt"
      ) VALUES
        ($1, $3, $4, 'Attendance S2 worker A', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ($2, $5, $6, 'Attendance S2 worker B', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      ids.workerA,
      ids.workerB,
      ids.projectA,
      `${ids.prefix}:phone-a`,
      ids.projectB,
      `${ids.prefix}:phone-b`,
    ]);
    await client.query(`
      INSERT INTO "AttendanceSchedule" (
        "id", "projectId", "name", "status", "revision", "createdAt", "updatedAt"
      ) VALUES
        ($1, $3, 'Verifier schedule A', 'ACTIVE', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ($2, $4, 'Verifier schedule B', 'ACTIVE', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [ids.scheduleA, ids.scheduleB, ids.projectA, ids.projectB]);
    await insertScheduleVersion(client, {
      id: ids.versionA,
      projectId: ids.projectA,
      scheduleId: ids.scheduleA,
      version: 1,
      effectiveFrom: '2030-01-01',
      hash: hashA,
      idempotencyKey: `${ids.prefix}:version-a`,
      fingerprint,
    });
    await insertScheduleVersion(client, {
      id: ids.versionB,
      projectId: ids.projectB,
      scheduleId: ids.scheduleB,
      version: 1,
      effectiveFrom: '2030-01-01',
      hash: hashB,
      idempotencyKey: `${ids.prefix}:version-b`,
      fingerprint,
    });
    await client.query(`
      INSERT INTO "AttendanceScheduleDay" (
        "id", "projectId", "scheduleVersionId", "isoWeekday", "isWorkingDay",
        "startMinute", "endMinute", "endDayOffset", "expectedBreakMinutes"
      ) VALUES
        ($1, $3, $5, 1, TRUE, 480, 1020, 0, 60),
        ($2, $4, $6, 1, TRUE, 480, 1020, 0, 60)
    `, [ids.dayA, ids.dayB, ids.projectA, ids.projectB, ids.versionA, ids.versionB]);
    await client.query(`
      INSERT INTO "AttendanceScheduleAssignment" (
        "id", "projectId", "workerId", "scheduleVersionId",
        "effectiveFrom", "effectiveThrough", "reasonCode",
        "idempotencyKey", "requestFingerprint", "createdAt"
      ) VALUES (
        $1, $2, $3, $4,
        '2030-01-01'::date, '2030-12-31'::date, 'INITIAL_ASSIGNMENT',
        $5, $6, CURRENT_TIMESTAMP
      )
    `, [
      ids.assignmentA,
      ids.projectA,
      ids.workerA,
      ids.versionA,
      `${ids.prefix}:assignment-a`,
      fingerprint,
    ]);

    await expectDatabaseRejection(client, {
      label: 'overlapping schedule assignment',
      text: `
        INSERT INTO "AttendanceScheduleAssignment" (
          "id", "projectId", "workerId", "scheduleVersionId",
          "effectiveFrom", "effectiveThrough", "idempotencyKey", "requestFingerprint"
        ) VALUES ($1, $2, $3, $4, '2030-06-01'::date, '2030-06-30'::date, $5, $6)
      `,
      values: [
        `${ids.prefix}:assignment-overlap`,
        ids.projectA,
        ids.workerA,
        ids.versionA,
        `${ids.prefix}:assignment-overlap`,
        fingerprint,
      ],
      code: '23P01',
      constraint: 'AttendanceScheduleAssignment_no_overlap_excl',
    });
    await expectDatabaseRejection(client, {
      label: 'cross-project schedule version assignment',
      text: `
        INSERT INTO "AttendanceScheduleAssignment" (
          "id", "projectId", "workerId", "scheduleVersionId",
          "effectiveFrom", "effectiveThrough", "idempotencyKey", "requestFingerprint"
        ) VALUES ($1, $2, $3, $4, '2031-01-01'::date, '2031-01-31'::date, $5, $6)
      `,
      values: [
        `${ids.prefix}:assignment-cross-version`,
        ids.projectA,
        ids.workerA,
        ids.versionB,
        `${ids.prefix}:assignment-cross-version`,
        fingerprint,
      ],
      code: '23503',
      constraint: 'AttendanceScheduleAssignment_version_scope_fkey',
    });
    await expectDatabaseRejection(client, {
      label: 'cross-project worker assignment',
      text: `
        INSERT INTO "AttendanceScheduleAssignment" (
          "id", "projectId", "workerId", "scheduleVersionId",
          "effectiveFrom", "effectiveThrough", "idempotencyKey", "requestFingerprint"
        ) VALUES ($1, $2, $3, $4, '2031-02-01'::date, '2031-02-28'::date, $5, $6)
      `,
      values: [
        `${ids.prefix}:assignment-cross-worker`,
        ids.projectA,
        ids.workerB,
        ids.versionA,
        `${ids.prefix}:assignment-cross-worker`,
        fingerprint,
      ],
      code: '23503',
      constraint: 'AttendanceScheduleAssignment_worker_scope_fkey',
    });
    await expectDatabaseRejection(client, {
      label: 'cross-project schedule version',
      text: `
        INSERT INTO "AttendanceScheduleVersion" (
          "id", "projectId", "scheduleId", "version", "effectiveFrom", "timezone",
          "status", "configHash", "idempotencyKey", "requestFingerprint", "publishedAt"
        ) VALUES ($1, $2, $3, 99, '2035-01-01'::date, 'UTC',
          'PUBLISHED', $4, $5, $6, CURRENT_TIMESTAMP)
      `,
      values: [
        `${ids.prefix}:version-cross-schedule`,
        ids.projectA,
        ids.scheduleB,
        hashA,
        `${ids.prefix}:version-cross-schedule`,
        fingerprint,
      ],
      code: '23503',
      constraint: 'AttendanceScheduleVersion_schedule_scope_fkey',
    });

    await expectDatabaseRejection(client, {
      label: 'blank schedule name',
      text: `
        INSERT INTO "AttendanceSchedule" ("id", "projectId", "name", "updatedAt")
        VALUES ($1, $2, '   ', CURRENT_TIMESTAMP)
      `,
      values: [`${ids.prefix}:schedule-blank`, ids.projectA],
      code: '23514',
      constraint: 'AttendanceSchedule_name_not_blank_check',
    });
    await expectDatabaseRejection(client, {
      label: 'invalid schedule policy ordering',
      text: `
        INSERT INTO "AttendanceScheduleVersion" (
          "id", "projectId", "scheduleId", "version", "effectiveFrom", "timezone",
          "lateToleranceMinutes", "noShowAfterMinutes", "status", "configHash",
          "idempotencyKey", "requestFingerprint", "publishedAt"
        ) VALUES ($1, $2, $3, 2, '2031-01-01'::date, 'UTC',
          60, 30, 'PUBLISHED', $4, $5, $6, CURRENT_TIMESTAMP)
      `,
      values: [
        `${ids.prefix}:version-invalid-policy`,
        ids.projectA,
        ids.scheduleA,
        hashA,
        `${ids.prefix}:version-invalid-policy`,
        fingerprint,
      ],
      code: '23514',
      constraint: 'AttendanceScheduleVersion_policy_ranges_check',
    });
    await expectDatabaseRejection(client, {
      label: 'invalid ISO weekday',
      text: `
        INSERT INTO "AttendanceScheduleDay" (
          "id", "projectId", "scheduleVersionId", "isoWeekday", "isWorkingDay",
          "startMinute", "endMinute", "endDayOffset", "expectedBreakMinutes"
        ) VALUES ($1, $2, $3, 8, TRUE, 480, 1020, 0, 60)
      `,
      values: [`${ids.prefix}:day-invalid-weekday`, ids.projectA, ids.versionA],
      code: '23514',
      constraint: 'AttendanceScheduleDay_weekday_check',
    });
    await expectDatabaseRejection(client, {
      label: 'invalid working-day interval',
      text: `
        INSERT INTO "AttendanceScheduleDay" (
          "id", "projectId", "scheduleVersionId", "isoWeekday", "isWorkingDay",
          "startMinute", "endMinute", "endDayOffset", "expectedBreakMinutes"
        ) VALUES ($1, $2, $3, 2, TRUE, 480, 480, 0, 0)
      `,
      values: [`${ids.prefix}:day-invalid-shape`, ids.projectA, ids.versionA],
      code: '23514',
      constraint: 'AttendanceScheduleDay_shape_check',
    });

    await client.query(`
      INSERT INTO "AttendanceExpectation" (
        "id", "projectId", "workerId", "workDate", "revision", "createdAt", "updatedAt"
      ) VALUES
        ($1, $3, $4, '2030-01-07'::date, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ($2, $5, $6, '2030-01-07'::date, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      ids.expectationA,
      ids.expectationB,
      ids.projectA,
      ids.workerA,
      ids.projectB,
      ids.workerB,
    ]);
    await client.query(`
      INSERT INTO "AttendanceException" (
        "id", "projectId", "workerId", "workDate", "revision", "active", "currentType",
        "createdAt", "updatedAt"
      ) VALUES
        ($1, $3, $4, '2030-01-07'::date, 1, TRUE, 'APPROVED_LEAVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ($2, $5, $6, '2030-01-07'::date, 1, TRUE, 'APPROVED_LEAVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      ids.exceptionA,
      ids.exceptionB,
      ids.projectA,
      ids.workerA,
      ids.projectB,
      ids.workerB,
    ]);
    await client.query(`
      INSERT INTO "AttendanceExceptionRevision" (
        "id", "projectId", "workerId", "workDate", "exceptionId", "revision",
        "action", "type", "reasonCode", "idempotencyKey", "requestFingerprint"
      ) VALUES
        ($1, $3, $4, '2030-01-07'::date, $5, 1, 'SET', 'APPROVED_LEAVE',
          'VERIFIER', $6, $7),
        ($2, $8, $9, '2030-01-07'::date, $10, 1, 'SET', 'APPROVED_LEAVE',
          'VERIFIER', $11, $7)
    `, [
      ids.exceptionRevisionA,
      ids.exceptionRevisionB,
      ids.projectA,
      ids.workerA,
      ids.exceptionA,
      `${ids.prefix}:exception-revision-a`,
      fingerprint,
      ids.projectB,
      ids.workerB,
      ids.exceptionB,
      `${ids.prefix}:exception-revision-b`,
    ]);
    await client.query(`
      INSERT INTO "AttendanceExpectationRevision" (
        "id", "projectId", "workerId", "workDate", "expectationId", "revision", "kind",
        "scheduleVersionId", "scheduleDayId", "timezone", "expectedStartAt", "expectedEndAt",
        "graceEndsAt", "noShowAt", "pendingCloseAt", "absenceAt", "latePolicy",
        "expectedBreakMinutes", "classifierVersion", "policyHash"
      ) VALUES
        ($1, $3, $4, '2030-01-07'::date, $5, 1, 'WORKING', $6, $7, 'UTC',
          '2030-01-07T08:00:00Z', '2030-01-07T17:00:00Z', '2030-01-07T08:10:00Z',
          '2030-01-07T08:30:00Z', '2030-01-07T18:00:00Z', '2030-01-07T19:00:00Z',
          'FULL_FROM_SCHEDULE', 60, 'attendance-day:v1', $8),
        ($2, $9, $10, '2030-01-07'::date, $11, 1, 'WORKING', $12, $13, 'UTC',
          '2030-01-07T08:00:00Z', '2030-01-07T17:00:00Z', '2030-01-07T08:10:00Z',
          '2030-01-07T08:30:00Z', '2030-01-07T18:00:00Z', '2030-01-07T19:00:00Z',
          'FULL_FROM_SCHEDULE', 60, 'attendance-day:v1', $14)
    `, [
      ids.expectationRevisionA,
      ids.expectationRevisionB,
      ids.projectA,
      ids.workerA,
      ids.expectationA,
      ids.versionA,
      ids.dayA,
      hashA,
      ids.projectB,
      ids.workerB,
      ids.expectationB,
      ids.versionB,
      ids.dayB,
      hashB,
    ]);

    await expectDatabaseRejection(client, {
      label: 'cross-project expectation revision schedule version',
      text: `
        INSERT INTO "AttendanceExpectationRevision" (
          "id", "projectId", "workerId", "workDate", "expectationId", "revision", "kind",
          "scheduleVersionId", "scheduleDayId", "timezone", "expectedStartAt", "expectedEndAt",
          "graceEndsAt", "noShowAt", "pendingCloseAt", "absenceAt", "latePolicy",
          "expectedBreakMinutes", "classifierVersion", "policyHash"
        ) VALUES ($1, $2, $3, '2030-01-07', $4, 2, 'WORKING', $5, $6, 'UTC',
          '2030-01-07T08:00:00Z', '2030-01-07T17:00:00Z', '2030-01-07T08:10:00Z',
          '2030-01-07T08:30:00Z', '2030-01-07T18:00:00Z', '2030-01-07T19:00:00Z',
          'FULL_FROM_SCHEDULE', 60, 'attendance-day:v1', $7)
      `,
      values: [
        `${ids.prefix}:expectation-revision-cross-version`,
        ids.projectA,
        ids.workerA,
        ids.expectationA,
        ids.versionB,
        ids.dayB,
        hashA,
      ],
      code: '23503',
    });
    await expectDatabaseRejection(client, {
      label: 'cross-project expectation revision day',
      text: `
        INSERT INTO "AttendanceExpectationRevision" (
          "id", "projectId", "workerId", "workDate", "expectationId", "revision", "kind",
          "scheduleVersionId", "scheduleDayId", "timezone", "expectedStartAt", "expectedEndAt",
          "graceEndsAt", "noShowAt", "pendingCloseAt", "absenceAt", "latePolicy",
          "expectedBreakMinutes", "classifierVersion", "policyHash"
        ) VALUES ($1, $2, $3, '2030-01-07', $4, 2, 'WORKING', $5, $6, 'UTC',
          '2030-01-07T08:00:00Z', '2030-01-07T17:00:00Z', '2030-01-07T08:10:00Z',
          '2030-01-07T08:30:00Z', '2030-01-07T18:00:00Z', '2030-01-07T19:00:00Z',
          'FULL_FROM_SCHEDULE', 60, 'attendance-day:v1', $7)
      `,
      values: [
        `${ids.prefix}:expectation-revision-cross-day`,
        ids.projectA,
        ids.workerA,
        ids.expectationA,
        ids.versionA,
        ids.dayB,
        hashA,
      ],
      code: '23503',
      constraint: 'AttendanceExpectationRevision_day_scope_fkey',
    });
    await expectDatabaseRejection(client, {
      label: 'cross-project expectation revision exception',
      text: `
        INSERT INTO "AttendanceExpectationRevision" (
          "id", "projectId", "workerId", "workDate", "expectationId", "revision", "kind",
          "exceptionRevisionId", "timezone", "classifierVersion", "policyHash"
        ) VALUES ($1, $2, $3, '2030-01-07', $4, 2, 'EXCUSED', $5, 'UTC',
          'attendance-day:v1', $6)
      `,
      values: [
        `${ids.prefix}:expectation-revision-cross-exception`,
        ids.projectA,
        ids.workerA,
        ids.expectationA,
        ids.exceptionRevisionB,
        hashA,
      ],
      code: '23503',
      constraint: 'AttendanceExpectationRevision_exception_scope_fkey',
    });
    await expectDatabaseRejection(client, {
      label: 'expectation revision day without schedule version',
      text: `
        INSERT INTO "AttendanceExpectationRevision" (
          "id", "projectId", "workerId", "workDate", "expectationId", "revision", "kind",
          "scheduleDayId", "timezone", "classifierVersion", "policyHash"
        ) VALUES ($1, $2, $3, '2030-01-07', $4, 2, 'NON_WORKING', $5, 'UTC',
          'attendance-day:v1', $6)
      `,
      values: [
        `${ids.prefix}:expectation-revision-day-without-version`,
        ids.projectA,
        ids.workerA,
        ids.expectationA,
        ids.dayB,
        hashA,
      ],
      code: '23514',
      constraint: 'AttendanceExpectationRevision_schedule_link_check',
    });
    await client.query(`
      INSERT INTO "AttendanceShift" (
        "id", "projectId", "workerId", "workDate", "timezone", "status", "phase",
        "openedAt", "closedAt", "revision", "expectationId", "createdAt", "updatedAt"
      ) VALUES
        ($1, $3, $4, '2030-01-07'::date, 'UTC', 'CLOSED', 'WORKING',
          '2030-01-07T08:00:00Z'::timestamptz, '2030-01-07T17:00:00Z'::timestamptz,
          0, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ($2, $6, $7, '2030-01-07'::date, 'UTC', 'CLOSED', 'WORKING',
          '2030-01-07T08:00:00Z'::timestamptz, '2030-01-07T17:00:00Z'::timestamptz,
          0, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      ids.shiftA,
      ids.shiftB,
      ids.projectA,
      ids.workerA,
      ids.expectationA,
      ids.projectB,
      ids.workerB,
      ids.expectationB,
    ]);
    await client.query(`
      INSERT INTO "AttendanceShift" (
        "id", "projectId", "workerId", "workDate", "timezone", "status", "phase",
        "openedAt", "closedAt", "revision", "expectationId", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, '2030-01-08'::date, 'UTC', 'LEGACY_INCOMPLETE', 'WORKING',
        '2030-01-08T08:00:00Z'::timestamptz, NULL, 0, NULL,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `, [ids.legacyShift, ids.projectA, ids.workerA]);
    const legacyFixtureResult = await client.query(`
      SELECT "expectationId"
      FROM "AttendanceShift"
      WHERE "id" = $1
        AND "status" = 'LEGACY_INCOMPLETE'::"AttendanceShiftStatus"
    `, [ids.legacyShift]);
    assert.deepEqual(
      legacyFixtureResult.rows,
      [{ expectationId: null }],
      'A legacy shift must remain valid without an expectation.',
    );

    await expectDatabaseRejection(client, {
      label: 'cross-project shift expectation',
      text: `
        INSERT INTO "AttendanceShift" (
          "id", "projectId", "workerId", "workDate", "timezone", "status", "phase",
          "openedAt", "closedAt", "revision", "expectationId", "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, '2030-01-09'::date, 'UTC', 'CLOSED', 'WORKING',
          '2030-01-09T08:00:00Z'::timestamptz, '2030-01-09T17:00:00Z'::timestamptz,
          0, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `,
      values: [
        `${ids.prefix}:shift-cross-expectation`,
        ids.projectA,
        ids.workerA,
        ids.expectationB,
      ],
      code: '23503',
      constraint: 'AttendanceShift_expectation_scope_fkey',
    });
    await expectDatabaseRejection(client, {
      label: 'cross-project alert expectation revision',
      text: `
        INSERT INTO "AttendanceAlertEvent" (
          "id", "projectId", "workerId", "expectationId", "expectationRevisionId",
          "type", "transition", "dedupeKey", "classifierVersion"
        ) VALUES ($1, $2, $3, $4, $5, 'NO_SHOW', 'OPENED', $6, 'attendance-day:v1')
      `,
      values: [
        `${ids.prefix}:alert-cross-revision`,
        ids.projectA,
        ids.workerA,
        ids.expectationA,
        ids.expectationRevisionB,
        `${ids.prefix}:alert-cross-revision`,
      ],
      code: '23503',
      constraint: 'AttendanceAlertEvent_revision_scope_fkey',
    });

    await client.query(`
      INSERT INTO "AttendanceEntry" (
        "id", "projectId", "workerId", "shiftId", "eventType", "verificationStatus",
        "occurredAt", "sourceOccurredAt", "sequence", "idempotencyKey",
        "requestFingerprint", "status", "source", "privacyNoticeVersion",
        "checkedInAt", "createdAt"
      ) VALUES
        ($1, $3, $4, $5, 'CHECK_IN', 'VERIFIED',
          '2030-01-07T08:00:00Z'::timestamptz, '2030-01-07T08:00:00Z'::timestamptz,
          1, $6, $7, 'PRESENT', 'migration-verifier', 's2-verifier-v1',
          '2030-01-07T08:00:00Z'::timestamptz, CURRENT_TIMESTAMP),
        ($2, $8, $9, $10, 'CHECK_IN', 'VERIFIED',
          '2030-01-07T08:00:00Z'::timestamptz, '2030-01-07T08:00:00Z'::timestamptz,
          1, $11, $7, 'PRESENT', 'migration-verifier', 's2-verifier-v1',
          '2030-01-07T08:00:00Z'::timestamptz, CURRENT_TIMESTAMP)
    `, [
      ids.entryA,
      ids.entryB,
      ids.projectA,
      ids.workerA,
      ids.shiftA,
      `${ids.prefix}:entry-a`,
      fingerprint,
      ids.projectB,
      ids.workerB,
      ids.shiftB,
      `${ids.prefix}:entry-b`,
    ]);

    await expectDatabaseRejection(client, {
      label: 'correction without actor',
      text: CORRECTION_INSERT,
      values: correctionValues(ids, 'no-actor', {
        requestedByPlatformUserId: null,
        requestedByWorkerId: null,
      }),
      code: '23514',
      constraint: 'AttendanceCorrectionRequest_actor_check',
    });
    await expectDatabaseRejection(client, {
      label: 'correction with two actors',
      text: CORRECTION_INSERT,
      values: correctionValues(ids, 'two-actors', {
        requestedByPlatformUserId: ids.platformUser,
        requestedByWorkerId: ids.workerA,
      }),
      code: '23514',
      constraint: 'AttendanceCorrectionRequest_actor_check',
    });
    await expectDatabaseRejection(client, {
      label: 'correction with malformed hash',
      text: CORRECTION_INSERT,
      values: correctionValues(ids, 'invalid-hash', {
        baseEffectiveHash: 'not-a-sha256',
      }),
      code: '23514',
      constraint: 'AttendanceCorrectionRequest_hashes_check',
    });
    await expectDatabaseRejection(client, {
      label: 'correction with empty event array',
      text: CORRECTION_INSERT,
      values: correctionValues(ids, 'empty-events', {
        proposedEvents: JSON.stringify([]),
      }),
      code: '23514',
      constraint: 'AttendanceCorrectionRequest_events_check',
    });
    await expectDatabaseRejection(client, {
      label: 'cross-project correction expectation',
      text: CORRECTION_INSERT,
      values: correctionValues(ids, 'cross-expectation', {
        expectationId: ids.expectationB,
      }),
      code: '23503',
      constraint: 'AttendanceCorrectionRequest_expectation_scope_fkey',
    });
    await expectDatabaseRejection(client, {
      label: 'cross-project correction shift',
      text: CORRECTION_INSERT,
      values: correctionValues(ids, 'cross-shift', {
        shiftId: ids.shiftB,
        targetEntryId: null,
      }),
      code: '23503',
      constraint: 'AttendanceCorrectionRequest_shift_scope_fkey',
    });
    await expectDatabaseRejection(client, {
      label: 'cross-project correction entry',
      text: CORRECTION_INSERT,
      values: correctionValues(ids, 'cross-entry', {
        targetEntryId: ids.entryB,
      }),
      code: '23503',
      constraint: 'AttendanceCorrectionRequest_entry_scope_fkey',
    });

    await client.query(
      CORRECTION_INSERT,
      correctionValues(ids, 'valid'),
    );
    const validCorrectionResult = await client.query(`
      SELECT COUNT(*)::integer AS "count"
      FROM "AttendanceCorrectionRequest"
      WHERE "id" = $1
        AND jsonb_typeof("proposedEvents") = 'array'
        AND jsonb_array_length("proposedEvents") = 1
        AND "requestedByWorkerId" = $2
        AND "requestedByPlatformUserId" IS NULL
    `, [`${ids.prefix}:correction-request:valid`, ids.workerA]);
    assert.equal(
      validCorrectionResult.rows[0].count,
      1,
      'A valid worker correction must satisfy the S2 contract.',
    );
    await expectDatabaseRejection(client, {
      label: 'adjustment with zero base ledger sequence',
      text: `
        INSERT INTO "AttendanceAdjustment" (
          "id", "correctionRequestId", "appliedShiftRevision", "baseLedgerSequence",
          "baseEffectiveHash", "effectiveHash", "effectiveEvents"
        ) VALUES ($1, $2, 1, 0, $3, $4, $5::jsonb)
      `,
      values: [
        `${ids.prefix}:adjustment-zero-ledger-sequence`,
        `${ids.prefix}:correction-request:valid`,
        'a'.repeat(64),
        'b'.repeat(64),
        JSON.stringify([{ logicalId: ids.entryA, eventType: 'CHECK_IN', occurredAt: '2030-01-07T08:00:00.000Z' }]),
      ],
      code: '23514',
      constraint: 'AttendanceAdjustment_revision_check',
    });
  } finally {
    if (transactionOpen) {
      await client.query('ROLLBACK');
    }
  }

  const cleanupResult = await client.query(`
    SELECT SUM(fixture_count)::integer AS "fixtureCount"
    FROM (
      SELECT COUNT(*) AS fixture_count FROM "Organization" WHERE "id" LIKE $1
      UNION ALL SELECT COUNT(*) FROM "PlatformUser" WHERE "id" LIKE $1
      UNION ALL SELECT COUNT(*) FROM "Project" WHERE "id" LIKE $1
      UNION ALL SELECT COUNT(*) FROM "Worker" WHERE "id" LIKE $1
      UNION ALL SELECT COUNT(*) FROM "AttendanceSchedule" WHERE "id" LIKE $1
      UNION ALL SELECT COUNT(*) FROM "AttendanceScheduleVersion" WHERE "id" LIKE $1
      UNION ALL SELECT COUNT(*) FROM "AttendanceScheduleDay" WHERE "id" LIKE $1
      UNION ALL SELECT COUNT(*) FROM "AttendanceScheduleAssignment" WHERE "id" LIKE $1
      UNION ALL SELECT COUNT(*) FROM "AttendanceExpectation" WHERE "id" LIKE $1
      UNION ALL SELECT COUNT(*) FROM "AttendanceShift" WHERE "id" LIKE $1
      UNION ALL SELECT COUNT(*) FROM "AttendanceEntry" WHERE "id" LIKE $1
      UNION ALL SELECT COUNT(*) FROM "AttendanceCorrectionRequest" WHERE "id" LIKE $1
    ) AS fixture_counts
  `, [`${ids.prefix}%`]);
  assert.equal(
    cleanupResult.rows[0].fixtureCount,
    0,
    'The verifier transaction must leave no prefixed fixture rows.',
  );

  return {
    legacyExpectationIsolation: true,
    overlappingAssignmentsRejected: true,
    crossProjectReferencesRejected: true,
    invalidSchedulesAndDaysRejected: true,
    correctionShapeRejected: true,
    validCorrectionAccepted: true,
    fixturesRolledBack: true,
  };
}

export async function verifyAttendanceS2Migration({ connectionString } = {}) {
  loadEnvironment();
  const pool = new Pool({
    connectionString: connectionString || migrationDatabaseUrl(),
    max: 1,
    application_name: APPLICATION_NAME,
  });
  let client;
  try {
    client = await pool.connect();
    const catalog = await verifyCatalog(client);
    await verifyHistoricalIsolation(client);
    const semantics = await verifySemanticConstraints(client);
    return {
      ok: true,
      verifier: 'attendance-s2',
      postgresMajor: Math.floor(catalog.serverVersion / 10000),
      migrationCount: REQUIRED_MIGRATIONS.length,
      tableCount: catalog.tableCount,
      checkCount: catalog.checkCount,
      foreignKeyCount: catalog.foreignKeyCount,
      indexCount: catalog.indexCount,
      exclusionConstraint: 'gist',
      semantics,
    };
  } finally {
    client?.release();
    await pool.end();
  }
}

function publicErrorMessage(error) {
  if (error?.name === 'AssertionError') {
    return String(error.message || 'Attendance S2 assertion failed.').split('\n')[0];
  }
  const code = String(error?.code || '').replace(/[^A-Za-z0-9_-]/g, '');
  return code
    ? `PostgreSQL verification failed (${code}).`
    : 'PostgreSQL verification failed.';
}

async function main() {
  try {
    const result = await verifyAttendanceS2Migration();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`Attendance S2 migration verification failed: ${publicErrorMessage(error)}`);
    process.exitCode = 1;
  }
}

const isMain = Boolean(
  process.argv[1]
    && import.meta.url === pathToFileURL(resolve(process.argv[1])).href,
);
if (isMain) {
  await main();
}
