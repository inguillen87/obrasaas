import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import pg from 'pg';

const CONNECTION_ENV = 'PROGRESS_MEASUREMENTS_MIGRATION_DATABASE_URL';
const SCHEMA_ENV = 'PROGRESS_MEASUREMENTS_MIGRATION_SCHEMA';
const DISPOSABLE_ENV = 'PROGRESS_MEASUREMENTS_DISPOSABLE_CONCURRENCY';
const MIGRATION = '20260811170000_progress_measurements';
const SCHEMA_PATTERN = /^[A-Za-z_][A-Za-z0-9_$]{0,62}$/;
const migrationPath = new URL(
  '../prisma/migrations/20260811170000_progress_measurements/migration.sql',
  import.meta.url,
);
const SUBMIT_SQL = `SELECT * FROM obrasaas_progress_measurement_submit(
  $1, $2, $3, $4::date, $5::date, $6, $7::numeric, $8::numeric, $9, $10,
  $11::jsonb, $12, $13, $14, $15
)`;
const REVIEW_SQL = `SELECT * FROM obrasaas_progress_measurement_review(
  $1, $2, $3, $4::integer, $5, $6, $7, $8, $9
)`;
const LEDGER_TABLES = Object.freeze([
  'TaskProgressMeasurementHead',
  'TaskProgressMeasurement',
  'TaskProgressMeasurementEvidence',
  'TaskProgressMeasurementDecision',
  'TaskProgressMeasurementBalance',
]);

const args = process.argv.slice(2);
const helpRequested = args.includes('--help') || args.includes('-h');
if (!helpRequested) assert.deepEqual(args, [], `Unknown arguments: ${args.join(' ')}`);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function connectionConfiguration() {
  const value = String(process.env[CONNECTION_ENV] || '').trim();
  const schema = String(process.env[SCHEMA_ENV] || '').trim();
  invariant(value, `${CONNECTION_ENV} is required; DATABASE_URL is intentionally ignored.`);
  invariant(schema && SCHEMA_PATTERN.test(schema), `${SCHEMA_ENV} must be an explicit safe identifier.`);
  const parsed = new URL(value);
  invariant(['postgres:', 'postgresql:'].includes(parsed.protocol), `${CONNECTION_ENV} must use PostgreSQL.`);
  const declaredSchemas = parsed.searchParams.getAll('schema');
  invariant(
    declaredSchemas.length === 0 || declaredSchemas.every((entry) => entry === schema),
    `${SCHEMA_ENV} conflicts with ${CONNECTION_ENV}.`,
  );
  parsed.searchParams.delete('schema');
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  const local = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname);
  if (!local && hostname.endsWith('.neon.tech')) parsed.searchParams.set('sslmode', 'verify-full');
  else if (!local) {
    invariant(
      parsed.searchParams.get('sslmode') === 'verify-full',
      `${CONNECTION_ENV} requires sslmode=verify-full remotely.`,
    );
  }
  const disposableValue = String(process.env[DISPOSABLE_ENV] || '0').trim();
  invariant(disposableValue === '0' || disposableValue === '1', `${DISPOSABLE_ENV} must be exactly 0 or 1.`);
  const disposableConcurrency = disposableValue === '1';
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (disposableConcurrency) {
    invariant(
      local && databaseName === 'obrasaas_ci' && schema === 'public',
      `${DISPOSABLE_ENV}=1 is restricted to local obrasaas_ci/public.`,
    );
  }
  return { connectionString: parsed.toString(), disposableConcurrency, local, schema };
}

async function assertMigration(client, schema, local) {
  const ledger = await client.query('SELECT to_regclass($1) AS name', [`${schema}._prisma_migrations`]);
  if (!ledger.rows[0]?.name) {
    invariant(local, 'Remote verification requires the Prisma migration ledger.');
    return;
  }
  const result = await client.query(
    `SELECT "checksum", "finished_at", "rolled_back_at"
       FROM ${quoteIdentifier(schema)}."_prisma_migrations"
      WHERE "migration_name" = $1`,
    [MIGRATION],
  );
  invariant(result.rows.length === 1, `${MIGRATION} is absent or applied more than once.`);
  invariant(result.rows[0].finished_at && !result.rows[0].rolled_back_at, `${MIGRATION} is not applied.`);
  const source = await readFile(migrationPath, 'utf8');
  invariant(
    result.rows[0].checksum === sha256(source),
    `${MIGRATION} checksum differs from the deployed Prisma ledger.`,
  );
}

