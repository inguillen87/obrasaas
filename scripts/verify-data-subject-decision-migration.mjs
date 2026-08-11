import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import pg from 'pg';

import {
  buildWorkerPersonDiscoveryManifest,
  privacyAdminAttestationEvidenceSha256,
  privacyDiscoveryCatalogDescriptor,
  privacyOperationKeyHash,
  privacyRequestFingerprint,
  PRIVACY_DISCOVERY_CATALOG_SHA256,
  PRIVACY_DISCOVERY_CATALOG_VERSION,
} from '../src/lib/privacy-discovery.js';

const CONNECTION_ENV = 'DATA_SUBJECT_DECISION_MIGRATION_DATABASE_URL';
const SCHEMA_ENV = 'DATA_SUBJECT_DECISION_MIGRATION_SCHEMA';
const DISPOSABLE_ENV = 'DATA_SUBJECT_DECISION_DISPOSABLE_CONCURRENCY';
const MIGRATION = '20260811160000_data_subject_decision_control_plane';
const SCHEMA_PATTERN = /^[A-Za-z_][A-Za-z0-9_$]{0,62}$/;
const migrationPath = new URL(
  '../prisma/migrations/20260811160000_data_subject_decision_control_plane/migration.sql',
  import.meta.url,
);

const HELP = `Usage:
  npm run verify:data-subject-decision-migration

Required environment variables:
  ${CONNECTION_ENV}   Dedicated PostgreSQL 17 verification URL.
  ${SCHEMA_ENV}       Explicit applied schema (public for callable functions).

Optional:
  ${DISPOSABLE_ENV}=1 runs committed two-connection races only on local obrasaas_ci/public.

DATABASE_URL is intentionally ignored. Default fixtures are rollback-only.`;

const args = process.argv.slice(2);
const helpRequested = args.includes('--help') || args.includes('-h');
if (!helpRequested) assert.deepEqual(args, [], `Unknown arguments: ${args.join(' ')}`);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

