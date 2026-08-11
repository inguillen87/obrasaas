import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [schema, migration] = await Promise.all([
  readFile(new URL('../prisma/schema.prisma', import.meta.url), 'utf8'),
  readFile(
    new URL(
      '../prisma/migrations/20260810150000_task_material_reservations/migration.sql',
      import.meta.url,
    ),
    'utf8',
  ),
]);

function modelBlock(name) {
  const match = schema.match(new RegExp(`model ${name} \\{[\\s\\S]*?\\n\\}`));
  assert.ok(match, `Missing Prisma model ${name}.`);
  return match[0];
}

function functionArguments(name) {
  const match = migration.match(
    new RegExp(`CREATE FUNCTION "${name}"\\(([\\s\\S]*?)\\)\\nRETURNS TABLE`),
  );
  assert.ok(match, `Missing SQL function ${name}.`);
  return match[1];
}

function functionResultFields(name) {
  const match = migration.match(
    new RegExp(
      `CREATE FUNCTION "${name}"\\([\\s\\S]*?\\)\\nRETURNS TABLE \\(([\\s\\S]*?)\\n\\)\\nLANGUAGE`,
    ),
  );
  assert.ok(match, `Missing SQL result contract for ${name}.`);
  return match[1].split(',').map((field) => field.trim().replace(/\s+/g, ' '));
}

