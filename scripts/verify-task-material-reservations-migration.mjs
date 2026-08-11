import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import pg from 'pg';

const CONNECTION_ENV = 'TASK_MATERIAL_RESERVATIONS_MIGRATION_DATABASE_URL';
const SCHEMA_ENV = 'TASK_MATERIAL_RESERVATIONS_MIGRATION_SCHEMA';
const DISPOSABLE_CONCURRENCY_ENV = 'TASK_MATERIAL_RESERVATIONS_DISPOSABLE_CONCURRENCY';
const MIGRATION = '20260810150000_task_material_reservations';
const SCHEMA_PATTERN = /^[A-Za-z_][A-Za-z0-9_$]{0,62}$/;
const migrationPath = new URL(
  '../prisma/migrations/20260810150000_task_material_reservations/migration.sql',
  import.meta.url,
);
const RESERVE_SQL = `SELECT *
  FROM obrasaas_task_material_reserve(
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb
  )`;
const RELEASE_SQL = `SELECT *
  FROM obrasaas_task_material_release(
    $1, $2, $3, $4, $5, $6, $7, $8, $9
  )`;

const args = process.argv.slice(2);
const helpRequested = args.includes('--help') || args.includes('-h');
if (!helpRequested) assert.deepEqual(args, [], `Unknown arguments: ${args.join(' ')}`);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
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
  const disposableValue = String(process.env[DISPOSABLE_CONCURRENCY_ENV] || '0').trim();
  invariant(
    disposableValue === '0' || disposableValue === '1',
    `${DISPOSABLE_CONCURRENCY_ENV} must be exactly 0 or 1.`,
  );
  const disposableConcurrency = disposableValue === '1';
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (disposableConcurrency) {
    invariant(
      local && databaseName === 'obrasaas_ci' && schema === 'public',
      `${DISPOSABLE_CONCURRENCY_ENV}=1 is restricted to local obrasaas_ci/public.`,
    );
  }
  return {
    connectionString: parsed.toString(),
    disposableConcurrency,
    local,
    schema,
  };
}

async function assertMigration(client, schema, local) {
  const relation = await client.query('SELECT to_regclass($1) AS name', [
    `${schema}._prisma_migrations`,
  ]);
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
  invariant(result.rows[0].finished_at && !result.rows[0].rolled_back_at, `${MIGRATION} is not applied.`);
  const source = await readFile(migrationPath, 'utf8');
  const checksum = createHash('sha256').update(source).digest('hex');
  invariant(result.rows[0].checksum === checksum, `${MIGRATION} checksum drifted.`);
}

async function assertColumns(client, schema) {
  const result = await client.query(
    `SELECT table_name, column_name, is_nullable, is_generated, generation_expression
       FROM information_schema.columns
      WHERE table_schema = $1
        AND table_name = ANY($2::text[])`,
    [schema, [
      'Project',
      'InventoryAvailability',
      'TaskMaterialReservationTransaction',
      'TaskMaterialActiveReservation',
      'TaskMaterialReservationBalance',
      'TaskMaterialReservationEntry',
    ]],
  );
  const byKey = new Map(result.rows.map((row) => [`${row.table_name}.${row.column_name}`, row]));
  for (const key of [
    'InventoryAvailability.onHand',
    'InventoryAvailability.reserved',
    'InventoryAvailability.available',
    'InventoryAvailability.onHandRevision',
    'InventoryAvailability.reservationRevision',
    'Project.materialReservationEligible',
    'TaskMaterialReservationTransaction.transactionType',
    'TaskMaterialReservationTransaction.requirementRevisionId',
    'TaskMaterialReservationEntry.quantityDelta',
    'TaskMaterialReservationEntry.reversesEntryId',
    'TaskMaterialReservationBalance.requiredQuantity',
    'TaskMaterialReservationBalance.reservedQuantity',
    'TaskMaterialActiveReservation.reservationTransactionId',
    'TaskMaterialActiveReservation.projectReservationEligibleSnapshot',
  ]) invariant(byKey.has(key), `Missing ${key}.`);
  const available = byKey.get('InventoryAvailability.available');
  invariant(available.is_nullable === 'NO', 'InventoryAvailability.available must be NOT NULL.');
  invariant(available.is_generated === 'ALWAYS', 'InventoryAvailability.available must be generated ALWAYS.');
  invariant(
    String(available.generation_expression).replaceAll('"', '').replace(/\s+/g, '').includes('onhand-reserved'),
    'InventoryAvailability.available generation expression drifted.',
  );
  const projectEligible = byKey.get('Project.materialReservationEligible');
  invariant(projectEligible.is_nullable === 'NO', 'Project.materialReservationEligible must be NOT NULL.');
  invariant(projectEligible.is_generated === 'ALWAYS', 'Project.materialReservationEligible must be generated ALWAYS.');
  const eligibleExpression = String(projectEligible.generation_expression).replaceAll('"', '').replace(/\s+/g, '').toLowerCase();
  invariant(
    eligibleExpression.includes('status')
      && eligibleExpression.includes('completed')
      && eligibleExpression.includes('archived'),
    'Project.materialReservationEligible generation expression drifted.',
  );
}

async function assertConstraints(client, schema) {
  const result = await client.query(
    `SELECT conname, contype, condeferrable, condeferred,
            pg_get_constraintdef(oid, true) AS definition
       FROM pg_constraint
      WHERE connamespace = $1::regnamespace
        AND conname = ANY($2::text[])`,
    [schema, [
      'InventoryAvailability_pkey',
      'InventoryAvailability_quantities_check',
      'InventoryAvailability_balance_fkey',
      'TaskMaterialReservationBalance_pkey',
      'TaskMaterialReservationEntry_availability_fkey',
      'TaskMaterialReservationEntry_reverses_fkey',
      'TaskMaterialReservationTransaction_predecessor_fkey',
      'TaskMaterialActiveReservation_pkey',
      'TaskMaterialActiveReservation_project_snapshot_check',
      'TaskMaterialActiveReservation_project_fkey',
      'TaskMaterialActiveReservation_transaction_fkey',
    ]],
  );
  invariant(result.rows.length === 11, 'Reservation constraints are incomplete.');
  const balanceFk = result.rows.find((row) => row.conname === 'InventoryAvailability_balance_fkey');
  invariant(balanceFk?.condeferrable && balanceFk?.condeferred, 'Availability balance FK must be initially deferred.');
  const quantityCheck = result.rows.find((row) => row.conname === 'InventoryAvailability_quantities_check');
  invariant(
    String(quantityCheck?.definition).includes('reserved')
      && String(quantityCheck?.definition).includes('onHand'),
    'Availability quantity check drifted.',
  );
  const activeProjectFk = result.rows.find(
    (row) => row.conname === 'TaskMaterialActiveReservation_project_fkey',
  );
  invariant(
    activeProjectFk?.contype === 'f'
      && String(activeProjectFk.definition).includes('materialReservationEligible')
      && String(activeProjectFk.definition).includes('ON UPDATE RESTRICT')
      && String(activeProjectFk.definition).includes('ON DELETE RESTRICT'),
    'Active reservation must structurally fence project closure.',
  );
  const activeSnapshot = result.rows.find(
    (row) => row.conname === 'TaskMaterialActiveReservation_project_snapshot_check',
  );
  invariant(
    activeSnapshot?.contype === 'c'
      && String(activeSnapshot.definition).includes('projectReservationEligibleSnapshot'),
    'Active reservation project snapshot check drifted.',
  );
}

async function assertFunctions(client, schema) {
  const result = await client.query(
    `SELECT p.proname,
            pg_get_function_identity_arguments(p.oid) AS arguments,
            pg_get_function_result(p.oid) AS result,
            pg_get_functiondef(p.oid) AS definition
       FROM pg_proc AS p
      WHERE p.pronamespace = $1::regnamespace
        AND p.proname = ANY($2::text[])`,
    [schema, [
      'obrasaas_task_material_reserve',
      'obrasaas_task_material_release',
      'obrasaas_task_material_reservation_result',
      'obrasaas_task_material_reservation_entry_insert_guard',
      'obrasaas_task_material_reservation_transaction_insert_guard',
      'obrasaas_inventory_ledger_reserved_floor_guard',
      'obrasaas_inventory_availability_project_on_hand',
      'obrasaas_task_material_requirement_reservation_fence',
      'obrasaas_project_reservation_close_guard',
      'obrasaas_task_material_active_reservation_guard',
      'obrasaas_task_material_active_reservation_project',
      'obrasaas_task_material_reservation_bundle_guard',
      'obrasaas_inventory_availability_guard',
      'obrasaas_task_material_reservation_balance_guard',
      'obrasaas_task_material_reservation_line_initialize',
      'obrasaas_task_material_reservation_append_only',
      'obrasaas_task_material_reservation_no_truncate',
    ]],
  );
  invariant(result.rows.length === 17, 'Reservation functions are incomplete.');
  const reserve = result.rows.find((row) => row.proname === 'obrasaas_task_material_reserve');
  const release = result.rows.find((row) => row.proname === 'obrasaas_task_material_release');
  const transactionGuard = result.rows.find(
    (row) => row.proname === 'obrasaas_task_material_reservation_transaction_insert_guard',
  );
  const reservationResult = result.rows.find(
    (row) => row.proname === 'obrasaas_task_material_reservation_result',
  );
  invariant(String(reserve.arguments).endsWith('p_allocations jsonb'), 'Reserve signature drifted.');
  invariant(!String(release.arguments).includes('jsonb'), 'Release must derive its mirror without client allocations.');
  for (const field of [
    'transaction_id text',
    'requirement_revision_id text',
    'readiness_state text',
    'available boolean',
    'replayed boolean',
  ]) {
    invariant(String(reserve.result).includes(field), `Reserve result lost ${field}.`);
    invariant(String(release.result).includes(field), `Release result lost ${field}.`);
  }
  invariant(
    String(reserve.definition).includes('task-material-requirement:'),
    'Reserve must share the BOM publication lock.',
  );
  invariant(
    !String(reserve.definition).includes('task-material-reservation:'),
    'Reserve retained the incompatible task lock.',
  );
  invariant(
    String(reserve.definition).includes("jsonb_typeof(allocation.value->'quantity') <> 'string'"),
    'Reserve must require canonical decimal strings.',
  );
  invariant(
    String(reserve.definition).includes("'^(0|[1-9][0-9]{0,10})[.][0-9]{3}$'"),
    'Reserve must require canonical fixed-scale Decimal(14,3) values.',
  );
  invariant(
    String(reserve.definition).indexOf('hashtextextended(p_project_id, 0)')
      < String(reserve.definition).indexOf('task-material-requirement:'),
    'Reserve must acquire project lock before task lock.',
  );
  invariant(
    String(transactionGuard.definition).includes('TASK_MATERIAL_RESERVATION_TASK_NOT_RESERVABLE')
      && String(transactionGuard.definition).includes("task_status = 'DONE'")
      && String(transactionGuard.definition).includes('task_material_identity IS NOT TRUE'),
    'RESERVE must reject completed or noncanonical tasks while RELEASE stays possible.',
  );
  invariant(
    String(reservationResult.definition).includes('TaskMaterialActiveReservation')
      && String(reservationResult.definition).includes('InventoryAvailability')
      && String(reservationResult.definition).includes('InventoryLocation')
      && String(reservationResult.definition).includes('InventoryItem')
      && String(reservationResult.definition).includes("'REVIEW_REQUIRED'"),
    'Reservation result must fail closed when its operational projections drift.',
  );
  const closeGuard = result.rows.find((row) => row.proname === 'obrasaas_project_reservation_close_guard');
  invariant(
    String(closeGuard.definition).includes('TASK_MATERIAL_RESERVATION_PROJECT_READ_ONLY')
      && String(closeGuard.definition).includes('TaskMaterialActiveReservation'),
    'Project close guard must reject an active reservation projection.',
  );
  const activeProject = result.rows.find(
    (row) => row.proname === 'obrasaas_task_material_active_reservation_project',
  );
  invariant(
    String(activeProject.definition).includes('INSERT INTO "public"."TaskMaterialActiveReservation"')
      && String(activeProject.definition).includes('DELETE FROM "public"."TaskMaterialActiveReservation"'),
    'Active reservation projection must mirror reserve/release heads.',
  );
  const bundleGuard = result.rows.find(
    (row) => row.proname === 'obrasaas_task_material_reservation_bundle_guard',
  );
  invariant(
    String(bundleGuard.definition).includes('active reservation projection missing')
      && String(bundleGuard.definition).includes('active reservation projection remains'),
    'Deferred head-to-active projection guard drifted.',
  );
  const availabilityGuard = result.rows.find(
    (row) => row.proname === 'obrasaas_inventory_availability_guard',
  );
  const balanceGuard = result.rows.find(
    (row) => row.proname === 'obrasaas_task_material_reservation_balance_guard',
  );
  const noTruncate = result.rows.find(
    (row) => row.proname === 'obrasaas_task_material_reservation_no_truncate',
  );
  invariant(
    String(availabilityGuard.definition).includes('database-owned and rejects direct writes'),
    'Inventory availability lost direct-DML provenance enforcement.',
  );
  invariant(
    String(balanceGuard.definition).includes('TaskMaterialReservationBalance is database-owned'),
    'Reservation balance lost direct-DML provenance enforcement.',
  );
  invariant(
    String(noTruncate.definition).includes('cannot be truncated'),
    'Reservation projections lost TRUNCATE rejection.',
  );
}

