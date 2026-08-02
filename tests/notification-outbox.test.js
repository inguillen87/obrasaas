import test from 'node:test';
import assert from 'node:assert/strict';

import {
  enqueueNotification,
  markNotificationRead,
  recoverExpiredNotificationLeases,
} from '../src/lib/notification-outbox.js';
import { processInAppNotifications } from '../src/lib/notification-worker.js';

const NOW = new Date('2026-08-02T15:00:00.000Z');

function scopedPrisma({
  membership = {
    id: 'membership-a',
    tenantRole: 'SITE_MANAGER',
    projectMemberships: [{ id: 'project-membership-a' }],
  },
  project = { id: 'project-a' },
  preferenceEnabled = false,
} = {}) {
  const calls = { membership: [], project: [], preference: [], upsert: [] };
  return {
    calls,
    prisma: {
      tenantMembership: {
        async findFirst(args) {
          calls.membership.push(args);
          return membership;
        },
      },
      project: {
        async findFirst(args) {
          calls.project.push(args);
          return project;
        },
      },
      notificationPreference: {
        async findUnique(args) {
          calls.preference.push(args);
          return { enabled: preferenceEnabled };
        },
      },
      notificationDelivery: {
        async upsert(args) {
          calls.upsert.push(args);
          return { id: 'delivery-a', ...args.create };
        },
      },
    },
  };
}

function notificationInput(overrides = {}) {
  return {
    organizationId: 'organization-a',
    projectId: 'project-a',
    recipientId: 'user-a',
    eventKey: 'blocker:blocker-a',
    channel: 'IN_APP',
    title: 'Blocker crítico',
    body: 'Revisar acceso a obra.',
    payload: { blockerId: 'blocker-a' },
    now: NOW,
    ...overrides,
  };
}

test('an IN_APP notification is committed as delivered and deduplicated inside its tenant', async () => {
  const store = scopedPrisma();
  const row = await enqueueNotification(store.prisma, notificationInput());

  assert.equal(row.status, 'SENT');
  assert.equal(row.sentAt.toISOString(), NOW.toISOString());
  assert.equal(store.calls.preference.length, 0);
  assert.deepEqual(store.calls.upsert[0].where, {
    organizationId_recipientId_channel_eventKey: {
      organizationId: 'organization-a',
      recipientId: 'user-a',
      channel: 'IN_APP',
      eventKey: 'blocker:blocker-a',
    },
  });
});

test('enqueue rejects users outside the active tenant or project scope', async () => {
  const withoutTenant = scopedPrisma({ membership: null });
  await assert.rejects(
    enqueueNotification(withoutTenant.prisma, notificationInput()),
    (error) => error?.code === 'NOTIFICATION_RECIPIENT_SCOPE' && error?.status === 409,
  );

  const withoutProject = scopedPrisma({
    membership: { id: 'membership-a', tenantRole: 'SITE_MANAGER', projectMemberships: [] },
  });
  await assert.rejects(
    enqueueNotification(withoutProject.prisma, notificationInput()),
    (error) => error?.code === 'NOTIFICATION_PROJECT_RECIPIENT_SCOPE' && error?.status === 409,
  );

  const foreignProject = scopedPrisma({ project: null });
  await assert.rejects(
    enqueueNotification(foreignProject.prisma, notificationInput()),
    (error) => error?.code === 'NOTIFICATION_PROJECT_SCOPE' && error?.status === 409,
  );
});

test('portfolio roles can receive a project notification without a direct project membership', async () => {
  const store = scopedPrisma({
    membership: { id: 'membership-a', tenantRole: 'DIRECTOR', projectMemberships: [] },
  });
  const row = await enqueueNotification(store.prisma, notificationInput());
  assert.equal(row.status, 'SENT');
});

test('disabled external preferences do not create a delivery after scope validation', async () => {
  const store = scopedPrisma({ preferenceEnabled: false });
  const row = await enqueueNotification(store.prisma, notificationInput({ channel: 'EMAIL' }));
  assert.equal(row, null);
  assert.equal(store.calls.membership.length, 1);
  assert.equal(store.calls.project.length, 1);
  assert.equal(store.calls.preference.length, 1);
  assert.equal(store.calls.upsert.length, 0);
});

test('reading an inbox item sets readAt without changing its delivery status', async () => {
  let mutation;
  const reads = [{ readAt: null }, { readAt: NOW }];
  const prisma = {
    notificationDelivery: {
      async findFirst() {
        return reads.shift();
      },
      async updateMany(args) {
        mutation = args;
        return { count: 1 };
      },
    },
  };
  const result = await markNotificationRead(prisma, {
    organizationId: 'organization-a',
    recipientId: 'user-a',
    projectId: 'project-a',
    id: 'delivery-a',
    now: NOW,
  });

  assert.deepEqual(result, { marked: true, replayed: false, readAt: NOW });
  assert.deepEqual(mutation.where, {
    id: 'delivery-a',
    organizationId: 'organization-a',
    recipientId: 'user-a',
    projectId: 'project-a',
    channel: 'IN_APP',
    status: 'SENT',
    readAt: null,
  });
  assert.deepEqual(mutation.data, { readAt: NOW });
});