function normalizeDefinition(value) {
  return String(value || '').replaceAll('"', '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function connectionConfiguration() {
  const raw = String(process.env[CONNECTION_ENV] || '').trim();
  const schema = String(process.env[SCHEMA_ENV] || '').trim();
  invariant(raw, `${CONNECTION_ENV} is required; DATABASE_URL is intentionally ignored.`);
  invariant(schema && SCHEMA_PATTERN.test(schema), `${SCHEMA_ENV} must be an explicit safe identifier.`);
  invariant(schema === 'public', `${SCHEMA_ENV} must be public for the frozen callable-function contract.`);
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${CONNECTION_ENV} must be a valid PostgreSQL URL.`);
  }
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
  const disposableRaw = String(process.env[DISPOSABLE_ENV] || '0').trim();
  invariant(disposableRaw === '0' || disposableRaw === '1', `${DISPOSABLE_ENV} must be exactly 0 or 1.`);
  const disposableConcurrency = disposableRaw === '1';
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (disposableConcurrency) {
    invariant(
      local && databaseName === 'obrasaas_ci' && schema === 'public',
      `${DISPOSABLE_ENV}=1 is restricted to local obrasaas_ci/public.`,
    );
  }
  return { connectionString: parsed.toString(), disposableConcurrency, local, schema };
}

const ENUMS = Object.freeze({
  DataSubjectRequesterKind: ['SELF', 'REPRESENTATIVE'],
  DataSubjectVerificationEventKind: ['VERIFIED', 'REVOKED'],
  DataSubjectAssuranceLevel: ['SUBSTANTIAL'],
  DataSubjectLegalDeadlineMethod: ['REVIEWED_EXPLICIT_DATE'],
  DataSubjectHoldScopeKind: ['ITEM', 'CATEGORY'],
  DataSubjectHoldEventKind: ['CREATED', 'REVIEWED', 'RELEASED'],
  DataSubjectDecisionStatus: ['DRAFTING', 'PENDING_APPROVAL', 'SEALED_BLOCKED', 'REJECTED'],
  DataSubjectDecisionAction: [
    'DISCLOSE_CANDIDATE', 'CORRECT_CANDIDATE', 'RESTRICT_CANDIDATE',
    'PORTABILITY_CANDIDATE', 'ERASE_CANDIDATE', 'CRYPTO_ERASE_CANDIDATE',
    'PSEUDONYMIZE_CANDIDATE', 'KEEP_WITH_BASIS', 'WITHHOLD_WITH_BASIS',
    'NO_CHANGE_WITH_BASIS', 'UNRESOLVED',
  ],
});

const TABLES = Object.freeze([
  'DataSubjectRequesterVerificationEvent',
  'DataSubjectLegalAssessmentRevision',
  'DataSubjectLegalHold',
  'DataSubjectLegalHoldEvent',
  'DataSubjectDecisionSet',
  'DataSubjectDecisionItem',
]);

const MUTATIONS = Object.freeze([
  ['obrasaas_data_subject_verification_event_append', 21],
  ['obrasaas_data_subject_legal_assessment_append', 15],
  ['obrasaas_data_subject_hold_create', 16],
  ['obrasaas_data_subject_hold_event_append', 16],
  ['obrasaas_data_subject_decision_create', 13],
  ['obrasaas_data_subject_decision_decide', 10],
]);

const LOCKING_GUARD_FUNCTIONS = Object.freeze([
  ['obrasaas_data_subject_verification_event_guard', 1],
  ['obrasaas_data_subject_legal_assessment_guard', 1],
  ['obrasaas_data_subject_legal_hold_guard', 1],
  ['obrasaas_data_subject_legal_hold_event_guard', 2],
  ['obrasaas_data_subject_decision_set_insert_guard', 1],
  ['obrasaas_data_subject_decision_set_lifecycle_guard', 2],
]);

const TRIGGERS = Object.freeze([
  'DataSubjectVerificationEvent_guard',
  'DataSubjectVerificationEvent_append_only',
  'DataSubjectVerificationEvent_no_truncate',
  'DataSubjectLegalAssessment_guard',
  'DataSubjectLegalAssessment_append_only',
  'DataSubjectLegalAssessment_no_truncate',
  'DataSubjectLegalHold_guard',
  'DataSubjectLegalHold_initial_event_check',
  'DataSubjectLegalHold_append_only',
  'DataSubjectLegalHold_no_truncate',
  'DataSubjectLegalHoldEvent_guard',
  'DataSubjectLegalHoldEvent_append_only',
  'DataSubjectLegalHoldEvent_no_truncate',
  'DataSubjectDecisionSet_insert_guard',
  'DataSubjectDecisionSet_lifecycle_guard',
  'DataSubjectDecisionSet_terminal_check',
  'DataSubjectDecisionSet_no_delete',
  'DataSubjectDecisionSet_no_truncate',
  'DataSubjectDecisionItem_guard',
  'DataSubjectDecisionItem_append_only',
  'DataSubjectDecisionItem_no_truncate',
]);

const PRO05A_TRIGGERS = Object.freeze({
  DataSubjectRequest: [
    'DataSubjectRequest_insert_guard', 'DataSubjectRequest_lifecycle_guard',
    'DataSubjectRequest_no_delete', 'DataSubjectRequest_no_truncate',
  ],
  DataSubjectDiscoveryManifest: [
    'DataSubjectDiscoveryManifest_seal', 'DataSubjectDiscoveryManifest_terminal_check',
    'DataSubjectDiscoveryManifest_append_only', 'DataSubjectDiscoveryManifest_no_truncate',
  ],
  DataSubjectDiscoveryItem: [
    'DataSubjectDiscoveryItem_before_seal', 'DataSubjectDiscoveryItem_append_only',
    'DataSubjectDiscoveryItem_no_truncate',
  ],
});

const PRO05B_TRIGGERS = Object.freeze({
  DataSubjectRequesterVerificationEvent: TRIGGERS.slice(0, 3),
  DataSubjectLegalAssessmentRevision: TRIGGERS.slice(3, 6),
  DataSubjectLegalHold: TRIGGERS.slice(6, 10),
  DataSubjectLegalHoldEvent: TRIGGERS.slice(10, 13),
  DataSubjectDecisionSet: TRIGGERS.slice(13, 18),
  DataSubjectDecisionItem: TRIGGERS.slice(18, 21),
});

async function assertServerVersion(client) {
  const result = await client.query('SHOW server_version_num');
  invariant(Number(result.rows[0]?.server_version_num) >= 170000, 'PRO-05B requires PostgreSQL 17 or later.');
}

async function assertMigrationLedger(client, schema, local) {
  const relation = await client.query('SELECT to_regclass($1) AS name', [`${schema}._prisma_migrations`]);
  if (!relation.rows[0]?.name) {
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
  invariant(result.rows[0].finished_at && !result.rows[0].rolled_back_at, `${MIGRATION} is not durably applied.`);
  const checksum = createHash('sha256').update(await readFile(migrationPath, 'utf8')).digest('hex');
  invariant(result.rows[0].checksum === checksum, `${MIGRATION} checksum drifted.`);
}

async function assertInstalledObjects(client, schema) {
  const tables = await client.query(
    `SELECT tablename FROM pg_tables
      WHERE schemaname = $1 AND tablename = ANY($2::text[])`,
    [schema, TABLES],
  );
  assert.deepEqual(tables.rows.map((row) => row.tablename).sort(), [...TABLES].sort());

  const enums = await client.query(
    `SELECT t.typname AS name, array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS labels
       FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
       JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = $1 AND t.typname = ANY($2::text[])
      GROUP BY t.typname`,
    [schema, Object.keys(ENUMS)],
  );
  const enumMap = new Map(enums.rows.map((row) => [row.name, row.labels]));
  for (const [name, expected] of Object.entries(ENUMS)) {
    assert.deepEqual(enumMap.get(name), expected, `Enum ${name} drifted.`);
  }

  const functions = await client.query(
    `SELECT p.proname AS name, p.pronargs AS argument_count, p.provolatile AS volatility,
            p.prosecdef AS security_definer, pg_get_functiondef(p.oid) AS definition
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = $1 AND p.proname = ANY($2::text[])`,
    [schema, [
      ...MUTATIONS.map(([name]) => name),
      ...LOCKING_GUARD_FUNCTIONS.map(([name]) => name),
      'obrasaas_data_subject_hold_set_sha256',
    ]],
  );
  const functionMap = new Map(functions.rows.map((row) => [row.name, row]));
  for (const [name, argumentCount] of MUTATIONS) {
    const row = functionMap.get(name);
    invariant(row?.argument_count === argumentCount, `${name} signature drifted.`);
    invariant(row.volatility === 'v' && row.security_definer === false, `${name} must be VOLATILE SECURITY INVOKER.`);
    const definition = normalizeDefinition(row.definition);
    invariant(definition.includes('for update'), `${name} does not serialize on DataSubjectRequest.`);
    invariant(definition.includes('for share'), `${name} does not hold the active ADMIN membership.`);
  }
  for (const [name, expectedMembershipLocks] of LOCKING_GUARD_FUNCTIONS) {
    const row = functionMap.get(name);
    invariant(row, `${name} is absent.`);
    const definition = normalizeDefinition(row.definition);
    const membershipReads = definition.match(/select true from %i\.tenantmembership\b/g) || [];
    const membershipLocks = definition.match(
      /select true from %i\.tenantmembership\b.*?for share/g,
    ) || [];
    const nullSafeChecks = definition.match(/is distinct from true/g) || [];
    invariant(
      membershipReads.length === expectedMembershipLocks
        && membershipLocks.length === expectedMembershipLocks,
      `${name} does not lock every qualifying actor/owner membership FOR SHARE.`,
    );
    invariant(
      nullSafeChecks.length >= expectedMembershipLocks,
      `${name} does not fail closed when a locked membership is absent.`,
    );
  }
  invariant(functionMap.get('obrasaas_data_subject_hold_set_sha256')?.argument_count === 3, 'Hold-set hash helper drifted.');

  const triggers = await client.query(
    `SELECT trigger.tgname AS name, trigger.tgenabled,
            trigger.tgconstraint, trigger.tgdeferrable, trigger.tginitdeferred,
            pg_get_triggerdef(trigger.oid, true) AS definition,
            function_namespace.nspname AS function_schema
       FROM pg_trigger AS trigger
       JOIN pg_class AS relation ON relation.oid = trigger.tgrelid
       JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
       JOIN pg_proc AS procedure ON procedure.oid = trigger.tgfoid
       JOIN pg_namespace AS function_namespace ON function_namespace.oid = procedure.pronamespace
      WHERE namespace.nspname = $1 AND trigger.tgname = ANY($2::text[])
        AND trigger.tgisinternal = false`,
    [schema, TRIGGERS],
  );
  const triggerMap = new Map(triggers.rows.map((row) => [row.name, row]));
  for (const name of TRIGGERS) {
    const row = triggerMap.get(name);
    invariant(row?.tgenabled === 'A', `${name} is absent or not ENABLE ALWAYS.`);
    invariant(row.function_schema === schema, `${name} calls a function outside the governed schema.`);
    if (name.endsWith('_no_truncate')) invariant(String(row.definition).includes('TRUNCATE'), `${name} is not a TRUNCATE trigger.`);
  }
  for (const name of ['DataSubjectLegalHold_initial_event_check', 'DataSubjectDecisionSet_terminal_check']) {
    const row = triggerMap.get(name);
    invariant(Number(row?.tgconstraint) > 0 && row.tgdeferrable && row.tginitdeferred, `${name} must be deferred.`);
  }

  const foreignKeys = await client.query(
    `SELECT c.conname, c.confdeltype
       FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = $1 AND t.relname = ANY($2::text[]) AND c.contype = 'f'`,
    [schema, TABLES],
  );
  invariant(foreignKeys.rows.length >= 25, 'Tenant-scoped PRO-05B foreign keys are incomplete.');
  invariant(foreignKeys.rows.every((row) => row.confdeltype === 'r'), 'Every PRO-05B foreign key must use ON DELETE RESTRICT.');

  const checks = await client.query(
    `SELECT c.conname, pg_get_constraintdef(c.oid, true) AS definition
       FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = $1 AND c.conname = ANY($2::text[])`,
    [schema, [
      'DataSubjectVerificationEvent_sequence_check',
      'DataSubjectLegalAssessment_sequence_check',
      'DataSubjectLegalHoldEvent_sequence_check',
      'DataSubjectDecisionSet_revision_check',
      'DataSubjectDecisionSet_state_shape_check',
      'DataSubjectDecisionItem_ordinal_check',
    ]],
  );
  const checkMap = new Map(checks.rows.map((row) => [row.conname, normalizeDefinition(row.definition)]));
  for (const name of [
    'DataSubjectVerificationEvent_sequence_check',
    'DataSubjectLegalAssessment_sequence_check',
    'DataSubjectLegalHoldEvent_sequence_check',
    'DataSubjectDecisionSet_revision_check',
  ]) invariant(checkMap.get(name)?.includes('>= 1'), `${name} must start at one.`);
  const ordinalCheck = checkMap
    .get('DataSubjectDecisionItem_ordinal_check')
    ?.replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  invariant(
    ordinalCheck?.includes('ordinal between 0 and 1023')
      || ordinalCheck?.includes('ordinal >= 0 and ordinal <= 1023'),
    'Decision item bound drifted.',
  );

  const riskyColumns = await client.query(
    `SELECT table_name, column_name, data_type
       FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = ANY($2::text[])
        AND (
          data_type IN ('json', 'jsonb', 'bytea')
          OR lower(column_name) ~ '(document|payload|content|body|email|phone|cuil|cbu|cvu|alias|address|locator)'
        )`,
    [schema, TABLES],
  );
  assert.deepEqual(riskyColumns.rows, [], 'PRO-05B persisted a prohibited raw/sensitive field.');
}

function hash(marker) {
  return createHash('sha256').update(`pro05b:${marker}`).digest('hex');
}

async function setTriggerModes(client, mapping, mode) {
  invariant(['DISABLE', 'ENABLE ALWAYS'].includes(mode), 'Unexpected trigger mode.');
  for (const [table, triggers] of Object.entries(mapping)) {
    for (const trigger of triggers) {
      await client.query(
        `ALTER TABLE ${quoteIdentifier(table)} ${mode} TRIGGER ${quoteIdentifier(trigger)}`,
      );
    }
  }
}

async function seedFixture(client, suffix, marker = 'main') {
  const ids = {
    suffix,
    organization: `privacy_b_org_${marker}_${suffix}`,
    crossOrganization: `privacy_b_cross_org_${marker}_${suffix}`,
    userA: `privacy_b_user_a_${marker}_${suffix}`,
    userB: `privacy_b_user_b_${marker}_${suffix}`,
    userCross: `privacy_b_user_cross_${marker}_${suffix}`,
    adminA: `privacy_b_admin_a_${marker}_${suffix}`,
    adminB: `privacy_b_admin_b_${marker}_${suffix}`,
    adminCross: `privacy_b_admin_cross_${marker}_${suffix}`,
    worker: `privacy_b_worker_${marker}_${suffix}`,
    request: `privacy_b_request_${marker}_${suffix}`,
    manifest: `privacy_b_manifest_${marker}_${suffix}`,
    item: `privacy_b_item_${marker}_${suffix}`,
    manifestSha256: hash(`manifest:${marker}:${suffix}`),
    identityEvidenceSha256: hash(`identity:${marker}:${suffix}`),
  };
  await client.query(
    `INSERT INTO "Organization" ("id", "name", "slug", "updatedAt")
     VALUES ($1, 'PRO-05B verifier', $2, CURRENT_TIMESTAMP),
            ($3, 'PRO-05B cross verifier', $4, CURRENT_TIMESTAMP)`,
    [ids.organization, `${ids.organization}-slug`, ids.crossOrganization, `${ids.crossOrganization}-slug`],
  );
  for (const [user, label] of [[ids.userA, 'a'], [ids.userB, 'b'], [ids.userCross, 'cross']]) {
    await client.query(
      `INSERT INTO "PlatformUser" ("id", "clerkUserId", "primaryEmail", "fullName", "updatedAt")
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [user, `clerk_${user}`, `${label}-${suffix}@verifier.invalid`, `Verifier ${label}`],
    );
  }
  for (const [membership, organization, user] of [
    [ids.adminA, ids.organization, ids.userA],
    [ids.adminB, ids.organization, ids.userB],
    [ids.adminCross, ids.crossOrganization, ids.userCross],
  ]) {
    await client.query(
      `INSERT INTO "TenantMembership" (
         "id", "organizationId", "userId", "tenantRole", "status", "updatedAt"
       ) VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE', CURRENT_TIMESTAMP)`,
      [membership, organization, user],
    );
  }
  const envelope = `v3.${'a'.repeat(16)}.${'b'.repeat(22)}.${'c'.repeat(24)}.${'d'.repeat(16)}.${'e'.repeat(22)}.${'f'.repeat(43)}`;
  await client.query(
    `INSERT INTO "WorkerPerson" (
       "id", "organizationId", "identityStatus", "encryptedIdentityPayload",
       "cuilFingerprint", "cuilFingerprintKeyId", "cuilLastFour", "wrappingKeyId",
       "recordVersion", "privacyNoticeVersion", "privacyAcceptedAt", "identityVerifiedAt",
       "identityVerifiedByMembershipId", "identityDecisionEvidenceHash", "updatedAt"
     ) VALUES (
       $1, $2, 'VERIFIED', $3, $4, 'privacy-verifier-key-v1', '1234',
       'privacy-wrapping-key-v1', 1, 'privacy-notice-v1', CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP, $5, $6, CURRENT_TIMESTAMP
     )`,
    [ids.worker, ids.organization, envelope, hash(`cuil:${marker}:${suffix}`), ids.adminA, ids.identityEvidenceSha256],
  );

  const requestOperationKeyHash = privacyOperationKeyHash(
    ids.organization,
    `privacy-b-request-${marker}-${suffix}`,
  );
  const requestFingerprint = privacyRequestFingerprint({
    organizationId: ids.organization,
    personId: ids.worker,
    requestType: 'ACCESS',
  });
  await client.query(
    `INSERT INTO "DataSubjectRequest" (
       "id", "organizationId", "type", "subjectKind", "workerPersonId",
       "operationKeyHash", "requestFingerprint", "receivedByMembershipId", "updatedAt"
     ) VALUES ($1, $2, 'ACCESS', 'WORKER_PERSON', $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
    [ids.request, ids.organization, ids.worker, requestOperationKeyHash, requestFingerprint, ids.adminA],
  );
  const attestationEvidence = privacyAdminAttestationEvidenceSha256({
    organizationId: ids.organization,
    requestId: ids.request,
    personId: ids.worker,
    requestType: 'ACCESS',
    actorMembershipId: ids.adminA,
  });
  await client.query(
    `UPDATE "DataSubjectRequest"
        SET "status" = 'AUTHORITY_ATTESTED',
            "attestedByMembershipId" = $2,
            "attestationPolicyVersion" = 'tenant-admin-privacy-intake-v1',
            "attestationMethod" = 'AUTHENTICATED_TENANT_ADMIN_ATTESTATION',
            "attestationEvidenceSha256" = $3,
            "discoveryCatalogVersion" = $4,
            "discoveryCatalogSha256" = $5,
            "revision" = "revision" + 1
      WHERE "organizationId" = $1 AND "id" = $6`,
    [ids.organization, ids.adminA, attestationEvidence, PRIVACY_DISCOVERY_CATALOG_VERSION,
      PRIVACY_DISCOVERY_CATALOG_SHA256, ids.request],
  );
  await client.query(
    `UPDATE "DataSubjectRequest"
        SET "status" = 'DISCOVERING', "revision" = "revision" + 1
      WHERE "organizationId" = $1 AND "id" = $2`,
    [ids.organization, ids.request],
  );
  const snapshot = (await client.query(
    `SELECT greatest("discoveryStartedAt", statement_timestamp()) AS snapshot
       FROM "DataSubjectRequest"
      WHERE "organizationId" = $1 AND "id" = $2`,
    [ids.organization, ids.request],
  )).rows[0].snapshot;
  const rowsByFamily = new Map(
    privacyDiscoveryCatalogDescriptor().records.map((entry) => [entry.family, []]),
  );
  rowsByFamily.set('worker-person', [{ id: ids.worker, recordVersion: 1 }]);
  const discovery = buildWorkerPersonDiscoveryManifest({
    organizationId: ids.organization,
    requestId: ids.request,
    requestOperationKeyHash,
    requestFingerprint,
    sealedByMembershipId: ids.adminA,
    sourceSnapshotAt: snapshot,
    rowsByFamily,
    key: Buffer.alloc(32, 0x6b),
    keyId: 'privacy-verifier-key-v1',
    extraBlockers: [
      {
        category: 'LABOR',
        resourceType: 'Worker',
        fieldSetCode: 'worker-project-link-v1',
        blockerCode: 'WORKER_PROJECT_LINKS_PARTIAL',
      },
      {
        category: 'PERSONAL',
        resourceType: 'WorkerOnboardingClaim',
        fieldSetCode: 'resolved-onboarding-claim-v1',
        blockerCode: 'WORKER_ONBOARDING_CLAIMS_PARTIAL',
      },
    ],
  });
  ids.manifest = discovery.manifest.id;
  ids.manifestSha256 = discovery.manifest.manifestSha256;
  ids.items = discovery.items;
  ids.item = discovery.items[0].id;
  const coverageBlockerCount = discovery.items.filter(
    (item) => item.kind === 'COVERAGE_BLOCKER',
  ).length;
  invariant(
    discovery.manifest.itemCount === 9
      && discovery.manifest.blockerCount === 9
      && coverageBlockerCount === 8,
    'PRO-05B fixture must retain one review-required record plus eight coverage blockers.',
  );
  for (const item of discovery.items) {
    await client.query(
      `INSERT INTO "DataSubjectDiscoveryItem" (
         "id", "organizationId", "requestId", "manifestId", "ordinal", "kind", "category",
         "sourceSystem", "resourceType", "fieldSetCode", "fingerprintKeyId",
         "locatorFingerprintHmac", "recordFingerprintHmac", "disposition",
         "retentionPolicyVersion", "retentionBasisCode", "retentionUntil", "blockerCode", "observedAt"
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
      [
        item.id, item.organizationId, item.requestId, item.manifestId, item.ordinal,
        item.kind, item.category, item.sourceSystem, item.resourceType, item.fieldSetCode,
        item.fingerprintKeyId, item.locatorFingerprintHmac, item.recordFingerprintHmac,
        item.disposition, item.retentionPolicyVersion, item.retentionBasisCode,
        item.retentionUntil, item.blockerCode, item.observedAt,
      ],
    );
  }
  const manifest = discovery.manifest;
  await client.query(
    `INSERT INTO "DataSubjectDiscoveryManifest" (
       "id", "organizationId", "requestId", "outcome", "schemaVersion",
       "catalogVersion", "catalogSha256", "sourceSnapshotAt", "itemCount", "blockerCount",
       "manifestSha256", "operationKeyHash", "requestFingerprint", "sealedByMembershipId"
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      manifest.id, manifest.organizationId, manifest.requestId, manifest.outcome,
      manifest.schemaVersion, manifest.catalogVersion, manifest.catalogSha256,
      manifest.sourceSnapshotAt, manifest.itemCount, manifest.blockerCount,
      manifest.manifestSha256, manifest.operationKeyHash, manifest.requestFingerprint,
      manifest.sealedByMembershipId,
    ],
  );
  const terminalStatus = manifest.outcome === 'COMPLETE'
    ? 'DISCOVERED'
    : 'DISCOVERY_BLOCKED';
  await client.query(
    `UPDATE "DataSubjectRequest"
        SET "status" = $3::"DataSubjectRequestStatus",
            "completedByMembershipId" = $4,
            "revision" = "revision" + 1
      WHERE "organizationId" = $1 AND "id" = $2`,
    [ids.organization, ids.request, terminalStatus, ids.adminA],
  );
  return ids;
}

const VERIFY_SQL = 'SELECT * FROM obrasaas_data_subject_verification_event_append($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)';
const ASSESS_SQL = 'SELECT * FROM obrasaas_data_subject_legal_assessment_append($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)';
const HOLD_CREATE_SQL = 'SELECT * FROM obrasaas_data_subject_hold_create($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)';
const HOLD_EVENT_SQL = 'SELECT * FROM obrasaas_data_subject_hold_event_append($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)';
const DECISION_CREATE_SQL = 'SELECT * FROM obrasaas_data_subject_decision_create($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)';
const DECIDE_SQL = 'SELECT * FROM obrasaas_data_subject_decision_decide($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)';

let savepointNumber = 0;
async function expectFailure(client, operation, expectedCode, label) {
  savepointNumber += 1;
  const savepoint = `pro05b_expected_${savepointNumber}`;
  await client.query(`SAVEPOINT ${savepoint}`);
  let caught;
  try {
    await operation();
  } catch (error) {
    caught = error;
  }
  await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
  await client.query(`RELEASE SAVEPOINT ${savepoint}`);
  await client.query('SET CONSTRAINTS ALL DEFERRED');
  invariant(caught, `${label} unexpectedly succeeded.`);
  invariant(caught.code === expectedCode, `${label} returned ${caught.code || 'unknown'}, expected ${expectedCode}.`);
}

function verificationParameters(ids, operationMarker = 'verify') {
  return [
    ids.organization, ids.request, ids.adminA, hash(`${operationMarker}-op:${ids.suffix}`),
    hash(`${operationMarker}-fp:${ids.suffix}`), 'privacy-review-fingerprint-v1',
    'VERIFIED', null, 'SELF', 'SUBSTANTIAL', 'CANONICAL_WORKER_IDENTITY_PLUS_CHALLENGE',
    'self-verification-v1', hash(`requester:${ids.suffix}`), ids.identityEvidenceSha256,
    hash(`challenge:${ids.suffix}`), 1, null, null,
    new Date(Date.now() + 24 * 60 * 60 * 1000), null, null,
  ];
}

async function prepareDecision(client, ids, marker = 'main') {
  const verificationParams = verificationParameters(ids, `${marker}-verify`);
  const verification = (await client.query(VERIFY_SQL, verificationParams)).rows[0];
  invariant(verification.sequence === 1 && verification.replayed === false, 'SELF verification sequence one failed.');
  assert.deepEqual(
    Object.keys(verification).sort(),
    ['event_id', 'event_kind', 'occurred_at', 'replayed', 'sequence'],
    'Verification response leaked evidence or key identifiers.',
  );
  const replay = (await client.query(VERIFY_SQL, verificationParams)).rows[0];
  invariant(replay.event_id === verification.event_id && replay.replayed === true, 'verification exact replay failed.');

  await client.query(`UPDATE "TenantMembership" SET "status" = 'DISABLED' WHERE "id" = $1`, [ids.adminA]);
  await expectFailure(client, () => client.query(VERIFY_SQL, verificationParams), 'P0503', 'replay after actor disable');
  await client.query(`UPDATE "TenantMembership" SET "status" = 'ACTIVE' WHERE "id" = $1`, [ids.adminA]);
  const crossActorParams = [...verificationParams];
  crossActorParams[2] = ids.adminCross;
  await expectFailure(client, () => client.query(VERIFY_SQL, crossActorParams), 'P0503', 'cross-tenant replay');

  const assessmentParams = [
    ids.organization, ids.request, ids.adminA, hash(`${marker}-assessment-op:${ids.suffix}`),
    hash(`${marker}-assessment-fp:${ids.suffix}`), 'privacy-review-fingerprint-v1', null,
    'AR-MZA', 'REVIEWED_EXPLICIT_DATE', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    'deadline-reviewed-v1', hash(`deadline:${ids.suffix}`), 'retention-matrix-v1',
    hash(`retention:${ids.suffix}`), hash(`legal-review:${ids.suffix}`),
  ];
  const assessment = (await client.query(ASSESS_SQL, assessmentParams)).rows[0];
  invariant(assessment.sequence === 1 && assessment.replayed === false, 'legal assessment sequence one failed.');

  const holdParams = [
    ids.organization, ids.request, ids.manifest, ids.manifestSha256, ids.adminA,
    hash(`${marker}-hold-op:${ids.suffix}`), hash(`${marker}-hold-fp:${ids.suffix}`),
    'privacy-review-fingerprint-v1', 'ITEM', ids.item, null, 'LITIGATION_REVIEW',
    'hold-policy-v1', hash(`hold-evidence:${ids.suffix}`), ids.adminA,
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  ];
  const hold = (await client.query(HOLD_CREATE_SQL, holdParams)).rows[0];
  invariant(hold.sequence === 1 && hold.event_kind === 'CREATED', 'hold CREATED sequence one failed.');
  const holdReplay = (await client.query(HOLD_CREATE_SQL, holdParams)).rows[0];
  invariant(holdReplay.hold_id === hold.hold_id && holdReplay.replayed === true, 'hold exact replay failed.');

  const holdHash = (await client.query(
    'SELECT obrasaas_data_subject_hold_set_sha256($1,$2,$3) AS hash',
    [ids.organization, ids.request, ids.manifest],
  )).rows[0].hash;
  const items = JSON.stringify(ids.items.map((item) => (
    item.kind === 'COVERAGE_BLOCKER'
      ? {
        reviewItemId: item.id,
        action: 'UNRESOLVED',
        legalBasisCode: null,
        retentionPolicyVersion: null,
        retentionRuleCode: null,
        retentionUntil: null,
      }
      : {
        reviewItemId: item.id,
        action: 'DISCLOSE_CANDIDATE',
        legalBasisCode: 'ART-15-ACCESS',
        retentionPolicyVersion: 'retention-matrix-v1',
        retentionRuleCode: 'ACCESS-REVIEW-V1',
        retentionUntil: null,
      }
  )));
  const decisionParams = [
    ids.organization, ids.request, ids.manifest, ids.manifestSha256, ids.adminA,
    hash(`${marker}-decision-op:${ids.suffix}`), hash(`${marker}-decision-fp:${ids.suffix}`),
    'privacy-review-fingerprint-v1', verification.event_id, assessment.assessment_id,
    holdHash, null, items,
  ];
  const decision = (await client.query(DECISION_CREATE_SQL, decisionParams)).rows[0];
  invariant(
    decision.revision === 1 && decision.status === 'PENDING_APPROVAL'
      && /^[a-f0-9]{64}$/.test(decision.decision_sha256),
    'decision prepare did not return revision one and a DB-owned SHA.',
  );
  const decisionReplay = (await client.query(DECISION_CREATE_SQL, decisionParams)).rows[0];
  invariant(decisionReplay.decision_id === decision.decision_id && decisionReplay.replayed === true, 'decision exact replay failed.');
  return { verification, assessment, hold, decision };
}

async function assertRollbackOnlyBehavior(client) {
  const suffix = randomUUID().replaceAll('-', '');
  await client.query('BEGIN');
  let transactionOpen = true;
  try {
    await client.query('SET LOCAL search_path TO public, pg_catalog');
    await client.query("SET LOCAL TIME ZONE 'Pacific/Chatham'");
    const ids = await seedFixture(client, suffix);
    const prepared = await prepareDecision(client, ids);

    await expectFailure(
      client,
      () => client.query(
        `UPDATE "DataSubjectDecisionSet" SET "decisionSha256" = $1 WHERE "id" = $2`,
        [hash(`mutated:${suffix}`), prepared.decision.decision_id],
      ),
      '55000',
      'sealed field mutation during approval',
    );
    await expectFailure(
      client,
      () => client.query(DECIDE_SQL, [
        ids.organization, ids.request, prepared.decision.decision_id, ids.adminA,
        hash(`maker-checker-op:${suffix}`), hash(`maker-checker-fp:${suffix}`),
        'privacy-review-fingerprint-v1', prepared.decision.decision_sha256, 'APPROVE', null,
      ]),
      'P0509',
      'maker-checker same administrator',
    );
    const approvalParams = [
      ids.organization, ids.request, prepared.decision.decision_id, ids.adminB,
      hash(`approval-op:${suffix}`), hash(`approval-fp:${suffix}`),
      'privacy-review-fingerprint-v1', prepared.decision.decision_sha256, 'APPROVE', null,
    ];
    const approved = (await client.query(DECIDE_SQL, approvalParams)).rows[0];
    invariant(approved.status === 'SEALED_BLOCKED' && approved.revision === 1, 'maker-checker approval failed.');
    const approvalReplay = (await client.query(DECIDE_SQL, approvalParams)).rows[0];
    invariant(approvalReplay.replayed === true, 'approval exact replay failed.');

    await expectFailure(
      client,
      () => client.query(`DELETE FROM "DataSubjectDecisionItem" WHERE "decisionSetId" = $1`, [approved.decision_id]),
      '55000',
      'direct decision item delete',
    );
    await expectFailure(
      client,
      () => client.query(`UPDATE "DataSubjectDecisionSet" SET "decisionSha256" = $1 WHERE "id" = $2`, [hash(`after:${suffix}`), approved.decision_id]),
      '55000',
      'direct terminal evidence update',
    );
    await expectFailure(
      client,
      () => client.query('TRUNCATE "DataSubjectRequesterVerificationEvent" CASCADE'),
      '55000',
      'direct PRO-05B TRUNCATE CASCADE',
    );

    await expectFailure(
      client,
      async () => {
        await client.query(
          `INSERT INTO "DataSubjectDecisionSet" (
             "id", "organizationId", "requestId", "manifestId", "revision",
             "predecessorDecisionId", "status", "verificationEventId", "legalAssessmentId",
             "preparedByMembershipId", "operationKeyHash", "requestFingerprint",
             "fingerprintKeyId", "updatedAt"
           ) VALUES ($1,$2,$3,$4,2,$5,'DRAFTING',$6,$7,$8,$9,$10,$11,CURRENT_TIMESTAMP)`,
          [`privacy_b_draft_${suffix}`, ids.organization, ids.request, ids.manifest,
            approved.decision_id, prepared.verification.event_id, prepared.assessment.assessment_id,
            ids.adminA, hash(`draft-op:${suffix}`), hash(`draft-fp:${suffix}`),
            'privacy-review-fingerprint-v1'],
        );
        await client.query('SET CONSTRAINTS ALL IMMEDIATE');
      },
      '55000',
      'transient DRAFTING commit guard',
    );
    await client.query('SET CONSTRAINTS ALL IMMEDIATE');
    await client.query('ROLLBACK');
    transactionOpen = false;
  } finally {
    if (transactionOpen) await client.query('ROLLBACK').catch(() => undefined);
  }
}

async function cleanupDisposableFixture(client, organizationId, crossOrganizationId) {
  await client.query('BEGIN');
  try {
    await setTriggerModes(client, PRO05B_TRIGGERS, 'DISABLE');
    await setTriggerModes(client, PRO05A_TRIGGERS, 'DISABLE');
    for (const table of [
      'DataSubjectDecisionItem', 'DataSubjectDecisionSet', 'DataSubjectLegalHoldEvent',
      'DataSubjectLegalHold', 'DataSubjectLegalAssessmentRevision',
      'DataSubjectRequesterVerificationEvent', 'DataSubjectDiscoveryItem',
      'DataSubjectDiscoveryManifest', 'DataSubjectRequest',
    ]) {
      await client.query(`DELETE FROM ${quoteIdentifier(table)} WHERE "organizationId" = ANY($1::text[])`, [[organizationId, crossOrganizationId]]);
    }
    await client.query('DELETE FROM "WorkerPerson" WHERE "organizationId" = ANY($1::text[])', [[organizationId, crossOrganizationId]]);
    const users = (await client.query(
      'DELETE FROM "TenantMembership" WHERE "organizationId" = ANY($1::text[]) RETURNING "userId"',
      [[organizationId, crossOrganizationId]],
    )).rows.map((row) => row.userId);
    if (users.length) await client.query('DELETE FROM "PlatformUser" WHERE "id" = ANY($1::text[])', [users]);
    await client.query('DELETE FROM "Organization" WHERE "id" = ANY($1::text[])', [[organizationId, crossOrganizationId]]);
    await setTriggerModes(client, PRO05A_TRIGGERS, 'ENABLE ALWAYS');
    await setTriggerModes(client, PRO05B_TRIGGERS, 'ENABLE ALWAYS');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
  const retained = await client.query(
    'SELECT count(*)::int AS count FROM "Organization" WHERE "id" = ANY($1::text[])',
    [[organizationId, crossOrganizationId]],
  );
  invariant(retained.rows[0].count === 0, 'Disposable concurrency fixture cleanup retained rows.');
}

async function assertConnectionWaitsOnLock(observer, applicationName, label) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const result = await observer.query(
      `SELECT "state", "wait_event_type"
         FROM pg_stat_activity
        WHERE "application_name" = $1 AND "pid" <> pg_backend_pid()`,
      [applicationName],
    );
    if (result.rows.some((row) => row.state === 'active' && row.wait_event_type === 'Lock')) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`${label} did not prove a PostgreSQL row-lock wait.`);
}

async function assertApprovalWaitsForRevocation(connectionString) {
  const setup = new pg.Client({ connectionString, application_name: 'obrasaas-pro05b-race-setup' });
  const first = new pg.Client({ connectionString, application_name: 'obrasaas-pro05b-race-revoke' });
  const second = new pg.Client({ connectionString, application_name: 'obrasaas-pro05b-race-approve' });
  await Promise.all([setup.connect(), first.connect(), second.connect()]);
  const suffix = randomUUID().replaceAll('-', '');
  let ids;
  try {
    await setup.query('BEGIN');
    ids = await seedFixture(setup, suffix, 'race');
    const prepared = await prepareDecision(setup, ids, 'race');
    await setup.query('COMMIT');

    await first.query('BEGIN');
    await first.query(VERIFY_SQL, [
      ids.organization, ids.request, ids.adminB, hash(`race-revoke-op:${suffix}`),
      hash(`race-revoke-fp:${suffix}`), 'privacy-review-fingerprint-v1', 'REVOKED',
      prepared.verification.event_id, null, null, null, null, null, null, null,
      null, null, null, null, null, 'REQUESTER_AUTHORITY_REVOKED',
    ]);
    const approvalPromise = second.query(DECIDE_SQL, [
      ids.organization, ids.request, prepared.decision.decision_id, ids.adminB,
      hash(`race-approval-op:${suffix}`), hash(`race-approval-fp:${suffix}`),
      'privacy-review-fingerprint-v1', prepared.decision.decision_sha256, 'APPROVE', null,
    ]).then(
      () => ({ succeeded: true }),
      (error) => ({ succeeded: false, error }),
    );
    await assertConnectionWaitsOnLock(setup, 'obrasaas-pro05b-race-approve', 'approval versus revocation');
    await first.query('COMMIT');
    const approval = await approvalPromise;
    invariant(!approval.succeeded && approval.error?.code === 'P0509', 'approval versus revocation did not fail stale after waiting.');
  } finally {
    await first.query('ROLLBACK').catch(() => undefined);
    await second.query('ROLLBACK').catch(() => undefined);
    await setup.query('ROLLBACK').catch(() => undefined);
    if (ids) await cleanupDisposableFixture(setup, ids.organization, ids.crossOrganization);
    await Promise.all([setup.end(), first.end(), second.end()]);
  }
}

async function assertApprovalWaitsForHoldRevision(connectionString) {
  const setup = new pg.Client({ connectionString, application_name: 'obrasaas-pro05b-hold-race-setup' });
  const first = new pg.Client({ connectionString, application_name: 'obrasaas-pro05b-race-hold-review' });
  const second = new pg.Client({ connectionString, application_name: 'obrasaas-pro05b-hold-race-approve' });
  await Promise.all([setup.connect(), first.connect(), second.connect()]);
  const suffix = randomUUID().replaceAll('-', '');
  let ids;
  try {
    await setup.query('BEGIN');
    ids = await seedFixture(setup, suffix, 'hold_race');
    const prepared = await prepareDecision(setup, ids, 'hold_race');
    await setup.query('COMMIT');

    await first.query('BEGIN');
    await first.query(HOLD_EVENT_SQL, [
      ids.organization, ids.request, prepared.hold.hold_id, ids.adminA,
      hash(`race-hold-review-op:${suffix}`), hash(`race-hold-review-fp:${suffix}`),
      'privacy-review-fingerprint-v1', prepared.hold.event_id, 'REVIEWED',
      'LITIGATION_REVIEW', 'hold-policy-v2', hash(`hold-review-evidence:${suffix}`),
      ids.adminA, new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), null, null,
    ]);
    const approvalPromise = second.query(DECIDE_SQL, [
      ids.organization, ids.request, prepared.decision.decision_id, ids.adminB,
      hash(`race-hold-approval-op:${suffix}`), hash(`race-hold-approval-fp:${suffix}`),
      'privacy-review-fingerprint-v1', prepared.decision.decision_sha256, 'APPROVE', null,
    ]).then(
      () => ({ succeeded: true }),
      (error) => ({ succeeded: false, error }),
    );
    await assertConnectionWaitsOnLock(setup, 'obrasaas-pro05b-hold-race-approve', 'approval versus hold review');
    await first.query('COMMIT');
    const approval = await approvalPromise;
    invariant(!approval.succeeded && approval.error?.code === 'P0509', 'approval versus hold review did not fail stale after waiting.');
  } finally {
    await first.query('ROLLBACK').catch(() => undefined);
    await second.query('ROLLBACK').catch(() => undefined);
    await setup.query('ROLLBACK').catch(() => undefined);
    if (ids) await cleanupDisposableFixture(setup, ids.organization, ids.crossOrganization);
    await Promise.all([setup.end(), first.end(), second.end()]);
  }
}

async function assertDirectApprovalWaitsForActorDisable(connectionString) {
  const setup = new pg.Client({
    connectionString,
    application_name: 'obrasaas-pro05b-direct-disable-setup',
  });
  const first = new pg.Client({
    connectionString,
    application_name: 'obrasaas-pro05b-membership-disable',
  });
  const second = new pg.Client({
    connectionString,
    application_name: 'obrasaas-pro05b-direct-approval',
  });
  await Promise.all([setup.connect(), first.connect(), second.connect()]);
  const suffix = randomUUID().replaceAll('-', '');
  let ids;
  try {
    await setup.query('BEGIN');
    ids = await seedFixture(setup, suffix, 'direct_disable');
    const prepared = await prepareDecision(setup, ids, 'direct_disable');
    await setup.query('COMMIT');

    await first.query('BEGIN');
    await first.query(
      `UPDATE "TenantMembership"
          SET "status" = 'DISABLED'
        WHERE "organizationId" = $1 AND "id" = $2`,
      [ids.organization, ids.adminB],
    );
    const directApprovalPromise = second.query(
      `UPDATE "DataSubjectDecisionSet"
          SET "status" = 'SEALED_BLOCKED',
              "decidedByMembershipId" = $1,
              "decisionOperationKeyHash" = $2,
              "decisionRequestFingerprint" = $3,
              "decisionFingerprintKeyId" = 'privacy-review-fingerprint-v1',
              "decisionReasonCode" = NULL
        WHERE "organizationId" = $4 AND "requestId" = $5 AND "id" = $6
        RETURNING "status"::TEXT AS status`,
      [
        ids.adminB,
        hash(`direct-disable-approval-op:${suffix}`),
        hash(`direct-disable-approval-fp:${suffix}`),
        ids.organization,
        ids.request,
        prepared.decision.decision_id,
      ],
    ).then(
      (result) => ({ succeeded: true, result }),
      (error) => ({ succeeded: false, error }),
    );
    await assertConnectionWaitsOnLock(
      setup,
      'obrasaas-pro05b-direct-approval',
      'direct approval versus actor disable',
    );
    await first.query('COMMIT');
    const directApproval = await directApprovalPromise;
    invariant(
      !directApproval.succeeded && directApproval.error?.code === 'P0509',
      'direct approval did not fail closed after the checker membership was disabled.',
    );
    const retained = await setup.query(
      `SELECT "status"::TEXT AS status, "decidedByMembershipId" AS checker
         FROM "DataSubjectDecisionSet"
        WHERE "organizationId" = $1 AND "requestId" = $2 AND "id" = $3`,
      [ids.organization, ids.request, prepared.decision.decision_id],
    );
    invariant(
      retained.rows[0]?.status === 'PENDING_APPROVAL'
        && retained.rows[0]?.checker === null,
      'failed direct approval changed the pending decision.',
    );
  } finally {
    await first.query('ROLLBACK').catch(() => undefined);
    await second.query('ROLLBACK').catch(() => undefined);
    await setup.query('ROLLBACK').catch(() => undefined);
    if (ids) await cleanupDisposableFixture(setup, ids.organization, ids.crossOrganization);
    await Promise.all([setup.end(), first.end(), second.end()]);
  }
}

async function assertDisposableConcurrencyRaces(connectionString) {
  await assertApprovalWaitsForRevocation(connectionString);
  await assertApprovalWaitsForHoldRevision(connectionString);
  await assertDirectApprovalWaitsForActorDisable(connectionString);
}

async function main() {
  if (helpRequested) {
    console.log(HELP);
    return;
  }
  const configuration = connectionConfiguration();
  const client = new pg.Client({
    connectionString: configuration.connectionString,
    application_name: 'obrasaas-data-subject-decision-verifier',
  });
  await client.connect();
  try {
    await client.query(`SET search_path TO ${quoteIdentifier(configuration.schema)}, pg_catalog`);
    await assertServerVersion(client);
    await assertMigrationLedger(client, configuration.schema, configuration.local);
    await assertInstalledObjects(client, configuration.schema);
    await assertRollbackOnlyBehavior(client);
  } finally {
    await client.end();
  }
  if (configuration.disposableConcurrency) {
    await assertDisposableConcurrencyRaces(configuration.connectionString);
  }
  console.log(
    `PRO-05B.1 data-subject decision migration verified: schema, no-store ledger, RBAC, CAS, replay, maker-checker and rollback-only behavior${configuration.disposableConcurrency ? ' plus disposable PostgreSQL 17 races' : ''}.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'PRO-05B migration verification failed.');
  process.exitCode = 1;
});
