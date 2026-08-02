import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildScheduleCalendarIcs,
  loadScheduleCalendar,
} from '../src/lib/schedule-calendar.js';
import {
  addCivilDays,
  buildReminderDraft,
  fortnightBucket,
  normalizeSupplierEmail,
  serializeSupplierCommitment,
  zonedCivilDateTime,
} from '../src/lib/supplier-commitments.js';

test('supplier commitments keep civil dates stable and derive true calendar fortnights', () => {
  assert.equal(addCivilDays('2026-03-01', -1), '2026-02-28');
  assert.deepEqual(fortnightBucket('2026-02-16'), {
    id: '2026-02-Q2',
    year: 2026,
    month: 2,
    half: 2,
    start: '2026-02-16',
    end: '2026-02-28',
  });
  assert.equal(
    zonedCivilDateTime('2026-08-08', 'America/Argentina/Buenos_Aires', 9).toISOString(),
    '2026-08-08T12:00:00.000Z',
  );
});

test('supplier email is normalized and malformed destinations fail closed', () => {
  assert.equal(normalizeSupplierEmail(' Operaciones@Proveedor.COM '), 'operaciones@proveedor.com');
  assert.throws(
    () => normalizeSupplierEmail('sin-dominio'),
    (error) => error.code === 'SUPPLIER_REMINDER_EMAIL_REQUIRED' && error.status === 409,
  );
});

const reminderCommitment = {
  id: 'commitment-a',
  organizationId: 'organization-a',
  projectId: 'project-a',
  title: 'Colocación de aberturas',
  startsOn: '2026-08-15',
  endsOn: '2026-08-15',
  timezone: 'America/Argentina/Buenos_Aires',
  reminderDaysBefore: 7,
  reminderEmail: 'agenda@proveedor.test',
  scheduleRevision: 2,
  revision: 2,
};

test('the weekly reminder is scheduled at 09:00 tenant time with a stable event key', () => {
  const draft = buildReminderDraft({
    commitment: reminderCommitment,
    projectName: 'Edificio Centro',
    supplierName: 'Aberturas SA',
    now: new Date('2026-08-01T00:00:00.000Z'),
  });
  assert.equal(draft.kind, 'UPCOMING');
  assert.equal(draft.scheduledFor.toISOString(), '2026-08-08T12:00:00.000Z');
  assert.equal(draft.eventKey, 'supplier:commitment-a:v2:upcoming');
  assert.equal(draft.providerIdempotencyKey, 'local:supplier:commitment-a:v2:upcoming');
  assert.equal(draft.recipientEmail, 'agenda@proveedor.test');
});

test('a commitment created inside the weekly window is an explicit immediate late notice', () => {
  const now = new Date('2026-08-10T15:00:00.000Z');
  const draft = buildReminderDraft({
    commitment: reminderCommitment,
    projectName: 'Edificio Centro',
    supplierName: 'Aberturas SA',
    now,
  });
  assert.equal(draft.kind, 'LATE_SCHEDULED');
  assert.equal(draft.scheduledFor.toISOString(), now.toISOString());
  assert.match(draft.textBody, /aviso inmediato/i);
});

function commitmentRow(overrides = {}) {
  return {
    id: 'commitment-a',
    projectId: 'project-a',
    supplierId: 'supplier-a',
    purchaseOrderId: 'order-a',
    kind: 'MATERIAL_DELIVERY',
    status: 'CONFIRMED',
    title: 'Aberturas',
    notes: null,
    startsOn: new Date('2026-08-18T00:00:00.000Z'),
    endsOn: new Date('2026-08-18T00:00:00.000Z'),
    timezone: 'America/Argentina/Buenos_Aires',
    reminderEnabled: true,
    reminderDaysBefore: 7,
    reminderEmail: 'agenda@proveedor.test',
    reminderEmailConfirmedAt: new Date('2026-08-01T00:00:00.000Z'),
    reminderEmailConfirmedById: 'admin-a',
    scheduleRevision: 0,
    revision: 0,
    fulfilledAt: null,
    supplier: { id: 'supplier-a', legalName: 'Aberturas SA' },
    purchaseOrder: { id: 'order-a', number: 'OC-10', status: 'APPROVED' },
    taskLinks: [{
      taskId: 'task-a',
      relation: 'REQUIRED_BEFORE_START',
      task: {
        id: 'task-a',
        title: 'Colocar aberturas',
        status: 'READY',
        startsAt: new Date('2026-08-20T00:00:00.000Z'),
        endsAt: new Date('2026-08-22T00:00:00.000Z'),
      },
    }],
    lines: [],
    reminderDeliveries: [],
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  };
}

