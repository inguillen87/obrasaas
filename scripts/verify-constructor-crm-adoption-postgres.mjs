import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { mkdirSync, writeFileSync } from 'node:fs';
import { constructorCrmDisposableConnection, executeConstructorCrmAdoption, CONSTRUCTOR_CRM_TARGET } from './lib/constructor-crm-migration.mjs';
import { readConstructorCrmCatalog, checkConstructorCrmCatalog, assertConstructorCrmSchema } from '../src/lib/constructor-crm-schema.mjs';
import { inspectConstructorCrmBuildGate } from './lib/constructor-crm-build-gate.mjs';

const checks = [], database = 'obrasaas_crm_adoption_' + randomUUID().replaceAll('-', '');
// Exercise the real production URL parser with ephemeral synthetic userinfo.
// Both gate tests inject a client for the owned local DB; this URL is never used to connect.
const productionFixtureUrl = new URL('postgresql://ep-fixture.example.neon.tech/neondb');
productionFixtureUrl.username = randomUUID(); productionFixtureUrl.password = randomUUID();
let admin, client, locker, created = false;
try {
  const url = constructorCrmDisposableConnection(process.env);
  admin = new Client({ connectionString: url.toString() }); await admin.connect();
  await admin.query(`CREATE DATABASE "${database}"`); created = true;
  url.pathname = '/' + database;
  const connection = { connectionString: url.toString() };
  client = new Client(connection); await client.connect();
  await client.query(`CREATE TABLE public."Organization" (id TEXT PRIMARY KEY);
    CREATE TYPE public."CrmStage" AS ENUM ('NEW','CONTACTED','QUALIFIED','DEMO','PROPOSAL','TRIAL','WON','LOST');
    CREATE TABLE public."CrmAccount" (id TEXT NOT NULL,"organizationId" TEXT,name TEXT NOT NULL,"contactName" TEXT,email TEXT,phone TEXT,segment TEXT,source TEXT,stage public."CrmStage" NOT NULL DEFAULT 'NEW',"estimatedSeats" INTEGER,"estimatedMonthlyValue" DECIMAL(12,2),"nextFollowUpAt" TIMESTAMP(3),notes TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "CrmAccount_pkey" PRIMARY KEY(id));
    CREATE UNIQUE INDEX "CrmAccount_organizationId_key" ON public."CrmAccount"("organizationId");
    CREATE INDEX "CrmAccount_stage_nextFollowUpAt_idx" ON public."CrmAccount"(stage,"nextFollowUpAt");
    CREATE INDEX "CrmAccount_email_idx" ON public."CrmAccount"(email);
    ALTER TABLE public."CrmAccount" ADD CONSTRAINT "CrmAccount_organizationId_fkey" FOREIGN KEY("organizationId") REFERENCES public."Organization"(id) ON DELETE SET NULL ON UPDATE CASCADE;
    INSERT INTO public."Organization" VALUES('org-a'),('org-b'),('legacy-platform');
    INSERT INTO public."CrmAccount"(id,"organizationId",name,email,stage,"estimatedSeats","estimatedMonthlyValue",notes,"updatedAt") VALUES('platform-linked','legacy-platform','Synthetic platform account','platform@example.invalid','DEMO',7,50.25,'Synthetic historical note',CURRENT_TIMESTAMP),('platform-unlinked',NULL,'Synthetic prospect',NULL,'TRIAL',NULL,NULL,NULL,CURRENT_TIMESTAMP)`);
  const historical = (await client.query('SELECT * FROM public."CrmAccount" ORDER BY id')).rows;
  await assert.rejects(assertConstructorCrmSchema(client), { code: 'CONSTRUCTOR_CRM_SCHEMA_PENDING' });
  const before = checkConstructorCrmCatalog(await readConstructorCrmCatalog(client), { allowLegacy: true });
  assert.equal(before.state, 'LEGACY'); assert.equal(before.compatible, true); assert.equal(before.columns, 15); assert.equal(before.constraints, 2); assert.equal(before.indexes, 4);
  checks.push('exact-enterprise-legacy-schema-observed-and-commercial-runtime-fails-closed-before-adoption-including-PG18-not-null-catalog');
  let ddl = 0, tableLocks = 0;
  const observed = { query: async (sql, parameters) => { if (/\b(?:ALTER|CREATE|DROP)\s+(?:TABLE|INDEX)\b/i.test(sql)) ddl++; if (/^LOCK TABLE/.test(sql)) tableLocks++; return client.query(sql, parameters); } };
  const dry = await executeConstructorCrmAdoption(observed);
  assert.equal(dry.status, 'DRY_RUN_READY'); assert.equal(dry.readOnly, true); assert.equal(dry.canApply, true); assert.equal(ddl, 0); assert.equal(tableLocks, 0); assert.deepEqual((await client.query('SELECT * FROM public."CrmAccount" ORDER BY id')).rows, historical);
  checks.push('dry-run-RR-readonly-inspects-catalog-with-no-table-locks-DDL-business-read-or-contact-modification');
  await assert.rejects(executeConstructorCrmAdoption(observed, { mode: 'APPLY', expectedFingerprint: '0'.repeat(64) }), { code: 'CONSTRUCTOR_CRM_MIGRATION_FINGERPRINT_CHANGED' });
  assert.equal(ddl, 0); assert.equal(tableLocks, 0);
  checks.push('changed-catalog-fingerprint-rejects-explicit-apply-before-any-table-lock-or-DDL');
  await client.query('ALTER TABLE public."CrmAccount" ADD COLUMN "ownerOrganizationId" TEXT');
  await assert.rejects(executeConstructorCrmAdoption(observed), { code: 'CONSTRUCTOR_CRM_MIGRATION_SCHEMA_REJECTED' });
  await client.query('ALTER TABLE public."CrmAccount" DROP COLUMN "ownerOrganizationId"');
  checks.push('partial-adoption-is-rejected-instead-of-blind-IF-NOT-EXISTS-or-forced-schema-repair');
  await client.query('SET ROLE pg_read_all_data');
  try {
    const restricted = await executeConstructorCrmAdoption(observed);
    assert.equal(restricted.canApply, false);
    await assert.rejects(executeConstructorCrmAdoption(observed, { mode: 'APPLY', expectedFingerprint: restricted.before.fingerprint }), { code: 'CONSTRUCTOR_CRM_MIGRATION_PERMISSION_REQUIRED' });
  } finally { await client.query('RESET ROLE'); }
  checks.push('catalog-privileges-distinguish-readable-schema-from-real-ALTER-FK-and-index-authority-without-changing-roles');
  locker = new Client(connection); await locker.connect(); await locker.query('BEGIN'); await locker.query('SELECT id FROM public."CrmAccount" WHERE id=\'platform-linked\' FOR SHARE');
  try { await assert.rejects(executeConstructorCrmAdoption(observed, { mode: 'APPLY', expectedFingerprint: dry.before.fingerprint }), { code: '55P03' }); }
  finally { await locker.query('ROLLBACK'); await locker.end(); locker = null; }
  assert.equal((await readConstructorCrmCatalog(client)).columns.length, 15);
  checks.push('live-conflicting-reader-causes-bounded-lock-timeout-and-full-rollback-with-no-partial-columns');
  const breakPostcheck = { query: async (sql, parameters) => { const result = await client.query(sql, parameters); if (sql.includes('ADD COLUMN "ownerOrganizationId"')) await client.query('DROP INDEX public."CrmAccount_ownerOrganizationId_id_idx"'); return result; } };
  await assert.rejects(executeConstructorCrmAdoption(breakPostcheck, { mode: 'APPLY', expectedFingerprint: dry.before.fingerprint }), { code: 'CONSTRUCTOR_CRM_MIGRATION_POSTCHECK_FAILED' });
  assert.equal((await readConstructorCrmCatalog(client)).columns.length, 15);
  checks.push('failed-after-schema-contract-check-rolls-back-all-additive-DDL-atomically');
  const applied = await executeConstructorCrmAdoption(observed, { mode: 'APPLY', expectedFingerprint: dry.before.fingerprint });
  assert.equal(applied.status, 'APPLIED'); assert.equal(applied.ddlExecuted, true); assert.equal(applied.after.columns, 17); assert.equal(applied.after.constraints, 5); assert.equal(applied.after.indexes, 5); assert.equal(applied.destructive, false); await assertConstructorCrmSchema(client);
  const afterRecords = (await client.query('SELECT * FROM public."CrmAccount" ORDER BY id')).rows;
  assert.deepEqual(afterRecords.map(({ ownerOrganizationId, revision, ...record }) => { assert.equal(ownerOrganizationId, null); assert.equal(revision, 1); return record; }), historical);
  checks.push('additive-owner-revision-checks-and-index-pass-contract-and-preserve-every-legacy-contact-link-and-SaaS-value');
  ddl = 0; tableLocks = 0;
  const repeat = await executeConstructorCrmAdoption(observed, { mode: 'APPLY', expectedFingerprint: dry.before.fingerprint });
  assert.equal(repeat.status, 'ALREADY_ADOPTED'); assert.equal(repeat.ddlExecuted, false); assert.equal(repeat.expectedFingerprintMatched, false); assert.equal(ddl, 0); assert.equal(tableLocks, 0);
  checks.push('repeat-after-lost-acknowledgement-is-observed-as-already-adopted-without-reapplying-DDL-or-pretending-old-fingerprint-matches');
  await client.query(`INSERT INTO public."CrmAccount"(id,"ownerOrganizationId",name,"updatedAt") VALUES('a-one','org-a','Synthetic client one',CURRENT_TIMESTAMP),('a-two','org-a','Synthetic client two',CURRENT_TIMESTAMP),('b-one','org-b','Synthetic client B',CURRENT_TIMESTAMP)`);
  await assert.rejects(client.query(`INSERT INTO public."CrmAccount"(id,"ownerOrganizationId","organizationId",name,"updatedAt") VALUES('mixed','org-a','legacy-platform','Invalid ownership',CURRENT_TIMESTAMP)`), { code: '23514' });
  await assert.rejects(client.query(`INSERT INTO public."CrmAccount"(id,"ownerOrganizationId",name,"updatedAt") VALUES('orphan','missing-org','Invalid owner',CURRENT_TIMESTAMP)`), { code: '23503' });
  await assert.rejects(client.query(`UPDATE public."CrmAccount" SET revision=0 WHERE id='a-one'`), { code: '23514' });
  await assert.rejects(client.query(`DELETE FROM public."Organization" WHERE id='org-a'`), error => ['23503', '23001'].includes(error.code) && error.constraint === 'CrmAccount_ownerOrganizationId_fkey');
  assert.deepEqual((await client.query('SELECT id FROM public."CrmAccount" WHERE "ownerOrganizationId"=$1 AND "organizationId" IS NULL ORDER BY id', ['org-a'])).rows.map(row => row.id), ['a-one', 'a-two']);
  assert.deepEqual((await client.query('SELECT id FROM public."CrmAccount" WHERE "ownerOrganizationId" IS NULL ORDER BY id')).rows.map(row => row.id), ['platform-linked', 'platform-unlinked']);
  checks.push('multiple-company-clients-coexist-with-NULL-owner-platform-cards-and-database-rejects-mixed-owner-orphan-zero-revision-and-owner-deletion');
  await assert.rejects(client.query(`INSERT INTO public."CrmAccount"(id,"organizationId",name,"updatedAt") VALUES('duplicate-platform','legacy-platform','Duplicate',CURRENT_TIMESTAMP)`), { code: '23505' });
  await client.query(`DELETE FROM public."Organization" WHERE id='legacy-platform'`);
  assert.equal((await client.query(`SELECT "organizationId" FROM public."CrmAccount" WHERE id='platform-linked'`)).rows[0].organizationId, null);
  checks.push('legacy-platform-unique-link-and-SET-NULL-delete-rule-are-preserved-separately-from-tenant-owner-RESTRICT');
  await client.query('ALTER TABLE public."CrmAccount" DROP CONSTRAINT "CrmAccount_revision_check"');
  await client.query('ALTER TABLE public."CrmAccount" ADD CONSTRAINT "CrmAccount_revision_check" CHECK(revision>=1) NOT VALID');
  await assert.rejects(assertConstructorCrmSchema(client), { code: 'CONSTRUCTOR_CRM_SCHEMA_INCOMPATIBLE' });
  await client.query('ALTER TABLE public."CrmAccount" VALIDATE CONSTRAINT "CrmAccount_revision_check"');
  const serverVersion = Number((await client.query("SELECT current_setting('server_version_num') AS version")).rows[0].version);
  if (serverVersion >= 180000) {
    await client.query('ALTER TABLE public."CrmAccount" DROP CONSTRAINT "CrmAccount_revision_check"');
    await client.query('ALTER TABLE public."CrmAccount" ADD CONSTRAINT "CrmAccount_revision_check" CHECK(revision>=1) NOT ENFORCED');
    await assert.rejects(assertConstructorCrmSchema(client), { code: 'CONSTRUCTOR_CRM_SCHEMA_INCOMPATIBLE' });
    await client.query('ALTER TABLE public."CrmAccount" DROP CONSTRAINT "CrmAccount_revision_check"');
    await client.query('ALTER TABLE public."CrmAccount" ADD CONSTRAINT "CrmAccount_revision_check" CHECK(revision>=1)');
  }
  await client.query('DROP INDEX public."CrmAccount_ownerOrganizationId_id_idx"');
  await client.query('CREATE INDEX "CrmAccount_ownerOrganizationId_id_idx" ON public."CrmAccount"(id,"ownerOrganizationId")');
  await assert.rejects(assertConstructorCrmSchema(client), { code: 'CONSTRUCTOR_CRM_SCHEMA_INCOMPATIBLE' });
  await client.query('DROP INDEX public."CrmAccount_ownerOrganizationId_id_idx"'); await client.query('CREATE INDEX "CrmAccount_ownerOrganizationId_id_idx" ON public."CrmAccount"("ownerOrganizationId",id)');
  checks.push('runtime-rejects-unvalidated-or-PG18-unenforced-checks-and-wrong-keyset-index-despite-identical-object-names');
  const build = await inspectConstructorCrmBuildGate({ environment: { VERCEL_ENV: 'production', VERCEL_PROJECT_ID: CONSTRUCTOR_CRM_TARGET.projectId, NEXT_PUBLIC_APP_URL: CONSTRUCTOR_CRM_TARGET.origin, CI: 'true', DATABASE_URL: productionFixtureUrl.toString() }, makeClient: () => new Client(connection) });
  assert.equal(build.required, true); assert.equal(build.passed, true); assert.equal(build.readOnly, true); assert.equal(build.ddlExecuted, false); assert.equal(build.businessRowsRead, 0);
  checks.push('mandatory-production-prebuild-reader-verifies-adopted-schema-in-real-local-RR-readonly-transaction-without-claiming-production-acceptance');
  const lateFailure = await inspectConstructorCrmBuildGate({ environment: { VERCEL_ENV: 'production', VERCEL_PROJECT_ID: CONSTRUCTOR_CRM_TARGET.projectId, NEXT_PUBLIC_APP_URL: CONSTRUCTOR_CRM_TARGET.origin, DATABASE_URL: productionFixtureUrl.toString() }, makeClient: () => {
    const value = new Client(connection), end = value.end.bind(value);
    value.end = async () => { await end(); value.emit('error', new Error('Synthetic private connection diagnostic')); };
    return value;
  } });
  assert.equal(lateFailure.passed, false); assert.equal(lateFailure.status, 'UNCONFIRMED'); assert.doesNotMatch(JSON.stringify(lateFailure), /private connection diagnostic/);
  checks.push('unexpected-connection-event-even-after-successful-read-prevents-a-green-production-gate-and-keeps-diagnostics-private');
  const report = { status: 'PASS', environment: 'disposable-local-postgresql', checks, source: 'enterprise-1677ff7-normalizer-and-current-production-catalog-20261002', adoptedSchemaVersion: applied.version, productionDDLExecuted: false, productionDataWritten: false, productionContactsRead: false, providersCalled: false, humanCrmAccepted: false };
  mkdirSync('.vercel/constructor-crm-adoption-evidence', { recursive: true }); writeFileSync('.vercel/constructor-crm-adoption-evidence/postgres.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} finally {
  if (locker) { await locker.query('ROLLBACK'); await locker.end(); }
  try { if (client) await client.end(); if (created) await admin.query(`DROP DATABASE "${database}"`); }
  finally { if (admin) await admin.end(); }
}