async function assertTriggers(client, schema) {
  const expected = [
    'InventoryAvailability_projection_guard',
    'InventoryLedgerEntry_05_reserved_floor_guard',
    'InventoryLedgerEntry_zz_availability_project',
    'TaskMaterialRequirementRevision_reservation_fence',
    'TaskMaterialRequirementLine_reservation_balance_initialize',
    'Project_reservation_close_guard',
    'TaskMaterialReservationBalance_projection_guard',
    'TaskMaterialReservationBalance_no_truncate',
    'InventoryAvailability_no_truncate',
    'TaskMaterialReservationTransaction_insert_guard',
    'TaskMaterialReservationTransaction_active_project',
    'TaskMaterialReservationTransaction_append_only',
    'TaskMaterialReservationTransaction_no_truncate',
    'TaskMaterialReservationTransaction_bundle_guard',
    'TaskMaterialActiveReservation_projection_guard',
    'TaskMaterialActiveReservation_no_truncate',
    'TaskMaterialReservationEntry_insert_guard',
    'TaskMaterialReservationEntry_append_only',
    'TaskMaterialReservationEntry_no_truncate',
  ];
  const result = await client.query(
    `SELECT trigger_name, action_condition
       FROM information_schema.triggers
      WHERE trigger_schema = $1
        AND trigger_name = ANY($2::text[])`,
    [schema, expected],
  );
  invariant(new Set(result.rows.map((row) => row.trigger_name)).size === expected.length, 'Reservation triggers are incomplete.');
  const enabled = await client.query(
    `SELECT tgname, tgenabled
       FROM pg_trigger
      WHERE tgrelid IN (
        SELECT oid FROM pg_class WHERE relnamespace = $1::regnamespace
      ) AND tgname = ANY($2::text[])`,
    [schema, expected],
  );
  invariant(enabled.rows.every((row) => row.tgenabled === 'A'), 'Every reservation trigger must be ENABLE ALWAYS.');
}

async function expectSqlFailure(client, callback, { code, message }, label) {
  await client.query('SAVEPOINT task_material_reservation_verifier_case');
  await client.query('SET CONSTRAINTS ALL DEFERRED');
  let failure = null;
  try {
    await callback();
    await client.query('SET CONSTRAINTS ALL IMMEDIATE');
  } catch (error) {
    failure = error;
  }
  await client.query('ROLLBACK TO SAVEPOINT task_material_reservation_verifier_case');
  await client.query('RELEASE SAVEPOINT task_material_reservation_verifier_case');
  await client.query('SET CONSTRAINTS ALL DEFERRED');
  invariant(failure, `${label} unexpectedly succeeded.`);
  invariant(failure.code === code, `${label} failed with SQLSTATE ${failure.code || 'unknown'}.`);
  invariant(
    String(failure.message || '').includes(message),
    `${label} failed for an unexpected reason.`,
  );
}

async function flushDeferredConstraints(client) {
  await client.query('SET CONSTRAINTS ALL IMMEDIATE');
  await client.query('SET CONSTRAINTS ALL DEFERRED');
}

