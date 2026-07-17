import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  acquireWhatsAppConnectionLease,
  acquireWhatsAppFlowProvisioningLease,
  commitWhatsAppConnectionLease,
  commitWhatsAppFlowProvisioningLease,
  releaseWhatsAppConnectionLease,
  releaseWhatsAppFlowProvisioningLease,
  WhatsAppFlowProvisioningLeaseError,
} from "../src/lib/whatsapp/flow-provisioning-lease.js";

const CONNECTION_ID = "connection-a";
const BLUEPRINT_KEY = "site_progress";
const NOW = new Date("2026-07-17T12:00:00.000Z");
const FIRST_LEASE_ID = "123e4567-e89b-42d3-a456-426614174000";
const SECOND_LEASE_ID = "223e4567-e89b-42d3-a456-426614174000";
const CONNECTION_IDENTITY = Object.freeze({
  phoneNumberId: "123456789012345",
  whatsappBusinessId: "987654321012345",
  encryptedAccessToken: "encrypted-access-token-v1",
});
const LEASE_MIGRATION = readFileSync(new URL(
  "../prisma/migrations/20260717033000_whatsapp_flow_provisioning_leases/migration.sql",
  import.meta.url,
), "utf8");
const APPLIED_ENDPOINT_MIGRATION = readFileSync(new URL(
  "../prisma/migrations/20260717020000_whatsapp_flow_data_endpoints/migration.sql",
  import.meta.url,
), "utf8");

function clone(value) {
  return structuredClone(value);
}

function leaseColumns({
  id = null,
  blueprintKey = null,
  acquiredAt = null,
  expiresAt = null,
} = {}) {
  return {
    flowProvisioningLeaseId: id,
    flowProvisioningBlueprintKey: blueprintKey,
    flowProvisioningLeaseAcquiredAt: acquiredAt ? new Date(acquiredAt) : null,
    flowProvisioningLeaseExpiresAt: expiresAt ? new Date(expiresAt) : null,
  };
}

function datesEqual(left, right) {
  return new Date(left).getTime() === new Date(right).getTime();
}

function matchesWhere(row, where) {
  if (!row || where.id !== row.id) return false;
  if (where.updatedAt && !datesEqual(where.updatedAt, row.updatedAt)) return false;
  if (where.enabled !== undefined && where.enabled !== row.enabled) return false;
  if (
    where.connectionStatus !== undefined
    && where.connectionStatus !== row.connectionStatus
  ) {
    return false;
  }
  if (where.phoneNumberId !== undefined && where.phoneNumberId !== row.phoneNumberId) {
    return false;
  }
  if (
    where.whatsappBusinessId !== undefined
    && where.whatsappBusinessId !== row.whatsappBusinessId
  ) {
    return false;
  }
  if (
    where.encryptedAccessToken !== undefined
    && where.encryptedAccessToken !== row.encryptedAccessToken
  ) {
    return false;
  }
  if (
    Object.hasOwn(where, "flowProvisioningLeaseId")
    && where.flowProvisioningLeaseId !== row.flowProvisioningLeaseId
  ) {
    return false;
  }
  if (where.OR) {
    const matchesAlternative = where.OR.some((alternative) => {
      if (Object.hasOwn(alternative, "flowProvisioningLeaseId")) {
        return alternative.flowProvisioningLeaseId === row.flowProvisioningLeaseId;
      }
      const expiry = alternative.flowProvisioningLeaseExpiresAt;
      if (expiry?.lte) {
        return row.flowProvisioningLeaseExpiresAt
          && row.flowProvisioningLeaseExpiresAt <= new Date(expiry.lte);
      }
      return false;
    });
    if (!matchesAlternative) return false;
  }
  return true;
}

