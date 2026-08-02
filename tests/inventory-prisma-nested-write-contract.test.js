import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { ColumnTypeEnum } from '@prisma/driver-adapter-utils';

import { PrismaClient } from '../src/generated/prisma/client.ts';

const inventoryTransactionsSource = await readFile(
  new URL('../src/lib/inventory-transactions.js', import.meta.url),
  'utf8',
);

function sourceRegion(startMarker, endMarker) {
  const start = inventoryTransactionsSource.indexOf(startMarker);
  const end = inventoryTransactionsSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `Missing source marker: ${endMarker}`);
  return inventoryTransactionsSource.slice(start, end);
}

function nestedEntriesCreateBlock(region) {
  const start = region.indexOf('entries: {');
  const end = region.indexOf('include: TRANSACTION_INCLUDE', start);
  assert.notEqual(start, -1, 'Missing nested entries.create block.');
  assert.notEqual(end, -1, 'Missing nested create include boundary.');
  return region.slice(start, end);
}

function ledgerEntry(overrides = {}) {
  return {
    inventoryItemId: 'item-a',
    locationId: 'location-a',
    quantityDelta: '1.000',
    itemCodeSnapshot: 'MAT-001',
    itemNameSnapshot: 'Material de prueba',
    unitSnapshot: 'unidad',
    locationCodeSnapshot: 'DEP-01',
    locationNameSnapshot: 'Deposito de prueba',
    ...overrides,
  };
}

class LedgerQueryCaptured extends Error {
  constructor(query) {
    super('LEDGER_QUERY_CAPTURED');
    this.query = query;
  }
}

async function compileNestedLedgerInsert(entries) {
  let captured = null;
  const emptyResult = { columnNames: [], columnTypes: [], rows: [] };

  function execute(query) {
    if (query.sql.includes('INSERT INTO "public"."InventoryTransaction"')) {
      return {
        columnNames: ['id', 'organizationId', 'projectId'],
        columnTypes: [ColumnTypeEnum.Text, ColumnTypeEnum.Text, ColumnTypeEnum.Text],
        rows: [[query.args[0], query.args[1], query.args[2]]],
      };
    }
    if (query.sql.includes('INSERT INTO "public"."InventoryLedgerEntry"')) {
      captured = query;
      throw new LedgerQueryCaptured(query);
    }
    if (/^(?:BEGIN|COMMIT|ROLLBACK)\b/.test(query.sql.trim())) return emptyResult;
    throw new Error(`Unexpected Prisma probe query: ${query.sql}`);
  }

  const transaction = {
    provider: 'postgres',
    adapterName: 'inventory-contract-probe',
    options: { usePhantomQuery: false },
    queryRaw: async (query) => execute(query),
    executeRaw: async (query) => {
      execute(query);
      return 0;
    },
    commit: async () => {},
    rollback: async () => {},
  };
  const adapter = {
    provider: 'postgres',
    adapterName: 'inventory-contract-probe',
    queryRaw: async (query) => execute(query),
    executeRaw: async (query) => {
      execute(query);
      return 0;
    },
    executeScript: async () => {},
    startTransaction: async () => transaction,
    getConnectionInfo: () => ({ supportsRelationJoins: true }),
    dispose: async () => {},
  };
  const prisma = new PrismaClient({
    adapter: {
      provider: 'postgres',
      adapterName: 'inventory-contract-probe',
      connect: async () => adapter,
    },
  });

  try {
    await prisma.inventoryTransaction.create({
      data: {
        organizationId: 'organization-a',
        projectId: 'project-a',
        kind: 'RECEIPT_PUTAWAY',
        operationKey: 'inventory-contract-probe',
        requestFingerprint: 'f'.repeat(64),
        actorId: 'actor-a',
        entries: { create: entries },
      },
    });
    assert.fail('The probe must stop after capturing the ledger INSERT.');
  } catch (error) {
    assert.equal(captured?.sql ? error.message.includes('LEDGER_QUERY_CAPTURED') : false, true);
  } finally {
    await prisma.$disconnect();
  }

  return captured;
}

test('production nested ledger payloads leave composite scope fields to Prisma', () => {
  const putaway = nestedEntriesCreateBlock(sourceRegion(
    'async function createReceiptPutaway',
    'async function assertReversalBalance',
  ));
  const reversal = nestedEntriesCreateBlock(sourceRegion(
    'async function createReversal',
    'export async function createInventoryTransaction',
  ));

  for (const block of [putaway, reversal]) {
    assert.match(block, /inventoryItemId\s*:/);
    assert.match(block, /locationId\s*:/);
    assert.doesNotMatch(block, /\borganizationId\s*:/);
    assert.doesNotMatch(block, /\bprojectId\s*:/);
  }
});

test('Prisma compiles sibling ledger entries as one scope-derived multi-row INSERT', async () => {
  const query = await compileNestedLedgerInsert([
    ledgerEntry({ quantityDelta: '1.000' }),
    ledgerEntry({ quantityDelta: '2.000' }),
  ]);
  assert.ok(query);

  const normalizedSql = query.sql.replace(/\s+/g, ' ').trim();
  assert.match(normalizedSql, /INSERT INTO "public"\."InventoryLedgerEntry"/);
  assert.equal((normalizedSql.match(/\), \(/g) || []).length, 1);

  const columnsMatch = normalizedSql.match(/"InventoryLedgerEntry" \(([^)]+)\) VALUES/);
  assert.ok(columnsMatch);
  const columns = columnsMatch[1].split(',').map((column) => column.trim().replaceAll('"', ''));
  const organizationIndex = columns.indexOf('organizationId');
  const projectIndex = columns.indexOf('projectId');
  assert.notEqual(organizationIndex, -1);
  assert.notEqual(projectIndex, -1);
  assert.equal(query.args[organizationIndex], 'organization-a');
  assert.equal(query.args[projectIndex], 'project-a');
  assert.equal(query.args[columns.length + organizationIndex], 'organization-a');
  assert.equal(query.args[columns.length + projectIndex], 'project-a');
});
