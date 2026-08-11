import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import pg from "pg";

const CONNECTION_ENV = "PROGRESS_MEASUREMENT_CUTS_MIGRATION_DATABASE_URL";
const SCHEMA_ENV = "PROGRESS_MEASUREMENT_CUTS_MIGRATION_SCHEMA";
const DISPOSABLE_ENV = "PROGRESS_MEASUREMENT_CUTS_DISPOSABLE_CONCURRENCY";
const MIGRATION = "20260811180000_progress_measurement_cuts";
const SCHEMA_PATTERN = /^[A-Za-z_][A-Za-z0-9_$]{0,62}$/;
const migrationPath = new URL(
  "../prisma/migrations/20260811180000_progress_measurement_cuts/migration.sql",
  import.meta.url,
);
const SUBMIT_SQL = `SELECT * FROM obrasaas_progress_measurement_submit(
  $1,$2,$3,$4::date,$5::date,$6,$7::numeric,$8::numeric,$9,$10,$11::jsonb,$12,$13,$14,$15
)`;
const REVIEW_SQL = `SELECT * FROM obrasaas_progress_measurement_review(
  $1,$2,$3,$4::integer,$5,$6,$7,$8,$9
)`;
const READ_SQL = `SELECT * FROM obrasaas_progress_measurement_cut_read(
  $1,$2,$3::date,$4::date,$5
)`;
const SEAL_SQL = `SELECT * FROM obrasaas_progress_measurement_cut_seal(
  $1,$2,$3::date,$4::date,$5,$6,$7,$8,$9
)`;
const CUT_TABLES = Object.freeze([
  "ProjectProgressMeasurementCutHead",
  "ProjectProgressMeasurementCut",
  "ProjectProgressMeasurementCutLine",
]);

const args = process.argv.slice(2);
const helpRequested = args.includes("--help") || args.includes("-h");
if (!helpRequested) assert.deepEqual(args, [], `Unknown arguments: ${args.join(" ")}`);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function connectionConfiguration() {
  const value = String(process.env[CONNECTION_ENV] || "").trim();
  const schema = String(process.env[SCHEMA_ENV] || "").trim();
  invariant(value, `${CONNECTION_ENV} is required; DATABASE_URL is intentionally ignored.`);
  invariant(schema && SCHEMA_PATTERN.test(schema), `${SCHEMA_ENV} must be an explicit safe identifier.`);
  const parsed = new URL(value);
  invariant(["postgres:", "postgresql:"].includes(parsed.protocol), `${CONNECTION_ENV} must use PostgreSQL.`);
  const declaredSchemas = parsed.searchParams.getAll("schema");
  invariant(
    declaredSchemas.length === 0 || declaredSchemas.every((entry) => entry === schema),
    `${SCHEMA_ENV} conflicts with ${CONNECTION_ENV}.`,
  );
  parsed.searchParams.delete("schema");
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  const local = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(hostname);
  if (!local && hostname.endsWith(".neon.tech")) parsed.searchParams.set("sslmode", "verify-full");
  else if (!local) {
    invariant(
      parsed.searchParams.get("sslmode") === "verify-full",
      `${CONNECTION_ENV} requires sslmode=verify-full remotely.`,
    );
  }
  const disposableValue = String(process.env[DISPOSABLE_ENV] || "0").trim();
  invariant(disposableValue === "0" || disposableValue === "1", `${DISPOSABLE_ENV} must be exactly 0 or 1.`);
  const disposableConcurrency = disposableValue === "1";
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (disposableConcurrency) {
    invariant(
      local && databaseName === "obrasaas_ci" && schema === "public",
      `${DISPOSABLE_ENV}=1 is restricted to local obrasaas_ci/public.`,
    );
  }
  return { connectionString: parsed.toString(), disposableConcurrency, local, schema };
}

