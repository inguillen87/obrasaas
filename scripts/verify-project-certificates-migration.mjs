#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import pg from 'pg';

import {
  decideProjectCertificate,
  prepareProjectCertificate,
  readProjectCertificateSnapshot,
} from '../src/lib/project-certificates.js';

const { Client } = pg;
const MIGRATION = '20260812120000_project_certificates_s10_cert';
const CONNECTION_ENV = 'PROJECT_CERTIFICATES_MIGRATION_DATABASE_URL';
const SCHEMA_ENV = 'PROJECT_CERTIFICATES_MIGRATION_SCHEMA';
const DISPOSABLE_ENV = 'PROJECT_CERTIFICATES_DISPOSABLE_CONCURRENCY';
const migrationPath = fileURLToPath(
  new URL(`../prisma/migrations/${MIGRATION}/migration.sql`, import.meta.url),
);
const TABLES = Object.freeze([
  'ProjectCertificateBook',
  'ProjectCertificatePeriodHead',
  'ProjectCertificateVersion',
  'ProjectCertificateLine',
  'ProjectCertificateDeduction',
  'ProjectCertificateDecision',
  'ProjectCertificateOperationReceipt',
]);
const FACT_TABLES = Object.freeze(TABLES.slice(2));
const TRIGGER_MAP = new Map([
  ['ProjectCertificateBook', ['ProjectCertificateBook_projection_guard', 'ProjectCertificateBook_no_truncate']],
  ['ProjectCertificatePeriodHead', ['ProjectCertificatePeriodHead_projection_guard', 'ProjectCertificatePeriodHead_no_truncate']],
  ['ProjectCertificateVersion', ['ProjectCertificateVersion_append_only', 'ProjectCertificateVersion_no_truncate']],
  ['ProjectCertificateLine', ['ProjectCertificateLine_append_only', 'ProjectCertificateLine_no_truncate']],
  ['ProjectCertificateDeduction', ['ProjectCertificateDeduction_append_only', 'ProjectCertificateDeduction_no_truncate']],
  ['ProjectCertificateDecision', ['ProjectCertificateDecision_append_only', 'ProjectCertificateDecision_no_truncate']],
  ['ProjectCertificateOperationReceipt', ['ProjectCertificateOperationReceipt_append_only', 'ProjectCertificateOperationReceipt_no_truncate']],
  ['Task', ['Task_project_contract_scope_guard']],
  ['ProjectContractAuthorityVersion', ['ProjectContractAuthorityVersion_certificate_fence']],
  ['ProjectContractAuthorityDecision', ['ProjectContractAuthorityDecision_certificate_fence']],
  ['ProjectContractVersion', ['ProjectContractVersion_certificate_fence']],
  ['ProjectContractDecision', ['ProjectContractDecision_certificate_fence']],
  ['ProjectContractHead', ['ProjectContractHead_certificate_pointer_fence']],
  ['Project', ['Project_project_certificate_archive_guard']],
  ['TenantMembership', [
    'TenantMembership_project_certificate_closer_guard',
    'TenantMembership_project_certificate_closer_delete_guard',
  ]],
  ['ProjectMembership', [
    'ProjectMembership_project_certificate_closer_guard',
    'ProjectMembership_project_certificate_closer_delete_guard',
  ]],
]);
const READ_SQL = `SELECT payload FROM "obrasaas_project_certificate_read"(
  $1::text,$2::text,$3::date,$4::text
)`;
const PREPARE_SQL = `SELECT payload FROM "obrasaas_project_certificate_prepare"(
  $1::text,$2::text,$3::date,$4::integer,$5::integer,$6::text,$7::jsonb,
  $8::text,$9::text,$10::text
)`;
const DECIDE_SQL = `SELECT payload FROM "obrasaas_project_certificate_decide"(
  $1::text,$2::text,$3::text,$4::integer,$5::integer,$6::text,$7::text,
  $8::text,$9::text,$10::text,$11::text
)`;
const SUBMIT_SQL = `SELECT * FROM "obrasaas_progress_measurement_submit"(
  $1,$2,$3,$4::date,$5::date,$6,$7::numeric,$8::numeric,$9,$10,$11::jsonb,
  $12,$13,$14,$15
)`;
const REVIEW_SQL = `SELECT * FROM "obrasaas_progress_measurement_review"(
  $1,$2,$3,$4::integer,$5,$6,$7,$8,$9
)`;
const CUT_READ_SQL = `SELECT * FROM "obrasaas_progress_measurement_cut_read"(
  $1,$2,$3::date,$4::date,$5
)`;
const CUT_SEAL_SQL = `SELECT * FROM "obrasaas_progress_measurement_cut_seal"(
  $1,$2,$3::date,$4::date,$5,$6,$7,$8,$9
)`;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function quoteIdentifier(value) {
  invariant(/^[A-Za-z_][A-Za-z0-9_$]{0,62}$/.test(value), 'Schema must be a safe PostgreSQL identifier.');
  return `"${value.replaceAll('"', '""')}"`;
}

function help() {
  return `Verify S10-CERT project certificates.

Environment:
  ${CONNECTION_ENV}   Dedicated PostgreSQL verification URL. DATABASE_URL is ignored.
  ${SCHEMA_ENV}       Explicit schema name; defaults to public.
  ${DISPOSABLE_ENV}   0 rollback-only; 1 also runs committed races and exact cleanup.

Disposable mode is restricted to local obrasaas_ci/public.`;
}

export function configuration(environment = process.env) {
  const value = String(environment[CONNECTION_ENV] || '').trim();
  invariant(value, `${CONNECTION_ENV} is required; DATABASE_URL is intentionally ignored.`);
  const schema = String(environment[SCHEMA_ENV] || 'public').trim();
  quoteIdentifier(schema);
  const disposableValue = String(environment[DISPOSABLE_ENV] ?? '0').trim();
  invariant(disposableValue === '0' || disposableValue === '1', `${DISPOSABLE_ENV} must be exactly 0 or 1.`);
  const parsed = new URL(value);
  invariant(['postgres:', 'postgresql:'].includes(parsed.protocol), `${CONNECTION_ENV} must use PostgreSQL.`);
  invariant(!parsed.hash, `${CONNECTION_ENV} cannot contain a fragment.`);
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
    invariant(parsed.searchParams.get('sslmode') === 'verify-full', 'Remote verification requires sslmode=verify-full.');
  }
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  const disposable = disposableValue === '1';
  if (disposable) {
    invariant(
      local && databaseName === 'obrasaas_ci' && schema === 'public',
      `${DISPOSABLE_ENV}=1 is restricted to local obrasaas_ci/public.`,
    );
  }
  return { connectionString: parsed.toString(), schema, local, disposable };
}

async function assertMigration(client, schema, local) {
  const ledger = await client.query('SELECT to_regclass($1) AS name', [`${schema}._prisma_migrations`]);
  if (!ledger.rows[0]?.name) {
    invariant(local, 'Remote verification requires the Prisma migration ledger.');
    return;
  }
  const result = await client.query(
    `SELECT "checksum","finished_at","rolled_back_at"
       FROM ${quoteIdentifier(schema)}."_prisma_migrations"
      WHERE "migration_name"=$1`,
    [MIGRATION],
  );
  invariant(result.rows.length === 1, `${MIGRATION} is absent or applied more than once.`);
  invariant(result.rows[0].finished_at && !result.rows[0].rolled_back_at, `${MIGRATION} is not successfully applied.`);
  invariant(result.rows[0].checksum === sha256(await readFile(migrationPath, 'utf8')),
    `${MIGRATION} checksum differs from the deployed ledger.`);
}

