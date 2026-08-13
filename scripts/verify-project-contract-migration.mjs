#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import pg from 'pg';

const { Client } = pg;
const MIGRATION = '20260811200000_project_contract_authority_sov';
const CONNECTION_ENV = 'PROJECT_CONTRACT_MIGRATION_DATABASE_URL';
const SCHEMA_ENV = 'PROJECT_CONTRACT_MIGRATION_SCHEMA';
const DISPOSABLE_ENV = 'PROJECT_CONTRACT_DISPOSABLE_CONCURRENCY';
const migrationPath = fileURLToPath(
  new URL(`../prisma/migrations/${MIGRATION}/migration.sql`, import.meta.url),
);
const TABLES = [
  'ProjectContractHead',
  'ProjectContractAuthorityVersion',
  'ProjectContractAuthorityDecision',
  'ProjectContractVersion',
  'ProjectContractLine',
  'ProjectContractDecision',
];
const TRIGGER_MAP = new Map([
  ['ProjectContractAuthorityVersion', [
    'ProjectContractAuthorityVersion_append_only',
    'ProjectContractAuthorityVersion_no_truncate',
  ]],
  ['ProjectContractAuthorityDecision', [
    'ProjectContractAuthorityDecision_append_only',
    'ProjectContractAuthorityDecision_no_truncate',
  ]],
  ['ProjectContractVersion', [
    'ProjectContractVersion_append_only',
    'ProjectContractVersion_no_truncate',
  ]],
  ['ProjectContractLine', [
    'ProjectContractLine_append_only',
    'ProjectContractLine_no_truncate',
  ]],
  ['ProjectContractDecision', [
    'ProjectContractDecision_append_only',
    'ProjectContractDecision_no_truncate',
  ]],
  ['ProjectContractHead', [
    'ProjectContractHead_projection_guard',
    'ProjectContractHead_no_truncate',
  ]],
  ['Task', ['Task_project_contract_scope_guard']],
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

let savepointSequence = 0;
async function expectDatabaseError(client, label, action, pattern) {
  savepointSequence += 1;
  const savepoint = quoteIdentifier(`s93_${label}_${savepointSequence}`);
  await client.query(`SAVEPOINT ${savepoint}`);
  let observed;
  try {
    await action();
  } catch (error) {
    observed = error;
  }
  await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
  await client.query(`RELEASE SAVEPOINT ${savepoint}`);
  invariant(observed, `${label} unexpectedly succeeded.`);
  assert.match(String(observed.message), pattern, `${label} returned an uncontrolled database error.`);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function quoteIdentifier(value) {
  invariant(/^[A-Za-z_][A-Za-z0-9_]*$/.test(value), 'Schema must be a PostgreSQL identifier.');
  return `"${value.replaceAll('"', '""')}"`;
}

function help() {
  return `Verify S9.3 contractual authority and Schedule of Values.

Environment:
  ${CONNECTION_ENV}   Dedicated PostgreSQL verification URL. DATABASE_URL is ignored.
  ${SCHEMA_ENV}       Schema name; defaults to public.
  ${DISPOSABLE_ENV}   0 rollback-only; 1 committed races and exact cleanup.

Disposable mode is restricted to local obrasaas_ci/public.`;
}

function configuration(environment = process.env) {
  const value = environment[CONNECTION_ENV];
  invariant(typeof value === 'string' && value === value.trim() && value.length > 0,
    `${CONNECTION_ENV} is required; DATABASE_URL is ignored.`);
  const schema = environment[SCHEMA_ENV] || 'public';
  quoteIdentifier(schema);
  const disposableValue = environment[DISPOSABLE_ENV] ?? '0';
  invariant(disposableValue === '0' || disposableValue === '1', `${DISPOSABLE_ENV} must be 0 or 1.`);
  const parsed = new URL(value);
  invariant(parsed.protocol === 'postgres:' || parsed.protocol === 'postgresql:', 'Verifier requires PostgreSQL.');
  invariant(!parsed.hash, 'PostgreSQL URL must not include a fragment.');
  parsed.searchParams.delete('schema');
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  const local = ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(hostname);
  if (!local && hostname.endsWith('.neon.tech')) parsed.searchParams.set('sslmode', 'verify-full');
  else if (!local) invariant(parsed.searchParams.get('sslmode') === 'verify-full', 'Remote verification requires sslmode=verify-full.');
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  const disposable = disposableValue === '1';
  if (disposable) invariant(local && databaseName === 'obrasaas_ci' && schema === 'public',
    `${DISPOSABLE_ENV}=1 is restricted to local obrasaas_ci/public.`);
  return { connectionString: parsed.toString(), schema, local, disposable };
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
  invariant(result.rows[0].checksum === sha256(await readFile(migrationPath, 'utf8')),
    `${MIGRATION} checksum differs from deployed ledger.`);
}

async function assertStructure(client, schema) {
  const tables = await client.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = $1 AND table_name = ANY($2::text[])`,
    [schema, TABLES],
  );
  invariant(tables.rows.length === TABLES.length, 'S9.3 contract tables are incomplete.');

  const enums = await client.query(
    `SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder)::text[] AS labels
       FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typnamespace = $1::regnamespace
        AND t.typname = ANY($2::text[])
      GROUP BY t.typname`,
    [schema, ['ProjectContractLineState', 'ProjectContractDecisionType', 'ProjectContractTechnicalBasisSnapshot']],
  );
  const enumMap = new Map(enums.rows.map((row) => [row.typname, row.labels]));
  assert.deepEqual(enumMap.get('ProjectContractLineState'), ['VALUED', 'NO_CLAIM']);
  assert.deepEqual(enumMap.get('ProjectContractDecisionType'), ['APPROVED', 'REJECTED']);
  assert.deepEqual(enumMap.get('ProjectContractTechnicalBasisSnapshot'), ['UNESTABLISHED', 'MATCHED']);

  const columns = await client.query(
    `SELECT table_name, column_name, data_type, is_nullable, numeric_precision, numeric_scale, column_default
       FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = ANY($2::text[])`,
    [schema, TABLES],
  );
  const map = new Map(columns.rows.map((row) => [`${row.table_name}.${row.column_name}`, row]));
  for (const required of [
    'ProjectContractHead.currentAuthorityVersionId',
    'ProjectContractHead.pendingAuthorityVersionId',
    'ProjectContractHead.currentVersionId',
    'ProjectContractHead.pendingVersionId',
    'ProjectContractAuthorityVersion.certifierMembershipId',
    'ProjectContractAuthorityVersion.financeMembershipId',
    'ProjectContractAuthorityVersion.registrarMembershipId',
    'ProjectContractVersion.contractReference',
    'ProjectContractVersion.counterpartyLabel',
    'ProjectContractVersion.effectiveFrom',
    'ProjectContractVersion.totalContractAmountMinor',
    'ProjectContractLine.contractAmountMinor',
    'ProjectContractLine.technicalBasisStatusAtPrepare',
  ]) invariant(map.has(required), `Missing required S9.3 column ${required}.`);
  invariant(map.get('ProjectContractLine.baseQuantity')?.numeric_precision === 18
    && map.get('ProjectContractLine.baseQuantity')?.numeric_scale === 4,
  'Contract base quantity must remain Decimal(18,4).');
  for (const explicit of ['currencyCode', 'currencyMinorUnits', 'retentionBps', 'roundingPolicyVersion', 'adjustmentPolicyVersion', 'effectiveFrom']) {
    const row = map.get(`ProjectContractVersion.${explicit}`);
    invariant(row?.is_nullable === 'NO' && row?.column_default === null, `${explicit} must be explicit without default.`);
  }

  const triggers = await client.query(
    `SELECT c.relname, t.tgname, t.tgenabled
       FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      WHERE c.relnamespace = $1::regnamespace
        AND t.tgname = ANY($2::text[])`,
    [schema, [
      'ProjectContractAuthorityVersion_append_only',
      'ProjectContractAuthorityVersion_no_truncate',
      'ProjectContractAuthorityDecision_append_only',
      'ProjectContractAuthorityDecision_no_truncate',
      'ProjectContractVersion_append_only',
      'ProjectContractVersion_no_truncate',
      'ProjectContractLine_append_only',
      'ProjectContractLine_no_truncate',
      'ProjectContractDecision_append_only',
      'ProjectContractDecision_no_truncate',
      'ProjectContractHead_projection_guard',
      'ProjectContractHead_no_truncate',
      'Task_project_contract_scope_guard',
    ]],
  );
  const expectedTriggers = [...TRIGGER_MAP.entries()].flatMap(([tableName, triggerNames]) => (
    triggerNames.map((triggerName) => `${tableName}.${triggerName}`)
  ));
  const observedTriggers = new Map(
    triggers.rows.map((row) => [`${row.relname}.${row.tgname}`, row.tgenabled]),
  );
  const invalidTriggers = expectedTriggers.filter((trigger) => observedTriggers.get(trigger) !== 'A');
  invariant(invalidTriggers.length === 0 && triggers.rows.length === expectedTriggers.length,
    `S9.3 fact/projection guards must be ENABLE ALWAYS; invalid: ${invalidTriggers.join(', ') || 'unexpected duplicate trigger rows'}.`);

  const commands = await client.query(
    `SELECT c.relname, c.relkind, t.tgenabled
       FROM pg_class c JOIN pg_trigger t ON t.tgrelid = c.oid
      WHERE c.relnamespace = $1::regnamespace
        AND c.relname = ANY($2::text[]) AND NOT t.tgisinternal`,
    [schema, [
      'ObrasaasProjectContractAuthorityPrepareCommand',
      'ObrasaasProjectContractAuthorityDecideCommand',
      'ObrasaasProjectContractPrepareCommand',
      'ObrasaasProjectContractDecideCommand',
    ]],
  );
  invariant(commands.rows.length === 4 && commands.rows.every((row) => row.relkind === 'v' && row.tgenabled === 'O'),
    'S9.3 command views must use ordinary fail-closed INSTEAD OF triggers.');

  const functions = await client.query(
    `SELECT p.proname, p.provolatile, p.prosecdef, has_function_privilege('public', p.oid, 'EXECUTE') AS public_execute
       FROM pg_proc p
      WHERE p.pronamespace = $1::regnamespace
        AND p.proname = ANY($2::text[])`,
    [schema, [
      'obrasaas_project_contract_authority_candidate',
      'obrasaas_project_contract_authority_prepare_replay',
      'obrasaas_project_contract_authority_prepare',
      'obrasaas_project_contract_authority_decide',
      'obrasaas_project_contract_sov_candidate',
      'obrasaas_project_contract_prepare_replay',
      'obrasaas_project_contract_prepare',
      'obrasaas_project_contract_decide',
      'obrasaas_project_contract_read',
      'obrasaas_project_contract_capabilities',
      'obrasaas_project_contract_authority_json',
      'obrasaas_project_contract_version_json',
      'obrasaas_project_contract_authority_prepare_worker',
      'obrasaas_project_contract_authority_decide_worker',
      'obrasaas_project_contract_prepare_worker',
      'obrasaas_project_contract_decide_worker',
    ]],
  );
  invariant(functions.rows.length === 16, 'S9.3 functions are incomplete.');
  const workers = functions.rows.filter((row) => row.proname.endsWith('_worker'));
  invariant(workers.length === 4 && workers.every((row) => row.public_execute === false),
    'S9.3 workers must not be executable by PUBLIC.');
  invariant(functions.rows.every((row) => row.prosecdef === false), 'S9.3 functions must remain SECURITY INVOKER.');
}

function ids(marker) {
  const suffix = marker.replaceAll('-', '').slice(-10);
  return {
    suffix,
    org: `s93-org-${suffix}`,
    project: `s93-project-${suffix}`,
    taskA: `s93-task-a-${suffix}`,
    taskB: `s93-task-b-${suffix}`,
    users: ['admin', 'director', 'finance', 'auditor', 'site'].map((role) => `s93-user-${role}-${suffix}`),
    memberships: ['admin', 'director', 'finance', 'auditor', 'site'].map((role) => `s93-member-${role}-${suffix}`),
  };
}

async function seed(client, fixture) {
  const [adminUser, directorUser, financeUser, auditorUser, siteUser] = fixture.users;
  const [admin, director, finance, auditor, site] = fixture.memberships;
  await client.query(
    `INSERT INTO "Organization" ("id", "name", "slug", "country", "timezone", "subscriptionPlan", "subscriptionStatus", "createdAt", "updatedAt")
     VALUES ($1, 'S9.3 verifier', $2, 'AR', 'America/Argentina/Buenos_Aires', 'ENTERPRISE', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [fixture.org, fixture.org],
  );
  await client.query(
    `INSERT INTO "PlatformUser" ("id", "clerkUserId", "primaryEmail", "systemRole", "lastSeenAt", "createdAt", "updatedAt") VALUES
       ($1,$6,$11,'TENANT_USER',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
       ($2,$7,$12,'TENANT_USER',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
       ($3,$8,$13,'TENANT_USER',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
       ($4,$9,$14,'TENANT_USER',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
       ($5,$10,$15,'TENANT_USER',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
    [adminUser, directorUser, financeUser, auditorUser, siteUser,
      `clerk-${adminUser}`, `clerk-${directorUser}`, `clerk-${financeUser}`, `clerk-${auditorUser}`, `clerk-${siteUser}`,
      `${adminUser}@example.test`, `${directorUser}@example.test`, `${financeUser}@example.test`, `${auditorUser}@example.test`, `${siteUser}@example.test`],
  );
  await client.query(
    `INSERT INTO "TenantMembership" ("id","organizationId","userId","clerkRole","tenantRole","status","createdAt","updatedAt") VALUES
       ($1,$6,$7,'org:admin','ADMIN','ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
       ($2,$6,$8,'org:member','DIRECTOR','ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
       ($3,$6,$9,'org:member','FINANCE','ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
       ($4,$6,$10,'org:member','AUDITOR','ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
       ($5,$6,$11,'org:member','SITE_MANAGER','ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
    [admin, director, finance, auditor, site, fixture.org, ...fixture.users],
  );
  await client.query(
    `INSERT INTO "Project" ("id","organizationId","name","slug","status","geofenceMeters","createdAt","updatedAt")
     VALUES ($1,$2,'S9.3 project',$1,'ACTIVE',100,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
    [fixture.project, fixture.org],
  );
  for (const [index, membership] of fixture.memberships.entries()) {
    await client.query(
      `INSERT INTO "ProjectMembership" ("id","projectId","tenantMembershipId","status","createdAt","updatedAt")
       VALUES ($1,$2,$3,'ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
      [`s93-pm-${index}-${fixture.suffix}`, fixture.project, membership],
    );
  }
  await client.query(
    `INSERT INTO "Task" ("id","projectId","code","title","type","status","progress","revision","metadata","createdAt","updatedAt") VALUES
       ($1,$3,'A','Task A','TASK','BACKLOG',0,1,'{"source":"canonical-task-v1"}'::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
       ($2,$3,'B','Task B','TASK','BACKLOG',0,2,'{"source":"canonical-task-v1"}'::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
    [fixture.taskA, fixture.taskB, fixture.project],
  );
  return { admin, director, finance, auditor, site };
}

async function assertControlledMissingTargets(client, fixture, actors) {
  const lines = [
    { taskId: fixture.taskA, state: 'VALUED', unitCode: 'M2', baseQuantity: '1.0000', contractAmountMinor: '1' },
    { taskId: fixture.taskB, state: 'NO_CLAIM', unitCode: null, baseQuantity: null, contractAmountMinor: null, noClaimReason: 'Explicit absence' },
  ];
  await expectDatabaseError(client, 'read_missing_scoped_project', () =>
    client.query(
      `SELECT "obrasaas_project_contract_read"($1,$2,$3)`,
      [fixture.org, `missing-${fixture.project}`, actors.auditor],
    ),
    /PROJECT_CONTRACT_SCOPE_INVALID/,
  );
  await expectDatabaseError(client, 'candidate_missing_head', () =>
    client.query(
      `SELECT * FROM "obrasaas_project_contract_sov_candidate"(
         $1,$2,$3,$4,$5,$6,$7::date,$8,$9,$10,$11,$12,$13::jsonb,$14
       )`,
      [fixture.org, fixture.project, `missing-authority-${fixture.suffix}`,
        'MISSING-001', 'Missing head', 'Counterparty', '2026-08-01',
        'ARS', 2, 0, 'CERT_RETENTION_HALF_UP_V1', 'NONE', JSON.stringify(lines), actors.director],
    ),
    /PROJECT_CONTRACT_SCOPE_INVALID/,
  );
  await expectDatabaseError(client, 'authority_decision_missing_head', () =>
    client.query(
      `SELECT * FROM "obrasaas_project_contract_authority_decide"(
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
       )`,
      [fixture.org, fixture.project, `missing-authority-${fixture.suffix}`, 1,
        'a'.repeat(64), 'APPROVED', 'Missing target',
        `s93-missing-authority-${fixture.suffix}`, sha256('missing-authority'), actors.director],
    ),
    /PROJECT_CONTRACT_SCOPE_INVALID/,
  );
  await expectDatabaseError(client, 'contract_decision_missing_head', () =>
    client.query(
      `SELECT * FROM "obrasaas_project_contract_decide"(
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
       )`,
      [fixture.org, fixture.project, `missing-contract-${fixture.suffix}`, 1,
        'b'.repeat(64), 'APPROVED', 'Missing target',
        `s93-missing-contract-${fixture.suffix}`, sha256('missing-contract'), actors.finance],
    ),
    /PROJECT_CONTRACT_SCOPE_INVALID/,
  );
}

async function journey(client, fixture) {
  const actors = await seed(client, fixture);
  await assertControlledMissingTargets(client, fixture, actors);
  const authorityCandidate = (await client.query(
    `SELECT * FROM "obrasaas_project_contract_authority_candidate"($1,$2,$3,$4,$5,$6)`,
    [fixture.org, fixture.project, actors.director, actors.finance, actors.admin, actors.admin],
  )).rows[0];
  invariant(authorityCandidate.readiness === 'READY' && authorityCandidate.authority_revision === 0,
    'Bootstrap authority candidate is not ready.');
  const authority = (await client.query(
    `SELECT * FROM "obrasaas_project_contract_authority_prepare"($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [fixture.org, fixture.project, null, 0, authorityCandidate.candidate_sha256,
      actors.director, actors.finance, actors.admin, `s93-auth-${fixture.suffix}`, sha256('authority-request'), actors.admin],
  )).rows[0];
  const authorityReplay = (await client.query(
    `SELECT * FROM "obrasaas_project_contract_authority_prepare"($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [fixture.org, fixture.project, null, 0, 'f'.repeat(64), actors.director, actors.finance,
      actors.admin, `s93-auth-${fixture.suffix}`, sha256('authority-request'), actors.admin],
  )).rows[0];
  invariant(authorityReplay.replayed && authorityReplay.authority_version_id === authority.authority_version_id,
    'Authority replay did not return the immutable receipt.');
  await expectDatabaseError(client, 'authority_decision_missing_pending_target', () =>
    client.query(
      `SELECT * FROM "obrasaas_project_contract_authority_decide"(
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
       )`,
      [fixture.org, fixture.project, `missing-authority-${fixture.suffix}`, 1,
        'c'.repeat(64), 'APPROVED', 'Missing pending target',
        `s93-missing-pending-authority-${fixture.suffix}`,
        sha256('missing-pending-authority'), actors.director],
    ),
    /PROJECT_CONTRACT_SCOPE_INVALID/,
  );
  await expectDatabaseError(client, 'mutated_authority_key', () =>
    client.query(
      `SELECT * FROM "obrasaas_project_contract_authority_prepare"($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [fixture.org, fixture.project, null, 0, 'f'.repeat(64), actors.director, actors.finance,
        actors.admin, `s93-auth-${fixture.suffix}`, sha256('authority-request-mutated'), actors.admin],
    ),
    /PROJECT_CONTRACT_AUTHORITY_IDEMPOTENCY_CONFLICT/,
  );
  const pendingAuthorityRead = (await client.query(
    `SELECT "obrasaas_project_contract_read"($1,$2,$3) AS data`,
    [fixture.org, fixture.project, actors.director],
  )).rows[0].data;
  invariant(pendingAuthorityRead.readiness === 'AUTHORITY_REVIEW_PENDING'
    && pendingAuthorityRead.pendingAuthority?.id === authority.authority_version_id
    && pendingAuthorityRead.capabilities?.decideAuthority?.allowed === true,
  'Assigned authority checker did not receive a DB-derived pending capability.');
  await client.query(
    `SELECT * FROM "obrasaas_project_contract_authority_decide"($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [fixture.org, fixture.project, authority.authority_version_id, 1, authority.authority_sha256,
      'APPROVED', 'Approved by assigned certifier', `s93-auth-decision-${fixture.suffix}`,
      sha256('authority-decision-request'), actors.director],
  );
  const approvedAuthorityReplay = (await client.query(
    `SELECT * FROM "obrasaas_project_contract_authority_prepare_replay"(
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
     )`,
    [fixture.org, fixture.project, null, 0, actors.director, actors.finance,
      actors.admin, `s93-auth-${fixture.suffix}`, sha256('authority-request'), actors.admin],
  )).rows[0];
  invariant(approvedAuthorityReplay?.replayed
    && approvedAuthorityReplay.authority_version_id === authority.authority_version_id,
  'Replay-first authority helper lost an approved immutable receipt.');
  await expectDatabaseError(client, 'mutated_authority_replay_helper', () =>
    client.query(
      `SELECT * FROM "obrasaas_project_contract_authority_prepare_replay"(
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
       )`,
      [fixture.org, fixture.project, null, 0, actors.director, actors.finance,
        actors.admin, `s93-auth-${fixture.suffix}`, sha256('authority-helper-mutated'), actors.admin],
    ),
    /PROJECT_CONTRACT_AUTHORITY_IDEMPOTENCY_CONFLICT/,
  );
  const authorityReadyRead = (await client.query(
    `SELECT "obrasaas_project_contract_read"($1,$2,$3) AS data`,
    [fixture.org, fixture.project, actors.director],
  )).rows[0].data;
  invariant(authorityReadyRead.readiness === 'CONTRACT_REQUIRED'
    && authorityReadyRead.capabilities?.prepareContract?.allowed === true
    && authorityReadyRead.canonicalTasks?.length === 2,
  'Assigned certifier did not receive contract preparation capability and canonical catalog.');

  const lines = [
    { taskId: fixture.taskA, state: 'VALUED', unitCode: 'M2', baseQuantity: '10.0000', contractAmountMinor: '123456' },
    { taskId: fixture.taskB, state: 'NO_CLAIM', unitCode: null, baseQuantity: null, contractAmountMinor: null, noClaimReason: 'Excluded from claim v1' },
  ];
  const candidate = (await client.query(
    `SELECT * FROM "obrasaas_project_contract_sov_candidate"(
       $1,$2,$3,$4,$5,$6,$7::date,$8,$9,$10,$11,$12,$13::jsonb,$14
     )`,
    [fixture.org, fixture.project, authority.authority_version_id, 'C-001', 'Contract', 'Counterparty',
      '2026-08-01', 'ARS', 2, 500, 'CERT_RETENTION_HALF_UP_V1', 'NONE', JSON.stringify(lines), actors.director],
  )).rows[0];
  invariant(candidate.line_count === 2 && candidate.valued_line_count === 1
    && candidate.no_claim_line_count === 1 && String(candidate.total_contract_amount_minor) === '123456',
  'SOV candidate does not preserve exact coverage and minor units.');
  const contract = (await client.query(
    `SELECT * FROM "obrasaas_project_contract_prepare"(
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::date,$12,$13,$14,$15,$16,$17::jsonb,$18,$19,$20
     )`,
    [fixture.org, fixture.project, authority.authority_version_id, 2, null, 0,
      candidate.candidate_sha256, 'C-001', 'Contract', 'Counterparty', '2026-08-01',
      'ARS', 2, 500, 'CERT_RETENTION_HALF_UP_V1', 'NONE', JSON.stringify(lines),
      `s93-contract-${fixture.suffix}`, sha256('contract-request'), actors.director],
  )).rows[0];
  await expectDatabaseError(client, 'contract_decision_missing_pending_target', () =>
    client.query(
      `SELECT * FROM "obrasaas_project_contract_decide"(
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
       )`,
      [fixture.org, fixture.project, `missing-contract-${fixture.suffix}`, 1,
        'd'.repeat(64), 'APPROVED', 'Missing pending target',
        `s93-missing-pending-contract-${fixture.suffix}`,
        sha256('missing-pending-contract'), actors.finance],
    ),
    /PROJECT_CONTRACT_SCOPE_INVALID/,
  );
  const lateTaskId = `s93-task-late-${fixture.suffix}`;
  await client.query(
    `INSERT INTO "Task" (
      "id","projectId","code","title","type","status","progress","revision",
      "metadata","createdAt","updatedAt"
    ) VALUES (
      $1,$2,'L','Late task','TASK','BACKLOG',0,1,
      '{"source":"canonical-task-v1"}'::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
    )`,
    [lateTaskId, fixture.project],
  );
  const changedTaskReplay = (await client.query(
    `SELECT * FROM "obrasaas_project_contract_prepare_replay"(
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::date,$11,$12,$13,$14,$15,$16::jsonb,$17,$18,$19
     )`,
    [fixture.org, fixture.project, authority.authority_version_id, 2, null, 0,
      'C-001', 'Contract', 'Counterparty', '2026-08-01', 'ARS', 2, 500,
      'CERT_RETENTION_HALF_UP_V1', 'NONE', JSON.stringify(lines),
      `s93-contract-${fixture.suffix}`, sha256('contract-request'), actors.director],
  )).rows[0];
  invariant(changedTaskReplay?.replayed
    && changedTaskReplay.contract_version_id === contract.contract_version_id,
  'Replay-first SOV helper lost its receipt after the canonical task set changed.');
  await expectDatabaseError(client, 'mutated_contract_replay_helper', () =>
    client.query(
      `SELECT * FROM "obrasaas_project_contract_prepare_replay"(
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::date,$11,$12,$13,$14,$15,$16::jsonb,$17,$18,$19
       )`,
      [fixture.org, fixture.project, authority.authority_version_id, 2, null, 0,
        'C-001', 'Contract', 'Counterparty', '2026-08-01', 'ARS', 2, 500,
        'CERT_RETENTION_HALF_UP_V1', 'NONE', JSON.stringify(lines),
        `s93-contract-${fixture.suffix}`, sha256('contract-helper-mutated'), actors.director],
    ),
    /PROJECT_CONTRACT_IDEMPOTENCY_CONFLICT/,
  );
  await client.query('DELETE FROM "Task" WHERE "id"=$1 AND "projectId"=$2',
    [lateTaskId, fixture.project]);
  const replay = (await client.query(
    `SELECT * FROM "obrasaas_project_contract_prepare"(
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::date,$12,$13,$14,$15,$16,$17::jsonb,$18,$19,$20
     )`,
    [fixture.org, fixture.project, authority.authority_version_id, 2, null, 0,
      'f'.repeat(64), 'C-001', 'Contract', 'Counterparty', '2026-08-01', 'ARS', 2, 500,
      'CERT_RETENTION_HALF_UP_V1', 'NONE', JSON.stringify(lines),
      `s93-contract-${fixture.suffix}`, sha256('contract-request'), actors.director],
  )).rows[0];
  invariant(replay.replayed && replay.contract_version_id === contract.contract_version_id,
    'SOV replay did not return the immutable receipt.');
  await expectDatabaseError(client, 'mutated_contract_key', () =>
    client.query(
      `SELECT * FROM "obrasaas_project_contract_prepare"(
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::date,$12,$13,$14,$15,$16,$17::jsonb,$18,$19,$20
       )`,
      [fixture.org, fixture.project, authority.authority_version_id, 2, null, 0,
        'f'.repeat(64), 'C-001', 'Contract', 'Counterparty', '2026-08-01', 'ARS', 2, 500,
        'CERT_RETENTION_HALF_UP_V1', 'NONE', JSON.stringify(lines),
        `s93-contract-${fixture.suffix}`, sha256('contract-request-mutated'), actors.director],
    ),
    /PROJECT_CONTRACT_IDEMPOTENCY_CONFLICT/,
  );
  const pendingContractRead = (await client.query(
    `SELECT "obrasaas_project_contract_read"($1,$2,$3) AS data`,
    [fixture.org, fixture.project, actors.finance],
  )).rows[0].data;
  invariant(pendingContractRead.readiness === 'CONTRACT_REVIEW_PENDING'
    && pendingContractRead.pendingContract?.id === contract.contract_version_id
    && pendingContractRead.capabilities?.decideContract?.allowed === true,
  'Assigned finance checker did not receive a DB-derived pending contract capability.');
  await client.query(
    `SELECT * FROM "obrasaas_project_contract_decide"($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [fixture.org, fixture.project, contract.contract_version_id, 1, contract.contract_sha256,
      'APPROVED', 'Approved by assigned finance authority', `s93-contract-decision-${fixture.suffix}`,
      sha256('contract-decision-request'), actors.finance],
  );
  const read = (await client.query(
    `SELECT "obrasaas_project_contract_read"($1,$2,$3) AS data`,
    [fixture.org, fixture.project, actors.auditor],
  )).rows[0].data;
  invariant(read.readiness === 'ACTIVE' && read.currentContract?.totalContractAmountMinor === '123456'
    && read.currentContract?.lines?.length === 2 && read.currentTechnicalCompatibility === 'UNESTABLISHED'
    && read.historyLimit === 20 && read.authorityHistory?.length === 1
    && read.contractHistory?.length === 1 && read.contractHistory[0]?.lines === undefined
    && read.canonicalTasks?.length === 2 && read.capabilities?.read?.allowed === true,
  'AUDITOR read model is incomplete or loses exact money/technical compatibility.');

  await expectDatabaseError(client, 'canonical_task_insert_after_approval', () =>
    client.query(
      `INSERT INTO "Task" (
        "id","projectId","code","title","type","status","progress","revision",
        "metadata","createdAt","updatedAt"
      ) VALUES (
        $1,$2,'C','Task C','TASK','BACKLOG',0,1,
        '{"source":"canonical-task-v1"}'::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
      )`,
      [`s93-task-c-${fixture.suffix}`, fixture.project],
    ),
    /PROJECT_CONTRACT_TASK_SCOPE_CHANGE_REQUIRES_CHANGE_CONTROL/,
  );
  await client.query(
    `INSERT INTO "Task" (
      "id","projectId","code","title","type","status","progress","revision",
      "metadata","createdAt","updatedAt"
    ) VALUES (
      $1,$2,'M','Non-contract milestone','MILESTONE','BACKLOG',0,1,
      '{}'::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
    )`,
    [`s93-task-m-${fixture.suffix}`, fixture.project],
  );
  await expectDatabaseError(client, 'canonical_task_conversion_after_approval', () =>
    client.query(
      `UPDATE "Task"
          SET "type"='TASK',"metadata"='{"source":"canonical-task-v1"}'::jsonb,
              "updatedAt"=CURRENT_TIMESTAMP
        WHERE "id"=$1 AND "projectId"=$2`,
      [`s93-task-m-${fixture.suffix}`, fixture.project],
    ),
    /PROJECT_CONTRACT_TASK_SCOPE_CHANGE_REQUIRES_CHANGE_CONTROL/,
  );
  await expectDatabaseError(client, 'canonical_task_demotion_after_approval', () =>
    client.query(
      `UPDATE "Task"
          SET "type"='MILESTONE',"updatedAt"=CURRENT_TIMESTAMP
        WHERE "id"=$1 AND "projectId"=$2`,
      [fixture.taskA, fixture.project],
    ),
    /PROJECT_CONTRACT_TASK_SCOPE_CHANGE_REQUIRES_CHANGE_CONTROL/,
  );
  const scopeCount = await client.query(
    `SELECT count(*)::int AS count FROM "Task"
      WHERE "projectId"=$1 AND "type"='TASK'
        AND "metadata"->>'source'='canonical-task-v1'`,
    [fixture.project],
  );
  invariant(scopeCount.rows[0].count === 2,
    'Approved full-SOV canonical task scope changed despite its change-control fence.');

  await expectDatabaseError(client, 'site_manager_read', () =>
    client.query(`SELECT "obrasaas_project_contract_read"($1,$2,$3)`, [fixture.org, fixture.project, actors.site]),
    /PROJECT_CONTRACT_READ_FORBIDDEN/,
  );
  await expectDatabaseError(client, 'currency_allowlist', () =>
    client.query(
      `SELECT * FROM "obrasaas_project_contract_sov_candidate"(
         $1,$2,$3,$4,$5,$6,$7::date,$8,$9,$10,$11,$12,$13::jsonb,$14
       )`,
      [fixture.org, fixture.project, authority.authority_version_id, 'C-001', 'Contract', 'Counterparty',
        '2026-08-01', 'EUR', 2, 500, 'CERT_RETENTION_HALF_UP_V1', 'NONE', JSON.stringify(lines), actors.director],
    ),
    /invalid explicit SOV identity, currency/,
  );

  const rotationCandidate = (await client.query(
    `SELECT * FROM "obrasaas_project_contract_authority_candidate"($1,$2,$3,$4,$5,$6)`,
    [fixture.org, fixture.project, actors.director, actors.finance, actors.admin, actors.admin],
  )).rows[0];
  const rotation = (await client.query(
    `SELECT * FROM "obrasaas_project_contract_authority_prepare"($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [fixture.org, fixture.project, authority.authority_version_id, 2,
      rotationCandidate.candidate_sha256, actors.director, actors.finance, actors.admin,
      `s93-auth-rotation-${fixture.suffix}`, sha256('authority-rotation-request'), actors.admin],
  )).rows[0];
  await client.query(
    `SELECT * FROM "obrasaas_project_contract_authority_decide"($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [fixture.org, fixture.project, rotation.authority_version_id, 3, rotation.authority_sha256,
      'APPROVED', 'Approved authority rotation', `s93-auth-rotation-decision-${fixture.suffix}`,
      sha256('authority-rotation-decision-request'), actors.director],
  );
  const postRotationAuthorityReplay = (await client.query(
    `SELECT * FROM "obrasaas_project_contract_authority_prepare_replay"(
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
     )`,
    [fixture.org, fixture.project, null, 0, actors.director, actors.finance,
      actors.admin, `s93-auth-${fixture.suffix}`, sha256('authority-request'), actors.admin],
  )).rows[0];
  const postRotationContractReplay = (await client.query(
    `SELECT * FROM "obrasaas_project_contract_prepare_replay"(
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::date,$11,$12,$13,$14,$15,$16::jsonb,$17,$18,$19
     )`,
    [fixture.org, fixture.project, authority.authority_version_id, 2, null, 0,
      'C-001', 'Contract', 'Counterparty', '2026-08-01', 'ARS', 2, 500,
      'CERT_RETENTION_HALF_UP_V1', 'NONE', JSON.stringify(lines),
      `s93-contract-${fixture.suffix}`, sha256('contract-request'), actors.director],
  )).rows[0];
  invariant(postRotationAuthorityReplay?.replayed && postRotationContractReplay?.replayed,
    'Replay-first helpers lost historical receipts after authority rotation.');
}

async function cleanup(client, fixture) {
  await client.query('BEGIN');
  try {
    for (const [table, triggerNames] of TRIGGER_MAP) {
      for (const triggerName of triggerNames) {
        await client.query(
          `ALTER TABLE ${quoteIdentifier(table)} DISABLE TRIGGER ${quoteIdentifier(triggerName)}`,
        );
      }
    }
    await client.query(
      `UPDATE "ProjectContractHead"
          SET "currentAuthorityVersionId"=NULL,
              "latestAuthorityVersionId"=NULL,
              "pendingAuthorityVersionId"=NULL,
              "currentVersionId"=NULL,
              "latestVersionId"=NULL,
              "pendingVersionId"=NULL
        WHERE "organizationId"=$1 AND "projectId"=$2`,
      [fixture.org, fixture.project],
    );
    await client.query('DELETE FROM "ProjectContractDecision" WHERE "organizationId"=$1', [fixture.org]);
    await client.query('DELETE FROM "ProjectContractLine" WHERE "organizationId"=$1', [fixture.org]);
    await client.query('DELETE FROM "ProjectContractVersion" WHERE "organizationId"=$1', [fixture.org]);
    await client.query('DELETE FROM "ProjectContractAuthorityDecision" WHERE "organizationId"=$1', [fixture.org]);
    await client.query('DELETE FROM "ProjectContractAuthorityVersion" WHERE "organizationId"=$1', [fixture.org]);
    await client.query('DELETE FROM "ProjectContractHead" WHERE "organizationId"=$1', [fixture.org]);
    await client.query('DELETE FROM "Task" WHERE "projectId"=$1', [fixture.project]);
    await client.query('DELETE FROM "ProjectMembership" WHERE "projectId"=$1', [fixture.project]);
    await client.query('DELETE FROM "TenantMembership" WHERE "organizationId"=$1', [fixture.org]);
    await client.query('DELETE FROM "PlatformUser" WHERE "id"=ANY($1::text[])', [fixture.users]);
    await client.query('DELETE FROM "Project" WHERE "id"=$1 AND "organizationId"=$2', [fixture.project, fixture.org]);
    await client.query('DELETE FROM "Organization" WHERE "id"=$1', [fixture.org]);
    const residue = await client.query(
      `SELECT
        (SELECT count(*)::int FROM "ProjectContractHead" WHERE "organizationId"=$1) AS heads,
        (SELECT count(*)::int FROM "ProjectContractAuthorityVersion" WHERE "organizationId"=$1) AS authorities,
        (SELECT count(*)::int FROM "ProjectContractAuthorityDecision" WHERE "organizationId"=$1) AS authority_decisions,
        (SELECT count(*)::int FROM "ProjectContractVersion" WHERE "organizationId"=$1) AS versions,
        (SELECT count(*)::int FROM "ProjectContractLine" WHERE "organizationId"=$1) AS lines,
        (SELECT count(*)::int FROM "ProjectContractDecision" WHERE "organizationId"=$1) AS decisions,
        (SELECT count(*)::int FROM "Task" WHERE "projectId"=$2) AS tasks,
        (SELECT count(*)::int FROM "ProjectMembership" WHERE "projectId"=$2) AS project_memberships,
        (SELECT count(*)::int FROM "TenantMembership" WHERE "organizationId"=$1) AS tenant_memberships,
        (SELECT count(*)::int FROM "Project" WHERE "id"=$2) AS projects,
        (SELECT count(*)::int FROM "Organization" WHERE "id"=$1) AS organizations`,
      [fixture.org, fixture.project],
    );
    invariant(Object.values(residue.rows[0]).every((value) => value === 0),
      'Disposable S9.3 cleanup leaked exact fixture rows.');
    for (const [table, triggerNames] of TRIGGER_MAP) {
      for (const triggerName of triggerNames) {
        await client.query(
          `ALTER TABLE ${quoteIdentifier(table)} ENABLE ALWAYS TRIGGER ${quoteIdentifier(triggerName)}`,
        );
      }
    }
    await client.query('COMMIT');
    const expected = [...TRIGGER_MAP.values()].flat();
    const restored = await client.query(
      `SELECT t.tgname,t.tgenabled
         FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
        WHERE c.relnamespace=current_schema()::regnamespace
          AND NOT t.tgisinternal AND t.tgname=ANY($1::text[])`,
      [expected],
    );
    invariant(restored.rows.length === expected.length
      && restored.rows.every((row) => row.tgenabled === 'A'),
    'Disposable cleanup did not restore every S9.3 trigger as ENABLE ALWAYS.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
}

async function connectDisposable(connectionString, schema, label) {
  const client = new Client({
    connectionString,
    application_name: `obrasaas-s93-${label}`,
    statement_timeout: 55_000,
    query_timeout: 60_000,
  });
  await client.connect();
  await client.query(`SET search_path TO ${quoteIdentifier(schema)}, public`);
  await client.query("SET lock_timeout = '10s'");
  return client;
}

async function runQuery(connectionString, schema, label, sql, args) {
  const client = await connectDisposable(connectionString, schema, label);
  try {
    return (await client.query(sql, args)).rows[0];
  } finally {
    await client.end();
  }
}

function fulfilled(results) {
  return results.filter((entry) => entry.status === 'fulfilled').map((entry) => entry.value);
}

function rejected(results) {
  return results.filter((entry) => entry.status === 'rejected').map((entry) => entry.reason);
}

async function assertDisposableReplayRaces(connectionString, schema) {
  const fixture = ids(`race-${Date.now()}-${process.pid}`);
  const seedClient = await connectDisposable(connectionString, schema, 'race-seed');
  try {
    await seedClient.query('BEGIN');
    const actors = await seed(seedClient, fixture);
    await seedClient.query('COMMIT');

    const authorityCandidate = (await seedClient.query(
      `SELECT * FROM "obrasaas_project_contract_authority_candidate"($1,$2,$3,$4,$5,$6)`,
      [fixture.org, fixture.project, actors.director, actors.finance, actors.admin, actors.admin],
    )).rows[0];
    const authoritySql = `SELECT * FROM "obrasaas_project_contract_authority_prepare"(
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
    )`;
    const authorityArgs = [fixture.org, fixture.project, null, 0, authorityCandidate.candidate_sha256,
      actors.director, actors.finance, actors.admin, `s93-race-auth-${fixture.suffix}`,
      sha256(`s93-race-auth:${fixture.suffix}`), actors.admin];
    const authorityResults = await Promise.all([
      runQuery(connectionString, schema, 'authority-same-key-a', authoritySql, authorityArgs),
      runQuery(connectionString, schema, 'authority-same-key-b', authoritySql, authorityArgs),
    ]);
    invariant(authorityResults[0].authority_version_id === authorityResults[1].authority_version_id,
      'Concurrent exact authority replay created divergent versions.');
    assert.deepEqual(authorityResults.map((row) => row.replayed).sort(), [false, true],
      'Concurrent exact authority replay flags drifted.');
    const authority = authorityResults[0];
    await seedClient.query(
      `SELECT * FROM "obrasaas_project_contract_authority_decide"($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [fixture.org, fixture.project, authority.authority_version_id, 1, authority.authority_sha256,
        'APPROVED', 'Race authority approval', `s93-race-authority-decision-${fixture.suffix}`,
        sha256(`s93-race-authority-decision:${fixture.suffix}`), actors.director],
    );

    const lines = [
      { taskId: fixture.taskA, state: 'VALUED', unitCode: 'M2', baseQuantity: '10.0000', contractAmountMinor: '9223372036854770000' },
      { taskId: fixture.taskB, state: 'NO_CLAIM', unitCode: null, baseQuantity: null, contractAmountMinor: null, noClaimReason: 'Explicit race absence' },
    ];
    const candidate = (await seedClient.query(
      `SELECT * FROM "obrasaas_project_contract_sov_candidate"(
        $1,$2,$3,$4,$5,$6,$7::date,$8,$9,$10,$11,$12,$13::jsonb,$14
      )`,
      [fixture.org, fixture.project, authority.authority_version_id, 'RACE-001', 'Race contract',
        'Race counterparty', '2026-08-01', 'USD', 2, 1000, 'CERT_RETENTION_HALF_UP_V1',
        'NONE', JSON.stringify(lines), actors.director],
    )).rows[0];
    invariant(String(candidate.total_contract_amount_minor) === '9223372036854770000',
      'Disposable race lost exact BIGINT money before prepare.');
    const prepareSql = `SELECT * FROM "obrasaas_project_contract_prepare"(
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::date,$12,$13,$14,$15,$16,$17::jsonb,$18,$19,$20
    )`;
    const prepareArgs = [fixture.org, fixture.project, authority.authority_version_id, 2, null, 0,
      candidate.candidate_sha256, 'RACE-001', 'Race contract', 'Race counterparty', '2026-08-01',
      'USD', 2, 1000, 'CERT_RETENTION_HALF_UP_V1', 'NONE', JSON.stringify(lines),
      `s93-race-contract-${fixture.suffix}`, sha256(`s93-race-contract:${fixture.suffix}`), actors.director];
    const contractResults = await Promise.all([
      runQuery(connectionString, schema, 'contract-same-key-a', prepareSql, prepareArgs),
      runQuery(connectionString, schema, 'contract-same-key-b', prepareSql, prepareArgs),
    ]);
    invariant(contractResults[0].contract_version_id === contractResults[1].contract_version_id,
      'Concurrent exact SOV replay created divergent versions.');
    assert.deepEqual(contractResults.map((row) => row.replayed).sort(), [false, true],
      'Concurrent exact SOV replay flags drifted.');
    const contract = contractResults[0];
    const decisionSql = `SELECT * FROM "obrasaas_project_contract_decide"(
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
    )`;
    const commonDecision = [fixture.org, fixture.project, contract.contract_version_id, 1,
      contract.contract_sha256, 'APPROVED', 'Race contract approval'];
    const outcomes = await Promise.allSettled([
      runQuery(connectionString, schema, 'decision-a', decisionSql,
        [...commonDecision, `s93-race-decision-a-${fixture.suffix}`,
          sha256(`s93-race-decision-a:${fixture.suffix}`), actors.finance]),
      runQuery(connectionString, schema, 'decision-b', decisionSql,
        [...commonDecision, `s93-race-decision-b-${fixture.suffix}`,
          sha256(`s93-race-decision-b:${fixture.suffix}`), actors.finance]),
    ]);
    invariant(fulfilled(outcomes).length === 1 && rejected(outcomes).length === 1,
      'Concurrent finance decisions did not select exactly one winner.');
    invariant(String(rejected(outcomes)[0]?.message).includes('PROJECT_CONTRACT_HEAD_STALE'),
      'Concurrent finance decision loser was not a controlled stale CAS.');
  } catch (error) {
    await seedClient.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await seedClient.end();
    const cleanupClient = await connectDisposable(connectionString, schema, 'cleanup');
    try { await cleanup(cleanupClient, fixture); } finally { await cleanupClient.end(); }
  }
}

async function assertDisposableTaskScopeActivationRace(connectionString, schema, mutationKind) {
  invariant(['insert', 'demote'].includes(mutationKind), 'Unknown canonical task scope race.');
  const fixture = ids(`scope-race-${mutationKind}-${Date.now()}-${process.pid}`);
  const client = await connectDisposable(connectionString, schema, 'scope-race-seed');
  try {
    await client.query('BEGIN');
    const actors = await seed(client, fixture);
    await client.query('COMMIT');
    const authorityCandidate = (await client.query(
      `SELECT * FROM "obrasaas_project_contract_authority_candidate"($1,$2,$3,$4,$5,$6)`,
      [fixture.org, fixture.project, actors.director, actors.finance, actors.admin, actors.admin],
    )).rows[0];
    const authority = (await client.query(
      `SELECT * FROM "obrasaas_project_contract_authority_prepare"(
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
      )`,
      [fixture.org, fixture.project, null, 0, authorityCandidate.candidate_sha256,
        actors.director, actors.finance, actors.admin, `s93-scope-auth-${fixture.suffix}`,
        sha256(`s93-scope-auth:${fixture.suffix}`), actors.admin],
    )).rows[0];
    await client.query(
      `SELECT * FROM "obrasaas_project_contract_authority_decide"(
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
      )`,
      [fixture.org, fixture.project, authority.authority_version_id, 1,
        authority.authority_sha256, 'APPROVED', 'Scope-race authority approval',
        `s93-scope-authority-decision-${fixture.suffix}`,
        sha256(`s93-scope-authority-decision:${fixture.suffix}`), actors.director],
    );
    const lines = [
      { taskId: fixture.taskA, state: 'VALUED', unitCode: 'M2', baseQuantity: '10.0000', contractAmountMinor: '500000' },
      { taskId: fixture.taskB, state: 'NO_CLAIM', unitCode: null, baseQuantity: null, contractAmountMinor: null, noClaimReason: 'Explicit scope-race absence' },
    ];
    const candidate = (await client.query(
      `SELECT * FROM "obrasaas_project_contract_sov_candidate"(
        $1,$2,$3,$4,$5,$6,$7::date,$8,$9,$10,$11,$12,$13::jsonb,$14
      )`,
      [fixture.org, fixture.project, authority.authority_version_id, 'SCOPE-RACE-001',
        'Scope race contract', 'Scope race counterparty', '2026-08-01', 'ARS', 2, 500,
        'CERT_RETENTION_HALF_UP_V1', 'NONE', JSON.stringify(lines), actors.director],
    )).rows[0];
    const contract = (await client.query(
      `SELECT * FROM "obrasaas_project_contract_prepare"(
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::date,$12,$13,$14,$15,$16,$17::jsonb,$18,$19,$20
      )`,
      [fixture.org, fixture.project, authority.authority_version_id, 2, null, 0,
        candidate.candidate_sha256, 'SCOPE-RACE-001', 'Scope race contract',
        'Scope race counterparty', '2026-08-01', 'ARS', 2, 500,
        'CERT_RETENTION_HALF_UP_V1', 'NONE', JSON.stringify(lines),
        `s93-scope-contract-${fixture.suffix}`,
        sha256(`s93-scope-contract:${fixture.suffix}`), actors.director],
    )).rows[0];

    const decisionSql = `SELECT * FROM "obrasaas_project_contract_decide"(
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
    )`;
    const taskSql = mutationKind === 'insert'
      ? `INSERT INTO "Task" (
          "id","projectId","code","title","type","status","progress","revision",
          "metadata","createdAt","updatedAt"
        ) VALUES (
          $1,$2,'C','Concurrent canonical Task C','TASK','BACKLOG',0,1,
          '{"source":"canonical-task-v1"}'::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
        ) RETURNING "id"`
      : `UPDATE "Task"
            SET "type"='MILESTONE',"updatedAt"=CURRENT_TIMESTAMP
          WHERE "id"=$1 AND "projectId"=$2
        RETURNING "id"`;
    const taskId = mutationKind === 'insert' ? `s93-task-c-${fixture.suffix}` : fixture.taskA;
    const outcomes = await Promise.allSettled([
      runQuery(connectionString, schema, 'scope-race-approval', decisionSql,
        [fixture.org, fixture.project, contract.contract_version_id, 1,
          contract.contract_sha256, 'APPROVED', 'Concurrent scope-race approval',
          `s93-scope-decision-${fixture.suffix}`,
          sha256(`s93-scope-decision:${fixture.suffix}`), actors.finance]),
      runQuery(connectionString, schema, 'scope-race-task', taskSql, [taskId, fixture.project]),
    ]);
    invariant(fulfilled(outcomes).length === 1 && rejected(outcomes).length === 1,
      `Contract activation versus canonical task ${mutationKind} did not select exactly one winner.`);
    const loserReason = rejected(outcomes)[0];
    const loser = String(loserReason?.message);
    const controlledBusy = loserReason?.code === '40001'
      && loser.includes('PROJECT_CONTRACT_TASK_SCOPE_BUSY');
    invariant(
      loser.includes('PROJECT_CONTRACT_TASK_SCOPE_CHANGE_REQUIRES_CHANGE_CONTROL')
        || loser.includes('PROJECT_CONTRACT_TASKS_STALE')
        || controlledBusy,
      `Contract activation versus task ${mutationKind} loser was not controlled: ${loserReason?.code} ${loser}`,
    );
    const state = (await client.query(
      `SELECT h."currentVersionId",h."pendingVersionId",
              EXISTS (SELECT 1 FROM "Task" t
                WHERE t."projectId"=$2 AND t."id"=$3
                  AND t."type"='TASK'
                  AND t."metadata"->>'source'='canonical-task-v1') AS canonical
         FROM "ProjectContractHead" h
        WHERE h."organizationId"=$1 AND h."projectId"=$2`,
      [fixture.org, fixture.project, taskId],
    )).rows[0];
    const approvalWon = outcomes[0].status === 'fulfilled';
    invariant(
      (approvalWon && state.currentVersionId === contract.contract_version_id
        && state.pendingVersionId === null
        && state.canonical === (mutationKind === 'demote'))
      || (!approvalWon && state.currentVersionId === null
        && state.pendingVersionId === contract.contract_version_id
        && state.canonical === (mutationKind === 'insert')),
      `Contract activation versus task ${mutationKind} did not linearize around the shared scope lock.`,
    );
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
    const cleanupClient = await connectDisposable(connectionString, schema, 'scope-race-cleanup');
    try { await cleanup(cleanupClient, fixture); } finally { await cleanupClient.end(); }
  }
}

async function assertDisposableRaces(connectionString, schema) {
  await assertDisposableReplayRaces(connectionString, schema);
  await assertDisposableTaskScopeActivationRace(connectionString, schema, 'insert');
  await assertDisposableTaskScopeActivationRace(connectionString, schema, 'demote');
}

async function verify() {
  const { connectionString, schema, local, disposable } = configuration();
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(`SET search_path TO ${quoteIdentifier(schema)}, public`);
    await assertMigration(client, schema, local);
    await assertStructure(client, schema);
    const fixture = ids(`verify-${Date.now()}-${process.pid}`);
    await client.query('BEGIN');
    try { await journey(client, fixture); } finally { await client.query('ROLLBACK'); }
    const rolledBack = await client.query('SELECT count(*)::int AS count FROM "Organization" WHERE "id" = $1', [fixture.org]);
    invariant(rolledBack.rows[0].count === 0, 'Rollback-only S9.3 journey persisted data.');
    if (disposable) await assertDisposableRaces(connectionString, schema);
    console.log(disposable
      ? 'Verified S9.3 rollback journey plus replay, finance and task-scope activation committed races with exact cleanup.'
      : 'Verified S9.3 authority/SOV, exact money, maker-checker, replay and roles inside rollback-only verification.');
  } finally {
    await client.end();
  }
}

export {
  assertControlledMissingTargets,
  assertDisposableRaces,
  assertStructure,
  cleanup,
  configuration,
  ids,
  journey,
  seed,
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--help')) {
    console.log(help());
  } else {
    verify().catch((error) => {
      console.error(error?.message || 'S9.3 project contract verification failed.');
      process.exitCode = 1;
    });
  }
}
