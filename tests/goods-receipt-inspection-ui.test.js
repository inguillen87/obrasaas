import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  RECEIPT_INSPECTION_PAGE_SIZE,
  acceptedReceiptInspectionDraft,
  buildReceiptInspectionReversal,
  buildReceiptInspectionSubmission,
  deriveReceiptInspectionPartitions,
  initialReceiptInspectionPage,
  latestReceiptInspection,
  receiptInspectionLineDetail,
  receiptInspectionPageFromResponse,
  receiptInspectionReceiptLabel,
  receiptInspectionDraftFromHead,
} from '../src/app/dashboard/purchases/receipt-inspection-model.js';

const root = new URL('../', import.meta.url);
const [inspectionClient, receiptClient] = await Promise.all([
  readFile(new URL(
    'src/app/dashboard/purchases/receipt-inspection-client.js',
    root,
  ), 'utf8'),
  readFile(new URL('src/app/dashboard/purchases/receipt-client.js', root), 'utf8'),
]);

const receipt = {
  id: 'receipt-1',
  purchaseOrderId: 'order-1',
  purchaseOrder: { id: 'order-1', number: 'OC-0001' },
  status: 'POSTED',
  lines: [{
    id: 'receipt-line-1',
    purchaseOrderLineId: 'order-line-1',
    purchaseOrderLine: {
      id: 'order-line-1',
      description: 'Ladrillo hueco',
      unit: 'pallet',
    },
    quantity: '1.000',
  }],
};

const allocations = [{
  id: 'allocation-1',
  goodsReceiptId: 'receipt-1',
  goodsReceiptLineId: 'receipt-line-1',
  purchaseOrderLineId: 'order-line-1',
  supplierCommitmentId: 'commitment-1',
  quantity: '0.333',
}];

test('inspection partitions allocation and unallocated balance with exact thousandths', () => {
  const result = deriveReceiptInspectionPartitions(receipt, allocations);
  assert.equal(result.hasUnallocated, true);
  assert.deepEqual(result.partitions.map((partition) => ({
    allocationId: partition.allocationId,
    quantity: partition.quantity,
  })), [
    { allocationId: 'allocation-1', quantity: '0.333' },
    { allocationId: null, quantity: '0.667' },
  ]);
});

test('inspection submission is exact, location-bound and follows the version head', () => {
  const { partitions } = deriveReceiptInspectionPartitions(receipt, allocations);
  const draft = acceptedReceiptInspectionDraft(partitions);
  const first = buildReceiptInspectionSubmission({
    receipt,
    partitions,
    draft,
    head: null,
    locationId: 'location-1',
    reason: '',
  });
  assert.equal(first.kind, 'FINALIZATION');
  assert.equal(first.predecessorId, undefined);
  assert.deepEqual(first.dispositions.map((row) => row.quantity), ['0.333', '0.667']);

  const reversedHead = { id: 'inspection-reversal', kind: 'REVERSAL', version: 2 };
  const restarted = buildReceiptInspectionSubmission({
    receipt,
    partitions,
    draft,
    head: reversedHead,
    locationId: 'location-1',
    reason: '',
  });
  assert.equal(restarted.kind, 'FINALIZATION');
  assert.equal(restarted.predecessorId, reversedHead.id);
});

test('corrections and exceptions require auditable reasons', () => {
  const { partitions } = deriveReceiptInspectionPartitions(receipt, allocations);
  const accepted = acceptedReceiptInspectionDraft(partitions);
  const head = {
    id: 'inspection-1',
    kind: 'FINALIZATION',
    version: 1,
    dispositions: buildReceiptInspectionSubmission({
      receipt,
      partitions,
      draft: accepted,
      head: null,
      locationId: 'location-1',
      reason: '',
    }).dispositions,
  };
  const correctionDraft = receiptInspectionDraftFromHead(partitions, head);
  assert.throws(() => buildReceiptInspectionSubmission({
    receipt,
    partitions,
    draft: correctionDraft,
    head,
    locationId: 'location-1',
    reason: '',
  }), /corrección requiere un motivo/i);

  const exceptionDraft = acceptedReceiptInspectionDraft(partitions);
  exceptionDraft[partitions[0].key].ACCEPTED = '';
  exceptionDraft[partitions[0].key].DAMAGED = partitions[0].quantity;
  assert.throws(() => buildReceiptInspectionSubmission({
    receipt,
    partitions,
    draft: exceptionDraft,
    head: null,
    locationId: 'location-1',
    reason: '',
  }), /motivo del daño/i);
});

test('chain selection is version-based and reversal is explicit', () => {
  const head = latestReceiptInspection([
    { id: 'inspection-1', kind: 'FINALIZATION', version: 1 },
    {
      id: 'inspection-3',
      kind: 'CORRECTION',
      version: 3,
      predecessorId: 'inspection-2',
    },
    {
      id: 'inspection-2',
      kind: 'CORRECTION',
      version: 2,
      predecessorId: 'inspection-1',
    },
  ]);
  assert.equal(head.id, 'inspection-3');
  assert.deepEqual(buildReceiptInspectionReversal({
    receipt,
    head,
    reason: 'Reabrir para corregir la conciliación',
  }), {
    goodsReceiptId: receipt.id,
    kind: 'REVERSAL',
    predecessorId: head.id,
    reason: 'Reabrir para corregir la conciliación',
  });
});