export async function assertStructure(client, schema) {
  const tables = await client.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema=$1 AND table_name=ANY($2::text[])`,
    [schema, TABLES],
  );
  invariant(tables.rows.length === TABLES.length, 'S10-CERT tables are incomplete.');

  const enums = await client.query(
    `SELECT t.typname,array_agg(e.enumlabel ORDER BY e.enumsortorder)::text[] labels
       FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid
      WHERE t.typnamespace=$1::regnamespace
        AND t.typname=ANY($2::text[])
      GROUP BY t.typname`,
    [schema, [
      'ProjectCertificateLineState', 'ProjectCertificateDecisionType',
      'ProjectCertificateOperationKind', 'ProjectCertificateDecisionActorBasis',
    ]],
  );
  const enumMap = new Map(enums.rows.map((row) => [row.typname, row.labels]));
  assert.deepEqual(enumMap.get('ProjectCertificateLineState'), ['VALUED', 'NO_CLAIM']);
  assert.deepEqual(enumMap.get('ProjectCertificateDecisionType'), ['APPROVED', 'REJECTED', 'CANCELLED']);
  assert.deepEqual(enumMap.get('ProjectCertificateOperationKind'), ['PREPARE', 'APPROVE', 'REJECT', 'CANCEL']);
  assert.deepEqual(enumMap.get('ProjectCertificateDecisionActorBasis'), [
    'EXACT_CERTIFIER', 'EXACT_REGISTRAR', 'FALLBACK_PROJECT_ADMIN',
  ]);

  const functions = await client.query(
    `SELECT p.proname,p.provolatile,p.prosecdef,
            has_function_privilege('public',p.oid,'EXECUTE') public_execute
       FROM pg_proc p
      WHERE p.pronamespace=$1::regnamespace
        AND p.proname=ANY($2::text[])`,
    [schema, [
      'obrasaas_project_certificate_read',
      'obrasaas_project_certificate_prepare',
      'obrasaas_project_certificate_decide',
      'obrasaas_project_certificate_prepare_worker',
      'obrasaas_project_certificate_decide_worker',
      'obrasaas_project_certificate_build_candidate',
      'obrasaas_project_certificate_canonical_blockers',
    ]],
  );
  invariant(functions.rows.length === 7, 'S10-CERT public facade/private worker set is incomplete.');
  invariant(functions.rows.every((row) => row.prosecdef === false), 'S10-CERT functions must remain SECURITY INVOKER.');
  const workers = functions.rows.filter((row) => row.proname.endsWith('_worker'));
  invariant(workers.length === 2 && workers.every((row) => row.public_execute === false),
    'S10-CERT workers must not be executable by PUBLIC.');

  const commandViews = await client.query(
    `SELECT c.relname,c.relkind,t.tgenabled
       FROM pg_class c JOIN pg_trigger t ON t.tgrelid=c.oid
      WHERE c.relnamespace=$1::regnamespace AND NOT t.tgisinternal
        AND c.relname=ANY($2::text[])`,
    [schema, ['ObrasaasProjectCertificatePrepareCommand', 'ObrasaasProjectCertificateDecideCommand']],
  );
  invariant(commandViews.rows.length === 2
    && commandViews.rows.every((row) => row.relkind === 'v' && row.tgenabled === 'O'),
  'S10-CERT command views require ordinary fail-closed INSTEAD OF triggers.');

  const guardedTables = await client.query(
    `SELECT c.relname,t.tgname,t.tgenabled
       FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      WHERE c.relnamespace=$1::regnamespace AND NOT t.tgisinternal
        AND c.relname=ANY($2::text[])`,
    [schema, [...TRIGGER_MAP.keys()]],
  );
  const observedTriggers = new Map(
    guardedTables.rows.map((row) => [`${row.relname}.${row.tgname}`, row.tgenabled]),
  );
  for (const [table, names] of TRIGGER_MAP) {
    for (const name of names) {
      invariant(observedTriggers.get(`${table}.${name}`) === 'A',
        `${table}.${name} must exist and remain ENABLE ALWAYS.`);
    }
  }

  const receiptUnique = await client.query(
    `SELECT pg_get_indexdef(i.indexrelid) definition
       FROM pg_index i JOIN pg_class t ON t.oid=i.indrelid
      WHERE t.relnamespace=$1::regnamespace
        AND t.relname='ProjectCertificateOperationReceipt' AND i.indisunique`,
    [schema],
  );
  invariant(receiptUnique.rows.some((row) => row.definition.includes('"organizationId", "operationKeyHash"')),
    'OperationReceipt must enforce the common cross-kind organization operation key.');
}

export function fixture(marker = randomUUID().replaceAll('-', '')) {
  const suffix = marker.slice(-12).toLowerCase();
  const prefix = `s10_${suffix}`;
  return {
    prefix,
    organizationId: `${prefix}_org`,
    projectId: `${prefix}_project`,
    taskId: `${prefix}_task`,
    missingTaskId: `${prefix}_task_no_claim`,
    evidenceId: `${prefix}_evidence`,
    nextEvidenceId: `${prefix}_evidence_next`,
    correctionEvidenceId: `${prefix}_evidence_next_correction`,
    // A fixed closed fortnight keeps the verifier independent of wall-clock
    // time while still exercising the exact tenant-local civil-period guard.
    periodStart: '2020-01-01',
    periodEnd: '2020-01-15',
    nextPeriodStart: '2020-01-16',
    nextPeriodEnd: '2020-01-31',
    users: Object.fromEntries(['site', 'director', 'finance', 'admin', 'auditor'].map(
      (role) => [role, `${prefix}_${role}_user`],
    )),
    memberships: Object.fromEntries(['site', 'director', 'finance', 'admin', 'auditor'].map(
      (role) => [role, `${prefix}_${role}_member`],
    )),
    secondSiteUserId: `${prefix}_site_b_user`,
    secondSiteMembershipId: `${prefix}_site_b_member`,
  };
}

export async function seed(client, item) {
  await client.query(
    `INSERT INTO "Organization"(
       "id","name","slug","country","timezone","subscriptionPlan","subscriptionStatus","createdAt","updatedAt"
     ) VALUES ($1,'S10 certificate verifier',$2,'AR','America/Argentina/Buenos_Aires','ENTERPRISE','ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
    [item.organizationId, `${item.prefix}-org`],
  );
  const roles = ['site', 'director', 'finance', 'admin', 'auditor'];
  for (const role of roles) {
    await client.query(
      `INSERT INTO "PlatformUser"(
         "id","clerkUserId","primaryEmail","systemRole","lastSeenAt","createdAt","updatedAt"
       ) VALUES ($1,$2,$3,'TENANT_USER',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
      [item.users[role], `${item.prefix}_${role}_clerk`, `${item.prefix}_${role}@example.invalid`],
    );
  }
  await client.query(
    `INSERT INTO "PlatformUser"(
       "id","clerkUserId","primaryEmail","systemRole","lastSeenAt","createdAt","updatedAt"
     ) VALUES ($1,$2,$3,'TENANT_USER',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
    [item.secondSiteUserId, `${item.prefix}_site_b_clerk`, `${item.prefix}_site_b@example.invalid`],
  );
  const tenantRoles = { site: 'SITE_MANAGER', director: 'DIRECTOR', finance: 'FINANCE', admin: 'ADMIN', auditor: 'AUDITOR' };
  for (const role of roles) {
    await client.query(
      `INSERT INTO "TenantMembership"(
         "id","organizationId","userId","clerkRole","tenantRole","status","createdAt","updatedAt"
       ) VALUES ($1,$2,$3,$4,$5::"TenantRole",'ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
      [item.memberships[role], item.organizationId, item.users[role],
        role === 'admin' || role === 'director' ? 'org:admin' : 'org:member', tenantRoles[role]],
    );
  }
  await client.query(
    `INSERT INTO "TenantMembership"(
       "id","organizationId","userId","clerkRole","tenantRole","status","createdAt","updatedAt"
     ) VALUES ($1,$2,$3,'org:member','SITE_MANAGER','ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
    [item.secondSiteMembershipId, item.organizationId, item.secondSiteUserId],
  );
  await client.query(
    `INSERT INTO "Project"(
       "id","organizationId","name","slug","status","geofenceMeters","createdAt","updatedAt"
     ) VALUES ($1,$2,'S10 certificate verifier project',$3,'ACTIVE',100,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
    [item.projectId, item.organizationId, `${item.prefix}-project`],
  );
  for (const [index, role] of roles.entries()) {
    await client.query(
      `INSERT INTO "ProjectMembership"(
         "id","projectId","tenantMembershipId","status","createdAt","updatedAt"
       ) VALUES ($1,$2,$3,'ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
      [`${item.prefix}_pm_${index}`, item.projectId, item.memberships[role]],
    );
  }
  await client.query(
    `INSERT INTO "ProjectMembership"(
       "id","projectId","tenantMembershipId","status","createdAt","updatedAt"
     ) VALUES ($1,$2,$3,'ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
    [`${item.prefix}_pm_site_b`, item.projectId, item.secondSiteMembershipId],
  );
  await client.query(
    `INSERT INTO "Task"(
       "id","projectId","code","title","type","status","progress","revision","metadata","createdAt","updatedAt"
     ) VALUES
       ($1,$3,'CERT-A','Measured certificate task','TASK','IN_PROGRESS',30,1,
        '{"source":"canonical-task-v1"}'::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
       ($2,$3,'CERT-B','Explicit no-claim task','TASK','READY',0,1,
        '{"source":"canonical-task-v1"}'::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
    [item.taskId, item.missingTaskId, item.projectId],
  );
  await client.query(
    `INSERT INTO "ProgressEvidence"(
       "id","projectId","taskId","capturedAt","media","status","revision","createdAt","updatedAt"
     ) VALUES
       ($1,$2,$3,CURRENT_TIMESTAMP,'{"kind":"PHOTO","url":"s10-initial"}'::jsonb,'APPROVED',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
       ($4,$2,$3,CURRENT_TIMESTAMP,'{"kind":"PHOTO","url":"s10-next"}'::jsonb,'APPROVED',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
       ($5,$2,$3,CURRENT_TIMESTAMP,'{"kind":"PHOTO","url":"s10-next-correction"}'::jsonb,'APPROVED',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
    [item.evidenceId, item.projectId, item.taskId, item.nextEvidenceId, item.correctionEvidenceId],
  );
}

async function expectDatabaseError(client, label, marker, action) {
  const savepoint = quoteIdentifier(`s10_${label.replace(/[^A-Za-z0-9_]/g, '_').slice(0, 32)}`);
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
  assert.match(String(observed.message), marker, `${label} leaked an uncontrolled database error.`);
  return observed;
}

async function expectAppError(client, label, code, action) {
  const savepoint = quoteIdentifier(`s10_app_${label.replace(/[^A-Za-z0-9_]/g, '_').slice(0, 28)}`);
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
  invariant(observed.code === code, `${label} mapped to ${observed.code || 'no code'} instead of ${code}.`);
}

function appAdapter(client) {
  return Object.freeze({
    async read(command) {
      return (await client.query(READ_SQL, [
        command.organizationId, command.projectId, command.period.start, command.actorMembershipId,
      ])).rows;
    },
    async prepare(command) {
      return (await client.query(PREPARE_SQL, [
        command.organizationId, command.projectId, command.period.start,
        command.expectedBookRevision, command.expectedPeriodHeadRevision,
        command.expectedCurrentApprovedVersionId, JSON.stringify(command.deductions),
        command.operationKey, command.requestFingerprint, command.actorMembershipId,
      ])).rows;
    },
    async decide(command) {
      return (await client.query(DECIDE_SQL, [
        command.organizationId, command.projectId, command.certificateVersionId,
        command.expectedBookRevision, command.expectedPeriodHeadRevision,
        command.expectedCertificateDigest, command.decision, command.reason,
        command.operationKey, command.requestFingerprint, command.actorMembershipId,
      ])).rows;
    },
  });
}

function scope(item) {
  return { organizationId: item.organizationId, projectId: item.projectId };
}

async function submitAndApproveMeasurement(client, item, {
  periodQuantity = '30.0000', evidenceId = item.evidenceId,
  expectedHeadMeasurementId = null, operationSuffix = 'initial',
  periodStart = item.periodStart, periodEnd = item.periodEnd,
} = {}) {
  const submitted = (await client.query(SUBMIT_SQL, [
    item.organizationId, item.projectId, item.taskId, periodStart, periodEnd,
    'M2', '100.0000', periodQuantity, 'DIRECT_COUNT',
    `S10 ${operationSuffix} technical measurement.`, JSON.stringify([evidenceId]),
    expectedHeadMeasurementId, `${item.prefix}_measurement_${operationSuffix}`,
    sha256(`${item.prefix}:measurement:${operationSuffix}`), item.memberships.site,
  ])).rows[0];
  await client.query(REVIEW_SQL, [
    item.organizationId, item.projectId, submitted.measurement_id, submitted.head_revision,
    'APPROVED', `Approved S10 ${operationSuffix} measurement.`,
    `${item.prefix}_measurement_review_${operationSuffix}`,
    sha256(`${item.prefix}:measurement-review:${operationSuffix}`), item.memberships.director,
  ]);
  return submitted.measurement_id;
}

async function sealCurrentCut(client, item, {
  expectedHeadCutId = null, suffix = 'initial',
  periodStart = item.periodStart, periodEnd = item.periodEnd,
} = {}) {
  const candidate = (await client.query(CUT_READ_SQL, [
    item.organizationId, item.projectId, periodStart, periodEnd, item.memberships.director,
  ])).rows[0];
  invariant(['READY', 'STALE'].includes(candidate.readiness),
    `S9.2 ${suffix} cut candidate is neither READY nor an explicit correction STALE state.`);
  return (await client.query(CUT_SEAL_SQL, [
    item.organizationId, item.projectId, periodStart, periodEnd,
    expectedHeadCutId, candidate.candidate_sha256, `${item.prefix}_cut_${suffix}`,
    sha256(`${item.prefix}:cut:${suffix}`), item.memberships.director,
  ])).rows[0];
}

async function approveAuthorityAndContract(client, item) {
  const authorityCandidate = (await client.query(
    `SELECT * FROM "obrasaas_project_contract_authority_candidate"($1,$2,$3,$4,$5,$6)`,
    [item.organizationId, item.projectId, item.memberships.director,
      item.memberships.finance, item.memberships.admin, item.memberships.admin],
  )).rows[0];
  invariant(authorityCandidate.readiness === 'READY', 'S9.3 authority candidate is not READY.');
  const authority = (await client.query(
    `SELECT * FROM "obrasaas_project_contract_authority_prepare"(
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
     )`,
    [item.organizationId, item.projectId, null, 0, authorityCandidate.candidate_sha256,
      item.memberships.director, item.memberships.finance, item.memberships.admin,
      `${item.prefix}_authority_prepare`, sha256(`${item.prefix}:authority-prepare`), item.memberships.admin],
  )).rows[0];
  await client.query(
    `SELECT * FROM "obrasaas_project_contract_authority_decide"(
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
     )`,
    [item.organizationId, item.projectId, authority.authority_version_id, 1,
      authority.authority_sha256, 'APPROVED', 'Approved S10 certificate authority.',
      `${item.prefix}_authority_approve`, sha256(`${item.prefix}:authority-approve`), item.memberships.director],
  );
  const lines = [
    {
      taskId: item.taskId,
      state: 'VALUED',
      unitCode: 'M2',
      baseQuantity: '100.0000',
      contractAmountMinor: '1000000',
    },
    {
      taskId: item.missingTaskId,
      state: 'NO_CLAIM',
      unitCode: null,
      baseQuantity: null,
      contractAmountMinor: null,
      noClaimReason: 'Explicitly outside the certified claim.',
    },
  ];
  const candidate = (await client.query(
    `SELECT * FROM "obrasaas_project_contract_sov_candidate"(
       $1,$2,$3,$4,$5,$6,$7::date,$8,$9,$10,$11,$12,$13::jsonb,$14
     )`,
    [item.organizationId, item.projectId, authority.authority_version_id,
      'CERT-CONTRACT-001', 'Certificate contract', 'Certificate counterparty',
      item.periodStart, 'ARS', 2, 500, 'CERT_RETENTION_HALF_UP_V1', 'NONE',
      JSON.stringify(lines), item.memberships.director],
  )).rows[0];
  const contract = (await client.query(
    `SELECT * FROM "obrasaas_project_contract_prepare"(
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::date,$12,$13,$14,$15,$16,$17::jsonb,$18,$19,$20
     )`,
    [item.organizationId, item.projectId, authority.authority_version_id, 2, null, 0,
      candidate.candidate_sha256, 'CERT-CONTRACT-001', 'Certificate contract',
      'Certificate counterparty', item.periodStart, 'ARS', 2, 500,
      'CERT_RETENTION_HALF_UP_V1', 'NONE', JSON.stringify(lines),
      `${item.prefix}_contract_prepare`, sha256(`${item.prefix}:contract-prepare`), item.memberships.director],
  )).rows[0];
  await client.query(
    `SELECT * FROM "obrasaas_project_contract_decide"(
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
     )`,
    [item.organizationId, item.projectId, contract.contract_version_id, 1,
      contract.contract_sha256, 'APPROVED', 'Approved S10 certificate contract.',
      `${item.prefix}_contract_approve`, sha256(`${item.prefix}:contract-approve`), item.memberships.finance],
  );
  return { authority, contract };
}

async function readSnapshot(client, item, actorMembershipId = item.memberships.site, {
  periodStart = item.periodStart, periodEnd = item.periodEnd,
} = {}) {
  return readProjectCertificateSnapshot(null, {
    scope: scope(item), actorMembershipId,
    query: { period: { start: periodStart, end: periodEnd } },
  }, { sqlAdapter: appAdapter(client) });
}

async function prepareCertificate(client, item, snapshot, {
  suffix, deductions = [], operationKey = `${item.prefix}_certificate_prepare_${suffix}`,
} = {}) {
  return prepareProjectCertificate(null, {
    scope: scope(item), actorMembershipId: item.memberships.site, operationKey,
    input: {
      periodDate: snapshot.requestedPeriod.start,
      expectedBookRevision: snapshot.book?.revision ?? 0,
      expectedPeriodHeadRevision: snapshot.periodHead?.revision ?? 0,
      expectedCurrentApprovedVersionId: snapshot.periodHead?.currentApprovedVersionId ?? null,
      deductions,
    },
  }, { sqlAdapter: appAdapter(client) });
}

async function decideCertificate(client, item, prepared, decision, suffix) {
  return decideProjectCertificate(null, {
    scope: scope(item), actorMembershipId: item.memberships.director,
    certificateVersionId: prepared.certificate.id,
    operationKey: `${item.prefix}_certificate_${decision.toLowerCase()}_${suffix}`,
    input: {
      expectedBookRevision: prepared.book.revision,
      expectedPeriodHeadRevision: prepared.periodHead.revision,
      expectedCertificateDigest: prepared.certificate.integrityDigest,
      decision,
      reason: `${decision} S10 certificate during governed verification.`,
    },
  }, { sqlAdapter: appAdapter(client) });
}

export async function journey(client, item) {
  await seed(client, item);
  const firstMeasurementId = await submitAndApproveMeasurement(client, item);
  const firstCut = await sealCurrentCut(client, item);
  await approveAuthorityAndContract(client, item);

  const initial = await readSnapshot(client, item);
  const noClaim = initial.candidate?.lines?.find((line) => line.state === 'NO_CLAIM');
  invariant(initial.readiness.state === 'READY' && initial.readiness.mode === 'FIRST',
    'S10 initial app-serialized snapshot is not FIRST/READY.');
  invariant(initial.candidate?.lines?.length === 2
    && initial.candidate.lines.some((line) => line.state === 'VALUED' && line.cutState === 'MEASURED')
    && noClaim?.cutState === 'MISSING'
    && [
      noClaim.unitCode, noClaim.baseQuantity, noClaim.periodQuantity,
      noClaim.cumulativeQuantity, noClaim.technicalCumulativeOriginPeriodStart,
      noClaim.previousApprovedCumulativeGrossMinor, noClaim.cumulativeGrossMinor,
      noClaim.certificateIncrementGrossMinor,
    ].every((value) => value === null)
    && noClaim.noClaimReason === 'Explicitly outside the certified claim.',
  'S10 READY candidate lost VALUED/MEASURED or explicit NO_CLAIM/MISSING coverage.');

  const canonical = (await client.query(
    `SELECT "obrasaas_project_certificate_canonical_blockers"($1::jsonb) blockers`,
    [JSON.stringify([
      'CERT_AMOUNT_OVERFLOW', 'CERT_TECHNICAL_CUT_REQUIRED',
      'CERT_AMOUNT_OVERFLOW', 'CERT_PENDING_REVIEW',
    ])],
  )).rows[0].blockers;
  assert.deepEqual(canonical, [
    'CERT_PENDING_REVIEW', 'CERT_TECHNICAL_CUT_REQUIRED', 'CERT_AMOUNT_OVERFLOW',
  ], 'Blocker canonicalization did not deduplicate and apply the frozen priority order.');
  await expectDatabaseError(client, 'unknown_blocker', /PROJECT_CERTIFICATE_BLOCKER_INVALID/, () =>
    client.query(
      `SELECT "obrasaas_project_certificate_canonical_blockers"($1::jsonb)`,
      [JSON.stringify(['CERT_UNKNOWN_INTERNAL_DRIFT'])],
    ));

  const beforeMalformed = await client.query(
    `SELECT
       (SELECT count(*)::int FROM "ProjectCertificateBook" WHERE "organizationId"=$1) books,
       (SELECT count(*)::int FROM "ProjectCertificatePeriodHead" WHERE "organizationId"=$1) heads,
       (SELECT count(*)::int FROM "ProjectCertificateVersion" WHERE "organizationId"=$1) versions,
       (SELECT count(*)::int FROM "ProjectCertificateLine" WHERE "organizationId"=$1) lines,
       (SELECT count(*)::int FROM "ProjectCertificateDeduction" WHERE "organizationId"=$1) deductions,
       (SELECT count(*)::int FROM "ProjectCertificateDecision" WHERE "organizationId"=$1) decisions,
       (SELECT count(*)::int FROM "ProjectCertificateOperationReceipt" WHERE "organizationId"=$1) receipts,
       (SELECT "revision" FROM "ProjectCertificateBook"
         WHERE "organizationId"=$1 AND "projectId"=$2) book_revision,
       (SELECT "revision" FROM "ProjectCertificatePeriodHead"
         WHERE "organizationId"=$1 AND "projectId"=$2
           AND "periodStart"=$3::date AND "periodEnd"=$4::date) head_revision`,
    [item.organizationId, item.projectId, item.periodStart, item.periodEnd],
  );
  await expectDatabaseError(client, 'malformed_deduction', /PROJECT_CERTIFICATE_DEDUCTIONS_INVALID/, () =>
    client.query(PREPARE_SQL, [
      item.organizationId, item.projectId, item.periodStart, 0, 0, null,
      JSON.stringify([{ code: 'BAD', reason: 'Malformed amount.', amountMinor: 'x' }]),
      `${item.prefix}_malformed_deduction`, sha256(`${item.prefix}:malformed-deduction`), item.memberships.site,
    ]));
  await expectDatabaseError(client, 'deduction_amount_overflow', /PROJECT_CERTIFICATE_AMOUNT_OVERFLOW/, () =>
    client.query(PREPARE_SQL, prepareArgs(item, initial, {
      operationKey: `${item.prefix}_deduction_amount_overflow`,
      fingerprintValue: sha256(`${item.prefix}:deduction-amount-overflow`),
      deductions: [
        { code: 'OVERFLOW_A', reason: 'Overflow half A.', amountMinor: '9223372036854775807' },
        { code: 'OVERFLOW_B', reason: 'Overflow half B.', amountMinor: '9223372036854775807' },
      ],
    })));
  const netNegativeAmount = (
    BigInt(initial.candidate.totals.certificateIncrementGrossMinor)
      - BigInt(initial.candidate.totals.certificateIncrementRetentionMinor) + 1n
  ).toString();
  await expectDatabaseError(client, 'deduction_net_negative', /PROJECT_CERTIFICATE_NET_NEGATIVE/, () =>
    client.query(PREPARE_SQL, prepareArgs(item, initial, {
      operationKey: `${item.prefix}_deduction_net_negative`,
      fingerprintValue: sha256(`${item.prefix}:deduction-net-negative`),
      deductions: [{
        code: 'NET_NEGATIVE', reason: 'Exceeds the available certificate increment.',
        amountMinor: netNegativeAmount,
      }],
    })));
  const afterMalformed = await client.query(
    `SELECT
       (SELECT count(*)::int FROM "ProjectCertificateBook" WHERE "organizationId"=$1) books,
       (SELECT count(*)::int FROM "ProjectCertificatePeriodHead" WHERE "organizationId"=$1) heads,
       (SELECT count(*)::int FROM "ProjectCertificateVersion" WHERE "organizationId"=$1) versions,
       (SELECT count(*)::int FROM "ProjectCertificateLine" WHERE "organizationId"=$1) lines,
       (SELECT count(*)::int FROM "ProjectCertificateDeduction" WHERE "organizationId"=$1) deductions,
       (SELECT count(*)::int FROM "ProjectCertificateDecision" WHERE "organizationId"=$1) decisions,
       (SELECT count(*)::int FROM "ProjectCertificateOperationReceipt" WHERE "organizationId"=$1) receipts,
       (SELECT "revision" FROM "ProjectCertificateBook"
         WHERE "organizationId"=$1 AND "projectId"=$2) book_revision,
       (SELECT "revision" FROM "ProjectCertificatePeriodHead"
         WHERE "organizationId"=$1 AND "projectId"=$2
           AND "periodStart"=$3::date AND "periodEnd"=$4::date) head_revision`,
    [item.organizationId, item.projectId, item.periodStart, item.periodEnd],
  );
  assert.deepEqual(afterMalformed.rows[0], beforeMalformed.rows[0],
    'Rejected malformed/overflow/net-negative deductions left certificate facts or projections.');

  const deductions = [{ code: 'ADVANCE', reason: 'Contractual advance recovery.', amountMinor: '1000' }];
  const firstPrepared = await prepareCertificate(client, item, initial, { suffix: 'first', deductions });
  invariant(firstPrepared.receipt.replayed === false
    && firstPrepared.receipt.actorMembershipId === item.memberships.site
    && firstPrepared.certificate.deductionCount === 1
    && firstPrepared.certificate.totals.certificateIncrementDeductionsMinor === '1000',
  'First PREPARE failed app serialization or exact deduction totals.');
  const exactReplay = await prepareCertificate(client, item, initial, { suffix: 'first', deductions });
  invariant(exactReplay.receipt.replayed === true
    && exactReplay.receipt.operationReceiptId === firstPrepared.receipt.operationReceiptId,
  'Exact PREPARE replay did not return the immutable receipt.');
  await expectAppError(client, 'mutated_prepare_key', 'PROJECT_CERTIFICATE_IDEMPOTENCY_CONFLICT', () =>
    prepareCertificate(client, item, initial, {
      suffix: 'first', deductions: [{ ...deductions[0], amountMinor: '1001' }],
    }));
  const beforeCrossKind = (await client.query(
    `SELECT
      (SELECT count(*)::int FROM "ProjectCertificateDecision"
        WHERE "organizationId"=$1 AND "certificateVersionId"=$2) decisions,
      (SELECT count(*)::int FROM "ProjectCertificateOperationReceipt"
        WHERE "organizationId"=$1 AND "certificateVersionId"=$2) receipts,
      (SELECT "revision" FROM "ProjectCertificateBook"
        WHERE "organizationId"=$1 AND "projectId"=$3) book_revision,
      (SELECT "pendingCertificateVersionId" FROM "ProjectCertificateBook"
        WHERE "organizationId"=$1 AND "projectId"=$3) pending,
      (SELECT "latestApprovedCertificateVersionId" FROM "ProjectCertificateBook"
        WHERE "organizationId"=$1 AND "projectId"=$3) book_approved,
      (SELECT "revision" FROM "ProjectCertificatePeriodHead"
        WHERE "organizationId"=$1 AND "projectId"=$3) head_revision,
      (SELECT "currentApprovedVersionId" FROM "ProjectCertificatePeriodHead"
        WHERE "organizationId"=$1 AND "projectId"=$3) head_approved,
      (SELECT "latestVersionId" FROM "ProjectCertificatePeriodHead"
        WHERE "organizationId"=$1 AND "projectId"=$3) head_latest`,
    [item.organizationId, firstPrepared.certificate.id, item.projectId],
  )).rows[0];
  invariant(beforeCrossKind.decisions === 0 && beforeCrossKind.receipts === 1
    && beforeCrossKind.book_revision === 1 && beforeCrossKind.head_revision === 1
    && beforeCrossKind.pending === firstPrepared.certificate.id
    && beforeCrossKind.book_approved === null && beforeCrossKind.head_approved === null
    && beforeCrossKind.head_latest === firstPrepared.certificate.id,
  'Rollback journey cross-kind fixture did not start at the exact PREPARE projection.');
  await expectDatabaseError(client, 'prepare_key_reused_for_decide',
    /PROJECT_CERTIFICATE_IDEMPOTENCY_CONFLICT/, () =>
      client.query(DECIDE_SQL, decisionArgs(item, firstPrepared, {
        decision: 'APPROVE',
        operationKey: `${item.prefix}_certificate_prepare_first`,
        fingerprintValue: sha256(`${item.prefix}:prepare-key-reused-for-approve`),
      })));
  const afterCrossKind = (await client.query(
    `SELECT
      (SELECT count(*)::int FROM "ProjectCertificateDecision"
        WHERE "organizationId"=$1 AND "certificateVersionId"=$2) decisions,
      (SELECT count(*)::int FROM "ProjectCertificateOperationReceipt"
        WHERE "organizationId"=$1 AND "certificateVersionId"=$2) receipts,
      (SELECT "revision" FROM "ProjectCertificateBook"
        WHERE "organizationId"=$1 AND "projectId"=$3) book_revision,
      (SELECT "pendingCertificateVersionId" FROM "ProjectCertificateBook"
        WHERE "organizationId"=$1 AND "projectId"=$3) pending,
      (SELECT "latestApprovedCertificateVersionId" FROM "ProjectCertificateBook"
        WHERE "organizationId"=$1 AND "projectId"=$3) book_approved,
      (SELECT "revision" FROM "ProjectCertificatePeriodHead"
        WHERE "organizationId"=$1 AND "projectId"=$3) head_revision,
      (SELECT "currentApprovedVersionId" FROM "ProjectCertificatePeriodHead"
        WHERE "organizationId"=$1 AND "projectId"=$3) head_approved,
      (SELECT "latestVersionId" FROM "ProjectCertificatePeriodHead"
        WHERE "organizationId"=$1 AND "projectId"=$3) head_latest`,
    [item.organizationId, firstPrepared.certificate.id, item.projectId],
  )).rows[0];
  assert.deepEqual(afterCrossKind, beforeCrossKind,
    'PREPARE-to-DECIDE operation-key conflict changed a fact, pointer, or revision.');

  // Make the pending version technically stale, then reseal. GET must expose
  // the exact same freshness verdict as APPROVE while keeping REJECT available.
  const staleMeasurementId = await submitAndApproveMeasurement(client, item, {
    periodQuantity: '31.0000', evidenceId: item.evidenceId,
    expectedHeadMeasurementId: firstMeasurementId, operationSuffix: 'pending-stale',
  });
  invariant(staleMeasurementId !== firstMeasurementId,
    'Pending-stale fixture did not append its S9.1 correction.');
  const staleCut = await sealCurrentCut(client, item, {
    expectedHeadCutId: firstCut.cut_id, suffix: 'pending-stale',
  });
  invariant(staleCut.cut_id !== firstCut.cut_id,
    'Pending-stale fixture did not append its S9.2 reseal.');
  const staleCapability = await readSnapshot(client, item, item.memberships.director);
  invariant(staleCapability.capabilities.approve.allowed === false
    && staleCapability.capabilities.approve.reasonCode === 'CERT_APPROVAL_STALE'
    && staleCapability.capabilities.reject.allowed === true
    && staleCapability.capabilities.reject.reasonCode === null,
  'GET capability freshness diverged from APPROVE while REJECT should remain available.');

  const rejected = await decideCertificate(client, item, firstPrepared, 'REJECT', 'first');
  invariant(rejected.receipt.replayed === false && rejected.decision?.decision === 'REJECTED'
    && rejected.book.pendingCertificateVersionId === null
    && rejected.book.latestApprovedCertificateVersionId === null,
  'First REJECT did not preserve the null approved lineage.');
  const lateRejectedPrepareReplay = await prepareCertificate(client, item, initial, { suffix: 'first', deductions });
  invariant(lateRejectedPrepareReplay.receipt.replayed === true
    && !Object.hasOwn(lateRejectedPrepareReplay, 'decision')
    && lateRejectedPrepareReplay.book.revision === 1,
  'Late PREPARE replay did not preserve its original post-PREPARE snapshot.');

  const afterReject = await readSnapshot(client, item);
  invariant(afterReject.readiness.state === 'READY' && afterReject.book.revision === 2,
    'REJECT did not restore a re-preparable READY state.');
  const secondPrepared = await prepareCertificate(client, item, afterReject, { suffix: 'second', deductions });
  invariant(secondPrepared.certificate.periodVersion === 2
    && secondPrepared.certificate.predecessorId === firstPrepared.certificate.id
    && BigInt(secondPrepared.certificate.projectSequence)
      === BigInt(firstPrepared.certificate.projectSequence) + 1n,
  'Re-prepare did not preserve the rejected predecessor chain.');
  const approved = await decideCertificate(client, item, secondPrepared, 'APPROVE', 'second');
  invariant(approved.decision?.decision === 'APPROVED'
    && approved.book.latestApprovedCertificateVersionId === secondPrepared.certificate.id
    && approved.periodHead.currentApprovedVersionId === secondPrepared.certificate.id,
  'REJECT -> reprepare -> APPROVE did not close the governed certificate projection.');
  const lateApprovedPrepareReplay = await prepareCertificate(client, item, afterReject, { suffix: 'second', deductions });
  invariant(lateApprovedPrepareReplay.receipt.replayed === true
    && !Object.hasOwn(lateApprovedPrepareReplay, 'decision')
    && lateApprovedPrepareReplay.book.revision === 3,
  'Late replay after APPROVE drifted from its original PREPARE receipt.');

  const active = await readSnapshot(client, item, item.memberships.auditor);
  invariant(active.currentApprovedCertificate?.id === secondPrepared.certificate.id
    && active.currentApprovedCertificate.deductions[0].amountMinor === '1000'
    && active.history.length === 2
    && active.readiness.state === 'UP_TO_DATE'
    && active.readiness.blockingReasons.length === 0
    && active.candidate === null,
  'ACTIVE app-serialized GET lost its deduction or period-scoped history.');
  const beforeUnchanged = await client.query(
    `SELECT
      (SELECT count(*)::int FROM "ProjectCertificateVersion" WHERE "organizationId"=$1) versions,
      (SELECT count(*)::int FROM "ProjectCertificateOperationReceipt" WHERE "organizationId"=$1) receipts`,
    [item.organizationId],
  );
  await expectAppError(client, 'unchanged_certificate', 'PROJECT_CERTIFICATE_CONFLICT', () =>
    prepareCertificate(client, item, active, { suffix: 'unchanged', deductions: [] }));
  const afterUnchanged = await client.query(
    `SELECT
      (SELECT count(*)::int FROM "ProjectCertificateVersion" WHERE "organizationId"=$1) versions,
      (SELECT count(*)::int FROM "ProjectCertificateOperationReceipt" WHERE "organizationId"=$1) receipts`,
    [item.organizationId],
  );
  assert.deepEqual(afterUnchanged.rows[0], beforeUnchanged.rows[0],
    'PROJECT_CERTIFICATE_UNCHANGED left certificate facts or receipts.');

  const nextMeasurementId = await submitAndApproveMeasurement(client, item, {
    periodQuantity: '50.0000', evidenceId: item.nextEvidenceId,
    expectedHeadMeasurementId: null, operationSuffix: 'next',
    periodStart: item.nextPeriodStart, periodEnd: item.nextPeriodEnd,
  });
  const nextCut = await sealCurrentCut(client, item, {
    suffix: 'next', periodStart: item.nextPeriodStart, periodEnd: item.nextPeriodEnd,
  });
  const nextReady = await readSnapshot(client, item, item.memberships.site, {
    periodStart: item.nextPeriodStart, periodEnd: item.nextPeriodEnd,
  });
  invariant(nextReady.readiness.state === 'READY' && nextReady.readiness.mode === 'NEXT_PERIOD',
    'Second civil fortnight did not become the explicit NEXT_PERIOD candidate.');
  const nextPrepared = await prepareCertificate(client, item, nextReady, { suffix: 'next', deductions: [] });
  invariant(nextPrepared.certificate.previousApprovedCertificateVersionId === secondPrepared.certificate.id
    && nextPrepared.certificate.totals.previousApprovedCumulativeGrossMinor
      === secondPrepared.certificate.totals.cumulativeGrossMinor,
  'NEXT_PERIOD lost its chronological predecessor or previous cumulative basis.');
  const nextApproved = await decideCertificate(client, item, nextPrepared, 'APPROVE', 'next');
  invariant(nextApproved.decision?.decision === 'APPROVED', 'NEXT_PERIOD approval failed.');

  const correctionMeasurementId = await submitAndApproveMeasurement(client, item, {
    // Lower than the superseded 50 but still above period-one cumulative 30.
    // The new cumulative 70 therefore yields a valid +40 chronological delta.
    periodQuantity: '40.0000', evidenceId: item.correctionEvidenceId,
    expectedHeadMeasurementId: nextMeasurementId, operationSuffix: 'correction',
    periodStart: item.nextPeriodStart, periodEnd: item.nextPeriodEnd,
  });
  invariant(correctionMeasurementId !== nextMeasurementId, 'Measurement correction did not append a new fact.');
  await sealCurrentCut(client, item, {
    expectedHeadCutId: nextCut.cut_id, suffix: 'correction',
    periodStart: item.nextPeriodStart, periodEnd: item.nextPeriodEnd,
  });
  const correctionReady = await readSnapshot(client, item, item.memberships.site, {
    periodStart: item.nextPeriodStart, periodEnd: item.nextPeriodEnd,
  });
  invariant(correctionReady.readiness.state === 'READY' && correctionReady.readiness.mode === 'CORRECTION',
    'Latest-period reseal did not enable the explicit CORRECTION mode.');
  const correctionPrepared = await prepareCertificate(client, item, correctionReady, {
    suffix: 'correction', deductions: [],
  });
  const correctionApproved = await decideCertificate(client, item, correctionPrepared, 'APPROVE', 'correction');
  invariant(correctionApproved.decision?.decision === 'APPROVED'
    && correctionPrepared.certificate.supersedesApprovedVersionId === nextPrepared.certificate.id
    && correctionPrepared.certificate.previousApprovedCertificateVersionId === secondPrepared.certificate.id
    && correctionPrepared.certificate.predecessorId === nextPrepared.certificate.id
    && correctionPrepared.certificate.periodVersion === nextPrepared.certificate.periodVersion + 1
    && BigInt(correctionPrepared.certificate.projectSequence)
      > BigInt(nextPrepared.certificate.projectSequence)
    && correctionPrepared.certificate.totals.previousApprovedCumulativeGrossMinor
      === secondPrepared.certificate.totals.cumulativeGrossMinor
    && BigInt(correctionPrepared.certificate.totals.cumulativeGrossMinor)
      < BigInt(nextPrepared.certificate.totals.cumulativeGrossMinor)
    && BigInt(correctionPrepared.certificate.totals.certificateIncrementGrossMinor) > 0n
    && BigInt(correctionPrepared.certificate.totals.previousApprovedCumulativeRetentionMinor)
      === BigInt(secondPrepared.certificate.totals.cumulativeRetentionMinor)
    && BigInt(correctionPrepared.certificate.totals.previousApprovedCumulativeRetentionMinor)
      + BigInt(correctionPrepared.certificate.totals.certificateIncrementRetentionMinor)
      === BigInt(correctionPrepared.certificate.totals.cumulativeRetentionMinor),
  'CORRECTION prepare -> approve digest reconstruction drifted from persisted lineage.');

  const replayWithFlag = (payload, replayed) => ({
    ...payload,
    receipt: { ...payload.receipt, replayed },
  });
  const lateRejectedReplay = await decideCertificate(client, item, firstPrepared, 'REJECT', 'first');
  const lateApprovedReplay = await decideCertificate(client, item, secondPrepared, 'APPROVE', 'second');
  assert.deepEqual(replayWithFlag(lateRejectedReplay, false), rejected,
    'Late REJECT replay drifted after later certificate/head revisions.');
  assert.deepEqual(replayWithFlag(lateApprovedReplay, false), approved,
    'Late APPROVE replay drifted after later certificate/head revisions.');

  // Once a later period is approved, a technical correction to an older
  // period is deliberately not auto-folded into Phase 1 certificates. The
  // read model must demand an explicit historical-restatement workflow and
  // PREPARE must leave every fact/projection byte-for-byte unchanged.
  // S9.1 correctly forbids approving an older measurement after a newer
  // period. A governed Task snapshot revision remains mutable, however, and
  // deterministically makes every affected sealed cut stale without rewriting
  // immutable measurements. Resealing the old period exercises the reachable
  // historical-restatement path.
  const revisedTask = (await client.query(
    `UPDATE "Task"
        SET "title"='Measured certificate task revised after later approval',
            "revision"="revision"+1,
            "updatedAt"=CURRENT_TIMESTAMP
      WHERE "projectId"=$1 AND "id"=$2
      RETURNING "revision"`,
    [item.projectId, item.taskId],
  )).rows[0];
  invariant(revisedTask.revision === 2,
    'Historical-restatement fixture did not advance the governed Task snapshot.');
  const historicalCut = await sealCurrentCut(client, item, {
    expectedHeadCutId: staleCut.cut_id, suffix: 'historical-restatement',
  });
  invariant(historicalCut.cut_id !== staleCut.cut_id,
    'Historical-restatement fixture did not append its S9.2 reseal.');
  const historical = await readSnapshot(client, item);
  invariant(historical.readiness.state === 'BLOCKED'
    && historical.readiness.mode === null
    && historical.readiness.candidateReady === false
    && historical.readiness.blockingReasons.includes('HISTORICAL_RESTATEMENT_REQUIRED')
    && historical.capabilities.prepare.allowed === false
    && historical.capabilities.prepare.reasonCode === 'CERT_NOT_READY',
  'Older-period reseal did not expose HISTORICAL_RESTATEMENT_REQUIRED fail-closed readiness.');
  const beforeHistoricalPrepare = (await client.query(
    `SELECT
      (SELECT count(*)::int FROM "ProjectCertificateBook" WHERE "organizationId"=$1) books,
      (SELECT count(*)::int FROM "ProjectCertificatePeriodHead" WHERE "organizationId"=$1) heads,
      (SELECT count(*)::int FROM "ProjectCertificateVersion" WHERE "organizationId"=$1) versions,
      (SELECT count(*)::int FROM "ProjectCertificateLine" WHERE "organizationId"=$1) lines,
      (SELECT count(*)::int FROM "ProjectCertificateDeduction" WHERE "organizationId"=$1) deductions,
      (SELECT count(*)::int FROM "ProjectCertificateDecision" WHERE "organizationId"=$1) decisions,
      (SELECT count(*)::int FROM "ProjectCertificateOperationReceipt" WHERE "organizationId"=$1) receipts,
      (SELECT "revision" FROM "ProjectCertificateBook"
        WHERE "organizationId"=$1 AND "projectId"=$2) book_revision,
      (SELECT "revision" FROM "ProjectCertificatePeriodHead"
        WHERE "organizationId"=$1 AND "projectId"=$2
          AND "periodStart"=$3::date AND "periodEnd"=$4::date) head_revision`,
    [item.organizationId, item.projectId, item.periodStart, item.periodEnd],
  )).rows[0];
  await expectDatabaseError(client, 'historical_restatement_prepare', /PROJECT_CERTIFICATE_NOT_READY/, () =>
    client.query(PREPARE_SQL, prepareArgs(item, historical, {
      operationKey: `${item.prefix}_historical_restatement_prepare`,
      fingerprintValue: sha256(`${item.prefix}:historical-restatement-prepare`),
    })));
  const afterHistoricalPrepare = (await client.query(
    `SELECT
      (SELECT count(*)::int FROM "ProjectCertificateBook" WHERE "organizationId"=$1) books,
      (SELECT count(*)::int FROM "ProjectCertificatePeriodHead" WHERE "organizationId"=$1) heads,
      (SELECT count(*)::int FROM "ProjectCertificateVersion" WHERE "organizationId"=$1) versions,
      (SELECT count(*)::int FROM "ProjectCertificateLine" WHERE "organizationId"=$1) lines,
      (SELECT count(*)::int FROM "ProjectCertificateDeduction" WHERE "organizationId"=$1) deductions,
      (SELECT count(*)::int FROM "ProjectCertificateDecision" WHERE "organizationId"=$1) decisions,
      (SELECT count(*)::int FROM "ProjectCertificateOperationReceipt" WHERE "organizationId"=$1) receipts,
      (SELECT "revision" FROM "ProjectCertificateBook"
        WHERE "organizationId"=$1 AND "projectId"=$2) book_revision,
      (SELECT "revision" FROM "ProjectCertificatePeriodHead"
        WHERE "organizationId"=$1 AND "projectId"=$2
          AND "periodStart"=$3::date AND "periodEnd"=$4::date) head_revision`,
    [item.organizationId, item.projectId, item.periodStart, item.periodEnd],
  )).rows[0];
  assert.deepEqual(afterHistoricalPrepare, beforeHistoricalPrepare,
    'Historical-restatement PREPARE changed a fact, receipt, pointer, or revision.');

  for (const [table, column, id] of [
    ['ProjectCertificateVersion', 'id', correctionPrepared.certificate.id],
    ['ProjectCertificateLine', 'certificateVersionId', correctionPrepared.certificate.id],
    ['ProjectCertificateDecision', 'certificateVersionId', correctionPrepared.certificate.id],
    ['ProjectCertificateOperationReceipt', 'certificateVersionId', correctionPrepared.certificate.id],
  ]) {
    await expectDatabaseError(client, `append_only_${table}`, /append-only|governed/, () =>
      client.query(`UPDATE ${quoteIdentifier(table)} SET ${quoteIdentifier(column)}=${quoteIdentifier(column)} WHERE ${quoteIdentifier(column)}=$1`, [id]));
  }
  await expectDatabaseError(client, 'direct_projection_write', /direct project certificate projection writes are forbidden/, () =>
    client.query(`UPDATE "ProjectCertificateBook" SET "revision"="revision"+1 WHERE "organizationId"=$1 AND "projectId"=$2`,
      [item.organizationId, item.projectId]));

  return {
    firstPrepared,
    rejected,
    secondPrepared,
    approved,
    nextPrepared,
    nextApproved,
    correctionPrepared,
    correctionApproved,
  };
}

async function assertRolledBack(client, item) {
  const result = await client.query(
    `SELECT
       (SELECT count(*)::int FROM "Organization" WHERE "id"=$1) organizations,
       (SELECT count(*)::int FROM "Project" WHERE "id"=$2) projects,
       (SELECT count(*)::int FROM "ProjectCertificateBook" WHERE "organizationId"=$1) books,
       (SELECT count(*)::int FROM "ProjectCertificatePeriodHead" WHERE "organizationId"=$1) heads,
       (SELECT count(*)::int FROM "ProjectCertificateVersion" WHERE "organizationId"=$1) versions,
       (SELECT count(*)::int FROM "ProjectCertificateLine" WHERE "organizationId"=$1) lines,
       (SELECT count(*)::int FROM "ProjectCertificateDeduction" WHERE "organizationId"=$1) deductions,
       (SELECT count(*)::int FROM "ProjectCertificateDecision" WHERE "organizationId"=$1) decisions,
       (SELECT count(*)::int FROM "ProjectCertificateOperationReceipt" WHERE "organizationId"=$1) receipts`,
    [item.organizationId, item.projectId],
  );
  invariant(Object.values(result.rows[0]).every((value) => value === 0),
    'Rollback-only S10-CERT journey left exact fixture residue.');
}

async function connectDisposable(connectionString, schema, label) {
  const client = new Client({
    connectionString,
    application_name: `obrasaas-s10-${label}`,
    statement_timeout: 55_000,
    query_timeout: 60_000,
  });
  await client.connect();
  await client.query(`SET search_path TO ${quoteIdentifier(schema)},pg_catalog`);
  await client.query("SET lock_timeout='10s'");
  return client;
}

async function runDisposableQuery(connectionString, schema, label, sql, args) {
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

async function cleanupDisposableFixture(connectionString, schema, item) {
  const client = await connectDisposable(connectionString, schema, 'cleanup');
  const fixtureUserIds = [...Object.values(item.users), item.secondSiteUserId];
  const cleanupTriggerMap = new Map([
    ...TRIGGER_MAP,
    ['TaskProgressMeasurement', ['TaskProgressMeasurement_append_only', 'TaskProgressMeasurement_no_truncate']],
    ['TaskProgressMeasurementEvidence', ['TaskProgressMeasurementEvidence_append_only', 'TaskProgressMeasurementEvidence_no_truncate']],
    ['TaskProgressMeasurementDecision', ['TaskProgressMeasurementDecision_append_only', 'TaskProgressMeasurementDecision_no_truncate']],
    ['TaskProgressMeasurementHead', ['TaskProgressMeasurementHead_projection_guard', 'TaskProgressMeasurementHead_no_truncate']],
    ['TaskProgressMeasurementBalance', ['TaskProgressMeasurementBalance_projection_guard', 'TaskProgressMeasurementBalance_no_truncate']],
    ['ProjectProgressMeasurementCut', ['ProjectProgressMeasurementCut_append_only', 'ProjectProgressMeasurementCut_no_truncate']],
    ['ProjectProgressMeasurementCutLine', ['ProjectProgressMeasurementCutLine_append_only', 'ProjectProgressMeasurementCutLine_no_truncate']],
    ['ProjectProgressMeasurementCutHead', ['ProjectProgressMeasurementCutHead_projection_guard', 'ProjectProgressMeasurementCutHead_no_truncate']],
    ['ProjectContractAuthorityVersion', [
      'ProjectContractAuthorityVersion_append_only', 'ProjectContractAuthorityVersion_no_truncate',
      'ProjectContractAuthorityVersion_certificate_fence',
    ]],
    ['ProjectContractAuthorityDecision', [
      'ProjectContractAuthorityDecision_append_only', 'ProjectContractAuthorityDecision_no_truncate',
      'ProjectContractAuthorityDecision_certificate_fence',
    ]],
    ['ProjectContractVersion', [
      'ProjectContractVersion_append_only', 'ProjectContractVersion_no_truncate',
      'ProjectContractVersion_certificate_fence',
    ]],
    ['ProjectContractLine', ['ProjectContractLine_append_only', 'ProjectContractLine_no_truncate']],
    ['ProjectContractDecision', [
      'ProjectContractDecision_append_only', 'ProjectContractDecision_no_truncate',
      'ProjectContractDecision_certificate_fence',
    ]],
    ['ProjectContractHead', [
      'ProjectContractHead_projection_guard', 'ProjectContractHead_no_truncate',
      'ProjectContractHead_certificate_pointer_fence',
    ]],
  ]);
  // Merge duplicate table entries introduced by the S10 cross-domain map.
  for (const [table, names] of cleanupTriggerMap) cleanupTriggerMap.set(table, [...new Set(names)]);
  try {
    await client.query('BEGIN');
    for (const [table, names] of cleanupTriggerMap) {
      for (const name of names) {
        await client.query(`ALTER TABLE ${quoteIdentifier(table)} DISABLE TRIGGER ${quoteIdentifier(name)}`);
      }
    }
    await client.query(
      `UPDATE "ProjectCertificateBook"
          SET "latestApprovedPeriodStart"=NULL,
              "latestApprovedCertificateVersionId"=NULL,
              "pendingCertificateVersionId"=NULL
        WHERE "organizationId"=$1`,
      [item.organizationId],
    );
    await client.query(
      `UPDATE "ProjectCertificatePeriodHead"
          SET "currentApprovedVersionId"=NULL,"latestVersionId"=NULL
        WHERE "organizationId"=$1`,
      [item.organizationId],
    );
    for (const table of [
      'ProjectCertificateOperationReceipt', 'ProjectCertificateDecision',
      'ProjectCertificateDeduction', 'ProjectCertificateLine', 'ProjectCertificateVersion',
      'ProjectCertificatePeriodHead', 'ProjectCertificateBook',
    ]) await client.query(`DELETE FROM ${quoteIdentifier(table)} WHERE "organizationId"=$1`, [item.organizationId]);
    await client.query(
      `UPDATE "ProjectContractHead"
          SET "currentAuthorityVersionId"=NULL,"latestAuthorityVersionId"=NULL,
              "pendingAuthorityVersionId"=NULL,"currentVersionId"=NULL,
              "latestVersionId"=NULL,"pendingVersionId"=NULL
        WHERE "organizationId"=$1`,
      [item.organizationId],
    );
    for (const table of [
      'ProjectContractDecision', 'ProjectContractLine', 'ProjectContractVersion',
      'ProjectContractAuthorityDecision', 'ProjectContractAuthorityVersion', 'ProjectContractHead',
    ]) await client.query(`DELETE FROM ${quoteIdentifier(table)} WHERE "organizationId"=$1`, [item.organizationId]);
    await client.query(`DELETE FROM "ProjectProgressMeasurementCutLine" WHERE "organizationId"=$1`, [item.organizationId]);
    await client.query(`UPDATE "ProjectProgressMeasurementCutHead" SET "currentCutId"=NULL WHERE "organizationId"=$1`, [item.organizationId]);
    await client.query(`DELETE FROM "ProjectProgressMeasurementCut" WHERE "organizationId"=$1`, [item.organizationId]);
    await client.query(`DELETE FROM "ProjectProgressMeasurementCutHead" WHERE "organizationId"=$1`, [item.organizationId]);
    for (const table of [
      'TaskProgressMeasurementDecision', 'TaskProgressMeasurementEvidence', 'TaskProgressMeasurementBalance',
    ]) await client.query(`DELETE FROM ${quoteIdentifier(table)} WHERE "organizationId"=$1`, [item.organizationId]);
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
    await client.query(`DELETE FROM "ProjectMembership" WHERE "projectId"=$1`, [item.projectId]);
    await client.query(`DELETE FROM "TenantMembership" WHERE "organizationId"=$1`, [item.organizationId]);
    await client.query(`DELETE FROM "PlatformUser" WHERE "id"=ANY($1::text[])`, [fixtureUserIds]);
    await client.query(`DELETE FROM "Project" WHERE "id"=$1`, [item.projectId]);
    await client.query(`DELETE FROM "Organization" WHERE "id"=$1`, [item.organizationId]);
    for (const [table, names] of cleanupTriggerMap) {
      for (const name of names) {
        await client.query(`ALTER TABLE ${quoteIdentifier(table)} ENABLE ALWAYS TRIGGER ${quoteIdentifier(name)}`);
      }
    }
    await client.query('COMMIT');
    const residue = await client.query(
      `SELECT
        (SELECT count(*)::int FROM "Organization" WHERE "id"=$1) organizations,
        (SELECT count(*)::int FROM "Project" WHERE "id"=$2) projects,
        (SELECT count(*)::int FROM "PlatformUser" WHERE "id"=ANY($3::text[])) users,
        (SELECT count(*)::int FROM "TenantMembership" WHERE "organizationId"=$1) tenant_memberships,
        (SELECT count(*)::int FROM "ProjectMembership" WHERE "projectId"=$2) project_memberships,
        (SELECT count(*)::int FROM "Task" WHERE "projectId"=$2) tasks,
        (SELECT count(*)::int FROM "ProgressEvidence" WHERE "projectId"=$2) evidence,
        (SELECT count(*)::int FROM "ProjectCertificateBook" WHERE "organizationId"=$1) certificate_books,
        (SELECT count(*)::int FROM "ProjectCertificatePeriodHead" WHERE "organizationId"=$1) certificate_heads,
        (SELECT count(*)::int FROM "ProjectCertificateVersion" WHERE "organizationId"=$1) certificates,
        (SELECT count(*)::int FROM "ProjectCertificateLine" WHERE "organizationId"=$1) certificate_lines,
        (SELECT count(*)::int FROM "ProjectCertificateDeduction" WHERE "organizationId"=$1) certificate_deductions,
        (SELECT count(*)::int FROM "ProjectCertificateDecision" WHERE "organizationId"=$1) certificate_decisions,
        (SELECT count(*)::int FROM "ProjectCertificateOperationReceipt" WHERE "organizationId"=$1) receipts,
        (SELECT count(*)::int FROM "ProjectContractHead" WHERE "organizationId"=$1) contract_heads,
        (SELECT count(*)::int FROM "ProjectContractAuthorityVersion" WHERE "organizationId"=$1) authority_versions,
        (SELECT count(*)::int FROM "ProjectContractAuthorityDecision" WHERE "organizationId"=$1) authority_decisions,
        (SELECT count(*)::int FROM "ProjectContractVersion" WHERE "organizationId"=$1) contracts,
        (SELECT count(*)::int FROM "ProjectContractLine" WHERE "organizationId"=$1) contract_lines,
        (SELECT count(*)::int FROM "ProjectContractDecision" WHERE "organizationId"=$1) contract_decisions,
        (SELECT count(*)::int FROM "ProjectProgressMeasurementCutHead" WHERE "organizationId"=$1) cut_heads,
        (SELECT count(*)::int FROM "ProjectProgressMeasurementCut" WHERE "organizationId"=$1) cuts,
        (SELECT count(*)::int FROM "ProjectProgressMeasurementCutLine" WHERE "organizationId"=$1) cut_lines,
        (SELECT count(*)::int FROM "TaskProgressMeasurementHead" WHERE "organizationId"=$1) measurement_heads,
        (SELECT count(*)::int FROM "TaskProgressMeasurement" WHERE "organizationId"=$1) measurements,
        (SELECT count(*)::int FROM "TaskProgressMeasurementEvidence" WHERE "organizationId"=$1) measurement_evidence,
        (SELECT count(*)::int FROM "TaskProgressMeasurementDecision" WHERE "organizationId"=$1) measurement_decisions,
        (SELECT count(*)::int FROM "TaskProgressMeasurementBalance" WHERE "organizationId"=$1) measurement_balances`,
      [item.organizationId, item.projectId, fixtureUserIds],
    );
    invariant(Object.values(residue.rows[0]).every((value) => value === 0),
      'Disposable S10 cleanup left exact fixture residue.');
    const expected = [...cleanupTriggerMap.entries()].flatMap(([table, names]) =>
      names.map((name) => `${table}.${name}`));
    const restored = await client.query(
      `SELECT c.relname,t.tgname,t.tgenabled
         FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
        WHERE c.relnamespace=$1::regnamespace AND NOT t.tgisinternal
          AND t.tgname=ANY($2::text[])`,
      [schema, [...new Set([...cleanupTriggerMap.values()].flat())]],
    );
    const restoredMap = new Map(restored.rows.map((row) => [`${row.relname}.${row.tgname}`, row.tgenabled]));
    invariant(expected.every((entry) => restoredMap.get(entry) === 'A'),
      'Disposable S10 cleanup did not restore every touched trigger as ENABLE ALWAYS.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

async function seedCommittedReadyFixture(connectionString, schema, label) {
  const item = fixture(`race_${label}_${randomUUID().replaceAll('-', '')}`);
  const client = await connectDisposable(connectionString, schema, `${label}-seed`);
  try {
    await client.query('BEGIN');
    await seed(client, item);
    await submitAndApproveMeasurement(client, item);
    await sealCurrentCut(client, item);
    await approveAuthorityAndContract(client, item);
    const snapshot = await readSnapshot(client, item);
    invariant(snapshot.readiness.state === 'READY', `${label} committed fixture is not READY.`);
    await client.query('COMMIT');
    return { item, snapshot };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    await cleanupDisposableFixture(connectionString, schema, item).catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

function prepareArgs(item, snapshot, {
  operationKey, fingerprintValue, actor = item.memberships.site, deductions = [],
} = {}) {
  return [
    item.organizationId, item.projectId, snapshot.requestedPeriod.start,
    snapshot.book?.revision ?? 0, snapshot.periodHead?.revision ?? 0,
    snapshot.periodHead?.currentApprovedVersionId ?? null, JSON.stringify(deductions),
    operationKey, fingerprintValue, actor,
  ];
}

async function assertDisposablePrepareRaces(connectionString, schema) {
  const manifest = { sameKey: false, mutatedKey: false, twoMakers: false };
  for (const race of ['same-key', 'mutated-key', 'two-makers']) {
    const { item, snapshot } = await seedCommittedReadyFixture(connectionString, schema, race);
    try {
      const operationKey = `${item.prefix}_${race}_operation`;
      const fingerprintA = sha256(`${item.prefix}:${race}:a`);
      const argsA = prepareArgs(item, snapshot, { operationKey, fingerprintValue: fingerprintA });
      let argsB;
      if (race === 'same-key') argsB = argsA;
      else if (race === 'mutated-key') {
        argsB = prepareArgs(item, snapshot, {
          operationKey, fingerprintValue: sha256(`${item.prefix}:${race}:b`),
        });
      } else {
        argsB = prepareArgs(item, snapshot, {
          operationKey: `${item.prefix}_${race}_operation_b`,
          fingerprintValue: sha256(`${item.prefix}:${race}:b`),
          actor: item.secondSiteMembershipId,
        });
      }
      const outcomes = await Promise.allSettled([
        runDisposableQuery(connectionString, schema, `${race}-a`, PREPARE_SQL, argsA),
        runDisposableQuery(connectionString, schema, `${race}-b`, PREPARE_SQL, argsB),
      ]);
      if (race === 'same-key') {
        invariant(fulfilled(outcomes).length === 2, 'Concurrent exact PREPARE replay did not return two receipts.');
        const payloads = fulfilled(outcomes).map((row) => row.payload);
        invariant(payloads[0].receipt.operationReceiptId === payloads[1].receipt.operationReceiptId,
          'Concurrent exact PREPARE replay created divergent receipts.');
        assert.deepEqual(payloads.map((payload) => payload.receipt.replayed).sort(), [false, true]);
        manifest.sameKey = true;
      } else {
        invariant(fulfilled(outcomes).length === 1 && rejected(outcomes).length === 1,
          `${race} did not select exactly one PREPARE winner.`);
        const loser = String(rejected(outcomes)[0]?.message);
        invariant(race === 'mutated-key'
          ? loser.includes('PROJECT_CERTIFICATE_IDEMPOTENCY_CONFLICT')
          : loser.includes('PROJECT_CERTIFICATE_PENDING_REVIEW'),
        `${race} loser was not a controlled certificate conflict.`);
        manifest[race === 'mutated-key' ? 'mutatedKey' : 'twoMakers'] = true;
      }
      const state = await runDisposableQuery(
        connectionString, schema, `${race}-probe`,
        `SELECT
          (SELECT count(*)::int FROM "ProjectCertificateBook" WHERE "organizationId"=$1) books,
          (SELECT count(*)::int FROM "ProjectCertificatePeriodHead" WHERE "organizationId"=$1) heads,
          (SELECT count(*)::int FROM "ProjectCertificateVersion" WHERE "organizationId"=$1) versions,
          (SELECT count(*)::int FROM "ProjectCertificateLine" WHERE "organizationId"=$1) lines,
          (SELECT count(*)::int FROM "ProjectCertificateDeduction" WHERE "organizationId"=$1) deductions,
          (SELECT count(*)::int FROM "ProjectCertificateDecision" WHERE "organizationId"=$1) decisions,
          (SELECT count(*)::int FROM "ProjectCertificateOperationReceipt" WHERE "organizationId"=$1) receipts,
          (SELECT "revision" FROM "ProjectCertificateBook"
            WHERE "organizationId"=$1 AND "projectId"=$2) book_revision,
          (SELECT "revision" FROM "ProjectCertificatePeriodHead"
            WHERE "organizationId"=$1 AND "projectId"=$2) head_revision,
          (SELECT "pendingCertificateVersionId" FROM "ProjectCertificateBook"
            WHERE "organizationId"=$1 AND "projectId"=$2) pending`,
        [item.organizationId, item.projectId],
      );
      invariant(state.books === 1 && state.heads === 1 && state.versions === 1
        && state.lines === 2 && state.deductions === 0 && state.decisions === 0
        && state.receipts === 1 && state.book_revision === 1
        && state.head_revision === 1 && state.pending,
      `${race} left an incoherent seven-table pending projection.`);
    } finally {
      await cleanupDisposableFixture(connectionString, schema, item);
    }
  }
  invariant(Object.values(manifest).every(Boolean), 'S10 PREPARE race manifest is incomplete.');
  return manifest;
}

async function seedCommittedPendingFixture(connectionString, schema, label) {
  const seeded = await seedCommittedReadyFixture(connectionString, schema, label);
  const client = await connectDisposable(connectionString, schema, `${label}-prepare`);
  try {
    const prepareOperationKey = `${seeded.item.prefix}_${label}_prepare`;
    const args = prepareArgs(seeded.item, seeded.snapshot, {
      operationKey: prepareOperationKey,
      fingerprintValue: sha256(`${seeded.item.prefix}:${label}:prepare`),
    });
    const payload = (await client.query(PREPARE_SQL, args)).rows[0].payload;
    return { ...seeded, preparedPayload: payload, prepareOperationKey };
  } catch (error) {
    await cleanupDisposableFixture(connectionString, schema, seeded.item).catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

async function seedCommittedApprovedFixture(connectionString, schema, label) {
  const seeded = await seedCommittedPendingFixture(connectionString, schema, label);
  const client = await connectDisposable(connectionString, schema, `${label}-approve`);
  try {
    const approvedPayload = (await client.query(DECIDE_SQL,
      decisionArgs(seeded.item, seeded.preparedPayload, {
        decision: 'APPROVE', operationKey: `${seeded.item.prefix}_${label}_approve`,
        fingerprintValue: sha256(`${seeded.item.prefix}:${label}:approve`),
      }))).rows[0].payload;
    return { ...seeded, approvedPayload };
  } catch (error) {
    await cleanupDisposableFixture(connectionString, schema, seeded.item).catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

function decisionArgs(item, preparedPayload, {
  decision = 'APPROVE', operationKey, fingerprintValue,
  actor = item.memberships.director,
} = {}) {
  return [
    item.organizationId, item.projectId, preparedPayload.certificate.id,
    preparedPayload.book.revision, preparedPayload.periodHead.revision,
    preparedPayload.certificate.integrityDigest, decision,
    `${decision} concurrent S10 certificate.`, operationKey, fingerprintValue, actor,
  ];
}

async function assertDisposableTwoDecisions(connectionString, schema) {
  const { item, preparedPayload } = await seedCommittedPendingFixture(
    connectionString, schema, 'two-decisions',
  );
  try {
    const outcomes = await Promise.allSettled([
      runDisposableQuery(connectionString, schema, 'decision-approve', DECIDE_SQL,
        decisionArgs(item, preparedPayload, {
          decision: 'APPROVE', operationKey: `${item.prefix}_decision_approve`,
          fingerprintValue: sha256(`${item.prefix}:decision:approve`),
        })),
      runDisposableQuery(connectionString, schema, 'decision-reject', DECIDE_SQL,
        decisionArgs(item, preparedPayload, {
          decision: 'REJECT', operationKey: `${item.prefix}_decision_reject`,
          fingerprintValue: sha256(`${item.prefix}:decision:reject`),
        })),
    ]);
    invariant(fulfilled(outcomes).length === 1 && rejected(outcomes).length === 1,
      'Concurrent APPROVE versus REJECT did not select exactly one decision.');
    const loser = String(rejected(outcomes)[0]?.message);
    invariant(loser.includes('PROJECT_CERTIFICATE_PENDING_REQUIRED')
      || loser.includes('PROJECT_CERTIFICATE_CAS_STALE'),
    'Concurrent decision loser was not a controlled certificate conflict.');
    const winnerPayload = fulfilled(outcomes)[0].payload;
    const winnerKind = winnerPayload.receipt.operationKind;
    const state = await runDisposableQuery(
      connectionString, schema, 'decision-probe',
      `SELECT
        (SELECT count(*)::int FROM "ProjectCertificateVersion" WHERE "organizationId"=$1) versions,
        (SELECT count(*)::int FROM "ProjectCertificateLine" WHERE "organizationId"=$1) lines,
        (SELECT count(*)::int FROM "ProjectCertificateDeduction" WHERE "organizationId"=$1) deductions,
        (SELECT count(*)::int FROM "ProjectCertificateDecision" WHERE "organizationId"=$1) decisions,
        (SELECT count(*)::int FROM "ProjectCertificateOperationReceipt"
          WHERE "organizationId"=$1 AND "operationKind" IN ('APPROVE','REJECT')) receipts,
        (SELECT "revision" FROM "ProjectCertificateBook"
          WHERE "organizationId"=$1 AND "projectId"=$2) book_revision,
        (SELECT "pendingCertificateVersionId" FROM "ProjectCertificateBook"
          WHERE "organizationId"=$1 AND "projectId"=$2) pending,
        (SELECT "latestApprovedCertificateVersionId" FROM "ProjectCertificateBook"
          WHERE "organizationId"=$1 AND "projectId"=$2) book_approved,
        (SELECT "revision" FROM "ProjectCertificatePeriodHead"
          WHERE "organizationId"=$1 AND "projectId"=$2) head_revision,
        (SELECT "currentApprovedVersionId" FROM "ProjectCertificatePeriodHead"
          WHERE "organizationId"=$1 AND "projectId"=$2) head_approved,
        (SELECT "latestVersionId" FROM "ProjectCertificatePeriodHead"
          WHERE "organizationId"=$1 AND "projectId"=$2) head_latest,
        (SELECT "decision"::text FROM "ProjectCertificateDecision"
          WHERE "organizationId"=$1 AND "certificateVersionId"=$3) stored_decision`,
      [item.organizationId, item.projectId, preparedPayload.certificate.id],
    );
    const approvedWinner = winnerKind === 'APPROVE';
    invariant(['APPROVE', 'REJECT'].includes(winnerKind)
      && state.versions === 1 && state.lines === 2 && state.deductions === 0
      && state.decisions === 1 && state.receipts === 1
      && state.book_revision === 2 && state.head_revision === 2
      && state.pending === null && state.head_latest === preparedPayload.certificate.id
      && state.stored_decision === (approvedWinner ? 'APPROVED' : 'REJECTED')
      && state.book_approved === (approvedWinner ? preparedPayload.certificate.id : null)
      && state.head_approved === (approvedWinner ? preparedPayload.certificate.id : null),
    'Concurrent decisions left a torn winner projection or advanced revisions incorrectly.');
    return true;
  } finally {
    await cleanupDisposableFixture(connectionString, schema, item);
  }
}

async function assertDisposableCrossKindKey(connectionString, schema) {
  const { item, preparedPayload, prepareOperationKey } = await seedCommittedPendingFixture(
    connectionString, schema, 'cross-kind-key',
  );
  try {
    const before = await runDisposableQuery(connectionString, schema, 'cross-kind-before',
      `SELECT
        (SELECT count(*)::int FROM "ProjectCertificateDecision"
          WHERE "organizationId"=$1 AND "certificateVersionId"=$2) decisions,
        (SELECT count(*)::int FROM "ProjectCertificateOperationReceipt"
          WHERE "organizationId"=$1 AND "certificateVersionId"=$2) receipts,
        (SELECT "revision" FROM "ProjectCertificateBook"
          WHERE "organizationId"=$1 AND "projectId"=$3) book_revision,
        (SELECT "pendingCertificateVersionId" FROM "ProjectCertificateBook"
          WHERE "organizationId"=$1 AND "projectId"=$3) pending,
        (SELECT "latestApprovedCertificateVersionId" FROM "ProjectCertificateBook"
          WHERE "organizationId"=$1 AND "projectId"=$3) book_approved,
        (SELECT "revision" FROM "ProjectCertificatePeriodHead"
          WHERE "organizationId"=$1 AND "projectId"=$3) head_revision,
        (SELECT "currentApprovedVersionId" FROM "ProjectCertificatePeriodHead"
          WHERE "organizationId"=$1 AND "projectId"=$3) head_approved,
        (SELECT "latestVersionId" FROM "ProjectCertificatePeriodHead"
          WHERE "organizationId"=$1 AND "projectId"=$3) head_latest`,
      [item.organizationId, preparedPayload.certificate.id, item.projectId]);
    invariant(before.decisions === 0 && before.receipts === 1
      && before.book_revision === 1 && before.head_revision === 1
      && before.pending === preparedPayload.certificate.id
      && before.book_approved === null && before.head_approved === null
      && before.head_latest === preparedPayload.certificate.id,
    'Cross-kind fixture did not start at the exact PREPARE projection.');
    let observed;
    try {
      await runDisposableQuery(connectionString, schema, 'cross-kind-prepare-decision', DECIDE_SQL,
        decisionArgs(item, preparedPayload, {
          decision: 'APPROVE', operationKey: prepareOperationKey,
          fingerprintValue: sha256(`${item.prefix}:cross-kind:approve`),
        }));
    } catch (error) {
      observed = error;
    }
    invariant(observed
      && String(observed.message).includes('PROJECT_CERTIFICATE_IDEMPOTENCY_CONFLICT'),
    'A PREPARE operation key was not isolated from DECIDE by the common receipt ledger.');
    const after = await runDisposableQuery(connectionString, schema, 'cross-kind-after',
      `SELECT
        (SELECT count(*)::int FROM "ProjectCertificateDecision"
          WHERE "organizationId"=$1 AND "certificateVersionId"=$2) decisions,
        (SELECT count(*)::int FROM "ProjectCertificateOperationReceipt"
          WHERE "organizationId"=$1 AND "certificateVersionId"=$2) receipts,
        (SELECT "revision" FROM "ProjectCertificateBook"
          WHERE "organizationId"=$1 AND "projectId"=$3) book_revision,
        (SELECT "pendingCertificateVersionId" FROM "ProjectCertificateBook"
          WHERE "organizationId"=$1 AND "projectId"=$3) pending,
        (SELECT "latestApprovedCertificateVersionId" FROM "ProjectCertificateBook"
          WHERE "organizationId"=$1 AND "projectId"=$3) book_approved,
        (SELECT "revision" FROM "ProjectCertificatePeriodHead"
          WHERE "organizationId"=$1 AND "projectId"=$3) head_revision,
        (SELECT "currentApprovedVersionId" FROM "ProjectCertificatePeriodHead"
          WHERE "organizationId"=$1 AND "projectId"=$3) head_approved,
        (SELECT "latestVersionId" FROM "ProjectCertificatePeriodHead"
          WHERE "organizationId"=$1 AND "projectId"=$3) head_latest`,
      [item.organizationId, preparedPayload.certificate.id, item.projectId]);
    assert.deepEqual(after, before,
      'PREPARE-to-DECIDE key conflict changed a fact, receipt, pointer, or revision.');
    return true;
  } finally {
    await cleanupDisposableFixture(connectionString, schema, item);
  }
}

async function assertDisposableArchiveVsPending(connectionString, schema) {
  const { item, snapshot } = await seedCommittedReadyFixture(connectionString, schema, 'archive-vs-pending');
  try {
    const outcomes = await Promise.allSettled([
      runDisposableQuery(connectionString, schema, 'archive-prepare', PREPARE_SQL,
        prepareArgs(item, snapshot, {
          operationKey: `${item.prefix}_archive_prepare`,
          fingerprintValue: sha256(`${item.prefix}:archive-prepare`),
        })),
      runDisposableQuery(connectionString, schema, 'archive-project',
        `UPDATE "Project" SET "status"='ARCHIVED' WHERE "organizationId"=$1 AND "id"=$2 RETURNING "status"::text`,
        [item.organizationId, item.projectId]),
    ]);
    invariant(fulfilled(outcomes).length === 1 && rejected(outcomes).length === 1,
      'Archive-vs-pending must select exactly one winner.');
    const loser = String(rejected(outcomes)[0]?.message);
    invariant(outcomes[0].status === 'fulfilled'
      ? loser.includes('PROJECT_ARCHIVE_BLOCKED_BY_PENDING_GOVERNANCE')
      : loser.includes('PROJECT_CERTIFICATE_NOT_READY') || loser.includes('PROJECT_CERTIFICATE_PROJECT_ARCHIVED'),
    'Archive-vs-pending loser was not controlled.');
    const state = await runDisposableQuery(
      connectionString, schema, 'archive-probe',
      `SELECT p."status"::text,
              (SELECT count(*)::int FROM "ProjectCertificateVersion"
                WHERE "organizationId"=$1 AND "projectId"=$2) versions,
              (SELECT "pendingCertificateVersionId" FROM "ProjectCertificateBook"
                WHERE "organizationId"=$1 AND "projectId"=$2) pending
         FROM "Project" p WHERE p."organizationId"=$1 AND p."id"=$2`,
      [item.organizationId, item.projectId],
    );
    invariant((outcomes[0].status === 'fulfilled'
      && state.status === 'ACTIVE' && state.versions === 1 && state.pending)
      || (outcomes[0].status === 'rejected'
        && state.status === 'ARCHIVED' && state.versions === 0 && state.pending === null),
    'Archive-vs-pending did not linearize around the raw-project lock.');
    return true;
  } finally {
    await cleanupDisposableFixture(connectionString, schema, item);
  }
}

async function assertDisposableActorRevokeVsApprove(connectionString, schema) {
  for (const actorKind of ['certifier', 'maker']) {
    const { item, preparedPayload } = await seedCommittedPendingFixture(
      connectionString, schema, `revoke-${actorKind}-vs-approve`,
    );
    const revokedMembershipId = actorKind === 'certifier'
      ? item.memberships.director : item.memberships.site;
    try {
      const outcomes = await Promise.allSettled([
        runDisposableQuery(connectionString, schema, `revoke-${actorKind}-approve`, DECIDE_SQL,
          decisionArgs(item, preparedPayload, {
            decision: 'APPROVE', operationKey: `${item.prefix}_revoke_${actorKind}_approve`,
            fingerprintValue: sha256(`${item.prefix}:revoke-${actorKind}-approve`),
          })),
        runDisposableQuery(connectionString, schema, `revoke-${actorKind}-actor`,
          `UPDATE "TenantMembership" SET "status"='DISABLED'
            WHERE "organizationId"=$1 AND "id"=$2 RETURNING "status"::text`,
          [item.organizationId, revokedMembershipId]),
      ]);
      invariant(outcomes[1].status === 'fulfilled', `${actorKind} revocation side did not progress.`);
      if (outcomes[0].status === 'rejected') {
        const loser = String(outcomes[0].reason?.message);
        invariant(loser.includes('PROJECT_CERTIFICATE_SCOPE_INVALID')
          || loser.includes('PROJECT_CERTIFICATE_CERTIFIER_REQUIRED')
          || loser.includes('PROJECT_CERTIFICATE_MAKER_INVALID')
          || loser.includes('PROJECT_CERTIFICATE_PENDING_CLOSER_REQUIRED'),
        `${actorKind}-revoke-vs-approve loser was not controlled.`);
      }
      const state = await runDisposableQuery(
        connectionString, schema, `revoke-${actorKind}-probe`,
        `SELECT tm."status"::text,
                (SELECT count(*)::int FROM "ProjectCertificateDecision"
                  WHERE "organizationId"=$1 AND "certificateVersionId"=$3) decisions,
                (SELECT count(*)::int FROM "ProjectCertificateOperationReceipt"
                  WHERE "organizationId"=$1 AND "certificateVersionId"=$3
                    AND "operationKind"='APPROVE') approval_receipts,
                (SELECT "revision" FROM "ProjectCertificateBook"
                  WHERE "organizationId"=$1 AND "projectId"=$4) book_revision,
                (SELECT "pendingCertificateVersionId" FROM "ProjectCertificateBook"
                  WHERE "organizationId"=$1 AND "projectId"=$4) pending,
                (SELECT "latestApprovedCertificateVersionId" FROM "ProjectCertificateBook"
                  WHERE "organizationId"=$1 AND "projectId"=$4) book_approved,
                (SELECT "revision" FROM "ProjectCertificatePeriodHead"
                  WHERE "organizationId"=$1 AND "projectId"=$4) head_revision,
                (SELECT "currentApprovedVersionId" FROM "ProjectCertificatePeriodHead"
                  WHERE "organizationId"=$1 AND "projectId"=$4) head_approved,
                (SELECT "latestVersionId" FROM "ProjectCertificatePeriodHead"
                  WHERE "organizationId"=$1 AND "projectId"=$4) head_latest
           FROM "TenantMembership" tm WHERE tm."organizationId"=$1 AND tm."id"=$2`,
        [item.organizationId, revokedMembershipId, preparedPayload.certificate.id, item.projectId],
      );
      const approvalWon = outcomes[0].status === 'fulfilled';
      invariant(state.status === 'DISABLED'
        && state.decisions === (approvalWon ? 1 : 0)
        && state.approval_receipts === (approvalWon ? 1 : 0)
        && state.book_revision === (approvalWon ? 2 : 1)
        && state.head_revision === (approvalWon ? 2 : 1)
        && state.pending === (approvalWon ? null : preparedPayload.certificate.id)
        && state.book_approved === (approvalWon ? preparedPayload.certificate.id : null)
        && state.head_approved === (approvalWon ? preparedPayload.certificate.id : null)
        && state.head_latest === preparedPayload.certificate.id,
      `${actorKind}-revoke-vs-approve final state is incoherent.`);
    } finally {
      await cleanupDisposableFixture(connectionString, schema, item);
    }
  }
  return true;
}

async function assertDisposableCloserRevocations(connectionString, schema) {
  const { item, preparedPayload } = await seedCommittedPendingFixture(
    connectionString, schema, 'two-closer-revocations',
  );
  try {
    const revokeSql = `UPDATE "TenantMembership" SET "status"='DISABLED'
      WHERE "organizationId"=$1 AND "id"=$2 RETURNING "status"::text`;
    const outcomes = await Promise.allSettled([
      runDisposableQuery(connectionString, schema, 'revoke-certifier', revokeSql,
        [item.organizationId, item.memberships.director]),
      runDisposableQuery(connectionString, schema, 'revoke-registrar', revokeSql,
        [item.organizationId, item.memberships.admin]),
    ]);
    invariant(fulfilled(outcomes).length === 1 && rejected(outcomes).length === 1
      && String(rejected(outcomes)[0]?.message).includes('PROJECT_CERTIFICATE_PENDING_CLOSER_REQUIRED'),
    'Concurrent certifier/registrar revocations orphaned a pending certificate.');
    const state = await runDisposableQuery(connectionString, schema, 'closer-revoke-probe',
      `SELECT count(*) FILTER (WHERE "status"='ACTIVE')::int active_closers,
              bool_or("id"=$2 AND "status"='ACTIVE') certifier_active,
              bool_or("id"=$3 AND "status"='ACTIVE') registrar_active
         FROM "TenantMembership" WHERE "organizationId"=$1 AND "id" IN ($2,$3)`,
      [item.organizationId, item.memberships.director, item.memberships.admin]);
    invariant(state.active_closers === 1,
      `Pending certificate ${preparedPayload.certificate.id} lost its unique active closer.`);
    const terminalDecision = state.certifier_active ? 'REJECT' : 'CANCEL';
    const terminalActor = state.certifier_active
      ? item.memberships.director : item.memberships.admin;
    const terminalPayload = (await runDisposableQuery(
      connectionString, schema, 'closer-terminal-decision', DECIDE_SQL,
      decisionArgs(item, preparedPayload, {
        decision: terminalDecision, actor: terminalActor,
        operationKey: `${item.prefix}_closer_terminal_${terminalDecision.toLowerCase()}`,
        fingerprintValue: sha256(`${item.prefix}:closer-terminal:${terminalDecision}`),
      }),
    )).payload;
    const terminalState = await runDisposableQuery(connectionString, schema, 'closer-terminal-probe',
      `SELECT b."pendingCertificateVersionId" pending,b."revision" book_revision,
              h."revision" head_revision,
              (SELECT count(*)::int FROM "ProjectCertificateDecision"
                WHERE "organizationId"=$1 AND "certificateVersionId"=$3) decisions,
              (SELECT count(*)::int FROM "ProjectCertificateOperationReceipt"
                WHERE "organizationId"=$1 AND "certificateVersionId"=$3
                  AND "operationKind" IN ('REJECT','CANCEL')) decision_receipts
         FROM "ProjectCertificateBook" b
         JOIN "ProjectCertificatePeriodHead" h
           ON h."organizationId"=b."organizationId" AND h."projectId"=b."projectId"
        WHERE b."organizationId"=$1 AND b."projectId"=$2`,
      [item.organizationId, item.projectId, preparedPayload.certificate.id]);
    invariant(terminalPayload.receipt.operationKind === terminalDecision
      && terminalPayload.decision.decision === (terminalDecision === 'REJECT' ? 'REJECTED' : 'CANCELLED')
      && terminalState.pending === null && terminalState.book_revision === 2
      && terminalState.head_revision === 2 && terminalState.decisions === 1
      && terminalState.decision_receipts === 1,
    'Surviving closer could not terminally close the pending certificate exactly once.');
    return true;
  } finally {
    await cleanupDisposableFixture(connectionString, schema, item);
  }
}

async function observeLockWait(client, applicationName, label) {
  for (let attempt = 0; attempt < 75; attempt += 1) {
    const activity = await client.query(
      `SELECT wait_event_type FROM pg_stat_activity
        WHERE application_name=$1 AND pid <> pg_backend_pid()`,
      [applicationName],
    );
    if (activity.rows.some((row) => row.wait_event_type === 'Lock')) return true;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(`${label} never observed the expected PostgreSQL lock wait.`);
}

function controlledRaceError(error, markers, label) {
  const message = String(error?.message || error);
  invariant(!/deadlock detected|lock timeout|statement timeout|duplicate key|23505/i.test(message),
    `${label} leaked an uncontrolled lock/unique failure: ${message}`);
  invariant(markers.some((marker) => message.includes(marker)),
    `${label} loser was not contractual: ${message}`);
}

async function assertDisposableApproveVsCutCorrection(connectionString, schema) {
  const { item, preparedPayload } = await seedCommittedPendingFixture(
    connectionString, schema, 'approve-vs-cut-correction',
  );
  const correction = await connectDisposable(connectionString, schema, 'cut-correction-tx');
  const approval = await connectDisposable(connectionString, schema, 'approve-vs-cut');
  const activity = await connectDisposable(connectionString, schema, 'approve-vs-cut-probe');
  let correctionOpen = false;
  try {
    const source = (await correction.query(
      `SELECT
        (SELECT "approvedMeasurementId" FROM "TaskProgressMeasurementHead"
          WHERE "organizationId"=$1 AND "projectId"=$2 AND "taskId"=$3
            AND "periodStart"=$4::date AND "periodEnd"=$5::date) measurement_id,
        (SELECT "currentCutId" FROM "ProjectProgressMeasurementCutHead"
          WHERE "organizationId"=$1 AND "projectId"=$2
            AND "periodStart"=$4::date AND "periodEnd"=$5::date) cut_id`,
      [item.organizationId, item.projectId, item.taskId, item.periodStart, item.periodEnd],
    )).rows[0];
    invariant(source.measurement_id && source.cut_id, 'Cut-correction race source was not sealed.');

    await correction.query('BEGIN');
    correctionOpen = true;
    const correctedMeasurementId = await submitAndApproveMeasurement(correction, item, {
      periodQuantity: '31.0000', evidenceId: item.evidenceId,
      expectedHeadMeasurementId: source.measurement_id,
      operationSuffix: 'race-cut-correction',
    });

    const approvalPromise = approval.query(DECIDE_SQL,
      decisionArgs(item, preparedPayload, {
        decision: 'APPROVE', operationKey: `${item.prefix}_approve_vs_cut`,
        fingerprintValue: sha256(`${item.prefix}:approve-vs-cut`),
      })).then((result) => ({ status: 'fulfilled', value: result.rows[0] }),
      (reason) => ({ status: 'rejected', reason }));
    await observeLockWait(activity, 'obrasaas-s10-approve-vs-cut', 'APPROVE-vs-cut-correction');

    const correctedCut = await sealCurrentCut(correction, item, {
      expectedHeadCutId: source.cut_id, suffix: 'race-cut-correction',
    });
    await correction.query('COMMIT');
    correctionOpen = false;
    const approvalOutcome = await approvalPromise;
    invariant(correctedMeasurementId !== source.measurement_id && correctedCut.cut_id !== source.cut_id,
      'Concurrent S9.1 correction plus S9.2 reseal did not progress.');
    invariant(approvalOutcome.status === 'rejected',
      'APPROVE accepted a candidate superseded by the concurrent cut correction.');
    controlledRaceError(approvalOutcome.reason,
      ['PROJECT_CERTIFICATE_APPROVAL_STALE'], 'APPROVE-vs-cut-correction');

    const state = await correction.query(
      `SELECT b."pendingCertificateVersionId" pending,
              b."latestApprovedCertificateVersionId" book_approved,
              b."revision" book_revision,
              (SELECT count(*)::int FROM "ProjectCertificateDecision"
                WHERE "organizationId"=$1 AND "certificateVersionId"=$3) decisions,
              (SELECT count(*)::int FROM "ProjectCertificateOperationReceipt"
                WHERE "organizationId"=$1 AND "certificateVersionId"=$3
                  AND "operationKind"='APPROVE') approval_receipts,
              (SELECT h."revision" FROM "ProjectCertificatePeriodHead" h
                WHERE h."organizationId"=$1 AND h."projectId"=$2
                  AND h."periodStart"=$4::date AND h."periodEnd"=$5::date) head_revision,
              (SELECT h."currentApprovedVersionId" FROM "ProjectCertificatePeriodHead" h
                WHERE h."organizationId"=$1 AND h."projectId"=$2
                  AND h."periodStart"=$4::date AND h."periodEnd"=$5::date) head_approved,
              (SELECT h."latestVersionId" FROM "ProjectCertificatePeriodHead" h
                WHERE h."organizationId"=$1 AND h."projectId"=$2
                  AND h."periodStart"=$4::date AND h."periodEnd"=$5::date) head_latest,
              (SELECT "currentCutId" FROM "ProjectProgressMeasurementCutHead"
                WHERE "organizationId"=$1 AND "projectId"=$2
                  AND "periodStart"=$4::date AND "periodEnd"=$5::date) cut_id,
              (SELECT "approvedMeasurementId" FROM "TaskProgressMeasurementHead"
                WHERE "organizationId"=$1 AND "projectId"=$2 AND "taskId"=$6
                  AND "periodStart"=$4::date AND "periodEnd"=$5::date) measurement_id
         FROM "ProjectCertificateBook" b
        WHERE b."organizationId"=$1 AND b."projectId"=$2`,
      [item.organizationId, item.projectId, preparedPayload.certificate.id,
        item.periodStart, item.periodEnd, item.taskId],
    );
    invariant(state.rows[0].pending === preparedPayload.certificate.id
      && state.rows[0].book_approved === null
      && state.rows[0].book_revision === 1
      && state.rows[0].decisions === 0
      && state.rows[0].approval_receipts === 0
      && state.rows[0].head_revision === 1
      && state.rows[0].head_approved === null
      && state.rows[0].head_latest === preparedPayload.certificate.id
      && state.rows[0].cut_id === correctedCut.cut_id
      && state.rows[0].measurement_id === correctedMeasurementId,
    'APPROVE-vs-cut-correction persisted a torn technical/certificate state.');
    return true;
  } catch (error) {
    if (correctionOpen) await correction.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await activity.end();
    await approval.end();
    await correction.end();
    await cleanupDisposableFixture(connectionString, schema, item);
  }
}

async function authorityRotationArgs(client, item, suffix) {
  const candidate = (await client.query(
    `SELECT * FROM "obrasaas_project_contract_authority_candidate"($1,$2,$3,$4,$5,$6)`,
    [item.organizationId, item.projectId, item.memberships.director,
      item.memberships.finance, item.memberships.admin, item.memberships.admin],
  )).rows[0];
  return [item.organizationId, item.projectId, candidate.current_authority_version_id,
    candidate.authority_revision, candidate.candidate_sha256,
    item.memberships.director, item.memberships.finance, item.memberships.admin,
    `${item.prefix}_authority_rotation_${suffix}`,
    sha256(`${item.prefix}:authority-rotation:${suffix}`), item.memberships.admin];
}

async function sovRotationArgs(client, item, suffix) {
  const current = (await client.query(
    `SELECT h."currentAuthorityVersionId" authority_id,h."authorityRevision" authority_revision,
            h."currentVersionId" current_version_id,h."revision" head_revision,
            v."contractReference" contract_reference,v."counterpartyLabel" counterparty_label,
            v."effectiveFrom"::text effective_from,v."currencyCode"::text currency_code,
            v."currencyMinorUnits" currency_minor_units,v."retentionBps" retention_bps,
            v."roundingPolicyVersion"::text rounding_policy,
            v."adjustmentPolicyVersion"::text adjustment_policy,
            COALESCE(jsonb_agg(jsonb_build_object(
              'taskId',l."taskId",'state',l."state"::text,'unitCode',l."unitCode"::text,
              'baseQuantity',l."baseQuantity"::text,'contractAmountMinor',l."contractAmountMinor"::text,
              'noClaimReason',l."noClaimReason") ORDER BY l."ordinal"), '[]'::jsonb) lines
       FROM "ProjectContractHead" h
       JOIN "ProjectContractVersion" v ON v."id"=h."currentVersionId"
       JOIN "ProjectContractLine" l ON l."contractVersionId"=v."id"
      WHERE h."organizationId"=$1 AND h."projectId"=$2
      GROUP BY h."currentAuthorityVersionId",h."authorityRevision",h."currentVersionId",h."revision",
               v."contractReference",v."counterpartyLabel",v."effectiveFrom",v."currencyCode",
               v."currencyMinorUnits",v."retentionBps",v."roundingPolicyVersion",v."adjustmentPolicyVersion"`,
    [item.organizationId, item.projectId],
  )).rows[0];
  const title = `Certificate contract rotation ${suffix}`;
  const candidate = (await client.query(
    `SELECT * FROM "obrasaas_project_contract_sov_candidate"(
      $1,$2,$3,$4,$5,$6,$7::date,$8,$9,$10,$11,$12,$13::jsonb,$14
    )`,
    [item.organizationId, item.projectId, current.authority_id,
      current.contract_reference, title, current.counterparty_label, current.effective_from,
      current.currency_code, current.currency_minor_units, current.retention_bps,
      current.rounding_policy, current.adjustment_policy, JSON.stringify(current.lines),
      item.memberships.director],
  )).rows[0];
  invariant(candidate.readiness === 'READY', 'Concurrent SOV rotation candidate was not READY.');
  return [item.organizationId, item.projectId, current.authority_id,
    current.authority_revision, current.current_version_id, current.head_revision,
    candidate.candidate_sha256, current.contract_reference, title, current.counterparty_label,
    current.effective_from, current.currency_code, current.currency_minor_units,
    current.retention_bps, current.rounding_policy, current.adjustment_policy,
    JSON.stringify(current.lines), `${item.prefix}_sov_rotation_${suffix}`,
    sha256(`${item.prefix}:sov-rotation:${suffix}`), item.memberships.director];
}

async function assertDisposableApproveVsContractRotation(connectionString, schema) {
  for (const kind of ['authority', 'sov']) {
    const { item, preparedPayload } = await seedCommittedPendingFixture(
      connectionString, schema, `approve-vs-${kind}-rotation`,
    );
    const setup = await connectDisposable(connectionString, schema, `${kind}-rotation-setup`);
    try {
      const rotationSql = kind === 'authority'
        ? `SELECT * FROM "obrasaas_project_contract_authority_prepare"(
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`
        : `SELECT * FROM "obrasaas_project_contract_prepare"(
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::date,$12,$13,$14,$15,$16,$17::jsonb,$18,$19,$20)`;
      const rotationArgs = kind === 'authority'
        ? await authorityRotationArgs(setup, item, kind)
        : await sovRotationArgs(setup, item, kind);
      const before = (await setup.query(
        `SELECT
          (SELECT count(*)::int FROM "ProjectContractAuthorityVersion" WHERE "organizationId"=$1) authorities,
          (SELECT count(*)::int FROM "ProjectContractVersion" WHERE "organizationId"=$1) contracts`,
        [item.organizationId],
      )).rows[0];
      const outcomes = await Promise.allSettled([
        runDisposableQuery(connectionString, schema, `${kind}-rotation-approve`, DECIDE_SQL,
          decisionArgs(item, preparedPayload, {
            decision: 'APPROVE', operationKey: `${item.prefix}_${kind}_rotation_approve`,
            fingerprintValue: sha256(`${item.prefix}:${kind}-rotation-approve`),
          })),
        runDisposableQuery(connectionString, schema, `${kind}-rotation-proposal`,
          rotationSql, rotationArgs),
      ]);
      invariant(outcomes[0].status === 'fulfilled' && outcomes[1].status === 'rejected',
        `APPROVE-vs-${kind}-rotation did not approve while fencing the S9.3 proposal.`);
      controlledRaceError(outcomes[1].reason, [
        'PROJECT_CONTRACT_BLOCKED_BY_PENDING_CERTIFICATE',
        'PROJECT_CONTRACT_PINNED_BY_CERTIFICATE',
        'PROJECT_CONTRACT_POINTER_BLOCKED_BY_CERTIFICATE',
      ], `APPROVE-vs-${kind}-rotation`);
      const after = (await setup.query(
        `SELECT b."latestApprovedCertificateVersionId" approved,b."pendingCertificateVersionId" pending,
          (SELECT count(*)::int FROM "ProjectCertificateDecision" WHERE "organizationId"=$1) decisions,
          (SELECT count(*)::int FROM "ProjectContractAuthorityVersion" WHERE "organizationId"=$1) authorities,
          (SELECT count(*)::int FROM "ProjectContractVersion" WHERE "organizationId"=$1) contracts
         FROM "ProjectCertificateBook" b WHERE b."organizationId"=$1 AND b."projectId"=$2`,
        [item.organizationId, item.projectId],
      )).rows[0];
      invariant(after.approved === preparedPayload.certificate.id && after.pending === null
        && after.decisions === 1 && after.authorities === before.authorities
        && after.contracts === before.contracts,
      `APPROVE-vs-${kind}-rotation left an unfenced S9.3 fact or torn certificate projection.`);
    } finally {
      await setup.end();
      await cleanupDisposableFixture(connectionString, schema, item);
    }
  }
  return true;
}

async function assertDisposableCorrectionVsNext(connectionString, schema) {
  const seeded = await seedCommittedApprovedFixture(connectionString, schema, 'correction-vs-next');
  const { item, preparedPayload: approvedVersion } = seeded;
  const setup = await connectDisposable(connectionString, schema, 'correction-vs-next-setup');
  const correction = await connectDisposable(connectionString, schema, 'latest-correction-tx');
  const nextPrepare = await connectDisposable(connectionString, schema, 'next-period-prepare');
  const activity = await connectDisposable(connectionString, schema, 'correction-vs-next-probe');
  let correctionOpen = false;
  try {
    const source = (await setup.query(
      `SELECT
        (SELECT "approvedMeasurementId" FROM "TaskProgressMeasurementHead"
          WHERE "organizationId"=$1 AND "projectId"=$2 AND "taskId"=$3
            AND "periodStart"=$4::date AND "periodEnd"=$5::date) measurement_id,
        (SELECT "currentCutId" FROM "ProjectProgressMeasurementCutHead"
          WHERE "organizationId"=$1 AND "projectId"=$2
            AND "periodStart"=$4::date AND "periodEnd"=$5::date) cut_id`,
      [item.organizationId, item.projectId, item.taskId, item.periodStart, item.periodEnd],
    )).rows[0];

    // NEXT is genuinely READY before the correction transaction begins.
    await submitAndApproveMeasurement(setup, item, {
      periodQuantity: '20.0000', evidenceId: item.nextEvidenceId,
      operationSuffix: 'correction-vs-next-next',
      periodStart: item.nextPeriodStart, periodEnd: item.nextPeriodEnd,
    });
    await sealCurrentCut(setup, item, {
      suffix: 'correction-vs-next-next',
      periodStart: item.nextPeriodStart, periodEnd: item.nextPeriodEnd,
    });
    const nextSnapshot = await readSnapshot(setup, item, item.memberships.site, {
      periodStart: item.nextPeriodStart, periodEnd: item.nextPeriodEnd,
    });
    invariant(nextSnapshot.readiness.state === 'READY'
      && nextSnapshot.readiness.mode === 'NEXT_PERIOD',
    'Correction-vs-next fixture did not begin with a genuinely READY NEXT_PERIOD snapshot.');

    await correction.query('BEGIN');
    correctionOpen = true;
    await submitAndApproveMeasurement(correction, item, {
      periodQuantity: '32.0000', evidenceId: item.evidenceId,
      expectedHeadMeasurementId: source.measurement_id,
      operationSuffix: 'correction-vs-next-correction',
    });
    await sealCurrentCut(correction, item, {
      expectedHeadCutId: source.cut_id, suffix: 'correction-vs-next-correction',
    });

    const nextOutcomePromise = nextPrepare.query(PREPARE_SQL,
      prepareArgs(item, nextSnapshot, {
        operationKey: `${item.prefix}_next_period_prepare`,
        fingerprintValue: sha256(`${item.prefix}:next-period-prepare`),
      })).then((result) => ({ status: 'fulfilled', value: result.rows[0] }),
      (reason) => ({ status: 'rejected', reason }));
    await observeLockWait(activity, 'obrasaas-s10-next-period-prepare',
      'latest-CORRECTION-vs-NEXT_PERIOD');
    await correction.query('COMMIT');
    correctionOpen = false;
    const nextOutcome = await nextOutcomePromise;
    invariant(nextOutcome.status === 'rejected',
      'NEXT_PERIOD prepared from a stale snapshot after a concurrent latest correction.');
    controlledRaceError(nextOutcome.reason, ['PROJECT_CERTIFICATE_NOT_READY'],
      'latest-CORRECTION-vs-NEXT_PERIOD');

    const correctionSnapshot = await readSnapshot(setup, item);
    invariant(correctionSnapshot.readiness.state === 'READY'
      && correctionSnapshot.readiness.mode === 'CORRECTION',
    'Committed latest correction did not become the sole CORRECTION candidate.');
    const correctionPayload = (await setup.query(PREPARE_SQL,
      prepareArgs(item, correctionSnapshot, {
        operationKey: `${item.prefix}_latest_correction_prepare`,
        fingerprintValue: sha256(`${item.prefix}:latest-correction-prepare`),
      }))).rows[0].payload;
    const state = (await setup.query(
      `SELECT b."pendingCertificateVersionId" pending,
              b."revision" book_revision,
              (SELECT count(*)::int FROM "ProjectCertificateVersion" WHERE "organizationId"=$1) versions,
              (SELECT count(*)::int FROM "ProjectCertificatePeriodHead" WHERE "organizationId"=$1) heads,
              (SELECT count(*)::int FROM "ProjectCertificateDecision" WHERE "organizationId"=$1) decisions,
              (SELECT count(*)::int FROM "ProjectCertificateOperationReceipt" WHERE "organizationId"=$1) receipts,
              (SELECT count(*)::int FROM "ProjectCertificatePeriodHead"
                WHERE "organizationId"=$1 AND "periodStart"=$3::date) next_heads,
              (SELECT count(*)::int FROM "ProjectCertificateVersion"
                WHERE "organizationId"=$1 AND "periodStart"=$3::date) next_versions,
              (SELECT count(*)::int FROM "ProjectCertificateOperationReceipt" r
                JOIN "ProjectCertificateVersion" v ON v."id"=r."certificateVersionId"
                WHERE r."organizationId"=$1 AND v."periodStart"=$3::date) next_receipts
         FROM "ProjectCertificateBook" b WHERE b."organizationId"=$1 AND b."projectId"=$2`,
      [item.organizationId, item.projectId, item.nextPeriodStart],
    )).rows[0];
    invariant(correctionPayload.certificate.supersedesApprovedVersionId === approvedVersion.certificate.id
      && state.pending === correctionPayload.certificate.id
      && state.book_revision === 3 && correctionPayload.periodHead.revision === 3
      && state.versions === 2 && state.heads === 1 && state.decisions === 1 && state.receipts === 3
      && state.next_heads === 0 && state.next_versions === 0 && state.next_receipts === 0,
    'Latest CORRECTION versus NEXT_PERIOD left an incoherent sequence/head projection.');
    return true;
  } catch (error) {
    if (correctionOpen) await correction.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await activity.end();
    await nextPrepare.end();
    await correction.end();
    await setup.end();
    await cleanupDisposableFixture(connectionString, schema, item);
  }
}

async function expectTransactionFailure(client, savepointLabel, marker, sql, args = []) {
  const savepoint = quoteIdentifier(`s10_${savepointLabel}`.slice(0, 55));
  await client.query(`SAVEPOINT ${savepoint}`);
  let observed;
  try {
    await client.query(sql, args);
  } catch (error) {
    observed = error;
  }
  await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
  await client.query(`RELEASE SAVEPOINT ${savepoint}`);
  invariant(observed, `${savepointLabel} unexpectedly bypassed certificate governance.`);
  assert.match(String(observed.message), marker,
    `${savepointLabel} failed for a constraint/SQL accident instead of its governance trigger.`);
}

async function certificateFactCounts(client, organizationId) {
  return (await client.query(
    `SELECT
      (SELECT count(*)::int FROM "ProjectCertificateBook" WHERE "organizationId"=$1) books,
      (SELECT count(*)::int FROM "ProjectCertificatePeriodHead" WHERE "organizationId"=$1) heads,
      (SELECT count(*)::int FROM "ProjectCertificateVersion" WHERE "organizationId"=$1) versions,
      (SELECT count(*)::int FROM "ProjectCertificateLine" WHERE "organizationId"=$1) lines,
      (SELECT count(*)::int FROM "ProjectCertificateDeduction" WHERE "organizationId"=$1) deductions,
      (SELECT count(*)::int FROM "ProjectCertificateDecision" WHERE "organizationId"=$1) decisions,
      (SELECT count(*)::int FROM "ProjectCertificateOperationReceipt" WHERE "organizationId"=$1) receipts`,
    [organizationId],
  )).rows[0];
}

async function globalCertificateFactCounts(client) {
  return (await client.query(
    `SELECT
      (SELECT count(*)::int FROM "ProjectCertificateBook") books,
      (SELECT count(*)::int FROM "ProjectCertificatePeriodHead") heads,
      (SELECT count(*)::int FROM "ProjectCertificateVersion") versions,
      (SELECT count(*)::int FROM "ProjectCertificateLine") lines,
      (SELECT count(*)::int FROM "ProjectCertificateDeduction") deductions,
      (SELECT count(*)::int FROM "ProjectCertificateDecision") decisions,
      (SELECT count(*)::int FROM "ProjectCertificateOperationReceipt") receipts`,
  )).rows[0];
}

async function assertDisposableGovernance(connectionString, schema) {
  const seeded = await seedCommittedReadyFixture(connectionString, schema, 'governance');
  const { item, snapshot } = seeded;
  const client = await connectDisposable(connectionString, schema, 'governance');
  let transactionOpen = false;
  try {
    const preparedPayload = (await client.query(PREPARE_SQL,
      prepareArgs(item, snapshot, {
        operationKey: `${item.prefix}_governance_prepare`,
        fingerprintValue: sha256(`${item.prefix}:governance-prepare`),
        deductions: [{ code: 'GOVERNANCE', reason: 'Governance ledger seed.', amountMinor: '1' }],
      }))).rows[0].payload;
    await client.query(DECIDE_SQL, decisionArgs(item, preparedPayload, {
      decision: 'APPROVE', operationKey: `${item.prefix}_governance_approve`,
      fingerprintValue: sha256(`${item.prefix}:governance-approve`),
    }));
    const baseline = await certificateFactCounts(client, item.organizationId);
    invariant(Object.values(baseline).every((count) => count > 0),
      'Governance fixture does not contain a row in every S10 table.');

    const identityColumn = new Map([
      ['ProjectCertificateBook', 'id'],
      ['ProjectCertificatePeriodHead', 'id'],
      ['ProjectCertificateVersion', 'id'],
      ['ProjectCertificateLine', 'id'],
      ['ProjectCertificateDeduction', 'id'],
      ['ProjectCertificateDecision', 'id'],
      ['ProjectCertificateOperationReceipt', 'id'],
    ]);
    const governanceMarker = /direct project certificate|append-only|cannot be deleted|governed certificate state/i;
    await client.query('BEGIN');
    transactionOpen = true;
    for (const replicationRole of ['origin', 'replica']) {
      await client.query(`SET LOCAL session_replication_role='${replicationRole}'`);
      for (const table of TABLES) {
        const quotedTable = quoteIdentifier(table);
        const quotedIdentity = quoteIdentifier(identityColumn.get(table));
        const label = `${replicationRole}_${table.replaceAll('ProjectCertificate', 'pc')}`;
        await expectTransactionFailure(client, `${label}_insert`, governanceMarker,
          `INSERT INTO ${quotedTable} SELECT * FROM ${quotedTable}
            WHERE "organizationId"=$1 LIMIT 1`, [item.organizationId]);
        await expectTransactionFailure(client, `${label}_update`, governanceMarker,
          `UPDATE ${quotedTable} SET ${quotedIdentity}=${quotedIdentity}
            WHERE "organizationId"=$1`, [item.organizationId]);
        await expectTransactionFailure(client, `${label}_delete`, governanceMarker,
          `DELETE FROM ${quotedTable} WHERE "organizationId"=$1`, [item.organizationId]);
        await expectTransactionFailure(client, `${label}_truncate`, governanceMarker,
          `TRUNCATE TABLE ${quotedTable} CASCADE`);
      }
    }

    await client.query("SET LOCAL session_replication_role='origin'");
    await client.query(`SELECT set_config(
      'obrasaas.project_certificate_write_scope',$1 || ':' || $2 || ':' || $3,true
    )`, [item.organizationId, item.projectId, preparedPayload.book.id]);
    await expectTransactionFailure(client, 'forged_write_scope', /direct project certificate/i,
      `UPDATE "ProjectCertificateBook" SET "revision"="revision"
        WHERE "organizationId"=$1 AND "projectId"=$2`,
      [item.organizationId, item.projectId]);
    await expectTransactionFailure(client, 'direct_prepare_worker',
      /requires its governed command trigger|permission denied/i,
      `SELECT "obrasaas_project_certificate_prepare_worker"(
        NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL
      )`);

    await client.query("SET LOCAL session_replication_role='replica'");
    const beforeCommands = await certificateFactCounts(client, item.organizationId);
    const beforeCommandsGlobal = await globalCertificateFactCounts(client);
    const prepareReplayArgs = prepareArgs(item, snapshot, {
      operationKey: `${item.prefix}_governance_prepare`,
      fingerprintValue: sha256(`${item.prefix}:governance-prepare`),
      deductions: [{ code: 'GOVERNANCE', reason: 'Governance ledger seed.', amountMinor: '1' }],
    });
    const decideReplayArgs = decisionArgs(item, preparedPayload, {
      decision: 'APPROVE', operationKey: `${item.prefix}_governance_approve`,
      fingerprintValue: sha256(`${item.prefix}:governance-approve`),
    });
    const commandAttempts = [
      {
        label: 'replica_prepare_view',
        sql: `INSERT INTO "ObrasaasProjectCertificatePrepareCommand"(
          "organizationId","projectId","periodStart","expectedBookRevision",
          "expectedPeriodHeadRevision","expectedCurrentApprovedVersionId","deductionsInput",
          "operationKey","requestFingerprint","actorMembershipId"
        ) VALUES ($1,$2,$3::date,$4,$5,$6,$7::jsonb,$8,$9,$10) RETURNING "payload"`,
        args: prepareReplayArgs,
      },
      {
        label: 'replica_decide_view',
        sql: `INSERT INTO "ObrasaasProjectCertificateDecideCommand"(
          "organizationId","projectId","certificateVersionId","expectedBookRevision",
          "expectedPeriodHeadRevision","expectedCertificateDigest","decisionInput","reason",
          "operationKey","requestFingerprint","actorMembershipId"
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING "payload"`,
        args: decideReplayArgs,
      },
      {
        label: 'replica_prepare_wrapper',
        sql: PREPARE_SQL,
        args: prepareReplayArgs,
      },
      {
        label: 'replica_decide_wrapper',
        sql: DECIDE_SQL,
        args: decideReplayArgs,
      },
    ];
    for (const attempt of commandAttempts) {
      const savepoint = quoteIdentifier(`s10_${attempt.label}`);
      await client.query(`SAVEPOINT ${savepoint}`);
      let result;
      let observedError;
      try {
        result = await client.query(attempt.sql, attempt.args);
      } catch (error) {
        observedError = error;
        await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      }
      await client.query(`RELEASE SAVEPOINT ${savepoint}`);
      if (observedError) {
        assert.match(String(observedError.message),
          /cannot insert into view|not automatically updatable|does not have an INSTEAD OF trigger/i,
          `${attempt.label} failed for invalid scope/input instead of inert replica trigger behavior.`);
      } else {
        invariant(result.rows.every((row) => row.payload == null),
          `${attempt.label} returned a governed replay payload in replica mode.`);
      }
    }
    const afterCommands = await certificateFactCounts(client, item.organizationId);
    const afterCommandsGlobal = await globalCertificateFactCounts(client);
    assert.deepEqual(afterCommands, beforeCommands,
      'Replica command views/wrappers mutated S10 facts or receipts.');
    assert.deepEqual(afterCommandsGlobal, beforeCommandsGlobal,
      'Replica command views/wrappers created cross-tenant S10 residue.');
    await client.query("SET LOCAL session_replication_role='origin'");
    const restored = await client.query(
      `SELECT current_setting('session_replication_role') role`);
    invariant(restored.rows[0].role === 'origin',
      'session_replication_role was not restored after S10 governance probes.');
    await client.query('ROLLBACK');
    transactionOpen = false;
    const committedAfter = await certificateFactCounts(client, item.organizationId);
    assert.deepEqual(committedAfter, baseline,
      'Governance probes changed committed certificate state.');
    return true;
  } catch (error) {
    if (transactionOpen) {
      await client.query("SET LOCAL session_replication_role='origin'").catch(() => undefined);
      await client.query('ROLLBACK').catch(() => undefined);
    }
    throw error;
  } finally {
    await client.query("SET session_replication_role='origin'").catch(() => undefined);
    await client.end();
    await cleanupDisposableFixture(connectionString, schema, item);
  }
}

async function assertDisposableConcurrency(connectionString, schema) {
  const prepareManifest = await assertDisposablePrepareRaces(connectionString, schema);
  const manifest = {
    governance: await assertDisposableGovernance(connectionString, schema),
    ...prepareManifest,
    twoDecisions: await assertDisposableTwoDecisions(connectionString, schema),
    crossKindKey: await assertDisposableCrossKindKey(connectionString, schema),
    approveVsCutCorrection: await assertDisposableApproveVsCutCorrection(connectionString, schema),
    approveVsContractRotation: await assertDisposableApproveVsContractRotation(connectionString, schema),
    correctionVsNext: await assertDisposableCorrectionVsNext(connectionString, schema),
    actorRevokeVsApprove: await assertDisposableActorRevokeVsApprove(connectionString, schema),
    closerRevocations: await assertDisposableCloserRevocations(connectionString, schema),
    archiveVsPending: await assertDisposableArchiveVsPending(connectionString, schema),
  };
  invariant(Object.values(manifest).every(Boolean),
    `S10 disposable race manifest incomplete: ${Object.entries(manifest).filter(([, value]) => !value).map(([key]) => key).join(', ')}`);
  return manifest;
}

async function verify() {
  const { connectionString, schema, local, disposable } = configuration();
  const client = new Client({
    connectionString,
    application_name: 'obrasaas-project-certificates-verifier',
    statement_timeout: 55_000,
    query_timeout: 60_000,
  });
  await client.connect();
  const item = fixture(`verify_${Date.now()}_${process.pid}`);
  let transactionOpen = false;
  try {
    const schemaExists = await client.query('SELECT to_regnamespace($1) IS NOT NULL exists', [schema]);
    invariant(schemaExists.rows[0].exists, `Configured PostgreSQL schema ${schema} does not exist.`);
    await client.query('BEGIN');
    transactionOpen = true;
    await client.query(`SET LOCAL search_path TO ${quoteIdentifier(schema)},pg_catalog`);
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout='55s'");
    await assertMigration(client, schema, local);
    await assertStructure(client, schema);
    await journey(client, item);
    await client.query('ROLLBACK');
    transactionOpen = false;
    await client.query(`SET search_path TO ${quoteIdentifier(schema)},pg_catalog`);
    await assertRolledBack(client, item);
    const raceManifest = disposable
      ? await assertDisposableConcurrency(connectionString, schema)
      : null;
    console.log(disposable
      ? `Verified S10-CERT rollback journey and committed race manifest: ${Object.keys(raceManifest).join(', ')}.`
      : 'Verified S10-CERT structure, PostgreSQL guards, app ABI, malformed deduction rollback, reject/reprepare/approve, late replay, next period and correction inside rollback-only verification.');
  } finally {
    if (transactionOpen) await client.query('ROLLBACK').catch(() => undefined);
    await client.end();
  }
}

export { appAdapter, assertRolledBack, expectDatabaseError };

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--help') || process.argv.includes('-h')) console.log(help());
  else if (process.argv.length > 2) {
    console.error(`Unknown arguments: ${process.argv.slice(2).join(' ')}`);
    process.exitCode = 1;
  } else {
    verify().catch((error) => {
      console.error(error?.message || 'S10-CERT project certificate verification failed.');
      process.exitCode = 1;
    });
  }
}
