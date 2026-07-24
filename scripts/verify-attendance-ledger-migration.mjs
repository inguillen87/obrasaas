import assert from 'node:assert/strict';

import { config } from 'dotenv';
import pg from 'pg';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

const { Pool } = pg;
const DATABASE_ENV = 'ATTENDANCE_MIGRATION_DATABASE_URL';
const REQUIRED_MIGRATIONS = Object.freeze([
  '20260723150000_attendance_status_expired_enum',
  '20260723151000_attendance_ledger_expand',
  '20260723151100_attendance_worker_scope_index',
  '20260723151200_attendance_ledger_scope_fks',
  '20260723152000_attendance_ledger_backfill',
  '20260723152100_attendance_ledger_backfill_run',
  '20260723152200_attendance_ledger_backfill_cleanup',
  '20260723153000_attendance_ledger_validate_shifts',
  '20260723153100_attendance_ledger_validate_geo',
  '20260723153200_attendance_ledger_validate_events',
  '20260723153300_attendance_ledger_validate_fks',
  '20260723153400_attendance_idempotency_index',
  '20260723153500_attendance_one_open_shift_index',
  '20260723153600_attendance_shift_sequence_index',
  '20260723153700_attendance_one_check_in_index',
  '20260723153800_attendance_one_check_out_index',
  '20260723153900_attendance_shift_project_index',
  '20260723154000_attendance_shift_worker_index',
  '20260723154100_attendance_event_occurred_index',
  '20260723154200_attendance_ledger_contract',
]);
const BACKFILL_MIGRATION = '20260723152100_attendance_ledger_backfill_run';
const EXPAND_MIGRATION = '20260723151000_attendance_ledger_expand';
const REQUIRED_ENUMS = Object.freeze({
  AttendanceStatus: [
    'PRESENT',
    'OUTSIDE_GEOFENCE',
    'EXCUSED',
    'ABSENT',
    'PENDING_GEO',
    'EXPIRED',
  ],
  AttendanceEventType: ['CHECK_IN', 'BREAK_START', 'BREAK_END', 'CHECK_OUT'],
  AttendanceVerificationStatus: [
    'LEGACY',
    'PENDING',
    'VERIFIED',
    'REVIEW_REQUIRED',
    'NOT_REQUIRED',
    'EXPIRED',
    'VOIDED',
  ],
  AttendanceShiftStatus: ['OPEN', 'CLOSED', 'LEGACY_INCOMPLETE', 'VOIDED'],
  AttendanceShiftPhase: ['WORKING', 'ON_BREAK'],
});
const REQUIRED_ENTRY_COLUMNS = Object.freeze([
  'shiftId',
  'eventType',
  'verificationStatus',
  'occurredAt',
  'sourceOccurredAt',
  'sequence',
  'idempotencyKey',
  'requestFingerprint',
  'accuracyMeters',
  'geofenceRadiusMeters',
  'privacyNoticeVersion',
  'evidence',
]);
const REQUIRED_SHIFT_COLUMNS = Object.freeze([
  'id',
  'projectId',
  'workerId',
  'workDate',
  'timezone',
  'status',
  'phase',
  'openedAt',
  'closedAt',
  'revision',
  'metadata',
  'createdAt',
  'updatedAt',
]);
const REQUIRED_CONSTRAINTS = Object.freeze([
  'Worker_projectId_id_key',
  'AttendanceShift_id_project_worker_key',
  'AttendanceShift_revision_nonnegative_check',
  'AttendanceShift_timezone_not_blank_check',
  'AttendanceShift_closed_after_opened_check',
  'AttendanceShift_lifecycle_check',
  'AttendanceShift_phase_check',
  'AttendanceShift_metadata_object_check',
  'AttendanceEntry_coordinate_pair_check',
  'AttendanceEntry_latitude_range_check',
  'AttendanceEntry_longitude_range_check',
  'AttendanceEntry_accuracy_range_check',
  'AttendanceEntry_distance_nonnegative_check',
  'AttendanceEntry_geofence_radius_positive_check',
  'AttendanceEntry_sequence_positive_check',
  'AttendanceEntry_shift_sequence_pair_check',
  'AttendanceEntry_non_checkin_requires_shift_check',
  'AttendanceEntry_idempotency_not_blank_check',
  'AttendanceEntry_request_fingerprint_check',
  'AttendanceEntry_privacy_notice_not_blank_check',
  'AttendanceEntry_evidence_container_check',
  'AttendanceEntry_event_type_required_check',
  'AttendanceEntry_verification_status_required_check',
  'AttendanceEntry_occurred_at_required_check',
  'AttendanceEntry_idempotency_required_check',
  'AttendanceShift_projectId_fkey',
  'AttendanceShift_worker_scope_fkey',
  'AttendanceEntry_worker_scope_fkey',
  'AttendanceEntry_shift_scope_fkey',
]);
const REQUIRED_INDEXES = Object.freeze([
  'Worker_projectId_id_key',
  'AttendanceEntry_idempotencyKey_key',
  'AttendanceShift_one_open_per_worker_idx',
  'AttendanceEntry_shift_sequence_key',
  'AttendanceEntry_one_check_in_per_shift_idx',
  'AttendanceEntry_one_check_out_per_shift_idx',
  'AttendanceShift_project_date_status_idx',
  'AttendanceShift_worker_opened_idx',
  'AttendanceEntry_project_worker_occurred_idx',
  'AttendanceEntry_one_pending_geo_per_worker_idx',
]);
const REQUIRED_TRIGGERS = Object.freeze([
  'AttendanceEntry_legacy_verification_insert_trg',
  'AttendanceEntry_legacy_verification_update_trg',
]);

