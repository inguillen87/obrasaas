import assert from "node:assert/strict";
import test from "node:test";

import {
  garbageCollectWhatsAppFlowEndpointRequestBacklog,
  garbageCollectWhatsAppFlowEndpointRequests,
  WhatsAppFlowEndpointRequestError,
  WHATSAPP_FLOW_ENDPOINT_REQUEST_LIMITS,
} from "../src/lib/whatsapp/flow-endpoint-requests.js";

const ENDPOINT_ID = "987e4567-e89b-42d3-a456-426614174000";
const SECOND_ENDPOINT_ID = "887e4567-e89b-42d3-a456-426614174000";
const NOW = new Date("2026-07-17T12:00:00.000Z");

function assertInvalidGc(error) {
  return error instanceof WhatsAppFlowEndpointRequestError
    && error.code === "WHATSAPP_FLOW_ENDPOINT_REQUEST_INVALID"
    && error.status === 500;
}

function transactionPrisma({ deleteRows = [], onDelete = null } = {}) {
  const deleteCalls = [];
  const transaction = {
    async $executeRawUnsafe() {
      return 1;
    },
    async $queryRawUnsafe(...args) {
      deleteCalls.push(args);
      if (onDelete) return onDelete(...args);
      return deleteRows;
    },
  };
  return {
    prisma: {
      async $transaction(callback) {
        return callback(transaction);
      },
    },
    deleteCalls,
  };
}

test("Flow request GC rejects unsafe endpoint and backlog bounds before querying", async () => {
  const endpointDatabase = transactionPrisma();
  for (const batchSize of [
    0,
    WHATSAPP_FLOW_ENDPOINT_REQUEST_LIMITS.gcMaxBatchSize + 1,
    1.5,
  ]) {
    await assert.rejects(
      garbageCollectWhatsAppFlowEndpointRequests(endpointDatabase.prisma, {
        endpointId: ENDPOINT_ID,
        now: NOW,
        batchSize,
      }),
      assertInvalidGc,
    );
  }
  assert.equal(endpointDatabase.deleteCalls.length, 0);

  let selectionCalls = 0;
  const backlogPrisma = {
    async $queryRawUnsafe() {
      selectionCalls += 1;
      return [];
    },
    async $transaction() {
      throw new Error("Unexpected transaction");
    },
  };
  const invalidBounds = [
    { maxEndpoints: 0, batchSize: 1 },
    {
      maxEndpoints: WHATSAPP_FLOW_ENDPOINT_REQUEST_LIMITS.gcMaxEndpointsPerRun + 1,
      batchSize: 1,
    },
    { maxEndpoints: 1, batchSize: 0 },
    {
      maxEndpoints: 1,
      batchSize: WHATSAPP_FLOW_ENDPOINT_REQUEST_LIMITS.gcMaxBatchSize + 1,
    },
  ];
  for (const bounds of invalidBounds) {
    await assert.rejects(
      garbageCollectWhatsAppFlowEndpointRequestBacklog(backlogPrisma, {
        ...bounds,
        now: NOW,
      }),
      assertInvalidGc,
    );
  }
  assert.equal(selectionCalls, 0);
});