async function assertMigration(client, schema, local) {
  const ledger = await client.query("SELECT to_regclass($1) AS name", [`${schema}._prisma_migrations`]);
  if (!ledger.rows[0]?.name) {
    invariant(local, "Remote verification requires the Prisma migration ledger.");
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
  const source = await readFile(migrationPath, "utf8");
  invariant(result.rows[0].checksum === sha256(source), `${MIGRATION} checksum differs from the deployed ledger.`);
}

async function assertStructure(client, schema) {
  const tables = await client.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = $1 AND table_name = ANY($2::text[])`,
    [schema, CUT_TABLES],
  );
  invariant(tables.rows.length === CUT_TABLES.length, "S9.2 cut tables are incomplete.");

  const enums = await client.query(
    `SELECT e.enumlabel
       FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typnamespace = $1::regnamespace
        AND t.typname = 'ProgressMeasurementCutLineState'
      ORDER BY e.enumsortorder`,
    [schema],
  );
  assert.deepEqual(enums.rows.map((row) => row.enumlabel), ["MEASURED", "MISSING"]);

  const columns = await client.query(
    `SELECT table_name, column_name, data_type, is_nullable, numeric_precision, numeric_scale
       FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = ANY($2::text[])`,
    [schema, CUT_TABLES],
  );
  const map = new Map(columns.rows.map((row) => [`${row.table_name}.${row.column_name}`, row]));
  for (const required of [
    "ProjectProgressMeasurementCutHead.currentCutId",
    "ProjectProgressMeasurementCutHead.revision",
    "ProjectProgressMeasurementCut.candidateSha256",
    "ProjectProgressMeasurementCut.cutSha256",
    "ProjectProgressMeasurementCut.headRevisionAtSeal",
    "ProjectProgressMeasurementCutLine.cutHeadId",
    "ProjectProgressMeasurementCutLine.periodStart",
    "ProjectProgressMeasurementCutLine.periodEnd",
    "ProjectProgressMeasurementCutLine.measurementRationale",
    "ProjectProgressMeasurementCutLine.lineSnapshotSha256",
  ]) invariant(map.has(required), `Missing required S9.2 column ${required}.`);
  for (const decimal of ["baseQuantity", "periodQuantity", "cumulativeQuantity"]) {
    const row = map.get(`ProjectProgressMeasurementCutLine.${decimal}`);
    invariant(row?.numeric_precision === 18 && row?.numeric_scale === 4, `${decimal} must remain Decimal(18,4).`);
  }
  const forbidden = columns.rows.filter((row) =>
    /amount|price|currency|payment|certificate|retention|tax/i.test(row.column_name),
  );
  invariant(forbidden.length === 0, "Technical cut tables contain forbidden financial/certificate columns.");

  const constraints = await client.query(
    `SELECT con.conname, con.contype, source.relname AS source_table,
            referenced.relname AS referenced_table,
            pg_get_constraintdef(con.oid) AS definition,
            ARRAY(
              SELECT attribute.attname
                FROM unnest(con.conkey) WITH ORDINALITY AS key(attnum, ordinal)
                JOIN pg_attribute attribute
                  ON attribute.attrelid = con.conrelid AND attribute.attnum = key.attnum
               ORDER BY key.ordinal
            )::TEXT[] AS local_columns,
            ARRAY(
              SELECT attribute.attname
                FROM unnest(con.confkey) WITH ORDINALITY AS key(attnum, ordinal)
                JOIN pg_attribute attribute
                  ON attribute.attrelid = con.confrelid AND attribute.attnum = key.attnum
               ORDER BY key.ordinal
            )::TEXT[] AS referenced_columns
       FROM pg_constraint con
       JOIN pg_class source ON source.oid = con.conrelid
       LEFT JOIN pg_class referenced ON referenced.oid = con.confrelid
      WHERE con.connamespace = $1::regnamespace
        AND con.conname = ANY($2::text[])`,
    [schema, [
      "PPMCut_counts_check",
      "PPMCutLine_source_shape_check",
      "PPMCutHead_current_cut_scope_fkey",
      "PPMCut_predecessor_scope_fkey",
      "PPMCutLine_cut_head_period_fkey",
      "PPMCutLine_measurement_head_scope_fkey",
      "PPMCutLine_decision_scope_fkey",
    ]],
  );
  invariant(constraints.rows.length === 7, "S9.2 structural constraints are incomplete.");
  const currentCutScope = constraints.rows.find((row) => row.conname === "PPMCutHead_current_cut_scope_fkey");
  invariant(
    currentCutScope?.contype === "f"
      && currentCutScope.source_table === "ProjectProgressMeasurementCutHead"
      && currentCutScope.referenced_table === "ProjectProgressMeasurementCut"
      && JSON.stringify(currentCutScope.local_columns) === JSON.stringify([
        "organizationId", "projectId", "id", "currentCutId",
      ])
      && JSON.stringify(currentCutScope.referenced_columns) === JSON.stringify([
        "organizationId", "projectId", "headId", "id",
      ]),
    "Current cut FK is not bound to its own fortnight head.",
  );
  const decisionScope = constraints.rows.find((row) => row.conname === "PPMCutLine_decision_scope_fkey");
  const sourceShape = constraints.rows.find((row) => row.conname === "PPMCutLine_source_shape_check");
  invariant(
    decisionScope?.contype === "f"
      && decisionScope.source_table === "ProjectProgressMeasurementCutLine"
      && decisionScope.referenced_table === "TaskProgressMeasurementDecision"
      && sourceShape?.contype === "c"
      && sourceShape.definition.includes("'APPROVED'")
      && JSON.stringify(decisionScope.local_columns) === JSON.stringify([
        "organizationId",
        "projectId",
        "taskId",
        "approvedMeasurementId",
        "approvedDecisionId",
        "approvedDecisionSnapshot",
      ])
      && JSON.stringify(decisionScope.referenced_columns) === JSON.stringify([
        "organizationId",
        "projectId",
        "taskId",
        "measurementId",
        "id",
        "decision",
      ]),
    "Measured cut line is not structurally bound to an APPROVED decision snapshot.",
  );

  const indexes = await client.query(
    `SELECT indexname FROM pg_indexes
      WHERE schemaname = $1 AND indexname = ANY($2::text[])`,
    [schema, [
      "PPMCutHead_scope_period_key",
      "PPMCut_org_operation_hash_key",
      "PPMCut_head_version_key",
      "PPMCutLine_cut_ordinal_key",
      "PPMCutLine_cut_task_key",
      "TPMHead_cut_period_scope_key",
      "TPMDecision_approved_cut_scope_key",
    ]],
  );
  invariant(indexes.rows.length === 7, "S9.2 uniqueness/scope indexes are incomplete.");
}

async function assertFunctionsAndTriggers(client, schema) {
  const functions = await client.query(
    `SELECT p.proname, p.provolatile, p.prosecdef, p.pronargs,
            pg_get_function_identity_arguments(p.oid) AS arguments,
            pg_get_function_result(p.oid) AS result,
            pg_get_functiondef(p.oid) AS definition
       FROM pg_proc p
      WHERE p.pronamespace = $1::regnamespace
        AND p.proname = ANY($2::text[])`,
    [schema, [
      "obrasaas_progress_measurement_cut_line_sha",
      "obrasaas_progress_measurement_cut_build_candidate",
      "obrasaas_progress_measurement_cut_read",
      "obrasaas_progress_measurement_cut_result",
      "obrasaas_progress_measurement_cut_seal",
      "obrasaas_progress_measurement_cut_seal_worker",
      "obrasaas_progress_measurement_cut_seal_command",
      "obrasaas_progress_measurement_cut_append_only_guard",
      "obrasaas_progress_measurement_cut_line_guard",
      "obrasaas_progress_measurement_cut_projection_guard",
      "obrasaas_progress_measurement_cut_no_truncate",
    ]],
  );
  invariant(functions.rows.length === 11, "S9.2 governed functions are incomplete.");
  const seal = functions.rows.find((row) => row.proname === "obrasaas_progress_measurement_cut_seal");
  const sealWorker = functions.rows.find((row) => row.proname === "obrasaas_progress_measurement_cut_seal_worker");
  const sealCommand = functions.rows.find((row) => row.proname === "obrasaas_progress_measurement_cut_seal_command");
  const read = functions.rows.find((row) => row.proname === "obrasaas_progress_measurement_cut_read");
  const builder = functions.rows.find((row) => row.proname === "obrasaas_progress_measurement_cut_build_candidate");
  invariant(seal?.provolatile === "v" && !seal.prosecdef, "Seal must be VOLATILE SECURITY INVOKER.");
  invariant(read?.provolatile === "s" && !read.prosecdef, "Read helper must be STABLE SECURITY INVOKER.");
  invariant(builder?.provolatile === "s", "Canonical candidate builder must be STABLE.");
  invariant(read.result.includes("actor_can_seal boolean"), "Read helper omits DB-owned actor_can_seal.");
  invariant(read.result.includes("candidate_lines jsonb") && read.result.includes("current_cut jsonb"), "Read helper result is incomplete.");
  invariant(seal.arguments.includes("p_expected_candidate_sha256 text"), "Seal omits candidate CAS token.");
  invariant(
    seal.pronargs === 9
      && sealWorker?.pronargs === 9
      && sealCommand?.pronargs === 0
      && seal.arguments === sealWorker.arguments
      && seal.result === sealWorker.result,
    "Public seal and governed worker signatures/receipts diverged.",
  );
  invariant(
    seal.definition.includes('INSERT INTO "ObrasaasProgressMeasurementCutSealCommand"'),
    "Seal does not enter through the governed command trigger.",
  );
  invariant(
    sealCommand?.definition.includes("obrasaas_progress_measurement_cut_seal_worker"),
    "Governed command trigger does not invoke the complete seal worker.",
  );
  invariant(
    sealCommand.definition.includes("pg_trigger_depth() <> 1")
      && sealWorker?.definition.includes("pg_trigger_depth() <> 1"),
    "Command/worker provenance is not structurally bound to trigger depth 1.",
  );
  for (const guardName of [
    "obrasaas_progress_measurement_cut_append_only_guard",
    "obrasaas_progress_measurement_cut_line_guard",
    "obrasaas_progress_measurement_cut_projection_guard",
  ]) {
    invariant(
      functions.rows.find((row) => row.proname === guardName)?.definition.includes("pg_trigger_depth() <> 2"),
      `${guardName} is not structurally bound to the governed depth-2 write path.`,
    );
  }
  invariant(
    !functions.rows.some((row) => row.definition.includes("PG_CONTEXT")),
    "S9.2 provenance must not depend on forgeable PG_CONTEXT text.",
  );
  const operationLock = sealWorker.definition.indexOf("progress-measurement-cut:seal:");
  const scopeLock = sealWorker.definition.indexOf("progress-measurement-cut:scope:");
  const rowLock = sealWorker.definition.indexOf("FOR UPDATE");
  invariant(operationLock >= 0 && operationLock < scopeLock && scopeLock < rowLock, "Seal lock order is not operation -> project-period -> rows.");
  invariant(
    sealWorker.definition.includes("obrasaas_progress_measurement_cut_build_candidate"),
    "Seal does not reuse the canonical DB candidate builder.",
  );
  invariant(
    read.definition.includes("obrasaas_progress_measurement_cut_build_candidate"),
    "Read helper does not reuse the canonical DB candidate builder.",
  );

  const triggers = await client.query(
    `SELECT c.relname, t.tgname, t.tgenabled
       FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      WHERE c.relnamespace = $1::regnamespace AND NOT t.tgisinternal
        AND t.tgname = ANY($2::text[])`,
    [schema, [
      "ProjectProgressMeasurementCut_append_only",
      "ProjectProgressMeasurementCut_no_truncate",
      "ProjectProgressMeasurementCutLine_append_only",
      "ProjectProgressMeasurementCutLine_no_truncate",
      "ProjectProgressMeasurementCutHead_projection_guard",
      "ProjectProgressMeasurementCutHead_no_truncate",
    ]],
  );
  invariant(triggers.rows.length === 6, "S9.2 fact/projection governance triggers are incomplete.");
  invariant(triggers.rows.every((row) => row.tgenabled === "A"), "Every S9.2 fact/projection guard must be ENABLE ALWAYS.");

  const commandTrigger = await client.query(
    `SELECT c.relkind, t.tgenabled, p.proname
       FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE c.relnamespace = $1::regnamespace
        AND c.relname = 'ObrasaasProgressMeasurementCutSealCommand'
        AND t.tgname = 'ObrasaasProgressMeasurementCutSealCommand_governed_insert'
        AND NOT t.tgisinternal`,
    [schema],
  );
  invariant(commandTrigger.rows.length === 1, "S9.2 governed command view/trigger is incomplete.");
  invariant(
    commandTrigger.rows[0].relkind === "v"
      && commandTrigger.rows[0].tgenabled === "O"
      && commandTrigger.rows[0].proname === "obrasaas_progress_measurement_cut_seal_command",
    "S9.2 command surface must be an ordinary fail-closed INSTEAD OF view trigger.",
  );
}

function fixture(prefix) {
  return {
    prefix,
    organizationId: `${prefix}_org`,
    projectId: `${prefix}_project`,
    measuredTaskId: `${prefix}_task_a`,
    missingTaskId: `${prefix}_task_b`,
    makerUserId: `${prefix}_maker_user`,
    directorUserId: `${prefix}_director_user`,
    adminUserId: `${prefix}_admin_user`,
    auditorUserId: `${prefix}_auditor_user`,
    makerMembershipId: `${prefix}_maker_member`,
    directorMembershipId: `${prefix}_director_member`,
    adminMembershipId: `${prefix}_admin_member`,
    auditorMembershipId: `${prefix}_auditor_member`,
    evidenceAId: `${prefix}_evidence_a`,
    evidenceBId: `${prefix}_evidence_b`,
    periodStart: "2020-01-01",
    periodEnd: "2020-01-15",
  };
}

async function seedFixture(client, item) {
  await client.query(
    `INSERT INTO "Organization" ("id", "name", "slug", "timezone", "createdAt", "updatedAt")
     VALUES ($1, 'S9.2 verifier', $2, 'America/Argentina/Buenos_Aires', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [item.organizationId, `${item.prefix}-org`],
  );
  await client.query(
    `INSERT INTO "PlatformUser" (
       "id", "clerkUserId", "primaryEmail", "lastSeenAt", "createdAt", "updatedAt"
     ) VALUES
       ($1,$2,$3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
       ($4,$5,$6,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
       ($7,$8,$9,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
       ($10,$11,$12,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
    [
      item.makerUserId, `${item.prefix}_maker_clerk`, `${item.prefix}_maker@example.invalid`,
      item.directorUserId, `${item.prefix}_director_clerk`, `${item.prefix}_director@example.invalid`,
      item.adminUserId, `${item.prefix}_admin_clerk`, `${item.prefix}_admin@example.invalid`,
      item.auditorUserId, `${item.prefix}_auditor_clerk`, `${item.prefix}_auditor@example.invalid`,
    ],
  );
  await client.query(
    `INSERT INTO "TenantMembership" (
       "id", "organizationId", "userId", "clerkRole", "tenantRole", "status", "createdAt", "updatedAt"
     ) VALUES
       ($1,$2,$3,'org:member','SITE_MANAGER','ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
       ($4,$2,$5,'org:admin','DIRECTOR','ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
       ($6,$2,$7,'org:admin','ADMIN','ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
       ($8,$2,$9,'org:member','AUDITOR','ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
    [
      item.makerMembershipId, item.organizationId, item.makerUserId,
      item.directorMembershipId, item.directorUserId,
      item.adminMembershipId, item.adminUserId,
      item.auditorMembershipId, item.auditorUserId,
    ],
  );
  await client.query(
    `INSERT INTO "Project" (
       "id", "organizationId", "name", "slug", "status", "createdAt", "updatedAt"
     ) VALUES ($1,$2,'S9.2 verifier project',$3,'ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
    [item.projectId, item.organizationId, `${item.prefix}-project`],
  );
  await client.query(
    `INSERT INTO "Task" (
       "id", "projectId", "code", "title", "type", "status", "progress", "revision",
       "metadata", "createdAt", "updatedAt"
     ) VALUES
       ($1,$2,'A','Measured canonical task','TASK','IN_PROGRESS',37,4,
        '{"source":"canonical-task-v1"}'::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
       ($3,$2,'B','Explicitly missing canonical task','TASK','READY',0,2,
        '{"source":"canonical-task-v1"}'::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
    [item.measuredTaskId, item.projectId, item.missingTaskId],
  );
  await client.query(
    `INSERT INTO "ProgressEvidence" (
       "id", "projectId", "taskId", "capturedAt", "media", "status", "revision", "createdAt", "updatedAt"
     ) VALUES
       ($1,$2,$3,CURRENT_TIMESTAMP,'{"kind":"PHOTO","url":"verifier-a"}'::jsonb,
        'APPROVED',2,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
       ($4,$2,$5,CURRENT_TIMESTAMP,'{"kind":"PHOTO","url":"verifier-b"}'::jsonb,
        'APPROVED',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
    [item.evidenceAId, item.projectId, item.measuredTaskId, item.evidenceBId, item.missingTaskId],
  );
}

function submitArgs(item, taskId, evidenceId, {
  periodQuantity = "30.0000",
  expectedHeadId = null,
  operation = `${item.prefix}_measurement_submit`,
  fingerprint = sha256(`${item.prefix}:measurement-submit`),
} = {}) {
  return [
    item.organizationId,
    item.projectId,
    taskId,
    item.periodStart,
    item.periodEnd,
    "M2",
    "100.0000",
    periodQuantity,
    "DIRECT_COUNT",
    "Technical quantity verified for the cut fixture.",
    JSON.stringify([evidenceId]),
    expectedHeadId,
    operation,
    fingerprint,
    item.makerMembershipId,
  ];
}

function reviewArgs(item, measurementId, expectedRevision, {
  decision = "APPROVED",
  operation = `${item.prefix}_measurement_review`,
  fingerprint = sha256(`${item.prefix}:measurement-review`),
} = {}) {
  return [
    item.organizationId,
    item.projectId,
    measurementId,
    expectedRevision,
    decision,
    decision === "APPROVED" ? "Approved technical evidence." : "Rejected technical evidence.",
    operation,
    fingerprint,
    item.directorMembershipId,
  ];
}

async function approveFirstMeasurement(client, item) {
  const submitted = await client.query(
    SUBMIT_SQL,
    submitArgs(item, item.measuredTaskId, item.evidenceAId),
  );
  const measurementId = submitted.rows[0].measurement_id;
  await client.query(REVIEW_SQL, reviewArgs(item, measurementId, submitted.rows[0].head_revision));
  return measurementId;
}

function readArgs(item, actor = item.directorMembershipId) {
  return [item.organizationId, item.projectId, item.periodStart, item.periodEnd, actor];
}

function sealArgs(item, candidate, {
  expectedHeadId = null,
  operation = `${item.prefix}_cut_seal`,
  fingerprint = sha256(`${item.prefix}:cut-seal`),
  actor = item.directorMembershipId,
} = {}) {
  return [
    item.organizationId,
    item.projectId,
    item.periodStart,
    item.periodEnd,
    expectedHeadId,
    candidate,
    operation,
    fingerprint,
    actor,
  ];
}

async function expectDatabaseError(client, marker, action) {
  await client.query("SAVEPOINT progress_measurement_cut_case");
  try {
    await action();
  } catch (error) {
    await client.query("ROLLBACK TO SAVEPOINT progress_measurement_cut_case");
    await client.query("RELEASE SAVEPOINT progress_measurement_cut_case");
    invariant(String(error.message).includes(marker), `Expected ${marker}, received ${error.message}.`);
    return;
  }
  await client.query("ROLLBACK TO SAVEPOINT progress_measurement_cut_case");
  await client.query("RELEASE SAVEPOINT progress_measurement_cut_case");
  throw new Error(`Expected database rejection ${marker}.`);
}

async function assertRollbackOnlyJourney(client) {
  const item = fixture(`pmc_${randomUUID().replaceAll("-", "")}`);
  await seedFixture(client, item);
  const originalMeasurementId = await approveFirstMeasurement(client, item);

  const otherOrganizationId = `${item.prefix}_other_org`;
  const otherUserId = `${item.prefix}_other_user`;
  const otherMembershipId = `${item.prefix}_other_member`;
  await client.query(
    `INSERT INTO "Organization" ("id","name","slug","createdAt","updatedAt")
     VALUES ($1,'Other S9.2 tenant',$2,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
    [otherOrganizationId, `${item.prefix}-other-org`],
  );
  await client.query(
    `INSERT INTO "PlatformUser" ("id","clerkUserId","primaryEmail","lastSeenAt","createdAt","updatedAt")
     VALUES ($1,$2,$3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
    [otherUserId, `${item.prefix}_other_clerk`, `${item.prefix}_other@example.invalid`],
  );
  await client.query(
    `INSERT INTO "TenantMembership" (
       "id","organizationId","userId","clerkRole","tenantRole","status","createdAt","updatedAt"
     ) VALUES ($1,$2,$3,'org:admin','DIRECTOR','ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
    [otherMembershipId, otherOrganizationId, otherUserId],
  );

  const initialRead = await client.query(READ_SQL, readArgs(item));
  const initial = initialRead.rows[0];
  invariant(initial.readiness === "READY", "Initial candidate must be READY.");
  invariant(initial.actor_can_seal === true, "Active director must be seal-capable.");
  invariant(initial.task_count === 2 && initial.measured_line_count === 1 && initial.missing_line_count === 1, "MEASURED/MISSING counts drifted.");
  invariant(initial.candidate_lines.length === 2, "Candidate must include every canonical task.");
  assert.deepEqual(
    initial.candidate_lines.map((line) => line.task.id),
    [...initial.candidate_lines.map((line) => line.task.id)].sort(),
    "Candidate lines are not canonically ordered by taskId.",
  );
  invariant(initial.candidate_lines[0].snapshotToken?.length === 64, "Candidate line snapshot token is missing.");
  const measured = initial.candidate_lines.find((line) => line.state === "MEASURED");
  const missing = initial.candidate_lines.find((line) => line.state === "MISSING");
  invariant(measured?.approvedMeasurement?.baselineQuantity === "100.0000", "Exact decimal strings drifted.");
  invariant(missing?.approvedMeasurement === null, "MISSING must remain absence, never zero.");

  const auditorRead = await client.query(READ_SQL, readArgs(item, item.auditorMembershipId));
  const siteRead = await client.query(READ_SQL, readArgs(item, item.makerMembershipId));
  const adminRead = await client.query(READ_SQL, readArgs(item, item.adminMembershipId));
  invariant(auditorRead.rows[0].actor_can_seal === false, "Auditor read must not grant seal capability.");
  invariant(siteRead.rows[0].actor_can_seal === false, "Site manager read must not grant seal capability.");
  invariant(adminRead.rows[0].actor_can_seal === true, "Administrator must be seal-capable.");
  await expectDatabaseError(client, "PROGRESS_MEASUREMENT_CUT_ACTOR_FORBIDDEN", () =>
    client.query(READ_SQL, [otherOrganizationId, item.projectId, item.periodStart, item.periodEnd, otherMembershipId]),
  );
  await client.query(`UPDATE "TenantMembership" SET "status"='DISABLED' WHERE "id"=$1`, [item.auditorMembershipId]);
  await expectDatabaseError(client, "PROGRESS_MEASUREMENT_CUT_ACTOR_FORBIDDEN", () =>
    client.query(READ_SQL, readArgs(item, item.auditorMembershipId)),
  );
  await client.query(`UPDATE "TenantMembership" SET "status"='ACTIVE' WHERE "id"=$1`, [item.auditorMembershipId]);
  await expectDatabaseError(client, "PROGRESS_MEASUREMENT_CUT_PERIOD_OPEN", () =>
    client.query(READ_SQL, [item.organizationId, item.projectId, "2099-01-01", "2099-01-15", item.directorMembershipId]),
  );

  const firstArgs = sealArgs(item, initial.candidate_sha256);
  const first = await client.query(SEAL_SQL, firstArgs);
  const firstReceipt = first.rows[0];
  invariant(firstReceipt.cut_version === 1 && firstReceipt.head_revision === 1 && firstReceipt.replayed === false, "First seal receipt drifted.");
  const exactReplay = await client.query(SEAL_SQL, firstArgs);
  invariant(exactReplay.rows[0].cut_id === firstReceipt.cut_id && exactReplay.rows[0].replayed === true, "Exact seal replay failed.");
  await client.query(`UPDATE "TenantMembership" SET "tenantRole"='SITE_MANAGER' WHERE "id"=$1`, [item.directorMembershipId]);
  await expectDatabaseError(client, "PROGRESS_MEASUREMENT_CUT_ACTOR_FORBIDDEN", () =>
    client.query(SEAL_SQL, firstArgs),
  );
  await client.query(`UPDATE "TenantMembership" SET "tenantRole"='DIRECTOR',"status"='DISABLED' WHERE "id"=$1`, [item.directorMembershipId]);
  await expectDatabaseError(client, "PROGRESS_MEASUREMENT_CUT_ACTOR_FORBIDDEN", () =>
    client.query(SEAL_SQL, firstArgs),
  );
  await client.query(`UPDATE "TenantMembership" SET "status"='ACTIVE' WHERE "id"=$1`, [item.directorMembershipId]);
  await expectDatabaseError(client, "PROGRESS_MEASUREMENT_CUT_IDEMPOTENCY_CONFLICT", () =>
    client.query(SEAL_SQL, sealArgs(item, initial.candidate_sha256, {
      fingerprint: sha256(`${item.prefix}:mutated-same-key`),
    })),
  );
  await expectDatabaseError(client, "PROGRESS_MEASUREMENT_CUT_NO_CHANGE", () =>
    client.query(SEAL_SQL, sealArgs(item, initial.candidate_sha256, {
      expectedHeadId: firstReceipt.cut_id,
      operation: `${item.prefix}_unchanged_cut`,
      fingerprint: sha256(`${item.prefix}:unchanged-cut`),
    })),
  );
  await expectDatabaseError(client, "PROGRESS_MEASUREMENT_CUT_HEAD_STALE", () =>
    client.query(SEAL_SQL, sealArgs(item, initial.candidate_sha256, {
      expectedHeadId: null,
      operation: `${item.prefix}_stale_head_cut`,
      fingerprint: sha256(`${item.prefix}:stale-head-cut`),
    })),
  );

  const currentRead = await client.query(READ_SQL, readArgs(item, item.auditorMembershipId));
  invariant(currentRead.rows[0].readiness === "UP_TO_DATE", "Current candidate must be UP_TO_DATE.");
  invariant(currentRead.rows[0].current_cut.previousCutId === null, "First cut predecessor must be null.");
  invariant(currentRead.rows[0].current_cut.integrityDigest === firstReceipt.snapshot_sha256, "Read and receipt cut digests diverged.");
  invariant(currentRead.rows[0].current_cut.sealedByLabel === "Miembro autorizado", "Historical sealer label leaked mutable identity/role.");
  invariant(!JSON.stringify(currentRead.rows[0].current_cut).includes(item.directorMembershipId), "Public currentCut leaked membership id.");
  await expectDatabaseError(client, "seal worker requires the governed command trigger", () =>
    client.query(
      `SELECT * FROM obrasaas_progress_measurement_cut_seal_worker(
        $1,$2,$3::date,$4::date,$5,$6,$7,$8,$9
      )`,
      sealArgs(item, currentRead.rows[0].candidate_sha256, {
        expectedHeadId: firstReceipt.cut_id,
        operation: `${item.prefix}_direct_worker_bypass`,
        fingerprint: sha256(`${item.prefix}:direct-worker-bypass`),
      }),
    ),
  );
  await expectDatabaseError(client, "PROGRESS_MEASUREMENT_CUT_ACTOR_FORBIDDEN", () =>
    client.query(
      `INSERT INTO "ObrasaasProgressMeasurementCutSealCommand" (
         "organizationId","projectId","periodStart","periodEnd","expectedHeadCutId",
         "expectedCandidateSha256","operationKey","requestFingerprint","actorMembershipId"
       ) VALUES ($1,$2,$3::date,$4::date,$5,$6,$7,$8,$9)`,
      [
        item.organizationId,
        item.projectId,
        item.periodStart,
        item.periodEnd,
        firstReceipt.cut_id,
        currentRead.rows[0].candidate_sha256,
        `${item.prefix}_direct_command_bypass`,
        sha256(`${item.prefix}:direct-command-bypass`),
        item.auditorMembershipId,
      ],
    ),
  );
  const firstLineHashes = await client.query(
    `SELECT "taskId", "state"::text, "lineSnapshotSha256"::text
       FROM "ProjectProgressMeasurementCutLine"
      WHERE "cutId"=$1 ORDER BY "taskId"`,
    [firstReceipt.cut_id],
  );

  await client.query("SET LOCAL TIME ZONE 'Pacific/Auckland'");
  await client.query("SET LOCAL datestyle TO 'SQL, DMY'");
  const alternateSession = await client.query(READ_SQL, readArgs(item));
  invariant(alternateSession.rows[0].candidate_sha256 === initial.candidate_sha256, "Candidate hash depends on TimeZone/DateStyle.");
  await client.query("SET LOCAL TIME ZONE 'UTC'");
  await client.query("SET LOCAL datestyle TO 'ISO, MDY'");

  await expectDatabaseError(client, "ProjectProgressMeasurementCut is append-only", () =>
    client.query(`UPDATE "ProjectProgressMeasurementCut" SET "version"="version"+1 WHERE "id"=$1`, [firstReceipt.cut_id]),
  );
  await expectDatabaseError(client, "ProjectProgressMeasurementCutLine is append-only", () =>
    client.query(`UPDATE "ProjectProgressMeasurementCutLine" SET "taskTitle"='tampered' WHERE "cutId"=$1`, [firstReceipt.cut_id]),
  );
  await expectDatabaseError(client, "direct progress measurement cut projection writes are forbidden", () =>
    client.query(`UPDATE "ProjectProgressMeasurementCutHead" SET "revision"="revision"+1 WHERE "currentCutId"=$1`, [firstReceipt.cut_id]),
  );
  const cutHead = await client.query(`SELECT "id" FROM "ProjectProgressMeasurementCutHead" WHERE "currentCutId"=$1`, [firstReceipt.cut_id]);
  await expectDatabaseError(client, "direct progress measurement cut line writes are forbidden", async () => {
    await client.query(
      `SELECT set_config('obrasaas.progress_measurement_cut_write_scope',$1,true)`,
      [`${item.organizationId}:${item.projectId}:${cutHead.rows[0].id}`],
    );
    await client.query(
      `INSERT INTO "ProjectProgressMeasurementCutLine" (
         "id","organizationId","projectId","cutHeadId","cutId","ordinal","state",
         "periodStart","periodEnd","taskId","taskCode","taskTitle","taskRevision",
         "measurementHeadId","approvedMeasurementId","approvedDecisionId","approvedDecisionSnapshot",
         "unitCode","baseQuantity","periodQuantity","cumulativeQuantity","method",
         "measurementRationale","measurementRevision","evidenceCount","evidenceSetHash",
         "measurementDecisionCreatedAt","lineSnapshotSha256","createdAt"
       ) SELECT $2,"organizationId","projectId","cutHeadId","cutId",4999,"state",
                DATE '2020-01-16',DATE '2020-01-31',"taskId","taskCode","taskTitle","taskRevision",
                "measurementHeadId","approvedMeasurementId","approvedDecisionId","approvedDecisionSnapshot",
                "unitCode","baseQuantity","periodQuantity","cumulativeQuantity","method",
                "measurementRationale","measurementRevision","evidenceCount","evidenceSetHash",
                "measurementDecisionCreatedAt","lineSnapshotSha256",CURRENT_TIMESTAMP
           FROM "ProjectProgressMeasurementCutLine" WHERE "cutId"=$1 LIMIT 1`,
      [firstReceipt.cut_id, randomUUID()],
    );
  });
  await expectDatabaseError(client, "direct progress measurement cut ledger writes are forbidden", async () => {
    await client.query(
      `SELECT set_config('obrasaas.progress_measurement_cut_write_scope',$1,true)`,
      [`${item.organizationId}:${item.projectId}:${cutHead.rows[0].id}`],
    );
    await client.query(
      `INSERT INTO "ProjectProgressMeasurementCut" (
         "id","organizationId","projectId","headId","version","predecessorId",
         "taskCount","measuredLineCount","missingLineCount","candidateSha256","cutSha256",
         "headRevisionAtSeal","sealedByMembershipId","operationKeyHash","requestFingerprint","createdAt"
       ) SELECT $2,"organizationId","projectId","headId",99,NULL,"taskCount","measuredLineCount",
                "missingLineCount","candidateSha256","cutSha256",99,"sealedByMembershipId",$3,$4,
                (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::timestamp(3)
           FROM "ProjectProgressMeasurementCut" WHERE "id"=$1`,
      [firstReceipt.cut_id, randomUUID(), sha256(`${item.prefix}:forged-cut-op`), sha256(`${item.prefix}:forged-cut-request`)],
    );
  });
  await expectDatabaseError(client, "direct progress measurement cut projection writes are forbidden", async () => {
    await client.query(
      `SELECT set_config('obrasaas.progress_measurement_cut_write_scope',$1,true)`,
      [`${item.organizationId}:${item.projectId}:${cutHead.rows[0].id}`],
    );
    await client.query(
      `UPDATE "ProjectProgressMeasurementCutHead" SET "revision"="revision"+1 WHERE "id"=$1`,
      [cutHead.rows[0].id],
    );
  });
  await expectDatabaseError(client, "PPMCutLine_cut_head_period_fkey", async () => {
    await client.query(
      `ALTER TABLE "ProjectProgressMeasurementCutLine"
         DISABLE TRIGGER "ProjectProgressMeasurementCutLine_append_only"`,
    );
    await client.query(
      `UPDATE "ProjectProgressMeasurementCutLine"
          SET "periodStart"=DATE '2020-01-16', "periodEnd"=DATE '2020-01-31'
        WHERE "cutId"=$1`,
      [firstReceipt.cut_id],
    );
  });

  const pending = await client.query(
    SUBMIT_SQL,
    submitArgs(item, item.missingTaskId, item.evidenceBId, {
      operation: `${item.prefix}_pending_submit`,
      fingerprint: sha256(`${item.prefix}:pending-submit`),
      periodQuantity: "5.0000",
    }),
  );
  const pendingRead = await client.query(READ_SQL, readArgs(item));
  invariant(pendingRead.rows[0].readiness === "REVIEW_PENDING", "Same-period pending review was not surfaced.");
  await expectDatabaseError(client, "PROGRESS_MEASUREMENT_CUT_REVIEW_PENDING", () =>
    client.query(SEAL_SQL, sealArgs(item, pendingRead.rows[0].candidate_sha256, {
      expectedHeadId: firstReceipt.cut_id,
      operation: `${item.prefix}_pending_cut`,
      fingerprint: sha256(`${item.prefix}:pending-cut`),
    })),
  );
  await client.query(REVIEW_SQL, reviewArgs(item, pending.rows[0].measurement_id, pending.rows[0].head_revision, {
    decision: "REJECTED",
    operation: `${item.prefix}_pending_reject`,
    fingerprint: sha256(`${item.prefix}:pending-reject`),
  }));

  const correctionSubmit = await client.query(
    SUBMIT_SQL,
    submitArgs(item, item.measuredTaskId, item.evidenceAId, {
      periodQuantity: "25.0000",
      expectedHeadId: originalMeasurementId,
      operation: `${item.prefix}_correction_submit`,
      fingerprint: sha256(`${item.prefix}:correction-submit`),
    }),
  );
  await client.query(REVIEW_SQL, reviewArgs(
    item,
    correctionSubmit.rows[0].measurement_id,
    correctionSubmit.rows[0].head_revision,
    {
      operation: `${item.prefix}_correction_review`,
      fingerprint: sha256(`${item.prefix}:correction-review`),
    },
  ));
  const staleRead = await client.query(READ_SQL, readArgs(item));
  invariant(staleRead.rows[0].readiness === "STALE", "Correction must make the next candidate STALE without rewriting history.");
  await expectDatabaseError(client, "PROGRESS_MEASUREMENT_CUT_CANDIDATE_STALE", () =>
    client.query(SEAL_SQL, sealArgs(item, initial.candidate_sha256, {
      expectedHeadId: firstReceipt.cut_id,
      operation: `${item.prefix}_stale_candidate_cut`,
      fingerprint: sha256(`${item.prefix}:stale-candidate-cut`),
    })),
  );
  await client.query("SET LOCAL TIME ZONE 'Pacific/Auckland'");
  const second = await client.query(SEAL_SQL, sealArgs(item, staleRead.rows[0].candidate_sha256, {
    expectedHeadId: firstReceipt.cut_id,
    operation: `${item.prefix}_cut_v2`,
    fingerprint: sha256(`${item.prefix}:cut-v2`),
  }));
  invariant(second.rows[0].cut_version === 2 && second.rows[0].head_revision === 2, "Second cut version/receipt drifted.");
  const utcReceipt = await client.query(
    `SELECT abs(extract(epoch FROM ("createdAt" - (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')))) < 5 AS utc
       FROM "ProjectProgressMeasurementCut" WHERE "id"=$1`,
    [second.rows[0].cut_id],
  );
  invariant(utcReceipt.rows[0].utc === true, "Seal timestamp/hash input depends on session TimeZone.");
  await client.query("SET LOCAL TIME ZONE 'UTC'");
  const lateReplay = await client.query(SEAL_SQL, firstArgs);
  invariant(
    lateReplay.rows[0].replayed === true
      && lateReplay.rows[0].cut_id === firstReceipt.cut_id
      && lateReplay.rows[0].head_revision === 1
      && lateReplay.rows[0].snapshot_sha256 === firstReceipt.snapshot_sha256,
    "Late replay leaked the live head/candidate projection.",
  );
  const historicalHashes = await client.query(
    `SELECT "taskId", "state"::text, "lineSnapshotSha256"::text
       FROM "ProjectProgressMeasurementCutLine"
      WHERE "cutId"=$1 ORDER BY "taskId"`,
    [firstReceipt.cut_id],
  );
  assert.deepEqual(historicalHashes.rows, firstLineHashes.rows, "Correction rewrote historical cut lines.");

  const taskProgress = await client.query(
    `SELECT "id","progress" FROM "Task" WHERE "id"=ANY($1::text[]) ORDER BY "id"`,
    [[item.measuredTaskId, item.missingTaskId]],
  );
  assert.deepEqual(taskProgress.rows.map((row) => row.progress), [37, 0], "Cut mutated Task.progress.");
  const financial = await client.query(
    `SELECT
       (SELECT count(*)::integer FROM "BudgetVersion" WHERE "projectId"=$1) AS budgets,
       (SELECT count(*)::integer FROM "CashFund" WHERE "projectId"=$1) AS cash_funds`,
    [item.projectId],
  );
  invariant(financial.rows[0].budgets === 0 && financial.rows[0].cash_funds === 0, "Technical seal created financial state.");

  await client.query(`UPDATE "Project" SET "status"='ARCHIVED' WHERE "id"=$1`, [item.projectId]);
  const archivedRead = await client.query(READ_SQL, readArgs(item));
  invariant(archivedRead.rows[0].current_cut.id === second.rows[0].cut_id, "Archived project lost readable cut history.");
  await expectDatabaseError(client, "PROGRESS_MEASUREMENT_CUT_PROJECT_ARCHIVED", () =>
    client.query(SEAL_SQL, sealArgs(item, archivedRead.rows[0].candidate_sha256, {
      expectedHeadId: second.rows[0].cut_id,
      operation: `${item.prefix}_archived_cut`,
      fingerprint: sha256(`${item.prefix}:archived-cut`),
    })),
  );

  return { prefix: item.prefix, otherPrefix: `${item.prefix}_other` };
}

async function assertRolledBack(client, schema, prefixes) {
  for (const table of [
    ...CUT_TABLES,
    "TaskProgressMeasurementDecision",
    "TaskProgressMeasurementEvidence",
    "TaskProgressMeasurementBalance",
    "TaskProgressMeasurement",
    "TaskProgressMeasurementHead",
    "ProgressEvidence",
    "Task",
    "TenantMembership",
    "PlatformUser",
    "Project",
    "Organization",
  ]) {
    for (const prefix of prefixes) {
      const result = await client.query(
        `SELECT count(*)::integer AS count
           FROM ${quoteIdentifier(schema)}.${quoteIdentifier(table)}
          WHERE "id" LIKE $1`,
        [`${prefix}%`],
      );
      invariant(result.rows[0].count === 0, `Rollback left verifier rows in ${table}.`);
    }
  }
}

async function connectDisposable(connectionString, schema, applicationName) {
  const client = new pg.Client({
    connectionString,
    application_name: applicationName,
    statement_timeout: 30_000,
    query_timeout: 35_000,
  });
  await client.connect();
  await client.query(`SET search_path TO ${quoteIdentifier(schema)}, pg_catalog`);
  return client;
}

async function seedCommittedFixture(connectionString, schema, label) {
  const item = fixture(`pmcr_${label}_${randomUUID().replaceAll("-", "")}`);
  const client = await connectDisposable(connectionString, schema, `obrasaas-s92-${label}-seed`);
  try {
    await client.query("BEGIN");
    await seedFixture(client, item);
    await approveFirstMeasurement(client, item);
    const read = await client.query(READ_SQL, readArgs(item));
    await client.query("COMMIT");
    return { item, candidate: read.rows[0].candidate_sha256 };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

const TRIGGER_MAP = new Map([
  ["ProjectProgressMeasurementCutLine", [
    "ProjectProgressMeasurementCutLine_append_only",
    "ProjectProgressMeasurementCutLine_no_truncate",
  ]],
  ["ProjectProgressMeasurementCut", [
    "ProjectProgressMeasurementCut_append_only",
    "ProjectProgressMeasurementCut_no_truncate",
  ]],
  ["ProjectProgressMeasurementCutHead", [
    "ProjectProgressMeasurementCutHead_projection_guard",
    "ProjectProgressMeasurementCutHead_no_truncate",
  ]],
  ["TaskProgressMeasurement", ["TaskProgressMeasurement_append_only", "TaskProgressMeasurement_no_truncate"]],
  ["TaskProgressMeasurementEvidence", ["TaskProgressMeasurementEvidence_append_only", "TaskProgressMeasurementEvidence_no_truncate"]],
  ["TaskProgressMeasurementDecision", ["TaskProgressMeasurementDecision_append_only", "TaskProgressMeasurementDecision_no_truncate"]],
  ["TaskProgressMeasurementHead", ["TaskProgressMeasurementHead_projection_guard", "TaskProgressMeasurementHead_no_truncate"]],
  ["TaskProgressMeasurementBalance", ["TaskProgressMeasurementBalance_projection_guard", "TaskProgressMeasurementBalance_no_truncate"]],
  ["Task", ["Task_progress_measurement_identity_guard"]],
  ["Project", ["Project_progress_measurement_closure_guard"]],
]);

async function cleanupDisposableFixture(connectionString, schema, item) {
  const client = await connectDisposable(connectionString, schema, "obrasaas-s92-cleanup");
  try {
    await client.query("BEGIN");
    for (const [table, triggerNames] of TRIGGER_MAP) {
      for (const triggerName of triggerNames) {
        await client.query(
          `ALTER TABLE ${quoteIdentifier(table)} DISABLE TRIGGER ${quoteIdentifier(triggerName)}`,
        );
      }
    }
    await client.query(`DELETE FROM "ProjectProgressMeasurementCutLine" WHERE "organizationId"=$1`, [item.organizationId]);
    await client.query(`UPDATE "ProjectProgressMeasurementCutHead" SET "currentCutId"=NULL WHERE "organizationId"=$1`, [item.organizationId]);
    await client.query(`DELETE FROM "ProjectProgressMeasurementCut" WHERE "organizationId"=$1`, [item.organizationId]);
    await client.query(`DELETE FROM "ProjectProgressMeasurementCutHead" WHERE "organizationId"=$1`, [item.organizationId]);
    await client.query(`DELETE FROM "TaskProgressMeasurementDecision" WHERE "organizationId"=$1`, [item.organizationId]);
    await client.query(`DELETE FROM "TaskProgressMeasurementEvidence" WHERE "organizationId"=$1`, [item.organizationId]);
    await client.query(`DELETE FROM "TaskProgressMeasurementBalance" WHERE "organizationId"=$1`, [item.organizationId]);
    await client.query(
      `UPDATE "TaskProgressMeasurementHead"
          SET "headMeasurementId"=NULL,"pendingMeasurementId"=NULL,"approvedMeasurementId"=NULL
        WHERE "organizationId"=$1`,
      [item.organizationId],
    );
    await client.query(`DELETE FROM "TaskProgressMeasurement" WHERE "organizationId"=$1`, [item.organizationId]);
    await client.query(`DELETE FROM "TaskProgressMeasurementHead" WHERE "organizationId"=$1`, [item.organizationId]);
    await client.query(`DELETE FROM "ProgressEvidence" WHERE "projectId"=$1`, [item.projectId]);
    await client.query(`DELETE FROM "Task" WHERE "projectId"=$1`, [item.projectId]);
    await client.query(`DELETE FROM "TenantMembership" WHERE "organizationId"=$1`, [item.organizationId]);
    await client.query(
      `DELETE FROM "PlatformUser" WHERE "id"=ANY($1::text[])`,
      [[item.makerUserId, item.directorUserId, item.adminUserId, item.auditorUserId]],
    );
    await client.query(`DELETE FROM "Project" WHERE "id"=$1`, [item.projectId]);
    await client.query(`DELETE FROM "Organization" WHERE "id"=$1`, [item.organizationId]);
    const residue = await client.query(
      `SELECT
         (SELECT count(*)::integer FROM "ProjectProgressMeasurementCut" WHERE "organizationId"=$1) AS cuts,
         (SELECT count(*)::integer FROM "ProjectProgressMeasurementCutLine" WHERE "organizationId"=$1) AS lines,
         (SELECT count(*)::integer FROM "TaskProgressMeasurement" WHERE "organizationId"=$1) AS measurements,
         (SELECT count(*)::integer FROM "TenantMembership" WHERE "organizationId"=$1) AS memberships,
         (SELECT count(*)::integer FROM "Project" WHERE "id"=$2) AS projects,
         (SELECT count(*)::integer FROM "Organization" WHERE "id"=$1) AS organizations`,
      [item.organizationId, item.projectId],
    );
    invariant(Object.values(residue.rows[0]).every((value) => value === 0), "Disposable cleanup left S9.2 fixture residue.");
    for (const [table, triggerNames] of TRIGGER_MAP) {
      for (const triggerName of triggerNames) {
        await client.query(
          `ALTER TABLE ${quoteIdentifier(table)} ENABLE ALWAYS TRIGGER ${quoteIdentifier(triggerName)}`,
        );
      }
    }
    await client.query("COMMIT");
    const expectedTriggerNames = [...TRIGGER_MAP.values()].flat();
    const restored = await client.query(
      `SELECT t.tgname,t.tgenabled
         FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
        WHERE c.relnamespace=$1::regnamespace AND NOT t.tgisinternal
          AND t.tgname=ANY($2::text[])`,
      [schema, expectedTriggerNames],
    );
    invariant(
      restored.rows.length === expectedTriggerNames.length
        && restored.rows.every((row) => row.tgenabled === "A"),
      "Disposable cleanup did not restore every governed trigger as ENABLE ALWAYS.",
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

async function runDisposableSeal(connectionString, schema, args, label) {
  const client = await connectDisposable(connectionString, schema, `obrasaas-s92-${label}`);
  try {
    const result = await client.query(SEAL_SQL, args);
    return result.rows[0];
  } finally {
    await client.end();
  }
}

function fulfilled(settled) {
  return settled.filter((entry) => entry.status === "fulfilled").map((entry) => entry.value);
}

function rejected(settled) {
  return settled.filter((entry) => entry.status === "rejected").map((entry) => entry.reason);
}

async function assertDisposableSameKey(connectionString, schema) {
  const { item, candidate } = await seedCommittedFixture(connectionString, schema, "same_key");
  try {
    const args = sealArgs(item, candidate, {
      operation: `${item.prefix}_same_key`, fingerprint: sha256(`${item.prefix}:same-key`),
    });
    const results = await Promise.all([
      runDisposableSeal(connectionString, schema, args, "same-key-a"),
      runDisposableSeal(connectionString, schema, args, "same-key-b"),
    ]);
    invariant(results[0].cut_id === results[1].cut_id, "Concurrent exact replay created different cuts.");
    assert.deepEqual(results.map((row) => row.replayed).sort(), [false, true], "Concurrent exact replay receipt flags drifted.");
  } finally {
    await cleanupDisposableFixture(connectionString, schema, item);
  }
}

async function assertDisposableMutatedKey(connectionString, schema) {
  const { item, candidate } = await seedCommittedFixture(connectionString, schema, "mutated_key");
  try {
    const operation = `${item.prefix}_mutated_key`;
    const outcomes = await Promise.allSettled([
      runDisposableSeal(connectionString, schema, sealArgs(item, candidate, {
        operation, fingerprint: sha256(`${item.prefix}:mutated-a`),
      }), "mutated-a"),
      runDisposableSeal(connectionString, schema, sealArgs(item, candidate, {
        operation, fingerprint: sha256(`${item.prefix}:mutated-b`),
      }), "mutated-b"),
    ]);
    invariant(fulfilled(outcomes).length === 1 && rejected(outcomes).length === 1, "Mutated same-key race did not select exactly one request.");
    invariant(String(rejected(outcomes)[0].message).includes("PROGRESS_MEASUREMENT_CUT_IDEMPOTENCY_CONFLICT"), "Mutated same-key loser was not controlled.");
  } finally {
    await cleanupDisposableFixture(connectionString, schema, item);
  }
}

async function assertDisposableTwoSealers(connectionString, schema) {
  const { item, candidate } = await seedCommittedFixture(connectionString, schema, "two_sealers");
  try {
    const outcomes = await Promise.allSettled([
      runDisposableSeal(connectionString, schema, sealArgs(item, candidate, {
        operation: `${item.prefix}_sealer_a`, fingerprint: sha256(`${item.prefix}:sealer-a`),
        actor: item.directorMembershipId,
      }), "sealer-a"),
      runDisposableSeal(connectionString, schema, sealArgs(item, candidate, {
        operation: `${item.prefix}_sealer_b`, fingerprint: sha256(`${item.prefix}:sealer-b`),
        actor: item.adminMembershipId,
      }), "sealer-b"),
    ]);
    invariant(fulfilled(outcomes).length === 1 && rejected(outcomes).length === 1, "Two-sealer race did not select one cut.");
    invariant(String(rejected(outcomes)[0].message).includes("PROGRESS_MEASUREMENT_CUT_HEAD_STALE"), "Two-sealer loser was not a controlled stale CAS.");
  } finally {
    await cleanupDisposableFixture(connectionString, schema, item);
  }
}

async function assertDisposableCorrectionOrdering(connectionString, schema) {
  const { item, candidate } = await seedCommittedFixture(connectionString, schema, "correction_order");
  const correction = await connectDisposable(connectionString, schema, "obrasaas-s92-correction");
  const sealClient = await connectDisposable(connectionString, schema, "obrasaas-s92-correction-cut");
  const activityProbe = await connectDisposable(connectionString, schema, "obrasaas-s92-correction-lock-probe");
  let correctionCommitted = false;
  try {
    const current = await correction.query(
      `SELECT "approvedMeasurementId" FROM "TaskProgressMeasurementHead"
        WHERE "organizationId"=$1 AND "projectId"=$2 AND "taskId"=$3
          AND "periodStart"=$4::date AND "periodEnd"=$5::date`,
      [item.organizationId, item.projectId, item.measuredTaskId, item.periodStart, item.periodEnd],
    );
    await correction.query("BEGIN");
    const submitted = await correction.query(SUBMIT_SQL, submitArgs(
      item,
      item.measuredTaskId,
      item.evidenceAId,
      {
        periodQuantity: "25.0000",
        expectedHeadId: current.rows[0].approvedMeasurementId,
        operation: `${item.prefix}_race_correction_submit`,
        fingerprint: sha256(`${item.prefix}:race-correction-submit`),
      },
    ));
    await correction.query(REVIEW_SQL, reviewArgs(
      item,
      submitted.rows[0].measurement_id,
      submitted.rows[0].head_revision,
      {
        operation: `${item.prefix}_race_correction_review`,
        fingerprint: sha256(`${item.prefix}:race-correction-review`),
      },
    ));

    const sealOutcomePromise = sealClient.query(
      SEAL_SQL,
      sealArgs(item, candidate, {
        operation: `${item.prefix}_race_cut`, fingerprint: sha256(`${item.prefix}:race-cut`),
      }),
    ).then(
      (result) => ({ status: "fulfilled", value: result.rows[0] }),
      (reason) => ({ status: "rejected", reason }),
    );

    let observedLockWait = false;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const activity = await activityProbe.query(
        `SELECT wait_event_type
           FROM pg_stat_activity
          WHERE application_name = 'obrasaas-s92-correction-cut'
            AND pid <> pg_backend_pid()`,
      );
      if (activity.rows.some((row) => row.wait_event_type === "Lock")) {
        observedLockWait = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    await correction.query("COMMIT");
    correctionCommitted = true;
    const sealOutcome = await sealOutcomePromise;
    invariant(observedLockWait, "Correction-vs-seal probe never observed the expected PostgreSQL lock wait.");
    if (sealOutcome.status === "rejected") throw sealOutcome.reason;
    const cut = sealOutcome.value;

    const probe = await connectDisposable(connectionString, schema, "obrasaas-s92-correction-probe");
    try {
      const stored = await probe.query(
        `SELECT "candidateSha256"::text FROM "ProjectProgressMeasurementCut" WHERE "id"=$1`,
        [cut.cut_id],
      );
      invariant(stored.rows[0].candidateSha256 === candidate, "Correction-vs-seal stored a torn candidate.");
      const after = await probe.query(READ_SQL, readArgs(item));
      invariant(after.rows[0].readiness === "STALE", "Correction committed after seal did not produce a new candidate.");
    } finally {
      await probe.end();
    }
  } catch (error) {
    if (!correctionCommitted) await correction.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await activityProbe.end();
    await sealClient.end();
    await correction.end();
    await cleanupDisposableFixture(connectionString, schema, item);
  }
}

async function runDisposableArchive(connectionString, schema, item) {
  const client = await connectDisposable(connectionString, schema, "obrasaas-s92-archive");
  try {
    await client.query(`UPDATE "Project" SET "status"='ARCHIVED' WHERE "id"=$1`, [item.projectId]);
  } finally {
    await client.end();
  }
}

async function assertDisposableArchiveOrdering(connectionString, schema) {
  const { item, candidate } = await seedCommittedFixture(connectionString, schema, "archive_order");
  try {
    const outcomes = await Promise.allSettled([
      runDisposableSeal(connectionString, schema, sealArgs(item, candidate, {
        operation: `${item.prefix}_archive_cut`, fingerprint: sha256(`${item.prefix}:archive-cut`),
      }), "archive-cut"),
      runDisposableArchive(connectionString, schema, item),
    ]);
    invariant(outcomes[1].status === "fulfilled", "Archive side of archive-vs-seal race failed.");
    if (outcomes[0].status === "rejected") {
      invariant(
        String(outcomes[0].reason.message).includes("PROGRESS_MEASUREMENT_CUT_PROJECT_ARCHIVED"),
        "Archive-vs-seal loser was not controlled.",
      );
    }
    const probe = await connectDisposable(connectionString, schema, "obrasaas-s92-archive-probe");
    try {
      const state = await probe.query(
        `SELECT p."status"::text,
                (SELECT count(*)::integer FROM "ProjectProgressMeasurementCut" c
                  WHERE c."organizationId"=$1 AND c."projectId"=$2) AS cuts
           FROM "Project" p WHERE p."organizationId"=$1 AND p."id"=$2`,
        [item.organizationId, item.projectId],
      );
      invariant(state.rows[0].status === "ARCHIVED", "Archive-vs-seal final project state drifted.");
      invariant([0, 1].includes(state.rows[0].cuts), "Archive-vs-seal created duplicate cuts.");
      invariant(
        (outcomes[0].status === "fulfilled" && state.rows[0].cuts === 1)
          || (outcomes[0].status === "rejected" && state.rows[0].cuts === 0),
        "Archive-vs-seal did not linearize before or after archive.",
      );
    } finally {
      await probe.end();
    }
  } finally {
    await cleanupDisposableFixture(connectionString, schema, item);
  }
}

async function assertDisposableReplicaFailClosed(connectionString, schema) {
  const client = await connectDisposable(connectionString, schema, "obrasaas-s92-replica-fail-closed");
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL session_replication_role = 'replica'");
    const before = await client.query(
      `SELECT
         (SELECT count(*)::integer FROM "ProjectProgressMeasurementCutHead") AS heads,
         (SELECT count(*)::integer FROM "ProjectProgressMeasurementCut") AS cuts,
         (SELECT count(*)::integer FROM "ProjectProgressMeasurementCutLine") AS lines`,
    );
    await client.query("SAVEPOINT progress_measurement_cut_replica_command");
    let commandRows = [];
    try {
      const attempted = await client.query(
        `INSERT INTO "ObrasaasProgressMeasurementCutSealCommand" ("organizationId", "cutId")
         VALUES ('replica-command-must-not-run', 'replica-virtual-row-is-not-a-receipt')
         RETURNING "cutId"`,
      );
      commandRows = attempted.rows;
    } catch {
      await client.query("ROLLBACK TO SAVEPOINT progress_measurement_cut_replica_command");
    }
    await client.query("RELEASE SAVEPOINT progress_measurement_cut_replica_command");

    await client.query("SAVEPOINT progress_measurement_cut_replica_wrapper");
    let wrapperRows = [];
    try {
      const attempted = await client.query(
        `SELECT * FROM obrasaas_progress_measurement_cut_seal(
           $1,$2,$3::date,$4::date,$5,$6,$7,$8,$9
         )`,
        [
          "replica-wrapper-must-not-run",
          "replica-project-must-not-run",
          "2024-01-01",
          "2024-01-15",
          null,
          "0".repeat(64),
          "replica-wrapper-operation",
          "1".repeat(64),
          "replica-actor-must-not-run",
        ],
      );
      wrapperRows = attempted.rows;
    } catch {
      await client.query("ROLLBACK TO SAVEPOINT progress_measurement_cut_replica_wrapper");
    }
    await client.query("RELEASE SAVEPOINT progress_measurement_cut_replica_wrapper");

    const after = await client.query(
      `SELECT
         (SELECT count(*)::integer FROM "ProjectProgressMeasurementCutHead") AS heads,
         (SELECT count(*)::integer FROM "ProjectProgressMeasurementCut") AS cuts,
         (SELECT count(*)::integer FROM "ProjectProgressMeasurementCutLine") AS lines`,
    );
    assert.deepEqual(
      after.rows[0],
      before.rows[0],
      "Replica mode skipped the command trigger but still mutated Cut/Line/Head.",
    );
    invariant(
      commandRows.every((row) => row.cutId === "replica-virtual-row-is-not-a-receipt"),
      "Replica-mode command view behavior drifted away from a storage-free virtual row.",
    );
    invariant(
      wrapperRows.every((row) => row.cut_id === null),
      "Replica mode unexpectedly returned a valid public seal receipt.",
    );
    await client.query("SET LOCAL session_replication_role = 'origin'");
    const restored = await client.query("SELECT current_setting('session_replication_role') AS role");
    invariant(restored.rows[0].role === "origin", "session_replication_role was not restored after fail-closed probe.");
    await client.query("ROLLBACK");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

async function assertDisposableConcurrency(connectionString, schema) {
  await assertDisposableReplicaFailClosed(connectionString, schema);
  await assertDisposableSameKey(connectionString, schema);
  await assertDisposableMutatedKey(connectionString, schema);
  await assertDisposableTwoSealers(connectionString, schema);
  await assertDisposableCorrectionOrdering(connectionString, schema);
  await assertDisposableArchiveOrdering(connectionString, schema);
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
    application_name: "obrasaas-progress-measurement-cuts-verifier",
    statement_timeout: 55_000,
    query_timeout: 60_000,
  });
  let connected = false;
  let transactionOpen = false;
  let prefixes;
  try {
    try {
      await client.connect();
      connected = true;
    } catch {
      throw new Error("Unable to connect to the dedicated progress measurement cut verification database.");
    }
    await client.query("BEGIN");
    transactionOpen = true;
    const schemaExists = await client.query("SELECT to_regnamespace($1) IS NOT NULL AS exists", [schema]);
    invariant(schemaExists.rows[0].exists, `Configured PostgreSQL schema ${schema} does not exist.`);
    await client.query(`SET LOCAL search_path TO ${quoteIdentifier(schema)}, pg_catalog`);
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '55s'");
    await assertMigration(client, schema, local);
    await assertStructure(client, schema);
    await assertFunctionsAndTriggers(client, schema);
    const journey = await assertRollbackOnlyJourney(client);
    prefixes = [journey.prefix, journey.otherPrefix];
    await client.query("ROLLBACK");
    transactionOpen = false;
    await assertRolledBack(client, schema, prefixes);
    if (disposableConcurrency) await assertDisposableConcurrency(connectionString, schema);
    console.log(
      disposableConcurrency
        ? "Verified S9.2-MED rollback-only semantics plus exact/mutated replay, two-sealer, correction and archive PostgreSQL races with cleanup."
        : "Verified S9.2-MED rollback-only structure, DB-owned candidate/read/seal, immutable replay, scope, absence, UTC and no-financial contracts. Disposable races were not requested.",
    );
  } finally {
    if (transactionOpen) await client.query("ROLLBACK").catch(() => undefined);
    if (connected) await client.end();
  }
}

await main();