test('Prisma exposes exact reservation ledger, line balances and availability projection', () => {
  assert.match(
    schema,
    /enum TaskMaterialReservationTransactionType \{[\s\S]*RESERVE[\s\S]*RELEASE/,
  );

  const transaction = modelBlock('TaskMaterialReservationTransaction');
  assert.match(transaction, /transactionType\s+TaskMaterialReservationTransactionType/);
  assert.match(transaction, /requirementRevisionId\s+String/);
  assert.match(transaction, /predecessorId\s+String\?/);
  assert.match(transaction, /@@unique\(\[projectId, taskId, version\]/);
  assert.match(transaction, /@@unique\(\[projectId, operationKey\]/);

  const entry = modelBlock('TaskMaterialReservationEntry');
  assert.match(entry, /quantityDelta\s+Decimal\s+@db\.Decimal\(14, 3\)/);
  assert.match(entry, /reversesEntryId\s+String\?/);
  assert.match(entry, /inventoryAvailability\s+InventoryAvailability/);
  assert.match(entry, /lineBalance\s+TaskMaterialReservationBalance/);

  const lineBalance = modelBlock('TaskMaterialReservationBalance');
  assert.match(lineBalance, /requiredQuantity\s+Decimal\s+@db\.Decimal\(14, 3\)/);
  assert.match(lineBalance, /reservedQuantity\s+Decimal\s+@default\(0\)/);
  assert.match(lineBalance, /revision\s+Int\s+@default\(0\)/);

  const active = modelBlock('TaskMaterialActiveReservation');
  assert.match(active, /reservationTransactionId\s+String/);
  assert.match(active, /requirementRevisionId\s+String/);
  assert.match(active, /projectReservationEligibleSnapshot\s+Boolean\s+@default\(true\)/);
  assert.match(
    active,
    /references: \[organizationId, id, materialReservationEligible\][\s\S]*onDelete: Restrict, onUpdate: Restrict/,
  );
  assert.match(active, /@@id\(\[organizationId, projectId, taskId\]/);

  const project = modelBlock('Project');
  assert.match(project, /materialReservationEligible\s+Boolean\s+@default\(dbgenerated\(\)\)/);
  assert.match(
    project,
    /@@unique\(\[organizationId, id, materialReservationEligible\], map: "Project_material_reservation_identity_key"\)/,
  );

  const availability = modelBlock('InventoryAvailability');
  assert.match(availability, /onHand\s+Decimal\s+@default\(0\)/);
  assert.match(availability, /reserved\s+Decimal\s+@default\(0\)/);
  assert.match(availability, /available\s+Decimal\s+@default\(dbgenerated\(\)\)/);
  assert.match(availability, /onHandRevision\s+Int\s+@default\(0\)/);
  assert.match(availability, /reservationRevision\s+Int\s+@default\(0\)/);
  assert.match(availability, /inventoryBalance\s+InventoryBalance/);
});

test('migration owns deterministic projections and exact tenant-scoped chains', () => {
  for (const table of [
    'InventoryAvailability',
    'TaskMaterialReservationTransaction',
    'TaskMaterialActiveReservation',
    'TaskMaterialReservationBalance',
    'TaskMaterialReservationEntry',
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE "${table}"`));
  }
  assert.match(
    migration,
    /"available" DECIMAL\(14,3\)[\s\S]*GENERATED ALWAYS AS \("onHand" - "reserved"\) STORED NOT NULL/,
  );
  assert.match(
    migration,
    /ADD COLUMN "materialReservationEligible" BOOLEAN[\s\S]*GENERATED ALWAYS AS \([\s\S]*"status" NOT IN \('COMPLETED', 'ARCHIVED'\)[\s\S]*STORED NOT NULL/,
  );
  assert.match(
    migration,
    /"reserved" >= 0::numeric[\s\S]*"reserved" <= "onHand"/,
  );
  assert.match(
    migration,
    /InventoryAvailability_balance_fkey[\s\S]*DEFERRABLE INITIALLY DEFERRED/,
  );
  assert.match(
    migration,
    /INSERT INTO "InventoryAvailability"[\s\S]*FROM "InventoryBalance" AS balance/,
  );
  assert.match(
    migration,
    /INSERT INTO "TaskMaterialReservationBalance"[\s\S]*FROM "TaskMaterialRequirementLine" AS line/,
  );
  assert.match(
    migration,
    /TaskMaterialReservationTransaction_task_version_key/,
  );
  assert.match(migration, /TaskMaterialReservationTransaction_predecessor_key/);
  assert.match(migration, /TaskMaterialReservationTransaction_operation_key/);
  assert.match(
    migration,
    /TaskMaterialActiveReservation_project_fkey[\s\S]*"materialReservationEligible"[\s\S]*ON DELETE RESTRICT ON UPDATE RESTRICT/,
  );
  assert.match(
    migration,
    /TaskMaterialActiveReservation_project_snapshot_check[\s\S]*"projectReservationEligibleSnapshot" IS TRUE/,
  );
});

test('row projections, append-only history and publication fence are database-governed', () => {
  assert.match(
    migration,
    /InventoryAvailability is database-owned and rejects direct writes/,
  );
  assert.match(migration, /TaskMaterialReservationBalance is database-owned/);
  assert.match(migration, /TaskMaterialActiveReservation is a database-owned projection/);
  assert.match(
    migration,
    /UPDATE "public"\."TaskMaterialReservationBalance" AS balance[\s\S]*UPDATE "public"\."InventoryAvailability" AS availability/,
  );
  assert.doesNotMatch(
    migration.match(/CREATE FUNCTION "obrasaas_task_material_reservation_entry_insert_guard"\(\)[\s\S]*?\n\$\$;/)?.[0] ?? '',
    /sum\(/i,
  );
  assert.match(
    migration,
    /TASK_MATERIAL_RESERVATION_INSUFFICIENT_STOCK InventoryLedgerEntry_reserved_floor_conflict/,
  );
  assert.match(
    migration,
    /TaskMaterialRequirementRevision_reservation_fence[\s\S]*ENABLE ALWAYS TRIGGER "TaskMaterialRequirementRevision_reservation_fence"/,
  );
  assert.match(
    migration,
    /CREATE FUNCTION "obrasaas_project_reservation_close_guard"\(\)[\s\S]*NEW\."status" IN \('COMPLETED', 'ARCHIVED'\)[\s\S]*hashtextextended\(NEW\."id", 0\)[\s\S]*TaskMaterialActiveReservation[\s\S]*TASK_MATERIAL_RESERVATION_PROJECT_READ_ONLY/,
  );
  assert.match(migration, /CREATE TRIGGER "Project_reservation_close_guard"/);
  assert.match(migration, /ENABLE ALWAYS TRIGGER "Project_reservation_close_guard"/);
  assert.match(
    migration,
    /obrasaas_task_material_requirement_reservation_fence[\s\S]*TaskMaterialActiveReservation[\s\S]*release active bundle before publishing a new BOM/,
  );
  assert.match(
    migration,
    /obrasaas_task_material_active_reservation_project[\s\S]*INSERT INTO "public"\."TaskMaterialActiveReservation"[\s\S]*DELETE FROM "public"\."TaskMaterialActiveReservation"/,
  );
  assert.match(
    migration,
    /transaction_is_head[\s\S]*active reservation projection missing[\s\S]*active reservation projection remains/,
  );
  assert.match(
    migration,
    /NEW\."transactionType" = 'RESERVE'[\s\S]*task_status = 'DONE'[\s\S]*TASK_MATERIAL_RESERVATION_TASK_NOT_RESERVABLE/,
  );
  assert.match(
    migration,
    /positive_allocations AS[\s\S]*projection_health AS[\s\S]*item\."active" IS TRUE[\s\S]*location\."active" IS TRUE/,
  );
  assert.match(
    migration,
    /availability\."onHand" IS NOT DISTINCT FROM inventory_balance\."onHand"[\s\S]*availability\."onHandRevision" IS NOT DISTINCT FROM inventory_balance\."revision"/,
  );
  assert.match(
    migration,
    /active_state\.matches_transaction[\s\S]*THEN 'AVAILABLE'[\s\S]*ELSE 'REVIEW_REQUIRED'/,
  );
  for (const trigger of [
    'TaskMaterialReservationTransaction_active_project',
    'TaskMaterialReservationTransaction_append_only',
    'TaskMaterialReservationTransaction_no_truncate',
    'TaskMaterialReservationEntry_append_only',
    'TaskMaterialReservationEntry_no_truncate',
    'TaskMaterialReservationTransaction_bundle_guard',
    'TaskMaterialActiveReservation_projection_guard',
    'TaskMaterialActiveReservation_no_truncate',
  ]) {
    assert.match(migration, new RegExp(`CREATE (?:CONSTRAINT )?TRIGGER "${trigger}"`));
    assert.match(migration, new RegExp(`ENABLE ALWAYS TRIGGER "${trigger}"`));
  }
  assert.match(
    migration,
    /TaskMaterialReservationTransaction_bundle_guard[\s\S]*DEFERRABLE INITIALLY DEFERRED/,
  );
});

test('reserve and release expose the exact agreed SQL contract and stable error tokens', () => {
  const commonArguments = [
    'p_organization_id TEXT',
    'p_project_id TEXT',
    'p_task_id TEXT',
    'p_requirement_revision_id TEXT',
    'p_expected_reservation_head_id TEXT',
    'p_actor_id TEXT',
    'p_operation_key TEXT',
    'p_request_fingerprint TEXT',
    'p_reason TEXT',
  ];
  const reserveArguments = functionArguments('obrasaas_task_material_reserve');
  const releaseArguments = functionArguments('obrasaas_task_material_release');
  assert.deepEqual(
    reserveArguments.split(',').map((argument) => argument.trim().replace(/\s+/g, ' ')),
    [...commonArguments, 'p_allocations JSONB'],
  );
  assert.deepEqual(
    releaseArguments.split(',').map((argument) => argument.trim().replace(/\s+/g, ' ')),
    commonArguments,
  );
  const exactResult = [
    'transaction_id TEXT',
    'organization_id TEXT',
    'project_id TEXT',
    'task_id TEXT',
    'requirement_revision_id TEXT',
    'transaction_type TEXT',
    'transaction_version INTEGER',
    'predecessor_id TEXT',
    'actor_id TEXT',
    'operation_key TEXT',
    'request_fingerprint TEXT',
    'reason TEXT',
    'occurred_at TIMESTAMPTZ',
    'required_line_count INTEGER',
    'covered_line_count INTEGER',
    'allocation_count INTEGER',
    'readiness_state TEXT',
    'available BOOLEAN',
    'replayed BOOLEAN',
  ];
  assert.deepEqual(functionResultFields('obrasaas_task_material_reserve'), exactResult);
  assert.deepEqual(functionResultFields('obrasaas_task_material_release'), exactResult);
  for (const token of [
    'IDEMPOTENCY_REPLAY_MUTATED',
    'TASK_MATERIAL_REQUIREMENT_HEAD_STALE',
    'TASK_MATERIAL_RESERVATION_HEAD_STALE',
    'TASK_MATERIAL_RESERVATION_INSUFFICIENT_STOCK',
    'TASK_MATERIAL_RESERVATION_BUNDLE_INCOMPLETE',
    'TASK_MATERIAL_RESERVATION_RELEASE_INVALID',
    'TASK_MATERIAL_RESERVATION_PROJECT_READ_ONLY',
    'TASK_MATERIAL_RESERVATION_TASK_NOT_RESERVABLE',
    'TASK_MATERIAL_RESERVATION_ACTOR_FORBIDDEN',
    'TASK_MATERIAL_RESERVATION_SCOPE_INVALID',
  ]) {
    assert.match(migration, new RegExp(token));
  }
  assert.match(migration, /jsonb_array_elements\(p_allocations\)/);
  assert.match(
    migration,
    /jsonb_typeof\(allocation\.value->'quantity'\) <> 'string'/,
  );
  assert.ok(
    migration.includes(
      "allocation.value->>'quantity' !~ '^(0|[1-9][0-9]{0,10})[.][0-9]{3}$'",
    ),
  );
  assert.match(migration, /task-material-requirement:' \|\| p_project_id/);
  assert.match(
    migration,
    /hashtextextended\(p_project_id, 0\)[\s\S]*task-material-requirement:' \|\| p_project_id/,
  );
  assert.doesNotMatch(migration, /task-material-reservation:/);
  assert.match(migration, /release must mirror reserve entry/);
  assert.match(migration, /readiness_state TEXT[\s\S]*replayed BOOLEAN/);
  assert.doesNotMatch(migration, /LOOP[\s\S]*EXCEPTION[\s\S]*CONTINUE/i);
});
