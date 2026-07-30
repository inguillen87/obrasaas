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
  '20260728052000_worker_onboarding_flow_sessions',
  '20260728063000_worker_onboarding_claim_retention',
  '20260729130000_worker_payment_privacy_choices',
  '20260729131000_worker_payment_privacy_choices_validate',
  '20260729132000_worker_payment_flow_sessions',
  '20260729133000_worker_payment_flow_reconciliation',
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
  WorkerPrivacyChoicePurpose: ['PAYMENT_DESTINATION_CAPTURE'],
  WorkerPrivacyChoiceChannel: ['TENANT_DASHBOARD', 'WHATSAPP_FLOW'],
  WorkerPrivacyChoiceAction: ['ADMIN_ATTESTED', 'WORKER_ACKNOWLEDGED'],
  WorkerPaymentSubmissionContractVersion: [
    'LEGACY_REATTESTATION_REQUIRED',
    'ATTESTED_V1',
  ],
  WorkerPaymentFlowSubmissionStatus: ['OPEN', 'PROCESSING', 'SUCCEEDED', 'UNCERTAIN'],
  WorkerPaymentFlowReconciliationMethod: ['OPERATION_PROVENANCE_V1'],
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
  'WorkerOnboardingFlowSession',
  'WorkerPrivacyChoiceEvent',
  'WorkerPaymentDestination',
  'WorkerPaymentFlowSession',
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
    'WorkerClaim_privacy_notice_evidence_check',
    'WorkerClaim_sensitive_retention_check',
    'WorkerOnboardingClaim_state_check',
    'WorkerClaim_review_actor_check',
    'WorkerClaim_reviewer_membership_fkey',
    'WorkerClaim_resolved_channel_scope_fkey',
    'WorkerClaim_resolved_worker_scope_fkey',
  ],
  WorkerOnboardingFlowSession: [
    'WOFlowSession_contract_check',
    'WOFlowSession_delivery_shape_check',
    'WorkerOnboardingFlowSession_organizationId_fkey',
    'WorkerOnboardingFlowSession_project_scope_fkey',
    'WorkerOnboardingFlowSession_connection_scope_fkey',
    'WorkerOnboardingFlowSession_claim_scope_fkey',
  ],
  WhatsAppFlowEndpointRequest: [
    'WhatsAppFlowEndpointRequest_flowSessionId_fkey',
    'WAFlowEndpointRequest_onboarding_session_fkey',
    'WAFlowEndpointRequest_session_at_most_one_check',
  ],
  WorkerPrivacyChoiceEvent: [
    'WorkerPrivacyChoiceEvent_pkey',
    'WorkerPrivacyChoice_evidence_check',
    'WorkerPrivacyChoice_actor_check',
    'WorkerPrivacyChoice_organization_fkey',
    'WorkerPrivacyChoice_person_scope_fkey',
    'WorkerPrivacyChoice_membership_actor_fkey',
    'WorkerPrivacyChoice_channel_actor_fkey',
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
    'WorkerPayment_privacy_contract_check',
    'WorkerPayment_privacy_choice_scope_fkey',
    'WorkerPayment_flow_provenance_shape_check',
    'WorkerPayment_flow_reservation_fkey',
  ],
  WorkerPaymentFlowSession: [
    'WorkerPaymentFlowSession_pkey',
    'WorkerPaymentFlowSession_contract_check',
    'WorkerPaymentFlowSession_submission_shape_check',
    'WorkerPaymentFlowSession_flow_session_fkey',
    'WorkerPaymentFlowSession_organizationId_fkey',
    'WorkerPaymentFlowSession_project_scope_fkey',
    'WorkerPaymentFlowSession_connection_scope_fkey',
    'WorkerPaymentFlowSession_worker_scope_fkey',
    'WorkerPaymentFlowSession_person_scope_fkey',
    'WorkerPaymentFlowSession_channel_scope_fkey',
    'WorkerPaymentFlowSession_privacy_choice_scope_fkey',
    'WorkerPaymentFlowSession_destination_scope_fkey',
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
    columns: ['organizationId', 'id'],
    requiresUnique: true,
    requiresUnconditional: true,
  },
  Worker_one_person_per_project_idx: {
    table: 'Worker',
    columns: ['organizationId', 'personId', 'projectId'],
    requiresUnique: true,
    predicateFragments: ['personId IS NOT NULL'],
  },
  WorkerClaim_one_open_per_sender_idx: {
    table: 'WorkerOnboardingClaim',
    columns: ['projectId', 'senderFingerprintKeyId', 'senderFingerprint'],
    requiresUnique: true,
    predicateFragments: ['PENDING', 'SUBMITTED'],
  },
  WorkerClaim_sensitive_retention_due_idx: {
    table: 'WorkerOnboardingClaim',
    columns: ['expiresAt', 'id'],
    predicateFragments: ['PENDING', 'SUBMITTED', 'sensitiveDataPurgedAt IS NULL'],
  },
  WorkerClaim_flow_session_scope_key: {
    table: 'WorkerOnboardingClaim',
    columns: ['organizationId', 'projectId', 'connectionId', 'id'],
    requiresUnique: true,
    requiresUnconditional: true,
  },
  WorkerOnboardingFlowSession_claimId_key: {
    table: 'WorkerOnboardingFlowSession',
    columns: ['claimId'],
    requiresUnique: true,
    requiresUnconditional: true,
  },
  WorkerOnboardingFlowSession_tokenSha256_key: {
    table: 'WorkerOnboardingFlowSession',
    columns: ['tokenSha256'],
    requiresUnique: true,
    requiresUnconditional: true,
  },
  WorkerOnboardingFlowSession_source_key: {
    table: 'WorkerOnboardingFlowSession',
    columns: ['projectId', 'sourceExternalId', 'blueprintKey'],
    requiresUnique: true,
    requiresUnconditional: true,
  },
  WorkerOnboardingFlowSession_consumed_event_key: {
    table: 'WorkerOnboardingFlowSession',
    columns: ['projectId', 'consumedExternalId'],
    requiresUnique: true,
    requiresUnconditional: true,
  },
  WorkerPayment_one_active_per_purpose_idx: {
    table: 'WorkerPaymentDestination',
    columns: ['organizationId', 'personId', 'purpose'],
    requiresUnique: true,
    predicateFragments: ['ACTIVE'],
  },
  WSD_org_operation_key: {
    table: 'WorkerSensitiveDecision',
    columns: ['organizationId', 'operationKey'],
    requiresUnique: true,
    requiresUnconditional: true,
  },
  WorkerPayment_canonical_identity_key: {
    table: 'WorkerPaymentDestination',
    columns: [
      'organizationId',
      'personId',
      'purpose',
      'canonicalType',
      'canonicalFingerprintKeyId',
      'canonicalFingerprint',
    ],
    requiresUnique: true,
    requiresUnconditional: true,
  },
  WorkerPrivacyChoice_org_id_key: {
    table: 'WorkerPrivacyChoiceEvent',
    columns: ['organizationId', 'id'],
    requiresUnique: true,
    requiresUnconditional: true,
  },
  WorkerPrivacyChoice_org_operation_key: {
    table: 'WorkerPrivacyChoiceEvent',
    columns: ['organizationId', 'operationKey'],
    requiresUnique: true,
    requiresUnconditional: true,
  },
  WorkerPrivacyChoice_payment_scope_key: {
    table: 'WorkerPrivacyChoiceEvent',
    columns: ['organizationId', 'personId', 'paymentPurpose', 'id'],
    requiresUnique: true,
    requiresUnconditional: true,
  },
  WorkerPrivacyChoice_org_person_purpose_decided_idx: {
    table: 'WorkerPrivacyChoiceEvent',
    columns: ['organizationId', 'personId', 'purpose', 'decidedAt'],
    requiresUnconditional: true,
  },
  WorkerPrivacyChoice_membership_decided_idx: {
    table: 'WorkerPrivacyChoiceEvent',
    columns: ['actorMembershipId', 'decidedAt'],
    requiresUnconditional: true,
  },
  WorkerPrivacyChoice_channel_decided_idx: {
    table: 'WorkerPrivacyChoiceEvent',
    columns: ['channelIdentityId', 'decidedAt'],
    requiresUnconditional: true,
  },
  WorkerPaymentDestination_privacyChoiceEventId_key: {
    table: 'WorkerPaymentDestination',
    columns: ['privacyChoiceEventId'],
    requiresUnique: true,
    requiresUnconditional: true,
  },
  WorkerPaymentDestination_flowSubmissionReservationId_key: {
    table: 'WorkerPaymentDestination',
    columns: ['flowSubmissionReservationId'],
    requiresUnique: true,
    requiresUnconditional: true,
  },
  WorkerPayment_privacy_choice_relation_key: {
    table: 'WorkerPaymentDestination',
    columns: ['organizationId', 'personId', 'purpose', 'privacyChoiceEventId'],
    requiresUnique: true,
    requiresUnconditional: true,
  },
  WorkerPaymentFlowSession_submissionReservationId_key: {
    table: 'WorkerPaymentFlowSession',
    columns: ['submissionReservationId'],
    requiresUnique: true,
    requiresUnconditional: true,
  },
  WorkerPaymentFlowSession_privacyChoiceEventId_key: {
    table: 'WorkerPaymentFlowSession',
    columns: ['privacyChoiceEventId'],
    requiresUnique: true,
    requiresUnconditional: true,
  },
  WorkerPaymentFlowSession_destinationId_key: {
    table: 'WorkerPaymentFlowSession',
    columns: ['destinationId'],
    requiresUnique: true,
    requiresUnconditional: true,
  },
  WorkerPaymentFlowSession_privacy_choice_relation_key: {
    table: 'WorkerPaymentFlowSession',
    columns: ['organizationId', 'personId', 'paymentPurpose', 'privacyChoiceEventId'],
    requiresUnique: true,
    requiresUnconditional: true,
  },
  WorkerPaymentFlowSession_destination_relation_key: {
    table: 'WorkerPaymentFlowSession',
    columns: ['organizationId', 'personId', 'paymentPurpose', 'destinationId'],
    requiresUnique: true,
    requiresUnconditional: true,
  },
  WorkerPaymentFlowSession_org_expires_idx: {
    table: 'WorkerPaymentFlowSession',
    columns: ['organizationId', 'expiresAt'],
    requiresUnconditional: true,
  },
  WorkerPaymentFlowSession_project_worker_expires_idx: {
    table: 'WorkerPaymentFlowSession',
    columns: ['projectId', 'workerId', 'expiresAt'],
    requiresUnconditional: true,
  },
  WorkerPaymentFlowSession_channel_expires_idx: {
    table: 'WorkerPaymentFlowSession',
    columns: ['channelIdentityId', 'expiresAt'],
    requiresUnconditional: true,
  },
  WorkerPaymentFlowSession_submission_status_idx: {
    table: 'WorkerPaymentFlowSession',
    columns: ['submissionStatus', 'submissionReservedAt'],
    requiresUnconditional: true,
  },
  WorkerPaymentFlowSession_uncertain_reconcile_idx: {
    table: 'WorkerPaymentFlowSession',
    columns: ['submissionStatus', 'submissionUncertainAt', 'flowSessionId'],
    requiresUnconditional: true,
  },
  WorkerPaymentFlowSession_hmac_key_status_expiry_idx: {
    table: 'WorkerPaymentFlowSession',
    columns: ['submissionFingerprintKeyId', 'submissionStatus', 'expiresAt'],
    requiresUnconditional: true,
  },
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sameValues(actual, expected) {
  return actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

function normalizeConstraintDefinition(value) {
  return String(value || '')
    .replace(/::(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_.$]*(?:\[\])?)/g, '')
    .replaceAll('"', '')
    .replace(/''/g, "'")
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function loadTableColumns(client, table) {
  const result = await client.query(
    `SELECT column_name, is_nullable, data_type, udt_name,
            character_maximum_length, column_default
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = $1`,
    [table],
  );
  return new Map(result.rows.map((row) => [row.column_name, row]));
}

function assertColumnContract(columns, table, name, contract = {}) {
  const column = columns.get(name);
  assert(column, `${table} is missing ${name}.`);
  if (contract.nullable !== undefined) {
    assert(
      column.is_nullable === (contract.nullable ? 'YES' : 'NO'),
      `${table}.${name} has the wrong nullability.`,
    );
  }
  if (contract.dataType) {
    assert(column.data_type === contract.dataType, `${table}.${name} has the wrong SQL type.`);
  }
  if (contract.udtName) {
    assert(column.udt_name === contract.udtName, `${table}.${name} has the wrong enum/type.`);
  }
  if (contract.maxLength !== undefined) {
    assert(
      Number(column.character_maximum_length) === contract.maxLength,
      `${table}.${name} has the wrong maximum length.`,
    );
  }
  if (contract.defaultFragment) {
    assert(
      String(column.column_default || '').includes(contract.defaultFragment),
      `${table}.${name} has the wrong default.`,
    );
  }
}

async function loadUserTriggers(client, table, names) {
  const result = await client.query(
    `SELECT trigger_record.tgname,
            trigger_record.tgenabled,
            pg_get_triggerdef(trigger_record.oid, true) AS definition,
            trigger_function.proname AS function_name,
            trigger_function.prosecdef AS security_definer,
            pg_get_functiondef(trigger_function.oid) AS function_definition
       FROM pg_trigger AS trigger_record
       JOIN pg_proc AS trigger_function ON trigger_function.oid = trigger_record.tgfoid
       JOIN pg_namespace AS function_namespace
         ON function_namespace.oid = trigger_function.pronamespace
        AND function_namespace.nspname = current_schema()
      WHERE trigger_record.tgrelid = to_regclass(format('%I.%I', current_schema(), $1::text))
        AND NOT trigger_record.tgisinternal
        AND trigger_record.tgname = ANY($2::text[])`,
    [table, names],
  );
  return new Map(result.rows.map((row) => [row.tgname, row]));
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
  const canonicalSource = normalizeConstraintDefinition(
    definitions.get('WorkerPayment_canonical_source_check'),
  );
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
  const canonicalState = normalizeConstraintDefinition(
    definitions.get('WorkerPayment_canonical_state_check'),
  );
  assert(
    ['VERIFIED', 'ACTIVE', 'SUPERSEDED', 'canonicalFingerprint IS NOT NULL']
      .every((fragment) => canonicalState.includes(fragment)),
    'Governed payment states do not require canonical identity in PostgreSQL.',
  );
}

async function assertIndexes(client) {
  const indexNames = Object.keys(EXPECTED_INDEXES);
  const result = await client.query(
    `SELECT indexes.tablename, indexes.indexname,
            index_state.indisvalid, index_state.indisready, index_state.indisunique,
            index_state.indpred IS NULL AS is_unconditional,
            ARRAY(
              SELECT pg_get_indexdef(index_state.indexrelid, position, true)
                FROM generate_series(1, index_state.indnkeyatts) AS position
               ORDER BY position
            ) AS key_columns,
            pg_get_expr(index_state.indpred, index_state.indrelid, true) AS predicate
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
    const actualColumns = index.key_columns.map((column) => column.replaceAll('"', '').trim());
    assert(
      sameValues(actualColumns, contract.columns),
      `Index ${name} does not have the governed ordered key columns.`,
    );
    const predicate = normalizeConstraintDefinition(index.predicate);
    for (const fragment of contract.predicateFragments || []) {
      assert(
        predicate.includes(fragment),
        `Index ${name} does not have its governed predicate.`,
      );
    }
  }
}

async function assertWorkerPaymentPrivacyContract(client) {
  const choiceColumns = await loadTableColumns(client, 'WorkerPrivacyChoiceEvent');
  const choiceColumnContract = {
    id: { nullable: false, dataType: 'text' },
    organizationId: { nullable: false, dataType: 'text' },
    personId: { nullable: false, dataType: 'text' },
    purpose: {
      nullable: false,
      udtName: 'WorkerPrivacyChoicePurpose',
      defaultFragment: 'PAYMENT_DESTINATION_CAPTURE',
    },
    paymentPurpose: { nullable: false, udtName: 'WorkerPaymentPurpose' },
    channel: { nullable: false, udtName: 'WorkerPrivacyChoiceChannel' },
    action: { nullable: false, udtName: 'WorkerPrivacyChoiceAction' },
    actorMembershipId: { nullable: true, dataType: 'text' },
    channelIdentityId: { nullable: true, dataType: 'text' },
    noticeVersion: { nullable: false, dataType: 'character varying', maxLength: 64 },
    noticeContentSha256: { nullable: false, dataType: 'character', maxLength: 64 },
    presentedAt: { nullable: false, dataType: 'timestamp without time zone' },
    decidedAt: { nullable: false, dataType: 'timestamp without time zone' },
    operationKey: { nullable: false, dataType: 'character varying', maxLength: 190 },
    requestFingerprint: { nullable: false, dataType: 'character', maxLength: 64 },
    createdAt: { nullable: false, dataType: 'timestamp without time zone' },
  };
  for (const [name, contract] of Object.entries(choiceColumnContract)) {
    assertColumnContract(choiceColumns, 'WorkerPrivacyChoiceEvent', name, contract);
  }
  for (const forbidden of [
    'cuil',
    'cbu',
    'cvu',
    'alias',
    'holderName',
    'holderCuil',
    'financialValue',
    'encryptedPayload',
    'updatedAt',
  ]) {
    assert(
      !choiceColumns.has(forbidden),
      `WorkerPrivacyChoiceEvent must not persist sensitive or mutable field ${forbidden}.`,
    );
  }
  for (const name of choiceColumns.keys()) {
    assert(
      !/(?:account|bank|routing|iban|cuil|cbu|cvu|alias|holder|financialValue|encryptedPayload)/i.test(
        name,
      ),
      `WorkerPrivacyChoiceEvent must not persist raw financial field ${name}.`,
    );
  }

  const destinationColumns = await loadTableColumns(client, 'WorkerPaymentDestination');
  assertColumnContract(
    destinationColumns,
    'WorkerPaymentDestination',
    'submissionContractVersion',
    {
      nullable: false,
      udtName: 'WorkerPaymentSubmissionContractVersion',
      defaultFragment: 'LEGACY_REATTESTATION_REQUIRED',
    },
  );
  assertColumnContract(
    destinationColumns,
    'WorkerPaymentDestination',
    'privacyChoiceEventId',
    { nullable: true, dataType: 'text' },
  );
  for (const [name, contract] of Object.entries({
    flowSubmissionReservationId: { nullable: true, dataType: 'uuid' },
    flowSubmissionFingerprintKeyId: {
      nullable: true,
      dataType: 'character varying',
      maxLength: 64,
    },
    flowSubmissionFingerprintHmac: {
      nullable: true,
      dataType: 'character',
      maxLength: 64,
    },
  })) {
    assertColumnContract(destinationColumns, 'WorkerPaymentDestination', name, contract);
  }

  const constraintResult = await client.query(
    `SELECT constraint_record.conname,
            constraint_record.confdeltype,
            constraint_record.confupdtype,
            pg_get_constraintdef(constraint_record.oid, true) AS definition
       FROM pg_constraint AS constraint_record
      WHERE (
              constraint_record.conrelid = to_regclass(
                format('%I.%I', current_schema(), 'WorkerPrivacyChoiceEvent')
              )
              AND constraint_record.conname = ANY($1::text[])
            )
         OR (
              constraint_record.conrelid = to_regclass(
                format('%I.%I', current_schema(), 'WorkerPaymentDestination')
              )
              AND constraint_record.conname = ANY($2::text[])
            )`,
    [
      [
        'WorkerPrivacyChoice_evidence_check',
        'WorkerPrivacyChoice_actor_check',
        'WorkerPrivacyChoice_organization_fkey',
        'WorkerPrivacyChoice_person_scope_fkey',
        'WorkerPrivacyChoice_membership_actor_fkey',
        'WorkerPrivacyChoice_channel_actor_fkey',
      ],
      [
        'WorkerPayment_privacy_contract_check',
        'WorkerPayment_privacy_choice_scope_fkey',
        'WorkerPayment_flow_provenance_shape_check',
        'WorkerPayment_flow_reservation_fkey',
      ],
    ],
  );
  const constraints = new Map(constraintResult.rows.map((row) => [row.conname, row]));
  const evidence = normalizeConstraintDefinition(
    constraints.get('WorkerPrivacyChoice_evidence_check')?.definition,
  );
  for (const fragment of [
    "purpose = 'PAYMENT_DESTINATION_CAPTURE'",
    "noticeVersion ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'",
    "noticeContentSha256 ~ '^[0-9a-f]{64}$'",
    "operationKey ~ '^wpc:[0-9a-f]{64}$'",
    "requestFingerprint ~ '^[0-9a-f]{64}$'",
    'presentedAt <= decidedAt',
    'decidedAt <= createdAt',
  ]) {
    assert(evidence.includes(fragment), `Worker privacy evidence is missing ${fragment}.`);
  }
  const destinationFlowProvenance = normalizeConstraintDefinition(
    constraints.get('WorkerPayment_flow_provenance_shape_check')?.definition,
  );
  for (const fragment of [
    'flowSubmissionReservationId IS NULL',
    'flowSubmissionFingerprintKeyId IS NULL',
    'flowSubmissionFingerprintHmac IS NULL',
    'flowSubmissionReservationId IS NOT NULL',
    "flowSubmissionFingerprintKeyId ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'",
    "flowSubmissionFingerprintHmac ~ '^[0-9a-f]{64}$'",
    "submissionSource = 'WORKER_CHANNEL'",
    'submittedByMembershipId IS NULL',
    'submittedByChannelIdentityId IS NOT NULL',
    "submissionContractVersion = 'ATTESTED_V1'",
    'privacyChoiceEventId IS NOT NULL',
    'submittedAt IS NOT NULL',
  ]) {
    assert(
      destinationFlowProvenance.includes(fragment),
      `Worker payment Flow provenance shape is missing ${fragment}.`,
    );
  }
  const actor = normalizeConstraintDefinition(
    constraints.get('WorkerPrivacyChoice_actor_check')?.definition,
  );
  for (const fragment of [
    "channel = 'TENANT_DASHBOARD'",
    "action = 'ADMIN_ATTESTED'",
    'actorMembershipId IS NOT NULL',
    'channelIdentityId IS NULL',
    "channel = 'WHATSAPP_FLOW'",
    "action = 'WORKER_ACKNOWLEDGED'",
    'actorMembershipId IS NULL',
    'channelIdentityId IS NOT NULL',
  ]) {
    assert(actor.includes(fragment), `Worker privacy actor binding is missing ${fragment}.`);
  }
  const destinationPrivacy = normalizeConstraintDefinition(
    constraints.get('WorkerPayment_privacy_contract_check')?.definition,
  );
  for (const fragment of [
    "submissionContractVersion = 'LEGACY_REATTESTATION_REQUIRED'",
    'privacyChoiceEventId IS NULL',
    "submissionContractVersion = 'ATTESTED_V1'",
    'privacyChoiceEventId IS NOT NULL',
  ]) {
    assert(
      destinationPrivacy.includes(fragment),
      `Worker payment privacy provenance is missing ${fragment}.`,
    );
  }

  const foreignKeyContract = {
    WorkerPrivacyChoice_organization_fkey: [
      'FOREIGN KEY organizationId REFERENCES Organizationid',
      'r',
    ],
    WorkerPrivacyChoice_person_scope_fkey: [
      'FOREIGN KEY organizationId, personId REFERENCES WorkerPersonorganizationId, id',
      'r',
    ],
    WorkerPrivacyChoice_membership_actor_fkey: [
      'FOREIGN KEY organizationId, actorMembershipId REFERENCES TenantMembershiporganizationId, id',
      'r',
    ],
    WorkerPrivacyChoice_channel_actor_fkey: [
      'FOREIGN KEY organizationId, personId, channelIdentityId REFERENCES WorkerChannelIdentityorganizationId, personId, id',
      'r',
    ],
    WorkerPayment_privacy_choice_scope_fkey: [
      'FOREIGN KEY organizationId, personId, purpose, privacyChoiceEventId REFERENCES WorkerPrivacyChoiceEventorganizationId, personId, paymentPurpose, id',
      'r',
    ],
    WorkerPayment_flow_reservation_fkey: [
      'FOREIGN KEY flowSubmissionReservationId REFERENCES WorkerPaymentFlowSessionsubmissionReservationId',
      'r',
    ],
  };
  for (const [name, [definitionFragment, deleteAction]] of Object.entries(foreignKeyContract)) {
    const foreignKey = constraints.get(name);
    assert(foreignKey, `Missing privacy provenance foreign key ${name}.`);
    assert(foreignKey.confdeltype === deleteAction, `${name} must be ON DELETE RESTRICT.`);
    assert(foreignKey.confupdtype === 'c', `${name} must be ON UPDATE CASCADE.`);
    assert(
      normalizeConstraintDefinition(foreignKey.definition).includes(definitionFragment),
      `${name} does not preserve its tenant/person/payment scope.`,
    );
  }

  const choiceTriggers = await loadUserTriggers(client, 'WorkerPrivacyChoiceEvent', [
    'WorkerPrivacyChoiceEvent_append_only',
    'WorkerPrivacyChoiceEvent_no_truncate',
  ]);
  const appendOnly = choiceTriggers.get('WorkerPrivacyChoiceEvent_append_only');
  const noTruncate = choiceTriggers.get('WorkerPrivacyChoiceEvent_no_truncate');
  assert(appendOnly?.tgenabled === 'A', 'Worker privacy append-only trigger is not ENABLE ALWAYS.');
  assert(noTruncate?.tgenabled === 'A', 'Worker privacy truncate guard is not ENABLE ALWAYS.');
  assert(
    /BEFORE (DELETE OR UPDATE|UPDATE OR DELETE)/.test(appendOnly?.definition || ''),
    'Worker privacy append-only trigger does not cover UPDATE and DELETE.',
  );
  assert(
    /BEFORE TRUNCATE/.test(noTruncate?.definition || ''),
    'Worker privacy append-only ledger does not reject TRUNCATE.',
  );
  for (const trigger of [appendOnly, noTruncate]) {
    assert(
      trigger?.function_name === 'obrasaas_worker_privacy_choice_append_only',
      'Worker privacy append-only trigger calls an unexpected function.',
    );
    assert(trigger?.security_definer === false, 'Worker privacy trigger must not be SECURITY DEFINER.');
    assert(
      /SET search_path TO 'pg_catalog'/i.test(trigger?.function_definition || ''),
      'Worker privacy append-only function does not pin a safe search_path.',
    );
    assert(
      /ERRCODE\s*=\s*'55000'[\s\S]*append-only/i.test(trigger?.function_definition || ''),
      'Worker privacy append-only function does not fail closed with SQLSTATE 55000.',
    );
  }

  const destinationTriggers = await loadUserTriggers(client, 'WorkerPaymentDestination', [
    'WorkerPayment_privacy_choice_validate',
    'WorkerPayment_destination_guard',
    'WorkerPaymentDestination_flow_provenance_guard',
    'WorkerPaymentDestination_no_delete',
    'WorkerPaymentDestination_no_truncate',
  ]);
  for (const name of destinationTriggers.keys()) {
    assert(
      destinationTriggers.get(name)?.tgenabled === 'A',
      `Worker payment trigger ${name} is not ENABLE ALWAYS.`,
    );
    assert(
      destinationTriggers.get(name)?.security_definer === false,
      `Worker payment trigger ${name} must not be SECURITY DEFINER.`,
    );
    assert(
      /SET search_path TO 'pg_catalog'/i.test(
        destinationTriggers.get(name)?.function_definition || '',
      ),
      `Worker payment trigger ${name} does not pin a safe function search_path.`,
    );
  }
  assert(
    destinationTriggers.size === 5,
    'One or more worker payment privacy/provenance/immutability triggers are missing.',
  );
  const privacyValidation = destinationTriggers.get('WorkerPayment_privacy_choice_validate');
  assert(
    /BEFORE INSERT OR UPDATE/.test(privacyValidation?.definition || ''),
    'Worker payment privacy validator does not cover INSERT and governed UPDATEs.',
  );
  assert(
    privacyValidation?.function_name === 'obrasaas_worker_payment_validate_privacy_choice',
    'Worker payment privacy validator calls an unexpected function.',
  );
  const privacyValidationBody = normalizeConstraintDefinition(
    privacyValidation?.function_definition,
  );
  for (const fragment of [
    "submissionContractVersion = 'LEGACY_REATTESTATION_REQUIRED'",
    "status IN 'VERIFIED', 'ACTIVE'",
    "submissionContractVersion = 'ATTESTED_V1'",
    'WorkerPrivacyChoiceEvent',
    'paymentPurpose = $4',
    "submissionSource = 'TENANT_MEMBERSHIP'",
    'actorMembershipId = NEW.submittedByMembershipId',
    "submissionSource = 'WORKER_CHANNEL'",
    'channelIdentityId = NEW.submittedByChannelIdentityId',
    "OLD.status = 'ACTIVE'",
    "choice_record.channel <> 'WHATSAPP_FLOW'",
  ]) {
    assert(
      privacyValidationBody.includes(fragment),
      `Worker payment privacy validator is missing ${fragment}.`,
    );
  }
  const flowProvenanceGuard = destinationTriggers.get(
    'WorkerPaymentDestination_flow_provenance_guard',
  );
  assert(
    /BEFORE INSERT OR UPDATE/.test(flowProvenanceGuard?.definition || '')
      && flowProvenanceGuard?.function_name
        === 'enforce_worker_payment_destination_flow_provenance',
    'Worker payment destination Flow provenance trigger is missing or misbound.',
  );
  const flowProvenanceBody = normalizeConstraintDefinition(
    flowProvenanceGuard?.function_definition,
  );
  for (const fragment of [
    'OLD.flowSubmissionReservationId IS DISTINCT FROM NEW.flowSubmissionReservationId',
    'OLD.flowSubmissionFingerprintKeyId IS DISTINCT FROM NEW.flowSubmissionFingerprintKeyId',
    'OLD.flowSubmissionFingerprintHmac IS DISTINCT FROM NEW.flowSubmissionFingerprintHmac',
    'worker payment destination Flow provenance is immutable',
    "ERRCODE = '55000'",
    "flow_provenance.session_status IS DISTINCT FROM 'PROCESSING'",
    'flow_provenance.session_organization_id IS DISTINCT FROM NEW.organizationId',
    'flow_provenance.session_person_id IS DISTINCT FROM NEW.personId',
    'flow_provenance.session_payment_purpose IS DISTINCT FROM NEW.purpose',
    'flow_provenance.session_destination_type IS DISTINCT FROM NEW.type',
    'flow_provenance.session_destination_fingerprint_key_id IS DISTINCT FROM NEW.fingerprintKeyId',
    'flow_provenance.session_destination_fingerprint IS DISTINCT FROM NEW.fingerprint',
    'flow_provenance.session_fingerprint_key_id IS DISTINCT FROM NEW.flowSubmissionFingerprintKeyId',
    'flow_provenance.session_fingerprint_hmac IS DISTINCT FROM NEW.flowSubmissionFingerprintHmac',
    'flow_provenance.session_destination_operation_key IS DISTINCT FROM NEW.operationKey',
    'flow_provenance.session_privacy_operation_key IS DISTINCT FROM flow_provenance.privacy_operation_key',
    "NEW.submissionSource IS DISTINCT FROM 'WORKER_CHANNEL'",
    "NEW.submissionContractVersion IS DISTINCT FROM 'ATTESTED_V1'",
    "flow_provenance.privacy_channel IS DISTINCT FROM 'WHATSAPP_FLOW'",
    "flow_provenance.privacy_action IS DISTINCT FROM 'WORKER_ACKNOWLEDGED'",
    'flow_provenance.privacy_decided_at IS DISTINCT FROM NEW.submittedAt',
    'worker payment destination Flow provenance is invalid',
  ]) {
    assert(
      flowProvenanceBody.includes(fragment),
      `Worker payment destination Flow provenance guard is missing ${fragment}.`,
    );
  }
  const destinationGuard = destinationTriggers.get('WorkerPayment_destination_guard');
  assert(
    /BEFORE UPDATE/.test(destinationGuard?.definition || '')
      && destinationGuard?.function_name === 'obrasaas_worker_payment_destination_guard',
    'Worker payment immutable transition guard is missing or misbound.',
  );
  for (const fragment of [
    'Privacy re-attestation and key rewrap must be separate operations',
    'Privacy re-attestation requires one revision increment',
    "OLD.status = 'PENDING_VERIFICATION' AND NEW.status = 'VERIFIED'",
    "OLD.status = 'VERIFIED' AND NEW.status = 'ACTIVE'",
    "OLD.status = 'ACTIVE' AND NEW.status = 'SUPERSEDED'",
    'Worker payment destination immutable fields changed',
  ]) {
    assert(
      normalizeConstraintDefinition(destinationGuard?.function_definition).includes(fragment),
      `Worker payment destination guard is missing ${fragment}.`,
    );
  }
  const deleteGuard = destinationTriggers.get('WorkerPaymentDestination_no_delete');
  const truncateGuard = destinationTriggers.get('WorkerPaymentDestination_no_truncate');
  assert(/BEFORE DELETE/.test(deleteGuard?.definition || ''), 'Worker payment DELETE guard is missing.');
  assert(
    /BEFORE TRUNCATE/.test(truncateGuard?.definition || ''),
    'Worker payment TRUNCATE guard is missing.',
  );
  for (const trigger of [deleteGuard, truncateGuard]) {
    assert(
      trigger?.function_name === 'obrasaas_worker_payment_destination_no_remove'
        && /ERRCODE\s*=\s*'55000'[\s\S]*cannot be deleted or truncated/i.test(
          trigger.function_definition,
        ),
      'Worker payment removal guard does not fail closed with SQLSTATE 55000.',
    );
  }
}

async function assertWorkerOnboardingFlowSessionContract(client) {
  const columns = await client.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'WorkerOnboardingFlowSession'`,
  );
  const columnNames = new Set(columns.rows.map((row) => row.column_name));
  for (const required of [
    'id',
    'claimId',
    'organizationId',
    'projectId',
    'connectionId',
    'phoneNumberId',
    'noticeVersion',
    'noticeContentSha256',
    'tokenSha256',
    'deliveryAttemptedAt',
    'deliveryRejectedAt',
    'privacyPresentedAt',
    'submittedAt',
    'consumedAt',
  ]) {
    assert(columnNames.has(required), `WorkerOnboardingFlowSession is missing ${required}.`);
  }
  for (const forbidden of [
    'recipientPhone',
    'providerSubject',
    'givenNames',
    'familyName',
    'legalName',
    'cuil',
    'claimToken',
    'noticeText',
    'privacyNoticeText',
  ]) {
    assert(
      !columnNames.has(forbidden),
      `WorkerOnboardingFlowSession must not persist sensitive field ${forbidden}.`,
    );
  }

  const constraints = await client.query(
    `SELECT constraint_record.conname,
            constraint_record.confdeltype,
            pg_get_constraintdef(constraint_record.oid, true) AS definition
       FROM pg_constraint AS constraint_record
      WHERE (
              constraint_record.conrelid = to_regclass(
                format('%I.%I', current_schema(), 'WorkerOnboardingFlowSession')
              )
              AND constraint_record.conname = ANY($1::text[])
            )
         OR (
              constraint_record.conrelid = to_regclass(
                format('%I.%I', current_schema(), 'WhatsAppFlowEndpointRequest')
              )
              AND constraint_record.conname = ANY($2::text[])
            )`,
    [
      [
        'WOFlowSession_contract_check',
        'WOFlowSession_delivery_shape_check',
        'WorkerOnboardingFlowSession_organizationId_fkey',
        'WorkerOnboardingFlowSession_project_scope_fkey',
        'WorkerOnboardingFlowSession_connection_scope_fkey',
        'WorkerOnboardingFlowSession_claim_scope_fkey',
      ],
      [
        'WhatsAppFlowEndpointRequest_flowSessionId_fkey',
        'WAFlowEndpointRequest_onboarding_session_fkey',
        'WAFlowEndpointRequest_session_at_most_one_check',
      ],
    ],
  );
  const byName = new Map(constraints.rows.map((row) => [row.conname, row]));
  const fixedContract = normalizeConstraintDefinition(
    byName.get('WOFlowSession_contract_check')?.definition,
  );
  for (const fragment of [
    "blueprintKey = 'worker-onboarding'",
    "screenId = 'WORKER_ONBOARDING'",
    "flowType = 'worker_onboarding'",
    "noticeVersion ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'",
    "noticeContentSha256 ~ '^[0-9a-f]{64}$'",
    "tokenSha256 ~ '^[0-9a-f]{64}$'",
    'expiresAt > createdAt',
  ]) {
    assert(
      fixedContract.includes(fragment),
      `Worker-onboarding Flow fixed contract is missing ${fragment}.`,
    );
  }
  const deliveryContract = normalizeConstraintDefinition(
    byName.get('WOFlowSession_delivery_shape_check')?.definition,
  );
  for (const fragment of [
    'deliveryAttemptedAt',
    'deliveryRejectedAt',
    'providerMessageId',
    'privacyPresentedAt',
    'submittedAt',
    'consumedExternalId',
  ]) {
    assert(
      deliveryContract.includes(fragment),
      `Worker-onboarding Flow delivery contract is missing ${fragment}.`,
    );
  }
  const requestFence = normalizeConstraintDefinition(
    byName.get('WAFlowEndpointRequest_session_at_most_one_check')?.definition,
  );
  assert(
    [
      'num_nonnulls',
      'flowSessionId',
      'workerOnboardingFlowSessionId',
      '<= 1',
    ].every((fragment) => requestFence.includes(fragment)),
    'WhatsApp Flow endpoint requests do not enforce mutually exclusive session domains.',
  );
  for (const name of [
    'WhatsAppFlowEndpointRequest_flowSessionId_fkey',
    'WAFlowEndpointRequest_onboarding_session_fkey',
  ]) {
    assert(
      byName.get(name)?.confdeltype === 'n',
      `${name} must preserve endpoint request tombstones with ON DELETE SET NULL.`,
    );
  }
  for (const name of [
    'WorkerOnboardingFlowSession_organizationId_fkey',
    'WorkerOnboardingFlowSession_project_scope_fkey',
    'WorkerOnboardingFlowSession_connection_scope_fkey',
    'WorkerOnboardingFlowSession_claim_scope_fkey',
  ]) {
    assert(byName.get(name)?.confdeltype === 'c', `${name} must be ON DELETE CASCADE.`);
  }

  const claimEvidence = await client.query(
    `SELECT column_record.column_name,
            constraint_record.convalidated,
            pg_get_constraintdef(constraint_record.oid, true) AS definition
       FROM information_schema.columns AS column_record
       LEFT JOIN pg_constraint AS constraint_record
         ON constraint_record.conrelid = to_regclass(
              format('%I.%I', current_schema(), 'WorkerOnboardingClaim')
            )
        AND constraint_record.conname = 'WorkerClaim_privacy_notice_evidence_check'
      WHERE column_record.table_schema = current_schema()
        AND column_record.table_name = 'WorkerOnboardingClaim'
        AND column_record.column_name = 'privacyNoticeContentSha256'`,
  );
  assert(
    claimEvidence.rows.length === 1,
    'WorkerOnboardingClaim is missing privacyNoticeContentSha256.',
  );
  const evidenceDefinition = normalizeConstraintDefinition(claimEvidence.rows[0].definition);
  assert(
    claimEvidence.rows[0].convalidated === true
      && [
        'num_nonnulls',
        'privacyNoticeContentSha256',
        "~ '^[0-9a-f]{64}$'",
        'privacyNoticeVersion',
        'privacyAcceptedAt',
        '= 0',
        '= 3',
      ].every((fragment) => evidenceDefinition.includes(fragment)),
    'Worker-onboarding claim privacy evidence is not structurally governed.',
  );
  assert(
    !evidenceDefinition.includes('claimedIdentity'),
    'Worker-onboarding privacy evidence must remain independent from the purgeable identity bundle.',
  );
}

async function assertWorkerPaymentFlowSessionContract(client) {
  const columns = await loadTableColumns(client, 'WorkerPaymentFlowSession');
  const columnContract = {
    flowSessionId: { nullable: false, dataType: 'uuid' },
    organizationId: { nullable: false, dataType: 'text' },
    projectId: { nullable: false, dataType: 'text' },
    connectionId: { nullable: false, dataType: 'text' },
    workerId: { nullable: false, dataType: 'text' },
    personId: { nullable: false, dataType: 'text' },
    channelIdentityId: { nullable: false, dataType: 'text' },
    noticeVersion: { nullable: false, dataType: 'character varying', maxLength: 64 },
    noticeContentSha256: { nullable: false, dataType: 'character', maxLength: 64 },
    expiresAt: { nullable: false, dataType: 'timestamp without time zone' },
    privacyPresentedAt: { nullable: true, dataType: 'timestamp without time zone' },
    submissionStatus: {
      nullable: false,
      udtName: 'WorkerPaymentFlowSubmissionStatus',
      defaultFragment: 'OPEN',
    },
    submissionFingerprintKeyId: {
      nullable: true,
      dataType: 'character varying',
      maxLength: 64,
    },
    submissionFingerprintHmac: { nullable: true, dataType: 'character', maxLength: 64 },
    submissionReservationId: { nullable: true, dataType: 'uuid' },
    submissionReservedAt: { nullable: true, dataType: 'timestamp without time zone' },
    paymentPurpose: { nullable: true, udtName: 'WorkerPaymentPurpose' },
    expectedDestinationType: { nullable: true, udtName: 'WorkerPaymentDestinationType' },
    expectedDestinationFingerprintKeyId: {
      nullable: true,
      dataType: 'character varying',
      maxLength: 100,
    },
    expectedDestinationFingerprint: {
      nullable: true,
      dataType: 'character',
      maxLength: 64,
    },
    expectedPrivacyOperationKey: {
      nullable: true,
      dataType: 'character varying',
      maxLength: 190,
    },
    expectedDestinationOperationKey: {
      nullable: true,
      dataType: 'character varying',
      maxLength: 190,
    },
    privacyChoiceEventId: { nullable: true, dataType: 'text' },
    destinationId: { nullable: true, dataType: 'text' },
    submittedAt: { nullable: true, dataType: 'timestamp without time zone' },
    submissionUncertainAt: { nullable: true, dataType: 'timestamp without time zone' },
    submissionReconciledAt: { nullable: true, dataType: 'timestamp without time zone' },
    reconciliationMethod: {
      nullable: true,
      udtName: 'WorkerPaymentFlowReconciliationMethod',
    },
    revision: { nullable: false, dataType: 'integer', defaultFragment: '0' },
    createdAt: { nullable: false, dataType: 'timestamp without time zone' },
    updatedAt: { nullable: false, dataType: 'timestamp without time zone' },
  };
  for (const [name, contract] of Object.entries(columnContract)) {
    assertColumnContract(columns, 'WorkerPaymentFlowSession', name, contract);
  }
  for (const name of columns.keys()) {
    assert(
      !/(?:destinationValue|financialValue|account|bank|routing|iban|holder|cuil|cbu|cvu|alias|encryptedPayload)/i.test(
        name,
      ),
      `WorkerPaymentFlowSession must not persist raw financial field ${name}.`,
    );
  }

  const constraintResult = await client.query(
    `SELECT constraint_record.conname,
            constraint_record.confdeltype,
            constraint_record.confupdtype,
            pg_get_constraintdef(constraint_record.oid, true) AS definition
       FROM pg_constraint AS constraint_record
      WHERE constraint_record.conrelid = to_regclass(
              format('%I.%I', current_schema(), 'WorkerPaymentFlowSession')
            )
        AND constraint_record.conname = ANY($1::text[])`,
    [[
      'WorkerPaymentFlowSession_contract_check',
      'WorkerPaymentFlowSession_submission_shape_check',
      'WorkerPaymentFlowSession_flow_session_fkey',
      'WorkerPaymentFlowSession_organizationId_fkey',
      'WorkerPaymentFlowSession_project_scope_fkey',
      'WorkerPaymentFlowSession_connection_scope_fkey',
      'WorkerPaymentFlowSession_worker_scope_fkey',
      'WorkerPaymentFlowSession_person_scope_fkey',
      'WorkerPaymentFlowSession_channel_scope_fkey',
      'WorkerPaymentFlowSession_privacy_choice_scope_fkey',
      'WorkerPaymentFlowSession_destination_scope_fkey',
    ]],
  );
  const constraints = new Map(constraintResult.rows.map((row) => [row.conname, row]));
  const fixedContract = normalizeConstraintDefinition(
    constraints.get('WorkerPaymentFlowSession_contract_check')?.definition,
  );
  for (const fragment of [
    "noticeVersion ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'",
    "noticeContentSha256 ~ '^[0-9a-f]{64}$'",
    'revision >= 0',
    'expiresAt > createdAt',
    'privacyPresentedAt >= createdAt',
    'privacyPresentedAt < expiresAt',
  ]) {
    assert(
      fixedContract.includes(fragment),
      `Worker payment Flow fixed contract is missing ${fragment}.`,
    );
  }
  const submissionShape = normalizeConstraintDefinition(
    constraints.get('WorkerPaymentFlowSession_submission_shape_check')?.definition,
  );
  for (const fragment of [
    "submissionStatus = 'OPEN'",
    "submissionStatus = 'PROCESSING'",
    "submissionStatus = 'SUCCEEDED'",
    "submissionStatus = 'UNCERTAIN'",
    'submissionFingerprintKeyId IS NULL',
    "submissionFingerprintKeyId ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'",
    "submissionFingerprintHmac ~ '^[0-9a-f]{64}$'",
    'submissionReservationId IS NOT NULL',
    'submissionReservedAt >= privacyPresentedAt',
    'submissionReservedAt < expiresAt',
    'paymentPurpose IS NOT NULL',
    'expectedDestinationType IS NULL',
    'expectedDestinationType IS NOT NULL',
    'expectedDestinationFingerprintKeyId IS NULL',
    "expectedDestinationFingerprintKeyId ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'",
    'expectedDestinationFingerprint IS NULL',
    "expectedDestinationFingerprint ~ '^[0-9a-f]{64}$'",
    'expectedPrivacyOperationKey IS NULL',
    "expectedPrivacyOperationKey ~ '^wpc:[0-9a-f]{64}$'",
    'expectedDestinationOperationKey IS NULL',
    "expectedDestinationOperationKey ~ '^wp:submit:[0-9a-f]{64}$'",
    'privacyChoiceEventId IS NOT NULL',
    'destinationId IS NOT NULL',
    'submittedAt >= submissionReservedAt',
    'submissionUncertainAt >= submissionReservedAt',
    'submissionReconciledAt IS NULL',
    'submissionReconciledAt IS NOT NULL',
    'submissionReconciledAt >= submissionUncertainAt',
    'reconciliationMethod IS NULL',
    "reconciliationMethod = 'OPERATION_PROVENANCE_V1'",
  ]) {
    assert(
      submissionShape.includes(fragment),
      `Worker payment Flow submission state contract is missing ${fragment}.`,
    );
  }
  for (const status of ['OPEN', 'PROCESSING', 'SUCCEEDED', 'UNCERTAIN']) {
    assert(
      submissionShape.split(`submissionStatus = '${status}'`).length === 2,
      `Worker payment Flow submission state ${status} is duplicated or absent.`,
    );
  }
  assert(
    submissionShape.split('submissionFingerprintKeyId IS NULL').length === 2,
    'Worker payment Flow OPEN state must not retain an HMAC key ID.',
  );
  assert(
    submissionShape
      .split("submissionFingerprintKeyId ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'")
      .length === 4,
    'Worker payment Flow reserved and terminal states must retain a valid HMAC key ID.',
  );

  const foreignKeyContract = {
    WorkerPaymentFlowSession_flow_session_fkey: [
      'FOREIGN KEY flowSessionId REFERENCES WhatsAppFlowSessionid',
      'r',
    ],
    WorkerPaymentFlowSession_organizationId_fkey: [
      'FOREIGN KEY organizationId REFERENCES Organizationid',
      'r',
    ],
    WorkerPaymentFlowSession_project_scope_fkey: [
      'FOREIGN KEY organizationId, projectId REFERENCES ProjectorganizationId, id',
      'r',
    ],
    WorkerPaymentFlowSession_connection_scope_fkey: [
      'FOREIGN KEY projectId, connectionId REFERENCES WhatsAppConnectionprojectId, id',
      'r',
    ],
    WorkerPaymentFlowSession_worker_scope_fkey: [
      'FOREIGN KEY organizationId, personId, projectId, workerId REFERENCES WorkerorganizationId, personId, projectId, id',
      'r',
    ],
    WorkerPaymentFlowSession_person_scope_fkey: [
      'FOREIGN KEY organizationId, personId REFERENCES WorkerPersonorganizationId, id',
      'r',
    ],
    WorkerPaymentFlowSession_channel_scope_fkey: [
      'FOREIGN KEY organizationId, personId, channelIdentityId REFERENCES WorkerChannelIdentityorganizationId, personId, id',
      'r',
    ],
    WorkerPaymentFlowSession_privacy_choice_scope_fkey: [
      'FOREIGN KEY organizationId, personId, paymentPurpose, privacyChoiceEventId REFERENCES WorkerPrivacyChoiceEventorganizationId, personId, paymentPurpose, id',
      'r',
    ],
    WorkerPaymentFlowSession_destination_scope_fkey: [
      'FOREIGN KEY organizationId, personId, paymentPurpose, destinationId REFERENCES WorkerPaymentDestinationorganizationId, personId, purpose, id',
      'r',
    ],
  };
  for (const [name, [definitionFragment, deleteAction]] of Object.entries(foreignKeyContract)) {
    const foreignKey = constraints.get(name);
    assert(foreignKey, `Missing worker payment Flow foreign key ${name}.`);
    assert(
      foreignKey.confdeltype === deleteAction,
      `${name} has the wrong ON DELETE behavior.`,
    );
    assert(foreignKey.confupdtype === 'c', `${name} must be ON UPDATE CASCADE.`);
    assert(
      normalizeConstraintDefinition(foreignKey.definition).includes(definitionFragment),
      `${name} does not preserve its governed tenant/session scope.`,
    );
  }

  const sessionTriggers = await loadUserTriggers(client, 'WorkerPaymentFlowSession', [
    'WorkerPaymentFlowSession_00_reconciliation_clock',
    'WorkerPaymentFlowSession_scope_guard',
    'WorkerPaymentFlowSession_transition_guard',
    'WorkerPaymentFlowSession_no_delete',
    'WorkerPaymentFlowSession_no_truncate',
  ]);
  assert(
    sessionTriggers.size === 5,
    'Worker payment Flow reconciliation, scope, transition, DELETE, or TRUNCATE guard is missing.',
  );
  for (const trigger of sessionTriggers.values()) {
    assert(
      trigger.tgenabled === 'A',
      `Worker payment Flow trigger ${trigger.tgname} is not ENABLE ALWAYS.`,
    );
    assert(
      trigger.security_definer === false,
      `Worker payment Flow trigger ${trigger.tgname} must not be SECURITY DEFINER.`,
    );
    assert(
      /SET search_path TO 'pg_catalog'/i.test(trigger.function_definition),
      `Worker payment Flow trigger ${trigger.tgname} does not pin a safe function search_path.`,
    );
  }
  const scopeGuard = sessionTriggers.get('WorkerPaymentFlowSession_scope_guard');
  assert(
    /BEFORE INSERT OR UPDATE/.test(scopeGuard?.definition || '')
      && scopeGuard?.function_name === 'enforce_worker_payment_flow_session_scope',
    'Worker payment Flow scope trigger is missing or misbound.',
  );
  const scopeBody = normalizeConstraintDefinition(scopeGuard?.function_definition);
  for (const fragment of [
    'WhatsAppFlowSession',
    'base_session.organizationId IS DISTINCT FROM NEW.organizationId',
    'base_session.projectId IS DISTINCT FROM NEW.projectId',
    'base_session.workerId IS DISTINCT FROM NEW.workerId',
    "base_session.blueprintKey IS DISTINCT FROM 'worker-payment-destination'",
    "base_session.screenId IS DISTINCT FROM 'WORKER_PAYMENT_DESTINATION'",
    "base_session.flowType IS DISTINCT FROM 'worker_payment_destination'",
    'base_session.expiresAt IS DISTINCT FROM NEW.expiresAt',
    'base_session.deliveryAttemptedAt IS NULL',
    'base_session.deliveryRejectedAt IS NOT NULL',
    'base_session.consumedAt IS NOT NULL',
    'observed_at := statement_timestamp',
    'observed_at < base_session.deliveryAttemptedAt',
    'observed_at >= base_session.expiresAt',
    "observed_at + '00:01:00' >= base_session.expiresAt",
    'NEW.privacyPresentedAt := observed_at',
    "OLD.submissionStatus = 'OPEN'",
    "NEW.submissionStatus = 'PROCESSING'",
    'worker payment Flow reservation requires a safe live delivery window',
    'NEW.submissionReservedAt := observed_at',
    "OLD.submissionStatus = 'PROCESSING'",
    "NEW.submissionStatus = 'UNCERTAIN'",
    'NEW.submissionUncertainAt := observed_at',
    'connection_phone IS DISTINCT FROM base_session.phoneNumberId',
    'enabled = TRUE',
    "connectionStatus = 'CONNECTED'",
    'Project project',
    'project.organizationId = worker.organizationId',
    'project.id = worker.projectId',
    "project.status = 'ACTIVE'",
    'worker.active = TRUE',
    "person.status = 'ACTIVE'",
    "person.identityStatus = 'VERIFIED'",
    "channel.provider = 'WHATSAPP'",
    "channel.status = 'VERIFIED'",
    'channel.revokedAt IS NULL',
  ]) {
    assert(scopeBody.includes(fragment), `Worker payment Flow scope guard is missing ${fragment}.`);
  }
  assert(
    scopeBody.split('observed_at := statement_timestamp').length === 4,
    'Worker payment Flow privacy, reservation, and UNCERTAIN timestamps must each use the database clock.',
  );
  assert(
    scopeBody.split('NEW.updatedAt := observed_at').length === 4,
    'Worker payment Flow database-authoritative transitions must also own updatedAt.',
  );

  const reconciliationClock = sessionTriggers.get(
    'WorkerPaymentFlowSession_00_reconciliation_clock',
  );
  assert(
    /BEFORE UPDATE/.test(reconciliationClock?.definition || '')
      && reconciliationClock?.function_name === 'stamp_worker_payment_flow_reconciliation',
    'Worker payment Flow reconciliation clock trigger is missing or misbound.',
  );
  const reconciliationClockBody = normalizeConstraintDefinition(
    reconciliationClock?.function_definition,
  );
  for (const fragment of [
    "OLD.submissionStatus = 'UNCERTAIN'",
    "NEW.submissionStatus = 'SUCCEEDED'",
    'NEW.submissionReconciledAt := statement_timestamp',
    "NEW.reconciliationMethod := 'OPERATION_PROVENANCE_V1'",
    'NEW.updatedAt := NEW.submissionReconciledAt',
    'OLD.submissionReconciledAt IS DISTINCT FROM NEW.submissionReconciledAt',
    'OLD.reconciliationMethod IS DISTINCT FROM NEW.reconciliationMethod',
    'worker payment Flow reconciliation evidence is database-owned',
    "ERRCODE = '55000'",
  ]) {
    assert(
      reconciliationClockBody.includes(fragment),
      `Worker payment Flow reconciliation clock is missing ${fragment}.`,
    );
  }

  const transitionGuard = sessionTriggers.get('WorkerPaymentFlowSession_transition_guard');
  assert(
    /BEFORE UPDATE/.test(transitionGuard?.definition || '')
      && transitionGuard?.function_name === 'enforce_worker_payment_flow_session_transition',
    'Worker payment Flow transition trigger is missing or misbound.',
  );
  const transitionBody = normalizeConstraintDefinition(transitionGuard?.function_definition);
  for (const fragment of [
    'OLD.flowSessionId IS DISTINCT FROM NEW.flowSessionId',
    'OLD.organizationId IS DISTINCT FROM NEW.organizationId',
    'OLD.projectId IS DISTINCT FROM NEW.projectId',
    'OLD.workerId IS DISTINCT FROM NEW.workerId',
    'OLD.personId IS DISTINCT FROM NEW.personId',
    'OLD.channelIdentityId IS DISTINCT FROM NEW.channelIdentityId',
    'OLD.noticeVersion IS DISTINCT FROM NEW.noticeVersion',
    'OLD.noticeContentSha256 IS DISTINCT FROM NEW.noticeContentSha256',
    'OLD.expiresAt IS DISTINCT FROM NEW.expiresAt',
    "OLD.submissionStatus = 'OPEN'",
    "NEW.submissionStatus = 'PROCESSING'",
    "OLD.submissionStatus = 'PROCESSING'",
    "NEW.submissionStatus IN 'SUCCEEDED', 'UNCERTAIN'",
    'NEW.submissionFingerprintKeyId IS NOT DISTINCT FROM OLD.submissionFingerprintKeyId',
    'NEW.submissionFingerprintHmac IS NOT DISTINCT FROM OLD.submissionFingerprintHmac',
    'NEW.submissionReservationId IS NOT DISTINCT FROM OLD.submissionReservationId',
    'NEW.submissionReservedAt IS NOT DISTINCT FROM OLD.submissionReservedAt',
    'NEW.paymentPurpose IS NOT DISTINCT FROM OLD.paymentPurpose',
    'NEW.expectedDestinationType IS NOT DISTINCT FROM OLD.expectedDestinationType',
    'NEW.expectedDestinationFingerprintKeyId IS NOT DISTINCT FROM OLD.expectedDestinationFingerprintKeyId',
    'NEW.expectedDestinationFingerprint IS NOT DISTINCT FROM OLD.expectedDestinationFingerprint',
    'NEW.expectedPrivacyOperationKey IS NOT DISTINCT FROM OLD.expectedPrivacyOperationKey',
    'NEW.expectedDestinationOperationKey IS NOT DISTINCT FROM OLD.expectedDestinationOperationKey',
    'NEW.revision = OLD.revision + 1',
    "NEW.submissionStatus = 'SUCCEEDED'",
    "OLD.submissionStatus = 'UNCERTAIN'",
    'NEW.submissionUncertainAt IS NOT DISTINCT FROM OLD.submissionUncertainAt',
    'WorkerPaymentDestination',
    'WorkerPrivacyChoiceEvent',
    "success_provenance.destination_contract IS DISTINCT FROM 'ATTESTED_V1'",
    'success_provenance.destination_operation_key IS DISTINCT FROM NEW.expectedDestinationOperationKey',
    'success_provenance.destination_type IS DISTINCT FROM NEW.expectedDestinationType',
    'success_provenance.destination_value_fingerprint_key_id IS DISTINCT FROM NEW.expectedDestinationFingerprintKeyId',
    'success_provenance.destination_value_fingerprint IS DISTINCT FROM NEW.expectedDestinationFingerprint',
    'success_provenance.destination_reservation_id IS DISTINCT FROM NEW.submissionReservationId',
    'success_provenance.destination_fingerprint_key_id IS DISTINCT FROM NEW.submissionFingerprintKeyId',
    'success_provenance.destination_fingerprint_hmac IS DISTINCT FROM NEW.submissionFingerprintHmac',
    "success_provenance.privacy_purpose IS DISTINCT FROM 'PAYMENT_DESTINATION_CAPTURE'",
    "success_provenance.privacy_channel IS DISTINCT FROM 'WHATSAPP_FLOW'",
    "success_provenance.privacy_action IS DISTINCT FROM 'WORKER_ACKNOWLEDGED'",
    'success_provenance.privacy_channel_identity_id IS DISTINCT FROM NEW.channelIdentityId',
    'success_provenance.privacy_notice_version IS DISTINCT FROM NEW.noticeVersion',
    'success_provenance.privacy_notice_sha256 IS DISTINCT FROM NEW.noticeContentSha256',
    'success_provenance.privacy_presented_at IS DISTINCT FROM OLD.privacyPresentedAt',
    'success_provenance.privacy_decided_at IS DISTINCT FROM NEW.submittedAt',
    'success_provenance.privacy_decided_at < OLD.submissionReservedAt',
    'success_provenance.privacy_operation_key IS DISTINCT FROM NEW.expectedPrivacyOperationKey',
    'worker payment Flow success provenance is invalid',
    'worker payment Flow state transition is not allowed',
  ]) {
    assert(
      transitionBody.includes(fragment),
      `Worker payment Flow transition guard is missing ${fragment}.`,
    );
  }
  assert(
    transitionBody.split("OLD.submissionStatus = 'UNCERTAIN'").length === 2,
    'Worker payment Flow must expose exactly one UNCERTAIN recovery edge.',
  );
  assert(
    transitionBody.includes(
      "OLD.submissionStatus = 'UNCERTAIN' AND NEW.submissionStatus = 'SUCCEEDED' AND NEW.submissionUncertainAt IS NOT DISTINCT FROM OLD.submissionUncertainAt",
    ),
    'Worker payment Flow UNCERTAIN recovery must be exactly UNCERTAIN to SUCCEEDED.',
  );
  assert(
    !/OLD\.submissionStatus = 'UNCERTAIN'[\s\S]{0,250}NEW\.submissionStatus = 'PROCESSING'/.test(
      transitionBody,
    ),
    'Worker payment Flow must not reopen UNCERTAIN as PROCESSING.',
  );
  assert(
    !transitionBody.includes('success_provenance.destination_status'),
    'Worker payment Flow reconciliation must not depend on the destination current status.',
  );
  assert(
    !transitionBody.includes('success_provenance.privacy_decided_at >= OLD.expiresAt'),
    'Worker payment Flow success must not reject a DB-authoritative reservation because completion crossed expiry.',
  );

  const deleteGuard = sessionTriggers.get('WorkerPaymentFlowSession_no_delete');
  const truncateGuard = sessionTriggers.get('WorkerPaymentFlowSession_no_truncate');
  assert(
    /BEFORE DELETE/.test(deleteGuard?.definition || ''),
    'Worker payment Flow DELETE guard is missing.',
  );
  assert(
    /BEFORE TRUNCATE/.test(truncateGuard?.definition || ''),
    'Worker payment Flow TRUNCATE guard is missing.',
  );
  for (const trigger of [deleteGuard, truncateGuard]) {
    assert(
      trigger?.function_name === 'prevent_worker_payment_flow_session_removal'
        && /ERRCODE\s*=\s*'55000'/i.test(trigger.function_definition)
        && /cannot be deleted or truncated/i.test(trigger.function_definition),
      'Worker payment Flow removal guard does not fail closed with SQLSTATE 55000.',
    );
  }

  const baseTriggers = await loadUserTriggers(client, 'WhatsAppFlowSession', [
    'WhatsAppFlowSession_worker_payment_binding_guard',
  ]);
  const baseGuard = baseTriggers.get('WhatsAppFlowSession_worker_payment_binding_guard');
  assert(
    baseGuard?.tgenabled === 'A'
      && /BEFORE UPDATE/.test(baseGuard?.definition || '')
      && baseGuard?.function_name === 'prevent_worker_payment_flow_base_rebinding',
    'Specialized worker payment Flow base binding guard is missing, not ENABLE ALWAYS, or misbound.',
  );
  assert(baseGuard?.security_definer === false, 'Flow base binding guard must not be SECURITY DEFINER.');
  assert(
    /SET search_path TO 'pg_catalog'/i.test(baseGuard?.function_definition || ''),
    'Flow base binding guard does not pin a safe function search_path.',
  );
  const baseGuardBody = normalizeConstraintDefinition(baseGuard?.function_definition);
  for (const fragment of [
    'WorkerPaymentFlowSession',
    'flowSessionId = $1',
    'USING OLD.id',
    'OLD.organizationId IS DISTINCT FROM NEW.organizationId',
    'OLD.projectId IS DISTINCT FROM NEW.projectId',
    'OLD.workerId IS DISTINCT FROM NEW.workerId',
    'OLD.phoneNumberId IS DISTINCT FROM NEW.phoneNumberId',
    'OLD.recipientPhone IS DISTINCT FROM NEW.recipientPhone',
    'OLD.blueprintKey IS DISTINCT FROM NEW.blueprintKey',
    'OLD.flowId IS DISTINCT FROM NEW.flowId',
    'OLD.screenId IS DISTINCT FROM NEW.screenId',
    'OLD.flowType IS DISTINCT FROM NEW.flowType',
    'OLD.sourceExternalId IS DISTINCT FROM NEW.sourceExternalId',
    'OLD.tokenSha256 IS DISTINCT FROM NEW.tokenSha256',
    'OLD.expiresAt IS DISTINCT FROM NEW.expiresAt',
    "ERRCODE = '55000'",
  ]) {
    assert(baseGuardBody.includes(fragment), `Worker payment Flow base guard is missing ${fragment}.`);
  }
}

async function assertWorkerOnboardingClaimRetentionContract(client) {
  const columns = await client.query(
    `SELECT column_name, is_nullable
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'WorkerOnboardingClaim'
        AND column_name = ANY($1::text[])`,
    [[
      'senderEncryptedPayload',
      'senderFingerprint',
      'senderFingerprintKeyId',
      'senderLastFour',
      'senderWrappingKeyId',
      'senderRecordVersion',
      'claimTokenHash',
      'sensitiveDataPurgedAt',
    ]],
  );
  const byColumn = new Map(columns.rows.map((row) => [row.column_name, row]));
  for (const name of [
    'senderEncryptedPayload',
    'senderFingerprint',
    'senderFingerprintKeyId',
    'senderLastFour',
    'senderWrappingKeyId',
    'senderRecordVersion',
    'sensitiveDataPurgedAt',
  ]) {
    assert(byColumn.get(name)?.is_nullable === 'YES', `${name} must support retention tombstones.`);
  }
  assert(
    byColumn.get('claimTokenHash')?.is_nullable === 'NO',
    'claimTokenHash must remain a retained, non-null one-way replay commitment.',
  );

  const constraints = await client.query(
    `SELECT constraint_record.conname,
            constraint_record.convalidated,
            pg_get_constraintdef(constraint_record.oid, true) AS definition
       FROM pg_constraint AS constraint_record
      WHERE constraint_record.conrelid = to_regclass(
              format('%I.%I', current_schema(), 'WorkerOnboardingClaim')
            )
        AND constraint_record.conname = ANY($1::text[])`,
    [[
      'WorkerOnboardingClaim_sender_check',
      'WorkerOnboardingClaim_identity_bundle_check',
      'WorkerClaim_sensitive_retention_check',
      'WorkerOnboardingClaim_state_check',
    ]],
  );
  const byName = new Map(constraints.rows.map((row) => [row.conname, row]));
  const sender = normalizeConstraintDefinition(
    byName.get('WorkerOnboardingClaim_sender_check')?.definition,
  );
  for (const fragment of [
    'num_nonnulls',
    'senderEncryptedPayload',
    'senderFingerprint',
    'senderFingerprintKeyId',
    'senderLastFour',
    'senderWrappingKeyId',
    'senderRecordVersion',
    '= 0',
    '= 6',
    '^v[23]',
  ]) {
    assert(sender.includes(fragment), `Sender retention bundle is missing ${fragment}.`);
  }

  const identity = normalizeConstraintDefinition(
    byName.get('WorkerOnboardingClaim_identity_bundle_check')?.definition,
  );
  for (const fragment of [
    'num_nonnulls',
    'claimedIdentityEncryptedPayload',
    'claimedCuilFingerprint',
    'claimedCuilFingerprintKeyId',
    'claimedCuilLastFour',
    'claimedIdentityWrappingKeyId',
    'claimedIdentityRecordVersion',
    '= 0',
    '= 6',
    '^v[23]',
  ]) {
    assert(identity.includes(fragment), `Identity retention bundle is missing ${fragment}.`);
  }
  assert(
    !identity.includes('privacyNotice'),
    'Purgeable identity and retained privacy evidence are still coupled.',
  );

  const retention = normalizeConstraintDefinition(
    byName.get('WorkerClaim_sensitive_retention_check')?.definition,
  );
  for (const fragment of [
    'PENDING',
    'SUBMITTED',
    'APPROVED',
    'REJECTED',
    'EXPIRED',
    'CANCELLED',
    'sensitiveDataPurgedAt IS NULL',
    'sensitiveDataPurgedAt IS NOT NULL',
    'senderEncryptedPayload',
    'claimedIdentityEncryptedPayload',
  ]) {
    assert(retention.includes(fragment), `Sensitive retention lifecycle is missing ${fragment}.`);
  }

  const lifecycle = normalizeConstraintDefinition(
    byName.get('WorkerOnboardingClaim_state_check')?.definition,
  );
  for (const fragment of [
    'PENDING',
    'SUBMITTED',
    'APPROVED',
    'REJECTED',
    'EXPIRED',
    'CANCELLED',
    'privacyNoticeVersion IS NULL',
    'privacyNoticeVersion IS NOT NULL',
  ]) {
    assert(lifecycle.includes(fragment), `Onboarding lifecycle is missing ${fragment}.`);
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
  await assertWorkerPaymentPrivacyContract(client);
  await assertWorkerOnboardingFlowSessionContract(client);
  await assertWorkerPaymentFlowSessionContract(client);
  await assertWorkerOnboardingClaimRetentionContract(client);
  await assertAppendOnlyLedger(client);
  await assertCanonicalPaymentIdentity(client);
  console.log(
    'Verified worker identity migrations: tenant scope, crypto rollout, onboarding retention, payment privacy provenance, terminal Flow replay fencing, partial uniqueness and append-only decisions.',
  );
  await client.query('ROLLBACK');
  transactionOpen = false;
} finally {
  if (transactionOpen) {
    await client.query('ROLLBACK').catch(() => undefined);
  }
  await client.end();
}