function database({ metadata = {}, updatedAt = NOW, lease = null } = {}) {
  let row = {
    id: CONNECTION_ID,
    metadata: clone(metadata),
    updatedAt: new Date(updatedAt),
    enabled: true,
    connectionStatus: "CONNECTED",
    ...CONNECTION_IDENTITY,
    ...leaseColumns(lease || {}),
  };
  let beforeNextUpdate = null;
  let afterNextSuccessfulUpdate = null;
  const audits = [];

  const connectionDelegate = {
    async findUnique({ where }) {
      if (!row || where.id !== row.id) return null;
      return clone(row);
    },
    async updateMany({ where, data }) {
      if (beforeNextUpdate) {
        const mutate = beforeNextUpdate;
        beforeNextUpdate = null;
        mutate(row);
      }
      if (!matchesWhere(row, where)) return { count: 0 };
      const nextUpdatedAt = data.updatedAt
        ? new Date(data.updatedAt)
        : new Date(row.updatedAt.getTime() + 1);
      row = {
        ...row,
        ...clone(data),
        updatedAt: nextUpdatedAt,
      };
      if (afterNextSuccessfulUpdate) {
        const mutate = afterNextSuccessfulUpdate;
        afterNextSuccessfulUpdate = null;
        mutate(row);
      }
      return { count: 1 };
    },
  };
  const transactionClient = {
    whatsAppConnection: connectionDelegate,
    auditLog: {
      async create({ data }) {
        audits.push(clone(data));
        return clone(data);
      },
    },
  };
  const prisma = {
    ...transactionClient,
    async $transaction(callback) {
      const rowSnapshot = clone(row);
      const auditCount = audits.length;
      try {
        return await callback(transactionClient);
      } catch (error) {
        row = rowSnapshot;
        audits.splice(auditCount);
        throw error;
      }
    },
  };

  return {
    prisma,
    get row() { return clone(row); },
    get audits() { return clone(audits); },
    mutateBeforeNextUpdate(callback) {
      beforeNextUpdate = callback;
    },
    mutateAfterNextSuccessfulUpdate(callback) {
      afterNextSuccessfulUpdate = callback;
    },
    replaceMetadata(metadata) {
      row.metadata = clone(metadata);
      row.updatedAt = new Date(row.updatedAt.getTime() + 1);
    },
    replaceIdentity(identity) {
      row = { ...row, ...clone(identity) };
      row.updatedAt = new Date(row.updatedAt.getTime() + 1);
    },
    replaceLease(lease) {
      row = { ...row, ...leaseColumns(lease) };
      row.updatedAt = new Date(row.updatedAt.getTime() + 1);
    },
  };
}

test("the concurrency fence ships in a separate constrained migration", () => {
  assert.match(LEASE_MIGRATION, /ADD COLUMN "flowProvisioningLeaseId" UUID/);
  assert.match(LEASE_MIGRATION, /flow_provisioning_lease_shape_check/);
  assert.match(LEASE_MIGRATION, /INTERVAL '10 minutes'/);
  assert.match(LEASE_MIGRATION, /flowProvisioningLeaseExpiresAt_idx/);
  assert.doesNotMatch(APPLIED_ENDPOINT_MIGRATION, /flowProvisioningLeaseId/);
});