function migrationDatabaseUrl() {
  const value = String(process.env[DATABASE_ENV] || '').trim();
  assert.ok(
    value,
    `${DATABASE_ENV} is required; generic DATABASE_URL values are deliberately ignored.`,
  );
  const parsed = new URL(value);
  assert.ok(
    ['postgres:', 'postgresql:'].includes(parsed.protocol),
    `${DATABASE_ENV} must use PostgreSQL.`,
  );
  return value;
}

function assertSameMembers(actual, expected, message) {
  assert.deepEqual([...actual].sort(), [...expected].sort(), message);
}

function definitionByName(rows, name, field = 'definition') {
  const row = rows.find((candidate) => candidate.name === name);
  assert.ok(row, `${name} must exist.`);
  return String(row[field] || '');
}

function assertDefinition(rows, name, pattern, field = 'definition') {
  assert.match(
    definitionByName(rows, name, field),
    pattern,
    `${name} has an unexpected PostgreSQL definition.`,
  );
}

const pool = new Pool({
  connectionString: migrationDatabaseUrl(),
  max: 1,
  application_name: 'obrasaas-attendance-migration-verifier',
});
const client = await pool.connect();

try {
  const schemaResult = await client.query(`
    SELECT current_schema() AS "schemaName",
           current_database() AS "databaseName",
           current_setting('server_version_num')::integer AS "serverVersion"
  `);
  const [schema] = schemaResult.rows;
  assert.equal(schema.schemaName, 'public', 'The ledger must be installed in public.');
  assert.ok(schema.databaseName, 'The PostgreSQL database must be identifiable.');
  assert.ok(schema.serverVersion >= 140000, 'PostgreSQL 14 or newer is required.');

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
    'Every attendance expand/backfill/contract migration must be applied successfully.',
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
      `${typeName} must retain its ordered contract.`,
    );
  }

  const columnsResult = await client.query(`
    SELECT table_name AS "tableName",
           column_name AS "columnName",
           is_nullable AS "isNullable",
           column_default AS "columnDefault",
           udt_name AS "udtName",
           character_maximum_length AS "characterMaximumLength",
           numeric_precision AS "numericPrecision",
           numeric_scale AS "numericScale"
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ANY($1::text[])
  `, [['AttendanceEntry', 'AttendanceShift']]);
  const columns = columnsResult.rows;
  assertSameMembers(
    columns
      .filter((row) => row.tableName === 'AttendanceEntry')
      .map((row) => row.columnName)
      .filter((column) => REQUIRED_ENTRY_COLUMNS.includes(column)),
    REQUIRED_ENTRY_COLUMNS,
    'AttendanceEntry must expose every expanded ledger column.',
  );
  assertSameMembers(
    columns
      .filter((row) => row.tableName === 'AttendanceShift')
      .map((row) => row.columnName),
    REQUIRED_SHIFT_COLUMNS,
    'AttendanceShift must expose its complete aggregate contract.',
  );

  const entryColumn = (name) => columns.find(
    (row) => row.tableName === 'AttendanceEntry' && row.columnName === name,
  );
  for (const name of ['eventType', 'verificationStatus', 'occurredAt', 'idempotencyKey']) {
    assert.equal(entryColumn(name)?.isNullable, 'NO', `${name} must be NOT NULL.`);
  }
  assert.equal(
    entryColumn('sourceOccurredAt')?.isNullable,
    'YES',
    'sourceOccurredAt must remain nullable for legacy rows.',
  );
  assert.equal(
    entryColumn('sourceOccurredAt')?.columnDefault,
    null,
    'sourceOccurredAt must not invent a default source clock.',
  );
  assert.equal(entryColumn('idempotencyKey')?.udtName, 'varchar');
  assert.equal(entryColumn('idempotencyKey')?.characterMaximumLength, 190);
  assert.match(entryColumn('idempotencyKey')?.columnDefault || '', /gen_random_uuid/i);
  assert.equal(entryColumn('requestFingerprint')?.udtName, 'bpchar');
  assert.equal(entryColumn('requestFingerprint')?.characterMaximumLength, 64);
  assert.equal(entryColumn('accuracyMeters')?.numericPrecision, 9);
  assert.equal(entryColumn('accuracyMeters')?.numericScale, 2);
  assert.match(entryColumn('eventType')?.columnDefault || '', /CHECK_IN/i);
  assert.match(entryColumn('verificationStatus')?.columnDefault || '', /LEGACY/i);
  assert.match(entryColumn('occurredAt')?.columnDefault || '', /CURRENT_TIMESTAMP/i);

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
  `, [REQUIRED_CONSTRAINTS]);
  const constraints = constraintsResult.rows;
  assertSameMembers(
    constraints.map((row) => row.name),
    REQUIRED_CONSTRAINTS,
    'Every attendance ledger constraint must exist.',
  );
  assert.equal(
    constraints.every((row) => row.isValidated === true),
    true,
    'Every attendance ledger constraint must be validated.',
  );
  assertDefinition(constraints, 'Worker_projectId_id_key', /UNIQUE.*projectId.*id/i);
  assertDefinition(
    constraints,
    'AttendanceEntry_worker_scope_fkey',
    /FOREIGN KEY.*projectId.*workerId.*REFERENCES.*Worker.*projectId.*id.*ON UPDATE CASCADE ON DELETE CASCADE/i,
  );
  assertDefinition(
    constraints,
    'AttendanceEntry_shift_scope_fkey',
    /FOREIGN KEY.*shiftId.*projectId.*workerId.*REFERENCES.*AttendanceShift.*id.*projectId.*workerId.*ON UPDATE CASCADE/i,
  );
  assertDefinition(
    constraints,
    'AttendanceShift_lifecycle_check',
    /CHECK.*OPEN.*CLOSED.*LEGACY_INCOMPLETE.*VOIDED/i,
  );
  assertDefinition(
    constraints,
    'AttendanceEntry_shift_sequence_pair_check',
    /CHECK.*shiftId.*sequence/i,
  );
  assertDefinition(
    constraints,
    'AttendanceEntry_request_fingerprint_check',
    /CHECK.*requestFingerprint.*0-9a-f.*64/i,
  );

  const indexesResult = await client.query(`
    SELECT index_class.relname::text AS "name",
           index_state.indisunique AS "isUnique",
           index_state.indisvalid AS "isValid",
           index_state.indisready AS "isReady",
           pg_get_expr(index_state.indpred, index_state.indrelid) AS "predicate",
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
    'Every attendance ledger index must exist.',
  );
  assert.equal(
    indexes.every((row) => row.isValid === true && row.isReady === true),
    true,
    'Every attendance ledger index must be valid and ready.',
  );
  for (const name of [
    'Worker_projectId_id_key',
    'AttendanceEntry_idempotencyKey_key',
    'AttendanceShift_one_open_per_worker_idx',
    'AttendanceEntry_shift_sequence_key',
    'AttendanceEntry_one_check_in_per_shift_idx',
    'AttendanceEntry_one_check_out_per_shift_idx',
    'AttendanceEntry_one_pending_geo_per_worker_idx',
  ]) {
    assert.equal(
      indexes.find((row) => row.name === name)?.isUnique,
      true,
      `${name} must remain unique.`,
    );
  }
  assertDefinition(
    indexes,
    'AttendanceShift_one_open_per_worker_idx',
    /UNIQUE INDEX.*AttendanceShift.*projectId.*workerId.*WHERE.*status.*OPEN/i,
  );
  assertDefinition(
    indexes,
    'AttendanceEntry_one_check_in_per_shift_idx',
    /UNIQUE INDEX.*AttendanceEntry.*shiftId.*WHERE.*eventType.*CHECK_IN.*verificationStatus.*VOIDED/i,
  );
  assertDefinition(
    indexes,
    'AttendanceEntry_one_check_out_per_shift_idx',
    /UNIQUE INDEX.*AttendanceEntry.*shiftId.*WHERE.*eventType.*CHECK_OUT.*verificationStatus.*VOIDED/i,
  );
  assertDefinition(
    indexes,
    'AttendanceEntry_project_worker_occurred_idx',
    /INDEX.*AttendanceEntry.*projectId.*workerId.*occurredAt/i,
  );
  assert.match(
    indexes.find((row) => row.name === 'AttendanceEntry_one_pending_geo_per_worker_idx')
      ?.predicate || '',
    /status.*PENDING_GEO/i,
  );

  const triggersResult = await client.query(`
    SELECT trigger_state.tgname::text AS "name",
           trigger_state.tgenabled::text AS "enabled",
           pg_get_triggerdef(trigger_state.oid, TRUE) AS "definition"
    FROM pg_trigger AS trigger_state
    INNER JOIN pg_class AS source_table ON source_table.oid = trigger_state.tgrelid
    INNER JOIN pg_namespace AS source_schema ON source_schema.oid = source_table.relnamespace
    WHERE source_schema.nspname = 'public'
      AND source_table.relname = 'AttendanceEntry'
      AND NOT trigger_state.tgisinternal
      AND trigger_state.tgname = ANY($1::text[])
  `, [REQUIRED_TRIGGERS]);
  const triggers = triggersResult.rows;
  assertSameMembers(
    triggers.map((row) => row.name),
    REQUIRED_TRIGGERS,
    'Both rolling-deployment compatibility triggers must exist.',
  );
  assert.equal(
    triggers.every((row) => row.enabled === 'O'),
    true,
    'Both rolling-deployment compatibility triggers must be enabled.',
  );
  assertDefinition(
    triggers,
    'AttendanceEntry_legacy_verification_insert_trg',
    /BEFORE INSERT ON "AttendanceEntry".*obrasaas_sync_legacy_attendance_ledger/i,
  );
  assertDefinition(
    triggers,
    'AttendanceEntry_legacy_verification_update_trg',
    /BEFORE UPDATE OF status ON "AttendanceEntry".*obrasaas_sync_legacy_attendance_ledger/i,
  );

  const functionResult = await client.query(`
    SELECT pg_get_functiondef(procedure_state.oid) AS "definition"
    FROM pg_proc AS procedure_state
    INNER JOIN pg_namespace AS procedure_schema
      ON procedure_schema.oid = procedure_state.pronamespace
    WHERE procedure_schema.nspname = 'public'
      AND procedure_state.proname = 'obrasaas_sync_legacy_attendance_ledger'
  `);
  assert.equal(functionResult.rows.length, 1, 'The rolling bridge function must exist once.');
  const bridgeDefinition = functionResult.rows[0].definition;
  assert.match(bridgeDefinition, /ABSENT[\s\S]*LEGACY/i);
  assert.match(bridgeDefinition, /rollingCompatibility/i);
  assert.match(bridgeDefinition, /'OPEN'::"AttendanceShiftStatus"/i);
  assert.match(bridgeDefinition, /FOR UPDATE/i);
  assert.match(bridgeDefinition, /Worker already has an open attendance shift/i);

  const integrityResult = await client.query(`
    SELECT
      (
        SELECT COUNT(*)::integer
        FROM "AttendanceEntry" AS event
        INNER JOIN "Worker" AS worker ON worker."id" = event."workerId"
        WHERE worker."projectId" IS DISTINCT FROM event."projectId"
      ) AS "crossProjectEvents",
      (
        SELECT COUNT(*)::integer
        FROM "AttendanceShift" AS shift
        INNER JOIN "Worker" AS worker ON worker."id" = shift."workerId"
        WHERE worker."projectId" IS DISTINCT FROM shift."projectId"
      ) AS "crossProjectShifts",
      (
        SELECT COUNT(*)::integer
        FROM "AttendanceEntry" AS event
        INNER JOIN "AttendanceShift" AS shift ON shift."id" = event."shiftId"
        WHERE shift."projectId" IS DISTINCT FROM event."projectId"
           OR shift."workerId" IS DISTINCT FROM event."workerId"
      ) AS "crossScopeShiftEvents",
      (
        SELECT COUNT(*)::integer
        FROM "AttendanceEntry"
        WHERE char_length(btrim("idempotencyKey")) = 0
      ) AS "blankIdempotencyKeys",
      (
        SELECT COUNT(*)::integer
        FROM "AttendanceEntry"
        WHERE "idempotencyKey" LIKE 'legacy:%'
          AND (
            "eventType" IS DISTINCT FROM 'CHECK_IN'::"AttendanceEventType"
            OR "occurredAt" IS DISTINCT FROM "checkedInAt"
            OR "sourceOccurredAt" IS DISTINCT FROM NULL
            OR "verificationStatus" IS DISTINCT FROM CASE "status"
              WHEN 'PENDING_GEO'::"AttendanceStatus"
                THEN 'PENDING'::"AttendanceVerificationStatus"
              WHEN 'PRESENT'::"AttendanceStatus"
                THEN 'VERIFIED'::"AttendanceVerificationStatus"
              WHEN 'OUTSIDE_GEOFENCE'::"AttendanceStatus"
                THEN 'REVIEW_REQUIRED'::"AttendanceVerificationStatus"
              WHEN 'EXCUSED'::"AttendanceStatus"
                THEN 'NOT_REQUIRED'::"AttendanceVerificationStatus"
              WHEN 'ABSENT'::"AttendanceStatus"
                THEN 'LEGACY'::"AttendanceVerificationStatus"
              WHEN 'EXPIRED'::"AttendanceStatus"
                THEN 'EXPIRED'::"AttendanceVerificationStatus"
              ELSE 'LEGACY'::"AttendanceVerificationStatus"
            END
          )
      ) AS "invalidLegacyMappings",
      (
        SELECT COUNT(*)::integer
        FROM "AttendanceEntry"
        WHERE "idempotencyKey" LIKE 'legacy:%'
          AND "status" IN (
            'PRESENT'::"AttendanceStatus",
            'OUTSIDE_GEOFENCE'::"AttendanceStatus"
          )
          AND (
            "shiftId" IS NOT DISTINCT FROM NULL
            OR "sequence" IS DISTINCT FROM 1
          )
      ) AS "unshiftedAcceptedLegacyEvents",
      (
        SELECT COUNT(*)::integer
        FROM "AttendanceEntry"
        WHERE "idempotencyKey" LIKE 'legacy:%'
          AND "status" NOT IN (
            'PRESENT'::"AttendanceStatus",
            'OUTSIDE_GEOFENCE'::"AttendanceStatus"
          )
          AND (
            "shiftId" IS DISTINCT FROM NULL
            OR "sequence" IS DISTINCT FROM NULL
          )
      ) AS "inventedLegacyShifts",
      (
        SELECT COUNT(*)::integer
        FROM "AttendanceEntry"
        WHERE "idempotencyKey" LIKE 'legacy:%'
          AND "sourceOccurredAt" IS DISTINCT FROM NULL
      ) AS "inventedLegacySourceTimes",
      (
        SELECT COUNT(*)::integer
        FROM "AttendanceEntry"
        WHERE "idempotencyKey" LIKE 'legacy:%'
          AND "status" = 'ABSENT'::"AttendanceStatus"
          AND "verificationStatus" IS DISTINCT FROM 'LEGACY'::"AttendanceVerificationStatus"
      ) AS "remappedLegacyAbsences",
      (
        SELECT COUNT(*)::integer
        FROM "AttendanceShift"
        WHERE metadata->>'migration' = $1
          AND (
            "status" IS DISTINCT FROM 'LEGACY_INCOMPLETE'::"AttendanceShiftStatus"
            OR "closedAt" IS DISTINCT FROM NULL
          )
      ) AS "inventedLegacyClosures",
      (
        SELECT COUNT(*)::integer
        FROM "AttendanceShift"
        WHERE metadata->>'migration' = $2
          AND metadata->>'rollingCompatibility' = 'true'
          AND (
            "status" IS DISTINCT FROM 'OPEN'::"AttendanceShiftStatus"
            OR "closedAt" IS DISTINCT FROM NULL
          )
      ) AS "invalidCompatibilityBridges",
      (
        SELECT COUNT(*)::integer
        FROM (
          SELECT "projectId", "workerId"
          FROM "AttendanceShift"
          WHERE "status" = 'OPEN'::"AttendanceShiftStatus"
          GROUP BY "projectId", "workerId"
          HAVING COUNT(*) > 1
        ) AS duplicate_open_shift
      ) AS "workersWithMultipleOpenShifts"
  `, [BACKFILL_MIGRATION, EXPAND_MIGRATION]);
  const [integrity] = integrityResult.rows;
  assert.deepEqual(integrity, {
    crossProjectEvents: 0,
    crossProjectShifts: 0,
    crossScopeShiftEvents: 0,
    blankIdempotencyKeys: 0,
    invalidLegacyMappings: 0,
    unshiftedAcceptedLegacyEvents: 0,
    inventedLegacyShifts: 0,
    inventedLegacySourceTimes: 0,
    remappedLegacyAbsences: 0,
    inventedLegacyClosures: 0,
    invalidCompatibilityBridges: 0,
    workersWithMultipleOpenShifts: 0,
  });

  const fixtureResult = await client.query(`
    SELECT "id",
           "status"::text AS "status",
           "eventType"::text AS "eventType",
           "verificationStatus"::text AS "verificationStatus",
           "shiftId",
           "sequence",
           "sourceOccurredAt" IS NULL AS "sourceTimeIsNull",
           "occurredAt" IS NOT DISTINCT FROM "checkedInAt" AS "serverTimePreserved"
    FROM "AttendanceEntry"
    WHERE "id" = ANY($1::text[])
    ORDER BY "id"
  `, [[
    'attendance-ledger-fixture-absent',
    'attendance-ledger-fixture-excused',
    'attendance-ledger-fixture-outside',
    'attendance-ledger-fixture-pending',
    'attendance-ledger-fixture-present',
  ]]);
  const expectedFixtures = [
    {
      id: 'attendance-ledger-fixture-absent',
      status: 'ABSENT',
      eventType: 'CHECK_IN',
      verificationStatus: 'LEGACY',
      shiftId: null,
      sequence: null,
      sourceTimeIsNull: true,
      serverTimePreserved: true,
    },
    {
      id: 'attendance-ledger-fixture-excused',
      status: 'EXCUSED',
      eventType: 'CHECK_IN',
      verificationStatus: 'NOT_REQUIRED',
      shiftId: null,
      sequence: null,
      sourceTimeIsNull: true,
      serverTimePreserved: true,
    },
    {
      id: 'attendance-ledger-fixture-outside',
      status: 'OUTSIDE_GEOFENCE',
      eventType: 'CHECK_IN',
      verificationStatus: 'REVIEW_REQUIRED',
      shiftId: 'legacy-shift:attendance-ledger-fixture-outside',
      sequence: 1,
      sourceTimeIsNull: true,
      serverTimePreserved: true,
    },
    {
      id: 'attendance-ledger-fixture-pending',
      status: 'PENDING_GEO',
      eventType: 'CHECK_IN',
      verificationStatus: 'PENDING',
      shiftId: null,
      sequence: null,
      sourceTimeIsNull: true,
      serverTimePreserved: true,
    },
    {
      id: 'attendance-ledger-fixture-present',
      status: 'PRESENT',
      eventType: 'CHECK_IN',
      verificationStatus: 'VERIFIED',
      shiftId: 'legacy-shift:attendance-ledger-fixture-present',
      sequence: 1,
      sourceTimeIsNull: true,
      serverTimePreserved: true,
    },
  ];
  if (fixtureResult.rows.length > 0) {
    assert.deepEqual(
      fixtureResult.rows,
      expectedFixtures,
      'When CI migration fixtures are present, all five must preserve their legacy meaning.',
    );
  }

  let rollingFixtureVerified = false;
  if (fixtureResult.rows.length > 0) {
    await client.query('BEGIN');
    try {
      const oldShapeInsert = await client.query(`
        INSERT INTO "AttendanceEntry" (
          "id", "projectId", "workerId", "status", "source", "checkedInAt", "createdAt"
        ) VALUES (
          'attendance-ledger-fixture-post-contract',
          'attendance-ledger-fixture-project',
          'attendance-ledger-fixture-worker-absent',
          'PRESENT'::"AttendanceStatus",
          'rolling-fixture',
          '2026-07-23T11:00:00.000Z',
          '2026-07-23T11:00:00.000Z'
        )
        RETURNING
          "eventType"::text AS "eventType",
          "verificationStatus"::text AS "verificationStatus",
          "occurredAt" IS NOT DISTINCT FROM "checkedInAt" AS "serverTimePreserved",
          "sourceOccurredAt" IS NULL AS "sourceTimeIsNull",
          "idempotencyKey",
          "shiftId",
          "sequence"
      `);
      assert.deepEqual(oldShapeInsert.rows[0], {
        eventType: 'CHECK_IN',
        verificationStatus: 'VERIFIED',
        serverTimePreserved: true,
        sourceTimeIsNull: true,
        idempotencyKey: 'legacy:attendance-ledger-fixture-post-contract',
        shiftId: 'legacy-bridge:attendance-ledger-fixture-post-contract',
        sequence: 1,
      });

      const bridge = await client.query(`
        SELECT "status"::text AS "status",
               "closedAt" IS NULL AS "remainsOpen",
               metadata->>'rollingCompatibility' AS "rollingCompatibility"
        FROM "AttendanceShift"
        WHERE "id" = 'legacy-bridge:attendance-ledger-fixture-post-contract'
      `);
      assert.deepEqual(bridge.rows, [{
        status: 'OPEN',
        remainsOpen: true,
        rollingCompatibility: 'true',
      }]);

      await client.query('SAVEPOINT second_legacy_open');
      await assert.rejects(
        client.query(`
          INSERT INTO "AttendanceEntry" (
            "id", "projectId", "workerId", "status", "source", "checkedInAt", "createdAt"
          ) VALUES (
            'attendance-ledger-fixture-post-contract-second',
            'attendance-ledger-fixture-project',
            'attendance-ledger-fixture-worker-absent',
            'PRESENT'::"AttendanceStatus",
            'rolling-fixture',
            '2026-07-23T12:00:00.000Z',
            '2026-07-23T12:00:00.000Z'
          )
        `),
        (error) => error?.code === '23505'
          && error?.constraint === 'AttendanceShift_one_open_per_worker_idx',
      );
      await client.query('ROLLBACK TO SAVEPOINT second_legacy_open');
      rollingFixtureVerified = true;
    } finally {
      await client.query('ROLLBACK');
    }
    assert.equal(
      rollingFixtureVerified,
      true,
      'The post-contract rolling compatibility fixture must be verified in CI.',
    );
  }

  console.log(JSON.stringify({
    database: schema.databaseName,
    schema: schema.schemaName,
    migrations: REQUIRED_MIGRATIONS,
    constraints: constraints.length,
    indexes: indexes.length,
    triggers: triggers.length,
    fixtures: fixtureResult.rows.length,
    rollingFixtureVerified,
    integrity,
  }));
} finally {
  client.release();
  await pool.end();
}