async function createBehaviorFixture(client) {
  const suffix = randomUUID();
  const catalogSuffix = suffix.slice(0, 8).toUpperCase();
  const fixture = {
    organizationId: `reservation_verify_org_${suffix}`,
    projectId: `reservation_verify_project_${suffix}`,
    actorId: `reservation_verify_actor_${suffix}`,
    outsiderOrganizationId: `reservation_verify_outsider_org_${suffix}`,
    outsiderActorId: `reservation_verify_outsider_${suffix}`,
    supplierId: `reservation_verify_supplier_${suffix}`,
    purchaseOrderId: `reservation_verify_order_${suffix}`,
    purchaseOrderLineId: `reservation_verify_order_line_${suffix}`,
    secondPurchaseOrderLineId: `reservation_verify_order_line_2_${suffix}`,
    goodsReceiptId: `reservation_verify_receipt_${suffix}`,
    goodsReceiptLineId: `reservation_verify_receipt_line_${suffix}`,
    secondGoodsReceiptLineId: `reservation_verify_receipt_line_2_${suffix}`,
    locationId: `reservation_verify_location_${suffix}`,
    inspectionId: `reservation_verify_inspection_${suffix}`,
    dispositionId: `reservation_verify_disposition_${suffix}`,
    secondDispositionId: `reservation_verify_disposition_2_${suffix}`,
    inventoryItemId: `reservation_verify_item_${suffix}`,
    bindingId: `reservation_verify_binding_${suffix}`,
    secondBindingId: `reservation_verify_binding_2_${suffix}`,
    firstTaskId: `reservation_verify_task_1_${suffix}`,
    secondTaskId: `reservation_verify_task_2_${suffix}`,
    firstTaskCode: `RSV1-${catalogSuffix}`,
    secondTaskCode: `RSV2-${catalogSuffix}`,
    firstTaskTitle: 'Reserva conductual uno',
    secondTaskTitle: 'Reserva conductual dos',
    firstRevisionId: `reservation_verify_revision_1_${suffix}`,
    secondRevisionId: `reservation_verify_revision_2_${suffix}`,
    firstLineId: `reservation_verify_line_1_${suffix}`,
    secondLineId: `reservation_verify_line_2_${suffix}`,
    itemCode: `RSV-${catalogSuffix}`,
    itemName: 'Material de reserva verificable',
    unit: 'bolsas',
  };

  await client.query(
    `INSERT INTO "Organization" ("id", "name", "slug", "updatedAt")
     VALUES ($1, 'Reservation verifier', $2, CURRENT_TIMESTAMP),
            ($3, 'Reservation outsider', $4, CURRENT_TIMESTAMP)`,
    [
      fixture.organizationId,
      `reservation-verifier-${suffix}`,
      fixture.outsiderOrganizationId,
      `reservation-outsider-${suffix}`,
    ],
  );
  await client.query(
    `INSERT INTO "Project" ("id", "organizationId", "name", "slug", "updatedAt")
     VALUES ($1, $2, 'Reservation project', $3, CURRENT_TIMESTAMP)`,
    [fixture.projectId, fixture.organizationId, `reservation-project-${suffix}`],
  );
  await client.query(
    `INSERT INTO "PlatformUser" (
       "id", "clerkUserId", "primaryEmail", "lastSeenAt", "updatedAt"
     ) VALUES
       ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
       ($4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      fixture.actorId,
      `clerk-reservation-${suffix}`,
      `reservation-${suffix}@example.test`,
      fixture.outsiderActorId,
      `clerk-reservation-outsider-${suffix}`,
      `reservation-outsider-${suffix}@example.test`,
    ],
  );
  await client.query(
    `INSERT INTO "TenantMembership" (
       "id", "organizationId", "userId", "clerkRole", "tenantRole", "status", "updatedAt"
     ) VALUES
       ($1, $2, $3, 'org:admin', 'ADMIN', 'ACTIVE', CURRENT_TIMESTAMP),
       ($4, $5, $6, 'org:admin', 'ADMIN', 'ACTIVE', CURRENT_TIMESTAMP)`,
    [
      `reservation_membership_${suffix}`,
      fixture.organizationId,
      fixture.actorId,
      `reservation_outsider_membership_${suffix}`,
      fixture.outsiderOrganizationId,
      fixture.outsiderActorId,
    ],
  );
  await client.query(
    `INSERT INTO "Supplier" ("id", "organizationId", "legalName", "updatedAt")
     VALUES ($1, $2, 'Reservation supplier', CURRENT_TIMESTAMP)`,
    [fixture.supplierId, fixture.organizationId],
  );
  await client.query(
    `INSERT INTO "PurchaseOrder" (
       "id", "organizationId", "projectId", "supplierId", "operationKey",
       "number", "currency", "status", "total", "updatedAt"
     ) VALUES ($1, $2, $3, $4, $5, $6, 'ARS', 'APPROVED', 10.00, CURRENT_TIMESTAMP)`,
    [
      fixture.purchaseOrderId,
      fixture.organizationId,
      fixture.projectId,
      fixture.supplierId,
      `reservation-order-${suffix}`,
      `RSV-${suffix}`,
    ],
  );
  await client.query(
    `INSERT INTO "PurchaseOrderLine" (
       "id", "purchaseOrderId", "projectId", "description", "unit", "quantity", "unitPrice"
     ) VALUES
       ($1, $2, $3, 'Material A', 'bolsas', 5.000, 1.00),
       ($4, $2, $3, 'Material B', 'bolsas', 5.000, 1.00)`,
    [
      fixture.purchaseOrderLineId,
      fixture.purchaseOrderId,
      fixture.projectId,
      fixture.secondPurchaseOrderLineId,
    ],
  );
  await client.query(
    `INSERT INTO "GoodsReceipt" (
       "id", "organizationId", "projectId", "purchaseOrderId", "operationKey",
       "status", "receivedById", "updatedAt"
     ) VALUES ($1, $2, $3, $4, $5, 'POSTED', $6, CURRENT_TIMESTAMP)`,
    [
      fixture.goodsReceiptId,
      fixture.organizationId,
      fixture.projectId,
      fixture.purchaseOrderId,
      `reservation-receipt-${suffix}`,
      fixture.actorId,
    ],
  );
  await client.query(
    `INSERT INTO "GoodsReceiptLine" (
       "id", "projectId", "purchaseOrderId", "goodsReceiptId", "purchaseOrderLineId", "quantity"
     ) VALUES
       ($1, $2, $3, $4, $5, 5.000),
       ($6, $2, $3, $4, $7, 5.000)`,
    [
      fixture.goodsReceiptLineId,
      fixture.projectId,
      fixture.purchaseOrderId,
      fixture.goodsReceiptId,
      fixture.purchaseOrderLineId,
      fixture.secondGoodsReceiptLineId,
      fixture.secondPurchaseOrderLineId,
    ],
  );
  await client.query(
    `INSERT INTO "InventoryLocation" (
       "id", "organizationId", "projectId", "code", "name", "updatedAt"
     ) VALUES ($1, $2, $3, 'OBRA', 'Acopio de obra', CURRENT_TIMESTAMP)`,
    [fixture.locationId, fixture.organizationId, fixture.projectId],
  );
  await client.query(
    `INSERT INTO "GoodsReceiptInspection" (
       "id", "organizationId", "projectId", "purchaseOrderId", "goodsReceiptId",
       "kind", "version", "operationKey", "requestFingerprint", "inspectedById",
       "locationId", "locationCodeSnapshot", "locationNameSnapshot"
     ) VALUES ($1, $2, $3, $4, $5, 'FINALIZATION', 1, $6, $7, $8, $9,
       'OBRA', 'Acopio de obra')`,
    [
      fixture.inspectionId,
      fixture.organizationId,
      fixture.projectId,
      fixture.purchaseOrderId,
      fixture.goodsReceiptId,
      `reservation-inspection-${suffix}`,
      '1'.repeat(64),
      fixture.actorId,
      fixture.locationId,
    ],
  );
  await client.query(
    `INSERT INTO "GoodsReceiptInspectionDisposition" (
       "id", "organizationId", "projectId", "purchaseOrderId", "purchaseOrderLineId",
       "goodsReceiptId", "goodsReceiptLineId", "inspectionId", "quality", "quantity"
     ) VALUES
       ($1, $2, $3, $4, $5, $6, $7, $8, 'ACCEPTED', 5.000),
       ($9, $2, $3, $4, $10, $6, $11, $8, 'ACCEPTED', 5.000)`,
    [
      fixture.dispositionId,
      fixture.organizationId,
      fixture.projectId,
      fixture.purchaseOrderId,
      fixture.purchaseOrderLineId,
      fixture.goodsReceiptId,
      fixture.goodsReceiptLineId,
      fixture.inspectionId,
      fixture.secondDispositionId,
      fixture.secondPurchaseOrderLineId,
      fixture.secondGoodsReceiptLineId,
    ],
  );
  await flushDeferredConstraints(client);
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
  await client.query(
    `INSERT INTO "PurchaseOrderLineInventoryBinding" (
       "id", "organizationId", "projectId", "purchaseOrderId", "purchaseOrderLineId",
       "inventoryItemId", "unitSnapshot", "operationKey", "requestFingerprint", "boundById"
     ) VALUES
       ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10),
       ($11, $2, $3, $4, $12, $6, $7, $13, $9, $10)`,
    [
      fixture.bindingId,
      fixture.organizationId,
      fixture.projectId,
      fixture.purchaseOrderId,
      fixture.purchaseOrderLineId,
      fixture.inventoryItemId,
      fixture.unit,
      `reservation-binding-${suffix}`,
      '2'.repeat(64),
      fixture.actorId,
      fixture.secondBindingId,
      fixture.secondPurchaseOrderLineId,
      `reservation-binding-2-${suffix}`,
    ],
  );
  await client.query(
    `INSERT INTO "Task" (
       "id", "projectId", "code", "title", "type", "status", "revision", "metadata", "updatedAt"
     ) VALUES
       ($1, $2, $3, $4, 'TASK', 'BACKLOG', 1,
        '{"source":"canonical-task-v1"}'::jsonb, CURRENT_TIMESTAMP),
       ($5, $2, $6, $7, 'TASK', 'BACKLOG', 1,
        '{"source":"canonical-task-v1"}'::jsonb, CURRENT_TIMESTAMP)`,
    [
      fixture.firstTaskId,
      fixture.projectId,
      fixture.firstTaskCode,
      fixture.firstTaskTitle,
      fixture.secondTaskId,
      fixture.secondTaskCode,
      fixture.secondTaskTitle,
    ],
  );
  await publishRequirementBundle(client, fixture, {
    taskId: fixture.firstTaskId,
    taskCode: fixture.firstTaskCode,
    taskTitle: fixture.firstTaskTitle,
    revisionId: fixture.firstRevisionId,
    lineId: fixture.firstLineId,
    quantity: '6.000',
    fingerprint: '3'.repeat(64),
  });
  await publishRequirementBundle(client, fixture, {
    taskId: fixture.secondTaskId,
    taskCode: fixture.secondTaskCode,
    taskTitle: fixture.secondTaskTitle,
    revisionId: fixture.secondRevisionId,
    lineId: fixture.secondLineId,
    quantity: '6.000',
    fingerprint: '4'.repeat(64),
  });
  return fixture;
}

async function publishRequirementBundle(client, fixture, values) {
  await client.query(
    `INSERT INTO "TaskMaterialRequirementRevision" (
       "id", "organizationId", "projectId", "taskId", "taskIdentitySnapshot",
       "kind", "version", "lineCount", "taskRevisionSnapshot", "taskCodeSnapshot",
       "taskTitleSnapshot", "taskStartsAtSnapshot", "taskEndsAtSnapshot", "predecessorId",
       "operationKey", "requestFingerprint", "reason", "authoredById"
     ) VALUES ($1, $2, $3, $4, TRUE, 'MATERIALS_REQUIRED', 1, 1, 1, $5, $6,
       NULL, NULL, NULL, $7, $8, 'Published by rollback verifier.', $9)`,
    [
      values.revisionId,
      fixture.organizationId,
      fixture.projectId,
      values.taskId,
      values.taskCode,
      values.taskTitle,
      `reservation-bom-${randomUUID()}`,
      values.fingerprint,
      fixture.actorId,
    ],
  );
  await client.query(
    `INSERT INTO "TaskMaterialRequirementLine" (
       "id", "organizationId", "projectId", "taskId", "revisionId", "inventoryItemId",
       "requiredQuantity", "itemCodeSnapshot", "itemNameSnapshot", "unitSnapshot", "notes"
     ) VALUES ($1, $2, $3, $4, $5, $6, $7::numeric, $8, $9, $10,
       'Exact verifier quantity.')`,
    [
      values.lineId,
      fixture.organizationId,
      fixture.projectId,
      values.taskId,
      values.revisionId,
      fixture.inventoryItemId,
      values.quantity,
      fixture.itemCode,
      fixture.itemName,
      fixture.unit,
    ],
  );
  await flushDeferredConstraints(client);
}

async function insertInventoryTransaction(client, fixture, overrides = {}) {
  const values = {
    id: `reservation_inventory_transaction_${randomUUID()}`,
    kind: 'RECEIPT_PUTAWAY',
    purchaseOrderId: fixture.purchaseOrderId,
    goodsReceiptId: fixture.goodsReceiptId,
    sourceInspectionId: fixture.inspectionId,
    reversesTransactionId: null,
    operationKey: `reservation-inventory-${randomUUID()}`,
    requestFingerprint: '5'.repeat(64),
    reason: null,
    ...overrides,
  };
  await client.query(
    `INSERT INTO "InventoryTransaction" (
       "id", "organizationId", "projectId", "kind", "purchaseOrderId",
       "goodsReceiptId", "sourceInspectionId", "reversesTransactionId",
       "operationKey", "requestFingerprint", "actorId", "reason"
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      values.id,
      fixture.organizationId,
      fixture.projectId,
      values.kind,
      values.purchaseOrderId,
      values.goodsReceiptId,
      values.sourceInspectionId,
      values.reversesTransactionId,
      values.operationKey,
      values.requestFingerprint,
      fixture.actorId,
      values.reason,
    ],
  );
  return values;
}

async function insertPutawayEntries(client, fixture, transactionId) {
  const entries = [
    { id: `reservation_inventory_entry_${randomUUID()}`, quantity: '5.000' },
    { id: `reservation_inventory_entry_${randomUUID()}`, quantity: '5.000' },
  ];
  await client.query(
    `INSERT INTO "InventoryLedgerEntry" (
       "id", "organizationId", "projectId", "transactionId", "inventoryItemId",
       "locationId", "purchaseLineBindingId", "inspectionDispositionId", "reversesEntryId",
       "quantityDelta", "itemCodeSnapshot", "itemNameSnapshot", "unitSnapshot",
       "locationCodeSnapshot", "locationNameSnapshot"
     ) VALUES
       ($1, $2, $3, $4, $5, $6, $7, $8, NULL, $9::numeric,
        $10, $11, $12, 'OBRA', 'Acopio de obra'),
       ($13, $2, $3, $4, $5, $6, $14, $15, NULL, $16::numeric,
        $10, $11, $12, 'OBRA', 'Acopio de obra')`,
    [
      entries[0].id,
      fixture.organizationId,
      fixture.projectId,
      transactionId,
      fixture.inventoryItemId,
      fixture.locationId,
      fixture.bindingId,
      fixture.dispositionId,
      entries[0].quantity,
      fixture.itemCode,
      fixture.itemName,
      fixture.unit,
      entries[1].id,
      fixture.secondBindingId,
      fixture.secondDispositionId,
      entries[1].quantity,
    ],
  );
  return entries;
}

