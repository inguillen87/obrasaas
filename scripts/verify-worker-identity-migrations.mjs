import pg from 'pg';

const connectionString = process.env.WORKER_IDENTITY_MIGRATION_DATABASE_URL;
const SCHEMA_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_$]{0,62}$/;

if (!connectionString) {
  throw new Error(
    'WORKER_IDENTITY_MIGRATION_DATABASE_URL is required; DATABASE_URL is intentionally ignored.',
  );
}

function resolveDatabaseSchema(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('WORKER_IDENTITY_MIGRATION_DATABASE_URL must be a valid PostgreSQL URL.');
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('WORKER_IDENTITY_MIGRATION_DATABASE_URL must use PostgreSQL.');
  }

  const dsnSchemas = parsed.searchParams.getAll('schema');
  if (dsnSchemas.length > 1 && new Set(dsnSchemas).size > 1) {
    throw new Error('WORKER_IDENTITY_MIGRATION_DATABASE_URL contains conflicting schema parameters.');
  }
  const dsnSchema = dsnSchemas[0] || null;
  const explicitSchema = process.env.WORKER_IDENTITY_MIGRATION_SCHEMA || null;
  if (explicitSchema && dsnSchema && explicitSchema !== dsnSchema) {
    throw new Error(
      'WORKER_IDENTITY_MIGRATION_SCHEMA does not match the schema declared in the database URL.',
    );
  }

  const schema = explicitSchema || dsnSchema;
  if (!schema) {
    throw new Error(
      'Declare WORKER_IDENTITY_MIGRATION_SCHEMA or add an explicit schema parameter to the database URL.',
    );
  }
  if (!SCHEMA_IDENTIFIER_PATTERN.test(schema)) {
    throw new Error(
      'The worker identity migration schema must be a safe PostgreSQL identifier of at most 63 ASCII characters.',
    );
  }
  return schema;
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

const databaseSchema = resolveDatabaseSchema(connectionString);

function hardenedVerifierConnectionString(value) {
  const parsed = new URL(value);
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  const sslMode = parsed.searchParams.get('sslmode');
  if (
    hostname.endsWith('.neon.tech')
    && ['prefer', 'require', 'verify-ca'].includes(sslMode)
  ) {
    parsed.searchParams.set('sslmode', 'verify-full');
  }
  return parsed.toString();
}

const verifierConnectionString = hardenedVerifierConnectionString(connectionString);

const EXPECTED_MIGRATIONS = Object.freeze([
  '20260724330000_worker_identity_scope_indexes',
  '20260724330050_worker_identity_channel_scope_index',
  '20260724330100_worker_identity_onboarding_payments',
  '20260724330200_worker_identity_worker_index',
  '20260724330250_worker_identity_worker_scope_index',
  '20260724330300_worker_identity_worker_constraints',
  '20260724330400_worker_identity_validate_worker_constraints',
  '20260724330500_worker_membership_scope_index',
  '20260724330550_worker_person_project_unique_index',
  '20260724330600_worker_sensitive_decision_controls',
  '20260724330700_worker_sensitive_decision_validate',
  '20260724330800_worker_payment_canonical_identity',
  '20260724330850_worker_payment_canonical_identity_finalize',
  '20260724330860_worker_payment_canonical_identity_index',
]);

const EXPECTED_ENUMS = Object.freeze({
  WorkerPersonStatus: ['ACTIVE', 'SUSPENDED', 'ARCHIVED'],
  WorkerIdentityStatus: ['UNVERIFIED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED'],
  WorkerChannelProvider: ['WHATSAPP'],
  WorkerChannelIdentityStatus: ['PENDING', 'VERIFIED', 'CONFLICT', 'REVOKED'],
  WorkerOnboardingClaimStatus: [
    'PENDING',
    'SUBMITTED',
    'APPROVED',
    'REJECTED',
    'EXPIRED',
    'CANCELLED',
  ],
  WorkerPaymentPurpose: ['SALARY', 'REIMBURSEMENT'],
  WorkerPaymentDestinationType: ['CBU', 'CVU', 'ALIAS'],
  WorkerPaymentRail: ['AR_CBU', 'AR_CVU'],
  WorkerPaymentDestinationStatus: [
    'PENDING_VERIFICATION',
    'VERIFIED',
    'ACTIVE',
    'SUPERSEDED',
    'REJECTED',
    'REVOKED',
  ],
  WorkerPaymentSubmissionSource: ['TENANT_MEMBERSHIP', 'WORKER_CHANNEL'],
  WorkerSensitiveDecisionAction: [
    'IDENTITY_VERIFIED',
    'IDENTITY_REJECTED',
    'ONBOARDING_APPROVED',
    'ONBOARDING_REJECTED',
    'PAYMENT_VERIFIED',
    'PAYMENT_REJECTED',
    'PAYMENT_ACTIVATED',
    'PAYMENT_REVOKED',
  ],
});