test("a dedicated atomic lease gives concurrent provisioning exactly one winner", async () => {
  const db = database({ metadata: { preserved: true } });
  const first = acquireWhatsAppFlowProvisioningLease(db.prisma, {
    connectionId: CONNECTION_ID,
    blueprintKey: BLUEPRINT_KEY,
    expectedUpdatedAt: NOW,
    expectedConnectionIdentity: CONNECTION_IDENTITY,
    leaseId: FIRST_LEASE_ID,
    now: NOW,
  });
  const second = acquireWhatsAppFlowProvisioningLease(db.prisma, {
    connectionId: CONNECTION_ID,
    blueprintKey: "incident_report",
    expectedUpdatedAt: NOW,
    expectedConnectionIdentity: CONNECTION_IDENTITY,
    leaseId: SECOND_LEASE_ID,
    now: NOW,
  });
  const results = await Promise.allSettled([first, second]);

  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find((result) => result.status === "rejected");
  assert.ok(rejected.reason instanceof WhatsAppFlowProvisioningLeaseError);
  assert.equal(rejected.reason.code, "WHATSAPP_FLOW_PROVISIONING_IN_PROGRESS");
  assert.equal(rejected.reason.status, 409);
  assert.equal(rejected.reason.retryAfterSeconds, 120);
  assert.equal(db.row.metadata.preserved, true);
  assert.equal(db.row.updatedAt.getTime(), NOW.getTime() + 1);
  const fulfilled = results.find((result) => result.status === "fulfilled");
  assert.equal(fulfilled.value.metadata.preserved, true);
  assert.match(
    fulfilled.value.connectionIdentity.encryptedAccessTokenSha256,
    /^[0-9a-f]{64}$/,
  );
  assert.equal(fulfilled.value.connectionIdentity.encryptedAccessToken, undefined);
  assert.equal(db.row.flowProvisioningLeaseId, fulfilled.value.lease.id);
  assert.equal(db.row.flowProvisioningBlueprintKey, fulfilled.value.lease.blueprintKey);
});

test("an active lease exposes bounded retry guidance and an expired lease is recoverable", async () => {
  const activeDb = database({
    lease: {
      id: FIRST_LEASE_ID,
      blueprintKey: BLUEPRINT_KEY,
      acquiredAt: NOW,
      expiresAt: new Date(NOW.getTime() + 45_001),
    },
  });
  await assert.rejects(
    acquireWhatsAppFlowProvisioningLease(activeDb.prisma, {
      connectionId: CONNECTION_ID,
      blueprintKey: BLUEPRINT_KEY,
      expectedUpdatedAt: NOW,
      expectedConnectionIdentity: CONNECTION_IDENTITY,
      leaseId: SECOND_LEASE_ID,
      now: NOW,
    }),
    (error) => error.code === "WHATSAPP_FLOW_PROVISIONING_IN_PROGRESS"
      && error.retryAfterSeconds === 46,
  );

  const expiredDb = database({
    metadata: { retained: "value" },
    lease: {
      id: FIRST_LEASE_ID,
      blueprintKey: BLUEPRINT_KEY,
      acquiredAt: new Date(NOW.getTime() - 60_000),
      expiresAt: new Date(NOW.getTime() - 1),
    },
  });
  const recovered = await acquireWhatsAppFlowProvisioningLease(expiredDb.prisma, {
    connectionId: CONNECTION_ID,
    blueprintKey: BLUEPRINT_KEY,
    expectedUpdatedAt: NOW,
    expectedConnectionIdentity: CONNECTION_IDENTITY,
    leaseId: SECOND_LEASE_ID,
    now: NOW,
  });
  assert.equal(recovered.lease.id, SECOND_LEASE_ID);
  assert.equal(expiredDb.row.metadata.retained, "value");
  assert.equal(expiredDb.row.flowProvisioningLeaseId, SECOND_LEASE_ID);
});