async function insertReversalEntries(client, fixture, transactionId, originals) {
  await client.query(
    `INSERT INTO "InventoryLedgerEntry" (
       "id", "organizationId", "projectId", "transactionId", "inventoryItemId",
       "locationId", "purchaseLineBindingId", "inspectionDispositionId", "reversesEntryId",
       "quantityDelta", "itemCodeSnapshot", "itemNameSnapshot", "unitSnapshot",
       "locationCodeSnapshot", "locationNameSnapshot"
     ) VALUES
       ($1, $2, $3, $4, $5, $6, NULL, NULL, $7, '-5.000'::numeric,
        $8, $9, $10, 'OBRA', 'Acopio de obra'),
       ($11, $2, $3, $4, $5, $6, NULL, NULL, $12, '-5.000'::numeric,
        $8, $9, $10, 'OBRA', 'Acopio de obra')`,
    [
      `reservation_inventory_reversal_entry_${randomUUID()}`,
      fixture.organizationId,
      fixture.projectId,
      transactionId,
      fixture.inventoryItemId,
      fixture.locationId,
      originals[0].id,
      fixture.itemCode,
      fixture.itemName,
      fixture.unit,
      `reservation_inventory_reversal_entry_${randomUUID()}`,
      originals[1].id,
    ],
  );
}

function allocationJson(fixture, lineId, quantity) {
  return JSON.stringify([{
    requirementLineId: lineId,
    locationId: fixture.locationId,
    quantity,
  }]);
}

async function reserveMaterial(client, fixture, overrides = {}) {
  const values = {
    taskId: fixture.firstTaskId,
    revisionId: fixture.firstRevisionId,
    lineId: fixture.firstLineId,
    quantity: '6.000',
    expectedHeadId: null,
    actorId: fixture.actorId,
    operationKey: `reservation-reserve-${randomUUID()}`,
    requestFingerprint: '6'.repeat(64),
    reason: 'Reserve exact material bundle.',
    allocations: null,
    ...overrides,
  };
  const result = await client.query(RESERVE_SQL, [
    fixture.organizationId,
    fixture.projectId,
    values.taskId,
    values.revisionId,
    values.expectedHeadId,
    values.actorId,
    values.operationKey,
    values.requestFingerprint,
    values.reason,
    values.allocations ?? allocationJson(fixture, values.lineId, values.quantity),
  ]);
  invariant(result.rows.length === 1, 'Reserve command did not return exactly one result row.');
  return { row: result.rows[0], values };
}

async function releaseMaterial(client, fixture, reserveTransactionId, overrides = {}) {
  const values = {
    taskId: fixture.firstTaskId,
    revisionId: fixture.firstRevisionId,
    actorId: fixture.actorId,
    operationKey: `reservation-release-${randomUUID()}`,
    requestFingerprint: '7'.repeat(64),
    reason: 'Release exact material bundle.',
    ...overrides,
  };
  const result = await client.query(RELEASE_SQL, [
    fixture.organizationId,
    fixture.projectId,
    values.taskId,
    values.revisionId,
    reserveTransactionId,
    values.actorId,
    values.operationKey,
    values.requestFingerprint,
    values.reason,
  ]);
  invariant(result.rows.length === 1, 'Release command did not return exactly one result row.');
  return { row: result.rows[0], values };
}

function assertCommandResult(row, expected, label) {
  for (const [field, value] of Object.entries(expected)) {
    invariant(
      row?.[field] === value,
      `${label} returned ${field}=${String(row?.[field])}; expected ${String(value)}.`,
    );
  }
}

async function assertProjectionReconciliation(client, fixture, expected, label) {
  const result = await client.query(
    `WITH reservation_net AS (
       SELECT COALESCE(sum(entry."quantityDelta"), 0::numeric)::numeric(14,3)::text AS quantity
         FROM "TaskMaterialReservationEntry" AS entry
        WHERE entry."organizationId" = $1
          AND entry."projectId" = $2
          AND entry."taskId" = $3
     ), inventory_net AS (
       SELECT COALESCE(sum(entry."quantityDelta"), 0::numeric)::numeric(14,3)::text AS quantity
         FROM "InventoryLedgerEntry" AS entry
        WHERE entry."organizationId" = $1
          AND entry."projectId" = $2
          AND entry."inventoryItemId" = $4
          AND entry."locationId" = $5
     ), active_projection AS (
       SELECT count(*)::integer AS count
         FROM "TaskMaterialActiveReservation" AS active
        WHERE active."organizationId" = $1
          AND active."projectId" = $2
          AND active."taskId" = $3
     ), head AS (
       SELECT transaction."transactionType"::text AS transaction_type
         FROM "TaskMaterialReservationTransaction" AS transaction
        WHERE transaction."organizationId" = $1
          AND transaction."projectId" = $2
          AND transaction."taskId" = $3
        ORDER BY transaction."version" DESC
        LIMIT 1
     )
     SELECT availability."onHand"::text AS availability_on_hand,
            availability."reserved"::text AS availability_reserved,
            availability."available"::text AS availability_available,
            inventory_balance."onHand"::text AS inventory_balance_on_hand,
            line_balance."reservedQuantity"::text AS line_reserved,
            reservation_net.quantity AS reservation_net,
            inventory_net.quantity AS inventory_net,
            active_projection.count AS active_count,
            head.transaction_type
       FROM "InventoryAvailability" AS availability
       JOIN "InventoryBalance" AS inventory_balance
         ON inventory_balance."organizationId" = availability."organizationId"
        AND inventory_balance."projectId" = availability."projectId"
        AND inventory_balance."inventoryItemId" = availability."inventoryItemId"
        AND inventory_balance."locationId" = availability."locationId"
       JOIN "TaskMaterialReservationBalance" AS line_balance
         ON line_balance."organizationId" = availability."organizationId"
        AND line_balance."projectId" = availability."projectId"
        AND line_balance."taskId" = $3
        AND line_balance."requirementRevisionId" = $6
        AND line_balance."requirementLineId" = $7
        AND line_balance."inventoryItemId" = availability."inventoryItemId"
       CROSS JOIN reservation_net
       CROSS JOIN inventory_net
       CROSS JOIN active_projection
       LEFT JOIN head ON TRUE
      WHERE availability."organizationId" = $1
        AND availability."projectId" = $2
        AND availability."inventoryItemId" = $4
        AND availability."locationId" = $5`,
    [
      fixture.organizationId,
      fixture.projectId,
      fixture.firstTaskId,
      fixture.inventoryItemId,
      fixture.locationId,
      fixture.firstRevisionId,
      fixture.firstLineId,
    ],
  );
  invariant(result.rows.length === 1, `${label} lost one or more projection rows.`);
  for (const [field, value] of Object.entries(expected)) {
    invariant(
      result.rows[0]?.[field] === value,
      `${label} reconciliation drifted at ${field}.`,
    );
  }
}

async function assertDirectProjectionWriteGuards(client, fixture) {
  await expectSqlFailure(
    client,
    () => client.query(
      `UPDATE "InventoryAvailability"
          SET "updatedAt" = "updatedAt"
        WHERE "organizationId" = $1 AND "projectId" = $2
          AND "inventoryItemId" = $3 AND "locationId" = $4`,
      [fixture.organizationId, fixture.projectId, fixture.inventoryItemId, fixture.locationId],
    ),
    { code: '55000', message: 'database-owned and rejects direct writes' },
    'direct InventoryAvailability DML',
  );
  await expectSqlFailure(
    client,
    () => client.query(
      `UPDATE "TaskMaterialReservationBalance"
          SET "updatedAt" = "updatedAt"
        WHERE "organizationId" = $1 AND "projectId" = $2
          AND "taskId" = $3 AND "requirementRevisionId" = $4`,
      [fixture.organizationId, fixture.projectId, fixture.firstTaskId, fixture.firstRevisionId],
    ),
    { code: '55000', message: 'TaskMaterialReservationBalance is database-owned' },
    'direct TaskMaterialReservationBalance DML',
  );
  await expectSqlFailure(
    client,
    () => client.query(
      `UPDATE "TaskMaterialActiveReservation"
          SET "createdAt" = "createdAt"
        WHERE "organizationId" = $1 AND "projectId" = $2 AND "taskId" = $3`,
      [fixture.organizationId, fixture.projectId, fixture.firstTaskId],
    ),
    { code: '55000', message: 'database-owned projection' },
    'direct TaskMaterialActiveReservation DML',
  );
  for (const table of [
    'InventoryAvailability',
    'TaskMaterialReservationBalance',
    'TaskMaterialActiveReservation',
  ]) {
    await expectSqlFailure(
      client,
      () => client.query(`TRUNCATE ${quoteIdentifier(table)} CASCADE`),
      { code: '55000', message: `${table} cannot be truncated` },
      `${table} TRUNCATE projection guard`,
    );
  }
}

async function assertOperationalReadinessDriftFailsClosed(client, fixture, transactionId) {
  for (const mutation of [
    {
      label: 'inactive location readiness drift',
      sql: `UPDATE "InventoryLocation" SET "active" = FALSE, "updatedAt" = CURRENT_TIMESTAMP
             WHERE "organizationId" = $1 AND "projectId" = $2 AND "id" = $3`,
      params: [fixture.organizationId, fixture.projectId, fixture.locationId],
    },
    {
      label: 'inactive inventory item readiness drift',
      sql: `UPDATE "InventoryItem" SET "active" = FALSE, "updatedAt" = CURRENT_TIMESTAMP
             WHERE "organizationId" = $1 AND "projectId" = $2 AND "id" = $3`,
      params: [fixture.organizationId, fixture.projectId, fixture.inventoryItemId],
    },
  ]) {
    await client.query('SAVEPOINT task_material_reservation_readiness_drift');
    let mutationFailure = null;
    let resultRow = null;
    try {
      await client.query(mutation.sql, mutation.params);
      const result = await client.query(
        'SELECT * FROM obrasaas_task_material_reservation_result($1, false)',
        [transactionId],
      );
      resultRow = result.rows[0];
    } catch (error) {
      mutationFailure = error;
    }
    await client.query('ROLLBACK TO SAVEPOINT task_material_reservation_readiness_drift');
    await client.query('RELEASE SAVEPOINT task_material_reservation_readiness_drift');
    if (mutationFailure) {
      invariant(
        ['23514', '55000'].includes(mutationFailure.code)
          && /reservation|TASK_MATERIAL/i.test(String(mutationFailure.message || '')),
        `${mutation.label} failed for an unrelated reason.`,
      );
    } else {
      invariant(
        resultRow?.readiness_state === 'REVIEW_REQUIRED' && resultRow?.available === false,
        `${mutation.label} remained AVAILABLE instead of failing closed.`,
      );
    }
  }
}

