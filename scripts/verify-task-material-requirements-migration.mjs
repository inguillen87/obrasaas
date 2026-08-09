import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import pg from 'pg';

const CONNECTION_ENV = 'TASK_MATERIAL_REQUIREMENTS_MIGRATION_DATABASE_URL';
const SCHEMA_ENV = 'TASK_MATERIAL_REQUIREMENTS_MIGRATION_SCHEMA';
const MIGRATIONS = Object.freeze([
  '20260802180000_task_material_requirements',
  '20260809090000_task_material_requirement_eligibility_not_null',
]);
const SCHEMA_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_$]{0,62}$/;
const connectionString = process.env[CONNECTION_ENV];

if (!connectionString) {
  throw new Error(`${CONNECTION_ENV} is required; DATABASE_URL is intentionally ignored.`);
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function parsePostgresUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${CONNECTION_ENV} must be a valid PostgreSQL URL.`);
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error(`${CONNECTION_ENV} must use PostgreSQL.`);
  }
  return parsed;
}

function resolveDatabaseSchema(value) {
  const parsed = parsePostgresUrl(value);
  const dsnSchemas = parsed.searchParams.getAll('schema');
  if (dsnSchemas.length > 1 && new Set(dsnSchemas).size > 1) {
    throw new Error(`${CONNECTION_ENV} contains conflicting schema parameters.`);
  }
  const dsnSchema = dsnSchemas[0] || null;
  const explicitSchema = process.env[SCHEMA_ENV] || null;
  if (explicitSchema && dsnSchema && explicitSchema !== dsnSchema) {
    throw new Error(`${SCHEMA_ENV} does not match the schema declared in the database URL.`);
  }
  const schema = explicitSchema || dsnSchema;
  if (!schema) {
    throw new Error(`Declare ${SCHEMA_ENV} or add an explicit schema parameter to the database URL.`);
  }
  if (!SCHEMA_IDENTIFIER_PATTERN.test(schema)) {
    throw new Error('The task material requirements schema must be a safe PostgreSQL identifier.');
  }
  return schema;
}

function hardenedVerifierConnectionString(value) {
  const parsed = parsePostgresUrl(value);
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  const isLocal = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname);
  if (hostname.endsWith('.neon.tech')) {
    parsed.searchParams.set('sslmode', 'verify-full');
  } else if (!isLocal && parsed.searchParams.get('sslmode') !== 'verify-full') {
    throw new Error(`${CONNECTION_ENV} must use sslmode=verify-full for a remote PostgreSQL host.`);
  }
  return parsed.toString();
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function normalizeDefinition(value) {
  return String(value || '').replaceAll('"', '').replace(/\s+/g, ' ').trim().toLowerCase();
}

const databaseSchema = resolveDatabaseSchema(connectionString);
const verifierConnectionString = hardenedVerifierConnectionString(connectionString);
const expectedMigrationChecksums = new Map(await Promise.all(MIGRATIONS.map(async (migration) => {
  const migrationSql = await readFile(new URL(
    `../prisma/migrations/${migration}/migration.sql`,
    import.meta.url,
  ));
  return [migration, createHash('sha256').update(migrationSql).digest('hex')];
})));

async function assertMigration(client) {
  const table = await client.query(
    "SELECT to_regclass(format('%I.%I', current_schema(), '_prisma_migrations')) AS name",
  );
  invariant(table.rows[0]?.name, 'The configured schema has no _prisma_migrations table.');
  const result = await client.query(
    `SELECT "migration_name", "checksum" FROM "_prisma_migrations"
      WHERE "migration_name" = ANY($1::text[])
        AND "finished_at" IS NOT NULL
        AND "rolled_back_at" IS NULL
      ORDER BY "migration_name"`,
    [MIGRATIONS],
  );
  invariant(
    result.rowCount === MIGRATIONS.length,
    'Task material requirements migrations are not applied exactly once.',
  );
  const appliedMigrations = new Map();
  for (const row of result.rows) {
    invariant(
      expectedMigrationChecksums.has(row.migration_name),
      `Unexpected task material requirements migration ${row.migration_name} was returned.`,
    );
    invariant(
      !appliedMigrations.has(row.migration_name),
      `Task material requirements migration ${row.migration_name} is applied more than once.`,
    );
    appliedMigrations.set(row.migration_name, row.checksum);
    invariant(
      row.checksum === expectedMigrationChecksums.get(row.migration_name),
      `Applied task material requirements migration ${row.migration_name} does not match the repository checksum.`,
    );
  }
  for (const migration of MIGRATIONS) {
    invariant(
      appliedMigrations.has(migration),
      `Task material requirements migration ${migration} is not applied.`,
    );
  }
}

async function assertEnum(client) {
  const result = await client.query(
    `SELECT enum_record.enumlabel AS value
       FROM pg_type AS type_record
       JOIN pg_namespace AS namespace_record ON namespace_record.oid = type_record.typnamespace
       JOIN pg_enum AS enum_record ON enum_record.enumtypid = type_record.oid
      WHERE namespace_record.nspname = current_schema()
        AND type_record.typname = 'TaskMaterialRequirementKind'
      ORDER BY enum_record.enumsortorder`,
  );
  invariant(
    JSON.stringify(result.rows.map((row) => row.value))
      === JSON.stringify(['MATERIALS_REQUIRED', 'NO_MATERIALS_REQUIRED']),
    'TaskMaterialRequirementKind enum drifted.',
  );
}

async function columnsFor(client, table) {
  const result = await client.query(
    `SELECT column_name, data_type, udt_name, is_nullable, column_default,
             numeric_precision, numeric_scale, character_maximum_length,
             datetime_precision, is_generated, generation_expression
       FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = $1`,
    [table],
  );
  return new Map(result.rows.map((row) => [row.column_name, row]));
}

function assertColumn(table, columns, name, contract) {
  const column = columns.get(name);
  invariant(column, `${table}.${name} is missing.`);
  invariant(
    column.is_nullable === (contract.nullable ? 'YES' : 'NO'),
    `${table}.${name} nullability drifted.`,
  );
  if (contract.dataType) {
    invariant(column.data_type === contract.dataType, `${table}.${name} type drifted.`);
  }
  if (contract.udtName) {
    invariant(column.udt_name === contract.udtName, `${table}.${name} database type drifted.`);
  }
  if (contract.length) {
    invariant(
      Number(column.character_maximum_length) === contract.length,
      `${table}.${name} length drifted.`,
    );
  }
  if (contract.precision) {
    invariant(
      Number(column.numeric_precision) === contract.precision
        && Number(column.numeric_scale) === contract.scale,
      `${table}.${name} precision drifted.`,
    );
  }
  if (contract.datetimePrecision) {
    invariant(
      Number(column.datetime_precision) === contract.datetimePrecision,
      `${table}.${name} datetime precision drifted.`,
    );
  }
  if (Object.hasOwn(contract, 'defaultDefinition')) {
    invariant(
      normalizeDefinition(column.column_default) === contract.defaultDefinition,
      `${table}.${name} default drifted.`,
    );
  }
  if (contract.generated) {
    invariant(column.is_generated === contract.generated, `${table}.${name} generation mode drifted.`);
  }
}

async function assertColumns(client) {
  const expected = new Map([
    ['TaskMaterialRequirementRevision', new Map([
      ['id', { dataType: 'text' }],
      ['organizationId', { dataType: 'text' }],
      ['projectId', { dataType: 'text' }],
      ['taskId', { dataType: 'text' }],
      ['taskIdentitySnapshot', { dataType: 'boolean', defaultDefinition: 'true' }],
      ['kind', { dataType: 'USER-DEFINED', udtName: 'TaskMaterialRequirementKind' }],
      ['version', { dataType: 'integer' }],
      ['lineCount', { dataType: 'integer' }],
      ['taskRevisionSnapshot', { dataType: 'integer' }],
      ['taskCodeSnapshot', { dataType: 'character varying', length: 64, nullable: true }],
      ['taskTitleSnapshot', { dataType: 'character varying', length: 160 }],
      ['taskStartsAtSnapshot', {
        dataType: 'timestamp without time zone', datetimePrecision: 3, nullable: true,
      }],
      ['taskEndsAtSnapshot', {
        dataType: 'timestamp without time zone', datetimePrecision: 3, nullable: true,
      }],
      ['predecessorId', { dataType: 'text', nullable: true }],
      ['operationKey', { dataType: 'character varying', length: 190 }],
      ['requestFingerprint', { dataType: 'character', length: 64 }],
      ['reason', { dataType: 'character varying', length: 500 }],
      ['authoredById', { dataType: 'text' }],
      ['createdAt', { dataType: 'timestamp without time zone', datetimePrecision: 3 }],
    ])],
    ['TaskMaterialRequirementLine', new Map([
      ['id', { dataType: 'text' }],
      ['organizationId', { dataType: 'text' }],
      ['projectId', { dataType: 'text' }],
      ['taskId', { dataType: 'text' }],
      ['revisionId', { dataType: 'text' }],
      ['inventoryItemId', { dataType: 'text' }],
      ['requiredQuantity', { dataType: 'numeric', precision: 14, scale: 3 }],
      ['itemCodeSnapshot', { dataType: 'character varying', length: 32 }],
      ['itemNameSnapshot', { dataType: 'character varying', length: 160 }],
      ['unitSnapshot', { dataType: 'character varying', length: 32 }],
      ['notes', { dataType: 'character varying', length: 500, nullable: true }],
      ['createdAt', { dataType: 'timestamp without time zone', datetimePrecision: 3 }],
    ])],
  ]);

  for (const [table, contracts] of expected) {
    const columns = await columnsFor(client, table);
    invariant(columns.size === contracts.size, `${table} column set drifted.`);
    for (const [name, contract] of contracts) {
      assertColumn(table, columns, name, contract);
    }
  }

  const taskColumns = await columnsFor(client, 'Task');
  assertColumn('Task', taskColumns, 'materialRequirementEligible', {
    dataType: 'boolean',
    generated: 'ALWAYS',
  });
  const generatedIdentity = normalizeDefinition(
    taskColumns.get('materialRequirementEligible')?.generation_expression,
  );
  invariant(
    generatedIdentity.includes('type')
      && generatedIdentity.includes("'task'")
      && generatedIdentity.includes('coalesce')
      && generatedIdentity.includes('metadata')
      && generatedIdentity.includes("'source'")
      && generatedIdentity.includes("'canonical-task-v1'"),
    'Task.materialRequirementEligible generation expression drifted.',
  );
}

async function assertIndexes(client) {
  const expected = new Map([
    ['Task_material_requirement_identity_key', {
      table: 'Task', unique: true,
      columns: '(projectid, id, materialrequirementeligible)', partial: false,
    }],
    ['TaskMaterialRequirementRevision_pkey', {
      table: 'TaskMaterialRequirementRevision', unique: true, columns: '(id)', partial: false,
    }],
    ['TaskMaterialRequirementRevision_scope_id_key', {
      table: 'TaskMaterialRequirementRevision', unique: true,
      columns: '(organizationid, projectid, taskid, id)', partial: false,
    }],
    ['TaskMaterialRequirementRevision_task_version_key', {
      table: 'TaskMaterialRequirementRevision', unique: true,
      columns: '(projectid, taskid, version)', partial: false,
    }],
    ['TaskMaterialRequirementRevision_predecessor_key', {
      table: 'TaskMaterialRequirementRevision', unique: true,
      columns: '(organizationid, projectid, taskid, predecessorid)', partial: false,
    }],
    ['TaskMaterialRequirementRevision_operation_key', {
      table: 'TaskMaterialRequirementRevision', unique: true,
      columns: '(projectid, operationkey)', partial: false,
    }],
    ['TaskMaterialRequirementRevision_root_key', {
      table: 'TaskMaterialRequirementRevision', unique: true,
      columns: '(organizationid, projectid, taskid)', partial: true,
      predicate: 'predecessorid is null',
    }],
    ['TaskMaterialRequirementRevision_task_created_idx', {
      table: 'TaskMaterialRequirementRevision', unique: false,
      columns: '(projectid, taskid, createdat)', partial: false,
    }],
    ['TaskMaterialRequirementLine_pkey', {
      table: 'TaskMaterialRequirementLine', unique: true, columns: '(id)', partial: false,
    }],
    ['TaskMaterialRequirementLine_scope_id_key', {
      table: 'TaskMaterialRequirementLine', unique: true,
      columns: '(organizationid, projectid, taskid, revisionid, id)', partial: false,
    }],
    ['TaskMaterialRequirementLine_revision_item_key', {
      table: 'TaskMaterialRequirementLine', unique: true,
      columns: '(projectid, revisionid, inventoryitemid)', partial: false,
    }],
    ['TaskMaterialRequirementLine_task_item_idx', {
      table: 'TaskMaterialRequirementLine', unique: false,
      columns: '(projectid, taskid, inventoryitemid)', partial: false,
    }],
  ]);
  const result = await client.query(
    `SELECT indexname, tablename, indexdef FROM pg_indexes
      WHERE schemaname = current_schema() AND indexname = ANY($1::text[])`,
    [[...expected.keys()]],
  );
  const actual = new Map(result.rows.map((row) => [row.indexname, row]));
  for (const [name, contract] of expected) {
    const index = actual.get(name);
    const definition = normalizeDefinition(index?.indexdef);
    invariant(
      index?.tablename === contract.table,
      `Task material requirement index ${name} is missing or attached to the wrong table.`,
    );
    invariant(
      definition.startsWith(contract.unique ? 'create unique index ' : 'create index '),
      `Task material requirement index ${name} uniqueness drifted.`,
    );
    invariant(definition.includes(contract.columns), `${name} column order drifted.`);
    invariant(
      contract.partial === definition.includes(' where '),
      `${name} partial-index contract drifted.`,
    );
    if (contract.predicate) {
      invariant(definition.includes(contract.predicate), `${name} predicate drifted.`);
    }
  }
}

async function assertConstraints(client) {
  const expected = new Map([
    ['TaskMaterialRequirementRevision_version_check', ['c', 'TaskMaterialRequirementRevision', null]],
    ['TaskMaterialRequirementRevision_task_identity_check', ['c', 'TaskMaterialRequirementRevision', null]],
    ['TaskMaterialRequirementRevision_shape_check', ['c', 'TaskMaterialRequirementRevision', null]],
    ['TaskMaterialRequirementRevision_task_snapshot_check', ['c', 'TaskMaterialRequirementRevision', null]],
    ['TaskMaterialRequirementRevision_operation_key_check', ['c', 'TaskMaterialRequirementRevision', null]],
    ['TaskMaterialRequirementRevision_fingerprint_check', ['c', 'TaskMaterialRequirementRevision', null]],
    ['TaskMaterialRequirementRevision_reason_check', ['c', 'TaskMaterialRequirementRevision', null]],
    ['TaskMaterialRequirementLine_quantity_check', ['c', 'TaskMaterialRequirementLine', null]],
    ['TaskMaterialRequirementLine_item_snapshot_check', ['c', 'TaskMaterialRequirementLine', null]],
    ['TaskMaterialRequirementLine_notes_check', ['c', 'TaskMaterialRequirementLine', null]],
    ['TaskMaterialRequirementRevision_organizationId_fkey', ['f', 'TaskMaterialRequirementRevision', 'Organization']],
    ['TaskMaterialRequirementRevision_project_fkey', ['f', 'TaskMaterialRequirementRevision', 'Project']],
    ['TaskMaterialRequirementRevision_task_fkey', ['f', 'TaskMaterialRequirementRevision', 'Task']],
    ['TaskMaterialRequirementRevision_authoredById_fkey', ['f', 'TaskMaterialRequirementRevision', 'PlatformUser']],
    ['TaskMaterialRequirementRevision_predecessor_fkey', ['f', 'TaskMaterialRequirementRevision', 'TaskMaterialRequirementRevision']],
    ['TaskMaterialRequirementLine_revision_fkey', ['f', 'TaskMaterialRequirementLine', 'TaskMaterialRequirementRevision']],
    ['TaskMaterialRequirementLine_item_fkey', ['f', 'TaskMaterialRequirementLine', 'InventoryItem']],
  ]);
  const result = await client.query(
    `SELECT constraint_record.conname AS name,
            constraint_record.contype AS type,
            constraint_record.convalidated AS validated,
            constraint_record.condeferrable AS deferrable,
            table_record.relname AS table_name,
            referenced_table.relname AS referenced_table,
            pg_get_constraintdef(constraint_record.oid, true) AS definition
       FROM pg_constraint AS constraint_record
       JOIN pg_namespace AS namespace_record ON namespace_record.oid = constraint_record.connamespace
       JOIN pg_class AS table_record ON table_record.oid = constraint_record.conrelid
       LEFT JOIN pg_class AS referenced_table ON referenced_table.oid = constraint_record.confrelid
      WHERE namespace_record.nspname = current_schema()
        AND constraint_record.conname = ANY($1::text[])`,
    [[...expected.keys()]],
  );
  const actual = new Map(result.rows.map((row) => [row.name, row]));
  for (const [name, [type, table, referencedTable]] of expected) {
    const constraint = actual.get(name);
    invariant(constraint?.validated === true, `Required requirement constraint ${name} is missing or unvalidated.`);
    invariant(
      constraint.type === type && constraint.table_name === table,
      `Task material requirement constraint ${name} type/table drifted.`,
    );
    invariant(
      constraint.referenced_table === referencedTable,
      `Task material requirement constraint ${name} references the wrong table.`,
    );
    invariant(constraint.deferrable === false, `${name} must remain non-deferrable.`);
  }

  const definitions = new Map([...actual].map(([name, row]) => [
    name,
    normalizeDefinition(row.definition),
  ]));
  const shape = definitions.get('TaskMaterialRequirementRevision_shape_check');
  invariant(
    shape.includes("kind = 'materials_required'")
      && shape.includes('linecount >= 1')
      && shape.includes('linecount <= 200')
      && shape.includes("kind = 'no_materials_required'")
      && shape.includes('linecount = 0'),
    'Task material requirement mode/line-count check drifted.',
  );
  invariant(
    definitions.get('TaskMaterialRequirementRevision_task_identity_check')
      .includes('taskidentitysnapshot is true'),
    'Task material requirement canonical identity snapshot check drifted.',
  );
  const quantity = definitions.get('TaskMaterialRequirementLine_quantity_check');
  invariant(
    quantity.includes('requiredquantity > 0')
      && quantity.includes("requiredquantity <> 'nan'::numeric"),
    'Task material requirement quantities no longer reject zero, negatives or NUMERIC NaN.',
  );
  invariant(
    definitions.get('TaskMaterialRequirementRevision_fingerprint_check')
      .includes("requestfingerprint ~ '^[0-9a-f]{64}$'"),
    'Task material requirement fingerprint check drifted.',
  );
  const operationKeyCheck = definitions.get(
    'TaskMaterialRequirementRevision_operation_key_check',
  );
  invariant(
    operationKeyCheck.includes('char_length(operationkey::text) >= 8')
      && operationKeyCheck.includes('char_length(operationkey::text) <= 128')
      && operationKeyCheck.includes("operationkey::text ~ '^[a-za-z0-9][a-za-z0-9._:-]{7,127}$'::text"),
    'Task material requirement operation-key check drifted.',
  );

  const foreignKeys = new Map([
    ['TaskMaterialRequirementRevision_organizationId_fkey', [
      'foreign key (organizationid)', 'references organization(id)',
    ]],
    ['TaskMaterialRequirementRevision_project_fkey', [
      'foreign key (organizationid, projectid)', 'references project(organizationid, id)',
    ]],
    ['TaskMaterialRequirementRevision_task_fkey', [
      'foreign key (projectid, taskid, taskidentitysnapshot)',
      'references task(projectid, id, materialrequirementeligible)',
    ]],
    ['TaskMaterialRequirementRevision_authoredById_fkey', [
      'foreign key (authoredbyid)', 'references platformuser(id)',
    ]],
    ['TaskMaterialRequirementRevision_predecessor_fkey', [
      'foreign key (organizationid, projectid, taskid, predecessorid)',
      'references taskmaterialrequirementrevision(organizationid, projectid, taskid, id)',
    ]],
    ['TaskMaterialRequirementLine_revision_fkey', [
      'foreign key (organizationid, projectid, taskid, revisionid)',
      'references taskmaterialrequirementrevision(organizationid, projectid, taskid, id)',
    ]],
    ['TaskMaterialRequirementLine_item_fkey', [
      'foreign key (organizationid, projectid, inventoryitemid, unitsnapshot)',
      'references inventoryitem(organizationid, projectid, id, baseunit)',
    ]],
  ]);
  for (const [name, [columns, references]] of foreignKeys) {
    const definition = definitions.get(name);
    invariant(
      definition.includes(columns)
        && definition.includes(references)
        && definition.includes('on update restrict')
        && definition.includes('on delete restrict'),
      `${name} scope, column order or RESTRICT policy drifted.`,
    );
  }
}

async function assertTriggers(client) {
  const expected = new Map([
    ['TaskMaterialRequirementRevision_insert_guard', {
      deferred: false, type: 7, table: 'TaskMaterialRequirementRevision',
      fn: 'obrasaas_task_material_requirement_revision_insert_guard',
    }],
    ['TaskMaterialRequirementRevision_append_only', {
      deferred: false, type: 27, table: 'TaskMaterialRequirementRevision',
      fn: 'obrasaas_task_material_requirement_append_only',
    }],
    ['TaskMaterialRequirementRevision_no_truncate', {
      deferred: false, type: 34, table: 'TaskMaterialRequirementRevision',
      fn: 'obrasaas_task_material_requirement_no_truncate',
    }],
    ['TaskMaterialRequirementRevision_snapshot_guard', {
      deferred: true, type: 5, table: 'TaskMaterialRequirementRevision',
      fn: 'obrasaas_task_material_requirement_snapshot_guard',
    }],
    ['TaskMaterialRequirementLine_insert_guard', {
      deferred: false, type: 7, table: 'TaskMaterialRequirementLine',
      fn: 'obrasaas_task_material_requirement_line_insert_guard',
    }],
    ['TaskMaterialRequirementLine_append_only', {
      deferred: false, type: 27, table: 'TaskMaterialRequirementLine',
      fn: 'obrasaas_task_material_requirement_append_only',
    }],
    ['TaskMaterialRequirementLine_no_truncate', {
      deferred: false, type: 34, table: 'TaskMaterialRequirementLine',
      fn: 'obrasaas_task_material_requirement_no_truncate',
    }],
    ['TaskMaterialRequirementLine_snapshot_guard', {
      deferred: true, type: 5, table: 'TaskMaterialRequirementLine',
      fn: 'obrasaas_task_material_requirement_snapshot_guard',
    }],
    ['Task_material_requirement_update_guard', {
      deferred: false, type: 19, table: 'Task',
      fn: 'obrasaas_task_material_requirement_task_guard',
    }],
    ['Task_material_requirement_delete_guard', {
      deferred: false, type: 11, table: 'Task',
      fn: 'obrasaas_task_material_requirement_task_guard',
    }],
  ]);
  const result = await client.query(
    `SELECT trigger_record.tgname AS name,
            trigger_record.tgenabled AS enabled,
            trigger_record.tgtype::integer AS type,
            trigger_record.tgdeferrable AS deferrable,
            trigger_record.tginitdeferred AS initially_deferred,
            table_record.relname AS table_name,
            function_record.proname AS function_name
       FROM pg_trigger AS trigger_record
       JOIN pg_class AS table_record ON table_record.oid = trigger_record.tgrelid
       JOIN pg_namespace AS namespace_record ON namespace_record.oid = table_record.relnamespace
       JOIN pg_proc AS function_record ON function_record.oid = trigger_record.tgfoid
      WHERE namespace_record.nspname = current_schema()
        AND NOT trigger_record.tgisinternal
        AND trigger_record.tgname = ANY($1::text[])`,
    [[...expected.keys()]],
  );
  const actual = new Map(result.rows.map((row) => [row.name, row]));
  for (const [name, contract] of expected) {
    const trigger = actual.get(name);
    invariant(trigger?.enabled === 'A', `Requirement trigger ${name} is missing or not ENABLE ALWAYS.`);
    invariant(trigger.type === contract.type, `Requirement trigger ${name} event/timing/row scope drifted.`);
    invariant(trigger.table_name === contract.table, `Requirement trigger ${name} is attached to the wrong table.`);
    invariant(trigger.function_name === contract.fn, `Requirement trigger ${name} invokes the wrong function.`);
    invariant(trigger.deferrable === contract.deferred, `Requirement trigger ${name} deferrability drifted.`);
    invariant(trigger.initially_deferred === contract.deferred, `Requirement trigger ${name} initial timing drifted.`);
  }
}

async function assertTriggerFunctions(client) {
  const expected = [
    'obrasaas_task_material_requirement_append_only',
    'obrasaas_task_material_requirement_no_truncate',
    'obrasaas_task_material_requirement_revision_insert_guard',
    'obrasaas_task_material_requirement_line_insert_guard',
    'obrasaas_task_material_requirement_snapshot_guard',
    'obrasaas_task_material_requirement_task_guard',
  ];
  const result = await client.query(
    `SELECT function_record.proname AS name,
            function_record.prosecdef AS security_definer,
            function_record.provolatile AS volatility,
            function_record.proconfig AS config,
            pg_get_functiondef(function_record.oid) AS definition
       FROM pg_proc AS function_record
       JOIN pg_namespace AS namespace_record ON namespace_record.oid = function_record.pronamespace
      WHERE namespace_record.nspname = current_schema()
        AND function_record.proname = ANY($1::text[])`,
    [expected],
  );
  const actual = new Map(result.rows.map((row) => [row.name, row]));
  for (const name of expected) {
    const fn = actual.get(name);
    invariant(fn, `Task material requirement trigger function ${name} is missing.`);
    invariant(fn.security_definer === false, `${name} must not be SECURITY DEFINER.`);
    invariant(fn.volatility === 'v', `${name} must remain VOLATILE.`);
    invariant((fn.config || []).includes('search_path=pg_catalog'), `${name} must pin search_path to pg_catalog.`);
  }

  const revisionGuard = normalizeDefinition(
    actual.get('obrasaas_task_material_requirement_revision_insert_guard')?.definition,
  );
  invariant(revisionGuard.includes('pg_advisory_xact_lock'), 'Requirement revision guard lost its task lock.');
  invariant(revisionGuard.includes('canonical-task-v1'), 'Requirement revisions no longer require canonical tasks.');
  invariant(revisionGuard.includes("status = ''active''"), 'Requirement author active-membership guard drifted.');
  invariant(revisionGuard.includes('extend the current head by one version'), 'Requirement revision chain guard drifted.');

  const lineGuard = normalizeDefinition(
    actual.get('obrasaas_task_material_requirement_line_insert_guard')?.definition,
  );
  invariant(
    lineGuard.includes("'task-material-requirement:'")
      && lineGuard.includes("'inventory-item:'")
      && lineGuard.indexOf("'task-material-requirement:'") < lineGuard.indexOf("'inventory-item:'"),
    'Requirement line lock order drifted.',
  );
  invariant(lineGuard.includes('require active inventory items'), 'Requirement lines no longer reject inactive items.');
  invariant(lineGuard.includes('item snapshot is not authoritative'), 'Requirement item snapshot guard drifted.');

  const snapshotGuard = normalizeDefinition(
    actual.get('obrasaas_task_material_requirement_snapshot_guard')?.definition,
  );
  invariant(
    snapshotGuard.includes('actual_line_count <> expected_line_count')
      && snapshotGuard.includes("revision_kind = 'materials_required'")
      && snapshotGuard.includes("revision_kind = 'no_materials_required'"),
    'Deferred requirement bundle completeness guard drifted.',
  );
  const taskGuard = normalizeDefinition(
    actual.get('obrasaas_task_material_requirement_task_guard')?.definition,
  );
  invariant(taskGuard.includes('pg_advisory_xact_lock'), 'Task identity guard lost its requirement lock.');
  invariant(
    taskGuard.includes('old.type is not distinct from new.type'),
    'Task identity guard no longer detects canonical task type changes.',
  );
  invariant(
    taskGuard.includes('cannot be deleted or lose canonical identity'),
    'Task identity guard no longer protects requirement history.',
  );
}

async function expectSqlFailure(client, callback, { code, message }, label) {
  await client.query('SAVEPOINT task_material_requirement_verifier_case');
  await client.query('SET CONSTRAINTS ALL DEFERRED');
  let failure = null;
  try {
    await callback();
    await client.query('SET CONSTRAINTS ALL IMMEDIATE');
  } catch (error) {
    failure = error;
  }
  await client.query('ROLLBACK TO SAVEPOINT task_material_requirement_verifier_case');
  await client.query('RELEASE SAVEPOINT task_material_requirement_verifier_case');
  await client.query('SET CONSTRAINTS ALL DEFERRED');
  invariant(failure, `${label} unexpectedly succeeded.`);
  invariant(failure.code === code, `${label} failed with SQLSTATE ${failure.code || 'unknown'}.`);
  invariant(String(failure.message || '').includes(message), `${label} failed for an unexpected reason.`);
}

async function flushDeferredConstraints(client) {
  await client.query('SET CONSTRAINTS ALL IMMEDIATE');
  await client.query('SET CONSTRAINTS ALL DEFERRED');
}

async function createFixture(client) {
  const suffix = randomUUID();
  const catalogCodeSuffix = suffix.slice(0, 8).toUpperCase();
  const fixture = {
    suffix,
    organizationId: `requirement_verify_org_${suffix}`,
    projectId: `requirement_verify_project_${suffix}`,
    actorId: `requirement_verify_actor_${suffix}`,
    membershipId: `requirement_verify_membership_${suffix}`,
    taskId: `requirement_verify_task_${suffix}`,
    inventoryItemId: `requirement_verify_item_${suffix}`,
    taskCode: `REQ-${catalogCodeSuffix}`,
    taskTitle: 'Tarea canónica para verificar materiales',
    itemCode: `MAT-${catalogCodeSuffix}`,
    itemName: 'Material verificador',
    unit: 'bolsas',
    taskRevision: 7,
  };
  await client.query(
    `INSERT INTO "Organization" ("id", "name", "slug", "updatedAt")
     VALUES ($1, 'Task requirement verifier', $2, CURRENT_TIMESTAMP)`,
    [fixture.organizationId, `task-requirement-verifier-${suffix}`],
  );
  await client.query(
    `INSERT INTO "Project" ("id", "organizationId", "name", "slug", "updatedAt")
     VALUES ($1, $2, 'Task requirement project', $3, CURRENT_TIMESTAMP)`,
    [fixture.projectId, fixture.organizationId, `task-requirement-project-${suffix}`],
  );
  await client.query(
    `INSERT INTO "PlatformUser" (
       "id", "clerkUserId", "primaryEmail", "lastSeenAt", "updatedAt"
     ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [fixture.actorId, `clerk-${suffix}`, `task-requirement-${suffix}@example.test`],
  );
  await client.query(
    `INSERT INTO "TenantMembership" (
       "id", "organizationId", "userId", "clerkRole", "tenantRole", "status", "updatedAt"
     ) VALUES ($1, $2, $3, 'org:admin', 'ADMIN', 'ACTIVE', CURRENT_TIMESTAMP)`,
    [fixture.membershipId, fixture.organizationId, fixture.actorId],
  );
  await client.query(
    `INSERT INTO "Task" (
       "id", "projectId", "code", "title", "type", "status", "revision", "metadata", "updatedAt"
     ) VALUES ($1, $2, $3, $4, 'TASK', 'BACKLOG', $5,
       '{"source":"canonical-task-v1"}'::jsonb, CURRENT_TIMESTAMP)`,
    [
      fixture.taskId,
      fixture.projectId,
      fixture.taskCode,
      fixture.taskTitle,
      fixture.taskRevision,
    ],
  );
  await client.query(
    `INSERT INTO "InventoryItem" (
       "id", "organizationId", "projectId", "code", "name", "baseUnit", "updatedAt"
     ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
    [
      fixture.inventoryItemId,
      fixture.organizationId,
      fixture.projectId,
      fixture.itemCode,
      fixture.itemName,
      fixture.unit,
    ],
  );
  return fixture;
}

async function insertRevision(client, fixture, overrides = {}) {
  const values = {
    id: `requirement_revision_${randomUUID()}`,
    kind: 'MATERIALS_REQUIRED',
    version: 1,
    lineCount: 1,
    predecessorId: null,
    operationKey: `task-material-requirement:${randomUUID()}`,
    taskIdentitySnapshot: true,
    requestFingerprint: 'a'.repeat(64),
    reason: 'Publicación controlada del requerimiento.',
    ...overrides,
  };
  await client.query(
    `INSERT INTO "TaskMaterialRequirementRevision" (
       "id", "organizationId", "projectId", "taskId", "taskIdentitySnapshot",
       "kind", "version", "lineCount",
       "taskRevisionSnapshot", "taskCodeSnapshot", "taskTitleSnapshot",
       "taskStartsAtSnapshot", "taskEndsAtSnapshot", "predecessorId", "operationKey",
       "requestFingerprint", "reason", "authoredById"
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
       NULL, NULL, $12, $13, $14, $15, $16)`,
    [
      values.id,
      fixture.organizationId,
      fixture.projectId,
      fixture.taskId,
      values.taskIdentitySnapshot,
      values.kind,
      values.version,
      values.lineCount,
      fixture.taskRevision,
      fixture.taskCode,
      fixture.taskTitle,
      values.predecessorId,
      values.operationKey,
      values.requestFingerprint,
      values.reason,
      fixture.actorId,
    ],
  );
  return values;
}

async function insertLine(client, fixture, revisionId, overrides = {}) {
  const values = {
    id: `requirement_line_${randomUUID()}`,
    quantity: '3.250',
    notes: 'Cantidad verificada de forma exacta.',
    ...overrides,
  };
  await client.query(
    `INSERT INTO "TaskMaterialRequirementLine" (
       "id", "organizationId", "projectId", "taskId", "revisionId", "inventoryItemId",
       "requiredQuantity", "itemCodeSnapshot", "itemNameSnapshot", "unitSnapshot", "notes"
     ) VALUES ($1, $2, $3, $4, $5, $6, $7::numeric, $8, $9, $10, $11)`,
    [
      values.id,
      fixture.organizationId,
      fixture.projectId,
      fixture.taskId,
      revisionId,
      fixture.inventoryItemId,
      values.quantity,
      fixture.itemCode,
      fixture.itemName,
      fixture.unit,
      values.notes,
    ],
  );
  return values;
}

async function assertRollbackOnlySmoke(client) {
  const fixture = await createFixture(client);
  const taskIdentity = await client.query(
    `SELECT "materialRequirementEligible" AS eligible
       FROM "Task"
      WHERE "projectId" = $1 AND "id" = $2`,
    [fixture.projectId, fixture.taskId],
  );
  invariant(
    taskIdentity.rows[0]?.eligible === true,
    'Canonical task did not generate materialRequirementEligible = true.',
  );
  const before = await client.query(
    `SELECT
       (SELECT count(*) FROM "TaskMaterialRequirementRevision"
         WHERE "organizationId" = $1 AND "projectId" = $2 AND "taskId" = $3) AS revisions,
       (SELECT count(*) FROM "TaskMaterialRequirementLine"
         WHERE "organizationId" = $1 AND "projectId" = $2 AND "taskId" = $3) AS lines`,
    [fixture.organizationId, fixture.projectId, fixture.taskId],
  );
  invariant(
    before.rows[0]?.revisions === '0' && before.rows[0]?.lines === '0',
    'Migration inferred a task material requirement from existing task or inventory data.',
  );

  await expectSqlFailure(
    client,
    () => insertRevision(client, fixture, {
      id: `requirement_false_identity_${randomUUID()}`,
      taskIdentitySnapshot: false,
      operationKey: `task-material-false-identity:${randomUUID()}`,
    }),
    { code: '23514', message: 'TaskMaterialRequirementRevision_task_identity_check' },
    'false canonical task identity snapshot',
  );

  await expectSqlFailure(
    client,
    () => insertRevision(client, fixture, {
      id: `requirement_incomplete_${randomUUID()}`,
      operationKey: `task-material-incomplete:${randomUUID()}`,
    }),
    { code: '55000', message: 'bundle must match its declared mode and line count exactly' },
    'incomplete material bundle',
  );

  const root = await insertRevision(client, fixture);
  const line = await insertLine(client, fixture, root.id);
  await flushDeferredConstraints(client);
  const published = await client.query(
    `SELECT revision."kind"::text AS kind, revision."version", revision."lineCount",
            line."requiredQuantity", line."unitSnapshot"
       FROM "TaskMaterialRequirementRevision" AS revision
       JOIN "TaskMaterialRequirementLine" AS line
         ON line."organizationId" = revision."organizationId"
        AND line."projectId" = revision."projectId"
        AND line."taskId" = revision."taskId"
        AND line."revisionId" = revision."id"
      WHERE revision."id" = $1 AND line."id" = $2`,
    [root.id, line.id],
  );
  invariant(
    published.rows[0]?.kind === 'MATERIALS_REQUIRED'
      && published.rows[0]?.version === 1
      && published.rows[0]?.lineCount === 1
      && published.rows[0]?.requiredQuantity === '3.250'
      && published.rows[0]?.unitSnapshot === fixture.unit,
    'Valid task material bundle did not preserve exact quantity, unit and version.',
  );

  const noMaterials = await insertRevision(client, fixture, {
    kind: 'NO_MATERIALS_REQUIRED',
    version: 2,
    lineCount: 0,
    predecessorId: root.id,
    operationKey: `task-material-none:${randomUUID()}`,
    requestFingerprint: 'b'.repeat(64),
    reason: 'La tarea no requiere materiales en esta versión.',
  });
  await flushDeferredConstraints(client);
  const explicitEmpty = await client.query(
    `SELECT revision."kind"::text AS kind, count(line."id")::integer AS line_count
       FROM "TaskMaterialRequirementRevision" AS revision
       LEFT JOIN "TaskMaterialRequirementLine" AS line
         ON line."organizationId" = revision."organizationId"
        AND line."projectId" = revision."projectId"
        AND line."taskId" = revision."taskId"
        AND line."revisionId" = revision."id"
      WHERE revision."id" = $1
      GROUP BY revision."kind"`,
    [noMaterials.id],
  );
  invariant(
    explicitEmpty.rows[0]?.kind === 'NO_MATERIALS_REQUIRED'
      && explicitEmpty.rows[0]?.line_count === 0,
    'Explicit NO_MATERIALS_REQUIRED bundle is not represented exactly.',
  );

  await expectSqlFailure(
    client,
    () => insertLine(client, fixture, noMaterials.id),
    { code: '23514', message: 'NO_MATERIALS_REQUIRED revisions cannot contain lines' },
    'line inside explicit no-materials bundle',
  );
  await expectSqlFailure(
    client,
    () => insertRevision(client, fixture, {
      id: `requirement_branch_${randomUUID()}`,
      version: 2,
      predecessorId: root.id,
      operationKey: `task-material-branch:${randomUUID()}`,
    }),
    { code: '55000', message: 'extend the current head by one version' },
    'branched requirement revision',
  );
  await expectSqlFailure(
    client,
    () => client.query(
      `UPDATE "TaskMaterialRequirementRevision" SET "reason" = 'Mutated history' WHERE "id" = $1`,
      [root.id],
    ),
    { code: '55000', message: 'append-only' },
    'requirement revision mutation',
  );
  await expectSqlFailure(
    client,
    () => client.query(`DELETE FROM "TaskMaterialRequirementLine" WHERE "id" = $1`, [line.id]),
    { code: '55000', message: 'append-only' },
    'requirement line deletion',
  );
  await expectSqlFailure(
    client,
    () => client.query(
      `UPDATE "Task" SET "type" = 'MILESTONE', "updatedAt" = CURRENT_TIMESTAMP
        WHERE "projectId" = $1 AND "id" = $2`,
      [fixture.projectId, fixture.taskId],
    ),
    { code: '55000', message: 'cannot be deleted or lose canonical identity' },
    'canonical task type mutation after requirement history',
  );
  await expectSqlFailure(
    client,
    () => client.query(
      `UPDATE "Task" SET "metadata" = '{"source":"legacy"}'::jsonb,
         "updatedAt" = CURRENT_TIMESTAMP WHERE "projectId" = $1 AND "id" = $2`,
      [fixture.projectId, fixture.taskId],
    ),
    { code: '55000', message: 'cannot be deleted or lose canonical identity' },
    'canonical task identity mutation after requirement history',
  );
}

const client = new pg.Client({
  connectionString: verifierConnectionString,
  application_name: 'obrasaas-task-material-requirements-migration-verifier',
  statement_timeout: 35_000,
  query_timeout: 40_000,
});

let connected = false;
let transactionOpen = false;
try {
  try {
    await client.connect();
    connected = true;
  } catch {
    throw new Error('Unable to connect to the dedicated task material requirements verification database.');
  }
  await client.query('BEGIN');
  transactionOpen = true;
  const schemaExists = await client.query(
    'SELECT to_regnamespace($1) IS NOT NULL AS exists',
    [databaseSchema],
  );
  invariant(schemaExists.rows[0]?.exists, `Configured PostgreSQL schema ${databaseSchema} does not exist.`);
  await client.query(`SET LOCAL search_path TO ${quoteIdentifier(databaseSchema)}, pg_catalog`);
  const activeSchema = await client.query('SELECT current_schema() AS name');
  invariant(
    activeSchema.rows[0]?.name === databaseSchema,
    'PostgreSQL did not activate the configured task material requirements schema.',
  );
  await client.query("SET LOCAL lock_timeout = '5s'");
  await client.query("SET LOCAL idle_in_transaction_session_timeout = '35s'");
  await client.query('SET CONSTRAINTS ALL DEFERRED');
  await assertMigration(client);
  await assertEnum(client);
  await assertColumns(client);
  await assertIndexes(client);
  await assertConstraints(client);
  await assertTriggers(client);
  await assertTriggerFunctions(client);
  await assertRollbackOnlySmoke(client);
  await client.query('ROLLBACK');
  transactionOpen = false;
  console.log(
    `Verified ${MIGRATIONS.join(', ')}: immutable exact task material bundles, linear revisions, explicit no-material mode and no inferred backfill.`,
  );
} finally {
  if (transactionOpen) await client.query('ROLLBACK').catch(() => undefined);
  if (connected) await client.end();
}