test("legacy metadata replacement cannot erase the lease or enable a second remote call", async () => {
  const db = database({ metadata: { qualityRating: "GREEN" } });
  const staleMetadata = clone(db.row.metadata);
  const acquired = await acquireWhatsAppFlowProvisioningLease(db.prisma, {
    connectionId: CONNECTION_ID,
    blueprintKey: BLUEPRINT_KEY,
    expectedUpdatedAt: NOW,
    expectedConnectionIdentity: CONNECTION_IDENTITY,
    leaseId: FIRST_LEASE_ID,
    now: NOW,
  });

  db.replaceMetadata({ ...staleMetadata, webhookCursor: "cursor-after-lease" });
  assert.equal(db.row.flowProvisioningLeaseId, FIRST_LEASE_ID);
  await assert.rejects(
    acquireWhatsAppFlowProvisioningLease(db.prisma, {
      connectionId: CONNECTION_ID,
      blueprintKey: "incident_report",
      expectedUpdatedAt: db.row.updatedAt,
      expectedConnectionIdentity: CONNECTION_IDENTITY,
      leaseId: SECOND_LEASE_ID,
      now: NOW,
    }),
    (error) => error.code === "WHATSAPP_FLOW_PROVISIONING_IN_PROGRESS",
  );

  const committed = await commitWhatsAppFlowProvisioningLease(db.prisma, {
    connectionId: CONNECTION_ID,
    leaseId: acquired.lease.id,
    expectedConnectionIdentity: acquired.connectionIdentity,
    now: NOW,
    buildMetadata: (metadata) => ({ ...metadata, flowCommitted: true }),
  });
  assert.equal(committed.metadata.webhookCursor, "cursor-after-lease");
  assert.equal(db.row.metadata.webhookCursor, "cursor-after-lease");
  assert.equal(db.row.flowProvisioningLeaseId, null);
});

test("a stale connection snapshot or reconnect cannot acquire a lease for old credentials", async () => {
  const staleDb = database();
  staleDb.replaceMetadata({ refreshedByWebhook: true });
  await assert.rejects(
    acquireWhatsAppFlowProvisioningLease(staleDb.prisma, {
      connectionId: CONNECTION_ID,
      blueprintKey: BLUEPRINT_KEY,
      expectedUpdatedAt: NOW,
      expectedConnectionIdentity: CONNECTION_IDENTITY,
      leaseId: FIRST_LEASE_ID,
      now: NOW,
    }),
    (error) => error.code === "WHATSAPP_FLOW_PROVISIONING_CONNECTION_CHANGED",
  );
  assert.equal(staleDb.row.flowProvisioningLeaseId, null);

  const reconnectDb = database();
  reconnectDb.mutateAfterNextSuccessfulUpdate((row) => {
    Object.assign(row, leaseColumns());
    row.metadata = { identityChanged: true };
    row.updatedAt = new Date(row.updatedAt.getTime() + 1);
  });
  await assert.rejects(
    acquireWhatsAppFlowProvisioningLease(reconnectDb.prisma, {
      connectionId: CONNECTION_ID,
      blueprintKey: BLUEPRINT_KEY,
      expectedUpdatedAt: NOW,
      expectedConnectionIdentity: CONNECTION_IDENTITY,
      leaseId: FIRST_LEASE_ID,
      now: NOW,
    }),
    (error) => error.code === "WHATSAPP_FLOW_PROVISIONING_CONNECTION_CHANGED",
  );
  assert.equal(reconnectDb.row.flowProvisioningLeaseId, null);
});

test("Flow commit rejects every connection identity field changed during the remote call", async () => {
  const identityMutations = [
    { phoneNumberId: "223456789012345" },
    { whatsappBusinessId: "887654321012345" },
    { encryptedAccessToken: "encrypted-access-token-v2" },
  ];

  for (const identityMutation of identityMutations) {
    const db = database({ metadata: { activeFlow: "flow-old" } });
    const acquired = await acquireWhatsAppFlowProvisioningLease(db.prisma, {
      connectionId: CONNECTION_ID,
      blueprintKey: BLUEPRINT_KEY,
      expectedUpdatedAt: NOW,
      expectedConnectionIdentity: CONNECTION_IDENTITY,
      leaseId: FIRST_LEASE_ID,
      now: NOW,
    });
    db.replaceIdentity(identityMutation);

    await assert.rejects(
      commitWhatsAppFlowProvisioningLease(db.prisma, {
        connectionId: CONNECTION_ID,
        leaseId: acquired.lease.id,
        expectedConnectionIdentity: acquired.connectionIdentity,
        now: NOW,
        buildMetadata: (metadata) => ({ ...metadata, activeFlow: "flow-new" }),
      }),
      (error) => error.code === "WHATSAPP_FLOW_PROVISIONING_CONNECTION_CHANGED",
    );
    assert.equal(db.row.metadata.activeFlow, "flow-old");
    assert.equal(db.row.flowProvisioningLeaseId, FIRST_LEASE_ID);
    assert.equal(await releaseWhatsAppFlowProvisioningLease(db.prisma, {
      connectionId: CONNECTION_ID,
      leaseId: FIRST_LEASE_ID,
    }), true);
  }
});