test("backlog selection and each endpoint deletion stay explicitly bounded", async () => {
  const selectionCalls = [];
  const deletionCalls = [];
  const prisma = {
    async $queryRawUnsafe(...args) {
      selectionCalls.push(args);
      return [
        { endpointId: ENDPOINT_ID },
        { endpointId: SECOND_ENDPOINT_ID },
      ];
    },
    async $transaction(callback) {
      return callback({
        async $executeRawUnsafe() {
          return 1;
        },
        async $queryRawUnsafe(...args) {
          deletionCalls.push(args);
          return [];
        },
      });
    },
  };

  const result = await garbageCollectWhatsAppFlowEndpointRequestBacklog(prisma, {
    now: NOW,
    maxEndpoints: 2,
    batchSize: 7,
  });

  assert.deepEqual(result, {
    scannedEndpoints: 2,
    failedEndpoints: 0,
    deletedCount: 0,
    hasMore: true,
  });
  assert.equal(selectionCalls.length, 1);
  assert.match(selectionCalls[0][0], /ORDER BY MIN\(request\."createdAt"\) ASC/);
  assert.match(
    selectionCalls[0][0],
    /NOT EXISTS \([\s\S]*"WorkerPaymentFlowSession" AS payment_session[\s\S]*payment_session\."submissionStatus" IN \('PROCESSING', 'UNCERTAIN'\)/,
  );
  assert.match(selectionCalls[0][0], /LIMIT \$4::int/);
  assert.equal(selectionCalls[0][4], 2);
  assert.equal(deletionCalls.length, 2);
  for (const call of deletionCalls) {
    assert.match(call[0], /ORDER BY request\."createdAt" ASC/);
    assert.match(call[0], /LIMIT \$5::int/);
    assert.equal(call[5], 7);
  }
});

test("ciphertext tombstones are deleted only after their key is retired or revoked beyond grace", async () => {
  const database = transactionPrisma({
    deleteRows: [{ id: "123e4567-e89b-42d3-a456-426614174000" }],
  });

  const result = await garbageCollectWhatsAppFlowEndpointRequests(database.prisma, {
    endpointId: ENDPOINT_ID,
    now: NOW,
    batchSize: 5,
  });

  assert.deepEqual(result, { deletedCount: 1, hasMore: false });
  assert.equal(database.deleteCalls.length, 1);
  const [sql, endpointId, oldestEligibleCreatedAt, requestedAt, retiredBefore, batchSize] =
    database.deleteCalls[0];
  assert.equal(endpointId, ENDPOINT_ID);
  assert.equal(
    oldestEligibleCreatedAt.toISOString(),
    new Date(NOW.getTime() - WHATSAPP_FLOW_ENDPOINT_REQUEST_LIMITS.retentionMs).toISOString(),
  );
  assert.equal(requestedAt.toISOString(), NOW.toISOString());
  assert.equal(
    retiredBefore.toISOString(),
    new Date(
      NOW.getTime()
        - WHATSAPP_FLOW_ENDPOINT_REQUEST_LIMITS.tombstoneRetirementGraceMs,
    ).toISOString(),
  );
  assert.equal(batchSize, 5);
  assert.match(
    sql,
    /request\."responseCiphertext" IS NOT NULL[\s\S]*EXISTS \([\s\S]*endpoint_key\."endpointId" = request\."endpointId"/,
  );
  assert.match(
    sql,
    /endpoint_key\."status" = 'REVOKED'[\s\S]*endpoint_key\."updatedAt" <= \$4/,
  );
  assert.match(
    sql,
    /endpoint_key\."status" = 'RETIRING'[\s\S]*endpoint_key\."retireAfter" <= \$4/,
  );
  assert.match(
    sql,
    /NOT EXISTS \([\s\S]*"WorkerPaymentFlowSession" AS payment_session[\s\S]*payment_session\."submissionStatus" IN \('PROCESSING', 'UNCERTAIN'\)/,
  );
  assert.doesNotMatch(sql, /endpoint_key\."status" = '(?:ACTIVE|STAGED)'/);
});

test("backlog GC continues with later endpoints when one endpoint fails", async () => {
  const attemptedEndpoints = [];
  const prisma = {
    async $queryRawUnsafe() {
      return [
        { endpointId: ENDPOINT_ID },
        { endpointId: SECOND_ENDPOINT_ID },
      ];
    },
    async $transaction(callback) {
      return callback({
        async $executeRawUnsafe() {
          return 1;
        },
        async $queryRawUnsafe(_sql, endpointId) {
          attemptedEndpoints.push(endpointId);
          if (endpointId === ENDPOINT_ID) {
            throw new Error("simulated endpoint lock timeout");
          }
          return [
            { id: "123e4567-e89b-42d3-a456-426614174000" },
            { id: "223e4567-e89b-42d3-a456-426614174000" },
          ];
        },
      });
    },
  };

  const result = await garbageCollectWhatsAppFlowEndpointRequestBacklog(prisma, {
    now: NOW,
    maxEndpoints: 3,
    batchSize: 5,
  });

  assert.deepEqual(attemptedEndpoints, [ENDPOINT_ID, SECOND_ENDPOINT_ID]);
  assert.deepEqual(result, {
    scannedEndpoints: 2,
    failedEndpoints: 1,
    deletedCount: 2,
    hasMore: false,
  });
});
