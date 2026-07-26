import assert from "node:assert/strict";
import test from "node:test";

import {
  CASH_DUAL_APPROVAL_THRESHOLD,
  CASH_DUPLICATE_WINDOW_MS,
  CashMovementError,
  cashBalance,
  createCashFund,
  createCashMovement,
  decideCashMovement,
} from "../src/lib/cash-movements.js";

const scope = {
  organizationId: "organization-a",
  projectId: "project-a",
};

function operationalPrisma(transaction) {
  transaction.$executeRawUnsafe ||= async () => 1;
  transaction.project ||= {
    async findFirst() {
      return { ...scope, id: scope.projectId, status: "ACTIVE" };
    },
  };
  return {
    async $transaction(callback) {
      return callback(transaction);
    },
  };
}

test("cash fund custodian is resolved through active tenant and project memberships", async () => {
  let membershipQuery;
  let fundCreate;
  const transaction = {
    tenantMembership: {
      async findFirst(query) {
        membershipQuery = query;
        return { userId: "custodian-a" };
      },
    },
    cashFund: {
      async create(query) {
        fundCreate = query;
        return { id: "fund-a", ...query.data };
      },
    },
    auditLog: { async create() {} },
  };

  const result = await createCashFund(operationalPrisma(transaction), {
    scope,
    actorId: "actor-a",
    input: {
      name: "Caja principal",
      currency: "ars",
      custodianId: "custodian-a",
    },
  });

  assert.deepEqual(membershipQuery, {
    where: {
      userId: "custodian-a",
      organizationId: scope.organizationId,
      status: "ACTIVE",
      projectMemberships: {
        some: { projectId: scope.projectId, status: "ACTIVE" },
      },
    },
    select: { userId: true },
  });
  assert.equal(result.fund.custodianId, "custodian-a");
  assert.equal(fundCreate.data.currency, "ARS");
});

test("cash fund creation fails closed when the custodian has no active project assignment", async () => {
  let created = false;
  const transaction = {
    tenantMembership: { async findFirst() { return null; } },
    cashFund: { async create() { created = true; } },
  };

  await assert.rejects(
    createCashFund(operationalPrisma(transaction), {
      scope,
      actorId: "actor-a",
      input: {
        name: "Caja principal",
        currency: "ARS",
        custodianId: "outsider",
      },
    }),
    (error) =>
      error instanceof CashMovementError &&
      error.code === "CASH_CUSTODIAN_SCOPE" &&
      error.status === 409,
  );
  assert.equal(created, false);
});

function decisionHarness(movement, { updateCount = 1 } = {}) {
  const calls = { updates: [], audits: [] };
  const transaction = {
    cashMovement: {
      async findFirst() {
        return movement;
      },
      async updateMany(query) {
        calls.updates.push(query);
        return { count: updateCount };
      },
    },
    auditLog: {
      async create(query) {
        calls.audits.push(query);
      },
    },
  };
  return { calls, prisma: operationalPrisma(transaction) };
}

test("amounts below the threshold are approved in one audited stage", async () => {
  const { calls, prisma } = decisionHarness({
    id: "movement-a",
    amount: CASH_DUAL_APPROVAL_THRESHOLD - 0.01,
    status: "PENDING_APPROVAL",
    firstApproverId: null,
  });

  const result = await decideCashMovement(prisma, {
    scope,
    actorId: "approver-a",
    id: "movement-a",
    expectedRevision: 0,
    status: "APPROVED",
  });

  assert.equal(result.status, "APPROVED");
  assert.equal(result.approvalStage, "single");
  assert.equal(result.firstApproverId, "approver-a");
  assert.equal(result.secondApproverId, null);
  assert.equal(calls.updates[0].data.firstApproverId, "approver-a");
  assert.ok(calls.updates[0].data.approvedAt instanceof Date);
  assert.equal(calls.audits[0].data.metadata.approvalStage, "single");
});

test("amounts at the threshold require a first and a distinct second approver", async () => {
  const first = decisionHarness({
    id: "movement-a",
    amount: CASH_DUAL_APPROVAL_THRESHOLD,
    status: "PENDING_APPROVAL",
    firstApproverId: null,
  });
  const firstResult = await decideCashMovement(first.prisma, {
    scope,
    actorId: "approver-a",
    id: "movement-a",
    expectedRevision: 0,
    status: "APPROVED",
  });

  assert.deepEqual(firstResult, {
    status: "PARTIALLY_APPROVED",
    revision: 1,
    approvalStage: "first",
    firstApproverId: "approver-a",
    secondApproverId: null,
  });
  assert.equal(first.calls.updates[0].data.approvedAt, null);

  const second = decisionHarness({
    id: "movement-a",
    amount: CASH_DUAL_APPROVAL_THRESHOLD,
    status: "PARTIALLY_APPROVED",
    firstApproverId: "approver-a",
  });
  const secondResult = await decideCashMovement(second.prisma, {
    scope,
    actorId: "approver-b",
    id: "movement-a",
    expectedRevision: 1,
    status: "APPROVED",
  });

  assert.equal(secondResult.status, "APPROVED");
  assert.equal(secondResult.approvalStage, "second");
  assert.equal(secondResult.firstApproverId, "approver-a");
  assert.equal(secondResult.secondApproverId, "approver-b");
  assert.deepEqual(second.calls.updates[0].where, {
    id: "movement-a",
    projectId: scope.projectId,
    revision: 1,
    status: "PARTIALLY_APPROVED",
    firstApproverId: "approver-a",
  });
  assert.ok(second.calls.updates[0].data.approvedAt instanceof Date);
});

