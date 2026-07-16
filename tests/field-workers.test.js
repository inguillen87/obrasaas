import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FIELD_WORKER_INTENTS,
  FIELD_WORKER_RESOLUTION,
  FieldWorkerInputError,
  canFieldWorkerHandleIntent,
  fieldWorkerWhatsAppRole,
  findFieldWorkerPhoneConflict,
  metadataWithWhatsAppRole,
  normalizeFieldWorkerCreateInput,
  normalizeFieldWorkerPatchInput,
  normalizeWorkerPhone,
  resolveActiveFieldWorkerById,
  resolveActiveFieldWorkerByPhone,
  serializeFieldWorker,
} from '../src/lib/field-workers.js';

const scope = { organizationId: 'org-a', projectId: 'project-a' };
const now = new Date('2026-07-16T12:00:00.000Z');

function worker(overrides = {}) {
  return {
    id: 'worker-a',
    projectId: 'project-a',
    externalId: null,
    phone: '+5491112345678',
    name: 'Juan Gómez',
    role: 'Capataz',
    active: true,
    metadata: { whatsappRole: 'FOREMAN', preserved: true },
    createdAt: now,
    updatedAt: now,
    project: { organizationId: 'org-a' },
    ...overrides,
  };
}

test('phone normalization produces one canonical international representation', () => {
  assert.equal(normalizeWorkerPhone('+54 9 11 1234-5678'), '+5491112345678');
  assert.equal(normalizeWorkerPhone('0054 (9) 11 1234 5678'), '+5491112345678');
  assert.throws(() => normalizeWorkerPhone('54911-call-me'), FieldWorkerInputError);
  assert.throws(() => normalizeWorkerPhone('1234'), /entre 8 y 15/);
});

test('create and patch DTO validation is strict and bounded', () => {
  assert.deepEqual(normalizeFieldWorkerCreateInput({
    name: '  Ana   Pérez ',
    phone: '5491112345678',
    role: ' Seguridad ',
    whatsappRole: 'safety',
  }), {
    name: 'Ana Pérez',
    phone: '+5491112345678',
    role: 'Seguridad',
    whatsappRole: 'SAFETY',
  });
  assert.deepEqual(normalizeFieldWorkerPatchInput({
    workerId: 'worker-a',
    role: null,
    active: false,
  }), { workerId: 'worker-a', data: { role: null, active: false } });
  assert.throws(
    () => normalizeFieldWorkerCreateInput({ name: 'Ana', phone: '5491112345678', admin: true }),
    (error) => error.code === 'UNKNOWN_FIELDS',
  );
  assert.throws(
    () => normalizeFieldWorkerPatchInput({ workerId: 'worker-a' }),
    (error) => error.code === 'EMPTY_UPDATE',
  );
});

test('WhatsApp role metadata defaults safely and preserves unrelated metadata', () => {
  assert.equal(fieldWorkerWhatsAppRole({ metadata: { whatsappRole: 'ROOT' } }), 'WORKER');
  assert.deepEqual(metadataWithWhatsAppRole({ preserved: true }, 'SITE_MANAGER'), {
    preserved: true,
    whatsappRole: 'SITE_MANAGER',
  });
});

