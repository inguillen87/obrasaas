import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createSupplierCommitment,
  updateSupplierCommitment,
} from '../src/lib/supplier-commitments.js';

function store({ status = 'TENTATIVE', reminderStatus = 'UNCERTAIN', startsOn = '2026-08-20' } = {}) {
  const state = {
    commitment: {
      id: 'commitment-a',
      organizationId: 'organization-a',
      projectId: 'project-a',
      supplierId: 'supplier-a',
      purchaseOrderId: null,
      operationKey: 'create-a',
      requestFingerprint: 'a'.repeat(64),
      kind: 'SERVICE_EXECUTION',
      status,
      title: 'Colocación de aberturas',
      notes: null,
      startsOn: new Date(`${startsOn}T00:00:00.000Z`),
      endsOn: new Date(`${startsOn}T00:00:00.000Z`),
      timezone: 'America/Argentina/Buenos_Aires',
      reminderEnabled: true,
      reminderDaysBefore: 7,
      reminderEmail: 'agenda@proveedor.test',
      reminderEmailConfirmedAt: new Date('2026-08-01T12:00:00.000Z'),
      reminderEmailConfirmedById: 'admin-a',
      scheduleRevision: 0,
      revision: 0,
      fulfilledAt: null,
      supplier: { id: 'supplier-a', legalName: 'Aberturas SA', email: 'agenda@proveedor.test', active: true },
      project: { id: 'project-a', name: 'Edificio Centro' },
      purchaseOrder: null,
      taskLinks: [],
      lines: [],
      reminderDeliveries: [{
        id: 'delivery-old',
        kind: 'UPCOMING',
        status: reminderStatus,
        scheduleRevision: 0,
        attempts: 1,
        scheduledFor: new Date('2026-08-13T12:00:00.000Z'),
        sentAt: null,
        createdAt: new Date('2026-08-01T12:00:00.000Z'),
      }],
      createdAt: new Date('2026-08-01T12:00:00.000Z'),
      updatedAt: new Date('2026-08-01T12:00:00.000Z'),
    },
    events: [],
    deliveries: [],
  };
  const transaction = {
    async $executeRawUnsafe() { return 1; },
    project: {
      async findFirst() {
        return { id: 'project-a', organizationId: 'organization-a', status: 'ACTIVE' };
      },
    },
    supplierCommitmentEvent: {
      async findFirst() { return null; },
      async create({ data }) { state.events.push(data); return data; },
    },
    supplierCommitment: {
      async findFirst({ where }) {
        if (where.id && where.id !== state.commitment.id) return null;
        if (where.revision !== undefined && where.revision !== state.commitment.revision) return null;
        return state.commitment;
      },
      async updateMany({ where, data }) {
        if (where.revision !== state.commitment.revision) return { count: 0 };
        for (const [key, value] of Object.entries(data)) {
          state.commitment[key] = value && typeof value === 'object' && Object.hasOwn(value, 'increment')
            ? Number(state.commitment[key] || 0) + Number(value.increment)
            : value;
        }
        state.commitment.updatedAt = new Date('2026-08-02T12:00:00.000Z');
        return { count: 1 };
      },
    },
    supplierReminderDelivery: {
      async updateMany({ where, data }) {
        let count = 0;
        for (const delivery of state.commitment.reminderDeliveries) {
          if (where.status?.in && !where.status.in.includes(delivery.status)) continue;
          Object.assign(delivery, data);
          count += 1;
        }
        return { count };
      },
      async create({ data }) {
        const delivery = {
          id: `delivery-${state.deliveries.length + 1}`,
          status: 'PENDING',
          attempts: 0,
          sentAt: null,
          createdAt: new Date('2026-08-02T12:00:00.000Z'),
          ...data,
        };
        state.deliveries.push(delivery);
        state.commitment.reminderDeliveries.unshift(delivery);
        return delivery;
      },
    },
    auditLog: { async create() { return {}; } },
  };
  return {
    state,
    prisma: {
      async $transaction(callback) { return callback(transaction); },
    },
  };
}

test('rescheduling a tentative commitment never confirms it implicitly', async () => {
  const current = store();
  const result = await updateSupplierCommitment(current.prisma, {
    scope: { organizationId: 'organization-a', projectId: 'project-a' },
    actorId: 'admin-a',
    commitmentId: 'commitment-a',
    input: {
      operationKey: 'reschedule-a',
      expectedRevision: 0,
      action: 'RESCHEDULE',
      startsOn: '2026-08-22',
      endsOn: '2026-08-22',
      reason: 'Cambio coordinado con el proveedor',
    },
    now: new Date('2026-08-02T12:00:00.000Z'),
  });
  assert.equal(result.commitment.status, 'TENTATIVE');
  assert.equal(result.commitment.scheduleRevision, 1);
  assert.equal(current.state.events[0].type, 'RESCHEDULED');
  assert.deepEqual(current.state.deliveries.map((delivery) => delivery.kind), ['RESCHEDULED']);
});

test('rescheduling a notified commitment inside the seven-day window sends one correction, not two emails', async () => {
  const current = store({ status: 'CONFIRMED', reminderStatus: 'DELIVERED', startsOn: '2026-08-10' });
  await updateSupplierCommitment(current.prisma, {
    scope: { organizationId: 'organization-a', projectId: 'project-a' },
    actorId: 'admin-a',
    commitmentId: 'commitment-a',
    input: {
      operationKey: 'reschedule-b',
      expectedRevision: 0,
      action: 'RESCHEDULE',
      startsOn: '2026-08-11',
      endsOn: '2026-08-11',
      reason: 'Reprogramación confirmada',
    },
    now: new Date('2026-08-08T12:00:00.000Z'),
  });
  assert.deepEqual(current.state.deliveries.map((delivery) => delivery.kind), ['RESCHEDULED']);
});

test('create rejects an operation key already used by an update event', async () => {
  const transaction = {
    async $executeRawUnsafe() { return 1; },
    project: {
      async findFirst() {
        return { id: 'project-a', organizationId: 'organization-a', status: 'ACTIVE' };
      },
    },
    supplierCommitment: { async findFirst() { return null; } },
    supplierCommitmentEvent: {
      async findFirst() { return { id: 'event-from-another-mutation' }; },
    },
  };
  const prisma = { async $transaction(callback) { return callback(transaction); } };
  await assert.rejects(
    createSupplierCommitment(prisma, {
      scope: { organizationId: 'organization-a', projectId: 'project-a' },
      actorId: 'admin-a',
      input: {
        operationKey: 'already-used-by-patch',
        supplierId: 'supplier-a',
        kind: 'SERVICE_EXECUTION',
        status: 'CONFIRMED',
        title: 'Colocar aberturas',
        startsOn: '2026-08-20',
        endsOn: '2026-08-20',
        reminderEnabled: false,
        taskLinks: [],
        lines: [],
      },
    }),
    (error) => error.code === 'IDEMPOTENCY_REPLAY_MUTATED' && error.status === 409,
  );
});