test('readiness is derived without mutating the linked task', () => {
  const safe = serializeSupplierCommitment(commitmentRow(), { now: new Date('2026-08-01T12:00:00.000Z') });
  assert.equal(safe.taskLinks[0].readiness, 'EXPECTED_IN_TIME');
  const risk = serializeSupplierCommitment(commitmentRow({ endsOn: new Date('2026-08-21T00:00:00.000Z') }), { now: new Date('2026-08-01T12:00:00.000Z') });
  assert.equal(risk.taskLinks[0].readiness, 'AT_RISK');
  assert.equal(risk.taskLinks[0].task.status, 'READY');
  assert.equal(Object.hasOwn(risk, 'reminderEmail'), false);
});

test('manual material fulfillment stays explicitly administrative until a receipt is reconciled', () => {
  const fulfilled = serializeSupplierCommitment(commitmentRow({
    status: 'FULFILLED',
    fulfilledAt: new Date('2026-08-18T15:00:00.000Z'),
  }), { now: new Date('2026-08-18T16:00:00.000Z') });
  assert.equal(fulfilled.fulfillmentEvidence, 'ADMIN_ATTESTED');
  assert.equal(fulfilled.taskLinks[0].readiness, 'ADMIN_ATTESTED');
  assert.notEqual(fulfilled.taskLinks[0].readiness, 'AVAILABLE');
});

test('ICS projection has stable identities, revisions and exclusive all-day ends', () => {
  const calendar = {
    generatedAt: '2026-08-01T12:34:56.000Z',
    timezone: 'America/Argentina/Buenos_Aires',
    project: { id: 'project-a', name: 'Edificio Centro', slug: 'edificio-centro' },
    tasks: [{
      id: 'task-a',
      code: '1.2',
      title: 'Levantar muro',
      status: 'READY',
      progress: 20,
      startsOn: '2026-08-01',
      endsOn: '2026-08-03',
      revision: 4,
    }],
    commitments: [serializeSupplierCommitment(commitmentRow(), { now: new Date('2026-08-01T12:00:00.000Z') })],
  };
  const ics = buildScheduleCalendarIcs(calendar);
  assert.match(ics, /UID:task-task-a@calendar\.obrasaas/);
  assert.match(ics, /SEQUENCE:4/);
  assert.match(ics, /DTSTAMP:20260801T123456Z/);
  assert.match(ics, /DTEND;VALUE=DATE:20260804/);
  assert.match(ics, /UID:commitment-commitment-a@calendar\.obrasaas/);
  assert.equal(ics.endsWith('\r\n'), true);
  for (const line of ics.split('\r\n')) {
    assert.ok(Buffer.byteLength(line) <= 75, `ICS line exceeds 75 octets: ${line}`);
  }
});

test('calendar keeps UTC-midnight canonical task dates on the intended civil day', async () => {
  let taskQuery;
  const prisma = {
    project: {
      async findFirst() {
        return {
          id: 'project-a',
          name: 'Edificio Centro',
          slug: 'edificio-centro',
          organization: { timezone: 'America/Argentina/Buenos_Aires' },
        };
      },
    },
    task: {
      async findMany(query) {
        taskQuery = query;
        return [{
          id: 'task-a',
          code: '1',
          title: 'Inicio de obra',
          type: 'TASK',
          status: 'READY',
          progress: 0,
          assignee: null,
          startsAt: new Date('2026-08-01T00:00:00.000Z'),
          endsAt: new Date('2026-08-03T00:00:00.000Z'),
          revision: 0,
          predecessors: [],
          blockers: [],
        }];
      },
    },
    supplierCommitment: { async findMany() { return []; } },
  };
  const calendar = await loadScheduleCalendar(prisma, {
    organizationId: 'organization-a',
    projectId: 'project-a',
    from: '2026-08-01',
    to: '2026-08-31',
    now: new Date('2026-08-01T12:00:00.000Z'),
  });
  assert.equal(calendar.tasks[0].startsOn, '2026-08-01');
  assert.equal(calendar.tasks[0].endsOn, '2026-08-03');
  assert.deepEqual(taskQuery.where.OR, [
    { endsAt: { gte: new Date('2026-08-01T00:00:00.000Z') } },
    { endsAt: null, startsAt: { gte: new Date('2026-08-01T00:00:00.000Z') } },
  ]);
  assert.deepEqual(calendar.fortnights.map((bucket) => [bucket.start, bucket.end]), [
    ['2026-08-01', '2026-08-15'],
    ['2026-08-16', '2026-08-31'],
  ]);
  assert.deepEqual(calendar.fortnights[0].tasks.map((task) => task.id), ['task-a']);
  assert.deepEqual(calendar.fortnights[1].tasks, []);
  assert.equal(calendar.truncated.any, false);
});

test('ICS export refuses to publish a silently truncated calendar', () => {
  assert.throws(
    () => buildScheduleCalendarIcs({
      project: { name: 'Obra' },
      timezone: 'UTC',
      tasks: [],
      commitments: [],
      truncated: { any: true },
    }),
    (error) => error.code === 'SCHEDULE_CALENDAR_TRUNCATED' && error.status === 409,
  );
});