test("the first approver cannot self-approve the second stage", async () => {
  const { calls, prisma } = decisionHarness({
    id: "movement-a",
    amount: CASH_DUAL_APPROVAL_THRESHOLD,
    status: "PARTIALLY_APPROVED",
    firstApproverId: "approver-a",
  });

  await assert.rejects(
    decideCashMovement(prisma, {
      scope,
      actorId: "approver-a",
      id: "movement-a",
      expectedRevision: 1,
      status: "APPROVED",
    }),
    (error) =>
      error.code === "CASH_SECOND_APPROVER_MUST_DIFFER" && error.status === 409,
  );
  assert.equal(calls.updates.length, 0);
  assert.equal(calls.audits.length, 0);
});

test("rejection is terminal from either pending approval stage", async () => {
  for (const [status, firstApproverId] of [
    ["PENDING_APPROVAL", null],
    ["PARTIALLY_APPROVED", "approver-a"],
  ]) {
    const { calls, prisma } = decisionHarness({
      id: `movement-${status}`,
      amount: CASH_DUAL_APPROVAL_THRESHOLD,
      status,
      firstApproverId,
    });
    const result = await decideCashMovement(prisma, {
      scope,
      actorId: "approver-b",
      id: `movement-${status}`,
      expectedRevision: 2,
      status: "REJECTED",
    });
    assert.equal(result.status, "REJECTED");
    assert.equal(result.approvalStage, "rejected");
    assert.equal(calls.updates[0].data.approvedAt, null);
  }
});

test("cash decision keeps compare-and-swap protection", async () => {
  const { calls, prisma } = decisionHarness(
    {
      id: "movement-a",
      amount: 10,
      status: "PENDING_APPROVAL",
      firstApproverId: null,
    },
    { updateCount: 0 },
  );

  await assert.rejects(
    decideCashMovement(prisma, {
      scope,
      actorId: "approver-a",
      id: "movement-a",
      expectedRevision: 7,
      status: "APPROVED",
    }),
    (error) => error.code === "CASH_MOVEMENT_CONFLICT" && error.status === 409,
  );
  assert.equal(calls.audits.length, 0);
});

function duplicateHarness(sha256) {
  const calls = { duplicateQuery: null, uploadQuery: null };
  const transaction = {
    protectedUpload: {
      async findFirst(query) {
        calls.uploadQuery = query;
        return { sha256 };
      },
    },
    cashMovement: {
      async findFirst(query) {
        if (query.where.idempotencyKey) return null;
        calls.duplicateQuery = query;
        return { id: "recent-duplicate" };
      },
    },
  };
  return { calls, prisma: operationalPrisma(transaction) };
}

async function captureDuplicateQuery({ description, sha256 }) {
  const harness = duplicateHarness(sha256);
  await assert.rejects(
    createCashMovement(harness.prisma, {
      scope,
      actorId: "actor-a",
      input: {
        fundId: "fund-a",
        kind: "EXPENSE",
        amount: 1250,
        category: "Materiales",
        description,
        uploadId: "upload-a",
        idempotencyKey: `operation-${description}`,
      },
    }),
    (error) => error.code === "CASH_MOVEMENT_DUPLICATE",
  );
  return harness.calls;
}

test("semantic duplicate protection is receipt-aware and time-bounded", async () => {
  const before = Date.now();
  const first = await captureDuplicateQuery({
    description: "Arena fina",
    sha256: "a".repeat(64),
  });
  const differentDescription = await captureDuplicateQuery({
    description: "Arena gruesa",
    sha256: "a".repeat(64),
  });
  const differentReceipt = await captureDuplicateQuery({
    description: "Arena fina",
    sha256: "b".repeat(64),
  });

  assert.notEqual(
    first.duplicateQuery.where.fingerprint,
    differentDescription.duplicateQuery.where.fingerprint,
  );
  assert.notEqual(
    first.duplicateQuery.where.fingerprint,
    differentReceipt.duplicateQuery.where.fingerprint,
  );
  assert.deepEqual(first.duplicateQuery.where.status.in, [
    "PENDING_APPROVAL",
    "PARTIALLY_APPROVED",
    "APPROVED",
  ]);
  const cutoff = first.duplicateQuery.where.createdAt.gte.getTime();
  assert.ok(cutoff >= before - CASH_DUPLICATE_WINDOW_MS);
  assert.ok(cutoff <= Date.now() - CASH_DUPLICATE_WINDOW_MS);
  assert.equal(first.uploadQuery.where.status, "AVAILABLE");
  assert.equal(first.uploadQuery.select.sha256, true);
});

test("cash balance includes only finally approved ledger entries", async () => {
  let query;
  const result = await cashBalance(
    {
      cashMovement: {
        async findMany(args) {
          query = args;
          return [
            { kind: "FUNDING", amount: "500" },
            { kind: "EXPENSE", amount: "125" },
            { kind: "REIMBURSEMENT", amount: "25" },
          ];
        },
      },
    },
    { projectId: scope.projectId, fundId: "fund-a" },
  );

  assert.deepEqual(query.where, {
    projectId: scope.projectId,
    fundId: "fund-a",
    status: "APPROVED",
  });
  assert.equal(result.balance, 400);
});