const EXPECTED_TABLES = Object.freeze([
  'WorkerPerson',
  'WorkerChannelIdentity',
  'WorkerOnboardingClaim',
  'WorkerPaymentDestination',
  'WorkerSensitiveDecision',
]);

const EXPECTED_VALIDATED_CONSTRAINTS = Object.freeze({
  Worker: [
    'Worker_organizationId_fkey',
    'Worker_organizationId_personId_fkey',
    'Worker_organizationId_projectId_fkey',
    'Worker_person_scope_check',
  ],
  WorkerPerson: [
    'WorkerPerson_identity_bundle_check',
    'WorkerPerson_identity_decision_actor_check',
    'WorkerPerson_verifier_membership_fkey',
    'WorkerPerson_rejecter_membership_fkey',
  ],
  WorkerChannelIdentity: [
    'WorkerChannelIdentity_encrypted_address_check',
    'WorkerChannelIdentity_provider_subject_check',
  ],
  WorkerOnboardingClaim: [
    'WorkerOnboardingClaim_sender_check',
    'WorkerOnboardingClaim_identity_bundle_check',
    'WorkerClaim_review_actor_check',
    'WorkerClaim_reviewer_membership_fkey',
    'WorkerClaim_resolved_channel_scope_fkey',
    'WorkerClaim_resolved_worker_scope_fkey',
  ],
  WorkerPaymentDestination: [
    'WorkerPaymentDestination_encrypted_payload_check',
    'WorkerPayment_submission_actor_check',
    'WorkerPayment_decision_actor_check',
    'WorkerPayment_separation_of_duties_check',
    'WorkerPayment_alias_resolution_check',
    'WorkerPayment_canonical_bundle_check',
    'WorkerPayment_canonical_source_check',
    'WorkerPayment_canonical_state_check',
    'WorkerPayment_submitter_membership_fkey',
    'WorkerPayment_submitter_channel_fkey',
    'WorkerPayment_verifier_membership_fkey',
    'WorkerPayment_activator_membership_fkey',
    'WorkerPayment_rejecter_membership_fkey',
    'WorkerPayment_revoker_membership_fkey',
  ],
  WorkerSensitiveDecision: [
    'WSD_hash_and_key_check',
    'WSD_exact_subject_check',
    'WorkerSensitiveDecision_organizationId_fkey',
    'WSD_actor_membership_fkey',
    'WSD_worker_person_fkey',
    'WSD_onboarding_claim_fkey',
    'WSD_payment_destination_fkey',
  ],
});