async function assertRollbackOnlyBehavior(client) {
  const fixture = await createBehaviorFixture(client);
  const putaway = await insertInventoryTransaction(client, fixture);
  const putawayEntries = await insertPutawayEntries(client, fixture, putaway.id);
  await flushDeferredConstraints(client);

  await assertProjectionReconciliation(client, fixture, {
    availability_on_hand: '10.000',
    availability_reserved: '0.000',
    availability_available: '10.000',
    inventory_balance_on_hand: '10.000',
    line_reserved: '0.000',
    reservation_net: '0.000',
    inventory_net: '10.000',
    active_count: 0,
    transaction_type: null,
  }, 'governed stock baseline');

  await expectSqlFailure(
    client,
    () => reserveMaterial(client, fixture, {
      operationKey: `reservation-json-number-${randomUUID()}`,
      requestFingerprint: '8'.repeat(64),
      reason: 'Reject JSON numeric quantity.',
      allocations: JSON.stringify([{
        requirementLineId: fixture.firstLineId,
        locationId: fixture.locationId,
        quantity: 6,
      }]),
    }),
    { code: '23514', message: 'TASK_MATERIAL_RESERVATION_BUNDLE_INCOMPLETE allocation shape' },
    'numeric JSON Decimal allocation',
  );
  await expectSqlFailure(
    client,
    () => reserveMaterial(client, fixture, {
      actorId: fixture.outsiderActorId,
      operationKey: `reservation-cross-tenant-${randomUUID()}`,
      requestFingerprint: '9'.repeat(64),
      reason: 'Reject cross tenant actor.',
    }),
    { code: '42501', message: 'TASK_MATERIAL_RESERVATION_ACTOR_FORBIDDEN' },
    'cross-tenant actor denial',
  );
  await expectSqlFailure(
    client,
    async () => {
      await client.query(
        `UPDATE "InventoryLocation" SET "active" = FALSE, "updatedAt" = CURRENT_TIMESTAMP
          WHERE "organizationId" = $1 AND "projectId" = $2 AND "id" = $3`,
        [fixture.organizationId, fixture.projectId, fixture.locationId],
      );
      await reserveMaterial(client, fixture, {
        operationKey: `reservation-inactive-location-${randomUUID()}`,
        requestFingerprint: 'a'.repeat(64),
        reason: 'Reject inactive location.',
      });
    },
    { code: '23503', message: 'TASK_MATERIAL_RESERVATION_SCOPE_INVALID allocation scope' },
    'inactive location reserve',
  );

  const reserveOperationKey = `reservation-happy-reserve-${randomUUID()}`;
  const reserveFingerprint = 'b'.repeat(64);
  const reserveReason = 'Reserve canonical Decimal string.';
  const firstReserve = await reserveMaterial(client, fixture, {
    operationKey: reserveOperationKey,
    requestFingerprint: reserveFingerprint,
    reason: reserveReason,
  });
  await flushDeferredConstraints(client);
  assertCommandResult(firstReserve.row, {
    transaction_type: 'RESERVE',
    transaction_version: 1,
    predecessor_id: null,
    required_line_count: 1,
    covered_line_count: 1,
    allocation_count: 1,
    readiness_state: 'AVAILABLE',
    available: true,
    replayed: false,
  }, 'happy reserve');
  const exactEntry = await client.query(
    `SELECT "quantityDelta"::text AS quantity
       FROM "TaskMaterialReservationEntry"
      WHERE "transactionId" = $1`,
    [firstReserve.row.transaction_id],
  );
  invariant(
    exactEntry.rows.length === 1 && exactEntry.rows[0]?.quantity === '6.000',
    'Canonical Decimal string did not persist exactly as 6.000.',
  );
  await assertProjectionReconciliation(client, fixture, {
    availability_on_hand: '10.000',
    availability_reserved: '6.000',
    availability_available: '4.000',
    inventory_balance_on_hand: '10.000',
    line_reserved: '6.000',
    reservation_net: '6.000',
    inventory_net: '10.000',
    active_count: 1,
    transaction_type: 'RESERVE',
  }, 'reserve projection');

  await assertDirectProjectionWriteGuards(client, fixture);

  const reserveReplay = await reserveMaterial(client, fixture, {
    operationKey: reserveOperationKey,
    requestFingerprint: reserveFingerprint,
    reason: reserveReason,
  });
  assertCommandResult(reserveReplay.row, {
    transaction_id: firstReserve.row.transaction_id,
    replayed: true,
    readiness_state: 'AVAILABLE',
    available: true,
  }, 'reserve replay');
  await expectSqlFailure(
    client,
    () => reserveMaterial(client, fixture, {
      operationKey: reserveOperationKey,
      requestFingerprint: 'c'.repeat(64),
      reason: reserveReason,
    }),
    { code: '23514', message: 'IDEMPOTENCY_REPLAY_MUTATED reservation replay changed' },
    'mutated reserve replay',
  );

  await expectSqlFailure(
    client,
    () => reserveMaterial(client, fixture, {
      taskId: fixture.secondTaskId,
      revisionId: fixture.secondRevisionId,
      lineId: fixture.secondLineId,
      quantity: '6.000',
      operationKey: `reservation-overbook-${randomUUID()}`,
      requestFingerprint: 'd'.repeat(64),
      reason: 'Reject stock overbooking.',
    }),
    { code: '23514', message: 'TASK_MATERIAL_RESERVATION_INSUFFICIENT_STOCK' },
    'second task stock overbooking',
  );
  await client.query(
    `UPDATE "Task" SET "status" = 'DONE', "updatedAt" = CURRENT_TIMESTAMP
      WHERE "projectId" = $1 AND "id" = $2`,
    [fixture.projectId, fixture.secondTaskId],
  );
  await expectSqlFailure(
    client,
    () => reserveMaterial(client, fixture, {
      taskId: fixture.secondTaskId,
      revisionId: fixture.secondRevisionId,
      lineId: fixture.secondLineId,
      quantity: '6.000',
      operationKey: `reservation-done-task-${randomUUID()}`,
      requestFingerprint: 'e'.repeat(64),
      reason: 'Reject DONE task reserve.',
    }),
    { code: '55000', message: 'TASK_MATERIAL_RESERVATION_TASK_NOT_RESERVABLE' },
    'DONE task reserve',
  );
  await expectSqlFailure(
    client,
    () => client.query(
      `UPDATE "Project" SET "status" = 'COMPLETED', "updatedAt" = CURRENT_TIMESTAMP
        WHERE "organizationId" = $1 AND "id" = $2`,
      [fixture.organizationId, fixture.projectId],
    ),
    { code: '55000', message: 'TASK_MATERIAL_RESERVATION_PROJECT_READ_ONLY' },
    'active reservation project closure',
  );
  await expectSqlFailure(
    client,
    () => client.query(
      `INSERT INTO "TaskMaterialRequirementRevision" (
         "id", "organizationId", "projectId", "taskId", "taskIdentitySnapshot",
         "kind", "version", "lineCount", "taskRevisionSnapshot", "taskCodeSnapshot",
         "taskTitleSnapshot", "taskStartsAtSnapshot", "taskEndsAtSnapshot", "predecessorId",
         "operationKey", "requestFingerprint", "reason", "authoredById"
       ) VALUES ($1, $2, $3, $4, TRUE, 'MATERIALS_REQUIRED', 2, 1, 1, $5, $6,
         NULL, NULL, $7, $8, $9, 'Blocked active BOM publication.', $10)`,
      [
        `reservation_blocked_revision_${randomUUID()}`,
        fixture.organizationId,
        fixture.projectId,
        fixture.firstTaskId,
        fixture.firstTaskCode,
        fixture.firstTaskTitle,
        fixture.firstRevisionId,
        `reservation-blocked-bom-${randomUUID()}`,
        'f'.repeat(64),
        fixture.actorId,
      ],
    ),
    { code: '55000', message: 'TASK_MATERIAL_RESERVATION_RELEASE_INVALID' },
    'active reservation BOM publication',
  );
  await expectSqlFailure(
    client,
    async () => {
      const reversal = await insertInventoryTransaction(client, fixture, {
        kind: 'REVERSAL',
        purchaseOrderId: null,
        goodsReceiptId: null,
        sourceInspectionId: null,
        reversesTransactionId: putaway.id,
        operationKey: `reservation-blocked-stock-reversal-${randomUUID()}`,
        requestFingerprint: '0'.repeat(64),
        reason: 'Reject reversal below reserved stock.',
      });
      await insertReversalEntries(client, fixture, reversal.id, putawayEntries);
    },
    { code: '23514', message: 'TASK_MATERIAL_RESERVATION_INSUFFICIENT_STOCK' },
    'stock reversal below reserved floor',
  );
  await assertOperationalReadinessDriftFailsClosed(
    client,
    fixture,
    firstReserve.row.transaction_id,
  );

  await client.query(
    `UPDATE "Task" SET "status" = 'DONE', "updatedAt" = CURRENT_TIMESTAMP
      WHERE "projectId" = $1 AND "id" = $2`,
    [fixture.projectId, fixture.firstTaskId],
  );
  const releaseOperationKey = `reservation-happy-release-${randomUUID()}`;
  const releaseFingerprint = '1'.repeat(64);
  const releaseReason = 'Release after task DONE.';
  const firstRelease = await releaseMaterial(client, fixture, firstReserve.row.transaction_id, {
    operationKey: releaseOperationKey,
    requestFingerprint: releaseFingerprint,
    reason: releaseReason,
  });
  await flushDeferredConstraints(client);
  assertCommandResult(firstRelease.row, {
    transaction_type: 'RELEASE',
    transaction_version: 2,
    predecessor_id: firstReserve.row.transaction_id,
    required_line_count: 1,
    covered_line_count: 0,
    allocation_count: 1,
    readiness_state: 'DEFINED_UNRESERVED',
    available: false,
    replayed: false,
  }, 'release after task DONE');
  const releaseReplay = await releaseMaterial(client, fixture, firstReserve.row.transaction_id, {
    operationKey: releaseOperationKey,
    requestFingerprint: releaseFingerprint,
    reason: releaseReason,
  });
  assertCommandResult(releaseReplay.row, {
    transaction_id: firstRelease.row.transaction_id,
    replayed: true,
    readiness_state: 'DEFINED_UNRESERVED',
    available: false,
  }, 'release replay');
  await expectSqlFailure(
    client,
    () => releaseMaterial(client, fixture, firstReserve.row.transaction_id, {
      operationKey: releaseOperationKey,
      requestFingerprint: '2'.repeat(64),
      reason: releaseReason,
    }),
    { code: '23514', message: 'IDEMPOTENCY_REPLAY_MUTATED release replay changed' },
    'mutated release replay',
  );
  const historicalReserveReplay = await reserveMaterial(client, fixture, {
    operationKey: reserveOperationKey,
    requestFingerprint: reserveFingerprint,
    reason: reserveReason,
  });
  assertCommandResult(historicalReserveReplay.row, {
    transaction_id: firstReserve.row.transaction_id,
    replayed: true,
    readiness_state: 'DEFINED_UNRESERVED',
    available: false,
  }, 'historical reserve replay after release');
  await assertProjectionReconciliation(client, fixture, {
    availability_on_hand: '10.000',
    availability_reserved: '0.000',
    availability_available: '10.000',
    inventory_balance_on_hand: '10.000',
    line_reserved: '0.000',
    reservation_net: '0.000',
    inventory_net: '10.000',
    active_count: 0,
    transaction_type: 'RELEASE',
  }, 'release projection');

  const reversal = await insertInventoryTransaction(client, fixture, {
    kind: 'REVERSAL',
    purchaseOrderId: null,
    goodsReceiptId: null,
    sourceInspectionId: null,
    reversesTransactionId: putaway.id,
    operationKey: `reservation-stock-reversal-${randomUUID()}`,
    requestFingerprint: '3'.repeat(64),
    reason: 'Reverse stock after material release.',
  });
  await insertReversalEntries(client, fixture, reversal.id, putawayEntries);
  await flushDeferredConstraints(client);
  await assertProjectionReconciliation(client, fixture, {
    availability_on_hand: '0.000',
    availability_reserved: '0.000',
    availability_available: '0.000',
    inventory_balance_on_hand: '0.000',
    line_reserved: '0.000',
    reservation_net: '0.000',
    inventory_net: '0.000',
    active_count: 0,
    transaction_type: 'RELEASE',
  }, 'stock reversal after release');

  await client.query(
    `UPDATE "Project" SET "status" = 'COMPLETED', "updatedAt" = CURRENT_TIMESTAMP
      WHERE "organizationId" = $1 AND "id" = $2`,
    [fixture.organizationId, fixture.projectId],
  );
  const closed = await client.query(
    `SELECT "materialReservationEligible" AS eligible,
            (SELECT count(*)::integer FROM "TaskMaterialActiveReservation"
              WHERE "organizationId" = $1 AND "projectId" = $2) AS active_count
       FROM "Project"
      WHERE "organizationId" = $1 AND "id" = $2`,
    [fixture.organizationId, fixture.projectId],
  );
  invariant(
    closed.rows[0]?.eligible === false && closed.rows[0]?.active_count === 0,
    'Project closure after release did not preserve an empty active projection.',
  );
}