async function assertStructure(client, schema) {
  const tables = await client.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = $1 AND table_name = ANY($2::text[])`,
    [schema, LEDGER_TABLES],
  );
  invariant(tables.rows.length === LEDGER_TABLES.length, 'Progress measurement tables are incomplete.');

  const enumRows = await client.query(
    `SELECT t.typname, e.enumlabel, e.enumsortorder
       FROM pg_type t
       JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typnamespace = $1::regnamespace
        AND t.typname = ANY($2::text[])
      ORDER BY t.typname, e.enumsortorder`,
    [schema, [
      'ProgressMeasurementUnitCode',
      'ProgressMeasurementMethod',
      'ProgressMeasurementDecisionType',
    ]],
  );
  const enumMap = new Map();
  for (const row of enumRows.rows) {
    if (!enumMap.has(row.typname)) enumMap.set(row.typname, []);
    enumMap.get(row.typname).push(row.enumlabel);
  }
  assert.deepEqual(enumMap.get('ProgressMeasurementUnitCode'), [
    'M', 'M2', 'M3', 'KG', 'T', 'L', 'UNIT', 'HOUR', 'DAY', 'LOT',
  ]);
  assert.deepEqual(enumMap.get('ProgressMeasurementMethod'), [
    'DIRECT_COUNT', 'DIMENSIONAL_CALCULATION', 'INSTRUMENT_READING', 'OTHER_REVIEWED',
  ]);
  assert.deepEqual(enumMap.get('ProgressMeasurementDecisionType'), ['APPROVED', 'REJECTED']);

  const columns = await client.query(
    `SELECT table_name, column_name, data_type, numeric_precision, numeric_scale,
            is_nullable, is_generated, generation_expression
       FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = ANY($2::text[])`,
    [schema, [...LEDGER_TABLES, 'Project']],
  );
  const keys = new Map(columns.rows.map((row) => [`${row.table_name}.${row.column_name}`, row]));
  for (const key of [
    'TaskProgressMeasurementHead.pendingMeasurementId',
    'Project.progressMeasurementEligible',
    'TaskProgressMeasurementHead.projectProgressMeasurementEligibleSnapshot',
    'TaskProgressMeasurementHead.taskIdentitySnapshot',
    'TaskProgressMeasurement.predecessorId',
    'TaskProgressMeasurement.periodQuantity',
    'TaskProgressMeasurement.cumulativeQuantity',
    'TaskProgressMeasurement.headRevisionAtSubmit',
    'TaskProgressMeasurement.approvedCumulativeQuantityAtSubmit',
    'TaskProgressMeasurement.balanceRevisionAtSubmit',
    'TaskProgressMeasurementEvidence.evidenceSnapshotHash',
    'TaskProgressMeasurementDecision.expectedHeadRevision',
    'TaskProgressMeasurementDecision.headRevisionAfterDecision',
    'TaskProgressMeasurementDecision.approvedCumulativeQuantityAfterDecision',
    'TaskProgressMeasurementDecision.balanceRevisionAfterDecision',
    'TaskProgressMeasurementBalance.approvedCumulativeQuantity',
  ]) invariant(keys.has(key), `Missing ${key}.`);
  const projectEligibility = keys.get('Project.progressMeasurementEligible');
  invariant(
    projectEligibility.is_nullable === 'NO'
      && projectEligibility.is_generated === 'ALWAYS'
      && String(projectEligibility.generation_expression).includes('status'),
    'Project progress eligibility must be a non-null generated closure fence.',
  );
  const pendingSnapshot = keys.get('TaskProgressMeasurementHead.projectProgressMeasurementEligibleSnapshot');
  invariant(
    pendingSnapshot.is_generated === 'ALWAYS'
      && String(pendingSnapshot.generation_expression).includes('pendingMeasurementId'),
    'Pending-head project eligibility snapshot must be generated.',
  );
  for (const key of [
    'TaskProgressMeasurement.baseQuantity',
    'TaskProgressMeasurement.periodQuantity',
    'TaskProgressMeasurement.cumulativeQuantity',
    'TaskProgressMeasurement.approvedCumulativeQuantityAtSubmit',
    'TaskProgressMeasurementDecision.approvedCumulativeQuantityAfterDecision',
    'TaskProgressMeasurementBalance.baseQuantity',
    'TaskProgressMeasurementBalance.approvedCumulativeQuantity',
  ]) {
    const column = keys.get(key);
    invariant(
      column?.numeric_precision === 18 && column?.numeric_scale === 4,
      `${key} must be Decimal(18,4).`,
    );
  }

  const constraints = await client.query(
    `SELECT conname, contype, pg_get_constraintdef(oid, true) AS definition
       FROM pg_constraint
      WHERE connamespace = $1::regnamespace
        AND conname = ANY($2::text[])`,
    [schema, [
      'TPM_head_scope_fkey',
      'TPM_predecessor_scope_fkey',
      'TPMHead_head_measurement_scope_fkey',
      'TPMHead_pending_measurement_scope_fkey',
      'TPMHead_approved_measurement_scope_fkey',
      'TPMBalance_last_head_scope_fkey',
      'TPMBalance_last_measurement_scope_fkey',
      'TPMHead_civil_fortnight_check',
      'TPM_quantity_check',
      'TPMHead_project_eligibility_fkey',
      'TPMHead_task_identity_fkey',
    ]],
  );
  invariant(constraints.rows.length === 11, 'Progress measurement constraints are incomplete.');
  for (const row of constraints.rows.filter((entry) =>
    entry.contype === 'f' && !entry.conname.endsWith('_eligibility_fkey') && !entry.conname.endsWith('_identity_fkey'))
  ) {
    const definition = String(row.definition);
    invariant(
      definition.includes('organizationId')
        && definition.includes('projectId')
        && definition.includes('taskId')
        && definition.includes('ON UPDATE CASCADE')
        && definition.includes('ON DELETE RESTRICT'),
      `${row.conname} must preserve tenant/project/task scope with restricted deletion.`,
    );
  }
  const projectFence = constraints.rows.find((row) => row.conname === 'TPMHead_project_eligibility_fkey');
  invariant(
    projectFence?.definition.includes('progressMeasurementEligible')
      && projectFence.definition.includes('ON UPDATE RESTRICT'),
    'Pending heads must structurally fence project closure.',
  );
  const taskFence = constraints.rows.find((row) => row.conname === 'TPMHead_task_identity_fkey');
  invariant(
    taskFence?.definition.includes('materialRequirementEligible')
      && taskFence.definition.includes('ON UPDATE RESTRICT'),
    'Every head must structurally fence canonical task identity.',
  );

  const indexes = await client.query(
    `SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname = $1 AND indexname = ANY($2::text[])`,
    [schema, ['TPMHead_scope_period_key', 'TPMHead_one_pending_per_task_key', 'TPM_org_operation_hash_key']],
  );
  invariant(indexes.rows.length === 3, 'Progress measurement uniqueness indexes are incomplete.');
  invariant(
    indexes.rows.find((row) => row.indexname === 'TPMHead_one_pending_per_task_key')?.indexdef
      .includes('pendingMeasurementId'),
    'One-pending-measurement partial unique index drifted.',
  );
}

async function assertFunctionsAndTriggers(client, schema) {
  const functions = await client.query(
    `SELECT p.proname, p.pronargs,
            pg_get_function_identity_arguments(p.oid) AS arguments,
            pg_get_function_result(p.oid) AS result,
            pg_get_functiondef(p.oid) AS definition
       FROM pg_proc p
      WHERE p.pronamespace = $1::regnamespace
        AND p.proname = ANY($2::text[])`,
    [schema, [
      'obrasaas_progress_measurement_submit',
      'obrasaas_progress_measurement_review',
      'obrasaas_progress_measurement_result',
    ]],
  );
  invariant(functions.rows.length === 3, 'Progress measurement functions are incomplete.');
  const submit = functions.rows.find((row) => row.proname === 'obrasaas_progress_measurement_submit');
  const review = functions.rows.find((row) => row.proname === 'obrasaas_progress_measurement_review');
  invariant(submit?.pronargs === 15, 'Submit function must preserve the frozen 15-argument contract.');
  invariant(review?.pronargs === 9, 'Review function must preserve the frozen 9-argument contract.');
  invariant(
    submit.arguments.includes('p_evidence_ids_jsonb jsonb')
      && submit.arguments.includes('p_expected_head_measurement_id text'),
    'Submit identity arguments drifted.',
  );
  invariant(
    review.arguments.includes('p_expected_head_revision integer')
      && review.arguments.includes('p_actor_membership_id text'),
    'Review identity arguments drifted.',
  );
  for (const fn of [submit, review]) {
    invariant(String(fn.result).includes('TABLE('), `${fn.proname} must return the common row contract.`);
    invariant(!/UPDATE\s+"Task"|Certification|Payment/i.test(fn.definition), `${fn.proname} crossed a forbidden domain.`);
  }

  const triggers = await client.query(
    `SELECT c.relname AS table_name, t.tgname, t.tgenabled
       FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND NOT t.tgisinternal
        AND t.tgname = ANY($2::text[])`,
    [schema, [
      'TaskProgressMeasurement_append_only',
      'TaskProgressMeasurement_no_truncate',
      'TaskProgressMeasurementEvidence_append_only',
      'TaskProgressMeasurementEvidence_no_truncate',
      'TaskProgressMeasurementDecision_append_only',
      'TaskProgressMeasurementDecision_no_truncate',
      'TaskProgressMeasurementHead_projection_guard',
      'TaskProgressMeasurementHead_no_truncate',
      'TaskProgressMeasurementBalance_projection_guard',
      'TaskProgressMeasurementBalance_no_truncate',
      'Task_progress_measurement_identity_guard',
      'Project_progress_measurement_closure_guard',
    ]],
  );
  invariant(triggers.rows.length === 12, 'Progress measurement governance triggers are incomplete.');
  invariant(triggers.rows.every((row) => row.tgenabled === 'A'), 'Every governance trigger must be ENABLE ALWAYS.');
}

function fixture(prefix) {
  return {
    prefix,
    organizationId: `${prefix}_org`,
    projectId: `${prefix}_project`,
    taskId: `${prefix}_task`,
    invalidTaskId: `${prefix}_milestone`,
    makerUserId: `${prefix}_maker_user`,
    checkerUserId: `${prefix}_checker_user`,
    makerMembershipId: `${prefix}_maker_member`,
    checkerMembershipId: `${prefix}_checker_member`,
    evidenceId: `${prefix}_evidence`,
  };
}

async function seedFixture(client, item) {
  await client.query(
    `INSERT INTO "Organization" ("id", "name", "slug", "createdAt", "updatedAt")
     VALUES ($1, 'Progress verifier', $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [item.organizationId, `${item.prefix}-org`],
  );
  await client.query(
    `INSERT INTO "PlatformUser" (
       "id", "clerkUserId", "primaryEmail", "lastSeenAt", "createdAt", "updatedAt"
     ) VALUES
       ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
       ($4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      item.makerUserId, `${item.prefix}_maker_clerk`, `${item.prefix}_maker@example.invalid`,
      item.checkerUserId, `${item.prefix}_checker_clerk`, `${item.prefix}_checker@example.invalid`,
    ],
  );
  await client.query(
    `INSERT INTO "TenantMembership" (
       "id", "organizationId", "userId", "clerkRole", "tenantRole", "status", "createdAt", "updatedAt"
     ) VALUES
       ($1, $2, $3, 'org:member', 'SITE_MANAGER', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
       ($4, $2, $5, 'org:admin', 'DIRECTOR', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [item.makerMembershipId, item.organizationId, item.makerUserId, item.checkerMembershipId, item.checkerUserId],
  );
  await client.query(
    `INSERT INTO "Project" (
       "id", "organizationId", "name", "slug", "status", "createdAt", "updatedAt"
     ) VALUES ($1, $2, 'Progress verifier project', $3, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [item.projectId, item.organizationId, `${item.prefix}-project`],
  );
  await client.query(
    `INSERT INTO "Task" (
       "id", "projectId", "title", "type", "status", "progress", "revision", "metadata", "createdAt", "updatedAt"
     ) VALUES
       ($1, $2, 'Canonical measured task', 'TASK', 'IN_PROGRESS', 37, 4,
        '{"source":"canonical-task-v1"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
       ($3, $2, 'Legacy milestone', 'MILESTONE', 'IN_PROGRESS', 0, 0,
        '{"source":"legacy"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [item.taskId, item.projectId, item.invalidTaskId],
  );
  await client.query(
    `INSERT INTO "ProgressEvidence" (
       "id", "projectId", "taskId", "capturedAt", "media", "status", "revision", "createdAt", "updatedAt"
     ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, '{"kind":"PHOTO","url":"verifier"}'::jsonb,
       'APPROVED', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [item.evidenceId, item.projectId, item.taskId],
  );
}

function submitArgs(item, {
  periodStart = '2020-01-01',
  periodEnd = '2020-01-15',
  taskId = item.taskId,
  baseQuantity = '100.0000',
  periodQuantity = '30.0000',
  expectedHeadId = null,
  operation = `${item.prefix}_submit_01`,
  fingerprint = sha256(`${item.prefix}:submit:01`),
  actor = item.makerMembershipId,
  evidenceIds = [item.evidenceId],
} = {}) {
  return [
    item.organizationId, item.projectId, taskId, periodStart, periodEnd, 'M3',
    baseQuantity, periodQuantity, 'DIMENSIONAL_CALCULATION', 'Medición verificable en obra.',
    JSON.stringify(evidenceIds), expectedHeadId, operation, fingerprint, actor,
  ];
}

function reviewArgs(item, measurementId, expectedRevision, {
  decision = 'APPROVED',
  operation = `${item.prefix}_review_01`,
  fingerprint = sha256(`${item.prefix}:review:01`),
  actor = item.checkerMembershipId,
  reason = 'Control técnico y evidencia conformes.',
} = {}) {
  return [
    item.organizationId, item.projectId, measurementId, expectedRevision, decision,
    reason, operation, fingerprint, actor,
  ];
}

async function expectDatabaseError(client, marker, action) {
  await client.query('SAVEPOINT progress_measurement_case');
  try {
    await action();
  } catch (error) {
    await client.query('ROLLBACK TO SAVEPOINT progress_measurement_case');
    await client.query('RELEASE SAVEPOINT progress_measurement_case');
    invariant(String(error.message).includes(marker), `Expected ${marker}, received ${error.message}.`);
    return;
  }
  await client.query('ROLLBACK TO SAVEPOINT progress_measurement_case');
  await client.query('RELEASE SAVEPOINT progress_measurement_case');
  throw new Error(`Expected database rejection ${marker}.`);
}

async function assertRollbackOnlyJourney(client) {
  const item = fixture(`pmv_${randomUUID().replaceAll('-', '')}`);
  await seedFixture(client, item);
  const otherOrganizationId = `${item.prefix}_other_org`;
  const otherUserId = `${item.prefix}_other_user`;
  const otherMembershipId = `${item.prefix}_other_member`;
  await client.query(
    `INSERT INTO "Organization" ("id", "name", "slug", "createdAt", "updatedAt")
     VALUES ($1, 'Other progress tenant', $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [otherOrganizationId, `${item.prefix}-other-org`],
  );
  await client.query(
    `INSERT INTO "PlatformUser" ("id", "clerkUserId", "primaryEmail", "lastSeenAt", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [otherUserId, `${item.prefix}_other_clerk`, `${item.prefix}_other@example.invalid`],
  );
  await client.query(
    `INSERT INTO "TenantMembership" (
       "id", "organizationId", "userId", "clerkRole", "tenantRole", "status", "createdAt", "updatedAt"
     ) VALUES ($1, $2, $3, 'org:member', 'SITE_MANAGER', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [otherMembershipId, otherOrganizationId, otherUserId],
  );

  const firstArgs = submitArgs(item);
  const first = await client.query(SUBMIT_SQL, firstArgs);
  invariant(first.rows[0]?.status === 'PENDING', 'Submit must return PENDING.');
  invariant(first.rows[0]?.head_revision === 1, 'First submit must advance head CAS revision to one.');
  invariant(first.rows[0]?.balance_revision === 0, 'Unapproved submit must expose balance revision zero.');
  invariant(String(first.rows[0]?.approved_cumulative_quantity) === '0.0000', 'Unapproved balance must be zero.');
  const measurementId = first.rows[0].measurement_id;

  const replay = await client.query(SUBMIT_SQL, firstArgs);
  invariant(replay.rows[0]?.replayed === true, 'Exact submit replay was not recognized.');
  await expectDatabaseError(client, 'PROGRESS_MEASUREMENT_IDEMPOTENCY_CONFLICT', () =>
    client.query(SUBMIT_SQL, submitArgs(item, { periodQuantity: '31.0000' })),
  );
  await expectDatabaseError(client, 'PROGRESS_MEASUREMENT_ACTOR_FORBIDDEN', () =>
    client.query(REVIEW_SQL, reviewArgs(item, measurementId, 1, {
      actor: item.makerMembershipId,
      operation: `${item.prefix}_maker_review`,
      fingerprint: sha256(`${item.prefix}:maker-review`),
    })),
  );
  await expectDatabaseError(client, 'PROGRESS_MEASUREMENT_PROJECT_PENDING', () =>
    client.query(`UPDATE "Project" SET "status" = 'COMPLETED' WHERE "id" = $1`, [item.projectId]),
  );
  await expectDatabaseError(client, 'PROGRESS_MEASUREMENT_TASK_IDENTITY_IMMUTABLE', () =>
    client.query(`UPDATE "Task" SET "type" = 'MILESTONE' WHERE "id" = $1`, [item.taskId]),
  );
  await expectDatabaseError(client, 'TaskProgressMeasurement is append-only', () =>
    client.query(`UPDATE "TaskProgressMeasurement" SET "rationale" = 'tampered' WHERE "id" = $1`, [measurementId]),
  );
  await expectDatabaseError(client, 'direct progress measurement projection writes are forbidden', () =>
    client.query(`UPDATE "TaskProgressMeasurementHead" SET "revision" = "revision" + 1 WHERE "id" = $1`, [first.rows[0].head_id]),
  );

  const approved = await client.query(REVIEW_SQL, reviewArgs(item, measurementId, 1));
  invariant(approved.rows[0]?.status === 'APPROVED', 'Review approval did not become effective.');
  invariant(approved.rows[0]?.head_revision === 2, 'Approval must advance head CAS revision.');
  invariant(approved.rows[0]?.balance_revision === 1, 'First approval must create balance revision one.');
  invariant(String(approved.rows[0]?.approved_cumulative_quantity) === '30.0000', 'Approved balance drifted.');
  const reviewReplay = await client.query(REVIEW_SQL, reviewArgs(item, measurementId, 1));
  invariant(reviewReplay.rows[0]?.replayed === true, 'Exact review replay was not recognized.');

  const crossTenantArgs = submitArgs(item, {
    operation: `${item.prefix}_cross_tenant`,
    fingerprint: sha256(`${item.prefix}:cross-tenant`),
    actor: otherMembershipId,
  });
  crossTenantArgs[0] = otherOrganizationId;
  await expectDatabaseError(client, 'PROGRESS_MEASUREMENT_SCOPE_INVALID', () =>
    client.query(SUBMIT_SQL, crossTenantArgs),
  );

  await expectDatabaseError(client, 'PROGRESS_MEASUREMENT_OVER_BASELINE', () =>
    client.query(SUBMIT_SQL, submitArgs(item, {
      periodStart: '2020-01-16', periodEnd: '2020-01-31', periodQuantity: '80.0000',
      operation: `${item.prefix}_over_base`, fingerprint: sha256(`${item.prefix}:over-base`),
    })),
  );
  await expectDatabaseError(client, 'PROGRESS_MEASUREMENT_PERIOD_CONFLICT', () =>
    client.query(SUBMIT_SQL, submitArgs(item, {
      periodStart: '2019-12-16', periodEnd: '2019-12-31', periodQuantity: '1.0000',
      operation: `${item.prefix}_backdated`, fingerprint: sha256(`${item.prefix}:backdated`),
    })),
  );
  await expectDatabaseError(client, 'PROGRESS_MEASUREMENT_FUTURE_PERIOD', () =>
    client.query(SUBMIT_SQL, submitArgs(item, {
      periodStart: '2099-01-01', periodEnd: '2099-01-15', periodQuantity: '1.0000',
      operation: `${item.prefix}_future`, fingerprint: sha256(`${item.prefix}:future`),
    })),
  );
  await expectDatabaseError(client, 'PROGRESS_MEASUREMENT_TASK_TYPE_INVALID', () =>
    client.query(SUBMIT_SQL, submitArgs(item, {
      taskId: item.invalidTaskId,
      operation: `${item.prefix}_milestone`, fingerprint: sha256(`${item.prefix}:milestone`),
    })),
  );

  const correctionSubmit = await client.query(SUBMIT_SQL, submitArgs(item, {
    periodQuantity: '25.0000', expectedHeadId: measurementId,
    operation: `${item.prefix}_correction`, fingerprint: sha256(`${item.prefix}:correction`),
  }));
  const correctionId = correctionSubmit.rows[0].measurement_id;
  const correction = await client.query(REVIEW_SQL, reviewArgs(item, correctionId, 3, {
    operation: `${item.prefix}_correction_review`, fingerprint: sha256(`${item.prefix}:correction-review`),
  }));
  invariant(String(correction.rows[0]?.approved_cumulative_quantity) === '25.0000', 'Correction must replace the latest contribution.');
  const lateOriginalSubmit = await client.query(SUBMIT_SQL, firstArgs);
  invariant(
    lateOriginalSubmit.rows[0]?.replayed === true
      && lateOriginalSubmit.rows[0]?.status === 'PENDING'
      && lateOriginalSubmit.rows[0]?.head_revision === 1
      && lateOriginalSubmit.rows[0]?.balance_revision === 0
      && String(lateOriginalSubmit.rows[0]?.approved_cumulative_quantity) === '0.0000',
    'Late submit replay leaked the live decision/head/balance projection.',
  );
  const lateOriginalReview = await client.query(REVIEW_SQL, reviewArgs(item, measurementId, 1));
  invariant(
    lateOriginalReview.rows[0]?.replayed === true
      && lateOriginalReview.rows[0]?.status === 'APPROVED'
      && lateOriginalReview.rows[0]?.head_revision === 2
      && lateOriginalReview.rows[0]?.balance_revision === 1
      && String(lateOriginalReview.rows[0]?.approved_cumulative_quantity) === '30.0000',
    'Late review replay leaked the corrected live projection.',
  );

  const rejectedSubmit = await client.query(SUBMIT_SQL, submitArgs(item, {
    periodStart: '2020-01-16', periodEnd: '2020-01-31', periodQuantity: '5.0000',
    operation: `${item.prefix}_reject_submit`, fingerprint: sha256(`${item.prefix}:reject-submit`),
  }));
  const rejected = await client.query(REVIEW_SQL, reviewArgs(item, rejectedSubmit.rows[0].measurement_id, 1, {
    decision: 'REJECTED', operation: `${item.prefix}_reject_review`,
    fingerprint: sha256(`${item.prefix}:reject-review`), reason: 'Evidencia insuficiente para aprobar.',
  }));
  invariant(rejected.rows[0]?.status === 'REJECTED', 'Rejection status drifted.');
  invariant(String(rejected.rows[0]?.approved_cumulative_quantity) === '25.0000', 'Rejection mutated approved balance.');
  const lateCorrectionReview = await client.query(REVIEW_SQL, reviewArgs(item, correctionId, 3, {
    operation: `${item.prefix}_correction_review`, fingerprint: sha256(`${item.prefix}:correction-review`),
  }));
  invariant(
    lateCorrectionReview.rows[0]?.replayed === true
      && lateCorrectionReview.rows[0]?.head_revision === 4
      && lateCorrectionReview.rows[0]?.balance_revision === 2
      && String(lateCorrectionReview.rows[0]?.approved_cumulative_quantity) === '25.0000',
    'Late correction review replay leaked a later period state.',
  );

  const task = await client.query(`SELECT "progress" FROM "Task" WHERE "id" = $1`, [item.taskId]);
  invariant(task.rows[0]?.progress === 37, 'Governed measurement functions mutated Task.progress.');
  return item.prefix;
}

async function assertRolledBack(client, schema, prefix) {
  for (const table of [...LEDGER_TABLES, 'ProgressEvidence', 'Task', 'TenantMembership', 'PlatformUser', 'Project', 'Organization']) {
    const result = await client.query(
      `SELECT count(*)::integer AS count FROM ${quoteIdentifier(schema)}.${quoteIdentifier(table)} WHERE "id" LIKE $1`,
      [`${prefix}%`],
    );
    invariant(result.rows[0]?.count === 0, `Rollback left verifier rows in ${table}.`);
  }
}

async function connectDisposable(connectionString, schema, applicationName) {
  const client = new pg.Client({ connectionString, application_name: applicationName, statement_timeout: 30_000 });
  await client.connect();
  await client.query(`SET search_path TO ${quoteIdentifier(schema)}, pg_catalog`);
  return client;
}

async function cleanupDisposableFixture(connectionString, schema, item) {
  const client = await connectDisposable(connectionString, schema, 'obrasaas-progress-measurement-cleanup');
  const triggerMap = new Map([
    ['TaskProgressMeasurement', ['TaskProgressMeasurement_append_only', 'TaskProgressMeasurement_no_truncate']],
    ['TaskProgressMeasurementEvidence', ['TaskProgressMeasurementEvidence_append_only', 'TaskProgressMeasurementEvidence_no_truncate']],
    ['TaskProgressMeasurementDecision', ['TaskProgressMeasurementDecision_append_only', 'TaskProgressMeasurementDecision_no_truncate']],
    ['TaskProgressMeasurementHead', ['TaskProgressMeasurementHead_projection_guard', 'TaskProgressMeasurementHead_no_truncate']],
    ['TaskProgressMeasurementBalance', ['TaskProgressMeasurementBalance_projection_guard', 'TaskProgressMeasurementBalance_no_truncate']],
    ['Task', ['Task_progress_measurement_identity_guard']],
    ['Project', ['Project_progress_measurement_closure_guard']],
  ]);
  try {
    await client.query('BEGIN');
    for (const table of triggerMap.keys()) {
      await client.query(`ALTER TABLE ${quoteIdentifier(table)} DISABLE TRIGGER USER`);
    }
    await client.query(`DELETE FROM "TaskProgressMeasurementDecision" WHERE "organizationId" = $1`, [item.organizationId]);
    await client.query(`DELETE FROM "TaskProgressMeasurementEvidence" WHERE "organizationId" = $1`, [item.organizationId]);
    await client.query(`DELETE FROM "TaskProgressMeasurementBalance" WHERE "organizationId" = $1`, [item.organizationId]);
    await client.query(
      `UPDATE "TaskProgressMeasurementHead"
          SET "headMeasurementId" = NULL, "pendingMeasurementId" = NULL, "approvedMeasurementId" = NULL
        WHERE "organizationId" = $1`,
      [item.organizationId],
    );
    await client.query(`DELETE FROM "TaskProgressMeasurement" WHERE "organizationId" = $1`, [item.organizationId]);
    await client.query(`DELETE FROM "TaskProgressMeasurementHead" WHERE "organizationId" = $1`, [item.organizationId]);
    await client.query(`DELETE FROM "ProgressEvidence" WHERE "id" = $1`, [item.evidenceId]);
    await client.query(`DELETE FROM "Task" WHERE "id" IN ($1, $2)`, [item.taskId, item.invalidTaskId]);
    await client.query(`DELETE FROM "TenantMembership" WHERE "organizationId" = $1`, [item.organizationId]);
    await client.query(`DELETE FROM "PlatformUser" WHERE "id" IN ($1, $2)`, [item.makerUserId, item.checkerUserId]);
    await client.query(`DELETE FROM "Project" WHERE "id" = $1`, [item.projectId]);
    await client.query(`DELETE FROM "Organization" WHERE "id" = $1`, [item.organizationId]);
    for (const [table, triggerNames] of triggerMap) {
      for (const triggerName of triggerNames) {
        await client.query(
          `ALTER TABLE ${quoteIdentifier(table)} ENABLE ALWAYS TRIGGER ${quoteIdentifier(triggerName)}`,
        );
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

async function assertDisposableConcurrency(connectionString, schema) {
  // Different operation keys serialize on task scope: one proposal wins and
  // the loser must be a controlled head/pending conflict, never an arbitrary SQL failure.
  const item = fixture(`pmrace_${randomUUID().replaceAll('-', '')}`);
  const seed = await connectDisposable(connectionString, schema, 'obrasaas-progress-measurement-race-seed');
  try {
    await seed.query('BEGIN');
    await seedFixture(seed, item);
    await seed.query('COMMIT');
  } catch (error) {
    await seed.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await seed.end();
  }

  const first = await connectDisposable(connectionString, schema, 'obrasaas-progress-measurement-race-a');
  const second = await connectDisposable(connectionString, schema, 'obrasaas-progress-measurement-race-b');
  try {
    const results = await Promise.allSettled([
      first.query(SUBMIT_SQL, submitArgs(item, {
        operation: `${item.prefix}_race_a`, fingerprint: sha256(`${item.prefix}:race-a`),
      })),
      second.query(SUBMIT_SQL, submitArgs(item, {
        operation: `${item.prefix}_race_b`, fingerprint: sha256(`${item.prefix}:race-b`),
      })),
    ]);
    invariant(results.filter((result) => result.status === 'fulfilled').length === 1, 'Concurrent submit must have exactly one winner.');
    invariant(results.filter((result) => result.status === 'rejected').length === 1, 'Concurrent submit must reject exactly one contender.');
    const rejection = results.find((result) => result.status === 'rejected');
    invariant(
      /PROGRESS_MEASUREMENT_(?:HEAD_STALE|REVIEW_PENDING)/.test(String(rejection.reason?.message)),
      `Concurrent submit loser was not controlled: ${rejection.reason?.message}`,
    );
    const state = await first.query(
      `SELECT count(*)::integer AS measurement_count,
              count(*) FILTER (WHERE h."pendingMeasurementId" IS NOT NULL)::integer AS pending_count
         FROM "TaskProgressMeasurement" m
         JOIN "TaskProgressMeasurementHead" h ON h."id" = m."headId"
        WHERE m."organizationId" = $1`,
      [item.organizationId],
    );
    invariant(
      state.rows[0]?.measurement_count === 1 && state.rows[0]?.pending_count === 1,
      'Concurrent submit must commit exactly one pending proposal.',
    );
  } finally {
    await first.end().catch(() => undefined);
    await second.end().catch(() => undefined);
    await cleanupDisposableFixture(connectionString, schema, item);
  }

  const probe = await connectDisposable(connectionString, schema, 'obrasaas-progress-measurement-race-probe');
  try {
    await assertRolledBack(probe, schema, item.prefix);
  } finally {
    await probe.end();
  }

  // Identical operation keys serialize before scope locks and must converge to
  // one durable row plus one replay for both submit and review.
  const replayItem = fixture(`pmreplay_${randomUUID().replaceAll('-', '')}`);
  const replaySeed = await connectDisposable(connectionString, schema, 'obrasaas-progress-replay-seed');
  try {
    await replaySeed.query('BEGIN');
    await seedFixture(replaySeed, replayItem);
    await replaySeed.query('COMMIT');
  } catch (error) {
    await replaySeed.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await replaySeed.end();
  }
  const replayA = await connectDisposable(connectionString, schema, 'obrasaas-progress-replay-a');
  const replayB = await connectDisposable(connectionString, schema, 'obrasaas-progress-replay-b');
  try {
    const exactSubmitArgs = submitArgs(replayItem, {
      operation: `${replayItem.prefix}_same_submit`,
      fingerprint: sha256(`${replayItem.prefix}:same-submit`),
    });
    const submitResults = await Promise.all([
      replayA.query(SUBMIT_SQL, exactSubmitArgs),
      replayB.query(SUBMIT_SQL, exactSubmitArgs),
    ]);
    const submitRows = submitResults.map((result) => result.rows[0]);
    invariant(new Set(submitRows.map((row) => row.measurement_id)).size === 1, 'Concurrent exact submit created divergent measurements.');
    assert.deepEqual(submitRows.map((row) => row.replayed).sort(), [false, true]);
    const replayMeasurementId = submitRows[0].measurement_id;
    const exactReviewArgs = reviewArgs(replayItem, replayMeasurementId, 1, {
      operation: `${replayItem.prefix}_same_review`,
      fingerprint: sha256(`${replayItem.prefix}:same-review`),
    });
    const reviewResults = await Promise.all([
      replayA.query(REVIEW_SQL, exactReviewArgs),
      replayB.query(REVIEW_SQL, exactReviewArgs),
    ]);
    const reviewRows = reviewResults.map((result) => result.rows[0]);
    assert.deepEqual(reviewRows.map((row) => row.replayed).sort(), [false, true]);
    invariant(reviewRows.every((row) => row.status === 'APPROVED'), 'Concurrent exact review did not converge to approval.');
    const replayState = await replayA.query(
      `SELECT
         (SELECT count(*)::integer FROM "TaskProgressMeasurement" WHERE "organizationId" = $1) AS measurements,
         (SELECT count(*)::integer FROM "TaskProgressMeasurementDecision" WHERE "organizationId" = $1) AS decisions,
         (SELECT count(*)::integer FROM "TaskProgressMeasurementBalance" WHERE "organizationId" = $1) AS balances`,
      [replayItem.organizationId],
    );
    invariant(
      replayState.rows[0]?.measurements === 1
        && replayState.rows[0]?.decisions === 1
        && replayState.rows[0]?.balances === 1,
      'Concurrent exact operations must commit one proposal, decision and balance.',
    );
  } finally {
    await replayA.end().catch(() => undefined);
    await replayB.end().catch(() => undefined);
    await cleanupDisposableFixture(connectionString, schema, replayItem);
  }
  const replayProbe = await connectDisposable(connectionString, schema, 'obrasaas-progress-replay-probe');
  try {
    await assertRolledBack(replayProbe, schema, replayItem.prefix);
  } finally {
    await replayProbe.end();
  }

  const mutatedItem = fixture(`pmmutated_${randomUUID().replaceAll('-', '')}`);
  const mutatedSeed = await connectDisposable(connectionString, schema, 'obrasaas-progress-mutated-seed');
  try {
    await mutatedSeed.query('BEGIN');
    await seedFixture(mutatedSeed, mutatedItem);
    await mutatedSeed.query('COMMIT');
  } catch (error) {
    await mutatedSeed.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await mutatedSeed.end();
  }
  const mutatedA = await connectDisposable(connectionString, schema, 'obrasaas-progress-mutated-a');
  const mutatedB = await connectDisposable(connectionString, schema, 'obrasaas-progress-mutated-b');
  try {
    const operation = `${mutatedItem.prefix}_same_key`;
    const results = await Promise.allSettled([
      mutatedA.query(SUBMIT_SQL, submitArgs(mutatedItem, {
        operation,
        fingerprint: sha256(`${mutatedItem.prefix}:payload-a`),
        periodQuantity: '30.0000',
      })),
      mutatedB.query(SUBMIT_SQL, submitArgs(mutatedItem, {
        operation,
        fingerprint: sha256(`${mutatedItem.prefix}:payload-b`),
        periodQuantity: '31.0000',
      })),
    ]);
    invariant(results.filter((result) => result.status === 'fulfilled').length === 1, 'Mutated same-key submit must have one winner.');
    const rejection = results.find((result) => result.status === 'rejected');
    invariant(
      String(rejection?.reason?.message).includes('PROGRESS_MEASUREMENT_IDEMPOTENCY_CONFLICT'),
      `Mutated same-key loser was not an idempotency conflict: ${rejection?.reason?.message}`,
    );
    const state = await mutatedA.query(
      `SELECT count(*)::integer AS count FROM "TaskProgressMeasurement" WHERE "organizationId" = $1`,
      [mutatedItem.organizationId],
    );
    invariant(state.rows[0]?.count === 1, 'Mutated same-key race must commit exactly one proposal.');
  } finally {
    await mutatedA.end().catch(() => undefined);
    await mutatedB.end().catch(() => undefined);
    await cleanupDisposableFixture(connectionString, schema, mutatedItem);
  }
  const mutatedProbe = await connectDisposable(connectionString, schema, 'obrasaas-progress-mutated-probe');
  try {
    await assertRolledBack(mutatedProbe, schema, mutatedItem.prefix);
  } finally {
    await mutatedProbe.end();
  }

  for (const race of [
    {
      name: 'close-versus-submit',
      expectedError: /PROGRESS_MEASUREMENT_(?:PROJECT_PENDING|PROJECT_READ_ONLY)|TPMHead_project_eligibility_fkey/,
      mutate: (client, raceItem) => client.query(
        `UPDATE "Project" SET "status" = 'COMPLETED' WHERE "id" = $1`,
        [raceItem.projectId],
      ),
    },
    {
      name: 'task-identity-versus-submit',
      expectedError: /PROGRESS_MEASUREMENT_(?:TASK_IDENTITY_IMMUTABLE|TASK_TYPE_INVALID)|TPMHead_task_identity_fkey/,
      mutate: (client, raceItem) => client.query(
        `UPDATE "Task" SET "type" = 'MILESTONE' WHERE "id" = $1`,
        [raceItem.taskId],
      ),
    },
  ]) {
    const raceItem = fixture(`pmfence_${randomUUID().replaceAll('-', '')}`);
    const raceSeed = await connectDisposable(connectionString, schema, `obrasaas-${race.name}-seed`);
    try {
      await raceSeed.query('BEGIN');
      await seedFixture(raceSeed, raceItem);
      await raceSeed.query('COMMIT');
    } catch (error) {
      await raceSeed.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      await raceSeed.end();
    }
    const submitter = await connectDisposable(connectionString, schema, `obrasaas-${race.name}-submit`);
    const mutator = await connectDisposable(connectionString, schema, `obrasaas-${race.name}-mutate`);
    try {
      const results = await Promise.allSettled([
        submitter.query(SUBMIT_SQL, submitArgs(raceItem, {
          operation: `${raceItem.prefix}_submit`,
          fingerprint: sha256(`${raceItem.prefix}:submit`),
        })),
        race.mutate(mutator, raceItem),
      ]);
      invariant(
        results.filter((result) => result.status === 'fulfilled').length === 1,
        `${race.name} must have exactly one winner under the structural FK fence.`,
      );
      invariant(
        results.filter((result) => result.status === 'rejected').length === 1,
        `${race.name} must reject exactly one contender.`,
      );
      const rejection = results.find((result) => result.status === 'rejected');
      invariant(
        race.expectedError.test(String(rejection.reason?.message)),
        `${race.name} loser was not a controlled marker/FK: ${rejection.reason?.message}`,
      );
      const state = await submitter.query(
        `SELECT p."status"::text AS project_status, p."progressMeasurementEligible" AS project_eligible,
                t."type"::text AS task_type, t."materialRequirementEligible" AS task_eligible,
                (SELECT count(*)::integer FROM "TaskProgressMeasurement" m
                  WHERE m."organizationId" = $1) AS measurement_count,
                (SELECT count(*)::integer FROM "TaskProgressMeasurementHead" h
                  WHERE h."organizationId" = $1 AND h."pendingMeasurementId" IS NOT NULL) AS pending_count
           FROM "Project" p JOIN "Task" t ON t."projectId" = p."id"
          WHERE p."id" = $2 AND t."id" = $3`,
        [raceItem.organizationId, raceItem.projectId, raceItem.taskId],
      );
      const row = state.rows[0];
      if (results[0].status === 'fulfilled') {
        invariant(
          row?.measurement_count === 1 && row?.pending_count === 1
            && row?.project_eligible === true && row?.task_eligible === true,
          `${race.name} submit winner left an incoherent pending state.`,
        );
      } else {
        invariant(row?.measurement_count === 0 && row?.pending_count === 0, `${race.name} mutation winner left ledger rows.`);
        if (race.name === 'close-versus-submit') {
          invariant(row?.project_status === 'COMPLETED' && row?.project_eligible === false, 'Project closure winner did not persist coherently.');
        } else {
          invariant(row?.task_type === 'MILESTONE' && row?.task_eligible === false, 'Task identity winner did not persist coherently.');
        }
      }
    } finally {
      await submitter.end().catch(() => undefined);
      await mutator.end().catch(() => undefined);
      await cleanupDisposableFixture(connectionString, schema, raceItem);
    }
    const raceProbe = await connectDisposable(connectionString, schema, `obrasaas-${race.name}-probe`);
    try {
      await assertRolledBack(raceProbe, schema, raceItem.prefix);
    } finally {
      await raceProbe.end();
    }
  }
}

async function main() {
  if (helpRequested) {
    console.log(
      `${CONNECTION_ENV} and ${SCHEMA_ENV} verify ${MIGRATION}; DATABASE_URL is ignored. `
      + `${DISPOSABLE_ENV}=1 enables committed races only on local obrasaas_ci/public.`,
    );
    return;
  }
  const { connectionString, disposableConcurrency, local, schema } = connectionConfiguration();
  const client = new pg.Client({
    connectionString,
    application_name: 'obrasaas-progress-measurements-verifier',
    statement_timeout: 55_000,
    query_timeout: 60_000,
  });
  let connected = false;
  let transactionOpen = false;
  let prefix;
  try {
    try {
      await client.connect();
      connected = true;
    } catch {
      throw new Error('Unable to connect to the dedicated progress measurement verification database.');
    }
    await client.query('BEGIN');
    transactionOpen = true;
    const schemaExists = await client.query('SELECT to_regnamespace($1) IS NOT NULL AS exists', [schema]);
    invariant(schemaExists.rows[0]?.exists, `Configured PostgreSQL schema ${schema} does not exist.`);
    await client.query(`SET LOCAL search_path TO ${quoteIdentifier(schema)}, pg_catalog`);
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '55s'");
    await assertMigration(client, schema, local);
    await assertStructure(client, schema);
    await assertFunctionsAndTriggers(client, schema);
    prefix = await assertRollbackOnlyJourney(client);
    await client.query('ROLLBACK');
    transactionOpen = false;
    await assertRolledBack(client, schema, prefix);
    if (disposableConcurrency) await assertDisposableConcurrency(connectionString, schema);
    console.log(
      disposableConcurrency
        ? 'Verified S9.1 rollback-only ledger journeys, scope/immutability contracts, and disposable concurrent submit serialization with exact cleanup.'
        : 'Verified S9.1 rollback-only ledger journeys, tenant scope, maker/checker, idempotency, chronology, correction, over-base and immutable projections. Disposable races were not requested.',
    );
  } finally {
    if (transactionOpen) await client.query('ROLLBACK').catch(() => undefined);
    if (connected) await client.end();
  }
}

await main();