test('reading an inbox item is an exact replay with the persisted server timestamp', async () => {
  let mutations = 0;
  const persistedReadAt = new Date('2026-08-02T14:58:00.000Z');
  const prisma = {
    notificationDelivery: {
      async findFirst(args) {
        assert.deepEqual(args.where, {
          id: 'delivery-a',
          organizationId: 'organization-a',
          recipientId: 'user-a',
          projectId: 'project-a',
          channel: 'IN_APP',
          status: 'SENT',
        });
        return { readAt: persistedReadAt };
      },
      async updateMany() {
        mutations += 1;
        return { count: 1 };
      },
    },
  };

  const result = await markNotificationRead(prisma, {
    organizationId: 'organization-a',
    recipientId: 'user-a',
    projectId: 'project-a',
    id: 'delivery-a',
    now: NOW,
  });

  assert.deepEqual(result, {
    marked: true,
    replayed: true,
    readAt: persistedReadAt,
  });
  assert.equal(mutations, 0);
});

test('reading never acknowledges an inbox item outside the exact tenant, recipient and project scope', async () => {
  const prisma = {
    notificationDelivery: {
      async findFirst(args) {
        assert.deepEqual(args.where, {
          id: 'delivery-a',
          organizationId: 'organization-a',
          recipientId: 'user-a',
          projectId: 'project-b',
          channel: 'IN_APP',
          status: 'SENT',
        });
        return null;
      },
      async updateMany() {
        assert.fail('an out-of-scope read must not mutate a delivery');
      },
    },
  };

  await assert.rejects(
    markNotificationRead(prisma, {
      organizationId: 'organization-a',
      recipientId: 'user-a',
      projectId: 'project-b',
      id: 'delivery-a',
      now: NOW,
    }),
    (error) => error?.code === 'NOTIFICATION_NOT_FOUND' && error?.status === 404,
  );
});

test('a concurrent read winner remains authoritative and the loser reports replay', async () => {
  const persistedReadAt = new Date('2026-08-02T14:59:00.000Z');
  const reads = [{ readAt: null }, { readAt: persistedReadAt }];
  const prisma = {
    notificationDelivery: {
      async findFirst() {
        return reads.shift();
      },
      async updateMany() {
        return { count: 0 };
      },
    },
  };

  const result = await markNotificationRead(prisma, {
    organizationId: 'organization-a',
    recipientId: 'user-a',
    projectId: 'project-a',
    id: 'delivery-a',
    now: NOW,
  });
  assert.deepEqual(result, {
    marked: true,
    replayed: true,
    readAt: persistedReadAt,
  });
});

test('expired leases deliver IN_APP rows but quarantine external ambiguity', async () => {
  const mutations = [];
  const prisma = {
    notificationDelivery: {
      async updateMany(args) {
        mutations.push(args);
        return { count: mutations.length === 1 ? 2 : 1 };
      },
    },
  };
  const result = await recoverExpiredNotificationLeases(prisma, {
    organizationId: 'organization-a',
    now: NOW,
  });

  assert.deepEqual(result, { inAppDelivered: 2, externalQuarantined: 1, total: 3 });
  assert.equal(mutations[0].where.channel, 'IN_APP');
  assert.equal(mutations[0].data.status, 'SENT');
  assert.equal(mutations[1].where.channel.in.includes('EMAIL'), true);
  assert.equal(mutations[1].where.channel.in.includes('WHATSAPP'), true);
  assert.equal(mutations[1].data.status, 'DEAD_LETTER');
  assert.doesNotMatch(mutations[1].data.lastError, /retry/i);
});

test('the IN_APP worker recovers stale leases before processing legacy pending rows', async () => {
  const mutations = [];
  let pendingRead = false;
  const prisma = {
    organization: {
      async findMany(args) {
        assert.deepEqual(args.where.notificationDeliveries.some.status.in, [
          'PENDING',
          'FAILED',
          'PROCESSING',
        ]);
        return [{ id: 'organization-a' }];
      },
    },
    notificationDelivery: {
      async updateMany(args) {
        mutations.push(args);
        return { count: 1 };
      },
      async findMany() {
        pendingRead = true;
        return [{ id: 'legacy-a', status: 'PENDING', attempts: 0 }];
      },
      async groupBy() {
        return [{ channel: 'IN_APP', status: 'SENT', _count: { _all: 2 } }];
      },
    },
  };

  const result = await processInAppNotifications(prisma, { now: NOW });
  assert.equal(pendingRead, true);
  assert.deepEqual(result, {
    organizations: 1,
    recovered: 1,
    claimed: 1,
    sent: 1,
    hasMore: false,
    health: { 'IN_APP:SENT': 2 },
  });
  assert.equal(mutations[0].data.status, 'SENT');
  assert.equal(mutations[1].data.status, 'PROCESSING');
  assert.equal(mutations[2].data.status, 'SENT');
});