test("refresh, Flow provisioning, and disable share one connection mutex", async () => {
  const db = database({ metadata: { qualityRating: "GREEN" } });
  const refresh = await acquireWhatsAppConnectionLease(db.prisma, {
    connectionId: CONNECTION_ID,
    operationKey: "connection_refresh",
    expectedUpdatedAt: NOW,
    leaseId: FIRST_LEASE_ID,
    now: NOW,
  });
  assert.equal(refresh.lease.blueprintKey, "connection_refresh");

  await assert.rejects(
    acquireWhatsAppFlowProvisioningLease(db.prisma, {
      connectionId: CONNECTION_ID,
      blueprintKey: BLUEPRINT_KEY,
      expectedUpdatedAt: db.row.updatedAt,
      expectedConnectionIdentity: CONNECTION_IDENTITY,
      leaseId: SECOND_LEASE_ID,
      now: NOW,
    }),
    (error) => error.code === "WHATSAPP_FLOW_PROVISIONING_IN_PROGRESS",
  );

  const refreshed = await commitWhatsAppConnectionLease(db.prisma, {
    connectionId: CONNECTION_ID,
    leaseId: refresh.lease.id,
    now: NOW,
    buildConnectionData: (connection) => ({
      encryptedAccessToken: "encrypted-access-token-v2",
      metadata: { ...connection.metadata, refreshed: true },
    }),
  });
  assert.equal(refreshed.metadata.refreshed, true);
  assert.equal(db.row.encryptedAccessToken, "encrypted-access-token-v2");
  assert.equal(db.row.flowProvisioningLeaseId, null);

  const disable = await acquireWhatsAppConnectionLease(db.prisma, {
    connectionId: CONNECTION_ID,
    operationKey: "connection_disable",
    expectedUpdatedAt: db.row.updatedAt,
    leaseId: SECOND_LEASE_ID,
    now: new Date(NOW.getTime() + 1_000),
  });
  await commitWhatsAppConnectionLease(db.prisma, {
    connectionId: CONNECTION_ID,
    leaseId: disable.lease.id,
    now: new Date(NOW.getTime() + 1_000),
    buildConnectionData: () => ({
      enabled: false,
      connectionStatus: "DISABLED",
      encryptedAccessToken: null,
    }),
  });
  assert.equal(db.row.enabled, false);
  assert.equal(db.row.connectionStatus, "DISABLED");
  assert.equal(db.row.encryptedAccessToken, null);
  assert.equal(db.row.flowProvisioningLeaseId, null);
  assert.equal(await releaseWhatsAppConnectionLease(db.prisma, {
    connectionId: CONNECTION_ID,
    leaseId: SECOND_LEASE_ID,
  }), false);
});

