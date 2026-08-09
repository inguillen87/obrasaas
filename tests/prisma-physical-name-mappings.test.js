import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const schema = await readFile(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');

const EXPECTED_HISTORICAL_MAPS = Object.freeze([
  'Supplier_organization_fkey',
  'SupplierInvoice_org_fkey',
  'SupplierInvoice_project_fkey',
  'SupplierInvoice_supplier_fkey',
  'SupplierInvoice_order_fkey',
  'PurchaseOrder_org_fkey',
  'PurchaseOrder_project_fkey',
  'PurchaseOrder_supplier_fkey',
  'PurchaseOrderLine_order_fkey',
  'PurchaseOrderLine_budgetLine_fkey',
  'SupplierCommitment_organization_fkey',
  'SupplierCommitment_project_fkey',
  'SupplierCommitment_supplier_fkey',
  'SupplierCommitment_purchaseOrder_fkey',
  'SupplierCommitmentLine_commitment_fkey',
  'SupplierCommitmentLine_purchaseOrderLine_fkey',
  'SupplierCommitmentTaskLink_commitment_fkey',
  'SupplierCommitmentTaskLink_task_fkey',
  'SupplierCommitmentEvent_commitment_fkey',
  'SupplierReminderDelivery_organization_fkey',
  'SupplierReminderDelivery_project_fkey',
  'SupplierReminderDelivery_commitment_fkey',
  'SupplierReminderDelivery_projectId_commitmentId_scheduleRevisio',
  'SupplierReminderWebhookApplication_event_fkey',
  'SupplierReminderWebhookApplication_delivery_fkey',
  'SupplierReminderWebhookApplication_projectId_deliveryId_applied',
  'GoodsReceipt_organization_fkey',
  'GoodsReceipt_project_fkey',
  'GoodsReceipt_order_fkey',
  'GoodsReceiptLine_receipt_fkey',
  'GoodsReceiptLine_orderLine_fkey',
  'POLInventoryBinding_organizationId_fkey',
  'POLInventoryBinding_boundById_fkey',
  'WorkerPrivacyChoice_organization_fkey',
  'Task_parent_scope_fkey',
  'TaskDependency_project_fkey',
  'TaskDependency_predecessor_scope_fkey',
  'TaskDependency_successor_scope_fkey',
  'TaskDependency_project_successor_idx',
  'WorkTeam_project_fkey',
  'WorkTeam_project_status_name_idx',
  'WorkTeamMember_team_scope_fkey',
  'WorkTeamMember_worker_scope_fkey',
  'WorkTeamMember_project_team_worker_start_key',
  'WorkTeamMember_project_worker_end_idx',
  'WorkTeamMember_project_team_end_idx',
  'TaskAssignment_task_scope_fkey',
  'TaskAssignment_worker_scope_fkey',
  'TaskAssignment_team_scope_fkey',
  'TaskAssignment_project_task_status_idx',
  'TaskAssignment_project_worker_status_idx',
  'TaskAssignment_project_team_status_idx',
  'ProjectBlocker_project_fkey',
  'ProjectBlocker_task_scope_fkey',
  'ProjectBlocker_worker_scope_fkey',
  'ProjectBlocker_team_scope_fkey',
  'ProjectBlocker_project_status_severity_due_idx',
  'ProjectBlocker_project_task_status_idx',
  'ExtraWorkRequest_project_task_fkey',
  'ExtraWorkRequest_project_worker_fkey',
  'ExtraWorkSession_extraWork_project_fkey',
  'ExtraWorkSession_worker_project_fkey',
  'BudgetVersion_project_fkey',
  'BudgetLine_version_fkey',
  'BudgetLine_task_fkey',
  'BudgetEntry_line_fkey',
  'CashFund_project_fkey',
  'CashFund_custodian_fkey',
  'CashMovement_fund_fkey',
  'CashMovement_firstApprover_fkey',
  'CashMovement_secondApprover_fkey',
  'NotificationDelivery_organizationId_recipientId_channel_eventKe',
  'DailyLog_project_task_fkey',
  'DailyLog_project_worker_fkey',
  'ProgressEvidence_project_task_fkey',
  'ProgressEvidence_project_worker_fkey',
  'PELRateBucket_organization_fkey',
]);

const TRUNCATED_POSTGRESQL_MAPS = Object.freeze([
  'SupplierReminderDelivery_projectId_commitmentId_scheduleRevisio',
  'SupplierReminderWebhookApplication_projectId_deliveryId_applied',
  'NotificationDelivery_organizationId_recipientId_channel_eventKe',
]);

const mappedNames = [...schema.matchAll(/\bmap:\s*"([^"]+)"/g)].map((match) => match[1]);
const mappedNameCounts = new Map();

for (const name of mappedNames) {
  mappedNameCounts.set(name, (mappedNameCounts.get(name) ?? 0) + 1);
}

test('historical Prisma physical-name manifest contains 77 unique entries', () => {
  const manifestDuplicates = EXPECTED_HISTORICAL_MAPS.filter(
    (name, index) => EXPECTED_HISTORICAL_MAPS.indexOf(name) !== index,
  );

  assert.equal(EXPECTED_HISTORICAL_MAPS.length, 77);
  assert.deepEqual(manifestDuplicates, []);
});

test('schema maps every historical physical name exactly once', () => {
  const missing = EXPECTED_HISTORICAL_MAPS.filter(
    (name) => !mappedNameCounts.has(name),
  );
  const duplicated = EXPECTED_HISTORICAL_MAPS.filter(
    (name) => (mappedNameCounts.get(name) ?? 0) > 1,
  ).map((name) => ({ name, occurrences: mappedNameCounts.get(name) }));
  const historicalOccurrences = mappedNames.filter((name) =>
    EXPECTED_HISTORICAL_MAPS.includes(name),
  );

  assert.deepEqual({ missing, duplicated }, { missing: [], duplicated: [] });
  assert.equal(historicalOccurrences.length, EXPECTED_HISTORICAL_MAPS.length);
});

test('PostgreSQL-truncated physical names remain exact', () => {
  const truncatedPrefixes = [
    'SupplierReminderDelivery_projectId_commitmentId_schedule',
    'SupplierReminderWebhookApplication_projectId_deliveryId_',
    'NotificationDelivery_organizationId_recipientId_channel_',
  ];
  const matchingMaps = mappedNames.filter((name) =>
    truncatedPrefixes.some((prefix) => name.startsWith(prefix)),
  );

  assert.deepEqual(matchingMaps, TRUNCATED_POSTGRESQL_MAPS);
  assert.ok(TRUNCATED_POSTGRESQL_MAPS.every((name) => name.length === 63));
});