async function assertTwoConnectionSerialization(connectionString, schema) {
  const first = new pg.Client({
    connectionString,
    application_name: 'obrasaas-task-material-lock-verifier-a',
    statement_timeout: 15_000,
    query_timeout: 20_000,
  });
  const second = new pg.Client({
    connectionString,
    application_name: 'obrasaas-task-material-lock-verifier-b',
    statement_timeout: 15_000,
    query_timeout: 20_000,
  });
  let firstOpen = false;
  let secondOpen = false;
  try {
    await Promise.all([first.connect(), second.connect()]);
    await first.query('BEGIN');
    firstOpen = true;
    await second.query('BEGIN');
    secondOpen = true;
    await Promise.all([
      first.query(`SET LOCAL search_path TO ${quoteIdentifier(schema)}, pg_catalog`),
      second.query(`SET LOCAL search_path TO ${quoteIdentifier(schema)}, pg_catalog`),
    ]);
    const suffix = randomUUID();
    const projectId = `reservation_concurrency_project_${suffix}`;
    const keys = [
      projectId,
      `task-material-requirement:${projectId}:reservation_concurrency_task_${suffix}`,
      `inventory-availability:reservation_concurrency_org_${suffix}:${projectId}`
        + `:reservation_concurrency_item_${suffix}:reservation_concurrency_location_${suffix}`,
    ];
    for (const key of keys) {
      await first.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
      const blocked = await second.query(
        'SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS acquired',
        [key],
      );
      invariant(
        blocked.rows[0]?.acquired === false,
        `The second connection bypassed reservation serialization for ${key.split(':')[0]}.`,
      );
    }
    await first.query('ROLLBACK');
    firstOpen = false;
    for (const key of keys) {
      const acquired = await second.query(
        'SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS acquired',
        [key],
      );
      invariant(
        acquired.rows[0]?.acquired === true,
        'A reservation advisory lock survived transaction rollback.',
      );
    }
    await second.query('ROLLBACK');
    secondOpen = false;
  } finally {
    if (firstOpen) await first.query('ROLLBACK').catch(() => undefined);
    if (secondOpen) await second.query('ROLLBACK').catch(() => undefined);
    await Promise.all([
      first.end().catch(() => undefined),
      second.end().catch(() => undefined),
    ]);
  }
}

async function connectDisposableClient(connectionString, applicationName, schema) {
  const client = new pg.Client({
    connectionString,
    application_name: applicationName,
    statement_timeout: 25_000,
    query_timeout: 30_000,
  });
  await client.connect();
  await client.query('BEGIN');
  await client.query(`SET LOCAL search_path TO ${quoteIdentifier(schema)}, pg_catalog`);
  await client.query("SET LOCAL lock_timeout = '12s'");
  await client.query("SET LOCAL idle_in_transaction_session_timeout = '25s'");
  await client.query('SET CONSTRAINTS ALL DEFERRED');
  return client;
}

async function closeDisposableClient(client, transactionOpen = true) {
  if (transactionOpen) await client.query('ROLLBACK').catch(() => undefined);
  await client.end().catch(() => undefined);
}

async function assertPromiseBlocked(promise, label) {
  const state = await Promise.race([
    promise.then(() => 'resolved', () => 'rejected'),
    new Promise((resolve) => setTimeout(() => resolve('pending'), 150)),
  ]);
  invariant(state === 'pending', `${label} did not overlap the winning transaction.`);
}

async function expectPromiseFailure(promise, { code, message }, label) {
  let failure = null;
  try {
    await promise;
  } catch (error) {
    failure = error;
  }
  invariant(failure, `${label} unexpectedly succeeded.`);
  invariant(failure.code === code, `${label} failed with SQLSTATE ${failure.code || 'unknown'}.`);
  invariant(
    String(failure.message || '').includes(message),
    `${label} failed for an unexpected reason.`,
  );
}

async function runDisposableReserve(connectionString, schema, fixture, overrides) {
  const client = await connectDisposableClient(
    connectionString,
    'obrasaas-task-material-disposable-reserve',
    schema,
  );
  let transactionOpen = true;
  try {
    const result = await reserveMaterial(client, fixture, overrides);
    await flushDeferredConstraints(client);
    await client.query('COMMIT');
    transactionOpen = false;
    return result;
  } finally {
    await closeDisposableClient(client, transactionOpen);
  }
}

async function runDisposableRelease(
  connectionString,
  schema,
  fixture,
  reserveTransactionId,
  overrides,
) {
  const client = await connectDisposableClient(
    connectionString,
    'obrasaas-task-material-disposable-release',
    schema,
  );
  let transactionOpen = true;
  try {
    const result = await releaseMaterial(client, fixture, reserveTransactionId, overrides);
    await flushDeferredConstraints(client);
    await client.query('COMMIT');
    transactionOpen = false;
    return result;
  } finally {
    await closeDisposableClient(client, transactionOpen);
  }
}

const DISPOSABLE_CLEANUP_TABLES = [
  'TaskMaterialActiveReservation',
  'TaskMaterialReservationEntry',
  'TaskMaterialReservationTransaction',
  'TaskMaterialReservationBalance',
  'TaskMaterialRequirementLine',
  'TaskMaterialRequirementRevision',
  'InventoryAvailability',
  'InventoryLedgerEntry',
  'InventoryBalance',
  'InventoryTransaction',
  'PurchaseOrderLineInventoryBinding',
  'GoodsReceiptInspectionDisposition',
  'GoodsReceiptInspection',
  'GoodsReceiptLine',
  'GoodsReceipt',
  'PurchaseOrderLine',
  'PurchaseOrder',
  'InventoryItem',
  'InventoryLocation',
  'Task',
  'Supplier',
  'TenantMembership',
  'Project',
  'PlatformUser',
  'Organization',
];

async function restoreTriggerModes(client, schema, modes) {
  for (const mode of modes) {
    const relation = `${quoteIdentifier(schema)}.${quoteIdentifier(mode.table_name)}`;
    const trigger = quoteIdentifier(mode.trigger_name);
    if (mode.enabled === 'A') {
      await client.query(`ALTER TABLE ${relation} ENABLE ALWAYS TRIGGER ${trigger}`);
    } else if (mode.enabled === 'R') {
      await client.query(`ALTER TABLE ${relation} ENABLE REPLICA TRIGGER ${trigger}`);
    } else if (mode.enabled === 'D') {
      await client.query(`ALTER TABLE ${relation} DISABLE TRIGGER ${trigger}`);
    } else {
      await client.query(`ALTER TABLE ${relation} ENABLE TRIGGER ${trigger}`);
    }
  }
}