test('inspection UI pages completely, fails closed and uses replay-safe writes', () => {
  assert.equal(RECEIPT_INSPECTION_PAGE_SIZE, 100);
  assert.match(inspectionClient, /ALLOCATION_PAGE_SIZE = 200/);
  assert.match(inspectionClient, /ALLOCATION_HARD_CAP = 2_000/);
  assert.match(inspectionClient, /INSPECTION_PAGE_SIZE = 50/);
  assert.match(inspectionClient, /INSPECTION_HARD_CAP = 500/);
  assert.match(inspectionClient, /rows\.length >= hardCap/);
  assert.match(inspectionClient, /status: "POSTED"/);
  assert.match(inspectionClient, /Página siguiente/);
  assert.match(inspectionClient, /Página anterior/);
  assert.match(inspectionClient, /no se carga completo/);
  assert.match(inspectionClient, /\/api\/inventory-locations\?active=true/);
  assert.match(inspectionClient, /"Idempotency-Key": inspectionAttemptRef\.current\.operationKey/);
  assert.match(inspectionClient, /"Idempotency-Key": reversalAttemptRef\.current\.operationKey/);
  assert.match(inspectionClient, /"Idempotency-Key": locationAttemptRef\.current\.operationKey/);
  assert.match(inspectionClient, /no crea stock AVAILABLE ni reserva/);
  assert.match(inspectionClient, /no la vincula por fecha ni por FIFO/);
  assert.match(inspectionClient, /const location = inspection\.location\s+\|\|/);
  assert.doesNotMatch(inspectionClient, /parseFloat|parseInt/);
  assert.doesNotMatch(inspectionClient, /lineBalances/);
});

test('receipt container refreshes reconciliation after inspection writes', () => {
  assert.match(receiptClient, /<ReceiptInspectionClient/);
  assert.match(receiptClient, /receipts=\{receipts\}/);
  assert.match(receiptClient, /receiptsTruncated=\{receiptsTruncated\}/);
  assert.match(receiptClient, /onInspectionCommitted=\{\(\) => \{/);
  assert.match(receiptClient, /setReconciliationVersion\(\(current\) => current \+ 1\)/);
});

test('inspection receipt pages are bounded and reject incomplete continuation metadata', () => {
  const initial = initialReceiptInspectionPage([
    receipt,
    ...Array.from({ length: 105 }, (_, index) => ({
      ...receipt,
      id: `receipt-${index + 2}`,
    })),
  ], true);
  assert.equal(initial.receipts.length, 100);
  assert.equal(initial.hasMore, true);
  assert.equal(initial.authoritative, false);

  const page = receiptInspectionPageFromResponse({
    receipts: [receipt],
    hasMore: true,
    nextCursor: 'opaque-cursor',
  });
  assert.equal(page.receipts[0].id, receipt.id);
  assert.equal(page.nextCursor, 'opaque-cursor');
  assert.equal(page.authoritative, true);

  assert.throws(() => receiptInspectionPageFromResponse({
    receipts: [receipt],
    hasMore: true,
    nextCursor: null,
  }), /continuidad de recepciones inválida/);
  assert.throws(() => receiptInspectionPageFromResponse({
    receipts: [{ ...receipt, status: 'VOIDED' }],
    hasMore: false,
    nextCursor: null,
  }), /fuera de estado POSTED/);
  assert.throws(() => receiptInspectionPageFromResponse({
    receipts: [receipt],
    hasMore: true,
    nextCursor: 'same-cursor',
  }, 'same-cursor'), /continuidad de recepciones inválida/);
});

test('old receipt keeps authoritative order and line labels when its order is absent from props', () => {
  const oldReceipt = {
    ...receipt,
    id: 'receipt-0501',
    purchaseOrderId: 'order-0501',
    purchaseOrder: { id: 'order-0501', number: 'OC-0501' },
    lines: [{
      ...receipt.lines[0],
      id: 'receipt-line-0501',
      purchaseOrderLineId: 'order-line-0501',
      purchaseOrderLine: {
        id: 'order-line-0501',
        description: 'Abertura aluminio DVH',
        unit: 'unidad',
      },
    }],
  };
  const page = receiptInspectionPageFromResponse({
    receipts: [oldReceipt],
    hasMore: false,
    nextCursor: null,
  });
  assert.match(receiptInspectionReceiptLabel(page.receipts[0], []), /OC-0501/);
  assert.deepEqual(receiptInspectionLineDetail(
    page.receipts[0],
    [],
    'order-line-0501',
  ), {
    description: 'Abertura aluminio DVH',
    unit: 'unidad',
  });
});