const EXPECTED_INDEXES = Object.freeze({
  TenantMembership_organizationId_id_key: {
    table: 'TenantMembership',
    patterns: [/CREATE UNIQUE INDEX/, /\("organizationId", "id"\)/],
  },
  Worker_one_person_per_project_idx: {
    table: 'Worker',
    patterns: [
      /CREATE UNIQUE INDEX/,
      /\("organizationId", "personId", "projectId"\)/,
      /WHERE \("personId" IS NOT NULL\)/,
    ],
  },
  WorkerClaim_one_open_per_sender_idx: {
    table: 'WorkerOnboardingClaim',
    patterns: [
      /CREATE UNIQUE INDEX/,
      /\("projectId", "senderFingerprintKeyId", "senderFingerprint"\)/,
      /PENDING/,
      /SUBMITTED/,
    ],
  },
  WorkerPayment_one_active_per_purpose_idx: {
    table: 'WorkerPaymentDestination',
    patterns: [
      /CREATE UNIQUE INDEX/,
      /\("organizationId", "personId", "purpose"\)/,
      /ACTIVE/,
    ],
  },
  WSD_org_operation_key: {
    table: 'WorkerSensitiveDecision',
    patterns: [/CREATE UNIQUE INDEX/, /\("organizationId", "operationKey"\)/],
  },
  WorkerPayment_canonical_identity_key: {
    table: 'WorkerPaymentDestination',
    requiresUnique: true,
    requiresUnconditional: true,
    patterns: [
      /CREATE UNIQUE INDEX/,
      /\("organizationId", "personId", "purpose", "canonicalType", "canonicalFingerprintKeyId", "canonicalFingerprint"\)/,
    ],
  },
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sameValues(actual, expected) {
  return actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

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
  const missing = EXPECTED_MIGRATIONS.filter((migration) => !applied.has(migration));
  assert(missing.length === 0, `Missing worker identity migrations: ${missing.join(', ')}.`);
}

async function assertTables(client) {
  const result = await client.query(
    `SELECT tablename
       FROM pg_tables
      WHERE schemaname = current_schema()
        AND tablename = ANY($1::text[])`,
    [EXPECTED_TABLES],
  );
  const present = new Set(result.rows.map((row) => row.tablename));
  const missing = EXPECTED_TABLES.filter((table) => !present.has(table));
  assert(missing.length === 0, `Missing worker identity tables: ${missing.join(', ')}.`);
}

async function assertEnums(client) {
  const result = await client.query(
    `SELECT type.typname,
            array_agg(enum.enumlabel::text ORDER BY enum.enumsortorder) AS labels
       FROM pg_type AS type
       JOIN pg_enum AS enum ON enum.enumtypid = type.oid
       JOIN pg_namespace AS namespace ON namespace.oid = type.typnamespace
      WHERE namespace.nspname = current_schema()
        AND type.typname = ANY($1::text[])
      GROUP BY type.typname`,
    [Object.keys(EXPECTED_ENUMS)],
  );
  const actual = new Map(result.rows.map((row) => [row.typname, row.labels]));
  for (const [name, labels] of Object.entries(EXPECTED_ENUMS)) {
    assert(actual.has(name), `Missing worker identity enum ${name}.`);
    assert(
      sameValues(actual.get(name), labels),
      `Worker identity enum ${name} does not match the governed contract.`,
    );
  }
}

async function assertValidatedConstraints(client) {
  for (const [table, names] of Object.entries(EXPECTED_VALIDATED_CONSTRAINTS)) {
    const result = await client.query(
      `SELECT constraint_record.conname, constraint_record.convalidated,
              constraint_record.contype, constraint_record.confdeltype,
              pg_get_constraintdef(constraint_record.oid, true) AS definition
         FROM pg_constraint AS constraint_record
        WHERE constraint_record.conrelid = to_regclass(
                format('%I.%I', current_schema(), $1::text)
              )
          AND constraint_record.conname = ANY($2::text[])`,
      [table, names],
    );
    const byName = new Map(result.rows.map((row) => [row.conname, row]));
    for (const name of names) {
      const constraint = byName.get(name);
      assert(constraint, `Missing constraint ${table}.${name}.`);
      assert(constraint.convalidated, `Constraint ${table}.${name} is still NOT VALID.`);
    }
  }

  const verifiedChannelGuard = await client.query(
    `SELECT constraint_record.convalidated,
            pg_get_constraintdef(constraint_record.oid, true) AS definition
       FROM pg_constraint AS constraint_record
      WHERE constraint_record.conrelid = to_regclass(
              format('%I.%I', current_schema(), 'WorkerChannelIdentity')
            )
        AND constraint_record.conname = 'WorkerChannelIdentity_verified_provider_subject_check'`,
  );
  assert(
    verifiedChannelGuard.rowCount === 1,
    'Missing VERIFIED channel provider-subject guard.',
  );
  assert(
    verifiedChannelGuard.rows[0].convalidated === true,
    'Pilot no-go: VERIFIED channel provider-subject guard is still NOT VALID; audit, backfill and validate legacy rows first.',
  );
  const verifiedChannelDefinition = verifiedChannelGuard.rows[0].definition.replaceAll('"', '');
  assert(
    /status <> 'VERIFIED'[\s\S]*encryptedProviderSubjectPayload IS NOT NULL[\s\S]*providerSubjectFingerprint IS NOT NULL[\s\S]*providerSubjectFingerprintKeyId IS NOT NULL/.test(
      verifiedChannelDefinition,
    ),
    'VERIFIED channel guard does not require the complete provider-subject bundle.',
  );

  const restrictForeignKeys = await client.query(
    `SELECT constraint_record.conname, constraint_record.confdeltype
       FROM pg_constraint AS constraint_record
      WHERE (
              constraint_record.conrelid = to_regclass(format('%I.%I', current_schema(), 'Worker'))
              AND constraint_record.conname = $1
            )
         OR (
              constraint_record.conrelid = to_regclass(format('%I.%I', current_schema(), 'WorkerSensitiveDecision'))
              AND constraint_record.conname = ANY($2::text[])
            )`,
    [
      'Worker_organizationId_personId_fkey',
      [
      'WSD_actor_membership_fkey',
      'WSD_worker_person_fkey',
      'WSD_onboarding_claim_fkey',
      'WSD_payment_destination_fkey',
      ],
    ],
  );
  for (const row of restrictForeignKeys.rows) {
    assert(row.confdeltype === 'r', `Foreign key ${row.conname} is not ON DELETE RESTRICT.`);
  }
  assert(restrictForeignKeys.rowCount === 5, 'One or more governed RESTRICT foreign keys are missing.');

  const decisionChecks = await client.query(
    `SELECT constraint_record.conname,
            pg_get_constraintdef(constraint_record.oid, true) AS definition
       FROM pg_constraint AS constraint_record
      WHERE (
              constraint_record.conrelid = to_regclass(format('%I.%I', current_schema(), 'WorkerPaymentDestination'))
              AND constraint_record.conname = ANY($1::text[])
            )
         OR (
              constraint_record.conrelid = to_regclass(format('%I.%I', current_schema(), 'WorkerOnboardingClaim'))
              AND constraint_record.conname = $2
            )
         OR (
              constraint_record.conrelid = to_regclass(format('%I.%I', current_schema(), 'WorkerSensitiveDecision'))
              AND constraint_record.conname = $3
            )`,
    [
      [
        'WorkerPayment_separation_of_duties_check',
        'WorkerPayment_alias_resolution_check',
        'WorkerPaymentDestination_encrypted_payload_check',
        'WorkerPayment_canonical_bundle_check',
        'WorkerPayment_canonical_source_check',
        'WorkerPayment_canonical_state_check',
      ],
      'WorkerOnboardingClaim_sender_check',
      'WSD_exact_subject_check',
    ],
  );
  const definitions = new Map(decisionChecks.rows.map((row) => [row.conname, row.definition]));
  assert(
    /submittedByMembershipId[\s\S]*verifiedByMembershipId[\s\S]*activatedByMembershipId/.test(
      definitions.get('WorkerPayment_separation_of_duties_check') || '',
    ),
    'Payment maker-checker-activator separation is not encoded in PostgreSQL.',
  );
  assert(
    /resolvedEncryptedPayload[\s\S]*resolvedFingerprint[\s\S]*resolvedType/.test(
      definitions.get('WorkerPayment_alias_resolution_check') || '',
    ),
    'Alias resolution evidence bundle is not encoded in PostgreSQL.',
  );
  for (const name of [
    'WorkerPaymentDestination_encrypted_payload_check',
    'WorkerOnboardingClaim_sender_check',
  ]) {
    assert(
      /\^v\[23\]/.test(definitions.get(name) || ''),
      `${name} does not accept the governed v2/v3 crypto rollout.`,
    );
  }
  const exactSubjectDefinition = (definitions.get('WSD_exact_subject_check') || '')
    .replaceAll('"', '');
  for (const requiredFragment of [
    /IDENTITY_VERIFIED[\s\S]*workerPersonId IS NOT NULL[\s\S]*paymentDestinationId IS NULL/,
    /ONBOARDING_APPROVED[\s\S]*workerPersonId IS NULL[\s\S]*onboardingClaimId IS NOT NULL/,
    /PAYMENT_VERIFIED[\s\S]*workerPersonId IS NULL[\s\S]*onboardingClaimId IS NULL[\s\S]*paymentDestinationId IS NOT NULL/,
  ]) {
    assert(
      requiredFragment.test(exactSubjectDefinition),
      'WorkerSensitiveDecision exact-subject contract does not match the governed action families.',
    );
  }
  const canonicalSource = (definitions.get('WorkerPayment_canonical_source_check') || '')
    .replaceAll('"', '');
  assert(
    [
      'CBU',
      'CVU',
      'canonicalType = type',
      'canonicalFingerprint = fingerprint',
      'canonicalFingerprintKeyId = fingerprintKeyId',
    ].every((fragment) => canonicalSource.includes(fragment)),
    'Direct payment destinations are not bound to canonical identity in PostgreSQL.',
  );
  assert(
    [
      'ALIAS',
      'canonicalType = resolvedType',
      'canonicalFingerprint = resolvedFingerprint',
      'canonicalFingerprintKeyId = resolvedFingerprintKeyId',
    ].every((fragment) => canonicalSource.includes(fragment)),
    'Resolved aliases are not bound to canonical identity in PostgreSQL.',
  );
  const canonicalState = (definitions.get('WorkerPayment_canonical_state_check') || '')
    .replaceAll('"', '');
  assert(
    ['VERIFIED', 'ACTIVE', 'SUPERSEDED', 'canonicalFingerprint IS NOT NULL']
      .every((fragment) => canonicalState.includes(fragment)),
    'Governed payment states do not require canonical identity in PostgreSQL.',
  );
}

async function assertIndexes(client) {
  const indexNames = Object.keys(EXPECTED_INDEXES);
  const result = await client.query(
    `SELECT indexes.tablename, indexes.indexname, indexes.indexdef,
            index_state.indisvalid, index_state.indisready, index_state.indisunique,
            index_state.indpred IS NULL AS is_unconditional
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
    [indexNames],
  );
  const byName = new Map(result.rows.map((row) => [row.indexname, row]));
  for (const [name, contract] of Object.entries(EXPECTED_INDEXES)) {
    const index = byName.get(name);
    assert(index, `Missing governed index ${name}.`);
    assert(index.tablename === contract.table, `Index ${name} is attached to the wrong table.`);
    assert(index.indisvalid && index.indisready, `Index ${name} is not valid and ready.`);
    if (contract.requiresUnique) {
      assert(index.indisunique, `Index ${name} is not unique.`);
    }
    if (contract.requiresUnconditional) {
      assert(index.is_unconditional, `Index ${name} is partial and does not govern every row.`);
    }
    for (const pattern of contract.patterns) {
      assert(pattern.test(index.indexdef), `Index ${name} does not match its governed definition.`);
    }
  }
}

async function assertAppendOnlyLedger(client) {
  const result = await client.query(
    `SELECT trigger_record.tgname,
            trigger_record.tgenabled,
            pg_get_triggerdef(trigger_record.oid, true) AS definition,
            trigger_function.proname AS function_name,
            pg_get_functiondef(trigger_function.oid) AS function_definition
       FROM pg_trigger AS trigger_record
       JOIN pg_proc AS trigger_function ON trigger_function.oid = trigger_record.tgfoid
       JOIN pg_namespace AS function_namespace
         ON function_namespace.oid = trigger_function.pronamespace
        AND function_namespace.nspname = current_schema()
      WHERE trigger_record.tgrelid = to_regclass(format('%I.%I', current_schema(), 'WorkerSensitiveDecision'))
        AND NOT trigger_record.tgisinternal
        AND trigger_record.tgname = ANY($1::text[])`,
    [[
      'WorkerSensitiveDecision_append_only',
      'WorkerSensitiveDecision_no_truncate',
    ]],
  );
  const triggers = new Map(result.rows.map((row) => [row.tgname, row]));
  const rowTrigger = triggers.get('WorkerSensitiveDecision_append_only');
  const truncateTrigger = triggers.get('WorkerSensitiveDecision_no_truncate');
  assert(rowTrigger?.tgenabled === 'O', 'Append-only row trigger is missing or disabled.');
  assert(truncateTrigger?.tgenabled === 'O', 'Append-only truncate trigger is missing or disabled.');
  assert(
    /BEFORE (DELETE OR UPDATE|UPDATE OR DELETE)/.test(rowTrigger.definition),
    'Append-only row trigger does not cover UPDATE and DELETE.',
  );
  assert(
    /BEFORE TRUNCATE/.test(truncateTrigger.definition),
    'Append-only ledger does not reject TRUNCATE.',
  );
  for (const trigger of [rowTrigger, truncateTrigger]) {
    assert(
      trigger.function_name === 'obrasaas_worker_sensitive_decision_append_only',
      `Append-only trigger ${trigger.tgname} calls an unexpected function.`,
    );
    assert(
      /RAISE EXCEPTION[\s\S]*ERRCODE\s*=\s*'55000'[\s\S]*append-only/i.test(
        trigger.function_definition,
      ),
      `Append-only trigger ${trigger.tgname} does not call the governed rejecting function.`,
    );
  }
}

async function assertCanonicalPaymentIdentity(client) {
  const result = await client.query(
    `SELECT trigger_record.tgname,
            trigger_record.tgenabled,
            pg_get_triggerdef(trigger_record.oid, true) AS definition,
            trigger_function.proname AS function_name,
            pg_get_functiondef(trigger_function.oid) AS function_definition
       FROM pg_trigger AS trigger_record
       JOIN pg_proc AS trigger_function ON trigger_function.oid = trigger_record.tgfoid
       JOIN pg_namespace AS function_namespace
         ON function_namespace.oid = trigger_function.pronamespace
        AND function_namespace.nspname = current_schema()
      WHERE trigger_record.tgrelid = to_regclass(
              format('%I.%I', current_schema(), 'WorkerPaymentDestination')
            )
        AND NOT trigger_record.tgisinternal
        AND trigger_record.tgname = 'WorkerPayment_sync_canonical_identity'`,
  );
  assert(result.rowCount === 1, 'Canonical payment identity trigger is missing.');
  const trigger = result.rows[0];
  assert(trigger.tgenabled === 'O', 'Canonical payment identity trigger is disabled.');
  assert(
    /BEFORE (INSERT OR UPDATE|UPDATE OR INSERT)/.test(trigger.definition),
    'Canonical payment identity trigger does not cover INSERT and UPDATE.',
  );
  assert(
    trigger.function_name === 'worker_payment_sync_canonical_identity',
    'Canonical payment identity trigger calls an unexpected function.',
  );
  const definition = trigger.function_definition.replaceAll('"', '');
  for (const requiredFragment of [
    /type IN \('CBU', 'CVU'\)[\s\S]*canonicalFingerprint := NEW\.fingerprint/,
    /type = 'ALIAS'[\s\S]*resolvedType IN \('CBU', 'CVU'\)[\s\S]*canonicalFingerprint := NEW\.resolvedFingerprint/,
    /canonicalFingerprint := NULL/,
  ]) {
    assert(
      requiredFragment.test(definition),
      'Canonical payment identity trigger function does not match the governed derivation.',
    );
  }
}

const client = new pg.Client({
  connectionString: verifierConnectionString,
  application_name: 'obrasaas-worker-identity-migration-verifier',
  statement_timeout: 30_000,
  query_timeout: 35_000,
});

await client.connect();
let transactionOpen = false;
try {
  await client.query('BEGIN TRANSACTION READ ONLY');
  transactionOpen = true;
  const schemaExists = await client.query(
    'SELECT to_regnamespace($1) IS NOT NULL AS exists',
    [databaseSchema],
  );
  assert(schemaExists.rows[0]?.exists, `Configured PostgreSQL schema ${databaseSchema} does not exist.`);
  await client.query(`SET LOCAL search_path TO ${quoteIdentifier(databaseSchema)}, pg_catalog`);
  const activeSchema = await client.query('SELECT current_schema() AS name');
  assert(
    activeSchema.rows[0]?.name === databaseSchema,
    'PostgreSQL did not activate the configured worker identity migration schema.',
  );
  await client.query("SET LOCAL lock_timeout = '5s'");
  await assertMigrations(client);
  await assertTables(client);
  await assertEnums(client);
  await assertValidatedConstraints(client);
  await assertIndexes(client);
  await assertAppendOnlyLedger(client);
  await assertCanonicalPaymentIdentity(client);
  console.log(
    'Verified worker identity migrations: tenant scope, crypto rollout, onboarding, payment controls, partial uniqueness and append-only decisions.',
  );
  await client.query('ROLLBACK');
  transactionOpen = false;
} finally {
  if (transactionOpen) {
    await client.query('ROLLBACK').catch(() => undefined);
  }
  await client.end();
}