test("commit retries CAS, merges the newest metadata, clears the lease, and audits atomically", async () => {
  const db = database({ metadata: { before: true } });
  const acquired = await acquireWhatsAppFlowProvisioningLease(db.prisma, {
    connectionId: CONNECTION_ID,
    blueprintKey: BLUEPRINT_KEY,
    expectedUpdatedAt: NOW,
    expectedConnectionIdentity: CONNECTION_IDENTITY,
    leaseId: FIRST_LEASE_ID,
    now: NOW,
  });
  let builds = 0;
  db.mutateBeforeNextUpdate((row) => {
    row.metadata = { ...row.metadata, concurrentWriter: "preserved" };
    row.updatedAt = new Date(row.updatedAt.getTime() + 1);
  });

  const committed = await commitWhatsAppFlowProvisioningLease(db.prisma, {
    connectionId: CONNECTION_ID,
    leaseId: acquired.lease.id,
    expectedConnectionIdentity: acquired.connectionIdentity,
    now: NOW,
    buildMetadata(metadata) {
      builds += 1;
      return { ...metadata, whatsappFlows: { site_progress: { id: "flow-1" } } };
    },
    createAuditLog: (transaction) => transaction.auditLog.create({
      data: { action: "integration.whatsapp.flow_draft_created" },
    }),
  });

  assert.equal(builds, 2);
  assert.equal(committed.metadata.concurrentWriter, "preserved");
  assert.equal(db.row.metadata.concurrentWriter, "preserved");
  assert.equal(db.row.metadata.whatsappFlows.site_progress.id, "flow-1");
  assert.equal(db.row.flowProvisioningLeaseId, null);
  assert.equal(db.row.flowProvisioningBlueprintKey, null);
  assert.equal(db.row.flowProvisioningLeaseAcquiredAt, null);
  assert.equal(db.row.flowProvisioningLeaseExpiresAt, null);
  assert.equal(db.audits.length, 1);
});

test("a failed audit rolls metadata back and leaves the durable lease recoverable", async () => {
  const db = database();
  const acquired = await acquireWhatsAppFlowProvisioningLease(db.prisma, {
    connectionId: CONNECTION_ID,
    blueprintKey: BLUEPRINT_KEY,
    expectedUpdatedAt: NOW,
    expectedConnectionIdentity: CONNECTION_IDENTITY,
    leaseId: FIRST_LEASE_ID,
    now: NOW,
  });
  await assert.rejects(
    commitWhatsAppFlowProvisioningLease(db.prisma, {
      connectionId: CONNECTION_ID,
      leaseId: acquired.lease.id,
      expectedConnectionIdentity: acquired.connectionIdentity,
      now: NOW,
      buildMetadata: (metadata) => ({ ...metadata, shouldRollback: true }),
      createAuditLog: async () => {
        throw new Error("audit unavailable");
      },
    }),
    /audit unavailable/,
  );
  assert.equal(db.row.metadata.shouldRollback, undefined);
  assert.equal(db.row.flowProvisioningLeaseId, FIRST_LEASE_ID);
});

test("release is owner-scoped and clears only dedicated columns", async () => {
  const db = database({ metadata: { untouched: true } });
  const acquired = await acquireWhatsAppFlowProvisioningLease(db.prisma, {
    connectionId: CONNECTION_ID,
    blueprintKey: BLUEPRINT_KEY,
    expectedUpdatedAt: NOW,
    expectedConnectionIdentity: CONNECTION_IDENTITY,
    leaseId: FIRST_LEASE_ID,
    now: NOW,
  });
  db.replaceMetadata({ untouched: true, concurrentWriter: "kept" });
  db.replaceLease({
    id: SECOND_LEASE_ID,
    blueprintKey: acquired.lease.blueprintKey,
    acquiredAt: acquired.lease.acquiredAt,
    expiresAt: acquired.lease.expiresAt,
  });
  assert.equal(await releaseWhatsAppFlowProvisioningLease(db.prisma, {
    connectionId: CONNECTION_ID,
    leaseId: FIRST_LEASE_ID,
  }), false);
  assert.equal(db.row.flowProvisioningLeaseId, SECOND_LEASE_ID);
  assert.equal(await releaseWhatsAppFlowProvisioningLease(db.prisma, {
    connectionId: CONNECTION_ID,
    leaseId: SECOND_LEASE_ID,
  }), true);
  assert.equal(db.row.flowProvisioningLeaseId, null);
  assert.deepEqual(db.row.metadata, {
    untouched: true,
    concurrentWriter: "kept",
  });
});