test('intent matrix grants progress and delay mutations only to foremen and site managers', () => {
  for (const role of ['WORKER', 'FOREMAN', 'SITE_MANAGER', 'SAFETY']) {
    assert.equal(canFieldWorkerHandleIntent(role, FIELD_WORKER_INTENTS.INCIDENT), true);
    assert.equal(canFieldWorkerHandleIntent(role, FIELD_WORKER_INTENTS.ATTENDANCE_START), true);
  }
  assert.equal(canFieldWorkerHandleIntent('WORKER', FIELD_WORKER_INTENTS.TASK_PROGRESS), false);
  assert.equal(canFieldWorkerHandleIntent('SAFETY', FIELD_WORKER_INTENTS.TASK_PROGRESS), false);
  assert.equal(canFieldWorkerHandleIntent('FOREMAN', FIELD_WORKER_INTENTS.TASK_PROGRESS), true);
  assert.equal(canFieldWorkerHandleIntent('SITE_MANAGER', FIELD_WORKER_INTENTS.TASK_PROGRESS), true);
  assert.equal(canFieldWorkerHandleIntent('UNTRUSTED', FIELD_WORKER_INTENTS.TASK_PROGRESS), false);
  assert.equal(canFieldWorkerHandleIntent('WORKER', FIELD_WORKER_INTENTS.DELAY_REPORT), false);
  assert.equal(canFieldWorkerHandleIntent('SAFETY', FIELD_WORKER_INTENTS.DELAY_REPORT), false);
  assert.equal(canFieldWorkerHandleIntent('FOREMAN', FIELD_WORKER_INTENTS.DELAY_REPORT), true);
  assert.equal(canFieldWorkerHandleIntent('SITE_MANAGER', FIELD_WORKER_INTENTS.DELAY_REPORT), true);
  assert.equal(canFieldWorkerHandleIntent('UNTRUSTED', FIELD_WORKER_INTENTS.DELAY_REPORT), false);
});

test('serializer exposes the exact public DTO and no metadata', () => {
  assert.deepEqual(serializeFieldWorker(worker()), {
    id: 'worker-a',
    name: 'Juan Gómez',
    phone: '+5491112345678',
    role: 'Capataz',
    whatsappRole: 'FOREMAN',
    active: true,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });
});

test('phone resolver requires one active match inside both project and tenant scope', async () => {
  let query;
  const prisma = {
    worker: {
      findMany: async (args) => {
        query = args;
        return [
          worker({ id: 'inactive', active: false }),
          worker(),
          worker({ id: 'tenant-b', project: { organizationId: 'org-b' } }),
        ];
      },
    },
  };
  const result = await resolveActiveFieldWorkerByPhone(prisma, scope, '5491112345678');
  assert.equal(query.where.projectId, 'project-a');
  assert.equal(query.where.project.organizationId, 'org-a');
  assert.equal(query.where.active, true);
  assert.equal(result.status, FIELD_WORKER_RESOLUTION.RESOLVED);
  assert.equal(result.worker.id, 'worker-a');
});

test('phone resolver rejects invalid, unknown and ambiguous identities', async () => {
  const unknownPrisma = { worker: { findMany: async () => [] } };
  assert.equal(
    (await resolveActiveFieldWorkerByPhone(unknownPrisma, scope, 'not-a-phone')).status,
    FIELD_WORKER_RESOLUTION.INVALID_PHONE,
  );
  assert.equal(
    (await resolveActiveFieldWorkerByPhone(unknownPrisma, scope, '5491112345678')).status,
    FIELD_WORKER_RESOLUTION.UNKNOWN,
  );
  const ambiguousPrisma = {
    worker: { findMany: async () => [worker(), worker({ id: 'worker-b', phone: '54 9 11 1234 5678' })] },
  };
  assert.equal(
    (await resolveActiveFieldWorkerByPhone(ambiguousPrisma, scope, '5491112345678')).status,
    FIELD_WORKER_RESOLUTION.AMBIGUOUS,
  );
});

test('id resolver and phone conflict lookup retain project and tenant boundaries', async () => {
  let idQuery;
  const prisma = {
    worker: {
      findFirst: async (args) => {
        idQuery = args;
        return worker();
      },
      findMany: async () => [
        worker({ id: 'worker-a' }),
        worker({ id: 'tenant-b', project: { organizationId: 'org-b' } }),
      ],
    },
  };
  const byId = await resolveActiveFieldWorkerById(prisma, scope, 'worker-a');
  assert.equal(idQuery.where.id, 'worker-a');
  assert.equal(idQuery.where.projectId, 'project-a');
  assert.equal(idQuery.where.project.organizationId, 'org-a');
  assert.equal(byId.status, FIELD_WORKER_RESOLUTION.RESOLVED);

  const conflict = await findFieldWorkerPhoneConflict(
    prisma,
    scope,
    '+5491112345678',
    'different-worker',
  );
  assert.equal(conflict.id, 'worker-a');
});