async function cleanupDisposableFixture(connectionString, schema, fixture) {
  const client = new pg.Client({
    connectionString,
    application_name: 'obrasaas-task-material-disposable-cleanup',
    statement_timeout: 45_000,
    query_timeout: 50_000,
  });
  await client.connect();
  let transactionOpen = false;
  try {
    await client.query('BEGIN');
    transactionOpen = true;
    await client.query(`SET LOCAL search_path TO ${quoteIdentifier(schema)}, pg_catalog`);
    const triggerModes = await client.query(
      `SELECT relation.relname AS table_name, trigger.tgname AS trigger_name,
              trigger.tgenabled AS enabled
         FROM pg_trigger AS trigger
         JOIN pg_class AS relation ON relation.oid = trigger.tgrelid
        WHERE relation.relnamespace = $1::regnamespace
          AND relation.relname = ANY($2::text[])
          AND NOT trigger.tgisinternal
        ORDER BY relation.relname, trigger.tgname`,
      [schema, DISPOSABLE_CLEANUP_TABLES],
    );
    for (const table of DISPOSABLE_CLEANUP_TABLES) {
      await client.query(
        `ALTER TABLE ${quoteIdentifier(schema)}.${quoteIdentifier(table)} DISABLE TRIGGER USER`,
      );
    }

    const scope = [fixture.organizationId, fixture.projectId];
    await client.query(
      `DELETE FROM "TaskMaterialActiveReservation"
        WHERE "organizationId" = $1 AND "projectId" = $2`,
      scope,
    );
    await client.query(
      `DELETE FROM "TaskMaterialReservationEntry"
        WHERE "organizationId" = $1 AND "projectId" = $2 AND "reversesEntryId" IS NOT NULL`,
      scope,
    );
    await client.query(
      `DELETE FROM "TaskMaterialReservationEntry"
        WHERE "organizationId" = $1 AND "projectId" = $2`,
      scope,
    );
    const reservationTransactions = await client.query(
      `SELECT "id" FROM "TaskMaterialReservationTransaction"
        WHERE "organizationId" = $1 AND "projectId" = $2
        ORDER BY "version" DESC`,
      scope,
    );
    for (const row of reservationTransactions.rows) {
      await client.query('DELETE FROM "TaskMaterialReservationTransaction" WHERE "id" = $1', [row.id]);
    }
    await client.query(
      `DELETE FROM "TaskMaterialReservationBalance"
        WHERE "organizationId" = $1 AND "projectId" = $2`,
      scope,
    );
    await client.query(
      `DELETE FROM "TaskMaterialRequirementLine"
        WHERE "organizationId" = $1 AND "projectId" = $2`,
      scope,
    );
    await client.query(
      `DELETE FROM "TaskMaterialRequirementRevision"
        WHERE "organizationId" = $1 AND "projectId" = $2`,
      scope,
    );
    await client.query(
      `DELETE FROM "InventoryAvailability"
        WHERE "organizationId" = $1 AND "projectId" = $2`,
      scope,
    );
    await client.query(
      `DELETE FROM "InventoryLedgerEntry"
        WHERE "organizationId" = $1 AND "projectId" = $2 AND "reversesEntryId" IS NOT NULL`,
      scope,
    );
    await client.query(
      `DELETE FROM "InventoryLedgerEntry"
        WHERE "organizationId" = $1 AND "projectId" = $2`,
      scope,
    );
    await client.query(
      `DELETE FROM "InventoryBalance"
        WHERE "organizationId" = $1 AND "projectId" = $2`,
      scope,
    );
    const inventoryTransactions = await client.query(
      `SELECT "id" FROM "InventoryTransaction"
        WHERE "organizationId" = $1 AND "projectId" = $2
        ORDER BY ("reversesTransactionId" IS NULL), "createdAt" DESC`,
      scope,
    );
    for (const row of inventoryTransactions.rows) {
      await client.query('DELETE FROM "InventoryTransaction" WHERE "id" = $1', [row.id]);
    }
    await client.query(
      `DELETE FROM "PurchaseOrderLineInventoryBinding"
        WHERE "organizationId" = $1 AND "projectId" = $2`,
      scope,
    );
    await client.query(
      `DELETE FROM "GoodsReceiptInspectionDisposition"
        WHERE "organizationId" = $1 AND "projectId" = $2`,
      scope,
    );
    await client.query(
      `DELETE FROM "GoodsReceiptInspection"
        WHERE "organizationId" = $1 AND "projectId" = $2`,
      scope,
    );
    await client.query('DELETE FROM "GoodsReceiptLine" WHERE "projectId" = $1', [fixture.projectId]);
    await client.query(
      `DELETE FROM "GoodsReceipt" WHERE "organizationId" = $1 AND "projectId" = $2`,
      scope,
    );
    await client.query('DELETE FROM "PurchaseOrderLine" WHERE "projectId" = $1', [fixture.projectId]);
    await client.query(
      `DELETE FROM "PurchaseOrder" WHERE "organizationId" = $1 AND "projectId" = $2`,
      scope,
    );
    await client.query(
      `DELETE FROM "InventoryItem" WHERE "organizationId" = $1 AND "projectId" = $2`,
      scope,
    );
    await client.query(
      `DELETE FROM "InventoryLocation" WHERE "organizationId" = $1 AND "projectId" = $2`,
      scope,
    );
    await client.query('DELETE FROM "Task" WHERE "projectId" = $1', [fixture.projectId]);
    await client.query('DELETE FROM "Supplier" WHERE "organizationId" = $1', [fixture.organizationId]);
    await client.query(
      'DELETE FROM "TenantMembership" WHERE "organizationId" = ANY($1::text[])',
      [[fixture.organizationId, fixture.outsiderOrganizationId]],
    );
    await client.query('DELETE FROM "Project" WHERE "id" = $1', [fixture.projectId]);
    await client.query(
      'DELETE FROM "PlatformUser" WHERE "id" = ANY($1::text[])',
      [[fixture.actorId, fixture.outsiderActorId]],
    );
    await client.query(
      'DELETE FROM "Organization" WHERE "id" = ANY($1::text[])',
      [[fixture.organizationId, fixture.outsiderOrganizationId]],
    );

    await restoreTriggerModes(client, schema, triggerModes.rows);
    await client.query('COMMIT');
    transactionOpen = false;
    const retained = await client.query(
      'SELECT count(*)::integer AS count FROM "Organization" WHERE "id" = ANY($1::text[])',
      [[fixture.organizationId, fixture.outsiderOrganizationId]],
    );
    invariant(retained.rows[0]?.count === 0, 'Disposable concurrency fixture cleanup retained rows.');
  } catch {
    if (transactionOpen) await client.query('ROLLBACK').catch(() => undefined);
    throw new Error('Disposable concurrency fixture cleanup failed closed.');
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function seedDisposableConcurrencyFixture(connectionString, schema) {
  const client = await connectDisposableClient(
    connectionString,
    'obrasaas-task-material-disposable-setup',
    schema,
  );
  let transactionOpen = true;
  try {
    const fixture = await createBehaviorFixture(client);
    const putaway = await insertInventoryTransaction(client, fixture, {
      operationKey: `reservation-disposable-putaway-${randomUUID()}`,
      requestFingerprint: '4'.repeat(64),
    });
    const putawayEntries = await insertPutawayEntries(client, fixture, putaway.id);
    await flushDeferredConstraints(client);
    await client.query('COMMIT');
    transactionOpen = false;
    return { ...fixture, putaway, putawayEntries };
  } finally {
    await closeDisposableClient(client, transactionOpen);
  }
}

async function assertReserveOverbookingRace(connectionString, schema, fixture) {
  const first = await connectDisposableClient(
    connectionString,
    'obrasaas-task-material-race-overbook-a',
    schema,
  );
  const second = await connectDisposableClient(
    connectionString,
    'obrasaas-task-material-race-overbook-b',
    schema,
  );
  let firstOpen = true;
  let secondOpen = true;
  let winningReserve;
  try {
    winningReserve = await reserveMaterial(first, fixture, {
      operationKey: `reservation-race-overbook-a-${randomUUID()}`,
      requestFingerprint: '5'.repeat(64),
      reason: 'Concurrent reserve six winner.',
    });
    await flushDeferredConstraints(first);
    const losingReserve = reserveMaterial(second, fixture, {
      taskId: fixture.secondTaskId,
      revisionId: fixture.secondRevisionId,
      lineId: fixture.secondLineId,
      quantity: '6.000',
      operationKey: `reservation-race-overbook-b-${randomUUID()}`,
      requestFingerprint: '6'.repeat(64),
      reason: 'Concurrent reserve six loser.',
    });
    await assertPromiseBlocked(losingReserve, 'reserve6 versus reserve6');
    await first.query('COMMIT');
    firstOpen = false;
    await expectPromiseFailure(
      losingReserve,
      { code: '23514', message: 'TASK_MATERIAL_RESERVATION_INSUFFICIENT_STOCK' },
      'reserve6 versus reserve6 loser',
    );
    await second.query('ROLLBACK');
    secondOpen = false;
  } finally {
    await closeDisposableClient(first, firstOpen);
    await closeDisposableClient(second, secondOpen);
  }
  const release = await runDisposableRelease(
    connectionString,
    schema,
    fixture,
    winningReserve.row.transaction_id,
    {
      operationKey: `reservation-race-overbook-release-${randomUUID()}`,
      requestFingerprint: '7'.repeat(64),
      reason: 'Reset after overbooking race.',
    },
  );
  return release.row.transaction_id;
}

async function setDisposableProjectCloseGuard(connectionString, schema, enabled) {
  const client = await connectDisposableClient(
    connectionString,
    'obrasaas-task-material-race-close-guard',
    schema,
  );
  let transactionOpen = true;
  try {
    const action = enabled ? 'ENABLE ALWAYS' : 'DISABLE';
    await client.query(
      `ALTER TABLE ${quoteIdentifier(schema)}."Project"
         ${action} TRIGGER "Project_reservation_close_guard"`,
    );
    await client.query('COMMIT');
    transactionOpen = false;
  } finally {
    await closeDisposableClient(client, transactionOpen);
  }
}

async function assertCloseVersusReserveRace(connectionString, schema, fixture) {
  await setDisposableProjectCloseGuard(connectionString, schema, false);
  let reserveTransactionId = null;
  let raceFailure = null;
  try {
    const reserveClient = await connectDisposableClient(
      connectionString,
      'obrasaas-task-material-race-close-reserve',
      schema,
    );
    const closeClient = await connectDisposableClient(
      connectionString,
      'obrasaas-task-material-race-close-project',
      schema,
    );
    let reserveOpen = true;
    let closeOpen = true;
    try {
      const reserve = await reserveMaterial(reserveClient, fixture, {
        taskId: fixture.secondTaskId,
        revisionId: fixture.secondRevisionId,
        lineId: fixture.secondLineId,
        quantity: '6.000',
        operationKey: `reservation-race-close-reserve-${randomUUID()}`,
        requestFingerprint: '8'.repeat(64),
        reason: 'Reserve while project close races.',
      });
      await flushDeferredConstraints(reserveClient);
      reserveTransactionId = reserve.row.transaction_id;
      const closeProject = closeClient.query(
        `UPDATE "Project" SET "status" = 'COMPLETED', "updatedAt" = CURRENT_TIMESTAMP
          WHERE "organizationId" = $1 AND "id" = $2`,
        [fixture.organizationId, fixture.projectId],
      );
      await assertPromiseBlocked(closeProject, 'close versus reserve structural FK');
      await reserveClient.query('COMMIT');
      reserveOpen = false;
      await expectPromiseFailure(
        closeProject,
        { code: '23503', message: 'TaskMaterialActiveReservation_project_fkey' },
        'close versus reserve structural FK loser',
      );
      await closeClient.query('ROLLBACK');
      closeOpen = false;
    } finally {
      await closeDisposableClient(reserveClient, reserveOpen);
      await closeDisposableClient(closeClient, closeOpen);
    }
  } catch (error) {
    raceFailure = error;
  } finally {
    await setDisposableProjectCloseGuard(connectionString, schema, true);
  }
  if (raceFailure) throw raceFailure;
  invariant(reserveTransactionId, 'Close-versus-reserve race lost its winning reservation.');
  await runDisposableRelease(
    connectionString,
    schema,
    fixture,
    reserveTransactionId,
    {
      taskId: fixture.secondTaskId,
      revisionId: fixture.secondRevisionId,
      operationKey: `reservation-race-close-release-${randomUUID()}`,
      requestFingerprint: '9'.repeat(64),
      reason: 'Reset after close versus reserve race.',
    },
  );
}

async function assertReserveVersusReversalRace(
  connectionString,
  schema,
  fixture,
  expectedReservationHeadId,
) {
  const reserveClient = await connectDisposableClient(
    connectionString,
    'obrasaas-task-material-race-stock-reserve',
    schema,
  );
  const reversalClient = await connectDisposableClient(
    connectionString,
    'obrasaas-task-material-race-stock-reversal',
    schema,
  );
  let reserveOpen = true;
  let reversalOpen = true;
  let reserve;
  try {
    reserve = await reserveMaterial(reserveClient, fixture, {
      expectedHeadId: expectedReservationHeadId,
      operationKey: `reservation-race-stock-reserve-${randomUUID()}`,
      requestFingerprint: 'a'.repeat(64),
      reason: 'Reserve six while reversal races.',
    });
    await flushDeferredConstraints(reserveClient);
    const reverseStock = (async () => {
      const reversal = await insertInventoryTransaction(reversalClient, fixture, {
        kind: 'REVERSAL',
        purchaseOrderId: null,
        goodsReceiptId: null,
        sourceInspectionId: null,
        reversesTransactionId: fixture.putaway.id,
        operationKey: `reservation-race-stock-reversal-${randomUUID()}`,
        requestFingerprint: 'b'.repeat(64),
        reason: 'Reverse first five while reserve races.',
      });
      await insertReversalEntries(
        reversalClient,
        fixture,
        reversal.id,
        fixture.putawayEntries,
      );
      await flushDeferredConstraints(reversalClient);
    })();
    await assertPromiseBlocked(reverseStock, 'reserve6 versus stock reversal minus5');
    await reserveClient.query('COMMIT');
    reserveOpen = false;
    await expectPromiseFailure(
      reverseStock,
      { code: '23514', message: 'TASK_MATERIAL_RESERVATION_INSUFFICIENT_STOCK' },
      'reserve6 versus stock reversal minus5 loser',
    );
    await reversalClient.query('ROLLBACK');
    reversalOpen = false;
  } finally {
    await closeDisposableClient(reserveClient, reserveOpen);
    await closeDisposableClient(reversalClient, reversalOpen);
  }
  return reserve.row.transaction_id;
}

async function assertReleaseVersusReversalRace(
  connectionString,
  schema,
  fixture,
  reserveTransactionId,
) {
  const releaseClient = await connectDisposableClient(
    connectionString,
    'obrasaas-task-material-race-release',
    schema,
  );
  const reversalClient = await connectDisposableClient(
    connectionString,
    'obrasaas-task-material-race-release-reversal',
    schema,
  );
  let releaseOpen = true;
  let reversalOpen = true;
  try {
    await releaseMaterial(releaseClient, fixture, reserveTransactionId, {
      operationKey: `reservation-race-release-${randomUUID()}`,
      requestFingerprint: 'c'.repeat(64),
      reason: 'Release while stock reversal races.',
    });
    await flushDeferredConstraints(releaseClient);
    const reverseStock = (async () => {
      const reversal = await insertInventoryTransaction(reversalClient, fixture, {
        kind: 'REVERSAL',
        purchaseOrderId: null,
        goodsReceiptId: null,
        sourceInspectionId: null,
        reversesTransactionId: fixture.putaway.id,
        operationKey: `reservation-race-release-reversal-${randomUUID()}`,
        requestFingerprint: 'd'.repeat(64),
        reason: 'Reverse stock after concurrent release.',
      });
      await insertReversalEntries(
        reversalClient,
        fixture,
        reversal.id,
        fixture.putawayEntries,
      );
      await flushDeferredConstraints(reversalClient);
    })();
    await assertPromiseBlocked(reverseStock, 'release versus stock reversal');
    await releaseClient.query('COMMIT');
    releaseOpen = false;
    await reverseStock;
    await reversalClient.query('COMMIT');
    reversalOpen = false;
  } finally {
    await closeDisposableClient(releaseClient, releaseOpen);
    await closeDisposableClient(reversalClient, reversalOpen);
  }
  const probe = new pg.Client({
    connectionString,
    application_name: 'obrasaas-task-material-race-reconciliation',
  });
  await probe.connect();
  try {
    const result = await probe.query(
      `SELECT availability."onHand"::text AS on_hand,
              availability."reserved"::text AS reserved,
              availability."available"::text AS available,
              balance."onHand"::text AS balance_on_hand
         FROM "InventoryAvailability" AS availability
         JOIN "InventoryBalance" AS balance
           ON balance."organizationId" = availability."organizationId"
          AND balance."projectId" = availability."projectId"
          AND balance."inventoryItemId" = availability."inventoryItemId"
          AND balance."locationId" = availability."locationId"
        WHERE availability."organizationId" = $1
          AND availability."projectId" = $2
          AND availability."inventoryItemId" = $3
          AND availability."locationId" = $4`,
      [fixture.organizationId, fixture.projectId, fixture.inventoryItemId, fixture.locationId],
    );
    invariant(
      result.rows[0]?.on_hand === '0.000'
        && result.rows[0]?.reserved === '0.000'
        && result.rows[0]?.available === '0.000'
        && result.rows[0]?.balance_on_hand === '0.000',
      'Release-versus-reversal race did not reconcile exact zero stock.',
    );
  } finally {
    await probe.end().catch(() => undefined);
  }
}

async function assertDisposableConcurrencyRaces(connectionString, schema) {
  let fixture = null;
  try {
    fixture = await seedDisposableConcurrencyFixture(connectionString, schema);
    const taskOneReleaseHead = await assertReserveOverbookingRace(
      connectionString,
      schema,
      fixture,
    );
    await assertCloseVersusReserveRace(connectionString, schema, fixture);
    const activeReserveId = await assertReserveVersusReversalRace(
      connectionString,
      schema,
      fixture,
      taskOneReleaseHead,
    );
    await assertReleaseVersusReversalRace(
      connectionString,
      schema,
      fixture,
      activeReserveId,
    );
  } finally {
    if (fixture) await cleanupDisposableFixture(connectionString, schema, fixture);
  }
}

async function main() {
  if (helpRequested) {
    console.log(
      `${CONNECTION_ENV} and ${SCHEMA_ENV} verify ${MIGRATION}; DATABASE_URL is intentionally ignored. `
        + `${DISPOSABLE_CONCURRENCY_ENV}=1 additionally runs committed races only on local obrasaas_ci/public.`,
    );
    return;
  }
  const {
    connectionString,
    disposableConcurrency,
    local,
    schema,
  } = connectionConfiguration();
  const client = new pg.Client({
    connectionString,
    application_name: 'obrasaas-task-material-reservations-verifier',
    statement_timeout: 55_000,
    query_timeout: 60_000,
  });
  let connected = false;
  let transactionOpen = false;
  try {
    try {
      await client.connect();
      connected = true;
    } catch {
      throw new Error('Unable to connect to the dedicated task material reservation verification database.');
    }
    await client.query('BEGIN');
    transactionOpen = true;
    const schemaExists = await client.query(
      'SELECT to_regnamespace($1) IS NOT NULL AS exists',
      [schema],
    );
    invariant(schemaExists.rows[0]?.exists, `Configured PostgreSQL schema ${schema} does not exist.`);
    await client.query(`SET LOCAL search_path TO ${quoteIdentifier(schema)}, pg_catalog`);
    const activeSchema = await client.query('SELECT current_schema() AS name');
    invariant(
      activeSchema.rows[0]?.name === schema,
      'PostgreSQL did not activate the configured task material reservation schema.',
    );
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '55s'");
    await client.query('SET CONSTRAINTS ALL DEFERRED');
    await assertMigration(client, schema, local);
    await assertColumns(client, schema);
    await assertConstraints(client, schema);
    await assertFunctions(client, schema);
    await assertTriggers(client, schema);
    await assertRollbackOnlyBehavior(client);
    await client.query('ROLLBACK');
    transactionOpen = false;
    await assertTwoConnectionSerialization(connectionString, schema);
    if (disposableConcurrency) {
      await assertDisposableConcurrencyRaces(connectionString, schema);
    }
    console.log(
      disposableConcurrency
        ? 'Verified S12.2C rollback-only behavior plus disposable PostgreSQL races: reserve6/overbooking, reserve/reversal, close/reserve structural FK, release/reversal and exact cleanup.'
        : 'Verified S12.2C rollback-only behavior: exact Decimal bundles, tenant denial, replay safety, projection reconciliation, fail-closed readiness, lifecycle fences, stock floor and advisory lock semantics. Disposable races were not requested.',
    );
  } finally {
    if (transactionOpen) await client.query('ROLLBACK').catch(() => undefined);
    if (connected) await client.end();
  }
}

await main();
